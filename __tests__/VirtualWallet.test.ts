import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradeCategory } from '../src/execution/FeeSimulator.js';

// Mock fs to avoid real filesystem I/O during tests
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => false),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        promises: { writeFile: vi.fn(() => Promise.resolve()) }
    },
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    promises: { writeFile: vi.fn(() => Promise.resolve()) }
}));

vi.mock('../src/utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), verbose: vi.fn(), error: vi.fn() }
}));

import { VirtualWallet, TradeRecord } from '../src/execution/VirtualWallet.js';

function makeTradeInput(overrides: Partial<Omit<TradeRecord, 'trade_id' | 'timestamp' | 'status' | 'resolution_price' | 'pnl'>> = {}) {
    return {
        mode: 'AI_SIGNAL' as const,
        market_id: '0xTEST_MARKET',
        outcome_token_id: '0xTOKEN',
        market_question: 'Will test pass?',
        category: TradeCategory.TECHNOLOGY,
        side: 'YES' as const,
        entry_price: 0.50,
        shares: 100,
        notional_cost: 50,
        simulated_fee: 0.50,
        signal_source: 'test',
        signal_confidence: 0.80,
        notes: 'test trade',
        stop_loss_price: 0.35,
        take_profit_price: 0.70,
        max_loss_pct: 0.30,
        market_end_date: '2026-12-31T00:00:00Z',
        ...overrides,
    };
}

