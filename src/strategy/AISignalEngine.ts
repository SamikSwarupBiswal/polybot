import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { TradeCategory } from '../execution/FeeSimulator.js';
import { TradeSignal } from '../execution/RiskGate.js';

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

    constructor() {
        super();
        logger.info('AISignalEngine initialized.');
    }

    public processNews(headline: string) {
        logger.debug(`[AISignalEngine] Processing headline: "${headline}"`);

        const normalizedHeadline = headline.toLowerCase();
        const match = this.activeMarkets
            .map(market => ({
                market,
                score: market.keywords.filter(keyword => normalizedHeadline.includes(keyword)).length
            }))
            .sort((a, b) => b.score - a.score)[0];

        if (!match || match.score === 0) {
            logger.debug('[AISignalEngine] No relevant market matched for headline.');
            return;
        }

        const market = match.market;
        const modelProbability = this.estimateYesProbability(normalizedHeadline, market.prob);
        const edge = Math.abs(modelProbability - market.prob);
        const side: 'YES' | 'NO' = modelProbability >= market.prob ? 'YES' : 'NO';
        const fairSidePrice = side === 'YES' ? modelProbability : 1 - modelProbability;

        logger.verbose(`[AISignalEngine] Probability delta for ${market.id}: Market=${market.prob}, Model=${modelProbability}, Edge=${(edge * 100).toFixed(1)}%`);

        if (edge <= 0.08) {
            logger.debug(`[AISignalEngine] Rejected: Edge ${(edge * 100).toFixed(1)}% is below 8% threshold.`);
            return;
        }

        const llmSignal: TradeSignal = {
            mode: 'AI_SIGNAL',
            market_id: market.id,
            market_question: market.question,
            category: market.category,
            side,
            requested_price: Math.min(Math.max(fairSidePrice, 0.01), 0.99),
            recommended_size_usd: 1500,
            source: `News: ${headline.substring(0, 30)}...`,
            confidence: 0.85,
            force_maker: true,
            max_loss_pct: 0.50,
            market_volume_usd: market.volume,
            market_end_date: market.endDate,
            current_market_price: side === 'YES' ? market.prob : 1 - market.prob,
            model_probability: modelProbability
        };

        logger.info(`[AISignalEngine] STRATEGY APPROVED: Edge ${(edge * 100).toFixed(1)}% > 8%. Emitting ${side} signal for ${market.id}`);
        this.emit('signal', llmSignal);
    }

    private estimateYesProbability(headline: string, currentProbability: number): number {
        const positiveFlags = ['announces', 'secures', 'passes', 'cuts', 'successfully', 'approved', 'confirms', 'launching'];
        const negativeFlags = ['denies', 'delays', 'fails', 'rejects', 'cancels', 'blocked', 'misses', 'lawsuit'];
        const positiveScore = positiveFlags.filter(flag => headline.includes(flag)).length;
        const negativeScore = negativeFlags.filter(flag => headline.includes(flag)).length;
        const directionalMove = (positiveScore - negativeScore) * 0.18;

        return Math.min(Math.max(currentProbability + directionalMove, 0.05), 0.95);
    }
}
