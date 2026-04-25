import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';

export const ScannerInsight: React.FC = () => {
    const { connected, activePositions } = usePolybotStore();
    return (
        <div className="font-body-md selection:bg-primary-container selection:text-on-primary-container text-[#e5e2e1] bg-[#050505] min-h-screen">
            {/* TopAppBar */}
            <header className="bg-[#050505] backdrop-blur-xl bg-opacity-80 text-zinc-400 font-inter text-xs tracking-widest uppercase docked full-width top-0 z-50 border-b border-white/10 flex justify-between items-center h-14 px-6 w-full relative">
                <div className="flex items-center gap-8">
                    <span className="text-zinc-100 font-black tracking-tighter text-xl normal-case">OBSIDIAN_TERMINAL</span>
                    <nav className="hidden md:flex gap-6">
                        <a className="text-zinc-100 border-b-2 border-zinc-100 h-14 flex items-center px-2 cursor-pointer transition-all duration-300" href="#">Terminal</a>
                        <a className="text-zinc-500 hover:text-zinc-100 hover:bg-white/5 h-14 flex items-center px-2 cursor-pointer transition-all duration-300" href="#">Markets</a>
                        <a className="text-zinc-500 hover:text-zinc-100 hover:bg-white/5 h-14 flex items-center px-2 cursor-pointer transition-all duration-300" href="#">Intelligence</a>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 gap-2">
                        <span className="material-symbols-outlined text-sm">search</span>
                        <input className="bg-transparent border-none focus:ring-0 text-xs w-32 outline-none" placeholder="Search Assets..." type="text"/>
                    </div>
                    <div className="flex gap-2">
                        <button className="material-symbols-outlined p-2 hover:bg-white/5 transition-all cursor-pointer">account_balance_wallet</button>
                        <button className="material-symbols-outlined p-2 hover:bg-white/5 transition-all cursor-pointer">notifications</button>
                        <button className="material-symbols-outlined p-2 hover:bg-white/5 transition-all cursor-pointer">settings</button>
                    </div>
                </div>
            </header>

            {/* SideNavBar */}
            <aside className="fixed left-0 top-0 h-screen w-64 border-r border-white/10 bg-[#0D0D0D] hidden md:flex flex-col py-8 gap-y-6 pt-20">
                <div className="px-6 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-zinc-100">monitoring</span>
                        </div>
                        <div>
                            <p className="text-zinc-100 font-bold uppercase text-xs tracking-wider">{connected ? 'System_Active' : 'System_Offline'}</p>
                            <p className="text-zinc-500 text-[10px] font-medium tracking-widest uppercase">{activePositions} Active Trades</p>
                        </div>
                    </div>
                </div>
                <nav className="flex flex-col">
                    <a className="flex items-center gap-3 px-6 py-4 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition-colors cursor-pointer active:scale-98" href="#">
                        <span className="material-symbols-outlined">swap_horiz</span>
                        <span className="font-inter text-xs font-medium">Execution</span>
                    </a>
                    <a className="flex items-center gap-3 px-6 py-4 text-zinc-100 bg-white/5 border-r-2 border-zinc-200 cursor-pointer active:scale-98" href="#">
                        <span className="material-symbols-outlined">radar</span>
                        <span className="font-inter text-xs font-medium">Scanner</span>
                    </a>
                    <a className="flex items-center gap-3 px-6 py-4 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition-colors cursor-pointer active:scale-98" href="#">
                        <span className="material-symbols-outlined">monitoring</span>
                        <span className="font-inter text-xs font-medium">Analytics</span>
                    </a>
                    <a className="flex items-center gap-3 px-6 py-4 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition-colors cursor-pointer active:scale-98" href="#">
                        <span className="material-symbols-outlined">account_balance_wallet</span>
                        <span className="font-inter text-xs font-medium">Portfolio</span>
                    </a>
                </nav>
                <div className="mt-auto px-6">
                    <button className="w-full py-3 bg-[#e2e2e6] text-[#050505] font-bold text-xs uppercase tracking-widest rounded transition-all hover:brightness-110 active:scale-95">
                        New Trade
                    </button>
                </div>
            </aside>

            {/* Main Canvas */}
            <main className="md:ml-64 pt-20 p-6 min-h-screen">
                {/* Hero Insight */}
                <section className="mb-12">
                    <div className="glass-panel p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10">
                            <img className="w-full h-full object-cover grayscale" alt="Abstract bg" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEL3KpBieJL2ZiOg6NF9iWiD9UnhFJOXYQzxYtgtBoD6KuSeZ3AGjwojTQuik4p0FsGzvOcYw1jccHnj5rjEUDohS12jmd05Cw3lIYOI1QOktFwJFdf9p6qwiGqH7N3EDsPoeaNxyncc3Y7p6TK21Ktp_8oVKhp2ygbXHYPkhJGGTlYFBNXC0CnwhTFmOueEAxuequbikqclDwM8LQXa9qUFkur-Nhy03QRPnuWg9h0CR4fb9oClcG_5l9qNtwGgt6vT1FIbzDcZfu"/>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#aae9cf] shadow-[0_0_10px_rgba(170,233,207,0.5)]' : 'bg-[#ffb4ab] shadow-[0_0_10px_rgba(255,180,171,0.5)]'}`}></span>
                                <p className="font-label-caps text-[#c6c6ca] uppercase tracking-widest text-xs font-semibold">Global Market Intelligence / Scanner {connected ? '' : '(OFFLINE)'}</p>
                            </div>
                            <h1 className="font-headline-xl text-[#c6c6ca] mb-4 text-4xl font-semibold">BTC SYMBOLIC THRESHOLD: <span className="text-white">$100,000.00</span></h1>
                            <div className="flex gap-5">
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Current Price</p>
                                    <p className="text-2xl font-bold text-zinc-100">$98,432.12</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">24H Change</p>
                                    <p className="text-2xl font-bold text-[#aae9cf]">+4.28%</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Market Sentiment</p>
                                    <p className="text-2xl font-bold text-zinc-100">EXTREME GREED</p>
                                </div>
                            </div>
                        </div>
                        <div className="relative z-10 flex gap-3">
                            <button className="bg-[#e2e2e6] text-[#050505] px-6 py-3 font-bold text-xs uppercase tracking-widest rounded transition-all hover:brightness-110 active:scale-95">Analyze Flow</button>
                            <button className="border border-white/10 bg-white/5 px-6 py-3 text-zinc-100 font-bold text-xs uppercase tracking-widest rounded hover:bg-white/10 transition-all">Alert Setup</button>
                        </div>
                    </div>
                </section>

                {/* Bento Grid Analysis */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                    {/* Main Chart Area */}
                    <div className="md:col-span-8 glass-panel p-6 rounded-xl min-h-[450px] flex flex-col" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <h2 className="font-headline-lg text-zinc-100 text-2xl font-medium">Price Dynamics</h2>
                                <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
                                    <button className="px-3 py-1 text-[10px] font-bold text-zinc-100 bg-white/10 rounded">1H</button>
                                    <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-100">4H</button>
                                    <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-100">1D</button>
                                    <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-100">1W</button>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 border border-[#aae9cf] bg-[#aae9cf]/10 rounded-sm"></span>
                                    <span className="text-[10px] text-zinc-400 font-medium">SPOT PRICE</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 border border-[#c0c0c4] bg-[#c0c0c4]/10 rounded-sm"></span>
                                    <span className="text-[10px] text-zinc-400 font-medium">AVG COST</span>
                                </div>
                            </div>
                        </div>
                        {/* Mock Chart Canvas */}
                        <div className="flex-grow flex items-end gap-1 relative overflow-hidden group">
                            <div className="absolute inset-0 grid grid-cols-8 grid-rows-4 pointer-events-none">
                                {[...Array(32)].map((_, i) => (
                                    <div key={i} className="border-t border-white/5 border-l border-white/5" />
                                ))}
                            </div>
                            <svg className="absolute inset-0 w-full h-full drop-shadow-[0_0_20px_rgba(170,233,207,0.2)]" viewBox="0 0 1000 400" preserveAspectRatio="none">
                                <path d="M0,350 Q100,320 200,340 T400,280 T600,290 T800,180 T1000,100" fill="none" stroke="#aae9cf" strokeLinecap="round" strokeWidth="3"></path>
                                <path d="M0,350 Q100,320 200,340 T400,280 T600,290 T800,180 T1000,100 L1000,400 L0,400 Z" fill="url(#grad1)" opacity="0.1"></path>
                                <defs>
                                    <linearGradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: '#aae9cf', stopOpacity: 1 }}></stop>
                                        <stop offset="100%" style={{ stopColor: '#aae9cf', stopOpacity: 0 }}></stop>
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute right-10 top-20 border-l border-dashed border-white/20 h-full flex flex-col">
                                <span className="bg-white/10 text-zinc-100 text-[10px] px-2 py-0.5 ml-2 font-bold">$100,000 RESISTANCE</span>
                            </div>
                        </div>
                    </div>

                    {/* Order Flow / Depth */}
                    <div className="md:col-span-4 glass-panel p-6 rounded-xl flex flex-col" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <h3 className="font-label-caps text-zinc-500 mb-6 uppercase tracking-widest text-xs font-semibold">Institutional Order Flow</h3>
                        <div className="space-y-4 overflow-y-auto max-h-[400px] no-scrollbar">
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <div>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Buy Order</p>
                                    <p className="font-headline-lg text-[#aae9cf] text-2xl font-medium">42.8 BTC</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-zinc-100 font-bold">$98,430</p>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Binance Futures</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <div>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Sell Order</p>
                                    <p className="font-headline-lg text-[#ffb4ab] text-2xl font-medium">12.5 BTC</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-zinc-100 font-bold">$98,510</p>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Coinbase Pro</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <div>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Liquidity Pool</p>
                                    <p className="font-headline-lg text-zinc-100 text-2xl font-medium">1.2M USDT</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-zinc-100 font-bold">ETH/BTC</p>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Uniswap v3</p>
                                </div>
                            </div>
                        </div>
                        <button className="mt-auto w-full py-4 bg-white/5 text-zinc-400 font-bold text-[10px] uppercase tracking-widest rounded hover:bg-white/10 transition-all">View Full Depth</button>
                    </div>

                    {/* News / Intelligence */}
                    <div className="md:col-span-5 glass-panel p-6 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-label-caps text-zinc-500 uppercase tracking-widest text-xs font-semibold">Macro Intelligence</h3>
                            <span className="text-[10px] font-bold text-[#aae9cf] px-2 py-0.5 border border-[#aae9cf]/30 rounded uppercase">Live Feed</span>
                        </div>
                        <div className="space-y-6">
                            <div className="flex gap-4 group cursor-pointer">
                                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 border border-white/10">
                                    <img className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0 group-hover:scale-110" alt="News article" src="https://lh3.googleusercontent.com/aida-public/AB6AXuABRPzB6YsM0D4d6QUrCxsPNdXHX4QROMo2Bbn68v7T-zljqLO_eBVs9pOavDMBgmdxUQci01hgoIO1vUuelB5m5PMat3XYUAQJG660uqJT93yyDDBubgJKXNX4QgyN3x1UTIxb8vzu-kOCt8iOLh62Jkk4lEgox2jzuIAWMXlxTfJNCF82FGk6xo5HZwEuuff4EV_atRP0Igb9gFUsUuYwkepz6m6-NcBHj69CaM1-CET6vFDIpHojjM6MMO2p2mB0NEo_FCRRledh"/>
                                </div>
                                <div>
                                    <p className="text-[10px] text-[#aae9cf] font-bold mb-1 uppercase tracking-tighter">Federal Reserve</p>
                                    <h4 className="text-sm font-bold text-zinc-100 leading-tight mb-1">Interest rates maintained: Impact on digital assets is notably bullish.</h4>
                                    <p className="text-[10px] text-zinc-500 uppercase font-medium">3 mins ago • Finance Wire</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Status */}
                    <div className="md:col-span-3 glass-panel p-6 rounded-xl flex flex-col justify-between" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div>
                            <h3 className="font-label-caps text-zinc-500 mb-6 uppercase tracking-widest text-xs font-semibold">Scanner Latency</h3>
                            <div className="relative w-full h-32 flex items-center justify-center">
                                <div className="absolute inset-0 rounded-full border border-white/5"></div>
                                <div className="absolute inset-4 rounded-full border border-white/5"></div>
                                <div className="absolute inset-8 rounded-full border border-white/10"></div>
                                <div className="relative flex flex-col items-center">
                                    <span className="text-2xl font-black text-[#aae9cf]">14ms</span>
                                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Ultra Low</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3 mt-4">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-zinc-500 uppercase tracking-widest">Node Sync</span>
                                <span className="text-zinc-100 font-bold">100%</span>
                            </div>
                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                <div className="bg-[#aae9cf] w-full h-full"></div>
                            </div>
                        </div>
                    </div>

                    {/* Heat Map Visual */}
                    <div className="md:col-span-4 glass-panel p-6 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <h3 className="font-label-caps text-zinc-500 mb-4 uppercase tracking-widest text-xs font-semibold">Liquidity Zones</h3>
                        <div className="grid grid-cols-4 gap-2 h-40">
                            {[
                                { text: '80K', style: 'bg-zinc-900 border border-white/5 text-zinc-600' },
                                { text: '85K', style: 'bg-zinc-800 border border-white/10 text-zinc-500' },
                                { text: '90K', style: 'bg-zinc-700 border border-white/20 text-zinc-400' },
                                { text: '100K', style: 'bg-white/10 border border-[#aae9cf]/50 text-[#aae9cf]' },
                                { text: '60K', style: 'bg-zinc-900 border border-white/5 text-zinc-600' },
                                { text: '70K', style: 'bg-zinc-900 border border-white/5 text-zinc-600' },
                                { text: '75K', style: 'bg-zinc-900 border border-white/5 text-zinc-600' },
                                { text: '95K', style: 'bg-zinc-800 border border-white/10 text-zinc-500' },
                            ].map((box, i) => (
                                <div key={i} className={`${box.style} flex items-center justify-center text-[10px] font-bold rounded-sm`}>{box.text}</div>
                            ))}
                            <div className="col-span-2 bg-zinc-900 border border-white/5 rounded-sm"></div>
                            <div className="col-span-2 bg-white/5 border border-white/10 rounded-sm"></div>
                        </div>
                    </div>
                </div>

                <footer className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600">
                    <div className="text-[10px] font-bold uppercase tracking-widest">Obsidian Terminal v2.4.0</div>
                </footer>
            </main>
        </div>
    );
};
