import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { MarketScanner } from './MarketScanner.js';
import { OrderbookAnalyzer, PricedMarket } from './OrderbookAnalyzer.js';
import { OpportunityScorer, ScoredMarket } from './OpportunityScorer.js';
import { OrderFlowAnalyzer } from './OrderFlowAnalyzer.js';
import { PriceHistoryStore } from '../data/PriceHistoryStore.js';
import { EdgeEstimator, EdgeEstimate } from '../strategy/EdgeEstimator.js';
import { LLMSignalProvider } from '../strategy/LLMSignalProvider.js';
import { CalibrationTracker } from '../analytics/CalibrationTracker.js';
import { TradeSignal } from '../execution/RiskGate.js';

/**
 * Orchestrates the full market research pipeline on a configurable schedule:
 *   Scan → Price → Record History → Score → Order Flow → Edge Detect → (LLM) → Emit
 *
 * Tier 3 Pipeline:
 * - Order flow analysis feeds buy/sell imbalance into EdgeEstimator
 * - Market regime detection adjusts strategy (momentum vs contrarian)
 * - Calibration feedback corrects confidence based on historical accuracy
 */
export class MarketResearchRunner extends EventEmitter {
    private readonly scanner: MarketScanner;
    private readonly analyzer: OrderbookAnalyzer;
    private readonly scorer: OpportunityScorer;
    private readonly orderFlowAnalyzer: OrderFlowAnalyzer;
    private readonly priceHistory: PriceHistoryStore;
    private readonly edgeEstimator: EdgeEstimator;
    private readonly llm: LLMSignalProvider;
    private readonly calibration: CalibrationTracker;
    private readonly intervalMs: number;
    private readonly signalsPerCycle: number;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;
    private cycleCount = 0;

    /** Tracks which markets we've already emitted signals for. */
    private readonly recentlySignaled = new Map<string, number>();
    private readonly signalCooldownMs: number;

    constructor(opts?: {
        intervalMs?: number;
        signalsPerCycle?: number;
        signalCooldownMs?: number;
        maxPages?: number;
        minVolumeUsd?: number;
        priceHistory?: PriceHistoryStore;
        calibration?: CalibrationTracker;
    }) {
        super();
        this.intervalMs = opts?.intervalMs ?? 15 * 60 * 1000;
        this.signalsPerCycle = opts?.signalsPerCycle ?? 5;
        this.signalCooldownMs = opts?.signalCooldownMs ?? 60 * 60 * 1000;

        this.scanner = new MarketScanner({
            maxPages: opts?.maxPages ?? 10,
            minVolumeUsd: opts?.minVolumeUsd ?? 50000
        });
        this.analyzer = new OrderbookAnalyzer();
        this.scorer = new OpportunityScorer({ topN: 30 });
        this.orderFlowAnalyzer = new OrderFlowAnalyzer();
        this.priceHistory = opts?.priceHistory ?? new PriceHistoryStore();
        this.calibration = opts?.calibration ?? new CalibrationTracker();
        this.edgeEstimator = new EdgeEstimator(this.priceHistory, this.calibration);
        this.llm = new LLMSignalProvider({ maxCallsPerCycle: 10 });
    }

    /** Expose calibration tracker for resolution monitor to record outcomes. */
    public getCalibration(): CalibrationTracker {
        return this.calibration;
    }

    /** Expose LLM provider for session stats logging. */
    public getLLM(): LLMSignalProvider {
        return this.llm;
    }

    public startPolling() {
        logger.info(`[MarketResearch] Starting Tier 3 pipeline every ${Math.round(this.intervalMs / 60000)} minutes.`);
        this.intervalId = setInterval(() => {
            this.runCycle();
        }, this.intervalMs);
        this.runCycle();
    }

    public stopPolling() {
        if (this.intervalId) clearInterval(this.intervalId);
        // Print calibration summary on shutdown
        this.printCalibrationSummary();
        logger.info('[MarketResearch] Stopped research pipeline.');
    }

