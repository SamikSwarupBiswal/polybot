import axios from 'axios';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

const GAMMA_API_URL = process.env.GAMMA_API_URL || 'https://gamma-api.polymarket.com';

export interface Market {
    condition_id: string;
    question: string;
    volume: string;
    tokens: { token_id: string; outcome: string }[];
}

export class MarketDataService {
    /**
     * Fetches active markets from Gamma API and filters by liquidity.
     * @param minVolume Minimum volume in USD
     * @returns Array of Markets meeting the threshold
     */
    static async getLiquidMarkets(minVolume: number = 50000): Promise<Market[]> {
        logger.info(`Fetching active markets with volume > $${minVolume}...`);
        try {
            // Polymarket Gamma API returns paginated events/markets. 
            // We use a general endpoint for MVP to find some top active ones.
            const response = await axios.get(`${GAMMA_API_URL}/markets`, {
                params: {
                    active: true,
                    closed: false,
                    limit: 100 // Limit for quick MVP test
                }
            });

            const allMarkets = response.data;
            const liquidMarkets = allMarkets.filter((market: any) => parseFloat(market.volume) >= minVolume);
            
            logger.info(`Found ${liquidMarkets.length} markets with > $${minVolume} volume.`);
            return liquidMarkets.map((market: any) => ({
                condition_id: market.condition_id,
                question: market.question,
                volume: market.volume,
                tokens: market.tokens
            }));
        } catch (error: any) {
            logger.error(`Error fetching markets from Gamma API: ${error.message}`);
            return [];
        }
    }
}
