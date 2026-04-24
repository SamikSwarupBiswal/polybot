import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { MarketScanner } from './MarketScanner.js';
import { OrderbookAnalyzer, PricedMarket } from './OrderbookAnalyzer.js';
import { OpportunityScorer, ScoredMarket } from './OpportunityScorer.js';
import { PriceHistoryStore } from '../data/PriceHistoryStore.js';
import { EdgeEstimator, EdgeEstimate } from '../strategy/EdgeEstimator.js';
import { LLMSignalProvider } from '../strategy/LLMSignalProvider.js';
import { TradeSignal } from '../execution/RiskGate.js';

/**
 * Orchestrates the full market research pipeline on a configurable schedule:
 *   Scan → Price → Record History → Score → Edge Detect → (LLM) → Emit Signals
 *
 * KEY UPGRADE: Now uses EdgeEstimator to determine WHETHER to trade and which
 * direction, instead of blindly trading every scored market.
 */
export class MarketResearchRunner extends EventEmitter {
    private readonly scanner: MarketScanner;
    private readonly analyzer: OrderbookAnalyzer;
    private readonly scorer: OpportunityScorer;
    private readonly priceHistory: PriceHistoryStore;
    private readonly edgeEstimator: EdgeEstimator;
    private readonly llm: LLMSignalProvider;
    private readonly intervalMs: number;
    private readonly signalsPerCycle: number;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;

    /** Tracks which markets we've already emitted signals for,
     *  so we don't spam the same market every 15 minutes. */
    private readonly recentlySignaled = new Map<string, number>();
    private readonly signalCooldownMs: number;

    constructor(opts?: {
        intervalMs?: number;
        signalsPerCycle?: number;
        signalCooldownMs?: number;
        maxPages?: number;
        minVolumeUsd?: number;
        priceHistory?: PriceHistoryStore;
    }) {
        super();
        this.intervalMs = opts?.intervalMs ?? 15 * 60 * 1000;       // 15 min
        this.signalsPerCycle = opts?.signalsPerCycle ?? 5;
        this.signalCooldownMs = opts?.signalCooldownMs ?? 60 * 60 * 1000; // 1 hour

        this.scanner = new MarketScanner({
            maxPages: opts?.maxPages ?? 10,
            minVolumeUsd: opts?.minVolumeUsd ?? 50000
        });
        this.analyzer = new OrderbookAnalyzer();
        this.scorer = new OpportunityScorer({ topN: 30 }); // Widen pool for edge filtering
        this.priceHistory = opts?.priceHistory ?? new PriceHistoryStore();
        this.edgeEstimator = new EdgeEstimator(this.priceHistory);
        this.llm = new LLMSignalProvider({ maxCallsPerCycle: 10 });
    }

    public startPolling() {
        logger.info(`[MarketResearch] Starting research pipeline every ${Math.round(this.intervalMs / 60000)} minutes.`);
        this.intervalId = setInterval(() => {
            this.runCycle();
        }, this.intervalMs);
        // First run immediately
        this.runCycle();
    }

    public stopPolling() {
        if (this.intervalId) clearInterval(this.intervalId);
        logger.info('[MarketResearch] Stopped research pipeline.');
    }

