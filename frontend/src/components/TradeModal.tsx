import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';

export const TradeModal: React.FC = () => {
    const { balance, connected } = usePolybotStore();
    return (
        <div className="bg-background text-on-surface min-h-screen flex items-center justify-center p-5 font-inter bg-[#050505]">
            {/* BACKGROUND CONTEXT */}
            <div className="fixed inset-0 z-0 opacity-20" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDEePMs278Ek2V8bYy1W8WkDFO53mspaZj62hMJROWznlE6a3BEPhUqwx0l8CSeo2QmUfUgFoXoVH3fCrsbZxzgqZMuCTtvyVcKxfm4BNsv1otBYFXmsutCZ5Nr-AcFBQhwJSxwHeWBDp4Q68BNkFPaebXCuRv8vH63PLbwIaBpeitvhREHlOT-j22KCNa7wZeMvBZrCqHXdGlLD63nJUFRNjMhSNuvoC1mNVKxeXID2QFvAfBhWc2_6cD1Y1_BKxN2ih4FPMcdHFAc')", backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
            
            {/* MODAL BACKDROP */}
            <div className="fixed inset-0 z-20" style={{ background: 'rgba(5, 5, 5, 0.8)', backdropFilter: 'blur(40px)' }}></div>
            
            {/* EXECUTION MODAL */}
            <div className="relative z-30 w-full max-w-[480px] p-6 flex flex-col gap-6 shadow-2xl" style={{ background: '#0D0D0D', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                {/* Modal Header */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className="font-label-caps text-xs text-[#909095] uppercase tracking-widest font-semibold">Transaction Terminal</span>
                        <h1 className="font-headline-lg text-2xl text-[#e5e2e1] font-medium">Execute Trade</h1>
                    </div>
                    <button className="text-[#909095] hover:text-[#e5e2e1] transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Asset Overview */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#1c1b1b] border border-white/5 p-4 flex flex-col gap-1">
                        <span className="font-label-caps text-[10px] text-[#909095] uppercase tracking-widest font-semibold">Asset Pair</span>
                        <span className="font-headline-lg text-xl text-[#dcdce0] font-medium">BTC / USDC</span>
                    </div>
                    <div className="bg-[#1c1b1b] border border-white/5 p-4 flex flex-col gap-1">
                        <span className="font-label-caps text-[10px] text-[#909095] uppercase tracking-widest font-semibold">Market Price</span>
                        <span className="font-headline-lg text-xl text-[#aae9cf] font-medium">$64,281.90</span>
                    </div>
                </div>

                {/* Form Fields */}
                <form className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="font-label-caps text-[11px] text-[#909095] uppercase tracking-widest font-semibold">Position Size (USDC)</label>
                        <div className="relative">
                            <input className="w-full bg-[#0e0e0e] border border-white/10 focus:border-[#dcdce0] px-4 py-2 font-headline-lg text-lg outline-none text-[#e5e2e1] transition-all" placeholder="0.00" type="text"/>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                                <button className="px-1 py-1 border border-white/10 text-[10px] font-bold text-[#909095] hover:bg-white/5" type="button">25%</button>
                                <button className="px-1 py-1 border border-white/10 text-[10px] font-bold text-[#909095] hover:bg-white/5" type="button">50%</button>
                                <button className="px-1 py-1 border border-white/10 text-[10px] font-bold text-[#909095] hover:bg-white/5" type="button">MAX</button>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="font-label-caps text-[11px] text-[#909095] uppercase tracking-widest font-semibold">Slippage Tolerance</label>
                            <div className="relative">
                                <input className="w-full bg-[#0e0e0e] border border-white/10 focus:border-[#dcdce0] px-4 py-2 text-base outline-none text-[#e5e2e1]" type="text" defaultValue="0.5"/>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#909095] text-sm">%</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="font-label-caps text-[11px] text-[#909095] uppercase tracking-widest font-semibold">Auto-Sell Target</label>
                            <div className="relative">
                                <input className="w-full bg-[#0e0e0e] border border-white/10 focus:border-[#dcdce0] px-4 py-2 text-base outline-none text-[#e5e2e1]" placeholder="+10.0" type="text"/>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#909095] text-sm">%</span>
                            </div>
                        </div>
                    </div>
                    {/* Advanced Toggle */}
                    <div className="flex items-center justify-between py-1 border-y border-white/5 mt-1">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#909095] text-sm">security</span>
                            <span className="text-sm text-[#909095]">MEV Protection</span>
                        </div>
                        <div className="w-8 h-4 bg-zinc-800 rounded-full relative cursor-pointer">
                            <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-zinc-400 rounded-full"></div>
                        </div>
                    </div>
                    {/* Execution Button */}
                    <button type="button" className="mt-4 w-full bg-[#3c475a] text-[#aab6cc] py-4 font-headline-lg text-lg uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all border border-white/10 shadow-[0_0_20px_rgba(60,71,90,0.3)]">
                        Execute Order
                    </button>
                </form>

                {/* Footer Info */}
                <div className="flex flex-col gap-1 border-t border-white/5 pt-4">
                    <div className="flex justify-between text-[12px]">
                        <span className="text-[#909095]">Estimated Gas Fee</span>
                        <span className="text-[#e5e2e1]">0.0012 ETH (~$4.12)</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                        <span className="text-[#909095]">Route</span>
                        <span className="text-[#e5e2e1]">Aggregator V3 (Direct)</span>
                    </div>
                </div>
            </div>

            {/* SYSTEM ALERTS (Floating) */}
            <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-40">
                <div className="bg-[#2a2a2a] border-l-2 border-[#aae9cf] px-6 py-4 flex items-center gap-4 shadow-xl min-w-[300px]">
                    <span className="material-symbols-outlined" style={{ color: connected ? '#aae9cf' : '#ffb4ab' }}>{connected ? 'check_circle' : 'error'}</span>
                    <div className="flex flex-col">
                        <span className="font-label-caps text-[10px] uppercase font-semibold" style={{ color: connected ? '#aae9cf' : '#ffb4ab' }}>System Status</span>
                        <span className="text-sm text-[#e5e2e1]">{connected ? `Balance: $${balance.toFixed(2)}` : 'Backend Disconnected'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
