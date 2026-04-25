import React, { useEffect } from 'react';
import { usePolybotStore } from '../store/usePolybotStore';
import { ActiveBetGraph } from './ActiveBetGraph';

export const Dashboard: React.FC = () => {
    const { connect, connected, balance, metrics, trades, activePositions } = usePolybotStore();

    useEffect(() => {
        connect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openTrades = trades.filter((t) => t.status === 'OPEN');
    const recentTrades = openTrades.slice(0, 4);

    return (
        <div className="min-h-[calc(100vh-56px)] bg-[#050505] text-[#e5e2e1] p-5 md:p-6">
            <div className="max-w-[1400px] mx-auto flex flex-col gap-6">
                <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100">POLYBOT_TERMINAL</h1>
                        <div className="mt-2 flex items-center gap-3">
                            <span className="inline-flex items-center gap-2 text-[#bcc7dd] text-[10px] tracking-[0.2em] uppercase font-semibold">
                                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#aae9cf] shadow-[0_0_12px_rgba(170,233,207,0.7)]' : 'bg-[#ffb4ab] shadow-[0_0_12px_rgba(255,180,171,0.7)]'}`}></span>
                                {connected ? 'System_Online' : 'System_Offline'}
                            </span>
                            <span className="text-zinc-600 text-[10px] tracking-[0.2em] uppercase">
                                Active Positions: {activePositions}
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="matte-surface px-4 py-3">
                            <p className="text-[10px] text-zinc-500 tracking-widest uppercase">Balance</p>
                            <p className="text-xl font-bold text-zinc-100 mt-1">${balance.toFixed(2)}</p>
                        </div>
                        <div className="matte-surface px-4 py-3">
                            <p className="text-[10px] text-zinc-500 tracking-widest uppercase">ROI</p>
                            <p className="text-xl font-bold text-zinc-100 mt-1">{metrics?.roi || '0.0%'}</p>
                        </div>
                        <div className="matte-surface px-4 py-3">
                            <p className="text-[10px] text-zinc-500 tracking-widest uppercase">Win Rate</p>
                            <p className="text-xl font-bold text-[#aae9cf] mt-1">{metrics?.winRate || '0.0%'}</p>
                        </div>
                        <div className="matte-surface px-4 py-3">
                            <p className="text-[10px] text-zinc-500 tracking-widest uppercase">Max Drawdown</p>
                            <p className="text-xl font-bold text-zinc-100 mt-1">{metrics?.maxDrawdown || '0.0%'}</p>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    <div className="xl:col-span-8 glass-panel min-h-[390px]">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-zinc-300 text-xs uppercase tracking-[0.2em]">Equity Curve</h2>
                            <div className="flex gap-2 text-[10px]">
                                <button className="px-2 py-1 bg-white/10 border border-white/10">1H</button>
                                <button className="px-2 py-1 text-zinc-500 border border-transparent hover:border-white/10">4H</button>
                                <button className="px-2 py-1 text-zinc-500 border border-transparent hover:border-white/10">1D</button>
                            </div>
                        </div>
                        <ActiveBetGraph />
                    </div>

                    <div className="xl:col-span-4 glass-panel min-h-[390px] flex flex-col">
                        <h2 className="text-zinc-300 text-xs uppercase tracking-[0.2em] mb-4">Live Execution Ledger</h2>
                        <div className="flex-1 space-y-3 overflow-y-auto obsidian-scrollbar pr-1">
                            {recentTrades.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-zinc-600 text-xs uppercase tracking-widest">
                                    No Active Trades
                                </div>
                            ) : (
                                recentTrades.map((trade) => (
                                    <div key={trade.trade_id} className="bg-white/[0.02] border border-white/10 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                                {trade.market_id.slice(0, 10)}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 bg-white/10 border border-white/10 uppercase">
                                                {trade.mode}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-200 leading-snug mb-2 line-clamp-2">{trade.market_question}</p>
                                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                                            <div>
                                                <p className="text-zinc-500 uppercase">Side</p>
                                                <p className={trade.side === 'YES' ? 'text-[#aae9cf] font-semibold' : 'text-[#ffb4ab] font-semibold'}>
                                                    {trade.side}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500 uppercase">Size</p>
                                                <p className="text-zinc-200 font-semibold">${trade.notional_cost.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500 uppercase">Entry</p>
                                                <p className="text-zinc-200 font-semibold">${trade.entry_price.toFixed(3)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>

                <section className="matte-surface p-4">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                        <span>System Logs</span>
                        <span>{new Date().toUTCString()}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="bg-white/[0.02] border border-white/10 p-3">
                            <p className="text-zinc-500 uppercase text-[10px] mb-1">Health</p>
                            <p className={connected ? 'text-[#aae9cf]' : 'text-[#ffb4ab]'}>
                                {connected ? 'Node stable and connected.' : 'Node disconnected, retrying...'}
                            </p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/10 p-3">
                            <p className="text-zinc-500 uppercase text-[10px] mb-1">Trades</p>
                            <p className="text-zinc-200">Open: {openTrades.length} | Total: {trades.length}</p>
                        </div>
                        <div className="bg-white/[0.02] border border-white/10 p-3">
                            <p className="text-zinc-500 uppercase text-[10px] mb-1">Risk</p>
                            <p className="text-zinc-200">Max Drawdown: {metrics?.maxDrawdown || '0.0%'}</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
