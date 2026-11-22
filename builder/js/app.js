/* Stark Builder, by Stark. App shell: state, undo history, tabs, units, floors, the floor-plan panels and the 3D view.
   Site, library, costs, project and print views live in views.js; planning views in views2.js. Everything stays in this
   browser (localStorage). No network. */
(function () {
  'use strict';
  const SB = window.SB, C = SB.core, K = SB.takeoff, T = SB.templates, CAT = SB.catalog, PL = SB.planning;
  const VERSION = '1.5.0', STORE = 'starkBuilder.v1';
  const $ = (s, r) => (r || document).querySelector(s);
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k]; if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v; else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (typeof v !== 'string' && k in el) el[k] = v; else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) { if (c === null || c === undefined || c === false) return el; if (Array.isArray(c)) { c.forEach(x => add(el, x)); return el; } el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); return el; }
  const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  const clone = o => JSON.parse(JSON.stringify(o));

  const app = SB.app = { VERSION, h, $, clear, clone, units: 'metric', region: 'baseline', customMult: 1, currency: '$', prices: {}, sel: null, tab: 'plan', version: 0, views: {}, hist: [], hi: -1,
    level: 0, placeKind: { furn: 'sofa-3', elec: 'outlet', plumb: 'supply' }, scenarios: [], schedule: null, permits: C.cleanPermits(null), energy: {}, orderSizes: {} };
  app.plan = clone(T.byId('one-bed-cabin').plan);
  app.site = C.cleanSite(null);
  /* The floor being edited: floor 1 is the plan itself, upper floors are plan.levels. */
  app.lv = function () { const L = C.levels(app.plan); if (app.level > L.length - 1 || app.level < 0) app.level = 0; return L[app.level]; };

  /* ---------- persistence and history ---------- */
  const snapshot = () => JSON.stringify({ plan: app.plan, site: app.site });
  app.projectObject = function () {
    return C.stamp({ app: 'Stark Builder', version: C.FILE_VERSION, appVersion: VERSION, savedAt: new Date().toISOString(), units: app.units, region: app.region, customMult: app.customMult, currency: app.currency, prices: app.prices,
      plan: app.plan, site: app.site, scenarios: app.scenarios, schedule: app.schedule, permits: app.permits, energy: app.energy, orderSizes: app.orderSizes });
  };
  /* Crash-safe autosave, debounced (400 ms) so a drag does not write on every pointer move. The main copy is written first and read back;
     if that fails the previous copy is put back and a persistent "Not saved" bar appears. The last good copy (.bak) is refreshed only after
     the main write succeeded, best effort. In safe mode nothing is written. */
  app.readOnly = false; app.saveOk = true;
  let saveTimer = null;
  const looksLikeProject = s => typeof s === 'string' && s.length > 20 && s.charCodeAt(0) === 123 && s.charCodeAt(s.length - 1) === 125;
  app.save = function () { if (app.readOnly) return; clearTimeout(saveTimer); saveTimer = setTimeout(app.saveNow, 400); };
  app.flushSave = function () { if (saveTimer) { clearTimeout(saveTimer); app.saveNow(); } };
  app.saveNow = function () {
    saveTimer = null; if (app.readOnly) return true;
    let prev = null, next;
    try { next = JSON.stringify(app.projectObject()); prev = localStorage.getItem(STORE); } catch (e) { return saveFailed(e); }
    try { localStorage.setItem(STORE, next); if (localStorage.getItem(STORE) !== next) throw new Error('The saved copy did not read back correctly.'); }
    catch (e) { try { if (prev !== null && localStorage.getItem(STORE) !== prev) localStorage.setItem(STORE, prev); } catch (x) { /* storage gone */ } return saveFailed(e); }
    if (prev && prev !== next && looksLikeProject(prev)) { try { localStorage.setItem(STORE + '.bak', prev); } catch (e) { /* full: the main copy is safe, the older .bak stays */ } }
    if (!app.saveOk) { app.saveOk = true; const bar = $('#save-fail'); if (bar) bar.remove(); app.say('Saved again in this browser.'); }
    if (app.onSaved) app.onSaved(next);
    return true;
  };
  function saveFailed(e) {
    app.saveOk = false; if (app.onSaved) app.onSaved(null);
    if ($('#save-fail')) return false;
    const bar = h('div', { class: 'warn save-fail', id: 'save-fail', role: 'alert' },
      h('b', { text: 'Not saved. ' }), h('span', { text: 'This browser refused to store your work (storage full, blocked or private mode). Save a project file now so nothing is lost. ' + ((e && e.message) ? '(' + e.message + ')' : '') }),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { app.download(app.slug(app.plan.name) + '.starkbuilder.json', JSON.stringify(app.projectObject(), null, 1), 'application/json'); } }, 'Save project file'),
      h('button', { type: 'button', class: 'btn', onclick: () => app.saveNow() }, 'Try again'));
    document.body.insertBefore(bar, document.body.firstChild);
    return false;
  }
  /* Safe mode: stored data would not load. Keep it untouched, say so plainly, offer the raw text, and offer a blank start. */
  function safeMode(raw) {
    app.readOnly = true;
    const bar = h('div', { class: 'warn', role: 'alert', style: 'margin:0;border-radius:0;display:flex;flex-wrap:wrap;gap:8px;align-items:center' },
      h('b', { text: 'Safe mode: your saved work could not be read, so nothing will be saved or changed.' }),
      h('span', { text: 'Your stored data is untouched. Export it before doing anything else.' }),
      h('button', { type: 'button', class: 'btn', onclick: () => app.download('stark-builder-raw-data.txt', raw, 'text/plain') }, 'Export raw data'),
      h('button', { type: 'button', class: 'btn', onclick: () => { try { localStorage.setItem(STORE + '.corrupt', raw); } catch (e) { /* ignore */ } app.readOnly = false; bar.remove(); app.save(); } }, 'Start a blank project (keeps a copy of the damaged data)'));
    document.body.insertBefore(bar, document.body.firstChild);
  }
  app.loadStored = function () {
    let raw = null, bak = null, e1 = null;
    try { raw = localStorage.getItem(STORE); bak = localStorage.getItem(STORE + '.bak'); } catch (e) { return; }
    if (!raw) return;
    try { app.applyProject(C.openProjectText(raw).project); return; } catch (e) { e1 = e; }
    if (bak) { try { app.applyProject(C.openProjectText(bak).project); try { localStorage.setItem(STORE + '.corrupt', raw); } catch (e) { /* ignore */ } app.say('Your last save was damaged, so the previous good copy was restored.'); return; } catch (e) { /* fall through */ } }
    safeMode(raw);
  };
  app.applyProject = function (p) {
    app.plan = p.plan; app.site = p.site; app.units = p.units; app.region = p.region; app.customMult = p.customMult; app.currency = p.currency; app.prices = p.prices;
    app.scenarios = p.scenarios || []; app.schedule = p.schedule || null; app.permits = p.permits || C.cleanPermits(null); app.energy = p.energy || {}; app.orderSizes = p.orderSizes || {};
    app.level = 0; app.sel = null; app.hist = [snapshot()]; app.hi = 0; app.version++; app.syncUnitsUI(); if (app.floorUI) app.floorUI(); if (app.editor) { app.editor.fitted = false; } if (app.siteEd) app.siteEd.fitted = false; app.refresh();
  };
  /* Undo history: at most 120 steps and at most about 40 MB of snapshots (a big plan keeps fewer steps instead of eating memory). */
  const HIST_MAX = 120, HIST_BYTES = 40e6;
  app.trimHist = function () { let total = 0; for (let i = app.hist.length - 1; i >= 0; i--) { total += app.hist[i].length * 2; if (total > HIST_BYTES && i < app.hist.length - 1) { app.hist.splice(0, i + 1); break; } } while (app.hist.length > HIST_MAX) app.hist.shift(); app.hi = app.hist.length - 1; };
  app.commit = function () {
    app.hist.length = app.hi + 1; app.hist.push(snapshot()); app.trimHist();
    app.version++; app.save(); app.refresh();
  };
  app.restore = function (i) {
    const o = JSON.parse(app.hist[i]); app.plan = o.plan; app.site = o.site; app.hi = i; app.sel = null; app.siteSel = null; app.lv(); app.version++; app.save(); if (app.floorUI) app.floorUI(); app.refresh();
  };
  app.undo = function () { if (app.hi > 0) { app.restore(app.hi - 1); app.say('Undone.'); } };
  app.redo = function () { if (app.hi < app.hist.length - 1) { app.restore(app.hi + 1); app.say('Redone.'); } };
  app.say = function (msg) { const el = app.tab === 'site' ? $('#site-status') : $('#status'); if (el) el.textContent = msg || ''; };
  app.setSel = function (s) { app.sel = s; app.renderPlanSide(); if (app.editor) app.editor.redraw(); };
  app.refreshPanels = function () { app.renderPlanSide(); };
  app.mult = function () { return app.region === 'custom' ? app.customMult : (PRICES().regions.find(r => r.id === app.region) || { mult: 1 }).mult; };
  const PRICES = () => SB.prices;
  app.priceMap = function () { return Object.assign({}, SB.prices.defaults, app.prices); };
  app.fl = m => C.fmtLen(m, app.units);
  app.fa = a => C.fmtArea(a, app.units);
  app.money = v => app.currency + Math.round(v).toLocaleString('en-US');

  /* ---------- tabs ---------- */
  const TABS = ['plan', 'view3d', 'site', 'library', 'costs', 'planning', 'studio', 'project', 'about'];
  app.showTab = function (t) {
    if (TABS.indexOf(t) < 0) t = 'plan';
    app.tab = t;
    document.querySelectorAll('.tab').forEach(b => { b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'); b.tabIndex = b.dataset.tab === t ? 0 : -1; });
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + t));
    app.refresh();
  };
  app.refresh = function () {
    const t = app.tab;
    if (t === 'plan') { app.renderPlanSide(); if (app.editor) app.editor.redraw(); }
    else if (t === 'view3d') app.show3d();
    else if (app.views[t]) app.views[t]();
  };

  /* ---------- units ---------- */
  const SNAPS = { metric: [[0.05, '5 cm'], [0.1, '10 cm'], [0.25, '25 cm'], [0.5, '50 cm']], imperial: [[0.0762, '3 in'], [0.1524, '6 in'], [0.3048, '1 ft'], [0.6096, '2 ft']] };
  app.syncUnitsUI = function () {
    $('#u-metric').setAttribute('aria-pressed', app.units === 'metric'); $('#u-imperial').setAttribute('aria-pressed', app.units === 'imperial');
    if (app.snapSel) {
      clear(app.snapSel); SNAPS[app.units].forEach(s => app.snapSel.appendChild(h('option', { value: s[0], text: s[1] })));
      const def = app.units === 'metric' ? 0.1 : 0.1524; app.snapSel.value = def; app.editor.setSnap(def);
    }
  };
  app.setUnits = function (u) { app.units = u; app.syncUnitsUI(); app.save(); app.refresh(); };

  /* ---------- plan tools column ---------- */
  const ICON = {
    select: 'M5 3l12 8-5 1.5L9 18z', wallExt: 'M3 4h18v16H3z M7 8h10v8H7z', wallInt: 'M4 12h16 M12 4v16', door: 'M5 20V4h10v16 M15 4a10 10 0 0 1 4 8 M9 12h.01',
    window: 'M4 6h16v12H4z M12 6v12 M4 12h16', room: 'M4 5h16v14H4z', pan: 'M12 3v18 M3 12h18 M9 6l3-3 3 3 M9 18l3 3 3-3 M6 9l-3 3 3 3 M18 9l3 3-3 3',
    undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3', redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3', fit: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
    stairs: 'M4 20h4v-4h4v-4h4V8h4V4', furn: 'M4 18v-6h16v6 M6 12V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4 M4 18v2 M20 18v2', elec: 'M13 3L6 14h5l-1 7 7-11h-5z',
    plumb: 'M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z', floor: 'M3 9l9-5 9 5-9 5z M3 14l9 5 9-5'
  };
  const icon = k => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICON[k]); s.appendChild(p); return s; };
  app.icon = icon;
  const TOOLS = [['select', 'Select'], ['wallExt', 'Outer wall'], ['wallInt', 'Inner wall'], ['door', 'Door'], ['window', 'Window'], ['room', 'Room'], ['stairs', 'Stairs'],
    ['furn', 'Furniture'], ['elec', 'Electrical'], ['plumb', 'Plumbing'], ['pan', 'Pan']];
  const HINTS = { select: 'Click a wall, door, window or room to edit it. Drag handles to reshape. Delete removes it.', wallExt: 'Click to start an outer wall, click again to place its end and keep going. Enter, Esc or double-click finishes.',
    wallInt: 'Click to start an inner wall, then click its end. Walls snap to the grid and to each other. Hold Shift for any angle.', door: 'Move over a wall and click to place a door. Change its size afterwards in the panel.',
    window: 'Move over a wall and click to place a window.', room: 'Drag a rectangle to define a room. Its area and perimeter are counted.', pan: 'Drag to move the view. The mouse wheel zooms. You can also hold Space and drag.',
    stairs: 'Click to place a straight stair going up to the next floor. Select it to rotate it and check its rise and run.',
    furn: 'Pick a piece below, then click to place it. Drag to move, R rotates, sizes are editable. Typical sizes for space planning.',
    elec: 'Pick a symbol below and click to mark where you want it. A wish list for your electrician, not a wiring design.',
    plumb: 'Pick a symbol below and click to mark where you want it. A wish list for your plumber, not a pipe design.' };
  /* Floor picker and "what to place" picker in the tools column. */
  app.floorUI = function () {
    const L = C.levels(app.plan); if (!app.floorSel) return;
    clear(app.floorSel); L.forEach((l, i) => app.floorSel.appendChild(h('option', { value: i, selected: i === app.level, text: 'Floor ' + (i + 1), title: i === 0 ? 'Ground floor' : null })));
    app.addFloorBtn.disabled = L.length >= C.MAX_LEVELS;
  };
  app.setLevel = function (k) { app.level = k; app.sel = null; app.lv(); if (app.editor) { app.editor.draw0 = null; app.editor.fitted = false; } app.floorUI(); app.refresh(); app.say('Editing floor ' + (app.level + 1) + '.'); };
  app.addFloor = function () {
    const L = C.levels(app.plan); if (L.length >= C.MAX_LEVELS) { app.say('Up to ' + C.MAX_LEVELS + ' floors.'); return; }
    const top = L[L.length - 1], lv = C.blankLevel(C.wallH(top));
    top.walls.filter(w => w.type === 'ext').forEach(w => lv.walls.push({ id: lv.nextId++, a: w.a.slice(), b: w.b.slice(), type: 'ext', t: w.t }));
    app.plan.levels = (app.plan.levels || []).concat([lv]); app.level = L.length; app.sel = null; if (app.editor) app.editor.fitted = false;
    app.commit('Add floor'); app.floorUI(); app.say('Added floor ' + (app.level + 1) + ' with the outer walls of the floor below. Add stairs on the floor below to reach it.');
  };
  function placeOptions(tool) {
    const sel = app.kindSel; if (!sel) return; clear(sel);
    if (tool === 'furn') { let grp = null; CAT.FURN.forEach(f => { if (!grp || grp.label !== f.group) { grp = h('optgroup', { label: f.group }); sel.appendChild(grp); } grp.appendChild(h('option', { value: f.id, selected: app.placeKind.furn === f.id, text: f.label })); }); }
    else if (tool === 'elec' || tool === 'plumb') CAT.markers[tool].forEach(m => sel.appendChild(h('option', { value: m.id, selected: app.placeKind[tool] === m.id, text: m.sym + '  ' + m.label })));
    app.kindWrap.hidden = !(tool === 'furn' || tool === 'elec' || tool === 'plumb');
    sel.onchange = () => { app.placeKind[tool] = sel.value; };
  }
  function buildTools() {
    const box = clear($('#tools')); app.toolBtns = {};
    app.floorSel = h('select', { 'aria-label': 'Floor to edit', onchange: e => app.setLevel(parseInt(e.target.value, 10)) });
    app.addFloorBtn = h('button', { type: 'button', class: 'btn', title: 'Add a floor above, starting with the outer walls of the top floor', onclick: () => app.addFloor() }, icon('floor'), 'Add floor');
    box.appendChild(h('label', { class: 'f' }, 'Floor', app.floorSel)); box.appendChild(app.addFloorBtn); box.appendChild(h('hr'));
    TOOLS.forEach(t => { const b = h('button', { type: 'button', class: 'btn', 'aria-pressed': t[0] === 'select' ? 'true' : 'false', title: t[1], onclick: () => app.setTool(t[0]) }, icon(t[0]), t[1]); app.toolBtns[t[0]] = b; box.appendChild(b); });
    app.kindSel = h('select', { 'aria-label': 'What to place' });
    app.kindWrap = h('label', { class: 'f', hidden: true }, 'What to place', app.kindSel); box.appendChild(app.kindWrap);
    box.appendChild(h('hr'));
    box.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => app.undo(), title: 'Undo (Ctrl+Z)' }, icon('undo'), 'Undo'));
    box.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => app.redo(), title: 'Redo (Ctrl+Y)' }, icon('redo'), 'Redo'));
    box.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => app.editor.fit(), title: 'Fit the plan in view' }, icon('fit'), 'Fit view'));
    box.appendChild(h('hr'));
    app.snapSel = h('select', { 'aria-label': 'Snap grid', onchange: e => app.editor.setSnap(parseFloat(e.target.value)) });
    box.appendChild(h('label', { class: 'f' }, 'Snap grid', app.snapSel));
    box.appendChild(h('label', null, h('input', { type: 'checkbox', checked: true, onchange: e => { app.editor.showDims = e.target.checked; app.editor.redraw(); } }), 'Show lengths'));
    box.appendChild(h('label', null, h('input', { type: 'checkbox', checked: true, onchange: e => { app.editor.ortho = e.target.checked; } }), 'Straight walls'));
  }
  app.setTool = function (t) {
    Object.keys(app.toolBtns).forEach(k => app.toolBtns[k].setAttribute('aria-pressed', k === t ? 'true' : 'false'));
    app.editor.setTool(t); placeOptions(t); app.say(HINTS[t] || '');
  };

  /* ---------- plan side panels ---------- */
  function lenField(label, m, onSet, hint) {
    const inp = h('input', { type: 'text', value: app.fl(m), 'aria-label': label, inputMode: 'text',
      onchange: e => {
        const v = C.parseLen(e.target.value, app.units);
        if (!(v > 0) || !isFinite(v)) { app.say('Could not read that length. Try 3.2 m, 320 cm or 10\' 6".'); e.target.value = app.fl(m); return; }
        onSet(v);
      } });
    return h('label', { class: 'f' }, label, inp, hint ? h('span', { class: 'hint' }, hint) : null);
  }
  function stat(k, v) { return h('div', { class: 'stat' }, h('span', { text: k }), h('b', { text: v })); }
  app.lenField = lenField; app.stat = stat;
  const deleteBtn = () => h('button', { type: 'button', class: 'btn danger', onclick: () => app.editor.deleteSel() }, 'Delete');
  function itemCard(card, it) {
    const lv = app.lv();
    if (it.cat === 'furn') {
      card.appendChild(h('label', { class: 'f' }, 'Piece', h('select', { onchange: e => { const f = CAT.furn(e.target.value); if (f) { it.kind = f.id; it.w = f.w; it.d = f.d; app.commit('Furniture'); } } },
        CAT.FURN.map(f => h('option', { value: f.id, selected: f.id === it.kind, text: f.group + ': ' + f.label })))));
      card.appendChild(h('div', { class: 'grid2' }, lenField('Width', it.w, v => { it.w = Math.min(10, Math.max(0.1, v)); app.commit('Size'); }), lenField('Depth', it.d, v => { it.d = Math.min(10, Math.max(0.1, v)); app.commit('Size'); })));
      card.appendChild(h('p', { class: 'hint', text: 'Typical catalogue size for space planning. Measure the piece you will really use. Leave walking room: about 0.9 m (3 ft) in front of beds, counters and doors.' }));
    } else {
      card.appendChild(h('label', { class: 'f' }, it.cat === 'elec' ? 'Electrical symbol' : 'Plumbing symbol', h('select', { onchange: e => { it.kind = e.target.value; app.commit('Symbol'); } },
        CAT.markers[it.cat].map(m => h('option', { value: m.id, selected: m.id === it.kind, text: m.sym + '  ' + m.label })))));
      card.appendChild(h('p', { class: 'hint', text: 'A planning symbol: where you want it. A licensed ' + (it.cat === 'elec' ? 'electrician' : 'plumber') + ' designs, sizes and certifies the real system. Each symbol adds a small rough-in allowance to the cost estimate.' }));
    }
    card.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => app.editor.rotateSel() }, 'Rotate 90 (R)'), deleteBtn()));
    void lv;
  }
  function stairCard(card, s) {
    const c = PL.stairCalc(app.plan, app.level, s);
    card.appendChild(h('div', { class: 'grid2' }, lenField('Width', s.w, v => { s.w = Math.min(3, Math.max(0.5, v)); app.commit('Stair width'); }), lenField('Length of run', s.len, v => { s.len = Math.min(12, Math.max(0.5, v)); app.commit('Stair length'); }),
      lenField('Tread depth (going)', s.going, v => { s.going = Math.min(0.45, Math.max(0.15, v)); app.commit('Going'); })));
    [['Floor to floor', app.fl(c.rise)], ['Risers', c.risers + ' x ' + Math.round(c.riser * 1000) + ' mm'], ['Treads', c.treads + ' x ' + Math.round(c.going * 1000) + ' mm'], ['Run needed', app.fl(c.run)]].forEach(r => card.appendChild(stat(r[0], r[1])));
    PL.stairChecks({ levels: [], wallH: C.wallH(app.lv()), stairs: [s], walls: [], openings: [], rooms: [] }, app.units).forEach(w => { if (!/no floor above/.test(w) || !c.hasAbove) card.appendChild(h('div', { class: 'warn', text: w.replace('floor 1', 'this floor') })); });
    card.appendChild(h('p', { class: 'hint', text: 'Example limits: risers up to 190 mm, treads 250 mm, width 860 mm. Your building code sets the real limits, plus headroom, handrails and landings.' }));
    card.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => app.editor.rotateSel() }, 'Turn 90 (R)'), deleteBtn()));
  }
  app.renderPlanSide = function () {
    const side = $('#plan-side'); if (!side) return; const plan = app.plan, lv = app.lv(), sel = app.sel, ed = app.editor, L = C.levels(plan);
    const keepScroll = side.scrollTop; clear(side);
    // building card
    const roof = plan.roof;
    side.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Building' }),
      h('label', { class: 'f' }, 'Name', h('input', { type: 'text', value: plan.name, maxLength: 80, onchange: e => { plan.name = e.target.value.trim() || 'Untitled plan'; app.commit('Rename'); } })),
      h('div', { class: 'grid2' }, lenField('Wall height, floor ' + (app.level + 1), lv.wallH, v => { lv.wallH = Math.min(6, Math.max(1.8, v)); app.commit('Wall height'); }),
        h('label', { class: 'f' }, 'Roof', h('select', { onchange: e => { roof.type = e.target.value; app.commit('Roof'); } }, ['gable', 'shed', 'flat'].map(t => h('option', { value: t, selected: roof.type === t, text: t[0].toUpperCase() + t.slice(1) }))))),
      h('div', { class: 'grid2' },
        h('label', { class: 'f' }, 'Roof pitch (degrees)', h('input', { type: 'number', min: 2, max: 60, step: 1, value: roof.pitch, disabled: roof.type === 'flat', onchange: e => { roof.pitch = Math.min(60, Math.max(2, parseFloat(e.target.value) || 25)); app.commit('Pitch'); } })),
        lenField('Roof overhang', roof.overhang, v => { roof.overhang = Math.min(1.5, v); app.commit('Overhang'); })),
      h('p', { class: 'hint', text: L.length > 1 ? 'Floor ' + (app.level + 1) + ' of ' + L.length + '. The roof sits on the top floor. Floor structure between floors: ' + app.fl(C.FLOOR_T) + '.' : 'One floor. Use Add floor (left) for a second storey.' }),
      app.level > 0 ? h('button', { type: 'button', class: 'btn danger', onclick: async () => { if (await app.ask('Remove floor ' + (app.level + 1) + '?', 'Its walls, rooms, furniture and symbols go with it. Ctrl+Z brings it back.', 'Remove floor')) { plan.levels.splice(app.level - 1, 1); app.level = Math.max(0, app.level - 1); app.sel = null; app.commit('Remove floor'); app.floorUI(); } } }, 'Remove this floor') : null));
    // selection card
    const card = h('div', { class: 'card' }, h('h2', { text: 'Selection' })); side.appendChild(card);
    if (!sel) card.appendChild(h('p', { class: 'hint', text: 'Nothing selected. Use the Select tool and click a wall, door, window, room, stair, piece of furniture or symbol. New openings use the sizes below.' }));
    else if (sel.type === 'item' || sel.type === 'stair') {
      const it = ed.findThing(sel);
      if (!it) app.sel = null; else if (sel.type === 'item') itemCard(card, it); else stairCard(card, it);
    } else if (sel.type === 'wall') {
      const w = C.findWall(lv, sel.id);
      if (!w) { app.sel = null; } else {
        card.appendChild(h('div', { class: 'grid2' },
          h('label', { class: 'f' }, 'Wall type', h('select', { onchange: e => { w.type = e.target.value; w.t = w.type === 'ext' ? C.DEF.extT : C.DEF.intT; app.commit('Wall type'); } }, [['ext', 'Outer'], ['int', 'Inner']].map(o => h('option', { value: o[0], selected: w.type === o[0], text: o[1] })))),
          lenField('Thickness', w.t, v => { w.t = Math.min(1, Math.max(0.03, v)); app.commit('Thickness'); })));
        card.appendChild(lenField('Length', C.wallLen(w), v => {
          const L = C.wallLen(w), dx = (w.b[0] - w.a[0]) / L, dy = (w.b[1] - w.a[1]) / L, nb = [w.a[0] + dx * v, w.a[1] + dy * v], old = w.b.slice();
          lv.walls.forEach(o => { ['a', 'b'].forEach(k => { if (o !== w && C.dist(o[k], old) < 1e-6) o[k] = nb.slice(); }); }); w.b = nb;
          C.openingsOn(lv, w.id).forEach(o => { o.s = Math.min(o.s, Math.max(o.w / 2, v - o.w / 2)); });
          app.commit('Wall length');
        }, 'Moves the end point; connected walls follow.'));
        const ops = C.openingsOn(lv, w.id);
        card.appendChild(stat('Net wall area', app.fa(C.wallNetArea(lv, w)))); card.appendChild(stat('Openings on it', String(ops.length)));
        card.appendChild(h('div', { class: 'row' }, deleteBtn()));
      }
    } else if (sel.type === 'opening') {
      const o = lv.openings.find(q => q.id === sel.id), w = o && C.findWall(lv, o.wall);
      if (!o || !w) { app.sel = null; } else {
        const edit = (what, fn) => { const old = clone(o); fn(); const bad = C.checkOpenings(lv); if (bad.length || o.w > C.wallLen(w)) { Object.assign(o, old); app.say('That would not fit on this wall.'); app.renderPlanSide(); return; } app.commit(what); };
        card.appendChild(h('label', { class: 'f' }, 'Type', h('select', { onchange: e => edit('Opening type', () => { o.type = e.target.value; if (o.type === 'window') { o.sill = o.sill || 0.9; o.h = Math.min(o.h, 1.5); } else { o.sill = 0; o.h = 2; } }) }, [['door', 'Door'], ['window', 'Window']].map(t => h('option', { value: t[0], selected: o.type === t[0], text: t[1] })))));
        card.appendChild(h('div', { class: 'grid2' }, lenField('Width', o.w, v => edit('Width', () => { o.w = v; })), lenField('Height', o.h, v => edit('Height', () => { o.h = v; }))));
        if (o.type === 'window') card.appendChild(lenField('Sill height', Math.max(o.sill, 0.01), v => edit('Sill', () => { o.sill = v; })));
        card.appendChild(lenField('Distance from wall start', o.s, v => edit('Move', () => { o.s = Math.max(o.w / 2, Math.min(C.wallLen(w) - o.w / 2, v)); })));
        if (o.type === 'door') card.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => { o.flip = !o.flip; app.commit('Swing'); } }, 'Flip swing'));
        card.appendChild(h('div', { class: 'row', style: 'margin-top:8px' }, deleteBtn()));
      }
    } else if (sel.type === 'room') {
      const r = lv.rooms.find(q => q.id === sel.id);
      if (!r) { app.sel = null; } else {
        card.appendChild(h('label', { class: 'f' }, 'Room name', h('input', { type: 'text', value: r.name, maxLength: 40, onchange: e => { r.name = e.target.value.trim() || 'Room'; app.commit('Rename room'); } })));
        card.appendChild(stat('Area', app.fa(C.polyArea(r.pts)))); card.appendChild(stat('Perimeter', app.fl(C.polyPerimeter(r.pts))));
        card.appendChild(h('p', { class: 'hint', text: 'Drag the square corners to reshape. Rooms are measured to the lines you draw (wall centres, unless you draw to the inside faces).' }));
        card.appendChild(h('div', { class: 'row' }, deleteBtn()));
      }
    }
    // defaults for new openings
    const d = ed.defaults;
    side.appendChild(h('div', { class: 'card' }, h('h3', { text: 'New opening sizes' }),
      h('div', { class: 'grid2' }, lenField('Window width', d.winW, v => { d.winW = v; app.renderPlanSide(); }), lenField('Window height', d.winH, v => { d.winH = v; app.renderPlanSide(); }),
        lenField('Window sill', d.winSill, v => { d.winSill = v; app.renderPlanSide(); }), lenField('Door width', d.doorW, v => { d.doorW = v; app.renderPlanSide(); }))));
    // totals
    const st = C.planStats(lv), tb0 = C.bbox(L[L.length - 1]), rg = tb0.w ? K.roofGeometry(plan, tb0) : null;
    const tot = h('div', { class: 'card' }, h('h2', { text: L.length > 1 ? 'Totals, floor ' + (app.level + 1) : 'Totals' }));
    [['Floor area (rooms)', app.fa(st.floorArea)], ['Footprint (outer box)', app.fa(st.footprintArea)], ['Outer size', app.fl(st.bbox.w) + ' x ' + app.fl(st.bbox.d)],
      ['Outer wall perimeter', app.fl(st.extPerimeter)], ['Inner wall length', app.fl(st.intLen)], ['Outer wall area, net', app.fa(st.extNet)], ['Inner wall area, net', app.fa(st.intNet)],
      ['Windows', st.windows + ' (' + app.fa(st.windowArea) + ')'], ['Doors', String(st.doorsExt + st.doorsInt + st.doorsPatio)], ['Openings subtracted', app.fa(st.openingArea)], ['Roof area (estimate)', rg ? app.fa(rg.area) : '-']].forEach(r => tot.appendChild(stat(r[0], r[1])));
    if (L.length > 1) { tot.appendChild(stat('Floor area, all ' + L.length + ' floors', app.fa(C.totalFloorArea(plan)))); tot.appendChild(stat('Height to the top of the walls', app.fl(C.buildingHeight(plan)))); }
    const furn = (lv.items || []).filter(i => i.cat === 'furn').length, el = (lv.items || []).filter(i => i.cat === 'elec').length, pl = (lv.items || []).filter(i => i.cat === 'plumb').length;
    if (furn + el + pl + (lv.stairs || []).length) tot.appendChild(stat('Furniture / electrical / plumbing / stairs', furn + ' / ' + el + ' / ' + pl + ' / ' + (lv.stairs || []).length));
    tot.appendChild(h('p', { class: 'hint', text: 'Net wall areas subtract every door and window. Roof area is figured over the outer box of the top floor with the overhang.' }));
    side.appendChild(tot);
    const notes = PL.stairChecks(plan, app.units); notes.forEach(w => side.appendChild(h('div', { class: 'warn', text: w })));
    const rt = h('table', null, h('thead', null, h('tr', null, h('th', { text: 'Room' }), h('th', { class: 'num', text: 'Area' }), h('th', { class: 'num', text: 'Perimeter' }))));
    const tb = h('tbody'); st.rooms.forEach(r => tb.appendChild(h('tr', { style: 'cursor:pointer', onclick: () => app.setSel({ type: 'room', id: r.id }) }, h('td', { text: r.name }), h('td', { class: 'num', text: app.fa(r.area) }), h('td', { class: 'num', text: app.fl(r.perimeter) }))));
    if (st.rooms.length) { tb.appendChild(h('tr', null, h('td', null, h('b', { text: 'Total' })), h('td', { class: 'num' }, h('b', { text: app.fa(st.floorArea) })), h('td', { class: 'num', text: '' }))); }
    rt.appendChild(tb);
    side.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Rooms' }), st.rooms.length ? h('div', { class: 'scroll-x' }, rt) : h('p', { class: 'hint', text: 'No rooms yet. Use the Room tool to drag one out.' })));
    const bad = C.checkOpenings(lv); if (bad.length) side.appendChild(h('div', { class: 'warn', text: bad[0] }));
    side.scrollTop = keepScroll;
  };

  /* ---------- 3D view ---------- */
  app.scope3d = 'plan'; app.mode3d = 'orbit';
  function build3dBar() {
    const bar = clear($('#bar3d'));
    const seg = (items, cur, fn) => h('div', { class: 'seg', role: 'group' }, items.map(i => h('button', { type: 'button', 'aria-pressed': cur === i[0] ? 'true' : 'false', onclick: () => fn(i[0]) }, i[1])));
    bar.appendChild(h('span', { class: 'small muted', text: 'Show' }));
    bar.appendChild(seg([['plan', 'This building'], ['site', 'Whole site']], app.scope3d, v => { app.scope3d = v; if (v === 'site') app.mode3d = 'orbit'; app.show3d(true); }));
    if (app.scope3d === 'plan') bar.appendChild(seg([['orbit', 'Orbit'], ['walk', 'Walk inside']], app.mode3d, v => { app.mode3d = v; app.show3d(true); }));
    const nL = C.levels(app.plan).length;
    if (app.scope3d === 'plan' && nL > 1) {
      const opts = []; for (let i = 0; i < nL; i++) opts.push(h('option', { value: i, selected: (app.mode3d === 'walk' ? app.walk3d || 0 : app.upTo3d == null ? nL - 1 : app.upTo3d) === i, text: app.mode3d === 'walk' ? 'Walk on floor ' + (i + 1) : i === nL - 1 ? 'All ' + nL + ' floors' : 'Floors 1 to ' + (i + 1) + ' (cut-away)' }));
      bar.appendChild(h('select', { 'aria-label': 'Floors', onchange: e => { const v = parseInt(e.target.value, 10); if (app.mode3d === 'walk') app.walk3d = v; else app.upTo3d = v; app.show3d(true); } }, opts));
    }
    bar.appendChild(h('label', { class: 'small', style: 'display:flex;gap:6px;align-items:center' }, h('input', { type: 'checkbox', checked: app.roof3d !== false, onchange: e => { app.roof3d = e.target.checked; if (app.viewer) app.viewer.setRoof(e.target.checked); } }), 'Roof'));
    bar.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => { if (app.viewer) { app.viewer.setMode('orbit'); app.mode3d = 'orbit'; app.viewer.setCamera({ orbit: { yaw: 0, pitch: 1.5 } }); build3dBar(); } } }, 'Top view'));
    bar.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => { app.built3d = null; app.show3d(true); } }, 'Reset camera'));
    bar.appendChild(h('button', { type: 'button', class: 'btn', id: 'pic3d-btn', title: 'Save this view as a PNG picture', onclick: () => { app.picture.focus = '3d'; location.hash = '#/project'; } }, 'Save as picture'));
  }
  /* What the 3D view shows right now (also used by the picture export): the floors, the walk floor and a key that changes when the model must be rebuilt. */
  app.state3d = function () {
    const nL = C.levels(app.plan).length, walkL = Math.min(nL - 1, app.walk3d || 0), upTo = app.mode3d === 'walk' ? nL - 1 : app.upTo3d == null ? nL - 1 : Math.min(nL - 1, app.upTo3d);
    return { nL, walkL, upTo, key: app.scope3d + ':' + app.version + ':' + app.mode3d + ':' + walkL + ':' + upTo };
  };
  app.scene3d = function (s3) { s3 = s3 || app.state3d(); return app.scope3d === 'site' ? SB.mesh.buildSite(app.site) : SB.mesh.buildPlan(app.plan, { upTo: s3.upTo, walkLevel: s3.walkL }); };
  app.show3d = function (force) {
    build3dBar(); const cv = $('#gl-cv'), hint = $('#hint3d');
    if (!app.viewer && !app.glFailed) { try { app.viewer = new SB.Viewer(cv); if (!app.viewer.ok) throw new Error('no webgl'); } catch (e) { app.glFailed = true; app.viewer = null; } }
    if (app.glFailed) { cv.parentNode.appendChild(h('div', { class: 'nogl', text: 'This browser or graphics driver does not offer WebGL, so the 3D view is unavailable. The floor plan, site planner and costs still work.' })); hint.textContent = ''; return; }
    const s3 = app.state3d(), key = s3.key;
    if (force || !app.built3d || app.built3d !== key) {
      const sc = app.scene3d(s3);
      app.viewer.setRoof(app.roof3d !== false); app.viewer.setScene(sc, app.scope3d === 'site' ? 'orbit' : app.mode3d); app.built3d = key;
    } else { app.viewer.setMode(app.scope3d === 'site' ? 'orbit' : app.mode3d); }
    app.viewer.dirty = true; app.viewer.kick();
    hint.textContent = (app.viewer.mode === 'walk' ? 'Walk: W A S D or the arrow keys move, drag the mouse to look, hold Shift to move faster. Click the view first so it receives the keys. Doors are open gaps you can walk through.' : 'Orbit: drag to rotate, right-drag or Shift-drag to pan, wheel to zoom. Walls are drawn from your plan; the roof is estimated over the outer box.');
  };

  /* ---------- boot ---------- */
  app.start = function () {
    buildTools();
    app.editor = new SB.Editor($('#plan-cv'), app);
    app.siteEd = new SB.SiteEditor($('#site-cv'), app);
    app.syncUnitsUI();
    app.loadStored();
    app.floorUI();
    if (!app.hist.length) { app.hist = [snapshot()]; app.hi = 0; }
    document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { location.hash = '#/' + b.dataset.tab; }));
    $('#u-metric').addEventListener('click', () => app.setUnits('metric')); $('#u-imperial').addEventListener('click', () => app.setUnits('imperial'));
    $('#theme-btn').addEventListener('click', () => { const r = document.documentElement; const t = r.dataset.theme === 'dark' ? 'light' : 'dark'; r.dataset.theme = t; try { localStorage.setItem(STORE + '.theme', t); } catch (e) { /* ignore */ } });
    try { const th = localStorage.getItem(STORE + '.theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { /* ignore */ }
    const route = () => app.showTab((location.hash.replace(/^#\/?/, '') || 'plan').split('?')[0]);
    window.addEventListener('hashchange', route);
    window.addEventListener('pagehide', () => app.flushSave());
    const skip = $('.skip'); if (skip) skip.addEventListener('click', e => { e.preventDefault(); const v = $('.view.on') || $('#main'); const hd = v.querySelector('h1, canvas, [tabindex]'); ($('#main')).focus(); if (hd && hd.focus) { if (!hd.hasAttribute('tabindex')) hd.setAttribute('tabindex', '-1'); hd.focus(); } });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') app.flushSave(); });
    window.addEventListener('resize', () => { if (app.tab === 'plan') { app.editor.fitted = false; app.editor.redraw(); } else if (app.tab === 'site') { app.siteEd.fitted = false; app.siteEd.redraw(); } else if (app.tab === 'view3d' && app.viewer) { app.viewer.dirty = true; app.viewer.kick(); } });
    document.addEventListener('keydown', e => {
      const tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA');
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); app.undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); app.redo(); }
    });
    route();
    // the layout settles after fonts and scrollbars; redraw once more
    setTimeout(() => { if (app.tab === 'plan') { app.editor.fitted = false; app.editor.redraw(); } }, 60);
  };
})();
