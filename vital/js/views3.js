/* Stark Vital screens, part 3: Labs, Your week, Visit summary, Data, Settings, About. */
(function () {
  "use strict";
  var V = window.StarkVital, U = window.VitalUI, D = window.VitalData, ST = window.VitalStats, LN = window.VitalLearn, LV = window.VitalLevers, SF = window.VitalSafety, CH = window.VitalCharts, A = window.VitalApp, h = U.h, $ = U.$, S = A.S, btn = A.btn, badge = A.badge;
  var fmt1 = ST.fmtNum;
  function refusalDialog() { var dlg = U.modal("Not saved", h("div", { class: "dlg-body" }, h("p", { text: SF.REFUSAL }), h("div", { class: "row end" }, btn("OK", "primary", function () { dlg.close(); })))); }

  /* ---------- Labs ---------- */
  function labForm(existing) {
    var d = S.d, l = existing || {}, err = h("p", { class: "form-err", role: "alert", hidden: true }), dlg, f = {};
    function field(id, label, el, help, cls) { return h("div", { class: "field " + (cls || "") }, h("label", { for: id, text: label }), el, help ? h("span", { class: "fine", text: help }) : null); }
    var names = {}; d.labs.forEach(function (x) { names[x.analyte] = 1; });
    f.takenOn = h("input", { type: "date", id: "lb-date", value: l.takenOn || A.today(), max: A.today() }); f.lab = h("input", { type: "text", id: "lb-lab", maxlength: 80, value: l.lab || "" }); f.panel = h("input", { type: "text", id: "lb-panel", maxlength: 80, value: l.panel || "" });
    f.analyte = h("input", { type: "text", id: "lb-an", maxlength: 80, value: l.analyte || "", list: "lb-names", autocomplete: "off" }); f.value = h("input", { type: "number", id: "lb-val", step: "any", inputmode: "decimal", value: l.value != null ? l.value : "" });
    f.unit = h("input", { type: "text", id: "lb-unit", maxlength: 30, value: l.unit || "" }); f.refLow = h("input", { type: "number", id: "lb-lo", step: "any", inputmode: "decimal", value: l.refLow != null ? l.refLow : "" }); f.refHigh = h("input", { type: "number", id: "lb-hi", step: "any", inputmode: "decimal", value: l.refHigh != null ? l.refHigh : "" });
    f.refText = h("input", { type: "text", id: "lb-rt", maxlength: 60, value: l.refText || "", placeholder: "As printed, e.g. <5.0" }); f.fasting = h("select", { id: "lb-fast" }, ["unknown", "yes", "no"].map(function (o) { return h("option", { value: o, text: o === "unknown" ? "Fasting: unknown" : "Fasting: " + o, selected: (l.fasting || "unknown") === o }); }));
    f.urgent = h("input", { type: "checkbox", id: "lb-urg", checked: l.urgent === true }); f.abnormal = h("input", { type: "checkbox", id: "lb-abn", checked: l.abnormal === true }); f.note = h("textarea", { id: "lb-note", rows: 2, maxlength: 280, text: l.note || "" });
    var form = h("form", { class: "form dlg-body", novalidate: true, onsubmit: function (e) {
      e.preventDefault(); err.hidden = true;
      var raw = { id: l.id || V.uid(), takenOn: f.takenOn.value, lab: f.lab.value, panel: f.panel.value, analyte: f.analyte.value, value: f.value.value, unit: f.unit.value, refLow: f.refLow.value, refHigh: f.refHigh.value, refText: f.refText.value, fasting: f.fasting.value, urgent: f.urgent.checked, abnormal: f.abnormal.checked, note: f.note.value };
      if ([raw.lab, raw.panel, raw.analyte, raw.note, raw.unit].some(SF.refused)) { dlg.close(); return refusalDialog(); }
      var c = D.cleanLab(raw);
      if (!c) { err.textContent = "Fill in the date, the name of the result and the value as printed on your report."; err.hidden = false; U.markInvalid(!f.takenOn.value ? f.takenOn : !f.analyte.value.trim() ? f.analyte : f.value, err); return; }
      if (c.refLow != null && c.refHigh != null && c.refLow > c.refHigh) { err.textContent = "The low end of the range is above the high end. Copy them as printed."; err.hidden = false; U.markInvalid(f.refLow, err); return; }
      if (!existing && A.full("lab")) { dlg.close(); return; }
      if (existing) d.labs = d.labs.map(function (x) { return x.id === l.id ? c : x; }); else d.labs.push(c);
      A.save(); dlg.close(); A.render(); U.toast("Result saved.");
    } },
      h("p", { class: "notice", text: "Copy the result and its range exactly as printed on your own report. Stark Vital has no built-in ranges and never converts units." }),
      h("datalist", { id: "lb-names" }, Object.keys(names).map(function (n) { return h("option", { value: n }); })),
      h("div", { class: "grid2" }, field("lb-date", "Date taken", f.takenOn), field("lb-an", "Name of the result", f.analyte, "As on the report, e.g. Haemoglobin"), field("lb-val", "Value", f.value), field("lb-unit", "Unit, exactly as printed", f.unit),
        field("lb-lo", "Range on the report: low", f.refLow, "Leave empty if none is printed"), field("lb-hi", "Range on the report: high", f.refHigh), field("lb-rt", "Range text as printed (optional)", f.refText), field("lb-fast", "Fasting", f.fasting),
        field("lb-lab", "Lab (optional)", f.lab), field("lb-panel", "Panel (optional)", f.panel)),
      h("label", { class: "chk" }, f.urgent, "My report marks this result as urgent or critical"), h("label", { class: "chk" }, f.abnormal, "My report marks this result as abnormal (used only when no range is printed)"), field("lb-note", "Note", f.note, null, "wide"), err,
      h("div", { class: "row end" }, btn("Cancel", "", function () { dlg.close(); }), h("button", { type: "submit", class: "btn primary", text: "Save" })));
    dlg = U.modal(existing ? "Edit lab result" : "Add a lab result", form, { wide: true }); f.analyte.focus();
  }
  function labCard(name, list) {
    var units = {}, card = h("div", { class: "card lab" });
    list.forEach(function (l) { (units[l.unit || "(no unit)"] = units[l.unit || "(no unit)"] || []).push(l); });
    card.appendChild(h("h2", { text: name }));
    var uk = Object.keys(units);
    if (uk.length > 1) card.appendChild(h("p", { class: "banner warn", text: "Units differ (" + uk.join(" vs ") + "), so the chart is split. Stark Vital does not convert units." }));
    uk.forEach(function (u) {
      var pts = units[u].slice().sort(function (a, b) { return a.takenOn < b.takenOn ? -1 : 1; }), series = pts.map(function (l) { var pos = D.labPosition(l); return { date: l.takenOn, v: l.value, lo: l.refLow, hi: l.refHigh, pos: pos, text: D.POSITION_TEXT[pos], refText: l.refText }; });
      var last = pts[pts.length - 1], lastPos = D.labPosition(last);
      var sum = name + " (" + u + "): " + pts.length + " result" + (pts.length === 1 ? "" : "s") + ". The latest, " + last.value + " " + u + " on " + last.takenOn + ", is " + D.POSITION_TEXT[lastPos] + ".";
      var rows = [["Date", "Value", "Range on that report", "Position"]].concat(pts.map(function (l) { return [l.takenOn, l.value + " " + l.unit, l.refText || (l.refLow != null || l.refHigh != null ? (l.refLow != null ? l.refLow : "") + " to " + (l.refHigh != null ? l.refHigh : "") : "none printed"), D.POSITION_TEXT[D.labPosition(l)]]; }));
      card.appendChild(CH.card(uk.length > 1 ? "Unit: " + u : null, CH.lab({ pts: series, unit: u, label: sum }), sum + " Each result is drawn with the range from its own report (the shaded bar).", rows, h("p", { class: "fine key", text: "Shapes: circle inside the range, triangle up above, triangle down below, diamond no range given." })));
      if (pts.length >= 4) {
        var first = pts[0], width = last.refLow != null && last.refHigh != null ? last.refHigh - last.refLow : null, moved = Math.abs(last.value - first.value);
        card.appendChild(h("p", { text: "From " + first.takenOn + " to " + last.takenOn + " the value moved by " + fmt1(moved, 2) + " " + u + (width ? ", which is " + (moved > width ? "more" : "less") + " than the width of the range printed on your latest report (" + fmt1(width, 2) + ")." : ".") + " Ask your clinician what this means." }));
      } else card.appendChild(h("p", { class: "fine", text: "With fewer than 4 results there is only the chart. Ask your clinician what this means." }));
    });
    card.appendChild(h("div", { class: "tbl" }, h("table", { class: "list" }, h("thead", null, h("tr", null, ["Date", "Value", "Position", ""].map(function (c) { return h("th", { scope: "col", text: c }); }))),
      h("tbody", null, list.slice().sort(function (a, b) { return a.takenOn < b.takenOn ? 1 : -1; }).map(function (l) {
        return h("tr", null, h("td", { text: l.takenOn }), h("td", { text: l.value + " " + l.unit }), h("td", { text: D.POSITION_TEXT[D.labPosition(l)] + (l.lab ? " (" + l.lab + ")" : "") }),
          h("td", { class: "act" }, h("div", { class: "row tight" }, btn("Edit", "small", function () { labForm(l); }), btn("Delete", "small danger-o", function () { U.confirmBox("Delete this result?", "It is removed from this notebook.", "Delete", true).then(function (ok) { if (ok) { S.d.labs = S.d.labs.filter(function (x) { return x.id !== l.id; }); A.save(); A.render(); } }); }))));
      })))));
    return card;
  }
  A.views.labs = function () {
    var d = S.d, wrap = h("div"), flags = A.redFlags(), groups = {};
    wrap.appendChild(A.section("Lab results", "Type results from your own report with the range printed on that report. Stark Vital shows them over time and nothing more.", [btn("Add a result", "primary", function () { labForm(); })]));
    if (flags.active) wrap.appendChild(A.redBanner(flags));
    wrap.appendChild(h("p", { class: "banner", text: "Each result is compared only with the range on its own report: below the range, inside, or above. Stark Vital does not say what a result means for your health. " + SF.FOOTER }));
    d.labs.forEach(function (l) { (groups[l.analyte] = groups[l.analyte] || []).push(l); });
    var names = Object.keys(groups).sort();
    if (!names.length) wrap.appendChild(h("div", { class: "empty" }, h("p", { text: "No lab results yet. Add one from a report you have at hand." }), btn("Add a result", "primary", function () { labForm(); })));
    names.forEach(function (n) { wrap.appendChild(labCard(n, groups[n])); });
    return wrap;
  };

  /* ---------- Your week ---------- */
  A.views.week = function () {
    var d = S.d, t = A.today(), w = LN.week(d, t), wrap = h("div"), flags = A.redFlags();
    wrap.appendChild(A.section("Your week", "The last 7 days against the 7 before. Three things that changed, one that stayed steady, one thing to try. No scores."));
    if (flags.active) wrap.appendChild(A.redBanner(flags));
    function line(x) {
      var O = D.outcome(x.id), f = O.unit === "min" ? function (v) { return D.fmtDur(v); } : function (v) { return fmt1(v, 1); }, dir = x.diff > 0 ? "up" : "down";
      return h("li", null, h("b", { text: x.label + ": " }), "averaged " + f(x.now) + " this week" + (Math.abs(x.diff) < 1e-9 ? ", the same as" : ", " + dir + " from") + " " + f(x.before) + " the week before (" + x.nNow + " and " + x.nBefore + " days logged).");
    }
    if (w.have < 2) { wrap.appendChild(h("div", { class: "card" }, h("p", { text: "Not enough days yet. This page needs at least 3 logged days in each of the last two weeks (you have " + w.logged + " in the last 14 days)." }), btn("Check in", "primary", function () { A.go("checkin"); }))); return wrap; }
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "What changed" }), w.changed.length ? h("ul", { class: "week-list" }, w.changed.map(line)) : h("p", { class: "muted", text: "Nothing moved by much between the two weeks." })));
    if (w.steady) wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "What stayed steady" }), h("ul", { class: "week-list" }, line(w.steady))));
    var running = d.experiments.filter(function (e) { var s = LN.status(e, t); return s === "running" || s === "planned"; })[0], rank = LN.rank(d, A.patterns(), t), top = LN.top(d, rank, t);
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "One thing to try" }), running ? h("p", { text: "You have an experiment running. Mark each day on the Home screen so the result counts." }) : top ? h("div", null, h("p", { text: top.lever.name + ": " + top.lever.try }), btn("Plan it as an experiment", "primary", function () { A.expDraft = top.lever.id; A.go("experiments"); })) : h("p", { text: "Keep checking in." })));
    wrap.appendChild(h("p", { class: "fine", text: "Averages of a few days are rough. " + SF.FOOTER }));
    return wrap;
  };

  /* ---------- Visit summary (printable) ---------- */
  /* visit summary page: full version only */
  A.views.summary = function () {
    var d = S.d, wrap = h("div"), qin = h("input", { type: "text", id: "q-in", maxlength: 300, placeholder: "A question you want to ask", "aria-label": "New question" });
    wrap.appendChild(A.section("Visit summary", "Your questions for a visit."));
    function addQ() { var t = qin.value.trim(); if (!t) return; if (SF.refused(t)) { qin.value = ""; return refusalDialog(); } d.questions.push({ id: V.uid(), text: t.slice(0, 300) }); A.save(); A.render(); }
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Questions for my doctor" }), h("form", { class: "row", onsubmit: function (e) { e.preventDefault(); addQ(); } }, h("div", { class: "grow" }, qin), h("button", { type: "submit", class: "btn", text: "Add" })),
      d.questions.length ? h("ol", { class: "qlist" }, d.questions.map(function (q) { return h("li", null, h("span", { text: q.text }), btn("Remove", "small ghost", function () { d.questions = d.questions.filter(function (x) { return x.id !== q.id; }); A.save(); A.render(); })); })) : h("p", { class: "fine", text: "Write the questions that come up between visits, so you do not forget them." })));
    wrap.appendChild(window.StarkTrial.card("visit_summary"));
    return wrap;
  };

  /* ---------- Data ---------- */
  function mergeBackup(r, mode) {
    var d = S.d, inc = D.sanitize(r.data), k;
    if (mode === "replace") { S.d = inc; S.d.example = false; }
    else {
      for (k in inc.days) if (!d.days[k]) d.days[k] = inc.days[k];
      inc.labs.forEach(function (l) { if (!d.labs.some(function (x) { return x.id === l.id; })) d.labs.push(l); });
      inc.experiments.forEach(function (e) { if (!d.experiments.some(function (x) { return x.id === e.id; })) d.experiments.push(e); });
      inc.questions.forEach(function (q) { if (!d.questions.some(function (x) { return x.id === q.id; })) d.questions.push(q); });
      D.mergeCustom(d, inc.custom);
    }
    A.changed(); return A.flush();
  }
  function downloadBackup() {
    if (S.example) return U.toast("The example is not saved, so there is nothing to back up.", true);
    A.flush().then(function () { return U.storeGet(A.WS); }).then(function (env) {
      if (!env || env.corrupt) throw new Error("Nothing saved yet.");
      U.downloadText("stark-vital-backup-" + A.today() + ".starkvital", JSON.stringify(V.makeBundle(env)), "application/json");
      U.toast("Encrypted backup saved. It opens only with your passphrase.");
    }).catch(function (x) { U.toast("Could not make the backup: " + x.message, true); });
  }
  function importBackup() {
    U.pickFile(".starkvital,.json,application/json").then(function (f) {
      if (!f) return; var rb = A.readBackup(f); if (rb.error) return U.toast(rb.error, true);
      A.askPass("Import a backup", "Enter the passphrase of " + f.name + ". Then choose to add what is missing, or replace everything here.", function (pw) {
        return V.openData(rb.env, pw).then(function (r) {
          var nd = D.sanitize(r.data), n = Object.keys(nd.days).length, dlg = U.modal("Import " + n + " days?", h("div", { class: "dlg-body" }, h("p", { text: "The backup holds " + n + " days, " + nd.labs.length + " lab results and " + nd.experiments.length + " experiments" + (nd.custom && nd.custom.items.length ? " and " + nd.custom.items.length + " of your own items" : "") + "." }),
            h("div", { class: "row end" }, btn("Cancel", "", function () { dlg.close(); }),
              btn("Replace everything here", "danger-o", function () { dlg.close(); mergeBackup(r, "replace").then(function () { A.render(); U.toast("Replaced with the backup."); }, function (x) { U.toast(x.message, true); }); }),
              btn("Add what is missing", "primary", function () { dlg.close(); mergeBackup(r, "merge").then(function () { A.render(); U.toast("Imported. Existing days were kept."); }, function (x) { U.toast(x.message, true); }); }))));
        });
      });
    });
  }
  function csvDialog() {
    var inp = h("input", { type: "text", id: "csv-ok", autocomplete: "off", "aria-label": "Type I understand" }), dlg, b = h("button", { type: "submit", class: "btn primary", text: "Save CSV", disabled: true });
    inp.addEventListener("input", function () { b.disabled = inp.value.trim().toLowerCase() !== "i understand"; });
    dlg = U.modal("Save a plain CSV file", h("form", { class: "form dlg-body", onsubmit: function (e) { e.preventDefault(); if (b.disabled) return; U.downloadText("stark-vital-" + A.today() + ".csv", D.toCSV(S.d), "text/csv"); dlg.close(); U.toast("CSV saved. It is not encrypted."); } },
      h("p", { class: "banner warn", text: "This file is NOT encrypted. Anyone who can open it can read your entries, notes and lab results. Keep it somewhere private." }), h("div", { class: "field" }, h("label", { for: "csv-ok", text: "Type: I understand" }), inp), h("div", { class: "row end" }, btn("Cancel", "", function () { dlg.close(); }), b))); inp.focus();
  }
  function deleteDialog() {
    var inp = h("input", { type: "text", id: "del-ok", autocomplete: "off" }), dlg, b = h("button", { type: "submit", class: "btn danger", text: "Delete everything", disabled: true });
    inp.addEventListener("input", function () { b.disabled = inp.value.trim() !== "DELETE"; });
    dlg = U.modal("Delete everything?", h("form", { class: "form dlg-body", onsubmit: function (e) { e.preventDefault(); if (b.disabled) return; dlg.close(); A.eraseAll().then(function () { U.toast("Everything was deleted from this computer."); }); } },
      h("p", { text: "This erases every entry, lab result and experiment, the saved copy and the encryption key from this browser. It cannot be undone, except from a backup file." }), h("div", { class: "field" }, h("label", { for: "del-ok", text: "Type DELETE to confirm" }), inp), h("div", { class: "row end" }, btn("Cancel", "", function () { dlg.close(); }), b))); inp.focus();
  }
  A.views.data = function () {
    var d = S.d, wrap = h("div"), n = Object.keys(d.days).length;
    wrap.appendChild(A.section("Your data", "It is yours. Back it up, move it, or delete it."));
    wrap.appendChild(h("div", { class: "stats" }, h("div", { class: "stat" }, h("b", { text: String(n) }), h("span", { text: "days logged" })), h("div", { class: "stat" }, h("b", { text: String(d.labs.length) }), h("span", { text: "lab results" })), h("div", { class: "stat" }, h("b", { text: String(d.experiments.length) }), h("span", { text: "experiments" })), D.customItems(d, true).length ? h("div", { class: "stat" }, h("b", { text: String(D.customItems(d, true).length) }), h("span", { text: "own items" })) : null));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Encrypted backup" }), h("p", { class: "muted", text: "One file with everything, still encrypted. It opens only with your passphrase." }), h("div", { class: "row" }, btn("Save a backup file", "primary", downloadBackup), btn("Import a backup file", "", importBackup)),
      h("p", { class: "fine", text: "Browsers can clear stored data, especially in a private window or an embedded player. The downloaded app and a backup file are the safe way. Save a backup now and then." })));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Plain CSV file" }), h("p", { class: "muted", text: "Days, lab results, experiments and your own items as a spreadsheet file. This one is not encrypted." }), btn("Save a CSV file", "", csvDialog)));
    wrap.appendChild(h("div", { class: "card danger-zone" }, h("h2", { text: "Delete everything" }), h("p", { class: "muted", text: "Erases this notebook and its key from this browser." }), btn("Delete everything", "danger-o", deleteDialog)));
    return wrap;
  };

  /* ---------- Settings ---------- */
  function icsFile(time) {
    var hh = time.slice(0, 2), mm = time.slice(3), now = new Date(), stamp = now.getUTCFullYear() + ("0" + (now.getUTCMonth() + 1)).slice(-2) + ("0" + now.getUTCDate()).slice(-2) + "T" + ("0" + now.getUTCHours()).slice(-2) + ("0" + now.getUTCMinutes()).slice(-2) + "00Z", day = A.today().replace(/-/g, "");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stark//Vital//EN", "BEGIN:VEVENT", "UID:vital-checkin@stark.local", "DTSTAMP:" + stamp, "DTSTART:" + day + "T" + hh + mm + "00", "DURATION:PT5M", "RRULE:FREQ=DAILY", "SUMMARY:Stark Vital check-in", "DESCRIPTION:A few taps. Open Stark Vital on your computer.", "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:Stark Vital check-in", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n") + "\r\n";
  }
  function changePass() {
    var strong = null, p1 = U.passField("np1", "New passphrase", function (s) { strong = s; }), p2 = h("input", { id: "np2", type: "password", autocomplete: "new-password", maxlength: 200 }), err = h("p", { class: "form-err", role: "alert", hidden: true });
    return h("form", { class: "form", novalidate: true, onsubmit: function (e) {
      e.preventDefault(); err.hidden = true; var pw = p1.input.value;
      if (S.example) { err.textContent = "The example has no passphrase."; err.hidden = false; return; }
      if (pw.length < 12 || (strong && strong.score < 2)) { err.textContent = "Use at least 12 characters and a few unrelated words."; err.hidden = false; U.markInvalid(p1.input, err); return; }
      if (pw !== p2.value) { err.textContent = "The two passphrases do not match."; err.hidden = false; U.markInvalid(p2, err); return; }
      V.newSession(pw).then(function (sess) { S.session = sess; return A.flush(); }).then(function () { return U.storeGet(A.WS); }).then(function (env) { return U.setBak(A.WS, env); }).then(function () { p1.input.value = p2.value = ""; U.toast("Passphrase changed. Old backup files still open with the old passphrase."); }, function (x) { U.toast("Could not change it: " + x.message, true); });
    } }, p1.el, h("div", { class: "field wide" }, h("label", { for: "np2", text: "Type it again" }), p2), err, h("div", { class: "row" }, h("button", { type: "submit", class: "btn", text: "Change passphrase" })));
  }
  A.views.settings = function () {
    var d = S.d, s = d.settings, wrap = h("div"), names = { sleep: "Sleep", mood: "Mood", energy: "Energy", training: "Training", food: "Food and drink", light: "Light and screens", stress: "Stress", focus: "Focus", social: "Time with people", breath: "Slow breathing" };
    wrap.appendChild(A.section("Settings", "Display and detail only. These never change the maths."));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "What to track" }), h("div", { class: "multi wide-multi" }, D.TRACKABLE.map(function (t) { return h("label", { class: "chk" }, h("input", { type: "checkbox", checked: s.tracked.indexOf(t) !== -1, onchange: function (e) { s.tracked = s.tracked.filter(function (x) { return x !== t; }); if (e.target.checked) s.tracked.push(t); A.save(); } }), names[t]); })), h("p", { class: "fine", text: "Fewer fields means a faster check-in. You can show every field on the check-in screen any time." })));
    function sel(id, label, opts, val, fn, help) { return h("div", { class: "field" }, h("label", { for: id, text: label }), h("select", { id: id, onchange: function (e) { fn(e.target.value); } }, opts.map(function (o) { return h("option", { value: o[0], text: o[1], selected: String(o[0]) === String(val) }); })), help ? h("span", { class: "fine", text: help }) : null); }
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "How much detail" }), h("div", { class: "grid2" },
      sel("st-detail", "Level of detail", [["simple", "Simple: sentences and one number"], ["more", "More: ranges, charts, how sure"], ["expert", "Expert: rho, delta, p-values, q"]], s.detail, function (v) { s.detail = v; A.save(); }, "Changes what is shown, never how it is calculated."),
      sel("st-goal", "What matters most to you", [["any", "Everything"], ["sleep", "Sleep"], ["mood", "Mood"], ["energy", "Energy"], ["focus", "Focus"], ["stress", "Stress"]], s.goal, function (v) { s.goal = v; A.save(); }, "Used only to order the \"what seems to help you\" card."))));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Look and feel" }), h("div", { class: "grid2" },
      sel("st-theme", "Theme", [["dark", "Dark"], ["light", "Light"]], document.documentElement.dataset.theme, function (v) { A.applyTheme(v); }),
      sel("st-size", "Text size", [[100, "Normal"], [115, "Large"], [130, "Larger"], [150, "Largest"]], A.size(), function (v) { A.applySize(+v); }),
      sel("st-motion", "Motion", [["auto", "Follow my system"], ["off", "Reduce motion"], ["on", "Allow motion"]], s.reduceMotion === true ? "off" : s.reduceMotion === false ? "on" : "auto", function (v) { s.reduceMotion = v === "off" ? true : v === "on" ? false : null; A.save(); A.applyMotion(); }))));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Privacy" }), h("div", { class: "grid2" },
      sel("st-lock", "Lock after no activity for", [[1, "1 minute"], [5, "5 minutes"], [10, "10 minutes"], [15, "15 minutes"], [30, "30 minutes"], [60, "60 minutes"]], s.lockMin, function (v) { s.lockMin = +v; A.save(); }),
      h("label", { class: "chk" }, h("input", { type: "checkbox", checked: s.lockOnHide, onchange: function (e) { s.lockOnHide = e.target.checked; A.save(); } }), "Lock when this tab is hidden")), h("h3", { text: "Change passphrase" }), changePass()));
    var rt = h("input", { type: "time", id: "st-remind", value: s.remind || "20:00" });
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Daily reminder" }), h("p", { class: "muted", text: "Stark Vital has no server and cannot send notifications. Choose a time: a banner shows on the Home screen after that time if you have not checked in, and you can add a daily event to your own calendar." }),
      h("div", { class: "row" }, h("div", { class: "field" }, h("label", { for: "st-remind", text: "Time" }), rt), btn("Use this time", "", function () { s.remind = rt.value; A.save(); U.toast("Reminder set for " + rt.value + "."); }), btn("Add to my calendar (.ics)", "", function () { U.downloadText("stark-vital-reminder.ics", icsFile(rt.value), "text/calendar"); }), s.remind ? btn("Turn off", "ghost", function () { s.remind = ""; A.save(); A.render(); }) : null)));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Safety" }), h("label", { class: "chk" }, h("input", { type: "checkbox", checked: s.restricted, onchange: function (e) { s.restricted = e.target.checked; A.save(); } }), "Pregnant or may be: switch off sleep and training experiments"),
      h("p", { class: "fine", text: "The note about talking to a doctor cannot be switched off. It only ever shows from your own entries." })));
    return wrap;
  };
  A.reminderDue = function () {
    var s = S.d && S.d.settings; if (!s || !s.remind || S.d.days[A.today()]) return false; var n = new Date(), hhmm = ("0" + n.getHours()).slice(-2) + ":" + ("0" + n.getMinutes()).slice(-2); return hhmm >= s.remind;
  };

  /* ---------- About ---------- */
  A.views.about = function () {
    var wrap = h("div");
    wrap.appendChild(A.section("About Stark Vital", "Version " + V.VERSION + ", by Stark."));
    function card(title, items) { return h("div", { class: "card" }, h("h2", { text: title }), Array.isArray(items) ? h("ul", { class: "about-list" }, items.map(function (t) { return h("li", { text: t }); })) : h("p", { text: items })); }
    wrap.appendChild(card("Our three promises", ["Offline and private: your entries are encrypted on this computer with your passphrase. There is no account, no server and no network access.", "Plain statistics: it learns only from your own entries, with the number of days and how sure it is shown next to every finding.", "Not medical advice: this is a notebook and a habit tool. " + SF.FOOTER]));
    wrap.appendChild(card("What it will not do", ["Tell you what a result or a symptom means for your health, screen you for anything, or score risk.", "Suggest, rank or discuss medicines, supplements, hormones or drugs, or give amounts of anything.", "Compare you with other people, or forecast your future moods or results.", "Promise a result. Patterns in a few weeks of notes are hints, not proof."]));
    wrap.appendChild(card("How it learns", ["For each habit and each result, it pairs your days (a habit on one day with the result that day, or the next day or night where that makes sense) and measures how closely they move together with Spearman rank correlation.", "It leaves out days you marked unwell or travelling and your first 3 days, removes weekday differences, and needs at least 21 paired days and 5 days that differ before it will say anything.", "It reports how sure it is from a resampling range that respects day-to-day carry-over, and corrects for many comparisons at once so that chance findings are rarer.", "Experiments set the change yourself: two weeks of one habit against the two weeks before, judged by rules fixed before you start.", "Nothing is trained on anyone else's data. Nothing leaves your computer."]));
    wrap.appendChild(card("Limits to keep in mind", ["Self-ratings are noisy, and 14 to 90 days is a small sample.", "A pattern is not a cause. Many things you cannot see affect your days.", "An experiment runs one at a time and cannot separate a habit from other things that changed in the same weeks.", "Sleep length comes from the clock times you type. On the night the clocks change it can be an hour off.", "The library summarises published research about groups of people. Your own results may differ."]));
    wrap.appendChild(card("How your data is kept", ["Stored in this browser only, as one encrypted record (AES-256-GCM, key from your passphrase with PBKDF2-SHA256, 600,000 rounds). A new random value is used for every save, and the last good copy is kept.", "Protects against someone reading the files or a stolen drive. It does not protect a computer with malware, someone watching you type, or a weak passphrase.", "If you lose your passphrase your data cannot be recovered. Keep an encrypted backup file somewhere safe.", "Free-trial limits are a local counter on the honour system. No licence server exists."]));
    wrap.appendChild(card("Keyboard", ["Ctrl+K (or Cmd+K) opens search and jump. g then h, c, t, p, e or l jumps to Home, Check-in, Trends, What helps, Experiments or Labs.", "On the check-in, the keys 1 to 5 choose an answer and move to the next question. Ctrl+Enter saves."]));
    wrap.appendChild(h("p", { class: "fine", text: "Stark Vital " + V.VERSION + ". Not medical advice. If something worries you, talk to a doctor or pharmacist. In an emergency, call your local emergency number." }));
    return wrap;
  };
})();
