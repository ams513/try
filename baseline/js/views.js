/* Stark Baseline: Inventory, Checklist, Risks, Evidence and Drills views. Built with textContent only. */
(function () {
  "use strict";
  var V = StarkBaseline, C = BaselineContent, L = BaselineLogic, U = BaselineUI, A = BaselineApp, h = U.h, S = A.S;
  function yn(v) { return v === "yes" ? "Yes" : v === "no" ? "No" : "Not recorded"; }
  function optL(list, v) { var o = list.filter(function (x) { return x.v === v; })[0]; return o ? o.l : v || ""; }
  function td(label, content, cls) { return h("td", { "data-l": label, class: cls || null }, content); }
  // Long lists render the first CAP rows (rows are built lazily) with a button for the rest, so a big inventory stays responsive.
  var CAP = 200;
  A.shown = A.shown || {};
  function table(cols, rows, key, make) {
    var n = rows.length, lim = key && !A.shown[key] && n > CAP ? CAP : n, body = make ? rows.slice(0, lim).map(make) : rows.slice(0, lim);
    var wrap = h("div", { class: "tbl" }, h("table", { class: "list stack" }, h("thead", null, h("tr", null, cols.map(function (c) { return h("th", { text: c }); }), h("th", null))), h("tbody", null, body)));
    if (lim < n) wrap.appendChild(h("div", { class: "row" }, h("span", { class: "fine", text: "Showing " + lim + " of " + n + "." }), A.btn("Show all " + n, "small", function () { A.shown[key] = true; A.render(); })));
    return wrap;
  }
  A.table = table;

  /* ---------- Inventory ---------- */
  var KINDS = [["devices", "Devices"], ["accounts", "Accounts and services"], ["backups", "Backups"], ["datasets", "Data"], ["vendors", "Vendors"]];
  function fields(kind) {
    var note = { k: "notes", label: "Notes", type: "textarea", warn: true, rows: 2, help: "Never type passwords, PINs, recovery codes or full account numbers." };
    if (kind === "devices") return [{ k: "name", label: "Name", req: true, ph: "Front desk PC" }, { k: "type", label: "Type", type: "select", options: C.DEVICE_TYPES }, { k: "user", label: "Used by" },
      { k: "os", label: "Operating system and version", ph: "Windows 11, macOS 15, iOS 18" }, { k: "encrypted", label: "Disk encrypted?", type: "select", options: C.YESNO },
      { k: "autoUpdate", label: "Automatic updates on?", type: "select", options: C.YESNO }, { k: "sensitive", label: A.sensLabel(), type: "select", options: C.YESNO }, { k: "checked", label: "Last checked", type: "date" }, note];
    if (kind === "accounts") return [{ k: "name", label: "Service or account", req: true, ph: "Clinic email (admin)" }, { k: "purpose", label: "Used for" }, { k: "owner", label: "Admin owner", ph: "Who can reset and manage it" },
      { k: "mfa", label: "Multifactor sign-in", type: "select", options: C.MFA }, { k: "shared", label: "Shared login?", type: "select", options: C.YESNO }, note];
    if (kind === "backups") return [{ k: "name", label: "Backup name", req: true, ph: "Shared drive to USB disk" }, { k: "what", label: "What it covers" }, { k: "where", label: "Where it is kept", type: "select", options: [""].concat(C.WHERE) },
      { k: "frequency", label: "How often", ph: "Daily, weekly" }, { k: "offline", label: "Offline or unchangeable copy?", type: "select", options: C.YESNO }, { k: "retention", label: "Keeps old versions for", ph: "30 days" }, { k: "owner", label: "Who looks after it" }, note];
    if (kind === "vendors") return [{ k: "name", label: "Vendor", req: true, ph: "Example Health Software" }, { k: "service", label: "What they provide", ph: "Practice system, IT support, shredding" },
      { k: "data", label: A.covenant() ? "Creates, receives, keeps or sends ePHI?" : "Handles your sensitive data?", type: "select", options: C.YESNO },
      { k: "access", label: "Can reach your systems or accounts?", type: "select", options: C.YESNO },
      { k: "agreement", label: A.covenant() ? "Business associate agreement" : "Data-protection agreement", type: "select", options: C.AGREEMENT },
      { k: "notice", label: "Breach notice promised within (days)", type: "number", min: 0, ph: "5" }, { k: "renew", label: "Contract renews or ends", type: "date" },
      { k: "reviewed", label: "Last reviewed", type: "date" }, { k: "contact", label: "Contact or customer number", ph: "Account number and support line" }, note];
    return [{ k: "name", label: "Kind of data", req: true, ph: A.covenant() ? "Patient charts" : "Student records" }, { k: "kind", label: "Category", ph: A.covenant() ? "ePHI" : "Personal, financial, health" },
      { k: "where", label: "Where it is stored", ph: "System, device or paper location" }, { k: "access", label: "Who can see it" }, { k: "shared", label: "How it is shared or sent" }, note];
  }
  function edit(kind, item) {
    if (!item && A.full(S.d[kind])) return;
    var list = S.d[kind], x = item || { id: V.uid() }, title = (item ? "Edit " : "Add ") + { devices: "device", accounts: "account or service", backups: "backup", datasets: "data location", vendors: "vendor" }[kind];
    U.openForm(title, fields(kind), x, function (o) { o.id = x.id; A.upsert(list, o); A.save(); A.render(); },
      kind === "accounts" ? h("p", { class: "fine", text: "Record who manages each account and how sign-in is protected. Keep the passwords themselves in a password manager." }) : null);
  }
  function flags(kind, x) {
    var f = [];
    if (kind === "devices") { if (x.sensitive === "yes" && x.encrypted !== "yes") f.push(["Not recorded as encrypted", "bad"]); if (L.unsupported(x.os)) f.push(["May be out of support", "bad"]); if (x.autoUpdate === "no") f.push(["No automatic updates", "warn"]); }
    if (kind === "accounts") { if (x.mfa === "none") f.push(["No multifactor", "bad"]); else if (x.mfa === "sms") f.push(["Text-message codes", "warn"]); else if (!x.mfa) f.push(["Sign-in not recorded", "warn"]); if (x.shared === "yes") f.push(["Shared login", "warn"]); }
    if (kind === "backups") { if (x.offline !== "yes") f.push(["No offline copy", "warn"]); var st = drillIdx[x.id]; if (st && st.state !== "ok") f.push([L.DRILL_TEXT[st.state], st.state === "soon" ? "warn" : "bad"]); }
    if (kind === "vendors") f = f.concat(L.vendorFlags(x, A.today(), A.covenant()));
    return f.map(function (y) { return A.badge(y[0], y[1]); });
  }
  var drillIdx = {};
  function rowsFor(kind) {
    drillIdx = {};
    if (kind === "backups") L.drillStatus(S.d, A.today()).forEach(function (s) { drillIdx[s.backup.id] = s; });   // once per render, not once per row
    return function (x) {
      var cells = kind === "devices" ? [td("Device", h("b", { text: x.name })), td("Type", x.type || ""), td("Used by", x.user || ""), td("System", x.os || ""), td("Encrypted", yn(x.encrypted))]
        : kind === "accounts" ? [td("Service", h("b", { text: x.name })), td("Used for", x.purpose || ""), td("Admin", x.owner || ""), td("Sign-in", optL(C.MFA, x.mfa) || "Not recorded")]
        : kind === "backups" ? [td("Backup", h("b", { text: x.name })), td("Covers", x.what || ""), td("Kept", x.where || ""), td("How often", x.frequency || ""), td("Offline", yn(x.offline))]
        : kind === "vendors" ? [td("Vendor", h("b", { text: x.name })), td("Provides", x.service || ""), td("Agreement", optL(C.AGREEMENT, x.agreement) || "Not recorded"), td("Notice", x.notice ? x.notice + " days" : ""), td("Renews", x.renew || "")]
        : [td("Data", h("b", { text: x.name })), td("Category", x.kind || ""), td("Stored", x.where || ""), td("Access", x.access || "")];
      return h("tr", null, cells, td("Flags", h("div", { class: "row tight" }, flags(kind, x))), td("", A.rowActions(x, S.d[kind], function (i) { edit(kind, i); }, "this entry"), "act"));
    };
  }
  function importInv(kind) {
    U.pickFile(".csv,text/csv", true).then(function (f) {
      var r, body;
      if (!f) return;
      if (f.text == null) return U.toast("That file is too large to import.", true);
      try { r = L.importCsv(f.text, kind, S.d[kind]); } catch (e) { return U.toast(e.message, true); }
      if (!r.rows.length) return U.toast("Nothing to import. " + (r.skipped.length ? "Row " + r.skipped[0].line + ": " + r.skipped[0].reason + "." : ""), true);
      body = r.rows.length + " new " + (r.rows.length === 1 ? "entry" : "entries") + " from " + f.name + ". Existing entries are not changed." +
        (r.skipped.length ? " Skipped " + r.skipped.length + ": " + r.skipped.filter(function (x) { return !x.dup; }).slice(0, 5).map(function (x) { return "row " + x.line + " (" + x.reason + ")"; })
          .concat(r.skipped.some(function (x) { return x.dup; }) ? [r.skipped.filter(function (x) { return x.dup; }).length + " already listed"] : []).join("; ") + "." : "");
      U.confirmBox("Import " + r.rows.length + (r.rows.length === 1 ? " entry?" : " entries?"), body, "Import", false).then(function (ok) {
        if (!ok) return;
        var rows = r.rows.slice(0, A.room()), cut = r.rows.length - rows.length;
        if (!rows.length) return A.full(S.d[kind]);
        rows.forEach(function (x) { S.d[kind].push(x); }); A.save(); A.render();
        U.toast("Imported " + rows.length + (cut ? " (" + cut + " left out: Free trial limit)" : "") + ". Delete the CSV file now: it is not encrypted.");
      });
    });
  }
  var COLS = { devices: ["Device", "Type", "Used by", "System", "Encrypted", "Flags"], accounts: ["Service", "Used for", "Admin", "Sign-in", "Flags"], backups: ["Backup", "Covers", "Kept", "How often", "Offline", "Flags"], datasets: ["Data", "Category", "Stored", "Access", "Flags"], vendors: ["Vendor", "Provides", "Agreement", "Notice", "Renews", "Flags"] };
  A.views.inventory = function () {
    var tab = A.inv || "devices", label = KINDS.filter(function (k) { return k[0] === tab; })[0][1];
    var wrap = h("div", null, A.section("Inventory", "Typed in by hand. Nothing is scanned, installed or monitored."),
      h("div", { class: "row", role: "tablist" }, KINDS.map(function (k) { return A.btn(k[1] + " (" + S.d[k[0]].length + ")", k[0] === tab ? "primary" : "", function () { A.inv = k[0]; A.render(); }); })));
    var card = h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: label }), h("div", { class: "row tight" },
      A.btn("Export CSV", "small", function () { U.downloadText("stark-baseline-" + tab + "-" + A.stamp() + ".csv", L.inventoryCsv(S.d, tab), "text/csv"); U.toast("CSV saved. It is not encrypted: keep it safe and delete it when done."); }),
      A.btn("Import CSV", "small", function () { importInv(tab); }), A.btn("Add", "primary", function () { edit(tab); }))));
    if (tab === "vendors") card.appendChild(h("p", { class: "fine", text: "Suppliers that hold your data or can reach your systems. Many incidents start at a supplier: record the agreement, how fast they promise to tell you about a breach, and when the contract renews." }));
    if (tab === "accounts") card.appendChild(h("p", { class: "fine", text: "Never store passwords here. Record who manages each account and how its sign-in is protected." }));
    card.appendChild(S.d[tab].length ? table(COLS[tab], S.d[tab], "inv-" + tab, rowsFor(tab)) : A.empty("Nothing listed yet.", A.btn("Add the first one", "primary", function () { edit(tab); })));
    wrap.appendChild(card);
    return wrap;
  };

  /* ---------- Checklist ---------- */
  function refTags(it) {
    return h("div", null, it.csf.map(function (c) { return h("span", { class: "tag", title: "NIST CSF 2.0 Category", text: "CSF " + c + " " + C.CSF[c] }); }),
      it.cpg.map(function (c) { return h("span", { class: "tag cpg", title: "CISA CPG 2.0 goal", text: "CPG " + c + " " + C.CPG[c] }); }),
      it.cpg.length ? null : h("span", { class: "fine", text: " No matching CPG goal; NIST CSF only." }));
  }
  function itemEl(it, onChange) {
    var c = S.d.checks[it.id] || {}, st = c.status || "todo", li = h("li", { class: st }), ev = L.evidenceFor(S.d, it.id), hint = L.hint(it.hint, S.d, A.today());
    var sel = h("select", { "aria-label": "Status of: " + it.title, onchange: function () {
      var cur = S.d.checks[it.id] || {}; cur.status = sel.value; cur.date = A.today(); S.d.checks[it.id] = cur; li.className = sel.value; A.save(); onChange();
    } }, C.STATUS.map(function (s) { return h("option", { value: s.v, text: s.l, selected: s.v === st }); }));
    var field = function (k, label, ph) {
      return h("div", { class: "field" }, h("label", { text: label, for: "ck-" + k + "-" + it.id }), h("input", { id: "ck-" + k + "-" + it.id, type: "text", maxlength: k === "note" ? 600 : 100, value: c[k] || "", placeholder: ph,
        onchange: function (e) { if (V.looksSensitive(e.target.value).length) { U.toast("Not saved: that looks like a password or full number.", true); e.target.value = (S.d.checks[it.id] || {})[k] || ""; return; } var cur = S.d.checks[it.id] || { status: "todo" }; cur[k] = e.target.value.trim(); S.d.checks[it.id] = cur; A.save(); } }));
    };
    li.appendChild(h("div", { class: "ck-top" }, h("h3", { text: it.title }), ev.length ? A.badge(ev.length + " evidence", "good") : null, sel));
    li.appendChild(h("details", null, h("summary", { text: "Why, how and sources" }),
      h("p", { class: "why", text: it.why }), h("ol", null, it.steps.map(function (s) { return h("li", { text: s }); })),
      hint ? h("p", { class: "from", text: "From your records: " + hint }) : null, refTags(it),
      h("div", { class: "grid2" }, field("owner", "Owner", "Who is doing this"), field("note", "Note", "What was done, where the proof is")),
      ev.length ? h("p", { class: "fine", text: "Evidence: " + ev.map(function (e) { return e.title; }).join("; ") }) : null,
      h("div", { class: "row end" }, A.btn("Attach evidence", "small", function () { A.editEvidence(null, { checks: [it.id] }); }))));
    return li;
  }
  A.views.checklist = function () {
    var d = S.d, fn = A.fn || "all", show = A.ckShow || "all", sc = L.scores(d.checks), wrap, overall = h("b", { class: "big-pct", text: sc.overall.pct + "%" });
    wrap = h("div", null, A.section("Checklist", "Plain-language steps mapped to NIST CSF 2.0 Functions and CISA's Cross-Sector Cybersecurity Performance Goals 2.0. Wording is ours; see Sources.",
      [A.btn("Print checklist", "", printChecklist)]));
    var bars = {};
    wrap.appendChild(h("div", { class: "card" }, h("div", { class: "row" }, overall, h("div", { class: "grow" }, h("b", { text: "Overall progress" }),
      h("p", { class: "fine", text: sc.overall.done + " done, " + sc.overall.doing + " in progress, " + sc.overall.na + " do not apply, of " + sc.overall.total + " items." }))),
      h("div", { class: "row" }, h("label", { for: "ck-fn", text: "Function" }), h("select", { id: "ck-fn", onchange: function (e) { A.fn = e.target.value; A.render(); } },
        [{ id: "all", name: "All six" }].concat(C.FUNCTIONS).map(function (f) { return h("option", { value: f.id, text: f.name, selected: f.id === fn }); })),
        h("label", { for: "ck-show", text: "Show" }), h("select", { id: "ck-show", onchange: function (e) { A.ckShow = e.target.value; A.render(); } },
          [["all", "Everything"], ["open", "Not done yet"], ["done", "Done"]].map(function (o) { return h("option", { value: o[0], text: o[1], selected: o[0] === show }); })))));
    function refresh() {
      var s2 = L.scores(S.d.checks); overall.textContent = s2.overall.pct + "%";
      Object.keys(bars).forEach(function (k) { bars[k].p.value = s2.fns[k].pct; bars[k].t.textContent = s2.fns[k].pct + "%"; });
    }
    C.FUNCTIONS.filter(function (f) { return fn === "all" || f.id === fn; }).forEach(function (f) {
      var items = C.CHECKLIST.filter(function (it) { var st = L.statusOf(d.checks, it.id); return it.fn === f.id && (show === "all" || (show === "done" ? st === "done" : st === "todo" || st === "doing")); });
      var p = h("progress", { max: 100, value: sc.fns[f.id].pct, "aria-label": f.name + " progress" }), t = h("span", { class: "pct", text: sc.fns[f.id].pct + "%" });
      bars[f.id] = { p: p, t: t };
      wrap.appendChild(h("div", { class: "card" }, h("div", { class: "fn-head" }, h("div", null, h("h2", { text: f.name + " (" + f.id + ")" }), h("p", { class: "fine", text: f.plain })), h("div", { class: "row grow" }, p, t)),
        items.length ? h("ul", { class: "ck" }, items.map(function (it) { return itemEl(it, refresh); })) : h("p", { class: "muted", text: "Nothing to show with this filter." })));
    });
    return wrap;
  };
  function printChecklist() {
    var d = S.d, sc = L.scores(d.checks);
    A.printNode(h("div", { class: "printdoc" }, A.printHead("Security checklist progress"),
      h("p", { text: "Overall " + sc.overall.pct + "%. " + C.FUNCTIONS.map(function (f) { return f.name + " " + sc.fns[f.id].pct + "%"; }).join(", ") + "." }),
      h("table", null, h("thead", null, h("tr", null, ["Function", "Item", "Status", "Owner", "Updated", "NIST CSF 2.0", "CISA CPG 2.0"].map(function (c) { return h("th", { text: c }); }))),
        h("tbody", null, C.CHECKLIST.map(function (it) { var c = d.checks[it.id] || {};
          return h("tr", null, h("td", { text: it.fn }), h("td", { text: it.title + (c.note ? " (" + c.note + ")" : "") }), h("td", { text: (C.STATUS.filter(function (s) { return s.v === (c.status || "todo"); })[0]).l }),
            h("td", { text: c.owner || "" }), h("td", { text: c.date || "" }), h("td", { text: it.csf.join(", ") }), h("td", { text: it.cpg.join(", ") }));
        })))));
  }

  /* ---------- Risks ---------- */
  function editRisk(r) {
    if (!r && A.full(S.d.risks)) return;
    var x = r || { id: V.uid(), status: "open" };
    U.openForm(r ? "Edit risk" : "Add risk", [{ k: "threat", label: "What could happen", req: true, ph: "Ransomware, lost laptop, email takeover" }, { k: "weakness", label: "Weakness it would use", ph: "No offline backup" },
      { k: "asset", label: "Systems or data affected" }, { k: "measures", label: "What protects you today" },
      { k: "likelihood", label: "Likelihood", type: "select", options: [{ v: "", l: "Not rated" }].concat(C.LEVELS) }, { k: "impact", label: "Impact", type: "select", options: [{ v: "", l: "Not rated" }].concat(C.LEVELS) },
      { k: "action", label: "Planned action", wide: true }, { k: "owner", label: "Owner" }, { k: "due", label: "Due date", type: "date" },
      { k: "status", label: "Status", type: "select", options: [{ v: "open", l: "Open" }, { v: "closed", l: "Closed" }] }], x,
    function (o) { o.id = x.id; A.upsert(S.d.risks, o); A.save(); A.render(); });
  }
  A.views.risks = function () {
    var list = L.rankedRisks(S.d.risks), t = A.today();
    var wrap = h("div", null, A.section("Risks", "What could hurt you most, ranked by likelihood times impact (low, medium, high).", [A.btn("Add risk", "primary", function () { editRisk(); })]));
    var card = h("div", { class: "card" });
    card.appendChild(list.length ? table(["Risk", "Level", "Planned action", "Owner", "Due", "Status"], list, "risks", function (r) {
      var lv = L.riskLevel(r.likelihood, r.impact), late = r.status !== "closed" && r.due && V.daysBetween(r.due, t) > 0;
      return h("tr", null, td("Risk", [h("b", { text: r.threat }), r.weakness ? h("div", { class: "fine", text: "Weakness: " + r.weakness }) : null]), td("Level", A.badge(lv.label, lv.cls)), td("Planned action", r.action || ""),
        td("Owner", r.owner || ""), td("Due", [r.due || "", late ? A.badge("Overdue", "bad") : null]), td("Status", r.status === "closed" ? "Closed" : "Open"), td("", A.rowActions(r, S.d.risks, editRisk, "this risk"), "act"));
    }) : A.empty("No risks listed yet. Start with the three things that would stop you serving people.", A.btn("Add risk", "primary", function () { editRisk(); })));
    wrap.appendChild(card);
    return wrap;
  };

  /* ---------- Evidence ---------- */
  function fileBox(state) {
    var status = h("span", { class: "fine", text: state.cur ? "Attached: " + state.cur.name + ". Choose a file to replace it." : "No file attached (optional)." });
    var inp = h("input", { id: "ev-file", type: "file", onchange: function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      status.textContent = "Reading " + f.name + "...";
      U.readEvidence(f).then(function (x) { state.next = x; status.textContent = "Ready: " + x.name + " (" + Math.ceil(x.size / 1024) + " KB). It is encrypted when you save. Fingerprint " + x.sha256.slice(0, 16) + "..."; },
        function (err) { inp.value = ""; state.next = null; status.textContent = err.message; });
    } });
    return h("div", { class: "field wide" }, h("label", { for: "ev-file", text: "File (up to 5 MB)" }), inp, status,
      h("span", { class: "fine", text: "The file is kept exactly as it is, encrypted, with a SHA-256 fingerprint that checks for accidental damage." }));
  }
  A.editEvidence = function (item, preset) {
    if (!item && A.full(S.d.evidence)) return;
    var x = item || Object.assign({ id: V.uid(), date: A.today(), checks: [], hipaa: [], file: null }, preset || {}), state = { cur: x.file, next: null };
    var flds = [{ k: "title", label: "Title", req: true, ph: "Signed security policy, MFA screenshot" }, { k: "kind", label: "Kind", type: "select", options: C.EVIDENCE_KINDS }, { k: "date", label: "Date", type: "date" },
      { k: "checks", label: "Checklist items it supports", type: "multi", summary: "Choose items (" + (x.checks || []).length + " chosen)", open: !!(preset && preset.checks),
        options: C.CHECKLIST.map(function (it) { return { v: it.id, l: it.fn + ": " + it.title }; }) }];
    flds.push({ k: "every", label: "Collect a fresh copy", type: "select", options: C.EVERY }, { k: "due", label: "Fresh copy due by (optional)", type: "date" });
    if (A.covenant()) flds.push({ k: "hipaa", label: "HIPAA risk-analysis elements", type: "multi", summary: "Choose elements", open: !!(preset && preset.hipaa), options: C.HIPAA.map(function (e) { return { v: e.id, l: e.title }; }) });
    flds.push({ k: "notes", label: "Notes", type: "textarea", warn: true, rows: 2, ph: "Where the paper original is kept, who approved it" });
    U.openForm(item ? "Edit evidence" : "Add evidence", flds, x, function (o) {
      var rec = { id: x.id, title: o.title, kind: o.kind, date: o.date, checks: o.checks, hipaa: o.hipaa || x.hipaa || [], notes: o.notes, every: o.every, due: o.due, file: state.cur || null };
      var put = state.next ? A.afterRekey().then(function () { return V.sealFile(S.session, x.id, state.next); }).then(function (env) { return U.filePut(S.ws, S.d.fileGen, x.id, env); })
        .then(function () { rec.file = { name: state.next.name, mime: state.next.mime, size: state.next.size, sha256: state.next.sha256 }; }) : Promise.resolve();
      return put.then(function () { A.upsert(S.d.evidence, rec); return A.flush(); }).then(function () { A.render(); U.toast(state.next ? "Evidence saved and encrypted." : "Evidence saved."); });
    }, fileBox(state));
  };
  function viewFile(e) {
    U.fileGet(S.ws, S.d.fileGen, e.id).then(function (env) {
      if (!env) throw new Error("The file is missing from this computer. Restore it from a backup file.");
      return V.openFile(S.session, env, e.id);
    }).then(function (f) {
      var body = h("div", { class: "dlg-body viewer" }, h("p", { class: "fine", text: "Fingerprint verified: " + f.sha256 }));
      if (/^image\/(png|jpeg|gif|webp)$/.test(f.mime)) body.appendChild(h("img", { src: "data:" + f.mime + ";base64," + f.data, alt: e.title }));
      else if (/\.(txt|csv|md|log|json)$/i.test(f.name)) body.appendChild(h("pre", { text: new TextDecoder().decode(V.unb64(f.data)).slice(0, 200000) }));
      else body.appendChild(h("p", { text: "This kind of file cannot be shown inside the app. Save a copy to open it, then delete the copy, because it is not encrypted." }));
      body.appendChild(h("div", { class: "row end" }, A.btn("Save a copy (not encrypted)", "", function () { U.download(f.name, new Blob([V.unb64(f.data)], { type: f.mime })); })));
      U.modal(e.title, body, { wide: true });
    }).catch(function (x) { U.toast(x.message, true); });
  }
  A.views.evidence = function () {
    var list = S.d.evidence.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    var wrap = h("div", null, A.section("Evidence folder", "Policies, screenshots, letters and reports that show the work is done. Files are encrypted one by one.", [A.btn("Add evidence", "primary", function () { A.editEvidence(); })]));
    if (!list.length) { wrap.appendChild(A.empty("No evidence yet. Good first items: your signed policy, a screenshot of multifactor sign-in turned on, and your last restore test.", A.btn("Add evidence", "primary", function () { A.editEvidence(); }))); return wrap; }
    var es = L.evidenceStatus(S.d, A.today()), byE = {};
    es.forEach(function (x) { byE[x.e.id] = x; });
    var due = es.filter(function (x) { return x.state !== "ok"; });
    if (due.length) wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Due for a fresh copy" }), h("ul", null, due.map(function (x) {
      return h("li", null, A.badge(x.state === "overdue" ? "Overdue" : "Due soon", x.state === "overdue" ? "bad" : "warn"), " ", h("b", { text: x.e.title }), " by " + x.due + " ", A.btn("Add the fresh copy", "small", function () { A.editEvidence(x.e); }));
    }))));
    var evAll = list.length, evLim = !A.shown.evidence && evAll > CAP ? CAP : evAll;
    wrap.appendChild(h("div", { class: "cards" }, list.slice(0, evLim).map(function (e) {
      var items = (e.checks || []).map(function (id) { var it = C.CHECKLIST.filter(function (c) { return c.id === id; })[0]; return it ? h("span", { class: "tag", text: it.fn + ": " + it.title }) : null; });
      var hip = A.covenant() ? (e.hipaa || []).map(function (id) { var el = C.HIPAA.filter(function (x) { return x.id === id; })[0]; return el ? h("span", { class: "tag cpg", text: "HIPAA: " + el.title }) : null; }) : [];
      return h("article", { class: "card item " + (e.file ? "good" : "") }, h("div", { class: "item-top" }, h("h3", { text: e.title }), A.badge(e.date || "no date")),
        h("p", { class: "fine", text: e.kind || "" }), byE[e.id] ? h("p", { class: "fine" }, A.badge(byE[e.id].state === "overdue" ? "Fresh copy overdue" : byE[e.id].state === "soon" ? "Fresh copy due soon" : "Fresh copy by " + byE[e.id].due, byE[e.id].state === "overdue" ? "bad" : byE[e.id].state === "soon" ? "warn" : ""),
          byE[e.id].state === "ok" ? null : " " + byE[e.id].due) : null, h("div", null, items, hip), e.notes ? h("p", { class: "fine", text: e.notes }) : null,
        e.file ? h("p", { class: "fp", text: e.file.name + " · " + Math.ceil(e.file.size / 1024) + " KB · SHA-256 " + e.file.sha256.slice(0, 24) + "..." }) : h("p", { class: "fine", text: "No file attached." }),
        h("div", { class: "row tight" }, e.file ? A.btn("View", "small primary", function () { viewFile(e); }) : null, A.btn("Edit", "small", function () { A.editEvidence(e); }),
          A.btn("Delete", "small danger-o", function () { A.del(S.d.evidence, e, "this evidence", function () { A.afterRekey().then(function () { if (S.d) return U.fileDel(S.ws, S.d.fileGen, e.id); }); }); })));
    })));
    if (evLim < evAll) wrap.appendChild(h("div", { class: "row" }, h("span", { class: "fine", text: "Showing the newest " + evLim + " of " + evAll + "." }), A.btn("Show all " + evAll, "small", function () { A.shown.evidence = true; A.render(); })));
    return wrap;
  };

  /* ---------- Drills ---------- */
  function editDrill(r) {
    if (!r && A.full(S.d.drills)) return;
    var x = r || { id: V.uid(), type: "restore", date: A.today(), result: "ok" };
    U.openForm(r ? "Edit drill" : "Log a drill", [{ k: "type", label: "Kind of drill", type: "select", options: C.DRILL_TYPES }, { k: "date", label: "Date", type: "date", req: true },
      { k: "backup", label: "Backup tested (for restore tests)", type: "select", options: [{ v: "", l: "Not a backup test" }].concat(S.d.backups.map(function (b) { return { v: b.id, l: b.name }; })) },
      { k: "what", label: "What was restored or practised", wide: true }, { k: "minutes", label: "Minutes it took", type: "number", min: 0 }, { k: "result", label: "Result", type: "select", options: C.RESULTS },
      { k: "by", label: "Done by" }, { k: "issues", label: "Problems found", type: "textarea", rows: 2 }, { k: "followup", label: "Follow-up actions", type: "textarea", rows: 2 }], x,
    function (o) {
      if (o.type === "restore" && !o.backup) throw new Error("Choose which backup was tested, or change the kind of drill.");
      o.id = x.id; if (o.type !== "restore") o.backup = ""; A.upsert(S.d.drills, o); A.save(); A.render();
    });
  }
  /* ---------- Tabletop exercise: a facilitator view with timed injects; the result goes to the drill log ---------- */
  function tabletop() {
    var sel = h("select", { id: "tt-sc" }, C.SCENARIOS.map(function (s) { return h("option", { value: s.id, text: s.title }); }));
    var dlg = U.modal("Run a tabletop exercise", h("div", { class: "dlg-body" },
      h("p", { text: "Gather the incident lead, the deputy and a few staff for 30 to 45 minutes. Read each event aloud, talk through the questions, and write down what was unclear. Nothing is touched on real systems." }),
      h("div", { class: "field wide" }, h("label", { for: "tt-sc", text: "Scenario" }), sel),
      h("div", { class: "row end" }, A.btn("Cancel", "", function () { dlg.close(); }), A.btn("Start", "primary", function () { var id = sel.value; dlg.close(); facilitate(id); }))));
  }
  function facilitate(id) {
    var sc = C.SCENARIOS.filter(function (s) { return s.id === id; })[0], inj = C.TABLETOP[id] || [], i = 0, notes = inj.map(function () { return ""; }), start = Date.now(), timer, dlg;
    var clock = h("span", { class: "chip", "aria-live": "off" }), body = h("div");
    function mmss(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    function tick() { clock.textContent = "Elapsed " + mmss(Date.now() - start); }
    function show() {
      var x = inj[i], ta = h("textarea", { id: "tt-note", rows: 3, maxlength: 2000, value: notes[i], oninput: function (e) { notes[i] = e.target.value; } });
      U.clear(body).appendChild(h("div", null,
        h("p", { class: "fine", text: "Event " + (i + 1) + " of " + inj.length + ", read at about minute " + x.at }), h("p", null, h("b", { text: x.text })),
        h("ul", null, x.ask.map(function (q) { return h("li", { text: q }); })),
        h("div", { class: "field wide" }, h("label", { for: "tt-note", text: "What was unclear or missing" }), ta),
        h("details", null, h("summary", { text: "What the runbook says for this scenario" }), h("ol", null, sc.first.concat(sc.day).map(function (s) { return h("li", { text: s }); }))),
        h("div", { class: "row end" }, i ? A.btn("Back", "", function () { i--; show(); }) : null,
          i < inj.length - 1 ? A.btn("Next event", "primary", function () { i++; show(); }) : A.btn("Finish and log", "primary", finish))));
    }
    function finish() {
      var mins = Math.max(1, Math.round((Date.now() - start) / 60000)), issues = notes.map(function (n, k) { return n.trim() ? "Event " + (k + 1) + ": " + n.trim() : ""; }).filter(Boolean).join("\n");
      dlg.close();
      editDrill({ id: V.uid(), type: "tabletop", date: A.today(), backup: "", what: "Tabletop: " + sc.title, minutes: String(mins), result: issues ? "partial" : "ok", issues: issues, followup: "", by: S.d.org.lead || "" });
    }
    dlg = U.modal("Tabletop: " + sc.title, h("div", { class: "dlg-body" }, h("div", { class: "row" }, clock, h("span", { class: "fine", text: "Facilitator view. Notes stay on this screen until you log the exercise." })), body),
      { wide: true, onclose: function () { clearInterval(timer); } });
    tick(); timer = setInterval(tick, 1000); show();
  }
  A.views.drills = function () {
    var t = A.today(), st = L.drillStatus(S.d, t), every = S.d.settings.drillDays || 365;
    var wrap = h("div", null, A.section("Restore drills", "Proof that your backups really bring data back. CISA's goals call for testing backups and recovery at least once a year; you chose every " + every + " days.", [A.btn("Log a drill", "primary", function () { editDrill(); }), A.btn("Run a tabletop exercise", "", tabletop)]));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Backup status" }), st.length ? table(["Backup", "Status", "Last good restore", "Next due"], st.map(function (x) {
      return h("tr", null, td("Backup", h("b", { text: x.backup.name })), td("Status", A.badge(L.DRILL_TEXT[x.state], x.state === "ok" ? "good" : x.state === "soon" ? "warn" : "bad")),
        td("Last good restore", x.lastOk ? x.lastOk.date + " (" + x.age + " days ago)" : "None"), td("Next due", x.state === "ok" || x.state === "soon" ? x.due : "Now"), td("", A.btn("Log test", "small", function () { editDrill({ id: V.uid(), type: "restore", date: t, result: "ok", backup: x.backup.id }); }), "act"));
    })) : A.empty("Add your backups on the Inventory page first.", A.btn("Go to Inventory", "", function () { A.inv = "backups"; A.go("inventory"); }))));
    var log = S.d.drills.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }), bk = {};
    S.d.backups.forEach(function (b) { bk[b.id] = b; });
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Drill log" }), log.length ? table(["Date", "Kind", "What", "Result", "Minutes", "Follow-up"], log, "drills", function (r) {
      var b = bk[r.backup];
      return h("tr", null, td("Date", r.date), td("Kind", optL(C.DRILL_TYPES, r.type)), td("What", [r.what || "", b ? h("div", { class: "fine", text: "Backup: " + b.name }) : null]),
        td("Result", A.badge(optL(C.RESULTS, r.result), r.result === "ok" ? "good" : r.result === "partial" ? "warn" : "bad")), td("Minutes", r.minutes || ""), td("Follow-up", r.followup || ""),
        td("", A.rowActions(r, S.d.drills, editDrill, "this drill"), "act"));
    }) : A.empty("No drills logged yet.")));
    return wrap;
  };
})();
