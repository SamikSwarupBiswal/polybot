import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { TradeCategory } from './FeeSimulator.js';

export interface TradeRecord {
    trade_id: string;
    mode: 'COPY_TRADE' | 'AI_SIGNAL' | 'MANUAL_TEST';
    market_id: string;
    outcome_token_id?: string | null;
    market_question: string;
    category: TradeCategory;
    side: 'YES' | 'NO';
    entry_price: number;
    shares: number;
    notional_cost: number;
    simulated_fee: number;
    max_loss_pct?: number;
    max_loss_usd?: number;
    stop_loss_price?: number;
    signal_source: string;
    signal_confidence: number;
    timestamp: string;
    resolved_at?: string | null;
    status: 'OPEN' | 'CLOSED_WIN' | 'CLOSED_LOSS' | 'CLOSED_EXIT' | 'EXPIRED';
    resolution_price: number | null;
    exit_price?: number | null;
    exit_reason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL_EXIT' | null;
    pnl: number | null;
    notes: string;
}

export interface WalletLedger {
    balance: number;
    total_deposited: number;
    trades: TradeRecord[];
}

export class VirtualWallet {
    private ledgerPath: string;
    private ledger: WalletLedger;

    constructor(initialBalance: number = 10000) {
        this.ledgerPath = path.resolve(process.cwd(), 'ledger.json');
        this.ledger = this.loadLedger(initialBalance);
    }

    private loadLedger(initialBalance: number): WalletLedger {
        if (fs.existsSync(this.ledgerPath)) {
            try {
                const data = fs.readFileSync(this.ledgerPath, 'utf8');
                return JSON.parse(data);
            } catch (err: any) {
                logger.error(`Failed to read ledger.json: ${err.message}. Reinitializing.`);
            }
        }
        
        const newLedger: WalletLedger = {
            balance: initialBalance,
            total_deposited: initialBalance,
            trades: []
        };
        this.saveLedger(newLedger);
        return newLedger;
    }

    private saveLedger(ledgerState: WalletLedger = this.ledger) {
        fs.writeFileSync(this.ledgerPath, JSON.stringify(ledgerState, null, 2));
    }

    public getBalance(): number {
        return this.ledger.balance;
    }

    public getTotalDeposited(): number {
        return this.ledger.total_deposited;
    }

    public getTrades(): TradeRecord[] {
        return this.ledger.trades;
    }

    public getOpenTrades(): TradeRecord[] {
        return this.ledger.trades.filter(t => t.status === 'OPEN');
    }

    public getClosedTrades(): TradeRecord[] {
        return this.ledger.trades.filter(t => t.status === 'CLOSED_WIN' || t.status === 'CLOSED_LOSS' || t.status === 'CLOSED_EXIT');
    }

    public getOpenExposureByMarket(marketId: string): number {
        return this.getOpenTrades()
            .filter(t => t.market_id === marketId)
            .reduce((sum, t) => sum + t.notional_cost, 0);
    }

    public getOpenExposureByCategory(category: TradeCategory): number {
        return this.getOpenTrades()
            .filter(t => (t.category || TradeCategory.OTHER) === category)
            .reduce((sum, t) => sum + t.notional_cost, 0);
    }

    public getOpenCostBasis(): number {
        return this.getOpenTrades().reduce((sum, t) => sum + t.notional_cost, 0);
    }

    public getConservativeEquity(): number {
        return this.ledger.balance + this.getOpenCostBasis();
    }

    public getRealizedPnlSince(since: Date): number {
        const sinceMs = since.getTime();
        return this.getClosedTrades().reduce((sum, t) => {
            const closedAt = new Date(t.resolved_at || t.timestamp).getTime();
            if (Number.isNaN(closedAt) || closedAt < sinceMs) return sum;
            return sum + (t.pnl || 0);
        }, 0);
    }

