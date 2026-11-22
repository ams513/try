/* Stark IntraTheater by Stark. Orbit Lab (Science Explorer tab): fling a moon round a planet and watch real gravity shape its path.
   Live canvas with a predicted path, plain-words readouts, keyboard controls, and a still mode for reduced motion. */
(function () {
  'use strict';
  const { h } = SIT;
  const O = SIT.orbitlab;
  const W = 640, H = 420, CX = W / 2, CY = H / 2;
  const NAMES = { circle: 'a near-perfect circle', ellipse: 'an ellipse (an oval)', escape: 'an escape: it is flying away for good', crash: 'a crash course into the planet' };
  const reduce = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  function render(box) {
    const kid = !SIT.isGrown();
    let s = O.presets().circle, trail = [], path = [], paused = false, slow = false, raf = 0, lastT = 0, lastRead = 0, lastKind = '', laps = 0, prevAng = null, drag = null;
    const still = reduce();
    let pal = null;
    const readPal = () => { const cs = getComputedStyle(document.documentElement), g = (k, d) => cs.getPropertyValue(k).trim() || d; pal = { bg: g('--bg-2', '#1b1310'), gold: g('--gold-2', '#f7d888'), muted: g('--muted', '#c6b096'), line: g('--line', '#4a372c'), good: g('--good', '#79cf94'), text: g('--text', '#f5e9d6') }; };
    readPal();
    const canvas = h('canvas', { class: 'orb-canvas', width: String(W), height: String(H), tabindex: '0', role: 'application',
      'aria-label': 'Orbit Lab. Drag from anywhere to throw the moon. Keyboard: Left and Right turn the moon, Up and Down change its speed, Space pauses, and 1, 2, 3 pick a ready-made orbit.' });
    const read = h('p', { class: 'orb-read' });
    const say = h('p', { class: 'sr-only', 'aria-live': 'polite' });
    const lapEl = h('span', { class: 'badge' }, 'Laps: 0');
    const pauseBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => { paused = !paused; pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false'); pauseBtn.textContent = paused ? '▶️ Play' : '⏸️ Pause'; if (!paused) kick(); } }, '⏸️ Pause');
    const slowBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => { slow = !slow; slowBtn.setAttribute('aria-pressed', slow ? 'true' : 'false'); } }, '🐢 Slow motion');

    function predict() {
      path = []; const info = O.orbitInfo(s);
      const span = info.bound ? Math.min(info.period, 60) : 12, n = 360;
      let p = { x: s.x, y: s.y, vx: s.vx, vy: s.vy, t: 0 };
      for (let i = 0; i < n; i++) { p = O.advance(p, span / n); path.push(p.x, p.y); if (p.status !== 'orbit') break; }
    }
    function setState(n, why) { s = n; trail = []; laps = 0; prevAng = null; lapEl.textContent = 'Laps: 0'; predict(); readout(true); draw(); if (why) say.textContent = why; kick(); }
    function readout(force) {
      const info = O.orbitInfo(s), k = s.status && s.status !== 'orbit' ? s.status : O.kind(info), sp = Math.hypot(s.vx, s.vy);
      const bits = ['Shape: ' + NAMES[k]];
      if (!kid) bits.push('eccentricity ' + info.e.toFixed(2));
      if (info.bound && k !== 'crash') bits.push('one lap takes ' + info.period.toFixed(1) + ' s', 'closest ' + Math.round(info.peri) + ', farthest ' + Math.round(info.apo));
      bits.push('speed now ' + Math.round(sp));
      read.textContent = bits.join(' · ');
      if (force || k !== lastKind) { if (k !== lastKind) say.textContent = 'The orbit is ' + NAMES[k] + '.'; lastKind = k; }
    }
    function toScreen(x, y) { return [CX + x, CY + y]; }
    function draw() {
      const c = canvas.getContext('2d'); if (!c) return;
      c.fillStyle = pal.bg; c.fillRect(0, 0, W, H);
      c.strokeStyle = pal.line; c.globalAlpha = 0.6; c.setLineDash([4, 6]); c.beginPath();
      for (let i = 0; i < path.length; i += 2) { const p = toScreen(path[i], path[i + 1]); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
      c.stroke(); c.setLineDash([]);
      c.strokeStyle = pal.gold; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i < trail.length; i += 2) { const p = toScreen(trail[i], trail[i + 1]); c.globalAlpha = 0.15 + 0.85 * i / trail.length; if (i) { c.lineTo(p[0], p[1]); } else c.moveTo(p[0], p[1]); }
      c.stroke(); c.globalAlpha = 1; c.lineWidth = 1;
      c.fillStyle = pal.good; c.beginPath(); c.arc(CX, CY, O.R_PLANET, 0, 6.2832); c.fill();
      const m = toScreen(s.x, s.y); c.fillStyle = pal.text; c.beginPath(); c.arc(m[0], m[1], 7, 0, 6.2832); c.fill();
      c.strokeStyle = pal.gold; c.beginPath(); c.moveTo(m[0], m[1]); c.lineTo(m[0] + s.vx * 0.35, m[1] + s.vy * 0.35); c.stroke();
      if (drag) { c.strokeStyle = pal.text; c.setLineDash([2, 4]); c.beginPath(); c.moveTo(drag.x0, drag.y0); c.lineTo(drag.x1, drag.y1); c.stroke(); c.setLineDash([]); }
      if (s.status === 'crash' || s.status === 'escape') { c.fillStyle = pal.text; c.font = '600 16px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(s.status === 'crash' ? 'Bump! Throw it again.' : 'Gone into space! Throw it again.', CX, 28); c.textAlign = 'start'; }
    }
    function tick(t) {
      raf = 0;
      if (!canvas.isConnected) return;                   // the tab was left: stop for good
      const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0; lastT = t;
      if (!paused && dt > 0 && s.status !== 'crash' && s.status !== 'escape') {
        s = O.advance(s, dt * (slow ? 0.35 : 1)); O.pushTrail(trail, s.x, s.y); countLap();
        if (s.status !== 'orbit') readout(true);
      }
      if (t - lastRead > 250) { lastRead = t; readout(false); }
      draw();
      if (!paused && s.status !== 'crash' && s.status !== 'escape') raf = requestAnimationFrame(tick);
    }
    /* a lap is one crossing of the line to the right of the planet (shared by the live loop and Step mode) */
    function countLap() { if (prevAng !== null && s.x > 0 && (prevAng < 0) !== (s.y < 0)) { laps++; lapEl.textContent = 'Laps: ' + laps; } prevAng = s.y; }
    function kick() { if (still || raf || paused) return; lastT = 0; raf = requestAnimationFrame(tick); }
    function stepOnce(secs) { for (let i = 0; i < 8; i++) { s = O.advance(s, secs / 8); O.pushTrail(trail, s.x, s.y); countLap(); if (s.status !== 'orbit') break; } readout(true); draw(); }

    function local(ev) { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * H / r.height]; }
    canvas.addEventListener('pointerdown', ev => { const p = local(ev); if (Math.hypot(p[0] - CX, p[1] - CY) <= O.R_PLANET + 8) return; drag = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] }; try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } ev.preventDefault(); draw(); });
    canvas.addEventListener('pointermove', ev => { if (!drag) return; const p = local(ev); drag.x1 = p[0]; drag.y1 = p[1]; draw(); });
    const endDrag = () => { if (!drag) return; const d = drag; drag = null; setState(O.fling(d.x0 - CX, d.y0 - CY, d.x1 - d.x0, d.y1 - d.y0), null); };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', () => { drag = null; draw(); });
    canvas.addEventListener('keydown', ev => {
      const rot = a => { const c = Math.cos(a), sn = Math.sin(a); return Object.assign({}, s, { vx: s.vx * c - s.vy * sn, vy: s.vx * sn + s.vy * c, status: 'orbit' }); };
      const scale = f => Object.assign({}, s, { vx: s.vx * f, vy: s.vy * f, status: 'orbit' });
      const P = O.presets();
      let n = null;
      if (ev.key === 'ArrowLeft') n = rot(-0.12); else if (ev.key === 'ArrowRight') n = rot(0.12);
      else if (ev.key === 'ArrowUp') n = scale(1.05); else if (ev.key === 'ArrowDown') n = scale(0.95);
      else if (ev.key === '1') n = P.circle; else if (ev.key === '2') n = P.ellipse; else if (ev.key === '3') n = P.escape;
      else if (ev.key === ' ') { ev.preventDefault(); pauseBtn.click(); return; }
      if (!n) return;
      ev.preventDefault();
      if ((s.status === 'crash' || s.status === 'escape') && ev.key.indexOf('Arrow') === 0) n = P.circle;
      const keep = trail; setState(n, null); if (ev.key.indexOf('Arrow') === 0) trail = keep;
    });
    const P = O.presets();
    box.appendChild(h('div', { class: 'card orb' },
      h('h2', null, '🛰️ Orbit Lab'),
      h('p', { class: 'muted' }, kid ? 'Drag to throw the moon. Too slow and it falls, too fast and it flies away, just right and it goes round and round!'
        : 'Real Newtonian gravity, worked out live on this device. Drag to throw the moon; the dashed line is where gravity will take it. Notice the moon speeds up when it swings close (Kepler’s second law) and that bigger orbits take longer (his third).'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: () => setState(P.circle, 'Circle orbit.') }, '⭕ Circle'),
        h('button', { type: 'button', class: 'btn', onclick: () => setState(P.ellipse, 'Oval orbit.') }, '🥚 Oval'),
        h('button', { type: 'button', class: 'btn', onclick: () => setState(P.escape, 'Escape speed.') }, '🚀 Escape'),
        still ? h('button', { type: 'button', class: 'btn', onclick: () => stepOnce(1) }, '⏭️ Step 1 second') : pauseBtn,
        still ? null : slowBtn, lapEl),
      h('div', { class: 'orb-wrap' }, canvas), read, say,
      h('p', { class: 'fine' }, still ? 'Your device asks for reduced motion, so the moon only moves when you press Step. The dashed line still shows the whole path.' : 'Keyboard: click the picture, then Left and Right turn the moon, Up and Down change its speed, Space pauses, 1, 2 and 3 pick a ready-made orbit.')));
    predict(); readout(true); draw(); kick();
    current = () => { readPal(); draw(); };
  }
  let current = null;
  SIT.on('theme', () => { if (current) current(); });
  SIT.orbit = { render };
})();
