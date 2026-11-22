/* Stark Baseline: Runbook (phone tree, contacts, services), Staff lessons and the Covenant practice HIPAA evidence page. */
(function () {
  "use strict";
  var V = StarkBaseline, C = BaselineContent, L = BaselineLogic, U = BaselineUI, A = BaselineApp, h = U.h, S = A.S;
  function td(label, content, cls) { return h("td", { "data-l": label, class: cls || null }, content); }
  function table(cols, rows) {
    return h("div", { class: "tbl" }, h("table", { class: "list stack" }, h("thead", null, h("tr", null, cols.map(function (c) { return h("th", { text: c }); }), h("th", null))), h("tbody", null, rows)));
  }
  function treeEl(nodes) {
    return h("ul", { class: "tree" }, nodes.map(function (n) {
      return h("li", null, h("b", { text: n.person.name }), (n.person.role ? " · " + n.person.role : "") + " · " + (n.person.phone || "no number") + (n.person.alt ? ", alt " + n.person.alt : ""),
        n.children.length ? treeEl(n.children) : null);
    }));
  }

  /* ---------- Runbook ---------- */
  function editPerson(p) {
    if (!p && A.full(S.d.staff)) return;
    var x = p || { id: V.uid(), calledBy: "lead" };
    U.openForm(p ? "Edit person" : "Add person", [{ k: "name", label: "Name", req: true }, { k: "role", label: "Role" }, { k: "phone", label: "Phone", type: "tel" }, { k: "alt", label: "Other phone", type: "tel" },
      { k: "email", label: "Email", type: "email" }, { k: "start", label: "Start date", type: "date", help: "New starters should finish the lessons before they get access." },
      { k: "calledBy", label: "Called by (phone tree)", type: "select", options: [{ v: "lead", l: "The incident lead" }].concat(S.d.staff.filter(function (s) { return s.id !== x.id; }).map(function (s) { return { v: s.id, l: s.name }; })) }], x,
    function (o) { o.id = x.id; A.upsert(S.d.staff, o); A.save(); A.render(); });
  }
  function editContact(c) {
    if (!c && A.full(S.d.contacts)) return;
    var x = c || { id: V.uid() };
    U.openForm(c ? "Edit contact" : "Add outside contact", [{ k: "org", label: "Organisation", req: true }, { k: "kind", label: "Kind", type: "select", options: C.CONTACT_KINDS }, { k: "phone", label: "Phone", type: "tel" },
      { k: "ref", label: "Account, policy or contract number", help: "A reference, never a password." }, { k: "notes", label: "Notes", type: "textarea", warn: true, rows: 2 }], x,
    function (o) { o.id = x.id; A.upsert(S.d.contacts, o); A.save(); A.render(); });
  }
  function editService(s) {
    if (!s && A.full(S.d.services)) return;
    var x = s || { id: V.uid(), order: String(S.d.services.length + 1) };
    U.openForm(s ? "Edit service" : "Add critical service", [{ k: "name", label: "Service", req: true, ph: "Scheduling and records" }, { k: "order", label: "Restore order", type: "number", min: 1 },
      { k: "maxHours", label: "Hours you can manage without it", type: "number", min: 0 }, { k: "owner", label: "Owner" },
      { k: "backup", label: "Comes back from backup", type: "select", options: [{ v: "", l: "Not chosen (match by name)" }].concat(S.d.backups.map(function (b) { return { v: b.id, l: b.name }; })) },
      { k: "restoreHours", label: "Hours a restore takes (optional)", type: "number", min: 0, help: "Leave empty to use the time from your last good restore drill." },
      { k: "fallback", label: "Paper or manual fallback", type: "textarea", rows: 2 }], x,
    function (o) { o.id = x.id; A.upsert(S.d.services, o); A.save(); A.render(); });
  }
  function runbookDoc(m) {
    var ul = function (list) { return h("ul", { class: "boxes" }, list.map(function (x) { return h("li", { text: x }); })); };
    return h("div", { class: "printdoc" }, A.printHead(m.title),
      h("h2", { text: "Who leads" }), h("p", { text: "Incident lead: " + m.lead + ". Deputy: " + m.deputy + "." }),
      m.paperCopy ? h("p", { text: "Paper copy kept: " + m.paperCopy }) : null, m.meeting ? h("p", { text: "Meeting point: " + m.meeting }) : null, m.altChannel ? h("p", { text: "If email is down, use: " + m.altChannel }) : null,
      h("h2", { text: "Signs that something is wrong (tell the incident lead at once)" }), h("ul", null, m.signs.map(function (s) { return h("li", { text: s }); })),
      h("h2", { text: "Phone tree" }), h("p", { class: "meta", text: "Each person calls the people listed under them. Start with the incident lead." }),
      m.tree.roots.length ? treeEl(m.tree.roots) : h("p", { text: "No people added yet." }), m.tree.problems.length ? h("p", { text: "Check the tree: " + m.tree.problems.join(", ") + " (caller loop)." }) : null,
      h("h2", { text: "Outside contacts" }), m.contacts.length ? h("table", null, h("thead", null, h("tr", null, ["Organisation", "Kind", "Phone", "Reference", "Notes"].map(function (c) { return h("th", { text: c }); }))),
        h("tbody", null, m.contacts.map(function (c) { return h("tr", null, [c.org, c.kind, c.phone, c.ref, c.notes].map(function (v) { return h("td", { text: v || "" }); })); }))) : h("p", { text: "None added yet." }),
      h("h2", { text: "What to restore first" }), m.services.length ? h("table", null, h("thead", null, h("tr", null, ["#", "Service", "Manage without it for", "Owner", "Paper fallback"].map(function (c) { return h("th", { text: c }); }))),
        h("tbody", null, m.services.map(function (s, i) { return h("tr", null, [String(i + 1), s.name, s.maxHours ? s.maxHours + " h" : "", s.owner, s.fallback].map(function (v) { return h("td", { text: v || "" }); })); }))) : h("p", { text: "No critical services listed yet." }),
      h("h2", { text: "Backups" }), m.backups.length ? h("ul", null, m.backups.map(function (b) { return h("li", { text: b.name + (b.where ? " (" + b.where + (b.offline ? ", offline copy" : "") + ")" : "") + ": " + b.state + (b.lastOk ? ", last good restore " + b.lastOk : "") }); })) : h("p", { text: "No backups listed yet." }),
      h("h2", { text: "Accounts and who administers them" }), m.accounts.length ? h("ul", null, m.accounts.map(function (a) { return h("li", { text: a.name + (a.owner ? ": " + a.owner : "") }); })) : h("p", { text: "No accounts listed yet." }),
      m.scenarios.map(function (s) {
        return h("div", { class: "sc blk" }, h("h2", { text: "Scenario: " + s.title }), h("h3", { text: "First 15 minutes" }), ul(s.first), h("h3", { text: "First day" }), ul(s.day), h("h3", { text: "Getting back to normal" }), ul(s.recover));
      }),
      h("p", { class: "notice", text: "Stark Baseline helps you organise and track your security work. " + L.NOT_ADVICE }));
  }
  /* ---------- Live incident log: timestamped notes while something is happening ---------- */
  function nowStamp() { var d = new Date(); return A.today() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function startIncident() {
    if (A.full(S.d.incidents)) return;
    U.openForm("Start an incident log", [{ k: "title", label: "What is happening", req: true, ph: "Files locked on the shared drive" },
      { k: "scenario", label: "Closest runbook scenario", type: "select", options: [{ v: "", l: "None of these" }].concat(C.SCENARIOS.map(function (s) { return { v: s.id, l: s.title }; })) },
      { k: "lead", label: "Who is leading", ph: S.d.org.lead || "Incident lead" }], { lead: S.d.org.lead || "" }, function (o) {
      var inc = { id: V.uid(), title: o.title, scenario: o.scenario, lead: o.lead, status: "open", opened: A.today(), closed: "", summary: "", entries: [{ t: nowStamp(), text: "Incident log started.", by: o.lead }] };
      S.d.incidents.push(inc); A.flush().then(function () { A.render(); openIncident(inc); });
    });
  }
  function openIncident(inc) {
    var list = h("ol", { class: "inc-log" }), dlg, sc = C.SCENARIOS.filter(function (s) { return s.id === inc.scenario; })[0];
    function draw() { U.clear(list); inc.entries.forEach(function (x) { list.appendChild(h("li", null, h("b", { text: x.t }), " " + x.text + (x.by ? " (" + x.by + ")" : ""))); }); }
    var ta = h("textarea", { id: "inc-text", rows: 2, maxlength: 2000, placeholder: "What happened, what was done, who was told" }), by = h("input", { id: "inc-by", type: "text", maxlength: 120, value: inc.lead || "" });
    var add = A.btn("Add entry", "primary", function () {
      var t = ta.value.trim();
      if (!t) return;
      if (V.looksSensitive(t).length) return U.toast("Not saved: that looks like a password or full number.", true);
      inc.entries.push({ t: nowStamp(), text: t, by: by.value.trim() }); ta.value = ""; A.save(); draw(); ta.focus();
    });
    draw();
    dlg = U.modal("Incident: " + inc.title, h("div", { class: "dlg-body" },
      h("p", { class: "fine", text: "Opened " + inc.opened + (inc.status === "closed" ? ", closed " + inc.closed : ", open") + ". Every entry is time-stamped and saved encrypted. Write facts, not guesses." }),
      sc ? h("details", null, h("summary", { text: "First 15 minutes: " + sc.title }), h("ol", null, sc.first.map(function (s) { return h("li", { text: s }); }))) : null,
      list,
      inc.status === "closed" ? null : h("div", null, h("div", { class: "field wide" }, h("label", { for: "inc-text", text: "New entry" }), ta),
        h("div", { class: "field" }, h("label", { for: "inc-by", text: "By" }), by), h("div", { class: "row end" }, add)),
      h("div", { class: "row end" },
        A.btn("Save as text file", "", function () { U.downloadText("incident-" + inc.opened + ".txt", L.incidentText(inc, S.d.org)); U.toast("Saved. Text files are not encrypted."); }),
        A.btn("Print", "", function () { A.printNode(h("div", null, A.printHead("Incident log: " + inc.title), h("pre", { text: L.incidentText(inc, S.d.org) }))); }),
        inc.status === "closed" ? A.btn("Reopen", "", function () { inc.status = "open"; inc.closed = ""; inc.entries.push({ t: nowStamp(), text: "Reopened.", by: "" }); A.save(); dlg.close(); A.render(); openIncident(inc); })
          : A.btn("Close incident", "danger-o", function () { closeIncident(inc, dlg); }))), { wide: true });
  }
  function closeIncident(inc, dlg) {
    U.openForm("Close the incident", [{ k: "summary", label: "Summary and lessons learned", type: "textarea", rows: 3, warn: true, req: true }], { summary: inc.summary }, function (o) {
      inc.status = "closed"; inc.closed = A.today(); inc.summary = o.summary; inc.entries.push({ t: nowStamp(), text: "Closed. " + o.summary, by: "" });
      A.save(); dlg.close(); A.render(); U.toast("Incident closed. Consider a risk or checklist update from the lessons learned.");
    });
  }
  function incidentCard() {
    var incs = S.d.incidents.slice().sort(function (a, b) { return (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || (b.opened || "").localeCompare(a.opened || ""); });
    return h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Incident log" }), A.btn("Start an incident log", "primary", startIncident)),
      h("p", { class: "fine", text: "When something is happening, start a log and add a time-stamped note for every call, decision and action. Insurers, advisers and the police will ask for it." }),
      incs.length ? h("div", { class: "tbl" }, h("table", { class: "list stack" }, h("thead", null, h("tr", null, ["Opened", "What", "Status", "Entries", ""].map(function (c) { return h("th", { text: c }); }))),
        h("tbody", null, incs.map(function (x) {
          return h("tr", null, h("td", { "data-l": "Opened", text: x.opened }), h("td", { "data-l": "What" }, h("b", { text: x.title })),
            h("td", { "data-l": "Status" }, A.badge(x.status === "open" ? "Open" : "Closed", x.status === "open" ? "bad" : "good")), h("td", { "data-l": "Entries", text: String(x.entries.length) }),
            h("td", { class: "act" }, h("div", { class: "row tight" }, A.btn("Open log", "small", function () { openIncident(x); }), A.btn("Delete", "small danger-o", function () { A.del(S.d.incidents, x, "this incident log"); }))));
        })))) : A.empty("No incidents logged."));
  }

  A.views.runbook = function () {
    var d = S.d, rb = d.runbook, t = A.today(), tree = L.phoneTree(d.staff), staffById = {};
    d.staff.forEach(function (p) { staffById[p.id] = p; });
    var wrap = h("div", null, A.section("Recovery runbook", "Fill this in once, print it, and keep the paper copy where you can reach it without a computer.", [
      A.btn("Preview", "primary", function () { var m = L.runbook(d, t); U.modal("Runbook preview", h("div", { class: "dlg-body" }, h("div", { class: "paper" }, runbookDoc(m)),
        h("div", { class: "row end" }, A.btn("Print", "primary", function () { A.printNode(runbookDoc(L.runbook(S.d, A.today()))); }))), { wide: true }); }),
      A.btn("Print", "", function () { A.printNode(runbookDoc(L.runbook(d, t))); }),
      A.btn("Save as text file", "", function () { U.downloadText("runbook-" + A.stamp() + ".txt", L.runbookText(L.runbook(d, t))); U.toast("Saved. Text files are not encrypted."); })]));
    var inp = function (k, label, ph) { return h("div", { class: "field" }, h("label", { for: "rb-" + k, text: label }), h("input", { id: "rb-" + k, type: "text", maxlength: 200, value: rb[k] || "", placeholder: ph, onchange: function (e) { rb[k] = e.target.value.trim(); A.save(); } })); };
    wrap.appendChild(incidentCard());
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Who leads" }),
      h("p", null, "Incident lead: ", h("b", { text: d.org.lead || "not named" }), ". Deputy: ", h("b", { text: d.org.deputy || "not named" }), ". ", h("a", { href: "#/settings", text: "Change in Settings" })),
      h("div", { class: "grid2" }, inp("paperCopy", "Where the paper copy is kept", "Red binder in the office"), inp("altChannel", "Backup channel if email is down", "Staff text group"), inp("meeting", "Meeting point", "Staff room, or the cafe next door"))));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Scenarios to include" }), h("div", { class: "fnbars" }, C.SCENARIOS.map(function (s) {
      return h("label", { class: "chk" }, h("input", { type: "checkbox", id: "sc-" + s.id, checked: rb.scenarios.indexOf(s.id) !== -1, onchange: function (e) {
        rb.scenarios = rb.scenarios.filter(function (x) { return x !== s.id; }); if (e.target.checked) rb.scenarios.push(s.id); A.save(); } }), s.title);
    }))));
    wrap.appendChild(h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "People and phone tree" }), A.btn("Add person", "primary", function () { editPerson(); })),
      h("p", { class: "fine", text: "The same list is used for staff lessons. Phone numbers are encrypted here, but not on the printout." }),
      d.staff.length ? h("div", { class: "grid2 gap" }, table(["Name", "Role", "Phone", "Called by"], d.staff.map(function (p) {
        var up = staffById[p.calledBy];
        return h("tr", null, td("Name", h("b", { text: p.name })), td("Role", p.role || ""), td("Phone", p.phone || ""), td("Called by", up ? up.name : "Incident lead"), td("", A.rowActions(p, d.staff, editPerson, p.name), "act"));
      })), h("div", null, h("h3", { text: "Tree" }), h("p", { class: "fine", text: "Incident lead: " + (d.org.lead || "not named") }), treeEl(tree.roots),
        tree.problems.length ? h("p", { class: "warn-text", text: "Caller loop: " + tree.problems.join(", ") + ". Make sure the chain reaches the incident lead." }) : null))
        : A.empty("No people yet. Start with the incident lead and deputy.", A.btn("Add person", "primary", function () { editPerson(); }))));
    wrap.appendChild(h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Outside contacts" }), A.btn("Add contact", "primary", function () { editContact(); })),
      d.contacts.length ? table(["Organisation", "Kind", "Phone", "Reference"], d.contacts.map(function (c) {
        return h("tr", null, td("Organisation", h("b", { text: c.org })), td("Kind", c.kind || ""), td("Phone", c.phone || ""), td("Reference", c.ref || ""), td("", A.rowActions(c, d.contacts, editContact, c.org), "act"));
      })) : A.empty("Add your IT contact, insurer hotline, bank fraud line and internet provider.")));
    var svc = d.services.slice().sort(function (a, b) { return (+a.order || 99) - (+b.order || 99); });
    wrap.appendChild(h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Critical services, in restore order" }), A.btn("Add service", "primary", function () { editService(); })),
      svc.length ? table(["#", "Service", "Manage without it", "Owner", "Paper fallback"], svc.map(function (s) {
        return h("tr", null, td("#", s.order || ""), td("Service", h("b", { text: s.name })), td("Manage without it", s.maxHours ? s.maxHours + " h" : ""), td("Owner", s.owner || ""), td("Paper fallback", s.fallback || ""), td("", A.rowActions(s, d.services, editService, s.name), "act"));
      })) : A.empty("List what must come back first, such as scheduling, phones, email and billing.")));
    if (A.recoveryCard) wrap.appendChild(A.recoveryCard());
    return wrap;
  };

  /* ---------- Staff lessons ---------- */
  function lessonView(ls) {
    var wrap = h("div", null, A.section(ls.title, "About " + ls.minutes + " minutes. Warning signs from Stark Warden's scam-pattern library, adapted for the workplace.", [A.btn("All lessons", "", function () { A.lesson = null; A.render(); })]));
    wrap.appendChild(h("div", { class: "card" }, h("p", { text: ls.intro }), h("h2", { text: "Warning signs" }),
      h("ul", { class: "signs" }, ls.signs.map(function (s) { return h("li", null, h("b", { text: s.title }), s.why); }))));
    wrap.appendChild(h("div", { class: "grid2 gap" }, h("div", { class: "card" }, h("h2", { text: "At work this looks like" }), h("ul", null, ls.atWork.map(function (x) { return h("li", { text: x }); }))),
      h("div", { class: "card" }, h("h2", { text: "What to do" }), h("ul", null, ls.todo.map(function (x) { return h("li", { text: x }); })))));
    var qs = C.QUIZ.filter(function (q) { return q.lesson === ls.id; });
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Practice: scam or not?" }), h("p", { class: "fine", text: "Names, numbers and addresses are made up. Answers are not saved." }), qs.map(function (q, i) {
      var res = h("p", { class: "res", role: "status" }), box = h("div", { class: "quiz" });
      var ans = function (pick) {
        var right = pick === q.scam; res.className = "res " + (right ? "right" : "wrong");
        res.textContent = (right ? "Right. " : "Not quite. ") + (q.scam ? "This is a scam. " : "This one looks genuine. ") + q.why + " Signs: " + q.tells.join(", ") + ".";
      };
      box.appendChild(h("p", { class: "fine", text: "Message " + (i + 1) }));
      box.appendChild(h("blockquote", { text: q.text }));
      box.appendChild(h("div", { class: "row" }, A.btn("Scam", "coral small", function () { ans(true); }), A.btn("Looks genuine", "small", function () { ans(false); })));
      box.appendChild(res);
      return box;
    })));
    return wrap;
  }
  function printTraining() {
    var t = A.today(), tr = L.trainingStatus(S.d, t);
    A.printNode(h("div", { class: "printdoc" }, A.printHead("Staff security training record"),
      h("p", { text: tr.full + " of " + tr.rows.length + " staff completed every lesson in the last 12 months. Completion is recorded by the organisation; Stark Baseline does not test or monitor staff." }),
      h("table", null, h("thead", null, h("tr", null, [h("th", { text: "Person" })].concat(C.LESSONS.map(function (l) { return h("th", { text: l.title }); })))),
        h("tbody", null, S.d.staff.map(function (p) { var r = S.d.training[p.id] || {}; return h("tr", null, h("td", { text: p.name + (p.role ? " (" + p.role + ")" : "") }), C.LESSONS.map(function (l) { return h("td", { text: r[l.id] || "" }); })); })))));
  }
  A.views.staff = function () {
    if (A.lesson) { var ls = C.LESSONS.filter(function (l) { return l.id === A.lesson; })[0]; if (ls) return lessonView(ls); }
    var d = S.d, t = A.today(), tr = L.trainingStatus(d, t);
    var wrap = h("div", null, A.section("Staff lessons", "Seven short lessons on the tricks that reach small organisations, built from Stark Warden's scam-pattern library.", [A.btn("Print training record", "", printTraining)]));
    wrap.appendChild(h("div", { class: "cards" }, C.LESSONS.map(function (l) {
      var n = d.staff.filter(function (p) { var x = (d.training[p.id] || {})[l.id]; var a = V.daysBetween(x, t); return a !== null && a >= 0 && a <= 365; }).length;
      return h("article", { class: "card" }, h("div", { class: "item-top" }, h("h3", { text: l.title }), A.badge(l.minutes + " min")), h("p", { class: "fine", text: l.intro }),
        h("p", { class: "fine", text: n + " of " + d.staff.length + " staff completed it this year." }), h("div", { class: "row" }, A.btn("Open lesson", "primary small", function () { A.lesson = l.id; A.render(); window.scrollTo(0, 0); })));
    })));
    var card = h("div", { class: "card" }, h("h2", { text: "Who has completed what (last 12 months)" }),
      h("p", { class: "fine", text: "Record completion after each person goes through a lesson with you. This is your own record; nothing tracks or monitors staff." }));
    if (!d.staff.length) card.appendChild(A.empty("Add people on the Runbook page first.", A.btn("Go to Runbook", "", function () { A.go("runbook"); })));
    else card.appendChild(table(["Person", "Lessons this year", "Mark complete"], tr.rows.map(function (r) {
      var rec = d.training[r.person.id] || {}, pick = h("select", { "aria-label": "Lesson for " + r.person.name }, [{ id: "all", title: "All lessons" }].concat(C.LESSONS).map(function (l) { return h("option", { value: l.id, text: l.title }); }));
      return h("tr", null, td("Person", h("b", { text: r.person.name })), td("Lessons this year", [A.badge(r.current + " of " + r.total, r.full ? "good" : r.current ? "warn" : "bad"),
        h("div", { class: "fine", text: C.LESSONS.filter(function (l) { return rec[l.id]; }).map(function (l) { return l.title + " " + rec[l.id]; }).join("; ") })]),
        td("Mark complete", h("div", { class: "row tight" }, pick, A.btn("Done today", "small", function () {
          var to = d.training[r.person.id] = d.training[r.person.id] || {}; (pick.value === "all" ? C.LESSONS.map(function (l) { return l.id; }) : [pick.value]).forEach(function (id) { to[id] = t; }); A.save(); A.render();
        }))));
    })));
    wrap.appendChild(card);
    return wrap;
  };

  /* ---------- Covenant practice: HIPAA risk-analysis evidence ---------- */
  function printHipaa() {
    var d = S.d, t = A.today(), sum = L.hipaaSummary(d, t), rv = d.hipaa._review || {}, sc = L.scores(d.checks);
    A.printNode(h("div", { class: "printdoc" }, A.printHead("HIPAA risk analysis: evidence pack"),
      h("p", { text: "Organised with the Covenant practice preset under the elements described in HHS guidance on risk analysis (45 CFR 164.308(a)(1)(ii)(A)). This pack collects evidence for the practice's own analysis; it is not the analysis itself and does not show that the practice meets any rule." }),
      h("p", { text: "Last review: " + (rv.last || "not recorded") + ". Next review: " + (rv.next || "not set") + ". Reviewed by: " + (rv.by || "not recorded") + "." }),
      sum.map(function (s) {
        return h("div", { class: "blk" }, h("h2", { text: s.el.title + " (" + (C.STATUS.filter(function (x) { return x.v === s.status; })[0] || C.STATUS[0]).l + ")" }), h("p", { text: s.el.what }),
          h("p", { text: "From the records: " + s.auto }), s.note ? h("p", { text: "Note: " + s.note }) : null,
          h("p", { text: "Evidence: " + (s.evidence.length ? s.evidence.map(function (e) { return e.title + (e.date ? " (" + e.date + ")" : "") + (e.file ? " [file " + e.file.sha256.slice(0, 12) + "]" : ""); }).join("; ") : "none linked yet") }));
      }),
      h("h2", { text: "Risk list" }), h("table", null, h("thead", null, h("tr", null, ["Threat", "Weakness", "Affected", "Current measures", "Likelihood", "Impact", "Level", "Action", "Owner", "Due"].map(function (c) { return h("th", { text: c }); }))),
        h("tbody", null, L.rankedRisks(d.risks).map(function (r) {
          var lv = function (v) { return (C.LEVELS.filter(function (x) { return x.v === v; })[0] || { l: "" }).l; };
          return h("tr", null, [r.threat, r.weakness, r.asset, r.measures, lv(r.likelihood), lv(r.impact), L.riskLevel(r.likelihood, r.impact).label, r.action, r.owner, r.due].map(function (v) { return h("td", { text: v || "" }); }));
        }))),
      h("h2", { text: "Safeguards checklist summary" }), h("p", { text: "Overall " + sc.overall.pct + "%. " + C.FUNCTIONS.map(function (f) { return f.name + " " + sc.fns[f.id].pct + "%"; }).join(", ") + "." }),
      h("p", { class: "meta", text: "Signed: ______________________   Date: ____________" })));
  }
  A.views.hipaa = function () {
    var d = S.d, t = A.today(), rv = d.hipaa._review = d.hipaa._review || {}, sum = L.hipaaSummary(d, t);
    var wrap = h("div", null, A.section("HIPAA evidence", "Covenant practice preset: organise and track the evidence a clinic gathers for its own HIPAA risk analysis.", [A.btn("Print evidence pack", "primary", printHipaa)]));
    wrap.appendChild(h("div", { class: "banner" }, h("strong", { text: "What this is, and is not. " }),
      "The elements below follow HHS guidance on risk analysis, in our own words (see Sources). This page helps you organise and track evidence; it does not perform the analysis, decide what the rules require, or show that a practice meets them. " + L.NOT_ADVICE + " Ask a qualified adviser."));
    var date = function (k, label) { return h("div", { class: "field" }, h("label", { for: "hr-" + k, text: label }), h("input", { id: "hr-" + k, type: k === "by" ? "text" : "date", maxlength: 100, value: rv[k] || "",
      onchange: function (e) { if (k !== "by" && e.target.value && isNaN(V.dayNum(e.target.value))) return; rv[k] = e.target.value.trim(); A.save(); } })); };
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Review schedule" }), h("div", { class: "grid2" }, date("last", "Last full review"), date("next", "Next review due"), date("by", "Reviewed by"))));
    sum.forEach(function (s) {
      var rec = d.hipaa[s.el.id] = d.hipaa[s.el.id] || {};
      var sel = h("select", { "aria-label": "Status of " + s.el.title, onchange: function (e) { rec.status = e.target.value; A.save(); } }, C.STATUS.filter(function (x) { return x.v !== "na"; }).map(function (x) { return h("option", { value: x.v, text: x.l, selected: x.v === s.status }); }));
      wrap.appendChild(h("div", { class: "card item " + (s.status === "done" ? "good" : s.status === "doing" ? "warn" : "") },
        h("div", { class: "ck-top" }, h("h3", { text: s.el.title }), A.badge(s.evidence.length + " evidence", s.evidence.length ? "good" : ""), sel),
        h("p", { text: s.el.what }), h("p", { class: "fine", text: "Gather: " + s.el.gather.join("; ") + "." }),
        h("p", { class: "fine", text: "From your records: " + s.auto }),
        s.evidence.length ? h("p", { class: "fine", text: "Linked evidence: " + s.evidence.map(function (e) { return e.title; }).join("; ") }) : null,
        h("div", { class: "field" }, h("label", { for: "hn-" + s.el.id, text: "Notes" }), h("input", { id: "hn-" + s.el.id, type: "text", maxlength: 600, value: rec.note || "", onchange: function (e) {
          if (V.looksSensitive(e.target.value).length) { U.toast("Not saved: that looks like a password or full number.", true); e.target.value = rec.note || ""; return; } rec.note = e.target.value.trim(); A.save(); } })),
        h("div", { class: "row end" }, s.el.link !== "hipaa" ? A.btn("Open " + s.el.link, "small ghost", function () { A.go(s.el.link); }) : null, A.btn("Attach evidence", "small", function () { A.editEvidence(null, { hipaa: [s.el.id] }); }))));
    });
    return wrap;
  };
})();
