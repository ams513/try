/* Stark Career 2.2 views: Forecast (what-if simulator and pipeline river), Ask (plain-words search), and the sealed backup card. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$, K = SC.kit, X = SC.edge;
  var NS = "http" + "://www.w3.org/2000/svg"; /* SVG namespace name, not a network address */

  function pct(p) { return Math.round(p * 100) + "%"; }
  function weeksText(w) { return w === null ? "not within the window" : w === 0 ? "already" : "about week " + w; }

  /* ---------- forecast chart (SVG built with DOM calls, no string injection of data) ---------- */
  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name), k;
    for (k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function drawCurve(svg, base, scen) {
    var W = 720, H = 300, L = 44, R = 14, T = 14, B = 34, w = base.weeks, i;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    function x(k) { return L + k * (W - L - R) / w; }
    function y(p) { return T + (1 - p) * (H - T - B); }
    [0, 0.25, 0.5, 0.75, 1].forEach(function (p) {
      svg.appendChild(el("line", { x1: L, x2: W - R, y1: y(p), y2: y(p), "class": "fc-grid" }));
      svg.appendChild(el("text", { x: L - 8, y: y(p) + 4, "text-anchor": "end", "class": "fc-axis" }, pct(p)));
    });
    for (i = 0; i <= w; i += (w > 26 ? 8 : 4)) svg.appendChild(el("text", { x: x(i), y: H - 12, "text-anchor": "middle", "class": "fc-axis" }, i === 0 ? "now" : "wk " + i));
    function path(c) { return c.map(function (p, k) { return (k ? "L" : "M") + x(k).toFixed(1) + " " + y(p).toFixed(1); }).join(""); }
    var area = path(scen.curve) + "L" + x(w).toFixed(1) + " " + y(0).toFixed(1) + "L" + x(0).toFixed(1) + " " + y(0).toFixed(1) + "Z";
    svg.appendChild(el("path", { d: area, "class": "fc-area" }));
    svg.appendChild(el("path", { d: path(base.curve), "class": "fc-base" }));
    var line = el("path", { d: path(scen.curve), "class": "fc-line" });
    svg.appendChild(line);
    var m = scen.week50;
    if (m !== null) {
      svg.appendChild(el("line", { x1: x(m), x2: x(m), y1: y(0.5), y2: y(0), "class": "fc-mark" }));
      svg.appendChild(el("circle", { cx: x(m), cy: y(0.5), r: 5, "class": "fc-dot" }));
    }
    svg.appendChild(el("circle", { cx: x(w), cy: y(scen.curve[w]), r: 5, "class": "fc-dot" }));
  }

  SC.views.forecast = function (root) {
    var today = SC.today(), rates = X.rates(SC.S.apps, today), haveOffer = SC.S.apps.some(function (a) { return a.stage === "offer"; });
    var perWeek = Math.max(1, Math.round(rates.perWeek || 5)), mult = 1, weeks = 26, raf = 0;
    var flows = X.river(SC.S.apps, 900, 340);
    root.innerHTML = K.head("Apply", "Search forecast",
      "A what-if simulator built from your own tracker. It runs 1,500 simulated searches from your real interview and offer rates, then shows how the odds of a first offer move when you send more applications or improve your response rate. It is arithmetic on your numbers, not a prediction.") +
      '<div class="two wide-right"><section class="card fc-card"><div class="fc-hero" aria-live="polite"><div><b id="fc-big" class="fc-big">-</b><span id="fc-sub" class="fc-sub"></span></div>' +
      '<div class="fc-facts" id="fc-facts"></div></div>' +
      '<svg id="fc-svg" class="fc-svg" role="img" aria-labelledby="fc-title" preserveAspectRatio="xMidYMid meet"></svg><p id="fc-title" class="fine"></p>' +
      '<details class="fc-table"><summary>Show the numbers as a table</summary><table><thead><tr><th scope="col">Week</th><th scope="col">Your numbers now</th><th scope="col">What-if</th></tr></thead><tbody id="fc-rows"></tbody></table></details></section>' +
      '<section class="card"><h2>What if...</h2>' +
      '<label for="fc-pw">Applications per week: <output id="fc-pw-o">' + perWeek + '</output></label><input id="fc-pw" type="range" min="0" max="40" step="1" value="' + perWeek + '">' +
      '<label for="fc-mult">Interview rate vs. today: <output id="fc-mult-o">100%</output></label><input id="fc-mult" type="range" min="50" max="300" step="5" value="100">' +
      '<p class="fine">Move the second slider to see what tailoring each resume, getting referrals or fixing weak bullets would be worth if it lifted your interview rate by that much. Nothing here changes your data.</p>' +
      '<div class="row"><button type="button" class="btn small" id="fc-reset">Reset to my numbers</button></div>' +
      '<h3 style="margin-top:1rem">Your rates</h3><div class="fc-rates" id="fc-rates"></div></section></div>' +
      '<section class="card"><div class="card-head"><h2>Pipeline river</h2><span class="fine">Every application, stage by stage. Ribbon width is the number of applications.</span></div>' +
      (flows.empty ? '<p class="muted">Add applications on the <a href="#/tracker">Applications</a> page and move them through stages. Their journey is drawn here.</p>' :
        '<svg id="rv-svg" class="rv-svg" viewBox="0 0 900 340" role="img" aria-labelledby="rv-desc" preserveAspectRatio="xMidYMid meet"></svg><p class="fine" id="rv-desc"></p><ul class="rv-list" id="rv-list"></ul>') +
      "</section>";
    var base = X.forecast(rates, { perWeek: perWeek, weeks: weeks, haveOffer: haveOffer, mult: 1 });
    function run() {
      raf = 0;
      var scen = X.forecast(rates, { perWeek: perWeek, weeks: weeks, haveOffer: haveOffer, mult: mult });
      base = X.forecast(rates, { perWeek: Math.max(1, Math.round(rates.perWeek || 5)), weeks: weeks, haveOffer: haveOffer, mult: 1 });
      drawCurve($("#fc-svg"), base, scen);
      $("#fc-big").textContent = pct(scen.curve[12]);
      $("#fc-sub").textContent = " chance of at least one offer within 12 weeks (your numbers now: " + pct(base.curve[12]) + ")";
      $("#fc-facts").textContent = "";
      [["Half-way point", weeksText(scen.week50)], ["At 26 weeks", pct(scen.atEnd)], ["Interviews expected", String(scen.interviewsPerRun)]].forEach(function (f) {
        var d = document.createElement("div"), b = document.createElement("b"); b.textContent = f[1]; d.appendChild(b); d.appendChild(document.createTextNode(f[0])); $("#fc-facts").appendChild(d);
      });
      $("#fc-title").textContent = "Chart: chance of at least one offer by week. With " + perWeek + " applications a week and an interview rate at " + Math.round(mult * 100) + "% of today, the chance is " + pct(scen.curve[12]) + " by week 12 and " + pct(scen.atEnd) + " by week 26.";
      var rows = ""; for (var k = 0; k <= scen.weeks; k += 2) rows += "<tr><td>" + k + "</td><td>" + pct(base.curve[k]) + "</td><td>" + pct(scen.curve[k]) + "</td></tr>";
      $("#fc-rows").innerHTML = rows;
    }
    function later() { if (!raf) raf = requestAnimationFrame(run); }
    $("#fc-pw").addEventListener("input", function (ev) { perWeek = +ev.target.value; $("#fc-pw-o").textContent = perWeek; later(); });
    $("#fc-mult").addEventListener("input", function (ev) { mult = ev.target.value / 100; $("#fc-mult-o").textContent = ev.target.value + "%"; later(); });
    $("#fc-reset").addEventListener("click", function () {
      perWeek = Math.max(1, Math.round(rates.perWeek || 5)); mult = 1; $("#fc-pw").value = perWeek; $("#fc-mult").value = 100; $("#fc-pw-o").textContent = perWeek; $("#fc-mult-o").textContent = "100%"; run();
    });
    SC.cleanups.push(function () { if (raf) cancelAnimationFrame(raf); });
    var rt = $("#fc-rates");
    [["Applications sent", rates.sent + " (" + rates.perWeek + " a week lately)"],
      ["Reaches an interview", pct(rates.pInterview) + (rates.observedInterview === null ? " (starting value)" : " (you: " + pct(rates.observedInterview) + ")")],
      ["Interview to offer", pct(rates.pOffer) + (rates.observedOffer === null ? " (starting value)" : " (you: " + pct(rates.observedOffer) + ")")],
      ["Typical wait", rates.lagInterview + " days to interview, " + rates.lagOffer + " to offer"],
      ["Confidence", rates.confidence + (rates.confidence === "low" ? ": fewer than 12 applications, so starting values carry weight" : "")]].forEach(function (r) {
      var d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span"); b.textContent = r[0]; s.textContent = r[1]; d.appendChild(b); d.appendChild(s); rt.appendChild(d);
    });
    run();
    if (!flows.empty) {
      var svg = $("#rv-svg"), names = { wishlist: "Wishlist", applied: "Applied", screening: "Screening", interview: "Interview", offer: "Offer", accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn" };
      flows.links.forEach(function (l) { var p = el("path", { d: l.d, "class": "rv-link to-" + l.to, "stroke-width": l.w }); p.appendChild(el("title", {}, names[l.from] + " to " + names[l.to] + ": " + l.n)); svg.appendChild(p); });
      flows.nodes.forEach(function (n) {
        svg.appendChild(el("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 3, "class": "rv-node st-" + n.id }));
        var right = n.x > 450; svg.appendChild(el("text", { x: right ? n.x - 6 : n.x + n.w + 6, y: n.y + Math.min(n.h / 2 + 4, n.h + 2), "text-anchor": right ? "end" : "start", "class": "rv-label" }, names[n.id] + " " + n.n));
      });
      $("#rv-desc").textContent = "Diagram of how your applications moved between stages. The same counts are listed below.";
      var ul = $("#rv-list"); flows.links.forEach(function (l) { var li = document.createElement("li"); li.textContent = names[l.from] + " to " + names[l.to] + ": " + l.n; ul.appendChild(li); });
    }
  };

  /* ---------- Ask ---------- */
  var EXAMPLES = ["no reply in 2 weeks", "overdue follow ups", "offers", "contacts I haven't reached in 30 days", "rejected", "my wins last month"];
  SC.views.ask = function (root) {
    root.innerHTML = K.head("Apply", "Ask your search",
      "Type a question in plain words and get an answer from your own applications, contacts, references and wins. It reads the question with simple rules, shows how it understood you, and also searches everything by fuzzy match, so typos still find things. No AI, nothing leaves this computer.") +
      '<section class="card"><label for="ask-q">Your question</label><input id="ask-q" type="search" autocomplete="off" spellcheck="false" placeholder="e.g. applications with no reply in 3 weeks" aria-controls="ask-out" maxlength="200">' +
      '<div class="ask-ex" role="group" aria-label="Example questions">' + EXAMPLES.map(function (x) { return '<button type="button" class="chip ex" data-q="' + E(x) + '">' + E(x) + "</button>"; }).join("") + "</div></section>" +
      '<section class="card" id="ask-out" aria-live="polite"><p class="muted">Ask something, or tap an example.</p></section>';
    var q = $("#ask-q"), out = $("#ask-out");
    function row(r) { return '<li><a href="' + E(r.href) + '"><b>' + E(r.text) + "</b><span>" + E(r.meta || "") + "</span></a></li>"; }
    function run() {
      var v = q.value.trim(); if (!v) { out.innerHTML = '<p class="muted">Ask something, or tap an example.</p>'; return; }
      var a = X.ask(v, SC.S, SC.today()), extra = X.searchAll(v, SC.S), shown = {};
      a.rows.forEach(function (r) { shown[r.text + r.href] = 1; });
      extra = extra.filter(function (r) { return !shown[r.text + r.href]; }).slice(0, 12);
      out.innerHTML = "<h2>" + E(a.title) + "</h2>" + (a.said.length ? '<p class="fine">Understood as: ' + a.said.map(function (s) { return '<span class="chip">' + E(s) + "</span>"; }).join("") + "</p>" : "") +
        (a.rows.length ? '<ul class="ask-list">' + a.rows.map(row).join("") + "</ul>" : '<p class="muted">Nothing matches that.</p>') +
        (extra.length ? '<h3 style="margin-top:1rem">Also found by search</h3><ul class="ask-list">' + extra.map(function (r) { return row({ text: r.text, meta: r.kind + (r.meta ? " / " + r.meta : ""), href: r.href }); }).join("") + "</ul>" : "");
    }
    q.addEventListener("input", SC.debounce(run, 120));
    root.addEventListener("click", function (ev) { var b = ev.target.closest("[data-q]"); if (b) { q.value = b.getAttribute("data-q"); run(); q.focus(); } });
    q.focus();
  };

  /* ---------- sealed backup card (used by the Backup page) ---------- */
  SC.sealedCard = function (host) {
    var ok = X.canSeal(), card = document.createElement("section");
    card.className = "card"; card.id = "sealed-card";
    card.innerHTML = "<h2>Sealed backup</h2><p>An encrypted copy of everything, protected by a passphrase you choose. It uses AES-256-GCM with a key from PBKDF2-SHA256 (600,000 rounds) through your browser's built-in WebCrypto. There is no way to recover it without the passphrase, and Stark cannot help you, because Stark never sees it.</p>" +
      (ok ? '<label for="s-pass">Passphrase (12+ characters)</label><input id="s-pass" type="password" autocomplete="new-password"><p class="fine" id="s-str" aria-live="polite">Strength: -</p>' +
        '<label for="s-pass2">Type it again</label><input id="s-pass2" type="password" autocomplete="new-password">' +
        '<div class="row" style="margin-top:.6rem"><button type="button" class="btn primary" id="s-make">Download sealed backup</button></div>' +
        '<h3 style="margin-top:1rem">Open a sealed backup</h3><label for="s-file">Choose a sealed file</label><input id="s-file" type="file" accept=".json,.sealed,application/json">' +
        '<label for="s-open-pass">Its passphrase</label><input id="s-open-pass" type="password" autocomplete="current-password"><div class="row" style="margin-top:.6rem"><button type="button" class="btn" id="s-open">Decrypt and restore</button></div>' +
        '<p class="fine" id="s-msg" aria-live="polite">Restoring replaces what is here now.</p>' : '<p class="warn-text">This browser has no WebCrypto, so sealed backups are unavailable here. The normal backup still works.</p>');
    host.appendChild(card);
    if (!ok) return;
    var pass = $("#s-pass", card), pass2 = $("#s-pass2", card), msg = $("#s-msg", card), busy = false;
    pass.addEventListener("input", function () { var s = X.strength(pass.value); $("#s-str", card).textContent = "Strength: " + (pass.value ? s.label + " (about " + s.bits + " bits)" + (s.ok ? "" : ". Use 12+ characters with a mix, or a few random words.") : "-"); });
    $("#s-make", card).addEventListener("click", function () {
      if (busy) return;
      if (pass.value !== pass2.value) { msg.textContent = "The two passphrases do not match."; return; }
      if (!X.strength(pass.value).ok) { msg.textContent = "That passphrase is too weak. Use 12+ characters with a mix, or a few random words."; return; }
      busy = true; msg.textContent = "Sealing...";
      X.seal(SC.wrapBackup(SC.S), pass.value).then(function (s) {
        SC.download("stark_career_sealed_" + SC.today() + ".sealed", s, "application/json"); msg.textContent = "Sealed backup downloaded. Keep the passphrase somewhere safe: it cannot be recovered."; pass.value = pass2.value = "";
      }, function (e) { msg.textContent = "Could not seal: " + e.message; }).then(function () { busy = false; });
    });
    $("#s-open", card).addEventListener("click", function () {
      var f = $("#s-file", card).files[0]; if (busy) return; if (!f) { msg.textContent = "Choose a sealed file first."; return; }
      busy = true; msg.textContent = "Decrypting...";
      var r = new FileReader();
      r.onload = function () {
        X.unseal(String(r.result), $("#s-open-pass", card).value).then(function (text) {
          var res = SC.readBackup(text, SC.stateTemplate());
          if (!res.ok) throw new Error(res.error);
          if (SC.isSafe()) SC.leaveSafe();
          SC.S = SC.mergeState(res.state); SC.save(); msg.textContent = "Restored (" + res.note + "): " + SC.S.apps.length + " applications and your resume are back."; $("#s-open-pass", card).value = "";
        }).then(null, function (e) { msg.textContent = "Could not restore: " + e.message + ". Nothing was changed."; }).then(function () { busy = false; });
      };
      r.onerror = function () { msg.textContent = "Could not read that file."; busy = false; };
      r.readAsText(f);
    });
  };
})();
