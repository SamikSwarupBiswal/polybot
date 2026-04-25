# Plan vs MVP — Comprehensive Comparison

> [!IMPORTANT]
> The `plan.md` is a **5,560-line** design document for a **browser-based React/Vite SPA** deployed to Netlify.
> The MVP is a **Node.js CLI paper-trading engine** with zero frontend code.
> This document compares every section of the plan against the actual implementation.

---

## Executive Summary

| Dimension | Plan | MVP | Verdict |
|---|---|---|---|
| **Architecture** | Browser SPA (React + Vite + Tailwind) | Node.js CLI (TypeScript + ts-node) | ⚠️ Intentional Pivot |
| **Strategy Logic** | Simple: Scan → LLM → 5% bet → SL/TP | 6-signal edge model + calibration loop | ✅ **MVP Far Exceeds** |
| **Risk Management** | Fixed thresholds (5% size, 15% SL, 30% TP) | Adaptive bankroll sizing, trailing stops, decay | ✅ **MVP Far Exceeds** |
| **Data Pipeline** | Direct API → LLM → trade | 7-stage research pipeline with persistence | ✅ **MVP Far Exceeds** |
| **UI/UX** | Matrix theme, React component library | Terminal output + static HTML | ❌ **Unbuilt** |
| **Security** | AES-GCM, CSP headers, fraud detection | `.env` file, no encryption | ❌ **Unbuilt** |
| **Testing** | Vitest + Cypress E2E | Zero tests | ❌ **Unbuilt** |
| **Deployment** | Netlify with CI/CD | Local `npm run dev` | ❌ **Unbuilt** |
| **Dip Arbitrage** | "✅ COMPLETED" (86% ROI proven) | Not implemented | ❌ **Missing** |
| **Whale Copy** | Not in plan | Fully built | ✅ **Bonus Feature** |

---

## Section-by-Section Comparison

### §1. Architecture Overview (Plan Lines 477-723)

**Plan designed:** A 3-layer browser architecture:
```
Presentation (React) → Service Layer → External APIs + Local Storage
```

**MVP built:** A flat service architecture:
```
Polling Loops → Research Pipeline → Signal Aggregator → RiskGate → Virtual Wallet
```

| Principle | Plan | MVP | Match? |
|---|---|---|---|
| Decentralized execution | Client-side browser | Server-side Node.js | ❌ Different |
| AI-augmented decisions | Core (every trade uses LLM) | Optional enrichment | ✅ Better |
| Reactive real-time updates | WebSocket + sub-second UI | 15-min polling cycles | ❌ Slower |
| Service-oriented design | ✅ Clean separation | ✅ Clean separation | ✅ Match |
| Event-driven communication | ✅ Typed events | ✅ EventEmitter signals | ✅ Match |

**Verdict:** The architectural pivot from browser to CLI was the **correct strategic decision**. The plan's browser-first approach would have required building 1,000+ lines of React UI before validating any trading logic. The MVP proves the edge first.

---

### §2. Technology Stack (Plan Lines 727-1027)

| Planned Tech | Status in MVP | Replacement |
|---|---|---|
| React 18 | ❌ Not used | N/A (no UI) |
| Vite | ❌ Not used | `ts-node/esm` direct execution |
| TypeScript 5.2+ | ✅ Used | TypeScript 6.0 (newer!) |
| Tailwind CSS | ❌ Not used | N/A |
| Zustand | ❌ Not used | In-memory objects + JSON files |
| React Query | ❌ Not used | Direct API calls |
| Axios | ✅ Used | Same |
| Ethers.js | ✅ Installed | Used for CLOB client initialization only |
| `reconnecting-websocket` | ❌ Not installed | Polling instead |
| OpenRouter/Claude | ❌ Replaced | Google Gemini 2.0 Flash |
| Vitest/Cypress | ❌ Not installed | Zero tests |
| Netlify CLI | ❌ Not installed | Local only |
| ESLint/Prettier | ❌ Not configured | No linting |
| Winston | ✅ Used (unplanned) | Better than plan's `console.log` |

