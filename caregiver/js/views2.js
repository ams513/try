/* Stark Caregiver, by Stark: reminders and calendar file, emergency plan, hospital bag and binder, search.
   Every record lives inside the encrypted care record. Built with textContent only, never parsed markup. */
(function () {
  "use strict";
  var A = window.CareApp, V = CareCore, C = CareContent, U = CareUI, K = CareKit, h = U.h;
  var btn = A.btn, badge = A.badge, row = A.row;
  function vault() { return A.S.vault; }
  function ro() { return A.ro(); }
  function house(pid) { return !pid || pid === "household"; }
  function whoOpts() { return [{ v: "household", l: "Everyone" }].concat(A.peopleOpts(false)); }
  function leadOpts(list) { return list.map(function (d) { return { v: String(d[0]), l: d[1] }; }); }

  /* ---------- Reminders ---------- */
  A.views.reminders = function () {
    var v = vault(), t = V.todayStr(), all = K.allReminders(v, t, { includeOk: true, person: A.S.person }),
      due = all.filter(function (r) { return r.state !== "ok"; }), later = all.filter(function (r) { return r.state === "ok"; });
    var wrap = h("div", null, A.section("Reminders", "Refills, appointments, document renewals and your own repeating checks, in one list.",
      [btn("Calendar file (.ics)", "", function () { window.StarkTrial.show("calendar_file"); }), ro() ? null : btn("Add reminder", "primary", function () { editTask(); })]));
    var f = A.personFilterBar(); if (f) wrap.appendChild(f);
    wrap.appendChild(h("p", { class: "fine", text: "The app cannot alert you while it is closed. Reminders show here and on Today whenever you unlock it; save a calendar file so your phone or calendar reminds you too. Reminders can fail, so never rely on them alone." }));
    wrap.appendChild(h("div", { class: "card" + (due.length ? " alert" : "") }, h("h2", { text: "Overdue and due soon (" + due.length + ")" }), A.remList(due)));
    var tasks = v.tasks.filter(function (x) { return house(x.person) || A.visible(x.person); }).sort(function (a, b) { return (a.due || "9").localeCompare(b.due || "9"); });
    wrap.appendChild(h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Your repeating checks" }),
      ro() ? null : btn("Add suggested checks", "small", addSuggested)),
      tasks.length ? h("ul", { class: "tasklist" }, tasks.map(function (x) {
        var st = V.reminderStatus({ expires: x.due, leadDays: x.leadDays == null || x.leadDays === "" ? 14 : +x.leadDays }), rep = C.REPEAT.filter(function (r) { return r.v === String(x.repeat || ""); })[0];
        return h("li", { class: st.state }, h("div", { class: "grow" }, h("strong", { text: x.title }), h("div", { class: "fine", text: [x.due ? "Due " + x.due : "No date", rep ? rep.l.toLowerCase() : "", house(x.person) ? "" : A.pname(x.person), x.lastDone ? "last done " + x.lastDone : ""].filter(Boolean).join(" · ") })),
          st.state !== "none" ? badge(st.state === "expired" ? "Overdue" : st.state === "soon" ? "Soon" : "Later", st.state) : null,
          ro() ? null : h("div", { class: "row tight" }, btn("Done", "small primary", function () { taskDone(x); }), btn("Edit", "small", function () { editTask(x); }),
            btn("Delete", "small danger-o", function () { U.confirmBox("Delete this check?", "It is removed from Reminders.", "Delete", true).then(function (ok) { if (ok) { v.tasks.splice(v.tasks.indexOf(x), 1); A.save(); A.render(); } }); })));
      })) : A.empty("No repeating checks yet. Add your own, or the suggested ones: repeat prescriptions, the hospital bag, the rota, and something restful for you.")));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Later" }), later.length ? A.remList(later, 40) : h("p", { class: "muted", text: "Nothing else has a date yet." })));
    return wrap;
  };
  function taskFields() {
    return [{ k: "title", label: "What to do", req: true, wide: true, ph: "Order repeat prescriptions" }, { k: "due", label: "Next due", type: "date", req: true },
      { k: "repeat", label: "Repeats", type: "select", options: C.REPEAT }, { k: "leadDays", label: "Show it before", type: "select", options: leadOpts([[0, "On the day"], [3, "3 days"], [7, "1 week"], [14, "2 weeks"]]) },
      { k: "person", label: "For", type: "select", options: whoOpts() }, { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true }];
  }
  function editTask(x) {
    var v = vault(); x = x || { id: V.uid(), due: V.addDays(V.todayStr(), 7), repeat: "1", leadDays: "3", person: "household" };
    U.openForm(v.tasks.indexOf(x) < 0 ? "Add reminder" : "Edit reminder", taskFields(), x, function (o) { o.id = x.id; o.lastDone = x.lastDone || ""; A.upsert(v.tasks, o); A.save(); A.render(); });
  }
  function taskDone(x) {
    var v = vault(), next = K.nextDue(x, V.todayStr());
    if (!next) { v.tasks.splice(v.tasks.indexOf(x), 1); U.toast("Done. It did not repeat, so it was removed."); }
    else { x.due = next; x.lastDone = V.todayStr(); U.toast("Done. Next due " + next + "."); }
    A.save(); A.render();
  }
  function addSuggested() {
    var v = vault(), n = 0, due = V.addDays(V.todayStr(), 7);
    C.TASK_SUGGESTIONS.forEach(function (s) {
      if (v.tasks.some(function (x) { return x.title === s.title; })) return;
      v.tasks.push({ id: V.uid(), title: s.title, due: due, repeat: s.repeat, leadDays: "3", person: "household", notes: "" }); n++;
    });
    A.save(); A.render(); U.toast(n ? "Added " + n + " suggested checks. Adjust the dates to suit you." : "All suggested checks are already there.");
  }
  /* calendar file: full version only */
  /* ---------- Emergency plan, hospital bag and the binder ---------- */
  A.views.emergency = function () {
    var v = vault(), e = v.emergency, filled = C.EMERGENCY.filter(function (f) { return e[f.k]; }), bag = K.goBag(v, V.todayStr()), packed = function () { return bag.filter(function (b) { return (e.bag || {})[b.id]; }).length; };
    var wrap = h("div", null, A.section("Emergency", "Who to call, the usual hospital, equipment back-ups and the hospital bag. Then print it all in one binder.",
      [ro() ? null : btn(filled.length ? "Edit plan" : "Write the plan", "primary", editPlan), btn("Build the binder", "", function () { window.StarkTrial.show("binder"); })]));
    wrap.appendChild(h("p", { class: "fine", text: "In an emergency, call your local emergency number first and follow their instructions. This page records your family's own arrangements." }));
    if (A.ext.emergencyNumber) wrap.appendChild(h("div", { class: "card emg-card" }, A.ext.emergencyNumber(false)));
    var hz = e.hazards || [];
    wrap.appendChild(h("div", { class: "grid2 gap" },
      h("div", { class: "card" }, h("h2", { text: "The plan" }), filled.length ? h("dl", { class: "wide-dl" }, filled.map(function (f) { return row(f.label, e[f.k]); })) : A.empty("No plan yet. It takes about 10 minutes: who to call first, the usual hospital, and where the key papers are."),
        e.updated ? h("p", { class: "fine", text: "Updated " + e.updated }) : null),
      h("div", { class: "card" }, h("h2", { text: "Hazards to plan for" }), h("p", { class: "fine", text: "Tick what could happen where you live. The bag list adapts." }),
        h("div", { class: "hz" }, C.HAZARDS.map(function (x) {
          return h("label", { class: "chk" }, h("input", { type: "checkbox", id: "hz-" + x.id, checked: hz.indexOf(x.id) !== -1, disabled: ro(), onchange: function (ev) {
            var s = (e.hazards || []).filter(function (y) { return y !== x.id; }); if (ev.target.checked) s.push(x.id); e.hazards = s; A.save(); A.render(); } }), x.l);
        })))));
    var count = h("span", { class: "badge soon", text: packed() + " of " + bag.length + " packed" }), fill = h("span", { class: "prog-fill" }), groups = {};
    bag.forEach(function (b) { (groups[b.group] = groups[b.group] || []).push(b); });
    wrap.appendChild(h("section", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Hospital and emergency bag" }), count), h("div", { class: "prog" }, fill),
      h("p", { class: "fine", text: "Built from the medicines, ages, allergies and hazards in this record. Tick what is packed; check it every few months." }),
      Object.keys(groups).map(function (g) {
        return h("div", null, h("h3", { class: "sub", text: g }), h("ul", { class: "baglist" }, groups[g].map(function (b) {
          var id = "bag-" + b.id;
          return h("li", null, h("input", { type: "checkbox", id: id, checked: !!(e.bag || {})[b.id], disabled: ro(), onchange: function (ev) {
            e.bag = e.bag || {}; if (ev.target.checked) e.bag[b.id] = true; else delete e.bag[b.id]; A.save();
            count.textContent = packed() + " of " + bag.length + " packed"; fill.style.width = Math.round(packed() * 100 / bag.length) + "%"; } }), h("label", { for: id, text: b.text }));
        })));
      })));
    fill.style.width = Math.round(packed() * 100 / Math.max(1, bag.length)) + "%";
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "In case of emergency binder" }),
      h("p", { text: "One printout for a hospital team or a new helper: who to call, health summaries and daily care, medicines with the last week's doses, appointments, the next 7 days of the rota, the plan and the bag, and where the documents are." }),
      h("p", { class: "fine", text: "Scans are never printed, and your own check-ins are never included. Printed pages are not encrypted: keep the binder somewhere safe." }),
      btn("Build the binder", "primary", function () { window.StarkTrial.show("binder"); })));
    return wrap;
  };
  function editPlan() {
    var v = vault();
    U.openForm("Emergency plan", C.EMERGENCY.map(function (f) { var c = {}; Object.keys(f).forEach(function (k) { c[k] = f[k]; }); c.warn = f.type === "textarea" || f.k === "vaultNote" || f.k === "access"; if (f.type === "textarea") c.rows = 2; return c; }), v.emergency, function (o) {
      o.hazards = v.emergency.hazards || []; o.bag = v.emergency.bag || {}; o.updated = V.todayStr(); v.emergency = o; A.save(); A.render();
    }, h("p", { class: "fine", text: "Agree the plan with the other helpers. Never write the passphrase itself, only where it can be found." }));
  }
  /* binder: full version only */
  /* ---------- Search ---------- */
  A.views.search = function () {
    var q = A.S.q || "", res = K.search(vault(), q, 80);
    var wrap = h("div", null, A.section("Search", q ? res.length + (res.length === 1 ? " result" : " results") + " for “" + q + "”" : "Type in the search box at the top. Every section except your private check-ins is searched, on this computer only."));
    if (!q) return wrap;
    if (!res.length) { wrap.appendChild(A.empty("Nothing matched. Try fewer or shorter words.")); return wrap; }
    wrap.appendChild(h("ul", { class: "searchres" }, res.map(function (r) {
      return h("li", { class: "card" }, h("a", { href: "#/" + r.route }, h("span", { class: "tag", text: r.section }), " ", h("strong", { text: r.title })), h("p", { class: "fine", text: r.snippet }));
    })));
    return wrap;
  };
})();
