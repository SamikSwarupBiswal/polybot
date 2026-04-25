import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { TradeRecord } from '../execution/VirtualWallet.js';
import { TradeCategory } from '../execution/FeeSimulator.js';

// ─── Types ──────────────────────────────────────────────────────────

export interface CalibrationEntry {
    tradeId: string;
    conditionId: string;
    category: string;
    side: 'YES' | 'NO';
    modelProbability: number;      // What EdgeEstimator predicted
    marketPriceAtEntry: number;    // Market price when signal was emitted
    signalConfidence: number;      // Confidence at time of trade
    signalSource: string;
    entryTimestamp: string;
    resolvedAt?: string;
    outcome?: 'WIN' | 'LOSS';     // Did our side resolve correctly?
    actualResult?: number;         // 1 = YES resolved, 0 = NO resolved
}

export interface CalibrationBucket {
    bucketLabel: string;           // e.g. "0.60-0.70"
    predictedProbAvg: number;
    actualWinRate: number;
    count: number;
    brierContribution: number;
}

export interface CalibrationReport {
    totalTrades: number;
    resolvedTrades: number;
    winRate: number;
    brierScore: number;            // Lower is better (0 = perfect, 0.25 = coin flip)
    logLoss: number;               // Lower is better
    calibrationBuckets: CalibrationBucket[];
    categoryPerformance: Record<string, { wins: number; losses: number; brierScore: number }>;
    signalSourcePerformance: Record<string, { wins: number; losses: number; avgEdge: number }>;
    recommendations: string[];
}

// ─── CalibrationTracker ─────────────────────────────────────────────

const BUCKET_SIZE = 0.10;          // 10% probability buckets
const MIN_SAMPLES_FOR_FEEDBACK = 10;

export class CalibrationTracker {
    private readonly filePath: string;
    private entries: CalibrationEntry[];

    constructor(filePath?: string) {
        this.filePath = filePath || path.resolve(process.cwd(), 'calibration.json');
        this.entries = this.load();
    }

    // ─── Recording ──────────────────────────────────────────────

    /**
     * Record a new prediction when a trade is opened.
     * Call this from MarketResearchRunner after emitting a signal.
     */
    public recordPrediction(
        trade: TradeRecord,
        modelProbability: number
    ): void {
        // Avoid duplicates
        if (this.entries.some(e => e.tradeId === trade.trade_id)) return;

        this.entries.push({
            tradeId: trade.trade_id,
            conditionId: trade.market_id,
            category: trade.category,
            side: trade.side,
            modelProbability,
            marketPriceAtEntry: trade.entry_price,
            signalConfidence: trade.signal_confidence,
            signalSource: trade.signal_source,
            entryTimestamp: trade.timestamp,
        });

        this.save();
        logger.debug(`[Calibration] Recorded prediction for ${trade.trade_id.substring(0, 8)}: model=${modelProbability.toFixed(3)}`);
    }

    /**
     * Record the outcome when a trade resolves.
     * Call this from MarketResolutionMonitor after resolving a trade.
     */
    public recordOutcome(tradeId: string, outcome: 'WIN' | 'LOSS', resolvedAt: string): void {
        const entry = this.entries.find(e => e.tradeId === tradeId);
        if (!entry) return;

        entry.outcome = outcome;
        entry.resolvedAt = resolvedAt;
        // For Brier score: if we predicted YES, actual=1 on WIN, actual=0 on LOSS
        // If we predicted NO, actual=0 on WIN (NO resolved correctly), actual=1 on LOSS
        entry.actualResult = outcome === 'WIN' ? 1 : 0;

        this.save();
        logger.debug(`[Calibration] Recorded outcome for ${tradeId.substring(0, 8)}: ${outcome}`);
    }

    // ─── Analysis ───────────────────────────────────────────────

