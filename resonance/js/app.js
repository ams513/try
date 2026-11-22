/* Stark Resonance: the app shell (router, views, simulation runner). Offline, no network. */
(function (root) {
  "use strict";
  var VERSION = "1.1.0", doc = document, P = root.StarkPhysics, Sims = root.StarkSims, X = root.StarkExport, Cn = root.StarkContent, Store = root.StarkStore, TRIAL = root.STARK_TRIAL || null;
  var H = Sims.H, TAU = P.TAU, state = Store.load(Sims.list), reduced = false, raf = 0, running = null, rootEl, navEl;
  try { reduced = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { reduced = false; }

  // ---------- tiny DOM helpers ----------
  function h(tag, attrs) {
    var el = doc.createElement(tag), i, k, v, kids = Array.prototype.slice.call(arguments, 2);
    for (k in (attrs || {})) {
      v = attrs[k]; if (v == null || v === false) continue;
      if (k === "text") el.textContent = v; else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v); else if (k === "class") el.className = v; else el.setAttribute(k, v === true ? "" : v);
    }
    (function add(list) { list.forEach(function (c) { if (Array.isArray(c)) add(c); else if (c != null && c !== false) el.appendChild(typeof c === "string" || typeof c === "number" ? doc.createTextNode(String(c)) : c); }); })(kids);
    return el;
  }
  function svg(paths, size) {
    var s = doc.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 32 32"); s.setAttribute("width", size || 28); s.setAttribute("height", size || 28); s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "ico");
    paths.forEach(function (d) { var p = doc.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.appendChild(p); }); return s;
  }
  var ICONS = {
    wave: ["M2 16c3-12 6-12 9 0s6 12 9 0 6-12 10 0"], coil: ["M16 4v6", "M8 12h16", "M8 17h16", "M8 22h16", "M6 27h20"], motor: ["M16 16m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0", "M16 16l7-4", "M16 6v4"],
    grid: ["M3 26l6-18 6 18", "M13 26l6-18 6 18", "M2 12h28"], wireless: ["M8 6v20", "M24 8v16", "M13 11c3 3 3 7 0 10", "M18 9c5 4 5 10 0 14"], string: ["M3 16c3.5-10 7-10 10.5 0s7 10 10.5 0", "M3 10v12", "M27 10v12"],
    memory: ["M4 24c6 0 4-16 12-16s6 16 12 16", "M2 16h28"], ledger: ["M6 6h20v20H6z", "M6 13h20", "M13 6v20"]
  };
  function icon(n, s) { return svg(ICONS[n] || ICONS.wave, s); }
  function toast(msg) { var t = doc.getElementById("toast"); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 5000); }
  function modal(title, body) {
    var prev = doc.activeElement, ov = h("div", { class: "overlay" }), box = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title }, h("h2", { text: title }), body), api;
    function key(e) { if (e.key === "Escape") api.close(); }
    api = { close: function () { doc.removeEventListener("keydown", key); if (ov.parentNode) ov.parentNode.removeChild(ov); if (prev && prev.focus) prev.focus(); } };
    ov.appendChild(box); ov.addEventListener("mousedown", function (e) { if (e.target === ov) api.close(); }); doc.addEventListener("keydown", key); doc.body.appendChild(ov);
    var f = box.querySelector("input,textarea,select,button"); if (f) f.focus(); return api;
  }
  root.StarkUI = { h: h, modal: modal, toast: toast };
  function persist() { if (!Store.save(state) && !persist.warned) { persist.warned = true; toast("This browser blocks saving. Use Export on the Saved page to keep your work."); } }
  function download(name, text, type) {
    var a = h("a", { href: URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type: type || "application/json" })), download: name, class: "sr-only" }); doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); doc.body.removeChild(a); }, 500);
  }
  function stop() { if (running) { running.dead = true; running = null; } cancelAnimationFrame(raf); }
  // Put text on the clipboard; if the browser refuses, show it in a box to copy by hand.
  function copyText(t, okMsg) {
    function byHand() { var ta = h("textarea", { class: "ex-copybox", rows: 10, readonly: true, "aria-label": "The numbers, to copy by hand" }), dlg; ta.value = t; dlg = modal("Copy the numbers", h("div", { class: "form" }, h("p", { class: "fine", text: "This browser did not allow copying. Select all of the text below and copy it." }), ta, h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Close", onclick: function () { dlg.close(); } })))); ta.focus(); ta.select(); }
    function old() { var ta = h("textarea", { class: "sr-only", "aria-hidden": "true", tabindex: "-1" }), ok = false; ta.value = t; doc.body.appendChild(ta); ta.select(); try { ok = doc.execCommand("copy"); } catch (e) { ok = false; } doc.body.removeChild(ta); if (ok) toast(okMsg); else byHand(); }
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) root.navigator.clipboard.writeText(t).then(function () { toast(okMsg); }, old); else old();
  }
  function svgNode(text) { var d = new DOMParser().parseFromString(text, "image/svg+xml"), n = d.documentElement; return n && n.nodeName === "svg" ? doc.importNode(n, true) : h("p", { class: "fine", text: "The graph could not be drawn." }); }
  /* lab sheet: full version only */
  /* full version only */

  root.StarkResonance = { VERSION: VERSION, route: function () { route(); }, lab: null };

  // ---------- routing ----------
  var NAV = [["#/home", "Home"], ["#/labs", "Labs"], ["#/history", "Timeline"], ["#/frontier", "Frontier"], ["#/saved", "Saved"], ["#/about", "About"]];
  function route() {
    var hash = (root.location.hash || "#/home").replace(/^#\/?/, ""), parts = hash.split("?"), seg = parts[0].split("/"), q = {}, v;
    (parts[1] || "").split("&").forEach(function (kv) { if (kv) { var a = kv.split("="); q[a[0]] = decodeURIComponent(a[1] || ""); } });
    stop(); root.StarkResonance.lab = null; rootEl.textContent = ""; rootEl.scrollTop = 0;
    var page = seg[0] || "home";
    if (page === "sim" && Sims.byId(seg[1])) v = simView(Sims.byId(seg[1]), q);
    else if (page === "labs") v = labsView(); else if (page === "history") v = historyView(); else if (page === "frontier") v = frontierView(); else if (page === "saved") v = savedView(); else if (page === "about") v = aboutView(); else v = homeView();
    rootEl.appendChild(v); doc.title = "Stark Resonance" + (TRIAL ? " (Free trial)" : "");
    navEl.querySelectorAll("a").forEach(function (a) { var on = a.getAttribute("href") === "#/" + (page === "sim" ? "labs" : page); a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    root.scrollTo(0, 0); var m = doc.getElementById("main"); if (m) m.focus({ preventScroll: true });
  }

  // ---------- shared bits ----------
  function statusChip(s) { return h("span", { class: "chip st-" + s, text: Cn.STATUS[s] || s }); }
  function srcLink(src) { return h("a", { class: "src", href: src[0], target: "_blank", rel: "noopener noreferrer", text: src[1] }); }
  function locked(def) { return !def.make || !!(TRIAL && !TRIAL.allows(def.id)); }
  function trialNote() {
    return h("div", { class: "trial-note", role: "note" }, h("span", { class: "chip st-experimental", text: "Free trial" }), " ",
      "The trial opens the rotating field lab and 3 saved experiments. The timeline, the myth table, the frontier section and About are fully open. " + ((root.StarkTrial || {}).notIncluded || "") + " ", h("a", { class: "btn small", href: TRIAL.store, target: "_blank", rel: "noopener noreferrer", text: "Own it forever: get the full lab" }));
  }
  function simCard(def) {
    var n = (state.done[def.id] || []).length, lk = locked(def);
    return h("a", { class: "card sim" + (lk ? " locked" : ""), href: "#/sim/" + def.id }, h("div", { class: "card-top" }, icon(def.icon, 30), def.group === "frontier" ? h("span", { class: "chip st-experimental", text: "Frontier model" }) : null, lk ? h("span", { class: "chip", text: "Full version" }) : null),
      h("h3", { text: def.title }), h("p", { text: def.blurb }), h("p", { class: "fine", text: lk ? "Not in the free trial" : "Guided steps done: " + n + " of " + def.experiment.length }));
  }

  // ---------- home ----------
  function heroCanvas() {
    var cv = h("canvas", { class: "hero-canvas", role: "img", "aria-label": "A rotating magnetic field arrow and two coupled waves, drawn live" }), g = cv.getContext("2d"), t = 0, dead = false, W = 0, Hh = 0;
    function size() { var r = cv.getBoundingClientRect(), d = Math.min(2, root.devicePixelRatio || 1); W = Math.max(200, r.width); Hh = Math.max(120, r.height); cv.width = W * d; cv.height = Hh * d; g.setTransform(d, 0, 0, d, 0, 0); }
    function frame(ts) {
      if (dead || !cv.isConnected) return; t = reduced ? 1.2 : ts / 1000; H.theme(); var C = H.C, i, cx = W * 0.2, cy = Hh * 0.5, R = Math.min(W * 0.16, Hh * 0.4);
      g.clearRect(0, 0, W, Hh);
      g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
      var cols = [C.a, C.b, C.c], wt = t * 1.6;
      for (i = 0; i < 3; i++) { var ax = i * TAU / 3, cur = Math.cos(wt - ax); H.arrow(g, cx, cy, cx + Math.cos(ax) * R * 0.8 * cur * 0.6, cy + Math.sin(ax) * R * 0.8 * cur * 0.6, H.rgba(cols[i], 0.8), 2.5); }
      var fv = P.fieldVector("three", 0, wt); H.arrow(g, cx, cy, cx + fv.x * R * 0.9 / 1.5 * 1.1, cy + fv.y * R * 0.9 / 1.5 * 1.1, C.text, 4);
      var x0 = W * 0.42, w2 = W * 0.54, mid = Hh * 0.5, k, p1 = [], p2 = [], beat = Math.cos(0.5 * t * 0.6);
      for (k = 0; k <= 160; k++) { var u = k / 160, env = Math.sin(Math.PI * u); p1.push([x0 + u * w2, mid - Math.sin(u * 22 - t * 3) * Hh * 0.3 * env * beat]); p2.push([x0 + u * w2, mid - Math.sin(u * 22 + t * 3.1) * Hh * 0.3 * env * Math.sin(0.5 * t * 0.6)]); }
      H.poly(g, p1, H.rgba(C.a, 0.9), 2.5); H.poly(g, p2, H.rgba(C.b, 0.9), 2.5);
      if (!reduced) raf = requestAnimationFrame(frame);
    }
    setTimeout(function () { size(); raf = requestAnimationFrame(frame); }, 0);
    root.addEventListener("resize", function () { if (cv.isConnected) { size(); if (reduced) frame(0); } });
    return cv;
  }
  function homeView() {
    var tesla = Cn.PEOPLE.filter(function (p) { return p.id === "tesla"; })[0];
    return h("div", { class: "page" },
      h("section", { class: "hero" }, h("div", { class: "hero-text" },
        h("p", { class: "eyebrow", text: "An offline lab. No account, no tracking." }), h("h1", { text: "Real physics you can touch" }),
        h("p", { class: "lead", text: "Tune a Tesla coil. Turn a motor with three currents and no moving part in the field. Watch wireless power fade with distance. Test a perpetual-motion machine against the books. Every simulation shows its equation, its model and what it leaves out." }),
        h("p", { class: "cta" }, h("a", { class: "btn primary", href: "#/sim/field", text: "Start with the rotating field" }), " ", h("a", { class: "btn", href: "#/labs", text: "All eight labs" }))), heroCanvas()),
      TRIAL ? trialNote() : null,
      h("section", null, h("h2", { text: "The labs" }), h("div", { class: "grid" }, Sims.list.map(simCard))),
      h("section", { class: "two" },
        h("div", { class: "card flat" }, h("h3", { text: "Meet the people" }), h("p", { text: "Nikola Tesla and 26 other scientists and engineers, with accurate dates, what each did and where the stories are disputed or myth." }), h("a", { class: "btn", href: "#/history", text: "Open the timeline" })),
        h("div", { class: "card flat" }, h("h3", { text: "Beyond silicon: what is real" }), h("p", { text: "Memristors, spintronics, photonic and neuromorphic computing, each with an honest status: established, experimental or speculative." }), h("a", { class: "btn", href: "#/frontier", text: "Open the frontier" }))),
      h("section", { class: "card honest" }, h("h3", { text: "What this is not" }),
        h("p", { text: "Stark Resonance is a set of simulations. It does not make electricity, add memory to your computer, speed up your PC or replace any hardware, and it is not a replacement for RAM or for semiconductors. It claims no free energy: the Possible or Impossible lab exists to show why not. Names such as " + tesla.name + " are used only to describe the history of science." })));
  }
  function labsView() {
    var g1 = Sims.list.filter(function (d) { return d.group === "tesla"; }), g2 = Sims.list.filter(function (d) { return d.group === "frontier"; });
    return h("div", { class: "page" }, h("h1", { text: "The labs" }), h("p", { class: "lead", text: "Eight real-time simulations. Each has sliders with units, a panel on what you are seeing with the governing equation, and a short guided experiment." }), TRIAL ? trialNote() : null,
      h("h2", { text: "Tesla's world: resonance, fields and power" }), h("div", { class: "grid" }, g1.map(simCard)), h("h2", { text: "Frontier model" }), h("div", { class: "grid" }, g2.map(simCard)));
  }

  // ---------- the simulation page ----------
  function fmtVal(c, v) { var d = c.dec == null ? 2 : c.dec; return (Math.abs(v) >= 1e4 ? v.toExponential(2) : v.toFixed(d)) + (c.unit ? " " + c.unit : ""); }
  function simView(def, q) {
    if (locked(def)) return h("div", { class: "page" }, h("h1", { text: def.title }), h("p", { class: "lead", text: def.blurb }), trialNote(), window.StarkTrial.card("more_labs"), h("a", { class: "btn", href: "#/labs", text: "Back to the labs" }));
    var p = Store.defaults(def), saved = q.s && state.saved.filter(function (e) { return e.id === q.s; })[0], inst, running2 = { dead: false }, playing = !reduced, ctrlEls = {}, canvas, g, wCss = 0, hCss = 0, frames = 0, last = 0;
    if (saved && saved.sim === def.id) p = Store.cleanParams(def, saved.params);
    inst = def.make(p); running = running2;
    // ---- controls ----
    function applyShow() { def.controls.forEach(function (c) { var e = ctrlEls[c.id]; if (e && c.show) e.row.hidden = !c.show(p); }); }
    function setParam(id, v, fromUI) {
      var c = def.controls.filter(function (x) { return x.id === id; })[0]; if (!c) return; p[id] = v; var e = ctrlEls[id];
      if (e && !fromUI) { if (c.type === "toggle") e.input.checked = !!v; else if (c.type === "select") e.input.value = v; else e.input.value = c.log ? Math.round(Math.log(v / c.min) / Math.log(c.max / c.min) * 1000) : v; }
      if (e && e.out) e.out.textContent = fmtVal(c, v); if (e && e.input && c.type !== "toggle" && c.type !== "select") e.input.setAttribute("aria-valuetext", fmtVal(c, v));
      applyShow(); if (def.resetOnChange && inst.reset) inst.reset();
    }
    function controlRow(c) {
      var id = "c-" + def.id + "-" + c.id, row, input, out;
      if (c.type === "button") { input = h("button", { type: "button", class: "btn", id: id, text: c.label, onclick: function () { var patch = inst.act && inst.act(c.id); if (patch) Object.keys(patch).forEach(function (k) { setParam(k, patch[k]); }); if (!playing) draw(); } }); row = h("div", { class: "ctl btnrow" }, input); }
      else if (c.type === "toggle") { input = h("input", { type: "checkbox", id: id, checked: p[c.id] ? true : null, onchange: function () { setParam(c.id, input.checked, true); } }); row = h("div", { class: "ctl toggle" }, input, h("label", { for: id, text: c.label })); }
      else if (c.type === "select") { input = h("select", { id: id, onchange: function () { setParam(c.id, input.value, true); } }, c.options.map(function (o) { return h("option", { value: o[0], text: o[1], selected: o[0] === p[c.id] ? true : null }); })); row = h("div", { class: "ctl" }, h("label", { for: id, text: c.label }), input); }
      else {
        out = h("output", { for: id, text: fmtVal(c, p[c.id]) });
        input = c.log ? h("input", { type: "range", id: id, min: 0, max: 1000, step: 1, value: Math.round(Math.log(p[c.id] / c.min) / Math.log(c.max / c.min) * 1000) }) : h("input", { type: "range", id: id, min: c.min, max: c.max, step: c.step || (c.max - c.min) / 1000, value: p[c.id] });
        input.setAttribute("aria-valuetext", fmtVal(c, p[c.id]));
        input.addEventListener("input", function () { var x = parseFloat(input.value), v = c.log ? c.min * Math.pow(c.max / c.min, x / 1000) : x; if (c.step && !c.log) v = Math.round(v / c.step) * c.step; setParam(c.id, Math.max(c.min, Math.min(c.max, v)), true); if (!playing) draw(); });
        row = h("div", { class: "ctl" }, h("label", { for: id, text: c.label }), out, input);
      }
      ctrlEls[c.id] = { row: row, input: input, out: out }; return row;
    }
    var controls = h("div", { class: "controls" }, def.controls.map(controlRow));
    // ---- stage ----
    canvas = h("canvas", { class: "stage-canvas", tabindex: "0", role: "img", "aria-label": def.title }); g = canvas.getContext("2d");
    var readEl = h("dl", { class: "readouts" }), playBtn = h("button", { type: "button", class: "btn", text: playing ? "Pause" : "Play", onclick: function () { playing = !playing; playBtn.textContent = playing ? "Pause" : "Play"; if (playing) { last = 0; } } });
    var stepBtn = h("button", { type: "button", class: "btn", text: "Step", onclick: function () { inst.step(0.1); draw(); readouts(); } });
    var resetBtn = h("button", { type: "button", class: "btn", text: "Reset", onclick: function () { def.controls.forEach(function (c) { if (c.type !== "button") setParam(c.id, c.val); }); if (inst.reset) inst.reset(); draw(); readouts(); } });
    var saveBtn = h("button", { type: "button", class: "btn primary", text: "Save this experiment", onclick: saveDialog });
    var verdictEl = def.id === "ledger" ? h("div", { class: "verdict", role: "status" }) : null;
    function size() {
      var r = canvas.parentNode.getBoundingClientRect(), d = Math.min(2, root.devicePixelRatio || 1), w = Math.max(280, Math.floor(r.width)), narrow = w < 560, asp = narrow ? (def.aspectN || 1.3) : (def.aspectW || 0.6);
      if (w === wCss && canvas.__asp === asp) return; wCss = w; hCss = Math.round(w * asp); canvas.__asp = asp; canvas.style.height = hCss + "px"; canvas.width = Math.round(w * d); canvas.height = Math.round(hCss * d); g.setTransform(d, 0, 0, d, 0, 0);
    }
    function draw() { H.theme(); size(); g.clearRect(0, 0, wCss, hCss); inst.draw(g, wCss, hCss); }
    function readouts() {
      var rows = inst.read(); readEl.textContent = ""; rows.forEach(function (r) { readEl.appendChild(h("div", null, h("dt", { text: r[0] }), h("dd", { text: String(r[1]) }))); });
      if (verdictEl) { var v = inst.verdict(); verdictEl.className = "verdict " + v.tone; verdictEl.textContent = ""; verdictEl.appendChild(h("p", { class: "claim", text: "The claim: " + inst.claim() })); verdictEl.appendChild(h("strong", { text: v.head })); verdictEl.appendChild(h("p", { text: v.text })); }
    }
    function loop(ts) {
      if (running2.dead || !canvas.isConnected) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts; frames++;
      if (playing && !doc.hidden) inst.step(dt);
      draw(); if (frames % 6 === 0) readouts(); if (frames % 90 === 0) canvas.setAttribute("aria-label", def.title + ". " + inst.aria());
      raf = requestAnimationFrame(loop);
    }
    if (inst.pointer) { canvas.classList.add("drag"); var dragging = false; canvas.addEventListener("pointerdown", function (e) { dragging = true; canvas.setPointerCapture(e.pointerId); var r = canvas.getBoundingClientRect(); inst.pointer(e.clientX - r.left, e.clientY - r.top, wCss, hCss, setParam); }); canvas.addEventListener("pointermove", function (e) { if (!dragging) return; var r = canvas.getBoundingClientRect(); inst.pointer(e.clientX - r.left, e.clientY - r.top, wCss, hCss, setParam); }); canvas.addEventListener("pointerup", function () { dragging = false; }); canvas.addEventListener("pointercancel", function () { dragging = false; }); }
    canvas.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); playBtn.click(); } else if (e.key === "r" || e.key === "R") resetBtn.click(); });
    function saveDialog() {
      var name = h("input", { type: "text", id: "sv-name", maxlength: 60, value: def.title }), note = h("textarea", { id: "sv-note", rows: 3, maxlength: 400, placeholder: "What did you find?" }), dlg;
      dlg = modal("Save this experiment", h("form", { class: "form", onsubmit: function (e) {
        e.preventDefault(); var r = Store.add(state, def, name.value, note.value, p, TRIAL ? TRIAL.saveLimit : null);
        if (r.full) { dlg.close(); toast("The free trial keeps 3 saved experiments. Delete one on the Saved page, or get the full lab."); return; }
        persist(); dlg.close(); toast("Saved. Find it on the Saved page.");
      } }, h("p", { class: "fine", text: "Saves the settings of this lab, a name and your note in this browser. Nothing is sent anywhere." }), h("label", { for: "sv-name", text: "Name" }), name, h("label", { for: "sv-note", text: "Note" }), note,
        h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Cancel", onclick: function () { dlg.close(); } }), h("button", { type: "submit", class: "btn primary", text: "Save" }))));
    }
    var exportPanel = window.StarkTrial.card("data_export");
    // ---- panels ----
    var adult = state.level === "adult";
    var seeing = h("section", { class: "panel" }, h("h2", { text: "What you are seeing" }), h("p", { text: def.plain }),
      adult ? h("div", null, h("h3", { text: "The governing equations" }), h("pre", { class: "eq", text: def.eq.join("\n") })) : h("p", { class: "fine", text: "The equations are shown at the Adult level (top of the page)." }),
      h("h3", { text: "The model" }), h("p", { text: def.model }), h("h3", { text: "What this simulation simplifies or leaves out" }), h("ul", null, def.limits.map(function (l) { return h("li", { text: l }); })));
    var done = state.done[def.id] || [];
    var exp = h("section", { class: "panel" }, h("h2", { text: "Guided experiment" }), h("p", { class: "fine", text: "Press Set it up to load each step, then watch the lab. Tick a step when you have seen it." }),
      h("ol", { class: "steps" }, def.experiment.map(function (s, i) {
        var cb = h("input", { type: "checkbox", id: "ex-" + i, checked: done.indexOf(i) >= 0 ? true : null, onchange: function () { Store.toggleDone(state, def.id, i, cb.checked); persist(); } });
        return h("li", null, h("p", { text: s.say }), h("p", { class: "expect" }, h("strong", { text: "What to expect: " }), s.expect),
          h("div", { class: "row" }, h("button", { type: "button", class: "btn small", text: "Set it up", onclick: function () { Object.keys(s.set).forEach(function (k) { setParam(k, s.set[k]); }); if (def.id === "ledger" && inst.reset) inst.reset(); if (!playing) { draw(); readouts(); } } }), cb, h("label", { for: "ex-" + i, text: "Done" })));
      })));
    var head = h("header", { class: "sim-head" }, h("a", { class: "back", href: "#/labs", text: "All labs" }), h("h1", null, icon(def.icon, 30), " ", def.title), h("p", { class: "lead", text: def.blurb }),
      reduced ? h("p", { class: "fine", text: "Paused because your system asks for reduced motion. Press Play to run it, or Step to advance it a little." }) : null);
    var page = h("div", { class: "page" }, head, h("div", { class: "simgrid" }, h("div", { class: "stage" }, canvas, h("div", { class: "bar" }, playBtn, stepBtn, resetBtn, saveBtn), verdictEl, readEl), h("aside", { class: "side" }, h("h2", { class: "side-h", text: "Controls" }), controls)), exportPanel, seeing, exp);
    applyShow();
    setTimeout(function () { size(); draw(); readouts(); raf = requestAnimationFrame(loop); }, 0);
    return page;
  }
  var resizeT; root.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(function () { var c = doc.querySelector(".stage-canvas"); if (c) { c.__asp = 0; } }, 50); });

  // ---------- history ----------
  var THEMES = [["all", "Everyone"], ["em", "Electricity and magnetism"], ["comp", "Computing and information"], ["phys", "Physics and mathematics"], ["other", "Other"]];
  function historyView() {
    var filter = "all", list = h("div", { class: "people" }), chips = h("div", { class: "filters", role: "group", "aria-label": "Filter the timeline" });
    function build() {
      list.textContent = ""; chips.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.k === filter ? "true" : "false"); });
      Cn.PEOPLE.filter(function (p) { return filter === "all" || p.theme === filter; }).forEach(function (p) {
        var end = p.died || 2026, lo = 1700, span = 330, left = Math.max(0, (p.born - lo) / span * 100), right = Math.min(100, (end - lo) / span * 100), bar = h("span", { class: "life-bar" }), early = p.born < lo;
        bar.style.left = (early ? 0 : left) + "%"; bar.style.width = Math.max(1.5, right - (early ? 0 : left)) + "%"; if (early) bar.classList.add("early");
        list.appendChild(h("article", { class: "card person" + (p.big ? " big" : ""), id: "p-" + p.id },
          h("div", { class: "life", "aria-hidden": "true" }, h("span", { class: "life-track" }, bar), early ? h("span", { class: "life-note", text: "before 1700" }) : null),
          h("h3", null, p.name, " ", p.status === "disputed" ? h("span", { class: "chip st-speculative", text: "Partly disputed" }) : null), h("p", { class: "fine", text: p.years + ". Key work: " + p.when + "." }), h("p", { text: p.what }),
          p.facts ? h("ul", null, p.facts.map(function (f) { return h("li", { text: f }); })) : null,
          h("p", { class: "fine" }, "Source: ", srcLink(p.src), p.src2 ? [" and ", srcLink(p.src2)] : null)));
      });
    }
    THEMES.forEach(function (t) { var b = h("button", { type: "button", class: "chip btnchip", "data-k": t[0], text: t[1], onclick: function () { filter = t[0]; build(); } }); chips.appendChild(b); });
    build();
    var table = h("div", { class: "myths" }, Cn.MYTHS.map(function (m) {
      return h("article", { class: "card myth v-" + m.verdict }, h("div", { class: "card-top" }, h("span", { class: "chip v-" + m.verdict, text: m.verdict === "confirmed" ? "Confirmed" : m.verdict === "myth" ? "Myth" : "Disputed or unverified" })), h("h3", { text: m.claim }), h("p", { text: m.record }), h("p", { class: "fine" }, "Source: ", srcLink(m.src), m.src2 ? [" and ", srcLink(m.src2)] : null));
    }));
    return h("div", { class: "page" }, h("h1", { text: "The scientists, in time" }), h("p", { class: "lead", text: "Twenty-seven people. The bar on each card shows when they lived, from 1700 onward. Dates and credits are the standard record; where a story is disputed or a myth, the card says so." }),
      h("p", { class: "fine", text: "Each card links to a source. The links open your own browser; this app never goes online. The sources were chosen from a research brief and should be re-read before you quote them." }), chips, list,
      h("h2", { text: "Myth versus the record: Nikola Tesla" }), h("p", { class: "fine", text: "Tesla is an inventor who gathered legends. This table sorts them." }), table);
  }

  // ---------- frontier ----------
  function frontierView() {
    return h("div", { class: "page" }, h("h1", { text: "Beyond silicon: what is real" }),
      h("section", { class: "card honest" }, h("h3", { text: "The honest summary" }), h("p", { text: "No product today replaces RAM and removes the need for semiconductors. Every serious next memory still sits on a silicon chip with silicon transistors around it. The software you are running is itself running on semiconductors. This page is a guide to what each idea is and what its status really is, with a model of one of them (the memristor) you can play with. It is not a claim that this app computes with any of them." })),
      h("div", { class: "legend" }, h("span", null, statusChip("established"), " in products or standard science today"), h("span", null, statusChip("experimental"), " working in labs or small products, not mainstream"), h("span", null, statusChip("speculative"), " no known route yet")),
      h("div", { class: "grid f" }, Cn.FRONTIER.map(function (f) {
        return h("article", { class: "card front" }, h("div", { class: "card-top" }, statusChip(f.status)), h("h3", { text: f.name }), h("p", null, h("strong", { text: "How it works. " }), f.how), h("p", null, h("strong", { text: "Where it stands. " }), f.now), h("p", null, h("strong", { text: "Does it remove semiconductors? " }), f.semis),
          h("p", { class: "fine" }, "Source: ", srcLink(f.src), f.src2 ? [" and ", srcLink(f.src2)] : null), f.sim ? h("a", { class: "btn small", href: "#/sim/" + f.sim, text: "Open the memristor model" }) : null);
      })),
      h("h2", { text: "What software can honestly do about memory" }), h("ul", null, ["Use less RAM: stream data, keep compact structures, load lazily, avoid duplicate copies.", "Compress cold data and report the ratio and the speed.", "Run well on older and low-memory computers: offline, no background services, small downloads.", "Teach the physics and let people try it, which is what this lab does."].map(function (t) { return h("li", { text: t }); })));
  }

  // ---------- saved ----------
  function savedView() {
    var list = h("div", { class: "grid" }), fileIn = h("input", { type: "file", accept: "application/json,.json", class: "sr-only", id: "imp", onchange: function () {
      var f = fileIn.files[0]; if (!f) return; if (f.size > 1000000) { toast("That file is too large."); return; }
      var rd = new FileReader(); rd.onload = function () {
        var r = Store.parse(String(rd.result), Sims.list); if (!r.ok) { toast(r.error); return; }
        var have = {}; state.saved.forEach(function (e) { have[e.id] = 1; }); var added = 0, skipped = 0;
        r.state.saved.forEach(function (e) { if (have[e.id]) { skipped++; return; } if (TRIAL && state.saved.length >= TRIAL.saveLimit) { skipped++; return; } state.saved.push(e); added++; });
        Object.keys(r.state.done).forEach(function (k) { var cur = state.done[k] || []; state.done[k] = cur.concat(r.state.done[k].filter(function (n) { return cur.indexOf(n) < 0; })).sort(); });
        persist(); toast("Imported " + added + " experiments" + (skipped + r.dropped ? "; skipped " + (skipped + r.dropped) + " that were duplicates, unknown or over the limit." : ".")); route();
      }; rd.readAsText(f);
    } });
    state.saved.forEach(function (e) {
      var def = Sims.byId(e.sim), lk = def && locked(def);
      list.appendChild(h("article", { class: "card" }, h("div", { class: "card-top" }, icon(def.icon, 24), h("span", { class: "fine", text: new Date(e.ts).toLocaleDateString() })), h("h3", { text: e.name }), h("p", { class: "fine", text: def.title }), e.note ? h("p", { text: e.note }) : null,
        h("div", { class: "row" }, lk ? h("span", { class: "fine", text: "Opens in the full version" }) : h("a", { class: "btn small primary", href: "#/sim/" + e.sim + "?s=" + e.id, text: "Open" }), h("button", { type: "button", class: "btn small", text: "Delete", onclick: function () { Store.remove(state, e.id); persist(); route(); } }))));
    });
    return h("div", { class: "page" }, h("h1", { text: "Saved experiments" }), TRIAL ? h("p", { class: "fine", text: "The free trial keeps up to " + TRIAL.saveLimit + " saved experiments (" + state.saved.length + " used). Nothing is ever deleted for you." }) : null,
      h("p", { class: "lead", text: "Your experiments live in this browser only. Export them to a file to keep a copy or to move them to another computer." }),
      h("div", { class: "row" }, h("button", { type: "button", class: "btn primary", text: "Export to a file", onclick: function () { download("stark-resonance-" + new Date().toISOString().slice(0, 10) + ".json", Store.serialize(state)); } }), h("label", { class: "btn", for: "imp", tabindex: "0", text: "Import from a file", onkeydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileIn.click(); } } }), fileIn),
      state.saved.length ? list : h("p", { class: "fine", text: "Nothing saved yet. In any lab, press Save this experiment." }));
  }

  // ---------- about ----------
  function aboutView() {
    return h("div", { class: "page" }, h("h1", { text: "About Stark Resonance" }), h("p", { class: "lead", text: "Version " + VERSION + (TRIAL ? " (Free trial)" : "") + ". An offline lab of the real physics behind Nikola Tesla's work and the scientists around him, by Stark." }),
      h("section", { class: "card honest" }, h("h3", { text: "Independent and educational" }), h("p", { text: "Independent educational product by Stark. Not affiliated with, endorsed by or sponsored by Tesla, Inc., Nikola Corporation, the Nikola Tesla Museum or the Tesla estate. Names are used only to describe the history of science. Simulations are simplified models for learning." })),
      h("section", { class: "panel" }, h("h2", { text: "What it is, and is not" }), h("ul", null, [
        "It is a simulation. It does not make electricity, add memory to your computer, speed up your PC or replace any hardware.",
        "It does not claim free energy or over-unity. The Possible or Impossible lab shows where the energy goes in each machine.",
        "Each lab states its model and its simplifications on screen. Where a lab is a toy of a real device (the memristor, the coil discharge), it says so.",
        "The frontier section explains research ideas with a status of established, experimental or speculative. It is a guide, not a claim that this app computes that way."].map(function (t) { return h("li", { text: t }); }))),
      h("section", { class: "panel" }, h("h2", { text: "Your data" }), h("p", { text: "No account, no network calls and no analytics. Your saved experiments and your level are stored in this browser (localStorage) and can be exported to a file. If the browser clears its storage, restore from an export. Links to sources open your own browser; the app does not go online." })),
      h("section", { class: "panel" }, h("h2", { text: "Using it" }), h("ul", null, ["Every slider works with the arrow keys. On a lab, press Space to pause or play and R to reset, with the picture focused.", "On a phone or tablet, drag the receiver in the Wireless lab.", "If your system asks for reduced motion, the labs start paused: press Play or Step.", "The language menu offers English and Spanish. Interface text, lab titles, controls and buttons are translated; the long explanations, the history cards and the data and graph export panel (new in 1.1) are in English."].map(function (t) { return h("li", { text: t }); }))),
      h("section", { class: "panel" }, h("h2", { text: "Data and graph export" }), h("p", { text: "Every lab has a Data and graph export panel under the picture. It turns the graph you see into numbers and pictures for a report. The values are simulated from the lab's simplified model. They are not measurements, and every file and printout says so." }), h("ul", null, [
        "CSV: lines that start with # are notes (the lab, your settings, what each column means). The first line without # is the header, with the unit of each column in brackets. Numbers use a decimal point and six significant digits; an empty cell means no value.",
        "Text cells that begin with =, +, - or @ get an apostrophe in front, so a spreadsheet shows them as text and does not run them as a formula. Negative numbers are left as numbers.",
        "Copy the numbers puts the header and the rows on the clipboard, separated by tabs, ready to paste into a spreadsheet or a document.",
        "PNG and SVG: the graph is drawn again by this app from the table, on a white background, at the size you choose. Lines differ by dash pattern as well as colour, so they survive a black-and-white printer.",
        "Print this lab makes one layout with the graph, the settings used, the readouts and the data table, for A4 or US Letter paper. Long tables are thinned to evenly spaced rows on paper; the CSV always holds every row.",
        "Time-based labs (the Tesla coil, the standing wave, the memristor) export the samples on screen at the moment you press the button. Pause first if you want the picture and the file to show the same instant."].map(function (t) { return h("li", { text: t }); }))),
      h("section", { class: "panel" }, h("h2", { text: "Credits and sources" }), h("p", { text: "The physics follows standard textbook results (coupled-mode theory, the Kloss torque formula, the linear ion-drift memristor model of HP Labs, the one-dimensional wave equation, I squared R loss). History and frontier cards cite their sources. Treat the cited pages as the place to verify before you quote any date or claim." })));
  }

  // ---------- chrome ----------
  function init() {
    rootEl = doc.getElementById("main"); navEl = doc.getElementById("nav");
    NAV.forEach(function (n) { navEl.appendChild(h("a", { href: n[0], text: n[1] })); });
    var lv = doc.getElementById("level-btn"), th = doc.getElementById("theme-btn");
    function paintLevel() { lv.textContent = state.level === "adult" ? "Level: Adult" : "Level: Teen"; lv.setAttribute("aria-label", "Switch level, now " + state.level); }
    paintLevel(); lv.addEventListener("click", function () { state.level = state.level === "adult" ? "teen" : "adult"; persist(); paintLevel(); route(); });
    var themeKey = "stark-resonance-theme", t0 = null; try { t0 = root.localStorage.getItem(themeKey); } catch (e) { t0 = null; }
    doc.documentElement.setAttribute("data-theme", t0 === "light" ? "light" : "dark");
    th.addEventListener("click", function () { var n = doc.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light"; doc.documentElement.setAttribute("data-theme", n); try { root.localStorage.setItem(themeKey, n); } catch (e) { /* storage off */ } H.theme(); });
    if (TRIAL) { var b = doc.querySelector(".brand-by"); if (b) b.appendChild(doc.createTextNode(" · Free trial")); }
    root.addEventListener("hashchange", route); H.theme(); route();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})(window);
