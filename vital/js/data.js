/* Stark Vital: data model (no DOM, no network). Day records, validation and cleaning, derived values, exposures and outcomes,
   the example dataset (seeded, made up) and CSV export. Pure functions; runs in the browser and in Node tests. */
(function (root) {
  "use strict";
  var V = root.StarkVital || (typeof require === "function" ? require("./core.js") : null);
  var D = {};

  /* ---- clock times and sleep length ---- */
  function toMin(s) { var m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : null; }
  function fmtClock(min) { var m = ((Math.round(min) % 1440) + 1440) % 1440; return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2); }
  // Sleep length from two clock times on a 24-hour clock. A night that crosses midnight is handled; equal times mean no valid length.
  // Local clock times only: on the night the clocks change the real length can differ by an hour (the app says so on the About page).
  function durFrom(bed, wake) {
    var b = toMin(bed), w = toMin(wake), d;
    if (b === null || w === null || b === w) return null;
    d = (w - b + 1440) % 1440;
    return d >= 1 && d <= 1000 ? d : null;
  }
  // Bedtime as minutes since 18:00, so 23:00 = 300 and 01:00 = 420 sit near each other (a straight line across midnight).
  function bedAxis(bed) { var b = toMin(bed); return b === null ? null : (b - 1080 + 1440) % 1440; }
  function fmtDur(min) { if (min == null || isNaN(min)) return "-"; var m = Math.round(min), h = Math.floor(m / 60); return h + " h " + ("0" + (m % 60)).slice(-2) + " min"; }

  /* ---- fields: type, range. Everything optional. ---- */
  var SCALES = ["rested", "mood", "energy", "focus", "stress"];
  var LEVEL3 = ["trainLevel", "outdoor", "alcohol", "social"];
  var BOOLS = ["morningLight", "caffeineLate", "lateMeal", "screenLate", "sick", "travel"];
  var TRAIN_KINDS = ["strength", "cardio", "walk", "sport", "mobility", "other"];
  var SYMPTOMS = [
    { id: "chest", label: "Chest pain" }, { id: "breath", label: "Trouble breathing" }, { id: "faint", label: "Fainting" },
    { id: "headache", label: "Severe headache that came on suddenly" }, { id: "blood", label: "Blood in stool or urine" },
    { id: "oneside", label: "Numbness or weakness on one side" }, { id: "selfharm", label: "Thoughts of harming myself" }
  ];
  var SYMPTOM_IDS = SYMPTOMS.map(function (s) { return s.id; });
  function int(x, lo, hi) { var n = typeof x === "string" && x.trim() !== "" ? +x : x; return typeof n === "number" && isFinite(n) && Math.floor(n) === n && n >= lo && n <= hi ? n : null; }
  function str(x, max) { return typeof x === "string" ? x.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max) : ""; }

  // Returns a clean day record: unknown fields dropped, out-of-range values dropped, sleep length derived. Never throws.
  function cleanDay(r) {
    var o = {}, i, v;
    r = r && typeof r === "object" ? r : {};
    if (toMin(r.bed) !== null) o.bed = r.bed;
    if (toMin(r.wake) !== null) o.wake = r.wake;
    v = durFrom(o.bed, o.wake); if (v !== null) o.durMin = v;
    for (i = 0; i < SCALES.length; i++) { v = int(r[SCALES[i]], 1, 5); if (v !== null) o[SCALES[i]] = v; }
    for (i = 0; i < LEVEL3.length; i++) { v = int(r[LEVEL3[i]], 0, 2); if (v !== null) o[LEVEL3[i]] = v; }
    for (i = 0; i < BOOLS.length; i++) if (typeof r[BOOLS[i]] === "boolean") o[BOOLS[i]] = r[BOOLS[i]];
    v = int(r.trainMin, 0, 600); if (v !== null) o.trainMin = v;
    v = int(r.steps, 0, 100000); if (v !== null) o.steps = v;
    v = int(r.breathMin, 0, 120); if (v !== null) o.breathMin = v;
    if (TRAIN_KINDS.indexOf(r.trainKind) !== -1) o.trainKind = r.trainKind;
    if (Array.isArray(r.flags)) { v = r.flags.filter(function (x, k) { return SYMPTOM_IDS.indexOf(x) !== -1 && r.flags.indexOf(x) === k; }); if (v.length) o.flags = v; }
    v = str(r.note, 280).trim(); if (v) o.note = v;
    o.source = r.source === "import" ? "import" : "manual";
    o.created = typeof r.created === "string" && r.created.length <= 40 ? r.created : "";
    o.edited = typeof r.edited === "string" && r.edited.length <= 40 ? r.edited : "";
    return o;
  }
  function hasContent(o) { var k; for (k in o) if (k !== "source" && k !== "created" && k !== "edited" && k !== "durMin") return true; return false; }

  /* ---- labs: typed from the person's own report. The app holds no ranges. ---- */
  function num(x) { var n = typeof x === "string" && x.trim() !== "" ? +x : x; return typeof n === "number" && isFinite(n) ? n : null; }
  function cleanLab(l) {
    var o = { id: typeof l.id === "string" && l.id ? l.id.slice(0, 40) : V.uid() };
    o.takenOn = !isNaN(V.dayNum(l.takenOn)) ? l.takenOn : null;
    o.lab = str(l.lab, 80); o.panel = str(l.panel, 80); o.analyte = str(l.analyte, 80).trim(); o.unit = str(l.unit, 30).trim();
    o.value = num(l.value); o.refLow = num(l.refLow); o.refHigh = num(l.refHigh); o.refText = str(l.refText, 60);
    o.fasting = ["yes", "no", "unknown"].indexOf(l.fasting) !== -1 ? l.fasting : "unknown";
    o.urgent = l.urgent === true; o.abnormal = l.abnormal === true; o.note = str(l.note, 280);
    return o.takenOn && o.analyte && o.value !== null ? o : null;
  }
  // The only comparison the app makes: this value against THIS report's own printed range.
  function labPosition(l) {
    var lo = l.refLow, hi = l.refHigh;
    if (lo == null && hi == null) return "norange";
    if (lo != null && l.value < lo) return "below";
    if (hi != null && l.value > hi) return "above";
    return "inside";
  }
  var POSITION_TEXT = { below: "below the range on your report", inside: "inside the range on your report", above: "above the range on your report", norange: "no range given" };

  /* ---- experiments (stored plan; the analysis lives in learn.js) ---- */
  function cleanExperiment(e) {
    var o = { id: typeof e.id === "string" && e.id ? e.id.slice(0, 40) : V.uid() };
    o.lever = str(e.lever, 20); o.outcome = str(e.outcome, 20);
    o.start = !isNaN(V.dayNum(e.start)) ? e.start : null;
    o.baselineDays = int(e.baselineDays, 7, 28) || 14; o.interventionDays = int(e.interventionDays, 7, 28) || 14; o.returnDays = int(e.returnDays, 0, 14) || 0;
    o.threshold = num(e.threshold) > 0 ? num(e.threshold) : 0.5;
    o.adherence = {}; if (e.adherence && typeof e.adherence === "object") Object.keys(e.adherence).forEach(function (k) { if (!isNaN(V.dayNum(k)) && ["yes", "partly", "no"].indexOf(e.adherence[k]) !== -1) o.adherence[k] = e.adherence[k]; });
    o.changedMidway = e.changedMidway === true; o.stopped = !isNaN(V.dayNum(e.stopped)) ? e.stopped : null; o.created = str(e.created, 40);
    return o.lever && o.outcome && o.start ? o : null;
  }

  // Cleans a whole decrypted record. Anything unusable is dropped rather than shown.
  function sanitize(d) {
    var out = V.migrate({ v: 1, created: d && d.created, example: d && d.example === true, settings: d && d.settings, days: {}, labs: [], experiments: [], questions: [], log: [] }), k, c, s = out.settings;
    for (k in (d && d.days) || {}) if (Object.prototype.hasOwnProperty.call(d.days, k) && !isNaN(V.dayNum(k))) { c = cleanDay(d.days[k]); if (hasContent(c)) out.days[k] = c; }
    ((d && d.labs) || []).forEach(function (l) { c = cleanLab(l); if (c) out.labs.push(c); });
    ((d && d.experiments) || []).forEach(function (e) { c = cleanExperiment(e); if (c) out.experiments.push(c); });
    ((d && d.questions) || []).forEach(function (q) { var t = str(q && q.text, 300).trim(); if (t) out.questions.push({ id: String(q.id || V.uid()).slice(0, 40), text: t }); });
    ((d && d.log) || []).forEach(function (x) { if (x && typeof x.date === "string" && typeof x.lever === "string") out.log.push({ id: String(x.id || V.uid()).slice(0, 40), date: x.date.slice(0, 10), lever: x.lever.slice(0, 20) }); });
    if (d && d.custom && typeof d.custom === "object") out.custom = cleanCustom(d.custom);   // the key exists only once the person added an item: older notebooks are left as they were
    s.lockMin = int(s.lockMin, 1, 120) || 10;
    s.lockOnHide = s.lockOnHide === true; s.adult = s.adult === true; s.restricted = s.restricted === true;
    s.detail = ["simple", "more", "expert"].indexOf(s.detail) !== -1 ? s.detail : "simple";
    s.goal = ["any", "sleep", "mood", "energy", "focus", "stress"].indexOf(s.goal) !== -1 ? s.goal : "any";
    s.tracked = Array.isArray(s.tracked) ? s.tracked.filter(function (t) { return TRACKABLE.indexOf(t) !== -1; }) : ["sleep", "mood", "energy"];
    s.reduceMotion = s.reduceMotion === true ? true : s.reduceMotion === false ? false : null;
    s.started = !isNaN(V.dayNum(s.started)) ? s.started : null; s.remind = /^([01]\d|2[0-3]):[0-5]\d$/.test(s.remind || "") ? s.remind : "";
    return out;
  }
  var TRACKABLE = ["sleep", "mood", "energy", "training", "food", "light", "stress", "focus", "social", "breath"];


  /* ---- custom items (1.1.0): the person's own ratings, yes/no habits and numbers. They live in d.custom, inside the sealed notebook.
     d.custom = { items: [{ id, name, kind, unit, archived, created }], vals: { "YYYY-MM-DD": { itemId: number } } }.
     The key is absent until the first item is added. Kinds: rating (1 to 5), habit (0 or 1), number (0 to 1,000,000, 4 decimals). ---- */
  var CK = ["rating", "habit", "number"], MAX_CUSTOM = 30, NAME_MAX = 40, UNIT_MAX = 12, NUM_MAX = 1000000;
  function oneLine(x, max) { return str(x, max * 4).replace(/[\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim(); }
  function cleanValue(kind, v) {
    var n = typeof v === "string" && v.trim() !== "" ? +v : v;
    if (typeof n !== "number" || !isFinite(n)) return null;
    if (kind === "rating") return Math.floor(n) === n && n >= 1 && n <= 5 ? n : null;
    if (kind === "habit") return n === 0 || n === 1 ? n : null;
    return n >= 0 && n <= NUM_MAX ? Math.round(n * 10000) / 10000 : null;
  }
  function cleanCustom(c) {
    var out = { items: [], vals: {} }, seen = {}, kinds = {}, k, o, row, id, v;
    ((c && Array.isArray(c.items)) ? c.items : []).forEach(function (x) {
      if (!x || typeof x !== "object" || out.items.length >= MAX_CUSTOM) return;
      id = typeof x.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(x.id) ? x.id : "";
      o = { id: id, name: oneLine(x.name, NAME_MAX).slice(0, NAME_MAX), kind: CK.indexOf(x.kind) !== -1 ? x.kind : "", unit: "", archived: x.archived === true, created: !isNaN(V.dayNum(x.created)) ? x.created : "" };
      if (o.kind === "number") o.unit = oneLine(x.unit, UNIT_MAX).slice(0, UNIT_MAX);
      if (!o.id || !o.name || !o.kind || seen[o.id]) return;
      seen[o.id] = 1; kinds[o.id] = o.kind; out.items.push(o);
    });
    if (c && c.vals && typeof c.vals === "object") for (k in c.vals) {
      if (!Object.prototype.hasOwnProperty.call(c.vals, k) || isNaN(V.dayNum(k)) || !c.vals[k] || typeof c.vals[k] !== "object") continue;
      row = {};
      for (id in c.vals[k]) if (Object.prototype.hasOwnProperty.call(c.vals[k], id) && kinds[id]) { v = cleanValue(kinds[id], c.vals[k][id]); if (v !== null) row[id] = v; }
      if (Object.keys(row).length) out.vals[k] = row;
    }
    return out;
  }
  function customItems(d, withArchived) { return d && d.custom ? d.custom.items.filter(function (i) { return withArchived || !i.archived; }) : []; }
  function customItem(d, id) { return customItems(d, true).filter(function (i) { return i.id === id; })[0]; }
  function customValue(d, date, id) { var r = d && d.custom && d.custom.vals[date]; return r && typeof r[id] === "number" ? r[id] : null; }
  function customSeries(d, id, from, to) { var out = [], n = V.daysBetween(from, to), i, dt, v; if (n === null) return out; for (i = 0; i <= n; i++) { dt = V.addDays(from, i); v = customValue(d, dt, id); if (v !== null) out.push({ date: dt, v: v }); } return out; }
  function customDates(d) { return d && d.custom ? Object.keys(d.custom.vals).sort() : []; }
  function customCount(d, id) { var n = 0; customDates(d).forEach(function (k) { if (typeof d.custom.vals[k][id] === "number") n++; }); return n; }
  // Plain-data editing helpers. Callers check the name with VitalSafety.checkItem first.
  function addCustomItem(d, name, kind, unit, today) {
    var it = cleanCustom({ items: [{ id: V.uid(), name: name, kind: kind, unit: unit, archived: false, created: today }], vals: {} }).items[0];
    if (!it || (d.custom && d.custom.items.length >= MAX_CUSTOM)) return null;
    if (!d.custom) d.custom = { items: [], vals: {} };
    d.custom.items.push(it); return it;
  }
  function setCustomValue(d, date, id, v) {
    var it = customItem(d, id), c = it ? cleanValue(it.kind, v) : null;
    if (!it) return false;
    if (c === null) { if (d.custom.vals[date]) { delete d.custom.vals[date][id]; if (!Object.keys(d.custom.vals[date]).length) delete d.custom.vals[date]; } return true; }
    (d.custom.vals[date] = d.custom.vals[date] || {})[id] = c; return true;
  }
  function deleteCustomItem(d, id) {
    if (!d.custom) return;
    d.custom.items = d.custom.items.filter(function (i) { return i.id !== id; });
    Object.keys(d.custom.vals).forEach(function (k) { delete d.custom.vals[k][id]; if (!Object.keys(d.custom.vals[k]).length) delete d.custom.vals[k]; });
  }
  function mergeCustom(d, inc) {   // adds what is missing: items by id, values on days where that item has none
    if (!inc || !inc.items.length) return;
    if (!d.custom) d.custom = { items: [], vals: {} };
    inc.items.forEach(function (i) { if (!d.custom.items.some(function (x) { return x.id === i.id; }) && d.custom.items.length < MAX_CUSTOM) d.custom.items.push(i); });
    Object.keys(inc.vals).forEach(function (k) { Object.keys(inc.vals[k]).forEach(function (id) { if (customItem(d, id) && customValue(d, k, id) === null) (d.custom.vals[k] = d.custom.vals[k] || {})[id] = inc.vals[k][id]; }); });
  }

  /* ---- reading the record ---- */
  function dates(d) { return Object.keys(d.days).sort(); }
  function weekday(date) { return ((V.dayNum(date) % 7) + 7 + 3) % 7; }   // 0 = Monday (1970-01-01 was a Thursday)
  function flagged(d, date) { var r = d.days[date]; return !!r && (r.sick === true || r.travel === true); }
  function bedIrreg(d, date) {
    var vals = [], i, r, x, m, ss = 0;
    for (i = 0; i < 7; i++) { r = d.days[V.addDays(date, -i)]; x = r ? bedAxis(r.bed) : null; if (x !== null) vals.push(x); }
    if (vals.length < 4) return null;
    m = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    vals.forEach(function (v) { ss += (v - m) * (v - m); });
    return Math.sqrt(ss / (vals.length - 1));
  }
  // Exposures (things the person does) and outcomes (how the days went). get(d, date) returns a number or null.
  function fld(k) { return function (d, date) { var r = d.days[date]; return r && typeof r[k] === "number" ? r[k] : null; }; }
  function bool(k) { return function (d, date) { var r = d.days[date]; return r && typeof r[k] === "boolean" ? (r[k] ? 1 : 0) : null; }; }
  var OUTCOMES = [
    { id: "dur", label: "sleep length", short: "Sleep length", unit: "min", better: 1, lag: 1, get: fld("durMin"), step: 20 },
    { id: "rested", label: "how rested you felt", short: "Rested", unit: "pt", better: 1, lag: 1, get: fld("rested"), step: 0.5 },
    { id: "mood", label: "mood", short: "Mood", unit: "pt", better: 1, lag: 0, get: fld("mood"), step: 0.5 },
    { id: "energy", label: "energy", short: "Energy", unit: "pt", better: 1, lag: 0, get: fld("energy"), step: 0.5 },
    { id: "focus", label: "focus", short: "Focus", unit: "pt", better: 1, lag: 0, get: fld("focus"), step: 0.5 },
    { id: "stress", label: "stress", short: "Stress", unit: "pt", better: -1, lag: 0, get: fld("stress"), step: 0.5 }
  ];
  var EXPOSURES = [
    { id: "morningLight", label: "morning light", type: "bin", get: bool("morningLight"), yes: "you got outside within two hours of waking", no: "you did not", lag0: ["mood", "energy", "focus", "stress"], lag1: ["dur", "rested"], lever: "L5" },
    { id: "outdoor", label: "time outdoors", type: "ord", get: fld("outdoor"), more: "more time outdoors", lag0: ["mood", "energy", "focus", "stress"], lag1: ["dur", "rested"], lever: "L5" },
    { id: "trainLevel", label: "training", type: "ord", get: fld("trainLevel"), more: "harder training", lag0: ["mood", "energy", "stress"], lag1: ["dur", "rested"], lever: "L2" },
    { id: "strength", label: "strength work", type: "bin", get: function (d, date) { var r = d.days[date]; return r && typeof r.trainLevel === "number" ? (r.trainKind === "strength" && r.trainLevel > 0 ? 1 : 0) : null; }, yes: "you did strength work", no: "you did not", lag0: ["mood"], lag1: ["dur", "rested"], lever: "L3" },
    { id: "steps", label: "steps", type: "num", get: fld("steps"), more: "more steps", lag0: ["mood", "energy", "stress"], lag1: ["dur", "rested"], lever: "L4" },
    { id: "caffeineLate", label: "caffeine after 2 pm", type: "bin", get: bool("caffeineLate"), yes: "you had caffeine after 2 pm", no: "you did not", lag1: ["dur", "rested"], lever: "L6" },
    { id: "alcohol", label: "alcohol", type: "ord", get: fld("alcohol"), more: "more alcohol", lag1: ["dur", "rested", "mood", "energy", "focus"], lever: "L7" },
    { id: "lateMeal", label: "a late meal", type: "bin", get: bool("lateMeal"), yes: "you ate within 3 hours of bed", no: "you did not", lag1: ["dur", "rested"] },
    { id: "screenLate", label: "bright screens in the last hour", type: "bin", get: bool("screenLate"), yes: "you used bright screens in the last hour before bed", no: "you did not", lag1: ["dur", "rested"] },
    { id: "breathMin", label: "slow breathing", type: "num", get: fld("breathMin"), more: "more minutes of slow breathing", lag0: ["stress", "mood"], lag1: ["dur", "rested"], lever: "L8" },
    { id: "social", label: "time with people", type: "ord", get: fld("social"), more: "more time with people", lag0: ["mood", "energy", "stress"], lag1: ["dur", "rested"], lever: "L9" },
    { id: "dur", label: "longer sleep", type: "num", get: fld("durMin"), more: "a longer night's sleep", lag0: ["mood", "energy", "focus", "stress"], lever: "L1" },
    { id: "bedIrreg", label: "bedtime regularity", type: "num", get: bedIrreg, more: "a more irregular bedtime", lag0: ["rested", "mood", "energy", "dur"], lever: "L10" }
  ];
  function outcome(id) { return OUTCOMES.filter(function (o) { return o.id === id; })[0]; }
  function exposure(id) { return EXPOSURES.filter(function (e) { return e.id === id; })[0]; }
  function series(d, id, from, to) {   // [{date, v}] for outcome or exposure id between two dates, only logged values
    var def = outcome(id) || exposure(id), out = [], dt = from, n = V.daysBetween(from, to), i;
    if (!def || n === null) return out;
    for (i = 0; i <= n; i++) { dt = V.addDays(from, i); var v = def.get(d, dt); if (v !== null && v !== undefined) out.push({ date: dt, v: v }); }
    return out;
  }
  function entryCount(d) { return Object.keys(d.days).length + d.labs.length; }
  function streak(d, asOf) {   // days logged in the last 14, and the run ending today or yesterday
    var n = 0, run = 0, i, on = true;
    for (i = 0; i < 14; i++) if (d.days[V.addDays(asOf, -i)]) n++;
    for (i = d.days[asOf] ? 0 : 1; i < 400; i++) { if (d.days[V.addDays(asOf, -i)]) run++; else break; }
    return { last14: n, run: run, total: Object.keys(d.days).length };
  }

  /* ---- an example dataset: made up, seeded, never stored ---- */
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function exampleData(today, nDays) {
    var d = V.emptyData(), r = rng(20261122), n = nDays || 75, i, date, wd, prev = {}, rec, bed, dur, wake, expStart;
    var gauss = function () { return (r() + r() + r() - 1.5) * 1.15; };
    d.example = true; d.settings.tracked = ["sleep", "mood", "energy", "training", "food", "light"]; d.settings.adult = true; d.settings.started = V.addDays(today, -(n - 1));
    expStart = V.addDays(today, -(n - 1) + 44);
    for (i = 0; i < n; i++) {
      date = V.addDays(today, -(n - 1) + i); wd = weekday(date);
      var weekend = wd >= 5, inExp = V.daysBetween(expStart, date) >= 0 && V.daysBetween(expStart, date) < 14;
      var light = r() < (weekend ? 0.7 : 0.45), caf = inExp ? false : r() < (i >= 29 && i < 44 ? 0.9 : 0.5), alc = r() < 0.18 ? (r() < 0.3 ? 2 : 1) : 0;
      var tl = r() < 0.3 ? 0 : r() < 0.6 ? 1 : 2, kind = tl ? (r() < 0.5 ? "strength" : r() < 0.6 ? "cardio" : "walk") : undefined;
      var late = r() < 0.35, screen = r() < 0.5, soc = r() < 0.4 ? 2 : r() < 0.5 ? 1 : 0, outd = light ? (r() < 0.5 ? 2 : 1) : (r() < 0.5 ? 1 : 0);
      var steps = Math.round(clamp(5200 + tl * 1800 + (kind === "walk" ? 2200 : 0) + gauss() * 1500, 1200, 17000) / 100) * 100;
      // last night: depends on yesterday's habits
      var base = 420 + (weekend ? 25 : 0) - (prev.caf ? 38 : 0) - (prev.alc ? prev.alc * 26 : 0) + (prev.tl === 2 ? 14 : 0) - (prev.screen ? 10 : 0) + gauss() * 24;
      dur = Math.round(clamp(base, 270, 600) / 5) * 5;
      var bedMin = (weekend ? 24 * 60 : 23 * 60 - 15) + Math.round((gauss() * 28 + (prev.late ? 10 : 0)) / 5) * 5; bedMin = (bedMin + 1440) % 1440;
      bed = fmtClock(bedMin); wake = fmtClock(bedMin + dur);
      var rested = Math.round(clamp(3 + (dur - 420) / 90 - (prev.alc ? 0.45 * prev.alc : 0) + gauss() * 0.7, 1, 5));
      var energy = Math.round(clamp(3 + (dur - 420) / 120 + (light ? 0.55 : -0.05) + (tl === 2 ? 0.15 : 0) + gauss() * 0.75, 1, 5));
      var mood = Math.round(clamp(3.1 + (dur - 420) / 200 + (soc - 0.8) * 0.25 + (light ? 0.35 : 0) + (tl ? 0.2 : 0) + gauss() * 0.7, 1, 5));
      var focus = Math.round(clamp(3 + (dur - 420) / 160 + (caf ? -0.1 : 0.1) + gauss() * 0.8, 1, 5));
      var stress = Math.round(clamp(2.8 - (dur - 420) / 220 + (weekend ? -0.4 : 0.3) - (soc - 0.8) * 0.1 + gauss() * 0.7, 1, 5));
      rec = { bed: bed, wake: wake, rested: rested, mood: mood, energy: energy, focus: focus, stress: stress, trainLevel: tl, trainMin: tl ? 20 + tl * 15 : 0, steps: steps,
        outdoor: outd, morningLight: light, caffeineLate: caf, alcohol: alc, lateMeal: late, screenLate: screen, social: soc, source: "manual" };
      if (kind) rec.trainKind = kind;
      if (i === 30) { rec.travel = true; }
      if (i === n - 3) rec.note = "Long walk after work. Felt clear-headed.";
      d.days[date] = cleanDay(rec);
      prev = { caf: caf, alc: alc, tl: tl, screen: screen, late: late };
    }
    d.experiments.push({ id: "exampleexp1", lever: "L6", outcome: "dur", start: expStart, baselineDays: 14, interventionDays: 14, returnDays: 0, threshold: 20, adherence: {}, changedMidway: false, stopped: null, created: expStart });
    for (i = 0; i < 14; i++) d.experiments[0].adherence[V.addDays(expStart, i)] = i % 5 === 3 ? "partly" : "yes";
    d.labs = [
      { id: "ex-l1", takenOn: V.addDays(today, -230), lab: "Example lab", panel: "Blood count", analyte: "Haemoglobin", value: 142, unit: "g/L", refLow: 130, refHigh: 175, refText: "130 - 175", fasting: "unknown" },
      { id: "ex-l2", takenOn: V.addDays(today, -140), lab: "Example lab", panel: "Blood count", analyte: "Haemoglobin", value: 138, unit: "g/L", refLow: 130, refHigh: 175, refText: "130 - 175", fasting: "unknown" },
      { id: "ex-l3", takenOn: V.addDays(today, -75), lab: "Other example lab", panel: "Blood count", analyte: "Haemoglobin", value: 133, unit: "g/L", refLow: 135, refHigh: 180, refText: "135 - 180", fasting: "unknown" },
      { id: "ex-l4", takenOn: V.addDays(today, -20), lab: "Other example lab", panel: "Blood count", analyte: "Haemoglobin", value: 141, unit: "g/L", refLow: 135, refHigh: 180, refText: "135 - 180", fasting: "unknown" },
      { id: "ex-l5", takenOn: V.addDays(today, -20), lab: "Other example lab", panel: "Iron stores", analyte: "Ferritin", value: 95, unit: "ug/L", refLow: 30, refHigh: 400, refText: "30 - 400", fasting: "unknown" }
    ].map(cleanLab);
    d.questions = [{ id: "ex-q1", text: "My sleep is shorter on days I have caffeine late. Is there anything I should check?" }];
    return sanitize(d);
  }

  /* ---- CSV export (plain text: the person is warned before it is saved) ---- */
  function csvCell(v) { var s = v == null ? "" : String(v); if (/^[\s\u200b-\u200f\u2028\u2029\ufeff]*[=+\-@]/.test(s) || /^[\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  var DAY_COLS = ["date", "bed", "wake", "durMin", "rested", "mood", "energy", "focus", "stress", "trainLevel", "trainKind", "trainMin", "steps", "outdoor", "morningLight", "caffeineLate", "alcohol", "lateMeal", "screenLate", "breathMin", "social", "sick", "travel", "flags", "note"];
  function toCSV(d) {
    var rows = [DAY_COLS.join(",")], out;
    dates(d).forEach(function (date) { var r = d.days[date]; rows.push(DAY_COLS.map(function (c) { return csvCell(c === "date" ? date : c === "flags" ? (r.flags || []).join(" ") : r[c]); }).join(",")); });
    out = rows.join("\r\n") + "\r\n\r\n";
    out += ["takenOn", "lab", "panel", "analyte", "value", "unit", "refLow", "refHigh", "refText", "fasting", "note"].join(",") + "\r\n";
    d.labs.forEach(function (l) { out += [l.takenOn, l.lab, l.panel, l.analyte, l.value, l.unit, l.refLow, l.refHigh, l.refText, l.fasting, l.note].map(csvCell).join(",") + "\r\n"; });
    out += "\r\n" + ["lever", "outcome", "start", "baselineDays", "interventionDays", "returnDays", "threshold", "changedMidway"].join(",") + "\r\n";
    d.experiments.forEach(function (e) { out += [e.lever, e.outcome, e.start, e.baselineDays, e.interventionDays, e.returnDays, e.threshold, e.changedMidway].map(csvCell).join(",") + "\r\n"; });
    if (d.custom && d.custom.items.length) {
      out += "\r\n" + ["date", "item", "kind", "unit", "value", "archived"].join(",") + "\r\n";
      customDates(d).forEach(function (date) { d.custom.items.forEach(function (it) { var v = customValue(d, date, it.id); if (v !== null) out += [date, it.name, it.kind, it.unit, v, it.archived ? "yes" : "no"].map(csvCell).join(",") + "\r\n"; }); });
      d.custom.items.forEach(function (it) { if (!customCount(d, it.id)) out += ["", it.name, it.kind, it.unit, "", it.archived ? "yes" : "no"].map(csvCell).join(",") + "\r\n"; });
    }
    return out;
  }

  D.toMin = toMin; D.fmtClock = fmtClock; D.durFrom = durFrom; D.bedAxis = bedAxis; D.fmtDur = fmtDur; D.cleanDay = cleanDay; D.cleanLab = cleanLab; D.cleanExperiment = cleanExperiment;
  D.hasContent = hasContent; D.sanitize = sanitize; D.dates = dates; D.weekday = weekday; D.flagged = flagged; D.bedIrreg = bedIrreg; D.OUTCOMES = OUTCOMES; D.EXPOSURES = EXPOSURES;
  D.outcome = outcome; D.exposure = exposure; D.series = series; D.entryCount = entryCount; D.streak = streak; D.exampleData = exampleData; D.toCSV = toCSV; D.csvCell = csvCell;
  D.labPosition = labPosition; D.POSITION_TEXT = POSITION_TEXT; D.SYMPTOMS = SYMPTOMS; D.TRAIN_KINDS = TRAIN_KINDS; D.TRACKABLE = TRACKABLE; D.rng = rng;
  D.cleanCustom = cleanCustom; D.cleanValue = cleanValue; D.customItems = customItems; D.customItem = customItem; D.customValue = customValue; D.customSeries = customSeries; D.customDates = customDates; D.customCount = customCount;
  D.addCustomItem = addCustomItem; D.setCustomValue = setCustomValue; D.deleteCustomItem = deleteCustomItem; D.mergeCustom = mergeCustom; D.CUSTOM_KINDS = CK; D.CUSTOM_MAX = MAX_CUSTOM; D.NAME_MAX = NAME_MAX; D.UNIT_MAX = UNIT_MAX; D.NUM_MAX = NUM_MAX;
  if (typeof module !== "undefined" && module.exports) module.exports = D;
  root.VitalData = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
