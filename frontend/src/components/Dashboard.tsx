import React, { useEffect } from 'react';
import { usePolybotStore } from '../store/usePolybotStore';
import { ActiveBetGraph } from './ActiveBetGraph';
import { Activity, LayoutDashboard, Target, Wallet, Cpu } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const { connect, connected, balance, metrics, trades, activePositions } = usePolybotStore();

    useEffect(() => {
        connect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openTrades = trades.filter(t => t.status === 'OPEN');

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
                    <Cpu size={28} className="text-primary" />
                    <h2 style={{ fontSize: '1.2rem' }} className="text-glow">POLYBOT</h2>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--matrix-primary)', cursor: 'pointer' }}>
                        <LayoutDashboard size={18} />
                        <span className="mono">OVERVIEW</span>
                    </div>
                </nav>

                <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                            width: 8, height: 8, borderRadius: '50%', 
                            backgroundColor: connected ? 'var(--matrix-primary)' : 'var(--matrix-danger)',
                            boxShadow: connected ? '0 0 10px var(--matrix-primary)' : '0 0 10px var(--matrix-danger)'
                        }} />
                        <span className="mono text-muted" style={{ fontSize: '0.8rem' }}>
                            {connected ? 'SYSTEM ONLINE' : 'CONNECTION LOST'}
                        </span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header>
                    <h1 className="text-glow" style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Terminal Output</h1>
                    <p className="text-muted mono" style={{ fontSize: '0.9rem' }}>AUTONOMOUS PAPER TRADING ENGINE</p>
                </header>

                {/* KPI Board */}
                <section className="grid-cols-4">
                    <div className="glass-panel">
                        <div className="text-muted mono" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Wallet size={14}/> BALANCE
                        </div>
                        <div className="text-glow" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px' }}>
                            ${balance.toFixed(2)}
                        </div>
                    </div>
                    <div className="glass-panel">
                        <div className="text-muted mono" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Activity size={14}/> ALL-TIME ROI
                        </div>
                        <div className="text-glow" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px' }}>
                            {metrics?.roi || '0.0%'}
                        </div>
                    </div>
                    <div className="glass-panel">
                        <div className="text-muted mono" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Target size={14}/> WIN RATE
                        </div>
                        <div className="text-glow" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px', color: 'var(--matrix-primary)' }}>
                            {metrics?.winRate || '0.0%'}
                        </div>
                    </div>
                    <div className="glass-panel">
                        <div className="text-muted mono" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Cpu size={14}/> ACTIVE POSITIONS
                        </div>
                        <div className="text-glow" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px' }}>
                            {activePositions}
                        </div>
                    </div>
                </section>

                <section className="grid-cols-2">
                    <ActiveBetGraph />
                    
                    {/* Active Trades Ledger */}
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                        <h3 className="text-muted mb-4 mono">Live Execution Ledger</h3>
                        <div style={{ flex: 1, overflowY: 'auto', marginTop: '15px', paddingRight: '10px' }}>
                            {openTrades.length === 0 ? (
                                <p className="text-muted mono" style={{ textAlign: 'center', marginTop: '20%' }}>NO ACTIVE TRADES</p>
                            ) : (
                                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {openTrades.map(trade => (
                                        <li key={trade.trade_id} style={{ 
                                            background: 'rgba(5, 20, 10, 0.4)', 
                                            border: '1px solid rgba(0, 255, 65, 0.1)',
                                            padding: '12px',
                                            borderRadius: '6px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--matrix-text-muted)' }}>{trade.market_id.substring(0,8)}</span>
                                                <span className="badge badge-open">{trade.mode}</span>
                                            </div>
                                            <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>{trade.market_question}</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }} className="mono text-glow">
                                                <span>{trade.side}</span>
                                                <span>Size: ${trade.notional_cost.toFixed(2)}</span>
                                                <span>Entry: ${trade.entry_price.toFixed(3)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};
