/* Guided "first resume in 10 minutes" flow, and the resume / LinkedIn import with a review step. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;
  function inp(label, id, val, ph, type, extra) {
    return '<div><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || "text") + '" value="' + E(val || "") + '"' + (ph ? ' placeholder="' + E(ph) + '"' : "") + (extra || "") + "></div>";
  }
  function fmt(sec) { var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }

  /* ---------------- guided flow ---------------- */
  var STEPS = [
    ["you", "You", "Start with the basics. Only your name is required to move on."],
    ["job", "Latest job", "Your most recent job. No work history yet? Use a volunteer role, a school project or a part-time job."],
    ["wins", "Wins", "Three things you did there, each starting with a verb. Numbers make them twice as strong."],
    ["more", "One more", "An earlier job adds weight. Skip it if you have only one."],
    ["skills", "Skills", "Click the ones that are true, or type your own."],
    ["edu", "Education", "Your highest degree, diploma or program. Skip if it does not apply."],
    ["summary", "Summary", "Two or three sentences on top. Let the tool draft it from what you typed, then edit."],
    ["done", "Print", "Pick a look and print. You can change anything later."]
  ];

  SC.views.start = function (root) {
    var R = SC.S.resume, step = Math.min(+(SC.S.seen.flowStep || 0), STEPS.length - 1), t0 = SC.S.seen.flowT0 || 0;
    if (!t0 || Date.now() - t0 > 6 * 3600e3) { t0 = Date.now(); SC.S.seen.flowT0 = t0; }
    function job(i) { while (R.experience.length <= i) R.experience.push({ role: "", company: "", loc: "", start: "", end: "", bullets: [] }); return R.experience[i]; }

    function bulletBox(ji, k) {
      var b = (R.experience[ji] && R.experience[ji].bullets[k]) || "";
      return '<div class="fb" data-fb="' + ji + ":" + k + '"><label for="fb-' + ji + "-" + k + '">Win ' + (k + 1) + '</label><input id="fb-' + ji + "-" + k + '" data-bul="' + ji + ":" + k + '" value="' + E(b) + '" placeholder="' +
        ["Reduced order errors by 30% by adding a checklist", "Trained 6 new staff on the register and stock system", "Handled 50+ customer calls a day with top ratings"][k % 3] + '"><div class="fb-coach" id="fc-' + ji + "-" + k + '">' + miniCoach(b, ji, k) + "</div></div>";
    }
    function miniCoach(b, ji, k) {
      if (!String(b).trim()) return "";
      var c = SC.coachBullet(b), bad = c.checks.filter(function (x) { return x.id === "fill"; })[0] || c.checks.filter(function (x) { return !x.ok; })[0], sug = SC.powerUp(c.text)[0], qs = c.checks[1].ok ? [] : SC.quantifyPrompts(c.text).slice(0, 1);
      return '<span class="score-pill ' + c.grade + '">' + c.score + "</span> " + (bad ? E(bad.msg) : "Strong bullet.") +
        (c.score < 85 && sug ? '<div class="fb-sug"><span>' + E(sug).replace(/\[([^\]]*)\]/g, "<mark>[$1]</mark>") + '</span><button type="button" class="btn tiny primary" data-fuse="' + ji + ":" + k + '">Use</button></div>' : "") +
        (qs.length ? '<div class="fine">' + E(qs[0]) + "</div>" : "");
    }

    function body() {
      var id = STEPS[step][0], j0 = R.experience[0] || {}, j1 = R.experience[1] || {};
      if (id === "you") return '<div class="cols">' + inp("Full name", "g-name", R.name, "Jordan Ellis", "text", " required autocomplete=\"name\"") + inp("Job title you want", "g-title", R.title, "Operations Coordinator") +
        inp("Email", "g-email", R.email, "you@example.com", "email") + inp("Phone", "g-phone", R.phone, "555-0142", "tel") + inp("City, region", "g-location", R.location, "Columbus, OH") + inp("LinkedIn or portfolio (optional)", "g-links", R.links, "linkedin.com/in/you") + "</div>";
      if (id === "job" || id === "more") {
        var i = id === "job" ? 0 : 1, j = i ? j1 : j0, cur = /present/i.test(j.end || "");
        return '<div class="cols">' + inp("Job title", "gj-role-" + i, j.role, i ? "Customer Service Representative" : "Operations Coordinator") + inp("Employer", "gj-company-" + i, j.company, "Brightway Freight") +
          inp("Location", "gj-loc-" + i, j.loc, "Columbus, OH") + inp("Start", "gj-start-" + i, j.start, "Mar 2021") + inp("End", "gj-end-" + i, j.end, "Feb 2024") + "</div>" +
          '<label class="check"><input type="checkbox" id="gj-now-' + i + '"' + (cur ? " checked" : "") + "> I work here now</label>" +
          (i ? '<h3 style="margin-top:1rem">Two wins from this job</h3>' + bulletBox(1, 0) + bulletBox(1, 1) : "");
      }
      if (id === "wins") return '<p class="fine">For <b>' + E(j0.role || "your latest job") + "</b>" + (j0.company ? " at " + E(j0.company) : "") + ". Formula: <b>strong verb + what you did + the result with a number</b>.</p>" + bulletBox(0, 0) + bulletBox(0, 1) + bulletBox(0, 2) +
        '<details class="fine"><summary>Stuck? Strong verbs to start with</summary><p>' + ["led", "built", "reduced", "trained", "resolved", "organized", "improved", "launched", "managed", "saved", "grew", "scheduled", "created", "delivered"].join(", ") + "</p></details>";
      if (id === "skills") {
        var sug = SC.suggestSkills(R, 14);
        return '<label for="g-skills">Skills (comma separated)</label><textarea id="g-skills" rows="3" placeholder="Excel, Scheduling, Customer service">' + E(R.skills) + "</textarea>" +
          (sug.length ? '<p class="fine">Suggestions from what you wrote. Add only what is true:</p><p class="chips" id="g-sug">' + sug.map(function (s) { return '<button type="button" class="chip add" data-skill="' + E(s) + '">+ ' + E(s) + "</button>"; }).join("") + "</p>" : "");
      }
      if (id === "edu") { var e = R.education[0] || {}; return '<div class="cols">' + inp("Degree, diploma or program", "ge-degree", e.degree, "B.S. Business Administration") + inp("School", "ge-school", e.school, "Ohio State University") + inp("Year", "ge-year", e.year, "2018") + "</div>"; }
      if (id === "summary") return '<label for="g-summary">Summary</label><textarea id="g-summary" rows="5" placeholder="Operations coordinator with 6 years in logistics...">' + E(R.summary) + '</textarea><div class="row"><button type="button" class="btn" id="g-draft">Draft it for me</button><span class="fine">Built from your title, dates, skills and strongest bullet. No AI, just a formula. Edit it so it sounds like you.</span></div>';
      return '<div class="tpl-pick small" role="group" aria-label="Template">' + SC.TEMPLATES.slice(0, 12).map(function (t) {
        return '<button type="button" data-tpl="' + t.id + '" class="' + (R.template === t.id ? "on" : "") + '" aria-pressed="' + (R.template === t.id) + '"><span class="thumb" aria-hidden="true"><span class="thumb-in">' + SC.renderResume(R, t.id) + "</span></span><b>" + t.name + "</b></button>"; }).join("") + "</div>" +
        '<div class="row" style="margin-top:1rem"><button type="button" class="btn primary" id="g-print">Print or save as PDF</button><a class="btn" href="#/resume">Open in the full editor</a><a class="btn" href="#/match">Tailor it to a job</a></div>' +
        '<p class="fine">Done in <b id="g-took"></b>. Next steps: paste a job posting into Tailor, then practise with a mock interview.</p>';
    }
    function stepper() {
      return '<ol class="stepper">' + STEPS.map(function (s, i) { return '<li class="' + (i < step ? "done" : i === step ? "on" : "") + '"><button type="button" data-step="' + i + '"' + (i === step ? ' aria-current="step"' : "") + "><span>" + (i + 1) + "</span>" + s[1] + "</button></li>"; }).join("") + "</ol>";
    }
    function draw() {
      var s = STEPS[step], last = step === STEPS.length - 1, skippable = ["more", "edu"].indexOf(s[0]) !== -1;
      $("#flow").innerHTML = stepper() + '<form class="card flow-card" id="gform" novalidate><p class="eyebrow">Step ' + (step + 1) + " of " + STEPS.length + "</p><h2>" + s[1] + '</h2><p class="fine">' + s[2] + "</p>" + body() +
        '<div class="row flow-nav">' + (step ? '<button type="button" class="btn ghost" id="g-back">Back</button>' : "") + '<span class="grow"></span>' +
        (skippable ? '<button type="button" class="btn ghost" id="g-skip">Skip</button>' : "") + (last ? "" : '<button type="submit" class="btn primary" data-primary id="g-next">Next</button>') + "</div></form>";
      $("#gbar").style.setProperty("--p", Math.round(100 * step / (STEPS.length - 1)));
      var f = $("#gform input, #gform textarea"); if (f && step) f.focus();
      if (last) { var took = $("#g-took"); if (took) took.textContent = fmt(Math.round((Date.now() - t0) / 1000)); }
      SC.S.seen.flowStep = step; SC.save(); preview();
    }
    var pv = null;
    function preview() { if (pv) pv.innerHTML = SC.renderResume(R, R.template); }
    var previewSoon = SC.debounce(preview, 80), saveSoon = SC.debounce(SC.save, 300);
    function go(n) {
      if (STEPS[step][0] === "you" && n > step && !String(R.name).trim()) { SC.toast("Add your name to continue."); var nm = $("#g-name"); if (nm) nm.focus(); return; }
      if (STEPS[step][0] === "more" && n > step) { var j = R.experience[1]; if (j && !String(j.role).trim() && !String(j.company).trim() && !j.bullets.join("").trim()) R.experience.splice(1); }
      step = Math.max(0, Math.min(STEPS.length - 1, n)); draw();
    }

    var fresh = SC.hasResume(R) && !SC.S.seen.flowStep;
    root.innerHTML = '<div class="view-head row between"><div><p class="eyebrow">First resume</p><h1>A printable resume in about 10 minutes</h1><p class="lede">One short step at a time. Everything saves as you type, and the page on the right fills in as you go.</p></div>' +
      '<div class="clock" aria-live="off"><span id="g-clock">0:00</span><small>of about 10:00</small></div></div>' +
      (fresh ? '<div class="hint row between"><span>You already have a resume. The flow fills in its gaps, or you can start clean (your current one is kept as a version).</span><button type="button" class="btn small" id="g-fresh">Start clean</button></div>' : "") +
      '<div class="gbar" id="gbar" style="--p:0"><span></span></div><div class="two wide-right"><div id="flow"></div><div><div class="card preview-card mini"><div class="paper-wrap"><div class="paper-mini"><div class="paper" id="g-paper"></div></div></div></div></div></div>';
    pv = $("#g-paper");
    var clock = setInterval(function () { var c = $("#g-clock"); if (c) c.textContent = fmt(Math.round((Date.now() - t0) / 1000)); }, 1000);
    SC.cleanups.push(function () { clearInterval(clock); });
    SC.onPrint = function () { SC.printResume(R, false); };
    draw();

    root.addEventListener("submit", function (ev) { ev.preventDefault(); go(step + 1); });
    root.addEventListener("input", function (ev) {
      var t = ev.target, id = t.id || "", m;
      if ((m = /^g-(name|title|email|phone|location|links|skills|summary)$/.exec(id))) R[m[1]] = t.value;
      else if ((m = /^gj-(role|company|loc|start|end)-(\d)$/.exec(id))) job(+m[2])[m[1]] = t.value;
      else if ((m = /^ge-(degree|school|year)$/.exec(id))) { if (!R.education[0]) R.education.push({ school: "", degree: "", year: "", notes: "" }); R.education[0][m[1]] = t.value; }
      else if (t.hasAttribute("data-bul")) {
        var p = t.getAttribute("data-bul").split(":"), jj = job(+p[0]), k = +p[1];
        while (jj.bullets.length <= k) jj.bullets.push("");
        jj.bullets[k] = t.value; var box = $("#fc-" + p[0] + "-" + k); if (box) box.innerHTML = miniCoach(t.value, +p[0], k);
      } else return;
      previewSoon(); saveSoon();
    });
    root.addEventListener("change", function (ev) {
      var m = /^gj-now-(\d)$/.exec(ev.target.id || ""); if (!m) return;
      var j = job(+m[1]); j.end = ev.target.checked ? "Present" : ""; var e = $("#gj-end-" + m[1]); if (e) e.value = j.end; preview(); SC.save();
    });
    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.id === "g-back") go(step - 1);
      else if (b.id === "g-skip") { if (STEPS[step][0] === "more") R.experience.splice(1); step++; draw(); }
      else if (b.hasAttribute("data-step")) go(+b.getAttribute("data-step"));
      else if (b.id === "g-draft") { R.summary = SC.draftSummary(R, new Date().getFullYear()); $("#g-summary").value = R.summary; preview(); SC.save(); }
      else if (b.hasAttribute("data-skill")) {
        var sk = R.skills.split(/\s*[,;]\s*/).map(function (x) { return x.trim(); }).filter(Boolean), add = b.getAttribute("data-skill");
        if (sk.map(function (x) { return x.toLowerCase(); }).indexOf(add) === -1) sk.push(add.charAt(0).toUpperCase() + add.slice(1));
        R.skills = sk.join(", "); $("#g-skills").value = R.skills; b.remove(); preview(); SC.save();
      }
      else if (b.hasAttribute("data-fuse")) {
        var p = b.getAttribute("data-fuse").split(":"), jj = job(+p[0]), sug = SC.powerUp(SC.coachBullet(jj.bullets[+p[1]]).text)[0];
        jj.bullets[+p[1]] = sug; var input = $("#fb-" + p[0] + "-" + p[1]); input.value = sug; $("#fc-" + p[0] + "-" + p[1]).innerHTML = miniCoach(sug, +p[0], +p[1]);
        var a = sug.indexOf("["), z = sug.indexOf("]", a); input.focus(); if (a >= 0) input.setSelectionRange(a, z + 1);
        preview(); SC.save();
      }
      else if (b.hasAttribute("data-tpl")) { R.template = b.getAttribute("data-tpl"); SC.$$(".tpl-pick button").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); }); preview(); SC.save(); }
      else if (b.id === "g-print") { SC.printResume(R, false); }
      else if (b.id === "g-fresh") { SC.saveVersion(R, { name: "Before the guided flow" }); var tp = R.template; SC.S.resume = R = SC.blankResume(); R.template = tp; step = 0; b.closest(".hint").remove(); draw(); SC.toast("Starting clean. Your old resume is saved under Versions in Tailor."); }
    });
  };

  /* ---------------- import ---------------- */
  var EXAMPLE = "Sam Rivera\nWarehouse Lead at Acme Distribution\nColumbus, Ohio, United States\nContact info\n\nAbout\nWarehouse lead with 5 years in distribution. I keep orders moving and teams safe.\n\nExperience\nWarehouse Lead\nAcme Distribution · Full-time\nJan 2022 - Present · 2 yrs 11 mos\nColumbus, Ohio, United States\nLed a crew of 8 pickers across two shifts and cut mis-picks by 22%.\nHelped with inventory counts and various other things.\n\nWarehouse Associate\nAcme Distribution · Full-time\nMay 2019 - Dec 2021\n- Picked and packed 300 orders per shift with 99.6% accuracy\n- Trained 5 new associates on the scanner system\n\nEducation\nColumbus State Community College\nAssociate of Applied Science - AAS, Supply Chain Management\n2017 - 2019\n\nLicenses & certifications\nOSHA 10-Hour General Industry\nIssued Mar 2021\n\nSkills\nInventory control\nForklift\n5 endorsements\nTeam leadership\nSafety";

  SC.views.import = function (root) {
    var P = null, txt = SC.S.seen.importText || "";
    function pasteHTML() {
      return '<div class="two"><div class="card"><label for="imp-text">Paste your resume or LinkedIn profile text</label><textarea id="imp-text" rows="16" placeholder="Open your resume (Word or PDF) or your LinkedIn profile, select all, copy, and paste here.">' + E(txt) + "</textarea>" +
        '<div class="row" style="margin-top:.7rem"><button type="button" class="btn primary" id="imp-go" data-primary>Read it</button><button type="button" class="btn ghost" id="imp-ex">Try an example</button><span class="fine"><kbd>Ctrl Enter</kbd></span></div></div>' +
        '<div class="card"><h2>How it works</h2><ol><li>Paste text from a resume, a LinkedIn profile (or its "Save to PDF" file) or a Stark Career .txt export.</li><li>Plain rules find the headings, contact details, job titles, employers, dates and bullets.</li><li>You review every field before anything replaces your resume.</li></ol>' +
        '<p class="fine">Nothing is uploaded. Layouts with two columns or tables may paste in a jumbled order; if that happens, fix it in the review or paste one section at a time.</p></div></div>';
    }
    function f(path, label, val, rows) {
      return rows ? '<div><label for="p-' + path + '">' + label + '</label><textarea id="p-' + path + '" data-p="' + path + '" rows="' + rows + '">' + E(val) + "</textarea></div>"
        : '<div><label for="p-' + path + '">' + label + '</label><input id="p-' + path + '" data-p="' + path + '" value="' + E(val) + '"></div>';
    }
    function reviewHTML() {
      var r = P.resume, s = P.stats;
      return '<div class="card"><div class="card-head"><h2>Review what was found</h2><div class="row"><button type="button" class="btn ghost" id="imp-back">Back</button>' +
        '<button type="button" class="btn" id="imp-merge">Add to my resume</button><button type="button" class="btn primary" id="imp-use" data-primary>Use as my resume</button></div></div>' +
        '<p class="chips">' + [[r.name ? "Name" : "", !!r.name], [(r.email || r.phone) ? "Contact" : "", !!(r.email || r.phone)], [s.jobs + " job" + (s.jobs === 1 ? "" : "s"), s.jobs > 0], [s.bullets + " bullets", s.bullets > 0], [s.schools + " school" + (s.schools === 1 ? "" : "s"), s.schools > 0], [s.skills + " skills", s.skills > 0], [s.certs + " certification" + (s.certs === 1 ? "" : "s"), s.certs > 0]]
          .filter(function (x) { return x[0]; }).map(function (x) { return '<span class="chip ' + (x[1] ? "ok" : "no") + '">' + E(x[0]) + "</span>"; }).join("") + "</p>" +
        (P.notes.length ? P.notes.map(function (n) { return '<div class="hint warn">' + E(n) + "</div>"; }).join("") : '<div class="hint">Everything landed somewhere. Give it a quick check below.</div>') + "</div>" +
        '<div class="card"><h3>Contact and summary</h3><div class="cols">' + f("name", "Name", r.name) + f("title", "Headline", r.title) + f("email", "Email", r.email) + f("phone", "Phone", r.phone) + f("location", "Location", r.location) + f("links", "Link", r.links) + "</div>" +
        f("summary", "Summary", r.summary, 3) + f("skills", "Skills", r.skills, 2) + "</div>" +
        '<div class="card"><h3>Experience</h3>' + (r.experience.length ? r.experience.map(function (j, i) {
          return '<div class="entry"><div class="cols">' + f("ex." + i + ".role", "Job title", j.role) + f("ex." + i + ".company", "Employer", j.company) + f("ex." + i + ".loc", "Location", j.loc) + f("ex." + i + ".start", "Start", j.start) + f("ex." + i + ".end", "End", j.end) + "</div>" +
            f("ex." + i + ".bullets", "Bullets (" + j.bullets.length + ")", j.bullets.join("\n"), Math.min(8, Math.max(2, j.bullets.length + 1))) + '<div class="row end"><button type="button" class="btn tiny danger" data-drop="' + i + '">Drop this job</button></div></div>';
        }).join("") : '<p class="muted">No jobs recognized.</p>') + "</div>" +
        '<div class="card"><h3>Education and certifications</h3>' + r.education.map(function (e, i) { return '<div class="cols">' + f("ed." + i + ".degree", "Degree", e.degree) + f("ed." + i + ".school", "School", e.school) + f("ed." + i + ".year", "Year", e.year) + "</div>"; }).join("") +
        f("certs", "Certifications (one per line)", r.certs, 2) + "</div>" +
        (P.unplaced.length ? '<div class="card"><h3>Lines that did not fit a section</h3><p class="fine">Projects, volunteering, languages and similar sections are listed here so nothing is lost. Copy what you need into a job or your summary.</p><pre class="script">' + E(P.unplaced.join("\n")) + "</pre></div>" : "");
    }
    function draw() { $("#imp").innerHTML = P ? reviewHTML() : pasteHTML(); }
    root.innerHTML = '<div class="view-head"><p class="eyebrow">Import</p><h1>Import an existing resume or LinkedIn profile</h1><p class="lede">Paste the text, check the result, and you are editing in under a minute. Rule-based and offline: nothing leaves this computer.</p></div><div id="imp"></div>';
    draw();
    function set(path, val) {
      var r = P.resume, p = path.split(".");
      if (p[0] === "ex") { var j = r.experience[+p[1]]; if (p[2] === "bullets") j.bullets = val.split("\n").map(function (x) { return x.trim(); }).filter(Boolean); else j[p[2]] = val; }
      else if (p[0] === "ed") r.education[+p[1]][p[2]] = val;
      else r[path] = val;
    }
    root.addEventListener("input", function (ev) {
      if (ev.target.id === "imp-text") { txt = ev.target.value; SC.S.seen.importText = txt.length < 20000 ? txt : ""; return; }
      var p = ev.target.getAttribute("data-p"); if (p && P) set(p, ev.target.value);
    });
    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.id === "imp-ex") { txt = EXAMPLE; $("#imp-text").value = txt; }
      else if (b.id === "imp-go") {
        if (!txt.trim()) { SC.toast("Paste some text first."); return; }
        var t1 = performance.now(); P = SC.parseResume(txt); SC.perf.parse = Math.round(performance.now() - t1); SC.save(); draw(); window.scrollTo(0, 0);
      }
      else if (b.id === "imp-back") { P = null; draw(); }
      else if (b.hasAttribute("data-drop")) { P.resume.experience.splice(+b.getAttribute("data-drop"), 1); P.stats.jobs--; draw(); }
      else if (b.id === "imp-use" || b.id === "imp-merge") {
        var cur = SC.S.resume, merge = b.id === "imp-merge";
        if (SC.hasResume(cur)) SC.saveVersion(cur, { name: merge ? "Before adding an import" : "Before import" });
        var next = merge ? SC.mergeResume(cur, P.resume) : P.resume; next.template = cur.template || "classic";
        SC.S.resume = next; SC.S.seen.importText = ""; SC.save(); SC.go("#/resume");
        SC.toast(merge ? "Added to your resume." : "Imported. Your previous resume is kept under Versions in Tailor.");
      }
    });
  };
})();
