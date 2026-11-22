/* Stark Classroom Hub 1.2: on-device insight. Pure functions (no DOM, no network): fuzzy command search, term trends,
   a "worth a look" list, a live what-if grade simulator, evidence-based comment drafts and sealed (encrypted) backups.
   Everything is computed from the class stored on this computer. tests/test_hub.py runs it in node. */
(function (root) {
  'use strict';
  const SCH = root.SCH = root.SCH || {};
  const L = SCH.lib || (typeof require !== 'undefined' ? require('./hublib.js') : null);
  const round1 = x => Math.round(x * 10) / 10;
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  /* ---------- fuzzy search (command palette) ---------- */
  /* -1 = no match. Letters must appear in order; word starts, runs and a prefix score higher; shorter text wins ties. */
  function fuzzyScore(query, text) {
    const q = String(query || '').toLowerCase().replace(/\s+/g, ''), t = String(text || '').toLowerCase();
    if (!q) return 0;
    let ti = 0, score = 0, run = 0, first = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi]; let found = -1;
      for (let i = ti; i < t.length; i++) if (t[i] === c) { found = i; break; }
      if (found < 0) return -1;
      if (first < 0) first = found;
      const wordStart = found === 0 || /[^a-z0-9]/.test(t[found - 1]);
      run = found === ti && qi > 0 ? run + 1 : 0;
      score += 1 + (wordStart ? 6 : 0) + run * 3;
      ti = found + 1;
    }
    if (t.indexOf(q) === 0) score += 12; else if (t.indexOf(q) > 0) score += 5;
    return score - first * 0.2 - t.length * 0.02;
  }
  function fuzzyRank(query, items, limit) {
    const out = [];
    items.forEach((it, i) => { const s = fuzzyScore(query, it.label + ' ' + (it.keys || '')); if (s >= 0) out.push({ item: it, score: s, i }); });
    out.sort((a, b) => b.score - a.score || a.i - b.i);
    return out.slice(0, limit || 8).map(x => x.item);
  }

  /* ---------- trends ---------- */
  const dueKey = (a, i) => (a.due || '9999-12-31') + ('0000' + i).slice(-4);
  function sortedAssignments(state) { return state.assignments.map((a, i) => ({ a, k: dueKey(a, i) })).sort((x, y) => (x.k < y.k ? -1 : 1)).map(x => x.a); }
  function attendanceSeries(state) {
    return Object.keys(state.attendance).sort().map(d => {
      const c = L.dayCounts(state, d), n = c.P + c.L + c.A + c.E;
      return { date: d, n, rate: n ? round1(100 * (c.P + c.L) / n) : null };
    }).filter(x => x.rate !== null);
  }
  function gradeSeries(state) {
    return sortedAssignments(state).map(a => ({ id: a.id, title: a.title, due: a.due, mean: L.assignmentStats(state, a).mean })).filter(x => x.mean !== null);
  }
  function studentSeries(state, sid) {
    return sortedAssignments(state).map(a => ({ title: a.title, due: a.due, pct: L.rubricResult(a, (state.grades[a.id] || {})[sid]).pct })).filter(x => x.pct !== null);
  }
  /* SVG path for a series scaled into w x h with padding; y is a percentage 0 to 100 */
  function sparkPath(values, w, h, pad, range) {
    const p = pad === undefined ? 4 : pad, n = values.length, lo = range ? range[0] : 0, hi = range ? range[1] : 100;
    if (!n) return { d: '', pts: [] };
    const pts = values.map((v, i) => [round1(p + (n === 1 ? (w - 2 * p) / 2 : (w - 2 * p) * i / (n - 1))), round1(p + (h - 2 * p) * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)))]);
    return { d: pts.map((q, i) => (i ? 'L' : 'M') + q[0] + ' ' + q[1]).join(' '), pts };
  }

  /* a readable y-range around the data: whole tens, at least 20 wide, inside 0 to 100 */
  function niceRange(values) {
    if (!values.length) return [0, 100];
    let lo = Math.floor((Math.min.apply(null, values) - 5) / 10) * 10, hi = Math.ceil((Math.max.apply(null, values) + 5) / 10) * 10;
    lo = Math.max(0, lo); hi = Math.min(100, hi);
    if (hi - lo < 20) { if (hi >= 100) lo = hi - 20; else hi = lo + 20; }
    return [lo, hi];
  }

  /* ---------- "worth a look" ---------- */
  function watchlist(state, today) {
    const lows = [], highs = [], dates = Object.keys(state.attendance).sort(), recentDays = dates.slice(-5);
    state.students.forEach(s => {
      const reasons = []; let pts = 0;
      const marks = recentDays.map(d => state.attendance[d][s.id]).filter(Boolean);
      const away = marks.filter(m => m === 'A').length;
      if (marks.length >= 3 && away >= 2) { pts += 2; reasons.push('Absent on ' + away + ' of the last ' + marks.length + ' registers.'); }
      const at = L.attendanceSummary(state, s.id);
      if (at.concern) { pts += 1; reasons.push('Attendance rate is ' + at.rate + '% over ' + at.days + ' days.'); }
      const ser = studentSeries(state, s.id);
      let delta = 0;
      if (ser.length >= 3) {
        const last = ser[ser.length - 1].pct, before = mean(ser.slice(0, -1).map(x => x.pct));
        delta = round1(last - before);
        if (delta <= -15) { pts += 2; reasons.push('Latest result (' + Math.round(last) + '%, ' + ser[ser.length - 1].title + ') is ' + Math.abs(Math.round(delta)) + ' points below the earlier average.'); }
      }
      const miss = today ? L.missingWork(state, s.id, today) : [];
      if (miss.length >= 2) { pts += 2; reasons.push(miss.length + ' pieces of work are past due: ' + miss.slice(0, 3).join(', ') + '.'); }
      else if (miss.length === 1) { pts += 1; reasons.push('Past due: ' + miss[0] + '.'); }
      if (reasons.length) lows.push({ sid: s.id, name: s.name, points: pts, reasons });
      else if (delta >= 15) highs.push({ sid: s.id, name: s.name, delta, note: 'Latest result is ' + Math.round(delta) + ' points above the earlier average. Worth a word of recognition.' });
    });
    lows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    highs.sort((a, b) => b.delta - a.delta);
    return { look: lows, bright: highs };
  }

  /* ---------- what-if ---------- */
  function overallWith(state, sid, aid, pct) {
    let sum = 0, w = 0;
    state.assignments.forEach(a => {
      const p = a.id === aid ? pct : L.rubricResult(a, (state.grades[a.id] || {})[sid]).pct;
      if (p !== null && p !== undefined) { sum += p * a.weight; w += a.weight; }
    });
    return w > 0 ? round1(sum / w) : null;
  }
  /* the result needed on one assignment for the weighted overall to reach target (a percentage) */
  function neededFor(state, sid, aid, target) {
    const a = state.assignments.find(x => x.id === aid); if (!a) return null;
    let sum = 0, w = 0;
    state.assignments.forEach(o => { if (o.id === aid) return; const p = L.rubricResult(o, (state.grades[o.id] || {})[sid]).pct; if (p !== null) { sum += p * o.weight; w += o.weight; } });
    const x = (target * (w + a.weight) - sum) / a.weight;
    return { pct: round1(Math.max(0, x)), already: x <= 0, reachable: x <= 100 };
  }

  /* ---------- comment draft (rule-based, from the record only) ---------- */
  function commentDraft(state, sid, today) {
    const r = L.studentReport(state, sid); if (!r) return '';
    const out = [], name = r.name, f = r.final;
    if (f.pct === null) return name + ' has no graded work yet, so there is nothing to comment on so far.';
    out.push(name + ' is working at the "' + f.band + '" level in this class, with an overall result of ' + Math.round(f.pct) + '% across ' + f.graded + ' graded ' + (f.graded === 1 ? 'piece' : 'pieces') + ' of work.');
    const ser = studentSeries(state, sid);
    if (ser.length >= 3) {
      const d = ser[ser.length - 1].pct - mean(ser.slice(0, -1).map(x => x.pct));
      if (d >= 10) out.push('The most recent result is higher than the earlier ones, which is encouraging.');
      else if (d <= -10) out.push('The most recent result is lower than the earlier ones, so it is worth checking in.');
    }
    if (r.strengths.length) out.push('Going well: ' + r.strengths.map(c => c.text.toLowerCase()).join('; ') + '.');
    if (r.next.length) out.push('Next steps: ' + r.next.map(c => c.text.toLowerCase()).join('; ') + '.');
    const at = L.attendanceSummary(state, sid);
    if (at.days >= 5) out.push('Attendance on the register is ' + Math.round(at.rate) + '% over ' + at.days + ' days.');
    const miss = today ? L.missingWork(state, sid, today) : [];
    if (miss.length) out.push('Work still to hand in: ' + miss.join(', ') + '.');
    return out.join(' ');
  }

  /* ---------- fair picker: every student once before anyone twice, unbiased crypto randomness ---------- */
  /** Uniform integer in [0, n) by rejection sampling on 32-bit values (no modulo bias). rnd32 is injectable for tests. */
  function randBelow(n, rnd32) {
    if (!(n >= 1)) return 0;
    const get = rnd32 || (() => root.crypto.getRandomValues(new Uint32Array(1))[0]);
    const lim = Math.floor(4294967296 / n) * n; let x;
    do { x = get(); } while (x >= lim);
    return x % n;
  }
  function shuffle(list, rnd32) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randBelow(i + 1, rnd32); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  /** Who can be picked: everyone, or (presentOnly) only students not marked Absent or Excused on the given day. */
  function pickPool(state, day, presentOnly) {
    const marks = (state.attendance && state.attendance[day]) || {};
    return state.students.filter(s => !presentOnly || (marks[s.id] !== 'A' && marks[s.id] !== 'E')).map(s => s.id);
  }
  /** Draw the next name. bag = ids still to come this round; a new round starts (reshuffled) when it is empty, and the
      last pick of a round never opens the next one, so nobody is called twice in a row. Returns { id, bag, round }. */
  function pickNext(pool, bag, last, rnd32) {
    const set = new Set(pool); let b = (bag || []).filter(id => set.has(id)), fresh = false;
    if (!b.length) { b = shuffle(pool, rnd32); fresh = true; if (b.length > 1 && b[b.length - 1] === last) { const t = b[0]; b[0] = b[b.length - 1]; b[b.length - 1] = t; } }
    const id = b.pop(); return { id: id === undefined ? null : id, bag: b, round: fresh };
  }
  /** When the pool changes mid-round (for example "present today only" is ticked), the round goes on: the new bag holds
      the pool minus everyone already picked this round. */
  function refillBag(pool, seen, rnd32) { const done = new Set(seen || []); return shuffle(pool.filter(id => !done.has(id)), rnd32); }
  /** How many of the pool are still to be picked this round (the whole pool before the first pick). */
  function roundLeft(pool, bag, seen) { if (!(seen && seen.length) && !(bag && bag.length)) return pool.length; const set = new Set(pool); return (bag || []).filter(id => set.has(id)).length; }

  /* ---------- sealed backups: WebCrypto PBKDF2-SHA256 + AES-256-GCM ---------- */
  const VAULT_APP = 'stark-classroomhub-sealed', VAULT_ITER = 600000;
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const cryptoOk = () => !!(root.crypto && root.crypto.subtle && root.crypto.getRandomValues);
  async function deriveKey(pass, salt, iter) {
    const base = await root.crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return root.crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  /** Sealed backups hold student records and can be attacked offline: 12+ characters, 5+ different characters, no runs or repeats. */
  function passIssue(pass) {
    if (typeof pass !== 'string' || pass.length < 12) return 'Use a passphrase of at least 12 characters (four or five ordinary words work well).';
    if (new Set(pass.toLowerCase()).size < 5 || /^(.{1,3})\1+$/.test(pass) || /^(?:0123456789|1234567890|abcdefghijkl|qwertyuiop)/i.test(pass)) return 'That passphrase is too easy to guess. Use four or five ordinary words.';
    return '';
  }
  async function sealBackup(text, pass, iter) {
    if (!cryptoOk()) throw new Error('This browser has no WebCrypto, so sealed backups are not available.');
    const why = passIssue(pass); if (why) throw new Error(why);
    const it = iter || VAULT_ITER, salt = root.crypto.getRandomValues(new Uint8Array(16)), iv = root.crypto.getRandomValues(new Uint8Array(12));
    const hdr = { app: VAULT_APP, version: 1, kdf: 'PBKDF2-SHA256', iter: it, salt: b64(salt), iv: b64(iv), alg: 'AES-256-GCM' };
    const key = await deriveKey(pass, salt, it);
    const ct = new Uint8Array(await root.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(JSON.stringify(hdr)) }, key, new TextEncoder().encode(text)));
    return Object.assign({}, hdr, { data: b64(ct) });
  }
  async function openBackup(o, pass) {
    if (!cryptoOk()) return { ok: false, error: 'This browser has no WebCrypto, so sealed backups cannot be opened.' };
    if (!o || typeof o !== 'object' || o.app !== VAULT_APP || o.version !== 1 || o.kdf !== 'PBKDF2-SHA256' || o.alg !== 'AES-256-GCM' || typeof o.data !== 'string' || typeof o.salt !== 'string' || typeof o.iv !== 'string') return { ok: false, error: 'This file is not a sealed Stark Classroom Hub backup.' };
    if (!Number.isInteger(o.iter) || o.iter < 100000 || o.iter > 5000000) return { ok: false, error: 'This sealed backup has unsafe settings, so it was not opened.' };
    try {
      const hdr = { app: o.app, version: o.version, kdf: o.kdf, iter: o.iter, salt: o.salt, iv: o.iv, alg: o.alg };
      const key = await deriveKey(String(pass || ''), unb64(o.salt), o.iter);
      const pt = await root.crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv), additionalData: new TextEncoder().encode(JSON.stringify(hdr)) }, key, unb64(o.data));
      return { ok: true, text: new TextDecoder().decode(pt) };
    } catch (e) { return { ok: false, error: 'Wrong passphrase, or the file was changed after it was sealed.' }; }
  }

  SCH.insight = { fuzzyScore, fuzzyRank, attendanceSeries, gradeSeries, studentSeries, sparkPath, niceRange, watchlist, overallWith, neededFor, commentDraft, randBelow, shuffle, pickPool, pickNext, refillBag, roundLeft, sealBackup, openBackup, passIssue, cryptoOk, VAULT_APP, VAULT_ITER };
  if (typeof module !== 'undefined' && module.exports) module.exports = SCH.insight;
})(typeof window !== 'undefined' ? window : globalThis);
