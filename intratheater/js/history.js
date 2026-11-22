/* Stark IntraTheater by Stark. History Explorer: zoomable world timeline, event cards, quizzes. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const EV = data.events, ERAS = data.eras;
  const eraById = {}; ERAS.forEach(e => { eraById[e.id] = e; });
  const REGIONS = Array.from(new Set(EV.map(e => e.region))).sort();
  const NOW = 2026, LANE_H = 46, HEAD_H = 54, PAD = 14;

  const st = { tab: 'timeline', era: 'all', region: 'all', q: '', zoom: 0, sel: null };
  let el = {}, layoutDone = false, pins = {};

  const matches = e => (st.era === 'all' || e.era === st.era) && (st.region === 'all' || e.region === st.region) &&
    (!st.q || (e.title + ' ' + e.date + ' ' + e.region + ' ' + e.kid + ' ' + (SIT.isGrown() ? e.adult : '')).toLowerCase().indexOf(st.q) >= 0);
  const visible = () => EV.filter(matches);
  function fmtYear(y) {
    if (y <= -100000) { const ago = NOW - y; return ago >= 1e6 ? (ago / 1e6).toFixed(1).replace('.0', '') + ' million years ago' : Math.round(ago / 1000) + ',000 years ago'; }
    if (y < 0) return (-y).toLocaleString('en-US') + ' BCE';
    return y < 1000 ? y + ' CE' : String(y);
  }

  /* ---------- timeline layout ---------- */
  const widths = {}; let measureCtx = null;
  function labelWidth(e) {   // dot + gap + pill padding + icon + measured title text
    if (widths[e.id]) return widths[e.id];
    if (!measureCtx) { measureCtx = document.createElement('canvas').getContext('2d'); }
    measureCtx.font = '600 13.5px ' + getComputedStyle(document.body).fontFamily;
    return (widths[e.id] = Math.ceil(18 + 6 + 22 + 22 + measureCtx.measureText(e.title).width));
  }
  function layout(keepCenter) {
    if (!el.scroll || el.timeline.hidden) return;
    const sc = el.scroll;
    const centerFrac = keepCenter && sc.scrollWidth ? (sc.scrollLeft + sc.clientWidth / 2) / sc.scrollWidth : null;
    const counts = {}; EV.forEach(e => { counts[e.era] = (counts[e.era] || 0) + 1; });
    const units = ERAS.map(e => Math.max(4, counts[e.id] || 0));
    const total = units.reduce((a, b) => a + b, 0);
    const baseUnit = Math.max((sc.clientWidth || 900) / total, 6);
    if (!st.zoom) st.zoom = Math.min(12, Math.max(1, Math.ceil(30 / baseUnit)));
    el.zoom.value = st.zoom; el.zoomOut.disabled = st.zoom <= 1; el.zoomIn.disabled = st.zoom >= 12;
    const unit = baseUnit * st.zoom;
    const labels = unit >= 24;
    const lanes = labels ? 7 : 3;
    const track = clear(el.track);
    let x0 = 0; const eraX = {};
    ERAS.forEach((e, i) => {
      const w = units[i] * unit; eraX[e.id] = { x: x0, w };
      track.appendChild(h('div', { class: 'tl-era' + (st.era !== 'all' && st.era !== e.id ? ' dim' : ''), style: 'left:' + x0 + 'px;width:' + w + 'px;--era:' + e.color, title: e.name },
        h('span', { class: 'tl-era-name' }, e.name), h('span', { class: 'tl-era-start' }, fmtYear(e.start))));
      x0 += w;
    });
    const width = x0;
    const laneEnd = new Array(lanes).fill(-1e9);
    pins = {};
    const rank = {}, seenIn = {};
    EV.forEach(e => { rank[e.id] = seenIn[e.era] = (seenIn[e.era] === undefined ? 0 : seenIn[e.era] + 1); });
    EV.forEach(e => {
      const E = eraById[e.era], box = eraX[e.era], n = counts[e.era];
      let f;
      if (e.era === 'deep') { const a = Math.log(NOW - E.start), b = Math.log(NOW - E.end); f = (a - Math.log(NOW - e.year)) / (a - b); }
      else f = (e.year - E.start) / (E.end - E.start);
      f = 0.35 * Math.min(1, Math.max(0, f)) + 0.65 * (n > 1 ? rank[e.id] / (n - 1) : 0.5); // time order kept, spacing evened out
      const x = box.x + PAD + f * (box.w - 2 * PAD);
      const w = labels ? labelWidth(e) : 18;
      let lane = laneEnd.findIndex(end => end + 6 <= x);
      if (lane < 0) lane = laneEnd.indexOf(Math.min.apply(null, laneEnd));
      laneEnd[lane] = x + w;
      const on = matches(e);
      const pin = h('button', {
        type: 'button', class: 'tl-pin' + (on ? '' : ' dim') + (st.sel === e.id ? ' sel' : '') + (labels ? '' : ' compact'),
        style: 'left:' + (x - 9) + 'px;top:' + (HEAD_H + lane * LANE_H) + 'px;--era:' + E.color,
        tabindex: st.sel === e.id ? '0' : '-1', 'aria-label': e.date + ': ' + e.title, title: e.date + ': ' + e.title,
        onclick: () => select(e.id, false)
      }, h('span', { class: 'tl-dot', 'aria-hidden': 'true' }), labels ? h('span', { class: 'tl-label', 'aria-hidden': 'true' }, h('span', { class: 'tl-icon' }, e.icon), e.title) : null);
      pins[e.id] = pin; track.appendChild(pin);
    });
    if (!st.sel || !pins[st.sel]) { const first = visible()[0]; if (first) pins[first.id].tabIndex = 0; }
    track.style.width = width + 'px';
    track.style.height = (HEAD_H + lanes * LANE_H + 12) + 'px';
    if (centerFrac !== null) sc.scrollLeft = centerFrac * width - sc.clientWidth / 2;
    layoutDone = true;
  }
  function setZoom(z) { st.zoom = Math.min(12, Math.max(1, z)); layout(true); }

  /* ---------- detail card ---------- */
  function select(id, scroll, quiet) {
    const e = EV.find(x => x.id === id); if (!e) return;
    st.sel = id;
    const grown = SIT.isGrown(), E = eraById[e.era];
    const list = visible(); const i = list.indexOf(e);
    const prev = i > 0 ? list[i - 1] : null, next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
    clear(el.detail).hidden = false;
    el.detail.appendChild(h('div', { class: 'ev-head' },
      h('span', { class: 'ev-icon', 'aria-hidden': 'true' }, e.icon),
      h('div', null,
        h('p', { class: 'date' }, e.date),
        h('h2', { id: 'ev-title', tabindex: '-1' }, e.title),
        h('p', { class: 'tags' }, h('span', { class: 'tag', style: '--era:' + E.color }, E.name), h('span', { class: 'tag plain' }, e.region)))));
    if (grown) {
      el.detail.appendChild(h('p', { class: 'adult-text' }, e.adult));
      el.detail.appendChild(h('p', { class: 'kid-text small' }, h('strong', null, 'For the kids: '), e.kid));
    } else el.detail.appendChild(h('p', { class: 'kid-text' }, e.kid));
    el.detail.appendChild(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', disabled: !prev, onclick: () => prev && select(prev.id, true) }, '◀ Earlier'),
      h('button', { type: 'button', class: 'btn', disabled: !next, onclick: () => next && select(next.id, true) }, 'Later ▶'),
      SIT.speakButton(() => e.title + '. ' + e.date + '. ' + (grown ? e.adult : e.kid))));
    el.detail.appendChild(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => { mwAnchor = e.id; setTab('meanwhile'); } }, '🌐 Meanwhile elsewhere'),
      SIT.museum ? h('button', { type: 'button', class: 'btn btn-small', onclick: () => SIT.museum.add('event', e.id) }, '🏺 Add to my museum') : null,
      (data.sources || []).filter(s => s.event === e.id && (grown || s.level !== 'grown')).map(s => h('a', { class: 'btn btn-small', href: '#/history?tab=sources&src=' + s.id }, '📜 Read the source: ' + s.title))));
    if (!quiet && SIT.markIn('seen', e.id)) updateCount();
    Object.keys(pins).forEach(k => { pins[k].classList.toggle('sel', k === id); pins[k].tabIndex = k === id ? 0 : -1; });
    if (scroll && st.tab === 'timeline' && pins[id]) SIT.scrollIntoView(pins[id]);
    if (st.tab === 'cards') SIT.scrollIntoView(el.detail, 'start');
  }
  function updateCount() { if (el.count) el.count.textContent = 'Explored ' + SIT.progress().seen.length + ' of ' + EV.length; }

  /* ---------- cards ---------- */
  function renderCards() {
    clear(el.cards);
    const list = visible();
    if (!list.length) { el.cards.appendChild(h('p', { class: 'muted' }, 'Nothing matches. Try another word or clear the filters.')); return; }
    const seen = SIT.progress().seen;
    ERAS.forEach(E => {
      const items = list.filter(e => e.era === E.id); if (!items.length) return;
      el.cards.appendChild(h('section', { class: 'era-group', style: '--era:' + E.color },
        h('h2', null, E.name, h('span', { class: 'muted small' }, '  ' + fmtYear(E.start) + ' onward')),
        h('p', { class: 'muted' }, E.blurb),
        h('div', { class: 'ev-grid' }, items.map(e => h('button', { type: 'button', class: 'ev-card' + (seen.indexOf(e.id) >= 0 ? ' seen' : ''), onclick: () => select(e.id, true) },
          h('span', { class: 'ev-card-icon', 'aria-hidden': 'true' }, e.icon),
          h('span', { class: 'date' }, e.date), h('span', { class: 'ev-card-title' }, e.title), h('span', { class: 'muted small' }, e.region))))));
    });
  }

  /* ---------- quizzes ---------- */
  function whichFirst(n, kid) {
    const out = []; let guard = 0;
    while (out.length < n && guard++ < 500) {
      const [a, b] = SIT.sample(EV, 2);
      if (Math.abs(a.year - b.year) < (kid ? 400 : 60) || (kid && a.era === b.era)) continue;
      const first = a.year < b.year ? a : b;
      out.push({ q: 'Which happened first?', choices: [a.title, b.title], answer: first.title, note: a.title + ': ' + a.date + '. ' + b.title + ': ' + b.date + '.' });
    }
    return out;
  }
  function renderQuizMenu() {
    clear(el.quiz);
    const grown = SIT.isGrown();
    const opts = [
      ['🧒 Family history quiz', 'Friendly questions about famous moments.', 'hist-kids', () => ({ questions: SIT.sample(data.triviaKids, 8), kid: !grown })],
      ['⏳ Which came first?', 'Put two moments in order.', grown ? 'hist-first-hard' : 'hist-first', () => ({ questions: whichFirst(8, !grown), kid: !grown })]
    ];
    if (grown) opts.push(['🎓 Hard history', 'For grown-ups: treaties, scripts and empires.', 'hist-hard', () => ({ questions: SIT.sample(data.triviaHard, 10) })]);
    const best = SIT.progress().best;
    el.quiz.appendChild(h('div', { class: 'quiz-menu' }, opts.map(o => h('button', {
      type: 'button', class: 'menu-card', onclick: () => {
        const run = () => { const cfg = o[3](); cfg.bestKey = o[2]; cfg.onDone = renderQuizMenu; cfg.again = run; SIT.runQuiz(el.quiz, cfg); };
        run();
      }
    }, h('span', { class: 'menu-title' }, o[0]), h('span', { class: 'muted' }, o[1]),
      best[o[2]] ? h('span', { class: 'badge' }, 'Best: ' + best[o[2]].score + '/' + best[o[2]].total) : null))));
  }

  /* ---------- tabs + filters ---------- */
  let mwAnchor = null, srcQuery = null;
  const EXTRA = ['order', 'meanwhile', 'sources', 'quiz'];
  function setTab(t) {
    st.tab = t;
    el.tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === t ? 'true' : 'false'));
    el.timeline.hidden = t !== 'timeline'; el.cards.hidden = t !== 'cards'; el.quiz.hidden = t !== 'quiz';
    el.order.hidden = t !== 'order'; el.meanwhile.hidden = t !== 'meanwhile'; el.sources.hidden = t !== 'sources';
    el.filters.hidden = EXTRA.indexOf(t) >= 0; el.detailWrap.hidden = EXTRA.indexOf(t) >= 0;
    if (t === 'timeline') { layout(false); if (st.sel && pins[st.sel]) SIT.scrollIntoView(pins[st.sel]); }
    if (t === 'cards') renderCards();
    if (t === 'quiz') renderQuizMenu();
    if (t === 'order') SIT.historyPlus.orderMenu(el.order);
    if (t === 'meanwhile') { SIT.historyPlus.meanwhile(el.meanwhile, mwAnchor || st.sel, id => { setTab('timeline'); select(id, true); }); mwAnchor = null; }
    if (t === 'sources') { SIT.sourcesUI.render(el.sources, srcQuery); srcQuery = null; }
  }
  function refilter() {
    if (st.tab === 'timeline') layout(true); else renderCards();
    el.matchCount.textContent = visible().length + ' moments';
  }

  function mount(root) {
    const tab = (id, label) => h('button', { type: 'button', 'data-tab': id, 'aria-pressed': 'false', onclick: () => setTab(id) }, label);
    el.tabs = h('div', { class: 'tabs', role: 'group', 'aria-label': 'History views' },tab('timeline', '📜 Timeline'), tab('cards', '🗂️ Cards'), tab('order', '🔀 Order it'), tab('meanwhile', '🌐 Meanwhile'), tab('sources', '📖 Sources'), tab('quiz', '❓ Quiz'));
    el.count = h('span', { class: 'badge' });
    const eraSel = h('select', { id: 'h-era', onchange: e => { st.era = e.target.value; refilter(); } },
      h('option', { value: 'all' }, 'All eras'), ERAS.map(e => h('option', { value: e.id }, e.name)));
    const regSel = h('select', { id: 'h-region', onchange: e => { st.region = e.target.value; refilter(); } },
      h('option', { value: 'all' }, 'All regions'), REGIONS.map(r => h('option', { value: r }, r)));
    const search = h('input', { type: 'search', id: 'h-search', placeholder: 'Search: pyramids, Mali, flight…', oninput: e => { st.q = e.target.value.trim().toLowerCase(); refilter(); } });
    el.matchCount = h('span', { class: 'muted small', 'aria-live': 'polite' });
    el.filters = h('div', { class: 'filters' },
      h('label', null, h('span', null, 'Era'), eraSel), h('label', null, h('span', null, 'Region'), regSel),
      h('label', { class: 'grow' }, h('span', null, 'Search'), search), el.matchCount);

    el.zoom = h('input', { type: 'range', min: 1, max: 12, step: 1, id: 'h-zoom', 'aria-label': 'Timeline zoom', oninput: e => setZoom(+e.target.value) });
    el.zoomOut = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Zoom out', onclick: () => setZoom(st.zoom - 1) }, '−');
    el.zoomIn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Zoom in', onclick: () => setZoom(st.zoom + 1) }, '+');
    el.track = h('div', { class: 'tl-track' });
    el.scroll = h('div', { class: 'tl-scroll', role: 'region', 'aria-label': 'World timeline. Use left and right arrow keys to move between moments, plus and minus to zoom.' }, el.track);
    el.timeline = h('div', { class: 'timeline' },
      h('div', { class: 'tl-tools' }, h('span', { class: 'muted small' }, 'Zoom'), el.zoomOut, el.zoom, el.zoomIn,
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => setZoom(1) }, 'Whole story'),
        h('span', { class: 'muted small tl-hint' }, 'Not to scale: each era gets room by how many moments it holds, not by how long it lasted, so every moment has space to read. Order is always kept.')),
      el.scroll);
    el.scroll.addEventListener('keydown', e => {
      const list = visible(); if (!list.length) return;
      let i = list.findIndex(x => x.id === st.sel);
      if (e.key === 'ArrowRight') i = Math.min(list.length - 1, i + 1);
      else if (e.key === 'ArrowLeft') i = Math.max(0, i < 0 ? 0 : i - 1);
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = list.length - 1;
      else if (e.key === '+' || e.key === '=') { setZoom(st.zoom + 1); e.preventDefault(); return; }
      else if (e.key === '-') { setZoom(st.zoom - 1); e.preventDefault(); return; }
      else return;
      e.preventDefault(); select(list[i].id, true); pins[list[i].id].focus({ preventScroll: true });
    });
    let drag = null;
    el.scroll.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && !e.target.closest('.tl-pin')) drag = { x: e.clientX, s: el.scroll.scrollLeft }; });
    window.addEventListener('pointermove', e => { if (drag) el.scroll.scrollLeft = drag.s - (e.clientX - drag.x); });
    window.addEventListener('pointerup', () => { drag = null; });
    let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (layoutDone && SIT.currentView() === 'history' && st.tab === 'timeline') layout(true); }, 150); });

    el.detail = h('article', { class: 'card ev-detail', hidden: true, 'aria-live': 'polite' });
    el.detailWrap = h('div', null, el.detail);
    el.cards = h('div', { class: 'cards', hidden: true });
    el.quiz = h('div', { class: 'quiz-host', hidden: true });
    el.order = h('div', { class: 'quiz-host', hidden: true });
    el.meanwhile = h('div', { class: 'mw-host', hidden: true });
    el.sources = h('div', { class: 'src-host', hidden: true });

    root.appendChild(h('header', { class: 'view-head' },
      h('h1', null, 'History Explorer'),
      h('p', { class: 'lede' }, EV.length + ' moments from 3.2 million years ago to today. Tap a moment to read about it. Dates marked “c.” are approximate, as historians give them.'),
      el.count));
    root.appendChild(el.tabs);
    root.appendChild(el.filters);
    root.appendChild(el.timeline);
    root.appendChild(el.detailWrap);
    root.appendChild(el.cards);
    root.appendChild(el.order);
    root.appendChild(el.meanwhile);
    root.appendChild(el.sources);
    root.appendChild(el.quiz);
    updateCount();
    el.matchCount.textContent = EV.length + ' moments';
  }

  SIT.view('history', {
    title: 'History Explorer', mount,
    show(r) {
      updateCount();
      if (r.q.e && EV.some(e => e.id === r.q.e)) {
        if (r.q.tab === 'meanwhile') { mwAnchor = r.q.e; setTab('meanwhile'); return; }
        setTab(r.q.tab || 'timeline'); select(r.q.e, true); return;
      }
      if (r.q.src) srcQuery = { src: r.q.src }; else if (r.q.tab === 'sources') srcQuery = { list: true };   // a link to the sources tab opens the list
      setTab(r.q.tab || st.tab);
      if (!st.sel) { const first = EV.find(e => e.id === 'writing') || EV[0]; select(first.id, true, true); }
    }
  });
  SIT.on('mode', () => { if (el.detail && st.sel && SIT.currentView() === 'history') { select(st.sel, false, true); if (st.tab === 'quiz') renderQuizMenu(); if (st.tab === 'sources' || st.tab === 'order') setTab(st.tab); } });
})();
