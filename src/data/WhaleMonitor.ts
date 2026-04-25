import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { apiCallWithRetry } from '../utils/apiRetry.js';
import { TradeCategory } from '../execution/FeeSimulator.js';
import { TradeSignal } from '../execution/RiskGate.js';

type WhaleScore = {
    pnl: number;
    winRate: number;
    sampleSize: number;
};

type MarketMetadata = {
    question: string;
    category: TradeCategory;
    volume: number;
    endDate: string;
};

export class WhaleMonitor extends EventEmitter {
    private whaleWallets: string[];
    private intervalId: NodeJS.Timeout | null = null;
    private readonly DATA_API_URL = process.env.DATA_API_URL || 'https://data-api.polymarket.com';
    private readonly GAMMA_API_URL = process.env.GAMMA_API_URL || 'https://gamma-api.polymarket.com';
    private readonly seenTradeKeys = new Set<string>();
    private readonly lastPollByWallet = new Map<string, number>();

    private readonly minPnl = Number(process.env.MIN_WHALE_PNL_USD || 50000);
    private readonly minWinRate = Number(process.env.MIN_WHALE_WIN_RATE || 55);
    private readonly minSampleSize = Number(process.env.MIN_WHALE_SAMPLE_SIZE || 50);

    private mockScores: Record<string, WhaleScore> = {
        '0xWHALE_QUALIFIED': { pnl: 250000, winRate: 68.5, sampleSize: 120 },
        '0xWHALE_UNQUALIFIED': { pnl: 10000, winRate: 51.2, sampleSize: 40 }
    };

    constructor(wallets: string[]) {
        super();
        this.whaleWallets = wallets.map(w => w.trim()).filter(w => w.length > 5);
        logger.info(`WhaleMonitor initialized with ${this.whaleWallets.length} target wallets.`);
    }

    public startPolling() {
        if (this.whaleWallets.length === 0) {
            logger.warn('No valid whale wallets provided. Skipping monitor polling.');
            return;
        }

        logger.info('Starting 30-second WhaleMonitor polling sequence.');
        this.intervalId = setInterval(async () => {
            await this.pollWallets();
        }, 30000);

        this.pollWallets();
    }

    public stopPolling() {
        if (this.intervalId) clearInterval(this.intervalId);
        logger.info('Stopped WhaleMonitor polling.');
    }

    private async evaluateWhale(wallet: string): Promise<boolean> {
        const score = this.isRealWallet(wallet)
            ? await this.fetchWhaleScore(wallet)
            : this.mockScores[wallet] || { pnl: 0, winRate: 0, sampleSize: 0 };

        const qualifies = score.pnl >= this.minPnl
            && score.winRate >= this.minWinRate
            && score.sampleSize >= this.minSampleSize;

        if (!qualifies) {
            logger.debug(`[WhaleMonitor] Ignoring wallet ${wallet}. PnL=$${score.pnl.toFixed(2)}, winRate=${score.winRate.toFixed(1)}%, sample=${score.sampleSize}.`);
        }

        return qualifies;
    }

    private async pollWallets() {
        logger.verbose('Polling target whale wallets for new trades...');
        for (const wallet of this.whaleWallets) {
            try {
                const isSkillful = await this.evaluateWhale(wallet);
                if (!isSkillful) continue;

                if (!this.isRealWallet(wallet)) {
                    if (process.env.ENABLE_MOCKS === 'true') {
                        this.emitMockTrade(wallet);
                    } else {
                        logger.debug(`[WhaleMonitor] Skipping mock wallet ${wallet} — ENABLE_MOCKS is not true.`);
                    }
                    continue;
                }

                const trades = await this.fetchRecentWalletTrades(wallet);
                for (const trade of trades) {
                    const side = String(trade.side || '').toUpperCase();
                    if (side !== 'BUY') continue;

                    const tradeKey = `${trade.transactionHash || trade.timestamp}:${trade.asset || trade.conditionId}`;
                    if (this.seenTradeKeys.has(tradeKey)) continue;
                    this.seenTradeKeys.add(tradeKey);

                    const market = await this.fetchMarketMetadata(trade.conditionId);
                    const whaleSize = Number(trade.usdcSize || (Number(trade.size || 0) * Number(trade.price || 0)));
                    const outcome = String(trade.outcome || '').toUpperCase();

                    const signal: TradeSignal = {
                        mode: 'COPY_TRADE',
                        market_id: trade.conditionId,
                        outcome_token_id: trade.asset || trade.assetId || trade.asset_id,
                        market_question: market.question || trade.title || 'Unknown Polymarket market',
                        category: market.category,
                        side: outcome === 'NO' ? 'NO' : 'YES',
                        requested_price: Number(trade.price),
                        recommended_size_usd: whaleSize * 0.1,
                        source: wallet,
                        confidence: 0.9,
                        force_maker: true,
                        market_volume_usd: market.volume,
                        market_end_date: market.endDate,
                        whale_trade_size_usd: whaleSize
                    };

                    logger.info(`[WhaleMonitor] Detected qualifying wallet BUY from ${wallet}: $${whaleSize.toFixed(2)} on ${signal.side} @ ${signal.requested_price}`);
                    this.emit('signal', signal);
                }
            } catch (error: any) {
                logger.error(`Error polling whale ${wallet}: ${error.message}`);
            }
        }
    }

