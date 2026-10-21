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
  const cardRefs = new Map();
  const tween = { cash: 10000, equity: 10000, hold: 0 };
  const particles = [];

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
    return '$' + fmt(n, 2);
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
    if (canvas.width !== innerWidth * dpr || canvas.height !== innerHeight * dpr) {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.scale(dpr, dpr);
    }
    ctx.clearRect(0, 0, innerWidth, innerHeight);
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
    const ctx = canvas.getContext('2d');
    const dpr = 2;
    if (canvas.width !== 112) {
      canvas.width = 56 * dpr;
      canvas.height = 22 * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 56, 22);
    if (!history || history.length < 2) return;
    const min = Math.min.apply(null, history);
    const max = Math.max.apply(null, history);
    const range = max - min || 1;
    ctx.beginPath();
    history.forEach((p, i) => {
      const x = (i / (history.length - 1)) * 56;
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
      if (s.unlocked) drawSpark(ref.spark, s.history.slice(-24), s.pct >= 0);
      if (s.unlocked && ref.lastPx != null && ref.lastPx !== s.price) {
        const flash = s.price >= ref.lastPx ? 'flash-up' : 'flash-down';
        ref.row.classList.add(flash);
        setTimeout(() => ref.row.classList.remove(flash), 180);
      }
      ref.lastPx = s.price;
    });
  }

  function paintTape(state) {
    const items = state.stocks
      .filter((s) => s.unlocked)
      .map((s) => {
        const klass = s.pct >= 0 ? 'up' : 'down';
        return '<span><b>' + s.symbol + '</b><span class="' + klass + '">' + money(s.price) + ' ' + signed(s.pct, 2) + '%</span></span>';
      });
    const html = items.join('') + items.join('');
    const tape = $('tape');
    if (tape.dataset.hash !== String(items.length) + state.day) {
      tape.innerHTML = html;
      tape.dataset.hash = String(items.length) + state.day;
    } else {
      tape.innerHTML = html;
    }
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

  function drawChart(state) {
    const canvas = $('chart');
    const ctx = canvas.getContext('2d');
    const { w, h, dpr } = chartSize;
    if (!w || !h) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const stock = selectedStock(state);
    const mode = document.querySelector('[data-chart].active')?.dataset.chart || 'line';
    const data = stock.history;
    if (!stock.unlocked || data.length < 2) {
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted');
      ctx.fillText(stock.unlocked ? 'WAITING FOR PRINTS…' : 'SYMBOL LOCKED', 16, 28);
      return;
    }
    const style = getComputedStyle(document.body);
    const up = style.getPropertyValue('--up').trim();
    const down = style.getPropertyValue('--down').trim();
    const line = style.getPropertyValue('--line').trim();
    const muted = style.getPropertyValue('--muted').trim();
    const last = data[data.length - 1];
    const first = data[0];
    const bull = last >= first;
    const color = bull ? up : down;
    const pad = { l: 10, r: 72, t: 14, b: 30 };
    const candles = stock.candles.concat([stock.liveCandle]).filter(Boolean);
    const series = mode === 'candle' && candles.length ? candles.map((c) => c.c) : data;
    const min = Math.min.apply(null, mode === 'candle' && candles.length ? candles.flatMap((c) => [c.l, c.c]) : data);
    const max = Math.max.apply(null, mode === 'candle' && candles.length ? candles.flatMap((c) => [c.h, c.c]) : data);
    const range = max - min || 1;
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const yOf = (p) => pad.t + (1 - (p - min) / range) * innerH;

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = pad.t + (innerH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    }

    if (mode === 'candle' && candles.length) {
      const bw = Math.max(3, innerW / candles.length - 1.5);
      candles.forEach((c, i) => {
        const x = pad.l + (i + 0.5) * (innerW / candles.length);
        const cUp = c.c >= c.o;
        ctx.strokeStyle = cUp ? up : down;
        ctx.fillStyle = cUp ? up : down;
        ctx.beginPath();
        ctx.moveTo(x, yOf(c.h));
        ctx.lineTo(x, yOf(c.l));
        ctx.stroke();
        const top = yOf(Math.max(c.o, c.c));
        const bot = yOf(Math.min(c.o, c.c));
        ctx.fillRect(x - bw / 2, top, bw, Math.max(1, bot - top));
      });
    } else {
      ctx.beginPath();
      data.forEach((p, i) => {
        const x = pad.l + (i / (data.length - 1)) * innerW;
        const y = yOf(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineTo(pad.l + innerW, h - pad.b);
      ctx.lineTo(pad.l, h - pad.b);
      ctx.closePath();
      ctx.fillStyle = bull ? 'rgba(61,255,154,0.10)' : 'rgba(255,77,109,0.10)';
      ctx.fill();
    }

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(pad.l, yOf(last));
    ctx.lineTo(w - pad.r, yOf(last));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.fillRect(w - pad.r + 6, yOf(last) - 8, 62, 16);
    ctx.fillStyle = '#04110b';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(last.toFixed(2), w - pad.r + 10, yOf(last) + 3);

    ctx.fillStyle = muted;
    if (Math.abs(yOf(max) - yOf(last)) > 16) ctx.fillText(max.toFixed(2), w - pad.r + 6, pad.t + 10);
    if (Math.abs(yOf(min) - yOf(last)) > 16) ctx.fillText(min.toFixed(2), w - pad.r + 6, h - 10);

    if (hover) {
      const x = hover.x;
      const t = Math.round(((x - pad.l) / innerW) * (series.length - 1));
      const px = series[clamp(t, 0, series.length - 1)];
      if (px != null) {
        ctx.strokeStyle = style.getPropertyValue('--cyan').trim();
        ctx.beginPath();
        ctx.moveTo(x, pad.t);
        ctx.lineTo(x, h - pad.b);
        ctx.stroke();
        const tag = $('crosshair');
        tag.style.display = 'block';
        tag.style.left = Math.min(x + 8, w - 90) + 'px';
        tag.style.top = yOf(px) + 'px';
        tag.textContent = money(px);
      }
    } else {
      $('crosshair').style.display = 'none';
    }
    chartDirty = false;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function paintQuote(state) {
    const s = selectedStock(state);
    $('qSym').textContent = s.symbol + ' · ' + s.name;
    $('qPx').textContent = s.unlocked ? money(s.price) : 'LOCKED';
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
    $('cash').textContent = fmt(tween.cash);
    $('holdings').textContent = fmt(tween.hold);
    $('total').textContent = fmt(tween.equity);
    $('pnl').textContent = signed(state.sessionPct, 2) + '%';
    $('pnl').className = clsDelta(state.sessionPct);
    $('day').textContent = String(state.day);
    $('rank').textContent = state.rank.id;
    $('regime').textContent = state.regime.label;
    $('goalFill').style.width = clamp((state.equity / 100000) * 100, 0, 100) + '%';
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
    el.textContent = (state.news.hot ? 'BREAKING · ' : 'TAPE · ') + state.news.text;
    el.classList.toggle('hot', state.news.hot);
  }

  function paintMissions(state) {
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
    $('positions').innerHTML = state.positions.length
      ? state.positions
          .map((p) => {
            return (
              '<div class="pos"><b>' +
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
    $('maxBuy').textContent = s.unlocked ? 'MAX ' + max + ' · CASH ' + money(state.cash) : 'LOCKED';
    $('buyBtn').disabled = !s.unlocked || state.won || state.lost || max <= 0;
    $('sellBtn').disabled = !s.unlocked || state.won || state.lost || !state.positions.some((p) => p.symbol === s.symbol && p.qty + 1e-9 >= (qty || 0.0001));
    const needLimit = $('orderType').value !== 'market';
    $('limitPx').disabled = !needLimit;
    if (!needLimit) $('limitPx').value = s.price.toFixed(2);
  }

  function handleEvents(events) {
    events.forEach((ev) => {
      if (ev.type === 'fill') {
        if (ev.side === 'buy') audio.buy();
        else audio.sell();
        const rect = $('ticket').getBoundingClientRect();
        burst(rect.left + rect.width / 2, rect.top + 20, ev.side === 'buy' || (ev.side === 'sell' && ev.price));
        toast((ev.side === 'buy' ? 'FILL BUY ' : 'FILL SELL ') + ev.qty + ' ' + ev.symbol);
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
    if (chartDirty) drawChart(state);
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
    chartDirty = true;
    $('pauseBtn').textContent = state.paused ? 'RESUME' : 'PAUSE';
    document.querySelectorAll('[data-speed]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.speed) === state.speed);
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
    const result = side === 'buy' ? game().buy(qty, type, px) : game().sell(qty, type, px);
    paintAll(game().getState());
    if (!result.ok) toast(result.reason);
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
        '<p>Simulated book hit the $100,000 wire. No real money changed hands.</p><ol class="scores">' +
        scores +
        '</ol>';
    } else if (which === 'lose') {
      $('modalTitle').textContent = 'MARGIN CALL';
      $('modalBody').innerHTML = '<p>Simulated capital is gone. Reset the desk and try another tape.</p><ol class="scores">' + scores + '</ol>';
    } else if (which === 'help') {
      $('modalTitle').textContent = 'DESK MANUAL';
      $('modalBody').innerHTML =
        '<p>Simulated money only. Not financial advice.</p>' +
        '<ol><li>Click a name on the watch. Locked tickers unlock with rank.</li>' +
        '<li>Market, limit, and stop tickets. Qty chips or type a size.</li>' +
        '<li>News shocks the tape. Ride it or fade it.</li>' +
        '<li>Keys: SPACE pause · B buy · S sell · 1-6 watch · [ ] size</li>' +
        '<li>Goal: grow the simulated book to $100,000. Wipe below $250.</li></ol>';
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
    $('watch').innerHTML = '';
    $('log').innerHTML = '';
    hideModal();
    paintAll(game().getState());
    loop();
  }

  function bind() {
    $('buyBtn').addEventListener('click', () => submit('buy'));
    $('sellBtn').addEventListener('click', () => submit('sell'));
    $('stockSelect').addEventListener('change', (e) => {
      game().select(e.target.value);
      paintAll(game().getState());
    });
    $('qty').addEventListener('input', syncTicket);
    $('orderType').addEventListener('change', syncTicket);
    document.querySelectorAll('[data-qty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.qty === 'max') $('qty').value = String(game().maxBuyQty());
        else $('qty').value = btn.dataset.qty;
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
    document.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.documentElement.dataset.theme = btn.dataset.theme;
        storage.setItem('terminal-trader-theme', btn.dataset.theme);
        chartDirty = true;
      });
    });
    $('muteBtn').addEventListener('click', () => {
      audio.setMuted(!audio.isMuted());
      $('muteBtn').textContent = audio.isMuted() ? 'SOUND' : 'MUTE';
    });
    $('helpBtn').addEventListener('click', () => showModal('help'));
    $('boardBtn').addEventListener('click', () => showModal('board'));
    $('resetBtn').addEventListener('click', resetDesk);
    $('closeModal').addEventListener('click', hideModal);
    $('orders').addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-cancel');
      if (!id) return;
      game().cancelOrder(Number(id));
      paintAll(game().getState());
    });
    $('chart-wrap').addEventListener('mousemove', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      hover = { x: e.clientX - r.left, y: e.clientY - r.top };
      chartDirty = true;
    });
    $('chart-wrap').addEventListener('mouseleave', () => {
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
