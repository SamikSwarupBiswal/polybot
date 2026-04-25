import { TradeRecord } from './VirtualWallet.js';
import { logger } from '../utils/logger.js';

export type ExitReason = 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'TIME_EXIT' | 'STALE_SIGNAL' | 'MANUAL_EXIT';

export interface ExitResult {
    reason: ExitReason;
    message: string;
}

/** Default trailing stop activation threshold: price must be 15%+ above entry. */
const TRAILING_ACTIVATION_PCT = 0.15;
/** Default trailing distance from high water mark. */
const TRAILING_PCT_NORMAL = 0.15;
const TRAILING_PCT_HIGH_CONVICTION = 0.10;
/** Hours before market end to trigger time-based exit. */
const TIME_EXIT_HOURS = 24;
/** Confidence half-life in days. After this many days, effective confidence = 50% of original. */
const CONFIDENCE_HALF_LIFE_DAYS = 21;
/** Minimum effective confidence before stale exit triggers. */
const STALE_CONFIDENCE_THRESHOLD = 0.40;

export class ExitStrategy {

    /**
     * Evaluate all exit strategies for a trade in priority order.
     * Returns the first triggered exit, or null if no exit should happen.
     */
    public static evaluate(
        trade: TradeRecord,
        currentPrice: number,
        highWaterMark: number
    ): ExitResult | null {

        // 1. STOP LOSS (highest priority — capital preservation)
        const stopLossResult = ExitStrategy.checkStopLoss(trade, currentPrice);
        if (stopLossResult) return stopLossResult;

        // 2. TAKE PROFIT
        const takeProfitResult = ExitStrategy.checkTakeProfit(trade, currentPrice);
        if (takeProfitResult) return takeProfitResult;

        // 3. TRAILING STOP (only if in profit zone)
        const trailingResult = ExitStrategy.checkTrailingStop(trade, currentPrice, highWaterMark);
        if (trailingResult) return trailingResult;

        // 4. TIME-BASED EXIT
        const timeResult = ExitStrategy.checkTimeExit(trade);
        if (timeResult) return timeResult;

        // 5. STALE SIGNAL DECAY
        const staleResult = ExitStrategy.checkStaleSignal(trade);
        if (staleResult) return staleResult;

        return null;
    }

    // ─── Individual Checks ──────────────────────────────────────

    private static checkStopLoss(trade: TradeRecord, currentPrice: number): ExitResult | null {
        if (typeof trade.stop_loss_price !== 'number') return null;
        if (currentPrice <= trade.stop_loss_price) {
            return {
                reason: 'STOP_LOSS',
                message: `Price $${currentPrice.toFixed(3)} hit stop-loss at $${trade.stop_loss_price.toFixed(3)}`
            };
        }
        return null;
    }

    private static checkTakeProfit(trade: TradeRecord, currentPrice: number): ExitResult | null {
        if (typeof trade.take_profit_price !== 'number') return null;
        if (currentPrice >= trade.take_profit_price) {
            const profitPct = ((currentPrice - trade.entry_price) / trade.entry_price * 100).toFixed(1);
            return {
                reason: 'TAKE_PROFIT',
                message: `Price $${currentPrice.toFixed(3)} hit take-profit at $${trade.take_profit_price.toFixed(3)} (+${profitPct}%)`
            };
        }
        return null;
    }

    private static checkTrailingStop(
        trade: TradeRecord,
        currentPrice: number,
        highWaterMark: number
    ): ExitResult | null {
        // Only activate trailing stop if price has moved 15%+ above entry
        const profitFromEntry = (currentPrice - trade.entry_price) / trade.entry_price;
        const hwmProfitFromEntry = (highWaterMark - trade.entry_price) / trade.entry_price;

        if (hwmProfitFromEntry < TRAILING_ACTIVATION_PCT) return null;

        // Determine trailing distance based on conviction level
        const isHighConviction = (trade.max_loss_pct ?? 0.30) >= 0.50;
        const trailingPct = isHighConviction ? TRAILING_PCT_HIGH_CONVICTION : TRAILING_PCT_NORMAL;

        const trailingStopPrice = highWaterMark * (1 - trailingPct);

        if (currentPrice < trailingStopPrice) {
            const lockedProfitPct = ((currentPrice - trade.entry_price) / trade.entry_price * 100).toFixed(1);
            return {
                reason: 'TRAILING_STOP',
                message: `Price $${currentPrice.toFixed(3)} dropped below trailing stop $${trailingStopPrice.toFixed(3)} (HWM: $${highWaterMark.toFixed(3)}, locked +${lockedProfitPct}%)`
            };
        }
        return null;
    }

    private static checkTimeExit(trade: TradeRecord): ExitResult | null {
        const endDate = trade.market_end_date;
        if (!endDate) return null;

        const endMs = new Date(endDate).getTime();
        if (Number.isNaN(endMs)) return null;

        const hoursUntilEnd = (endMs - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilEnd <= TIME_EXIT_HOURS && hoursUntilEnd > 0) {
            return {
                reason: 'TIME_EXIT',
                message: `Market resolves in ${hoursUntilEnd.toFixed(1)}h (< ${TIME_EXIT_HOURS}h threshold). Exiting to avoid settlement risk.`
            };
        }
        return null;
    }

    private static checkStaleSignal(trade: TradeRecord): ExitResult | null {
        const entryTime = new Date(trade.timestamp).getTime();
        if (Number.isNaN(entryTime)) return null;

        const daysSinceEntry = (Date.now() - entryTime) / (1000 * 60 * 60 * 24);
        const effectiveConfidence = trade.signal_confidence * Math.max(
            0.30,
            1 - daysSinceEntry / CONFIDENCE_HALF_LIFE_DAYS
        );

        if (effectiveConfidence < STALE_CONFIDENCE_THRESHOLD) {
            return {
                reason: 'STALE_SIGNAL',
                message: `Signal decayed: original confidence ${trade.signal_confidence.toFixed(2)} → effective ${effectiveConfidence.toFixed(2)} after ${daysSinceEntry.toFixed(1)} days`
            };
        }
        return null;
    }

    // ─── Utility ────────────────────────────────────────────────

    /** Calculate take-profit price based on the adaptive max-loss tier. */
    public static calculateTakeProfitPrice(entryPrice: number, maxLossPct: number): number {
        // Higher risk tolerance → higher profit target
        let takeProfitMultiplier: number;
        if (maxLossPct <= 0.25) {
            takeProfitMultiplier = 1.30;    // Conservative: target +30%
        } else if (maxLossPct >= 0.50) {
            takeProfitMultiplier = 1.60;    // High conviction: target +60%
        } else {
            takeProfitMultiplier = 1.40;    // Normal: target +40%
        }

        return Math.min(entryPrice * takeProfitMultiplier, 0.999);
    }

    /** Get the effective confidence for a trade (with time decay applied). */
    public static getEffectiveConfidence(trade: TradeRecord): number {
        const entryTime = new Date(trade.timestamp).getTime();
        if (Number.isNaN(entryTime)) return trade.signal_confidence;

        const daysSinceEntry = (Date.now() - entryTime) / (1000 * 60 * 60 * 24);
        return trade.signal_confidence * Math.max(
            0.30,
            1 - daysSinceEntry / CONFIDENCE_HALF_LIFE_DAYS
        );
    }
}
