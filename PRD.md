
PRODUCT REQUIREMENTS DOCUMENT

Polymarket Autonomous Trading Bot
Paper Trading MVP

Version: 1.0	Date: Apr 2026	Status: DRAFT	Author: Research

1. Executive Summary

This document defines the requirements, strategy selection rationale, and MVP architecture for an autonomous Polymarket trading bot. The system combines two complementary trading modes — Intelligent Copy Trading and AI-Powered Custom Strategy — tested first through a paper trading (virtual wallet) simulation before any real capital is deployed.

The research conducted for this PRD spans academic papers (including the peer-reviewed August 2025 IMDEA paper on Polymarket arbitrage), on-chain data analysis, and live bot performance records from Q3 2025 to Q1 2026. Strategy models have been ranked purely on accuracy, buildability within an MVP timeframe, and fee-adjusted profitability.

KEY INSIGHT	Only 7.6% of Polymarket wallets are consistently profitable. The profitable minority share one trait: they operate systematically with defined rules, not emotion. This bot is engineered to be part of that 7.6%.

2. Problem Statement & Opportunity

2.1 The Market Reality
Polymarket has evolved from a niche crypto experiment into a $3+ billion monthly volume trading ecosystem. As of April 2026, the platform is no longer a casual betting environment — it is a high-frequency, algorithm-dominated arena where:

•	14 of the top 20 most profitable wallets are automated bots
•	AI agents now represent over 30% of all wallet activity
•	The average arbitrage opportunity window has collapsed from 12.3 seconds (2024) to 2.7 seconds (Q1 2026)
•	Human traders achieve only 7–13% consistent profitability vs. 37%+ for AI agents

2.2 The Opportunity
Despite the competitive landscape, significant, repeatable opportunities still exist for well-designed bots — specifically in strategies that do NOT require sub-millisecond latency. The bot targets three defensible edges:

•	Maker liquidity provision (0% fees + rebates) as the structural cost advantage
•	AI-driven news signal detection, which operates on minutes-to-hours timescales — not milliseconds
•	Intelligent whale wallet analysis, filtering for skill vs. luck using multi-metric scoring

3. Goals & Success Metrics

3.1 MVP Goals (Paper Trading Phase)
1.	Validate strategy accuracy without risking real capital
2.	Identify which markets, whale wallets, and signal types yield the highest win rates
3.	Tune risk parameters (position sizing, stop-loss thresholds, max exposure per market)
4.	Generate a 30-day performance report to decide whether to go live

3.2 Success Criteria for Advancing to Live Trading
Metric	Minimum Threshold	Target
Paper Win Rate (overall)	>= 55%	>= 63%
Copy Trading Win Rate	>= 58%	>= 68%
AI Strategy Win Rate	>= 52%	>= 60%
Simulated ROI (30 days)	>= 8%	>= 20%
Max Drawdown (paper)	<= 25%	<= 15%
Trade Volume (paper)	>= 100 trades	>= 200 trades
False Signal Rate (AI)	<= 40%	<= 25%

4. Strategy Research & Selection

The following strategy analysis is grounded in: (1) the August 2025 IMDEA Networks research paper "Unravelling the Probabilistic Forest" analyzing 86M+ Polymarket bets; (2) on-chain performance data from Q3 2025–Q1 2026; and (3) documented live bot results from the Polymarket community.

4.1 Strategy Comparison Matrix

Rank	Strategy	Win Rate	Complexity	Fee Impact	MVP?	Key Notes
#1	AI News Signal	60–68%	Medium	Maker = 0%	YES	Best accuracy-to-complexity ratio
#2	Smart Copy Trading	58–68%	Low-Med	Maker = 0%	YES	Our primary Mode 1
#3	Market Making	78–85%	Medium	Earns rebate	PARTIAL	Steady but slow compounding
#4	Combinatorial Arb	75–90%	High	Fee-sensitive	PARTIAL	$28.9M extracted (IMDEA paper)
#5	Latency Arbitrage	85–98%	Very High	Fee-sensitive	NO	Requires sub-100ms infra
#6	Simple Price Arb	40–55%	Low	High taker cost	NO	Window = 2.7s, saturated

