/* Stark Homeroom 1.0: the teaching tools inherited from Stark Classroom Hub and adapted for families. Lesson planner
   and unit calendar, the family register, private notes, rubric library and standards-based grading. Pure functions
   (no DOM, no storage, no network); hublib.js installs them into SHR.lib, and tests/test_homeroom.py runs them in node. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const VERSION = '1.3.0';
  const LIM = { standards: 300, units: 60, plans: 600, days: 400, notes: 3000, rubrics: 100 };
  /* a family register: a school day counts 1, a half day 0.5, a field trip 1; absent counts 0 */
  const MARKS = { P: 'School day', H: 'Half day', T: 'Field trip', A: 'Absent' };
  const KINDS = { positive: 'Milestone', concern: 'Concern', note: 'Note' };
  const METHODS = { decaying: 'Decaying average (newest counts most)', mean: 'Mean of all evidence', recent: 'Most recent evidence', highest: 'Highest evidence' };
  const PROF = [[3.5, 4, 'Exceeds'], [2.5, 3, 'Meets'], [1.5, 2, 'Approaching'], [-1, 1, 'Beginning']];
  const CODE_OK = /^[A-Za-z0-9][A-Za-z0-9.\-_:]{0,23}$/;
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const r2 = v => Math.round(v * 100) / 100, round1 = v => Math.round(v * 10) / 10;
  const clampInt = (v, a, b, d) => { const n = parseInt(v, 10); return isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  /* n random base-36 characters from the browser's cryptographic generator (rejection sampled, so unbiased); record ids only, not secrets */
  function rnd36(n) {
    const c = root.crypto && root.crypto.getRandomValues ? root.crypto : null; let s = '';
    while (c && s.length < n) { const b = c.getRandomValues(new Uint8Array(n * 2)); for (let i = 0; i < b.length && s.length < n; i++) if (b[i] < 252) s += (b[i] % 36).toString(36); }
    while (s.length < n) s += Math.floor(Math.random() * 36).toString(36);
    return s;
  }
  const uid = (p, list) => { const used = new Set((list || []).map(x => x.id)); let id; do { id = p + rnd36(6); } while (used.has(id)); return id; };

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

  function install(lib) {
    const { clip, isoOk, addDays, csvCell } = lib;
    const txt = (v, n) => clip(v, n);
    const hasSid = (state, sid) => state.students.some(s => s.id === sid);
    const codeOk = c => typeof c === 'string' && CODE_OK.test(c);
    const levelsOk = l => (Array.isArray(l) && l.length === 4 ? l.map(x => txt(x, 300)) : []);
    const whoOk = (sids, w) => (Array.isArray(w) ? w : []).filter((x, i, a) => sids.has(x) && a.indexOf(x) === i);

    /* ---------- state: defaults and the sanitiser for every teaching field ---------- */
    function emptyExtra() { return { standards: [], units: [], plans: [], attendance: {}, notes: [], rubrics: [], sbg: { method: 'decaying' } }; }
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
        s.plans.push({ id: p.id, unitId: uids.has(p.unitId) ? p.unitId : '', date: p.date, title, who: whoOk(sids, p.who), objective: txt(p.objective, 300), activities: txt(p.activities, 2000), materials: txt(p.materials, 600), homework: txt(p.homework, 300), standards: stds(p.standards) });
      });
      if (isObj(o.attendance)) Object.keys(o.attendance).filter(isoOk).sort().reverse().slice(0, LIM.days).sort().forEach(d => {
        const day = o.attendance[d]; if (!isObj(day)) return; const out = {};
        Object.keys(day).forEach(sid => { if (sids.has(sid) && MARKS[day[sid]]) out[sid] = day[sid]; });
        if (Object.keys(out).length) s.attendance[d] = out;
      });
      const nids = new Set();
      (Array.isArray(o.notes) ? o.notes : []).slice(-LIM.notes).forEach(n => {
        if (!isObj(n) || typeof n.id !== 'string' || !/^n[a-z0-9]{2,24}$/.test(n.id) || nids.has(n.id) || !sids.has(n.sid) || !isoOk(n.date)) return;
        const text = txt(n.text, 500); if (!text) return; nids.add(n.id);
        s.notes.push({ id: n.id, sid: n.sid, date: n.date, kind: KINDS[n.kind] ? n.kind : 'note', text });
      });
      const rids = new Set();
      (Array.isArray(o.rubrics) ? o.rubrics : []).slice(0, LIM.rubrics).forEach(r => {
        if (!isObj(r) || typeof r.id !== 'string' || !/^r[a-z0-9]{2,24}$/.test(r.id) || rids.has(r.id)) return;
        const title = txt(r.title, 120), criteria = cleanCriteria(r.criteria); if (!title || !criteria.length) return;
        rids.add(r.id); s.rubrics.push({ id: r.id, title, criteria });
      });
      if (isObj(o.sbg) && METHODS[o.sbg.method]) s.sbg.method = o.sbg.method;
      return s;
    }
    /* per-criterion standard code and level descriptors */
    function sanitizeAssignmentExtra(raw, a) {
      const crit = Array.isArray(raw.rubric) ? raw.rubric : [];
      a.rubric.forEach(c => { const r = crit.find(x => isObj(x) && x.id === c.id) || {}; c.std = codeOk(r.std) ? r.std : ''; c.levels = levelsOk(r.levels); });
      return a;
    }
    function removeStudentExtra(state, sid) {
      Object.keys(state.attendance).forEach(d => { delete state.attendance[d][sid]; if (!Object.keys(state.attendance[d]).length) delete state.attendance[d]; });
      state.notes = state.notes.filter(n => n.sid !== sid);
      state.plans.forEach(p => { p.who = p.who.filter(x => x !== sid); });
    }

    /* ---------- standards and standards-based grading ---------- */
    /* "CODE label" per line (or CODE, label / CODE | label). Codes are the parent's own; no standard text ships with Homeroom. */
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
        const g = (state.grades[a.id] || {})[sid]; if (!g || !g.scores || !lib.appliesTo(a, sid)) return;
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
      const lines = [['Learner'].concat(state.standards.map(s => s.code)).map(csvCell).join(',')];
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
    /* who: the learners this lesson is for ([] = the whole family) */
    function addPlan(state, o) {
      const title = txt(o.title, 120); if (!title) throw new Error('Give the lesson a title.');
      if (!isoOk(o.date)) throw new Error('Pick a date for the lesson.');
      const isNew = !(o.id && state.plans.some(x => x.id === o.id));
      if (isNew && state.plans.length >= LIM.plans) throw new Error('You can plan up to ' + LIM.plans + ' lessons. Delete old ones first.');
      const codes = new Set(state.standards.map(s => s.code));
      const p = { id: isNew ? uid('p', state.plans) : o.id, unitId: state.units.some(u => u.id === o.unitId) ? o.unitId : '', date: o.date, title, who: whoOk(new Set(state.students.map(s => s.id)), o.who), objective: txt(o.objective, 300), activities: txt(o.activities, 2000), materials: txt(o.materials, 600), homework: txt(o.homework, 300), standards: (o.standards || []).filter(c => codes.has(c)) };
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

    /* ---------- the family register ---------- */
    function setMark(state, date, sid, mark) { if (!isoOk(date) || !MARKS[mark] || !hasSid(state, sid)) return false; (state.attendance[date] = state.attendance[date] || {})[sid] = mark; return true; }
    /* records every learner for the day; anyone not given a mark has a school day */
    function takeRegister(state, date, marks) {
      if (!isoOk(date)) throw new Error('Pick a date.');
      if (!state.attendance[date] && Object.keys(state.attendance).length >= LIM.days) throw new Error('The register is full. Save a backup, then clear old days.');
      const day = state.attendance[date] = state.attendance[date] || {};
      state.students.forEach(s => { const m = marks && marks[s.id]; if (MARKS[m]) day[s.id] = m; else if (!day[s.id]) day[s.id] = 'P'; });
      return day;
    }
    function attendanceSummary(state, sid, from, to) {
      const c = { P: 0, H: 0, T: 0, A: 0 }; let days = 0;
      Object.keys(state.attendance).forEach(d => { if ((from && d < from) || (to && d > to)) return; const m = state.attendance[d][sid]; if (!m) return; c[m]++; days++; });
      return { days, P: c.P, H: c.H, T: c.T, A: c.A, school: c.P + c.T + c.H / 2 };
    }
    function dayCounts(state, date) { const c = { P: 0, H: 0, T: 0, A: 0, unmarked: 0 }, day = state.attendance[date] || {}; state.students.forEach(s => { if (day[s.id]) c[day[s.id]]++; else c.unmarked++; }); return c; }
    function attendanceCSV(state, from, to) {
      const dates = Object.keys(state.attendance).filter(d => (!from || d >= from) && (!to || d <= to)).sort();
      const lines = [['Learner', 'School days (half days count 0.5)', 'Full days', 'Half days', 'Field trips', 'Absent'].concat(dates).map(csvCell).join(',')];
      state.students.forEach(s => { const a = attendanceSummary(state, s.id, from, to); lines.push([s.name, a.school, a.P, a.H, a.T, a.A].concat(dates.map(d => state.attendance[d][s.id] || '')).map(csvCell).join(',')); });
      return lines.join('\r\n') + '\r\n';
    }

    /* ---------- private notes (never on reports, transcripts, portfolios or exports) ---------- */
    function addNote(state, o) {
      if (!hasSid(state, o.sid)) throw new Error('Pick a learner.');
      if (!isoOk(o.date)) throw new Error('Pick a date.');
      const text = txt(o.text, 500); if (!text) throw new Error('Write the note first.');
      const n = { id: uid('n', state.notes), sid: o.sid, date: o.date, kind: KINDS[o.kind] ? o.kind : 'note', text };
      state.notes.push(n); if (state.notes.length > LIM.notes) state.notes.shift(); return n;
    }
    function notesFor(state, sid) { return state.notes.filter(n => !sid || n.sid === sid).sort((a, b) => b.date.localeCompare(a.date)); }
    function noteCounts(state, sid) { const c = { positive: 0, concern: 0, note: 0 }; state.notes.forEach(n => { if (n.sid === sid) c[n.kind]++; }); return c; }

    /* work for this learner whose due date has passed with nothing handed in and no grade */
    function missingWork(state, sid, today) {
      return state.assignments.filter(a => {
        if (!lib.appliesTo(a, sid) || !a.due || !today || a.due >= today) return false;
        if (lib.rubricResult(a, (state.grades[a.id] || {})[sid]).pct !== null) return false;
        const ev = lib.assignmentEvidence(state, sid, a); return !ev.total || ev.parts.some(p => p.status === 'missing');
      }).map(a => a.title);
    }

    return { VERSION, MARKS, KINDS, METHODS, TEMPLATES, emptyExtra, sanitizeExtra, sanitizeAssignmentExtra, removeStudentExtra,
      parseStandards, profOf, evidencePoints, combine, mastery, standardsSummary, standardsCSV, rubricFromText, rubricText, libraryRubrics, saveRubric, levelsMap,
      addUnit, addPlan, copyPlan, removeUnit, shiftUnit, plansOn, weekStart, weekPlans, unitStatus,
      setMark, takeRegister, attendanceSummary, dayCounts, attendanceCSV, addNote, notesFor, noteCounts, missingWork };
  }

  SHR.teach = { install, VERSION, rnd36 };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHR.teach;
})(typeof window !== 'undefined' ? window : globalThis);
