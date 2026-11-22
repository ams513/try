/* Stark Prove-It Panel 1.0 (shared module). A page that shows, in plain words and live, what this app has done on the network this session.
   Reads only what a web page is allowed to read about itself: its own Content-Security-Policy, the Resource Timing list, and the browser's
   policy-violation events. No network, no storage, no outside code. A page cannot see other programs, other tabs or the operating system. */
(function (root) {
  "use strict";
  var PV = {};
  var cfgNow = function () { return (root && root.STARK_PROVEIT) || {}; };

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function kb(n) { return n < 1024 ? n + " B" : (n / 1024 < 100 ? (n / 1024).toFixed(1) : Math.round(n / 1024)) + " KB"; }
  PV.esc = esc;

  /* ---------- 1. the page's own Content-Security-Policy ---------- */
  /* PROVEIT:READ-CSP  (the line number of this marker is shown to the reader as "the code that reads the policy") */
  PV.readCsp = function (doc) {
    var metas = doc && doc.querySelectorAll ? doc.querySelectorAll("meta[http-equiv]") : [], out = [], i;
    for (i = 0; i < metas.length; i++) if (String(metas[i].getAttribute("http-equiv")).toLowerCase() === "content-security-policy") out.push(metas[i].getAttribute("content") || "");
    return out.length ? out.join("; ") : null;
  };

  PV.parseCsp = function (text) {
    var d = {}, order = [];
    String(text || "").split(";").forEach(function (part) {
      var t = part.trim().split(/\s+/).filter(Boolean);
      if (!t.length) return;
      var name = t[0].toLowerCase();
      if (!(name in d)) { d[name] = t.slice(1); order.push(name); }   /* the first copy of a directive wins, as in browsers */
    });
    return { directives: d, order: order };
  };

  function tokenAllowsOutside(tok) {
    var t = tok.toLowerCase();
    if (t === "'self'" || t === "'none'" || t === "data:" || t === "blob:" || t === "'unsafe-inline'" || t === "'unsafe-eval'") return false;
    if (/^'(nonce|sha256|sha384|sha512)-/.test(t) || t === "'strict-dynamic'" || t === "'wasm-unsafe-eval'") return false;
    return true;   /* '*', https:, http:, ws:, wss:, a host name, a port */
  }
  /* The tokens that really apply to a fetch-type directive: its own list, else default-src's (CSP fallback). */
  PV.effective = function (parsed, name) {
    var d = parsed.directives;
    if (name in d) return d[name];
    if ("default-src" in d && name !== "form-action" && name !== "base-uri" && name !== "frame-ancestors") return d["default-src"];
    return null;
  };

  var EXPLAIN = {
    "default-src": "Anything the lines below do not name may only come from this page's own location.",
    "connect-src": null,   /* built from the value */
    "script-src": null,
    "style-src": null,
    "img-src": "Images may only come from this page's own files, or be made inside the page (data: and blob: pictures). No picture can be fetched from another address.",
    "media-src": "Audio and video may only come from this page's own files or be made inside the page.",
    "font-src": "Fonts may only come from this page's own files.",
    "frame-src": null,
    "object-src": null,
    "base-uri": null,
    "form-action": null
  };
  function explainOne(name, toks, parsed) {
    var eff = PV.effective(parsed, name) || [], none = eff.length === 1 && eff[0].toLowerCase() === "'none'";
    var outside = eff.some(tokenAllowsOutside), strength = outside ? "warn" : "ok", plain;
    if (name === "connect-src") {
      plain = none ? "The page's own code is not allowed to open any connection (fetch, XMLHttpRequest, WebSocket, EventSource or beacon) to anywhere, not even back to itself. The browser refuses it before anything is sent."
        : outside ? "The page's code may connect to: " + eff.filter(tokenAllowsOutside).join(", ") + ". This page can talk to the outside."
        : "The page's code may only connect back to its own location.";
    } else if (name === "script-src") {
      plain = (outside ? "Scripts may also come from: " + eff.filter(tokenAllowsOutside).join(", ") + ". " : "Only scripts from this page's own files run. ") +
        (eff.indexOf("'unsafe-inline'") >= 0 ? "Inline scripts are allowed. " : "Scripts written inside the page itself do not run. ") +
        (eff.indexOf("'unsafe-eval'") >= 0 ? "Code built from text at run time is allowed." : "Code built from text at run time (eval) is refused.");
      if (eff.indexOf("'unsafe-inline'") >= 0 || eff.indexOf("'unsafe-eval'") >= 0) strength = "warn";
    } else if (name === "frame-src") {
      plain = none ? "The page may not embed other pages (frames)." : outside ? "The page may embed: " + eff.join(", ") + "." : "The page may only embed its own pages.";
    } else if (name === "object-src") {
      plain = none ? "No plug-ins or embedded objects." : "Embedded objects are allowed from: " + eff.join(", ") + ".";
    } else if (name === "base-uri") {
      plain = none ? "Nothing can change where the page's relative links point." : "The base address of links may be set to: " + eff.join(", ") + ".";
    } else if (name === "form-action") {
      plain = none ? "A form on this page cannot submit anywhere." : outside ? "Forms may submit to: " + eff.join(", ") + "." : "Forms may only submit to this page's own location.";
    } else {
      if (name === "style-src") plain = "Styles come from this page's own files" + (eff.indexOf("'unsafe-inline'") >= 0 ? "; small inline styles for layout are allowed, and anything a style asks to load is still held to the image and font lines." : ".");
      else if (outside) plain = "This line allows outside sources: " + eff.filter(tokenAllowsOutside).join(", ") + ".";
      else plain = EXPLAIN[name] || "Rule for " + name + ": " + (eff.join(" ") || "(empty)") + ".";
    }
    return { name: name, value: toks.join(" "), plain: plain, strength: strength };
  }
  /* Returns the rows to show: the ones that matter for "does this page talk to anyone", in a fixed order. */
  var SHOW = ["connect-src", "default-src", "script-src", "img-src", "media-src", "font-src", "frame-src", "object-src", "form-action", "base-uri", "style-src"];
  PV.explainCsp = function (parsed) {
    var rows = [];
    SHOW.forEach(function (n) { if (n in parsed.directives) rows.push(explainOne(n, parsed.directives[n], parsed)); });
    parsed.order.forEach(function (n) { if (SHOW.indexOf(n) < 0) rows.push(explainOne(n, parsed.directives[n], parsed)); });
    return rows;
  };
  /* connect: "none" | "self" | "open" | "unknown" (no policy found) */
  PV.connectState = function (parsed) {
    if (!parsed) return "unknown";
    var eff = PV.effective(parsed, "connect-src");
    if (!eff) return "open";   /* no connect-src and no default-src: the browser allows connections */
    if (eff.length === 1 && eff[0].toLowerCase() === "'none'") return "none";
    return eff.some(tokenAllowsOutside) ? "open" : "self";
  };

  /* ---------- 2. Resource Timing ---------- */
  PV.classify = function (url, loc) {
    var u;
    try { u = new URL(url, loc.href); } catch (e) { return "outside"; }
    if (u.protocol === "data:" || u.protocol === "blob:" || u.protocol === "about:") return "inline";
    if (loc.protocol === "file:") return u.protocol === "file:" ? "own" : "outside";
    return u.origin === loc.origin ? "own" : "outside";
  };
  var TYPE_WORDS = { script: "scripts", link: "stylesheets and icons", css: "files named inside styles", img: "images", audio: "audio", video: "video", iframe: "frames", fetch: "fetch (made by code)", xmlhttprequest: "XMLHttpRequest (made by code)", beacon: "beacons (made by code)", other: "other" };
  var CODE_MADE = { fetch: 1, xmlhttprequest: 1, beacon: 1, websocket: 1, eventsource: 1 };
  PV.typeWord = function (t) { return TYPE_WORDS[t] || t || "other"; };
  PV.short = function (url, loc) {
    try {
      var u = new URL(url, loc.href), base = loc.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
      var s = u.href.replace(/[?#].*$/, "");
      return s.indexOf(base) === 0 ? s.slice(base.length) || "(this page)" : u.protocol === "file:" ? decodeURI(u.pathname) : u.host + u.pathname;
    } catch (e) { return String(url); }
  };
  PV.summarise = function (entries, loc, page) {
    var m = { total: entries.length, own: 0, outside: 0, inline: 0, codeMade: 0, bytes: 0, outsideHosts: [], types: {}, items: [], page: page || null };
    var hosts = {}, i, e, c, host;
    for (i = 0; i < entries.length; i++) {
      e = entries[i]; c = PV.classify(e.name, loc);
      m[c]++;
      if (CODE_MADE[e.initiatorType]) m.codeMade++;
      m.types[e.initiatorType || "other"] = (m.types[e.initiatorType || "other"] || 0) + 1;
      m.bytes += Math.max(+e.decodedBodySize || 0, 0);
      if (c === "outside") { try { host = new URL(e.name, loc.href).host || e.name; } catch (x) { host = e.name; } if (!hosts[host]) { hosts[host] = 1; m.outsideHosts.push(host); } }
      m.items.push({ name: PV.short(e.name, loc), type: e.initiatorType || "other", cls: c, size: Math.max(+e.decodedBodySize || 0, 0) });
    }
    m.items.sort(function (a, b) { return a.cls === b.cls ? (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) : a.cls === "outside" ? -1 : 1; });
    return m;
  };

  /* ---------- 3. the verdict, worded so it never claims more than the page can see ---------- */
  PV.verdict = function (m, connect, viol, hasTiming) {
    var parts = [], level = "ok", title;
    if (!hasTiming) return { level: "unknown", title: "This browser does not list a page's requests", text: "Use step 2 below (the browser's network tab) to count them yourself. The policy reading above still applies." };
    if (m.outside > 0 || m.codeMade > 0) {
      level = "bad";
      title = m.outside > 0 ? plural(m.outside, "request", "requests") + " went to somewhere other than this page's own location" : plural(m.codeMade, "request", "requests") + " were made by code (fetch or similar)";
      if (m.outsideHosts.length) parts.push("To: " + m.outsideHosts.slice(0, 6).join(", ") + (m.outsideHosts.length > 6 ? " and " + (m.outsideHosts.length - 6) + " more" : "") + ".");
    } else {
      title = "No request left this page's own location this session";
      parts.push(plural(m.own, "file", "files") + " loaded, all from this page's own location" + (m.inline ? ", plus " + plural(m.inline, "item", "items") + " made inside the page (data: or blob:)" : "") + ". Requests made by code (fetch, XMLHttpRequest, beacon): 0.");
    }
    if (connect === "none") parts.push("The page's policy forbids its code from opening any connection.");
    else if (connect === "self") parts.push("The page's policy only lets its code connect back to itself.");
    else if (connect === "open") { if (level === "ok") level = "warn"; parts.push("The page's policy does NOT forbid outside connections, so this page could talk to the outside."); }
    else { if (level === "ok") level = "warn"; parts.push("No policy was found inside the page, so the browser is not enforcing a block here."); }
    if (viol > 0) { if (level === "ok") level = "warn"; parts.push(plural(viol, "attempt", "attempts") + " to connect or load something outside was refused by the policy."); }
    else parts.push("Attempts refused by the policy this session: 0.");
    return { level: level, title: title, text: parts.join(" ") };
  };

  /* ---------- 4. a one-time blocked test, only when the person presses the button ---------- */
  /* It asks the browser for one address that cannot exist (.invalid never resolves). With connect-src 'none' the browser refuses before anything is sent. */
  PV.TEST_URL = "https://proveit.invalid/blocked-test";
  PV.blockedTest = function (win) {
    return new Promise(function (resolve) {
      var done = false, seen = null, f = win.fetch;
      function finish(r) { if (done) return; done = true; win.removeEventListener("securitypolicyviolation", on); resolve(r); }
      function on(ev) { if (String(ev.blockedURI).indexOf("proveit.invalid") >= 0) seen = ev; }
      win.addEventListener("securitypolicyviolation", on);
      if (typeof f !== "function") { finish({ result: "unsupported" }); return; }
      var p; try { p = f.call(win, PV.TEST_URL, { mode: "no-cors", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" }); } catch (e) { p = Promise.reject(e); }
      p.then(function () { finish({ result: "went-out" }); }, function () {
        setTimeout(function () {
          finish(seen ? { result: "blocked", directive: seen.effectiveDirective || seen.violatedDirective } : { result: "failed-no-policy" });
        }, 60);
      });
    });
  };

  /* ---------- 5. state kept for the session ---------- */
  var S = { seen: [], seenKeys: {}, viol: 0, testViol: 0, listeners: [], started: false, t0: 0 };
  function note(e) { var k = e.name + "|" + e.startTime; if (S.seenKeys[k]) return; S.seenKeys[k] = 1; S.seen.push(e); }
  function ping() { S.listeners.forEach(function (f) { try { f(); } catch (e) { } }); }
  PV.start = function (win) {
    if (S.started || !win) return;
    S.started = true;
    var perf = win.performance;
    try { if (perf && perf.setResourceTimingBufferSize) perf.setResourceTimingBufferSize(3000); } catch (e) { }
    try {
      if (win.PerformanceObserver) {
        new win.PerformanceObserver(function (list) { list.getEntries().forEach(note); ping(); }).observe({ type: "resource", buffered: true });
      }
    } catch (e) { }
    try {
      win.addEventListener("securitypolicyviolation", function (ev) {
        if (String(ev.blockedURI).indexOf("proveit.invalid") >= 0) S.testViol++; else S.viol++;
        ping();
      });
    } catch (e) { }
  };
  PV._state = S;

  /* Chrome does not put files opened from disk (file://) in the Resource Timing list, so the files the page's own tags point at are read as well. */
  PV.declared = function (doc, loc) {
    var out = [], seen = {};
    function add(url, type) {
      if (!url) return;
      var abs; try { abs = new URL(url, loc.href).href; } catch (e) { abs = String(url); }
      if (seen[abs]) return; seen[abs] = 1; out.push({ name: abs, initiatorType: type, decodedBodySize: 0, startTime: 0, tag: true });
    }
    try {
      Array.prototype.forEach.call(doc.querySelectorAll("script[src]"), function (n) { add(n.getAttribute("src"), "script"); });
      Array.prototype.forEach.call(doc.querySelectorAll("link[href]"), function (n) { var r = String(n.getAttribute("rel") || "").toLowerCase(); if (/stylesheet|icon|preload|prefetch|modulepreload/.test(r)) add(n.getAttribute("href"), "link"); });
      Array.prototype.forEach.call(doc.querySelectorAll("img[src],iframe[src],audio[src],video[src],source[src],embed[src],object[data]"), function (n) {
        var u = n.getAttribute("src") || n.getAttribute("data"); if (u && !/^(data|blob):/i.test(u)) add(u, n.tagName.toLowerCase() === "img" ? "img" : n.tagName.toLowerCase());
      });
    } catch (e) { }
    return out;
  };

  PV.gather = function (win) {
    var perf = win.performance, list = [], nav = null, loc = win.location, tagged = 0;
    try { (perf.getEntriesByType("resource") || []).forEach(note); } catch (e) { }
    list = S.seen.slice();
    var have = {};
    list.forEach(function (e) { have[e.name] = 1; });
    PV.declared(win.document, loc).forEach(function (d) { if (!have[d.name]) { list.push(d); tagged++; } });
    try { nav = (perf.getEntriesByType("navigation") || [])[0] || null; } catch (e) { }
    var hasTiming = !!(perf && perf.getEntriesByType && win.PerformanceObserver);
    var parsedText = PV.readCsp(win.document), parsed = parsedText == null ? null : PV.parseCsp(parsedText);
    var m = PV.summarise(list, loc, nav ? { duration: Math.round(nav.duration || 0) } : null);
    m.tagged = tagged;
    return { m: m, csp: parsedText, parsed: parsed, connect: PV.connectState(parsed), viol: S.viol, testViol: S.testViol, hasTiming: hasTiming,
      since: Math.max(0, Math.round((perf && perf.now ? perf.now() : 0) / 1000)), loc: loc };
  };

  /* ---------- 6. drawing ---------- */
  function where(loc) {
    if (loc.protocol === "file:") return "opened from a file on this computer";
    if (loc.protocol === "http:" || loc.protocol === "https:") return "served from " + loc.host + " (the files of this page come from there)";
    return "opened from " + loc.protocol;
  }
  function ago(sec) { return sec < 90 ? sec + " seconds" : sec < 5400 ? Math.round(sec / 60) + " minutes" : (sec / 3600).toFixed(1) + " hours"; }

  PV.liveHTML = function (g) {
    var m = g.m, v = PV.verdict(m, g.connect, g.viol, g.hasTiming), rows = "", i, it;
    var h = '<div class="pv-verdict pv-' + v.level + '" data-level="' + v.level + '"><p class="pv-vt">' + esc(v.title) + '</p><p class="pv-vx">' + esc(v.text) + "</p></div>";
    h += '<div class="pv-stats">' +
      '<div><b data-pv="own">' + m.own + "</b>files loaded from this page's own location</div>" +
      '<div class="' + (m.outside ? "pv-badnum" : "") + '"><b data-pv="outside">' + m.outside + "</b>requests to anywhere else</div>" +
      '<div class="' + (m.codeMade ? "pv-badnum" : "") + '"><b data-pv="code">' + m.codeMade + "</b>made by code (fetch, XHR, beacon)</div>" +
      '<div class="' + (g.viol ? "pv-badnum" : "") + '"><b data-pv="viol">' + g.viol + "</b>attempts the policy refused</div></div>";
    h += '<p class="pv-fine">' + "Watching since this page opened (" + esc(ago(g.since)) + " ago); the page is " + esc(where(g.loc)) + ". The count starts again when you reload." + (m.tagged ? " " + m.tagged + " of the files were read from the page's own tags, because this browser does not list local files in its timing list; a file a script asks for later would show only in the timing list or step 2." : "") + (g.testViol ? " The test you ran added " + g.testViol + " refused attempt" + (g.testViol === 1 ? "" : "s") + ", not counted above." : "") + "</p>";
    if (g.hasTiming) {
      var types = Object.keys(m.types).sort();
      h += '<details class="pv-det"><summary>List every file this page loaded (' + m.total + ")</summary>";
      if (types.length) h += '<p class="pv-fine">' + types.map(function (t) { return esc(PV.typeWord(t)) + ": " + m.types[t]; }).join(" &middot; ") + ". Total " + esc(kb(m.bytes)) + " (uncompressed).</p>";
      h += '<ul class="pv-list">';
      for (i = 0; i < m.items.length && i < 300; i++) { it = m.items[i]; rows += '<li class="pv-' + (it.cls === "outside" ? "outside" : "own") + '"><span class="pv-fn">' + esc(it.name) + '</span><span class="pv-ty">' + esc(PV.typeWord(it.type)) + (it.cls === "outside" ? ", OUTSIDE" : it.cls === "inline" ? ", made in page" : "") + "</span></li>"; }
      h += rows + (m.items.length > 300 ? '<li class="pv-fine">and ' + (m.items.length - 300) + " more</li>" : "") + "</ul></details>";
    }
    return h;
  };

  PV.staticHTML = function (g, cfg) {
    var h = "", rows = g.parsed ? PV.explainCsp(g.parsed) : [], i, r;
    var app = cfg.app || "This app", file = cfg.cspFile || "index.html";
    h += '<section class="pv-card" aria-labelledby="pv-h-live"><h2 id="pv-h-live">1. What ' + esc(app) + " has done on the network this session</h2>" +
      '<div id="pv-live" data-pv-live></div></section>';
    h += '<section class="pv-card" aria-labelledby="pv-h-csp"><h2 id="pv-h-csp">2. What this page\'s own policy allows</h2>';
    if (g.parsed) {
      h += '<p class="pv-fine">Read just now from the page itself (the Content-Security-Policy tag). The browser enforces it: it is a rule the page gave itself, and it refuses what the rule does not allow.</p><div class="pv-csp">';
      for (i = 0; i < rows.length; i++) { r = rows[i]; h += '<div class="pv-row pv-' + r.strength + '"><code class="pv-dir">' + esc(r.name) + " " + esc(r.value) + '</code><p>' + esc(r.plain) + "</p></div>"; }
      h += "</div>";
    } else h += '<p class="pv-vx">No policy tag was found inside this page, so there is nothing for this panel to read. A web server can also send a policy in a header, which a page cannot read.</p>';
    h += "</section>";
    h += '<section class="pv-card" aria-labelledby="pv-h-test"><h2 id="pv-h-test">3. Try it: ask the browser for one outside address</h2>' +
      '<p class="pv-fine">This asks the browser for one address that cannot exist (' + esc(PV.TEST_URL) + "). With the policy above, the browser must refuse before anything is sent. It runs only when you press the button.</p>" +
      '<div class="pv-actions"><button type="button" class="pv-btn" id="pv-test">Run the blocked-request test</button></div><p class="pv-vx" id="pv-test-out" aria-live="polite"></p></section>';
    h += '<section class="pv-card" aria-labelledby="pv-h-you"><h2 id="pv-h-you">Check it yourself in three steps</h2><ol class="pv-steps">' +
      "<li><b>Turn off the network and use the app.</b> Switch off Wi-Fi (or pull the cable, or use airplane mode), then add, edit and save something. It keeps working because everything it needs is already in the files on this computer. In a browser player the page was fetched once when it opened; the downloaded copy needs the network never.</li>" +
      "<li><b>Open your browser's network tab.</b> Press F12 (Cmd+Option+I on a Mac), choose Network, then reload this page and use the app. The rows are every file the page asked for. They should all be this page's own files, and the tab should show no fetch or XHR rows. The browser's tab is a separate witness from this panel.</li>" +
      "<li><b>Read the line yourself.</b> Open <code>" + esc(file) + "</code> in a text editor, or press Ctrl+U in the browser, and go to <b>line " + esc(cfg.cspLine || "?") + "</b>. You should read <code>connect-src 'none'</code> in it" +
      (cfg.codeFile ? ". The code that builds this panel's reading is in <code>" + esc(cfg.codeFile) + "</code> at <b>line " + esc(cfg.codeLine || "?") + "</b>." : ".") + "</li></ol>";
    if (g.csp) h += '<details class="pv-det"><summary>The policy exactly as the page holds it now</summary><pre class="pv-pre">' + esc(g.csp) + "</pre></details>";
    h += "</section>";
    var lim = ["A web page cannot see other programs, other browser tabs, extensions or the operating system. This panel speaks for this page only; it does not prove anything about the rest of the computer. A firewall log or your router would show that.",
      "It shows what this page asked for and what its own policy allows. It cannot see a request the browser did not report to the page, and it is not a certificate or an audit.",
      "Someone could edit the page's files and weaken the policy. Check where you got the file from, and read the line in step 3 of the guide."]
      .concat(cfg.extraLimits || []);
    h += '<section class="pv-card pv-limits" aria-labelledby="pv-h-lim"><h2 id="pv-h-lim">What this panel cannot tell you</h2><ul>' + lim.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
    return h;
  };

  /* Draws the panel into el and keeps the live part current. Returns {stop}. */
  PV.mount = function (el, opts) {
    var win = (opts && opts.win) || root, cfg = (opts && opts.cfg) || cfgNow(), timer = null, live;
    PV.start(win);
    var g = PV.gather(win);
    el.innerHTML = '<div class="pv-panel">' + PV.staticHTML(g, cfg) + "</div>";
    live = el.querySelector("[data-pv-live]");
    function redraw() { if (!live.isConnected) { stop(); return; } live.innerHTML = PV.liveHTML(PV.gather(win)); }
    function stop() { clearInterval(timer); var k = S.listeners.indexOf(redraw); if (k >= 0) S.listeners.splice(k, 1); }
    redraw();
    S.listeners.push(redraw);
    timer = setInterval(redraw, 5000);
    var b = el.querySelector("#pv-test"), out = el.querySelector("#pv-test-out");
    if (b) b.addEventListener("click", function () {
      b.disabled = true; out.textContent = "Asking...";
      PV.blockedTest(win).then(function (r) {
        b.disabled = false;
        out.className = "pv-vx pv-" + (r.result === "blocked" ? "ok" : "warn");
        out.textContent = r.result === "blocked" ? "Refused by this page's own policy (" + r.directive + "). The browser stopped it before anything was sent."
          : r.result === "failed-no-policy" ? "The request failed, but no policy refusal was reported. It could not be completed (the address does not exist), yet the policy did not stop it first. Do not rely on this page for the block."
          : r.result === "unsupported" ? "This browser has no fetch to test with."
          : "The request was allowed out. The page's policy did not stop it.";
        redraw();
      });
    });
    return { stop: stop };
  };

  if (root && root.document) PV.start(root);
  if (typeof module === "object" && module.exports) module.exports = PV;
  if (root) root.StarkProveIt = PV;
})(typeof window !== "undefined" ? window : null);
