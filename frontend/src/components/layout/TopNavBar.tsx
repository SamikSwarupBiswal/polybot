import React from 'react';

interface TopNavBarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'dashboard', label: 'Console' },
    { id: 'scanner', label: 'Network' },
    { id: 'analytics', label: 'Vault' },
    { id: 'config', label: 'Process' },
  ];

  return (
    <header className="fixed top-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 flex justify-between items-center w-full px-6 h-14">
      <div className="flex items-center gap-8">
        <span className="text-lg font-black tracking-tighter text-zinc-100 uppercase">OBSIDIAN_OS</span>
        <nav className="hidden md:flex items-center gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={`font-sans tracking-tight text-sm transition-colors pb-1 cursor-pointer ${
                activeTab === tab.id
                  ? 'text-zinc-100 border-b border-zinc-200'
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
          <input
            className="bg-transparent border-none focus:ring-0 text-xs text-zinc-300 w-48 p-0 uppercase outline-none text-label-caps"
            placeholder="QUERY_SYSTEM..."
            type="text"
          />
        </div>
        <span className="material-symbols-outlined text-zinc-400 hover:bg-white/5 p-2 transition-all duration-200 cursor-pointer">terminal</span>
        <span className="material-symbols-outlined text-zinc-400 hover:bg-white/5 p-2 transition-all duration-200 cursor-pointer">settings</span>
      </div>
    </header>
  );
};
