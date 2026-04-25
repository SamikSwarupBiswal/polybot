import { logger } from '../utils/logger.js';
import { apiCallWithRetry } from '../utils/apiRetry.js';

export interface LLMProbabilityEstimate {
    probability: number;      // 0-1
    confidence: number;       // 0-1
    reasoning: string;
    direction: 'YES' | 'NO';
}

export interface NewsImpactEstimate {
    market_id: string;
    impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    newProbability: number;
    reasoning: string;
}

/**
 * Optional LLM-based probability estimation for prediction markets.
 * Uses Google Gemini API. Falls back gracefully if no API key is configured.
 *
 * Set GEMINI_API_KEY in .env to enable.
 */
export class LLMSignalProvider {
    private readonly apiKey: string | null;
    private readonly model: string;
    private readonly maxCallsPerCycle: number;
    private callsThisCycle = 0;
    private readonly enabled: boolean;

    // ─── Response Cache (Phase B) ───────────────────────
    private readonly cache = new Map<string, { result: LLMProbabilityEstimate; cachedAt: number }>();
    private readonly cacheTtlMs: number;

    // ─── API Cost Tracking (Phase B) ────────────────────
    private sessionCalls = 0;
    private sessionCacheHits = 0;
    private sessionEstimatedInputTokens = 0;
    private sessionEstimatedOutputTokens = 0;
    private readonly estimatedCostPerInputToken = 0.000000125;   // Gemini Flash: ~$0.125/M input
    private readonly estimatedCostPerOutputToken = 0.000000375;  // Gemini Flash: ~$0.375/M output

