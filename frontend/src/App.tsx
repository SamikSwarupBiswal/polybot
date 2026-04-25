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

  // Very brutalist tab switcher
  const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 font-mono text-sm border-r border-[#333] transition-colors
        ${activeTab === id ? 'bg-[--matrix-neon] text-black font-bold' : 'hover:bg-[#222]'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[--matrix-bg] text-[--matrix-text] flex flex-col font-mono relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanline pointer-events-none opacity-10"></div>
      
      {/* Header bar */}
      <header className="border-b border-[#333] bg-black/80 backdrop-blur-sm z-10 flex flex-col md:flex-row md:items-center justify-between">
        <div className="px-6 py-4 flex items-center gap-4 border-b md:border-b-0 border-[#333]">
          <div className="w-3 h-3 bg-[--matrix-green] animate-pulse"></div>
          <h1 className="text-xl font-bold tracking-widest text-[--matrix-green]">POLYBOT_OS</h1>
        </div>
        <div className="flex overflow-x-auto">
          <TabButton id="dashboard" label="DASHBOARD" />
          <TabButton id="scanner" label="SCANNER" />
          <TabButton id="trade" label="TRADE_MODAL" />
          <TabButton id="execution" label="EXECUTION" />
          <TabButton id="analytics" label="ANALYTICS" />
          <TabButton id="config" label="CONFIG" />
        </div>
      </header>

      {/* Render Active View */}
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'scanner' && <ScannerInsight />}
      {activeTab === 'trade' && <div className="p-12 min-h-screen flex items-center justify-center relative"><TradeModal /></div>}
      {activeTab === 'execution' && <TradeExecution />}
      {activeTab === 'analytics' && <BetAnalytics />}
      {activeTab === 'config' && <Configuration />}
    </div>
  );
}

export default App;
