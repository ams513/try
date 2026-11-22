/* Stark Builder, by Stark. Starter designs: 11 homes (one on two floors) plus a utility shed and a common house.
   Each design is a short spec (rectangle, rooms as rectangles, entrance point). build() turns a spec into a plan:
   exterior walls, interior walls from the room edges, windows from the exterior edges, and an interior door from every
   room to a room already connected, so every room is reachable. Dimensions are to wall centrelines.
   These are layout starting points for planning only; they are not engineered or code-checked designs. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const C = SB.core || (typeof require !== 'undefined' ? require('../js/core.js') : null);
  const E = 1e-6;

  const SPECS = [
    { id: 'micro-studio', name: 'Micro Studio', kind: 'home', beds: 0, sleeps: 2, w: 2.5, d: 5.5, H: 2.4, roof: { type: 'shed', pitch: 10, overhang: 0.3 },
      blurb: 'A 13.8 m2 one-room studio with a bath. Lightest and cheapest in the set.',
      rooms: [['Studio', 0, 0, 2.5, 4.0], ['Bath', 0, 4.0, 2.5, 1.5]], door: [1.25, 5.5] },
    { id: 'trailer-tiny', name: 'Road Tiny 8 x 20', kind: 'home', beds: 1, sleeps: 2, w: 2.4, d: 6.1, H: 2.4, roof: { type: 'gable', pitch: 15, overhang: 0.2 },
      blurb: 'Classic 8 by 20 ft footprint: kitchen and living, bath, and a sleeping room. Check transport rules before building on a trailer.',
      rooms: [['Kitchen / Living', 0, 0, 2.4, 3.0], ['Bath', 0, 3.0, 2.4, 1.5], ['Sleeping', 0, 4.5, 2.4, 1.6]], door: [1.2, 0] },
    { id: 'one-bed-cabin', name: 'One-Bed Cabin', kind: 'home', beds: 1, sleeps: 2, w: 4.2, d: 6.6, H: 2.4, roof: { type: 'gable', pitch: 28, overhang: 0.35 },
      blurb: 'A 27.7 m2 cabin: open kitchen and living, a bedroom and a bath, under a simple gable roof.',
      rooms: [['Kitchen / Living', 0, 0, 4.2, 3.6], ['Bedroom', 0, 3.6, 2.4, 3.0], ['Bath', 2.4, 3.6, 1.8, 3.0]], door: [2.1, 0] },
    { id: 'cube-flat', name: 'Cube Studio, Flat Roof', kind: 'home', beds: 0, sleeps: 2, w: 4.8, d: 4.8, H: 2.6, roof: { type: 'flat', pitch: 2, overhang: 0.4 },
      blurb: 'A square 23 m2 studio with a flat roof, a bath and a kitchenette. Compact and modern.',
      rooms: [['Studio', 0, 0, 4.8, 3.3], ['Bath', 0, 3.3, 2.0, 1.5], ['Kitchenette', 2.0, 3.3, 2.8, 1.5]], door: [3.4, 4.8] },
    { id: 'steep-cabin', name: 'Steep-Roof Cabin', kind: 'home', beds: 1, sleeps: 3, w: 5.4, d: 6.0, H: 2.1, roof: { type: 'gable', pitch: 50, overhang: 0.4 },
      blurb: 'A steep 50 degree roof gives a tall great room under the ridge and sheds snow. The sleeping area sits behind the bath.',
      rooms: [['Great Room', 0, 0, 5.4, 4.2], ['Bath', 0, 4.2, 2.4, 1.8], ['Sleeping', 2.4, 4.2, 3.0, 1.8]], door: [2.7, 0] },
    { id: 'shed-modern', name: 'Shed-Roof Modern', kind: 'home', beds: 1, sleeps: 2, w: 3.6, d: 7.2, H: 2.4, roof: { type: 'shed', pitch: 12, overhang: 0.4 },
      blurb: 'A narrow 26 m2 home with a single-slope roof: living room, bedroom, bath and a closet.',
      rooms: [['Living / Kitchen', 0, 0, 3.6, 3.6], ['Bath', 0, 3.6, 1.6, 1.8], ['Closet', 0, 5.4, 1.6, 1.8], ['Bedroom', 1.6, 3.6, 2.0, 3.6]], door: [1.8, 0] },
    { id: 'two-bed-cottage', name: 'Two-Bed Cottage', kind: 'home', beds: 2, sleeps: 4, w: 7.2, d: 6.6, H: 2.4, roof: { type: 'gable', pitch: 30, overhang: 0.4 },
      blurb: 'A 47.5 m2 cottage with a big living room across the front and two bedrooms around a bath.',
      rooms: [['Living / Kitchen', 0, 0, 7.2, 3.6], ['Bedroom 1', 0, 3.6, 3.0, 3.0], ['Bath', 3.0, 3.6, 1.8, 3.0], ['Bedroom 2', 4.8, 3.6, 2.4, 3.0]], door: [3.6, 0] },
    { id: 'guest-adu', name: 'Guest House (ADU)', kind: 'home', beds: 1, sleeps: 2, w: 4.8, d: 7.8, H: 2.4, roof: { type: 'gable', pitch: 25, overhang: 0.35 },
      blurb: 'A 37 m2 accessory dwelling idea: kitchen and living, bedroom, bath and a closet. Check local ADU rules first.',
      rooms: [['Kitchen / Living', 0, 0, 4.8, 3.6], ['Bedroom', 0, 3.6, 3.0, 4.2], ['Bath', 3.0, 3.6, 1.8, 2.4], ['Closet', 3.0, 6.0, 1.8, 1.8]], door: [2.4, 0],
      patio: [4.8, 1.8] },
    { id: 'three-bed-small', name: 'Small Three-Bed House', kind: 'home', beds: 3, sleeps: 5, w: 7.2, d: 9.0, H: 2.4, roof: { type: 'gable', pitch: 28, overhang: 0.4 },
      blurb: 'A 65 m2 family layout: open living and kitchen, three bedrooms, a bath and a laundry.',
      rooms: [['Living / Kitchen', 0, 0, 7.2, 4.2], ['Bedroom 1', 0, 4.2, 3.0, 4.8], ['Bath', 3.0, 4.2, 1.8, 2.4], ['Laundry', 3.0, 6.6, 1.8, 2.4], ['Bedroom 2', 4.8, 4.2, 2.4, 2.4], ['Bedroom 3', 4.8, 6.6, 2.4, 2.4]], door: [3.6, 0] },
    { id: 'two-storey-cottage', name: 'Two-Storey Cottage', kind: 'home', beds: 2, sleeps: 4, w: 7.2, d: 7.2, H: 2.4, roof: { type: 'gable', pitch: 30, overhang: 0.4 },
      blurb: 'A 104 m2 home on two floors over a 52 m2 footprint: living, kitchen, bath and a stair hall below; two bedrooms and a bath above.',
      rooms: [['Living / Kitchen', 0, 0, 7.2, 4.2], ['Bath', 0, 4.2, 2.4, 3.0], ['Stair Hall / Utility', 2.4, 4.2, 4.8, 3.0]], door: [3.6, 0],
      stairs: [{ x: 5.3, y: 6.65, w: 0.9, len: 3.5, rot: 2 }],
      upper: [{ H: 2.4, rooms: [['Upper Hall', 2.4, 4.2, 4.8, 3.0], ['Bedroom 1', 0, 0, 3.6, 4.2], ['Bedroom 2', 3.6, 0, 3.6, 4.2], ['Bath', 0, 4.2, 2.4, 3.0]],
        doors: [[3.0, 4.2, 0.8], [5.4, 4.2, 0.8], [2.4, 5.4, 0.7]] }] },
    { id: 'workshop-studio', name: 'Workshop and Studio', kind: 'home', beds: 0, sleeps: 0, w: 6.0, d: 9.0, H: 2.7, roof: { type: 'gable', pitch: 22, overhang: 0.4 },
      blurb: 'A 54 m2 building for making things: an open shop, a small office and a toilet. Not a dwelling.',
      rooms: [['Shop', 0, 0, 6.0, 6.6], ['Office', 0, 6.6, 3.0, 2.4], ['Bath', 3.0, 6.6, 3.0, 2.4]], door: [3.0, 0], patio: [6.0, 3.3] },
    { id: 'garden-shed', name: 'Utility Shed', kind: 'support', beds: 0, sleeps: 0, w: 3.0, d: 3.0, H: 2.4, roof: { type: 'shed', pitch: 12, overhang: 0.3 },
      blurb: 'A 9 m2 shed for tools, batteries or a pump. A support building for a site plan.',
      rooms: [['Storage', 0, 0, 3.0, 3.0]], door: [1.5, 3.0], noWindows: false },
    { id: 'common-house', name: 'Common House', kind: 'support', beds: 0, sleeps: 0, w: 7.2, d: 10.8, H: 2.7, roof: { type: 'gable', pitch: 25, overhang: 0.45 },
      blurb: 'A 78 m2 shared building for a small village: gathering room, kitchen, toilets and storage.',
      rooms: [['Gathering Room', 0, 0, 7.2, 6.6], ['Kitchen', 0, 6.6, 4.2, 4.2], ['Toilets', 4.2, 6.6, 3.0, 2.1], ['Storage', 4.2, 8.7, 3.0, 2.1]], door: [3.6, 0], patio: [7.2, 3.3] }
  ];

  const onBorder = (v, lim) => Math.abs(v) < E || Math.abs(v - lim) < E;
  function mergeIntervals(list) {
    list.sort((p, q) => p[0] - q[0]);
    const out = [];
    list.forEach(i => { const l = out[out.length - 1]; if (l && i[0] <= l[1] + E) l[1] = Math.max(l[1], i[1]); else out.push([i[0], i[1]]); });
    return out;
  }
  function build(spec) {
    const plan = C.blankPlan(spec.name);
    plan.wallH = spec.H; plan.roof = Object.assign({}, spec.roof);
    fillLevel(plan, spec, spec.rooms, { door: spec.door, patio: spec.patio });
    (spec.stairs || []).forEach(s => plan.stairs.push({ id: plan.nextId++, x: s.x, y: s.y, w: s.w, len: s.len, rot: s.rot, going: 0.25 }));
    (spec.upper || []).forEach(u => { const lv = C.blankLevel(u.H || spec.H); fillLevel(lv, spec, u.rooms, { doors: u.doors }); plan.levels.push(lv); });
    return plan;
  }
  /* One floor: outer walls, inner walls from the room edges, the entrance (ground floor only), windows and inner doors.
     o.doors lists inner doors by hand ([x, y, width]); without it every room is joined to one already reachable. */
  function fillLevel(plan, spec, rooms, o) {
    const W = spec.w, D = spec.d;
    const id = () => plan.nextId++;
    const addWall = (a, b, type) => { const w = { id: id(), a, b, type, t: type === 'ext' ? C.DEF.extT : C.DEF.intT }; plan.walls.push(w); return w; };
    addWall([0, 0], [W, 0], 'ext'); addWall([W, 0], [W, D], 'ext'); addWall([W, D], [0, D], 'ext'); addWall([0, D], [0, 0], 'ext');
    // interior walls: room edges not on the border, merged
    const hor = {}, ver = {};
    rooms.forEach(r => {
      const x0 = r[1], y0 = r[2], x1 = r[1] + r[3], y1 = r[2] + r[4];
      [[y0, x0, x1], [y1, x0, x1]].forEach(e => { if (!onBorder(e[0], D)) (hor[e[0].toFixed(4)] = hor[e[0].toFixed(4)] || []).push([e[1], e[2]]); });
      [[x0, y0, y1], [x1, y0, y1]].forEach(e => { if (!onBorder(e[0], W)) (ver[e[0].toFixed(4)] = ver[e[0].toFixed(4)] || []).push([e[1], e[2]]); });
      plan.rooms.push({ id: id(), name: r[0], pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
    });
    Object.keys(hor).forEach(k => mergeIntervals(hor[k]).forEach(i => addWall([i[0], +k], [i[1], +k], 'int')));
    Object.keys(ver).forEach(k => mergeIntervals(ver[k]).forEach(i => addWall([+k, i[0]], [+k, i[1]], 'int')));
    const open = (type, p, w, h, sill) => {
      const hit = C.nearestWall(plan, p, 0.06);
      if (!hit) throw new Error('No wall at ' + p + ' in ' + spec.id);
      plan.openings.push({ id: id(), wall: hit.wall.id, type, s: hit.s, w, h, sill });
    };
    if (o.door) open('door', o.door, 0.9, 2.0, 0);
    if (o.patio) open('door', o.patio, 1.8, 2.0, 0);
    // windows on exterior room edges
    const doorPts = (o.door ? [[o.door, 0.45]] : []).concat(o.patio ? [[o.patio, 0.9]] : []);
    rooms.forEach(r => {
      const nm = r[0].toLowerCase(), x0 = r[1], y0 = r[2], x1 = x0 + r[3], y1 = y0 + r[4];
      if (/closet|storage|laundry/.test(nm) && spec.kind !== 'support') return;
      const wet = /bath|toilet/.test(nm), big = /living|great|shop|gathering|studio/.test(nm);
      const edges = [];
      if (Math.abs(y0) < E) edges.push(['h', y0, x0, x1]);
      if (Math.abs(y1 - D) < E) edges.push(['h', y1, x0, x1]);
      if (Math.abs(x0) < E) edges.push(['v', x0, y0, y1]);
      if (Math.abs(x1 - W) < E) edges.push(['v', x1, y0, y1]);
      edges.forEach(e => {
        const len = e[3] - e[2]; if (len < 1.5) return;
        const centers = len >= 4.5 ? [e[2] + len * 0.25, e[2] + len * 0.75] : [e[2] + len / 2];
        centers.forEach(c => {
          const p = e[0] === 'h' ? [c, e[1]] : [e[1], c];
          if (doorPts.some(d => C.dist(d[0], p) < d[1] + 0.75 + 0.2)) return;
          if (wet) open('window', p, 0.6, 0.6, 1.5);
          else if (big && len >= 2.4) open('window', p, 1.5, 1.2, 0.9);
          else open('window', p, 1.2, 1.2, 0.9);
        });
      });
    });
    if (o.doors) { o.doors.forEach(d => open('door', [d[0], d[1]], d[2], 2.0, 0)); return plan; }
    // interior doors: connect each room to the already connected set (room 0 is the entry room)
    const rects = rooms.map(r => ({ x0: r[1], y0: r[2], x1: r[1] + r[3], y1: r[2] + r[4], name: r[0] }));
    const shared = (a, b) => {
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (Math.abs(a.x1 - b.x0) < E || Math.abs(b.x1 - a.x0) < E) { if (oy > 1.1) return { len: oy, p: [Math.abs(a.x1 - b.x0) < E ? a.x1 : a.x0, Math.max(a.y0, b.y0) + oy / 2] }; }
      if (Math.abs(a.y1 - b.y0) < E || Math.abs(b.y1 - a.y0) < E) { if (ox > 1.1) return { len: ox, p: [Math.max(a.x0, b.x0) + ox / 2, Math.abs(a.y1 - b.y0) < E ? a.y1 : a.y0] }; }
      return null;
    };
    const seen = new Set([0]);
    for (let guard = 0; guard < 40 && seen.size < rects.length; guard++) {
      let best = null;
      rects.forEach((b, j) => {
        if (seen.has(j)) return;
        seen.forEach(i => { const s = shared(rects[i], b); if (s && (!best || s.len > best.s.len)) best = { j, s }; });
      });
      if (!best) break;
      seen.add(best.j);
      open('door', best.s.p, /bath|toilet/i.test(rects[best.j].name) ? 0.7 : 0.8, 2.0, 0);
    }
    return plan;
  }
  const templates = SPECS.map(s => ({ id: s.id, name: s.name, kind: s.kind, beds: s.beds, sleeps: s.sleeps, blurb: s.blurb, spec: s, plan: build(s) }));
  SB.templates = { list: templates, build, byId: id => templates.find(t => t.id === id) };
  if (typeof module !== 'undefined' && module.exports) module.exports = SB.templates;
})(typeof window !== 'undefined' ? window : globalThis);
