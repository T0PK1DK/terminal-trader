# TERMINAL TRADER

2D phosphor trading desk. Simulated tape, simulated money, no brokerage, no 3D.

Open `index.html` in a browser, or serve the folder:

```bash
npm start
# http://localhost:4173
```

**Play link:** [PLAY-LINK-PLACEHOLDER](https://PLAY-LINK-PLACEHOLDER)

**Repository:** https://github.com/T0PK1DK/terminal-trader

## What you get

- Trading-desk layout: scrolling tape, watchlist with sparklines, line/candle chart, ticket, positions, working orders
- Simulated book starts at **$10,000**. Clear **$100,000**. Wipe under **$250**
- Mean-reverting tape, news shocks, BULL / BEAR / CRASH / EARNINGS regimes
- Market, limit, and stop orders; fractional size; max-buy; light slippage and trade impact
- Short / cover (1× equity capacity); borrow fee on dividend names
- Cost basis, realized / unrealized P&L, occasional simulated dividends
- Rank ladder (INTERN → PARTNER) that unlocks more names — VP at $75k so BTC is playable before the $100k win
- Desk contracts, local leaderboard, autosave, session P&L card
- CRT scanline slider, phosphor / amber / ice themes, EMA20 overlay, ticks, toasts, fill bursts
- Keyboard: `SPACE` pause · `B` buy · `S` sell · `H` short · `C` cover · `1–6` watch · `[` `]` size

This is a game. Quotes are invented. Nothing here is a real market, a real order, or financial advice.

## Tests

```bash
npm test
```

CI runs the same command on every push (`.github/workflows/test.yml`).

## Layout

```
index.html          desk shell
css/desk.css        2D terminal chrome
src/engine.js       market, book, ranks, persistence (Node + browser)
src/ui.js           incremental DOM, chart, juice
src/audio.js        WebAudio beeps
tests/              engine + doc/html smoke tests
docs/RESEARCH.md    comps and borrowed patterns
docs/HANDOFF.md     what shipped and what is next
```

## Research

Comparable Roblox stock games and other sims — and the exact features borrowed — live in [docs/RESEARCH.md](docs/RESEARCH.md).

Primary sources:

- [RBLX Exchange](https://www.roblox.com/games/81340984854227/RBLX-Exchange)
- [Roblox Stock Exchange 2](https://www.roblox.com/games/110527353762049/Roblox-Stock-Exchange-2)
- [Roblox Stock Market](https://www.roblox.com/games/128687243784661/Roblox-Stock-Market)
- [StockRise](https://www.roblox.com/games/6266940721/StockRise-Stock-Simulator)
- [Stock Market Tycoon](https://www.roblox.com/games/119849505/Stock-Market-Tycoon)
- [STONKS-9800](https://store.steampowered.com/app/1539140/STONKS9800_Stock_Market_Simulator/)
- [Investopedia Simulator](https://www.investopedia.com/simulator/)
- [Finder paper-trading roundup](https://www.finder.com/stock-trading/stock-trading-games)

Do not copy those games' code or assets. This repo uses original art, copy, and a from-scratch engine.
