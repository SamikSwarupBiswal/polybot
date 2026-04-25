import React from 'react';
import { usePolybotStore } from '../store/usePolybotStore';

export const Configuration: React.FC = () => {
    const { connected } = usePolybotStore();
    return (
        <div className="dark bg-[#050505] text-[#e5e2e1] font-inter min-h-screen">
            {/* Visual Decorative Element: Grid Backdrop */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>

            {/* Sidebar Navigation */}
            <aside className="fixed left-0 top-0 h-full w-64 border-r border-white/5 bg-zinc-950 flex flex-col z-50">
                <div className="p-6 flex flex-col gap-1">
                    <span className="text-xs font-bold text-zinc-100 font-label-caps tracking-widest uppercase">NODE_MANAGER</span>
                    <span className={`text-[10px] tracking-widest font-medium uppercase ${connected ? 'text-green-400' : 'text-red-400'}`}>{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
                <nav className="mt-6 flex-grow flex flex-col">
                    <a className="text-zinc-600 py-3 px-4 flex items-center gap-3 hover:text-zinc-300 hover:bg-white/[0.02] ease-out duration-300 cursor-pointer">
                        <span className="material-symbols-outlined">folder_open</span>
                        <span className="font-label-caps text-[10px] tracking-widest uppercase">Root</span>
                    </a>
                    <a className="text-zinc-600 py-3 px-4 flex items-center gap-3 hover:text-zinc-300 hover:bg-white/[0.02] ease-out duration-300 cursor-pointer">
                        <span className="material-symbols-outlined">query_stats</span>
                        <span className="font-label-caps text-[10px] tracking-widest uppercase">Analytics</span>
                    </a>
                    <a className="bg-white/5 text-zinc-100 border-r-2 border-zinc-400 py-3 px-4 flex items-center gap-3 ease-out duration-300 cursor-pointer">
                        <span className="material-symbols-outlined">hub</span>
                        <span className="font-label-caps text-[10px] tracking-widest uppercase">Nodes</span>
                    </a>
                    <a className="text-zinc-600 py-3 px-4 flex items-center gap-3 hover:text-zinc-300 hover:bg-white/[0.02] ease-out duration-300 cursor-pointer">
                        <span className="material-symbols-outlined">rocket_launch</span>
                        <span className="font-label-caps text-[10px] tracking-widest uppercase">Deployment</span>
                    </a>
                    <a className="text-zinc-600 py-3 px-4 flex items-center gap-3 hover:text-zinc-300 hover:bg-white/[0.02] ease-out duration-300 cursor-pointer">
                        <span className="material-symbols-outlined">inventory_2</span>
                        <span className="font-label-caps text-[10px] tracking-widest uppercase">Archived</span>
                    </a>
                </nav>
                <div className="p-6 border-t border-white/5">
                    <button className="w-full bg-[#dcdce0] text-[#2f3034] py-3 px-4 font-label-caps text-[10px] tracking-widest font-bold hover:brightness-110 active:scale-[0.98] transition-all uppercase">
                        New Instance
                    </button>
                    <div className="mt-6 flex flex-col">
                        <a className="text-zinc-600 py-2 px-2 flex items-center gap-3 hover:text-zinc-300 transition-colors cursor-pointer">
                            <span className="material-symbols-outlined">memory</span>
                            <span className="font-label-caps text-[10px] tracking-widest uppercase">Diagnostics</span>
                        </a>
                        <a className="text-zinc-600 py-2 px-2 flex items-center gap-3 hover:text-zinc-300 transition-colors cursor-pointer">
                            <span className="material-symbols-outlined">help_outline</span>
                            <span className="font-label-caps text-[10px] tracking-widest uppercase">Help</span>
                        </a>
                    </div>
                </div>
            </aside>

            {/* Top Navigation Bar */}
            <header className="fixed top-0 left-64 right-0 h-14 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 z-40 flex justify-between items-center px-6">
                <div className="flex items-center gap-12">
                    <span className="text-lg font-black tracking-tighter text-zinc-100 uppercase font-headline-lg cursor-pointer">OBSIDIAN_OS</span>
                    <div className="flex items-center gap-6">
                        <a className="text-zinc-500 hover:text-zinc-300 transition-colors font-sans tracking-tight text-sm cursor-pointer">Console</a>
                        <a className="text-zinc-500 hover:text-zinc-300 transition-colors font-sans tracking-tight text-sm cursor-pointer">Network</a>
                        <a className="text-zinc-500 hover:text-zinc-300 transition-colors font-sans tracking-tight text-sm cursor-pointer">Vault</a>
                        <a className="text-zinc-100 border-b border-zinc-200 pb-1 font-sans tracking-tight text-sm cursor-pointer">Process</a>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input className="bg-[#1c1b1b] border border-white/5 text-xs px-3 py-1.5 w-64 focus:outline-none focus:border-zinc-500 transition-colors" placeholder="Search parameters..." type="text"/>
                    </div>
                    <button className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
                        <span className="material-symbols-outlined">terminal</span>
                    </button>
                    <button className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
                        <span className="material-symbols-outlined">settings</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="pl-64 pt-14 min-h-screen relative z-10">
                <div className="max-w-5xl mx-auto px-12 py-12 space-y-12">
                    {/* Page Header */}
                    <section className="space-y-2">
                        <h1 className="text-headline-xl text-zinc-100 text-4xl font-semibold">SYSTEM_CONFIG</h1>
                        <p className="text-body-sm text-zinc-500 max-w-2xl text-sm">Modify environment variables, neural engine routing, and transmission endpoints for the current active node instance.</p>
                    </section>

                    {/* API Configuration Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-zinc-400">key</span>
                            <h2 className="font-label-caps tracking-[0.2em] text-zinc-400 uppercase text-xs font-semibold">API Access Credentials</h2>
                        </div>
                        <div className="grid grid-cols-12 gap-5">
                            <div className="col-span-8 bg-[#1c1b1b] border border-white/5 p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="font-label-caps text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Primary API Key</label>
                                    <div className="relative">
                                        <input className="w-full bg-[#0e0e0e] border border-white/10 text-zinc-100 font-mono text-sm tracking-widest px-4 py-3 rounded-none outline-none" type="password" defaultValue="ob_live_51MszL6KDwR9WfX3y"/>
                                        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-100">
                                            <span className="material-symbols-outlined">visibility</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="font-label-caps text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Enterprise Endpoint URL</label>
                                    <input className="w-full bg-[#0e0e0e] border border-white/10 text-zinc-100 font-mono text-sm px-4 py-3 rounded-none outline-none" type="text" defaultValue="https://api.obsidian-os.net/v1/core"/>
                                </div>
                            </div>
                            <div className="col-span-4 bg-[#1c1b1b] border border-white/5 p-6 flex flex-col justify-between">
                                <div className="space-y-2">
                                    <p className="font-label-caps text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Quota Status</p>
                                    <div className="text-2xl font-medium text-zinc-100">84.2%</div>
                                    <div className="h-1 bg-white/5 w-full">
                                        <div className="h-full bg-zinc-400 w-[84.2%]"></div>
                                    </div>
                                </div>
                                <button className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1 mt-6 transition-colors">
                                    <span className="material-symbols-outlined">refresh</span>
                                    <span>Refresh tokens</span>
                                </button>
                            </div>
                        </div>
                        <div className="border-b border-white/5 pt-6"></div>
                    </section>

                    {/* LLM Engine Selection Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-zinc-400">psychology</span>
                            <h2 className="font-label-caps tracking-[0.2em] text-zinc-400 uppercase text-xs font-semibold">Neural Engine Routing</h2>
                        </div>
                        <div className="grid grid-cols-3 gap-5">
                            {/* Engine Option 1 */}
                            <div className="bg-white/[0.02] border border-[#dcdce0] p-6 transition-all group">
                                <div className="flex justify-between items-start mb-6">
                                    <span className="material-symbols-outlined text-zinc-100">model_training</span>
                                    <span className="font-label-caps text-[10px] bg-zinc-100 text-zinc-950 px-2 py-0.5 font-black uppercase">Active</span>
                                </div>
                                <h3 className="font-headline-lg text-lg text-zinc-100 mb-1 font-medium">OBSIDIAN_VII</h3>
                                <p className="text-body-sm text-zinc-500 mb-6 text-sm">High-precision low-latency reasoning engine for tactical operations.</p>
                                <div className="text-[10px] text-zinc-400 font-label-caps tracking-widest flex items-center gap-1 uppercase font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500/50"></span>
                                    Operational
                                </div>
                            </div>
                            {/* Engine Option 2 */}
                            <div className="bg-[#1c1b1b] border border-white/5 hover:border-white/20 p-6 transition-all group cursor-pointer">
                                <div className="flex justify-between items-start mb-6">
                                    <span className="material-symbols-outlined text-zinc-600 group-hover:text-zinc-400">data_object</span>
                                </div>
                                <h3 className="font-headline-lg text-lg text-zinc-500 group-hover:text-zinc-300 transition-colors mb-1 font-medium">GHOST_SHELL</h3>
                                <p className="text-body-sm text-zinc-600 group-hover:text-zinc-500 transition-colors mb-6 text-sm">Specialized coding and architecture analysis module.</p>
                                <div className="text-[10px] text-zinc-600 font-label-caps tracking-widest uppercase font-semibold">Standby</div>
                            </div>
                            {/* Engine Option 3 */}
                            <div className="bg-[#1c1b1b] border border-white/5 hover:border-white/20 p-6 transition-all group cursor-pointer">
                                <div className="flex justify-between items-start mb-6">
                                    <span className="material-symbols-outlined text-zinc-600 group-hover:text-zinc-400">cloud_off</span>
                                </div>
                                <h3 className="font-headline-lg text-lg text-zinc-500 group-hover:text-zinc-300 transition-colors mb-1 font-medium">VOID_LOCAL</h3>
                                <p className="text-body-sm text-zinc-600 group-hover:text-zinc-500 transition-colors mb-6 text-sm">Fully air-gapped local deployment for maximum security.</p>
                                <div className="text-[10px] text-zinc-600 font-label-caps tracking-widest uppercase font-semibold">Inactive</div>
                            </div>
                        </div>
                        <div className="border-b border-white/5 pt-6"></div>
                    </section>

                    {/* Webhooks & Transmission Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-zinc-400">leak_add</span>
                            <h2 className="font-label-caps tracking-[0.2em] text-zinc-400 uppercase text-xs font-semibold">Transmission Webhooks</h2>
                        </div>
                        <div className="bg-[#1c1b1b] border border-white/5 divide-y divide-white/5">
                            <div className="p-6 flex justify-between items-center">
                                <div className="space-y-1">
                                    <div className="text-zinc-100 font-medium text-sm">Deployment Success Hook</div>
                                    <div className="text-xs font-mono text-zinc-500">https://hooks.slack.com/services/T000...</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-label-caps bg-green-900/20 text-green-400 px-3 py-1 border border-white/5 uppercase font-semibold">Enabled</span>
                                    <button className="material-symbols-outlined text-zinc-600 hover:text-zinc-300">edit</button>
                                </div>
                            </div>
                            <div className="p-6 flex justify-between items-center">
                                <div className="space-y-1">
                                    <div className="text-zinc-100 font-medium text-sm">Error Cascade Notification</div>
                                    <div className="text-xs font-mono text-zinc-500">https://pagerduty.io/v2/alerts/cascade...</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-label-caps bg-zinc-900/20 text-zinc-500 px-3 py-1 border border-white/5 uppercase font-semibold">Disabled</span>
                                    <button className="material-symbols-outlined text-zinc-600 hover:text-zinc-300">edit</button>
                                </div>
                            </div>
                            <div className="p-6 bg-white/[0.01] border-t border-white/5">
                                <button className="text-xs font-label-caps tracking-widest text-zinc-400 flex items-center gap-1 hover:text-zinc-100 transition-colors uppercase font-semibold">
                                    <span className="material-symbols-outlined">add</span>
                                    Add Transmission Target
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Footer Action */}
                    <section className="pt-12 pb-8">
                        <button className="w-full bg-[#dcdce0] text-[#2f3034] py-5 font-label-caps text-sm tracking-[0.3em] font-black uppercase hover:bg-zinc-100 transition-all active:scale-[0.99] border border-white/5">
                            Synchronize & Commit Changes
                        </button>
                        <div className="mt-6 flex justify-center">
                            <p className="text-[10px] font-label-caps tracking-[0.2em] text-zinc-600 uppercase font-semibold">Last sync: {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC</p>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};
