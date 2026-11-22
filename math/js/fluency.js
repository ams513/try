/* Stark Math. Fact fluency: one-minute sprints on addition, subtraction, times-table and division facts. Every fact
   keeps its own record (tries, correct, typical answer time), so the grid shows which facts are fluent, slow or
   missed, and the next sprint brings the weak ones back more often. Pure (no DOM). */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;
  const FLUENT_MS = 3000;
  const SETS = [
    { id: 'add10', name: 'Addition within 10', op: '+' }, { id: 'add20', name: 'Addition within 20', op: '+' },
    { id: 'sub20', name: 'Subtraction within 20', op: '−' }, { id: 'mul', name: 'Times tables', op: '×' }, { id: 'div', name: 'Division facts', op: '÷' },
  ];
  const SET = {}; SETS.forEach(s => { SET[s.id] = s; });
  const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };

  /** Every fact in a set. tables: which times tables (2..12) for 'mul' and 'div'. */
  function facts(set, tables) {
    const t = (tables && tables.length ? tables : range(2, 12)).filter(n => n >= 1 && n <= 12), out = [];
    const f = (a, b, op, ans) => out.push({ a, b, op, ans, key: a + op + b });
    if (set === 'add10') range(0, 10).forEach(a => range(0, 10 - a).forEach(b => f(a, b, '+', a + b)));
    else if (set === 'add20') range(0, 10).forEach(a => range(0, 10).forEach(b => f(a, b, '+', a + b)));
    else if (set === 'sub20') range(0, 10).forEach(a => range(0, 10).forEach(b => f(a + b, b, '−', a)));
    else if (set === 'mul') t.forEach(a => range(1, 12).forEach(b => f(a, b, '×', a * b)));
    else if (set === 'div') t.forEach(a => range(1, 12).forEach(b => f(a * b, a, '÷', b)));
    return out;
  }
  /** 'new' | 'missed' | 'slow' | 'fluent' */
  function status(rec) {
    if (!rec || !rec.n) return 'new';
    if (!rec.last) return 'missed';
    return rec.c >= 2 && rec.ms <= FLUENT_MS ? 'fluent' : 'slow';
  }
  /** Record one answer: rec = { n, c, ms (smoothed time of correct answers), last (bool) } */
  function record(rec, ok, ms) {
    rec = Object.assign({ n: 0, c: 0, ms: 0, last: false }, rec || {});
    rec.n++; rec.last = !!ok;
    if (ok) { rec.c++; const t = Math.max(200, Math.min(60000, Math.round(ms))); rec.ms = rec.c === 1 ? t : Math.round(rec.ms * 0.6 + t * 0.4); }
    return rec;
  }
  const W = { missed: 5, new: 3, slow: 3, fluent: 1 };
  /** Next fact, weighted towards missed, new and slow facts; avoid = key to skip (no repeats in a row). */
  function pick(stats, list, rnd, avoid) {
    const pool = list.length > 1 ? list.filter(f => f.key !== avoid) : list;
    const ws = pool.map(f => W[status(stats[f.key])]), tot = ws.reduce((a, b) => a + b, 0);
    let x = rnd() * tot; for (let i = 0; i < pool.length; i++) { x -= ws[i]; if (x <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  function summary(stats, list) {
    const out = { total: list.length, new: 0, missed: 0, slow: 0, fluent: 0 };
    list.forEach(f => { out[status(stats[f.key])]++; });
    out.pct = list.length ? Math.round(100 * out.fluent / list.length) : 0;
    return out;
  }
  /** Score a finished sprint: [{ key, ok, ms }] */
  function score(answers) { const ok = answers.filter(a => a.ok).length; return { total: answers.length, correct: ok, accuracy: answers.length ? Math.round(100 * ok / answers.length) : 0 }; }
  const prompt = f => f.a + ' ' + f.op + ' ' + f.b;
  SM.fluency = { SETS, SET, FLUENT_MS, facts, status, record, pick, summary, score, prompt };
})();
