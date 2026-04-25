import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';

export const TradeExecution: React.FC = () => {
    const { balance, connected } = usePolybotStore();
    return (
        <div className="dark bg-[#050505] text-[#e5e2e1] font-inter overflow-hidden min-h-screen">
            {/* Top Navigation */}
            <header className="bg-[#050505] backdrop-blur-xl bg-opacity-80 text-zinc-400 text-xs tracking-widest uppercase docked full-width top-0 z-50 border-b border-white/10 flex justify-between items-center h-14 px-6 w-full fixed">
                <div className="flex items-center gap-8">
                    <span className="text-zinc-100 font-black tracking-tighter text-xl">OBSIDIAN_TERMINAL</span>
                    <nav className="hidden md:flex gap-6 items-center">
                        <a className="text-zinc-100 border-b-2 border-zinc-100 hover:text-zinc-100 hover:bg-white/5 transition-all duration-300 cursor-pointer h-14 flex items-center px-2" href="#">Terminal</a>
                        <a className="text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-all duration-300 cursor-pointer h-14 flex items-center px-2" href="#">Portfolio</a>
                        <a className="text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-all duration-300 cursor-pointer h-14 flex items-center px-2" href="#">Analytics</a>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined hover:text-zinc-100 cursor-pointer transition-colors">account_balance_wallet</span>
                    <span className="material-symbols-outlined hover:text-zinc-100 cursor-pointer transition-colors">notifications</span>
                    <span className="material-symbols-outlined hover:text-zinc-100 cursor-pointer transition-colors">settings</span>
                </div>
            </header>

            <div className="flex h-screen pt-14">
                {/* Side Navigation */}
                <aside className="bg-[#0D0D0D] text-zinc-300 text-xs font-medium fixed left-0 top-0 h-screen w-64 border-r border-white/10 flex flex-col py-8 gap-y-6 pt-20">
                    <div className="px-6 space-y-1 mb-4">
                        <div className="text-zinc-100 font-bold uppercase tracking-wider">System_Active</div>
                        <div className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Precision_Mode</div>
                    </div>
                    <nav className="flex-1">
                        <div className="space-y-1">
                            <a className="text-zinc-100 bg-white/5 border-r-2 border-zinc-200 flex items-center gap-3 px-6 py-3 cursor-pointer" href="#">
                                <span className="material-symbols-outlined">swap_horiz</span>
                                <span>Execution</span>
                            </a>
                            <a className="text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition-colors flex items-center gap-3 px-6 py-3 cursor-pointer" href="#">
                                <span className="material-symbols-outlined">radar</span>
                                <span>Scanner</span>
                            </a>
                        </div>
                    </nav>
                    <div className="px-6 pb-6">
                        <button className="w-full bg-[#e2e2e6] text-[#1a1c1f] font-bold py-3 uppercase tracking-tighter hover:brightness-110 active:scale-95 transition-all">
                            New Trade
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="ml-64 flex-1 bg-[#050505] relative flex items-center justify-center p-12">
                    {/* Background Decoration */}
                    <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-5 p-12 opacity-20 pointer-events-none">
                        <div className="col-span-8 row-span-4 border border-white/5 rounded"></div>
                        <div className="col-span-4 row-span-2 border border-white/5 rounded"></div>
                        <div className="col-span-4 row-span-2 border border-white/5 rounded"></div>
                        <div className="col-span-12 row-span-2 border border-white/5 rounded"></div>
                    </div>

                    {/* Trade Execution Modal Style Container */}
                    <div className="relative w-full max-w-4xl border border-white/10 shadow-2xl rounded-lg overflow-hidden flex flex-col md:flex-row z-10" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(40px)' }}>
                        {/* Left Section: Market Context */}
                        <div className="w-full md:w-5/12 bg-[#0e0e0e] p-6 flex flex-col border-r border-white/5">
                            <div className="mb-12">
                                <span className="font-label-caps text-xs text-zinc-500 block mb-1 uppercase font-semibold">MARKET_TICKER</span>
                                <h2 className="font-headline-lg text-2xl text-[#e2e2e6] tracking-tight font-medium">BTC / USD</h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-green-400 font-mono text-sm">$64,821.40</span>
                                    <span className="text-green-500/50 material-symbols-outlined text-xs">trending_up</span>
                                    <span className="text-zinc-600 font-mono text-[10px]">+1.24%</span>
                                </div>
                            </div>
                            <div className="flex-1 space-y-6">
                                {/* Tiny Chart Placeholder */}
                                <div className="h-32 w-full border border-white/5 bg-white/5 overflow-hidden relative">
                                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/50 to-transparent"></div>
                                    <svg className="absolute bottom-0 w-full h-16" preserveAspectRatio="none" viewBox="0 0 100 100">
                                        <path d="M0 80 Q 25 70 40 50 T 70 30 T 100 10" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="2"></path>
                                        <path d="M0 80 Q 25 70 40 50 T 70 30 T 100 10 V 100 H 0 Z" fill="url(#gradient)" opacity="0.05"></path>
                                        <defs>
                                            <linearGradient id="gradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                                <stop offset="0%" style={{ stopColor: 'white', stopOpacity: 1 }}></stop>
                                                <stop offset="100%" style={{ stopColor: 'white', stopOpacity: 0 }}></stop>
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </div>
                                {/* Market Depth Mini */}
                                <div className="space-y-2">
                                    <span className="font-label-caps text-[10px] text-zinc-500 tracking-widest block uppercase font-semibold">ORDER_BOOK_DEPTH</span>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[11px] font-mono">
                                            <span className="text-red-400/80">64,835.00</span>
                                            <span className="text-zinc-500">0.421 BTC</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] font-mono">
                                            <span className="text-red-400/80">64,828.50</span>
                                            <span className="text-zinc-500">1.105 BTC</span>
                                        </div>
                                        <div className="h-[1px] bg-white/10 my-1"></div>
                                        <div className="flex justify-between items-center text-[11px] font-mono">
                                            <span className="text-green-400/80">64,815.20</span>
                                            <span className="text-zinc-500">2.551 BTC</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] font-mono">
                                            <span className="text-green-400/80">64,809.10</span>
                                            <span className="text-zinc-500">0.129 BTC</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-12 pt-6 border-t border-white/5">
                                <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-mono">
                                    <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    {connected ? 'WS_LINK_ACTIVE' : 'WS_DISCONNECTED'}
                                </div>
                            </div>
                        </div>

                        {/* Right Section: Execution Form */}
                        <div className="w-full md:w-7/12 p-6 bg-[#131313] flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-1">
                                        <button className="px-6 py-2 bg-white/5 border border-white/20 text-zinc-100 font-label-caps text-[11px] active:bg-white/10 font-semibold uppercase tracking-widest">BUY</button>
                                        <button className="px-6 py-2 border border-transparent text-zinc-500 font-label-caps text-[11px] hover:text-zinc-300 transition-colors font-semibold uppercase tracking-widest">SELL</button>
                                    </div>
                                    <span className="material-symbols-outlined text-zinc-600 cursor-pointer hover:text-zinc-300">close</span>
                                </div>
                                <div className="space-y-6">
                                    {/* Input: Amount */}
                                    <div className="group">
                                        <label className="font-label-caps text-[10px] text-zinc-500 mb-2 block uppercase font-semibold">EXECUTION_SIZE (USD)</label>
                                        <div className="relative">
                                            <input className="w-full bg-[#121212] border-b border-white/10 focus:border-zinc-200 outline-none text-xl font-mono py-2 text-[#e2e2e6] transition-all px-0" type="text" defaultValue="12,500.00"/>
                                            <span className="absolute right-0 bottom-2 font-label-caps text-[10px] text-zinc-600 uppercase font-semibold">MAX_AVAIL: ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                    {/* Input: Order Type */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="font-label-caps text-[10px] text-zinc-500 mb-2 block uppercase font-semibold">ORDER_TYPE</label>
                                            <div className="relative">
                                                <select className="w-full bg-[#121212] border-b border-white/10 focus:border-zinc-200 outline-none text-sm font-mono py-2 text-zinc-300 appearance-none rounded-none">
                                                    <option>MARKET_LIMIT</option>
                                                    <option>STOP_LOSS</option>
                                                    <option>TAKE_PROFIT</option>
                                                </select>
                                                <span className="absolute right-0 bottom-3 material-symbols-outlined text-xs text-zinc-600 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="font-label-caps text-[10px] text-zinc-500 mb-2 block uppercase font-semibold">LEVERAGE</label>
                                            <div className="relative">
                                                <input className="w-full bg-[#121212] border-b border-white/10 focus:border-zinc-200 outline-none text-sm font-mono py-2 text-zinc-300 px-0" type="text" defaultValue="10X"/>
                                                <span className="absolute right-0 bottom-3 material-symbols-outlined text-xs text-zinc-600">edit</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Summary Metrics */}
                                    <div className="bg-white/5 p-4 border border-white/5 space-y-2">
                                        <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-zinc-500 uppercase">ESTIMATED_QUANTITY</span>
                                            <span className="font-mono text-zinc-300">0.192842 BTC</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-zinc-500 uppercase">MARGIN_REQUIRED</span>
                                            <span className="font-mono text-zinc-300">$1,250.00</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-zinc-500 uppercase">EST_SLIPPAGE</span>
                                            <span className="font-mono text-zinc-300">0.05%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-12">
                                <button className="w-full bg-[#e2e2e6] text-[#1a1c1f] font-headline-lg text-lg py-4 flex items-center justify-center gap-3 hover:bg-white transition-all active:scale-[0.99] group shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                                    <span className="font-bold tracking-tighter uppercase font-medium">Execute Trade</span>
                                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </button>
                                <p className="text-center text-[9px] text-zinc-600 mt-4 uppercase tracking-[0.2em] font-medium">Final confirmation required in next step</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};
