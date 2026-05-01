import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '';

interface ConfigState {
  GEMINI_API_KEY: string;
  POLYMARKET_API_KEY: string;
  POLYMARKET_PASSPHRASE: string;
  POLYMARKET_SECRET_KEY: string;
  DISCORD_WEBHOOK_URL: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  ENABLE_MOCKS: string;
}

const EMPTY_CONFIG: ConfigState = {
  GEMINI_API_KEY: '',
  POLYMARKET_API_KEY: '',
  POLYMARKET_PASSPHRASE: '',
  POLYMARKET_SECRET_KEY: '',
  DISCORD_WEBHOOK_URL: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  ENABLE_MOCKS: 'false',
};

/** Mask all but the last 4 chars */
function maskValue(val: string): string {
  if (val.length <= 4) return '•'.repeat(val.length);
  return '•'.repeat(val.length - 4) + val.slice(-4);
}

interface SecretFieldProps {
  label: string;
  envKey: keyof ConfigState;
  value: string;
  onChange: (key: keyof ConfigState, value: string) => void;
  description?: string;
  required?: boolean;
}

const SecretField: React.FC<SecretFieldProps> = ({ label, envKey, value, onChange, description, required }) => {
  const [visible, setVisible] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-label-caps text-[10px] text-zinc-500 uppercase tracking-widest">{label}</label>
        {required && <span className="text-[9px] text-red-400/60 font-bold uppercase tracking-widest">Required</span>}
        {!required && <span className="text-[9px] text-zinc-600 uppercase tracking-widest">Optional</span>}
      </div>
      {description && <p className="text-[10px] text-zinc-600 mb-1">{description}</p>}
      <div className="relative">
        <input
          className="w-full bg-surface-container-lowest border border-white/10 text-zinc-100 font-mono text-sm tracking-widest px-4 py-3 rounded-none outline-none focus:border-primary transition-colors"
          type={visible ? 'text' : 'password'}
          value={visible ? value : (hasValue ? maskValue(value) : '')}
          placeholder={visible ? `Enter ${label}...` : ''}
          onChange={(e) => onChange(envKey, e.target.value)}
          onFocus={() => setVisible(true)}
          onBlur={() => setVisible(false)}
        />
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-100 cursor-pointer transition-colors"
          onClick={() => setVisible(!visible)}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">{visible ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
      <div className="flex items-center gap-2 mt-1">
        {hasValue ? (
          <span className="flex items-center gap-1 text-[10px] text-green-400/70"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Configured</span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-zinc-600"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>Not set</span>
        )}
      </div>
    </div>
  );
};

