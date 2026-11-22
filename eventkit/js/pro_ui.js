/* Stark Event Kit pro screens: command palette (Ctrl+K), What-if Lab, Door passes and sealed backups, Night replay. */
(function (g) {
  'use strict';
  var S = g.SEK, UI = S.ui, h = UI.h, R = UI.routes, doc = g.document, SVGNS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#0d9488', '#d97706', '#7c3aed', '#e11d48', '#2563eb', '#65a30d', '#db2777', '#64748b'], DASH = ['', '7 4', '2 3', '10 3 2 3', '', '7 4', '2 3', '10 3 2 3'];
  function btn(label, on, cls, attrs) { var a = attrs || {}; a.type = 'button'; a.class = 'btn ' + (cls || ''); a.onclick = on; return h('button', a, label); }
  function num(v, id, on, min, max, step) { return h('input', { type: 'number', id: id, value: String(v), min: String(min), max: String(max), step: String(step || 1), onchange: function (e) { on(+e.target.value); } }); }
  function reduced() { try { return g.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function svg(tag, attrs) {
    var e = doc.createElementNS(SVGNS, tag), k, i, c;
    for (k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
    for (i = 2; i < arguments.length; i++) { c = arguments[i]; if (c == null) continue; if (Array.isArray(c)) c.forEach(function (x) { if (x) e.appendChild(x); }); else e.appendChild(c); }
    return e;
  }
  function stxt(x, y, text, o) { var e = svg('text', Object.assign({ x: x, y: y, fill: 'currentColor', 'font-size': 11 }, o || {})); e.textContent = text; return e; }
  function fmtMin(m) { m = Math.round(m); return (m >= 60 ? Math.floor(m / 60) + ' h ' : '') + (m % 60) + ' min'; }
  function pctText(p) { return Math.round(p * 100) + '%'; }
  function bars(data, w, ht, label, color, mark) {
    var max = 0, bw, pad = 26, el;
    data.forEach(function (d) { if (d.n > max) max = d.n; });
    bw = (w - 8) / data.length;
    el = svg('svg', { viewBox: '0 0 ' + w + ' ' + (ht + pad), class: 'chart', role: 'img', 'aria-label': label, width: '100%', preserveAspectRatio: 'xMidYMid meet' },
      data.map(function (d, i) { var bh = max ? Math.max(1, d.n / max * (ht - 6)) : 1; return svg('rect', { x: 4 + i * bw + 1, y: ht - bh, width: Math.max(1, bw - 2), height: bh, fill: color, opacity: mark != null && d.to <= mark ? 1 : (mark == null ? 0.85 : 0.35) }); }),
      mark != null && data[0].from < mark && mark < data[data.length - 1].to ? svg('line', { x1: 4 + (mark - data[0].from) / (data[data.length - 1].to - data[0].from) * (w - 8), x2: 4 + (mark - data[0].from) / (data[data.length - 1].to - data[0].from) * (w - 8), y1: 0, y2: ht, stroke: 'currentColor', 'stroke-width': 2, 'stroke-dasharray': '4 3' }) : null);
    return el;
  }

  /* ---------- command palette ---------- */
  var PAL = { open: false, el: null, input: null, list: null, items: [], sel: 0, from: null };
  var ROUTES = [['Home', 'home'], ['New event', 'new'], ['Host panel', 'control'], ['Question bank', 'bank'], ['Event planner', 'plan'], ['Bracket tournament', 'bracket'], ['League and season', 'league'], ['Prize draw', 'raffle'], ['Game jam', 'jam'],
    ['Results and print', 'results'], ['Score paper answers', 'score'], ['Projector leaderboard', 'leaderboard'], ['Templates', 'templates'], ['What-if Lab', 'lab'], ['Door passes and sealed backups', 'vault'], ['Night replay', 'replay'], ['Back up or restore', 'backup'], ['Stream overlay', 'overlay'], ['Presenter view', 'present']];
  var PLAN_TABS = [['Guests and check-in', 'guests'], ['Seating', 'seating'], ['Run of show', 'show'], ['Budget', 'budget'], ['Volunteers', 'crew']];
  function items(query) {
    var out = [], G = S.load('guests'), SE = S.load('seating'), ask, list;
    var cmds = [];
    ROUTES.forEach(function (r) { if (R[r[1]]) cmds.push({ kind: 'Go to', label: r[0], run: function () { UI.go('#/' + r[1]); } }); });
    PLAN_TABS.forEach(function (t) { cmds.push({ kind: 'Planner', label: t[0], run: function () { UI.go('#/plan?tab=' + t[1]); } }); });
    cmds.push({ kind: 'Action', label: 'Switch theme (dark or light)', run: function () { var b = doc.getElementById('theme-toggle'); if (b) b.click(); } });
    cmds.push({ kind: 'Action', label: 'Print this page', run: function () { UI.print(); } });
    cmds.push({ kind: 'Action', label: 'Open the presenter window', run: function () { if (S.host && S.host.openPresenter) S.host.openPresenter(); else UI.go('#/present'); } });
    cmds.push({ kind: 'Action', label: 'Toggle full screen', run: function () { try { if (doc.fullscreenElement) doc.exitFullscreen(); else doc.documentElement.requestFullscreen(); } catch (e) { UI.toast('Full screen is not available here.'); } } });
    ask = query ? S.nlq.run(query, { G: G, SE: SE }) : null;
    if (ask && ask.structured) {
      out.push({ kind: 'Ask', label: ask.text, detail: ask.people.slice(0, 6).map(function (p) { return p.name; }).join(', ') + (ask.total > 6 ? ' and ' + (ask.total - 6) + ' more' : ''), run: function () { UI.go('#/plan?tab=guests&find=' + encodeURIComponent(query)); } });
    }
    list = query ? S.fuzzy.rank(query, cmds, function (c) { return c.kind + ' ' + c.label; }, 8) : cmds.slice(0, 9);
    out = out.concat(list);
    if (query && query.length >= 2) {
      S.fuzzy.rank(query, G.people, function (p) { return p.name + ' ' + p.team; }, 5).forEach(function (p) {
        out.push({ kind: 'Guest', label: p.name + (p.team ? ' (' + p.team + ')' : ''), detail: p.status === 'waitlist' ? 'waiting list' : p.inAt ? 'checked in' : p.status === 'cancelled' ? 'cancelled' : 'not in yet', run: function () { UI.go('#/plan?tab=guests&find=' + encodeURIComponent(p.name)); } });
      });
    }
    return out;
  }
  function palDraw() {
    var q = PAL.input.value.trim(), i;
    PAL.items = items(q); if (PAL.sel >= PAL.items.length) PAL.sel = Math.max(0, PAL.items.length - 1);
    UI.clear(PAL.list);
    PAL.items.forEach(function (it, i2) {
      var li = h('li', { role: 'option', id: 'pal-o' + i2, class: 'pal-item' + (i2 === PAL.sel ? ' on' : ''), 'aria-selected': i2 === PAL.sel ? 'true' : 'false', onclick: function () { palRun(i2); } },
        h('span', { class: 'pal-kind', text: it.kind }), h('span', { class: 'pal-label' }, it.label, it.detail ? h('small', { text: it.detail }) : null));
      PAL.list.appendChild(li);
    });
    if (!PAL.items.length) PAL.list.appendChild(h('li', { class: 'pal-empty', role: 'presentation', text: 'Nothing found. Try a page name, a guest, or ask: unpaid guests.' }));
    i = PAL.items.length ? 'pal-o' + PAL.sel : ''; if (i) PAL.input.setAttribute('aria-activedescendant', i); else PAL.input.removeAttribute('aria-activedescendant');
    var on = PAL.list.querySelector('.on'); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }
  }
  function palRun(i) { var it = PAL.items[i]; if (!it) return; palClose(true); try { it.run(); } catch (e) { UI.toast('That action is not available here.'); } }
  function palClose(skipFocus) {
    if (!PAL.open) return; PAL.open = false; PAL.el.hidden = true;
    if (!skipFocus && PAL.from && PAL.from.focus) { try { PAL.from.focus(); } catch (e) { /* ignore */ } }
  }
  function palOpen() {
    if (!PAL.el) {
      PAL.input = h('input', { type: 'text', id: 'pal-input', role: 'combobox', autocomplete: 'off', spellcheck: 'false', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', 'aria-label': 'Command palette: type a page, a guest, or a question such as unpaid guests',
        placeholder: 'Go to a page, find a guest, or ask: not checked in', oninput: function () { PAL.sel = 0; palDraw(); } });
      PAL.list = h('ul', { id: 'pal-list', role: 'listbox', 'aria-label': 'Results' });
      PAL.el = h('div', { id: 'palette', class: 'palette noprint', hidden: true, onclick: function (e) { if (e.target === PAL.el) palClose(); } },
        h('div', { class: 'pal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' }, PAL.input, PAL.list,
          h('p', { class: 'fine pal-help', text: 'Arrow keys to move, Enter to open, Esc to close. Press Ctrl+K (or Cmd+K) anywhere.' })));
      PAL.el.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); palClose(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (PAL.items.length) { PAL.sel = (PAL.sel + 1) % PAL.items.length; palDraw(); } }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (PAL.items.length) { PAL.sel = (PAL.sel + PAL.items.length - 1) % PAL.items.length; palDraw(); } }
        else if (e.key === 'Enter') { e.preventDefault(); palRun(PAL.sel); }
        else if (e.key === 'Tab') { e.preventDefault(); }
      });
      doc.body.appendChild(PAL.el);
    }
    PAL.from = doc.activeElement; PAL.open = true; PAL.el.hidden = false; PAL.input.value = ''; PAL.sel = 0; palDraw(); PAL.input.focus();
  }
  S.palette = { open: palOpen, close: palClose, items: items };
  doc.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (PAL.open) palClose(); else if (!doc.body.classList.contains('present') && !doc.body.classList.contains('overlay')) palOpen(); }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !PAL.open && !doc.body.classList.contains('present') && !doc.body.classList.contains('overlay')) { e.preventDefault(); palOpen(); }
  });
  (function addButton() {
    var bar = doc.getElementById('topbar'), tg = doc.getElementById('theme-toggle');
    if (!bar || !tg) return;
    bar.insertBefore(h('button', { type: 'button', class: 'btn small', id: 'pal-open', 'aria-label': 'Open the command palette (Ctrl+K)', onclick: palOpen }, 'Search / ask  Ctrl+K'), tg);
  })();

  /* ---------- What-if Lab ---------- */
  R.lab = function (root, q) {
    var tab = q.tab === 'money' ? 'money' : 'show', D = { show: S.load('show'), plan: S.load('plan'), budget: S.load('budget'), guests: S.load('guests') };
    var st = S.store.get('lab', null) || {}, P = { spread: st.spread != null ? st.spread : 25, bias: st.bias != null ? st.bias : 5, curfewH: st.curfewH || '', curfew: null };
    var T = S.budget.totals(D.budget), reg = S.reg.stats(D.guests).registered;
    var M = { price: Math.round((T.ticketsEst && D.budget.attendees ? T.ticketsEst / D.budget.attendees : 1000)), demand: D.budget.attendees || reg || 60, elasticity: 1, capacity: D.guests.capacity || 0, noShow: 10, spread: 15, perHead: 0 };
    function persist() { try { g.localStorage.setItem('sek.lab', JSON.stringify({ spread: P.spread, bias: P.bias, curfewH: P.curfewH })); } catch (e) { /* ignore */ } }
    function draw() {
      UI.clear(root);
      root.appendChild(h('h1', { text: 'What-if Lab' }));
      root.appendChild(h('p', { class: 'muted', text: 'Run thousands of simulated nights on this computer to see how likely it is that you finish on time or cover your costs. These are planning estimates from the assumptions you set, not predictions.' }));
      root.appendChild(UI.tabs([['show', 'Will we finish on time?'], ['money', 'Ticket price and profit']], tab, function (t) { tab = t; draw(); }));
      (tab === 'show' ? tShow : tMoney)();
    }
    function tShow() {
      var items = D.show.items, start = S.hm(D.plan.start); if (start == null) start = 19 * 60;
      var box = h('div', { id: 'lab-out' }), live = h('p', { class: 'sr-only', id: 'lab-live', role: 'status' });
      if (!items.length) { root.appendChild(h('div', { class: 'card' }, h('p', { text: 'Add a running order first.' }), h('a', { class: 'btn primary', href: '#/plan?tab=show', text: 'Open run of show' }))); return; }
      var cf = P.curfewH && S.hm(P.curfewH) != null ? S.hm(P.curfewH) : null;
      function sim() { labQueue(run); }
      function run() {
        UI.clear(box);
        var r = S.sim.show(items, { spread: P.spread / 100, bias: P.bias / 100, runs: 3000, seed: 20260101, curfew: cf != null ? ((cf - start) + 1440) % 1440 : null }), pl = r.planned;
        box.appendChild(UI.kpis([['planned length', fmtMin(pl)], ['most likely finish (median)', S.fmtHm(start + r.p50)], ['90% of nights finish by', S.fmtHm(start + r.p90), r.p90 > pl * 1.15 ? 'warn' : ''],
          cf != null ? ['chance of finishing by ' + S.fmtHm(cf), pctText(r.probOnTime), r.probOnTime >= 0.9 ? 'good' : r.probOnTime >= 0.6 ? 'warn' : 'bad'] : ['earliest 10%', S.fmtHm(start + r.p10)]]));
        labSay(live, 'Median finish ' + S.fmtHm(start + r.p50) + ', 90% by ' + S.fmtHm(start + r.p90) + (cf != null ? ', ' + pctText(r.probOnTime) + ' chance of finishing by ' + S.fmtHm(cf) : '') + '.');
        if (cf != null) box.appendChild(h('p', { id: 'lab-verdict', text: r.buffer > 0 ? 'To be 90% sure of finishing by ' + S.fmtHm(cf) + ', cut or shorten about ' + r.buffer + ' minute' + (r.buffer === 1 ? '' : 's') + ' from the plan, or start earlier.' : 'Your plan finishes by ' + S.fmtHm(cf) + ' in at least 9 of 10 simulated nights.' }));
        box.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Possible finish times' }), bars(r.hist, 600, 130, 'Histogram of simulated total running time from ' + fmtMin(r.min) + ' to ' + fmtMin(r.max), '#0d9488', cf != null ? ((cf - start) + 1440) % 1440 : null),
          h('p', { class: 'fine', text: 'Each bar is how many of ' + r.runs + ' simulated nights ended at that time. ' + (cf != null ? 'Solid bars finish by your cut-off.' : 'Set a cut-off time to see the chance of finishing by then.') })));
        box.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Segments most likely to move your finish' }),
          h('ol', { id: 'lab-crit' }, r.critical.map(function (c) { return h('li', { text: c.title + ': planned ' + c.planned + ' min, typically ' + Math.round(c.mean) + ' min, accounts for ' + pctText(c.share) + ' of the uncertainty.' }); }))));
      }
      root.appendChild(h('div', { class: 'card noprint' }, h('div', { class: 'grid g4' },
        UI.field('How loosely do segments keep to time? (' + P.spread + '%)', h('input', { type: 'range', min: '0', max: '80', value: String(P.spread), id: 'lab-spread', oninput: function (e) { P.spread = +e.target.value; e.target.previousSibling.textContent = 'How loosely do segments keep to time? (' + P.spread + '%)'; persist(); sim(); } }), 'lab-spread'),
        UI.field('Usual overrun (' + P.bias + '%)', h('input', { type: 'range', min: '-10', max: '40', value: String(P.bias), id: 'lab-bias', oninput: function (e) { P.bias = +e.target.value; persist(); sim(); } }), 'lab-bias'),
        UI.field('Must finish by (optional)', h('input', { type: 'time', value: P.curfewH, id: 'lab-curfew', onchange: function (e) { P.curfewH = e.target.value; cf = S.hm(P.curfewH); persist(); sim(); } }), 'lab-curfew'))));
      root.appendChild(live); root.appendChild(box); run();
    }
    function tMoney() {
      var box = h('div', { id: 'lab-out' }), live = h('p', { class: 'sr-only', id: 'lab-live', role: 'status' }), cur = S.cur.of(D.plan), dec = cur.dec, loc = S.cur.locale();
      if (S.cur.ensure(D.plan, D.budget.items.length || D.guests.types.length)) S.save('plan', D.plan);
      cur = S.cur.of(D.plan); dec = cur.dec;
      function money(c) { return S.cur.fmt(c, cur, loc); }
      function model() { var o = S.budget.totals(D.budget, S.cur.unit(cur)), other = 0; D.budget.items.forEach(function (it) { if (it.kind === 'income' && !/^tickets?$/i.test(String(it.cat).trim())) other += it.est; });
        return { price: M.price, basePrice: M.price, demand: M.demand, elasticity: M.elasticity, capacity: M.capacity, noShow: M.noShow / 100, spread: M.spread / 100, fixedExp: o.exp.est, otherIncome: other, perHead: M.perHead }; }
      function sim() { labQueue(run); }
      function run() {
        UI.clear(box);
        var m = model(), r = S.sim.money(m, { runs: 2500, seed: 20260102 }), lo = Math.max(100, Math.round(m.price * 0.4)), hi = Math.max(lo + 100, Math.round(m.price * 2.2)), sw = S.sim.priceSweep(m, lo, hi, 14, { runs: 500, seed: 7 });
        box.appendChild(UI.kpis([['chance to cover costs', pctText(r.probProfit), r.probProfit >= 0.85 ? 'good' : r.probProfit >= 0.5 ? 'warn' : 'bad'], ['typical result (median)', money(r.p50), r.p50 >= 0 ? 'good' : 'bad'], ['bad night (10th percentile)', money(r.p10)], ['good night (90th percentile)', money(r.p90)],
          ['tickets needed to break even', r.breakEvenSold == null ? 'not reachable' : String(r.breakEvenSold)]]));
        labSay(live, pctText(r.probProfit) + ' chance to cover costs; typical result ' + money(r.p50) + '.');
        if (m.capacity > 0 && r.probFull > 0.05) box.appendChild(h('p', { class: 'status-wrong', text: 'The room fills in ' + pctText(r.probFull) + ' of simulated nights: a higher price would cost you little demand you cannot seat anyway.' }));
        box.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Possible results' }), bars(r.hist, 600, 130, 'Histogram of simulated results from ' + money(r.hist[0].from) + ' to ' + money(r.hist[r.hist.length - 1].to), '#2563eb', null),
          h('p', { class: 'fine', text: 'Costs come from your Budget estimates (' + money(m.fixedExp) + '), other income ' + money(m.otherIncome) + '. Results left of zero lose money.' })));
        var pts = sw.points, maxm = Math.max.apply(null, pts.map(function (p) { return p.mean; })), minm = Math.min.apply(null, pts.map(function (p) { return p.mean; })), W = 600, H = 150, span = maxm - minm || 1;
        var X = function (i) { return 30 + i / (pts.length - 1) * (W - 40); }, Y = function (v) { return 10 + (1 - (v - minm) / span) * (H - 20); };
        box.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Average result by ticket price' }),
          svg('svg', { viewBox: '0 0 ' + W + ' ' + (H + 22), class: 'chart', role: 'img', 'aria-label': 'Average result for ticket prices from ' + money(lo) + ' to ' + money(hi) + '; best near ' + money(sw.best.price), width: '100%' },
            svg('polyline', { points: pts.map(function (p, i) { return X(i) + ',' + Y(p.mean); }).join(' '), fill: 'none', stroke: '#d97706', 'stroke-width': 2.5 }),
            pts.map(function (p, i) { return svg('circle', { cx: X(i), cy: Y(p.mean), r: p.price === sw.best.price ? 6 : 3, fill: '#d97706' }); }),
            stxt(30, H + 16, money(lo)), stxt(W - 10, H + 16, money(hi), { 'text-anchor': 'end' }), stxt(X(pts.indexOf(sw.best)), Math.max(10, Y(sw.best.mean) - 10), 'best ' + money(sw.best.price), { 'text-anchor': 'middle', 'font-weight': 700 })),
          h('p', { class: 'fine', text: 'Under your assumptions, an average result is highest near ' + money(sw.best.price) + '. If demand reacts less to price than you assume, the best price moves up.' })));
      }
      function fld(label, id, val, min, max, step, key) { return UI.field(label, num(val, id, function (v) { M[key] = isFinite(v) ? Math.max(min, Math.min(max, v)) : min; sim(); }, min, max, step), id); }
      root.appendChild(h('div', { class: 'card noprint' }, h('div', { class: 'grid g4' },
        UI.field('Ticket price (' + S.cur.label(cur) + ')', num((M.price / 100).toFixed(dec), 'lab-price', function (v) { M.price = Math.max(0, Math.round(v * (dec ? 100 : 1)) * (dec ? 1 : 100)); sim(); }, 0, 100000, dec ? 0.5 : 1), 'lab-price'),
        fld('Tickets you expect to sell at that price', 'lab-demand', M.demand, 0, 100000, 1, 'demand'), fld('Room capacity (0 means no limit)', 'lab-cap', M.capacity, 0, 100000, 1, 'capacity'),
        fld('Buyers who do not come (%)', 'lab-noshow', M.noShow, 0, 95, 1, 'noShow'), fld('Demand uncertainty (%)', 'lab-spread', M.spread, 0, 100, 1, 'spread'),
        fld('Price sensitivity (0 none, 1 typical, 3 high)', 'lab-el', M.elasticity, 0, 4, 0.1, 'elasticity'),
        UI.field('Cost per person who attends (' + S.cur.label(cur) + ')', num((M.perHead / 100).toFixed(dec), 'lab-per', function (v) { M.perHead = Math.max(0, Math.round(v * (dec ? 100 : 1)) * (dec ? 1 : 100)); sim(); }, 0, 10000, dec ? 0.5 : 1), 'lab-per'))));
      root.appendChild(live); root.appendChild(box); run();
    }
    draw();
  };
  /* What-if Lab pacing: a dragged slider fires dozens of input events; run the simulation once per frame and announce
     only a one-line summary (after the user pauses) instead of making the whole results panel a live region. */
  var labPending = null, labSayT = 0;
  function labQueue(fn) { var raf = g.requestAnimationFrame || function (f) { return setTimeout(f, 16); }; if (labPending) { labPending = fn; return; } labPending = fn; raf(function () { var f = labPending; labPending = null; if (f) f(); }); }
  function labSay(el, text) { clearTimeout(labSayT); labSayT = setTimeout(function () { if (el.textContent !== text) el.textContent = text; }, 700); }

  /* ---------- Door passes and sealed backups ---------- */
  R.vault = function (root, q) {
    var tab = q.tab === 'seal' ? 'seal' : 'pass', PS = S.load('passes'), G = S.load('guests'), SE = S.load('seating'), tbl = null, last = null, busy = false;
    function saveP() { S.save('passes', PS); }
    /* full version only */
    function draw() {
      UI.clear(root);
      root.appendChild(h('h1', { text: 'Door passes and sealed backups' }));
      root.appendChild(h('p', { class: 'muted', text: 'Signed passes catch forged and re-used codes at the door; sealed backups lock your guest data behind a passphrase. Everything is calculated on this computer with the browser\'s own cryptography.' }));
      root.appendChild(UI.tabs([['pass', 'Door passes'], ['seal', 'Sealed backup']], tab, function (t) { tab = t; draw(); }));
      (tab === 'pass' ? tPass : tSeal)();
    }
    function tPass() { root.appendChild(window.StarkTrial.card('door_passes')); }
    function tSeal() {
      var pass = h('input', { type: 'password', id: 'seal-pass', autocomplete: 'new-password', 'aria-describedby': 'seal-str' }), meter = h('p', { id: 'seal-str', class: 'fine', role: 'status', text: 'Use at least 12 characters: three or more unrelated words work well.' }),
        res = h('p', { id: 'seal-msg', role: 'status', 'aria-live': 'polite' }), ta = h('textarea', { rows: '4', id: 'open-text', 'aria-label': 'Sealed backup file contents', placeholder: 'Choose a sealed backup file, or paste its contents.' }), pass2 = h('input', { type: 'password', id: 'open-pass', autocomplete: 'off' }), parsed = null, outp = h('div', { id: 'open-out', role: 'status' });
      if (!S.vault.available()) { root.appendChild(h('div', { class: 'card' }, h('p', { class: 'status-wrong', text: 'This browser does not offer WebCrypto here, so sealed backups are not available. The normal backup on the Back up page still works.' }))); return; }
      pass.addEventListener('input', function () { var s = S.vault.strength(pass.value); meter.textContent = pass.value ? 'Passphrase strength: ' + s.label + ' (about ' + s.bits + ' bits).' + (S.vault.passIssue(pass.value) ? ' ' + S.vault.passIssue(pass.value) : '') : 'Use at least 12 characters: three or more unrelated words work well.'; });
      root.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Seal everything' }), h('p', { class: 'fine', text: 'Encrypts all saved events, guests and questions with AES-256-GCM. The key comes from your passphrase through PBKDF2 (' + S.vault.ITER.toLocaleString('en') + ' rounds). There is no way to recover the file without the passphrase, so write it down somewhere safe.' }),
        UI.field('Passphrase', pass, 'seal-pass'), meter,
        h('div', { class: 'row' }, btn('Seal and download', function () {
          var data = S.backup.collect(), b = S.backup.make(data, Date.now()); res.textContent = 'Sealing (this takes a second)...'; res.className = '';
          S.vault.seal(JSON.stringify(b), pass.value).then(function (r) { if (r.error) { res.textContent = r.error; res.className = 'status-wrong'; pass.setAttribute('aria-invalid', 'true'); pass.setAttribute('aria-describedby', 'seal-str seal-msg'); pass.focus(); return; } pass.removeAttribute('aria-invalid'); UI.download('stark-event-kit-sealed-' + b.savedAt.slice(0, 10) + '.sealed.json', r.text, 'application/json'); res.textContent = 'Sealed backup saved. Test it by opening it below before you rely on it.'; res.className = 'status-right'; });
        }, 'primary', { id: 'seal-go' })), res));
      root.appendChild(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Open a sealed backup' }),
        h('input', { type: 'file', accept: '.json', 'aria-label': 'Sealed backup file', onchange: function (e) { UI.readFile(e.target, function (t) { ta.value = t; }); } }), h('div', { style: { height: '8px' } }), ta, UI.field('Passphrase', pass2, 'open-pass'),
        h('div', { class: 'row' }, btn('Unlock and check', function () {
          UI.clear(outp); parsed = null; outp.appendChild(h('p', { text: 'Unlocking...' }));
          S.vault.open(ta.value, pass2.value).then(function (r) {
            UI.clear(outp); if (r.error) { outp.appendChild(h('p', { class: 'status-wrong', text: r.error })); return; }
            var p = S.backup.parse(r.text); if (p.error) { outp.appendChild(h('p', { class: 'status-wrong', text: p.error })); return; }
            parsed = p; outp.appendChild(h('p', { class: 'status-right', text: 'Unlocked. ' + p.note + ' It holds ' + p.keys.length + ' section' + (p.keys.length === 1 ? '' : 's') + '. Restoring replaces those sections on this computer.' }));
            if (r.older) outp.appendChild(h('p', { class: 'status-wrong', role: 'alert', id: 'open-older', text: (r.seq ? 'Older backup: this is sealed backup number ' + r.seq + (r.created ? ' from ' + r.created.slice(0, 10) : '') + ', but this browser has already sealed or restored number ' + r.newest + '.' : 'Older format: this file has no sealing counter, so it cannot be checked against newer backups.') + ' Restoring it rolls your data back. Only continue if that is what you want.' }));
            outp.appendChild(btn(r.older ? 'Roll back to this older backup' : 'Replace my data with this backup', function () { var d = S.backup.restore(parsed.data); if (!d.failed.length) S.vault.noteSeq(r.seq); UI.clear(outp); outp.appendChild(h('p', { class: d.failed.length ? 'status-wrong' : 'status-right', text: 'Restored ' + d.ok.length + ' section' + (d.ok.length === 1 ? '' : 's') + (d.failed.length ? '; could not restore ' + d.failed.length + ' (storage full or in safe mode).' : '.') })); }, 'bad', { id: 'open-restore' }));
          });
        }, 'primary', { id: 'open-go' })), outp));
      /* Beam (beam_events.js): a sealed backup that arrives from another device lands in the box above; it still needs its passphrase and the same Unlock and check */
      S.beamIn = function (text) { ta.value = text; parsed = null; UI.clear(outp); outp.appendChild(h('p', { class: 'status-right', id: 'beam-in-note', text: 'Received from the other device and put in the box above. Nothing has changed yet: type that backup\'s passphrase and press Unlock and check.' })); pass2.focus(); };
      if (S.beamCard) root.appendChild(S.beamCard());
    }
    draw();
  };

  /* ---------- Night replay ---------- */
  R.replay = function (root, q) {
    var hist = S.store.get('history', []), cur = S.store.get('game', null), pool = [], sel = 0, step = null, timer = 0, show = 'race';
    if (cur && cur.questions && Object.keys(cur.marks || {}).length) pool.push({ label: 'Current event: ' + (cur.name || 'Quiz night'), g: cur });
    hist.forEach(function (x) { if (x && x.marks && Object.keys(x.marks).length) pool.push({ label: (x.name || 'Quiz night') + ' (' + String(x.created || '').slice(0, 10) + ')', g: x }); });
    UI.onLeave(function () { if (timer) { clearInterval(timer); timer = 0; } });
    function draw() {
      if (timer) { clearInterval(timer); timer = 0; }
      UI.clear(root);
      root.appendChild(h('h1', { text: 'Night replay' }));
      root.appendChild(h('p', { class: 'muted', text: 'Watch the score race unfold, see how the odds of winning moved after every question, and find the questions that stumped or split the room.' }));
      if (!pool.length) { root.appendChild(h('div', { class: 'card' }, h('p', { text: 'No scored questions yet. Run a quiz (or finish one) and it will appear here.' }), h('a', { class: 'btn primary', href: '#/new', text: 'Start a quiz' }))); return; }
      var game = pool[sel].g, race = S.insight.race(game), qs = S.insight.questions(game), aw = S.insight.awards(game), wp = null;
      if (step == null || step > race.steps.length - 1) step = race.steps.length - 1;
      root.appendChild(h('div', { class: 'card noprint' }, h('div', { class: 'row' }, UI.field('Event', UI.select(pool.map(function (p, i) { return [i, p.label]; }), sel, function (e) { sel = +e.target.value; step = null; draw(); }), 'rp-sel'))));
      if (race.steps.length < 2) { root.appendChild(h('p', { class: 'muted', text: 'Nothing scored yet in this event.' })); return; }
      wp = S.insight.winProb(game, { runs: 300, seed: 11 });
      root.appendChild(UI.tabs([['race', 'Score race'], ['odds', 'Win odds'], ['qs', 'Questions']], show, function (t) { show = t; draw(); }));
      if (show === 'race') tRace(game, race, wp, aw); else if (show === 'odds') tOdds(game, race, wp); else tQs(qs);
    }
    function chart(game, race, upTo, kind, wp, forExport) {
      var W = 760, H = 330, L = 44, Rr = 120, T = 14, B = 34, n = race.steps.length, ymin = 0, ymax = 1, i, series = race.series, ink = forExport ? '#1e293b' : 'currentColor', el, kids = [];
      if (kind === 'race') { ymin = Infinity; ymax = -Infinity; series.forEach(function (se) { se.pts.forEach(function (v) { if (v < ymin) ymin = v; if (v > ymax) ymax = v; }); }); ymin = Math.min(0, ymin); if (ymax - ymin < 4) ymax = ymin + 4; }
      var X = function (k) { return L + (n === 1 ? 0 : k / (n - 1) * (W - L - Rr)); }, Y = function (v) { return T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B); };
      if (forExport) kids.push(svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#ffffff' }));
      for (i = 0; i <= 4; i++) { var v = ymin + (ymax - ymin) * i / 4; kids.push(svg('line', { x1: L, x2: W - Rr, y1: Y(v), y2: Y(v), stroke: ink, opacity: 0.15 })); kids.push(stxt(L - 6, Y(v) + 4, kind === 'race' ? String(Math.round(v)) : Math.round(v * 100) + '%', { 'text-anchor': 'end', fill: ink })); }
      var every = Math.ceil(n / 14); race.steps.forEach(function (st, k) { if (k % every === 0 || k === n - 1) kids.push(stxt(X(k), H - 14, st.label, { 'text-anchor': 'middle', fill: ink, 'font-size': 10 })); });
      var ends = [];
      series.forEach(function (se, si) {
        var vals = kind === 'race' ? se.pts : wp.probs.map(function (row) { return row[si]; }), pts = [], k;
        for (k = 0; k <= upTo && k < vals.length; k++) pts.push(X(k) + ',' + Y(vals[k]));
        kids.push(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: COLORS[si % 8], 'stroke-width': 2.6, 'stroke-dasharray': DASH[si % 8] || null, 'stroke-linejoin': 'round' }));
        kids.push(svg('circle', { cx: X(Math.min(upTo, vals.length - 1)), cy: Y(vals[Math.min(upTo, vals.length - 1)]), r: 4.5, fill: COLORS[si % 8] }));
        ends.push({ y: Y(vals[Math.min(upTo, vals.length - 1)]), name: se.name, v: vals[Math.min(upTo, vals.length - 1)], si: si });
      });
      ends.sort(function (a, b) { return a.y - b.y; }); for (i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13; if (ends.length && ends[ends.length - 1].y > H - B - 4) { var over = ends[ends.length - 1].y - (H - B - 4); ends.forEach(function (e) { e.y -= over; }); }
      ends.forEach(function (e) { kids.push(stxt(X(Math.min(upTo, n - 1)) + 9, e.y + 4, e.name.slice(0, 14) + ' ' + (kind === 'race' ? Math.round(e.v * 10) / 10 : Math.round(e.v * 100) + '%'), { fill: ink, 'font-weight': 600 })); });
      el = svg.apply(null, ['svg', { xmlns: forExport ? SVGNS : null, viewBox: '0 0 ' + W + ' ' + H, width: forExport ? W : '100%', class: forExport ? null : 'chart', role: 'img', 'aria-label': (kind === 'race' ? 'Score race' : 'Win odds') + ' for ' + series.length + ' teams across ' + (n - 1) + ' questions' }].concat(kids));
      return el;
    }
    function table(race) {
      return h('details', { class: 'noprint' }, h('summary', { text: 'Data table' }), h('div', { class: 'scroll-x' }, h('table', null, h('thead', null, h('tr', null, [h('th', { text: 'After' })].concat(race.series.map(function (se) { return h('th', { text: se.name }); })))),
        h('tbody', null, race.steps.map(function (st, k) { return h('tr', null, [h('td', { text: st.label })].concat(race.series.map(function (se) { return h('td', { text: String(se.pts[k]) }); }))); })))));
    }
    function scrub(race, redraw) {
      var n = race.steps.length, playing = false, play = btn('Play', function () {
        if (timer) { clearInterval(timer); timer = 0; play.textContent = 'Play'; return; }
        if (step >= n - 1) { step = 0; redraw(); }
        play.textContent = 'Pause';
        timer = setInterval(function () { if (step >= n - 1) { clearInterval(timer); timer = 0; play.textContent = 'Play'; return; } step++; slider.value = String(step); redraw(); }, reduced() ? 1400 : 700);
      }, '', { id: 'rp-play' }), slider = h('input', { type: 'range', id: 'rp-step', min: '0', max: String(n - 1), value: String(step), 'aria-label': 'Replay position', oninput: function (e) { step = +e.target.value; redraw(); } });
      return h('div', { class: 'row noprint' }, play, btn('Back', function () { if (step > 0) { step--; slider.value = String(step); redraw(); } }, 'small'), btn('Next', function () { if (step < n - 1) { step++; slider.value = String(step); redraw(); } }, 'small'), slider, h('span', { class: 'fine', id: 'rp-lab', text: race.steps[step].label }));
    }
    function tRace(game, race, wp, aw) {
      var holder = h('div', { id: 'rp-chart' }), lab;
      function redraw() { UI.clear(holder); holder.appendChild(chart(game, race, step, 'race', wp, false)); var l = doc.getElementById('rp-lab'); if (l) l.textContent = race.steps[step].label; }
      root.appendChild(h('div', { class: 'card' }, scrub(race, redraw), holder, h('div', { class: 'row noprint' }, btn('Download chart (SVG)', function () { var s = new g.XMLSerializer().serializeToString(chart(game, race, race.steps.length - 1, 'race', wp, true)); UI.download('score-race.svg', s, 'image/svg+xml'); }, '', { id: 'rp-svg' }), btn('Print', UI.print, 'small')), table(race)));
      redraw();
      if (aw.length) root.appendChild(h('div', { class: 'card', id: 'rp-awards' }, h('h2', { text: 'Highlights' }), h('div', { class: 'grid g3' }, aw.map(function (a) { return h('div', { class: 'kpi' }, h('b', { text: a.title }), h('span', { text: a.text })); }))));
    }
    function tOdds(game, race, wp) {
      var holder = h('div'), tp = S.insight.turning(wp), side = h('div', { id: 'rp-now' });
      function redraw() {
        UI.clear(holder); holder.appendChild(chart(game, race, step, 'odds', wp, false)); UI.clear(side);
        var l = doc.getElementById('rp-lab'); if (l) l.textContent = race.steps[step].label;
        side.appendChild(h('ul', null, race.series.map(function (se, i) { return { n: se.name, p: wp.probs[step][i] }; }).sort(function (a, b) { return b.p - a.p; }).map(function (x) { return h('li', { text: x.n + ': ' + pctText(x.p) }); })));
      }
      root.appendChild(h('div', { class: 'card' }, scrub(race, redraw), holder, h('h3', { text: 'Chance of finishing first, at this point' }), side,
        tp && tp.d >= 0.1 ? h('p', { id: 'rp-turn', text: 'Biggest swing: after ' + race.steps[tp.step].label + ', ' + race.series[tp.team].name + ' went from ' + pctText(tp.from) + ' to ' + pctText(tp.to) + '.' }) : null,
        h('p', { class: 'fine', text: 'Estimated by playing out the remaining questions ' + wp.runs + ' times, giving each team its own record so far (smoothed, so an early lead is not treated as certain). It describes the scores, not the people.' })));
      redraw();
    }
    function tQs(qs) {
      var rows = qs.slice().sort(function (a, b) { return a.rate - b.rate; });
      root.appendChild(h('div', { class: 'card' }, h('div', { class: 'scroll-x' }, h('table', { id: 'rp-qs' }, h('thead', null, h('tr', null, ['#', 'Question', 'Category', 'Rated', 'Teams right', 'Splits strong from weak', 'Notes'].map(function (x) { return h('th', { text: x }); }))),
        h('tbody', null, rows.map(function (r) { return h('tr', null, h('td', { text: String(r.n) }), h('td', { text: r.q.length > 90 ? r.q.slice(0, 88) + '...' : r.q }), h('td', { text: S.catName(r.cat) }), h('td', { text: r.diff }),
          h('td', { text: r.right + ' of ' + r.attempted + ' (' + pctText(r.rate) + ')' }), h('td', { text: r.disc == null ? '-' : (r.disc >= 0 ? '+' : '') + Math.round(r.disc * 100) + ' pts' }), h('td', null, r.tags.map(function (t) { return h('span', { class: 'tag ' + (t === 'separator' ? 'good' : t === 'stumper' ? 'bad' : 'warn'), text: t }); }))); })))),
        h('p', { class: 'fine', text: 'Sorted hardest first. "Splits strong from weak" is the gap between the top third and the bottom third of teams (needs 4 or more teams). Use it to keep what worked and drop what did not.' })));
    }
    draw();
  };
})(window);