WHY NOT LATENCY ARB?	The $313→$438,000 wallet used latency arbitrage on 15-min BTC markets. However, this requires dedicated Polygon RPC nodes and sub-100ms execution. The opportunity window is now 2.7 seconds average and 73% is captured by institutional bots. Building this for an MVP would cost months and fail to compete. We build what can actually win.

4.2 Selected Strategies for MVP

Mode 1: Intelligent Copy Trading (Whale Following)

Research basis: PolyTrack leaderboard analysis, AlphaScope order flow research, and Polymarket's own Alpha Tags system (green badges for wallets with >65% accuracy over 50+ trades).

Why it works: Informed whale wallets have genuine information edges — professional research, domain expertise, or industry connections. On-chain transparency means every trade is public. The challenge is separating skill from luck.

Whale Qualification Criteria (Multi-Factor Scoring)

Criterion	Minimum	Ideal	Weight
Total P&L	$50K+ profit	$200K+ profit	30%
Win Rate	>= 55% over 50+ trades	>= 65% over 100+ trades	35%
Market Consistency	Trades same 2-3 categories	Specialist in 1-2 categories	20%
Trade Recency	Active in last 30 days	Active in last 7 days	10%
Wallet Clustering	N/A	Single wallet (no split activity)	5%

CAUTION flags built into the bot:
•	Survivorship bias — only visible winners are on leaderboards; the bot must track win rate, not just P&L
•	Luck vs. skill — a single large correct bet inflates P&L; require 50+ trade sample minimum
•	Whale can be wrong — treat whale signals as one input, not gospel; cap exposure at 5% per copied trade

Copy execution logic:
•	Detection via WebSocket (real-time) + Data API polling every 30 seconds as fallback
•	Only copy BUY orders initially; skip SELL orders in paper phase (simpler resolution tracking)
•	Position size = min(whale_size_scaled * 0.1, 5% of virtual wallet balance)
•	Minimum liquidity check: market must have >$50K volume before copying

Mode 2: AI-Powered News Signal Strategy

Research basis: A March 2026 study showed Polymarket prices lag meaningful news events by 2–15 minutes. A 60-day test of 11 AI sentiment tools found that the best tools had 68–73% directional alignment with Polymarket probability movements within the same trading week. The Polystrat autonomous agent (built on Olas) achieved 59–64% win rates in technology markets using NLP-based signals.

How it works: The bot monitors news feeds, scores headlines for relevance to open Polymarket markets, estimates the probability impact, and places a limit order (maker — 0% fee) before the market reprices. The key edge is speed of information processing, not execution speed.

Signal Pipeline Architecture

Step	Component	Action	Output
1	News Ingestion	Poll RSS feeds + Gamma API every 60 seconds	Raw news items
2	Market Matching	LLM scores headline relevance to each open market (0-100)	Relevance score per market
3	Probability Delta	LLM estimates new fair probability given headline	Expected new price vs. current
4	Edge Calculation	Edge = |model_prob - market_price|; threshold > 8%	Trade signal (YES/NO/SKIP)
5	Risk Gate	Check position limits, market liquidity, daily loss cap	APPROVED / BLOCKED
6	Order Placement	Place limit order at model_prob price (maker = 0% fee)	Paper trade logged
7	Outcome Tracking	Track resolution; update model calibration	Win/loss record

Target market categories for AI strategy (ranked by signal clarity and fee profile):
•	Geopolitics — 0% taker fees, news-driven, medium-length resolution timelines
•	Politics — 1.0% taker fee (avoided via limit orders), high news density
•	Finance / Economics — 1.0–1.5% taker fee, data release-driven (CPI, Fed, NFP)
•	Technology — 1.0% taker fee, announcement-driven, good for AI/crypto news

5. Fee Strategy — The Critical Structural Advantage

