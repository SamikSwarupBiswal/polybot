import axios from 'axios';
import { VirtualWallet } from '../execution/VirtualWallet.js';
import { logger } from '../utils/logger.js';

const GAMMA_API_URL = process.env.GAMMA_API_URL || 'https://gamma-api.polymarket.com';

/**
 * Polls Gamma API for market resolution status and auto-closes paper trades
 * whose markets have resolved.  This is the only path through which paper-trade
 * outcomes become real — no more random resolution.
 */
export class MarketResolutionMonitor {
    private readonly wallet: VirtualWallet;
    private readonly intervalMs: number;
    private intervalId: NodeJS.Timeout | null = null;
    private isPolling = false;

    constructor(wallet: VirtualWallet, intervalMs: number = 5 * 60 * 1000) {
        this.wallet = wallet;
        this.intervalMs = intervalMs;
    }

    public startPolling() {
        logger.info(`[ResolutionMonitor] Starting polling every ${Math.round(this.intervalMs / 1000)}s for market resolutions.`);
        this.intervalId = setInterval(() => { this.checkResolutions(); }, this.intervalMs);
        // First check immediately
        this.checkResolutions();
    }

    public stopPolling() {
        if (this.intervalId) clearInterval(this.intervalId);
        logger.info('[ResolutionMonitor] Stopped resolution monitor polling.');
    }

    private async checkResolutions() {
        if (this.isPolling) return;
        this.isPolling = true;

        try {
            const openTrades = this.wallet.getOpenTrades();
            if (openTrades.length === 0) return;

            // Collect unique market IDs (condition_ids)
            const uniqueMarketIds = [...new Set(openTrades.map(t => t.market_id))];

            for (const marketId of uniqueMarketIds) {
                try {
                    const resolved = await this.checkMarketResolution(marketId);
                    if (resolved === null) continue; // API error or not resolved

                    // Find all trades in this market and resolve them
                    const tradesInMarket = openTrades.filter(t => t.market_id === marketId);
                    for (const trade of tradesInMarket) {
                        const won = this.didTradeWin(trade.side, resolved.winningOutcome);
                        this.wallet.resolveTrade(trade.trade_id, won);
                        logger.info(`[ResolutionMonitor] Resolved trade ${trade.trade_id.substring(0, 8)}: ${won ? 'WIN' : 'LOSS'} (market: "${trade.market_question.substring(0, 50)}", winning outcome: ${resolved.winningOutcome})`);
                    }
                } catch (error: any) {
                    logger.debug(`[ResolutionMonitor] Error checking market ${marketId}: ${error.message}`);
                }

                // Small delay between market lookups
                await MarketResolutionMonitor.sleep(200);
            }
        } catch (error: any) {
            logger.error(`[ResolutionMonitor] Polling cycle failed: ${error.message}`);
        } finally {
            this.isPolling = false;
        }
    }

    private async checkMarketResolution(conditionId: string): Promise<{ winningOutcome: string } | null> {
        try {
            const response = await axios.get(`${GAMMA_API_URL}/markets`, {
                params: { condition_ids: conditionId, limit: 1 },
                timeout: 10000
            });

            const market = Array.isArray(response.data) ? response.data[0] : null;
            if (!market) return null;

            // Check if the market has resolved
            const isClosed = market.closed === true || market.closed === 'true';
            const isResolved = market.resolved === true || market.resolved === 'true';

            if (!isClosed || !isResolved) return null;

            // Determine winning outcome from tokens
            const tokens = Array.isArray(market.tokens) ? market.tokens : [];
            const winningToken = tokens.find((t: any) => {
                const winner = t.winner ?? t.winning;
                return winner === true || winner === 'true';
            });

            if (!winningToken) {
                // Fallback: check resolution_source or outcome field
                const outcome = market.resolution_outcome || market.outcome || '';
                if (outcome) return { winningOutcome: String(outcome).toUpperCase() };
                logger.debug(`[ResolutionMonitor] Market ${conditionId} is resolved but cannot determine winner.`);
                return null;
            }

            return { winningOutcome: String(winningToken.outcome || 'YES').toUpperCase() };
        } catch (error: any) {
            logger.debug(`[ResolutionMonitor] Gamma API lookup failed for ${conditionId}: ${error.message}`);
            return null;
        }
    }

    private didTradeWin(tradeSide: 'YES' | 'NO', winningOutcome: string): boolean {
        return tradeSide === winningOutcome;
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
