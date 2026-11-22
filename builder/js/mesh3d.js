/* Stark Builder, by Stark. Turns a plan (or a whole site) into triangle lists for the WebGL viewer.
   Vertex layout: x y z, nx ny nz, r g b  (9 floats). World: x right, y up, z toward the viewer = plan y (south).
   Written from scratch; no libraries. Pure functions, so it also runs under Node for the tests. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const C = SB.core || (typeof require !== 'undefined' ? require('./core.js') : null);
  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const COL = { cladding: hex('#b9a58a'), plaster: hex('#ece6da'), trim: hex('#6f625a'), frame: hex('#f2efe8'), glass: hex('#9ccfe6'), door: hex('#8a5d3b'),
    wood: hex('#b88e5f'), tile: hex('#a9b8c0'), kitchen: hex('#c9b79a'), concrete: hex('#9a9a96'), slab: hex('#8d8a84'), roof: hex('#4b5560'), roofUnder: hex('#cdb28a'),
    ground: hex('#6f8a5a'), path: hex('#b8ad98'), solar: hex('#24344f'), water: hex('#4f93b5'), septic: hex('#8a7b5c'), power: hex('#5a4a38'), parking: hex('#a49d8d'),
    site: hex('#3f5a3a'), edge: hex('#ffffff'), ceiling: hex('#f7f4ee') };

  function Mesh(tf) { this.v = []; this.tf = tf || null; }
  Mesh.prototype.vert = function (p, n, c) {
    const t = this.tf;
    if (t) {
      const x = p[0] - t.cx, z = p[2] - t.cz;
      this.v.push(t.ox + x * t.c + z * t.s, p[1], t.oz - x * t.s + z * t.c, n[0] * t.c + n[2] * t.s, n[1], -n[0] * t.s + n[2] * t.c, c[0], c[1], c[2]);
    } else this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2]);
  };
  Mesh.prototype.tri = function (a, b, c, n, col) { this.vert(a, n, col); this.vert(b, n, col); this.vert(c, n, col); };
  Mesh.prototype.quad = function (a, b, c, d, n, col) { this.tri(a, b, c, n, col); this.tri(a, c, d, n, col); };
  /* Oriented box. center, half extents, yaw about Y, tilt about local x, colours [+x,-x,+y,-y,+z,-z] or one colour. */
  Mesh.prototype.box = function (cn, hf, yaw, tilt, cols) {
    const cy = Math.cos(yaw || 0), sy = Math.sin(yaw || 0), ct = Math.cos(tilt || 0), st = Math.sin(tilt || 0);
    const rot = v => { const y2 = v[1] * ct - v[2] * st, z2 = v[1] * st + v[2] * ct; return [v[0] * cy + z2 * sy, y2, -v[0] * sy + z2 * cy]; };
    const P = (x, y, z) => { const r = rot([x * hf[0], y * hf[1], z * hf[2]]); return [cn[0] + r[0], cn[1] + r[1], cn[2] + r[2]]; };
    const faces = [[[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1], [1, 0, 0]], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1], [-1, 0, 0]],
      [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [0, 1, 0]], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [0, -1, 0]],
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1], [0, 0, -1]]];
    faces.forEach((f, i) => {
      const col = cols.length === 3 && typeof cols[0] === 'number' ? cols : cols[i];
      this.quad(P(f[0][0], f[0][1], f[0][2]), P(f[1][0], f[1][1], f[1][2]), P(f[2][0], f[2][1], f[2][2]), P(f[3][0], f[3][1], f[3][2]), rot(f[4]), col);
    });
  };
  Mesh.prototype.array = function () { return new Float32Array(this.v); };

  const floorColor = name => (/bath|toilet|wc/i.test(name) ? COL.tile : /kitchen/i.test(name) ? COL.kitchen : /shop|storage|laundry/i.test(name) ? COL.concrete : COL.wood);

  /* ----- one building: every floor stacked, furniture, stairs, and the roof over the top floor ----- */
  const FURN_COL = { Bedroom: hex('#8b97a8'), Living: hex('#9a8f84'), Dining: hex('#a07a55'), Kitchen: hex('#ddd8cb'), Bath: hex('#f1f1ef'), Utility: hex('#d6d8da'), Work: hex('#a07a55') };
  const CAT = () => SB.catalog || (typeof require !== 'undefined' ? require('../data/catalog.js') : null);
  function addLevel(plan, k, base, glass) {
    const lv = C.levels(plan)[k], E = C.levelElev(plan, k), H = C.wallH(lv), bb = C.bbox(lv), cx = (bb.x0 + bb.x1) / 2, cz = (bb.y0 + bb.y1) / 2;
    // slab and floors. Upper floors: a slab over this floor and the one below, with the stair openings left open.
    let holes = [];
    if (k === 0) {
      const sm = 0.15;
      base.box([cx, -0.075, cz], [bb.w / 2 + sm, 0.075, bb.d / 2 + sm], 0, 0, COL.slab);
      base.quad([bb.x0, 0.004, bb.y0], [bb.x0, 0.004, bb.y1], [bb.x1, 0.004, bb.y1], [bb.x1, 0.004, bb.y0], [0, 1, 0], COL.wood);
    } else {
      const below = C.levels(plan)[k - 1], b1 = C.bbox(below);
      const R = { x0: Math.min(bb.x0, b1.x0), y0: Math.min(bb.y0, b1.y0), x1: Math.max(bb.x1, b1.x1), y1: Math.max(bb.y1, b1.y1) };
      holes = (below.stairs || []).map(C.stairRect);
      C.rectMinus(R, holes).forEach(r => base.box([(r.x0 + r.x1) / 2, E - C.FLOOR_T / 2, (r.y0 + r.y1) / 2], [(r.x1 - r.x0) / 2, C.FLOOR_T / 2, (r.y1 - r.y0) / 2], 0, 0,
        [COL.slab, COL.slab, COL.wood, COL.ceiling, COL.slab, COL.slab]));
    }
    lv.rooms.forEach(r => {
      if (holes.some(h => r.pts.some(p => p[0] > h.x0 - 1e-6 && p[0] < h.x1 + 1e-6 && p[1] > h.y0 - 1e-6 && p[1] < h.y1 + 1e-6) || C.pointInPoly([(h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2], r.pts))) return;
      const col = floorColor(r.name), y = E + 0.012;
      C.triangulate(r.pts).forEach(t => base.tri([r.pts[t[0]][0], y, r.pts[t[0]][1]], [r.pts[t[2]][0], y, r.pts[t[2]][1]], [r.pts[t[1]][0], y, r.pts[t[1]][1]], [0, 1, 0], col));
    });
    // walls with openings cut out
    lv.walls.forEach(w => {
      const L = C.wallLen(w), th = w.t, dx = (w.b[0] - w.a[0]) / L, dz = (w.b[1] - w.a[1]) / L;
      const theta = Math.atan2(dz, dx), yaw = -theta, nx = -dz, nz = dx;
      const ext = th / 2;
      let outward = 0;
      if (w.type === 'ext') { const mx = (w.a[0] + w.b[0]) / 2 - cx, mz = (w.a[1] + w.b[1]) / 2 - cz; outward = mx * nx + mz * nz >= 0 ? 1 : -1; }
      // faces [+x,-x,+y,-y,+z,-z]; +z faces along (nx,nz)
      const cPlus = outward === 1 ? COL.cladding : COL.plaster, cMinus = outward === -1 ? COL.cladding : COL.plaster;
      const cols = [COL.plaster, COL.plaster, COL.trim, COL.trim, cPlus, cMinus];
      const at = (s, y) => [w.a[0] + dx * s, E + y, w.a[1] + dz * s];
      const piece = (s0, s1, y0, y1) => {
        if (s1 - s0 < 1e-4 || y1 - y0 < 1e-4) return;
        const m = at((s0 + s1) / 2, (y0 + y1) / 2);
        base.box(m, [(s1 - s0) / 2, (y1 - y0) / 2, th / 2], yaw, 0, cols);
      };
      const ops = C.openingsOn(lv, w.id).slice().sort((p, q) => p.s - q.s);
      let cur = -ext;
      ops.forEach(o => {
        const s0 = Math.max(-ext, o.s - o.w / 2), s1 = Math.min(L + ext, o.s + o.w / 2);
        const top = Math.min(o.sill + o.h, H);
        piece(cur, s0, 0, H);
        piece(s0, s1, 0, o.sill);
        piece(s0, s1, top, H);
        cur = s1;
        const mid = (s0 + s1) / 2;
        if (o.type === 'window') {
          const fr = 0.05, cy = (o.sill + top) / 2;
          base.box(at(mid, o.sill + fr / 2), [(s1 - s0) / 2, fr / 2, th / 2 + 0.01], yaw, 0, COL.frame);
          base.box(at(mid, top - fr / 2), [(s1 - s0) / 2, fr / 2, th / 2 + 0.01], yaw, 0, COL.frame);
          base.box(at(s0 + fr / 2, cy), [fr / 2, (top - o.sill) / 2, th / 2 + 0.01], yaw, 0, COL.frame);
          base.box(at(s1 - fr / 2, cy), [fr / 2, (top - o.sill) / 2, th / 2 + 0.01], yaw, 0, COL.frame);
          // glass is drawn in its own translucent pass
          glass.quad(at(s0 + fr, o.sill + fr), at(s1 - fr, o.sill + fr), at(s1 - fr, top - fr), at(s0 + fr, top - fr), [nx, 0, nz], COL.glass);
        } else {
          const fr = 0.05;
          base.box(at(mid, top - fr / 2), [(s1 - s0) / 2, fr / 2, th / 2 + 0.01], yaw, 0, COL.frame);
          base.box(at(s0 + fr / 2, top / 2), [fr / 2, top / 2, th / 2 + 0.01], yaw, 0, COL.frame);
          base.box(at(s1 - fr / 2, top / 2), [fr / 2, top / 2, th / 2 + 0.01], yaw, 0, COL.frame);
          // door leaf swung open about 90 degrees on its hinge, into the room (exterior doors swing inward)
          const sgn = (outward === 1 ? -1 : 1) * (o.flip ? -1 : 1), lw = (s1 - s0) - 0.1;
          const hx = at(s0 + 0.04, 0), ox = nx * sgn, oz = nz * sgn;
          const lc = [hx[0] + ox * (lw / 2 + th / 2), E + (top - 0.03) / 2, hx[2] + oz * (lw / 2 + th / 2)];
          base.box(lc, [lw / 2, (top - 0.03) / 2, 0.02], Math.atan2(-oz, ox), 0, COL.door);
        }
      });
      piece(cur, L + ext, 0, H);
    });
    // furniture as simple blocks (electrical and plumbing symbols stay on the 2D plan)
    const cat = CAT();
    (lv.items || []).forEach(it => {
      if (it.cat !== 'furn') return;
      const f = cat && cat.furn(it.kind), h = f ? f.h : 0.8, odd = it.rot % 2 === 1;
      base.box([it.x, E + h / 2 + 0.013, it.y], [(odd ? it.d : it.w) / 2, h / 2, (odd ? it.w : it.d) / 2], 0, 0, FURN_COL[f ? f.group : 'Living'] || COL.wood);
    });
    // stairs: solid steps from this floor up to the next
    (lv.stairs || []).forEach(s => {
      const r = C.stairRect(s), rise = H + C.FLOOR_T, n = Math.max(2, Math.ceil(rise / 0.19 - 1e-9)), riser = rise / n, treads = n - 1, g = s.len / treads, d = r.dir;
      for (let i = 0; i < treads; i++) {
        const along = (i + 0.5) * g, top = (i + 1) * riser, c = [r.bottom[0] + d[0] * along, E + top / 2, r.bottom[1] + d[1] * along];
        base.box(c, d[0] !== 0 ? [g / 2, top / 2, s.w / 2] : [s.w / 2, top / 2, g / 2], 0, 0, [COL.door, COL.door, COL.wood, COL.door, COL.door, COL.door]);
      }
    });
  }
  /* Roof over a floor whose top is at height Hb and whose outer box is bb. */
  function addRoof(rf, bb, Hb, base, roofM) {
    const r = rf || { type: 'gable', pitch: 25, overhang: 0.3 }, H = Hb, cx = (bb.x0 + bb.x1) / 2, cz = (bb.y0 + bb.y1) / 2;
    const o = r.overhang || 0, flat = r.type === 'flat', p = (flat ? 2 : r.pitch) * Math.PI / 180, tp = Math.tan(p), cp = Math.cos(p);
    const alongX = bb.w >= bb.d, Lg = alongX ? bb.w : bb.d, Sh = alongX ? bb.d : bb.w;
    // local (u along the ridge, v across) to world
    const W = (u, v, y) => (alongX ? [cx + u, y, cz + v] : [cx - v, y, cz + u]);
    const yaw0 = alongX ? 0 : -Math.PI / 2, cladCols = COL.cladding;
    const nrm = (nu, nv, ny) => { const w1 = W(nu, nv, ny), w0 = W(0, 0, 0); return [w1[0] - w0[0], ny, w1[2] - w0[2]]; };
    const slab = (vc, yc, halfV, tilt) => roofM.box(W(0, vc, yc), [Lg / 2 + o, 0.06, halfV], yaw0, tilt, [COL.roof, COL.roof, COL.roof, COL.roofUnder, COL.roof, COL.roof]);
    const capTri = (u, pts) => {
      const n = nrm(u > 0 ? 1 : -1, 0, 0);
      for (let i = 1; i < pts.length - 1; i++) base.tri(W(u, pts[0][0], pts[0][1]), W(u, pts[i][0], pts[i][1]), W(u, pts[i + 1][0], pts[i + 1][1]), n, cladCols);
    };
    const cap = Lg / 2 + 0.075;
    if (flat) {
      slab(0, H + 0.06, Sh / 2 + o, 0);
      roofM.quad(W(-Lg / 2, -Sh / 2, H), W(Lg / 2, -Sh / 2, H), W(Lg / 2, Sh / 2, H), W(-Lg / 2, Sh / 2, H), [0, -1, 0], COL.ceiling);
    } else if (r.type === 'gable') {
      const yr = H + (Sh / 2) * tp, ye = H - o * tp, yc = (yr + ye) / 2 + 0.05, hv = (Sh / 2 + o) / cp / 2, vc = (Sh / 4 + o / 2);
      slab(vc, yc, hv, p); slab(-vc, yc, hv, -p);
      [cap, -cap].forEach(u => { capTri(u, [[-Sh / 2, H], [Sh / 2, H], [0, yr]]); });
    } else { // shed: high side at -v
      const yh = H + Sh * tp;
      slab(0, H + Sh * tp / 2 + 0.05, (Sh + 2 * o) / cp / 2, p);
      [cap, -cap].forEach(u => { capTri(u, [[-Sh / 2, H], [Sh / 2, H], [-Sh / 2, yh]]); });
      base.box(W(0, -Sh / 2, (H + yh) / 2), [Lg / 2 + 0.075, (yh - H) / 2, 0.075], yaw0, 0, cladCols);
    }
  }
  /* opts.upTo: show floors up to this index (a cut-away hides the roof). */
  function addBuilding(plan, base, roofM, glass, opts) {
    opts = opts || {};
    const L = C.levels(plan), upTo = Math.max(0, Math.min(L.length - 1, opts.upTo == null ? L.length - 1 : opts.upTo));
    for (let k = 0; k <= upTo; k++) addLevel(plan, k, base, glass);
    const top = L[upTo], tb = C.bbox(top), Htop = C.levelElev(plan, upTo) + C.wallH(top), bb = C.bbox(plan);
    if (upTo === L.length - 1 && tb.w > 0) addRoof(plan.roof, tb, Htop, base, roofM);
    return { cx: (bb.x0 + bb.x1) / 2, cz: (bb.y0 + bb.y1) / 2, bb, H: Htop };
  }
  function build(plan, tf, opts) {
    const base = new Mesh(tf), roof = new Mesh(tf), glass = new Mesh(tf);
    const info = addBuilding(plan, base, roof, glass, opts);
    return { base, roof, glass, info };
  }
  /* Single building scene for the walkthrough/orbit view. opts: {upTo, walkLevel}. */
  function buildPlan(plan, opts) {
    opts = opts || {};
    const b = build(plan, null, opts), info = b.info, L = C.levels(plan), wl = Math.max(0, Math.min(L.length - 1, opts.walkLevel || 0)), lv = L[wl];
    const gx = Math.max(info.bb.w, info.bb.d) * 3 + 20;
    b.base.quad([info.cx - gx, -0.16, info.cz - gx], [info.cx - gx, -0.16, info.cz + gx], [info.cx + gx, -0.16, info.cz + gx], [info.cx + gx, -0.16, info.cz - gx], [0, 1, 0], COL.ground);
    const first = lv.rooms[0] ? C.centroid(lv.rooms[0].pts) : [info.cx, info.cz];
    return { base: b.base.array(), roof: b.roof.array(), glass: b.glass.array(), center: [info.cx, info.H / 2, info.cz],
      radius: Math.max(info.bb.w, info.bb.d, info.H), start: first, eye: C.levelElev(plan, wl) + 1.6, flatRoof: (plan.roof || {}).type === 'flat', segs: collisionSegs(lv), blocks: stairBlocks(lv) };
  }
  /* Stairs are solid in the walkthrough: their outline as thin collision segments. */
  function stairBlocks(lv) {
    const out = [];
    (lv.stairs || []).forEach(s => { const r = C.stairRect(s), P = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
      P.forEach((p, i) => { const q = P[(i + 1) % 4]; out.push({ ax: p[0], az: p[1], bx: q[0], bz: q[1], r: 0.02 }); }); });
    return out;
  }
  /* Solid wall pieces for walking collision: each wall minus its door openings, expanded by half its thickness. */
  function collisionSegs(plan) {
    const segs = [];
    plan.walls.forEach(w => {
      const L = C.wallLen(w), dx = (w.b[0] - w.a[0]) / L, dz = (w.b[1] - w.a[1]) / L;
      const doors = C.openingsOn(plan, w.id).filter(o => o.type === 'door').sort((a, b) => a.s - b.s);
      let cur = 0;
      const push = (s0, s1) => { if (s1 - s0 > 0.02) segs.push({ ax: w.a[0] + dx * s0, az: w.a[1] + dz * s0, bx: w.a[0] + dx * s1, bz: w.a[1] + dz * s1, r: w.t / 2 }); };
      doors.forEach(o => { push(cur, o.s - o.w / 2); cur = o.s + o.w / 2; });
      push(cur, L);
    });
    return segs;
  }
  /* Whole site: buildings with transforms, paths, utilities and the lot. */
  function buildSite(site) {
    const base = new Mesh(null), roof = new Mesh(null), glass = new Mesh(null);
    const gx = Math.max(site.w, site.d) * 1.5;
    base.quad([-gx, -0.2, -gx], [-gx, -0.2, site.d + gx], [site.w + gx, -0.2, site.d + gx], [site.w + gx, -0.2, -gx], [0, 1, 0], COL.ground);
    base.quad([0, -0.17, 0], [0, -0.17, site.d], [site.w, -0.17, site.d], [site.w, -0.17, 0], [0, 1, 0], COL.site);
    const strip = (x0, z0, x1, z1) => base.box([(x0 + x1) / 2, -0.1, (z0 + z1) / 2], [Math.abs(x1 - x0) / 2 + 0.05, 0.08, Math.abs(z1 - z0) / 2 + 0.05], 0, 0, COL.edge);
    strip(0, 0, site.w, 0); strip(0, site.d, site.w, site.d); strip(0, 0, 0, site.d); strip(site.w, 0, site.w, site.d);
    site.paths.forEach(p => {
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1], b = p.pts[i], L = C.dist(a, b); if (L < 0.01) continue;
        base.box([(a[0] + b[0]) / 2, -0.1, (a[1] + b[1]) / 2], [L / 2, 0.02, p.w / 2], -Math.atan2(b[1] - a[1], b[0] - a[0]), 0, COL.path);
      }
    });
    const U = { solar: [4, 2, 0.5, COL.solar], water: [2, 2, 2, COL.water], septic: [5, 3, 0.2, COL.septic], power: [0.3, 0.3, 6, COL.power], parking: [5, 3, 0.1, COL.parking] };
    site.utils.forEach(u => {
      const d = U[u.kind];
      if (u.kind === 'solar') base.box([u.x, 0.6, u.y], [d[0] / 2, 0.05, d[1] / 2], 0, 0.5, COL.solar);
      else base.box([u.x, d[2] / 2 - 0.1, u.y], [d[0] / 2, d[2] / 2, d[1] / 2], 0, 0, d[3]);
    });
    const roofAll = new Mesh(null), glassAll = new Mesh(null);
    site.buildings.forEach(b => {
      const bb = C.bbox(b.plan); const ang = b.rot * Math.PI / 2;
      const tf = { cx: (bb.x0 + bb.x1) / 2, cz: (bb.y0 + bb.y1) / 2, ox: b.x, oz: b.y, c: Math.round(Math.cos(ang)), s: Math.round(Math.sin(ang)) };
      const m = build(b.plan, tf);
      base.v.push.apply(base.v, m.base.v); roofAll.v.push.apply(roofAll.v, m.roof.v); glassAll.v.push.apply(glassAll.v, m.glass.v);
    });
    return { base: base.array(), roof: roofAll.array(), glass: glassAll.array(), center: [site.w / 2, 0, site.d / 2], radius: Math.max(site.w, site.d) };
  }
  SB.mesh = { buildPlan, buildSite, collisionSegs, stairBlocks, COL, Mesh };
  if (typeof module !== 'undefined' && module.exports) module.exports = SB.mesh;
})(typeof window !== 'undefined' ? window : globalThis);
