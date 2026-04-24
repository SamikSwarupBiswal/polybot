export enum TradeCategory {
    GEOPOLITICS = 'GEOPOLITICS',
    POLITICS = 'POLITICS',
    FINANCE = 'FINANCE',
    TECHNOLOGY = 'TECHNOLOGY',
    SPORTS = 'SPORTS',
    CRYPTO = 'CRYPTO',
    OTHER = 'OTHER'
}

export class FeeSimulator {

    /**
     * Calculates the simulated fee for a paper trade based on execution type and category.
     * @param notionalUsd The total invested amount in USDC
     * @param isMaker True if placing a Limit Order (Maker), False if Market Order (Taker)
     * @param category The Polymarket categorisation of the specific market
     */
    static calculateFee(notionalUsd: number, isMaker: boolean, category: TradeCategory): number {
        // MAKER RULE: All Limit Orders have 0% fee across all categories.
        if (isMaker) return 0.0;

        // TAKER fees simulated matching Polymarket peak guidelines
        let rate = 0;
        switch (category) {
            case TradeCategory.GEOPOLITICS:
                rate = 0.00; // Geopolitics is currently 0% fee even for takers
                break;
            case TradeCategory.POLITICS:
            case TradeCategory.TECHNOLOGY:
                rate = 0.0100; // 1.00%
                break;
            case TradeCategory.FINANCE:
                rate = 0.0125; // Average 1.25%
                break;
            case TradeCategory.SPORTS:
                rate = 0.0075; // 0.75%
                break;
            case TradeCategory.CRYPTO:
                rate = 0.0180; // 1.80%
                break;
            default:
                rate = 0.0100; // Default 1% generic wrapper
                break;
        }

        return notionalUsd * rate;
    }
}
