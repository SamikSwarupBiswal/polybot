import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { PricedMarket } from '../research/OrderbookAnalyzer.js';

export interface PricePoint {
    midpoint: number;
    bestBid: number;
    bestAsk: number;
    spread: number;
    timestamp: number;   // Unix ms
}

export interface MarketHistory {
    conditionId: string;
    question: string;
    tokenId: string;     // YES token
    points: PricePoint[];
}

interface PriceHistoryData {
    markets: Record<string, MarketHistory>;
    lastSaved: number;
}

const MAX_POINTS_PER_MARKET = 2880;    // ~30 days at 15-min intervals
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class PriceHistoryStore {
    private readonly filePath: string;
    private data: PriceHistoryData;

    constructor(filePath?: string) {
        this.filePath = filePath || path.resolve(process.cwd(), 'price_history.json');
        this.data = this.load();
    }

    // ─── Recording ──────────────────────────────────────────────

    /** Record snapshots from a batch of priced markets (called after OrderbookAnalyzer). */
    public record(pricedMarkets: PricedMarket[]) {
        const now = Date.now();
        let recorded = 0;

        for (const pm of pricedMarkets) {
            const yesSnap = pm.snapshots.find(s => s.outcome.toUpperCase() === 'YES') || pm.snapshots[0];
            if (!yesSnap) continue;

            const id = pm.market.conditionId;
            if (!this.data.markets[id]) {
                this.data.markets[id] = {
                    conditionId: id,
                    question: pm.market.question,
                    tokenId: yesSnap.tokenId,
                    points: []
                };
            }

            const history = this.data.markets[id];
            history.points.push({
                midpoint: yesSnap.midpoint,
                bestBid: yesSnap.bestBid,
                bestAsk: yesSnap.bestAsk,
                spread: yesSnap.spread,
                timestamp: now
            });

            // Enforce retention cap
            if (history.points.length > MAX_POINTS_PER_MARKET) {
                history.points = history.points.slice(-MAX_POINTS_PER_MARKET);
            }

            recorded++;
        }

        this.prune();
        this.save();
        logger.debug(`[PriceHistory] Recorded snapshots for ${recorded} markets. Total tracked: ${Object.keys(this.data.markets).length}.`);
    }

    // ─── Derived Metrics ────────────────────────────────────────

    /** Price momentum over a given window. Positive = price rising. */
    public getMomentum(conditionId: string, hours: number): number | null {
        const points = this.getRecentPoints(conditionId, hours);
        if (points.length < 2) return null;

        const oldest = points[0].midpoint;
        const latest = points[points.length - 1].midpoint;
        return oldest > 0 ? (latest - oldest) / oldest : 0;
    }

    /** Standard deviation of midpoint prices over a window. Higher = noisier market. */
    public getVolatility(conditionId: string, hours: number): number | null {
        const points = this.getRecentPoints(conditionId, hours);
        if (points.length < 3) return null;

        const midpoints = points.map(p => p.midpoint);
        const mean = midpoints.reduce((s, v) => s + v, 0) / midpoints.length;
        const variance = midpoints.reduce((s, v) => s + (v - mean) ** 2, 0) / midpoints.length;
        return Math.sqrt(variance);
    }

    /** Spread trend: positive = spreads widening (liquidity drying up). */
    public getSpreadTrend(conditionId: string, hours: number): number | null {
        const points = this.getRecentPoints(conditionId, hours);
        if (points.length < 4) return null;

        const half = Math.floor(points.length / 2);
        const olderSpreads = points.slice(0, half).map(p => p.spread);
        const recentSpreads = points.slice(half).map(p => p.spread);

        const avgOlder = olderSpreads.reduce((s, v) => s + v, 0) / olderSpreads.length;
        const avgRecent = recentSpreads.reduce((s, v) => s + v, 0) / recentSpreads.length;
        return avgRecent - avgOlder;
    }

    /** Linear regression slope of midpoint over all available points. */
    public getPriceTrend(conditionId: string): { slope: number; r2: number } | null {
        const history = this.data.markets[conditionId];
        if (!history || history.points.length < 5) return null;

        const points = history.points;
        const n = points.length;
        const t0 = points[0].timestamp;

        // Normalize timestamps to hours for readable slope
        const xs = points.map(p => (p.timestamp - t0) / (1000 * 60 * 60));
        const ys = points.map(p => p.midpoint);

        const sumX = xs.reduce((s, v) => s + v, 0);
        const sumY = ys.reduce((s, v) => s + v, 0);
        const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0);
        const sumX2 = xs.reduce((s, v) => s + v * v, 0);
        const sumY2 = ys.reduce((s, v) => s + v * v, 0);

        const denom = n * sumX2 - sumX ** 2;
        if (denom === 0) return { slope: 0, r2: 0 };

        const slope = (n * sumXY - sumX * sumY) / denom;

        // R² for goodness of fit
        const ssRes = ys.reduce((s, y, i) => {
            const predicted = (sumY / n) + slope * (xs[i] - sumX / n);
            return s + (y - predicted) ** 2;
        }, 0);
        const ssTot = ys.reduce((s, y) => s + (y - sumY / n) ** 2, 0);
        const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

        return { slope, r2 };
    }

    /** Highest midpoint seen for a market since a given timestamp. Used for trailing stops. */
    public getHighWaterMark(conditionId: string, sinceTimestamp: number): number | null {
        const history = this.data.markets[conditionId];
        if (!history || history.points.length === 0) return null;

        const relevantPoints = history.points.filter(p => p.timestamp >= sinceTimestamp);
        if (relevantPoints.length === 0) return null;

        return Math.max(...relevantPoints.map(p => p.midpoint));
    }

    /** Check if we have any history for a market. */
    public hasHistory(conditionId: string): boolean {
        const h = this.data.markets[conditionId];
        return !!h && h.points.length > 0;
    }

    /** Get the latest recorded midpoint for a market. */
    public getLatestMidpoint(conditionId: string): number | null {
        const history = this.data.markets[conditionId];
        if (!history || history.points.length === 0) return null;
        return history.points[history.points.length - 1].midpoint;
    }

    /** Get total number of tracked markets. */
    public getTrackedMarketCount(): number {
        return Object.keys(this.data.markets).length;
    }

    // ─── Internals ──────────────────────────────────────────────

    private getRecentPoints(conditionId: string, hours: number): PricePoint[] {
        const history = this.data.markets[conditionId];
        if (!history) return [];

        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        return history.points.filter(p => p.timestamp >= cutoff);
    }

    /** Remove markets with no data points or all data older than MAX_AGE_MS. */
    private prune() {
        const cutoff = Date.now() - MAX_AGE_MS;
        for (const [id, history] of Object.entries(this.data.markets)) {
            history.points = history.points.filter(p => p.timestamp >= cutoff);
            if (history.points.length === 0) {
                delete this.data.markets[id];
            }
        }
    }

    private load(): PriceHistoryData {
        if (fs.existsSync(this.filePath)) {
            try {
                const raw = fs.readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.markets === 'object') {
                    return parsed;
                }
            } catch (err: any) {
                logger.warn(`[PriceHistory] Failed to parse ${this.filePath}: ${err.message}. Starting fresh.`);
            }
        }
        return { markets: {}, lastSaved: Date.now() };
    }

    private save() {
        this.data.lastSaved = Date.now();
        fs.writeFileSync(this.filePath, JSON.stringify(this.data), 'utf8');
    }
}
