import React from 'react';
import { TopNavBar } from './TopNavBar';
import { SideNavBar } from './SideNavBar';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({ children, activeTab, onTabChange }) => {
  return (
    <div className="bg-[#050505] text-[#e5e2e1] min-h-screen overflow-hidden">
      <TopNavBar activeTab={activeTab} onTabChange={onTabChange} />
      <div className="flex pt-14">
        <SideNavBar activeItem={activeTab} onNavigate={onTabChange} />
        <main className="w-full md:ml-64 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
      {/* Floating Action Button */}
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={() => onTabChange('execution')}
          className="flex items-center gap-2 bg-zinc-100 text-zinc-950 px-6 py-3 text-xs tracking-widest uppercase shadow-2xl hover:bg-white transition-all transform active:scale-95 group cursor-pointer text-label-caps font-bold"
        >
          <span className="material-symbols-outlined text-lg group-hover:rotate-90 transition-transform duration-300">add</span>
          NEW_EXECUTION
        </button>
      </div>
    </div>
  );
};
