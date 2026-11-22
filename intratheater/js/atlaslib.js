/* Stark IntraTheater by Stark. Atlas Lab maths: pure functions with no DOM, shared by the app and the node tests.
   Fuzzy search, plain-English timeline questions, learning insights, constellation layout and the encrypted family vault. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SIT = G.SIT = G.SIT || {};

  /* ---------- fuzzy search ---------- */
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  /* score of query q against text t: -1 = no match. Prefix and word-start hits beat scattered letters. */
  function fuzzy(q, t) {
    q = fold(q).trim(); t = fold(t);
    if (!q) return 0;
    const at = t.indexOf(q);
    if (at === 0) return 100 - Math.min(t.length, 40) / 4;
    if (at > 0) return (t[at - 1] === ' ' ? 80 : 60) - Math.min(at, 30) / 3;
    let qi = 0, last = -2, run = 0, score = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        const wordStart = i === 0 || t[i - 1] === ' ';
        run = last === i - 1 ? run + 1 : 1;
        score += 2 + run + (wordStart ? 3 : 0);
        last = i; qi++;
      }
    }
    if (qi < q.length) return -1;
    return Math.max(1, Math.min(50, score - (t.length - q.length) / 12));
  }
  function search(items, q, limit) {
    const out = [];
    items.forEach(it => {
      const s = Math.max(fuzzy(q, it.label), fuzzy(q, it.hay || '') - 25);
      if (s >= 0) out.push({ item: it, score: s + (it.boost || 0) });
    });
    out.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
    return out.slice(0, limit || 8).map(x => x.item);
  }

  /* ---------- plain-English timeline questions ---------- */
  const REGION_WORDS = [
    [/\b(africa|african|egypt|egyptian|nile)\b/, ['Africa']],
    [/\b(europe|european)\b/, ['Europe']],
    [/\b(asia|asian)\b/, ['East Asia', 'South & Southeast Asia', 'Middle East']],
    [/\b(china|chinese|japan|japanese|korea|korean|east asia)\b/, ['East Asia']],
    [/\b(india|indian|southeast asia|south asia)\b/, ['South & Southeast Asia']],
    [/\b(middle east|arab|arabian|persia|persian|mesopotamia)\b/, ['Middle East']],
    [/\b(america|americas|american|maya|aztec|inca)\b/, ['Americas']],
    [/\b(oceania|australia|pacific|polynesia)\b/, ['Oceania']]
  ];
  const STOP = new Set(('a an the of in on at to for and or with was were is are did do does what who when where which how why happened happen event events ' +
    'moment moments show me tell about from between before after during around since until till than first earliest oldest newest latest last recent list find all any some ' +
    'century centuries year years ago bc bce ad ce era age').split(' '));

  function eraWords(eras) {
    return (eras || []).map(e => ({ id: e.id, words: fold(e.name).split(/[^a-z]+/).filter(w => w.length > 3 && !STOP.has(w)), start: e.start, end: e.end, name: e.name }));
  }
  /* returns { from, to, regions, eras, words, order, notes[] } */
  function parseQuery(raw, eras) {
    const q = fold(raw).replace(/[?!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
    const out = { from: null, to: null, regions: [], eras: [], words: [], order: 'date', notes: [] };
    let rest = ' ' + q + ' ';
    const take = (re, fn) => { rest = rest.replace(re, (...m) => { fn(m); return ' '; }); };
    const sign = s => (/b\.?c/.test(s || '') ? -1 : 1);
    const yr = (n, era) => sign(era) * Number(n);
    const eraRe = '(?:\\s*(bce?|b\\.c\\.?|ad|ce|a\\.d\\.?))?';
    // "15th century", "5th century bc"
    take(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th) century' + eraRe, 'g'), m => {
      const c = Number(m[1]), s = sign(m[2]);
      const a = s < 0 ? -c * 100 : (c - 1) * 100, b = s < 0 ? -(c - 1) * 100 : c * 100;
      out.from = Math.max(out.from === null ? a : out.from, a); out.to = Math.min(out.to === null ? b : out.to, b);
      out.notes.push('the ' + c + 'th century' + (s < 0 ? ' BCE' : ''));
    });
    take(new RegExp('\\bbetween (\\d{1,7})' + eraRe + ' and (\\d{1,7})' + eraRe + '\\b', 'g'), m => {
      const e2 = m[4] || m[2], a = yr(m[1], m[2] || e2), b = yr(m[3], e2);
      out.from = Math.min(a, b); out.to = Math.max(a, b); out.notes.push('between ' + fmtYear(out.from) + ' and ' + fmtYear(out.to));
    });
    take(new RegExp('\\b(?:before|until|till|earlier than|prior to) (\\d{1,7})' + eraRe + '\\b', 'g'), m => { out.to = yr(m[1], m[2]); out.notes.push('before ' + fmtYear(out.to)); });
    take(new RegExp('\\b(?:after|since|later than) (\\d{1,7})' + eraRe + '\\b', 'g'), m => { out.from = yr(m[1], m[2]); out.notes.push('after ' + fmtYear(out.from)); });
    take(/\b(?:in|around|circa|c\.?) (\d{1,7})(?: (bce?|ad|ce))?\b/g, m => {
      const y = yr(m[1], m[2]), pad = Math.max(10, Math.round(Math.abs(y) * 0.04));
      out.from = y - pad; out.to = y + pad; out.notes.push('around ' + fmtYear(y));
    });
    take(/\blast (\d{1,7}) years\b/g, m => { const y = new Date().getFullYear(); out.from = y - Number(m[1]); out.to = y; out.notes.push('the last ' + m[1] + ' years'); });
    if (/\b(first|earliest|oldest)\b/.test(rest)) { out.order = 'oldest'; out.notes.push('oldest first'); }
    else if (/\b(newest|latest|most recent|recent)\b/.test(rest)) { out.order = 'newest'; out.notes.push('newest first'); }
    REGION_WORDS.forEach(r => { if (r[0].test(rest)) r[1].forEach(x => { if (out.regions.indexOf(x) < 0) out.regions.push(x); }); });
    if (out.regions.length) out.notes.push('in ' + out.regions.join(' + '));
    eraWords(eras).forEach(e => { if (e.words.length && e.words.every(w => rest.indexOf(' ' + w) >= 0)) { out.eras.push(e.id); out.notes.push(e.name + ' era'); } });
    out.words = rest.split(' ').filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)).filter(w => !REGION_WORDS.some(r => r[0].test(w)) && !eraWords(eras).some(e => e.words.indexOf(w) >= 0));
    if (out.words.length) out.notes.push('about ' + out.words.join(', '));
    return out;
  }
  function fmtYear(y) {
    const a = Math.abs(y);
    if (y > 0) return String(y);
    if (a >= 10000) return (a >= 1e6 ? (a / 1e6).toFixed(1).replace(/\.0$/, '') + ' million' : a.toLocaleString('en-US')) + ' years ago';
    return a + ' BCE';
  }
  const stem = w => w.replace(/(ing|ed|es|s)$/, '');
  /* events matching a question, best first. Every keyword must hit the title, text or region (stemmed), so answers are never padded. */
  function ask(raw, events, eras, limit) {
    const p = parseQuery(raw, eras);
    const eraIds = p.eras;
    let list = events.filter(e => {
      if (p.from !== null && e.year < p.from) return false;
      if (p.to !== null && e.year > p.to) return false;
      if (p.regions.length && p.regions.indexOf(e.region) < 0 && e.region !== 'Global') return false;
      if (eraIds.length && eraIds.indexOf(e.era) < 0) return false;
      return true;
    }).map(e => {
      const hay = fold(e.title + ' ' + e.adult + ' ' + e.kid + ' ' + e.region);
      const titleHay = fold(e.title);
      let score = 0, ok = true;
      p.words.forEach(w => {
        const s = stem(w);
        if (titleHay.indexOf(s) >= 0) score += 5; else if (hay.indexOf(s) >= 0) score += 2; else ok = false;
      });
      if (p.regions.length && p.regions.indexOf(e.region) >= 0) score += 1;
      return { e, score, ok };
    }).filter(x => x.ok);
    const anyConstraint = p.words.length || p.from !== null || p.to !== null || p.regions.length || eraIds.length;
    if (!anyConstraint) return { parsed: p, results: [], empty: true };
    list.sort((a, b) => p.order === 'oldest' ? a.e.year - b.e.year : p.order === 'newest' ? b.e.year - a.e.year : (b.score - a.score) || (a.e.year - b.e.year));
    return { parsed: p, results: list.slice(0, limit || 12).map(x => x.e), total: list.length, empty: false };
  }

  /* ---------- learning insights (on this device only) ---------- */
  /* seen: ids of explored moments. Returns coverage by era and region, the thinnest spots and the next moments to open. */
  function insights(seen, events, eras) {
    const set = new Set(seen || []);
    const byEra = {}, byRegion = {};
    (eras || []).forEach(e => { byEra[e.id] = { id: e.id, name: e.name, total: 0, seen: 0 }; });
    events.forEach(e => {
      const a = byEra[e.era] || (byEra[e.era] = { id: e.era, name: e.era, total: 0, seen: 0 });
      const r = byRegion[e.region] || (byRegion[e.region] = { id: e.region, name: e.region, total: 0, seen: 0 });
      a.total++; r.total++;
      if (set.has(e.id)) { a.seen++; r.seen++; }
    });
    const rate = x => (x.total ? x.seen / x.total : 1);
    const eraList = Object.keys(byEra).map(k => byEra[k]), regionList = Object.keys(byRegion).filter(k => k !== 'Global').map(k => byRegion[k]);
    const gaps = eraList.concat(regionList.map(r => Object.assign({ region: true }, r))).filter(x => x.total >= 3).sort((a, b) => rate(a) - rate(b) || b.total - a.total).slice(0, 3);
    // next moments: unseen events in the thinnest era and thinnest region, nearest in time to something already seen
    const seenYears = events.filter(e => set.has(e.id)).map(e => e.year);
    const weakEra = eraList.filter(x => x.total).sort((a, b) => rate(a) - rate(b))[0];
    const weakRegion = regionList.filter(x => x.total).sort((a, b) => rate(a) - rate(b))[0];
    const near = e => (seenYears.length ? Math.min.apply(null, seenYears.map(y => Math.abs(y - e.year))) : 0);
    const pool = events.filter(e => !set.has(e.id)).map(e => ({ e, s: (weakEra && e.era === weakEra.id ? 2 : 0) + (weakRegion && e.region === weakRegion.id ? 2 : 0) - Math.min(1.5, Math.log10(near(e) + 10) / 4) })).sort((a, b) => b.s - a.s || a.e.year - b.e.year);
    const next = pool.slice(0, 4).map(x => x.e);
    const total = events.length, n = events.filter(e => set.has(e.id)).length;
    // pace forecast: moments left at a given pace per week
    const forecast = perWeek => (perWeek > 0 ? Math.ceil((total - n) / perWeek) : null);
    return { total, seen: n, pct: total ? Math.round(100 * n / total) : 0, eras: eraList, regions: regionList, gaps, next, forecast };
  }

  /* ---------- constellation layout ---------- */
  /* Places every moment as a star: x follows the timeline (more room for recent history), y follows the region lane. */
  const LANES = ['Africa', 'Europe', 'Middle East', 'South & Southeast Asia', 'East Asia', 'Oceania', 'Americas', 'Global'];
  function hash(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; }
  function constellation(events, seen, w, h) {
    const set = new Set(seen || []);
    const padX = 30, padY = 30;
    const spread = y => { // squash deep time, expand the last 5000 years
      const a = -y; // years ago relative to year 0
      if (y >= 1) return 0.86 + 0.14 * Math.min(1, y / 2030);
      if (a < 5000) return 0.5 + 0.36 * (1 - a / 5000);
      return 0.5 * (1 - Math.min(1, Math.log10(a / 5000) / Math.log10(3400000 / 5000)));
    };
    const nodes = events.map(e => {
      const lane = Math.max(0, LANES.indexOf(e.region));
      const jx = (hash(e.id) - 0.5) * 0.012, jy = (hash(e.id + 'y') - 0.5) * 0.55;
      return { id: e.id, title: e.title, date: e.date, year: e.year, region: e.region, lit: set.has(e.id),
        x: Math.round(padX + (w - 2 * padX) * Math.min(1, Math.max(0, spread(e.year) + jx))),
        y: Math.round(padY + (h - 2 * padY) * ((lane + 0.5 + jy) / LANES.length)), r: set.has(e.id) ? 4.2 : 2.4 };
    }).sort((a, b) => a.year - b.year);
    const edges = [], last = {};
    nodes.forEach(n => { if (last[n.region] && n.lit && last[n.region].lit) edges.push([last[n.region].id, n.id]); last[n.region] = n; });
    return { nodes, edges, lanes: LANES, lit: nodes.filter(n => n.lit).length };
  }

  /* ---------- encrypted family vault: PBKDF2-SHA256 -> AES-256-GCM, all through WebCrypto ---------- */
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  /* Vault v2 binds the WHOLE header (app, version, kdf, rounds, salt, iv, creation time, sequence) as AES-GCM additional data,
     so no header field can be edited or swapped without the open failing. Rounds are bounded on open (100,000 to 2,000,000):
     a file can neither downgrade the key nor freeze the tab with a huge count. v1 files still open under the same bounds. */
  const VAULT_ITER = 600000, ITER_MIN = 100000, ITER_MAX = 2000000, PASS_MIN = 12, MAX_CT = 400 * 1024 * 1024;
  const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
  async function vaultKey(pass, salt, iter) {
    const base = await G.crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return G.crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const aadV2 = hd => new TextEncoder().encode(['stark-intratheater', 2, hd.kdf, hd.iter, hd.salt, hd.iv, hd.created, hd.seq].join('|'));
  async function vaultSeal(obj, pass, iter, seq) {
    iter = iter || VAULT_ITER;
    if (typeof pass !== 'string' || pass.length < PASS_MIN) throw new Error('short');
    if (!Number.isInteger(iter) || iter < ITER_MIN || iter > ITER_MAX) throw new Error('rounds');
    const salt = G.crypto.getRandomValues(new Uint8Array(16)), iv = G.crypto.getRandomValues(new Uint8Array(12));
    const key = await vaultKey(pass, salt, iter);
    const head = { app: 'stark-intratheater', vault: 2, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), created: new Date().toISOString(), seq: Number.isInteger(seq) && seq > 0 ? seq : 1 };
    const ct = await G.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadV2(head) }, key, new TextEncoder().encode(JSON.stringify(obj)));
    return Object.assign(head, { ct: b64(new Uint8Array(ct)) });
  }
  /* returns { ok, backup, created, seq } or { ok:false, message }. A wrong passphrase and a damaged file look the same on purpose. */
  async function vaultOpen(file, pass) {
    const no = message => ({ ok: false, message });
    if (!file || typeof file !== 'object' || file.app !== 'stark-intratheater' || (file.vault !== 1 && file.vault !== 2) || file.kdf !== 'PBKDF2-SHA256' || typeof file.ct !== 'string') return no('That file is not a Stark IntraTheater vault.');
    if (!Number.isInteger(file.iter) || file.iter < ITER_MIN || file.iter > ITER_MAX) return no('That vault file is not valid.');
    if (typeof file.salt !== 'string' || typeof file.iv !== 'string' || !B64_RE.test(file.salt) || !B64_RE.test(file.iv) || file.ct.length > MAX_CT || !B64_RE.test(file.ct)) return no('That vault file is not valid.');
    if (file.vault === 2 && (typeof file.created !== 'string' || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(file.created) || !Number.isInteger(file.seq) || file.seq < 1)) return no('That vault file is not valid.');
    try {
      const salt = unb64(file.salt), iv = unb64(file.iv);
      if (salt.length !== 16 || iv.length !== 12) return no('That vault file is not valid.');
      const key = await vaultKey(String(pass), salt, file.iter);
      const aad = file.vault === 2 ? aadV2(file) : new TextEncoder().encode(file.app + '|' + file.vault + '|' + file.iter);
      const pt = await G.crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, unb64(file.ct));
      return { ok: true, backup: JSON.parse(new TextDecoder().decode(pt)), created: file.vault === 2 ? file.created : null, seq: file.vault === 2 ? file.seq : 0 };
    } catch (e) { return no('Wrong passphrase, or the vault file is damaged. Nothing was changed.'); }
  }
  /* rollback guard: compares an opened vault with the newest one this device has written or restored.
     -> null when it is the same or newer, or a plain-words warning when it is older. */
  function rollbackNote(opened, last) {
    if (!opened || !opened.created || !last || !last.created) return null;
    if (opened.seq < last.seq || opened.created < last.created) return 'This vault is older than the newest one this device made or restored (' + last.created.slice(0, 10) + '). Restoring it brings back older data.';
    return null;
  }
  /* strength hint: bits of entropy estimate from length and character classes (a hint, not a promise) */
  function passStrength(p) {
    p = String(p || '');
    let pool = 0; if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10; if (/[^A-Za-z0-9]/.test(p)) pool += 32;
    const bits = pool ? Math.round(p.length * Math.log2(pool)) : 0;
    const distinct = new Set(p).size;
    const eff = distinct < 4 ? Math.min(bits, 12) : bits;
    return { bits: eff, label: eff < 36 ? 'weak' : eff < 60 ? 'fair' : eff < 80 ? 'strong' : 'very strong' };
  }

  SIT.atlas = { fold, fuzzy, search, parseQuery, ask, insights, constellation, fmtYear, vaultSeal, vaultOpen, rollbackNote, passStrength, LANES, PASS_MIN, ITER_MIN, ITER_MAX };
})();
