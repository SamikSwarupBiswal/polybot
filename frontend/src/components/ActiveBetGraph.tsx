import React, { useMemo } from 'react';
import { usePolybotStore } from '../store/usePolybotStore';
import { XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';

export const ActiveBetGraph: React.FC = () => {
  const { trades } = usePolybotStore();

  const equityData = useMemo(() => {
    const closedTrades = trades
      .filter(t => t.status !== 'OPEN')
      .sort((a, b) => new Date(a.resolved_at || a.timestamp).getTime() - new Date(b.resolved_at || b.timestamp).getTime());

    if (closedTrades.length === 0) {
      // Generate placeholder data
      return Array.from({ length: 20 }, (_, i) => ({
        idx: i,
        equity: 10000 + Math.random() * 500 * (i / 10),
      }));
    }

    let equity = 10000;
    return closedTrades.map((t, i) => {
      equity += (t.pnl || 0);
      return {
        idx: i,
        equity: parseFloat(equity.toFixed(2)),
      };
    });
  }, [trades]);

  return (
    <div className="w-full h-[280px] relative">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={equityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dcdce0" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#dcdce0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="idx" hide />
          <YAxis
            hide
            domain={['dataMin - 100', 'dataMax + 100']}
          />
          <Tooltip
            contentStyle={{
              background: '#0D0D0D',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '2px',
              color: '#e5e2e1',
              fontSize: '11px',
              fontFamily: 'Inter',
            }}
            labelStyle={{ display: 'none' }}
            formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Equity']}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#dcdce0"
            strokeWidth={2}
            fill="url(#equityGrad)"
            dot={false}
            activeDot={{ r: 3, fill: '#dcdce0', stroke: '#050505', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {/* Y-axis labels */}
      <div className="absolute top-0 left-0 h-full flex flex-col justify-between text-[10px] text-zinc-600 font-mono py-2">
        <span>${Math.max(...equityData.map(d => d.equity)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        <span>${Math.min(...equityData.map(d => d.equity)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
};
