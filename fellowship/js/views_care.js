/* Stark Fellowship, by Stark: care visits (private notes only for roles holding the notes key) and help requests. */
(function () {
  "use strict";
  var A = window.FellowApp, K = StarkCore, B = StarkBooks, M = StarkCommunity, U = FellowUI, h = U.h, btn = U.btn, S = A.S;
  var vq = "", hstat = "";

  function peopleLabels() {
    var x = A.idx(), map = {}, seen = {};
    S.data.core.people.forEach(function (p) { var l = M.name(p) + " · " + ((x.h[p.hh] || {}).name || ""); if (seen[l]) l += " · #" + p.id.slice(0, 4); seen[l] = 1; map[l] = p.id; map["id:" + p.id] = l; });
    return map;
  }
  function canNotes() { return A.holds("notes"); }

  /* ---------- care ---------- */
  A.views.care = function () {
    var D = S.data.core, Cv = S.data.care, t = A.today(), x = A.idx(), root = h("div"), list = h("div"), timer;
    var due = M.followUps(Cv, t, 7), ns = M.notSeen(D, t, D.settings.notSeenWeeks), month = Cv.visits.filter(function (v) { return v.date.slice(0, 7) === t.slice(0, 7); }).length;
    root.appendChild(A.sec("Care", canNotes() ? "Visits, calls and follow-ups. Private care notes are encrypted with their own key, held only by the Leader and Care team roles." :
      "Visits, calls and follow-ups. Private care notes are not available to your role.", [btn("Log a visit", "primary", function () { visitForm(null); })]));
    root.appendChild(A.kpis([["visits this month", month], ["follow-ups due this week", due.length, null, due.length ? "warn" : "good"], ["not seen lately", ns.length]]));
    var cards = h("div", { class: "cards" });
    cards.appendChild(h("div", { class: "card" }, h("h2", { text: "Follow-ups due" }), due.length ? h("ul", { class: "plain" }, due.map(function (v) {
      return h("li", { class: "row wrap" }, h("span", { class: "grow" }, h("strong", { text: M.name(x.p[v.person]) }), " ", h("span", { class: "muted", text: (v.follow < t ? "overdue since " : "by ") + v.follow })),
        btn("Done", "small", function () { v.done = true; A.save("care"); A.log("Marked a care follow-up done"); A.render(); }, { "aria-label": "Mark follow-up for " + M.name(x.p[v.person]) + " done" }));
    })) : h("p", { class: "muted", text: "Nothing due this week." })));
    cards.appendChild(h("div", { class: "card" }, h("h2", { text: "Not seen lately" }), h("p", { class: "fine", text: "No check-in for " + D.settings.notSeenWeeks + " weeks or more (change this in Settings)." }),
      ns.length ? h("ul", { class: "plain" }, ns.slice(0, 12).map(function (r) {
        return h("li", { class: "row wrap" }, h("span", { class: "grow" }, h("strong", { text: M.name(r.person) }), " ", h("span", { class: "muted", text: r.last ? "last " + r.last : "never checked in" })),
          btn("Log a visit", "small", function () { visitForm(null, r.person.id); }, { "aria-label": "Log a visit with " + M.name(r.person) }));
      }), ns.length > 12 ? h("li", { class: "muted", text: "and " + (ns.length - 12) + " more" }) : null) : h("p", { class: "muted", text: "Everyone has been seen recently." })));
    root.appendChild(cards);
    root.appendChild(h("div", { class: "row wrap filter" }, h("input", { type: "search", id: "v-q", placeholder: "Search visits by name", value: vq, "aria-label": "Search visits",
      oninput: function (e) { vq = e.target.value; S.page.visits = 0; clearTimeout(timer); timer = setTimeout(draw, 150); } })));
    root.appendChild(list);
    function draw() {
      var w = vq.trim().toLowerCase(), rows = Cv.visits.filter(function (v) { return !w || M.name(x.p[v.person]).toLowerCase().indexOf(w) >= 0; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }), p0;
      U.clear(list);
      list.appendChild(A.pager("visits", rows.length, 40, draw) || h("span"));
      p0 = (S.page.visits || 0) * 40;
      list.appendChild(rows.length ? A.table(["Date", "Who", "Kind", "By", "Summary", "Follow-up", ""], rows.slice(p0, p0 + 40).map(function (v) {
        return h("tr", null, h("td", { text: v.date }), h("td", { text: M.name(x.p[v.person]) }), h("td", { text: v.kind }), h("td", { text: v.by }), h("td", { class: "wrap-any", text: v.summary }),
          h("td", { text: v.follow ? v.follow + (v.done ? " (done)" : "") : "" }), h("td", null, btn("Open", "small", function () { visitDlg(v); }, { "aria-label": "Open visit with " + M.name(x.p[v.person]) + " on " + v.date })));
      }), "visits") : A.empty("No visits logged yet."));
    }
    draw();
    return root;
  };
  function visitDlg(v) {
    var x = A.idx(), body = h("div", { class: "dlg-body" }), dlg, note = canNotes() ? S.data.notes.byVisit[v.id] : null;
    body.appendChild(h("dl", { class: "kv-list" }, [["Date", v.date], ["Kind", v.kind], ["By", v.by], ["Summary", v.summary], ["Follow-up", v.follow ? v.follow + (v.done ? " (done)" : "") : "none"]]
      .map(function (r) { return h("div", { class: "kv" }, h("dt", { text: r[0] }), h("dd", { text: r[1] })); })));
    if (canNotes()) body.appendChild(h("div", { class: "private-note" }, h("strong", { text: "Private care note" }), h("p", { text: note || "No private note." })));
    body.appendChild(h("div", { class: "row end" }, btn("Edit", "primary", function () { dlg.close(); visitForm(v); })));
    dlg = U.modal(M.name(x.p[v.person]) + ", " + v.date, body, { wide: true });
  }
  function visitForm(v, pid) {
    var labels = peopleLabels(), N = S.data.notes, fields = [
      { k: "person", label: "Who", req: true, max: 160, list: Object.keys(labels).filter(function (l) { return l.indexOf("id:") !== 0; }) },
      { k: "date", label: "Date", type: "date", req: true }, { k: "kind", label: "Kind", type: "select", options: M.CARE_KINDS }, { k: "by", label: "By", max: 80 },
      { k: "summary", label: "Summary", type: "textarea", wide: true, max: 500, help: "A short, factual line that the whole care team and Administrators can read." },
      { k: "follow", label: "Follow up by", type: "date" }, { k: "done", label: "Follow-up done", type: "checkbox" }];
    if (canNotes()) fields.push({ k: "note", label: "Private care note", type: "textarea", wide: true, rows: 5, max: 6000, help: "Encrypted with the private notes key. Only Leaders and the Care team can read it." });
    U.openForm(v ? "Edit visit" : "Log a visit", fields, v ? { person: labels["id:" + v.person], date: v.date, kind: v.kind, by: v.by, summary: v.summary, follow: v.follow, done: v.done, note: N && N.byVisit[v.id] }
      : { person: pid ? labels["id:" + pid] : "", date: A.today(), kind: "Home visit", by: A.me().replace(/ \(example\)$/, "") }, function (o) {
      var p = labels[o.person];
      if (!p) throw new Error("Pick the person from the list.");
      var saved = M.saveVisit(S.data.care, { id: v && v.id, person: p, date: o.date, kind: o.kind, by: o.by, summary: o.summary, follow: o.follow, done: o.done });
      if (canNotes()) { if (o.note) N.byVisit[saved.id] = o.note; else delete N.byVisit[saved.id]; A.save("notes"); }
      A.save("care"); A.log((v ? "Edited" : "Logged") + " a care visit"); A.render(); U.toast("Visit saved.");
    }, { del: v && A.can("care") ? function () { U.confirmBox("Delete this visit?", "Its private note is deleted too.", "Delete", true).then(function (ok) { if (ok) { M.removeVisit(S.data.care, N || null, v.id); A.save("care", "notes"); A.log("Deleted a care visit"); A.render(); } }); } : null });
  }

  /* ---------- help requests ---------- */
  A.views.help = function () {
    var H = S.data.help, t = A.today(), x = A.idx(), root = h("div"), tot = M.helpTotals(H, t.slice(0, 4));
    root.appendChild(A.sec("Help requests", "Requests for practical help from members and neighbours (sometimes called benevolence). This is a record: no money moves through this app.", [btn("New request", "primary", function () { reqForm(null); })]));
    root.appendChild(A.kpis([["requests this year", tot.count], ["open now", tot.open, null, tot.open ? "warn" : "good"], ["helped this year", tot.helped], ["given this year", B.fmt(tot.given), null, "small"]]));
    root.appendChild(h("div", { class: "row wrap filter" }, U.select("h-status", [["", "All requests"], ["open", "Open (new, reviewing, approved)"]].concat(M.HELP_STATUS.map(function (s) { return [s, s]; })), hstat, function (v) { hstat = v; A.render(); }, "Status")));
    var rows = H.requests.filter(function (r) { return !hstat || (hstat === "open" ? ["New", "Reviewing", "Approved"].indexOf(r.status) >= 0 : r.status === hstat); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    root.appendChild(rows.length ? A.table(["Date", "Who", "Need", "Asked", "Status", "Given", "Referred to", ""], rows.map(function (r) {
      return h("tr", null, h("td", { text: r.date }), h("td", { text: r.person ? M.name(x.p[r.person]) : r.name }), h("td", { text: r.need }), h("td", { class: "num", text: r.asked ? B.fmt(r.asked) : "" }),
        h("td", null, h("span", { class: "badge st-" + r.status.toLowerCase(), text: r.status })), h("td", { class: "num", text: r.given ? B.fmt(r.given) : "" }), h("td", { text: r.referral }),
        h("td", null, btn("Open", "small", function () { reqForm(r); }, { "aria-label": "Open help request from " + (r.person ? M.name(x.p[r.person]) : r.name) })));
    })) : A.empty("No help requests" + (hstat ? " with this status." : " yet.")));
    var needs = Object.keys(tot.byNeed);
    if (needs.length) root.appendChild(h("p", { class: "fine", text: "This year by need: " + needs.map(function (n) { return n + " " + tot.byNeed[n]; }).join(", ") + "." }));
    return root;
  };
  function reqForm(r) {
    var labels = peopleLabels(), G = A.holds("giving") ? S.data.giving : null, help = G && G.funds.filter(function (f) { return /help/i.test(f.name); })[0], fields = [
      { k: "person", label: "Person in the directory", max: 160, list: Object.keys(labels).filter(function (l) { return l.indexOf("id:") !== 0; }), help: "Or leave empty and type a neighbour's name below." },
      { k: "name", label: "Or a neighbour's name", max: 80 }, { k: "date", label: "Date asked", type: "date", req: true }, { k: "need", label: "Need", type: "select", options: M.NEEDS },
      { k: "asked", label: "Amount asked (if any)", type: "money" }, { k: "status", label: "Status", type: "select", options: M.HELP_STATUS },
      { k: "story", label: "What is needed", type: "textarea", wide: true, max: 2000 }, { k: "decided", label: "Decided on", type: "date" },
      { k: "given", label: "Amount given", type: "money" }, { k: "referral", label: "Referred to", max: 120, list: M.REFERRALS }, { k: "by", label: "Handled by", max: 80 }];
    if (help && !(r && r.entry)) fields.push({ k: "post", label: "Also record the amount given as spending from the " + help.name, type: "checkbox", wide: true });
    U.openForm(r ? "Help request" : "New help request", fields, r ? { person: r.person ? labels["id:" + r.person] : "", name: r.name, date: r.date, need: r.need, asked: r.asked ? (r.asked / 100).toFixed(2) : "", status: r.status, story: r.story, decided: r.decided, given: r.given ? (r.given / 100).toFixed(2) : "", referral: r.referral, by: r.by }
      : { date: A.today(), status: "New", need: "Food", by: A.me().replace(/ \(example\)$/, "") }, function (o) {
      var pid = o.person ? labels[o.person] : "";
      if (o.person && !pid) throw new Error("Pick the person from the list, or use the neighbour's name field.");
      if (o.post && help && !(o.given > 0)) throw new Error("Enter the amount given before recording it in the books.");
      var saved = M.saveRequest(S.data.help, { id: r && r.id, person: pid, name: pid ? "" : o.name, date: o.date, need: o.need, asked: o.asked, status: o.status, story: o.story, decided: o.decided, given: o.given, referral: o.referral, by: o.by, entry: r && r.entry });
      if (o.post && help) {
        saved.entry = B.spend(G, { date: o.decided || A.today(), fund: help.id, amount: saved.given, memo: "Help request: " + saved.need, kind: "help", ref: saved.id }).id;
        A.save("giving");
      }
      A.save("help"); A.log((r ? "Updated" : "Recorded") + " a help request"); A.render(); U.toast("Help request saved.");
    }, { del: r ? function () { U.confirmBox("Delete this request?", "Any spending already recorded in the books stays there.", "Delete", true).then(function (ok) { if (ok) { S.data.help.requests = S.data.help.requests.filter(function (y) { return y !== r; }); A.save("help"); A.log("Deleted a help request"); A.render(); } }); } : null });
  }
})();
