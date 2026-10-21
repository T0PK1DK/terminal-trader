# Handoff

## What shipped

Terminal Trader is no longer a single-file prototype. The desk is still **2D** (HTML/CSS + Canvas). The market lives in `src/engine.js` so Node can test it without a browser.

### Engine

- Seedable RNG, cents-accurate cash, fractional qty
- Mean-reverting prices + regime drift/vol + decaying news shocks + trade impact
- Ring-buffer ticks and OHLC candles (no unbounded `shift` on the hot path)
- Market / limit / stop book, max-buy, slippage
- Average cost, realized + unrealized P&L, simulated dividends
- Ranks unlock extra symbols; win at $100k; wipe under $250 (once, then freeze)
- Rotating desk contracts, localStorage snapshot + local leaderboard
- Event stream for the UI (`fill`, `news`, `rank`, `win`, `lose`, …)

### Desk / juice

- Watch / chart / ticket / tape / contracts / audit log
- Line + candle chart, last-price ray, crosshair, sparklines, top movers
- Incremental watchlist updates (no full innerHTML wipe of the book every tick)
- Chart canvas resizes only when the box changes (`ResizeObserver`)
- Number tween, flashes, toasts, particle bursts, WebAudio, boot splash
- Phosphor / amber / ice themes, pause/speed, mute, help, reset

### Bugs closed from the prototype

- Win toast no longer repeats every tick
- Speed buttons no longer steal state from Pause
- Qty cannot be `NaN` / negative
- Chart no longer resets `canvas.width` on every tick (that flicker + layout tax is gone)
- Watchlist is patched in place instead of rebuilt
- BTC is tradable via fractional size after rank unlock (was unbuyable at $67k with $10k)
- Prices stay ≥ $0.01 and mean-revert instead of random-walking to the moon
- Session can bankrupt and stop the clock

### Tests / CI

- `npm test` — Node's built-in runner, no extra deps
- GitHub Action `.github/workflows/test.yml`
- HTML/docs smoke test forbids personal names in public text

## What is next

1. **Hosted play link** — drop a GitHub Pages (or other static) URL into the README placeholder. Do not deploy from this agent pass.
2. **Shorting / cover** — Roblox Stock Exchange 2 players expect crash-side trades.
3. **Indicators** — VWAP or a 20-tick EMA on the chart.
4. **CSV export** of the audit log.
5. **Optional remote board** — only if someone wants more than `localStorage`.
6. **Juice pass** — per-theme CRT warp slider (STONKS-9800 lesson: keep it optional and mild).
7. **More contracts** — sector-hold streaks, news-fade challenges.

## Prompt for Claude

```
You are extending Terminal Trader, a 2D simulated trading-desk game
(https://github.com/T0PK1DK/terminal-trader). Simulated money only.
Do not add 3D. Do not deploy. Do not put personal names in public text.

Read docs/RESEARCH.md and docs/HANDOFF.md first. Engine is src/engine.js
(UMD: Node tests + browser). UI is src/ui.js + css/desk.css.

Rules:
- Keep cash in integer cents. Use normalizeQty / tradeCostCents.
- Simulation ticks and render stay decoupled (interval vs rAF).
- Do not rebuild the whole watchlist DOM every tick.
- Do not set canvas.width except on resize.
- Add or update tests in tests/engine.test.js for any engine change.
- Run npm test before you commit.

Pick one next item (shorting, EMA, CSV export, or a CRT slider),
implement it, and open a PR with a screenshot of the desk.
```

## Play / repo

- Repo: https://github.com/T0PK1DK/terminal-trader
- Play link: https://PLAY-LINK-PLACEHOLDER
