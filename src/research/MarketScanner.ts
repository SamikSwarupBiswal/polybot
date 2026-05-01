import { logger } from '../utils/logger.js';
import { TradeCategory } from '../execution/FeeSimulator.js';
import { apiCallWithRetry } from '../utils/apiRetry.js';

const GAMMA_API_URL = process.env.GAMMA_API_URL || 'https://gamma-api.polymarket.com';

export interface CandidateMarket {
    conditionId: string;
    question: string;
    category: TradeCategory;
    volume: number;
    endDate: string;
    active: boolean;
    closed: boolean;
    tokens: { token_id: string; outcome: string }[];
    /** Raw Gamma description/slug for context */
    slug: string;
    description: string;
}

export class MarketScanner {
    private readonly maxPages: number;
    private readonly pageSize = 100;
    private readonly minVolumeUsd: number;
    private readonly minHoursToResolution: number;

    /** Simple in-memory cache to avoid hammering Gamma on every cycle. */
    private cachedMarkets: CandidateMarket[] = [];
    private cacheTimestamp = 0;
    private readonly cacheTtlMs: number;

    constructor(opts?: {
        maxPages?: number;
        minVolumeUsd?: number;
        minHoursToResolution?: number;
        cacheTtlMs?: number;
    }) {
        this.maxPages = opts?.maxPages ?? 20;       // Up to 2000 markets
        this.minVolumeUsd = opts?.minVolumeUsd ?? 500;
        this.minHoursToResolution = opts?.minHoursToResolution ?? 48;
        this.cacheTtlMs = opts?.cacheTtlMs ?? 10 * 60 * 1000; // 10 min
    }

    /**
     * Scans Gamma API for active, liquid markets and returns filtered candidates.
     * Results are cached for `cacheTtlMs` to avoid excessive API calls.
     */
    public async scan(): Promise<CandidateMarket[]> {
        if (Date.now() - this.cacheTimestamp < this.cacheTtlMs && this.cachedMarkets.length > 0) {
            logger.debug(`[MarketScanner] Returning ${this.cachedMarkets.length} cached markets.`);
            return this.cachedMarkets;
        }

        logger.info('[MarketScanner] Starting full Gamma API market scan...');
        const allRaw: any[] = [];

        for (let page = 0; page < this.maxPages; page++) {
            const response = await apiCallWithRetry({
                method: 'get',
                url: `${GAMMA_API_URL}/markets`,
                params: {
                    active: true,
                    closed: false,
                    limit: this.pageSize,
                    offset: page * this.pageSize
                },
                timeout: 15000
            }, { label: `Gamma markets page ${page}` });

            if (!response) {
                logger.error(`[MarketScanner] Gamma API page ${page} failed after retries.`);
                break;
            }

            const batch = Array.isArray(response.data) ? response.data : [];
            if (batch.length === 0) break; // No more pages
            allRaw.push(...batch);

            // Small delay to be nice to the API
            await MarketScanner.sleep(100);
        }

        logger.info(`[MarketScanner] Fetched ${allRaw.length} raw markets from Gamma API.`);

        const now = Date.now();
        const minEndMs = now + this.minHoursToResolution * 60 * 60 * 1000;

        let dropBasic = 0, dropVolume = 0, dropTokens = 0, dropTime = 0, dropOther = 0;

        const candidates: CandidateMarket[] = allRaw
            .filter((m: any) => {
                // Must have basic fields
                if (!m.conditionId || !m.question) { dropBasic++; return false; }

                // Volume filter
                const volume = Number(m.volume || m.volumeNum || 0);
                if (volume < this.minVolumeUsd) { dropVolume++; return false; }

                // Must have token IDs for CLOB pricing
                let clobTokenIds: string[] = [];
                try {
                    clobTokenIds = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : (Array.isArray(m.clobTokenIds) ? m.clobTokenIds : []);
                } catch (e) {
                    clobTokenIds = [];
                }
                const tokens = Array.isArray(m.tokens) ? m.tokens : [];
                if (clobTokenIds.length === 0 && tokens.length === 0) { dropTokens++; return false; }

                // Time-to-resolution filter
                const endDate = m.endDate || m.endDateIso || m.end_date_iso || '';
                const endMs = new Date(endDate).getTime();
                if (Number.isNaN(endMs) || endMs < minEndMs) { dropTime++; return false; }

                return true;
            })
            .map((m: any) => {
                let tokenList = [];
                let parsedClobTokenIds: string[] = [];
                let parsedOutcomes: string[] = [];
                
                try {
                    parsedClobTokenIds = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : (Array.isArray(m.clobTokenIds) ? m.clobTokenIds : []);
                } catch (e) { parsedClobTokenIds = []; }
                
                try {
                    parsedOutcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (Array.isArray(m.outcomes) ? m.outcomes : []);
                } catch (e) { parsedOutcomes = []; }

                if (Array.isArray(m.tokens) && m.tokens.length > 0) {
                    tokenList = m.tokens.map((t: any) => ({
                        token_id: t.token_id || '',
                        outcome: t.outcome || 'Unknown'
                    }));
                } else if (parsedClobTokenIds.length > 0 && parsedOutcomes.length > 0) {
                    tokenList = parsedClobTokenIds.map((tid: string, index: number) => ({
                        token_id: tid,
                        outcome: parsedOutcomes[index] || 'Unknown'
                    }));
                }

                return {
                conditionId: m.conditionId,
                question: m.question || '',
                category: MarketScanner.mapCategory(m.category || m.tags?.[0] || ''),
                volume: Number(m.volume || m.volumeNum || 0),
                endDate: m.endDate || m.endDateIso || m.end_date_iso || '',
                active: true,
                closed: false,
                tokens: tokenList,
                slug: m.slug || '',
                description: m.description || ''
                };
            });

        this.cachedMarkets = candidates;
        this.cacheTimestamp = Date.now();

        logger.info(`[MarketScanner] Filters dropped: Basic=${dropBasic}, Volume=${dropVolume}, Tokens=${dropTokens}, Time=${dropTime}`);
        logger.info(`[MarketScanner] ${candidates.length} markets passed filters (volume >= $${this.minVolumeUsd}, >= ${this.minHoursToResolution}h to resolution, has tokens).`);
        return candidates;
    }

    /** Invalidate cache (e.g. after a resolution cycle). */
    public clearCache() {
        this.cachedMarkets = [];
        this.cacheTimestamp = 0;
    }

    private static mapCategory(raw: string): TradeCategory {
        const normalized = String(raw).toUpperCase();
        if (normalized.includes('POLITIC')) return TradeCategory.POLITICS;
        if (normalized.includes('CRYPTO')) return TradeCategory.CRYPTO;
        if (normalized.includes('SPORT')) return TradeCategory.SPORTS;
        if (normalized.includes('TECH')) return TradeCategory.TECHNOLOGY;
        if (normalized.includes('FINANCE') || normalized.includes('ECON')) return TradeCategory.FINANCE;
        if (normalized.includes('GEO') || normalized.includes('WORLD')) return TradeCategory.GEOPOLITICS;
        return TradeCategory.OTHER;
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
