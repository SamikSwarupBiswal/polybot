import React, { useState } from 'react';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({ isOpen, onClose }) => {
  const [positionSize, setPositionSize] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [autoSell, setAutoSell] = useState('');
  const [mevProtection, setMevProtection] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 glass-overlay z-[60]" onClick={onClose}></div>

      {/* Background image */}
      <div
        className="fixed inset-0 z-[55] opacity-20"
        style={{
          backgroundImage: `url('/images/modal-bg.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      ></div>

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
        <div className="w-full max-w-[480px] bg-[#0D0D0D] border border-white/[0.08] p-12 flex flex-col gap-6 shadow-2xl">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-label-caps text-outline uppercase">Transaction Terminal</span>
              <h1 className="text-headline-lg text-on-surface">Execute Trade</h1>
            </div>
            <button onClick={onClose} className="text-outline hover:text-on-surface transition-colors cursor-pointer">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Asset Overview */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-container-low border border-white/5 p-4 flex flex-col gap-1">
              <span className="text-label-caps text-[10px] text-outline uppercase tracking-widest">Asset Pair</span>
              <span className="text-headline-lg text-xl text-primary">BTC / USDC</span>
            </div>
            <div className="bg-surface-container-low border border-white/5 p-4 flex flex-col gap-1">
              <span className="text-label-caps text-[10px] text-outline uppercase tracking-widest">Market Price</span>
              <span className="text-headline-lg text-xl text-tertiary">$64,281.90</span>
            </div>
          </div>

          {/* Form Fields */}
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            {/* Position Size */}
            <div className="flex flex-col gap-1">
              <label className="text-label-caps text-[11px] text-outline uppercase tracking-widest">Position Size (USDC)</label>
              <div className="relative">
                <input
                  className="w-full bg-surface-container-lowest border border-white/10 focus:border-primary px-4 py-2 text-headline-lg text-lg outline-none text-on-surface transition-all"
                  placeholder="0.00"
                  type="text"
                  value={positionSize}
                  onChange={(e) => setPositionSize(e.target.value)}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                  <button type="button" className="px-1 py-1 border border-white/10 text-[10px] font-bold text-outline hover:bg-white/5 cursor-pointer">25%</button>
                  <button type="button" className="px-1 py-1 border border-white/10 text-[10px] font-bold text-outline hover:bg-white/5 cursor-pointer">50%</button>
                  <button type="button" className="px-1 py-1 border border-white/10 text-[10px] font-bold text-outline hover:bg-white/5 cursor-pointer">MAX</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Slippage */}
              <div className="flex flex-col gap-1">
                <label className="text-label-caps text-[11px] text-outline uppercase tracking-widest">Slippage Tolerance</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-lowest border border-white/10 focus:border-primary px-4 py-2 text-body-md outline-none text-on-surface"
                    type="text"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-outline text-sm">%</span>
                </div>
              </div>
              {/* Auto-Sell */}
              <div className="flex flex-col gap-1">
                <label className="text-label-caps text-[11px] text-outline uppercase tracking-widest">Auto-Sell Target</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-lowest border border-white/10 focus:border-primary px-4 py-2 text-body-md outline-none text-on-surface"
                    placeholder="+10.0"
                    type="text"
                    value={autoSell}
                    onChange={(e) => setAutoSell(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-outline text-sm">%</span>
                </div>
              </div>
            </div>

            {/* MEV Toggle */}
            <div className="flex items-center justify-between py-1 border-y border-white/5 mt-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-sm">security</span>
                <span className="text-body-sm text-outline">MEV Protection</span>
              </div>
              <button
                type="button"
                onClick={() => setMevProtection(!mevProtection)}
                className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${mevProtection ? 'bg-tertiary' : 'bg-zinc-800'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${mevProtection ? 'left-4 bg-white' : 'left-0.5 bg-zinc-400'}`}></div>
              </button>
            </div>

            {/* Execute Button */}
            <button
              type="submit"
              className="mt-4 w-full bg-secondary-container text-on-secondary-container py-4 text-headline-lg text-lg uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all border border-white/10 shadow-[0_0_20px_rgba(60,71,90,0.3)] cursor-pointer"
            >
              Execute Order
            </button>
          </form>

          {/* Footer Info */}
          <div className="flex flex-col gap-1 border-t border-white/5 pt-4">
            <div className="flex justify-between text-body-sm text-[12px]">
              <span className="text-outline">Estimated Gas Fee</span>
              <span className="text-on-surface">0.0012 ETH (~$4.12)</span>
            </div>
            <div className="flex justify-between text-body-sm text-[12px]">
              <span className="text-outline">Route</span>
              <span className="text-on-surface">Aggregator V3 (Direct)</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Alert */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[80]">
        <div className="bg-surface-container-high border-l-2 border-tertiary px-6 py-4 flex items-center gap-4 shadow-xl min-w-[300px]">
          <span className="material-symbols-outlined text-tertiary">check_circle</span>
          <div className="flex flex-col">
            <span className="text-label-caps text-[10px] text-tertiary uppercase">System Status</span>
            <span className="text-body-sm text-on-surface">Network Congestion: Low</span>
          </div>
        </div>
      </div>
    </>
  );
};
