/* Stark Ledger. Views added in 1.1: estimates, bills and purchase orders, vendors, products and stock, time, payment reminders
   and statements, recurring invoices, sales tax, budgets, cash forecast, balance sheet, year-end close and the accountant package. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, R = L.routes;
  const guard = fn => ev => { try { fn(ev); } catch (e) { L.toast(e.message, true); } };
  const guardAsync = fn => async ev => { try { await fn(ev); } catch (e) { L.toast(e.message, true); } };
  const dateInput = (v, id) => L.input({ type: 'date', value: v || C.today(), id });
  const parseMoney = (s, what) => { const c = C.toCents(s); if (isNaN(c)) throw new Error(what + ' is not a valid amount'); return c; };
  const parseQty = (s, what) => { const q = C.qtyToMilli(String(s).trim() || '0'); if (isNaN(q)) throw new Error(what + ' is not a valid quantity'); return q; };
  const head = (title, ...right) => h('div', { class: 'page-head' }, h('h1', null, title), right.length ? h('div', { class: 'row' }, right) : null);
  const btns = (...b) => h('div', { class: 'row end' }, b);
  const cancel = close => h('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel');
  const empty = msg => h('p', { class: 'muted' }, msg);
  const stat = (k, v, sub, cls, id) => h('div', { class: 'card stat', id }, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v), sub ? h('div', { class: 'sub' }, sub) : null);
  const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
  const notFound = (what, back) => h('p', null, 'Not found. ', h('a', { href: back }, 'Go back'));
  const vendor = id => L.st.vendors.find(v => v.id === id) || { name: '?' };
  const sign = v => v < 0 ? 'neg' : v > 0 ? 'pos' : '';
  const EST_CHIP = { draft: '', sent: 'blue', accepted: 'green', declined: 'red', expired: 'amber', invoiced: 'dim' };
  const BILL_CHIP = { draft: '', open: 'blue', partial: 'amber', overdue: 'red', paid: 'green', void: 'dim' };
  const PO_CHIP = { draft: '', sent: 'blue', billed: 'green', cancelled: 'dim' };
  const FREQ = [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['quarterly', 'Every 3 months'], ['yearly', 'Yearly']];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sideDoc = (title, back, paper, side) => h('div', { class: 'stack' }, h('div', { class: 'page-head no-print' }, h('h1', null, title), h('a', { class: 'btn', href: back }, 'Back')), h('div', { class: 'invgrid' }, paper, side));

  /* ---------- estimates ---------- */
  R.estimates = function () {
    const st = L.st, t = C.today(); const sel = L.select([['all', 'All'], ['draft', 'Draft'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['expired', 'Expired'], ['invoiced', 'Invoiced']], 'all', { id: 'est-filter', 'aria-label': 'Status filter' });
    const out = h('div'); const draw = () => { const list = st.estimates.slice().reverse().filter(e => sel.value === 'all' || C.estimateStatus(e, t) === sel.value);
      L.clear(out).appendChild(list.length ? L.lazyTable(['Number', 'Client', 'Date', 'Valid until', { t: 'Total', cls: 'num' }, 'Status'], list, e => { const s = C.estimateStatus(e, t);
        return h('tr', { class: 'clickable', onclick: () => L.go('#/estimate/' + e.id) }, h('td', null, h('a', { href: '#/estimate/' + e.id }, e.number || 'Draft')), h('td', null, L.partyOf('estimate', e).name), h('td', null, e.date), h('td', null, C.estimateExpiry(e)), L.num(C.fmtDoc(e, C.invoiceTotals(e).total)), h('td', null, L.chip(s, EST_CHIP[s]))); }, 'ests') : empty('No estimates here yet. An estimate becomes an invoice in one click once the client says yes.')); };
    sel.addEventListener('input', draw); draw();
    const open = st.estimates.filter(e => C.estimateStatus(e, t) === 'sent'), won = st.estimates.filter(e => e.status === 'accepted' || e.status === 'invoiced').length, lost = st.estimates.filter(e => e.status === 'declined').length, ready = st.estimates.filter(e => e.status === 'accepted');
    return h('div', { class: 'stack' }, head('Estimates', h('a', { class: 'btn primary', id: 'new-estimate', href: '#/estimate/new' }, '+ New estimate')),
      h('div', { class: 'grid3' }, stat('Awaiting an answer', C.fmt(sum(open, e => C.totalH(e))), open.length + ' estimate(s)'), stat('Win rate', won + lost ? Math.round(won * 100 / (won + lost)) + '%' : '-', 'accepted out of decided'), stat('Accepted, not invoiced', C.fmt(sum(ready, e => C.totalH(e))), ready.length + ' estimate(s)')),
      h('div', { class: 'card' }, h('div', { class: 'filters' }, sel), out));
  };
  R.estimate = function (arg, arg2) {
    if (arg === 'new') return L.docEditor('estimate', null, arg2);
    const st = L.st, e = st.estimates.find(x => x.id === arg); if (!e) return notFound('estimate', '#/estimates');
    if (e.status === 'draft') return L.draftPage('estimate', e);
    const t = C.today(), s = C.estimateStatus(e, t), set = (status, msg) => guard(() => { C.setEstimateStatus(st, e.id, status); L.commit(); L.toast(msg); });
    const inv = e.invId && st.invoices.find(i => i.id === e.invId);
    const side = h('div', { class: 'card stack no-print' }, h('div', null, 'Status ', L.chip(s, EST_CHIP[s])), h('div', null, h('div', { class: 'k' }, 'Total'), h('div', { class: 'v big' }, C.fmtDoc(e, C.invoiceTotals(e).total))),
      e.status !== 'invoiced' && e.status !== 'declined' ? h('button', { class: 'btn primary', id: 'est-convert', onclick: guard(() => { const i = C.estimateToInvoice(st, e.id, t); L.save(); L.go('#/invoice/' + i.id); L.toast('Draft invoice made from ' + e.number + '.'); }) }, 'Turn into invoice') : null,
      inv ? h('p', null, 'Invoice: ', h('a', { href: '#/invoice/' + inv.id }, inv.number || 'Draft')) : null,
      e.status === 'sent' ? h('div', { class: 'row' }, h('button', { class: 'btn sm', id: 'est-accept', onclick: set('accepted', 'Marked accepted.') }, 'Accepted'), h('button', { class: 'btn sm danger', id: 'est-decline', onclick: set('declined', 'Marked declined.') }, 'Declined')) : null,
      e.status !== 'invoiced' ? h('button', { class: 'btn sm', id: 'est-edit', onclick: set('draft', 'Back to draft.') }, 'Edit (back to draft)') : null,
      h('button', { class: 'btn', onclick: () => window.print() }, 'Print / save as PDF'),
      h('button', { class: 'btn sm', onclick: () => { const n = JSON.parse(JSON.stringify(e)); Object.assign(n, { id: C.nid(st, 'k'), status: 'draft', number: C.takeNumber(st, 'estimate'), date: t }); delete n.invId; st.estimates.push(n); L.save(); L.go('#/estimate/' + n.id); L.toast('Copied to a new draft.'); } }, 'Duplicate'));
    return sideDoc(e.number, '#/estimates', L.paper(e, 'estimate'), side);
  };

  /* ---------- vendors ---------- */
  function vendorDialog(v) {
    L.modal(v ? 'Edit vendor' : 'New vendor', close => {
      const st = L.st, n = L.input({ value: v ? v.name : '', id: 'v-name' }), e = L.input({ value: v ? v.email || '' : '', type: 'email', id: 'v-email' }), p = L.input({ value: v ? v.phone || '' : '', id: 'v-phone' }), terms = L.input({ type: 'number', min: 0, max: 365, value: String(v && v.terms != null ? v.terms : 30), id: 'v-terms' });
      const cat = L.select(st.accounts.filter(a => a.type === 'expense').map(a => [a.id, a.name]), (v && v.defAcct) || '6130', { id: 'v-acct' }), a = h('textarea', { rows: 2, id: 'v-addr' }, v ? v.address || '' : '');
      return h('form', { class: 'stack', onsubmit: guard(ev => { ev.preventDefault(); if (!n.value.trim()) throw new Error('Give the vendor a name.');
        const rec = v || { id: C.nid(st, 'v') }; Object.assign(rec, { name: n.value.trim(), email: e.value.trim(), phone: p.value.trim(), terms: Math.max(0, parseInt(terms.value, 10) || 0), defAcct: cat.value, address: a.value.trim() }); if (!v) st.vendors.push(rec); close(); L.commit(); }) },
      L.field('Name', n), h('div', { class: 'grid2' }, L.field('Email', e), L.field('Phone', p)), h('div', { class: 'grid2' }, L.field('Payment terms (days)', terms), L.field('Usual category', cat)), L.field('Address', a), btns(cancel(close), h('button', { class: 'btn primary', id: 'v-save' }, 'Save')));
    });
  }
  R.vendors = function () {
    const st = L.st; const rows = st.vendors.slice().sort((a, b) => a.name.localeCompare(b.name)).map(v => { const bills = st.bills.filter(b => b.vendorId === v.id && b.status !== 'draft'), owed = sum(bills, b => C.billBalanceH(st, b)), used = bills.length || st.pos.some(p => p.vendorId === v.id) || st.bills.some(b => b.vendorId === v.id);
      return h('tr', null, h('td', null, h('b', null, v.name), v.email ? h('div', { class: 'muted small' }, v.email) : null), L.num(String(bills.length)), L.num(C.fmt(owed), owed ? 'neg' : ''), h('td', { class: 'acts' }, h('a', { class: 'btn sm', href: '#/bill/new/' + v.id }, 'Bill'), h('a', { class: 'btn sm', href: '#/po/new/' + v.id }, 'Order'), h('button', { class: 'btn sm', onclick: () => vendorDialog(v) }, 'Edit'),
        h('button', { class: 'btn sm danger', onclick: () => { if (used) return L.toast('This vendor has bills or orders, so it can not be deleted.', true); L.confirm('Delete ' + v.name + '?', 'Delete', () => { st.vendors = st.vendors.filter(x => x !== v); L.commit(); }, true); } }, 'Delete'))); });
    return h('div', { class: 'stack' }, head('Vendors', h('button', { class: 'btn primary', id: 'new-vendor', onclick: () => vendorDialog() }, '+ New vendor')),
      h('div', { class: 'card' }, rows.length ? L.table(['Vendor', { t: 'Bills', cls: 'num' }, { t: 'You owe', cls: 'num' }, ''], rows) : empty('Add the suppliers you buy from. Bills and purchase orders use them.')));
  };

  /* ---------- bills, purchase orders, payables aging ---------- */
  R.bills = function (tab) {
    tab = tab === 'pos' || tab === 'aging' ? tab : 'bills'; const st = L.st, t = C.today(), ap = C.apAging(st, t);
    const dueSoon = st.bills.filter(b => C.billBalance(st, b) > 0 && C.billDue(b) >= t && C.billDue(b) <= C.addDays(t, 7)), late = ap.totals.total - ap.totals.current;
    const tabs = h('div', { class: 'tabs', role: 'tablist' }, [['bills', 'Bills'], ['pos', 'Purchase orders'], ['aging', 'Payables aging']].map(x => h('a', { role: 'tab', class: 'tab', 'aria-selected': String(tab === x[0]), id: 'btab-' + x[0], href: '#/bills/' + x[0] }, x[1])));
    let body;
    if (tab === 'bills') { const list = st.bills.slice().reverse();
      body = list.length ? L.lazyTable(['Bill', 'Vendor', 'Their ref', 'Date', 'Due', { t: 'Total', cls: 'num' }, { t: 'Balance', cls: 'num' }, 'Status'], list, b => { const s = C.billStatus(st, b, t);
        return h('tr', { class: 'clickable', onclick: () => L.go('#/bill/' + b.id) }, h('td', null, h('a', { href: '#/bill/' + b.id }, b.number || 'Draft')), h('td', null, vendor(b.vendorId).name), h('td', null, b.ref || ''), h('td', null, b.date), h('td', null, C.billDue(b)), L.num(C.fmtDoc(b, C.billTotals(b).total)), L.num(b.status === 'open' ? C.fmtDoc(b, C.billBalance(st, b)) : ''), h('td', null, L.chip(s, BILL_CHIP[s]))); }, 'bills') : empty('No bills yet. Enter the bills your suppliers send, then pay them here so you always know what you owe.'); }
    if (tab === 'pos') { const list = st.pos.slice().reverse();
      body = list.length ? L.lazyTable(['Order', 'Vendor', 'Date', 'Expected', { t: 'Total', cls: 'num' }, 'Status'], list, o => h('tr', { class: 'clickable', onclick: () => L.go('#/po/' + o.id) }, h('td', null, h('a', { href: '#/po/' + o.id }, o.number)), h('td', null, vendor(o.vendorId).name), h('td', null, o.date), h('td', null, L.docEnd(o)), L.num(C.fmt(C.billTotals(o).total)), h('td', null, L.chip(o.status, PO_CHIP[o.status])))) : empty('No purchase orders yet. Send one to a supplier, then turn it into a bill when the goods arrive.'); }
    if (tab === 'aging') { const cols = ap.buckets;
      body = ap.rows.length ? L.table(['Vendor'].concat(cols.map(c => ({ t: c === 'current' ? 'Current' : c + ' days', cls: 'num' })), [{ t: 'Total', cls: 'num' }]), ap.rows.map(r => h('tr', null, h('td', null, vendor(r.vendorId).name), cols.map(c => L.num(r[c] ? C.fmt(r[c]) : '-', c !== 'current' && r[c] ? 'neg' : '')), L.num(C.fmt(r.total), 'strong'))).concat([h('tr', { class: 'foot' }, h('td', null, 'Total'), cols.map(c => L.num(C.fmt(ap.totals[c]))), L.num(C.fmt(ap.totals.total)))]), 'apaging') : empty('You owe nothing to vendors as of today.'); }
    return h('div', { class: 'stack' }, head('Bills and orders', h('a', { class: 'btn', id: 'new-po', href: '#/po/new' }, '+ Purchase order'), h('a', { class: 'btn primary', id: 'new-bill', href: '#/bill/new' }, '+ New bill')),
      h('div', { class: 'grid3' }, stat('You owe vendors', C.fmt(ap.totals.total), 'accounts payable', '', 'ap-total'), stat('Due in the next 7 days', C.fmt(sum(dueSoon, b => C.billBalanceH(st, b))), dueSoon.length + ' bill(s)'), stat('Past due', C.fmt(late), late ? 'pay these first' : 'nothing late', late ? 'neg' : '')),
      h('div', { class: 'card stack' }, tabs, body));
  };
  R.bill = function (arg, arg2) {
    if (arg === 'new') return L.docEditor('bill', null, arg2);
    const st = L.st, b = st.bills.find(x => x.id === arg); if (!b) return notFound('bill', '#/bills');
    if (b.status === 'draft') return L.draftPage('bill', b);
    const t = C.today(), s = C.billStatus(st, b, t), pays = st.billPayments.filter(p => p.billId === b.id), po = b.fromPO && st.pos.find(o => o.id === b.fromPO);
    const pay = () => L.modal('Pay bill', close => { const a = L.moneyInput(C.billBalance(st, b), { id: 'bp-amt' }), d = dateInput(null, 'bp-date'), memo = L.input({ placeholder: 'Check number, transfer reference...', id: 'bp-memo' }), fx = C.isForeign(b) ? L.input({ id: 'bp-fx', inputmode: 'decimal', value: C.fmtRate(b.fx), 'aria-label': 'Exchange rate for this payment' }) : null, prev = h('p', { class: 'muted small', id: 'bp-prev' });
      const upd = () => { if (!fx) return; const r = C.parseRate(fx.value), c = C.toCents(a.value); L.clear(prev); if (!(r > 0) || isNaN(c) || c <= 0) return; const cash = C.convert(c, r), book = c === C.billBalance(st, b) ? C.billBalanceH(st, b) : Math.min(C.convert(c, b.fx), C.billBalanceH(st, b)), g = book - cash; prev.textContent = 'You pay ' + C.fmt(cash) + ' at this rate. The bill was booked at ' + C.fmt(book) + ': ' + (g === 0 ? 'no gain or loss.' : (g > 0 ? 'realised gain ' : 'realised loss ') + C.fmt(Math.abs(g)) + '.'); };
      if (fx) { fx.oninput = upd; a.oninput = upd; }
      return h('form', { class: 'stack', onsubmit: guard(ev => { ev.preventDefault(); const r = fx ? C.parseRate(fx.value) : undefined; if (fx && !(r > 0)) throw new Error('Type the exchange rate for this payment, for example 1.0842.'); C.payBill(st, b.id, d.value, parseMoney(a.value, 'Amount'), memo.value.trim() || undefined, fx ? { fx: r } : undefined); close(); L.commit(); L.toast('Bill payment recorded.'); }) },
        h('p', { class: 'muted' }, 'Balance is ' + C.fmtDoc(b, C.billBalance(st, b)) + '. A smaller amount records a partial payment.'), h('div', { class: 'grid2' }, L.field(C.isForeign(b) ? 'Amount (' + b.cur + ')' : 'Amount (' + C.symbol() + ')', a), L.field('Date', d)), fx ? L.field('1 ' + b.cur + ' = ? ' + C.homeCur() + ' on the day you paid', fx, 'You type the rate you actually got. Nothing is looked up.') : null, prev, L.field('Reference', memo), btns(cancel(close), h('button', { class: 'btn primary', id: 'bp-save' }, 'Record payment'))); });
    const side = h('div', { class: 'card stack no-print' }, h('div', null, 'Status ', L.chip(s, BILL_CHIP[s])), b.status === 'open' ? h('div', null, h('div', { class: 'k' }, 'Balance'), h('div', { class: 'v big' }, C.fmtDoc(b, C.billBalance(st, b)))) : null,
      b.status === 'open' && C.billBalance(st, b) > 0 ? h('button', { class: 'btn primary', id: 'bill-pay', onclick: pay }, 'Pay bill') : null,
      h('button', { class: 'btn', onclick: () => window.print() }, 'Print / save as PDF'), po ? h('p', { class: 'small' }, 'From order ', h('a', { href: '#/po/' + po.id }, po.number)) : null,
      pays.length ? h('div', null, h('h3', null, 'Payments'), L.table(['Date', { t: 'Amount', cls: 'num' }, ''], pays.map(p => h('tr', null, h('td', null, p.date), L.num(C.fmtDoc(b, p.amount) + (p.fx ? ' at ' + C.fmtRate(p.fx) + (p.gl ? (p.gl > 0 ? ', gain ' : ', loss ') + C.fmt(Math.abs(p.gl)) : '') : '')), h('td', null, h('button', { class: 'btn ghost sm', 'aria-label': 'Remove payment', onclick: () => L.confirm('Remove this payment?', 'Remove', guard(() => { C.removeBillPayment(st, p.id); L.commit(); }), true) }, '✕')))))) : null,
      b.status === 'open' ? h('button', { class: 'btn sm danger', onclick: () => L.confirm('Void ' + b.number + '? A reversing entry keeps the books honest.', 'Void bill', guard(() => { C.voidBill(st, b.id, t < b.date ? b.date : t); L.commit(); }), true) }, 'Void') : null);
    return sideDoc(b.number + ' ' + vendor(b.vendorId).name, '#/bills', L.paper(b, 'bill'), side);
  };
  R.po = function (arg, arg2) {
    if (arg === 'new') return L.docEditor('po', null, arg2);
    const st = L.st, o = st.pos.find(x => x.id === arg); if (!o) return notFound('order', '#/bills/pos');
    if (o.status === 'draft') return L.draftPage('po', o);
    const bill = o.billId && st.bills.find(b => b.id === o.billId);
    const side = h('div', { class: 'card stack no-print' }, h('div', null, 'Status ', L.chip(o.status, PO_CHIP[o.status])), h('div', null, h('div', { class: 'k' }, 'Total'), h('div', { class: 'v big' }, C.fmt(C.billTotals(o).total))),
      o.status === 'sent' ? h('button', { class: 'btn primary', id: 'po-bill', onclick: guard(() => { const b = C.poToBill(st, o.id, C.today()); L.save(); L.go('#/bill/' + b.id); L.toast('Draft bill made from ' + o.number + '. Check it, then enter it.'); }) }, 'Goods arrived: make the bill') : null,
      bill ? h('p', null, 'Bill: ', h('a', { href: '#/bill/' + bill.id }, bill.number || 'Draft')) : null,
      o.status === 'sent' ? h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { o.status = 'draft'; L.commit(); } }, 'Edit (back to draft)'), h('button', { class: 'btn sm danger', id: 'po-cancel', onclick: () => L.confirm('Cancel ' + o.number + '?', 'Cancel order', () => { o.status = 'cancelled'; L.commit(); }, true) }, 'Cancel order')) : null,
      h('button', { class: 'btn', onclick: () => window.print() }, 'Print / save as PDF'));
    return sideDoc(o.number, '#/bills/pos', L.paper(o, 'po'), side);
  };

  /* ---------- products, services and stock ---------- */
  function itemDialog(it) {
    L.modal(it ? 'Edit product or service' : 'New product or service', close => {
      const st = L.st, n = L.input({ value: it ? it.name : '', id: 'it-name' }), sku = L.input({ value: it ? it.sku : '', id: 'it-sku' }), kind = L.select([['product', 'Product'], ['service', 'Service']], it ? it.kind : 'product', { id: 'it-kind', disabled: !!it });
      const track = h('input', { type: 'checkbox', id: 'it-track', checked: it ? it.track : true, disabled: !!it }), price = L.moneyInput(it ? it.price : null, { id: 'it-price' }), cost = L.moneyInput(it ? it.lastCost : null, { id: 'it-cost' });
      const inc = L.select(st.accounts.filter(a => a.type === 'income').map(a => [a.id, a.name]), it ? it.acct : '4100', { id: 'it-acct' }), exp = L.select(st.accounts.filter(a => a.type === 'expense').map(a => [a.id, a.name]), it ? it.expAcct : '6130', { id: 'it-exp' });
      const qty = L.input({ inputmode: 'decimal', value: '0', id: 'it-qty' }), reorder = L.input({ inputmode: 'decimal', value: it ? C.fmtQty(it.reorder) : '0', id: 'it-reorder' }), ven = L.select([['', 'No preferred vendor']].concat(st.vendors.map(v => [v.id, v.name])), it ? it.vendorId : '', { id: 'it-vendor' });
      return h('form', { class: 'stack', onsubmit: guard(ev => { ev.preventDefault();
        const o = { name: n.value.trim(), sku: sku.value.trim(), price: parseMoney(price.value || '0', 'Price'), cost: parseMoney(cost.value || '0', 'Cost'), acct: inc.value, expAcct: exp.value, reorder: parseQty(reorder.value, 'Reorder level'), vendorId: ven.value };
        if (it) { if (!o.name) throw new Error('Give the product or service a name'); Object.assign(it, { name: o.name, sku: o.sku, price: o.price, acct: o.acct, expAcct: o.expAcct, reorder: o.reorder, vendorId: o.vendorId }); if (it.onHand <= 0) it.lastCost = o.cost; }
        else C.addItem(st, Object.assign(o, { kind: kind.value, track: kind.value === 'product' && track.checked, qty: parseQty(qty.value, 'Opening quantity') }));
        close(); L.commit(); L.toast('Saved.'); }) },
        h('div', { class: 'grid2' }, L.field('Name', n), L.field('SKU or code (optional)', sku)), it ? null : h('div', { class: 'grid2' }, L.field('Type', kind), h('label', { class: 'check' }, track, ' Track stock (products only)')),
        h('div', { class: 'grid2' }, L.field('Sale price ($)', price), L.field('Purchase cost ($)', cost)), h('div', { class: 'grid2' }, L.field('Income category', inc), L.field('Expense category (when not stocked)', exp)),
        h('div', { class: 'grid3' }, it ? null : L.field('Opening quantity', qty, 'Posts to inventory at the purchase cost.'), L.field('Reorder at', reorder), L.field('Preferred vendor', ven)), btns(cancel(close), h('button', { class: 'btn primary', id: 'it-save' }, 'Save')));
    });
  }
  function countDialog(it) {
    L.modal('Count stock: ' + it.name, close => { const q = L.input({ inputmode: 'decimal', value: C.fmtQty(it.onHand), id: 'cnt-qty' }), d = dateInput(null, 'cnt-date');
      return h('form', { class: 'stack', onsubmit: guard(ev => { ev.preventDefault(); const e = C.adjustStock(L.st, it.id, parseQty(q.value, 'Counted quantity'), d.value); close(); L.commit(); L.toast(e ? 'Stock adjusted and posted to cost of goods.' : 'No change.'); }) },
        h('p', { class: 'muted' }, 'Enter what is on the shelf. The difference posts to cost of goods sold at average cost.'), h('div', { class: 'grid2' }, L.field('Counted quantity', q), L.field('Date', d)), btns(cancel(close), h('button', { class: 'btn primary', id: 'cnt-save' }, 'Save count'))); });
  }
  function reorderDialog() {
    L.modal('Order low stock', close => { const st = L.st, low = C.lowStock(st), pref = (low.find(i => i.vendorId) || {}).vendorId || '', v = L.select([['', 'Choose a vendor']].concat(st.vendors.map(x => [x.id, x.name])), pref, { id: 'ro-vendor' });
      return h('form', { class: 'stack', onsubmit: guard(ev => { ev.preventDefault(); const po = C.reorderPO(st, v.value, C.today()); close(); L.save(); L.go('#/po/' + po.id); L.toast('Draft order ' + po.number + ' made. Check quantities, then mark it sent.'); }) },
        h('p', { class: 'muted' }, 'Makes a draft purchase order for products at or below their reorder level, ordering up to twice the reorder level.'), L.field('Vendor', v, st.vendors.length ? null : 'Add a vendor first on the Vendors page.'), btns(cancel(close), h('button', { class: 'btn primary', id: 'ro-save' }, 'Make draft order'))); });
  }
  R.items = function () {
    const st = L.st, low = C.lowStock(st), used = id => ['invoices', 'estimates', 'bills', 'pos'].some(k => st[k].some(d => d.lines.some(l => l.itemId === id))) || st.entries.some(e => e.ref === id);
    const rows = st.items.slice().sort((a, b) => a.name.localeCompare(b.name)).map(i => { const isLow = low.indexOf(i) >= 0;
      return h('tr', { class: isLow ? 'low' : '' }, h('td', null, h('b', null, i.name), i.sku ? h('div', { class: 'muted small' }, i.sku) : null), h('td', null, i.track ? 'Stocked product' : i.kind === 'product' ? 'Product' : 'Service'), L.num(C.fmt(i.price)),
        L.num(i.track ? C.fmtQty(i.onHand) : '-', i.onHand < 0 ? 'neg' : isLow ? 'warn' : ''), L.num(i.track ? C.fmt(C.itemAvgCost(i)) : '-'), L.num(i.track ? C.fmt(i.value) : '-'), L.num(i.track ? C.fmtQty(i.reorder) : '-'),
        h('td', { class: 'acts' }, i.track ? h('button', { class: 'btn sm', 'aria-label': 'Count stock of ' + i.name, onclick: () => countDialog(i) }, 'Count') : null, h('button', { class: 'btn sm', onclick: () => itemDialog(i) }, 'Edit'),
          h('button', { class: 'btn sm danger', onclick: () => { if (used(i.id) || i.onHand) return L.toast('This item is on documents or has stock, so it can not be deleted.', true); L.confirm('Delete ' + i.name + '?', 'Delete', () => { st.items = st.items.filter(x => x !== i); L.commit(); }, true); } }, 'Delete'))); });
    return h('div', { class: 'stack' }, head('Products and stock', low.length ? h('button', { class: 'btn', id: 'reorder', onclick: reorderDialog }, 'Order low stock') : null, h('button', { class: 'btn primary', id: 'new-item', onclick: () => itemDialog() }, '+ New product or service')),
      h('div', { class: 'grid3' }, stat('Stock value', C.fmt(C.inventoryValue(st)), 'at average cost', '', 'stock-value'), stat('Stocked products', String(st.items.filter(i => i.track).length), st.items.length + ' item(s) in the catalog'), stat('At or below reorder level', String(low.length), low.length ? low.map(i => i.name).slice(0, 3).join(', ') : 'all good', low.length ? 'neg' : '')),
      h('div', { class: 'card' }, rows.length ? L.table(['Item', 'Type', { t: 'Price', cls: 'num' }, { t: 'On hand', cls: 'num' }, { t: 'Avg cost', cls: 'num' }, { t: 'Value', cls: 'num' }, { t: 'Reorder at', cls: 'num' }, ''], rows, 'items') : empty('Add what you sell. Products can track stock: bills add to it at cost, invoices take from it and post cost of goods sold.')),
      L.guide('Average-cost inventory for small shops. Selling more than you have is allowed and shows in red; it is costed at the last purchase cost until new stock arrives. Not a warehouse or point-of-sale system.'));
  };

  /* ---------- time tracking ---------- */
  setInterval(() => { const el = document.getElementById('tm-elapsed'); if (el && L.st && L.st.settings.timer) el.textContent = C.fmtMinutes(C.timerMinutes(L.st.settings.timer.start, Date.now())); }, 15000);
  R.time = function () {
    const st = L.st, s = st.settings, tm = s.timer, t = C.today(), cname = id => (L.client(id) || { name: '?' }).name;
    const clientOpts = [['', 'Choose a client']].concat(st.clients.map(c => [c.id, c.name]));
    let timerCard;
    if (tm) timerCard = h('div', { class: 'card stack', id: 'timer' }, h('h2', null, 'Timer running'), h('p', null, h('b', null, cname(tm.clientId)), ' · ', tm.desc || 'No description'), h('div', { class: 'v big', id: 'tm-elapsed' }, C.fmtMinutes(C.timerMinutes(tm.start, Date.now()))),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', id: 'tm-stop', onclick: guard(() => { C.addTime(st, { clientId: tm.clientId, date: t, minutes: Math.min(1440, C.timerMinutes(tm.start, Date.now())), desc: tm.desc, rate: tm.rate, billable: true }); s.timer = null; L.commit(); L.toast('Time saved.'); }) }, 'Stop and save'), h('button', { class: 'btn', id: 'tm-discard', onclick: () => { s.timer = null; L.commit(); } }, 'Discard')));
    else { const c = L.select(clientOpts, '', { id: 'tm-client' }), d = L.input({ id: 'tm-desc', placeholder: 'What are you working on?' }), r = L.moneyInput(s.defaultRate || null, { id: 'tm-rate' });
      timerCard = h('form', { class: 'card stack', id: 'timer', onsubmit: guard(ev => { ev.preventDefault(); if (!c.value) throw new Error('Choose a client.'); const rate = parseMoney(r.value || '0', 'Rate'); s.timer = { clientId: c.value, desc: d.value.trim(), rate, start: Date.now() }; s.defaultRate = rate; L.commit(); }) },
        h('h2', null, 'Timer'), h('div', { class: 'grid3' }, L.field('Client', c), L.field('Task', d), L.field('Hourly rate ($)', r)), h('div', { class: 'row end' }, h('button', { class: 'btn primary', id: 'tm-start' }, '▶ Start timer')), h('p', { class: 'muted small' }, 'The timer keeps running while Stark Ledger is locked or closed, because it only stores the start time.')); }
    const mc = L.select(clientOpts, '', { id: 'te-client' }), md = dateInput(null, 'te-date'), mdur = L.input({ id: 'te-dur', placeholder: '1:30, 1.5 or 90m' }), mdesc = L.input({ id: 'te-desc' }), mrate = L.moneyInput(s.defaultRate || null, { id: 'te-rate' }), mbill = h('input', { type: 'checkbox', id: 'te-bill', checked: true });
    const manual = h('form', { class: 'card stack', onsubmit: guard(ev => { ev.preventDefault(); const m = C.parseDuration(mdur.value); if (isNaN(m)) throw new Error('Enter time like 1:30, 1.5 or 90m.'); const rate = parseMoney(mrate.value || '0', 'Rate');
      C.addTime(st, { clientId: mc.value, date: md.value, minutes: m, desc: mdesc.value, rate, billable: mbill.checked }); s.defaultRate = rate; L.commit(); L.toast('Time logged.'); }) },
      h('h2', null, 'Log time'), h('div', { class: 'grid4' }, L.field('Client', mc), L.field('Date', md), L.field('Time', mdur), L.field('Hourly rate ($)', mrate)), L.field('Description', mdesc), h('div', { class: 'row' }, h('label', { class: 'check' }, mbill, ' Billable'), h('span', { class: 'grow' }), h('button', { class: 'btn primary', id: 'te-save' }, 'Log time')));
    const round = L.select([['1', 'Bill exact minutes'], ['6', 'Round each entry up to 6 minutes'], ['15', 'Round each entry up to 15 minutes']], String(s.timeRound || 1), { id: 'te-round', 'aria-label': 'Rounding' }); round.onchange = () => { s.timeRound = +round.value; L.commit(); };
    const groups = {}; C.unbilledTime(st).forEach(x => { const g = groups[x.clientId] || (groups[x.clientId] = { minutes: 0, value: 0, n: 0 }); g.minutes += x.minutes; g.value += C.timeValue(x, s.timeRound); g.n++; });
    const unbilled = Object.keys(groups).map(cid => h('tr', null, h('td', null, cname(cid)), L.num(String(groups[cid].n)), L.num(C.fmtMinutes(groups[cid].minutes)), L.num(C.fmt(groups[cid].value), 'strong'),
      h('td', { class: 'acts' }, h('button', { class: 'btn sm primary', id: 'inv-time-' + cid, onclick: guard(() => { const inv = C.invoiceTime(st, cid, null, t); L.save(); L.go('#/invoice/' + inv.id); L.toast('Draft invoice made from unbilled time.'); }) }, 'Create invoice'))));
    const recent = st.time.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0).slice(0, 60).map(x => { const billed = C.timeBilled(st, x);
      return h('tr', null, h('td', null, x.date), h('td', null, cname(x.clientId)), h('td', null, x.desc || ''), L.num(C.fmtMinutes(x.minutes)), L.num(C.fmt(x.rate)), L.num(C.fmt(C.timeValue(x, 1))), h('td', null, billed ? L.chip('invoiced', 'green') : x.billable ? L.chip('unbilled', 'amber') : L.chip('not billable', 'dim')),
        h('td', null, billed ? null : h('button', { class: 'btn ghost sm', 'aria-label': 'Delete time entry', onclick: () => { st.time = st.time.filter(y => y !== x); L.commit(); } }, '✕'))); });
    return h('div', { class: 'stack' }, head('Time'), timerCard, manual,
      h('div', { class: 'card stack' }, h('div', { class: 'page-head' }, h('h2', null, 'Unbilled time'), round), unbilled.length ? L.table(['Client', { t: 'Entries', cls: 'num' }, { t: 'Hours', cls: 'num' }, { t: 'Value', cls: 'num' }, ''], unbilled, 'unbilled') : empty('No unbilled time. Start the timer or log time above.')),
      h('div', { class: 'card' }, h('h2', null, 'Recent time'), recent.length ? L.table(['Date', 'Client', 'Description', { t: 'Time', cls: 'num' }, { t: 'Rate', cls: 'num' }, { t: 'Value', cls: 'num' }, 'Status', ''], recent, 'timelog') : empty('Nothing logged yet.')));
  };

  /* ---------- payment reminders and client statements ---------- */
  const STAGE = ['', 'Friendly', 'Firm', 'Final notice'], STAGE_CHIP = ['', 'blue', 'amber', 'red'];
  L.reminderDialog = function (inv) {
    const st = L.st, t = C.today(), late = Math.max(0, C.daysBetween(C.dueDate(inv), t));
    L.modal('Payment reminder: ' + inv.number, close => {
      const stageSel = L.select([['1', 'Friendly'], ['2', 'Firm'], ['3', 'Final notice']], String(Math.max(1, C.reminderStage(late))), { id: 'rem-stage' }), langSel = L.select([['en', 'English'], ['es', 'Español']], L.lang === 'es' ? 'es' : 'en', { id: 'rem-lang' });
      const subj = L.input({ id: 'rem-subj' }), body = h('textarea', { rows: 10, id: 'rem-body' }), to = h('p', { class: 'muted small' });
      const fill = () => { const r = C.reminderText(st, inv.id, +stageSel.value, t, langSel.value); subj.value = r.subject; body.value = r.body; to.textContent = r.to ? 'To: ' + r.to : 'This client has no email address on file.'; };
      stageSel.onchange = fill; langSel.onchange = fill; fill();
      return h('div', { class: 'stack' }, h('div', { class: 'grid2' }, L.field('Tone', stageSel), L.field('Letter language', langSel)), to, L.field('Subject', subj), L.field('Message', body),
        h('p', { class: 'muted small' }, 'Stark Ledger never sends email. Copy the text into your own email program, then mark it as sent so the history stays complete.'),
        btns(h('button', { type: 'button', class: 'btn', id: 'rem-copy', onclick: guardAsync(async () => { const txt = subj.value + '\n\n' + body.value; try { await navigator.clipboard.writeText(txt); L.toast('Copied.'); } catch (e) { body.select(); L.toast('Press Ctrl+C to copy the selected text.'); } }) }, 'Copy text'),
          h('button', { type: 'button', class: 'btn primary', id: 'rem-log', onclick: guard(() => { C.logReminder(st, inv.id, t, +stageSel.value); close(); L.commit(); L.toast('Reminder logged.'); }) }, 'Mark as sent')));
    }, true);
  };
  R.reminders = function () {
    const st = L.st, t = C.today(), list = C.overdueList(st, t); const pick = L.select([['', 'Choose a client']].concat(st.clients.map(c => [c.id, c.name])), '', { id: 'sm-client', 'aria-label': 'Client' }); pick.onchange = () => { if (pick.value) L.go('#/statement/' + pick.value); };
    return h('div', { class: 'stack' }, head('Payment reminders'), h('p', { class: 'muted' }, 'Overdue invoices, latest first. The suggested tone steps up with how late a payment is: friendly up to 14 days, firm up to 44, then a final notice.'),
      h('div', { class: 'card' }, list.length ? L.table(['Invoice', 'Client', { t: 'Days late', cls: 'num' }, { t: 'Balance', cls: 'num' }, 'Suggested tone', 'Last reminder', ''], list.map(x => h('tr', null, h('td', null, h('a', { href: '#/invoice/' + x.inv.id }, x.inv.number)), h('td', null, x.client.name), L.num(String(x.late), 'neg'), L.num(C.fmt(x.balance)), h('td', null, L.chip(STAGE[x.stage], STAGE_CHIP[x.stage])),
        h('td', null, x.last ? x.last.date + ' (' + x.count + ')' : 'Never'), h('td', { class: 'acts' }, h('button', { class: 'btn sm primary', 'aria-label': 'Write a reminder for ' + x.inv.number, onclick: () => L.reminderDialog(x.inv) }, 'Write reminder'), h('a', { class: 'btn sm', href: '#/statement/' + x.inv.clientId }, 'Statement')))), 'rem') : empty('Nothing is overdue.')),
      h('div', { class: 'card stack' }, h('h2', null, 'Client statements'), h('p', { class: 'muted' }, 'A printable statement lists every invoice, payment and credit for a period, with a running balance and how late the open amounts are.'), L.field('Client', pick)));
  };
  let stmt = { from: null, to: null };
  R.statement = function (clientId) {
    const st = L.st, c = st.clients.find(x => x.id === clientId); if (!c) return notFound('client', '#/clients');
    stmt.from = stmt.from || L.year() + '-01-01'; stmt.to = stmt.to || C.today();
    const from = dateInput(stmt.from, 'sm-from'), to = dateInput(stmt.to, 'sm-to'); [from, to].forEach(x => x.addEventListener('change', () => { stmt = { from: from.value || stmt.from, to: to.value || stmt.to }; L.render(); }));
    const sm = C.statement(st, clientId, stmt.from, stmt.to), s = st.settings, addr = h('div'); (c.address || '').split('\n').forEach(x => addr.appendChild(h('div', null, x)));
    const ag = sm.aging, cols = ['current', '1-30', '31-60', '61-90', '90+'];
    const paper = h('div', { class: 'paper', id: 'paper' }, h('div', { class: 'p-head' }, h('div', null, h('div', { class: 'p-biz' }, s.business || 'Your business name'), s.email ? h('div', null, s.email) : null, s.phone ? h('div', null, s.phone) : null), h('div', { class: 'p-title' }, h('h2', null, 'STATEMENT'), h('div', null, stmt.from + ' – ' + stmt.to))),
      h('div', { class: 'p-meta' }, h('div', null, h('div', { class: 'p-k' }, 'Statement for'), h('b', null, c.name), addr), h('div', null, h('div', { class: 'p-k' }, 'Balance due'), h('b', { id: 'sm-due' }, C.fmt(sm.closing)))),
      h('div', { class: 'scroll' }, h('table', { class: 'p-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Description'), h('th', { class: 'num' }, 'Charges'), h('th', { class: 'num' }, 'Payments and credits'), h('th', { class: 'num' }, 'Balance'))),
        h('tbody', null, h('tr', null, h('td', null, stmt.from), h('td', null, 'Opening balance'), L.num(''), L.num(''), L.num(C.fmt(sm.opening))), sm.rows.map(r => h('tr', null, h('td', null, r.date), h('td', null, r.memo), L.num(r.charge ? C.fmt(r.charge) : ''), L.num(r.credit ? C.fmt(r.credit) : ''), L.num(C.fmt(r.balance))))))),
      ag ? h('div', { class: 'scroll' }, h('table', { class: 'p-tbl p-aging' }, h('thead', null, h('tr', null, cols.map(k => h('th', { class: 'num' }, k === 'current' ? 'Current' : k + ' days')))), h('tbody', null, h('tr', null, cols.map(k => L.num(C.fmt(ag[k] || 0))))))) : null,
      s.footer ? h('p', { class: 'p-foot' }, s.footer) : null);
    return h('div', { class: 'stack' }, h('div', { class: 'page-head no-print' }, h('h1', null, 'Statement: ' + c.name), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => window.print() }, 'Print / save as PDF'), h('a', { class: 'btn', href: '#/clients' }, 'Back'))),
      h('div', { class: 'card no-print row' }, L.field('From', from), L.field('To', to)), paper);
  };

  /* ---------- recurring invoices ---------- */
  L.scheduleDialog = function (inv) {
    L.modal('Repeat this invoice', close => {
      const name = L.input({ id: 'sc-name', value: ((L.client(inv.clientId) || { name: '' }).name + ', ' + (inv.lines[0] ? inv.lines[0].desc : '')).slice(0, 80) }), f = L.select(FREQ, 'monthly', { id: 'sc-freq' }), start = dateInput(C.addMonths(inv.date, 1), 'sc-start'), end = L.input({ type: 'date', id: 'sc-end' }), auto = L.select([['draft', 'Make a draft for me to check'], ['issue', 'Issue it automatically']], 'draft', { id: 'sc-auto' });
      return h('form', { class: 'stack', onsubmit: guard(ev => { ev.preventDefault(); const s = C.scheduleFromInvoice(L.st, inv.id, { name: name.value.trim(), freq: f.value, start: start.value, end: end.value, auto: auto.value }); const r = C.runSchedules(L.st, C.today()); close(); L.commit();
        L.toast(r.total ? r.total + ' invoice(s) were already due and have been made.' : 'Saved. The next one is made on ' + C.recurDate(s, s.next) + '.'); }) },
        h('p', { class: 'muted' }, 'Copies the lines, taxes and terms of this invoice. Invoices are made when you unlock Stark Ledger on or after each date; nothing runs while it is closed.'),
        L.field('Name', name), h('div', { class: 'grid2' }, L.field('Repeats', f), L.field('Each new invoice', auto)), h('div', { class: 'grid2' }, L.field('First date', start), L.field('Ends (optional)', end)), btns(cancel(close), h('button', { class: 'btn primary', id: 'sc-save' }, 'Save')));
    });
  };
  L.schedulesCard = function () {
    const st = L.st; const rows = st.schedules.map(s => { const next = C.recurDate(s, s.next || 0), over = s.end && next > s.end;
      return h('tr', null, h('td', null, h('b', null, s.name), h('div', { class: 'muted small' }, (L.client(s.clientId) || { name: '?' }).name)), L.num(C.fmt(C.scheduleTotal(s))), h('td', null, (FREQ.find(x => x[0] === s.freq) || ['', s.freq])[1]), h('td', null, over ? 'Finished' : s.active ? next : 'Paused'), h('td', null, s.auto === 'issue' ? 'Issued automatically' : 'Draft to check'),
        h('td', { class: 'acts' }, h('button', { class: 'btn sm', onclick: () => { s.active = !s.active; L.commit(); } }, s.active ? 'Pause' : 'Resume'), h('button', { class: 'btn sm danger', onclick: () => L.confirm('Delete "' + s.name + '"? Invoices already made stay in your books.', 'Delete', () => { st.schedules = st.schedules.filter(x => x !== s); L.commit(); }, true) }, 'Delete'))); });
    return h('div', { class: 'card', id: 'schedules' }, h('h2', null, 'Recurring invoices'), rows.length ? L.table(['Invoice', { t: 'Amount', cls: 'num' }, 'Repeats', 'Next', 'Mode', ''], rows, 'sched') : empty('Open any invoice and choose Repeat to bill a client on a schedule.'));
  };

  /* ---------- sales tax ---------- */
  let stx = { from: null, to: null };
  R.salestax = function () {
    const st = L.st; if (!stx.from) { const q = L.rangeFor('quarter'); stx.from = q[0]; stx.to = q[1]; }
    const q = L.rangeFor('quarter'), lastQ = [C.addMonths(q[0], -3), C.addDays(q[0], -1)];
    const preset = (label, r) => h('button', { type: 'button', class: 'btn sm', onclick: () => { stx = { from: r[0], to: r[1] }; L.render(); } }, label);
    const from = dateInput(stx.from, 'st-from'), to = dateInput(stx.to, 'st-to'); [from, to].forEach(x => x.addEventListener('change', () => { stx = { from: from.value || stx.from, to: to.value || stx.to }; L.render(); }));
    const r = C.salesTaxReport(st, stx.from, stx.to), owedNow = -(C.trialBalance(st).balances[C.SALESTAX] || 0);
    const remit = () => L.modal('Record a sales tax payment', close => { const a = L.moneyInput(owedNow > 0 ? owedNow : null, { id: 'sr-amt' }), d = dateInput(null, 'sr-date'), m = L.input({ id: 'sr-memo', placeholder: 'Tax agency and period' });
      return h('form', { class: 'stack', onsubmit: guard(ev => { ev.preventDefault(); C.remitSalesTax(st, d.value, parseMoney(a.value, 'Amount'), m.value.trim() || undefined); close(); L.commit(); L.toast('Sales tax payment recorded.'); }) },
        h('p', { class: 'muted' }, 'Posts the payment from checking against sales tax payable.'), h('div', { class: 'grid2' }, L.field('Amount ($)', a), L.field('Date', d)), L.field('Memo', m), btns(cancel(close), h('button', { class: 'btn primary', id: 'sr-save' }, 'Record payment'))); });
    return h('div', { class: 'stack' }, head('Sales tax', h('button', { class: 'btn', id: 'st-csv', onclick: () => L.download('stark-ledger-sales-tax-' + stx.from + '-to-' + stx.to + '.csv', C.salesTaxCSV(st, stx.from, stx.to)) }, 'Download CSV'), h('button', { class: 'btn primary', id: 'st-remit', onclick: remit }, 'Record a tax payment')),
      h('div', { class: 'card no-print row' }, L.field('From', from), L.field('To', to), h('div', { class: 'row presets' }, preset('This quarter', q), preset('Last quarter', lastQ), preset('This year', L.rangeFor('year')))),
      h('div', { class: 'grid3' }, stat('Tax collected', C.fmt(r.collected), 'on invoices in this period', '', 'st-collected'), stat('Paid to tax agencies', C.fmt(r.remitted), 'in this period'), stat('Owed now', C.fmt(owedNow), 'sales tax payable today', owedNow > 0 ? 'neg' : '')),
      h('div', { class: 'card' }, r.rows.length ? L.table(['Tax', { t: 'Rate', cls: 'num' }, { t: 'Invoices', cls: 'num' }, { t: 'Taxable sales', cls: 'num' }, { t: 'Tax collected', cls: 'num' }], r.rows.map(x => h('tr', null, h('td', null, x.name), L.num((x.bps / 100).toFixed(2) + '%'), L.num(String(x.invoices)), L.num(C.fmt(x.sales)), L.num(C.fmt(x.tax), 'strong')))
        .concat([h('tr', null, h('td', null, 'Untaxed sales'), L.num(''), L.num(''), L.num(C.fmt(r.exemptSales)), L.num('-')), h('tr', { class: 'foot' }, h('td', null, 'Total'), L.num(''), L.num(''), L.num(C.fmt(r.taxableSales + r.exemptSales)), L.num(C.fmt(r.collected)))]), 'stax') : empty('No taxed invoices in this period.')),
      L.guide('Totals what your issued invoices charged, by tax name and rate; voided invoices are left out. Filing rules, exemptions and due dates are set by your state and city: check them with your tax agency or a tax professional.'));
  };

  /* ---------- budgets vs actuals ---------- */
  let bud = { year: null, through: null };
  R.budgets = function () {
    const st = L.st, t = C.today(), cy = +t.slice(0, 4); bud.year = bud.year || cy; bud.through = bud.through || (bud.year === cy ? +t.slice(5, 7) : 12);
    const yr = L.select([cy + 1, cy, cy - 1].map(y => [String(y), String(y)]), String(bud.year), { id: 'bd-year', 'aria-label': 'Year' }), th = L.select(MONTHS.map((m, i) => [String(i + 1), 'Through ' + m]), String(bud.through), { id: 'bd-through', 'aria-label': 'Through month' });
    yr.onchange = () => { bud.year = +yr.value; bud.through = bud.year === cy ? +t.slice(5, 7) : 12; L.render(); }; th.onchange = () => { bud.through = +th.value; L.render(); };
    const r = C.budgetVsActual(st, bud.year, bud.through), extra = [];
    const inputs = {}; const show = new Set(r.rows.map(x => x.acct)); (bud.add || []).forEach(a => show.add(a));
    const accts = st.accounts.filter(a => (a.type === 'income' || a.type === 'expense') && show.has(a.id));
    const rowFor = a => { const x = r.rows.find(y => y.acct === a.id) || { budget: 0, annual: 0, actual: 0, variance: 0, pct: null }; const inp = L.moneyInput(x.annual || null, { 'aria-label': 'Annual budget for ' + a.name, class: 'bd-in', 'data-acct': a.id }); inputs[a.id] = inp;
      const pct = x.pct == null ? 0 : Math.min(100, x.pct), over = a.type === 'expense' ? x.actual > x.budget && x.budget > 0 : x.actual < x.budget;
      return h('tr', null, h('td', null, a.name), h('td', { class: 'num' }, inp), L.num(C.fmt(x.budget)), L.num(C.fmt(x.actual)), L.num(x.budget || x.actual ? C.fmt(x.variance) : '-', sign(x.variance)), h('td', { class: 'meter-cell' }, x.pct == null ? h('span', { class: 'muted small' }, 'no budget') : h('div', { class: 'meter' + (over ? ' over' : ''), title: x.pct + '%' }, h('i', { style: 'width:' + pct + '%' }), h('span', null, x.pct + '%')))); };
    const addSel = L.select([['', '+ Budget another category']].concat(st.accounts.filter(a => (a.type === 'income' || a.type === 'expense') && !show.has(a.id)).map(a => [a.id, a.name])), '', { id: 'bd-add', 'aria-label': 'Add a category' });
    addSel.onchange = () => { if (addSel.value) { bud.add = (bud.add || []).concat([addSel.value]); L.render(); } };
    const save = guard(() => { let n = 0; Object.keys(inputs).forEach(id => { const v = inputs[id].value.trim(), cents = v ? parseMoney(v, 'Budget') : 0, cur = st.budgets.find(b => b.year === bud.year && b.acct === id);
      if (cur && cur.months.reduce((s, m) => s + m, 0) === cents) return; C.setBudget(st, bud.year, id, C.spread(cents)); n++; }); bud.add = []; L.commit(); L.toast(n ? 'Budgets saved.' : 'No changes.'); });
    const copy = guard(() => { const p = C.profitLoss(st, (bud.year - 1) + '-01-01', (bud.year - 1) + '-12-31'); let n = 0; p.income.concat(p.expenses).forEach(x => { C.setBudget(st, bud.year, x.acct, C.spread(x.amount)); n++; }); L.commit(); L.toast(n ? 'Filled ' + n + ' budgets from last year.' : 'Last year has no income or expenses to copy.'); });
    const tbl = (type, title) => { const list = accts.filter(a => a.type === type); return [h('tr', { class: 'sec' }, h('td', { colspan: 6 }, title))].concat(list.length ? list.map(rowFor) : [h('tr', null, h('td', { colspan: 6, class: 'muted' }, 'None yet'))]); };
    return h('div', { class: 'stack' }, head('Budgets', h('button', { class: 'btn', id: 'bd-copy', onclick: copy }, 'Fill from last year'), h('button', { class: 'btn primary', id: 'bd-save', onclick: save }, 'Save budgets')),
      h('div', { class: 'card row' }, L.field('Year', yr), L.field('Compare', th), L.field('Add', addSel)),
      h('div', { class: 'grid3' }, stat('Income vs budget', C.fmt(r.income.actual), 'budget ' + C.fmt(r.income.budget), sign(r.income.actual - r.income.budget)), stat('Expenses vs budget', C.fmt(r.expenses.actual), 'budget ' + C.fmt(r.expenses.budget), sign(r.expenses.budget - r.expenses.actual)), stat('Net vs budget', C.fmt(r.net.actual), 'budget ' + C.fmt(r.net.budget), sign(r.net.actual - r.net.budget), 'bd-net')),
      h('div', { class: 'card' }, h('div', { class: 'scroll' }, h('table', { class: 'tbl rpt budget' }, h('thead', null, h('tr', null, h('th', null, 'Category'), h('th', { class: 'num' }, 'Annual budget'), h('th', { class: 'num' }, 'Budget to date'), h('th', { class: 'num' }, 'Actual'), h('th', { class: 'num' }, 'Variance'), h('th', null, 'Used'))), h('tbody', null, tbl('income', 'Income'), tbl('expense', 'Expenses')))),
        h('p', { class: 'muted small' }, 'Annual amounts are spread evenly across the twelve months. A positive variance is good news: more income or less spending than planned.')));
  };

  /* ---------- cash-flow forecast ---------- */
  let fc = { weeks: 13 };
  R.forecast = function () {
    const st = L.st, t = C.today(), f = C.forecast(st, t, fc.weeks); const ws = L.select([['13', 'Next 13 weeks'], ['26', 'Next 26 weeks']], String(fc.weeks), { id: 'fc-weeks', 'aria-label': 'Horizon' }); ws.onchange = () => { fc.weeks = +ws.value; L.render(); };
    const max = Math.max(1, ...f.weeks.map(w => Math.abs(w.balance)));
    const bars = h('div', { class: 'bars fc', role: 'img', 'aria-label': 'Projected cash balance by week' }, f.weeks.map(w => h('div', { class: 'bargrp' }, h('div', { class: 'pair' }, h('div', { class: 'bar ' + (w.balance < 0 ? 'neg' : 'inc'), style: 'height:' + Math.max(2, Math.round(Math.abs(w.balance) / max * 100)) + '%', title: w.from + ': ' + C.fmt(w.balance) })), h('div', { class: 'lab' }, w.from.slice(5)))));
    return h('div', { class: 'stack' }, head('Cash forecast', ws),
      h('div', { class: 'grid3' }, stat('Cash today', C.fmt(f.start), 'cash accounts'), stat('Lowest point', C.fmt(f.low.balance), 'week of ' + f.low.from, f.low.balance < 0 ? 'neg' : '', 'fc-low'), stat('In ' + fc.weeks + ' weeks', C.fmt(f.finish), 'by ' + f.end, sign(f.finish))),
      h('div', { class: 'card' }, h('h2', null, 'Projected balance'), bars), L.whatIfCard ? L.whatIfCard(fc.weeks) : null,
      h('div', { class: 'grid2' }, h('div', { class: 'card' }, L.table(['Week of', { t: 'In', cls: 'num' }, { t: 'Out', cls: 'num' }, { t: 'Balance', cls: 'num' }], f.weeks.map(w => h('tr', null, h('td', null, w.from), L.num(w.inflow ? C.fmt(w.inflow) : '-', 'pos'), L.num(w.outflow ? C.fmt(-w.outflow) : '-'), L.num(C.fmt(w.balance), w.balance < 0 ? 'neg' : 'strong'))), 'fcweeks')),
        h('div', { class: 'card' }, h('h2', null, 'What is expected'), f.events.length ? L.table(['Date', 'What', { t: 'Amount', cls: 'num' }], f.events.slice(0, 40).map(e => h('tr', null, h('td', null, e.date), h('td', null, e.label, e.late ? h('span', { class: 'tag' }, 'overdue') : null), L.num(C.fmt(e.amount), e.amount < 0 ? 'neg' : 'pos')))) : empty('Nothing scheduled. Open invoices, bills and recurring items appear here.'))),
      L.guide('A projection, not a promise. It assumes clients pay on the due date (overdue invoices this week), bills are paid on their due date, and recurring expenses and invoices continue. It leaves out sales tax payments, owner draws and anything not yet in the books.'));
  };

  /* ---------- balance sheet, year-end close, accountant package ---------- */
  L.bsCard = function (asOf) {
    const b = C.balanceSheet(L.st, asOf), sec = (title, items, extra, total) => [h('tr', { class: 'sec' }, h('td', { colspan: 2 }, title))].concat(items.map(x => h('tr', null, h('td', null, x.name), L.num(C.fmt(x.amount)))), extra || [], [h('tr', { class: 'foot' }, h('td', null, 'Total ' + title.toLowerCase()), L.num(C.fmt(total)))]);
    return h('div', { class: 'card', id: 'bs' }, h('h2', null, 'Balance sheet as of ' + asOf), h('div', { class: 'scroll' }, h('table', { class: 'tbl rpt' }, h('tbody', null, sec('Assets', b.assets, null, b.totalAssets), sec('Liabilities', b.liabilities, null, b.totalLiabilities),
      sec('Equity', b.equity, [h('tr', null, h('td', null, 'Retained earnings (earlier years)'), L.num(C.fmt(b.retained))), h('tr', null, h('td', null, 'Earnings this year'), L.num(C.fmt(b.current)))], b.totalEquity), h('tr', { class: 'grand' }, h('td', null, 'Liabilities and equity'), L.num(C.fmt(b.totalLiabilities + b.totalEquity)))))),
      h('p', { class: b.balanced ? 'pos' : 'neg' }, b.balanced ? 'Balanced: assets equal liabilities plus equity.' : 'Out of balance!'));
  };
  let ye = { asOf: null };
  R.yearend = function () {
    const st = L.st, t = C.today(), cy = +t.slice(0, 4), lock = st.settings.lockDate; ye.asOf = ye.asOf || t;
    const asOf = dateInput(ye.asOf, 'bs-date'); asOf.addEventListener('change', () => { ye.asOf = asOf.value || ye.asOf; L.render(); });
    const first = st.entries.reduce((m, e) => Math.min(m, +e.date.slice(0, 4)), cy - 1), lockY = lock ? +lock.slice(0, 4) : first - 1, years = []; for (let y = cy - 1; y > lockY && y >= first; y--) years.push(y);
    const ySel = years.length ? L.select(years.slice().reverse().map(y => [String(y), String(y)]), String(lockY + 1), { id: 'ye-year', 'aria-label': 'Year to close' }) : null;
    const close = guard(() => { const y = +ySel.value; L.confirm('Close ' + y + '? Nothing dated on or before ' + y + '-12-31 can be added, changed or deleted until you reopen it.', 'Close year', guard(() => { const rec = C.closeYear(st, y, t); L.commit(); L.toast(y + ' closed. Net profit ' + C.fmt(rec.net) + '.'); })); });
    const last = st.closings.slice().sort((a, b) => b.year - a.year)[0];
    const pkYear = L.select([cy, cy - 1, cy - 2].map(y => [String(y), String(y)]), String(cy - 1), { id: 'acct-year', 'aria-label': 'Year' });
    const pkg = guard(() => { const y = +pkYear.value, from = y + '-01-01', to = y === cy ? t : y + '-12-31'; const zip = C.zipStore(C.accountantFiles(st, from, to, t), t); L.download('stark-ledger-accountant-' + y + '.zip', zip, 'application/zip'); L.toast('Accountant package saved to your downloads.'); });
    return h('div', { class: 'stack' }, head('Year-end'),
      h('div', { class: 'card stack' }, h('h2', null, 'Close a year'), h('p', { class: lock ? 'note' : 'muted', id: 'ye-lock' }, lock ? 'The books are closed through ' + lock + '. Entries on or before that date can not be added, changed or deleted.' : 'No year is closed yet. Closing locks a finished year so nothing in it can change by accident.'),
        ySel ? h('div', { class: 'row' }, L.field('Year', ySel), h('button', { class: 'btn primary', id: 'ye-close', onclick: close }, 'Close year')) : h('p', { class: 'muted' }, 'Nothing to close: only finished years can be closed.'),
        st.closings.length ? L.table(['Year', 'Closed on', { t: 'Net profit', cls: 'num' }, { t: 'Total assets', cls: 'num' }, ''], st.closings.slice().sort((a, b) => b.year - a.year).map(c => h('tr', null, h('td', null, String(c.year)), h('td', null, c.closedOn), L.num(C.fmt(c.net)), L.num(C.fmt(c.assets)),
          h('td', { class: 'acts' }, c === last ? h('button', { class: 'btn sm danger', id: 'ye-reopen', onclick: () => L.confirm('Reopen ' + c.year + '? Its entries can be changed again until you close it again.', 'Reopen', guard(() => { C.reopenYear(st, c.year); L.commit(); L.toast(c.year + ' reopened.'); }), true) }, 'Reopen') : null)))) : null),
      h('div', { class: 'card stack' }, h('h2', null, 'Accountant package'), h('p', { class: 'muted' }, 'One zip with the journal, general ledger, trial balance, chart of accounts, profit and loss, balance sheet, Schedule C guide, invoices, bills, open receivables and payables, sales tax, inventory, mileage and time, as CSV files most accounting programs and spreadsheets import. Not encrypted: store it safely.'),
        h('div', { class: 'row' }, L.field('Year', pkYear), h('button', { class: 'btn primary', id: 'acct-zip', onclick: pkg }, 'Download accountant package (.zip)'))),
      h('div', { class: 'card no-print row' }, L.field('Balance sheet as of', asOf), h('button', { class: 'btn', onclick: () => window.print() }, 'Print / save as PDF')), L.bsCard(ye.asOf),
      L.guide('Closing is a lock, not a tax filing. Retained earnings are worked out from the books, so no closing entry is posted. Not tax advice.'));
  };
})();