As of March 30, 2026, Polymarket charges taker fees across most categories but has a crucial asymmetry: maker orders (limit orders) pay 0% and earn daily rebates. This fundamentally changes how the bot must operate.

Category	Taker Fee (peak)	Maker Fee	Maker Rebate	Bot Approach
Geopolitics / World Events	0% (free)	0%	None	Taker OK — no cost
Politics	1.00%	0%	25% share	Limit orders only
Finance / Economics	1.00–1.50%	0%	50% share	Limit orders only
Technology	1.00%	0%	25% share	Limit orders only
Sports	0.75%	0%	25% share	Limit orders only
Crypto (15-min)	1.80%	0%	20% share	AVOID as taker

MAKER RULE	Every order placed by the bot MUST be a limit order (GTC type) to qualify as a maker. This achieves 0% fee cost AND earns 20–50% rebate on filled volume. Orders must remain on the book for a minimum of 3.5 seconds of active time to qualify for liquidity rewards (as of March 17, 2026 rule change).

6. MVP System Architecture

The MVP is built in TypeScript using @polymarket/clob-client-v2 (the official, most recently updated SDK). It operates in paper trading mode only — no real wallet signing or on-chain transactions.

6.1 Component Overview

Layer	Component	Responsibility
Data Layer	MarketDataService	Polls Gamma API + CLOB API; maintains live order book snapshots
Data Layer	WebSocketClient	Real-time price + trade streaming (~100ms latency)
Data Layer	NewsIngestionService	Polls RSS feeds; extracts relevant headlines per market
Strategy Layer	WhaleMonitor	Tracks target wallets via Data API; scores and filters whale trades
Strategy Layer	AISignalEngine	LLM-powered news relevance scoring + probability delta calculation
Strategy Layer	SignalAggregator	Combines Mode 1 and Mode 2 signals; deduplicates overlaps
Execution Layer	RiskGate	Enforces position limits, daily loss caps, market liquidity minimums
Execution Layer	PaperTradeExecutor	Simulates order placement; records to virtual wallet ledger
Ledger Layer	VirtualWallet	JSON-based ledger; tracks balance, positions, PnL per trade
Analytics Layer	PerformanceTracker	Computes win rate, ROI, drawdown, mode comparison
Analytics Layer	DashboardReporter	Generates daily terminal report + weekly HTML summary

7. Risk Management Framework

This section defines hard rules the bot must enforce in both paper and (future) live trading modes. These are non-negotiable and cannot be overridden by strategy logic.

Rule	Paper Trading Limit	Rationale
Max single position	5% of virtual balance	Even 99%-probability markets can flip on black swans
Max exposure per market category	25% of virtual balance	Prevents category concentration risk
Daily loss cap	10% of virtual balance	Hard stop; bot pauses for 24 hours
Max concurrent open positions	15 positions	Prevents overexposure during volatile events
Minimum market liquidity	$50K 24h volume	Avoid thin markets with wide spreads
Whale copy min position size	$5K whale trade	Ignore micro-trades (may be tests, not conviction)
Whale copy max follow size	$2K virtual / trade	Proportional sizing, never blindly match whale size
AI signal minimum edge	8% probability delta	Below this, expected value after even 0% fees is too low
Market resolution cutoff	>= 48 hours remaining	Avoid markets near resolution (high manipulation risk)

8. Virtual Wallet Specification

The virtual wallet is the paper trading core. It mimics a real Polymarket account with simulated USDC balance, realistic fee simulation, and full trade history stored as a JSON ledger file.

8.1 Wallet Configuration
•	Starting balance: configurable (recommended $1,000–$10,000 equivalent)
•	Fee simulation: limit orders = 0% fee; market orders = simulated taker fee per category
•	Price simulation: assumes order fills at the mid-price at signal time (conservative assumption)
•	Slippage model: adds 0.5% simulated slippage on fills for realism
•	Position resolution: auto-closes positions when market resolves on-chain; credits $1.00 per winning share

