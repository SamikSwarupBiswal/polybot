import axios from 'axios';
import { logger } from '../utils/logger.js';
import { CandidateMarket } from './MarketScanner.js';

const CLOB_API_URL = process.env.CLOB_API_URL || 'https://clob.polymarket.com';

export interface OrderbookSnapshot {
    tokenId: string;
    outcome: string;       // "Yes" | "No"
    midpoint: number;      // 0.00-1.00
    bestBid: number;
    bestAsk: number;
    spread: number;        // bestAsk - bestBid
    spreadPct: number;     // spread / midpoint (as fraction, not %)
    isLiquid: boolean;     // spread < 4¢
}

export interface PricedMarket {
    market: CandidateMarket;
    snapshots: OrderbookSnapshot[];
    /** The YES-outcome midpoint, used as the market probability */
    yesMidpoint: number;
    /** Best (narrowest) spread across outcomes */
    bestSpread: number;
}

export class OrderbookAnalyzer {
    private readonly delayMs: number;

    constructor(opts?: { delayMs?: number }) {
        // Delay between API calls to stay under rate limits (~100 req/min)
        this.delayMs = opts?.delayMs ?? 60;
    }

    /**
     * Fetches CLOB pricing for each candidate market's tokens.
     * Returns only markets where at least one token returned valid pricing.
     */
    public async analyze(markets: CandidateMarket[]): Promise<PricedMarket[]> {
        logger.info(`[OrderbookAnalyzer] Analyzing orderbooks for ${markets.length} candidate markets...`);
        const results: PricedMarket[] = [];

        for (const market of markets) {
            const snapshots: OrderbookSnapshot[] = [];

            for (const token of market.tokens) {
                if (!token.token_id) continue;

                const snapshot = await this.fetchSnapshot(token.token_id, token.outcome);
                if (snapshot) snapshots.push(snapshot);

                await OrderbookAnalyzer.sleep(this.delayMs);
            }

            if (snapshots.length === 0) continue;

            const yesSnap = snapshots.find(s => s.outcome.toUpperCase() === 'YES') || snapshots[0];
            const bestSpread = Math.min(...snapshots.map(s => s.spread));

            results.push({
                market,
                snapshots,
                yesMidpoint: yesSnap.midpoint,
                bestSpread
            });
        }

        logger.info(`[OrderbookAnalyzer] ${results.length}/${markets.length} markets returned valid CLOB pricing.`);
        return results;
    }

    private async fetchSnapshot(tokenId: string, outcome: string): Promise<OrderbookSnapshot | null> {
        try {
            // Fetch midpoint and both sides in parallel where possible
            const [midRes, bidRes, askRes] = await Promise.all([
                axios.get(`${CLOB_API_URL}/midpoint`, {
                    params: { token_id: tokenId },
                    timeout: 8000
                }).catch(() => null),
                axios.get(`${CLOB_API_URL}/price`, {
                    params: { token_id: tokenId, side: 'SELL' },
                    timeout: 8000
                }).catch(() => null),
                axios.get(`${CLOB_API_URL}/price`, {
                    params: { token_id: tokenId, side: 'BUY' },
                    timeout: 8000
                }).catch(() => null),
            ]);

            const midpoint = OrderbookAnalyzer.extractPrice(midRes?.data);
            const bestBid = OrderbookAnalyzer.extractPrice(bidRes?.data);
            const bestAsk = OrderbookAnalyzer.extractPrice(askRes?.data);

            if (midpoint === null) {
                logger.debug(`[OrderbookAnalyzer] No midpoint for token ${tokenId.substring(0, 12)}...`);
                return null;
            }

            const safeAsk = bestAsk ?? midpoint;
            const safeBid = bestBid ?? midpoint;
            const spread = Math.max(0, safeAsk - safeBid);
            const spreadPct = midpoint > 0 ? spread / midpoint : 1;

            return {
                tokenId,
                outcome,
                midpoint,
                bestBid: safeBid,
                bestAsk: safeAsk,
                spread,
                spreadPct,
                isLiquid: spread < 0.04
            };
        } catch (error: any) {
            logger.debug(`[OrderbookAnalyzer] Failed to fetch CLOB data for ${tokenId.substring(0, 12)}: ${error.message}`);
            return null;
        }
    }

    /** Extract a numeric price from various CLOB response shapes */
    private static extractPrice(data: any): number | null {
        if (data == null) return null;
        // ClobClient may return { mid: "0.55" } or { price: "0.55" } or just "0.55"
        const raw = data?.mid ?? data?.price ?? data;
        const num = Number(raw);
        return Number.isFinite(num) && num >= 0 && num <= 1 ? num : null;
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
