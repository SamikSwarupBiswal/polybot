# Polybot Upgrade Brainstorm — High-Impact Changes

## The Core Problem Right Now

The bot is **structurally excellent** (risk gates, sizing, monitoring, persistence) but **strategically blind**. Here's why:

```
Current decision process:
  "Is this market liquid + well-spread + not about to expire?"
  → YES → "Buy whichever side is closer to 50%"

What it SHOULD be:
  "Is this market MISPRICED? By how much? In which direction? How confident am I?"
  → If edge > cost of trading → size proportionally → enter
```

**The #1 gap: the bot never asks "is this price WRONG?"** — it just finds tradeable markets and bets on them. That's like finding a liquid stock with tight spreads and buying it because it's easy to trade, not because it's undervalued.

---

## Upgrade 1: Edge Detection Engine ⭐⭐⭐⭐⭐

**Impact: CRITICAL — this is the single most important upgrade**

### Problem
The `OpportunityScorer` ranks markets by *tradability* (liquidity, spread, time). It never estimates whether the market price is actually wrong. Without edge, every trade is a coin flip minus fees.

### Solution: Multi-Signal Edge Model

Build a `src/strategy/EdgeEstimator.ts` that combines multiple weak signals into a probability estimate, then compares it to the market price.

```
Edge = |Model Probability - Market Price| - Trading Cost

If Edge > 0 → the market is mispriced in our favor
If Edge ≤ 0 → no trade (we'd lose money on expectation)
```

**Signal sources for the model probability:**

| Signal | Weight | How to get it |
|--------|--------|--------------|
| **Polymarket line movement** | 30% | Track price over last 24/48/168 hours from CLOB. If price moved from 0.30→0.45, momentum suggests YES |
| **Volume-price divergence** | 20% | If volume is surging but price is flat, someone knows something. Direction = which side is absorbing volume |
| **Whale consensus** | 15% | If 3+ qualifying whales all bought YES, that's a signal. Already have WhaleMonitor data |
| **Cross-market correlation** | 10% | If "Will Fed cut rates?" is at 0.70 and "Will mortgage rates drop?" is at 0.30, one of them is wrong |
| **Category base rate** | 10% | Historical: what % of political markets resolve YES vs NO? Crypto? Sports? Use as uninformed prior |
| **News sentiment** | 15% | Current AISignalEngine keyword score, or future LLM score |

**Composite formula:**
```
modelProb = Σ(signal_i × weight_i)   // weighted average
edge = |modelProb - marketMidpoint| - spreadCost - slippageCost
confidence = min(0.95, edgeMagnitude × signalCount / maxSignals)
```

**Integration:** Replace `OpportunityScorer`'s side selection (currently: "whichever is closer to 0.50") with EdgeEstimator's directional output.

> **Difficulty:** Medium-High. Needs historical price tracking (Upgrade 2 below).  
> **Expected accuracy improvement:** 30-50% (the difference between random betting and informed betting)

---

## Upgrade 2: Price History Tracker ⭐⭐⭐⭐⭐

**Impact: CRITICAL — enables Edge Detection, regime detection, and calibration**

### Problem
The bot only knows the current price. It has zero memory of where prices were an hour, a day, or a week ago. Without this, you can't detect momentum, reversals, or line movement patterns.

### Solution: `src/data/PriceHistoryStore.ts`

A lightweight time-series cache that stores snapshots every research cycle:

```typescript
type PricePoint = {
    tokenId: string;
    midpoint: number;
    bestBid: number;
    bestAsk: number;
    spread: number;
    volume: number;
    timestamp: number;
};

// Store: Map<conditionId, PricePoint[]>
// Persist to: price_history.json (or SQLite for scale)
// Retention: 30 days rolling window
```

**Derived metrics:**
| Metric | Formula | What it tells you |
|--------|---------|-------------------|
| 1h momentum | `(price_now - price_1h_ago) / price_1h_ago` | Short-term direction |
| 24h momentum | `(price_now - price_24h_ago) / price_24h_ago` | Medium-term trend |
| 7d momentum | `(price_now - price_7d_ago) / price_7d_ago` | Established trend |
| Volatility | `stddev(prices_24h)` | How noisy the market is |
| Spread trend | `avg(spread_now) vs avg(spread_24h_ago)` | Is liquidity improving or drying up? |
| Volume spike | `volume_1h / avg_volume_24h` | Sudden interest = news or insider trading |

> **Difficulty:** Low. Just append data to an array every scan cycle.  
> **Expected accuracy improvement:** 15-20% (the data that makes Edge Detection possible)

---

## Upgrade 3: Calibration & Feedback Loop ⭐⭐⭐⭐

