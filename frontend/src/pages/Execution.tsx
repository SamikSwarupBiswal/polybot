import React, { useState } from 'react';

export const Execution: React.FC = () => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('12,500.00');

  return (
    <div className="flex-1 bg-[#050505] relative flex items-center justify-center p-12 h-[calc(100vh-56px)]">
      {/* Background Decoration */}
      <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-5 p-12 opacity-20 pointer-events-none">
        <div className="col-span-8 row-span-4 border border-white/5 rounded"></div>
        <div className="col-span-4 row-span-2 border border-white/5 rounded"></div>
        <div className="col-span-4 row-span-2 border border-white/5 rounded"></div>
        <div className="col-span-12 row-span-2 border border-white/5 rounded"></div>
      </div>

      {/* Trade Execution Modal */}
      <div className="relative w-full max-w-4xl matte-glass border border-white/10 shadow-2xl rounded-lg overflow-hidden flex flex-col md:flex-row">
        {/* Left: Market Context */}
        <div className="w-full md:w-5/12 bg-surface-container-lowest p-6 flex flex-col border-r border-white/5">
          <div className="mb-12">
            <span className="text-label-caps text-zinc-500 block mb-1">MARKET_TICKER</span>
            <h2 className="text-headline-lg text-primary-fixed tracking-tight">BTC / USD</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-green-400 font-mono text-sm">$64,821.40</span>
              <span className="text-green-500/50 material-symbols-outlined text-xs">trending_up</span>
              <span className="text-zinc-600 font-mono text-[10px]">+1.24%</span>
            </div>
          </div>
          <div className="flex-1 space-y-6">
            {/* Mini Chart */}
            <div className="h-32 w-full border border-white/5 bg-white/[0.02] overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/50 to-transparent"></div>
              <svg className="absolute bottom-0 w-full h-16" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="miniGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: 'white', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: 'white', stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
                <path d="M0 80 Q 25 70 40 50 T 70 30 T 100 10" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                <path d="M0 80 Q 25 70 40 50 T 70 30 T 100 10 V 100 H 0 Z" fill="url(#miniGrad)" opacity="0.05" />
              </svg>
            </div>
            {/* Order Book Depth */}
            <div className="space-y-2">
              <span className="text-label-caps text-[10px] text-zinc-500 tracking-widest block">ORDER_BOOK_DEPTH</span>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px] font-mono">
                  <span className="text-red-400/80">64,835.00</span>
                  <span className="text-zinc-500">0.421 BTC</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-mono">
                  <span className="text-red-400/80">64,828.50</span>
                  <span className="text-zinc-500">1.105 BTC</span>
                </div>
                <div className="h-px bg-white/10 my-1"></div>
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
              <span className="material-symbols-outlined text-[12px]">lock</span>
              SECURE_ENCRYPTION_ACTIVE
            </div>
          </div>
        </div>

        {/* Right: Execution Form */}
        <div className="w-full md:w-7/12 p-6 bg-surface flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-1">
                <button
                  onClick={() => setSide('BUY')}
                  className={`px-6 py-2 text-label-caps text-[11px] transition-colors cursor-pointer ${
                    side === 'BUY' ? 'bg-white/5 border border-white/20 text-zinc-100' : 'border border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >BUY</button>
                <button
                  onClick={() => setSide('SELL')}
                  className={`px-6 py-2 text-label-caps text-[11px] transition-colors cursor-pointer ${
                    side === 'SELL' ? 'bg-white/5 border border-white/20 text-zinc-100' : 'border border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >SELL</button>
              </div>
              <span className="material-symbols-outlined text-zinc-600 cursor-pointer hover:text-zinc-300">close</span>
            </div>
            <div className="space-y-6">
              {/* Amount Input */}
              <div className="group">
                <label className="text-label-caps text-[10px] text-zinc-500 mb-2 block">EXECUTION_SIZE (USD)</label>
                <div className="relative">
                  <input
                    className="w-full bg-[#121212] border-b border-white/10 focus:border-zinc-200 outline-none text-xl font-mono py-2 text-primary-fixed transition-all px-0"
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <span className="absolute right-0 bottom-2 text-label-caps text-[10px] text-zinc-600">MAX_AVAIL: $42,801.12</span>
                </div>
              </div>
              {/* Order Type + Leverage */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-label-caps text-[10px] text-zinc-500 mb-2 block">ORDER_TYPE</label>
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
                  <label className="text-label-caps text-[10px] text-zinc-500 mb-2 block">LEVERAGE</label>
                  <div className="relative">
                    <input className="w-full bg-[#121212] border-b border-white/10 focus:border-zinc-200 outline-none text-sm font-mono py-2 text-zinc-300 px-0" type="text" defaultValue="10X" />
                    <span className="absolute right-0 bottom-3 material-symbols-outlined text-xs text-zinc-600">edit</span>
                  </div>
                </div>
              </div>
              {/* Summary Metrics */}
              <div className="bg-white/[0.02] p-4 border border-white/5 space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-500">ESTIMATED_QUANTITY</span>
                  <span className="font-mono text-zinc-300">0.192842 BTC</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-500">MARGIN_REQUIRED</span>
                  <span className="font-mono text-zinc-300">$1,250.00</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-500">EST_SLIPPAGE</span>
                  <span className="font-mono text-zinc-300">0.05%</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12">
            <button className="w-full bg-primary-fixed text-on-primary-fixed text-headline-lg text-lg py-4 flex items-center justify-center gap-3 hover:bg-white transition-all active:scale-[0.99] group shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer">
              <span className="font-bold tracking-tighter uppercase">Execute Trade</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
            <p className="text-center text-[9px] text-zinc-600 mt-4 uppercase tracking-[0.2em] font-medium">Final confirmation required in next step</p>
          </div>
        </div>
      </div>

      {/* Background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
    </div>
  );
};
