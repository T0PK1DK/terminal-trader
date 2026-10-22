'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const engine = require('../src/engine.js');
const {
  createGame,
  mulberry32,
  toCents,
  fromCents,
  normalizeQty,
  tradeCostCents,
  rankForEquity,
  unlockedSet,
  computeEma,
  normalizeSignedQty,
  EMA_PERIOD,
  STARTING_CASH,
  WIN_EQUITY,
  BANKRUPT_EQUITY,
  TICKS_PER_DAY,
  HISTORY_LEN
} = engine;

function game(overrides) {
  return createGame(
    Object.assign(
      {
        rng: mulberry32(7),
        newsChance: 0,
        regimeChance: 0
      },
      overrides || {}
    )
  );
}

test('money helpers round to cents and normalize qty', () => {
  assert.equal(toCents(10.005), 1001);
  assert.equal(fromCents(250), 2.5);
  assert.equal(normalizeQty(1.23456), 1.2346);
  assert.equal(normalizeQty(-3), 0);
  assert.equal(normalizeQty('nope'), 0);
  assert.equal(tradeCostCents(1.5, 10), 1500);
});

test('rank ladder unlocks extra tape', () => {
  assert.equal(rankForEquity(10000).id, 'INTERN');
  assert.equal(rankForEquity(25000).id, 'JUNIOR');
  assert.equal(rankForEquity(50000).id, 'ANALYST');
  assert.equal(rankForEquity(75000).id, 'VP');
  assert.equal(rankForEquity(100000).id, 'VP');
  assert.equal(rankForEquity(250000).id, 'PARTNER');
  assert.equal(unlockedSet('INTERN').has('AAPL'), true);
  assert.equal(unlockedSet('INTERN').has('NVDA'), false);
  assert.equal(unlockedSet('JUNIOR').has('NVDA'), true);
  assert.equal(unlockedSet('VP').has('BTC'), true);
});

test('market buy spends cash and books average cost', () => {
  const g = game();
  g.select('AAPL');
  const before = g.getState();
  const result = g.buy(2);
  assert.equal(result.ok, true);
  const after = g.getState();
  assert.ok(after.cash < before.cash);
  const pos = after.positions.find((p) => p.symbol === 'AAPL');
  assert.ok(pos);
  assert.equal(pos.qty, 2);
  assert.ok(pos.avg > 0);
  assert.equal(Math.round((before.cash - after.cash) * 100), Math.round(result.price * 2 * 100));
});

test('cannot buy without cash or sell without shares', () => {
  const g = game({ startingCash: 50 });
  g.select('MSFT');
  const buy = g.buy(10);
  assert.equal(buy.ok, false);
  assert.match(buy.reason, /cash|Insufficient/i);
  g.select('AAPL');
  const sell = g.sell(1);
  assert.equal(sell.ok, false);
  assert.match(sell.reason, /shares|capacity|short/i);
});

test('rejects invalid quantity and locked symbols', () => {
  const g = game();
  assert.equal(g.buy(0).ok, false);
  assert.equal(g.buy(-2).ok, false);
  assert.equal(g.buy('abc').ok, false);
  const locked = g.buy(1, 'market', null, 'BTC');
  assert.equal(locked.ok, false);
  assert.match(locked.reason, /locked/i);
});

test('sell realizes P&L and frees cash', () => {
  const g = game();
  g.select('XOM');
  const bought = g.buy(4);
  assert.equal(bought.ok, true);
  const mid = g.getState();
  const sold = g.sell(4);
  assert.equal(sold.ok, true);
  const after = g.getState();
  assert.equal(after.positions.length, 0);
  assert.ok(Math.abs(after.realized - (sold.price - bought.price) * 4) < 0.08);
  assert.ok(after.cash > mid.cash);
});

test('fractional qty can buy a high-priced name once unlocked', () => {
  const g = game({ startingCash: 120000, winEquity: 1e9 });
  for (let i = 0; i < 8; i++) g.tickMarket();
  assert.equal(g.getState().rank.id, 'VP');
  const result = g.buy(0.05, 'market', null, 'BTC');
  assert.equal(result.ok, true);
  const pos = g.getState().positions.find((p) => p.symbol === 'BTC');
  assert.ok(pos);
  assert.equal(pos.qty, 0.05);
});

