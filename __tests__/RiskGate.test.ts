import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradeCategory } from '../src/execution/FeeSimulator.js';

// Mock fs and logger before importing modules that use them
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

// Mock PerformanceTracker since RiskGate uses it internally
vi.mock('../src/analytics/PerformanceTracker.js', () => ({
    PerformanceTracker: {
        getMetrics: vi.fn(() => ({
            maxDrawdown: '5.00%',
            winRate: '0.60',
            totalTrades: 10,
        }))
    }
}));

import { RiskGate, TradeSignal } from '../src/execution/RiskGate.js';
import { VirtualWallet } from '../src/execution/VirtualWallet.js';
import { PerformanceTracker } from '../src/analytics/PerformanceTracker.js';

function makeSignal(overrides: Partial<TradeSignal> = {}): TradeSignal {
    return {
        mode: 'AI_SIGNAL',
        market_id: '0xTEST',
        market_question: 'Test?',
        category: TradeCategory.TECHNOLOGY,
        side: 'YES',
        requested_price: 0.50,
        recommended_size_usd: 100,
        source: 'test',
        confidence: 0.80,
        force_maker: true,
        market_volume_usd: 100000,
        market_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        current_market_price: 0.50,
        model_probability: 0.60,
        ...overrides,
    };
}

describe('RiskGate', () => {
    let gate: RiskGate;
    let wallet: VirtualWallet;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset PerformanceTracker mock to healthy state
        vi.mocked(PerformanceTracker.getMetrics).mockReturnValue({
            maxDrawdown: '5.00%',
            winRate: '0.60',
            totalTrades: 10,
            openTrades: 2,
            closedTrades: 8,
            wins: 5,
            losses: 3,
            roi: '12.00%',
            strategyBreakdown: {},
            categoryExposure: {}
        } as any);

        gate = new RiskGate();
        wallet = new VirtualWallet(10000);
    });

    // ─── Drawdown Halt ─────────────────────────────────
    describe('Drawdown halt', () => {
        it('should block trades when drawdown exceeds limit', () => {
            vi.mocked(PerformanceTracker.getMetrics).mockReturnValue({
                maxDrawdown: '30.00%', // > 25% default limit
            } as any);

            const size = gate.evaluateSignal(makeSignal(), wallet);
            expect(size).toBe(0);
        });

        it('should allow trades when drawdown is within limit', () => {
            vi.mocked(PerformanceTracker.getMetrics).mockReturnValue({
                maxDrawdown: '10.00%',
            } as any);

            const size = gate.evaluateSignal(makeSignal(), wallet);
            expect(size).toBeGreaterThan(0);
        });
    });

    // ─── Position Limits ───────────────────────────────
    describe('Position limits', () => {
        it('should block when max open positions reached', () => {
            // Fill wallet with 15 open trades
            for (let i = 0; i < 15; i++) {
                wallet.logTrade({
                    mode: 'AI_SIGNAL', market_id: `0xM${i}`, market_question: `Q${i}`,
                    category: TradeCategory.OTHER, side: 'YES', entry_price: 0.50,
                    shares: 10, notional_cost: 5, simulated_fee: 0,
                    signal_source: 'test', signal_confidence: 0.80, notes: '',
                    stop_loss_price: 0.30, take_profit_price: 0.70,
                });
            }

            const size = gate.evaluateSignal(makeSignal(), wallet);
            expect(size).toBe(0);
        });
    });

    // ─── Confidence Threshold ──────────────────────────
    describe('Confidence threshold', () => {
        it('should block signals with confidence below 0.60', () => {
            const size = gate.evaluateSignal(makeSignal({ confidence: 0.55 }), wallet);
            expect(size).toBe(0);
        });

        it('should allow signals with confidence at 0.60', () => {
            const size = gate.evaluateSignal(makeSignal({ confidence: 0.60 }), wallet);
            expect(size).toBeGreaterThan(0);
        });
    });

    // ─── Volume Filter ─────────────────────────────────
    describe('Volume filter', () => {
        it('should block markets with insufficient volume', () => {
            const size = gate.evaluateSignal(makeSignal({ market_volume_usd: 10000 }), wallet);
            expect(size).toBe(0);
        });

        it('should block when volume is missing', () => {
            const size = gate.evaluateSignal(makeSignal({ market_volume_usd: undefined }), wallet);
            expect(size).toBe(0);
        });
    });

    // ─── Time to Resolution ────────────────────────────
    describe('Time to resolution', () => {
        it('should block markets resolving within 48h', () => {
            const nearEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
            const size = gate.evaluateSignal(makeSignal({ market_end_date: nearEnd }), wallet);
            expect(size).toBe(0);
        });

        it('should block when end date is missing', () => {
            const size = gate.evaluateSignal(makeSignal({ market_end_date: undefined }), wallet);
            expect(size).toBe(0);
        });
    });

    // ─── Whale Copy Trade Filter ───────────────────────
    describe('Whale copy trade filter', () => {
        it('should block whale trades below conviction threshold', () => {
            const size = gate.evaluateSignal(makeSignal({
                mode: 'COPY_TRADE',
                whale_trade_size_usd: 1000 // Below $5000 minimum
            }), wallet);
            expect(size).toBe(0);
        });
    });

    // ─── Position Sizing ───────────────────────────────
    describe('Position sizing', () => {
        it('should return a positive size for valid signals', () => {
            const size = gate.evaluateSignal(makeSignal(), wallet);
            expect(size).toBeGreaterThan(0);
        });

        it('should not exceed recommended size', () => {
            const size = gate.evaluateSignal(makeSignal({ recommended_size_usd: 50 }), wallet);
            expect(size).toBeLessThanOrEqual(50);
        });

        it('should not exceed available balance', () => {
            // Drain most of the wallet
            wallet.logTrade({
                mode: 'AI_SIGNAL', market_id: '0xDRAIN', market_question: 'Drain',
                category: TradeCategory.OTHER, side: 'YES', entry_price: 0.50,
                shares: 19600, notional_cost: 9800, simulated_fee: 0,
                signal_source: 'test', signal_confidence: 0.80, notes: '',
            });

            const remaining = wallet.getBalance();
            const size = gate.evaluateSignal(makeSignal({ recommended_size_usd: 5000 }), wallet);
            expect(size).toBeLessThanOrEqual(remaining);
        });

        it('should block if approved size falls below minimum trade size', () => {
            // Create a situation where sizing produces very small trades
            const tinySignal = makeSignal({
                confidence: 0.60,
                recommended_size_usd: 5, // Below $10 minimum after caps
            });
            const size = gate.evaluateSignal(tinySignal, wallet);
            // Either 0 (blocked) or >= $10 (minimum)
            if (size > 0) expect(size).toBeGreaterThanOrEqual(10);
        });

        it('should cap whale copy trades at maxWhaleFollowUsd', () => {
            const size = gate.evaluateSignal(makeSignal({
                mode: 'COPY_TRADE',
                whale_trade_size_usd: 50000,
                recommended_size_usd: 5000
            }), wallet);
            expect(size).toBeLessThanOrEqual(2000); // Default maxWhaleFollowUsd
        });
    });
});
