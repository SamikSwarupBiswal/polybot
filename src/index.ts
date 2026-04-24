import dotenv from 'dotenv';
dotenv.config();

import { logger } from './utils/logger.js';
import { VirtualWallet } from './execution/VirtualWallet.js';
import { PaperTradeExecutor } from './execution/PaperTradeExecutor.js';
import { PositionMonitor } from './execution/PositionMonitor.js';
import { WhaleMonitor } from './data/WhaleMonitor.js';
import { RiskGate } from './execution/RiskGate.js';
import { SignalAggregator } from './execution/SignalAggregator.js';
import { NewsIngestionService } from './data/NewsIngestionService.js';
import { AISignalEngine } from './strategy/AISignalEngine.js';
import { DashboardReporter } from './analytics/DashboardReporter.js';
import { MarketResearchRunner } from './research/MarketResearchRunner.js';
import { MarketResolutionMonitor } from './research/MarketResolutionMonitor.js';

async function main() {
    logger.info('===================================================');
    logger.info(' POLYBOT MVP - Autonomous Paper Trading Engine');
    logger.info('===================================================');

    // 1. Initialize Virtual Wallet & Ledger
    const wallet = new VirtualWallet(10000); // Start with $10k

    // 2. Setup Paper Trader & Position Monitor
    const executor = new PaperTradeExecutor(wallet);
    const positionMonitor = new PositionMonitor(wallet);

    // 3. Setup Strategy Components
    const riskGate = new RiskGate();
    const rawWallets = process.env.WHALE_WALLETS || '0xWHALE_QUALIFIED,0xWHALE_UNQUALIFIED';
    const monitor = new WhaleMonitor(rawWallets.split(','));
    const newsService = new NewsIngestionService();
    const aiEngine = new AISignalEngine();
    const aggregator = new SignalAggregator(monitor, aiEngine, executor, riskGate, wallet);

    // 4. Setup Research Layer (NEW: scans real Polymarket for opportunities)
    const researchRunner = new MarketResearchRunner({
        intervalMs: 15 * 60 * 1000,  // Scan every 15 minutes
        signalsPerCycle: 5,           // Emit up to 5 signals per cycle
        maxPages: 10,                 // Scan up to 1000 markets
        minVolumeUsd: 50000           // Only markets with >= $50K volume
    });
    const resolutionMonitor = new MarketResolutionMonitor(wallet, 5 * 60 * 1000); // Check resolutions every 5 min

    // Wire research runner signals into the aggregator
    aggregator.wireResearchRunner(researchRunner);

    // 5. Start Event Flow
    newsService.on('news_headline', (headline: string) => aiEngine.processNews(headline));
    monitor.startPolling();
    newsService.startPolling();
    positionMonitor.startPolling();
    researchRunner.startPolling();
    resolutionMonitor.startPolling();

    // 6. Dashboard Heartbeat
    const dashboardInterval = setInterval(() => {
        DashboardReporter.printTerminalDashboard(wallet);
    }, 20000);

    // Graceful shutdown
    process.on('SIGINT', () => {
        logger.info('Shutting down Polybot MVP...');
        clearInterval(dashboardInterval);
        monitor.stopPolling();
        newsService.stopPolling();
        positionMonitor.stopPolling();
        researchRunner.stopPolling();
        resolutionMonitor.stopPolling();

        // Final report generation
        DashboardReporter.printTerminalDashboard(wallet);
        DashboardReporter.generateHTMLReport(wallet);
        logger.info('Goodbye!');
        process.exit(0);
    });
}

main().catch((err) => {
    logger.error('Unhandled fatal error in Polybot MVP: ' + err.message);
});