    /** Manually trigger a research cycle. */
    public async runCycle(): Promise<ScoredMarket[]> {
        if (this.isRunning) {
            logger.debug('[MarketResearch] Skipping cycle — previous cycle still running.');
            return [];
        }

        this.isRunning = true;
        this.cycleCount++;
        const cycleStart = Date.now();
        this.llm.resetCycleCounter();

        try {
            // ─── Step 1: Scan markets ─────────────────────────────
            const candidates = await this.scanner.scan();
            
            // Emit for external mechanical strategies (e.g. DipArbitrage)
            this.emit('marketsScanned', candidates.map(c => ({
                market_id: c.conditionId,
                question: c.question,
                category: c.category,
                tokens: c.tokens.map(t => ({ tokenId: t.token_id, outcome: t.outcome }))
            })));

            if (candidates.length === 0) {
                logger.warn('[MarketResearch] No candidate markets found. Skipping cycle.');
                return [];
            }

            // ─── Step 2: Price via CLOB ───────────────────────────
            const sortedByVolume = [...candidates].sort((a, b) => b.volume - a.volume).slice(0, 80);
            const pricedMarkets = await this.analyzer.analyze(sortedByVolume);

            // ─── Step 2.5: Record price history ───────────────────
            this.priceHistory.record(pricedMarkets);

            // ─── Step 3: Score for tradability ────────────────────
            const ranked = this.scorer.rank(pricedMarkets);

            // ─── Step 3.5: Order flow analysis (NEW in Tier 3) ────
            // Analyze buy/sell flow for top scored markets
            const flowTargets = ranked.slice(0, 20).map(r => ({
                conditionId: r.market.market.conditionId,
                tokenId: r.market.snapshots.find(s => s.outcome.toUpperCase() === 'YES')?.tokenId || ''
            })).filter(t => t.tokenId);
            const orderFlows = await this.orderFlowAnalyzer.analyzeBatch(flowTargets);

            // ─── Step 4: Edge detection (upgraded in Tier 3) ──────
            const edgeResults = this.edgeEstimator.estimateBatch(
                ranked.map(r => r.market),
                orderFlows
            );

            // ─── Step 5: LLM enrichment (optional) ────────────────
            if (this.llm.isEnabled() && edgeResults.length > 0) {
                await this.enrichWithLLM(edgeResults.slice(0, 5));
            }

            // ─── Step 6: Emit signals ─────────────────────────────
            this.cleanupCooldowns();
            let emittedCount = 0;

            if (edgeResults.length > 0) {
                for (const { market: pm, edge } of edgeResults) {
                    if (emittedCount >= this.signalsPerCycle) break;

                    const marketId = pm.market.conditionId;
                    if (this.isRecentlySignaled(marketId)) continue;

                    const scored = ranked.find(r => r.market.market.conditionId === marketId);
                    if (!scored) continue;

                    const signal = this.buildEdgeSignal(scored, edge);
                    this.recentlySignaled.set(marketId, Date.now());
                    emittedCount++;

                    logger.info(
                        `[MarketResearch] 🎯 Edge signal #${emittedCount}: ` +
                        `${signal.side} "${signal.market_question.substring(0, 40)}..." ` +
                        `@ $${signal.requested_price.toFixed(3)} ` +
                        `(edge: ${(edge.netEdge * 100).toFixed(1)}%, ` +
                        `regime: ${edge.regime.regime}, ` +
                        `conf: ${edge.confidence.toFixed(2)})`
                    );
                    this.emit('signal', signal);
                }
            }

            // Fallback for first cycles / efficient markets
            if (emittedCount === 0) {
                for (const scored of ranked) {
                    if (emittedCount >= Math.min(this.signalsPerCycle, 2)) break;

                    const marketId = scored.market.market.conditionId;
                    if (this.isRecentlySignaled(marketId)) continue;

                    const signal = this.buildFallbackSignal(scored);
                    this.recentlySignaled.set(marketId, Date.now());
                    emittedCount++;

                    logger.info(
                        `[MarketResearch] 📊 Fallback signal #${emittedCount}: ` +
                        `${signal.side} "${signal.market_question.substring(0, 40)}..." ` +
                        `@ $${signal.requested_price.toFixed(3)} (score-only)`
                    );
                    this.emit('signal', signal);
                }
            }

            const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
            const flowCount = [...orderFlows.values()].filter(f => f.hasData).length;
            logger.info(
                `[MarketResearch] Cycle #${this.cycleCount} in ${elapsed}s: ` +
                `${candidates.length} scanned → ${pricedMarkets.length} priced → ` +
                `${ranked.length} scored → ${flowCount} with flow → ` +
                `${edgeResults.length} with edge → ${emittedCount} signals.`
            );

            // Print calibration report every 10 cycles
            if (this.cycleCount % 10 === 0) {
                this.printCalibrationSummary();
            }

            return ranked;
        } catch (error: any) {
            logger.error(`[MarketResearch] Cycle failed: ${error.message}`);
            return [];
        } finally {
            this.isRunning = false;
        }
    }

    // ─── Signal Builders ────────────────────────────────────────────

