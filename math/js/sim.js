/* Stark Math 1.3: live physics simulators. A projectile launcher (any planet, optional air drag, a target to hit)
   and a pendulum (small-angle formula against the exact period). The exact formulas come first; the animation is a
   numerical simulation (fourth-order Runge-Kutta) drawn next to them, so learners see where a formula holds and where
   it stops being true. The engine part runs under node for the tests. */
(function (G) {
  'use strict';
  const SM = G.SM = G.SM || {};
  const RAD = Math.PI / 180;
  const PLANETS = [['earth', 'Earth', 9.81], ['moon', 'Moon', 1.62], ['mars', 'Mars', 3.71], ['jupiter', 'Jupiter', 24.79]];

  /** Exact no-drag projectile from height h0 (m), speed v (m/s), angle deg, gravity g (m/s^2). */
  function projectile(v, deg, g, h0) {
    h0 = h0 || 0;
    const vx = v * Math.cos(deg * RAD), vy = v * Math.sin(deg * RAD);
    const t = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
    return { t, range: vx * t, hMax: h0 + (vy > 0 ? vy * vy / (2 * g) : 0), tPeak: vy > 0 ? vy / g : 0 };
  }
  /** Numerical flight with quadratic air drag k (1/m: drag acceleration = k |v| v). RK4, landing interpolated. */
  function fly(v, deg, g, h0, k, dt) {
    k = k || 0; dt = dt || 0.002; h0 = h0 || 0;
    const f = s => { const sp = Math.hypot(s[2], s[3]); return [s[2], s[3], -k * sp * s[2], -g - k * sp * s[3]]; };
    const add = (s, d, m) => s.map((x, i) => x + d[i] * m);
    let s = [0, h0, v * Math.cos(deg * RAD), v * Math.sin(deg * RAD)], t = 0, hMax = h0;
    const pts = [[0, h0]], every = Math.max(1, Math.round(0.02 / dt));
    for (let i = 1; i < 2e6; i++) {
      const k1 = f(s), k2 = f(add(s, k1, dt / 2)), k3 = f(add(s, k2, dt / 2)), k4 = f(add(s, k3, dt));
      const n = s.map((x, j) => x + dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      t += dt;
      if (n[1] < 0 && (n[3] < 0 || i > 1)) { const a = s[1] / (s[1] - n[1]); const x = s[0] + a * (n[0] - s[0]); pts.push([x, 0]); return { pts, range: x, hMax, t: t - dt + a * dt }; }
      s = n; if (s[1] > hMax) hMax = s[1];
      if (i % every === 0) pts.push([s[0], s[1]]);
    }
    return { pts, range: s[0], hMax, t };
  }
  /** Arithmetic-geometric mean: the exact pendulum period is T0 / agm(1, cos(theta0 / 2)). */
  function agm(a, b) { for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) { const m = (a + b) / 2; b = Math.sqrt(a * b); a = m; } return a; }
  function pendulum(L, g, deg) {
    const small = 2 * Math.PI * Math.sqrt(L / g), exact = small / agm(1, Math.cos(deg * RAD / 2));
    return { small, exact, errorPct: (exact - small) / exact * 100 };
  }
  /** Angle (radians) of a pendulum after time t, by RK4 on theta'' = -(g / L) sin theta. */
  function swing(L, g, deg, t, dt) {
    dt = dt || 0.001; let th = deg * RAD, w = 0;
    const a = x => -(g / L) * Math.sin(x);
    for (let s = 0; s < t - 1e-12; s += dt) {
      const h = Math.min(dt, t - s);
      const k1t = w, k1w = a(th), k2t = w + k1w * h / 2, k2w = a(th + k1t * h / 2), k3t = w + k2w * h / 2, k3w = a(th + k2t * h / 2), k4t = w + k3w * h, k4w = a(th + k3t * h);
      th += h / 6 * (k1t + 2 * k2t + 2 * k3t + k4t); w += h / 6 * (k1w + 2 * k2w + 2 * k3w + k4w);
    }
    return th;
  }
  /** Launch angles (degrees) that land exactly at distance d on flat ground, or [] when out of reach. */
  function anglesFor(v, g, d) {
    const s = g * d / (v * v); if (s > 1 || d <= 0) return [];
    const a = Math.asin(s) / 2 / RAD; return a === 45 ? [45] : [a, 90 - a];
  }
  /** How close a prediction is, in words, using relative error. */
  function judge(pred, truth) {
    const e = Math.abs(pred - truth) / Math.max(1e-9, Math.abs(truth));
    return e <= 0.02 ? 'spot on' : e <= 0.1 ? 'close' : 'off';
  }
  SM.sim = { PLANETS, projectile, fly, pendulum, swing, anglesFor, judge, agm };

  /* =================================== screen (browser only) =================================== */
  if (typeof document === 'undefined' || !SM.views || !SM.h) return;
  const { h, btn } = SM, V = SM.views;
  const cssVar = (n, d) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d);
  const r2 = x => (Math.round(x * 100) / 100).toString();
  const slider = (id, label, min, max, step, val, unit) => {
    const out = h('output', { for: id, id: id + '-o' }, val + ' ' + unit), inp = h('input', { type: 'range', id, min, max, step, value: val });
    inp.addEventListener('input', () => { out.textContent = inp.value + ' ' + unit; });
    return { inp, el: h('label', { for: id, class: 'sim-sl' }, h('span', null, label), inp, out) };
  };

  V.sim = function (main) {
    let anim = 0, target = 0;
    const live = h('p', { id: 'sim-live', class: 'sim-live', role: 'status', 'aria-live': 'polite' });
    const planet = h('select', { id: 'sim-planet' }, PLANETS.map(p => h('option', { value: p[0] }, p[1] + ' (g = ' + p[2] + ' m/s²)')));
    const sv = slider('sim-v', 'Launch speed', 2, 60, 1, 20, 'm/s'), sa = slider('sim-a', 'Angle', 5, 85, 1, 45, '°'), sh = slider('sim-h', 'Launch height', 0, 30, 1, 0, 'm'), sk = slider('sim-k', 'Air drag', 0, 0.05, 0.005, 0, '/m');
    const pred = h('input', { id: 'sim-pred', type: 'text', inputmode: 'decimal', autocomplete: 'off', maxlength: 12, 'aria-describedby': 'sim-pred-help' });
    const canvas = h('canvas', { id: 'sim-canvas', class: 'lab-plot sim-canvas', role: 'img', 'aria-label': 'Projectile path. The result is also written below the picture.' });
    const formulas = h('div', { class: 'card sim-eq', id: 'sim-eq' });
    const g = () => PLANETS.find(p => p[0] === planet.value)[2];
    function draw(path, ideal, upto) {
      const W = canvas.clientWidth || 640, H = Math.round(W * 0.45), dpr = G.devicePixelRatio || 1; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
      const c = canvas.getContext('2d'); if (!c) return; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = cssVar('--surface', '#16201c'); c.fillRect(0, 0, W, H);
      const all = ideal.pts.concat(path.pts), xm = Math.max(target * 1.1, ...all.map(p => p[0]), 1), ym = Math.max(...all.map(p => p[1]), 1) * 1.15, s = Math.min((W - 40) / xm, (H - 30) / ym);
      const X = x => 20 + x * s, Y = y => H - 18 - y * s;
      c.strokeStyle = cssVar('--border-strong', '#5d6e66'); c.lineWidth = 1; c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(W, Y(0)); c.stroke();
      if (target) { c.fillStyle = cssVar('--gold', '#d9a441'); c.fillRect(X(target) - 2, Y(0) - 26, 3, 26); c.beginPath(); c.moveTo(X(target) + 1, Y(0) - 26); c.lineTo(X(target) + 16, Y(0) - 20); c.lineTo(X(target) + 1, Y(0) - 14); c.fill(); }
      const line = (pts, col, dash, n) => { c.strokeStyle = col; c.setLineDash(dash); c.lineWidth = 2.5; c.beginPath(); pts.slice(0, n).forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])))); c.stroke(); c.setLineDash([]); };
      if (sk.inp.value > 0) line(ideal.pts, cssVar('--muted', '#9fb0a6'), [6, 6], ideal.pts.length);
      const n = Math.min(path.pts.length, upto), p = path.pts[n - 1];
      line(path.pts, cssVar('--accent', '#a99cf0'), [], n);
      c.fillStyle = cssVar('--pic3', '#f0b35e'); c.beginPath(); c.arc(X(p[0]), Y(p[1]), 6, 0, 7); c.fill();
    }
    function run() {
      cancelAnimationFrame(anim);
      const v = +sv.inp.value, a = +sa.inp.value, h0 = +sh.inp.value, k = +sk.inp.value, gg = g();
      const ex = projectile(v, a, gg, h0), ideal = fly(v, a, gg, h0, 0), path = k ? fly(v, a, gg, h0, k) : ideal;
      SM.clear(formulas).append(h('h2', null, 'The exact formulas (no air)'),
        h('p', { html: SM.renderText('Time of flight $t = (v sin θ + sqrt(v^2 sin^2 θ + 2 g h)) / g$ = ' + r2(ex.t) + ' s') }),
        h('p', { html: SM.renderText('Range $R = v cos θ · t$ = ' + r2(ex.range) + ' m. Highest point $h + v^2 sin^2 θ / (2 g)$ = ' + r2(ex.hMax) + ' m.') }),
        k ? h('p', null, 'With air drag the simulation lands at ' + r2(path.range) + ' m, ' + Math.round((1 - path.range / ex.range) * 100) + '% short of the no-air formula: real balls fall short, and the best angle drops below 45°.') : h('p', { class: 'muted' }, 'With no air, the simulation agrees with the formula to ' + r2(Math.abs(ideal.range - ex.range)) + ' m.'));
      let msg = 'Landed at ' + r2(path.range) + ' m after ' + r2(path.t) + ' s, highest point ' + r2(path.hMax) + ' m.';
      const pv = parseFloat(String(pred.value).replace(',', '.'));
      if (isFinite(pv) && pred.value.trim()) msg += ' Your prediction ' + r2(pv) + ' m was ' + judge(pv, path.range) + '.';
      if (target) msg += Math.abs(path.range - target) <= Math.max(0.5, target * 0.02) ? ' Target hit!' : ' Target at ' + r2(target) + ' m: ' + (path.range < target ? 'short' : 'long') + ' by ' + r2(Math.abs(path.range - target)) + ' m.';
      if (SM.reduceMotion()) { draw(path, ideal, path.pts.length); live.textContent = msg; return; }
      let i = 2; const step = () => { draw(path, ideal, i); i += 3; if (i < path.pts.length + 3) anim = requestAnimationFrame(step); else live.textContent = msg; };
      live.textContent = ''; step();
    }
    function newTarget() {
      const gg = g(), vmax = +sv.inp.max * 0.8; target = Math.round((8 + Math.random() * (vmax * vmax / gg - 8)) * 2) / 2;
      sk.inp.value = 0; sk.inp.dispatchEvent(new Event('input')); sh.inp.value = 0; sh.inp.dispatchEvent(new Event('input'));
      /* set the scene without launching, so the announcement stands and the learner predicts before seeing a flight */
      cancelAnimationFrame(anim); const still = fly(+sv.inp.value, +sa.inp.value, gg, 0, 0); draw(still, still, 1);
      live.textContent = 'New target at ' + r2(target) + ' m on ' + planet.selectedOptions[0].textContent.split(' (')[0] + '. Pick a speed and angle, predict, then launch.';
    }
    function hint() {
      if (!target) return; const v = +sv.inp.value, a = anglesFor(v, g(), target);
      live.textContent = a.length ? 'At ' + v + ' m/s, angles of ' + a.map(x => r2(x) + '°').join(' or ') + ' reach the target (no air, flat ground): solve sin 2θ = g d / v².' : 'At ' + v + ' m/s the target is out of reach: the longest flat-ground range is v² / g = ' + r2(v * v / g()) + ' m. Go faster.';
    }
    /* pendulum */
    const pl = slider('pd-l', 'Length', 0.2, 5, 0.1, 1, 'm'), pa = slider('pd-a', 'Release angle', 5, 170, 5, 20, '°');
    const pOut = h('div', { id: 'pd-out' }), pCanvas = h('canvas', { class: 'lab-plot sim-canvas', role: 'img', 'aria-label': 'Pendulum swinging. The periods are written next to it.' });
    let pAnim = 0, t0 = 0;
    const stopBtn = btn('Stop', () => { cancelAnimationFrame(pAnim); pAnim = 0; stopBtn.disabled = true; }, 'btn-ghost');
    stopBtn.disabled = true;
    /* The pendulum only moves after Release (WCAG 2.2.2: nothing moves on its own), and Stop halts it. */
    function pend(e, still) {
      cancelAnimationFrame(pAnim); pAnim = 0; stopBtn.disabled = true;
      const L = +pl.inp.value, a = +pa.inp.value, gg = g(), r = pendulum(L, gg, a);
      SM.clear(pOut).append(h('p', { html: SM.renderText('Small-angle formula $T ≈ 2π sqrt(L / g)$ = ' + r2(r.small) + ' s') }), h('p', null, 'Exact period at ' + a + '° = ' + r2(r.exact) + ' s (the formula is ' + r2(r.errorPct) + '% short). ' + (r.errorPct < 1 ? 'Below about 20° the shortcut is excellent.' : 'Big swings take longer than the shortcut says.')));
      const draw = th => {
        const W = pCanvas.clientWidth || 320, H = Math.round(W * 0.55), dpr = G.devicePixelRatio || 1; pCanvas.width = W * dpr; pCanvas.height = H * dpr; pCanvas.style.height = H + 'px';
        const c = pCanvas.getContext('2d'); if (!c) return; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = cssVar('--surface', '#16201c'); c.fillRect(0, 0, W, H);
        const R = (H - 30) * (a > 90 ? 0.5 : 0.9), ox = W / 2, oy = a > 90 ? H / 2 : 14, x = ox + R * Math.sin(th), y = oy + R * Math.cos(th);
        c.strokeStyle = cssVar('--muted', '#9fb0a6'); c.lineWidth = 2; c.beginPath(); c.moveTo(ox, oy); c.lineTo(x, y); c.stroke();
        c.fillStyle = cssVar('--accent', '#a99cf0'); c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill();
      };
      if (still || SM.reduceMotion()) { draw(a * RAD); return; }
      t0 = performance.now(); let th = a * RAD, w = 0, last = t0;
      const step = now => { let dt = Math.min(0.05, (now - last) / 1000); last = now; while (dt > 0) { const s = Math.min(dt, 0.002); w += -(gg / L) * Math.sin(th) * s; th += w * s; dt -= s; } draw(th); if (document.body.contains(pCanvas)) pAnim = requestAnimationFrame(step); else { pAnim = 0; } };
      stopBtn.disabled = false; pAnim = requestAnimationFrame(step);
    }
    const pendStill = () => pend(null, true);
    [sv, sa, sh, sk].forEach(x => x.inp.addEventListener('change', run));
    [pl, pa].forEach(x => x.inp.addEventListener('change', pendStill));
    planet.addEventListener('change', () => { run(); pendStill(); });
    main.append(h('div', { class: 'page-head' }, h('h1', null, 'Physics simulators'), h('p', { class: 'muted' }, 'Change a slider, predict, then launch. The exact formula sits next to a step-by-step simulation, so you can see where the formula holds and where real air makes it wrong.')),
      h('section', { class: 'card' }, h('h2', null, 'Projectile launcher'),
        h('div', { class: 'sim-grid' }, h('label', { for: 'sim-planet', class: 'sim-sl' }, h('span', null, 'Planet'), planet), sv.el, sa.el, sh.el, sk.el,
          h('label', { for: 'sim-pred', class: 'sim-sl' }, h('span', null, 'Your predicted range (m)'), pred), h('p', { id: 'sim-pred-help', class: 'muted' }, 'Optional: type a guess before you launch and Madeline\'s rules say how close it was.')),
        h('div', { class: 'row wrap' }, btn('Launch', run, 'btn-primary'), btn('New target', newTarget), btn('Angle hint', hint)), canvas, live, formulas),
      h('section', { class: 'card' }, h('h2', null, 'Pendulum'), h('div', { class: 'sim-grid' }, pl.el, pa.el), h('div', { class: 'row wrap' }, btn('Release', () => pend(), 'btn-primary'), stopBtn), pCanvas, pOut));
    run(); pendStill();
  };
})(typeof window !== 'undefined' ? window : globalThis);
