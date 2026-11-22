/* Stark Event Kit core: question bank, scoring and tie-breaks, brackets, rubric, game engine, import/export.
   Pure logic with no DOM, so the same file runs in the browser and under node for the tests. */
(function (g) {
  'use strict';
  var S = g.SEK = g.SEK || {};
  S.RAW = S.RAW || [];
  S.VERSION = '1.5.0';

  S.CATS = [
    { id: 'geography', name: 'Geography', color: '#2fb5a0' }, { id: 'history', name: 'History', color: '#c58b3a' },
    { id: 'science', name: 'Science', color: '#4f8df0' }, { id: 'nature', name: 'Nature', color: '#6bbf59' },
    { id: 'space', name: 'Space', color: '#8f7cf0' }, { id: 'technology', name: 'Technology', color: '#3bc4e8' },
    { id: 'mathematics', name: 'Mathematics', color: '#e0658f' }, { id: 'literature', name: 'Literature', color: '#c0794e' },
    { id: 'film', name: 'Film and TV', color: '#e5584a' }, { id: 'music', name: 'Music', color: '#d46be0' },
    { id: 'sport', name: 'Sport', color: '#f0a23a' }, { id: 'culture', name: 'Food and language', color: '#9cc23a' }
  ];
  S.DIFFS = ['easy', 'medium', 'hard'];
  S.TEAM_COLORS = ['#2dd4bf', '#f59e0b', '#60a5fa', '#f472b6', '#a3e635', '#c084fc', '#fb7185', '#fbbf24', '#38bdf8', '#34d399', '#f97316', '#94a3b8'];

  /* ---------- helpers ---------- */
  function trim(v) { return (v == null ? '' : String(v)).trim(); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  S.trim = trim;
  /* random id from crypto.getRandomValues (no Math.random collisions overwriting records); falls back only without WebCrypto */
  S.rid = function () {
    var b = new Uint8Array(9), i, s = '', c = g.crypto;
    if (c && c.getRandomValues) c.getRandomValues(b); else for (i = 0; i < 9; i++) b[i] = Math.floor(Math.random() * 256);
    for (i = 0; i < 9; i++) s += ('0' + b[i].toString(16)).slice(-2);
    return s;
  };
  S.hash = function (str) { var h = 2166136261; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  S.rng = function (seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  S.shuffle = function (arr, rnd) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  S.catName = function (id) { for (var i = 0; i < S.CATS.length; i++) if (S.CATS[i].id === id) return S.CATS[i].name; return id === 'prompt' ? 'Icebreaker' : id; };
  S.catColor = function (id) { for (var i = 0; i < S.CATS.length; i++) if (S.CATS[i].id === id) return S.CATS[i].color; return '#94a3b8'; };

  /* SHA-256 (sync, pure JS) for backup checksums. */
  S.sha256 = function (str) {
    var K = [], H = [], i, j, w = [], bytes = [], c;
    str = unescape(encodeURIComponent(String(str)));
    for (i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
    (function () { var n = 2, p = 0, f; for (; p < 64; n++) { for (f = 2; f * f <= n; f++) if (n % f === 0) break; if (f * f > n) { if (p < 8) H[p] = (Math.pow(n, 0.5) * 4294967296) | 0; K[p++] = (Math.pow(n, 1 / 3) * 4294967296) | 0; } } })();
    var bl = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bl >>> (i * 8)) & 255);
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (i = 0; i < bytes.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
      for (j = 16; j < 64; j++) { var s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10); w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0; }
      var v = H.slice(), t1, t2;
      for (j = 0; j < 64; j++) {
        t1 = (v[7] + (rr(v[4], 6) ^ rr(v[4], 11) ^ rr(v[4], 25)) + ((v[4] & v[5]) ^ (~v[4] & v[6])) + K[j] + w[j]) | 0;
        t2 = ((rr(v[0], 2) ^ rr(v[0], 13) ^ rr(v[0], 22)) + ((v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]))) | 0;
        v = [(t1 + t2) | 0, v[0], v[1], v[2], (v[3] + t1) | 0, v[4], v[5], v[6]];
      }
      for (j = 0; j < 8; j++) H[j] = (H[j] + v[j]) | 0;
    }
    var out = ''; for (i = 0; i < 8; i++) { c = (H[i] >>> 0).toString(16); out += ('00000000' + c).slice(-8); } return out;
  };

  /* Crash-safe store: write, read back and verify; keep the last good copy under key + ".bak"; recover from it if the
     main copy is corrupt. A key whose stored data cannot be read is "bad": it is never overwritten (safe mode). */
  var mem = {}, SHAPE = { custom: 'array', history: 'array', game: 'object', bracket: 'object', jam: 'object', plan: 'object', guests: 'object', seating: 'object', show: 'object',
    budget: 'object', crew: 'object', raffle: 'object', league: 'object', design: 'object', overlay: 'object', passes: 'object' };
  S.safe = { bad: {}, recovered: [] };
  function shapeOk(k, v) { var t = SHAPE[k]; if (!t || v === null) return true; return t === 'array' ? Array.isArray(v) : (typeof v === 'object' && !Array.isArray(v)); }
  function readKey(ls, k) { var raw = ls.getItem('sek.' + k), v; if (raw == null) return { none: true }; try { v = JSON.parse(raw); } catch (e) { return { raw: raw }; } return shapeOk(k.replace(/\.bak$/, ''), v) ? { v: v } : { raw: raw }; }
  S.store = {
    get: function (k, d) {
      var ls, r, b;
      try { ls = g.localStorage; r = readKey(ls, k); } catch (e) { return k in mem ? mem[k] : d; }
      if (r.none) return k in mem ? mem[k] : d;
      if (!('raw' in r)) return r.v;
      try { b = readKey(ls, k + '.bak'); } catch (e) { b = { none: true }; }
      if (b && 'v' in b) { try { ls.setItem('sek.' + k, JSON.stringify(b.v)); } catch (e) { /* keep reading from the copy */ } S.safe.recovered.push(k); delete S.safe.bad[k]; return b.v; }
      S.safe.bad[k] = r.raw; return d;
    },
    set: function (k, v) {
      var ls, json, prev, back, prevOk = true;
      function fail(why) { if (typeof S.store.onFail === 'function') { try { S.store.onFail(k, why); } catch (e) { /* ignore */ } } return false; }
      if (S.safe.bad[k] != null) return fail('safe');                // safe mode: never overwrite unreadable data
      mem[k] = v;
      try {
        ls = g.localStorage; json = JSON.stringify(v); prev = ls.getItem('sek.' + k);
        if (prev != null && prev !== json) {
          try { JSON.parse(prev); } catch (e) { prevOk = false; }
          if (!prevOk) { try { ls.removeItem('sek.' + k + '.bak'); } catch (e2) { /* ignore */ } }
          else { try { ls.setItem('sek.' + k + '.bak', prev); } catch (e3) { /* quota: keep the older .bak, never delete the only recovery copy */ } }
        }
        ls.setItem('sek.' + k, json); back = ls.getItem('sek.' + k);
        if (back !== json) { if (prev != null) ls.setItem('sek.' + k, prev); return fail('verify'); }
        if (typeof S.store.onSaved === 'function') { try { S.store.onSaved(k); } catch (e) { /* ignore */ } }
        return true;
      } catch (e) { return fail('quota'); }
    },
    del: function (k) { delete mem[k]; try { g.localStorage.removeItem('sek.' + k); g.localStorage.removeItem('sek.' + k + '.bak'); } catch (e) { /* ignore */ } },
    check: function () { Object.keys(SHAPE).forEach(function (k) { S.store.get(k, null); }); return S.safe; }
  };

  /* ---------- question bank ---------- */
  var built = null;
  S.builtin = function () {
    if (built) return built;
    built = [];
    S.RAW.forEach(function (b) {
      b.rows.forEach(function (r, i) {
        var id = b.cat + '-' + b.diff + '-' + pad(i + 1, 3);
        var choices = S.shuffle([r[1], r[2], r[3], r[4]], S.rng(S.hash(id)));
        built.push({ id: id, cat: b.cat, diff: b.diff, q: r[0], a: r[1], choices: choices, ans: choices.indexOf(r[1]), src: r[5] || '', builtin: true });
      });
    });
    return built;
  };
  S.categorySources = {
    geography: 'Standard atlas and gazetteer facts (UN, national statistics offices, Encyclopaedia Britannica).',
    history: 'Standard reference dates and attributions (Encyclopaedia Britannica, national archives).',
    science: 'Textbook science and SI definitions (BIPM, IUPAC periodic table).',
    nature: 'Zoological and botanical reference works (Encyclopaedia Britannica, IUCN, Kew).',
    space: 'NASA, ESA, Roscosmos mission records and IAU resolutions.',
    technology: 'Computing history and standards (IETF, ISO, vendor and museum records).',
    mathematics: 'Standard mathematics; every numeric answer recomputed independently by the test suite.',
    literature: 'First-publication attributions as given in major library catalogues.',
    film: 'Academy Awards database and film-credit records.',
    music: 'Composer and recording attributions from major library and label catalogues.',
    sport: 'Olympic, FIFA and federation record books.',
    culture: 'Food, language and festival facts from standard encyclopaedias and linguistic references.'
  };

  S.validate = function (q) {
    var p = [], i, seen = {};
    if (!q || typeof q !== 'object') return ['not an object'];
    if (!trim(q.id)) p.push('empty id');
    if (!S.CATS.some(function (c) { return c.id === q.cat; })) p.push('unknown category');
    if (S.DIFFS.indexOf(q.diff) < 0) p.push('unknown difficulty');
    if (!trim(q.q)) p.push('empty question');
    if (!trim(q.a)) p.push('empty answer');
    if (q.src != null && typeof q.src !== 'string') p.push('source is not text');
    if (!Array.isArray(q.choices)) p.push('choices missing');
    else if (q.choices.length) {
      if (q.choices.length < 2 || q.choices.length > 6) p.push('choices must number 2 to 6');
      for (i = 0; i < q.choices.length; i++) {
        var c = trim(q.choices[i]), k = c.toLowerCase();
        if (!c) p.push('empty choice'); else if (seen[k]) p.push('duplicate choice "' + c + '"'); seen[k] = 1;
      }
      if (q.choices.indexOf(q.a) < 0) p.push('answer is not among the choices');
      if (q.choices[q.ans] !== q.a) p.push('answer index does not point at the answer');
    }
    if (q.img != null && !/^data:image\//.test(q.img)) p.push('picture is not an image');
    return p;
  };

  S.makeCustom = function (o) {
    var wrong = (o.wrong || []).map(trim).filter(Boolean);
    var q = { id: o.id || ('c-' + Date.now().toString(36) + S.rid().slice(0, 6)), cat: o.cat, diff: o.diff, q: trim(o.q), a: trim(o.a), src: trim(o.src), builtin: false };
    if (o.img) q.img = o.img;
    if (wrong.length) { q.choices = S.shuffle([q.a].concat(wrong), S.rng(S.hash(q.id + q.q))); q.ans = q.choices.indexOf(q.a); }
    else { q.choices = []; q.ans = -1; }
    return q;
  };
  S.custom = {
    all: function () { var v = S.store.get('custom', []); return Array.isArray(v) ? v : []; },
    save: function (list) { return S.store.set('custom', list); },
    upsert: function (q) { var l = S.custom.all(), i; for (i = 0; i < l.length; i++) if (l[i].id === q.id) { l[i] = q; return S.custom.save(l); } l.push(q); return S.custom.save(l); },
    remove: function (id) { return S.custom.save(S.custom.all().filter(function (q) { return q.id !== id; })); }
  };
  S.pool = function () { return S.builtin().concat(S.custom.all()); };
  S.counts = function (list) {
    var m = {}; (list || S.builtin()).forEach(function (q) { var k = q.cat + '|' + q.diff; m[k] = (m[k] || 0) + 1; }); return m;
  };

  /* ---------- CSV and import / export ---------- */
  S.csvParse = function (text) {
    var rows = [], row = [], cur = '', inq = false, i, ch;
    text = String(text).replace(/^\uFEFF/, '');
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      if (inq) { if (ch === '"') { if (text.charAt(i + 1) === '"') { cur += '"'; i++; } else inq = false; } else cur += ch; }
      else if (ch === '"') inq = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text.charAt(i + 1) === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur); if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  };
  S.csvCell = function (v) {
    v = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = "'" + v;   // spreadsheet formula guard
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  S.csvUnguard = function (v) { v = trim(v); return /^'[=+\-@]/.test(v) ? v.slice(1) : v; };
  S.csvLine = function (arr) { return arr.map(S.csvCell).join(','); };
  S.CSV_HEAD = ['category', 'difficulty', 'question', 'answer', 'wrong1', 'wrong2', 'wrong3', 'source'];

  S.exportQuestions = function (list, fmt) {
    if (fmt === 'csv') {
      return [S.csvLine(S.CSV_HEAD)].concat(list.map(function (q) {
        var w = (q.choices || []).filter(function (c) { return c !== q.a; });
        return S.csvLine([q.cat, q.diff, q.q, q.a, w[0] || '', w[1] || '', w[2] || '', q.src || '']);
      })).join('\r\n') + '\r\n';
    }
    var qs = list.map(function (q) {
      var o = { cat: q.cat, diff: q.diff, q: q.q, a: q.a, wrong: (q.choices || []).filter(function (c) { return c !== q.a; }), src: q.src || '' };
      if (q.img) o.img = q.img; return o; });
    return JSON.stringify({ format: 'stark-event-kit-questions', version: 1, checksum: S.sha256(JSON.stringify(qs)), questions: qs }, null, 1);
  };
  var IMP_KEYS = { cat: 1, category: 1, diff: 1, difficulty: 1, q: 1, question: 1, a: 1, answer: 1, wrong: 1, src: 1, source: 1, img: 1 };
  var IMP_MAX = { rows: 5000, text: 2000, file: 40000000, img: 900000 };
  function refuse(msg) { return { good: [], errors: [{ row: 0, msg: msg }], refused: true }; }
  /* Strict check of a parsed JSON backup. Returns an error message, or '' when fine. */
  S.checkImportJson = function (j, rows) {
    var i, k, r, w;
    if (rows.length > IMP_MAX.rows) return 'too many questions (limit ' + IMP_MAX.rows + ')';
    if (!Array.isArray(j)) for (k in j) if (k !== 'format' && k !== 'version' && k !== 'checksum' && k !== 'questions') return 'unknown field "' + k + '" in the file';
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (!r || typeof r !== 'object' || Array.isArray(r)) return 'row ' + (i + 1) + ' is not a question';
      for (k in r) {
        if (!Object.prototype.hasOwnProperty.call(IMP_KEYS, k)) return 'row ' + (i + 1) + ' has an unknown field "' + k + '"';
        if (k === 'wrong') { w = r[k]; if (!Array.isArray(w) || w.length > 5 || w.some(function (x) { return typeof x !== 'string' || x.length > IMP_MAX.text; })) return 'row ' + (i + 1) + ' has invalid wrong answers'; }
        else if (typeof r[k] !== 'string') return 'row ' + (i + 1) + ' field "' + k + '" is not text';
        else if (k === 'img') { if (r[k].length > IMP_MAX.img || !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/=]+$/.test(r[k])) return 'row ' + (i + 1) + ' has an invalid picture'; }
        else if (r[k].length > IMP_MAX.text) return 'row ' + (i + 1) + ' field "' + k + '" is too long';
      }
    }
    return '';
  };
  S.importQuestions = function (text, existing) {
    var rows = [], errors = [], good = [], seen = {}, t = trim(text), i, note = '';
    (existing || S.pool()).forEach(function (q) { seen[q.cat + '|' + trim(q.q).toLowerCase()] = 1; });
    if (!t) return { good: [], errors: [{ row: 0, msg: 'nothing to import' }] };
    if (t.charAt(0) === '[' || t.charAt(0) === '{') {
      if (t.length > IMP_MAX.file) return refuse('File refused: it is too large. Nothing was changed.');
      try { var j = JSON.parse(t, function (k, v) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') throw new Error('forbidden key ' + k); return v; }); }
      catch (e) { return refuse('File refused: not valid JSON (' + e.message + '). Nothing was changed.'); }
      if (j === null || typeof j !== 'object') return refuse('File refused: not a question list. Nothing was changed.');
      rows = Array.isArray(j) ? j : j.questions;
      if (!Array.isArray(rows)) return refuse('File refused: no question list found. Nothing was changed.');
      var bad = S.checkImportJson(j, rows);
      if (!bad && !Array.isArray(j) && j.format != null && j.format !== 'stark-event-kit-questions') bad = 'this is not a Stark Event Kit question file';
      if (bad) return refuse('File refused: ' + bad + '. Nothing was changed.');
      if (!Array.isArray(j) && j.checksum != null) {
        if (typeof j.checksum !== 'string' || j.checksum !== S.sha256(JSON.stringify(rows))) return refuse('File refused: its checksum does not match, so it was changed or damaged. Nothing was changed.');
        note = 'Checksum verified.';
      } else note = 'no checksum, validated';
      rows = rows.map(function (r) { return { cat: r.cat || r.category, diff: r.diff || r.difficulty, q: r.q || r.question, a: r.a || r.answer, wrong: r.wrong || [], src: r.src || r.source, img: r.img }; });
    } else {
      var table = S.csvParse(t), head = table[0].map(function (h) { return trim(h).toLowerCase(); });
      var ix = function (n) { return head.indexOf(n); };
      if (ix('question') < 0 || ix('answer') < 0 || ix('category') < 0) return { good: [], errors: [{ row: 1, msg: 'CSV needs the columns: ' + S.CSV_HEAD.join(', ') }] };
      for (i = 1; i < table.length; i++) {
        var r = table[i], f = function (n) { return ix(n) >= 0 ? r[ix(n)] : ''; };
        rows.push({ cat: trim(f('category')).toLowerCase(), diff: trim(f('difficulty')).toLowerCase(), q: S.csvUnguard(f('question')), a: S.csvUnguard(f('answer')), wrong: [f('wrong1'), f('wrong2'), f('wrong3')].map(S.csvUnguard), src: S.csvUnguard(f('source')) });
      }
    }
    rows.forEach(function (o, n) {
      var rowNo = n + 1, q, p;
      o.cat = trim(o.cat).toLowerCase(); o.diff = trim(o.diff).toLowerCase();
      q = S.makeCustom(o); p = S.validate(q);
      if (!p.length && seen[q.cat + '|' + q.q.toLowerCase()]) p = ['duplicate of an existing question'];
      if (p.length) errors.push({ row: rowNo, msg: p.join('; ') }); else { seen[q.cat + '|' + q.q.toLowerCase()] = 1; good.push(q); }
    });
    return { good: good, errors: errors, note: note };
  };

  /* ---------- scoring and tie-breaks ---------- */
  S.DEFAULT_ORDER = ['score', 'correct', 'hard', 'fewerWrong', 'tiebreak'];
  S.ORDER_LABEL = { score: 'total score', correct: 'most correct answers', hard: 'most hard questions correct', fewerWrong: 'fewest wrong answers', tiebreak: 'closest tie-break guess' };
  S.defaultScoring = function () { return { pts: { easy: 1, medium: 2, hard: 3 }, penalty: 0, bonus: 0, order: S.DEFAULT_ORDER.slice() }; };
  S.points = function (sc, q, frac) {
    var base = (sc.pts && sc.pts[q.diff] != null) ? +sc.pts[q.diff] : 1;
    var bonus = sc.bonus ? Math.round((+sc.bonus) * Math.max(0, Math.min(1, frac || 0))) : 0;
    return base + bonus;
  };
  var CRIT = {
    score: function (t) { return -t.score; }, correct: function (t) { return -t.correct; }, hard: function (t) { return -t.hard; },
    fewerWrong: function (t) { return t.wrong; }, tiebreak: function (t) { return t.tbDist == null ? Infinity : t.tbDist; }
  };
  S.rank = function (teams, order) {
    order = order && order.length ? order : S.DEFAULT_ORDER;
    var dec = teams.map(function (t, i) { return { t: t, i: i }; });
    function cmp(a, b) {
      for (var k = 0; k < order.length; k++) { var f = CRIT[order[k]], x = f(a.t), y = f(b.t); if (x < y) return -1; if (x > y) return 1; }
      return 0;
    }
    function sep(a, b) { for (var k = 0; k < order.length; k++) { var f = CRIT[order[k]]; if (f(a.t) !== f(b.t)) return order[k]; } return null; }
    dec.sort(function (a, b) { return cmp(a, b) || (a.i - b.i); });
    var rows = [], i;
    for (i = 0; i < dec.length; i++) rows.push({ team: dec[i].t, rank: (i > 0 && cmp(dec[i - 1], dec[i]) === 0) ? rows[i - 1].rank : i + 1, tied: false, by: null });
    for (i = 0; i < rows.length; i++) {
      if ((i > 0 && rows[i - 1].rank === rows[i].rank) || (i + 1 < rows.length && rows[i + 1].rank === rows[i].rank)) rows[i].tied = true;
      if (i + 1 < rows.length) rows[i].by = rows[i + 1].rank === rows[i].rank ? null : sep(dec[i], dec[i + 1]);
    }
    return rows;
  };
  S.tbDistance = function (guess, target) {
    if (guess == null || guess === '' || target == null || target === '') return null;
    var a = parseFloat(String(guess).replace(/,/g, '')), b = parseFloat(String(target).replace(/,/g, ''));
    return (isFinite(a) && isFinite(b)) ? Math.abs(a - b) : null;
  };

/* full version only */
  /* ---------- game jam rubric ---------- */
  S.rubric = {
    totals: function (rubric, scores) {
      // rubric: {criteria:[{id,weight,max}], entries:[{id,name}], judges:[{id}]}; scores[entry][judge][criterion] = number
      var W = rubric.criteria.reduce(function (a, c) { return a + (+c.weight || 0); }, 0) || 1;
      var rows = rubric.entries.map(function (e) {
        var per = {}, total = 0, judged = 0;
        rubric.criteria.forEach(function (c) {
          var vals = [];
          rubric.judges.forEach(function (j) { var v = scores && scores[e.id] && scores[e.id][j.id] && scores[e.id][j.id][c.id]; if (v !== '' && v != null && isFinite(+v)) vals.push(Math.max(0, Math.min(+c.max || 5, +v))); });
          per[c.id] = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
          if (per[c.id] != null) { total += per[c.id] / (+c.max || 5) * (+c.weight || 0); judged++; }
        });
        return { entry: e, per: per, total: Math.round(total / W * 10000) / 100, judged: judged };
      });
      var byWeight = rubric.criteria.slice().sort(function (a, b) { return (+b.weight || 0) - (+a.weight || 0); });
      function cmp(a, b) {
        if (a.total !== b.total) return b.total - a.total;
        for (var k = 0; k < byWeight.length; k++) { var x = a.per[byWeight[k].id] || 0, y = b.per[byWeight[k].id] || 0; if (x !== y) return y - x; }
        return 0;
      }
      var idx = rows.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) { return cmp(a.r, b.r) || a.i - b.i; });
      var out = [], i; for (i = 0; i < idx.length; i++) { var row = idx[i].r; row.rank = (i > 0 && cmp(idx[i - 1].r, row) === 0) ? out[i - 1].rank : i + 1; out.push(row); }
      return out;
    }
  };
  S.pickTheme = function (seed, lockedTheme) {
    var rnd = S.rng(seed >>> 0), t = lockedTheme || S.JAM_THEMES[Math.floor(rnd() * S.JAM_THEMES.length)];
    var c1 = S.JAM_CONSTRAINTS[Math.floor(rnd() * S.JAM_CONSTRAINTS.length)], c2;
    do { c2 = S.JAM_CONSTRAINTS[Math.floor(rnd() * S.JAM_CONSTRAINTS.length)]; } while (c2 === c1);
    return { theme: t, constraints: [c1, c2] };
  };

  /* ---------- game engine ---------- */
  function newTeam(t, i) {
    t = t || {};
    return { id: 't' + (i + 1), name: trim(t.name) || ('Team ' + (i + 1)), members: (t.members || []).map(trim).filter(Boolean), color: S.TEAM_COLORS[i % S.TEAM_COLORS.length], score: 0, correct: 0, wrong: 0, hard: 0, tbDist: null };
  }
  S.pick = function (pool, round, used, rnd) {
    var want = Math.max(0, round.count | 0), out = [], i;
    if (round.type === 'prompts') {
      var pr = S.shuffle(round.prompts || S.ICEBREAKERS, rnd);
      for (i = 0; i < want && i < pr.length; i++) out.push({ id: 'p-' + S.hash(pr[i]).toString(36), cat: 'prompt', diff: 'easy', q: pr[i], a: 'No single answer: the host awards points for the best response.', choices: [], ans: -1, src: '', open: true });
      return out;
    }
    var cats = (round.cat == null || round.cat === 'all') ? null : [].concat(round.cat), picture = round.type === 'picture';
    var cand = S.shuffle(pool.filter(function (q) { return !used[q.id] && (picture ? !!q.img : !q.img) && (!cats || cats.indexOf(q.cat) >= 0); }), rnd);
    var buckets = { easy: [], medium: [], hard: [] };
    cand.forEach(function (q) { buckets[q.diff].push(q); });
    var diffs = [];
    for (i = 0; i < want; i++) diffs.push(round.diff && round.diff !== 'mixed' ? round.diff : S.DIFFS[Math.min(2, Math.floor(i * 3 / want))]);
    var recent = [];
    diffs.forEach(function (d) {
      var order = [d].concat(S.DIFFS.filter(function (x) { return x !== d; })), b = null, k, j, q = null;
      for (k = 0; k < order.length && !b; k++) if (buckets[order[k]].length) b = buckets[order[k]];
      if (!b) return;
      for (j = 0; j < b.length; j++) if (recent.indexOf(b[j].cat) < 0) { q = b.splice(j, 1)[0]; break; }
      if (!q) q = b.shift();
      recent.push(q.cat); if (recent.length > 2) recent.shift();
      used[q.id] = 1; out.push(q);
    });
    return out;
  };

  /* Fresh questions for regulars: how often each question id was asked at past nights (history). */
  S.pastIds = function (history) {
    var out = {};
    (Array.isArray(history) ? history : []).forEach(function (g0) { ((g0 && g0.questions) || []).forEach(function (q) { if (q && q.id && q.cat !== 'prompt') out[q.id] = (out[q.id] || 0) + 1; }); });
    return out;
  };
  /* pick avoiding past questions first; only if the bank runs short, top up with the least-asked past questions */
  function pickFresh(pool, r, used, rnd, avoid, fresh) {
    var u2 = {}, k, picked, more, want = Math.max(0, r.count | 0);
    if (!avoid || r.type === 'prompts') return S.pick(pool, r, used, rnd);
    for (k in used) u2[k] = 1; for (k in avoid) u2[k] = 1;
    picked = S.pick(pool, r, u2, rnd);
    picked.forEach(function (q) { used[q.id] = 1; });
    var tiers = {}, keys;   // past questions grouped by how often they were asked; the least-asked tier is used first
    if (picked.length < want) {
      pool.forEach(function (q) { if (avoid[q.id] && !used[q.id]) (tiers[avoid[q.id]] = tiers[avoid[q.id]] || []).push(q); });
      keys = Object.keys(tiers).map(Number).sort(function (a, b) { return a - b; });
      for (k = 0; k < keys.length && picked.length < want; k++) {
        more = S.pick(tiers[keys[k]], Object.assign({}, r, { count: want - picked.length }), used, rnd);
        fresh.repeats += more.length; picked = picked.concat(more);
      }
    }
    return picked;
  }

  S.game = {
    create: function (cfg, pool) {
      var rnd = S.rng(cfg.seed != null ? cfg.seed : (Date.now() & 0x7fffffff)), used = {}, questions = [], rounds = [], teams, tn = cfg.teams,
        avoid = cfg.avoid && typeof cfg.avoid === 'object' && Object.keys(cfg.avoid).length ? cfg.avoid : null, fresh = { avoided: avoid ? Object.keys(avoid).length : 0, repeats: 0 };
      if (typeof tn === 'number') { teams = []; for (var i = 0; i < tn; i++) teams.push({ name: 'Team ' + (i + 1) }); } else teams = tn || [];
      (cfg.rounds || []).forEach(function (r, ri) {
        var picked = pickFresh(pool || S.pool(), r, used, rnd, avoid, fresh);
        rounds.push({ name: trim(r.name) || ('Round ' + (ri + 1)), type: r.type || 'quiz', start: questions.length, count: picked.length });
        picked.forEach(function (q) {
          var c = { id: q.id, cat: q.cat, diff: q.diff, q: q.q, a: q.a, choices: (q.choices || []).slice(), ans: q.ans, src: q.src || '', round: ri };
          if (q.img) c.img = q.img; if (q.open) c.open = true; questions.push(c);
        });
      });
      var sc = S.defaultScoring(), k; for (k in (cfg.scoring || {})) sc[k] = cfg.scoring[k];
      var s = { v: 1, id: 'g' + Date.now().toString(36), name: trim(cfg.name) || 'Quiz night', mode: cfg.mode || 'pub', created: new Date().toISOString(),
        scoring: sc, showChoices: cfg.showChoices !== false, timerSec: Math.max(5, cfg.timerSec | 0 || 30), autoTimer: !!cfg.autoTimer,
        teams: teams.map(newTeam), rounds: rounds, questions: questions, qi: -1, phase: 'title', ret: null, roundEnd: false,
        timer: { dur: 30, left: 30, running: false, endsAt: 0 }, marks: {}, adj: {}, buzzed: null, locked: [], tb: { q: '', answer: '' }, tbGuess: {}, rev: 0 };
      if (avoid) s.fresh = fresh;
      S.game.recompute(s); return s;
    },
    cur: function (s) { return s.qi >= 0 && s.qi < s.questions.length ? s.questions[s.qi] : null; },
    remaining: function (s, now) { var t = s.timer; return t.running ? Math.max(0, (t.endsAt - now) / 1000) : t.left; },
    recompute: function (s) {
      s.teams.forEach(function (t) { t.score = 0; t.correct = 0; t.wrong = 0; t.hard = 0; });
      var byId = {}; s.teams.forEach(function (t) { byId[t.id] = t; });
      s.questions.forEach(function (q) {
        var m = s.marks[q.id]; if (!m) return;
        for (var id in m) { var t = byId[id]; if (!t) continue;
          if (m[id].r === 'right') { t.score += S.points(s.scoring, q, m[id].f); t.correct++; if (q.diff === 'hard') t.hard++; }
          else if (m[id].r === 'wrong') { t.score -= (+s.scoring.penalty || 0); t.wrong++; } }
      });
      s.teams.forEach(function (t) { t.score += (s.adj[t.id] | 0); t.tbDist = S.tbDistance(s.tbGuess[t.id], s.tb && s.tb.answer); });
      return s;
    },
    standings: function (s) { return S.rank(s.teams, s.scoring.order); },
    _enter: function (s, now) {
      var q = S.game.cur(s); s.phase = 'question'; s.buzzed = null; s.locked = []; s.ret = null; s.roundEnd = false;
      s.timer = { dur: s.timerSec, left: s.timerSec, running: false, endsAt: 0 };
      if (s.autoTimer && q) { s.timer.running = true; s.timer.endsAt = now + s.timerSec * 1000; }
    },
    cmd: function (s, name, arg, now) {
      now = now || Date.now(); var q = S.game.cur(s), t = s.timer, rem, last;
      s.rev = (s.rev | 0) + 1;
      switch (name) {
        case 'start': case 'next':
          if (s.phase === 'title') { if (s.questions.length) { s.qi = 0; S.game._enter(s, now); } else s.phase = 'final'; }
          else if (s.phase === 'scores' && s.ret) { s.phase = s.ret; s.ret = null; }
          else if (s.phase === 'question' || s.phase === 'reveal' || s.phase === 'scores') {
            last = s.qi + 1 >= s.questions.length || s.questions[s.qi + 1].round !== s.questions[s.qi].round;
            if (s.phase !== 'scores' && last) { s.phase = 'scores'; s.ret = null; s.roundEnd = true; t.left = S.game.remaining(s, now); t.running = false; }
            else if (s.qi + 1 >= s.questions.length) s.phase = 'final';
            else { s.qi++; S.game._enter(s, now); }
          }
          break;
        case 'prev': if (s.qi > 0 && (s.phase === 'question' || s.phase === 'reveal' || s.phase === 'scores')) { s.qi--; S.game._enter(s, now); } break;
        case 'goto': if (arg >= 0 && arg < s.questions.length) { s.qi = arg | 0; S.game._enter(s, now); } break;
        case 'reveal': if (s.phase === 'question' && q) { t.left = S.game.remaining(s, now); t.running = false; s.phase = 'reveal'; s.buzzed = null; } break;
        case 'scores': if (s.phase === 'scores') { if (s.ret) { s.phase = s.ret; s.ret = null; } } else if (s.phase === 'question' || s.phase === 'reveal') { s.ret = s.phase; s.phase = 'scores'; t.left = S.game.remaining(s, now); t.running = false; } break;
        case 'finish': s.phase = 'final'; t.running = false; break;
        case 'timerStart': if (s.phase === 'question' && !t.running && t.left > 0) { t.running = true; t.endsAt = now + t.left * 1000; } break;
        case 'timerPause': if (t.running) { t.left = S.game.remaining(s, now); t.running = false; } break;
        case 'timerReset': t.left = t.dur; t.running = false; break;
        case 'timerSet': t.dur = Math.max(5, arg | 0); t.left = t.dur; t.running = false; s.timerSec = t.dur; break;
        case 'timerEnd': if (t.running && S.game.remaining(s, now) <= 0) { t.running = false; t.left = 0; } break;
        case 'choices': s.showChoices = !s.showChoices; break;
        case 'buzz':
          if (s.mode === 'buzzer' && s.phase === 'question' && !s.buzzed && s.locked.indexOf(arg) < 0 && s.teams.some(function (x) { return x.id === arg; })) {
            s.buzzed = arg; t.left = S.game.remaining(s, now); t.running = false; return s; }
          s.rev--; return false;
        case 'mark': return S.game.mark(s, arg.team, arg.res, now);
        case 'adj': s.adj[arg.team] = (s.adj[arg.team] | 0) + (arg.delta | 0); break;
        case 'tbGuess': s.tbGuess[arg.team] = arg.value; break;
        case 'tbSet': s.tb = { q: trim(arg.q), answer: arg.answer == null ? '' : String(arg.answer) }; break;
        default: s.rev--; return false;
      }
      return S.game.recompute(s);
    },
    mark: function (s, teamId, res, now) {
      var q = S.game.cur(s); if (!q) return false;
      if (!s.teams.some(function (x) { return x.id === teamId; })) return false;
      var m = s.marks[q.id] = s.marks[q.id] || {};
      if (!res) delete m[teamId];
      else {
        var rem = S.game.remaining(s, now), f = s.timer.dur ? rem / s.timer.dur : 0;
        m[teamId] = { r: res, f: s.mode === 'pub' ? 0 : f };
      }
      if (s.mode === 'buzzer' && s.buzzed === teamId) {
        s.buzzed = null;
        if (res === 'right') { s.phase = 'reveal'; s.timer.running = false; }
        else if (res === 'wrong') { s.locked.push(teamId); if (s.timer.left > 0) { s.timer.running = true; s.timer.endsAt = now + s.timer.left * 1000; } }
      }
      return S.game.recompute(s);
    },
    resultRows: function (s) {
      return S.game.standings(s).map(function (r) { return { rank: r.rank, team: r.team.name, score: r.team.score, correct: r.team.correct, wrong: r.team.wrong, hard: r.team.hard, tbDist: r.team.tbDist, tied: r.tied }; });
    },
    resultsCsv: function (s) {
      var lines = [S.csvLine(['Event', s.name]), S.csvLine(['Date', (s.created || '').slice(0, 10)]), '', S.csvLine(['Rank', 'Team', 'Score', 'Correct', 'Wrong', 'Hard correct', 'Tie-break distance', 'Tied'])];
      S.game.resultRows(s).forEach(function (r) { lines.push(S.csvLine([r.rank, r.team, r.score, r.correct, r.wrong, r.hard, r.tbDist == null ? '' : r.tbDist, r.tied ? 'yes' : 'no'])); });
      lines.push('', S.csvLine(['Question grid']), S.csvLine(['#', 'Round', 'Category', 'Difficulty', 'Question', 'Answer'].concat(s.teams.map(function (t) { return t.name; }))));
      s.questions.forEach(function (q, i) {
        var m = s.marks[q.id] || {};
        lines.push(S.csvLine([i + 1, s.rounds[q.round] ? s.rounds[q.round].name : '', S.catName(q.cat), q.diff, q.q, q.a].concat(s.teams.map(function (t) { return m[t.id] ? m[t.id].r : ''; }))));
      });
      return lines.join('\r\n') + '\r\n';
    }
  };
  S.fmtTime = function (sec) { sec = Math.max(0, Math.ceil(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad(m, 2) : m) + ':' + pad(s, 2); };
})(typeof window !== 'undefined' ? window : globalThis);
