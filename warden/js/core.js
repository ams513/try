/* Stark Warden: UI helpers, local storage, router. No network calls anywhere in this app. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var doc = root.document;

  /* ---------- DOM ---------- */
  function append(el, kids) {
    kids.forEach(function (c) {
      if (c == null || c === false) { return; }
      if (Array.isArray(c)) { append(el, c); return; }
      el.appendChild(typeof c === 'object' ? c : doc.createTextNode(String(c)));
    });
  }
  function h(tag, attrs) {
    var el = doc.createElement(tag), k, v, kids = Array.prototype.slice.call(arguments, 2);
    for (k in (attrs || {})) {
      v = attrs[k];
      if (v == null || v === false) { continue; }
      if (k === 'class') { el.className = v; }
      else if (k === 'text') { el.textContent = v; }
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') { el.addEventListener(k.slice(2), v); }
      else if (k === 'value') { el.value = v; }
      else if (k === 'checked') { el.checked = !!v; }
      else { el.setAttribute(k, v === true ? '' : v); }
    }
    append(el, kids);
    return el;
  }
  function clear(el) { while (el.firstChild) { el.removeChild(el.firstChild); } return el; }
  /* SVG elements (charts). Attributes only: the page policy forbids inline style attributes. */
  function sv(tag, attrs) {
    var el = doc.createElementNS('http://www.w3.org/2000/svg', tag), k, kids = Array.prototype.slice.call(arguments, 2);
    for (k in (attrs || {})) { if (attrs[k] != null && attrs[k] !== false) { if (k === 'text') { el.textContent = attrs[k]; } else { el.setAttribute(k, attrs[k]); } } }
    append(el, kids);
    return el;
  }

  /* ---------- storage (falls back to memory when the browser blocks it) ---------- */
  /* memOnly: keys whose last write did not reach the browser's storage; reads prefer the newer copy in memory so the screen
     never shows stale data after a failed save. */
  var mem = {}, badKeys = {}, memOnly = {}, failHook = null, changeHooks = [];
  function ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function lsGet(k) {
    var st = ls(), r;
    if (memOnly[k] && k in mem) { return mem[k]; }
    if (st) {
      try {
        r = SW.backup.safeRead(st, k);
        if (r.state === 'corrupt') { badKeys[k] = r.v; } else { delete badKeys[k]; }
        if (r.v != null) { return r.v; }
      } catch (e) { /* fall through to memory */ }
    }
    return k in mem ? mem[k] : null;
  }
  /* Crash-safe save: written, read back, previous good copy kept as key.bak. Refused in safe mode unless force. */
  function lsSet(k, v, force) {
    var st = ls(), ok = true;
    if (!force && safeMode()) { return false; }
    mem[k] = v;
    if (st) {
      try { ok = SW.backup.safeWrite(st, k, v); } catch (e) { ok = false; /* memory only */ }
    } else { ok = false; }
    if (ok) { delete badKeys[k]; delete memOnly[k]; changeHooks.forEach(function (fn) { try { fn(k); } catch (e) { /* listener gone */ } }); } else { memOnly[k] = true; if (failHook) { failHook(k); } }
    return ok;
  }
  function safeMode() { return Object.keys(badKeys).length > 0; }
  function lsKeys() {
    var out = Object.keys(mem), i, k, st = ls();
    try { for (i = 0; st && i < st.length; i++) { k = st.key(i); if (out.indexOf(k) < 0) { out.push(k); } } } catch (e) { /* none */ }
    return out.filter(function (x) { return x.indexOf('sw:') === 0 && !/\.bak$/.test(x); });
  }
  function lsDel(k) { var st = ls(); delete mem[k]; delete badKeys[k]; delete memOnly[k]; try { if (st) { st.removeItem(k); st.removeItem(k + '.bak'); } } catch (e) { /* nothing */ } }
  /* every stored sw: entry exactly as it sits on disk (corrupt ones included), for the safe-mode export */
  function rawDump() {
    var o = {}, st = ls(), i, k;
    try { for (i = 0; st && i < st.length; i++) { k = st.key(i); if (k.indexOf('sw:') === 0) { o[k] = st.getItem(k); } } } catch (e) { /* none */ }
    Object.keys(mem).forEach(function (m) { if (!(m in o)) { o[m] = mem[m]; } });
    return { app: 'Stark Warden', raw: true, exported: new Date().toISOString(), data: o };
  }

  /* A restore never lowers a vault's high-water save counter, so a vault from an old backup is still pointed out as older. */
  function keepHigh(k, v) {
    var a, b;
    if (!/:vaultSeen$/.test(k)) { return v; }
    try { a = JSON.parse(v); b = JSON.parse(lsGet(k)); } catch (e) { return v; }
    return typeof b === 'number' && isFinite(b) && (typeof a !== 'number' || !isFinite(a) || b > a) ? JSON.stringify(b) : v;
  }
  var store = {
    settings: function () { return SW.backup.cleanSettings(lsGet('sw:settings')); },
    setSettings: function (s) { return lsSet('sw:settings', JSON.stringify(SW.backup.cleanSettings(s))); },
    key: function (k) { return 'sw:p:' + store.settings().profile + ':' + k; },
    get: function (k, d) { try { var v = lsGet(store.key(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    /* a list that must be an array: anything else (a damaged or hand-edited value) reads as an empty list */
    list: function (k) { var v = store.get(k, []); return Array.isArray(v) ? v : []; },
    /* returns false when the value could not be written to this device (the change stays in memory for this tab) */
    set: function (k, v) { return lsSet(store.key(k), JSON.stringify(v)); },
    onSaveFail: function (fn) { failHook = fn; },
    onChange: function (fn) { if (changeHooks.indexOf(fn) < 0) { changeHooks.push(fn); } },
    unsaved: function () { return Object.keys(memOnly); },
    del: function (k) { lsDel(store.key(k)); },
    /* device-wide data (not per profile), kept under sw:p:_device: so backups, autosave and restores carry it like everything else */
    getDevice: function (k, d) { try { var v = lsGet('sw:p:_device:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    rawDevice: function (k) { try { return lsGet('sw:p:_device:' + k); } catch (e) { return null; } },
    setDevice: function (k, v) { return lsSet('sw:p:_device:' + k, JSON.stringify(v)); },
    exportAll: function () { var o = {}; lsKeys().forEach(function (k) { o[k] = lsGet(k); }); return SW.backup.seal('Stark Warden', SW.data.meta.version, new Date().toISOString(), o); },
    scan: function () { lsKeys().forEach(lsGet); return safeMode(); },
    safeMode: safeMode, rawDump: rawDump,
    importAll: function (obj) {
      var v = SW.backup.validate(obj), keys, i;
      if (!v.ok) { throw new Error(v.msg); }
      keys = Object.keys(obj.data);
      for (i = 0; i < keys.length; i++) { if (!lsSet(keys[i], keepHigh(keys[i], obj.data[keys[i]]), true)) { throw new Error('Could not save the restored data on this device. Some entries may not have been written.'); } }
      return v;
    },
    wipe: function () { var st = ls(), i, ks = []; lsKeys().forEach(lsDel); try { for (i = 0; st && i < st.length; i++) { if (st.key(i).indexOf('sw:') === 0) { ks.push(st.key(i)); } } ks.forEach(function (k) { st.removeItem(k); }); } catch (e) { /* nothing */ } mem = {}; badKeys = {}; memOnly = {}; }
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- toast, copy, save, print ---------- */
  /* Two regions: #toast (polite, short) for confirmations and #toast-alert (role=alert) for failures. A failure stays at least
     9 seconds, never hides while hovered or focused, and has a Dismiss button. */
  var toastTimer = null, alertTimer = null;
  function toast(msg, kind) {
    var bad = kind === 'bad', t = doc.getElementById(bad ? 'toast-alert' : 'toast');
    if (!t) { return; }
    clear(t);
    t.appendChild(h('span', { text: msg }));
    if (bad) { t.appendChild(h('button', { type: 'button', class: 'toast-x', onclick: function () { t.hidden = true; } }, 'Dismiss')); }
    t.hidden = false;
    function hideLater(ms) {
      var timer = setTimeout(function () { if (t.matches(':hover') || t.contains(doc.activeElement)) { hideLater(2000); } else { t.hidden = true; } }, ms);
      if (bad) { clearTimeout(alertTimer); alertTimer = timer; } else { clearTimeout(toastTimer); toastTimer = timer; }
    }
    hideLater(bad ? 9000 : 3200);
  }
  /* one persistent, visually hidden polite region for short result summaries (a whole result card is never live) */
  function announce(text) {
    var r = doc.getElementById('sr-live');
    if (!r) { return; }
    r.textContent = '';
    setTimeout(function () { r.textContent = text; }, 60);
  }
  var lastFail = 0, warnedNoStore = false;
  store.onSaveFail(function () {
    var now = Date.now();
    if (safeMode() || now - lastFail < 15000 || (!ls() && warnedNoStore)) { return; }
    lastFail = now; warnedNoStore = !ls();
    toast('Could not save on this device (storage is full or blocked). Your change is kept only until this tab closes. Save a backup in Settings now.', 'bad');
  });
  function copyText(text, msg) {
    function fallback() {
      var ta = h('textarea', { class: 'offscreen' }); ta.value = text; doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy'); toast(msg || 'Copied.'); } catch (e) { toast('Could not copy. Select the text and copy it yourself.', 'bad'); }
      doc.body.removeChild(ta);
    }
    try {
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) { root.navigator.clipboard.writeText(text).then(function () { toast(msg || 'Copied.'); }, fallback); }
      else { fallback(); }
    } catch (e) { fallback(); }
  }
  function saveText(name, text, mime) {
    try {
      var blob = new root.Blob([text], { type: mime || 'text/plain;charset=utf-8' }), url = root.URL.createObjectURL(blob), a = h('a', { href: url, download: name });
      doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
      setTimeout(function () { root.URL.revokeObjectURL(url); }, 4000);
      toast('Saved ' + name + ' (check your downloads). If nothing happened, use Copy instead.');
    } catch (e) { toast('Saving is blocked here. Use Copy instead.', 'bad'); }
  }
  function printEl(el) {
    el.classList.add('print-area');
    try { root.print(); } catch (e) { toast('Printing is blocked here. Open the app in your browser to print.', 'bad'); }
    setTimeout(function () { el.classList.remove('print-area'); }, 500);
  }

  /* ---------- forms ---------- */
  var fid = 0;
  function form(defs, vals) {
    var inputs = {}, el = h('div', { class: 'form' });
    vals = vals || {};
    defs.forEach(function (d) {
      var inp, id = 'f' + (++fid), label, wrap;
      if (d.type === 'textarea') { inp = h('textarea', { id: id, rows: d.rows || 3, placeholder: d.ph || '' }); }
      else if (d.type === 'select') {
        inp = h('select', { id: id }, (d.options || []).map(function (o) { return h('option', { value: typeof o === 'string' ? o : o.v }, typeof o === 'string' ? o : o.l); }));
      } else if (d.type === 'checkbox') { inp = h('input', { id: id, type: 'checkbox' }); }
      else { inp = h('input', { id: id, type: d.type === 'money' ? 'text' : (d.type || 'text'), placeholder: d.ph || '', inputmode: d.type === 'money' || d.type === 'number' ? 'decimal' : null, step: d.type === 'number' ? 'any' : null }); }
      if (d.type === 'checkbox') { inp.checked = !!vals[d.id]; } else if (vals[d.id] != null) { inp.value = vals[d.id]; }
      inputs[d.id] = inp;
      label = h('label', { for: id }, d.label);
      wrap = h('div', { class: 'field' + (d.type === 'checkbox' ? ' check' : '') + (d.wide ? ' wide' : '') });
      if (d.type === 'checkbox') { append(wrap, [inp, label]); } else { append(wrap, [label, inp]); }
      if (d.hint) { wrap.appendChild(h('div', { class: 'hint', id: id + '-hint', text: d.hint })); inp.setAttribute('aria-describedby', id + '-hint'); }
      if (d.max) { inp.setAttribute('maxlength', d.max); }
      el.appendChild(wrap);
    });
    return {
      el: el,
      read: function () { var o = {}; Object.keys(inputs).forEach(function (k) { o[k] = inputs[k].type === 'checkbox' ? inputs[k].checked : inputs[k].value; }); return o; },
      set: function (v) { Object.keys(inputs).forEach(function (k) { if (inputs[k].type === 'checkbox') { inputs[k].checked = !!v[k]; } else if (v[k] != null) { inputs[k].value = v[k]; } }); },
      /* show an error under one field, linked to it; error(id, '') clears it. Focuses the field on error. */
      error: function (k, text) { return fieldError(inputs[k], text); },
      inputs: inputs
    };
  }

  /* Field error linked to its control: aria-invalid, and the message id added to aria-describedby (a hint id is kept). */
  function fieldError(inp, text) {
    var eid, old, desc;
    if (!inp) { return null; }
    if (!inp.id) { inp.id = 'f' + (++fid); }
    eid = inp.id + '-err';
    old = doc.getElementById(eid);
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
    desc = (inp.getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== eid; });
    if (!text) { inp.removeAttribute('aria-invalid'); if (desc.length) { inp.setAttribute('aria-describedby', desc.join(' ')); } else { inp.removeAttribute('aria-describedby'); } return null; }
    old = h('p', { class: 'field-error', id: eid, role: 'alert', text: text });
    inp.parentNode.insertBefore(old, inp.nextSibling);
    desc.push(eid); inp.setAttribute('aria-describedby', desc.join(' ')); inp.setAttribute('aria-invalid', 'true');
    try { inp.focus(); } catch (e) { /* not focusable */ }
    return old;
  }

  /* ---------- shared pieces ---------- */
  function meter(level) {
    var segs = [0, 1, 2, 3].map(function (i) { return h('span', { class: 'seg' + (i <= level.rank ? ' on' : '') }); });
    return h('div', { class: 'meter lv-' + level.id, role: 'img', 'aria-label': 'Caution level: ' + level.label }, h('div', { class: 'segs' }, segs),
      h('div', { class: 'meter-label' }, h('span', { class: 'glyph', 'aria-hidden': 'true', text: level.glyph }), h('strong', { text: level.label })));
  }
  function flagList(flags) {
    if (!flags.length) { return h('p', { class: 'muted', text: 'No warning signs matched.' }); }
    return h('ul', { class: 'flags' }, flags.map(function (f) {
      return h('li', { class: 'flag w' + Math.min(f.weight, 5) },
        h('div', { class: 'flag-head' }, h('strong', { text: f.title }), h('span', { class: 'dots', 'aria-label': 'weight ' + f.weight, text: '●'.repeat(Math.min(f.weight, 5)) })),
        h('p', { text: f.why }), f.evidence ? h('p', { class: 'ev' }, 'Matched: ', h('q', { text: f.evidence })) : null, f.note ? h('p', { class: 'small muted', text: f.note }) : null);
    }));
  }
  function notice(text, kind) { return h('div', { class: 'notice ' + (kind || ''), role: kind === 'warn' ? 'note' : null }, text); }
  function copyBtn(getText, label) { return h('button', { type: 'button', class: 'btn small', onclick: function () { copyText(typeof getText === 'function' ? getText() : getText); } }, label || 'Copy'); }
  function copyLine(text) { return h('div', { class: 'copyline' }, h('code', { text: text }), copyBtn(text, 'Copy')); }
  function disclaimerBar() { return notice(SW.data.meta.notLegal + ' ' + SW.data.meta.check, 'legal'); }
  function dateStr(d) { return d.getFullYear() + '-' + SW.util.pad2(d.getMonth() + 1) + '-' + SW.util.pad2(d.getDate()); }
  function today() { return dateStr(new Date()); }
  function table(head, rows, cls) {
    return h('div', { class: 'tablewrap' }, h('table', { class: cls || '' }, h('thead', null, h('tr', null, head.map(function (x) { return h('th', { scope: 'col', text: x }); }))),
      h('tbody', null, rows.map(function (r) { return h('tr', null, r.map(function (c) { return h('td', null, c); })); }))));
  }
  function card(title, kids, cls) { return h('section', { class: 'card ' + (cls || '') }, title ? h('h3', { text: title }) : null, kids); }

  /* ---------- router ---------- */
  var routes = {}, order = [];
  function route(name, label, fn, icon) { routes[name] = fn; order.push({ name: name, label: label, icon: icon }); }
  function parseHash() {
    var p = String(root.location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    return { name: p[0] || 'home', args: p.slice(1) };
  }
  /* Spanish: views that are translated call esReady(); every other view gets a one-line notice in Spanish. */
  var esOk = false;
  function esReady() { esOk = true; }
  /* The legal content is United States law. Said once on the first run (until dismissed) and always on About. */
  function usNote(always) {
    var st = store.settings(), t = SW.i18n.t, box;
    if (!always && st.usNote) { return doc.createTextNode(''); }
    box = h('div', { class: 'notice soft usnote', role: 'note' }, h('strong', { text: t('usTitle') }), h('p', { text: t('usOnly') }), h('p', { text: t('usLaw') }), h('p', { text: t('usElse') }), h('p', { text: t('usMsg') }));
    if (!always) { box.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: function () { var s2 = store.settings(); s2.usNote = true; store.setSettings(s2); if (box.parentNode) { box.parentNode.removeChild(box); } } }, t('usGot')))); }
    return box;
  }
  function mtBanner() { var n = SW.i18n.t('mtNote'); return n ? h('div', { class: 'notice warn mt', lang: 'es' }, n) : doc.createTextNode(''); }
  function updateChrome() {
    var pb = doc.getElementById('pressnav');
    if (pb) { pb.textContent = SW.i18n.t('pressNav'); }
    var gear = doc.querySelector('.gear');
    if (gear) { gear.textContent = SW.i18n.lang() === 'es' ? 'Ajustes' : 'Settings'; }
  }
  function renderRoute() {
    var main = doc.getElementById('main'), r = parseHash(), fn = routes[r.name] || routes.home;
    clear(main);
    esOk = false;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-nav]'), function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === (routes[r.name] ? r.name : 'home')); });
    try { fn(main, r.args); } catch (e) { main.appendChild(notice('Something went wrong drawing this page: ' + e.message, 'warn')); if (root.console) { root.console.error(e); } }
    if (SW.i18n.lang() === 'es' && !esOk) { main.insertBefore(h('div', { class: 'notice soft', lang: 'es' }, SW.i18n.t('onlyEn') + ' ', h('a', { href: '#/home', text: 'Inicio' }), ' · ', h('a', { href: '#/now', text: SW.i18n.t('pressNav') })), main.firstChild); }
    updateChrome();
    if (store.safeMode()) { main.insertBefore(safeBanner(), main.firstChild); }
    main.focus({ preventScroll: true });
    root.scrollTo(0, 0);
  }
  function safeBanner() {
    return h('div', { class: 'notice warn', role: 'alert' }, h('strong', { text: 'Safe mode: read-only. ' }),
      'Some saved data on this device could not be read, so nothing will be saved or overwritten. You can still look around. Press Export raw data to keep a copy, then restore a backup in Settings or erase everything to start fresh. ',
      h('button', { type: 'button', class: 'btn small', onclick: function () { saveText('stark-warden-raw-data.json', JSON.stringify(store.rawDump(), null, 2), 'application/json'); } }, 'Export raw data'));
  }
  function go(path) { root.location.hash = '#/' + path; }
  function buildNav() {
    var nav = doc.getElementById('nav');
    clear(nav);
    var pref = ['home', 'practice', 'fight', 'check', 'debt', 'scammed', 'family', 'wins', 'hope', 'learn'], es = SW.i18n.lang() === 'es';
    order.slice().sort(function (a, b) { return pref.indexOf(a.name) - pref.indexOf(b.name); }).forEach(function (r) {
      if (r.label) { nav.appendChild(h('a', { href: '#/' + r.name, 'data-nav': r.name }, h('span', { class: 'nav-label', text: es && SW.data.navEs[r.name] ? SW.data.navEs[r.name] : r.label }))); }
    });
  }
  function tabs(items, active, base) {
    return h('nav', { class: 'subtabs', 'aria-label': 'Sections' }, items.map(function (t) {
      return h('a', { href: '#/' + base + '/' + t.id, class: t.id === active ? 'active' : '', 'aria-current': t.id === active ? 'page' : null, text: t.label });
    }));
  }

  /* ---------- settings: theme, large text ---------- */
  function applySettings() {
    var s = store.settings(), r = doc.documentElement;
    if (s.theme === 'light' || s.theme === 'dark') { r.setAttribute('data-theme', s.theme); } else { r.removeAttribute('data-theme'); }
    r.classList.toggle('large', !!s.large);
    if (!root.StarkI18n) { r.setAttribute('lang', s.lang || 'en'); }   /* with js/i18n.js the picker sets lang and dir */
  }

  SW.ui = { h: h, sv: sv, announce: announce, fieldError: fieldError, esReady: esReady, mtBanner: mtBanner, usNote: usNote, updateChrome: updateChrome, clear: clear, form: form, toast: toast, copyText: copyText, saveText: saveText, printEl: printEl, meter: meter, flagList: flagList, notice: notice,
    copyBtn: copyBtn, copyLine: copyLine, disclaimerBar: disclaimerBar, today: today, dateStr: dateStr, table: table, card: card, tabs: tabs, route: route,
    renderRoute: renderRoute, go: go, buildNav: buildNav, applySettings: applySettings, uid: uid, parseHash: parseHash };
  SW.store = store;
})(typeof window !== 'undefined' ? window : globalThis);
