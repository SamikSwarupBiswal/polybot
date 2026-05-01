import React from 'react';

interface SideNavBarProps {
  activeItem?: string;
  onNavigate?: (item: string) => void;
}

const navItems = [
  { id: 'dashboard', icon: 'folder_open', label: 'Root' },
  { id: 'analytics', icon: 'query_stats', label: 'Analytics' },
  { id: 'scanner', icon: 'hub', label: 'Nodes' },
  { id: 'execution', icon: 'rocket_launch', label: 'Deployment' },
  { id: 'config', icon: 'inventory_2', label: 'Archived' },
];

export const SideNavBar: React.FC<SideNavBarProps> = ({ activeItem = 'dashboard', onNavigate }) => {
  return (
    <aside className="hidden md:flex flex-col h-[calc(100vh-56px)] border-r border-white/5 bg-zinc-950 w-64 fixed left-0 top-14 z-40">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-sm bg-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-base">hub</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-tighter">NODE_MANAGER</h3>
            <p className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">Local Instance</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate?.('execution')}
          className="w-full py-2 bg-primary text-on-primary text-[10px] uppercase tracking-widest font-bold transition-all duration-200 active:opacity-80 cursor-pointer"
        >
          New Instance
        </button>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto obsidian-scrollbar">
        <div className="px-3 mb-2">
          <p className="px-4 text-[9px] font-bold text-zinc-600 tracking-[0.2em] uppercase">Navigation</p>
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className={`w-full text-left py-3 px-4 flex items-center gap-3 uppercase text-[10px] tracking-widest font-medium transition-all duration-300 cursor-pointer ${
              activeItem === item.id
                ? 'bg-white/5 text-zinc-100 border-r-2 border-zinc-400'
                : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.02]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-white/5">
        <button className="w-full text-left text-zinc-600 py-2 px-4 flex items-center gap-3 hover:text-zinc-300 uppercase text-[10px] tracking-widest font-medium transition-all duration-300 hover:bg-white/[0.02] cursor-pointer">
          <span className="material-symbols-outlined text-lg">memory</span>
          Diagnostics
        </button>
        <button className="w-full text-left text-zinc-600 py-2 px-4 flex items-center gap-3 hover:text-zinc-300 uppercase text-[10px] tracking-widest font-medium transition-all duration-300 hover:bg-white/[0.02] cursor-pointer">
          <span className="material-symbols-outlined text-lg">help_outline</span>
          Help
        </button>
      </div>
    </aside>
  );
};
