/* Contacts: a small networking CRM with a follow-up cadence, and a reference tracker with heads-up messages and a reference sheet. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$, K = SC.kit;
  var TABS = [["", "People"], ["refs", "References"]];
  var KINDS = [["message", "Message"], ["email", "Email"], ["call", "Call"], ["coffee", "Coffee or meeting"], ["event", "Event"]];
  var TIER_OPTS = Object.keys(SC.TIERS).map(function (k) { return [k, SC.TIERS[k][0] + " (every " + SC.TIERS[k][1] + " days)"]; });

  SC.views.contacts = function (root) {
    if (SC.sub() === "refs") refs(root); else people(root);
    K.bindTabs(root);
  };

  /* ---------- people ---------- */
  function people(root) {
    var L = SC.S.contacts, q = "", saveSoon = SC.debounce(SC.save, 300);
    function draw() {
      var today = SC.today(), h = SC.crmHealth(L, today), due = SC.contactsDue(L, today);
      root.innerHTML = K.head("Contacts", "Your network",
        "Keep the people who can help your career warm. Give each contact a rhythm (every 3 weeks, 6 weeks or 3 months), log every touch, and the list tells you who to reach out to next. Logging a touch also counts toward your weekly networking goal.") +
        K.tabs("contacts", TABS, "") +
        '<div class="stat">' + K.stat("contacts", h.n) + K.stat("due now", h.due) + K.stat("on rhythm", h.pct + "%") + K.stat("touches this week", weekTouches(today)) + "</div>" +
        '<div class="two"><div><section class="card"><div class="card-head"><h2>Reach out next</h2><button type="button" class="btn small ghost" id="c-ics">Add to calendar (.ics)</button></div>' +
        (due.length ? '<ul class="vlist due-list">' + due.slice(0, 8).map(function (x) {
          return '<li data-id="' + x.c.id + '"><div><b>' + E(x.c.name || "(no name)") + '</b><span class="fine">' + E([x.c.role, x.c.company].filter(Boolean).join(", ")) + " &middot; " +
            (x.c.last ? (x.late ? '<span class="warn-text">' + x.late + " day" + (x.late > 1 ? "s" : "") + " overdue</span>" : "due today") : "never contacted") + '</span></div><button type="button" class="btn small primary" data-touch>Log a touch</button></li>';
        }).join("") + "</ul>" : '<p class="muted">Nobody is due. Add people below, or log a touch when you talk to someone.</p>') + "</section>" +
        '<section class="card"><h2>Add a contact</h2><div class="cols">' +
        K.field("cn-name", "Name", "") + K.field("cn-company", "Company", "") + K.field("cn-role", "Their role", "") + K.field("cn-how", "How you know them", "", { ph: "Former manager, alumni, met at a meetup" }) +
        K.field("cn-email", "Email", "", { type: "email" }) + K.field("cn-phone", "Phone", "", { type: "tel" }) + K.field("cn-link", "Profile link", "") + K.field("cn-tier", "Rhythm", "warm", { opts: TIER_OPTS }) +
        '</div><div class="row" style="margin-top:.6rem"><button type="button" class="btn primary" id="cn-add" data-primary>Add contact</button>' +
        '<button type="button" class="btn small" id="cn-apps">Import contacts from Applications</button></div></section></div>' +
        '<section class="card"><div class="card-head"><h2>Everyone (' + L.length + ')</h2><button type="button" class="btn small" id="c-csv">Download (.csv)</button></div>' +
        '<label class="sr-only" for="c-q">Search contacts</label><input id="c-q" type="search" placeholder="Search by name, company or note" value="' + E(q) + '">' +
        '<div id="c-list"></div></section></div>';
      list();
    }
    function weekTouches(today) {
      var ws = SC.weekStart(today), n = 0;
      L.forEach(function (c) { (c.log || []).forEach(function (e) { if (e.d >= ws && e.d <= today) n++; }); });
      return n;
    }
    function list() {
      var today = SC.today(), ql = q.toLowerCase();
      var rows = L.filter(function (c) { return !ql || [c.name, c.company, c.role, c.how, c.notes].join(" ").toLowerCase().indexOf(ql) >= 0; })
        .sort(function (a, b) { var x = SC.contactNext(a, today), y = SC.contactNext(b, today); return x < y ? -1 : x > y ? 1 : 0; });
      $("#c-list").innerHTML = rows.length ? rows.map(function (c) {
        var nx = SC.contactNext(c, today);
        return '<div class="acard" data-id="' + c.id + '"><b>' + E(c.name || "(no name)") + "</b><span>" + E([c.role, c.company].filter(Boolean).join(", ")) + "</span>" +
          '<div class="fine">' + (c.last ? "Last: " + E(K.nice(c.last)) + " &middot; " : "") + "Next: " + E(K.nice(nx)) + " &middot; every " + SC.contactCadence(c) + " days</div>" +
          '<div class="row" style="margin-top:.35rem"><button type="button" class="btn small" data-touch>Log a touch</button></div>' +
          "<details><summary>Details and history</summary><div class=\"cols\">" +
          K.field("ce-name-" + c.id, "Name", c.name, { k: "name" }) + K.field("ce-company-" + c.id, "Company", c.company, { k: "company" }) + K.field("ce-role-" + c.id, "Role", c.role, { k: "role" }) +
          K.field("ce-how-" + c.id, "How you know them", c.how, { k: "how" }) + K.field("ce-email-" + c.id, "Email", c.email, { k: "email" }) + K.field("ce-phone-" + c.id, "Phone", c.phone, { k: "phone" }) +
          K.field("ce-link-" + c.id, "Profile link", c.link, { k: "link" }) + K.field("ce-tier-" + c.id, "Rhythm", c.tier, { k: "tier", opts: TIER_OPTS }) +
          K.field("ce-cad-" + c.id, "Custom rhythm (days, optional)", c.cadence, { k: "cadence", type: "number", min: 1, max: 730 }) + K.field("ce-last-" + c.id, "Last contact", c.last, { k: "last", type: "date" }) + "</div>" +
          K.field("ce-notes-" + c.id, "Notes (interests, family, what you talked about)", c.notes, { k: "notes", area: true, rows: 2 }) +
          "<h4>History</h4>" + ((c.log || []).length ? '<ul class="hist">' + c.log.slice(0, 12).map(function (e) { return "<li><b>" + E(K.nice(e.d)) + "</b> " + E((KINDS.filter(function (k) { return k[0] === e.k; })[0] || KINDS[0])[1]) + (e.n ? ": " + E(e.n) : "") + "</li>"; }).join("") + "</ul>" : '<p class="fine">No touches logged yet.</p>') +
          '<div class="row"><button type="button" class="btn small danger" data-del>Delete contact</button></div></details></div>';
      }).join("") : '<p class="muted">' + (L.length ? "No contact matches that search." : "No contacts yet.") + "</p>";
    }
    function touchDialog(c) {
      var o = $("#overlay");
      o.innerHTML = '<div class="dialog keys" role="dialog" aria-modal="true" aria-label="Log a touch" tabindex="-1"><div class="card-head"><h2>Log a touch: ' + E(c.name || "contact") + '</h2><button type="button" class="btn small ghost" data-close>Close</button></div>' +
        '<div class="cols">' + K.field("t-kind", "What happened", "message", { opts: KINDS }) + K.field("t-date", "Date", SC.today(), { type: "date" }) + "</div>" +
        K.field("t-note", "Note (optional)", "", { ph: "Asked about the team's hiring plans" }) +
        '<div class="row" style="margin-top:.7rem"><button type="button" class="btn primary" id="t-save">Save</button></div></div>';
      o.hidden = false; $("#t-note").focus();
      o.querySelector(".dialog").addEventListener("keydown", function (e) { if (e.key === "Escape") SC.closeOverlay(); else if (e.key === "Enter" && e.target.id === "t-note") $("#t-save").click(); });
      $("#t-save").addEventListener("click", function () {
        var d = $("#t-date").value; if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) d = SC.today();
        SC.touchContact(c, d, $("#t-note").value, $("#t-kind").value);
        if (d === SC.today()) SC.logActivity(SC.S.sprint, "net", d);
        SC.save(); SC.closeOverlay(); SC.toast("Logged. Next reach-out: " + K.nice(SC.contactNext(c, SC.today())) + "."); draw();
      });
    }
    draw();
    function onEdit(ev) {
      var el = ev.target;
      if (el.id === "c-q") { q = el.value; list(); return; }
      var k = el.getAttribute("data-k"), card = el.closest("[data-id]"); if (!k || !card) return;
      var c = K.byId(L, card.getAttribute("data-id")); if (!c) return;
      c[k] = k === "last" && !/^\d{4}-\d{2}-\d{2}$/.test(el.value) ? "" : el.value; saveSoon();
    }
    root.addEventListener("input", onEdit);
    root.addEventListener("change", function (ev) { onEdit(ev); var k = ev.target.getAttribute("data-k"); if (k === "tier" || k === "cadence" || k === "last") { SC.save(); draw(); } });
    root.addEventListener("click", function (ev) {
      var t = ev.target, card = t.closest("[data-id]"), c = card ? K.byId(L, card.getAttribute("data-id")) : null;
      if (t.id === "cn-add") {
        var name = $("#cn-name").value.trim(); if (!name) { SC.toast("Enter a name."); $("#cn-name").focus(); return; }
        L.push(SC.blankContact({ name: name, company: $("#cn-company").value, role: $("#cn-role").value, how: $("#cn-how").value, email: $("#cn-email").value, phone: $("#cn-phone").value, link: $("#cn-link").value, tier: $("#cn-tier").value }));
        SC.save(); draw(); SC.toast("Added " + name + "."); $("#cn-name").focus();
      } else if (t.id === "cn-apps") {
        var have = {}, n = 0; L.forEach(function (x) { have[(x.name + "|" + x.company).toLowerCase()] = 1; });
        SC.S.apps.forEach(function (a) { (a.contacts || []).forEach(function (x) {
          var key = (String(x.name || "").trim() + "|" + String(a.company || "").trim()).toLowerCase(); if (!String(x.name || "").trim() || have[key]) return;
          have[key] = 1; n++; L.push(SC.blankContact({ name: x.name, company: a.company, role: x.role, email: x.email, phone: x.phone, how: "Contact for the " + (a.role || "role") + " application" }));
        }); });
        SC.save(); draw(); SC.toast(n ? "Imported " + n + " contact" + (n > 1 ? "s" : "") + " from Applications." : "No new contacts found in Applications.");
      } else if (t.id === "c-csv") SC.download("contacts.csv", SC.contactsCSV(L, SC.today()), "text/csv");
      else if (t.id === "c-ics") K.calendar();
      else if (c && t.hasAttribute("data-touch")) touchDialog(c);
      else if (c && t.hasAttribute("data-del")) { if (!K.sure(t, "Click again to delete")) return; SC.S.contacts = L = L.filter(function (x) { return x.id !== c.id; }); SC.save(); draw(); }
    });
  }

  /* ---------- references ---------- */
  function refs(root) {
    var L = SC.S.refs, saveSoon = SC.debounce(SC.save, 300), hu = { id: "", role: "", company: "", focus: "" };
    function draw() {
      var today = SC.today(), r = SC.refReport(L, today);
      root.innerHTML = K.head("Contacts", "References",
        "Line up three or more people who have agreed to speak for you. Brief them before each call, avoid leaning on the same person too often, and thank them afterwards. The reference sheet prints only the people who said yes.") +
        K.tabs("contacts", TABS, "refs") +
        '<div class="stat">' + K.stat("agreed", r.agreed + " of 3") + K.stat("to thank", r.thanks.length) + K.stat("used 3+ times this month", r.busy.length) + "</div>" +
        (r.ready ? "" : '<div class="hint warn">Most employers ask for three references. Ask ' + (3 - r.agreed) + " more " + (3 - r.agreed > 1 ? "people" : "person") + " before you reach the final round.</div>") +
        (r.busy.length ? '<div class="hint warn">Give ' + r.busy.map(function (x) { return E(x.name); }).join(", ") + " a rest: three or more calls in 30 days is a lot to ask.</div>" : "") +
        (r.stale.length ? '<div class="hint">It has been over six months since you asked ' + r.stale.map(function (x) { return E(x.name); }).join(", ") + ". Check they are still happy to help and that their details are current.</div>" : "") +
        '<div class="two"><div><section class="card"><h2>Add a reference</h2><div class="cols">' +
        K.field("rn-name", "Name", "") + K.field("rn-title", "Their title", "") + K.field("rn-company", "Company", "") + K.field("rn-relation", "Relationship", "", { ph: "My manager at Brightway, 2021 to 2024" }) +
        K.field("rn-email", "Email", "", { type: "email" }) + K.field("rn-phone", "Phone", "", { type: "tel" }) + "</div>" +
        K.field("rn-speaks", "What they can speak to", "", { area: true, rows: 2, ph: "The error-reduction project; training new hires" }) +
        '<div class="row" style="margin-top:.6rem"><button type="button" class="btn primary" id="rn-add" data-primary>Add reference</button></div></section>' +
        '<section class="card"><h2>Heads-up message</h2><p class="fine">Send this when an employer is about to call, so your reference knows the role and what to stress.</p><div class="cols">' +
        K.field("hu-id", "Reference", hu.id, { opts: [["", "Choose..."]].concat(L.map(function (x) { return [x.id, x.name || "(no name)"]; })) }) +
        K.field("hu-role", "Role", hu.role) + K.field("hu-company", "Company", hu.company) + K.field("hu-focus", "What the role focuses on", hu.focus) + "</div>" +
        '<pre class="script" id="hu-out"></pre><div class="row"><button type="button" class="btn small" id="hu-copy">Copy message</button><button type="button" class="btn small" id="hu-used">Record this use</button></div></section></div>' +
        '<div><section class="card"><h2>Your references</h2><div id="r-list"></div></section>' +
        '<section class="card"><h2>Reference sheet</h2><pre class="script" id="r-sheet"></pre><div class="row"><button type="button" class="btn small" id="r-copy">Copy</button><button type="button" class="btn small" id="r-txt">Download .txt</button><button type="button" class="btn small" id="r-print">Print</button></div></section></div></div>';
      listRefs(); msg();
    }
    function listRefs() {
      $("#r-list").innerHTML = L.length ? L.map(function (x) {
        return '<div class="acard" data-id="' + x.id + '"><b>' + E(x.name || "(no name)") + "</b><span>" + E([x.title, x.company].filter(Boolean).join(", ")) + "</span>" +
          '<div class="cols">' + K.field("re-status-" + x.id, "Status", x.status, { k: "status", opts: SC.REF_STATUS }) + K.field("re-asked-" + x.id, "Asked on", x.asked, { k: "asked", type: "date" }) + "</div>" +
          ((x.uses || []).length ? "<h4>Used for</h4><ul class=\"hist\">" + x.uses.map(function (u, i) {
            return "<li>" + E(K.nice(u.d)) + ": " + E(u.a || "an application") + ' <label class="check inline"><input type="checkbox" data-thank="' + i + '"' + (u.thanked ? " checked" : "") + "> thanked</label></li>"; }).join("") + "</ul>" : "") +
          "<details><summary>Edit details</summary><div class=\"cols\">" +
          K.field("re-name-" + x.id, "Name", x.name, { k: "name" }) + K.field("re-title-" + x.id, "Title", x.title, { k: "title" }) + K.field("re-company-" + x.id, "Company", x.company, { k: "company" }) +
          K.field("re-relation-" + x.id, "Relationship", x.relation, { k: "relation" }) + K.field("re-email-" + x.id, "Email", x.email, { k: "email" }) + K.field("re-phone-" + x.id, "Phone", x.phone, { k: "phone" }) + "</div>" +
          K.field("re-speaks-" + x.id, "What they can speak to", x.speaks, { k: "speaks", area: true, rows: 2 }) + K.field("re-notes-" + x.id, "Notes", x.notes, { k: "notes", area: true, rows: 2 }) +
          '<div class="row"><button type="button" class="btn small danger" data-del>Delete reference</button></div></details></div>';
      }).join("") : '<p class="muted">No references yet. Former managers, senior colleagues, clients and teachers make good ones.</p>';
      $("#r-sheet").textContent = SC.refSheet(L, SC.S.resume);
    }
    function msg() {
      var x = K.byId(L, hu.id);
      $("#hu-out").textContent = x ? SC.refHeadsUp(x, { role: hu.role, company: hu.company, focus: hu.focus, me: SC.S.resume.name }) : "Choose a reference to draft the message.";
    }
    draw();
    function onEdit(ev) {
      var el = ev.target;
      if (el.id && el.id.indexOf("hu-") === 0 && el.id !== "hu-out") { hu[el.id.slice(3)] = el.value; msg(); return; }
      var k = el.getAttribute("data-k"), card = el.closest("[data-id]"); if (!k || !card) return;
      var x = K.byId(L, card.getAttribute("data-id")); if (!x) return;
      x[k] = k === "asked" && !/^\d{4}-\d{2}-\d{2}$/.test(el.value) ? "" : el.value; saveSoon();
      $("#r-sheet").textContent = SC.refSheet(L, SC.S.resume); msg();
    }
    root.addEventListener("input", onEdit);
    root.addEventListener("change", function (ev) {
      onEdit(ev);
      var el = ev.target, card = el.closest("[data-id]"), x = card ? K.byId(L, card.getAttribute("data-id")) : null;
      if (x && el.hasAttribute("data-thank")) { var u = x.uses[+el.getAttribute("data-thank")]; if (u) u.thanked = el.checked; SC.save(); return; }
      if (x && el.getAttribute("data-k") === "status") { if (el.value === "asked" || el.value === "agreed") { if (!x.asked) x.asked = SC.today(); } SC.save(); draw(); }
    });
    root.addEventListener("click", function (ev) {
      var t = ev.target, card = t.closest("[data-id]"), x = card ? K.byId(L, card.getAttribute("data-id")) : null;
      if (t.id === "rn-add") {
        var name = $("#rn-name").value.trim(); if (!name) { SC.toast("Enter a name."); $("#rn-name").focus(); return; }
        L.push(SC.blankRef({ name: name, title: $("#rn-title").value, company: $("#rn-company").value, relation: $("#rn-relation").value, email: $("#rn-email").value, phone: $("#rn-phone").value, speaks: $("#rn-speaks").value }));
        SC.save(); draw(); SC.toast("Added " + name + ". Set the status to Agreed once they say yes.");
      } else if (t.id === "hu-copy") SC.copy($("#hu-out").textContent);
      else if (t.id === "hu-used") {
        var r = K.byId(L, hu.id); if (!r) { SC.toast("Choose a reference first."); return; }
        SC.refUse(r, SC.today(), [hu.role, hu.company].filter(Boolean).join(" at ")); SC.save(); draw(); SC.toast("Recorded. Remember to thank " + (r.name || "them") + " afterwards.");
      } else if (t.id === "r-copy") SC.copy(SC.refSheet(L, SC.S.resume));
      else if (t.id === "r-txt") SC.download("references.txt", SC.refSheet(L, SC.S.resume));
      else if (t.id === "r-print") SC.printHTML('<div class="paper"><pre class="letter">' + E(SC.refSheet(L, SC.S.resume)) + "</pre></div>");
      else if (x && t.hasAttribute("data-del")) { if (!K.sure(t, "Click again to delete")) return; SC.S.refs = L = L.filter(function (y) { return y.id !== x.id; }); SC.save(); draw(); }
    });
  }
})();
