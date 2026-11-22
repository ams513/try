/* Stark Ledger. Small DOM helpers shared by every view. Text is always set with textContent, never innerHTML. */
(function () {
  'use strict';
  const C = window.StarkCore; const L = window.L = { st: null, routes: {}, nav: [] };

  L.h = function (tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      const v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled' || k === 'hidden') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(x => add(el, x)); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  const h = L.h;
  L.$ = (s, r) => (r || document).querySelector(s);
  L.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  L.fmt = C.fmt;
  L.esc = s => s;

  /* toast: good news is polite and leaves after 3 s; a problem is an alert, stays at least 8 s, has a close button and never hides while hovered or focused */
  let toastTimer, toastHold = false;
  const hideToast = () => { const t = L.$('#toast'); if (toastHold) { toastTimer = setTimeout(hideToast, 1000); return; } t.hidden = true; };
  L.toast = function (msg, bad, sticky) {
    const t = L.$('#toast'); if (!t.dataset.wired) { t.dataset.wired = '1'; ['pointerenter', 'focusin'].forEach(e => t.addEventListener(e, () => { toastHold = true; })); ['pointerleave', 'focusout'].forEach(e => t.addEventListener(e, () => { toastHold = false; })); }
    t.setAttribute('role', bad ? 'alert' : 'status'); t.setAttribute('aria-live', bad ? 'assertive' : 'polite');
    L.clear(t).append(h('span', { class: 'toast-msg' }, String(msg)), h('button', { type: 'button', class: 'toast-x', 'aria-label': 'Dismiss message', onclick: () => { toastHold = false; t.hidden = true; } }, '✕'));
    t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastTimer); if (!sticky) toastTimer = setTimeout(hideToast, bad ? 8000 : 3000);
  };

  L.modal = function (title, build, wide) {
    const dlg = L.$('#dlg'); L.clear(dlg); dlg.className = 'dialog' + (wide ? ' wide' : '');
    const close = () => { if (dlg.open) dlg.close(); };
    dlg.appendChild(h('div', { class: 'dlg-head' }, h('h2', { id: 'dlg-title' }, title), h('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Close', onclick: close }, '✕')));
    dlg.appendChild(build(close)); if (!dlg.open) dlg.showModal(); return close;
  };
  L.confirm = function (msg, yes, onYes, danger) {
    L.modal('Please confirm', close => h('div', { class: 'stack' }, h('p', null, msg),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'),
        h('button', { type: 'button', class: 'btn ' + (danger ? 'danger' : 'primary'), id: 'confirm-yes', onclick: () => { close(); onYes(); } }, yes))));
  };
  let fid = 0;
  L.field = function (label, input, hint) { // a hint is linked to its control with aria-describedby
    let hn = null; if (hint) { hn = h('span', { class: 'hint', id: 'hint-' + (++fid) }); if (hint.nodeType) hn.appendChild(hint); else hn.textContent = hint; if (input && input.setAttribute) input.setAttribute('aria-describedby', ((input.getAttribute('aria-describedby') || '') + ' ' + hn.id).trim()); }
    return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), input, hn);
  };
  /* field errors: the message element gets an id, the control points at it and is marked invalid, and focus moves to it */
  L.invalid = function (input, errEl, msg) {
    if (!errEl.id) errEl.id = 'err-' + (++fid); errEl.textContent = msg;
    if (input) { input.setAttribute('aria-invalid', 'true'); const d = (input.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== errEl.id); d.push(errEl.id); input.setAttribute('aria-describedby', d.join(' ')); try { input.focus(); } catch (e) { /* detached */ } }
  };
  L.valid = function (input, errEl) { if (errEl) errEl.textContent = ''; if (input) input.removeAttribute('aria-invalid'); };
  L.input = (attrs) => h('input', Object.assign({ type: 'text', autocomplete: 'off' }, attrs));
  L.moneyInput = (value, attrs) => h('input', Object.assign({ type: 'text', inputmode: 'decimal', autocomplete: 'off', value: value == null ? '' : (value / 100).toFixed(2), placeholder: '0.00' }, attrs));
  L.select = function (opts, value, attrs) { // opts: [[value, label]] or [{group, items}]
    const s = h('select', attrs);
    opts.forEach(o => { if (o.group) s.appendChild(h('optgroup', { label: o.group }, o.items.map(i => h('option', { value: i[0], selected: i[0] === value }, i[1])))); else s.appendChild(h('option', { value: o[0], selected: o[0] === value }, o[1])); });
    if (value != null) s.value = value; return s;
  };
  L.cats = function (kind) { // category options for money in / out / all
    const A = L.st.accounts; const pick = t => A.filter(a => a.type === t).map(a => [a.id, a.name + (a.sc ? ' (Sch C ' + a.sc + ')' : '')]);
    const owner = [[C.CONTRIB, "Owner's contribution (not income)"], [C.DRAW, "Owner's draw (not an expense)"]];
    if (kind === 'in') return [{ group: 'Income', items: pick('income') }, { group: 'Owner', items: [owner[0]] }];
    if (kind === 'out') return [{ group: 'Expenses', items: pick('expense') }, { group: 'Owner', items: [owner[1]] }];
    return [{ group: 'Income', items: pick('income') }, { group: 'Expenses', items: pick('expense') }];
  };
  L.table = function (head, rows, cls) {
    return h('div', { class: 'scroll' }, h('table', { class: 'tbl ' + (cls || '') }, h('thead', null, h('tr', null, head.map(x => h('th', typeof x === 'object' && !x.nodeType ? { class: x.cls } : null, typeof x === 'object' && !x.nodeType ? x.t : x)))), h('tbody', null, rows)));
  };
  /* long lists: build and show 200 rows at a time, with a button for the next 200 */
  L.PAGE = 200;
  L.lazyTable = function (head, list, rowFn, cls) {
    const wrap = L.table(head, [], cls), body = wrap.querySelector('tbody'); let shown = 0; const more = h('div', { class: 'row more-row' });
    const step = () => { const next = list.slice(shown, shown + L.PAGE); next.forEach((x, i) => body.appendChild(rowFn(x, shown + i))); shown += next.length; L.clear(more);
      if (shown < list.length) more.appendChild(h('button', { type: 'button', class: 'btn sm', onclick: () => { step(); if (L.tr) L.tr(body); } }, 'Show ' + Math.min(L.PAGE, list.length - shown) + ' more (' + shown + ' of ' + list.length + ' shown)')); };
    step(); return h('div', null, wrap, more);
  };
  L.num = (txt, cls) => h('td', { class: 'num ' + (cls || '') }, txt);
  L.chip = (txt, kind) => h('span', { class: 'chip ' + (kind || '') }, txt);
  L.download = function (name, data, mime) {
    const url = URL.createObjectURL(new Blob([data], { type: mime || 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  L.guide = (msg) => h('p', { class: 'note' }, h('b', null, 'Guide only. '), msg || 'Not tax advice. Check with a tax professional.');
  L.client = id => L.st.clients.find(c => c.id === id);
  L.commit = function () { window.StarkStore.save(L.st); L.render(); };
  L.save = function () { window.StarkStore.save(L.st); };
  L.go = hash => { if (location.hash === hash) L.render(); else location.hash = hash; };
  L.year = () => +C.today().slice(0, 4);
  L.rangeFor = function (kind, year) { year = year || L.year(); const t = C.today(); const q = Math.floor((+t.slice(5, 7) - 1) / 3);
    if (kind === 'year') return [year + '-01-01', year + '-12-31']; if (kind === 'ytd') return [t.slice(0, 4) + '-01-01', t];
    if (kind === 'quarter') { const m = q * 3 + 1; return [t.slice(0, 4) + '-' + String(m).padStart(2, '0') + '-01', C.addDays(C.addMonths(t.slice(0, 4) + '-' + String(m).padStart(2, '0') + '-01', 3), -1)]; }
    return [year + '-01-01', year + '-12-31']; };
})();
