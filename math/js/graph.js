/* Stark Math. The graphing tool: plot up to four functions of x on a canvas, pan and zoom with
   mouse, touch or keyboard, trace values, and read a table of values and a plain-language summary. */
(function () {
  'use strict';
  const SM = window.SM;
  const { h, clear, btn } = SM;
  const COLORS = ['#a99cf0', '#62b8d8', '#f0b35e', '#e98aa8'];

  function compile(src) {
    src = String(src).trim().replace(/^(y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
    if (!src) return null;
    const ast = SM.parse(src), vars = SM.varsOf(ast).filter(v => v !== 'x');
    if (vars.length) throw new Error('Use x as the only letter (found ' + vars.join(', ') + ').');
    return x => { try { return SM.evalF(ast, { x }); } catch (e) { return NaN; } };
  }
  SM.compileFn = compile;
  /** Approximate x-intercepts by sign changes and refinement. */
  function roots(fn, a, b) {
    const out = [], N = 800; let px = a, py = fn(a);
    for (let i = 1; i <= N; i++) {
      const x = a + (b - a) * i / N, y = fn(x);
      if (isFinite(py) && isFinite(y) && (py === 0 || py * y < 0) && Math.abs(y - py) < 1e3) { let lo = px, hi = x; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (fn(lo) * fn(m) <= 0) hi = m; else lo = m; } const r = (lo + hi) / 2; if (!out.some(z => Math.abs(z - r) < (b - a) / 400)) out.push(r); }
      px = x; py = y;
    }
    return out;
  }
  SM.fnRoots = roots;

  SM.views.graph = function (main, q) {
    const st = { cx: 0, cy: 0, scale: 40, fns: [], trace: null };
    const initial = q.f ? String(q.f).split('|').slice(0, 4) : ['x^2 - 2x - 3', 'sin(x)'];
    const canvas = h('canvas', { class: 'graph-canvas', tabindex: '0', role: 'img', 'aria-label': 'Graph. Use arrow keys to pan, plus and minus to zoom.' });
    const readout = h('div', { class: 'graph-readout', 'aria-live': 'polite' });
    const summary = h('div', { class: 'graph-summary' });
    const inputs = h('div', { class: 'graph-inputs' });
    const table = h('div', { class: 'table-wrap' });
    initial.concat(['', '', '', '']).slice(0, 4).forEach((v, i) => {
      const inp = h('input', { value: v, 'aria-label': 'Function ' + (i + 1), placeholder: i === 0 ? 'e.g. x^2 - 3' : 'another function (optional)', class: 'fn-in' });
      const err = h('span', { class: 'fn-err', 'aria-live': 'polite' });
      inp.addEventListener('input', () => { build(); draw(); });
      inputs.appendChild(h('div', { class: 'fn-row' }, h('span', { class: 'swatch', style: 'background:' + COLORS[i] }), h('span', { class: 'fn-y' }, 'y ='), inp, err));
    });
    function build() {
      st.fns = [];
      inputs.querySelectorAll('.fn-row').forEach((row, i) => {
        const inp = row.querySelector('input'), err = row.querySelector('.fn-err'); err.textContent = '';
        try { const f = compile(inp.value); if (f) st.fns.push({ f, src: inp.value, color: COLORS[i] }); } catch (e) { err.textContent = e.message; }
      });
      describe();
    }
    let W = 600, Hh = 420;
    const ctx = canvas.getContext('2d');
    function resize() { const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; W = Math.max(280, r.width || 600); Hh = Math.max(260, Math.min(520, W * 0.7)); canvas.style.height = Hh + 'px'; canvas.width = W * dpr; canvas.height = Hh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
    const X = x => W / 2 + (x - st.cx) * st.scale, Y = y => Hh / 2 - (y - st.cy) * st.scale, ix = px => st.cx + (px - W / 2) / st.scale;
    function niceStep() { const raw = 80 / st.scale, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 2 ? 1 : m < 5 ? 2 : 5) * p; }
    function draw() {
      const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--text').trim() || '#e7efe9', grid = css.getPropertyValue('--grid').trim() || 'rgba(160,170,165,.18)', bg = css.getPropertyValue('--surface').trim() || '#16201c';
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, Hh);
      const step = niceStep(), x0 = ix(0), x1 = ix(W);
      ctx.lineWidth = 1; ctx.strokeStyle = grid; ctx.fillStyle = ink; ctx.font = '11px system-ui, sans-serif';
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), Hh); ctx.stroke(); if (Math.abs(x) > step / 2) ctx.fillText(+x.toPrecision(6) + '', X(x) + 2, Math.min(Hh - 4, Math.max(12, Y(0) + 13))); }
      const y0 = st.cy - Hh / 2 / st.scale, y1 = st.cy + Hh / 2 / st.scale;
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(W, Y(y)); ctx.stroke(); if (Math.abs(y) > step / 2) ctx.fillText(+y.toPrecision(6) + '', Math.min(W - 30, Math.max(3, X(0) + 4)), Y(y) - 2); }
      ctx.strokeStyle = ink; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), Hh); ctx.stroke(); ctx.globalAlpha = 1;
      st.fns.forEach(fn => {
        ctx.strokeStyle = fn.color; ctx.lineWidth = 2.5; ctx.beginPath(); let pen = false, py = null;
        for (let px = 0; px <= W; px += 1) { const y = fn.f(ix(px)), sy = Y(y); if (!isFinite(y) || Math.abs(sy) > 1e5 || (py !== null && Math.abs(sy - py) > Hh * 2)) { pen = false; py = null; continue; } if (pen) ctx.lineTo(px, sy); else { ctx.moveTo(px, sy); pen = true; } py = sy; }
        ctx.stroke();
      });
      if (st.trace !== null && st.fns.length) {
        const x = st.trace; ctx.strokeStyle = ink; ctx.globalAlpha = 0.35; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), Hh); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        const parts = st.fns.map(fn => { const y = fn.f(x); if (isFinite(y)) { ctx.fillStyle = fn.color; ctx.beginPath(); ctx.arc(X(x), Y(y), 4.5, 0, 7); ctx.fill(); } return 'y' + (st.fns.length > 1 ? ' (' + fn.src + ')' : '') + ' = ' + (isFinite(y) ? SM.fmtNum(y, 4) : 'undefined'); });
        readout.textContent = 'x = ' + SM.fmtNum(x, 4) + ': ' + parts.join('; ');
      }
    }
    function describe() {
      clear(summary); clear(table);
      if (!st.fns.length) return;
      const a = st.cx - 10, b = st.cx + 10;
      summary.appendChild(h('ul', null, st.fns.map(fn => { const rs = roots(fn.f, a, b), yi = fn.f(0); return h('li', null, h('span', { class: 'swatch', style: 'background:' + fn.color }), ' y = ', h('span', { class: 'math', html: SM.renderMath(fn.src.replace(/^y\s*=\s*/, '')) }), ': ' + (isFinite(yi) ? 'crosses the y-axis at ' + SM.fmtNum(yi, 4) : 'undefined at x = 0') + (rs.length ? '; crosses the x-axis near x = ' + rs.slice(0, 6).map(r => SM.fmtNum(r, 3)).join(', ') : '; no x-intercepts between ' + SM.fmtNum(a, 2) + ' and ' + SM.fmtNum(b, 2)) + '.'); })));
      const xs = [-3, -2, -1, 0, 1, 2, 3].map(k => SM.roundDP(st.cx + k * niceStep() * 2, 6));
      table.appendChild(h('table', { class: 'tbl' }, h('caption', null, 'Table of values'), h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'x'), st.fns.map((fn, i) => h('th', { scope: 'col' }, 'y' + (i + 1))))), h('tbody', null, xs.map(x => h('tr', null, h('td', null, SM.fmtNum(x, 4)), st.fns.map(fn => { const y = fn.f(x); return h('td', null, isFinite(y) ? SM.fmtNum(y, 4) : '—'); }))))));
    }
    // interaction
    let drag = null;
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: st.cx, cy: st.cy }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); if (drag) { st.cx = drag.cx - (e.clientX - drag.x) / st.scale; st.cy = drag.cy + (e.clientY - drag.y) / st.scale; } st.trace = ix(e.clientX - r.left); draw(); });
    canvas.addEventListener('pointerup', () => { if (drag) describe(); drag = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const s = 40 / st.scale, k = e.key;
      if (k === 'ArrowLeft') st.cx -= s; else if (k === 'ArrowRight') st.cx += s; else if (k === 'ArrowUp') st.cy += s; else if (k === 'ArrowDown') st.cy -= s;
      else if (k === '+' || k === '=') return zoom(1.25); else if (k === '-') return zoom(0.8);
      else if (k === ',' || k === '.') { st.trace = (st.trace === null ? st.cx : st.trace) + (k === '.' ? 1 : -1) * niceStep() / 2; draw(); return; } else return;
      e.preventDefault(); draw(); describe();
    });
    function zoom(f) { st.scale = Math.max(2, Math.min(4000, st.scale * f)); draw(); describe(); }
    main.append(h('div', { class: 'page-head' }, h('h1', null, 'Graph'), h('p', { class: 'muted' }, 'Type functions of x. Drag or use the arrow keys to pan, scroll or press + and - to zoom, press , and . to trace.')),
      h('div', { class: 'graph' }, h('div', { class: 'graph-side' }, inputs, h('div', { class: 'row wrap' }, btn('Zoom in', () => zoom(1.25), 'btn-small'), btn('Zoom out', () => zoom(0.8), 'btn-small'), btn('Reset view', () => { st.cx = 0; st.cy = 0; st.scale = 40; draw(); describe(); }, 'btn-small btn-ghost')), summary),
        h('div', { class: 'graph-main' }, canvas, readout, table)));
    build();
    let lastW = 0, raf = 0; const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const w = Math.round(canvas.getBoundingClientRect().width); if (w && w !== lastW) { lastW = w; resize(); } }); };
    const ro = window.ResizeObserver ? new ResizeObserver(onResize) : null; if (ro) ro.observe(canvas); else window.addEventListener('resize', onResize);
    setTimeout(resize, 0);
    main._cleanup = () => { if (ro) ro.disconnect(); };
  };
})();
