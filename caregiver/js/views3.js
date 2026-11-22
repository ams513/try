/* Stark Caregiver, by Stark: medicines and the dose log, the diary and the doctor summary, the care rota, and the carer's own page.
   Record keeping only: no dosing advice, no checks between medicines, no diagnosis. Built with textContent only, never parsed markup. */
(function () {
  "use strict";
  var A = window.CareApp, V = CareCore, C = CareContent, U = CareUI, L = CareLogic, h = U.h;
  var btn = A.btn, badge = A.badge, row = A.row;
  var UI = { doseDate: "", histDays: 14, diaryKind: "", rotaFrom: "", rotaDays: 7 };
  function vault() { return A.S.vault; }
  function ro() { return A.ro(); }
  function today() { return V.todayStr(); }
  function sel(q, root) { return (root || document).querySelector(q); }
  function medName(m) { return m.name + (m.dose ? " " + m.dose : ""); }
  function whoOpts() { return [{ v: "", l: "Everyone" }].concat(A.peopleOpts(false)); }
  function by() { var p = A.curBy(); return { by: p ? p.id : "", byName: p ? p.name : "" }; }
  function tblScroll(table) { return h("div", { class: "tbl-scroll" }, table); }

  /* ======================= Medicines and the dose log ======================= */
  var NOADVICE = "Record keeping only. This app gives no dosing advice and does not check medicines against each other. If you are unsure about a dose, a missed dose or a new medicine, ask the pharmacist or doctor.";
  function logDose(m, date, slot, status) {
    var v = vault(), w = by(), done = function () {
      L.addDose(v, { med: m.id, person: m.person, date: date, slot: slot, status: status, at: V.nowHM(), by: w.by, byName: w.byName });
      A.save(); A.render(); U.toast((status === "given" ? "Logged as given: " : "Logged as missed: ") + medName(m) + (slot ? " (" + slot + ")" : "") + (w.byName ? ", by " + w.byName : "") + ".");
    }, prev = slot ? L.givenAlready(v, m.id, date, slot) : null;
    if (status === "given" && prev) {
      return U.confirmBox("Already logged as given", "The " + slot + " dose of " + medName(m) + " on " + date + " is already logged as given at " + (prev.at || "an unknown time") + (prev.byName ? " by " + prev.byName : "") +
        ". Check with them before giving anything. Add another entry anyway?", "Add another entry").then(function (ok) { if (ok) done(); });
    }
    done();
  }
  function logPrn(m, date) {
    var w = by();
    U.openForm("Log a dose: " + medName(m), [{ k: "at", label: "Time given", type: "time", req: true }, { k: "note", label: "What it was for (optional)", ph: "Knee pain after the walk", wide: true }],
      { at: V.nowHM() }, function (o) {
        if (L.hm(o.at) == null) { U.toast("Enter the time as HH:MM.", true); return false; }
        L.addDose(vault(), { med: m.id, person: m.person, date: date, slot: "", status: "given", at: L.fmtHm(L.hm(o.at)), by: w.by, byName: w.byName, note: o.note }); A.save(); A.render();
      }, h("p", { class: "fine", text: NOADVICE }));
  }
  function noteDose(e) {
    U.openForm("Note on this dose", [{ k: "at", label: "Time", type: "time" }, { k: "note", label: "Note", type: "textarea", wide: true, ph: "Refused at first, took it with yoghurt at 08:30" }], e, function (o) {
      if (o.at && L.hm(o.at) == null) { U.toast("Enter the time as HH:MM.", true); return false; }
      e.at = o.at ? L.fmtHm(L.hm(o.at)) : e.at; e.note = o.note; A.save(); A.render();
    });
  }
  function undoDose(e) {
    U.confirmBox("Remove this entry?", "This removes the " + (e.status === "given" ? "given" : "missed") + " entry logged at " + (e.at || "?") + (e.byName ? " by " + e.byName : "") + ".", "Remove", true).then(function (ok) {
      if (!ok) return; var v = vault(); v.doses.splice(v.doses.indexOf(e), 1); A.save(); A.render();
    });
  }
  // The day's checklist. Shown on Today and on Medicines.
  function doseCard(pid, date, title) {
    var v = vault(), plan = L.dayPlan(v, pid, date), multi = v.people.length > 1 && (!pid || pid === "all");
    var card = h("div", { class: "card doses" }, h("div", { class: "item-top" }, h("h2", { text: title || (date === today() ? "Medicines today" : "Doses on " + A.dayLabel(date)) }),
      plan.rows.length ? badge(plan.given + " of " + plan.rows.length + " given", plan.open ? "soon" : "ok") : null));
    if (!plan.rows.length && !plan.prn.length) { card.appendChild(h("p", { class: "muted", text: v.meds.length ? "No doses are scheduled for this day." : "No medicines yet. Add them on the Medicines page with the times you give them." })); return card; }
    if (plan.missed) card.appendChild(h("p", { class: "fine", text: plan.missed + " logged as missed. If you are unsure what to do about a missed dose, ask the pharmacist or doctor." }));
    card.appendChild(h("ul", { class: "doselist" }, plan.rows.map(function (r) {
      var e = r.entry, st = e ? e.status : "open";
      return h("li", { class: "dose " + st }, h("span", { class: "slot", text: r.slot }),
        h("div", { class: "grow" }, h("strong", { text: medName(r.med) }), multi ? h("span", { class: "muted", text: " · " + A.pname(r.med.person) }) : null,
          r.med.how ? h("div", { class: "fine", text: r.med.how }) : null,
          e ? h("div", { class: "fine", text: (e.status === "given" ? "Given" : "Missed") + (e.at ? " at " + e.at : "") + (e.byName ? " by " + e.byName : "") + (e.note ? ". " + e.note : "") }) : null),
        e ? badge(e.status === "given" ? "Given" : "Missed", e.status === "given" ? "ok" : "expired") : null,
        ro() ? null : h("div", { class: "row tight" }, e ? null : btn("Given", "small primary", function () { logDose(r.med, date, r.slot, "given"); }),
          e ? null : btn("Missed", "small", function () { logDose(r.med, date, r.slot, "missed"); }),
          e && e.status === "missed" ? btn("Given after all", "small", function () { logDose(r.med, date, r.slot, "given"); }) : null,
          e ? btn("Note", "tiny", function () { noteDose(e); }) : null, e ? btn("Undo", "tiny", function () { undoDose(e); }) : null));
    })));
    if (plan.prn.length) card.appendChild(h("div", null, h("h3", { class: "sub", text: "As needed" }), h("ul", { class: "doselist" }, plan.prn.map(function (p) {
      var last = p.last;
      return h("li", { class: "dose prn" }, h("div", { class: "grow" }, h("strong", { text: medName(p.med) }), multi ? h("span", { class: "muted", text: " · " + A.pname(p.med.person) }) : null,
        h("div", { class: "fine", text: (p.entries.length ? p.entries.length + " logged on this day. " : "") + (last ? "Last logged " + last.date + (last.at ? " at " + last.at : "") + (last.byName ? " by " + last.byName : "") + "." : "Not logged yet.") })),
        ro() ? null : btn("Log a dose", "small", function () { logPrn(p.med, date); }));
    }))));
    return card;
  }
  A.ext.doseToday = function (pid) { return doseCard(pid, today()); };

  A.views.meds = function () {
    var v = vault(), d = UI.doseDate || today(), people = v.people.filter(function (p) { return A.visible(p.id); });
    var wrap = h("div", null, A.section("Medicines", "The list as prescribed, the times you give each one, and a log of every dose given or missed.",
      [btn("Print list", "", function () { A.printNode(medsDoc(people)); }), ro() ? null : btn("Add medicine", "primary", function () { editMed(); })]));
    wrap.appendChild(h("p", { class: "banner warn", text: NOADVICE }));
    var w = A.whoBar(); if (w) wrap.appendChild(w);
    var f = A.personFilterBar(); if (f) wrap.appendChild(f);
    wrap.appendChild(h("div", { class: "row wrap daynav" }, btn("Previous day", "small", function () { UI.doseDate = V.addDays(d, -1); A.render(); }),
      h("label", { for: "dose-day", text: "Day" }), h("input", { id: "dose-day", type: "date", value: d, max: today(), onchange: function (e) { if (!isNaN(V.dayNum(e.target.value))) { UI.doseDate = e.target.value; A.render(); } } }),
      d < today() ? btn("Next day", "small", function () { UI.doseDate = V.addDays(d, 1); A.render(); }) : null, d !== today() ? btn("Back to today", "small", function () { UI.doseDate = ""; A.render(); }) : null));
    wrap.appendChild(doseCard(A.S.person, d));
    var list = h("div", { class: "card" }, h("h2", { text: "Medicine list" }));
    people.forEach(function (p) {
      var ms = v.meds.filter(function (m) { return m.person === p.id; }).sort(function (a, b) { return (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name); });
      list.appendChild(h("h3", { class: "sub", text: p.name }));
      list.appendChild(ms.length ? h("ul", { class: "medlist" }, ms.map(function (m) {
        var on = L.medOn(m, today()), last = L.lastGiven(v, m.id), times = L.parseTimes(m.times);
        return h("li", { class: on ? "" : "stopped" }, h("div", { class: "grow" }, h("strong", { text: medName(m) }), on ? null : " ", on ? null : badge("Stopped" + (m.stopped ? " " + m.stopped : ""), "mute"),
          h("div", { class: "fine", text: [m.prn ? "As needed" : times.length ? "At " + times.join(", ") : "No times set", m.how, m.purpose ? "for " + m.purpose : "", m.prescriber ? "prescribed by " + m.prescriber : "", m.pharmacy ? "pharmacy: " + m.pharmacy : ""].filter(Boolean).join(" · ") }),
          h("div", { class: "fine", text: [m.refill && on ? "Refill due " + m.refill : "", last ? "Last given " + last.date + (last.at ? " " + last.at : "") : ""].filter(Boolean).join(" · ") })),
          m.refill && on ? refillBadge(m) : null,
          h("div", { class: "row tight" }, btn("History", "small", function () { medHistory(m); }), A.actions(m, v.meds, editMed)));
      })) : h("p", { class: "muted", text: "No medicines listed." }));
    });
    wrap.appendChild(list);
    var to = today(), from = V.addDays(to, -(UI.histDays - 1)), g = L.doseGrid(v, A.S.person, from, to, to + " " + V.nowHM());
    wrap.appendChild(h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "The last " + UI.histDays + " days" }),
      h("select", { id: "hist-days", "aria-label": "How many days to show", onchange: function (e) { UI.histDays = +e.target.value; A.render(); } }, [7, 14, 28].map(function (n) { return h("option", { value: n, text: n + " days", selected: n === UI.histDays }); }))),
      h("p", { class: "fine", text: "Each square shows doses logged as given out of those due so far. Red means at least one was logged as missed; amber means some were not logged at all." }),
      g.rows.length ? tblScroll(h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", { text: "Medicine" }), g.days.map(function (x) { return h("th", { text: x.slice(8) + " " + C.WEEKDAYS[L.weekday(x)].slice(0, 2) }); }))),
        h("tbody", null, g.rows.map(function (r) { return h("tr", null, h("th", { scope: "row", text: medName(r.med) }), r.cells.map(function (c) { return h("td", { class: "cell " + c.state, text: c.text }); })); })))) : h("p", { class: "muted", text: "Nothing to show yet." })));
    return wrap;
  };
  function refillBadge(m) {
    var st = V.reminderStatus({ expires: m.refill, leadDays: m.leadDays == null || m.leadDays === "" ? 7 : +m.leadDays });
    return st.state === "none" ? null : badge(st.state === "expired" ? "Refill overdue" : st.state === "soon" ? "Refill soon" : "Refill later", st.state);
  }
  function medHistory(m) {
    var v = vault(), to = today(), from = V.addDays(to, -29), st = L.doseStats(v, m, from, to, to + " " + V.nowHM()), es = v.doses.filter(function (d) { return d.med === m.id && d.date >= from; })
      .sort(function (a, b) { return (b.date + (b.at || "")).localeCompare(a.date + (a.at || "")); });
    U.modal("History: " + medName(m), h("div", { class: "dlg-body" },
      h("p", { text: m.prn ? st.given + " doses logged in the last 30 days." : "Last 30 days: " + st.given + " given, " + st.missed + " missed, " + st.open + " not logged, of " + st.scheduled + " scheduled." }),
      es.length ? tblScroll(h("table", { class: "plain-tbl" }, h("thead", null, h("tr", null, ["Date", "Due", "Status", "Time", "By", "Note"].map(function (x) { return h("th", { text: x }); }))),
        h("tbody", null, es.map(function (e) { return h("tr", null, [e.date, e.slot || "as needed", e.status === "given" ? "Given" : "Missed", e.at, e.byName, e.note].map(function (x) { return h("td", { text: x || "" }); })); })))) : h("p", { class: "muted", text: "Nothing logged in the last 30 days." }),
      h("p", { class: "fine", text: NOADVICE })), { wide: true });
  }
  function editMed(m) {
    if (!m && A.gate && A.gate("meds")) return;
    var v = vault(); m = m || { id: V.uid(), person: A.S.person !== "all" ? A.S.person : v.people[0].id, active: true, leadDays: "7" };
    U.openForm(v.meds.indexOf(m) < 0 ? "Add medicine" : "Edit medicine", [{ k: "person", label: "For", type: "select", options: A.peopleOpts(false), req: true }, { k: "name", label: "Medicine", req: true, ph: "As on the label" },
      { k: "dose", label: "Strength and amount, as on the label", ph: "500 mg, 1 tablet" }, { k: "how", label: "How, as on the label", ph: "With food" },
      { k: "times", label: "Times you give it", ph: "08:00, 20:00", help: "Copy the times from the label or prescription. Leave blank for an as-needed medicine." },
      { k: "prn", label: "As needed (no set times)", type: "checkbox" }, { k: "purpose", label: "What the doctor said it is for", ph: "Blood pressure" },
      { k: "prescriber", label: "Prescribed by", ph: "Dr Lee" }, { k: "pharmacy", label: "Pharmacy", ph: "Main Street Pharmacy 555-0101" }, { k: "started", label: "Started on", type: "date" },
      { k: "refill", label: "Next refill due", type: "date" }, { k: "leadDays", label: "Remind me before", type: "select", options: C.MED_LEAD },
      { k: "onHand", label: "Doses on hand (optional)", type: "number", min: 0, step: 1, inputmode: "numeric", help: "Count them the way you log them: if one dose is two tablets, 10 tablets is 5 doses. Doses logged as given afterwards are taken off." },
      { k: "counted", label: "Counted on", type: "date", help: "After that day's doses. Leave blank for today." },
      { k: "active", label: "Taking it now", type: "checkbox", wide: true }, { k: "notes", label: "Notes (instructions from the doctor or pharmacist, side effects you noticed)", type: "textarea", wide: true, warn: true }], m, function (o) {
      var t = L.parseTimes(o.times);
      if (!o.prn && String(o.times || "").trim() && !t.length) { U.toast("Write the times like 08:00, 20:00.", true); return false; }
      o.times = o.prn ? "" : t.join(", "); o.id = m.id;
      if (o.onHand !== "" && o.onHand != null && !o.counted) o.counted = today();
      if (o.counted && o.counted > today()) { U.toast("The count date cannot be in the future.", true); return false; }
      o.stopped = o.active ? "" : (m.stopped || today());
      A.upsert(v.meds, o); A.save(); A.render();
    }, h("p", { class: "fine", text: "Copy the details exactly as the prescription or label says. " + NOADVICE }));
  }
  function medsDoc(people) {
    var v = vault();
    return h("div", { class: "printdoc meds" }, h("h1", { text: "Medicine list" }), h("p", { class: "meta", text: "Printed " + today() + " from Stark Caregiver. Ask the pharmacist or doctor to check it is complete and current." }),
      h("p", { class: "medline-print", text: C.DISCLAIMER }),
      people.map(function (p) {
        var ms = v.meds.filter(function (m) { return m.person === p.id && L.medOn(m, today()); }), hr = v.health[p.id] || {};
        return h("section", null, h("h2", { text: p.name + (p.dob ? ", born " + p.dob : "") }), hr.allergies ? h("p", null, h("strong", { text: "Allergies: " }), hr.allergies) : null,
          ms.length ? h("table", null, h("thead", null, h("tr", null, ["Medicine", "Dose", "Times", "How", "For", "Prescriber", "Pharmacy"].map(function (x) { return h("th", { text: x }); }))),
            h("tbody", null, ms.map(function (m) { return h("tr", null, [m.name, m.dose, m.prn ? "As needed" : L.parseTimes(m.times).join(", "), m.how, m.purpose, m.prescriber, m.pharmacy].map(function (c) { return h("td", { text: c || "" }); })); }))) : h("p", { text: "No current medicines listed." }));
      }));
  }

  /* ======================= Diary and the doctor summary ======================= */
  function editEntry(kind, e) {
    if (!e && A.gate && A.gate("diary")) return;
    var v = vault(), w = by(), isNew = !e, pid = A.S.person !== "all" ? A.S.person : v.people[0].id, fields, title;
    e = e || { id: V.uid(), kind: kind, person: pid, date: today(), time: kind === "appointment" ? "" : V.nowHM(), leadDays: "3" };
    kind = e.kind;
    var who = { k: "person", label: "For", type: "select", options: A.peopleOpts(false), req: true };
    if (kind === "appointment") {
      title = isNew ? "Add appointment" : "Edit appointment";
      fields = [who, { k: "date", label: "Date", type: "date", req: true }, { k: "time", label: "Time", type: "time" }, { k: "title", label: "What it is", req: true, ph: "Memory clinic review" },
        { k: "type", label: "Kind", type: "select", options: [""].concat(C.APPT_KINDS) }, { k: "with", label: "Who with", ph: "Dr Okafor" }, { k: "place", label: "Where", ph: "Riverside General, clinic 4", wide: true },
        { k: "leadDays", label: "Remind me before", type: "select", options: [{ v: "1", l: "1 day" }, { v: "3", l: "3 days" }, { v: "7", l: "1 week" }] },
        { k: "questions", label: "Questions to ask (one per line)", type: "textarea", wide: true, ph: "Is the new tablet the reason for the dizziness?\nCan we get help with bathing?" },
        { k: "outcome", label: "What was said, after the visit", type: "textarea", wide: true, ph: "Blood test in 2 weeks. Keep the same tablets." }];
    } else if (kind === "symptom") {
      title = isNew ? "Note a symptom" : "Edit symptom";
      fields = [who, { k: "date", label: "Date", type: "date", req: true }, { k: "time", label: "Time", type: "time" }, { k: "what", label: "What you noticed", type: "select", options: C.SYMPTOMS, req: true },
        { k: "severity", label: "How bad, 1 to 5", type: "select", options: [{ v: "", l: "Not sure" }].concat(C.SEVERITY) },
        { k: "notes", label: "Details", type: "textarea", wide: true, ph: "Right knee, worse on the stairs. Better after resting." }];
    } else {
      title = isNew ? "Add an observation" : "Edit observation";
      fields = [who, { k: "date", label: "Date", type: "date", req: true }, { k: "time", label: "Time", type: "time" }, { k: "title", label: "What", req: true, wide: true, ph: "Ate all of lunch, chatty in the afternoon" },
        { k: "notes", label: "Details", type: "textarea", wide: true }];
    }
    U.openForm(title, fields, e, function (o) {
      if (o.time && L.hm(o.time) == null) { U.toast("Enter the time as HH:MM.", true); return false; }
      o.id = e.id; o.kind = kind; o.time = o.time ? L.fmtHm(L.hm(o.time)) : ""; o.by = e.by || w.by; o.byName = e.byName || w.byName;
      A.upsert(v.diary, o); A.save(); A.render();
    }, kind === "symptom" ? h("p", { class: "fine", text: "Write down what you see; the doctor will decide what it means. If something is sudden or severe, call the doctor or emergency services rather than waiting." }) : null);
  }
  function entryLine(e) {
    var head = e.kind === "appointment" ? (e.title || e.with || "Appointment") : e.kind === "symptom" ? (e.what || "Symptom") + (e.severity ? " · " + e.severity + " of 5" : "") : (e.title || "Observation");
    return h("li", { class: "entry " + e.kind }, h("span", { class: "when", text: e.date.slice(5) + (e.time ? " " + e.time : "") }),
      h("div", { class: "grow" }, h("strong", { text: head }), " ", badge(e.kind === "appointment" ? "Appointment" : e.kind === "symptom" ? "Symptom" : "Observation", e.kind === "symptom" ? "soon" : "mute"),
        vault().people.length > 1 ? h("span", { class: "muted", text: " " + A.pname(e.person) }) : null,
        e.kind === "appointment" ? h("div", { class: "fine", text: [e.with, e.place].filter(Boolean).join(" · ") }) : null,
        e.notes ? h("p", { class: "pre fine", text: e.notes }) : null,
        e.kind === "appointment" && e.outcome ? h("p", { class: "pre fine" }, h("strong", { text: "Said: " }), e.outcome) : null,
        e.byName ? h("div", { class: "fine", text: "Noted by " + e.byName }) : null),
      A.actions(e, vault().diary, function (x) { editEntry(x.kind, x); }));
  }
  A.views.diary = function () {
    var v = vault(), t = today(), pid = A.S.person, from = V.addDays(t, -29), next = L.upcoming(v, t, pid), recent = L.diaryFor(v, pid, from, t, UI.diaryKind).filter(function (e) { return !(e.kind === "appointment" && e.date >= t); });
    var wrap = h("div", null, A.section("Diary", "Appointments, symptoms and anything you notice. It builds a one-page summary to take to the doctor.",
      [btn("Doctor summary", "primary", summaryDialog), ro() ? null : btn("Add appointment", "", function () { editEntry("appointment"); }), ro() ? null : btn("Note a symptom", "", function () { editEntry("symptom"); }),
        ro() ? null : btn("Add an observation", "", function () { editEntry("observation"); })]));
    var f = A.personFilterBar(); if (f) wrap.appendChild(f);
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Coming up" }), next.length ? h("ul", { class: "entries" }, next.map(function (e) {
      var li = entryLine(e); if (e.questions) li.querySelector(".grow").appendChild(h("p", { class: "pre fine" }, h("strong", { text: "To ask: " }), e.questions)); return li;
    })) : h("p", { class: "muted", text: "No appointments booked." })));
    var groups = L.symptomGroups(L.diaryFor(v, pid, from, t));
    wrap.appendChild(h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "The last 30 days" }),
      h("select", { id: "diary-kind", "aria-label": "Which entries to show", onchange: function (e) { UI.diaryKind = e.target.value; A.render(); } },
        [["", "Everything"], ["appointment", "Appointments"], ["symptom", "Symptoms"], ["observation", "Observations"]].map(function (o) { return h("option", { value: o[0], text: o[1], selected: o[0] === UI.diaryKind }); }))),
      recent.length ? h("ul", { class: "entries" }, recent.map(entryLine)) : h("p", { class: "muted", text: "Nothing noted in the last 30 days." })));
    if (groups.length) wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "What you noted most often" }), h("p", { class: "fine", text: "Counts of what you wrote down, to help you describe it to the doctor. They are not a measure of anything." }),
      tblScroll(h("table", { class: "plain-tbl" }, h("thead", null, h("tr", null, ["What", "Times noted", "Worst (1 to 5)", "First", "Last"].map(function (x) { return h("th", { text: x }); }))),
        h("tbody", null, groups.map(function (g) { return h("tr", null, [g.what, g.n, g.worst || "", g.first, g.last].map(function (x) { return h("td", { text: String(x) }); })); }))))));
    return wrap;
  };
  function summaryDialog() {
    var v = vault(), t = today(), pid = A.S.person !== "all" ? A.S.person : v.people[0].id, dlg, preview = h("div", { class: "paper", hidden: true }), err = h("p", { class: "form-err", role: "alert", hidden: true });
    var opts = function () {
      var p = sel("#ds-person", dlg).value, a = sel("#ds-from", dlg).value, b = sel("#ds-to", dlg).value;
      if (isNaN(V.dayNum(a)) || isNaN(V.dayNum(b)) || a > b) { err.hidden = false; err.textContent = "Choose a start date before the end date."; return null; }
      err.hidden = true; return { pid: p, from: a, to: b, questions: sel("#ds-q", dlg).value, by: A.byName() };
    };
    var go = function (print) {
      var o = opts(); if (!o) return;
      var m = L.doctorSummary(v, o.pid, { from: o.from, to: o.to, questions: o.questions, by: o.by, today: t, now: V.nowHM() });
      if (print) return A.printNode(renderSummary(m));
      U.clear(preview).appendChild(renderSummary(m)); preview.hidden = false; preview.scrollIntoView({ block: "start" });
    };
    dlg = U.modal("Bring to the doctor", h("div", { class: "dlg-body" },
      h("p", { class: "muted", text: "One page with the current medicines and how many doses were logged, allergies, what you noticed, recent appointments, and your questions." }),
      h("div", { class: "grid2" },
        h("div", { class: "field" }, h("label", { for: "ds-person", text: "For" }), h("select", { id: "ds-person" }, A.peopleOpts(false).map(function (o) { return h("option", { value: o.v, text: o.l, selected: o.v === pid }); }))),
        h("div", { class: "field" }, h("label", { for: "ds-from", text: "From" }), h("input", { id: "ds-from", type: "date", value: V.addDays(t, -29) })),
        h("div", { class: "field" }, h("label", { for: "ds-to", text: "To" }), h("input", { id: "ds-to", type: "date", value: t })),
        h("div", { class: "field wide" }, h("label", { for: "ds-q", text: "Other questions to ask (one per line)" }), h("textarea", { id: "ds-q", rows: 3, maxlength: 2000, placeholder: "Questions you write in the next appointment's diary entry are added automatically." }))),
      err, h("p", { class: "fine", text: "Nothing you type here is saved. The printed page is not encrypted." }),
      h("div", { class: "row end" }, btn("Preview", "", function () { go(false); }), btn("Print", "primary", function () { go(true); })), preview), { wide: true });
  }
  function renderSummary(m) {
    var sec = function (title, kids) { return h("section", { class: "ds-sec" }, h("h2", { text: title }), kids); };
    return h("div", { class: "printdoc summary" },
      h("p", { class: "kicker", text: "Stark Caregiver · Bring to the doctor" }), h("h1", { text: m.person }),
      h("p", { class: "meta", text: [m.dob ? "Born " + m.dob : "", "Notes from " + m.from + " to " + m.to, "Printed " + m.printed + (m.by ? " by " + m.by : "")].filter(Boolean).join(" · ") }),
      h("p", { class: "medline-print", text: C.DISCLAIMER }),
      m.allergies || m.conditions || m.communication ? h("dl", null, row("Allergies", m.allergies), row("Conditions (as recorded)", m.conditions), row("Communication", m.communication)) : null,
      sec("Medicines now", m.meds.length ? h("table", null, h("thead", null, h("tr", null, ["Medicine", "Dose", "How and when", "For", "Doses logged in this period"].map(function (x) { return h("th", { text: x }); }))),
        h("tbody", null, m.meds.map(function (x) { var s = x.stats; return h("tr", null, [x.name, x.dose, x.how, x.purpose, s.prn ? s.given + " logged" : s.given + " given, " + s.missed + " missed, " + s.open + " not logged (of " + s.scheduled + ")"].map(function (c) { return h("td", { text: String(c || "") }); })); })))
        : h("p", { text: "No current medicines recorded." })),
      sec("What we noticed", m.symptoms.length ? h("table", null, h("thead", null, h("tr", null, ["What", "Times noted", "Worst (1 to 5)", "First", "Last"].map(function (x) { return h("th", { text: x }); }))),
        h("tbody", null, m.symptoms.map(function (g) { return h("tr", null, [g.what, g.n, g.worst || "", g.first, g.last].map(function (c) { return h("td", { text: String(c) }); })); }))) : h("p", { text: "No symptoms noted in this period." })),
      m.notes.length ? sec("Recent notes", h("ul", { class: "plain" }, m.notes.map(function (n) { return h("li", { text: n.date + (n.time ? " " + n.time : "") + ": " + n.what + (n.text ? ". " + n.text : "") }); }))) : null,
      m.appointments.length ? sec("Recent appointments", h("ul", { class: "plain" }, m.appointments.map(function (a) { return h("li", { text: a.date + ": " + a.title + (a.outcome ? ". Said: " + a.outcome : "") }); }))) : null,
      m.next ? h("p", null, h("strong", { text: "Next appointment: " }), m.next.date + (m.next.time ? " " + m.next.time : "") + ", " + m.next.title + (m.next.where ? ", " + m.next.where : "")) : null,
      sec("Questions to ask", m.questions.length ? h("ol", { class: "qs" }, m.questions.map(function (q) { return h("li", null, h("span", { text: q }), h("span", { class: "answer-line", "aria-hidden": "true" })); })) : h("p", { text: "None written down." })),
      h("p", { class: "foot", text: m.footer }));
  }
  A.ext.renderSummary = renderSummary;

  /* ======================= Care rota ======================= */
  function rota() { return L.clean(vault().rota); }
  function editHelper(p) {
    var R = rota(), isNew = !p; p = p || { id: V.uid(), off: [] };
    var vals = { name: p.name, rel: p.rel, phone: p.phone, notes: p.notes }; C.WEEKDAYS.forEach(function (d, i) { vals["off" + i] = (p.off || []).map(Number).indexOf(i) !== -1; });
    U.openForm(isNew ? "Add a helper" : "Edit helper", [{ k: "name", label: "Name", req: true }, { k: "rel", label: "Relationship", ph: "Daughter, neighbour, agency carer" }, { k: "phone", label: "Phone", type: "tel", max: 40 },
      { k: "notes", label: "Notes", ph: "Can drive to appointments; not after 8 pm", wide: true }].concat(C.WEEKDAYS.map(function (d, i) { return { k: "off" + i, label: "Cannot do " + d, type: "checkbox" }; })), vals, function (o) {
      var n = { id: p.id, name: o.name, rel: o.rel, phone: o.phone, notes: o.notes, off: [] };
      C.WEEKDAYS.forEach(function (d, i) { if (o["off" + i]) n.off.push(i); });
      A.upsert(R.helpers, n); A.save(); A.render();
    }, h("p", { class: "fine", text: "Tick the days this person cannot do. Fill gaps fairly never puts them on those days." }));
  }
  function editShift(sh) {
    var R = rota(), isNew = !sh; sh = sh || { id: V.uid(), date: UI.rotaFrom || today(), start: "08:00", end: "10:00", role: "", need: "1", person: "" };
    U.openForm(isNew ? "Add a shift" : "Edit shift", [{ k: "date", label: "Date", type: "date", req: true }, { k: "role", label: "What it is", req: true, ph: "Morning visit" },
      { k: "start", label: "Starts", type: "time", req: true }, { k: "end", label: "Ends", type: "time", req: true, help: "An end before the start means the shift runs overnight." },
      { k: "need", label: "People needed", type: "number", min: 1, step: 1, inputmode: "numeric" }, { k: "person", label: "Who for", type: "select", options: whoOpts() },
      { k: "notes", label: "Notes", ph: "Medicines at 08:00, breakfast, help to wash", wide: true }], sh, function (o) {
      if (L.hm(o.start) == null || L.hm(o.end) == null) { U.toast("Enter times as HH:MM.", true); return false; }
      o.id = sh.id; o.start = L.fmtHm(L.hm(o.start)); o.end = L.fmtHm(L.hm(o.end)); o.need = Math.max(1, Math.min(20, Math.round(+o.need || 1)));
      A.upsert(R.shifts, o); A.save(); A.render();
    });
  }
  function repeatDialog() {
    var R = rota(), extra = h("div", null, h("p", { class: "fine", text: "Common patterns:" }), h("div", { class: "row tight wrap" }, C.ROTA_STARTERS.map(function (s) {
      return btn(s.role + " " + s.start + "-" + s.end, "tiny", function () { var f = this.closest("form"); sel("#f-role", f).value = s.role; sel("#f-start", f).value = s.start; sel("#f-end", f).value = s.end; });
    })));
    var vals = { role: "", start: "", end: "", need: "1", from: UI.rotaFrom || today(), days: "14", person: "" }; C.WEEKDAYS.forEach(function (d, i) { vals["wd" + i] = true; });
    U.openForm("Repeat a regular visit", [{ k: "role", label: "What it is", req: true, ph: "Morning visit" }, { k: "need", label: "People needed", type: "number", min: 1, step: 1 },
      { k: "start", label: "Starts", type: "time", req: true }, { k: "end", label: "Ends", type: "time", req: true }, { k: "from", label: "First day", type: "date", req: true },
      { k: "days", label: "For", type: "select", options: [{ v: "7", l: "1 week" }, { v: "14", l: "2 weeks" }, { v: "28", l: "4 weeks" }] }, { k: "person", label: "Who for", type: "select", options: whoOpts() }]
      .concat(C.WEEKDAYS.map(function (d, i) { return { k: "wd" + i, label: d, type: "checkbox" }; })), vals, function (o) {
      var wd = []; C.WEEKDAYS.forEach(function (d, i) { if (o["wd" + i]) wd.push(i); });
      if (!wd.length) { U.toast("Tick at least one day of the week.", true); return false; }
      var n = L.addRepeating(R, { role: o.role, start: o.start, end: o.end, need: o.need, person: o.person }, o.from, +o.days, wd);
      if (!n && (L.hm(o.start) == null || L.hm(o.end) == null)) { U.toast("Enter times as HH:MM.", true); return false; }
      A.save(); A.render(); U.toast(n ? "Added " + n + " shifts. Now press Fill gaps fairly, or add people by hand." : "Those shifts are already on the rota.");
    }, extra);
  }
  function handoverForm(sh) {
    var R = rota(), cur = A.curBy();
    U.openForm("Handover note", [{ k: "by", label: "From", type: "select", options: A.helperOpts(), req: true }, { k: "person", label: "About", type: "select", options: whoOpts() },
      { k: "date", label: "Date", type: "date", req: true }, { k: "time", label: "Time", type: "time" },
      { k: "text", label: "How things went", type: "textarea", req: true, wide: true, ph: "Ate most of lunch. A bit muddled after the nap. Medicines at 12:00 given." },
      { k: "next", label: "For the next person", type: "textarea", wide: true, ph: "Running low on pads. Remind her about the call with Sam at 6." }],
      { by: cur ? cur.id : "", person: sh && sh.person || "", date: sh ? sh.date : today(), time: V.nowHM() }, function (o) {
        if (o.time && L.hm(o.time) == null) { U.toast("Enter the time as HH:MM.", true); return false; }
        L.addHandover(R, { date: o.date, time: o.time ? L.fmtHm(L.hm(o.time)) : "", by: o.by, byName: L.helperName(R, o.by), person: o.person, shift: sh ? sh.id : "", text: o.text, next: o.next });
        A.save(); A.render(); U.toast("Handover saved. The next person sees it on Today.");
      });
  }
  A.ext.handover = function () { handoverForm(null); };
  A.views.rota = function () {
    var R = rota(), from = UI.rotaFrom || today(), to = V.addDays(from, UI.rotaDays - 1), cov = L.coverage(R, from, to), cf = L.conflicts(R, from, to), hrs = L.hoursBy(R, from, to);
    var wrap = h("div", null, A.section("Care rota", "Who covers which visit, where the gaps are, and handover notes between helpers.",
      ro() ? [btn("Print rota", "", function () { A.printNode(rotaDoc(R, from, to)); })] : [btn("Fill gaps fairly", "primary", function () {
        if (!R.helpers.length || !cov.rows.length) return U.toast("Add helpers and shifts first.", true);
        var r = L.autoFill(R, from, to); A.save(); A.render();
        U.toast("Added " + r.added + " assignment" + (r.added === 1 ? "" : "s") + ", spreading hours evenly, never double-booking and never on a day someone cannot do." + (r.gaps ? " Still short: " + r.gaps + "." : ""));
      }), btn("Repeat a regular visit", "", repeatDialog), btn("Add shift", "", function () { editShift(); }), btn("Write a handover", "", function () { handoverForm(null); }),
      btn("Spreadsheet (CSV)", "", function () { U.downloadText("care-rota-" + from + ".csv", L.rotaCSV(R, from, to), "text/csv"); }), btn("Print rota", "", function () { A.printNode(rotaDoc(R, from, to)); })]));
    var w = A.whoBar(); if (w) wrap.appendChild(w);
    wrap.appendChild(h("div", { class: "row wrap daynav" }, btn("Earlier", "small", function () { UI.rotaFrom = V.addDays(from, -UI.rotaDays); A.render(); }),
      h("label", { for: "rota-from", text: "From" }), h("input", { id: "rota-from", type: "date", value: from, onchange: function (e) { if (!isNaN(V.dayNum(e.target.value))) { UI.rotaFrom = e.target.value; A.render(); } } }),
      h("select", { id: "rota-days", "aria-label": "How many days to show", onchange: function (e) { UI.rotaDays = +e.target.value; A.render(); } }, [7, 14, 28].map(function (n) { return h("option", { value: n, text: n + " days", selected: n === UI.rotaDays }); })),
      btn("Later", "small", function () { UI.rotaFrom = V.addDays(from, UI.rotaDays); A.render(); }), from !== today() ? btn("From today", "small", function () { UI.rotaFrom = ""; A.render(); }) : null));
    wrap.appendChild(h("div", { class: "stats" }, h("div", { class: "stat" }, h("b", { text: String(R.helpers.length) }), h("span", { text: "helpers" })), h("div", { class: "stat" }, h("b", { text: String(cov.rows.length) }), h("span", { text: "shifts" })),
      h("div", { class: "stat" + (cov.gaps ? " warn" : "") }, h("b", { text: String(cov.gaps) }), h("span", { text: cov.gaps === 1 ? "place to fill" : "places to fill" })), h("div", { class: "stat" + (cf.length ? " bad" : "") }, h("b", { text: String(cf.length) }), h("span", { text: "double bookings" }))));
    if (cov.gaps || cf.length) wrap.appendChild(h("div", { class: "card alert" }, h("h2", { text: "Needs attention" }), h("ul", { class: "tips" },
      cov.short.map(function (r) { return h("li", { text: A.dayLabel(r.shift.date) + ", " + r.shift.start + "-" + r.shift.end + " " + r.shift.role + ": needs " + r.gap + " more." }); }),
      cf.map(function (c) { return h("li", { text: c.helper.name + " is on two shifts at once: " + c.a.date + " " + c.a.role + " and " + c.b.role + "." }); }))));
    var days = L.days(from, to), byDay = {};
    cov.rows.forEach(function (r) { (byDay[r.shift.date] = byDay[r.shift.date] || []).push(r); });
    var sched = h("div", { class: "card" }, h("h2", { text: "Shifts" }));
    if (!cov.rows.length) sched.appendChild(A.empty("No shifts in these days. Press Repeat a regular visit to add the usual pattern, for example a morning and an evening visit every day."));
    days.forEach(function (d) {
      if (!byDay[d]) return;
      sched.appendChild(h("h3", { class: "sub", text: A.dayLabel(d) + (d === today() ? " (today)" : "") }));
      sched.appendChild(h("ul", { class: "shiftlist" }, byDay[d].map(function (r) {
        var s = r.shift, mine = R.assign[s.id] || [], avail = R.helpers.filter(function (p) { return mine.indexOf(p.id) < 0; });
        var add = ro() ? null : h("select", { "aria-label": "Add a person to " + s.role + " on " + s.date, onchange: function (e) { if (e.target.value) { L.assign(R, s.id, e.target.value, true); A.save(); A.render(); } } },
          [h("option", { value: "", text: "Add a person..." })].concat(avail.map(function (p) {
            var busy = L.shiftsOf(R, p.id).some(function (o) { return L.overlap(o, s); });
            return h("option", { value: p.id, text: p.name + (L.isOff(p, s.date) ? " (cannot do " + C.WEEKDAYS[L.weekday(s.date)] + ")" : busy ? " (busy then)" : "") });
          })));
        return h("li", { class: r.gap ? "gap" : "" }, h("span", { class: "slot", text: s.start + "-" + s.end }),
          h("div", { class: "grow" }, h("strong", { text: s.role }), s.person ? h("span", { class: "muted", text: " · " + A.pname(s.person) }) : null, s.notes ? h("div", { class: "fine", text: s.notes }) : null,
            h("div", { class: "chips" }, mine.map(function (id) {
              return h("span", { class: "pchip" }, L.helperName(R, id), ro() ? null : h("button", { type: "button", class: "x", "aria-label": "Take " + L.helperName(R, id) + " off " + s.role, text: "×", onclick: function () { L.assign(R, s.id, id, false); A.save(); A.render(); } }));
            }), add)),
          r.gap ? badge("Needs " + r.gap, "soon") : badge("Covered", "ok"),
          ro() ? null : h("div", { class: "row tight" }, btn("Handover", "tiny", function () { handoverForm(s); }), btn("Edit", "tiny", function () { editShift(s); }),
            btn("Delete", "tiny danger-o", function () { R.shifts.splice(R.shifts.indexOf(s), 1); L.clean(R); A.save(); A.render(); })));
      })));
    });
    var helpersCard = h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Helpers" }), ro() ? null : btn("Add a helper", "small primary", function () { editHelper(); })),
      R.helpers.length ? h("ul", { class: "medlist" }, hrs.map(function (x) {
        var p = x.helper;
        return h("li", null, h("div", { class: "grow" }, h("strong", { text: p.name }), p.rel ? h("span", { class: "muted", text: " · " + p.rel }) : null,
          h("div", { class: "fine", text: [p.phone, (p.off || []).length ? "cannot do " + p.off.map(function (i) { return C.WEEKDAYS[i]; }).join(", ") : "", p.notes].filter(Boolean).join(" · ") })),
          badge(Math.round(x.minutes / 6) / 10 + " h in these days", "mute"),
          ro() ? null : h("div", { class: "row tight" }, btn("Edit", "small", function () { editHelper(p); }), R.helpers.length > 1 ? btn("Remove", "small danger-o", function () {
            U.confirmBox("Remove " + p.name + "?", "They come off every shift. Their handover notes stay.", "Remove", true).then(function (ok) { if (ok) { R.helpers.splice(R.helpers.indexOf(p), 1); L.clean(R); A.save(); A.render(); } });
          }) : null));
      })) : A.empty("No helpers yet. Add yourself and anyone who shares the care."));
    var notes = L.latestHandovers(R, 8), hand = h("div", { class: "card" }, h("h2", { text: "Handover notes" }), notes.length ? h("ul", { class: "entries" }, notes.map(function (n) {
      return h("li", { class: "entry" }, h("span", { class: "when", text: n.date.slice(5) + (n.time ? " " + n.time : "") }), h("div", { class: "grow" }, h("strong", { text: n.byName || "Someone" }),
        n.person ? h("span", { class: "muted", text: " about " + A.pname(n.person) }) : null, h("p", { class: "pre fine", text: n.text }), n.next ? h("p", { class: "pre fine" }, h("strong", { text: "Next: " }), n.next) : null),
        ro() ? null : btn("Delete", "tiny danger-o", function () { U.confirmBox("Delete this handover note?", "It is removed for everyone who uses this record.", "Delete", true).then(function (ok) { if (ok) { R.handovers.splice(R.handovers.indexOf(n), 1); A.save(); A.render(); } }); }));
    })) : h("p", { class: "muted", text: "No handover notes yet. A few lines at the end of each visit saves the next person a lot of guessing." }));
    wrap.appendChild(sched);
    wrap.appendChild(h("div", { class: "grid2 gap" }, helpersCard, hand));
    return wrap;
  };
  function rotaDoc(R, from, to) {
    var cov = L.coverage(R, from, to);
    return h("div", { class: "printdoc roster" }, h("h1", { text: "Care rota, " + from + " to " + to }), h("p", { class: "meta", text: "Printed " + today() + " from Stark Caregiver." }),
      h("table", null, h("thead", null, h("tr", null, ["Day", "Time", "What", "Who", "Phone"].map(function (x) { return h("th", { text: x }); }))),
        h("tbody", null, cov.rows.map(function (r) {
          var ids = R.assign[r.shift.id] || [];
          return h("tr", null, [A.dayLabel(r.shift.date), r.shift.start + "-" + r.shift.end, r.shift.role, ids.map(function (id) { return L.helperName(R, id); }).join(", ") + (r.gap ? " (needs " + r.gap + " more)" : ""),
            ids.map(function (id) { var p = A.byId(R.helpers, id); return p && p.phone ? p.phone : ""; }).filter(Boolean).join(", ")].map(function (c) { return h("td", { text: c }); }));
        }))));
  }

  /* ======================= You: the carer's own check-in ======================= */
  function choiceGroup(name, legend, opts, cur) {
    return h("fieldset", { class: "choices" }, h("legend", { text: legend }), h("div", { class: "row wrap" }, opts.map(function (o) {
      var id = name + "-" + o.v;
      return h("label", { class: "choice", for: id }, h("input", { type: "radio", name: name, id: id, value: String(o.v), checked: String(cur) === String(o.v) }), h("span", { text: o.l }));
    })));
  }
  A.views.you = function () {
    var v = vault(), t = today(), cs = L.checkinSummary(v.checkins, t), mine = cs.todayDone ? cs.last : {};
    var wrap = h("div", null, A.section("You", "A short check-in, just for you. It stays private: never shared, printed or searched."));
    if (ro()) { wrap.appendChild(h("p", { class: "muted", text: "Check-ins are private to each carer and are never included in share files." })); wrap.appendChild(crisisCard()); return wrap; }
    var err = h("p", { class: "form-err", role: "alert", hidden: true }), note = h("input", { id: "ci-note", type: "text", maxlength: 200, value: mine.note || "", placeholder: "For example: an hour to myself on Saturday" });
    wrap.appendChild(h("div", { class: "card you-card" }, h("h2", { text: cs.todayDone ? "Your check-in today" : "How are you today?" }),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var f = e.target, feel = sel("input[name=feel]:checked", f), sleep = sel("input[name=sleep]:checked", f), brk = sel("input[name=brk]:checked", f);
        if (!feel) { err.hidden = false; err.textContent = "Choose how you are, even roughly. The other questions are optional."; return; }
        var rec = { id: mine.id || V.uid(), date: t, time: V.nowHM(), feel: +feel.value, sleep: sleep ? +sleep.value : "", brk: brk ? brk.value : "", note: note.value.trim() };
        if (cs.todayDone) v.checkins[v.checkins.indexOf(cs.last)] = rec; else v.checkins.push(rec);
        A.save(); A.render(); U.toast("Saved, privately. Thank you for checking in with yourself.");
      } },
        choiceGroup("feel", "How are you holding up?", C.FEEL, mine.feel), choiceGroup("sleep", "How did you sleep?", C.SLEEP, mine.sleep), choiceGroup("brk", "Have you had a real break in the last few days?", C.BREAK, mine.brk),
        h("div", { class: "field wide" }, h("label", { for: "ci-note", text: "One thing that would help this week (optional)" }), note), err,
        h("div", { class: "row" }, h("button", { type: "submit", class: "btn coral", text: cs.todayDone ? "Update my check-in" : "Save my check-in" })))));
    if (cs.tone) wrap.appendChild(h("div", { class: "card kind", role: "status" }, h("p", { class: "kind-text", text: C.KIND[cs.tone] }),
      cs.askForHelp ? h("p", null, h("strong", { text: "A gentle note: " }), cs.noBreakStreak >= 4 ? "you have not had a real break for a while. " : "you have marked several hard days recently. ",
        "That is a sign to ask for more help, not a failing. You could ask a relative to take a shift (the ", h("a", { href: "#/rota", text: "Care rota" }), " shows the gaps), call a carers' support line, or talk to your own doctor.") : null));
    wrap.appendChild(crisisCard());
    wrap.appendChild(h("div", { class: "grid2 gap" },
      h("div", { class: "card" }, h("h2", { text: "Ideas for a breather" }), h("ul", { class: "respite" }, C.RESPITE.map(function (r) { return h("li", null, h("strong", { text: r.t }), h("p", { class: "fine", text: r.d })); }))),
      supportCard(v)));
    var hist = v.checkins.slice().sort(function (a, b) { return (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")); }).slice(0, 14);
    if (hist.length) wrap.appendChild(h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Your recent check-ins" }),
      btn("Delete all my check-ins", "small danger-o", function () { U.confirmBox("Delete all your check-ins?", "They are removed from this care record. This cannot be undone.", "Delete", true).then(function (ok) { if (ok) { v.checkins = []; A.save(); A.render(); } }); })),
      h("ul", { class: "checkins" }, hist.map(function (c) {
        var f = (C.FEEL.filter(function (x) { return x.v === +c.feel; })[0] || {}).l || "", s = (C.SLEEP.filter(function (x) { return x.v === +c.sleep; })[0] || {}).l || "", b = (C.BREAK.filter(function (x) { return x.v === c.brk; })[0] || {}).l || "";
        return h("li", { class: "f" + (+c.feel || 0) }, h("span", { class: "when", text: c.date.slice(5) }), h("strong", { text: f }), h("span", { class: "fine", text: [s ? "sleep: " + s.toLowerCase() : "", b ? "break: " + b.toLowerCase() : "", c.note].filter(Boolean).join(" · ") }));
      }))));
    return wrap;
  };
  function crisisCard() {
    return h("div", { class: "card crisis" }, h("h2", { text: "If things feel unsafe" }),
      h("p", { text: "If you feel you might harm yourself, or you cannot keep yourself or the person you care for safe, please reach out now." }),
      A.ext.emergencyNumber ? A.ext.emergencyNumber(true) : null,
      h("p", { class: "fine", text: "Shown as information only: numbers can change, so confirm them where you live. The crisis lines were checked in November 2026. Stark Caregiver cannot call anyone for you." }));
  }
  function supportCard(v) {
    var mine = v.contacts.filter(function (c) { return /Respite|support line/i.test(c.role || ""); });
    return h("div", { class: "card" }, h("h2", { text: "Your support list" }), h("p", { class: "fine", text: "Respite services, support lines and groups near you. Add the ones you find, so they are here on a hard day." }),
      mine.length ? h("ul", { class: "medlist" }, mine.map(function (c) { return h("li", null, h("div", { class: "grow" }, h("strong", { text: c.name }), h("div", { class: "fine", text: [c.role, c.phone, c.hours].filter(Boolean).join(" · ") }))); })) : h("p", { class: "muted", text: "Nothing saved yet." }),
      ro() ? null : btn("Add a support contact", "small", function () { A.editContact(null, { role: "Carer support line or group" }); }));
  }
})();
