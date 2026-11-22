/* Stark Fellowship, by Stark: the households-and-members directory. */
(function () {
  "use strict";
  var A = window.FellowApp, K = StarkCore, B = StarkBooks, M = StarkCommunity, U = FellowUI, h = U.h, btn = U.btn, S = A.S;
  var PER = 50, q = "", status = "", mode = "people", timer;

  function C() { return A.holds("contact") ? S.data.contact : null; }
  function addrLine(a) { return a ? [a.addr1, a.addr2, [a.city, a.region].filter(Boolean).join(", "), a.postal].filter(Boolean).join(", ") : ""; }
  // Household labels for the picker: the name plus the street (or member names) so look-alike households stay distinct.
  function hhLabels() {
    var x = A.idx(), seen = {}, map = {}, c = C();
    S.data.core.households.forEach(function (hh) {
      var a = c && c.hh[hh.id], l = hh.name + (a && a.addr1 ? " · " + a.addr1 : "");
      if (seen[l]) l += " · #" + hh.id.slice(0, 4);
      seen[l] = 1; map[l] = hh.id; map["id:" + hh.id] = l;
    });
    map.x = x; return map;
  }

  A.views.people = function () {
    var D = S.data.core, root = h("div"), st = M.stats(D), list = h("div", { id: "dir-list" }), acts = [];
    if (A.can("edit")) acts.push(btn("Add a person", "primary", function () { personForm(null); }), btn("Import", "", importDlg));
    if (C()) acts.push(btn("Export CSV", "", exportCSV), btn("Print directory", "", printDir));
    root.appendChild(A.sec("Directory", st.people + " people in " + st.households + " households" + (C() ? "" : ". Contact details are hidden for your role."), acts));
    root.appendChild(A.kpis([["members", st.byStatus.Member || 0], ["regular attenders", st.byStatus["Regular attender"] || 0], ["visitors and friends", (st.byStatus.Visitor || 0) + (st.byStatus.Friend || 0)], ["children", st.children]]));
    var search = h("input", { id: "dir-q", type: "search", placeholder: C() ? "Search names, households, email or phone" : "Search names or households", value: q, "aria-label": "Search the directory", autocomplete: "off",
      oninput: function (e) { q = e.target.value; S.page.dir = 0; clearTimeout(timer); timer = setTimeout(draw, 120); } });
    root.appendChild(h("div", { class: "row wrap filter" }, search,
      U.select("dir-status", [["", "Current (not former)"]].concat(M.STATUSES.map(function (s) { return [s, s]; })).concat([["all", "Everyone"]]), status, function (v) { status = v; S.page.dir = 0; draw(); }, "Status"),
      U.select("dir-mode", [["people", "People"], ["households", "Households"]], mode, function (v) { mode = v; S.page.dir = 0; draw(); }, "Show")));
    root.appendChild(list);
    function draw() {
      var c = C(), x = A.idx(), res = M.search(D, c, q, { status: status }), p0, rows;
      U.clear(list);
      if (mode === "households") {
        var seen = {}, hhs = [];
        res.forEach(function (p) { if (!seen[p.hh] && x.h[p.hh]) { seen[p.hh] = 1; hhs.push(x.h[p.hh]); } });
        hhs.sort(function (a, b) { return a.name.localeCompare(b.name); });
        list.appendChild(A.pager("dir", hhs.length, PER, draw) || h("span"));
        p0 = (S.page.dir || 0) * PER;
        rows = hhs.slice(p0, p0 + PER).map(function (hh) {
          return h("tr", null, h("td", null, h("button", { type: "button", class: "linkish", text: hh.name, onclick: function () { householdDlg(hh.id); } })),
            h("td", { text: x.members[hh.id].map(function (p) { return p.pref || p.first; }).join(", ") }), c ? h("td", { text: addrLine(c.hh[hh.id]) }) : null);
        });
        list.appendChild(hhs.length ? A.table(["Household", "Members"].concat(c ? ["Address"] : []), rows) : A.empty("No households match."));
        return;
      }
      list.appendChild(A.pager("dir", res.length, PER, draw) || h("span"));
      p0 = (S.page.dir || 0) * PER;
      rows = res.slice(p0, p0 + PER).map(function (p) {
        var cp = c && c.people[p.id];
        return h("tr", null, h("td", null, h("button", { type: "button", class: "linkish", text: p.last + ", " + (p.pref || p.first), onclick: function () { personDlg(p.id); } }), p.kind === "Child" ? h("span", { class: "tag", text: "child" }) : null),
          h("td", null, h("button", { type: "button", class: "linkish muted", text: (x.h[p.hh] || {}).name || "", onclick: function () { householdDlg(p.hh); } })),
          h("td", { text: p.status }), c ? h("td", { text: (cp && cp.phone) || "" }) : null, c ? h("td", { class: "wrap-any", text: (cp && cp.email) || "" }) : null);
      });
      list.appendChild(res.length ? A.table(["Name", "Household", "Status"].concat(c ? ["Phone", "Email"] : []), rows) : A.empty(q ? "Nobody matches \"" + q + "\"." : "No people yet. Add a person or import a list."));
    }
    draw();
    return root;
  };

  function personDlg(pid) {
    var D = S.data.core, x = A.idx(), p = x.p[pid], c = C(), cp = (c && c.people[pid]) || {}, t = A.today(), seen = M.lastSeen(D)[pid], body = h("div", { class: "dlg-body" }), dlg, kv = [];
    if (!p) return;
    kv.push(["Household", (x.h[p.hh] || {}).name], ["Status", p.status + (p.kind === "Child" ? ", child" : "")], ["Last checked in", seen || "not yet"]);
    if (c) kv.push(["Phone", cp.phone], ["Email", cp.email], ["Address", addrLine(c.hh[p.hh])], ["Birth date", cp.dob], ["Joined", cp.joined], ["Notes", cp.notes], ["Printed directory", cp.listed === false ? "Not listed" : "Listed"]);
    var teams = D.teams.filter(function (tm) { return tm.members.indexOf(pid) >= 0; }).map(function (tm) { return tm.name + (tm.lead === pid ? " (lead)" : ""); });
    kv.push(["Teams", teams.join(", ") || "none"]);
    if (A.holds("giving")) {
      var y = t.slice(0, 4), gv = B.totals(S.data.giving, y + "-01-01", y + "-12-31");
      kv.push(["Given in " + y, B.fmt((gv.byGiver["p:" + pid] || 0)) + " personally, " + B.fmt(gv.byGiver["h:" + p.hh] || 0) + " as a household"]);
    }
    if (A.can("care")) kv.push(["Care visits", String(S.data.care.visits.filter(function (v) { return v.person === pid; }).length)]);
    body.appendChild(h("dl", { class: "kv-list" }, kv.filter(function (r) { return r[1]; }).map(function (r) { return h("div", { class: "kv" }, h("dt", { text: r[0] }), h("dd", { text: r[1] })); })));
    body.appendChild(h("div", { class: "row end" },
      A.can("users") ? btn("Delete", "danger-o push", function () { dlg.close(); removePerson(p); }) : null,
      btn("Household", "", function () { dlg.close(); householdDlg(p.hh); }),
      A.can("edit") ? btn("Edit", "primary", function () { dlg.close(); personForm(p); }) : null));
    dlg = U.modal(M.name(p), body, { wide: true });
  }
  function personForm(p, hhPreset) {
    personForm.ok = false;
    var D = S.data.core, c = C(), cp = (p && c && c.people[p.id]) || { listed: true }, labels = hhLabels(), cur = p ? labels["id:" + p.hh] : hhPreset ? labels["id:" + hhPreset] : "";
    var fields = [
      { k: "first", label: "First name", req: true, max: 60 }, { k: "last", label: "Last name", req: true, max: 60 },
      { k: "pref", label: "Preferred name", max: 60, help: "Optional. Shown instead of the first name." },
      { k: "hh", label: "Household", max: 160, list: Object.keys(labels).filter(function (l) { return l.indexOf("id:") !== 0 && l !== "x"; }), help: "Pick a household, or type a new name to start one. Leave empty for a new household under the last name." },
      { k: "kind", label: "Adult or child", type: "select", options: M.KINDS }, { k: "status", label: "Status", type: "select", options: M.STATUSES }];
    if (c) fields.push({ k: "phone", label: "Phone", type: "tel", max: 40 }, { k: "email", label: "Email", type: "email", max: 120 }, { k: "dob", label: "Birth date", type: "date" },
      { k: "joined", label: "Joined", type: "date" }, { k: "notes", label: "General notes", type: "textarea", wide: true, max: 600, help: "Practical notes only, for example food allergies for shared meals. Private care notes belong in Care." },
      { k: "listed", label: "Include in the printed directory", type: "checkbox" });
    U.openForm(p ? "Edit " + M.name(p) : "Add a person", fields, {
      first: p && p.first, last: p && p.last, pref: p && p.pref, hh: cur, kind: p ? p.kind : "Adult", status: p ? p.status : "Member",
      phone: cp.phone, email: cp.email, dob: cp.dob, joined: cp.joined, notes: cp.notes, listed: cp.listed !== false
    }, function (v) {
      var hid = labels[v.hh] || "new", saved, dup;
      if (!p && (dup = M.dupes(D, v.first, v.last)).length && !personForm.ok) { personForm.ok = true; throw new Error(M.name(dup[0]) + " is already in the directory. Save again to add another person with this name."); }
      personForm.ok = false;
      saved = M.savePerson(D, { id: p && p.id, hh: hid, hhName: v.hh || (v.last + " household"), first: v.first, last: v.last, pref: v.pref, kind: v.kind, status: v.status });
      if (p && p.hh !== saved.hh && !D.people.some(function (q2) { return q2.hh === p.hh; })) { D.households = D.households.filter(function (x) { return x.id !== p.hh; }); if (c) delete c.hh[p.hh]; }
      if (c) { c.people[saved.id] = { phone: v.phone, email: v.email, dob: v.dob, joined: v.joined, notes: v.notes, listed: !!v.listed }; A.save("contact"); }
      A.log((p ? "Edited " : "Added ") + M.name(saved));
      A.render(); U.toast((p ? "Saved " : "Added ") + M.name(saved) + ".");
    });
  }
  function removePerson(p) {
    U.confirmBox("Delete " + M.name(p) + "?", "This removes them from the directory, teams and rotas. Gifts and care visits they appear in are kept for the record and show \"Removed person\". To keep them on file, set their status to Former instead.", "Delete", true).then(function (ok) {
      if (!ok) return;
      M.removePerson(S.data.core, C(), p.id); A.save("contact"); A.log("Deleted " + M.name(p) + " from the directory"); A.render();
    });
  }
  function householdDlg(hid) {
    var D = S.data.core, x = A.idx(), hh = x.h[hid], c = C(), a = (c && c.hh[hid]) || {}, body = h("div", { class: "dlg-body" }), dlg;
    if (!hh) return;
    if (c) body.appendChild(h("dl", { class: "kv-list" }, [["Address", addrLine(a)], ["Phone", a.phone], ["Email", a.email]].filter(function (r) { return r[1]; })
      .map(function (r) { return h("div", { class: "kv" }, h("dt", { text: r[0] }), h("dd", { text: r[1] })); })));
    body.appendChild(h("h3", { class: "sub", text: "Members" }));
    body.appendChild(h("ul", { class: "plain" }, (x.members[hid] || []).map(function (p) {
      return h("li", null, h("button", { type: "button", class: "linkish", text: M.name(p), onclick: function () { dlg.close(); personDlg(p.id); } }), " ", h("span", { class: "muted", text: p.status + (p.kind === "Child" ? ", child" : "") }));
    })));
    body.appendChild(h("div", { class: "row end" }, A.can("edit") ? btn("Add a person here", "", function () { dlg.close(); personForm(null, hid); }) : null,
      A.can("edit") ? btn("Edit household", "primary", function () { dlg.close(); householdForm(hh); }) : null));
    dlg = U.modal(hh.name, body, { wide: true });
  }
  function householdForm(hh) {
    var c = C(), a = (c && c.hh[hh.id]) || {}, f = [{ k: "name", label: "Household name", req: true, max: 80, wide: true, help: "For example: Okafor, Chidi and Ada" }];
    if (c) f.push({ k: "addr1", label: "Address", max: 120 }, { k: "addr2", label: "Address line 2", max: 120 }, { k: "city", label: "Town or city", max: 60 }, { k: "region", label: "State or region", max: 60 },
      { k: "postal", label: "Postal code", max: 20 }, { k: "phone", label: "Household phone", type: "tel", max: 40 }, { k: "email", label: "Household email", type: "email", max: 120 });
    f.push({ k: "careOnLabel", label: "The family agrees: print each child's General note (for example an allergy) on the child's name label", type: "checkbox", wide: true });
    U.openForm("Edit household", f, { careOnLabel: hh.careOnLabel === true, name: hh.name, addr1: a.addr1, addr2: a.addr2, city: a.city, region: a.region, postal: a.postal, phone: a.phone, email: a.email }, function (v) {
      hh.name = v.name.slice(0, 80);
      if (v.careOnLabel) hh.careOnLabel = true; else delete hh.careOnLabel;
      if (c) { c.hh[hh.id] = { addr1: v.addr1, addr2: v.addr2, city: v.city, region: v.region, postal: v.postal, phone: v.phone, email: v.email }; A.save("contact"); }
      A.log("Edited household " + hh.name); A.render();
    });
  }
  function importDlg() {
    var c = C(), ta = h("textarea", { id: "imp-text", rows: 8, placeholder: "First name,Last name,Household,Email,Phone,Address,City,State,Zip\nAda,Okafor,\"Okafor, Chidi and Ada\",ada@example.org,555-0100,12 Mill Lane,Riverside,ST,00000", "aria-label": "Spreadsheet rows to import" });
    var res = h("p", { class: "fine", role: "status" }), dlg;
    dlg = U.modal("Import people", h("div", { class: "dlg-body form" },
      h("p", { class: "fine", text: "Copy rows from a spreadsheet (with the header row) and paste them here, or choose a CSV file. Recognised columns: First name, Last name, Preferred name, Household, Status, Adult or child, Phone, Email, Address, Address 2, City, State or region, Postal code, Birth date (YYYY-MM-DD), Joined. Rows with the same Household join one household; without a Household column, the same last name and address do." }),
      c ? null : h("p", { class: "warn-text", text: "Your role cannot see contact details, so only names, households and status are imported." }),
      ta, res, h("div", { class: "row end" }, btn("Choose a CSV file", "", function () { U.pickFile(".csv,.tsv,.txt,text/csv", 20 * 1024 * 1024).then(function (f) { if (f && f.text != null) { ta.value = f.text; res.textContent = "Loaded " + f.name + "."; } else if (f) res.textContent = "That file is too big or could not be read."; }); }),
        btn("Import", "primary", function () {
          try {
            var r = M.importCSV(S.data.core, c, ta.value);
            if (c) A.save("contact");
            A.log("Imported " + r.added + " people");
            dlg.close(); A.render();
            U.toast("Imported " + r.added + " people in " + r.households + " new households" + (r.dupes ? ". " + r.dupes + " may be duplicates: search to check." : ".") + (r.skipped.length ? " Skipped " + r.skipped.length + "." : ""));
          } catch (x) { res.textContent = x.message; }
        }))), { wide: true });
  }
  function exportCSV() {
    U.confirmBox("Export the directory?", "The CSV file is not encrypted. Anyone who opens it can read names, addresses, phones and emails. Delete it when you are done.", "Export CSV").then(function (ok) {
      if (ok) { U.downloadText("directory-" + A.today() + ".csv", M.directoryCSV(S.data.core, C()), "text/csv"); A.log("Exported the directory as CSV"); }
    });
  }
  function printDir() {
    var D = S.data.core, c = C(), x = A.idx(), doc = A.paper("Directory", "Printed " + A.today() + ". For members only; please do not share. People who asked not to be listed are left out."), n = 0;
    var hhs = D.households.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    hhs.forEach(function (hh) {
      var ppl = (x.members[hh.id] || []).filter(function (p) { var cp = c.people[p.id]; return p.status !== "Former" && (!cp || cp.listed !== false); });
      if (!ppl.length) return;
      n += ppl.length;
      doc.appendChild(h("div", { class: "blk dir-entry" }, h("h3", { text: hh.name }), h("p", { class: "meta", text: addrLine(c.hh[hh.id]) }),
        h("ul", { class: "plain" }, ppl.map(function (p) { var cp = c.people[p.id] || {}; return h("li", { text: [M.name(p), cp.phone, cp.email].filter(Boolean).join(" · ") }); }))));
    });
    doc.appendChild(h("p", { class: "total", text: n + " people listed." }));
    U.printDoc(doc);
  }
  A.personDlg = personDlg; A.hhLabels = hhLabels;
})();
