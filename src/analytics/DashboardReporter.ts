import { VirtualWallet } from '../execution/VirtualWallet.js';
import { PerformanceTracker } from './PerformanceTracker.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';

export class DashboardReporter {
    
    /**
     * Prints a tabular summary to the terminal.
     */
    static printTerminalDashboard(wallet: VirtualWallet) {
        const metrics = PerformanceTracker.getMetrics(wallet);
        
        const summary = [
            { Metric: "Total Balance", Value: `$${wallet.getBalance().toFixed(2)}` },
            { Metric: "All-Time ROI", Value: metrics.roi },
            { Metric: "Max Drawdown", Value: metrics.maxDrawdown },
            { Metric: "Open Trades", Value: metrics.openTrades.toString() },
            { Metric: "Overall Win Rate", Value: metrics.winRate }
        ];

        const modes = [
            { 
                Strategy: "Whale Copy", 
                "Open Vol": `$${metrics.segmentation['COPY_TRADE'].openVolume.toFixed(2)}`,
                "Wins": metrics.segmentation['COPY_TRADE'].wins,
                "Realized PnL": `$${metrics.segmentation['COPY_TRADE'].pnl.toFixed(2)}`
            },
            { 
                Strategy: "AI Predictor", 
                "Open Vol": `$${metrics.segmentation['AI_SIGNAL'].openVolume.toFixed(2)}`,
                "Wins": metrics.segmentation['AI_SIGNAL'].wins,
                "Realized PnL": `$${metrics.segmentation['AI_SIGNAL'].pnl.toFixed(2)}`
            }
        ];

        console.log("\n================ [ POLYBOT TERMINAL DASHBOARD ] ================");
        console.table(summary);
        console.log("\n--- Active Strategies ---");
        console.table(modes);
        console.log("================================================================\n");
    }

    /**
     * Dumps the state into a clean HTML file for dashboard viewing.
     */
    static generateHTMLReport(wallet: VirtualWallet) {
        const metrics = PerformanceTracker.getMetrics(wallet);
        const trades = [...wallet.getTrades()].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        let tradeRows = trades.map(t => {
            const hasPnl = t.pnl !== undefined && t.pnl !== null;
            const pnlValue = hasPnl ? t.pnl as number : 0;
            const pnlColor = hasPnl ? (pnlValue >= 0 ? '#10b981' : '#ef4444') : 'gray';
            const pnlString = hasPnl ? '$' + pnlValue.toFixed(2) : '-';
            const rowClass = t.status === 'OPEN' ? 'row-open' : (pnlValue > 0 ? 'row-win' : 'row-loss');
            const safeQuestion = DashboardReporter.escapeHtml(t.market_question);
            const safeMode = DashboardReporter.escapeHtml(t.mode.replace('_', ' '));
            const safeStatus = DashboardReporter.escapeHtml(t.status.replace('CLOSED_', ''));

            return `
            <tr class="${rowClass}">
                <td>${t.trade_id.substring(0,8)}</td>
                <td><span class="badge ${t.mode}">${safeMode}</span></td>
                <td>${safeQuestion}</td>
                <td>${t.side}</td>
                <td>$${t.entry_price.toFixed(3)}</td>
                <td>$${t.notional_cost.toFixed(2)}</td>
                <td>${safeStatus}</td>
                <td style="font-weight:bold; color: ${pnlColor}">${pnlString}</td>
            </tr>
        `}).join('');

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Polybot Terminal Report</title>
            <style>
                body {
                    font-family: 'Inter', -apple-system, sans-serif;
                    background-color: #0f172a;
                    color: #f8fafc;
                    margin: 0; padding: 40px;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                h1 {
                    font-size: 2.5rem;
                    background: linear-gradient(to right, #38bdf8, #818cf8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 30px;
                }
                .kpi-board {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin-bottom: 40px;
                }
                .kpi-card {
                    background: rgba(30, 41, 59, 0.7);
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid #334155;
                }
                .kpi-title { font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
                .kpi-value { font-size: 2rem; font-weight: bold; margin-top: 10px; }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    background: #1e293b;
                    border-radius: 12px;
                    overflow: hidden;
                }
                th { background: #0f172a; }
                th, td {
                    padding: 15px;
                    text-align: left;
                    border-bottom: 1px solid #334155;
                }
                .badge {
                    padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;
                }
                .COPY_TRADE { background: #3b82f633; color: #60a5fa; }
                .AI_SIGNAL { background: #8b5cf633; color: #a78bfa; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Polybot Paper Trading Run</h1>
                <div class="kpi-board">
                    <div class="kpi-card">
                        <div class="kpi-title">Total Balance</div>
                        <div class="kpi-value">$${wallet.getBalance().toFixed(2)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Win Rate</div>
                        <div class="kpi-value" style="color: #10b981">${metrics.winRate}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">All-Time ROI</div>
                        <div class="kpi-value">${metrics.roi}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Open Trades</div>
                        <div class="kpi-value">${metrics.openTrades}</div>
                    </div>
                </div>

                <h2>Trade Ledger</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Strategy</th><th>Market</th><th>Side</th><th>Entry</th><th>Size</th><th>Status</th><th>PnL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tradeRows}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
        `;

        fs.promises.writeFile('polybot-report.html', html, 'utf-8')
            .then(() => logger.info('Saved HTML dashboard to polybot-report.html'))
            .catch(err => logger.error(`Failed to save HTML report: ${err.message}`));
    }

    private static escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
