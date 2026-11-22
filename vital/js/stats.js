/* Stark Vital: statistics (pure, no DOM, no network). Plain methods only: Spearman rank correlation, Cliff's delta, medians, a
   seeded block bootstrap and a seeded block-shuffle permutation test, Benjamini-Hochberg selection, an autocorrelation correction.
   Seeds are fixed from the data, so the same entries always give the same numbers. Every sentence the app says about a pattern
   is built here from fixed templates. */
(function (root) {
  "use strict";
  var V = root.StarkVital || (typeof require === "function" ? require("./core.js") : null);
  var D = root.VitalData || (typeof require === "function" ? require("./data.js") : null);
  var S = {};
  var MIN_PAIRS = 21, MIN_LEVEL = 5, SKIP_FIRST = 3, BLOCK = 3, BOOT = 2000, PERM = 2000, Q = 0.20;

  /* ---- primitives ---- */
  function sum(a) { var s = 0, i; for (i = 0; i < a.length; i++) s += a[i]; return s; }
  function mean(a) { return a.length ? sum(a) / a.length : NaN; }
  function median(a) { if (!a.length) return NaN; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function sd(a) { if (a.length < 2) return 0; var m = mean(a), s = 0, i; for (i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return Math.sqrt(s / (a.length - 1)); }   // sample SD (n - 1)
  function quantile(sorted, p) { var pos = (sorted.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo); }
  function rank(a) {   // average ranks for ties, 1-based
    var idx = a.map(function (v, i) { return i; }).sort(function (i, j) { return a[i] - a[j]; }), r = new Array(a.length), i = 0, j, k, avg;
    while (i < idx.length) { j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++; avg = (i + j) / 2 + 1; for (k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1; }
    return r;
  }
  function pearson(x, y) {
    var mx = mean(x), my = mean(y), sxy = 0, sxx = 0, syy = 0, i;
    for (i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my); }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  }
  function spearman(x, y) { return pearson(rank(x), rank(y)); }
  function cliff(a, b) {   // P(a > b) - P(a < b)
    var gt = 0, lt = 0, i, j;
    if (!a.length || !b.length) return 0;
    for (i = 0; i < a.length; i++) for (j = 0; j < b.length; j++) { if (a[i] > b[j]) gt++; else if (a[i] < b[j]) lt++; }
    return (gt - lt) / (a.length * b.length);
  }
  function acf1(a) {   // lag-1 autocorrelation
    var m = mean(a), num = 0, den = 0, i;
    for (i = 0; i < a.length; i++) { den += (a[i] - m) * (a[i] - m); if (i + 1 < a.length) num += (a[i] - m) * (a[i + 1] - m); }
    return den > 0 ? num / den : 0;
  }
  function nEff(n, r1) { return r1 > 0 ? n * (1 - r1) / (1 + r1) : n; }
  function prng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashSeed(s) { var h = 2166136261, i; for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Benjamini-Hochberg: which p-values pass a false discovery rate of q.
  function bh(ps, q) {
    var m = ps.length, idx = ps.map(function (p, i) { return i; }).sort(function (a, b) { return ps[a] - ps[b]; }), cut = -1, k, out = ps.map(function () { return false; });
    for (k = 0; k < m; k++) if (ps[idx[k]] <= (k + 1) / m * q) cut = k;
    for (k = 0; k <= cut; k++) out[idx[k]] = true;
    return out;
  }
  // Remove the weekday pattern: each value minus the mean of its weekday (weekday numbers 0-6).
  function residualWeekday(vals, wd) {
    var sums = {}, cnt = {}, i;
    for (i = 0; i < vals.length; i++) { sums[wd[i]] = (sums[wd[i]] || 0) + vals[i]; cnt[wd[i]] = (cnt[wd[i]] || 0) + 1; }
    return vals.map(function (v, i) { return v - sums[wd[i]] / cnt[wd[i]]; });
  }
  // Moving-block resample: indices 0..n-1 drawn as runs of `bs` consecutive positions (keeps day-to-day carry-over).
  function blockResample(n, bs, rnd) {
    var out = [], b = Math.min(bs, n), s, k;
    while (out.length < n) { s = Math.floor(rnd() * (n - b + 1)); for (k = 0; k < b && out.length < n; k++) out.push(s + k); }
    return out;
  }
  // Block-shuffle p-value for a rank correlation: the outcome ranks are moved in blocks of `bs` (two-sided, with the +1 rule).
  function permP(rx, ry, rnd, N, bs) {
    var n = rx.length, mx = mean(rx), my = mean(ry), sxx = 0, syy = 0, obs, i, cnt = 0, nb = Math.ceil(n / bs), order, t, j, k, r, pos, sxy;
    for (i = 0; i < n; i++) { sxx += (rx[i] - mx) * (rx[i] - mx); syy += (ry[i] - my) * (ry[i] - my); }
    if (!(sxx > 0 && syy > 0)) return 1;
    sxy = 0; for (i = 0; i < n; i++) sxy += (rx[i] - mx) * (ry[i] - my); obs = Math.abs(sxy / Math.sqrt(sxx * syy));
    for (t = 0; t < N; t++) {
      order = []; for (i = 0; i < nb; i++) order.push(i);
      for (i = nb - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); k = order[i]; order[i] = order[j]; order[j] = k; }
      pos = 0; sxy = 0;
      for (i = 0; i < nb; i++) for (k = order[i] * bs; k < Math.min(n, order[i] * bs + bs); k++) { sxy += (rx[pos] - mx) * (ry[k] - my); pos++; }
      r = Math.abs(sxy / Math.sqrt(sxx * syy));
      if (r >= obs - 1e-12) cnt++;
    }
    return (1 + cnt) / (1 + N);
  }

  /* ---- pattern finder ---- */
  // One (exposure, outcome, lag) pair: collects the paired days, applies the exclusions and the minimum-sample gates.
  function pairData(d, E, O, lag, dates) {
    var first = dates.length ? dates[0] : null, x = [], y = [], wd = [], dts = [], i, date, od, ex, ov;
    for (i = 0; i < dates.length; i++) {
      date = dates[i];
      if (V.daysBetween(first, date) < SKIP_FIRST) continue;
      od = lag ? V.addDays(date, lag) : date;
      if (!d.days[od] || D.flagged(d, date) || D.flagged(d, od)) continue;
      ex = E.get(d, date); ov = O.get(d, od);
      if (ex === null || ex === undefined || ov === null || ov === undefined) continue;
      x.push(ex); y.push(ov); wd.push(D.weekday(od)); dts.push(date);
    }
    return { x: x, y: y, wd: wd, dates: dts };
  }
  function gate(p) {   // returns a reason string when the pair cannot be tested yet, else ""
    var n = p.x.length, counts = {}, mode = 0, i, k, minority;
    if (n < MIN_PAIRS) return "Not enough days yet: " + n + " of the " + MIN_PAIRS + " needed.";
    for (i = 0; i < n; i++) counts[p.x[i]] = (counts[p.x[i]] || 0) + 1;
    for (k in counts) if (counts[k] > mode) mode = counts[k];
    minority = n - mode;
    if (Object.keys(counts).length < 2) return "This did not vary, so there is nothing to compare.";
    if (minority < MIN_LEVEL) return "Not enough variety yet: fewer than " + MIN_LEVEL + " days that differ.";
    return "";
  }
  function bootCI(p, E, N, rnd, r1) {
    var n = p.x.length, rhos = [], diffs = [], i, t, idx, x, y, yres, w, wo, f = 1, binary = E.type === "bin", yr = residualWeekday(p.y, p.wd);
    for (t = 0; t < N; t++) {
      idx = blockResample(n, BLOCK, rnd); x = new Array(n); yres = new Array(n); w = []; wo = [];
      for (i = 0; i < n; i++) { x[i] = p.x[idx[i]]; yres[i] = yr[idx[i]]; if (binary) { if (x[i] === 1) w.push(p.y[idx[i]]); else wo.push(p.y[idx[i]]); } }
      rhos.push(spearman(x, yres)); if (binary && w.length && wo.length) diffs.push(mean(w) - mean(wo));
    }
    rhos.sort(function (a, b) { return a - b; }); diffs.sort(function (a, b) { return a - b; });
    var ne = nEff(n, r1); if (r1 > 0.6) f = Math.sqrt(n / ne);   // very smooth outcomes carry less information per day: widen
    function ci(arr, est) { var lo = quantile(arr, 0.05), hi = quantile(arr, 0.95); return [est - (est - lo) * f, est + (hi - est) * f]; }
    var rho = spearman(p.x, yr);
    return { rho: ci(rhos, rho), diff: binary && diffs.length ? ci(diffs, mean(p.y.filter(function (_, i) { return p.x[i] === 1; })) - mean(p.y.filter(function (_, i) { return p.x[i] !== 1; }))) : null, widen: f, nEff: ne };
  }
  function band(r) { r = Math.abs(r); return r < 0.10 ? "none" : r < 0.30 ? "small" : r < 0.50 ? "moderate" : "strong"; }
  function certainty(ci, n) { return ci && (ci[0] > 0 || ci[1] < 0) ? (n >= 45 ? "fairly sure" : "leaning") : "could be chance"; }

  // d: decrypted record. Returns { pairs, n } with one entry per candidate pair. opts: { boot, perm, q, maxBoot }
  function patterns(d, opts) {
    opts = opts || {};
    var dates = D.dates(d), pairs = [], boot = opts.boot || BOOT, perm = opts.perm || PERM, q = opts.q || Q;
    D.EXPOSURES.forEach(function (E) {
      [0, 1].forEach(function (lag) {
        ((lag ? E.lag1 : E.lag0) || []).forEach(function (oid) {
          var O = D.outcome(oid), p;
          if (E.id === O.id) return;
          p = pairData(d, E, O, lag, dates);
          var item = { key: E.id + ">" + O.id + "@" + lag, E: E.id, O: O.id, lag: lag, n: p.x.length, eligible: false, reason: gate(p), p: 1, pass: false, rho: 0, band: "none", cert: "could be chance", ci: null, diff: null, delta: null, nWith: 0, nWithout: 0 };
          if (!item.reason) {
            var yr = residualWeekday(p.y, p.wd), rnd = prng(hashSeed(item.key + "|" + p.x.length + "|" + sum(p.x) + "|" + sum(p.y)));
            item.eligible = true; item.rho = spearman(p.x, yr); item.band = band(item.rho);
            item.p = permP(rank(p.x), rank(yr), rnd, perm, BLOCK); item.r1 = acf1(p.y);
            if (E.type === "bin") {
              var w = p.y.filter(function (_, i) { return p.x[i] === 1; }), wo = p.y.filter(function (_, i) { return p.x[i] !== 1; });
              item.nWith = w.length; item.nWithout = wo.length; item.diff = mean(w) - mean(wo); item.delta = cliff(w, wo);
            }
            item._p = p;
          }
          pairs.push(item);
        });
      });
    });
    var el = pairs.filter(function (x) { return x.eligible; }), pass = bh(el.map(function (x) { return x.p; }), q);
    el.forEach(function (x, i) { x.pass = pass[i]; x.q = q; });
    // intervals: for the pairs that pass or are close, and at most maxBoot of them (cheap enough for a year of data)
    el.slice().sort(function (a, b) { return a.p - b.p; }).slice(0, opts.maxBoot || 14).forEach(function (x) {
      if (!(x.pass || x.p < 0.15)) return;
      var E = D.exposure(x.E), rnd = prng(hashSeed(x.key + "|boot|" + x.n)), ci = bootCI(x._p, E, boot, rnd, x.r1);
      x.ci = ci.rho; x.diffCI = ci.diff; x.nEffAdj = ci.nEff; x.widen = ci.widen; x.cert = certainty(ci.rho, x.n);
    });
    pairs.forEach(function (x) { delete x._p; });
    return { pairs: pairs, n: D.dates(d).length, q: q, tested: el.length };
  }

  /* ---- plain words ---- */
  function fmtNum(v, dp) { return (Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp)).toFixed(dp).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1"); }
  function amount(O, v) { v = Math.abs(v); if (O.unit === "min") return Math.round(v) + (Math.round(v) === 1 ? " minute" : " minutes"); var t = fmtNum(v, 1); return t + (t === "1" ? " point" : " points"); }
  function when(lag, O) { return lag === 1 ? (O.id === "dur" || O.id === "rested" ? "that night" : "the next day") : "that day"; }
  function direction(pair) { var O = D.outcome(pair.O); return pair.rho * O.better > 0 ? "better" : "worse"; }
  // Returns { text, band, cert, n, caution } built only from fixed templates. level: simple | more | expert
  function describe(pair, level) {
    var E = D.exposure(pair.E), O = D.outcome(pair.O), up = pair.rho > 0, out = { n: pair.n, band: pair.band, cert: pair.cert }, bandText, t, lo, hi;
    bandText = { none: "no clear link", small: "a small link", moderate: "a moderate link", strong: "a strong link" }[pair.band];
    if (E.type === "bin" && pair.diff !== null && pair.diffCI) {
      lo = pair.diffCI[0]; hi = pair.diffCI[1];
      t = "On the " + pair.nWith + " days " + E.yes + ", your " + O.label + " " + when(pair.lag, O) + " was on average about " + amount(O, pair.diff) + (pair.diff >= 0 ? " higher" : " lower") + " than on the " + pair.nWithout + " days " + E.no + ".";
      if (level !== "simple") t += " Range " + (O.unit === "min" ? Math.round(lo) + " to " + Math.round(hi) + " minutes" : fmtNum(lo, 1) + " to " + fmtNum(hi, 1) + " points") + ".";
    } else if (E.type === "bin" && pair.diff !== null) {
      t = "On the " + pair.nWith + " days " + E.yes + ", your " + O.label + " " + when(pair.lag, O) + " was on average about " + amount(O, pair.diff) + (pair.diff >= 0 ? " higher" : " lower") + " than on the " + pair.nWithout + " days " + E.no + ".";
    } else {
      t = "On days with " + E.more + ", your " + O.label + " " + when(pair.lag, O) + " tended to be " + (up ? "higher" : "lower") + ".";
    }
    t += " This is " + bandText + ", " + pair.cert + ", from your own " + pair.n + " days.";
    out.caution = pair.lag === 0 ? "It could also work the other way round (a good day can make it easier to do this)." : "It does not show that one led to the other.";
    out.text = t;
    out.expert = "rho = " + fmtNum(pair.rho, 2) + (pair.ci ? " (90% range " + fmtNum(pair.ci[0], 2) + " to " + fmtNum(pair.ci[1], 2) + ")" : "") + ", n = " + pair.n + (pair.delta !== null ? ", Cliff's delta = " + fmtNum(pair.delta, 2) : "") + ", permutation p = " + (pair.p < 0.001 ? "< 0.001" : fmtNum(pair.p, 3)) + ", false discovery rate q = " + pair.q + (pair.pass ? " (passed)" : " (not passed)");
    return out;
  }
  // A summary sentence for a chart (screen readers): "Sleep, last 30 days: average 7 h 12 min, range 5 h 30 min to 9 h 00 min".
  function summary(label, vals, fmt) {
    if (!vals.length) return label + ": no entries in this period.";
    var s = vals.slice().sort(function (a, b) { return a - b; });
    return label + ": " + vals.length + " entries, average " + fmt(mean(vals)) + ", range " + fmt(s[0]) + " to " + fmt(s[s.length - 1]) + ".";
  }

  S.sum = sum; S.mean = mean; S.median = median; S.sd = sd; S.quantile = quantile; S.rank = rank; S.pearson = pearson; S.spearman = spearman; S.cliff = cliff; S.acf1 = acf1; S.nEff = nEff;
  S.prng = prng; S.hashSeed = hashSeed; S.bh = bh; S.residualWeekday = residualWeekday; S.blockResample = blockResample; S.permP = permP; S.pairData = pairData; S.gate = gate;
  S.bootCI = bootCI; S.band = band; S.certainty = certainty; S.patterns = patterns; S.describe = describe; S.direction = direction; S.summary = summary; S.fmtNum = fmtNum; S.amount = amount;
  S.MIN_PAIRS = MIN_PAIRS; S.MIN_LEVEL = MIN_LEVEL; S.Q = Q; S.BLOCK = BLOCK;
  if (typeof module !== "undefined" && module.exports) module.exports = S;
  root.VitalStats = S;
})(typeof globalThis !== "undefined" ? globalThis : this);
