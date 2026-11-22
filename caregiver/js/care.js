/* Stark Caregiver, by Stark: care logic (no DOM, no network). Dose log, appointment and symptom diary, the one-page
   doctor summary, the care rota and the carer check-in. Pure functions; runs in the browser and in Node (tests).
   Record keeping only: nothing here gives dosing advice, compares medicines, or suggests a diagnosis. */
(function (root) {
  "use strict";
  var V = root.CareCore || (typeof require === "function" ? require("./core.js") : null);
  var C = root.CareContent || (typeof require === "function" ? require("./content.js") : null);
  function list(x) { return Array.isArray(x) ? x : []; }
  function low(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

  /* ---- clock times ("HH:MM") ---- */
  function hm(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t == null ? "" : t).trim()); if (!m || +m[1] > 23 || +m[2] > 59) return null; return +m[1] * 60 + +m[2]; }
  function fmtHm(min) { min = Math.round(min); min = ((min % 1440) + 1440) % 1440; return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + (min % 60)).slice(-2); }
  // "8:00, 20:00 13:30" -> ["08:00", "13:30", "20:00"]; anything that is not a clock time is ignored.
  function parseTimes(s) {
    var out = [];
    String(s || "").split(/[\s,;]+/).forEach(function (x) { var m = hm(x); if (m != null && out.indexOf(fmtHm(m)) === -1) out.push(fmtHm(m)); });
    return out.sort();
  }
  // 0 = Sunday. 1970-01-01 (day 0) was a Thursday.
  function weekday(date) { var n = V.dayNum(date); return isNaN(n) ? null : (((n % 7) + 11) % 7); }
  function days(from, to) { var out = [], d = from, guard = 0; while (d && d <= to && guard++ < 800) { out.push(d); d = V.addDays(d, 1); } return out; }

  /* ---------- dose log: what was given or missed, by whom and when ---------- */
  // A medicine is on the schedule for a day when it had started, had not stopped, and has times (as-needed medicines have none).
  function medOn(m, date) {
    if (m.active === false && !m.stopped) return false;
    if (m.started && date < m.started) return false;
    if (m.stopped && date >= m.stopped) return false;
    return true;
  }
  function slotsFor(m, date) { return !m.prn && medOn(m, date) ? parseTimes(m.times) : []; }
  // Slots that were already due by "cut" ("YYYY-MM-DD HH:MM"), so a dose later today never counts as "not logged".
  function dueSlots(m, date, cut) { return slotsFor(m, date).filter(function (s) { return !cut || date + " " + s <= cut; }); }
  function entriesFor(vault, medId, date, slot) {
    return list(vault.doses).filter(function (d) { return d.med === medId && d.date === date && (slot == null || (d.slot || "") === slot); })
      .sort(function (a, b) { return (a.at || "").localeCompare(b.at || ""); });
  }
  // The latest entry decides a slot's status, so a mistaken "missed" can be corrected by logging "given".
  function slotStatus(vault, medId, date, slot) { var e = entriesFor(vault, medId, date, slot); return e.length ? e[e.length - 1] : null; }
  function givenAlready(vault, medId, date, slot) { return entriesFor(vault, medId, date, slot).filter(function (d) { return d.status === "given"; })[0] || null; }
  function lastGiven(vault, medId) {
    return list(vault.doses).filter(function (d) { return d.med === medId && d.status === "given"; })
      .sort(function (a, b) { return (a.date + (a.at || "")).localeCompare(b.date + (b.at || "")); }).pop() || null;
  }
  function addDose(vault, rec) {
    if (!Array.isArray(vault.doses)) vault.doses = [];
    var e = { id: rec.id || V.uid(), med: rec.med, person: rec.person || "", date: rec.date, slot: rec.slot || "", status: rec.status === "missed" ? "missed" : "given",
      at: rec.at || "", by: rec.by || "", byName: rec.byName || "", note: rec.note || "" };
    vault.doses.push(e);
    return e;
  }
  // Everything due on one day for one person (or everyone), in clock order, plus the as-needed medicines.
  function dayPlan(vault, pid, date) {
    var meds = list(vault.meds).filter(function (m) { return (!pid || pid === "all" || m.person === pid) && medOn(m, date); }), rows = [], prn = [];
    meds.forEach(function (m) {
      if (m.prn) { prn.push({ med: m, entries: entriesFor(vault, m.id, date, null), last: lastGiven(vault, m.id) }); return; }
      slotsFor(m, date).forEach(function (s) { rows.push({ med: m, slot: s, entry: slotStatus(vault, m.id, date, s) }); });
    });
    rows.sort(function (a, b) { return a.slot.localeCompare(b.slot) || a.med.name.localeCompare(b.med.name); });
    var given = rows.filter(function (r) { return r.entry && r.entry.status === "given"; }).length, missed = rows.filter(function (r) { return r.entry && r.entry.status === "missed"; }).length;
    return { date: date, rows: rows, prn: prn, given: given, missed: missed, open: rows.length - given - missed };
  }
  // Counts for one medicine over a period. "open" = due but nothing logged.
  function doseStats(vault, m, from, to, cut) {
    var out = { scheduled: 0, given: 0, missed: 0, open: 0, prn: !!m.prn };
    if (m.prn) { list(vault.doses).forEach(function (d) { if (d.med === m.id && d.date >= from && d.date <= to && d.status === "given") out.given++; }); return out; }
    days(from, to).forEach(function (d) {
      dueSlots(m, d, cut).forEach(function (s) {
        var e = slotStatus(vault, m.id, d, s); out.scheduled++;
        if (!e) out.open++; else if (e.status === "given") out.given++; else out.missed++;
      });
    });
    return out;
  }
  // A grid for the history view: one row per medicine, one cell per day.
  function doseGrid(vault, pid, from, to, cut) {
    var ds = days(from, to);
    return { days: ds, rows: list(vault.meds).filter(function (m) { return (!pid || pid === "all" || m.person === pid) && ds.some(function (d) { return medOn(m, d); }); }).map(function (m) {
      return { med: m, cells: ds.map(function (d) {
        if (m.prn) { var n = entriesFor(vault, m.id, d, null).filter(function (e) { return e.status === "given"; }).length; return { state: n ? "prn" : "none", text: n ? n + "x" : "" }; }
        var sl = dueSlots(m, d, cut), g = 0, x = 0;
        sl.forEach(function (s) { var e = slotStatus(vault, m.id, d, s); if (e && e.status === "given") g++; else if (e) x++; });
        if (!sl.length) return { state: "none", text: "" };
        return { state: x ? "missed" : g === sl.length ? "given" : g ? "part" : "open", text: g + "/" + sl.length };
      }) };
    }) };
  }

  /* ---------- diary: appointments, symptoms and observations ---------- */
  function diaryFor(vault, pid, from, to, kind) {
    return list(vault.diary).filter(function (e) { return (!pid || pid === "all" || e.person === pid) && (!kind || e.kind === kind) && (!from || e.date >= from) && (!to || e.date <= to); })
      .sort(function (a, b) { return (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")); });
  }
  function upcoming(vault, today, pid) {
    return list(vault.diary).filter(function (e) { return e.kind === "appointment" && e.date >= today && (!pid || pid === "all" || e.person === pid); })
      .sort(function (a, b) { return (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")); });
  }
  function symptomGroups(entries) {
    var g = {};
    entries.filter(function (e) { return e.kind === "symptom"; }).forEach(function (e) {
      var k = e.what || "Other", x = g[k] = g[k] || { what: k, n: 0, worst: 0, first: e.date, last: e.date };
      x.n++; x.worst = Math.max(x.worst, +e.severity || 0); if (e.date < x.first) x.first = e.date; if (e.date > x.last) x.last = e.date;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.n - a.n || b.worst - a.worst || a.what.localeCompare(b.what); });
  }
  // The one-page "bring to the doctor" summary. Facts the family recorded; no interpretation, no advice.
  function doctorSummary(vault, pid, opts) {
    opts = opts || {};
    var today = opts.today || V.todayStr(), to = opts.to || today, cut = to === today && opts.now ? today + " " + opts.now : null, from = opts.from || V.addDays(to, -29), p = list(vault.people).filter(function (x) { return x.id === pid; })[0] || { name: "Unknown" },
      hr = (vault.health || {})[pid] || {}, period = diaryFor(vault, pid, from, to), next = upcoming(vault, today, pid)[0] || null;
    var meds = list(vault.meds).filter(function (m) { return m.person === pid && medOn(m, to); }).map(function (m) {
      return { name: m.name, dose: m.dose || "", how: m.prn ? "As needed" + (m.how ? ": " + m.how : "") : [m.how, parseTimes(m.times).join(", ")].filter(Boolean).join(" at "), purpose: m.purpose || "", prescriber: m.prescriber || "", stats: doseStats(vault, m, from, to, cut) };
    });
    var notes = period.filter(function (e) { return e.kind !== "appointment"; }).slice(0, 8).map(function (e) {
      return { date: e.date, time: e.time || "", what: e.kind === "symptom" ? (e.what || "Symptom") + (e.severity ? " (" + e.severity + " of 5)" : "") : (e.title || "Observation"), text: e.notes || "" };
    });
    var appts = period.filter(function (e) { return e.kind === "appointment" && e.date <= today; }).slice(0, 3).map(function (e) { return { date: e.date, title: e.title || e.with || "Appointment", outcome: e.outcome || "" }; });
    var qs = String(next && next.questions || "").split(/\r?\n/).concat(String(opts.questions || "").split(/\r?\n/)).map(function (s) { return s.replace(/^[-*\s]+/, "").trim(); }).filter(Boolean);
    return { person: p.name, dob: p.dob || "", from: from, to: to, printed: today, allergies: hr.allergies || "", conditions: hr.conditions || "", communication: hr.communication || "",
      meds: meds, symptoms: symptomGroups(period).slice(0, 8), notes: notes, appointments: appts, next: next ? { date: next.date, time: next.time || "", title: next.title || next.with || "Appointment", where: next.place || "" } : null,
      questions: qs.slice(0, 10), by: opts.by || "", footer: C.DISCLAIMER + " Written by the family from their own records; it may be incomplete." };
  }

  /* ---------- care rota: adapted from Stark Event Kit's volunteer roster (shifts, coverage gaps, fair auto-fill) ----------
     Event Kit's shifts are times on one evening; here every shift has its own date, and overnight shifts run into the next day. */
  function win(sh) {
    var d = V.dayNum(sh.date), s = hm(sh.start), e = hm(sh.end);
    if (isNaN(d) || s == null || e == null) return null;
    var a = d * 1440 + s, b = d * 1440 + e; if (b <= a) b += 1440;
    return [a, b];
  }
  function overlap(a, b) { var x = win(a), y = win(b); return !!(x && y && x[0] < y[1] && y[0] < x[1]); }
  function inRange(sh, from, to) { return (!from || sh.date >= from) && (!to || sh.date <= to); }
  function clean(R) {
    var hid = {}, sid = {}, k;
    R.helpers = list(R.helpers); R.shifts = list(R.shifts); R.handovers = list(R.handovers); R.assign = R.assign && typeof R.assign === "object" ? R.assign : {};
    R.helpers.forEach(function (p) { hid[p.id] = 1; }); R.shifts.forEach(function (s) { sid[s.id] = 1; });
    for (k in R.assign) { if (!sid[k]) { delete R.assign[k]; continue; } R.assign[k] = R.assign[k].filter(function (id, i, a) { return hid[id] && a.indexOf(id) === i; }); }
    return R;
  }
  function sorted(shifts) { return shifts.slice().sort(function (a, b) { var x = win(a), y = win(b); return (x ? x[0] : 0) - (y ? y[0] : 0) || String(a.role).localeCompare(String(b.role)); }); }
  function shiftsOf(R, hid, from, to) { return R.shifts.filter(function (s) { return inRange(s, from, to) && (R.assign[s.id] || []).indexOf(hid) >= 0; }); }
  function coverage(R, from, to) {
    clean(R);
    var rows = sorted(R.shifts.filter(function (s) { return inRange(s, from, to); })).map(function (s) { var n = (R.assign[s.id] || []).length, need = Math.max(1, +s.need || 1); return { shift: s, filled: n, need: need, gap: Math.max(0, need - n) }; });
    return { rows: rows, need: rows.reduce(function (a, r) { return a + r.need; }, 0), gaps: rows.reduce(function (a, r) { return a + r.gap; }, 0), short: rows.filter(function (r) { return r.gap; }) };
  }
  function conflicts(R, from, to) {
    clean(R);
    var out = [];
    R.helpers.forEach(function (p) {
      var mine = shiftsOf(R, p.id, from, to), i, j;
      for (i = 0; i < mine.length; i++) for (j = i + 1; j < mine.length; j++) if (overlap(mine[i], mine[j])) out.push({ helper: p, a: mine[i], b: mine[j] });
    });
    return out;
  }
  function minutes(R, hid, from, to) { return shiftsOf(R, hid, from, to).reduce(function (a, s) { var w = win(s); return a + (w ? w[1] - w[0] : 0); }, 0); }
  function isOff(helper, date) { return list(helper.off).map(Number).indexOf(weekday(date)) !== -1; }
  function assign(R, sid, hid, on) {
    var l = R.assign[sid] = R.assign[sid] || [], i = l.indexOf(hid);
    if (on && i < 0) l.push(hid); else if (!on && i >= 0) l.splice(i, 1);
  }
  // Fill gaps fairly: earliest shift first, the helper with the fewest hours in the period goes next,
  // never double-booking anyone and never using a day a helper said they cannot do.
  function autoFill(R, from, to) {
    clean(R);
    var added = 0;
    sorted(R.shifts.filter(function (s) { return inRange(s, from, to); })).forEach(function (s) {
      var l = R.assign[s.id] = R.assign[s.id] || [], need = Math.max(1, +s.need || 1);
      while (l.length < need) {
        var cand = R.helpers.filter(function (p) { return l.indexOf(p.id) < 0 && !isOff(p, s.date) && !shiftsOf(R, p.id).some(function (o) { return overlap(o, s); }); });
        if (!cand.length) break;
        cand.sort(function (a, b) { return minutes(R, a.id, from, to) - minutes(R, b.id, from, to) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
        l.push(cand[0].id); added++;
      }
    });
    return { added: added, gaps: coverage(R, from, to).gaps };
  }
  // Repeat a shift pattern over a run of days (optionally only some weekdays). Existing identical shifts are not duplicated.
  function addRepeating(R, tpl, from, n, weekdays) {
    clean(R);
    var made = 0, i, d, wd = list(weekdays).map(Number);
    if (hm(tpl.start) == null || hm(tpl.end) == null || isNaN(V.dayNum(from))) return 0;
    for (i = 0; i < Math.min(+n || 0, 92); i++) {
      d = V.addDays(from, i);
      if (wd.length && wd.indexOf(weekday(d)) === -1) continue;
      if (R.shifts.some(function (s) { return s.date === d && s.start === tpl.start && s.end === tpl.end && low(s.role) === low(tpl.role); })) continue;
      R.shifts.push({ id: V.uid(), date: d, start: fmtHm(hm(tpl.start)), end: fmtHm(hm(tpl.end)), role: tpl.role || "Care", need: Math.max(1, +tpl.need || 1), person: tpl.person || "" });
      made++;
    }
    return made;
  }
  function helperName(R, hid) { var p = list(R.helpers).filter(function (x) { return x.id === hid; })[0]; return p ? p.name : ""; }
  // Who is on duty at a moment (date + "HH:MM"), including an overnight shift that started yesterday.
  function onDuty(R, date, time) {
    clean(R);
    var t = V.dayNum(date) * 1440 + (hm(time) || 0);
    return sorted(R.shifts).filter(function (s) { var w = win(s); return w && w[0] <= t && t < w[1]; }).map(function (s) { return { shift: s, names: (R.assign[s.id] || []).map(function (id) { return helperName(R, id); }) }; });
  }
  function hoursBy(R, from, to) { clean(R); return R.helpers.map(function (p) { return { helper: p, minutes: minutes(R, p.id, from, to), shifts: shiftsOf(R, p.id, from, to).length }; }); }
  function csvCell(v) {
    var s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function rotaCSV(R, from, to) {
    clean(R);
    var rows = [["Date", "Day", "Start", "End", "Role", "Needed", "Assigned", "Short by"]];
    coverage(R, from, to).rows.forEach(function (r) {
      rows.push([r.shift.date, C.WEEKDAYS[weekday(r.shift.date)], r.shift.start, r.shift.end, r.shift.role, r.need, (R.assign[r.shift.id] || []).map(function (id) { return helperName(R, id); }).join("; "), r.gap || ""]);
    });
    return String.fromCharCode(0xfeff) + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n") + "\r\n";
  }
  function addHandover(R, rec) {
    R.handovers = list(R.handovers);
    var n = { id: V.uid(), date: rec.date, time: rec.time || "", by: rec.by || "", byName: rec.byName || "", person: rec.person || "", shift: rec.shift || "", text: String(rec.text || "").trim(), next: String(rec.next || "").trim() };
    R.handovers.push(n);
    return n;
  }
  function latestHandovers(R, n) { return list(R.handovers).slice().sort(function (a, b) { return (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")); }).slice(0, n || 5); }

  /* ---------- carer check-in: private, gentle, never an assessment ---------- */
  function checkinSummary(checkins, today) {
    var all = list(checkins).slice().sort(function (a, b) { return (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")); }), last = all[all.length - 1] || null,
      recent = all.filter(function (c) { var d = V.daysUntil(c.date, today); return d !== null && d <= 0 && d >= -13; }), last5 = all.slice(-5), noBreak = 0, i;
    for (i = all.length - 1; i >= 0 && all[i].brk === "no"; i--) noBreak++;
    var tone = !last ? "" : +last.feel <= 2 ? "low" : +last.feel === 3 ? "mid" : "good";
    return { last: last, tone: tone, todayDone: !!(last && last.date === today), recent: recent, hardRecent: last5.filter(function (c) { return +c.feel <= 2; }).length,
      noBreakStreak: noBreak, askForHelp: last5.filter(function (c) { return +c.feel <= 2; }).length >= 3 || noBreak >= 4 };
  }

  /* ---------- supply runway: arithmetic on the count the family entered (never advice) ----------
     m.onHand = doses counted, in the same units the family logs them; m.counted = the day of the count (after that day's doses).
     Doses logged as given after that day are taken off. Days left = what is left divided by the set times per day. */
  function supply(vault, m, today) {
    var n = parseFloat(m && m.onHand), from = m && m.counted;
    if (!m || !(n >= 0) || n > 100000 || isNaN(V.dayNum(from)) || from > today) return null;
    var used = 0, perDay = m.prn ? 0 : parseTimes(m.times).length;
    list(vault.doses).forEach(function (d) { if (d.med === m.id && d.status === "given" && d.date > from && d.date <= today) used++; });
    var left = Math.max(0, Math.round((n - used) * 100) / 100), days = perDay ? Math.floor(left / perDay) : null;
    var refillIn = m.refill ? V.daysUntil(m.refill, today) : null;
    return { onHand: n, counted: from, used: used, left: left, perDay: perDay, days: days, lastDay: days == null ? null : V.addDays(today, days - 1),
      refill: m.refill || "", refillIn: refillIn, short: days != null && refillIn != null && refillIn > days ? refillIn - days : 0 };
  }
  // The runway for every medicine with a count, shortest first. delay = "what if the refill comes N days late".
  function runway(vault, person, today, delay) {
    delay = Math.max(0, Math.min(60, Math.round(+delay || 0)));
    return list(vault.meds).filter(function (m) { return medOn(m, today) && (person === "all" || !person || m.person === person); }).map(function (m) {
      var s = supply(vault, m, today); if (!s) return null;
      s.med = m; s.delay = delay; s.shortIfLate = s.days != null && s.refillIn != null && s.refillIn + delay > s.days ? s.refillIn + delay - s.days : 0;
      return s;
    }).filter(Boolean).sort(function (a, b) { return (a.days == null ? 1e9 : a.days) - (b.days == null ? 1e9 : b.days) || a.med.name.localeCompare(b.med.name); });
  }

  var api = { supply: supply, runway: runway, hm: hm, fmtHm: fmtHm, parseTimes: parseTimes, weekday: weekday, days: days, medOn: medOn, slotsFor: slotsFor, dueSlots: dueSlots, entriesFor: entriesFor, slotStatus: slotStatus,
    givenAlready: givenAlready, lastGiven: lastGiven, addDose: addDose, dayPlan: dayPlan, doseStats: doseStats, doseGrid: doseGrid,
    diaryFor: diaryFor, upcoming: upcoming, symptomGroups: symptomGroups, doctorSummary: doctorSummary,
    win: win, overlap: overlap, clean: clean, shiftsOf: shiftsOf, coverage: coverage, conflicts: conflicts, minutes: minutes, isOff: isOff, assign: assign, autoFill: autoFill,
    addRepeating: addRepeating, helperName: helperName, onDuty: onDuty, hoursBy: hoursBy, csvCell: csvCell, rotaCSV: rotaCSV, addHandover: addHandover, latestHandovers: latestHandovers,
    checkinSummary: checkinSummary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CareLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
