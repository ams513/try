/* Stark Resonance: physics cores. Pure functions, no DOM, no network. The simulations draw these; the node tests check them
   against textbook results. Every model is a simplification and says so in the app (see sims.js). SI units unless stated. */
(function (root) {
  "use strict";
  var TAU = Math.PI * 2;

  // ---------- generic RK4 for small state arrays ----------
  function rk4(fn, t, s, dt) {
    var n = s.length, i, a, b, c, d, tmp = new Array(n), out = new Array(n);
    a = fn(t, s);
    for (i = 0; i < n; i++) tmp[i] = s[i] + 0.5 * dt * a[i];
    b = fn(t + dt / 2, tmp);
    for (i = 0; i < n; i++) tmp[i] = s[i] + 0.5 * dt * b[i];
    c = fn(t + dt / 2, tmp);
    for (i = 0; i < n; i++) tmp[i] = s[i] + dt * c[i];
    d = fn(t + dt, tmp);
    for (i = 0; i < n; i++) out[i] = s[i] + dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6;
    return out;
  }

/* full version only */
/* full version only */
  // ---------- 3. rotating magnetic field and the induction motor ----------
  function coilAxes(mode) { return mode === "three" ? [0, 2 * Math.PI / 3, 4 * Math.PI / 3] : mode === "two" ? [0, Math.PI / 2] : [0]; }
  function phaseCurrents(mode, phiRad, wt) {
    if (mode === "three") return [Math.cos(wt), Math.cos(wt - 2 * Math.PI / 3), Math.cos(wt - 4 * Math.PI / 3)];
    if (mode === "two") return [Math.cos(wt), Math.cos(wt - phiRad)];
    return [Math.cos(wt)];
  }
  function fieldVector(mode, phiRad, wt) {
    var ax = coilAxes(mode), cur = phaseCurrents(mode, phiRad, wt), x = 0, y = 0, i;
    for (i = 0; i < ax.length; i++) { x += cur[i] * Math.cos(ax[i]); y += cur[i] * Math.sin(ax[i]); }
    return { x: x, y: y, mag: Math.hypot(x, y), ang: Math.atan2(y, x), cur: cur };
  }
  // Amplitudes of the forward and backward rotating parts, relative to the field a balanced supply makes in that winding.
  function rotatingParts(mode, phiRad) {
    if (mode === "three") return { F: 1, B: 0 };
    if (mode === "two") return { F: Math.sqrt((1 + Math.sin(phiRad)) / 2), B: Math.sqrt((1 - Math.sin(phiRad)) / 2) };
    return { F: 0.5, B: 0.5 };
  }
  // Kloss form of the induction-motor torque: T = 2 Tmax / (s/sm + sm/s); zero at s = 0, peak Tmax at s = sm.
  function klossTorque(s, sm, Tmax) { return s === 0 ? 0 : 2 * Tmax / (s / sm + sm / s); }
  // Net torque with a forward and a backward field (double-revolving-field picture). n = rotor speed / synchronous speed.
  function motorTorque(n, parts, sm, Tmax) {
    var s = 1 - n;
    return parts.F * parts.F * klossTorque(s, sm, Tmax) - parts.B * parts.B * klossTorque(2 - s, sm, Tmax);
  }
  function rotorStep(n, load, parts, sm, Tmax, J, dt) {
    function f(x) { return (motorTorque(x, parts, sm, Tmax) - load) / J; }
    var a = f(n), b = f(n + 0.5 * dt * a), c = f(n + 0.5 * dt * b), d = f(n + dt * c);
    var nn = n + dt * (a + 2 * b + 2 * c + d) / 6;
    return Math.max(-0.2, Math.min(1.2, nn));
  }
  // Steady slip for a load below breakdown: s = sm (r - sqrt(r^2 - 1)), r = Tmax / load
  function steadySlip(load, sm, Tmax) { var r = Tmax / load; return r < 1 ? NaN : sm * (r - Math.sqrt(r * r - 1)); }

/* full version only */
  var api = {
    TAU: TAU, rk4: rk4,
    /* full version only */
    /* full version only */
    coilAxes: coilAxes, phaseCurrents: phaseCurrents, fieldVector: fieldVector, rotatingParts: rotatingParts, klossTorque: klossTorque, motorTorque: motorTorque, rotorStep: rotorStep, steadySlip: steadySlip,
    /* full version only */
    /* full version only */
    /* full version only */
    /* full version only */
    /* full version only */
  };
  root.StarkPhysics = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
