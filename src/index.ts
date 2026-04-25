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
import { CalibrationTracker } from './analytics/CalibrationTracker.js';
import { MarketResearchRunner } from './research/MarketResearchRunner.js';
import { MarketResolutionMonitor } from './research/MarketResolutionMonitor.js';
import { PriceHistoryStore } from './data/PriceHistoryStore.js';
import { alertService, AlertLevel } from './utils/AlertService.js';
import { WebSocketService } from './data/WebSocketService.js';
import { DipDetector } from './strategy/DipDetector.js';
import { DipArbStrategy, TrackerMarket } from './strategy/DipArbStrategy.js';
import { FrontendServer } from './api/FrontendServer.js';
async function main() {
    logger.info('===================================================');
    logger.info(' POLYBOT MVP - Autonomous Paper Trading Engine');
    logger.info('===================================================');

    await alertService.sendAlert('Polybot System Startup', 'Engine initialized and entering observation mode.', AlertLevel.INFO);

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
    // AI Engine requires LLMSignalProvider, which is created by MarketResearchRunner.
    // So let's instantiate MarketResearchRunner first.
    const priceHistory = new PriceHistoryStore();
    const calibration = new CalibrationTracker();
    const researchRunner = new MarketResearchRunner({
        intervalMs: 15 * 60 * 1000,
        signalsPerCycle: 5,
        maxPages: 10,
        minVolumeUsd: 50000,
        priceHistory,
        calibration
    });

    const aiEngine = new AISignalEngine(researchRunner.getLLM());
    const aggregator = new SignalAggregator(monitor, aiEngine, executor, riskGate, wallet);

    // 4. Setup Research Layer with Tier 3 intelligence pipeline
    const resolutionMonitor = new MarketResolutionMonitor(wallet, 5 * 60 * 1000, calibration); // Shares calibration for outcome recording

    // Wire research runner signals into the aggregator
    aggregator.wireResearchRunner(researchRunner);

    // 4.5 Dip Arbitrage
    const wsService = new WebSocketService();
    const dipDetector = new DipDetector(10000, 0.30);
    const dipArbStrategy = new DipArbStrategy(wsService, dipDetector);

    researchRunner.on('marketsScanned', (markets: TrackerMarket[]) => {
        dipArbStrategy.trackMarkets(markets);
    });

    dipArbStrategy.on('signal', (signal) => aggregator.processSignal(signal));

    // 5. Start Event Flow
    newsService.on('news_headline', (headline: string) => aiEngine.processNews(headline));
    monitor.startPolling();
    newsService.startPolling();
    positionMonitor.startPolling();
    researchRunner.startPolling();
    resolutionMonitor.startPolling();
    wsService.connect();

    // 6. Dashboard & Frontend Heartbeat
    const frontendServer = new FrontendServer(3001);
    frontendServer.start(wallet);

    const dashboardInterval = setInterval(() => {
        DashboardReporter.printTerminalDashboard(wallet);
    }, 20000);

    const frontendInterval = setInterval(() => {
        frontendServer.pushSyncState(null, wallet);
    }, 5000); // 5 sec live sync

    // Graceful shutdown
    const shutdown = async () => {
        logger.info('Shutting down Polybot MVP...');
        clearInterval(dashboardInterval);
        clearInterval(frontendInterval);
        frontendServer.stop();
        
        monitor.stopPolling();
        newsService.stopPolling();
        positionMonitor.stopPolling();
        researchRunner.stopPolling();
        resolutionMonitor.stopPolling();
        wsService.disconnect();

        // Flush all persistent data synchronously before exit
        logger.info('Flushing persistent data...');
        wallet.save();
        priceHistory.saveSync();
        calibration.saveSync();

        // Log LLM API cost statistics
        const stats = researchRunner.getLLM().logSessionStats();

        // Final report generation
        DashboardReporter.printTerminalDashboard(wallet);
        DashboardReporter.generateHTMLReport(wallet);
        logger.info('All data saved. Goodbye!');
        
        await alertService.sendAlert(
            'Polybot System Shutdown', 
            `Graceful shutdown completed.\n**Final Balance:** $${wallet.getConservativeEquity().toFixed(2)}\n**LLM API Calls:** ${stats?.calls || 0}\n**Cost:** $${(stats?.costUsd || 0).toFixed(4)}`, 
            AlertLevel.CRITICAL
        );
        
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    logger.error('Unhandled fatal error in Polybot MVP: ' + err.message);
});
