import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

const MOCKS_ENABLED = process.env.ENABLE_MOCKS === 'true';

export class NewsIngestionService extends EventEmitter {
    private intervalId: NodeJS.Timeout | null = null;
    
    // Mock Headlines representing sudden events
    private mockHeadlines = [
        "BREAKING: Apple unexpectedly announces Smart Ring prototype, launching Q1 2026",
        "OpenAI secures additional 5 Billion funding round from Microsoft",
        "Senate unexpectedly passes new Crypto regulatory framework",
        "Federal Reserve cuts interest rates by unprecedented 75 basis points",
        "SpaceX successfully lands Starship on Mars in historic mission"
    ];

    constructor() {
        super();
        if (MOCKS_ENABLED) {
            logger.info('NewsIngestionService initialized (MOCK MODE — set ENABLE_MOCKS=false to disable).');
        } else {
            logger.info('NewsIngestionService initialized (mocks disabled — no fake headlines will be generated).');
        }
    }

    public startPolling() {
        if (!MOCKS_ENABLED) {
            logger.info('[NewsIngestion] Skipping mock polling — ENABLE_MOCKS is not true. Wire a real news API here.');
            return;
        }

        logger.info('Starting 25-second News Ingestion polling sequence (accelerated for testing)...');
        
        // Randomly fetch a news item every 25 seconds
        this.intervalId = setInterval(() => {
            this.pollNews();
        }, 25000);
    }

    public stopPolling() {
        if (this.intervalId) clearInterval(this.intervalId);
        logger.info('Stopped News Ingestion polling.');
    }

    private pollNews() {
        logger.verbose('Checking RSS Feeds / NewsAPI for breaking headlines...');
        
        // 30% chance per interval that a major breaking news headline drops
        if (Math.random() < 0.30) {
            const headlineIndex = Math.floor(Math.random() * this.mockHeadlines.length);
            const headline = this.mockHeadlines[headlineIndex];
            
            logger.info(`[NewsIngestion] 📰 NEWS EVENT: "${headline}"`);
            this.emit('news_headline', headline);
        }
    }
}
