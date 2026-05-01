import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

const ENV_PATH = path.resolve(__dirname, '../.env');
const LEDGER_PATH = path.resolve(__dirname, '../ledger.json');

const CONFIGURABLE_KEYS = [
  'GEMINI_API_KEY',
  'POLYMARKET_API_KEY',
  'POLYMARKET_PASSPHRASE',
  'POLYMARKET_SECRET_KEY',
  'DISCORD_WEBHOOK_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'ENABLE_MOCKS',
];

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    result[trimmed.substring(0, eqIndex).trim()] = trimmed.substring(eqIndex + 1).trim();
  }
  return result;
}

function writeEnvFile(filePath: string, updates: Record<string, string>): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Object.entries(updates).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', 'utf-8');
    return;
  }
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const updated = new Set<string>();
  const newLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { newLines.push(line); continue; }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) { newLines.push(line); continue; }
    const key = trimmed.substring(0, eqIndex).trim();
    if (key in updates) { newLines.push(`${key}=${updates[key]}`); updated.add(key); }
    else { newLines.push(line); }
  }
  for (const [key, value] of Object.entries(updates)) {
    if (!updated.has(key)) newLines.push(`${key}=${value}`);
  }
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

/**
 * Vite plugin that provides local API fallback when the backend engine isn't running.
 * Handles /api/config, /api/wallet, /api/status directly from the dev server.
 */
function localApiPlugin(): Plugin {
  return {
    name: 'polybot-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only handle /api/* routes
        if (!req.url?.startsWith('/api/')) return next();

        res.setHeader('Content-Type', 'application/json');

        try {
          // ─── GET /api/config ─────────────────────────
          if (req.url === '/api/config' && req.method === 'GET') {
            const all = parseEnvFile(ENV_PATH);
            const config: Record<string, string> = {};
            for (const key of CONFIGURABLE_KEYS) config[key] = all[key] || '';
            res.end(JSON.stringify({ config }));
            return;
          }

          // ─── POST /api/config ────────────────────────
          if (req.url === '/api/config' && req.method === 'POST') {
            const body = await readBody(req);
            const { config } = JSON.parse(body);
            if (!config || typeof config !== 'object') {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing config object' }));
              return;
            }
            const updates: Record<string, string> = {};
            for (const key of CONFIGURABLE_KEYS) {
              if (key in config) updates[key] = String(config[key]);
            }
            writeEnvFile(ENV_PATH, updates);
            console.log(`[Local API] Saved ${Object.keys(updates).length} config values to .env`);
            res.end(JSON.stringify({ success: true, updated: Object.keys(updates) }));
            return;
          }

          // ─── GET /api/wallet ─────────────────────────
          if (req.url === '/api/wallet' && req.method === 'GET') {
            if (!fs.existsSync(LEDGER_PATH)) {
              res.end(JSON.stringify({ balance: 0, totalDeposited: 0, openTrades: 0, totalTrades: 0, conservativeEquity: 0 }));
              return;
            }
            const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
            const openTrades = (ledger.trades || []).filter((t: any) => t.status === 'OPEN');
            res.end(JSON.stringify({
              balance: ledger.balance || 0,
              totalDeposited: ledger.total_deposited || 0,
              openTrades: openTrades.length,
              totalTrades: (ledger.trades || []).length,
              conservativeEquity: (ledger.balance || 0) + openTrades.reduce((s: number, t: any) => s + (t.notional_cost || 0), 0)
            }));
            return;
          }

          // ─── POST /api/wallet ────────────────────────
          if (req.url === '/api/wallet' && req.method === 'POST') {
            const body = await readBody(req);
            const { action, amount } = JSON.parse(body);
            if (typeof amount !== 'number' || amount <= 0) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid amount' }));
              return;
            }
            if (action === 'deposit') {
              let ledger = { balance: 0, total_deposited: 0, trades: [] as any[] };
              if (fs.existsSync(LEDGER_PATH)) {
                ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
              }
              ledger.balance += amount;
              ledger.total_deposited += amount;
              fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
              console.log(`[Local API] Deposited $${amount}. Balance: $${ledger.balance}`);
              res.end(JSON.stringify({ success: true, newBalance: ledger.balance }));
            } else if (action === 'reset') {
              const newLedger = { balance: amount, total_deposited: amount, trades: [] };
              fs.writeFileSync(LEDGER_PATH, JSON.stringify(newLedger, null, 2));
              console.log(`[Local API] Reset wallet to $${amount}`);
              res.end(JSON.stringify({ success: true, newBalance: amount }));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Use action: "deposit" or "reset"' }));
            }
            return;
          }

          // ─── GET /api/status ─────────────────────────
          if (req.url === '/api/status' && req.method === 'GET') {
            const geminiKey = parseEnvFile(ENV_PATH)['GEMINI_API_KEY'] || '';
            res.end(JSON.stringify({
              status: 'DEV_MODE',
              uptime: '00:00:00',
              geminiEnabled: geminiKey.length > 0,
              wsClients: 0,
              walletBalance: 0,
            }));
            return;
          }

          // Unknown API route
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [localApiPlugin(), tailwindcss(), react()],
  server: {
    proxy: {
      // When backend IS running, proxy WebSocket to it
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
})
