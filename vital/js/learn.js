/* Stark Vital: the learning layer (pure, no DOM, no network). N-of-1 experiments with fixed judging rules, the ranking behind the
   "What seems to help you" card, the weekly summary. "Learning" here means: plain statistics recomputed from this person's own
   entries; the ranking moves as the evidence moves. Nothing is trained on anyone else's data. */
(function (root) {
  "use strict";
  var V = root.StarkVital || (typeof require === "function" ? require("./core.js") : null);
  var D = root.VitalData || (typeof require === "function" ? require("./data.js") : null);
  var S = root.VitalStats || (typeof require === "function" ? require("./stats.js") : null);
  var LV = root.VitalLevers || (typeof require === "function" ? require("./levers.js") : null);
  var X = {};
  var MIN_DAYS = 10, ADHERE = 0.7, BOOT = 2000;

  /* ---- experiment windows (dates are the days the habit is done; the outcome is read lag days later for sleep) ---- */
  function windows(e) {
    return { base: [V.addDays(e.start, -e.baselineDays), V.addDays(e.start, -1)], inter: [e.start, V.addDays(e.start, e.interventionDays - 1)],
      ret: e.returnDays ? [V.addDays(e.start, e.interventionDays), V.addDays(e.start, e.interventionDays + e.returnDays - 1)] : null };
  }
  function status(e, today) {
    var w = windows(e), last = w.ret ? w.ret[1] : w.inter[1];
    if (e.stopped) return "stopped";
    if (V.daysBetween(today, e.start) > 0) return "planned";
    return V.daysBetween(today, last) >= 0 ? "running" : "ended";
  }
  function collect(d, O, range, today) {   // [{v, wd, date}] outcome values for habit days in range
    var out = [], n = V.daysBetween(range[0], range[1]), i, dt, od, v;
    for (i = 0; i <= n; i++) {
      dt = V.addDays(range[0], i); od = O.lag ? V.addDays(dt, O.lag) : dt;
      if (V.daysBetween(od, today) < 0 || !d.days[od] || D.flagged(d, dt) || D.flagged(d, od)) continue;
      v = O.get(d, od); if (v !== null && v !== undefined) out.push({ v: v, wd: D.weekday(od), date: dt });
    }
    return out;
  }
  function slope(vals) { var n = vals.length, mx = (n - 1) / 2, my = S.mean(vals), sxy = 0, sxx = 0, i; for (i = 0; i < n; i++) { sxy += (i - mx) * (vals[i] - my); sxx += (i - mx) * (i - mx); } return sxx ? sxy / sxx : 0; }
  function bootDiff(a, b, rnd, N) {
    var out = [], t, i, ia, ib, ra, rb;
    for (t = 0; t < N; t++) {
      ia = S.blockResample(a.length, S.BLOCK, rnd); ib = S.blockResample(b.length, S.BLOCK, rnd);
      ra = ia.map(function (i) { return a[i]; }); rb = ib.map(function (i) { return b[i]; });
      out.push(S.median(ra) - S.median(rb));
    }
    out.sort(function (x, y) { return x - y; });
    return [S.quantile(out, 0.05), S.quantile(out, 0.95)];
  }
  function adherence(e, today) {
    var w = windows(e), n = e.interventionDays, shown = Math.min(n, Math.max(0, V.daysBetween(w.inter[0], today) + 1)), got = 0, yes = 0, i, a;
    if (!shown) return { share: 0, yes: 0, days: 0 };
    for (i = 0; i < shown; i++) { a = e.adherence[V.addDays(e.start, i)]; if (a === "yes") { got += 1; yes++; } else if (a === "partly") got += 0.5; }
    return { share: got / shown, yes: yes, days: shown };
  }
  // The full analysis for one experiment. Judging rules are fixed in advance and shown before the experiment starts.
  function analyze(d, e, today, opts) {
    opts = opts || {};
    var O = D.outcome(e.outcome), w = windows(e), B = collect(d, O, w.base, today), I = collect(d, O, w.inter, today), R = w.ret ? collect(d, O, w.ret, today) : [], res, all, resid, adh = adherence(e, today),
      st = status(e, today), rnd, ci, diff, rb, ri, pooled, noteOthers = [];
    res = { id: e.id, status: st, nBase: B.length, nInter: I.length, nReturn: R.length, adherence: adh, outcome: e.outcome, lever: e.lever, threshold: e.threshold, changedMidway: e.changedMidway, label: "too little data", direction: "none" };
    if (B.length < MIN_DAYS || I.length < MIN_DAYS) return res;
    all = B.concat(I);
    resid = S.residualWeekday(all.map(function (x) { return x.v; }), all.map(function (x) { return x.wd; }));
    rb = resid.slice(0, B.length); ri = resid.slice(B.length);
    diff = S.median(ri) - S.median(rb);
    rnd = S.prng(S.hashSeed(e.id + "|" + e.start + "|" + B.length + "|" + I.length + "|" + S.sum(resid)));
    ci = bootDiff(ri, rb, rnd, opts.boot || BOOT);
    pooled = S.sd(resid);
    res.diff = diff; res.ci = ci; res.delta = S.cliff(ri, rb); res.sd = pooled; res.detect = 2.8 * pooled * Math.sqrt(1 / B.length + 1 / I.length);
    res.excludesZero = ci[0] > 0 || ci[1] < 0; res.big = Math.abs(diff) >= e.threshold; res.adherenceOK = adh.share >= ADHERE;
    res.direction = diff * O.better > 0 ? "better" : diff * O.better < 0 ? "worse" : "none";
    // baseline already moving the same way (slope over half of the observed difference)?
    var bs = slope(B.map(function (x) { return x.v; })), gap = (e.baselineDays + e.interventionDays) / 2;
    res.drift = Math.abs(bs * gap) > Math.abs(diff) / 2 && bs * diff > 0;
    if (res.excludesZero && res.big && res.adherenceOK) res.label = "clear change";
    else if (res.excludesZero) res.label = "possible change";
    else res.label = "no clear change";
    if (e.changedMidway) res.note = "Changed after it started, so be extra careful with it.";
    // only the days the person marked "did it"
    var yesDays = {}, k; for (k in e.adherence) if (e.adherence[k] === "yes") yesDays[k] = 1;
    var Iy = I.filter(function (x) { return yesDays[x.date]; });
    if (Iy.length >= 5) {
      var yAll = B.concat(Iy), yr = S.residualWeekday(yAll.map(function (x) { return x.v; }), yAll.map(function (x) { return x.wd; }));
      res.didIt = { n: Iy.length, diff: S.median(yr.slice(B.length)) - S.median(yr.slice(0, B.length)) };
    }
    if (R.length >= 5) res.back = { n: R.length, diff: S.median(R.map(function (x) { return x.v; })) - S.median(I.map(function (x) { return x.v; })) };
    // other things that also changed between the two windows by more than 1 SD
    D.EXPOSURES.concat(D.OUTCOMES).forEach(function (f) {
      if (f.id === e.outcome || (LV.get(e.lever) && LV.get(e.lever).exposure === f.id)) return;
      var a = [], b = [], i, dt, v, all2;
      for (i = 0; i < e.baselineDays; i++) { v = f.get(d, V.addDays(w.base[0], i)); if (v !== null && v !== undefined) a.push(v); }
      for (i = 0; i < e.interventionDays; i++) { v = f.get(d, V.addDays(w.inter[0], i)); if (v !== null && v !== undefined) b.push(v); }
      if (a.length < 7 || b.length < 7) return;
      all2 = a.concat(b); var s2 = S.sd(all2);
      if (s2 > 0 && Math.abs(S.mean(b) - S.mean(a)) > s2) noteOthers.push(f.label);
    });
    res.others = noteOthers;
    return res;
  }
  function judgingText(e) {
    var O = D.outcome(e.outcome), th = O.unit === "min" ? e.threshold + " minutes" : e.threshold + (e.threshold === 1 ? " point" : " points");
    return "Fixed before you start: the main thing watched is " + O.label + ". \"Clear change\" needs a 90% range that stays on one side of zero, a difference of at least " + th + ", and the habit done on at least 70% of days. " +
      "\"Possible change\" is a range that stays on one side of zero with a smaller difference or less than 70% done. \"No clear change\" is a range that includes zero. \"Too little data\" is under " + MIN_DAYS + " logged days in either window.";
  }
  // Words for the result, from fixed templates.
  function resultText(res, level) {
    var O = D.outcome(res.outcome), lv = LV.get(res.lever), amt = function (v) { return S.amount(O, v); }, t, lo, hi;
    if (res.label === "too little data") return "Too little data yet: at least " + MIN_DAYS + " logged days are needed in the baseline window and in the habit window (you have " + res.nBase + " and " + res.nInter + ").";
    lo = res.ci[0]; hi = res.ci[1];
    if (res.label === "no clear change") {
      t = "No clear change in " + O.label + " between the two windows (about " + amt(res.diff) + (res.diff >= 0 ? " higher" : " lower") + ", range " + (O.unit === "min" ? Math.round(lo) + " to " + Math.round(hi) + " minutes" : S.fmtNum(lo, 1) + " to " + S.fmtNum(hi, 1) + " points") + "). " +
        "With " + res.nBase + " and " + res.nInter + " days, a change smaller than about " + (O.unit === "min" ? Math.round(res.detect) + " minutes" : S.fmtNum(res.detect, 1) + " points") + " would be hard to see.";
    } else {
      t = "During the " + res.nInter + " days of \"" + (lv ? lv.name.toLowerCase() : "the habit") + "\", your " + O.label + " was about " + amt(res.diff) + (res.diff >= 0 ? " higher" : " lower") + " than in the " + res.nBase + " days before (range " +
        (O.unit === "min" ? Math.round(lo) + " to " + Math.round(hi) + " minutes" : S.fmtNum(lo, 1) + " to " + S.fmtNum(hi, 1) + " points") + "). This is a " + res.label + ", a hint for you and not proof.";
    }
    if (res.others && res.others.length) t += " Other things changed too: " + res.others.join(", ") + ".";
    if (res.drift) t += " It was already changing before you started.";
    if (!res.adherenceOK && res.adherence.days) t += " The habit was done on " + Math.round(res.adherence.share * 100) + "% of days, under the 70% needed for a clear change.";
    return t;
  }
  // Checks a new experiment against the guardrails. Returns { ok, reason }.
  function canStart(d, leverId, outcomeId, start, today, redActive) {
    var lv = LV.get(leverId), exp, i, st;
    if (!lv || (lv.status !== "verified" && lv.status !== "partly")) return { ok: false, reason: "That habit is not in the library." };
    if (lv.outcomes.indexOf(outcomeId) === -1) return { ok: false, reason: "Pick one of the listed results to watch." };
    if (redActive) return { ok: false, reason: "Experiments are paused while the note about talking to a doctor is showing." };
    if (d.settings.restricted && ["L1", "L2", "L3", "L4"].indexOf(lv.id) !== -1) return { ok: false, reason: "Experiments about sleep and training are switched off in your settings." };
    if (isNaN(V.dayNum(start)) || V.daysBetween(today, start) < 0) return { ok: false, reason: "Start today or later: the plan is fixed before the first day." };
    for (i = 0; i < d.experiments.length; i++) { exp = d.experiments[i]; st = status(exp, today); if ((st === "running" || st === "planned") && exp.outcome === outcomeId) return { ok: false, reason: "Another experiment is already running on that result. One at a time." }; }
    return { ok: true, reason: "" };
  }
  // Editing a plan after day 1 marks it as changed mid-way.
  function edit(e, changes, today) {
    var out = JSON.parse(JSON.stringify(e)), k;
    for (k in changes) if (["threshold", "interventionDays", "baselineDays", "returnDays", "outcome"].indexOf(k) !== -1) out[k] = changes[k];
    if (V.daysBetween(e.start, today) >= 0) out.changedMidway = true;
    return out;
  }

  /* ---- ranking: the "What seems to help you" card ---- */
  var BAND_W = { none: 0, small: 0.33, moderate: 0.66, strong: 1 }, CERT_W = { "fairly sure": 1, "leaning": 0.6, "could be chance": 0.2 };
  function outcomesFor(goal) { return goal === "sleep" ? ["dur", "rested"] : goal === "any" || !goal ? null : [goal]; }
  function patternEvidence(lv, pat, goal) {
    var want = outcomesFor(goal), best = 0, bestPair = null;
    (pat && pat.pairs || []).forEach(function (p) {
      if (!p.eligible || D.exposure(p.E).lever !== lv.id || (want && want.indexOf(p.O) === -1)) return;
      var w = BAND_W[p.band] * CERT_W[p.cert] * (S.direction(p) === "better" ? 1 : -1);
      if (Math.abs(w) > Math.abs(best)) { best = w; bestPair = p; }
    });
    return { value: best, pair: bestPair };
  }
  function experimentEvidence(d, lv, today) {
    var list = d.experiments.filter(function (e) { return e.lever === lv.id && status(e, today) === "ended"; }), res, value = 0, prev, replicated = false;
    if (!list.length) return { value: 0, res: null, replicated: false };
    list.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    res = analyze(d, list[list.length - 1], today, { boot: 600 });
    if (res.label === "clear change") value = res.direction === "better" ? 1 : -0.5;
    else if (res.label === "possible change") value = res.direction === "better" ? 0.5 : -0.25;
    else if (res.label === "no clear change") value = -0.5;
    if (list.length > 1 && (res.label === "clear change" || res.label === "possible change")) {
      prev = analyze(d, list[list.length - 2], today, { boot: 600 });
      if ((prev.label === "clear change" || prev.label === "possible change") && prev.direction === res.direction) { replicated = true; if (value > 0) value = Math.min(1, value * 1.1); }
    }
    return { value: value, res: res, replicated: replicated };
  }
  // Returns levers ranked with every part kept, so the ranking can be audited on screen.
  function rank(d, pat, today, opts) {
    opts = opts || {};
    var logged = Object.keys(d.days).length, goal = d.settings.goal, out;
    out = LV.visible().map(function (lv) {
      var ex = logged >= 14 ? experimentEvidence(d, lv, today) : { value: 0, res: null, replicated: false }, pe = logged >= 14 ? patternEvidence(lv, pat, goal) : { value: 0, pair: null }, prior = LV.PRIOR[lv.grade] || 0.3;
      var score = 0.5 * ex.value + 0.35 * pe.value + 0.15 * prior;
      return { lever: lv, score: score, exp: ex, pat: pe, prior: prior, parts: { experiment: ex.value, pattern: pe.value, library: prior }, worse: (ex.res && ex.res.direction === "worse" && (ex.res.label !== "no clear change" && ex.res.label !== "too little data")) || pe.value < -0.2,
        tested: !!ex.res && ex.res.label !== "too little data", noChange: !!ex.res && ex.res.label === "no clear change", starter: logged < 14 };
    });
    out.sort(function (a, b) { return b.score - a.score || a.lever.effort - b.lever.effort || (a.lever.id < b.lever.id ? -1 : 1); });
    if (logged < 14) out.sort(function (a, b) { return a.lever.effort - b.lever.effort || b.prior - a.prior || (a.lever.id < b.lever.id ? -1 : 1); });   // fixed starter rule: easiest, best-supported first
    return out;
  }
  // The top card: the best-ranked lever that is not shown as helpful if it worsened days, with a 14-day cooldown.
  function top(d, ranked, today) {
    var log = d.log || [], i, cand, same, lastExp;
    for (i = 0; i < ranked.length; i++) {
      cand = ranked[i]; if (cand.worse || cand.noChange) continue;
      same = 0; for (var k = 1; k <= 14; k++) { var dt = V.addDays(today, -k), hit = log.some(function (x) { return x.date === dt && x.lever === cand.lever.id; }); if (hit) same++; else break; }
      lastExp = d.experiments.filter(function (e) { return e.lever === cand.lever.id; }).map(function (e) { return V.addDays(e.start, e.baselineDays + e.interventionDays); }).sort().pop();
      if (same >= 14 && !(lastExp && V.daysBetween(lastExp, today) < 14)) continue;   // cooldown, unless a new experiment result came in
      return cand;
    }
    return ranked[0] || null;
  }

  /* ---- the weekly summary: three things that changed, one steady, one prompt ---- */
  function week(d, today) {
    var items = [], i, cur, prv;
    function vals(id, from, to) { return D.series(d, id, from, to).map(function (x) { return x.v; }); }
    D.OUTCOMES.forEach(function (O) {
      cur = vals(O.id, V.addDays(today, -6), today); prv = vals(O.id, V.addDays(today, -13), V.addDays(today, -7));
      if (cur.length < 3 || prv.length < 3) return;
      var diff = S.mean(cur) - S.mean(prv), all = cur.concat(prv), s = S.sd(all) || 1;
      items.push({ id: O.id, label: O.short, now: S.mean(cur), before: S.mean(prv), diff: diff, z: Math.abs(diff) / s, unit: O.unit, better: O.better, nNow: cur.length, nBefore: prv.length });
    });
    items.sort(function (a, b) { return b.z - a.z; });
    return { changed: items.slice(0, 3).filter(function (x) { return x.z >= 0.25; }), steady: items.length > 3 ? items.slice().sort(function (a, b) { return a.z - b.z; })[0] : (items.length ? items[items.length - 1] : null), have: items.length, logged: D.streak(d, today).last14 };
  }

  X.windows = windows; X.status = status; X.analyze = analyze; X.judgingText = judgingText; X.resultText = resultText; X.canStart = canStart; X.edit = edit; X.rank = rank; X.top = top; X.week = week;
  X.adherence = adherence; X.patternEvidence = patternEvidence; X.MIN_DAYS = MIN_DAYS; X.ADHERE = ADHERE;
  if (typeof module !== "undefined" && module.exports) module.exports = X;
  root.VitalLearn = X;
})(typeof globalThis !== "undefined" ? globalThis : this);
