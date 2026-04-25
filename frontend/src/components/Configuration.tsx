import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';

export const Configuration: React.FC = () => {
  const { connected } = usePolybotStore();

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#050505] text-[#e5e2e1] p-5 md:p-6 relative">
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
      <div className="relative z-10 max-w-5xl mx-auto space-y-10">
        <section className="space-y-2">
          <h1 className="text-4xl font-semibold">SYSTEM_CONFIG</h1>
          <p className="text-zinc-500 text-sm">Modify environment variables, engine routing, and transmission endpoints.</p>
          <p className={`text-[10px] uppercase tracking-widest ${connected ? 'text-[#aae9cf]' : 'text-[#ffb4ab]'}`}>{connected ? 'Connected' : 'Disconnected'}</p>
        </section>

        <section className="space-y-6">
          <h2 className="tracking-[0.2em] text-zinc-400 uppercase text-xs font-semibold">API Access Credentials</h2>
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-8 matte-surface p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Primary API Key</label>
                <input className="w-full bg-[#0e0e0e] border border-white/10 text-zinc-100 mono text-sm tracking-widest px-4 py-3 outline-none" type="password" defaultValue="ob_live_51MszL6KDwR9WfX3y" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Enterprise Endpoint URL</label>
                <input className="w-full bg-[#0e0e0e] border border-white/10 text-zinc-100 mono text-sm px-4 py-3 outline-none" type="text" defaultValue="https://api.obsidian-os.net/v1/core" />
              </div>
            </div>
            <div className="col-span-4 matte-surface p-6 flex flex-col justify-between">
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Quota Status</p>
                <div className="text-2xl font-medium text-zinc-100">84.2%</div>
                <div className="h-1 bg-white/5 w-full"><div className="h-full bg-zinc-400 w-[84.2%]"></div></div>
              </div>
              <button className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1 mt-6 transition-colors">
                <span className="material-symbols-outlined">refresh</span>
                Refresh tokens
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="tracking-[0.2em] text-zinc-400 uppercase text-xs font-semibold">Neural Engine Routing</h2>
          <div className="grid grid-cols-3 gap-5">
            <div className="bg-white/[0.02] border border-[#dcdce0] p-6">
              <div className="flex justify-between items-start mb-6">
                <span className="material-symbols-outlined text-zinc-100">model_training</span>
                <span className="text-[10px] bg-zinc-100 text-zinc-950 px-2 py-0.5 font-black uppercase">Active</span>
              </div>
              <h3 className="text-lg text-zinc-100 mb-1 font-medium">OBSIDIAN_VII</h3>
              <p className="text-zinc-500 mb-6 text-sm">High-precision low-latency reasoning engine.</p>
            </div>
            <div className="matte-surface p-6"><h3 className="text-lg text-zinc-400">GHOST_SHELL</h3><p className="text-zinc-600 text-sm mt-1">Coding and architecture analysis module.</p></div>
            <div className="matte-surface p-6"><h3 className="text-lg text-zinc-400">VOID_LOCAL</h3><p className="text-zinc-600 text-sm mt-1">Air-gapped local deployment mode.</p></div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="tracking-[0.2em] text-zinc-400 uppercase text-xs font-semibold">Transmission Webhooks</h2>
          <div className="matte-surface divide-y divide-white/5">
            <div className="p-6 flex justify-between items-center">
              <div>
                <div className="text-zinc-100 font-medium text-sm">Deployment Success Hook</div>
                <div className="text-xs mono text-zinc-500">https://hooks.slack.com/services/T000...</div>
              </div>
              <span className="text-[10px] bg-green-900/20 text-green-400 px-3 py-1 border border-white/5 uppercase">Enabled</span>
            </div>
            <div className="p-6 flex justify-between items-center">
              <div>
                <div className="text-zinc-100 font-medium text-sm">Error Cascade Notification</div>
                <div className="text-xs mono text-zinc-500">https://pagerduty.io/v2/alerts/cascade...</div>
              </div>
              <span className="text-[10px] bg-zinc-900/20 text-zinc-500 px-3 py-1 border border-white/5 uppercase">Disabled</span>
            </div>
          </div>
        </section>

        <section className="pt-6 pb-8">
          <button className="w-full bg-[#dcdce0] text-[#2f3034] py-5 text-sm tracking-[0.3em] font-black uppercase hover:bg-zinc-100 transition-all active:scale-[0.99] border border-white/5">
            Synchronize & Commit Changes
          </button>
        </section>
      </div>
    </div>
  );
};