**Impact: HIGH — this is how the bot LEARNS**

### Problem
After a trade resolves, the bot records win/loss but never asks: "Was my probability estimate correct? Am I systematically overconfident? Do I do better in politics than crypto?"

### Solution: `src/analytics/CalibrationTracker.ts`

After each resolved trade, record:
```typescript
{
    predictedProbability: 0.65,    // what EdgeEstimator thought
    marketPriceAtEntry: 0.43,      // what the market said
    actualOutcome: 1,              // 1 = YES won, 0 = NO won
    category: 'FINANCE',
    signalSource: 'MarketResearch',
    edge: 0.22,
    confidenceScore: 0.85
}
```

**Calibration analysis (run weekly or on demand):**

| Analysis | What it measures |
|----------|-----------------|
| **Brier Score** | `avg((predictedProb - actualOutcome)²)` — lower is better. Perfect = 0, random = 0.25 |
| **Calibration curve** | Group predictions into buckets (0.1-0.2, 0.2-0.3, ...). If you predict 70%, events should happen ~70% of the time |
| **Category accuracy** | Brier score per category. Maybe you're great at politics but terrible at crypto |
| **Edge accuracy** | Do high-edge trades actually win more? If not, your edge model is wrong |
| **Confidence reliability** | Do high-confidence signals outperform low-confidence ones? |

**Feedback integration:**
```
If Brier(CRYPTO) > 0.30 → reduce CRYPTO category weight in scorer
If Brier(POLITICS) < 0.15 → increase POLITICS category weight
If high-confidence trades don't outperform → reduce confidence multiplier in sizing
```

This is effectively a **self-correcting mechanism** that improves over time.

> **Difficulty:** Medium. Needs resolved trades with probability data.  
> **Expected accuracy improvement:** 10-20% over months (compound improvement)

---

## Upgrade 4: Smart Exit Strategy (Take-Profit + Trailing Stop) ⭐⭐⭐⭐

**Impact: HIGH — directly affects realized PnL**

### Problem
The bot has stop-loss but NO take-profit. If you buy YES at $0.40 and it runs to $0.85, you just sit there until market resolution (could be months away). You're leaving money on the table and tying up capital.

### Solution: Add to `PositionMonitor.ts`

**Three exit strategies per trade:**

| Strategy | Trigger | When to use |
|----------|---------|------------|
| **Fixed Take-Profit** | Price reaches entry × (1 + targetProfitPct) | Always on. Default: 40% profit |
| **Trailing Stop** | Price drops more than trailingPct from the highest price seen since entry | When price has moved >15% in your favor. Lock in gains while allowing further upside |
| **Time-Based Exit** | Market end date is < 24 hours away | Avoid resolution risk. Exit at market price before the rush |

**Trailing stop logic:**
```
highWaterMark = max(all prices seen since entry)

If currentPrice > entryPrice × 1.15:    // 15% in profit
    trailingStopPrice = highWaterMark × (1 - trailingPct)
    If currentPrice < trailingStopPrice:
        EXIT at currentPrice, reason: TRAILING_STOP

trailingPct = 0.15 for normal trades, 0.10 for high-conviction
```

**Example:**
```
Buy YES at $0.40
Price runs: $0.40 → $0.55 → $0.70 → $0.65
High water mark: $0.70
Trailing stop: $0.70 × 0.85 = $0.595
Current: $0.65 > $0.595 → hold

Price drops to $0.58:
$0.58 < $0.595 → EXIT at $0.58
PnL: ($0.58 - $0.40) × shares = +45% profit locked in
```

Without trailing stop: you might hold until resolution, where the price could drop back to $0.40 (all gains evaporated).

> **Difficulty:** Low-Medium. PositionMonitor already polls prices every 60s.  
> **Expected accuracy improvement:** 10-25% on realized PnL (same bets, better exits)

---

## Upgrade 5: Real LLM Integration ⭐⭐⭐

**Impact: MEDIUM-HIGH — upgrades the weakest signal source**

### Problem
`AISignalEngine` uses keyword matching with hardcoded positive/negative flags. This is a toy. A real LLM can understand context, nuance, and implications that keyword matching misses entirely.

### Solution: Replace `estimateYesProbability()` with an LLM call

**Prompt engineering:**
```
You are a prediction market analyst. Given this market question and this news headline,
estimate the probability that the event described in the question will happen.

Market: "Will the Senate pass comprehensive Crypto legislation in 2026?"
Current market price: 15% (YES)
News: "Senate committee votes 18-4 to advance crypto regulatory framework to floor vote"

Respond with ONLY a JSON object:
{
  "probability": 0.45,
  "confidence": 0.80,
  "reasoning": "Committee advancement is a strong positive signal, but floor vote is not guaranteed...",
  "direction": "YES"
}
```

