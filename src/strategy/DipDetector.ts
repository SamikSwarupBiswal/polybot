import { logger } from '../utils/logger.js';

export interface DipSignal {
    tokenId: string;
    currentPrice: number;
    peakPrice: number;
    dropPct: number;
    timestamp: number;
}

export class DipDetector {
    // Maps tokenId -> array of {price, timestamp}
    private history: Map<string, { price: number; timestamp: number }[]> = new Map();
    private readonly windowMs: number;
    private readonly dipThreshold: number;

    /**
     * @param windowMs The sliding window for tracking recent peaks (default: 10000ms)
     * @param dipThreshold The required percentage drop from the peak to trigger a dip (default: 0.30 = 30%)
     */
    constructor(windowMs = 10000, dipThreshold = 0.30) {
        this.windowMs = windowMs;
        this.dipThreshold = dipThreshold;
    }

    public addPricePoint(tokenId: string, price: number): void {
        if (!this.history.has(tokenId)) {
            this.history.set(tokenId, []);
        }
        
        const series = this.history.get(tokenId)!;
        const now = Date.now();
        series.push({ price, timestamp: now });

        // Prune old data outside of the sliding window
        while (series.length > 0 && now - series[0].timestamp > this.windowMs) {
            series.shift();
        }
    }

    public detectDip(tokenId: string): DipSignal | null {
        const series = this.history.get(tokenId);
        if (!series || series.length < 2) return null;

        const currentPoint = series[series.length - 1];
        
        // Find the peak price within the window
        let peakPrice = series[0].price;
        for (const point of series) {
            if (point.price > peakPrice) {
                peakPrice = point.price;
            }
        }

        // Avoid division by zero
        if (peakPrice <= 0) return null;

        const dropPct = (peakPrice - currentPoint.price) / peakPrice;

        if (dropPct >= this.dipThreshold) {
            // Dip detected! But ensure we don't just spam the same dip if it stays low.
            // Actually, the DipArbStrategy handles state tracking to ensure one entry per dip.
            return {
                tokenId,
                currentPrice: currentPoint.price,
                peakPrice,
                dropPct,
                timestamp: currentPoint.timestamp
            };
        }

        return null;
    }
}