    constructor(opts?: { model?: string; maxCallsPerCycle?: number; cacheTtlMs?: number }) {
        this.apiKey = process.env.GEMINI_API_KEY || null;
        this.model = opts?.model ?? 'gemini-2.0-flash';
        this.maxCallsPerCycle = opts?.maxCallsPerCycle ?? 10;
        this.cacheTtlMs = opts?.cacheTtlMs ?? 60 * 60 * 1000; // 1 hour default
        this.enabled = !!this.apiKey;

        if (this.enabled) {
            logger.info(`[LLMSignalProvider] Enabled with model ${this.model} (max ${this.maxCallsPerCycle} calls/cycle, cache TTL ${Math.round(this.cacheTtlMs / 60000)}min).`);
        } else {
            logger.info('[LLMSignalProvider] Disabled — no GEMINI_API_KEY in environment. Edge Estimator will work without LLM.');
        }
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    /** Reset the per-cycle rate limit counter. Call at the start of each research cycle. */
    public resetCycleCounter() {
        this.callsThisCycle = 0;
    }

    /**
     * Ask the LLM to estimate the probability for a prediction market question.
     * Returns null if disabled, rate-limited, or on error.
     */
    public async estimateProbability(
        question: string,
        currentMarketPrice: number,
        category: string,
        description?: string
    ): Promise<LLMProbabilityEstimate | null> {
        if (!this.enabled || !this.apiKey) return null;
        if (this.callsThisCycle >= this.maxCallsPerCycle) {
            logger.debug('[LLMSignalProvider] Rate limit reached for this cycle.');
            return null;
        }

        // ─── Cache Lookup ───────────────────────────────────
        const cacheKey = `${question}|${currentMarketPrice.toFixed(2)}|${category}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.cachedAt) < this.cacheTtlMs) {
            this.sessionCacheHits++;
            logger.debug(`[LLMSignalProvider] Cache HIT for "${question.substring(0, 40)}..." (age: ${Math.round((Date.now() - cached.cachedAt) / 60000)}min)`);
            return cached.result;
        }

        this.callsThisCycle++;

        const prompt = this.buildPrompt(question, currentMarketPrice, category, description);

        try {
            const response = await apiCallWithRetry({
                method: 'post',
                url: `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
                data: {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 500,
                        responseMimeType: 'application/json'
                    }
                },
                timeout: 15000
            }, { label: 'Gemini LLM', maxRetries: 2 });

            if (!response) {
                logger.debug('[LLMSignalProvider] Gemini API call failed after retries.');
                return null;
            }

            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                logger.debug('[LLMSignalProvider] Empty response from Gemini.');
                return null;
            }

            const parsed = this.parseResponse(text, currentMarketPrice);

            // Track API cost
            this.sessionCalls++;
            this.sessionEstimatedInputTokens += Math.ceil(prompt.length / 4); // ~4 chars per token
            this.sessionEstimatedOutputTokens += Math.ceil((text?.length || 200) / 4);

            // Cache successful result
            if (parsed) {
                this.cache.set(cacheKey, { result: parsed, cachedAt: Date.now() });
                // Evict stale cache entries
                this.evictStaleCache();
            }

            return parsed;
        } catch (error: any) {
            this.sessionCalls++;
            logger.debug(`[LLMSignalProvider] API call failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Ask the LLM to evaluate the impact of a news headline on a list of active markets.
     */
    public async evaluateNewsImpact(headline: string, markets: any[]): Promise<NewsImpactEstimate[]> {
        if (!this.apiKey || !this.enabled || markets.length === 0) return [];

        if (this.callsThisCycle >= this.maxCallsPerCycle) {
            logger.debug(`[LLMSignalProvider] Rate limit reached (${this.maxCallsPerCycle} calls/cycle).`);
            return [];
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const prompt = this.buildNewsImpactPrompt(headline, markets);

        try {
            this.callsThisCycle++;
            this.sessionCalls++;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
            };

            const response = await apiCallWithRetry(
                { method: 'post', url, data: payload, timeout: 15000 },
                { label: `LLM News Impact: ${headline.substring(0, 30)}...` }
            );

            const resultText = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!resultText) {
                logger.debug('[LLMSignalProvider] No valid response from Gemini API for news impact.');
                return [];
            }

            // Estimate tokens
            this.sessionEstimatedInputTokens += Math.round(prompt.length / 4);
            this.sessionEstimatedOutputTokens += Math.round(resultText.length / 4);

            return this.parseNewsImpactResponse(resultText, markets);
        } catch (error: any) {
            logger.error(`[LLMSignalProvider] evaluateNewsImpact failed: ${error.message}`);
            return [];
        }
    }

    /** Evict expired entries from cache. */
    private evictStaleCache(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.cachedAt > this.cacheTtlMs) {
                this.cache.delete(key);
            }
        }
    }

    /** Get session-level API usage statistics. */
    public getSessionStats(): {
        totalCalls: number;
        cacheHits: number;
        cacheSize: number;
        estimatedInputTokens: number;
        estimatedOutputTokens: number;
        estimatedCostUsd: number;
    } {
        const cost =
            this.sessionEstimatedInputTokens * this.estimatedCostPerInputToken +
            this.sessionEstimatedOutputTokens * this.estimatedCostPerOutputToken;
        return {
            totalCalls: this.sessionCalls,
            cacheHits: this.sessionCacheHits,
            cacheSize: this.cache.size,
            estimatedInputTokens: this.sessionEstimatedInputTokens,
            estimatedOutputTokens: this.sessionEstimatedOutputTokens,
            estimatedCostUsd: Math.round(cost * 10000) / 10000, // round to 4 decimals
        };
    }

    /** Log a summary of API usage for this session. */
    public logSessionStats(): any {
        const stats = this.getSessionStats();
        logger.info(
            `[LLMSignalProvider] Session stats: ${stats.totalCalls} API calls, ` +
            `${stats.cacheHits} cache hits (${stats.cacheSize} cached), ` +
            `~${stats.estimatedInputTokens + stats.estimatedOutputTokens} tokens, ` +
            `est. cost $${stats.estimatedCostUsd.toFixed(4)}`
        );
        return { calls: stats.totalCalls, costUsd: stats.estimatedCostUsd };
    }

    private buildPrompt(
        question: string,
        currentPrice: number,
        category: string,
        description?: string
    ): string {
        const descBlock = description
            ? `\nAdditional context: ${description.substring(0, 500)}`
            : '';

        return `You are an expert prediction market analyst. Your job is to estimate the true probability of the following event, based on your knowledge of current events, historical precedent, and domain expertise.

Market question: "${question}"
Category: ${category}
Current market price (probability): ${(currentPrice * 100).toFixed(1)}%${descBlock}

Based on your analysis, estimate the TRUE probability that this event will resolve YES.

Important guidelines:
- Be calibrated: if you're unsure, stay close to the market price.
- Only deviate significantly if you have strong reasoning.
- Consider base rates for this type of event.
- Consider the current date and any relevant deadlines.

Respond with ONLY a valid JSON object (no markdown, no explanation outside JSON):
{
  "probability": <number between 0 and 1>,
  "confidence": <number between 0 and 1, how confident you are in your estimate>,
  "reasoning": "<one paragraph explaining your logic>",
  "direction": "<YES or NO — which side you'd bet>"
}`;
    }

    private parseResponse(text: string, marketPrice: number): LLMProbabilityEstimate | null {
        try {
            // Clean up potential markdown wrapping
            const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            const prob = Number(parsed.probability);
            const conf = Number(parsed.confidence);
            const reasoning = String(parsed.reasoning || '');
            const direction = String(parsed.direction || '').toUpperCase();

            if (!Number.isFinite(prob) || prob < 0 || prob > 1) {
                logger.debug(`[LLMSignalProvider] Invalid probability: ${prob}`);
                return null;
            }

            return {
                probability: prob,
                confidence: Number.isFinite(conf) ? Math.min(Math.max(conf, 0), 1) : 0.50,
                reasoning: reasoning.substring(0, 500),
                direction: direction === 'NO' ? 'NO' : 'YES'
            };
        } catch (error: any) {
            logger.debug(`[LLMSignalProvider] Failed to parse response: ${error.message}`);
            return null;
        }
    }

    private buildNewsImpactPrompt(headline: string, markets: any[]): string {
        const marketDescriptions = markets.map(m => 
            `- ID: ${m.id}\n  Question: ${m.question}\n  Current Prob: ${(m.prob * 100).toFixed(1)}%\n  Category: ${m.category}`
        ).join('\n\n');

        return `You are an expert prediction market analyst. Evaluate how the following news headline impacts the given active prediction markets.

Headline: "${headline}"

Active Markets:
${marketDescriptions}

For each market, determine if the headline has a POSITIVE (increases YES probability), NEGATIVE (decreases YES probability), or NEUTRAL (no significant impact) effect.
Provide a new probability estimate for markets that are impacted. If a market is completely unrelated, label it NEUTRAL and keep the probability unchanged.

Respond with ONLY a valid JSON array of objects (no markdown, no explanation outside JSON):
[
  {
    "market_id": "<ID from above>",
    "impact": "<POSITIVE | NEGATIVE | NEUTRAL>",
    "newProbability": <number between 0 and 1, your new estimate>,
    "reasoning": "<short sentence explaining logic>"
  }
]`;
    }

    private parseNewsImpactResponse(text: string, markets: any[]): NewsImpactEstimate[] {
        try {
            const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            if (!Array.isArray(parsed)) return [];

            const validImpacts: NewsImpactEstimate[] = [];
            for (const item of parsed) {
                const market = markets.find(m => m.id === item.market_id);
                if (!market) continue;

                const prob = Number(item.newProbability);
                if (!Number.isFinite(prob) || prob < 0 || prob > 1) continue;

                validImpacts.push({
                    market_id: item.market_id,
                    impact: item.impact === 'POSITIVE' || item.impact === 'NEGATIVE' ? item.impact : 'NEUTRAL',
                    newProbability: prob,
                    reasoning: String(item.reasoning || '').substring(0, 200)
                });
            }

            return validImpacts;
        } catch (error: any) {
            logger.debug(`[LLMSignalProvider] Failed to parse news impact response: ${error.message}`);
            return [];
        }
    }
}
