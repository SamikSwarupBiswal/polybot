import { VirtualWallet } from './VirtualWallet.js';
import { FeeSimulator, TradeCategory } from './FeeSimulator.js';
import { logger } from '../utils/logger.js';

export class PaperTradeExecutor {
    private wallet: VirtualWallet;

    // Simulate average slippage for entry (e.g. 0.5% cost spread)
    private readonly SIMULATED_SLIPPAGE = 0.005;

    constructor(wallet: VirtualWallet) {
        this.wallet = wallet;
    }

    /**
     * Executes a paper trade signal.
     */
    public executeSignal(
        mode: 'COPY_TRADE' | 'AI_SIGNAL' | 'MANUAL_TEST',
        marketId: string,
        outcomeTokenId: string | undefined,
        marketQuestion: string,
        category: TradeCategory,
        side: 'YES' | 'NO',
        requestedPrice: number,
        investmentUsd: number,
        signalSource: string,
        confidence: number,
        forceMaker: boolean = true,
        maxLossPct: number = 0.50
    ) {
        try {
            // Apply slippage penalty (we assume the price might cost slightly more to get filled)
            // Example: desired price 0.50. With 0.5% slippage => 0.5025. 
            // In limits, it's more about "will it fill", but we model worst-case entry.
            // Since max price is 1.0, clamp it.
            const entryPrice = Math.min(requestedPrice * (1 + this.SIMULATED_SLIPPAGE), 0.999);

            const shares = investmentUsd / entryPrice;
            const notionalCost = investmentUsd;

            const fee = FeeSimulator.calculateFee(notionalCost, forceMaker, category);
            const safeMaxLossPct = Math.min(Math.max(maxLossPct, 0.05), 1);
            const stopLossPrice = Math.max(entryPrice * (1 - safeMaxLossPct), 0.001);
            const maxLossUsd = (notionalCost + fee) * safeMaxLossPct;

            logger.info(`PaperTradeExecutor taking signal [${mode}] for ${marketId} - side: ${side}`);

            const trade = this.wallet.logTrade({
                mode,
                market_id: marketId,
                outcome_token_id: outcomeTokenId || null,
                market_question: marketQuestion,
                category,
                side,
                entry_price: entryPrice,
                shares,
                notional_cost: notionalCost,
                simulated_fee: fee,
                max_loss_pct: safeMaxLossPct,
                max_loss_usd: maxLossUsd,
                stop_loss_price: stopLossPrice,
                signal_source: signalSource,
                signal_confidence: confidence,
                notes: `Simulated trade targeting limit execution at ~$${entryPrice.toFixed(3)}/share with a stop-loss near $${stopLossPrice.toFixed(3)}.`
            });

            return trade;
        } catch (error: any) {
            logger.error(`Failed to execute paper trade: ${error.message}`);
            return null;
        }
    }
}
