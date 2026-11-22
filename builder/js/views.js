/* Stark Builder, by Stark. Site, library, costs, project, about and the printable sheets. */
(function () {
  'use strict';
  const SB = window.SB, C = SB.core, K = SB.takeoff, T = SB.templates, S = SB.svg, app = SB.app;
  const { h, $, clear, clone } = app;
  const PH_NAMES = ['', 'Phase 1: site work and first building', 'Phase 2: next buildings', 'Phase 3: shared buildings and utilities', 'Phase 4: later additions'];
  const UTIL_LABEL = { solar: 'Solar array', water: 'Water source', septic: 'Septic or sewer', power: 'Power service', parking: 'Parking pad' };
  const esc = S.esc;
  const stat = app.stat;

  /* ---------- downloads ---------- */
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  const slug = s => String(s || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan';
  app.download = download;

  /* ---------- modal confirm ---------- */
  function ask(title, body, okLabel) {
    return new Promise(res => {
      const m = $('#modal'); clear(m); m.hidden = false;
      const done = v => { m.hidden = true; clear(m); res(v); };
      const ok = h('button', { type: 'button', class: 'btn primary', onclick: () => done(true) }, okLabel || 'OK');
      m.appendChild(h('div', { class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', { text: title }), h('p', { text: body }), h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: () => done(false) }, 'Cancel'), ok)));
      ok.focus();
    });
  }
  app.ask = ask; app.slug = slug;

  /* ---------- site view ---------- */
  const SITE_TOOLS = [['select', 'Select'], ['path', 'Path'], ['solar', 'Solar'], ['water', 'Water'], ['septic', 'Septic'], ['power', 'Power'], ['parking', 'Parking']];
  app.siteBtns = {};
  app.siteCommit = function () { app.commit('Site'); };
  app.siteSelect = function () { renderSiteSide(); };
  app.siteSetTool = function (t) { Object.keys(app.siteBtns).forEach(k => app.siteBtns[k].setAttribute('aria-pressed', k === t ? 'true' : 'false')); app.siteEd.setTool(t); $('#site-status').textContent = { select: 'Drag buildings, paths and utilities to move them. Click one to edit it.', path: 'Click to lay out a path, double-click or press Enter to finish.' }[t] || 'Click on the map to place it.'; };
  app.siteDelete = function (sel) {
    const s = app.site; if (!sel) return;
    if (sel.type === 'building') s.buildings = s.buildings.filter(b => b.id !== sel.id); else if (sel.type === 'path') s.paths = s.paths.filter(p => p.id !== sel.id); else if (sel.type === 'util') s.utils = s.utils.filter(u => u.id !== sel.id);
    app.siteEd.sel = null; app.commit('Delete');
  };
  function buildSiteTools() {
    const box = clear($('#site-tools'));
    SITE_TOOLS.forEach(t => { const b = h('button', { type: 'button', class: 'btn', 'aria-pressed': t[0] === 'select' ? 'true' : 'false', onclick: () => app.siteSetTool(t[0]) }, app.icon(t[0] === 'select' ? 'select' : t[0] === 'path' ? 'wallInt' : 'room'), t[1]); app.siteBtns[t[0]] = b; box.appendChild(b); });
    box.appendChild(h('hr'));
    box.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => app.undo() }, app.icon('undo'), 'Undo'));
    box.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => app.redo() }, app.icon('redo'), 'Redo'));
    box.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => app.siteEd.fit() }, app.icon('fit'), 'Fit view'));
  }
  function freeSpot(b) {
    const s = app.site, size = app.siteEd.size(b), gap = 1.5;
    for (let y = size[1] / 2 + s.setback; y <= s.d - size[1] / 2 - s.setback + 1e-6; y += 1) for (let x = size[0] / 2 + s.setback; x <= s.w - size[0] / 2 - s.setback + 1e-6; x += 1) {
      b.x = x; b.y = y; const r = app.siteEd.rect(b);
      if (!s.buildings.some(q => { const o = app.siteEd.rect(q); return r.x0 - gap < o.x1 && o.x0 < r.x1 + gap && r.y0 - gap < o.y1 && o.y0 < r.y1 + gap; })) return;
    }
    b.x = s.w / 2; b.y = s.d / 2;
  }
  app.addBuilding = function (plan, name) {
    const s = app.site, b = { id: s.nextId++, name: name || plan.name, plan: clone(plan), x: 0, y: 0, rot: 0, phase: Math.min(4, Math.max(1, s.buildings.length ? 2 : 1)) };
    freeSpot(b); s.buildings.push(b); app.siteEd.sel = { type: 'building', id: b.id }; app.commit('Add building'); return b;
  };
  function renderSiteSide() {
    const side = $('#site-side'); if (!side) return; const s = app.site, ed = app.siteEd, keep = side.scrollTop; clear(side);
    // lot
    side.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Lot' }),
      h('div', { class: 'grid2' }, app.lenField('Width', s.w, v => { s.w = Math.min(2000, Math.max(5, v)); ed.fitted = false; app.commit('Lot'); }), app.lenField('Depth', s.d, v => { s.d = Math.min(2000, Math.max(5, v)); ed.fitted = false; app.commit('Lot'); })),
      app.lenField('Setback (example)', s.setback || 0.01, v => { s.setback = v; app.commit('Setback'); }, 'An example edge setback shown dashed. Your zoning sets the real number.'),
      h('label', { class: 'f' }, 'Show up to phase ' + ed.showPhase, h('input', { type: 'range', min: 1, max: 4, step: 1, value: ed.showPhase, 'aria-label': 'Show phases up to', oninput: e => { ed.showPhase = parseInt(e.target.value, 10); renderSiteSide(); ed.redraw(); renderMesh3dReset(); } }))));
    // add building
    const sel = h('select', { id: 'add-tpl', 'aria-label': 'Building to add' }, h('option', { value: '__current', text: 'Current floor plan: ' + app.plan.name }), T.list.map(t => h('option', { value: t.id, text: t.name + ' (' + app.fa(C.totalFloorArea(t.plan)) + ')' })));
    side.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Add a building' }), sel, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'btn primary', onclick: () => { const v = sel.value; if (v === '__current') app.addBuilding(app.plan, app.plan.name); else { const t = T.byId(v); app.addBuilding(t.plan, t.name); } } }, 'Add to site'))));
    // inspector
    const it = ed.sel, card = h('div', { class: 'card' }, h('h2', { text: 'Selected' })); side.appendChild(card);
    const phaseSel = o => h('label', { class: 'f' }, 'Build phase', h('select', { onchange: e => { o.phase = parseInt(e.target.value, 10); app.commit('Phase'); } }, [1, 2, 3, 4].map(n => h('option', { value: n, selected: o.phase === n, text: PH_NAMES[n] }))));
    if (!it) card.appendChild(h('p', { class: 'hint', text: 'Click a building, path or utility on the map.' }));
    else if (it.type === 'building') {
      const b = s.buildings.find(q => q.id === it.id);
      if (!b) ed.sel = null; else {
        card.appendChild(h('label', { class: 'f' }, 'Name', h('input', { type: 'text', value: b.name, maxLength: 60, onchange: e => { b.name = e.target.value.trim() || b.plan.name; app.commit('Rename'); } })));
        card.appendChild(phaseSel(b));
        const sz = ed.size(b); card.appendChild(stat('Footprint', app.fl(sz[0]) + ' x ' + app.fl(sz[1])));
        card.appendChild(h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', onclick: () => { b.rot = (b.rot + 1) % 4; app.commit('Rotate'); } }, 'Rotate 90'),
          h('button', { type: 'button', class: 'btn', onclick: () => { const c = app.addBuilding(b.plan, b.name + ' copy'); c.phase = b.phase; app.commit('Copy'); } }, 'Copy'),
          h('button', { type: 'button', class: 'btn', title: 'Open a copy of this building in the floor plan editor', onclick: () => { app.plan = clone(b.plan); app.level = 0; app.sel = null; app.editor.fitted = false; app.commit('Edit copy'); app.floorUI(); location.hash = '#/plan'; } }, 'Edit a copy')));
        card.appendChild(h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { type: 'button', class: 'btn danger', onclick: () => app.siteDelete(it) }, 'Remove')));
      }
    } else if (it.type === 'path') {
      const p = s.paths.find(q => q.id === it.id);
      if (!p) ed.sel = null; else {
        card.appendChild(app.lenField('Path width', p.w, v => { p.w = Math.min(10, v); app.commit('Path'); })); card.appendChild(phaseSel(p));
        card.appendChild(stat('Length', app.fl(K.pathLength(p)))); card.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn danger', onclick: () => app.siteDelete(it) }, 'Remove')));
      }
    } else if (it.type === 'util') {
      const u = s.utils.find(q => q.id === it.id);
      if (!u) ed.sel = null; else {
        card.appendChild(h('p', { text: UTIL_LABEL[u.kind] + ' placeholder' })); card.appendChild(phaseSel(u));
        card.appendChild(h('p', { class: 'hint', text: 'A marker for planning where it could go. Real systems need design and permits.' }));
        card.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn danger', onclick: () => app.siteDelete(it) }, 'Remove')));
      }
    }
    // warnings
    const wr = ed.warnings(); wr.forEach(w => side.appendChild(h('div', { class: 'warn', text: w })));
    // phases
    const tk = K.siteTakeoff(s, app.priceMap(), app.mult()), tbl = h('table', null, h('thead', null, h('tr', null, h('th', { text: 'Phase' }), h('th', { text: 'What' }), h('th', { class: 'num', text: 'Cost' }))));
    const tb = h('tbody'); let cum = 0;
    for (let n = 1; n <= 4; n++) {
      const items = tk.items.filter(i => i.phase === n); cum += tk.phases[n];
      tb.appendChild(h('tr', null, h('td', { text: String(n) }), h('td', { text: items.length ? items.map(i => i.kind === 'building' ? i.name : i.kind === 'path' ? 'path' : UTIL_LABEL[i.kind]).join(', ') : '-' }), h('td', { class: 'num', text: app.money(tk.phases[n]) })));
    }
    tb.appendChild(h('tr', null, h('td'), h('td', null, h('b', { text: 'All phases' })), h('td', { class: 'num' }, h('b', { text: app.money(cum) }))));
    tbl.appendChild(tb);
    side.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Build stages' }), h('div', { class: 'scroll-x' }, tbl), h('p', { class: 'hint', text: 'Costs use the example price table and region multiplier from the Materials tab. Replace them with local quotes. Utilities are lump-sum placeholders.' })));
    side.scrollTop = keep;
  }
  function renderMesh3dReset() { app.built3d = null; }
  app.views.site = function () { if (!app.siteToolsBuilt) { buildSiteTools(); app.siteToolsBuilt = true; } app.siteEd.redraw(); renderSiteSide(); };

  /* ---------- library ---------- */
  app.views.library = function () {
    const box = clear($('#lib')), P = app.priceMap(), mult = app.mult();
    T.list.forEach(t => {
      const st = C.planStats(t.plan), tk = K.takeoff(t.plan, P, mult), LV = C.levels(t.plan);
      const thumb = h('div', { class: 'thumb' }); thumb.innerHTML = S.planSVG(t.plan, { units: app.units, labels: false, dims: false, px: 320 });
      box.appendChild(h('article', { class: 'card tpl' }, thumb, h('h3', { text: t.name }),
        h('div', { class: 'meta' }, h('span', { text: app.fa(C.totalFloorArea(t.plan)) }), h('span', { text: app.fl(st.bbox.w) + ' x ' + app.fl(st.bbox.d) }), LV.length > 1 ? h('span', { text: LV.length + ' floors' }) : null, h('span', { text: t.beds ? t.beds + ' bed' : t.kind === 'support' ? 'support building' : 'studio' }), h('span', { text: LV.reduce((s, l) => s + l.rooms.length, 0) + ' rooms' }), h('span', { text: t.plan.roof.type + ' roof' })),
        h('p', { text: t.blurb }), h('div', { class: 'small' }, 'Example materials: ', h('b', { text: app.money(tk.total) }), h('span', { class: 'muted', text: ' (example prices)' })),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => { app.plan = clone(t.plan); app.level = 0; app.sel = null; app.editor.fitted = false; app.commit('Open design'); app.floorUI(); location.hash = '#/plan'; app.say('Opened ' + t.name + '. Ctrl+Z brings your previous plan back.'); } }, 'Open in editor'),
          h('button', { type: 'button', class: 'btn', onclick: () => { app.addBuilding(t.plan, t.name); app.say(t.name + ' added to the site (Site tab).'); location.hash = '#/site'; } }, 'Add to site'))));
    });
  };

  /* ---------- costs ---------- */
  let costCells = null;
  function costData() {
    const P = app.priceMap(), mult = app.mult();
    if (app.costScope === 'site' && app.site.buildings.length) {
      const tks = app.site.buildings.map(b => K.takeoff(b.plan, P, mult)); const lines = K.mergeLines(tks);
      const stk = K.siteTakeoff(app.site, P, mult), extra = [];
      let pathArea = 0; app.site.paths.forEach(p => { pathArea += K.pathLength(p) * p.w; });
      const mk = (key, measure, qty, basis) => { const m = K.meta[key]; extra.push({ key, label: m.label, group: m.group, unit: m.unit, measure, qty, basis, price: P[key] * mult, cost: qty * P[key] * mult }); };
      if (pathArea > 0) mk('site_path', pathArea, Math.ceil(pathArea * 10) / 10, 'total path length x width');
      ['solar', 'water', 'septic', 'power', 'parking'].forEach(k => { const n = app.site.utils.filter(u => u.kind === k).length; if (n) mk('site_' + k, n, n, 'placeholders on the site map'); });
      const all = lines.concat(extra);
      return { lines: all, total: all.reduce((a, l) => a + l.cost, 0), name: 'Whole site (' + app.site.buildings.length + ' buildings)', area: app.site.buildings.reduce((a, b) => a + C.totalFloorArea(b.plan), 0), siteTotal: stk.total, plans: app.site.buildings.map(b => b.plan) };
    }
    const t = K.takeoff(app.plan, P, mult);
    return { lines: t.lines, total: t.total, name: app.plan.name, area: C.totalFloorArea(app.plan), plans: [app.plan] };
  }
  app.costData = costData;
  function recalcCosts() {
    if (!costCells) return; const d = costData();
    d.lines.forEach(l => { const c = costCells[l.key]; if (c) { c.qty.textContent = fmtQty(l); c.price.textContent = l.unit === '%' ? '' : app.currency + (Math.round(l.price * 100) / 100).toFixed(2); c.cost.textContent = app.money(l.cost); } });
    costCells.__total.textContent = app.money(d.total); costCells.__per.textContent = d.area > 0 ? app.currency + Math.round(d.total / d.area) + ' per m2  /  ' + app.currency + Math.round(d.total / (d.area / C.SQFT)) + ' per ft2 of floor area' : '';
  }
  const fmtQty = l => (l.unit === 'sheet' ? Math.round(l.qty) + ' sheets' : l.unit === 'each' ? Math.round(l.qty) + ' each' : l.unit === '%' ? l.qty + '% allowance' : (Math.round(l.qty * 10) / 10) + ' ' + (l.unit === 'm2' ? 'm2' : 'lm') + (K.altQty(l) ? ' (' + K.altQty(l) + ')' : ''));
  app.views.costs = function () {
    const box = clear($('#costs')), d = costData(); app.costScope = app.costScope || 'plan'; app.costView = app.costView || 'takeoff';
    box.appendChild(h('h1', { text: 'Materials and cost' }));
    box.appendChild(h('div', { class: 'seg subnav', role: 'group', 'aria-label': 'Cost views' }, [['takeoff', 'Takeoff and prices'], ['order', 'Order list'], ['scenarios', 'Cost scenarios']].map(v =>
      h('button', { type: 'button', 'aria-pressed': app.costView === v[0] ? 'true' : 'false', onclick: () => { app.costView = v[0]; app.views.costs(); } }, v[1]))));
    if (app.costView !== 'takeoff' && app.costViews && app.costViews[app.costView]) { app.costViews[app.costView](box); return; }
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'Example prices. ' }), 'Every unit price below is a placeholder to be replaced with quotes from your local suppliers. This is a planning estimate, not a bid: it leaves out foundations, plumbing, electrical, heating, fixtures, labour, permits, delivery and tax. Electrical and plumbing points you mark add only a rough-in allowance.'));
    const regSel = h('select', { 'aria-label': 'Region', onchange: e => { app.region = e.target.value; app.save(); app.views.costs(); } }, SB.prices.regions.map(r => h('option', { value: r.id, selected: app.region === r.id, text: r.label })));
    const cust = h('input', { type: 'number', min: 0.2, max: 5, step: 0.01, value: app.customMult, 'aria-label': 'Custom multiplier', onchange: e => { const v = parseFloat(e.target.value); app.customMult = v > 0 && v < 10 ? v : 1; app.save(); recalcCosts(); } });
    const scope = h('select', { 'aria-label': 'What to price', onchange: e => { app.costScope = e.target.value; app.views.costs(); } }, h('option', { value: 'plan', selected: app.costScope === 'plan', text: 'This building: ' + app.plan.name }), h('option', { value: 'site', selected: app.costScope === 'site', text: 'Whole site (all buildings, paths, utilities)' }));
    const cur = h('input', { type: 'text', maxLength: 3, value: app.currency, 'aria-label': 'Currency symbol', onchange: e => { app.currency = e.target.value.trim().slice(0, 3) || '$'; app.save(); app.views.costs(); } });
    box.appendChild(h('div', { class: 'costhead' }, h('label', { class: 'f' }, 'Price', scope), h('label', { class: 'f' }, 'Region multiplier (example)', regSel), app.region === 'custom' ? h('label', { class: 'f' }, 'Custom multiplier', cust) : h('div', { class: 'f' }, 'Multiplier', h('div', { style: 'font-size:1.1rem;font-weight:700', text: 'x' + app.mult().toFixed(2) })), h('label', { class: 'f' }, 'Currency symbol', cur)));
    if (app.costScope === 'site' && !app.site.buildings.length) box.appendChild(h('div', { class: 'warn', text: 'No buildings on the site yet, so this shows the current floor plan. Add buildings in the Site tab.' }));
    costCells = { __total: h('span', { class: 'big' }), __per: h('span', { class: 'muted small' }) };
    const tbl = h('table', { class: 'costtable' }, h('thead', null, h('tr', null, h('th', { text: 'Item' }), h('th', { text: 'How it was figured' }), h('th', { class: 'num', text: 'Quantity to buy' }), h('th', { class: 'num', text: 'Unit price' }), h('th', { class: 'num', text: 'Cost' }))));
    const tb = h('tbody'); let grp = '';
    d.lines.forEach(l => {
      if (l.group !== grp) { grp = l.group; tb.appendChild(h('tr', { class: 'grp' }, h('td', { colspan: 5, text: grp }))); }
      const c = costCells[l.key] = { qty: h('td', { class: 'num' }), price: h('td', { class: 'num' }), cost: h('td', { class: 'num' }) };
      tb.appendChild(h('tr', null, h('td', { class: 'item', text: l.label }), h('td', { class: 'small muted', text: l.basis }), c.qty, c.price, c.cost));
    });
    tbl.appendChild(tb);
    box.appendChild(h('div', { class: 'card' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', null, h('div', { class: 'muted small', text: 'Estimated materials total, example prices' }), costCells.__total, h('div', null, costCells.__per)),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => exportCSV() }, 'Download materials CSV'), h('button', { type: 'button', class: 'btn', onclick: () => showSheet('takeoff') }, 'Print materials list')))));
    box.appendChild(h('div', { class: 'card scroll-x' }, h('h2', { text: d.name }), tbl));
    // price table
    const pt = h('table', null, h('thead', null, h('tr', null, h('th', { text: 'Item' }), h('th', { text: 'Unit' }), h('th', { class: 'num', text: 'Your price (before multiplier)' }), h('th', { class: 'num', text: 'Example default' }))));
    const pb = h('tbody'); let g2 = '';
    SB.prices.items.forEach(r => {
      if (r[4] !== g2) { g2 = r[4]; pb.appendChild(h('tr', { class: 'grp' }, h('td', { colspan: 4, text: g2 }))); }
      const inp = h('input', { type: 'number', min: 0, step: 0.01, value: app.priceMap()[r[0]], 'aria-label': r[1], onchange: e => { const v = parseFloat(e.target.value); if (v >= 0 && isFinite(v)) { if (v === r[3]) delete app.prices[r[0]]; else app.prices[r[0]] = v; } else e.target.value = app.priceMap()[r[0]]; app.save(); recalcCosts(); } });
      pb.appendChild(h('tr', null, h('td', { text: r[1] }), h('td', { text: r[2] === 'm2' ? 'per m2' : r[2] === 'lm' ? 'per linear m' : r[2] === 'sheet' ? 'per sheet' : r[2] === 'each' ? 'each' : r[2] === '%' ? 'percent' : r[2] }), h('td', { class: 'num' }, inp), h('td', { class: 'num muted', text: String(r[3]) })));
    });
    pt.appendChild(pb);
    box.appendChild(h('div', { class: 'card scroll-x' }, h('h2', { text: 'Unit prices: edit these' }), h('p', { class: 'hint', text: 'Prices are per metric unit so the sheet maths is exact (1 lm = 3.28 lf, 1 m2 = 10.76 ft2). Your edits are saved with the project. The defaults are round example numbers, not market data.' }),
      h('div', { class: 'row', style: 'margin-bottom:8px' }, h('button', { type: 'button', class: 'btn', onclick: () => { app.prices = {}; app.save(); app.views.costs(); } }, 'Reset to the example defaults')), pt));
    recalcCosts();
  };
  function exportCSV() { const d = costData(); download(slug(d.name) + '-materials.csv', K.toCSV(d.lines, { name: d.name, mult: app.mult(), currency: app.currency }), 'text/csv'); }

  /* ---------- print sheets ---------- */
  const PL_STAIR_NOTES = plan => { const w = SB.planning.stairChecks(plan, app.units); return w.length ? '<h2>Stair notes</h2><ul>' + w.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''; };
  const DISCLAIMER = 'PLANNING DRAWING ONLY. This is not a construction document, not engineered, and not checked against any building code. Have it reviewed by a licensed architect or engineer before you buy materials or build. Codes, setbacks, permits and inspections vary by location. Material quantities and costs use example prices and simple rules, and are not a quote.';
  function sheetHead(title, sub) { return '<div class="head"><div><h1>' + esc(title) + '</h1><div class="muted">' + esc(sub) + '</div></div><div style="text-align:right"><strong>Stark Builder</strong><div class="muted">by Stark</div><div class="muted">' + new Date().toISOString().slice(0, 10) + '</div></div></div>'; }
  function table(cols, rows) { return '<table><thead><tr>' + cols.map(c => '<th' + (c[1] ? ' class="num"' : '') + '>' + esc(c[0]) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map((v, i) => '<td' + (cols[i][1] ? ' class="num"' : '') + '>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'; }
  Object.assign(app, { sheetHead, sheetTable: table, DISCLAIMER, fmtQty, sheets: app.sheets || {} });
  /* One floor's drawing, room schedule, totals and openings. */
  function floorSheet(plan, k, n) {
    const u = app.units, lv = C.levels(plan)[k], st = C.planStats(lv), view = Object.assign({}, lv, { name: plan.name + (n > 1 ? ', floor ' + (k + 1) : '') });
    const ops = lv.openings.map(o => { const w = C.findWall(lv, o.wall); return [o.type === 'window' ? 'Window' : 'Door', (w && w.type === 'ext' ? 'Outer' : 'Inner') + ' wall ' + o.wall, app.fl(o.w) + ' x ' + app.fl(o.h), o.type === 'window' ? app.fl(o.sill) : '-']; });
    return (n > 1 ? '<h2>Floor ' + (k + 1) + (k === 0 ? ' (ground)' : '') + '</h2>' : '') + '<div>' + S.planSVG(view, { units: u, px: 880 }) + '</div>' +
      '<h2>Room schedule' + (n > 1 ? ', floor ' + (k + 1) : '') + '</h2>' + table([['Room'], ['Area', 1], ['Perimeter', 1]], st.rooms.map(r => [r.name, app.fa(r.area), app.fl(r.perimeter)]).concat([['Floor area', app.fa(st.floorArea), '']])) +
      '<h2>Totals' + (n > 1 ? ', floor ' + (k + 1) : '') + '</h2>' + table([['Measure'], ['Value', 1]], [['Outer size', app.fl(st.bbox.w) + ' x ' + app.fl(st.bbox.d)], ['Footprint', app.fa(st.footprintArea)], ['Outer wall perimeter', app.fl(st.extPerimeter)], ['Inner wall length', app.fl(st.intLen)], ['Wall height', app.fl(C.wallH(lv))], ['Outer wall area, openings subtracted', app.fa(st.extNet)], ['Inner wall area, openings subtracted', app.fa(st.intNet)]]) +
      '<h2>Openings' + (n > 1 ? ', floor ' + (k + 1) : '') + '</h2>' + (ops.length ? table([['Kind'], ['Where'], ['Size', 1], ['Sill', 1]], ops) : '<p class="muted">None.</p>');
  }
  /* Count of every furniture piece and symbol on all floors, plus the stairs. */
  function symbolSchedule(plan) {
    const rows = {}, CAT = SB.catalog;
    C.levels(plan).forEach((lv, k) => {
      (lv.items || []).forEach(it => { const m = it.cat === 'furn' ? CAT.furn(it.kind) : CAT.marker(it.cat, it.kind), key = it.cat + '|' + it.kind; (rows[key] = rows[key] || { cat: it.cat, label: (m ? (it.cat === 'furn' ? m.label : m.sym + '  ' + m.label) : it.kind), n: 0, floors: new Set() }).n++; rows[key].floors.add(k + 1); });
      (lv.stairs || []).forEach(() => { const key = 'stair'; (rows[key] = rows[key] || { cat: 'stair', label: 'Straight stair', n: 0, floors: new Set() }).n++; rows[key].floors.add(k + 1); });
    });
    const name = { furn: 'Furniture', elec: 'Electrical (planning symbol)', plumb: 'Plumbing (planning symbol)', stair: 'Stairs' };
    return Object.keys(rows).sort().map(k => [name[rows[k].cat], rows[k].label, String(rows[k].n), Array.from(rows[k].floors).join(', ')]);
  }
  function sheetHTML(kind) {
    const u = app.units, plan = app.plan;
    if (app.sheets[kind]) return app.sheets[kind]();
    if (kind === 'plan') {
      const t = K.takeoff(plan, app.priceMap(), app.mult()), n = C.levels(plan).length, sym = symbolSchedule(plan);
      let body = ''; for (let k = 0; k < n; k++) body += floorSheet(plan, k, n);
      return sheetHead(plan.name, 'Floor plan' + (n > 1 ? 's, ' + n + ' floors, ' + app.fa(C.totalFloorArea(plan)) + ' in all' : '') + ', ' + (u === 'metric' ? 'metric' : 'imperial') + ' units, dimensions to wall centre lines') + body +
        (sym.length ? '<h2>Stairs, furniture and service symbols</h2>' + table([['Kind'], ['Item'], ['Count', 1], ['Floor', 1]], sym) + '<p class="muted">Electrical and plumbing symbols show where you want things. Licensed trades design, size and certify the real systems.</p>' : '') +
        PL_STAIR_NOTES(plan) +
        '<h2>Materials estimate (example prices)</h2>' + table([['Item'], ['Quantity', 1], ['Cost', 1]], t.lines.map(l => [l.label, fmtQty(l), app.money(l.cost)]).concat([['Total, example prices, region x' + app.mult().toFixed(2), '', app.money(t.total)]])) +
        '<div class="disclaimer"><strong>' + esc(DISCLAIMER) + '</strong></div>';
    }
    if (kind === 'site') {
      const s = app.site, tk = K.siteTakeoff(s, app.priceMap(), app.mult()), wr = app.siteEd.warnings();
      return sheetHead('Site plan', 'Lot ' + app.fl(s.w) + ' x ' + app.fl(s.d)) + '<div>' + S.siteSVG(s, { units: u, px: 880 }) + '</div>' +
        '<h2>Build stages</h2>' + table([['Phase'], ['Items'], ['Cost, example prices', 1]], [1, 2, 3, 4].map(n => [PH_NAMES[n], tk.items.filter(i => i.phase === n).map(i => i.kind === 'building' ? i.name : i.kind === 'path' ? 'path' : UTIL_LABEL[i.kind]).join(', ') || '-', app.money(tk.phases[n])]).concat([['All phases', '', app.money(tk.total)]])) +
        (wr.length ? '<h2>Checks</h2><ul>' + wr.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') +
        '<div class="disclaimer"><strong>' + esc(DISCLAIMER) + ' Utility markers are placeholders, not designed systems.</strong></div>';
    }
    const d = costData();
    return sheetHead('Materials list: ' + d.name, 'Region multiplier x' + app.mult().toFixed(2) + ', currency ' + app.currency) + table([['Item'], ['How it was figured'], ['Quantity', 1], ['Unit price', 1], ['Cost', 1]], d.lines.map(l => [l.label, l.basis, fmtQty(l), l.unit === '%' ? '' : app.currency + l.price.toFixed(2), app.money(l.cost)]).concat([['TOTAL', '', '', '', app.money(d.total)]])) +
      '<div class="disclaimer"><strong>' + esc(DISCLAIMER) + ' Prices shown are example prices: replace them with local quotes.</strong></div>';
  }
  function showSheet(kind) {
    const sh = $('#sheet'); clear(sh);
    sh.appendChild(h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn primary', onclick: () => window.print() }, 'Print or save as PDF'), h('button', { type: 'button', class: 'btn', onclick: () => { sh.classList.remove('on'); } }, 'Close')));
    const paper = h('div', { class: 'paper' }); paper.innerHTML = sheetHTML(kind); sh.appendChild(paper); sh.classList.add('on'); sh.scrollTop = 0;
  }
  app.showSheet = showSheet;

  /* ---------- project ---------- */
  app.views.project = function () {
    const box = clear($('#project')), msg = h('div', { class: 'small', role: 'status', 'aria-live': 'polite', style: 'min-height:1.4em;margin-top:8px' });
    const file = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', id: 'load-file', onchange: e => {
      const f = e.target.files[0]; if (!f) return; if (f.size > 8e6) { msg.textContent = 'That file is too large to be a Stark Builder project.'; return; }
      const rd = new FileReader();
      rd.onload = () => { try { const r = C.openProjectText(rd.result); app.applyProject(r.project); app.save(); msg.textContent = r.checksum ? 'Loaded "' + app.plan.name + '" (checksum verified).' : 'Loaded "' + app.plan.name + '". Unverified: this file has no checksum, so only its shape was checked. It may have been edited outside Stark Builder.'; } catch (err) { msg.textContent = 'Could not load that file: ' + err.message; } };
      rd.onerror = () => { msg.textContent = 'Could not read that file.'; }; rd.readAsText(f); e.target.value = '';
    } });
    box.appendChild(h('h1', { text: 'Project' }));
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Save and load' }), h('p', { class: 'muted', text: 'A project holds the floor plan, the site, your price edits and the region. It is one small .json file you keep. Your work is also saved automatically inside this browser.' }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => { download(slug(app.plan.name) + '.starkbuilder.json', JSON.stringify(app.projectObject(), null, 1), 'application/json'); msg.textContent = 'Saved a project file to your downloads.'; } }, 'Save project file'),
        h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, 'Load project file'), file,
        h('button', { type: 'button', class: 'btn danger', onclick: async () => { if (await ask('Start a new project?', 'This clears the plan and the site. Your last saved project file is not affected. You can still undo with Ctrl+Z.', 'Start new')) { app.plan = C.blankPlan('New plan'); app.site = C.cleanSite(null); app.level = 0; app.sel = null; app.siteEd.sel = null; app.editor.fitted = false; app.siteEd.fitted = false; app.commit('New'); app.floorUI(); location.hash = '#/plan'; } } }, 'New blank project')), msg));
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Print and export' }), h('p', { class: 'muted', text: 'Printable sheets include the plan with dimensions, schedules, quantities and the planning disclaimer. Use your browser\'s print dialog to print or save a PDF.' }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => showSheet('plan') }, 'Printable floor plan'), h('button', { type: 'button', class: 'btn', onclick: () => showSheet('site') }, 'Printable site plan'), h('button', { type: 'button', class: 'btn', onclick: () => showSheet('takeoff') }, 'Printable materials list')),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'btn', onclick: () => download(slug(app.plan.name) + '-plan.svg', S.planSVG(app.plan, { units: app.units, px: 1200 }), 'image/svg+xml') }, 'Download plan as SVG'),
        h('button', { type: 'button', class: 'btn', onclick: () => download('site-plan.svg', S.siteSVG(app.site, { units: app.units, px: 1200 }), 'image/svg+xml') }, 'Download site as SVG'),
        h('button', { type: 'button', class: 'btn', onclick: () => { app.costScope = 'plan'; exportCSV(); } }, 'Download materials CSV (this plan)'),
        h('button', { type: 'button', class: 'btn', onclick: () => { app.costScope = 'site'; exportCSV(); } }, 'Download materials CSV (whole site)'))));
    if (app.pictureCard) box.appendChild(app.pictureCard());
    if (app.scaledCard) box.appendChild(app.scaledCard());
    const LV = C.levels(app.plan), cnt = k =>LV.reduce((s, l) => s + (l[k] || []).length, 0);
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'This project' }), stat('Plan', app.plan.name), stat('Floors', String(LV.length)), stat('Floor area', app.fa(C.totalFloorArea(app.plan))), stat('Walls / openings / rooms', cnt('walls') + ' / ' + cnt('openings') + ' / ' + cnt('rooms')),
      stat('Stairs / furniture and symbols', cnt('stairs') + ' / ' + cnt('items')), stat('Cost scenarios / schedule tasks', app.scenarios.length + ' / ' + (app.schedule ? app.schedule.tasks.length : 0)),
      stat('Site buildings', String(app.site.buildings.length)), stat('Units', app.units), stat('Version', 'Stark Builder ' + app.VERSION)));
  };

  /* ---------- about ---------- */
  app.views.about = function () {
    const box = clear($('#about')); const sec = (t, items) => h('div', { class: 'card' }, h('h2', { text: t }), items);
    box.appendChild(h('h1', { text: 'Stark Builder ' + app.VERSION }));
    box.appendChild(h('p', { class: 'muted', text: 'An offline 3D planner for tiny homes, family homes, compounds and small villages, by Stark. Nothing you draw leaves this computer: there are no accounts, no network calls and no tracking.' }));
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'Please read: this is a planning tool. ' }), 'Plans made here must be reviewed by a licensed architect or engineer before you build. Building codes, zoning, setbacks, utility rules and permits differ by country, state and town, and Stark Builder does not check any of them. It does not size beams, foundations, stairs, wiring, plumbing or heating, and the 3D view is a sketch of your layout, not a rendering of a finished design. Electrical and plumbing symbols are a wish list for licensed trades, energy and solar figures are rough estimates from the numbers you enter, and the permit checklist is a generic template, not legal advice.'));
    box.appendChild(sec('What it does', h('ul', null, [
      'Floor-plan editor: outer and inner walls, doors, windows and rooms on a snap grid, in metric or imperial units, with area, perimeter and wall-length totals. Door and window openings are subtracted from wall areas.',
      'Up to ' + C.MAX_LEVELS + ' floors, with straight stairs that show their risers, treads and the run they need.',
      'A furniture library of ' + SB.catalog.FURN.length + ' typical pieces, and electrical and plumbing planning symbols with a printable count.',
      '3D view: orbit around the building, cut away upper floors, or walk through any floor. The model is generated from your plan; the roof is estimated over the top floor.',
      'Library: 11 home layouts (one on two floors) and 2 support buildings to start from.',
      'Site planner: place several buildings, draw paths, drop solar, water, septic, power and parking placeholders, and assign everything to build phases.',
      'Materials and cost: a takeoff of lumber, sheathing, cladding, roofing, insulation, drywall, flooring, windows, doors and stairs with an editable price table and a region multiplier, a supplier order list, and side-by-side cost scenarios with labour and contingency.',
      'Planning: a rough energy and solar estimate, a construction schedule with a Gantt chart, a generic permit checklist and universal-design accessibility checks.',
      'Studio: a sun and shadow study for any place, date and hour with sun hours per window, a cost risk range with budget confidence, GLB and OBJ export of the 3D model, and a Ctrl+K command palette that also answers plain questions about your plan.',
      'Exports: printable plan, site, materials, order list, schedule and permit sheets, a one-page overview sheet, PNG pictures of the 3D view and the floor plan at a size you choose (with a solid or transparent background), materials, order and schedule CSV files, SVG drawings, and project save and load as a .json file.'].map(t => h('li', { text: t })))));
    box.appendChild(sec('How the estimate is figured', h('div', null,
      h('p', { text: 'Studs and joists at 406 mm (16 in) centres, rafters at 610 mm, three extra studs and two header members per opening, a triple plate per wall, sheet goods at 1220 x 2440 mm with 10% waste, flooring 8% waste. Walls and openings come from your drawing. Anything not listed (foundation, plumbing, electrical, heating and cooling, fixtures, finishes beyond flooring, labour, permits, delivery, tax) is not in the total.' }),
      h('p', { text: 'All default prices are round example numbers so the tool works on first open. They are not market data. Replace them with quotes from your own suppliers and pick a region multiplier that fits, or use a custom one.' }))));
    box.appendChild(sec('Keys and mouse', h('ul', null, [['Delete', ' removes the selected wall, opening, room, stair, furniture, symbol or site item'], ['R', ' rotates the selected stair, furniture or symbol'], ['Esc', ' cancels what you are drawing'], ['Ctrl+Z / Ctrl+Y', ' undo and redo'], ['Space + drag', ' pans the plan; the wheel zooms'], ['Shift', ' while drawing a wall allows any angle'], ['W A S D / arrows', ' walk in the 3D walkthrough'], ['Ctrl+K', ' opens the command palette: search anything or ask a question about your plan']].map(k => h('li', null, h('kbd', { text: k[0] }), k[1])))));
    box.appendChild(sec('Your data', h('div', null, h('p', { text: 'The current project autosaves in this browser\'s local storage, with a safety copy of the last good save. Clearing site data removes it, so save a project file for anything you care about.' }), h('p', { text: 'Local protections: no tracking and no network. Project files carry a checksum and are checked before loading, and damaged saves open in a read-only safe mode so nothing is lost.' }))));
    box.appendChild(h('p', { class: 'muted small' }, 'Stark Builder is a Stark product. Design library layouts, furniture sizes and prices are original to this tool.'));
    const tpl = document.getElementById('stark-notice-tpl'); if (tpl && tpl.content) box.appendChild(tpl.content.cloneNode(true));
  };
  /* app.start() runs at the end of views2.js, once the planning views are registered. */
})();
