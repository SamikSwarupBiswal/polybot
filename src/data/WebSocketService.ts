import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface PriceUpdate {
    tokenId: string;
    price: number;
    timestamp: number;
}

export class WebSocketService extends EventEmitter {
    private ws: WebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private url = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
    private isConnected = false;

    constructor() {
        super();
    }

    public connect() {
        if (this.ws) return;

        logger.info('[WebSocketService] Connecting to Polymarket CLOB...');
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
            logger.info('[WebSocketService] Connected to Polymarket CLOB via WebSocket.');
            this.isConnected = true;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

            // Resubscribe if there were existing subscriptions
            if (this.subscriptions.size > 0) {
                this.sendSubscribeMessage(Array.from(this.subscriptions));
            }
        });

        this.ws.on('message', (data: WebSocket.Data) => {
            try {
                const message = JSON.parse(data.toString());
                
                // Typical market stream payload:
                // { asset_id: "...", price: "0.55", timestamp: 1234567890 }
                if (message && message.asset_id && message.price) {
                    const update: PriceUpdate = {
                        tokenId: message.asset_id,
                        price: parseFloat(message.price),
                        timestamp: message.timestamp ? parseInt(message.timestamp, 10) : Date.now()
                    };
                    this.emit('priceUpdate', update);
                }
            } catch (e: any) {
                logger.debug(`[WebSocketService] Failed to parse WS message: ${e.message}`);
            }
        });

        this.ws.on('close', () => {
            logger.warn('[WebSocketService] WebSocket closed. Reconnecting in 5s...');
            this.isConnected = false;
            this.ws = null;
            this.scheduleReconnect();
        });

        this.ws.on('error', (err) => {
            logger.error(`[WebSocketService] WebSocket error: ${err.message}`);
            this.ws?.close();
        });
    }

    public subscribeMarket(tokenIds: string[]) {
        for (const id of tokenIds) {
            this.subscriptions.add(id);
        }

        if (this.isConnected) {
            this.sendSubscribeMessage(tokenIds);
        } else {
            this.connect(); // Ensure we connect
        }
    }

    public disconnect() {
        logger.info('[WebSocketService] Disconnecting WebSocket...');
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.subscriptions.clear();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    private sendSubscribeMessage(tokenIds: string[]) {
        if (!this.ws || !this.isConnected) return;
        
        try {
            this.ws.send(JSON.stringify({
                type: 'market',
                assets_ids: tokenIds
            }));
            logger.debug(`[WebSocketService] Subscribed to ${tokenIds.length} tokens.`);
        } catch (e: any) {
            logger.error(`[WebSocketService] Failed to send subscribe message: ${e.message}`);
        }
    }

    private scheduleReconnect() {
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this.connect();
            }, 5000);
        }
    }
}
