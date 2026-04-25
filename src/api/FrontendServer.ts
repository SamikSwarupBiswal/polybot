import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { VirtualWallet } from '../execution/VirtualWallet.js';
import { PerformanceTracker } from '../analytics/PerformanceTracker.js';

export class FrontendServer {
    private wss: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();
    private port: number;

    constructor(port: number = 3001) {
        this.port = port;
    }

    public start(wallet: VirtualWallet) {
        try {
            this.wss = new WebSocketServer({ port: this.port });
            logger.info(`Frontend API Server listening on ws://localhost:${this.port}`);

            this.wss.on('connection', (ws: WebSocket) => {
                logger.info('New frontend client connected to WebSocket API.');
                this.clients.add(ws);

                // On connect, push initial sync state
                this.pushSyncState(ws, wallet);

                ws.on('close', () => {
                    this.clients.delete(ws);
                    logger.info('Frontend client disconnected.');
                });

                ws.on('error', (err) => {
                    logger.error(`Frontend WS error: ${err.message}`);
                });
            });
        } catch (error: any) {
            logger.error(`Failed to start Frontend API Server: ${error.message}`);
        }
    }

    public stop() {
        if (this.wss) {
            for (const client of this.clients) {
                client.terminate();
            }
            this.wss.close();
            logger.info('Frontend API Server shut down.');
        }
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
            // Broadcast to all
            this.broadcast('FULL_SYNC', payload);
        }
    }
}
