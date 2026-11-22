/* Stark IntraTheater by Stark. Classroom logic as pure functions (no DOM, no storage, no network):
   roster name rules, lesson steps, progress report rows, CSV and class backup. tests/test_data.py runs these in node. */
(function (root) {
  'use strict';
  const SIT = root.SIT = root.SIT || {};
  const BANDS = ['K-2', '3-5', '6-8'];
  const MAX_STUDENTS = 60;
  const APP = 'stark-intratheater-class';

  /* ---------- roster: first names or nicknames only ---------- */
  const NAME_OK = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;
  function cleanName(raw) {
    const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!s) return { name: '', error: 'empty' };
    if (/[@:/\\]|\d/.test(s)) return { name: '', error: 'Use a first name or nickname, not an email, number or address.' };
    if (s.length > 20) return { name: '', error: 'Keep names to 20 letters or fewer.' };
    if (!NAME_OK.test(s)) return { name: '', error: 'Use letters only (spaces, hyphens and apostrophes are fine).' };
    const w = s.split(' ');
    /* two words only when the second is a single initial ("Sam K."): "John Smith" and "Mary Jane" look the same, so both are refused */
    if (w.length > 2 || (w.length === 2 && !/^[\p{L}]\.?$/u.test(w[1]))) return { name: '', error: 'Use a first name or nickname only, not a full name. Add one initial if two students share a name (Sam K.), or join with a hyphen (Mary-Jane).' };
    return { name: s, error: '' };
  }
  /* text: one name per line, or separated by commas or semicolons. existing: names already on the roster. */
  function parseRoster(text, existing, max) {
    const cap = max || MAX_STUDENTS;
    const seen = new Set((existing || []).map(n => String(n).toLowerCase()));
    const add = [], rejected = [];
    String(text || '').split(/[\n\r,;\t]+/).forEach(raw => {
      const r = cleanName(raw);
      if (r.error === 'empty') return;
      if (r.error) { rejected.push({ raw: raw.trim(), why: r.error }); return; }
      const k = r.name.toLowerCase();
      if (seen.has(k)) { rejected.push({ raw: r.name, why: 'Already on the roster.' }); return; }
      if (seen.size >= cap) { rejected.push({ raw: r.name, why: 'The roster is full (' + cap + ' students).' }); return; }
      seen.add(k); add.push(r.name);
    });
    return { add, rejected };
  }

  /* ---------- quiz labels ---------- */
  const GEO_T = { capital: 'capitals', continent: 'continents', flag: 'flags' };
  function quizLabel(key) {
    let m = /^geo-(capital|continent|flag)-(kid|grown)$/.exec(key);
    if (m) return 'Geography: ' + GEO_T[m[1]] + (m[2] === 'kid' ? ' (kids)' : ' (all countries)');
    m = /^math-(\d)$/.exec(key);
    if (m) return 'Maths Garden: level ' + m[1];
    m = /^lang-([a-z]{2})$/.exec(key);
    if (m) return 'Languages: ' + m[1].toUpperCase() + ' word game';
    m = /^(hist-order|geo-find)-(kid|grown)$/.exec(key);
    if (m) return (m[1] === 'hist-order' ? 'History: put moments in order' : 'Geography: find it on the map') + (m[2] === 'kid' ? ' (kids)' : ' (grown-up level)');
    m = /^src-([a-z0-9-]+)$/.exec(key);
    if (m) { const g = typeof window !== 'undefined' ? window : globalThis, s = ((g.SIT_DATA || {}).sources || []).find(x => x.id === m[1]); return 'Primary source check: ' + (s ? s.title : m[1]); }
    return ({ 'sci-kids': 'Science quiz (kids)', 'sci-grown': 'Science quiz (grown-up level)', 'sci-elements': 'Science: elements quiz', 'art-kids': 'Art and Music quiz (kids)', 'art-grown': 'Art and Music quiz (grown-up level)', 'art-works': 'Art and Music: works quiz',
      'math-frac': 'Math: fractions', 'math-tables': 'Math: times tables', 'math-shapes': 'Math: shapes and angles', 'math-graph': 'Math: graphs', 'hist-kids': 'History: family quiz', 'hist-first': 'History: which came first', 'hist-first-hard': 'History: which came first (hard)', 'hist-hard': 'History: hard', 'hard-trivia': 'Hard trivia' })[key] || key;
  }
  const geoKey = q => 'geo-' + q.type + '-' + q.level;

  /* ---------- lesson steps ---------- */
  const ACT = { draw: ['🎨', 'Drawing Pad'], story: ['📚', 'Story Builder'], math: ['🌻', 'Maths Garden'], spell: ['🐝', 'Spelling Bee'] };
  /* explorer step -> local route, e.g. {go:'science', tab:'planets', id:'mars'} -> '#/science?tab=planets&id=mars' */
  function exHref(s) {
    const q = []; if (s.tab) q.push('tab=' + s.tab); if (s.id) q.push('id=' + encodeURIComponent(s.id));
    return '#/' + s.go + (q.length ? '?' + q.join('&') : '');
  }
  /* evById: {id: event}; cByIso: {iso2: country}. Each step: key, icon, label, href, auto (a progress check) or null. */
  function lessonSteps(L, evById, cByIso) {
    const out = [];
    if (L.steps) {   /* explorer lessons: steps open an explorer page (Science, Art, Math, Languages) */
      L.steps.forEach((s, i) => out.push({ key: 's' + i, icon: s.icon, label: s.label, href: exHref(s), auto: s.quiz ? { best: s.quiz } : null }));
      out.push({ key: 'talk', icon: '💬', label: 'Talk about it with your class', href: '', auto: null });
      return out;
    }
    L.events.forEach(id => { const e = evById[id]; if (e) out.push({ key: 'e:' + id, icon: e.icon, label: 'Read: ' + e.title + ' (' + e.date + ')', href: '#/history?e=' + id, auto: { seen: id } }); });
    L.countries.forEach(iso => { const c = cByIso[iso]; if (c) out.push({ key: 'c:' + iso, icon: '📍', label: 'Find ' + c.name + ' and its capital, ' + c.capital, href: '#/geo?c=' + iso, auto: null }); });
    out.push({ key: 'gq', icon: '🌍', label: 'Geography quiz: ' + quizLabel(geoKey(L.geoQuiz)).replace('Geography: ', ''), href: '#/geo?tab=quiz&qt=' + L.geoQuiz.type + '&ql=' + L.geoQuiz.level, auto: { best: geoKey(L.geoQuiz) } });
    if (L.historyQuiz) out.push({ key: 'hq', icon: '⏳', label: quizLabel(L.historyQuiz), href: '#/history?tab=quiz', auto: { best: L.historyQuiz } });
    const a = ACT[L.activity.kind];
    out.push({ key: 'act', icon: a[0], label: a[1] + ': ' + L.activity.prompt, href: '#/kids/' + L.activity.kind, auto: L.activity.kind === 'math' && L.activity.level ? { best: 'math-' + L.activity.level } : null });
    out.push({ key: 'talk', icon: '💬', label: 'Talk about it with your class', href: '', auto: null });
    return out;
  }
  /* true when the app itself recorded the step (event opened on the timeline, quiz played) */
  function autoDone(step, p) {
    if (!step.auto) return false;
    if (step.auto.seen) return (p.seen || []).indexOf(step.auto.seen) >= 0;
    return !!(p.best && p.best[step.auto.best]);
  }
  function lessonState(L, steps, prog) {
    const p = prog || {};
    const manual = (p.lessonSteps || {})[L.id] || [];
    const done = steps.filter(s => manual.indexOf(s.key) >= 0 || autoDone(s, p)).map(s => s.key);
    return { done, total: steps.length, complete: (p.lessons || []).indexOf(L.id) >= 0 };
  }

  /* ---------- progress report ---------- */
  const pct = (s, t) => (t > 0 ? Math.round(100 * s / t) : 0);
  /* students: [{id, name}]; progressById: {id: progress}; lessons: lesson list; totalEvents: number of timeline events. */
  function buildReport(students, progressById, lessons, totalEvents) {
    const title = {}; (lessons || []).forEach(L => { title[L.id] = L.title; });
    return (students || []).map(s => {
      const p = (progressById || {})[s.id] || {};
      const best = p.best || {};
      const quizzes = Object.keys(best).sort().filter(k => best[k] && best[k].total > 0)
        .map(k => ({ key: k, label: quizLabel(k), score: best[k].score, total: best[k].total, pct: pct(best[k].score, best[k].total) }));
      const done = (p.lessons || []).filter(id => title[id]);
      return {
        id: s.id, name: s.name, stars: p.stars || 0,
        explored: (p.seen || []).length, totalEvents: totalEvents || 0,
        lessonsDone: done.map(id => title[id]), lessonsDoneCount: done.length,
        quizzes, avgPct: quizzes.length ? Math.round(quizzes.reduce((a, q) => a + q.pct, 0) / quizzes.length) : null
      };
    });
  }
  function csvCell(v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // spreadsheet formula guard
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function reportCSV(rows) {
    const keys = []; const labels = {};
    rows.forEach(r => r.quizzes.forEach(q => { if (keys.indexOf(q.key) < 0) { keys.push(q.key); labels[q.key] = q.label; } }));
    keys.sort();
    const head = ['Student', 'Stars', 'Moments explored', 'Lessons completed', 'Lesson titles', 'Average best quiz %'].concat(keys.map(k => labels[k] + ' best %'));
    const lines = [head.map(csvCell).join(',')];
    rows.forEach(r => {
      const by = {}; r.quizzes.forEach(q => { by[q.key] = q.pct; });
      lines.push([r.name, r.stars, r.explored, r.lessonsDoneCount, r.lessonsDone.join('; '), r.avgPct === null ? '' : r.avgPct]
        .concat(keys.map(k => (k in by ? by[k] : ''))).map(csvCell).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  /* ---------- class backup (one JSON file) ---------- */
  function buildBackup(classroom, students, progressById, savedIso) {
    const progress = {};
    (students || []).forEach(s => { if (progressById && progressById[s.id]) progress[s.id] = progressById[s.id]; });
    return { app: APP, version: 1, saved: savedIso || '', classroom: classroom || {}, students: (students || []).map(s => ({ id: s.id, name: s.name, avatar: s.avatar })), progress };
  }
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  /* Validates a parsed backup. Returns {ok, error, classroom, students, progress}; never trusts the file. */
  function readBackup(o, lessonIds) {
    if (!isObj(o) || o.app !== APP || !Array.isArray(o.students)) return { ok: false, error: 'This file is not a Stark IntraTheater class backup.' };
    if (o.students.length > MAX_STUDENTS) return { ok: false, error: 'This backup has more than ' + MAX_STUDENTS + ' students.' };
    const students = [], progress = {}, ids = new Set();
    for (const s of o.students) {
      if (!isObj(s) || typeof s.id !== 'string' || !/^kid[a-z0-9]{1,24}$/i.test(s.id) || ids.has(s.id)) return { ok: false, error: 'A student entry in this file is damaged.' };
      const n = cleanName(s.name);
      if (n.error) return { ok: false, error: 'A student name in this file is not a first name or nickname.' };
      ids.add(s.id);
      students.push({ id: s.id, name: n.name, avatar: typeof s.avatar === 'string' && s.avatar.length <= 8 ? s.avatar : '🦊' });
      const p = isObj(o.progress) ? o.progress[s.id] : null;
      if (isObj(p)) progress[s.id] = p;
    }
    const c = isObj(o.classroom) ? o.classroom : {};
    const known = new Set(lessonIds || []);
    const classroom = {
      name: typeof c.name === 'string' ? c.name.slice(0, 60) : '',
      assigned: Array.isArray(c.assigned) ? c.assigned.filter(id => typeof id === 'string' && (!lessonIds || known.has(id))) : []
    };
    return { ok: true, error: '', classroom, students, progress };
  }

  const api = { BANDS, MAX_STUDENTS, cleanName, parseRoster, quizLabel, lessonSteps, exHref, autoDone, lessonState, buildReport, csvCell, reportCSV, buildBackup, readBackup };
  SIT.classLib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
