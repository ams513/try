/* Resume builder: form, live preview (debounced, measured), template gallery, design mode, bullet coach with power-ups. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;
  var PAGE_W = 816, PAGE_CONTENT = 960, PAGE_TOP = 48, A4_W = 794, A4_CONTENT = 1009.13, A4_TOP = 56.69;
  /* Letter: 8.5in wide, 10in of content per printed page, 0.5in margin. A4 formats: 210 mm wide, 267 mm of content per page, 15 mm margin. */
  function field(label, id, val, ph, type) {
    return '<div><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || "text") + '" value="' + E(val) + '"' + (ph ? ' placeholder="' + E(ph) + '"' : "") + "></div>";
  }
  function actionable(alt) { return alt.split(" ").length <= 2 && !/^(cut|give|name|show|say|finish)\b/.test(alt); }

  /* Shared bullet-coach renderer (also used by the guided flow). open: map of "ji:li" -> true for expanded power-ups. */
  SC.coachHTML = function (bullets, ji, open) {
    var items = [];
    (bullets || []).forEach(function (b, li) { if (String(b || "").trim()) items.push({ li: li, r: SC.coachBullet(b) }); });
    if (!items.length) return '<p class="fine">Write one bullet per line. Each one is checked as you type, with rewrites one click away.</p>';
    var c = SC.coachList(bullets);
    var h = '<p class="fine coach-sum"><b>' + c.avg + '/100 average.</b> ' + c.numberShare + "% include a number." + (c.repeatedVerbs.length ? " Repeated opening verbs: " + E(c.repeatedVerbs.join(", ")) + "." : "") + "</p>";
    items.forEach(function (it) {
      var r = it.r, bad = r.checks.filter(function (k) { return !k.ok; }), key = ji + ":" + it.li, isOpen = open && open[key];
      var weak = SC.weakScan(r.text);
      h += '<div class="b ' + r.grade + '" data-li="' + it.li + '"><div class="b-top"><span class="score">' + r.score + '</span><span class="b-text">' + E(r.text.length > 90 ? r.text.slice(0, 90) + "..." : r.text) + "</span>" +
        '<button type="button" class="btn tiny' + (isOpen ? " on" : "") + '" data-pu="' + it.li + '" aria-expanded="' + !!isOpen + '">Power up</button></div>' +
        (bad.length ? '<ul class="checks">' + bad.map(function (k) { return "<li>" + E(k.msg) + "</li>"; }).join("") + "</ul>" : "") +
        (weak.length ? '<p class="weak-row">' + weak.map(function (w) {
          return '<span class="wk"><s>' + E(w.phrase) + "</s> " + w.alts.map(function (a) { return actionable(a) ? '<button type="button" class="chip swap" data-swap="' + E(w.phrase) + '" data-to="' + E(a) + '" data-li="' + it.li + '">' + E(a) + "</button>" : '<span class="chip ghost">' + E(a) + "</span>"; }).join("") + "</span>";
        }).join("") + "</p>" : "");
      if (isOpen) {
        var sug = SC.powerUp(r.text), qs = r.checks[1].ok ? [] : SC.quantifyPrompts(r.text);
        h += '<div class="pu">' + (sug.length ? '<p class="fine">Rewrites (strong verb + what + measurable result). Fill the [brackets] with your real numbers.</p><ol class="sug">' +
          sug.map(function (s, si) { return '<li><span>' + E(s).replace(/\[([^\]]*)\]/g, '<mark>[$1]</mark>') + '</span><button type="button" class="btn tiny primary" data-use="' + it.li + '" data-s="' + si + '">Use</button></li>'; }).join("") + "</ol>" : "") +
          (qs.length ? '<p class="fine"><b>Quantify it:</b></p><ul class="qz">' + qs.map(function (q) { return "<li>" + E(q) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
      }
      h += "</div>";
    });
    return h;
  };
  /* Replace a phrase, keeping a capital at the start of the bullet. */
  SC.swapPhrase = function (text, phrase, to) {
    var re = new RegExp("(^|[^A-Za-z-])(" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![A-Za-z-])", "i");
    return text.replace(re, function (m, pre, word) { var t = /^[A-Z]/.test(word) ? to.charAt(0).toUpperCase() + to.slice(1) : to; return pre + t; });
  };
  /* Select the first [placeholder] on line li of a textarea so the user can type straight over it. */
  SC.selectHole = function (ta, li) {
    var lines = ta.value.split("\n"), off = 0;
    for (var i = 0; i < li; i++) off += lines[i].length + 1;
    var line = lines[li] || "", a = line.indexOf("["), b = line.indexOf("]", a);
    ta.focus();
    if (a >= 0 && b > a) ta.setSelectionRange(off + a, off + b + 1); else ta.setSelectionRange(off + line.length, off + line.length);
  };

  /* Where the A4 formats break pages: entries that are kept whole (see css/resume.css) move to the next page instead of splitting, headings stay with what follows.
     Returns the content offsets (px, unscaled) at which each new page starts. An estimate: the browser's own print preview is the final word. */
  function fmtBreaks(art, per) {
    var rect = art.getBoundingClientRect(), s = art.offsetWidth ? rect.width / art.offsetWidth : 1, H = art.offsetHeight, out = [], end = per;
    SC.$$(".fx-row:not(.fx-long), .de-row:not(.fx-long), .job:not(.fx-long), .de-sign, .uk-refs, h2", art).forEach(function (el) {
      var r = el.getBoundingClientRect(), top = (r.top - rect.top) / s, bot = (r.bottom - rect.top) / s, nx = el.tagName === "H2" ? el.nextElementSibling : null;
      if (nx) bot += Math.min(nx.getBoundingClientRect().height / s, 60);
      while (top >= end) { out.push(end); end += per; }
      if (bot > end && top < end && bot - top <= per) { out.push(top); end = top + per; }
    });
    while (end < H - 2) { out.push(end); end += per; }
    return out;
  }

  SC.views.resume = function (root) {
    var R = SC.S.resume, D = SC.S.design, open = {}, lastHTML = "", lastMode = "";

    function expHTML(e, i) {
      return '<div class="entry" data-ex="' + i + '"><div class="entry-head"><b>' + E(e.role || "New job") + (e.company ? ' <span class="muted">at ' + E(e.company) + "</span>" : "") + '</b><div class="row">' +
        (i > 0 ? '<button type="button" class="btn tiny ghost" data-act="up-ex" data-i="' + i + '" aria-label="Move this job up">Up</button>' : "") +
        '<button type="button" class="btn tiny danger" data-act="rm-ex" data-i="' + i + '">Remove</button></div></div><div class="cols">' +
        '<div><label for="ex-role-' + i + '">Job title</label><input id="ex-role-' + i + '" data-k="role" value="' + E(e.role) + '"></div>' +
        '<div><label for="ex-co-' + i + '">Employer</label><input id="ex-co-' + i + '" data-k="company" value="' + E(e.company) + '"></div>' +
        '<div><label for="ex-loc-' + i + '">Location</label><input id="ex-loc-' + i + '" data-k="loc" value="' + E(e.loc) + '"></div>' +
        '<div><label for="ex-st-' + i + '">Start</label><input id="ex-st-' + i + '" data-k="start" value="' + E(e.start) + '" placeholder="Mar 2021"></div>' +
        '<div><label for="ex-en-' + i + '">End</label><input id="ex-en-' + i + '" data-k="end" value="' + E(e.end) + '" placeholder="Present"></div></div>' +
        '<label for="ex-bl-' + i + '">Bullet points (one per line)</label><textarea id="ex-bl-' + i + '" data-k="bullets" rows="5">' + E((e.bullets || []).join("\n")) + "</textarea>" +
        '<div class="coach" data-coach="' + i + '">' + SC.coachHTML(e.bullets, i, open) + "</div></div>";
    }
    function eduHTML(e, i) {
      return '<div class="entry" data-ed="' + i + '"><div class="cols">' +
        '<div><label for="ed-d-' + i + '">Degree or program</label><input id="ed-d-' + i + '" data-k="degree" value="' + E(e.degree) + '"></div>' +
        '<div><label for="ed-s-' + i + '">School</label><input id="ed-s-' + i + '" data-k="school" value="' + E(e.school) + '"></div>' +
        '<div><label for="ed-y-' + i + '">Year</label><input id="ed-y-' + i + '" data-k="year" value="' + E(e.year) + '"></div></div>' +
        '<label for="ed-n-' + i + '">Notes (optional)</label><input id="ed-n-' + i + '" data-k="notes" value="' + E(e.notes) + '">' +
        '<div class="row end"><button type="button" class="btn tiny danger" data-act="rm-ed" data-i="' + i + '">Remove</button></div></div>';
    }
    function gallery() {
      var thumbData = SC.hasResume(R) ? R : SC.sampleResume();
      return '<div class="card"><div class="card-head"><h2>Template</h2><span class="fine">' + SC.TEMPLATES.length + ' ATS-friendly designs</span></div><div class="tpl-pick strip" role="group" aria-label="Template">' +
        SC.TEMPLATES.map(function (t) {
          var on = !D.on && !D.fmt && R.template === t.id;
          return '<button type="button" data-tpl="' + t.id + '" class="' + (on ? "on" : "") + '" aria-pressed="' + on + '" title="' + t.note + '"><span class="thumb" aria-hidden="true"><span class="thumb-in">' + SC.renderResume(thumbData, t.id) + "</span></span><b>" + t.name + (t.fresh ? ' <span class="new">New</span>' : "") + "</b><small>" + t.note + "</small></button>";
        }).join("") + "</div>" +
        '<p class="fine">All ' + SC.TEMPLATES.length + " are one column with real text and standard headings, so applicant tracking systems read them correctly. Need something prettier to hand over in person? Switch the preview to <b>Design version</b>.</p></div>";
    }
    function fmtCard() {
      return '<div class="card"><div class="card-head"><h2>Country formats</h2><span class="fine">' + SC.FORMATS.length + ' layouts, A4</span></div><div class="tpl-pick fmt-pick" role="group" aria-label="Country formats">' +
        SC.FORMATS.map(function (f) {
          var on = D.fmt === f.id;
          return '<button type="button" data-fmt="' + f.id + '" class="' + (on ? "on" : "") + '" aria-pressed="' + on + '"><b>' + f.name + "</b><small>" + f.note + "</small></button>";
        }).join("") + "</div>" +
        '<p class="fine fmt-claim" role="note">These are layouts that follow common conventions for each country. They are not a guarantee of what any employer wants; check the job posting and local norms.</p>' +
        '<p class="fine">They use the same resume you typed here, and nothing is left out. Jobs and education are put newest first when every date in the list can be read; if one cannot, they print in the order you list them. They print on A4 by default. They are not affiliated with or endorsed by Europass, the EU or any employer.</p></div>';
    }
    function optsHTML() { return ""; }
    function formHTML() {
      return gallery() + fmtCard() +
        '<div class="card"><h2>Contact</h2><div class="cols">' + field("Full name", "f-name", R.name) + field("Headline or target title", "f-title", R.title, "Operations Coordinator") +
        field("Email", "f-email", R.email, "", "email") + field("Phone", "f-phone", R.phone, "", "tel") + field("City, region", "f-location", R.location) + field("Link (portfolio or LinkedIn)", "f-links", R.links) + "</div></div>" +
        '<div class="card"><h2>Summary</h2><p class="fine">Two or three sentences: who you are, your strongest proof, what you want next.</p><label class="sr-only" for="f-summary">Summary</label><textarea id="f-summary" rows="4">' + E(R.summary) + "</textarea>" +
        '<h2 style="margin-top:1rem">Skills</h2><p class="fine">Comma separated. Use the exact names from the postings you want.</p><label class="sr-only" for="f-skills">Skills</label><textarea id="f-skills" rows="3">' + E(R.skills) + "</textarea></div>" +
        '<div class="card"><h2>Experience</h2><p class="fine">Newest first. Start every bullet with a verb, add a number, keep it under 30 words. Press <b>Power up</b> on any bullet for rewrites.</p><div id="ex-list">' + R.experience.map(expHTML).join("") + '</div><button type="button" class="btn" data-act="add-ex">Add a job</button></div>' +
        '<div class="card"><h2>Education</h2><div id="ed-list">' + R.education.map(eduHTML).join("") + '</div><button type="button" class="btn" data-act="add-ed">Add education</button>' +
        '<h2 style="margin-top:1rem">Certifications</h2><label class="sr-only" for="f-certs">Certifications</label><textarea id="f-certs" rows="3" placeholder="One per line">' + E(R.certs) + "</textarea></div>";
    }
    function toolbar() {
      return '<div class="seg" role="group" aria-label="Preview mode"><button type="button" data-mode="ats" class="' + (D.on || D.fmt ? "" : "on") + '" aria-pressed="' + (!D.on && !D.fmt) + '">ATS version</button><button type="button" data-mode="design" class="' + (D.on ? "on" : "") + '" aria-pressed="' + D.on + '">Design version</button></div>' +
        (D.fmt ? '<div class="design-note" role="note">' + (D.fmt === "uk" ? "The UK-style CV is one column. It aims at two A4 pages and says so below if your text runs longer; nothing is cut." : "This layout uses columns or a table. For online forms that read your file automatically, the one-column ATS version is the safer choice.") + "</div>" : "") +
        (D.on ? '<div class="design-note" role="note"><b>Design mode: for handing over in person</b> (career fairs, interviews, networking). It uses two columns, so <b>do not upload it to job sites or applicant tracking systems</b>. Use the ATS version for online applications.</div>' +
          '<div class="swatches" role="group" aria-label="Accent colour">' + SC.ACCENTS.map(function (a) { return '<button type="button" data-accent="' + a[0] + '" style="--sw:' + a[1] + '" class="' + (D.accent === a[0] ? "on" : "") + '" aria-label="' + a[0] + '" aria-pressed="' + (D.accent === a[0]) + '"></button>'; }).join("") + "</div>" : "");
    }

    root.innerHTML = '<div class="view-head row between"><div><p class="eyebrow">Resume builder</p><h1>Build your resume</h1><p class="lede">Type on the left, the page on the right updates as you go. Print it to a PDF when you are happy.</p></div>' +
      '<div class="row"><a class="btn small ghost" href="#/import">Import</a><a class="btn small ghost" href="#/start">Guided flow</a><a class="btn small" href="#/match">Tailor to a job</a></div></div>' +
      '<div class="two wide-right"><div id="form">' + formHTML() + '</div><div><div class="card preview-card">' +
      '<div class="row"><button type="button" class="btn primary" data-act="print" id="print-btn">' + (D.on ? "Print design version" : D.fmt ? "Print this format (A4)" : "Print or save as PDF") + '</button><button type="button" class="btn" data-act="docx">Word (.docx)</button><button type="button" class="btn" data-act="txt">Plain text (.txt)</button><button type="button" class="btn" data-act="copy">Copy as text</button>' +
      '<button type="button" class="btn small ghost" data-act="sample">Load sample</button><button type="button" class="btn small danger" data-act="clear" id="clear-btn">Clear all</button></div>' +
      '<div id="tbar">' + toolbar() + '</div><div id="fopts">' + optsHTML() + '</div><p class="fine stats" id="pstats"></p><p class="fine fmt-pages" id="fpages" role="status"></p>' +
      '<div class="paper-wrap" id="pwrap"><div class="paper-scale" id="pscale"><div class="paper" id="paper"></div></div></div>' +
      '<p class="fine" id="xnote">Word and text exports follow the layout shown above, in its own section order, as plain headings, paragraphs, bullet lists and tab stops (no tables or text boxes, which are the simplest structure for programs that read resumes). The page is A4 for the country formats and US Letter otherwise. The photo frame is not exported. Word export: checked against the file format and read back by an independent reader (python-docx); it has not been opened in Microsoft Word by us. If your word processor reports a problem with a file, use the plain-text export and tell us.</p>' +
      '<p class="fine">In the print dialog choose "Save as PDF", set margins to Default and turn off Headers and footers.</p><div id="ats"></div></div></div></div>';

    var paper = $("#paper"), scaleBox = $("#pscale"), wrap = $("#pwrap");
    function fit() { var pw = D.fmt ? A4_W : PAGE_W, w = wrap.clientWidth || pw, s = Math.min(1, w / pw); scaleBox.style.transform = "scale(" + s + ")"; wrap.style.height = Math.ceil(paper.offsetHeight * s) + "px"; }
    function preview() {
      var t0 = performance.now(), mode = D.fmt ? "fmt:" + D.fmt : D.on ? "design:" + D.accent : "ats";
      var html = D.fmt ? SC.renderFormat(R, D.fmt, D.opt) : D.on ? SC.renderDesign(R, D.accent) : SC.renderResume(R, R.template);
      if (html !== lastHTML || mode !== lastMode) {
        paper.innerHTML = html; lastHTML = html; lastMode = mode; paper.classList.toggle("design-paper", D.on && !D.fmt); paper.classList.toggle("a4", !!D.fmt);
        var content = paper.firstChild ? paper.firstChild.offsetHeight : 0, per = D.fmt ? A4_CONTENT : D.on ? 1056 : PAGE_CONTENT, top0 = D.fmt ? A4_TOP : D.on ? 0 : PAGE_TOP;
        var brk = D.fmt && paper.firstChild ? fmtBreaks(paper.firstChild, per) : null, pages = brk ? brk.length + 1 : Math.max(1, Math.ceil((content - 2) / per)), marks = "";
        for (var p = 1; p < pages; p++) marks += '<div class="pbreak" style="top:' + (top0 + (brk ? brk[p - 1] - 10 : p * per)) + 'px"><span>Page ' + (p + 1) + "</span></div>";
        if (marks) paper.insertAdjacentHTML("beforeend", marks);
        fit();
        var a = SC.atsCheck(R);
        SC.perf.preview = Math.round((performance.now() - t0) * 10) / 10; SC.perf.pages = pages;
        $("#pstats").innerHTML = "<b>" + pages + " page" + (pages > 1 ? "s" : "") + "</b> &middot; " + a.words + " words &middot; ATS basics " + a.passed + "/" + a.total + ' &middot; <span title="Time to rebuild the preview">' + SC.perf.preview + " ms</span>";
        $("#fpages").innerHTML = D.fmt ? (D.fmt === "uk" && pages > 2 ? "<b>This CV runs to about " + pages + " pages on A4.</b> Two pages is the usual length for a UK CV. Nothing has been cut: shorten the text yourself if you want two pages." : "About " + pages + " A4 page" + (pages > 1 ? "s" : "") + " (an estimate from the preview; check the print preview).") : "";
        $("#ats").innerHTML = D.on || D.fmt ? "" : '<details class="ats"' + (a.passed < a.total ? " open" : "") + "><summary><b>ATS check: " + a.passed + " of " + a.total + "</b></summary><ul class=\"checks\">" +
          a.items.map(function (i) { return '<li class="' + (i.ok ? "ok" : "") + '">' + E(i.msg) + "</li>"; }).join("") + "</ul></details>" +
          '<details class="ats xray" id="xray"' + (xrayOpen ? " open" : "") + '><summary><b>ATS X-ray</b> <span class="fine">read your resume back like a simple parser</span></summary><div id="xray-out">' + (xrayOpen ? xrayHTML(R) : "") + "</div></details>";
        var xd = $("#xray"); if (xd) xd.addEventListener("toggle", function () { xrayOpen = xd.open; if (xd.open) $("#xray-out").innerHTML = xrayHTML(R); });
      }
    }
    SC.resumePreview = preview;
    // ATS X-ray: export as plain text, read it back with the app's own import parser, and show field by field what survived.
    var xrayOpen = false;
    function xrayHTML(R) {
      var x = SC.atsXray(R);
      if (!x.total) return '<p class="fine">Add your name, contact details and a job first.</p>';
      return '<p class="xray-score"><b>' + x.pct + "%</b> of " + x.total + " checks read back the same.</p>" +
        '<table class="xray-tbl"><thead><tr><th scope="col">Field</th><th scope="col">You wrote</th><th scope="col">Read back as</th><th scope="col">Same</th></tr></thead><tbody>' +
        x.rows.map(function (r) { return '<tr class="' + (r.ok ? "ok" : "miss") + '"><td>' + E(r.label) + "</td><td>" + E(r.yours.length > 60 ? r.yours.slice(0, 57) + "..." : r.yours) + "</td><td>" + E(r.read ? (r.read.length > 60 ? r.read.slice(0, 57) + "..." : r.read) : "(nothing)") + "</td><td>" + (r.ok ? "Yes" : "<b>No</b>") + "</td></tr>"; }).join("") +
        '</tbody></table><p class="fine">This uses the app&rsquo;s own rule-based import on the plain-text export. Real applicant tracking systems differ, so treat a mismatch as a hint to simplify that line (plain dates such as "Mar 2021 - Present", one job title per line), not as a verdict.</p>';
    }
    var previewSoon = SC.debounce(preview, 60), saveSoon = SC.debounce(SC.save, 300);
    function changed() { previewSoon(); saveSoon(); }
    function rebuild() { $("#form").innerHTML = formHTML(); lastHTML = ""; preview(); SC.save(); }
    function retool() {
      $("#tbar").innerHTML = toolbar(); $("#fopts").innerHTML = optsHTML(); $("#print-btn").textContent = D.on ? "Print design version" : D.fmt ? "Print this format (A4)" : "Print or save as PDF";
      SC.$$("[data-tpl]").forEach(function (b) { var on = !D.on && !D.fmt && b.getAttribute("data-tpl") === R.template; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      SC.$$("[data-fmt]").forEach(function (b) { var on = b.getAttribute("data-fmt") === D.fmt; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    }
    $("#fopts").addEventListener("input", function (ev) {
      var t = ev.target; if (!t || !t.id) return;
      if (t.id === "o-photo") D.opt.photo = t.checked; else if (t.id === "o-refs") D.opt.refs = t.checked; else if (t.id === "o-place") D.opt.place = t.value.slice(0, 120); else if (t.id === "o-date") D.opt.date = t.value.slice(0, 40); else return;
      changed();
    });
    preview();
    var lastW = wrap.clientWidth, raf = 0;
    var ro = window.ResizeObserver ? new ResizeObserver(function () { var w = wrap.clientWidth; if (w !== lastW) { lastW = w; cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); } }) : null;
    if (ro) ro.observe(wrap); else window.addEventListener("resize", fit);
    SC.cleanups.push(function () { if (ro) ro.disconnect(); else window.removeEventListener("resize", fit); SC.resumePreview = null; });
    SC.onPrint = function () { SC.printResume(R, D.on, D.fmt); };

    function coach(ji) { var box = $('[data-coach="' + ji + '"]'); if (box) box.innerHTML = SC.coachHTML(R.experience[ji].bullets, ji, open); }
    var coachSoon = {};
    var form = $("#form");
    form.addEventListener("input", function (ev) {
      var t = ev.target, id = t.id, ex = t.closest("[data-ex]"), ed = t.closest("[data-ed]");
      if (ex) {
        var ji = +ex.getAttribute("data-ex"), e = R.experience[ji], k = t.getAttribute("data-k");
        if (k === "bullets") { e.bullets = t.value.split(/\r?\n/); (coachSoon[ji] || (coachSoon[ji] = SC.debounce(function () { coach(ji); }, 120)))(); }
        else e[k] = t.value;
      } else if (ed) { R.education[+ed.getAttribute("data-ed")][t.getAttribute("data-k")] = t.value; }
      else if (id && id.indexOf("f-") === 0) { R[id.slice(2)] = t.value; }
      else return;
      changed();
    });
    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      var tpl = b.getAttribute("data-tpl"), act = b.getAttribute("data-act"), i = +b.getAttribute("data-i"), mode = b.getAttribute("data-mode"), acc = b.getAttribute("data-accent");
      var exEl = b.closest("[data-ex]"), ji = exEl ? +exEl.getAttribute("data-ex") : -1;
      var fm = b.getAttribute("data-fmt");
      if (fm) { D.fmt = fm; D.on = false; retool(); preview(); SC.save(); return; }
      if (tpl) { R.template = tpl; D.on = false; D.fmt = ""; retool(); preview(); SC.save(); return; }
      if (mode) { D.on = mode === "design"; D.fmt = ""; retool(); preview(); SC.save(); return; }
      if (acc) { D.accent = acc; retool(); preview(); SC.save(); return; }
      if (b.hasAttribute("data-pu")) { var key = ji + ":" + b.getAttribute("data-pu"); open[key] = !open[key]; coach(ji); return; }
      if (b.hasAttribute("data-use")) {
        var li = +b.getAttribute("data-use"), sug = SC.powerUp(SC.coachBullet(R.experience[ji].bullets[li]).text)[+b.getAttribute("data-s")];
        if (!sug) return;
        R.experience[ji].bullets[li] = sug; open[ji + ":" + li] = false;
        var ta = $("#ex-bl-" + ji); ta.value = R.experience[ji].bullets.join("\n"); coach(ji); changed(); SC.selectHole(ta, li);
        SC.toast("Rewrite in place. Type your real number over the highlighted [bracket].");
        return;
      }
      if (b.hasAttribute("data-swap")) {
        var l2 = +b.getAttribute("data-li"); R.experience[ji].bullets[l2] = SC.swapPhrase(R.experience[ji].bullets[l2], b.getAttribute("data-swap"), b.getAttribute("data-to"));
        $("#ex-bl-" + ji).value = R.experience[ji].bullets.join("\n"); coach(ji); changed(); return;
      }
      if (act === "add-ex") { R.experience.push({ role: "", company: "", loc: "", start: "", end: "", bullets: [] }); rebuild(); var n = $("#ex-role-" + (R.experience.length - 1)); if (n) n.focus(); }
      else if (act === "add-ed") { R.education.push({ school: "", degree: "", year: "", notes: "" }); rebuild(); }
      else if (act === "rm-ex") { R.experience.splice(i, 1); rebuild(); }
      else if (act === "up-ex") { var x = R.experience.splice(i, 1)[0]; R.experience.splice(i - 1, 0, x); rebuild(); }
      else if (act === "rm-ed") { R.education.splice(i, 1); rebuild(); }
      else if (act === "print") { SC.printResume(R, D.on, D.fmt); }
      else if (act === "docx" || act === "txt" || act === "copy") { SC.exportResume(R, D, act); }
      else if (act === "sample") { if (SC.hasResume(R)) SC.saveVersion(R, { name: "Before loading the sample" }); SC.S.resume = R = SC.sampleResume(); rebuild(); SC.toast("Sample loaded."); }
      else if (act === "clear") {
        if (b.getAttribute("data-sure") !== "1") { b.setAttribute("data-sure", "1"); b.textContent = "Click again to erase"; return; }
        if (SC.hasResume(R)) SC.saveVersion(R, { name: "Before clearing" });
        var tp = R.template; SC.S.resume = R = SC.blankResume(); R.template = tp; b.removeAttribute("data-sure"); b.textContent = "Clear all"; rebuild();
        SC.toast("Cleared. A copy is kept under Versions in Tailor.");
      }
    });
  };
})();
