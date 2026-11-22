/* Stark Ledger free trial: the pages the trial leaves out still have their menu entries; each shows a plain card. Trial package only. */
(function () {
  'use strict';
  const T = window.StarkTrial, L = window.L, h = L.h, R = L.routes;
  const page = id => () => h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, T.features[id].title)), T.card(id));
  R.import = page('bank_import');
  R.vat = page('vat_summary');
  R.cover = page('cover');
})();
