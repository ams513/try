/* Stark Builder, by Stark. Planning maths: stairs, accessibility checks, energy and solar estimates, the construction
   schedule (with its Gantt chart and CSV), cost scenarios and permit-checklist progress. Pure functions, no DOM.
   Every result here is a rough planning estimate from simple rules and the numbers you type in. None of it is an
   engineering, energy-code or accessibility-code calculation: a licensed professional checks the real design. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const C = SB.core || (typeof require !== 'undefined' ? require('./core.js') : null);
  const K = SB.takeoff || (typeof require !== 'undefined' ? require('./takeoff.js') : null);
  const CAT = SB.catalog || (typeof require !== 'undefined' ? require('../data/catalog.js') : null);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

  /* ---------- stairs ----------
     Example limits only (risers up to 190 mm, treads 250 mm, width 860 mm): your building code sets the real numbers. */
  const STAIR = { maxRiser: 0.19, minWidth: 0.86 };
  const stairRect = C.stairRect;
  function stairCalc(plan, k, s) {
    const L = C.levels(plan), rise = C.wallH(L[k] || plan) + C.FLOOR_T;
    const risers = Math.max(2, Math.ceil(rise / STAIR.maxRiser - 1e-9)), riser = rise / risers, treads = risers - 1, run = treads * s.going;
    return { rise, risers, riser, treads, going: s.going, run, hasAbove: k < L.length - 1, shortBy: Math.max(0, run - s.len), narrow: s.w < STAIR.minWidth };
  }
  /* Plain-language notes for every stair in the plan (floor numbers from 1). */
  function stairChecks(plan, units) {
    const out = [];
    C.levels(plan).forEach((lv, k) => (lv.stairs || []).forEach(s => {
      const c = stairCalc(plan, k, s), f = 'Stair on floor ' + (k + 1) + ': ';
      if (!c.hasAbove) out.push(f + 'there is no floor above it yet. Add a floor, or use it for a loft you draw yourself.');
      if (c.shortBy > 0.01) out.push(f + c.risers + ' risers of ' + Math.round(c.riser * 1000) + ' mm need about ' + C.fmtLen(c.run, units) + ' of run; it is drawn ' + C.fmtLen(s.len, units) + '.');
      if (c.narrow) out.push(f + 'narrower than ' + C.fmtLen(STAIR.minWidth, units) + ', which many codes treat as a minimum.');
    }));
    return out;
  }

  /* ---------- accessibility (universal-design rules of thumb, not a code check) ---------- */
  const WET = /bath|wc|toilet|shower/i, BED = /bed|sleep|studio/i, KIT = /kitchen/i;
  function roomMinSide(r) { const xs = r.pts.map(p => p[0]), ys = r.pts.map(p => p[1]); return Math.min(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys)); }
  function accessChecks(plan, units) {
    const L = C.levels(plan), g0 = L[0], out = [], fl = m => C.fmtLen(m, units || 'metric');
    const add = (ok, title, detail) => out.push({ ok, title, detail });
    const doors = (lv, type) => lv.openings.filter(o => o.type === 'door' && (C.findWall(lv, o.wall) || {}).type === type);
    const ent = doors(g0, 'ext'), widest = ent.reduce((m, o) => Math.max(m, o.w), 0);
    add(widest >= 0.9, 'A wide entrance door', ent.length ? 'Widest entrance door: ' + fl(widest) + '. A 900 mm (36 in) door leaves roughly the 800 mm clear opening a wheelchair needs. A level, step-free approach matters as much.' : 'There is no entrance door on floor 1.');
    const narrow = [];
    L.forEach((lv, k) => doors(lv, 'int').forEach(o => { if (o.w < 0.85) narrow.push(fl(o.w) + ' on floor ' + (k + 1)); }));
    add(!narrow.length, 'Interior doors 850 mm or wider', narrow.length ? narrow.length + ' narrower: ' + narrow.slice(0, 6).join(', ') + '. Wider doors help wheelchairs, walkers and moving furniture.' : 'Every interior door is at least 850 mm wide.');
    add(g0.rooms.some(r => WET.test(r.name)), 'A bathroom on the entry floor', g0.rooms.some(r => WET.test(r.name)) ? 'There is a bathroom on floor 1.' : 'No room named bath, WC, toilet or shower on floor 1.');
    if (L.some(lv => lv.rooms.some(r => BED.test(r.name)))) add(g0.rooms.some(r => BED.test(r.name)), 'A place to sleep on the entry floor', g0.rooms.some(r => BED.test(r.name)) ? 'There is a bedroom or studio on floor 1.' : 'Every bedroom is upstairs. A ground-floor room that can become a bedroom keeps the home usable after an injury or in old age.');
    const tight = [];
    L.forEach((lv, k) => lv.rooms.forEach(r => { if ((WET.test(r.name) || KIT.test(r.name)) && roomMinSide(r) < 1.5) tight.push(r.name + ' (' + fl(roomMinSide(r)) + ', floor ' + (k + 1) + ')'); }));
    add(!tight.length, '1.5 m turning space in kitchens and bathrooms', tight.length ? 'Narrower than 1.5 m (5 ft): ' + tight.join(', ') + '. Measured to the lines you drew; fixtures take more space.' : 'Every kitchen and bathroom is at least 1.5 m across, before fixtures.');
    if (L.length > 1) {
      const st = [].concat.apply([], L.map(l => l.stairs || []));
      add(st.length > 0 && st.every(s => s.w >= 0.9), 'Stairs that can take a stair lift later', !st.length ? 'There are upper floors but no stairs drawn yet.' : st.every(s => s.w >= 0.9) ? 'Every stair is at least 900 mm wide, which leaves room for a stair lift on most straight runs.' : 'A stair narrower than 900 mm makes a later stair lift hard.');
    }
    return out;
  }

  /* ---------- energy and solar ---------- */
  const ENERGY_DEFAULTS = { hdd: 2800, cdd: 200, uWall: 0.3, uRoof: 0.2, uFloor: 0.3, uWin: 1.4, uDoor: 1.8, ach: 0.6, designDT: 30, heatEff: 3.0, coolCop: 3.5,
    heatPrice: 0.2, elecPrice: 0.2, heatIsElec: 1, baseLoad: 3000, sunHours: 4, panelW: 400, panelArea: 1.9, panels: 0, lossPct: 14, roofUse: 0.5 };
  const CLIMATES = [['mild', 'Example: mild coastal', 1500, 150], ['temperate', 'Example: temperate', 2800, 200], ['cold', 'Example: cold winters', 4800, 80],
    ['hot', 'Example: hot and dry', 600, 2200], ['tropical', 'Example: hot and humid', 50, 3500]];
  /* Envelope areas from the drawing: net exterior walls, windows and doors on exterior walls, top ceiling, ground floor, volume. */
  function envelope(plan) {
    const L = C.levels(plan); let wall = 0, win = 0, door = 0, vol = 0;
    L.forEach(lv => {
      lv.walls.forEach(w => {
        if (w.type !== 'ext') return; wall += C.wallNetArea(lv, w);
        C.openingsOn(lv, w.id).forEach(o => { const a = C.openingArea(lv, o); if (o.type === 'window') win += a; else door += a; });
      });
      const b = C.bbox(lv); vol += b.w * b.d * C.wallH(lv);
    });
    const b0 = C.bbox(L[0]), bt = C.bbox(L[L.length - 1]);
    return { wall, win, door, roof: bt.w * bt.d, floor: b0.w * b0.d, vol };
  }
  /* Steady-state degree-day estimate: heat loss coefficient (UA + air leakage) x degree days. Ignores sun and internal gains. */
  function energy(plan, inputs) {
    const e = Object.assign({}, ENERGY_DEFAULTS, inputs || {}), env = envelope(plan);
    const parts = [['Walls', env.wall, e.uWall], ['Windows', env.win, e.uWin], ['Doors', env.door, e.uDoor], ['Roof or top ceiling', env.roof, e.uRoof], ['Ground floor', env.floor, e.uFloor]]
      .map(p => ({ name: p[0], area: p[1], u: p[2], ua: p[1] * p[2] }));
    const ua = sum(parts, p => p.ua), air = 0.335 * e.ach * env.vol, H = ua + air;
    const heatNeed = H * e.hdd * 24 / 1000, coolNeed = H * e.cdd * 24 / 1000;
    const heatUse = e.heatEff > 0 ? heatNeed / e.heatEff : 0, coolUse = e.coolCop > 0 ? coolNeed / e.coolCop : 0;
    const area = C.totalFloorArea(plan);
    return { inputs: e, env, parts, ua, air, H, heatNeed, coolNeed, heatUse, coolUse, peakKW: H * e.designDT / 1000, heatCost: heatUse * e.heatPrice, coolCost: coolUse * e.elecPrice,
      elecUse: e.baseLoad + (e.heatIsElec ? heatUse : 0) + coolUse, area, heatPerM2: area > 0 ? heatNeed / area : 0 };
  }
  function solar(plan, inputs) {
    const e = Object.assign({}, ENERGY_DEFAULTS, inputs || {}), L = C.levels(plan), b = C.bbox(L[L.length - 1]);
    const roofArea = b.w * b.d > 0 ? K.roofGeometry(plan, b).area : 0, usable = roofArea * e.roofUse;
    const fit = Math.max(0, Math.floor(usable / e.panelArea + 1e-9)), panels = e.panels > 0 ? Math.round(e.panels) : fit;
    const kWp = panels * e.panelW / 1000, yearKWh = kWp * e.sunHours * 365 * (1 - e.lossPct / 100);
    return { roofArea, usable, fit, panels, kWp, yearKWh, overRoof: panels > fit };
  }

  /* ---------- construction schedule ---------- */
  /* A starting schedule sized from the plan: working days for a small experienced crew. Rough examples to edit. */
  function defaultSchedule(plan, start) {
    const A = Math.max(10, C.totalFloorArea(plan)), L = C.levels(plan), floors = L.length, b = C.bbox(L[L.length - 1]);
    const roofA = b.w * b.d > 0 ? K.roofGeometry(plan, b).area : 0;
    const nOpen = sum(L, l => l.openings.length), extA = sum(L, l => C.planStats(l).extNet), pts = sum(L, l => (l.items || []).filter(i => i.cat !== 'furn').length);
    const d = (base, extra) => Math.max(1, Math.ceil(base + extra - 1e-9));
    const T = (id, name, days, after) => ({ id, name, days, after, done: false });
    return { start: C.isDate(start) ? start : '', workWeek: 5, tasks: [
      T('permits', 'Drawings, quotes and permit review (varies widely)', 20, []),
      T('site', 'Site preparation and set-out', d(2, A / 40), ['permits']),
      T('foundation', 'Foundation', d(4, A / 20), ['site']),
      T('framing', 'Floor and wall framing' + (floors > 1 ? ', all floors' : ''), d(3, A / 10 + (floors - 1) * 2), ['foundation']),
      T('roof', 'Roof framing and roofing', d(2, roofA / 25), ['framing']),
      T('openings', 'Windows and exterior doors', d(1, nOpen / 6), ['roof']),
      T('cladding', 'Cladding and exterior trim', d(2, extA / 25), ['openings']),
      T('roughin', 'Rough-in: plumbing and electrical (licensed trades)', d(3, A / 20 + pts / 10), ['roof']),
      T('inspect', 'Rough-in inspection, if your authority requires one', 1, ['roughin']),
      T('insulation', 'Insulation and air sealing', d(1, A / 40), ['inspect', 'openings']),
      T('drywall', 'Drywall and taping', d(3, A / 15), ['insulation']),
      T('flooring', 'Flooring', d(1, A / 25), ['drywall']),
      T('finishes', 'Kitchen, bath, trim and paint', d(4, A / 15), ['flooring']),
      T('fixtures', 'Fixtures and final connections (licensed trades)', d(2, pts / 15), ['finishes', 'cladding']),
      T('final', 'Final inspection and handover', 1, ['fixtures'])] };
  }
  const isWork = (d, ww) => { const g = d.getUTCDay(); return ww >= 7 || (ww === 6 ? g !== 0 : g !== 0 && g !== 6); };
  /* The date of working day n (0 = the first working day on or after start). */
  function workday(start, n, ww) {
    const d = new Date(start + 'T00:00:00Z');
    while (!isWork(d, ww)) d.setUTCDate(d.getUTCDate() + 1);
    for (let k = 0; k < n;) { d.setUTCDate(d.getUTCDate() + 1); if (isWork(d, ww)) k++; }
    return d.toISOString().slice(0, 10);
  }
  /* Forward and backward pass. Returns rows with early start/finish (working days), slack, critical flag and dates. */
  function computeSchedule(s) {
    const tasks = s.tasks, idx = {}; tasks.forEach((t, i) => { idx[t.id] = i; });
    const pre = tasks.map(t => t.after.filter(a => a in idx).map(a => idx[a])), succ = tasks.map(() => []);
    pre.forEach((ps, i) => ps.forEach(p => succ[p].push(i)));
    const indeg = pre.map(p => p.length), order = [], q = [];
    indeg.forEach((n, i) => { if (!n) q.push(i); });
    while (q.length) { const i = q.shift(); order.push(i); succ[i].forEach(j => { if (--indeg[j] === 0) q.push(j); }); }
    if (order.length < tasks.length) {
      const stuck = tasks.filter((t, i) => order.indexOf(i) < 0).map(t => t.name);
      return { error: 'These tasks wait on each other, so no order works: ' + stuck.slice(0, 4).join('; ') + '.', rows: [], total: 0, end: '' };
    }
    const es = [], ef = [];
    order.forEach(i => { es[i] = pre[i].reduce((m, p) => Math.max(m, ef[p]), 0); ef[i] = es[i] + tasks[i].days; });
    const total = ef.reduce((m, v) => Math.max(m, v), 0), lf = tasks.map(() => total), ls = [];
    order.slice().reverse().forEach(i => { lf[i] = succ[i].reduce((m, j) => Math.min(m, ls[j]), total); ls[i] = lf[i] - tasks[i].days; });
    const ww = s.workWeek || 5, dated = C.isDate(s.start);
    const rows = tasks.map((t, i) => ({ id: t.id, n: i + 1, name: t.name, days: t.days, after: pre[i].map(p => p + 1), done: !!t.done, es: es[i], ef: ef[i], slack: ls[i] - es[i],
      critical: ls[i] - es[i] === 0, start: dated ? workday(s.start, es[i], ww) : '', end: dated ? workday(s.start, Math.max(es[i], ef[i] - 1), ww) : '' }));
    return { error: '', rows, total, end: dated && total ? workday(s.start, total - 1, ww) : '' };
  }
  /* Gantt chart as an SVG string; every text is escaped. x axis in working days, a grid line every 5. */
  function ganttSVG(res, opt) {
    opt = Object.assign({ px: 960, label: 250, row: 22 }, opt || {});
    const rows = res.rows, n = rows.length, span = Math.max(5, res.total), top = 30, W = opt.px, x0 = opt.label + 10, cw = (W - x0 - 12) / span, H = top + n * opt.row + 14;
    const out = ['<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>'];
    for (let d = 0; d <= span; d += 5) {
      const x = (x0 + d * cw).toFixed(1);
      out.push('<line x1="' + x + '" y1="' + (top - 6) + '" x2="' + x + '" y2="' + (H - 10) + '" stroke="#dcd8cc" stroke-width="1"/>');
      out.push('<text x="' + x + '" y="' + (top - 12) + '" font-size="10" text-anchor="middle" fill="#55615a" font-family="Segoe UI,Arial,sans-serif">' + (d === 0 ? 'day 0' : d % 10 === 0 ? 'day ' + d : '') + '</text>');
    }
    rows.forEach((r, i) => {
      const y = top + i * opt.row, nm = r.n + '. ' + r.name;
      out.push('<text x="6" y="' + (y + opt.row * 0.68).toFixed(1) + '" font-size="11" fill="#18211d" font-family="Segoe UI,Arial,sans-serif">' + esc(nm.length > 40 ? nm.slice(0, 39) + '...' : nm) + '</text>');
      const bx = x0 + r.es * cw, bw = Math.max(2, r.days * cw), col = r.done ? '#1f7a5a' : r.critical ? '#5b3fc4' : '#9b8fd0';
      out.push('<rect x="' + bx.toFixed(1) + '" y="' + (y + 4) + '" width="' + bw.toFixed(1) + '" height="' + (opt.row - 8) + '" rx="3" fill="' + col + '"/>');
      if (r.days > 0 && bw > 22) out.push('<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (y + opt.row * 0.66).toFixed(1) + '" font-size="10" text-anchor="middle" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif">' + r.days + 'd</text>');
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Construction schedule, ' + res.total + ' working days">' + out.join('') + '</svg>';
  }
  const csvCell = v => { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  function scheduleCSV(res, name) {
    const out = [['# Stark Builder construction schedule', name || ''].map(csvCell).join(','), csvCell('# PLANNING SCHEDULE ONLY. Durations are rough examples for a small crew; weather, inspections, permits and deliveries change them.'),
      ['#', 'Task', 'Working days', 'After tasks', 'Start', 'Finish', 'Slack (days)', 'Critical', 'Done'].join(',')];
    res.rows.forEach(r => out.push([r.n, r.name, r.days, r.after.join(' '), r.start || 'day ' + r.es, r.end || 'day ' + Math.max(r.es, r.ef - 1), r.slack, r.critical ? 'yes' : '', r.done ? 'yes' : ''].map(csvCell).join(',')));
    return out.join('\r\n') + '\r\n';
  }

  /* ---------- cost scenarios ---------- */
  function scenarioMult(scn, regions) { return scn.region === 'custom' ? scn.customMult : (regions.find(r => r.id === scn.region) || { mult: 1 }).mult; }
  /* materialsFn(prices, mult) returns the materials total for whatever is being priced (a building or the whole site). */
  function scenarioTotals(scn, materialsFn, regions, area) {
    const mult = scenarioMult(scn, regions), materials = materialsFn(scn.prices, mult), labour = materials * scn.labourPct / 100;
    const contingency = (materials + labour) * scn.contPct / 100, total = materials + labour + contingency;
    return { mult, materials, labour, contingency, total, perM2: area > 0 ? total / area : 0 };
  }
  /* Three example scenarios to start from. The prices are illustrations, not market data. */
  function exampleScenarios() {
    return [
      { id: 'budget', name: 'Budget (example)', region: 'rural', customMult: 1, prices: { cladding: 22, flooring: 20, window: 210, door_ext: 320, roofing: 16 }, labourPct: 0, contPct: 10 },
      { id: 'standard', name: 'Standard (example)', region: 'baseline', customMult: 1, prices: {}, labourPct: 60, contPct: 10 },
      { id: 'premium', name: 'Premium (example)', region: 'metro', customMult: 1, prices: { cladding: 55, flooring: 70, window: 420, door_ext: 900, roofing: 38, insulation: 18 }, labourPct: 80, contPct: 15 }];
  }

  /* ---------- permits ---------- */
  function permitList(state) {
    const st = state || {}, items = CAT.PERMITS.map(p => ({ id: p.id, phase: p.phase, text: p.text, custom: false }))
      .concat((st.custom || []).map(c => ({ id: c.id, phase: Math.min(CAT.PERMIT_PHASES.length - 1, c.phase || 0), text: c.text, custom: true })));
    const done = items.filter(i => st.done && st.done[i.id]).length;
    return { items, done, total: items.length, pct: items.length ? Math.round(done / items.length * 100) : 0 };
  }

  const api = { STAIR, stairRect, stairCalc, stairChecks, accessChecks, ENERGY_DEFAULTS, CLIMATES, envelope, energy, solar,
    defaultSchedule, workday, computeSchedule, ganttSVG, scheduleCSV, scenarioMult, scenarioTotals, exampleScenarios, permitList, esc };
  SB.planning = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
