/* Stark IntraTheater by Stark. Orbit Lab physics: pure functions with no DOM, shared by the app and the node tests.
   One planet (fixed at the origin) and one moon, Newtonian gravity, velocity-Verlet steps (energy stays steady over many orbits).
   Units are "screen" units: distance in pixels, GM chosen so a circular orbit at 120 px takes about 6 seconds. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SIT = G.SIT = G.SIT || {};
  const GM = 1.9e6, R_PLANET = 26, R_ESCAPE = 900, MAX_TRAIL = 240;

  const acc = (x, y) => { const r2 = x * x + y * y, r = Math.sqrt(r2), k = -GM / (r2 * r); return [k * x, k * y]; };
  /* one velocity-Verlet step of dt seconds; returns a NEW state */
  function step(s, dt) {
    const a0 = acc(s.x, s.y);
    const x = s.x + s.vx * dt + 0.5 * a0[0] * dt * dt, y = s.y + s.vy * dt + 0.5 * a0[1] * dt * dt;
    const a1 = acc(x, y);
    return { x, y, vx: s.vx + 0.5 * (a0[0] + a1[0]) * dt, vy: s.vy + 0.5 * (a0[1] + a1[1]) * dt, t: (s.t || 0) + dt };
  }
  /* advances by `secs` in fixed sub-steps (stable at any frame rate); stops early on a crash or an escape */
  function advance(s, secs, sub) {
    const n = Math.max(1, Math.min(2000, Math.ceil(secs / (sub || 1 / 240)))), dt = secs / n;
    for (let i = 0; i < n; i++) { s = step(s, dt); const st = status(s); if (st !== 'orbit') return Object.assign(s, { status: st }); }
    return Object.assign(s, { status: 'orbit' });
  }
  const energy = s => 0.5 * (s.vx * s.vx + s.vy * s.vy) - GM / Math.hypot(s.x, s.y);
  function status(s) {
    const r = Math.hypot(s.x, s.y);
    if (r <= R_PLANET) return 'crash';
    if (r >= R_ESCAPE && energy(s) >= 0) return 'escape';
    return 'orbit';
  }
  /* the orbit's shape from one position and velocity: eccentricity, closest and farthest distance, period (null if not bound) */
  function orbitInfo(s) {
    const r = Math.hypot(s.x, s.y), v2 = s.vx * s.vx + s.vy * s.vy, E = 0.5 * v2 - GM / r;
    const hz = s.x * s.vy - s.y * s.vx;
    const ex = (s.vy * hz) / GM - s.x / r, ey = (-s.vx * hz) / GM - s.y / r, e = Math.hypot(ex, ey);
    if (E >= 0) return { bound: false, e, peri: (hz * hz / GM) / (1 + e), apo: null, period: null };
    const a = -GM / (2 * E);
    return { bound: true, e, a, peri: a * (1 - e), apo: a * (1 + e), period: 2 * Math.PI * Math.sqrt(a * a * a / GM) };
  }
  /* velocity for a circular orbit at the moon's current distance (perpendicular to the radius, counter-clockwise) */
  function circularVelocity(x, y) { const r = Math.hypot(x, y), v = Math.sqrt(GM / r); return { vx: -y / r * v, vy: x / r * v }; }
  const kind = info => !info.bound ? 'escape' : info.e < 0.05 ? 'circle' : info.peri <= R_PLANET ? 'crash' : 'ellipse';
  function presets() {
    const c = circularVelocity(120, 0);
    return {
      circle: { x: 120, y: 0, vx: c.vx, vy: c.vy, t: 0 },
      ellipse: { x: 160, y: 0, vx: 0, vy: Math.sqrt(GM / 160) * 0.75, t: 0 },
      escape: { x: 120, y: 0, vx: 0, vy: Math.sqrt(2 * GM / 120) * 1.08, t: 0 }
    };
  }
  /* a fling: drag from the moon gives a velocity proportional to the drag, capped so a wild swipe stays on screen */
  function fling(x, y, dx, dy) { const k = 2.2, vmax = 260; let vx = dx * k, vy = dy * k; const v = Math.hypot(vx, vy); if (v > vmax) { vx *= vmax / v; vy *= vmax / v; } return { x, y, vx, vy, t: 0 }; }
  /* a bounded trail: newest point last, never more than MAX_TRAIL points */
  function pushTrail(trail, x, y) { trail.push(x, y); if (trail.length > MAX_TRAIL * 2) trail.splice(0, trail.length - MAX_TRAIL * 2); return trail; }

  SIT.orbitlab = { GM, R_PLANET, R_ESCAPE, MAX_TRAIL, step, advance, energy, status, orbitInfo, circularVelocity, kind, presets, fling, pushTrail };
})();
