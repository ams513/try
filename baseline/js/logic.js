/* Stark Baseline, by Stark: pure logic (no DOM). Scores, drill and training status, phone trees, the runbook model,
   attention list and HIPAA evidence summary. Runs in the browser and in Node (tests). */
(function (root) {
  "use strict";
  var V = root.StarkBaseline || (typeof require === "function" ? require("./core.js") : null);
  var C = root.BaselineContent || (typeof require === "function" ? require("./content.js") : null);
  var NOT_ADVICE = "Not legal or compliance advice.";

  /* ---- checklist progress by NIST CSF 2.0 Function ---- */
  function weight(st) { return st === "done" ? 1 : st === "doing" ? 0.5 : 0; }
  function statusOf(checks, id) { var c = checks && checks[id]; return c && c.status ? c.status : "todo"; }
  function scores(checks, list) {
    var out = { fns: {}, overall: { total: 0, applicable: 0, done: 0, doing: 0, na: 0, pct: 0 } }, pts = 0;
    (list || C.CHECKLIST).forEach(function (it) {
      var f = out.fns[it.fn] || (out.fns[it.fn] = { total: 0, applicable: 0, done: 0, doing: 0, na: 0, pts: 0, pct: 0 }), st = statusOf(checks, it.id);
      f.total++; out.overall.total++;
      if (st === "na") { f.na++; out.overall.na++; return; }
      f.applicable++; out.overall.applicable++; f.pts += weight(st); pts += weight(st);
      if (st === "done") { f.done++; out.overall.done++; } else if (st === "doing") { f.doing++; out.overall.doing++; }
    });
    Object.keys(out.fns).forEach(function (k) { var f = out.fns[k]; f.pct = f.applicable ? Math.round(100 * f.pts / f.applicable) : 0; delete f.pts; });
    out.overall.pct = out.overall.applicable ? Math.round(100 * pts / out.overall.applicable) : 0;
    return out;
  }

  /* ---- risks: likelihood x impact on a 1-3 scale ---- */
  function riskLevel(l, i) {
    var s = (+l || 0) * (+i || 0);
    if (!s) return { score: 0, label: "Not rated", cls: "" };
    return s >= 6 ? { score: s, label: "High", cls: "bad" } : s >= 3 ? { score: s, label: "Medium", cls: "warn" } : { score: s, label: "Low", cls: "good" };
  }
  function rankedRisks(risks) {
    return (risks || []).slice().sort(function (a, b) { return riskLevel(b.likelihood, b.impact).score - riskLevel(a.likelihood, a.impact).score; });
  }

  /* ---- restore drills: every backup needs a working restore within the interval (default 365 days) ---- */
  function drillStatus(d, today) {
    var every = +(d.settings && d.settings.drillDays) || 365, by = {};
    (d.drills || []).forEach(function (x) {   // grouped once: O(drills + backups), not drills x backups
      if (x.type !== "restore" || !x.backup || isNaN(V.dayNum(x.date))) return;
      (by[x.backup] || (by[x.backup] = [])).push(x);
    });
    return (d.backups || []).map(function (b) {
      var runs = (Object.prototype.hasOwnProperty.call(by, b.id) ? by[b.id] : []).slice().sort(function (a, c) { return V.dayNum(c.date) - V.dayNum(a.date); });
      var ok = runs.filter(function (x) { return x.result === "ok"; })[0], last = runs[0] || null, age = ok ? V.daysBetween(ok.date, today) : null, state;
      if (!ok) state = last ? "failed" : "never";
      else state = age > every ? "overdue" : age > every - 30 ? "soon" : "ok";
      return { backup: b, last: last, lastOk: ok || null, age: age, every: every, state: state, due: ok ? V.addDays(ok.date, every) : today };
    });
  }
  var DRILL_TEXT = { never: "Never tested", failed: "Last test did not fully work", overdue: "Test overdue", soon: "Test due soon", ok: "Tested" };

  /* ---- staff training: a lesson counts if it was completed within the last 12 months ---- */
  function trainingStatus(d, today) {
    var lessons = C.LESSONS, rows = (d.staff || []).map(function (p) {
      var t = (d.training || {})[p.id] || {}, cur = lessons.filter(function (l) { var a = V.daysBetween(t[l.id], today); return a !== null && a >= 0 && a <= 365; }).length;
      return { person: p, current: cur, total: lessons.length, full: cur === lessons.length };
    });
    var full = rows.filter(function (r) { return r.full; }).length;
    return { rows: rows, full: full, pct: rows.length ? Math.round(100 * full / rows.length) : 0 };
  }

  /* ---- phone tree: each person is called by the lead or by another person; cycles and missing callers are reported ---- */
  function phoneTree(staff) {
    var byId = {}, kids = {}, placed = {}, cycles = [], roots = [];
    (staff || []).forEach(function (p) { byId[p.id] = p; });
    (staff || []).forEach(function (p) {
      var up = p.calledBy && p.calledBy !== "lead" && byId[p.calledBy] && p.calledBy !== p.id ? p.calledBy : "lead";
      (kids[up] = kids[up] || []).push(p);
    });
    // Everyone has exactly one caller, so the only way to meet a placed person again is a caller loop.
    function grow(p) {
      placed[p.id] = 1;
      return { person: p, children: (kids[p.id] || []).filter(function (c) { return !placed[c.id]; }).map(grow) };
    }
    (kids.lead || []).forEach(function (p) { roots.push(grow(p)); });
    // People caught in a loop (A calls B, B calls A) never reach the lead: attach them at the top and report them.
    (staff || []).forEach(function (p) { if (!placed[p.id]) { cycles.push(p.name); roots.push(grow(p)); } });
    return { roots: roots, problems: cycles };
  }
  function treeLines(nodes, depth, out) {
    (nodes || []).forEach(function (n) {
      var p = n.person; out.push(new Array(depth + 1).join("    ") + "- " + p.name + (p.role ? ", " + p.role : "") + ": " + (p.phone || "no number") + (p.alt ? ", alt " + p.alt : ""));
      treeLines(n.children, depth + 1, out);
    });
    return out;
  }

  /* ---- recovery runbook model, shared by the on-screen preview, the printout and the text file ---- */
  function runbook(d, today) {
    var rb = d.runbook || {}, org = d.org || {}, chosen = C.SCENARIOS.filter(function (s) { return (rb.scenarios || []).indexOf(s.id) !== -1; }), tree = phoneTree(d.staff);
    var services = (d.services || []).slice().sort(function (a, b) { return (+a.order || 99) - (+b.order || 99); });
    var drills = drillStatus(d, today);
    return {
      title: "Recovery runbook: " + (org.name || "Organisation"), generated: today, notice: NOT_ADVICE, example: !!d.example,
      lead: org.lead || "Not named yet", deputy: org.deputy || "Not named yet", paperCopy: rb.paperCopy || "", meeting: rb.meeting || "", altChannel: rb.altChannel || "",
      tree: tree, contacts: (d.contacts || []).slice(), services: services,
      backups: drills.map(function (x) { return { name: x.backup.name, where: x.backup.where || "", offline: x.backup.offline === "yes", state: DRILL_TEXT[x.state], lastOk: x.lastOk ? x.lastOk.date : "" }; }),
      accounts: (d.accounts || []).map(function (a) { return { name: a.name, owner: a.owner || "" }; }),
      scenarios: chosen, signs: ["Files that will not open or have strange new names", "A ransom note or a scary pop-up", "Money missing or payment details changed", "Messages sent from your account that you did not write", "Locked accounts or password resets you did not ask for", "A lost or stolen device"]
    };
  }
  function runbookText(m) {
    var L = [], line = function (s) { L.push(s == null ? "" : s); }, sec = function (s) { line(""); line(s.toUpperCase()); line(new Array(Math.min(s.length, 60) + 1).join("=")); };
    line(m.title); line("Generated " + m.generated + " with Stark Baseline. " + m.notice); line("Printed copies are not encrypted: keep them somewhere safe.");
    if (m.example) line("EXAMPLE DATA: a made-up organisation for illustration.");
    sec("Who leads");
    line("Incident lead: " + m.lead); line("Deputy: " + m.deputy);
    if (m.paperCopy) line("Paper copy kept: " + m.paperCopy);
    if (m.meeting) line("Meeting point: " + m.meeting);
    if (m.altChannel) line("If email is down, use: " + m.altChannel);
    sec("Signs that something is wrong (tell the incident lead at once)");
    m.signs.forEach(function (s) { line("- " + s); });
    sec("Phone tree (each person calls the people listed under them)");
    line("Incident lead: " + m.lead); treeLines(m.tree.roots, 0, L);
    if (!m.tree.roots.length) line("- No people added yet.");
    if (m.tree.problems.length) line("Check the tree: " + m.tree.problems.join(", ") + " (caller loop).");
    sec("Outside contacts");
    if (!m.contacts.length) line("- None added yet.");
    m.contacts.forEach(function (c) { line("- " + c.org + " (" + (c.kind || "contact") + "): " + (c.phone || "no number") + (c.ref ? ", ref " + c.ref : "") + (c.notes ? ". " + c.notes : "")); });
    sec("What to restore first");
    if (!m.services.length) line("- No critical services listed yet.");
    m.services.forEach(function (s, i) { line((i + 1) + ". " + s.name + (s.maxHours ? " (manage without it for up to " + s.maxHours + " h)" : "") + (s.owner ? ", owner " + s.owner : "")); if (s.fallback) line("   Paper fallback: " + s.fallback); });
    sec("Backups");
    if (!m.backups.length) line("- No backups listed yet.");
    m.backups.forEach(function (b) { line("- " + b.name + (b.where ? " (" + b.where + (b.offline ? ", offline copy" : "") + ")" : "") + ": " + b.state + (b.lastOk ? ", last good restore " + b.lastOk : "")); });
    sec("Accounts and who administers them");
    if (!m.accounts.length) line("- No accounts listed yet.");
    m.accounts.forEach(function (a) { line("- " + a.name + (a.owner ? ": " + a.owner : "")); });
    m.scenarios.forEach(function (s) {
      sec("Scenario: " + s.title);
      line("First 15 minutes:"); s.first.forEach(function (x) { line("  [ ] " + x); });
      line("First day:"); s.day.forEach(function (x) { line("  [ ] " + x); });
      line("Getting back to normal:"); s.recover.forEach(function (x) { line("  [ ] " + x); });
    });
    line(""); line("Stark Baseline helps you organise and track your security work. " + m.notice);
    return L.join("\r\n") + "\r\n";
  }

  /* ---- attention list for Home: the gaps your own records show ---- */
  function insights(d, today) {
    var out = [], n, push = function (level, text, route) { out.push({ level: level, text: text, route: route }); };
    drillStatus(d, today).forEach(function (x) {
      if (x.state === "never") push("high", "Backup '" + x.backup.name + "' has never had a restore test.", "drills");
      else if (x.state === "failed") push("high", "The last restore test of '" + x.backup.name + "' did not fully work.", "drills");
      else if (x.state === "overdue") push("high", "Restore test overdue for '" + x.backup.name + "' (last good test " + x.lastOk.date + ").", "drills");
      else if (x.state === "soon") push("med", "Restore test due soon for '" + x.backup.name + "' (by " + x.due + ").", "drills");
    });
    n = (d.accounts || []).filter(function (a) { return a.mfa === "none"; }).length;
    if (n) push("high", n + (n === 1 ? " account has" : " accounts have") + " no multifactor sign-in.", "inventory");
    n = (d.accounts || []).filter(function (a) { return a.mfa === "sms"; }).length;
    if (n) push("med", n + (n === 1 ? " account uses" : " accounts use") + " text-message codes. Move to an app or security key when you can.", "inventory");
    n = (d.accounts || []).filter(function (a) { return a.shared === "yes"; }).length;
    if (n) push("med", n + (n === 1 ? " shared login" : " shared logins") + " to replace with named accounts.", "inventory");
    n = (d.devices || []).filter(function (x) { return x.sensitive === "yes" && x.encrypted !== "yes"; }).length;
    if (n) push("high", n + (n === 1 ? " device holds" : " devices hold") + " sensitive data without recorded encryption.", "inventory");
    n = (d.devices || []).filter(function (x) { return unsupported(x.os); }).length;
    if (n) push("high", n + (n === 1 ? " device runs" : " devices run") + " an operating system that may be out of support.", "inventory");
    if ((d.backups || []).length && !(d.backups || []).some(function (b) { return b.offline === "yes"; })) push("high", "No backup is marked as offline or unchangeable.", "inventory");
    if (!(d.backups || []).length) push("high", "No backups recorded yet.", "inventory");
    if (!(d.org || {}).lead) push("med", "No security lead named yet.", "settings");
    var tr = trainingStatus(d, today);
    if (tr.rows.length && tr.full < tr.rows.length) push("med", (tr.rows.length - tr.full) + " of " + tr.rows.length + " staff need lessons this year.", "staff");
    rankedRisks(d.risks).filter(function (r) { return r.status !== "closed" && riskLevel(r.likelihood, r.impact).label === "High"; }).forEach(function (r) { push("high", "High risk: " + r.threat + (r.action ? " (next: " + r.action + ")" : "") + ".", "risks"); });
    (d.risks || []).forEach(function (r) { if (r.status !== "closed" && r.due && V.daysBetween(r.due, today) > 0) push("med", "Risk action overdue: " + (r.action || r.threat) + ".", "risks"); });
    (d.incidents || []).forEach(function (x) { if (x.status !== "closed") push("high", "Open incident: " + x.title + ". Keep the log up to date.", "runbook"); });
    evidenceStatus(d, today).forEach(function (x) {
      if (x.state === "overdue") push("med", "Evidence needs a fresh copy: " + x.e.title + " (due " + x.due + ").", "evidence");
      else if (x.state === "soon") push("info", "Evidence due for a fresh copy by " + x.due + ": " + x.e.title + ".", "evidence");
    });
    // One line per kind of vendor gap, naming the vendors, so a long supplier list cannot crowd out everything else.
    var vg = {}, VLABEL = { past: "Contract renewal date passed", soon: "Contract renews within 60 days", notice: "No breach-notice timeframe", review: "Vendor not reviewed in the last year" };
    (d.vendors || []).forEach(function (v) {
      vendorFlags(v, today, (d.org || {}).preset === "covenant").forEach(function (f) { (vg[f[2]] = vg[f[2]] || { f: f, names: [] }).names.push(v.name); });
    });
    ["agr", "past", "soon", "notice", "review"].forEach(function (k) { if (vg[k]) push(vg[k].f[1] === "bad" ? "high" : "med", (VLABEL[k] || vg[k].f[0]) + ": " + vg[k].names.join(", ") + ".", "inventory"); });
    var order = { high: 0, med: 1, info: 2 };
    return out.sort(function (a, b) { return order[a.level] - order[b.level]; });
  }
  // A plain heuristic, shown as "may be": names of systems whose mainstream support had ended when this was written.
  function unsupported(os) { return /\b(windows\s*(xp|vista|7|8(\.1)?|10)|server\s*(2008|2012)|macos\s*(1[0-3]|10\.\d+))\b/i.test(String(os || "")) && !/windows\s*10\s*esu/i.test(String(os || "")); }

  /* ---- what the records say for a checklist item (shown as "From your records") ---- */
  function hint(key, d, today) {
    var n, m;
    switch (key) {
      case "lead": return d.org.lead ? "Lead: " + d.org.lead + (d.org.deputy ? "; deputy: " + d.org.deputy : "; no deputy yet") : "No lead named yet (Settings).";
      case "risks": n = (d.risks || []).length; return n ? n + " risks listed." : "No risks listed yet.";
      case "vendors": n = (d.vendors || []).length; m = (d.vendors || []).filter(function (v) { return v.agreement === "signed"; }).length;
        return n ? n + " vendors listed, " + m + " with a signed agreement, " + (d.vendors || []).filter(function (v) { return v.notice; }).length + " with a breach-notice timeframe." : "No vendors listed yet (Inventory, Vendors).";
      case "devices": n = (d.devices || []).length; return n ? n + " devices listed." : "No devices listed yet.";
      case "accounts": n = (d.accounts || []).length; return n ? n + " accounts listed." : "No accounts listed yet.";
      case "datasets": n = (d.datasets || []).length; return n ? n + " kinds of sensitive data mapped." : "No data mapped yet.";
      case "updates": n = (d.devices || []).filter(function (x) { return x.autoUpdate === "no"; }).length; return n ? n + " devices without automatic updates." : "No devices marked as lacking automatic updates.";
      case "followups": n = (d.drills || []).filter(function (x) { return x.followup; }).length; return n + " follow-ups recorded in the drill log.";
      case "shared": n = (d.accounts || []).filter(function (a) { return a.shared === "yes"; }).length; return n ? n + " shared logins recorded." : "No shared logins recorded.";
      case "mfa": n = (d.accounts || []).length; m = (d.accounts || []).filter(function (a) { return a.mfa === "strong" || a.mfa === "app"; }).length; return n ? m + " of " + n + " accounts use an app, passkey or security key." : "No accounts listed yet.";
      case "training": n = trainingStatus(d, today); return n.rows.length ? n.full + " of " + n.rows.length + " staff completed every lesson in the last 12 months." : "No staff added yet.";
      case "encryption": n = (d.devices || []).length; m = (d.devices || []).filter(function (x) { return x.encrypted === "yes"; }).length; return n ? m + " of " + n + " devices recorded as encrypted." : "No devices listed yet.";
      case "unsupported": n = (d.devices || []).filter(function (x) { return unsupported(x.os); }).length; return n ? n + " devices may be out of support." : "No devices flagged as out of support.";
      case "backups": n = (d.backups || []).length; m = (d.backups || []).filter(function (b) { return b.offline === "yes"; }).length; return n ? n + " backups, " + m + " offline." : "No backups listed yet.";
      case "runbook": n = (d.drills || []).filter(function (x) { return x.type !== "restore" && V.daysBetween(x.date, today) <= 365; }).length; return (d.staff || []).length ? n + " tabletop or phone-tree drills in the last 12 months." : "Add staff and contacts on the Runbook page.";
      case "tree": n = phoneTree(d.staff); return (d.staff || []).length ? (d.staff || []).length + " people in the phone tree" + (n.problems.length ? "; check: " + n.problems.join(", ") : "") + "." : "No phone tree yet.";
      case "drills": n = drillStatus(d, today); m = n.filter(function (x) { return x.state === "ok" || x.state === "soon"; }).length; return n.length ? m + " of " + n.length + " backups had a good restore test in the last " + (n[0].every) + " days." : "No backups listed yet.";
      case "services": n = (d.services || []).length; return n ? n + " critical services ranked." : "No critical services listed yet.";
      case "fallback": n = (d.services || []).filter(function (s) { return s.fallback; }).length; return n + " services have a paper fallback written down.";
      default: return "";
    }
  }

  /* ---- Covenant preset: evidence and records under each HIPAA risk-analysis element ---- */
  function hipaaSummary(d, today) {
    var risks = d.risks || [], rated = risks.filter(function (r) { return riskLevel(r.likelihood, r.impact).score > 0; }), sc = scores(d.checks), rv = (d.hipaa || {})._review || {};
    var auto = {
      "h-scope": (d.devices || []).filter(function (x) { return x.sensitive === "yes"; }).length + " of " + (d.devices || []).length + " devices marked as holding ePHI; " + (d.accounts || []).length + " accounts and services listed; " + (d.vendors || []).filter(function (v) { return v.data === "yes"; }).length + " vendors handle ePHI, " +
        (d.vendors || []).filter(function (v) { return v.data === "yes" && (v.agreement === "signed" || v.agreement === "na"); }).length + " with a signed business associate agreement or none needed.",
      "h-data": (d.datasets || []).length + " data locations mapped.",
      "h-threats": risks.length + " threats listed" + (risks.filter(function (r) { return r.weakness; }).length < risks.length ? "; some have no weakness written down." : "."),
      "h-measures": "Checklist " + sc.overall.pct + "% (" + sc.overall.done + " done, " + sc.overall.doing + " in progress).",
      "h-likelihood": risks.filter(function (r) { return +r.likelihood; }).length + " of " + risks.length + " risks have a likelihood rating.",
      "h-impact": risks.filter(function (r) { return +r.impact; }).length + " of " + risks.length + " risks have an impact rating.",
      "h-level": rated.length + " risks ranked; " + rated.filter(function (r) { return riskLevel(r.likelihood, r.impact).label === "High"; }).length + " high.",
      "h-docs": (d.evidence || []).length + " evidence items in the folder.",
      "h-review": rv.last ? "Last review " + rv.last + (rv.next ? ", next " + rv.next + (V.daysBetween(rv.next, today) > 0 ? " (overdue)" : "") : "") + "." : "No review date recorded yet.",
      "h-manage": risks.filter(function (r) { return r.action && r.owner && r.due; }).length + " of " + risks.length + " risks have an action, owner and due date."
    };
    return C.HIPAA.map(function (el) {
      var st = ((d.hipaa || {})[el.id] || {}).status || "todo";
      return { el: el, status: st, note: ((d.hipaa || {})[el.id] || {}).note || "", auto: auto[el.id], evidence: (d.evidence || []).filter(function (e) { return (e.hipaa || []).indexOf(el.id) !== -1; }) };
    });
  }

  /* ---- inventory CSV export and import (contractors move client lists in and out). Notes that look like secrets are refused. ---- */
  var CSV_COLS = {
    devices: [["name", "Name"], ["type", "Type"], ["user", "Used by"], ["os", "Operating system"], ["encrypted", "Disk encrypted", "yn"], ["autoUpdate", "Automatic updates", "yn"],
      ["sensitive", "Holds sensitive data", "yn"], ["checked", "Last checked", "date"], ["notes", "Notes"]],
    accounts: [["name", "Service or account"], ["purpose", "Used for"], ["owner", "Admin owner"], ["mfa", "Multifactor sign-in", "mfa"], ["shared", "Shared login", "yn"], ["notes", "Notes"]],
    backups: [["name", "Backup name"], ["what", "What it covers"], ["where", "Where it is kept"], ["frequency", "How often"], ["offline", "Offline copy", "yn"],
      ["retention", "Keeps old versions for"], ["owner", "Who looks after it"], ["notes", "Notes"]],
    datasets: [["name", "Kind of data"], ["kind", "Category"], ["where", "Where it is stored"], ["access", "Who can see it"], ["shared", "How it is shared or sent"], ["notes", "Notes"]],
    vendors: [["name", "Vendor"], ["service", "What they provide"], ["data", "Handles sensitive data", "yn"], ["access", "Can reach your systems", "yn"], ["agreement", "Agreement", "agr"],
      ["notice", "Breach notice within (days)"], ["renew", "Contract renews", "date"], ["reviewed", "Last reviewed", "date"], ["contact", "Contact"], ["notes", "Notes"]]
  };
  function optList(t) { return t === "yn" ? C.YESNO : t === "mfa" ? C.MFA : t === "agr" ? C.AGREEMENT : null; }
  var CSV_MAX_ROWS = 2000, CSV_MAX_CELL = 2000;
  function csvCell(v) {
    var t = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // stops spreadsheets running a cell as a formula
    return /[",;\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  function optLabel(list, v) { var o = list.filter(function (x) { return x.v === v; })[0]; return o ? (o.v ? o.l : "") : v || ""; }
  function inventoryCsv(d, kind) {
    var cols = CSV_COLS[kind];
    var lines = [cols.map(function (c) { return csvCell(c[1]); }).join(",")].concat((d[kind] || []).map(function (x) {
      return cols.map(function (c) { var v = x[c[0]], ol = optList(c[2]); return csvCell(ol ? optLabel(ol, v) : v); }).join(",");
    }));
    return "\ufeff" + lines.join("\r\n") + "\r\n";
  }
  function parseCsv(text) {
    var t = String(text || "").replace(/^\ufeff/, ""), first = t.split(/\r?\n/)[0], rows = [], row = [], cell = "", q = false, i, ch;
    var sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
    for (i = 0; i < t.length; i++) {
      ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"' && cell === "") q = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ""; }); });
  }
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function pickOpt(list, raw) {
    var n = norm(raw); if (!n || n === "notrecorded") return "";
    var o = list.filter(function (x) { return x.v && (norm(x.v) === n || norm(x.l) === n); })[0];
    if (o) return o.v;
    if (list === C.YESNO) return /^(y|true|1)$/.test(n) ? "yes" : /^(n|false|0)$/.test(n) ? "no" : null;
    if (list === C.AGREEMENT) return /^(yes|y|baa|dpa)$|signed/.test(n) ? "signed" : /pending|requested|sent/.test(n) ? "pending" : /^(no|none)$/.test(n) ? "none" : /^(na|notneeded|notrequired)$/.test(n) ? "na" : null;
    return /passkey|securitykey|fido/.test(n) ? "strong" : /app|push|totp/.test(n) ? "app" : /sms|text|call/.test(n) ? "sms" : /^(none|no)$/.test(n) ? "none" : null;
  }
  function importCsv(text, kind, existing) {
    var cols = CSV_COLS[kind], rows, out = { rows: [], skipped: [] }, seen = {};
    if (!cols) throw new Error("Unknown inventory list.");
    rows = parseCsv(text);
    if (!rows.length) throw new Error("The file is empty.");
    var head = rows[0].map(norm), map = cols.map(function (c) { var i = head.indexOf(norm(c[1])); return i === -1 ? head.indexOf(norm(c[0])) : i; });
    if (map[0] === -1) throw new Error('The first row must hold column names, including "' + cols[0][1] + '". Export the list first to get a template.');
    if (rows.length - 1 > CSV_MAX_ROWS) throw new Error("The file has more than " + CSV_MAX_ROWS + " rows. Split it into smaller files.");
    (existing || []).forEach(function (x) { seen[norm(x.name)] = 1; });
    rows.slice(1).forEach(function (r, n) {
      var x = { id: V.uid() }, bad = null;
      cols.forEach(function (c, ci) {
        if (bad || map[ci] === -1) return;
        var raw = String(r[map[ci]] == null ? "" : r[map[ci]]).trim().replace(/^'(?=[=+\-@])/, ""), sens = V.looksSensitive(raw), v;
        if (raw.length > CSV_MAX_CELL) { bad = c[1] + " is too long"; return; }
        if (sens.length) { bad = c[1] + " holds " + sens[0] + "; remove it and import again"; return; }
        v = optList(c[2]) ? pickOpt(optList(c[2]), raw) : c[2] === "date" ? (raw && isNaN(V.dayNum(raw)) ? null : raw) : raw;
        if (v === null) { bad = c[1] + ' has an unrecognised value "' + raw.slice(0, 40) + '"'; return; }
        if (v !== "") x[c[0]] = v;
      });
      if (!bad && !x.name) bad = cols[0][1] + " is empty";
      if (!bad && seen[norm(x.name)]) bad = '"' + x.name.slice(0, 60) + '" is already listed';
      if (bad) { out.skipped.push({ line: n + 2, reason: bad, dup: / is already listed$/.test(bad) }); return; }
      seen[norm(x.name)] = 1; out.rows.push(x);
    });
    out.skipped.sort(function (a, b) { return (a.dup ? 1 : 0) - (b.dup ? 1 : 0) || a.line - b.line; }); // problems to fix first, plain duplicates last
    return out;
  }

  /* ---- evidence re-collection: a fresh copy is due on the date set, or the evidence date plus the chosen interval ---- */
  function evidenceDue(e) { return e.due || (e.every && !isNaN(V.dayNum(e.date)) ? V.addDays(e.date, +e.every) : ""); }
  function evidenceStatus(d, today) {
    return (d.evidence || []).map(function (e) {
      var due = evidenceDue(e), left = due ? V.daysBetween(today, due) : null;
      return { e: e, due: due, left: left, state: left === null ? "none" : left < 0 ? "overdue" : left <= 30 ? "soon" : "ok" };
    }).filter(function (x) { return x.state !== "none"; }).sort(function (a, b) { return a.left - b.left; });
  }
  /* ---- vendors and agreements ---- */
  function vendorFlags(v, today, covenant) {
    var f = [], left = v.renew ? V.daysBetween(today, v.renew) : null, age = v.reviewed ? V.daysBetween(v.reviewed, today) : null;
    if (v.data === "yes" && v.agreement !== "signed" && v.agreement !== "na") f.push([covenant ? "No signed business associate agreement" : "No signed data-protection agreement", "bad", "agr"]);
    if (v.data === "yes" && !v.notice) f.push(["No breach-notice timeframe", "warn", "notice"]);
    if (left !== null && left < 0) f.push(["Renewal date passed", "bad", "past"]); else if (left !== null && left <= 60) f.push(["Renews in " + left + " days", "warn", "soon"]);
    if (v.data === "yes" && (age === null || age > 365)) f.push(["Not reviewed in the last year", "warn", "review"]);
    return f;
  }
  /* ---- live incident log ---- */
  function incidentText(inc, org) {
    var lines = ["INCIDENT LOG: " + inc.title, (org && org.name ? org.name + ". " : "") + "Opened " + (inc.opened || "?") + (inc.closed ? ", closed " + inc.closed : ", still open") + ".",
      "Lead: " + (inc.lead || "not named") + ".", NOT_ADVICE, ""];
    (inc.entries || []).forEach(function (x) { lines.push(x.t + "  " + x.text + (x.by ? "  (" + x.by + ")" : "")); });
    if (inc.summary) lines.push("", "Summary: " + inc.summary);
    return lines.join("\r\n") + "\r\n";
  }

  function evidenceFor(d, checkId) { return (d.evidence || []).filter(function (e) { return (e.checks || []).indexOf(checkId) !== -1; }); }

/* full version only */
  var api = { NOT_ADVICE: NOT_ADVICE, scores: scores, statusOf: statusOf, riskLevel: riskLevel, rankedRisks: rankedRisks, drillStatus: drillStatus, DRILL_TEXT: DRILL_TEXT,
    trainingStatus: trainingStatus, phoneTree: phoneTree, treeLines: treeLines, runbook: runbook, runbookText: runbookText, insights: insights, unsupported: unsupported,
    hint: hint, hipaaSummary: hipaaSummary, evidenceFor: evidenceFor, CSV_COLS: CSV_COLS, inventoryCsv: inventoryCsv, parseCsv: parseCsv, importCsv: importCsv,
    evidenceDue: evidenceDue, evidenceStatus: evidenceStatus, vendorFlags: vendorFlags, incidentText: incidentText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BaselineLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
