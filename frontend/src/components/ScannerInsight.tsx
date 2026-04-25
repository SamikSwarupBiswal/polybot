import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';

export const ScannerInsight: React.FC = () => {
  const { connected, activePositions } = usePolybotStore();

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#050505] text-[#e5e2e1] p-5 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        <section className="mb-6 glass-panel relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 hidden md:block">
            <img
              className="w-full h-full object-cover grayscale"
              alt="Scanner art"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEL3KpBieJL2ZiOg6NF9iWiD9UnhFJOXYQzxYtgtBoD6KuSeZ3AGjwojTQuik4p0FsGzvOcYw1jccHnj5rjEUDohS12jmd05Cw3lIYOI1QOktFwJFdf9p6qwiGqH7N3EDsPoeaNxyncc3Y7p6TK21Ktp_8oVKhp2ygbXHYPkhJGGTlYFBNXC0CnwhTFmOueEAxuequbikqclDwM8LQXa9qUFkur-Nhy03QRPnuWg9h0CR4fb9oClcG_5l9qNtwGgt6vT1FIbzDcZfu"
            />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#aae9cf]' : 'bg-[#ffb4ab]'}`}></span>
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">Global Market Intelligence</p>
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100">BTC SYMBOLIC THRESHOLD: $100,000.00</h1>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">Current Price</p>
                  <p className="text-xl font-bold">$98,432.12</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">24H Change</p>
                  <p className="text-xl font-bold text-[#aae9cf]">+4.28%</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">Active Trades</p>
                  <p className="text-xl font-bold">{activePositions}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <button className="bg-[#e2e2e6] text-[#050505] px-6 py-3 font-bold text-xs uppercase tracking-widest rounded">Analyze Flow</button>
              <button className="border border-white/10 bg-white/5 px-6 py-3 text-zinc-100 font-bold text-xs uppercase tracking-widest rounded">Alert Setup</button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          <div className="md:col-span-8 glass-panel min-h-[420px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-zinc-100 text-2xl font-medium">Price Dynamics</h2>
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
                <button className="px-3 py-1 text-[10px] font-bold text-zinc-100 bg-white/10 rounded">1H</button>
                <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-100">4H</button>
                <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-100">1D</button>
              </div>
            </div>
            <div className="flex-grow flex items-end gap-1 relative overflow-hidden">
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-4 pointer-events-none">
                {[...Array(32)].map((_, i) => <div key={i} className="border-t border-white/5 border-l border-white/5" />)}
              </div>
              <svg className="absolute inset-0 w-full h-full drop-shadow-[0_0_20px_rgba(170,233,207,0.2)]" viewBox="0 0 1000 400" preserveAspectRatio="none">
                <path d="M0,350 Q100,320 200,340 T400,280 T600,290 T800,180 T1000,100" fill="none" stroke="#aae9cf" strokeLinecap="round" strokeWidth="3" />
                <path d="M0,350 Q100,320 200,340 T400,280 T600,290 T800,180 T1000,100 L1000,400 L0,400 Z" fill="url(#grad1)" opacity="0.1" />
                <defs>
                  <linearGradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#aae9cf', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#aae9cf', stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="md:col-span-4 glass-panel flex flex-col">
            <h3 className="text-zinc-500 mb-4 uppercase tracking-widest text-xs font-semibold">Institutional Order Flow</h3>
            <div className="space-y-4 overflow-y-auto max-h-[330px] obsidian-scrollbar">
              {[
                ['Buy Order', '42.8 BTC', '$98,430', 'Binance Futures', '#aae9cf'],
                ['Sell Order', '12.5 BTC', '$98,510', 'Coinbase Pro', '#ffb4ab'],
                ['Liquidity Pool', '1.2M USDT', 'ETH/BTC', 'Uniswap v3', '#e5e2e1']
              ].map(([type, value, px, venue, color]) => (
                <div key={String(type)} className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">{type}</p>
                    <p className="text-2xl font-medium" style={{ color }}>{value}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-100 font-bold">{px}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{venue}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-auto w-full py-4 bg-white/5 text-zinc-400 font-bold text-[10px] uppercase tracking-widest rounded">View Full Depth</button>
          </div>

          <div className="md:col-span-5 glass-panel">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-zinc-500 uppercase tracking-widest text-xs font-semibold">Macro Intelligence</h3>
              <span className="text-[10px] font-bold text-[#aae9cf] px-2 py-0.5 border border-[#aae9cf]/30 rounded uppercase">Live Feed</span>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 border border-white/10">
                  <img className="w-full h-full object-cover grayscale" alt="News article" src="https://lh3.googleusercontent.com/aida-public/AB6AXuABRPzB6YsM0D4d6QUrCxsPNdXHX4QROMo2Bbn68v7T-zljqLO_eBVs9pOavDMBgmdxUQci01hgoIO1vUuelB5m5PMat3XYUAQJG660uqJT93yyDDBubgJKXNX4QgyN3x1UTIxb8vzu-kOCt8iOLh62Jkk4lEgox2jzuIAWMXlxTfJNCF82FGk6xo5HZwEuuff4EV_atRP0Igb9gFUsUuYwkepz6m6-NcBHj69CaM1-CET6vFDIpHojjM6MMO2p2mB0NEo_FCRRledh" />
                </div>
                <div>
                  <p className="text-[10px] text-[#aae9cf] font-bold mb-1 uppercase">Federal Reserve</p>
                  <h4 className="text-sm font-bold text-zinc-100 leading-tight mb-1">Interest rates maintained: impact on digital assets remains bullish.</h4>
                  <p className="text-[10px] text-zinc-500 uppercase">3 mins ago • Finance Wire</p>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-3 glass-panel flex flex-col justify-between">
            <div>
              <h3 className="text-zinc-500 mb-6 uppercase tracking-widest text-xs font-semibold">Scanner Latency</h3>
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

          <div className="md:col-span-4 glass-panel">
            <h3 className="text-zinc-500 mb-4 uppercase tracking-widest text-xs font-semibold">Liquidity Zones</h3>
            <div className="grid grid-cols-4 gap-2 h-40">
              {['80K', '85K', '90K', '100K', '60K', '70K', '75K', '95K'].map((label, i) => (
                <div key={label} className={`flex items-center justify-center text-[10px] font-bold rounded-sm border ${i === 3 ? 'bg-white/10 border-[#aae9cf]/50 text-[#aae9cf]' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}>
                  {label}
                </div>
              ))}
              <div className="col-span-2 bg-zinc-900 border border-white/5 rounded-sm"></div>
              <div className="col-span-2 bg-white/5 border border-white/10 rounded-sm"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
