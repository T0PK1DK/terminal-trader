'use strict';

(function () {
  const TT = window.TerminalTrader;
  const audio = window.TerminalAudio.createAudio();
  const storage = window.localStorage;
  const gameHolder = { current: null };
  let raf = 0;
  let lastTickAt = 0;
  let intervalId = 0;
  let chartDirty = true;
  let chartSize = { w: 0, h: 0, dpr: 1 };
  let hover = null;
  let bootDone = false;
  let showEma = true;
  // Fill markers: one glyph per fill at its tick and price (UI-only; fed from the 'fill' event stream).
  let showFills = true;
  const fillMarks = [];
  const FILL_MARK_CAP = 240;
  let markTick = -1;
  let fxSized = { w: 0, h: 0, dpr: 1 };
  const cardRefs = new Map();
  const tapeRefs = { built: 0, nodes: [] };
  const dirtyHash = { missions: '', book: '', news: '' };
  const tween = { cash: 10000, equity: 10000, hold: 0 };
  const particles = [];
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Chart easing: the newest print glides in and the y-range eases instead of snapping.
  const view = { symbol: '', mode: '', tick: -1, len: 0, from: 0, to: 0, shown: 0, at: 0, ms: 0, shift: false, min: 0, max: 0, settled: true, quotePx: 0 };

  function game() {
    return gameHolder.current;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function fmt(n, d) {
    const dec = d == null ? 2 : d;
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function money(n) {
    return (n <= -0.005 ? '-$' : '$') + fmt(Math.abs(n), 2);
  }

  function clsDelta(n) {
    return n >= 0 ? 'positive' : 'negative';
  }

  function signed(n, d) {
    const v = fmt(n, d == null ? 2 : d);
    return (n >= 0 ? '+' : '') + v;
  }

  function toast(msg) {
    const wrap = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function burst(x, y, up) {
    for (let i = 0; i < 18; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 1,
        life: 1,
        color: up ? '#3dff9a' : '#ff4d6d'
      });
    }
  }

  function drawFx(ts) {
    const canvas = $('fx');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    if (fxSized.w !== cssW || fxSized.h !== cssH || fxSized.dpr !== dpr) {
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      fxSized = { w: cssW, h: cssH, dpr };
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.02;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(drawFx);
    if (bootDone) renderFrame(ts);
  }

  function ensureWatch(state) {
    const root = $('watch');
    if (cardRefs.size === state.stocks.length) return;
    root.innerHTML = '';
    cardRefs.clear();
    state.stocks.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'watch-row';
      row.dataset.symbol = s.symbol;
      row.innerHTML =
        '<div><div class="sym"></div><div class="meta"></div></div>' +
        '<canvas class="spark" width="112" height="44"></canvas>' +
        '<div class="px"></div><div class="chg"></div>';
      row.addEventListener('click', () => {
        if (!s.unlocked && !game().isUnlocked(s.symbol)) {
          toast('LOCKED · climb the desk ranks');
          audio.warn();
          return;
        }
        game().select(s.symbol);
        $('stockSelect').value = s.symbol;
        chartDirty = true;
        syncTicket();
        paintWatch(game().getState());
      });
      root.appendChild(row);
      cardRefs.set(s.symbol, {
        row,
        sym: row.querySelector('.sym'),
        meta: row.querySelector('.meta'),
        px: row.querySelector('.px'),
        chg: row.querySelector('.chg'),
        spark: row.querySelector('.spark')
      });
    });
  }

  function drawSpark(canvas, history, up) {
    const last = history && history.length ? history[history.length - 1] : 0;
    if (canvas.dataset.last === String(last) && canvas.dataset.up === String(up)) return;
    canvas.dataset.last = String(last);
    canvas.dataset.up = String(up);
    const ctx = canvas.getContext('2d');
    const dpr = 2;
    if (canvas.width !== 56 * dpr) {
      canvas.width = 56 * dpr;
      canvas.height = 22 * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 56, 22);
    if (!history || history.length < 2) return;
    const slice = history.length > 24 ? history.slice(-24) : history;
    const min = Math.min.apply(null, slice);
    const max = Math.max.apply(null, slice);
    const range = max - min || 1;
    ctx.beginPath();
    slice.forEach((p, i) => {
      const x = (i / (slice.length - 1)) * 56;
      const y = 20 - ((p - min) / range) * 18;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = up ? '#3dff9a' : '#ff4d6d';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function paintWatch(state) {
    ensureWatch(state);
    state.stocks.forEach((s) => {
      const ref = cardRefs.get(s.symbol);
      if (!ref) return;
      const selected = s.symbol === state.selected;
      ref.row.classList.toggle('selected', selected);
      ref.row.classList.toggle('locked', !s.unlocked);
      ref.sym.textContent = s.symbol;
      ref.meta.textContent = s.unlocked ? s.sector : 'LOCK ' + s.unlockRank;
      ref.px.textContent = s.unlocked ? money(s.price) : '••••';
      ref.chg.textContent = s.unlocked ? signed(s.pct, 2) + '%' : '—';
      ref.chg.className = 'chg ' + clsDelta(s.pct);
      if (s.unlocked) drawSpark(ref.spark, s.history, s.pct >= 0);
      if (s.unlocked && ref.lastPx != null && ref.lastPx !== s.price) {
        const flash = s.price >= ref.lastPx ? 'flash-up' : 'flash-down';
        ref.row.classList.remove('flash-up', 'flash-down');
        void ref.row.offsetWidth;
        ref.row.classList.add(flash);
      }
      ref.lastPx = s.price;
    });
  }

  function paintTape(state) {
    const unlocked = state.stocks.filter((s) => s.unlocked);
    const tape = $('tape');
    if (tapeRefs.built !== unlocked.length) {
      tape.innerHTML = '';
      tapeRefs.nodes = [];
      const make = () =>
        unlocked.map((s) => {
          const wrap = document.createElement('span');
          wrap.dataset.symbol = s.symbol;
          const b = document.createElement('b');
          b.textContent = s.symbol;
          const px = document.createElement('span');
          wrap.appendChild(b);
          wrap.appendChild(px);
          tape.appendChild(wrap);
          return { wrap, px, symbol: s.symbol };
        });
      tapeRefs.nodes = make().concat(make());
      tapeRefs.built = unlocked.length;
    }
    const bySym = Object.create(null);
    unlocked.forEach((s) => {
      bySym[s.symbol] = s;
    });
    tapeRefs.nodes.forEach((node) => {
      const s = bySym[node.symbol];
      if (!s) return;
      node.px.className = s.pct >= 0 ? 'up' : 'down';
      node.px.textContent = money(s.price) + ' ' + signed(s.pct, 2) + '%';
    });
  }

  function resizeChart() {
    const canvas = $('chart');
    const wrap = $('chart-wrap');
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === chartSize.w && h === chartSize.h && dpr === chartSize.dpr) return;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    chartSize = { w, h, dpr };
    chartDirty = true;
  }

  function selectedStock(state) {
    return state.stocks.find((s) => s.symbol === state.selected) || state.stocks[0];
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Called once per simulation tick: queue a glide from the price on screen to the new print.
  function noteTick(state) {
    const stock = selectedStock(state);
    const data = stock.history;
    const last = data.length ? data[data.length - 1] : 0;
    if (stock.symbol !== view.symbol) {
      view.symbol = stock.symbol;
      view.tick = state.tick;
      view.len = data.length;
      view.from = view.to = view.shown = last;
      view.at = 0;
      view.settled = false;
      view.min = view.max = 0;
      return;
    }
    if (state.tick === view.tick) return;
    view.tick = state.tick;
    view.shift = data.length === view.len;
    view.len = data.length;
    view.from = view.shown || last;
    view.to = last;
    view.at = reduceMotion ? 0 : performance.now();
    view.ms = Math.min(650, 850 / (state.speed || 1));
    view.settled = false;
  }

  function addFillMark(ev) {
    if (!ev.symbol || !(ev.price > 0)) return;
    const kind = ev.openedShort ? 'short' : ev.covered ? 'cover' : ev.side === 'buy' ? 'buy' : 'sell';
    fillMarks.push({ symbol: ev.symbol, tick: ev.tick || 0, price: ev.price, qty: ev.qty, side: ev.side, kind, born: performance.now() });
    if (fillMarks.length > FILL_MARK_CAP) fillMarks.splice(0, fillMarks.length - FILL_MARK_CAP);
  }

  const MARK_LETTER = { buy: 'B', sell: 'S', short: 'SH', cover: 'CV' };

  // Shared broker pattern: buys ▲ under the print (green), sells ▼ over it (red), qty letter beside it.
  function drawFillMarks(ctx, state, stock, geo) {
    if (state.tick < markTick) fillMarks.length = 0; // new game
    markTick = state.tick;
    if (!showFills || !fillMarks.length) return null;
    const { pad, innerW, yOf, n, offset, candleMode, candleCount, up, down, font, bg, ts, hover } = geo;
    const placed = [];
    const stack = {};
    for (let k = 0; k < fillMarks.length; k++) {
      const m = fillMarks[k];
      if (m.symbol !== stock.symbol) continue;
      const ago = Math.max(0, state.tick - m.tick);
      let x;
      if (candleMode) {
        const ci = candleCount - 1 - Math.floor(ago / 5);
        if (ci < 0) continue;
        x = pad.l + (ci + 0.5) * (innerW / candleCount);
      } else {
        const i = n - 1 - ago;
        if (i < 0) continue;
        x = i === n - 1 ? pad.l + innerW : pad.l + (i / (n - 1)) * innerW + offset;
      }
      const isBuy = m.side === 'buy';
      const key = Math.round(x) + (isBuy ? 'b' : 's');
      const lane = (stack[key] = (stack[key] || 0) + 1) - 1;
      const py = yOf(m.price);
      const dir = isBuy ? 1 : -1;
      const gy = py + dir * (9 + lane * 13);
      placed.push({ m, x, py, gy, dir, isBuy });
    }
    if (!placed.length) return null;
    ctx.save();
    ctx.font = '700 10px ' + font;
    let near = null;
    placed.forEach((p) => {
      const col = p.isBuy ? up : down;
      const age = ts - p.m.born;
      const pop = reduceMotion || age > 360 ? 1 : 0.6 + 0.4 * easeOut(Math.max(0, age) / 360);
      const s = 6 * pop;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.py);
      ctx.lineTo(p.x, p.gy - p.dir * s);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.py, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      // ▲ tip points at the price from below; ▼ from above
      ctx.moveTo(p.x, p.gy - p.dir * s);
      ctx.lineTo(p.x - s, p.gy + p.dir * s * 0.8);
      ctx.lineTo(p.x + s, p.gy + p.dir * s * 0.8);
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = bg;
      ctx.stroke();
      ctx.fill();
      if (p.m.kind === 'short' || p.m.kind === 'cover') {
        ctx.fillStyle = bg;
        ctx.fillRect(p.x - 1, p.gy - 1, 2, 2);
      }
      const letter = MARK_LETTER[p.m.kind];
      ctx.fillStyle = col;
      const lx = p.x + 8;
      if (lx + 14 < pad.l + innerW + 4) ctx.fillText(letter, lx, p.gy + 3);
      if (hover && Math.abs(hover.x - p.x) < 8 && Math.abs(hover.y - p.gy) < 12) near = p;
    });
    ctx.restore();
    return near;
  }

  function fillMarksAnimating(ts) {
    if (reduceMotion || !showFills) return false;
    for (let k = fillMarks.length - 1; k >= 0 && k >= fillMarks.length - 4; k--) if (ts - fillMarks[k].born < 380) return true;
    return false;
  }

  function chartAnimating(ts) {
    return !view.settled || (view.at && ts - view.at < view.ms) || fillMarksAnimating(ts);
  }

  function drawChart(state, now) {
    const canvas = $('chart');
    const ctx = canvas.getContext('2d');
    const { w, h, dpr } = chartSize;
    if (!w || !h) return;
    const ts = now || performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const stock = selectedStock(state);
    const mode = document.querySelector('[data-chart].active')?.dataset.chart || 'line';
    const data = stock.history;
    const dot = $('lastDot');
    if (!stock.unlocked || data.length < 2) {
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted');
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(stock.unlocked ? 'WAITING FOR PRINTS…' : 'SYMBOL LOCKED', 16, 28);
      dot.style.display = 'none';
      $('chartLegend').innerHTML = '';
      view.legend = '';
      view.settled = true;
      chartDirty = false;
      return;
    }
    if (view.symbol !== stock.symbol) noteTick(state);
    const style = getComputedStyle(document.body);
    const up = style.getPropertyValue('--up').trim();
    const down = style.getPropertyValue('--down').trim();
    const muted = style.getPropertyValue('--muted').trim();
    const cyan = style.getPropertyValue('--cyan').trim() || '#4de6ff';
    const font = style.getPropertyValue('--font').trim() || 'ui-monospace, monospace';

    // glide progress for the newest print
    const raw = view.at && view.ms ? clamp((ts - view.at) / view.ms, 0, 1) : 1;
    const e = easeOut(raw);
    const last = data[data.length - 1];
    const shownLast = view.from + (last - view.from) * e;
    view.shown = shownLast;
    const first = data[0];
    const bull = last >= first;
    const color = bull ? up : down;
    const narrow = w < 420;
    const pad = { l: 8, r: narrow ? 58 : 70, t: 14, b: 22 };
    const candles = stock.candles.concat([stock.liveCandle]).filter(Boolean);
    const candleMode = mode === 'candle' && candles.length;
    const series = candleMode ? candles.map((c) => c.c) : data;
    let lo = Infinity;
    let hi = -Infinity;
    if (candleMode) {
      candles.forEach((c) => {
        if (c.l < lo) lo = c.l;
        if (c.h > hi) hi = c.h;
      });
    } else {
      for (let i = 0; i < data.length; i++) {
        if (data[i] < lo) lo = data[i];
        if (data[i] > hi) hi = data[i];
      }
    }
    // a little headroom so the line never kisses the frame
    const headroom = (hi - lo || hi * 0.01 || 1) * 0.08;
    const tMin = lo - headroom;
    const tMax = hi + headroom;
    if (mode !== view.mode || !view.max || reduceMotion) {
      view.min = tMin;
      view.max = tMax;
      view.mode = mode;
    } else {
      const dt = Math.min(64, ts - (view.lastDraw || ts));
      // widen quickly so prints never leave the frame, tighten slowly so it doesn't breathe
      const ease = (target, cur, widen) => cur + (target - cur) * (1 - Math.pow(0.001, dt / (widen ? 120 : 480)));
      view.min = ease(tMin, view.min, tMin < view.min);
      view.max = ease(tMax, view.max, tMax > view.max);
    }
    view.lastDraw = ts;
    const span = tMax - tMin || 1;
    const rangeSettled = Math.abs(view.min - tMin) < span * 0.002 && Math.abs(view.max - tMax) < span * 0.002;
    if (rangeSettled) {
      view.min = tMin;
      view.max = tMax;
    }
    view.settled = rangeSettled && raw >= 1;
    const min = view.min;
    const max = view.max;
    const range = max - min || 1;
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const yOf = (p) => pad.t + (1 - (p - min) / range) * innerH;
    const step = innerW / (data.length - 1);
    // while the ring is full every point slides one slot left as the new print lands
    const offset = !candleMode && view.shift ? (1 - e) * step : 0;
    const xOf = (i, n) => pad.l + (i / (n - 1)) * innerW;

    ctx.font = '10px ' + font;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = muted;
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(pad.t + (innerH / 4) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      const p = max - (range / 4) * i;
      ctx.fillText(p.toFixed(2), w - pad.r + 6, y + 3);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, 0, innerW, h);
    ctx.clip();

    if (candleMode) {
      const slot = innerW / candles.length;
      const bw = Math.max(2, slot * 0.68);
      candles.forEach((c, i) => {
        const x = Math.round(pad.l + (i + 0.5) * slot) + 0.5;
        const cUp = c.c >= c.o;
        ctx.strokeStyle = cUp ? up : down;
        ctx.fillStyle = cUp ? up : down;
        ctx.beginPath();
        ctx.moveTo(x, yOf(c.h));
        ctx.lineTo(x, yOf(c.l));
        ctx.stroke();
        const top = yOf(Math.max(c.o, c.c));
        const bot = yOf(Math.min(c.o, c.c));
        ctx.globalAlpha = i === candles.length - 1 ? 0.7 : 1;
        ctx.fillRect(x - bw / 2, top, bw, Math.max(1, bot - top));
        ctx.globalAlpha = 1;
      });
    } else {
      const n = data.length;
      const px = (i) => (i === n - 1 ? pad.l + innerW : xOf(i, n) + offset);
      const py = (i) => yOf(i === n - 1 ? shownLast : data[i]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (i === 0) ctx.moveTo(px(i), py(i));
        else ctx.lineTo(px(i), py(i));
      }
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.75;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineTo(pad.l + innerW, h - pad.b);
      ctx.lineTo(px(0), h - pad.b);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
      grad.addColorStop(0, bull ? 'rgba(61,255,154,0.20)' : 'rgba(255,77,109,0.20)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    if (showEma && stock.ema && stock.ema.length > 1) {
      const n = stock.ema.length;
      ctx.beginPath();
      stock.ema.forEach((p, i) => {
        const x = xOf(i, n) + (i === n - 1 ? 0 : offset);
        const y = yOf(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = cyan;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const nearMark = drawFillMarks(ctx, state, stock, {
      pad, innerW, yOf, n: data.length, offset, candleMode, candleCount: candles.length,
      up, down, font, bg: style.getPropertyValue('--bg').trim() || '#04110b', ts, hover
    });
    ctx.restore();

    // Entry + working-order lines: price under your short's line reads as winning at a glance.
    const levels = [];
    if (stock.holding && stock.avg) {
      const pnl = stock.unrealizedCents / 100;
      levels.push({
        price: stock.avg,
        color: style.getPropertyValue('--amber').trim() || '#ffc14a',
        label: (stock.side === 'short' ? 'SHORT ' : 'LONG ') + String(Math.abs(stock.holding)) + ' @ ' + stock.avg.toFixed(2),
        tail: (pnl >= 0 ? '+' : '') + money(pnl),
        tailColor: pnl >= 0 ? up : down
      });
    }
    state.orders.forEach((o) => {
      if (o.symbol !== stock.symbol) return;
      levels.push({
        price: o.price,
        color: o.side === 'buy' ? up : down,
        label: o.type.toUpperCase() + ' ' + o.side.toUpperCase() + ' ' + o.qty,
        dash: [6, 3]
      });
    });
    levels.forEach((lv) => {
      const raw = yOf(lv.price);
      const off = raw < pad.t ? -1 : raw > h - pad.b ? 1 : 0;
      const y = Math.round(clamp(raw, pad.t + 8, h - pad.b - 8)) + 0.5;
      ctx.strokeStyle = lv.color;
      ctx.globalAlpha = off ? 0.35 : 0.85;
      ctx.setLineDash(lv.dash || [1, 0]);
      ctx.lineWidth = 1;
      if (!off) {
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(w - pad.r, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = '700 10px ' + font;
      const text = (off < 0 ? '▲ ' : off > 0 ? '▼ ' : '') + lv.label;
      const tw = ctx.measureText(text).width;
      const tailW = lv.tail ? ctx.measureText(lv.tail).width + 10 : 0;
      ctx.fillStyle = lv.color;
      ctx.fillRect(pad.l, y - 7, tw + 8, 14);
      ctx.fillStyle = style.getPropertyValue('--bg').trim() || '#04110b';
      ctx.fillText(text, pad.l + 4, y + 3);
      if (lv.tail) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(pad.l + tw + 8, y - 7, tailW, 14);
        ctx.fillStyle = lv.tailColor;
        ctx.fillText(lv.tail, pad.l + tw + 13, y + 3);
      }
    });

    const shownPx = candleMode ? last : shownLast;
    const ly = Math.round(yOf(shownPx)) + 0.5;
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(pad.l, ly);
    ctx.lineTo(w - pad.r, ly);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.fillRect(w - pad.r + 1, ly - 9, pad.r - 2, 18);
    ctx.beginPath();
    ctx.moveTo(w - pad.r + 1, ly - 9);
    ctx.lineTo(w - pad.r - 5, ly);
    ctx.lineTo(w - pad.r + 1, ly + 9);
    ctx.fill();
    ctx.fillStyle = style.getPropertyValue('--bg').trim() || '#04110b';
    ctx.font = '700 11px ' + font;
    ctx.fillText(shownPx.toFixed(2), w - pad.r + 5, ly + 4);

    const lc = stock.liveCandle;
    const emaLast = stock.ema && stock.ema.length ? stock.ema[stock.ema.length - 1] : null;
    const legend =
      '<span>' + stock.symbol + '</span>' +
      (lc
        ? '<span>O<b>' + lc.o.toFixed(2) + '</b></span><span>H<b>' + lc.h.toFixed(2) + '</b></span><span>L<b>' + lc.l.toFixed(2) + '</b></span><span>C<b>' + lc.c.toFixed(2) + '</b></span>'
        : '') +
      (showEma && emaLast != null ? '<span class="ema">EMA20<b>' + emaLast.toFixed(2) + '</b></span>' : '');
    if (view.legend !== legend) {
      $('chartLegend').innerHTML = legend;
      view.legend = legend;
    }

    if (!candleMode) {
      dot.style.display = 'block';
      dot.style.setProperty('--dot', color);
      dot.style.transform = 'translate(' + (pad.l + innerW) + 'px,' + yOf(shownLast) + 'px)';
    } else {
      dot.style.display = 'none';
    }

    const tag = $('crosshair');
    if (hover && hover.x >= pad.l && hover.x <= pad.l + innerW) {
      const x = hover.x;
      const t = Math.round(((x - pad.l) / innerW) * (series.length - 1));
      const px = series[clamp(t, 0, series.length - 1)];
      if (px != null) {
        ctx.strokeStyle = cyan;
        ctx.globalAlpha = 0.6;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, pad.t);
        ctx.lineTo(Math.round(x) + 0.5, h - pad.b);
        ctx.moveTo(pad.l, Math.round(yOf(px)) + 0.5);
        ctx.lineTo(w - pad.r, Math.round(yOf(px)) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        tag.style.display = 'block';
        tag.style.left = w - pad.r + 1 + 'px';
        tag.style.width = pad.r - 2 + 'px';
        tag.style.top = yOf(px) + 'px';
        tag.textContent = money(px);
      }
      const tip = $('fillTip');
      if (nearMark) {
        const m = nearMark.m;
        tip.className = 'fill-tip ' + (nearMark.isBuy ? 'up' : 'down');
        tip.textContent = m.kind.toUpperCase() + ' ' + m.qty + ' @ ' + money(m.price) + ' · T' + m.tick;
        tip.style.left = clamp(nearMark.x, 60, w - pad.r - 60) + 'px';
        tip.style.top = nearMark.gy + (nearMark.isBuy ? 12 : -30) + 'px';
        tip.style.display = 'block';
      } else tip.style.display = 'none';
    } else {
      tag.style.display = 'none';
      $('fillTip').style.display = 'none';
    }
    chartDirty = false;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function paintQuote(state) {
    const s = selectedStock(state);
    $('qSym').textContent = s.symbol + ' · ' + s.name;
    const qPx = $('qPx');
    qPx.textContent = s.unlocked ? money(s.price) : 'LOCKED';
    if (s.unlocked && view.quotePx && s.price !== view.quotePx && !reduceMotion) {
      qPx.classList.remove('tick-up', 'tick-down');
      void qPx.offsetWidth;
      qPx.classList.add(s.price > view.quotePx ? 'tick-up' : 'tick-down');
    }
    view.quotePx = s.unlocked ? s.price : 0;
    $('qChg').textContent = s.unlocked ? signed(s.pct, 2) + '%  SESSION ' + signed(s.dayPct, 2) + '%' : s.unlockRank;
    $('qChg').className = 'chg ' + clsDelta(s.pct);
    const movers = state.stocks
      .filter((x) => x.unlocked)
      .slice()
      .sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct))
      .slice(0, 4);
    $('movers').innerHTML = movers
      .map(
        (m) =>
          '<div class="mover"><b>' +
          m.symbol +
          '</b><div class="' +
          clsDelta(m.dayPct) +
          '">' +
          signed(m.dayPct, 2) +
          '%</div></div>'
      )
      .join('');
  }

  function paintStats(state, dt) {
    const k = 1 - Math.pow(0.001, dt / 180);
    tween.cash += (state.cash - tween.cash) * k;
    tween.equity += (state.equity - tween.equity) * k;
    tween.hold += (state.holdingsValue - tween.hold) * k;
    $('cash').textContent = money(tween.cash);
    $('holdings').textContent = money(tween.hold);
    $('total').textContent = money(tween.equity);
    $('pnl').textContent = signed(state.sessionPct, 2) + '%';
    $('pnl').className = clsDelta(state.sessionPct);
    $('day').textContent = String(state.day);
    $('rank').textContent = state.rank.id;
    $('regime').textContent = state.regime.label;
    const regimeStat = $('regimeStat');
    if (regimeStat) regimeStat.dataset.regime = state.regime.id || '';
    $('goalFill').style.width = clamp((state.equity / 100000) * 100, 0, 100) + '%';
    document.body.classList.toggle('is-paused', !!state.paused);
  }

  function paintLog(state) {
    const root = $('log');
    const have = root.childElementCount;
    if (have > state.log.length) {
      root.innerHTML = '';
    }
    const start = root.childElementCount;
    for (let i = start; i < state.log.length; i++) {
      const row = state.log[i];
      const el = document.createElement('div');
      el.className = 'log-entry ' + (row.kind || '');
      el.textContent = '[' + row.day + '] ' + row.msg;
      root.appendChild(el);
    }
    while (root.childElementCount > 80) root.removeChild(root.firstChild);
    root.scrollTop = root.scrollHeight;
  }

  function paintNews(state) {
    const el = $('news');
    const text = (state.news.hot ? 'BREAKING · ' : 'TAPE · ') + state.news.text;
    if (dirtyHash.news !== text) {
      el.textContent = text;
      dirtyHash.news = text;
    }
    el.classList.toggle('hot', state.news.hot);
  }

  function paintMissions(state) {
    const hash = state.missions.map((m) => m.id + m.progress + m.done).join('|');
    if (dirtyHash.missions === hash) return;
    dirtyHash.missions = hash;
    $('missions').innerHTML = state.missions
      .map((m) => {
        const pct = clamp((m.progress / m.target) * 100, 0, 100);
        return (
          '<div class="mission"><div>' +
          m.title +
          (m.done ? ' ✓' : '') +
          '</div><div class="hint">' +
          m.desc +
          '</div><div class="bar"><i style="width:' +
          pct +
          '%"></i></div></div>'
        );
      })
      .join('');
  }

  function paintBook(state) {
    const hash =
      state.positions.map((p) => p.symbol + p.qty + p.unrealizedCents).join('|') +
      '#' +
      state.orders.map((o) => o.id + o.qty).join('|');
    if (dirtyHash.book === hash) return;
    dirtyHash.book = hash;
    $('positions').innerHTML = state.positions.length
      ? state.positions
          .map((p) => {
            return (
              '<div class="pos' +
              (p.side === 'short' ? ' short' : '') +
              '"><b>' +
              p.symbol +
              '</b><span>' +
              p.qty +
              ' @ ' +
              money(p.avg) +
              '</span><span class="' +
              clsDelta(p.unrealizedCents) +
              '">' +
              money(p.unrealizedCents / 100) +
              '</span></div>'
            );
          })
          .join('')
      : '<div class="pos hint">FLAT · no simulated inventory</div>';
    $('orders').innerHTML = state.orders.length
      ? state.orders
          .map((o) => {
            return (
              '<div class="order-row"><span>#' +
              o.id +
              ' ' +
              o.type.toUpperCase() +
              ' ' +
              o.side.toUpperCase() +
              ' ' +
              o.qty +
              ' ' +
              o.symbol +
              ' @ ' +
              money(o.price) +
              '</span><button data-cancel="' +
              o.id +
              '">X</button></div>'
            );
          })
          .join('')
      : '<div class="order-row hint">No working orders</div>';
  }

  function fillSelect(state) {
    const sel = $('stockSelect');
    const html = state.stocks
      .map((s) => '<option value="' + s.symbol + '"' + (s.unlocked ? '' : ' disabled') + '>' + s.symbol + ' — ' + s.name + (s.unlocked ? '' : ' (LOCK)') + '</option>')
      .join('');
    if (sel.innerHTML !== html) sel.innerHTML = html;
    sel.value = state.selected;
  }

  function syncTicket() {
    const state = game().getState();
    const s = selectedStock(state);
    const qty = Number($('qty').value);
    const max = game().maxBuyQty(s.symbol);
    const maxShort = game().maxShortQty(s.symbol);
    const maxCover = game().maxCoverQty(s.symbol);
    const maxSell = game().maxSellQty(s.symbol);
    const pos = state.positions.find((p) => p.symbol === s.symbol);
    const closed = state.won || state.lost;
    $('maxBuy').textContent = s.unlocked
      ? 'MAX BUY ' + max + ' · SHORT ' + maxShort + ' · CASH ' + money(state.cash)
      : 'LOCKED';
    $('buyBtn').disabled = !s.unlocked || closed || max <= 0;
    $('sellBtn').disabled = !s.unlocked || closed || (maxSell <= 0 && maxShort <= 0);
    $('shortBtn').disabled = !s.unlocked || closed || maxShort <= 0 || (pos && pos.qty > 0);
    $('coverBtn').disabled = !s.unlocked || closed || maxCover + 1e-9 < (qty > 0 ? Math.min(qty, maxCover) : 0.0001) || maxCover <= 0;
    $('barMeta').innerHTML = s.unlocked
      ? '<span><b>' + s.symbol + '</b> ' + money(s.price) + '</span><span>QTY <b>' + (qty || 0) + '</b> · ' + $('orderType').value.toUpperCase() + (pos ? ' · <b class="' + clsDelta(pos.unrealizedCents) + '">' + money(pos.unrealizedCents / 100) + '</b>' : '') + '</span>'
      : '<span>' + s.symbol + ' LOCKED</span>';
    const needLimit = $('orderType').value !== 'market';
    $('limitPx').disabled = !needLimit;
    if (!needLimit) $('limitPx').value = s.price.toFixed(2);
  }

  function handleEvents(events) {
    events.forEach((ev) => {
      if (ev.type === 'fill') {
        if (ev.side === 'buy') audio.buy();
        else audio.sell();
        const rect = $('tradeBar').getBoundingClientRect();
        burst(rect.left + rect.width / 2, rect.top + 20, ev.side === 'buy' || (ev.side === 'sell' && ev.price));
        const label = ev.openedShort
          ? 'FILL SHORT '
          : ev.covered
            ? 'FILL COVER '
            : ev.side === 'buy'
              ? 'FILL BUY '
              : 'FILL SELL ';
        toast(label + ev.qty + ' ' + ev.symbol);
        addFillMark(ev);
        chartDirty = true;
      } else if (ev.type === 'news') {
        audio.news();
        toast('NEWS');
      } else if (ev.type === 'rank' || ev.type === 'unlock') {
        audio.rank();
        toast(ev.title || 'UNLOCK');
      } else if (ev.type === 'win') {
        audio.win();
        showModal('win');
      } else if (ev.type === 'lose') {
        audio.lose();
        showModal('lose');
      } else if (ev.type === 'reject') {
        audio.warn();
      } else if (ev.type === 'mission') {
        toast('CONTRACT CLEAR');
      }
    });
  }

  let lastState = null;
  let lastPaint = 0;

  function renderFrame(ts) {
    if (!game()) return;
    const state = lastState || game().getState();
    paintStats(state, Math.min(48, ts - lastPaint || 16));
    if (chartDirty || chartAnimating(ts)) drawChart(state, ts);
    lastPaint = ts;
  }

  function paintAll(state) {
    lastState = state;
    paintWatch(state);
    paintQuote(state);
    paintNews(state);
    paintMissions(state);
    paintBook(state);
    paintLog(state);
    fillSelect(state);
    syncTicket();
    if (state.tick % 4 === 0) paintTape(state);
    noteTick(state);
    chartDirty = true;
    $('pauseBtn').textContent = state.paused ? 'RESUME' : 'PAUSE';
    document.querySelectorAll('[data-speed]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.speed) === state.speed);
    });
    const theme = document.documentElement.dataset.theme || 'phosphor';
    document.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  function loop() {
    if (intervalId) clearInterval(intervalId);
    const step = () => {
      const g = game();
      if (!g) return;
      const out = g.tickMarket();
      handleEvents(out.events);
      paintAll(out.state);
    };
    intervalId = setInterval(step, 1000 / (game().getState().speed || 1));
  }

  function submit(side) {
    audio.unlock();
    const type = $('orderType').value;
    const qty = $('qty').value;
    const px = $('limitPx').value;
    let result;
    if (side === 'buy') result = game().buy(qty, type, px);
    else if (side === 'sell') result = game().sell(qty, type, px);
    else if (side === 'short') result = game().short(qty, type, px);
    else result = game().cover(qty, type, px);
    dirtyHash.book = '';
    paintAll(game().getState());
    if (!result.ok) toast(result.reason);
  }

  function pnlCardHtml(state) {
    return (
      '<div class="pnl-card">' +
      '<div><label>EQUITY</label><b>' +
      money(state.equity) +
      '</b></div>' +
      '<div><label>SESSION</label><b class="' +
      clsDelta(state.sessionPct) +
      '">' +
      signed(state.sessionPct, 2) +
      '%</b></div>' +
      '<div><label>REALIZED</label><b class="' +
      clsDelta(state.realized) +
      '">' +
      money(state.realized) +
      '</b></div>' +
      '<div><label>UNREALIZED</label><b class="' +
      clsDelta(state.unrealized) +
      '">' +
      money(state.unrealized) +
      '</b></div>' +
      '<div><label>PEAK</label><b>' +
      money(state.peakEquity) +
      '</b></div>' +
      '<div><label>FILLS / SHORTS</label><b>' +
      state.fills +
      ' · ' +
      state.shortsOpened +
      '</b></div>' +
      '</div>'
    );
  }

  function showModal(which) {
    const state = game().getState();
    $('overlay').classList.add('show');
    const scores = game()
      .scores()
      .map((s, i) => '<li><span>' + (i + 1) + '. ' + s.alias + ' · D' + s.day + '</span><b>' + money(s.equity) + '</b></li>')
      .join('');
    if (which === 'win') {
      $('modalTitle').textContent = 'DESK CLEARED';
      $('modalBody').innerHTML =
        '<p>Simulated book hit the $100,000 wire. No real money changed hands.</p>' +
        pnlCardHtml(state) +
        '<ol class="scores">' +
        scores +
        '</ol>';
    } else if (which === 'lose') {
      $('modalTitle').textContent = 'MARGIN CALL';
      $('modalBody').innerHTML =
        '<p>Simulated capital is gone. Reset the desk and try another tape.</p>' +
        pnlCardHtml(state) +
        '<ol class="scores">' +
        scores +
        '</ol>';
    } else if (which === 'help') {
      $('modalTitle').textContent = 'DESK MANUAL';
      $('modalBody').innerHTML =
        '<p>Simulated money only. Not financial advice.</p>' +
        '<ol><li>Click a name on the watch. Locked tickers unlock with rank.</li>' +
        '<li>Market, limit, and stop tickets. Qty chips, 25/50%, or type a size.</li>' +
        '<li>SHORT a name to fade a rip. COVER buys the short back. Capacity is 1× equity.</li>' +
        '<li>EMA20 sits on the chart. CRT slider tames the scanlines.</li>' +
        '<li>News shocks the tape. Ride it or fade it.</li>' +
        '<li>Keys: SPACE pause · B buy · S sell · H short · C cover · 1-6 watch · [ ] size</li>' +
        '<li>Goal: grow the simulated book to $100,000. Wipe below $250.</li></ol>';
    } else if (which === 'pnl') {
      $('modalTitle').textContent = 'SESSION P&L';
      $('modalBody').innerHTML =
        pnlCardHtml(state) +
        '<p>Day ' +
        state.day +
        ' · ' +
        state.rank.title +
        ' · ' +
        state.regime.label +
        '. Simulated money only.</p>';
    } else {
      $('modalTitle').textContent = 'LOCAL LEADERBOARD';
      $('modalBody').innerHTML = scores ? '<ol class="scores">' + scores + '</ol>' : '<p>No runs logged yet.</p>';
    }
  }

  function hideModal() {
    $('overlay').classList.remove('show');
  }

  function resetDesk() {
    gameHolder.current = game().reset();
    cardRefs.clear();
    tapeRefs.built = 0;
    tapeRefs.nodes = [];
    dirtyHash.missions = '';
    dirtyHash.book = '';
    dirtyHash.news = '';
    $('watch').innerHTML = '';
    $('tape').innerHTML = '';
    $('log').innerHTML = '';
    hideModal();
    paintAll(game().getState());
    loop();
  }

  function bind() {
    $('buyBtn').addEventListener('click', () => submit('buy'));
    $('sellBtn').addEventListener('click', () => submit('sell'));
    $('shortBtn').addEventListener('click', () => submit('short'));
    $('coverBtn').addEventListener('click', () => submit('cover'));
    $('stockSelect').addEventListener('change', (e) => {
      game().select(e.target.value);
      paintAll(game().getState());
    });
    $('qty').addEventListener('input', syncTicket);
    $('orderType').addEventListener('change', syncTicket);
    document.querySelectorAll('[data-qty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const max = game().maxBuyQty();
        if (btn.dataset.qty === 'max') $('qty').value = String(max);
        else if (btn.dataset.qty === '0.25' || btn.dataset.qty === '0.5') {
          $('qty').value = String(Math.max(0.0001, Math.round(max * Number(btn.dataset.qty) * 10000) / 10000));
        } else $('qty').value = btn.dataset.qty;
        syncTicket();
      });
    });
    document.querySelectorAll('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        game().setSpeed(Number(btn.dataset.speed));
        loop();
        paintAll(game().getState());
      });
    });
    $('pauseBtn').addEventListener('click', () => {
      game().togglePause();
      paintAll(game().getState());
    });
    document.querySelectorAll('[data-chart]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-chart]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        chartDirty = true;
        drawChart(game().getState());
      });
    });
    $('fillsBtn').addEventListener('click', () => {
      showFills = !showFills;
      $('fillsBtn').classList.toggle('active', showFills);
      $('fillsBtn').setAttribute('aria-pressed', String(showFills));
      try { localStorage.setItem('tt.fills', showFills ? '1' : '0'); } catch (e) {}
      chartDirty = true;
      drawChart(game().getState());
    });
    try {
      if (localStorage.getItem('tt.fills') === '0') {
        showFills = false;
        $('fillsBtn').classList.remove('active');
        $('fillsBtn').setAttribute('aria-pressed', 'false');
      }
    } catch (e) {}
    $('emaBtn').addEventListener('click', () => {
      showEma = !showEma;
      $('emaBtn').classList.toggle('active', showEma);
      chartDirty = true;
      drawChart(game().getState());
    });
    document.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.documentElement.dataset.theme = btn.dataset.theme;
        storage.setItem('terminal-trader-theme', btn.dataset.theme);
        document.querySelectorAll('[data-theme]').forEach((b) => {
          b.classList.toggle('active', b.dataset.theme === btn.dataset.theme);
        });
        chartDirty = true;
      });
    });
    const crt = $('crtSlider');
    const applyCrt = (value) => {
      const n = clamp(Number(value) || 0, 0, 80);
      document.body.style.setProperty('--scan', String(n / 100));
      document.body.style.setProperty('--vignette', String(0.28 + n / 160));
      storage.setItem('terminal-trader-crt', String(n));
    };
    crt.addEventListener('input', () => applyCrt(crt.value));
    const savedCrt = storage.getItem('terminal-trader-crt');
    if (savedCrt != null) {
      crt.value = savedCrt;
      applyCrt(savedCrt);
    }
    $('muteBtn').addEventListener('click', () => {
      audio.setMuted(!audio.isMuted());
      $('muteBtn').textContent = audio.isMuted() ? 'SOUND' : 'MUTE';
    });
    $('helpBtn').addEventListener('click', () => showModal('help'));
    $('pnlBtn').addEventListener('click', () => showModal('pnl'));
    $('boardBtn').addEventListener('click', () => showModal('board'));
    $('resetBtn').addEventListener('click', resetDesk);
    $('closeModal').addEventListener('click', hideModal);
    $('orders').addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-cancel');
      if (!id) return;
      game().cancelOrder(Number(id));
      paintAll(game().getState());
    });
    $('chart-wrap').addEventListener('pointermove', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      hover = { x: e.clientX - r.left, y: e.clientY - r.top };
      chartDirty = true;
    });
    $('chart-wrap').addEventListener('pointerleave', () => {
      hover = null;
      chartDirty = true;
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input, select, textarea')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        game().togglePause();
        paintAll(game().getState());
      } else if (e.key === 'b' || e.key === 'B') submit('buy');
      else if (e.key === 's' || e.key === 'S') submit('sell');
      else if (e.key === 'h' || e.key === 'H') submit('short');
      else if (e.key === 'c' || e.key === 'C') submit('cover');
      else if (e.key === '[') {
        $('qty').value = String(Math.max(0.0001, Number($('qty').value || 1) / 2));
        syncTicket();
      } else if (e.key === ']') {
        $('qty').value = String(Number($('qty').value || 1) * 2);
        syncTicket();
      } else if (/^[1-6]$/.test(e.key)) {
        const unlocked = game()
          .getState()
          .stocks.filter((s) => s.unlocked);
        const pick = unlocked[Number(e.key) - 1];
        if (pick) {
          game().select(pick.symbol);
          paintAll(game().getState());
        }
      }
    });
    window.addEventListener('resize', () => {
      resizeChart();
      if (game()) drawChart(game().getState());
    });
    new ResizeObserver(() => {
      resizeChart();
      if (game()) drawChart(game().getState());
    }).observe($('chart-wrap'));
    ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => audio.unlock(), { once: true }));
  }

  function bootText(lines, done) {
    const el = $('bootText');
    let i = 0;
    const id = setInterval(() => {
      el.textContent = lines[i] || lines[lines.length - 1];
      i += 1;
      if (i >= lines.length) {
        clearInterval(id);
        done();
      }
    }, 220);
  }

  function start() {
    const theme = storage.getItem('terminal-trader-theme');
    if (theme) document.documentElement.dataset.theme = theme;
    gameHolder.current = TT.createGame({ storage, autoload: true, persistKey: 'terminal-trader-v2' });
    bind();
    const state = game().getState();
    paintAll(state);
    resizeChart();
    drawChart(state);
    loop();
    bootDone = true;
    if (state.won) showModal('win');
    if (state.lost) showModal('lose');
  }

  window.onload = function () {
    bootText(
      [
        '> POST DESK BIOS…',
        '> LOADING SIMULATED TAPE…',
        '> NO REAL FUNDS ON THIS WIRE',
        '> MARKET OPEN'
      ],
      () => {
        $('boot').classList.add('hide');
        start();
        requestAnimationFrame(drawFx);
      }
    );
  };
})();
