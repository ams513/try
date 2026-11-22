/* Stark Builder, by Stark. The Studio tab (sun and shadow study, cost risk range, 3D export) and the Ctrl+K command palette with
   plain-language questions. All maths lives in studio.js. SVG is built with DOM calls, never from strings. No network. */
(function () {
  'use strict';
  const SB = window.SB, C = SB.core, ST = SB.studio, M = SB.mesh, app = SB.app;
  const { h, $, clear } = app;
  const NS = 'http://www.w3.org/2000/svg';
  const REDUCED = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function sv(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) { const v = attrs[k]; if (v === null || v === undefined || v === false) continue; if (k === 'text') el.textContent = v; else el.setAttribute(k, String(v)); }
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c) el.appendChild(c); }
    return el;
  }
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const hm = t => { const a = Math.floor(t), m = Math.round((t - a) * 60); return (a + (m === 60 ? 1 : 0)) % 24 + ':' + String(m === 60 ? 0 : m).padStart(2, '0'); };
  const LSK = 'starkBuilder.studio';
  const S = app.studio = { view: 'sun', lat: 45, month: 5, day: 21, hour: 15, north: 0, vol: 'medium', rho: 0.5, cont: 8, budget: 0 };
  try { const o = JSON.parse(localStorage.getItem(LSK) || 'null'); if (o && typeof o === 'object') { ['lat', 'month', 'day', 'north', 'vol', 'rho', 'cont'].forEach(k => { if (o[k] !== undefined && typeof o[k] === typeof S[k]) S[k] = o[k]; }); } } catch (e) { /* storage may be blocked */ }
  S.lat = Math.max(-66, Math.min(66, S.lat)); S.month = Math.max(0, Math.min(11, S.month | 0)); S.day = Math.max(1, Math.min(ST.MONTH_DAYS[S.month], S.day | 0)); S.north = ((S.north % 360) + 360) % 360;
  const keep = () => { try { localStorage.setItem(LSK, JSON.stringify({ lat: S.lat, month: S.month, day: S.day, north: S.north, vol: S.vol, rho: S.rho, cont: S.cont })); } catch (e) { /* ignore */ } };
  let timer = null;
  const stopPlay = () => { if (timer) { clearInterval(timer); timer = null; } };

  /* Cost-risk runs go to a background worker (this app's own js/studio.js) when the browser allows it: 20,000 runs without blocking the page.
     Opened straight from a file, most browsers refuse workers, so the same maths runs here with 4,000 runs. Only the latest request is drawn. */
  const RISK = app.risk = { worker: null, failed: false, seq: 0, wait: new Map(), RUNS_BG: 20000, RUNS_FG: 4000 };
  RISK.start = function () {
    if (RISK.worker || RISK.failed || typeof Worker !== 'function' || location.protocol === 'file:') return RISK.worker;
    try {
      RISK.worker = new Worker('js/studio.js');
      RISK.worker.onmessage = e => { const m = e.data || {}, w = RISK.wait.get(m.id); if (!w) return; RISK.wait.delete(m.id); if (m.error) w.reject(new Error(m.error)); else w.resolve(m); };
      RISK.worker.onerror = ev => { if (ev && ev.preventDefault) ev.preventDefault(); RISK.fail(); };
    } catch (e) { RISK.fail(); }
    return RISK.worker;
  };
  RISK.fail = function () { RISK.failed = true; if (RISK.worker) { try { RISK.worker.terminate(); } catch (e) { /* gone */ } } RISK.worker = null; const w = Array.from(RISK.wait.values()); RISK.wait.clear(); w.forEach(x => x.fallback()); };
  RISK.local = (lines, o) => ({ sim: ST.riskSim(lines, Object.assign({}, o, { runs: RISK.RUNS_FG })), tor: ST.tornado(lines, o), where: 'page' });
  RISK.run = function (lines, o) {
    const id = ++RISK.seq, w = RISK.start();
    if (!w) return Promise.resolve(Object.assign(RISK.local(lines, o), { id }));
    return new Promise((resolve, reject) => {
      const fallback = () => resolve(Object.assign(RISK.local(lines, o), { id }));
      RISK.wait.set(id, { resolve: m => resolve({ id, sim: m.sim, tor: m.tor, where: 'worker' }), reject, fallback });
      try { w.postMessage({ op: 'risk', id, lines: JSON.parse(JSON.stringify(lines)), opts: Object.assign({}, o, { runs: RISK.RUNS_BG }) }); } catch (e) { RISK.wait.delete(id); fallback(); }
    });
  };

  function numField(label, value, attrs, on) {
    const inp = h('input', Object.assign({ type: 'number', value: String(value), 'aria-label': label, onchange: e => { const v = parseFloat(e.target.value); if (isFinite(v)) on(v); } }, attrs));
    return h('label', { class: 'f' }, label, inp);
  }
  function seg(opts, cur, on, label) { return h('div', { class: 'seg', role: 'group', 'aria-label': label }, opts.map(o => h('button', { type: 'button', 'aria-pressed': cur === o[0] ? 'true' : 'false', onclick: () => on(o[0]) }, o[1]))); }

  app.views.studio = function () {
    stopPlay();
    const box = clear($('#studio'));
    box.appendChild(h('h1', { text: 'Studio' }));
    box.appendChild(h('div', { class: 'seg subnav', role: 'group', 'aria-label': 'Studio tools' }, [['sun', 'Sun and shadow'], ['risk', 'Cost risk range'], ['export', 'Export 3D model']].map(v =>
      h('button', { type: 'button', 'aria-pressed': S.view === v[0] ? 'true' : 'false', onclick: () => { S.view = v[0]; app.views.studio(); } }, v[1]))));
    (S.view === 'risk' ? riskView : S.view === 'export' ? exportView : sunView)(box);
  };

  /* ---------- sun and shadow ---------- */
  function sunView(box) {
    const doy = () => ST.dayOfYear(S.month, S.day);
    const plan = app.plan, bb = C.bbox(plan), H = C.buildingHeight(plan), levels = C.levels(plan);
    box.appendChild(h('p', { class: 'muted', text: 'Where the sun is, and where the building throws its shadow, for any place, day and hour. Times are local solar time (noon is when the sun is due south or north). Drag the time slider or press play.' }));
    const plot = h('div', { class: 'card studio-plot' }), dome = h('div', { class: 'card studio-plot' }), read = h('div', { class: 'row studio-read', role: 'status', 'aria-live': 'polite' }), table = h('div', { class: 'card scroll-x' });
    const place = h('select', { 'aria-label': 'Place', onchange: e => { const i = parseInt(e.target.value, 10); if (i >= 0) { S.lat = ST.PLACES[i][1]; latIn.value = String(S.lat); keep(); update(); } } },
      h('option', { value: -1, text: 'Pick a place (or type a latitude)' }), ST.PLACES.map((p, i) => h('option', { value: i, text: p[0] + ' (' + p[1] + ')' })));
    const latIn = h('input', { type: 'number', min: -66, max: 66, step: 0.1, value: String(S.lat), 'aria-label': 'Latitude in degrees, north positive', onchange: e => { const v = parseFloat(e.target.value); if (isFinite(v)) { S.lat = Math.max(-66, Math.min(66, v)); e.target.value = String(S.lat); keep(); update(); } } });
    const mon = h('select', { 'aria-label': 'Month', onchange: e => { S.month = parseInt(e.target.value, 10); S.day = Math.min(S.day, ST.MONTH_DAYS[S.month]); dayIn.value = String(S.day); keep(); update(); } }, ST.MONTHS.map((m, i) => h('option', { value: i, selected: i === S.month, text: m })));
    const dayIn = h('input', { type: 'number', min: 1, max: 31, value: String(S.day), 'aria-label': 'Day of the month', onchange: e => { const v = parseInt(e.target.value, 10); if (v >= 1) { S.day = Math.min(v, ST.MONTH_DAYS[S.month]); e.target.value = String(S.day); keep(); update(); } } });
    const tLab = h('span', { class: 'big', style: 'min-width:3.4em;display:inline-block' });
    const tIn = h('input', { type: 'range', min: 0, max: 24, step: 0.25, value: String(S.hour), 'aria-label': 'Time of day, local solar time', style: 'flex:1 1 220px;min-width:160px', oninput: e => { S.hour = parseFloat(e.target.value); update(); } });
    const northIn = h('input', { type: 'number', min: 0, max: 359, step: 5, value: String(S.north), 'aria-label': 'Compass bearing of the top of the plan in degrees', onchange: e => { const v = parseFloat(e.target.value); if (isFinite(v)) { S.north = ((v % 360) + 360) % 360; e.target.value = String(S.north); keep(); update(); } } });
    const playBtn = h('button', { type: 'button', class: 'btn', onclick: () => {
      if (timer) { stopPlay(); playBtn.textContent = REDUCED() ? 'Step 1 hour' : 'Play the day'; return; }
      if (REDUCED()) { S.hour = (Math.floor(S.hour) + 1) % 24; tIn.value = String(S.hour); update(); return; }
      playBtn.textContent = 'Stop'; timer = setInterval(() => { S.hour = (S.hour + 0.25) % 24; tIn.value = String(S.hour); update(); if (app.tab !== 'studio') stopPlay(); }, 90);
    } }, REDUCED() ? 'Step 1 hour' : 'Play the day');
    box.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, h('label', { class: 'f' }, 'Place', place), h('label', { class: 'f' }, 'Latitude', latIn), h('label', { class: 'f' }, 'Month', mon), h('label', { class: 'f' }, 'Day', dayIn),
      h('label', { class: 'f' }, 'Plan top points to (compass degrees)', northIn),
      h('div', { class: 'f' }, h('span', { class: 'muted small', text: 'Quick turn' }), seg([['0', 'N'], ['90', 'E'], ['180', 'S'], ['270', 'W']], String(S.north), v => { S.north = +v; northIn.value = v; keep(); app.views.studio(); }, 'Turn the plan'))),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'muted small', text: 'Time' }), tLab, tIn, playBtn)));
    box.appendChild(read);
    box.appendChild(h('div', { class: 'studio-grid' }, plot, dome));
    box.appendChild(table);
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'Rough sketch, not a daylight or energy study. ' }), 'The shadow is the building box to the top of the walls (the roof is left out), on flat ground, with no neighbours or trees. Sun position uses solar time and ignores the equation of time and the atmosphere. Sun hours on windows count when the sun is above 2 degrees and within 85 degrees of the glass facing, with no overhangs. Use it to compare orientations and spot shading questions, then ask a designer.'));

    function update() {
      const d = doy(), sun = ST.sunPos(S.lat, d, S.hour), info = ST.dayInfo(S.lat, d), sh = ST.shadow(bb.w > 0 ? { x0: bb.x0, y0: bb.y0, x1: bb.x1, y1: bb.y1 } : null, H, sun, S.north);
      tLab.textContent = hm(S.hour);
      clear(read);
      [['Sun height', sun.alt > 0 ? f1(sun.alt) + ' deg' : 'below the horizon'], ['Sun direction', sun.alt > 0 ? Math.round(sun.az) + ' deg ' + ST.compassName(sun.az) : 'n/a'], ['Shadow length', sh ? app.fl(sh.len) : 'none'],
        ['Daylight', info.rise === null && info.hours === 0 ? 'none (polar night)' : f1(info.hours) + ' h'], ['Noon sun height', f1(info.noonAlt) + ' deg']].forEach(r => read.appendChild(h('div', { class: 'card studio-stat' }, h('div', { class: 'muted small', text: r[0] }), h('div', { class: 'big', text: r[1] }))));
      drawPlot(plot, sun, sh); drawDome(dome, d, sun); drawTable(table, d);
    }
    function drawPlot(el, sun, sh) {
      clear(el);
      if (!(bb.w > 0)) { el.appendChild(h('p', { class: 'muted', text: 'Draw some walls to see their shadow.' })); return; }
      const reach = Math.min(Math.max(H * 6, 8), 40), pad = Math.max(bb.w, bb.d) * 0.6 + 4;
      let x0 = bb.x0 - pad, x1 = bb.x1 + pad, y0 = bb.y0 - pad, y1 = bb.y1 + pad;
      if (sh) sh.poly.forEach(p => { x0 = Math.min(x0, p[0] - 1); x1 = Math.max(x1, p[0] + 1); y0 = Math.min(y0, p[1] - 1); y1 = Math.max(y1, p[1] + 1); });
      x0 = Math.max(x0, bb.x0 - reach - pad); x1 = Math.min(x1, bb.x1 + reach + pad); y0 = Math.max(y0, bb.y0 - reach - pad); y1 = Math.min(y1, bb.y1 + reach + pad);
      const svg = sv('svg', { viewBox: [x0, y0, x1 - x0, y1 - y0].join(' '), role: 'img', 'aria-label': 'Plan view with the building shadow. ' + (sh ? 'Shadow length ' + app.fl(sh.len) + '.' : 'No shadow, the sun is down.'), class: 'studio-svg' });
      svg.appendChild(sv('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: sun.alt > 0 ? 'var(--panel-2)' : 'var(--bg-2)' }));
      const step = (x1 - x0) > 60 ? 10 : 5; for (let gx = Math.ceil(x0 / step) * step; gx < x1; gx += step) svg.appendChild(sv('line', { x1: gx, y1: y0, x2: gx, y2: y1, stroke: 'var(--line)', 'stroke-width': 0.05 }));
      for (let gy = Math.ceil(y0 / step) * step; gy < y1; gy += step) svg.appendChild(sv('line', { x1: x0, y1: gy, x2: x1, y2: gy, stroke: 'var(--line)', 'stroke-width': 0.05 }));
      if (sh) svg.appendChild(sv('polygon', { points: sh.poly.map(p => p[0] + ',' + p[1]).join(' '), fill: '#000', 'fill-opacity': 0.42 }));
      levels[0].walls.forEach(w => svg.appendChild(sv('line', { x1: w.a[0], y1: w.a[1], x2: w.b[0], y2: w.b[1], stroke: 'var(--text)', 'stroke-width': Math.max(w.t, 0.12), 'stroke-linecap': 'square' })));
      const cx = x0 + (x1 - x0) * 0.09, cy = y0 + (y1 - y0) * 0.14, r = (x1 - x0) * 0.06, g = sv('g', { transform: 'translate(' + cx + ' ' + cy + ') rotate(' + (-S.north) + ')' });
      g.appendChild(sv('circle', { r, fill: 'none', stroke: 'var(--muted)', 'stroke-width': r * 0.06 })); g.appendChild(sv('path', { d: 'M0 ' + (-r) + ' L' + (r * 0.28) + ' ' + (r * 0.2) + ' L0 0 L' + (-r * 0.28) + ' ' + (r * 0.2) + ' Z', fill: 'var(--accent)' }));
      g.appendChild(sv('text', { x: 0, y: -r * 1.15, 'text-anchor': 'middle', 'font-size': r * 0.5, fill: 'var(--text)', text: 'N' })); svg.appendChild(g);
      if (sun.alt > 0) { const b = (sun.az - S.north) * Math.PI / 180, mx = (bb.x0 + bb.x1) / 2, my = (bb.y0 + bb.y1) / 2, R = Math.min(x1 - x0, y1 - y0) * 0.46;
        svg.appendChild(sv('circle', { cx: mx + Math.sin(b) * R, cy: my - Math.cos(b) * R, r: R * 0.05, fill: 'var(--gold)' })); }
      el.appendChild(h('h2', { text: 'Shadow on the lot' })); el.appendChild(svg);
    }
    function drawDome(el, d, sun) {
      clear(el);
      const W = 300, c = W / 2, R = c - 22, svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + W, role: 'img', 'aria-label': 'Sun path chart: the sun height and direction through the day, with the longest and shortest days dashed.', class: 'studio-svg' });
      [0, 30, 60].forEach(a => svg.appendChild(sv('circle', { cx: c, cy: c, r: R * (90 - a) / 90, fill: 'none', stroke: 'var(--line-2)', 'stroke-width': 1 })));
      for (let a = 0; a < 360; a += 45) { const rd = a * Math.PI / 180; svg.appendChild(sv('line', { x1: c, y1: c, x2: c + Math.sin(rd) * R, y2: c - Math.cos(rd) * R, stroke: 'var(--line)', 'stroke-width': 1 }));
        svg.appendChild(sv('text', { x: c + Math.sin(rd) * (R + 12), y: c - Math.cos(rd) * (R + 12) + 4, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)', text: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][a / 45] })); }
      const pt = p => [c + Math.sin(p.az * Math.PI / 180) * R * (90 - p.alt) / 90, c - Math.cos(p.az * Math.PI / 180) * R * (90 - p.alt) / 90];
      const path = (dd, dash, col, wd) => { const pts = ST.sunPath(S.lat, dd).map(pt); if (pts.length > 1) svg.appendChild(sv('polyline', { points: pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), fill: 'none', stroke: col, 'stroke-width': wd, 'stroke-dasharray': dash })); };
      path(172, '5 4', 'var(--muted)', 1.2); path(355, '5 4', 'var(--muted)', 1.2); path(d, null, 'var(--gold)', 2.5);
      for (let t = 6; t <= 18; t += 3) { const p = ST.sunPos(S.lat, d, t); if (p.alt > 0) { const q = pt(p); svg.appendChild(sv('circle', { cx: q[0], cy: q[1], r: 2.5, fill: 'var(--gold)' })); svg.appendChild(sv('text', { x: q[0] + 5, y: q[1] - 4, 'font-size': 10, fill: 'var(--text)', text: t + 'h' })); } }
      if (sun.alt > 0) { const q = pt(sun); svg.appendChild(sv('circle', { cx: q[0], cy: q[1], r: 8, fill: 'var(--gold)', stroke: 'var(--text)', 'stroke-width': 1.5 })); }
      el.appendChild(h('h2', { text: 'Sun path' })); el.appendChild(svg);
      el.appendChild(h('p', { class: 'small muted', text: 'Centre is straight up, the outer ring is the horizon. Dashed lines: the longest and shortest days of the year (northern calendar).' }));
    }
    function drawTable(el, d) {
      clear(el);
      const rows = ST.windowSun(plan, S.lat, d, S.north), sum = ST.orientationSummary(rows);
      el.appendChild(h('h2', { text: 'Sun on windows and glazed doors' }));
      if (!rows.length) { el.appendChild(h('p', { class: 'muted', text: 'No windows on outer walls yet.' })); return; }
      const mx = Math.max.apply(null, rows.map(r => r.hours).concat([1]));
      const tb = h('tbody'); rows.forEach(r => tb.appendChild(h('tr', null, h('td', { text: 'Floor ' + r.floor }), h('td', { text: r.kind + ' ' + app.fl(r.w) + ' x ' + app.fl(r.h) }), h('td', { text: r.dir + ' (' + r.facing + ' deg)' }),
        h('td', { class: 'num', text: f1(r.hours) + ' h' }), h('td', null, h('span', { class: 'studio-bar', style: 'width:' + Math.round(r.hours / mx * 100) + '%' })))));
      el.appendChild(h('table', null, h('thead', null, h('tr', null, ['Floor', 'Opening', 'Faces', 'Direct sun', ''].map(t => h('th', { text: t })))), tb));
      el.appendChild(h('p', { class: 'small muted', text: 'Glass by direction: ' + sum.map(s => s.dir + ' ' + s.n + ' (' + app.fa(s.area) + ', up to ' + f1(s.hours) + ' h)').join('; ') + '.' }));
    }
    update();
  }

  /* ---------- cost risk range ---------- */
  function riskView(box) {
    const d = app.costData(), lines = d.lines.filter(l => l.cost > 0), out = h('div'), money = app.money;
    box.appendChild(h('p', { class: 'muted', text: 'Prices move and quantities are never exact. This runs thousands of what-if versions of your materials estimate (20,000 in a background worker where the browser allows it, 4,000 otherwise), each line nudged at random, and shows the range the total falls in. It spreads out the example prices you already have, so it is only as good as those prices.' }));
    if (!lines.length) { box.appendChild(h('div', { class: 'warn', text: 'Nothing to price yet. Draw some walls first.' })); return; }
    const budgetIn = h('input', { type: 'number', min: 0, step: 100, value: S.budget ? String(S.budget) : '', placeholder: money(d.total * 1.1), 'aria-label': 'Your budget for materials', onchange: e => { S.budget = Math.max(0, parseFloat(e.target.value) || 0); draw(); } });
    box.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' },
      h('div', { class: 'f' }, h('span', { class: 'muted small', text: 'How much prices might move' }), seg([['low', 'Calm'], ['medium', 'Normal'], ['high', 'Wild']], S.vol, v => { S.vol = v; keep(); app.views.studio(); }, 'Price volatility')),
      h('label', { class: 'f' }, 'Share that moves together (' + Math.round(S.rho * 100) + '%)', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: String(S.rho), 'aria-label': 'Share of price movement that is shared across all materials', oninput: e => { S.rho = parseFloat(e.target.value); keep(); draw(); } })),
      numField('Contingency %', S.cont, { min: 0, max: 100, step: 1 }, v => { S.cont = Math.max(0, Math.min(100, v)); keep(); draw(); }),
      h('label', { class: 'f' }, 'Your budget', budgetIn))));
    box.appendChild(out);
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'A range, not a quote or a forecast. ' }), 'The spread comes from the volatility you pick, not from market data. The total covers only the materials in the takeoff, at your price table and region multiplier; it leaves out foundations, plumbing, electrical, heating, fixtures, labour, permits, delivery and tax. Get local quotes before you rely on any figure.'));
    function draw() {
      const o = { vol: S.vol, rho: S.rho, contingency: S.cont, seed: 20260101 };
      out.setAttribute('aria-busy', 'true');
      RISK.run(lines, o).then(r => { if (r.id !== RISK.seq) return; out.removeAttribute('aria-busy'); paint(r.sim, r.tor, r.where); }, err => { out.removeAttribute('aria-busy'); clear(out).appendChild(h('div', { class: 'warn', role: 'alert', text: 'The simulation could not run: ' + err.message })); });
    }
    function paint(sim, tor, where) {
      clear(out);
      const stat = (t, v, sub) => h('div', { class: 'card studio-stat' }, h('div', { class: 'muted small', text: t }), h('div', { class: 'big', text: v }), sub ? h('div', { class: 'small muted', text: sub }) : null);
      out.appendChild(h('div', { class: 'row studio-read', role: 'status', 'aria-live': 'polite' }, stat('Likely low (10th percentile)', money(sim.p10)), stat('Middle (median)', money(sim.p50), 'nominal ' + money(sim.nominal)), stat('Likely high (90th percentile)', money(sim.p90), 'spread ' + money(sim.p90 - sim.p10)),
        stat('Budget for 80% confidence', money(ST.budgetFor(sim, 0.8))), S.budget > 0 ? stat('Chance of staying under ' + money(S.budget), Math.round(ST.chanceUnder(sim, S.budget) * 100) + '%') : null));
      const W = 640, Hh = 200, pad = 28, mxh = Math.max.apply(null, sim.hist), bw = (W - pad * 2) / sim.hist.length, X = v => pad + (v - sim.lo) / ((sim.hi - sim.lo) || 1) * (W - pad * 2);
      const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + (Hh + 30), class: 'studio-svg', role: 'img', 'aria-label': 'Histogram of the total cost across ' + sim.runs + ' what-if runs. Middle ' + money(sim.p50) + ', 10 to 90 percent range ' + money(sim.p10) + ' to ' + money(sim.p90) + '.' });
      sim.hist.forEach((n, i) => { const x = pad + i * bw, mid = sim.lo + (i + 0.5) / sim.hist.length * (sim.hi - sim.lo), inside = mid >= sim.p10 && mid <= sim.p90, bh = n / mxh * (Hh - 20);
        svg.appendChild(sv('rect', { x: x + 1, y: Hh - bh, width: Math.max(bw - 2, 1), height: bh, fill: inside ? 'var(--accent)' : 'var(--line-2)', rx: 2 })); });
      [[sim.p10, 'P10'], [sim.p50, 'P50'], [sim.p90, 'P90']].forEach(m => { svg.appendChild(sv('line', { x1: X(m[0]), y1: 4, x2: X(m[0]), y2: Hh, stroke: 'var(--gold)', 'stroke-width': 1.5, 'stroke-dasharray': m[1] === 'P50' ? null : '4 3' })); svg.appendChild(sv('text', { x: X(m[0]), y: Hh + 14, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text)', text: m[1] })); });
      if (S.budget > sim.lo && S.budget < sim.hi) { svg.appendChild(sv('line', { x1: X(S.budget), y1: 4, x2: X(S.budget), y2: Hh, stroke: 'var(--good)', 'stroke-width': 2 })); svg.appendChild(sv('text', { x: X(S.budget), y: Hh + 27, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--good)', text: 'budget' })); }
      svg.appendChild(sv('text', { x: pad, y: Hh + 27, 'font-size': 11, fill: 'var(--muted)', text: money(sim.lo) })); svg.appendChild(sv('text', { x: W - pad, y: Hh + 27, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)', text: money(sim.hi) }));
      out.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Where the total lands' }), svg, h('p', { class: 'small muted', id: 'risk-where', text: sim.runs.toLocaleString('en-US') + ' runs, ' + (where === 'worker' ? 'computed in a background worker.' : 'computed on this page.') })));
      const top = tor.slice(0, 8), mxs = top.length ? top[0].swing : 1;
      out.appendChild(h('div', { class: 'card scroll-x' }, h('h2', { text: 'What moves the total most' }), h('p', { class: 'small muted', text: 'Each group varied alone: the 10 to 90 percent swing. Firm up quotes for the top rows first.' }),
        h('table', null, h('thead', null, h('tr', null, ['Group', 'Likely low', 'Likely high', 'Swing', ''].map(t => h('th', { text: t })))), h('tbody', null, top.map(t => h('tr', null, h('td', { text: t.group }), h('td', { class: 'num', text: money(t.low) }), h('td', { class: 'num', text: money(t.high) }), h('td', { class: 'num', text: money(t.swing) }), h('td', null, h('span', { class: 'studio-bar', style: 'width:' + Math.round(t.swing / mxs * 100) + '%' }))))))));
    }
    draw();
  }

  /* ---------- export ---------- */
  function exportView(box) {
    const msg = h('div', { class: 'small', role: 'status', 'aria-live': 'polite', style: 'min-height:1.4em;margin-top:8px' });
    const parts = (m, scale) => [{ name: 'Structure', data: m.base }, { name: 'Roof', data: m.roof }, { name: 'Glass', data: m.glass, alpha: 0.35 }];
    const run = (kind, scope) => {
      try {
        const m = scope === 'site' ? M.buildSite(app.site) : M.buildPlan(app.plan), P = parts(m), name = app.slug(scope === 'site' ? 'site' : app.plan.name), tri = P.reduce((s, p) => s + p.data.length / 27, 0);
        if (scope === 'site' && !app.site.buildings.length) { msg.textContent = 'The site has no buildings yet. Add some in the Site tab, or export this building.'; return; }
        if (kind === 'glb') app.download(name + '.glb', ST.toGLB(P, app.plan.name), 'model/gltf-binary'); else app.download(name + '.obj', ST.toOBJ(P, app.plan.name), 'text/plain');
        msg.textContent = 'Saved ' + name + '.' + kind + ' to your downloads (' + Math.round(tri).toLocaleString('en-US') + ' triangles, metres, Y up).';
      } catch (err) { msg.textContent = 'Could not build the model: ' + err.message; }
    };
    box.appendChild(h('p', { class: 'muted', text: 'Take the 3D model into Blender, a game engine, a web viewer or a render tool. The file is built here, on this computer, and goes straight to your downloads.' }));
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'This building: ' + app.plan.name }), h('p', { class: 'muted', text: 'Every floor, walls with openings, glass, stairs, furniture and the roof. Colours are stored per vertex; glass is a separate see-through material.' }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => run('glb', 'plan') }, 'Download .glb (glTF binary)'), h('button', { type: 'button', class: 'btn', onclick: () => run('obj', 'plan') }, 'Download .obj'))));
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Whole site' }), h('p', { class: 'muted', text: 'The lot, every building placed and turned as on the site map, paths and utility markers.' }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => run('glb', 'site') }, 'Download site .glb'), h('button', { type: 'button', class: 'btn', onclick: () => run('obj', 'site') }, 'Download site .obj')), msg));
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'A layout sketch, not construction documents. ' }), 'The model is plain blocks generated from your plan, with no textures. The roof is estimated over the top floor and the furniture is simple shapes. Units are metres.'));
  }

  /* ---------- command palette ---------- */
  let pal = null;
  function commands() {
    const go = t => () => { location.hash = '#/' + t; };
    const list = [];
    [['plan', 'Floor plan'], ['view3d', '3D view'], ['site', 'Site planner'], ['library', 'Design library'], ['costs', 'Materials and cost'], ['planning', 'Planning: energy, schedule, permits'], ['studio', 'Studio'], ['project', 'Project, save and export'], ['about', 'About']].forEach(t => list.push({ label: 'Go to ' + t[1], hint: 'open tab', run: go(t[0]) }));
    list.push({ label: 'Sun and shadow study', hint: 'sun daylight orientation window', run: () => { S.view = 'sun'; location.hash = '#/studio'; app.views.studio(); } });
    list.push({ label: 'Cost risk range', hint: 'monte carlo what if budget confidence', run: () => { S.view = 'risk'; location.hash = '#/studio'; app.views.studio(); } });
    list.push({ label: 'Export 3D model (.glb, .obj)', hint: 'blender gltf obj download', run: () => { S.view = 'export'; location.hash = '#/studio'; app.views.studio(); } });
    list.push({ label: 'Save 3D view as PNG picture', hint: 'export image screenshot render', run: () => { if (app.picture) app.picture.go('pic-3d'); } });
    list.push({ label: 'Save floor plan as PNG picture', hint: 'export image plan png', run: () => { if (app.picture) app.picture.go('pic-plan'); } });
    list.push({ label: 'Printable overview sheet: plan, 3D view, materials', hint: 'print one page pdf summary', run: () => { if (app.picture) app.picture.showSheet(); } });
    list.push({ label: 'Scaled plan: save SVG, to a chosen scale', hint: 'scale drawing svg sheet', run: () => { if (app.scaled) app.scaled.go('sc-svg'); } });
    list.push({ label: 'Scaled plan: save DXF for CAD', hint: 'dxf drawing layers cad', run: () => { if (app.scaled) app.scaled.go('sc-dxf'); } });
    list.push({ label: 'Scaled plan: print or save as PDF on a real sheet size', hint: 'pdf a3 a4 letter tabloid', run: () => { if (app.scaled) app.scaled.go('sc-pdf'); } });
    list.push({ label: 'Switch to metric units', hint: 'meters', run: () => app.setUnits('metric') }, { label: 'Switch to imperial units', hint: 'feet inches', run: () => app.setUnits('imperial') });
    list.push({ label: 'Switch light or dark theme', hint: 'theme colour', run: () => $('#theme-btn').click() }, { label: 'Undo', hint: 'ctrl z', run: () => app.undo() }, { label: 'Redo', hint: 'ctrl y', run: () => app.redo() });
    list.push({ label: 'Add a floor above', hint: 'storey level', run: () => { location.hash = '#/plan'; app.addFloor(); } });
    list.push({ label: 'Save project file', hint: 'download json', run: () => app.download(app.slug(app.plan.name) + '.starkbuilder.json', JSON.stringify(app.projectObject(), null, 1), 'application/json') });
    list.push({ label: 'Download materials CSV', hint: 'spreadsheet takeoff', run: () => { const d = app.costData(); app.download(app.slug(d.name) + '-materials.csv', SB.takeoff.toCSV(d.lines, { name: d.name, mult: app.mult(), currency: app.currency }), 'text/csv'); } });
    SB.templates.list.forEach(t => list.push({ label: 'Open design: ' + t.name, hint: 'library template layout', run: () => { app.plan = app.clone(t.plan); app.level = 0; app.sel = null; app.editor.fitted = false; app.commit('Open design'); app.floorUI(); location.hash = '#/plan'; app.say('Opened ' + t.name + '. Ctrl+Z brings your previous plan back.'); } }));
    C.levels(app.plan).forEach((lv, k) => lv.rooms.forEach(r => { if (r.name) list.push({ label: 'Room: ' + r.name + (C.levels(app.plan).length > 1 ? ' (floor ' + (k + 1) + ')' : ''), hint: app.fa(C.polyArea(r.pts)), run: () => { location.hash = '#/plan'; app.setLevel(k); app.say(r.name + ': ' + app.fa(C.polyArea(r.pts)) + '.'); } }); }));
    return list;
  }
  function closePalette() { if (!pal) return; const back = pal.back; pal.el.remove(); pal = null; if (back && back.focus) back.focus(); }
  function openPalette() {
    if (pal) { pal.input.focus(); return; }
    const all = commands(), back = document.activeElement;
    const input = h('input', { type: 'text', class: 'pal-input', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', placeholder: 'Type a command, or ask: how many windows? what does it cost?', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Command palette' });
    const listEl = h('ul', { id: 'pal-list', role: 'listbox', class: 'pal-list', 'aria-label': 'Results' }), ans = h('div', { class: 'pal-answer', role: 'status', 'aria-live': 'polite' });
    const card = h('div', { class: 'card pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' }, input, ans, listEl, h('div', { class: 'small muted pal-foot', text: 'Up and down to choose, Enter to run, Esc to close. Ctrl+K opens this any time.' }));
    const el = h('div', { class: 'modal pal-wrap', onmousedown: e => { if (e.target === el) closePalette(); } }, card); document.body.appendChild(el);
    pal = { el, input, back }; let shown = [], idx = 0;
    const paint = () => {
      clear(listEl); shown.forEach((it, i) => listEl.appendChild(h('li', { id: 'pal-' + i, role: 'option', 'aria-selected': i === idx ? 'true' : 'false', class: 'pal-item', onmousemove: () => { if (idx !== i) { idx = i; paint(); } }, onclick: () => run(it) }, h('span', { text: it.label }), it.hint && it.hint.length < 24 ? h('span', { class: 'muted small', text: it.hint }) : null)));
      input.setAttribute('aria-activedescendant', shown.length ? 'pal-' + idx : '');
    };
    const run = it => { closePalette(); try { it.run(); } catch (err) { app.say('That command did not work: ' + err.message); } };
    const refresh = () => {
      const q = input.value.trim(); shown = q ? ST.rank(q, all, 8) : all.slice(0, 8); idx = 0; paint();
      let a = null; try { a = q.length > 3 ? ST.ask(q, app.plan, { units: app.units, money: app.money, total: app.costData().total }) : null; } catch (e) { a = null; }
      ans.textContent = a || ''; ans.hidden = !a;
    };
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (shown.length) { idx = (idx + 1) % shown.length; paint(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) { idx = (idx - 1 + shown.length) % shown.length; paint(); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[idx]) run(shown[idx]); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      else if (e.key === 'Tab') { e.preventDefault(); }
    });
    refresh(); input.focus();
  }
  app.openPalette = openPalette;
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); if (pal) closePalette(); else openPalette(); } });
  const bar = document.querySelector('.topbar'), themeBtn = $('#theme-btn');
  if (bar && themeBtn) bar.insertBefore(h('button', { type: 'button', class: 'btn', id: 'pal-btn', title: 'Command palette (Ctrl+K)', 'aria-label': 'Open the command palette', onclick: () => openPalette() }, 'Search  Ctrl+K'), themeBtn);
})();
