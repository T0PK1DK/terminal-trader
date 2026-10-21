'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.TerminalTrader = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STARTING_CASH = 10000;
  const WIN_EQUITY = 100000;
  const BANKRUPT_EQUITY = 250;
  const HISTORY_LEN = 180;
  const CANDLE_LEN = 48;
  const TICKS_PER_CANDLE = 5;
  const TICKS_PER_DAY = 40;
  const MAX_OPEN_ORDERS = 8;
  const MAX_LOG = 80;
  const SAVE_VERSION = 2;

  const RANKS = [
    { id: 'INTERN', title: 'INTERN', minEquity: 0, unlocks: [] },
    { id: 'JUNIOR', title: 'JUNIOR', minEquity: 25000, unlocks: ['NVDA', 'GOOGL'] },
    { id: 'ANALYST', title: 'ANALYST', minEquity: 50000, unlocks: ['META', 'AMD'] },
    { id: 'VP', title: 'VICE PRESIDENT', minEquity: 100000, unlocks: ['BTC', 'COIN'] },
    { id: 'PARTNER', title: 'PARTNER', minEquity: 250000, unlocks: [] }
  ];

  const UNIVERSE = [
    { symbol: 'AAPL', name: 'Northgrove Systems', price: 185.42, volatility: 0.018, sector: 'Tech', unlockRank: 'INTERN', dividend: 0.0004 },
    { symbol: 'TSLA', name: 'VoltWagon Dynamics', price: 248.15, volatility: 0.035, sector: 'Auto', unlockRank: 'INTERN', dividend: 0 },
    { symbol: 'AMZN', name: 'Rivercart Retail', price: 178.9, volatility: 0.022, sector: 'Retail', unlockRank: 'INTERN', dividend: 0 },
    { symbol: 'MSFT', name: 'Pebblecloud Soft', price: 415.6, volatility: 0.016, sector: 'Tech', unlockRank: 'INTERN', dividend: 0.0005 },
    { symbol: 'SPY', name: 'Broadtape Index', price: 512.4, volatility: 0.012, sector: 'Index', unlockRank: 'INTERN', dividend: 0.0006 },
    { symbol: 'XOM', name: 'Deepwell Energy', price: 118.75, volatility: 0.019, sector: 'Energy', unlockRank: 'INTERN', dividend: 0.0008 },
    { symbol: 'NVDA', name: 'Prism Silicon', price: 214.3, volatility: 0.028, sector: 'Tech', unlockRank: 'JUNIOR', dividend: 0 },
    { symbol: 'GOOGL', name: 'Beacon Search', price: 162.25, volatility: 0.02, sector: 'Tech', unlockRank: 'JUNIOR', dividend: 0 },
    { symbol: 'META', name: 'Harbor Social', price: 198.4, volatility: 0.026, sector: 'Tech', unlockRank: 'ANALYST', dividend: 0 },
    { symbol: 'AMD', name: 'Redforge Chips', price: 142.8, volatility: 0.03, sector: 'Tech', unlockRank: 'ANALYST', dividend: 0 },
    { symbol: 'BTC', name: 'Simulated Bitcoin', price: 67250, volatility: 0.045, sector: 'Crypto', unlockRank: 'VP', dividend: 0 },
    { symbol: 'COIN', name: 'Ledger Gate', price: 86.2, volatility: 0.038, sector: 'Crypto', unlockRank: 'VP', dividend: 0 }
  ];

  const NEWS_EVENTS = [
    { text: 'Desk chatter: policy easing bid hits software names', effect: { Tech: 0.06 } },
    { text: 'Factory halt slams automakers on the open', effect: { Auto: -0.1 } },
    { text: 'Crypto ETF rumor tape — digital assets rip', effect: { Crypto: 0.12 } },
    { text: 'Barrels spike on shipping risk — energy bid', effect: { Energy: 0.08 } },
    { text: 'Inflation print hotter than models — risk-off', effect: { all: -0.035 } },
    { text: 'Soft landing print — broad bid across the tape', effect: { all: 0.04 } },
    { text: 'Prism Silicon ships a surprise inference chip', effect: { NVDA: 0.1 } },
    { text: 'VoltWagon issues a limited recall', effect: { TSLA: -0.08 } },
    { text: 'Rivercart same-day volume beats the street', effect: { AMZN: 0.06 } },
    { text: 'Pebblecloud cloud backlog accelerates', effect: { MSFT: 0.07 } },
    { text: 'Simulated Bitcoin exchange outage — dump', effect: { BTC: -0.14 } },
    { text: 'Index rebalance rumor lifts the tape', effect: { Index: 0.03, SPY: 0.04 } },
    { text: 'Retail miss — discretionary names fade', effect: { Retail: -0.05 } },
    { text: 'Earnings week: implied vol bid, path unclear', effect: { all: 0, vol: 1.35 } }
  ];

  const REGIMES = {
    CALM: { id: 'CALM', label: 'REGULAR HOURS', drift: 0.00012, vol: 1, newsMul: 1, duration: [70, 110] },
    BULL: { id: 'BULL', label: 'BULL TAPE', drift: 0.0009, vol: 0.92, newsMul: 1.1, duration: [50, 90] },
    BEAR: { id: 'BEAR', label: 'RISK-OFF', drift: -0.00055, vol: 1.15, newsMul: 1.15, duration: [45, 80] },
    CRASH: { id: 'CRASH', label: 'FLASH STRESS', drift: -0.0032, vol: 1.85, newsMul: 1.4, duration: [12, 22] },
    EARNINGS: { id: 'EARNINGS', label: 'EARNINGS WEEK', drift: 0.00005, vol: 1.45, newsMul: 1.25, duration: [30, 50] }
  };

  const MISSIONS = [
    { id: 'trades3', title: 'SCALP DESK', desc: 'Execute 3 fills', key: 'fills', target: 3, rewardCents: 15000 },
    { id: 'win1', title: 'BOOK A WIN', desc: 'Close a position in profit', key: 'winningSells', target: 1, rewardCents: 20000 },
    { id: 'sectors2', title: 'SPREAD RISK', desc: 'Hold 2 sectors at once', key: 'sectorsHeld', target: 2, rewardCents: 18000 },
    { id: 'news1', title: 'TRADE THE TAPE', desc: 'Fill an order during news', key: 'newsTrades', target: 1, rewardCents: 22000 },
    { id: 'pnl8', title: 'GREEN SESSION', desc: 'Reach +8% session return', key: 'sessionPct', target: 8, rewardCents: 25000 }
  ];

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function toCents(n) {
    return Math.round(Number(n) * 100);
  }

  function fromCents(c) {
    return c / 100;
  }

  function normalizeQty(qty) {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 10000) / 10000;
  }

  function tradeCostCents(qty, price) {
    return Math.round(qty * price * 100);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length) % list.length];
  }

  function rankIndexFor(id) {
    return RANKS.findIndex((r) => r.id === id);
  }

  function rankForEquity(equity) {
    let current = RANKS[0];
    for (const rank of RANKS) {
      if (equity + 1e-9 >= rank.minEquity) current = rank;
    }
    return current;
  }

  function unlockedSet(rankId) {
    const idx = rankIndexFor(rankId);
    const set = new Set();
    UNIVERSE.forEach((u) => {
      if (rankIndexFor(u.unlockRank) <= idx) set.add(u.symbol);
    });
    RANKS.forEach((r, i) => {
      if (i <= idx) r.unlocks.forEach((s) => set.add(s));
    });
    return set;
  }

  function createRing(capacity, fill) {
    const data = new Array(capacity);
    let head = 0;
    let count = 0;
    if (fill != null) {
      for (let i = 0; i < Math.min(24, capacity); i++) {
        data[i] = fill;
      }
      head = Math.min(24, capacity);
      count = head;
    }
    return {
      push(value) {
        data[head] = value;
        head = (head + 1) % capacity;
        if (count < capacity) count += 1;
      },
      toArray() {
        if (count === 0) return [];
        const start = (head - count + capacity) % capacity;
        const out = new Array(count);
        for (let i = 0; i < count; i++) out[i] = data[(start + i) % capacity];
        return out;
      },
      last() {
        if (count === 0) return undefined;
        return data[(head - 1 + capacity) % capacity];
      },
      prev() {
        if (count < 2) return this.last();
        return data[(head - 2 + capacity) % capacity];
      },
      get length() {
        return count;
      }
    };
  }

  function hydrateStock(def, rng) {
    const jitter = 1 + (rng() - 0.5) * 0.01;
    const price = Math.max(0.01, def.price * jitter);
    const ticks = createRing(HISTORY_LEN, price);
    for (let i = 0; i < 18; i++) {
      const step = price * (1 + (rng() - 0.5) * def.volatility * 0.6);
      ticks.push(Math.max(0.01, step));
    }
    const last = ticks.last();
    return {
      symbol: def.symbol,
      name: def.name,
      sector: def.sector,
      unlockRank: def.unlockRank,
      dividend: def.dividend,
      volatility: def.volatility,
      price: last,
      prevPrice: ticks.prev() || last,
      openPrice: last,
      dayOpen: last,
      base: def.price,
      shock: 0,
      impact: 0,
      volume: 0,
      ticks,
      candles: [],
      candle: { o: last, h: last, l: last, c: last, v: 0 },
      candleTicks: 0
    };
  }

  function pushPrice(stock, price, volume) {
    stock.prevPrice = stock.price;
    stock.price = Math.max(0.01, price);
    stock.volume = volume;
    stock.ticks.push(stock.price);
    const c = stock.candle;
    if (stock.candleTicks === 0) {
      stock.candle = { o: stock.price, h: stock.price, l: stock.price, c: stock.price, v: volume };
    } else {
      c.h = Math.max(c.h, stock.price);
      c.l = Math.min(c.l, stock.price);
      c.c = stock.price;
      c.v += volume;
    }
    stock.candleTicks += 1;
    if (stock.candleTicks >= TICKS_PER_CANDLE) {
      stock.candles.push(stock.candle);
      if (stock.candles.length > CANDLE_LEN) stock.candles.shift();
      stock.candleTicks = 0;
    }
  }

  function defaultMissions(rng) {
    const pool = MISSIONS.slice();
    const first = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const second = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    return [first, second].map((m) => ({
      id: m.id,
      title: m.title,
      desc: m.desc,
      key: m.key,
      target: m.target,
      rewardCents: m.rewardCents,
      progress: 0,
      done: false
    }));
  }

  function createGame(options) {
    const opt = options || {};
    const rng = opt.rng || Math.random;
    const startingCash = opt.startingCash != null ? opt.startingCash : STARTING_CASH;
    const winEquity = opt.winEquity != null ? opt.winEquity : WIN_EQUITY;
    const bankruptEquity = opt.bankruptEquity != null ? opt.bankruptEquity : BANKRUPT_EQUITY;
    const persistKey = opt.persistKey || 'terminal-trader-v2';
    const scoresKey = opt.scoresKey || 'terminal-trader-scores-v2';
    const storage = opt.storage || null;
    const newsChance = opt.newsChance != null ? opt.newsChance : 0.045;
    const regimeChance = opt.regimeChance != null ? opt.regimeChance : 0.012;

    const state = {
      cashCents: toCents(startingCash),
      startingCashCents: toCents(startingCash),
      holdings: {},
      realizedCents: 0,
      tick: 0,
      day: 1,
      speed: 1,
      paused: false,
      selected: 'AAPL',
      rankId: 'INTERN',
      peakEquityCents: toCents(startingCash),
      won: false,
      lost: false,
      news: { text: 'MARKET OPEN. Simulated tape is live.', until: 12, hot: false },
      regime: { ...REGIMES.CALM, left: 90 },
      orders: [],
      orderSeq: 1,
      stats: { fills: 0, winningSells: 0, newsTrades: 0, sessionHighPct: 0 },
      missions: defaultMissions(rng),
      log: [],
      events: [],
      nextOrderId: 1
    };

    UNIVERSE.forEach((u) => {
      state.holdings[u.symbol] = { qty: 0, costCents: 0 };
    });

    let stocks = UNIVERSE.map((def) => hydrateStock(def, rng));
    const bySymbol = () => {
      const map = Object.create(null);
      stocks.forEach((s) => {
        map[s.symbol] = s;
      });
      return map;
    };

    function unlockedSymbols() {
      return unlockedSet(state.rankId);
    }

    function isUnlocked(symbol) {
      return unlockedSymbols().has(symbol);
    }

    function stock(symbol) {
      return stocks.find((s) => s.symbol === symbol);
    }

    function holdingsValueCents() {
      let sum = 0;
      stocks.forEach((s) => {
        const h = state.holdings[s.symbol];
        if (!h || !h.qty) return;
        sum += tradeCostCents(h.qty, s.price);
      });
      return sum;
    }

    function equityCents() {
      return state.cashCents + holdingsValueCents();
    }

    function sessionPct() {
      const start = state.startingCashCents;
      if (!start) return 0;
      return ((equityCents() - start) / start) * 100;
    }

    function sectorsHeld() {
      const set = new Set();
      stocks.forEach((s) => {
        if (state.holdings[s.symbol].qty > 0) set.add(s.sector);
      });
      return set.size;
    }

    function positionMark(symbol) {
      const h = state.holdings[symbol];
      const s = stock(symbol);
      if (!h || !s || h.qty <= 0) {
        return { qty: 0, avg: 0, marketCents: 0, costCents: 0, unrealizedCents: 0, pnlPct: 0 };
      }
      const marketCents = tradeCostCents(h.qty, s.price);
      const unrealizedCents = marketCents - h.costCents;
      const avg = h.qty ? fromCents(h.costCents) / h.qty : 0;
      const pnlPct = h.costCents ? (unrealizedCents / h.costCents) * 100 : 0;
      return { qty: h.qty, avg, marketCents, costCents: h.costCents, unrealizedCents, pnlPct };
    }

    function emit(type, payload) {
      state.events.push(Object.assign({ type, tick: state.tick, day: state.day }, payload || {}));
    }

    function log(msg, kind) {
      state.log.push({ day: state.day, tick: state.tick, msg, kind: kind || 'info' });
      if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
    }

    function applyUnlocks(prevRank, nextRank) {
      if (rankIndexFor(nextRank) <= rankIndexFor(prevRank)) return;
      const newly = [];
      unlockedSet(nextRank).forEach((sym) => {
        if (!unlockedSet(prevRank).has(sym)) newly.push(sym);
      });
      if (newly.length) {
        log('UNLOCKED TAPE: ' + newly.join(', '), 'rank');
        emit('unlock', { symbols: newly, rank: nextRank });
      }
    }

    function refreshRank() {
      const next = rankForEquity(fromCents(equityCents()));
      if (next.id !== state.rankId) {
        const prev = state.rankId;
        applyUnlocks(prev, next.id);
        state.rankId = next.id;
        log('RANK UP → ' + next.title, 'rank');
        emit('rank', { from: prev, to: next.id, title: next.title });
      }
    }

    function updateMissions() {
      const snapshot = {
        fills: state.stats.fills,
        winningSells: state.stats.winningSells,
        newsTrades: state.stats.newsTrades,
        sectorsHeld: sectorsHeld(),
        sessionPct: Math.max(0, sessionPct())
      };
      state.missions.forEach((m) => {
        if (m.done) return;
        m.progress = snapshot[m.key] || 0;
        if (m.progress >= m.target) {
          m.done = true;
          m.progress = m.target;
          state.cashCents += m.rewardCents;
          log('CONTRACT CLEAR: ' + m.title + '  +$' + fromCents(m.rewardCents).toFixed(2), 'mission');
          emit('mission', { id: m.id, rewardCents: m.rewardCents });
        }
      });
    }

    function maybeRotateMissions() {
      if (state.missions.every((m) => m.done)) {
        state.missions = defaultMissions(rng);
        log('NEW DESK CONTRACTS ON THE WIRE', 'mission');
        emit('missions', { missions: state.missions.map((m) => m.id) });
      }
    }

    function applyNews(event) {
      const map = bySymbol();
      Object.keys(map).forEach((sym) => {
        const s = map[sym];
        let shock = 0;
        if (event.effect.all) shock += event.effect.all;
        if (event.effect[s.sector]) shock += event.effect[s.sector];
        if (event.effect[sym]) shock += event.effect[sym];
        if (event.effect.vol) s.volatility = UNIVERSE.find((u) => u.symbol === sym).volatility * event.effect.vol;
        if (shock !== 0) {
          s.shock += shock;
          s.price = Math.max(0.01, s.price * (1 + shock * 0.55));
        }
      });
      state.news = { text: event.text, until: state.tick + 16, hot: true, effect: event.effect };
      log('NEWS: ' + event.text, 'news');
      emit('news', { text: event.text, effect: event.effect });
    }

    function triggerNews() {
      applyNews(pick(rng, NEWS_EVENTS));
    }

    function maybeRegime() {
      state.regime.left -= 1;
      if (state.regime.left > 0 && rng() > regimeChance) return;
      const keys = Object.keys(REGIMES);
      let next = pick(rng, keys);
      if (next === state.regime.id) next = pick(rng, keys);
      const def = REGIMES[next];
      const span = def.duration;
      state.regime = {
        ...def,
        left: span[0] + Math.floor(rng() * (span[1] - span[0] + 1))
      };
      log('REGIME → ' + def.label, 'regime');
      emit('regime', { id: def.id, label: def.label });
    }

    function fillOrder(order, fillPrice, reason) {
      const s = stock(order.symbol);
      if (!s) return { ok: false, reason: 'unknown symbol' };
      const qty = order.qty;
      const cost = tradeCostCents(qty, fillPrice);
      if (order.side === 'buy') {
        if (cost > state.cashCents) return { ok: false, reason: 'Insufficient cash.' };
        state.cashCents -= cost;
        const h = state.holdings[order.symbol];
        h.costCents += cost;
        h.qty = normalizeQty(h.qty + qty);
      } else {
        const h = state.holdings[order.symbol];
        if (h.qty + 1e-9 < qty) return { ok: false, reason: 'Not enough shares.' };
        const avgCost = h.qty ? h.costCents / h.qty : 0;
        const closedCost = Math.round(avgCost * qty);
        h.qty = normalizeQty(h.qty - qty);
        h.costCents = h.qty <= 0 ? 0 : h.costCents - closedCost;
        if (h.qty <= 0) {
          h.qty = 0;
          h.costCents = 0;
        }
        state.cashCents += cost;
        const pnl = cost - closedCost;
        state.realizedCents += pnl;
        if (pnl > 0) state.stats.winningSells += 1;
      }
      s.impact += order.side === 'buy' ? 0.0018 * Math.min(1, qty) : -0.0018 * Math.min(1, qty);
      state.stats.fills += 1;
      if (state.news.hot) state.stats.newsTrades += 1;
      const verb = order.side === 'buy' ? 'BOUGHT' : 'SOLD';
      const via = reason ? ' [' + reason + ']' : '';
      log(verb + ' ' + qty + ' ' + order.symbol + ' @ $' + fillPrice.toFixed(2) + via, order.side);
      emit('fill', {
        symbol: order.symbol,
        side: order.side,
        qty,
        price: fillPrice,
        reason: reason || 'market',
        type: order.type
      });
      return { ok: true, price: fillPrice, qty, symbol: order.symbol, side: order.side };
    }

    function processWorkingOrders() {
      const still = [];
      state.orders.forEach((order) => {
        const s = stock(order.symbol);
        if (!s || !isUnlocked(order.symbol)) {
          still.push(order);
          return;
        }
        let hit = false;
        if (order.type === 'limit' && order.side === 'buy' && s.price <= order.price) hit = true;
        if (order.type === 'limit' && order.side === 'sell' && s.price >= order.price) hit = true;
        if (order.type === 'stop' && order.side === 'sell' && s.price <= order.price) hit = true;
        if (order.type === 'stop' && order.side === 'buy' && s.price >= order.price) hit = true;
        if (!hit) {
          still.push(order);
          return;
        }
        const result = fillOrder(order, s.price, order.type.toUpperCase() + ' FILL');
        if (!result.ok) still.push(order);
      });
      state.orders = still;
    }

    function payDividends() {
      let paid = 0;
      stocks.forEach((s) => {
        if (!s.dividend || !isUnlocked(s.symbol)) return;
        const h = state.holdings[s.symbol];
        if (!h.qty) return;
        const cents = Math.round(h.qty * s.price * s.dividend * 100);
        if (cents > 0) {
          state.cashCents += cents;
          paid += cents;
        }
      });
      if (paid > 0) {
        log('DIVIDEND WIRE +$' + fromCents(paid).toFixed(2), 'div');
        emit('dividend', { cents: paid });
      }
    }

    function tickPrices() {
      const regime = state.regime;
      stocks.forEach((s) => {
        if (!isUnlocked(s.symbol)) {
          s.volume = 0;
          return;
        }
        const reversion = 0.045 * (s.base - s.price) / s.base;
        const noise = (rng() - 0.5) * 2 * s.volatility * regime.vol;
        const ret = reversion + noise + regime.drift + s.shock + s.impact;
        const next = Math.max(0.01, s.price * (1 + ret));
        const volume = Math.max(
          1,
          Math.round(800 * s.volatility * (0.4 + rng()) * (1 + Math.abs(ret) * 28) * 100)
        );
        pushPrice(s, next, volume);
        s.shock *= 0.68;
        s.impact *= 0.46;
        if (Math.abs(s.shock) < 1e-5) s.shock = 0;
        if (Math.abs(s.impact) < 1e-5) s.impact = 0;
      });
    }

    function checkTerminal() {
      const eq = equityCents();
      state.peakEquityCents = Math.max(state.peakEquityCents, eq);
      if (!state.won && fromCents(eq) >= winEquity) {
        state.won = true;
        state.paused = true;
        log('DESK CLEARED. Simulated book hit $' + winEquity.toLocaleString('en-US') + '.', 'win');
        emit('win', { equityCents: eq });
        recordScore('WIN');
      }
      const cashBroke = state.cashCents <= 0 && holdingsValueCents() < toCents(bankruptEquity);
      const eqBroke = eq < toCents(bankruptEquity);
      if (!state.lost && !state.won && (eqBroke || cashBroke)) {
        state.lost = true;
        state.paused = true;
        log('MARGIN CALL. Simulated book wiped.', 'lose');
        emit('lose', { equityCents: eq });
        recordScore('WIPE');
      }
    }

    function recordScore(tag) {
      if (!storage || typeof storage.getItem !== 'function') return;
      let list = [];
      try {
        list = JSON.parse(storage.getItem(scoresKey) || '[]');
        if (!Array.isArray(list)) list = [];
      } catch (err) {
        list = [];
      }
      list.push({
        alias: opt.alias || 'DESK-01',
        equity: fromCents(equityCents()),
        day: state.day,
        tag: tag || 'RUN',
        at: Date.now()
      });
      list.sort((a, b) => b.equity - a.equity);
      storage.setItem(scoresKey, JSON.stringify(list.slice(0, 12)));
    }

    function snapshotStock(s) {
      const prev = s.prevPrice || s.price;
      const change = s.price - prev;
      const pct = prev ? (change / prev) * 100 : 0;
      const dayPct = s.dayOpen ? ((s.price - s.dayOpen) / s.dayOpen) * 100 : 0;
      const pos = positionMark(s.symbol);
      return {
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        price: s.price,
        prevPrice: prev,
        change,
        pct,
        dayPct,
        volume: s.volume,
        unlocked: isUnlocked(s.symbol),
        unlockRank: s.unlockRank,
        history: s.ticks.toArray(),
        candles: s.candles.slice(),
        liveCandle: stock(s.symbol).candle,
        holding: pos.qty,
        avg: pos.avg,
        unrealizedCents: pos.unrealizedCents,
        pnlPct: pos.pnlPct
      };
    }

    function drainEvents() {
      const ev = state.events.slice();
      state.events.length = 0;
      return ev;
    }

    function getState() {
      const eq = equityCents();
      const hold = holdingsValueCents();
      const unrealized = stocks.reduce((sum, s) => sum + positionMark(s.symbol).unrealizedCents, 0);
      return {
        tick: state.tick,
        day: state.day,
        speed: state.speed,
        paused: state.paused,
        selected: state.selected,
        cash: fromCents(state.cashCents),
        cashCents: state.cashCents,
        holdingsValue: fromCents(hold),
        equity: fromCents(eq),
        equityCents: eq,
        realized: fromCents(state.realizedCents),
        unrealized: fromCents(unrealized),
        sessionPct: sessionPct(),
        rank: RANKS.find((r) => r.id === state.rankId),
        peakEquity: fromCents(state.peakEquityCents),
        won: state.won,
        lost: state.lost,
        news: {
          text: state.news.text,
          hot: state.news.hot && state.tick <= state.news.until
        },
        regime: { id: state.regime.id, label: state.regime.label, left: state.regime.left },
        stocks: stocks.map(snapshotStock),
        orders: state.orders.map((o) => Object.assign({}, o)),
        missions: state.missions.map((m) => Object.assign({}, m)),
        log: state.log.slice(),
        positions: stocks
          .map((s) => Object.assign({ symbol: s.symbol, name: s.name, sector: s.sector }, positionMark(s.symbol)))
          .filter((p) => p.qty > 0)
      };
    }

    function slippedPrice(s, side) {
      const slip = 1 + (side === 'buy' ? 1 : -1) * s.volatility * 0.04;
      return Math.max(0.01, s.price * slip);
    }

    function validateTrade(side, symbol, qtyRaw, type, limitPrice) {
      const qty = normalizeQty(qtyRaw);
      if (!qty) return { ok: false, reason: 'Enter a quantity greater than zero.' };
      const s = stock(symbol);
      if (!s) return { ok: false, reason: 'Unknown symbol.' };
      if (!isUnlocked(symbol)) return { ok: false, reason: 'Symbol locked. Climb the desk ranks.' };
      if (state.won || state.lost) return { ok: false, reason: 'Session closed. Reset the desk.' };
      const orderType = type || 'market';
      if (orderType !== 'market' && orderType !== 'limit' && orderType !== 'stop') {
        return { ok: false, reason: 'Unknown order type.' };
      }
      if (orderType !== 'market') {
        const px = Number(limitPrice);
        if (!Number.isFinite(px) || px <= 0) return { ok: false, reason: 'Limit/stop needs a price.' };
      }
      if (side === 'buy') {
        const px = orderType === 'market' ? slippedPrice(s, 'buy') : s.price;
        const cost = tradeCostCents(qty, px);
        if (orderType === 'market' && cost > state.cashCents) return { ok: false, reason: 'Insufficient cash.' };
      } else if (side === 'sell') {
        if (state.holdings[symbol].qty + 1e-9 < qty) return { ok: false, reason: 'Not enough shares.' };
      } else {
        return { ok: false, reason: 'Side must be buy or sell.' };
      }
      return { ok: true, qty, stock: s, orderType };
    }

    function place(side, symbol, qtyRaw, type, limitPrice) {
      const check = validateTrade(side, symbol || state.selected, qtyRaw, type, limitPrice);
      if (!check.ok) {
        log(check.reason, 'warn');
        emit('reject', { reason: check.reason, side, symbol });
        return check;
      }
      const { qty, stock: s, orderType } = check;
      if (orderType === 'market') {
        const px = slippedPrice(s, side);
        const result = fillOrder({ symbol: s.symbol, side, qty, type: 'market' }, px, 'MKT');
        refreshRank();
        updateMissions();
        maybeRotateMissions();
        persist();
        return result;
      }
      if (state.orders.length >= MAX_OPEN_ORDERS) {
        const reason = 'Working-order book is full.';
        log(reason, 'warn');
        return { ok: false, reason };
      }
      const order = {
        id: state.nextOrderId++,
        symbol: s.symbol,
        side,
        type: orderType,
        qty,
        price: Number(limitPrice),
        created: state.tick
      };
      state.orders.push(order);
      log(
        'WORKING ' + orderType.toUpperCase() + ' ' + side.toUpperCase() + ' ' + qty + ' ' + s.symbol + ' @ $' + Number(limitPrice).toFixed(2),
        'order'
      );
      emit('order', order);
      persist();
      return { ok: true, order };
    }

    function cancelOrder(id) {
      const before = state.orders.length;
      state.orders = state.orders.filter((o) => o.id !== id);
      if (state.orders.length !== before) {
        log('CANCELED ORDER #' + id, 'order');
        emit('cancel', { id });
        persist();
        return { ok: true };
      }
      return { ok: false, reason: 'Order not found.' };
    }

    function maxBuyQty(symbol) {
      const s = stock(symbol || state.selected);
      if (!s || !isUnlocked(s.symbol) || s.price <= 0) return 0;
      const px = slippedPrice(s, 'buy');
      let qty = normalizeQty(Math.floor((state.cashCents / (px * 100)) * 10000) / 10000);
      while (qty > 0 && tradeCostCents(qty, px) > state.cashCents) {
        qty = normalizeQty(qty - 0.0001);
      }
      return qty;
    }

    function select(symbol) {
      if (!stock(symbol)) return state.selected;
      state.selected = symbol;
      emit('select', { symbol });
      return symbol;
    }

    function setSpeed(speed) {
      const allowed = [1, 2, 5];
      if (!allowed.includes(Number(speed))) return state.speed;
      state.speed = Number(speed);
      return state.speed;
    }

    function setPaused(value) {
      if (state.won || state.lost) {
        state.paused = true;
        return state.paused;
      }
      state.paused = !!value;
      return state.paused;
    }

    function togglePause() {
      return setPaused(!state.paused);
    }

    function tickMarket() {
      const evStart = state.events.length;
      if (state.paused || state.won || state.lost) {
        return { events: drainEvents(), state: getState() };
      }
      state.tick += 1;
      if (state.tick % TICKS_PER_DAY === 0) {
        state.day += 1;
        stocks.forEach((s) => {
          s.dayOpen = s.price;
        });
        emit('day', { day: state.day });
        if (state.day % 3 === 0) payDividends();
      }
      if (state.news.hot && state.tick > state.news.until) {
        state.news.hot = false;
        state.news.text = 'Tape quiet. Watching for the next print.';
      }
      tickPrices();
      processWorkingOrders();
      if (rng() < newsChance * state.regime.newsMul) triggerNews();
      maybeRegime();
      refreshRank();
      updateMissions();
      maybeRotateMissions();
      checkTerminal();
      if (state.tick % 8 === 0) persist();
      return { events: drainEvents(), state: getState(), started: evStart };
    }

    function serialize() {
      const prices = {};
      stocks.forEach((s) => {
        prices[s.symbol] = {
          price: s.price,
          base: s.base,
          shock: s.shock,
          impact: s.impact,
          dayOpen: s.dayOpen,
          history: s.ticks.toArray().slice(-60)
        };
      });
      return {
        v: SAVE_VERSION,
        cashCents: state.cashCents,
        startingCashCents: state.startingCashCents,
        holdings: state.holdings,
        realizedCents: state.realizedCents,
        tick: state.tick,
        day: state.day,
        selected: state.selected,
        rankId: state.rankId,
        peakEquityCents: state.peakEquityCents,
        won: state.won,
        lost: state.lost,
        news: state.news,
        regime: state.regime,
        orders: state.orders,
        nextOrderId: state.nextOrderId,
        stats: state.stats,
        missions: state.missions,
        prices
      };
    }

    function restore(data) {
      if (!data || data.v !== SAVE_VERSION) return false;
      state.cashCents = data.cashCents;
      state.startingCashCents = data.startingCashCents || state.startingCashCents;
      state.holdings = data.holdings || state.holdings;
      state.realizedCents = data.realizedCents || 0;
      state.tick = data.tick || 0;
      state.day = data.day || 1;
      state.selected = data.selected || state.selected;
      state.rankId = data.rankId || 'INTERN';
      state.peakEquityCents = data.peakEquityCents || state.cashCents;
      state.won = !!data.won;
      state.lost = !!data.lost;
      state.news = data.news || state.news;
      state.regime = data.regime || state.regime;
      state.orders = data.orders || [];
      state.nextOrderId = data.nextOrderId || 1;
      state.stats = data.stats || state.stats;
      state.missions = data.missions || state.missions;
      if (state.won || state.lost) state.paused = true;
      stocks.forEach((s) => {
        const saved = data.prices && data.prices[s.symbol];
        if (!saved) return;
        s.price = saved.price;
        s.base = saved.base;
        s.shock = saved.shock || 0;
        s.impact = saved.impact || 0;
        s.dayOpen = saved.dayOpen || saved.price;
        s.ticks = createRing(HISTORY_LEN);
        (saved.history || [saved.price]).forEach((p) => s.ticks.push(p));
        s.prevPrice = s.ticks.prev() || s.price;
        s.candle = { o: s.price, h: s.price, l: s.price, c: s.price, v: 0 };
        s.candleTicks = 0;
      });
      return true;
    }

    function persist() {
      if (!storage || typeof storage.setItem !== 'function') return;
      try {
        storage.setItem(persistKey, JSON.stringify(serialize()));
      } catch (err) {
        /* quota / private mode */
      }
    }

    function load() {
      if (!storage || typeof storage.getItem !== 'function') return false;
      try {
        const raw = storage.getItem(persistKey);
        if (!raw) return false;
        return restore(JSON.parse(raw));
      } catch (err) {
        return false;
      }
    }

    function reset() {
      const fresh = createGame({
        rng,
        startingCash,
        winEquity,
        bankruptEquity,
        persistKey,
        scoresKey,
        storage,
        newsChance,
        regimeChance,
        alias: opt.alias
      });
      if (storage && typeof storage.removeItem === 'function') {
        try {
          storage.removeItem(persistKey);
        } catch (err) {
          /* ignore */
        }
      }
      return fresh;
    }

    function scores() {
      if (!storage) return [];
      try {
        const list = JSON.parse(storage.getItem(scoresKey) || '[]');
        return Array.isArray(list) ? list : [];
      } catch (err) {
        return [];
      }
    }

    function forceNews(event) {
      applyNews(event || pick(rng, NEWS_EVENTS));
    }

    if (opt.autoload) load();

    log('Welcome to TERMINAL TRADER. Simulated capital only.', 'sys');
    log('Buy the dip, fade the rip, clear $' + winEquity.toLocaleString('en-US') + '.', 'sys');

    return {
      tickMarket,
      buy(qty, type, price, symbol) {
        return place('buy', symbol || state.selected, qty, type, price);
      },
      sell(qty, type, price, symbol) {
        return place('sell', symbol || state.selected, qty, type, price);
      },
      cancelOrder,
      select,
      setSpeed,
      setPaused,
      togglePause,
      maxBuyQty,
      getState,
      serialize,
      restore,
      persist,
      load,
      reset,
      scores,
      recordScore,
      drainEvents,
      forceNews,
      isUnlocked,
      stock,
      validateTrade
    };
  }

  return {
    createGame,
    mulberry32,
    toCents,
    fromCents,
    normalizeQty,
    tradeCostCents,
    rankForEquity,
    unlockedSet,
    RANKS,
    UNIVERSE,
    NEWS_EVENTS,
    REGIMES,
    MISSIONS,
    STARTING_CASH,
    WIN_EQUITY,
    BANKRUPT_EQUITY,
    HISTORY_LEN,
    TICKS_PER_DAY
  };
});
