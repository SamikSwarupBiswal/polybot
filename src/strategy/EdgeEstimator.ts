import { logger } from '../utils/logger.js';
import { PriceHistoryStore } from '../data/PriceHistoryStore.js';
import { PricedMarket } from '../research/OrderbookAnalyzer.js';
import { TradeCategory } from '../execution/FeeSimulator.js';
import { MarketRegimeDetector, RegimeAnalysis } from './MarketRegimeDetector.js';
import { CalibrationTracker } from '../analytics/CalibrationTracker.js';
import { OrderFlowSignal } from '../research/OrderFlowAnalyzer.js';

// ─── Types ──────────────────────────────────────────────────────────

export interface EdgeSignalBreakdown {
    momentum1h: number | null;      // -1 to +1 (positive = bullish for YES)
    momentum24h: number | null;     // -1 to +1
    trendSlope: number | null;      // regression slope (prob/hour change)
    trendR2: number | null;         // how reliable the trend is
    volatilityScore: number | null; // 0-1 (lower volatility = more predictable)
    spreadEdge: number;             // 0-1 (tighter spread = cheaper to trade)
    priceDisplacement: number;      // how far price is from category base rate
    volumeConfirmation: number;     // 0-1 (higher = volume supports the signal)
    orderFlowDirection: number | null;  // -1 to +1 from Order Flow Analyzer
    orderFlowWhaleActivity: number | null; // 0-1 whale trade concentration
    regime: string;                 // Market regime classification
    regimeConfidenceMultiplier: number; // Regime-based adjustment
    calibrationScaling: number;     // Calibration feedback adjustment
}

export interface EdgeEstimate {
    /** Model's estimated probability of YES (0-1) */
    modelProbability: number;
    /** Market's current YES midpoint */
    marketPrice: number;
    /** Raw edge = |modelProb - marketPrice| */
    rawEdge: number;
    /** Net edge = rawEdge - tradingCosts */
    netEdge: number;
    /** Recommended direction */
    direction: 'YES' | 'NO';
    /** Confidence in the edge estimate (0-1). Drives position sizing. */
    confidence: number;
    /** Number of active signals contributing to the estimate */
    signalCount: number;
    /** Full breakdown for debugging and calibration */
    breakdown: EdgeSignalBreakdown;
    /** Was there enough data to make a meaningful estimate? */
    hasEdge: boolean;
    /** Regime analysis for this market */
    regime: RegimeAnalysis;
}

// ─── Configuration ──────────────────────────────────────────────────

/** Signal weights for combining into model probability adjustment */
const SIGNAL_WEIGHTS = {
    momentum1h: 0.12,
    momentum24h: 0.20,
    trendSlope: 0.20,
    volatilityAdj: 0.08,
    spreadEdge: 0.08,
    priceDisplacement: 0.10,
    orderFlow: 0.12,           // NEW: order flow imbalance
    whaleFlow: 0.10,           // NEW: whale activity signal
} as const;

/** Minimum net edge required to emit a signal (covers spread + slippage) */
const MIN_NET_EDGE = 0.03;   // 3%

/** Category base rates — prior probability of YES resolving */
const CATEGORY_BASE_RATES: Record<string, number> = {
    [TradeCategory.POLITICS]:    0.45,
    [TradeCategory.GEOPOLITICS]: 0.40,
    [TradeCategory.TECHNOLOGY]:  0.35,
    [TradeCategory.FINANCE]:     0.42,
    [TradeCategory.CRYPTO]:      0.38,
    [TradeCategory.SPORTS]:      0.48,
    [TradeCategory.OTHER]:       0.45,
};

/** Assumed trading cost per round-trip (spread + slippage + fee) */
const ASSUMED_TRADING_COST = 0.015;

// ─── EdgeEstimator ──────────────────────────────────────────────────

export class EdgeEstimator {
    private readonly priceHistory: PriceHistoryStore;
    private readonly regimeDetector: MarketRegimeDetector;
    private readonly calibration: CalibrationTracker | null;

    constructor(
        priceHistory: PriceHistoryStore,
        calibration?: CalibrationTracker
    ) {
        this.priceHistory = priceHistory;
        this.regimeDetector = new MarketRegimeDetector(priceHistory);
        this.calibration = calibration ?? null;
    }

