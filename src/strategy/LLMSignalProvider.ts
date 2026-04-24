import axios from 'axios';
import { logger } from '../utils/logger.js';

export interface LLMProbabilityEstimate {
    probability: number;      // 0-1
    confidence: number;       // 0-1
    reasoning: string;
    direction: 'YES' | 'NO';
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

    constructor(opts?: { model?: string; maxCallsPerCycle?: number }) {
        this.apiKey = process.env.GEMINI_API_KEY || null;
        this.model = opts?.model ?? 'gemini-2.0-flash';
        this.maxCallsPerCycle = opts?.maxCallsPerCycle ?? 10;
        this.enabled = !!this.apiKey;

        if (this.enabled) {
            logger.info(`[LLMSignalProvider] Enabled with model ${this.model} (max ${this.maxCallsPerCycle} calls/cycle).`);
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

        this.callsThisCycle++;

        const prompt = this.buildPrompt(question, currentMarketPrice, category, description);

        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 500,
                        responseMimeType: 'application/json'
                    }
                },
                { timeout: 15000 }
            );

            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                logger.debug('[LLMSignalProvider] Empty response from Gemini.');
                return null;
            }

            return this.parseResponse(text, currentMarketPrice);
        } catch (error: any) {
            if (error.response?.status === 429) {
                logger.warn('[LLMSignalProvider] Rate limited by Gemini API.');
            } else {
                logger.debug(`[LLMSignalProvider] API call failed: ${error.message}`);
            }
            return null;
        }
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
}
