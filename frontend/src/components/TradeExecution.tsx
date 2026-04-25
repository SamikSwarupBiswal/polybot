import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';

export const TradeExecution: React.FC = () => {
  const { balance, connected } = usePolybotStore();

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#050505] text-[#e5e2e1] p-5 md:p-6">
      <div className="max-w-[1200px] mx-auto relative">
        <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-5 opacity-20 pointer-events-none">
          <div className="col-span-8 row-span-4 border border-white/5 rounded"></div>
          <div className="col-span-4 row-span-2 border border-white/5 rounded"></div>
          <div className="col-span-4 row-span-2 border border-white/5 rounded"></div>
          <div className="col-span-12 row-span-2 border border-white/5 rounded"></div>
        </div>

        <div className="relative z-10 w-full border border-white/10 shadow-2xl rounded-lg overflow-hidden flex flex-col md:flex-row glass-panel">
          <div className="w-full md:w-5/12 bg-[#0e0e0e] p-6 flex flex-col border-r border-white/5">
            <div className="mb-10">
              <span className="text-xs text-zinc-500 block mb-1 uppercase font-semibold">MARKET_TICKER</span>
              <h2 className="text-2xl text-[#e2e2e6] tracking-tight font-medium">BTC / USD</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-green-400 mono text-sm">$64,821.40</span>
                <span className="text-zinc-600 mono text-[10px]">+1.24%</span>
              </div>
            </div>
            <div className="flex-1 space-y-6">
              <div className="h-32 w-full border border-white/5 bg-white/5 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/50 to-transparent"></div>
                <svg className="absolute bottom-0 w-full h-16" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <path d="M0 80 Q 25 70 40 50 T 70 30 T 100 10" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                </svg>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-500 tracking-widest block uppercase font-semibold">ORDER_BOOK_DEPTH</span>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] mono"><span className="text-red-400/80">64,835.00</span><span className="text-zinc-500">0.421 BTC</span></div>
                  <div className="flex justify-between text-[11px] mono"><span className="text-red-400/80">64,828.50</span><span className="text-zinc-500">1.105 BTC</span></div>
                  <div className="h-[1px] bg-white/10 my-1"></div>
                  <div className="flex justify-between text-[11px] mono"><span className="text-green-400/80">64,815.20</span><span className="text-zinc-500">2.551 BTC</span></div>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-white/5 text-[10px] mono">
              <span className={connected ? 'text-[#aae9cf]' : 'text-[#ffb4ab]'}>{connected ? 'WS_LINK_ACTIVE' : 'WS_DISCONNECTED'}</span>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-6 bg-[#131313] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-1">
                  <button className="px-6 py-2 bg-white/5 border border-white/20 text-zinc-100 text-[11px] uppercase tracking-widest">BUY</button>
                  <button className="px-6 py-2 text-zinc-500 text-[11px] uppercase tracking-widest">SELL</button>
                </div>
                <span className="material-symbols-outlined text-zinc-600 cursor-pointer hover:text-zinc-300">close</span>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] text-zinc-500 mb-2 block uppercase font-semibold">EXECUTION_SIZE (USD)</label>
                  <div className="relative">
                    <input className="w-full bg-[#121212] border-b border-white/10 outline-none text-xl mono py-2 text-[#e2e2e6] px-0" type="text" defaultValue="12,500.00" />
                    <span className="absolute right-0 bottom-2 text-[10px] text-zinc-600 uppercase">MAX_AVAIL: ${balance.toFixed(2)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-2 block uppercase font-semibold">ORDER_TYPE</label>
                    <select className="w-full bg-[#121212] border-b border-white/10 outline-none text-sm mono py-2 text-zinc-300">
                      <option>MARKET_LIMIT</option>
                      <option>STOP_LOSS</option>
                      <option>TAKE_PROFIT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-2 block uppercase font-semibold">LEVERAGE</label>
                    <input className="w-full bg-[#121212] border-b border-white/10 outline-none text-sm mono py-2 text-zinc-300 px-0" type="text" defaultValue="10X" />
                  </div>
                </div>
                <div className="bg-white/5 p-4 border border-white/5 space-y-2">
                  <div className="flex justify-between text-[11px]"><span className="text-zinc-500 uppercase">ESTIMATED_QUANTITY</span><span className="mono text-zinc-300">0.192842 BTC</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-zinc-500 uppercase">MARGIN_REQUIRED</span><span className="mono text-zinc-300">$1,250.00</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-zinc-500 uppercase">EST_SLIPPAGE</span><span className="mono text-zinc-300">0.05%</span></div>
                </div>
              </div>
            </div>
            <div className="mt-8">
              <button className="w-full bg-[#e2e2e6] text-[#1a1c1f] text-lg py-4 flex items-center justify-center gap-3 uppercase tracking-widest font-bold">
                Execute Trade
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
