import { useEffect, useState } from 'react';
import { usePolybotStore } from './store/usePolybotStore';
import { Dashboard } from './components/Dashboard';
import { ScannerInsight } from './components/ScannerInsight';
import { TradeModal } from './components/TradeModal';
import { TradeExecution } from './components/TradeExecution';
import { Configuration } from './components/Configuration';
import { BetAnalytics } from './components/BetAnalytics';

function App() {
  const { connect } = usePolybotStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'trade' | 'execution' | 'config' | 'analytics'>('dashboard');

  useEffect(() => {
    connect();
  }, [connect]);

  const topTabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'dashboard', label: 'Console' },
    { id: 'scanner', label: 'Network' },
    { id: 'trade', label: 'Vault' },
    { id: 'execution', label: 'Execution' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'config', label: 'Config' }
  ];

  const sideTabs: Array<{ id: typeof activeTab; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Root', icon: 'folder_open' },
    { id: 'scanner', label: 'Scanner', icon: 'radar' },
    { id: 'execution', label: 'Execution', icon: 'swap_horiz' },
    { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
    { id: 'trade', label: 'Trade', icon: 'account_balance_wallet' },
    { id: 'config', label: 'Config', icon: 'settings' }
  ];

  const renderActiveView = () => {
    if (activeTab === 'dashboard') return <Dashboard />;
    if (activeTab === 'scanner') return <ScannerInsight />;
    if (activeTab === 'trade') return <div className="p-12 min-h-screen flex items-center justify-center relative"><TradeModal /></div>;
    if (activeTab === 'execution') return <TradeExecution />;
    if (activeTab === 'analytics') return <BetAnalytics />;
    return <Configuration />;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e2e1] relative">
      <header className="fixed top-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 flex justify-between items-center w-full px-6 h-14">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-black tracking-tighter text-zinc-100 uppercase">OBSIDIAN_OS</h1>
          <nav className="hidden md:flex items-center gap-6">
            {topTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`font-sans tracking-tight text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'text-zinc-100 border-b border-zinc-200 pb-1'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white/5 px-3 py-1.5 flex items-center gap-2 border border-white/10">
            <span className="material-symbols-outlined text-zinc-500 text-sm">search</span>
            <input className="bg-transparent border-none focus:ring-0 text-xs text-zinc-300 w-48 p-0 uppercase" placeholder="QUERY_SYSTEM..." type="text" />
          </div>
          <span className="material-symbols-outlined text-zinc-400 hover:bg-white/5 p-2 transition-all duration-200 cursor-pointer">terminal</span>
          <span className="material-symbols-outlined text-zinc-400 hover:bg-white/5 p-2 transition-all duration-200 cursor-pointer">settings</span>
        </div>
      </header>

      <div className="flex min-h-screen pt-14">
        <aside className="hidden md:flex flex-col h-[calc(100vh-56px)] border-r border-white/5 bg-zinc-950 w-64 fixed left-0 top-14">
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-sm bg-[#3c475a] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#bcc7dd] text-base">hub</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-tighter">NODE_MANAGER</h3>
                <p className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">Local Instance</p>
              </div>
            </div>
            <button className="w-full py-2 bg-[#dcdce0] text-[#2f3034] text-[10px] uppercase tracking-widest font-bold transition-all duration-200 active:opacity-80">
              New Instance
            </button>
          </div>
          <nav className="flex-1 py-4 overflow-y-auto obsidian-scrollbar">
            <div className="px-3 mb-2">
              <p className="px-4 text-[9px] font-bold text-zinc-600 tracking-[0.2em] uppercase">Navigation</p>
            </div>
            {sideTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left py-3 px-4 flex items-center gap-3 uppercase text-[10px] tracking-widest font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-white/5 text-zinc-100 border-r-2 border-zinc-400'
                    : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.02]'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="w-full md:ml-64">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}

export default App;
