/* Stark Vital: charts drawn as SVG with no libraries and no network. Colours come from CSS classes, so light, dark and high
   contrast themes all work. Every chart has a text summary for screen readers and a "show as table" switch; marks differ by
   shape as well as colour. */
(function () {
  "use strict";
  function narrow() { return window.innerWidth < 600; }
  var V = window.StarkVital, U = window.VitalUI, h = U.h, NS = "http://www.w3.org/2000/svg", C = window.VitalCharts = {};

  function svg(tag, attrs) {
    var el = document.createElementNS(NS, tag), k, kids = Array.prototype.slice.call(arguments, 2);
    for (k in attrs || {}) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    kids.forEach(function (c) { if (c == null) return; el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function titled(el, text) { el.appendChild(svg("title", null, text)); return el; }
  function niceRange(lo, hi, steps) {
    if (!isFinite(lo) || !isFinite(hi)) return { lo: 0, hi: 1, step: 0.25 };
    if (lo === hi) { lo -= 1; hi += 1; }
    var raw = (hi - lo) / (steps || 4), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step: step };
  }
  function marker(kind, x, y, r, cls) {
    if (kind === "square") return svg("rect", { x: x - r, y: y - r, width: 2 * r, height: 2 * r, class: cls });
    if (kind === "up") return svg("path", { d: "M" + x + " " + (y - r - 1) + "L" + (x + r + 1) + " " + (y + r) + "L" + (x - r - 1) + " " + (y + r) + "Z", class: cls });
    if (kind === "down") return svg("path", { d: "M" + x + " " + (y + r + 1) + "L" + (x + r + 1) + " " + (y - r) + "L" + (x - r - 1) + " " + (y - r) + "Z", class: cls });
    if (kind === "diamond") return svg("path", { d: "M" + x + " " + (y - r - 1) + "L" + (x + r + 1) + " " + y + "L" + x + " " + (y + r + 1) + "L" + (x - r - 1) + " " + y + "Z", class: cls });
    return svg("circle", { cx: x, cy: y, r: r, class: cls });
  }
  // Wraps a chart with its text summary and a table toggle. rows: array of arrays (first row = header).
  C.card = function (title, chart, summary, rows, extra) {
    var tbl = null;
    if (rows && rows.length > 1) {
      tbl = h("details", { class: "chart-table" }, h("summary", { text: "Show as a table" }),
        h("div", { class: "tbl" }, h("table", { class: "list" }, h("thead", null, h("tr", null, rows[0].map(function (c) { return h("th", { scope: "col", text: c }); }))),
          h("tbody", null, rows.slice(1).map(function (r) { return h("tr", null, r.map(function (c, i) { return i === 0 ? h("th", { scope: "row", text: String(c) }) : h("td", { text: String(c) }); })); })))));
    }
    return h("figure", { class: "chart" }, title ? h("figcaption", { text: title }) : null, chart, h("p", { class: "fine chart-sum", text: summary || "" }), extra || null, tbl);
  };

  // opts: { series:[{name, pts:[{date,v}], cls}], from, to (dates), min, max, fmt(v), height, avg:true, label }
  C.line = function (o) {
    var W = narrow() ? 400 : 680, H = o.height || (narrow() ? 250 : 230), pl = 46, pr = 12, pt = 14, pb = 28, from = V.dayNum(o.from), to = V.dayNum(o.to), span = Math.max(1, to - from), vals = [], g;
    o.series.forEach(function (s) { s.pts.forEach(function (p) { vals.push(p.v); }); });
    var lo = o.min != null ? o.min : Math.min.apply(null, vals.length ? vals : [0]), hi = o.max != null ? o.max : Math.max.apply(null, vals.length ? vals : [1]), nr = niceRange(lo, hi, 4);
    if (o.min != null) nr.lo = o.min; if (o.max != null) nr.hi = o.max;
    for (var tv = nr.lo; tv <= nr.hi + nr.step / 2; tv += nr.step) pl = Math.max(pl, (o.fmt ? o.fmt(tv) : String(Math.round(tv * 100) / 100)).length * 6.4 + 14);   // room for the longest axis label
    var X = function (date) { return pl + (V.dayNum(date) - from) / span * (W - pl - pr); }, Y = function (v) { return pt + (1 - (v - nr.lo) / (nr.hi - nr.lo)) * (H - pt - pb); };
    var root = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img", "aria-label": o.label || "Line chart", preserveAspectRatio: "xMidYMid meet" });
    for (var v = nr.lo; v <= nr.hi + nr.step / 2; v += nr.step) {
      root.appendChild(svg("line", { x1: pl, x2: W - pr, y1: Y(v), y2: Y(v), class: "c-grid" }));
      root.appendChild(svg("text", { x: pl - 6, y: Y(v) + 4, class: "c-axis", "text-anchor": "end" }, o.fmt ? o.fmt(v) : String(Math.round(v * 100) / 100)));
    }
    var ticks = span <= 8 ? 1 : span <= 31 ? 7 : span <= 100 ? 14 : 60, i;
    for (i = 0; i <= span; i += ticks) { var dt = V.addDays(o.from, i); root.appendChild(svg("text", { x: X(dt), y: H - 8, class: "c-axis", "text-anchor": i === 0 ? "start" : "middle" }, dt.slice(5))); }
    o.series.forEach(function (s, si) {
      var d = "", prev = null, kind = si === 0 ? "circle" : "square";
      s.pts.forEach(function (p) { d += (prev && V.dayNum(p.date) - V.dayNum(prev) <= 3 ? "L" : "M") + X(p.date).toFixed(1) + " " + Y(p.v).toFixed(1); prev = p.date; });
      if (d) root.appendChild(svg("path", { d: d, pathLength: "1", class: "c-line " + (s.cls || "s" + si) }));
      var r = s.pts.length > 120 ? 1.8 : s.pts.length > 60 ? 2.6 : 3.4;
      s.pts.forEach(function (p) { root.appendChild(titled(marker(kind, X(p.date), Y(p.v), r, "c-dot " + (s.cls || "s" + si)), s.name + ", " + p.date + ": " + (o.fmt ? o.fmt(p.v) : p.v))); });
      if (o.avg && s.pts.length >= 5) {   // 7-day moving average over logged days
        var ad = "", k, w, sum, n;
        s.pts.forEach(function (p, idx) { sum = 0; n = 0; for (k = 0; k <= idx; k++) if (V.dayNum(p.date) - V.dayNum(s.pts[k].date) < 7) { sum += s.pts[k].v; n++; } ad += (idx ? "L" : "M") + X(p.date).toFixed(1) + " " + Y(sum / n).toFixed(1); });
        root.appendChild(svg("path", { d: ad, class: "c-avg" }));
      }
    });
    if (!vals.length) root.appendChild(svg("text", { x: W / 2, y: H / 2, class: "c-axis", "text-anchor": "middle" }, "No entries in this period"));
    // hover readout: the nearest logged point
    var guide = svg("line", { y1: pt, y2: H - pb, class: "c-guide", visibility: "hidden" }), tip = svg("text", { class: "c-tip", y: 12, visibility: "hidden" });
    root.appendChild(guide); root.appendChild(tip);
    root.addEventListener("pointermove", function (e) {
      var rect = root.getBoundingClientRect(), px = (e.clientX - rect.left) / rect.width * W, best = null, bd = 1e9;
      o.series.forEach(function (s) { s.pts.forEach(function (p) { var dd = Math.abs(X(p.date) - px); if (dd < bd) { bd = dd; best = { p: p, s: s }; } }); });
      if (!best || bd > 30) { guide.setAttribute("visibility", "hidden"); tip.setAttribute("visibility", "hidden"); return; }
      var x = X(best.p.date); guide.setAttribute("x1", x); guide.setAttribute("x2", x); guide.setAttribute("visibility", "visible");
      tip.textContent = best.p.date + ": " + (o.fmt ? o.fmt(best.p.v) : best.p.v); tip.setAttribute("x", Math.min(Math.max(x, 80), W - 90)); tip.setAttribute("text-anchor", "middle"); tip.setAttribute("visibility", "visible");
    });
    root.addEventListener("pointerleave", function () { guide.setAttribute("visibility", "hidden"); tip.setAttribute("visibility", "hidden"); });
    return root;
  };

  // A tiny line for the home screen: vals oldest to newest, null for a missing day.
  C.spark = function (vals, o) {
    o = o || {}; var W = 160, H = 44, n = vals.length, got = vals.filter(function (v) { return v !== null; }), lo = o.min != null ? o.min : Math.min.apply(null, got.length ? got : [0]), hi = o.max != null ? o.max : Math.max.apply(null, got.length ? got : [1]);
    if (lo === hi) { lo -= 1; hi += 1; }
    var X = function (i) { return 4 + i / Math.max(1, n - 1) * (W - 8); }, Y = function (v) { return 4 + (1 - (v - lo) / (hi - lo)) * (H - 8); }, d = "", prev = -9, last = null, root = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "spark", role: "img", "aria-label": o.label || "Trend" });
    vals.forEach(function (v, i) { if (v === null) return; d += (i - prev <= 2 ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); prev = i; last = i; });
    if (d) root.appendChild(svg("path", { d: d, class: "c-line s0", pathLength: "1" }));
    vals.forEach(function (v, i) { if (v !== null) root.appendChild(svg("circle", { cx: X(i), cy: Y(v), r: i === last ? 3.6 : 2, class: "c-dot s0" })); });
    return root;
  };

  C.ring = function (pct, centre, sub) {
    var R = 46, circ = 2 * Math.PI * R, wrap = h("div", { class: "ring", role: "img", "aria-label": centre + " " + (sub || "") });
    var fg = svg("circle", { cx: 60, cy: 60, r: R, class: "ring-fg", "stroke-dasharray": circ.toFixed(1), "stroke-dashoffset": (circ * (1 - Math.min(1, pct))).toFixed(1), transform: "rotate(-90 60 60)" });
    fg.style.setProperty("--circ", circ.toFixed(1));   // set through the style object: an inline style attribute is blocked by the page policy
    var s = svg("svg", { viewBox: "0 0 120 120", class: "ring-svg" }, svg("circle", { cx: 60, cy: 60, r: R, class: "ring-bg" }), fg);
    wrap.appendChild(s); wrap.appendChild(h("div", { class: "ring-c" }, h("b", { text: centre }), sub ? h("small", { text: sub }) : null));
    return wrap;
  };

  // items: [{label, v, n}], values drawn as bars from zero
  C.bars = function (items, o) {
    o = o || {}; var W = narrow() ? 380 : 520, H = 170, pl = 8, pb = 26, pt = 18, vals = items.map(function (i) { return i.v; }).filter(function (v) { return v != null; }), hi = Math.max.apply(null, vals.length ? vals : [1]), lo = o.min != null ? o.min : 0;
    if (hi <= lo) hi = lo + 1;
    var bw = (W - pl * 2) / items.length, root = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img", "aria-label": o.label || "Bar chart" });
    items.forEach(function (it, i) {
      var x = pl + i * bw + bw * 0.14, w = bw * 0.72;
      if (it.v == null) { root.appendChild(svg("text", { x: x + w / 2, y: H - pb - 6, class: "c-axis", "text-anchor": "middle" }, "-")); }
      else { var bh = (it.v - lo) / (hi - lo) * (H - pb - pt); root.appendChild(titled(svg("rect", { x: x, y: H - pb - bh, width: w, height: Math.max(1, bh), rx: 4, class: "c-bar" }), it.label + ": " + (o.fmt ? o.fmt(it.v) : it.v) + (it.n ? " (" + it.n + " days)" : ""))); root.appendChild(svg("text", { x: x + w / 2, y: H - pb - bh - 4, class: "c-axis", "text-anchor": "middle" }, o.fmt ? o.fmt(it.v) : String(Math.round(it.v * 10) / 10))); }
      root.appendChild(svg("text", { x: x + w / 2, y: H - 8, class: "c-axis", "text-anchor": "middle" }, it.label));
    });
    return root;
  };

  // Two columns of days (with / without), each a dot, with the median marked. vals: {a:[], b:[], aLabel, bLabel}
  C.strip = function (o) {
    var W = 360, H = 170, pl = 40, pb = 30, pt = 10, all = o.a.concat(o.b), nr = niceRange(Math.min.apply(null, all), Math.max.apply(null, all), 4), seed = 3;
    var Y = function (v) { return pt + (1 - (v - nr.lo) / (nr.hi - nr.lo)) * (H - pt - pb); }, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var root = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "chart-svg small", role: "img", "aria-label": o.label || "Comparison of two groups of days" });
    for (var v = nr.lo; v <= nr.hi + nr.step / 2; v += nr.step) { root.appendChild(svg("line", { x1: pl, x2: W - 8, y1: Y(v), y2: Y(v), class: "c-grid" })); root.appendChild(svg("text", { x: pl - 6, y: Y(v) + 4, class: "c-axis", "text-anchor": "end" }, o.fmt ? o.fmt(v) : String(Math.round(v * 10) / 10))); }
    [[o.a, 0, "circle", o.aLabel], [o.b, 1, "square", o.bLabel]].forEach(function (g) {
      var cx = pl + (W - pl - 8) * (g[1] ? 0.72 : 0.28), med = o.median(g[0]);
      g[0].forEach(function (val) { root.appendChild(marker(g[2], cx + (rnd() - 0.5) * 70, Y(val) + (rnd() - 0.5) * 6, 3, "c-dot s" + g[1])); });
      root.appendChild(svg("line", { x1: cx - 44, x2: cx + 44, y1: Y(med), y2: Y(med), class: "c-median" }));
      root.appendChild(svg("text", { x: cx, y: H - 10, class: "c-axis", "text-anchor": "middle" }, g[3] + " (" + g[0].length + ")"));
    });
    return root;
  };

  // points: [{date, v, lo, hi, pos}] one unit. Each point carries its own report's band.
  C.lab = function (o) {
    var W = narrow() ? 400 : 620, H = 230, pl = 52, pr = 16, pt = 14, pb = 28, pts = o.pts, from = Math.min.apply(null, pts.map(function (p) { return V.dayNum(p.date); })), to = Math.max.apply(null, pts.map(function (p) { return V.dayNum(p.date); })), span = Math.max(1, to - from), vals = [];
    pts.forEach(function (p) { vals.push(p.v); if (p.lo != null) vals.push(p.lo); if (p.hi != null) vals.push(p.hi); });
    var nr = niceRange(Math.min.apply(null, vals), Math.max.apply(null, vals), 4), X = function (date) { return pts.length === 1 ? (pl + W - pr) / 2 : pl + 20 + (V.dayNum(date) - from) / span * (W - pl - pr - 40); }, Y = function (v) { return pt + (1 - (v - nr.lo) / (nr.hi - nr.lo)) * (H - pt - pb); };
    var root = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img", "aria-label": o.label });
    for (var v = nr.lo; v <= nr.hi + nr.step / 2; v += nr.step) { root.appendChild(svg("line", { x1: pl, x2: W - pr, y1: Y(v), y2: Y(v), class: "c-grid" })); root.appendChild(svg("text", { x: pl - 6, y: Y(v) + 4, class: "c-axis", "text-anchor": "end" }, String(Math.round(v * 100) / 100))); }
    pts.forEach(function (p) {
      var x = X(p.date), lo = p.lo != null ? p.lo : nr.lo, hi = p.hi != null ? p.hi : nr.hi;
      if (p.lo != null || p.hi != null) root.appendChild(titled(svg("rect", { x: x - 16, y: Y(hi), width: 32, height: Math.max(2, Y(lo) - Y(hi)), rx: 4, class: "c-band" }), "Range on this report: " + (p.refText || (p.lo != null ? p.lo : "") + " to " + (p.hi != null ? p.hi : ""))));
    });
    var d = ""; pts.forEach(function (p, i) { d += (i ? "L" : "M") + X(p.date).toFixed(1) + " " + Y(p.v).toFixed(1); }); if (pts.length > 1) root.appendChild(svg("path", { d: d, class: "c-line s0", pathLength: "1" }));
    pts.forEach(function (p) { root.appendChild(titled(marker(p.pos === "above" ? "up" : p.pos === "below" ? "down" : p.pos === "norange" ? "diamond" : "circle", X(p.date), Y(p.v), 4.2, "c-dot pos-" + p.pos), p.date + ": " + p.v + " " + o.unit + ", " + p.text)); root.appendChild(svg("text", { x: X(p.date), y: H - 8, class: "c-axis", "text-anchor": "middle" }, span > 330 ? p.date.slice(2, 7) : p.date.slice(5))); });
    return root;
  };
})();
