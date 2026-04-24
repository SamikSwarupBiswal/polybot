import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { MarketScanner } from './MarketScanner.js';
import { OrderbookAnalyzer } from './OrderbookAnalyzer.js';
import { OpportunityScorer, ScoredMarket } from './OpportunityScorer.js';
import { PriceHistoryStore } from '../data/PriceHistoryStore.js';
import { TradeSignal } from '../execution/RiskGate.js';

/**
 * Orchestrates the full market research pipeline on a configurable schedule:
 *   MarketScanner → OrderbookAnalyzer → OpportunityScorer → emit TradeSignals
 *
 * Emits 'signal' events that the SignalAggregator can consume, just like
 * WhaleMonitor and AISignalEngine.
 */
export class MarketResearchRunner extends EventEmitter {
    private readonly scanner: MarketScanner;
    private readonly analyzer: OrderbookAnalyzer;
    private readonly scorer: OpportunityScorer;
    private readonly priceHistory: PriceHistoryStore;
    private readonly intervalMs: number;
    private readonly signalsPerCycle: number;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;

    /** Tracks which markets we've already emitted signals for,
     *  so we don't spam the same market every 15 minutes. */
    private readonly recentlySignaled = new Map<string, number>();
    private readonly signalCooldownMs: number;

    constructor(opts?: {
        intervalMs?: number;
        signalsPerCycle?: number;
        signalCooldownMs?: number;
        maxPages?: number;
        minVolumeUsd?: number;
        priceHistory?: PriceHistoryStore;
    }) {
        super();
        this.intervalMs = opts?.intervalMs ?? 15 * 60 * 1000;       // 15 min
        this.signalsPerCycle = opts?.signalsPerCycle ?? 5;
        this.signalCooldownMs = opts?.signalCooldownMs ?? 60 * 60 * 1000; // 1 hour

        this.scanner = new MarketScanner({
            maxPages: opts?.maxPages ?? 10,
            minVolumeUsd: opts?.minVolumeUsd ?? 50000
        });
        this.analyzer = new OrderbookAnalyzer();
        this.scorer = new OpportunityScorer({ topN: 20 });
        this.priceHistory = opts?.priceHistory ?? new PriceHistoryStore();
    }

    public startPolling() {
        logger.info(`[MarketResearch] Starting research pipeline every ${Math.round(this.intervalMs / 60000)} minutes.`);
        this.intervalId = setInterval(() => {
            this.runCycle();
        }, this.intervalMs);
        // First run immediately
        this.runCycle();
    }

    public stopPolling() {
        if (this.intervalId) clearInterval(this.intervalId);
        logger.info('[MarketResearch] Stopped research pipeline.');
    }

    /** Manually trigger a research cycle (also called on timer). */
    public async runCycle(): Promise<ScoredMarket[]> {
        if (this.isRunning) {
            logger.debug('[MarketResearch] Skipping cycle — previous cycle still running.');
            return [];
        }

        this.isRunning = true;
        const cycleStart = Date.now();

        try {
            // Step 1: Scan markets
            const candidates = await this.scanner.scan();
            if (candidates.length === 0) {
                logger.warn('[MarketResearch] No candidate markets found. Skipping cycle.');
                return [];
            }

            // Step 2: Price them via CLOB (limit to top 80 by volume to stay within rate limits)
            const sortedByVolume = [...candidates].sort((a, b) => b.volume - a.volume).slice(0, 80);
            const pricedMarkets = await this.analyzer.analyze(sortedByVolume);

            // Step 2.5: Record price snapshots for history-based signals
            this.priceHistory.record(pricedMarkets);

            // Step 3: Score and rank
            const ranked = this.scorer.rank(pricedMarkets);

            // Step 4: Emit signals for the top N that haven't been signaled recently
            this.cleanupCooldowns();
            let emittedCount = 0;

            for (const scored of ranked) {
                if (emittedCount >= this.signalsPerCycle) break;

                const marketId = scored.market.market.conditionId;
                const lastSignaled = this.recentlySignaled.get(marketId);
                if (lastSignaled && Date.now() - lastSignaled < this.signalCooldownMs) {
                    continue;
                }

                const signal = this.buildSignal(scored);
                this.recentlySignaled.set(marketId, Date.now());
                emittedCount++;

                logger.info(`[MarketResearch] Emitting signal #${emittedCount}: ${signal.side} "${signal.market_question.substring(0, 50)}..." @ $${signal.requested_price.toFixed(3)} (score: ${scored.score.toFixed(3)})`);
                this.emit('signal', signal);
            }

            const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
            logger.info(`[MarketResearch] Cycle complete in ${elapsed}s: ${candidates.length} scanned → ${pricedMarkets.length} priced → ${ranked.length} scored → ${emittedCount} signals emitted.`);

            return ranked;
        } catch (error: any) {
            logger.error(`[MarketResearch] Cycle failed: ${error.message}`);
            return [];
        } finally {
            this.isRunning = false;
        }
    }

    private buildSignal(scored: ScoredMarket): TradeSignal {
        const m = scored.market.market;
        return {
            mode: 'AI_SIGNAL',
            market_id: m.conditionId,
            outcome_token_id: scored.recommendedTokenId,
            market_question: m.question,
            category: m.category,
            side: scored.recommendedSide,
            requested_price: scored.recommendedPrice,
            recommended_size_usd: 1500,  // RiskGate will downsize as needed
            source: `MarketResearch (score: ${scored.score.toFixed(3)})`,
            confidence: Math.min(Math.max(scored.score, 0.60), 0.95),
            force_maker: true,
            market_volume_usd: m.volume,
            market_end_date: m.endDate,
            current_market_price: scored.recommendedSide === 'YES'
                ? scored.market.yesMidpoint
                : 1 - scored.market.yesMidpoint,
            model_probability: undefined  // No LLM model yet — scorer confidence drives sizing
        };
    }

    /** Clean up cooldown entries older than the window to prevent unbounded growth. */
    private cleanupCooldowns() {
        const now = Date.now();
        for (const [key, ts] of this.recentlySignaled) {
            if (now - ts > this.signalCooldownMs * 2) {
                this.recentlySignaled.delete(key);
            }
        }
    }
}
