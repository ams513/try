/* Stark Builder, by Stark. Planning views: the order list and cost scenarios (Materials and cost tab), and the Planning
   tab (energy and solar, construction schedule, permit checklist, accessibility checks) with their printable sheets.
   All text goes in with textContent; the only HTML strings are the escaped sheets and the escaped Gantt SVG. */
(function () {
  'use strict';
  const SB = window.SB, C = SB.core, K = SB.takeoff, PL = SB.planning, CAT = SB.catalog, app = SB.app;
  const { h, $, clear, clone } = app;
  const esc = PL.esc, stat = app.stat;
  const pct = v => Math.round(v) + '%';
  const kwh = v => Math.round(v).toLocaleString('en-US') + ' kWh';
  const money2 = v => app.currency + (Math.round(v * 100) / 100).toFixed(2);

  function numIn(label, val, attrs, onSet, hint) {
    const inp = h('input', Object.assign({ type: 'number', value: val, 'aria-label': label, onchange: e => { const v = parseFloat(e.target.value); if (!isFinite(v)) { e.target.value = val; return; } onSet(v); } }, attrs || {}));
    return h('label', { class: 'f' }, label, inp, hint ? h('span', { class: 'hint', text: hint }) : null);
  }
  function subnav(items, cur, fn, label) {
    return h('div', { class: 'seg subnav', role: 'group', 'aria-label': label }, items.map(v => h('button', { type: 'button', 'aria-pressed': cur === v[0] ? 'true' : 'false', onclick: () => fn(v[0]) }, v[1])));
  }
  function scopeSelect(rerender) {
    return h('label', { class: 'f' }, 'Price', h('select', { 'aria-label': 'What to price', onchange: e => { app.costScope = e.target.value; rerender(); } },
      h('option', { value: 'plan', selected: app.costScope !== 'site', text: 'This building: ' + app.plan.name }), h('option', { value: 'site', selected: app.costScope === 'site', text: 'Whole site (all buildings, paths, utilities)' })));
  }
  const keepScroll = (el, fn) => { const y = el.scrollTop; fn(); el.scrollTop = y; };
  app.costViews = {};

  /* ---------- order list ---------- */
  const ORDER_LABELS = [['stud_2x6', 'Exterior wall lumber piece length', 'len'], ['stud_2x4', 'Interior wall lumber piece length', 'len'], ['joist_2x8', 'Joist and header piece length', 'len'],
    ['rafter_2x6', 'Rafter piece length', 'len'], ['roofing', 'Roofing coverage per bundle or pack (m2)', 'm2'], ['insulation', 'Insulation coverage per pack (m2)', 'm2'],
    ['flooring', 'Flooring coverage per box (m2)', 'm2'], ['cladding', 'Cladding coverage per unit (m2)', 'm2']];
  function orderRows() { const d = app.costData(); return { d, rows: K.orderList(d.lines, app.orderSizes, d.plans) }; }
  app.costViews.order = function (box) {
    const o = orderRows(), sizes = Object.assign({}, K.ORDER_DEFAULTS, app.orderSizes);
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'A planning list. ' }), 'Quantities come from the takeoff rules and the example piece and pack sizes below. Confirm every size and quantity with your supplier and your builder before you order.'));
    box.appendChild(h('div', { class: 'costhead' }, scopeSelect(() => app.views.costs()),
      h('div', { class: 'f' }, h('span', { class: 'muted small', text: 'Exports' }), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => app.download(app.slug(o.d.name) + '-order-list.csv', K.orderCSV(o.rows, { name: o.d.name }), 'text/csv') }, 'Download order CSV'),
        h('button', { type: 'button', class: 'btn', onclick: () => app.showSheet('order') }, 'Print order list')))));
    const tb = h('tbody'); let grp = '';
    o.rows.forEach(r => {
      if (r.group !== grp) { grp = r.group; tb.appendChild(h('tr', { class: 'grp' }, h('td', { colspan: 4, text: grp }))); }
      tb.appendChild(h('tr', null, h('td', { class: 'item', text: r.item }), h('td', { class: 'num' }, h('b', { text: String(r.qty) })), h('td', { text: r.unit }), h('td', { class: 'small muted', text: r.basis })));
    });
    box.appendChild(h('div', { class: 'card scroll-x' }, h('h2', { text: 'Order list: ' + o.d.name }), o.rows.length ? h('table', { class: 'costtable' }, h('thead', null, h('tr', null, h('th', { text: 'Item' }), h('th', { class: 'num', text: 'Order' }), h('th', { text: 'Unit' }), h('th', { text: 'How it was figured' }))), tb) : h('p', { class: 'hint', text: 'Nothing to order yet: draw walls first.' }),
      h('p', { class: 'hint', text: 'Allowances (small items, service rough-ins, site placeholders) are not orderable and stay in the cost view only.' })));
    const grid = h('div', { class: 'grid2 wide' });
    ORDER_LABELS.forEach(r => grid.appendChild(r[2] === 'len' ? app.lenField(r[1], sizes[r[0]], v => { app.orderSizes[r[0]] = C.cleanNums({ [r[0]]: v }, 'order')[r[0]]; app.save(); app.views.costs(); })
      : numIn(r[1], sizes[r[0]], { min: 0.1, max: 50, step: 0.1 }, v => { app.orderSizes[r[0]] = C.cleanNums({ [r[0]]: v }, 'order')[r[0]]; app.save(); app.views.costs(); })));
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Piece lengths and pack sizes: match your supplier' }), grid,
      h('button', { type: 'button', class: 'btn', onclick: () => { app.orderSizes = {}; app.save(); app.views.costs(); } }, 'Reset to the example sizes')));
  };
  app.sheets.order = function () {
    const o = orderRows();
    return app.sheetHead('Order list: ' + o.d.name, 'Supplier quantities from the takeoff, example piece and pack sizes') +
      app.sheetTable([['Group'], ['Item'], ['Order', 1], ['Unit'], ['How it was figured']], o.rows.map(r => [r.group, r.item, String(r.qty), r.unit, r.basis])) +
      '<div class="disclaimer"><strong>' + esc(app.DISCLAIMER) + ' Confirm every size and quantity with your supplier before ordering.</strong></div>';
  };

  /* ---------- cost scenarios ---------- */
  function scenarioRows() {
    const site = app.costScope === 'site' && app.site.buildings.length, area = site ? app.site.buildings.reduce((a, b) => a + C.totalFloorArea(b.plan), 0) : C.totalFloorArea(app.plan);
    const fn = (prices, mult) => (site ? K.siteTakeoff(app.site, prices, mult).total : K.takeoff(app.plan, prices, mult).total);
    return app.scenarios.map(s => ({ s, t: PL.scenarioTotals(s, fn, SB.prices.regions, area) }));
  }
  app.costViews.scenarios = function (box) {
    const rows = scenarioRows(), max = rows.reduce((m, r) => Math.max(m, r.t.total), 0), rr = () => app.views.costs();
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'Compare budgets side by side. ' }), 'Each scenario keeps its own region multiplier and price edits. Labour and contingency are percentages you enter from your own quotes: the materials takeoff has no labour in it. Example scenarios use illustration prices, not market data.'));
    const nameIn = h('input', { type: 'text', maxLength: 40, placeholder: 'Scenario name', 'aria-label': 'New scenario name' });
    box.appendChild(h('div', { class: 'costhead' }, scopeSelect(rr),
      h('div', { class: 'f' }, h('span', { class: 'muted small', text: 'Save the prices now in the takeoff as a scenario' }), h('div', { class: 'row nowrap' }, nameIn,
        h('button', { type: 'button', class: 'btn primary', disabled: app.scenarios.length >= 12, onclick: () => {
          app.scenarios.push({ id: 's' + Date.now().toString(36), name: (nameIn.value.trim() || 'Scenario ' + (app.scenarios.length + 1)).slice(0, 40), region: app.region, customMult: app.customMult, prices: clone(app.prices), labourPct: 0, contPct: 10 });
          app.save(); rr(); } }, 'Save'))),
      h('div', { class: 'f' }, h('span', { class: 'muted small', text: 'Start from examples' }), h('button', { type: 'button', class: 'btn', onclick: () => {
        const have = new Set(app.scenarios.map(s => s.id)); PL.exampleScenarios().forEach(s => { if (!have.has(s.id) && app.scenarios.length < 12) app.scenarios.push(s); }); app.save(); rr(); } }, 'Add budget, standard and premium examples'))));
    if (!rows.length) { box.appendChild(h('div', { class: 'card' }, h('p', { class: 'hint', text: 'No scenarios yet. Save the prices you have now, or add the three examples, then change each one.' }))); return; }
    const bars = h('div', { class: 'bars', role: 'img', 'aria-label': 'Scenario totals' });
    rows.forEach(r => bars.appendChild(h('div', { class: 'barrow' }, h('span', { class: 'barlabel', text: r.s.name }), h('span', { class: 'bartrack' }, h('span', { class: 'sbar', style: 'width:' + (max > 0 ? Math.max(2, r.t.total / max * 100) : 0).toFixed(1) + '%' })), h('b', { text: app.money(r.t.total) }))));
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Totals' }), bars));
    const tb = h('tbody');
    rows.forEach(r => {
      const s = r.s, upd = (k, v) => { s[k] = v; app.scenarios = C.cleanScenarios(app.scenarios); app.save(); rr(); };
      tb.appendChild(h('tr', null,
        h('td', null, h('input', { type: 'text', value: s.name, maxLength: 40, 'aria-label': 'Scenario name', onchange: e => upd('name', e.target.value.trim() || s.name) })),
        h('td', null, h('select', { 'aria-label': 'Region multiplier', onchange: e => upd('region', e.target.value) }, SB.prices.regions.map(g => h('option', { value: g.id, selected: s.region === g.id, text: g.label })))),
        h('td', { class: 'num' }, h('input', { type: 'number', min: 0, max: 300, step: 5, value: s.labourPct, 'aria-label': 'Labour percent', class: 'short', onchange: e => upd('labourPct', parseFloat(e.target.value) || 0) })),
        h('td', { class: 'num' }, h('input', { type: 'number', min: 0, max: 100, step: 1, value: s.contPct, 'aria-label': 'Contingency percent', class: 'short', onchange: e => upd('contPct', parseFloat(e.target.value) || 0) })),
        h('td', { class: 'num', text: app.money(r.t.materials) }), h('td', { class: 'num', text: app.money(r.t.labour) }), h('td', { class: 'num', text: app.money(r.t.contingency) }),
        h('td', { class: 'num' }, h('b', { text: app.money(r.t.total) })), h('td', { class: 'num', text: r.t.perM2 > 0 ? app.currency + Math.round(r.t.perM2) + '/m2' : '-' }),
        h('td', null, h('div', { class: 'row nowrap' }, h('button', { type: 'button', class: 'btn', title: 'Load this scenario\'s region and prices into the takeoff', onclick: () => { app.region = s.region; app.customMult = s.customMult; app.prices = clone(s.prices); app.save(); app.costView = 'takeoff'; rr(); } }, 'Use prices'),
          h('button', { type: 'button', class: 'btn danger', onclick: () => { app.scenarios = app.scenarios.filter(x => x !== s); app.save(); rr(); } }, 'Delete')))));
    });
    box.appendChild(h('div', { class: 'card scroll-x' }, h('h2', { text: 'Scenarios' }), h('table', { class: 'costtable scen' }, h('thead', null, h('tr', null, ['Name', 'Region', 'Labour %', 'Contingency %', 'Materials', 'Labour', 'Contingency', 'Total', 'Per floor area', ''].map((t, i) => h('th', { class: i >= 2 && i <= 8 ? 'num' : null, text: t })))), tb),
      h('p', { class: 'hint', text: 'Price edits per scenario: change prices in Takeoff and prices, then save them as a new scenario. Contingency is figured on materials plus labour.' })));
  };

  /* ---------- planning tab ---------- */
  app.planView = 'energy';
  app.views.planning = function () {
    const box = $('#planning'), y = box.scrollTop; clear(box);
    box.appendChild(h('h1', { text: 'Planning' }));
    box.appendChild(subnav([['energy', 'Energy and solar'], ['schedule', 'Schedule'], ['permits', 'Permit checklist'], ['access', 'Accessibility']], app.planView, v => { app.planView = v; box.scrollTop = 0; app.views.planning(); }, 'Planning views'));
    ({ energy: energyView, schedule: scheduleView, permits: permitsView, access: accessView })[app.planView](box);
    box.scrollTop = y;
  };

  /* energy and solar */
  const EN = () => Object.assign({}, PL.ENERGY_DEFAULTS, app.energy);
  function setEnergy(k, v) { const c = C.cleanNums({ [k]: v }, 'energy'); if (k in c) app.energy[k] = c[k]; app.save(); app.views.planning(); }
  function energyView(box) {
    const e = EN(), r = PL.energy(app.plan, e), s = PL.solar(app.plan, e), offset = r.elecUse > 0 ? s.yearKWh / r.elecUse * 100 : 0;
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'A rough estimate, not an energy-code calculation. ' }), 'It multiplies a heat-loss figure from your drawing by the degree days you enter. It leaves out sun through windows, heat from people and appliances, thermal bridges and real weather. Use it to compare options; an energy assessor or engineer does the real calculation.'));
    const climate = h('select', { 'aria-label': 'Example climate', onchange: ev => { const c = PL.CLIMATES.find(x => x[0] === ev.target.value); if (c) { app.energy.hdd = c[2]; app.energy.cdd = c[3]; app.save(); app.views.planning(); } } },
      h('option', { value: '', text: 'Pick an example climate...' }), PL.CLIMATES.map(c => h('option', { value: c[0], text: c[1] + ' (' + c[2] + ' / ' + c[3] + ')' })));
    const cols = h('div', { class: 'cols' });
    cols.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Climate' }), h('label', { class: 'f' }, 'Example climates (heating / cooling degree days)', climate),
      h('div', { class: 'grid2' }, numIn('Heating degree days (C-days)', e.hdd, { min: 0, max: 12000, step: 50 }, v => setEnergy('hdd', v)), numIn('Cooling degree days (C-days)', e.cdd, { min: 0, max: 6000, step: 50 }, v => setEnergy('cdd', v)),
        numIn('Design temperature difference (C)', e.designDT, { min: 5, max: 70, step: 1 }, v => setEnergy('designDT', v))),
      h('p', { class: 'hint', text: 'Look up the degree days (base 18 C) for your town from a weather service. Fahrenheit degree days divide by 1.8.' })));
    cols.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Walls, roof, floor, windows' }),
      h('div', { class: 'grid2' }, numIn('Wall U-value (W/m2K)', e.uWall, { min: 0.05, max: 5, step: 0.01 }, v => setEnergy('uWall', v)), numIn('Roof or ceiling U-value', e.uRoof, { min: 0.05, max: 5, step: 0.01 }, v => setEnergy('uRoof', v)),
        numIn('Ground floor U-value', e.uFloor, { min: 0.05, max: 5, step: 0.01 }, v => setEnergy('uFloor', v)), numIn('Window U-value', e.uWin, { min: 0.3, max: 7, step: 0.1 }, v => setEnergy('uWin', v)),
        numIn('Door U-value', e.uDoor, { min: 0.3, max: 7, step: 0.1 }, v => setEnergy('uDoor', v)), numIn('Air changes per hour', e.ach, { min: 0, max: 10, step: 0.1 }, v => setEnergy('ach', v))),
      h('p', { class: 'hint', text: 'U = 1 / R in metric units. Imperial R-values: U is about 5.68 / R (R-19 is about 0.30, R-38 about 0.15). Defaults are examples, not your code minimums.' })));
    cols.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Heating, cooling and prices' }),
      h('div', { class: 'grid2' }, numIn('Heating efficiency or COP', e.heatEff, { min: 0.3, max: 6, step: 0.1 }, v => setEnergy('heatEff', v), 'Heat pump about 3; gas boiler about 0.9.'),
        numIn('Cooling COP', e.coolCop, { min: 1, max: 8, step: 0.1 }, v => setEnergy('coolCop', v)),
        numIn('Heating energy price per kWh', e.heatPrice, { min: 0, max: 10, step: 0.01 }, v => setEnergy('heatPrice', v)), numIn('Electricity price per kWh', e.elecPrice, { min: 0, max: 10, step: 0.01 }, v => setEnergy('elecPrice', v)),
        numIn('Other household electricity (kWh a year)', e.baseLoad, { min: 0, max: 50000, step: 100 }, v => setEnergy('baseLoad', v))),
      h('label', null, h('input', { type: 'checkbox', checked: !!e.heatIsElec, onchange: ev => setEnergy('heatIsElec', ev.target.checked ? 1 : 0) }), ' Heating runs on electricity (counts toward solar offset)')));
    box.appendChild(cols);
    const tb = h('tbody'); r.parts.forEach(p => tb.appendChild(h('tr', null, h('td', { text: p.name }), h('td', { class: 'num', text: app.fa(p.area) }), h('td', { class: 'num', text: p.u.toFixed(2) }), h('td', { class: 'num', text: Math.round(p.ua) + ' W/K' }))));
    tb.appendChild(h('tr', null, h('td', { text: 'Air leakage (' + e.ach + ' per hour of ' + Math.round(r.env.vol) + ' m3)' }), h('td'), h('td'), h('td', { class: 'num', text: Math.round(r.air) + ' W/K' })));
    tb.appendChild(h('tr', null, h('td', null, h('b', { text: 'Heat loss coefficient' })), h('td'), h('td'), h('td', { class: 'num' }, h('b', { text: Math.round(r.H) + ' W/K' }))));
    const res = h('div', { class: 'card' }, h('h2', { text: 'Estimate for ' + app.plan.name }), h('div', { class: 'scroll-x' }, h('table', null, h('thead', null, h('tr', null, h('th', { text: 'Part' }), h('th', { class: 'num', text: 'Area' }), h('th', { class: 'num', text: 'U' }), h('th', { class: 'num', text: 'Loss' }))), tb)));
    [['Heating need a year', kwh(r.heatNeed) + ' (' + Math.round(r.heatPerM2) + ' kWh/m2)'], ['Heating energy bought', kwh(r.heatUse) + ', about ' + app.money(r.heatCost)], ['Cooling energy bought', kwh(r.coolUse) + ', about ' + app.money(r.coolCost)],
      ['Peak heat loss at the design difference', r.peakKW.toFixed(1) + ' kW'], ['Electricity use including the above', kwh(r.elecUse)]].forEach(x => res.appendChild(stat(x[0], x[1])));
    const sol = h('div', { class: 'card' }, h('h2', { text: 'Solar on the roof' }),
      h('div', { class: 'grid2' }, numIn('Peak sun hours a day', e.sunHours, { min: 0, max: 9, step: 0.1 }, v => setEnergy('sunHours', v), 'Yearly average for your site and tilt.'), numIn('Panel watts', e.panelW, { min: 50, max: 900, step: 5 }, v => setEnergy('panelW', v)),
        numIn('Panel area (m2)', e.panelArea, { min: 0.3, max: 4, step: 0.05 }, v => setEnergy('panelArea', v)), numIn('Share of roof usable (0 to 1)', e.roofUse, { min: 0, max: 1, step: 0.05 }, v => setEnergy('roofUse', v), 'About 0.5 for one side of a gable.'),
        numIn('Panels (0 = fill the usable roof)', e.panels, { min: 0, max: 400, step: 1 }, v => setEnergy('panels', v)), numIn('System losses (%)', e.lossPct, { min: 0, max: 60, step: 1 }, v => setEnergy('lossPct', v))));
    [['Roof area / usable', app.fa(s.roofArea) + ' / ' + app.fa(s.usable)], ['Panels that fit / planned', s.fit + ' / ' + s.panels], ['System size', s.kWp.toFixed(1) + ' kWp'], ['Yearly output, rough', kwh(s.yearKWh)],
      ['Share of the electricity use above', pct(offset)]].forEach(x => sol.appendChild(stat(x[0], x[1])));
    if (s.overRoof) sol.appendChild(h('div', { class: 'warn', text: 'More panels are planned than fit on the usable roof area. Use a ground mount (the Site tab has a solar placeholder) or fewer panels.' }));
    sol.appendChild(h('p', { class: 'hint', text: 'Shading, orientation, tilt, local rules and grid connection terms change the real output. A solar installer sizes the system.' }));
    box.appendChild(h('div', { class: 'cols' }, res, sol));
    box.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => app.showSheet('energy') }, 'Print energy and solar summary'), h('button', { type: 'button', class: 'btn', onclick: () => { app.energy = {}; app.save(); app.views.planning(); } }, 'Reset to the example inputs')));
  }
  app.sheets.energy = function () {
    const e = EN(), r = PL.energy(app.plan, e), s = PL.solar(app.plan, e);
    return app.sheetHead('Energy and solar estimate: ' + app.plan.name, 'Heating ' + e.hdd + ' / cooling ' + e.cdd + ' degree days (C), your inputs') +
      '<h2>Heat loss</h2>' + app.sheetTable([['Part'], ['Area', 1], ['U (W/m2K)', 1], ['Loss (W/K)', 1]], r.parts.map(p => [p.name, app.fa(p.area), p.u.toFixed(2), String(Math.round(p.ua))]).concat([['Air leakage', '', '', String(Math.round(r.air))], ['Heat loss coefficient', '', '', String(Math.round(r.H))]])) +
      '<h2>Yearly estimate</h2>' + app.sheetTable([['Measure'], ['Value', 1]], [['Heating need', kwh(r.heatNeed)], ['Heating energy bought', kwh(r.heatUse)], ['Cooling energy bought', kwh(r.coolUse)], ['Peak heat loss', r.peakKW.toFixed(1) + ' kW'],
        ['Solar system', s.panels + ' panels, ' + s.kWp.toFixed(1) + ' kWp'], ['Solar output', kwh(s.yearKWh)]]) +
      '<div class="disclaimer"><strong>ROUGH PLANNING ESTIMATE from the numbers entered. Not an energy-code or compliance calculation, not a heating or solar system design. It leaves out solar and internal gains, thermal bridges and real weather. Have an energy assessor, engineer or installer do the real calculation.</strong></div>';
  };

  /* construction schedule */
  function sched() { if (!app.schedule) app.schedule = PL.defaultSchedule(app.plan, ''); return app.schedule; }
  function setSched(fn) { fn(app.schedule); app.schedule = C.cleanSchedule(app.schedule); app.save(); app.views.planning(); }
  function scheduleView(box) {
    const s = sched(), res = PL.computeSchedule(s);
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'A planning schedule. ' }), 'Durations are rough examples for a small, experienced crew, sized from your plan. Weather, permits, inspections, deliveries and trade availability change them. Edit every number to match your builder\'s plan.'));
    const fresh = h('button', { type: 'button', class: 'btn', onclick: async () => { if (await app.ask('Rebuild the schedule from this plan?', 'Your task edits are replaced by the starting schedule sized from the current plan.', 'Rebuild')) { app.schedule = PL.defaultSchedule(app.plan, s.start); app.save(); app.views.planning(); } } }, 'Rebuild from this plan');
    box.appendChild(h('div', { class: 'costhead' },
      h('label', { class: 'f' }, 'Start date', h('input', { type: 'date', value: s.start, 'aria-label': 'Start date', onchange: e => setSched(x => { x.start = e.target.value; }) })),
      h('label', { class: 'f' }, 'Working week', h('select', { 'aria-label': 'Working week', onchange: e => setSched(x => { x.workWeek = parseInt(e.target.value, 10); }) }, [[5, 'Monday to Friday'], [6, 'Monday to Saturday'], [7, 'Every day']].map(o => h('option', { value: o[0], selected: s.workWeek === o[0], text: o[1] })))),
      h('div', { class: 'f' }, h('span', { class: 'muted small', text: 'Tasks and exports' }), h('div', { class: 'row' }, fresh,
        h('button', { type: 'button', class: 'btn', disabled: s.tasks.length >= 80, onclick: () => setSched(x => { const last = x.tasks[x.tasks.length - 1]; x.tasks.push({ id: 't' + Date.now().toString(36), name: 'New task', days: 2, after: last ? [last.id] : [], done: false }); }) }, 'Add task'),
        h('button', { type: 'button', class: 'btn primary', disabled: !!res.error, onclick: () => app.download(app.slug(app.plan.name) + '-schedule.csv', PL.scheduleCSV(res, app.plan.name), 'text/csv') }, 'Download CSV'),
        h('button', { type: 'button', class: 'btn', disabled: !!res.error, onclick: () => app.showSheet('schedule') }, 'Print')))));
    if (res.error) box.appendChild(h('div', { class: 'warn', role: 'alert', text: res.error + ' Change the "after" numbers to break the loop.' }));
    else {
      const crit = res.rows.filter(r => r.critical).length;
      box.appendChild(h('div', { class: 'card' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', null, h('div', { class: 'muted small', text: 'Total' }), h('span', { class: 'big', text: res.total + ' working days' }),
        h('div', { class: 'muted small', text: s.start ? 'From ' + s.start + ' to ' + res.end + ', about ' + Math.ceil(res.total / s.workWeek) + ' weeks' : 'Pick a start date to see calendar dates.' })),
      h('div', { class: 'small muted', text: crit + ' tasks on the critical path (dark bars): a delay in any of them moves the finish date. Light bars have slack; green bars are done.' }))));
      const g = h('div', { class: 'gantt scroll-x' }); g.innerHTML = PL.ganttSVG(res, { px: 980 }); box.appendChild(g);
    }
    const tb = h('tbody');
    s.tasks.forEach((t, i) => {
      const r = res.rows[i] || {};
      tb.appendChild(h('tr', { class: r.critical ? 'crit' : null },
        h('td', { class: 'num', text: String(i + 1) }),
        h('td', null, h('input', { type: 'text', value: t.name, maxLength: 80, 'aria-label': 'Task ' + (i + 1) + ' name', onchange: e => setSched(x => { x.tasks[i].name = e.target.value.trim() || t.name; }) })),
        h('td', { class: 'num' }, h('input', { type: 'number', min: 0, max: 365, step: 1, value: t.days, class: 'short', 'aria-label': 'Task ' + (i + 1) + ' working days', onchange: e => setSched(x => { x.tasks[i].days = Math.max(0, Math.round(parseFloat(e.target.value) || 0)); }) })),
        h('td', null, h('input', { type: 'text', value: t.after.map(a => s.tasks.findIndex(q => q.id === a) + 1).filter(n => n > 0).join(', '), class: 'short2', 'aria-label': 'Task ' + (i + 1) + ' starts after tasks', title: 'Task numbers this one waits for, separated by commas',
          onchange: e => setSched(x => { x.tasks[i].after = e.target.value.split(/[^0-9]+/).filter(Boolean).map(n => x.tasks[parseInt(n, 10) - 1]).filter(q => q && q.id !== t.id).map(q => q.id); }) })),
        h('td', { class: 'small', text: r.start ? r.start + ' to ' + r.end : r.es != null ? 'day ' + r.es + ' to ' + Math.max(r.es, r.ef - 1) : '' }),
        h('td', { class: 'num', text: r.slack != null ? String(r.slack) : '' }),
        h('td', null, h('input', { type: 'checkbox', checked: t.done, 'aria-label': 'Task ' + (i + 1) + ' done', onchange: e => setSched(x => { x.tasks[i].done = e.target.checked; }) })),
        h('td', null, h('button', { type: 'button', class: 'btn danger', 'aria-label': 'Remove task ' + (i + 1), onclick: () => setSched(x => { x.tasks.splice(i, 1); }) }, 'Remove'))));
    });
    box.appendChild(h('div', { class: 'card scroll-x' }, h('h2', { text: 'Tasks' }), h('table', { class: 'costtable sched' }, h('thead', null, h('tr', null, ['#', 'Task', 'Days', 'After', 'Dates', 'Slack', 'Done', ''].map((x, i) => h('th', { class: i === 0 || i === 2 || i === 5 ? 'num' : null, text: x })))), tb),
      h('p', { class: 'hint', text: '"After" lists the task numbers a task waits for. Days are working days. Inspections and permit reviews depend on your authority.' })));
  }
  app.sheets.schedule = function () {
    const s = sched(), res = PL.computeSchedule(s);
    if (res.error) return app.sheetHead('Construction schedule', '') + '<p>' + esc(res.error) + '</p>';
    return app.sheetHead('Construction schedule: ' + app.plan.name, res.total + ' working days' + (s.start ? ', ' + s.start + ' to ' + res.end : '')) + '<div>' + PL.ganttSVG(res, { px: 900 }) + '</div>' +
      '<h2>Tasks</h2>' + app.sheetTable([['#', 1], ['Task'], ['Days', 1], ['After'], ['Start'], ['Finish'], ['Slack', 1]], res.rows.map(r => [String(r.n), r.name + (r.critical ? ' (critical)' : '') + (r.done ? ' (done)' : ''), String(r.days), r.after.join(', '), r.start || 'day ' + r.es, r.end || 'day ' + Math.max(r.es, r.ef - 1), String(r.slack)])) +
      '<div class="disclaimer"><strong>PLANNING SCHEDULE ONLY. Durations are rough examples; weather, permits, inspections, deliveries and trades change them. Agree the real programme with your builder.</strong></div>';
  };

  /* permit checklist */
  function setPermits(fn) { fn(app.permits); app.permits = C.cleanPermits(app.permits); app.save(); }
  function permitsView(box) {
    const pl = PL.permitList(app.permits);
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'A generic checklist, not legal advice. ' }), 'Rules, names and steps vary by country, state, county and council. Your local building and planning authority decides what applies. Use this list to ask the right questions and keep track.'));
    const prog = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pl.pct, 'aria-label': 'Checklist progress' }, h('span', { style: 'width:' + pl.pct + '%' }));
    box.appendChild(h('div', { class: 'card' }, h('div', { class: 'costhead' },
      h('label', { class: 'f' }, 'Your authority or notes', h('input', { type: 'text', maxLength: 120, value: app.permits.authority, placeholder: 'e.g. county building department, phone, case number', 'aria-label': 'Authority', onchange: e => setPermits(p => { p.authority = e.target.value.trim(); }) })),
      h('div', { class: 'f' }, h('span', { class: 'muted small', text: pl.done + ' of ' + pl.total + ' done' }), prog),
      h('div', { class: 'f' }, h('span', { class: 'muted small', text: 'Export' }), h('button', { type: 'button', class: 'btn', onclick: () => app.showSheet('permits') }, 'Print checklist')))));
    CAT.PERMIT_PHASES.forEach((ph, k) => {
      const ul = h('ul', { class: 'checks' });
      pl.items.filter(i => i.phase === k).forEach(i => {
        const done = !!app.permits.done[i.id];
        ul.appendChild(h('li', { class: done ? 'done' : null },
          h('label', null, h('input', { type: 'checkbox', checked: done, onchange: e => { setPermits(p => { if (e.target.checked) p.done[i.id] = true; else delete p.done[i.id]; }); app.views.planning(); } }), h('span', { text: i.text })),
          h('input', { type: 'text', class: 'note', maxLength: 500, value: app.permits.notes[i.id] || '', placeholder: 'Notes: who you spoke to, dates, fees', 'aria-label': 'Notes for: ' + i.text.slice(0, 60), onchange: e => setPermits(p => { if (e.target.value.trim()) p.notes[i.id] = e.target.value; else delete p.notes[i.id]; }) }),
          i.custom ? h('button', { type: 'button', class: 'btn danger', onclick: () => { setPermits(p => { p.custom = p.custom.filter(c => c.id !== i.id); delete p.done[i.id]; delete p.notes[i.id]; }); app.views.planning(); } }, 'Remove') : null));
      });
      box.appendChild(h('div', { class: 'card' }, h('h2', { text: (k + 1) + '. ' + ph }), ul));
    });
    const txt = h('input', { type: 'text', maxLength: 160, placeholder: 'Your own item', 'aria-label': 'New checklist item' });
    const phs = h('select', { 'aria-label': 'Stage for the new item' }, CAT.PERMIT_PHASES.map((p, i) => h('option', { value: i, text: p })));
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Add your own item' }), h('div', { class: 'row' }, txt, phs, h('button', { type: 'button', class: 'btn primary', onclick: () => {
      if (!txt.value.trim()) return; setPermits(p => { p.custom.push({ id: 'c' + Date.now().toString(36), text: txt.value.trim(), phase: parseInt(phs.value, 10) }); }); app.views.planning(); } }, 'Add'))));
  }
  app.sheets.permits = function () {
    const pl = PL.permitList(app.permits);
    let body = '';
    CAT.PERMIT_PHASES.forEach((ph, k) => {
      body += '<h2>' + esc((k + 1) + '. ' + ph) + '</h2><ul class="checklist">' + pl.items.filter(i => i.phase === k).map(i => '<li>' + (app.permits.done[i.id] ? '[x] ' : '[ ] ') + esc(i.text) + (app.permits.notes[i.id] ? '<div class="muted">' + esc(app.permits.notes[i.id]) + '</div>' : '') + '</li>').join('') + '</ul>';
    });
    return app.sheetHead('Permit checklist: ' + app.plan.name, (app.permits.authority ? app.permits.authority + ', ' : '') + pl.done + ' of ' + pl.total + ' done') + body +
      '<div class="disclaimer"><strong>GENERIC CHECKLIST, NOT LEGAL ADVICE. Rules, names and steps vary by country, state, county and council. Your local building and planning authority decides what applies to your project.</strong></div>';
  };

  /* accessibility */
  function accessView(box) {
    const list = PL.accessChecks(app.plan, app.units), ok = list.filter(c => c.ok).length, stairs = PL.stairChecks(app.plan, app.units);
    box.appendChild(h('div', { class: 'warn' }, h('b', { text: 'Universal-design rules of thumb, not a code check. ' }), 'These checks read the plan you drew: door widths, where the bathroom and a bedroom are, room sizes and stairs. Accessibility codes differ by place and by building type; an access consultant or your designer checks the real requirements, including step-free approaches, thresholds, corridors and fixtures.'));
    const ul = h('ul', { class: 'access' });
    list.forEach(c => ul.appendChild(h('li', { class: c.ok ? 'ok' : 'no' }, h('span', { class: 'badge', text: c.ok ? 'OK' : 'Check' }), h('div', null, h('b', { text: c.title }), h('div', { class: 'small muted', text: c.detail })))));
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: ok + ' of ' + list.length + ' checks pass for ' + app.plan.name }), ul));
    if (stairs.length) box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Stair notes' }), h('ul', null, stairs.map(t => h('li', { text: t })))));
    box.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Ideas that make a home easier for everyone' }), h('ul', null, ['A level, step-free path from parking to the entrance, with a covered landing.', 'Lever handles, rocker light switches and outlets placed 0.4 to 1.2 m above the floor.',
      'Blocking in bathroom walls now, so grab bars can be added later without opening the wall.', 'A curbless shower and a clear floor space of about 1.5 m in the bathroom.', 'Corridors about 1.1 m wide and no thresholds between rooms.'].map(t => h('li', { text: t })))));
  }

  app.start();
})();
