# Research: 2D trading-desk game upgrades

Survey of comparable **Roblox stock/trading games** and other **trading sims**. Findings inform Terminal Trader's 2D desk overhaul. **No code, assets, or branding were copied** — only gameplay patterns and UX ideas.

All in-game money in this project is **simulated**. This is not real-money trading and is not financial advice.

## Roblox stock and trading games

### RBLX Exchange

- [Roblox listing](https://www.roblox.com/games/81340984854227/RBLX-Exchange)
- [Developer Forum write-up](https://devforum.roblox.com/t/rblx-exchange-an-investing-simulator/4337002)

Players trade popular Roblox experiences as if they were stocks. Prices react to demand, momentum, and (in the design notes) concurrent-player pressure. The listing and forum thread emphasize:

- Live charts and buy/sell
- Surges, crashes, volatility, slippage, trend pricing
- Global leaderboards
- Dividends and offline/passive fills
- Limit orders that can fill later
- Community feedback asking for **fractional shares** so expensive names stay tradable

### Roblox Stock Exchange 2

- [Roblox listing](https://www.roblox.com/games/110527353762049/Roblox-Stock-Exchange-2)
- [Rolimons stats / badges](https://www.rolimons.com/game/110527353762049)
- [Codes / feature recap](https://www.destructoid.com/roblox-stock-exchange-2-codes/)
- [Cash + limit + dividend loop](https://progameguides.com/roblox/roblox-stock-exchange-2-codes/)

Loop: start small, trade simulated stocks/crypto/ETFs/futures, optionally **short** crashes, unlock **trading bots**, chase net-worth badges and leaderboards. The listing is explicit: *“All markets and currencies are simulated. No real-money trading.”* Badge design turns net-worth milestones into a visible progression ladder.

### Roblox Stock Market

- [Roblox listing](https://www.roblox.com/games/128687243784661/Roblox-Stock-Market)

Starts players with a chunk of simulated cash. Sells **P&L visibility** (gains, losses, shareable P&L cards), detailed charts, seasonal events, and a wealth leaderboard. Another reminder that the market is fictional.

### StockRise: Stock Simulator

- [Roblox listing](https://www.roblox.com/games/6266940721/StockRise-Stock-Simulator)
- [Feature notes (office upgrades, titles)](https://bloxscape.com/games/stockrise-stock-simulator)

Mix of a public trading floor and a private office, real-time-ish crypto quotes, and cosmetic/progression upgrades (titles, trails, office). The “desk gets cooler as you rank up” fantasy is the useful bit for a 2D game.

### Stock Market Tycoon (classic)

- [Roblox listing](https://www.roblox.com/games/119849505/Stock-Market-Tycoon)

Older, very clear loop: prices move because of a **news GUI**, cash and holdings **persist**, and houses are a visible wealth sink (they do not even save — the portfolio does). Persistence plus news-driven candles is the durable lesson.

### Trading Tycoon

- [Roblox listing](https://www.roblox.com/games/112241277471797/Trading-Tycoon)

Buy-low/sell-high plus empire upgrades, luxury sinks, and leaderboards. Progression is “cash → unlocks → status,” not more 3D camera work.

### Broader Roblox trading context

- [Best trading Roblox games index](https://robipedia.com/tag/trading)
- [Tycoon loops, prestige, and retention (2026)](https://endsights.com/roblox-tycoon-games)

Most “trading” hits on Roblox are item economies (pets, knives), not broker desks. The stock-sim niche still copies tycoon DNA: **milestones, prestige, seasonal events, and a public scoreboard**.

## Other trading sims and paper-trading games

### STONKS-9800: Stock Market Simulator

- [Steam page](https://store.steampowered.com/app/1539140/STONKS9800_Stock_Market_Simulator/)
- [Official site](https://stonks.jp/)
- [Early-access review (CRT, events, unlocks)](https://ladiesgamers.com/stonks-9800-stock-market-simulator-early-access-review/)
- [Preview (instant boot, pause/save anytime)](https://www.gamegrin.com/previews/stonks-9800-stock-market-simulator-preview/)

The closest aesthetic cousin: 2D / text-and-spreadsheet desk, **CRT filter you can tune**, PC-98 vibe, news and life events, more tickers unlocking with wealth, dividends, achievements, and a game that boots instantly and pauses cleanly. Reviewers praise the *look of a terminal* more than 3D offices.

### Paper-trading classrooms

- [Investopedia Simulator overview](https://www.investopedia.com/simulator/)
- [How to use it (portfolio, research, games)](https://www.investopedia.com/how-to-use-the-investopedia-simulator-5221184)
- [Leaderboards](https://support.investopedia.com/hc/en-us/articles/30224709179287-How-do-I-see-my-game-rankings-leaderboard)
- [Order types: market / limit / stop; short; max-buy](https://www.investopedia.com/how-to-use-the-investopedia-simulator-5221184)
- [Finder: MarketWatch VSE, Wall Street Survivor, etc.](https://www.finder.com/stock-trading/stock-trading-games)
- [U.S. News: stock-market games as practice tools](https://money.usnews.com/investing/articles/the-best-stock-market-games-to-play)

These products are dry on purpose, but they agree on a ticket: **positions with cost basis, P&L, market/limit/stop, max-buy, competitions, and a rank list**. Wall Street Survivor and MarketWatch add contests and multiple order types.

### Day-trading sim UX (charts + juice)

- [What makes a simulator feel like a desk](https://www.goatfundedtrader.com/blog/best-day-trading-simulator)
- [Competitions and leaderboards as engagement (and overtrading risk)](https://www.tradicted.com/learn/best-day-trading-simulators/)

Believable desks do three things: **candles from ticks**, **news stamped on the tape**, and **immediate feedback** when an order fills (watchlist flash, P&L tick, toast).

### Browser / indie cousins

- [itch.io stock-market tag](https://itch.io/games/tag-stock-market)
- [Player-impact + live candles + news engine (browser)](https://www.reddit.com/r/incremental_games/comments/1sdg47l/i_built_a_fictional_stock_market_game_where/)

Indie browser games that stick usually let **player flow nudge price**, run a **news engine**, and cycle **bull / crash / recovery** regimes.

## UI references (layout only, not assets)

Production finance UIs that informed the 2D desk grid (watchlist + chart + ticket + positions):

- [Copilot Money — movers, sparklines, positions](https://mobbin.com/screens/a3ae024a-fbc1-496b-8886-79a39e97acb4)
- [Perplexity Finance — tape, gainers, sector stack](https://mobbin.com/screens/0dc467a6-069f-434d-8500-14d1946c12d5)
- [Base — chart + average cost + P&L](https://mobbin.com/screens/2439249c-3665-4ba4-b7e2-602b39aa8df8)
- [Phantom — glowing line chart + trade CTA](https://mobbin.com/screens/01a09d88-bf83-424f-9ac8-589949a59d44)
- [Public — buy/sell ticket density](https://mobbin.com/screens/65674dfa-0d72-4e49-b3f1-5e7b2d912267)
- [Cash App — preset size chips](https://mobbin.com/screens/3c393e1e-5d4a-4387-874f-281996eead50)

## What we are borrowing

| Pattern | From | How it lands in Terminal Trader |
| --- | --- | --- |
| News-driven spikes | Stock Market Tycoon, RBLX Exchange, indie news engines | Breaking tape + decaying sector/symbol shocks |
| Market regimes | Indie browser sims, RBLX volatility/trend | BULL / BEAR / CRASH / EARNINGS cycles |
| Player flow moves price | RBLX Exchange, browser “market impact” games | Small slippage + temporary impact on market orders |
| Fractional shares | RBLX Exchange forum feedback | Decimal qty so high-priced names stay playable |
| Limit + stop + max-buy | Investopedia, Wall Street Survivor, RBLX | Ticket supports market / limit / stop |
| Cost basis + P&L | Investopedia, Roblox Stock Market, Base app | Avg cost, unrealized, realized, session % |
| Dividends / passive drip | RBLX Exchange, STONKS-9800, RSX2 | Occasional simulated dividends for holders |
| Rank / unlock ladder | RSX2 badges, StockRise titles, tycoon prestige | INTERN → JUNIOR → ANALYST → VP → PARTNER; extra tickers unlock |
| Local leaderboard | Investopedia games, Roblox wealth boards | Best equity runs stored in the browser only |
| Persistence | Stock Market Tycoon, STONKS-9800 | localStorage snapshot of desk + book |
| Missions / awards | Tycoon loops, Stock Market Tycoon: Challenge | Rotating desk contracts with small simulated bonuses |
| Win / wipe | RSX2 “millions or lose everything” | Equity goal + bankruptcy overlay |
| CRT terminal desk | STONKS-9800, original prototype | 2D phosphor/amber/ice themes, scanlines, boot splash |
| Smooth charts | Day-trading sims, Phantom / Copilot | Canvas line + candles, volume, last-price ray, sparklines |
| Juice | Trading-sim feedback write-ups | Flashes, toasts, ticks, beeps, fill bursts — still 2D |
| Instant pause / save | STONKS-9800 reviews | Space to halt, autosave, no install |

## What we are not borrowing

- 3D trading floors, offices, avatars, or camera toys
- Real quotes, real brokerage routing, or real-money rails
- Copying any game's art, audio, names-as-brands beyond ordinary ticker symbols used as **simulated** fixtures
- Gambling mini-games (pachinko, horse racing) from STONKS-9800
- Pay-to-win codes / Robux monetization
- Live multiplayer matching (local scoreboard only)

## Sources (quick list)

1. https://www.roblox.com/games/81340984854227/RBLX-Exchange
2. https://devforum.roblox.com/t/rblx-exchange-an-investing-simulator/4337002
3. https://www.roblox.com/games/110527353762049/Roblox-Stock-Exchange-2
4. https://www.rolimons.com/game/110527353762049
5. https://www.destructoid.com/roblox-stock-exchange-2-codes/
6. https://progameguides.com/roblox/roblox-stock-exchange-2-codes/
7. https://www.roblox.com/games/128687243784661/Roblox-Stock-Market
8. https://www.roblox.com/games/6266940721/StockRise-Stock-Simulator
9. https://bloxscape.com/games/stockrise-stock-simulator
10. https://www.roblox.com/games/119849505/Stock-Market-Tycoon
11. https://www.roblox.com/games/112241277471797/Trading-Tycoon
12. https://robipedia.com/tag/trading
13. https://endsights.com/roblox-tycoon-games
14. https://store.steampowered.com/app/1539140/STONKS9800_Stock_Market_Simulator/
15. https://stonks.jp/
16. https://ladiesgamers.com/stonks-9800-stock-market-simulator-early-access-review/
17. https://www.gamegrin.com/previews/stonks-9800-stock-market-simulator-preview/
18. https://www.investopedia.com/simulator/
19. https://www.investopedia.com/how-to-use-the-investopedia-simulator-5221184
20. https://support.investopedia.com/hc/en-us/articles/30224709179287-How-do-I-see-my-game-rankings-leaderboard
21. https://www.finder.com/stock-trading/stock-trading-games
22. https://money.usnews.com/investing/articles/the-best-stock-market-games-to-play
23. https://www.goatfundedtrader.com/blog/best-day-trading-simulator
24. https://www.tradicted.com/learn/best-day-trading-simulators/
25. https://itch.io/games/tag-stock-market
26. https://www.reddit.com/r/incremental_games/comments/1sdg47l/i_built_a_fictional_stock_market_game_where/
27. https://mobbin.com/screens/a3ae024a-fbc1-496b-8886-79a39e97acb4
28. https://mobbin.com/screens/0dc467a6-069f-434d-8500-14d1946c12d5
29. https://mobbin.com/screens/2439249c-3665-4ba4-b7e2-602b39aa8df8
30. https://mobbin.com/screens/01a09d88-bf83-424f-9ac8-589949a59d44
31. https://mobbin.com/screens/65674dfa-0d72-4e49-b3f1-5e7b2d912267
32. https://mobbin.com/screens/3c393e1e-5d4a-4387-874f-281996eead50
