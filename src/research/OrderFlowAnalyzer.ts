import { apiCallWithRetry } from '../utils/apiRetry.js';
import { logger } from '../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────────

export interface OrderFlowSnapshot {
    conditionId: string;
    tokenId: string;
    buyVolume: number;       // Total buy-side volume in USD
    sellVolume: number;      // Total sell-side volume in USD
    netFlow: number;         // buyVolume - sellVolume (positive = buying pressure)
    tradeCount: number;      // Number of trades in window
    avgTradeSize: number;    // Average trade size in USD
    largeTradeCount: number; // Trades > $1000
    imbalanceRatio: number;  // -1 to +1 (positive = buy pressure)
    timestamp: number;
}

export interface OrderFlowSignal {
    /** -1 to +1: positive = sustained buying pressure, negative = selling */
    directionSignal: number;
    /** 0-1: how much large players dominate flow */
    whaleActivity: number;
    /** Whether flow data was available */
    hasData: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────

const DATA_API_URL = 'https://data-api.polymarket.com';
const LARGE_TRADE_THRESHOLD = 1000; // USD
const MAX_TRADES_TO_FETCH = 200;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── OrderFlowAnalyzer ─────────────────────────────────────────────

export class OrderFlowAnalyzer {
    private readonly cache = new Map<string, { snapshot: OrderFlowSnapshot; fetchedAt: number }>();

    /**
     * Analyze recent order flow for a specific token.
     * Uses Polymarket's Data API to fetch recent trade history.
     */
    public async analyze(conditionId: string, tokenId: string): Promise<OrderFlowSignal> {
        if (!tokenId) return { directionSignal: 0, whaleActivity: 0, hasData: false };

        // Check cache
        const cached = this.cache.get(tokenId);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            return this.snapshotToSignal(cached.snapshot);
        }

        try {
            const trades = await this.fetchRecentTrades(tokenId);
            if (trades.length === 0) {
                return { directionSignal: 0, whaleActivity: 0, hasData: false };
            }

            const snapshot = this.buildSnapshot(conditionId, tokenId, trades);
            this.cache.set(tokenId, { snapshot, fetchedAt: Date.now() });
            return this.snapshotToSignal(snapshot);

        } catch (error: any) {
            logger.debug(`[OrderFlow] Failed to fetch trades for ${tokenId.substring(0, 12)}: ${error.message}`);
            return { directionSignal: 0, whaleActivity: 0, hasData: false };
        }
    }

    /**
     * Batch-analyze order flow for multiple markets.
     * Rate-limits requests to avoid hitting API limits.
     */
    public async analyzeBatch(
        markets: Array<{ conditionId: string; tokenId: string }>
    ): Promise<Map<string, OrderFlowSignal>> {
        const results = new Map<string, OrderFlowSignal>();

        for (const { conditionId, tokenId } of markets) {
            const signal = await this.analyze(conditionId, tokenId);
            results.set(conditionId, signal);
            // Rate limit: 50ms between calls
            await new Promise(r => setTimeout(r, 50));
        }

        const withData = [...results.values()].filter(s => s.hasData).length;
        logger.debug(`[OrderFlow] Analyzed ${markets.length} markets, ${withData} with flow data.`);

        return results;
    }

    // ─── Internals ──────────────────────────────────────────────

    private async fetchRecentTrades(tokenId: string): Promise<any[]> {
        // Polymarket Data API endpoint for trade history
        const response = await apiCallWithRetry({
            method: 'get',
            url: `${DATA_API_URL}/trades`,
            params: {
                asset_id: tokenId,
                limit: MAX_TRADES_TO_FETCH,
            },
            timeout: 10000
        }, { label: `OrderFlow trades ${tokenId.substring(0, 12)}` });

        if (!response) return [];

        if (Array.isArray(response.data)) {
            return response.data;
        }

        // Some responses wrap in a data field
        if (Array.isArray(response.data?.data)) {
            return response.data.data;
        }

        return [];
    }

    private buildSnapshot(conditionId: string, tokenId: string, trades: any[]): OrderFlowSnapshot {
        let buyVolume = 0;
        let sellVolume = 0;
        let largeTradeCount = 0;

        for (const trade of trades) {
            const size = this.extractTradeSize(trade);
            const side = this.extractTradeSide(trade);

            if (side === 'BUY') {
                buyVolume += size;
            } else {
                sellVolume += size;
            }

            if (size > LARGE_TRADE_THRESHOLD) {
                largeTradeCount++;
            }
        }

        const totalVolume = buyVolume + sellVolume;
        const netFlow = buyVolume - sellVolume;
        const imbalanceRatio = totalVolume > 0 ? netFlow / totalVolume : 0;

        return {
            conditionId,
            tokenId,
            buyVolume,
            sellVolume,
            netFlow,
            tradeCount: trades.length,
            avgTradeSize: trades.length > 0 ? totalVolume / trades.length : 0,
            largeTradeCount,
            imbalanceRatio,
            timestamp: Date.now()
        };
    }

    private snapshotToSignal(snapshot: OrderFlowSnapshot): OrderFlowSignal {
        // Direction signal: imbalance ratio = -1 to +1
        const directionSignal = Math.min(1, Math.max(-1, snapshot.imbalanceRatio));

        // Whale activity: proportion of trades that are "large"
        const whaleActivity = snapshot.tradeCount > 0
            ? Math.min(1, snapshot.largeTradeCount / snapshot.tradeCount * 3) // Scale up
            : 0;

        return {
            directionSignal,
            whaleActivity,
            hasData: snapshot.tradeCount > 0
        };
    }

    private extractTradeSize(trade: any): number {
        // Handle various Data API response formats
        const size = Number(trade.size ?? trade.amount ?? trade.value ?? 0);
        const price = Number(trade.price ?? trade.outcome_price ?? 1);
        return Number.isFinite(size) ? size * price : 0;
    }

    private extractTradeSide(trade: any): 'BUY' | 'SELL' {
        const side = String(trade.side ?? trade.type ?? trade.direction ?? '').toUpperCase();
        if (side === 'SELL' || side === 'SHORT' || side === 'S') return 'SELL';
        return 'BUY';
    }
}
