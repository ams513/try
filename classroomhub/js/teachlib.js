/* Stark Classroom Hub 1.1: the teacher tools. Lesson planner and unit calendar, attendance, seating chart, private
   notes, groups, rubric library, standards-based grading, differentiation, conference reports, substitute packets and
   planning packs shared as files. Pure functions (no DOM, no storage, no network); hublib.js installs them into
   SCH.lib, and tests/test_hub.py runs them in node. */
(function (root) {
  'use strict';
  const SCH = root.SCH = root.SCH || {};
  const VERSION = '1.4.2', SHARE_APP = 'stark-classroomhub-share';
  const LIM = { standards: 300, units: 60, plans: 600, days: 400, notes: 3000, rubrics: 100, sets: 30, apart: 60 };
  const MARKS = { P: 'Present', L: 'Late', A: 'Absent', E: 'Excused' };
  const KINDS = { positive: 'Positive', concern: 'Concern', note: 'Note' };
  const TIERS = { support: 'Support', core: 'Core', extend: 'Extend' };
  const METHODS = { decaying: 'Decaying average (newest counts most)', mean: 'Mean of all evidence', recent: 'Most recent evidence', highest: 'Highest evidence' };
  const PROF = [[3.5, 4, 'Exceeds'], [2.5, 3, 'Meets'], [1.5, 2, 'Approaching'], [-1, 1, 'Beginning']];
  const SUB_FIELDS = ['routines', 'emergency', 'helpers', 'materials', 'notes'];
  const CODE_OK = /^[A-Za-z0-9][A-Za-z0-9.\-_:]{0,23}$/;
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const r2 = v => Math.round(v * 100) / 100, round1 = v => Math.round(v * 10) / 10;
  const clampInt = (v, a, b, d) => { const n = parseInt(v, 10); return isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  const rnd36 = n => { const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null; if (c && c.getRandomValues) return Array.from(c.getRandomValues(new Uint8Array(n)), x => (x % 36).toString(36)).join(''); let s = ''; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 36).toString(36); return s; };
  const uid = (p, list) => { const used = new Set((list || []).map(x => x.id)); let id; do { id = p + rnd36(6); } while (used.has(id) || id.length < 4); return id; };

  /* ---------- built-in rubric templates (our own wording; level 4 down to level 1) ---------- */
  const T = (text, l4, l3, l2, l1) => ({ text, max: 4, std: '', levels: [l4, l3, l2, l1] });
  const TEMPLATES = [
    { id: 'tpl-writing', title: 'Writing (any genre)', criteria: [
      T('Ideas and content', 'Ideas are original, focused and fully developed with telling details.', 'Ideas are clear and focused, with relevant details.', 'Ideas are present but thin or drift off topic.', 'Ideas are unclear or missing.'),
      T('Organisation', 'Strong opening, logical order and a satisfying ending; smooth transitions.', 'Clear opening, middle and end; transitions mostly work.', 'Some order, but the opening, ending or transitions are weak.', 'Hard to follow; no clear order.'),
      T('Voice and word choice', 'Precise, lively words and a voice that suits the reader.', 'Words are fitting and the voice is clear.', 'Words are general or repeated; the voice comes and goes.', 'Words are vague or misused.'),
      T('Conventions', 'Spelling, punctuation and grammar are almost always correct.', 'A few errors that do not get in the way of meaning.', 'Several errors that sometimes get in the way.', 'Many errors make it hard to read.')] },
    { id: 'tpl-oral', title: 'Oral presentation', criteria: [
      T('Content', 'Accurate, well chosen content that goes beyond the basics.', 'Accurate content that covers the topic.', 'Some content is thin or inaccurate.', 'Little accurate content.'),
      T('Delivery', 'Clear voice, steady pace and eye contact throughout.', 'Mostly clear and well paced, with some eye contact.', 'Sometimes hard to hear or rushed; reads notes a lot.', 'Hard to hear or follow.'),
      T('Organisation', 'Clear structure the audience can follow with ease.', 'A beginning, middle and end the audience can follow.', 'Some structure, but parts jump around.', 'No clear structure.'),
      T('Answering questions', 'Answers questions fully and with confidence.', 'Answers most questions clearly.', 'Answers some questions, briefly.', 'Cannot yet answer questions.')] },
    { id: 'tpl-research', title: 'Research project', criteria: [
      T('Research question', 'A focused, interesting question that drives the whole project.', 'A clear question the project answers.', 'A broad or unclear question.', 'No clear question.'),
      T('Sources', 'Several reliable sources, compared and checked.', 'Enough reliable sources for the question.', 'Few sources, or some unreliable ones.', 'No real sources.'),
      T('Analysis', 'Connects evidence to reach thoughtful conclusions.', 'Explains what the evidence shows.', 'Lists facts with little explanation.', 'Facts are missing or copied.'),
      T('Citing sources', 'Every source is credited correctly.', 'Sources are credited with small slips.', 'Some sources are not credited.', 'Sources are not credited.')] },
    { id: 'tpl-science', title: 'Science investigation', criteria: [
      T('Question and prediction', 'A testable question and a prediction with a reason.', 'A testable question and a prediction.', 'A question that is hard to test, or no prediction.', 'No clear question.'),
      T('Fair test', 'Changes one variable, controls the rest and repeats trials.', 'Changes one variable and controls most others.', 'More than one thing changes at once.', 'The method does not test the question.'),
      T('Data and observations', 'Accurate, well organised data with units and a suitable graph.', 'Accurate data in a table with units.', 'Some data is missing or unorganised.', 'Little or no data.'),
      T('Conclusion', 'Uses the data to answer the question and suggests improvements.', 'Uses the data to answer the question.', 'A conclusion that is not linked to the data.', 'No conclusion.')] },
    { id: 'tpl-maths', title: 'Maths problem solving', criteria: [
      T('Understands the problem', 'Restates the problem and picks out every key fact.', 'Picks out the key facts.', 'Misses some key facts.', 'Misreads the problem.'),
      T('Strategy', 'An efficient strategy, chosen for a reason.', 'A strategy that works.', 'A strategy that only partly works.', 'No clear strategy.'),
      T('Accuracy', 'Calculations are correct and checked.', 'Calculations are mostly correct.', 'Several calculation errors.', 'Many errors.'),
      T('Explains reasoning', 'Clear explanation with correct maths words and diagrams.', 'Explains the steps clearly.', 'Some steps are explained.', 'Little or no explanation.')] },
    { id: 'tpl-group', title: 'Group work', criteria: [
      T('Contributes ideas', 'Offers useful ideas and builds on others.', 'Offers ideas that help the group.', 'Offers ideas now and then.', 'Rarely offers ideas.'),
      T('Listens and responds', 'Listens closely and responds with respect, even when disagreeing.', 'Listens and responds politely.', 'Sometimes talks over others.', 'Does not yet listen to others.'),
      T('Shares the work', 'Does a fair share and helps others finish.', 'Does a fair share.', 'Does part of a share.', 'Leaves the work to others.'),
      T('Stays on task', 'Keeps the group focused.', 'Stays focused.', 'Needs reminders.', 'Often off task.')] }
  ];

  /* seeded random numbers so groups and seating can be repeated in tests */
  function rng(seed) {
    let h = 1779033703 ^ String(seed).length;
    for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  function install(lib) {
    const { clip, isoOk, addDays, csvCell, canon, sha256, unsafeKeys } = lib;
    const N = SCH.notes || (typeof require !== 'undefined' ? require('./notes.js') : null);
    const txt = (v, n) => clip(v, n);
    const nameOf = (state, sid) => (state.students.find(s => s.id === sid) || {}).name || '';
    const hasSid = (state, sid) => state.students.some(s => s.id === sid);
    const codeOk = c => typeof c === 'string' && CODE_OK.test(c);
    const levelsOk = l => (Array.isArray(l) && l.length === 4 ? l.map(x => txt(x, 300)) : []);

    /* ---------- state: defaults and the sanitiser for every 1.1 field ---------- */
    function emptyExtra() {
      return { standards: [], units: [], plans: [], attendance: {}, seating: { rows: 5, cols: 6, seats: {}, apart: [] }, groupSets: [], notes: [], rubrics: [], conf: {},
        sub: { routines: '', emergency: '', helpers: '', materials: '', notes: '' }, sbg: { method: 'decaying' }, pn: N.emptyPn() };
    }
    function cleanCriteria(list, max) {
      const out = [];
      (Array.isArray(list) ? list : []).slice(0, max || 20).forEach(c => { if (!isObj(c)) return; const t = txt(c.text, 300); if (!t) return; out.push({ text: t, max: clampInt(c.max, 1, 100, 4), std: codeOk(c.std) ? c.std : '', levels: levelsOk(c.levels) }); });
      return out;
    }
    function sanitizeExtra(o, s) {
      Object.assign(s, emptyExtra());
      const sids = new Set(s.students.map(x => x.id));
      const codes = new Set();
      (Array.isArray(o.standards) ? o.standards : []).slice(0, LIM.standards).forEach(x => { if (!isObj(x) || !codeOk(x.code) || codes.has(x.code.toLowerCase())) return; codes.add(x.code.toLowerCase()); s.standards.push({ code: x.code, label: txt(x.label, 200) }); });
      const stds = l => (Array.isArray(l) ? l : []).filter(c => codeOk(c) && codes.has(c.toLowerCase())).filter((c, i, a) => a.indexOf(c) === i).slice(0, 30);
      const uids = new Set();
      (Array.isArray(o.units) ? o.units : []).slice(0, LIM.units).forEach(u => {
        if (!isObj(u) || typeof u.id !== 'string' || !/^u[a-z0-9]{2,24}$/.test(u.id) || uids.has(u.id)) return;
        const title = txt(u.title, 120); if (!title) return; uids.add(u.id);
        const start = isoOk(u.start) ? u.start : '', end = isoOk(u.end) && (!start || u.end >= start) ? u.end : '';
        s.units.push({ id: u.id, title, start, end, goal: txt(u.goal, 600), standards: stds(u.standards) });
      });
      const pids = new Set();
      (Array.isArray(o.plans) ? o.plans : []).slice(0, LIM.plans).forEach(p => {
        if (!isObj(p) || typeof p.id !== 'string' || !/^p[a-z0-9]{2,24}$/.test(p.id) || pids.has(p.id) || !isoOk(p.date)) return;
        const title = txt(p.title, 120); if (!title) return; pids.add(p.id);
        s.plans.push({ id: p.id, unitId: uids.has(p.unitId) ? p.unitId : '', date: p.date, title, objective: txt(p.objective, 300), activities: txt(p.activities, 2000), materials: txt(p.materials, 600), homework: txt(p.homework, 300), standards: stds(p.standards) });
      });
      if (isObj(o.attendance)) Object.keys(o.attendance).filter(isoOk).sort().reverse().slice(0, LIM.days).sort().forEach(d => {
        const day = o.attendance[d]; if (!isObj(day)) return; const out = {};
        Object.keys(day).forEach(sid => { if (sids.has(sid) && MARKS[day[sid]]) out[sid] = day[sid]; });
        if (Object.keys(out).length) s.attendance[d] = out;
      });
      const so = isObj(o.seating) ? o.seating : {}, st = s.seating;
      st.rows = clampInt(so.rows, 1, 10, 5); st.cols = clampInt(so.cols, 1, 12, 6);
      const seated = new Set();
      if (isObj(so.seats)) Object.keys(so.seats).forEach(k => { const m = /^(\d{1,2})-(\d{1,2})$/.exec(k), sid = so.seats[k]; if (!m || +m[1] >= st.rows || +m[2] >= st.cols || !sids.has(sid) || seated.has(sid)) return; seated.add(sid); st.seats[k] = sid; });
      const pairs = new Set();
      (Array.isArray(so.apart) ? so.apart : []).slice(0, LIM.apart).forEach(p => { if (!Array.isArray(p) || p.length !== 2 || p[0] === p[1] || !sids.has(p[0]) || !sids.has(p[1])) return; const k = [p[0], p[1]].sort().join('|'); if (pairs.has(k)) return; pairs.add(k); st.apart.push([p[0], p[1]]); });
      const gids = new Set();
      (Array.isArray(o.groupSets) ? o.groupSets : []).slice(-LIM.sets).forEach(g => {
        if (!isObj(g) || typeof g.id !== 'string' || !/^g[a-z0-9]{2,24}$/.test(g.id) || gids.has(g.id)) return;
        const used = new Set(), groups = [];
        (Array.isArray(g.groups) ? g.groups : []).slice(0, 30).forEach(x => { if (!isObj(x)) return; const m = (Array.isArray(x.sids) ? x.sids : []).filter(sid => { if (!sids.has(sid) || used.has(sid)) return false; used.add(sid); return true; }); if (m.length) groups.push({ name: txt(x.name, 40) || 'Group ' + (groups.length + 1), sids: m }); });
        if (!groups.length) return; gids.add(g.id);
        s.groupSets.push({ id: g.id, name: txt(g.name, 60) || 'Groups', made: isoOk(g.made) ? g.made : '', method: ['random', 'similar', 'mixed', 'manual'].includes(g.method) ? g.method : 'manual', basis: txt(g.basis, 40), groups });
      });
      const nids = new Set();
      (Array.isArray(o.notes) ? o.notes : []).slice(-LIM.notes).forEach(n => {
        if (!isObj(n) || typeof n.id !== 'string' || !/^n[a-z0-9]{2,24}$/.test(n.id) || nids.has(n.id) || !sids.has(n.sid) || !isoOk(n.date)) return;
        const text = txt(n.text, 500); if (!text) return; nids.add(n.id);
        const sh = isObj(n.share) ? n.share : {};
        s.notes.push({ id: n.id, sid: n.sid, date: n.date, kind: KINDS[n.kind] ? n.kind : 'note', text, share: { parent: sh.parent === true, sub: sh.sub === true } });
      });
      const rids = new Set();
      (Array.isArray(o.rubrics) ? o.rubrics : []).slice(0, LIM.rubrics).forEach(r => {
        if (!isObj(r) || typeof r.id !== 'string' || !/^r[a-z0-9]{2,24}$/.test(r.id) || rids.has(r.id)) return;
        const title = txt(r.title, 120), criteria = cleanCriteria(r.criteria); if (!title || !criteria.length) return;
        rids.add(r.id); s.rubrics.push({ id: r.id, title, criteria });
      });
      if (isObj(o.conf)) Object.keys(o.conf).forEach(sid => { const c = o.conf[sid]; if (!sids.has(sid) || !isObj(c)) return; const v = { points: txt(c.points, 2000), goals: txt(c.goals, 1000), date: isoOk(c.date) ? c.date : '' }; if (v.points || v.goals || v.date) s.conf[sid] = v; });
      if (isObj(o.sub)) SUB_FIELDS.forEach(k => { s.sub[k] = txt(o.sub[k], 2000); });
      if (isObj(o.sbg) && METHODS[o.sbg.method]) s.sbg.method = o.sbg.method;
      return N.sanitize(o, s, lib);
    }
    /* the per-assignment 1.1 fields: criterion standard code and level descriptors, tier instructions, per-student support */
    function sanitizeAssignmentExtra(raw, a, sids) {
      const crit = Array.isArray(raw.rubric) ? raw.rubric : [];
      a.rubric.forEach(c => { const r = crit.find(x => isObj(x) && x.id === c.id) || {}; c.std = codeOk(r.std) ? r.std : ''; c.levels = levelsOk(r.levels); });
      const t = isObj(raw.tiers) ? raw.tiers : {};
      a.tiers = { support: txt(t.support, 600), core: txt(t.core, 600), extend: txt(t.extend, 600) };
      a.accom = {};
      if (isObj(raw.accom)) Object.keys(raw.accom).forEach(sid => { const x = raw.accom[sid]; if (!sids.has(sid) || !isObj(x)) return; const v = { tier: TIERS[x.tier] ? x.tier : 'core', extraDays: clampInt(x.extraDays, 0, 60, 0), note: txt(x.note, 200) }; if (v.tier !== 'core' || v.extraDays || v.note) a.accom[sid] = v; });
      return a;
    }
    function removeStudentExtra(state, sid) {
      Object.keys(state.attendance).forEach(d => { delete state.attendance[d][sid]; if (!Object.keys(state.attendance[d]).length) delete state.attendance[d]; });
      Object.keys(state.seating.seats).forEach(k => { if (state.seating.seats[k] === sid) delete state.seating.seats[k]; });
      state.seating.apart = state.seating.apart.filter(p => p.indexOf(sid) < 0);
      state.groupSets.forEach(g => { g.groups.forEach(x => { x.sids = x.sids.filter(y => y !== sid); }); g.groups = g.groups.filter(x => x.sids.length); });
      state.groupSets = state.groupSets.filter(g => g.groups.length);
      state.notes = state.notes.filter(n => n.sid !== sid);
      delete state.conf[sid];
      N.removeStudent(state, sid);
      state.assignments.forEach(a => { if (a.accom) delete a.accom[sid]; });
    }

    /* ---------- standards and standards-based grading ---------- */
    /* "CODE label" per line (or CODE, label / CODE | label). Codes are the teacher's own; no standard text ships with the Hub. */
    function parseStandards(text, existing) {
      const have = new Set((existing || []).map(x => x.code.toLowerCase())), add = [], rejected = [];
      String(text || '').split(/\r?\n/).forEach(line => {
        const l = line.trim(); if (!l) return;
        const m = /^([^\s,|;\t]+)\s*[,|;\t]?\s*(.*)$/.exec(l), code = m[1];
        if (!codeOk(code)) { rejected.push({ raw: l.slice(0, 40), why: 'A code is up to 24 letters, digits, dots, dashes or colons, with no spaces.' }); return; }
        if (have.has(code.toLowerCase())) { rejected.push({ raw: code, why: 'Already in the list.' }); return; }
        if (have.size >= LIM.standards) { rejected.push({ raw: code, why: 'The list is full.' }); return; }
        have.add(code.toLowerCase()); add.push({ code, label: txt(m[2], 200) });
      });
      return { add, rejected };
    }
    function profOf(v) { if (v === null || v === undefined) return { level: 0, label: 'No evidence' }; const p = PROF.find(x => v >= x[0]); return { level: p[1], label: p[2] }; }
    /* one evidence point per assignment that scores a criterion tagged with the code, on a 0-4 scale, oldest first */
    function evidencePoints(state, sid, code) {
      const out = [], lc = String(code).toLowerCase();
      state.assignments.map((a, i) => ({ a, i })).sort((x, y) => (x.a.due || '').localeCompare(y.a.due || '') || x.i - y.i).forEach(({ a }) => {
        const g = (state.grades[a.id] || {})[sid]; if (!g || !g.scores) return;
        const v = a.rubric.filter(c => (c.std || '').toLowerCase() === lc && typeof g.scores[c.id] === 'number').map(c => 4 * g.scores[c.id] / c.max);
        if (v.length) out.push({ aid: a.id, title: a.title, due: a.due, score: r2(v.reduce((p, q) => p + q, 0) / v.length) });
      });
      return out;
    }
    function combine(scores, method) {
      if (!scores.length) return null;
      if (method === 'mean') return r2(scores.reduce((p, q) => p + q, 0) / scores.length);
      if (method === 'recent') return scores[scores.length - 1];
      if (method === 'highest') return Math.max.apply(null, scores);
      let v = scores[0]; for (let i = 1; i < scores.length; i++) v = 0.35 * v + 0.65 * scores[i];
      return r2(v);
    }
    function mastery(state, sid, method) {
      const m = METHODS[method] ? method : state.sbg.method;
      return state.standards.map(st => { const pts = evidencePoints(state, sid, st.code), score = combine(pts.map(p => p.score), m), p = profOf(score); return { code: st.code, label: st.label, score, n: pts.length, points: pts, level: p.level, prof: p.label }; });
    }
    function standardsSummary(state, method) {
      return state.standards.map(st => { const counts = { 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 }; state.students.forEach(s => { counts[mastery(state, s.id, method).find(x => x.code === st.code).level]++; }); return { code: st.code, label: st.label, counts }; });
    }
    function standardsCSV(state, method) {
      const lines = [['Student'].concat(state.standards.map(s => s.code)).map(csvCell).join(',')];
      state.students.forEach(s => { lines.push([s.name].concat(mastery(state, s.id, method).map(x => (x.score === null ? '' : round1(x.score) + ' ' + x.prof))).map(csvCell).join(',')); });
      return lines.join('\r\n') + '\r\n';
    }

    /* ---------- rubric library ---------- */
    /* textarea form: "criterion | max points | standard code" (both optional); keeps ids and level text of unchanged criteria */
    function rubricFromText(text, old, levelsByText) {
      const out = [], prev = old || [], used = new Set(prev.map(r => +String(r.id).slice(1)));
      String(text || '').split('\n').forEach(line => {
        const m = /^(.*?)(?:\s*\|\s*(\d{1,3}))?(?:\s*\|\s*([A-Za-z0-9][A-Za-z0-9.\-_:]{0,23}))?\s*$/.exec(line.trim()); const t = txt(m[1], 300); if (!t || out.length >= 20) return;
        const max = Math.min(100, Math.max(1, m[2] ? +m[2] : 4)), same = prev.find(r => r.text === t && !out.some(o => o.id === r.id));
        let id; if (same) id = same.id; else { let n = 1; while (used.has(n) || out.some(o => o.id === 'c' + n)) n++; id = 'c' + n; used.add(n); }
        const lv = (same && same.levels && same.levels.length === 4 ? same.levels : null) || (levelsByText && levelsByText[t]) || [];
        out.push({ id, text: t, max, std: m[3] || '', levels: lv.slice() });
      });
      return out;
    }
    const rubricText = crit => (crit || []).map(c => c.text + (c.max !== 4 || c.std ? ' | ' + c.max : '') + (c.std ? ' | ' + c.std : '')).join('\n');
    function libraryRubrics(state) { return TEMPLATES.map(t => Object.assign({ builtIn: true }, t)).concat(state.rubrics.map(r => Object.assign({ builtIn: false }, r))); }
    function saveRubric(state, title, criteria) {
      const t = txt(title, 120), crit = cleanCriteria(criteria);
      if (!t) throw new Error('Give the rubric a name.');
      if (!crit.length) throw new Error('A rubric needs at least one criterion.');
      if (state.rubrics.length >= LIM.rubrics) throw new Error('The library is full (' + LIM.rubrics + ' rubrics).');
      const r = { id: uid('r', state.rubrics), title: t, criteria: crit }; state.rubrics.push(r); return r;
    }
    const levelsMap = crit => (crit || []).reduce((m, c) => { if (c.levels && c.levels.length === 4) m[c.text] = c.levels; return m; }, {});

    /* ---------- lesson planner and unit calendar ---------- */
    function addUnit(state, o) {
      const title = txt(o.title, 120); if (!title) throw new Error('Give the unit a title.');
      if ((o.start && !isoOk(o.start)) || (o.end && !isoOk(o.end))) throw new Error('Unit dates should look like 2027-03-01.');
      if (o.start && o.end && o.end < o.start) throw new Error('The unit ends before it starts.');
      if (state.units.length >= LIM.units) throw new Error('You can plan up to ' + LIM.units + ' units.');
      const codes = new Set(state.standards.map(s => s.code));
      const u = { id: uid('u', state.units), title, start: o.start || '', end: o.end || '', goal: txt(o.goal, 600), standards: (o.standards || []).filter(c => codes.has(c)) };
      state.units.push(u); return u;
    }
    function addPlan(state, o) {
      const title = txt(o.title, 120); if (!title) throw new Error('Give the lesson a title.');
      if (!isoOk(o.date)) throw new Error('Pick a date for the lesson.');
      if (state.plans.length >= LIM.plans) throw new Error('You can plan up to ' + LIM.plans + ' lessons. Delete old ones first.');
      const codes = new Set(state.standards.map(s => s.code));
      const p = { id: o.id && /^p[a-z0-9]{2,24}$/.test(o.id) ? o.id : uid('p', state.plans), unitId: state.units.some(u => u.id === o.unitId) ? o.unitId : '', date: o.date, title, objective: txt(o.objective, 300), activities: txt(o.activities, 2000), materials: txt(o.materials, 600), homework: txt(o.homework, 300), standards: (o.standards || []).filter(c => codes.has(c)) };
      const i = state.plans.findIndex(x => x.id === p.id); if (i >= 0) state.plans[i] = p; else state.plans.push(p);
      return p;
    }
    function copyPlan(state, pid, date) { const p = state.plans.find(x => x.id === pid); if (!p) throw new Error('That lesson is gone.'); return addPlan(state, Object.assign({}, p, { id: '', date })); }
    function removeUnit(state, id) { state.units = state.units.filter(u => u.id !== id); state.plans.forEach(p => { if (p.unitId === id) p.unitId = ''; }); }
    function shiftUnit(state, id, days) {
      const u = state.units.find(x => x.id === id), n = clampInt(days, -365, 365, 0); if (!u || !n) return 0;
      if (u.start) u.start = addDays(u.start, n); if (u.end) u.end = addDays(u.end, n);
      let moved = 0; state.plans.forEach(p => { if (p.unitId === id) { p.date = addDays(p.date, n); moved++; } });
      return moved;
    }
    const plansOn = (state, date) => state.plans.filter(p => p.date === date);
    function weekStart(iso) { const d = new Date(iso + 'T00:00:00Z'); return addDays(iso, -((d.getUTCDay() + 6) % 7)); }
    function weekPlans(state, iso) { const mon = weekStart(iso), out = []; for (let i = 0; i < 7; i++) { const d = addDays(mon, i), ps = plansOn(state, d); if (i < 5 || ps.length) out.push({ date: d, plans: ps }); } return out; }
    function unitStatus(state, u, today) { const ps = state.plans.filter(p => p.unitId === u.id); return { lessons: ps.length, taught: ps.filter(p => today && p.date < today).length, next: ps.filter(p => !today || p.date >= today).map(p => p.date).sort()[0] || '' }; }

    /* ---------- attendance ---------- */
    function setMark(state, date, sid, mark) { if (!isoOk(date) || !MARKS[mark] || !hasSid(state, sid)) return false; (state.attendance[date] = state.attendance[date] || {})[sid] = mark; return true; }
    /* records every student for the day; anyone not given a mark is Present */
    function takeRegister(state, date, marks) {
      if (!isoOk(date)) throw new Error('Pick a date.');
      if (!state.attendance[date] && Object.keys(state.attendance).length >= LIM.days) throw new Error('The register is full. Save a backup, then clear old days.');
      const day = state.attendance[date] = state.attendance[date] || {};
      state.students.forEach(s => { const m = marks && marks[s.id]; if (MARKS[m]) day[s.id] = m; else if (!day[s.id]) day[s.id] = 'P'; });
      return day;
    }
    function attendanceSummary(state, sid, from, to) {
      const c = { P: 0, L: 0, A: 0, E: 0 }; let days = 0;
      Object.keys(state.attendance).forEach(d => { if ((from && d < from) || (to && d > to)) return; const m = state.attendance[d][sid]; if (!m) return; c[m]++; days++; });
      const rate = days ? round1(100 * (c.P + c.L) / days) : null;
      return { days, P: c.P, L: c.L, A: c.A, E: c.E, rate, concern: days >= 10 && rate < 90 };
    }
    function dayCounts(state, date) { const c = { P: 0, L: 0, A: 0, E: 0, unmarked: 0 }, day = state.attendance[date] || {}; state.students.forEach(s => { if (day[s.id]) c[day[s.id]]++; else c.unmarked++; }); return c; }
    function attendanceCSV(state, from, to) {
      const dates = Object.keys(state.attendance).filter(d => (!from || d >= from) && (!to || d <= to)).sort();
      const lines = [['Student', 'Days', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %'].concat(dates).map(csvCell).join(',')];
      state.students.forEach(s => { const a = attendanceSummary(state, s.id, from, to); lines.push([s.name, a.days, a.P, a.L, a.A, a.E, a.rate === null ? '' : a.rate].concat(dates.map(d => state.attendance[d][s.id] || '')).map(csvCell).join(',')); });
      return lines.join('\r\n') + '\r\n';
    }

    /* ---------- seating chart ---------- */
    const near = (k1, k2) => { const a = k1.split('-').map(Number), b = k2.split('-').map(Number); return k1 !== k2 && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1; };
    function conflictsIn(seats, apart) { const where = {}; Object.keys(seats).forEach(k => { where[seats[k]] = k; }); return apart.filter(p => where[p[0]] && where[p[1]] && near(where[p[0]], where[p[1]])); }
    const seatConflicts = state => conflictsIn(state.seating.seats, state.seating.apart);
    function seatGrid(state) {
      const st = state.seating, out = [];
      for (let r = 0; r < st.rows; r++) { const row = []; for (let c = 0; c < st.cols; c++) { const key = r + '-' + c, sid = st.seats[key] || ''; row.push({ key, r, c, sid, name: sid ? nameOf(state, sid) : '' }); } out.push(row); }
      return out;
    }
    function resizeSeating(state, rows, cols) {
      const st = state.seating; st.rows = clampInt(rows, 1, 10, st.rows); st.cols = clampInt(cols, 1, 12, st.cols);
      Object.keys(st.seats).forEach(k => { const m = k.split('-').map(Number); if (m[0] >= st.rows || m[1] >= st.cols) delete st.seats[k]; });
    }
    function assignSeat(state, key, sid) {
      const st = state.seating, m = /^(\d{1,2})-(\d{1,2})$/.exec(key || ''); if (!m || +m[1] >= st.rows || +m[2] >= st.cols) return false;
      if (sid && !hasSid(state, sid)) return false;
      Object.keys(st.seats).forEach(k => { if (st.seats[k] === sid) delete st.seats[k]; });
      if (sid) st.seats[key] = sid; else delete st.seats[key];
      return true;
    }
    function unseated(state) { const on = new Set(Object.values(state.seating.seats)); return state.students.filter(s => !on.has(s.id)); }
    /* mode: random (up to 200 tries for the fewest keep-apart clashes), alpha, or groups (latest saved group set sits together) */
    function autoSeat(state, mode, seed) {
      const st = state.seating, keys = [];
      for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.cols; c++) keys.push(r + '-' + c);
      let order = state.students.map(s => s.id);
      if (mode === 'alpha') order = state.students.slice().sort((a, b) => a.name.localeCompare(b.name)).map(s => s.id);
      if (mode === 'groups' && state.groupSets.length) { const g = state.groupSets[state.groupSets.length - 1], inG = [].concat.apply([], g.groups.map(x => x.sids)); order = inG.concat(order.filter(s => inG.indexOf(s) < 0)); }
      const place = ord => { const seats = {}; ord.slice(0, keys.length).forEach((sid, i) => { seats[keys[i]] = sid; }); return seats; };
      const rand = rng(seed || 'seats'); let best = null, bestN = Infinity;
      for (let t = 0; t < (mode === 'random' ? 200 : 1) && bestN > 0; t++) { const ord = mode === 'random' ? shuffle(order, rand) : order, seats = place(ord), n = conflictsIn(seats, st.apart).length; if (n < bestN) { best = seats; bestN = n; } }
      st.seats = best || {};
      return { seated: Math.min(order.length, keys.length), unseated: order.slice(keys.length).map(sid => nameOf(state, sid)), conflicts: bestN === Infinity ? 0 : bestN };
    }
    function addApart(state, a, b) {
      if (!a || !b || a === b || !hasSid(state, a) || !hasSid(state, b)) return false;
      if (state.seating.apart.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a)) || state.seating.apart.length >= LIM.apart) return false;
      state.seating.apart.push([a, b]); return true;
    }

    /* ---------- groups ---------- */
    function scoreFor(state, sid, basis) {
      if (basis && basis.indexOf('std:') === 0) { const m = mastery(state, sid).find(x => x.code === basis.slice(4)); return m ? m.score : null; }
      return lib.finalGrade(state, sid).pct;
    }
    const clashes = (groups, apart) => apart.filter(p => groups.some(g => g.indexOf(p[0]) >= 0 && g.indexOf(p[1]) >= 0)).length;
    function fixApart(groups, apart) {
      for (let pass = 0; pass < 4 && clashes(groups, apart); pass++) {
        apart.forEach(p => {
          const gi = groups.findIndex(g => g.indexOf(p[0]) >= 0 && g.indexOf(p[1]) >= 0); if (gi < 0) return;
          const cur = clashes(groups, apart), bi = groups[gi].indexOf(p[1]);
          for (let hi = 0; hi < groups.length; hi++) {
            if (hi === gi) continue;
            for (let k = 0; k < groups[hi].length; k++) { const x = groups[hi][k]; groups[gi][bi] = x; groups[hi][k] = p[1]; if (clashes(groups, apart) < cur) return; groups[hi][k] = x; groups[gi][bi] = p[1]; }
          }
        });
      }
      return groups;
    }
    /* opts: { method: random|similar|mixed, size: 2-10, basis: 'overall' or 'std:CODE', seed, presentOn: date (only students marked present or late) } */
    function makeGroups(state, opts) {
      const o = opts || {}, size = clampInt(o.size, 2, 10, 4), method = ['random', 'similar', 'mixed'].includes(o.method) ? o.method : 'random';
      let ids = state.students.map(s => s.id);
      const day = o.presentOn && state.attendance[o.presentOn];
      if (day) ids = ids.filter(sid => day[sid] === 'P' || day[sid] === 'L');
      const n = Math.max(1, Math.ceil(ids.length / size)), groups = Array.from({ length: n }, () => []);
      if (method === 'random') shuffle(ids, rng(o.seed || 'groups')).forEach((sid, i) => groups[i % n].push(sid));
      else {
        const scored = ids.map((sid, i) => ({ sid, v: scoreFor(state, sid, o.basis), i })).sort((a, b) => (a.v === null) - (b.v === null) || (b.v || 0) - (a.v || 0) || a.i - b.i);
        if (method === 'similar') { let at = 0; for (let g = 0; g < n; g++) { const k = Math.floor(ids.length / n) + (g < ids.length % n ? 1 : 0); groups[g] = scored.slice(at, at + k).map(x => x.sid); at += k; } }
        else scored.forEach((x, i) => { const round = Math.floor(i / n), pos = i % n; groups[round % 2 ? n - 1 - pos : pos].push(x.sid); });
      }
      if (method !== 'similar') fixApart(groups, state.seating.apart);
      return { method, basis: method === 'random' ? '' : (o.basis || 'overall'), groups: groups.filter(g => g.length).map((g, i) => ({ name: 'Group ' + (i + 1), sids: g })), clashes: clashes(groups, state.seating.apart), left: state.students.length - ids.length };
    }
    function saveGroupSet(state, name, made, res) {
      const g = { id: uid('g', state.groupSets), name: txt(name, 60) || 'Groups', made: isoOk(made) ? made : '', method: res.method || 'manual', basis: txt(res.basis, 40), groups: res.groups.map(x => ({ name: txt(x.name, 40), sids: x.sids.slice() })) };
      state.groupSets.push(g); if (state.groupSets.length > LIM.sets) state.groupSets.shift(); return g;
    }

    /* ---------- private notes (never on parent reports, sub packets or planning packs unless the teacher shares one) ---------- */
    function addNote(state, o) {
      if (!hasSid(state, o.sid)) throw new Error('Pick a student.');
      if (!isoOk(o.date)) throw new Error('Pick a date.');
      const text = txt(o.text, 500); if (!text) throw new Error('Write the note first.');
      const sh = o.share || {};
      const n = { id: uid('n', state.notes), sid: o.sid, date: o.date, kind: KINDS[o.kind] ? o.kind : 'note', text, share: { parent: sh.parent === true, sub: sh.sub === true } };
      state.notes.push(n); if (state.notes.length > LIM.notes) state.notes.shift(); return n;
    }
    /* audience: undefined (the teacher sees everything), 'parent' or 'sub' (only notes the teacher marked for them) */
    function notesFor(state, sid, audience) { return state.notes.filter(n => (!sid || n.sid === sid) && (!audience || n.share[audience] === true)).sort((a, b) => b.date.localeCompare(a.date)); }
    function noteCounts(state, sid) { const c = { positive: 0, concern: 0, note: 0 }; state.notes.forEach(n => { if (n.sid === sid) c[n.kind]++; }); return c; }

    /* ---------- differentiation ---------- */
    function setAccom(state, aid, sid, o) {
      const a = state.assignments.find(x => x.id === aid); if (!a || !hasSid(state, sid)) return false;
      a.accom = a.accom || {};
      const v = { tier: TIERS[o.tier] ? o.tier : 'core', extraDays: clampInt(o.extraDays, 0, 60, 0), note: txt(o.note, 200) };
      if (v.tier === 'core' && !v.extraDays && !v.note) delete a.accom[sid]; else a.accom[sid] = v;
      return true;
    }
    const accomOf = (a, sid) => (a.accom && a.accom[sid]) || { tier: 'core', extraDays: 0, note: '' };
    const studentDue = (a, sid) => { const x = accomOf(a, sid); return a.due && x.extraDays ? addDays(a.due, x.extraDays) : a.due; };
    /* Beginning or Approaching -> Support, Meeting -> Core, Exceeding -> Extend; ungraded students keep their tier */
    function tiersFromGrades(state, aid) {
      const a = state.assignments.find(x => x.id === aid), c = { support: 0, core: 0, extend: 0, kept: 0 }; if (!a) return c;
      state.students.forEach(s => {
        const f = lib.finalGrade(state, s.id), x = accomOf(a, s.id);
        if (f.pct === null) { c.kept++; return; }
        const tier = f.band === 'Exceeding' ? 'extend' : f.band === 'Meeting' ? 'core' : 'support';
        setAccom(state, aid, s.id, { tier, extraDays: x.extraDays, note: x.note }); c[tier]++;
      });
      return c;
    }
    /* what one student sees on a task card: the tier's instructions and their own due date (the support note stays with the teacher) */
    function studentTask(state, aid, sid) {
      const a = state.assignments.find(x => x.id === aid); if (!a || !hasSid(state, sid)) return null;
      const x = accomOf(a, sid);
      return { name: nameOf(state, sid), title: a.title, tier: x.tier, tierName: TIERS[x.tier], instructions: (a.tiers || {})[x.tier] || '', prompt: a.quill ? a.quill.prompt : '', due: studentDue(a, sid), extended: !!(a.due && x.extraDays), criteria: a.rubric.map(c => c.text) };
    }
    /* work whose (personal) due date has passed with nothing handed in and no grade */
    function missingWork(state, sid, today) {
      return state.assignments.filter(a => {
        const due = studentDue(a, sid); if (!due || !today || due >= today) return false;
        if (lib.rubricResult(a, (state.grades[a.id] || {})[sid]).pct !== null) return false;
        const ev = lib.assignmentEvidence(state, sid, a); return !ev.total || ev.parts.some(p => p.status === 'missing');
      }).map(a => a.title);
    }

    /* ---------- parent conference report ---------- */
    function conferenceReport(state, sid, opts) {
      const o = opts || {}, r = lib.studentReport(state, sid); if (!r) return null;
      const c = state.conf[sid] || { points: '', goals: '', date: '' };
      return { name: r.name, classroom: r.classroom, teacher: r.teacher, term: r.term, final: r.final, date: c.date,
        rows: r.rows.map(x => ({ title: x.title, pct: x.pct, band: x.band, comment: x.comment })),
        strengths: r.strengths.map(x => x.text), next: r.next.map(x => x.text), attendance: attendanceSummary(state, sid),
        standards: mastery(state, sid).filter(m => m.n).map(m => ({ code: m.code, label: m.label, score: m.score, prof: m.prof })),
        missing: missingWork(state, sid, o.today || ''), points: c.points, goals: c.goals,
        notes: o.includeNotes ? notesFor(state, sid, 'parent').map(n => ({ date: n.date, kind: KINDS[n.kind], text: n.text })) : [] };
    }
    function conferenceText(c) {
      const L = ['Parent conference: ' + c.name + (c.classroom ? ' (' + c.classroom + (c.term ? ', ' + c.term : '') + ')' : '') + (c.date ? ', ' + c.date : ''), ''];
      L.push(c.final.pct === null ? 'Overall: no marked work yet.' : 'Overall: ' + Math.round(c.final.pct) + '% (' + c.final.band + ').');
      if (c.attendance.days) L.push('Attendance: ' + c.attendance.rate + '% of ' + c.attendance.days + ' days recorded (' + c.attendance.A + ' absent, ' + c.attendance.L + ' late, ' + c.attendance.E + ' excused).');
      if (c.standards.length) { L.push('', 'Skills (1 to 4 scale):'); c.standards.forEach(m => L.push('- ' + m.code + (m.label ? ' ' + m.label : '') + ': ' + m.prof + ' (' + round1(m.score) + ')')); }
      const marked = c.rows.filter(x => x.pct !== null);
      if (marked.length) { L.push('', 'Marked work:'); marked.forEach(x => L.push('- ' + x.title + ': ' + Math.round(x.pct) + '% (' + x.band + ')')); }
      if (c.missing.length) L.push('', 'Still to hand in: ' + c.missing.join('; ') + '.');
      if (c.strengths.length) L.push('', 'Going well: ' + c.strengths.join('; ') + '.');
      if (c.next.length) L.push('', 'Next steps: ' + c.next.join('; ') + '.');
      if (c.notes.length) { L.push('', 'Notes shared with the family:'); c.notes.forEach(n => L.push('- ' + n.date + ' (' + n.kind + '): ' + n.text)); }
      if (c.points) L.push('', 'Talking points:', c.points);
      if (c.goals) L.push('', 'Goals we agreed:', c.goals);
      L.push('', 'Prepared with Stark Classroom Hub. It stays on the teacher\'s computer unless it is shared with you.');
      if (c.teacher) L.push(c.teacher);
      return L.join('\n');
    }

    /* ---------- substitute teacher packet ---------- */
    function subPacket(state, date, opts) {
      const o = opts || {}, items = lib.calendarItems(state)[date] || [];
      const set = state.groupSets[state.groupSets.length - 1];
      const supports = [];
      if (o.includeSupports) state.assignments.filter(a => !a.due || a.due >= date).forEach(a => Object.keys(a.accom || {}).forEach(sid => { const x = a.accom[sid]; supports.push({ name: nameOf(state, sid), work: a.title, tier: TIERS[x.tier], extraDays: x.extraDays, note: x.note }); }));
      return { date, classroom: state.classroom.name, teacher: state.classroom.teacher, term: state.classroom.termName, info: Object.assign({}, state.sub),
        plans: plansOn(state, date).map(p => ({ title: p.title, unit: (state.units.find(u => u.id === p.unitId) || {}).title || '', objective: p.objective, activities: p.activities, materials: p.materials, homework: p.homework })),
        events: items.filter(i => i.kind !== 'lesson').map(i => i.title), roster: state.students.map(s => s.name),
        seating: seatGrid(state).map(row => row.map(x => x.name)), seated: Object.keys(state.seating.seats).length,
        groups: set ? { name: set.name, groups: set.groups.map(g => ({ name: g.name, members: g.sids.map(sid => nameOf(state, sid)) })) } : null,
        supports, notes: o.includeNotes ? notesFor(state, '', 'sub').map(n => ({ name: nameOf(state, n.sid), text: n.text })) : [] };
    }
    function subPacketText(p) {
      const L = ['Substitute teacher packet: ' + (p.classroom || 'class') + ', ' + p.date, ''];
      if (p.teacher) L.push('Class teacher: ' + p.teacher);
      const sec = (title, body) => { if (body) L.push('', title + ':', body); };
      sec('Daily routines', p.info.routines); sec('Emergency procedures', p.info.emergency); sec('Helpful students and staff', p.info.helpers); sec('Where things are', p.info.materials);
      if (p.events.length) L.push('', 'Today: ' + p.events.join('; ') + '.');
      L.push('', p.plans.length ? 'Lesson plans:' : 'No lesson plan is saved for this day.');
      p.plans.forEach((x, i) => { L.push((i + 1) + '. ' + x.title + (x.unit ? ' (' + x.unit + ')' : '')); [['Objective', x.objective], ['Activities', x.activities], ['Materials', x.materials], ['Homework', x.homework]].forEach(f => { if (f[1]) L.push('   ' + f[0] + ': ' + f[1]); }); });
      if (p.groups) { L.push('', 'Groups (' + p.groups.name + '):'); p.groups.groups.forEach(g => L.push('- ' + g.name + ': ' + g.members.join(', '))); }
      if (p.seated) { L.push('', 'Seating chart (front of the room at the top):'); p.seating.forEach(row => L.push(row.map(n => n || '-').join(' | '))); }
      if (p.supports.length) { L.push('', 'Supports:'); p.supports.forEach(s => L.push('- ' + s.name + ', ' + s.work + ': ' + s.tier + (s.extraDays ? ', ' + s.extraDays + ' extra days' : '') + (s.note ? '. ' + s.note : ''))); }
      if (p.notes.length) { L.push('', 'Notes from the teacher:'); p.notes.forEach(n => L.push('- ' + n.name + ': ' + n.text)); }
      sec('Other notes', p.info.notes);
      L.push('', 'Register (' + p.roster.length + ' students): mark P present, L late, A absent.'); p.roster.forEach(n => L.push('[ ] ' + n));
      return L.join('\n');
    }

    /* ---------- planning packs: share units, lessons, rubrics, standards and assignments with a colleague as one file (no student data) ---------- */
    const PACK_KEYS = ['standards', 'units', 'plans', 'rubrics', 'assignments'];
    function buildSharePack(state, savedIso) {
      const data = { standards: state.standards.map(x => Object.assign({}, x)), units: state.units.map(x => Object.assign({}, x)), plans: state.plans.map(x => Object.assign({}, x)), rubrics: state.rubrics.map(x => Object.assign({}, x)),
        assignments: state.assignments.map(a => ({ id: a.id, title: a.title, due: a.due, notes: '', weight: a.weight, rubric: a.rubric, quill: a.quill, intra: a.intra, world: a.world, tiers: a.tiers || {} })) };
      const clean = packClean(data);
      return { app: SHARE_APP, version: 1, saved: savedIso || '', data: clean, sha256: sha256(canon(clean)) };
    }
    function packClean(d) {
      const s = lib.sanitizeState({ standards: d.standards, units: d.units, plans: d.plans, rubrics: d.rubrics, assignments: d.assignments });
      return { standards: s.standards, units: s.units, plans: s.plans, rubrics: s.rubrics, assignments: s.assignments.map(a => ({ id: a.id, title: a.title, due: a.due, weight: a.weight, rubric: a.rubric, quill: a.quill, intra: a.intra, world: a.world, tiers: a.tiers })) };
    }
    /* first names from the roster that appear in the pack's text, so the teacher can check before sharing */
    function packMentions(state, pack) {
      const t = JSON.stringify(pack.data).toLowerCase();
      return state.students.map(s => s.name).filter(n => new RegExp('(^|[^\\p{L}])' + n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}])', 'u').test(t));
    }
    function readSharePack(o) {
      if (!isObj(o) || o.app !== SHARE_APP || o.version !== 1 || !isObj(o.data)) return { ok: false, error: 'This file is not a Stark Classroom Hub planning pack.' };
      if (Object.keys(o).some(k => ['app', 'version', 'saved', 'data', 'sha256'].indexOf(k) < 0) || Object.keys(o.data).some(k => PACK_KEYS.indexOf(k) < 0)) return { ok: false, error: 'This planning pack has unexpected content, so it was not opened.' };
      if (unsafeKeys(o, 0)) return { ok: false, error: 'This planning pack has unsafe or oversized content, so it was not opened.' };
      if (typeof o.sha256 !== 'string' || sha256(canon(o.data)) !== o.sha256) return { ok: false, error: 'This planning pack fails its integrity check (it was changed or damaged), so it was not opened.' };
      for (const k of PACK_KEYS) { if (o.data[k] !== undefined && !Array.isArray(o.data[k])) return { ok: false, error: 'This planning pack is damaged.' }; }
      const d = packClean(o.data);
      return { ok: true, error: '', data: d, counts: PACK_KEYS.reduce((m, k) => (m[k] = d[k].length, m), {}) };
    }
    /* adds what is new (by code or title), with fresh ids; dates move by shiftDays; never touches students, grades, notes or attendance */
    function mergeSharePack(state, d, shiftDays) {
      const n = clampInt(shiftDays, -730, 730, 0), mv = iso => (iso && n ? addDays(iso, n) : iso), added = { standards: 0, units: 0, plans: 0, rubrics: 0, assignments: 0 }, skipped = { standards: 0, units: 0, plans: 0, rubrics: 0, assignments: 0 };
      const codes = new Set(state.standards.map(x => x.code.toLowerCase()));
      d.standards.forEach(x => { if (codes.has(x.code.toLowerCase()) || state.standards.length >= LIM.standards) { skipped.standards++; return; } codes.add(x.code.toLowerCase()); state.standards.push({ code: x.code, label: x.label }); added.standards++; });
      const umap = {};
      d.units.forEach(u => {
        const same = state.units.find(x => x.title.toLowerCase() === u.title.toLowerCase() && x.start === mv(u.start));
        if (same) { umap[u.id] = same.id; skipped.units++; return; }
        if (state.units.length >= LIM.units) { skipped.units++; return; }
        const nu = { id: uid('u', state.units), title: u.title, start: mv(u.start), end: mv(u.end), goal: u.goal, standards: u.standards.slice() }; state.units.push(nu); umap[u.id] = nu.id; added.units++;
      });
      d.plans.forEach(p => {
        const date = mv(p.date);
        if (state.plans.some(x => x.date === date && x.title.toLowerCase() === p.title.toLowerCase()) || state.plans.length >= LIM.plans) { skipped.plans++; return; }
        state.plans.push(Object.assign({}, p, { id: uid('p', state.plans), date, unitId: umap[p.unitId] || '', standards: p.standards.slice() })); added.plans++;
      });
      d.rubrics.forEach(r => { if (state.rubrics.some(x => x.title.toLowerCase() === r.title.toLowerCase()) || state.rubrics.length >= LIM.rubrics) { skipped.rubrics++; return; } state.rubrics.push({ id: uid('r', state.rubrics), title: r.title, criteria: r.criteria.map(c => Object.assign({}, c, { levels: c.levels.slice() })) }); added.rubrics++; });
      d.assignments.forEach(a => {
        if (state.assignments.some(x => x.title.toLowerCase() === a.title.toLowerCase())) { skipped.assignments++; return; }
        try { const na = lib.pushAssignment(state, { title: a.title, due: mv(a.due), notes: '', weight: a.weight, rubric: a.rubric, quill: a.quill, intra: a.intra, world: a.world, tiers: a.tiers, accom: {} }); if (na) added.assignments++; } catch (e) { skipped.assignments++; }
      });
      return { added, skipped };
    }

    return { VERSION, MARKS, KINDS, TIERS, METHODS, TEMPLATES, rng, shuffle, emptyExtra, sanitizeExtra, sanitizeAssignmentExtra, removeStudentExtra,
      parseStandards, profOf, evidencePoints, combine, mastery, standardsSummary, standardsCSV, rubricFromText, rubricText, libraryRubrics, saveRubric, levelsMap,
      addUnit, addPlan, copyPlan, removeUnit, shiftUnit, plansOn, weekStart, weekPlans, unitStatus,
      setMark, takeRegister, attendanceSummary, dayCounts, attendanceCSV,
      seatGrid, resizeSeating, assignSeat, unseated, autoSeat, addApart, seatConflicts, makeGroups, saveGroupSet,
      addNote, notesFor, noteCounts, setAccom, accomOf, studentDue, tiersFromGrades, studentTask, missingWork,
      conferenceReport, conferenceText, subPacket, subPacketText, buildSharePack, readSharePack, mergeSharePack, packMentions };
  }

  SCH.teach = { install, VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = SCH.teach;
})(typeof window !== 'undefined' ? window : globalThis);
