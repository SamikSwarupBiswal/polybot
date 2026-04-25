import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';

export const BetAnalytics: React.FC = () => {
    const { balance, trades, metrics, connected } = usePolybotStore();
    const openTrades = trades.filter(t => t.status === 'OPEN');
    const totalExposure = openTrades.reduce((sum, t) => sum + t.notional_cost, 0);
    const winRateNum = parseFloat(metrics?.winRate || '0');
    // SVG circle math: circumference = 2 * pi * r = 2 * 3.14159 * 58 ≈ 364
    const circumference = 364;
    const winRateOffset = circumference - (circumference * winRateNum / 100);

    return (
        <div className="dark bg-[#050505] text-[#e5e2e1] font-inter overflow-hidden flex h-screen w-full">
            {/* SideNavBar */}
            <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0D0D0D] border-r border-white/10 flex flex-col py-8 gap-y-6 z-[60]">
                <div className="px-6 mb-4">
                    <div className="text-zinc-100 font-bold uppercase tracking-tighter text-lg">OBSIDIAN</div>
                    <div className="mt-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#2a2a2a] border border-white/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#c6c6ca]">terminal</span>
                        </div>
                        <div>
                            <p className="font-inter text-xs font-medium text-zinc-100">System_Active</p>
                            <p className="font-inter text-[10px] text-zinc-500 uppercase tracking-widest">Precision_Mode</p>
                        </div>
                    </div>
                </div>
                <nav className="flex flex-col px-3 space-y-1">
                    <a className="flex items-center gap-3 px-3 py-3 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition-colors group cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                        <span className="font-inter text-xs font-medium">Execution</span>
                    </a>
                    <a className="flex items-center gap-3 px-3 py-3 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition-colors group cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">radar</span>
                        <span className="font-inter text-xs font-medium">Scanner</span>
                    </a>
                    <a className="flex items-center gap-3 px-3 py-3 text-zinc-100 bg-white/5 border-r-2 border-zinc-200 transition-colors group cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">monitoring</span>
                        <span className="font-inter text-xs font-medium">Analytics</span>
                    </a>
                    <a className="flex items-center gap-3 px-3 py-3 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition-colors group cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                        <span className="font-inter text-xs font-medium">Portfolio</span>
                    </a>
                </nav>
                <div className="mt-auto px-6">
                    <button className="w-full bg-[#dcdce0] text-[#2f3034] py-3 text-xs font-bold uppercase tracking-widest active:scale-[0.98] transition-transform duration-200">
                        New Trade
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 ml-64 flex flex-col relative w-full h-full">
                {/* TopAppBar */}
                <header className="sticky top-0 z-50 flex justify-between items-center h-14 px-6 w-full bg-[#050505] backdrop-blur-xl bg-opacity-80 border-b border-white/10">
                    <div className="flex items-center gap-6">
                        <span className="text-zinc-100 font-black tracking-tighter text-xl">OBSIDIAN_TERMINAL</span>
                        <nav className="flex gap-4">
                            <span className="font-inter text-xs tracking-widest uppercase cursor-pointer text-zinc-100 border-b-2 border-zinc-100 py-1">Overview</span>
                            <span className="font-inter text-xs tracking-widest uppercase cursor-pointer text-zinc-500 hover:text-zinc-100 transition-all duration-300 py-1">Risk_Model</span>
                            <span className="font-inter text-xs tracking-widest uppercase cursor-pointer text-zinc-500 hover:text-zinc-100 transition-all duration-300 py-1">History</span>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 border border-white/10">
                            <span className="material-symbols-outlined text-xs text-zinc-400">account_balance_wallet</span>
                            <span className="font-inter text-[11px] font-bold text-zinc-100">{balance.toFixed(2)} USDT</span>
                        </div>
                        <div className="flex items-center gap-4 text-zinc-400">
                            <span className="material-symbols-outlined cursor-pointer hover:text-zinc-100 transition-colors">notifications</span>
                            <span className="material-symbols-outlined cursor-pointer hover:text-zinc-100 transition-colors">settings</span>
                        </div>
                    </div>
                </header>

                {/* Canvas */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-5 space-y-12 bg-[#050505]">
                    {/* Page Header */}
                    <section className="flex justify-between items-end">
                        <div>
                            <h1 className="font-headline-xl tracking-tight text-[#e2e2e6] text-4xl font-semibold">Active Bet Analytics</h1>
                            <p className="text-zinc-500 text-sm mt-1">Real-time predictive analysis and exposure management.</p>
                        </div>
                        <div className="flex gap-1">
                            <div className="px-4 py-2 bg-[#0e0e0e] border border-white/10 flex flex-col items-end">
                                <span className="font-label-caps text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">SESSION_P&L</span>
                                <span className={`font-bold ${parseFloat(metrics?.roi || '0') >= 0 ? 'text-[#aae9cf]' : 'text-[#ffb4ab]'}`}>{metrics?.roi || '0.0%'}</span>
                            </div>
                            <div className="px-4 py-2 bg-[#0e0e0e] border border-white/10 flex flex-col items-end">
                                <span className="font-label-caps text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">EXPOSURE</span>
                                <span className="text-zinc-100 font-bold">{totalExposure.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </section>

                    {/* Bento Grid Layout */}
                    <div className="grid grid-cols-12 gap-5 h-[600px]">
                        {/* Main Chart Card */}
                        <div className="col-span-8 bg-[#0D0D0D] border border-white/5 p-6 relative flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="font-label-caps text-xs tracking-[0.1em] font-semibold text-[#c6c6ca]">EQUITY_CURVE_ANALYSIS</h3>
                                    <p className="text-[10px] text-zinc-500 mt-1 uppercase">REAL-TIME DATA STREAM 04.912.X</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-2 py-1 bg-white/5 border border-white/10 text-[10px] font-bold">1H</button>
                                    <button className="px-2 py-1 border border-zinc-500 text-[10px] font-bold">4H</button>
                                    <button className="px-2 py-1 bg-white/5 border border-white/10 text-[10px] font-bold">1D</button>
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                {/* Simulated Silver Line Chart SVG */}
                                <svg className="w-full h-full opacity-60" preserveAspectRatio="none" viewBox="0 0 800 300">
                                    <defs>
                                        <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1"></stop>
                                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"></stop>
                                        </linearGradient>
                                    </defs>
                                    <path d="M0,250 L50,230 L100,240 L150,210 L200,220 L250,180 L300,190 L350,150 L400,160 L450,120 L500,130 L550,90 L600,100 L650,60 L700,70 L750,30 L800,40 V300 H0 Z" fill="url(#chartGradient)"></path>
                                    <path d="M0,250 L50,230 L100,240 L150,210 L200,220 L250,180 L300,190 L350,150 L400,160 L450,120 L500,130 L550,90 L600,100 L650,60 L700,70 L750,30 L800,40" fill="none" stroke="#dcdce0" strokeWidth="2" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                                <div className="absolute top-0 left-0 h-full flex flex-col justify-between text-[10px] text-zinc-600 font-mono">
                                    <span>$100k</span>
                                    <span>$75k</span>
                                    <span>$50k</span>
                                    <span>$25k</span>
                                </div>
                            </div>
                        </div>

                        {/* Secondary Stats Bento */}
                        <div className="col-span-4 flex flex-col gap-5">
                            {/* Win Rate Gauge */}
                            <div className="flex-1 bg-[#0D0D0D] border border-white/5 p-6 flex flex-col justify-between">
                                <div>
                                    <h3 className="font-label-caps text-xs tracking-[0.1em] font-semibold text-[#c6c6ca]">WIN_PROBABILITY</h3>
                                </div>
                                <div className="flex items-center justify-center py-6">
                                    <div className="relative w-32 h-32 flex items-center justify-center">
                                        <svg className="w-full h-full -rotate-90">
                                            <circle cx="64" cy="64" fill="none" r="58" stroke="rgba(255,255,255,0.05)" strokeWidth="8"></circle>
                                            <circle cx="64" cy="64" fill="none" r="58" stroke="#dcdce0" strokeDasharray={circumference} strokeDashoffset={winRateOffset} strokeWidth="8"></circle>
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-bold text-zinc-100">{metrics?.winRate || '0%'}</span>
                                            <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Win Rate</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between border-t border-white/5 pt-4 text-[11px]">
                                    <span className="text-zinc-500">Expected Value</span>
                                    <span className="text-[#aae9cf]">+0.14</span>
                                </div>
                            </div>

                            {/* Risk Map */}
                            <div className="flex-1 bg-[#0D0D0D] border border-white/5 p-6 flex flex-col">
                                <h3 className="font-label-caps text-xs tracking-[0.1em] font-semibold text-[#c6c6ca] mb-4">RISK_CORRELATION</h3>
                                <div className="grid grid-cols-4 grid-rows-4 gap-1 flex-1">
                                    <div className="bg-white/20 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/10 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/30 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/20 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/10 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/5 border border-white/10"></div>
                                    <div className="bg-white/40 border border-white/10"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Active Positions List */}
                    <section className="space-y-4 pb-12">
                        <div className="flex justify-between items-center">
                            <h2 className="font-headline-lg text-2xl text-[#c6c6ca] font-medium tracking-tight">Live Positions</h2>
                            <span className="text-zinc-500 text-xs">Total Active: {String(openTrades.length).padStart(2, '0')}</span>
                        </div>
                        <div className="space-y-2">
                            {openTrades.length === 0 ? (
                                <div className="bg-[#0D0D0D] border border-white/5 p-8 text-center">
                                    <span className="text-zinc-600 text-sm font-mono">NO ACTIVE POSITIONS — SYSTEM IDLE</span>
                                </div>
                            ) : (
                                openTrades.map(trade => {
                                    const pnl = trade.pnl ?? 0;
                                    const isPositive = pnl >= 0;
                                    const pnlColor = isPositive ? '#aae9cf' : '#ffb4ab';
                                    // Progress bar: normalize cost against balance for visual width
                                    const progressPct = Math.min((trade.notional_cost / (balance || 1)) * 100, 100);
                                    return (
                                        <div key={trade.trade_id} className="bg-[#0D0D0D] border border-white/5 flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer group">
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 bg-[#353534] border border-white/10 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-zinc-100">monitoring</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-zinc-100">{trade.market_question.length > 50 ? trade.market_question.substring(0, 50) + '...' : trade.market_question}</h4>
                                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{trade.side} @ {trade.entry_price.toFixed(3)} | {trade.mode} | ID: {trade.trade_id.substring(0, 8)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-12 text-right">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-zinc-500 font-label-caps uppercase font-semibold">STAKE</span>
                                                    <span className="text-zinc-100 font-bold">{trade.notional_cost.toFixed(2)} USDT</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-zinc-500 font-label-caps uppercase font-semibold">UNREALIZED</span>
                                                    <span className="font-bold" style={{ color: pnlColor }}>{isPositive ? '+' : ''}{pnl.toFixed(2)}</span>
                                                </div>
                                                <div className="w-24 bg-[#2a2a2a] h-1 rounded-full relative overflow-hidden">
                                                    <div className="absolute left-0 top-0 h-full" style={{ width: `${progressPct}%`, backgroundColor: pnlColor }}></div>
                                                </div>
                                                <span className="material-symbols-outlined text-zinc-600 group-hover:text-zinc-100 transition-colors">chevron_right</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </div>

                {/* System Status Bar */}
                <footer className="h-8 border-t border-white/10 bg-[#0D0D0D] flex items-center justify-between px-6 z-50 fixed bottom-0 left-64 right-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#aae9cf]' : 'bg-[#ffb4ab]'}`}></div>
                            <span className="text-[10px] text-zinc-500 font-mono">{connected ? 'WS_CONNECTED' : 'WS_DISCONNECTED'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
                            <span className="text-[10px] text-zinc-500 font-mono">LATENCY: 14MS</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] text-zinc-500 font-mono">BUILD_V2.1.0_OBSIDIAN</span>
                        <span className="text-[10px] text-zinc-500 font-mono">2024.05.21 14:22:01 UTC</span>
                    </div>
                </footer>
            </main>
        </div>
    );
};
