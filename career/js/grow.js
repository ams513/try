/* Grow: skills gap planner with a learning schedule, career change roadmap, and a wins log for reviews and resume bullets. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$, K = SC.kit;

  /* ---------- skills plan ---------- */
  SC.views.skills = function (root) {
    var P = SC.S.skillsPlan, saveSoon = SC.debounce(SC.save, 300);
    if (!P.start) P.start = SC.today();
    function draw() {
      root.innerHTML = K.head("Grow", "Skills plan",
        "Name the role you are aiming for, list what it needs, rate yourself honestly, and get a learning schedule that fits the hours you really have. Pull in the keywords you are missing from the last job posting you tailored to.") +
        '<div class="two"><div><section class="card"><h2>Goal</h2><div class="cols">' +
        K.field("sp-target", "Target role", P.target, { k: "target", ph: "Data Analyst" }) + K.field("sp-hours", "Hours a week for learning", P.hours, { k: "hours", type: "number", min: 1, max: 60 }) +
        K.field("sp-start", "Start date", P.start, { k: "start", type: "date" }) + "</div></section>" +
        '<section class="card"><h2>Add a skill</h2><div class="cols">' + K.field("sk-name", "Skill", "", { ph: "SQL" }) + K.field("sk-need", "Level the role needs", 3, { opts: K.levels(1) }) +
        K.field("sk-have", "Your level now", 1, { opts: K.levels(0) }) + '</div><p class="fine">Levels: 0 none, 1 aware, 2 basic, 3 working, 4 strong, 5 expert.</p>' +
        '<div class="row"><button type="button" class="btn primary" id="sk-add" data-primary>Add skill</button><button type="button" class="btn small" id="sk-pull">Add missing keywords from my last posting</button></div></section>' +
        '<section class="card"><h2>Skills (' + P.skills.length + ')</h2><div id="sk-list"></div></section></div>' +
        '<div><section class="card" id="sp-out" aria-live="polite"></section></div></div>';
      list(); out();
    }
    function list() {
      $("#sk-list").innerHTML = P.skills.length ? P.skills.map(function (s) {
        return '<div class="skill-row' + (s.done ? " done" : "") + '" data-id="' + s.id + '"><div class="cols">' + K.field("se-name-" + s.id, "Skill", s.name, { k: "name" }) +
          K.field("se-need-" + s.id, "Needs", s.need, { k: "need", opts: K.levels(1) }) + K.field("se-have-" + s.id, "You", s.have, { k: "have", opts: K.levels(0) }) +
          K.field("se-hrs-" + s.id, "Hours to close (estimate)", s.hrs, { k: "hrs", type: "number", min: 0, ph: "auto" }) + "</div>" +
          K.field("se-how-" + s.id, "How you will learn it", s.how, { k: "how", ph: "Course, book, project, mentor" }) +
          '<div class="row">' + K.check("se-done-" + s.id, "Done", s.done, "done") + '<button type="button" class="btn small" data-rm>Remove</button></div></div>';
      }).join("") : '<p class="muted">No skills yet. Add the four to eight things the role asks for most.</p>';
    }
    function out() {
      var g = SC.skillGaps(P.skills), plan = SC.learningPlan(P.skills, P.hours, P.start || SC.today()), o = $("#sp-out");
      var span = Math.max(1, SC.daysBetween(P.start || SC.today(), plan.finish) || 1);
      o.innerHTML = '<div class="row">' + SC.ringHTML(g.coverage, g.coverage + "%", "lg") + "<div><h2>" + (P.target ? E(P.target) + ": " : "") + g.coverage + "% ready</h2>" +
        '<p class="fine">' + (plan.items.length ? plan.totalHours + " hours of learning across " + plan.items.length + " gap" + (plan.items.length > 1 ? "s" : "") + ", done around <b>" + E(K.nice(plan.finish)) + "</b> at " + (SC.num(P.hours) || 5) + " hours a week." : g.total ? "No gaps left. Time to apply." : "Add skills to see your plan.") + "</p></div></div>" +
        (plan.items.length ? '<h3>Learning schedule</h3><div class="gantt">' + plan.items.map(function (i) {
          var l = 100 * SC.daysBetween(P.start || SC.today(), i.start) / span, w = Math.max(2, 100 * i.weeks * 7 / span);
          return '<div class="g-row"><span class="g-name">' + E(i.name) + '</span><div class="g-track"><i style="left:' + l.toFixed(1) + "%;width:" + w.toFixed(1) + '%"></i></div><span class="fine">' + E(K.nice(i.start)) + " to " + E(K.nice(i.end)) + " &middot; " + i.hrs + " h</span></div>";
        }).join("") + "</div>" : "") +
        (g.gaps.length ? '<h3>Biggest gaps first</h3><ul class="checks">' + g.gaps.slice(0, 6).map(function (x) { return "<li>" + E(x.s.name || "Skill") + ": level " + x.have + " now, " + x.need + " needed" + (x.s.how ? " &middot; " + E(x.s.how) : "") + "</li>"; }).join("") + "</ul>" : "") +
        '<div class="row"><button type="button" class="btn small" id="sp-txt">Download plan (.txt)</button><button type="button" class="btn small" id="sp-ics">Add milestones to calendar</button></div>' +
        '<p class="fine">Hour estimates default to 10 hours per level of gap. Replace them with your own once you pick a course or project.</p>';
    }
    function planText() {
      var plan = SC.learningPlan(P.skills, P.hours, P.start || SC.today()), g = SC.skillGaps(P.skills);
      return ["SKILLS PLAN" + (P.target ? ": " + P.target : ""), "Ready now: " + g.coverage + "%", "Learning time: " + (SC.num(P.hours) || 5) + " hours a week", ""].concat(
        plan.items.map(function (i, n) { var s = K.byId(P.skills, i.id); return (n + 1) + ". " + i.name + " (" + i.start + " to " + i.end + ", " + i.hrs + " hours)" + (s && s.how ? "\n   How: " + s.how : ""); }),
        ["", "Finish: " + plan.finish]).join("\n");
    }
    draw();
    function onEdit(ev) {
      var el = ev.target, k = el.getAttribute("data-k"); if (!k) return;
      var row = el.closest("[data-id]");
      if (row) { var s = K.byId(P.skills, row.getAttribute("data-id")); if (!s) return; s[k] = k === "done" ? el.checked : (k === "need" || k === "have") ? +el.value : el.value; if (k === "done") row.classList.toggle("done", el.checked); }
      else P[k] = k === "start" && !/^\d{4}-\d{2}-\d{2}$/.test(el.value) ? SC.today() : el.value;
      saveSoon(); out();
    }
    root.addEventListener("input", onEdit);
    root.addEventListener("change", function (ev) { if (ev.target.getAttribute("data-k")) { onEdit(ev); SC.save(); } });
    root.addEventListener("click", function (ev) {
      var t = ev.target;
      if (t.id === "sk-add") {
        var n = $("#sk-name").value.trim(); if (!n) { SC.toast("Name the skill."); $("#sk-name").focus(); return; }
        P.skills.push(SC.blankSkill(n, $("#sk-need").value, $("#sk-have").value)); SC.save(); draw(); $("#sk-name").focus();
      } else if (t.id === "sk-pull") {
        var miss = SC.gapsFromPosting(SC.S.resume, SC.S.jobText, 8), have = {}, added = 0;
        if (!String(SC.S.jobText || "").trim()) { SC.toast("Paste a job posting in Tailor first."); return; }
        P.skills.forEach(function (s) { have[String(s.name).toLowerCase()] = 1; });
        miss.forEach(function (m) { if (!have[m.toLowerCase()]) { P.skills.push(SC.blankSkill(m, 3, 1)); added++; } });
        if (!P.target && SC.S.tailor && SC.S.tailor.role) P.target = SC.S.tailor.role;
        SC.save(); draw(); SC.toast(added ? "Added " + added + " missing keyword" + (added > 1 ? "s" : "") + ". Rate your real level for each." : "No new missing keywords to add.");
      } else if (t.hasAttribute("data-rm")) {
        var id = t.closest("[data-id]").getAttribute("data-id"); P.skills = P.skills.filter(function (s) { return s.id !== id; }); SC.save(); draw();
      } else if (t.id === "sp-txt") SC.download("skills_plan.txt", planText());
      else if (t.id === "sp-ics") K.calendar();
    });
  };

  /* ---------- career change roadmap ---------- */
  SC.views.change = function (root) {
    var M = SC.S.roadmap, saveSoon = SC.debounce(SC.save, 300);
    if (!M.start) M.start = SC.today();
    if (!M.end) M.end = SC.addDays(M.start, 180);
    function draw() {
      var today = SC.today(), pr = SC.roadmapProgress(M.steps, today);
      root.innerHTML = K.head("Grow", "Career change roadmap",
        "Moving into a new field works best in five phases: explore, learn, prove, connect, apply. Set where you are, where you want to go and by when, and get dated steps you can tick off. Paste a few postings for the new role to see which of your skills already carry over.") +
        '<div class="two"><div><section class="card"><h2>Your move</h2><div class="cols">' +
        K.field("rm-from", "From (current field or role)", M.from, { k: "from", ph: "Retail store manager" }) + K.field("rm-to", "To (target role)", M.to, { k: "to", ph: "Operations analyst" }) +
        K.field("rm-start", "Start", M.start, { k: "start", type: "date" }) + K.field("rm-end", "Target date", M.end, { k: "end", type: "date" }) + "</div>" +
        K.field("rm-why", "Why you are changing (your answer to the interview question)", M.why, { k: "why", area: true, rows: 2 }) +
        '<div class="row" style="margin-top:.6rem"><button type="button" class="btn primary" id="rm-build" data-primary>' + (M.steps.length ? "Rebuild my roadmap" : "Build my roadmap") + "</button></div>" +
        (M.steps.length ? '<p class="fine">Rebuilding replaces the steps below (you will be asked to confirm).</p>' : "") + "</section>" +
        '<section class="card"><h2>What carries over</h2>' + K.field("rm-post", "Paste two or three postings for the target role", M.postings, { k: "postings", area: true, rows: 5 }) + '<div id="rm-tr"></div></section></div>' +
        '<div><section class="card"><div class="row">' + SC.ringHTML(pr.pct, pr.pct + "%", "lg") + "<div><h2>" + (pr.total ? pr.done + " of " + pr.total + " steps done" : "No roadmap yet") + "</h2>" +
        '<p class="fine">' + (pr.phase ? "Current phase: <b>" + E((SC.ROADMAP_PHASES.filter(function (p) { return p[0] === pr.phase; })[0] || [])[1]) + "</b>" : pr.total ? "All phases done." : "Fill in your move and build the roadmap.") +
        (pr.overdue ? ' &middot; <span class="warn-text">' + pr.overdue + " overdue</span>" : "") + "</p></div></div>" +
        '<div class="row"><button type="button" class="btn small" id="rm-txt">Download (.txt)</button><button type="button" class="btn small" id="rm-ics">Add steps to calendar</button></div></section>' +
        SC.ROADMAP_PHASES.map(function (p) {
          var st = M.steps.filter(function (s) { return s.phase === p[0]; });
          return '<section class="card phase-card"><h3>' + E(p[1]) + "</h3>" + st.map(function (s) {
            return '<div class="step' + (s.done ? " done" : "") + (!s.done && s.due && s.due < today ? " late" : "") + '" data-id="' + s.id + '"><input type="checkbox" aria-label="Done" data-k="done"' + (s.done ? " checked" : "") + ">" +
              '<label class="sr-only" for="st-' + s.id + '">Step</label><input id="st-' + s.id + '" class="grow" data-k="text" value="' + E(s.text) + '">' +
              '<label class="sr-only" for="sd-' + s.id + '">Due</label><input id="sd-' + s.id + '" class="due" type="date" data-k="due" value="' + E(s.due) + '"><button type="button" class="btn tiny" data-rm aria-label="Remove step">x</button></div>';
          }).join("") + '<button type="button" class="btn small ghost" data-addstep="' + p[0] + '">Add a step</button></section>';
        }).join("") + "</div></div>";
      transfer();
    }
    function transfer() {
      var t = SC.transferable(SC.S.resume, M.postings), el = $("#rm-tr");
      if (!String(M.postings || "").trim()) { el.innerHTML = '<p class="fine">Your resume is compared with the postings by keyword: what you already show, and what the new field keeps asking for.</p>'; return; }
      el.innerHTML = "<h4>Already on your resume (" + t.keep.length + ")</h4><div class=\"chips\">" + (t.keep.map(function (k) { return '<span class="chip ok">' + E(k) + "</span>"; }).join("") || '<span class="fine">Nothing yet.</span>') + "</div>" +
        "<h4>Asked for, missing from your resume (" + t.gaps.length + ")</h4><div class=\"chips\">" + t.gaps.slice(0, 16).map(function (k) { return '<span class="chip">' + E(k) + "</span>"; }).join("") + "</div>" +
        (t.gaps.length ? '<button type="button" class="btn small" id="rm-gaps">Add the top skill gaps to Skills plan</button>' : "") +
        '<p class="fine">Keyword overlap only: it shows words, not ability. Add a skill to your resume only if it is true.</p>';
    }
    function text() {
      return ["CAREER CHANGE ROADMAP", "From: " + (M.from || "-"), "To: " + (M.to || "-"), "Target date: " + (M.end || "-"), M.why ? "Why: " + M.why : ""].filter(Boolean).concat(
        SC.ROADMAP_PHASES.map(function (p) { return "\n" + p[1].toUpperCase() + "\n" + M.steps.filter(function (s) { return s.phase === p[0]; }).map(function (s) { return (s.done ? "[x] " : "[ ] ") + s.text + (s.due ? " (by " + s.due + ")" : ""); }).join("\n"); })).join("\n");
    }
    draw();
    function onEdit(ev) {
      var el = ev.target, k = el.getAttribute("data-k"); if (!k) return;
      var row = el.closest("[data-id]");
      if (row) { var s = K.byId(M.steps, row.getAttribute("data-id")); if (!s) return; s[k] = k === "done" ? el.checked : k === "due" && !/^\d{4}-\d{2}-\d{2}$/.test(el.value) ? "" : el.value; }
      else { M[k] = el.value; if (k === "postings") transfer(); }
      saveSoon();
    }
    root.addEventListener("input", onEdit);
    root.addEventListener("change", function (ev) { var k = ev.target.getAttribute("data-k"); if (!k) return; onEdit(ev); if (k === "done" || k === "due") { SC.save(); draw(); } });
    root.addEventListener("click", function (ev) {
      var t = ev.target;
      if (t.id === "rm-build") {
        if (M.steps.length && !K.sure(t, "Click again to replace your steps")) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(M.start)) M.start = SC.today();
        M.steps = SC.roadmapTemplate(M.from, M.to, M.start, M.end); SC.save(); draw(); SC.toast("Roadmap built: " + M.steps.length + " dated steps. Edit any of them.");
      } else if (t.id === "rm-gaps") {
        var have = {}, n = 0, P = SC.S.skillsPlan; P.skills.forEach(function (s) { have[String(s.name).toLowerCase()] = 1; });
        SC.gapsFromPosting(SC.S.resume, M.postings, 6).forEach(function (g) { if (!have[g.toLowerCase()]) { P.skills.push(SC.blankSkill(g, 3, 1)); n++; } });
        if (!P.target && M.to) P.target = M.to;
        SC.save(); SC.toast(n ? "Added " + n + " skills to your Skills plan." : "Those skills are already in your plan.");
      } else if (t.hasAttribute("data-addstep")) {
        M.steps.push({ id: SC.uid(), phase: t.getAttribute("data-addstep"), text: "New step", due: M.end || "", done: false }); SC.save(); draw();
      } else if (t.hasAttribute("data-rm")) {
        var id = t.closest("[data-id]").getAttribute("data-id"); M.steps = M.steps.filter(function (s) { return s.id !== id; }); SC.save(); draw();
      } else if (t.id === "rm-txt") SC.download("career_change_roadmap.txt", text());
      else if (t.id === "rm-ics") K.calendar();
    });
  };

  /* ---------- wins log ---------- */
  SC.views.wins = function (root) {
    var W = SC.S.wins, range = { from: "", to: "" };
    function draw() {
      var y = new Date().getFullYear();
      root.innerHTML = K.head("Grow", "Wins log",
        "Write down every result while you still remember the numbers. At review time you will have a ready list, and every win can become a resume bullet in one click. Two minutes on a Friday is enough.") +
        '<div class="two"><div><section class="card"><h2>Log a win</h2><div class="cols">' + K.field("w-date", "Date", SC.today(), { type: "date" }) + K.field("w-tags", "Tags (comma separated)", "", { ph: "leadership, cost" }) + "</div>" +
        K.field("w-action", "What you did (start with a verb)", "", { ph: "Rebuilt the onboarding checklist for warehouse staff" }) +
        K.field("w-result", "Result, with a number if you can", "", { ph: "cutting ramp-up from 3 weeks to 2" }) +
        '<div id="w-coach" class="fine"></div><div class="row" style="margin-top:.6rem"><button type="button" class="btn primary" id="w-add" data-primary>Save win</button></div></section>' +
        '<section class="card"><h2>Review summary</h2><p class="fine">For performance reviews, promotion cases and "tell me about your achievements".</p><div class="cols">' +
        K.field("w-from", "From", range.from || y + "-01-01", { type: "date" }) + K.field("w-to", "To", range.to, { type: "date" }) + "</div>" +
        '<pre class="script" id="w-sum"></pre><div class="row"><button type="button" class="btn small" id="w-copy">Copy</button><button type="button" class="btn small" id="w-txt">Download .txt</button></div></section></div>' +
        '<section class="card"><h2>Your wins (' + W.length + ')</h2><div id="w-list"></div></section></div>';
      list(); sum(); coach();
    }
    function list() {
      var sorted = W.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }), q = null;
      $("#w-list").innerHTML = sorted.length ? sorted.map(function (w) {
        var b = SC.winBullet(w), c = SC.coachBullet(b), k = SC.quarter(w.date), head = k !== q ? '<h4 class="q-head">' + E(k) + "</h4>" : ""; q = k;
        return head + '<div class="win" data-id="' + w.id + '"><p><b>' + E(b) + '</b> <span class="score-pill ' + (c.grade === "strong" ? "strong" : "") + '">' + c.score + "</span></p>" +
          '<p class="fine">' + E(K.nice(w.date)) + (w.tags ? " &middot; " + E(w.tags) : "") + "</p>" +
          '<div class="row"><button type="button" class="btn small" data-resume>Add to resume</button><button type="button" class="btn small" data-copy>Copy bullet</button><button type="button" class="btn small" data-rm>Delete</button></div></div>';
      }).join("") : '<p class="muted">No wins yet. Start with the last thing you are proud of at work, school or as a volunteer.</p>';
    }
    function sum() { range.from = $("#w-from").value; range.to = $("#w-to").value; $("#w-sum").textContent = SC.winsReview(W, range.from, range.to, SC.S.resume.name).text; }
    function coach() {
      var b = SC.winBullet({ action: $("#w-action").value, result: $("#w-result").value });
      if (!b) { $("#w-coach").textContent = "Your bullet preview appears here."; return; }
      var c = SC.coachBullet(b);
      $("#w-coach").innerHTML = "<b>Bullet:</b> " + E(b) + ' <span class="score-pill ' + (c.grade === "strong" ? "strong" : "") + '">' + c.score + "</span> " + E(c.checks.filter(function (x) { return !x.ok; }).map(function (x) { return x.msg; })[0] || "Strong bullet.");
    }
    draw();
    root.addEventListener("input", function (ev) { var id = ev.target.id; if (id === "w-action" || id === "w-result") coach(); else if (id === "w-from" || id === "w-to") sum(); });
    root.addEventListener("click", function (ev) {
      var t = ev.target, row = t.closest("[data-id]"), w = row ? K.byId(W, row.getAttribute("data-id")) : null;
      if (t.id === "w-add") {
        var a = $("#w-action").value.trim(); if (!a) { SC.toast("Say what you did."); $("#w-action").focus(); return; }
        var d = $("#w-date").value; W.push(SC.blankWin({ date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : SC.today(), action: a, result: $("#w-result").value, tags: $("#w-tags").value }));
        SC.save(); draw(); SC.toast("Win saved.");
      } else if (t.id === "w-copy") SC.copy($("#w-sum").textContent);
      else if (t.id === "w-txt") SC.download("wins_review.txt", $("#w-sum").textContent);
      else if (w && t.hasAttribute("data-copy")) SC.copy(SC.winBullet(w));
      else if (w && t.hasAttribute("data-resume")) {
        var ex = SC.S.resume.experience[0];
        if (!ex) { SC.toast("Add a job to your resume first, then try again."); return; }
        var b = SC.winBullet(w); ex.bullets = ex.bullets || [];
        if (ex.bullets.indexOf(b) >= 0) { SC.toast("That bullet is already on your resume."); return; }
        ex.bullets.unshift(b); SC.save(); SC.toast("Added to " + (ex.role || "your latest job") + ". Review it in the resume builder.");
      } else if (w && t.hasAttribute("data-rm")) { if (!K.sure(t, "Click again to delete")) return; SC.S.wins = W = W.filter(function (x) { return x.id !== w.id; }); SC.save(); draw(); }
    });
  };
})();
