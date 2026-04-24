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
    private readonly stopTradingEquityFloorPct = 0.50;
    private readonly maxSingleMarketExposurePct = 0.05;
    private readonly maxCategoryExposurePct = 0.25;
    private readonly maxOpenPositions = 15;
    private readonly minMarketVolumeUsd = 50000;
    private readonly minWhaleTradeUsd = 5000;
    private readonly maxWhaleFollowUsd = 2000;
    private readonly minHoursToResolution = 48;
    private readonly minTradeSizeUsd = 10;
    private readonly baseRiskPct = 0.015;
    private readonly maxRiskPct = 0.035;
    private readonly highConvictionEdgePct = 0.20;

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
        const conservativeEquity = wallet.getConservativeEquity();
        const equityFloor = wallet.getTotalDeposited() * this.stopTradingEquityFloorPct;
        if (conservativeEquity <= equityFloor) {
            logger.warn(`[RiskGate] BLOCKED: Conservative equity $${conservativeEquity.toFixed(2)} is at/below the 50% capital preservation floor of $${equityFloor.toFixed(2)}.`);
            return 0;
        }

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

        // 4. Bankroll-aware position sizing: bets shrink as the wallet approaches
        // the 50% capital floor and grow only gently when the wallet is ahead.
        const bankrollSizedTrade = this.calculateBankrollAwareSize(signal, wallet, conservativeEquity);
        const marketRoom = Math.max(0, conservativeEquity * this.maxSingleMarketExposurePct - wallet.getOpenExposureByMarket(signal.market_id));
        const categoryRoom = Math.max(0, conservativeEquity * this.maxCategoryExposurePct - wallet.getOpenExposureByCategory(signal.category));
        const copyTradeRoom = signal.mode === 'COPY_TRADE' ? this.maxWhaleFollowUsd : Number.POSITIVE_INFINITY;

        const approvedSize = Math.min(
            signal.recommended_size_usd,
            bankrollSizedTrade,
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
            logger.info(`[RiskGate] RESIZED: Recommended size $${signal.recommended_size_usd.toFixed(2)} exceeds bankroll/risk caps. Resized to $${approvedSize.toFixed(2)}.`);
        } else {
            logger.debug(`[RiskGate] APPROVED: Signal size $${approvedSize.toFixed(2)} clears limits.`);
        }

        return approvedSize;
    }

    private calculateBankrollAwareSize(signal: TradeSignal, wallet: VirtualWallet, conservativeEquity: number): number {
        const initialCapital = wallet.getTotalDeposited();
        const equityFloor = initialCapital * this.stopTradingEquityFloorPct;
        const floorBuffer = Math.max(0, conservativeEquity - equityFloor);
        const floorBufferPct = initialCapital > 0 ? floorBuffer / initialCapital : 0;
        const profitPct = initialCapital > 0 ? Math.max(0, (conservativeEquity - initialCapital) / initialCapital) : 0;
        const edgePct = this.estimateEdgePct(signal);

        const confidenceMultiplier = Math.min(Math.max(signal.confidence, 0.6), 0.95);
        const edgeMultiplier = edgePct > 0
            ? Math.min(1.25, 0.5 + edgePct / this.highConvictionEdgePct)
            : 0.75;
        const drawdownMultiplier = Math.min(1, Math.max(0.15, floorBufferPct / this.stopTradingEquityFloorPct));
        const profitMultiplier = Math.min(1.25, 1 + profitPct * 0.5);

        const riskPct = Math.min(
            this.maxRiskPct,
            this.baseRiskPct * confidenceMultiplier * edgeMultiplier * drawdownMultiplier * profitMultiplier
        );

        const size = conservativeEquity * riskPct;
        logger.debug(`[RiskGate] Bankroll sizing: equity=$${conservativeEquity.toFixed(2)}, riskPct=${(riskPct * 100).toFixed(2)}%, size=$${size.toFixed(2)}.`);
        return size;
    }

    private estimateEdgePct(signal: TradeSignal): number {
        if (typeof signal.model_probability !== 'number' || typeof signal.current_market_price !== 'number') {
            return signal.mode === 'COPY_TRADE' ? 0.10 : 0;
        }

        const modelSidePrice = signal.side === 'YES'
            ? signal.model_probability
            : 1 - signal.model_probability;

        return Math.max(0, Math.abs(modelSidePrice - signal.current_market_price));
    }

    private hoursUntil(dateString: string): number {
        const targetMs = new Date(dateString).getTime();
        if (Number.isNaN(targetMs)) return 0;
        return (targetMs - Date.now()) / (1000 * 60 * 60);
    }
}
