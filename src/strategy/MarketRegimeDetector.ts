import { logger } from '../utils/logger.js';
import { PriceHistoryStore } from '../data/PriceHistoryStore.js';

// ─── Types ──────────────────────────────────────────────────────────

export type MarketRegime =
    | 'TRENDING_UP'       // Strong directional upmove, momentum strategies work
    | 'TRENDING_DOWN'     // Strong directional downmove
    | 'MEAN_REVERTING'    // Oscillating around a price, contrarian strategies work
    | 'HIGH_VOLATILITY'   // News-driven chaos, avoid or use wide stops
    | 'DEAD'              // No movement, no volume — skip
    | 'UNKNOWN';          // Not enough data

export interface RegimeAnalysis {
    regime: MarketRegime;
    confidence: number;     // 0-1
    volatility: number;     // raw volatility value
    trendStrength: number;  // |slope * R²| — how strong and reliable the trend is
    meanReversionScore: number; // How much price oscillates around mean
    /** Strategy recommendation based on regime */
    strategyHint: 'MOMENTUM' | 'CONTRARIAN' | 'AVOID' | 'NEUTRAL';
    /** Multiplier for EdgeEstimator confidence (1.0 = no change) */
    confidenceMultiplier: number;
}

// ─── Thresholds ─────────────────────────────────────────────────────

const TREND_THRESHOLD = 0.005;       // Slope * R² above this → trending
const MEAN_REVERSION_THRESHOLD = 3;  // oscillation count above this → mean reverting
const HIGH_VOL_THRESHOLD = 0.08;     // 24h volatility above this → chaotic
const DEAD_VOL_THRESHOLD = 0.005;    // 24h volatility below this → dead
const MIN_POINTS_FOR_REGIME = 4;     // Need at least 4 price points

// ─── MarketRegimeDetector ───────────────────────────────────────────

export class MarketRegimeDetector {
    private readonly priceHistory: PriceHistoryStore;

    constructor(priceHistory: PriceHistoryStore) {
        this.priceHistory = priceHistory;
    }

    /**
     * Classify the current market regime for a given condition.
     * Uses price history to detect:
     * - Trending (strong directional movement with high R²)
     * - Mean-reverting (price oscillates around its mean)
     * - High volatility (news-driven chaos)
     * - Dead (no meaningful price movement)
     */
    public classify(conditionId: string): RegimeAnalysis {
        if (!this.priceHistory.hasHistory(conditionId)) {
            return this.unknownRegime();
        }

        // Get raw metrics
        const volatility = this.priceHistory.getVolatility(conditionId, 24) ?? 0;
        const trend = this.priceHistory.getPriceTrend(conditionId);
        const momentum1h = this.priceHistory.getMomentum(conditionId, 1);
        const momentum24h = this.priceHistory.getMomentum(conditionId, 24);

        const trendStrength = trend
            ? Math.abs(trend.slope) * Math.max(trend.r2, 0)
            : 0;

        // Count mean-reversion oscillations (direction changes in recent history)
        const meanReversionScore = this.countDirectionChanges(conditionId);

        // ─── Classification logic ────────────────────────────────

        let regime: MarketRegime;
        let confidence = 0;
        let strategyHint: 'MOMENTUM' | 'CONTRARIAN' | 'AVOID' | 'NEUTRAL';
        let confidenceMultiplier = 1.0;

        if (volatility < DEAD_VOL_THRESHOLD) {
            // Dead market — no movement
            regime = 'DEAD';
            confidence = 0.90;
            strategyHint = 'AVOID';
            confidenceMultiplier = 0.3;

        } else if (volatility > HIGH_VOL_THRESHOLD) {
            // High volatility — news-driven or event-driven chaos
            regime = 'HIGH_VOLATILITY';
            confidence = Math.min(0.90, 0.50 + (volatility - HIGH_VOL_THRESHOLD) * 5);
            strategyHint = 'AVOID';
            confidenceMultiplier = 0.5; // Reduce position sizes

        } else if (trendStrength > TREND_THRESHOLD && trend) {
            // Strong, reliable trend
            const direction = trend.slope > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN';
            regime = direction;
            confidence = Math.min(0.90, 0.50 + trendStrength * 50);
            strategyHint = 'MOMENTUM';
            confidenceMultiplier = 1.2; // Boost confidence in trend-following

            // But if momentum is contradicting trend, lower confidence
            if (momentum1h !== null && momentum24h !== null) {
                const momentumAligned = (trend.slope > 0 && momentum1h > 0 && momentum24h > 0) ||
                                       (trend.slope < 0 && momentum1h < 0 && momentum24h < 0);
                if (!momentumAligned) {
                    confidenceMultiplier = 0.8;
                    confidence *= 0.7;
                }
            }

        } else if (meanReversionScore > MEAN_REVERSION_THRESHOLD) {
            // Price oscillates — contrarian strategies may work
            regime = 'MEAN_REVERTING';
            confidence = Math.min(0.85, 0.50 + meanReversionScore * 0.05);
            strategyHint = 'CONTRARIAN';
            confidenceMultiplier = 0.9;

        } else {
            // Not enough signal to classify
            regime = 'UNKNOWN';
            confidence = 0.30;
            strategyHint = 'NEUTRAL';
            confidenceMultiplier = 1.0;
        }

        return {
            regime,
            confidence,
            volatility,
            trendStrength,
            meanReversionScore,
            strategyHint,
            confidenceMultiplier
        };
    }

    /**
     * Batch-classify regimes for multiple markets.
     * Returns a map of conditionId → RegimeAnalysis.
     */
    public classifyBatch(conditionIds: string[]): Map<string, RegimeAnalysis> {
        const results = new Map<string, RegimeAnalysis>();

        for (const id of conditionIds) {
            results.set(id, this.classify(id));
        }

        // Log summary
        const regimeCounts: Record<string, number> = {};
        for (const analysis of results.values()) {
            regimeCounts[analysis.regime] = (regimeCounts[analysis.regime] || 0) + 1;
        }
        const summary = Object.entries(regimeCounts)
            .map(([r, c]) => `${r}:${c}`)
            .join(', ');
        logger.debug(`[RegimeDetector] Classified ${conditionIds.length} markets: ${summary}`);

        return results;
    }

    // ─── Internals ──────────────────────────────────────────────

    /**
     * Count direction changes in the last 24h of price data.
     * High count = mean-reverting behavior.
     */
    private countDirectionChanges(conditionId: string): number {
        // We don't have direct access to the raw points array from PriceHistoryStore,
        // so we use momentum at different windows to infer oscillation.
        // If 1h and 4h momentum keep flipping sign, it's mean-reverting.

        const windows = [1, 2, 4, 8, 12, 24];
        const momentums = windows.map(h => this.priceHistory.getMomentum(conditionId, h));

        let changes = 0;
        let lastSign: number | null = null;

        for (const m of momentums) {
            if (m === null) continue;
            const sign = m >= 0 ? 1 : -1;
            if (lastSign !== null && sign !== lastSign) {
                changes++;
            }
            lastSign = sign;
        }

        return changes;
    }

    private unknownRegime(): RegimeAnalysis {
        return {
            regime: 'UNKNOWN',
            confidence: 0,
            volatility: 0,
            trendStrength: 0,
            meanReversionScore: 0,
            strategyHint: 'NEUTRAL',
            confidenceMultiplier: 1.0
        };
    }
}
