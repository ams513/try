/* Stark Family Vault, by Stark: planning logic (no DOM, no network). Reminders, calendar export, hint checks, search,
   inventory export, go-bag, readiness and the emergency binder. Pure functions; runs in the browser and in Node (tests). */
(function (root) {
  "use strict";
  var V = root.StarkVault || (typeof require === "function" ? require("./core.js") : null);
  var C = root.VaultContent || (typeof require === "function" ? require("./content.js") : null);
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

  /* ---- estate checklist by jurisdiction type (questions to ask, never statements of law) ---- */
  function checklistFor(juris) {
    var out = C.CHECKLIST.map(function (i) { return { id: i.id, title: i.title, why: i.why, group: "" }; });
    C.JURISDICTIONS.forEach(function (j) { if (list(juris).indexOf(j.id) !== -1) j.items.forEach(function (i) { out.push({ id: i.id, title: i.title, why: i.why, group: j.label }); }); });
    return out;
  }
  function planProgress(vault, pid) {
    var items = checklistFor((vault.settings || {}).juris), checks = ((vault.plan || {})[pid] || {}).checks || {};
    return { done: items.filter(function (i) { return checks[i.id] && checks[i.id].done; }).length, total: items.length };
  }
  function letterText(vault, p) {
    var L = ((vault.plan || {})[p.id] || {}).letter || {}, out = ["If something happens to me", "From " + p.name + (L.date ? ", written " + L.date : ""), ""];
    C.LETTER.forEach(function (q) { if (L[q.k]) { out.push(q.label.toUpperCase()); out.push(L[q.k]); out.push(""); } });
    if (list(vault.contacts).length) { out.push("PEOPLE TO CALL"); vault.contacts.forEach(function (c) { out.push("- " + c.name + (c.role ? " (" + c.role + ")" : "") + (c.phone ? ": " + c.phone : "")); }); out.push(""); }
    if (list(vault.accounts).length) { out.push("ACCOUNTS (institution and last 4 digits only)"); vault.accounts.forEach(function (a) { out.push("- " + a.institution + (a.last4 ? " ending " + a.last4 : "") + (a.kind ? " (" + a.kind + ")" : "")); }); out.push(""); }
    out.push("This letter is a personal note, not a will or legal document.");
    return out.join("\n");
  }

  /* ---- money helpers ---- */
  var PREMIUM_FREQ = [{ v: "Monthly", n: 12 }, { v: "Quarterly", n: 4 }, { v: "Twice a year", n: 2 }, { v: "Yearly", n: 1 }, { v: "Paid once", n: 0 }];
  function annualPremium(p) {
    var f = PREMIUM_FREQ.filter(function (x) { return x.v === p.freq; })[0];
    return (+p.premium || 0) * (f ? f.n : 1);
  }
  function itemTotal(x) { var q = x.qty === "" || x.qty == null ? 1 : +x.qty; return (+x.value || 0) * (isFinite(q) && q > 0 ? q : 1); }
  function invTotal(inv) { return list(inv).reduce(function (s, x) { return s + itemTotal(x); }, 0); }

  /* ---- one list of every dated thing in the vault ---- */
  var LEAD = { doc: 60, policy: 30, med: 7, task: 14, warranty: 30 };
  function mk(src, route, rec, date, lead, title, verb, summary, person) {
    var l = lead == null || lead === "" ? LEAD[src] : +lead, st = V.reminderStatus({ expires: date, leadDays: l });
    return { key: src + ":" + rec.id, src: src, route: route, id: rec.id, title: title, person: person || "", date: date, lead: l, verb: verb, summary: summary, repeat: rec.repeat || "", state: st.state, days: st.days, remindOn: st.remindOn };
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
    list(vault.policies).forEach(function (p) { var n = (p.insurer || "Policy") + (p.type ? " " + p.type.toLowerCase() : "") + " policy"; add(mk("policy", "insurance", p, p.renews, p.leadDays, n, "Renews", n + " renews", p.person)); });
    list(vault.meds).forEach(function (m) { if (m.active === false) return; add(mk("med", "health", m, m.refill, m.leadDays, "Refill: " + m.name, "Refill due", "Refill " + m.name, m.person)); });
    list(vault.tasks).forEach(function (k) { add(mk("task", "reminders", k, k.due, k.leadDays, k.title, "Due", k.title, k.person)); });
    list(vault.inventory).forEach(function (x) { if (x.warranty) add(mk("warranty", "inventory", x, x.warranty, null, "Warranty: " + x.item, "Warranty ends", "Warranty ends: " + x.item, "")); });
    out.sort(function (a, b) { return a.days - b.days || a.title.localeCompare(b.title); });
    return out;
  }
  function dueText(r) {
    var n = Math.abs(r.days);
    if (r.state === "expired") return r.src === "doc" ? "Expired " + plural(n, "day") + " ago" : r.src === "warranty" ? "Warranty ended " + plural(n, "day") + " ago" : "Overdue by " + plural(n, "day");
    if (r.days === 0) return r.verb + " today";
    return r.verb + " in " + plural(r.days, "day");
  }
  // Mark a repeating check done: move it forward by its interval until it is after today. One-off checks return null (remove them).
  function nextDue(task, today) {
    var n = +task.repeat, d = task.due, t = today || V.todayStr(), guard = 0;
    if (!n || !d || isNaN(V.dayNum(d))) return null;
    do { d = addMonths(d, n); } while (V.dayNum(d) <= V.dayNum(t) && ++guard < 600);
    return d;
  }

/* full version only */
  function passwordLike(s) {
    var t = String(s || "").trim(), why = [], toks, bare;
    if (!t) return why;
    if (/\b(pass(word|code|phrase)?|pwd|pin|code|combination)\s*(is|=|:)/i.test(t)) why.push("it seems to state the password or code itself");
    toks = t.split(/\s+/).map(function (w) { return w.replace(/^["'(\[]+|["')\].,;:!?]+$/g, ""); });
    bare = toks.length === 1 ? toks[0] : "";
    var mixed = function (w, n) { return w.length >= n && /[A-Za-z]/.test(w) && /\d/.test(w); };
    if (toks.some(function (w) { return mixed(w, 8); }) || mixed(bare, 6)) why.push("it has a word that mixes letters and numbers like a real password");
    else if (bare.length >= 8 && (/[^A-Za-z0-9]/.test(bare) || (/[a-z]/.test(bare) && /[A-Z]/.test(bare)))) why.push("it is a single string that could be the password itself");
    if (/^\d{4,12}$/.test(t.replace(/[\s-]/g, ""))) why.push("it is a number that could be a PIN or code");
    return why;
  }

  /* ---- search across the vault (media and ids are skipped) ---- */
  // Password hints are never searched, so they cannot appear in a result snippet on screen.
  var SKIP = { id: 1, person: 1, owner: 1, scan: 1, photo: 1, photo2: 1, photo3: 1, receipt: 1, data: 1, hint: 1, bag: 1 };
  function textOf(o, depth) {
    if (o == null) return "";
    if (typeof o === "string" || typeof o === "number") return String(o);
    if (depth > 4) return "";
    if (Array.isArray(o)) return o.map(function (x) { return textOf(x, depth + 1); }).join(" · ");
    if (isObj(o)) return Object.keys(o).filter(function (k) { return !SKIP[k]; }).map(function (k) { return textOf(o[k], depth + 1); }).filter(Boolean).join(" · ");
    return "";
  }
  function search(vault, q, limit) {
    var terms = String(q || "").toLowerCase().split(/\s+/).filter(Boolean), out = [], pn = {}, test, snip;
    if (!terms.length) return out;
    list(vault.people).forEach(function (p) { pn[p.id] = p.name; });
    test = function (txt) { var l = txt.toLowerCase(); return terms.every(function (t) { return l.indexOf(t) !== -1; }); };
    snip = function (txt) { var l = txt.toLowerCase(), i = l.indexOf(terms[0]), a = Math.max(0, i - 40); return (a ? "..." : "") + txt.slice(a, a + 110).trim() + (txt.length > a + 110 ? "..." : ""); };
    function hit(section, route, title, rec, extra) {
      var txt = (title + " · " + textOf(rec, 0) + (extra ? " · " + extra : ""));
      if (test(txt)) out.push({ section: section, route: route, title: title, snippet: snip(txt) });
    }
    list(vault.people).forEach(function (p) { hit("Family", "family", p.name, p); });
    list(vault.docs).forEach(function (d) { hit("Documents", "docs", d.title, d, pn[d.person]); });
    Object.keys(vault.health || {}).forEach(function (pid) { hit("Health", "health", "Health summary: " + (pn[pid] || "Unknown"), vault.health[pid]); });
    list(vault.meds).forEach(function (m) { hit("Medications", "health", m.name + (pn[m.person] ? " (" + pn[m.person] + ")" : ""), m); });
    list(vault.contacts).forEach(function (c) { hit("Contacts", "money", c.name, c); });
    list(vault.accounts).forEach(function (a) { hit("Accounts", "money", a.institution, a, pn[a.owner]); });
    list(vault.policies).forEach(function (p) { hit("Insurance", "insurance", (p.insurer || "Policy") + " · " + (p.type || ""), p); });
    list(vault.digital).forEach(function (d) { hit("Digital", "digital", d.service, d, pn[d.person]); });
    list(vault.inventory).forEach(function (x) { hit("Home inventory", "inventory", x.item, x); });
    list(vault.tasks).forEach(function (k) { hit("Reminders", "reminders", k.title, k); });
    Object.keys(vault.plan || {}).forEach(function (pid) { var p = vault.plan[pid] || {}; hit("Planning", "plan", "Planning: " + (pn[pid] || "Unknown"), { letter: p.letter, roles: p.roles, wishes: p.wishes, notes: Object.keys(p.checks || {}).map(function (k) { return (p.checks[k] || {}).note || ""; }) }); });
    if (isObj(vault.emergency) && Object.keys(vault.emergency).length) hit("Emergency plan", "emergency", "Emergency plan", vault.emergency);
    return out.slice(0, limit || 60);
  }

/* full version only */
  var BAG = [
    ["water", "Drinking water for everyone for several days (your local emergency agency publishes amounts)"], ["food", "Food that keeps, and a manual can opener"],
    ["light", "Torch or flashlight and spare batteries"], ["radio", "Battery or wind-up radio for official alerts"], ["firstaid", "First-aid kit"],
    ["meds", "A few days of each regular medicine and copies of prescriptions"], ["docs", "Copies of IDs and insurance papers in a waterproof bag (printed copies are not encrypted)"],
    ["cash", "Some cash in small notes"], ["power", "Phone chargers and a charged power bank"], ["clothes", "Change of clothes, sturdy shoes and rain gear"],
    ["hygiene", "Hygiene items, masks and hand sanitiser"], ["keys", "Spare house and car keys"], ["whistle", "Whistle to signal for help"], ["plan", "Printed contact list and this emergency plan"]];
  var HAZARD_BAG = {
    fire: [["fire-mask", "Well-fitting masks rated for smoke, and goggles"], ["fire-early", "Plan to leave early when officials say so; car fuelled and facing out"]],
    flood: [["flood-bags", "Waterproof bags for papers and electronics"], ["flood-route", "Know the route to higher ground"]],
    quake: [["quake-shoes", "Sturdy shoes, gloves and a torch by every bed"], ["quake-gas", "Know where the gas shut-off is (turn it off only if you smell gas or are told to)"]],
    storm: [["storm-secure", "Supplies to secure windows and outdoor items"], ["storm-fuel", "Car fuelled and important items moved up high"]],
    winter: [["winter-warm", "Warm blankets, hats and gloves for everyone"], ["winter-heat", "Safe heating plan: never run generators, grills or camp stoves indoors"]],
    heat: [["heat-cool", "Plan to reach a cool place and extra water"], ["heat-check", "Arrange to check on older relatives and neighbours"]],
    power: [["power-med", "Back-up plan for anyone who relies on powered medical equipment"], ["power-food", "Cool box and a plan for food in the fridge"]],
    chemical: [["chem-shelter", "Shelter-in-place plan: close windows, turn off ventilation, follow official instructions"], ["chem-tape", "Tape and plastic sheeting for the safe room"]],
    illness: [["ill-supply", "A supply of everyday essentials and medicines"], ["ill-thermo", "Thermometer and fever medicine"]]
  };
  function goBag(vault, today) {
    var e = vault.emergency || {}, out = [], t = today || V.todayStr(), ages = list(vault.people).map(function (p) { return { p: p, a: ageOn(p.dob, t) }; });
    BAG.forEach(function (b) { out.push({ id: b[0], text: b[1], group: "Everyone" }); });
    list(e.hazards).forEach(function (hz) { (HAZARD_BAG[hz] || []).forEach(function (b) { out.push({ id: b[0], text: b[1], group: "Local hazards" }); }); });
    if (ages.some(function (x) { return x.a !== null && x.a < 2; })) out.push({ id: "infant", text: "Baby supplies: milk or formula, food, nappies or diapers, bottles", group: "Your family" });
    if (ages.some(function (x) { return x.a !== null && x.a < 13; })) out.push({ id: "child", text: "Comfort item and simple games for the children; school pickup plan agreed", group: "Your family" });
    if (ages.some(function (x) { return x.a !== null && x.a >= 70; })) out.push({ id: "older", text: "Spare glasses, hearing-aid batteries and mobility aids", group: "Your family" });
    list(vault.meds).forEach(function (m) {
      if (m.active === false) return;
      var who = list(vault.people).filter(function (p) { return p.id === m.person; })[0];
      out.push({ id: "med-" + m.id, text: "Medicine: " + m.name + (m.dose ? " " + m.dose : "") + (who ? " for " + who.name : ""), group: "Your family" });
    });
    Object.keys(vault.health || {}).forEach(function (pid) {
      var hr = vault.health[pid] || {}, who = list(vault.people).filter(function (p) { return p.id === pid; })[0];
      if (who && /epinephrine|epipen|auto-?injector|anaphyla|severe/i.test(String(hr.allergies || ""))) out.push({ id: "epi-" + pid, text: "Allergy plan and any emergency medicine for " + who.name, group: "Your family" });
    });
    if (String(e.pets || "").trim()) out.push({ id: "pets", text: "Pet food, water, lead or carrier and vaccination records", group: "Your family" });
    return out;
  }

  /* ---- readiness: what a family would need in a bad week ---- */
  function readiness(vault, today) {
    var t = today || V.todayStr(), e = vault.emergency || {}, bag = goBag(vault, t), packed = bag.filter(function (b) { return (e.bag || {})[b.id]; }).length,
      bk = (vault.settings || {}).lastBackup, bkDays = bk ? V.daysUntil(t, bk) : null, expired = allReminders(vault, t).filter(function (r) { return r.state === "expired" && (r.src === "doc" || r.src === "policy"); }).length;
    var items = [
      { id: "contacts", label: "Two or more emergency contacts", done: list(vault.contacts).filter(function (c) { return c.emergency; }).length >= 2, route: "money" },
      { id: "health", label: "A health summary for everyone", done: list(vault.people).length > 0 && list(vault.people).every(function (p) { return (vault.health || {})[p.id]; }), route: "health" },
      { id: "docs", label: "Key documents recorded", done: list(vault.docs).length >= 1, route: "docs" },
      { id: "current", label: "No expired documents or policies", done: expired === 0, route: "reminders" },
      { id: "insurance", label: "Insurance policies listed", done: list(vault.policies).length >= 1, route: "insurance" },
      { id: "plan", label: "Emergency plan: meeting place and out-of-area contact", done: !!(e.meetNear && e.outName), route: "emergency" },
      { id: "bag", label: "Go-bag at least half packed", done: bag.length > 0 && packed * 2 >= bag.length, route: "emergency" },
      { id: "will", label: "A will recorded for at least one adult", done: Object.keys(vault.plan || {}).some(function (k) { var c = (vault.plan[k] || {}).checks || {}; return c.will && c.will.done; }), route: "plan" },
      { id: "digital", label: "Digital legacy list started", done: list(vault.digital).length >= 1, route: "digital" },
      { id: "backup", label: "Backup saved in the last 90 days", done: bkDays !== null && bkDays <= 90, route: "share" }];
    return { items: items, pct: Math.round(items.filter(function (i) { return i.done; }).length * 100 / items.length) };
  }

/* full version only */
  function vaultSize(vault) { return JSON.stringify(vault).length; }

  var api = { addMonths: addMonths, ageOn: ageOn, checklistFor: checklistFor, planProgress: planProgress, letterText: letterText, PREMIUM_FREQ: PREMIUM_FREQ, annualPremium: annualPremium,
    itemTotal: itemTotal, invTotal: invTotal, allReminders: allReminders, dueText: dueText, nextDue: nextDue,
    passwordLike: passwordLike, search: search, goBag: goBag, readiness: readiness, vaultSize: vaultSize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.VaultKit = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
