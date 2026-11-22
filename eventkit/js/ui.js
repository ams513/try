/* Stark Event Kit UI helpers: element builder, router, toast, download, shared components. */
(function (g) {
  'use strict';
  var S = g.SEK, UI = S.ui = { routes: {}, cleanups: [] }, doc = g.document;

  UI.h = function (tag, attrs) {
    var e = doc.createElement(tag), k, v, i;
    if (attrs) for (k in attrs) {
      v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else if (k === 'style' && typeof v === 'object') for (var s in v) e.style[s] = v[s];
      else e.setAttribute(k, v === true ? '' : v);
    }
    function add(c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else e.appendChild(c.nodeType ? c : doc.createTextNode(String(c))); }
    for (i = 2; i < arguments.length; i++) add(arguments[i]);
    return e;
  };
  var h = UI.h;
  UI.clear = function (n) { while (n.firstChild) n.removeChild(n.firstChild); return n; };
  UI.$ = function (sel, root) { return (root || doc).querySelector(sel); };

  /* Toast: success is polite and short; a failure (bad, or a "Could not..." message) is an alert that stays 9 s,
     pauses while hovered or focused, and has a close button, so a screen-reader user cannot miss a lost save. */
  var toastTimer = 0, BAD_RE = /^(Could not|That file|Refused|Not saved|Save failed)/;
  UI.toastBad = function (msg, bad) { return bad === true || (bad !== false && BAD_RE.test(String(msg))); };
  UI.toast = function (msg, bad) {
    var t = doc.getElementById('toast'), isBad = UI.toastBad(msg, bad), ms = isBad ? 9000 : 2600;
    if (!t) return;
    function hide() { if (t.matches && (t.matches(':hover') || t.contains(doc.activeElement))) { toastTimer = setTimeout(hide, 1500); return; } t.hidden = true; }
    UI.clear(t);
    t.setAttribute('role', isBad ? 'alert' : 'status'); t.setAttribute('aria-live', isBad ? 'assertive' : 'polite');
    t.classList.toggle('bad', isBad);
    t.appendChild(h('span', { class: 'toast-msg', text: String(msg) }));
    if (isBad) t.appendChild(h('button', { type: 'button', class: 'toast-x', 'aria-label': 'Dismiss message', onclick: function () { clearTimeout(toastTimer); t.hidden = true; } }, '×'));
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(hide, ms);
  };
  var failAt = {};
  S.store.onFail = function (k, why) { var now = Date.now(); if (failAt[k] && now - failAt[k] < 20000) return; failAt[k] = now; UI.toast(why === 'safe' ? 'Not saved: "' + k + '" is in safe mode because its stored copy could not be read. Back up, then restore.' : 'Could not save "' + k + '". Storage may be full: export a backup now.', true); };
  /* Field error linkage: the message gets an id, the control points at it (aria-describedby) and is marked invalid. */
  UI.fieldError = function (control, msg) {
    var id = (control.id || (control.id = 'f-' + Math.random().toString(36).slice(2, 9))) + '-err', old = doc.getElementById(id), p;
    if (old) old.remove();
    var desc = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== id; });
    if (!msg) { control.removeAttribute('aria-invalid'); if (desc.length) control.setAttribute('aria-describedby', desc.join(' ')); else control.removeAttribute('aria-describedby'); return null; }
    p = h('p', { class: 'field-err', id: id, role: 'alert', text: msg });
    control.insertAdjacentElement('afterend', p);
    control.setAttribute('aria-invalid', 'true'); desc.push(id); control.setAttribute('aria-describedby', desc.join(' '));
    try { control.focus(); } catch (e) { /* ignore */ }
    return p;
  };
  UI.download = function (name, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain' }), a = doc.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      UI.toast('Saved ' + name);
    } catch (e) { UI.toast('Could not save the file here. Copy the text from the box instead.'); }
  };
  UI.onLeave = function (fn) { UI.cleanups.push(fn); };
  UI.parse = function () {
    var raw = (g.location.hash || '#/home').replace(/^#\/?/, ''), p = raw.split('?'), q = {};
    (p[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); q[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: p[0] || 'home', q: q };
  };
  UI.go = function (hash) { if (g.location.hash === hash) UI.render(); else g.location.hash = hash; };
  UI.render = function () {
    var r = UI.parse(), main = doc.getElementById('main'), fn = UI.routes[r.name] || UI.routes.home;
    UI.cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
    doc.body.classList.toggle('present', r.name === 'present' || r.name === 'draw' || r.name === 'leaderboard');
    doc.body.classList.toggle('overlay', r.name === 'overlay');
    if (UI.wake) { if (r.name === 'present' || r.name === 'draw' || r.name === 'leaderboard' || r.name === 'overlay') UI.wake.on(); else UI.wake.off(); }
    UI.clear(main);
    Array.prototype.forEach.call(doc.querySelectorAll('[data-nav]'), function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === (UI.routes[r.name] ? r.name : 'home')); });
    try { fn(main, r.q); } catch (e) { main.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Something went wrong' }), h('p', { text: String(e && e.message || e) }))); if (g.console) g.console.error(e); }
    doc.title = ({ present: 'Presenter - ', draw: 'Prize draw - ', leaderboard: 'Leaderboard - ', overlay: 'Stream overlay - ' }[r.name] || '') + 'Stark Event Kit';
  };
  /* small shared pieces for the planning views */
  UI.printHead = function (sub, title) { return h('div', { class: 'printonly' }, h('div', { class: 'brandline', text: 'Stark Event Kit - ' + sub }), h('h2', { text: title })); };
  UI.kpis = function (items) { return h('div', { class: 'kpis' }, items.map(function (x) { return h('div', { class: 'kpi' + (x[2] ? ' ' + x[2] : '') }, h('b', { text: String(x[1]) }), h('span', { text: x[0] })); })); };
  UI.check = function (id, label, checked, on) { return h('div', { class: 'field inline' }, h('input', { type: 'checkbox', id: id, checked: checked, onchange: function (e) { on(e.target.checked); } }), h('label', { for: id, text: label })); };
  UI.readFile = function (input, cb) { var f = input.files && input.files[0]; if (!f) return; if (f.size > 40000000) { UI.toast('That file is too large.'); return; } var fr = new g.FileReader(); fr.onload = function () { cb(String(fr.result)); }; fr.readAsText(f); };
  /* Every printout goes through here: the paper setting is applied, wide pages (data-print="landscape") get a landscape page and anything
     marked data-fit is scaled down to the printable area of the chosen paper, so nothing is cut off and no page is wasted. */
  var PX_MM = 96 / 25.4, HEAD_PX = 70;
  UI.fitPrint = function () {
    var id = S.paper.apply(), a = S.paper.paper(id), MARGIN = S.paper.MARGIN_MM, land = !!doc.querySelector('main [data-print="landscape"]'), aw = ((land ? a.h : a.w) - 2 * MARGIN) * PX_MM, ah = ((land ? a.w : a.h) - 2 * MARGIN) * PX_MM;
    doc.body.classList.toggle('print-land', land);
    [].slice.call(doc.querySelectorAll('main [data-fit]')).forEach(function (el) {
      var k, w, hh, floor = +el.getAttribute('data-fit-min') || 0.5;
      w = Math.max(el.scrollWidth, el.offsetWidth); hh = Math.max(el.scrollHeight, el.offsetHeight);
      k = Math.min(1, aw / w, (ah - HEAD_PX) / hh) * 0.97; if (k < floor) k = Math.min(1, Math.max(floor, aw / w * 0.97));   // very large: fit the width and let the height run on to more pages
      el.style.setProperty('--fit', String(Math.round(k * 1000) / 1000));   // read only by the print rules (zoom: var(--fit))
    });
  };
  g.addEventListener('beforeprint', function () { UI.fitPrint(); });   // Ctrl+P and the browser's own print command get the same fitting
  UI.print = function () { try { UI.fitPrint(); g.print(); } catch (e) { UI.toast('Printing is not available here. Use the browser print command.'); } };

  /* shared components */
  UI.field = function (label, control, id) {
    var wrap = h('div', { class: 'field' });
    if (id) control.id = id; wrap.appendChild(h('label', { for: control.id || id }, label)); wrap.appendChild(control); return wrap;
  };
  UI.select = function (opts, value, onchange) {
    var s = h('select', { onchange: onchange }); opts.forEach(function (o) { var op = h('option', { value: o[0] }, o[1]); if (String(o[0]) === String(value)) op.selected = true; s.appendChild(op); }); return s;
  };
  UI.tabs = function (items, cur, on) {
    return h('div', { class: 'tabs', role: 'tablist' }, items.map(function (it) {
      return h('button', { type: 'button', role: 'tab', 'aria-selected': it[0] === cur ? 'true' : 'false', class: it[0] === cur ? 'on' : '', onclick: function () { on(it[0]); } }, it[1]);
    }));
  };
  UI.diffTag = function (d, pts) { return h('span', { class: 'tag diff-' + d }, d + (pts != null ? ' (' + pts + ' pt' + (pts === 1 ? '' : 's') + ')' : '')); };
  UI.catTag = function (c) { return h('span', { class: 'tag' }, h('span', { class: 'dot', style: { background: S.catColor(c) } }), S.catName(c)); };
  UI.rankLabel = function (r) { return (r.tied ? '=' : '') + r.rank; };
  UI.beep = function (freq, ms) {
    try {
      var C = g.AudioContext || g.webkitAudioContext; if (!C) return; UI._ac = UI._ac || new C();
      var o = UI._ac.createOscillator(), gn = UI._ac.createGain(); o.frequency.value = freq || 660; gn.gain.value = 0.08;
      o.connect(gn); gn.connect(UI._ac.destination); o.start(); o.stop(UI._ac.currentTime + (ms || 250) / 1000);
    } catch (e) { /* audio is optional */ }
  };
  UI.scoreboard = function (s, big) {
    var rows = S.game.standings(s), max = Math.max(1, Math.max.apply(null, s.teams.map(function (t) { return t.score; })));
    if (!big) {
      return h('table', null, h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: 'Team' }), h('th', { text: 'Pts' }), h('th', { text: 'Right' }))),
        h('tbody', null, rows.map(function (r) { return h('tr', null, h('td', { text: UI.rankLabel(r) }), h('td', null, h('span', { class: 'dot', style: { background: r.team.color } }), r.team.name), h('td', { text: String(r.team.score) }), h('td', { text: String(r.team.correct) })); })));
    }
    return h('div', null, rows.map(function (r) {
      var w = Math.max(3, Math.round(Math.max(0, r.team.score) / max * 100));
      return h('div', { class: 'srow' }, h('span', { text: UI.rankLabel(r) }), h('span', { text: r.team.name, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }), h('div', { class: 'sbar' }, h('i', { style: { width: w + '%', background: r.team.color } })), h('span', { text: String(r.team.score) }));
    }));
  };
})(window);
