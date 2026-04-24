# Polybot MVP — Complete Deep Dive

## One-Line Summary

Polybot is an **autonomous paper-trading bot** for [Polymarket](https://polymarket.com) that scans real prediction markets, scores opportunities, places simulated bets through a 12+ rule risk engine, monitors positions for stop-losses, auto-resolves trades when markets close, and tracks everything in a persistent ledger with a live dashboard.

---

## What Polymarket Is (Context)

Polymarket is a prediction market. Users buy YES/NO outcome tokens for questions like *"Will the Fed cut rates by June?"*. Tokens are priced $0.01–$0.99 (representing probability). If you buy YES at $0.40 and the event happens, your token resolves to $1.00 → you profit $0.60/share. If it doesn't happen, your token resolves to $0.00 → you lose $0.40/share.

Polybot's job: **find mispriced markets, bet the right side, manage risk, and track performance** — all in simulation mode before risking real money.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript (ES Modules) |
| Runtime | Node.js |
| Market Discovery | Polymarket Gamma API (REST, no auth required) |
| Pricing Data | Polymarket CLOB API (REST, no auth for reads) |
| Wallet Tracking | Polymarket Data API (REST) |
| Logging | Winston |
| HTTP Client | Axios |
| Ethereum Types | ethers.js (for CLOB client compatibility) |
| CLOB Client | `@polymarket/clob-client-v2` |
| Persistence | Local JSON file (`ledger.json`) |
| Build | TypeScript compiler (`tsc`) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                           index.ts                              │
│                     (Main Orchestrator)                          │
│                                                                 │
│  Starts all services, wires events, handles graceful shutdown   │
└────────┬──────────┬──────────┬──────────┬──────────┬────────────┘
         │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼
┌─────────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
│  Research   │ │ Whale  │ │  News  │ │Position│ │ Resolution │
│  Runner     │ │Monitor │ │Ingest. │ │Monitor │ │  Monitor   │
│ (15 min)    │ │(30 sec)│ │(25 sec)│ │(60 sec)│ │  (5 min)   │
└──────┬──────┘ └───┬────┘ └───┬────┘ └───┬────┘ └─────┬──────┘
       │            │          │          │             │
       │            │     ┌────▼────┐     │             │
       │            │     │   AI    │     │             │
       │            │     │ Signal  │     │             │
       │            │     │ Engine  │     │             │
       │            │     └────┬────┘     │             │
       │            │          │          │             │
       ▼            ▼          ▼          │             │
  ┌────────────────────────────────┐      │             │
  │       Signal Aggregator       │      │             │
  │  (Routes all signals to risk) │      │             │
  └──────────────┬────────────────┘      │             │
                 ▼                       │             │
  ┌──────────────────────────┐           │             │
  │        Risk Gate         │           │             │
  │  (12+ rules, sizing,    │           │             │
  │   adaptive max loss)     │           │             │
  └──────────────┬───────────┘           │             │
                 ▼                       │             │
  ┌──────────────────────────┐           │             │
  │   Paper Trade Executor   │           │             │
  │  (Slippage, fees, stops) │           │             │
  └──────────────┬───────────┘           │             │
                 ▼                       ▼             ▼
  ┌──────────────────────────────────────────────────────┐
  │                  Virtual Wallet                       │
  │  (Balance, ledger, open/closed trades, stop-loss,    │
  │   category exposure, PnL, resolution)                 │
  │                                                       │
  │  Persists to: ledger.json                             │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │              Performance Tracker                      │
  │  (ROI, Win Rate, Drawdown, Segmentation)              │
  └──────────────────────┬───────────────────────────────┘
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │             Dashboard Reporter                        │
  │  (Terminal table + HTML report on shutdown)            │
  └──────────────────────────────────────────────────────┘
```

---

## Every File, Explained

### Entry Point

#### [index.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/index.ts) — Main Orchestrator
**What it does:** Boots the entire system. Creates all service instances, wires event listeners, starts polling loops, and handles `SIGINT` (Ctrl+C) for graceful shutdown.

**Startup sequence:**
1. Creates `VirtualWallet` with $10,000 starting balance
2. Creates `PaperTradeExecutor` and `PositionMonitor`
3. Creates `RiskGate`, `WhaleMonitor`, `NewsIngestionService`, `AISignalEngine`
4. Creates `SignalAggregator` (wires whale + AI signals)
5. Creates `MarketResearchRunner` (15-min scan cycle) and `MarketResolutionMonitor` (5-min resolution check)
6. Wires research runner into aggregator
7. Starts all polling loops
8. Starts dashboard heartbeat (every 20 seconds)
9. On `SIGINT`: stops all intervals, prints final dashboard, generates HTML report, exits

**Polling schedule:**

| Service | Interval | What it polls |
|---------|----------|--------------|
| WhaleMonitor | 30 sec | Target wallet activity via Data API |
| NewsIngestionService | 25 sec | Mock RSS/headline feed |
| PositionMonitor | 60 sec | CLOB SELL prices for open trades |
| MarketResearchRunner | 15 min | Full scan → price → score → signal pipeline |
| MarketResolutionMonitor | 5 min | Gamma API for market resolution status |
| DashboardReporter | 20 sec | Prints terminal dashboard |

---

### Research Layer (NEW — `src/research/`)

This is the "brain" that actively searches Polymarket for betting opportunities.

#### [MarketScanner.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/research/MarketScanner.ts) — Market Discovery

**What it does:** Paginates through Polymarket's Gamma API to find all active, tradeable markets.

**How it works:**
```
GET https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&offset=0
GET https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&offset=100
... (up to 20 pages = 2000 markets)
```

**Filters applied (server-side + client-side):**
| Filter | Threshold | Why |
|--------|-----------|-----|
| `active=true, closed=false` | Must be open | Can't trade closed markets |
| Volume | ≥ $50,000 | Low-volume markets have bad spreads and manipulation risk |
| End date | ≥ 48 hours from now | Too close to resolution = price manipulation zone |
| Token IDs | Must exist | Needed for CLOB pricing; some Gamma entries lack tokens |

**Caching:** Results are cached for 10 minutes. Repeated calls within the window return the cache instantly to avoid hammering the API.

**Output:** `CandidateMarket[]` — typically 50-200 markets with: `conditionId`, `question`, `category`, `volume`, `endDate`, `tokens[]`, `slug`, `description`.

---

#### [OrderbookAnalyzer.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/research/OrderbookAnalyzer.ts) — Price Intelligence

**What it does:** For each candidate market, fetches real-time pricing from the CLOB (Central Limit Order Book).

**API calls per token (3 parallel requests):**
```
GET https://clob.polymarket.com/midpoint?token_id=TOKEN     → probability
GET https://clob.polymarket.com/price?token_id=TOKEN&side=SELL  → best bid
GET https://clob.polymarket.com/price?token_id=TOKEN&side=BUY   → best ask
```

**What it computes per token:**
| Field | Meaning |
|-------|---------|
| `midpoint` | Current probability (0.00-1.00) |
| `bestBid` | Highest price someone is willing to buy at |
| `bestAsk` | Lowest price someone is willing to sell at |
| `spread` | `bestAsk - bestBid` (the cost of trading) |
| `spreadPct` | `spread / midpoint` (relative cost) |
| `isLiquid` | `true` if spread < $0.04 |

**Rate limiting:** 60ms delay between API calls. With ~80 markets × 2 tokens × 3 calls = ~480 requests per cycle, processed with parallel batching within each token to stay under CLOB's ~100 req/min limit.

**Output:** `PricedMarket[]` — markets that returned valid pricing, enriched with `yesMidpoint` (probability) and `bestSpread`.

---

#### [OpportunityScorer.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/research/OpportunityScorer.ts) — Ranking Engine

**What it does:** Scores every priced market on 6 dimensions and returns the top 20.

**Scoring model:**

| Factor | Weight | Score = 1.0 (best) | Score = 0.0 (worst) |
|--------|--------|---------------------|---------------------|
| **Liquidity** (25%) | Volume percentile rank | Highest volume in the batch | Lowest volume |
| **Spread Quality** (20%) | Bid-ask spread | Spread ≤ $0.02 | Spread ≥ $0.06 |
| **Time Safety** (15%) | Days until resolution | 7-90 days | < 2 days |
| **Volume Activity** (15%) | Absolute volume tier | ≥ $500K | < $100K |
| **Price Range** (15%) | Distance from extremes | 0.25-0.75 (uncertain) | > 0.92 or < 0.08 (foregone conclusion) |
| **Category Preference** (10%) | Fee and signal density | Geopolitics (0% fee) | "Other" category |

**Side selection:** For each scored market, the scorer recommends YES or NO based on which side is closer to 0.50 (more uncertainty = more room for the bot to potentially find edge).

**Output:** `ScoredMarket[]` — top 20, each with: composite `score` (0-1), `breakdown` per factor, `recommendedSide`, `recommendedPrice`, `recommendedTokenId`.

---

#### [MarketResearchRunner.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/research/MarketResearchRunner.ts) — Pipeline Orchestrator

**What it does:** Runs the complete scan → price → score → trade pipeline on a 15-minute schedule.

**Pipeline per cycle:**
```
1. MarketScanner.scan()         → 50-200 candidate markets
2. Sort by volume, take top 80  → rate-limit protection
3. OrderbookAnalyzer.analyze()  → pricing/spread for each
4. OpportunityScorer.rank()     → top 20 scored markets
5. For top 5 (not recently signaled): emit TradeSignal
```

**Anti-spam:** Each market has a 1-hour cooldown after being signaled. The bot won't spam the same market every 15 minutes.

**Signal construction:** Each emitted signal includes:
- `mode: 'AI_SIGNAL'`
- Real `market_id` (condition ID from Gamma)
- Real `outcome_token_id` (CLOB token, enables stop-loss monitoring)
- `requested_price`: the best ask (for maker limit order simulation)
- `confidence`: normalized opportunity score (0.60-0.95)
- `market_volume_usd`, `market_end_date`: real Gamma data
- `recommended_size_usd`: $1,500 (RiskGate will downsize based on bankroll)

Signals are emitted as events that `SignalAggregator` consumes.

---

#### [MarketResolutionMonitor.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/research/MarketResolutionMonitor.ts) — Auto-Resolution

**What it does:** Polls Gamma API every 5 minutes to check if any markets with open paper trades have resolved.

**How it works:**
```
Every 5 minutes:
  → Get unique market_ids from all OPEN trades in the wallet
  → For each: GET /markets?condition_ids=MARKET_ID
  → If market.closed === true AND market.resolved === true:
    → Find which outcome won (from token.winner field)
    → If trade.side matches winning outcome → wallet.resolveTrade(id, true)  [WIN]
    → If trade.side doesn't match → wallet.resolveTrade(id, false)          [LOSS]
```

> [!IMPORTANT]
> This is the **only** path through which paper trades get resolved. There is no random resolution, no simulated outcomes. The bot waits for the real Polymarket market to close and then records the real result. This means performance metrics (ROI, win rate, drawdown) are **genuine**.

---

### Data Layer (`src/data/`)

#### [WhaleMonitor.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/data/WhaleMonitor.ts) — Copy-Trading Engine

**What it does:** Monitors specific whale wallet addresses on Polymarket and emits copy-trade signals when they make qualifying trades.

**Whale qualification (must pass ALL):**
| Criteria | Threshold | Source |
|----------|-----------|--------|
| Lifetime PnL | ≥ $50,000 | Data API `/positions` |
| Win Rate | ≥ 55% | Calculated from positions |
| Sample Size | ≥ 50 trades | Position count |

**Two modes:**
1. **Real wallets** (matches `0x[a-fA-F0-9]{40}` regex):
   - Fetches whale score from `GET /positions?user=WALLET`
   - Fetches recent trades from `GET /activity?user=WALLET&type=TRADE`
   - Only copies BUY trades (not sells)
   - Deduplicates with a `seenTradeKeys` set
   - Fetches market metadata from Gamma for each trade
   - Emits signal at 10% of whale's trade size

2. **Mock wallets** (anything else, e.g. `0xWHALE_QUALIFIED`):
   - Uses hardcoded score lookup
   - 20% chance per poll to emit a mock trade
   - Used for testing without real API calls

**Polling:** Every 30 seconds. Uses `lastPollByWallet` map to only fetch activity since the last poll (incremental).

**Environment variables:**
- `WHALE_WALLETS` — comma-separated list of wallet addresses
- `MIN_WHALE_PNL_USD`, `MIN_WHALE_WIN_RATE`, `MIN_WHALE_SAMPLE_SIZE` — override thresholds
- `WHALE_LOOKBACK_SECONDS` — how far back to look on first poll (default: 600s)

---

#### [NewsIngestionService.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/data/NewsIngestionService.ts) — News Feed

**What it does:** Simulates a breaking news feed. Currently uses 5 hardcoded headlines with a 30% chance of firing one every 25 seconds.

**Headlines:**
- Apple smart ring announcement
- OpenAI funding round
- Senate crypto legislation
- Federal Reserve rate cut
- SpaceX Mars landing

When a headline fires, it emits a `news_headline` event that the `AISignalEngine` processes.

> [!NOTE]
> This is the most "mock" part of the system. A real implementation would connect to NewsAPI, RSS feeds, or Twitter/X firehose. The scoring logic in AISignalEngine is designed so that swapping in real headlines requires zero code changes.

---

#### [MarketDataService.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/data/MarketDataService.ts) — Simple Market Fetcher

**What it does:** A simpler, standalone market fetcher that queries Gamma API for liquid markets. This was built before the full Research Layer and is still available as a utility, though the new `MarketScanner` supersedes it for the research pipeline.

**API:** `GET /markets?active=true&closed=false&limit=100` → filters by `minVolume`.

---

### Strategy Layer (`src/strategy/`)

#### [AISignalEngine.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/strategy/AISignalEngine.ts) — News-to-Signal Converter

**What it does:** Takes a headline, matches it to a market, estimates probability shift, and emits a trade signal if the edge exceeds 8%.

**How it works:**
1. **Market matching:** Each market has keywords. The headline is checked against all markets; the one with the most keyword matches wins.
2. **Probability estimation:** Looks for positive flags (`announces`, `secures`, `passes`, etc.) and negative flags (`denies`, `delays`, `fails`, etc.). Each flag shifts the probability by ±18%.
3. **Edge calculation:** `|model_probability - market_probability|`. Must exceed 8% to emit a signal.
4. **Direction:** If model probability > market probability → buy YES. If model < market → buy NO.

**Example:**
```
Headline: "OpenAI secures additional 5 Billion funding round from Microsoft"
Matched market: "Will OpenAI raise another round >$1B in 2026?" (prob: 0.65)
Positive flags: "secures" → +18%
Model probability: 0.83
Edge: |0.83 - 0.65| = 18% > 8% threshold
Signal: BUY YES at $0.83, confidence 0.85
```

**Live hydration:** The new `hydrateMarkets()` method allows the research runner to replace the hardcoded 5-market list with real scanned markets. Keywords are auto-generated from the question text.

---

### Execution Layer (`src/execution/`)

#### [RiskGate.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/execution/RiskGate.ts) — The Brain

**What it does:** Every signal must pass through RiskGate before a trade is placed. It enforces 12+ rules and determines the position size.

**Pre-trade checks (any failure = signal BLOCKED):**

| # | Rule | Threshold |
|---|------|-----------|
| 1 | Max portfolio drawdown | ≤ 25% from peak equity |
| 2 | Max open positions | ≤ 15 |
| 3 | Daily realized loss cap | ≤ 10% of starting capital |
| 4 | Min signal confidence | ≥ 0.60 |
| 5 | Min market volume | ≥ $50,000 |
| 6 | Min time to resolution | ≥ 48 hours |
| 7 | Min whale trade size (copy-trade only) | ≥ $5,000 source trade |
| 8 | Max single-market exposure | ≤ 5% of conservative equity |
| 9 | Max category exposure | ≤ 25% of conservative equity |
| 10 | Max whale follow size | ≤ $2,000 per copy |
| 11 | Min trade size | ≥ $10 after all caps |

**Adaptive max-loss per trade:**

| Condition | Max Loss % |
|-----------|-----------|
| Low confidence (<0.70) or low-volume market | 25% |
| Normal confidence, adequate liquidity | 30% |
| High confidence (≥0.85) + high liquidity (≥$250K) + strong edge (≥15%) | 50% |

**Bankroll-aware sizing (Kelly-lite):**
The position size is calculated as:

```
portfolioRiskPct = baseRisk(1%) × confidenceMultiplier × edgeMultiplier × drawdownMultiplier × profitMultiplier
dollarsAtRisk = conservativeEquity × portfolioRiskPct
tradeSize = dollarsAtRisk / maxLossPct
finalSize = min(tradeSize, maxStake(3.5% of equity), marketCap, categoryCap, copyTradeCap, balance)
```

| Multiplier | Range | Logic |
|-----------|-------|-------|
| Confidence | 0.60-0.95 | Higher confidence = slightly larger bet |
| Edge | 0.75-1.25 | Higher model edge = larger bet. No edge = 25% reduction |
| Drawdown | 0.25-1.0 | Losing money = bets shrink proportionally |
| Profit | 1.0-1.25 | Making profit = bets grow gently (max +25%) |

**Example sizing:**
```
$10,000 equity, 0.85 confidence, 10% edge, no drawdown, no profit:
  portfolioRisk = 1% × 0.85 × 1.0 × 1.0 × 1.0 = 0.85%
  dollarsAtRisk = $10,000 × 0.0085 = $85
  maxLoss = 30% (normal conviction)
  tradeSize = $85 / 0.30 = $283
  maxStake = $10,000 × 3.5% = $350
  finalSize = min($283, $350, balance, marketCap, categoryCap) = $283
```

---

#### [PaperTradeExecutor.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/execution/PaperTradeExecutor.ts) — Trade Placement

**What it does:** Takes an approved signal and converts it into a paper trade in the wallet.

**Steps:**
1. **Apply slippage:** Entry price = requested price × 1.005 (0.5% worse). Simulates market impact.
2. **Calculate shares:** `investmentUsd / entryPrice`
3. **Calculate fee:** Via `FeeSimulator` (0% for maker orders, 0.75%-1.8% for taker by category)
4. **Calculate stop-loss price:** `entryPrice × (1 - maxLossPct)`, floored at $0.001
5. **Calculate max loss USD:** `(notionalCost + fee) × maxLossPct`
6. **Log trade:** Calls `wallet.logTrade()` which deducts cost from balance, generates UUID, timestamps, persists to `ledger.json`

---

#### [PositionMonitor.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/execution/PositionMonitor.ts) — Stop-Loss Monitor

**What it does:** Polls CLOB API every 60 seconds to check if any open trade should be stopped out.

**For each open trade:**
1. Get the trade's `outcome_token_id`
2. Fetch current SELL price from CLOB: `GET /price?token_id=TOKEN&side=SELL`
3. If SELL price ≤ trade's `stop_loss_price`:
   - Call `wallet.applyStopLoss(tradeId, currentPrice)`
   - This closes the trade at the current price, records PnL, marks as `CLOSED_EXIT` with reason `STOP_LOSS`

**Example:**
```
Trade: bought YES at $0.50, maxLoss=30%, stopLoss = $0.50 × 0.70 = $0.35
Current CLOB SELL price: $0.33 (below $0.35 stop)
→ Trade closed at $0.33, PnL = (shares × $0.33) - (cost + fee)
```

---

#### [VirtualWallet.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/execution/VirtualWallet.ts) — Money Tracker

**What it does:** Manages the simulated USDC balance, persists all trades to `ledger.json`, and provides the data layer for risk calculations.

**State:**
- `balance`: Available cash (not locked in trades)
- `total_deposited`: Starting capital (for ROI calculation)
- `trades[]`: Complete trade history

**Key methods:**

| Method | What it does |
|--------|-------------|
| `logTrade()` | Deducts cost+fee from balance, creates trade record with UUID, persists |
| `resolveTrade(id, won)` | If won: adds shares×$1.00 to balance (Polymarket payout). If lost: $0 payout. Records PnL |
| `closeTradeAtPrice(id, price, reason)` | Exits at arbitrary price (for stop-loss/take-profit). Adds shares×price to balance |
| `applyStopLoss(id, currentPrice)` | Checks if price ≤ stop_loss_price, calls closeTradeAtPrice if true |
| `getOpenExposureByMarket(id)` | Sum of notional_cost for open trades in this market |
| `getOpenExposureByCategory(cat)` | Sum of notional_cost for open trades in this category |
| `getConservativeEquity()` | balance + total open position cost (cost basis, not mark-to-market) |
| `getRealizedPnlSince(date)` | Sum of closed-trade PnL since a date (for daily loss cap) |

**Trade record fields:**

| Field | Example |
|-------|---------|
| `trade_id` | `a1b2c3d4-...` (UUID) |
| `mode` | `COPY_TRADE`, `AI_SIGNAL`, `MANUAL_TEST` |
| `market_id` | `0xabc123...` (Gamma condition_id) |
| `outcome_token_id` | `12345...` (CLOB token ID) |
| `market_question` | `"Will the Fed cut rates?"` |
| `category` | `FINANCE` |
| `side` | `YES` or `NO` |
| `entry_price` | `0.4025` (after slippage) |
| `shares` | `37.27` |
| `notional_cost` | `$15.00` |
| `simulated_fee` | `$0.00` (maker) |
| `max_loss_pct` | `0.30` |
| `max_loss_usd` | `$4.50` |
| `stop_loss_price` | `$0.2818` |
| `status` | `OPEN`, `CLOSED_WIN`, `CLOSED_LOSS`, `CLOSED_EXIT` |
| `pnl` | `$22.45` or `-$15.00` |
| `exit_reason` | `STOP_LOSS`, `TAKE_PROFIT`, `MANUAL_EXIT`, or `null` |

---

#### [FeeSimulator.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/execution/FeeSimulator.ts) — Fee Model

**What it does:** Calculates the trading fee based on order type and category.

| Order Type | Fee |
|-----------|-----|
| **Maker (Limit)** | **0% across all categories** |
| Taker (Market) | Category-dependent |

| Category | Taker Fee |
|----------|-----------|
| Geopolitics | 0% |
| Politics, Technology | 1.0% |
| Finance | 1.25% |
| Sports | 0.75% |
| Crypto | 1.80% |
| Other | 1.0% |

> The bot defaults to `force_maker: true` on all signals, so in practice **fees are always $0.00**. The fee simulator exists especially for accuracy if taker orders are ever needed.

---

#### [SignalAggregator.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/execution/SignalAggregator.ts) — Signal Router

**What it does:** Listens for `signal` events from all three signal sources and routes them through the same pipeline.

**Three input sources:**
1. `WhaleMonitor.on('signal', ...)` → copy-trade signals
2. `AISignalEngine.on('signal', ...)` → news/AI signals
3. `MarketResearchRunner.on('signal', ...)` → market scan signals

**For each signal:**
```
1. riskGate.evaluateSignal(signal, wallet) → approvedSize (or 0 if blocked)
2. if approvedSize > 0:
   executor.executeSignal(mode, marketId, tokenId, ..., approvedSize, maxLossPct)
```

---

### Analytics Layer (`src/analytics/`)

#### [PerformanceTracker.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/analytics/PerformanceTracker.ts) — Metrics Engine

**What it does:** Computes all portfolio metrics from the wallet's trade history.

**Metrics calculated:**

| Metric | How it's calculated |
|--------|-------------------|
| **ROI** | `totalPnL / totalDeposited × 100` |
| **Win Rate** | `wins / closedTrades × 100` |
| **Max Drawdown** | Peak-to-trough equity decline across chronologically-sorted closed trades |
| **Conservative Equity** | `balance + sum(open trade costs)` |
| **Strategy Segmentation** | Wins, PnL, and open volume broken down by COPY_TRADE vs AI_SIGNAL |
| **Category Exposure** | Open notional cost per TradeCategory |

**Drawdown calculation:**
```typescript
peakEquity = totalDeposited;
for each closed trade (chronological):
    simulatedEquity += trade.pnl
    if simulatedEquity > peakEquity: peakEquity = simulatedEquity
    drawdown = (peakEquity - simulatedEquity) / peakEquity
    maxDrawdown = max(maxDrawdown, drawdown)
```

---

#### [DashboardReporter.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/analytics/DashboardReporter.ts) — Visual Output

**Two output modes:**

1. **Terminal Dashboard** (every 20 seconds):
```
================ [ POLYBOT TERMINAL DASHBOARD ] ================
┌─────────────────────┬──────────────┐
│ Metric              │ Value        │
├─────────────────────┼──────────────┤
│ Total Balance       │ $10,000.00   │
│ All-Time ROI        │ 0.00%        │
│ Max Drawdown        │ 0.00%        │
│ Open Trades         │ 0            │
│ Overall Win Rate    │ 0.00%        │
└─────────────────────┴──────────────┘
--- Active Strategies ---
┌──────────────┬──────────┬──────┬───────────────┐
│ Strategy     │ Open Vol │ Wins │ Realized PnL  │
├──────────────┼──────────┼──────┼───────────────┤
│ Whale Copy   │ $0.00    │ 0    │ $0.00         │
│ AI Predictor │ $0.00    │ 0    │ $0.00         │
└──────────────┴──────────┴──────┴───────────────┘
```

2. **HTML Report** (generated on shutdown → `polybot-report.html`):
   - Dark-themed, responsive web page
   - 4 KPI cards: Balance, Win Rate, ROI, Open Trades
   - Full trade ledger table with color-coded PnL
   - HTML-escaped to prevent XSS from market question text

---

### Utilities

#### [logger.ts](file:///c:/Users/Samik/OneDrive/Desktop/projects/polybot/MVP/src/utils/logger.ts) — Logging

Winston logger with timestamped console output:
```
[2026-04-24T13:00:00.000Z] INFO: [MarketResearch] Cycle complete...
```

---

## Data Flow: End-to-End Example

Let's trace a complete trade from market discovery to resolution:

```
1. [15:00] MarketResearchRunner.runCycle() fires

2. [15:00] MarketScanner.scan()
   → GET /markets?active=true&closed=false&limit=100&offset=0
   → 847 raw markets fetched
   → 142 pass volume/time/token filters

3. [15:02] OrderbookAnalyzer.analyze() (top 80 by volume)
   → For "Will the Fed cut rates > 50bps by June?"
   → Midpoint: 0.42, Bid: 0.41, Ask: 0.43, Spread: $0.02

4. [15:04] OpportunityScorer.rank()
   → This market scores:
     Liquidity: 0.82 (high volume percentile)
     Spread:    1.00 (spread $0.02 ≤ threshold)
     Time:      1.00 (45 days to resolution)
     Volume:    0.60 ($210K tier)
     Price:     1.00 (0.42 is in the sweet spot)
     Category:  0.60 (Finance)
   → Composite: 0.25×0.82 + 0.20×1.0 + 0.15×1.0 + 0.15×0.6 + 0.15×1.0 + 0.10×0.6 = 0.855
   → Ranked #3 out of 142

5. [15:04] MarketResearchRunner builds TradeSignal:
   → mode: AI_SIGNAL, side: YES, price: $0.43, confidence: 0.855
   → Emits 'signal' event

6. [15:04] SignalAggregator receives signal, calls RiskGate.evaluateSignal()
   → Drawdown check: 0% < 25% ✓
   → Open positions: 0 < 15 ✓
   → Daily loss: $0 < $1,000 ✓
   → Confidence: 0.855 ≥ 0.60 ✓
   → Volume: $210K ≥ $50K ✓
   → Time: 45 days ≥ 48 hours ✓
   → Adaptive max loss: 30% (normal conviction)
   → Bankroll sizing: $283
   → All caps clear
   → APPROVED: $283

7. [15:04] PaperTradeExecutor.executeSignal()
   → Slippage: $0.43 × 1.005 = $0.43215
   → Shares: $283 / $0.43215 = 654.7 shares
   → Fee: $0 (maker)
   → Stop-loss: $0.43215 × 0.70 = $0.3025
   → wallet.logTrade() → deducts $283, saves to ledger.json

8. [15:05, 15:06, ...] PositionMonitor polls every 60s
   → GET /price?token_id=FED_TOKEN&side=SELL
   → Current: $0.44 > $0.3025 stop → no action

9. [45 days later] MarketResolutionMonitor.checkResolutions()
   → GET /markets?condition_ids=FED_CONDITION_ID
   → market.closed=true, market.resolved=true
   → tokens[0].winner=true (YES won)
   → trade.side === 'YES' === winning outcome → WIN
   → wallet.resolveTrade(tradeId, true)
   → Payout: 654.7 × $1.00 = $654.70
   → PnL: $654.70 - $283 = +$371.70
   → Balance: $10,000 - $283 + $654.70 = $10,371.70
```

---

## Configuration

### Environment Variables (`.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GAMMA_API_URL` | `https://gamma-api.polymarket.com` | Market data |
| `CLOB_API_URL` | `https://clob.polymarket.com` | Pricing/trading |
| `DATA_API_URL` | `https://data-api.polymarket.com` | Wallet activity |
| `POLYGON_RPC_URL` | `https://polygon-rpc.com` | Blockchain (unused in paper mode) |
| `WHALE_WALLETS` | `0x...` (comma-separated) | Wallets to copy-trade |
| `POSITION_MONITOR_INTERVAL_MS` | `60000` | Stop-loss check frequency |
| `MIN_WHALE_PNL_USD` | `50000` | Whale qualification threshold |
| `MIN_WHALE_WIN_RATE` | `55` | Whale qualification threshold |
| `MIN_WHALE_SAMPLE_SIZE` | `50` | Whale qualification threshold |
| `WHALE_LOOKBACK_SECONDS` | `600` | Initial lookback window |

### NPM Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Runs the bot with ts-node (live TypeScript) |
| `npm run build` | Compiles to `dist/` |
| `npm run start` | Runs compiled JS from `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm run test` | Runs typecheck (no unit tests yet) |

---

## What's Working vs What's Mock

| Component | Status | Details |
|-----------|--------|---------|
| Market Scanner | ✅ **Real** | Fetches actual Polymarket markets from Gamma API |
| Orderbook Analyzer | ✅ **Real** | Fetches actual CLOB midpoint/spread/bid/ask |
| Opportunity Scorer | ✅ **Real** | Weighted scoring on real data |
| Research Runner | ✅ **Real** | Full pipeline, real signals |
| Resolution Monitor | ✅ **Real** | Checks real market resolution status |
| Position Monitor | ✅ **Real** | Fetches real CLOB prices for stop-loss |
| RiskGate | ✅ **Real** | All rules enforced against real wallet state |
| Virtual Wallet | ✅ **Real** | Persistent ledger, accurate PnL |
| Fee Simulator | ✅ **Real** | Matches actual Polymarket fee schedule |
| Dashboard | ✅ **Real** | Accurate metrics from real trade data |
| Whale Monitor | ⚠️ **Hybrid** | Real API integration exists, but default wallets in `.env` are mock addresses |
| News Ingestion | ❌ **Mock** | Hardcoded headlines, random timing |
| AI Signal Engine | ⚠️ **Partial** | Keyword matching, not LLM. But correctly emits directional signals |

---

## What It Cannot Do Yet

| Gap | Impact | Priority |
|-----|--------|----------|
| **No real LLM** | AI signals use keyword matching instead of Claude/Gemini | Medium |
| **No real news feed** | Headlines are hardcoded mocks | Medium |
| **No unit tests** | Can't verify logic survives refactoring | High |
| **No live trading** | Everything is paper-traded (by design for MVP) | Low (intentional) |
| **No 24h volume data** | Scorer uses absolute volume tiers instead of activity trend | Low |
| **No take-profit** | Trades only exit via stop-loss or market resolution | Medium |
| **No correlation check** | Could bet on related markets simultaneously | Low |
| **No WebSocket streaming** | Uses polling instead of real-time price feeds | Low |
