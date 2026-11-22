/* Stark IntraTheater by Stark. Science Explorer: solar system with a scale toggle, the periodic table, the human body, quizzes. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const fmt = n => Number(n).toLocaleString('en-US');
  const EARTH_KM = 12742, C_KM_S = 299792.458;
  const planets = data.planets, byPlanet = {}; planets.forEach(p => { byPlanet[p.id] = p; });
  const cats = {}; data.elementCats.forEach(c => { cats[c.id] = c; });
  const slug = s => s.replace(/ /g, '-');
  const grown = () => SIT.isGrown();
  const speakBtn = fn => SIT.speakButton(fn, 'Read aloud');
  const kv = rows => h('dl', { class: 'ex-facts' }, rows.filter(Boolean).map(r => [h('dt', null, r[0]), h('dd', null, r[1])]));

  function lightTime(distMkm) {
    const s = distMkm * 1e6 / C_KM_S;
    if (s < 90 * 60) return 'about ' + (s < 100 ? Math.round(s) + ' seconds' : Math.round(s / 60) + ' minutes');
    return 'about ' + (s / 3600).toFixed(1) + ' hours';
  }
  const times = d => { const r = d / EARTH_KM; return r >= 10 ? Math.round(r) : r >= 1 ? r.toFixed(1) : r.toFixed(2); };

  /* ================= planets ================= */
  const ps = { size: 'true', dist: 'true', sel: 'earth' };
  function renderPlanets(box, q) {
    if (q.id && byPlanet[q.id]) ps.sel = q.id;
    const maxD = Math.max.apply(null, planets.map(p => p.diam));
    const maxAu = planets[planets.length - 1].au;
    const tSize = h('div', { class: 'ex-toggle', role: 'group', 'aria-label': 'Size scale' }), tDist = h('div', { class: 'ex-toggle', role: 'group', 'aria-label': 'Distance scale' });
    const drawToggle = (host, key, label) => {
      clear(host).appendChild(h('span', { class: 'muted small' }, label + ': '));
      [['true', 'True scale'], ['easy', 'Easy-to-see scale']].forEach(o => host.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': ps[key] === o[0] ? 'true' : 'false', onclick: () => { ps[key] = o[0]; draw(); } }, o[1])));
    };
    const sizes = h('div', { class: 'ex-scroll' }), dist = h('div', { class: 'ex-scroll' }), detail = h('div', { class: 'card', 'aria-live': 'polite' });
    function drawSizes() {
      clear(sizes);
      const wide = d => ps.size === 'true' ? Math.max(2, d / maxD * 200) : 14 + 186 * Math.sqrt(d / maxD);
      sizes.appendChild(h('div', { class: 'ex-sizes' }, planets.map(p => h('button', {
        type: 'button', class: 'ex-planet' + (p.id === ps.sel ? ' sel' : ''), 'aria-label': p.name + ', ' + fmt(p.diam) + ' km across', onclick: () => { ps.sel = p.id; draw(); }
      }, h('span', { class: 'ex-ball', style: 'width:' + wide(p.diam).toFixed(1) + 'px;height:' + wide(p.diam).toFixed(1) + 'px;background:' + p.color }), h('span', { class: 'ex-pname' }, p.name)))));
      sizes.appendChild(h('p', { class: 'fine' }, ps.size === 'true'
        ? 'True scale: Jupiter is drawn 200 pixels wide, so Earth is about 18 pixels and Ceres is a speck. The Sun would be about 2,000 pixels wide (' + fmt(data.sun.diam) + ' km across).'
        : 'Easy-to-see scale: sizes are squeezed so every world can be seen. Bigger still means bigger, but the sizes are NOT in proportion.'));
    }
    function drawDist() {
      clear(dist);
      const pos = au => ps.dist === 'true' ? au / maxAu : Math.log10(1 + au) / Math.log10(1 + maxAu);
      const track = h('div', { class: 'ex-track', role: 'img', 'aria-label': 'Distances from the Sun, ' + (ps.dist === 'true' ? 'true scale' : 'easy-to-see scale') });
      track.appendChild(h('span', { class: 'ex-sun', style: 'left:0' }, '☀️'));
      planets.forEach((p, i) => {
        const left = (3 + 94 * pos(p.au)).toFixed(2) + '%';
        track.appendChild(h('span', { class: 'ex-dot', style: 'left:' + left + ';background:' + p.color }));
        track.appendChild(h('span', { class: 'ex-tick', style: 'left:' + left + ';height:' + (14 + (i % 4) * 20) + 'px' }));
        track.appendChild(h('span', { class: 'ex-dlabel', style: 'left:' + left + ';top:' + (36 + (i % 4) * 20) + 'px' }, p.name));
      });
      dist.appendChild(track);
      dist.appendChild(h('p', { class: 'fine' }, ps.dist === 'true'
        ? 'True scale: 1 AU (the Earth-Sun distance, about 150 million km) is a fixed length. The four inner planets bunch up close to the Sun because space is mostly empty.'
        : 'Easy-to-see scale: distances are squeezed (logarithmic) so the inner planets can be seen. Equal gaps here do NOT mean equal distances.'));
    }
    function drawDetail() {
      const p = byPlanet[ps.sel]; clear(detail);
      detail.appendChild(h('h2', null, h('span', { class: 'ex-dot-inline', style: 'background:' + p.color }), ' ', p.name));
      detail.appendChild(h('p', null, grown() ? p.adult : p.kid));
      detail.appendChild(kv(grown() ? [
        ['Type', p.kind], ['Diameter', 'about ' + fmt(p.diam) + ' km (' + times(p.diam) + ' × Earth)'],
        ['Average distance from the Sun', 'about ' + fmt(p.dist) + ' million km (' + p.au + ' AU)'],
        ['Sunlight takes', lightTime(p.dist) + ' to arrive'], ['Year', p.year], ['Day', p.day], ['Moons', p.moons]
      ] : [
        ['Kind of world', p.kind], ['Size', p.id === 'earth' ? 'This is us!' : (p.diam > EARTH_KM ? 'About ' + times(p.diam) + ' times wider than Earth' : 'Only about ' + times(p.diam) + ' as wide as Earth')],
        ['One year', p.year], ['Moons', p.moons]
      ]));
      detail.appendChild(h('div', { class: 'row' }, speakBtn(() => p.name + '. ' + (grown() ? p.adult : p.kid))));
    }
    function draw() {
      drawToggle(tSize, 'size', 'Sizes'); drawToggle(tDist, 'dist', 'Distances');
      drawSizes(); drawDist(); drawDetail();
    }
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Sizes'), tSize, sizes));
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Distances from the Sun'), tDist, dist));
    box.appendChild(detail);
    box.appendChild(h('p', { class: 'fine' }, 'Values are rounded averages. Moon counts keep changing as new moons are confirmed. Pluto and Ceres are dwarf planets. Tap a planet to read about it.'));
    draw();
  }

  /* ================= moons ================= */
  function renderMoons(box) {
    const earthMoon = data.moons[0].diam;
    box.appendChild(h('p', { class: 'lede' }, grown() ? 'Selected moons of the solar system. Diameters and orbit distances are rounded.' : 'Moons are worlds that travel around planets. Here are some famous ones.'));
    box.appendChild(h('div', { class: 'ex-cards' }, data.moons.map(m => {
      const pl = byPlanet[m.planet];
      return h('article', { class: 'card ex-card', id: 'moon-' + m.id },
        h('h3', null, m.name), h('p', { class: 'muted small' }, 'Orbits ' + pl.name),
        h('p', null, grown() ? m.adult : m.kid),
        kv([['Diameter', 'about ' + fmt(m.diam) + ' km' + (m.id === 'moon' ? '' : ' (' + (m.diam / earthMoon).toFixed(2) + ' × our Moon)')], grown() ? ['Orbit distance', 'about ' + fmt(m.orbit) + ' km from ' + pl.name] : null]),
        speakBtn(() => m.name + '. ' + (grown() ? m.adult : m.kid)));
    })));
  }

  /* ================= periodic table ================= */
  const es = { sel: null, cat: null, q: '' };
  function renderElements(box, q) {
    const els = data.elements;
    if (q.id) { const f = els.find(e => e.sym === q.id); if (f) es.sel = f.n; }
    if (!es.sel) es.sel = 1;
    const detail = h('div', { class: 'card ex-edetail', 'aria-live': 'polite' });
    const cells = {};
    const grid = h('div', { class: 'ex-ptable', role: 'group', 'aria-label': 'Periodic table of the elements' });
    function place(e, col, row) {
      const b = h('button', {
        type: 'button', class: 'el-cell cat-' + slug(e.cat), style: 'grid-column:' + col + ';grid-row:' + row + ';background:' + cats[e.cat].color,
        'aria-label': e.name + ', symbol ' + e.sym + ', number ' + e.n, title: e.name, 'aria-pressed': 'false', onclick: () => select(e.n)
      }, h('span', { class: 'el-n' }, String(e.n)), h('span', { class: 'el-sym' }, e.sym), h('span', { class: 'el-name' }, e.name));
      cells[e.n] = b; grid.appendChild(b);
    }
    els.forEach(e => {
      if (e.group) place(e, e.group, e.period);
      else place(e, (e.n >= 89 ? e.n - 89 : e.n - 57) + 3, e.n >= 89 ? 10 : 9);
    });
    grid.appendChild(h('span', { class: 'el-hint', style: 'grid-column:3;grid-row:6' }, '57-71'));
    grid.appendChild(h('span', { class: 'el-hint', style: 'grid-column:3;grid-row:7' }, '89-103'));
    function select(n) {
      es.sel = n; const e = els[n - 1], c = cats[e.cat];
      Object.keys(cells).forEach(k => cells[k].setAttribute('aria-pressed', +k === n ? 'true' : 'false'));
      clear(detail);
      detail.appendChild(h('div', { class: 'ex-ebig', style: 'background:' + c.color }, h('span', { class: 'el-n' }, String(e.n)), h('span', { class: 'el-sym' }, e.sym), h('span', { class: 'el-name' }, e.name)));
      detail.appendChild(h('div', null,
        h('h2', null, e.name),
        h('p', null, e.fact),
        h('p', { class: 'muted' }, h('strong', null, e.cat.charAt(0).toUpperCase() + e.cat.slice(1) + ': '), grown() ? c.adult : c.kid),
        kv(grown() ? [['Atomic number', String(e.n)], ['Symbol', e.sym], ['Group', e.group ? String(e.group) : 'f-block (no group number shown)'], ['Period', String(e.period)]] : [['Number', String(e.n)], ['Symbol', e.sym]]),
        speakBtn(() => e.name + '. Symbol ' + e.sym + '. Atomic number ' + e.n + '. ' + e.fact)));
    }
    function filter() {
      const t = es.q.trim().toLowerCase(); let match = [];
      els.forEach(e => {
        const hit = (!t || e.name.toLowerCase().indexOf(t) === 0 || e.sym.toLowerCase() === t || String(e.n) === t) && (!es.cat || e.cat === es.cat);
        cells[e.n].classList.toggle('dim', !hit); if (hit) match.push(e.n);
      });
      if (t && match.length === 1) select(match[0]);
    }
    box.appendChild(h('div', { class: 'filters' },
      h('label', { class: 'grow' }, 'Find an element', h('input', { type: 'search', placeholder: 'Name, symbol or number', value: es.q, oninput: e => { es.q = e.target.value; filter(); } }))));
    box.appendChild(h('div', { class: 'chips', role: 'group', 'aria-label': 'Element families' },
      data.elementCats.map(c => h('button', {
        type: 'button', class: 'chip', style: '--cont:' + c.color, 'aria-pressed': es.cat === c.id ? 'true' : 'false',
        onclick: e => { es.cat = es.cat === c.id ? null : c.id; box.querySelectorAll('.chips .chip').forEach(b => b.setAttribute('aria-pressed', 'false')); if (es.cat) e.currentTarget.setAttribute('aria-pressed', 'true'); filter(); }
      }, c.id.charAt(0).toUpperCase() + c.id.slice(1)))));
    box.appendChild(h('div', { class: 'ex-scroll' }, grid));
    box.appendChild(detail);
    box.appendChild(h('p', { class: 'fine' }, '118 elements. Groups are the 18 columns; periods are the 7 rows. Elements 57 to 71 and 89 to 103 sit in the two rows below the main table so that it stays narrow. Elements above 94 are made only in laboratories.'));
    select(es.sel); filter();
  }

  /* ================= human body ================= */
  const bs = { sel: 'circulatory' };
  function renderBody(box, q) {
    if (q.id && data.body.some(b => b.id === q.id)) bs.sel = q.id;
    const detail = h('div', { class: 'card', 'aria-live': 'polite' });
    const list = h('div', { class: 'chips', role: 'group', 'aria-label': 'Body systems' });
    function draw() {
      const b = data.body.find(x => x.id === bs.sel); clear(detail);
      list.querySelectorAll('button').forEach(btn => btn.setAttribute('aria-pressed', btn.dataset.id === bs.sel ? 'true' : 'false'));
      detail.appendChild(h('h2', null, h('span', { 'aria-hidden': 'true' }, b.icon + ' '), b.name));
      detail.appendChild(h('p', null, grown() ? b.adult : b.kid));
      detail.appendChild(h('p', null, h('strong', null, 'Main parts: '), b.organs.join(', ')));
      detail.appendChild(h('ul', null, b.facts.map(f => h('li', null, f))));
      detail.appendChild(speakBtn(() => b.name + '. ' + (grown() ? b.adult : b.kid) + ' ' + b.facts.join(' ')));
    }
    data.body.forEach(b => list.appendChild(h('button', { type: 'button', class: 'chip', 'data-id': b.id, onclick: () => { bs.sel = b.id; draw(); } }, b.icon + ' ' + b.name.replace(/ \(.*\)/, ''))));
    box.appendChild(list); box.appendChild(detail);
    box.appendChild(h('p', { class: 'fine' }, 'This is general learning information, not medical advice. Numbers such as bone counts and heart beats are typical adult values and vary between people.'));
    draw();
  }

  /* ================= quiz ================= */
  function renderQuiz(box) {
    SIT.exQuiz(box, [
      { key: l => l === 'grown' ? 'sci-grown' : 'sci-kids', label: '🔬 Science quiz', text: 'Solar system, elements and the body.', make: l => SIT.staticQuiz(l === 'grown' ? data.sciQuizGrown : data.sciQuizKids, 10) },
      { key: () => 'sci-elements', label: '⚗️ Elements quiz', text: 'Symbols, atomic numbers and families.', make: l => SIT.expLib.elementQuestions(data.elements, l, 10) }
    ]);
  }

  SIT.explorer('science', {
    title: 'Science Explorer', icon: '🔬',
    ledeKid: 'Travel through space, meet the building blocks of everything and tour your own body!',
    ledeGrown: 'The solar system with real distances and sizes and a scale toggle, all 118 elements, and the main systems of the human body.',
    tabs: [
      { id: 'planets', label: '🪐 Planets', render: renderPlanets }, { id: 'moons', label: '🌙 Moons', render: renderMoons },
      { id: 'elements', label: '⚗️ Elements', render: renderElements }, { id: 'body', label: '🫀 Human body', render: renderBody },
      { id: 'orbit', label: '🛰️ Orbit Lab', render: box => SIT.orbit && SIT.orbit.render(box) },
      { id: 'quiz', label: '❓ Quiz', render: renderQuiz }
    ]
  });
})();
