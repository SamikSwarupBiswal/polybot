import { EventEmitter } from 'events';
import { WhaleMonitor } from '../data/WhaleMonitor.js';
import { AISignalEngine } from '../strategy/AISignalEngine.js';
import { PaperTradeExecutor } from './PaperTradeExecutor.js';
import { RiskGate, TradeSignal } from './RiskGate.js';
import { VirtualWallet } from './VirtualWallet.js';
import { logger } from '../utils/logger.js';

export class SignalAggregator {
    private monitor: WhaleMonitor;
    private aiEngine: AISignalEngine;
    private executor: PaperTradeExecutor;
    private riskGate: RiskGate;
    private wallet: VirtualWallet;

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

    private processRouting(signal: TradeSignal) {
        // 1. Evaluate Risk
        const approvedSize = this.riskGate.evaluateSignal(signal, this.wallet);

        // 2. Execute if approved
        if (approvedSize > 0) {
            this.executor.executeSignal(
                signal.mode,
                signal.market_id,
                signal.market_question,
                signal.category,
                signal.side,
                signal.requested_price,
                approvedSize,
                signal.source,
                signal.confidence,
                signal.force_maker,
                signal.max_loss_pct
            );
        }
    }
}