    public logTrade(tradeData: Omit<TradeRecord, 'trade_id' | 'timestamp' | 'status' | 'resolution_price' | 'pnl'>): TradeRecord {
        const costToDeduct = tradeData.notional_cost + tradeData.simulated_fee;

        if (this.ledger.balance < costToDeduct) {
            throw new Error(`Insufficient virtual balance. Need $${costToDeduct.toFixed(2)}, have $${this.ledger.balance.toFixed(2)}`);
        }

        this.ledger.balance -= costToDeduct;

        const newTrade: TradeRecord = {
            ...tradeData,
            trade_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            resolved_at: null,
            status: 'OPEN',
            resolution_price: null,
            exit_price: null,
            exit_reason: null,
            pnl: null,
        };

        this.ledger.trades.push(newTrade);
        this.saveLedger();
        
        logger.info(`Logged Paper Trade [${newTrade.trade_id}]: ${newTrade.side} $${newTrade.shares.toFixed(2)} @ $${newTrade.entry_price.toFixed(3)}. Cost: $${costToDeduct.toFixed(2)}`);
        logger.info(`New Virtual Balance: $${this.ledger.balance.toFixed(2)}`);

        return newTrade;
    }

    public resolveTrade(tradeId: string, won: boolean) {
        const trade = this.ledger.trades.find(t => t.trade_id === tradeId);
        if (!trade || trade.status !== 'OPEN') {
            logger.warn(`Cannot resolve trade ${tradeId}: not found or not OPEN.`);
            return;
        }

        if (won) {
            // Polymarket shares resolve to $1.00 each on a win
            const payout = trade.shares * 1.00;
            const pnl = payout - (trade.notional_cost + trade.simulated_fee);
            
            this.ledger.balance += payout;
            trade.pnl = pnl;
            trade.resolution_price = 1.0;
            trade.status = 'CLOSED_WIN';
            trade.resolved_at = new Date().toISOString();
            logger.info(`Resolved WIN [${tradeId}]: PnL +$${pnl.toFixed(2)}`);
        } else {
            // Options resolve to $0.00
            const pnl = -(trade.notional_cost + trade.simulated_fee);
            trade.pnl = pnl;
            trade.resolution_price = 0.0;
            trade.status = 'CLOSED_LOSS';
            trade.resolved_at = new Date().toISOString();
            logger.info(`Resolved LOSS [${tradeId}]: PnL -$${Math.abs(pnl).toFixed(2)}`);
        }

        this.saveLedger();
    }

    public closeTradeAtPrice(
        tradeId: string,
        exitPrice: number,
        reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL_EXIT' = 'MANUAL_EXIT'
    ) {
        const trade = this.ledger.trades.find(t => t.trade_id === tradeId);
        if (!trade || trade.status !== 'OPEN') {
            logger.warn(`Cannot close trade ${tradeId}: not found or not OPEN.`);
            return;
        }

        const clampedExitPrice = Math.min(Math.max(exitPrice, 0), 1);
        const proceeds = trade.shares * clampedExitPrice;
        const pnl = proceeds - (trade.notional_cost + trade.simulated_fee);

        this.ledger.balance += proceeds;
        trade.pnl = pnl;
        trade.resolution_price = clampedExitPrice;
        trade.exit_price = clampedExitPrice;
        trade.exit_reason = reason;
        trade.status = 'CLOSED_EXIT';
        trade.resolved_at = new Date().toISOString();

        logger.info(`Closed trade [${tradeId}] via ${reason} @ $${clampedExitPrice.toFixed(3)}: PnL ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
        this.saveLedger();
    }

    public applyStopLoss(tradeId: string, currentSidePrice: number): boolean {
        const trade = this.ledger.trades.find(t => t.trade_id === tradeId);
        if (!trade || trade.status !== 'OPEN' || typeof trade.stop_loss_price !== 'number') {
            return false;
        }

        if (currentSidePrice <= trade.stop_loss_price) {
            this.closeTradeAtPrice(tradeId, currentSidePrice, 'STOP_LOSS');
            return true;
        }

        return false;
    }
}
