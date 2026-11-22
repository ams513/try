/* Portfolio page generator: one self-contained HTML file (no scripts, no external files) built from your resume and projects. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$, K = SC.kit;

  SC.views.portfolio = function (root) {
    var P = SC.S.portfolio, R = SC.S.resume, saveSoon = SC.debounce(SC.save, 300);
    function draw() {
      root.innerHTML = K.head("Build", "Portfolio page",
        "Turn your resume and your best projects into a one-page website. You get a single HTML file with no scripts and no outside files: open it, attach it, or upload it to any static web host or personal site. Nothing is published for you.") +
        '<div class="two wide-right"><div><section class="card"><h2>Page</h2>' +
        K.field("pf-headline", "Headline (one line under your name)", P.headline, { k: "headline", ph: "I make warehouses run without surprises." }) +
        K.field("pf-about", "About (leave empty to use your resume summary)", P.about, { k: "about", area: true, rows: 4 }) +
        "<label>Accent</label><div class=\"swatches\" role=\"group\" aria-label=\"Accent colour\">" + SC.ACCENTS.map(function (a) {
          return '<button type="button" data-accent="' + a[0] + '" class="' + (P.accent === a[0] ? "on" : "") + '" aria-pressed="' + (P.accent === a[0]) + '" aria-label="' + a[0] + '" style="--sw:' + a[1] + '"></button>'; }).join("") + "</div>" +
        '<div class="checkrow">' + K.check("pf-dark", "Dark page", P.dark, "dark") + K.check("pf-em", "Show email", P.showEmail, "showEmail") + K.check("pf-ph", "Show phone", P.showPhone, "showPhone") +
        K.check("pf-ex", "Experience", P.showExp, "showExp") + K.check("pf-sk", "Skills", P.showSkills, "showSkills") + K.check("pf-ed", "Education", P.showEdu, "showEdu") + "</div>" +
        (SC.hasResume() ? "" : '<div class="hint warn">Your resume is empty, so the page has only your projects. <a href="#/resume">Fill in your resume</a> first for a complete page.</div>') + "</section>" +
        '<section class="card"><div class="card-head"><h2>Projects (' + P.projects.length + ')</h2><button type="button" class="btn small" id="pf-add">Add a project</button></div>' +
        P.projects.map(function (p, i) {
          return '<div class="proj" data-id="' + p.id + '"><div class="card-head"><h3>Project ' + (i + 1) + '</h3><div class="row"><button type="button" class="btn tiny" data-up aria-label="Move up"' + (i ? "" : " disabled") + '>Up</button><button type="button" class="btn tiny" data-rm>Remove</button></div></div><div class="cols">' +
            K.field("pj-title-" + p.id, "Title", p.title, { k: "title" }) + K.field("pj-role-" + p.id, "Your role", p.role, { k: "role" }) + K.field("pj-link-" + p.id, "Link (optional)", p.link, { k: "link", ph: "yoursite.com/project" }) +
            K.field("pj-tags-" + p.id, "Tags (comma separated)", p.tags, { k: "tags" }) + "</div>" +
            K.field("pj-summary-" + p.id, "What it was", p.summary, { k: "summary", area: true, rows: 2 }) + K.field("pj-result-" + p.id, "Result", p.result, { k: "result", ph: "Cut picking errors by 31% in four months" }) + "</div>";
        }).join("") + (P.projects.length ? "" : '<p class="muted">Add two to four projects: work, school, volunteer or personal. A result with a number makes each one land.</p>') + "</section></div>" +
        '<div><section class="card"><div class="card-head"><h2>Preview</h2><div class="row"><button type="button" class="btn primary" id="pf-dl" data-primary>Download page (.html)</button><button type="button" class="btn small" id="pf-print">Print</button></div></div>' +
        '<div class="pf-frame"><div class="pf" id="pf-prev"></div></div><p class="fine">Links work only if they start with a web address or domain; anything else is shown as plain text. The file blocks scripts, so it is safe to share.</p></section></div></div>';
      prev();
    }
    function prev() { var el = $("#pf-prev"); el.innerHTML = "<style>" + SC.portfolioCSS(P.accent, !!P.dark) + "</style>" + SC.portfolioBody(R, P); }
    draw();
    root.addEventListener("input", function (ev) {
      var el = ev.target, k = el.getAttribute("data-k"); if (!k) return;
      var row = el.closest("[data-id]");
      if (row) { var p = K.byId(P.projects, row.getAttribute("data-id")); if (p) p[k] = el.value; }
      else P[k] = el.type === "checkbox" ? el.checked : el.value;
      saveSoon(); prev();
    });
    root.addEventListener("click", function (ev) {
      var t = ev.target, row = t.closest("[data-id]");
      if (t.hasAttribute("data-accent")) { P.accent = t.getAttribute("data-accent"); SC.save(); SC.$$("[data-accent]").forEach(function (b) { var on = b === t; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); prev(); }
      else if (t.id === "pf-add") { P.projects.push(SC.blankProject()); SC.save(); draw(); var f = root.querySelector(".proj:last-of-type input"); if (f) f.focus(); }
      else if (t.id === "pf-dl") { SC.download(((R.name || "portfolio").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "portfolio") + "_portfolio.html", SC.portfolioHTML(R, P), "text/html"); SC.toast("Portfolio page saved as one HTML file."); }
      else if (t.id === "pf-print") SC.printHTML("<style>" + SC.portfolioCSS(P.accent, false) + '</style><div class="pf">' + SC.portfolioBody(R, Object.assign({}, P, { dark: false })) + "</div>");
      else if (row && t.hasAttribute("data-rm")) { if (!K.sure(t, "Click again")) return; P.projects = P.projects.filter(function (p) { return p.id !== row.getAttribute("data-id"); }); SC.save(); draw(); }
      else if (row && t.hasAttribute("data-up")) {
        var i = P.projects.findIndex(function (p) { return p.id === row.getAttribute("data-id"); });
        if (i > 0) { var x = P.projects[i]; P.projects[i] = P.projects[i - 1]; P.projects[i - 1] = x; SC.save(); draw(); }
      }
    });
  };
})();
