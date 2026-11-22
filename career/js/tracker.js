/* Application tracker view. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;
  var ACTIVE = ["wishlist", "applied", "screening", "interview", "offer"], CLOSED = ["accepted", "rejected", "withdrawn"];

  SC.appsCSV = function (apps) {
    function q(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var rows = [["Company", "Role", "Stage", "Applied or added", "Follow-up date", "Follow-up note", "Salary", "Link", "Contacts", "Notes"]];
    apps.forEach(function (a) {
      rows.push([a.company, a.role, SC.STAGE_LABEL[a.stage], a.history[0] ? a.history[0].date : "", a.followUp || "", a.followNote || "", a.salary, a.url,
        (a.contacts || []).map(function (c) { return [c.name, c.role, c.email, c.phone].filter(Boolean).join(" / "); }).join("; "), a.notes]);
    });
    return rows.map(function (r) { return r.map(q).join(","); }).join("\r\n");
  };

  SC.views.tracker = function (root) {
    var apps = SC.S.apps, today = SC.today();

    function card(a) {
      var due = a.followUp && a.followUp <= today, moves = SC.TRANSITIONS[a.stage] || [];
      var ver = a.versionId ? SC.S.versions.filter(function (v) { return v.id === a.versionId; })[0] : null;
      var since = a.history[0] ? SC.daysBetween(a.history[0].date, today) : null;
      return '<div class="acard' + (due ? " due" : "") + '" data-id="' + a.id + '"><b>' + E(a.company || "(no company)") + "</b><span>" + E(a.role) + "</span>" +
        (a.followUp ? '<div class="fine">' + (due ? "<b>Due:</b> " : "Next: ") + E(a.followNote) + " (" + a.followUp + ')</div>' : "") +
        (since != null && since > 0 ? '<div class="fine">' + since + " days since added</div>" : "") +
        (moves.length ? '<div class="row" style="margin-top:.3rem"><label class="sr-only" for="mv-' + a.id + '">Move to</label><select id="mv-' + a.id + '" data-mv><option value="">Move to...</option>' + moves.map(function (m) { return '<option value="' + m + '">' + SC.STAGE_LABEL[m] + "</option>"; }).join("") + "</select></div>" : "") +
        (due ? '<button type="button" class="btn small" data-act="done" style="margin-top:.3rem">Mark follow-up done</button>' : "") +
        (ver ? '<div class="vtag"><span>Resume: ' + E(ver.name) + '</span><button type="button" class="btn tiny" data-act="vprint">Print</button></div>' : "") +
        "<details><summary>Details, contacts, notes</summary>" +
        '<label for="d-' + a.id + '">Follow-up date</label><input id="d-' + a.id + '" type="date" data-f="followUp" value="' + E(a.followUp || "") + '">' +
        '<label for="s-' + a.id + '">Salary</label><input id="s-' + a.id + '" data-f="salary" value="' + E(a.salary) + '">' +
        '<label for="u-' + a.id + '">Posting link or ID</label><input id="u-' + a.id + '" data-f="url" value="' + E(a.url) + '">' +
        '<label for="vs-' + a.id + '">Resume version</label><select id="vs-' + a.id + '" data-f="versionId"><option value="">None</option>' + SC.S.versions.map(function (v) { return '<option value="' + v.id + '"' + (v.id === a.versionId ? " selected" : "") + ">" + E(v.name) + " (" + v.created + ")</option>"; }).join("") + "</select>" +
        '<label for="n-' + a.id + '">Notes</label><textarea id="n-' + a.id + '" data-f="notes" rows="3">' + E(a.notes) + "</textarea>" +
        (a.posting ? '<details class="posting"><summary>Saved posting (' + a.posting.length + ' characters)</summary><pre class="letter" data-i18n-skip="1">' + E(a.posting) + '</pre><button type="button" class="btn small" data-act="postcheck">Open it on the Tailor page</button></details>' : "") +
        "<h4>Contacts</h4>" + (a.contacts || []).map(function (c, i) { return '<div class="fine">' + E([c.name, c.role, c.email, c.phone].filter(Boolean).join(" / ")) + ' <button type="button" class="btn small" data-act="rmc" data-i="' + i + '" aria-label="Remove contact">x</button></div>'; }).join("") +
        '<div class="cols"><input data-c="name" placeholder="Name" aria-label="Contact name"><input data-c="role" placeholder="Title" aria-label="Contact title"><input data-c="email" placeholder="Email" aria-label="Contact email"><input data-c="phone" placeholder="Phone" aria-label="Contact phone"></div>' +
        '<div class="row"><button type="button" class="btn small" data-act="addc">Add contact</button><button type="button" class="btn small danger" data-act="del">Delete application</button></div></details></div>';
    }

    function draw() {
      var st = SC.trackerStats(apps), due = SC.dueFollowUps(apps, today);
      $("#tr").innerHTML =
        '<div class="stat"><div><b>' + st.total + "</b>tracked</div><div><b>" + st.applied + "</b>applied</div><div><b>" + st.by.interview + "</b>interviewing</div><div><b>" + st.by.offer + "</b>offers</div><div><b>" + st.responseRate + "%</b>response rate</div></div>" +
        (due.length ? '<div class="card"><h2>Follow-ups due (' + due.length + ')</h2><ul>' + due.map(function (a) { return "<li><b>" + E(a.company) + "</b>, " + E(a.role) + ": " + E(a.followNote) + " (" + a.followUp + ")</li>"; }).join("") + "</ul></div>" : "") +
        '<div class="board">' + ACTIVE.map(function (s) { var l = apps.filter(function (a) { return a.stage === s; }); return '<div class="col"><h3>' + SC.STAGE_LABEL[s] + " <span class=\"chip\">" + l.length + "</span></h3>" + l.map(card).join("") + "</div>"; }).join("") + "</div>" +
        '<h2 style="margin-top:1.2rem">Closed</h2><div class="board">' + CLOSED.map(function (s) { var l = apps.filter(function (a) { return a.stage === s; }); return '<div class="col"><h3>' + SC.STAGE_LABEL[s] + " <span class=\"chip\">" + l.length + "</span></h3>" + l.map(card).join("") + "</div>"; }).join("") + "</div>";
    }

    root.innerHTML = '<div class="view-head"><p class="eyebrow">Applications</p><h1>Application tracker</h1><p class="lede">Move each job through the stages. Follow-up reminders are set for you: 7 days after applying, 5 after a screening call, 1 after an interview (thank-you note) and 3 after an offer. Applying and finishing follow-ups count toward your weekly sprint, and each job can carry its own tailored resume version.</p></div>' +
      '<div class="card"><h2>Add a job</h2><div class="cols"><div><label for="a-co">Company</label><input id="a-co"></div><div><label for="a-ro">Role</label><input id="a-ro"></div>' +
      '<div><label for="a-st">Stage</label><select id="a-st">' + SC.STAGES.slice(0, 5).map(function (s) { return '<option value="' + s + '">' + SC.STAGE_LABEL[s] + "</option>"; }).join("") + '</select></div></div>' +
      '<div class="row" style="margin-top:.6rem"><button type="button" class="btn primary" id="a-add">Add</button><button type="button" class="btn" id="a-csv">Export CSV</button></div></div><div id="tr"></div>';
    draw();

    function find(el) { var c = el.closest("[data-id]"); if (!c) return null; var id = c.getAttribute("data-id"); for (var i = 0; i < apps.length; i++) if (apps[i].id === id) return i; return null; }
    $("#a-add").addEventListener("click", function () {
      var co = $("#a-co").value.trim(), ro = $("#a-ro").value.trim();
      if (!co && !ro) { SC.toast("Enter a company or a role."); return; }
      if (!SC.canAddApp()) return;
      apps.unshift(SC.newApp({ company: co, role: ro, stage: $("#a-st").value }, today)); if ($("#a-st").value === "applied") SC.log("apps"); SC.save();
      $("#a-co").value = ""; $("#a-ro").value = ""; draw();
    });
    $("#a-csv").addEventListener("click", function () { SC.download("applications.csv", SC.appsCSV(apps), "text/csv"); });
    var tr = $("#tr"), saveSoon = SC.debounce(SC.save, 300);
    tr.addEventListener("change", function (ev) {
      var i = find(ev.target); if (i == null) return;
      if (ev.target.hasAttribute("data-mv")) {
        if (!ev.target.value) return;
        try {
          var to = ev.target.value; apps[i] = SC.moveApp(apps[i], to, today);
          if (to === "applied") { SC.log("apps"); SC.toast("Moved to Applied. +1 application this week."); }
          SC.save(); draw();
        } catch (e) { SC.toast(e.message); }
      }
    });
    tr.addEventListener("input", function (ev) {
      var i = find(ev.target), f = ev.target.getAttribute("data-f"); if (i == null || !f) return;
      apps[i][f] = ev.target.value || (f === "followUp" || f === "versionId" ? null : "");
      if (f === "versionId") { SC.S.versions.forEach(function (v) { if (v.appId === apps[i].id) v.appId = null; if (v.id === apps[i].versionId) v.appId = apps[i].id; }); SC.save(); draw(); return; }
      saveSoon();
    });
    tr.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return; var i = find(b), act = b.getAttribute("data-act"); if (i == null) return;
      var card = b.closest("[data-id]");
      if (act === "done") { apps[i] = SC.doneFollowUp(apps[i]); SC.log("follow"); SC.save(); draw(); SC.toast("Follow-up done. +1 this week."); }
      else if (act === "vprint") { var v = SC.S.versions.filter(function (x) { return x.id === apps[i].versionId; })[0]; if (v) SC.printResume(v.resume, false); }
      else if (act === "postcheck") { SC.S.jobText = apps[i].posting || ""; SC.S.tailor.role = apps[i].role || ""; SC.S.tailor.company = apps[i].company || ""; SC.save(); SC.go("#/match"); }
      else if (act === "rmc") { apps[i].contacts.splice(+b.getAttribute("data-i"), 1); SC.save(); draw(); }
      else if (act === "addc") {
        var c = {}; SC.$$("[data-c]", card).forEach(function (x) { c[x.getAttribute("data-c")] = x.value.trim(); });
        if (!c.name && !c.email) { SC.toast("Enter a name or an email."); return; }
        apps[i].contacts.push(c); SC.save(); draw();
      }
      else if (act === "del") {
        if (b.getAttribute("data-sure") !== "1") { b.setAttribute("data-sure", "1"); b.textContent = "Click again to delete"; return; }
        apps.splice(i, 1); SC.save(); draw();
      }
    });
  };
})();
