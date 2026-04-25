import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';

export const BetAnalytics: React.FC = () => {
  const { balance, trades, metrics, connected } = usePolybotStore();
  const openTrades = trades.filter((t) => t.status === 'OPEN');
  const totalExposure = openTrades.reduce((sum, t) => sum + t.notional_cost, 0);
  const winRateNum = parseFloat(metrics?.winRate || '0');
  const circumference = 364;
  const winRateOffset = circumference - (circumference * winRateNum / 100);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#050505] text-[#e5e2e1] p-5 md:p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <section className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-[#e2e2e6]">Active Bet Analytics</h1>
            <p className="text-zinc-500 text-sm mt-1">Real-time predictive analysis and exposure management.</p>
          </div>
          <div className="flex gap-2">
            <div className="matte-surface px-4 py-2 flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">SESSION_P&L</span>
              <span className={`font-bold ${parseFloat(metrics?.roi || '0') >= 0 ? 'text-[#aae9cf]' : 'text-[#ffb4ab]'}`}>{metrics?.roi || '0.0%'}</span>
            </div>
            <div className="matte-surface px-4 py-2 flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">EXPOSURE</span>
              <span className="text-zinc-100 font-bold">{totalExposure.toFixed(2)}</span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-12 gap-5 h-[520px]">
          <div className="col-span-8 matte-surface p-6 relative flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xs tracking-[0.1em] font-semibold text-[#c6c6ca]">EQUITY_CURVE_ANALYSIS</h3>
                <p className="text-[10px] text-zinc-500 mt-1 uppercase">REAL-TIME DATA STREAM 04.912.X</p>
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 bg-white/5 border border-white/10 text-[10px] font-bold">1H</button>
                <button className="px-2 py-1 border border-zinc-500 text-[10px] font-bold">4H</button>
                <button className="px-2 py-1 bg-white/5 border border-white/10 text-[10px] font-bold">1D</button>
              </div>
            </div>
            <div className="flex-1 relative">
              <svg className="w-full h-full opacity-60" preserveAspectRatio="none" viewBox="0 0 800 300">
                <defs>
                  <linearGradient id="chartGradientAnalytics" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,250 L50,230 L100,240 L150,210 L200,220 L250,180 L300,190 L350,150 L400,160 L450,120 L500,130 L550,90 L600,100 L650,60 L700,70 L750,30 L800,40 V300 H0 Z" fill="url(#chartGradientAnalytics)" />
                <path d="M0,250 L50,230 L100,240 L150,210 L200,220 L250,180 L300,190 L350,150 L400,160 L450,120 L500,130 L550,90 L600,100 L650,60 L700,70 L750,30 L800,40" fill="none" stroke="#dcdce0" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </div>

          <div className="col-span-4 flex flex-col gap-5">
            <div className="flex-1 matte-surface p-6 flex flex-col justify-between">
              <h3 className="text-xs tracking-[0.1em] font-semibold text-[#c6c6ca]">WIN_PROBABILITY</h3>
              <div className="flex items-center justify-center py-6">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="64" cy="64" fill="none" r="58" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle cx="64" cy="64" fill="none" r="58" stroke="#dcdce0" strokeDasharray={circumference} strokeDashoffset={winRateOffset} strokeWidth="8" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-zinc-100">{metrics?.winRate || '0%'}</span>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Confidence</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-4 text-[11px]">
                <span className="text-zinc-500">Expected Value</span>
                <span className="text-[#aae9cf]">+0.14</span>
              </div>
            </div>

            <div className="flex-1 matte-surface p-6 flex flex-col">
              <h3 className="text-xs tracking-[0.1em] font-semibold text-[#c6c6ca] mb-4">RISK_CORRELATION</h3>
              <div className="grid grid-cols-4 grid-rows-4 gap-1 flex-1">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={`${i % 5 === 0 ? 'bg-white/30' : 'bg-white/5'} border border-white/10`}></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl text-[#c6c6ca] font-medium tracking-tight">Live Positions</h2>
            <span className="text-zinc-500 text-xs">Total Active: {String(openTrades.length).padStart(2, '0')}</span>
          </div>
          <div className="space-y-2">
            {openTrades.length === 0 ? (
              <div className="matte-surface p-8 text-center">
                <span className="text-zinc-600 text-sm mono">NO ACTIVE POSITIONS</span>
              </div>
            ) : (
              openTrades.slice(0, 4).map((trade) => (
                <div key={trade.trade_id} className="matte-surface flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                  <div>
                    <h4 className="font-bold text-zinc-100">{trade.market_question}</h4>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{trade.side} @ {trade.entry_price.toFixed(3)} | {trade.mode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 uppercase">STAKE</p>
                    <p className="text-zinc-100 font-bold">{trade.notional_cost.toFixed(2)} USDT</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <footer className="h-8 border border-white/10 bg-[#0D0D0D] flex items-center justify-between px-6 text-[10px] text-zinc-500 mono">
          <div className="flex items-center gap-3">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#aae9cf]' : 'bg-[#ffb4ab]'}`}></span>
            <span>{connected ? 'WS_CONNECTED' : 'WS_DISCONNECTED'}</span>
          </div>
          <span>Balance: {balance.toFixed(2)} USDT</span>
        </footer>
      </div>
    </div>
  );
};