    /** Manually trigger a research cycle (also called on timer). */
    public async runCycle(): Promise<ScoredMarket[]> {
        if (this.isRunning) {
            logger.debug('[MarketResearch] Skipping cycle — previous cycle still running.');
            return [];
        }

        this.isRunning = true;
        const cycleStart = Date.now();
        this.llm.resetCycleCounter();

        try {
            // ─── Step 1: Scan markets ─────────────────────────────
            const candidates = await this.scanner.scan();
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

            // ─── Step 4: Edge detection ───────────────────────────
            // Run edge estimation on ranked markets.
            // On first cycle (no price history yet), edge estimator will use
            // available signals (spread, volume, base rate) and require fewer signals.
            const edgeResults = this.edgeEstimator.estimateBatch(ranked.map(r => r.market));

            // ─── Step 5: LLM enrichment (optional) ────────────────
            // For top edge candidates, optionally get LLM probability estimates
            if (this.llm.isEnabled() && edgeResults.length > 0) {
                await this.enrichWithLLM(edgeResults.slice(0, 5));
            }

            // ─── Step 6: Emit signals ─────────────────────────────
            this.cleanupCooldowns();
            let emittedCount = 0;

            // Prefer edge-detected markets. Fall back to score-based if no edges found.
            if (edgeResults.length > 0) {
                for (const { market: pm, edge } of edgeResults) {
                    if (emittedCount >= this.signalsPerCycle) break;

                    const marketId = pm.market.conditionId;
                    if (this.isRecentlySignaled(marketId)) continue;

                    // Find the ScoredMarket to reuse its token IDs
                    const scored = ranked.find(r => r.market.market.conditionId === marketId);
                    if (!scored) continue;

                    const signal = this.buildEdgeSignal(scored, edge);
                    this.recentlySignaled.set(marketId, Date.now());
                    emittedCount++;

                    logger.info(
                        `[MarketResearch] 🎯 Edge signal #${emittedCount}: ` +
                        `${signal.side} "${signal.market_question.substring(0, 45)}..." ` +
                        `@ $${signal.requested_price.toFixed(3)} ` +
                        `(edge: ${(edge.netEdge * 100).toFixed(1)}%, conf: ${edge.confidence.toFixed(2)}, ` +
                        `model: ${edge.modelProbability.toFixed(2)} vs market: ${edge.marketPrice.toFixed(2)})`
                    );
                    this.emit('signal', signal);
                }
            }

            // Fallback: if no edge was detected (first cycle, or very efficient market),
            // emit score-based signals at reduced confidence
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
                        `${signal.side} "${signal.market_question.substring(0, 45)}..." ` +
                        `@ $${signal.requested_price.toFixed(3)} (score-only, conf: ${signal.confidence.toFixed(2)})`
                    );
                    this.emit('signal', signal);
                }
            }

            const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
            logger.info(
                `[MarketResearch] Cycle complete in ${elapsed}s: ` +
                `${candidates.length} scanned → ${pricedMarkets.length} priced → ` +
                `${ranked.length} scored → ${edgeResults.length} with edge → ${emittedCount} signals emitted.`
            );

            return ranked;
        } catch (error: any) {
            logger.error(`[MarketResearch] Cycle failed: ${error.message}`);
            return [];
        } finally {
            this.isRunning = false;
        }
    }

    // ─── Signal Builders ────────────────────────────────────────────

    /** Build signal from edge-detected market (primary path). */
    private buildEdgeSignal(scored: ScoredMarket, edge: EdgeEstimate): TradeSignal {
        const m = scored.market.market;

        // Use edge direction instead of scorer's naive side selection
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
            // Fallback
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
            source: `EdgeDetection (edge: ${(edge.netEdge * 100).toFixed(1)}%, signals: ${edge.signalCount})`,
            confidence: edge.confidence,
            force_maker: true,
            market_volume_usd: m.volume,
            market_end_date: m.endDate,
            current_market_price: edge.direction === 'YES' ? edge.marketPrice : 1 - edge.marketPrice,
            model_probability: edge.modelProbability
        };
    }

    /** Build signal from score-only market (fallback when no edge detected). */
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
            recommended_size_usd: 1000,  // Smaller size for lower-confidence signals
            source: `MarketResearch-Fallback (score: ${scored.score.toFixed(3)})`,
            confidence: Math.min(Math.max(scored.score * 0.8, 0.55), 0.75), // Capped lower
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
                // Blend LLM estimate with technical edge estimate (60% LLM, 40% technical)
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
                    `net edge=${(edge.netEdge * 100).toFixed(1)}%`
                );
            }
        }
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
