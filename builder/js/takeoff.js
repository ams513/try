/* Stark Builder, by Stark. Materials takeoff, cost and order list. Pure functions, no DOM.
   An ESTIMATE from simple framing rules (16 in / 406 mm studs and joists, 610 mm rafters, 10% waste). It is for
   comparing designs and budgeting, not for ordering material or bidding: a licensed professional must size members. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const C = SB.core || (typeof require !== 'undefined' ? require('./core.js') : null);
  const P = SB.prices || (typeof require !== 'undefined' ? require('../data/prices.js') : null);
  const SHEET = 1.22 * 2.44;           // m2 of one 4 x 8 ft panel
  const STUD_OC = 0.4064, RAFTER_OC = 0.61, WASTE = 1.10, FLOOR_WASTE = 1.08;
  const PLATES_T = 0.038 * 3;          // two top plates and one bottom plate
  const ceil1 = v => Math.ceil(v * 10 - 1e-9) / 10;

  const GROUP_ORDER = ['Lumber', 'Sheathing', 'Cladding', 'Roofing', 'Insulation', 'Drywall', 'Flooring', 'Windows', 'Doors', 'Stairs', 'Services', 'Allowance', 'Site'];
  const meta = {}; P.items.forEach(r => { meta[r[0]] = { label: r[1], unit: r[2], group: r[4] }; });

  function roofGeometry(plan, bb) {
    const r = plan.roof || { type: 'gable', pitch: 25, overhang: 0.3 };
    const Lg = Math.max(bb.w, bb.d), Sh = Math.min(bb.w, bb.d), o = r.overhang || 0;
    const pitch = r.type === 'flat' ? 2 : r.pitch, cosP = Math.cos(pitch * Math.PI / 180);
    let slope, area, rafLm;
    const count = Math.ceil((Lg + 2 * o) / RAFTER_OC) + 1;
    if (r.type === 'gable') { slope = (Sh / 2 + o) / cosP; area = 2 * slope * (Lg + 2 * o); rafLm = 2 * count * slope; }
    else { slope = (Sh + 2 * o) / cosP; area = slope * (Lg + 2 * o); rafLm = count * slope; }
    return { type: r.type, pitch, overhang: o, Lg, Sh, slope, area, rafLm, count };
  }

  /* prices: {key: unit price}; mult: region multiplier. Returns the takeoff with every line, subtotal and total.
     Several floors: walls, floor framing, subfloor, drywall and flooring add up floor by floor; the roof sits on the top
     floor; the ceiling is insulated under the roof and the floor over the ground. */
  function takeoff(plan, prices, mult) {
    prices = Object.assign({}, P.defaults, prices || {});
    mult = mult > 0 ? mult : 1;
    const LV = C.levels(plan), multi = LV.length > 1, st = C.planStats(plan), bb = st.bbox;
    const lines = [];
    const add = (key, measure, qty, basis) => {
      const m = meta[key]; const price = prices[key] * mult;
      lines.push({ key, label: m.label, group: m.group, unit: m.unit, measure, qty, basis, price, cost: qty * price });
    };
    let ext = 0, int = 0, jlm = 0, subF = 0, ceilF = 0, extNet = 0, intNet = 0, floorM = 0, winA = 0, wins = 0, dExt = 0, dPatio = 0, dInt = 0, stairs = 0, svcE = 0, svcP = 0, joistTxt = '';
    LV.forEach(lv => {
      const H = C.wallH(lv), s = C.planStats(lv), b = s.bbox;
      // wall framing
      let headers = 0;
      lv.walls.forEach(w => {
        const L = C.wallLen(w), n = C.openingsOn(lv, w.id);
        const studs = Math.ceil(L / STUD_OC) + 1 + 3 * n.length;
        const lm = studs * Math.max(0.1, H - PLATES_T) + 3 * L;
        if (w.type === 'ext') ext += lm; else int += lm;
        n.forEach(o => { headers += 2 * (o.w + 0.15); });
      });
      // floor framing
      const Lg = Math.max(b.w, b.d), Sh = Math.min(b.w, b.d), F = b.w * b.d;
      if (F > 0) { const joists = Math.ceil(Lg / STUD_OC) + 1; jlm += joists * Sh + headers; subF += F; ceilF += F; joistTxt = joists + ' joists at 406 mm across ' + C.round(Sh, 2) + ' m'; }
      extNet += s.extNet; intNet += s.intNet; floorM += s.floorArea > 0 ? s.floorArea : F;
      winA += s.windowArea; wins += s.windows; dExt += s.doorsExt; dPatio += s.doorsPatio; dInt += s.doorsInt;
      stairs += (lv.stairs || []).length;
      (lv.items || []).forEach(i => { if (i.cat === 'elec') svcE++; else if (i.cat === 'plumb') svcP++; });
    });
    const fl = ' on ' + LV.length + ' floors';
    if (ext) add('stud_2x6', ext, ceil1(ext * WASTE), 'studs at 406 mm centres, 3 extra per opening, 3 plates, +10% waste' + (multi ? fl : ''));
    if (int) add('stud_2x4', int, ceil1(int * WASTE), 'same rules, interior walls');
    if (subF > 0) {
      add('joist_2x8', jlm, ceil1(jlm * WASTE), (multi ? 'floor joists at 406 mm' + fl : joistTxt) + ', plus 2 headers per opening, +10% waste');
      add('osb_sub', subF, Math.ceil(subF * WASTE / SHEET - 1e-9), C.round(subF, 1) + ' m2 ' + (multi ? 'of floor' + fl : 'footprint') + ' / 2.98 m2 per panel, +10%');
    }
    // roof over the top floor
    const top = LV[LV.length - 1], tb = C.bbox(top), F0 = bb.w * bb.d, Ft = tb.w * tb.d;
    const roof = Ft > 0 ? roofGeometry(plan, tb) : null;
    if (roof) {
      add('rafter_2x6', roof.rafLm, ceil1(roof.rafLm * WASTE), roof.type + ' roof, ' + roof.count + ' rafters per slope at 610 mm, ' + C.round(roof.slope, 2) + ' m long, +10%');
      add('osb_roof', roof.area, Math.ceil(roof.area * WASTE / SHEET - 1e-9), C.round(roof.area, 1) + ' m2 of roof with overhang, +10%');
      add('roofing', roof.area, ceil1(roof.area * WASTE), C.round(roof.area, 1) + ' m2 of roof, +10%');
    }
    // walls
    if (extNet > 0) {
      add('osb_wall', extNet, Math.ceil(extNet * WASTE / SHEET - 1e-9), C.round(extNet, 1) + ' m2 exterior wall minus openings, +10%');
      add('cladding', extNet, ceil1(extNet * 1.05), C.round(extNet, 1) + ' m2 exterior wall minus openings, +5%');
    }
    const insul = extNet + (F0 > 0 ? F0 : 0) + (Ft > 0 ? Ft : 0);
    if (insul > 0) add('insulation', insul, ceil1(insul), 'exterior walls + ceiling + floor = ' + C.round(insul, 1) + ' m2');
    const dry = extNet + 2 * intNet + ceilF;
    if (dry > 0) add('drywall', dry, Math.ceil(dry * WASTE / SHEET - 1e-9), C.round(dry, 1) + ' m2 of interior wall faces and ceiling' + (multi ? 's' : '') + ', +10%');
    if (floorM > 0) add('flooring', floorM, ceil1(floorM * FLOOR_WASTE), C.round(floorM, 1) + ' m2 of rooms, +8%');
    // openings
    if (winA > 0) add('window', winA, ceil1(winA), wins + ' windows');
    if (dExt) add('door_ext', dExt, dExt, 'exterior doors');
    if (dPatio) add('door_patio', dPatio, dPatio, 'doors wider than 1.5 m');
    if (dInt) add('door_int', dInt, dInt, 'interior doors');
    if (stairs) add('stair', stairs, stairs, stairs + ' straight flight' + (stairs > 1 ? 's' : '') + ' drawn on the plan');
    if (svcE) add('svc_elec', svcE, svcE, 'electrical points marked on the plan (allowance, not a design)');
    if (svcP) add('svc_plumb', svcP, svcP, 'plumbing points marked on the plan (allowance, not a design)');
    lines.sort((x, y) => GROUP_ORDER.indexOf(x.group) - GROUP_ORDER.indexOf(y.group));
    const subtotal = lines.reduce((s, l) => s + l.cost, 0);
    const pct = prices.misc_pct;
    if (subtotal > 0 && pct > 0) {
      lines.push({ key: 'misc_pct', label: meta.misc_pct.label, group: 'Allowance', unit: '%', measure: subtotal / mult, qty: pct, basis: pct + '% of the lines above', price: 0, cost: subtotal * pct / 100 });
    }
    const total = lines.reduce((s, l) => s + l.cost, 0);
    return { lines, subtotal, total, mult, stats: st, roof, floorArea: F0, H: C.wallH(plan), floors: LV.length };
  }

  /* Site items: paths (m2) and utility placeholders, grouped with the building takeoffs by phase. */
  function pathLength(p) { let L = 0; for (let i = 1; i < p.pts.length; i++) L += C.dist(p.pts[i - 1], p.pts[i]); return L; }
  function siteTakeoff(site, prices, mult) {
    prices = Object.assign({}, P.defaults, prices || {});
    mult = mult > 0 ? mult : 1;
    const phases = [0, 0, 0, 0, 0].map(() => 0); // index 1..4
    const items = [];
    site.buildings.forEach(b => {
      const t = takeoff(b.plan, prices, mult);
      items.push({ kind: 'building', id: b.id, name: b.name, phase: b.phase, cost: t.total, takeoff: t });
      phases[b.phase] += t.total;
    });
    site.paths.forEach(p => {
      const area = pathLength(p) * p.w; const cost = area * prices.site_path * mult;
      items.push({ kind: 'path', id: p.id, name: 'Path ' + C.round(pathLength(p), 1) + ' m', phase: p.phase, cost, area });
      phases[p.phase] += cost;
    });
    const key = { solar: 'site_solar', water: 'site_water', septic: 'site_septic', power: 'site_power', parking: 'site_parking' };
    site.utils.forEach(u => {
      const cost = prices[key[u.kind]] * mult;
      items.push({ kind: u.kind, id: u.id, name: u.kind, phase: u.phase, cost });
      phases[u.phase] += cost;
    });
    return { items, phases, total: phases.reduce((s, v) => s + v, 0) };
  }
  /* Merge the lines of several takeoffs by key (quantities and costs add). Used for the whole-site materials list. */
  function mergeLines(list) {
    const map = {};
    list.forEach(t => t.lines.forEach(l => {
      const m = map[l.key] || (map[l.key] = Object.assign({}, l, { measure: 0, qty: 0, cost: 0, basis: 'sum of all buildings' }));
      m.cost += l.cost;
      if (l.key !== 'misc_pct') { m.measure += l.measure; m.qty += l.qty; } else { m.measure = 0; m.qty = l.qty; }
    }));
    return Object.keys(map).map(k => map[k]).sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }
  const unitText = { lm: 'lm', sheet: 'sheets', m2: 'm2', each: 'each', '%': '%' };
  const altQty = l => (l.unit === 'lm' ? Math.round(l.qty / C.FT) + ' lf' : l.unit === 'm2' ? Math.round(l.qty / C.SQFT) + ' ft2' : '');
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  /* CSV of a takeoff. Header comments state that prices are examples. */
  function toCSV(lines, opts) {
    opts = opts || {};
    const cur = opts.currency || '$';
    const out = [];
    out.push(['# Stark Builder materials takeoff', opts.name || ''].map(csvCell).join(','));
    out.push(['# PLANNING ESTIMATE ONLY. Unit prices are example prices to be replaced with local quotes. Not a bid. Have a licensed professional review the plan.'].map(csvCell).join(','));
    out.push(['# Region multiplier', opts.mult == null ? 1 : opts.mult].map(csvCell).join(','));
    out.push(['Group', 'Item', 'Unit', 'Measured', 'Quantity to buy', 'Imperial equivalent', 'Unit price (' + cur + ', after multiplier)', 'Cost (' + cur + ')', 'How it was figured'].join(','));
    lines.forEach(l => {
      out.push([l.group, l.label, unitText[l.unit] || l.unit, C.round(l.measure, 2), C.round(l.qty, 2), altQty(l), C.round(l.price, 2), C.round(l.cost, 2), l.basis].map(csvCell).join(','));
    });
    const total = lines.reduce((s, l) => s + l.cost, 0);
    out.push(['', 'TOTAL', '', '', '', '', '', C.round(total, 2), ''].map(csvCell).join(','));
    return out.join('\r\n') + '\r\n';
  }
  /* ---------- order list: the takeoff turned into what you ask a supplier for ----------
     Piece lengths and pack sizes are examples you change to match your supplier. Windows and doors are listed by size
     from the drawing. Allowances (services, small items, site placeholders) are not orderable and are left out. */
  const ORDER_DEFAULTS = { stud_2x6: 2.44, stud_2x4: 2.44, joist_2x8: 4.88, rafter_2x6: 4.88, roofing: 3.1, insulation: 5.0, flooring: 2.0, cladding: 1.0 };
  const ORDER_LABEL = { roofing: 'bundles or packs', insulation: 'packs', flooring: 'boxes', cladding: 'units' };
  function orderList(lines, sizes, plans) {
    sizes = Object.assign({}, ORDER_DEFAULTS, sizes || {});
    const rows = [], r2 = v => C.round(v, 2);
    lines.forEach(l => {
      const sz = sizes[l.key];
      if (l.unit === 'lm' && sz) rows.push({ group: l.group, item: l.label, qty: Math.ceil(l.qty / sz - 1e-9), unit: 'pieces ' + r2(sz) + ' m (' + C.fmtLen(sz, 'imperial') + ') long', basis: C.round(l.qty, 1) + ' lm with waste / piece length' });
      else if (l.unit === 'sheet') rows.push({ group: l.group, item: l.label, qty: Math.round(l.qty), unit: 'sheets 1220 x 2440 mm (4 x 8 ft)', basis: 'from the takeoff, waste included' });
      else if (l.unit === 'm2' && sz && l.key !== 'window') rows.push({ group: l.group, item: l.label, qty: Math.ceil(l.qty / sz - 1e-9), unit: (ORDER_LABEL[l.key] || 'units') + ' covering ' + r2(sz) + ' m2', basis: C.round(l.qty, 1) + ' m2 with waste / coverage per unit' });
      else if (l.key === 'stair') rows.push({ group: l.group, item: 'Straight stair flight (site-built or kit)', qty: l.qty, unit: 'each', basis: 'stairs drawn on the plan; size and code checks by your designer' });
    });
    const sched = {};
    (plans || []).forEach(p => C.levels(p).forEach(lv => lv.openings.forEach(o => {
      const w = C.findWall(lv, o.wall); if (!w) return;
      const kind = o.type === 'window' ? 'Window' : o.w > 1.5 ? 'Patio or sliding door' : w.type === 'ext' ? 'Exterior door' : 'Interior door';
      const spec = r2(o.w) + ' x ' + r2(o.h) + ' m (' + C.fmtLen(o.w, 'imperial') + ' x ' + C.fmtLen(o.h, 'imperial') + ')' + (o.type === 'window' ? ', sill ' + r2(o.sill) + ' m' : '');
      const k = kind + '|' + spec; (sched[k] = sched[k] || { group: o.type === 'window' ? 'Windows' : 'Doors', item: kind + ', ' + spec, qty: 0, unit: 'each', basis: 'opening size as drawn; confirm rough-opening sizes with the maker' }).qty++;
    })));
    Object.keys(sched).sort().forEach(k => rows.push(sched[k]));
    rows.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    return rows;
  }
  function orderCSV(rows, opts) {
    opts = opts || {};
    const out = [['# Stark Builder order list', opts.name || ''].map(csvCell).join(','),
      csvCell('# PLANNING LIST ONLY. Quantities come from simple rules and example piece and pack sizes. Confirm every size and quantity with your supplier and your builder before ordering.'),
      ['Group', 'Item', 'Order quantity', 'Order unit', 'How it was figured'].join(',')];
    rows.forEach(r => out.push([r.group, r.item, r.qty, r.unit, r.basis].map(csvCell).join(',')));
    return out.join('\r\n') + '\r\n';
  }
  const api = { takeoff, siteTakeoff, mergeLines, toCSV, roofGeometry, altQty, pathLength, SHEET, GROUP_ORDER, meta, orderList, orderCSV, ORDER_DEFAULTS };
  SB.takeoff = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
