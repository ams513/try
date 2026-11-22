/* Stark IntraTheater by Stark. Math Playground: pie fractions, times-table mastery, shapes and angles, a graphing toy.
   Times-table progress is saved per profile in this browser only (progress.tables). */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const svg = SIT.svg, lib = SIT.expLib;
  const grown = () => SIT.isGrown();
  const GOLD = '#e9b44c';

  /* ================= pies ================= */
  function pieSvg(d, n, size, onSlice) {
    const parts = [];
    for (let i = 0; i < d; i++) parts.push(svg('path', { d: lib.piePath(50, 50, 46, i, d), class: 'ex-slice' + (i < n ? ' on' : ''), fill: i < n ? GOLD : 'none', stroke: '#8a6a3a', 'stroke-width': 1.5, 'stroke-linejoin': 'round', onclick: onSlice ? () => onSlice(i) : null }));
    return svg('svg', { class: 'ex-pie', viewBox: '0 0 100 100', width: size, height: size, role: 'img', 'aria-label': 'A pie cut into ' + d + ' equal slices with ' + n + ' shaded' }, parts);
  }
  const DEN = { 1: 'whole', 2: 'half', 3: 'third', 4: 'quarter', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth' };
  function fracWords(n, d) {
    if (n === 0) return 'none of the pie';
    if (n === d) return 'the whole pie';
    return n + ' ' + (d === 2 ? (n > 1 ? 'halves' : 'half') : DEN[d] + (n > 1 ? 's' : ''));
  }
  const trim = x => String(+x.toFixed(3));
  function pieControl(init, maxDen, label) {
    const s = { d: init.d, n: init.n };
    const view = h('div', { class: 'ex-pieview' }), out = h('div', { 'aria-live': 'polite' });
    const dRange = h('input', { type: 'range', min: 1, max: maxDen, value: s.d, 'aria-label': label + ': number of equal pieces', oninput: e => { s.d = +e.target.value; s.n = Math.min(s.n, s.d); draw(); } });
    function draw() {
      clear(view).appendChild(pieSvg(s.d, s.n, 190, i => { s.n = (s.n === i + 1) ? i : i + 1; draw(); }));
      const f = s.n + '/' + s.d, sm = lib.simplify(s.n, s.d);
      clear(out);
      out.appendChild(h('p', { class: 'ex-big' }, h('span', { class: 'ex-fracnum' }, h('span', null, String(s.n)), h('span', { class: 'ex-bar' }), h('span', null, String(s.d)))));
      out.appendChild(h('p', null, fracWords(s.n, s.d)));
      if (grown() && s.n > 0) out.appendChild(h('p', { class: 'muted' }, (sm[0] !== s.n ? 'Simplest form: ' + sm[0] + '/' + sm[1] + '. ' : '') + 'As a decimal: ' + trim(s.n / s.d) + '. As a percentage: ' + trim(100 * s.n / s.d) + '%.'));
      dRange.value = s.d;
      if (props.onChange) props.onChange();
    }
    const props = { el: null, s, onChange: null };
    props.el = h('div', { class: 'ex-pie-box' }, h('h3', null, label), view, out,
      h('div', { class: 'row center' }, h('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Shade one fewer slice', onclick: () => { s.n = Math.max(0, s.n - 1); draw(); } }, '−'), h('span', { class: 'muted small' }, 'shaded slices'),
        h('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Shade one more slice', onclick: () => { s.n = Math.min(s.d, s.n + 1); draw(); } }, '+')),
      h('label', { class: 'ex-range' }, h('span', null, 'Equal pieces: '), dRange));
    props.draw = draw; draw();
    return props;
  }
  function renderFractions(box) {
    const max = grown() ? 12 : 8;
    const a = pieControl({ d: 4, n: 1 }, max, 'Pie A'), b = pieControl({ d: 2, n: 1 }, max, 'Pie B');
    const cmp = h('p', { class: 'ex-compare', 'aria-live': 'polite' });
    const update = () => {
      const x = a.s.n * b.s.d, y = b.s.n * a.s.d;
      cmp.textContent = x === y ? 'Pie A and Pie B show the same amount of pie: these are equivalent fractions.' : (x > y ? 'Pie A has more pie than Pie B.' : 'Pie B has more pie than Pie A.');
    };
    a.onChange = update; b.onChange = update; update();
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Pie fractions'),
      h('p', null, grown() ? 'Choose how many equal pieces the pie has, then tap slices to shade them. Compare two pies to see equivalent fractions, such as 1/2 and 2/4.' : 'Slide to cut the pie into equal pieces. Tap the slices to colour them. Can you make two pies that hold the same amount?'),
      h('div', { class: 'ex-pies' }, a.el, b.el), cmp));
  }

  /* ================= times tables ================= */
  const tstate = { t: 0, cur: null, answered: false, confirm: false };
  function renderTables(box) {
    const prog = SIT.progress(); prog.tables = prog.tables || {};
    const rec = prog.tables;
    const grid = h('div', { class: 'ex-mastery', role: 'group', 'aria-label': 'Times-table mastery' }), summary = h('p', { class: 'muted', 'aria-live': 'polite' });
    const play = h('section', { class: 'card ex-play' });
    function drawGrid() {
      clear(grid); let full = 0;
      for (let t = 2; t <= 12; t++) {
        const m = lib.tableMastery(rec, t); if (m === 12) full++;
        const row = h('div', { class: 'ex-mrow' }, h('span', { class: 'ex-mlab' }, t + '×'));
        for (let b = 1; b <= 12; b++) {
          const e = rec[lib.tableKey(t, b)], st = lib.isMastered(rec, t, b) ? 'mastered' : (e ? 'learning' : 'new');
          row.appendChild(h('span', { class: 'ex-mcell ' + st, role: 'img', 'aria-label': t + ' × ' + b + ' = ' + (t * b) + ': ' + st, title: t + ' × ' + b + ' = ' + (t * b) + ' (' + st + ')' }, st === 'mastered' ? '✓' : ''));
        }
        row.appendChild(h('span', { class: 'ex-mcount muted small' }, m + '/12'));
        grid.appendChild(row);
      }
      summary.textContent = full + ' of 11 tables fully mastered (2 to 12). A fact counts as mastered after ' + lib.MASTERY_STREAK + ' right answers in a row; a wrong answer starts it again.';
    }
    function next() { tstate.cur = lib.nextFact(rec, tstate.t); tstate.answered = false; drawPlay(); }
    function drawPlay() {
      clear(play);
      const f = tstate.cur || (tstate.cur = lib.nextFact(rec, tstate.t));
      const fb = h('p', { class: 'quiz-feedback', role: 'status', 'aria-live': 'polite' });
      const input = h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 144, 'aria-label': f.a + ' times ' + f.b, autocomplete: 'off' });
      const nextBtn = h('button', { type: 'button', class: 'btn btn-primary', hidden: true, onclick: next }, 'Next fact');
      const form = h('form', { class: 'row center', onsubmit: e => {
        e.preventDefault(); if (tstate.answered || input.value === '') return;
        const ok = +input.value === f.a * f.b, was = lib.isMastered(rec, f.a, f.b);
        lib.tableRecord(rec, f.a, f.b, ok); tstate.answered = true;
        fb.className = 'quiz-feedback ' + (ok ? 'good' : 'bad');
        const now = lib.isMastered(rec, f.a, f.b);
        fb.textContent = ok ? (now && !was ? 'Mastered! ' : 'Yes! ') + f.a + ' × ' + f.b + ' = ' + (f.a * f.b) + '.' : 'Not quite: ' + f.a + ' × ' + f.b + ' = ' + (f.a * f.b) + '. You will see it again soon.';
        input.disabled = true; nextBtn.hidden = false; nextBtn.focus();
        SIT.saveProgress(); if (now && !was) SIT.addStars(1);
        drawGrid();
      } }, input, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Check'));
      play.appendChild(h('h2', null, 'Practise'));
      play.appendChild(h('div', { class: 'chips', role: 'group', 'aria-label': 'Which table' },
        [0].concat([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map(t => h('button', { type: 'button', class: 'chip', 'aria-pressed': tstate.t === t ? 'true' : 'false', onclick: () => { tstate.t = t; next(); } }, t ? t + '× table' : 'Mixed'))));
      play.appendChild(h('p', { class: 'ex-big', 'aria-live': 'polite' }, f.a + ' × ' + f.b + ' = ?'));
      play.appendChild(form); play.appendChild(fb); play.appendChild(h('div', { class: 'quiz-actions' }, nextBtn));
      if (f.review) play.appendChild(h('p', { class: 'fine' }, 'Every fact in this table is mastered. Here is one for review.'));
      input.focus({ preventScroll: true });
    }
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Your mastery'), summary, h('div', { class: 'ex-scroll' }, grid),
      h('p', { class: 'fine' }, 'Green ticks are mastered, amber are being learned, grey have not been tried. Each row is one table, 1 to 12.')));
    box.appendChild(play);
    const reset = h('button', { type: 'button', class: 'btn btn-small btn-danger', onclick: () => {
      if (!tstate.confirm) { tstate.confirm = true; reset.textContent = 'Tap again to erase times-table progress'; return; }
      tstate.confirm = false; prog.tables = {}; SIT.saveProgress(); renderTablesAgain();
    } }, 'Reset times-table progress');
    box.appendChild(h('div', { class: 'row' }, reset));
    const renderTablesAgain = () => { clear(box); renderTables(box); };
    drawGrid(); drawPlay();
  }

  /* ================= shapes and angles ================= */
  function polyPoints(n) { const pts = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + 2 * Math.PI * i / n; pts.push((50 + 40 * Math.cos(a)).toFixed(1) + ',' + (50 + 40 * Math.sin(a)).toFixed(1)); } return pts.join(' '); }
  function shapeSvg(sh, size) {
    const attrs = { fill: '#d9a441', stroke: '#8a5a0b', 'stroke-width': 2.5, 'stroke-linejoin': 'round' };
    const fixed = { rectangle: '12,30 88,30 88,70 12,70', square: '25,25 75,25 75,75 25,75', rhombus: '50,8 88,50 50,92 12,50', parallelogram: '28,30 96,30 72,70 4,70', trapezium: '32,30 68,30 94,70 6,70' };
    let el;
    if (sh.id === 'circle') el = svg('circle', Object.assign({ cx: 50, cy: 50, r: 40 }, attrs));
    else el = svg('polygon', Object.assign({ points: fixed[sh.id] || polyPoints(sh.sides) }, attrs));
    return svg('svg', { class: 'ex-shape', viewBox: '0 0 100 100', width: size, height: size, role: 'img', 'aria-label': sh.name }, el);
  }
  function angleSvg(deg, size) {
    const cx = 80, cy = 80, R = 66, r = 26, rad = deg * Math.PI / 180, f = x => Math.round(x * 10) / 10;
    const ex = f(cx + R * Math.cos(rad)), ey = f(cy - R * Math.sin(rad)), sx = cx + r, sy = cy;
    const arc = [];
    if (deg >= 360) arc.push(svg('circle', { cx, cy, r, fill: 'rgba(233,180,76,.3)', stroke: GOLD, 'stroke-width': 2 }));
    else if (deg > 0) arc.push(svg('path', { d: 'M ' + cx + ' ' + cy + ' L ' + sx + ' ' + sy + ' A ' + r + ' ' + r + ' 0 ' + (deg > 180 ? 1 : 0) + ' 0 ' + f(cx + r * Math.cos(rad)) + ' ' + f(cy - r * Math.sin(rad)) + ' Z', fill: 'rgba(233,180,76,.3)', stroke: GOLD, 'stroke-width': 2 }));
    if (deg === 90) arc.push(svg('path', { d: 'M ' + (cx + 14) + ' ' + cy + ' L ' + (cx + 14) + ' ' + (cy - 14) + ' L ' + cx + ' ' + (cy - 14), fill: 'none', stroke: GOLD, 'stroke-width': 2 }));
    return svg('svg', { class: 'ex-angle', viewBox: '0 0 160 160', width: size, height: size, role: 'img', 'aria-label': 'An angle of ' + deg + ' degrees' },
      arc, svg('line', { x1: cx, y1: cy, x2: cx + R, y2: cy, stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round' }),
      deg > 0 && deg < 360 ? svg('line', { x1: cx, y1: cy, x2: ex, y2: ey, stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round' }) : null,
      svg('circle', { cx, cy, r: 3.5, fill: 'currentColor' }));
  }
  const sstate = { sel: 'triangle', deg: 60 };
  function renderShapes(box, q) {
    if (q.id && data.shapes.some(s => s.id === q.id)) sstate.sel = q.id;
    const detail = h('div', { class: 'card', 'aria-live': 'polite' }), tiles = h('div', { class: 'ex-shapes', role: 'group', 'aria-label': 'Shapes' });
    function drawShape() {
      const sh = data.shapes.find(x => x.id === sstate.sel);
      tiles.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === sstate.sel ? 'true' : 'false'));
      clear(detail);
      detail.appendChild(h('div', { class: 'ex-shapeline' }, shapeSvg(sh, 120), h('div', null, h('h2', null, sh.name),
        h('p', null, grown() ? sh.adult : sh.kid),
        h('p', { class: 'muted' }, sh.sides ? sh.sides + ' straight sides and ' + sh.sides + ' corners.' + (grown() && sh.sum ? ' Interior angles add up to (' + sh.sides + ' − 2) × 180 = ' + sh.sum + ' degrees.' : '') : 'No straight sides and no corners.'))));
    }
    data.shapes.forEach(sh => tiles.appendChild(h('button', { type: 'button', class: 'ex-shapebtn', 'data-id': sh.id, onclick: () => { sstate.sel = sh.id; drawShape(); } }, shapeSvg(sh, 64), h('span', null, sh.name.replace(/ \(.*\)/, '')))));
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Shapes'), tiles)); box.appendChild(detail);
    /* angle explorer */
    const out = h('div', { 'aria-live': 'polite' }), fig = h('div', { class: 'ex-anglefig' });
    const slider = h('input', { type: 'range', min: 0, max: 360, step: 5, value: sstate.deg, 'aria-label': 'Angle in degrees', oninput: e => { sstate.deg = +e.target.value; drawAngle(); } });
    function drawAngle() {
      const d = sstate.deg, kind = lib.angleKind(d), info = data.angleKinds.find(k => k.id === kind);
      clear(fig).appendChild(angleSvg(d, 200)); clear(out);
      out.appendChild(h('p', { class: 'ex-big' }, d + '°'));
      out.appendChild(h('p', null, h('strong', null, info ? info.name : 'No turn'), info ? ' (' + info.range + ')' : ' (0 degrees)'));
      out.appendChild(h('p', { class: 'muted' }, info ? (grown() ? info.adult : info.kid) : 'Both arms point the same way, so there is no turn at all.'));
      if (grown() && d > 0 && d < 360) out.appendChild(h('p', { class: 'muted small' }, 'Supplementary angle (to 180): ' + (d < 180 ? 180 - d : 'none') + (d < 180 ? '°' : '') + '. Complementary angle (to 90): ' + (d < 90 ? (90 - d) + '°' : 'none') + '.'));
    }
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Angle explorer'), h('p', null, 'Slide to open the angle from 0 to 360 degrees.'),
      h('div', { class: 'ex-angleline' }, fig, h('div', null, out, h('label', { class: 'ex-range' }, h('span', null, 'Degrees: '), slider)))));
    drawShape(); drawAngle();
  }

  /* ================= graphing toy ================= */
  function graphSvg(g, size) {
    const S = 10, X = x => 10 + (x + 10) * S, Y = y => 210 - (y + 10) * S, parts = [];
    for (let i = -10; i <= 10; i++) { parts.push(svg('line', { x1: X(i), y1: 10, x2: X(i), y2: 210, stroke: i === 0 ? 'currentColor' : 'rgba(150,130,100,.35)', 'stroke-width': i === 0 ? 1.6 : .6 })); parts.push(svg('line', { x1: 10, y1: Y(i), x2: 210, y2: Y(i), stroke: i === 0 ? 'currentColor' : 'rgba(150,130,100,.35)', 'stroke-width': i === 0 ? 1.6 : .6 })); }
    [-10, -5, 5, 10].forEach(v => { parts.push(svg('text', { x: X(v), y: Y(0) + 11, 'text-anchor': 'middle', 'font-size': 7, fill: 'currentColor' }, String(v))); parts.push(svg('text', { x: X(0) - 3, y: Y(v) + 2.5, 'text-anchor': 'end', 'font-size': 7, fill: 'currentColor' }, String(v))); });
    const f = g.a !== undefined ? x => g.a * x * x + g.c : x => g.m * x + g.c;
    let d = '', pen = false;
    for (let x = -10; x <= 10.001; x += 0.25) { const y = f(x); if (Math.abs(y) <= 10.2) { d += (pen ? ' L ' : ' M ') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1); pen = true; } else pen = false; }
    parts.push(svg('path', { d, fill: 'none', stroke: GOLD, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    parts.push(svg('circle', { cx: X(0), cy: Y(g.c), r: 3.4, fill: '#ef8a80' }));
    return svg('svg', { class: 'ex-graph', viewBox: '0 0 220 220', width: size, height: size, role: 'img', 'aria-label': 'Graph on a grid from −10 to 10' }, parts);
  }
  const gstate = { mode: 'line', m: 1, a: 1, c: 0 };
  function renderGraph(box) {
    const fig = h('div', { class: 'ex-graphfig' }), out = h('div', { 'aria-live': 'polite' }), table = h('div', { class: 'ex-scroll' });
    const sl = (key, lo, hi, step, label) => h('label', { class: 'ex-range' }, h('span', null, label + ': '), h('input', { type: 'range', min: lo, max: hi, step, value: gstate[key], 'aria-label': label, oninput: e => { gstate[key] = +e.target.value; draw(); } }));
    const ctl = h('div', null);
    function draw() {
      const para = grown() && gstate.mode === 'para';
      const g = para ? { a: gstate.a, c: gstate.c } : { m: gstate.m, c: gstate.c };
      clear(fig).appendChild(graphSvg(g, 340));
      clear(ctl);
      if (grown()) ctl.appendChild(h('div', { class: 'chips', role: 'group', 'aria-label': 'Kind of graph' }, [['line', 'Straight line  y = mx + c'], ['para', 'Parabola  y = ax² + c']].map(o => h('button', { type: 'button', class: 'chip', 'aria-pressed': gstate.mode === o[0] ? 'true' : 'false', onclick: () => { gstate.mode = o[0]; draw(); } }, o[1]))));
      ctl.appendChild(para ? sl('a', -3, 3, 0.5, 'a (how steep and which way it opens)') : sl('m', -5, 5, grown() ? 0.5 : 1, 'm (slope)'));
      ctl.appendChild(sl('c', -8, 8, 1, 'c (where it crosses the y-axis)'));
      const eq = para ? 'y = ' + (gstate.a === 1 ? '' : gstate.a === -1 ? '−' : String(gstate.a).replace('-', '−')) + 'x²' + (gstate.c === 0 ? '' : (gstate.c < 0 ? ' − ' : ' + ') + Math.abs(gstate.c)) : (function () {
        const m = gstate.m, c = gstate.c, mm = m === 1 ? '' : m === -1 ? '−' : String(m).replace('-', '−');
        return m === 0 ? 'y = ' + c : 'y = ' + mm + 'x' + (c === 0 ? '' : (c < 0 ? ' − ' : ' + ') + Math.abs(c));
      })();
      clear(out); out.appendChild(h('p', { class: 'ex-big' }, eq));
      out.appendChild(h('p', null, para
        ? (gstate.a === 0 ? 'With a = 0 the curve is a flat line at y = ' + gstate.c + '.' : 'The curve ' + (gstate.a > 0 ? 'opens upwards' : 'opens downwards') + ' and its turning point is at (0, ' + gstate.c + ').')
        : (gstate.m === 0 ? 'With slope 0 the line is flat.' : 'Each step right, the line goes ' + (gstate.m > 0 ? 'up' : 'down') + ' by ' + Math.abs(gstate.m) + '. It crosses the y-axis at (0, ' + gstate.c + ').')));
      const xs = grown() ? [-3, -2, -1, 0, 1, 2, 3] : [0, 1, 2, 3, 4, 5], f = x => para ? gstate.a * x * x + gstate.c : gstate.m * x + gstate.c;
      clear(table).appendChild(h('table', { class: 'ex-vtable' }, h('caption', { class: 'sr-only' }, 'Table of values'),
        h('tbody', null, h('tr', null, h('th', { scope: 'row' }, 'x'), xs.map(x => h('td', null, String(x)))), h('tr', null, h('th', { scope: 'row' }, 'y'), xs.map(x => h('td', null, String(+f(x).toFixed(2))))))));
    }
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Graphing toy'),
      h('p', null, grown() ? 'Change the sliders and watch the graph move. The red dot is where the graph crosses the y-axis.' : 'Move the sliders and watch the line move. The red dot shows where it crosses the up-and-down line.'),
      h('div', { class: 'ex-graphline' }, fig, h('div', null, ctl, out, table))));
    draw();
  }

  /* ================= quiz ================= */
  function decorate(qs) {
    return qs.map(q => {
      if (q.pie) q.node = () => pieSvg(q.pie.pieces, q.pie.shaded, 150);
      else if (q.angle) q.node = () => angleSvg(q.angle, 150);
      else if (q.graph) { q.node = () => graphSvg(q.graph, 190); q.bigLabel = 'A graph of the line'; }
      return q;
    });
  }
  function renderQuiz(box) {
    const L = lib;
    SIT.exQuiz(box, [
      { key: () => 'math-frac', label: '🥧 Fractions', text: 'Read pies, find equivalents, compare and share amounts.', make: l => decorate(L.fractionQuestions(l, 10)) },
      { key: () => 'math-tables', label: '✖️ Times tables', text: 'Ten quick multiplication facts.', make: () => L.tableQuestions(0, 10) },
      { key: () => 'math-shapes', label: '🔷 Shapes and angles', text: 'Sides, corners and angle names.', make: l => decorate(L.shapeQuestions(data.shapes, l, 5).concat(L.angleQuestions(l, 5))) },
      { key: () => 'math-graph', label: '📈 Graphs', text: 'Read values from straight-line rules.', make: l => decorate(L.graphQuestions(l, 8)) }
    ]);
  }

  SIT.explorer('math', {
    title: 'Math Playground', icon: '➗',
    ledeKid: 'Slice pies, beat the times tables, hunt for shapes and draw lines that move!',
    ledeGrown: 'Fractions with pie visuals, times-table mastery tracking, shapes and angles, and a simple graphing toy.',
    tabs: [
      { id: 'fractions', label: '🥧 Fractions', render: renderFractions }, { id: 'tables', label: '✖️ Times tables', render: renderTables },
      { id: 'shapes', label: '🔷 Shapes and angles', render: renderShapes }, { id: 'graph', label: '📈 Graphing', render: renderGraph },
      { id: 'quiz', label: '❓ Quiz', render: renderQuiz }
    ]
  });
})();
