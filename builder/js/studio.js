/* Stark Builder, by Stark. Studio maths: sun and shadow, cost risk range, 3D model export (GLB and OBJ), fuzzy command search and
   plain-language questions about the plan. Pure functions with no DOM, so they also run under Node for the tests. All of it is a
   planning aid: rough numbers from the figures you enter, not an energy, daylight or cost guarantee. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const C = SB.core || (typeof require !== 'undefined' ? require('./core.js') : null);
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayOfYear = (m, d) => { let n = d; for (let i = 0; i < m; i++) n += MONTH_DAYS[i]; return n; };
  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const compassName = b => COMPASS[Math.round((((b % 360) + 360) % 360) / 45) % 8];
  const PLACES = [['Reykjavik', 64.1], ['Oslo', 59.9], ['London', 51.5], ['Berlin', 52.5], ['Toronto', 43.7], ['Rome', 41.9], ['New York', 40.7], ['Denver', 39.7], ['Seoul', 37.6],
    ['Los Angeles', 34.1], ['Cairo', 30.0], ['Houston', 29.8], ['Mexico City', 19.4], ['Nairobi', -1.3], ['Lima', -12.0], ['Sydney', -33.9], ['Cape Town', -33.9], ['Buenos Aires', -34.6], ['Wellington', -41.3]];

  /* ---------- sun position (solar time, no equation of time, no refraction) ---------- */
  /* lat degrees north; doy 1..365; hour = local solar time 0..24. Returns altitude and compass azimuth (0 = north, 90 = east) in degrees. */
  function sunPos(lat, doy, hour) {
    const decl = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365) * RAD, la = lat * RAD, H = (hour - 12) * 15 * RAD;
    const sinAlt = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(H), alt = Math.asin(clamp(sinAlt, -1, 1));
    const ca = Math.cos(alt);
    let az;
    if (ca < 1e-9) az = 180;
    else {
      const cosAz = clamp((Math.sin(decl) - Math.sin(alt) * Math.sin(la)) / (ca * Math.cos(la) || 1e-9), -1, 1);
      az = Math.acos(cosAz) * DEG;
      if (Math.sin(H) > 0) az = 360 - az; /* afternoon: west of south */
    }
    return { alt: alt * DEG, az };
  }
  function dayInfo(lat, doy) {
    let rise = null, set = null, prev = sunPos(lat, doy, 0).alt, maxAlt = -90, dl = 0;
    for (let i = 1; i <= 1440; i++) {
      const t = i / 60, a = sunPos(lat, doy, t).alt;
      if (a > maxAlt) maxAlt = a;
      if (a > 0) dl += 1 / 60;
      if (prev <= 0 && a > 0 && rise === null) rise = t;
      if (prev > 0 && a <= 0) set = t;
      prev = a;
    }
    return { rise, set, hours: C.round(dl, 2), noonAlt: C.round(maxAlt, 1) };
  }
  /* Dome points for one day, every 20 minutes while the sun is up. */
  function sunPath(lat, doy) {
    const out = [];
    for (let t = 0; t <= 24.001; t += 1 / 3) { const p = sunPos(lat, doy, t); if (p.alt > 0) out.push({ t: C.round(t, 2), alt: p.alt, az: p.az }); }
    return out;
  }
  /* ---------- shadow of the building box on the ground ---------- */
  function hull(pts) {
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (P.length < 3) return P;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    P.forEach(p => { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  /* Plan frame: x east, y south when northDeg = 0. northDeg is the compass bearing of the top of the plan.
     Returns {poly, len} (poly in plan metres) or null when the sun is down or lower than 1 degree. */
  function shadow(rect, height, sun, northDeg) {
    if (!sun || sun.alt < 1 || !(height > 0)) return null;
    const len = Math.min(height / Math.tan(sun.alt * RAD), height * 40), b = (sun.az - (northDeg || 0)) * RAD, dx = -Math.sin(b) * len, dy = Math.cos(b) * len;
    const c = [[rect.x0, rect.y0], [rect.x1, rect.y0], [rect.x1, rect.y1], [rect.x0, rect.y1]];
    return { poly: hull(c.concat(c.map(p => [p[0] + dx, p[1] + dy]))), len };
  }
  /* ---------- sun on windows ---------- */
  /* One row per window or glazed door on an outside wall: which way it faces and the hours the sun is in front of it.
     Rough: ignores neighbours, trees, roof overhangs and the wall thickness. */
  function windowSun(plan, lat, doy, northDeg) {
    const bb = C.bbox(plan), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, L = C.levels(plan), rows = [];
    const samples = []; for (let t = 0; t < 24; t += 0.25) { const p = sunPos(lat, doy, t); if (p.alt > 2) samples.push(p); }
    L.forEach((lv, k) => (lv.openings || []).forEach(o => {
      if (o.type !== 'window' && !(o.type === 'door' && o.w > 1.5)) return;
      const w = C.findWall(lv, o.wall); if (!w || w.type !== 'ext') return;
      const len = C.wallLen(w), dx = (w.b[0] - w.a[0]) / len, dy = (w.b[1] - w.a[1]) / len;
      let nx = dy, ny = -dx; const mx = w.a[0] + dx * o.s - cx, my = w.a[1] + dy * o.s - cy;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      const face = (((northDeg || 0) + Math.atan2(nx, -ny) * DEG) % 360 + 360) % 360;
      let n = 0, peak = 0;
      samples.forEach(p => { let d = Math.abs(p.az - face); if (d > 180) d = 360 - d; if (d < 85) { n++; peak = Math.max(peak, p.alt); } });
      rows.push({ floor: k + 1, id: o.id, kind: o.type === 'window' ? 'Window' : 'Glazed door', w: o.w, h: o.h, facing: C.round(face, 0), dir: compassName(face), hours: C.round(n * 0.25, 1), area: C.round(o.w * o.h, 2) });
    }));
    return rows;
  }
  /* Glass area by facing, with the hours of direct sun. Helpful for the shading and orientation question, nothing more. */
  function orientationSummary(rows) {
    const m = {};
    rows.forEach(r => { const d = m[r.dir] = m[r.dir] || { dir: r.dir, area: 0, n: 0, hours: 0 }; d.area += r.area; d.n++; d.hours = Math.max(d.hours, r.hours); });
    return Object.keys(m).map(k => ({ dir: k, n: m[k].n, area: C.round(m[k].area, 2), hours: m[k].hours })).sort((a, b) => COMPASS.indexOf(a.dir) - COMPASS.indexOf(b.dir));
  }

  /* ---------- cost risk range (seeded Monte Carlo, runs in a blink) ---------- */
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function normal(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const VOL = { low: 0.08, medium: 0.15, high: 0.28 };
  /* lines: [{group, cost}]. Each line cost is scaled by a lognormal price factor (a share of it moves with the whole market) times a smaller
     quantity-error factor. opts: vol (low|medium|high or a number), market share rho 0..1, qtyErr, runs, seed, contingency %, only (a group to vary alone). */
  function riskSim(lines, opts) {
    opts = opts || {};
    const sig = typeof opts.vol === 'number' ? opts.vol : (VOL[opts.vol] != null ? VOL[opts.vol] : VOL.medium), rho = clamp(opts.rho == null ? 0.5 : opts.rho, 0, 1);
    const sq = opts.qtyErr == null ? 0.05 : opts.qtyErr, runs = clamp(Math.round(opts.runs || 4000), 200, 40000), r = rng(opts.seed == null ? 20260101 : opts.seed);
    const cont = 1 + clamp(opts.contingency || 0, 0, 100) / 100;
    const base = lines.filter(l => l.cost > 0 && (!opts.only || l.group === opts.only));
    const fixed = lines.filter(l => l.cost > 0 && opts.only && l.group !== opts.only).reduce((s, l) => s + l.cost, 0);
    const nominal = lines.reduce((s, l) => s + (l.cost > 0 ? l.cost : 0), 0), totals = new Float64Array(runs);
    const mu = sig * sig / 2, mq = sq * sq / 2;
    for (let i = 0; i < runs; i++) {
      const zc = normal(r); let s = fixed;
      for (let j = 0; j < base.length; j++) {
        const zl = normal(r), zq = normal(r);
        s += base[j].cost * Math.exp(sig * (Math.sqrt(rho) * zc + Math.sqrt(1 - rho) * zl) - mu) * Math.exp(sq * zq - mq);
      }
      totals[i] = s * cont;
    }
    const sorted = Float64Array.from(totals).sort(), q = p => sorted[Math.min(runs - 1, Math.floor(p * runs))];
    const lo = sorted[0], hi = sorted[runs - 1], bins = 28, hist = new Array(bins).fill(0), span = (hi - lo) || 1;
    for (let i = 0; i < runs; i++) hist[Math.min(bins - 1, Math.floor((totals[i] - lo) / span * bins))]++;
    let mean = 0; for (let i = 0; i < runs; i++) mean += totals[i]; mean /= runs;
    return { runs, nominal: nominal * cont, mean, p10: q(0.1), p50: q(0.5), p90: q(0.9), min: lo, max: hi, hist, lo, hi, sorted };
  }
  /* Chance the total lands at or under a budget. */
  function chanceUnder(sim, budget) {
    const s = sim.sorted; let a = 0, b = s.length;
    while (a < b) { const m = (a + b) >> 1; if (s[m] <= budget) a = m + 1; else b = m; }
    return a / s.length;
  }
  /* Budget needed for a wanted confidence (0.5 .. 0.99). */
  function budgetFor(sim, conf) { return sim.sorted[Math.min(sim.sorted.length - 1, Math.floor(clamp(conf, 0.01, 0.999) * sim.sorted.length))]; }
  /* Which cost group moves the answer most: each group varied alone, the width between its 10th and 90th percentile. */
  function tornado(lines, opts) {
    const groups = []; lines.forEach(l => { if (l.cost > 0 && groups.indexOf(l.group) < 0) groups.push(l.group); });
    return groups.map(gp => { const s = riskSim(lines, Object.assign({}, opts, { only: gp, runs: Math.min(opts && opts.runs || 2000, 2000), contingency: 0 })); return { group: gp, low: s.p10, high: s.p90, swing: s.p90 - s.p10 }; }).sort((a, b) => b.swing - a.swing);
  }

  /* ---------- 3D export ---------- */
  /* parts: [{name, data: Float32Array x y z nx ny nz r g b, alpha?}]. Returns a Uint8Array holding a binary glTF 2.0 file. */
  function toGLB(parts, title) {
    parts = parts.filter(p => p.data && p.data.length >= 27);
    const bins = [], views = [], acc = [], meshes = [], mats = [], nodes = [];
    let off = 0;
    const push = (u8) => { const pad = (4 - (u8.length % 4)) % 4, o = new Uint8Array(u8.length + pad); o.set(u8); bins.push(o); const at = off; off += o.length; return { at, len: u8.length }; };
    parts.forEach((p, pi) => {
      const n = p.data.length / 9, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30];
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
        const v = p.data[i * 9 + k]; pos[i * 3 + k] = v; nor[i * 3 + k] = p.data[i * 9 + 3 + k]; col[i * 3 + k] = p.data[i * 9 + 6 + k];
        if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
      }
      const attr = {};
      [['POSITION', pos, true], ['NORMAL', nor, false], ['COLOR_0', col, false]].forEach(a => {
        const b = push(new Uint8Array(a[1].buffer)); views.push({ buffer: 0, byteOffset: b.at, byteLength: b.len, target: 34962 });
        const ac = { bufferView: views.length - 1, componentType: 5126, count: n, type: 'VEC3' }; if (a[2]) { ac.min = mn; ac.max = mx; }
        acc.push(ac); attr[a[0]] = acc.length - 1;
      });
      mats.push(p.alpha ? { name: p.name, alphaMode: 'BLEND', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, p.alpha], metallicFactor: 0, roughnessFactor: 0.4 }, doubleSided: true }
        : { name: p.name, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.9 } });
      meshes.push({ name: p.name, primitives: [{ attributes: attr, material: pi, mode: 4 }] }); nodes.push({ mesh: pi, name: p.name });
    });
    const json = { asset: { version: '2.0', generator: 'Stark Builder' + (title ? ' - ' + title : '') }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials: mats, accessors: acc, bufferViews: views, buffers: [{ byteLength: off }] };
    let js = new TextEncoder().encode(JSON.stringify(json)); const jp = (4 - (js.length % 4)) % 4;
    if (jp) { const j2 = new Uint8Array(js.length + jp).fill(32); j2.set(js); js = j2; }
    const total = 12 + 8 + js.length + 8 + off, out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4E4F534A, true); out.set(js, 20);
    let p0 = 20 + js.length; dv.setUint32(p0, off, true); dv.setUint32(p0 + 4, 0x004E4942, true); p0 += 8;
    bins.forEach(b => { out.set(b, p0); p0 += b.length; });
    return out;
  }
  /* Wavefront OBJ with per-vertex colour (x y z r g b), which Blender and MeshLab read. One object per part. */
  function toOBJ(parts, title) {
    const out = ['# Stark Builder ' + (title || 'plan') + ' (metres, y up). Planning model, not construction documents.'];
    let base = 1;
    parts.forEach(p => {
      if (!p.data || p.data.length < 27) return;
      const n = p.data.length / 9; out.push('o ' + String(p.name).replace(/\s+/g, '_'));
      for (let i = 0; i < n; i++) { const d = p.data, o = i * 9; out.push('v ' + [d[o], d[o + 1], d[o + 2], d[o + 6], d[o + 7], d[o + 8]].map(v => +v.toFixed(4)).join(' ')); }
      for (let i = 0; i < n; i++) { const d = p.data, o = i * 9; out.push('vn ' + [d[o + 3], d[o + 4], d[o + 5]].map(v => +v.toFixed(3)).join(' ')); }
      for (let i = 0; i < n; i += 3) { const a = base + i, b = a + 1, c = a + 2; out.push('f ' + a + '//' + a + ' ' + b + '//' + b + ' ' + c + '//' + c); }
      base += n;
    });
    return out.join('\n') + '\n';
  }

  /* ---------- fuzzy search for the command palette ---------- */
  /* Subsequence match with bonuses for word starts and runs. Returns null for no match, else a score (higher is better). */
  function fuzzy(q, text) {
    q = String(q || '').toLowerCase().replace(/\s+/g, ''); text = String(text || '').toLowerCase();
    if (!q) return 0;
    let ti = 0, score = 0, run = 0, first = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const f = text.indexOf(q[qi], ti); if (f < 0) return null;
      if (first < 0) first = f;
      if (f === ti) { run++; score += 3 + run; } else { run = 0; score += 1; }
      if (f === 0 || /[\s\-_/:]/.test(text[f - 1])) score += 4;
      ti = f + 1;
    }
    return score - first * 0.5 - (text.length - q.length) * 0.05 + (text.indexOf(q) >= 0 ? 6 : 0);
  }
  function rank(q, items, limit) {
    const out = [];
    items.forEach(it => { const s = fuzzy(q, it.label + ' ' + (it.hint || '')); if (s !== null) out.push({ item: it, score: s }); });
    out.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
    return out.slice(0, limit || 8).map(o => o.item);
  }

  /* ---------- ask your plan ---------- */
  /* ctx: {units, money(v), total (materials total), levels via the plan}. Returns a sentence or null when it does not understand. */
  function ask(q, plan, ctx) {
    q = String(q || '').toLowerCase(); ctx = ctx || {};
    const L = C.levels(plan), st = C.planStats(plan), area = C.totalFloorArea(plan), fa = a => C.fmtArea(a, ctx.units || 'metric'), fl = m => C.fmtLen(m, ctx.units || 'metric');
    const count = k => L.reduce((s, l) => s + (l[k] || []).length, 0), has = (...w) => w.some(x => q.indexOf(x) >= 0);
    const rooms = []; L.forEach(l => l.rooms.forEach(r => rooms.push({ name: r.name, area: C.polyArea(r.pts) })));
    const rm = rooms.find(r => r.name && q.indexOf(String(r.name).toLowerCase()) >= 0);
    if (rm && has('size', 'area', 'big', 'large', 'm2', 'square')) return rm.name + ' is ' + fa(rm.area) + '.';
    if (has('biggest room', 'largest room')) { const b = rooms.slice().sort((a, c) => c.area - a.area)[0]; return b ? 'The largest room is ' + b.name + ', ' + fa(b.area) + '.' : 'No rooms are drawn yet.'; }
    if (has('smallest room')) { const b = rooms.slice().sort((a, c) => a.area - c.area)[0]; return b ? 'The smallest room is ' + b.name + ', ' + fa(b.area) + '.' : 'No rooms are drawn yet.'; }
    if (has('cost', 'price', 'how much', 'budget')) return ctx.total != null ? 'The materials estimate is ' + (ctx.money ? ctx.money(ctx.total) : Math.round(ctx.total)) + ' at the example prices (' + (area > 0 && ctx.money ? ctx.money(ctx.total / area) + ' per m2' : 'n/a') + '). Replace the prices with local quotes.' : null;
    if (has('window')) return 'There ' + (count('openings') ? 'are ' : 'are ') + L.reduce((s, l) => s + l.openings.filter(o => o.type === 'window').length, 0) + ' windows.';
    if (has('door')) return 'There are ' + L.reduce((s, l) => s + l.openings.filter(o => o.type === 'door').length, 0) + ' doors.';
    if (has('floor area', 'how big', 'square', 'area', 'size')) return 'The total floor area is ' + fa(area) + ' across ' + L.length + (L.length === 1 ? ' floor.' : ' floors.');
    if (has('room')) return 'There are ' + rooms.length + ' rooms: ' + (rooms.map(r => r.name + ' ' + fa(r.area)).join(', ') || 'none yet') + '.';
    if (has('floors', 'storey', 'story', 'level')) return 'The building has ' + L.length + (L.length === 1 ? ' floor.' : ' floors.');
    if (has('height', 'tall', 'high')) return 'The building is about ' + fl(C.buildingHeight(plan)) + ' tall before the roof.';
    if (has('wall')) return 'Wall length is ' + fl(st.wallLen != null ? st.wallLen : L.reduce((s, l) => s + l.walls.reduce((a, w) => a + C.wallLen(w), 0), 0)) + ' over ' + count('walls') + ' walls.';
    if (has('stair')) return 'There are ' + count('stairs') + ' stairs.';
    if (has('furniture', 'item', 'symbol')) return 'There are ' + count('items') + ' furniture pieces and symbols.';
    return null;
  }

  const api = { sunPos, dayInfo, sunPath, shadow, hull, windowSun, orientationSummary, riskSim, chanceUnder, budgetFor, tornado, toGLB, toOBJ, fuzzy, rank, ask,
    dayOfYear, compassName, PLACES, MONTHS, MONTH_DAYS, VOL, rng };
  SB.studio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  /* Worker mode: this same file, started with new Worker('js/studio.js'), runs big cost-risk simulations off the main thread so typing
     and sliders never stall. It only answers { op: 'risk' } messages from the page and has no network or DOM access. */
  api.workerReply = function (m) {
    m = m || {};
    try { if (m.op !== 'risk' || !Array.isArray(m.lines) || m.lines.length > 5000) throw new Error('Unsupported request'); return { id: m.id, sim: riskSim(m.lines, m.opts || {}), tor: tornado(m.lines, m.opts || {}) }; }
    catch (err) { return { id: m.id, error: String((err && err.message) || err) }; }
  };
  if (typeof WorkerGlobalScope !== 'undefined' && g instanceof WorkerGlobalScope) g.onmessage = e => g.postMessage(api.workerReply(e.data));
})(typeof window !== 'undefined' ? window : globalThis);
