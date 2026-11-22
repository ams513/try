/* Stark Ledger. Views added in 1.5: the "Tax and currency" settings card, the VAT / GST summary page, and the home-currency display.
   Every figure comes from js/core_tax.js and is arithmetic on rates and exchange rates the person typed. The app ships no country rates, no tax rules and no rate feed.
   Text is set with textContent; nothing touches the network. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, R = L.routes;
  const guard = fn => ev => { try { fn(ev); } catch (e) { L.toast(e.message, true); } };
  const dateInput = (v, id) => L.input({ type: 'date', value: v || C.today(), id });
  const stat = (k, v, sub, cls, id) => h('div', { class: 'card stat', id }, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v), sub ? h('div', { class: 'sub' }, sub) : null);
  const pct = b => (b / 100) + '%';
  /* if an older copy of a core file is still in the browser's cache, say so plainly instead of throwing */
  const READY = ['homeCur', 'applyFormat', 'fmtDoc', 'balanceH', 'symbol', 'setTaxMode'].every(k => typeof C[k] === 'function');
  if (!READY) { R.vat = () => h('div', { class: 'card stack', id: 'vat-stale' }, h('h2', null, 'VAT / GST summary'), h('p', null, 'Some files of this page are out of date in your browser. Reload the page without the cache (Ctrl+F5) and open it again.')); return; }

  /* ---------- Spanish for the new screens (the shared dictionary is extended; user data is never touched) ---------- */
  Object.assign(L.ES || {}, {
    'VAT / GST': 'IVA / GST', 'Sales tax (US)': 'Impuesto sobre ventas (EE. UU.)', 'Tax mode': 'Modo de impuestos',
    'Home currency': 'Moneda propia', 'Number format': 'Formato de números', 'Tax number': 'Número fiscal', 'Rate name': 'Nombre de la tasa', 'Rate %': 'Tasa %', 'Add rate': 'Añadir tasa', 'Your rates': 'Tus tasas',
    'Prices': 'Precios', 'Tax rounding': 'Redondeo del impuesto', 'Prices exclude tax (tax is added)': 'Precios sin impuesto (se suma el impuesto)', 'Prices include tax (tax is inside)': 'Precios con impuesto incluido',
    'Round the tax on each line': 'Redondear el impuesto en cada línea', 'Round the tax once per rate': 'Redondear el impuesto una vez por tasa', 'Tax rate': 'Tasa de impuesto', 'Tax': 'Impuesto', 'No tax': 'Sin impuesto',
    'Net amount': 'Importe neto', 'Net total': 'Total neto', 'Tax total': 'Total de impuestos', 'Tax summary': 'Resumen de impuestos', 'Net': 'Neto', 'Total (includes tax)': 'Total (impuesto incluido)',
    'Unit price (with tax)': 'Precio unitario (con impuesto)', 'Currency': 'Moneda', 'Document currency': 'Moneda del documento', 'Exchange rate': 'Tipo de cambio', 'Tax number: ': 'Número fiscal: ',
    
    'Download CSV': 'Descargar CSV', 'Record a tax payment': 'Registrar un pago de impuestos', 'Tax collected': 'Impuesto cobrado', 'Tax paid': 'Impuesto pagado',
    'Home currency (': 'Moneda propia (', 'Save tax and currency': 'Guardar impuestos y moneda', 'Rate': 'Tasa', 'Sales': 'Ventas', 'Purchases': 'Compras', 'Purchase': 'Compra', 'Sale': 'Venta', 'Rates and rules are yours to set': 'Las tasas y reglas las defines tú',
    'Home currency changed.': 'Moneda propia cambiada.', 'Tax and currency saved.': 'Impuestos y moneda guardados.', 'Realised currency gain (loss)': 'Ganancia (pérdida) cambiaria realizada', 'VAT / GST collected on sales': 'IVA / GST cobrado en ventas',
    'VAT / GST paid on purchases': 'IVA / GST pagado en compras', 'Tax number (optional, printed on their invoices)': 'Número fiscal (opcional, se imprime en sus facturas)', 'Record payment': 'Registrar pago',
    'Tax rates and rules are yours to set. Stark Ledger ships no country rates and no tax rules. This is bookkeeping software, not tax advice: check with a tax professional.': 'Las tasas y reglas de impuestos las defines tú. Stark Ledger no incluye tasas de ningún país ni reglas fiscales. Es un programa de contabilidad, no asesoría fiscal: consulta a un profesional de impuestos.'
  });

  /* ---------- home currency and locale: applied before every screen is drawn; "($)" in labels follows the home currency ---------- */
  const shell0 = L.shellExtras;
  L.shellExtras = function () { C.applyFormat(L.st); if (shell0) shell0.apply(this, arguments); };
  const SYM = /\(\$\)/g;
  function symPass(n) {
    if (C.homeCur() === 'USD' || !n) return; const sym = '(' + C.symbol() + ')';
    if (n.nodeType === 3) { if (n.nodeValue && n.nodeValue.indexOf('($)') >= 0) n.nodeValue = n.nodeValue.replace(SYM, sym); return; }
    if (n.nodeType !== 1) return;
    const els = [n].concat(Array.from(n.querySelectorAll('[placeholder],[aria-label],[title]')));
    els.forEach(el => ['placeholder', 'aria-label', 'title'].forEach(a => { const v = el.getAttribute && el.getAttribute(a); if (v && v.indexOf('($)') >= 0) el.setAttribute(a, v.replace(SYM, sym)); }));
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); const list = []; while (w.nextNode()) list.push(w.currentNode); list.forEach(symPass);
  }
  new MutationObserver(muts => { if (C.homeCur() !== 'USD') muts.forEach(m => m.addedNodes.forEach(symPass)); }).observe(document.body, { childList: true, subtree: true });

  /* ---------- Settings: tax mode, rates, home currency ---------- */
  function taxCard() {
    const st = L.st, s = st.settings, card = h('div', { class: 'card stack', id: 'tax-card' });
    const draw = () => {
      L.clear(card);
      const cur = L.select(C.CURRENCIES.map(c => [c[0], c[0] + ' ' + c[1]]).concat(C.CURRENCIES.some(c => c[0] === s.homeCur) ? [] : [[s.homeCur, s.homeCur]]), s.homeCur || 'USD', { id: 't-cur', 'aria-label': 'Home currency' });
      const other = L.input({ id: 't-cur-other', maxlength: 3, placeholder: 'e.g. CZK', 'aria-label': 'Other currency code' });
      const loc = L.select(C.LOCALES, s.locale || 'en-US', { id: 't-loc', 'aria-label': 'Number format' });
      const mode = L.select([['sales', 'Sales tax (US)'], ['vat', 'VAT / GST']], s.taxMode || 'sales', { id: 't-mode', 'aria-label': 'Tax mode' });
      const incl = L.select([['excl', 'Prices exclude tax (tax is added)'], ['incl', 'Prices include tax (tax is inside)']], s.taxIncl ? 'incl' : 'excl', { id: 't-incl', 'aria-label': 'Prices' });
      const round = L.select([['line', 'Round the tax on each line'], ['doc', 'Round the tax once per rate']], s.taxRound === 'doc' ? 'doc' : 'line', { id: 't-round', 'aria-label': 'Tax rounding' });
      const no = L.input({ value: s.taxNo || '', id: 't-taxno', maxlength: 40, 'aria-label': 'Tax number' });
      const vatBox = h('div', { class: 'stack', id: 't-vat' }), rates = h('div', { class: 'stack', id: 't-rates' });
      const drawRates = () => {
        L.clear(rates); C.vatRates(st).forEach(r => rates.appendChild(h('div', { class: 'row' }, h('span', null, r.name + ' ' + pct(r.bps)), h('button', { type: 'button', class: 'btn ghost sm', 'aria-label': 'Remove rate ' + r.name, onclick: () => { C.removeVatRate(st, r.name); L.save(); drawRates(); } }, 'Remove'))));
        if (!C.vatRates(st).length) rates.appendChild(h('p', { class: 'muted', id: 't-norates' }, 'No rates yet. Stark Ledger ships none: add the rates you charge, for example a name and a percentage.'));
        const nm = L.input({ placeholder: 'Rate name', id: 't-rname', 'aria-label': 'Rate name', maxlength: 40 }), rt = L.input({ placeholder: 'Rate %', inputmode: 'decimal', id: 't-rrate', 'aria-label': 'Rate %' });
        rates.appendChild(h('div', { class: 'row' }, nm, rt, h('button', { type: 'button', class: 'btn sm', id: 't-radd', onclick: guard(() => { const b = C.pctToBps(rt.value); if (isNaN(b)) throw new Error('Enter a rate such as 20 or 7.5.'); C.addVatRate(st, nm.value, b); L.save(); drawRates(); }) }, 'Add rate')));
      };
      const showVat = () => { L.clear(vatBox); if (mode.value !== 'vat') return; vatBox.append(h('div', { class: 'grid2' }, L.field('Prices', incl), L.field('Tax rounding', round)), L.field('Tax number', no, 'Printed on your invoices, for example your VAT or GST registration number.'), h('div', null, h('h3', null, 'Your rates'), rates)); drawRates(); };
      mode.onchange = showVat;
      card.append(h('h2', null, 'Tax and currency'), h('p', { class: 'note', id: 'tax-note' }, C.TAX_NOTE),
        h('div', { class: 'grid3' }, L.field('Home currency', cur, 'The currency the books are kept in. It can change until a document is in another currency.'), L.field('Other currency code', other, 'Only if yours is not in the list.'), L.field('Number format', loc)),
        L.field('Tax mode', mode, 'Sales tax (US) is how Ledger has always worked. VAT / GST applies to new invoices, estimates and bills; documents already made keep the tax they have.'), vatBox,
        h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn primary', id: 't-save', onclick: guard(() => {
          const code = other.value.trim() ? other.value : cur.value; C.setHomeCurrency(st, code); s.locale = loc.value === 'en-US' ? '' : loc.value; C.setTaxMode(st, mode.value);
          if (mode.value === 'vat') { s.taxIncl = incl.value === 'incl'; s.taxRound = round.value; s.taxNo = no.value.trim(); }
          C.applyFormat(st); L.commit(); L.toast('Tax and currency saved.'); }) }, 'Save tax and currency')));
      showVat();
    };
    draw(); return card;
  }
  const settings0 = R.settings; R.settings = function () { const node = settings0.apply(null, arguments);
    if (L.st.settings.taxMode === 'vat') Array.from(node.querySelectorAll('h3')).forEach(x => { if (x.textContent === 'Default tax lines for new invoices' && x.parentNode) x.parentNode.hidden = true; }); const k = node.querySelector('form.card'); if (k && k.nextSibling) node.insertBefore(taxCard(), k.nextSibling); else node.appendChild(taxCard()); return node; };

/* full version only */
})();
