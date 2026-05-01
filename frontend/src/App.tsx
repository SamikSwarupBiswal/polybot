import { useEffect, useState } from 'react';
import { usePolybotStore } from './store/usePolybotStore';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { Scanner } from './pages/Scanner';
import { Analytics } from './pages/Analytics';
import { Execution } from './pages/Execution';
import { Config } from './pages/Config';
import { TradeModal } from './components/TradeModal';

function App() {
  const { connect } = usePolybotStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tradeModalOpen, setTradeModalOpen] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  const handleTabChange = (tab: string) => {
    if (tab === 'execution') {
      // Check if we should open modal or go to execution page
      setActiveTab(tab);
    } else {
      setActiveTab(tab);
    }
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'scanner':
        return <Scanner />;
      case 'analytics':
        return <Analytics />;
      case 'execution':
        return <Execution />;
      case 'config':
        return <Config />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <AppShell activeTab={activeTab} onTabChange={handleTabChange}>
        {renderPage()}
      </AppShell>
      <TradeModal isOpen={tradeModalOpen} onClose={() => setTradeModalOpen(false)} />
    </>
  );
}

export default App;