    private buildEdgeSignal(scored: ScoredMarket, edge: EdgeEstimate): TradeSignal {
        const m = scored.market.market;

        const yesToken = scored.market.snapshots.find(s => s.outcome.toUpperCase() === 'YES');
        const noToken = scored.market.snapshots.find(s => s.outcome.toUpperCase() === 'NO');

        let tokenId: string;
        let price: number;

        if (edge.direction === 'YES' && yesToken) {
            tokenId = yesToken.tokenId;
            price = yesToken.bestAsk > 0 ? yesToken.bestAsk : scored.market.yesMidpoint;
        } else if (edge.direction === 'NO' && noToken) {
            tokenId = noToken.tokenId;
            price = noToken.bestAsk > 0 ? noToken.bestAsk : 1 - scored.market.yesMidpoint;
        } else {
            tokenId = scored.recommendedTokenId;
            price = scored.recommendedPrice;
        }

        return {
            mode: 'AI_SIGNAL',
            market_id: m.conditionId,
            outcome_token_id: tokenId,
            market_question: m.question,
            category: m.category,
            side: edge.direction,
            requested_price: Math.min(Math.max(price, 0.01), 0.99),
            recommended_size_usd: 1500,
            source: `EdgeDetection (edge: ${(edge.netEdge * 100).toFixed(1)}%, regime: ${edge.regime.regime}, signals: ${edge.signalCount})`,
            confidence: edge.confidence,
            force_maker: true,
            market_volume_usd: m.volume,
            market_end_date: m.endDate,
            current_market_price: edge.direction === 'YES' ? edge.marketPrice : 1 - edge.marketPrice,
            model_probability: edge.modelProbability
        };
    }

    private buildFallbackSignal(scored: ScoredMarket): TradeSignal {
        const m = scored.market.market;
        return {
            mode: 'AI_SIGNAL',
            market_id: m.conditionId,
            outcome_token_id: scored.recommendedTokenId,
            market_question: m.question,
            category: m.category,
            side: scored.recommendedSide,
            requested_price: scored.recommendedPrice,
            recommended_size_usd: 1000,
            source: `MarketResearch-Fallback (score: ${scored.score.toFixed(3)})`,
            confidence: Math.min(Math.max(scored.score * 0.8, 0.55), 0.75),
            force_maker: true,
            market_volume_usd: m.volume,
            market_end_date: m.endDate,
            current_market_price: scored.recommendedSide === 'YES'
                ? scored.market.yesMidpoint
                : 1 - scored.market.yesMidpoint,
            model_probability: undefined
        };
    }

    // ─── LLM Enrichment ─────────────────────────────────────────────

    private async enrichWithLLM(
        edgeResults: Array<{ market: PricedMarket; edge: EdgeEstimate }>
    ): Promise<void> {
        for (const { market: pm, edge } of edgeResults) {
            const llmResult = await this.llm.estimateProbability(
                pm.market.question,
                pm.yesMidpoint,
                pm.market.category,
                pm.market.description
            );

            if (llmResult) {
                const blendedProb = llmResult.probability * 0.6 + edge.modelProbability * 0.4;
                edge.modelProbability = blendedProb;
                edge.rawEdge = Math.abs(blendedProb - edge.marketPrice);
                edge.netEdge = edge.rawEdge - 0.015;
                edge.direction = blendedProb > edge.marketPrice ? 'YES' : 'NO';
                edge.confidence = Math.min(0.95, edge.confidence * 0.5 + llmResult.confidence * 0.5);
                edge.hasEdge = edge.netEdge > 0.03;

                logger.info(
                    `[MarketResearch] 🤖 LLM enriched "${pm.market.question.substring(0, 40)}": ` +
                    `LLM=${llmResult.probability.toFixed(2)}, blended=${blendedProb.toFixed(2)}, ` +
                    `edge=${(edge.netEdge * 100).toFixed(1)}%`
                );
            }
        }
    }

    // ─── Calibration ────────────────────────────────────────────────

    private printCalibrationSummary(): void {
        const report = this.calibration.generateReport();
        if (report.resolvedTrades < 3) return;

        logger.info('');
        logger.info('══════════ CALIBRATION REPORT ══════════');
        logger.info(`Resolved trades: ${report.resolvedTrades}/${report.totalTrades}`);
        logger.info(`Win rate: ${(report.winRate * 100).toFixed(1)}%`);
        logger.info(`Brier score: ${report.brierScore.toFixed(3)} (lower=better, 0.25=coin flip)`);
        logger.info(`Log loss: ${report.logLoss.toFixed(3)}`);

        if (report.calibrationBuckets.length > 0) {
            logger.info('Calibration buckets:');
            for (const bucket of report.calibrationBuckets) {
                logger.info(
                    `  ${bucket.bucketLabel}: predicted=${(bucket.predictedProbAvg * 100).toFixed(0)}%, ` +
                    `actual=${(bucket.actualWinRate * 100).toFixed(0)}%, n=${bucket.count}`
                );
            }
        }

        for (const rec of report.recommendations) {
            logger.info(`  → ${rec}`);
        }
        logger.info('════════════════════════════════════════');
        logger.info('');
    }

    // ─── Utilities ──────────────────────────────────────────────────

    private isRecentlySignaled(marketId: string): boolean {
        const lastSignaled = this.recentlySignaled.get(marketId);
        return !!lastSignaled && Date.now() - lastSignaled < this.signalCooldownMs;
    }

    private cleanupCooldowns() {
        const now = Date.now();
        for (const [key, ts] of this.recentlySignaled) {
            if (now - ts > this.signalCooldownMs * 2) {
                this.recentlySignaled.delete(key);
            }
        }
    }
}
