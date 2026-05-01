import React from 'react';

export const Scanner: React.FC = () => {
  const orderFlow = [
    { type: 'Buy Order', amount: '42.8 BTC', price: '$98,430', exchange: 'Binance Futures', color: 'text-tertiary' },
    { type: 'Sell Order', amount: '12.5 BTC', price: '$98,510', exchange: 'Coinbase Pro', color: 'text-error' },
    { type: 'Liquidity Pool', amount: '1.2M USDT', price: 'ETH/BTC', exchange: 'Uniswap v3', color: 'text-zinc-100' },
    { type: 'Buy Order', amount: '8.1 BTC', price: '$98,415', exchange: 'Kraken', color: 'text-tertiary', dim: true },
  ];

  return (
    <div className="pt-6 p-6 min-h-[calc(100vh-56px)] overflow-y-auto no-scrollbar">
      {/* Hero Insight */}
      <section className="mb-12">
        <div className="glass-panel p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-10">
            <img className="w-full h-full object-cover grayscale" alt="Abstract crystalline structure" src="/images/scanner-hero.jpg" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_10px_rgba(170,233,207,0.5)]"></span>
              <p className="text-label-caps text-on-surface-variant uppercase tracking-widest">Global Market Intelligence / Scanner</p>
            </div>
            <h1 className="text-headline-xl text-primary mb-4">BTC SYMBOLIC THRESHOLD: <span className="text-white">$100,000.00</span></h1>
            <div className="flex gap-5">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Current Price</p>
                <p className="text-2xl font-bold text-zinc-100">$98,432.12</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">24H Change</p>
                <p className="text-2xl font-bold text-tertiary">+4.28%</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Market Sentiment</p>
                <p className="text-2xl font-bold text-zinc-100">EXTREME GREED</p>
              </div>
            </div>
          </div>
          <div className="relative z-10 flex gap-3">
            <button className="bg-primary-fixed text-on-primary-fixed px-6 py-3 font-bold text-xs uppercase tracking-widest rounded transition-all hover:brightness-110 active:scale-95 cursor-pointer">Analyze Flow</button>
            <button className="border border-white/10 bg-white/5 px-6 py-3 text-zinc-100 font-bold text-xs uppercase tracking-widest rounded hover:bg-white/10 transition-all cursor-pointer">Alert Setup</button>
          </div>
        </div>
      </section>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        {/* Main Chart */}
        <div className="md:col-span-8 glass-panel p-6 rounded-xl min-h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-headline-lg text-zinc-100">Price Dynamics</h2>
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
                <button className="px-3 py-1 text-[10px] font-bold text-zinc-100 bg-white/10 rounded">1H</button>
                <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-100">4H</button>
                <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-100">1D</button>
                <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-100">1W</button>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 border border-tertiary bg-tertiary/10 rounded-sm"></span>
                <span className="text-[10px] text-zinc-400 font-medium">SPOT PRICE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 border border-primary-container bg-primary-container/10 rounded-sm"></span>
                <span className="text-[10px] text-zinc-400 font-medium">AVG COST</span>
              </div>
            </div>
          </div>
          {/* SVG Chart */}
          <div className="flex-grow flex items-end gap-1 relative overflow-hidden group">
            <div className="absolute inset-0 grid grid-cols-8 grid-rows-4 pointer-events-none">
              {Array.from({ length: 32 }).map((_, i) => (
                <div key={i} className="border-t border-white/5 border-l border-white/5"></div>
              ))}
            </div>
            <svg className="absolute inset-0 w-full h-full drop-shadow-[0_0_20px_rgba(170,233,207,0.2)]" viewBox="0 0 1000 400">
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#aae9cf', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#aae9cf', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <path d="M0,350 Q100,320 200,340 T400,280 T600,290 T800,180 T1000,100" fill="none" stroke="#aae9cf" strokeLinecap="round" strokeWidth="3" />
              <path d="M0,350 Q100,320 200,340 T400,280 T600,290 T800,180 T1000,100 L1000,400 L0,400 Z" fill="url(#grad1)" opacity="0.1" />
            </svg>
            <div className="absolute right-10 top-20 border-l border-dashed border-white/20 h-full flex flex-col">
              <span className="bg-white/10 text-zinc-100 text-[10px] px-2 py-0.5 ml-2 font-bold">$100,000 RESISTANCE</span>
            </div>
          </div>
        </div>

        {/* Order Flow */}
        <div className="md:col-span-4 glass-panel p-6 rounded-xl flex flex-col">
          <h3 className="text-label-caps text-zinc-500 mb-6 uppercase tracking-widest">Institutional Order Flow</h3>
          <div className="space-y-4 overflow-y-auto max-h-[400px] no-scrollbar flex-1">
            {orderFlow.map((order, i) => (
              <div key={i} className={`flex justify-between items-center border-b border-white/5 pb-3 ${order.dim ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">{order.type}</p>
                  <p className={`text-headline-lg ${order.color}`}>{order.amount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-100 font-bold">{order.price}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{order.exchange}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-auto w-full py-4 bg-white/5 text-zinc-400 font-bold text-[10px] uppercase tracking-widest rounded hover:bg-white/10 transition-all cursor-pointer">View Full Depth</button>
        </div>

        {/* News / Intelligence */}
        <div className="md:col-span-5 glass-panel p-6 rounded-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-label-caps text-zinc-500 uppercase tracking-widest">Macro Intelligence</h3>
            <span className="text-[10px] font-bold text-tertiary px-2 py-0.5 border border-tertiary/30 rounded uppercase">Live Feed</span>
          </div>
          <div className="space-y-6">
            <div className="flex gap-4 group cursor-pointer">
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 border border-white/10">
                <img className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0 group-hover:scale-110" alt="Financial ticker" src="/images/news-ticker.jpg" />
              </div>
              <div>
                <p className="text-[10px] text-tertiary font-bold mb-1 uppercase tracking-tighter">Federal Reserve</p>
                <h4 className="text-sm font-bold text-zinc-100 leading-tight mb-1">Interest rates maintained: Impact on digital assets is notably bullish.</h4>
                <p className="text-[10px] text-zinc-500 uppercase font-medium">3 mins ago • Finance Wire</p>
              </div>
            </div>
            <div className="flex gap-4 group cursor-pointer">
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 border border-white/10">
                <img className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0 group-hover:scale-110" alt="Bitcoin coin" src="/images/news-bitcoin.jpg" />
              </div>
              <div>
                <p className="text-[10px] text-primary-fixed-dim font-bold mb-1 uppercase tracking-tighter">ETFs</p>
                <h4 className="text-sm font-bold text-zinc-100 leading-tight mb-1">Blackrock adds $500M BTC to spot holdings in massive midnight session.</h4>
                <p className="text-[10px] text-zinc-500 uppercase font-medium">14 mins ago • Market Intel</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scanner Latency */}
        <div className="md:col-span-3 glass-panel p-6 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-label-caps text-zinc-500 mb-6 uppercase tracking-widest">Scanner Latency</h3>
            <div className="relative w-full h-32 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-white/5"></div>
              <div className="absolute inset-4 rounded-full border border-white/5"></div>
              <div className="absolute inset-8 rounded-full border border-white/10"></div>
              <div className="relative flex flex-col items-center">
                <span className="text-2xl font-black text-tertiary">14ms</span>
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
              <div className="bg-tertiary w-full h-full"></div>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="md:col-span-4 glass-panel p-6 rounded-xl">
          <h3 className="text-label-caps text-zinc-500 mb-4 uppercase tracking-widest">Liquidity Zones</h3>
          <div className="grid grid-cols-4 gap-2 h-40">
            <div className="bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-600">80K</div>
            <div className="bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-bold text-zinc-500">85K</div>
            <div className="bg-zinc-700 border border-white/20 flex items-center justify-center text-[10px] font-bold text-zinc-400">90K</div>
            <div className="bg-white/10 border border-tertiary/50 flex items-center justify-center text-[10px] font-bold text-tertiary">100K</div>
            <div className="bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-600">60K</div>
            <div className="bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-600">70K</div>
            <div className="bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-600">75K</div>
            <div className="bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-bold text-zinc-500">95K</div>
            <div className="col-span-2 bg-zinc-900 border border-white/5"></div>
            <div className="col-span-2 bg-white/5 border border-white/10"></div>
          </div>
          <p className="mt-4 text-[10px] text-zinc-500 uppercase leading-relaxed font-medium">Aggregated liquidity heatmap suggests a "short squeeze" scenario if price crosses $100,500.</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 pb-6">
        <div className="text-[10px] font-bold uppercase tracking-widest">Obsidian Terminal v2.4.0-build.82</div>
        <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest">
          <span className="hover:text-zinc-100 transition-colors cursor-pointer">API Docs</span>
          <span className="hover:text-zinc-100 transition-colors cursor-pointer">Terms</span>
          <span className="hover:text-zinc-100 transition-colors cursor-pointer">Security</span>
          <span className="hover:text-zinc-100 transition-colors cursor-pointer">Status</span>
        </div>
      </footer>
    </div>
  );
};