**Provider options:**
| Provider | Cost per call | Latency | Quality |
|----------|--------------|---------|---------|
| Gemini Flash | ~$0.001 | 200ms | Good |
| Claude Haiku | ~$0.003 | 300ms | Better |
| GPT-4o Mini | ~$0.002 | 250ms | Good |
| Local LLaMA | $0 | 2-5s | Decent |

**Rate limiting:** Only call LLM for top 10 scored markets per cycle. At $0.003/call × 10 calls × 4 cycles/hour × 24h = ~$2.88/day. Very cheap for the accuracy boost.

**Integration:** LLM probability replaces keyword-based estimation. Everything downstream (edge calculation, sizing, risk) stays the same.

> **Difficulty:** Low (API call + prompt). Needs API key in `.env`.  
> **Expected accuracy improvement:** 15-30% on news-driven signals

---

## Upgrade 6: Order Flow Imbalance Detection ⭐⭐⭐

**Impact: MEDIUM — detects "smart money" movement before price catches up**

### Problem
The bot only looks at the midpoint price. It doesn't see WHO is trading or how aggressively. On Polymarket, large market orders hitting the book are extremely informative.

### Solution: `src/research/OrderFlowAnalyzer.ts`

Use Data API to detect order flow imbalance:

```
GET /trades?market=CONDITION_ID&limit=100&sortBy=TIMESTAMP&sortDirection=DESC
```

**Metrics:**
```
buyVolume_1h  = sum of all BUY trade sizes in last hour
sellVolume_1h = sum of all SELL trade sizes in last hour

imbalance = (buyVolume - sellVolume) / (buyVolume + sellVolume)
// Range: -1.0 (all selling) to +1.0 (all buying)

largeTradeBias = count of trades > $5K on each side
// If 8 large buys and 1 large sell → strong buy pressure
```

**Signal interpretation:**
| Imbalance | Large Trade Bias | Meaning |
|-----------|-----------------|---------|
| > +0.30 | Buy heavy | Strong accumulation → price likely to rise → BUY YES |
| < -0.30 | Sell heavy | Distribution → price likely to fall → BUY NO |
| Near 0 | Mixed | No directional signal |

**Why this works:** Large Polymarket traders (whales, insiders, researchers) often trade BEFORE the price fully adjusts. Order flow sees this before the midpoint does.

> **Difficulty:** Medium. Data API trade history + windowed aggregation.  
> **Expected accuracy improvement:** 10-15%

---

## Upgrade 7: Market Regime Detection ⭐⭐⭐

**Impact: MEDIUM — prevents trading in adverse conditions**

### Problem
The bot treats all market conditions the same. But prediction markets have distinct "regimes":
- **Trending:** Price moving steadily in one direction (ride it)
- **Mean-reverting:** Price oscillating around a center (fade extremes)
- **Event-driven:** Price about to jump on a known event (avoid unless news-informed)
- **Dead:** Low activity, wide spreads (avoid entirely)

### Solution: Classify each market's regime using price history

```
regime = classify(
    momentum_1h,
    momentum_24h,
    volatility_24h,
    volume_trend,
    daysToResolution
)

TRENDING:       |momentum_24h| > 0.10 AND direction consistent
MEAN_REVERTING: volatility_24h > 0.05 AND |momentum_24h| < 0.05
EVENT_DRIVEN:   daysToResolution < 7 AND volume_spike > 3x
DEAD:           volume_24h < $1000 OR spread > 8¢
```

**Trading rules by regime:**
| Regime | Strategy | Size modifier |
|--------|----------|--------------|
| TRENDING | Trade WITH the trend | 1.2x (larger) |
| MEAN_REVERTING | Trade AGAINST extremes | 0.8x (conservative) |
| EVENT_DRIVEN | Only trade if LLM has high-confidence signal | 0.6x |
| DEAD | Don't trade | 0x (skip) |

> **Difficulty:** Medium. Needs Price History Tracker (Upgrade 2).  
> **Expected accuracy improvement:** 10-15% (avoids bad trades + sizes good ones better)

---

## Upgrade 8: Bayesian Probability Update Model ⭐⭐

**Impact: MEDIUM — mathematically rigorous probability estimation**

### Problem
Edge Estimator (Upgrade 1) uses weighted averages. But Bayesian updating is the mathematically correct way to combine prior beliefs with new evidence.

### Solution:

```
Prior = market price (the market IS also a Bayesian aggregator — respect it)

For each piece of evidence:
    Likelihood ratio = P(evidence | YES) / P(evidence | NO)
    Posterior = Prior × LR / (Prior × LR + (1-Prior))

Final model probability = posterior after all evidence is incorporated
```

