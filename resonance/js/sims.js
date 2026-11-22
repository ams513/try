/* Stark Resonance: the interactive simulations. Each one is a definition (controls, text, guided experiment) plus a factory that
   returns {step(dt), draw(g,w,h), read(), act(id), aria()}. The physics lives in physics.js and is tested there. Canvas only; no network. */
(function (root) {
  "use strict";
  var P = root.StarkPhysics, TAU = P.TAU, SIMS = [];

  // ---------- drawing helpers ----------
  var C = { bg: "#0b1119", panel: "#101a26", grid: "#1d2b3b", text: "#e7eef7", mute: "#8fa3b8", a: "#4cc9f0", b: "#ffb454", c: "#f472b6", d: "#7ee0a1", e: "#8ea2ff", bad: "#ff6b6b" };
  var H = {
    theme: function () {
      if (typeof document === "undefined") return;
      var cs = getComputedStyle(document.documentElement), get = function (n, d) { return (cs.getPropertyValue(n) || "").trim() || d; };
      C.bg = get("--cv-bg", C.bg); C.panel = get("--cv-panel", C.panel); C.grid = get("--cv-grid", C.grid); C.text = get("--cv-text", C.text); C.mute = get("--cv-mute", C.mute);
      C.a = get("--cv-a", C.a); C.b = get("--cv-b", C.b); C.c = get("--cv-c", C.c); C.d = get("--cv-d", C.d); C.e = get("--cv-e", C.e); C.bad = get("--cv-bad", C.bad);
    },
    C: C,
    px: function (w) { return Math.max(11, Math.min(14, Math.round(w / 62))); },
    txt: function (g, s, x, y, col, px, align, weight) { g.font = (weight || 500) + " " + px + "px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"; g.fillStyle = col || C.mute; g.textAlign = align || "left"; g.textBaseline = "middle"; g.fillText(s, x, y); },
    poly: function (g, pts, col, lw, dash) { var i; if (pts.length < 2) return; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.strokeStyle = col; g.lineWidth = lw || 2; g.setLineDash(dash || []); g.lineJoin = "round"; g.stroke(); g.setLineDash([]); },
    panel: function (g, x, y, w, h) { g.fillStyle = C.panel; g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 10); else g.rect(x, y, w, h); g.fill(); g.stroke(); },
    glow: function (g, x, y, r, col, alpha) { var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, alpha)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); },
    arrow: function (g, x0, y0, x1, y1, col, lw) {
      var a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0), hs = Math.min(10, L * 0.45);
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw || 2.5; g.lineCap = "round"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(a) * hs * 0.6, y1 - Math.sin(a) * hs * 0.6); g.stroke();
      if (L < 2) return; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - hs * Math.cos(a - 0.45), y1 - hs * Math.sin(a - 0.45)); g.lineTo(x1 - hs * Math.cos(a + 0.45), y1 - hs * Math.sin(a + 0.45)); g.closePath(); g.fill();
    },
    ring: function (n) { var b = new Float32Array(n), r = { b: b, n: n, h: 0, len: 0, push: function (v) { b[r.h] = v; r.h = (r.h + 1) % n; if (r.len < n) r.len++; }, at: function (i) { return b[(r.h - r.len + i + n * 2) % n]; } }; return r; },
    fmt: function (v, d) { return (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0)) ? v.toExponential(d == null ? 2 : d) : v.toFixed(d == null ? 2 : d); },
    si: function (v, unit) {
      var a = Math.abs(v), p = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "u"], [1e-9, "n"]], i;
      if (a === 0) return "0 " + unit; for (i = 0; i < p.length; i++) if (a >= p[i][0] * 0.9995) return (v / p[i][0]).toPrecision(3).replace(/\.?0+$/, function (m) { return m.indexOf(".") === 0 ? "" : m; }) + " " + p[i][1] + unit;
      return v.toExponential(2) + " " + unit;
    }
  };
  function rgba(hex, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return hex; var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  H.rgba = rgba;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function reg(d) { SIMS.push(d); }

  // axes box with tick labels; returns mapping helpers
  function axes(g, x, y, w, h, o) {
    var px = o.px || 11, i, t, tx, ty;
    g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath();
    for (i = 0; i < (o.xt || []).length; i++) { t = o.xt[i]; tx = x + o.fx(t[0]) * w; g.moveTo(tx, y); g.lineTo(tx, y + h); }
    for (i = 0; i < (o.yt || []).length; i++) { t = o.yt[i]; ty = y + h - o.fy(t[0]) * h; g.moveTo(x, ty); g.lineTo(x + w, ty); }
    g.stroke();
    g.strokeStyle = C.mute; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.lineTo(x + w, y + h); g.stroke();
    for (i = 0; i < (o.xt || []).length; i++) { t = o.xt[i]; H.txt(g, t[1], x + o.fx(t[0]) * w, y + h + px + 3, C.mute, px, "center"); }
    for (i = 0; i < (o.yt || []).length; i++) { t = o.yt[i]; H.txt(g, t[1], x - 6, y + h - o.fy(t[0]) * h, C.mute, px, "right"); }
    if (o.xl) H.txt(g, o.xl, x + w, y + h + px * 2 + 8, C.mute, px, "right");
    if (o.yl) H.txt(g, o.yl, x, y - px, C.mute, px, "left");
  }

  // ====================================================================================================
  // 1. Resonance
  // ====================================================================================================
  reg({
    id: "resonance", group: "tesla", title: "Resonance and the LC circuit", icon: "wave", blurb: "A coil and a capacitor trading energy at one natural rhythm.", controls: [], experiment: [] });
  reg({
    id: "coil", group: "tesla", title: "The Tesla coil as two linked circuits", icon: "coil", blurb: "Two tuned circuits linked by a magnetic field.", controls: [], experiment: [] });
  reg({
    id: "field", group: "tesla", aspectN: 1.5, title: "Rotating magnetic field and the induction motor", icon: "motor",
    blurb: "Three coils, three currents each a third of a cycle apart, and a magnetic field that turns with no moving part. A plain metal rotor chases it.",
    plain: "Each coil's pull rises and falls like a sine wave. Give each coil its turn one third of a cycle after the last and the sum of their pulls is an arrow of constant length that sweeps around in a circle. A metal rotor feels the sweeping field, is dragged after it, and always turns a little slower than the field. That small lag is called slip, and without it there is no push at all.",
    eq: ["i_k = I0 cos(w t - k 120 deg),   B = sum_k i_k u_k", "|B| = 1.5 I0 at every instant (three coils)", "n_sync = 60 f / p      slip s = 1 - n / n_sync", "T = 2 Tmax / (s / s_m + s_m / s)   (Kloss form)", "J dn/dt = T - T_load"],
    model: "Coil currents are summed as vectors. The rotor is one lumped speed following the Kloss torque curve, with a forward and a backward rotating part so that two-coil and single-coil supplies behave correctly (double revolving field).",
    limits: ["The rotor and stator are not modelled in detail: no magnetic saturation, no harmonics, no heating, no per-phase circuit. Torque is the standard Kloss approximation scaled in multiples of rated torque.", "Animation is slowed 125 times: a real 50 Hz field makes 50 turns per second.", "The one pole pair shown gives 3000 rpm at 50 Hz. Real motors often use more pole pairs and run slower."],
    controls: [
      { id: "mode", type: "select", label: "Supply", val: "three", options: [["three", "Three coils, 120 deg apart"], ["two", "Two coils, 90 deg apart"], ["one", "One coil only"]] },
      { id: "phi", label: "Phase shift of the second coil (two-coil supply)", unit: "deg", min: 0, max: 180, step: 1, val: 90, dec: 0, show: function (p) { return p.mode === "two"; } },
      { id: "f", label: "Supply frequency", unit: "Hz", min: 25, max: 60, step: 1, val: 50, dec: 0 },
      { id: "load", label: "Load torque", unit: "x rated", min: 0, max: 2.8, step: 0.05, val: 0.6, dec: 2 },
      { id: "rr", label: "Rotor resistance", unit: "relative", min: 0.5, max: 2.5, step: 0.05, val: 1, dec: 2 },
      { id: "kick", type: "button", label: "Stop the rotor and restart" }
    ],
    experiment: [
      { say: "Three coils, light load. The white arrow stays the same length while it sweeps around. The rotor follows with a small slip.", set: { mode: "three", load: 0.6, f: 50, rr: 1 }, expect: "|B| reads 1.50 at every moment; slip is about 3.7 percent." },
      { say: "Raise the load to 1.0 (rated). The rotor slows a little more: slip is what makes torque.", set: { load: 1.0 }, expect: "Slip rises from about 3.7 to about 6.3 percent; speed stays below the field speed." },
      { say: "Push the load past 2.5. The motor stalls: the peak (breakdown) torque is the most it can give.", set: { load: 2.8 }, expect: "The rotor decelerates to a stop; torque cannot reach the load." },
      { say: "Switch to one coil only and press restart. The field only pulses along one line: it has no starting torque.", set: { mode: "one", load: 0.1 }, expect: "|B| swings between 0 and 1 and the rotor does not start from rest (a spinning rotor can keep running)." },
      { say: "Two coils: at 90 degrees the field is a circle again. Drag the shift toward 0 and it flattens into a pulsing line.", set: { mode: "two", phi: 90, load: 0.6 }, expect: "At 90 degrees the field is constant; at 0 degrees it pulses like the single coil." }
    ],
    make: function (p) {
      var n = 0, wt = 0, thr = 0, thf = 0, bt = H.ring(1), lastT = 0;
      function parts() { return P.rotatingParts(p.mode, p.phi * Math.PI / 180); }
      function sm() { return 0.3 * p.rr; }
      return {
        reset: function () { n = 0; thr = 0; },
        act: function (id) { if (id === "kick") { n = 0; return {}; } },
        step: function (dt) {
          var rate = p.f / 125 * TAU, k, steps = Math.ceil(dt / 0.002), h = dt / steps;
          for (k = 0; k < steps; k++) { n = P.rotorStep(n, p.load, parts(), sm(), 2.5, 0.8, h); }
          wt = (wt + dt * rate) % (TAU * 1000);   // electrical angle, at the slowed-down rate
          thf += dt * rate; thr += dt * rate * n;
          lastT = P.motorTorque(n, parts(), sm(), 2.5);
        },
        read: function () {
          var pt = parts(), b = P.fieldVector(p.mode, p.phi * Math.PI / 180, wt), ns = 60 * p.f, tot = pt.F * pt.F + pt.B * pt.B;
          return [["Field strength |B|", b.mag.toFixed(2) + " x one coil's peak"], ["Field speed", ns.toFixed(0) + " rpm"], ["Rotor speed", (n * ns).toFixed(0) + " rpm"], ["Slip", ((1 - n) * 100).toFixed(1) + " %"],
            ["Motor torque", lastT.toFixed(2) + " x rated (load " + p.load.toFixed(2) + ")"], ["Rotating forward / backward", tot > 0 ? (pt.F * pt.F / tot * 100).toFixed(0) + " % / " + (pt.B * pt.B / tot * 100).toFixed(0) + " %" : "n/a"]];
        },
        data: function () {   // the plot on screen: coil currents and field strength over one electrical cycle (121 points)
          var phi = p.phi * Math.PI / 180, ax = P.coilAxes(p.mode), rows = [], k, i, a, cur, row, now = (wt % TAU + TAU) % TAU;
          var cols = [{ label: "Electrical angle", unit: "deg", doc: "Angle of the supply cycle, 0 to 360 degrees." }], series = [];
          for (i = 0; i < ax.length; i++) { cols.push({ label: "Coil " + "ABC"[i] + " current", unit: "x I0", doc: "Current in coil " + "ABC"[i] + " divided by its peak value I0." }); series.push({ col: i + 1, label: "Coil " + "ABC"[i] }); }
          cols.push({ label: "Field strength |B|", unit: "x one coil's peak", doc: "Length of the summed field arrow, in multiples of the peak field of one coil." }); series.push({ col: ax.length + 1, label: "Field |B|" });
          for (k = 0; k <= 120; k++) { a = k / 120 * TAU; cur = P.phaseCurrents(p.mode, phi, a); row = [k * 3]; for (i = 0; i < ax.length; i++) row.push(Math.abs(cur[i]) < 1e-12 ? 0 : cur[i]); row.push(P.fieldVector(p.mode, phi, a).mag); rows.push(row); }   // rounding dust such as 6e-17 is written as 0
          return { title: "Rotating field: coil currents and field strength over one cycle", kind: "line", x: 0, xmin: 0, xmax: 360, ymin: -1.5, ymax: 1.5, ylabel: "Currents (x I0) and field (x one coil's peak)", rows: rows, cols: cols, series: series,
            marker: { x: now * 180 / Math.PI, y: P.fieldVector(p.mode, phi, now).mag, label: "now" } };
        },
        aria: function () { return "Three coil currents sum to a magnetic field arrow. Mode " + p.mode + ". Rotor speed " + (n * 100).toFixed(0) + " percent of field speed."; },
        draw: function (g, w, h) {
          var px = H.px(w), narrow = w < 640, cx, cy, R, i, mode = p.mode, phi = p.phi * Math.PI / 180, ax = P.coilAxes(mode), fv = P.fieldVector(mode, phi, wt), cols = [C.a, C.b, C.c], sc;
          if (narrow) { cx = w / 2; R = Math.min(w * 0.4, h * 0.3); cy = R + px + 14; } else { R = Math.min(h * 0.38, w * 0.25); cx = w * 0.27; cy = h / 2; }
          sc = mode === "three" ? 1 / 1.5 : 1;
          H.glow(g, cx, cy, R * 1.25, C.e, 0.08 + 0.1 * fv.mag * sc);
          g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R * 1.05, 0, TAU); g.stroke();
          // rotor: disc with bars
          g.fillStyle = C.panel; g.strokeStyle = C.mute; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * 0.62, 0, TAU); g.fill(); g.stroke();
          for (i = 0; i < 4; i++) { var a = thr + i * Math.PI / 2; g.strokeStyle = i % 2 ? C.mute : C.d; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.12, cy + Math.sin(a) * R * 0.12); g.lineTo(cx + Math.cos(a) * R * 0.58, cy + Math.sin(a) * R * 0.58); g.stroke(); }
          g.fillStyle = C.mute; g.beginPath(); g.arc(cx, cy, 5, 0, TAU); g.fill();
          // coils
          for (i = 0; i < ax.length; i++) {
            var cur = fv.cur[i], ex = cx + Math.cos(ax[i]) * R * 1.05, ey = cy + Math.sin(ax[i]) * R * 1.05;
            g.fillStyle = C.panel; g.strokeStyle = cols[i]; g.lineWidth = 3; g.beginPath(); g.arc(ex, ey, 11, 0, TAU); g.fill(); g.stroke();
            H.txt(g, "ABC"[i], ex, ey, cols[i], 12, "center", 700);
            H.arrow(g, cx, cy, cx + Math.cos(ax[i]) * R * 0.9 * cur * (mode === "three" ? 0.55 : 0.8) * 1, cy + Math.sin(ax[i]) * R * 0.9 * cur * (mode === "three" ? 0.55 : 0.8), rgba(cols[i], 0.85), 3);
          }
          H.arrow(g, cx, cy, cx + fv.x * R * 0.62 * sc * 1.45, cy + fv.y * R * 0.62 * sc * 1.45, C.text, 4.5);
          H.txt(g, "field", cx + fv.x * R * 0.62 * sc * 1.45 + (fv.x >= 0 ? 6 : -6), cy + fv.y * R * 0.62 * sc * 1.45 - 10, C.text, px, fv.x >= 0 ? "left" : "right", 700);
          // plot: currents over one cycle with moving cursor, plus |B|
          var gx, gy, gw, gh; if (narrow) { gx = 40; gw = w - 52; gy = cy + R + 44; gh = h - gy - 24; } else { gx = w * 0.55; gw = w * 0.42; gy = px + 24; gh = h - gy - 40; }
          axes(g, gx, gy, gw, gh, { px: px, fx: function (v) { return v / TAU; }, fy: function (v) { return (v + 1.6) / 3.2; }, xt: [[0, "0"], [Math.PI, "180"], [TAU, "360"]], yt: [[0, "0"], [1.5, "1.5"], [-1, "-1"], [1, "1"]], yl: "Coil currents (colour) and field |B| (white), against angle in degrees" });
          var k, mm = []; for (k = 0; k <= 120; k++) { var a2 = k / 120 * TAU, v = P.fieldVector(mode, phi, a2); mm.push([gx + k / 120 * gw, gy + gh - (v.mag * sc * 1.5 + 1.6) / 3.2 * gh]); }
          for (i = 0; i < ax.length; i++) { var ln = []; for (k = 0; k <= 120; k++) ln.push([gx + k / 120 * gw, gy + gh - (P.phaseCurrents(mode, phi, k / 120 * TAU)[i] + 1.6) / 3.2 * gh]); H.poly(g, ln, rgba(cols[i], 0.9), 2); }
          var mm2 = []; for (k = 0; k <= 120; k++) { var vv = P.fieldVector(mode, phi, k / 120 * TAU).mag; mm2.push([gx + k / 120 * gw, gy + gh - (vv + 1.6) / 3.2 * gh]); }
          H.poly(g, mm2, C.text, 2.4, [5, 3]);
          var cxp = gx + ((wt % TAU) / TAU) * gw; g.strokeStyle = C.mute; g.beginPath(); g.moveTo(cxp, gy); g.lineTo(cxp, gy + gh); g.stroke();
        }
      };
    }
  });

  // ====================================================================================================
  // 4. AC versus DC transmission
  // ====================================================================================================
  reg({
    id: "grid", group: "tesla", title: "AC, DC and the high-voltage grid", icon: "grid", blurb: "How much of a power line's energy is lost along the way.", controls: [], experiment: [] });
  reg({
    id: "wireless", group: "tesla", title: "Wireless power and its short range", icon: "wireless", blurb: "Two resonant coils sharing power across a gap.", controls: [], experiment: [] });
  reg({
    id: "waves", group: "tesla", title: "Standing waves on a string or a line", icon: "string", blurb: "Shake one end and find the frequencies where the wave stands still.", controls: [], experiment: [] });
  reg({
    id: "memristor", group: "frontier", title: "The memristor, a resistor with memory", icon: "memory", blurb: "A device whose resistance depends on the current that has passed.", controls: [], experiment: [] });
  reg({
    id: "ledger", group: "tesla", title: "Possible or impossible machines", icon: "ledger", blurb: "Run a machine and account for every joule.", controls: [], experiment: [] });
  root.StarkSims = { list: SIMS, byId: function (id) { for (var i = 0; i < SIMS.length; i++) if (SIMS[i].id === id) return SIMS[i]; return null; }, H: H };
  if (typeof module !== "undefined" && module.exports) module.exports = root.StarkSims;
})(typeof window !== "undefined" ? window : globalThis);