    /** Generate a full calibration report from all resolved trades. */
    public generateReport(): CalibrationReport {
        const resolved = this.entries.filter(e => e.outcome !== undefined);
        const totalTrades = this.entries.length;
        const resolvedTrades = resolved.length;

        // Win rate
        const wins = resolved.filter(e => e.outcome === 'WIN').length;
        const winRate = resolvedTrades > 0 ? wins / resolvedTrades : 0;

        // Brier Score: mean squared error of probability predictions
        let brierSum = 0;
        let logLossSum = 0;
        for (const entry of resolved) {
            const predicted = entry.modelProbability;
            const actual = entry.actualResult ?? 0;
            brierSum += (predicted - actual) ** 2;

            // Log loss (clamp to avoid log(0))
            const clampedPred = Math.min(Math.max(predicted, 0.001), 0.999);
            logLossSum += -(actual * Math.log(clampedPred) + (1 - actual) * Math.log(1 - clampedPred));
        }
        const brierScore = resolvedTrades > 0 ? brierSum / resolvedTrades : 0.25;
        const logLoss = resolvedTrades > 0 ? logLossSum / resolvedTrades : 1.0;

        // Calibration buckets
        const calibrationBuckets = this.buildCalibrationBuckets(resolved);

        // Category performance
        const categoryPerformance: Record<string, { wins: number; losses: number; brierScore: number }> = {};
        for (const entry of resolved) {
            const cat = entry.category || 'other';
            if (!categoryPerformance[cat]) {
                categoryPerformance[cat] = { wins: 0, losses: 0, brierScore: 0 };
            }
            if (entry.outcome === 'WIN') categoryPerformance[cat].wins++;
            else categoryPerformance[cat].losses++;

            const predicted = entry.modelProbability;
            const actual = entry.actualResult ?? 0;
            categoryPerformance[cat].brierScore += (predicted - actual) ** 2;
        }
        // Average Brier per category
        for (const cat of Object.keys(categoryPerformance)) {
            const total = categoryPerformance[cat].wins + categoryPerformance[cat].losses;
            if (total > 0) categoryPerformance[cat].brierScore /= total;
        }

        // Signal source performance
        const signalSourcePerformance: Record<string, { wins: number; losses: number; avgEdge: number }> = {};
        for (const entry of resolved) {
            const src = this.normalizeSource(entry.signalSource);
            if (!signalSourcePerformance[src]) {
                signalSourcePerformance[src] = { wins: 0, losses: 0, avgEdge: 0 };
            }
            if (entry.outcome === 'WIN') signalSourcePerformance[src].wins++;
            else signalSourcePerformance[src].losses++;
            signalSourcePerformance[src].avgEdge += Math.abs(entry.modelProbability - entry.marketPriceAtEntry);
        }
        for (const src of Object.keys(signalSourcePerformance)) {
            const total = signalSourcePerformance[src].wins + signalSourcePerformance[src].losses;
            if (total > 0) signalSourcePerformance[src].avgEdge /= total;
        }

        // Generate actionable recommendations
        const recommendations = this.generateRecommendations(
            brierScore, calibrationBuckets, categoryPerformance, signalSourcePerformance, resolvedTrades
        );

        return {
            totalTrades,
            resolvedTrades,
            winRate,
            brierScore,
            logLoss,
            calibrationBuckets,
            categoryPerformance,
            signalSourcePerformance,
            recommendations
        };
    }

    // ─── Feedback for EdgeEstimator ─────────────────────────────

    /**
     * Get a category-specific base rate correction from historical data.
     * Returns a multiplier to apply to the category base rate.
     * > 1.0 = category base rate has been too low, < 1.0 = too high
     */
    public getCategoryCorrection(category: string): number {
        const resolved = this.entries.filter(e => e.category === category && e.outcome !== undefined);
        if (resolved.length < MIN_SAMPLES_FOR_FEEDBACK) return 1.0; // Not enough data

        const avgPredicted = resolved.reduce((s, e) => s + e.modelProbability, 0) / resolved.length;
        const avgActual = resolved.reduce((s, e) => s + (e.actualResult ?? 0), 0) / resolved.length;

        if (avgPredicted === 0) return 1.0;
        return avgActual / avgPredicted;
    }

    /**
     * Get the historical edge accuracy for a given signal source.
     * Returns the realized win rate, or null if not enough data.
     */
    public getSourceAccuracy(source: string): number | null {
        const src = this.normalizeSource(source);
        const resolved = this.entries.filter(
            e => this.normalizeSource(e.signalSource) === src && e.outcome !== undefined
        );
        if (resolved.length < MIN_SAMPLES_FOR_FEEDBACK) return null;
        return resolved.filter(e => e.outcome === 'WIN').length / resolved.length;
    }

    /**
     * Get a confidence scaling factor based on calibration.
     * If we've been overconfident, this returns < 1.0 to shrink future confidence.
     * If we've been underconfident, this returns > 1.0.
     */
    public getConfidenceScalingFactor(): number {
        const resolved = this.entries.filter(e => e.outcome !== undefined);
        if (resolved.length < MIN_SAMPLES_FOR_FEEDBACK) return 1.0;

        // Compare average predicted confidence vs actual win rate
        const avgConfidence = resolved.reduce((s, e) => s + e.signalConfidence, 0) / resolved.length;
        const actualWinRate = resolved.filter(e => e.outcome === 'WIN').length / resolved.length;

        if (avgConfidence === 0) return 1.0;
        const ratio = actualWinRate / avgConfidence;

        // Clamp between 0.5 and 1.5 to prevent wild swings
        return Math.min(1.5, Math.max(0.5, ratio));
    }

    /** Get the number of resolved entries (for deciding when to trust calibration data). */
    public getResolvedCount(): number {
        return this.entries.filter(e => e.outcome !== undefined).length;
    }

