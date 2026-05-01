import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { VirtualWallet } from '../execution/VirtualWallet.js';
import { PerformanceTracker } from '../analytics/PerformanceTracker.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve project root (.env lives at MVP/.env)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '../../.env');

/** Keys the frontend is allowed to read/write */
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
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        result[key] = value;
    }
    return result;
}

function writeEnvFile(filePath: string, updates: Record<string, string>): void {
    if (!fs.existsSync(filePath)) {
        // Create minimal .env
        const content = Object.entries(updates).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
        fs.writeFileSync(filePath, content, 'utf-8');
        return;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n');
    const updated = new Set<string>();
    const newLines: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            newLines.push(line);
            continue;
        }
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) {
            newLines.push(line);
            continue;
        }
        const key = trimmed.substring(0, eqIndex).trim();
        if (key in updates) {
            newLines.push(`${key}=${updates[key]}`);
            updated.add(key);
        } else {
            newLines.push(line);
        }
    }

    // Append any new keys not already in the file
    for (const [key, value] of Object.entries(updates)) {
        if (!updated.has(key)) {
            newLines.push(`${key}=${value}`);
        }
    }

    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
}

export class FrontendServer {
    private wss: WebSocketServer | null = null;
    private httpServer: http.Server | null = null;
    private clients: Set<WebSocket> = new Set();
    private port: number;
    private wallet: VirtualWallet | null = null;
    private startTime: number = Date.now();

    constructor(port: number = 3001) {
        this.port = port;
    }

    public start(wallet: VirtualWallet) {
        this.wallet = wallet;
        try {
            // Create HTTP server for REST API
            this.httpServer = http.createServer((req, res) => {
                // CORS headers for frontend dev server
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

                if (req.method === 'OPTIONS') {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                if (req.url === '/api/config' && req.method === 'GET') {
                    this.handleGetConfig(res);
                } else if (req.url === '/api/config' && req.method === 'POST') {
                    this.handlePostConfig(req, res);
                } else if (req.url === '/api/wallet' && req.method === 'GET') {
                    this.handleGetWallet(res);
                } else if (req.url === '/api/wallet' && req.method === 'POST') {
                    this.handlePostWallet(req, res);
                } else if (req.url === '/api/status' && req.method === 'GET') {
                    this.handleGetStatus(res);
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Not found' }));
                }
            });

            // Attach WebSocket to the HTTP server
            this.wss = new WebSocketServer({ server: this.httpServer });
            
            this.wss.on('connection', (ws: WebSocket) => {
                logger.info('New frontend client connected to WebSocket API.');
                this.clients.add(ws);
                this.pushSyncState(ws, wallet);

                ws.on('close', () => {
                    this.clients.delete(ws);
                    logger.info('Frontend client disconnected.');
                });
                ws.on('error', (err) => {
                    logger.error(`Frontend WS error: ${err.message}`);
                });
            });

            this.httpServer.listen(this.port, () => {
                logger.info(`Frontend API Server listening on http://localhost:${this.port} (WS + REST)`);
            });
        } catch (error: any) {
            logger.error(`Failed to start Frontend API Server: ${error.message}`);
        }
    }

    private handleGetConfig(res: http.ServerResponse) {
        try {
            const all = parseEnvFile(ENV_PATH);
            const config: Record<string, string> = {};
            for (const key of CONFIGURABLE_KEYS) {
                config[key] = all[key] || '';
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ config }));
        } catch (err: any) {
            logger.error(`[Config API] GET failed: ${err.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    }

    private handlePostConfig(req: http.IncomingMessage, res: http.ServerResponse) {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try {
                const { config } = JSON.parse(body);
                if (!config || typeof config !== 'object') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing config object' }));
                    return;
                }

                // Only allow writing configurable keys
                const updates: Record<string, string> = {};
                for (const key of CONFIGURABLE_KEYS) {
                    if (key in config) {
                        updates[key] = String(config[key]);
                    }
                }

                writeEnvFile(ENV_PATH, updates);

                // Also update process.env in-memory so changes take effect without restart
                for (const [key, value] of Object.entries(updates)) {
                    process.env[key] = value;
                }

                logger.info(`[Config API] Saved ${Object.keys(updates).length} config values to .env`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, updated: Object.keys(updates) }));
            } catch (err: any) {
                logger.error(`[Config API] POST failed: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }

    private handleGetWallet(res: http.ServerResponse) {
        if (!this.wallet) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Engine not started' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            balance: this.wallet.getBalance(),
            totalDeposited: this.wallet.getTotalDeposited(),
            openTrades: this.wallet.getOpenTrades().length,
            totalTrades: this.wallet.getTrades().length,
            conservativeEquity: this.wallet.getConservativeEquity()
        }));
    }

    private handlePostWallet(req: http.IncomingMessage, res: http.ServerResponse) {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try {
                const { action, amount } = JSON.parse(body);
                if (!this.wallet) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Engine not started' }));
                    return;
                }
                if (action === 'deposit' && typeof amount === 'number' && amount > 0) {
                    // Deposit by adding to balance directly via ledger
                    const currentBalance = this.wallet.getBalance();
                    // We access the ledger path and modify it
                    const ledgerPath = path.resolve(__dirname, '../../ledger.json');
                    if (fs.existsSync(ledgerPath)) {
                        const data = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
                        data.balance += amount;
                        data.total_deposited += amount;
                        fs.writeFileSync(ledgerPath, JSON.stringify(data, null, 2));
                        logger.info(`[Wallet API] Deposited $${amount}. New balance: $${data.balance.toFixed(2)}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, newBalance: data.balance }));
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Ledger not found' }));
                    }
                } else if (action === 'reset' && typeof amount === 'number' && amount > 0) {
                    const ledgerPath = path.resolve(__dirname, '../../ledger.json');
                    const newLedger = { balance: amount, total_deposited: amount, trades: [] };
                    fs.writeFileSync(ledgerPath, JSON.stringify(newLedger, null, 2));
                    logger.info(`[Wallet API] Reset wallet to $${amount}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, newBalance: amount }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid action. Use {action: "deposit"|"reset", amount: number}' }));
                }
            } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }

    private handleGetStatus(res: http.ServerResponse) {
        const uptimeMs = Date.now() - this.startTime;
        const uptimeSec = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(uptimeSec / 3600);
        const minutes = Math.floor((uptimeSec % 3600) / 60);
        const seconds = uptimeSec % 60;

        const geminiKey = process.env.GEMINI_API_KEY || '';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ONLINE',
            uptime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
            uptimeMs,
            geminiEnabled: geminiKey.length > 0,
            wsClients: this.clients.size,
            walletBalance: this.wallet?.getBalance() ?? 0,
        }));
    }

    public stop() {
        if (this.wss) {
            for (const client of this.clients) {
                client.terminate();
            }
            this.wss.close();
        }
        if (this.httpServer) {
            this.httpServer.close();
        }
        logger.info('Frontend API Server shut down.');
    }

    public broadcast(type: string, payload: any) {
        const message = JSON.stringify({ type, payload, timestamp: Date.now() });
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }

    public pushSyncState(ws: WebSocket | null, wallet: VirtualWallet) {
        const metrics = PerformanceTracker.getMetrics(wallet);
        const trades = [...wallet.getTrades()].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const payload = {
            balance: wallet.getBalance(),
            metrics,
            trades,
            activePositions: trades.filter(t => t.status === 'OPEN').length
        };

        const message = JSON.stringify({ type: 'FULL_SYNC', payload, timestamp: Date.now() });
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        } else {
            this.broadcast('FULL_SYNC', payload);
        }
    }
}