8.2 Ledger Schema (per trade record)

Field	Type	Description
trade_id	UUID	Unique identifier for each paper trade
mode	Enum	COPY_TRADE | AI_SIGNAL
market_id	String	Polymarket market ID
market_question	String	Human-readable market question
side	Enum	YES | NO
entry_price	Float	Simulated fill price (0.00 to 1.00)
shares	Float	Number of shares purchased
notional_cost	Float	entry_price × shares (in USDC)
simulated_fee	Float	0 for maker; category rate for taker
signal_source	String	Whale wallet address OR news headline
signal_confidence	Float	0.0 to 1.0 — model confidence score
timestamp	ISO 8601	Time of simulated order placement
status	Enum	OPEN | CLOSED_WIN | CLOSED_LOSS | EXPIRED
resolution_price	Float	1.0 if won, 0.0 if lost (on resolution)
pnl	Float	Realized profit/loss in USDC
notes	String	Debug info, whale name, headline snippet

9. Technical Stack

Category	Technology	Reason for Choice
Language	TypeScript (Node.js)	Official SDK is TS-first; async/await ideal for WebSocket + REST; type safety prevents runtime bugs
Polymarket SDK	@polymarket/clob-client-v2	Official, updated 3 days ago as of April 2026; latest auth model
Market Data	Gamma API + CLOB WebSocket	Gamma for discovery; WebSocket for ~100ms real-time price updates
Whale Tracking	Polymarket Data API	Public on-chain activity feed; query by wallet address
AI Signal Engine	Claude API (claude-sonnet-4-20250514)	Best reasoning + cost balance for news scoring; structured JSON output
News Sources	NewsAPI / RSS (BBC, Reuters, AP)	Free tier sufficient for MVP; configurable per market category
Virtual Ledger	JSON file (Node.js fs)	Simple, human-readable, zero dependencies; upgradeable to SQLite later
Scheduling	node-cron + setInterval	Cron for hourly reports; intervals for real-time polling loops
Logging	winston	Structured JSON logs; separate files per module for debugging
Dashboard	Terminal tables + weekly HTML	Zero-infrastructure output; HTML for historical review

10. Development Phases

Phase 1 — Data Foundation (Week 1)
•	Set up TypeScript project, install @polymarket/clob-client-v2
•	Connect to Gamma API — fetch all active markets, filter by liquidity threshold
•	Implement WebSocket client — subscribe to price + order book streams
•	Connect to Data API — poll 3–5 target whale wallets every 30 seconds
•	Deliverable: can print live market prices and whale trades to console

Phase 2 — Virtual Wallet Engine (Week 1–2)
•	Implement VirtualWallet class with JSON persistence
•	Implement PaperTradeExecutor with realistic price + slippage simulation
•	Implement fee simulator (0% maker / category taker rates)
•	Implement PerformanceTracker computing win rate, PnL, drawdown
•	Deliverable: can manually trigger paper trades and see P&L tracked correctly

Phase 3 — Copy Trading Mode (Week 2)
•	Implement WhaleMonitor with multi-factor wallet scoring
•	Build trade detection and signal generation from whale activity
•	Connect to RiskGate for position limit enforcement
•	Wire to PaperTradeExecutor for automatic paper trade placement
•	Deliverable: bot automatically mirrors qualifying whale trades in paper wallet

Phase 4 — AI Signal Mode (Week 2–3)
•	Implement NewsIngestionService polling RSS + NewsAPI
•	Build LLM prompt pipeline: market matching → probability delta → trade signal
•	Implement 8% edge threshold filter and confidence scoring
•	Wire to RiskGate and PaperTradeExecutor
•	Deliverable: bot detects news events and places paper trades on impacted markets

Phase 5 — Analytics & Dashboard (Week 3)
•	Build daily terminal dashboard: balance, open positions, today's trades, win rate
•	Build weekly HTML report comparing Mode 1 vs Mode 2 performance
•	Implement market category breakdown (which markets are most profitable)
•	Implement whale wallet performance ranking (which whales to keep following)
•	Deliverable: full visibility dashboard, ready for 30-day paper trading run

