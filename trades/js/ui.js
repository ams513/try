/* Stark Trades 2.1. Small DOM helpers shared by every view. Text is always set with textContent, never parsed as HTML. */
(function () {
  'use strict';
  const C = window.StarkCore, t = C.t; const L = window.L = { st: null, routes: {} };

  L.h = function (tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      const v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') el.className = v; else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled' || k === 'hidden') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(x => add(el, x)); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  const h = L.h;
  L.$ = (s, r) => (r || document).querySelector(s);
  L.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  L.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* toasts: good news is polite and short; a problem is an alert that stays at least 10 seconds, has a close button,
     and never hides while the pointer or keyboard focus is on it */
  let toastTimer, toastHold = false;
  L.toast = function (msg, bad) {
    const x = L.$('#toast'); L.clear(x); clearTimeout(toastTimer);
    x.setAttribute('role', bad ? 'alert' : 'status'); x.setAttribute('aria-live', bad ? 'assertive' : 'polite');
    x.appendChild(h('span', { class: 'toast-msg' }, msg)); x.appendChild(h('button', { type: 'button', class: 'toast-x', 'aria-label': t('Close'), onclick: () => { x.hidden = true; } }, '✕'));
    x.className = 'toast' + (bad ? ' bad' : ''); x.hidden = false;
    if (!x.dataset.wired) { x.dataset.wired = '1'; ['mouseenter', 'focusin'].forEach(e => x.addEventListener(e, () => { toastHold = true; })); ['mouseleave', 'focusout'].forEach(e => x.addEventListener(e, () => { toastHold = false; })); }
    const ms = bad ? 10000 : 4000, end = () => { if (toastHold) toastTimer = setTimeout(end, 1000); else x.hidden = true; }; toastTimer = setTimeout(end, ms);
  };
  L.modal = function (title, build, wide) {
    const dlg = L.$('#dlg'); L.clear(dlg); dlg.className = 'dialog' + (wide ? ' wide' : '');
    const close = () => { if (dlg.open) dlg.close(); };
    dlg.appendChild(h('div', { class: 'dlg-head' }, h('h2', { id: 'dlg-title' }, title), h('button', { type: 'button', class: 'btn ghost', 'aria-label': t('Close'), onclick: close }, '✕')));
    dlg.appendChild(build(close)); if (!dlg.open) dlg.showModal(); return close;
  };
  L.confirm = function (msg, yes, onYes, danger) {
    L.modal(t('Please confirm'), close => h('div', { class: 'stack' }, h('p', null, msg),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, t('Cancel')),
        h('button', { type: 'button', class: 'btn ' + (danger ? 'danger' : 'primary'), id: 'confirm-yes', onclick: () => { close(); onYes(); } }, yes))));
  };
  /* a labelled field; a hint is linked to its control with aria-describedby so screen readers read it with the field */
  let fid = 0;
  L.field = function (label, input, hint) {
    let hn = null;
    if (hint) { hn = h('span', { class: 'hint', id: 'hint-' + (++fid) }, hint); if (input && input.setAttribute) input.setAttribute('aria-describedby', ((input.getAttribute('aria-describedby') || '') + ' ' + hn.id).trim()); }
    return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), input, hn);
  };
  /* a field error tied to its control: L.form marks it aria-invalid, links the message and moves focus there */
  L.bad = (el, msg) => { const e = new Error(msg); e.el = el; return e; };
  L.input = attrs => h('input', Object.assign({ type: 'text', autocomplete: 'off' }, attrs));
  L.date = (value, attrs) => h('input', Object.assign({ type: 'date', value: value || '' }, attrs));
  L.money = (value, attrs) => h('input', Object.assign({ type: 'text', inputmode: 'decimal', autocomplete: 'off', value: value == null || value === '' ? '' : (value / 100).toFixed(2), placeholder: '0.00' }, attrs));
  L.area = (value, attrs) => h('textarea', Object.assign({ rows: 3 }, attrs), value || '');
  L.select = function (opts, value, attrs) { const s = h('select', attrs); opts.forEach(o => s.appendChild(h('option', { value: o[0] }, o[1]))); if (value != null) s.value = value; return s; };
  L.check = (label, checked, attrs) => h('label', { class: 'check' }, h('input', Object.assign({ type: 'checkbox', checked: !!checked }, attrs)), h('span', null, label));
  L.table = (head, rows, cls) => h('div', { class: 'scroll' }, h('table', { class: 'tbl ' + (cls || '') }, h('thead', null, h('tr', null, head.map(x => h('th', x && x.cls ? { class: x.cls } : null, x && x.t != null ? x.t : x)))), h('tbody', null, rows)));
  L.num = (txt, cls) => h('td', { class: 'num ' + (cls || '') }, txt);
  L.chip = (txt, kind, title) => h('span', { class: 'chip ' + (kind || ''), title }, txt);
  L.compChip = level => level === 'red' ? L.chip(t('Not compliant'), 'red') : level === 'amber' ? L.chip(t('Attention'), 'amber') : L.chip(t('Compliant'), 'green');
  L.benchChip = b => b ? L.chip(C.benchName(b), b === 'preferred' ? 'green' : b === 'dnu' ? 'red' : 'blue') : null;
  L.trend = tr => h('span', { class: 'trend ' + tr, title: t(C.TREND[tr]) }, tr === 'up' ? '▲ ' : tr === 'down' ? '▼ ' : tr === 'steady' ? '► ' : '', t(C.TREND[tr]));
  L.dot = level => h('span', { class: 'dot ' + level, 'aria-hidden': 'true' });
  /* an empty state says what goes here and carries the button that fills it; L.allClear is good news with nothing to do */
  L.empty = (msg, label, fn, id) => label ? h('div', { class: 'empty-box' }, h('p', { class: 'empty' }, msg), h('button', { type: 'button', class: 'btn', id: id || null, onclick: fn }, label)) : h('p', { class: 'empty' }, msg);
  L.allClear = msg => h('p', { class: 'empty ok' }, msg);
  /* a record that was deleted or never existed: say so and offer the way back */
  L.gone = (msg, href, label) => h('div', { class: 'stack' }, h('h1', null, t('Not found')), h('div', { class: 'empty-box' }, h('p', { class: 'empty' }, msg), h('a', { class: 'btn primary', href }, label)));
  L.err = () => h('p', { class: 'err', role: 'alert' });
  L.stage = k => L.chip(C.stageName(k), 'stage-' + k);
  L.go = hash => { if (location.hash === hash) L.render(); else location.hash = hash; };
  L.commit = function () { window.StarkStore.save(L.st); L.render(); };
  L.save = function () { window.StarkStore.save(L.st); };
  L.cents = function (v, what, allowNeg) { const c = C.toCents(v); if (isNaN(c)) throw new Error(t('Enter {what} as a number, like 1250.00', { what })); if (!allowNeg && c < 0) throw new Error(t('{what} cannot be negative', { what })); return c; };
  L.who = () => [['', t('Unassigned')]].concat(L.st.crew.filter(c => c.active !== false).map(c => ['crew:' + c.id, t('{name} (crew)', { name: c.name })]), L.st.subs.filter(s => s.active !== false).map(s => ['sub:' + s.id, t('{name} (sub)', { name: s.name })]));
  L.parseWho = v => { if (!v) return { t: '', id: '' }; const i = v.indexOf(':'); return { t: v.slice(0, i), id: v.slice(i + 1) }; };
  L.whoVal = w => w && w.t ? w.t + ':' + w.id : '';
  L.tradeOpts = any => (any ? [['', any]] : []).concat(L.st.trades.map(x => [x, C.tt(x)]));
  L.now = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  /* a form wrapper: the privacy guard runs on everything typed, then the save; errors stay in the form */
  L.form = function (attrs, children, onSave) {
    const err = L.err(); err.id = 'form-err-' + (++fid);
    /* the error names its field when it can (L.bad); otherwise the whole form is described by the message */
    const show = e => { err.textContent = (e && e.message) || String(e); const el = e && e.el; if (el && el.setAttribute) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', ((el.getAttribute('aria-describedby') || '').replace(err.id, '') + ' ' + err.id).trim()); try { el.focus(); } catch (x) { /* detached */ } } else f.setAttribute('aria-describedby', err.id); };
    const f = h('form', Object.assign({ class: 'stack', novalidate: true }, attrs, { onsubmit: ev => { ev.preventDefault(); err.textContent = ''; L.$$('[aria-invalid]', f).forEach(i => i.removeAttribute('aria-invalid')); f.removeAttribute('aria-describedby');
      try { const vals = {}; L.$$('input:not([type=checkbox]):not([type=file]):not([type=password]):not([data-noguard]),textarea:not([data-noguard])', f).forEach((i, n) => { vals[i.name || i.id || ('f' + n)] = i.value; }); C.guard(vals); const r = onSave(); if (r && r.then) r.catch(show); }
      catch (e) { show(e); } } }), children, err);
    return f;
  };
  L.actions = (close, saveLabel) => h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, t('Cancel')), h('button', { class: 'btn primary', type: 'submit' }, saveLabel || t('Save')));

  L.download = function (name, data, mime) {
    const url = URL.createObjectURL(new Blob([data], { type: mime || 'text/plain;charset=utf-8' }));
    const a = h('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  L.printText = function (title, text) {
    const root = L.clear(L.$('#print-root')); const co = L.st.company;
    root.appendChild(h('div', { class: 'print-doc' }, h('div', { class: 'print-head' }, h('b', null, co.name || 'Stark Trades'), h('span', null, [co.street, co.city, co.phone].filter(Boolean).join('  ·  '))), h('pre', null, text)));
    document.body.classList.add('printing'); setTimeout(() => { try { window.print(); } finally { document.body.classList.remove('printing'); } }, 50);
  };

  /* the redaction step every plain export goes through: choose what is included, preview it, scrub it, then save or print */
  L.exportFlow = function (title, fields, build, opts) {
    opts = opts || {};
    L.modal(t('Export: {what}', { what: title }), close => {
      const state = {}; fields.forEach(f => { state[f.key] = f.value; });
      const pre = h('textarea', { class: 'preview', readonly: true, rows: 14, id: 'export-preview', 'aria-label': t('Export preview') }), warn = h('p', { class: 'note bad', hidden: true });
      let out = null;
      const refresh = () => {
        try { out = build(state); const text = out.csv ? out.text : C.docText(out); const scrubbed = C.scrub(text); warn.hidden = scrubbed === text; warn.textContent = t('Some numbers that looked like SSNs, tax IDs or card numbers were removed from this export.'); out.final = scrubbed; pre.value = scrubbed; }
        catch (e) { pre.value = e.message; out = null; }
      };
      const ctl = fields.map(f => {
        if (f.choices) { const s = L.select(f.choices, f.value, { onchange: () => { state[f.key] = s.value; refresh(); }, 'data-k': f.key }); return L.field(f.label, s); }
        return L.check(f.label, f.value, { onchange: e => { state[f.key] = e.target.checked; refresh(); }, 'data-k': f.key });
      });
      refresh();
      return h('div', { class: 'stack' },
        h('p', { class: 'muted small' }, t('Redaction: choose what goes in. Customer names and contact details stay out unless you tick them. Check the preview before you share it.')),
        ctl.length ? h('div', { class: 'redact' }, ctl) : null, warn, pre,
        h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, t('Cancel')),
          opts.noPrint ? null : h('button', { type: 'button', class: 'btn', id: 'export-print', onclick: () => { if (out) L.printText(out.title || title, out.final); } }, t('Print / PDF')),
          h('button', { type: 'button', class: 'btn primary', id: 'export-save', onclick: () => { if (!out) return; L.download(out.name, out.final, out.csv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8'); L.toast(t('Saved {name}', { name: out.name })); close(); } }, t('Save file'))));
    }, true);
  };
  L.addressChoice = def => ({ key: 'address', label: t('Site address'), value: def || 'full', choices: [['full', t('Street and city')], ['city', t('City only')], ['none', t('Leave out (give it by phone)')]] });

  /* CSV import with a preview of what will change */
  L.csvImport = function (title, apply) {
    const file = h('input', { type: 'file', accept: '.csv,text/csv', id: 'csv-file' }), out = h('div', { class: 'stack' }), err = L.err();
    L.modal(t('Import {what} from CSV', { what: title }), close => h('div', { class: 'stack' }, h('p', { class: 'muted small' }, t('Use the same columns as the export. Rows with numbers that look like SSNs, tax IDs, bank or card numbers are skipped.')),
      L.field(t('CSV file'), file), err, out,
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, t('Close')), h('button', { type: 'button', class: 'btn primary', id: 'csv-go', onclick: async () => {
        err.textContent = ''; const f = file.files[0]; if (!f) { err.textContent = t('Choose a CSV file.'); return; }
        try { const r = apply(await f.text()); L.save(); L.clear(out).appendChild(h('p', { class: 'note', id: 'csv-result' }, t('{a} added, {u} updated, {s} skipped.', { a: r.added, u: r.updated, s: r.skipped.length })));
          r.skipped.slice(0, 8).forEach(x => out.appendChild(h('p', { class: 'fine' }, t('Row {row}: {reason}', x)))); L.render(); }
        catch (e) { err.textContent = e.message; } } }, t('Import')))), true);
  };

  /* photos: resized (which also drops location data), encrypted, stored locally */
  L.shrink = async function (f) {
    const bmp = await createImageBitmap(f), s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85)); return new Uint8Array(await blob.arrayBuffer());
  };
  L.savePhotos = async function (files) { const ids = []; for (const f of Array.from(files || [])) { try { const id = C.nid(L.st, 'ph'); await window.StarkStore.putPhoto(id, await L.shrink(f)); ids.push(id); } catch (e) { L.toast(t('Could not read {name}', { name: f.name }), true); } } return ids; };
  let urls = [];
  L.freePhotos = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; };
  L.photo = function (id, alt) { const img = h('img', { alt: alt || t('Photo'), class: 'thumb' }); window.StarkStore.getPhoto(id).then(b => { const u = URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })); urls.push(u); img.src = u; }).catch(() => { img.alt = t('Photo missing'); }); return img; };
})();
