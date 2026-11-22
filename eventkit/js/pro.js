/* Stark Event Kit pro: on-device intelligence. Pure logic, no DOM, so it runs under node for the tests.
   Fuzzy search and plain-language questions over local guests, Monte Carlo what-if simulators, sealed (AES-GCM) backups,
   signed door passes with Code 39 barcodes, and the night replay (score race, win odds, question analytics). */
(function (g) {
  'use strict';
  var S = g.SEK;
  function trim(x) { return String(x == null ? '' : x).trim(); }
  function clamp(v, a, b) { v = +v; if (!isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); }

  /* ---------- fuzzy search ---------- */
  S.fuzzy = {
    norm: function (s) { return trim(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); },
    tokenScore: function (tok, text) {
      var i = text.indexOf(tok), j = 0, k, last = -1, gap = 0;
      if (i === 0 || (i > 0 && /[^a-z0-9]/.test(text.charAt(i - 1)))) return 30 + Math.min(tok.length, 12);
      if (i > 0) return 12;
      if (tok.length < 3) return 0;
      for (k = 0; k < text.length && j < tok.length; k++) if (text.charAt(k) === tok.charAt(j)) { if (last >= 0) gap += k - last - 1; last = k; j++; }
      if (j < tok.length) return 0;
      return Math.max(1, 8 - Math.floor(gap / 3));
    },
    /* every word of the query must match somewhere in the text; 0 means no match */
    score: function (query, text) {
      var toks = S.fuzzy.norm(query).split(/\s+/).filter(Boolean), t = S.fuzzy.norm(text), sum = 0, i, s;
      if (!toks.length) return 1;
      for (i = 0; i < toks.length; i++) { s = S.fuzzy.tokenScore(toks[i], t); if (!s) return 0; sum += s; }
      return sum + Math.max(0, 6 - Math.floor(t.length / 12));
    },
    rank: function (query, items, textFn, limit) {
      var out = [];
      items.forEach(function (it, i) { var s = S.fuzzy.score(query, textFn(it)); if (s > 0) out.push({ item: it, score: s, i: i }); });
      out.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
      return out.slice(0, limit || 50).map(function (x) { return x.item; });
    }
  };

  /* ---------- plain-language questions over the guest list ---------- */
  var STOP = /^(who|whom|are|is|was|were|the|guests?|people|persons?|show|list|find|me|all|and|with|of|a|an|that|which|have|has|had|for|to|in|on|at|any|everyone|everybody|how|many|count)$/;
  function seatName(ctx, p) { var tid = ctx.SE && ctx.SE.seat && ctx.SE.seat[p.id], i; if (!tid) return ''; for (i = 0; i < ctx.SE.tables.length; i++) if (ctx.SE.tables[i].id === tid) return ctx.SE.tables[i].name; return ''; }
  S.nlq = {
    run: function (query, ctx) {
      var t = ' ' + S.fuzzy.norm(query).replace(/[?!.,;]+/g, ' ') + ' ', G = ctx.G, f = [], desc = [], m, rest, people, words, rows;
      function take(re, fn, label) { var mm = re.exec(t); if (!mm) return null; t = t.replace(re, ' '); f.push(fn(mm)); desc.push(typeof label === 'function' ? label(mm) : label); return mm; }
      take(/\b(not (yet )?(checked[ -]in|arrived|here|in)|no[ -]?shows?|missing|yet to (arrive|check in)|absent|(haven't|hasn't|have not|has not) (arrived|checked in|turned up))\b/, function () { return function (p) { return p.status === 'registered' && !p.inAt; }; }, 'not checked in');
      take(/\b(checked[ -]in|arrived|present|turned up)\b/, function () { return function (p) { return !!p.inAt; }; }, 'checked in');
      take(/\b(unpaid|not paid|owes?|owing|(haven't|hasn't|have not|has not) paid|still to pay)\b/, function () { return function (p) { return p.status !== 'cancelled' && !p.paid; }; }, 'unpaid');
      take(/\bpaid\b/, function () { return function (p) { return !!p.paid; }; }, 'paid');
      take(/\b(wait ?list(ed)?|waiting( list)?)\b/, function () { return function (p) { return p.status === 'waitlist'; }; }, 'on the waiting list');
      take(/\bcancell?ed\b/, function () { return function (p) { return p.status === 'cancelled'; }; }, 'cancelled');
      take(/\b(unseated|no table|without (a )?table|not seated|need(s)? (a )?(table|seat))\b/, function () { return function (p) { return p.status === 'registered' && !seatName(ctx, p); }; }, 'without a table');
      take(/\b(?:at |on |in )?table ([a-z0-9]+)\b/, function (mm) { var n = mm[1]; return function (p) { var s = S.fuzzy.norm(seatName(ctx, p)); return s === 'table ' + n || s === n; }; }, function (mm) { return 'at table ' + mm[1]; });
      take(/\b(?:in |from |on )?team ([a-z0-9' -]+?)(?= (?:and|who|that|not|unpaid|paid|checked|with|at|on)\b|\s*$)/, function (mm) { var n = trim(mm[1]); return function (p) { return S.fuzzy.score(n, p.team) > 0; }; }, function (mm) { return 'team ' + trim(mm[1]); });
      take(/\b(?:ticket|type) ([a-z0-9' -]+?)(?= (?:and|who|that|not|unpaid|paid|checked|with|at|on)\b|\s*$)/, function (mm) { var n = trim(mm[1]); return function (p) { return S.fuzzy.score(n, p.type) > 0; }; }, function (mm) { return 'ticket ' + trim(mm[1]); });
      m = /\b(vegan|vegetarian|gluten[a-z-]*|halal|kosher|allerg[a-z]*|diet[a-z]*|wheelchair|access[a-z]*|nut[a-z]*|lactose|dairy)\b/.exec(t);
      if (m) { take(/\b(vegan|vegetarian|gluten[a-z-]*|halal|kosher|allerg[a-z]*|diet[a-z]*|wheelchair|access[a-z]*|nut[a-z]*|lactose|dairy)\b/, function (mm) { var w = mm[1].slice(0, 6); return function (p) { return S.fuzzy.norm(p.notes).indexOf(w) >= 0; }; }, function (mm) { return 'notes mention ' + mm[1]; }); }
      take(/\bwith notes\b/, function () { return function (p) { return !!trim(p.notes); }; }, 'with notes');
      words = t.split(/\s+/).filter(function (w) { return w && !STOP.test(w); });
      rest = words.join(' ');
      if (!f.length && !rest) return null;
      people = G.people.slice();
      f.forEach(function (fn) { people = people.filter(fn); });
      if (rest) {
        rows = people.map(function (p, i) { return { p: p, s: S.fuzzy.score(rest, p.name + ' ' + p.team + ' ' + p.email), i: i }; }).filter(function (x) { return x.s > 0; });
        rows.sort(function (a, b) { return b.s - a.s || a.i - b.i; }); people = rows.map(function (x) { return x.p; });
        desc.push('matching "' + rest + '"');
      } else if (!f.some(function (_, i) { return desc[i] === 'cancelled' || desc[i] === 'on the waiting list'; })) {
        people = people.filter(function (p) { return p.status !== 'cancelled'; });
      }
      return { structured: f.length > 0, filters: desc, total: people.length, people: people, text: people.length + (people.length === 1 ? ' guest' : ' guests') + ': ' + desc.join(', ') };
    }
  };

  /* ---------- Monte Carlo what-if simulators ---------- */
  function normal(r) { var u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  function tri(r, a, c, b) { var u, F; if (b <= a) return c; u = r(); F = (c - a) / (b - a); return u < F ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)); }
  function pct(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1) + 0.5)))]; }
  function hist(sorted, bins) {
    var lo = sorted[0], hi = sorted[sorted.length - 1], out = [], i, w = (hi - lo) / bins;
    for (i = 0; i < bins; i++) out.push({ from: lo + i * w, to: lo + (i + 1) * w, n: 0 });
    sorted.forEach(function (v) { var k = w > 0 ? Math.min(bins - 1, Math.floor((v - lo) / w)) : 0; out[k].n++; });
    return out;
  }
  S.sim = {
    /* How long will the running order really take? Each segment is a skewed (triangular) distribution around its plan. */
    show: function (items, o) {
      o = o || {};
      var runs = clamp(o.runs || 2000, 100, 20000), spread = clamp(o.spread == null ? 0.25 : o.spread, 0, 1.5), bias = clamp(o.bias == null ? 0.05 : o.bias, -0.5, 1),
        r = S.rng(o.seed == null ? 1234 : o.seed >>> 0), n = items.length, sum = [], sq = [], totals = [], i, k, d, m, tot, x, planned = 0, mean = 0, hit = 0, curfew = o.curfew, vs = 0, crit;
      for (i = 0; i < n; i++) { sum.push(0); sq.push(0); planned += Math.max(0, +items[i].dur || 0); }
      for (k = 0; k < runs; k++) {
        tot = 0;
        for (i = 0; i < n; i++) {
          d = Math.max(0, +items[i].dur || 0); m = d * (1 + bias);
          x = d === 0 ? 0 : tri(r, m * (1 - 0.5 * spread), m, m * (1 + 2 * spread));
          sum[i] += x; sq[i] += x * x; tot += x;
        }
        totals.push(tot); mean += tot; if (curfew != null && tot <= curfew + 1e-9) hit++;
      }
      totals.sort(function (a, b) { return a - b; }); mean /= runs;
      crit = items.map(function (it, j) { var mu = sum[j] / runs, v = Math.max(0, sq[j] / runs - mu * mu); vs += v; return { title: it.title, planned: +it.dur || 0, mean: mu, sd: Math.sqrt(v), v: v }; });
      crit.forEach(function (c) { c.share = vs > 0 ? c.v / vs : 0; });
      crit.sort(function (a, b) { return b.share - a.share; });
      return { runs: runs, planned: planned, mean: mean, p10: pct(totals, 0.1), p50: pct(totals, 0.5), p90: pct(totals, 0.9), min: totals[0], max: totals[totals.length - 1],
        probOnTime: curfew == null ? null : hit / runs, buffer: curfew == null ? null : Math.max(0, Math.ceil(pct(totals, 0.9) - curfew)), hist: hist(totals, 24), critical: crit.slice(0, 5).map(function (c) { return { title: c.title, planned: c.planned, mean: c.mean, sd: c.sd, share: c.share }; }) };
    },
    /* Ticket price what-if: demand falls as price rises (elasticity), some buyers do not come, costs have a fixed and a per-head part. Amounts in cents. */
    money: function (m, o) {
      o = o || {};
      var runs = clamp(o.runs || 2000, 100, 20000), r = S.rng(o.seed == null ? 4321 : o.seed >>> 0), price = Math.max(0, +m.price || 0), base = Math.max(0, +m.basePrice || 0), el = clamp(m.elasticity == null ? 1 : m.elasticity, 0, 4),
        demand = Math.max(0, +m.demand || 0), cap = Math.max(0, m.capacity | 0), ns = clamp(m.noShow || 0, 0, 0.95), sp = clamp(m.spread == null ? 0.15 : m.spread, 0, 1), fixedExp = +m.fixedExp || 0, other = +m.otherIncome || 0, per = +m.perHead || 0,
        expect = base > 0 && price > 0 ? demand * Math.pow(price / base, -el) : demand, nets = [], k, sold, att, j, sum = 0, ok = 0, full = 0, soldSum = 0, net;
      for (k = 0; k < runs; k++) {
        sold = Math.max(0, Math.round(expect * (1 + sp * normal(r)))); if (cap > 0 && sold > cap) { sold = cap; full++; }
        att = 0; for (j = 0; j < sold; j++) if (r() >= ns) att++;
        net = sold * price + other - fixedExp - per * att; nets.push(net); sum += net; soldSum += sold; if (net >= 0) ok++;
      }
      nets.sort(function (a, b) { return a - b; });
      var margin = price - per * (1 - ns);
      return { runs: runs, mean: sum / runs, p10: pct(nets, 0.1), p50: pct(nets, 0.5), p90: pct(nets, 0.9), probProfit: ok / runs, expectSold: soldSum / runs, probFull: cap > 0 ? full / runs : 0,
        breakEvenSold: margin > 0 ? Math.max(0, Math.ceil((fixedExp - other) / margin)) : null, hist: hist(nets, 24) };
    },
    priceSweep: function (m, lo, hi, steps, o) {
      var out = [], i, p, r, best = null; steps = clamp(steps || 12, 2, 60);
      for (i = 0; i < steps; i++) {
        p = Math.round(lo + (hi - lo) * i / (steps - 1)); r = S.sim.money(Object.assign({}, m, { price: p }), Object.assign({}, o, { runs: (o && o.runs) || 400 }));
        out.push({ price: p, mean: r.mean, probProfit: r.probProfit }); if (!best || r.mean > best.mean) best = out[out.length - 1];
      }
      return { points: out, best: best };
    }
  };

  /* ---------- sealed backups: PBKDF2-SHA256 + AES-256-GCM through WebCrypto ----------
     Format v2: the whole header (app, KDF, rounds, salt, IV, creation time and a sealing counter) is bound as AES-GCM
     additional data, so changing any header byte is refused. Rounds are capped on open (100,000 to 10,000,000) so a
     crafted file can neither weaken the key nor freeze the tab. The counter gives rollback protection: opening a file
     older than the newest one this browser has sealed or restored is flagged before anything is replaced. */
  var ITER = 600000, MIN_ITER = 100000, MAX_ITER = 10000000, MIN_PASS = 12, APP = 'stark-event-kit',
    enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null, dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
  function subtle() { return g.crypto && g.crypto.subtle ? g.crypto.subtle : null; }
  function b64(buf) { var b = new Uint8Array(buf), s = '', i; for (i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return g.btoa(s); }
  function unb64(s) { var raw = g.atob(s), b = new Uint8Array(raw.length), i; for (i = 0; i < raw.length; i++) b[i] = raw.charCodeAt(i); return b; }
  function hexBytes(h) { var b = new Uint8Array(h.length / 2), i; for (i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; }
  function toHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function seqGet() { try { var n = parseInt(g.localStorage.getItem('sek.sealSeq'), 10); return n > 0 ? n : 0; } catch (e) { return 0; } }
  function seqPut(n) { try { if (n > seqGet()) g.localStorage.setItem('sek.sealSeq', String(n)); } catch (e) { /* counter is advisory */ } }
  function headOf(j) {   // canonical header, fixed key order, exactly what was bound as AAD
    var hd = { format: j.format, v: j.v };
    if (j.v === 2) hd.app = j.app;
    hd.kdf = j.kdf; hd.iter = j.iter; hd.salt = j.salt; hd.iv = j.iv; hd.cipher = j.cipher;
    if (j.v === 2) { hd.created = j.created; hd.seq = j.seq; }
    return hd;
  }
  S.vault = {
    ITER: ITER, MIN_ITER: MIN_ITER, MAX_ITER: MAX_ITER, MIN_PASS: MIN_PASS,
    available: function () { return !!(subtle() && enc && dec && g.btoa); },
    strength: function (p) {
      var pool = 0, bits;
      p = String(p || ''); if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/[0-9]/.test(p)) pool += 10; if (/[^A-Za-z0-9]/.test(p)) pool += 32;
      bits = p.length * Math.log(pool || 1) / Math.LN2;
      if (/^(.)\1+$/.test(p) || /^(?:0123456789|password|passphrase|qwerty)/i.test(p)) bits = Math.min(bits, 20);   // repeats and the usual first guesses
      return { bits: Math.round(bits), label: p.length < MIN_PASS ? 'too short' : bits >= 70 ? 'strong' : bits >= 50 ? 'fair' : 'weak' };
    },
    /* refusal message, or '' when the passphrase is acceptable for sealing */
    passIssue: function (p) {
      var st = S.vault.strength(p);
      if (st.label === 'too short') return 'Use a passphrase of at least ' + MIN_PASS + ' characters.';
      if (st.label === 'weak') return 'That passphrase is too easy to guess. Use three or more unrelated words, or add length.';
      return '';
    },
    lastSeq: seqGet,
    noteSeq: function (n) { if (n > 0) seqPut(n); },
    deriveKey: function (pass, salt, iter) {
      return subtle().importKey('raw', enc.encode(String(pass)), 'PBKDF2', false, ['deriveKey']).then(function (base) {
        return subtle().deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
    },
    seal: function (plain, pass, o) {
      o = o || {};
      var iter = o.iter || ITER, salt, iv, head, issue, seq;
      if (!S.vault.available()) return Promise.resolve({ error: 'This browser has no WebCrypto here, so sealing is not available.' });
      issue = S.vault.passIssue(pass); if (issue) return Promise.resolve({ error: issue });
      if (!(typeof iter === 'number' && Math.floor(iter) === iter && iter >= MIN_ITER && iter <= MAX_ITER)) return Promise.resolve({ error: 'Refused: unreasonable key-stretching setting.' });
      seq = o.seq || (seqGet() + 1);
      salt = g.crypto.getRandomValues(new Uint8Array(16)); iv = g.crypto.getRandomValues(new Uint8Array(12));
      head = headOf({ format: 'stark-sealed-backup', v: 2, app: APP, kdf: 'PBKDF2-SHA256', iter: iter, salt: b64(salt), iv: b64(iv), cipher: 'AES-256-GCM', created: o.created || new Date().toISOString(), seq: seq });
      return S.vault.deriveKey(pass, salt, iter).then(function (key) {
        return subtle().encrypt({ name: 'AES-GCM', iv: iv, additionalData: enc.encode(JSON.stringify(head)) }, key, enc.encode(plain));
      }).then(function (ct) { head.ct = b64(ct); if (!o.seq) seqPut(seq); return { text: JSON.stringify(head), seq: seq }; }, function () { return { error: 'Sealing failed.' }; });
    },
    open: function (text, pass) {
      var j, head, salt, iv, ct;
      if (!S.vault.available()) return Promise.resolve({ error: 'This browser has no WebCrypto here, so opening is not available.' });
      if (String(text || '').length > 60000000) return Promise.resolve({ error: 'That file is too large to be a sealed backup.' });
      try { j = JSON.parse(String(text || '')); } catch (e) { return Promise.resolve({ error: 'Not a sealed backup file.' }); }
      if (!j || typeof j !== 'object' || j.format !== 'stark-sealed-backup' || (j.v !== 1 && j.v !== 2) || j.kdf !== 'PBKDF2-SHA256' || j.cipher !== 'AES-256-GCM' || typeof j.ct !== 'string' || typeof j.salt !== 'string' || typeof j.iv !== 'string') return Promise.resolve({ error: 'Not a sealed backup file.' });
      if (j.v === 2 && (j.app !== APP || typeof j.created !== 'string' || !(j.seq >= 1 && j.seq <= 1e12 && Math.floor(j.seq) === j.seq))) return Promise.resolve({ error: 'Not a sealed backup from Stark Event Kit.' });
      if (!(typeof j.iter === 'number' && Math.floor(j.iter) === j.iter && j.iter >= MIN_ITER && j.iter <= MAX_ITER)) return Promise.resolve({ error: 'Refused: unreasonable key-stretching setting.' });
      try { salt = unb64(j.salt); iv = unb64(j.iv); ct = unb64(j.ct); } catch (e) { return Promise.resolve({ error: 'The file is damaged.' }); }
      if (salt.length < 16 || iv.length !== 12 || ct.length < 16) return Promise.resolve({ error: 'The file is damaged.' });
      head = headOf(j);
      return S.vault.deriveKey(pass, salt, j.iter).then(function (key) {
        return subtle().decrypt({ name: 'AES-GCM', iv: iv, additionalData: enc.encode(JSON.stringify(head)) }, key, ct);
      }).then(function (pt) {
        var seq = j.v === 2 ? j.seq : 0, last = seqGet();
        return { text: dec.decode(pt), v: j.v, seq: seq, created: j.v === 2 ? j.created : '', older: seq > 0 ? seq < last : last > 0, newest: last };
      }, function () { return { error: 'Wrong passphrase, or the file was changed or damaged. Nothing was restored.' }; });
    }
  };

/* full version only */
  /* ---------- night replay: score race, win odds and question analytics ---------- */
  function asked(s) { return s.questions.map(function (q, i) { return { q: q, i: i }; }).filter(function (x) { return s.marks[x.q.id] && Object.keys(s.marks[x.q.id]).length; }); }
  S.insight = {
    race: function (s) {
      var cum = {}, series = s.teams.map(function (t) { cum[t.id] = 0; return { id: t.id, name: t.name, pts: [0] }; }), steps = [{ label: 'Start', qi: -1 }], leaders = [null], changes = 0, prev = null, adjAny = false;
      asked(s).forEach(function (x) {
        var m = s.marks[x.q.id], top = -Infinity, lead = [], k;
        series.forEach(function (se) {
          var e = m[se.id]; if (e) { if (e.r === 'right') cum[se.id] += S.points(s.scoring, x.q, e.f); else if (e.r === 'wrong') cum[se.id] -= (+s.scoring.penalty || 0); }
          se.pts.push(cum[se.id]);
        });
        series.forEach(function (se) { if (cum[se.id] > top) top = cum[se.id]; });
        series.forEach(function (se) { if (cum[se.id] === top) lead.push(se.id); });
        k = lead.length === 1 ? lead[0] : null;
        if (k && prev && k !== prev) changes++; if (k) prev = k;
        steps.push({ label: 'Q' + (x.i + 1), qi: x.i }); leaders.push(k);
      });
      s.teams.forEach(function (t) { if (s.adj && s.adj[t.id]) adjAny = true; });
      if (adjAny) { series.forEach(function (se) { cum[se.id] += (s.adj[se.id] | 0); se.pts.push(cum[se.id]); }); steps.push({ label: 'Adjustments', qi: -2 }); leaders.push(null); }
      return { steps: steps, series: series, leaders: leaders, leadChanges: changes };
    },
    /* chance each team finishes first if the questions still to come are answered at each team's own observed rate (Laplace-smoothed) */
    winProb: function (s, o) {
      o = o || {};
      var race = S.insight.race(s), n = s.teams.length, steps = race.steps.length, A = asked(s), qrem, runs, rnd = S.rng(o.seed == null ? 99 : o.seed >>> 0), out = [], k, t, r, q, att, right, pr, sc, best, wins, cnt, per, frac;
      if (!n || steps < 2) return { probs: [], steps: race.steps };
      runs = clamp(o.runs || 400, 40, 2000);
      per = steps * n * Math.max(1, A.length) * runs; if (per > 6e7) runs = Math.max(40, Math.floor(runs * 6e7 / per));
      frac = s.mode === 'pub' ? 0 : 0.5;
      for (k = 0; k < steps; k++) {
        qrem = A.slice(Math.min(k, A.length)).map(function (x) { return x.q; });
        pr = s.teams.map(function (tm) { att = 0; right = 0; A.forEach(function (x, ai) { var e; if (ai >= k) return; e = s.marks[x.q.id][tm.id]; if (e) { att++; if (e.r === 'right') right++; } }); return (right + 1) / (att + 2); });
        wins = s.teams.map(function () { return 0; });
        for (r = 0; r < runs; r++) {
          sc = race.series.map(function (se) { return se.pts[k]; });
          for (q = 0; q < qrem.length; q++) for (t = 0; t < n; t++) sc[t] += rnd() < pr[t] ? S.points(s.scoring, qrem[q], frac) : -(+s.scoring.penalty || 0);
          best = Math.max.apply(null, sc); cnt = 0; sc.forEach(function (v) { if (v === best) cnt++; });
          sc.forEach(function (v, i) { if (v === best) wins[i] += 1 / cnt; });
        }
        out.push(wins.map(function (w) { return w / runs; }));
      }
      return { probs: out, steps: race.steps, runs: runs };
    },
    questions: function (s) {
      var rank = S.rank(s.teams, s.scoring.order), n = rank.length, third = Math.max(1, Math.ceil(n / 3)), top = {}, bot = {}, rows;
      rank.slice(0, third).forEach(function (r) { top[r.team.id] = 1; }); if (n >= 4) rank.slice(n - third).forEach(function (r) { bot[r.team.id] = 1; });
      rows = asked(s).map(function (x) {
        var m = s.marks[x.q.id], att = 0, right = 0, tA = 0, tR = 0, bA = 0, bR = 0, id, rate, disc = null, tags = [];
        for (id in m) { att++; if (m[id].r === 'right') right++; if (top[id]) { tA++; if (m[id].r === 'right') tR++; } if (bot[id]) { bA++; if (m[id].r === 'right') bR++; } }
        rate = att ? right / att : 0; if (tA && bA) disc = tR / tA - bR / bA;
        if (att >= 3) {
          if (rate <= 0.2) tags.push('stumper'); if (rate >= 0.9) tags.push('giveaway'); if (disc != null && disc >= 0.5) tags.push('separator');
          if (x.q.diff === 'hard' && rate >= 0.8) tags.push('easier than rated'); if (x.q.diff === 'easy' && rate <= 0.4) tags.push('harder than rated');
        }
        return { n: x.i + 1, id: x.q.id, q: x.q.q, cat: x.q.cat, diff: x.q.diff, attempted: att, right: right, rate: rate, disc: disc, tags: tags };
      });
      return rows;
    },
    awards: function (s) {
      var race = S.insight.race(s), A = asked(s), out = [], best = null, cats = {}, final, winner, deficit = 0, hard = {};
      s.teams.forEach(function (t) {
        var run = 0, mx = 0;
        A.forEach(function (x) { var e = s.marks[x.q.id][t.id]; if (e && e.r === 'right') { run++; if (run > mx) mx = run; } else run = 0; });
        if (!best || mx > best.n) best = { team: t.name, n: mx };
        A.forEach(function (x) { var e = s.marks[x.q.id][t.id], k = t.id + '|' + x.q.cat; if (!e) return; cats[k] = cats[k] || { team: t.name, cat: x.q.cat, a: 0, r: 0 }; cats[k].a++; if (e.r === 'right') cats[k].r++; });
        hard[t.id] = { team: t.name, n: t.hard || 0 };
      });
      if (best && best.n >= 2) out.push({ id: 'streak', title: 'Hot streak', text: best.team + ' got ' + best.n + ' in a row right.' });
      var bc = null; Object.keys(cats).forEach(function (k) { var c = cats[k]; if (c.a >= 3 && (!bc || c.r / c.a > bc.r / bc.a || (c.r / c.a === bc.r / bc.a && c.a > bc.a))) bc = c; });
      if (bc) out.push({ id: 'category', title: 'Category ace', text: bc.team + ' answered ' + bc.r + ' of ' + bc.a + ' ' + S.catName(bc.cat) + ' questions right.' });
      var bh = null; Object.keys(hard).forEach(function (k) { if (hard[k].n > 0 && (!bh || hard[k].n > bh.n)) bh = hard[k]; });
      if (bh) out.push({ id: 'hard', title: 'Hard-question hero', text: bh.team + ' got ' + bh.n + ' hard question' + (bh.n === 1 ? '' : 's') + ' right.' });
      if (race.series.length && race.steps.length > 1) {
        final = race.series.map(function (se) { return se.pts[se.pts.length - 1]; }); var top = Math.max.apply(null, final);
        if (final.filter(function (v) { return v === top; }).length === 1) {
          winner = race.series[final.indexOf(top)];
          race.steps.forEach(function (st, i) { var lead = Math.max.apply(null, race.series.map(function (se) { return se.pts[i]; })); if (lead - winner.pts[i] > deficit) deficit = lead - winner.pts[i]; });
          if (deficit > 0) out.push({ id: 'comeback', title: 'Comeback', text: winner.name + ' won after trailing by ' + deficit + ' point' + (deficit === 1 ? '' : 's') + '.' });
        }
      }
      if (race.leadChanges >= 1) out.push({ id: 'lead', title: 'Lead changes', text: 'The lead changed hands ' + race.leadChanges + ' time' + (race.leadChanges === 1 ? '' : 's') + '.' });
      return out;
    },
    /* the question that moved the most win probability, for a "turning point" call-out */
    turning: function (wp) {
      var best = null, i, t, d;
      for (i = 1; i < wp.probs.length; i++) for (t = 0; t < wp.probs[i].length; t++) { d = Math.abs(wp.probs[i][t] - wp.probs[i - 1][t]); if (!best || d > best.d) best = { step: i, team: t, d: d, from: wp.probs[i - 1][t], to: wp.probs[i][t] }; }
      return best;
    }
  };

  /* ---------- Live autosave to a file the host chooses (File System Access API) ----------
     After the host picks a file once, every successful save writes a complete, checksummed backup to it, a couple of
     seconds after the last change (debounced, one write at a time, the newest state always wins). Browsers without
     showSaveFilePicker (Firefox, Safari, an embedded page) keep the normal backup download. Pure logic with injected
     timer and handle, so it runs under node for the tests. */
  S.autosave = {
    supported: function (w) { w = w || g; return !!(w && typeof w.showSaveFilePicker === 'function'); },
    make: function (o) {
      var st = { handle: null, name: '', pending: false, busy: false, writes: 0, lastAt: 0, error: '', timer: 0, waiting: false },
        delay = o.delay != null ? o.delay : 2000, setT = o.setTimeout || g.setTimeout, clearT = o.clearTimeout || g.clearTimeout;
      function report() { if (o.onStatus) { try { o.onStatus(st); } catch (e) { /* ignore */ } } }
      function permitted() {
        var h = st.handle;
        if (!h || typeof h.queryPermission !== 'function') return Promise.resolve(!!h);
        return Promise.resolve(h.queryPermission({ mode: 'readwrite' })).then(function (p) { return p === 'granted'; }, function () { return false; });
      }
      function writeNow() {
        if (!st.handle) return Promise.resolve(false);
        if (st.busy) { st.pending = true; return Promise.resolve(false); }
        st.busy = true; st.pending = false;
        return permitted().then(function (ok) {
          if (!ok) { st.waiting = true; st.error = 'Autosave is paused: allow access to the file again.'; return false; }
          var text = o.getText(), w;
          return Promise.resolve(st.handle.createWritable()).then(function (ws) { w = ws; return w.write(text); })
            .then(function () { return w.close(); })
            .then(function () { st.writes++; st.lastAt = Date.now(); st.error = ''; st.waiting = false; return true; },
              function (e) { if (w && typeof w.abort === 'function') { try { Promise.resolve(w.abort()).catch(function () { /* ignore */ }); } catch (e2) { /* ignore */ } } throw e; });   // drop the half-written temp copy; the old file stays intact
        }).then(function (r) { st.busy = false; report(); if (st.pending) schedule(); return r; },
          function (e) { st.busy = false; st.error = 'Could not write the autosave file' + (e && e.name ? ' (' + e.name + ')' : '') + '.'; report(); if (st.pending) schedule(); return false; });
      }
      function schedule() { if (!st.handle) return; clearT(st.timer); st.timer = setT(writeNow, delay); }
      return {
        state: st,
        attach: function (handle) { st.handle = handle || null; st.name = handle && handle.name || ''; st.error = ''; st.waiting = false; report(); return handle ? writeNow() : Promise.resolve(false); },
        detach: function () { clearT(st.timer); st.handle = null; st.name = ''; st.waiting = false; st.error = ''; report(); },
        schedule: schedule,
        flush: function () { clearT(st.timer); return writeNow(); },
        resume: function () {   // after a reload the browser asks again; must run from a click
          var h = st.handle;
          if (!h || typeof h.requestPermission !== 'function') return writeNow();
          return Promise.resolve(h.requestPermission({ mode: 'readwrite' })).then(function (p) { if (p === 'granted') { st.waiting = false; return writeNow(); } st.error = 'Access to the file was not allowed.'; report(); return false; });
        }
      };
    }
  };

  /* ---------- Keep the projector awake (Screen Wake Lock) ----------
     While the presenter, prize-draw or overlay screen is open, ask the browser to keep the display on, and ask again
     when the window becomes visible (the lock is dropped whenever it is hidden). Unsupported browsers just carry on. */
  S.wake = {
    make: function (nav, doc) {
      var lock = null, want = false, asking = null, st = { supported: !!(nav && nav.wakeLock && typeof nav.wakeLock.request === 'function'), active: false, error: '' };
      function take() {
        if (asking) return asking;   // one request at a time, so a quick on() plus visibilitychange cannot leak a second lock
        if (!want || !st.supported || lock || (doc && doc.visibilityState && doc.visibilityState !== 'visible')) return Promise.resolve(st.active);
        asking = Promise.resolve(nav.wakeLock.request('screen')).then(function (l) {
          asking = null;
          if (!want) { try { Promise.resolve(l && l.release()).catch(function () { /* ignore */ }); } catch (e) { /* ignore */ } return false; }   // switched off while asking
          lock = l; st.active = true; st.error = '';
          if (l && l.addEventListener) l.addEventListener('release', function () { if (lock === l) { lock = null; st.active = false; } });
          return true;
        }, function (e) { asking = null; st.error = e && e.name || 'refused'; return false; });
        return asking;
      }
      function vis() { if (doc && doc.visibilityState === 'visible') take(); }
      return {
        state: st,
        on: function () { if (!want && doc && doc.addEventListener) doc.addEventListener('visibilitychange', vis); want = true; return take(); },
        off: function () {
          want = false; if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', vis);
          if (lock) { var l = lock; lock = null; st.active = false; try { return Promise.resolve(l.release()).then(function () { return true; }, function () { return true; }); } catch (e) { /* ignore */ } }
          return Promise.resolve(true);
        }
      };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
