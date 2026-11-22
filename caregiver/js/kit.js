/* Stark Caregiver, by Stark: planning logic (no DOM, no network). Reminders, calendar export, search, the hospital and
   emergency bag, care readiness and the emergency binder. Pure functions; runs in the browser and in Node (tests). */
(function (root) {
  "use strict";
  var V = root.CareCore || (typeof require === "function" ? require("./core.js") : null);
  var C = root.CareContent || (typeof require === "function" ? require("./content.js") : null);
  var L = root.CareLogic || (typeof require === "function" ? require("./care.js") : null);
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function list(x) { return Array.isArray(x) ? x : []; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

  /* ---- dates ---- */
  function addMonths(date, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ""), y, mo, d, last;
    if (!m || isNaN(V.dayNum(date))) return null;
    mo = +m[2] - 1 + n; y = +m[1] + Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; d = +m[3];
    last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return y + "-" + ("0" + (mo + 1)).slice(-2) + "-" + ("0" + Math.min(d, last)).slice(-2);
  }
  function ageOn(dob, today) {
    var a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || ""), b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today || V.todayStr()), age;
    if (!a || !b || isNaN(V.dayNum(dob))) return null;
    age = +b[1] - +a[1]; if (+b[2] < +a[2] || (+b[2] === +a[2] && +b[3] < +a[3])) age--;
    return age < 0 ? null : age;
  }

  /* ---- one list of every dated thing: documents, refills, appointments and the carer's own checks ---- */
  var LEAD = { doc: 60, med: 7, task: 14, appt: 3 };
  function mk(src, route, rec, date, lead, title, verb, summary, person, time) {
    var l = lead == null || lead === "" ? LEAD[src] : +lead;
    return { key: src + ":" + rec.id, src: src, route: route, id: rec.id, title: title, person: person || "", date: date, time: time || "", lead: l, verb: verb, summary: summary, repeat: rec.repeat || "" };
  }
  function allReminders(vault, today, opts) {
    opts = opts || {};
    var out = [], t = today || V.todayStr(), add = function (r) {
      var s = V.reminderStatus({ expires: r.date, leadDays: r.lead }, t);
      r.state = s.state; r.days = s.days; r.remindOn = s.remindOn;
      if (s.state === "none" || (s.state === "ok" && !opts.includeOk)) return;
      if (opts.person && opts.person !== "all" && r.person && r.person !== "household" && r.person !== opts.person) return;
      out.push(r);
    };
    list(vault.docs).forEach(function (d) { add(mk("doc", "docs", d, d.expires, d.leadDays, d.title, "Expires", d.title + " expires", d.person)); });
    list(vault.meds).forEach(function (m) { if (m.active === false) return; add(mk("med", "meds", m, m.refill, m.leadDays, "Refill: " + m.name, "Refill due", "Refill " + m.name, m.person)); });
    list(vault.tasks).forEach(function (k) { add(mk("task", "reminders", k, k.due, k.leadDays, k.title, "Due", k.title, k.person)); });
    // Appointments only remind going forward: a past appointment is history, not "overdue".
    list(vault.diary).forEach(function (e) {
      if (e.kind !== "appointment" || !e.date || e.date < t) return;
      var name = e.title || e.with || "Appointment";
      add(mk("appt", "diary", e, e.date, e.leadDays, "Appointment: " + name, "Appointment", "Appointment: " + name, e.person, e.time));
    });
    out.sort(function (a, b) { return a.days - b.days || (a.time || "").localeCompare(b.time || "") || a.title.localeCompare(b.title); });
    return out;
  }
  function dueText(r) {
    var n = Math.abs(r.days);
    if (r.state === "expired") return r.src === "doc" ? "Expired " + plural(n, "day") + " ago" : "Overdue by " + plural(n, "day");
    if (r.days === 0) return r.verb + " today" + (r.time ? " at " + r.time : "");
    if (r.days === 1 && r.src === "appt") return "Appointment tomorrow" + (r.time ? " at " + r.time : "");
    return r.verb + " in " + plural(r.days, "day");
  }
  // Mark a repeating check done: move it forward by its interval until it is after today. One-off checks return null (remove them).
  function nextDue(task, today) {
    var n = +task.repeat, d = task.due, t = today || V.todayStr(), guard = 0;
    if (!n || !d || isNaN(V.dayNum(d))) return null;
    do { d = addMonths(d, n); } while (V.dayNum(d) <= V.dayNum(t) && ++guard < 600);
    return d;
  }

  /* calendar file: full version only */
  /* ---- search (media, ids and the carer's private check-ins are never searched) ---- */
  var SKIP = { id: 1, person: 1, med: 1, by: 1, scan: 1, data: 1, bag: 1, off: 1 };
  function textOf(o, depth) {
    if (o == null) return "";
    if (typeof o === "string" || typeof o === "number") return String(o);
    if (depth > 4) return "";
    if (Array.isArray(o)) return o.map(function (x) { return textOf(x, depth + 1); }).join(" · ");
    if (isObj(o)) return Object.keys(o).filter(function (k) { return !SKIP[k]; }).map(function (k) { return textOf(o[k], depth + 1); }).filter(Boolean).join(" · ");
    return "";
  }
  function search(vault, q, limit) {
    var terms = String(q || "").toLowerCase().split(/\s+/).filter(Boolean), out = [], pn = {}, test, snip, R = vault.rota || {};
    if (!terms.length) return out;
    list(vault.people).forEach(function (p) { pn[p.id] = p.name; });
    test = function (txt) { var l = txt.toLowerCase(); return terms.every(function (t) { return l.indexOf(t) !== -1; }); };
    snip = function (txt) { var l = txt.toLowerCase(), i = l.indexOf(terms[0]), a = Math.max(0, i - 40); return (a ? "..." : "") + txt.slice(a, a + 110).trim() + (txt.length > a + 110 ? "..." : ""); };
    function hit(section, route, title, rec, extra) {
      var txt = (title + " · " + textOf(rec, 0) + (extra ? " · " + extra : ""));
      if (test(txt)) out.push({ section: section, route: route, title: title, snippet: snip(txt) });
    }
    list(vault.people).forEach(function (p) { hit("People", "people", p.name, p); });
    list(vault.meds).forEach(function (m) { hit("Medicines", "meds", m.name + (pn[m.person] ? " (" + pn[m.person] + ")" : ""), m); });
    list(vault.diary).forEach(function (e) { hit("Diary", "diary", (e.kind === "appointment" ? "Appointment: " + (e.title || e.with || "") : e.kind === "symptom" ? (e.what || "Symptom") : (e.title || "Observation")) + " · " + e.date, e, pn[e.person]); });
    Object.keys(vault.health || {}).forEach(function (pid) { hit("Health", "health", "Health summary: " + (pn[pid] || "Unknown"), vault.health[pid]); });
    list(vault.contacts).forEach(function (c) { hit("Care team", "contacts", c.name, c); });
    list(vault.docs).forEach(function (d) { hit("Documents", "docs", d.title, d, pn[d.person]); });
    list(R.handovers).forEach(function (n) { hit("Care rota", "rota", "Handover " + n.date + (n.byName ? " from " + n.byName : ""), { text: n.text, next: n.next }); });
    list(R.helpers).forEach(function (p) { hit("Care rota", "rota", p.name, { name: p.name, rel: p.rel, phone: p.phone, notes: p.notes }); });
    list(vault.tasks).forEach(function (k) { hit("Reminders", "reminders", k.title, k); });
    if (isObj(vault.emergency) && Object.keys(vault.emergency).length) hit("Emergency plan", "emergency", "Emergency plan", vault.emergency);
    return out.slice(0, limit || 60);
  }

  /* ---- hospital and emergency bag, built from the people cared for, their medicines and local hazards ---- */
  var BAG = [
    ["medlist", "Printed medicine list and the emergency card"], ["meds", "A few days of each regular medicine, in the original boxes"],
    ["docs", "Copies of ID, insurance card and any advance directive (printed copies are not encrypted)"], ["aids", "Glasses, hearing aids and spare batteries, dentures and their case"],
    ["chargers", "Phone, charger and a charged power bank"], ["clothes", "Comfortable clothes, nightwear and non-slip slippers"], ["toiletries", "Toiletries, and continence supplies if used"],
    ["contacts", "Printed list of people to call"], ["notebook", "A notebook and pen for what the doctors say"], ["comfort", "Something comforting: photos, a blanket, music and headphones"],
    ["carer", "For you: snacks, a water bottle, a jumper and something to read"], ["cash", "Some cash or a card for parking and the cafe"]];
  var HAZARD_BAG = {
    heat: [["heat-cool", "Plan for a cool room or a cooler place to go, and extra water"], ["heat-check", "Agree who checks in during a heat wave, and how often"]],
    winter: [["winter-warm", "Warm layers and blankets, and a safe way to stay warm"], ["winter-heat", "Never run generators, grills or camp stoves indoors"]],
    power: [["power-equip", "Back-up plan for powered medical equipment: spare batteries or cylinders and the supplier's number"], ["power-cold", "Plan for medicines that must be kept cold"]],
    fire: [["fire-mask", "Masks rated for smoke, and a plan to leave early when officials say so"]],
    flood: [["flood-bags", "Waterproof bags for papers and medicines"]],
    storm: [["storm-early", "Plan to move somewhere safer early if officials advise it"]],
    quake: [["quake-shoes", "Sturdy shoes and a torch by the bed"]],
    illness: [["ill-backup", "A back-up carer arranged in case the main carer is ill"]]
  };
  function goBag(vault, today) {
    var e = vault.emergency || {}, out = [], t = today || V.todayStr(), ages = list(vault.people).map(function (p) { return { p: p, a: ageOn(p.dob, t) }; });
    BAG.forEach(function (b) { out.push({ id: b[0], text: b[1], group: "Everyone" }); });
    list(e.hazards).forEach(function (hz) { (HAZARD_BAG[hz] || []).forEach(function (b) { out.push({ id: b[0], text: b[1], group: "Local hazards" }); }); });
    if (ages.some(function (x) { return x.a !== null && x.a < 2; })) out.push({ id: "infant", text: "Baby supplies: milk or formula, food, nappies or diapers, bottles", group: "The people you care for" });
    if (ages.some(function (x) { return x.a !== null && x.a < 13; })) out.push({ id: "child", text: "A comfort item and favourite snacks for the child", group: "The people you care for" });
    if (ages.some(function (x) { return x.a !== null && x.a >= 70; })) out.push({ id: "older", text: "Walking aid and any mobility equipment", group: "The people you care for" });
    list(vault.meds).forEach(function (m) {
      if (m.active === false) return;
      var who = list(vault.people).filter(function (p) { return p.id === m.person; })[0];
      out.push({ id: "med-" + m.id, text: "Medicine: " + m.name + (m.dose ? " " + m.dose : "") + (who ? " for " + who.name : ""), group: "The people you care for" });
    });
    Object.keys(vault.health || {}).forEach(function (pid) {
      var hr = vault.health[pid] || {}, who = list(vault.people).filter(function (p) { return p.id === pid; })[0];
      if (who && /epinephrine|epipen|auto-?injector|anaphyla|severe/i.test(String(hr.allergies || ""))) out.push({ id: "epi-" + pid, text: "Allergy plan and any emergency medicine for " + who.name, group: "The people you care for" });
    });
    if (String(e.pets || "").trim()) out.push({ id: "pets", text: "Pet food and the pet plan for whoever is looking after them", group: "Home" });
    return out;
  }

  /* ---- care readiness: what would help on a bad day ---- */
  function readiness(vault, today) {
    var t = today || V.todayStr(), e = vault.emergency || {}, bag = goBag(vault, t), packed = bag.filter(function (b) { return (e.bag || {})[b.id]; }).length,
      bk = (vault.settings || {}).lastBackup, bkDays = bk ? V.daysUntil(t, bk) : null, R = vault.rota || {},
      overdue = allReminders(vault, t).filter(function (r) { return r.state === "expired"; }).length;
    var items = [
      { id: "contacts", label: "Two or more emergency contacts", done: list(vault.contacts).filter(function (c) { return c.emergency; }).length >= 2, route: "contacts" },
      { id: "health", label: "A health summary for everyone you care for", done: list(vault.people).length > 0 && list(vault.people).every(function (p) { return (vault.health || {})[p.id]; }), route: "health" },
      { id: "meds", label: "Medicine list with times", done: list(vault.meds).some(function (m) { return m.active !== false && (m.prn || L.parseTimes(m.times).length); }), route: "meds" },
      { id: "plan", label: "Emergency plan: usual hospital and who to call first", done: !!(e.hospital && e.firstCall), route: "emergency" },
      { id: "bag", label: "Hospital bag at least half packed", done: bag.length > 0 && packed * 2 >= bag.length, route: "emergency" },
      { id: "rota", label: "At least two people share the care rota", done: list(R.helpers).length >= 2, route: "rota" },
      { id: "docs", label: "Key documents recorded", done: list(vault.docs).length >= 1, route: "docs" },
      { id: "current", label: "Nothing overdue: refills, documents, checks", done: overdue === 0, route: "reminders" },
      { id: "support", label: "A support line or respite contact saved for you", done: list(vault.contacts).some(function (c) { return /Respite|support line/i.test(c.role || ""); }), route: "you" },
      { id: "backup", label: "Backup saved in the last 30 days", done: bkDays !== null && bkDays <= 30, route: "share" }];
    return { items: items, pct: Math.round(items.filter(function (i) { return i.done; }).length * 100 / items.length) };
  }

  /* binder: full version only */
  function vaultSize(vault) { return JSON.stringify(vault).length; }

  var api = { addMonths: addMonths, ageOn: ageOn, allReminders: allReminders, dueText: dueText, nextDue: nextDue, /* calendar file: full version only */
    search: search, goBag: goBag, readiness: readiness, /* binder: full version only */ vaultSize: vaultSize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CareKit = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
