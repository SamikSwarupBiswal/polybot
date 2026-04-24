import { VirtualWallet } from './VirtualWallet.js';
import { logger } from '../utils/logger.js';
import { TradeCategory } from './FeeSimulator.js';
import { PerformanceTracker } from '../analytics/PerformanceTracker.js';

export interface TradeSignal {
    mode: 'COPY_TRADE' | 'AI_SIGNAL';
    market_id: string;
    market_question: string;
    category: TradeCategory;
    side: 'YES' | 'NO';
    requested_price: number;
    recommended_size_usd: number;
    source: string;
    confidence: number;
    force_maker: boolean;
    market_volume_usd?: number;
    market_end_date?: string;
    whale_trade_size_usd?: number;
    current_market_price?: number;
    model_probability?: number;
}

export class RiskGate {
    private readonly maxDrawdownLimit = 0.25;
    private readonly dailyLossLimitPct = 0.10;
    private readonly maxSingleMarketExposurePct = 0.05;
    private readonly maxCategoryExposurePct = 0.25;
    private readonly maxOpenPositions = 15;
    private readonly minMarketVolumeUsd = 50000;
    private readonly minWhaleTradeUsd = 5000;
    private readonly maxWhaleFollowUsd = 2000;
    private readonly minHoursToResolution = 48;
    private readonly minTradeSizeUsd = 10;

    /**
     * Evaluates an incoming strategy signal against risk limits.
     * Returns a constrained investment size, or 0 if blocked.
     */
    public evaluateSignal(signal: TradeSignal, wallet: VirtualWallet): number {
        logger.verbose(`[RiskGate] Evaluating signal for ${signal.market_id} (${signal.side})`);

        // 1. Check Drawdown Limit cutoff
        const metrics = PerformanceTracker.getMetrics(wallet);
        const currentDrawdown = parseFloat(metrics.maxDrawdown.replace('%', '')) / 100;
        
        if (currentDrawdown >= this.maxDrawdownLimit) {
             logger.warn(`[RiskGate] BLOCKED: Max drawdown of ${(this.maxDrawdownLimit * 100).toFixed(0)}% breached! Currently at ${(currentDrawdown * 100).toFixed(2)}%. Trading halted.`);
             return 0;
        }

        // 2. Hard portfolio limits from the PRD
        if (wallet.getOpenTrades().length >= this.maxOpenPositions) {
            logger.warn(`[RiskGate] BLOCKED: Max open positions (${this.maxOpenPositions}) reached.`);
            return 0;
        }

        const dayStart = new Date();
        dayStart.setUTCHours(0, 0, 0, 0);
        const dailyPnl = wallet.getRealizedPnlSince(dayStart);
        const dailyLossLimitUsd = wallet.getTotalDeposited() * this.dailyLossLimitPct;
        if (dailyPnl <= -dailyLossLimitUsd) {
            logger.warn(`[RiskGate] BLOCKED: Daily loss cap hit. Realized today: $${dailyPnl.toFixed(2)}, cap: -$${dailyLossLimitUsd.toFixed(2)}.`);
            return 0;
        }

        // 3. Minimum liquidity, timing, and signal quality checks
        if (signal.confidence < 0.6) {
            logger.warn(`[RiskGate] BLOCKED: Confidence score ${signal.confidence.toFixed(2)} is below minimum 0.60.`);
            return 0;
        }

        if (typeof signal.market_volume_usd !== 'number' || signal.market_volume_usd < this.minMarketVolumeUsd) {
            logger.warn(`[RiskGate] BLOCKED: Market volume is missing or below $${this.minMarketVolumeUsd.toLocaleString()} minimum.`);
            return 0;
        }

        if (!signal.market_end_date || this.hoursUntil(signal.market_end_date) < this.minHoursToResolution) {
            logger.warn(`[RiskGate] BLOCKED: Market resolves in less than ${this.minHoursToResolution} hours or has no end date.`);
            return 0;
        }

        if (signal.mode === 'COPY_TRADE' && (signal.whale_trade_size_usd || 0) < this.minWhaleTradeUsd) {
            logger.warn(`[RiskGate] BLOCKED: Whale trade size $${(signal.whale_trade_size_usd || 0).toFixed(2)} is below $${this.minWhaleTradeUsd.toLocaleString()} conviction threshold.`);
            return 0;
        }

        // 4. Position sizing: cap per market, per category, available balance, and copy-trade follow size.
        const conservativeEquity = wallet.getConservativeEquity();
        const marketRoom = Math.max(0, conservativeEquity * this.maxSingleMarketExposurePct - wallet.getOpenExposureByMarket(signal.market_id));
        const categoryRoom = Math.max(0, conservativeEquity * this.maxCategoryExposurePct - wallet.getOpenExposureByCategory(signal.category));
        const copyTradeRoom = signal.mode === 'COPY_TRADE' ? this.maxWhaleFollowUsd : Number.POSITIVE_INFINITY;

        const approvedSize = Math.min(
            signal.recommended_size_usd,
            wallet.getBalance(),
            marketRoom,
            categoryRoom,
            copyTradeRoom
        );

        if (approvedSize < this.minTradeSizeUsd) {
            logger.warn(`[RiskGate] BLOCKED: Approved trade size ($${approvedSize.toFixed(2)}) is below minimum $${this.minTradeSizeUsd} threshold after exposure caps.`);
            return 0;
        }

        if (approvedSize < signal.recommended_size_usd) {
            logger.info(`[RiskGate] RESIZED: Recommended size $${signal.recommended_size_usd.toFixed(2)} exceeds 5% cap. Resized to $${approvedSize.toFixed(2)}.`);
        } else {
            logger.debug(`[RiskGate] APPROVED: Signal size $${approvedSize.toFixed(2)} clears limits.`);
        }

        return approvedSize;
    }

    private hoursUntil(dateString: string): number {
        const targetMs = new Date(dateString).getTime();
        if (Number.isNaN(targetMs)) return 0;
        return (targetMs - Date.now()) / (1000 * 60 * 60);
    }
}