    private async fetchWhaleScore(wallet: string): Promise<WhaleScore> {
        const response = await apiCallWithRetry({
            method: 'get',
            url: `${this.DATA_API_URL}/positions`,
            params: { user: wallet },
            timeout: 10000
        }, { label: `WhaleScore ${wallet.substring(0, 10)}` });

        if (!response) return { pnl: 0, winRate: 0, sampleSize: 0 };

        const positions = Array.isArray(response.data) ? response.data : [];
        const scoredPositions = positions.filter((position: any) => Number.isFinite(Number(position.cashPnl ?? position.realizedPnl)));
        const pnl = scoredPositions.reduce((sum: number, position: any) => sum + Number(position.realizedPnl ?? position.cashPnl ?? 0), 0);
        const wins = scoredPositions.filter((position: any) => Number(position.cashPnl ?? position.realizedPnl ?? 0) > 0).length;
        const winRate = scoredPositions.length > 0 ? (wins / scoredPositions.length) * 100 : 0;

        return {
            pnl,
            winRate,
            sampleSize: scoredPositions.length
        };
    }

    private async fetchRecentWalletTrades(wallet: string): Promise<any[]> {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const defaultLookbackSeconds = Number(process.env.WHALE_LOOKBACK_SECONDS || 600);
        const start = this.lastPollByWallet.get(wallet) || nowSeconds - defaultLookbackSeconds;
        this.lastPollByWallet.set(wallet, nowSeconds);

        const response = await apiCallWithRetry({
            method: 'get',
            url: `${this.DATA_API_URL}/activity`,
            params: {
                user: wallet,
                type: 'TRADE',
                start,
                end: nowSeconds,
                limit: 100,
                sortBy: 'TIMESTAMP',
                sortDirection: 'ASC'
            },
            timeout: 10000
        }, { label: `WhaleTrades ${wallet.substring(0, 10)}` });

        return Array.isArray(response?.data) ? response.data : [];
    }

    private async fetchMarketMetadata(conditionId: string): Promise<MarketMetadata> {
        const response = await apiCallWithRetry({
            method: 'get',
            url: `${this.GAMMA_API_URL}/markets`,
            params: {
                condition_ids: conditionId,
                limit: 1
            },
            timeout: 10000
        }, { label: `MarketMeta ${conditionId.substring(0, 12)}` });

        if (!response) return { question: '', category: TradeCategory.OTHER, volume: 0, endDate: '' };

        const market = Array.isArray(response.data) ? response.data[0] : null;
        return {
            question: market?.question || '',
            category: this.mapCategory(market?.category),
            volume: Number(market?.volume || market?.volumeNum || 0),
            endDate: market?.endDate || ''
        };
    }

    private emitMockTrade(wallet: string) {
        if (Math.random() >= 0.20) {
            logger.debug(`[WhaleMonitor] Checked mock wallet ${wallet} - no new trades detected.`);
            return;
        }

        const simulatedInvestment = 5000 + Math.floor(Math.random() * 5000);
        const simulatedSide = Math.random() > 0.5 ? 'YES' : 'NO';
        const rawSignal: TradeSignal = {
            mode: 'COPY_TRADE',
            market_id: '0xMARKET_SIM_' + Math.floor(Math.random() * 1000),
            outcome_token_id: undefined,
            market_question: 'Will Ethereum hit $4000 in Q2 2026?',
            category: TradeCategory.CRYPTO,
            side: simulatedSide,
            requested_price: parseFloat((Math.random() * 0.8 + 0.1).toFixed(3)),
            recommended_size_usd: simulatedInvestment * 0.1,
            source: wallet,
            confidence: 0.95,
            force_maker: true,
            market_volume_usd: 150000,
            market_end_date: '2026-06-30T23:59:59Z',
            whale_trade_size_usd: simulatedInvestment
        };

        logger.info(`[WhaleMonitor] Detected qualifying mock trade from ${wallet}: $${simulatedInvestment} on ${simulatedSide} @ ${rawSignal.requested_price}`);
        this.emit('signal', rawSignal);
    }

    private isRealWallet(wallet: string): boolean {
        return /^0x[a-fA-F0-9]{40}$/.test(wallet);
    }

    private mapCategory(category: string | undefined): TradeCategory {
        const normalized = String(category || '').toUpperCase();
        if (normalized.includes('POLITIC')) return TradeCategory.POLITICS;
        if (normalized.includes('CRYPTO')) return TradeCategory.CRYPTO;
        if (normalized.includes('SPORT')) return TradeCategory.SPORTS;
        if (normalized.includes('TECH')) return TradeCategory.TECHNOLOGY;
        if (normalized.includes('FINANCE') || normalized.includes('ECON')) return TradeCategory.FINANCE;
        if (normalized.includes('GEO') || normalized.includes('WORLD')) return TradeCategory.GEOPOLITICS;
        return TradeCategory.OTHER;
    }
}
