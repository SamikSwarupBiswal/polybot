import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExitStrategy, ExitReason } from '../src/execution/ExitStrategy.js';
import { TradeRecord } from '../src/execution/VirtualWallet.js';
import { TradeCategory } from '../src/execution/FeeSimulator.js';

// Suppress logger output during tests
vi.mock('../src/utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), verbose: vi.fn(), error: vi.fn() }
}));

function makeTrade(overrides: Partial<TradeRecord> = {}): TradeRecord {
    return {
        trade_id: 'test-trade-001',
        mode: 'AI_SIGNAL',
        market_id: '0xMARKET',
        market_question: 'Test market?',
        category: TradeCategory.TECHNOLOGY,
        side: 'YES',
        entry_price: 0.50,
        shares: 100,
        notional_cost: 50,
        simulated_fee: 0.50,
        signal_source: 'test',
        signal_confidence: 0.80,
        timestamp: new Date().toISOString(),
        status: 'OPEN',
        resolution_price: null,
        pnl: null,
        notes: '',
        stop_loss_price: 0.35,
        take_profit_price: 0.70,
        max_loss_pct: 0.30,
        market_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days out
        ...overrides,
    };
}

describe('ExitStrategy', () => {

    // ─── Stop Loss ─────────────────────────────────────
    describe('Stop Loss', () => {
        it('should trigger when price at or below stop loss', () => {
            const trade = makeTrade({ stop_loss_price: 0.35 });
            const result = ExitStrategy.evaluate(trade, 0.35, 0.50);
            expect(result).not.toBeNull();
            expect(result!.reason).toBe('STOP_LOSS');
        });

        it('should trigger when price well below stop loss', () => {
            const trade = makeTrade({ stop_loss_price: 0.35 });
            const result = ExitStrategy.evaluate(trade, 0.10, 0.50);
            expect(result!.reason).toBe('STOP_LOSS');
        });

        it('should NOT trigger when price above stop loss', () => {
            const trade = makeTrade({ stop_loss_price: 0.35 });
            const result = ExitStrategy.evaluate(trade, 0.40, 0.50);
            // Should not be stop loss (could be null or another reason)
            if (result) expect(result.reason).not.toBe('STOP_LOSS');
        });

        it('should skip stop loss check if no stop_loss_price set', () => {
            const trade = makeTrade({ stop_loss_price: undefined });
            const result = ExitStrategy.evaluate(trade, 0.10, 0.50);
            if (result) expect(result.reason).not.toBe('STOP_LOSS');
        });
    });

    // ─── Take Profit ───────────────────────────────────
    describe('Take Profit', () => {
        it('should trigger when price at or above take profit', () => {
            const trade = makeTrade({ take_profit_price: 0.70 });
            const result = ExitStrategy.evaluate(trade, 0.70, 0.70);
            expect(result).not.toBeNull();
            expect(result!.reason).toBe('TAKE_PROFIT');
        });

        it('should NOT trigger when price below take profit', () => {
            const trade = makeTrade({ take_profit_price: 0.70 });
            const result = ExitStrategy.evaluate(trade, 0.60, 0.60);
            if (result) expect(result.reason).not.toBe('TAKE_PROFIT');
        });
    });

    // ─── Trailing Stop ─────────────────────────────────
    describe('Trailing Stop', () => {
        it('should NOT activate when HWM profit is below 15% activation threshold', () => {
            // Entry 0.50, HWM 0.55 (+10%) — below 15% threshold
            const trade = makeTrade({ entry_price: 0.50, stop_loss_price: undefined, take_profit_price: undefined });
            const result = ExitStrategy.evaluate(trade, 0.45, 0.55);
            if (result) expect(result.reason).not.toBe('TRAILING_STOP');
        });

        it('should trigger when price drops below trailing threshold from HWM', () => {
            // Entry 0.50, HWM 0.60 (+20% > 15% threshold), current 0.50
            // Trailing stop = 0.60 * (1 - 0.15) = 0.51 for normal conviction
            const trade = makeTrade({
                entry_price: 0.50,
                stop_loss_price: undefined,
                take_profit_price: undefined,
                max_loss_pct: 0.30 // Normal conviction → 15% trailing
            });
            const result = ExitStrategy.evaluate(trade, 0.49, 0.60);
            expect(result).not.toBeNull();
            expect(result!.reason).toBe('TRAILING_STOP');
        });

        it('should use tighter trailing for high conviction trades', () => {
            // High conviction (max_loss_pct >= 0.50) → 10% trailing
            // Entry 0.50, HWM 0.60, trailing stop = 0.60 * 0.90 = 0.54
            const trade = makeTrade({
                entry_price: 0.50,
                stop_loss_price: undefined,
                take_profit_price: undefined,
                max_loss_pct: 0.50 // High conviction → 10% trailing
            });
            // Price 0.53 < trailing 0.54 → should trigger
            const result = ExitStrategy.evaluate(trade, 0.53, 0.60);
            expect(result).not.toBeNull();
            expect(result!.reason).toBe('TRAILING_STOP');
        });
    });

    // ─── Time Exit ─────────────────────────────────────
    describe('Time Exit', () => {
        it('should trigger when market resolves within 24h', () => {
            const endDate = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12h out
            const trade = makeTrade({
                market_end_date: endDate,
                stop_loss_price: undefined,
                take_profit_price: undefined
            });
            const result = ExitStrategy.evaluate(trade, 0.50, 0.50);
            expect(result).not.toBeNull();
            expect(result!.reason).toBe('TIME_EXIT');
        });

        it('should NOT trigger when market is far from resolution', () => {
            const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days out
            const trade = makeTrade({
                market_end_date: endDate,
                stop_loss_price: undefined,
                take_profit_price: undefined
            });
            const result = ExitStrategy.evaluate(trade, 0.50, 0.50);
            if (result) expect(result.reason).not.toBe('TIME_EXIT');
        });

        it('should NOT trigger when market_end_date is missing', () => {
            const trade = makeTrade({
                market_end_date: undefined,
                stop_loss_price: undefined,
                take_profit_price: undefined
            });
            const result = ExitStrategy.evaluate(trade, 0.50, 0.50);
            if (result) expect(result.reason).not.toBe('TIME_EXIT');
        });
    });

    // ─── Stale Signal Decay ────────────────────────────
    describe('Stale Signal Decay', () => {
        it('should NOT trigger for recent trades', () => {
            const trade = makeTrade({
                timestamp: new Date().toISOString(), // Just now
                signal_confidence: 0.80,
                stop_loss_price: undefined,
                take_profit_price: undefined
            });
            const result = ExitStrategy.evaluate(trade, 0.50, 0.50);
            if (result) expect(result.reason).not.toBe('STALE_SIGNAL');
        });

        it('should trigger when effective confidence decays below 0.40', () => {
            // Confidence 0.60, 21-day half-life, after 21 days: 0.60 * (1 - 1) = 0.60 * max(0.30, 0) = 0.18 < 0.40
            const oldTimestamp = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
            const trade = makeTrade({
                timestamp: oldTimestamp,
                signal_confidence: 0.60,
                stop_loss_price: undefined,
                take_profit_price: undefined,
                market_end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
            });
            const result = ExitStrategy.evaluate(trade, 0.50, 0.50);
            expect(result).not.toBeNull();
            expect(result!.reason).toBe('STALE_SIGNAL');
        });
    });

    // ─── Priority Order ────────────────────────────────
    describe('Priority ordering', () => {
        it('should prioritize stop loss over take profit when both are triggered', () => {
            // Price at 0.30: below stop (0.35) AND we set TP very low too
            const trade = makeTrade({
                stop_loss_price: 0.35,
                take_profit_price: 0.25 // absurd TP below current
            });
            const result = ExitStrategy.evaluate(trade, 0.30, 0.30);
            expect(result!.reason).toBe('STOP_LOSS');
        });
    });

    // ─── Utility Methods ───────────────────────────────
    describe('calculateTakeProfitPrice', () => {
        it('should calculate conservative TP for low max-loss trades', () => {
            const tp = ExitStrategy.calculateTakeProfitPrice(0.50, 0.25);
            expect(tp).toBeCloseTo(0.65, 2); // 0.50 * 1.30
        });

        it('should calculate high conviction TP for high max-loss trades', () => {
            const tp = ExitStrategy.calculateTakeProfitPrice(0.50, 0.50);
            expect(tp).toBeCloseTo(0.80, 2); // 0.50 * 1.60
        });

        it('should calculate normal TP for default max-loss', () => {
            const tp = ExitStrategy.calculateTakeProfitPrice(0.50, 0.30);
            expect(tp).toBeCloseTo(0.70, 2); // 0.50 * 1.40
        });

        it('should clamp TP at 0.999 for high entry prices', () => {
            const tp = ExitStrategy.calculateTakeProfitPrice(0.90, 0.50);
            expect(tp).toBeLessThanOrEqual(0.999);
        });
    });

    describe('getEffectiveConfidence', () => {
        it('should return original confidence for brand-new trades', () => {
            const trade = makeTrade({ signal_confidence: 0.85, timestamp: new Date().toISOString() });
            const eff = ExitStrategy.getEffectiveConfidence(trade);
            expect(eff).toBeCloseTo(0.85, 1);
        });

        it('should decay confidence over time', () => {
            const oldTimestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
            const trade = makeTrade({ signal_confidence: 0.85, timestamp: oldTimestamp });
            const eff = ExitStrategy.getEffectiveConfidence(trade);
            expect(eff).toBeLessThan(0.85);
            expect(eff).toBeGreaterThan(0);
        });

        it('should floor at 30% of original confidence', () => {
            // Very old trade — 100 days ago
            const veryOld = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
            const trade = makeTrade({ signal_confidence: 0.80, timestamp: veryOld });
            const eff = ExitStrategy.getEffectiveConfidence(trade);
            expect(eff).toBeCloseTo(0.80 * 0.30, 1); // Floor: 30% of original
        });
    });
});
