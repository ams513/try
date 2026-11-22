/* Stark IntraTheater by Stark. Explorer logic as pure functions (no DOM, no storage, no network):
   question builders for the Science, Art, Math and Languages explorers, fraction and angle helpers, times-table mastery rules.
   Every builder takes an optional rng (a function returning 0..1) so tests/test_data.py can run it under node with a seed. */
(function (root) {
  'use strict';
  const SIT = root.SIT = root.SIT || {};
  const R = rng => rng || Math.random;

  function shuffle(a, rng) { a = a.slice(); const r = R(rng); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const sample = (a, n, rng) => shuffle(a, rng).slice(0, n);
  const pickOne = (a, rng) => a[Math.floor(R(rng)() * a.length)];
  const randInt = (lo, hi, rng) => lo + Math.floor(R(rng)() * (hi - lo + 1));
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const simplify = (n, d) => { const g = gcd(n, d) || 1; return [n / g, d / g]; };
  const frac = (n, d) => n + '/' + d;

  /* answer plus up to k-1 distinct distractors drawn from pool (strings); the answer is always in the result */
  function mcq(answer, pool, rng, k) {
    const ans = String(answer);
    const others = shuffle(Array.from(new Set(pool.map(String))).filter(x => x !== ans), rng).slice(0, (k || 4) - 1);
    return shuffle(others.concat([ans]), rng);
  }
  function make(id, q, answer, pool, rng, note, extra) {
    return Object.assign({ id, q, answer: String(answer), choices: mcq(answer, pool, rng, 4), note: note || '' }, extra || {});
  }

  /* ---------- pies ---------- */
  /* SVG path for slice i (0-based) of n equal slices of a circle at (cx, cy), starting at 12 o'clock and going clockwise */
  function piePath(cx, cy, r, i, n) {
    if (n <= 1) return 'M ' + cx + ' ' + (cy - r) + ' A ' + r + ' ' + r + ' 0 1 1 ' + cx + ' ' + (cy + r) + ' A ' + r + ' ' + r + ' 0 1 1 ' + cx + ' ' + (cy - r) + ' Z';
    const a0 = -Math.PI / 2 + 2 * Math.PI * i / n, a1 = -Math.PI / 2 + 2 * Math.PI * (i + 1) / n;
    const f = x => Math.round(x * 100) / 100;
    return 'M ' + cx + ' ' + cy + ' L ' + f(cx + r * Math.cos(a0)) + ' ' + f(cy + r * Math.sin(a0)) + ' A ' + r + ' ' + r + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + f(cx + r * Math.cos(a1)) + ' ' + f(cy + r * Math.sin(a1)) + ' Z';
  }

  /* ---------- angles ---------- */
  function angleKind(deg) {
    if (deg > 0 && deg < 90) return 'acute';
    if (deg === 90) return 'right';
    if (deg > 90 && deg < 180) return 'obtuse';
    if (deg === 180) return 'straight';
    if (deg > 180 && deg < 360) return 'reflex';
    if (deg === 360) return 'full';
    return 'zero';
  }
  const KIND_NAME = { acute: 'Acute', right: 'Right', obtuse: 'Obtuse', straight: 'Straight', reflex: 'Reflex', full: 'Full turn', zero: 'Zero' };

  /* ---------- question builders ---------- */
  function fractionQuestions(level, n, rng) {
    const grown = level === 'grown', out = [];
    const dens = grown ? [2, 3, 4, 5, 6, 8, 10, 12] : [2, 3, 4, 5, 6, 8];
    const types = grown ? ['shade', 'simplify', 'compare', 'percent', 'amount', 'equiv'] : ['shade', 'shade', 'equiv', 'amount'];
    for (let i = 0; out.length < n && i < n * 12; i++) {
      const t = types[i % types.length], id = 'f' + out.length;
      if (t === 'shade') {
        const d = pickOne(dens, rng), a = randInt(1, d - 1, rng);
        const pool = []; dens.forEach(dd => { for (let x = 1; x < dd; x++) if (x * d !== a * dd) pool.push(frac(x, dd)); });
        out.push(make(id, 'What fraction of the pie is shaded?', frac(a, d), pool, rng, a + ' of the ' + d + ' equal slices are shaded, so the fraction is ' + frac(a, d) + '.',
          { pie: { pieces: d, shaded: a }, bigLabel: 'A pie cut into ' + d + ' equal slices with ' + a + ' shaded' }));
      } else if (t === 'equiv') {
        const base = pickOne([[1, 2], [1, 3], [2, 3], [3, 4], [1, 4], [2, 5]], rng), k = randInt(2, grown ? 6 : 4, rng);
        const ans = base[0] * k, pool = [ans + 1, ans + 2, Math.max(1, ans - 1), ans + base[0], k, base[1] * k];
        out.push(make(id, frac(base[0], base[1]) + ' = ?/' + (base[1] * k), ans, pool, rng, 'Multiply top and bottom by ' + k + ': ' + frac(base[0], base[1]) + ' = ' + frac(ans, base[1] * k) + '.'));
      } else if (t === 'amount') {
        const d = pickOne(grown ? [2, 3, 4, 5, 8, 10] : [2, 3, 4], rng), a = randInt(1, d - 1, rng), m = randInt(2, grown ? 9 : 5, rng) * d;
        const ans = a * m / d;
        out.push(make(id, 'What is ' + frac(a, d) + ' of ' + m + '?', ans, [ans + 1, ans + d, Math.max(1, ans - 1), m / d, m - ans, ans * 2], rng, 'Divide ' + m + ' by ' + d + ' to get ' + (m / d) + ', then multiply by ' + a + ': ' + ans + '.'));
      } else if (t === 'simplify') {
        const base = pickOne([[1, 2], [1, 3], [2, 3], [3, 4], [2, 5], [3, 5], [5, 6]], rng), k = randInt(2, 4, rng);
        const pool = []; [[1, 2], [1, 3], [2, 3], [3, 4], [2, 5], [3, 5], [5, 6], [1, 4], [4, 5]].forEach(p => { if (p[0] * base[1] !== p[1] * base[0]) pool.push(frac(p[0], p[1])); });
        out.push(make(id, 'Write ' + frac(base[0] * k, base[1] * k) + ' in its simplest form.', frac(base[0], base[1]), pool, rng, 'Divide top and bottom by ' + k + '.'));
      } else if (t === 'compare') {
        let a, b, p, q;
        do { p = pickOne([[1, 2], [2, 3], [3, 4], [3, 5], [5, 8], [4, 7], [5, 6], [2, 5], [3, 8], [7, 10]], rng); q = pickOne([[1, 2], [2, 3], [3, 4], [3, 5], [5, 8], [4, 7], [5, 6], [2, 5], [3, 8], [7, 10]], rng); } while (p[0] * q[1] === q[0] * p[1]);
        a = frac(p[0], p[1]); b = frac(q[0], q[1]);
        const bigger = p[0] * q[1] > q[0] * p[1] ? a : b;
        out.push({ id, q: 'Which is larger, ' + a + ' or ' + b + '?', choices: shuffle([a, b], rng), answer: bigger, note: a + ' = ' + (p[0] / p[1]).toFixed(3).replace(/0+$/, '') + ' and ' + b + ' = ' + (q[0] / q[1]).toFixed(3).replace(/0+$/, '') + ' (to 3 decimal places).' });
      } else if (t === 'percent') {
        const p = pickOne([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [1, 20], [1, 25]], rng);
        const ans = (100 * p[0] / p[1]) + '%';
        out.push(make(id, 'What is ' + frac(p[0], p[1]) + ' as a percentage?', ans, ['10%', '20%', '25%', '30%', '40%', '50%', '60%', '75%', '80%', '5%', '4%', '70%'], rng, frac(p[0], p[1]) + ' = ' + (p[0] / p[1]) + ' = ' + ans + '.'));
      }
    }
    return out;
  }

  function tableQuestions(table, n, rng) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = table ? table : randInt(2, 12, rng), b = randInt(2, 12, rng), ans = a * b;
      const pool = [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, ans + 10, ans - 10, ans + 2, ans - 2].filter(x => x > 0);
      out.push(make('t' + i, a + ' × ' + b + ' = ?', ans, pool, rng, a + ' × ' + b + ' = ' + ans + '.'));
    }
    return out;
  }

  function shapeQuestions(shapes, level, n, rng) {
    const grown = level === 'grown', out = [];
    const poly = shapes.filter(s => s.sides >= 3);
    const sidesPool = shapes.map(s => s.sides);
    for (let i = 0; i < n; i++) {
      const id = 's' + i, mode = grown ? i % 3 : i % 2;
      if (mode === 0 && !grown) {
        const s = pickOne(poly.filter(p => ['triangle', 'square', 'pentagon', 'hexagon', 'octagon'].indexOf(p.id) >= 0), rng);
        out.push(make(id, 'How many sides does a ' + s.name.toLowerCase().replace(/ \(.*\)/, '') + ' have?', s.sides, sidesPool.concat([3, 4, 5, 6, 8]), rng, 'A ' + s.name.toLowerCase().replace(/ \(.*\)/, '') + ' has ' + s.sides + ' sides.'));
      } else if (mode === 1 && !grown) {
        const cands = poly.filter(p => ['triangle', 'pentagon', 'hexagon', 'octagon', 'heptagon', 'decagon'].indexOf(p.id) >= 0), s = pickOne(cands, rng);
        out.push(make(id, 'Which shape has ' + s.sides + ' sides?', s.name, cands.map(c => c.name).concat(['Circle']), rng, s.name + ' has ' + s.sides + ' sides.'));
      } else if (grown && mode === 0) {
        const s = pickOne(poly, rng);
        out.push(make(id, 'What do the interior angles of a ' + s.name.toLowerCase().replace(/ \(.*\)/, '') + ' add up to?', s.sum + ' degrees', poly.map(p => p.sum + ' degrees'), rng, 'Interior angles add up to (n − 2) × 180 degrees, with n = ' + s.sides + ': ' + s.sum + ' degrees.'));
      } else if (grown && mode === 1) {
        const k = pickOne([3, 4, 5, 6, 8, 9, 10], rng), ans = (k - 2) * 180 / k;
        out.push(make(id, 'Each interior angle of a regular polygon with ' + k + ' sides measures how many degrees?', ans + ' degrees', [60, 90, 108, 120, 135, 140, 144].map(x => x + ' degrees'), rng, '(' + k + ' − 2) × 180 ÷ ' + k + ' = ' + ans + '.'));
      } else {
        const m = pickOne([30, 40, 50, 60, 70, 80], rng), o = pickOne([40, 50, 60, 70, 80, 20], rng), ans = 180 - m - o;
        if (ans <= 0) { i--; continue; }
        out.push(make(id, 'Two angles of a triangle are ' + m + ' and ' + o + ' degrees. What is the third?', ans + ' degrees', [ans + 10, ans - 10, ans + 20, 180 - m, 180 - o, 90].filter(x => x > 0 && x !== ans).map(x => x + ' degrees'), rng, '180 − ' + m + ' − ' + o + ' = ' + ans + '.'));
      }
    }
    return out;
  }

  function angleQuestions(level, n, rng) {
    const grown = level === 'grown', out = [];
    const degs = grown ? [30, 45, 60, 90, 110, 135, 150, 180, 210, 250, 300] : [30, 45, 60, 90, 120, 150, 180];
    const names = grown ? ['Acute', 'Right', 'Obtuse', 'Straight', 'Reflex'] : ['Acute', 'Right', 'Obtuse', 'Straight'];
    for (let i = 0; i < n; i++) {
      const d = pickOne(degs, rng);
      if (grown && i % 3 === 2) {
        const a = pickOne([20, 35, 50, 65, 80, 110, 125], rng);
        out.push(make('a' + i, 'Two angles sit side by side on a straight line. One is ' + a + ' degrees. What is the other?', (180 - a) + ' degrees', [a + ' degrees', (90 - a > 0 ? 90 - a : 90 + a) + ' degrees', (360 - a) + ' degrees', (180 - a + 10) + ' degrees', (180 - a - 10) + ' degrees'], rng, 'Angles on a straight line add up to 180 degrees.'));
      } else {
        out.push(make('a' + i, 'What kind of angle is this? (' + d + ' degrees)', KIND_NAME[angleKind(d)], names, rng, d + ' degrees is a ' + KIND_NAME[angleKind(d)].toLowerCase() + ' angle.', { angle: d, bigLabel: 'An angle of ' + d + ' degrees' }));
      }
    }
    return out;
  }

  function lineText(m, c) {
    const mm = m === 1 ? '' : (m === -1 ? '−' : String(m).replace('-', '−'));
    return 'y = ' + mm + 'x' + (c === 0 ? '' : (c < 0 ? ' − ' : ' + ') + Math.abs(c));
  }
  function graphQuestions(level, n, rng) {
    const grown = level === 'grown', out = [];
    for (let i = 0; i < n; i++) {
      const m = grown ? pickOne([-3, -2, -1, 1, 2, 3, 4], rng) : pickOne([1, 2, 3], rng), c = randInt(grown ? -6 : 0, 6, rng), x = randInt(grown ? -3 : 1, 5, rng);
      const t = grown ? i % 4 : i % 2;
      if (t === 0) {
        const ans = m * x + c;
        out.push(make('g' + i, 'On the line ' + lineText(m, c) + ', what is y when x = ' + x + '?', ans, [ans + 1, ans - 1, ans + m, ans - m, ans + 2, m + c, m * x], rng, 'Put x = ' + x + ' into the rule: ' + m + ' × ' + x + ' + ' + c + ' = ' + ans + '.', { graph: { m, c } }));
      } else if (t === 1) {
        out.push(make('g' + i, 'Where does the line ' + lineText(m, c) + ' cross the y-axis?', '(0, ' + c + ')', [[0, -c], [c, 0], [0, c + 1], [0, c - 1], [m, 0], [0, m]].map(p => '(' + p[0] + ', ' + p[1] + ')'), rng, 'The y-axis is where x = 0, so y = c = ' + c + '.', { graph: { m, c } }));
      } else if (t === 2) {
        out.push(make('g' + i, 'What is the slope (gradient) of ' + lineText(m, c) + '?', m, [-m, m + 1, m - 1, c, m * 2, 1], rng, 'In y = mx + c the slope is the number multiplying x.', { graph: { m, c } }));
      } else {
        const r0 = randInt(-3, 4, rng), mm = pickOne([-3, -2, 2, 3, 4], rng), cc = -mm * r0;
        out.push(make('g' + i, 'At what x does the line ' + lineText(mm, cc) + ' cross the x-axis?', r0, [r0 + 1, r0 - 1, -r0, cc, mm, r0 + 2], rng, 'Set y = 0: ' + mm + 'x ' + (cc < 0 ? '− ' : '+ ') + Math.abs(cc) + ' = 0, so x = ' + r0 + '.', { graph: { m: mm, c: cc } }));
      }
    }
    return out;
  }

  function elementQuestions(els, level, n, rng) {
    const grown = level === 'grown', out = [];
    const pool = grown ? els : els.filter(e => e.kid);
    const withGroup = pool.filter(e => e.group);
    const CATS = ['alkali metal', 'alkaline earth metal', 'transition metal', 'post-transition metal', 'metalloid', 'nonmetal', 'halogen', 'noble gas', 'lanthanide', 'actinide'];
    for (let i = 0; i < n; i++) {
      const e = pickOne(pool, rng), id = 'e' + i, t = i % (grown ? 4 : 2);
      if (t === 0) out.push(make(id, 'Which element has the symbol ' + e.sym + '?', e.name, pool.map(x => x.name), rng, e.name + ' (' + e.sym + '): ' + e.fact));
      else if (t === 1) out.push(make(id, 'What is the chemical symbol for ' + e.name.toLowerCase() + '?', e.sym, pool.map(x => x.sym), rng, e.name + ' (' + e.sym + '): ' + e.fact));
      else if (t === 2) out.push(make(id, 'Which element has atomic number ' + e.n + '?', e.name, pool.map(x => x.name), rng, e.name + ' has atomic number ' + e.n + '. ' + e.fact));
      else {
        const g = pickOne(withGroup, rng);
        if (Math.floor(i / 4) % 2) out.push(make(id, 'Which group of the periodic table is ' + g.name.toLowerCase() + ' in?', 'Group ' + g.group, withGroup.map(x => 'Group ' + x.group).concat(['Group 3', 'Group 5', 'Group 11', 'Group 15']), rng, g.name + ' is in group ' + g.group + ', ' + g.cat + 's.'));
        else out.push(make(id, 'What kind of element is ' + g.name.toLowerCase() + '?', g.cat, CATS, rng, g.name + ' is a ' + g.cat + '.'));
      }
    }
    return out;
  }

  const NUM_EN = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const GREET_EN = { hello: 'Hello', goodbye: 'Goodbye', please: 'Please', thankyou: 'Thank you', yes: 'Yes', no: 'No' };
  const COL_EN = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white'];
  const show = w => (w[1] && w[1] !== w[0] ? w[0] + ' (' + w[1] + ')' : w[0]);
  /* all words of a language as {kind, en, native, roman, label}; label is how a word is shown (native plus romanisation) */
  function langItems(lang) {
    const out = [];
    Object.keys(GREET_EN).forEach(k => { const w = lang.words[k]; out.push({ kind: 'greeting', en: GREET_EN[k], native: w[0], roman: w[1], label: show(w) }); });
    lang.numbers.forEach((w, i) => out.push({ kind: 'number', en: String(i + 1) + ' (' + NUM_EN[i] + ')', native: w[0], roman: w[1], label: show(w) }));
    COL_EN.forEach(k => { const w = lang.colours[k]; out.push({ kind: 'colour', en: k.charAt(0).toUpperCase() + k.slice(1), native: w[0], roman: w[1], label: show(w) }); });
    return out;
  }
  function langQuestions(lang, level, n, rng) {
    const items = langItems(lang), out = [];
    for (let i = 0; i < n; i++) {
      const it = pickOne(items, rng), same = items.filter(x => x.kind === it.kind), id = 'l' + i;
      if (level === 'grown') out.push(make(id, 'How do you say “' + it.en + '” in ' + lang.name + '?', it.label, same.map(x => x.label), rng, it.en + ' is ' + it.label + ' in ' + lang.name + '.'));
      else out.push(make(id, 'What does “' + it.label + '” mean in ' + lang.name + '?', it.en, same.map(x => x.en), rng, it.label + ' means ' + it.en + '.'));
    }
    return out;
  }

  /* works: data.arts. 'Who made it?' and 'Which came first?' (pairs at least 100 years apart, so approximate dates cannot change the answer) */
  function artQuestions(works, level, n, rng) {
    const out = [], creators = works.map(w => w.by);
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) {
        const w = pickOne(works, rng);
        out.push(make('w' + i, 'Who made “' + w.title + '”?', w.by, creators, rng, w.title + ' (' + w.date + ') is by ' + w.by + '.'));
      } else {
        let a, b, tries = 0;
        do { a = pickOne(works, rng); b = pickOne(works, rng); } while ((a.id === b.id || Math.abs(a.year - b.year) < 100) && ++tries < 200);
        const first = a.year < b.year ? a : b;
        out.push({ id: 'w' + i, q: 'Which was made first?', choices: shuffle([a.title, b.title], rng), answer: first.title, note: first.title + ' is from ' + first.date + '.' });
      }
    }
    return out;
  }

  /* ---------- times-table mastery ---------- */
  const tableKey = (a, b) => Math.min(a, b) + 'x' + Math.max(a, b);
  const MASTERY_STREAK = 3;
  /* rec: {key: {r, w, s}}. Records one answer and returns the entry. */
  function tableRecord(rec, a, b, ok) {
    const k = tableKey(a, b), e = rec[k] = rec[k] || { r: 0, w: 0, s: 0 };
    if (ok) { e.r++; e.s++; } else { e.w++; e.s = 0; }
    return e;
  }
  const isMastered = (rec, a, b) => { const e = rec[tableKey(a, b)]; return !!e && e.s >= MASTERY_STREAK; };
  /* how many of the facts t x 1..12 are mastered */
  function tableMastery(rec, t) { let m = 0; for (let b = 1; b <= 12; b++) if (isMastered(rec, t, b)) m++; return m; }
  /* the next fact to practise for table t (or any table when t is 0): unmastered facts first, weakest first */
  function nextFact(rec, t, rng) {
    const cands = [];
    for (let a = t || 2; a <= (t || 12); a++) for (let b = 1; b <= 12; b++) {
      if (isMastered(rec, a, b)) continue;
      const e = rec[tableKey(a, b)] || { r: 0, w: 0, s: 0 };
      cands.push({ a, b, wt: 1 + 2 * e.w - e.s });
    }
    if (!cands.length) { const a = t || randInt(2, 12, rng), b = randInt(1, 12, rng); return { a, b, review: true }; }
    cands.sort((x, y) => y.wt - x.wt);
    const top = cands.slice(0, Math.min(4, cands.length));
    const c = pickOne(top, rng);
    return { a: c.a, b: c.b, review: false };
  }

  /* ---------- graph points ---------- */
  function linePoints(m, c, x0, x1) { return [[x0, m * x0 + c], [x1, m * x1 + c]]; }

  const api = { shuffle, sample, pickOne, randInt, gcd, simplify, mcq, piePath, angleKind, KIND_NAME, lineText, fractionQuestions, tableQuestions, shapeQuestions, angleQuestions, graphQuestions,
    elementQuestions, artQuestions, langItems, langQuestions, tableKey, tableRecord, isMastered, tableMastery, nextFact, linePoints, MASTERY_STREAK };
  SIT.expLib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
