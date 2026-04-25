import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { WebSocketService, PriceUpdate } from '../data/WebSocketService.js';
import { DipDetector, DipSignal } from './DipDetector.js';
import { TradeSignal } from '../execution/RiskGate.js';
import { TradeCategory } from '../execution/FeeSimulator.js';

export interface TrackerMarket {
    market_id: string;
    question: string;
    category: TradeCategory;
    tokens: {
        tokenId: string;
        outcome: string; // "YES" | "NO"
    }[];
}

export class DipArbStrategy extends EventEmitter {
    private ws: WebSocketService;
    private dipDetector: DipDetector;
    private trackedTokens: Map<string, TrackerMarket & { thisOutcome: string, oppositeToken: string | null }> = new Map();
    private latestPrices: Map<string, number> = new Map();

    private currentRound: {
        leg1Executed: boolean;
        leg1TokenId: string;
        leg1Price: number;
        leg1Timestamp: number;
        leg2Executed: boolean;
    } | null = null;

    private config = {
        shares: 25,
        sumTarget: 0.95,
        leg2TimeoutSeconds: 60
    };

    constructor(ws: WebSocketService, dipDetector: DipDetector) {
        super();
        this.ws = ws;
        this.dipDetector = dipDetector;

        this.ws.on('priceUpdate', (update: PriceUpdate) => {
            this.handlePriceUpdate(update);
        });
    }

    public trackMarkets(markets: TrackerMarket[]) {
        const tokenIdsToSubscribe: string[] = [];

        for (const m of markets) {
            if (m.tokens.length !== 2) continue; // Only handle binary markets for simple arb

            const t1 = m.tokens[0];
            const t2 = m.tokens[1];

            this.trackedTokens.set(t1.tokenId, { ...m, thisOutcome: t1.outcome, oppositeToken: t2.tokenId });
            this.trackedTokens.set(t2.tokenId, { ...m, thisOutcome: t2.outcome, oppositeToken: t1.tokenId });

            tokenIdsToSubscribe.push(t1.tokenId, t2.tokenId);
        }

        if (tokenIdsToSubscribe.length > 0) {
            logger.info(`[DipArbStrategy] Tracking ${markets.length} markets for dips...`);
            this.ws.subscribeMarket(tokenIdsToSubscribe);
        }
    }

    private handlePriceUpdate(update: PriceUpdate) {
        // Save latest price for leg2 evaluation
        this.latestPrices.set(update.tokenId, update.price);

        const marketMeta = this.trackedTokens.get(update.tokenId);
        if (!marketMeta) return;

        // Add to detector
        this.dipDetector.addPricePoint(update.tokenId, update.price);

        // Check for Dip (Leg 1)
        const dipSignal = this.dipDetector.detectDip(update.tokenId);
        if (dipSignal && !this.currentRound) {
            this.executeLeg1(dipSignal, marketMeta);
        }

        // Check Leg 2 if we have an open round
        if (this.currentRound && this.currentRound.leg1Executed && !this.currentRound.leg2Executed) {
            this.checkLeg2Condition();
        }
    }

    private executeLeg1(signal: DipSignal, meta: TrackerMarket & { thisOutcome: string }) {
        logger.info(`[DipArbStrategy] DIP DETECTED! ${meta.thisOutcome} dipped ${(signal.dropPct * 100).toFixed(1)}% to $${signal.currentPrice.toFixed(3)} on market: ${meta.market_id}`);

        this.currentRound = {
            leg1Executed: true,
            leg1TokenId: signal.tokenId,
            leg1Price: signal.currentPrice,
            leg1Timestamp: Date.now(),
            leg2Executed: false
        };

        const tradeSignal: TradeSignal = {
            mode: 'AI_SIGNAL', // Repurposing AI_SIGNAL execution flow for automated arb
            market_id: meta.market_id,
            market_question: meta.question,
            category: meta.category,
            side: meta.thisOutcome.toUpperCase() === 'YES' ? 'YES' : 'NO',
            requested_price: signal.currentPrice,
            recommended_size_usd: signal.currentPrice * this.config.shares,
            source: 'Dip Arbitrage Leg 1',
            confidence: 0.95, // 95% confidence for proven strategy
            force_maker: false
        };

        this.emit('signal', tradeSignal);
    }

    private checkLeg2Condition() {
        if (!this.currentRound) return;

        const leg1Meta = this.trackedTokens.get(this.currentRound.leg1TokenId);
        if (!leg1Meta || !leg1Meta.oppositeToken) return;

        const oppositePrice = this.latestPrices.get(leg1Meta.oppositeToken);
        if (!oppositePrice) return;

        const totalCost = this.currentRound.leg1Price + oppositePrice;

        const elapsed = Date.now() - this.currentRound.leg1Timestamp;
        const timeoutReached = elapsed > this.config.leg2TimeoutSeconds * 1000;

        if (totalCost <= this.config.sumTarget || timeoutReached) {
            const reason = timeoutReached ? 'Leg 2 Timeout' : `Arb Lock ($${totalCost.toFixed(3)})`;
            logger.info(`[DipArbStrategy] Executing Leg 2: ${reason}`);

            this.currentRound.leg2Executed = true;

            const tradeSignal: TradeSignal = {
                mode: 'AI_SIGNAL',
                market_id: leg1Meta.market_id,
                market_question: leg1Meta.question,
                category: leg1Meta.category,
                // Opposite side
                side: leg1Meta.thisOutcome.toUpperCase() === 'YES' ? 'NO' : 'YES',
                requested_price: oppositePrice,
                recommended_size_usd: oppositePrice * this.config.shares,
                source: `Dip Arbitrage Leg 2 (${reason})`,
                confidence: 0.95,
                force_maker: false
            };

            this.emit('signal', tradeSignal);

            // Reset round to hunt again
            setTimeout(() => {
                this.currentRound = null;
            }, 5000);
        }
    }
}
