/* Stark Event Kit FREE TRIAL layer. Shipped only in dist/<Name>_trial_web.zip (as js/trial.js). One limit: up to 15
   guests on the guest list. Never time-limited; it never deletes or hides data; backups and CSV exports are complete,
   and restore into the paid app unchanged. No network calls: the buy button is a plain link the person clicks. */
(function (g) {
  'use strict';
  var S = g.SEK, T = S.TRIAL = { limit: 15, buyUrl: ['https:', '', 'ams513.itch.io', 'stark-event-kit'].join('/'), buyText: 'Own it forever: buy on itch.io' };
  /* Booked guests that count against the limit (cancelled ones free their place). */
  T.used = function (G) { return G && Array.isArray(G.people) ? G.people.filter(function (p) { return p.status !== 'cancelled'; }).length : 0; };
  T.full = function (G) { return T.used(G) >= T.limit; };
  T.message = function () { return 'Free trial limit: ' + T.limit + ' guests. Your data is safe and exports in full. Buy the full kit on itch.io to add more.'; };
  var add = S.reg.add;
  S.reg.add = function (G, o, now) {
    if (T.full(G)) return { error: T.message() };
    return add.call(S.reg, G, o, now);
  };
  if (!g.document) return;
  var doc = g.document, UI = S.ui, h = UI.h;
  function buy(cls) { return h('a', { class: 'btn primary ' + (cls || ''), href: T.buyUrl, target: '_blank', rel: 'noopener noreferrer', text: T.buyText }); }
  function used() { var G = S.store.get('guests', null); return T.used(G); }
  var badge = h('span', { class: 'trial-badge', id: 'trial-badge', title: 'This is the free trial: up to ' + T.limit + ' guests' }, 'Free trial');
  var count = h('span', { class: 'trial-count', id: 'trial-count' });
  var bar = h('div', { class: 'trial-bar noprint', id: 'trial-bar' }, badge, count, buy('small'));
  var topbar = doc.getElementById('topbar'), footer = doc.getElementById('footer');
  function refresh() { count.textContent = used() + ' of ' + T.limit + ' guests used. ' + ((g.StarkTrial || {}).notIncluded || '') + ' Backups export in full.'; }
  if (topbar) topbar.parentNode.insertBefore(bar, topbar.nextSibling);
  if (footer) footer.appendChild(h('p', { class: 'fine', id: 'trial-foot' }, 'Free trial: carry your data into the full kit with "Back up or restore", then restore it there. ', buy('small')));
  refresh();
  g.addEventListener('hashchange', refresh);
  S.store.onSaved = (function (prev) { return function (k) { if (k === 'guests') refresh(); if (typeof prev === 'function') prev(k); }; })(S.store.onSaved);
  doc.title = doc.title + ' (Free trial)';
  var render = UI.render;
  UI.render = function () { render.apply(UI, arguments); doc.title = doc.title.replace(/ \(Free trial\)$/, '') + ' (Free trial)'; refresh(); };
})(window);
