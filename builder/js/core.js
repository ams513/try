/* Stark Builder, by Stark. Core: units, geometry, floors and project validation.
   Pure functions, no DOM. Runs in the browser (window.SB) and in Node (tests). All lengths are metres internally. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const FT = 0.3048, IN = 0.0254, SQFT = 0.09290304;
  const EPS = 1e-9;

  /* ---------- units ---------- */
  const round = (v, d) => { const k = Math.pow(10, d || 0); return Math.round(v * k) / k; };
  function trim(n, d) { return String(round(n, d)); }
  function fmtLen(m, sys) {
    if (!isFinite(m)) return '-';
    if (sys === 'imperial') {
      const neg = m < 0; const inches = Math.round(Math.abs(m) / IN * 2) / 2;
      let ft = Math.floor(inches / 12); let rem = round(inches - ft * 12, 1);
      if (rem >= 12) { ft += 1; rem = 0; }
      return (neg ? '-' : '') + ft + "' " + trim(rem, 1) + '"';
    }
    return trim(m, 2) + ' m';
  }
  function fmtArea(m2, sys) {
    if (!isFinite(m2)) return '-';
    return sys === 'imperial' ? trim(m2 / SQFT, 1) + ' ft²' : trim(m2, 2) + ' m²';
  }
  /* Parse "3.5", "3.5 m", "350cm", "3500 mm", "12'6\"", "12 ft 6 in", "6 1/2\"", "12ft". Bare numbers use the
     current system's default unit (m or ft). Returns metres or NaN. */
  function parseLen(str, sys) {
    if (typeof str === 'number') return str;
    let s = String(str == null ? '' : str).trim().toLowerCase().replace(/’|′/g, "'").replace(/”|″/g, '"').replace(/,/g, '.');
    if (!s) return NaN;
    let m;
    if ((m = /^(-?\d+(?:\.\d+)?)\s*(mm|cm|m)$/.exec(s))) return parseFloat(m[1]) * ({ mm: 0.001, cm: 0.01, m: 1 })[m[2]];
    if (/^-?\d+(?:\.\d+)?$/.test(s)) return parseFloat(s) * (sys === 'imperial' ? FT : 1);
    s = s.replace(/(\d)\s*(?:feet|foot|ft)\b/g, "$1'").replace(/(\d)\s*(?:inches|inch|in)\b/g, '$1"');
    let total = 0, used = false;
    const ftm = /(-?\d+(?:\.\d+)?)\s*'/.exec(s);
    if (ftm) { total += parseFloat(ftm[1]) * FT; used = true; s = s.replace(ftm[0], ' '); }
    s = s.replace(/"/g, ' ').trim();
    if (s) {
      let inch = 0;
      if ((m = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s))) inch = parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
      else if ((m = /^(\d+)\s*\/\s*(\d+)$/.exec(s))) inch = parseInt(m[1], 10) / parseInt(m[2], 10);
      else if (/^\d+(?:\.\d+)?$/.test(s)) inch = parseFloat(s);
      else return NaN;
      total += inch * IN; used = true;
    }
    return used ? total : NaN;
  }
  const mToFt = m => m / FT;
  const ftToM = f => f * FT;
  const m2ToFt2 = a => a / SQFT;

  /* ---------- geometry ---------- */
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  function polyArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(s) / 2;
  }
  function polyPerimeter(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) s += dist(pts[i], pts[(i + 1) % pts.length]);
    return s;
  }
  function pointInPoly(p, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function centroid(pts) {
    let x = 0, y = 0; pts.forEach(p => { x += p[0]; y += p[1]; });
    return [x / pts.length, y / pts.length];
  }
  function segDist(p, a, b) { /* distance from p to segment ab, plus the closest point and its parameter */
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 < EPS ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const q = [a[0] + dx * t, a[1] + dy * t];
    return { d: dist(p, q), q, t };
  }
  const wallLen = w => dist(w.a, w.b);
  const DEF = { wallH: 2.4, extT: 0.15, intT: 0.1 };
  const wallH = plan => (plan.wallH > 0 ? plan.wallH : DEF.wallH);
  const openingsOn = (plan, wallId) => (plan.openings || []).filter(o => o.wall === wallId);
  const findWall = (plan, id) => (plan.walls || []).find(w => w.id === id);
  function openingArea(plan, o) {
    const H = wallH(plan); const top = Math.min(o.sill + o.h, H);
    return Math.max(0, o.w) * Math.max(0, top - o.sill);
  }
  function wallNetArea(plan, w) {
    const gross = wallLen(w) * wallH(plan);
    const net = gross - openingsOn(plan, w.id).reduce((s, o) => s + openingArea(plan, o), 0);
    return Math.max(0, net);
  }
  /* Bounding box of the exterior walls (or every wall, or every room) as {x0,y0,x1,y1,w,d}. */
  function bbox(plan) {
    const pts = [];
    const ext = (plan.walls || []).filter(w => w.type === 'ext');
    const src = ext.length ? ext : (plan.walls || []);
    src.forEach(w => { pts.push(w.a, w.b); });
    if (!pts.length) (plan.rooms || []).forEach(r => r.pts.forEach(p => pts.push(p)));
    if (!pts.length) return { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, d: 0 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x0, y0, x1, y1, w: x1 - x0, d: y1 - y0 };
  }
  /* Opening layout checks: inside the wall, not overlapping a neighbour. Returns a list of problem strings. */
  function checkOpenings(plan) {
    const bad = [];
    (plan.walls || []).forEach(w => {
      const L = wallLen(w);
      const list = openingsOn(plan, w.id).slice().sort((p, q) => p.s - q.s);
      list.forEach((o, i) => {
        if (o.s - o.w / 2 < -1e-6 || o.s + o.w / 2 > L + 1e-6) bad.push('Opening ' + o.id + ' runs past the end of wall ' + w.id);
        if (i && list[i - 1].s + list[i - 1].w / 2 > o.s - o.w / 2 + 1e-6) bad.push('Openings ' + list[i - 1].id + ' and ' + o.id + ' overlap on wall ' + w.id);
      });
    });
    return bad;
  }
  function planStats(plan) {
    const H = wallH(plan);
    const st = { rooms: [], floorArea: 0, footprintArea: 0, extLen: 0, intLen: 0, extGross: 0, intGross: 0, extNet: 0, intNet: 0,
      openingArea: 0, windows: 0, doorsExt: 0, doorsInt: 0, doorsPatio: 0, windowArea: 0, bbox: bbox(plan), extPerimeter: 0 };
    (plan.rooms || []).forEach(r => {
      const a = polyArea(r.pts), p = polyPerimeter(r.pts);
      st.rooms.push({ id: r.id, name: r.name, area: a, perimeter: p });
      st.floorArea += a;
    });
    (plan.walls || []).forEach(w => {
      const L = wallLen(w), gross = L * H, net = wallNetArea(plan, w);
      if (w.type === 'ext') { st.extLen += L; st.extGross += gross; st.extNet += net; } else { st.intLen += L; st.intGross += gross; st.intNet += net; }
    });
    st.extPerimeter = st.extLen;
    (plan.openings || []).forEach(o => {
      const w = findWall(plan, o.wall); if (!w) return;
      st.openingArea += openingArea(plan, o);
      if (o.type === 'window') { st.windows++; st.windowArea += openingArea(plan, o); }
      else if (o.w > 1.5) st.doorsPatio++;
      else if (w.type === 'ext') st.doorsExt++;
      else st.doorsInt++;
    });
    st.footprintArea = st.bbox.w * st.bbox.d;
    return st;
  }
  const snap = (v, step) => (step > 0 ? Math.round(v / step) * step : v);
  function nearestWall(plan, p, maxD) {
    let best = null;
    (plan.walls || []).forEach(w => {
      const r = segDist(p, w.a, w.b);
      if (r.d <= maxD && (!best || r.d < best.d)) best = { wall: w, d: r.d, s: r.t * wallLen(w), q: r.q };
    });
    return best;
  }

  /* ---------- floors ----------
     A plan is floor 1 (the ground floor) and carries the building name and roof. Upper floors live in plan.levels and
     have the same shape (wallH, walls, openings, rooms, items, stairs, nextId), so every per-floor function takes a floor. */
  const FLOOR_T = 0.3, MAX_LEVELS = 4;
  const levels = plan => [plan].concat(plan && Array.isArray(plan.levels) ? plan.levels : []);
  function levelElev(plan, k) { const L = levels(plan); let e = 0; for (let i = 0; i < k && i < L.length; i++) e += wallH(L[i]) + FLOOR_T; return e; }
  function blankLevel(h) { return { wallH: h > 0 ? h : DEF.wallH, walls: [], openings: [], rooms: [], items: [], stairs: [], nextId: 1 }; }
  const totalFloorArea = plan => levels(plan).reduce((s, l) => s + planStats(l).floorArea, 0);
  /* Stair footprint {x0,y0,x1,y1}, the bottom and top of the run, and the run direction. rot: 0 east, 1 south, 2 west, 3 north. */
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function stairRect(s) {
    const d = DIRS[s.rot || 0], along = d[0] !== 0, hx = (along ? s.len : s.w) / 2, hy = (along ? s.w : s.len) / 2;
    return { x0: s.x - hx, y0: s.y - hy, x1: s.x + hx, y1: s.y + hy, bottom: [s.x - d[0] * s.len / 2, s.y - d[1] * s.len / 2], top: [s.x + d[0] * s.len / 2, s.y + d[1] * s.len / 2], dir: d };
  }
  /* Axis-aligned rectangle minus holes: a list of rectangles that cover the rest. */
  function rectMinus(r, holes) {
    let parts = [r];
    (holes || []).forEach(h => {
      const next = [];
      parts.forEach(p => {
        if (h.x0 >= p.x1 || h.x1 <= p.x0 || h.y0 >= p.y1 || h.y1 <= p.y0) { next.push(p); return; }
        const ix0 = Math.max(p.x0, h.x0), ix1 = Math.min(p.x1, h.x1), iy0 = Math.max(p.y0, h.y0), iy1 = Math.min(p.y1, h.y1);
        if (iy0 > p.y0) next.push({ x0: p.x0, y0: p.y0, x1: p.x1, y1: iy0 });
        if (iy1 < p.y1) next.push({ x0: p.x0, y0: iy1, x1: p.x1, y1: p.y1 });
        if (ix0 > p.x0) next.push({ x0: p.x0, y0: iy0, x1: ix0, y1: iy1 });
        if (ix1 < p.x1) next.push({ x0: ix1, y0: iy0, x1: p.x1, y1: iy1 });
      });
      parts = next;
    });
    return parts.filter(p => p.x1 - p.x0 > 1e-6 && p.y1 - p.y0 > 1e-6);
  }
  function buildingHeight(plan) { const L = levels(plan); return levelElev(plan, L.length - 1) + wallH(L[L.length - 1]); }

  /* ---------- project shape ---------- */
  function blankPlan(name) {
    return { name: name || 'Untitled plan', wallH: 2.4, roof: { type: 'gable', pitch: 25, overhang: 0.3 }, walls: [], openings: [], rooms: [], nextId: 1, items: [], stairs: [], levels: [] };
  }
  const isPt = p => Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1]);
  const num = (v, d, lo, hi) => { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const KIND_RE = /^[a-z0-9-]{1,30}$/, ID_RE = /^[a-z0-9-]{1,40}$/;
  const rot4 = r => ([0, 1, 2, 3].indexOf(r) >= 0 ? r : 0);
  /* Furniture and electrical / plumbing markers: planning symbols placed on a floor. */
  function cleanItems(list) {
    const out = [];
    (Array.isArray(list) ? list : []).slice(0, 600).forEach(it => {
      if (!it || ['furn', 'elec', 'plumb'].indexOf(it.cat) < 0 || typeof it.kind !== 'string' || !KIND_RE.test(it.kind) || !isFinite(it.id)) return;
      const o = { id: Number(it.id), cat: it.cat, kind: it.kind, x: num(it.x, 0, -5000, 5000), y: num(it.y, 0, -5000, 5000), rot: rot4(it.rot) };
      if (it.cat === 'furn') { o.w = num(it.w, 1, 0.1, 10); o.d = num(it.d, 1, 0.1, 10); }
      out.push(o);
    });
    return out;
  }
  /* Straight stair runs that start on this floor and go up to the next. (x, y) is the centre, rot the run direction. */
  function cleanStairs(list) {
    return (Array.isArray(list) ? list : []).slice(0, 20).filter(s => s && isFinite(s.id)).map(s => ({ id: Number(s.id), x: num(s.x, 0, -5000, 5000), y: num(s.y, 0, -5000, 5000),
      w: num(s.w, 0.9, 0.5, 3), len: num(s.len, 3.5, 0.5, 12), rot: rot4(s.rot), going: num(s.going, 0.25, 0.15, 0.45) }));
  }
  /* Returns a cleaned plan or throws Error with a plain message. Used by project load. Version-1 plans (one floor,
     no items or stairs) come back as a one-floor plan with empty lists. */
  function cleanPlan(p) {
    if (!p || typeof p !== 'object') throw new Error('The file has no plan in it.');
    const out = blankPlan(String(p.name || 'Untitled plan').slice(0, 80));
    const r = p.roof || {};
    out.roof = { type: ['gable', 'shed', 'flat'].indexOf(r.type) >= 0 ? r.type : 'gable', pitch: num(r.pitch, 25, 2, 60), overhang: num(r.overhang, 0.3, 0, 1.5) };
    cleanLevelInto(p, out);
    out.levels = (Array.isArray(p.levels) ? p.levels : []).slice(0, MAX_LEVELS - 1).map(l => {
      if (!l || typeof l !== 'object') throw new Error('A floor in the file is malformed.');
      return cleanLevelInto(l, blankLevel());
    });
    return out;
  }
  /* Cleans the per-floor part of a plan (walls, openings, rooms, items, stairs) into out. Throws a plain message. */
  function cleanLevelInto(p, out) {
    out.wallH = num(p.wallH, 2.4, 1.8, 6);
    if (!Array.isArray(p.walls) || p.walls.length > 2000) throw new Error('The plan has no usable walls list.');
    const ids = new Set();
    let maxId = 0;
    out.walls = []; out.openings = []; out.rooms = [];
    p.walls.forEach(w => {
      if (!w || !isPt(w.a) || !isPt(w.b) || !isFinite(w.id)) throw new Error('A wall in the file is malformed.');
      if (Math.abs(w.a[0]) > 5000 || Math.abs(w.a[1]) > 5000 || Math.abs(w.b[0]) > 5000 || Math.abs(w.b[1]) > 5000) throw new Error('A wall is far outside any realistic site.');
      ids.add(w.id); maxId = Math.max(maxId, w.id);
      out.walls.push({ id: w.id, a: [w.a[0], w.a[1]], b: [w.b[0], w.b[1]], type: w.type === 'int' ? 'int' : 'ext', t: num(w.t, w.type === 'int' ? DEF.intT : DEF.extT, 0.03, 1) });
    });
    (Array.isArray(p.openings) ? p.openings : []).forEach(o => {
      if (!o || !ids.has(o.wall)) return;
      maxId = Math.max(maxId, Number(o.id) || 0);
      out.openings.push({ id: o.id, wall: o.wall, type: o.type === 'window' ? 'window' : 'door', s: num(o.s, 0, 0, 5000), w: num(o.w, 0.9, 0.3, 6), h: num(o.h, 2, 0.3, 4), sill: num(o.sill, 0, 0, 3), flip: !!o.flip });
    });
    (Array.isArray(p.rooms) ? p.rooms : []).forEach(rm => {
      if (!rm || !Array.isArray(rm.pts) || rm.pts.length < 3 || !rm.pts.every(isPt)) return;
      maxId = Math.max(maxId, Number(rm.id) || 0);
      out.rooms.push({ id: rm.id, name: String(rm.name || 'Room').slice(0, 40), pts: rm.pts.map(q => [q[0], q[1]]) });
    });
    out.items = cleanItems(p.items); out.stairs = cleanStairs(p.stairs);
    out.items.forEach(i => { maxId = Math.max(maxId, i.id); }); out.stairs.forEach(i => { maxId = Math.max(maxId, i.id); });
    out.nextId = Math.max(maxId + 1, Number(p.nextId) || 1);
    return out;
  }
  function cleanSite(s) {
    const out = { w: 50, d: 40, setback: 3, buildings: [], paths: [], utils: [], nextId: 1 };
    if (!s || typeof s !== 'object') return out;
    out.w = num(s.w, 50, 5, 2000); out.d = num(s.d, 40, 5, 2000); out.setback = num(s.setback, 3, 0, 100);
    let maxId = 0;
    (Array.isArray(s.buildings) ? s.buildings : []).slice(0, 200).forEach(b => {
      if (!b || !b.plan) return;
      let plan; try { plan = cleanPlan(b.plan); } catch (e) { return; }
      maxId = Math.max(maxId, Number(b.id) || 0);
      out.buildings.push({ id: b.id, name: String(b.name || plan.name).slice(0, 60), plan, x: num(b.x, 0, -5000, 5000), y: num(b.y, 0, -5000, 5000), rot: [0, 1, 2, 3].indexOf(b.rot) >= 0 ? b.rot : 0, phase: num(b.phase, 1, 1, 4) | 0 });
    });
    (Array.isArray(s.paths) ? s.paths : []).slice(0, 200).forEach(p => {
      if (!p || !Array.isArray(p.pts) || p.pts.length < 2 || !p.pts.every(isPt)) return;
      maxId = Math.max(maxId, Number(p.id) || 0);
      out.paths.push({ id: p.id, pts: p.pts.map(q => [q[0], q[1]]), w: num(p.w, 1.2, 0.3, 10), phase: num(p.phase, 1, 1, 4) | 0 });
    });
    (Array.isArray(s.utils) ? s.utils : []).slice(0, 200).forEach(u => {
      if (!u || ['solar', 'water', 'septic', 'power', 'parking'].indexOf(u.kind) < 0) return;
      maxId = Math.max(maxId, Number(u.id) || 0);
      out.utils.push({ id: u.id, kind: u.kind, x: num(u.x, 0, -5000, 5000), y: num(u.y, 0, -5000, 5000), phase: num(u.phase, 1, 1, 4) | 0 });
    });
    out.nextId = Math.max(maxId + 1, Number(s.nextId) || 1);
    return out;
  }
  /* ---------- planning data saved with the project (all optional; cleaned, never trusted) ---------- */
  function cleanPrices(src) {
    const out = {};
    if (src && typeof src === 'object' && !Array.isArray(src)) Object.keys(src).forEach(k => { const v = Number(src[k]); if (BAD_KEYS.indexOf(k) < 0 && isFinite(v) && v >= 0 && v < 1e7) out[k] = v; });
    return out;
  }
  const multOf = v => (isFinite(v) && v > 0 && v < 10 ? Number(v) : 1);
  function cleanScenarios(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).slice(0, 12).filter(s => s && typeof s === 'object' && typeof s.id === 'string' && ID_RE.test(s.id) && !seen.has(s.id) && seen.add(s.id)).map(s => ({
      id: s.id, name: String(s.name || 'Scenario').slice(0, 40), region: typeof s.region === 'string' ? s.region.slice(0, 30) : 'baseline', customMult: multOf(s.customMult),
      prices: cleanPrices(s.prices), labourPct: num(s.labourPct, 0, 0, 300), contPct: num(s.contPct, 10, 0, 100) }));
  }
  const isDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z'));
  function cleanSchedule(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.tasks)) return null;
    const tasks = [], ids = new Set();
    s.tasks.slice(0, 80).forEach(t => {
      if (!t || typeof t.id !== 'string' || !ID_RE.test(t.id) || ids.has(t.id)) return;
      ids.add(t.id);
      tasks.push({ id: t.id, name: String(t.name || 'Task').slice(0, 80), days: Math.round(num(t.days, 1, 0, 365)), after: (Array.isArray(t.after) ? t.after : []).filter(a => typeof a === 'string').slice(0, 12), done: !!t.done });
    });
    tasks.forEach(t => { t.after = t.after.filter((a, i, arr) => a !== t.id && ids.has(a) && arr.indexOf(a) === i); });
    return { start: isDate(s.start) ? s.start : '', workWeek: [5, 6, 7].indexOf(s.workWeek) >= 0 ? s.workWeek : 5, tasks };
  }
  function cleanPermits(p) {
    const out = { authority: '', done: {}, notes: {}, custom: [] };
    if (!p || typeof p !== 'object') return out;
    const okKey = k => ID_RE.test(k) && BAD_KEYS.indexOf(k) < 0;
    out.authority = typeof p.authority === 'string' ? p.authority.slice(0, 120) : '';
    if (p.done && typeof p.done === 'object') Object.keys(p.done).slice(0, 400).forEach(k => { if (okKey(k) && p.done[k] === true) out.done[k] = true; });
    if (p.notes && typeof p.notes === 'object') Object.keys(p.notes).slice(0, 400).forEach(k => { const v = p.notes[k]; if (okKey(k) && typeof v === 'string' && v.trim()) out.notes[k] = v.slice(0, 500); });
    (Array.isArray(p.custom) ? p.custom : []).slice(0, 60).forEach(c => { if (c && typeof c.id === 'string' && okKey(c.id) && typeof c.text === 'string' && c.text.trim()) out.custom.push({ id: c.id, text: c.text.slice(0, 160), phase: num(c.phase, 0, 0, 9) | 0 }); });
    return out;
  }
  /* Numeric settings: only known keys, each clamped to a sane range. */
  const NUM_FIELDS = {
    energy: { hdd: [0, 12000], cdd: [0, 6000], uWall: [0.05, 5], uRoof: [0.05, 5], uFloor: [0.05, 5], uWin: [0.3, 7], uDoor: [0.3, 7], ach: [0, 10], designDT: [5, 70],
      heatEff: [0.3, 6], coolCop: [1, 8], heatPrice: [0, 10], elecPrice: [0, 10], heatIsElec: [0, 1], baseLoad: [0, 50000],
      sunHours: [0, 9], panelW: [50, 900], panelArea: [0.3, 4], panels: [0, 400], lossPct: [0, 60], roofUse: [0, 1] },
    order: { stud_2x6: [0.5, 12], stud_2x4: [0.5, 12], joist_2x8: [0.5, 12], rafter_2x6: [0.5, 12], roofing: [0.1, 50], insulation: [0.1, 50], flooring: [0.1, 50], cladding: [0.1, 50] }
  };
  function cleanNums(src, kind) {
    const out = {}, f = NUM_FIELDS[kind];
    if (src && typeof src === 'object' && !Array.isArray(src)) Object.keys(f).forEach(k => { const v = Number(src[k]); if (k in src && src[k] !== null && src[k] !== '' && isFinite(v)) out[k] = Math.min(f[k][1], Math.max(f[k][0], v)); });
    return out;
  }
  const FILE_VERSIONS = [1, 2], FILE_VERSION = 2;
  function validateProject(obj) {
    if (!obj || typeof obj !== 'object' || obj.app !== 'Stark Builder') throw new Error('This is not a Stark Builder project file.');
    if (FILE_VERSIONS.indexOf(obj.version) < 0) throw new Error('This project file is from a newer version of Stark Builder.');
    const out = { units: obj.units === 'imperial' ? 'imperial' : 'metric', plan: cleanPlan(obj.plan), site: cleanSite(obj.site) };
    out.region = typeof obj.region === 'string' ? obj.region.slice(0, 30) : 'baseline';
    out.customMult = multOf(obj.customMult);
    out.currency = typeof obj.currency === 'string' && obj.currency.length <= 4 ? obj.currency : '$';
    out.prices = cleanPrices(obj.prices);
    out.scenarios = cleanScenarios(obj.scenarios);
    out.schedule = cleanSchedule(obj.schedule);
    out.permits = cleanPermits(obj.permits);
    out.energy = cleanNums(obj.energy, 'energy');
    out.orderSizes = cleanNums(obj.orderSizes, 'order');
    return out;
  }
  /* Ear-clipping triangulation for simple polygons. Returns array of [i,j,k] index triples. */
  function triangulate(pts) {
    const n = pts.length; if (n < 3) return [];
    let area = 0; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
    const idx = []; for (let i = 0; i < n; i++) idx.push(area > 0 ? i : n - 1 - i);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const tris = []; let guard = 0;
    while (idx.length > 3 && guard++ < 5000) {
      let clipped = false;
      for (let i = 0; i < idx.length; i++) {
        const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
        const a = pts[ia], b = pts[ib], c = pts[ic];
        if (cross(a, b, c) <= 1e-12) continue;
        let ok = true;
        for (let k = 0; k < idx.length && ok; k++) {
          const v = idx[k]; if (v === ia || v === ib || v === ic) continue;
          const p = pts[v];
          if (cross(a, b, p) >= -1e-12 && cross(b, c, p) >= -1e-12 && cross(c, a, p) >= -1e-12) ok = false;
        }
        if (ok) { tris.push([ia, ib, ic]); idx.splice(i, 1); clipped = true; break; }
      }
      if (!clipped) break;
    }
    if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
    return tris;
  }

  /* ---------- integrity: SHA-256, canonical JSON, strict schema check for project files ---------- */
  const K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(str) {
    const m = new TextEncoder().encode(String(str)), n = m.length, len = ((n + 9 + 63) >> 6) << 6, b = new Uint8Array(len);
    b.set(m); b[n] = 0x80;
    const dv = new DataView(b.buffer); dv.setUint32(len - 8, Math.floor(n / 0x20000000), false); dv.setUint32(len - 4, (n << 3) >>> 0, false);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Uint32Array(64);
    const rr = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < len; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4, false);
      for (let i = 16; i < 64; i++) { const a = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), c = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + a + w[i - 7] + c) >>> 0; }
      let [a, bb, c, d, e, f, gg, hh] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & gg)) + K256[i] + w[i]) >>> 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
        hh = gg; gg = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bb) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + gg) >>> 0; H[7] = (H[7] + hh) >>> 0;
    }
    return H.map(x => ('00000000' + x.toString(16)).slice(-8)).join('');
  }
  /* Canonical JSON: keys sorted, so the same data always hashes the same. */
  function canonical(v) {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function stamp(obj) { const o = Object.assign({}, obj); delete o.checksum; o.checksum = { alg: 'SHA-256', value: sha256(canonical(o)) }; return o; }
  const TOP_KEYS = ['app', 'version', 'appVersion', 'savedAt', 'units', 'region', 'customMult', 'currency', 'prices', 'plan', 'site', 'checksum',
    'scenarios', 'schedule', 'permits', 'energy', 'orderSizes'];
  const LEVEL_KEYS = ['wallH', 'walls', 'openings', 'rooms', 'items', 'stairs', 'nextId'];
  const PLAN_KEYS = ['name', 'roof', 'levels'].concat(LEVEL_KEYS);
  const SITE_KEYS = ['w', 'd', 'setback', 'buildings', 'paths', 'utils', 'nextId'];
  const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
  function scan(v, depth, count) {
    if (depth > 12) throw new Error('The file is nested too deeply.');
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.some(k => BAD_KEYS.indexOf(k) >= 0)) throw new Error('The file contains a forbidden key.');
      keys.forEach(k => { if (++count.n > 200000) throw new Error('The file has too many values.'); scan(v[k], depth + 1, count); });
    } else if (typeof v === 'string' && v.length > 5000) throw new Error('The file has an over-long text value.');
  }
  /* Strict check before anything is restored. Returns { checksum: true|false }; throws Error with a plain message. */
  function checkProjectFile(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('This is not a Stark Builder project file.');
    scan(obj, 0, { n: 0 });
    Object.keys(obj).forEach(k => { if (TOP_KEYS.indexOf(k) < 0) throw new Error('The file has an unknown field "' + k.slice(0, 20) + '".'); });
    if (obj.plan && typeof obj.plan === 'object') {
      Object.keys(obj.plan).forEach(k => { if (PLAN_KEYS.indexOf(k) < 0) throw new Error('The plan has an unknown field.'); });
      if ('levels' in obj.plan && (!Array.isArray(obj.plan.levels) || obj.plan.levels.length > MAX_LEVELS - 1)) throw new Error('The plan has too many floors or a malformed floor list.');
      (obj.plan.levels || []).forEach(l => { if (!l || typeof l !== 'object' || Array.isArray(l)) throw new Error('A floor in the file is malformed.'); Object.keys(l).forEach(k => { if (LEVEL_KEYS.indexOf(k) < 0) throw new Error('A floor has an unknown field.'); }); });
    }
    if ('scenarios' in obj && !Array.isArray(obj.scenarios)) throw new Error('The scenarios list is malformed.');
    ['schedule', 'permits', 'energy', 'orderSizes'].forEach(k => { if (k in obj && obj[k] !== null && (typeof obj[k] !== 'object' || Array.isArray(obj[k]))) throw new Error('The ' + k + ' section is malformed.'); });
    if (obj.site && typeof obj.site === 'object') Object.keys(obj.site).forEach(k => { if (SITE_KEYS.indexOf(k) < 0) throw new Error('The site has an unknown field.'); });
    if (obj.prices && (typeof obj.prices !== 'object' || Array.isArray(obj.prices) || Object.keys(obj.prices).length > 500)) throw new Error('The price list is malformed.');
    if ('units' in obj && typeof obj.units !== 'string') throw new Error('The units field is malformed.');
    if ('checksum' in obj) {
      const c = obj.checksum, rest = Object.assign({}, obj); delete rest.checksum;
      if (!c || c.alg !== 'SHA-256' || typeof c.value !== 'string' || c.value !== sha256(canonical(rest))) throw new Error('The file failed its integrity check (checksum does not match), so nothing was loaded.');
      return { checksum: true };
    }
    return { checksum: false };
  }
  /* Parse text, check integrity and schema, then clean. Throws a plain message; the caller overwrites nothing on failure. */
  function openProjectText(text) {
    let obj; try { obj = JSON.parse(text); } catch (e) { throw new Error('The file is not valid JSON.'); }
    const chk = checkProjectFile(obj), proj = validateProject(obj);
    return { project: proj, checksum: chk.checksum, note: chk.checksum ? 'checksum verified' : 'no checksum, validated' };
  }

  const api = { FT, IN, SQFT, round, fmtLen, fmtArea, parseLen, mToFt, ftToM, m2ToFt2, dist, polyArea, polyPerimeter, pointInPoly, centroid,
    segDist, wallLen, wallH, openingsOn, findWall, openingArea, wallNetArea, bbox, checkOpenings, planStats, snap, nearestWall, blankPlan,
    cleanPlan, cleanSite, validateProject, triangulate, DEF, sha256, canonical, stamp, checkProjectFile, openProjectText,
    FLOOR_T, MAX_LEVELS, FILE_VERSION, levels, levelElev, blankLevel, totalFloorArea, buildingHeight, stairRect, rectMinus, cleanItems, cleanStairs, cleanSchedule,
    cleanPermits, cleanScenarios, cleanNums, NUM_FIELDS, ID_RE, isDate };
  SB.core = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
