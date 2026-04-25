import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { TradeCategory } from '../execution/FeeSimulator.js';
import { TradeSignal } from '../execution/RiskGate.js';
import { LLMSignalProvider, NewsImpactEstimate } from './LLMSignalProvider.js';

type CandidateMarket = {
    id: string;
    question: string;
    prob: number;
    category: TradeCategory;
    keywords: string[];
    volume: number;
    endDate: string;
};

export class AISignalEngine extends EventEmitter {
    // Simulated market catalogue. Live paper mode should hydrate this from Gamma
    // markets and CLOB midpoint/orderbook data, but the scoring shape is the same.
    private activeMarkets: CandidateMarket[] = [
        { id: '0xAPPLE_RING', question: 'Will Apple release a smart ring by 2026?', prob: 0.35, category: TradeCategory.TECHNOLOGY, keywords: ['apple', 'smart ring', 'ring'], volume: 125000, endDate: '2026-12-31T23:59:59Z' },
        { id: '0xOPENAI_FUND', question: 'Will OpenAI raise another round >$1B in 2026?', prob: 0.65, category: TradeCategory.TECHNOLOGY, keywords: ['openai', 'funding', 'microsoft', 'raise'], volume: 275000, endDate: '2026-12-31T23:59:59Z' },
        { id: '0xCRYPTO_BILL', question: 'Will the Senate pass comprehensive Crypto legislation in 2026?', prob: 0.15, category: TradeCategory.POLITICS, keywords: ['senate', 'crypto', 'regulatory', 'legislation'], volume: 180000, endDate: '2026-12-31T23:59:59Z' },
        { id: '0xFED_CUT', question: 'Will the Fed cut rates > 50bps by June?', prob: 0.40, category: TradeCategory.FINANCE, keywords: ['fed', 'federal reserve', 'rates', 'basis points'], volume: 210000, endDate: '2026-06-30T23:59:59Z' },
        { id: '0xSPACEX_MARS', question: 'Will SpaceX land Starship on Mars by 2028?', prob: 0.82, category: TradeCategory.TECHNOLOGY, keywords: ['spacex', 'starship', 'mars'], volume: 90000, endDate: '2028-12-31T23:59:59Z' },
    ];

    /**
     * Replace the hardcoded market catalogue with live-scanned markets.
     * Each market's keywords are auto-generated from the question text.
     */
    public hydrateMarkets(markets: { conditionId: string; question: string; category: TradeCategory; volume: number; endDate: string; yesMidpoint: number }[]) {
        const hydrated: CandidateMarket[] = markets.map(m => ({
            id: m.conditionId,
            question: m.question,
            prob: m.yesMidpoint,
            category: m.category,
            keywords: m.question.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3),
            volume: m.volume,
            endDate: m.endDate
        }));

        if (hydrated.length > 0) {
            this.activeMarkets = hydrated;
            logger.info(`[AISignalEngine] Hydrated with ${hydrated.length} live markets for headline matching.`);
        }
    }

    private readonly llm: LLMSignalProvider;

    constructor(llm: LLMSignalProvider) {
        super();
        this.llm = llm;
        logger.info('AISignalEngine initialized with LLM capability.');
    }

    public async processNews(headline: string): Promise<void> {
        logger.debug(`[AISignalEngine] Processing headline: "${headline}"`);

        if (!this.llm.isEnabled() || this.activeMarkets.length === 0) {
            logger.debug(`[AISignalEngine] LLM is disabled or no active markets. Skipping news processing.`);
            return;
        }

        // To avoid exceeding token limits, we slice up to the first 15 markets
        // In reality, you'd filter markets by some heuristic first, but LLM can handle ~15 easily short-text.
        const targetMarkets = this.activeMarkets.slice(0, 15);
        
        logger.info(`[AISignalEngine] Evaluating news impact cross ${targetMarkets.length} markets...`);
        const impacts = await this.llm.evaluateNewsImpact(headline, targetMarkets);

        for (const impact of impacts) {
            if (impact.impact === 'NEUTRAL') continue;

            const market = this.activeMarkets.find(m => m.id === impact.market_id);
            if (!market) continue;

            const edge = Math.abs(impact.newProbability - market.prob);
            
            logger.verbose(`[AISignalEngine] LLM Impact for ${market.id}: Market=${market.prob}, Model=${impact.newProbability}, Edge=${(edge * 100).toFixed(1)}%`);
            logger.verbose(`[AISignalEngine] Reasoning: ${impact.reasoning}`);

            if (edge <= 0.08) {
                logger.debug(`[AISignalEngine] Rejected: Edge ${(edge * 100).toFixed(1)}% is below 8% threshold.`);
                continue;
            }

            const side: 'YES' | 'NO' = impact.newProbability >= market.prob ? 'YES' : 'NO';
            const fairSidePrice = side === 'YES' ? impact.newProbability : 1 - impact.newProbability;

            const llmSignal: TradeSignal = {
                mode: 'AI_SIGNAL',
                market_id: market.id,
                market_question: market.question,
                category: market.category,
                side,
                requested_price: Math.min(Math.max(fairSidePrice, 0.01), 0.99),
                recommended_size_usd: 1500, // Standard size for high-confidence AI
                source: `News: ${headline.substring(0, 30)}...`,
                confidence: 0.85, 
                force_maker: true,
                market_volume_usd: market.volume,
                market_end_date: market.endDate,
                current_market_price: side === 'YES' ? market.prob : 1 - market.prob,
                model_probability: impact.newProbability
            };

            logger.info(`[AISignalEngine] STRATEGY APPROVED: Edge ${(edge * 100).toFixed(1)}% > 8%. Emitting ${side} signal for ${market.id}`);
            this.emit('signal', llmSignal);
        }
    }
}
