/* Stark Career 2.2 edge engine: search forecast (seeded Monte Carlo), pipeline river layout, plain-words query over your own data,
   and sealed (AES-GCM) backups. Pure functions, no network, no eval. Everything is computed from numbers you entered. */
(function () {
  "use strict";
  var E = SC.edge = {};
  var SENT = { applied: 1, screening: 1, interview: 1, offer: 1, accepted: 1, rejected: 1, withdrawn: 1 };

  function hist(a) { return Array.isArray(a && a.history) ? a.history.filter(function (h) { return h && typeof h.stage === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.date || ""); }) : []; }
  function firstDate(a, stages) {
    var h = hist(a), best = null;
    h.forEach(function (x) { if (stages.indexOf(x.stage) >= 0 && (best === null || x.date < best)) best = x.date; });
    return best;
  }
  var INTERVIEWED = ["interview", "offer", "accepted"], OFFERED = ["offer", "accepted"];
  E.mulberry = function (seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function shrink(k, n, prior, w) { return (k + prior * w) / (n + w); }

  /* Funnel rates from your own tracker, shrunk toward cautious starting values while you have few applications. */
  E.rates = function (apps, today) {
    var sent = 0, toIv = 0, ivN = 0, toOf = 0, lagIv = [], lagOf = [], last28 = 0;
    (apps || []).forEach(function (a) {
      var ap = firstDate(a, ["applied"]) || (SENT[a.stage] ? firstDate(a, [a.stage]) : null);
      if (!ap) return;
      var iv = firstDate(a, INTERVIEWED), of = firstDate(a, OFFERED), age = SC.daysBetween(ap, today);
      sent++;
      var d = SC.daysBetween(ap, today); if (d !== null && d >= 0 && d < 28) last28++;
      if (iv || age > 21 || a.stage === "rejected" || a.stage === "withdrawn") { ivN++; if (iv) { toIv++; var l = SC.daysBetween(ap, iv); if (l !== null && l >= 0) lagIv.push(l); } }
      if (iv) {
        var ia = SC.daysBetween(iv, today);
        if (of || a.stage === "rejected" || a.stage === "withdrawn" || ia > 14) { if (of) { toOf++; var l2 = SC.daysBetween(iv, of); if (l2 !== null && l2 >= 0) lagOf.push(l2); } }
      }
    });
    var ivDone = 0; (apps || []).forEach(function (a) {
      var iv = firstDate(a, INTERVIEWED); if (!iv) return;
      var of = firstDate(a, OFFERED), ia = SC.daysBetween(iv, today);
      if (of || a.stage === "rejected" || a.stage === "withdrawn" || ia > 14) ivDone++;
    });
    return {
      sent: sent, perWeek: Math.round(last28 / 4 * 10) / 10,
      pInterview: shrink(toIv, ivN, 0.12, 8), pOffer: shrink(toOf, ivDone, 0.25, 6),
      lagInterview: lagIv.length ? Math.max(3, Math.round(median(lagIv))) : 14, lagOffer: lagOf.length ? Math.max(2, Math.round(median(lagOf))) : 10,
      observedInterview: ivN ? toIv / ivN : null, observedOffer: ivDone ? toOf / ivDone : null, confidence: sent >= 30 ? "good" : sent >= 12 ? "fair" : "low"
    };
  };

  function poisson(lam, rnd) { if (lam <= 0) return 0; var L = Math.exp(-Math.min(lam, 40)), k = 0, p = 1; do { k++; p *= rnd(); } while (p > L && k < 200); return k - 1; }

  /* Seeded Monte Carlo: chance of at least one offer by each week. o: {perWeek, mult (interview-rate multiplier), weeks, runs, seed, haveOffer}.
     Same inputs always give the same curve. This is arithmetic on your own numbers, not a prediction of any real outcome. */
  E.forecast = function (rates, o) {
    o = o || {};
    var weeks = Math.min(52, Math.max(4, Math.round(o.weeks || 26))), runs = Math.min(5000, Math.max(100, Math.round(o.runs || 1500)));
    var perWeek = Math.max(0, Math.min(60, +o.perWeek || 0)), mult = Math.max(0.1, Math.min(4, +o.mult || 1));
    var pI = Math.min(0.95, rates.pInterview * mult), pO = rates.pOffer, rnd = E.mulberry(o.seed == null ? 20260101 : o.seed);
    var hit = [], firstWeek = [], iv = 0, w, r, i;
    for (w = 0; w <= weeks; w++) hit.push(0);
    for (r = 0; r < runs; r++) {
      var first = o.haveOffer ? 0 : Infinity, ivs = 0;
      for (w = 0; w < weeks && first > 0; w++) {
        var n = poisson(perWeek, rnd);
        for (i = 0; i < n; i++) {
          if (rnd() >= pI) continue;
          ivs++;
          var tIv = w + (rates.lagInterview * (0.5 + rnd())) / 7;
          if (rnd() >= pO) continue;
          var tOf = tIv + (rates.lagOffer * (0.5 + rnd())) / 7;
          if (tOf < first) first = tOf;
        }
      }
      iv += ivs;
      if (first <= weeks) { var wk = Math.max(0, Math.ceil(first)); for (w = wk; w <= weeks; w++) hit[w]++; firstWeek.push(first); }
    }
    var curve = hit.map(function (h) { return h / runs; });
    function whenP(p) { for (var k = 0; k <= weeks; k++) if (curve[k] >= p) return k; return null; }
    return { weeks: weeks, runs: runs, curve: curve, week50: whenP(0.5), week80: whenP(0.8), weeks10: whenP(0.1), interviewsPerRun: Math.round(iv / runs * 10) / 10, atEnd: curve[weeks] };
  };

  /* Stage flows for the river diagram. Counts steps between consecutive history entries. */
  var ORDER = ["wishlist", "applied", "screening", "interview", "offer", "accepted"], SIDE = ["rejected", "withdrawn"];
  var COL = { wishlist: 0, applied: 1, screening: 2, interview: 3, offer: 4, accepted: 5, rejected: 5, withdrawn: 5 };
  E.flows = function (apps) {
    var links = {}, nodes = {};
    (apps || []).forEach(function (a) {
      var h = hist(a); if (!h.length) return;
      h.forEach(function (x, i) { nodes[x.stage] = (nodes[x.stage] || 0) + (i === 0 ? 1 : 0); });
      for (var i = 1; i < h.length; i++) { var k = h[i - 1].stage + ">" + h[i].stage; links[k] = (links[k] || 0) + 1; }
    });
    var out = { nodes: [], links: [] };
    Object.keys(links).forEach(function (k) { var p = k.split(">"); if (COL[p[0]] != null && COL[p[1]] != null && p[0] !== p[1]) out.links.push({ from: p[0], to: p[1], n: links[k] }); });
    var seen = {}; out.links.forEach(function (l) { seen[l.from] = 1; seen[l.to] = 1; });
    ORDER.concat(SIDE).forEach(function (s) {
      if (!seen[s]) return;
      var inn = 0, outn = 0; out.links.forEach(function (l) { if (l.to === s) inn += l.n; if (l.from === s) outn += l.n; });
      out.nodes.push({ id: s, col: COL[s], n: Math.max(inn, outn, nodes[s] || 0), start: nodes[s] || 0 });
    });
    return out;
  };
  /* Pure layout: node rectangles and ribbon paths in a W x H box. */
  E.river = function (apps, W, H) {
    var f = E.flows(apps), pad = 10, nw = 14, gap = 12, cols = 6, byCol = {};
    if (!f.links.length) return { nodes: [], links: [], empty: true, W: W, H: H };
    f.nodes.forEach(function (n) { (byCol[n.col] = byCol[n.col] || []).push(n); });
    var scale = Infinity;
    Object.keys(byCol).forEach(function (c) {
      var tot = 0; byCol[c].forEach(function (n) { tot += n.n; });
      scale = Math.min(scale, (H - 2 * pad - gap * (byCol[c].length - 1)) / Math.max(1, tot));
    });
    scale = Math.min(scale, 40);
    var colX = function (c) { return pad + c * ((W - 2 * pad - nw) / (cols - 1)); }, pos = {};
    Object.keys(byCol).forEach(function (c) {
      var list = byCol[c].sort(function (a, b) { return (ORDER.indexOf(a.id) < 0 ? 9 : 0) - (ORDER.indexOf(b.id) < 0 ? 9 : 0) || ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });
      var tot = 0; list.forEach(function (n) { tot += n.n * scale; }); tot += gap * (list.length - 1);
      var y = pad + Math.max(0, (H - 2 * pad - tot) / 2);
      list.forEach(function (n) { pos[n.id] = { id: n.id, n: n.n, x: colX(+c), y: y, h: Math.max(3, n.n * scale), inY: 0, outY: 0, w: nw }; y += n.n * scale + gap; });
    });
    var links = f.links.slice().sort(function (a, b) { return COL[a.to] - COL[b.to] || ORDER.indexOf(a.to) - ORDER.indexOf(b.to); }).map(function (l) {
      var a = pos[l.from], b = pos[l.to], th = Math.max(1.5, l.n * scale);
      var y0 = a.y + a.outY + th / 2, y1 = b.y + b.inY + th / 2; a.outY += th; b.inY += th;
      var x0 = a.x + a.w, x1 = b.x, mx = (x0 + x1) / 2;
      return { from: l.from, to: l.to, n: l.n, w: th, d: "M" + r1(x0) + " " + r1(y0) + "C" + r1(mx) + " " + r1(y0) + " " + r1(mx) + " " + r1(y1) + " " + r1(x1) + " " + r1(y1) };
    });
    return { nodes: Object.keys(pos).map(function (k) { return pos[k]; }), links: links, W: W, H: H };
  };
  function r1(n) { return Math.round(n * 10) / 10; }

  /* ---------- plain-words query ---------- */
  function grams(s) { s = " " + String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " "; var o = {}, i; for (i = 0; i < s.length - 2; i++) o[s.substr(i, 3)] = 1; return o; }
  E.fuzzy = function (q, text) {
    q = String(q).toLowerCase().trim(); text = String(text).toLowerCase(); if (!q || !text) return 0;
    if (text.indexOf(q) >= 0) return 1;
    var qs = q.split(/\s+/), hit = 0;
    qs.forEach(function (w) { if (w.length > 1 && text.indexOf(w) >= 0) hit++; });
    var a = grams(q), b = grams(text), inter = 0, na = 0, nb = 0, k;
    for (k in a) { na++; if (b[k]) inter++; } for (k in b) nb++;
    var dice = na + nb ? 2 * inter / (na + nb) : 0, cover = na ? inter / na : 0;
    return Math.max(hit / qs.length * 0.9, cover * 0.85, dice);
  };
  var STAGE_WORDS = [["wishlist", /wish ?list|saved|to apply/], ["applied", /\bapplied|submitted|sent\b/], ["screening", /screen/], ["interview", /interview/], ["offer", /\boffers?\b/], ["accepted", /accept/], ["rejected", /reject|turned down|declined/], ["withdrawn", /withdr/]];
  var STOP = /\b(show|me|list|find|get|all|the|my|of|a|an|which|what|who|are|is|have|has|had|that|with|for|any|how|many|please|jobs?|applications?|apps?|roles?|positions?|contacts?|people|persons?|and|to|i|in|on|from|at|by|since|than|over|older|longer|days?|weeks?|months?|ago|last|this|past|no|not|yet|reply|replies|response|responses|heard|back|ghosted|silent|stale|overdue|due|follow|ups?|up|oldest|newest|recent|latest|today|week|month|summary|count|total|number|reached|touch|contacted|haven't|havent|there|been|were|was|me|about|next|upcoming|waiting|pending|open|active|still|anything|something|everything|related|regarding|where|when|do|does|did|can|you|see|tell|give|display|need|should|would|could|it|they|them|we|our|us|your|be|so|or|if|but)\b/g;

  function windowDays(q, today) {
    var m = /(\d+)\s*(day|week|month)s?/.exec(q), n = null;
    if (m) n = +m[1] * (m[2] === "week" ? 7 : m[2] === "month" ? 30 : 1);
    if (/last week|past week|this week/.test(q) && n === null) n = 7;
    if (/last month|past month|this month/.test(q) && n === null) n = 30;
    return n;
  }
  /* Answer a plain-words question about your applications, contacts and wins. Returns {kind, title, said:[how it was read], rows:[{text, meta, href}]}. */
  E.ask = function (q, S, today) {
    q = String(q || "").toLowerCase().replace(/[^\w\s'+#.-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    var res = { kind: "apps", title: "", said: [], rows: [], q: q };
    if (!q) { res.title = "Ask a question"; return res; }
    var apps = S.apps || [], contacts = S.contacts || [], wins = S.wins || [], i;
    var days = windowDays(q, today), wantContacts = /contact|people|person|network|reach out|hello|catch up|touch/.test(q) && !/application|\bapps?\b|job/.test(q);
    var wantWins = /\bwins?\b|achievement|brag/.test(q), wantRefs = /reference/.test(q);
    var quiet = /no (reply|response)|not heard|haven't heard|havent heard|ghost|silent|stale|waiting|no word|gone quiet|heard back/.test(q) && !/^heard back/.test(q);
    var overdue = /overdue|due|follow ?-?ups?/.test(q), rest = q.replace(STOP, " ").replace(/\b\d+\b/g, " ");
    STAGE_WORDS.forEach(function (sw) { rest = rest.replace(new RegExp("(?:" + sw[1].source + ")[a-z]*", "g"), " "); });
    rest = rest.replace(/\s+/g, " ").trim();
    var count = /how many|count|number of|total/.test(q), sortOld = /oldest/.test(q), sortNew = /newest|latest|recent/.test(q);
    if (wantWins) {
      res.kind = "wins"; res.said.push("looking in your wins log");
      var wl = wins.filter(function (w) { return w && (rest ? E.fuzzy(rest, (w.action || "") + " " + (w.result || "") + " " + (w.tags || "")) > 0.5 : true) && (days === null || SC.daysBetween(w.date, today) <= days); });
      wl.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      res.title = wl.length + " win" + (wl.length === 1 ? "" : "s");
      res.rows = wl.slice(0, 40).map(function (w) { return { text: SC.winBullet(w), meta: w.date, href: "#/wins" }; });
      return res;
    }
    if (wantRefs) {
      res.kind = "refs"; res.said.push("looking at your references");
      var rl = (S.refs || []).filter(function (r) { return r && (rest ? E.fuzzy(rest, r.name + " " + r.company) > 0.5 : true); });
      res.title = rl.length + " reference" + (rl.length === 1 ? "" : "s");
      res.rows = rl.slice(0, 40).map(function (r) { return { text: r.name || "(no name)", meta: [r.title, r.company, r.status].filter(Boolean).join(" / "), href: "#/contacts/refs" }; });
      return res;
    }
    if (wantContacts) {
      res.kind = "contacts"; res.said.push("looking at your contacts");
      var list = contacts.map(function (c) { var nx = SC.contactNext(c, today); return { c: c, late: SC.daysBetween(nx, today), since: c.last ? SC.daysBetween(c.last, today) : null }; });
      if (overdue || quiet || days !== null) {
        if (days !== null && !overdue) { res.said.push("not contacted in " + days + "+ days"); list = list.filter(function (x) { return x.since === null || x.since >= days; }); }
        else { res.said.push("due for a hello"); list = list.filter(function (x) { return x.late >= 0; }); }
      }
      if (rest) { res.said.push('matching "' + rest + '"'); list = list.filter(function (x) { return E.fuzzy(rest, x.c.name + " " + x.c.company + " " + x.c.role) > 0.5; }); }
      list.sort(function (a, b) { return (b.late || -999) - (a.late || -999); });
      res.title = list.length + " contact" + (list.length === 1 ? "" : "s");
      res.rows = list.slice(0, 60).map(function (x) { return { text: x.c.name || "(no name)", meta: [x.c.company, x.since === null ? "never contacted" : x.since + " days since last touch"].filter(Boolean).join(" / "), href: "#/contacts" }; });
      return res;
    }
    var list2 = apps.map(function (a) {
      var h = hist(a), ap = firstDate(a, ["applied"]), lastD = h.length ? h[h.length - 1].date : null;
      return { a: a, applied: ap, last: lastD, quietDays: lastD ? SC.daysBetween(lastD, today) : null };
    });
    var stage = null; STAGE_WORDS.forEach(function (sw) { if (stage === null && sw[1].test(q)) stage = sw[0]; });
    if (quiet) { stage = stage || "applied"; res.said.push("stage " + stage); var min = days === null ? 14 : days; res.said.push("no change in " + min + "+ days"); list2 = list2.filter(function (x) { return x.a.stage === stage && x.quietDays !== null && x.quietDays >= min; }); }
    else {
      if (stage) { res.said.push("stage " + stage); list2 = list2.filter(function (x) { return x.a.stage === stage; }); }
      if (overdue) { res.said.push("follow-up date has passed"); list2 = list2.filter(function (x) { return x.a.followUp && x.a.followUp <= today; }); }
      else if (days !== null && /last|past|this|ago|within|since/.test(q)) { res.said.push("changed in the last " + days + " days"); list2 = list2.filter(function (x) { return x.quietDays !== null && x.quietDays <= days; }); }
      else if (days !== null) { res.said.push(days + "+ days since last change"); list2 = list2.filter(function (x) { return x.quietDays !== null && x.quietDays >= days; }); }
    }
    if (rest) {
      var scored = list2.map(function (x) { return { x: x, s: E.fuzzy(rest, [x.a.company, x.a.role, x.a.notes].join(" ")) }; }).filter(function (z) { return z.s >= 0.5; });
      if (scored.length || !stage) { res.said.push('matching "' + rest + '"'); list2 = scored.sort(function (a, b) { return b.s - a.s; }).map(function (z) { return z.x; }); }
      else { res.said.push('"' + rest + '" matched nothing'); list2 = []; }
    }
    if (!stage && !quiet && !overdue && days === null && !rest) { res.said.push("all applications"); }
    if (sortOld) list2.sort(function (a, b) { return (b.quietDays || 0) - (a.quietDays || 0); });
    else if (sortNew) list2.sort(function (a, b) { return (a.quietDays == null ? 9e9 : a.quietDays) - (b.quietDays == null ? 9e9 : b.quietDays); });
    else if (quiet) list2.sort(function (a, b) { return (b.quietDays || 0) - (a.quietDays || 0); });
    res.title = list2.length + " application" + (list2.length === 1 ? "" : "s") + (count ? "" : "");
    res.rows = list2.slice(0, 60).map(function (x) {
      return { text: (x.a.company || "(no company)") + (x.a.role ? " - " + x.a.role : ""), meta: x.a.stage + (x.quietDays != null ? ", last change " + x.quietDays + " days ago" : "") + (x.a.followUp ? ", follow-up " + x.a.followUp : ""), href: "#/tracker" };
    });
    return res;
  };
  /* Search every list at once. Returns best matches first. */
  E.searchAll = function (q, S) {
    var out = [];
    function add(kind, text, meta, href, hay) { var s = E.fuzzy(q, hay); if (s >= 0.5) out.push({ kind: kind, text: text, meta: meta, href: href, s: s }); }
    (S.apps || []).forEach(function (a) { add("Application", (a.company || "") + (a.role ? " - " + a.role : ""), a.stage, "#/tracker", [a.company, a.role, a.notes].join(" ")); });
    (S.contacts || []).forEach(function (c) { add("Contact", c.name, c.company, "#/contacts", [c.name, c.company, c.role, c.notes].join(" ")); });
    (S.wins || []).forEach(function (w) { add("Win", SC.winBullet(w), w.date, "#/wins", [w.action, w.result, w.tags].join(" ")); });
    (S.versions || []).forEach(function (v) { add("Resume version", v.name, [v.company, v.role].filter(Boolean).join(" / "), "#/match", [v.name, v.company, v.role].join(" ")); });
    return out.sort(function (a, b) { return b.s - a.s; }).slice(0, 40);
  };

  /* ---------- sealed backup: AES-256-GCM, key from a passphrase with PBKDF2-SHA256 ---------- */
  var MAGIC = "StarkCareerSealed", ITER = 600000, ITER_MIN = 100000, ITER_MAX = 10000000;
  // v2 binds the header (version, rounds, salt) to the ciphertext as AES-GCM additional data, so a file whose rounds or salt
  // were edited (for example to weaken the key derivation) fails to open. v1 files (AAD = MAGIC + "1") still open.
  function aadFor(v, iter, salt) { return new TextEncoder().encode(v === 1 ? MAGIC + "1" : MAGIC + "|2|" + iter + "|" + salt); }
  E.ITER_MIN = ITER_MIN; E.ITER_MAX = ITER_MAX;
  function b64(buf) { var b = new Uint8Array(buf), s = "", i; for (i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s); }
  function unb64(s) { var bin = atob(String(s)), b = new Uint8Array(bin.length), i; for (i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
  E.canSeal = function () { return !!(typeof crypto !== "undefined" && crypto.subtle && crypto.getRandomValues && typeof TextEncoder !== "undefined"); };
  function deriveKey(pass, salt, iter, usage) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(String(pass).normalize("NFKC")), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, usage);
    });
  }
  /* Rough passphrase strength: bits from length and character classes, minus repeats. Returns {bits, label, ok}. */
  E.strength = function (p) {
    p = String(p || ""); var pool = 0; if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10; if (/[^A-Za-z0-9]/.test(p)) pool += 32;
    var uniq = {}; p.split("").forEach(function (c) { uniq[c] = 1; });
    var bits = pool ? Math.round(Math.log(pool) / Math.LN2 * Math.min(p.length, Object.keys(uniq).length * 2)) : 0;
    if (/^(.)\1+$/.test(p) || /^(password|12345678|qwertyui)/i.test(p)) bits = Math.min(bits, 10);
    return { bits: bits, label: bits >= 80 ? "strong" : bits >= 55 ? "fair" : "weak", ok: p.length >= 12 && bits >= 55 };
  };
  E.seal = function (plain, pass, iter) {
    if (!E.canSeal()) return Promise.reject(new Error("this browser has no WebCrypto"));
    iter = Math.max(ITER_MIN, Math.min(ITER_MAX, Math.round(+iter || ITER)));
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), saltB = b64(salt), aad = aadFor(2, iter, saltB);
    return deriveKey(pass, salt, iter, ["encrypt"]).then(function (k) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: aad }, k, new TextEncoder().encode(plain));
    }).then(function (ct) {
      return JSON.stringify({ app: "Stark Career", format: MAGIC, v: 2, kdf: "PBKDF2-SHA256", iter: iter, salt: saltB, iv: b64(iv), ct: b64(ct), created: new Date().toISOString() });
    });
  };
  E.isSealed = function (text) { try { var o = JSON.parse(text); return !!(o && o.format === MAGIC); } catch (e) { return false; } };
  E.unseal = function (text, pass) {
    var o; try { o = JSON.parse(text); } catch (e) { return Promise.reject(new Error("the file is not valid")); }
    if (!o || o.format !== MAGIC || (o.v !== 1 && o.v !== 2) || o.kdf !== "PBKDF2-SHA256" || typeof o.salt !== "string" || typeof o.iv !== "string" || typeof o.ct !== "string") return Promise.reject(new Error("this is not a sealed Stark Career backup"));
    if (typeof o.iter !== "number" || Math.floor(o.iter) !== o.iter || !(o.iter >= ITER_MIN && o.iter <= ITER_MAX)) return Promise.reject(new Error("the file has unsupported settings"));
    if (o.ct.length > 120000000 || o.salt.length > 64 || o.iv.length > 64) return Promise.reject(new Error("the file is too large or damaged"));
    if (!E.canSeal()) return Promise.reject(new Error("this browser has no WebCrypto"));
    var salt, iv, ct; try { salt = unb64(o.salt); iv = unb64(o.iv); ct = unb64(o.ct); } catch (e) { return Promise.reject(new Error("the file is damaged")); }
    if (salt.length !== 16 || iv.length !== 12 || ct.length < 17) return Promise.reject(new Error("the file is damaged"));
    return deriveKey(pass, salt, o.iter, ["decrypt"]).then(function (k) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv, additionalData: aadFor(o.v, o.iter, o.salt) }, k, ct);
    }).then(function (pt) { return new TextDecoder().decode(pt); }, function () { throw new Error("wrong passphrase, or the file was changed"); });
  };
})();
