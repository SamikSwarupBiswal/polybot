# Polybot Strategy Flags

This project should treat Polymarket prices as probability estimates and only trade when a strategy has a measured edge over the current market price. The MVP now encodes these paper-trading safety flags in `RiskGate`:

- Minimum market volume: $50,000.
- Minimum signal confidence: 0.60.
- Maximum single-market exposure: 5% of conservative equity.
- Maximum category exposure: 25% of conservative equity.
- Maximum open positions: 15.
- Daily realized loss cap: 10% of starting capital.
- Minimum time to market end: 48 hours.
- Minimum whale trade copied: $5,000 source trade size.
- Maximum whale follow size: $2,000.
- Per-trade planned max loss: 50% of that trade's stake using a paper stop-loss price.
- Bankroll sizing: base bet is intentionally small, shrinks during drawdowns, and is capped even when the wallet grows.

## Useful Trading Inputs

Real Polymarket traders and market makers generally combine several categories of signal rather than betting on one flag:

- Market structure: midpoint, best bid/ask, spread, depth near midpoint, volume, open interest, liquidity, and reward configuration.
- Probability edge: model probability minus market probability, with a threshold high enough to survive slippage and non-fill risk.
- News latency: headline relevance, direction, event importance, and whether the market has already repriced.
- Whale quality: realized PnL, win rate, sample size, recency, category specialization, and whether new trades are large enough to represent conviction.
- Risk controls: exposure per market/category, daily loss cap, position count, market end-date cutoff, and fill assumptions.
- Maker behavior: use limit orders, avoid crossing wide spreads, and prefer markets where resting orders can fill without paying unnecessary taker costs.

## Suggested Algorithms

- Bayesian probability update: start from the market price as the prior, then adjust with structured evidence from news, order flow, or specialist-wallet activity.
- Kelly-lite sizing: size proportional to estimated edge and confidence, then cap with hard portfolio limits. Full Kelly is too aggressive for a noisy MVP.
- Capital-preservation sizing: planned risk is calculated as stake multiplied by max-loss percentage; if drawdown is high, trade size should compress before the bot stops completely.
- Whale score: combine PnL, win rate, sample size, recency, and category consistency. Do not copy wallets purely because they recently made one large winning trade.
- Orderbook quality score: prefer markets with tight spreads, enough depth at/near the intended limit price, and enough volume to exit.
- Calibration tracking: after each resolved paper trade, compare predicted probability buckets against realized outcomes.

## Graphify

`graphify-out` is useful as a one-off architecture map for a compact repository, but it should not be inside `src` and should not be treated as source context. It is generated output, so keep it ignored unless you intentionally want to preserve a snapshot.
