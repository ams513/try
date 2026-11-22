/* Stark Vital screens, part 1: Home, the daily check-in, Trends. */
(function () {
  "use strict";
  var V = window.StarkVital, U = window.VitalUI, D = window.VitalData, ST = window.VitalStats, LN = window.VitalLearn, LV = window.VitalLevers, SF = window.VitalSafety, CH = window.VitalCharts, A = window.VitalApp, h = U.h, S = A.S, btn = A.btn, badge = A.badge;
  var fmt1 = ST.fmtNum;

  function later(fn) { var route = S.route; setTimeout(function () { if (S.d && S.route === route) fn(); }, 20); }
  function redBanner(flags) {
    return h("div", { class: "banner red", role: "alert" }, h("strong", { text: SF.BANNER }), flags.strong ? h("p", { class: "strong-note", text: SF.STRONG }) : null,
      h("ul", { class: "red-why" }, flags.reasons.map(function (r) { return h("li", { text: r.text }); })), h("p", { class: "fine", text: "Experiments are paused while this shows. Stark Vital cannot tell you what this means." }));
  }
  A.redBanner = redBanner; A.later = later;
  function face(i) {
    var t = (i - 3) / 2, y = 15 + 4 * t, NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg"), c;
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "face"); s.setAttribute("aria-hidden", "true");
    function el(tag, a) { var e = document.createElementNS(NS, tag), k; for (k in a) e.setAttribute(k, a[k]); s.appendChild(e); }
    el("circle", { cx: 12, cy: 12, r: 10, fill: "none", stroke: "currentColor", "stroke-width": 1.6 }); el("circle", { cx: 8.6, cy: 9.6, r: 1.2, fill: "currentColor" }); el("circle", { cx: 15.4, cy: 9.6, r: 1.2, fill: "currentColor" });
    el("path", { d: "M7.5 15Q12 " + y + " 16.5 15", fill: "none", stroke: "currentColor", "stroke-width": 1.6, "stroke-linecap": "round" });
    return s;
  }

  /* ---------- Home ---------- */
  function stat(value, label) { return h("div", { class: "stat" }, h("b", { text: value }), h("span", { text: label })); }
  function topCard(box, flags) {
    var d = S.d, t = A.today(), logged = Object.keys(d.days).length, pat, ranked, top, card = h("div", { class: "card hero-card" });
    box.appendChild(card);
    if (flags.active) { card.appendChild(h("h2", { text: "A note about your notes" })); card.appendChild(redBanner(flags)); return; }
    card.appendChild(h("h2", { text: "What seems to help you" }));
    card.appendChild(h("p", { class: "muted", text: "Looking at your entries..." }));
    later(function () {
      pat = A.patterns(); ranked = LN.rank(d, pat, t); top = LN.top(d, ranked, t); U.clear(card); card.appendChild(h("h2", { text: "What seems to help you" }));
      if (!top) return card.appendChild(h("p", { class: "muted", text: "Add a few check-ins to get started." }));
      var lv = top.lever, body;
      if (logged < 14) {
        card.appendChild(h("p", { class: "starter", text: "A common starting point, not based on your data yet." }));
        card.appendChild(h("h3", { text: lv.name })); card.appendChild(h("p", { text: lv.try }));
        card.appendChild(h("p", { class: "fine", text: logged + " of 14 days logged. Patterns from your own days start to appear after about three weeks of entries." }));
      } else {
        card.appendChild(h("h3", { text: lv.name }));
        if (top.exp.res && top.exp.res.label !== "too little data") body = LN.resultText(top.exp.res); else if (top.pat.pair) body = ST.describe(top.pat.pair, d.settings.detail).text; else body = "Not enough of your own data on this yet. " + lv.try;
        card.appendChild(h("p", { text: body }));
        var last = (d.log || []).filter(function (x) { return V.daysBetween(x.date, t) >= 7 && V.daysBetween(x.date, t) <= 10; })[0];
        if (last && last.lever !== lv.id) card.appendChild(h("p", { class: "fine", text: "Changed since last week: the top card was \"" + (LV.get(last.lever) || { name: "another habit" }).name + "\". New entries moved the ranking." }));
        card.appendChild(h("p", { class: "fine", text: "This is about patterns in your own notes. Many things you cannot see affect your days." }));
      }
      card.appendChild(h("div", { class: "row" }, btn("Try it as a two-week experiment", "primary", function () { A.expDraft = lv.id; A.go("experiments"); }), btn("See all patterns", "", function () { A.go("patterns"); }), btn("Why this?", "ghost", function () { A.go("levers"); })));
      if (!S.example && !(d.log || []).some(function (x) { return x.date === t; })) { d.log = (d.log || []).concat([{ id: V.uid(), date: t, lever: lv.id }]).slice(-40); A.save(); }
    });
  }
  function activeExperiment(box) {
    var d = S.d, t = A.today(), e = d.experiments.filter(function (x) { var s = LN.status(x, t); return s === "running" || s === "planned"; })[0];
    if (!e) return;
    var lv = LV.get(e.lever), w = LN.windows(e), day = Math.max(0, V.daysBetween(e.start, t) + 1), mark = e.adherence[t];
    var card = h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Your experiment" }), badge(LN.status(e, t) === "planned" ? "Starts " + A.fmtDate(e.start) : "Day " + Math.min(day, e.interventionDays) + " of " + e.interventionDays, "doing")),
      h("p", { text: lv ? lv.name + ": " + lv.try : "" }));
    if (LN.status(e, t) === "running" && day <= e.interventionDays) {
      card.appendChild(h("p", { class: "fine", text: "Did you do it today?" }));
      card.appendChild(h("div", { class: "row" }, [["yes", "Did it"], ["partly", "Partly"], ["no", "No"]].map(function (o) {
        return btn(o[1], mark === o[0] ? "primary" : "", function () { e.adherence[t] = o[0]; A.save(); A.render(); }, { "aria-pressed": mark === o[0] ? "true" : "false" });
      })));
    }
    box.appendChild(card);
  }
  A.views.home = function () {
    var d = S.d, t = A.today(), logged = D.dates(d), st = D.streak(d, t), wrap = h("div", { class: "home" }), flags = A.redFlags(), todayRec = d.days[t], dayN = Math.min(14, logged.length);
    wrap.appendChild(A.section(S.example ? "Welcome. This is Stark Vital." : "Good to see you", A.fmtDate(t, true) + ".", [btn(todayRec ? "Edit today's check-in" : "Check in now", "primary big", function () { A.go("checkin"); }, { "aria-keyshortcuts": "g c" })]));
    if (S.ack) { wrap.appendChild(h("div", { class: "banner ok", role: "status", text: S.ack })); S.ack = ""; }
    if (flags.active) wrap.appendChild(redBanner(flags));
    if (!S.example && A.reminderDue && A.reminderDue()) wrap.appendChild(h("div", { class: "banner", role: "note" }, "Time for today's check-in. ", btn("Check in", "small primary", function () { A.go("checkin"); })));
    var hero = h("div", { class: "grid-hero" });
    hero.appendChild(h("div", { class: "card ring-card" }, CH.ring(dayN / 14, logged.length >= 14 ? logged.length + "" : "Day " + dayN, logged.length >= 14 ? "days logged" : "of 14"),
      h("div", null, h("h2", { text: logged.length >= 24 ? "Your patterns can appear" : logged.length >= 14 ? "Past two weeks" : "Building your first picture" }),
        h("p", { class: "muted", text: logged.length >= 14 ? "Keep checking in: findings sharpen as the days add up. Patterns need about three weeks of entries." : "At 14 days the card starts to weigh your own entries, and patterns need about three weeks. Missing days are fine." }),
        h("p", { class: "fine", text: st.last14 + " of the last 14 days logged" + (st.run > 1 ? ", " + st.run + " in a row now" : "") + "." }))));
    topCard(hero, flags);
    wrap.appendChild(hero);
    activeExperiment(wrap);
    // 14-day mini charts
    var from = V.addDays(t, -13), minis = h("div", { class: "cards minis" });
    [["dur", "Sleep", function (v) { return D.fmtDur(v); }, 300, 600], ["mood", "Mood", function (v) { return fmt1(v, 1) + " of 5"; }, 1, 5], ["energy", "Energy", function (v) { return fmt1(v, 1) + " of 5"; }, 1, 5]].forEach(function (m) {
      var series = D.series(d, m[0], from, t), byDate = {}, vals = [], i;
      series.forEach(function (p) { byDate[p.date] = p.v; });
      for (i = 0; i < 14; i++) vals.push(byDate[V.addDays(from, i)] != null ? byDate[V.addDays(from, i)] : null);
      var avg = series.length ? ST.mean(series.map(function (p) { return p.v; })) : null, lastV = series.length ? series[series.length - 1].v : null;
      minis.appendChild(h("a", { class: "card mini", href: "#/trends" }, h("span", { class: "mini-l", text: m[1] }), h("b", { class: "mini-v", text: lastV == null ? "-" : m[2](lastV) }),
        CH.spark(vals, { min: m[3], max: m[4], label: m[1] + ", last 14 days" }), h("small", { text: avg == null ? "No entries yet" : "14-day average " + m[2](avg) })));
    });
    wrap.appendChild(h("h2", { text: "Last 14 days" })); wrap.appendChild(minis);
    wrap.appendChild(h("p", { class: "fine", text: "Everything on this screen is calculated on this computer from your own entries. " + SF.FOOTER }));
    return wrap;
  };

  /* ---------- Check-in ---------- */
  function seg(id, label, opts, val, o) {
    o = o || {};
    var group = h("div", { class: "seg", role: "radiogroup", "aria-labelledby": id + "-l" }), radios = [], wrap;
    opts.forEach(function (op, i) {
      var inp = h("input", { type: "radio", name: id, id: id + "-" + i, value: String(op.v), checked: val != null && String(val) === String(op.v) }), was = false;
      inp.addEventListener("pointerdown", function () { was = inp.checked; });
      inp.addEventListener("click", function () { if (was) { inp.checked = false; was = false; } if (o.onChange) o.onChange(); });
      radios.push(inp);
      group.appendChild(h("label", { class: "seg-opt", for: id + "-" + i }, inp, o.faces ? face(op.v) : null, h("span", { class: "seg-t", text: op.l })));
    });
    group.addEventListener("keydown", function (e) {
      var n = /^[1-9]$/.test(e.key) ? +e.key : 0;
      if (n && n <= radios.length && !e.ctrlKey && !e.altKey) { e.preventDefault(); radios[n - 1].checked = true; if (o.onChange) o.onChange(); var nxt = group.closest("form").querySelectorAll(".seg"), idx = Array.prototype.indexOf.call(nxt, group); if (nxt[idx + 1]) { var f = nxt[idx + 1].querySelector("input:checked") || nxt[idx + 1].querySelector("input"); if (f) f.focus(); } }
    });
    wrap = h("div", { class: "field wide qa", "data-field": id }, h("span", { class: "lbl", id: id + "-l", text: label }), group, o.hint ? h("span", { class: "fine seg-hint", text: o.hint }) : null);
    return { el: wrap, get: function () { var c = radios.filter(function (r) { return r.checked; })[0]; return c ? c.value : null; } };
  }
  var SCALE = [1, 2, 3, 4, 5].map(function (n) { return { v: n, l: String(n) }; });
  var GROUPS = { sleep: "sleep", mood: "mood", energy: "energy", training: "training", food: "food", light: "light", stress: "stress", focus: "focus", social: "social", breath: "breath" };
  A.views.checkin = function () {
    var d = S.d, t = A.today(), date = /^\d{4}-\d{2}-\d{2}$/.test(S.param) && !isNaN(V.dayNum(S.param)) && V.daysBetween(S.param, t) >= 0 ? S.param : t, orig = d.days[date] || {}, rec = d.days[date] || {}, isNew = !d.days[date], showAll = false, hasCv = !!(d.custom && d.custom.vals[date]);
    isNew = isNew && !hasCv;
    var prev = D.dates(d).filter(function (x) { return x < date; }).pop(), pr = prev ? d.days[prev] : {}, tr = d.settings.tracked;
    var F = {}, form, durOut = h("output", { class: "dur-out", "aria-live": "polite" }), wrap = h("div", { class: "checkin" }), moreBox, err = h("p", { class: "form-err", role: "alert", hidden: true });
    function on(k) { return showAll || tr.indexOf(k) !== -1; }
    var dateIn = h("input", { type: "date", id: "ci-date", value: date, max: t, min: V.addDays(t, -800), onchange: function (e) { if (e.target.value && V.daysBetween(e.target.value, t) >= 0) A.go("checkin", e.target.value === t ? "" : e.target.value); } });
    var bed = h("input", { type: "time", id: "ci-bed", value: rec.bed || (isNew ? pr.bed : "") || "" }), wake = h("input", { type: "time", id: "ci-wake", value: rec.wake || (isNew ? pr.wake : "") || "" });
    function updDur() { var m = D.durFrom(bed.value, wake.value); durOut.textContent = m ? "Sleep length: " + D.fmtDur(m) : "Set both times to see the length."; }
    bed.addEventListener("input", updDur); wake.addEventListener("input", updDur);
    var bool = function (k) { return rec[k] === true ? "1" : rec[k] === false ? "0" : null; }, yn = [{ v: 0, l: "No" }, { v: 1, l: "Yes" }];
    var defs = [
      ["sleep", function () { return h("fieldset", { class: "grp" }, h("legend", { text: "Last night" }), h("div", { class: "grid2 times" }, h("div", { class: "field" }, h("label", { for: "ci-bed", text: "Went to bed" }), bed), h("div", { class: "field" }, h("label", { for: "ci-wake", text: "Woke up" }), wake)), durOut, (F.rested = seg("rested", "How rested do you feel?", SCALE, rec.rested, { faces: true, hint: "1 not at all, 5 fully rested. Tap again to clear." })).el); }],
      ["mood", function () { return (F.mood = seg("mood", "Mood now", SCALE, rec.mood, { faces: true, hint: "1 very low, 5 very good" })).el; }],
      ["energy", function () { return (F.energy = seg("energy", "Energy now", SCALE, rec.energy, { faces: true, hint: "1 very low, 5 very high" })).el; }],
      ["focus", function () { return (F.focus = seg("focus", "Focus", SCALE, rec.focus, { faces: true, hint: "1 scattered, 5 sharp" })).el; }],
      ["stress", function () { return (F.stress = seg("stress", "Stress", SCALE, rec.stress, { faces: true, hint: "1 calm, 5 very stressed" })).el; }],
      ["training", function () {
        F.trainLevel = seg("trainLevel", "Trained today", [{ v: 0, l: "None" }, { v: 1, l: "Light" }, { v: 2, l: "Hard" }], rec.trainLevel);
        F.trainKind = h("select", { id: "ci-kind", "aria-label": "Kind of training" }, [{ v: "", l: "Kind (optional)" }].concat(D.TRAIN_KINDS.map(function (k) { return { v: k, l: k[0].toUpperCase() + k.slice(1) }; })).map(function (o) { return h("option", { value: o.v, text: o.l, selected: (rec.trainKind || "") === o.v }); }));
        F.trainMin = h("input", { type: "number", id: "ci-tmin", min: 0, max: 600, inputmode: "numeric", value: rec.trainMin != null ? rec.trainMin : "", "aria-label": "Minutes trained", placeholder: "Minutes" });
        F.steps = h("input", { type: "number", id: "ci-steps", min: 0, max: 100000, inputmode: "numeric", value: rec.steps != null ? rec.steps : "", "aria-label": "Steps", placeholder: "Steps (optional)" });
        return h("fieldset", { class: "grp" }, h("legend", { text: "Training" }), F.trainLevel.el, h("div", { class: "grid3" }, F.trainKind, F.trainMin, F.steps));
      }],
      ["food", function () {
        F.caffeineLate = seg("caffeineLate", "Caffeine after 2 pm?", yn, bool("caffeineLate")); F.alcohol = seg("alcohol", "Alcohol (last evening or today)", [{ v: 0, l: "None" }, { v: 1, l: "1-2 drinks" }, { v: 2, l: "3 or more" }], rec.alcohol);
        F.lateMeal = seg("lateMeal", "Ate within 3 hours of bed?", yn, bool("lateMeal"));
        return h("fieldset", { class: "grp" }, h("legend", { text: "Food and drink" }), F.caffeineLate.el, F.alcohol.el, F.lateMeal.el);
      }],
      ["light", function () {
        F.outdoor = seg("outdoor", "Time outside today", [{ v: 0, l: "Under 15 min" }, { v: 1, l: "15-60 min" }, { v: 2, l: "Over 60 min" }], rec.outdoor); F.morningLight = seg("morningLight", "Outside within 2 hours of waking (10+ min)?", yn, bool("morningLight"));
        F.screenLate = seg("screenLate", "Bright screen in the last hour before bed?", yn, bool("screenLate"));
        return h("fieldset", { class: "grp" }, h("legend", { text: "Light and screens" }), F.outdoor.el, F.morningLight.el, F.screenLate.el);
      }],
      ["social", function () { F.social = seg("social", "Time with people", [{ v: 0, l: "None" }, { v: 1, l: "Some" }, { v: 2, l: "Lots" }], rec.social); return F.social.el; }],
      ["breath", function () { F.breathMin = h("input", { type: "number", id: "ci-breath", min: 0, max: 120, inputmode: "numeric", value: rec.breathMin != null ? rec.breathMin : "" }); return h("div", { class: "field" }, h("label", { for: "ci-breath", text: "Minutes of slow breathing" }), F.breathMin); }]
    ];
    function buildFields() {
      U.clear(moreBox);
      defs.forEach(function (df) { if (on(df[0])) moreBox.appendChild(df[1]()); });
      moreBox.appendChild(btn(showAll ? "Show only what I track" : "Show all fields", "small ghost", function () { keep(); showAll = !showAll; buildFields(); }));
      updDur();
    }
    function keep() { rec = collect(true) || rec; }   // keep typed values when the field set changes
    // custom items (1.1.0): the person's own ratings, habits and numbers, kept in d.custom
    var CF = {}, citems = D.customItems(d, false);
    function customCard() {
      if (!citems.length) return h("p", { class: "fine" }, "Your own items appear here. ", btn("Add an item", "small ghost", function () { A.go("items"); }));
      return h("fieldset", { class: "grp custom-grp" }, h("legend", { text: "My items" }), citems.map(function (it, i) {
        var cur = D.customValue(d, date, it.id), id = "cx" + i, lab = it.name;
        if (it.kind === "rating") return (CF[it.id] = seg(id, lab, SCALE, cur, { hint: "1 to 5. Tap again to clear." })).el;
        if (it.kind === "habit") return (CF[it.id] = seg(id, lab, yn, cur === null ? null : String(cur))).el;
        CF[it.id] = { get: function () { return inp.value; } };
        var inp = h("input", { type: "number", id: id, min: 0, max: D.NUM_MAX, step: "any", inputmode: "decimal", value: cur !== null ? cur : "" });
        return h("div", { class: "field" }, h("label", { for: id, dir: "auto", text: lab + (it.unit ? " (" + it.unit + ")" : "") }), inp);
      }), btn("Manage items", "small ghost", function () { A.go("items"); }));
    }
    function collectCustom() { var o = {}; citems.forEach(function (it) { var v = CF[it.id] ? CF[it.id].get() : null; o[it.id] = v === null || v === "" || v === undefined ? null : +v; }); return o; }
    var sick = h("input", { type: "checkbox", id: "ci-sick", checked: rec.sick === true }), travel = h("input", { type: "checkbox", id: "ci-travel", checked: rec.travel === true });
    var sym = h("details", { class: "sym", open: rec.flags && rec.flags.length ? "" : null }, h("summary", { text: "Did you notice any of these? (tick if so)" }),
      h("div", { class: "multi" }, D.SYMPTOMS.map(function (s) { return h("label", { class: "chk" }, h("input", { type: "checkbox", value: s.id, checked: (rec.flags || []).indexOf(s.id) !== -1 }), s.label); })),
      h("p", { class: "fine", text: "Ticking one shows a note about talking to a doctor. Stark Vital cannot judge what it means." }));
    var note = h("textarea", { id: "ci-note", rows: 2, maxlength: 280, placeholder: "One line, if you like", text: rec.note || "" }), count = h("span", { class: "fine", text: (rec.note || "").length + " / 280" });
    note.addEventListener("input", function () { count.textContent = note.value.length + " / 280"; });
    moreBox = h("div", { class: "fields" });
    function val(k, num) { var el = F[k]; if (!el) return undefined; var v = el.get ? el.get() : el.value; if (v === null || v === "" || v === undefined) return undefined; return num === false ? v : +v; }
    function collect() {
      var r = { bed: bed.value || undefined, wake: wake.value || undefined };
      ["rested", "mood", "energy", "focus", "stress", "trainLevel", "alcohol", "outdoor", "social"].forEach(function (k) { if (F[k]) { var v = val(k); if (v !== undefined) r[k] = v; } });
      ["caffeineLate", "lateMeal", "morningLight", "screenLate"].forEach(function (k) { if (F[k]) { var v = val(k); if (v !== undefined) r[k] = v === 1; } });
      if (F.trainKind && F.trainKind.value) r.trainKind = F.trainKind.value;
      ["trainMin", "steps", "breathMin"].forEach(function (k) { if (F[k] && F[k].value !== "") r[k] = +F[k].value; });
      r.sick = sick.checked || undefined; r.travel = travel.checked || undefined;
      var fl = Array.prototype.filter.call(sym.querySelectorAll("input"), function (i) { return i.checked; }).map(function (i) { return i.value; }); if (fl.length) r.flags = fl;
      if (note.value.trim()) r.note = note.value.trim();
      return r;
    }
    // the fields the person did not touch keep their earlier values when "Show all fields" is toggled
    form = h("form", { class: "form", novalidate: true, onsubmit: function (e) { e.preventDefault(); doSave(); } });
    function doSave() {
      var r = collect(), c, refused = false;
      if (r.note && SF.refused(r.note)) { refused = true; delete r.note; }
      r.source = orig.source || "manual"; r.created = orig.created || new Date().toISOString(); r.edited = new Date().toISOString();
      c = D.cleanDay(r);
      if (r.bed && r.wake && c.durMin === undefined) { err.textContent = "Bed and wake times are the same or give a night over 16 hours. Check them."; err.hidden = false; U.markInvalid(wake, err); return; }
      var cv = collectCustom(), anyCv = Object.keys(cv).some(function (k) { return cv[k] !== null; }), hadCv = !!(d.custom && d.custom.vals[date]);
      if (!D.hasContent(c) && !anyCv) { err.textContent = "Nothing to save yet: fill in at least one thing."; err.hidden = false; return; }
      if (!d.days[date] && !hadCv && A.full("day")) return;
      // compare with the person's own usual before saving
      var older = D.series(d, "dur", V.addDays(date, -30), V.addDays(date, -1)).map(function (p) { return p.v; });
      if (D.hasContent(c)) d.days[date] = c; else delete d.days[date];
      Object.keys(cv).forEach(function (id) { D.setCustomValue(d, date, id, cv[id]); });
      if (!d.settings.started) d.settings.started = date; A.save();
      var st = D.streak(d, t), msg = "Saved. " + st.last14 + " of the last 14 days logged.";
      if (c.durMin != null && older.length >= 5) { var diff = c.durMin - ST.mean(older); msg += " Sleep " + D.fmtDur(c.durMin) + (Math.abs(diff) < 15 ? ", about your usual." : ", " + Math.round(Math.abs(diff)) + " min " + (diff > 0 ? "longer" : "shorter") + " than your usual."); }
      S.ack = msg; if (refused) setTimeout(function () { U.modal("Not saved", h("div", { class: "dlg-body" }, h("p", { text: SF.REFUSAL }), h("div", { class: "row end" }, btn("OK", "primary", function () { document.querySelector("dialog").close(); })))); }, 200);
      A.go("home");
    }
    form.appendChild(h("div", { class: "card" }, h("div", { class: "grid2 head" }, h("div", { class: "field" }, h("label", { for: "ci-date", text: "Day" }), dateIn),
      h("p", { class: "fine", text: "Everything is optional. Skip what does not apply. Keys 1 to 5 pick an answer and move on." })), moreBox));
    if (citems.length || D.customItems(d, true).length === 0) form.appendChild(h("div", { class: "card" }, customCard()));
    form.appendChild(h("div", { class: "card" }, h("div", { class: "row" }, h("label", { class: "chk" }, sick, "Unwell today (left out of patterns)"), h("label", { class: "chk" }, travel, "Travelling (left out of patterns)")), sym,
      h("div", { class: "field wide" }, h("label", { for: "ci-note", text: "Note" }), note, count)));
    form.appendChild(err);
    form.appendChild(h("div", { class: "row sticky-save" }, h("button", { type: "submit", class: "btn primary big", text: isNew ? "Save check-in" : "Save changes" }), btn("Cancel", "ghost", function () { A.go("home"); }),
      !isNew ? btn("Delete this day", "danger-o", function () { U.confirmBox("Delete this day?", "This removes the entry for " + A.fmtDate(date, true) + (d.custom && d.custom.vals[date] ? ", including your own items for that day," : "") + " and recalculates your patterns.", "Delete", true).then(function (ok) { if (ok) { delete d.days[date]; if (d.custom && d.custom.vals[date]) delete d.custom.vals[date]; A.save(); A.go("home"); U.toast("Deleted."); } }); }) : null));
    wrap.appendChild(A.section(isNew ? (date === t ? "Today's check-in" : "Check-in for " + A.fmtDate(date)) : "Edit " + A.fmtDate(date), "A few taps. No typing needed."));
    wrap.appendChild(form); wrap.appendChild(h("p", { class: "fine", text: SF.FOOTER }));
    buildFields();
    form.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doSave(); } });
    return wrap;
  };

  /* ---------- Trends ---------- */
  var METRICS = [["dur", "Sleep length", function (v) { return D.fmtDur(v); }, null, null], ["rested", "Rested", function (v) { return fmt1(v, 1); }, 1, 5], ["mood", "Mood", function (v) { return fmt1(v, 1); }, 1, 5], ["energy", "Energy", function (v) { return fmt1(v, 1); }, 1, 5],
    ["focus", "Focus", function (v) { return fmt1(v, 1); }, 1, 5], ["stress", "Stress", function (v) { return fmt1(v, 1); }, 1, 5], ["steps", "Steps", function (v) { return Math.round(v).toLocaleString(); }, 0, null], ["bedIrreg", "Bedtime spread", function (v) { return Math.round(v) + " min"; }, 0, null]];
  var tr = { metric: "dur", range: 30 };
  // the person's own items join the chart list (archived ones while they still hold values)
  function allMetrics(d) {
    return METRICS.concat(D.customItems(d, true).filter(function (it) { return !it.archived || D.customCount(d, it.id); }).map(function (it) {
      var f = it.kind === "habit" ? function (v) { return v ? "Yes" : "No"; } : function (v) { return fmt1(v, it.kind === "rating" ? 1 : 2) + (it.unit ? " " + it.unit : ""); };
      return ["c:" + it.id, it.name + (it.archived ? " (archived)" : ""), f, it.kind === "rating" ? 1 : it.kind === "habit" ? 0 : 0, it.kind === "rating" ? 5 : it.kind === "habit" ? 1 : null];
    }));
  }
  A.views.trends = function () {
    var d = S.d, t = A.today(), wrap = h("div"), MM = allMetrics(d), m = MM.filter(function (x) { return x[0] === tr.metric; })[0], from = V.addDays(t, -(tr.range - 1)), pts,  vals, minis;
    if (!m) { m = METRICS[0]; tr.metric = "dur"; }
    pts = tr.metric.indexOf("c:") === 0 ? D.customSeries(d, tr.metric.slice(2), from, t) : D.series(d, tr.metric, from, t); vals = pts.map(function (p) { return p.v; });
    wrap.appendChild(A.section("Trends", "How your numbers moved. Gaps are normal: days you did not log are simply left out. Your own items are in the list too."));
    var chips = h("div", { class: "chips", role: "group", "aria-label": "What to chart" }, MM.map(function (x) { return btn(x[1], tr.metric === x[0] ? "primary small" : "small", function () { tr.metric = x[0]; A.render(); }, { "aria-pressed": tr.metric === x[0] ? "true" : "false" }); }));
    var ranges = h("div", { class: "chips", role: "group", "aria-label": "Period" }, [7, 30, 90, 365].map(function (n) { return btn(n + " days", tr.range === n ? "primary small" : "small", function () { tr.range = n; A.render(); }, { "aria-pressed": tr.range === n ? "true" : "false" }); }));
    wrap.appendChild(h("div", { class: "card" }, chips, ranges));
    var sum = ST.summary(m[1] + ", last " + tr.range + " days", vals, m[2]);
    var chart = CH.line({ series: [{ name: m[1], pts: pts }], from: from, to: t, min: m[3], max: m[4], fmt: m[2], avg: true, label: sum });
    wrap.appendChild(h("div", { class: "card" }, CH.card(m[1] + " (line is the 7-day average)", chart, sum, [["Date", m[1]]].concat(pts.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (p) { return [p.date, m[2](p.v)]; })))));
    // weekly rhythm
    var by = [[], [], [], [], [], [], []], names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    pts.forEach(function (p) { by[D.weekday(p.date)].push(p.v); });
    var items = by.map(function (a, i) { return { label: names[i], v: a.length ? ST.mean(a) : null, n: a.length }; });
    if (vals.length >= 7) wrap.appendChild(h("div", { class: "card" }, CH.card("By day of the week", CH.bars(items, { fmt: m[2], min: m[3] === 1 ? 0 : 0, label: m[1] + " by weekday" }), "Average " + m[1].toLowerCase() + " by weekday over the period. Weekdays with few days logged are rough.", [["Weekday", "Average", "Days"]].concat(items.map(function (i) { return [i.label, i.v == null ? "-" : m[2](i.v), i.n]; })))));
    else wrap.appendChild(h("p", { class: "fine", text: "The weekday view appears once you have 7 entries in the period." }));
    wrap.appendChild(h("p", { class: "fine", text: "Sleep length comes from the clock times you type, so on the night the clocks change it can be an hour off." }));
    return wrap;
  };
})();
