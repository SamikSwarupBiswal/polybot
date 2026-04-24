import { ClobClient } from '@polymarket/clob-client-v2';
import { VirtualWallet, TradeRecord } from './VirtualWallet.js';
import { logger } from '../utils/logger.js';

export class PositionMonitor {
    private readonly wallet: VirtualWallet;
    private readonly clobClient: ClobClient;
    private readonly intervalMs: number;
    private intervalId: NodeJS.Timeout | null = null;
    private isPolling = false;

    constructor(wallet: VirtualWallet, intervalMs: number = Number(process.env.POSITION_MONITOR_INTERVAL_MS || 60000)) {
        this.wallet = wallet;
        this.intervalMs = intervalMs;
        this.clobClient = new ClobClient({
            host: process.env.CLOB_API_URL || 'https://clob.polymarket.com',
            chain: 137 as any
        });
    }

    public startPolling() {
        logger.info(`Starting PositionMonitor polling every ${Math.round(this.intervalMs / 1000)} seconds.`);
        this.intervalId = setInterval(() => {
            this.pollOpenPositions();
        }, this.intervalMs);
        this.pollOpenPositions();
    }

    public stopPolling() {
        if (this.intervalId) clearInterval(this.intervalId);
        logger.info('Stopped PositionMonitor polling.');
    }

    private async pollOpenPositions() {
        if (this.isPolling) return;
        this.isPolling = true;

        try {
            const openTrades = this.wallet.getOpenTrades();
            if (openTrades.length === 0) return;

            for (const trade of openTrades) {
                await this.checkTradeStopLoss(trade);
            }
        } catch (error: any) {
            logger.error(`PositionMonitor polling failed: ${error.message}`);
        } finally {
            this.isPolling = false;
        }
    }

    private async checkTradeStopLoss(trade: TradeRecord) {
        if (!trade.outcome_token_id) {
            logger.debug(`[PositionMonitor] Skipping ${trade.trade_id}: missing outcome token id.`);
            return;
        }

        const currentExitPrice = await this.getCurrentExitPrice(trade.outcome_token_id);
        if (currentExitPrice === null) return;

        const triggered = this.wallet.applyStopLoss(trade.trade_id, currentExitPrice);
        if (!triggered) {
            logger.debug(`[PositionMonitor] ${trade.trade_id} current exit price $${currentExitPrice.toFixed(3)} is above stop $${(trade.stop_loss_price || 0).toFixed(3)}.`);
        }
    }

    private async getCurrentExitPrice(tokenId: string): Promise<number | null> {
        try {
            // SELL price is the bid the paper wallet could use to exit the held outcome token.
            const response = await this.clobClient.getPrice(tokenId, 'SELL');
            const price = Number(response?.price ?? response);
            if (!Number.isFinite(price)) {
                logger.warn(`[PositionMonitor] Could not parse CLOB SELL price for token ${tokenId}.`);
                return null;
            }
            return Math.min(Math.max(price, 0), 1);
        } catch (error: any) {
            logger.warn(`[PositionMonitor] Failed to fetch CLOB SELL price for token ${tokenId}: ${error.message}`);
            return null;
        }
    }
}
