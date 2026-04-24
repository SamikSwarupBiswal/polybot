import { logger } from '../utils/logger.js';
import { PriceHistoryStore } from '../data/PriceHistoryStore.js';
import { PricedMarket } from '../research/OrderbookAnalyzer.js';
import { TradeCategory } from '../execution/FeeSimulator.js';

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
}

// ─── Configuration ──────────────────────────────────────────────────

/** Signal weights for combining into model probability adjustment */
const SIGNAL_WEIGHTS = {
    momentum1h: 0.15,
    momentum24h: 0.25,
    trendSlope: 0.25,
    volatilityAdj: 0.10,
    spreadEdge: 0.10,
    priceDisplacement: 0.15,
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

    constructor(priceHistory: PriceHistoryStore) {
        this.priceHistory = priceHistory;
    }

    /**
     * Estimate the edge (mispricing) for a scored market.
     *
     * The model doesn't claim to know the "true" probability.
     * Instead, it detects momentum, trend, and structural signals
     * that suggest the market price will MOVE in a particular direction.
     * That expected movement IS the edge.
     */
    public estimate(pm: PricedMarket): EdgeEstimate {
        const conditionId = pm.market.conditionId;
        const marketPrice = pm.yesMidpoint;
        const hasHistory = this.priceHistory.hasHistory(conditionId);

        // ─── Compute individual signals ─────────────────────────

        // 1. Short-term momentum (1h)
        const momentum1hRaw = hasHistory ? this.priceHistory.getMomentum(conditionId, 1) : null;
        const momentum1h = momentum1hRaw !== null ? this.clampSignal(momentum1hRaw * 5) : null;
        // Scaled: a 2% move in 1h → signal of 0.10. 20% move → capped at 1.0

        // 2. Medium-term momentum (24h)
        const momentum24hRaw = hasHistory ? this.priceHistory.getMomentum(conditionId, 24) : null;
        const momentum24h = momentum24hRaw !== null ? this.clampSignal(momentum24hRaw * 3) : null;
        // Scaled: a 5% move in 24h → signal of 0.15. 33%+ → capped at 1.0

        // 3. Trend slope + reliability
        const trend = hasHistory ? this.priceHistory.getPriceTrend(conditionId) : null;
        let trendSlope: number | null = null;
        let trendR2: number | null = null;
        if (trend) {
            // slope is in probability units per hour. A move of 0.01/hour is significant.
            trendSlope = this.clampSignal(trend.slope * 50); // 0.02/hr → signal of 1.0
            trendR2 = trend.r2;
        }

        // 4. Volatility score (lower = more predictable = easier to trade)
        const volatilityRaw = hasHistory ? this.priceHistory.getVolatility(conditionId, 24) : null;
        let volatilityScore: number | null = null;
        if (volatilityRaw !== null) {
            // Invert: low volatility = high score
            volatilityScore = Math.max(0, 1 - volatilityRaw * 10);
            // volatility of 0.05 → score 0.5, volatility of 0.10+ → score 0.0
        }

        // 5. Spread edge (tighter spread = cheaper to exploit inefficiencies)
        const spreadEdge = Math.max(0, 1 - pm.bestSpread / 0.06);

        // 6. Price displacement from category base rate
        const baseRate = CATEGORY_BASE_RATES[pm.market.category] ?? 0.45;
        const priceDisplacement = this.clampSignal((baseRate - marketPrice) * 2);
        // If market is at 0.30 but base rate is 0.45 → positive signal for YES (0.30)
        // This is a weak signal but provides uninformed prior

        // 7. Volume confirmation
        let volumeConfirmation = 0.5; // neutral
        if (pm.market.volume >= 500000) volumeConfirmation = 0.9;
        else if (pm.market.volume >= 250000) volumeConfirmation = 0.7;
        else if (pm.market.volume >= 100000) volumeConfirmation = 0.5;
        else volumeConfirmation = 0.3;

        const breakdown: EdgeSignalBreakdown = {
            momentum1h,
            momentum24h,
            trendSlope,
            trendR2,
            volatilityScore,
            spreadEdge,
            priceDisplacement,
            volumeConfirmation
        };

        // ─── Combine signals into directional adjustment ────────

        let totalWeight = 0;
        let weightedSum = 0;
        let signalCount = 0;

        // Momentum 1h
        if (momentum1h !== null) {
            weightedSum += momentum1h * SIGNAL_WEIGHTS.momentum1h;
            totalWeight += SIGNAL_WEIGHTS.momentum1h;
            signalCount++;
        }

        // Momentum 24h
        if (momentum24h !== null) {
            weightedSum += momentum24h * SIGNAL_WEIGHTS.momentum24h;
            totalWeight += SIGNAL_WEIGHTS.momentum24h;
            signalCount++;
        }

        // Trend (weight by R² reliability)
        if (trendSlope !== null && trendR2 !== null) {
            const reliableSlope = trendSlope * Math.max(trendR2, 0.1);
            weightedSum += reliableSlope * SIGNAL_WEIGHTS.trendSlope;
            totalWeight += SIGNAL_WEIGHTS.trendSlope;
            signalCount++;
        }

        // Volatility adjustment (reduces edge magnitude in noisy markets)
        if (volatilityScore !== null) {
            // Doesn't contribute direction, but scales confidence
            totalWeight += SIGNAL_WEIGHTS.volatilityAdj;
            signalCount++;
        }

        // Spread edge (always available)
        weightedSum += (spreadEdge - 0.5) * 0.1 * SIGNAL_WEIGHTS.spreadEdge;
        totalWeight += SIGNAL_WEIGHTS.spreadEdge;
        signalCount++;

        // Price displacement from base rate
        weightedSum += priceDisplacement * SIGNAL_WEIGHTS.priceDisplacement;
        totalWeight += SIGNAL_WEIGHTS.priceDisplacement;
        signalCount++;

        // ─── Compute model probability ──────────────────────────

        // The adjustment is how much we think the market will move.
        // Positive = expect YES price to rise, Negative = expect NO price to rise.
        const adjustment = totalWeight > 0 ? weightedSum / totalWeight : 0;

        // Model probability = market price + expected directional move
        // Clamped to [0.05, 0.95] to avoid extreme overconfidence
        const modelProbability = Math.min(0.95, Math.max(0.05, marketPrice + adjustment));

        // ─── Edge calculation ───────────────────────────────────

        const rawEdge = Math.abs(modelProbability - marketPrice);
        const netEdge = rawEdge - ASSUMED_TRADING_COST;
        const hasEdge = netEdge > MIN_NET_EDGE && signalCount >= 2;

        // Direction: if model thinks YES is worth more → buy YES, otherwise buy NO
        const direction: 'YES' | 'NO' = modelProbability > marketPrice ? 'YES' : 'NO';

        // Confidence: based on edge magnitude, signal count, and volatility
        const edgeConfidence = Math.min(0.95, 0.50 + netEdge * 3);
        const signalConfidence = Math.min(1.0, signalCount / 5);
        const volModifier = volatilityScore !== null ? 0.5 + volatilityScore * 0.5 : 0.7;
        const confidence = Math.min(0.95, Math.max(0.55, edgeConfidence * signalConfidence * volModifier));

        return {
            modelProbability,
            marketPrice,
            rawEdge,
            netEdge,
            direction,
            confidence: hasEdge ? confidence : 0,
            signalCount,
            breakdown,
            hasEdge
        };
    }

    /**
     * Batch-estimate edges for multiple markets.
     * Returns only markets with detected edge, sorted by net edge descending.
     */
    public estimateBatch(markets: PricedMarket[]): Array<{ market: PricedMarket; edge: EdgeEstimate }> {
        const results: Array<{ market: PricedMarket; edge: EdgeEstimate }> = [];

        for (const pm of markets) {
            const edge = this.estimate(pm);
            if (edge.hasEdge) {
                results.push({ market: pm, edge });
            }
        }

        results.sort((a, b) => b.edge.netEdge - a.edge.netEdge);

        if (results.length > 0) {
            logger.info(
                `[EdgeEstimator] Found ${results.length} markets with edge. ` +
                `Best: "${results[0].market.market.question.substring(0, 50)}" ` +
                `(edge: ${(results[0].edge.netEdge * 100).toFixed(1)}% ${results[0].edge.direction}, ` +
                `confidence: ${results[0].edge.confidence.toFixed(2)})`
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
