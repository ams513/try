/* Stark Family Vault, by Stark: reminders, insurance, medicines, digital legacy, emergency plan and binder, search.
   Every record lives inside the encrypted vault. Built with textContent only, never parsed markup. */
(function () {
  "use strict";
  var A = window.VaultApp, V = StarkVault, C = VaultContent, U = VaultUI, K = VaultKit, h = U.h;
  var btn = A.btn, badge = A.badge, row = A.row;
  function vault() { return A.S.vault; }
  function ro() { return A.ro(); }
  function house(pid) { return !pid || pid === "household"; }
  function whoOpts() { return [{ v: "household", l: "Whole household" }].concat(A.peopleOpts(false)); }
  function whoName(pid) { return house(pid) ? "Household" : A.pname(pid); }
  function statusBadge(date, lead, words) {
    var st = V.reminderStatus({ expires: date, leadDays: lead });
    if (st.state === "none") return null;
    return badge(st.state === "expired" ? words[0] : st.state === "soon" ? words[1] : words[2], st.state);
  }
  function leadOpts(list) { return list.map(function (d) { return { v: String(d[0]), l: d[1] }; }); }

  /* ---------- Reminders ---------- */
  A.views.reminders = function () {
    var v = vault(), today = V.todayStr(), all = K.allReminders(v, today, { includeOk: true, person: A.S.person }),
      due = all.filter(function (r) { return r.state !== "ok"; }), later = all.filter(function (r) { return r.state === "ok"; });
    var wrap = h("div", null, A.section("Reminders", "Every date in the vault in one place: document expiry, insurance renewals, medicine refills, warranties and your own repeating checks.",
      [btn("Calendar file (.ics)", "", icsDialog), ro() ? null : btn("Add reminder", "primary", function () { editTask(); })]));
    var f = A.personFilterBar(); if (f) wrap.appendChild(f);
    wrap.appendChild(h("p", { class: "fine", text: "The vault cannot alert you while it is closed. Reminders show here and on Home whenever you unlock it." }));
    wrap.appendChild(h("div", { class: "card" + (due.length ? " alert" : "") }, h("h2", { text: "Overdue and due soon (" + due.length + ")" }), A.remList(due)));
    var tasks = v.tasks.filter(function (t) { return house(t.person) || A.visible(t.person); }).sort(function (a, b) { return (a.due || "9").localeCompare(b.due || "9"); });
    wrap.appendChild(h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Your repeating checks" }),
      ro() ? null : btn("Add suggested checks", "small", addSuggested)),
      tasks.length ? h("ul", { class: "tasklist" }, tasks.map(function (t) {
        var st = V.reminderStatus({ expires: t.due, leadDays: t.leadDays == null || t.leadDays === "" ? 14 : +t.leadDays }), rep = C.REPEAT.filter(function (r) { return r.v === String(t.repeat || ""); })[0];
        return h("li", { class: st.state }, h("div", { class: "grow" }, h("strong", { text: t.title }), h("div", { class: "fine", text: [t.due ? "Due " + t.due : "No date", rep ? rep.l.toLowerCase() : "", house(t.person) ? "" : A.pname(t.person), t.lastDone ? "last done " + t.lastDone : ""].filter(Boolean).join(" · ") })),
          st.state !== "none" ? badge(st.state === "expired" ? "Overdue" : st.state === "soon" ? "Soon" : "Later", st.state) : null,
          ro() ? null : h("div", { class: "row tight" }, btn("Done", "small primary", function () { taskDone(t); }), btn("Edit", "small", function () { editTask(t); }),
            btn("Delete", "small danger-o", function () { U.confirmBox("Delete this check?", "It is removed from Reminders.", "Delete", true).then(function (ok) { if (ok) { v.tasks.splice(v.tasks.indexOf(t), 1); A.save(); A.render(); } }); })));
      })) : A.empty("No repeating checks yet. Add your own, or the suggested ones: alarm tests, go-bag refresh, a yearly plan review and backups.")));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Later" }), later.length ? A.remList(later, 40) : h("p", { class: "muted", text: "Nothing else has a date yet." })));
    return wrap;
  };
  function taskFields() {
    return [{ k: "title", label: "What to do", req: true, wide: true, ph: "Test the smoke alarms" }, { k: "due", label: "Next due", type: "date", req: true },
      { k: "repeat", label: "Repeats", type: "select", options: C.REPEAT }, { k: "leadDays", label: "Show it before", type: "select", options: leadOpts([[0, "On the day"], [3, "3 days"], [7, "1 week"], [14, "2 weeks"], [30, "1 month"]]) },
      { k: "person", label: "For", type: "select", options: whoOpts() }, { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true }];
  }
  function editTask(t) {
    var v = vault(); t = t || { id: V.uid(), due: V.addDays(V.todayStr(), 7), repeat: "12", leadDays: "7", person: "household" };
    U.openForm(v.tasks.indexOf(t) < 0 ? "Add reminder" : "Edit reminder", taskFields(), t, function (o) { o.id = t.id; o.lastDone = t.lastDone || ""; A.upsert(v.tasks, o); A.save(); A.render(); });
  }
  function taskDone(t) {
    var v = vault(), next = K.nextDue(t, V.todayStr());
    if (!next) { v.tasks.splice(v.tasks.indexOf(t), 1); U.toast("Done. It did not repeat, so it was removed."); }
    else { t.due = next; t.lastDone = V.todayStr(); U.toast("Done. Next due " + next + "."); }
    A.save(); A.render();
  }
  function addSuggested() {
    var v = vault(), n = 0, due = V.addDays(V.todayStr(), 14);
    if (A.canAdd && !A.canAdd()) return;
    C.TASK_SUGGESTIONS.forEach(function (s) {
      if (v.tasks.some(function (t) { return t.title === s.title; }) || (A.room && A.room() <= 0)) return;
      v.tasks.push({ id: V.uid(), title: s.title, due: due, repeat: s.repeat, leadDays: "7", person: "household", notes: "" }); n++;
    });
    A.save(); A.render(); U.toast(n ? "Added " + n + " suggested checks. Adjust the dates to suit you." : "All suggested checks are already there.");
  }
  function icsDialog() { window.StarkTrial.show("exports"); }
  /* ---------- Insurance ---------- */
  A.views.insurance = function () {
    var v = vault(), today = V.todayStr(), pols = v.policies.filter(function (p) { return house(p.person) || A.visible(p.person); }),
      yearly = pols.reduce(function (s, p) { return s + K.annualPremium(p); }, 0), due = K.allReminders(v, today).filter(function (r) { return r.src === "policy"; }).length;
    var wrap = h("div", null, A.section("Insurance", "Every policy in one place: who it covers, renewal dates, claims numbers and agents.", [ro() ? null : btn("Add policy", "primary", function () { editPolicy(); })]));
    wrap.appendChild(h("div", { class: "banner warn" }, h("strong", { text: "Last 4 characters only. " }), "Your insurer can find a policy from your name, address and the last digits. Never store full policy, card or account numbers."));
    wrap.appendChild(h("div", { class: "stats" }, h("div", { class: "stat" }, h("b", { text: String(pols.length) }), h("span", { text: "policies" })),
      h("div", { class: "stat" }, h("b", { text: A.money(yearly) }), h("span", { text: "premiums per year (your currency)" })),
      h("a", { class: "stat", href: "#/reminders" }, h("b", { text: String(due) }), h("span", { text: "renewals due soon" }))));
    var f = A.personFilterBar(); if (f) wrap.appendChild(f);
    var missing = C.POLICY_REVIEW.filter(function (t) { return !v.policies.some(function (p) { return p.type === t; }); });
    if (missing.length && !ro()) wrap.appendChild(h("p", { class: "fine", text: "Common types not listed yet: " + missing.join(", ") + ". Not every family needs every type; a licensed adviser can help you decide." }));
    if (!pols.length) { wrap.appendChild(A.empty("No policies yet. Add health, home, car and life policies with their renewal dates and claims numbers.")); return wrap; }
    pols.sort(function (a, b) { var x = V.daysUntil(a.renews, today), y = V.daysUntil(b.renews, today); return (x === null ? 1e9 : x) - (y === null ? 1e9 : y); });
    wrap.appendChild(h("div", { class: "cards" }, pols.map(function (p) {
      var st = V.reminderStatus({ expires: p.renews, leadDays: p.leadDays == null || p.leadDays === "" ? 30 : +p.leadDays }, today), r = { state: st.state, days: st.days, verb: "Renews", src: "policy" };
      return h("article", { class: "card item " + st.state }, h("div", { class: "item-top" }, h("h3", { text: p.insurer || "Policy" }), statusBadge(p.renews, p.leadDays == null || p.leadDays === "" ? 30 : +p.leadDays, ["Lapsed?", "Renew soon", "Active"]) || badge("No date")),
        h("p", { class: "muted", text: (p.type || "Policy") + " · " + whoName(p.person) }),
        h("dl", null, row("Policy", p.ref ? "ending " + p.ref : ""), row("Cover", p.cover), row("Premium", p.premium ? A.money(p.premium) + " " + (p.freq || "").toLowerCase() : ""),
          row("Renews", p.renews ? p.renews + " (" + (st.state === "expired" ? "date passed " + Math.abs(st.days) + " days ago" : K.dueText(r)) + ")" : ""), row("Agent", p.agent), row("Claims", p.claims), row("Beneficiaries", p.beneficiaries), row("Notes", p.notes)),
        h("div", { class: "row tight wrap" }, p.scan ? btn("View policy", "small", function () { U.viewScan(p.scan, p.insurer || "Policy"); }) : badge("No scan", "mute"),
          !ro() && p.renews ? btn("Mark renewed", "small", function () { renewPolicy(p); }) : null, A.actions(p, v.policies, editPolicy)));
    })));
    return wrap;
  };
  function editPolicy(p) {
    var v = vault(); p = p || { id: V.uid(), person: "household", freq: "Monthly", leadDays: "30" };
    U.openForm(v.policies.indexOf(p) < 0 ? "Add policy" : "Edit policy", [{ k: "type", label: "Type", type: "select", options: C.POLICY_TYPES, req: true }, { k: "insurer", label: "Insurer", req: true, ph: "Acme Insurance" },
      { k: "person", label: "Covers", type: "select", options: whoOpts() }, { k: "ref", label: "Policy number (last 4 only)", max: 4, ph: "4821", help: "Last 4 characters only." },
      { k: "cover", label: "Cover amount or limits", ph: "Buildings 350,000; contents 60,000", wide: true },
      { k: "premium", label: "Premium", type: "number", min: 0, step: "any", inputmode: "decimal" }, { k: "freq", label: "Paid", type: "select", options: K.PREMIUM_FREQ.map(function (x) { return x.v; }) },
      { k: "renews", label: "Renews or ends on", type: "date" }, { k: "leadDays", label: "Remind me before", type: "select", options: leadOpts([[14, "2 weeks"], [30, "30 days"], [60, "60 days"], [90, "90 days"]]) },
      { k: "agent", label: "Agent or broker", ph: "Name and phone" }, { k: "claims", label: "Claims phone or web address", ph: "Claims line 555-0123" },
      { k: "beneficiaries", label: "Beneficiaries (life and similar policies)", type: "textarea", wide: true, warn: true, rows: 2 },
      { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true }, { k: "scan", label: "Policy schedule or card (JPG, PNG or PDF up to 4 MB)", type: "scan", wide: true }], p, function (o) {
      o.ref = String(o.ref || "").replace(/[^A-Za-z0-9]/g, "").slice(-4); o.id = p.id; A.upsert(v.policies, o); A.save(); A.render();
    });
  }
  function renewPolicy(p) {
    U.openForm("Mark renewed: " + (p.insurer || "policy"), [{ k: "renews", label: "Next renewal date", type: "date", req: true }, { k: "premium", label: "New premium (optional)", type: "number", min: 0, step: "any" }],
      { renews: K.addMonths(p.renews, 12) || "", premium: p.premium }, function (o) { p.renews = o.renews; if (o.premium !== "") p.premium = o.premium; A.save(); A.render(); });
  }

  /* ---------- Medicines (shown inside Health) ---------- */
  A.ext.medsCard = function (people) {
    var v = vault(), card = h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Medicine lists" }),
      h("div", { class: "row tight" }, btn("Print list", "small", function () { A.printNode(medsDoc(people)); }), ro() ? null : btn("Add medicine", "small primary", function () { editMed(); }))),
      h("p", { class: "fine", text: "Name, dose and when to take each medicine, with refill dates that show in Reminders. Take the printed list to appointments and hospital visits. Record keeping only, not medical advice." }));
    people.forEach(function (p) {
      var ms = v.meds.filter(function (m) { return m.person === p.id; });
      card.appendChild(h("h3", { class: "sub", text: p.name }));
      card.appendChild(ms.length ? h("ul", { class: "medlist" }, ms.map(function (m) {
        return h("li", { class: m.active === false ? "stopped" : "" }, h("div", { class: "grow" }, h("strong", { text: m.name + (m.dose ? " " + m.dose : "") }), m.active === false ? " " : null, m.active === false ? badge("Stopped", "mute") : null,
          h("div", { class: "fine", text: [m.how, m.purpose ? "for " + m.purpose : "", m.prescriber ? "prescribed by " + m.prescriber : "", m.pharmacy ? "pharmacy: " + m.pharmacy : ""].filter(Boolean).join(" · ") }),
          m.refill && m.active !== false ? h("div", { class: "fine", text: "Refill due " + m.refill }) : null),
          m.refill && m.active !== false ? statusBadge(m.refill, m.leadDays == null || m.leadDays === "" ? 7 : +m.leadDays, ["Refill overdue", "Refill soon", "Refill later"]) : null,
          A.actions(m, v.meds, editMed));
      })) : h("p", { class: "muted", text: "No medicines listed." }));
    });
    return card;
  };
  function editMed(m) {
    var v = vault(); m = m || { id: V.uid(), person: A.S.person !== "all" ? A.S.person : v.people[0].id, active: true, leadDays: "7" };
    U.openForm(v.meds.indexOf(m) < 0 ? "Add medicine" : "Edit medicine", [{ k: "person", label: "For", type: "select", options: A.peopleOpts(false), req: true }, { k: "name", label: "Medicine", req: true, ph: "Metformin" },
      { k: "dose", label: "Strength and dose", ph: "500 mg, 1 tablet" }, { k: "how", label: "How and when", ph: "Twice a day with food" }, { k: "purpose", label: "What it is for", ph: "Blood sugar" },
      { k: "prescriber", label: "Prescribed by", ph: "Dr Lee" }, { k: "pharmacy", label: "Pharmacy", ph: "Main Street Pharmacy 555-0101" }, { k: "started", label: "Started on", type: "date" },
      { k: "refill", label: "Next refill due", type: "date" }, { k: "leadDays", label: "Remind me before", type: "select", options: C.MED_LEAD },
      { k: "active", label: "Taking it now", type: "checkbox", wide: true }, { k: "notes", label: "Notes (side effects, special instructions)", type: "textarea", wide: true, warn: true }], m, function (o) {
      o.id = m.id; A.upsert(v.meds, o); A.save(); A.render();
    });
  }
  function medsDoc(people) {
    var v = vault();
    return h("div", { class: "printdoc meds" }, h("h1", { text: "Medicine list" }), h("p", { class: "meta", text: "Printed " + V.todayStr() + ". Check with your doctor or pharmacist that it is complete and current." }),
      people.map(function (p) {
        var ms = v.meds.filter(function (m) { return m.person === p.id && m.active !== false; }), hr = v.health[p.id] || {};
        return h("section", null, h("h2", { text: p.name + (p.dob ? ", born " + p.dob : "") }), hr.allergies ? h("p", null, h("strong", { text: "Allergies: " }), hr.allergies) : null,
          ms.length ? h("table", null, h("thead", null, h("tr", null, ["Medicine", "Dose", "How and when", "For", "Prescriber", "Pharmacy", "Started"].map(function (t) { return h("th", { text: t }); }))),
            h("tbody", null, ms.map(function (m) { return h("tr", null, [m.name, m.dose, m.how, m.purpose, m.prescriber, m.pharmacy, m.started].map(function (c) { return h("td", { text: c || "" }); })); }))) : h("p", { text: "No current medicines listed." }));
      }));
  }

  /* ---------- Digital legacy and password hints ---------- */
  function hintWarn(val) { var w = K.passwordLike(val); return w.length ? "This looks like a real password: " + w.join("; ") + ". Write a hint only your family would understand, never the password itself." : ""; }
  A.views.digital = function () {
    var v = vault(), items = v.digital.filter(function (d) { return A.visible(d.person); });
    var wrap = h("div", null, A.section("Digital legacy", "Accounts and devices, what should happen to each, and hints that help your family get in.", [ro() ? null : btn("Add account or device", "primary", function () { editDigital(); })]));
    wrap.appendChild(h("div", { class: "banner warn" }, h("strong", { text: "Hints only, never passwords. " }), "Do not type a real password, PIN, recovery phrase or sign-in code here. A password manager with an emergency-access contact is the safe way to pass those on. The app warns you when a hint looks like a real password."));
    var f = A.personFilterBar(); if (f) wrap.appendChild(f);
    wrap.appendChild(items.length ? h("div", { class: "cards" }, items.map(function (d) {
      var hintEl = h("span", { class: "muted", text: d.hint ? "Hidden" : "none" }), shown = false;
      return h("article", { class: "card item" }, h("div", { class: "item-top" }, h("h3", { text: d.service }), badge(d.kind || "Account", "mute")),
        h("dl", null, row("Whose", A.pname(d.person)), row("Sign-in name", d.user),
          d.hint ? h("div", { class: "kv" }, h("dt", { text: "Password hint" }), h("dd", null, hintEl, " ", btn("Show", "tiny", function (e) { shown = !shown; hintEl.textContent = shown ? d.hint : "Hidden"; hintEl.className = shown ? "" : "muted"; e.target.textContent = shown ? "Hide" : "Show"; }))) : null,
          row("Sign-in codes go to", d.twofa), row("Legacy contact", d.legacy), row("Wish", d.action), row("Notes", d.notes)),
        A.actions(d, v.digital, editDigital));
    })) : A.empty("Nothing listed yet. Start with your main email, phone, password manager and photo storage: they unlock everything else."));
    A.S.vault.people.filter(function (p) { return A.visible(p.id); }).forEach(function (p) {
      var pl = v.plan[p.id] = v.plan[p.id] || { checks: {}, letter: {} }, dc = pl.dchecks = pl.dchecks || {}, done = C.DIGITAL_CHECKLIST.filter(function (i) { return dc[i.id]; }).length;
      wrap.appendChild(h("section", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Digital legacy checklist: " + p.name }), badge(done + " of " + C.DIGITAL_CHECKLIST.length, done === C.DIGITAL_CHECKLIST.length ? "ok" : "soon")),
        h("ul", { class: "checklist" }, C.DIGITAL_CHECKLIST.map(function (i) {
          var id = "dc-" + p.id + i.id;
          return h("li", null, h("input", { type: "checkbox", id: id, checked: !!dc[i.id], disabled: ro(), onchange: function (e) { dc[i.id] = e.target.checked ? V.todayStr() : ""; A.save(); A.render(); } }),
            h("div", null, h("label", { for: id, text: i.title }), h("p", { class: "fine", text: i.why })));
        }))));
    });
    return wrap;
  };
  function editDigital(d) {
    var v = vault(); d = d || { id: V.uid(), person: A.S.person !== "all" ? A.S.person : v.people[0].id, legacy: "Not checked", action: "Not decided" };
    U.openForm(v.digital.indexOf(d) < 0 ? "Add account or device" : "Edit account or device", [{ k: "person", label: "Whose", type: "select", options: A.peopleOpts(false), req: true },
      { k: "kind", label: "Type", type: "select", options: C.DIGITAL_KINDS }, { k: "service", label: "Service or device", req: true, wide: true, ph: "Main email, family iPad, photo storage" },
      { k: "user", label: "Sign-in name or email (optional)", ph: "alex@... or the account's nickname" },
      { k: "hint", label: "Password hint (never the password)", ph: "Our first street + the year we met", warn: true, live: hintWarn, help: "Something only your family would understand. Leave blank if it is in a password manager." },
      { k: "twofa", label: "Where sign-in codes go", ph: "Alex's phone, an authenticator app, printed codes in the fireproof box" },
      { k: "legacy", label: "Legacy contact", type: "select", options: C.LEGACY }, { k: "action", label: "Wish", type: "select", options: C.DIGITAL_ACTIONS },
      { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true }], d, function (o) {
      var store = function () { o.id = d.id; A.upsert(v.digital, o); A.save(); A.render(); }, w = K.passwordLike(o.hint);
      if (!w.length) return store();
      return U.confirmBox("That hint looks like a real password", "The hint " + w.join(" and ") + ". This vault must hold hints only. Save it only if it is a hint that would not work as the password itself.", "It is only a hint").then(function (ok) {
        if (!ok) return false; store();
      });
    });
  }

  /* ---------- Emergency plan, go-bag and the binder ---------- */
  A.views.emergency = function () {
    var v = vault(), e = v.emergency, filled = C.EMERGENCY.filter(function (f) { return e[f.k]; }), bag = K.goBag(v, V.todayStr()), packed = function () { return bag.filter(function (b) { return (e.bag || {})[b.id]; }).length; };
    var wrap = h("div", null, A.section("Emergency plan", "Where to meet, who to call, how to shut things off and what to grab.",
      [ro() ? null : btn(filled.length ? "Edit plan" : "Write the plan", "primary", editPlan), btn("Print plan", "", binderDialog), btn("Build the binder", "", binderDialog)]));
    wrap.appendChild(h("p", { class: "fine", text: "Follow official instructions first. Your local emergency services and civil protection agency publish advice for the hazards where you live; this plan records your family's own arrangements." }));
    var hz = e.hazards || [];
    wrap.appendChild(h("div", { class: "grid2 gap" },
      h("div", { class: "card" }, h("h2", { text: "The plan" }), filled.length ? h("dl", { class: "wide-dl" }, filled.map(function (f) { return row(f.label, e[f.k]); })) : A.empty("No plan yet. It takes about 15 minutes: two meeting places, an out-of-area contact, and where to shut off water, gas and power."),
        e.updated ? h("p", { class: "fine", text: "Updated " + e.updated }) : null),
      h("div", { class: "card" }, h("h2", { text: "Hazards to plan for" }), h("p", { class: "fine", text: "Tick what could happen where you live. The go-bag list adapts." }),
        h("div", { class: "hz" }, C.HAZARDS.map(function (x) {
          return h("label", { class: "chk" }, h("input", { type: "checkbox", id: "hz-" + x.id, checked: hz.indexOf(x.id) !== -1, disabled: ro(), onchange: function (ev) {
            var s = (e.hazards || []).filter(function (y) { return y !== x.id; }); if (ev.target.checked) s.push(x.id); e.hazards = s; A.save(); A.render(); } }), x.l);
        })))));
    var count = h("span", { class: "badge soon", text: packed() + " of " + bag.length + " packed" }), fill = h("span", { class: "prog-fill" }), groups = {};
    bag.forEach(function (b) { (groups[b.group] = groups[b.group] || []).push(b); });
    wrap.appendChild(h("section", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Go-bag checklist" }), count), h("div", { class: "prog" }, fill),
      h("p", { class: "fine", text: "Built from your family's ages, medicines, pets and hazards. Tick what is packed; check it twice a year." }),
      Object.keys(groups).map(function (g) {
        return h("div", null, h("h3", { class: "sub", text: g }), h("ul", { class: "baglist" }, groups[g].map(function (b) {
          var id = "bag-" + b.id;
          return h("li", null, h("input", { type: "checkbox", id: id, checked: !!(e.bag || {})[b.id], disabled: ro(), onchange: function (ev) {
            e.bag = e.bag || {}; if (ev.target.checked) e.bag[b.id] = true; else delete e.bag[b.id]; A.save();
            count.textContent = packed() + " of " + bag.length + " packed"; fill.style.width = Math.round(packed() * 100 / bag.length) + "%"; } }), h("label", { for: id, text: b.text }));
        })));
      })));
    fill.style.width = Math.round(packed() * 100 / Math.max(1, bag.length)) + "%";
    wrap.appendChild(window.StarkTrial.card("binder"));
    return wrap;
  };
  function editPlan() {
    var v = vault();
    U.openForm("Family emergency plan", C.EMERGENCY.map(function (f) { var c = {}; Object.keys(f).forEach(function (k) { c[k] = f[k]; }); c.warn = f.type === "textarea" || f.k === "vaultNote"; if (f.type === "textarea") c.rows = 2; return c; }), v.emergency, function (o) {
      o.hazards = v.emergency.hazards || []; o.bag = v.emergency.bag || {}; o.updated = V.todayStr(); v.emergency = o; A.save(); A.render();
    }, h("p", { class: "fine", text: "Agree the plan with everyone who lives with you, then practise it once a year. Never write the vault passphrase itself, only where it can be found." }));
  }
  function binderDialog() { window.StarkTrial.show("binder"); }
  /* ---------- Search ---------- */
  A.views.search = function () {
    var q = A.S.q || "", res = K.search(vault(), q, 80);
    var wrap = h("div", null, A.section("Search", q ? res.length + (res.length === 1 ? " result" : " results") + " for “" + q + "”" : "Type in the search box at the top. Every section is searched, on this computer only."));
    if (!q) return wrap;
    if (!res.length) { wrap.appendChild(A.empty("Nothing matched. Try fewer or shorter words.")); return wrap; }
    wrap.appendChild(h("ul", { class: "searchres" }, res.map(function (r) {
      return h("li", { class: "card" }, h("a", { href: "#/" + r.route }, h("span", { class: "tag", text: r.section }), " ", h("strong", { text: r.title })), h("p", { class: "fine", text: r.snippet }));
    })));
    return wrap;
  };
})();
