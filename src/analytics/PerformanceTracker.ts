import { VirtualWallet } from '../execution/VirtualWallet.js';
import { TradeCategory } from '../execution/FeeSimulator.js';

export class PerformanceTracker {
    
    /**
     * Calculates the aggregate metrics for the current paper trading wallet.
     */
    static getMetrics(wallet: VirtualWallet) {
        const trades = wallet.getTrades();
        
        const totalTrades = trades.length;
        const closedTrades = wallet.getClosedTrades()
            .sort((a, b) => new Date(a.resolved_at || a.timestamp).getTime() - new Date(b.resolved_at || b.timestamp).getTime());
        const openTrades = wallet.getOpenTrades();
        const totalDeposited = wallet.getTotalDeposited();

        let wins = 0;
        let totalPnl = 0;
        let maxDrawdown = 0;
        
        // Mode separation
        type ModeStats = { count: number, wins: number, pnl: number, openVolume: number };
        const modes: Record<string, ModeStats> = {
            'COPY_TRADE': { count: 0, wins: 0, pnl: 0, openVolume: 0 },
            'AI_SIGNAL': { count: 0, wins: 0, pnl: 0, openVolume: 0 }
        };

        for (const t of openTrades) {
            if (modes[t.mode]) {
                modes[t.mode].openVolume += t.notional_cost;
                modes[t.mode].count += 1;
            }
        }

        let peakEquity = totalDeposited;
        let simulatedEquity = totalDeposited;
        
        for (const t of closedTrades) {
            const pnl = t.pnl || 0;
            if (t.status === 'CLOSED_WIN' || (t.status === 'CLOSED_EXIT' && pnl > 0)) {
                wins++;
                if (modes[t.mode]) modes[t.mode].wins++;
            }
            totalPnl += pnl;
            if (modes[t.mode]) modes[t.mode].pnl += pnl;

            simulatedEquity += pnl;
            if (simulatedEquity > peakEquity) peakEquity = simulatedEquity;

            const drawdown = peakEquity > 0 ? (peakEquity - simulatedEquity) / peakEquity : 0;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
        const roi = totalDeposited > 0 ? (totalPnl / totalDeposited) * 100 : 0;

        const categoryExposure = Object.values(TradeCategory).reduce<Record<string, number>>((acc, category) => {
            acc[category] = wallet.getOpenExposureByCategory(category);
            return acc;
        }, {});

        return {
            totalTrades,
            openTrades: openTrades.length,
            closedTrades: closedTrades.length,
            wins,
            totalDeposited,
            conservativeEquity: `$${wallet.getConservativeEquity().toFixed(2)}`,
            winRate: `${winRate.toFixed(2)}%`,
            totalPnl: `$${totalPnl.toFixed(2)}`,
            roi: `${roi.toFixed(2)}%`,
            maxDrawdown: `${(maxDrawdown * 100).toFixed(2)}%`,
            segmentation: modes,
            categoryExposure
        };
    }
}
