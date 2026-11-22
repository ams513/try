/* Command palette (Ctrl+K), keyboard shortcuts and the shortcuts sheet. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;

  function commands() {
    var c = SC.nav.map(function (n) { return { label: "Go to " + n[1], hint: "g " + n[3], run: function () { SC.go("#/" + n[0]); } }; });
    c.push(
      { label: "Print or save resume as PDF", hint: "Ctrl P", run: function () { SC.printResume(SC.S.resume, false); } },
      { label: "Print design version (not for ATS uploads)", run: function () { SC.printResume(SC.S.resume, true); } },
      { label: "Download resume as Word (.docx)", run: function () { SC.exportResume(SC.S.resume, SC.S.design, "docx"); } },
      { label: "Copy resume as plain text", run: function () { SC.exportResume(SC.S.resume, SC.S.design, "copy"); } },
      { label: "Download cover letter as Word (.docx)", run: function () { SC.exportLetter(SC.S.letter, "docx"); } },
      { label: "Print cover letter", run: function () { SC.printHTML('<div class="paper"><pre class="letter">' + E(SC.letterText(SC.S.letter)) + "</pre></div>"); } },
      { label: "Start a mock interview", run: function () { SC.go("#/interview/mock"); } },
      { label: "Import a resume or LinkedIn profile", run: function () { SC.go("#/import"); } },
      { label: "Tailor resume to a job posting", run: function () { SC.go("#/match"); } },
      { label: "Add an application", run: function () { SC.go("#/tracker"); setTimeout(function () { var f = $("#a-co"); if (f) f.focus(); }, 30); } },
      { label: "Log an application (+1 this week)", run: function () { SC.log("apps"); SC.toast("Logged an application."); if (SC.current === "sprint" || SC.current === "home") SC.route(); } },
      { label: "Log a follow-up (+1 this week)", run: function () { SC.log("follow"); SC.toast("Logged a follow-up."); if (SC.current === "sprint" || SC.current === "home") SC.route(); } },
      { label: "Log a networking message (+1 this week)", run: function () { SC.log("net"); SC.toast("Logged a networking message."); if (SC.current === "sprint" || SC.current === "home") SC.route(); } },
      { label: "Load the sample resume", run: function () {
        if (SC.hasResume()) SC.saveVersion(SC.S.resume, { name: "Before loading the sample" });
        SC.S.resume = SC.sampleResume(); SC.save(); SC.go("#/resume"); SC.toast("Sample loaded. Your previous resume is saved under Versions in Tailor."); } },
      { label: "Search forecast: what-if simulator", run: function () { SC.go("#/forecast"); } },
      { label: "Pipeline river of your applications", run: function () { SC.go("#/forecast"); } },
      { label: "Ask your search in plain words", hint: "g q", run: function () { SC.go("#/ask"); } },
      { label: "Compare job offers", run: function () { SC.go("#/salary/offers"); } },
      { label: "Salary benchmark from your own data", run: function () { SC.go("#/salary/bench"); } },
      { label: "Add a contact or log a touch", run: function () { SC.go("#/contacts"); } },
      { label: "References and reference sheet", run: function () { SC.go("#/contacts/refs"); } },
      { label: "Freelance rate calculator", run: function () { SC.go("#/freelance"); } },
      { label: "Freelance clients", run: function () { SC.go("#/freelance/clients"); } },
      { label: "Write a freelance proposal", run: function () { SC.go("#/freelance/proposal"); } },
      { label: "Download portfolio page (.html)", run: function () { SC.download("portfolio.html", SC.portfolioHTML(SC.S.resume, SC.S.portfolio), "text/html"); } },
      { label: "Download calendar of dates (.ics)", run: SC.kit.calendar },
      { label: "Switch dark or light theme", run: SC.toggleTheme },
      { label: "Download a backup file", run: function () { SC.download("stark_career_backup_" + SC.today() + ".json", SC.wrapBackup(SC.S), "application/json"); } },
      { label: "Send feedback (opens your email app)", run: function () { if (SC.showFeedback) SC.showFeedback(); } },
      { label: "Show keyboard shortcuts", hint: "?", run: showKeys }
    );
    SC.TEMPLATES.forEach(function (t) { c.push({ label: "Template: " + t.name, hint: t.note, run: function () { SC.S.resume.template = t.id; SC.S.design.on = false; SC.S.design.fmt = ""; SC.save(); SC.go("#/resume"); } }); });
    (SC.FORMATS || []).forEach(function (f) { c.push({ label: "Country format: " + f.name, hint: f.note, run: function () { SC.S.design.fmt = f.id; SC.S.design.on = false; SC.save(); SC.go("#/resume"); } }); });
    SC.data.netTemplates.forEach(function (t) { c.push({ label: "Message: " + t.name, hint: t.use, run: function () { SC.S.net.tpl = t.id; SC.save(); SC.go("#/network"); } }); });
    SC.data.roles.forEach(function (r) { c.push({ label: "Mock interview: " + r.name, run: function () { SC.mockRole = r.id; SC.go("#/interview/mock"); } }); });
    return c;
  }

  /* Fuzzy subsequence score: higher is better, -1 for no match. Word starts and contiguous runs score more. */
  SC.fuzzy = function (q, text) {
    q = q.toLowerCase().replace(/\s+/g, ""); var t = text.toLowerCase(), s = 0, j = 0, run = 0;
    if (!q) return 0;
    for (var i = 0; i < t.length && j < q.length; i++) {
      if (t[i] === q[j]) { j++; run++; s += 1 + run + (i === 0 || /[\s:(\-]/.test(t[i - 1]) ? 4 : 0); } else run = 0;
    }
    return j === q.length ? s - t.length * 0.01 : -1;
  };

  var open = null;
  function close() { var o = $("#overlay"); o.hidden = true; o.innerHTML = ""; if (open && open.back) try { open.back.focus(); } catch (e) { } open = null; }
  SC.closeOverlay = close;
  SC.openDialog = function (kind) { if (open) close(); open = { kind: kind, back: document.activeElement }; };

  function palette() {
    if (open) close();
    var o = $("#overlay"), all = commands(), list = all, sel = 0;
    open = { kind: "palette", back: document.activeElement };
    o.innerHTML = '<div class="dialog palette" role="dialog" aria-modal="true" aria-label="Command palette"><input id="pal-q" type="text" autocomplete="off" spellcheck="false" placeholder="Type a command or a page..." aria-controls="pal-list" aria-activedescendant="pal-0">' +
      '<ul id="pal-list" role="listbox"></ul><p class="pal-foot"><kbd>Up</kbd><kbd>Down</kbd> move <kbd>Enter</kbd> run <kbd>Esc</kbd> close</p></div>';
    o.hidden = false;
    var q = $("#pal-q"), ul = $("#pal-list");
    function draw() {
      ul.innerHTML = list.slice(0, 40).map(function (c, i) {
        return '<li role="option" id="pal-' + i + '" data-i="' + i + '" aria-selected="' + (i === sel) + '"' + (i === sel ? ' class="on"' : "") + "><span>" + E(c.label) + "</span>" + (c.hint ? "<small>" + E(c.hint) + "</small>" : "") + "</li>";
      }).join("") || '<li class="empty">No match. Try "resume", "mock" or "print".</li>';
      q.setAttribute("aria-activedescendant", "pal-" + sel);
      var on = ul.querySelector(".on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
    }
    function filter() {
      var v = q.value.trim();
      list = !v ? all : all.map(function (c) { return { c: c, s: Math.max(SC.fuzzy(v, c.label), SC.fuzzy(v, c.hint || "") - 6) }; })
        .filter(function (x) { return x.s >= 0; }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.c; });
      sel = 0; draw();
    }
    function run(i) { var c = list[i]; if (!c) return; close(); c.run(); }
    q.addEventListener("input", filter);
    q.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { sel = Math.min(sel + 1, Math.min(list.length, 40) - 1); draw(); ev.preventDefault(); }
      else if (ev.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); ev.preventDefault(); }
      else if (ev.key === "Enter") { run(sel); ev.preventDefault(); }
    });
    ul.addEventListener("click", function (ev) { var li = ev.target.closest("[data-i]"); if (li) run(+li.getAttribute("data-i")); });
    ul.addEventListener("mousemove", function (ev) { var li = ev.target.closest("[data-i]"); if (li && +li.getAttribute("data-i") !== sel) { sel = +li.getAttribute("data-i"); draw(); } });
    draw(); q.focus();
  }
  SC.palette = palette;

  var KEYS = [
    ["Ctrl K  or  /", "Command palette: jump anywhere or run any action"],
    ["?", "This sheet"],
    ["g then a letter", SC.nav.map(function (n) { return n[3] + " " + n[1]; }).join(", ")],
    ["Ctrl Enter", "Main action on the page (tailor, read import, next step, start)"],
    ["Ctrl P", "Print the document on this page (resume, letter or tailored copy)"],
    ["Ctrl S", "Save now (everything also saves as you type)"],
    ["Esc", "Close a dialog"],
    ["In mock interviews", "Space to finish an answer early, N to skip the thinking time"]
  ];
  function showKeys() {
    if (open) close();
    open = { kind: "keys", back: document.activeElement };
    var o = $("#overlay");
    o.innerHTML = '<div class="dialog keys" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabindex="-1"><div class="card-head"><h2>Keyboard shortcuts</h2><button type="button" class="btn small ghost" data-close>Close</button></div><dl>' +
      KEYS.map(function (k) { return "<dt><kbd>" + E(k[0]) + "</kbd></dt><dd>" + E(k[1]) + "</dd>"; }).join("") + "</dl></div>";
    o.hidden = false; o.querySelector(".dialog").focus();
  }
  SC.showKeys = showKeys;

  function typing(el) { return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable); }
  var gWait = 0;
  SC.initUI = function () {
    $("#pal-btn").addEventListener("click", palette);
    $("#keys-btn").addEventListener("click", showKeys);
    $("#overlay").addEventListener("mousedown", function (ev) { if (ev.target.id === "overlay" || ev.target.hasAttribute("data-close")) close(); });
    document.addEventListener("keydown", function (ev) {
      var k = ev.key, mod = ev.ctrlKey || ev.metaKey;
      if (k === "Escape" && open) { close(); ev.preventDefault(); return; }
      if (mod && (k === "k" || k === "K")) { ev.preventDefault(); if (open && open.kind === "palette") close(); else palette(); return; }
      if (mod && (k === "p" || k === "P")) { ev.preventDefault(); if (SC.onPrint) SC.onPrint(); else SC.printResume(SC.S.resume, false); return; }
      if (mod && (k === "s" || k === "S")) { ev.preventDefault(); SC.save(); SC.toast("Saved on this computer."); return; }
      if (mod && k === "Enter") { var b = $("#main [data-primary]"); if (b && !b.disabled) { ev.preventDefault(); b.click(); } return; }
      if (open || mod || ev.altKey || typing(ev.target)) return;
      if (k === "/") { ev.preventDefault(); palette(); return; }
      if (k === "?") { ev.preventDefault(); showKeys(); return; }
      if (gWait && Date.now() - gWait < 1500) {
        gWait = 0; var n = SC.nav.filter(function (x) { return x[3] === k.toLowerCase(); })[0];
        if (n) { ev.preventDefault(); SC.go("#/" + n[0]); }
        return;
      }
      if (k === "g") { gWait = Date.now(); return; }
      if (SC.onKey) SC.onKey(ev);
    });
  };
})();
