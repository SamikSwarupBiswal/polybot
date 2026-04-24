import axios from 'axios';
import { logger } from '../utils/logger.js';
import { TradeCategory } from '../execution/FeeSimulator.js';

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
        this.minVolumeUsd = opts?.minVolumeUsd ?? 50000;
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
            try {
                const response = await axios.get(`${GAMMA_API_URL}/markets`, {
                    params: {
                        active: true,
                        closed: false,
                        limit: this.pageSize,
                        offset: page * this.pageSize
                    },
                    timeout: 15000
                });

                const batch = Array.isArray(response.data) ? response.data : [];
                if (batch.length === 0) break; // No more pages
                allRaw.push(...batch);

                // Small delay to be nice to the API
                await MarketScanner.sleep(100);
            } catch (error: any) {
                logger.error(`[MarketScanner] Gamma API page ${page} failed: ${error.message}`);
                break;
            }
        }

        logger.info(`[MarketScanner] Fetched ${allRaw.length} raw markets from Gamma API.`);

        const now = Date.now();
        const minEndMs = now + this.minHoursToResolution * 60 * 60 * 1000;

        const candidates: CandidateMarket[] = allRaw
            .filter((m: any) => {
                // Must have basic fields
                if (!m.condition_id || !m.question) return false;

                // Volume filter
                const volume = Number(m.volume || m.volumeNum || 0);
                if (volume < this.minVolumeUsd) return false;

                // Must have token IDs for CLOB pricing
                const tokens = Array.isArray(m.tokens) ? m.tokens : [];
                if (tokens.length === 0) return false;
                if (!tokens.some((t: any) => t.token_id)) return false;

                // Time-to-resolution filter
                const endDate = m.endDate || m.end_date_iso || '';
                const endMs = new Date(endDate).getTime();
                if (Number.isNaN(endMs) || endMs < minEndMs) return false;

                return true;
            })
            .map((m: any) => ({
                conditionId: m.condition_id,
                question: m.question || '',
                category: MarketScanner.mapCategory(m.category || m.tags?.[0] || ''),
                volume: Number(m.volume || m.volumeNum || 0),
                endDate: m.endDate || m.end_date_iso || '',
                active: true,
                closed: false,
                tokens: (m.tokens || []).map((t: any) => ({
                    token_id: t.token_id || '',
                    outcome: t.outcome || 'Unknown'
                })),
                slug: m.slug || '',
                description: m.description || ''
            }));

        this.cachedMarkets = candidates;
        this.cacheTimestamp = Date.now();

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