    /**
     * Estimate the edge (mispricing) for a scored market.
     *
     * The model doesn't claim to know the "true" probability.
     * Instead, it combines momentum, trend, order flow, regime, and structural
     * signals to detect likely price movements. That expected movement IS the edge.
     *
     * NEW in Tier 3:
     * - Order flow imbalance feeds directional signals
     * - Market regime adjusts confidence (avoid DEAD/HIGH_VOL, boost TRENDING)
     * - Calibration feedback scales confidence based on historical accuracy
     */
    public estimate(
        pm: PricedMarket,
        orderFlow?: OrderFlowSignal
    ): EdgeEstimate {
        const conditionId = pm.market.conditionId;
        const marketPrice = pm.yesMidpoint;
        const hasHistory = this.priceHistory.hasHistory(conditionId);

        // ─── Market Regime Detection ────────────────────────────
        const regime = this.regimeDetector.classify(conditionId);

        // ─── Calibration feedback ───────────────────────────────
        const calibrationScaling = this.calibration?.getConfidenceScalingFactor() ?? 1.0;
        const categoryCorrection = this.calibration?.getCategoryCorrection(pm.market.category) ?? 1.0;

        // ─── Compute individual signals ─────────────────────────

        // 1. Short-term momentum (1h)
        const momentum1hRaw = hasHistory ? this.priceHistory.getMomentum(conditionId, 1) : null;
        const momentum1h = momentum1hRaw !== null ? this.clampSignal(momentum1hRaw * 5) : null;

        // 2. Medium-term momentum (24h)
        const momentum24hRaw = hasHistory ? this.priceHistory.getMomentum(conditionId, 24) : null;
        const momentum24h = momentum24hRaw !== null ? this.clampSignal(momentum24hRaw * 3) : null;

        // 3. Trend slope + reliability
        const trend = hasHistory ? this.priceHistory.getPriceTrend(conditionId) : null;
        let trendSlope: number | null = null;
        let trendR2: number | null = null;
        if (trend) {
            trendSlope = this.clampSignal(trend.slope * 50);
            trendR2 = trend.r2;
        }

        // 4. Volatility score
        const volatilityRaw = hasHistory ? this.priceHistory.getVolatility(conditionId, 24) : null;
        let volatilityScore: number | null = null;
        if (volatilityRaw !== null) {
            volatilityScore = Math.max(0, 1 - volatilityRaw * 10);
        }

        // 5. Spread edge
        const spreadEdge = Math.max(0, 1 - pm.bestSpread / 0.06);

        // 6. Price displacement from category base rate (with calibration correction)
        const rawBaseRate = CATEGORY_BASE_RATES[pm.market.category] ?? 0.45;
        const correctedBaseRate = Math.min(0.95, Math.max(0.05, rawBaseRate * categoryCorrection));
        const priceDisplacement = this.clampSignal((correctedBaseRate - marketPrice) * 2);

        // 7. Volume confirmation
        let volumeConfirmation = 0.5;
        if (pm.market.volume >= 500000) volumeConfirmation = 0.9;
        else if (pm.market.volume >= 250000) volumeConfirmation = 0.7;
        else if (pm.market.volume >= 100000) volumeConfirmation = 0.5;
        else volumeConfirmation = 0.3;

        // 8. Order flow signals (NEW)
        const orderFlowDirection = orderFlow?.hasData
            ? this.clampSignal(orderFlow.directionSignal)
            : null;
        const orderFlowWhaleActivity = orderFlow?.hasData
            ? orderFlow.whaleActivity
            : null;

        const breakdown: EdgeSignalBreakdown = {
            momentum1h,
            momentum24h,
            trendSlope,
            trendR2,
            volatilityScore,
            spreadEdge,
            priceDisplacement,
            volumeConfirmation,
            orderFlowDirection,
            orderFlowWhaleActivity,
            regime: regime.regime,
            regimeConfidenceMultiplier: regime.confidenceMultiplier,
            calibrationScaling
        };

        // ─── Combine signals into directional adjustment ────────

        let totalWeight = 0;
        let weightedSum = 0;
        let signalCount = 0;

        // Momentum 1h
        if (momentum1h !== null) {
            // In mean-reverting regime, flip momentum signal
            const adjustedMomentum = regime.strategyHint === 'CONTRARIAN' ? -momentum1h : momentum1h;
            weightedSum += adjustedMomentum * SIGNAL_WEIGHTS.momentum1h;
            totalWeight += SIGNAL_WEIGHTS.momentum1h;
            signalCount++;
        }

        // Momentum 24h
        if (momentum24h !== null) {
            const adjustedMomentum = regime.strategyHint === 'CONTRARIAN' ? -momentum24h : momentum24h;
            weightedSum += adjustedMomentum * SIGNAL_WEIGHTS.momentum24h;
            totalWeight += SIGNAL_WEIGHTS.momentum24h;
            signalCount++;
        }

        // Trend (weight by R² reliability)
        if (trendSlope !== null && trendR2 !== null) {
            const reliableSlope = trendSlope * Math.max(trendR2, 0.1);
            const adjustedSlope = regime.strategyHint === 'CONTRARIAN' ? -reliableSlope : reliableSlope;
            weightedSum += adjustedSlope * SIGNAL_WEIGHTS.trendSlope;
            totalWeight += SIGNAL_WEIGHTS.trendSlope;
            signalCount++;
        }

        // Volatility adjustment
        if (volatilityScore !== null) {
            totalWeight += SIGNAL_WEIGHTS.volatilityAdj;
            signalCount++;
        }

        // Spread edge
        weightedSum += (spreadEdge - 0.5) * 0.1 * SIGNAL_WEIGHTS.spreadEdge;
        totalWeight += SIGNAL_WEIGHTS.spreadEdge;
        signalCount++;

        // Price displacement from base rate
        weightedSum += priceDisplacement * SIGNAL_WEIGHTS.priceDisplacement;
        totalWeight += SIGNAL_WEIGHTS.priceDisplacement;
        signalCount++;

        // Order flow direction (NEW)
        if (orderFlowDirection !== null) {
            weightedSum += orderFlowDirection * 0.3 * SIGNAL_WEIGHTS.orderFlow;
            totalWeight += SIGNAL_WEIGHTS.orderFlow;
            signalCount++;
        }

        // Whale activity — amplifies the order flow direction (NEW)
        if (orderFlowWhaleActivity !== null && orderFlowDirection !== null) {
            // Whale buying = strong positive signal
            const whaleSignal = orderFlowDirection * orderFlowWhaleActivity;
            weightedSum += whaleSignal * 0.3 * SIGNAL_WEIGHTS.whaleFlow;
            totalWeight += SIGNAL_WEIGHTS.whaleFlow;
            signalCount++;
        }

        // ─── Compute model probability ──────────────────────────

        const adjustment = totalWeight > 0 ? weightedSum / totalWeight : 0;
        const modelProbability = Math.min(0.95, Math.max(0.05, marketPrice + adjustment));

        // ─── Edge calculation ───────────────────────────────────

        const rawEdge = Math.abs(modelProbability - marketPrice);
        const netEdge = rawEdge - ASSUMED_TRADING_COST;

        // Regime gate: AVOID regime markets need higher edge
        const effectiveMinEdge = regime.strategyHint === 'AVOID'
            ? MIN_NET_EDGE * 2   // 6% edge needed to trade volatile/dead markets
            : MIN_NET_EDGE;      // 3% edge normally

        const hasEdge = netEdge > effectiveMinEdge && signalCount >= 2;

        // Direction
        const direction: 'YES' | 'NO' = modelProbability > marketPrice ? 'YES' : 'NO';

        // Confidence: edge magnitude × signal quality × volatility × regime × calibration
        const edgeConfidence = Math.min(0.95, 0.50 + netEdge * 3);
        const signalConfidence = Math.min(1.0, signalCount / 7);   // More signals = 7 now
        const volModifier = volatilityScore !== null ? 0.5 + volatilityScore * 0.5 : 0.7;
        const regimeModifier = regime.confidenceMultiplier;
        const calibrationModifier = calibrationScaling;

        const confidence = Math.min(
            0.95,
            Math.max(0.50, edgeConfidence * signalConfidence * volModifier * regimeModifier * calibrationModifier)
        );

        return {
            modelProbability,
            marketPrice,
            rawEdge,
            netEdge,
            direction,
            confidence: hasEdge ? confidence : 0,
            signalCount,
            breakdown,
            hasEdge,
            regime
        };
    }

