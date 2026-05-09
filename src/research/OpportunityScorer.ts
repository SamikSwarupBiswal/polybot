import { logger } from '../utils/logger.js';
import { TradeCategory } from '../execution/FeeSimulator.js';
import { PricedMarket } from './OrderbookAnalyzer.js';

export interface ScoreBreakdown {
    liquidity: number;      // 0-1
    timeSafety: number;     // 0-1
    categoryPref: number;   // 0-1
    spreadQuality: number;  // 0-1
    volumeActivity: number; // 0-1 (placeholder until 24h volume available)
    priceRange: number;     // 0-1
}

export interface ScoredMarket {
    market: PricedMarket;
    score: number;          // 0-1 composite
    breakdown: ScoreBreakdown;
    /** Which side (YES/NO) and at what price the scorer recommends */
    recommendedSide: 'YES' | 'NO';
    recommendedPrice: number;
    recommendedTokenId: string;
}

/** Weights for each scoring factor. Must sum to 1.0 */
const WEIGHTS = {
    liquidity: 0.25,
    timeSafety: 0.15,
    categoryPref: 0.10,
    spreadQuality: 0.20,
    volumeActivity: 0.15,
    priceRange: 0.15
} as const;

/** Category preference scores (higher is better for paper-trading) */
const CATEGORY_SCORES: Record<string, number> = {
    [TradeCategory.GEOPOLITICS]: 1.0,   // 0% taker fee
    [TradeCategory.POLITICS]:    0.9,   // High news density
    [TradeCategory.TECHNOLOGY]:  0.7,
    [TradeCategory.FINANCE]:     0.6,
    [TradeCategory.CRYPTO]:      0.4,   // Noisy + 1.8% taker fee
    [TradeCategory.SPORTS]:      0.5,
    [TradeCategory.OTHER]:       0.3
};

export class OpportunityScorer {
    private readonly topN: number;

    constructor(opts?: { topN?: number }) {
        this.topN = opts?.topN ?? 20;
    }

    /**
     * Scores, ranks, and returns the top N opportunities from priced markets.
     */
    public rank(pricedMarkets: PricedMarket[]): ScoredMarket[] {
        if (pricedMarkets.length === 0) return [];

        // Pre-compute volume percentile ranks
        const volumes = pricedMarkets.map(m => m.market.volume).sort((a, b) => a - b);

        const scored: ScoredMarket[] = pricedMarkets.map(pm => {
            const breakdown = this.scoreMarket(pm, volumes);
            const score =
                breakdown.liquidity      * WEIGHTS.liquidity +
                breakdown.timeSafety     * WEIGHTS.timeSafety +
                breakdown.categoryPref   * WEIGHTS.categoryPref +
                breakdown.spreadQuality  * WEIGHTS.spreadQuality +
                breakdown.volumeActivity * WEIGHTS.volumeActivity +
                breakdown.priceRange     * WEIGHTS.priceRange;

            // Determine recommended side using actual price advantage, not a symmetric
            // comparison that always resolves to YES.
            const yesPrice = pm.yesMidpoint;
            const noPrice = 1 - yesPrice;
            const yesToken = pm.snapshots.find(s => s.outcome.toUpperCase() === 'YES');
            const noToken = pm.snapshots.find(s => s.outcome.toUpperCase() === 'NO');

            let recommendedSide: 'YES' | 'NO';
            let recommendedPrice: number;
            let recommendedTokenId: string;

            // Score each side: lower price = more upside potential, tighter spread = better execution
            const yesAsk = yesToken && yesToken.bestAsk > 0 ? yesToken.bestAsk : yesPrice;
            const noAsk = noToken && noToken.bestAsk > 0 ? noToken.bestAsk : noPrice;
            // Upside potential: buying at 0.30 has more upside (pays $1 if correct) than at 0.70
            const yesUpside = (1 - yesAsk) / Math.max(yesAsk, 0.01);
            const noUpside = (1 - noAsk) / Math.max(noAsk, 0.01);

            if (noUpside > yesUpside && noToken) {
                recommendedSide = 'NO';
                recommendedPrice = noAsk;
                recommendedTokenId = noToken.tokenId;
            } else if (yesToken) {
                recommendedSide = 'YES';
                recommendedPrice = yesAsk;
                recommendedTokenId = yesToken.tokenId;
            } else if (noToken) {
                recommendedSide = 'NO';
                recommendedPrice = noAsk;
                recommendedTokenId = noToken.tokenId;
            } else {
                // True last resort — use whatever snapshot exists
                recommendedSide = yesPrice <= 0.50 ? 'YES' : 'NO';
                recommendedPrice = yesPrice <= 0.50 ? yesPrice : noPrice;
                recommendedTokenId = pm.snapshots[0]?.tokenId || '';
            }

            return {
                market: pm,
                score,
                breakdown,
                recommendedSide,
                recommendedPrice: Math.min(Math.max(recommendedPrice, 0.01), 0.99),
                recommendedTokenId
            };
        });

        scored.sort((a, b) => b.score - a.score);

        const top = scored.slice(0, this.topN);
        if (top.length > 0) {
            logger.info(`[OpportunityScorer] Top ${top.length} markets ranked. Best: "${top[0].market.market.question}" (score: ${top[0].score.toFixed(3)})`);
        }

        return top;
    }

