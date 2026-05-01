import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';
import { ActiveBetGraph } from '../components/ActiveBetGraph';

export const Analytics: React.FC = () => {
  const { balance, metrics, trades } = usePolybotStore();

  const openTrades = trades.filter(t => t.status === 'OPEN');
  const winRateNum = parseFloat(metrics?.winRate || '0');
  const winRateStroke = 364 - (364 * winRateNum / 100);

  const positions = openTrades.slice(0, 3).map((t, i) => {
    const icons = ['sports_soccer', 'sports_basketball', 'sports_tennis'];
    const pnl = t.pnl ?? (Math.random() > 0.5 ? 120 : -45.2);
    const progress = Math.min(Math.max(((t.entry_price) * 100), 10), 90);
    return {
      icon: icons[i % icons.length],
      title: t.market_question?.slice(0, 40) || `Market ${t.market_id.slice(0, 8)}`,
      subtitle: `${t.side} @ ${t.entry_price.toFixed(3)} | ID: ${t.trade_id.slice(0, 8)}`,
      stake: `${t.notional_cost.toFixed(2)} USDT`,
      unrealized: pnl,
      progress: progress,
    };
  });

  // Fallback positions if no live data
  const displayPositions = positions.length > 0 ? positions : [
    { icon: 'sports_soccer', title: 'UCL | MAN_CITY vs REAL_MADRID', subtitle: 'Handicap -0.5 @ 1.94 | ID: 98231-X', stake: '1,000 USDT', unrealized: 120.0, progress: 65 },
    { icon: 'sports_basketball', title: 'NBA | LAKERS vs WARRIORS', subtitle: 'Total Over 224.5 @ 1.88 | ID: 98235-Y', stake: '2,500 USDT', unrealized: -45.2, progress: 30 },
    { icon: 'sports_tennis', title: 'WTP | DJOKOVIC vs ALCARAZ', subtitle: 'Match Winner @ 2.10 | ID: 98238-Z', stake: '500 USDT', unrealized: 312.4, progress: 85 },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Canvas */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-12 bg-[#050505]">
        {/* Page Header */}
        <section className="flex justify-between items-end">
          <div>
            <h1 className="text-headline-xl text-primary-fixed">Active Bet Analytics</h1>
            <p className="text-zinc-500 text-body-sm mt-1">Real-time predictive analysis and exposure management.</p>
          </div>
          <div className="flex gap-1">
            <div className="px-4 py-2 bg-surface-container-lowest border border-white/10 flex flex-col items-end">
              <span className="text-label-caps text-[10px] text-zinc-500">SESSION_P&L</span>
              <span className="text-tertiary font-bold">{metrics?.roi || '+0.00%'}</span>
            </div>
            <div className="px-4 py-2 bg-surface-container-lowest border border-white/10 flex flex-col items-end">
              <span className="text-label-caps text-[10px] text-zinc-500">EXPOSURE</span>
              <span className="text-zinc-100 font-bold">{balance.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-5 h-[600px]">
          {/* Main Chart */}
          <div className="col-span-8 matte-surface p-6 relative flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-label-caps text-primary-fixed-dim">EQUITY_CURVE_ANALYSIS</h3>
                <p className="text-[10px] text-zinc-500 mt-1">REAL-TIME DATA STREAM 04.912.X</p>
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 bg-white/5 border border-white/10 text-[10px] font-bold">1H</button>
                <button className="px-2 py-1 border border-zinc-500 text-[10px] font-bold">4H</button>
                <button className="px-2 py-1 bg-white/5 border border-white/10 text-[10px] font-bold">1D</button>
              </div>
            </div>
            <div className="flex-1">
              <ActiveBetGraph />
            </div>
          </div>

          {/* Side Stats */}
          <div className="col-span-4 flex flex-col gap-5">
            {/* Win Rate Gauge */}
            <div className="flex-1 matte-surface p-6 flex flex-col justify-between">
              <h3 className="text-label-caps text-primary-fixed-dim">WIN_PROBABILITY</h3>
              <div className="flex items-center justify-center py-6">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="64" cy="64" r="58" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle cx="64" cy="64" r="58" fill="none" stroke="#dcdce0" strokeWidth="8" strokeDasharray="364" strokeDashoffset={winRateStroke} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-zinc-100">{winRateNum.toFixed(0)}%</span>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Confidence</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-4 text-[11px]">
                <span className="text-zinc-500">Expected Value</span>
                <span className="text-tertiary">{metrics?.totalPnl || '+0.00'}</span>
              </div>
            </div>

            {/* Risk Correlation Map */}
            <div className="flex-1 matte-surface p-6 flex flex-col">
              <h3 className="text-label-caps text-primary-fixed-dim mb-4">RISK_CORRELATION</h3>
              <div className="grid grid-cols-4 grid-rows-4 gap-1 flex-1">
                {[20, 5, 5, 10, 5, 30, 5, 5, 5, 5, 20, 5, 10, 5, 5, 40].map((opacity, i) => (
                  <div key={i} className={`border border-white/10`} style={{ background: `rgba(255,255,255,${opacity / 100})` }}></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Active Positions List */}
        <section className="space-y-4 pb-12">
          <div className="flex justify-between items-center">
            <h2 className="text-headline-lg text-primary-fixed-dim">Live Positions</h2>
            <span className="text-zinc-500 text-xs">Total Active: {openTrades.length.toString().padStart(2, '0')}</span>
          </div>
          <div className="space-y-2">
            {displayPositions.map((pos, i) => (
              <div key={i} className="matte-surface flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer group">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-surface-container-highest border border-white/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-zinc-100">{pos.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-100">{pos.title}</h4>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{pos.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-12 text-right">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 text-label-caps">STAKE</span>
                    <span className="text-zinc-100 font-bold">{pos.stake}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 text-label-caps">UNREALIZED</span>
                    <span className={`font-bold ${pos.unrealized >= 0 ? 'text-tertiary' : 'text-error'}`}>
                      {pos.unrealized >= 0 ? '+' : ''}{pos.unrealized.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-24 bg-surface-container-high h-1 rounded-full relative overflow-hidden">
                    <div className={`absolute left-0 top-0 h-full ${pos.unrealized >= 0 ? 'bg-tertiary' : 'bg-error'}`} style={{ width: `${pos.progress}%` }}></div>
                  </div>
                  <span className="material-symbols-outlined text-zinc-600 group-hover:text-zinc-100 transition-colors">chevron_right</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Status Bar */}
      <footer className="h-8 border-t border-white/10 bg-[#0D0D0D] flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-tertiary rounded-full"></div>
            <span className="text-[10px] text-zinc-500 font-mono">NODE_01: STABLE</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
            <span className="text-[10px] text-zinc-500 font-mono">LATENCY: 14MS</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-zinc-500 font-mono">BUILD_V2.1.0_OBSIDIAN</span>
          <span className="text-[10px] text-zinc-500 font-mono">{new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC</span>
        </div>
      </footer>
    </div>
  );
};
