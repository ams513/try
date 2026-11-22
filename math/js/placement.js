/* Stark Math. Diagnostic placement: a short adaptive test that walks up and down the grade bands of the curriculum
   map (two or three questions per band) until it finds the highest band the learner can do, then recommends a level.
   Pure state machine (no DOM, no storage): start -> next -> answer ... -> result. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;
  const GROUPS = { math: { name: 'Maths', subjects: ['math', 'words', 'calc', 'linalg', 'stats'] }, science: { name: 'Science', subjects: ['physics', 'chem'] } };
  const MAX_PER_BAND = 3;

  /** Questions in one band: skills from that band that work at the band's level, in a stable order. */
  function poolOf(band, group) {
    const b = SM.curriculum.BAND[band], subs = GROUPS[group].subjects;
    return SM.curriculum.inBand(band, subs).filter(id => SM.inRange(SM.SKILL[id], b.lv)).sort();
  }
  /** opts: { group: 'math' | 'science', start: band id, seed } */
  function start(opts) {
    const group = GROUPS[opts.group] ? opts.group : 'math';
    const bands = SM.curriculum.BANDS.map(b => b.id).filter(id => poolOf(id, group).length >= 2);
    let i = bands.indexOf(opts.start); if (i < 0) i = Math.min(bands.length - 1, Math.max(0, bands.indexOf('g68') >= 0 ? bands.indexOf('g68') : Math.floor(bands.length / 2)));
    return { group, bands, i, lo: -1, hi: bands.length, asked: {}, used: {}, log: [], done: false, seed: String(opts.seed || 'place'), cur: null };
  }
  /** The next question, or null when the test is finished. */
  function next(st) {
    if (st.done) return null;
    const band = st.bands[st.i], b = SM.curriculum.BAND[band], pool = poolOf(band, st.group), used = st.used[band] || [];
    const k = used.length, r = SM.rng(st.seed + '|' + band + '|' + k);
    const free = pool.filter(id => !used.includes(id)), id = (free.length ? free : pool)[Math.floor(r.next() * (free.length || pool.length))];
    st.used[band] = used.concat(id);
    st.cur = { band, skill: id, lv: b.lv, df: b.df, seed: 'place|' + st.seed + '|' + band + '|' + k };
    return st.cur;
  }
  /** Record whether the current question was answered correctly. */
  function answer(st, ok) {
    if (st.done || !st.cur) return st;
    const i = st.i, a = (st.asked[i] = (st.asked[i] || []).concat(!!ok));
    st.log.push({ band: st.cur.band, skill: st.cur.skill, ok: !!ok }); st.cur = null;
    const right = a.filter(Boolean).length, wrong = a.length - right;
    let verdict = '';
    if (a.length >= 2 && right === a.length) verdict = 'pass';
    else if (a.length >= 2 && wrong === a.length) verdict = 'fail';
    else if (a.length >= MAX_PER_BAND) verdict = right >= 2 ? 'pass' : 'fail';
    if (verdict === 'pass') { st.lo = Math.max(st.lo, i); if (i + 1 < st.hi) st.i = i + 1; else st.done = true; }
    else if (verdict === 'fail') { st.hi = Math.min(st.hi, i); if (i - 1 > st.lo) st.i = i - 1; else st.done = true; }
    return st;
  }
  /** Placement once done: the highest band passed (or the first band, marked "below", when none was passed). */
  function result(st) {
    const idx = Math.max(0, st.lo), band = SM.curriculum.BAND[st.bands[idx]];
    const preset = SM.PRESETS.find(p => p.id === band.preset) || SM.PRESETS[0];
    const correct = st.log.filter(x => x.ok).length;
    const below = st.lo < 0, top = st.lo === st.bands.length - 1;
    const note = below ? 'Start with the basics: ' + band.name + ' at Gentle difficulty.' : top ? 'Every band was passed. ' + band.name + ' fits; the Professor level is there when you want more.' : band.name + ' fits best: the next band up was still tricky.';
    return { group: st.group, band: band.id, bandName: band.name, preset: preset.id, lv: preset.lv, df: below ? 0 : preset.df, below, top, correct, total: st.log.length, note, log: st.log.slice() };
  }
  SM.placement = { GROUPS, poolOf, start, next, answer, result, MAX_PER_BAND };
})();