11. Out of Scope for MVP

IMPORTANT	The following are explicitly NOT part of the MVP. They may be added after the paper trading phase validates the strategy.

•	Real wallet signing or on-chain transaction submission
•	Latency arbitrage or sub-second execution strategies
•	Cross-platform arbitrage (Polymarket vs. Kalshi)
•	Market making / liquidity provision (requires real capital and more complex inventory management)
•	VPS deployment or cloud infrastructure (run locally during paper phase)
•	Mobile alerts or Telegram notifications
•	Backtesting engine (forward paper trading is the validation method)

12. Known Risks & Mitigations

Risk	Severity	Mitigation
Paper results don't reflect live execution (fill rate, slippage)	HIGH	Model conservative slippage (0.5%); assume limit orders may not fill; track fill probability
Whale wallet is lucky, not skilled (survivorship bias)	HIGH	Require 50+ trade sample, win rate > 55%, recent activity; re-score wallets monthly
AI signal is too slow — market reprices before limit order fills	MEDIUM	Track fill rate in paper phase; signals with >10% edge have buffer; widen orders for speed
Polymarket changes fee structure or API during MVP phase	MEDIUM	Monitor Polymarket docs; fee simulator is parameterized and easy to update
LLM hallucination on news scoring	MEDIUM	Require JSON output with confidence score; reject signals below 0.6 confidence
API rate limits (60 orders/min, 100 req/min)	LOW	Paper trading doesn't count against limits; implement throttle for go-live
Geo-restriction (Mumbai is currently unrestricted)	LOW	Verify on go-live; use VPS in unrestricted jurisdiction if needed

13. Go/No-Go Decision After Paper Phase

After 30 days of paper trading, a formal review will assess:

5.	Is the overall paper win rate >= 55%? (If NO, do not go live — refine strategy first)
6.	Is either Mode 1 or Mode 2 performing at target threshold independently?
7.	What is the simulated max drawdown? (If > 25%, tighten risk parameters before going live)
8.	Which market categories are most profitable? (Concentrate live capital here first)
9.	Which whale wallets had the highest hit rate? (Keep top 3, drop underperformers)
10.	What is the signal-to-noise ratio of the AI engine? (How many signals were triggered vs. how many were profitable)

GO-LIVE RULE	Do NOT go live with real money unless both (a) overall paper win rate >= 55% AND (b) paper ROI >= 8% over 30 days. Strategy accuracy trumps urgency. The paper phase exists precisely to avoid expensive lessons.

Appendix: Research Sources

•	"Unravelling the Probabilistic Forest: Arbitrage in Prediction Markets" — Saguillo, Ghafouri, Kiffer, Suarez-Tangil. IMDEA Networks Institute / Oxford Internet Institute. August 2025. arXiv:2508.03474
•	Polymarket on-chain leaderboard analysis — Q3 2025 to Q1 2026 (multiple community analysts, on-chain data via Dune Analytics)
•	"Beyond Simple Arbitrage: 4 Polymarket Strategies Bots Actually Profit From in 2026" — ILLUMINATION/Medium, February 2026
•	"AI Agents in Prediction Markets: How Bots Beat Humans" — newyorkcityservers.com, April 2026
•	Polymarket Official API Docs — docs.polymarket.com, Maker Rebates Program, March 2026
•	"We Tested 11 AI Sentiment Tools Against Polymarket for 60 Days" — MoneySense AI Blog, April 2026
•	PolyTrack Leaderboard + Whale Tracker Analysis — polytrackhq.app, December 2025
•	Polymarket Fees Complete Guide — tradetheoutcome.com, predictionhunt.com, April 2026
•	Polystrat Agent Performance Data (Olas Protocol) — newyorkcityservers.com, April 2026

CONFIDENTIAL — INTERNAL USE ONLY  |  Polymarket Trading Bot PRD v1.0  |  April 2026
