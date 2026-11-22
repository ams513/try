/* Stark Ledger free trial: the pages the trial leaves out still have their menu entries; each shows a plain card. Trial package only. */
(function () {
  'use strict';
  const T = window.StarkTrial, L = window.L, h = L.h, R = L.routes;
  const page = id => () => h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, T.features[id].title)), T.card(id));
  R.import = page('bank_import');
  R.vat = page('vat_summary');
  R.cover = page('cover');
  const trialInvPrev = R.invoice; // the e-invoice button stays on an issued invoice and opens the card
  R.invoice = function () {
    const node = trialInvPrev.apply(this, arguments), inv = L.st.invoices.find(i => i.id === arguments[0]);
    if (!inv || inv.status !== 'issued' || !node || !node.querySelector) return node;
    (node.querySelector('.invgrid > .card') || node).appendChild(h('div', { class: 'stack no-print' }, h('button', { type: 'button', class: 'btn', id: 'einv', onclick: () => T.show('einvoice') }, 'E-invoice file (UBL XML)')));
    return node;
  };
})();
