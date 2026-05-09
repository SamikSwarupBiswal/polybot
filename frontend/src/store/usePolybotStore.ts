import { create } from 'zustand';

interface TradeRecord {
    trade_id: string;
    mode: string;
    market_id: string;
    market_question: string;
    side: 'YES' | 'NO';
    entry_price: number;
    shares: number;
    notional_cost: number;
    simulated_fee: number;
    status: 'OPEN' | 'CLOSED_WIN' | 'CLOSED_LOSS' | 'CLOSED_EXIT' | 'EXPIRED';
    pnl: number | null;
    timestamp: string;
    resolved_at?: string | null;
    market_end_date?: string;
}

interface Metrics {
    winRate: string;
    roi: string;
    maxDrawdown: string;
    openTrades: number;
    totalPnl: string;
    totalTrades: number;
    closedTrades: number;
    wins: number;
    totalDeposited: number;
    conservativeEquity: string;
}

interface PolybotState {
    balance: number;
    metrics: Metrics | null;
    trades: TradeRecord[];
    activePositions: number;
    connected: boolean;
    connect: (url?: string) => void;
    disconnect: () => void;
}

let ws: WebSocket | null = null;

export const usePolybotStore = create<PolybotState>((set) => ({
    balance: 0,
    metrics: null,
    trades: [],
    activePositions: 0,
    connected: false,

    connect: (url = 'ws://localhost:3001') => {
        if (ws) {
            // Remove the onclose handler so it doesn't trigger a reconnect when we intentionally close it
            ws.onclose = null;
            ws.close();
        }

        ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('Connected to Polybot Backend');
            set({ connected: true });
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'FULL_SYNC') {
                    set({
                        balance: message.payload.balance,
                        metrics: message.payload.metrics,
                        trades: message.payload.trades,
                        activePositions: message.payload.activePositions
                    });
                }
            } catch (err) {
                console.error('Failed to parse WS message:', err);
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from Polybot Backend. Reconnecting in 5s...');
            set({ connected: false });
            setTimeout(() => {
                usePolybotStore.getState().connect(url);
            }, 5000);
        };
    },

    disconnect: () => {
        if (ws) {
            ws.onclose = null;
            ws.close();
            set({ connected: false });
        }
    }
}));
