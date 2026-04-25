# Polybot MVP — Prioritized Improvement Roadmap

> [!IMPORTANT]
> This roadmap is ordered by **risk to capital** and **impact on paper-trading validity**.
> Items in Tier 1 affect data quality — fix them before drawing conclusions from paper results.

---

## Tier 1: Critical — Fix Before Trusting Paper Results

These issues directly affect the validity of your paper-trading data.

### 1.1 Adopt `apiRetry` Across All Services
**Impact:** 🔴 High — A single 429/503 error silently drops an entire poll cycle (whale data, market scan, resolution check)
**Effort:** Low (2-3 hours)
**Files to change:**
- `WhaleMonitor.ts` — Replace raw `axios.get()` with `apiCallWithRetry()`
- `MarketScanner.ts` — Replace raw `axios.get()` with `apiCallWithRetry()`
- `MarketResolutionMonitor.ts` — Replace raw `axios.get()` with `apiCallWithRetry()`
- `OrderbookAnalyzer.ts` — Replace CLOB client calls with retry wrapper
- `AISignalEngine.ts` — Replace news API calls with retry wrapper
- `LLMSignalProvider.ts` — Replace Gemini API call with retry wrapper

**Implementation:** The `apiRetry.ts` utility already exists with proper exponential backoff. Just swap `axios(config)` → `apiCallWithRetry(config, { label: 'ServiceName' })`.

---

### 1.2 Disable Mock Whale Trades
**Impact:** 🔴 High — Random noise injected into paper results at 20% probability per whale per cycle
**Effort:** Minimal (10 minutes)
**File:** `WhaleMonitor.ts`
**Change:** Comment out or gate `emitMockTrade()` behind an env flag:
```typescript
if (process.env.ENABLE_MOCK_WHALES === 'true') {
    this.emitMockTrade(walletAddress);
}
```

---

### 1.3 Fix PriceHistoryStore I/O Bottleneck
**Impact:** 🔴 High — Writing 50MB+ synchronously blocks the event loop for seconds every 15 minutes
**Effort:** Medium (3-4 hours)
**File:** `PriceHistoryStore.ts`
**Options (pick one):**
1. **Quick fix:** Replace `fs.writeFileSync()` with `fs.promises.writeFile()` — makes it async but still writes full file
2. **Better:** Implement incremental writes — only append new snapshots, not rewrite entire file
3. **Best:** Switch to SQLite via `better-sqlite3` — proper database for time-series data

**Also apply to:** `VirtualWallet.ts`, `CalibrationTracker.ts`, `DashboardReporter.ts` — all use `writeFileSync`

---

### 1.4 Make RiskGate Constants Configurable
**Impact:** 🟡 Medium — Can't tune risk parameters without code changes
**Effort:** Low (1-2 hours)
**File:** `RiskGate.ts`
**Change:** Move hardcoded constants to `.env` or a `config.json`:
```
RISK_MAX_DRAWDOWN=0.25
RISK_MAX_POSITIONS=15
RISK_MAX_SINGLE_MARKET=0.05
RISK_MAX_CATEGORY=0.25
RISK_MIN_VOLUME=50000
RISK_EDGE_THRESHOLD=0.03
```

**Also apply to:** `ExitStrategy.ts` (trailing stop thresholds), `EdgeEstimator.ts` (signal weights, min edge)

---

