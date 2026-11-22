/* Stark Builder, by Stark. Floor-plan editor: a 2D canvas with snap grid, walls, doors, windows, rooms, stairs, furniture and service symbols.
   Edits one floor at a time (app.lv()). Talks to the app through a small interface: app.units, app.sel, app.setSel(), app.commit(), app.say(). */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const C = SB.core;
  const PAL = { bg: '#0f1613', grid: 'rgba(231,239,233,.07)', gridMajor: 'rgba(231,239,233,.16)', ext: '#e7efe9', int: '#9fb0a6', room: ['rgba(165,139,242,.13)', 'rgba(61,187,140,.12)', 'rgba(217,164,65,.12)', 'rgba(98,184,216,.12)', 'rgba(240,143,114,.12)'],
    accent: '#a58bf2', text: '#e7efe9', muted: '#9fb0a6', win: '#62b8d8', danger: '#f2b8b5' };

  function Editor(cv, app) {
    this.cv = cv; this.app = app; this.ctx = cv.getContext('2d');
    this.v = { s: 60, ox: 80, oy: 80 };
    this.tool = 'select'; this.showDims = true; this.ortho = true; this.snapStep = 0.1;
    this.hover = null; this.draw0 = null; this.mouse = null; this.drag = null; this.rect0 = null; this.spaceDown = false;
    this.defaults = { winW: 1.2, winH: 1.2, winSill: 0.9, doorW: 0.9, doorH: 2.0 };
    this.bind(); this.fitted = false;
  }
  const P = Editor.prototype;
  P.toWorld = function (px, py) { return [(px - this.v.ox) / this.v.s, (py - this.v.oy) / this.v.s]; };
  P.toScreen = function (x, y) { return [x * this.v.s + this.v.ox, y * this.v.s + this.v.oy]; };
  P.resize = function () {
    const cv = this.cv, dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return false;
    if (cv.width !== Math.floor(w * dpr) || cv.height !== Math.floor(h * dpr)) { cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr); }
    this.dpr = dpr; this.w = w; this.h = h;
    if (!this.fitted) { this.fitted = true; this.fit(); }
    return true;
  };
  P.fit = function () {
    const bb = C.bbox(this.app.lv()), w = this.w || 800, h = this.h || 500;
    const bw = Math.max(bb.w, 4), bd = Math.max(bb.d, 3);
    const s = Math.min((w - 140) / bw, (h - 140) / bd);
    this.v.s = Math.max(8, Math.min(200, s));
    this.v.ox = w / 2 - ((bb.x0 + bb.x1) / 2) * this.v.s; this.v.oy = h / 2 - ((bb.y0 + bb.y1) / 2) * this.v.s;
    this.redraw();
  };
  P.setTool = function (t) { this.tool = t; this.draw0 = null; this.rect0 = null; this.hover = null; this.cv.style.cursor = t === 'select' ? 'default' : t === 'pan' ? 'grab' : 'crosshair'; this.redraw(); };
  P.setSnap = function (v) { this.snapStep = v; this.redraw(); };
  const um = () => SB.app.units;

  /* ---------- snapping ---------- */
  P.snapPoint = function (raw, from, free) {
    const plan = this.app.lv(), tol = 10 / this.v.s; let best = null;
    plan.walls.forEach(w => { [w.a, w.b].forEach(p => { const d = C.dist(p, raw); if (d < tol && (!best || d < best.d)) best = { d, p }; }); });
    if (best) return { p: [best.p[0], best.p[1]], snapped: 'end' };
    let p = [raw[0], raw[1]];
    if (from && this.ortho && !free) { if (Math.abs(p[0] - from[0]) >= Math.abs(p[1] - from[1])) p[1] = from[1]; else p[0] = from[0]; }
    const st = this.snapStep;
    if (from && this.ortho && !free) { if (p[1] === from[1]) p[0] = C.snap(p[0], st); else p[1] = C.snap(p[1], st); } else p = [C.snap(p[0], st), C.snap(p[1], st)];
    return { p, snapped: 'grid' };
  };

  /* ---------- hit testing ---------- */
  P.hit = function (raw) {
    const plan = this.app.lv(), s = this.v.s, sel = this.app.sel;
    // handles of the selection first
    if (sel && sel.type === 'wall') {
      const w = C.findWall(plan, sel.id);
      if (w) for (const end of ['a', 'b']) if (C.dist(w[end], raw) * s < 9) return { type: 'wallEnd', id: w.id, end };
    }
    if (sel && sel.type === 'room') {
      const r = plan.rooms.find(q => q.id === sel.id);
      if (r) for (let i = 0; i < r.pts.length; i++) if (C.dist(r.pts[i], raw) * s < 9) return { type: 'roomPt', id: r.id, i };
    }
    const items = plan.items || [], stairs = plan.stairs || [];
    for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (it.cat !== 'furn' && C.dist([it.x, it.y], raw) * s < 10) return { type: 'item', id: it.id }; }
    for (const o of plan.openings) {
      const w = C.findWall(plan, o.wall); if (!w) continue;
      const sd = C.segDist(raw, w.a, w.b), pos = sd.t * C.wallLen(w);
      if (sd.d <= Math.max(w.t / 2, 7 / s) && Math.abs(pos - o.s) <= o.w / 2 + 3 / s) return { type: 'opening', id: o.id };
    }
    let bestW = null;
    plan.walls.forEach(w => { const d = C.segDist(raw, w.a, w.b).d; if (d <= Math.max(w.t / 2, 6 / s) && (!bestW || d < bestW.d)) bestW = { d, id: w.id }; });
    if (bestW) return { type: 'wall', id: bestW.id };
    const inR = r => raw[0] >= r.x0 && raw[0] <= r.x1 && raw[1] >= r.y0 && raw[1] <= r.y1;
    for (let i = items.length - 1; i >= 0; i--) if (items[i].cat === 'furn' && inR(itemRect(items[i]))) return { type: 'item', id: items[i].id };
    for (let i = stairs.length - 1; i >= 0; i--) if (inR(C.stairRect(stairs[i]))) return { type: 'stair', id: stairs[i].id };
    for (let i = plan.rooms.length - 1; i >= 0; i--) if (C.pointInPoly(raw, plan.rooms[i].pts)) return { type: 'room', id: plan.rooms[i].id };
    return null;
  };
  function itemRect(it) { const odd = it.rot % 2 === 1, w = (odd ? it.d : it.w) / 2, d = (odd ? it.w : it.d) / 2; return { x0: it.x - w, y0: it.y - d, x1: it.x + w, y1: it.y + d }; }
  Editor.itemRect = itemRect;
  /* A new furniture piece, symbol or stair at point p on the current floor (not yet added). */
  P.newThing = function (tool, p) {
    const app = this.app, plan = app.lv(), cat = SB.catalog;
    if (tool === 'stairs') {
      const rise = C.wallH(plan) + C.FLOOR_T, n = Math.max(2, Math.ceil(rise / 0.19 - 1e-9));
      return { id: plan.nextId++, x: p[0], y: p[1], w: 0.9, len: Math.ceil((n - 1) * 0.25 * 20 - 1e-9) / 20, rot: 0, going: 0.25 };
    }
    if (tool === 'furn') { const f = cat.furn(app.placeKind.furn) || cat.FURN[0]; return { id: plan.nextId++, cat: 'furn', kind: f.id, x: p[0], y: p[1], rot: 0, w: f.w, d: f.d }; }
    return { id: plan.nextId++, cat: tool, kind: app.placeKind[tool] || cat.markers[tool][0].id, x: p[0], y: p[1], rot: 0 };
  };
  P.findThing = function (sel) {
    const plan = this.app.lv(); if (!sel) return null;
    return sel.type === 'item' ? (plan.items || []).find(i => i.id === sel.id) : sel.type === 'stair' ? (plan.stairs || []).find(i => i.id === sel.id) : null;
  };
  P.rotateSel = function () { const t = this.findThing(this.app.sel); if (t) { t.rot = (t.rot + 1) % 4; this.app.commit('Rotate'); } };

  /* ---------- editing actions ---------- */
  const newId = plan => plan.nextId++;
  P.addWall = function (a, b, type) {
    const plan = this.app.lv(); if (C.dist(a, b) < 0.2) return null;
    const w = { id: newId(plan), a: [a[0], a[1]], b: [b[0], b[1]], type, t: type === 'ext' ? C.DEF.extT : C.DEF.intT };
    plan.walls.push(w); return w;
  };
  P.placeOpening = function (type, hit, commitIt) {
    const plan = this.app.lv(), d = this.defaults, w = hit.wall, L = C.wallLen(w);
    const ow = type === 'window' ? d.winW : d.doorW, oh = type === 'window' ? d.winH : d.doorH, sill = type === 'window' ? d.winSill : 0;
    let s = Math.round(hit.s / 0.05) * 0.05; s = Math.max(ow / 2, Math.min(L - ow / 2, s));
    if (L < ow + 0.05) return { ok: false, why: 'This wall is too short for that opening.' };
    const clash = C.openingsOn(plan, w.id).some(o => Math.abs(o.s - s) < (o.w + ow) / 2 - 1e-6);
    if (clash) return { ok: false, why: 'That spot is taken by another opening.' };
    const o = { id: newId(plan), wall: w.id, type, s, w: ow, h: oh, sill, flip: false };
    if (commitIt) { plan.openings.push(o); }
    return { ok: true, o, s };
  };
  P.deleteSel = function () {
    const plan = this.app.lv(), sel = this.app.sel; if (!sel) return;
    if (sel.type === 'wall') { plan.walls = plan.walls.filter(w => w.id !== sel.id); plan.openings = plan.openings.filter(o => o.wall !== sel.id); }
    else if (sel.type === 'opening') plan.openings = plan.openings.filter(o => o.id !== sel.id);
    else if (sel.type === 'room') plan.rooms = plan.rooms.filter(r => r.id !== sel.id);
    else if (sel.type === 'item') plan.items = plan.items.filter(r => r.id !== sel.id);
    else if (sel.type === 'stair') plan.stairs = plan.stairs.filter(r => r.id !== sel.id);
    this.app.setSel(null); this.app.commit('Delete');
  };

  /* ---------- events ---------- */
  P.pt = function (e) { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  P.bind = function () {
    const cv = this.cv, self = this; cv.tabIndex = 0;
    cv.addEventListener('contextmenu', e => { e.preventDefault(); if (self.draw0) { self.draw0 = null; self.redraw(); } });
    cv.addEventListener('wheel', e => {
      e.preventDefault(); const [px, py] = self.pt(e), w = self.toWorld(px, py), f = e.deltaY > 0 ? 1 / 1.15 : 1.15;
      self.v.s = Math.max(6, Math.min(400, self.v.s * f)); self.v.ox = px - w[0] * self.v.s; self.v.oy = py - w[1] * self.v.s; self.redraw();
    }, { passive: false });
    cv.addEventListener('pointerdown', e => self.down(e));
    cv.addEventListener('pointermove', e => self.move(e));
    cv.addEventListener('pointerup', e => self.up(e));
    cv.addEventListener('pointercancel', e => self.up(e));
    cv.addEventListener('dblclick', e => { if (self.draw0) { self.draw0 = null; self.redraw(); } });
    cv.addEventListener('keydown', e => {
      if (e.key === 'Escape') { self.draw0 = null; self.rect0 = null; self.drag = null; self.redraw(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && self.tool === 'select') { e.preventDefault(); self.deleteSel(); }
      else if (e.key === ' ') { self.spaceDown = true; e.preventDefault(); }
      else if (e.key === 'Enter') { self.draw0 = null; self.redraw(); }
      else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && self.findThing(self.app.sel)) { e.preventDefault(); self.rotateSel(); }
    });
    cv.addEventListener('keyup', e => { if (e.key === ' ') self.spaceDown = false; });
  };
  P.down = function (e) {
    const [px, py] = this.pt(e), raw = this.toWorld(px, py), app = this.app, plan = app.lv();
    this.cv.focus(); try { this.cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    if (e.button === 1 || e.button === 2 || this.tool === 'pan' || this.spaceDown) { this.drag = { type: 'pan', px, py, ox: this.v.ox, oy: this.v.oy }; this.cv.style.cursor = 'grabbing'; return; }
    if (e.button !== 0) return;
    const t = this.tool;
    if (t === 'wallExt' || t === 'wallInt') {
      const sp = this.snapPoint(raw, this.draw0, e.shiftKey).p;
      if (!this.draw0) this.draw0 = sp;
      else { const w = this.addWall(this.draw0, sp, t === 'wallExt' ? 'ext' : 'int'); if (w) { app.commit('Add wall'); this.draw0 = sp; } }
      this.redraw(); return;
    }
    if (t === 'door' || t === 'window') {
      const hit = C.nearestWall(plan, raw, 16 / this.v.s);
      if (!hit) { app.say('Click on a wall to place a ' + t + '.'); return; }
      const r = this.placeOpening(t, hit, true);
      if (!r.ok) { app.say(r.why); return; }
      app.setSel({ type: 'opening', id: plan.openings[plan.openings.length - 1].id }); app.commit('Add ' + t); return;
    }
    if (t === 'room') { const sp = this.snapPoint(raw, null, true).p; this.rect0 = { a: sp, b: sp }; this.redraw(); return; }
    if (t === 'furn' || t === 'elec' || t === 'plumb' || t === 'stairs') {
      const it = this.newThing(t, this.snapPoint(raw, null, true).p);
      if (t === 'stairs') { plan.stairs.push(it); app.setSel({ type: 'stair', id: it.id }); } else { plan.items.push(it); app.setSel({ type: 'item', id: it.id }); }
      app.commit('Add'); if (t === 'furn' || t === 'stairs') app.setTool('select');
      return;
    }
    // select
    const h = this.hit(raw);
    if (!h) { app.setSel(null); this.drag = { type: 'pan', px, py, ox: this.v.ox, oy: this.v.oy }; this.redraw(); return; }
    if (h.type === 'wallEnd') {
      const w = C.findWall(plan, h.id), pt = w[h.end], mates = [];
      plan.walls.forEach(o => { ['a', 'b'].forEach(k => { if (C.dist(o[k], pt) < 1e-6) mates.push([o, k]); }); });
      this.drag = { type: 'wallEnd', mates, moved: false }; return;
    }
    if (h.type === 'roomPt') { this.drag = { type: 'roomPt', id: h.id, i: h.i, moved: false }; return; }
    app.setSel({ type: h.type, id: h.id });
    if (h.type === 'wall') {
      const w = C.findWall(plan, h.id), mates = [];
      [w.a, w.b].forEach((pt, i) => plan.walls.forEach(o => { ['a', 'b'].forEach(k => { if ((o !== w || k !== (i ? 'b' : 'a')) && C.dist(o[k], pt) < 1e-6) mates.push([o, k]); }); }));
      this.drag = { type: 'wall', id: w.id, start: this.snapPoint(raw, null, true).p, a0: w.a.slice(), b0: w.b.slice(), mates: mates.map(m => [m[0], m[1], m[0][m[1]].slice()]), moved: false };
    } else if (h.type === 'opening') this.drag = { type: 'opening', id: h.id, moved: false };
    else if (h.type === 'room') { const r = plan.rooms.find(q => q.id === h.id); this.drag = { type: 'room', id: h.id, start: this.snapPoint(raw, null, true).p, pts0: r.pts.map(p => p.slice()), moved: false }; }
    else if (h.type === 'item' || h.type === 'stair') { const it = this.findThing(h); this.drag = { type: 'thing', it, start: this.snapPoint(raw, null, true).p, o: [it.x, it.y], moved: false }; }
    this.redraw();
  };
  P.move = function (e) {
    const [px, py] = this.pt(e), raw = this.toWorld(px, py), app = this.app, plan = app.lv(), d = this.drag;
    this.mouse = raw;
    if (d) {
      if (d.type === 'pan') { this.v.ox = d.ox + px - d.px; this.v.oy = d.oy + py - d.py; this.redraw(); return; }
      const sp = this.snapPoint(raw, null, true).p;
      if (d.type === 'wallEnd') { d.mates.forEach(m => { m[0][m[1]] = [sp[0], sp[1]]; }); d.moved = true; }
      else if (d.type === 'wall') {
        const w = C.findWall(plan, d.id), dx = sp[0] - d.start[0], dy = sp[1] - d.start[1];
        w.a = [d.a0[0] + dx, d.a0[1] + dy]; w.b = [d.b0[0] + dx, d.b0[1] + dy];
        d.mates.forEach(m => { m[0][m[1]] = [m[2][0] + dx, m[2][1] + dy]; }); d.moved = true;
      } else if (d.type === 'room') { const r = plan.rooms.find(q => q.id === d.id), dx = sp[0] - d.start[0], dy = sp[1] - d.start[1]; r.pts = d.pts0.map(p => [p[0] + dx, p[1] + dy]); d.moved = true; }
      else if (d.type === 'roomPt') { const r = plan.rooms.find(q => q.id === d.id); r.pts[d.i] = [sp[0], sp[1]]; d.moved = true; }
      else if (d.type === 'thing') { d.it.x = d.o[0] + sp[0] - d.start[0]; d.it.y = d.o[1] + sp[1] - d.start[1]; d.moved = true; }
      else if (d.type === 'opening') {
        const o = plan.openings.find(q => q.id === d.id), w = o && C.findWall(plan, o.wall);
        if (w) { const L = C.wallLen(w); let s = C.segDist(raw, w.a, w.b).t * L; s = Math.round(s / 0.05) * 0.05; s = Math.max(o.w / 2, Math.min(L - o.w / 2, s));
          if (!C.openingsOn(plan, w.id).some(q => q !== o && Math.abs(q.s - s) < (q.w + o.w) / 2 - 1e-6)) { o.s = s; d.moved = true; } }
      }
      app.refreshPanels(true); this.redraw(); return;
    }
    if (this.rect0) { this.rect0.b = this.snapPoint(raw, null, true).p; this.redraw(); return; }
    if (this.tool === 'door' || this.tool === 'window') this.hover = { wall: C.nearestWall(plan, raw, 16 / this.v.s) };
    else if (this.tool === 'furn' || this.tool === 'elec' || this.tool === 'plumb' || this.tool === 'stairs') this.hover = { ghost: this.snapPoint(raw, null, true).p };
    else if (this.tool === 'select') { const h = this.hit(raw); this.hover = h; this.cv.style.cursor = h && (h.type === 'wallEnd' || h.type === 'roomPt') ? 'move' : h ? 'pointer' : 'default'; }
    this.redraw();
  };
  P.up = function (e) {
    const d = this.drag, app = this.app; this.drag = null;
    if (this.tool === 'pan' || this.spaceDown) this.cv.style.cursor = this.tool === 'pan' ? 'grab' : 'default'; else if (this.tool === 'select') this.cv.style.cursor = 'default'; else this.cv.style.cursor = 'crosshair';
    if (d && d.moved) { app.commit('Edit'); }
    if (this.rect0) {
      const r = this.rect0; this.rect0 = null;
      const x0 = Math.min(r.a[0], r.b[0]), x1 = Math.max(r.a[0], r.b[0]), y0 = Math.min(r.a[1], r.b[1]), y1 = Math.max(r.a[1], r.b[1]);
      if (x1 - x0 >= 0.5 && y1 - y0 >= 0.5) {
        const plan = app.lv(); const n = plan.rooms.length + 1;
        plan.rooms.push({ id: newId(plan), name: 'Room ' + n, pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
        app.setSel({ type: 'room', id: plan.rooms[plan.rooms.length - 1].id }); app.commit('Add room');
      }
      this.redraw();
    }
  };

  /* ---------- drawing ---------- */
  P.redraw = function () {
    if (!this.resize()) return;
    const c = this.ctx, dpr = this.dpr, w = this.w, h = this.h, v = this.v, plan = this.app.lv(), sel = this.app.sel, sys = um();
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = PAL.bg; c.fillRect(0, 0, w, h);
    // grid
    const step = this.snapStep, major = sys === 'imperial' ? C.FT * 5 : 1;
    const gs = step * v.s;
    const drawLines = (st, col) => {
      c.strokeStyle = col; c.lineWidth = 1; c.beginPath();
      const x0 = Math.floor(-v.ox / v.s / st) * st, x1 = (w - v.ox) / v.s, y0 = Math.floor(-v.oy / v.s / st) * st, y1 = (h - v.oy) / v.s;
      for (let x = x0; x <= x1; x += st) { const px = Math.round(x * v.s + v.ox) + 0.5; c.moveTo(px, 0); c.lineTo(px, h); }
      for (let y = y0; y <= y1; y += st) { const py = Math.round(y * v.s + v.oy) + 0.5; c.moveTo(0, py); c.lineTo(w, py); }
      c.stroke();
    };
    if (gs >= 7) drawLines(step, PAL.grid);
    if (major * v.s >= 14) drawLines(major, PAL.gridMajor);
    // the floor below, faint, to line walls up; its stairs show where they arrive on this floor
    const app = this.app, below = app.level > 0 ? C.levels(app.plan)[app.level - 1] : null;
    if (below) {
      c.strokeStyle = 'rgba(165,139,242,.35)'; c.lineWidth = 1; c.setLineDash([5, 4]); c.beginPath();
      below.walls.forEach(wl => { const a = this.toScreen(wl.a[0], wl.a[1]), b = this.toScreen(wl.b[0], wl.b[1]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }); c.stroke();
      (below.stairs || []).forEach(s => { const r = C.stairRect(s), a = this.toScreen(r.x0, r.y0), b = this.toScreen(r.x1, r.y1); c.strokeStyle = PAL.accent; c.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        c.setLineDash([]); c.fillStyle = PAL.accent; c.font = '600 11px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('Stair opening', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 4); c.setLineDash([5, 4]); });
      c.setLineDash([]);
    }
    // rooms
    plan.rooms.forEach((r, i) => {
      c.beginPath(); r.pts.forEach((p, k) => { const s = this.toScreen(p[0], p[1]); k ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.closePath();
      c.fillStyle = PAL.room[i % PAL.room.length]; c.fill();
      if (sel && sel.type === 'room' && sel.id === r.id) { c.strokeStyle = PAL.accent; c.lineWidth = 2; c.stroke(); r.pts.forEach(p => { const s = this.toScreen(p[0], p[1]); c.fillStyle = PAL.accent; c.fillRect(s[0] - 4, s[1] - 4, 8, 8); }); }
    });
    // stairs and furniture sit on the floor, under the walls
    (plan.stairs || []).forEach(s => this.drawStair(c, s, sel && sel.type === 'stair' && sel.id === s.id));
    (plan.items || []).forEach(it => { if (it.cat === 'furn') this.drawFurn(c, it, sel && sel.type === 'item' && sel.id === it.id); });
    // walls
    const wallPoly = (wl, extra) => {
      const L = C.wallLen(wl); if (L < 1e-6) return null;
      const dx = (wl.b[0] - wl.a[0]) / L, dy = (wl.b[1] - wl.a[1]) / L, hh = Math.max(wl.t * v.s, 4) / 2 + (extra || 0);
      const a = this.toScreen(wl.a[0], wl.a[1]), b = this.toScreen(wl.b[0], wl.b[1]), nx = -dy * hh, ny = dx * hh;
      return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
    };
    plan.walls.forEach(wl => {
      const q = wallPoly(wl); if (!q) return;
      c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
      c.fillStyle = wl.type === 'ext' ? PAL.ext : PAL.int; c.fill();
      const isSel = sel && sel.type === 'wall' && sel.id === wl.id, isHov = this.hover && this.hover.type === 'wall' && this.hover.id === wl.id;
      if (isSel || isHov) { c.strokeStyle = PAL.accent; c.lineWidth = 2; c.stroke(); }
    });
    // openings
    plan.openings.forEach(o => this.drawOpening(c, o, sel && sel.type === 'opening' && sel.id === o.id));
    (plan.items || []).forEach(it => { if (it.cat !== 'furn') this.drawMarker(c, it, sel && sel.type === 'item' && sel.id === it.id); });
    // dimensions and labels
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (this.showDims) {
      c.font = '11px "Segoe UI", system-ui, sans-serif';
      plan.walls.forEach(wl => {
        const L = C.wallLen(wl); if (L * v.s < 42) return;
        const a = this.toScreen(wl.a[0], wl.a[1]), b = this.toScreen(wl.b[0], wl.b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        // push the label away from the room centre side: outside for exterior walls
        const bb = C.bbox(plan), cx = this.toScreen((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2);
        const sgn = ((mx - cx[0]) * nx + (my - cx[1]) * ny) >= 0 ? 1 : -1, off = wl.type === 'ext' ? 14 + wl.t * v.s / 2 : 10;
        const lx = mx + nx * sgn * off * (wl.type === 'ext' ? 1 : -1), ly = my + ny * sgn * off * (wl.type === 'ext' ? 1 : -1);
        const txt = C.fmtLen(L, sys), tw = c.measureText(txt).width + 8;
        c.fillStyle = 'rgba(15,22,19,.85)'; c.fillRect(lx - tw / 2, ly - 8, tw, 16); c.fillStyle = wl.type === 'ext' ? PAL.text : PAL.muted; c.fillText(txt, lx, ly);
      });
    }
    plan.rooms.forEach(r => {
      const cen = C.centroid(r.pts), s = this.toScreen(cen[0], cen[1]);
      c.fillStyle = PAL.text; c.font = '600 13px "Segoe UI", system-ui, sans-serif'; c.fillText(r.name, s[0], s[1] - 8);
      c.fillStyle = PAL.muted; c.font = '12px "Segoe UI", system-ui, sans-serif'; c.fillText(C.fmtArea(C.polyArea(r.pts), sys), s[0], s[1] + 9);
    });
    // handles for a selected wall
    if (sel && sel.type === 'wall') { const wl = C.findWall(plan, sel.id); if (wl) [wl.a, wl.b].forEach(p => { const s = this.toScreen(p[0], p[1]); c.fillStyle = PAL.accent; c.beginPath(); c.arc(s[0], s[1], 6, 0, 6.3); c.fill(); }); }
    // ghosts
    if (this.draw0 && this.mouse) {
      const sp = this.snapPoint(this.mouse, this.draw0, false).p, a = this.toScreen(this.draw0[0], this.draw0[1]), b = this.toScreen(sp[0], sp[1]);
      const th = Math.max((this.tool === 'wallExt' ? C.DEF.extT : C.DEF.intT) * v.s, 4);
      c.strokeStyle = PAL.accent; c.lineWidth = th; c.globalAlpha = 0.6; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.globalAlpha = 1;
      const txt = C.fmtLen(C.dist(this.draw0, sp), sys); c.font = '600 12px "Segoe UI", system-ui, sans-serif'; const tw = c.measureText(txt).width + 10;
      c.fillStyle = PAL.accent; c.fillRect((a[0] + b[0]) / 2 - tw / 2, (a[1] + b[1]) / 2 - 24, tw, 18); c.fillStyle = '#16102b'; c.fillText(txt, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 15);
    }
    if ((this.tool === 'wallExt' || this.tool === 'wallInt') && this.mouse) { const sp = this.snapPoint(this.mouse, this.draw0, false).p, s = this.toScreen(sp[0], sp[1]); c.strokeStyle = PAL.accent; c.lineWidth = 2; c.beginPath(); c.arc(s[0], s[1], 5, 0, 6.3); c.stroke(); }
    if (this.rect0) {
      const r = this.rect0, a = this.toScreen(Math.min(r.a[0], r.b[0]), Math.min(r.a[1], r.b[1])), b = this.toScreen(Math.max(r.a[0], r.b[0]), Math.max(r.a[1], r.b[1]));
      c.strokeStyle = PAL.accent; c.lineWidth = 2; c.setLineDash([6, 4]); c.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); c.setLineDash([]);
      const txt = C.fmtLen(Math.abs(r.b[0] - r.a[0]), sys) + ' x ' + C.fmtLen(Math.abs(r.b[1] - r.a[1]), sys); c.fillStyle = PAL.accent; c.font = '600 12px "Segoe UI", system-ui, sans-serif'; c.fillText(txt, (a[0] + b[0]) / 2, a[1] - 10);
    }
    if ((this.tool === 'door' || this.tool === 'window') && this.hover && this.hover.wall) {
      const r = this.placeOpening(this.tool, this.hover.wall, false);
      if (r.ok) { r.o.id = -1; this.drawOpening(c, r.o, true, this.hover.wall.wall); }
    }
    if (this.hover && this.hover.ghost && ['furn', 'elec', 'plumb', 'stairs'].indexOf(this.tool) >= 0) {
      const g = this.hover.ghost, nid = plan.nextId, t = this.newThing(this.tool, g); plan.nextId = nid;
      c.globalAlpha = 0.55; if (this.tool === 'stairs') this.drawStair(c, t, true); else if (this.tool === 'furn') this.drawFurn(c, t, true); else this.drawMarker(c, t, true); c.globalAlpha = 1;
    }
    this.drawScale(c);
  };
  /* Rectangle in screen space for a world rectangle. */
  P.sRect = function (r) { const a = this.toScreen(r.x0, r.y0), b = this.toScreen(r.x1, r.y1); return [a[0], a[1], b[0] - a[0], b[1] - a[1]]; };
  P.drawFurn = function (c, it, selected) {
    const f = SB.catalog && SB.catalog.furn(it.kind), r = this.sRect(itemRect(it));
    c.fillStyle = 'rgba(231,239,233,.10)'; c.fillRect(r[0], r[1], r[2], r[3]);
    c.strokeStyle = selected ? PAL.accent : '#b9c4bd'; c.lineWidth = selected ? 2 : 1; c.strokeRect(r[0], r[1], r[2], r[3]);
    c.lineWidth = 1; c.strokeStyle = 'rgba(185,196,189,.6)';
    const kind = it.kind, odd = it.rot % 2 === 1;
    if (/^bed|bunk|crib/.test(kind)) { // pillow line at the head end (rot 0: top)
      const k = 0.18; c.beginPath();
      if (!odd) { const y = it.rot === 0 ? r[1] + r[3] * k : r[1] + r[3] * (1 - k); c.moveTo(r[0] + 3, y); c.lineTo(r[0] + r[2] - 3, y); }
      else { const x = it.rot === 1 ? r[0] + r[2] * (1 - k) : r[0] + r[2] * k; c.moveTo(x, r[1] + 3); c.lineTo(x, r[1] + r[3] - 3); }
      c.stroke();
    } else if (/toilet|basin|sink|bath$/.test(kind)) { c.beginPath(); c.ellipse(r[0] + r[2] / 2, r[1] + r[3] / 2, Math.abs(r[2]) * 0.32, Math.abs(r[3]) * 0.32, 0, 0, 6.3); c.stroke(); }
    if (f && Math.abs(r[2]) > 46 && Math.abs(r[3]) > 16) {
      c.fillStyle = PAL.muted; c.font = '10px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      let txt = f.label; while (txt.length > 3 && c.measureText(txt).width > Math.abs(r[2]) - 6) txt = txt.slice(0, -2);
      c.fillText(txt === f.label ? txt : txt + '.', r[0] + r[2] / 2, r[1] + r[3] / 2);
    }
  };
  P.drawMarker = function (c, it, selected) {
    const m = SB.catalog && SB.catalog.marker(it.cat, it.kind), s = this.toScreen(it.x, it.y), rad = Math.max(8, 0.14 * this.v.s);
    c.fillStyle = it.cat === 'elec' ? '#d9a441' : '#3f9fcf'; c.beginPath(); c.arc(s[0], s[1], rad, 0, 6.3); c.fill();
    c.strokeStyle = selected ? PAL.accent : '#0f1613'; c.lineWidth = selected ? 3 : 1.5; c.stroke();
    c.fillStyle = '#0f1613'; c.font = '700 ' + (m && m.sym.length > 1 ? 8 : 10) + 'px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m ? m.sym : '?', s[0], s[1] + 0.5);
  };
  P.drawStair = function (c, st, selected) {
    const r = C.stairRect(st), q = this.sRect(r), app = this.app, calc = SB.planning ? SB.planning.stairCalc(app.plan, app.level, st) : null, bad = calc && calc.shortBy > 0.01;
    c.fillStyle = 'rgba(165,139,242,.12)'; c.fillRect(q[0], q[1], q[2], q[3]);
    c.strokeStyle = selected ? PAL.accent : bad ? PAL.danger : '#c3b3f7'; c.lineWidth = selected ? 2 : 1.2; c.strokeRect(q[0], q[1], q[2], q[3]);
    const d = r.dir, nx = -d[1], ny = d[0], n = calc ? calc.risers : 15, g = st.len / (n - 1);
    c.lineWidth = 1; c.strokeStyle = 'rgba(195,179,247,.55)'; c.beginPath();
    for (let i = 1; i < n - 1; i++) { const p = [r.bottom[0] + d[0] * g * i, r.bottom[1] + d[1] * g * i], a = this.toScreen(p[0] + nx * st.w / 2, p[1] + ny * st.w / 2), b = this.toScreen(p[0] - nx * st.w / 2, p[1] - ny * st.w / 2); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    c.stroke();
    const a = this.toScreen(r.bottom[0] + d[0] * 0.15, r.bottom[1] + d[1] * 0.15), b = this.toScreen(r.top[0] - d[0] * 0.1, r.top[1] - d[1] * 0.1), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    c.strokeStyle = PAL.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
    c.moveTo(b[0], b[1]); c.lineTo(b[0] - 9 * Math.cos(ang - 0.5), b[1] - 9 * Math.sin(ang - 0.5)); c.moveTo(b[0], b[1]); c.lineTo(b[0] - 9 * Math.cos(ang + 0.5), b[1] - 9 * Math.sin(ang + 0.5)); c.stroke();
    c.fillStyle = PAL.accent; c.font = '700 11px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('UP', a[0] - 12 * Math.cos(ang), a[1] - 12 * Math.sin(ang));
  };
  P.drawOpening = function (c, o, selected, wallOverride) {
    const plan = this.app.lv(), wl = wallOverride || C.findWall(plan, o.wall); if (!wl) return;
    const v = this.v, L = C.wallLen(wl), dx = (wl.b[0] - wl.a[0]) / L, dy = (wl.b[1] - wl.a[1]) / L, nx = -dy, ny = dx;
    const hh = Math.max(wl.t * v.s, 4) / 2 + 1, A = this.toScreen(wl.a[0] + dx * (o.s - o.w / 2), wl.a[1] + dy * (o.s - o.w / 2)), B = this.toScreen(wl.a[0] + dx * (o.s + o.w / 2), wl.a[1] + dy * (o.s + o.w / 2));
    c.fillStyle = PAL.bg; c.beginPath(); c.moveTo(A[0] + nx * hh, A[1] + ny * hh); c.lineTo(B[0] + nx * hh, B[1] + ny * hh); c.lineTo(B[0] - nx * hh, B[1] - ny * hh); c.lineTo(A[0] - nx * hh, A[1] - ny * hh); c.closePath(); c.fill();
    c.lineWidth = 1.5; c.strokeStyle = selected ? PAL.accent : (o.type === 'window' ? PAL.win : PAL.text);
    if (o.type === 'window') {
      c.lineWidth = 2; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
      c.lineWidth = 1; [-1, 1].forEach(k => { c.beginPath(); c.moveTo(A[0] + nx * hh * 0.55 * k, A[1] + ny * hh * 0.55 * k); c.lineTo(B[0] + nx * hh * 0.55 * k, B[1] + ny * hh * 0.55 * k); c.stroke(); });
    } else {
      const bb = C.bbox(plan); let sg = 1;
      if (wl.type === 'ext') { const mx = (wl.a[0] + wl.b[0]) / 2 - (bb.x0 + bb.x1) / 2, mz = (wl.a[1] + wl.b[1]) / 2 - (bb.y0 + bb.y1) / 2; sg = (mx * (-dy) + mz * dx >= 0) ? -1 : 1; }
      if (o.flip) sg = -sg;
      const r = o.w * v.s, lx = A[0] + nx * sg * r, ly = A[1] + ny * sg * r;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(lx, ly); c.stroke();
      c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath();
      const a0 = Math.atan2(ly - A[1], lx - A[0]), a1 = Math.atan2(B[1] - A[1], B[0] - A[0]);
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      c.arc(A[0], A[1], r, a0, a0 + da, da < 0); c.stroke(); c.setLineDash([]);
    }
  };
  P.drawScale = function (c) {
    const v = this.v, sys = um(), unit = sys === 'imperial' ? C.FT : 1; let len = 1;
    const opts = [0.5, 1, 2, 5, 10, 20, 50, 100]; for (const o of opts) { len = o; if (o * unit * v.s >= 70) break; }
    const px = len * unit * v.s, x = 16, y = this.h - 18;
    c.strokeStyle = PAL.muted; c.fillStyle = PAL.muted; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x, y); c.lineTo(x + px, y); c.lineTo(x + px, y - 5); c.stroke();
    c.font = '11px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'left'; c.fillText(len + (sys === 'imperial' ? ' ft' : ' m'), x + 4, y - 9); c.textAlign = 'center';
  };
  SB.Editor = Editor;
})(typeof window !== 'undefined' ? window : globalThis);