describe('VirtualWallet', () => {
    let wallet: VirtualWallet;

    beforeEach(() => {
        wallet = new VirtualWallet(10000);
    });

    // ─── Initialization ────────────────────────────────
    describe('Initialization', () => {
        it('should start with correct balance', () => {
            expect(wallet.getBalance()).toBe(10000);
        });

        it('should track total deposited', () => {
            expect(wallet.getTotalDeposited()).toBe(10000);
        });

        it('should start with no trades', () => {
            expect(wallet.getTrades()).toHaveLength(0);
            expect(wallet.getOpenTrades()).toHaveLength(0);
            expect(wallet.getClosedTrades()).toHaveLength(0);
        });
    });

    // ─── Trade Logging ─────────────────────────────────
    describe('logTrade', () => {
        it('should deduct notional cost + fee from balance', () => {
            const input = makeTradeInput({ notional_cost: 100, simulated_fee: 1.0 });
            wallet.logTrade(input);
            expect(wallet.getBalance()).toBe(10000 - 101);
        });

        it('should create trade with OPEN status', () => {
            wallet.logTrade(makeTradeInput());
            const trades = wallet.getTrades();
            expect(trades).toHaveLength(1);
            expect(trades[0].status).toBe('OPEN');
        });

        it('should assign unique trade IDs', () => {
            const t1 = wallet.logTrade(makeTradeInput());
            const t2 = wallet.logTrade(makeTradeInput({ market_id: '0xOTHER' }));
            expect(t1.trade_id).not.toBe(t2.trade_id);
        });

        it('should throw on insufficient balance', () => {
            const input = makeTradeInput({ notional_cost: 15000, simulated_fee: 0 });
            expect(() => wallet.logTrade(input)).toThrow('Insufficient virtual balance');
        });

        it('should include timestamp', () => {
            const trade = wallet.logTrade(makeTradeInput());
            expect(trade.timestamp).toBeTruthy();
            expect(new Date(trade.timestamp).getTime()).not.toBeNaN();
        });

        it('should initialize pnl and resolution fields as null', () => {
            const trade = wallet.logTrade(makeTradeInput());
            expect(trade.pnl).toBeNull();
            expect(trade.resolution_price).toBeNull();
            expect(trade.exit_price).toBeNull();
            expect(trade.exit_reason).toBeNull();
        });
    });

    // ─── Trade Resolution ──────────────────────────────
    describe('resolveTrade', () => {
        it('should resolve a winning trade correctly', () => {
            const trade = wallet.logTrade(makeTradeInput({ entry_price: 0.50, shares: 100, notional_cost: 50, simulated_fee: 0.50 }));
            const balAfterEntry = wallet.getBalance();
            wallet.resolveTrade(trade.trade_id, true);

            const resolved = wallet.getTrades().find(t => t.trade_id === trade.trade_id)!;
            expect(resolved.status).toBe('CLOSED_WIN');
            expect(resolved.resolution_price).toBe(1.0);
            expect(resolved.pnl).toBeCloseTo(100 * 1.0 - 50 - 0.50, 2); // shares*1.0 - cost - fee = 49.50
            expect(wallet.getBalance()).toBe(balAfterEntry + 100); // balance gets payout (shares * $1)
        });

        it('should resolve a losing trade correctly', () => {
            const trade = wallet.logTrade(makeTradeInput({ notional_cost: 50, simulated_fee: 0.50 }));
            wallet.resolveTrade(trade.trade_id, false);

            const resolved = wallet.getTrades().find(t => t.trade_id === trade.trade_id)!;
            expect(resolved.status).toBe('CLOSED_LOSS');
            expect(resolved.resolution_price).toBe(0.0);
            expect(resolved.pnl).toBe(-50.50); // -(cost + fee)
        });

        it('should not resolve an already-closed trade', () => {
            const trade = wallet.logTrade(makeTradeInput());
            wallet.resolveTrade(trade.trade_id, true);
            const balBefore = wallet.getBalance();
            wallet.resolveTrade(trade.trade_id, false); // Should be ignored
            expect(wallet.getBalance()).toBe(balBefore);
        });
    });

    // ─── Close At Price ────────────────────────────────
    describe('closeTradeAtPrice', () => {
        it('should close with correct PnL at given price', () => {
            const trade = wallet.logTrade(makeTradeInput({ entry_price: 0.50, shares: 100, notional_cost: 50, simulated_fee: 0.50 }));
            wallet.closeTradeAtPrice(trade.trade_id, 0.60, 'TAKE_PROFIT');

            const closed = wallet.getTrades().find(t => t.trade_id === trade.trade_id)!;
            expect(closed.status).toBe('CLOSED_EXIT');
            expect(closed.exit_price).toBe(0.60);
            expect(closed.exit_reason).toBe('TAKE_PROFIT');
            expect(closed.pnl).toBeCloseTo(100 * 0.60 - 50 - 0.50, 2); // 60 - 50.50 = 9.50
        });

        it('should clamp exit price between 0 and 1', () => {
            const trade = wallet.logTrade(makeTradeInput());
            wallet.closeTradeAtPrice(trade.trade_id, 1.50, 'MANUAL_EXIT');
            const closed = wallet.getTrades().find(t => t.trade_id === trade.trade_id)!;
            expect(closed.exit_price).toBeLessThanOrEqual(1);
        });

        it('should add proceeds back to balance', () => {
            const trade = wallet.logTrade(makeTradeInput({ shares: 100 }));
            const balBefore = wallet.getBalance();
            wallet.closeTradeAtPrice(trade.trade_id, 0.70, 'STOP_LOSS');
            expect(wallet.getBalance()).toBe(balBefore + 100 * 0.70);
        });
    });

    // ─── Exposure Tracking ─────────────────────────────
    describe('Exposure tracking', () => {
        it('should track open exposure by market', () => {
            wallet.logTrade(makeTradeInput({ market_id: '0xA', notional_cost: 100, simulated_fee: 0 }));
            wallet.logTrade(makeTradeInput({ market_id: '0xA', notional_cost: 50, simulated_fee: 0 }));
            wallet.logTrade(makeTradeInput({ market_id: '0xB', notional_cost: 200, simulated_fee: 0 }));

            expect(wallet.getOpenExposureByMarket('0xA')).toBe(150);
            expect(wallet.getOpenExposureByMarket('0xB')).toBe(200);
            expect(wallet.getOpenExposureByMarket('0xC')).toBe(0);
        });

        it('should track open exposure by category', () => {
            wallet.logTrade(makeTradeInput({ category: TradeCategory.CRYPTO, notional_cost: 100, simulated_fee: 0 }));
            wallet.logTrade(makeTradeInput({ category: TradeCategory.CRYPTO, notional_cost: 50, simulated_fee: 0 }));
            wallet.logTrade(makeTradeInput({ category: TradeCategory.POLITICS, notional_cost: 200, simulated_fee: 0 }));

            expect(wallet.getOpenExposureByCategory(TradeCategory.CRYPTO)).toBe(150);
            expect(wallet.getOpenExposureByCategory(TradeCategory.POLITICS)).toBe(200);
        });

        it('should exclude closed trades from exposure', () => {
            const trade = wallet.logTrade(makeTradeInput({ market_id: '0xA', notional_cost: 100, simulated_fee: 0 }));
            expect(wallet.getOpenExposureByMarket('0xA')).toBe(100);

            wallet.resolveTrade(trade.trade_id, true);
            expect(wallet.getOpenExposureByMarket('0xA')).toBe(0);
        });
    });

    // ─── Conservative Equity ───────────────────────────
    describe('Conservative equity', () => {
        it('should equal balance when no trades open', () => {
            expect(wallet.getConservativeEquity()).toBe(10000);
        });

        it('should include open cost basis in equity', () => {
            wallet.logTrade(makeTradeInput({ notional_cost: 500, simulated_fee: 0 }));
            // Balance = 9500, open cost = 500 → equity = 10000
            expect(wallet.getConservativeEquity()).toBe(10000);
        });
    });

    // ─── High Water Mark ───────────────────────────────
    describe('updateHighWaterMark', () => {
        it('should update HWM when price exceeds current', () => {
            const trade = wallet.logTrade(makeTradeInput({ entry_price: 0.50 }));
            wallet.updateHighWaterMark(trade.trade_id, 0.55);
            const updated = wallet.getTrades().find(t => t.trade_id === trade.trade_id)!;
            expect(updated.high_water_mark).toBe(0.55);
        });

        it('should NOT update HWM when price is below current', () => {
            const trade = wallet.logTrade(makeTradeInput({ entry_price: 0.50 }));
            wallet.updateHighWaterMark(trade.trade_id, 0.55);
            wallet.updateHighWaterMark(trade.trade_id, 0.52);
            const updated = wallet.getTrades().find(t => t.trade_id === trade.trade_id)!;
            expect(updated.high_water_mark).toBe(0.55);
        });

        it('should activate trailing stop when price is 15%+ above entry', () => {
            const trade = wallet.logTrade(makeTradeInput({ entry_price: 0.50 }));
            wallet.updateHighWaterMark(trade.trade_id, 0.58); // +16%
            const updated = wallet.getTrades().find(t => t.trade_id === trade.trade_id)!;
            expect(updated.trailing_stop_active).toBe(true);
        });
    });

    // ─── Realized PnL Since ────────────────────────────
    describe('getRealizedPnlSince', () => {
        it('should sum PnL from trades closed after the given date', () => {
            const t1 = wallet.logTrade(makeTradeInput({ notional_cost: 50, simulated_fee: 0.50, shares: 100 }));
            wallet.resolveTrade(t1.trade_id, true); // Win: PnL = 100 - 50.50 = 49.50

            const since = new Date(Date.now() - 1000); // 1 second ago
            expect(wallet.getRealizedPnlSince(since)).toBeCloseTo(49.50, 1);
        });
    });
});
