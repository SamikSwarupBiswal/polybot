import React, { useState, useEffect, useCallback } from 'react';
import { usePolybotStore } from '../store/usePolybotStore';
import { ActiveBetGraph } from '../components/ActiveBetGraph';

const API_BASE = '';

interface EngineStatus {
  status: string;
  uptime: string;
  geminiEnabled: boolean;
  wsClients: number;
  walletBalance: number;
}

export const Dashboard: React.FC = () => {
  const { connected, balance, metrics, trades } = usePolybotStore();
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [walletInput, setWalletInput] = useState('10000');
  const [walletAction, setWalletAction] = useState<'deposit' | 'reset'>('deposit');
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletMsg, setWalletMsg] = useState('');

  const openTrades = trades.filter((t) => t.status === 'OPEN');
  const recentTrades = [...trades].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 6);

  // Poll engine status
  useEffect(() => {
    const poll = () => {
      fetch(`${API_BASE}/api/status`)
        .then(r => r.json())
        .then(data => setEngineStatus(data))
        .catch(() => setEngineStatus(null));
      
      // Also poll wallet balance if websocket is not connected
      if (!usePolybotStore.getState().connected) {
        fetch(`${API_BASE}/api/wallet`)
          .then(r => r.json())
          .then(data => {
            if (data.balance !== undefined) {
              usePolybotStore.setState(state => ({ ...state, balance: data.balance }));
            }
          })
          .catch(() => {});
      }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, []);

  const handleWalletAction = useCallback(async () => {
    const amount = parseFloat(walletInput);
    if (isNaN(amount) || amount <= 0) return;
    setWalletSaving(true);
    setWalletMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: walletAction, amount }),
      });
      const data = await res.json();
      if (data.success) {
        usePolybotStore.setState({ balance: data.newBalance });
        setWalletMsg(`✓ ${walletAction === 'deposit' ? 'Deposited' : 'Reset to'} $${amount.toLocaleString()}`);
      } else {
        setWalletMsg(`✗ ${data.error}`);
      }
    } catch {
      setWalletMsg('✗ Backend not reachable');
    }
    setWalletSaving(false);
  }, [walletInput, walletAction]);

  const engineOnline = connected;

  return (
    <div className="p-5 flex gap-5 h-[calc(100vh-56px)] overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-5 overflow-y-auto obsidian-scrollbar pr-2">
        {/* Header */}
        <section className="flex flex-col gap-1">
          <h1 className="text-headline-xl text-zinc-100">POLYBOT_TERMINAL</h1>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${engineOnline ? 'bg-tertiary shadow-[0_0_12px_rgba(170,233,207,0.7)] animate-pulse' : 'bg-error shadow-[0_0_12px_rgba(255,180,171,0.7)]'}`}></span>
              <span className={`text-label-caps ${engineOnline ? 'text-tertiary' : 'text-error'}`}>
                {engineOnline ? 'ENGINE_ONLINE' : 'ENGINE_OFFLINE'}
              </span>
            </span>
            <span className="text-zinc-600 text-label-caps">
              Uptime: {engineStatus?.uptime || '00:00:00'}
            </span>
            {engineStatus?.geminiEnabled && (
              <span className="text-[9px] bg-tertiary/10 text-tertiary px-2 py-0.5 border border-tertiary/20 uppercase tracking-widest font-bold">Gemini Active</span>
            )}
          </div>
        </section>

        {/* Engine Offline Banner */}
        {!engineOnline && (
          <section className="bg-error/5 border border-error/20 p-6">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-error text-2xl mt-0.5">power_off</span>
              <div className="flex-1">
                <h3 className="text-zinc-100 font-bold text-sm mb-2">Trading Engine Not Running</h3>
                <p className="text-zinc-400 text-xs mb-4 leading-relaxed">
                  The autonomous trading engine must be started from the backend terminal. 
                  It connects to live Polymarket data, runs the AI reasoning loop with Gemini, and executes virtual trades automatically.
                </p>
                <div className="bg-black/40 border border-white/10 p-4 font-mono text-xs text-zinc-300">
                  <p className="text-zinc-500 mb-1"># Open a new terminal and run:</p>
                  <p className="text-tertiary">cd MVP</p>
                  <p className="text-tertiary">npm start</p>
                </div>
                <p className="text-[10px] text-zinc-600 mt-3">
                  Make sure your <code className="text-zinc-400 bg-white/5 px-1">GEMINI_API_KEY</code> is set in the Config page before starting.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Virtual Wallet & Stats */}
        <section className="grid grid-cols-12 gap-5">
          {/* Wallet Panel */}
          <div className="col-span-7 matte-surface p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-label-caps text-zinc-500 tracking-[0.2em] uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                Virtual Wallet
              </h2>
              <span className="text-[9px] text-zinc-600 bg-white/5 px-2 py-0.5 uppercase tracking-widest border border-white/5">Paper Trading</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-headline-xl text-zinc-100">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-zinc-500 text-xs uppercase tracking-widest">Available</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white/[0.02] border border-white/5 p-3">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Open Trades</p>
                <p className="text-lg text-zinc-100 font-bold">{openTrades.length}</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 p-3">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Total PnL</p>
                <p className={`text-lg font-bold ${parseFloat(metrics?.totalPnl || '0') >= 0 ? 'text-tertiary' : 'text-error'}`}>
                  ${metrics?.totalPnl || '0.00'}
                </p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 p-3">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Win Rate</p>
                <p className="text-lg text-zinc-100 font-bold">{metrics?.winRate || '0.0%'}</p>
              </div>
            </div>
            {/* Wallet Controls */}
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <select
                  value={walletAction}
                  onChange={(e) => setWalletAction(e.target.value as 'deposit' | 'reset')}
                  className="bg-surface-container-lowest border border-white/10 text-zinc-300 text-xs px-3 py-2 outline-none focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="deposit">+ Deposit</option>
                  <option value="reset">↻ Reset</option>
                </select>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                  <input
                    type="number"
                    value={walletInput}
                    onChange={(e) => setWalletInput(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-white/10 text-zinc-100 font-mono text-sm pl-7 pr-4 py-2 outline-none focus:border-primary"
                    placeholder="Amount"
                    min="1"
                  />
                </div>
                <button
                  onClick={handleWalletAction}
                  disabled={walletSaving}
                  className="bg-primary text-on-primary px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {walletSaving ? '...' : 'Apply'}
                </button>
              </div>
              {walletMsg && (
                <p className={`text-[10px] mt-2 ${walletMsg.startsWith('✓') ? 'text-tertiary' : 'text-error'}`}>{walletMsg}</p>
              )}
              <p className="text-[10px] text-zinc-600 mt-1">Deposit adds funds. Reset clears all trades and sets a new starting balance.</p>
            </div>
          </div>
          {/* Stats Panel */}
          <div className="col-span-5 matte-surface p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-label-caps text-zinc-500 tracking-[0.2em] uppercase">Performance</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs">ROI</span>
                  <span className={`text-sm font-bold ${parseFloat(metrics?.roi || '0') >= 0 ? 'text-tertiary' : 'text-error'}`}>{metrics?.roi || '0.0%'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs">Max Drawdown</span>
                  <span className="text-sm font-bold text-error">{metrics?.maxDrawdown || '0.0%'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs">Total Trades</span>
                  <span className="text-sm font-bold text-zinc-200">{metrics?.totalTrades || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs">Wins / Closed</span>
                  <span className="text-sm font-bold text-zinc-200">{metrics?.wins || 0} / {metrics?.closedTrades || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs">Conservative Equity</span>
                  <span className="text-sm font-bold text-zinc-100">${metrics?.conservativeEquity || '0.00'}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-600 uppercase tracking-widest">Equity Progress</span>
                <span className="text-zinc-400">${balance.toFixed(0)} / $15,000</span>
              </div>
              <div className="w-full bg-white/5 h-1.5">
                <div className="bg-secondary h-full shadow-[0_0_8px_rgba(188,199,221,0.5)] transition-all duration-500" style={{ width: `${Math.min((balance / 15000) * 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </section>

        {/* Equity Curve */}
        <section className="matte-surface p-4 min-h-[320px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-zinc-300 text-xs uppercase tracking-[0.2em]">Equity Curve</h2>
          </div>
          <ActiveBetGraph />
        </section>

        {/* Live Trade Ledger */}
        <section className="flex flex-col gap-3">
          <h2 className="text-label-caps text-zinc-500 tracking-[0.2em] uppercase">Recent Trades</h2>
          {recentTrades.length === 0 ? (
            <div className="matte-surface p-8 flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-zinc-700 text-4xl">receipt_long</span>
              <p className="text-zinc-600 text-xs uppercase tracking-widest">No trades yet</p>
              <p className="text-zinc-700 text-[10px] max-w-sm text-center">
                Start the trading engine with <code className="text-zinc-500 bg-white/5 px-1">npm start</code> in the MVP directory. 
                The system will automatically scan Polymarket, find edges, and execute paper trades.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {recentTrades.map((trade) => (
                <div key={trade.trade_id} className="matte-surface p-4 border-l-2 border-l-transparent hover:border-l-primary transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold ${
                      trade.status === 'OPEN' ? 'bg-tertiary/10 text-tertiary border border-tertiary/20' :
                      trade.status === 'CLOSED_WIN' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      trade.status === 'CLOSED_LOSS' ? 'bg-error/10 text-error border border-error/20' :
                      'bg-white/5 text-zinc-500 border border-white/10'
                    }`}>
                      {trade.status.replace('CLOSED_', '')}
                    </span>
                    <span className={`text-xs font-bold ${trade.side === 'YES' ? 'text-tertiary' : 'text-error'}`}>
                      {trade.side}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 leading-snug mb-3 line-clamp-2">{trade.market_question}</p>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <p className="text-zinc-600 uppercase">Entry</p>
                      <p className="text-zinc-300 font-mono">${trade.entry_price.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-600 uppercase">Size</p>
                      <p className="text-zinc-300 font-mono">${trade.notional_cost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-600 uppercase">PnL</p>
                      <p className={`font-mono font-bold ${(trade.pnl ?? 0) >= 0 ? 'text-tertiary' : 'text-error'}`}>
                        {trade.pnl !== null ? `$${trade.pnl.toFixed(2)}` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Right Sidebar - How It Works */}
      <aside className="w-72 hidden xl:flex flex-col gap-3 h-full">
        <h2 className="text-label-caps text-zinc-500 tracking-[0.2em] uppercase px-1">How It Works</h2>
        <div className="flex-1 glass-panel p-4 overflow-y-auto obsidian-scrollbar flex flex-col gap-4 rounded-lg">
          <div className="space-y-3">
            {[
              { icon: 'radar', title: 'SCAN', desc: 'Scans live Polymarket every 15min via public API (FREE)', color: 'text-secondary' },
              { icon: 'analytics', title: 'PRICE', desc: 'Gets real bid/ask from CLOB orderbook (FREE)', color: 'text-zinc-400' },
              { icon: 'psychology', title: 'REASON', desc: 'Gemini estimates true probability of each event', color: 'text-tertiary' },
              { icon: 'gpp_good', title: 'RISK CHECK', desc: 'RiskGate validates drawdown, sizing, exposure', color: 'text-zinc-400' },
              { icon: 'bolt', title: 'EXECUTE', desc: 'Paper trade logged to Virtual Wallet', color: 'text-primary' },
              { icon: 'monitoring', title: 'MONITOR', desc: 'Tracks positions and resolves on market close', color: 'text-secondary' },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`material-symbols-outlined text-[16px] mt-0.5 ${step.color}`}>{step.icon}</span>
                <div>
                  <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">{step.title}</p>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-3 mt-2">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Data Sources</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                <span className="text-[10px] text-zinc-400">gamma-api.polymarket.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                <span className="text-[10px] text-zinc-400">clob.polymarket.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${engineStatus?.geminiEnabled ? 'bg-tertiary' : 'bg-zinc-600'}`}></span>
                <span className="text-[10px] text-zinc-400">Gemini AI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Balance */}
        <div className="matte-surface p-4 flex flex-col gap-2 rounded-sm">
          <div className="flex justify-between items-center">
            <span className="text-label-caps text-[10px] text-zinc-600">TOTAL_EQUITY</span>
            <span className="text-zinc-100 font-bold">${balance.toFixed(2)}</span>
          </div>
          <div className="w-full bg-white/5 h-1">
            <div className="bg-secondary h-full shadow-[0_0_8px_rgba(188,199,221,0.5)]" style={{ width: `${Math.min((balance / 15000) * 100, 100)}%` }}></div>
          </div>
        </div>
      </aside>
    </div>
  );
};
