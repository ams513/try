/* Stark Trades free trial: the pages and buttons of the full-version-only features show a plain card. Trial package only. */
(function () {
  'use strict';
  var C = window.StarkCore, L = window.L, T = window.StarkTrial, h = L.h, t = C.t;
  var page = function (title, id) {
    return function () { return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, t(title))), T.card(id)); };
  };
  L.routes.docs = page('Quotes and invoices', 'documents');
  L.routes.quote = L.routes.docs;
  L.routes.invoice = L.routes.docs;
  L.routes.accounting = page('Accounting export', 'exchange');
  L.priceImport = function () { T.show('exchange'); };
  L.priceUndoButton = function () { return null; };
  var navIn = function () {
    var nav = L.NAV, at = nav ? nav.findIndex(function (x) { return x[0] === 'docs'; }) : -1;
    if (at >= 0 && !nav.some(function (x) { return x[0] === 'accounting'; })) nav.splice(at + 1, 0, ['accounting', 'Accounting export']);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', navIn); else navIn();
})();