    private scoreMarket(pm: PricedMarket, sortedVolumes: number[]): ScoreBreakdown {
        const m = pm.market;

        // --- Liquidity: percentile rank by volume ---
        const volRank = sortedVolumes.indexOf(m.volume);
        const liquidity = sortedVolumes.length > 1
            ? volRank / (sortedVolumes.length - 1)
            : 0.5;

        // --- Time Safety: spread across all timeframes ---
        const hoursToEnd = (new Date(m.endDate).getTime() - Date.now()) / (1000 * 60 * 60);
        const daysToEnd = hoursToEnd / 24;
        let timeSafety: number;
        if (daysToEnd < 0.1) timeSafety = 0.3;        // < ~2.4 hours — risky but allowed
        else if (daysToEnd < 2) timeSafety = 0.6;      // Short-term: viable for quick bets
        else if (daysToEnd < 7) timeSafety = 0.8;      // Near-term: good opportunity window
        else if (daysToEnd <= 90) timeSafety = 1.0;     // Sweet spot
        else if (daysToEnd <= 180) timeSafety = 0.7;
        else timeSafety = 0.4; // Very long-dated

        // --- Category preference ---
        const categoryPref = CATEGORY_SCORES[m.category] ?? 0.3;

        // --- Spread quality: < 2¢ = 1.0, > 6¢ = 0.0 ---
        const spread = pm.bestSpread;
        let spreadQuality: number;
        if (spread <= 0.02) spreadQuality = 1.0;
        else if (spread >= 0.06) spreadQuality = 0.0;
        else spreadQuality = 1.0 - (spread - 0.02) / 0.04;

        // --- Volume activity: relative to the median volume (activity signal) ---
        // This measures how "active" a market is compared to the typical market.
        // Unlike the `liquidity` percentile rank, this captures absolute activity level.
        const medianIdx = Math.floor(sortedVolumes.length / 2);
        const medianVolume = sortedVolumes[medianIdx] || 100000;
        let volumeActivity: number;
        if (medianVolume > 0) {
            // Ratio-based: 2x median = 1.0, 0.5x median = 0.4
            const ratio = m.volume / medianVolume;
            volumeActivity = Math.min(1.0, Math.max(0.2, 0.4 + ratio * 0.3));
        } else {
            volumeActivity = 0.5;
        }

        // --- Price range: extreme prices score lower ---
        const yesPrice = pm.yesMidpoint;
        let priceRange: number;
        if (yesPrice > 0.92 || yesPrice < 0.08) priceRange = 0.1;
        else if (yesPrice > 0.85 || yesPrice < 0.15) priceRange = 0.4;
        else if (yesPrice > 0.75 || yesPrice < 0.25) priceRange = 0.7;
        else priceRange = 1.0; // 0.25-0.75 sweet spot

        return { liquidity, timeSafety, categoryPref, spreadQuality, volumeActivity, priceRange };
    }
}
