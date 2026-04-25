import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePolybotStore } from '../store/usePolybotStore';

export const ActiveBetGraph: React.FC = () => {
    const trades = usePolybotStore(state => state.trades);

    const data = useMemo(() => {
        // Create a cumulative PnL series over time from closed trades
        // We sort them chronologically
        const closedTrades = trades
            .filter(t => t.pnl !== null)
            .sort((a, b) => new Date(a.resolved_at || a.timestamp).getTime() - new Date(b.resolved_at || b.timestamp).getTime());

        let cumulative = 0;
        return closedTrades.map(t => {
            cumulative += (t.pnl || 0);
            return {
                time: new Date(t.resolved_at || t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                pnl: cumulative,
                market: t.market_id.substring(0, 8)
            };
        });
    }, [trades]);

    if (data.length === 0) {
        return (
            <div className="glass-panel" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="text-muted mono">NO HISTORICAL PNL DATA YET</p>
            </div>
        );
    }

    const currentPnl = data[data.length - 1].pnl;
    const isPositive = currentPnl >= 0;
    const strokeColor = isPositive ? 'var(--matrix-primary)' : 'var(--matrix-danger)';

    return (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '350px' }}>
            <h3 className="text-muted mb-4">Cumulative PnL Trajectory</h3>
            <div style={{ flex: 1, width: '100%', minHeight: '250px' }}>
                <ResponsiveContainer>
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.8}/>
                                <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 65, 0.1)" vertical={false} />
                        <XAxis 
                            dataKey="time" 
                            stroke="var(--matrix-text-muted)" 
                            fontSize={12} 
                            tickMargin={10} 
                            axisLine={false} 
                            tickLine={false} 
                        />
                        <YAxis 
                            stroke="var(--matrix-text-muted)" 
                            fontSize={12} 
                            tickFormatter={(val) => `$${val}`}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--matrix-bg-panel)', 
                                border: 'var(--panel-border)',
                                color: 'var(--matrix-text)',
                                borderRadius: '8px'
                            }}
                            itemStyle={{ color: 'var(--matrix-primary)' }}
                            formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'PnL']}
                            labelStyle={{ color: 'var(--matrix-text-muted)' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="pnl" 
                            stroke={strokeColor} 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorPnl)" 
                            animationDuration={1000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
