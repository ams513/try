/* Stark Homeroom 1.0: the family records. Learners with grade levels, hours by subject, courses with credits,
   transcripts with an optional GPA, the portfolio (records here, files in the browser's own storage) and progress
   reports. Pure functions (no DOM, no storage, no network); hublib.js installs them into SHR.lib, and
   tests/test_homeroom.py runs them in node. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const GRADES = [['PK', 'Pre-K'], ['K', 'Kindergarten']].concat(Array.from({ length: 12 }, (_, i) => [String(i + 1), 'Grade ' + (i + 1)]));
  const SUBJECTS = ['Reading', 'Writing and language arts', 'Mathematics', 'Science', 'Social studies and history', 'Foreign language', 'Art', 'Music', 'Physical education', 'Health', 'Life skills', 'Electives'];
  const LEVELS = { standard: 'Standard', honors: 'Honors', ap: 'AP', dual: 'Dual enrollment' };
  const STATUS = { planned: 'Planned', progress: 'In progress', done: 'Completed' };
  const GPA_MODES = { none: 'No GPA', unweighted: 'Unweighted (4.0 scale)', weighted: 'Weighted (Honors +0.5, AP and dual enrollment +1.0)' };
  const POINTS = { 'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0 };
  const SCALE = [[97, 'A+'], [93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'], [77, 'C+'], [73, 'C'], [70, 'C-'], [67, 'D+'], [63, 'D'], [60, 'D-'], [0, 'F']];
  const BONUS = { standard: 0, honors: 0.5, ap: 1, dual: 1 };
  const LIM = { hours: 15000, courses: 300, portfolio: 600, subjects: 40, fileBytes: 25 * 1024 * 1024 };
  const PORT_APP = 'stark-homeroom-portfolio';
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const r2 = v => Math.round(v * 100) / 100;
  const uid = (p, list) => { const used = new Set((list || []).map(x => x.id)); let id; do { id = p + SHR.teach.rnd36(6); } while (used.has(id)); return id; };
  const LEGAL_OK = /^[\p{L}\p{M}][\p{L}\p{M} '’.,()\-]*$/u;

  function install(lib) {
    const { clip, isoOk } = lib;
    const hasSid = (state, sid) => state.students.some(s => s.id === sid);
    const nameOf = (state, sid) => (state.students.find(s => s.id === sid) || {}).name || '';
    const gradeOk = g => GRADES.some(x => x[0] === g);
    const gradeLabel = g => (GRADES.find(x => x[0] === g) || [0, ''])[1];
    const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);

    /* ---------- state ---------- */
    function emptyHome() { return { subjects: SUBJECTS.slice(), hours: [], courses: [], portfolio: [], profiles: {}, goals: { days: 0, hours: 0 }, tx: { gpa: 'weighted', desc: true, hours: false }, demo: false }; }
    /* who an assignment is for: [] means every learner; a course pins it to that course's learner */
    function cleanFor(s, rawFor, rawCourse) {
      const c = typeof rawCourse === 'string' ? s.courses.find(x => x.id === rawCourse) : null;
      if (c) return { for: [c.sid], courseId: c.id };
      const sids = new Set(s.students.map(x => x.id));
      return { for: (Array.isArray(rawFor) ? rawFor : []).filter((x, i, a) => sids.has(x) && a.indexOf(x) === i), courseId: '' };
    }
    function cleanGradeText(v) {
      const t = String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, '');
      if (!t) return '';
      if (POINTS[t] !== undefined || t === 'P') return t;
      const m = /^(\d{1,3}(?:\.\d)?)%?$/.exec(t);
      if (m && +m[1] <= 100) return m[1];
      return null;
    }
    function sanitizeHome(o, s) {
      Object.assign(s, emptyHome());
      const sids = new Set(s.students.map(x => x.id));
      const rawStudents = Array.isArray(o.students) ? o.students : [];
      const byId = list => { const m = new Map(); list.forEach(x => { if (isObj(x) && typeof x.id === 'string' && !m.has(x.id)) m.set(x.id, x); }); return m; };
      const rawSt = byId(rawStudents);
      s.students.forEach(st => { const r = rawSt.get(st.id) || {}; st.grade = gradeOk(r.grade) ? r.grade : ''; });
      if (Array.isArray(o.subjects)) {
        const seen = new Set(); s.subjects = [];
        o.subjects.slice(0, LIM.subjects).forEach(x => { const t = clip(x, 40); if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); s.subjects.push(t); } });
      }
      const kids = new Set();
      (Array.isArray(o.courses) ? o.courses : []).slice(0, LIM.courses).forEach(c => {
        if (!isObj(c) || typeof c.id !== 'string' || !/^k[a-z0-9]{2,24}$/.test(c.id) || kids.has(c.id) || !sids.has(c.sid)) return;
        const title = clip(c.title, 100); if (!title) return; kids.add(c.id);
        const g = cleanGradeText(c.grade);
        s.courses.push({ id: c.id, sid: c.sid, title, subject: clip(c.subject, 40), year: clip(c.year, 20), gradeLevel: gradeOk(c.gradeLevel) ? c.gradeLevel : '', level: LEVELS[c.level] ? c.level : 'standard',
          credits: Math.min(10, Math.max(0, Math.round((parseFloat(c.credits) || 0) * 4) / 4)), status: STATUS[c.status] ? c.status : 'progress', grade: g || '', description: clip(c.description, 1500) });
      });
      const raws = byId(Array.isArray(o.assignments) ? o.assignments : []);
      s.assignments.forEach(a => { const r = raws.get(a.id) || {}; Object.assign(a, cleanFor(s, r.for, r.courseId)); });
      const courseSid = new Map(s.courses.map(c => [c.id, c.sid]));
      const courseOf = (sid, cid) => (typeof cid === 'string' && courseSid.get(cid) === sid ? cid : '');
      const hids = new Set();
      (Array.isArray(o.hours) ? o.hours : []).slice(-LIM.hours).forEach(e => {
        if (!isObj(e) || typeof e.id !== 'string' || !/^h[a-z0-9]{2,24}$/.test(e.id) || hids.has(e.id) || !sids.has(e.sid) || !isoOk(e.date)) return;
        const minutes = Math.round(Number(e.minutes)); const subject = clip(e.subject, 40);
        if (!(minutes >= 1 && minutes <= 1440) || !subject) return; hids.add(e.id);
        s.hours.push({ id: e.id, sid: e.sid, date: e.date, subject, minutes, courseId: courseOf(e.sid, e.courseId), note: clip(e.note, 300) });
      });
      const pids = new Set(), fids = new Set();
      (Array.isArray(o.portfolio) ? o.portfolio : []).slice(0, LIM.portfolio).forEach(p => {
        if (!isObj(p) || typeof p.id !== 'string' || !/^w[a-z0-9]{2,24}$/.test(p.id) || pids.has(p.id) || !sids.has(p.sid) || !isoOk(p.date)) return;
        const title = clip(p.title, 120); if (!title) return;
        let file = null;
        const f = p.file;
        if (isObj(f) && typeof f.id === 'string' && /^f[a-z0-9]{2,24}$/.test(f.id) && !fids.has(f.id) && typeof f.sha === 'string' && /^[0-9a-f]{64}$/.test(f.sha)) {
          fids.add(f.id); file = { id: f.id, name: safeName(f.name), type: safeType(f.type), size: Math.max(0, Math.min(LIM.fileBytes, Math.round(Number(f.size) || 0))), sha: f.sha };
        }
        pids.add(p.id);
        s.portfolio.push({ id: p.id, sid: p.sid, date: p.date, title, subject: clip(p.subject, 40), courseId: courseOf(p.sid, p.courseId), note: clip(p.note, 1000), from: clip(p.from, 160), file });
      });
      if (isObj(o.profiles)) Object.keys(o.profiles).forEach(sid => {
        const p = o.profiles[sid]; if (!sids.has(sid) || !isObj(p)) return;
        const v = { legalName: legalName(p.legalName), birth: isoOk(p.birth) ? p.birth : '', graduation: isoOk(p.graduation) ? p.graduation : '' };
        if (v.legalName || v.birth || v.graduation) s.profiles[sid] = v;
      });
      if (isObj(o.goals)) { s.goals.days = clampInt(o.goals.days, 0, 400); s.goals.hours = clampInt(o.goals.hours, 0, 5000); }
      if (isObj(o.tx)) { s.tx.gpa = GPA_MODES[o.tx.gpa] ? o.tx.gpa : 'weighted'; s.tx.desc = o.tx.desc !== false; s.tx.hours = o.tx.hours === true; }
      s.demo = o.demo === true;
      return s;
    }
    const clampInt = (v, a, b) => { const n = parseInt(v, 10); return isFinite(n) ? Math.min(b, Math.max(a, n)) : 0; };
    function legalName(v) { const t = clip(v, 80).replace(/\s+/g, ' '); return t && LEGAL_OK.test(t) && !/\d|@/.test(t) ? t : ''; }
    function removeStudentHome(state, sid) {
      const gone = new Set(state.courses.filter(c => c.sid === sid).map(c => c.id));
      state.courses = state.courses.filter(c => c.sid !== sid);
      state.hours = state.hours.filter(e => e.sid !== sid);
      const files = state.portfolio.filter(p => p.sid === sid && p.file).map(p => p.file.id);
      state.portfolio = state.portfolio.filter(p => p.sid !== sid);
      delete state.profiles[sid];
      /* work set only for this learner would otherwise become "for everyone", so it goes, with its grades */
      const orphans = state.assignments.filter(a => (a.for || []).length && a.for.every(x => x === sid)).map(a => a.id);
      state.assignments = state.assignments.filter(a => orphans.indexOf(a.id) < 0);
      orphans.forEach(id => { delete state.grades[id]; });
      state.assignments.forEach(a => { a.for = (a.for || []).filter(x => x !== sid); if (gone.has(a.courseId)) a.courseId = ''; });
      return files;
    }

    /* ---------- learners ---------- */
    function setGrade(state, sid, grade) { const s = state.students.find(x => x.id === sid); if (!s || (grade && !gradeOk(grade))) return false; s.grade = grade || ''; return true; }
    function setProfile(state, sid, o) {
      if (!hasSid(state, sid)) throw new Error('Pick a learner.');
      const raw = clip(o.legalName, 80), ln = legalName(raw);
      if (raw && !ln) throw new Error('Write the full name in letters (spaces, hyphens, apostrophes and full stops are fine).');
      if (o.birth && !isoOk(o.birth)) throw new Error('The date of birth should look like 2010-04-21.');
      if (o.graduation && !isoOk(o.graduation)) throw new Error('The graduation date should look like 2028-06-01.');
      const v = { legalName: ln, birth: o.birth || '', graduation: o.graduation || '' };
      if (v.legalName || v.birth || v.graduation) state.profiles[sid] = v; else delete state.profiles[sid];
      return v;
    }
    const appliesTo = (a, sid) => !a.for || !a.for.length || a.for.indexOf(sid) >= 0;

    /* ---------- subjects and hours ---------- */
    function addSubject(state, name) {
      const t = clip(name, 40); if (!t) throw new Error('Name the subject.');
      if (state.subjects.some(x => x.toLowerCase() === t.toLowerCase())) throw new Error('That subject is already on the list.');
      if (state.subjects.length >= LIM.subjects) throw new Error('The list is full (' + LIM.subjects + ' subjects).');
      state.subjects.push(t); return t;
    }
    function removeSubject(state, name) { state.subjects = state.subjects.filter(x => x !== name); }
    /* one entry per learner; a course pins the entry to that course's learner */
    function logHours(state, o) {
      if (!isoOk(o.date)) throw new Error('Pick a date.');
      const subject = clip(o.subject, 40); if (!subject) throw new Error('Pick a subject.');
      const minutes = Math.round(Number(o.minutes));
      if (!(minutes >= 1)) throw new Error('Enter how long, in hours and minutes.');
      if (minutes > 1440) throw new Error('One entry can be at most 24 hours.');
      const course = o.courseId ? state.courses.find(c => c.id === o.courseId) : null;
      const sids = course ? [course.sid] : (o.sids || []).filter((x, i, a) => hasSid(state, x) && a.indexOf(x) === i);
      if (!sids.length) throw new Error('Pick at least one learner.');
      if (state.hours.length + sids.length > LIM.hours) throw new Error('The hours log is full. Save a backup, then remove old entries.');
      return sids.map(sid => { const e = { id: uid('h', state.hours), sid, date: o.date, subject, minutes, courseId: course ? course.id : '', note: clip(o.note, 300) }; state.hours.push(e); return e; });
    }
    function hoursSummary(state, sid, from, to) {
      const list = state.hours.filter(e => e.sid === sid && inRange(e.date, from, to));
      const by = {}, days = new Set(); let total = 0;
      list.forEach(e => { by[e.subject] = (by[e.subject] || 0) + e.minutes; total += e.minutes; days.add(e.date); });
      return { total, days: days.size, entries: list.length, bySubject: Object.keys(by).map(k => ({ subject: k, minutes: by[k] })).sort((a, b) => b.minutes - a.minutes || a.subject.localeCompare(b.subject)) };
    }
    /* minutes per course, built once per change of the hours list instead of one full scan per course */
    let cmCache = { arr: null, len: -1, last: '', by: null };
    function courseMinutes(state, cid) {
      const a = state.hours, last = a.length ? a[a.length - 1].id + ':' + a[a.length - 1].minutes : '';
      if (cmCache.arr !== a || cmCache.len !== a.length || cmCache.last !== last) { const by = new Map(); a.forEach(e => { if (e.courseId) by.set(e.courseId, (by.get(e.courseId) || 0) + e.minutes); }); cmCache = { arr: a, len: a.length, last, by }; }
      return cmCache.by.get(cid) || 0;
    }
    function fmtMinutes(m) { const h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? ' ' + r + ' min' : '') : r + ' min'; }
    const hoursOf = m => Math.round(m / 6) / 10;
    function hoursCSV(state, from, to) {
      const ct = new Map(state.courses.map(c => [c.id, c.title])), nm = new Map(state.students.map(s => [s.id, s.name]));
      const cname = id => ct.get(id) || '', who = sid => nm.get(sid) || '';
      const lines = [['Date', 'Learner', 'Subject', 'Minutes', 'Hours', 'Course', 'What we did'].map(lib.csvCell).join(',')];
      state.hours.filter(e => inRange(e.date, from, to)).sort((a, b) => a.date.localeCompare(b.date) || who(a.sid).localeCompare(who(b.sid))).forEach(e => {
        lines.push([e.date, who(e.sid), e.subject, e.minutes, hoursOf(e.minutes), cname(e.courseId), e.note].map(lib.csvCell).join(','));
      });
      return lines.join('\r\n') + '\r\n';
    }

    /* ---------- courses, grades and GPA ---------- */
    function pctToLetter(p) { if (p === null || p === undefined || !isFinite(p)) return ''; const n = Math.round(p); return SCALE.find(x => n >= x[0])[1]; }
    function saveCourse(state, o) {
      if (!hasSid(state, o.sid)) throw new Error('Pick the learner who takes this course.');
      const title = clip(o.title, 100); if (!title) throw new Error('Give the course a title.');
      const credits = parseFloat(o.credits);
      if (!(credits >= 0 && credits <= 10)) throw new Error('Credits should be between 0 and 10 (for example 1 or 0.5).');
      const grade = cleanGradeText(o.grade);
      if (grade === null) throw new Error('A final grade is a letter (A, B+, C-, F), P for pass, or a percent from 0 to 100.');
      const old = o.id ? state.courses.find(c => c.id === o.id) : null;
      if (!old && state.courses.length >= LIM.courses) throw new Error('You can keep up to ' + LIM.courses + ' courses.');
      const c = { id: old ? old.id : uid('k', state.courses), sid: o.sid, title, subject: clip(o.subject, 40), year: clip(o.year, 20), gradeLevel: gradeOk(o.gradeLevel) ? o.gradeLevel : '',
        level: LEVELS[o.level] ? o.level : 'standard', credits: Math.round(credits * 4) / 4, status: STATUS[o.status] ? o.status : 'progress', grade, description: clip(o.description, 1500) };
      if (old) {
        const moved = old.sid !== c.sid; Object.assign(old, c);
        if (moved) { state.assignments.forEach(a => { if (a.courseId === c.id) a.for = [c.sid]; }); state.hours.forEach(e => { if (e.courseId === c.id) e.courseId = ''; }); state.portfolio.forEach(p => { if (p.courseId === c.id) p.courseId = ''; }); }
        return old;
      }
      state.courses.push(c); return c;
    }
    function removeCourse(state, id) {
      state.courses = state.courses.filter(c => c.id !== id);
      state.assignments.forEach(a => { if (a.courseId === id) a.courseId = ''; });
      state.hours.forEach(e => { if (e.courseId === id) e.courseId = ''; });
      state.portfolio.forEach(p => { if (p.courseId === id) p.courseId = ''; });
    }
    /* manual final grade, else the weighted average of this learner's graded work linked to the course */
    function courseGrade(state, c) {
      if (c.grade) {
        if (c.grade === 'P') return { text: 'P', letter: 'P', pct: null, source: 'manual' };
        if (POINTS[c.grade] !== undefined) return { text: c.grade, letter: c.grade, pct: null, source: 'manual' };
        const p = +c.grade; return { text: pctToLetter(p) + ' (' + p + '%)', letter: pctToLetter(p), pct: p, source: 'manual' };
      }
      let sum = 0, w = 0;
      state.assignments.forEach(a => { if (a.courseId !== c.id) return; const r = lib.rubricResult(a, (state.grades[a.id] || {})[c.sid]); if (r.pct !== null) { sum += r.pct * a.weight; w += a.weight; } });
      if (!w) return { text: '', letter: '', pct: null, source: '' };
      const pct = Math.round(10 * sum / w) / 10;
      return { text: pctToLetter(pct) + ' (' + Math.round(pct) + '%)', letter: pctToLetter(pct), pct, source: 'gradebook' };
    }
    function gradePoints(letter, level, mode) {
      if (POINTS[letter] === undefined || mode === 'none') return null;
      const base = POINTS[letter];
      return mode === 'weighted' && base > 0 ? r2(base + (BONUS[level] || 0)) : base;
    }
    /* GPA over completed courses with a letter grade, weighted by credits; P and in-progress courses do not count */
    function gpaOf(rows, mode) {
      let pts = 0, cr = 0;
      rows.forEach(r => { if (r.status !== 'done' || r.points === null || !(r.credits > 0)) return; pts += r.points * r.credits; cr += r.credits; });
      return cr ? Math.round(1000 * pts / cr) / 1000 : null;
    }
    function courseRows(state, sid, mode) {
      return state.courses.filter(c => c.sid === sid).map(c => {
        const g = courseGrade(state, c), done = c.status === 'done';
        return { id: c.id, title: c.title, subject: c.subject, year: c.year, gradeLevel: c.gradeLevel, level: c.level, levelName: LEVELS[c.level], credits: c.credits, status: c.status, statusName: STATUS[c.status],
          grade: done ? g.text || 'Not graded' : STATUS[c.status], letter: g.letter, source: g.source, points: done ? gradePoints(g.letter, c.level, mode) : null,
          earned: done && g.letter && g.letter !== 'F' ? c.credits : 0, description: c.description, minutes: courseMinutes(state, c.id) };
      });
    }
    function creditSummary(state, sid) {
      const rows = courseRows(state, sid, 'unweighted');
      const sum = st => r2(rows.filter(r => r.status === st).reduce((n, r) => n + r.credits, 0));
      return { earned: r2(rows.reduce((n, r) => n + r.earned, 0)), progress: sum('progress'), planned: sum('planned'), courses: rows.length,
        unweighted: gpaOf(courseRows(state, sid, 'unweighted')), weighted: gpaOf(courseRows(state, sid, 'weighted')) };
    }
    const yearKey = r => (r.year || '') + '|' + (r.gradeLevel ? ('00' + (GRADES.findIndex(x => x[0] === r.gradeLevel))).slice(-2) : '99');
    /* the transcript: courses on the record (completed and in progress) grouped by school year, with credits and GPA per year and overall */
    function transcript(state, sid, opts) {
      const st = state.students.find(s => s.id === sid); if (!st) return null;
      const o = opts || {}, mode = GPA_MODES[o.gpa] ? o.gpa : state.tx.gpa, p = state.profiles[sid] || {};
      const rows = courseRows(state, sid, mode).filter(r => r.status !== 'planned');
      const years = [], subj = r => { const i = state.subjects.indexOf(r.subject); return i < 0 ? 99 : i; };
      rows.slice().sort((a, b) => yearKey(a).localeCompare(yearKey(b)) || subj(a) - subj(b) || a.title.localeCompare(b.title)).forEach(r => {
        const key = r.year || 'Other courses'; let y = years.find(x => x.year === key);
        if (!y) { y = { year: key, gradeLevels: [], courses: [] }; years.push(y); }
        if (r.gradeLevel && y.gradeLevels.indexOf(r.gradeLevel) < 0) y.gradeLevels.push(r.gradeLevel);
        y.courses.push(r);
      });
      years.forEach(y => { y.gradeName = y.gradeLevels.map(gradeLabel).join(', '); y.earned = r2(y.courses.reduce((n, r) => n + r.earned, 0)); y.gpa = mode === 'none' ? null : gpaOf(y.courses, mode); });
      const c = state.classroom;
      return { school: c.name, address: c.address || '', parent: c.teacher, learner: st.name, legalName: p.legalName || '', birth: p.birth || '', graduation: p.graduation || '', grade: gradeLabel(st.grade),
        years, gpaMode: mode, gpaName: GPA_MODES[mode], gpa: mode === 'none' ? null : gpaOf(rows, mode), earned: r2(rows.reduce((n, r) => n + r.earned, 0)),
        inProgress: r2(rows.filter(r => r.status === 'progress').reduce((n, r) => n + r.credits, 0)), withDesc: rows.filter(r => r.description), scale: SCALE.map(x => [x[1], x[0], POINTS[x[1]]]) };
    }

    /* ---------- portfolio ---------- */
    /* a stored file's type: a plain MIME type, and never one a browser would run as a page (HTML, SVG, XML, script) */
    /* an allow-list of document, image, audio and video types; anything else (HTML, SVG, XML, scripts, unknown) is kept as plain bytes */
    const SAFE_TYPE = /^(image\/(png|jpeg|gif|webp|bmp|heic|heif|avif)|application\/(pdf|zip|json|rtf|msword|vnd\.ms-(excel|powerpoint)|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|vnd\.oasis\.opendocument\.(text|spreadsheet|presentation))|text\/(plain|csv|markdown)|audio\/(mpeg|mp4|ogg|wav|webm|x-m4a)|video\/(mp4|webm|quicktime|ogg))$/;
    function safeType(t) { t = String(t == null ? '' : t).trim().toLowerCase(); return SAFE_TYPE.test(t) ? t : 'application/octet-stream'; }
    function safeName(n) { const t = clip(String(n == null ? '' : n).split(/[\\/]/).pop(), 120).replace(/[\x00-\x1f<>:"|?*]/g, '').replace(/^[ .]+|[ .]+$/g, ''); return t || 'file'; }
    function addPortfolioItem(state, o) {
      if (!hasSid(state, o.sid)) throw new Error('Pick a learner.');
      if (!isoOk(o.date)) throw new Error('Pick a date.');
      const title = clip(o.title, 120); if (!title) throw new Error('Give this piece of work a title.');
      if (state.portfolio.length >= LIM.portfolio) throw new Error('The portfolio is full (' + LIM.portfolio + ' pieces). Save the files, then remove older ones.');
      let file = null;
      if (o.file) {
        if (!(o.file.size <= LIM.fileBytes)) throw new Error('That file is bigger than 25 MB.');
        if (!/^[0-9a-f]{64}$/.test(o.file.sha || '')) throw new Error('The file could not be checked.');
        file = { id: o.file.id && /^f[a-z0-9]{2,24}$/.test(o.file.id) ? o.file.id : uid('f', state.portfolio.filter(p => p.file).map(p => p.file)), name: safeName(o.file.name), type: safeType(o.file.type), size: Math.round(o.file.size), sha: o.file.sha };
      }
      const c = o.courseId && state.courses.find(x => x.id === o.courseId && x.sid === o.sid);
      const p = { id: uid('w', state.portfolio), sid: o.sid, date: o.date, title, subject: clip(o.subject, 40), courseId: c ? c.id : '', note: clip(o.note, 1000), from: clip(o.from, 160), file };
      state.portfolio.push(p); return p;
    }
    /* returns the stored file id to delete, if any */
    function removePortfolioItem(state, id) { const p = state.portfolio.find(x => x.id === id); state.portfolio = state.portfolio.filter(x => x.id !== id); return p && p.file ? p.file.id : ''; }
    const itemsFor = (state, sid, from, to) => state.portfolio.filter(p => p.sid === sid && inRange(p.date, from, to)).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
    const imageType = t => /^image\/(png|jpeg|gif|webp)$/.test(t || '');
    /* imported results from the Stark apps that are not in the portfolio yet */
    function appWork(state, sid) { const have = new Set(state.portfolio.filter(p => p.sid === sid && p.from).map(p => p.from)); return (state.evidence[sid] || []).filter(e => !have.has(e.label)); }

    /* store-only ZIP (no compression: photos and PDFs are already compressed), with UTF-8 names */
    const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
    const utf8 = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
    function makeZip(files) {
      const parts = [], central = []; let off = 0;
      files.forEach(f => {
        const name = utf8(f.name), data = f.data, crc = crc32(data), lh = new Uint8Array(30 + name.length), dv = new DataView(lh.buffer);
        dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0x5c21, true);
        dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, name.length, true); lh.set(name, 30);
        const ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer);
        cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(14, 0x5c21, true);
        cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, off, true); ch.set(name, 46);
        parts.push(lh, data); central.push(ch); off += lh.length + data.length;
      });
      const cdSize = central.reduce((n, c) => n + c.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
      ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, off, true);
      const all = parts.concat(central, [end]), out = new Uint8Array(all.reduce((n, p) => n + p.length, 0)); let o = 0;
      all.forEach(p => { out.set(p, o); o += p.length; });
      return out;
    }
    const pathPart = s => (clip(s, 120).replace(/[\\/]/g, '-').replace(/[\x00-\x1f<>:"|?*]/g, '').replace(/^[ .]+|[ .]+$/g, '') || 'item').slice(0, 60);
    /* the portfolio as one zip for an evaluator or a new computer: a folder per learner, a readable index and a checked manifest.
       blobs: { fileId: Uint8Array } for the files this browser holds; missing files are listed, not invented. */
    function portfolioZip(state, sids, blobs, savedIso) {
      const files = [], items = [], used = new Set(), missing = [];
      const lines = ['Portfolio from ' + (state.classroom.name || 'our home school') + (savedIso ? ', saved ' + savedIso.slice(0, 10) : ''), ''];
      sids.filter(sid => hasSid(state, sid)).forEach(sid => {
        const name = nameOf(state, sid), list = itemsFor(state, sid).slice().reverse();
        lines.push(name + ' (' + list.length + (list.length === 1 ? ' piece' : ' pieces') + ')');
        list.forEach(p => {
          let path = '';
          if (p.file) {
            const data = blobs[p.file.id];
            if (data) {
              const ext = (/\.([A-Za-z0-9]{1,8})$/.exec(p.file.name) || [0, 'bin'])[1].toLowerCase();
              let base = pathPart(name) + '/' + p.date + ' ' + pathPart(p.title), k = 1; path = base + '.' + ext;
              while (used.has(path.toLowerCase())) { k++; path = base + ' (' + k + ').' + ext; }
              used.add(path.toLowerCase()); files.push({ name: path, data });
            } else missing.push(p.title);
          }
          items.push({ id: p.id, sid, learner: name, date: p.date, title: p.title, subject: p.subject, note: p.note, from: p.from, file: p.file ? Object.assign({ path }, p.file) : null });
          lines.push('- ' + p.date + '  ' + p.title + (p.subject ? ' (' + p.subject + ')' : '') + (path ? '  [' + path + ']' : p.file ? '  [file not on this computer]' : ''));
          if (p.note) lines.push('    ' + p.note.replace(/\s+/g, ' '));
          if (p.from) lines.push('    From the Stark apps: ' + p.from);
        });
        lines.push('');
      });
      lines.push('Made with Stark Homeroom. The files stay wherever you keep this zip.');
      const manifest = { app: PORT_APP, version: 1, saved: savedIso || '', items };
      files.unshift({ name: 'portfolio.json', data: utf8(JSON.stringify(manifest, null, 1)) }, { name: 'README.txt', data: utf8(lines.join('\r\n') + '\r\n') });
      return { zip: makeZip(files), count: items.length, files: files.length - 2, missing };
    }
    /* reads a portfolio zip back: every file must match the checksum in the manifest. Returns {ok, error, files:[{id, data, item}], problems} */
    async function readPortfolioZip(u8, inflate) {
      const z = lib.readZip(u8); if (z.error) return { ok: false, error: 'This is not a readable zip.', files: [], problems: [] };
      const by = {}; z.entries.forEach(e => { by[e.name] = e; });
      if (!by['portfolio.json']) return { ok: false, error: 'This zip is not a Stark Homeroom portfolio.', files: [], problems: [] };
      let m; try { m = JSON.parse(new TextDecoder('utf-8').decode(await lib.zipData(u8, by['portfolio.json'], inflate))); } catch (e) { return { ok: false, error: 'The portfolio list inside the zip cannot be read.', files: [], problems: [] }; }
      if (!isObj(m) || m.app !== PORT_APP || m.version !== 1 || !Array.isArray(m.items) || lib.unsafeKeys(m, 0)) return { ok: false, error: 'This zip is not a Stark Homeroom portfolio.', files: [], problems: [] };
      const out = [], problems = [];
      for (const it of m.items.slice(0, LIM.portfolio)) {
        if (!isObj(it) || !isObj(it.file) || !it.file.path) continue;
        const f = it.file, path = clip(f.path, 120);
        /* every manifest field that reaches the file store is checked: id shape, checksum shape, size, name and type */
        if (typeof f.path !== 'string' || typeof f.id !== 'string' || !/^f[a-z0-9]{2,24}$/.test(f.id) || typeof f.sha !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha) || typeof f.name !== 'string' || f.name.length > 255 || (f.type !== undefined && typeof f.type !== 'string')) { problems.push('not a valid entry: ' + path); continue; }
        if (typeof it.learner !== 'string' || typeof it.title !== 'string' || !isoOk(it.date)) { problems.push('not a valid entry: ' + path); continue; }
        it.file = { path: f.path, id: f.id, name: safeName(f.name), type: safeType(f.type), size: Math.max(0, Math.min(LIM.fileBytes, Math.round(Number(f.size) || 0))), sha: f.sha };
        const e = by[f.path]; if (!e) { problems.push('missing: ' + path); continue; }
        if (e.usize > LIM.fileBytes) { problems.push('too big: ' + path); continue; }
        let data; try { data = await lib.zipData(u8, e, inflate); } catch (err) { problems.push('damaged: ' + clip(it.file.path, 120)); continue; }
        if (lib.sha256(data) !== it.file.sha) { problems.push('changed after it was saved: ' + clip(it.file.path, 120)); continue; }
        out.push({ id: it.file.id, data, item: it });
      }
      return { ok: true, error: '', files: out, problems, items: m.items.length };
    }

    /* ---------- progress report (for the family, an evaluator or an umbrella school) ---------- */
    function progressReport(state, sid, opts) {
      const o = opts || {}, r = lib.studentReport(state, sid); if (!r) return null;
      const st = state.students.find(s => s.id === sid), from = o.from || '', to = o.to || '';
      return { name: r.name, grade: gradeLabel(st.grade), school: r.classroom, parent: r.teacher, year: r.term, from, to, final: r.final,
        attendance: lib.attendanceSummary(state, sid, from, to), goals: Object.assign({}, state.goals), hours: hoursSummary(state, sid, from, to),
        courses: courseRows(state, sid, state.tx.gpa).filter(c => c.status !== 'planned'), credits: creditSummary(state, sid),
        rows: r.rows.filter(x => x.pct !== null), standards: lib.mastery(state, sid).filter(m => m.n).map(m => ({ code: m.code, label: m.label, score: m.score, prof: m.prof })),
        missing: lib.missingWork(state, sid, o.today || ''), strengths: r.strengths.map(c => c.text), next: r.next.map(c => c.text),
        portfolio: itemsFor(state, sid, from, to).map(p => ({ date: p.date, title: p.title, subject: p.subject })), evidence: r.evidence };
    }

    return { GRADES, SUBJECTS, LEVELS, STATUS, GPA_MODES, POINTS, SCALE, HOME_LIM: LIM, emptyHome, sanitizeHome, cleanFor, cleanGradeText, removeStudentHome, legalName,
      gradeLabel, setGrade, setProfile, appliesTo, addSubject, removeSubject, logHours, hoursSummary, courseMinutes, fmtMinutes, hoursOf, hoursCSV,
      pctToLetter, saveCourse, removeCourse, courseGrade, gradePoints, gpaOf, courseRows, creditSummary, transcript,
      safeName, safeType, addPortfolioItem, removePortfolioItem, itemsFor, imageType, appWork, crc32, makeZip, portfolioZip, readPortfolioZip, progressReport };
  }

  SHR.home = { install };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHR.home;
})(typeof window !== 'undefined' ? window : globalThis);
