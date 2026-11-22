/* Stark IntraTheater by Stark. Geography Explorer: 193 UN member states, capitals dot map, quizzes. */
(function () {
  'use strict';
  const { h, clear, data, sample, shuffle } = SIT;
  const C = data.countries;
  const CONT = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
  const COLOR = { 'Africa': '#e0a63c', 'Asia': '#d1603f', 'Europe': '#6f93c9', 'North America': '#5fae6b', 'South America': '#b783cf', 'Oceania': '#3fb0a9' };
  const ICON = { 'Africa': '🦒', 'Asia': '🐼', 'Europe': '🏰', 'North America': '🦅', 'South America': '🦜', 'Oceania': '🐨' };
  const byIso = {}; C.forEach(c => { byIso[c.iso2] = c; });
  const SVGNS = 'http://www.w3.org/2000/svg';
  const st = { tab: 'browse', cont: 'all', q: '', sel: null, mapCont: 'all', qType: 'capital', qLevel: null };
  let el = {};

  const s = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const wrapLon = c => (c.continent === 'Oceania' && c.lon < -150 ? c.lon + 360 : c.lon);
  const coord = c => Math.abs(c.lat).toFixed(1) + '° ' + (c.lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(c.lon).toFixed(1) + '° ' + (c.lon >= 0 ? 'E' : 'W');
  const sayCountry = c => c.name + '. The capital is ' + c.capital + '. ' + c.name + ' is in ' + c.continent + '.' + (c.note ? ' ' + c.note : '');

  /* ---------- country details dialog ---------- */
  function openCountry(c) {
    st.sel = c.iso2;
    const dlg = el.dlg; const body = clear(el.dlgBody);
    body.appendChild(h('div', { class: 'country-hero', style: '--cont:' + COLOR[c.continent] }, SIT.flagEl(c, 'flag-xl'),
      h('div', null, h('h2', { id: 'country-title' }, c.name), c.aka ? h('p', { class: 'muted' }, 'Also known as ' + c.aka) : null)));
    body.appendChild(h('dl', { class: 'facts' },
      h('dt', null, 'Capital'), h('dd', null, c.capital),
      h('dt', null, 'Continent'), h('dd', null, ICON[c.continent] + ' ' + c.continent),
      h('dt', null, 'Capital’s position'), h('dd', null, 'about ' + coord(c))));
    if (c.note) body.appendChild(h('p', { class: 'note-box' }, c.note));
    body.appendChild(h('div', { class: 'row' },
      SIT.speakButton(() => sayCountry(c)),
      h('button', { type: 'button', class: 'btn', onclick: () => { dlg.close(); setTab('map'); zoomMap(c.continent); highlight(c.iso2); } }, '📍 Show on map'),
      h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Close')));
    if (!dlg.open) dlg.showModal();
    highlight(c.iso2);
  }

  /* ---------- browse ---------- */
  function buildBrowse() {
    el.grid = h('div', { class: 'country-grid' });
    C.forEach(c => {
      const b = h('button', { type: 'button', class: 'country', style: '--cont:' + COLOR[c.continent], 'data-iso': c.iso2, onclick: () => openCountry(c) },
        SIT.flagEl(c), h('span', { class: 'c-name' }, c.name), h('span', { class: 'c-cap' }, c.capital));
      b._search = (c.name + ' ' + (c.aka || '') + ' ' + c.capital + ' ' + c.continent).toLowerCase();
      b._cont = c.continent;
      el.grid.appendChild(b);
    });
  }
  function filterBrowse() {
    let n = 0;
    el.grid.childNodes.forEach(b => { const on = (st.cont === 'all' || b._cont === st.cont) && (!st.q || b._search.indexOf(st.q) >= 0); b.hidden = !on; if (on) n++; });
    el.found.textContent = n + (n === 1 ? ' country' : ' countries');
    el.chips.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.cont === st.cont ? 'true' : 'false'));
  }

  /* ---------- capitals dot map (real latitude/longitude; no borders drawn) ---------- */
  function buildMap() {
    const svg = s('svg', { class: 'dotmap', viewBox: '-180 -90 360 180', role: 'img', 'aria-labelledby': 'map-cap' });
    svg.appendChild(s('rect', { x: -180, y: -90, width: 400, height: 180, class: 'ocean' }));
    for (let lon = -180; lon <= 210; lon += 30) svg.appendChild(s('line', { x1: lon, y1: -90, x2: lon, y2: 90, class: 'grat' }));
    for (let lat = -60; lat <= 60; lat += 30) svg.appendChild(s('line', { x1: -180, y1: -lat, x2: 220, y2: -lat, class: lat === 0 ? 'grat eq' : 'grat' }));
    [[23.44, 'trop'], [-23.44, 'trop'], [66.56, 'trop'], [-66.56, 'trop']].forEach(t => svg.appendChild(s('line', { x1: -180, y1: -t[0], x2: 220, y2: -t[0], class: 'grat ' + t[1] })));
    el.dots = {};
    C.forEach(c => {
      const g = s('g', { 'data-iso': c.iso2, class: 'dot', style: '--cont:' + COLOR[c.continent] });
      const x = wrapLon(c), y = -c.lat;
      g.appendChild(s('circle', { cx: x, cy: y, r: 4, class: 'hit' }));
      g.appendChild(s('circle', { cx: x, cy: y, r: 1.6, class: 'pt' }));
      const t = s('title', {}); t.textContent = c.name + ': ' + c.capital; g.appendChild(t);
      svg.appendChild(g); el.dots[c.iso2] = g;
    });
    el.label = s('text', { class: 'map-label', x: 0, y: 0 }); el.label.style.display = 'none';
    svg.appendChild(el.label);
    svg.addEventListener('click', e => { const g = e.target.closest && e.target.closest('g.dot'); if (g) { const c = byIso[g.getAttribute('data-iso')]; showPicked(c); } });
    el.svg = svg;
    el.picked = h('div', { class: 'picked', 'aria-live': 'polite' }, h('p', { class: 'muted' }, 'Tap a dot to see whose capital it is.'));
    zoomMap('all');
  }
  function viewBoxFor(cont) {
    if (cont === 'all') return [-180, -90, 360, 180];
    const pts = C.filter(c => c.continent === cont);
    let x0 = Math.min.apply(null, pts.map(wrapLon)), x1 = Math.max.apply(null, pts.map(wrapLon));
    let y0 = Math.min.apply(null, pts.map(c => -c.lat)), y1 = Math.max.apply(null, pts.map(c => -c.lat));
    x0 -= 8; x1 += 8; y0 -= 8; y1 += 8;
    let w = x1 - x0, hh = y1 - y0;
    if (w < hh * 2) { const d = hh * 2 - w; x0 -= d / 2; w = hh * 2; } else { const d = w / 2 - hh; y0 -= d / 2; hh = w / 2; }
    return [x0, y0, w, hh];
  }
  function zoomMap(cont) {
    st.mapCont = cont;
    const vb = viewBoxFor(cont); const k = vb[2] / 360;
    el.svg.setAttribute('viewBox', vb.join(' '));
    Object.keys(el.dots).forEach(iso => {
      const g = el.dots[iso]; const c = byIso[iso];
      g.firstChild.setAttribute('r', 4.2 * k); g.childNodes[1].setAttribute('r', (iso === st.sel ? 2.8 : 1.6) * k);
      g.classList.toggle('dim', cont !== 'all' && c.continent !== cont);
    });
    el.svg.querySelectorAll('.grat').forEach(l => l.setAttribute('stroke-width', 0.35 * k));
    el.label.setAttribute('font-size', 7 * k);
    if (el.mapChips) el.mapChips.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.cont === cont ? 'true' : 'false'));
    if (st.sel) highlight(st.sel);
  }
  function highlight(iso) {
    if (!el.dots) return;
    const k = viewBoxFor(st.mapCont)[2] / 360;
    Object.keys(el.dots).forEach(i => { el.dots[i].classList.toggle('sel', i === iso); el.dots[i].childNodes[1].setAttribute('r', (i === iso ? 2.8 : 1.6) * k); });
    const c = byIso[iso]; if (!c) return;
    el.label.textContent = c.capital; el.label.style.display = '';
    el.label.setAttribute('x', wrapLon(c) + 3.5 * k); el.label.setAttribute('y', -c.lat + 2.2 * k);
    el.svg.appendChild(el.dots[iso]); el.svg.appendChild(el.label);
  }
  function showPicked(c) {
    st.sel = c.iso2; highlight(c.iso2);
    clear(el.picked).appendChild(h('div', { class: 'row' }, SIT.flagEl(c, 'flag-inline'),
      h('p', null, h('strong', null, c.capital), ' is the capital of ', h('strong', null, c.name), ' (' + c.continent + ').'),
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => openCountry(c) }, 'More'),
      SIT.speakButton(() => sayCountry(c), 'Hear it', 'btn-small')));
  }

  /* ---------- quizzes ---------- */
  function makeQuestions(type, level) {
    const kid = level === 'kid';
    let pool = C.filter(c => (!kid || c.kid));
    if (type === 'capital' && kid) pool = pool.filter(c => !c.multi);
    if (type === 'continent') pool = pool.filter(c => !c.spans);
    const flagBig = c => (SIT.flagsOk() ? c.flag : ICON[c.continent]);
    return sample(pool, 10).map(c => {
      if (type === 'capital') {
        const reverse = !kid && Math.random() < 0.4;
        const near = kid ? pool : C.filter(o => o.continent === c.continent);
        const others = sample(near.filter(o => o !== c), kid ? 2 : 3);
        if (reverse) return { q: c.capital + ' is the capital of which country?', choices: shuffle([c.name].concat(others.map(o => o.name))), answer: c.name, note: c.note || '' };
        return { q: 'What is the capital of ' + c.name + '?', big: flagBig(c), bigLabel: SIT.flagsOk() ? 'Flag of ' + c.name : null, choices: shuffle([c.capital].concat(others.map(o => o.capital))), answer: c.capital, note: c.note || '' };
      }
      if (type === 'continent') {
        const wrong = sample(CONT.filter(x => x !== c.continent), kid ? 2 : 3);
        return { q: 'Which continent is ' + c.name + ' in?', big: SIT.flagsOk() ? c.flag : '🌍', bigLabel: SIT.flagsOk() ? 'Flag of ' + c.name : null, choices: shuffle([c.continent].concat(wrong)), answer: c.continent };
      }
      const near = kid ? pool : C.filter(o => o.continent === c.continent);
      const others = sample(near.filter(o => o !== c), kid ? 2 : 3);
      return { q: 'Which country has this flag?', big: c.flag, bigLabel: 'A national flag', choices: shuffle([c.name].concat(others.map(o => o.name))), answer: c.name, note: 'Capital: ' + c.capital + '.' };
    });
  }
  function renderQuizSetup() {
    clear(el.quiz);
    if (!st.qLevel) st.qLevel = SIT.isGrown() ? 'grown' : 'kid';
    const flags = SIT.flagsOk();
    if (st.qType === 'flag' && !flags) st.qType = 'capital';
    const pick = (group, val, label, extra) => h('button', {
      type: 'button', class: 'menu-card', 'aria-pressed': st[group] === val ? 'true' : 'false', disabled: extra === 'disabled',
      onclick: () => { st[group] = val; renderQuizSetup(); }
    }, label);
    const best = SIT.progress().best[['geo', st.qType, st.qLevel].join('-')];
    const names = { capital: 'Capitals', continent: 'Continents', flag: 'Flags', kid: 'kids level', grown: 'grown-up level' };
    el.quiz.appendChild(h('div', { class: 'quiz-setup' },
      h('h2', null, 'Pick a quiz'),
      h('div', { class: 'row start-bar' }, h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: startQuiz }, 'Start 10 questions'),
        h('p', { class: 'muted', role: 'status' }, names[st.qType] + ', ' + names[st.qLevel] + '. Change it below.')),
      h('div', { class: 'pick-row', role: 'group', 'aria-label': 'Quiz type' },
        pick('qType', 'capital', '🏛️ Capitals'), pick('qType', 'continent', '🗺️ Continents'), pick('qType', 'flag', '🏳️ Flags', flags ? '' : 'disabled')),
      flags ? null : h('p', { class: 'fine' }, 'This browser draws flag emoji as letters (Chrome and Edge on Windows do this), so the flags quiz is switched off here. It works in Firefox and on most phones, tablets and Macs.'),
      h('div', { class: 'pick-row', role: 'group', 'aria-label': 'Difficulty' },
        pick('qLevel', 'kid', '🧒 Kids: famous countries, 3 choices'), pick('qLevel', 'grown', '🎓 Grown-ups: all 193, tricky neighbours')),
      best ? h('p', { class: 'badge' }, 'Your best: ' + best.score + '/' + best.total) : null));
  }
  function startQuiz() {
    const run = () => SIT.runQuiz(el.quiz, { questions: makeQuestions(st.qType, st.qLevel), kid: st.qLevel === 'kid', bestKey: ['geo', st.qType, st.qLevel].join('-'), again: run, onDone: renderQuizSetup });
    run();
  }

  /* ---------- tabs ---------- */
  function setTab(t) {
    st.tab = t;
    el.tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === t ? 'true' : 'false'));
    el.browse.hidden = t !== 'browse'; el.map.hidden = t !== 'map'; el.quiz.hidden = t !== 'quiz';
    el.find.hidden = t !== 'find'; el.review.hidden = t !== 'review';
    if (t === 'quiz') renderQuizSetup();
    if (t === 'find') SIT.geoPlus.findMenu(el.find);
    if (t === 'review') SIT.geoPlus.review(el.review);
  }
  function mount(root) {
    const tab = (id, label) => h('button', { type: 'button', 'data-tab': id, 'aria-pressed': 'false', onclick: () => setTab(id) }, label);
    el.tabs = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Geography views' }, tab('browse', '🗂️ Countries'), tab('map', '🗺️ Capitals map'), tab('find', '📍 Find it'), tab('review', '🧠 Review'), tab('quiz', '❓ Quiz'));
    const chip = (cont, label, set) => h('button', { type: 'button', class: 'chip', 'data-cont': cont, 'aria-pressed': 'false', style: cont === 'all' ? '' : '--cont:' + COLOR[cont], onclick: () => set(cont) }, label);
    el.chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Continent filter' },
      chip('all', '🌐 All', v => { st.cont = v; filterBrowse(); }), CONT.map(c => chip(c, ICON[c] + ' ' + c, v => { st.cont = v; filterBrowse(); })));
    el.found = h('span', { class: 'muted small', 'aria-live': 'polite' });
    buildBrowse();
    el.browse = h('div', null,
      h('div', { class: 'filters' }, h('label', { class: 'grow' }, h('span', null, 'Search countries or capitals'),
        h('input', { type: 'search', id: 'g-search', placeholder: 'e.g. Kenya, Lima, Oceania', oninput: e => { st.q = e.target.value.trim().toLowerCase(); filterBrowse(); } })), el.found),
      el.chips, el.grid);

    buildMap();
    el.mapChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Zoom the map to a continent' },
      chip('all', '🌐 World', zoomMap), CONT.map(c => chip(c, ICON[c] + ' ' + c, zoomMap)));
    el.map = h('div', { hidden: true },
      el.mapChips,
      h('figure', { class: 'map-figure' }, h('div', { class: 'map-frame' }, el.svg),
        h('figcaption', { id: 'map-cap' }, 'Each dot is a capital city placed at its real latitude and longitude, coloured by continent. Country borders are not drawn. Lines mark the Equator, the tropics and the polar circles. The country list has the same information for keyboard and screen-reader users.')),
      el.picked,
      h('ul', { class: 'legend', 'aria-label': 'Continent colours' }, CONT.map(c => h('li', null, h('span', { class: 'swatch', style: 'background:' + COLOR[c] }), c))));

    el.quiz = h('div', { class: 'quiz-host', hidden: true });
    el.find = h('div', { class: 'quiz-host', hidden: true });
    el.review = h('div', { class: 'quiz-host', hidden: true });
    el.dlgBody = h('div', { class: 'dialog-body' });
    el.dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'country-title' }, el.dlgBody);
    document.body.appendChild(el.dlg);

    root.appendChild(h('header', { class: 'view-head' },
      h('h1', null, 'Geography Explorer'),
      h('p', { class: 'lede' }, 'All ' + C.length + ' member states of the United Nations, with capitals, continents and flags. Continents follow the UN’s regional groupings, with the Americas split into North (including Central America and the Caribbean) and South.')));
    root.appendChild(el.tabs);
    root.appendChild(el.browse);
    root.appendChild(el.map);
    root.appendChild(el.find);
    root.appendChild(el.review);
    root.appendChild(el.quiz);
    filterBrowse();
    setTab('browse');
  }

  const GEO_TYPES = ['capital', 'continent', 'flag'];
  SIT.view('geo', {
    title: 'Geography', mount,
    show(r) {
      if (GEO_TYPES.indexOf(r.q.qt) >= 0) st.qType = r.q.qt; // lesson links preset the quiz
      if (r.q.ql === 'kid' || r.q.ql === 'grown') st.qLevel = r.q.ql;
      if (r.q.tab) setTab(r.q.tab);
      if (r.q.c && byIso[r.q.c]) openCountry(byIso[r.q.c]);
      if (st.tab === 'quiz') renderQuizSetup();
    }
  });
})();