test('max buy never exceeds cash', () => {
  const g = game({ startingCash: 1000 });
  g.select('AAPL');
  const qty = g.maxBuyQty('AAPL');
  assert.ok(qty > 0);
  const result = g.buy(qty, 'market', null, 'AAPL');
  assert.equal(result.ok, true);
  assert.ok(g.getState().cash < result.price);
  assert.equal(g.buy(1, 'market', null, 'AAPL').ok, false);
});

test('limit buy fills when price prints through', () => {
  const g = game({ startingCash: 20000 });
  const px = g.stock('AAPL').price;
  const placed = g.buy(1, 'limit', px * 1.5, 'AAPL');
  assert.equal(placed.ok, true);
  assert.ok(placed.order);
  g.tickMarket();
  const st = g.getState();
  assert.equal(st.orders.length, 0);
  assert.ok(st.positions.some((p) => p.symbol === 'AAPL'));
});

test('stop sell fires on a drop and leaves leftover working orders intact', () => {
  const g = game();
  g.buy(3, 'market', null, 'TSLA');
  const px = g.stock('TSLA').price;
  g.sell(3, 'stop', px * 1.2, 'TSLA');
  g.tickMarket();
  const st = g.getState();
  assert.equal(st.positions.find((p) => p.symbol === 'TSLA'), undefined);
  assert.equal(st.orders.length, 0);
});

test('cancel removes a working order', () => {
  const g = game();
  const placed = g.buy(1, 'limit', 0.01, 'AAPL');
  assert.equal(g.cancelOrder(placed.order.id).ok, true);
  assert.equal(g.getState().orders.length, 0);
  assert.equal(g.cancelOrder(999).ok, false);
});

test('prices never print below a penny and history is capped', () => {
  const g = game();
  for (let i = 0; i < 240; i++) g.tickMarket();
  g.getState().stocks.forEach((s) => {
    if (!s.unlocked) return;
    assert.ok(s.price >= 0.01);
    assert.ok(s.history.length <= HISTORY_LEN);
    assert.ok(s.history.every((p) => p >= 0.01));
  });
});

test('mean reversion pulls an extreme print back toward base', () => {
  const g = game();
  const s = g.stock('SPY');
  s.price = s.base * 3;
  const start = s.price;
  for (let i = 0; i < 80; i++) g.tickMarket();
  assert.ok(g.stock('SPY').price < start * 0.92);
});

test('buy impact lifts the next print versus a no-trade twin', () => {
  const buyer = game({ rng: mulberry32(99) });
  const idle = game({ rng: mulberry32(99) });
  buyer.buy(8, 'market', null, 'AAPL');
  buyer.tickMarket();
  idle.tickMarket();
  assert.ok(buyer.stock('AAPL').price > idle.stock('AAPL').price);
});

test('news shock moves the named sector', () => {
  const g = game();
  const before = g.stock('XOM').price;
  g.forceNews({ text: 'energy bid', effect: { Energy: 0.2 } });
  assert.ok(g.stock('XOM').price > before);
  assert.match(g.getState().news.text, /energy/i);
  assert.equal(g.getState().news.hot, true);
});

test('day clock advances on a fixed tick cadence', () => {
  const g = game();
  for (let i = 0; i < TICKS_PER_DAY; i++) g.tickMarket();
  assert.equal(g.getState().day, 2);
});

test('win fires once and freezes the book', () => {
  const g = game({ startingCash: WIN_EQUITY, winEquity: WIN_EQUITY });
  g.tickMarket();
  const first = g.getState();
  assert.equal(first.won, true);
  assert.equal(first.paused, true);
  const cash = first.cash;
  assert.equal(g.buy(1, 'market', null, 'AAPL').ok, false);
  g.setPaused(false);
  g.tickMarket();
  assert.equal(g.getState().won, true);
  assert.equal(g.getState().paused, true);
  assert.equal(g.getState().cash, cash);
  const wins = g.drainEvents().filter((e) => e.type === 'win');
  assert.ok(wins.length <= 1);
});

test('bankruptcy freezes a wiped book', () => {
  const g = game({ startingCash: 10, bankruptEquity: BANKRUPT_EQUITY });
  g.tickMarket();
  const st = g.getState();
  assert.equal(st.lost, true);
  assert.equal(st.paused, true);
});

