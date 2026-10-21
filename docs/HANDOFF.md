# Handoff

## What shipped (UI polish pass)

Still **2D**. No deploy. No engine changes; shorting, EMA20 and the session P&L card behave as before.

- **Sharper terminal look** — HUD corner brackets on panels, hairline stat strip, segmented control groups (speed / theme / desk), JetBrains Mono with monospace fallbacks, tabular numbers, blinking cursor on the mast and boot line.
- **Smooth chart motion** — each new print glides in over most of the tick interval (the line slides one slot left as the ring buffer rolls), the y-range widens fast and tightens slowly so prints never leave the frame, and a pulsing DOM dot marks the last price. Redraws only while a glide or range ease is in flight (`noteTick` / `chartAnimating` in `src/ui.js`). Respects `prefers-reduced-motion`.
- **Phone layout** — at ≤640px the controls become one swipeable strip, stats go 3×2, chart then ticket come before the watch list, 16px inputs (no iOS zoom), larger tap targets, toasts drop from the top, hover styles gated behind `(hover: hover)`.
- **Fixes** — `.news` panel styles leaked onto `.log-entry.news` rows (indented, padded log lines); negative money rendered as `$-12.34` (now `-$12.34`); the FLAT placeholder wrapped inside the positions grid; watch flashes tinted whole rows at 5× (now a price-text pulse).
- **Design-recon follow-up** (Mobbin research: Fidelity, Stake, Revolut, Wealthsimple, Vivid, Lightyear, Wealthfront, QuestMobile on iOS; Gemini, Binance, OKX, Coinbase, Kraken on web):
  - Phone pins BUY / SELL / SHORT / COVER to the bottom with a symbol · qty · type · P&L line (every mobile broker sampled pins trade actions; we keep all four because shorting is core).
  - Chart draws your entry line (LONG/SHORT qty @ avg with live P&L) and a dashed line per working order; off-range levels pin to the edge with ▲/▼. This covers the "trade markers" roadmap item.
  - O/H/L/C + EMA20 readout top-left (all five web terminals); crosshair price tag sits on the right axis.
  - Deliberately skipped: edge-to-edge phone chart (keeps the bracketed frame) and Buy/Sell tabs (an extra tap per trade, and it fights B/S/H/C keys).
- Screenshots in `docs/screenshots/`.

## Previous pass (overnight pass on 2.1)

Still **2D**. No deploy. No secrets. Simulated money only.

### Features

- **Short / cover** — Roblox Stock Exchange 2 crash-side trades. Capacity is 1× equity. Explicit SHORT refuses while a long is open; COVER only buys the short back. Dividend names debit shorts (borrow fee).
- **EMA20 + session P&L card** — cyan dashed overlay (toggleable). P&L modal shows equity, session %, realized / unrealized, peak, fills / shorts. Same card on win / wipe.

### Bugs closed

- VP unlock was $100k, same as the win wire, so BTC/COIN were unplayable. VP is now $75k.
- Working orders that failed to fill stayed on the book forever. They cancel once.
- Limit / stop buys did not reserve cash. Second tickets could overspend.
- Market buys could spend cash already reserved for a working buy.
- Tape rebuilt `innerHTML` every tick (broke the scroll and burned layout).
- Watch flashes spawned a `setTimeout` per print.
- FX overlay canvas used device pixels as CSS size (particles drew in the wrong space).
- Positions ignored shorts (`qty > 0`).
- Theme buttons never showed the active phosphor / amber / ice state.

### Perf / feel

- Incremental tape nodes; sparklines skip a redraw when the last print is unchanged
- Candle history is a ring buffer (no `shift` on the hot path)
- Missions / book / news DOM patch only when the hash changes
- CRT scanline slider (persisted), pause freezes the tape and the LIVE pip
- 25% / 50% size chips, SHORT / COVER row, regime-colored stat, last-price tag uses the theme background

### Tests / CI

- `npm test` — 37 cases (was 27). Same GitHub Action.
- New coverage: shorts, covers, capacity, cash reserve, dropped working orders, VP-before-win, EMA helper, borrow fee, short serialize.

## What is next

1. **Hosted play link** — drop a GitHub Pages (or other static) URL into the README placeholder. Do not deploy from an agent pass unless asked.
2. **CSV export** of the audit log.
3. **More contracts** — sector-hold streaks, news-fade, hold-a-short-through-crash.
4. **Optional remote board** — only if someone wants more than `localStorage`.
5. **Stop-limit** as a fourth ticket type (keep cash in cents).
6. **Juice** — trade markers on the chart; keep CRT optional and mild.

## Prompt for Claude

```
You are extending Terminal Trader, a 2D simulated trading-desk game
(https://github.com/T0PK1DK/terminal-trader). Simulated money only.
Do not add 3D. Do not deploy. Do not put personal names in public text.

Read docs/RESEARCH.md and docs/HANDOFF.md first. Engine is src/engine.js
(UMD: Node tests + browser). UI is src/ui.js + css/desk.css.

Rules:
- Keep cash in integer cents. Use normalizeQty / normalizeSignedQty / tradeCostCents.
- qty < 0 is a short. costCents is signed (negative on shorts). Equity = cash + mark.
- Short capacity is 1× equity. Reserve cash on working buys; drop a working
  order if the fill fails instead of retrying forever.
- Simulation ticks and render stay decoupled (interval vs rAF).
- Do not rebuild the whole watchlist or tape DOM every tick.
- Do not set canvas.width except on resize.
- Add or update tests in tests/engine.test.js for any engine change.
- Run npm test before you commit.

Pick one next item (CSV export, a new contract, stop-limit, or chart trade
markers), implement it, and open a PR with a screenshot of the desk.
```

## Play / repo

- Repo: https://github.com/T0PK1DK/terminal-trader
- Play link: https://PLAY-LINK-PLACEHOLDER