### 1.5 Add Signal Source De-Duplication
**Impact:** 🟡 Medium — If Whale + AI + Research all fire for the same market, 3 positions open (RiskGate's per-market cap provides partial protection)
**Effort:** Low (1 hour)
**File:** `SignalAggregator.ts`
**Change:** The 60-minute dedup already exists but doesn't distinguish sources. Either:
1. Accept current behavior (first signal wins) and document it
2. Add source priority: Research > AI > Whale

---

### 1.6 Replace Placeholder Whale Wallets
**Impact:** 🔴 High — `.env` has `0x1234...` placeholder addresses. WhaleMonitor is fetching data for nonexistent wallets.
**Effort:** Minimal (research time to find real profitable wallets)
**File:** `.env`
**Action:** Research Polymarket leaderboard or on-chain analytics to identify 5-10 consistently profitable wallets.

---

## Tier 2: High Priority — Production Hardening

These items should be addressed before transitioning from paper to real trading.

### 2.1 Add Unit Tests for Critical Paths ✅ DONE (Phase B)
**Impact:** 🟡 High — Money-controlling code has zero tests
**Effort:** Medium (1-2 days)
**Status:** ✅ **73 tests across 4 suites** — FeeSimulator (12), VirtualWallet (24), ExitStrategy (22), RiskGate (15)
**Priority test targets:**

| Component | What to Test | Why |
|---|---|---|
| `RiskGate` | Drawdown halt, position sizing, exposure caps | Controls trade sizing |
| `VirtualWallet` | Balance deduction, PnL calculation, ledger integrity | Controls the money |
| `ExitStrategy` | Stop loss triggers, trailing stop math, stale decay | Controls exits |
| `EdgeEstimator` | Signal combination, edge threshold, weight math | Controls entry decisions |
| `FeeSimulator` | All category rates, maker vs taker | Controls cost modeling |

**Setup:** Install `vitest` and create `__tests__/` directory:
```bash
npm install -D vitest
```

---

### 2.2 Implement LLM Response Caching ✅ DONE (Phase B)
**Impact:** 🟡 Medium — Identical markets trigger duplicate Gemini API calls across consecutive cycles
**Effort:** Low (2 hours)
**File:** `LLMSignalProvider.ts`
**Status:** ✅ Map cache with 1-hour TTL, cache key = `question|price|category`, auto-eviction of stale entries.
**Change:** Add a `Map<string, { result, timestamp }>` cache with 1-hour TTL:
```typescript
private cache = new Map<string, { result: any, cachedAt: number }>();
private CACHE_TTL = 60 * 60 * 1000; // 1 hour
```

---

### 2.3 Add Graceful Shutdown ✅ DONE (Phase A)
**Impact:** 🟡 Medium — Process kill leaves no cleanup, potential data corruption
**Effort:** Low (30 minutes)
**File:** `index.ts`
**Status:** ✅ Implemented with SIGINT + SIGTERM handlers. Flushes wallet, priceHistory, calibration synchronously. Phase B added LLM session stats logging on shutdown.

---

### 2.4 Add Orderbook Depth Analysis
**Impact:** 🟡 Medium — A $0.01 spread with $50 of liquidity is treated as "liquid"
**Effort:** Medium (3-4 hours)
**File:** `OrderbookAnalyzer.ts`
**Change:** Extend to fetch and analyze top 5-10 levels of depth, compute total liquidity within X% of midpoint.

---

### 2.5 Fix AISignalEngine Keyword Matching
**Impact:** 🟡 Medium — Conflicting keywords produce random signals
**Effort:** Medium (4-6 hours)
**File:** `AISignalEngine.ts`
**Options:**
1. **Quick fix:** Use the LLM (Gemini) to evaluate headline relevance instead of keyword matching
2. **Better:** Implement bigram/trigram matching to capture context ("denies launch" vs just "denies")
3. **Best:** Use a lightweight sentiment classifier (e.g., VADER-like scoring)

---

### 2.6 Add API Cost Tracking ✅ DONE (Phase B)
**Impact:** 🟢 Low — No monitoring of Gemini API spend
**Effort:** Low (1 hour)
**File:** `LLMSignalProvider.ts`
**Status:** ✅ Tracks per-session: total calls, cache hits, est. input/output tokens, est. USD cost. `getSessionStats()` + `logSessionStats()` methods. Stats logged on shutdown.

---

### 2.7 Remove Unused `node-cron` Dependency ✅ DONE (Phase A)
**Impact:** 🟢 Low — Dead dependency, minor attack surface
**Effort:** Minimal
**Status:** ✅ Removed via `npm uninstall node-cron @types/node-cron`

---

## Tier 3: Strategic — New Capabilities

### 3.1 Port Dip Arbitrage Strategy
**Impact:** 🔴 Major — The plan's highest-ROI strategy (86% proven) is completely absent
**Effort:** High (1-2 weeks)
**Requirements:**
1. Install WebSocket client: `@polymarket/real-time-data-client`
2. Implement `DipDetector` — 10-second sliding window for 30% price drops
3. Implement `DipArbStrategy` — two-leg execution (buy dip → hedge when opposite drops)
4. Add 15-minute crypto market selection (BTC, ETH, SOL, XRP)
5. Implement auto-merge simulation (CTF → USDC)

**Key Parameters from Plan:**
```
shares: 25, sumTarget: 0.95, dipThreshold: 0.30
slidingWindowMs: 10000, windowMinutes: 14
leg2TimeoutSeconds: 60, maxSlippage: 0.02
```

---

### 3.2 Implement Security Layer
**Impact:** 🔴 Critical for real trading
**Effort:** Medium-High (1 week)
**Changes:**

| Component | Plan Reference | Implementation |
|---|---|---|
| Encrypted `.env` | §8 AES-GCM section | Use `dotenv-vault` or custom AES encryption |
| API key rotation | §8 session tokens | Implement key refresh mechanism |
| Ledger integrity | §8 audit logging | Add SHA-256 hashing to ledger entries |
| Input validation | §8 XSS prevention | Sanitize all API response data before processing |

---

### 3.3 Add Historical Backtesting
**Impact:** 🟡 High — Currently no way to validate strategies against historical data
**Effort:** High (1-2 weeks)
**New files:**
- `src/backtesting/BacktestEngine.ts`
- `src/backtesting/HistoricalDataLoader.ts`
- `src/backtesting/BacktestReport.ts`

---

### 3.4 Implement Multi-Model LLM Fallback
**Impact:** 🟡 Medium — Single Gemini model dependency
**Effort:** Medium (3-4 hours)
**File:** `LLMSignalProvider.ts`
**Change:** Add fallback chain: Gemini Flash → Gemini Pro → Claude (via OpenRouter) → disable LLM

---

### 3.5 Add Alert System
**Impact:** 🟡 Medium — No notifications for critical events
**Effort:** Medium (4-6 hours)
**Options:**
- Discord webhook notifications
- Telegram bot alerts
- Email via SendGrid

**Alert triggers:**
- Drawdown exceeds 15%
- Trade executed (with details)
- API failure (after retries exhausted)
- Daily P&L summary

---

## Tier 4: Future — Browser Frontend Phase

### 4.1 Build React Frontend with Matrix Theme
**Impact:** 🔴 Major — Core user-facing feature
**Effort:** High (3-4 weeks)
**Plan reference:** §7 (650 lines of CSS + React components)
**Approach:**
1. Initialize Vite + React + TypeScript project
2. Port Matrix theme CSS (plan lines 3603-3905)
3. Build component library: MatrixCard, MatrixButton, MatrixInput
4. Create dashboard with real-time data from the backend API
5. Implement WebSocket streaming for live updates

---

### 4.2 Implement Zustand State Management
**Impact:** 🟡 Medium — Required for React SPA
**Effort:** Medium (1 week)
**Plan reference:** §6 (460 lines of interfaces)
**Action:** Port the plan's `AppState` interface and create Zustand stores for each domain.

---

### 4.3 Deploy to Netlify with CI/CD
**Impact:** 🟡 Medium — Required for multi-device access
**Effort:** Low (2-3 hours)
**Plan reference:** §9
**Action:** Configure `netlify.toml`, set up GitHub Actions, implement staging/production environments.

---

### 4.4 Add E2E Testing with Cypress
**Impact:** 🟡 Medium — Required for frontend reliability
**Effort:** Medium (1 week)
**Action:** Test full trading flow in browser, market scanning, position management.

---

## Implementation Priority Matrix

```
                    HIGH IMPACT
                        │
    ┌───────────────────┼───────────────────┐
    │   1.1 API Retry   │  3.1 Dip Arb     │
    │   1.2 Mock Whales │  3.2 Security    │
    │   1.3 I/O Fix     │  4.1 React UI    │
    │   1.6 Real Whales │                   │
    │                   │                   │
LOW ├───────────────────┼───────────────────┤ HIGH
EFFORT│  1.4 Config      │  2.1 Unit Tests  │ EFFORT
    │  1.5 Dedup Docs  │  2.5 AI Fix      │
    │  2.2 LLM Cache   │  3.3 Backtesting │
    │  2.3 Shutdown     │  3.5 Alerts      │
    │  2.7 Remove cron  │  4.2 Zustand     │
    │                   │                   │
    └───────────────────┼───────────────────┘
                        │
                    LOW IMPACT
```

---

## Recommended Execution Order

> [!TIP]
> Phase A gets you **clean data**. Phase B gets you **confidence**. Phase C gets you **capabilities**.

### Phase A: Data Quality (Days 1-3) ✅ COMPLETE
1. ✅ 1.2 Disable mock whale trades
2. ✅ 1.6 Replace placeholder whale wallets
3. ✅ 1.1 Adopt `apiRetry` in all services
4. ✅ 1.3 Fix PriceHistoryStore I/O (async write)
5. ✅ 2.7 Remove unused `node-cron`

### Phase B: Validation (Days 4-7) ✅ COMPLETE
6. ✅ 1.4 Make RiskGate/ExitStrategy configurable
7. ✅ 2.1 Add unit tests for RiskGate + VirtualWallet + ExitStrategy + FeeSimulator (73 tests)
8. ✅ 2.2 Implement LLM response caching (1h TTL Map cache)
9. ✅ 2.3 Add graceful shutdown handler (+ LLM cost stats on exit)
10. ✅ 2.6 Add API cost tracking (calls, tokens, estimated USD)

### Phase C: Capabilities (Weeks 2-4)
11. ✅ 2.5 Fix AISignalEngine (use LLM for headline evaluation)
12. ✅ 2.4 Add orderbook depth analysis
13. ✅ 3.1 Port Dip Arb strategy (with WebSocket)
14. ✅ 3.5 Add Discord/Telegram alert system

### Phase D: Production (Weeks 5-8)
15. ✅ 3.2 Implement security layer
16. ✅ 3.3 Historical backtesting
17. ✅ 4.1 React frontend with Matrix theme
18. ✅ 4.3 Netlify deployment

---

## Key Metrics to Track

After implementing Phase A, run paper trading for **7-14 days** and measure:

| Metric | Target | Why |
|---|---|---|
| Win Rate | > 55% | Validates edge detection |
| Brier Score | < 0.20 | Validates calibration accuracy |
| Max Drawdown | < 15% | Validates risk management |
| ROI (annualized) | > 20% | Validates strategy viability |
| API Error Rate | < 1% | Validates retry adoption |
| Signal-to-Trade Ratio | > 10% (of signals become trades) | Validates filtering quality |
