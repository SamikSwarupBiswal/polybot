import { describe, it, expect } from 'vitest';
import { FeeSimulator, TradeCategory } from '../src/execution/FeeSimulator.js';

describe('FeeSimulator', () => {

    describe('Maker fees', () => {
        it('should return 0% fee for all categories when maker', () => {
            const categories = Object.values(TradeCategory);
            for (const cat of categories) {
                const fee = FeeSimulator.calculateFee(1000, true, cat);
                expect(fee).toBe(0);
            }
        });

        it('should handle zero notional with maker flag', () => {
            expect(FeeSimulator.calculateFee(0, true, TradeCategory.CRYPTO)).toBe(0);
        });
    });

    describe('Taker fees by category', () => {
        const cases: [TradeCategory, number][] = [
            [TradeCategory.GEOPOLITICS, 0.0],       // 0%
            [TradeCategory.POLITICS, 0.01],          // 1.0%
            [TradeCategory.TECHNOLOGY, 0.01],        // 1.0%
            [TradeCategory.FINANCE, 0.0125],         // 1.25%
            [TradeCategory.SPORTS, 0.0075],          // 0.75%
            [TradeCategory.CRYPTO, 0.018],           // 1.8%
            [TradeCategory.OTHER, 0.01],             // 1.0% default
        ];

        it.each(cases)('should apply correct taker rate for %s', (category, expectedRate) => {
            const notional = 10000;
            const fee = FeeSimulator.calculateFee(notional, false, category);
            expect(fee).toBeCloseTo(notional * expectedRate, 2);
        });

        it('should scale linearly with notional size', () => {
            const small = FeeSimulator.calculateFee(100, false, TradeCategory.CRYPTO);
            const large = FeeSimulator.calculateFee(10000, false, TradeCategory.CRYPTO);
            expect(large / small).toBeCloseTo(100, 1);
        });
    });

    describe('Edge cases', () => {
        it('should handle very small notional', () => {
            const fee = FeeSimulator.calculateFee(0.01, false, TradeCategory.FINANCE);
            expect(fee).toBeGreaterThanOrEqual(0);
            expect(fee).toBeLessThan(0.01);
        });

        it('should return 0 for zero notional taker', () => {
            expect(FeeSimulator.calculateFee(0, false, TradeCategory.CRYPTO)).toBe(0);
        });
    });
});
