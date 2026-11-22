/* Stark Tenancy: UI helpers, local storage, router (the Stark Warden shell). No network calls anywhere in this app. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  var doc = root.document, T = TN.i18n.T;

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

  /* ---------- storage (falls back to memory when the browser blocks it) ---------- */
  var mem = {}, badKeys = {}, PFX = 'stn:';
  function ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function lsGet(k) {
    var st = ls(), r;
    if (st) {
      try {
        r = TN.backup.safeRead(st, k);
        if (r.state === 'corrupt') { badKeys[k] = r.v; } else { delete badKeys[k]; }
        if (r.v != null) { return r.v; }
      } catch (e) { /* fall through to memory */ }
    }
    return k in mem ? mem[k] : null;
  }
  /* crash-safe save: written, read back, previous good copy kept as key.bak. Refused in safe mode unless forced. */
  function lsSet(k, v, force) {
    var st = ls(), ok = true;
    if (!force && safeMode()) { return false; }
    mem[k] = v;
    if (st) {
      try { ok = TN.backup.safeWrite(st, k, v); } catch (e) { ok = false; }
      if (ok) { delete badKeys[k]; } else { toast(T('Could not save on this device. Storage may be full: save a backup in Settings.', 'No se pudo guardar. El espacio puede estar lleno: guarde una copia en Ajustes.'), true); }
    }
    return ok;
  }
  function safeMode() { return Object.keys(badKeys).length > 0; }
  function lsKeys() {
    var out = Object.keys(mem), i, k, st = ls();
    try { for (i = 0; st && i < st.length; i++) { k = st.key(i); if (out.indexOf(k) < 0) { out.push(k); } } } catch (e) { /* none */ }
    return out.filter(function (x) { return x.indexOf(PFX) === 0 && !/\.bak$/.test(x); });
  }
  function lsDel(k) { var st = ls(); delete mem[k]; delete badKeys[k]; try { if (st) { st.removeItem(k); st.removeItem(k + '.bak'); } } catch (e) { /* nothing */ } }
  function rawDump() {
    var o = {}, st = ls(), i, k;
    try { for (i = 0; st && i < st.length; i++) { k = st.key(i); if (k.indexOf(PFX) === 0) { o[k] = st.getItem(k); } } } catch (e) { /* none */ }
    Object.keys(mem).forEach(function (m) { if (!(m in o)) { o[m] = mem[m]; } });
    return { app: 'Stark Tenancy', raw: true, exported: new Date().toISOString(), data: o };
  }
  var DEF = function () { return { theme: 'auto', large: false, lang: 'en', region: '', currency: 'USD', paper: 'auto', profile: 'main', profiles: ['main'], names: { main: 'My tenancy' } }; };
  function cleanSettings(raw) { return TN.backup.cleanSettings(raw, DEF()); }
  var store = {
    settings: function () { try { return cleanSettings(JSON.parse(lsGet(PFX + 'settings') || '{}')); } catch (e) { return DEF(); } },
    cleanSettings: cleanSettings,
    setSettings: function (s) { lsSet(PFX + 'settings', JSON.stringify(s)); },
    profile: function () { return store.settings().profile; },
    key: function (k, p) { return PFX + 'p:' + (p || store.profile()) + ':' + k; },
    get: function (k, d, p) { try { var v = lsGet(store.key(k, p)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v, p) {
      if (TN.trial.on() && TN.trial.isList(k) && Array.isArray(v) && (p || store.profile()) !== 'example' && !TN.trial.allows(store.trialUsed(), store.get(k, [], p).length, v.length)) {
        toast(T('Free trial: ' + TN.trial.CAP + ' saved records are included. Your existing records are safe, and you can still edit, delete and export them. Own it forever to save more.', 'Prueba gratis: se incluyen ' + TN.trial.CAP + ' registros. Sus registros están a salvo y puede editarlos, borrarlos y exportarlos. Compre la app para guardar más.'), true);
        return false;
      }
      return lsSet(store.key(k, p), JSON.stringify(v));
    },
    trialUsed: function () { return TN.trial.used(lsKeys().filter(TN.trial.counted).map(lsGet)); },
    del: function (k) { lsDel(store.key(k)); },
    scan: function () { lsKeys().forEach(lsGet); return safeMode(); },
    safeMode: safeMode, rawDump: rawDump,
    exportAll: function () {
      var o = {};
      lsKeys().forEach(function (k) { o[k] = lsGet(k); });
      return TN.photos.all().then(function (ph) { return TN.backup.seal('Stark Tenancy', TN.data.meta.version, new Date().toISOString(), o, ph); });
    },
    importAll: function (obj) {
      var v = TN.backup.validate(obj), keys, i;
      if (!v.ok) { return Promise.reject(new Error(v.msg)); }
      keys = Object.keys(obj.data);
      for (i = 0; i < keys.length; i++) { if (!lsSet(keys[i], obj.data[keys[i]], true)) { return Promise.reject(new Error('Could not save the restored data on this device. Some entries may not have been written.')); } }
      /* the mime type is taken from the validated data URL, never from the file's own field */
      return (obj.photos || []).reduce(function (p, ph) { return p.then(function () { return TN.photos.put(Object.assign({}, ph, { mime: TN.backup.mimeOf(ph.data) })); }); }, Promise.resolve()).then(function () { return v; });
    },
    removeProfile: function (p) {
      lsKeys().filter(function (k) { return k.indexOf(PFX + 'p:' + p + ':') === 0; }).forEach(lsDel);
      return TN.photos.delProfile(p);
    },
    wipe: function () {
      var st = ls(), i, ks = [];
      lsKeys().forEach(lsDel);
      try { for (i = 0; st && i < st.length; i++) { if (st.key(i).indexOf(PFX) === 0) { ks.push(st.key(i)); } } ks.forEach(function (k) { st.removeItem(k); }); } catch (e) { /* nothing */ }
      mem = {}; badKeys = {};
      return TN.photos.clearAll();
    }
  };

  /* ---------- toast, copy, save, print, modal ---------- */
  var toastTimer = null;
  /* bad = a failure: announced assertively and kept on screen until closed. Success fades, but not while hovered or focused. */
  function toast(msg, bad) {
    var t = doc.getElementById('toast'), x;
    if (!t) { return; }
    clearTimeout(toastTimer);
    clear(t);
    t.setAttribute('role', bad ? 'alert' : 'status'); t.setAttribute('aria-live', bad ? 'assertive' : 'polite');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.appendChild(h('span', { text: msg }));
    x = h('button', { type: 'button', class: 'toast-x', 'aria-label': T('Close message', 'Cerrar mensaje') }, '×');
    x.addEventListener('click', function () { t.hidden = true; });
    t.appendChild(x);
    t.hidden = false;
    if (!bad) { toastTimer = setTimeout(function hide() { if (t.matches(':hover') || t.contains(doc.activeElement)) { toastTimer = setTimeout(hide, 2000); return; } t.hidden = true; }, 5000); }
  }
  function copyText(text, msg) {
    function fallback() {
      var ta = h('textarea', { class: 'offscreen' }); ta.value = text; doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy'); toast(msg || T('Copied.', 'Copiado.')); } catch (e) { toast(T('Could not copy. Select the text and copy it yourself.', 'No se pudo copiar. Seleccione el texto y cópielo.'), true); }
      doc.body.removeChild(ta);
    }
    try {
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) { root.navigator.clipboard.writeText(text).then(function () { toast(msg || T('Copied.', 'Copiado.')); }, fallback); }
      else { fallback(); }
    } catch (e) { fallback(); }
  }
  function saveText(name, text, mime) {
    try {
      var blob = new root.Blob([text], { type: mime || 'text/plain;charset=utf-8' }), url = root.URL.createObjectURL(blob), a = h('a', { href: url, download: name });
      doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
      setTimeout(function () { root.URL.revokeObjectURL(url); }, 4000);
      toast(T('Saved ', 'Guardado ') + name + T(' (check your downloads).', ' (revise sus descargas).'));
    } catch (e) { toast(T('Saving is blocked here. Use Copy instead.', 'Guardar está bloqueado aquí. Use Copiar.'), true); }
  }
  function printEl(el) {
    el.classList.add('print-area');
    try { root.print(); } catch (e) { toast(T('Printing is blocked here. Open the app in your browser to print.', 'Imprimir está bloqueado aquí. Abra la app en su navegador.'), true); }
    setTimeout(function () { el.classList.remove('print-area'); }, 600);
  }
  function modal(title, body) {
    var prev = doc.activeElement, box, close;
    function onKey(e) { if (e.key === 'Escape') { close(); } }
    close = function () { doc.removeEventListener('keydown', onKey); if (box.parentNode) { box.parentNode.removeChild(box); } if (prev && prev.focus) { prev.focus(); } };
    box = h('div', { class: 'overlay', onclick: function (e) { if (e.target === box) { close(); } } },
      h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'row between dlg-head' }, h('h3', { text: title }), h('button', { type: 'button', class: 'btn small', onclick: function () { close(); } }, T('Close', 'Cerrar'))), body));
    doc.body.appendChild(box);
    doc.addEventListener('keydown', onKey);
    box.querySelector('button').focus();
    return close;
  }

  /* ---------- forms ---------- */
  var fid = 0;
  function form(defs, vals) {
    var inputs = {}, el = h('div', { class: 'form' });
    vals = vals || {};
    defs.forEach(function (d) {
      var inp, id = 'f' + (++fid), label, wrap;
      if (d.type === 'textarea') { inp = h('textarea', { id: id, rows: d.rows || 3, placeholder: d.ph || '' }); }
      else if (d.type === 'select') { inp = h('select', { id: id }, (d.options || []).map(function (o) { return h('option', { value: typeof o === 'string' ? o : o.v }, typeof o === 'string' ? o : o.l); })); }
      else if (d.type === 'checkbox') { inp = h('input', { id: id, type: 'checkbox' }); }
      else { inp = h('input', { id: id, type: d.type === 'money' ? 'text' : (d.type || 'text'), placeholder: d.ph || '', inputmode: d.type === 'money' || d.type === 'number' ? 'decimal' : null, step: d.type === 'number' ? 'any' : null, min: d.min, max: d.max, autocomplete: 'off' }); }
      if (d.type === 'checkbox') { inp.checked = vals[d.id] === true || vals[d.id] === 'yes'; } else if (vals[d.id] != null) { inp.value = vals[d.id]; }
      inputs[d.id] = inp;
      label = h('label', { for: id }, d.label);
      wrap = h('div', { class: 'field' + (d.type === 'checkbox' ? ' check' : '') + (d.wide || d.type === 'textarea' ? ' wide' : '') });
      if (d.type === 'checkbox') { append(wrap, [inp, label]); } else { append(wrap, [label, inp]); }
      if (d.hint) { wrap.appendChild(h('div', { class: 'hint', id: id + '-hint', text: d.hint })); inp.setAttribute('aria-describedby', id + '-hint'); }
      wrap.appendChild(h('div', { class: 'field-err', id: id + '-err' }));
      el.appendChild(wrap);
    });
    return {
      el: el, inputs: inputs,
      /* error(key, msg): shows msg under the field, links it with aria-describedby, sets aria-invalid and focuses it; msg '' clears */
      error: function (k, msg) {
        var inp = inputs[k], e = inp && doc.getElementById(inp.id + '-err'), hint = inp && doc.getElementById(inp.id + '-hint');
        if (!inp || !e) { return; }
        e.textContent = msg || '';
        if (msg) { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', (hint ? hint.id + ' ' : '') + e.id); inp.focus(); }
        else { inp.removeAttribute('aria-invalid'); if (hint) { inp.setAttribute('aria-describedby', hint.id); } else { inp.removeAttribute('aria-describedby'); } }
      },
      read: function () { var o = {}; Object.keys(inputs).forEach(function (k) { o[k] = inputs[k].type === 'checkbox' ? inputs[k].checked : inputs[k].value; }); return o; }
    };
  }

  /* ---------- shared pieces ---------- */
  function notice(text, kind) { return h('div', { class: 'notice ' + (kind || ''), role: kind === 'warn' ? 'note' : null }, text); }
  function copyBtn(getText, label) { return h('button', { type: 'button', class: 'btn small', onclick: function () { copyText(typeof getText === 'function' ? getText() : getText); } }, label || T('Copy', 'Copiar')); }
  function copyLine(text) { return h('div', { class: 'copyline' }, h('code', { text: text }), copyBtn(text)); }
  function legal() { var m = TN.data.meta; return notice(T(m.notLegal, m.notLegalEs) + ' ' + T(m.general, m.generalEs), 'legal'); }
  function today() { return TN.dates.today(); }
  function table(head, rows, cls) {
    return h('div', { class: 'tablewrap' }, h('table', { class: cls || '' }, h('thead', null, h('tr', null, head.map(function (x) { return h('th', { scope: 'col', text: x }); }))),
      h('tbody', null, rows.map(function (r) { return h('tr', { class: r.cls || null }, (r.cells || r).map(function (c) { return h('td', null, c); })); }))));
  }
  function card(title, kids, cls) { return h('section', { class: 'card ' + (cls || '') }, title ? h('h3', { text: title }) : null, kids); }
  function badge(text, cls) { return h('span', { class: 'badge ' + (cls || ''), text: text }); }
  function stats(items) { return h('div', { class: 'stats' }, items.map(function (x) { return h('div', { class: x[2] || '' }, h('strong', { text: x[0] }), h('span', { text: x[1] })); })); }
  function choice(name, opts, cur, onPick) {
    return h('div', { class: 'bigchoices', role: 'radiogroup', 'aria-label': name }, opts.map(function (o) {
      return h('button', { type: 'button', class: 'bigchoice' + (cur === o[0] ? ' on' : ''), role: 'radio', 'aria-checked': cur === o[0] ? 'true' : 'false', onclick: function () { onPick(o[0]); } }, o[1]);
    }));
  }
  function ticks(list, state, onChange) {
    return h('div', { class: 'tickgrid' }, list.map(function (x) {
      var id = 'tk-' + x[0] + '-' + (++fid);
      return h('label', { class: 'tick' + (state[x[0]] ? ' on' : ''), for: id }, h('input', { type: 'checkbox', id: id, checked: !!state[x[0]], onchange: function (e) { state[x[0]] = e.target.checked; e.target.parentNode.classList.toggle('on', e.target.checked); if (onChange) { onChange(); } } }), h('span', { text: x[1] }));
    }));
  }
  function hero(title, lead, small) { return h('section', { class: 'hero2' + (small ? ' small-hero' : '') }, h('h1', { text: title }), lead ? h('p', { class: 'lead', text: lead }) : null); }
  function empty(text) { return h('p', { class: 'empty', text: text }); }

  /* ---------- photos on screen: loaded from the device store, shown as data: images only ---------- */
  function photoImg(id, alt, cls) {
    var img = h('img', { class: (cls || 'thumb') + ' loading', alt: alt || T('Photo', 'Foto') });
    TN.photos.get(id).then(function (p) {
      if (!p) { img.classList.add('missing'); img.setAttribute('alt', T('Photo not on this device', 'Foto no está en este dispositivo')); return; }
      img.setAttribute('src', p.data); img.classList.remove('loading');
      img.setAttribute('title', T('Added ', 'Agregada ') + TN.dates.stamp(p.addedAt) + (p.taken ? T(' · Camera date ', ' · Fecha de cámara ') + TN.dates.stamp(p.taken) : ''));
    });
    return img;
  }
  function photoInfo(id) {
    var box = h('div', { class: 'photoinfo' }, photoImg(id, '', 'big'));
    TN.photos.get(id).then(function (p) {
      if (!p) { return; }
      box.appendChild(h('dl', { class: 'kv' },
        h('dt', { text: T('Added to the app (this device’s clock)', 'Agregada a la app (reloj de este dispositivo)') }), h('dd', { text: TN.dates.stamp(p.addedAt) }),
        h('dt', { text: T('Camera date (read from the file)', 'Fecha de la cámara (leída del archivo)') }), h('dd', { text: p.taken ? TN.dates.stamp(p.taken) : T('Not in the file', 'No viene en el archivo') }),
        h('dt', { text: T('File date (last modified, as the browser reports it)', 'Fecha del archivo (última modificación, según el navegador)') }), h('dd', { text: p.fileDate ? TN.dates.stamp(p.fileDate) : '—' }),
        h('dt', { text: 'SHA-256' }), h('dd', null, h('code', { text: p.hash }))));
      box.appendChild(h('p', { class: 'small', text: T('The date strip on the picture always shows when the photo was added, and also the camera date when the file carried one (JPEG photos usually do; PNG pictures, screenshots and photos with their data removed do not). A camera date is only as right as the camera’s clock, and anyone can edit it. Neither date is proof of when the photo was taken. The app keeps a resized copy, not the original file: keep the originals too.', 'La franja de fecha de la imagen siempre muestra cuándo se agregó la foto y, si el archivo la traía, también la fecha de la cámara (las fotos JPEG suelen traerla; las imágenes PNG, las capturas de pantalla y las fotos sin sus datos no). La fecha de la cámara solo es tan correcta como el reloj de la cámara, y cualquiera puede editarla. Ninguna de las dos fechas prueba cuándo se tomó la foto. La app guarda una copia reducida, no el archivo original: guarde también los originales.') }));
    });
    return box;
  }
  function photoGrid(ids, onDelete) {
    return h('div', { class: 'photos' }, (ids || []).map(function (id) {
      return h('figure', { class: 'ph' }, h('button', { type: 'button', class: 'phbtn', 'aria-label': T('Open photo', 'Abrir foto'), onclick: function () { modal(T('Photo details', 'Detalles de la foto'), photoInfo(id)); } }, photoImg(id)),
        onDelete ? h('button', { type: 'button', class: 'btn small danger phdel', onclick: function () { onDelete(id); } }, T('Remove', 'Quitar')) : null);
    }));
  }
  /* a button that opens the camera or file picker; each picture is shrunk, stamped and stored, then onAdd(record) runs */
  function photoPicker(label, photoLabel, onAdd) {
    var inp = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only' }), lbl;
    inp.addEventListener('change', function () {
      var files = Array.prototype.slice.call(inp.files || []), n = 0;
      files.reduce(function (p, f) {
        return p.then(function () { return TN.photos.fromFile(f, typeof photoLabel === 'function' ? photoLabel() : photoLabel, store.profile()).then(function (rec) { n++; onAdd(rec); }); });
      }, Promise.resolve()).then(function () { if (n) { toast(n === 1 ? T('Photo added with today’s date.', 'Foto agregada con la fecha de hoy.') : n + T(' photos added with today’s date.', ' fotos agregadas con la fecha de hoy.')); } }, function (e) { toast(e.message, true); });
      inp.value = '';
    });
    lbl = h('label', { class: 'btn photo-add' }, inp, h('span', { text: label }));
    return lbl;
  }

  /* ---------- router ---------- */
  var routes = {}, order = [], esOk = false;
  function route(name, label, fn) { routes[name] = fn; order.push({ name: name, label: label }); }
  function parseHash() {
    var p = String(root.location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    return { name: p[0] || 'home', args: p.slice(1) };
  }
  function esReady() { esOk = true; }
  function updateChrome() {
    var es = TN.i18n.lang() === 'es', lb = doc.getElementById('langbtn'), gear = doc.querySelector('.gear'), ft = doc.getElementById('foot-line'), sk = doc.getElementById('skip-link'), ver = doc.getElementById('ver');
    if (lb) { lb.textContent = es ? 'English' : 'Español'; lb.setAttribute('lang', es ? 'en' : 'es'); }
    if (gear) { gear.textContent = es ? 'Ajustes' : 'Settings'; }
    if (ft) { ft.textContent = es ? 'Funciona sin conexión. Nada de lo que escribe sale de este dispositivo.' : 'Works offline. Nothing you enter leaves this device.'; }
    if (sk) { sk.textContent = es ? 'Saltar al contenido' : 'Skip to content'; }
    if (ver) { ver.textContent = 'v' + TN.data.meta.version + (es ? ' · información revisada el ' : ' · information checked ') + TN.dates.pretty(TN.data.meta.asOf); }
    if (TN.chrome) { TN.chrome(); }
  }
  function renderRoute() {
    var main = doc.getElementById('main'), r = parseHash(), fn = routes[r.name] || routes.home, s = store.settings();
    clear(main);
    esOk = false;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-nav]'), function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === (routes[r.name] ? r.name : 'home')); });
    try { fn(main, r.args); } catch (e) { main.appendChild(notice('Something went wrong drawing this page: ' + e.message, 'warn')); if (root.console) { root.console.error(e); } }
    if (TN.i18n.lang() === 'es') { main.insertBefore(h('div', { class: 'notice soft mt', lang: 'es' }, esOk ? TN.data.meta.mtEs : TN.data.meta.onlyEnEs + ' ' + TN.data.meta.mtEs), main.firstChild); }
    if (s.profile === 'example') { main.insertBefore(h('div', { class: 'example-ribbon', role: 'note' }, h('strong', { text: T('Example data. ', 'Datos de ejemplo. ') }), T('Names, places, amounts and photos are made up. Switch to your own tenancy in Settings.', 'Nombres, lugares, montos y fotos son inventados. Cambie a su propio arrendamiento en Ajustes.')), main.firstChild); }
    updateChrome();
    if (store.safeMode()) { main.insertBefore(safeBanner(), main.firstChild); }
    main.focus({ preventScroll: true });
    root.scrollTo(0, 0);
  }
  function safeBanner() {
    return h('div', { class: 'notice warn', role: 'alert' }, h('strong', { text: 'Safe mode: read-only. ' }),
      'Some saved data on this device could not be read, so nothing will be saved or overwritten. Press Export raw data to keep a copy, then restore a backup in Settings or erase everything to start fresh. ',
      h('button', { type: 'button', class: 'btn small', onclick: function () { saveText('stark-tenancy-raw-data.json', JSON.stringify(store.rawDump(), null, 2), 'application/json'); } }, 'Export raw data'));
  }
  function go(path) { root.location.hash = '#/' + path; }
  function buildNav() {
    var nav = doc.getElementById('nav'), es = TN.i18n.lang() === 'es';
    clear(nav);
    order.forEach(function (r) { if (r.label) { nav.appendChild(h('a', { href: '#/' + r.name, 'data-nav': r.name }, h('span', { class: 'nav-label', text: es && TN.data.navEs[r.name] ? TN.data.navEs[r.name] : r.label }))); } });
  }
  function tabs(items, active, base) {
    return h('nav', { class: 'subtabs', 'aria-label': T('Sections', 'Secciones') }, items.map(function (t) {
      return h('a', { href: '#/' + base + '/' + t.id, class: t.id === active ? 'active' : '', 'aria-current': t.id === active ? 'page' : null, text: t.label });
    }));
  }
  function applySettings() {
    var s = store.settings(), r = doc.documentElement;
    if (s.theme === 'light' || s.theme === 'dark') { r.setAttribute('data-theme', s.theme); } else { r.removeAttribute('data-theme'); }
    r.classList.toggle('large', !!s.large);
    r.classList.toggle('paper-a4', s.paper === 'a4'); r.classList.toggle('paper-letter', s.paper === 'letter');
    TN.fmt.configure(s);
    r.setAttribute('lang', s.lang === 'es' ? 'es' : 'en');
    TN.i18n.setLang(s.lang);
  }

  TN.ui = { h: h, clear: clear, form: form, toast: toast, copyText: copyText, saveText: saveText, printEl: printEl, modal: modal, notice: notice, copyBtn: copyBtn, copyLine: copyLine, legal: legal,
    today: today, table: table, card: card, badge: badge, stats: stats, choice: choice, ticks: ticks, hero: hero, empty: empty, photoImg: photoImg, photoGrid: photoGrid, photoPicker: photoPicker, photoInfo: photoInfo,
    tabs: tabs, route: route, renderRoute: renderRoute, go: go, buildNav: buildNav, applySettings: applySettings, parseHash: parseHash, esReady: esReady, updateChrome: updateChrome };
  TN.store = store;
})(typeof window !== 'undefined' ? window : globalThis);