export const Config: React.FC = () => {
  const [config, setConfig] = useState<ConfigState>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then(res => res.json())
      .then(data => {
        if (data.config) {
          setConfig({ ...EMPTY_CONFIG, ...data.config });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleChange = useCallback((key: keyof ConfigState, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaveStatus('idle');
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('success');
        setLastSync(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Count configured keys
  const totalKeys = 7; // excluding ENABLE_MOCKS
  const configuredKeys = [
    config.GEMINI_API_KEY,
    config.POLYMARKET_API_KEY,
    config.POLYMARKET_PASSPHRASE,
    config.POLYMARKET_SECRET_KEY,
    config.DISCORD_WEBHOOK_URL,
    config.TELEGRAM_BOT_TOKEN,
    config.TELEGRAM_CHAT_ID,
  ].filter(v => v.length > 0).length;
  const configPct = Math.round((configuredKeys / totalKeys) * 100);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#050505] overflow-y-auto no-scrollbar">
      <div className="max-w-5xl mx-auto px-12 py-12 space-y-12">
        {/* Page Header */}
        <section className="space-y-2">
          <h1 className="text-headline-xl text-zinc-100">SYSTEM_CONFIG</h1>
          <p className="text-body-sm text-zinc-500 max-w-2xl">Manage API keys for the autonomous trading pipeline. Changes are written directly to the backend <code className="text-zinc-400 bg-white/5 px-1.5 py-0.5 text-[11px]">.env</code> file and take effect immediately.</p>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-zinc-500 text-sm animate-pulse">Loading configuration...</div>
          </div>
        ) : (
          <>
            {/* ─── SECTION 1: AI REASONING ENGINE ─────────────────────── */}
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-zinc-400">psychology</span>
                <h2 className="text-label-caps tracking-[0.2em] text-zinc-400 uppercase">AI Reasoning Engine</h2>
                <span className="text-[9px] text-red-400/80 bg-red-500/10 px-2 py-0.5 font-bold uppercase tracking-widest border border-red-500/20">Core</span>
              </div>
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-8 monolith-border bg-surface-container-low p-6 space-y-4">
                  <SecretField
                    label="Gemini API Key"
                    envKey="GEMINI_API_KEY"
                    value={config.GEMINI_API_KEY}
                    onChange={handleChange}
                    description="Powers market probability estimation and news impact analysis. Get from aistudio.google.com/apikey"
                    required
                  />
                </div>
                <div className="col-span-4 monolith-border bg-surface-container-low p-6 flex flex-col justify-between">
                  <div className="space-y-2">
                    <p className="text-label-caps text-[10px] text-zinc-500 uppercase tracking-widest">Config Status</p>
                    <div className="text-headline-lg text-zinc-100">{configPct}%</div>
                    <div className="h-1 bg-white/5 w-full">
                      <div className={`h-full transition-all duration-500 ${configPct === 100 ? 'bg-green-500' : configPct > 50 ? 'bg-zinc-400' : 'bg-red-400/60'}`} style={{ width: `${configPct}%` }}></div>
                    </div>
                    <p className="text-[10px] text-zinc-600">{configuredKeys}/{totalKeys} keys configured</p>
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-4 space-y-1">
                    <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Gemini = AI trades</div>
                    <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span> Polymarket = Live execution</div>
                    <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span> Alerts = Notifications</div>
                  </div>
                </div>
              </div>
              <div className="thin-separator pt-2"></div>
            </section>

            {/* ─── SECTION 2: POLYMARKET LIVE TRADING ───────────────────── */}
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-zinc-400">swap_horiz</span>
                <h2 className="text-label-caps tracking-[0.2em] text-zinc-400 uppercase">Polymarket Live Trading</h2>
                <span className="text-[9px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 font-bold uppercase tracking-widest border border-amber-500/20">Future</span>
              </div>
              <div className="monolith-border bg-surface-container-low p-6 space-y-6">
                <div className="bg-amber-500/5 border border-amber-500/10 p-4">
                  <p className="text-[11px] text-amber-400/70 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    These credentials are for future live trading. Currently the system runs in paper-trade mode using the Virtual Wallet.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <SecretField label="Polymarket API Key" envKey="POLYMARKET_API_KEY" value={config.POLYMARKET_API_KEY} onChange={handleChange} />
                  <SecretField label="Polymarket Passphrase" envKey="POLYMARKET_PASSPHRASE" value={config.POLYMARKET_PASSPHRASE} onChange={handleChange} />
                  <SecretField label="Polymarket Secret Key" envKey="POLYMARKET_SECRET_KEY" value={config.POLYMARKET_SECRET_KEY} onChange={handleChange} description="Used for signing live orders on the CLOB exchange" />
                </div>
              </div>
              <div className="thin-separator pt-2"></div>
            </section>

            {/* ─── SECTION 3: ALERT CHANNELS ──────────────────────────── */}
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-zinc-400">notifications_active</span>
                <h2 className="text-label-caps tracking-[0.2em] text-zinc-400 uppercase">Alert Channels</h2>
              </div>
              <div className="grid grid-cols-2 gap-5">
                {/* Discord */}
                <div className="monolith-border bg-surface-container-low p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded bg-[#5865F2]/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#5865F2] text-[18px]">forum</span>
                    </div>
                    <div>
                      <h3 className="text-sm text-zinc-100 font-medium">Discord</h3>
                      <p className="text-[10px] text-zinc-600">Trade alerts via webhook</p>
                    </div>
                  </div>
                  <SecretField label="Webhook URL" envKey="DISCORD_WEBHOOK_URL" value={config.DISCORD_WEBHOOK_URL} onChange={handleChange} />
                </div>
                {/* Telegram */}
                <div className="monolith-border bg-surface-container-low p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded bg-[#0088cc]/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#0088cc] text-[18px]">send</span>
                    </div>
                    <div>
                      <h3 className="text-sm text-zinc-100 font-medium">Telegram</h3>
                      <p className="text-[10px] text-zinc-600">Push notifications via bot</p>
                    </div>
                  </div>
                  <SecretField label="Bot Token" envKey="TELEGRAM_BOT_TOKEN" value={config.TELEGRAM_BOT_TOKEN} onChange={handleChange} />
                  <div className="space-y-1">
                    <label className="text-label-caps text-[10px] text-zinc-500 uppercase tracking-widest">Chat ID</label>
                    <input
                      className="w-full bg-surface-container-lowest border border-white/10 text-zinc-100 font-mono text-sm px-4 py-3 rounded-none outline-none focus:border-primary transition-colors"
                      type="text"
                      value={config.TELEGRAM_CHAT_ID}
                      onChange={(e) => handleChange('TELEGRAM_CHAT_ID', e.target.value)}
                      placeholder="e.g. -1001234567890"
                    />
                  </div>
                </div>
              </div>
              <div className="thin-separator pt-2"></div>
            </section>

            {/* ─── SECTION 4: SYSTEM TOGGLES ──────────────────────────── */}
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-zinc-400">tune</span>
                <h2 className="text-label-caps tracking-[0.2em] text-zinc-400 uppercase">System Toggles</h2>
              </div>
              <div className="monolith-border bg-surface-container-low p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm text-zinc-100 font-medium">Mock Data Mode</h3>
                    <p className="text-[10px] text-zinc-500 mt-1">Enable synthetic whale trades and news headlines for testing. Disable for production.</p>
                  </div>
                  <button
                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${config.ENABLE_MOCKS === 'true' ? 'bg-primary' : 'bg-white/10'}`}
                    onClick={() => handleChange('ENABLE_MOCKS', config.ENABLE_MOCKS === 'true' ? 'false' : 'true')}
                    type="button"
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${config.ENABLE_MOCKS === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                  </button>
                </div>
              </div>
            </section>

            {/* ─── SAVE BUTTON ────────────────────────────────────────── */}
            <section className="pt-8 pb-8">
              <button
                className={`w-full py-5 text-label-caps text-sm tracking-[0.3em] font-black uppercase monolith-border cursor-pointer transition-all active:scale-[0.99] ${
                  saving
                    ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                    : saveStatus === 'success'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-primary text-on-primary hover:bg-zinc-100'
                }`}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : saveStatus === 'success' ? '✓ Saved to .env' : 'Synchronize & Commit Changes'}
              </button>
              {saveStatus === 'error' && (
                <p className="text-center text-[10px] text-red-400 mt-3">Failed to save. Is the backend running on port 3001?</p>
              )}
              {lastSync && (
                <div className="mt-6 flex justify-center">
                  <p className="text-[10px] text-label-caps tracking-[0.2em] text-zinc-600 uppercase">Last sync: {lastSync}</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Grid backdrop */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
    </div>
  );
};