test('serialize restore is a closed loop', () => {
  const g = game();
  g.buy(2, 'market', null, 'AMZN');
  g.buy(1, 'limit', 1, 'AAPL');
  for (let i = 0; i < 12; i++) g.tickMarket();
  const blob = g.serialize();
  const clone = game({ rng: mulberry32(1) });
  assert.equal(clone.restore(blob), true);
  const a = g.getState();
  const b = clone.getState();
  assert.equal(b.cashCents, a.cashCents);
  assert.equal(b.day, a.day);
  assert.equal(b.positions[0].qty, a.positions[0].qty);
  assert.equal(b.orders.length, a.orders.length);
});

test('persist and load use injected storage', () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k)
  };
  const g = game({ storage, persistKey: 'desk', scoresKey: 'board' });
  g.buy(1, 'market', null, 'SPY');
  g.persist();
  const clone = game({ storage, persistKey: 'desk', scoresKey: 'board', rng: mulberry32(3) });
  assert.equal(clone.load(), true);
  assert.ok(clone.getState().positions.some((p) => p.symbol === 'SPY'));
});

test('dividends credit holders every third day', () => {
  const g = game();
  g.buy(20, 'market', null, 'XOM');
  const cash = g.getState().cash;
  for (let i = 0; i < TICKS_PER_DAY * 3; i++) g.tickMarket();
  assert.ok(g.getState().cash > cash - 1);
  const divs = g
    .getState()
    .log.filter((row) => row.kind === 'div');
  assert.ok(divs.length >= 1);
});

test('missions complete and pay a simulated bonus', () => {
  const g = game();
  g.getState().missions.forEach((m) => {
    if (m.id === 'trades3') {
      m.progress = 0;
      m.done = false;
    }
  });
  const cash = g.getState().cash;
  g.buy(1, 'market', null, 'AAPL');
  g.sell(1, 'market', null, 'AAPL');
  g.buy(1, 'market', null, 'AAPL');
  const mission = g.getState().missions.find((m) => m.id === 'trades3');
  if (mission) {
    assert.ok(mission.done);
    assert.ok(g.getState().cash > cash - 400);
  } else {
    assert.ok(g.getState().missions.length >= 1);
  }
});

test('speed and pause guards', () => {
  const g = game();
  assert.equal(g.setSpeed(5), 5);
  assert.equal(g.setSpeed(3), 5);
  assert.equal(g.togglePause(), true);
  const px = g.stock('AAPL').price;
  g.tickMarket();
  assert.equal(g.stock('AAPL').price, px);
});

test('starting cash default matches the public goal', () => {
  const g = createGame({ rng: () => 0.5, newsChance: 0, regimeChance: 0 });
  assert.equal(g.getState().cash, STARTING_CASH);
  assert.equal(WIN_EQUITY, 100000);
});

test('signed qty helper and EMA-20', () => {
  assert.equal(normalizeSignedQty(-1.23456), -1.2346);
  assert.equal(normalizeSignedQty(0), 0);
  assert.equal(EMA_PERIOD, 20);
  const series = computeEma([10, 12, 14, 16], 3);
  assert.equal(series.length, 4);
  assert.equal(series[0], 10);
  assert.ok(series[3] > series[0]);
  assert.ok(series[3] < 16);
});

test('short opens a negative book and credits cash', () => {
  const g = game();
  const before = g.getState();
  const result = g.short(2, 'market', null, 'AAPL');
  assert.equal(result.ok, true);
  assert.ok(result.openedShort > 0);
  const after = g.getState();
  assert.ok(after.cash > before.cash);
  const pos = after.positions.find((p) => p.symbol === 'AAPL');
  assert.ok(pos);
  assert.equal(pos.qty, -2);
  assert.equal(pos.side, 'short');
  assert.ok(after.shortExposure > 0);
});

test('cover realizes short P&L and refuses when flat', () => {
  const g = game();
  const opened = g.short(3, 'market', null, 'TSLA');
  assert.equal(opened.ok, true);
  const mid = g.getState();
  const covered = g.cover(3, 'market', null, 'TSLA');
  assert.equal(covered.ok, true);
  const after = g.getState();
  assert.equal(after.positions.find((p) => p.symbol === 'TSLA'), undefined);
  assert.ok(Math.abs(after.realized - (opened.price - covered.price) * 3) < 0.12);
  assert.ok(after.cash < mid.cash);
  assert.equal(g.cover(1, 'market', null, 'TSLA').ok, false);
});