    /**
     * Batch-estimate edges for multiple markets.
     * Returns only markets with detected edge, sorted by net edge descending.
     */
    public estimateBatch(
        markets: PricedMarket[],
        orderFlows?: Map<string, OrderFlowSignal>
    ): Array<{ market: PricedMarket; edge: EdgeEstimate }> {
        const results: Array<{ market: PricedMarket; edge: EdgeEstimate }> = [];

        for (const pm of markets) {
            const flow = orderFlows?.get(pm.market.conditionId);
            const edge = this.estimate(pm, flow);
            if (edge.hasEdge) {
                results.push({ market: pm, edge });
            }
        }

        results.sort((a, b) => b.edge.netEdge - a.edge.netEdge);

        if (results.length > 0) {
            const best = results[0];
            logger.info(
                `[EdgeEstimator] Found ${results.length} markets with edge. ` +
                `Best: "${best.market.market.question.substring(0, 45)}" ` +
                `(edge: ${(best.edge.netEdge * 100).toFixed(1)}% ${best.edge.direction}, ` +
                `regime: ${best.edge.regime.regime}, ` +
                `conf: ${best.edge.confidence.toFixed(2)})`
            );
        } else {
            logger.info(`[EdgeEstimator] No markets with sufficient edge detected this cycle.`);
        }

        return results;
    }

    /** Clamp a signal value to [-1, +1] range. */
    private clampSignal(value: number): number {
        return Math.min(1, Math.max(-1, value));
    }
}
