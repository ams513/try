/* Stark IntraTheater by Stark. Art and Music History: dated works and composers across eras and regions.
   No images: each work gets colour swatches and a simple drawn shape. Facts only. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const svg = SIT.svg;
  const WORKS = data.arts;
  const KINDS = [['all', 'All'], ['painting', '🖼️ Painting'], ['sculpture', '🗿 Sculpture'], ['architecture', '🏛️ Architecture'], ['music', '🎼 Music']];
  const REGIONS = Array.from(new Set(WORKS.map(w => w.region))).sort();
  const st = { kind: 'all', region: 'all', q: '', open: null };

  function fmtYear(y) { return y < 0 ? Math.abs(y).toLocaleString('en-US') + ' BCE' : String(y); }
  /* a simple drawn shape per kind, filled with the work's own colour swatches (no images) */
  function art(w) {
    const c = w.swatches, p = i => c[i % c.length], s = [];
    if (w.kind === 'painting') s.push(svg('rect', { x: 6, y: 6, width: 108, height: 78, rx: 3, fill: p(0) }), svg('rect', { x: 14, y: 14, width: 92, height: 62, fill: p(1) }), svg('circle', { cx: 78, cy: 34, r: 13, fill: p(2) }), svg('path', { d: 'M14 76 L46 44 L70 66 L84 54 L106 76 Z', fill: p(0), opacity: '.85' }));
    else if (w.kind === 'sculpture') s.push(svg('rect', { x: 36, y: 70, width: 48, height: 14, rx: 2, fill: p(1) }), svg('ellipse', { cx: 60, cy: 46, rx: 22, ry: 26, fill: p(0) }), svg('circle', { cx: 60, cy: 30, r: 11, fill: p(c.length > 2 ? 2 : 1), opacity: '.9' }));
    else if (w.kind === 'architecture') s.push(svg('path', { d: 'M10 34 L60 8 L110 34 Z', fill: p(0) }), [22, 44, 66, 88].map(x => svg('rect', { x, y: 38, width: 10, height: 38, fill: p(1) })), svg('rect', { x: 10, y: 76, width: 100, height: 8, fill: p(c.length > 2 ? 2 : 0) }));
    else s.push([14, 34, 54, 74, 94].map((x, i) => svg('rect', { x, y: 70 - [24, 44, 30, 52, 36][i], width: 12, height: [24, 44, 30, 52, 36][i] + 14, rx: 2, fill: p(i) })), svg('circle', { cx: 100, cy: 18, r: 8, fill: p(2) }));
    return svg('svg', { class: 'ex-art', viewBox: '0 0 120 90', role: 'img', 'aria-label': 'Colours and simple shape for ' + w.title }, s);
  }
  const matches = w => (st.kind === 'all' || w.kind === st.kind) && (st.region === 'all' || w.region === st.region) &&
    (!st.q || (w.title + ' ' + w.by + ' ' + w.date + ' ' + w.region + ' ' + w.kind).toLowerCase().indexOf(st.q) >= 0);

  function renderWorks(box, q) {
    if (q.id) { const w = WORKS.find(x => x.id === q.id); if (w) { st.kind = 'all'; st.region = 'all'; st.q = ''; st.open = w.id; } }
    const list = h('div', { class: 'ex-cards' }), count = h('p', { class: 'muted', 'aria-live': 'polite' });
    function draw() {
      clear(list);
      const shown = WORKS.filter(matches);
      count.textContent = shown.length + ' of ' + WORKS.length + ' works, oldest first.';
      shown.forEach(w => {
        const isOpen = st.open === w.id;
        list.appendChild(h('article', { class: 'card ex-card ex-work' + (isOpen ? ' open' : ''), id: 'work-' + w.id },
          art(w),
          h('p', { class: 'date' }, w.date, w.approx ? h('span', { class: 'tag plain', title: 'The date or its range is an estimate' }, 'approximate date') : null),
          h('h2', { class: 'ex-work-title' }, w.title), h('p', { class: 'muted small' }, w.by + ' · ' + w.region + ' · ' + w.kind),
          h('p', null, SIT.isGrown() ? w.adult : w.kid),
          h('div', { class: 'ex-swatches', 'aria-label': 'Colour swatches' }, w.swatches.map(c => h('span', { class: 'ex-sw', style: 'background:' + c, title: c }))),
          SIT.speakButton(() => w.title + ', by ' + w.by + ', ' + w.date + '. ' + (SIT.isGrown() ? w.adult : w.kid), 'Read aloud')));
      });
      if (!shown.length) list.appendChild(h('p', { class: 'muted' }, 'No works match. Try clearing the search.'));
      const o = st.open && list.querySelector('#work-' + st.open); if (o) { o.scrollIntoView({ block: 'center' }); st.open = null; }
    }
    box.appendChild(h('div', { class: 'filters' },
      h('label', { class: 'grow' }, 'Search', h('input', { type: 'search', placeholder: 'Title, creator or date', value: st.q, oninput: e => { st.q = e.target.value.trim().toLowerCase(); draw(); } })),
      h('label', null, 'Region', h('select', { onchange: e => { st.region = e.target.value; draw(); } }, [h('option', { value: 'all' }, 'All regions')].concat(REGIONS.map(r => h('option', { value: r, selected: st.region === r }, r)))))));
    box.appendChild(h('div', { class: 'chips', role: 'group', 'aria-label': 'Kind of work' },
      KINDS.map(k => h('button', { type: 'button', class: 'chip', 'aria-pressed': st.kind === k[0] ? 'true' : 'false', onclick: e => { st.kind = k[0]; box.querySelectorAll('.chips .chip').forEach(b => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); draw(); } }, k[1]))));
    box.appendChild(count); box.appendChild(list);
    box.appendChild(h('p', { class: 'fine' }, 'Facts only, and no pictures of the works are shown: the colours are drawn from each work, and the shapes are simple symbols. Dates marked approximate are estimates; “c.” means circa, about. ' + WORKS.length + ' works from ' + fmtYear(WORKS[0].year) + ' to ' + fmtYear(WORKS[WORKS.length - 1].year) + '.'));
    draw();
  }

  function renderQuiz(box) {
    SIT.exQuiz(box, [
      { key: l => l === 'grown' ? 'art-grown' : 'art-kids', label: '🎨 Art and music quiz', text: 'Famous works, makers and styles.', make: l => SIT.staticQuiz(l === 'grown' ? data.artQuizGrown : data.artQuizKids, 10) },
      { key: () => 'art-works', label: '🕰️ Who made it? Which came first?', text: 'Questions built from the whole collection.', make: l => SIT.expLib.artQuestions(WORKS, l, 10) }
    ]);
  }

  SIT.explorer('arts', {
    title: 'Art and Music History', icon: '🎨',
    ledeKid: 'Look at famous art and listen for famous music from all over the world and all through time!',
    ledeGrown: WORKS.length + ' works and composers across eras and regions, from Stone Age cave paintings to twentieth-century music, with dates, makers and short descriptions.',
    tabs: [{ id: 'works', label: '🖼️ Works', render: renderWorks }, { id: 'quiz', label: '❓ Quiz', render: renderQuiz }]
  });
})();
