/* Freelance mode: rate calculator, client pipeline and a proposal writer. Planning figures only; not tax or legal advice. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$, K = SC.kit;
  var TABS = [["", "Rate"], ["clients", "Clients"], ["proposal", "Proposal"]];

  SC.views.freelance = function (root) {
    var sub = SC.sub();
    if (sub === "clients") clients(root); else if (sub === "proposal") proposal(root); else rate(root);
    K.bindTabs(root);
  };
  function head(cur) {
    return K.head("Freelance", "Freelance and contract work",
      "Work out a rate that actually pays your bills, track clients from first contact to paid invoice, and send clear proposals. The numbers are planning estimates from what you enter; check tax and contract details with a local professional.") +
      K.tabs("freelance", TABS, cur);
  }

  function rate(root) {
    var F = SC.S.free, saveSoon = SC.debounce(SC.save, 300);
    root.innerHTML = head("") + '<div class="two"><section class="card"><h2>Your numbers</h2><div class="cols">' +
      K.field("f-income", "Take-home pay you want per year", F.income, { k: "income", type: "number", min: 0, mode: "decimal", ph: "60000" }) +
      K.field("f-expenses", "Business costs per year", F.expenses, { k: "expenses", type: "number", min: 0, mode: "decimal", ph: "6000" }) +
      K.field("f-tax", "Tax and social charges (%)", F.tax, { k: "tax", type: "number", min: 0, max: 90 }) +
      K.field("f-weeks", "Working weeks per year", F.weeks, { k: "weeks", type: "number", min: 1, max: 52 }) +
      K.field("f-hours", "Billable hours per week", F.hours, { k: "hours", type: "number", min: 1, max: 80 }) +
      K.field("f-buffer", "Buffer for slow months (%)", F.buffer, { k: "buffer", type: "number", min: 0, max: 200 }) +
      K.field("f-day", "Hours in a day rate", F.dayHours, { k: "dayHours", type: "number", min: 1, max: 14 }) + K.curField("f-cur") + "</div>" +
      '<p class="fine">Billable hours are the hours a client pays for. Admin, sales, learning and invoicing are not billable, so 20 to 30 a week is common for full-time freelancers.</p></section>' +
      '<section class="card" id="f-out" aria-live="polite"></section></div>';
    function out() {
      var r = SC.freelanceRate(F), o = $("#f-out");
      if (r.error) { o.innerHTML = "<h2>Your rate</h2><p class=\"muted\">" + E(r.error) + "</p>"; return; }
      o.innerHTML = "<h2>Charge at least " + SC.money(r.hourly) + " an hour</h2>" +
        '<div class="stat">' + K.stat("per hour", SC.money(r.hourly)) + K.stat("per day (" + (SC.num(F.dayHours) || 8) + " h)", SC.money(r.day)) + K.stat("per full week", SC.money(r.week)) + K.stat("to invoice per month", SC.money(r.month)) + "</div>" +
        "<p>To take home " + SC.money(SC.num(F.income)) + " you need to invoice about <b>" + SC.money(r.gross) + "</b> a year over " + Math.round(r.billable) + " billable hours.</p>" +
        '<div class="hint">' + (r.utilization > 75 ? "Billing more than 30 hours a week leaves little time to find the next client. Plan for fewer billable hours or a higher rate." : "Rounded up from " + SC.money(r.raw) + " so you never quote below your floor.") + "</div>" +
        '<h3>Quick quote</h3><div class="cols">' + K.field("q-hours", "Hours of work", "10", { type: "number", min: 0 }) + "</div><p id=\"q-out\" class=\"fine\"></p>" +
        '<button type="button" class="btn small" id="f-prop">Write a proposal at this rate</button>';
      quote();
    }
    function quote() { var r = SC.freelanceRate(F), h = SC.num(($("#q-hours") || {}).value); if (!r.error && $("#q-out")) $("#q-out").innerHTML = "<b>" + SC.money(h * r.hourly) + "</b> for " + h + " hours at " + SC.money(r.hourly) + " an hour."; }
    out();
    root.addEventListener("input", function (ev) {
      var el = ev.target, k = el.getAttribute("data-k");
      if (el.id === "q-hours") { quote(); return; }
      if (!k) return;
      if (k === "cur") SC.S.cur = el.value; else F[k] = el.value;
      saveSoon(); out();
    });
    root.addEventListener("click", function (ev) {
      if (ev.target.id === "f-prop") { var r = SC.freelanceRate(F); F.prop.rate = String(r.hourly); F.prop.hours = ($("#q-hours") || {}).value || F.prop.hours; SC.save(); SC.go("#/freelance/proposal"); }
    });
  }

  function clients(root) {
    var F = SC.S.free, saveSoon = SC.debounce(SC.save, 300);
    function draw() {
      var today = SC.today(), p = SC.freelancePipeline(F.clients, today);
      root.innerHTML = head("clients") +
        '<div class="stat">' + K.stat("in the pipeline", SC.money(p.open)) + K.stat("booked work", SC.money(p.booked)) + K.stat("delivered, not paid", SC.money(p.unpaid)) + K.stat("paid", SC.money(p.paid)) +
        K.stat("win rate", p.winRate == null ? "-" : p.winRate + "%") + "</div>" +
        (p.overdue.length ? '<div class="hint warn">Past due: ' + p.overdue.map(function (c) { return E(c.name || "client") + (c.project ? " (" + E(c.project) + ")" : ""); }).join(", ") + ". Update the date or tell the client.</div>" : "") +
        '<section class="card"><h2>Add a client or lead</h2><div class="cols">' + K.field("cl-name", "Client", "") + K.field("cl-project", "Project", "") +
        K.field("cl-value", "Value", "", { type: "number", min: 0, mode: "decimal" }) + K.field("cl-due", "Due date", "", { type: "date" }) + "</div>" +
        '<div class="row" style="margin-top:.6rem"><button type="button" class="btn primary" id="cl-add" data-primary>Add</button><button type="button" class="btn small" id="cl-csv">Download (.csv)</button><button type="button" class="btn small ghost" id="cl-ics">Add due dates to calendar</button></div></section>' +
        '<div class="board stages">' + SC.FREE_STAGES.map(function (s) {
          var list = F.clients.filter(function (c) { return (c.stage || "lead") === s[0]; });
          return '<div class="col"><h3>' + E(s[1]) + ' <span class="fine">' + list.length + (p.by[s[0]].value ? " &middot; " + SC.money(p.by[s[0]].value) : "") + "</span></h3>" + list.map(function (c) {
            var late = c.due && c.due < today && (c.stage === "active" || c.stage === "proposal");
            return '<div class="acard' + (late ? " due" : "") + '" data-id="' + c.id + '"><b>' + E(c.name || "(no name)") + "</b><span>" + E(c.project) + "</span>" +
              '<div class="cols">' + K.field("ce-stage-" + c.id, "Stage", c.stage, { k: "stage", opts: SC.FREE_STAGES }) + K.field("ce-value-" + c.id, "Value", c.value, { k: "value", type: "number", min: 0 }) +
              K.field("ce-due-" + c.id, "Due", c.due, { k: "due", type: "date" }) + "</div>" + K.field("ce-notes-" + c.id, "Notes", c.notes, { k: "notes", area: true, rows: 2 }) +
              '<div class="row"><button type="button" class="btn small danger" data-del>Delete</button></div></div>';
          }).join("") + "</div>";
        }).join("") + "</div>";
    }
    draw();
    function onEdit(ev) {
      var el = ev.target, k = el.getAttribute("data-k"), card = el.closest("[data-id]"); if (!k || !card) return;
      var c = K.byId(F.clients, card.getAttribute("data-id")); if (!c) return;
      c[k] = k === "due" && !/^\d{4}-\d{2}-\d{2}$/.test(el.value) ? "" : el.value; saveSoon();
    }
    root.addEventListener("input", onEdit);
    root.addEventListener("change", function (ev) { onEdit(ev); var k = ev.target.getAttribute("data-k"); if (k === "stage" || k === "value" || k === "due") { SC.save(); draw(); } });
    root.addEventListener("click", function (ev) {
      var t = ev.target, card = t.closest("[data-id]"), c = card ? K.byId(F.clients, card.getAttribute("data-id")) : null;
      if (t.id === "cl-add") {
        var n = $("#cl-name").value.trim(); if (!n) { SC.toast("Name the client."); $("#cl-name").focus(); return; }
        var x = SC.blankClient({ name: n, project: $("#cl-project").value, value: $("#cl-value").value }), d = $("#cl-due").value; if (/^\d{4}-\d{2}-\d{2}$/.test(d)) x.due = d;
        F.clients.push(x); SC.save(); draw(); $("#cl-name").focus();
      } else if (t.id === "cl-csv") {
        var rows = [["Client", "Project", "Stage", "Value", "Due", "Notes"]].concat(F.clients.map(function (x) { return [x.name, x.project, (SC.FREE_STAGES.filter(function (s) { return s[0] === x.stage; })[0] || SC.FREE_STAGES[0])[1], x.value, x.due, x.notes]; }));
        SC.download("clients.csv", rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\r\n"), "text/csv");
      } else if (t.id === "cl-ics") K.calendar();
      else if (c && t.hasAttribute("data-del")) { if (!K.sure(t, "Click again to delete")) return; F.clients = F.clients.filter(function (x) { return x.id !== c.id; }); SC.save(); draw(); }
    });
  }

  function proposal(root) {
    var F = SC.S.free, P = F.prop, saveSoon = SC.debounce(SC.save, 300);
    if (!P.me && SC.S.resume.name) P.me = SC.S.resume.name;
    if (!P.rate) { var r = SC.freelanceRate(F); if (!r.error) P.rate = String(r.hourly); }
    root.innerHTML = head("proposal") + '<div class="two"><section class="card"><h2>Details</h2><div class="cols">' +
      K.field("p-client", "Client", P.client, { k: "client" }) + K.field("p-project", "Project", P.project, { k: "project" }) + K.field("p-me", "Your name or business", P.me, { k: "me" }) +
      K.field("p-hours", "Estimated hours", P.hours, { k: "hours", type: "number", min: 0 }) + K.field("p-rate", "Rate per hour", P.rate, { k: "rate", type: "number", min: 0 }) +
      K.field("p-deposit", "Deposit (%)", P.deposit == null ? "30" : P.deposit, { k: "deposit", type: "number", min: 0, max: 100 }) + K.field("p-days", "Working days to deliver", P.days, { k: "days", type: "number", min: 0 }) + "</div>" +
      K.field("p-scope", "What the client gets (one item per line)", P.scope, { k: "scope", area: true, rows: 4, ph: "Audit of the current order process\nNew pick-and-pack checklist\nOne training session for the team" }) + "</section>" +
      '<section class="card"><h2>Proposal</h2><pre class="script" id="p-out"></pre><div class="row"><button type="button" class="btn small primary" id="p-copy">Copy</button><button type="button" class="btn small" id="p-txt">Download .txt</button><button type="button" class="btn small" id="p-print">Print</button></div>' +
      '<p class="fine">A plain starting point, not a contract. For larger jobs, add what is out of scope, who owns the work, and how either side can end the agreement.</p></section></div>';
    function text() { return SC.proposalText(Object.assign({ cur: SC.S.cur }, P, { deposit: P.deposit == null ? "30" : P.deposit })); }
    function out() { $("#p-out").textContent = text(); }
    out();
    root.addEventListener("input", function (ev) { var k = ev.target.getAttribute("data-k"); if (!k) return; P[k] = ev.target.value; saveSoon(); out(); });
    root.addEventListener("click", function (ev) {
      var id = ev.target.id;
      if (id === "p-copy") SC.copy(text());
      else if (id === "p-txt") SC.download("proposal.txt", text());
      else if (id === "p-print") SC.printHTML('<div class="paper"><pre class="letter">' + E(text()) + "</pre></div>");
    });
  }
})();