**Example:**
```
Market: "Will OpenAI raise >$1B?" at 0.65

Evidence 1: News "Microsoft in talks with OpenAI for additional investment"
  → LR = 2.0 (this headline is 2x more likely in a world where they DO raise)
  → Posterior = 0.65 × 2.0 / (0.65 × 2.0 + 0.35) = 0.788

Evidence 2: Whale wallet (68% win rate) bought YES
  → LR = 1.5
  → Posterior = 0.788 × 1.5 / (0.788 × 1.5 + 0.212) = 0.848

Evidence 3: Order flow is 60% YES-buying
  → LR = 1.2
  → Posterior = 0.848 × 1.2 / (0.848 × 1.2 + 0.152) = 0.870

Edge = 0.870 - 0.65 = 0.22 (22% edge) → STRONG BUY YES
```

This is more principled than weighted averaging because it correctly handles the compounding of evidence.

> **Difficulty:** Medium. Math is simple but calibrating likelihood ratios is the hard part.  
> **Expected accuracy improvement:** 5-10% over weighted average (in theory, more as calibration data grows)

---

## Upgrade 9: Correlation Guard ⭐⭐

**Impact: LOW-MEDIUM — prevents portfolio concentration risk**

### Problem
The bot might bet on 5 markets that are all correlated. Example: "Will Fed cut rates?", "Will mortgage rates drop?", "Will housing market recover?" — these all move together. If one loses, they probably all lose.

### Solution: `MarketCorrelation` check in RiskGate

**Simple approach (keyword overlap):**
```
For each new signal, check existing open trades:
  similarity = jaccard(signal.keywords, openTrade.keywords)
  If any openTrade has similarity > 0.40:
    → Reduce position size by 50%
    → If 3+ correlated open trades: BLOCK
```

**Better approach (category + thematic clustering):**
Group markets by theme: "Fed policy", "Crypto regulation", "Election", "AI industry". Max 3 open positions per theme cluster.

> **Difficulty:** Low.  
> **Expected accuracy improvement:** 5% on drawdown reduction (not accuracy per se, but risk-adjusted returns)

---

## Upgrade 10: Dynamic Confidence Decay ⭐⭐

**Impact: LOW-MEDIUM — prevents stale positions**

### Problem
A trade opened with 0.85 confidence shouldn't still be treated as 0.85 confidence 3 weeks later. The original signal may have fully priced in by now.

### Solution:

```
effectiveConfidence = originalConfidence × decayFactor

decayFactor = max(0.50, 1 - (daysSinceEntry / halfLifeDays))
halfLifeDays = 14 (configurable)

Day 0:  1.00 × 0.85 = 0.85
Day 7:  0.50 × 0.85 = 0.425 → if below threshold, consider exiting
Day 14: 0.00 × 0.85 = 0.00  → auto-exit stale positions
```

**Integration:** PositionMonitor checks effective confidence on each poll. If it drops below 0.40, exit at market price (reason: `STALE_SIGNAL`).

> **Difficulty:** Low.  
> **Expected accuracy improvement:** 5-10% on capital efficiency (frees up capital from dead positions)

---

## Priority Ranking: What to Build First

```
TIER 1 — Foundation (build these first, everything else depends on them)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  #2  Price History Tracker         [LOW difficulty]    [enables everything]
  #4  Smart Exit Strategy           [LOW-MED difficulty][immediate PnL impact]

TIER 2 — Core Intelligence (the actual accuracy improvement)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  #1  Edge Detection Engine         [MED-HIGH difficulty][30-50% accuracy boost]
  #5  Real LLM Integration          [LOW difficulty]    [15-30% accuracy boost]
  #3  Calibration Feedback Loop     [MED difficulty]    [compounds over time]

TIER 3 — Advanced Signals (nice-to-have, add after Tier 2 is proven)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  #6  Order Flow Imbalance          [MED difficulty]    [10-15% accuracy boost]
  #7  Market Regime Detection       [MED difficulty]    [avoids bad trades]
  #8  Bayesian Probability Model    [MED difficulty]    [mathematically rigorous]

TIER 4 — Polish (diminishing returns but still valuable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  #9  Correlation Guard             [LOW difficulty]    [risk reduction]
  #10 Dynamic Confidence Decay      [LOW difficulty]    [capital efficiency]
```

> [!TIP]
> **My strongest recommendation:** Start with **Price History Tracker + Smart Exit + Edge Detection**. These three together would transform the bot from "randomly betting on liquid markets" to "calculating if markets are mispriced and exiting at optimal times." That's the difference between a toy and a real system.
