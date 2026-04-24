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

async function main() {
    logger.info('===================================================');
    logger.info(' POLYBOT MVP - Phase 5: Analytics & Dashboards');
    logger.info('===================================================');

    // 1. Initialize Virtual Wallet & Ledger
    const wallet = new VirtualWallet(10000); // Start with $10k

    // 2. Setup Paper Trader
    const executor = new PaperTradeExecutor(wallet);
    const positionMonitor = new PositionMonitor(wallet);

    // 3. Setup Strategy Components
    const riskGate = new RiskGate();
    const rawWallets = process.env.WHALE_WALLETS || '0xWHALE_QUALIFIED,0xWHALE_UNQUALIFIED';
    const monitor = new WhaleMonitor(rawWallets.split(','));
    const newsService = new NewsIngestionService();
    const aiEngine = new AISignalEngine();
    const aggregator = new SignalAggregator(monitor, aiEngine, executor, riskGate, wallet);

    // 4. Start Event Flow
    newsService.on('news_headline', (headline: string) => aiEngine.processNews(headline));
    monitor.startPolling();
    newsService.startPolling();
    positionMonitor.startPolling();

    // 5. Dashboard Heartbeat. Paper trades should only resolve from a real
    // market-resolution path or explicit test helper, never random outcomes.
    const dashboardInterval = setInterval(() => {
        DashboardReporter.printTerminalDashboard(wallet);
    }, 20000);

    // Prevent immediate exit during testing loop
    process.on('SIGINT', () => {
        logger.info('Shutting down Polybot MVP Phase 5...');
        clearInterval(dashboardInterval);
        monitor.stopPolling();
        newsService.stopPolling();
        positionMonitor.stopPolling();
        
        // Final report generation
        DashboardReporter.printTerminalDashboard(wallet);
        DashboardReporter.generateHTMLReport(wallet);
        logger.info('Goodbye!');
        process.exit(0);
    });
}

main().catch((err) => {
    logger.error('Unhandled fatal error in Phase 2 setup: ' + err.message);
});
