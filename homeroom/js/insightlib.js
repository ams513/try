/* Stark Homeroom: Insight. Pure functions that read the family's own records and answer questions about them, all
   on this computer: fuzzy search for the command palette, quick-log parsing ("log 45 min geometry maya yesterday"),
   a plain-English question box, a pace forecast with a what-if slider, a records radar that finds gaps and odd
   entries, activity heatmaps and streaks, a subject guesser, and the encrypted vault (AES-256-GCM, key from a
   passphrase with PBKDF2, through the browser's own WebCrypto). No DOM, no storage, no network: hublib.js installs
   these into SHR.lib and tests/test_homeroom.py runs them in node. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const NODE = typeof module !== 'undefined' && module.exports;
  const VAULT = NODE ? require('./vaultlib.js') : SHR.vault;
  const DAY = 86400000;
  const pad = n => (n < 10 ? '0' : '') + n;
  const parse = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
  const isoOf = ms => { const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  const add = (iso, n) => isoOf(parse(iso) + n * DAY);
  const diff = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
  const dow = iso => new Date(parse(iso)).getUTCDay();               // 0 = Sunday
  const weekday = iso => { const d = dow(iso); return d >= 1 && d <= 5; };
  const monday = iso => add(iso, -((dow(iso) + 6) % 7));
  const r1 = v => Math.round(v * 10) / 10;
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s'.:-]/g, ' ').replace(/\s+/g, ' ').trim();
  const fmtMin = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? ' ' + r + ' min' : '') : r + ' min'; };
  const fmtDay = iso => new Date(parse(iso)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const CORE = ['Reading', 'Writing and language arts', 'Mathematics', 'Science', 'Social studies and history'];

  /* ---------- subject guesser: keyword prefixes -> the standard subject names ---------- */
  const KEYS = {
    'Reading': ['read', 'book', 'novel', 'librar', 'stories', 'story', 'phonics', 'literature'],
    'Writing and language arts': ['writ', 'essay', 'grammar', 'spelling', 'composition', 'poem', 'poetry', 'paragraph', 'handwriting', 'vocabulary', 'english'],
    'Mathematics': ['math', 'algebra', 'geometry', 'fraction', 'arithmetic', 'calculus', 'equation', 'multiplication', 'division', 'trig', 'decimal', 'statistics', 'proof'],
    'Science': ['science', 'biology', 'chemistry', 'physics', 'experiment', 'astronomy', 'microscope', 'ecology', 'geology', 'lab'],
    'Social studies and history': ['history', 'geography', 'civics', 'government', 'ancient', 'social', 'economics', 'timeline', 'museum', 'atlas'],
    'Foreign language': ['spanish', 'french', 'german', 'latin', 'japanese', 'chinese', 'italian', 'korean', 'arabic', 'russian', 'portuguese', 'language'],
    'Art': ['art', 'draw', 'paint', 'sketch', 'watercolo', 'craft', 'pottery', 'sculpt', 'illustrat'],
    'Music': ['music', 'piano', 'guitar', 'violin', 'choir', 'singing', 'drum', 'recorder', 'ukulele', 'orchestra'],
    'Physical education': ['pe', 'swim', 'soccer', 'gym', 'sport', 'hike', 'hiking', 'bike', 'cycling', 'fitness', 'gymnastic', 'dance', 'karate', 'running', 'basketball', 'tennis'],
    'Health': ['health', 'nutrition', 'first-aid', 'firstaid', 'safety', 'wellness'],
    'Life skills': ['cook', 'baking', 'bake', 'budget', 'garden', 'chore', 'sewing', 'driving', 'laundry', 'shopping', 'volunteer'],
    'Electives': ['coding', 'programming', 'robotics', 'typing', 'woodwork', 'photography', 'chess', 'elective', 'debate']
  };
  function suggestSubject(text, subjects) {
    const t = ' ' + norm(text) + ' ', list = Array.isArray(subjects) && subjects.length ? subjects : Object.keys(KEYS);
    let best = null, bestScore = 0;
    list.forEach(sub => { const n = norm(sub); if (n && t.indexOf(' ' + n + ' ') >= 0 && 100 > bestScore) { best = sub; bestScore = 100; } });   // the family's own names win
    if (best) return best;
    const words = norm(text).split(' ').filter(Boolean);
    Object.keys(KEYS).forEach(sub => {
      if (list.indexOf(sub) < 0) return;
      let sc = 0; words.forEach(w => KEYS[sub].forEach(k => { if (k === 'pe' || k === 'art' || k === 'lab' ? w === k : (w.length >= 3 && w.indexOf(k) === 0)) sc++; }));
      if (sc > bestScore) { best = sub; bestScore = sc; }
    });
    return best;
  }

  /* ---------- fuzzy search ---------- */
  function fuzzyScore(query, text) {
    const q = norm(query), t = norm(text);
    if (!q) return 0;
    let total = 0;
    for (const tok of q.split(' ')) {
      if (!tok) continue;
      const i = t.indexOf(tok);
      if (i >= 0) { total += 100 - Math.min(i, 50) / 2 + (i === 0 || t[i - 1] === ' ' ? 30 : 0) + tok.length; continue; }
      if (tok.length < 2) return -1;
      let p = 0, last = -2, sc = 0;
      for (let k = 0; k < tok.length; k++) { const j = t.indexOf(tok[k], p); if (j < 0) return -1; sc += j === last + 1 ? 6 : 2; if (j === 0 || t[j - 1] === ' ') sc += 4; last = j; p = j + 1; }
      total += sc;
    }
    return total;
  }
  function fuzzyRank(query, items, getText, limit) {
    const out = [];
    items.forEach((it, i) => { const s = fuzzyScore(query, getText(it)); if (s >= 0) out.push({ item: it, score: s, i }); });
    out.sort((a, b) => b.score - a.score || a.i - b.i);
    return out.slice(0, limit || 12).map(x => x.item);
  }
  /* everything the palette can jump to; hash targets stay inside the app, actions are named for the interface to run */
  function commandIndex(state, routes) {
    const out = [];
    (routes || []).forEach(r => out.push({ id: 'go-' + r[0], label: 'Go to ' + r[1], hint: 'Page', kind: 'page', hash: '#/' + r[0] }));
    out.push({ id: 'go-insights', label: 'Go to Insights', hint: 'Pace, radar, heatmap', kind: 'page', hash: '#/insights' });
    out.push({ id: 'act-theme', label: 'Switch dark or light theme', hint: 'Action', kind: 'action', action: 'theme' });
    out.push({ id: 'act-backup', label: 'Download family backup', hint: 'Action', kind: 'action', action: 'backup' });
    out.push({ id: 'act-vault', label: 'Save an encrypted vault backup', hint: 'Action', kind: 'page', hash: '#/safety' });
    state.students.forEach(s => out.push({ id: 'ln-' + s.id, label: s.name, hint: 'Learner' + (s.grade ? ', grade ' + s.grade : ''), kind: 'learner', hash: '#/learners' }));
    state.courses.forEach(c => out.push({ id: 'co-' + c.id, label: c.title, hint: 'Course, ' + ((state.students.find(s => s.id === c.sid) || {}).name || ''), kind: 'course', hash: '#/courses' }));
    state.assignments.forEach(a => out.push({ id: 'as-' + a.id, label: a.title, hint: 'Assignment' + (a.due ? ', due ' + a.due : ''), kind: 'assignment', hash: '#/plan' }));
    state.portfolio.forEach(p => out.push({ id: 'po-' + p.id, label: p.title, hint: 'Portfolio, ' + p.date, kind: 'portfolio', hash: '#/portfolio' }));
    (state.plans || []).forEach(p => out.push({ id: 'pl-' + p.id, label: p.title, hint: 'Lesson, ' + p.date, kind: 'lesson', hash: '#/lessons' }));
    return out;
  }

  /* ---------- reading dates and times out of plain text ---------- */
  function parseDate(text, todayIso) {
    const t = norm(text);
    const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(t);
    if (iso) { try { if (isoOf(parse(iso[1])) === iso[1]) return { date: iso[1], rest: t.replace(iso[0], ' ') }; } catch (e) { /* fall through */ } }
    if (/\byesterday\b/.test(t)) return { date: add(todayIso, -1), rest: t.replace(/\byesterday\b/, ' ') };
    if (/\btoday\b/.test(t)) return { date: todayIso, rest: t.replace(/\btoday\b/, ' ') };
    for (let i = 0; i < 7; i++) {
      const re = new RegExp('\\b(?:on |last )?' + WEEKDAYS[i] + '\\b');
      if (re.test(t)) { let d = todayIso; for (let n = 0; n < 7 && dow(d) !== i; n++) d = add(d, -1); if (d === todayIso && /\blast\b/.test(t)) d = add(d, -7); return { date: d, rest: t.replace(re, ' ') }; }
    }
    return { date: '', rest: t };
  }
  function parseMinutes(text) {
    const t = norm(text);
    let m = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\s*(?:and\s*)?(?:(\d{1,2})\s*(?:m|min|mins|minute|minutes)?)?/.exec(t);
    if (m) { const mins = Math.round(parseFloat(m[1]) * 60 + (m[2] ? parseInt(m[2], 10) : 0)); return { minutes: mins, rest: t.replace(m[0], ' ') }; }
    m = /(\d+)\s*(?:m|min|mins|minute|minutes)\b/.exec(t);
    if (m) return { minutes: parseInt(m[1], 10), rest: t.replace(m[0], ' ') };
    return { minutes: 0, rest: t };
  }
  /* "log 45 min geometry maya yesterday" -> an entry ready for logHours, or the reason it cannot be one */
  function parseQuickLog(state, text, todayIso) {
    const raw = String(text || '').trim();
    if (!/^(log|add)\s/i.test(raw)) return { ok: false, problems: ['Start with "log", for example: log 45 min geometry Maya yesterday.'] };
    const problems = [];
    const dt = parseDate(raw.replace(/^(log|add)\s+/i, ''), todayIso);
    const tm = parseMinutes(dt.rest);
    if (!(tm.minutes >= 1 && tm.minutes <= 1440)) problems.push('Say how long, like 45 min or 1.5 hours.');
    const words = ' ' + tm.rest + ' ';
    const kids = state.students.filter(s => words.indexOf(' ' + norm(s.name) + ' ') >= 0);
    let sids = kids.map(s => s.id);
    let rest = tm.rest; kids.forEach(s => { rest = rest.replace(new RegExp('\\b' + norm(s.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'), ' '); });
    if (!sids.length && /\b(everyone|all|everybody|together)\b/.test(rest)) sids = state.students.map(s => s.id);
    if (!sids.length && state.students.length === 1) sids = [state.students[0].id];
    if (!sids.length) problems.push(state.students.length ? 'Say who: a learner\'s name, or "everyone".' : 'Add a learner first.');
    rest = rest.replace(/\b(everyone|everybody|together|for|of|on|in|the|a|an|to|with|spent|did|log|add|about|at|min|mins|minutes|hours|hour|hrs|hr|and)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const course = state.courses.filter(c => !sids.length || sids.indexOf(c.sid) >= 0).filter(c => c.status !== 'done').map(c => ({ c, s: fuzzyScore(rest, c.title) })).filter(x => x.s >= 0 && rest.length >= 3).sort((a, b) => b.s - a.s)[0];
    const subject = suggestSubject(rest, state.subjects) || (course && course.c.subject && state.subjects.indexOf(course.c.subject) >= 0 ? course.c.subject : null);
    if (!subject) problems.push('Say which subject (for example math, reading, Spanish).');
    const useCourse = course && sids.length === 1 && course.c.sid === sids[0] && (!subject || !course.c.subject || course.c.subject === subject) ? course.c : null;
    const date = dt.date || todayIso;
    if (date > todayIso) problems.push('That date is in the future.');
    return { ok: !problems.length, problems, sids, subject: subject || '', minutes: tm.minutes, date, courseId: useCourse ? useCourse.id : '', note: '',
      summary: problems.length ? '' : 'Log ' + fmtMin(tm.minutes) + ' of ' + subject + (useCourse ? ' (' + useCourse.title + ')' : '') + ' for ' + sids.map(id => (state.students.find(s => s.id === id) || {}).name).join(' and ') + ' on ' + fmtDay(date) };
  }

  /* ---------- periods ---------- */
  function periodRange(text, todayIso) {
    const t = norm(text);
    const sy = () => { const y = +todayIso.slice(0, 4), m = +todayIso.slice(5, 7); return (m >= 7 ? y : y - 1) + '-07-01'; };
    if (/\btoday\b/.test(t)) return { from: todayIso, to: todayIso, label: 'today' };
    if (/\byesterday\b/.test(t)) return { from: add(todayIso, -1), to: add(todayIso, -1), label: 'yesterday' };
    if (/\blast week\b/.test(t)) { const m = add(monday(todayIso), -7); return { from: m, to: add(m, 6), label: 'last week' }; }
    if (/\b(this week|week)\b/.test(t)) return { from: monday(todayIso), to: todayIso, label: 'this week' };
    if (/\blast month\b/.test(t)) { const d = new Date(parse(todayIso)); const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1), last = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0); return { from: isoOf(first), to: isoOf(last), label: 'last month' }; }
    if (/\bthis month\b/.test(t)) return { from: todayIso.slice(0, 8) + '01', to: todayIso, label: 'this month' };
    const n = /\blast (\d{1,3}) days\b/.exec(t); if (n) return { from: add(todayIso, -(+n[1] - 1)), to: todayIso, label: 'the last ' + n[1] + ' days' };
    if (/\b(all time|ever|in total|overall)\b/.test(t)) return { from: '', to: '', label: 'all time' };
    if (/\bthis year\b|\bschool year\b|\bso far\b/.test(t)) return { from: sy(), to: todayIso, label: 'this school year' };
    return { from: sy(), to: todayIso, label: 'this school year', defaulted: true };
  }

  function install(lib) {
    const { hoursSummary, attendanceSummary, creditSummary, missingWork } = lib;
    const nameOf = (state, sid) => (state.students.find(s => s.id === sid) || {}).name || '';
    const inR = (d, f, t) => (!f || d >= f) && (!t || d <= t);
    const sumMin = (state, pred) => state.hours.reduce((n, e) => n + (pred(e) ? e.minutes : 0), 0);

    /* ---------- ask in plain English ---------- */
    function askHomeroom(state, question, todayIso) {
      const q = norm(question), per = periodRange(q, todayIso);
      if (!q) return { kind: 'none', answer: 'Ask about hours, attendance, credits, GPA, missing work or the portfolio.', rows: [] };
      const kids = state.students.filter(s => (' ' + q + ' ').indexOf(' ' + norm(s.name) + ' ') >= 0), who = kids.length ? kids : state.students;
      const subject = state.subjects.find(s => (' ' + q + ' ').indexOf(' ' + norm(s) + ' ') >= 0) || (/\b(hour|minute|time|spent|studied|logged)/.test(q) ? suggestSubject(q.replace(/\b(hours?|minutes?|logged)\b/g, ' '), state.subjects) : null);
      if (!state.students.length) return { kind: 'none', answer: 'There are no learners yet. Add them on the Learners page, or load the sample family.', rows: [] };
      if (/\b(no hours|nothing logged|not logged|haven.?t|idle|quiet|inactive)\b/.test(q)) {
        const rows = who.map(s => ({ label: s.name, value: sumMin(state, e => e.sid === s.id && inR(e.date, per.from, per.to)) })).filter(r => r.value === 0);
        return { kind: 'quiet', answer: rows.length ? rows.map(r => r.label).join(', ') + (rows.length === 1 ? ' has' : ' have') + ' no hours logged ' + per.label + '.' : 'Everyone has hours logged ' + per.label + '.', rows: rows.map(r => ({ label: r.label, value: '0 min' })) };
      }
      if (/\b(missing|overdue|late|behind|outstanding)\b/.test(q)) {
        const rows = []; who.forEach(s => missingWork(state, s.id, todayIso).forEach(t => rows.push({ label: s.name, value: t })));
        return { kind: 'missing', answer: rows.length ? plural(rows.length, 'piece') + ' of work past its due date with nothing handed in.' : 'Nothing is overdue.', rows };
      }
      if (/\b(gpa|grade point)\b/.test(q) || /\b(credit|credits|transcript)\b/.test(q)) {
        const rows = who.map(s => { const c = creditSummary(state, s.id); return { label: s.name, value: c.earned + ' earned, ' + c.progress + ' in progress, ' + c.planned + ' planned; GPA ' + (c.weighted === null || c.weighted === undefined ? '-' : c.weighted.toFixed(2)) + ' weighted, ' + (c.unweighted === null || c.unweighted === undefined ? '-' : c.unweighted.toFixed(2)) + ' unweighted' }; });
        return { kind: 'credits', answer: rows.map(r => r.label + ': ' + r.value + '.').join(' '), rows };
      }
      if (/\b(attend|attendance|present|absent|absence|school days|days)\b/.test(q) && !/\b(hour|minute)/.test(q)) {
        const rows = who.map(s => { const a = attendanceSummary(state, s.id, per.from, per.to); return { label: s.name, value: a.school + ' school days, ' + a.A + ' absent (' + a.days + ' marked)' }; });
        return { kind: 'attendance', answer: rows.map(r => r.label + ': ' + r.value).join('; ') + ' ' + per.label + '.', rows };
      }
      if (/\b(course|courses|class|classes)\b/.test(q)) {
        const st = /\b(done|completed|finished)\b/.test(q) ? 'done' : /\b(planned|upcoming|next)\b/.test(q) ? 'planned' : 'progress';
        const rows = []; state.courses.filter(c => c.status === st && who.some(s => s.id === c.sid)).forEach(c => rows.push({ label: nameOf(state, c.sid), value: c.title + ' (' + c.credits + ' cr)' }));
        return { kind: 'courses', answer: rows.length ? plural(rows.length, 'course') + ' ' + (st === 'done' ? 'completed' : st === 'planned' ? 'planned' : 'in progress') + '.' : 'No courses match.', rows };
      }
      if (/\b(portfolio|work sample|samples|best work)\b/.test(q)) {
        const rows = who.map(s => ({ label: s.name, value: plural(state.portfolio.filter(p => p.sid === s.id && inR(p.date, per.from, per.to)).length, 'piece') }));
        return { kind: 'portfolio', answer: rows.map(r => r.label + ': ' + r.value).join('; ') + ' ' + per.label + '.', rows };
      }
      if (/\b(hour|hours|minute|minutes|time|spent|studied|logged|study|learning|learned)\b/.test(q) || subject) {
        const rows = who.map(s => {
          const mins = sumMin(state, e => e.sid === s.id && inR(e.date, per.from, per.to) && (!subject || e.subject === subject));
          const days = new Set(state.hours.filter(e => e.sid === s.id && inR(e.date, per.from, per.to) && (!subject || e.subject === subject)).map(e => e.date)).size;
          return { label: s.name, minutes: mins, value: fmtMin(mins) + (days ? ' over ' + plural(days, 'day') : '') };
        });
        const total = rows.reduce((n, r) => n + r.minutes, 0);
        return { kind: 'hours', answer: (rows.length === 1 ? rows[0].label + ' logged ' + fmtMin(total) : 'The family logged ' + fmtMin(total)) + (subject ? ' of ' + subject : '') + ' ' + per.label + '.', rows: rows.map(r => ({ label: r.label, value: r.value })), subject: subject || '', period: per };
      }
      return { kind: 'none', answer: 'I can answer questions about hours, attendance, credits and GPA, courses, missing work and the portfolio. Try: "hours of math for ' + state.students[0].name + ' this month".', rows: [] };
    }

    /* ---------- pace and forecast ---------- */
    const weeklyMinutes = (state, sid, endIso, weeks) => { const out = []; const start = add(monday(endIso), -7 * (weeks - 1)); for (let w = 0; w < weeks; w++) { const f = add(start, 7 * w), t = add(f, 6); out.push({ week: f, minutes: sumMin(state, e => (!sid || e.sid === sid) && e.date >= f && e.date <= t) }); } return out; };
    const paceWeek = (state, pred, todayIso) => sumMin(state, e => pred(e) && e.date > add(todayIso, -28) && e.date <= todayIso) / 4;   // minutes per week over the last four weeks
    function whatIf(remainingMin, perWeekMin, todayIso) {
      if (remainingMin <= 0) return { reached: true, weeks: 0, date: todayIso };
      if (!(perWeekMin > 0)) return { reached: false, weeks: null, date: '' };
      const weeks = remainingMin / perWeekMin; return { reached: false, weeks: r1(weeks), date: add(todayIso, Math.ceil(weeks * 7)) };
    }
    /* each course in progress: hours so far against credits x hours per credit (a rule of thumb the family sets), pace, and the date at that pace */
    function courseForecast(state, sid, todayIso, opts) {
      const hpc = Math.max(1, Math.min(400, Number(opts && opts.hoursPerCredit) || 120)), termEnd = (opts && opts.termEnd) || state.classroom.termEnd || '';
      return state.courses.filter(c => c.sid === sid && c.status === 'progress' && c.credits > 0).map(c => {
        const target = Math.round(c.credits * hpc * 60), done = sumMin(state, e => e.courseId === c.id), pace = paceWeek(state, e => e.courseId === c.id, todayIso);
        const w = whatIf(target - done, pace, todayIso);
        return { id: c.id, title: c.title, credits: c.credits, targetMin: target, doneMin: done, remainingMin: Math.max(0, target - done), paceWeekMin: Math.round(pace), pct: Math.min(100, Math.round(done / target * 100)), reached: w.reached, eta: w.date, weeks: w.weeks, onTrack: w.reached ? true : (w.date && termEnd ? w.date <= termEnd : null) };
      }).sort((a, b) => (a.pct - b.pct) || a.title.localeCompare(b.title));
    }
    function goalForecast(state, sid, from, todayIso, to) {
      const goalMin = (state.goals.hours || 0) * 60, logged = sumMin(state, e => e.sid === sid && e.date >= from && e.date <= todayIso), pace = paceWeek(state, e => e.sid === sid, todayIso);
      const w = whatIf(goalMin - logged, pace, todayIso), weeksToEnd = to && to > todayIso ? diff(todayIso, to) / 7 : 0;
      return { goalMin, loggedMin: logged, paceWeekMin: Math.round(pace), eta: w.date, reached: goalMin > 0 && w.reached, projectedMin: Math.round(logged + pace * weeksToEnd), onTrack: !goalMin ? null : (w.reached ? true : (w.date && to ? w.date <= to : null)) };
    }
    /* cumulative hours by week, for the chart; the dotted tail is the projection at the chosen pace */
    function cumulativeSeries(state, sid, from, todayIso, projectWeekMin, projectWeeks) {
      const pts = []; let cum = 0, w = monday(from);
      while (w <= todayIso) { const t = add(w, 6); cum += sumMin(state, e => (!sid || e.sid === sid) && e.date >= w && e.date <= t && e.date >= from && e.date <= todayIso); pts.push({ date: t > todayIso ? todayIso : t, min: cum, projected: false }); w = add(w, 7); }
      for (let i = 1; i <= (projectWeeks || 0); i++) pts.push({ date: add(monday(todayIso), 7 * i + 6), min: Math.round(cum + projectWeekMin * i), projected: true });
      return pts;
    }

    /* ---------- records radar ---------- */
    function recordsRadar(state, todayIso) {
      const found = []; const push = (sev, title, detail, sid, route) => found.push({ sev, title, detail, sid: sid || '', route: route || '' });
      const weekdaysBack = (n, from) => { const out = []; let d = from; while (out.length < n) { if (weekday(d)) out.push(d); d = add(d, -1); } return out; };
      const yesterday = add(todayIso, -1);
      const lastWk = weekdaysBack(10, yesterday);
      const unmarked = lastWk.filter(d => state.hours.some(e => e.date === d) && !state.attendance[d]);
      if (unmarked.length) push('info', 'Hours logged on days the register was not taken', plural(unmarked.length, 'day') + ' (' + unmarked.slice(-3).reverse().map(fmtDay).join(', ') + (unmarked.length > 3 ? ', ...' : '') + '). Take the register so attendance matches the hours.', '', '#/attendance');
      state.students.forEach(s => {
        const mine = state.hours.filter(e => e.sid === s.id), hasAny = mine.length > 0 || Object.keys(state.attendance).some(d => state.attendance[d][s.id]);
        if (hasAny) {
          const marked = d => (state.attendance[d] || {})[s.id], act = d => marked(d) === 'P' || marked(d) === 'T' || marked(d) === 'H' || mine.some(e => e.date === d);
          let run = 0, runEnd = '', best = { n: 0, from: '', to: '' };
          lastWk.forEach(d => { if (!act(d) && marked(d) !== 'A') { if (!run) runEnd = d; run++; if (run > best.n) best = { n: run, from: d, to: runEnd }; } else run = 0; });
          if (best.n >= 5) push('warn', s.name + ' has no records for ' + best.n + ' weekdays in a row', 'No hours or attendance from ' + fmtDay(best.from) + ' to ' + fmtDay(best.to) + '. Fill them in, or mark them absent if it was a break.', s.id, '#/hours');
          else if (best.n >= 3) push('info', s.name + ': ' + best.n + ' quiet weekdays', fmtDay(best.from) + ' to ' + fmtDay(best.to) + ' have no records.', s.id, '#/hours');
        }
        const byDay = {}; mine.forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + e.minutes; });
        Object.keys(byDay).filter(d => byDay[d] > 600).sort().slice(-2).forEach(d => push('warn', s.name + ' logged ' + fmtMin(byDay[d]) + ' on ' + fmtDay(d), 'That is a lot for one day. Check the minutes on that day.', s.id, '#/hours'));
        const seen = {}; let dup = 0; mine.forEach(e => { const k = [e.date, e.subject, e.minutes, e.courseId, e.note].join('|'); if (seen[k]) dup++; else seen[k] = 1; });
        if (dup) push('info', s.name + ' has ' + plural(dup, 'duplicate hours entry', 'duplicate hours entries'), 'Same day, subject, length and note. Remove the extra ones so totals are not doubled.', s.id, '#/hours');
        const recent = mine.filter(e => e.date > add(todayIso, -60)), recentTotal = recent.reduce((n, e) => n + e.minutes, 0);
        if (recentTotal >= 600) CORE.filter(c => state.subjects.indexOf(c) >= 0 && !recent.some(e => e.subject === c)).forEach(c => push('info', s.name + ': no ' + c + ' logged in 60 days', 'Other subjects have hours. This may be fine, or it may be a gap to fill.', s.id, '#/hours'));
        const miss = missingWork(state, s.id, todayIso);
        if (miss.length) push(miss.length >= 3 ? 'warn' : 'info', s.name + ' has ' + plural(miss.length, 'piece') + ' of overdue work', miss.slice(0, 3).join('; ') + (miss.length > 3 ? '; ...' : ''), s.id, '#/plan');
        const hs = !!s.grade && (s.grade === '9' || s.grade === '10' || s.grade === '11' || s.grade === '12');
        if (hs && state.courses.some(c => c.sid === s.id) && !(state.profiles[s.id] || {}).legalName) push('info', s.name + ': transcript needs a full name', 'High-school transcripts show a full legal name. Add it on the Learners page.', s.id, '#/learners');
      });
      state.courses.forEach(c => {
        if (c.status === 'done' && !c.grade && !(lib.courseGrade && lib.courseGrade(state, c).text)) push('warn', c.title + ' is completed but has no grade', nameOf(state, c.sid) + '\'s transcript will show "Not graded".', c.sid, '#/courses');
        if (c.status === 'progress') {
          const any = sumMin(state, e => e.courseId === c.id), recent = sumMin(state, e => e.courseId === c.id && e.date > add(todayIso, -30));
          if (any > 0 && recent === 0) push('info', c.title + ' has gone quiet', 'Hours were logged before, but none in 30 days.', c.sid, '#/courses');
          if (any === 0 && state.hours.length) push('info', 'No hours logged against ' + c.title, 'Pick this course when you log time so the credit forecast works.', c.sid, '#/courses');
        }
      });
      const rank = { warn: 0, info: 1 }; found.sort((a, b) => rank[a.sev] - rank[b.sev]);
      const warn = found.filter(f => f.sev === 'warn').length, info = found.length - warn;
      return { findings: found, score: Math.max(0, Math.min(100, 100 - warn * 12 - info * 4)), warn, info };
    }

    /* ---------- heatmap and streaks ---------- */
    function heatmap(state, sid, endIso, weeks) {
      weeks = Math.max(4, Math.min(60, weeks || 26));
      const by = {}; state.hours.forEach(e => { if (!sid || e.sid === sid) by[e.date] = (by[e.date] || 0) + e.minutes; });
      const start = add(monday(endIso), -7 * (weeks - 1)), vals = [];
      const cols = [];
      for (let w = 0; w < weeks; w++) { const col = []; for (let d = 0; d < 7; d++) { const date = add(start, w * 7 + d); if (date > endIso) { col.push(null); continue; } const m = by[date] || 0; if (m) vals.push(m); col.push({ date, minutes: m, level: 0 }); } cols.push(col); }
      vals.sort((a, b) => a - b);
      const q = p => vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 0, cut = [q(0.25), q(0.5), q(0.75)];
      let active = 0, total = 0;
      cols.forEach(c => c.forEach(x => { if (!x) return; total += x.minutes; if (x.minutes) { active++; x.level = x.minutes <= cut[0] ? 1 : x.minutes <= cut[1] ? 2 : x.minutes <= cut[2] ? 3 : 4; } }));
      let streak = 0, d = endIso; if (!(by[d] > 0) && weekday(d)) d = add(d, -1);
      for (let n = 0; n < 400; n++) { if (by[d] > 0) streak++; else if (weekday(d)) break; d = add(d, -1); }
      let longest = 0, run = 0; for (let n = weeks * 7; n >= 0; n--) { const x = add(endIso, -n); if (x < start) continue; if (by[x] > 0) { run++; if (run > longest) longest = run; } else if (weekday(x)) run = 0; }
      return { weeks: cols, activeDays: active, totalMin: total, streak, longest, cut };
    }

    /* ---------- vault ---------- */
    return { fuzzyScore, fuzzyRank, commandIndex, parseQuickLog, parseDate, parseMinutes, periodRange, suggestSubject, askHomeroom, weeklyMinutes, whatIf, courseForecast, goalForecast, cumulativeSeries, recordsRadar, heatmap,
      passphraseStrength: VAULT.passphraseStrength, vaultSeal: VAULT.seal, vaultOpen: VAULT.open, vaultLooksLike: VAULT.looksLike, fmtMin, fmtDay };
  }

  const api = { install, fuzzyScore, suggestSubject, parseQuickLog, norm };
  if (NODE) module.exports = api; else SHR.insight = api;
})(typeof window !== 'undefined' ? window : globalThis);
