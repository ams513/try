/* Stark Builder, by Stark. Site and village planner: place buildings, draw paths, drop shared-utility placeholders,
   and assign every item to a build phase. Placeholders are boxes on a map, not engineered systems. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const C = SB.core;
  const PAL = { bg: '#0f1613', lot: '#17251d', grid: 'rgba(231,239,233,.06)', edge: '#e7efe9', set: '#f2b8b5', path: '#8d826e', text: '#e7efe9', muted: '#9fb0a6', accent: '#a58bf2', dim: 0.28 };
  const UTIL = SB.svg.UTIL;
  const PHASE_COL = ['', '#a58bf2', '#3dbb8c', '#d9a441', '#f08f72'];

  function SiteEditor(cv, app) {
    this.cv = cv; this.app = app; this.ctx = cv.getContext('2d'); this.v = { s: 10, ox: 40, oy: 40 }; this.tool = 'select'; this.fitted = false;
    this.pathPts = null; this.mouse = null; this.drag = null; this.sel = null; this.showPhase = 4;
    this.bind();
  }
  const P = SiteEditor.prototype;
  P.toWorld = function (px, py) { return [(px - this.v.ox) / this.v.s, (py - this.v.oy) / this.v.s]; };
  P.toScreen = function (x, y) { return [x * this.v.s + this.v.ox, y * this.v.s + this.v.oy]; };
  P.fit = function () {
    const site = this.app.site, w = this.w || 800, h = this.h || 500;
    this.v.s = Math.max(1.5, Math.min((w - 80) / site.w, (h - 80) / site.d)); this.v.ox = (w - site.w * this.v.s) / 2; this.v.oy = (h - site.d * this.v.s) / 2; this.redraw();
  };
  P.setTool = function (t) { this.tool = t; this.pathPts = null; this.cv.style.cursor = t === 'select' ? 'default' : 'crosshair'; this.redraw(); };
  P.size = function (b) { const bb = C.bbox(b.plan); return b.rot % 2 ? [bb.d, bb.w] : [bb.w, bb.d]; };
  P.rect = function (b) { const s = this.size(b); return { x0: b.x - s[0] / 2, y0: b.y - s[1] / 2, x1: b.x + s[0] / 2, y1: b.y + s[1] / 2 }; };
  P.utilSize = function (u) { const d = UTIL[u.kind]; return [d[2], d[3]]; };

  /* Checks shown beside the map. Thresholds are examples only: local rules decide. */
  P.warnings = function () {
    const site = this.app.site, out = [], sys = this.app.units;
    site.buildings.forEach((b, i) => {
      const r = this.rect(b);
      if (r.x0 < 0 || r.y0 < 0 || r.x1 > site.w || r.y1 > site.d) out.push(b.name + ' extends past the lot line.');
      else if (site.setback > 0 && (r.x0 < site.setback || r.y0 < site.setback || r.x1 > site.w - site.setback || r.y1 > site.d - site.setback)) out.push(b.name + ' is inside the example setback of ' + C.fmtLen(site.setback, sys) + '. Check your real setbacks.');
      for (let j = i + 1; j < site.buildings.length; j++) {
        const q = this.rect(site.buildings[j]);
        if (r.x0 < q.x1 && q.x0 < r.x1 && r.y0 < q.y1 && q.y0 < r.y1) out.push(b.name + ' overlaps ' + site.buildings[j].name + '.');
      }
    });
    const septics = site.utils.filter(u => u.kind === 'septic'), waters = site.utils.filter(u => u.kind === 'water');
    septics.forEach(s => waters.forEach(w => { if (C.dist([s.x, s.y], [w.x, w.y]) < 30) out.push('Septic placeholder is ' + C.fmtLen(C.dist([s.x, s.y], [w.x, w.y]), sys) + ' from a water source. Many places require a larger separation: confirm with your health authority.'); }));
    return out;
  };

  P.hit = function (raw) {
    const site = this.app.site, s = this.v.s;
    for (let i = site.utils.length - 1; i >= 0; i--) { const u = site.utils[i], d = this.utilSize(u); if (Math.abs(raw[0] - u.x) <= d[0] / 2 + 3 / s && Math.abs(raw[1] - u.y) <= d[1] / 2 + 3 / s) return { type: 'util', id: u.id }; }
    for (let i = site.buildings.length - 1; i >= 0; i--) { const r = this.rect(site.buildings[i]); if (raw[0] >= r.x0 && raw[0] <= r.x1 && raw[1] >= r.y0 && raw[1] <= r.y1) return { type: 'building', id: site.buildings[i].id }; }
    for (let i = site.paths.length - 1; i >= 0; i--) { const p = site.paths[i]; for (let k = 1; k < p.pts.length; k++) if (C.segDist(raw, p.pts[k - 1], p.pts[k]).d <= Math.max(p.w / 2, 6 / s)) return { type: 'path', id: p.id }; }
    return null;
  };
  P.snapPt = function (raw, free) { const st = free ? 0.05 : 0.25; return [C.snap(raw[0], st), C.snap(raw[1], st)]; };
  P.pt = function (e) { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  P.finishPath = function () {
    const site = this.app.site;
    if (this.pathPts && this.pathPts.length >= 2) { site.paths.push({ id: site.nextId++, pts: this.pathPts, w: 1.2, phase: 1 }); this.sel = { type: 'path', id: site.paths[site.paths.length - 1].id }; this.app.siteCommit('Add path'); }
    this.pathPts = null; this.redraw();
  };
  P.bind = function () {
    const cv = this.cv, self = this; cv.tabIndex = 0;
    cv.addEventListener('contextmenu', e => { e.preventDefault(); if (self.pathPts) self.finishPath(); });
    cv.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = self.pt(e), w = self.toWorld(px, py), f = e.deltaY > 0 ? 1 / 1.15 : 1.15; self.v.s = Math.max(1, Math.min(120, self.v.s * f)); self.v.ox = px - w[0] * self.v.s; self.v.oy = py - w[1] * self.v.s; self.redraw(); }, { passive: false });
    cv.addEventListener('dblclick', () => { if (self.pathPts) { self.pathPts.pop(); self.finishPath(); } });
    cv.addEventListener('keydown', e => {
      if (e.key === 'Escape') { self.pathPts = null; self.redraw(); }
      else if (e.key === 'Enter') self.finishPath();
      else if ((e.key === 'Delete' || e.key === 'Backspace') && self.sel) { e.preventDefault(); self.app.siteDelete(self.sel); }
    });
    cv.addEventListener('pointerdown', e => {
      const [px, py] = self.pt(e), raw = self.toWorld(px, py), site = self.app.site; cv.focus(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      if (e.button === 1 || e.button === 2) { self.drag = { type: 'pan', px, py, ox: self.v.ox, oy: self.v.oy }; return; }
      if (self.tool === 'path') { const p = self.snapPt(raw); if (!self.pathPts) self.pathPts = []; self.pathPts.push(p); self.redraw(); return; }
      if (self.tool !== 'select') {
        const k = self.tool, p = self.snapPt(raw); site.utils.push({ id: site.nextId++, kind: k, x: p[0], y: p[1], phase: 1 });
        self.sel = { type: 'util', id: site.utils[site.utils.length - 1].id }; self.app.siteCommit('Add ' + k); self.app.siteSetTool('select'); return;
      }
      const h = self.hit(raw);
      self.sel = h; self.app.siteSelect(h);
      if (!h) { self.drag = { type: 'pan', px, py, ox: self.v.ox, oy: self.v.oy }; self.redraw(); return; }
      const it = h.type === 'building' ? site.buildings.find(b => b.id === h.id) : h.type === 'util' ? site.utils.find(u => u.id === h.id) : site.paths.find(p => p.id === h.id);
      self.drag = { type: h.type, it, start: raw, o: h.type === 'path' ? it.pts.map(q => q.slice()) : [it.x, it.y], moved: false };
      self.redraw();
    });
    cv.addEventListener('pointermove', e => {
      const [px, py] = self.pt(e), raw = self.toWorld(px, py), d = self.drag; self.mouse = raw;
      if (d) {
        if (d.type === 'pan') { self.v.ox = d.ox + px - d.px; self.v.oy = d.oy + py - d.py; }
        else { const dx = C.snap(raw[0] - d.start[0], 0.25), dy = C.snap(raw[1] - d.start[1], 0.25);
          if (d.type === 'path') d.it.pts = d.o.map(q => [q[0] + dx, q[1] + dy]); else { d.it.x = d.o[0] + dx; d.it.y = d.o[1] + dy; } d.moved = true; }
      }
      self.redraw();
    });
    const up = () => { const d = self.drag; self.drag = null; if (d && d.moved) self.app.siteCommit('Move'); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  };
  P.redraw = function () {
    const cv = this.cv, dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    if (cv.width !== Math.floor(w * dpr) || cv.height !== Math.floor(h * dpr)) { cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr); }
    this.w = w; this.h = h; if (!this.fitted) { this.fitted = true; this.fit(); return; }
    const c = this.ctx, v = this.v, site = this.app.site, sys = this.app.units; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = PAL.bg; c.fillRect(0, 0, w, h);
    const a = this.toScreen(0, 0), b = this.toScreen(site.w, site.d);
    c.fillStyle = PAL.lot; c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    // grid every 5 m (or 20 ft)
    const gs = sys === 'imperial' ? C.FT * 20 : 5; c.strokeStyle = PAL.grid; c.lineWidth = 1; c.beginPath();
    for (let x = 0; x <= site.w; x += gs) { const px = Math.round(x * v.s + v.ox) + 0.5; c.moveTo(px, a[1]); c.lineTo(px, b[1]); }
    for (let y = 0; y <= site.d; y += gs) { const py = Math.round(y * v.s + v.oy) + 0.5; c.moveTo(a[0], py); c.lineTo(b[0], py); }
    c.stroke();
    c.strokeStyle = PAL.edge; c.lineWidth = 2; c.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    if (site.setback > 0) { const s0 = this.toScreen(site.setback, site.setback), s1 = this.toScreen(site.w - site.setback, site.d - site.setback); c.strokeStyle = PAL.set; c.lineWidth = 1; c.setLineDash([7, 5]); c.strokeRect(s0[0], s0[1], s1[0] - s0[0], s1[1] - s0[1]); c.setLineDash([]); }
    const alpha = ph => (ph <= this.showPhase ? 1 : PAL.dim);
    const isSel = (t, id) => this.sel && this.sel.type === t && this.sel.id === id;
    site.paths.forEach(p => {
      c.globalAlpha = alpha(p.phase); c.strokeStyle = isSel('path', p.id) ? PAL.accent : PAL.path; c.lineWidth = Math.max(2, p.w * v.s); c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
      p.pts.forEach((q, i) => { const s = this.toScreen(q[0], q[1]); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.stroke(); c.globalAlpha = 1;
    });
    if (this.pathPts && this.pathPts.length) {
      c.strokeStyle = PAL.accent; c.lineWidth = Math.max(2, 1.2 * v.s); c.globalAlpha = 0.5; c.beginPath();
      this.pathPts.concat(this.mouse ? [this.snapPt(this.mouse)] : []).forEach((q, i) => { const s = this.toScreen(q[0], q[1]); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.stroke(); c.globalAlpha = 1;
    }
    site.utils.forEach(u => {
      const d = UTIL[u.kind], s = this.toScreen(u.x, u.y); c.globalAlpha = alpha(u.phase); c.fillStyle = d[1];
      if (u.kind === 'water' || u.kind === 'power') { c.beginPath(); c.arc(s[0], s[1], d[2] / 2 * v.s, 0, 6.3); c.fill(); } else c.fillRect(s[0] - d[2] / 2 * v.s, s[1] - d[3] / 2 * v.s, d[2] * v.s, d[3] * v.s);
      if (isSel('util', u.id)) { c.strokeStyle = PAL.accent; c.lineWidth = 2; c.strokeRect(s[0] - d[2] / 2 * v.s - 3, s[1] - d[3] / 2 * v.s - 3, d[2] * v.s + 6, d[3] * v.s + 6); }
      c.fillStyle = PAL.text; c.font = '11px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(d[0], s[0], s[1] + d[3] / 2 * v.s + 12); c.globalAlpha = 1;
    });
    site.buildings.forEach(bd => {
      const r = this.rect(bd), s0 = this.toScreen(r.x0, r.y0), s1 = this.toScreen(r.x1, r.y1), bb = C.bbox(bd.plan), cx = (bb.x0 + bb.x1) / 2, cz = (bb.y0 + bb.y1) / 2;
      const T = p => { const cc = [1, 0, -1, 0][bd.rot], ss = [0, 1, 0, -1][bd.rot], x = p[0] - cx, z = p[1] - cz; return this.toScreen(bd.x + x * cc + z * ss, bd.y - x * ss + z * cc); };
      c.globalAlpha = alpha(bd.phase); c.fillStyle = 'rgba(231,239,233,.10)'; c.fillRect(s0[0], s0[1], s1[0] - s0[0], s1[1] - s0[1]);
      c.strokeStyle = PHASE_COL[bd.phase]; c.lineWidth = isSel('building', bd.id) ? 4 : 2; c.strokeRect(s0[0], s0[1], s1[0] - s0[0], s1[1] - s0[1]);
      c.strokeStyle = 'rgba(231,239,233,.55)'; c.lineWidth = 1; c.beginPath();
      bd.plan.walls.forEach(wl => { const p = T(wl.a), q = T(wl.b); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); }); c.stroke();
      c.fillStyle = PAL.text; c.font = '600 12px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(bd.name, (s0[0] + s1[0]) / 2, s0[1] - 7);
      c.fillStyle = PHASE_COL[bd.phase]; c.font = '11px "Segoe UI", system-ui, sans-serif'; c.fillText('Phase ' + bd.phase, (s0[0] + s1[0]) / 2, s1[1] + 13); c.globalAlpha = 1;
    });
    c.fillStyle = PAL.muted; c.font = '11px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'left';
    c.fillText(C.fmtLen(site.w, sys) + ' x ' + C.fmtLen(site.d, sys) + ' lot. Dashed red = example setback.', Math.max(10, a[0]), Math.max(14, a[1] - 8));
  };
  SB.SiteEditor = SiteEditor;
})(typeof window !== 'undefined' ? window : globalThis);