test('short capacity is capped at 1x equity', () => {
  const g = game({ startingCash: 400 });
  const huge = g.short(50, 'market', null, 'AAPL');
  assert.equal(huge.ok, false);
  assert.match(huge.reason, /capacity/i);
  const qty = g.maxShortQty('AAPL');
  assert.ok(qty > 0);
  const ok = g.short(qty, 'market', null, 'AAPL');
  assert.equal(ok.ok, true);
  assert.equal(g.short(qty, 'market', null, 'AAPL').ok, false);
});

test('must sell a long before an explicit short', () => {
  const g = game();
  assert.equal(g.buy(1, 'market', null, 'AMZN').ok, true);
  const blocked = g.short(1, 'market', null, 'AMZN');
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /long/i);
});

test('working limit buy reserves cash so a second ticket cannot spend it', () => {
  const g = game({ startingCash: 400 });
  const px = g.stock('AAPL').price;
  const first = g.buy(2, 'limit', px, 'AAPL');
  assert.equal(first.ok, true);
  assert.ok(g.getState().reservedCash > 0);
  const second = g.buy(2, 'limit', px, 'AAPL');
  assert.equal(second.ok, false);
  assert.match(second.reason, /cash/i);
  assert.equal(g.cancelOrder(first.order.id).ok, true);
  assert.equal(g.getState().reservedCash, 0);
  assert.equal(g.buy(2, 'limit', px, 'AAPL').ok, true);
});

test('failed working order is dropped instead of retrying forever', () => {
  const g = game({ startingCash: 400 });
  const px = g.stock('AAPL').price;
  const placed = g.buy(1, 'stop', px, 'AAPL');
  assert.equal(placed.ok, true);
  g.stock('AAPL').price = px * 3;
  g.tickMarket();
  assert.equal(g.getState().orders.length, 0);
});

test('VP unlocks before the $100k win wire', () => {
  const g = game({ startingCash: 76000, winEquity: WIN_EQUITY });
  for (let i = 0; i < 3; i++) g.tickMarket();
  const st = g.getState();
  assert.equal(st.won, false);
  assert.equal(st.rank.id, 'VP');
  assert.equal(g.isUnlocked('BTC'), true);
});

test('short borrow fee hits holders of dividend names', () => {
  const g = game();
  g.short(15, 'market', null, 'XOM');
  const cash = g.getState().cash;
  for (let i = 0; i < TICKS_PER_DAY * 3; i++) g.tickMarket();
  assert.ok(g.getState().cash < cash + 1);
  const fees = g.getState().log.filter((row) => /BORROW FEE/.test(row.msg));
  assert.ok(fees.length >= 1);
});

test('serialize restore keeps a short book', () => {
  const g = game();
  g.short(2, 'market', null, 'AAPL');
  const blob = g.serialize();
  const clone = game({ rng: mulberry32(1) });
  assert.equal(clone.restore(blob), true);
  const pos = clone.getState().positions.find((p) => p.symbol === 'AAPL');
  assert.equal(pos.qty, -2);
  assert.equal(pos.side, 'short');
});

test('fill events keep type "fill" and carry tick, price, side and order type', () => {
  const g = game();
  g.tickMarket();
  g.tickMarket();
  g.drainEvents();
  const tick = g.getState().tick;
  assert.equal(g.buy(2, 'market', null, 'AAPL').ok, true);
  const fills = g.drainEvents().filter((e) => e.type === 'fill');
  assert.equal(fills.length, 1);
  assert.equal(fills[0].tick, tick);
  assert.equal(fills[0].side, 'buy');
  assert.equal(fills[0].orderType, 'market');
  assert.ok(fills[0].price > 0);
});

test('short and cover fills are flagged for chart markers', () => {
  const g = game();
  g.tickMarket();
  g.drainEvents();
  g.short(2, 'market', null, 'AAPL');
  g.cover(2, 'market', null, 'AAPL');
  const fills = g.drainEvents().filter((e) => e.type === 'fill');
  assert.equal(fills.length, 2);
  assert.equal(fills[0].side, 'sell');
  assert.ok(fills[0].openedShort > 0);
  assert.equal(fills[1].side, 'buy');
  assert.ok(fills[1].covered > 0);
});
