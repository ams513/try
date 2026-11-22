/* Stark Fellowship, by Stark: teams and rotas, gatherings and check-in. */
(function () {
  "use strict";
  var A = window.FellowApp, K = StarkCore, B = StarkBooks, M = StarkCommunity, U = FellowUI, h = U.h, btn = U.btn, S = A.S;
  var span = "28", teamF = "", evId = "", cq = "";

  function peopleList() { // "Name · Household" labels for pickers, current people only
    var x = A.idx(), map = {}, seen = {};
    S.data.core.people.forEach(function (p) {
      if (p.status === "Former") return;
      var l = M.name(p) + " · " + ((x.h[p.hh] || {}).name || "");
      if (seen[l]) l += " · #" + p.id.slice(0, 4);
      seen[l] = 1; map[l] = p.id;
    });
    return map;
  }
  function chip(text, onx, label) { return h("span", { class: "chip" }, text, onx ? h("button", { type: "button", class: "x", "aria-label": label, text: "×", onclick: onx }) : null); }

  /* ---------- teams and rotas ---------- */
  A.views.teams = function () {
    var D = S.data.core, t = A.today(), to = K.addDays(t, +span - 1), x = A.idx(), slots = M.slotsIn(D, t, to, teamF), cov = M.coverage(slots), cf = M.conflicts(D, slots), tn = {}, root = h("div");
    D.teams.forEach(function (q) { tn[q.id] = q.name; });
    root.appendChild(A.sec("Teams and rotas", "Volunteer teams and who serves when. Fill gaps fairly spreads turns evenly and skips anyone away or already serving at that time.", [
      btn("Add a slot", "primary", function () { slotForm(); }), btn("Add a team", "", function () { teamForm(null); }),
      btn("Fill gaps fairly", "", function () { var r = M.autoFill(D, t, to, teamF); A.save("core"); A.log("Filled " + r.added + " rota places"); A.render(); U.toast("Added " + r.added + " people. " + (r.gaps ? r.gaps + " places still open: add team members or change dates." : "Every slot is filled.")); }),
      btn("Export CSV", "", function () { U.downloadText("rota-" + t + ".csv", M.rotaCSV(D, slots), "text/csv"); }),
      btn("Print rota", "", function () { printRota(slots, tn, x, t, to); })]));
    root.appendChild(h("div", { class: "row wrap filter" },
      U.select("rota-span", [["14", "Next 2 weeks"], ["28", "Next 4 weeks"], ["56", "Next 8 weeks"]], span, function (v) { span = v; A.render(); }, "Range"),
      U.select("rota-team", [["", "All teams"]].concat(D.teams.map(function (q) { return [q.id, q.name]; })), teamF, function (v) { teamF = v; A.render(); }, "Team")));
    root.appendChild(A.kpis([["teams", D.teams.length], ["slots", slots.length], ["places to fill", cov.need], ["gaps", cov.gaps, null, cov.gaps ? "warn" : "good"], ["clashes", cf.length, null, cf.length ? "warn" : "good"]]));
    if (cf.length) root.appendChild(h("div", { class: "card alert" }, h("h2", { text: "Clashes" }), h("ul", { class: "plain" }, cf.map(function (c) {
      return h("li", { text: M.name(x.p[c.pid]) + (c.away ? " is away on " + c.a.date + " but is down for " + tn[c.a.team] + " (" + c.a.role + ")." : " is in two places at once on " + c.a.date + ": " + tn[c.a.team] + " " + c.a.start + " and " + tn[c.b.team] + " " + c.b.start + ".") });
    }))));
    var rows = slots.map(function (s) {
      var team = D.teams.filter(function (q) { return q.id === s.team; })[0] || { members: [] };
      var opts = [["", s.people.length >= s.need ? "Add another..." : "Add a person..."]].concat(team.members.filter(function (pid) { return x.p[pid] && s.people.indexOf(pid) < 0; }).map(function (pid) {
        var clash = M.isAway(D, pid, s.date) ? " (away)" : D.slots.some(function (o) { return o !== s && o.people.indexOf(pid) >= 0 && M.overlap(o, s); }) ? " (busy)" : "";
        return [pid, M.name(x.p[pid]) + clash];
      }));
      return h("tr", { class: s.people.length < s.need ? "gap" : "" }, h("td", { text: K.weekday(s.date).slice(0, 3) + " " + s.date }), h("td", { text: s.start + "-" + s.end }), h("td", { text: tn[s.team] || "" }), h("td", { text: s.role }),
        h("td", null, h("div", { class: "chips" }, s.people.map(function (pid) { return chip(M.name(x.p[pid]), function () { s.people = s.people.filter(function (y) { return y !== pid; }); A.save("core"); A.render(); }, "Remove " + M.name(x.p[pid]) + " from " + s.role); }),
          s.people.length < s.need ? h("span", { class: "badge soon", text: (s.need - s.people.length) + " needed" }) : null)),
        h("td", null, U.select("add-" + s.id, opts, "", function (v) { if (v) { s.people.push(v); A.save("core"); A.render(); } }, "Add a person to " + s.role + " on " + s.date)),
        h("td", null, h("div", { class: "row tight" }, btn("Repeat", "small", function () { repeatDlg(s); }, { "aria-label": "Repeat " + s.role + " weekly" }),
          btn("Remove", "small danger-o", function () { D.slots = D.slots.filter(function (y) { return y !== s; }); A.save("core"); A.render(); }, { "aria-label": "Remove slot " + s.role + " " + s.date }))));
    });
    root.appendChild(h("div", { class: "card" }, h("h2", { text: "Rota" }), slots.length ? A.table(["Date", "Time", "Team", "Role", "People", "Add", ""], rows, "rota") : A.empty("No slots in this range. Add a slot, then repeat it weekly.")));
    root.appendChild(h("h2", { text: "Teams" }));
    root.appendChild(D.teams.length ? h("div", { class: "cards" }, D.teams.map(function (tm) {
      return h("div", { class: "card" }, h("div", { class: "item-top" }, h("h3", { text: tm.name }), h("span", { class: "badge", text: tm.members.length + " people" })),
        h("p", { class: "fine", text: tm.lead && x.p[tm.lead] ? "Lead: " + M.name(x.p[tm.lead]) : "No lead yet" }),
        h("div", { class: "chips" }, tm.members.map(function (pid) { var away = (D.away[pid] || []).filter(function (d) { return d >= t; }); return chip(M.name(x.p[pid]) + (away.length ? " (away " + away.length + ")" : "")); })),
        h("div", { class: "row tight" }, btn("Edit team", "small", function () { teamForm(tm); }), btn("Away dates", "small", function () { awayDlg(tm); })));
    })) : A.empty("No teams yet. Add your first team, for example a welcome team."));
    return root;
  };
  function teamForm(tm) {
    var D = S.data.core, x = A.idx(), labels = peopleList(), members = tm ? tm.members.slice() : [], list = h("div", { class: "chips" }), dlg;
    var name = h("input", { id: "tm-name", type: "text", maxlength: 60, value: tm ? tm.name : "" }), lead = h("select", { id: "tm-lead" });
    var pick = h("input", { id: "tm-add", type: "text", list: "tm-people", placeholder: "Type a name", autocomplete: "off" }), err = h("p", { class: "form-err", role: "alert", hidden: true });
    function draw() {
      U.clear(list); U.clear(lead); lead.appendChild(h("option", { value: "", text: "No lead" }));
      members.forEach(function (pid) { list.appendChild(chip(M.name(x.p[pid]), function () { members = members.filter(function (y) { return y !== pid; }); draw(); }, "Remove " + M.name(x.p[pid]))); lead.appendChild(h("option", { value: pid, text: M.name(x.p[pid]), selected: tm && tm.lead === pid })); });
    }
    function add() { var pid = labels[pick.value.trim()]; if (!pid) { err.hidden = false; err.textContent = "Pick a name from the list."; return; } if (members.indexOf(pid) < 0) members.push(pid); pick.value = ""; err.hidden = true; draw(); pick.focus(); }
    pick.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } });
    dlg = U.modal(tm ? "Edit team" : "Add a team", h("div", { class: "dlg-body form" },
      h("div", { class: "field" }, h("label", { for: "tm-name", text: "Team name *" }), name),
      h("div", { class: "field" }, h("label", { for: "tm-add", text: "Add a member" }), h("div", { class: "row tight" }, pick, btn("Add", "small", add)), h("datalist", { id: "tm-people" }, Object.keys(labels).map(function (l) { return h("option", { value: l }); }))),
      list, h("div", { class: "field" }, h("label", { for: "tm-lead", text: "Team lead" }), lead), err,
      h("div", { class: "row end" }, tm ? btn("Delete team", "danger-o push", function () {
        U.confirmBox("Delete " + tm.name + "?", "Its rota slots are removed too.", "Delete", true).then(function (ok) { if (ok) { D.teams = D.teams.filter(function (y) { return y !== tm; }); D.slots = D.slots.filter(function (s) { return s.team !== tm.id; }); A.log("Deleted team " + tm.name); dlg.close(); A.render(); } });
      }) : null, btn("Cancel", "", function () { dlg.close(); }), btn("Save", "primary", function () {
        var n = name.value.trim();
        if (!n) { err.hidden = false; err.textContent = "Enter a team name."; return; }
        var t2 = tm || { id: K.uid(), name: "", lead: "", members: [] };
        t2.name = n.slice(0, 60); t2.members = members; t2.lead = members.indexOf(lead.value) >= 0 ? lead.value : "";
        if (!tm) D.teams.push(t2);
        A.log((tm ? "Edited team " : "Added team ") + t2.name); dlg.close(); A.render();
      }))), { wide: true });
    draw(); name.focus();
  }
  function slotForm() {
    var D = S.data.core;
    if (!D.teams.length) return U.toast("Add a team first.", true);
    U.openForm("Add a rota slot", [
      { k: "team", label: "Team", type: "select", options: D.teams.map(function (q) { return [q.id, q.name]; }), keep: true }, { k: "role", label: "Role", max: 60, ph: "For example: Door and welcome", keep: true },
      { k: "date", label: "Date", type: "date", req: true, keep: true }, { k: "need", label: "People needed", type: "select", options: ["1", "2", "3", "4", "5", "6", "8", "10"], keep: true },
      { k: "start", label: "Start", type: "time", req: true, keep: true }, { k: "end", label: "End", type: "time", req: true, keep: true },
      { k: "weeks", label: "Repeat weekly for", type: "select", options: [["0", "No repeat"], ["3", "3 more weeks"], ["7", "7 more weeks"], ["11", "11 more weeks"], ["25", "25 more weeks"]] }
    ], { team: teamF || D.teams[0].id, date: A.today(), start: "10:00", end: "11:30", need: "2", weeks: "0" }, function (v) {
      var s = M.addSlot(D, { team: v.team, date: v.date, start: v.start, end: v.end, role: v.role, need: +v.need }), extra = M.repeatWeekly(D, s, +v.weeks);
      A.log("Added " + (1 + extra.length) + " rota slots"); A.render();
    });
  }
  function repeatDlg(s) {
    U.openForm("Repeat weekly", [{ k: "weeks", label: "Add the same slot for", type: "select", options: [["1", "1 more week"], ["3", "3 more weeks"], ["7", "7 more weeks"], ["11", "11 more weeks"]] }], { weeks: "3" }, function (v) {
      var made = M.repeatWeekly(S.data.core, s, +v.weeks); A.log("Repeated a rota slot " + made.length + " times"); A.render(); U.toast("Added " + made.length + " weekly slots.");
    }, { intro: s.role + ", " + s.start + "-" + s.end + ", from " + s.date + ". New slots start empty." });
  }
  function awayDlg(tm) {
    var D = S.data.core, x = A.idx(), body = h("div", { class: "dlg-body" }), t = A.today();
    function draw() {
      U.clear(body);
      body.appendChild(h("p", { class: "fine", text: "Dates someone cannot serve. Fill gaps fairly skips them, and the rota warns if they are already down for that day." }));
      tm.members.forEach(function (pid) {
        var d = h("input", { type: "date", id: "away-" + pid, "aria-label": "Away date for " + M.name(x.p[pid]), min: t });
        body.appendChild(h("div", { class: "away-row" }, h("strong", { text: M.name(x.p[pid]) }),
          h("div", { class: "chips" }, (D.away[pid] || []).filter(function (y) { return y >= t; }).map(function (y) { return chip(y, function () { D.away[pid] = D.away[pid].filter(function (z) { return z !== y; }); A.save("core"); draw(); }, "Remove away date " + y); })),
          h("div", { class: "row tight" }, d, btn("Add", "small", function () { if (!K.isDate(d.value)) return; D.away[pid] = (D.away[pid] || []).filter(function (z) { return z >= t && z !== d.value; }).concat([d.value]).sort(); A.save("core"); draw(); }))));
      });
    }
    draw(); U.modal(tm.name + ": away dates", body, { wide: true, onclose: function () { A.render(); } });
  }
  function printRota(slots, tn, x, from, to) {
    var doc = A.paper("Rota", from + " to " + to), body = h("tbody");
    slots.forEach(function (s) { body.appendChild(h("tr", null, h("td", { text: K.weekday(s.date) + " " + s.date }), h("td", { text: s.start + "-" + s.end }), h("td", { text: tn[s.team] }), h("td", { text: s.role }), h("td", { text: s.people.map(function (pid) { return M.name(x.p[pid]); }).join(", ") + (s.people.length < s.need ? " (" + (s.need - s.people.length) + " needed)" : "") }))); });
    doc.appendChild(h("div", { class: "tbl" }, h("table", null, h("thead", null, h("tr", null, ["Date", "Time", "Team", "Role", "People"].map(function (y) { return h("th", { text: y }); }))), body)));
    U.printDoc(doc);
  }

  /* ---------- gatherings and check-in ---------- */
  A.views.checkin = function () {
    var D = S.data.core, t = A.today(), x = A.idx(), root = h("div");
    var evs = D.events.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var ev = D.events.filter(function (e) { return e.id === evId; })[0] || evs.filter(function (e) { return e.date === t; })[0] || null;
    if (ev) evId = ev.id;
    root.appendChild(A.sec("Check-in", "Tap a name to check someone in; tap again to undo. Children get a pickup code to match when they are collected. For name labels and pickup slips, use the Children screen.", [btn("New gathering", ev ? "" : "primary", newEvent)]));
    root.appendChild(h("div", { class: "row wrap filter" }, h("label", { for: "ev-pick", text: "Gathering" }),
      U.select("ev-pick", [["", "Choose a gathering..."]].concat(evs.slice(0, 60).map(function (e) { return [e.id, e.date + " · " + e.name + (e.date === t ? " (today)" : "")]; })), ev ? ev.id : "", function (v) { evId = v; cq = ""; A.render(); })));
    if (!ev) { root.appendChild(A.empty("No gathering chosen. Start today's gathering to begin checking people in.", btn("Start today's gathering", "primary", newEvent))); root.appendChild(trendCard(D, t)); return root; }
    var c = M.counts(D, ev, x);
    var results = h("ul", { class: "plain ci-results", id: "ci-results" }), found0 = h("p", { class: "sr-only", role: "status" }); // only the count is announced
    var box = h("input", { id: "ci-q", type: "search", class: "big-search", placeholder: "Type a name or household", value: cq, autocomplete: "off", "aria-label": "Find a person to check in",
      oninput: function (e) { cq = e.target.value; drawResults(); } });
    function drawResults() {
      U.clear(results);
      if (cq.trim().length < 2) { results.appendChild(h("li", { class: "muted", text: "Type at least two letters." })); return; }
      var found = M.search(D, null, cq, {}).slice(0, 12), shownHH = {};
      if (!found.length) results.appendChild(h("li", { class: "muted", text: "Nobody matches. Add them as a guest below." }));
      found0.textContent = found.length ? found.length + (found.length === 1 ? " match" : " matches") : "Nobody matches.";
      found.forEach(function (p) {
        var inn = ev.ins[p.id];
        results.appendChild(h("li", { class: "ci-row" + (inn ? " in" : "") },
          h("button", { type: "button", class: "btn ci-btn " + (inn ? "good" : "primary"), "aria-pressed": inn ? "true" : "false", "aria-label": (inn ? "Undo check-in for " : "Check in ") + M.name(p), onclick: function () { toggle(p.id); } },
            h("strong", { text: M.name(p) }), h("span", { text: inn ? "Checked in" + (inn.code ? " · code " + inn.code : "") : (x.h[p.hh] || {}).name || "" })),
          !shownHH[p.hh] && (x.members[p.hh] || []).length > 1 ? btn("Whole household", "small", function () { var r = M.checkInHousehold(D, ev, p.hh); A.save("core"); A.render(); U.toast("Checked in " + r.added + (r.codes.length ? ". Pickup codes: " + r.codes.map(function (q) { return q.name + " " + q.code; }).join(", ") : ".")); }, { "aria-label": "Check in the whole " + (x.h[p.hh] || {}).name + " household" }) : null));
        shownHH[p.hh] = 1;
      });
    }
    function toggle(pid) { var r = M.checkIn(D, ev, pid); if (r.error) return U.toast(r.error, true); A.save("core"); A.render(); U.toast(r.undone ? "Undone: " + M.name(r.person) : "Checked in " + M.name(r.person) + (r.code ? ". Pickup code " + r.code : ".")); var b = U.$("#ci-q"); if (b) b.focus(); }
    var guest = h("input", { id: "ci-guest", type: "text", maxlength: 80, placeholder: "Guest's name", autocomplete: "off", "aria-label": "Guest's name" });
    root.appendChild(h("div", { class: "card" }, h("h2", { text: ev.name + ", " + K.weekday(ev.date) + " " + ev.date + (ev.start ? " at " + ev.start : "") }), box, found0, results,
      h("form", { class: "row tight guest-row", onsubmit: function (e) { e.preventDefault(); var r = M.addGuest(ev, guest.value); if (r.error) return U.toast(r.error, true); A.save("core"); A.render(); U.toast("Welcome, " + r.guest.name + "."); } },
        guest, h("button", { type: "submit", class: "btn", text: "Add a guest" }))));
    root.appendChild(A.kpis([["checked in", c.members], ["children", c.children], ["guests", c.guests], ["total", c.total]]));
    var inList = Object.keys(ev.ins).map(function (pid) { return { pid: pid, at: ev.ins[pid].at, code: ev.ins[pid].code, out: ev.ins[pid].out }; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    root.appendChild(h("div", { class: "card" }, h("h2", { text: "Here now (" + c.total + ")" }),
      inList.length || ev.guests.length ? h("ul", { class: "plain here" }, inList.slice(0, 200).map(function (r) {
        return h("li", null, h("span", { text: M.name(x.p[r.pid]) }), r.code ? h("span", { class: "code", text: r.code, title: "Pickup code" }) : null, h("span", { class: "muted", text: A.hm(r.at) }), r.out ? h("span", { class: "tag", text: "collected " + A.hm(r.out) }) : null, btn("Undo", "small", function () { toggle(r.pid); }, { "aria-label": "Undo check-in for " + M.name(x.p[r.pid]) }));
      }), ev.guests.map(function (g) { return h("li", null, h("span", { text: g.name }), h("span", { class: "tag", text: "guest" }), btn("Remove", "small", function () { ev.guests = ev.guests.filter(function (y) { return y !== g; }); A.save("core"); A.render(); }, { "aria-label": "Remove guest " + g.name })); })) : A.empty("Nobody checked in yet."),
      inList.length > 200 ? h("p", { class: "fine", text: "Showing the latest 200." }) : null,
      h("div", { class: "row wrap" }, c.children ? btn("Pickup check", "small primary", function () { pickupDialog(D, ev); }) : null, btn("Export attendance CSV", "small", function () {
        U.downloadText("attendance-" + ev.date + ".csv", M.attendanceCSV(D, ev), "text/csv");
      }), A.can("teams") ? btn("Delete this gathering", "small danger-o", function () {
        U.confirmBox("Delete " + ev.name + " on " + ev.date + "?", "Its check-ins are removed too.", "Delete", true).then(function (ok) { if (ok) { D.events = D.events.filter(function (y) { return y !== ev; }); evId = ""; A.log("Deleted gathering " + ev.name + " " + ev.date); A.render(); } });
      }) : null)));
    root.appendChild(trendCard(D, t));
    drawResults();
    setTimeout(function () { var b = U.$("#ci-q"); if (b && document.activeElement === document.body) b.focus(); }, 0);
    return root;
  };
  /* ---------- pickup check: the collecting adult's code must match; five wrong codes lock the screen for five minutes ---------- */
  var guards = A.pickupGuards = {};
  function pickupDialog(D, ev) {
    var g = guards[ev.id] = guards[ev.id] || {}, err = U.errBox(), out = h("div", { "aria-live": "polite" }), dlg;
    var inp = h("input", { id: "pick-code", type: "text", class: "pick-code", maxlength: 10, autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-describedby": "pick-help" });
    function show() {
      var st = M.pickupGuard(g, Date.now());
      inp.disabled = st.locked;
      U.fieldError(err, st.locked ? "Locked for " + st.wait + " minute" + (st.wait === 1 ? "" : "s") + " after five codes that did not match. Ask a team lead to check the adult in person." : "", null, [inp]);
      return st;
    }
    var form = h("form", { class: "form dlg-body", novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var st = show(), r, left;
      if (st.locked) return;
      U.clear(out);
      r = M.findPickup(D, ev, inp.value);
      if (!r || !r.person) {
        left = M.pickupMiss(g, Date.now());
        out.appendChild(h("div", { class: "pick-result no" }, h("strong", { text: "No match." }), " No child at this gathering has that code."));
        if (left.locked) show(); else U.fieldError(err, left.left + " tr" + (left.left === 1 ? "y" : "ies") + " left before this screen locks.", inp, [inp]);
        inp.select(); return;
      }
      M.pickupHit(g); U.fieldError(err, "", null, [inp]);
      var x = A.idx();
      out.appendChild(h("div", { class: "pick-result ok" }, h("strong", { text: "Match: " + M.name(r.person) }), h("p", { class: "muted", text: ((x.h[r.person.hh] || {}).name || "") + ". Checked in at " + A.hm(r.at) + "." }),
        r.out ? h("p", { class: "warn-text", text: "Already marked collected at " + A.hm(r.out) + "." }) :
          btn("Mark as collected", "primary", function () { M.markCollected(ev, r.pid, null, A.me()); A.save("core"); U.toast(M.name(r.person) + " marked collected."); inp.value = ""; U.clear(out); inp.focus(); })));
    } },
      h("p", { class: "fine", id: "pick-help", text: "Type the code the collecting adult shows you. Codes are six characters; capitals and spaces do not matter. This is a convenience, not a safeguarding system: follow your own policy." }),
      h("div", { class: "field wide" }, h("label", { for: "pick-code", text: "Pickup code" }), inp), err, out,
      h("div", { class: "row end" }, btn("Close", "", function () { dlg.close(); }), h("button", { type: "submit", class: "btn primary", text: "Check code" })));
    dlg = U.modal("Pickup check: " + ev.name, form, { onclose: function () { A.render(); } });
    show(); if (!inp.disabled) inp.focus();
  }
  function trendCard(D, t) {
    var tr = M.trend(D, t, 12).reverse();
    return h("div", { class: "card" }, h("h2", { text: "Recent attendance" }), tr.length ? A.table(["Date", "Gathering", "Attended"], tr.map(function (r) {
      return h("tr", null, h("td", { text: K.weekday(r.event.date).slice(0, 3) + " " + r.event.date }), h("td", { text: r.event.name }), h("td", { class: "num", text: String(r.total) }));
    })) : A.empty("No gatherings yet."));
  }
  function newEvent() {
    U.openForm("New gathering", [{ k: "name", label: "Name", req: true, max: 80, list: M.GATHERINGS }, { k: "kind", label: "Kind", type: "select", options: M.GATHERINGS },
      { k: "date", label: "Date", type: "date", req: true }, { k: "start", label: "Start time", type: "time" }],
    { name: "Weekly gathering", kind: "Weekly gathering", date: A.today(), start: "" }, function (v) {
      var e = M.addEvent(S.data.core, v); evId = e.id; cq = ""; A.log("Started gathering " + e.name + " " + e.date); A.render();
    });
  }
})();
