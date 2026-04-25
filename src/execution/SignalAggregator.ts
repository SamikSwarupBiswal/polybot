import { EventEmitter } from 'events';
import { WhaleMonitor } from '../data/WhaleMonitor.js';
import { AISignalEngine } from '../strategy/AISignalEngine.js';
import { PaperTradeExecutor } from './PaperTradeExecutor.js';
import { RiskGate, TradeSignal } from './RiskGate.js';
import { VirtualWallet } from './VirtualWallet.js';
import { MarketResearchRunner } from '../research/MarketResearchRunner.js';
import { logger } from '../utils/logger.js';

export class SignalAggregator {
    private monitor: WhaleMonitor;
    private aiEngine: AISignalEngine;
    private executor: PaperTradeExecutor;
    private riskGate: RiskGate;
    private wallet: VirtualWallet;

    /** Deduplication: tracks recently-processed market_ids with timestamps */
    private readonly recentlyProcessed = new Map<string, number>();
    private readonly dedupCooldownMs = 60 * 60 * 1000; // 60 minutes

    constructor(
        monitor: WhaleMonitor,
        aiEngine: AISignalEngine,
        executor: PaperTradeExecutor,
        riskGate: RiskGate,
        wallet: VirtualWallet
    ) {
        this.monitor = monitor;
        this.aiEngine = aiEngine;
        this.executor = executor;
        this.riskGate = riskGate;
        this.wallet = wallet;

        this.wireMonitor();
        this.wireAiEngine();
    }

    private wireAiEngine() {
        this.aiEngine.on('signal', (signal: TradeSignal) => {
            logger.info(`[SignalAggregator] Received new AI Trade Signal for ${signal.market_id}`);
            this.processRouting(signal);
        });
    }

    private wireMonitor() {
        this.monitor.on('signal', (signal: TradeSignal) => {
            logger.info(`[SignalAggregator] Received new Whale Trade Signal from ${signal.source}`);
            this.processRouting(signal);
        });
    }

    /** Wire the MarketResearchRunner so its signals flow through the same risk pipeline. */
    public wireResearchRunner(runner: MarketResearchRunner) {
        runner.on('signal', (signal: TradeSignal) => {
            logger.info(`[SignalAggregator] Received new Market Research Signal for ${signal.market_id}`);
            this.processRouting(signal);
        });
    }

    public processSignal(signal: TradeSignal) {
        this.processRouting(signal);
    }

    private processRouting(signal: TradeSignal) {
        // Dedup: skip if same market_id was processed recently
        this.cleanupDedup();
        const lastProcessed = this.recentlyProcessed.get(signal.market_id);
        if (lastProcessed && Date.now() - lastProcessed < this.dedupCooldownMs) {
            logger.debug(`[SignalAggregator] DEDUP: Skipping ${signal.market_id} — already processed ${Math.round((Date.now() - lastProcessed) / 60000)}m ago.`);
            return;
        }

        // 1. Evaluate Risk
        const approvedSize = this.riskGate.evaluateSignal(signal, this.wallet);

        // 2. Execute if approved
        if (approvedSize > 0) {
            this.recentlyProcessed.set(signal.market_id, Date.now());
            this.executor.executeSignal(
                signal.mode,
                signal.market_id,
                signal.outcome_token_id,
                signal.market_question,
                signal.category,
                signal.side,
                signal.requested_price,
                approvedSize,
                signal.source,
                signal.confidence,
                signal.force_maker,
                signal.max_loss_pct,
                signal.market_end_date
            );
        }
    }

    private cleanupDedup() {
        const now = Date.now();
        for (const [key, ts] of this.recentlyProcessed) {
            if (now - ts > this.dedupCooldownMs * 2) {
                this.recentlyProcessed.delete(key);
            }
        }
    }
}

