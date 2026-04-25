import { logger } from '../utils/logger.js';
import { apiCallWithRetry } from '../utils/apiRetry.js';
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
    bidsDepth5Pct: number; // USD volume of bids within 5% of midpoint
    asksDepth5Pct: number; // USD volume of asks within 5% of midpoint
    isLiquid: boolean;     // spread < 4¢ and sufficient depth
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
            const tokenLabel = tokenId.substring(0, 12);
            // Fetch midpoint and full orderbook depth in parallel
            const [midRes, bookRes] = await Promise.all([
                apiCallWithRetry({
                    method: 'get',
                    url: `${CLOB_API_URL}/midpoint`,
                    params: { token_id: tokenId },
                    timeout: 8000
                }, { label: `CLOB midpoint ${tokenLabel}` }),
                apiCallWithRetry({
                    method: 'get',
                    url: `${CLOB_API_URL}/book`,
                    params: { token_id: tokenId },
                    timeout: 8000
                }, { label: `CLOB book ${tokenLabel}` })
            ]);

            const midpoint = OrderbookAnalyzer.extractPrice(midRes?.data);
            if (midpoint === null || midpoint === 0) {
                logger.debug(`[OrderbookAnalyzer] No valid midpoint for token ${tokenLabel}...`);
                return null;
            }

            const bids: { price: number; size: number }[] = (bookRes?.data?.bids || []).map((b: any) => ({ price: Number(b.price), size: Number(b.size) }));
            const asks: { price: number; size: number }[] = (bookRes?.data?.asks || []).map((a: any) => ({ price: Number(a.price), size: Number(a.size) }));

            // Sort appropriately: highest bid first, lowest ask first
            bids.sort((a, b) => b.price - a.price);
            asks.sort((a, b) => a.price - b.price);

            const bestBid = bids.length > 0 ? bids[0].price : midpoint;
            const bestAsk = asks.length > 0 ? asks[0].price : midpoint;
            const spread = Math.max(0, bestAsk - bestBid);
            const spreadPct = spread / midpoint;

            // Calculate 5% depth
            const fivePct = midpoint * 0.05;
            const minBidPrice = midpoint - fivePct;
            const maxAskPrice = midpoint + fivePct;

            const bidsDepth5Pct = bids.filter(b => b.price >= minBidPrice).reduce((sum, b) => sum + (b.price * b.size), 0);
            const asksDepth5Pct = asks.filter(a => a.price <= maxAskPrice).reduce((sum, a) => sum + (a.price * a.size), 0);

            // A market is liquid if spread is < 4¢ AND there is more than $100 depth within 5% of midpoint
            const isLiquid = spread < 0.04 && Math.min(bidsDepth5Pct, asksDepth5Pct) > 100;

            return {
                tokenId,
                outcome,
                midpoint,
                bestBid,
                bestAsk,
                spread,
                spreadPct,
                bidsDepth5Pct,
                asksDepth5Pct,
                isLiquid
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