**Where MVP is Ahead:**
- TypeScript 6.0 (plan specified 5.2)
- Winston structured logging (plan had no logging strategy for backend)
- `@polymarket/clob-client-v2` for orderbook data (plan's CLOB usage was for order placement)

---

### §3. API Integration (Plan Lines 1031-1599)

| API | Plan Usage | MVP Usage | Match? |
|---|---|---|---|
| **Gamma API** | Market discovery, metadata | ✅ Same — scanning + resolution monitoring | ✅ |
| **CLOB API** | Order placement + orderbook | Orderbook reads only (no trading) | ⚠️ Partial |
| **Data API** | Position tracking, P&L | Whale activity monitoring | ⚠️ Different use |
| **WebSocket** | Real-time streaming | ❌ Not used | ❌ Missing |
| **OpenRouter** | LLM analysis | ❌ Replaced with Gemini | ❓ Swapped |

**Plan's API Resilience Patterns:**
- Circuit breaker pattern → ❌ None in MVP
- Token bucket rate limiting → ❌ None in MVP
- Optimistic updates → N/A (no UI)
- Parallel data fetching → ✅ `Promise.allSettled` not used, but sequential is fine for CLI

**Key Difference:** Plan designed elaborate `ApiOrchestrator` and `ApiResilienceManager` classes (100+ lines of code). MVP's `apiRetry.ts` (56 lines) is simpler but functionally equivalent for the retry portion. Circuit breaker is missing.

---

### §4. Core Components (Plan Lines 112-119)

| Planned Component | MVP Equivalent | Comparison |
|---|---|---|
| Market Scanner Service | `MarketScanner.ts` | ✅ Match — MVP adds caching |
| LLM Prediction Service | `LLMSignalProvider.ts` | ✅ Match — different model, same concept |
| Trading Service | `PaperTradeExecutor.ts` | ⚠️ Paper-only vs real orders |
| Position Manager | `VirtualWallet.ts` | ⚠️ Simplified for paper trading |
| Wallet Service | Not needed | N/A (no real wallet) |
| Activity Logger | `logger.ts` (Winston) | ✅ Better than plan's `ActivityLogger` |

**Components MVP Has That Plan Doesn't:**

| Component | Lines | Why It Matters |
|---|---|---|
| `EdgeEstimator` | 340 | 6-signal quantitative model — plan had nothing like this |
| `PriceHistoryStore` | 223 | Persistent price data with momentum/volatility/trend derivation |
| `OpportunityScorer` | 172 | Multi-factor market ranking system |
| `MarketRegimeDetector` | 199 | Regime classification (trending, chaotic, etc.) |
| `CalibrationTracker` | 357 | Brier score accuracy tracking + feedback loop |
| `MarketResolutionMonitor` | 135 | Real-world outcome tracking for paper trades |
| `WhaleMonitor` | 236 | Copy-trade system with qualification scoring |
| `ExitStrategy` | 175 | 5-priority exit engine (vs plan's 2-3 conditions) |
| `FeeSimulator` | 50 | Category-specific fee modeling |
| `SignalAggregator` | 103 | Unified signal routing with deduplication |

> [!TIP]
> The MVP built **10 components not in the plan**, totaling ~1,990 lines of quantitative logic. This represents the core intellectual property of the system.

---

### §5. Data Flow (Plan Lines 121-128, 2800-3201)

**Plan's flow:**
```
Market Scan → LLM Analysis → Trading Decision → Order Placement → Position Monitoring
```

**MVP's flow (7 stages):**
```
Market Scan → CLOB Pricing → Price History Recording → Opportunity Scoring →
Edge Detection → (LLM Enrichment) → Signal Aggregation → Risk Gate → Paper Execution
```

**Verdict:** MVP's pipeline is **3× more sophisticated** than the plan's. The addition of opportunity scoring, edge detection, and regime analysis creates a proper quantitative research engine, not just an LLM wrapper.

---

### §6. State Management (Plan Lines 3205-3591)

**Plan designed:** An 8-domain Zustand store with 460+ lines of TypeScript interfaces covering wallet, markets, positions, trading, LLM, settings, and UI state.

**MVP implements:** 4 persistence mechanisms:
1. `ledger.json` — Trade history + balance
2. `price_history.json` — Market price snapshots
3. `calibration.json` — Prediction accuracy data
4. In-memory objects — Runtime state (no persistence)

| Plan's State Domain | MVP Equivalent | Coverage |
|---|---|---|
| `wallet` (7 fields) | `VirtualWallet` class | ⚠️ Simplified (no chain, no approvals) |
| `markets` (6 fields) | `cachedMarkets[]` in MarketScanner | ⚠️ Simplified (no Maps) |
| `positions` (15 fields) | `ledger.json` entries | ⚠️ Missing: Sharpe ratio, correlation matrix |
| `trading` (8 fields) | Direct signal→execute flow | ❌ No order queuing/rate tracking |
| `llm` (7 fields) | Single `LLMSignalProvider` | ❌ No cache, no history, no metrics |
| `settings` (50+ fields) | `.env` (10 variables) | ❌ Massive gap |
| `ui` (20 fields) | N/A (no UI) | N/A |

**Verdict:** The plan's state design is appropriate for a production SPA. The MVP's approach is appropriate for a CLI validation tool. The gap is expected and will need to be bridged when building the frontend.

---

### §7. UI/UX Design System (Plan Lines 3595-4247)

**Plan designed:** 650+ lines of CSS custom properties, animations, and React components:
- 100+ CSS variables (colors, spacing, typography, z-index, animations)
- Matrix rain animation, neon glow pulse, data stream effects
- 6 React components (Container, Card, Button, PositionTable, ActivityFeed, MarketScanner)
- Accessibility: `prefers-reduced-motion`, `prefers-contrast: high`
- JetBrains Mono / Fira Code monospace typography

**MVP has:**
- `console.table()` terminal output
- Static HTML report with dark blue theme (not Matrix green)
- No React, no CSS system, no components

**Verdict:** ❌ **100% gap.** The entire visual identity described in the plan is unbuilt. The HTML report uses a clean blue-gradient aesthetic that's functional but doesn't match the Matrix cyberpunk theme.

---

### §8. Security (Plan Lines 4250-4564)

| Security Layer | Plan (300+ lines) | MVP | Gap |
|---|---|---|---|
| **Wallet Security** | Session timeout, seed validation, activity monitoring | `.env` file | 🔴 Critical |
| **Data Encryption** | AES-256-GCM via Web Crypto, PBKDF2 100k iterations | None — plaintext JSON | 🔴 Critical |
| **API Auth** | Multi-layer: wallet signatures, session tokens | Basic API key in env | 🔴 Critical |
| **Rate Limiting** | Token bucket implementation | None | 🟡 High |
| **CORS/CSP** | Strict headers, HSTS | N/A (no web server) | N/A |
| **Audit Logging** | Immutable append-only with crypto hashing | Winston file logs | 🟡 High |
| **Fraud Detection** | IP monitoring, device fingerprinting, ML anomalies | None | 🟢 Future |
| **Security Testing** | SonarQube, dependency scanning, penetration testing | None | 🟡 High |

**Verdict:** ❌ **Zero security hardening.** This is acceptable for paper trading but **must be addressed before any real capital deployment.** The plan's AES-GCM implementation code is ready to port.

---

### §9. Deployment (Plan Lines 4568-4627)

| Feature | Plan | MVP |
|---|---|---|
| Platform | Netlify with CDN | Local `npm run dev` |
| CI/CD | GitHub integration + branch protection | None |
| API Proxy | Netlify `[[redirects]]` for CORS bypass | Direct API calls |
| Performance | Code splitting, lazy loading | N/A |

**Verdict:** ❌ Not started. Expected — deployment only matters after the frontend exists.

---

### §10. Testing (Plan Lines 4629-4661)

| Layer | Plan | MVP |
|---|---|---|
| Unit Tests | Vitest — services, mocks, error scenarios | ❌ Zero tests |
| Integration | API, WebSocket, wallet connection | ❌ None |
| E2E | Cypress — full trading workflows | ❌ None |
| Coverage | "Good coverage" | 0% |

**Verdict:** ❌ **Most critical gap for production readiness.** At minimum, `RiskGate` and `VirtualWallet` need unit tests — they control money.

---

### §11-12. Monitoring & Performance (Plan Lines 4663-4725)

| Feature | Plan | MVP |
|---|---|---|
| Logging | Structured `LogEntry` with categories | ✅ Winston with levels + file rotation |
| Metrics | Trade success, LLM accuracy, response times | ✅ `PerformanceTracker` (ROI, win rate, drawdown) |
| Alerts | Low balance, high loss, API failure | ❌ None |
| External monitoring | Sentry/LogRocket mentioned | ❌ None |

**Verdict:** ⚠️ Partial. Winston logging actually exceeds the plan's `console.log`-based approach. Performance tracking is solid. Missing alerts and external monitoring.

---

### §13. Risk Management (Plan Lines 4727-4771)

This is where the MVP **dramatically exceeds** the plan.

| Feature | Plan | MVP |
|---|---|---|
| Position Sizing | 5% fixed, confidence-scaled to 10% max | ✅ Kelly-style adaptive: 0.5%-3% by conviction tier |
| Stop Loss | 15% fixed | ✅ Adaptive: 25%/30%/50% by conviction |
| Take Profit | 30% fixed | ✅ Adaptive: 30%/40%/60% by conviction |
| Max Drawdown | 20% emergency stop | ✅ 25% circuit breaker |
| Daily Loss Limit | Not specified | ✅ 10% of initial deposit |
| Max Positions | 3 | ✅ 15 |
| Per-Market Cap | Not specified | ✅ 5% of equity |
| Per-Category Cap | Not specified | ✅ 25% of equity |
| Trailing Stop | Flag only (`trailingStopEnabled`) | ✅ Full implementation: 15% activation, 10-15% trail |
| Stale Decay | Not in plan | ✅ Half-life 21 days → exit at 40% |
| Edge Threshold | Not in plan | ✅ 3% net minimum after costs |

**Verdict:** ✅ **MVP's RiskGate is genuinely production-grade and far exceeds the plan.** The plan described a simple threshold system; the MVP built adaptive bankroll management.

---

### §14. Development Phases (Plan Lines 4774-4799+)

| Phase | Plan | MVP Status |
|---|---|---|
| **Phase 1** (Weeks 1-2): Foundation | Vite + React + Tailwind + Ethers + API clients | ⚠️ API clients done, no React/UI |
| **Phase 2** (Weeks 3-4): Trading Logic | Scanner + LLM + sizing + execution | ✅ Done differently (Node.js, more sophisticated) |
| **Phase 3** (Weeks 5-6): Multi-Strategy + Dip Arb | WebSocket + Dip Arb (86% ROI) | ❌ Dip Arb missing, Whale Copy built instead |
| **Phase 4** (Weeks 7-8): UI/UX Polish | Matrix theme, responsive, accessibility | ❌ Not started |
| **Phase 5** (Weeks 9-10): Testing + Deploy | Vitest + Cypress + Netlify | ❌ Not started |

> [!IMPORTANT]
> Phase 3 is marked "✅ COMPLETED" in the plan, but that refers to the **original Python production bot**, not the TypeScript MVP. The MVP is a ground-up rewrite that hasn't ported the Dip Arb strategy.

---

### §16. Configuration (Plan Lines 232-255)

| Config Area | Plan | MVP |
|---|---|---|
| API Endpoints | Centralized config object | Hardcoded in each service + env overrides |
| Risk Config | `UserSettings` interface, `SettingsManager` class | Hardcoded constants in `RiskGate` |
| Chain Config | `chainId: 137`, contract addresses | Only `CLOB_API_URL` in env |
| User Settings | 50+ configurable fields | ~10 env variables |

**Verdict:** ⚠️ MVP's configuration is the minimum viable for development. The plan's `SettingsManager` with localStorage persistence is needed for user-facing mode.

---

### §17. Error Handling (Plan Lines 257-264)

| Feature | Plan | MVP |
|---|---|---|
| Error Classification | 6-variant enum (network, api, wallet, trading, llm, validation) | Ad-hoc try/catch |
| Retry Logic | `apiCallWithRetry()` with exponential backoff | ✅ `apiRetry.ts` exists but **rarely used** |
| Error Boundary | React `ErrorBoundary` component | N/A |
| Recovery Strategies | Per-type (reconnect, queue, fallback) | Catch → log → continue |

**Verdict:** ⚠️ The retry utility is built but not universally adopted. This is a quick win — replacing raw `axios.get()` calls with `apiCallWithRetry()` across all services.

---

## Where MVP Excels vs Plan

| Feature | Impact | Why It's Better |
|---|---|---|
| **EdgeEstimator** (6-signal model) | 🔴 Critical | Plan had "LLM says buy" → The MVP has mathematical edge detection |
| **CalibrationTracker** (Brier scores) | 🔴 Critical | Plan had no accuracy feedback. MVP self-corrects. |
| **PriceHistoryStore** (persistent) | 🔴 Critical | Plan assumed real-time WebSocket. MVP builds historical context. |
| **MarketRegimeDetector** | 🟡 High | Adapts strategy to market conditions — plan had fixed approach |
| **ExitStrategy** (5-layer) | 🔴 Critical | Plan: SL + TP. MVP: SL + TP + Trailing + Time + Decay |
| **RiskGate** (adaptive sizing) | 🔴 Critical | Plan: 5% fixed. MVP: Kelly-style per-conviction tier |
| **WhaleMonitor** (copy-trade) | 🟡 High | Entirely absent from plan — new strategy mode |
| **FeeSimulator** | 🟡 High | Plan ignored paper trading costs. MVP models them. |
| **Signal deduplication** | 🟡 High | Prevents position spam — plan had no signal management |
| **LLM-optional design** | 🔴 Critical | System works without LLM. Plan required it for every trade. |

---

## Where Plan Exceeds MVP

| Feature | Plan Section | Priority | Effort |
|---|---|---|---|
| **Browser UI** | §7 (650 lines CSS + React) | 🔴 Major | High (2-3 weeks) |
| **Matrix Theme** | §7 (100+ CSS variables) | 🟡 Medium | Medium |
| **Dip Arbitrage** | §3, §13, Appendix A | 🔴 Major | High (requires WebSocket) |
| **WebSocket Streaming** | §5 | 🔴 Major | Medium |
| **Security Layer** | §8 (300 lines) | 🔴 Critical for production | Medium |
| **Testing Suite** | §10 | 🟡 High | Medium |
| **CI/CD Pipeline** | §9 | 🟡 Medium | Low |
| **Error Recovery** | §17 | 🟡 High | Low (adopt `apiRetry`) |
| **LLM Caching** | §6 `CachedAnalysis` | 🟡 Medium | Low |
| **State Management** | §6 (Zustand, 460 lines) | Future | High |
| **Order Execution** | §5 (FOK/FAK/GTC/GTD) | Future | High (real money) |
| **Cost Tracking** | §6 `performanceMetrics` | 🟢 Low | Low |
| **Notifications** | §6 `notifications` | 🟢 Low | Medium |

---

## Bottom Line

The MVP **took the backend-first approach** and leapfrogged the plan's strategy and risk design. The plan described a `scan → LLM → 5% bet → 15% SL / 30% TP` loop. The MVP built a quantitative research engine with multi-signal edge detection, adaptive bankroll sizing, trailing stops, signal decay, and real market resolution tracking.

**What's done is better than what was planned. What's missing is the presentation layer, the Dip Arb strategy, and production hardening.**
