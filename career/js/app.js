/* Stark Career shell: state, storage, router, helpers, home dashboard. */
var SC = window.SC || (window.SC = {});
(function () {
  "use strict";
  var KEY = "stark_career_v1";
  SC.views = {}; SC.cleanups = []; SC.perf = {};

  SC.$ = function (s, r) { return (r || document).querySelector(s); };
  SC.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function defaults() {
    var d = { v: 2, theme: "dark", resume: SC.blankResume(), letter: SC.blankLetter(), jobText: "", matchSource: "built", matchResume: "",
      apps: [], iv: { ratings: {}, notes: {}, last: {}, mocks: [] }, salary: {},
      versions: [], sprint: SC.blankSprint(), net: { tpl: "outreach", vals: {} }, li: { formula: "role-proof", vals: {}, about: {} },
      design: { on: false, accent: "teal", fmt: "", opt: { photo: true, place: "", date: "", refs: true } }, tailor: { role: "", company: "" }, seen: {} };
    return Object.assign(d, SC.careerDefaults());
  }
  SC.S = defaults();
  var memOnly = false, safeRaw = null, store = null;
  function lsOrNull() { try { return window.localStorage; } catch (e) { return null; } }
  SC.stateTemplate = defaults;
  SC.isSafe = function () { return safeRaw !== null; };
  function parseState(raw) {
    var o = SC.parseSafe(raw);
    if (!o || typeof o !== "object" || Array.isArray(o) || raw.length > 8000000) throw new Error("bad state");
    return o;
  }
  SC.load = function () {
    var raw = null, o = null;
    try { raw = localStorage.getItem(KEY); store = SC.makeStore(lsOrNull(), KEY); } catch (e) { memOnly = true; return; }
    if (!raw) return;
    try { o = parseState(raw); store.seed(raw); }
    catch (e) {
      try {
        var bak = localStorage.getItem(KEY + ".bak");
        if (bak) { o = parseState(bak); store.seed(bak); SC.recovered = true; }
      } catch (e2) { o = null; }
      if (!o) { safeRaw = raw; memOnly = true; return; }
    }
    try { SC.S = SC.mergeState(o); } catch (e) { safeRaw = raw; memOnly = true; SC.S = defaults(); }
  };
  SC.rawData = function () { return safeRaw; };
  /* Leave safe mode after a valid restore: keep the unreadable data under a .corrupt key first. */
  SC.leaveSafe = function () {
    // Keep the unreadable copy only while it is small: a big one would eat the space the real data needs (it was offered as an export).
    try { if (safeRaw && safeRaw.length <= 1000000) localStorage.setItem(KEY + ".corrupt", safeRaw); else localStorage.removeItem(KEY + ".corrupt"); } catch (e) { }
    safeRaw = null; memOnly = false; var b = SC.$("#safe-banner"); if (b) b.remove();
  };
  SC.safeBanner = function () {
    if (safeRaw === null || SC.$("#safe-banner")) return;
    var b = document.createElement("div"), p = document.createElement("p"), btn = document.createElement("button");
    b.id = "safe-banner"; b.className = "safe-banner"; b.setAttribute("role", "alert");
    p.textContent = "Your saved data could not be read, so Stark Career opened in read-only safe mode. Nothing was changed or deleted and nothing will be saved. Export the raw data first, then restore a backup on the Backup page.";
    btn.type = "button"; btn.className = "btn small"; btn.textContent = "Export raw data";
    btn.addEventListener("click", function () { SC.download("stark_career_raw_data.txt", safeRaw || "", "text/plain"); });
    b.appendChild(p); b.appendChild(btn);
    var c = SC.$(".content"); if (c) c.insertBefore(b, c.firstChild);
  };
  SC.mergeState = function (o) {
    var d = defaults(); o = o && typeof o === "object" ? o : {};
    Object.keys(d).forEach(function (k) { if (o[k] !== undefined && o[k] !== null && typeof o[k] === typeof d[k] && Array.isArray(o[k]) === Array.isArray(d[k])) d[k] = o[k]; });
    d.resume = Object.assign(SC.blankResume(), d.resume);
    d.resume.experience = Array.isArray(d.resume.experience) ? d.resume.experience : [];
    d.resume.education = Array.isArray(d.resume.education) ? d.resume.education : [];
    d.letter = Object.assign(SC.blankLetter(), d.letter);
    d.apps = Array.isArray(o.apps) ? o.apps : [];
    d.iv = Object.assign({ ratings: {}, notes: {}, last: {}, mocks: [] }, d.iv);
    if (!Array.isArray(d.iv.mocks)) d.iv.mocks = [];
    var sp = SC.blankSprint(); d.sprint = { goals: Object.assign(sp.goals, d.sprint.goals || {}), log: Array.isArray(d.sprint.log) ? d.sprint.log : [] };
    d.net = Object.assign({ tpl: "outreach", vals: {} }, d.net);
    d.li = Object.assign({ formula: "role-proof", vals: {}, about: {} }, d.li);
    d.design = Object.assign({ on: false, accent: "teal", fmt: "", opt: {} }, d.design);
    if (["europass", "german", "uk"].indexOf(d.design.fmt) < 0) d.design.fmt = "";
    d.design.opt = Object.assign({ photo: true, place: "", date: "", refs: true }, d.design.opt && typeof d.design.opt === "object" ? d.design.opt : {});
    d.design.opt.photo = d.design.opt.photo !== false; d.design.opt.refs = d.design.opt.refs !== false;
    d.design.opt.place = typeof d.design.opt.place === "string" ? d.design.opt.place.slice(0, 120) : ""; d.design.opt.date = typeof d.design.opt.date === "string" ? d.design.opt.date.slice(0, 40) : "";
    SC.mergeCareer(d);
    return SC.cleanState(d);
  };
  SC.save = function () {
    if (safeRaw !== null) return;
    if (memOnly || !store) { saveBanner(true, "Browser storage is blocked for this page, so changes are kept only until you close it."); return; }
    var txt = JSON.stringify(SC.S), r = store.save(txt, Date.now());
    if (!r.ok) { saveBanner(true, "Not saved: browser storage is full or blocked. Your changes are still here, and every edit tries again."); return; }
    if (r.recovered) { saveBanner(false); SC.toast("Saved again."); }
    if (SC.liveFile && SC.liveFile.on()) SC.liveFile.write(SC.wrapBackup(SC.S));
  };
  // A failed save stays on screen (role=alert) until a later save works, with a one-click file backup.
  function saveBanner(on, text) {
    var b = SC.$("#save-banner");
    if (!on) { if (b) b.remove(); return; }
    if (b) { if (b.firstChild) b.firstChild.textContent = text; return; }
    b = document.createElement("div"); b.id = "save-banner"; b.className = "save-banner"; b.setAttribute("role", "alert");
    var p = document.createElement("p"), btn = document.createElement("button"); p.textContent = text;
    btn.type = "button"; btn.className = "btn small primary"; btn.textContent = "Download a backup file now";
    btn.addEventListener("click", function () { SC.download("stark_career_backup_" + SC.today() + ".json", SC.wrapBackup(SC.S), "application/json"); });
    b.appendChild(p); b.appendChild(btn);
    var c = SC.$(".content"); if (c) c.insertBefore(b, c.firstChild);
  }

  // Good news is polite and short; a problem (bad = true) is an alert that stays 9 s or more, waits while hovered or focused, and has a close button.
  var toastT = 0;
  SC.toast = function (msg, bad) {
    var t = SC.$(bad ? "#toast-alert" : "#toast"), o = SC.$(bad ? "#toast" : "#toast-alert");
    if (!t) return;
    if (o) o.hidden = true;
    t.textContent = msg;
    if (bad) { var x = document.createElement("button"); x.type = "button"; x.className = "toast-x"; x.setAttribute("aria-label", "Dismiss this message"); x.textContent = "\u00d7"; x.addEventListener("click", function () { t.hidden = true; }); t.appendChild(x); }
    t.hidden = false; t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop");
    clearTimeout(toastT);
    (function arm(ms) { toastT = setTimeout(function () { var held = false; try { held = t.matches(":hover") || t.contains(document.activeElement); } catch (e) { held = false; } if (held) arm(1500); else t.hidden = true; }, ms); })(bad ? 9000 : 2600);
  };
  SC.download = function (name, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain" }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };
  SC.copy = function (text) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); SC.toast("Copied."); } catch (e) { SC.toast("Copy failed. Select the text and copy it by hand."); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { SC.toast("Copied."); }, fallback);
    else fallback();
  };
  SC.printHTML = function (html) {
    var s = SC.$("#print-sheet"); s.innerHTML = html;
    var done = function () { s.innerHTML = ""; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  };
  SC.printResume = function (m, design, fmt) {
    m = m || SC.S.resume;
    if (fmt && SC.renderFormat) { SC.printHTML('<div class="paper a4">' + SC.renderFormat(m, fmt, SC.S.design.opt) + "</div>"); return; }
    SC.printHTML(design ? '<div class="paper design-paper">' + SC.renderDesign(m, SC.S.design.accent) + "</div>" : '<div class="paper">' + SC.renderResume(m, m.template) + "</div>");
  };
  SC.debounce = function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; };
  SC.log = function (type) { SC.logActivity(SC.S.sprint, type, SC.today()); SC.save(); };
  SC.saveVersion = function (resume, meta) {
    var v = { id: SC.uid(), name: meta.name || "Version", company: meta.company || "", role: meta.role || "", created: SC.today(),
      score: meta.score == null ? null : meta.score, appId: meta.appId || null, jobText: meta.jobText || "", resume: JSON.parse(JSON.stringify(resume)) };
    SC.S.versions.unshift(v); SC.save(); return v;
  };
  /* Free-trial hook: only the trial build sets SC.trial. The paid app never limits anything. Saved records are never deleted. */
  SC.canAddApp = function () {
    var t = SC.trial;
    if (!t || !t.capApps || SC.S.apps.length < t.capApps) return true;
    if (t.onLimit) t.onLimit();
    return false;
  };
  SC.hasResume = function (r) { r = r || SC.S.resume; return !!(String(r.name).trim() || r.experience.length || String(r.summary).trim()); };

  /* Navigation: [id, label, group, shortcut letter after g] */
  var NAV = [
    ["home", "Home", "", "h"],
    ["start", "First resume", "Build", "f"], ["import", "Import", "Build", "i"], ["resume", "Resume", "Build", "r"], ["cover", "Cover letter", "Build", "c"], ["portfolio", "Portfolio", "Build", "p"],
    ["match", "Tailor to a job", "Apply", "t"], ["sprint", "Sprint", "Apply", "s"], ["tracker", "Applications", "Apply", "a"], ["network", "Network", "Apply", "n"], ["contacts", "Contacts", "Apply", "o"], ["forecast", "Forecast", "Apply", "u"], ["ask", "Ask", "Apply", "q"],
    ["interview", "Interviews", "Prepare", "v"], ["salary", "Salary and offers", "Prepare", "m"],
    ["skills", "Skills plan", "Grow", "k"], ["change", "Career change", "Grow", "d"], ["wins", "Wins", "Grow", "w"], ["freelance", "Freelance", "Grow", "e"],
    ["backup", "Backup", "", "b"]
  ];
  SC.nav = NAV;
  SC.sub = function () { return (location.hash.replace(/^#\/?/, "").split("/")[1] || ""); };
  SC.go = function (hash) { if (location.hash === hash) route(); else location.hash = hash; };
  function navHTML(name) {
    var h = "", g = null;
    NAV.forEach(function (n) {
      if (n[2] !== g) { if (g !== null) h += "</div>"; g = n[2]; h += '<div class="nav-group">' + (g ? '<p class="nav-label">' + g + "</p>" : ""); }
      h += '<a href="#/' + n[0] + '" data-nav="' + n[0] + '"' + (n[0] === name ? ' class="on" aria-current="page"' : "") + '><span class="nav-dot" aria-hidden="true"></span>' + n[1] +
        (n[0] === "tracker" && dueCount() ? '<span class="nav-badge" aria-label="follow-ups due">' + dueCount() + "</span>" : "") + "</a>";
    });
    return h + "</div>";
  }
  var enterT = 0;
  function dueCount() { return SC.dueFollowUps(SC.S.apps, SC.today()).length; }
  function route() {
    var name = (location.hash.replace(/^#\/?/, "") || "home").split("/")[0];
    if (!SC.views[name]) name = "home";
    SC.cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) { } });
    SC.$("#mainnav").innerHTML = navHTML(name);
    SC.$("#toast").hidden = true;
    /* Every view attaches its handlers to the #main container. Leaving a view swaps in a fresh, empty copy of that container, so no handler of an
       earlier view can fire on a later view's buttons (a CV-editor click handler used to throw on the Network page's template buttons). */
    var old = SC.$("#main"), main = old.cloneNode(false); old.parentNode.replaceChild(main, old);
    SC.onPrint = null; SC.onKey = null; SC.current = name; SC.views[name](main);
    main.classList.remove("enter"); void main.offsetWidth; main.classList.add("enter");
    clearTimeout(enterT); enterT = setTimeout(function () { main.classList.remove("enter"); }, 520);
    var item = NAV.filter(function (n) { return n[0] === name; })[0];
    document.title = (name === "home" ? "" : item[1] + " - ") + "Stark Career";
    window.scrollTo(0, 0);
  }

  function ring(pct, label, size) {
    return '<div class="ring' + (size ? " " + size : "") + '" style="--p:' + pct + '"><span>' + SC.esc(label) + "</span></div>";
  }
  SC.ringHTML = ring;

  SC.views.home = function (root) {
    var today = SC.today(), plan = SC.todayPlan(SC.S.apps, SC.S.sprint, today).concat(SC.contactsDue(SC.S.contacts, today).slice(0, 2).map(function (x) {
      return { kind: "net-contact", text: "Reach out to " + (x.c.name || "a contact"), meta: x.c.last ? (x.late ? x.late + " days past your rhythm" : "due today") : "never contacted", href: "#/contacts" }; })), wk = SC.sprintWeek(SC.S.sprint.log, SC.S.sprint.goals, today);
    var streak = SC.sprintStreak(SC.S.sprint.log, today), has = SC.hasResume(), st = SC.trackerStats(SC.S.apps);
    var hour = new Date().getHours(), hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    var first = String(SC.S.resume.name || "").trim().split(/\s+/)[0];
    var quick = has ? [
      ["match", "Tailor to a job", "Paste a posting. Get a tailored copy, missing keywords and a saved version in one click.", "Ctrl+Enter"],
      ["interview/mock", "Mock interview", "Random questions for your role, a countdown, auto-advance and a scorecard.", "g v"],
      ["network", "Send a message", "Outreach, referral and thank-you notes with the blanks marked.", "g n"],
      ["resume", "Polish your resume", "Power-up rewrites, weak-word fixes and " + SC.TEMPLATES.length + " templates.", "g r"]
    ] : [
      ["start", "First resume in 10 minutes", "A guided flow from a blank page to a printable resume. One question at a time.", "g f"],
      ["import", "Import what you have", "Paste an old resume or your LinkedIn profile. It is split into sections for you to review.", "g i"],
      ["resume", "Start from the editor", "Fill in the form with a live preview and a bullet coach.", "g r"],
      ["interview/mock", "Practice an interview", "A timed mock interview with a scorecard at the end.", "g v"]
    ];
    var tools = [
      ["resume", "Resume builder", SC.TEMPLATES.length + " ATS-friendly templates plus a design version for handing over in person."],
      ["match", "Tailor", "Keyword match, a tailored copy per job and saved versions linked to the tracker."],
      ["cover", "Cover letters", "Four short parts, guidance at every step and a checker."],
      ["interview", "Interviews", SC.data.roles.reduce(function (n, r) { return n + r.q.length; }, 0) + " questions, STAR notes, timer and mock mode."],
      ["tracker", "Applications", st.total ? st.total + " tracked, " + st.responseRate + "% response rate." : "Stages, follow-up reminders and contacts."],
      ["sprint", "Sprint", "Weekly goals, streaks and a pipeline view."],
      ["network", "Network", "Message templates and a LinkedIn profile helper."],
      ["salary", "Salary and offers", "Your own salary benchmark, offers side by side, and a counteroffer with scripts."],
      ["contacts", "Contacts", SC.S.contacts.length ? SC.S.contacts.length + " people, " + SC.crmHealth(SC.S.contacts, today).due + " due for a hello." : "A networking list with a follow-up rhythm, plus references."],
      ["portfolio", "Portfolio page", "Your resume and best projects as a one-file website."],
      ["skills", "Skills plan", "Gaps for your target role and a dated learning schedule."],
      ["change", "Career change", "A five-phase roadmap with dated steps and what carries over."],
      ["wins", "Wins log", "Results as they happen, ready for reviews and resume bullets."],
      ["freelance", "Freelance", "A rate that pays the bills, a client pipeline and proposals."],
      ["forecast", "Forecast", "A what-if simulator: how more applications or a better interview rate move your odds of a first offer."],
      ["ask", "Ask", "Ask your search in plain words. Fuzzy search across everything, typos allowed."]
    ];
    root.innerHTML = '<div class="view-head"><p class="eyebrow">' + SC.esc(today) + '</p><h1>' + hello + (first ? ", " + SC.esc(first) : "") + "</h1>" +
      '<p class="lede">' + (has ? "Here is what moves your search forward today." : "Let's get you a resume you can print in the next ten minutes.") + ' Press <kbd>Ctrl K</kbd> to jump anywhere.</p></div>' +
      '<div class="hero-grid"><section class="card today"><div class="card-head"><h2>Today</h2><a class="btn small ghost" href="#/sprint">Sprint</a></div>' +
      (plan.length ? '<ul class="todo">' + plan.slice(0, 6).map(function (p) { return '<li class="k-' + SC.esc(p.kind.split("-")[0]) + '"><a href="' + SC.esc(p.href) + '"><b>' + SC.esc(p.text) + "</b><span>" + SC.esc(p.meta) + "</span></a></li>"; }).join("") + "</ul>"
        : '<p class="muted">Nothing due. Set your weekly goals on the Sprint page, or tailor your resume to a new posting.</p>') + "</section>" +
      '<section class="card week"><h2>This week</h2><div class="rings">' + SC.SPRINT_TYPES.map(function (t) {
        var p = wk.per[t[0]]; return '<div class="ring-cell">' + ring(p.pct, p.done + "/" + p.goal, "sm") + "<small>" + t[1] + "</small></div>"; }).join("") + "</div>" +
      '<p class="fine"><b class="streak">' + streak.days + "-day streak</b> " + (streak.activeToday ? "Logged today." : streak.days ? "Log something today to keep it." : "Log an application, follow-up or message to start one.") + "</p></section></div>" +
      '<h2 class="section-title">Quick start</h2><div class="grid quick">' + quick.map(function (t) { return '<a class="tool-card hot" href="#/' + t[0] + '"><h3>' + t[1] + "</h3><p>" + t[2] + '</p><span class="kbd-hint"><kbd>' + t[3] + "</kbd></span></a>"; }).join("") + "</div>" +
      '<h2 class="section-title">All tools</h2><div class="grid">' + tools.map(function (t) { return '<a class="tool-card" href="#/' + t[0] + '"><h3>' + t[1] + "</h3><p>" + t[2] + "</p></a>"; }).join("") + "</div>" +
      '<p class="fine" style="margin-top:1rem">Your data is saved in this browser only, with a checked backup copy, and never leaves this computer. No tracking. Use Backup to keep a copy, or to move to another computer.</p>';
  };

  SC.applyTheme = function () { document.documentElement.setAttribute("data-theme", SC.S.theme === "light" ? "light" : "dark"); };
  SC.toggleTheme = function () { SC.S.theme = SC.S.theme === "light" ? "dark" : "light"; SC.applyTheme(); SC.save(); };
  SC.start = function () {
    SC.load();
    SC.applyTheme();
    SC.safeBanner();
    if (SC.resumeLiveFile) SC.resumeLiveFile();
    if (SC.recovered) SC.toast("Your latest save was damaged, so the last good copy was restored.");
    SC.$("#theme-btn").addEventListener("click", SC.toggleTheme);
    SC.$("#skip-link").addEventListener("click", function () { SC.$("#main").focus(); });
    window.addEventListener("hashchange", route);
    if (SC.initUI) SC.initUI();
    route();
  };
  SC.route = route;
})();
