/* Stark Classroom Hub. All logic as pure functions (no DOM, no storage, no network):
   roster rules, import parsers for the Stark Education Suite file formats, the Quill assignment file, grade maths,
   reports, calendar and class backup. tests/test_hub.py runs these in node. */
(function (root) {
  'use strict';
  const SCH = root.SCH = root.SCH || {};
  const NODE = typeof require === 'function' && typeof module !== 'undefined';
  const CAT = NODE ? require('./catalog.js') : SCH.catalog;
  const TEACH = NODE ? require('./teachlib.js') : SCH.teach;
  const MAX_STUDENTS = 60, MAX_ASSIGN = 200, MAX_EVENTS = 300, MAX_EVID = 400;
  const BACKUP_APP = 'stark-classroomhub-backup';
  const QUILL_ASSIGN_FORMAT = 'stark-quill-assignment', QUILL_SUBMIT_FORMAT = 'stark-quill-submission';
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (v, d) => { const n = typeof v === 'number' ? v : parseFloat(v); return isFinite(n) ? n : (d === undefined ? 0 : d); };
  const round1 = v => Math.round(v * 10) / 10;
  const clip = (s, n) => Array.from(String(s == null ? '' : s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')).slice(0, n).join('').trim();

  /* ---------- roster: first names or nicknames only (same rules as Stark IntraTheater) ---------- */
  const NAME_OK = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;
  function cleanName(raw) {
    const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!s) return { name: '', error: 'empty' };
    if (/[@:/\\]|\d/.test(s)) return { name: '', error: 'Use a first name or nickname, not an email, number or address.' };
    if (s.length > 20) return { name: '', error: 'Keep names to 20 letters or fewer.' };
    if (!NAME_OK.test(s)) return { name: '', error: 'Use letters only (spaces, hyphens and apostrophes are fine).' };
    const w = s.split(' ');
    if (w.length > 2 || (w.length === 2 && !/^[\p{L}]\.?$/u.test(w[1]))) return { name: '', error: 'Use a first name or nickname only, not a full name. Add one initial if two students share a name (Sam K.), or join with a hyphen (Mary-Jane).' };
    return { name: s, error: '' };
  }
  function parseRoster(text, existing, max, fullWhy) {
    const cap = max || MAX_STUDENTS;
    const seen = new Set((existing || []).map(n => String(n).toLowerCase()));
    const add = [], rejected = [];
    String(text || '').split(/[\n\r,;\t]+/).forEach(raw => {
      const r = cleanName(raw);
      if (r.error === 'empty') return;
      if (r.error) { rejected.push({ raw: raw.trim(), why: r.error }); return; }
      const k = r.name.toLowerCase();
      if (seen.has(k)) { rejected.push({ raw: r.name, why: 'Already on the roster.' }); return; }
      if (seen.size >= cap) { rejected.push({ raw: r.name, why: fullWhy || 'The roster is full (' + cap + ' students).' }); return; }
      seen.add(k); add.push(r.name);
    });
    return { add, rejected };
  }
  /* roster: [{id,name}]. Exact name, or (for "Maya Lopez" style entries) a unique first-word match. Never creates a name. */
  function matchStudent(roster, raw) {
    const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().toLowerCase();
    if (!s) return null;
    const ex = (roster || []).filter(r => r.name.toLowerCase() === s);
    if (ex.length === 1) return { id: ex[0].id, how: 'name' };
    const first = s.split(' ')[0];
    if (s.includes(' ')) {
      const f = (roster || []).filter(r => r.name.toLowerCase().split(' ')[0] === first);
      if (f.length === 1) return { id: f[0].id, how: 'first name' };
    }
    return null;
  }

  /* ---------- hashing, JSON in Python's style, ZIP reading ---------- */
  const SHA_K = [], SHA_H = [];
  (function () {
    const primes = []; for (let n = 2; primes.length < 64; n++) { if (primes.every(p => n % p)) primes.push(n); }
    primes.forEach((p, i) => { SHA_K.push(Math.floor((Math.cbrt(p) % 1) * 4294967296) >>> 0); if (i < 8) SHA_H.push(Math.floor((Math.sqrt(p) % 1) * 4294967296) >>> 0); });
  })();
  const toBytes = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
  function sha256(data) {
    const bytes = typeof data === 'string' ? toBytes(data) : data;
    const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6, buf = new Uint8Array(total);
    buf.set(bytes); buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(len / 0x20000000), false); dv.setUint32(total - 4, (len << 3) >>> 0, false);
    const h = SHA_H.slice(), w = new Uint32Array(64);
    const rr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4, false);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0; }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) >>> 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return h.map(x => ('00000000' + x.toString(16)).slice(-8)).join('');
  }
  /* json.dumps(obj, sort_keys=True, ensure_ascii=False) with Python's default separators */
  function pyJSON(v) {
    if (Array.isArray(v)) return '[' + v.map(pyJSON).join(', ') + ']';
    if (isObj(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ': ' + pyJSON(v[k])).join(', ') + '}';
    return JSON.stringify(v);
  }
  function sortDeep(v) { return Array.isArray(v) ? v.map(sortDeep) : isObj(v) ? Object.keys(v).sort().reduce((o, k) => (o[k] = sortDeep(v[k]), o), {}) : v; }

  const ZIP_LIMITS = { entries: 2000, entryBytes: 64 * 1024 * 1024, totalBytes: 256 * 1024 * 1024 };
  /* Reads the central directory only. Returns {entries:[{name,method,csize,usize,offset,dir}]} or {error}. */
  function readZip(u8) {
    if (!(u8 instanceof Uint8Array) || u8.length < 22) return { error: 'not a readable zip' };
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.length);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) return { error: 'not a readable zip' };
    const count = dv.getUint16(eocd + 10, true), cdSize = dv.getUint32(eocd + 12, true), cdOff = dv.getUint32(eocd + 16, true);
    if (count === 0xffff || cdOff === 0xffffffff) return { error: 'zip64 files are not supported' };
    if (count > ZIP_LIMITS.entries) return { error: 'too many files in the zip' };
    if (cdOff + cdSize > eocd) return { error: 'not a readable zip' };
    const dec = new TextDecoder('utf-8'), entries = [];
    let p = cdOff, total = 0;
    for (let i = 0; i < count; i++) {
      if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) return { error: 'the zip is damaged' };
      const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), offset = dv.getUint32(p + 42, true);
      if (flags & 1) return { error: 'encrypted zips are not supported' };
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      if (usize > ZIP_LIMITS.entryBytes) return { error: 'a file inside the zip is too big' };
      total += usize; if (total > ZIP_LIMITS.totalBytes) return { error: 'the zip is too big' };
      entries.push({ name, method, csize, usize, offset, dir: name.endsWith('/') });
      p += 46 + nl + el + cl;
    }
    return { entries };
  }
  /* inflate(u8, limit) -> Promise<Uint8Array>: raw deflate, stopping at limit bytes (the environment supplies it) */
  async function zipData(u8, e, inflate) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.length);
    if (e.offset + 30 > u8.length || dv.getUint32(e.offset, true) !== 0x04034b50) throw new Error('the zip is damaged');
    const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
    if (start + e.csize > u8.length) throw new Error('the zip is damaged');
    const raw = u8.subarray(start, start + e.csize);
    let out;
    if (e.method === 0) out = raw; else if (e.method === 8) out = await inflate(raw, e.usize); else throw new Error('unsupported compression');
    if (out.length !== e.usize) throw new Error('the zip is damaged');
    return out;
  }
  /* Teacher-side check of a Stark Quill hand-in zip. Same checks as quill_schools.verify_submission:
     one folder; SUBMISSION.json, REFLECTION.txt and CHECKSUMS.sha256 present; every file matches its checksum,
     nothing extra and nothing missing. Returns {ok, problems, info, reflection}. */
  async function verifySubmission(u8, inflate) {
    const z = readZip(u8);
    if (z.error) return { ok: false, problems: [z.error], info: {}, reflection: '' };
    const names = z.entries.filter(e => !e.dir);
    const tops = new Set(names.map(e => e.name.split('/')[0]));
    if (tops.size !== 1 || names.some(e => !e.name.includes('/') || /(^|\/)\.\.(\/|$)/.test(e.name))) return { ok: false, problems: ['not a Quill submission (expected one folder)'], info: {}, reflection: '' };
    const top = [...tops][0] + '/', rel = {};
    names.forEach(e => { rel[e.name.slice(top.length)] = e; });
    if (!rel['CHECKSUMS.sha256'] || !rel['SUBMISSION.json'] || !rel['REFLECTION.txt']) return { ok: false, problems: ['not a Quill submission (missing manifest, reflection or checksums)'], info: {}, reflection: '' };
    const problems = [], dec = new TextDecoder('utf-8');
    let info = {}, reflection = '';
    try {
      const listed = {};
      dec.decode(await zipData(u8, rel['CHECKSUMS.sha256'], inflate)).split(/\r?\n/).forEach(line => { const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line); if (m) listed[m[2]] = m[1]; });
      const keys = new Set(Object.keys(listed)); Object.keys(rel).forEach(k => { if (k !== 'CHECKSUMS.sha256') keys.add(k); });
      for (const k of [...keys].sort()) {
        if (!rel[k]) problems.push('missing: ' + k);
        else if (!listed[k]) problems.push('not in the checksum list: ' + k);
        else {
          const data = await zipData(u8, rel[k], inflate);
          if (sha256(data) !== listed[k]) problems.push('changed after it was packed: ' + k);
          if (k === 'REFLECTION.txt') reflection = dec.decode(data);
          if (k === 'SUBMISSION.json') { try { info = JSON.parse(dec.decode(data)); } catch (e) { problems.push('the manifest cannot be read'); } }
        }
      }
    } catch (e) { return { ok: false, problems: [String(e && e.message || 'not a readable zip')], info: {}, reflection: '' }; }
    if (isObj(info) && info.format !== QUILL_SUBMIT_FORMAT) problems.push('the manifest is not a Stark Quill submission');
    if (!isObj(info)) info = {};
    return { ok: problems.length === 0, problems, info, reflection };
  }

  /* ---------- Quill assignment file (.quillassign), byte-compatible with Stark Quill Schools ---------- */
  function isoOk(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return false;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function makeQuillAssignment(title, prompt, wordTarget, due, rubric, teacher) {
    title = clip(title, 200); prompt = clip(prompt, 5000);
    if (!title) throw new Error('Give the assignment a title.');
    if (!prompt) throw new Error('Write the prompt the students will see.');
    let target = 0;
    if (wordTarget !== undefined && wordTarget !== null && wordTarget !== '' && wordTarget !== 0) {
      const ws = String(wordTarget).trim();
      if (!/^-?\d+$/.test(ws)) throw new Error('The word target should be a whole number.');
      target = parseInt(ws, 10);
    }
    if (target < 0 || target > 1000000) throw new Error('The word target should be between 0 and 1,000,000.');
    due = clip(due, 10);
    if (due && !isoOk(due)) throw new Error('The due date should look like 2027-03-01.');
    const items = [];
    (rubric || []).forEach(r => { const t = clip(isObj(r) ? r.text : r, 300); if (t) items.push({ id: 'c' + (items.length + 1), text: t }); });
    if (items.length > 20) throw new Error('A rubric can have up to 20 criteria.');
    const a = { format: QUILL_ASSIGN_FORMAT, version: 1, title, prompt, word_target: target, due, rubric: items, teacher: clip(teacher, 100) };
    a.id = sha256(pyJSON({ title: a.title, prompt: a.prompt, word_target: a.word_target, due: a.due, rubric: a.rubric })).slice(0, 12);
    return a;
  }
  function quillAssignmentFile(a) {
    const stem = (a.title.replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/^[ .]+|[ .]+$/g, '')) || 'Assignment';
    return { filename: stem + '.quillassign', text: JSON.stringify(sortDeep(a), null, 1) + '\n' };
  }
  /* an assignment planner item -> the Quill file for it (or throws a sentence) */
  function quillFor(a, teacher) {
    const q = a.quill || {};
    return makeQuillAssignment(a.title, q.prompt, q.wordTarget, a.due, (a.rubric || []).map(r => r.text), teacher);
  }
  function readQuillAssignment(text) {
    let d; try { d = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) { throw new Error('That is not a Quill assignment file.'); }
    if (!isObj(d) || d.format !== QUILL_ASSIGN_FORMAT || !Array.isArray(d.rubric)) throw new Error('That is not a Quill assignment file.');
    return makeQuillAssignment(d.title, d.prompt, d.word_target, d.due, d.rubric.map(r => isObj(r) ? r.text : r), d.teacher);
  }

  /* ---------- CSV ---------- */
  function csvCell(v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    const s = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => !(r.length === 1 && r[0] === ''));
  }
  const unguard = v => String(v == null ? '' : v).replace(/^'(?=[=+\-@\t\r])/, '');

  /* ---------- evidence: what a student's files say, per source ---------- */
  const SOURCES = { intra: 'IntraTheater', quill: 'Quill', world: 'World Engine', math: 'Math' };
  const GEO_T = { capital: 'capitals', continent: 'continents', flag: 'flags' };
  function quizLabel(key) {
    let m = /^geo-(capital|continent|flag)-(kid|grown)$/.exec(key);
    if (m) return 'Geography: ' + GEO_T[m[1]] + (m[2] === 'kid' ? ' (kids)' : ' (all countries)');
    m = /^math-(\d)$/.exec(key); if (m) return 'Maths Garden: level ' + m[1];
    m = /^lang-([a-z]{2})$/.exec(key); if (m) return 'Languages: ' + m[1].toUpperCase() + ' word game';
    return ({ 'sci-kids': 'Science quiz (kids)', 'sci-grown': 'Science quiz (grown-up level)', 'sci-elements': 'Science: elements quiz', 'art-kids': 'Art and Music quiz (kids)', 'art-grown': 'Art and Music quiz (grown-up level)', 'art-works': 'Art and Music: works quiz',
      'math-frac': 'Math: fractions', 'math-tables': 'Math: times tables', 'math-shapes': 'Math: shapes and angles', 'math-graph': 'Math: graphs', 'hist-kids': 'History: family quiz', 'hist-first': 'History: which came first', 'hist-first-hard': 'History: which came first (hard)', 'hist-hard': 'History: hard', 'hard-trivia': 'Hard trivia' })[key] || clip(key, 60);
  }
  const lessonTitle = id => { const l = CAT.INTRA.find(x => x.id === id); return l ? l.title : ''; };
  function intraEvidence(o) {
    const lessons = (o.lessons || []).map(t => clip(t, 120)).filter(Boolean).slice(0, 60);
    const quizzes = (o.quizzes || []).slice(0, 60).map(q => ({ label: clip(q.label, 80), pct: clamp(Math.round(num(q.pct)), 0, 100) }));
    const avg = quizzes.length ? Math.round(quizzes.reduce((a, q) => a + q.pct, 0) / quizzes.length) : null;
    const bits = [lessons.length + (lessons.length === 1 ? ' lesson' : ' lessons') + ' completed', Math.max(0, Math.round(num(o.stars))) + ' stars'];
    if (avg !== null) bits.push('quiz average ' + avg + '%');
    return { key: 'intra', source: 'intra', label: 'IntraTheater progress', value: avg, detail: bits.join(', '),
      data: { stars: Math.max(0, Math.round(num(o.stars))), explored: Math.max(0, Math.round(num(o.explored))), lessons, quizzes } };
  }
  /* IntraTheater "Progress report" CSV (classlib.reportCSV) */
  function parseIntraCSV(text) {
    const rows = parseCSV(text);
    if (!rows.length || rows[0][0] !== 'Student' || rows[0].indexOf('Average best quiz %') < 0 || rows[0].indexOf('Lesson titles') < 0) return { ok: false, error: 'This does not look like a Stark IntraTheater progress CSV.', records: [], problems: [] };
    const head = rows[0], col = n => head.indexOf(n);
    const cs = col('Stars'), ce = col('Moments explored'), cl = col('Lesson titles');
    const qcols = head.map((h, i) => /^(.+) best %$/.exec(h) ? { i, label: /^(.+) best %$/.exec(h)[1] } : null).filter(Boolean);
    const records = [], problems = [];
    if (rows.length - 1 > 200) return { ok: false, error: 'That CSV has more than 200 rows.', records: [], problems: [] };
    rows.slice(1).forEach((r, k) => {
      const n = cleanName(unguard(r[0]));
      const quizzes = qcols.filter(c => r[c.i] !== undefined && r[c.i] !== '').map(c => ({ label: unguard(c.label), pct: num(r[c.i]) }));
      const ev = intraEvidence({ stars: num(r[cs]), explored: num(r[ce]), lessons: unguard(r[cl]).split(/;\s*/).filter(Boolean), quizzes });
      if (n.error) problems.push('Row ' + (k + 2) + ': the name is not a first name or nickname, so it cannot be added to the roster.');
      records.push({ name: n.name || clip(unguard(r[0]), 20), nameOk: !n.error, ev });
    });
    return { ok: true, error: '', records, problems };
  }
  /* IntraTheater class backup JSON (classlib.buildBackup), validated like classlib.readBackup */
  function parseIntraBackup(o) {
    if (!isObj(o) || o.app !== 'stark-intratheater-class' || !Array.isArray(o.students)) return { ok: false, error: 'This file is not a Stark IntraTheater class backup.', records: [], problems: [] };
    if (o.students.length > MAX_STUDENTS) return { ok: false, error: 'This backup has more than ' + MAX_STUDENTS + ' students.', records: [], problems: [] };
    const records = [], problems = [], ids = new Set();
    o.students.forEach((s, k) => {
      if (!isObj(s) || typeof s.id !== 'string' || !/^kid[a-z0-9]{1,24}$/i.test(s.id) || ids.has(s.id)) { problems.push('Student entry ' + (k + 1) + ' is damaged and was skipped.'); return; }
      ids.add(s.id);
      const n = cleanName(s.name);
      const p = isObj(o.progress) && isObj(o.progress[s.id]) ? o.progress[s.id] : {};
      const best = isObj(p.best) ? p.best : {};
      const quizzes = Object.keys(best).sort().filter(key => isObj(best[key]) && num(best[key].total) > 0).map(key => ({ label: quizLabel(key), pct: Math.round(100 * num(best[key].score) / num(best[key].total)) }));
      const lessons = (Array.isArray(p.lessons) ? p.lessons : []).filter(x => typeof x === 'string').map(id => lessonTitle(id)).filter(Boolean);
      const ev = intraEvidence({ stars: num(p.stars), explored: Array.isArray(p.seen) ? p.seen.length : 0, lessons, quizzes });
      ev.data.lessonIds = (Array.isArray(p.lessons) ? p.lessons : []).filter(x => typeof x === 'string' && x.length < 60).slice(0, 60);
      if (n.error) problems.push('Student entry ' + (k + 1) + ': the name is not a first name or nickname, so it cannot be added to the roster.');
      records.push({ name: n.name || clip(s.name, 20), nameOk: !n.error, ev });
    });
    return { ok: true, error: '', records, problems };
  }
  /* Quill hand-in: the verified result of verifySubmission */
  function quillEvidence(v) {
    const i = v.info || {}, a = isObj(i.assignment) ? i.assignment : {}, rub = isObj(i.rubric) ? i.rubric : null;
    const words = Math.max(0, Math.round(num(i.words))), target = Math.max(0, Math.round(num(i.word_target)));
    const title = clip(i.book_title, 120) || 'Untitled book', at = clip(a.title, 120), aid = clip(a.id, 24);
    const bits = [words + ' words' + (target ? ' of ' + target : '')];
    if (rub && num(rub.total) > 0) bits.push('rubric self-check ' + num(rub.done) + '/' + num(rub.total));
    const rw = Math.max(0, Math.round(num(i.reflection_words))); bits.push('reflection ' + rw + ' words');
    return { key: 'quill:' + (aid || 't:' + title.toLowerCase()), source: 'quill', label: 'Quill: ' + (at || title), value: null, detail: bits.join(', '),
      data: { title, words, target, assignmentId: aid, assignmentTitle: at, due: clip(a.due, 10), rubricDone: rub ? Math.round(num(rub.done)) : 0, rubricTotal: rub ? Math.round(num(rub.total)) : 0,
        selfDone: rub ? clip(JSON.stringify((Array.isArray(rub.criteria) ? rub.criteria : []).filter(c => isObj(c) && c.done).map(c => clip(c.text, 100))), 800) : '[]',
        reflection: clip(v.reflection, 1500), created: clip(i.created, 20) } };
  }
  function parseQuillVerified(v) {
    if (!v.ok) return { ok: false, error: 'This hand-in failed the integrity check: ' + v.problems.slice(0, 3).join('; ') + '. It was not imported.', records: [], problems: v.problems };
    const n = cleanName(v.info.student);
    return { ok: true, error: '', records: [{ name: n.name || clip(v.info.student, 20), nameOk: !n.error, ev: quillEvidence(v) }], problems: [] };
  }
  /* World Engine _REFLECTION.txt (stark_classroom.reflection_text) */
  function parseWorldReflection(text) {
    const t = String(text || '');
    if (t.length > 60000) return { ok: false, error: 'That reflection file is too big.', records: [], problems: [] };
    const lines = t.replace(/\r/g, '').split('\n');
    if (!/^Reflection: /.test(lines[0] || '') || !/^Student: /.test(lines[1] || '')) return { ok: false, error: 'This is not a Stark World Engine reflection file.', records: [], problems: [] };
    const field = p => { const l = lines.find(x => x.startsWith(p)); return l ? l.slice(p.length).trim() : ''; };
    const game = clip(lines[0].slice(12), 80), student = field('Student: '), lesson = field('Lesson: ');
    const counts = {}; (/Levels: (\d+)\s+Objects: (\d+)\s+Quests: (\d+)\s+Custom items: (\d+)/.exec(t) || []).slice(1).forEach((v, i) => { counts[['levels', 'objects', 'quests', 'items'][i]] = +v; });
    const checker = field('Checker: '), clean = /^no problems found/.test(checker);
    const issues = lines.filter(l => /^ {4}- /.test(l)).map(l => clip(l.slice(6), 160)).slice(0, 12);
    const qa = []; lines.forEach((l, i) => { const m = /^(\d+)\. (.+)$/.exec(l); if (m) qa.push({ q: clip(m[2], 200), a: clip((lines[i + 1] || '').replace(/^ {3}/, ''), 400) }); });
    const answered = qa.filter(x => x.a && x.a !== '(no answer)').length;
    const pack = CAT.WORLD.find(p => p.title === lesson) || null;
    const nm = student === '(not given)' ? '' : cleanName(student);
    const pl = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
    const bits = [pl(counts.objects || 0, 'object'), pl(counts.quests || 0, 'quest'), clean ? 'checker clean' : pl(issues.length, 'checker note'), 'answered ' + answered + ' of ' + qa.length];
    const ev = { key: 'world:' + (pack ? pack.id : 'g:' + game.toLowerCase()), source: 'world', label: 'World Engine: ' + (lesson || game), value: qa.length ? Math.round(100 * answered / qa.length) : null, detail: bits.join(', '),
      data: { game, lesson, packId: pack ? pack.id : '', counts, checkerClean: clean, issues, answers: qa, answered, free: clip(field('Free write: '), 600), date: clip(field('Date: '), 10) } };
    return { ok: true, error: '', records: [{ name: nm && !nm.error ? nm.name : clip(student === '(not given)' ? '' : student, 20), nameOk: !!nm && !nm.error, ev }],
      problems: student === '(not given)' ? ['This reflection has no student name; choose the student yourself.'] : [] };
  }
  /* Stark Math: a signed result file (stark-math-result) or a leaderboard CSV. Signatures need the event pack, so they are flagged unchecked. */
  function mathEvidence(o) {
    return { key: 'math:' + clip(o.code, 40), source: 'math', label: 'Math: ' + (clip(o.title, 80) || clip(o.code, 40)), value: o.pct === undefined ? null : o.pct,
      detail: o.points + ' points' + (o.correct !== undefined ? ', ' + o.correct + ' correct' : '') + (o.pct !== undefined && o.pct !== null ? ' (' + o.pct + '%)' : '') + (o.signed ? ', signature not checked here' : ''),
      data: { code: clip(o.code, 40), points: o.points, correct: o.correct === undefined ? 0 : o.correct, level: clip(o.level, 30), team: clip(o.team, 30) } };
  }
  function parseMathResult(o) {
    if (!isObj(o) || o.format !== 'stark-math-result' || !isObj(o.player) || !isObj(o.totals)) return { ok: false, error: 'This is not a Stark Math result file.', records: [], problems: [] };
    const n = cleanName(o.player.name), tot = num(o.answers && o.answers.length, 0);
    const correct = Math.max(0, Math.round(num(o.totals.correct)));
    const ev = mathEvidence({ code: o.code, title: o.title, points: Math.round(num(o.totals.points)), correct, pct: tot ? clamp(Math.round(100 * correct / tot), 0, 100) : undefined, level: ['Level ' + num(o.player.level)][0], team: o.player.team, signed: true });
    return { ok: true, error: '', records: [{ name: n.name || clip(o.player.name, 20), nameOk: !n.error, ev }], problems: ['Stark Math signs result files with the event pack; open the event in Stark Math to verify the signature.'] };
  }
  function parseMathCSV(text) {
    const rows = parseCSV(text), h = rows[0] || [];
    if (h[0] !== 'Rank' || h[1] !== 'Name' || h.indexOf('Points') < 0 || h.indexOf('Correct') < 0) return { ok: false, error: 'This is not a Stark Math leaderboard CSV.', records: [], problems: [] };
    const ci = n => h.indexOf(n), records = [];
    if (rows.length - 1 > 200) return { ok: false, error: 'That CSV has more than 200 rows.', records: [], problems: [] };
    rows.slice(1).forEach(r => {
      const n = cleanName(unguard(r[1]));
      records.push({ name: n.name || clip(unguard(r[1]), 20), nameOk: !n.error, ev: mathEvidence({ code: 'leaderboard', title: 'Contest leaderboard', points: Math.round(num(r[ci('Points')])), correct: Math.round(num(r[ci('Correct')])), level: unguard(r[ci('Level')]), team: unguard(r[ci('Team')]) }) });
    });
    return { ok: true, error: '', records, problems: [] };
  }
  /* Which importer a text file needs. kind: intra-csv | math-csv | intra-backup | math-result | quill-assign | world | '' */
  function classifyText(name, text) {
    const n = String(name || '').toLowerCase(), t = String(text || '').replace(/^\uFEFF/, '');
    if (n.endsWith('.quillassign')) return 'quill-assign';
    if (n.endsWith('.csv')) { const h = t.split(/\r?\n/, 1)[0]; return /^Rank,Name,/.test(h) ? 'math-csv' : /^Student,/.test(h) ? 'intra-csv' : ''; }
    if (n.endsWith('.json')) {
      let o; try { o = JSON.parse(t); } catch (e) { return ''; }
      if (isObj(o) && o.app === 'stark-intratheater-class') return 'intra-backup';
      if (isObj(o) && o.format === 'stark-math-result') return 'math-result';
      if (isObj(o) && o.format === QUILL_ASSIGN_FORMAT) return 'quill-assign';
      if (isObj(o) && o.app === BACKUP_APP) return 'hub-backup';
      return '';
    }
    if (n.endsWith('.txt') && /^Reflection: /.test(t)) return 'world';
    return '';
  }
  function parseText(kind, text) {
    if (kind === 'intra-csv') return parseIntraCSV(text);
    if (kind === 'math-csv') return parseMathCSV(text);
    let o = null; if (kind === 'intra-backup' || kind === 'math-result') { try { o = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) { return { ok: false, error: 'That file is not valid JSON.', records: [], problems: [] }; } }
    if (kind === 'intra-backup') return parseIntraBackup(o);
    if (kind === 'math-result') return parseMathResult(o);
    if (kind === 'world') return parseWorldReflection(text);
    return { ok: false, error: 'The Hub does not recognise this file.', records: [], problems: [] };
  }

  /* ---------- state ---------- */
  const rnd36 = n => { const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null; if (c && c.getRandomValues) return Array.from(c.getRandomValues(new Uint8Array(n)), x => (x % 36).toString(36)).join(''); let s = ''; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 36).toString(36); return s; };
  const uid = (p, used) => { let id; do { id = p + rnd36(6); } while (used && used.has(id)); return id; };
  function emptyState() { return Object.assign({ app: 'stark-classroomhub', version: 1, classroom: { name: '', teacher: '', termName: '', termStart: '', termEnd: '' }, students: [], assignments: [], evidence: {}, grades: {}, events: [], lastBackup: '' }, api.emptyExtra()); }
  function sanitizeState(o) {
    const s = emptyState();
    if (!isObj(o)) return s;
    const c = isObj(o.classroom) ? o.classroom : {};
    s.classroom = { name: clip(c.name, 60), teacher: clip(c.teacher, 40), termName: clip(c.termName, 40), termStart: isoOk(c.termStart) ? c.termStart : '', termEnd: isoOk(c.termEnd) ? c.termEnd : '' };
    const sids = new Set();
    (Array.isArray(o.students) ? o.students : []).slice(0, MAX_STUDENTS).forEach(x => {
      if (!isObj(x) || typeof x.id !== 'string' || !/^s[a-z0-9]{2,24}$/.test(x.id) || sids.has(x.id)) return;
      const n = cleanName(x.name); if (n.error || s.students.some(y => y.name.toLowerCase() === n.name.toLowerCase())) return;
      sids.add(x.id); s.students.push({ id: x.id, name: n.name });
    });
    const aids = new Set();
    (Array.isArray(o.assignments) ? o.assignments : []).slice(0, MAX_ASSIGN).forEach(a => {
      if (!isObj(a) || typeof a.id !== 'string' || !/^a[a-z0-9]{2,24}$/.test(a.id) || aids.has(a.id)) return;
      const title = clip(a.title, 120); if (!title) return;
      aids.add(a.id);
      const rub = []; const rids = new Set();
      (Array.isArray(a.rubric) ? a.rubric : []).slice(0, 20).forEach(r => { if (!isObj(r)) return; const t = clip(r.text, 300); const id = typeof r.id === 'string' && /^c\d{1,3}$/.test(r.id) && !rids.has(r.id) ? r.id : null; if (t && id) { rids.add(id); rub.push({ id, text: t, max: clamp(Math.round(num(r.max, 4)), 1, 100) }); } });
      const q = isObj(a.quill) ? { prompt: clip(a.quill.prompt, 5000), wordTarget: clamp(Math.round(num(a.quill.wordTarget)), 0, 1000000) } : null;
      s.assignments.push(api.sanitizeAssignmentExtra(a, { id: a.id, title, due: isoOk(a.due) ? a.due : '', notes: clip(a.notes, 600), weight: clamp(num(a.weight, 1), 0.5, 10), rubric: rub, quill: q,
        intra: (Array.isArray(a.intra) ? a.intra : []).filter(i => CAT.INTRA.some(l => l.id === i)).slice(0, 40),
        world: (Array.isArray(a.world) ? a.world : []).filter(i => CAT.WORLD.some(l => l.id === i)).slice(0, 10) }, sids));
    });
    if (isObj(o.grades)) Object.keys(o.grades).forEach(aid => {
      const a = s.assignments.find(x => x.id === aid); if (!a || !isObj(o.grades[aid])) return;
      Object.keys(o.grades[aid]).forEach(sid => {
        const g = o.grades[aid][sid]; if (!sids.has(sid) || !isObj(g)) return;
        const scores = {}; if (isObj(g.scores)) a.rubric.forEach(r => { const v = g.scores[r.id]; if (typeof v === 'number' && isFinite(v)) scores[r.id] = clamp(Math.round(v * 2) / 2, 0, r.max); });
        const comment = clip(g.comment, 1000);
        if (Object.keys(scores).length || comment) { (s.grades[aid] = s.grades[aid] || {})[sid] = { scores, comment }; }
      });
    });
    if (isObj(o.evidence)) Object.keys(o.evidence).forEach(sid => {
      if (!sids.has(sid) || !Array.isArray(o.evidence[sid])) return;
      const seen = new Set(), list = [];
      o.evidence[sid].slice(0, MAX_EVID).forEach(e => {
        if (!isObj(e) || !SOURCES[e.source] || typeof e.key !== 'string' || e.key.length > 140 || seen.has(e.key)) return;
        seen.add(e.key);
        list.push({ key: e.key, source: e.source, label: clip(e.label, 160), value: e.value === null || e.value === undefined ? null : clamp(Math.round(num(e.value)), 0, 100), detail: clip(e.detail, 300), when: isoOk(e.when) ? e.when : '', data: isObj(e.data) && JSON.stringify(e.data).length < 12000 ? e.data : {} });
      });
      if (list.length) s.evidence[sid] = list;
    });
    const eids = new Set();
    (Array.isArray(o.events) ? o.events : []).slice(0, MAX_EVENTS).forEach(e => {
      if (!isObj(e) || typeof e.id !== 'string' || !/^e[a-z0-9]{2,24}$/.test(e.id) || eids.has(e.id) || !isoOk(e.date)) return;
      const title = clip(e.title, 80); if (!title) return; eids.add(e.id);
      s.events.push({ id: e.id, date: e.date, title, kind: ['holiday', 'test', 'trip', 'other'].includes(e.kind) ? e.kind : 'other' });
    });
    s.lastBackup = clip(o.lastBackup, 30);
    return api.sanitizeExtra(o, s);
  }
  function addStudents(state, names, max, fullWhy) { const r = parseRoster(names, state.students.map(s => s.name), max, fullWhy); const used = new Set(state.students.map(s => s.id)); r.add.forEach(n => { const id = uid('s', used); used.add(id); state.students.push({ id, name: n }); }); return r; }
  function removeStudent(state, sid) { state.students = state.students.filter(s => s.id !== sid); delete state.evidence[sid]; Object.keys(state.grades).forEach(a => { delete state.grades[a][sid]; }); api.removeStudentExtra(state, sid); }
  function newAssignment(state, o) {
    const used = new Set(state.assignments.map(a => a.id)), id = uid('a', used);
    const raw = (o.rubric || []).map(r => (typeof r === 'string' ? { text: r } : r)).filter(r => clip(r.text, 300)).map((r, i) => Object.assign({}, r, { id: 'c' + (i + 1) }));
    const rub = raw.map(r => ({ id: r.id, text: clip(r.text, 300), max: clamp(Math.round(num(r.max, 4)), 1, 100) }));
    const a = { id, title: clip(o.title, 120), due: isoOk(o.due) ? o.due : '', notes: clip(o.notes, 600), weight: clamp(num(o.weight, 1), 0.5, 10), rubric: rub, quill: o.quill ? { prompt: clip(o.quill.prompt, 5000), wordTarget: clamp(Math.round(num(o.quill.wordTarget)), 0, 1000000) } : null, intra: (o.intra || []).slice(), world: (o.world || []).slice() };
    if (!a.title) throw new Error('Give the assignment a title.');
    api.sanitizeAssignmentExtra({ rubric: raw, tiers: o.tiers, accom: o.accom }, a, new Set(state.students.map(s => s.id)));
    state.assignments.push(a); return a;
  }
  /* body: an assignment without an id (rubric already in {id,text,max} form); returns the stored assignment */
  function pushAssignment(state, body) { const a = sanitizeState({ students: [], assignments: [Object.assign({ id: uid('a', new Set(state.assignments.map(x => x.id))) }, body)] }).assignments[0]; if (!a) throw new Error('Give the assignment a title.'); state.assignments.push(a); return a; }
  /* records: [{sid, ev}] (already matched); a repeat import of the same file replaces the older evidence */
  function applyImport(state, items, whenIso) {
    let n = 0;
    items.forEach(it => {
      if (!state.students.some(s => s.id === it.sid)) return;
      const list = state.evidence[it.sid] = state.evidence[it.sid] || [];
      const e = Object.assign({}, it.ev, { when: whenIso || '' });
      const i = list.findIndex(x => x.key === e.key);
      if (i >= 0) list[i] = e; else if (list.length < MAX_EVID) list.push(e); else return;
      n++;
    });
    return n;
  }

  /* ---------- grades ---------- */
  function rubricResult(a, g) {
    let got = 0, max = 0, n = 0; const crit = (a && a.rubric) || [];
    crit.forEach(c => { const v = g && g.scores ? g.scores[c.id] : undefined; if (typeof v === 'number' && isFinite(v)) { got += clamp(v, 0, c.max); max += c.max; n++; } });
    return { pct: max > 0 ? round1(100 * got / max) : null, got, max, scored: n, total: crit.length, complete: crit.length > 0 && n === crit.length };
  }
  const band = p => (p === null || p === undefined ? 'Not graded yet' : p >= 85 ? 'Exceeding' : p >= 70 ? 'Meeting' : p >= 50 ? 'Approaching' : 'Beginning');
  const letter = p => (p === null || p === undefined ? '' : p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F');
  function finalGrade(state, sid) {
    let sum = 0, w = 0, graded = 0;
    state.assignments.forEach(a => { const r = rubricResult(a, (state.grades[a.id] || {})[sid]); if (r.pct !== null) { sum += r.pct * a.weight; w += a.weight; graded++; } });
    const pct = w > 0 ? round1(sum / w) : null;
    return { pct, graded, total: state.assignments.length, band: band(pct), letter: letter(pct) };
  }
  function stats(values) {
    const v = values.filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return { n: 0, mean: null, median: null, min: null, max: null };
    const mid = v.length >> 1;
    return { n: v.length, mean: round1(v.reduce((a, b) => a + b, 0) / v.length), median: v.length % 2 ? v[mid] : round1((v[mid - 1] + v[mid]) / 2), min: v[0], max: v[v.length - 1] };
  }
  function assignmentStats(state, a) { return stats(state.students.map(s => rubricResult(a, (state.grades[a.id] || {})[s.id]).pct)); }
  function assignmentEvidence(state, sid, a) {
    const ev = state.evidence[sid] || [], parts = [];
    const intra = ev.find(e => e.key === 'intra');
    (a.intra || []).forEach(id => {
      const t = lessonTitle(id), d = intra && intra.data ? intra.data : {};
      const done = !!intra && ((d.lessonIds || []).indexOf(id) >= 0 || (d.lessons || []).some(x => x.toLowerCase() === t.toLowerCase()));
      parts.push({ type: 'intra', label: 'IntraTheater: ' + t, status: done ? 'done' : 'missing' });
    });
    (a.world || []).forEach(id => { const e = ev.find(x => x.key === 'world:' + id), p = CAT.WORLD.find(x => x.id === id); parts.push({ type: 'world', label: 'World Engine: ' + (p ? p.title : id), status: e ? (e.value !== null && e.value < 100 ? 'partial' : 'done') : 'missing' }); });
    if (a.quill) {
      let qid = ''; try { qid = quillFor(a, '').id; } catch (e) { qid = ''; }
      const e = ev.find(x => x.source === 'quill' && ((qid && x.data.assignmentId === qid) || (x.data.assignmentTitle && x.data.assignmentTitle.toLowerCase() === a.title.toLowerCase())));
      parts.push({ type: 'quill', label: 'Quill hand-in', status: e ? 'done' : 'missing', detail: e ? e.detail : '', reflection: e ? e.data.reflection || '' : '' });
    }
    const done = parts.filter(p => p.status === 'done').length + 0.5 * parts.filter(p => p.status === 'partial').length;
    return { parts, done, total: parts.length, pct: parts.length ? Math.round(100 * done / parts.length) : null };
  }

  /* ---------- reports ---------- */
  function studentReport(state, sid) {
    const st = state.students.find(s => s.id === sid); if (!st) return null;
    const rows = [], crits = [];
    state.assignments.forEach(a => {
      const g = (state.grades[a.id] || {})[sid] || {}, r = rubricResult(a, g), ev = assignmentEvidence(state, sid, a);
      const rub = a.rubric.map(c => ({ text: c.text, max: c.max, score: typeof (g.scores || {})[c.id] === 'number' ? g.scores[c.id] : null }));
      rub.forEach(c => { if (c.score !== null) crits.push({ text: c.text, ratio: c.score / c.max, assignment: a.title }); });
      rows.push({ id: a.id, title: a.title, due: a.due, pct: r.pct, band: band(r.pct), comment: g.comment || '', rubric: rub, parts: ev.parts, completion: ev.pct });
    });
    crits.sort((x, y) => y.ratio - x.ratio);
    const strengths = crits.filter(c => c.ratio >= 0.85).slice(0, 3), next = crits.slice().reverse().filter(c => c.ratio < 0.7).slice(0, 3);
    return { name: st.name, classroom: state.classroom.name, teacher: state.classroom.teacher, term: state.classroom.termName, final: finalGrade(state, sid), rows, strengths, next, evidence: (state.evidence[sid] || []).slice() };
  }
  /* a warm plain-language note for families: no scores jargon, no other students */
  function parentSummary(r) {
    const L = [];
    const who = r.name;
    L.push('Progress note for ' + who + (r.classroom ? ' (' + r.classroom + (r.term ? ', ' + r.term : '') + ')' : ''));
    L.push('');
    if (r.final.pct === null) L.push(who + ' has no marked work yet, so there is no overall picture to share. Here is what they have been doing.');
    else L.push('Overall, ' + who + ' is ' + ({ Exceeding: 'doing very well and going beyond what we expect', Meeting: 'doing well and meeting what we expect', Approaching: 'getting close to what we expect and still building skills', Beginning: 'at the start of this learning and needs steady support' })[r.final.band] + ' (' + Math.round(r.final.pct) + '%, ' + r.final.band + ').');
    const done = r.rows.filter(x => x.pct !== null);
    if (done.length) { L.push(''); L.push('Marked work:'); done.forEach(x => L.push('- ' + x.title + ': ' + Math.round(x.pct) + '% (' + x.band + ')' + (x.comment ? '. ' + x.comment : ''))); }
    const intra = r.evidence.find(e => e.key === 'intra');
    const extras = r.evidence.filter(e => e.key !== 'intra');
    if (intra || extras.length) {
      L.push(''); L.push('Learning in the Stark apps:');
      if (intra) L.push('- Theater lessons and quizzes: ' + intra.detail + '.');
      extras.forEach(e => L.push('- ' + e.label + ': ' + e.detail + '.'));
    }
    if (r.strengths.length) { L.push(''); L.push('Going well: ' + r.strengths.map(c => c.text.replace(/[.!]+$/, '')).join('; ') + '.'); }
    if (r.next.length) { L.push(''); L.push('Next steps to practise at home: ' + r.next.map(c => c.text.replace(/[.!]+$/, '')).join('; ') + '.'); }
    L.push(''); L.push('Everything in this note stays on the teacher\'s computer unless it is shared with you.');
    if (r.teacher) { L.push(''); L.push(r.teacher); }
    return L.join('\n');
  }
  /* unified grade book as a CSV: one row per student, one column per assignment */
  function gradebookCSV(state) {
    const head = ['Student'].concat(state.assignments.map(a => a.title + ' %'), ['Overall %', 'Band']);
    const lines = [head.map(csvCell).join(',')];
    state.students.forEach(s => {
      const f = finalGrade(state, s.id);
      lines.push([s.name].concat(state.assignments.map(a => { const r = rubricResult(a, (state.grades[a.id] || {})[s.id]); return r.pct === null ? '' : r.pct; }), [f.pct === null ? '' : f.pct, f.band]).map(csvCell).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  /* ---------- calendar ---------- */
  const pad = n => (n < 10 ? '0' : '') + n;
  const isoOf = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const parseIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); };
  function addDays(iso, n) { const d = parseIso(iso); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); }
  /* weekStart: 1 = Monday, 0 = Sunday. Returns rows of 7 {iso, day, inMonth}. */
  function monthGrid(year, month0, weekStart) {
    const first = new Date(Date.UTC(year, month0, 1)), lead = (first.getUTCDay() - weekStart + 7) % 7;
    const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate(), weeks = Math.ceil((lead + days) / 7), out = [];
    const start = new Date(Date.UTC(year, month0, 1 - lead));
    for (let w = 0; w < weeks; w++) { const row = []; for (let d = 0; d < 7; d++) { const x = new Date(start.getTime() + (w * 7 + d) * 86400000); row.push({ iso: isoOf(x), day: x.getUTCDate(), inMonth: x.getUTCMonth() === month0 }); } out.push(row); }
    return out;
  }
  function termWeek(state, iso) {
    const c = state.classroom; if (!c.termStart || !c.termEnd || iso < c.termStart || iso > c.termEnd) return 0;
    return Math.floor((parseIso(iso) - parseIso(c.termStart)) / 86400000 / 7) + 1;
  }
  const termWeeks = state => (state.classroom.termStart && state.classroom.termEnd && state.classroom.termEnd >= state.classroom.termStart ? termWeek(state, state.classroom.termEnd) : 0);
  /* everything on a date: assignment due dates, term start/end, the teacher's own events */
  function calendarItems(state) {
    const by = {}, put = (d, it) => { if (d) (by[d] = by[d] || []).push(it); };
    state.assignments.forEach(a => put(a.due, { kind: 'due', title: 'Due: ' + a.title }));
    state.events.forEach(e => put(e.date, { kind: e.kind, title: e.title, id: e.id }));
    (state.units || []).forEach(u => { put(u.start, { kind: 'unit', title: 'Unit starts: ' + u.title, id: u.id }); if (u.end !== u.start) put(u.end, { kind: 'unit', title: 'Unit ends: ' + u.title, id: u.id }); });
    (state.plans || []).forEach(p => put(p.date, { kind: 'lesson', title: 'Lesson: ' + p.title, id: p.id }));
    put(state.classroom.termStart, { kind: 'term', title: 'Term starts' }); put(state.classroom.termEnd, { kind: 'term', title: 'Term ends' });
    return by;
  }

  /* ---------- class backup ---------- */
  const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
  function unsafeKeys(v, depth) {
    if (depth > 12) return true;
    if (Array.isArray(v)) { if (v.length > 50000) return true; return v.some(x => unsafeKeys(x, depth + 1)); }
    if (v && typeof v === 'object') { const ks = Object.getOwnPropertyNames(v); if (ks.length > 50000) return true; return ks.some(k => BAD_KEYS.indexOf(k) >= 0 || unsafeKeys(v[k], depth + 1)); }
    return false;
  }
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  /* appVersion (1.1 and later) makes an older Hub refuse the file instead of silently dropping the newer parts */
  function buildBackup(state, savedIso) { const data = sanitizeState(state); return { app: BACKUP_APP, version: 1, appVersion: TEACH.VERSION, saved: savedIso || '', data, sha256: sha256(canon(data)) }; }
  function readBackup(o) {
    if (!isObj(o) || o.app !== BACKUP_APP || o.version !== 1 || !isObj(o.data)) return { ok: false, error: 'This file is not a Stark Classroom Hub backup.' };
    if (Object.keys(o).some(k => ['app', 'version', 'appVersion', 'saved', 'data', 'sha256'].indexOf(k) < 0)) return { ok: false, error: 'This backup has unexpected content, so it was not restored.' };
    if (o.appVersion !== undefined && (typeof o.appVersion !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(o.appVersion))) return { ok: false, error: 'This backup is damaged, so it was not restored.' };
    if (unsafeKeys(o, 0)) return { ok: false, error: 'This backup has unsafe or oversized content, so it was not restored.' };
    if (o.saved !== undefined && (typeof o.saved !== 'string' || o.saved.length > 40)) return { ok: false, error: 'This backup is damaged, so it was not restored.' };
    let note = 'no checksum, validated';
    if (o.sha256 !== undefined) {
      if (typeof o.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(o.sha256) || sha256(canon(o.data)) !== o.sha256) return { ok: false, error: 'This backup fails its integrity check (it was changed or damaged), so nothing was restored.' };
      note = 'checksum verified';
    }
    for (const k of ['students', 'assignments', 'events']) { if (o.data[k] !== undefined && !Array.isArray(o.data[k])) return { ok: false, error: 'This backup is damaged, so it was not restored.' }; }
    if (Array.isArray(o.data.students) && o.data.students.length > MAX_STUDENTS) return { ok: false, error: 'This backup has more than ' + MAX_STUDENTS + ' students.' };
    for (const s of Array.isArray(o.data.students) ? o.data.students : []) { if (!isObj(s) || cleanName(s.name).error) return { ok: false, error: 'A student name in this file is not a first name or nickname.' }; }
    return { ok: true, error: '', note, state: sanitizeState(o.data) };
  }

  /* ---------- crash-safe browser storage (storage = localStorage or any object with getItem/setItem/removeItem) ---------- */
  function parseStored(raw) {
    if (typeof raw !== 'string' || !raw || raw.length > 40 * 1024 * 1024) return null;
    let o; try { o = JSON.parse(raw); } catch (e) { return null; }
    if (!isObj(o) || o.app !== 'stark-classroomhub' || o.version !== 1 || unsafeKeys(o, 0)) return null;
    for (const k of ['students', 'assignments', 'events']) { if (o[k] !== undefined && !Array.isArray(o[k])) return null; }
    return sanitizeState(o);
  }
  /* returns { ok, good } ; writes main, reads it back, keeps the previous verified copy at key.bak */
  function storeSave(storage, key, state, lastGood) {
    let json, prev = null;
    try { json = JSON.stringify(state); prev = storage.getItem(key); storage.setItem(key, json); if (storage.getItem(key) !== json) { try { if (prev !== null) storage.setItem(key, prev); } catch (e2) { /* keep going */ } return { ok: false, good: lastGood }; } } catch (e) { return { ok: false, good: lastGood }; }
    if (lastGood && lastGood !== json) { try { storage.setItem(key + '.bak', lastGood); } catch (e) { /* the main copy is already safe */ } }
    return { ok: true, good: json };
  }
  /* returns { state, mode: 'new'|'ok'|'recovered'|'safe', raw, rawBak, good } ; never writes */
  function storeLoad(storage, key) {
    let raw = null, bak = null;
    try { raw = storage.getItem(key); } catch (e) { return { state: emptyState(), mode: 'new', raw: null, rawBak: null, good: '' }; }
    try { bak = storage.getItem(key + '.bak'); } catch (e) { bak = null; }
    if (raw === null || raw === '') return { state: emptyState(), mode: 'new', raw, rawBak: bak, good: '' };
    const a = parseStored(raw); if (a) return { state: a, mode: 'ok', raw, rawBak: bak, good: raw };
    const b = parseStored(bak); if (b) return { state: b, mode: 'recovered', raw, rawBak: bak, good: bak };
    return { state: emptyState(), mode: 'safe', raw, rawBak: bak, good: '' };
  }

  const api = { MAX_STUDENTS, SOURCES, cleanName, parseRoster, matchStudent, sha256, pyJSON, readZip, zipData, verifySubmission, isoOk, makeQuillAssignment, quillAssignmentFile, quillFor, readQuillAssignment,
    csvCell, parseCSV, quizLabel, parseIntraCSV, parseIntraBackup, parseQuillVerified, quillEvidence, parseWorldReflection, parseMathResult, parseMathCSV, classifyText, parseText,
    emptyState, sanitizeState, addStudents, removeStudent, newAssignment, pushAssignment, applyImport, rubricResult, band, letter, finalGrade, stats, assignmentStats, assignmentEvidence,
    studentReport, parentSummary, gradebookCSV, addDays, monthGrid, termWeek, termWeeks, calendarItems, buildBackup, readBackup, clip, canon, unsafeKeys, parseStored, storeSave, storeLoad,
    newId: (p, list) => uid(p, new Set((list || []).map(x => x && x.id))) };
  Object.assign(api, TEACH.install(api));
  SCH.lib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