    // ─── Internals ──────────────────────────────────────────────

    private buildCalibrationBuckets(resolved: CalibrationEntry[]): CalibrationBucket[] {
        const buckets: CalibrationBucket[] = [];

        for (let low = 0; low < 1.0; low += BUCKET_SIZE) {
            const high = low + BUCKET_SIZE;
            const inBucket = resolved.filter(e =>
                e.modelProbability >= low && e.modelProbability < high
            );

            if (inBucket.length === 0) continue;

            const avgPredicted = inBucket.reduce((s, e) => s + e.modelProbability, 0) / inBucket.length;
            const actualWinRate = inBucket.filter(e => e.outcome === 'WIN').length / inBucket.length;
            const brierContribution = inBucket.reduce((s, e) => {
                return s + (e.modelProbability - (e.actualResult ?? 0)) ** 2;
            }, 0) / inBucket.length;

            buckets.push({
                bucketLabel: `${(low * 100).toFixed(0)}-${(high * 100).toFixed(0)}%`,
                predictedProbAvg: avgPredicted,
                actualWinRate,
                count: inBucket.length,
                brierContribution
            });
        }

        return buckets;
    }

    private generateRecommendations(
        brierScore: number,
        buckets: CalibrationBucket[],
        categoryPerf: Record<string, { wins: number; losses: number; brierScore: number }>,
        sourcePerf: Record<string, { wins: number; losses: number; avgEdge: number }>,
        resolvedCount: number
    ): string[] {
        const recs: string[] = [];

        if (resolvedCount < MIN_SAMPLES_FOR_FEEDBACK) {
            recs.push(`Need at least ${MIN_SAMPLES_FOR_FEEDBACK} resolved trades for meaningful calibration. Currently have ${resolvedCount}.`);
            return recs;
        }

        // Overall quality
        if (brierScore < 0.15) {
            recs.push('✅ Brier score < 0.15 — predictions are well-calibrated.');
        } else if (brierScore < 0.22) {
            recs.push('⚠️ Brier score 0.15-0.22 — predictions are okay but could improve.');
        } else {
            recs.push('❌ Brier score > 0.22 — predictions are poorly calibrated. Consider reducing edge threshold or increasing signal requirements.');
        }

        // Bucket-level issues
        for (const bucket of buckets) {
            if (bucket.count < 3) continue;
            const gap = Math.abs(bucket.predictedProbAvg - bucket.actualWinRate);
            if (gap > 0.15) {
                const dir = bucket.actualWinRate > bucket.predictedProbAvg ? 'underconfident' : 'overconfident';
                recs.push(`Bucket ${bucket.bucketLabel}: ${dir} by ${(gap * 100).toFixed(0)}%. Predicted ${(bucket.predictedProbAvg * 100).toFixed(0)}%, actual ${(bucket.actualWinRate * 100).toFixed(0)}%.`);
            }
        }

        // Category-level issues
        for (const [cat, perf] of Object.entries(categoryPerf)) {
            const total = perf.wins + perf.losses;
            if (total < 5) continue;
            if (perf.brierScore > 0.30) {
                recs.push(`Category "${cat}" has poor accuracy (Brier ${perf.brierScore.toFixed(2)}). Consider reducing weight or adding category-specific signals.`);
            }
        }

        // Source-level issues
        for (const [src, perf] of Object.entries(sourcePerf)) {
            const total = perf.wins + perf.losses;
            if (total < 5) continue;
            const winRate = perf.wins / total;
            if (winRate < 0.40) {
                recs.push(`Signal source "${src}" underperforming (${(winRate * 100).toFixed(0)}% win rate). Consider downweighting.`);
            }
        }

        return recs;
    }

    private normalizeSource(source: string): string {
        // Extract the base source type from detailed source strings
        if (source.includes('EdgeDetection')) return 'EdgeDetection';
        if (source.includes('MarketResearch')) return 'MarketResearch';
        if (source.includes('Fallback')) return 'Fallback';
        if (source.includes('WhaleMonitor')) return 'WhaleMonitor';
        return source.split(' ')[0] || source;
    }

    private load(): CalibrationEntry[] {
        if (fs.existsSync(this.filePath)) {
            try {
                const raw = fs.readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            } catch (err: any) {
                logger.warn(`[Calibration] Failed to parse ${this.filePath}: ${err.message}. Starting fresh.`);
            }
        }
        return [];
    }

    private save(): void {
        // Non-blocking async write
        fs.promises.writeFile(this.filePath, JSON.stringify(this.entries, null, 2), 'utf8')
            .catch(err => logger.error(`[Calibration] Failed to save: ${err.message}`));
    }

    /** Synchronous save for graceful shutdown — ensures data is flushed before exit. */
    public saveSync(): void {
        fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2), 'utf8');
    }
}
