# TERMINAL TRADER

Retro phosphor-green terminal-style stock market simulation trading game.

Single self-contained HTML file (vanilla JS + CSS + Canvas). No dependencies, no build step. Open `index.html` in any browser.

## Quick Start

1. Clone the repo
2. Open `index.html` in a browser
3. Trade. Reach $100,000 to win.

## Current Features

- Starting cash: $10,000
- Goal: $100,000
- 10 stocks with different volatilities and sectors (Tech, Auto, Crypto, Energy, Index, Retail)
- Real-time price ticks (random walk + slight drift)
- Price history sparkline chart (Canvas)
- Buy / Sell with quantity input and max-buy calculation
- Portfolio tracking (cash + holdings value)
- Random news events that move individual stocks or sectors
- Speed controls (1x / 2x / 5x) and pause
- Trade log
- Responsive + mobile-friendly
- CRT scanline overlay

## Stocks

| Symbol | Name              | Sector  | Volatility |
|--------|-------------------|---------|------------|
| AAPL   | Apple Inc         | Tech    | Low        |
| TSLA   | Tesla Inc         | Auto    | High       |
| NVDA   | NVIDIA            | Tech    | Medium     |
| AMZN   | Amazon            | Retail  | Medium     |
| MSFT   | Microsoft         | Tech    | Low        |
| GOOGL  | Alphabet          | Tech    | Medium     |
| META   | Meta              | Tech    | Medium     |
| BTC    | Bitcoin           | Crypto  | Very High  |
| SPY    | S&P 500 ETF       | Index   | Low        |
| XOM    | Exxon Mobil       | Energy  | Medium     |

## Architecture (for Claude / next developer)

Everything lives in one file: `index.html`.

Key structures:

```js
const stocks = [ /* array of stock objects */ ];
let portfolio = { cash: 10000, holdings: {} };
```

Stock object shape:
```js
{
  symbol: 'AAPL',
  name: 'Apple Inc',
  price: 185.42,
  base: 185,
  volatility: 0.018,
  history: [],
  sector: 'Tech'
}
```

Main loop:
- `tickMarket()` runs on interval (speed-controlled)
- Updates prices with random walk
- Occasionally calls `triggerNews()`
- Renders UI + chart

News events are data-driven in the `newsEvents` array. Easy to extend.

Chart is a simple Canvas line + fill drawn in `drawChart()`.

## Suggested Next Features (handoff)

Priority ideas for Claude to implement:

1. **Persistence** — save/load portfolio + day to localStorage
2. **More stocks / sectors** — or user-addable symbols
3. **Order types** — limit orders, stop losses
4. **P&L tracking** — average cost basis, realized/unrealized gains
5. **Sound** — subtle terminal beeps on trades / news
6. **Win/lose conditions** — bankruptcy screen, high score
7. **Dark/light phosphor themes** or color customization
8. **Mobile polish** — larger touch targets, better layout
9. **Export** — download trade history as CSV
10. **Multiplayer / leaderboard** (optional, via simple backend or local only)

## Design Notes

- Aesthetic: CRT terminal / phosphor green (inspired by retro trading terminals and ZONEZ-style projects)
- Keep it single-file if possible so it stays easy to share
- Prefer vanilla JS over frameworks
- Prices never go below $0.01
- News effects are multiplicative for simplicity

## Running Locally

Just open the HTML file. No server required.

Optional: `python3 -m http.server` if you want to test from another device.

---

Built as a quick playable prototype. Ready for extension.
