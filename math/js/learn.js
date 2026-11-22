/* Stark Math.
   Mastery tracking (Bayesian knowledge tracing, with hints counted honestly) and adaptive practice that serves
   weak and due-for-review skills more often. Pure functions: no DOM, no storage, so the tests can run them. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;
  const P = { init: 0.2, transit: 0.15, slip: 0.1, guess: 0.05, guessChoice: 0.4 };
  const DAY = 86400000;

  function blank() { return { pL: P.init, n: 0, c: 0, streak: 0, best: 0, last: 0, hints: 0 }; }
  /** Update one skill record after an attempt. o = { correct, hints (0..3), revealed, choice, t (ms) } */
  function update(rec, o) {
    rec = Object.assign(blank(), rec || {});
    const g = o.choice ? P.guessChoice : P.guess, s = P.slip, pL = rec.pL;
    const ifCorrect = pL * (1 - s) / (pL * (1 - s) + (1 - pL) * g);
    const ifWrong = pL * s / (pL * s + (1 - pL) * (1 - g));
    let post;
    if (o.revealed || !o.correct) post = ifWrong;
    else { const w = Math.min(0.9, 0.3 * (o.hints || 0)); post = ifCorrect * (1 - w) + ifWrong * w; } // hints dilute the evidence
    const transit = o.revealed ? P.transit * 0.5 : P.transit;
    rec.pL = Math.min(0.999, Math.max(0.001, post + (1 - post) * transit * (o.correct ? 1 : 0.35)));
    rec.n++; if (o.correct && !o.revealed) rec.c++;
    rec.streak = o.correct && !o.revealed && !(o.hints > 1) ? rec.streak + 1 : 0; rec.best = Math.max(rec.best, rec.streak);
    rec.hints += o.hints || 0; rec.last = o.t || Date.now();
    return schedule(rec, o, rec.last);
  }
  /* ---------- spaced repetition ----------
     Each skill carries a review schedule: reps (successful reviews in a row), ivl (days until the next review), ease and
     due (time stamp). A clean correct answer on or after the due date grows the interval (1 day, 3 days, then x ease);
     practising early does not inflate it; a wrong or revealed answer resets it, so the skill is due again at once. */
  const EASE = { start: 2.5, min: 1.3, max: 3 };
  function schedule(rec, o, now) {
    const clean = o.correct && !o.revealed, ease = rec.ease || EASE.start;
    if (!clean) { rec.reps = 0; rec.ivl = 0; rec.ease = Math.max(EASE.min, +(ease - 0.2).toFixed(2)); rec.due = now; return rec; }
    if (rec.due !== undefined && now < rec.due) return rec; // early practice keeps the schedule
    const h = o.hints || 0;
    rec.ease = Math.min(EASE.max, Math.max(EASE.min, +(ease + (h === 0 ? 0.1 : h === 1 ? -0.15 : -0.3)).toFixed(2)));
    rec.reps = (rec.reps || 0) + 1;
    rec.ivl = rec.reps === 1 ? 1 : rec.reps === 2 ? 3 : Math.min(180, Math.round((rec.ivl || 3) * rec.ease));
    if (h >= 2) rec.ivl = Math.min(rec.ivl, 2);
    rec.due = now + rec.ivl * DAY;
    return rec;
  }
  /** When a skill is next due. Records from before scheduling existed fall back to: weak -> a day after practice, strong -> 14 days. */
  const dueAt = rec => (!rec || !rec.n ? Infinity : rec.due !== undefined ? rec.due : rec.last + (rec.pL >= 0.8 ? 14 : 1) * DAY);
  /** Skill ids due for review now, most overdue (relative to their interval) first. */
  function dueList(mastery, now, pool) {
    now = now || Date.now();
    const ids = (pool || Object.keys(mastery)).filter(id => SM.SKILL[id] && dueAt(mastery[id]) <= now);
    const score = id => (now - dueAt(mastery[id])) / (Math.max(1, mastery[id].ivl || 1) * DAY);
    return ids.sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1));
  }
  /** Reviews falling due on each of the next `days` days (index 0 = due now or overdue). */
  function forecast(mastery, now, days) {
    now = now || Date.now(); days = days || 7;
    const out = new Array(days).fill(0), start = new Date(now); start.setHours(0, 0, 0, 0);
    Object.keys(mastery).forEach(id => {
      if (!SM.SKILL[id]) return; const d = dueAt(mastery[id]); if (d === Infinity) return;
      const k = d <= now ? 0 : Math.floor((d - start.getTime()) / DAY);
      if (k >= 0 && k < days) out[k]++;
    });
    return out;
  }
  /** Mastery shown to the learner, with slow forgetting since the last practice. */
  function effective(rec, now) {
    if (!rec || !rec.n) return 0;
    const days = Math.max(0, ((now || Date.now()) - rec.last) / DAY);
    return rec.pL * Math.pow(0.5, days / 45);
  }
  const BANDS = [[0, 'New'], [0.01, 'Learning'], [0.45, 'Practising'], [0.8, 'Strong'], [0.95, 'Mastered']];
  function band(rec, now) {
    if (!rec || !rec.n) return 'New';
    const e = effective(rec, now); let b = 'Learning';
    BANDS.forEach(([x, name]) => { if (e >= x) b = name; });
    if (b === 'Mastered' && rec.n < 4) b = 'Strong';
    return b;
  }
  const reviewDue = (rec, now) => !!rec && rec.pL >= 0.8 && dueAt(rec) <= (now || Date.now()) && ((now || Date.now()) - rec.last) > DAY / 2;
  /** Weight for adaptive selection: weak skills and skills due for review come up more often. */
  function weight(rec, now) {
    if (!rec || !rec.n) return 0.55;
    const e = effective(rec, now);
    return Math.pow(1 - e, 1.5) + 0.04 + (reviewDue(rec, now) ? 0.45 : 0);
  }
  /** Pick the next skill id from candidates. avoid = recent ids to skip when possible. rnd() in [0, 1). */
  function pick(mastery, candidates, rnd, avoid, now) {
    const pool = candidates.filter(id => !(avoid || []).includes(id));
    const list = pool.length ? pool : candidates;
    const ws = list.map(id => weight(mastery[id], now)), tot = ws.reduce((a, b) => a + b, 0);
    let x = rnd() * tot;
    for (let i = 0; i < list.length; i++) { x -= ws[i]; if (x <= 0) return list[i]; }
    return list[list.length - 1];
  }
  /** Skills that fit a learner's level, optionally limited to a subject and strand. */
  function poolFor(lv, subject, strand) {
    return SM.SKILLS.filter(s => SM.inRange(s, lv) && (!subject || s.subject === subject) && (!strand || s.strand === strand)).map(s => s.id);
  }
  /** Overall summary per subject: share of in-level skills at Strong or above. */
  function summary(mastery, lv, now) {
    const out = {};
    SM.SUBJECTS.forEach(sub => {
      const ids = poolFor(lv, sub.id); if (!ids.length) return;
      const strong = ids.filter(id => ['Strong', 'Mastered'].includes(band(mastery[id], now))).length, tried = ids.filter(id => mastery[id] && mastery[id].n).length;
      out[sub.id] = { total: ids.length, strong, tried };
    });
    return out;
  }
  SM.learn = { P, blank, update, effective, band, reviewDue, weight, pick, poolFor, summary, schedule, dueAt, dueList, forecast, EASE };
})();
