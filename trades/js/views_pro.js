/* Stark Trades 2.1. Service plans and recurring jobs, van stock and purchase orders, timesheets and certifications, safety,
   permits by jurisdiction, the quote-to-cash pipeline, customer status and photo reports, and quick search (Ctrl+K). */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, t = C.t, tn = C.tn, tt = C.tt;
  const T = () => C.today(), stat = (k, v, sub, id) => L.stat(k, v, sub, id);
  const tabs = (base, list, cur) => h('div', { class: 'tabs', role: 'tablist' }, list.map(x => h('a', { class: 'tab', role: 'tab', href: '#/' + base + '/' + x[0], 'aria-selected': x[0] === cur ? 'true' : 'false' }, t(x[1]))));
  const custOpts = none => [['', none || t('Choose a customer')]].concat(L.st.customers.map(c => [c.id, c.name]));
  const jobOpts = (none, all) => [['', none || t('Choose a job')]].concat(L.st.jobs.filter(j => all || j.stage !== 'paid').map(j => [j.id, j.num + ' ' + tt(j.title)]));
  const locOpts = () => L.st.company.stockLocs.map(l => [l, tt(l)]);
  const keep = (v, old) => v === tt(old) ? old : v;
  const qty = (v, what) => { const q = C.toMilli(String(v || '').trim()); if (isNaN(q)) throw new Error(t('Enter {what} as a number, like 2 or 1.5', { what })); return q; };
  const pct = (v, what, max) => { const b = C.toBps(String(v || '0')); if (isNaN(b) || b > max) throw new Error(t('{what} must be a percent up to {max}', { what, max: max / 100 })); return b; };
  const int = (v, what, a, b) => { const n = parseInt(v, 10); if (isNaN(n) || n < a || n > b) throw new Error(t('{what} must be a whole number from {a} to {b}', { what, a, b })); return n; };
  const hrs = v => { const x = parseFloat(String(v || '0').replace(',', '.')); if (isNaN(x) || x < 0 || x > 200) throw new Error(t('Hours must be a number from 0 to 200')); return Math.round(x * 100); };
  const guarded = fn => () => { try { fn(); } catch (e) { L.toast(e.message, true); } };

  /* ================= service agreements and recurring jobs ================= */
  L.routes.service = function (tab) {
    const st = L.st, d = T(), s = C.planSummary(st, d); tab = tab === 'recurring' ? 'recurring' : 'plans';
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('h1', null, t('Service plans and recurring jobs')), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'add-rec', onclick: () => recDialog() }, t('+ Recurring job')), h('button', { class: 'btn primary', type: 'button', id: 'add-plan', onclick: () => L.planDialog() }, t('+ Service agreement')))),
      h('div', { class: 'grid4' }, stat(t('Active agreements'), String(s.active), tn(s.members, '{n} customer', '{n} customers')), stat(t('Recurring revenue'), C.fmt0(s.monthly) + t('/mo'), t('about {amt} a year', { amt: C.fmt0(s.annual) })),
        stat(t('Renewals due'), String(s.renewSoon), t('ending within 30 days')), stat(t('Plan bills unpaid'), C.fmt(s.owed), t('sent, not yet paid'))),
      tabs('service', [['plans', C.N('Service agreements')], ['recurring', C.N('Recurring jobs')]], tab), tab === 'plans' ? plansTab() : recTab());
  };
  function plansTab() {
    const st = L.st, d = T();
    const rows = st.plans.map(p => { const s = C.planStatus(st, p, d), cu = C.customer(st, p.customerId), pr = C.planProfit(st, p);
      const chip = s.state === 'cancelled' ? L.chip(t('Cancelled'), 'dim') : s.state === 'ended' ? L.chip(t('Ended'), 'red') : s.state === 'renew' ? L.chip(t('Renew by {date}', { date: C.fmtShort(s.end) }), 'amber') : L.chip(t('Active'), 'green');
      return h('tr', null, h('td', null, h('b', null, p.num + ' ' + tt(p.title)), h('div', { class: 'fine' }, (cu ? cu.name : '-') + (p.city ? ' · ' + p.city : ''))),
        h('td', null, C.fmtShort(p.start) + ' - ' + C.fmtShort(C.addDays(s.end, -1)), h('div', { class: 'fine' }, p.autoRenew ? t('renews') : t('no auto-renew'))),
        h('td', null, t('{a} of {b} made', { a: s.visitsMade, b: s.visitsPlanned }), h('div', { class: 'fine' }, t('{n} done', { n: s.visitsDone }))),
        L.num(C.fmt(p.price), ''), h('td', null, s.nextBill ? (s.billDue ? L.chip(t('{amt} ready to bill', { amt: C.fmt(s.nextBill.amount) }), 'blue') : C.fmtShort(s.nextBill.date) + ' · ' + C.fmt(s.nextBill.amount)) : t('all billed'), s.owed ? h('div', { class: 'fine c-amber' }, t('{amt} unpaid', { amt: C.fmt(s.owed) })) : null),
        h('td', null, chip, h('div', { class: 'fine' }, t('margin {pct}', { pct: C.fmtBps(pr.marginBps) }))),
        h('td', { class: 'acts' }, h('button', { class: 'btn sm', type: 'button', 'data-bills': p.id, onclick: () => billsDialog(p) }, t('Bills')),
          (s.state === 'renew' || s.state === 'ended') && p.status !== 'cancelled' ? h('button', { class: 'btn sm', type: 'button', 'data-renew': p.id, onclick: () => renewDialog(p) }, t('Renew')) : null,
          h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('service agreement {num}', { num: p.num }), [L.addressChoice('full'), { key: 'customer', label: t('Include customer name'), value: true }], o => C.planDoc(st, p.id, o, d)) }, t('Print')),
          p.status !== 'cancelled' ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => L.confirm(t('Cancel {num}? Future visits stop being created.', { num: p.num }), t('Cancel agreement'), () => { C.cancelPlan(st, p.id, d); L.commit(); }, true) }, t('Cancel')) : null));
    });
    return h('section', { class: 'card' }, rows.length ? L.table([t('Agreement'), t('Term'), t('Visits'), { t: t('Per year'), cls: 'num' }, t('Next bill'), t('Status'), ''], rows, 'plans') : L.empty(t('No service agreements yet. A yearly maintenance plan turns one-time customers into steady work.'), t('+ Service agreement'), () => L.planDialog(), 'empty-plan'),
      h('p', { class: 'fine' }, t('Each agreement creates its visits as recurring jobs. Margin compares the term price with the cost of the visit jobs so far. Agreement text is a template; have a lawyer review it.')));
  }
  L.planDialog = function () {
    const st = L.st, d = T();
    const f = { cust: L.select(custOpts(), '', { id: 'pl-cust' }), title: L.input({ name: 'title', id: 'pl-title', placeholder: t('Yearly water heater service') }), street: L.input({ name: 'street' }), city: L.input({ name: 'city' }), trade: L.select(L.tradeOpts(t('Any trade')), ''),
      start: L.date(d, { id: 'pl-start' }), first: L.date(d, { id: 'pl-first' }), term: L.input({ value: '12', inputmode: 'numeric', id: 'pl-term' }), price: L.money('', { name: 'price', id: 'pl-price' }), bill: L.select(C.BILL_EVERY.map(b => [b[0], t(b[1])]), 'year', { id: 'pl-bill' }),
      visits: L.input({ value: '1', inputmode: 'numeric', id: 'pl-visits' }), hours: L.input({ value: '1.5', inputmode: 'decimal', id: 'pl-hours' }), who: L.select(L.who(), ''), covers: L.area('', { name: 'covers', id: 'pl-covers' }),
      disc: L.input({ value: '10', inputmode: 'decimal', id: 'pl-disc' }), renew: h('input', { type: 'checkbox', checked: true, id: 'pl-renew' }) };
    L.modal(t('New service agreement'), close => L.form({ id: 'plan-form' }, [h('div', { class: 'grid2' }, L.field(t('Customer'), f.cust), L.field(t('Plan name'), f.title)), h('div', { class: 'grid3' }, L.field(t('Service street'), f.street), L.field(t('City'), f.city), L.field(t('Trade'), f.trade)),
      h('div', { class: 'grid4' }, L.field(t('Starts'), f.start), L.field(t('Term (months)'), f.term), L.field(t('Price per year'), f.price), L.field(t('Billing'), f.bill)),
      h('div', { class: 'grid4' }, L.field(t('Visits per year'), f.visits), L.field(t('First visit'), f.first), L.field(t('Hours per visit'), f.hours), L.field(t('Who goes'), f.who)),
      L.field(t('Each visit covers'), f.covers, t('For example: flush tank, check anode and relief valve, inspect venting.')), h('div', { class: 'grid2' }, L.field(t('Member discount on repairs (%)'), f.disc), h('label', { class: 'check' }, f.renew, h('span', null, t('Renews automatically')))), L.actions(close, t('Create agreement'))], () => {
      const p = C.addPlan(st, { customerId: f.cust.value, title: f.title.value, street: f.street.value, city: f.city.value, trade: f.trade.value, start: f.start.value, firstVisit: f.first.value, termMonths: int(f.term.value, t('The term'), 1, 60), price: L.cents(f.price.value, t('the yearly price')),
        billEvery: f.bill.value, visits: int(f.visits.value, t('Visits per year'), 1, 52), visitHours: hrs(f.hours.value), who: L.parseWho(f.who.value), covers: f.covers.value, discountBps: pct(f.disc.value, t('The discount'), 5000), autoRenew: f.renew.checked }, d);
      close(); L.commit(); L.toast(t('{num} created with its visit schedule', { num: p.num })); }), true);
  };
  function billsDialog(p) {
    const st = L.st, d = T(), s = C.planStatus(st, p, d), date = L.date(d, { id: 'pb-date' });
    L.modal(t('Bills for {num}', { num: p.num }), close => h('div', { class: 'stack' },
      L.table([t('Period'), { t: t('Amount'), cls: 'num' }, t('Invoice'), t('Status'), ''], s.schedule.map((x, i) => { const b = p.bills[i];
        return h('tr', null, h('td', null, C.fmtDate(x.date)), L.num(C.fmt(x.amount)), h('td', null, b ? b.num : '-'), h('td', null, !b ? L.chip(t('not billed'), 'dim') : b.paid ? L.chip(t('Paid {date}', { date: C.fmtShort(b.paidDate) }), 'green') : b.dueDate < d ? L.chip(t('overdue {date}', { date: C.fmtShort(b.dueDate) }), 'red') : L.chip(t('due {date}', { date: C.fmtShort(b.dueDate) }), 'amber')),
          h('td', { class: 'acts' }, b && !b.paid ? h('button', { class: 'btn sm', type: 'button', onclick: guarded(() => { C.payPlanBill(st, p.id, b.id, d); close(); L.commit(); }) }, t('Mark paid')) : null)); })),
      s.nextBill && p.status !== 'cancelled' ? h('div', { class: 'row' }, L.field(t('Bill date'), date), h('button', { class: 'btn primary', type: 'button', id: 'pb-make', onclick: guarded(() => { const b = C.billPlan(st, p.id, date.value, d); close(); L.commit(); L.toast(t('{num} for {amt} recorded. Send it to the customer.', { num: b.num, amt: C.fmt(b.amount) })); }) }, t('Make the next bill'))) : h('p', { class: 'muted' }, t('Every bill for this term has been made.')),
      h('p', { class: 'fine' }, t('Bills are records for your books; Stark Trades does not send or collect payments.'))), true);
  }
  function renewDialog(p) {
    const raise = L.input({ value: '3', inputmode: 'decimal', id: 'rn-raise' });
    L.modal(t('Renew {num}', { num: p.num }), close => L.form({}, [h('p', null, t('The new term starts when this one ends, at the price below.')), L.field(t('Price increase (%)'), raise, t('Current price {amt} per year', { amt: C.fmt(p.price) })), L.actions(close, t('Renew'))], () => {
      C.renewPlan(L.st, p.id, pct(raise.value, t('The increase'), 5000), T()); close(); L.commit(); L.toast(t('Renewed. New price {amt} per year.', { amt: C.fmt(p.price) })); }));
  }
  function recTab() {
    const st = L.st, d = T(), due = C.recurringDue(st, d, 14);
    const unit = r => r.unit === 'week' ? tn(r.every, 'every week', 'every {n} weeks') : tn(r.every, 'every month', 'every {n} months');
    const rows = st.recurring.map(r => { const cu = C.customer(st, r.customerId), p = st.plans.find(x => x.id === r.planId);
      return h('tr', { class: r.active ? '' : 'dim' }, h('td', null, h('b', null, tt(r.title)), h('div', { class: 'fine' }, (cu ? cu.name : t('No customer')) + (p ? ' · ' + p.num : ''))), h('td', null, unit(r), r.until ? h('div', { class: 'fine' }, t('until {date}', { date: C.fmtShort(r.until) })) : null),
        h('td', null, r.active ? C.upcoming(r, 3).map(x => C.fmtShort(x)).join(', ') : t('stopped')), L.num(String(r.made.length)),
        h('td', { class: 'acts' }, r.active ? h('button', { class: 'btn sm', type: 'button', 'data-spawn': r.id, onclick: guarded(() => { const j = C.spawnRecurring(st, r.id, d); L.commit(); L.toast(t('{num} scheduled for {date}', { num: j.num, date: C.fmtShort(j.start) })); }) }, t('Create next visit')) : null,
          !r.planId ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { r.active = !r.active; r.u = Date.now(); L.commit(); } }, r.active ? t('Pause') : t('Resume')) : null)); });
    return h('section', { class: 'card stack' }, h('div', { class: 'row' }, h('p', { class: 'grow muted small' }, tn(due.length, '{n} visit is due in the next 14 days.', '{n} visits are due in the next 14 days.')),
      h('button', { class: 'btn', type: 'button', id: 'spawn-due', disabled: !due.length, onclick: guarded(() => { const r = C.spawnDue(st, d, 14); L.commit(); L.toast(tn(r.jobs.length, '{n} job created', '{n} jobs created') + (r.skipped ? ' ' + tn(r.skipped, '({n} old missed visit skipped)', '({n} old missed visits skipped)') : '')); }) }, t('Create the visits due in 14 days'))),
      rows.length ? L.table([t('Recurring job'), t('Repeats'), t('Next dates'), { t: t('Jobs made'), cls: 'num' }, ''], rows, 'recur') : L.empty(t('No recurring jobs. Use them for grease traps, backflow tests, filter changes or any route work.'), t('+ Recurring job'), () => recDialog(), 'empty-rec'),
      h('p', { class: 'fine' }, t('Each visit becomes a normal job on the schedule. If a visit date has passed, the latest one is booked from today and older ones are skipped.')));
  }
  function recDialog() {
    const st = L.st, d = T();
    const f = { cust: L.select(custOpts(t('No customer')), ''), title: L.input({ name: 'title', id: 'rc-title' }), street: L.input({ name: 'street' }), city: L.input({ name: 'city' }), trade: L.select(L.tradeOpts(t('Any trade')), ''),
      first: L.date(d, { id: 'rc-first' }), every: L.input({ value: '1', inputmode: 'numeric', id: 'rc-every' }), unit: L.select([['month', t('months')], ['week', t('weeks')]], 'month', { id: 'rc-unit' }), until: L.date(''), base: L.money('', { name: 'base', id: 'rc-base' }), hours: L.input({ value: '1', inputmode: 'decimal' }), who: L.select(L.who(), '') };
    L.modal(t('New recurring job'), close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('What is the job?'), f.title), L.field(t('Customer'), f.cust)), h('div', { class: 'grid3' }, L.field(t('Site street'), f.street), L.field(t('City'), f.city), L.field(t('Trade'), f.trade)),
      h('div', { class: 'grid4' }, L.field(t('First visit'), f.first), L.field(t('Repeat every'), f.every), L.field(t('Unit'), f.unit), L.field(t('Stop after (optional)'), f.until)), h('div', { class: 'grid3' }, L.field(t('Price per visit'), f.base), L.field(t('Hours per visit'), f.hours), L.field(t('Who goes'), f.who)), L.actions(close, t('Save'))], () => {
      C.addRecurring(st, { customerId: f.cust.value, title: f.title.value, street: f.street.value, city: f.city.value, trade: f.trade.value, first: f.first.value, every: f.every.value, unit: f.unit.value, until: f.until.value, base: f.base.value ? L.cents(f.base.value, t('the price')) : 0, hours: hrs(f.hours.value), who: L.parseWho(f.who.value) });
      close(); L.go('#/service/recurring'); L.commit(); }), true);
  }

  /* ================= van stock and purchase orders ================= */
  L.routes.stock = function (tab) {
    const st = L.st, d = T(), v = C.stockValue(st), low = C.lowStock(st), open = st.pos.filter(p => p.status === 'sent' || p.status === 'partial'), late = C.poLate(st, d); tab = tab === 'orders' ? 'orders' : 'stock';
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('h1', null, t('Van stock and purchase orders')), h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => L.exportFlow(t('stock list (CSV)'), [], () => ({ csv: true, text: C.stockCSV(st), name: 'stock.csv', title: t('Stock') }), { noPrint: true }) }, t('Export CSV')),
        h('button', { class: 'btn', type: 'button', id: 'add-part', onclick: () => partDialog() }, t('+ Part')), h('button', { class: 'btn primary', type: 'button', id: 'add-po', onclick: () => L.poDialog() }, t('+ Purchase order')))),
      h('div', { class: 'grid4' }, stat(t('Stock on hand'), C.fmt0(v.total), st.company.stockLocs.map(l => tt(l) + ' ' + C.fmt0(v.by[l])).join(' · ')), stat(t('Below par'), String(low.length), t('parts to refill or order')),
        stat(t('Open orders'), String(open.length), C.fmt0(open.reduce((a, p) => a + C.poTotals(p).total, 0))), stat(t('Late orders'), String(late.length), t('past the needed-by date'))),
      tabs('stock', [['stock', C.N('Stock by location')], ['orders', C.N('Purchase orders')]], tab), tab === 'stock' ? stockTab() : ordersTab());
  };
  function stockTab() {
    const st = L.st, d = T(), locs = st.company.stockLocs, shop = locs[0];
    const rows = st.stock.map(it => h('tr', null, h('td', null, h('b', null, tt(it.name)), h('div', { class: 'fine' }, [it.sku, it.supplier].filter(Boolean).join(' · '))), L.num(C.fmt(it.cost) + '/' + tt(it.unit)),
      locs.map(l => { const q = C.qtyAt(it, l), par = it.par[l] || 0; return h('td', { class: 'num' + (par && q < par ? ' c-amber' : '') }, C.fmtMilli(q), par ? h('div', { class: 'fine' }, t('par {n}', { n: C.fmtMilli(par) })) : null); }),
      h('td', { class: 'acts' }, h('button', { class: 'btn sm', type: 'button', 'data-move': it.id, onclick: () => moveDialog(it) }, t('Move')), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => partDialog(it) }, t('Edit')))));
    const vans = locs.slice(1).map(l => ({ l, r: C.refills(st, l) })).filter(x => x.r.length), shopLow = C.refills(st, shop);
    return h('div', { class: 'stack' },
      vans.length || shopLow.length ? h('section', { class: 'card', id: 'refills' }, h('h2', null, t('Refills')), vans.map(x => h('div', { class: 'row' }, h('span', { class: 'grow' }, h('b', null, tt(x.l)), ': ', x.r.map(r => tt(r.item.name) + ' ' + C.fmtMilli(r.have) + '/' + C.fmtMilli(r.par)).join(', ')),
        h('button', { class: 'btn sm', type: 'button', 'data-refill': x.l, onclick: guarded(() => { const r = C.restockVan(st, x.l, d); L.commit(); L.toast(tn(r.moved.length, '{n} part moved from the shop', '{n} parts moved from the shop') + (r.short.length ? ' ' + tn(r.short.length, '{n} is short at the shop: order it.', '{n} are short at the shop: order them.') : '')); }) }, t('Refill from {loc}', { loc: tt(shop) })))),
        shopLow.length ? h('div', { class: 'row' }, h('span', { class: 'grow' }, h('b', null, tt(shop)), ': ', shopLow.map(r => tt(r.item.name) + ' ' + C.fmtMilli(r.have) + '/' + C.fmtMilli(r.par)).join(', ')), h('button', { class: 'btn sm', type: 'button', id: 'order-refills', onclick: guarded(() => { const po = C.poFromRefills(st, '', d); L.commit(); L.go('#/stock/orders'); L.toast(t('{num} drafted. Check it, then send it.', { num: po.num })); }) }, t('Draft an order'))) : null) : null,
      h('section', { class: 'card' }, rows.length ? L.table([t('Part'), { t: t('Unit cost'), cls: 'num' }].concat(locs.map(l => ({ t: tt(l), cls: 'num' })), ['']), rows, 'stock') : L.empty(t('No parts yet. Add the fittings, valves and supplies you keep on the vans.'), t('+ Part'), () => partDialog(), 'empty-part'),
        h('div', { class: 'row' }, h('p', { class: 'fine grow' }, t('Locations: {list}. The first one is where vans refill from.', { list: locs.map(tt).join(', ') })), h('button', { class: 'btn sm', type: 'button', onclick: () => locDialog() }, t('Edit locations'))),
        h('p', { class: 'fine' }, t('Parts used on a job are added to that job’s material cost. Counts are what you type in; do a real count now and then.'))));
  }
  function partDialog(it) {
    const st = L.st, isNew = !it, locs = st.company.stockLocs; it = it || { name: '', sku: '', unit: 'each', cost: 0, supplier: '', par: {} };
    const f = { name: L.input({ name: 'name', value: tt(it.name), id: 'pt-name' }), sku: L.input({ name: 'sku', value: it.sku }), unit: L.input({ name: 'unit', value: tt(it.unit) }), cost: L.money(it.cost, { id: 'pt-cost' }), sup: L.input({ name: 'supplier', value: it.supplier }) };
    const pars = locs.map(l => L.input({ value: it.par[l] ? C.fmtMilli(it.par[l]) : '', inputmode: 'decimal', 'data-loc': l, 'aria-label': t('Par at {loc}', { loc: tt(l) }) }));
    L.modal(isNew ? t('New part') : t('Edit {name}', { name: tt(it.name) }), close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('Part'), f.name), L.field(t('SKU (optional)'), f.sku)), h('div', { class: 'grid3' }, L.field(t('Unit'), f.unit), L.field(t('Unit cost'), f.cost), L.field(t('Usual supplier'), f.sup)),
      h('fieldset', { class: 'checks' }, h('legend', null, t('Par level: how many you want on hand')), locs.map((l, i) => L.field(tt(l), pars[i]))), L.actions(close)], () => {
      const par = {}; pars.forEach(p => { if (p.value.trim()) { const q = qty(p.value, t('the par level')); if (q > 0) par[p.dataset.loc] = q; } });
      const vals = { name: keep(f.name.value.trim(), it.name), sku: f.sku.value, unit: keep(f.unit.value.trim(), it.unit), cost: L.cents(f.cost.value || '0', t('the unit cost')), supplier: f.sup.value, par };
      if (isNew) C.addStockItem(st, vals); else { if (!vals.name) throw new Error(t('Name the part')); if (vals.sku && st.stock.some(x => x !== it && x.sku && x.sku.toLowerCase() === vals.sku.trim().toLowerCase())) throw new Error(t('Another part already uses SKU {sku}', { sku: vals.sku.trim() })); Object.assign(it, vals, { sku: vals.sku.trim(), supplier: vals.supplier.trim(), u: Date.now() }); }
      close(); L.commit(); }), true);
  }
  function moveDialog(it, jobId) {
    const st = L.st, locs = locOpts();
    const kind = L.select([['use', t('Used on a job')], ['transfer', t('Move between locations')], ['receive', t('Received from a supplier')], ['count', t('Counted (set the amount)')]], jobId ? 'use' : 'transfer', { id: 'mv-kind' });
    const from = L.select(locs, st.company.stockLocs[1] || st.company.stockLocs[0], { id: 'mv-from' }), to = L.select(locs, st.company.stockLocs[0], { id: 'mv-to' }), q = L.input({ inputmode: 'decimal', id: 'mv-qty', value: '1' }), job = L.select(jobOpts(), jobId || '', { id: 'mv-job' });
    const fFrom = L.field(t('From'), from), fTo = L.field(t('To'), to), fJob = L.field(t('Job'), job);
    const sync = () => { const k = kind.value; fFrom.hidden = !(k === 'use' || k === 'transfer'); fTo.hidden = !(k === 'transfer' || k === 'receive' || k === 'count'); fJob.hidden = k !== 'use'; fTo.querySelector('.lbl').textContent = k === 'count' ? t('At') : t('To'); };
    kind.addEventListener('change', sync);
    L.modal(t('{name}: move or use', { name: tt(it.name) }), close => L.form({}, [h('p', { class: 'muted small' }, st.company.stockLocs.map(l => tt(l) + ' ' + C.fmtMilli(C.qtyAt(it, l))).join(' · ')), L.field(t('What happened'), kind), h('div', { class: 'grid3' }, fFrom, fTo, fJob), L.field(t('Quantity ({unit})', { unit: tt(it.unit) }), q), L.actions(close, t('Record'))], () => {
      const k = kind.value; C.moveStock(st, { itemId: it.id, kind: k, from: from.value, to: to.value, at: to.value, jobId: job.value, qty: qty(q.value, t('the quantity')) }, T()); close(); L.commit(); }));
    sync();
  }
  L.useStockDialog = function (jobId) {
    const st = L.st, have = st.stock.filter(it => C.qtyAll(it) > 0);
    if (!have.length) return L.toast(t('No parts in stock yet. Add them on the Stock page.'), true);
    const pick = L.select(have.map(it => [it.id, tt(it.name) + ' (' + C.fmtMilli(C.qtyAll(it)) + ' ' + tt(it.unit) + ')']), have[0].id, { id: 'us-item' });
    L.modal(t('Use stock on this job'), close => h('div', { class: 'stack' }, L.field(t('Part'), pick), h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: close }, t('Cancel')), h('button', { class: 'btn primary', type: 'button', id: 'us-next', onclick: () => { close(); moveDialog(st.stock.find(x => x.id === pick.value), jobId); } }, t('Next')))));
  };
  function locDialog() {
    const st = L.st, area = L.area(st.company.stockLocs.map(tt).join('\n'), { rows: 5, id: 'loc-list', name: 'locs' });
    L.modal(t('Stock locations'), close => L.form({}, [h('p', { class: 'muted small' }, t('One per line: the shop first, then each van. A location that still holds parts cannot be removed.')), area, L.actions(close)], () => {
      const old = st.company.stockLocs, list = area.value.split('\n').map(x => x.trim()).filter(Boolean).map(x => old.find(o => tt(o) === x) || x).filter((x, i, a) => a.indexOf(x) === i);
      if (!list.length) throw new Error(t('Keep at least one location'));
      const gone = old.filter(o => list.indexOf(o) < 0 && st.stock.some(it => C.qtyAt(it, o) > 0)); if (gone.length) throw new Error(t('{loc} still holds parts. Move them first.', { loc: tt(gone[0]) }));
      st.company.stockLocs = list; close(); L.commit(); }));
  }
  function ordersTab() {
    const st = L.st, d = T();
    const rows = st.pos.slice().reverse().map(po => { const x = C.poTotals(po), j = po.jobId ? C.job(st, po.jobId) : null, late = (po.status === 'sent' || po.status === 'partial') && po.needBy && po.needBy < d;
      const chip = L.chip(t(C.PO_STATES[po.status]), po.status === 'received' ? 'green' : po.status === 'cancelled' ? 'dim' : po.status === 'draft' ? '' : 'blue');
      return h('tr', null, h('td', null, h('b', null, po.num), h('div', { class: 'fine' }, po.supplier)), h('td', null, j ? h('a', { href: '#/job/' + j.id + '/profit' }, j.num) : tt(po.loc)),
        h('td', null, C.fmtShort(po.date), po.needBy ? h('div', { class: 'fine' + (late ? ' c-red' : '') }, t('needed {date}', { date: C.fmtShort(po.needBy) })) : null), L.num(C.fmt(x.total)), h('td', null, chip, po.paid ? L.chip(t('Paid {date}', { date: C.fmtShort(po.paidDate) }), 'green') : null),
        h('td', { class: 'acts' }, po.status === 'draft' ? h('button', { class: 'btn sm', type: 'button', 'data-send': po.id, onclick: guarded(() => { C.sendPO(st, po.id, d); L.commit(); }) }, t('Mark sent')) : null,
          po.status === 'sent' || po.status === 'partial' ? h('button', { class: 'btn sm', type: 'button', 'data-receive': po.id, onclick: () => receiveDialog(po) }, t('Receive')) : null,
          (po.status === 'received' || po.status === 'partial') && !po.paid ? h('button', { class: 'btn sm', type: 'button', 'data-paypo': po.id, onclick: guarded(() => { C.payPO(st, po.id, d); L.commit(); }) }, t('Mark paid')) : null,
          h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('purchase order {num}', { num: po.num }), [L.addressChoice('full'), { key: 'title', label: t('Include the job title'), value: false }], o => C.poDoc(st, po.id, o, d)) }, t('Print')),
          (po.status === 'draft' || po.status === 'sent') && !po.lines.some(l => l.got) ? h('button', { class: 'btn sm ghost', type: 'button', onclick: guarded(() => { C.cancelPO(st, po.id); L.commit(); }) }, t('Cancel')) : null)); });
    return h('section', { class: 'card' }, rows.length ? L.table([t('Order'), t('For'), t('Date'), { t: t('Total'), cls: 'num' }, t('Status'), ''], rows, 'pos') : L.empty(t('No purchase orders yet. Order parts for a job or to refill the vans; received parts add their cost to the job.'), t('+ Purchase order'), () => L.poDialog(), 'empty-po'),
      h('p', { class: 'fine' }, t('Orders for a job add their cost to that job when received; orders for a location add the parts to stock. Print or save the order and send it yourself; nothing is sent from here.')));
  }
  L.poDialog = function (jobId) {
    const st = L.st, d = T(), sups = Array.from(new Set(st.stock.map(i => i.supplier).concat(st.pos.map(p => p.supplier)).filter(Boolean)));
    const sup = L.input({ name: 'supplier', id: 'po-sup', list: 'po-sups' }), dl = h('datalist', { id: 'po-sups' }, sups.map(s => h('option', { value: s })));
    const dest = L.select(st.company.stockLocs.map(l => ['loc:' + l, t('Stock: {loc}', { loc: tt(l) })]).concat(jobOpts('', false).slice(1).map(o => ['job:' + o[0], t('Job {job}', { job: o[1] })])), jobId ? 'job:' + jobId : 'loc:' + st.company.stockLocs[0], { id: 'po-dest' });
    const need = L.date('', { id: 'po-need' }), notes = L.area('', { name: 'notes', rows: 2 }), rows = h('div', { class: 'stack', id: 'po-lines' });
    const itemOpts = [['', t('Other (type below)')]].concat(st.stock.map(i => [i.id, tt(i.name)]));
    const line = () => { const sel = L.select(itemOpts, '', { 'aria-label': t('Part') }), name = L.input({ 'aria-label': t('Item'), placeholder: t('Item'), name: 'item' }), q = L.input({ 'aria-label': t('Quantity'), inputmode: 'decimal', value: '1', class: 'short' }), c = L.money('', { 'aria-label': t('Unit cost'), class: 'short2' });
      sel.addEventListener('change', () => { const it = st.stock.find(x => x.id === sel.value); name.hidden = !!it; if (it) c.value = (it.cost / 100).toFixed(2); });
      return h('div', { class: 'row poline' }, sel, name, q, c, h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': t('Remove'), onclick: e => e.target.closest('.poline').remove() }, '✕')); };
    rows.appendChild(line());
    L.modal(t('New purchase order'), close => L.form({ id: 'po-form' }, [h('div', { class: 'grid3' }, L.field(t('Supplier'), sup), L.field(t('Deliver to'), dest), L.field(t('Needed by'), need)), dl, h('p', { class: 'fine' }, t('Each line: part, quantity, unit cost.')), rows,
      h('button', { class: 'btn sm', type: 'button', id: 'po-addline', onclick: () => rows.appendChild(line()) }, t('+ Line')), L.field(t('Notes for the supplier'), notes), L.actions(close, t('Save draft'))], () => {
      const lines = L.$$('.poline', rows).map(r => { const s = r.querySelector('select'), i = r.querySelectorAll('input'); return { stockId: s.value, name: i[0].value, qty: i[1].value.trim() ? qty(i[1].value, t('the quantity')) : 0, cost: i[2].value.trim() ? L.cents(i[2].value, t('the unit cost')) : undefined }; }).filter(l => l.stockId || l.name.trim());
      const v = dest.value, po = C.newPO(st, { supplier: sup.value, jobId: v.indexOf('job:') === 0 ? v.slice(4) : '', loc: v.indexOf('loc:') === 0 ? v.slice(4) : '', needBy: need.value, notes: notes.value, lines }, d);
      close(); L.commit(); L.toast(t('{num} saved as a draft', { num: po.num })); }), true);
  };
  function receiveDialog(po) {
    const st = L.st, date = L.date(T(), { id: 'rv-date' }), ins = {};
    const rows = po.lines.map(l => { ins[l.id] = L.input({ value: C.fmtMilli(l.qty - l.got), inputmode: 'decimal', class: 'short', 'aria-label': t('Arrived now') }); return h('tr', null, h('td', null, tt(l.name)), L.num(C.fmtMilli(l.qty)), L.num(C.fmtMilli(l.got)), h('td', { class: 'num' }, ins[l.id])); });
    L.modal(t('Receive {num}', { num: po.num }), close => L.form({}, [L.table([t('Item'), { t: t('Ordered'), cls: 'num' }, { t: t('Received before'), cls: 'num' }, { t: t('Arrived now'), cls: 'num' }], rows), L.field(t('Date received'), date), L.actions(close, t('Record delivery'))], () => {
      const got = {}; Object.keys(ins).forEach(id => { const v = ins[id].value.trim(); got[id] = v ? qty(v, t('the quantity')) : 0; }); C.receivePO(st, po.id, got, date.value, T()); close(); L.commit(); }), true);
  }

  /* ================= timesheets and certifications ================= */
  let tsWeek = null;
  L.routes.team = function (tab) {
    tab = tab === 'certs' ? 'certs' : 'time';
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, t('Timesheets and certifications')), tab === 'certs' ? h('button', { class: 'btn primary', type: 'button', id: 'add-cert', onclick: () => certDialog() }, t('+ Certification')) : null),
      tabs('team', [['time', C.N('Weekly timesheets')], ['certs', C.N('Certifications')]], tab), tab === 'time' ? timeTab() : certTab());
  };
  function timeTab() {
    const st = L.st, d = T(); tsWeek = tsWeek || C.addDays(C.weekOf(d), -7);
    const nav = h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { tsWeek = C.addDays(tsWeek, -7); L.render(); } }, '◀'), h('b', { id: 'ts-week' }, t('Week of {date}', { date: C.fmtDate(tsWeek) })), h('button', { class: 'btn sm', type: 'button', onclick: () => { tsWeek = C.addDays(tsWeek, 7); L.render(); } }, '▶'), h('span', { class: 'grow' }),
      h('button', { class: 'btn', type: 'button', onclick: () => L.exportFlow(t('timesheets (CSV)'), [], () => ({ csv: true, text: C.timesheetCSV(st, tsWeek), name: 'timesheets-' + tsWeek + '.csv', title: t('Timesheets') }), { noPrint: true }) }, t('Export CSV')));
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => C.addDays(tsWeek, i));
    const rows = st.crew.filter(c => c.active !== false).map(c => { const ts = C.timesheet(st, c.id, tsWeek);
      return h('tr', null, h('td', null, h('b', null, c.name), h('div', { class: 'fine' }, Object.keys(ts.byJob).join(', '))), ts.days.map(x => L.num(x.hours ? C.fmtHrs(x.hours) : '-')), L.num(h('b', null, C.fmtHrs(ts.total))), L.num(ts.over ? C.fmtHrs(ts.over) : '-', ts.over ? 'c-amber' : ''),
        h('td', { class: 'acts' }, ts.open ? L.chip(tn(ts.open, '{n} open entry', '{n} open entries'), 'amber') : ts.approved && !ts.changed ? L.chip(t('Approved {date}', { date: C.fmtShort(ts.approved.date) }), 'green') :
          ts.total ? h('button', { class: 'btn sm', type: 'button', 'data-approve': c.id, onclick: guarded(() => { C.approveTimesheet(st, c.id, tsWeek, st.company.name, d); L.commit(); }) }, ts.changed ? t('Approve again') : t('Approve')) : null)); });
    return h('section', { class: 'card stack' }, nav, rows.length ? L.table([t('Crew member')].concat(days.map(x => ({ t: C.dowName(C.dow(x)) + ' ' + x.slice(8), cls: 'num' })), [{ t: t('Total'), cls: 'num' }, { t: t('Over {h} h', { h: C.fmtHrs(st.company.otHours) }), cls: 'num' }, '']), rows, 'ts') : L.empty(t('No crew yet. Add yourself and anyone on payroll; their hours come from time in and out in field mode.'), t('+ Add crew member'), () => L.go('#/subs'), 'empty-ts-crew'),
      h('p', { class: 'fine' }, t('Hours come from time in and out in field mode. Over-40 is a weekly flag only; daily overtime, breaks and pay rules differ by state. Hand approved hours to whoever runs your payroll.')));
  }
  function certTab() {
    const st = L.st, d = T(), rows = [];
    st.crew.forEach(c => (c.certs || []).forEach(ce => { const s = C.certState(ce, d);
      rows.push(h('tr', { class: c.active === false ? 'dim' : '' }, h('td', null, h('b', null, c.name)), h('td', null, tt(ce.name), ce.issuer ? h('div', { class: 'fine' }, ce.issuer) : null), h('td', null, ce.number || '-'),
        h('td', null, s.none ? t('No expiry') : s.state === 'expired' ? L.chip(t('expired {date}', { date: C.fmtShort(ce.expires) }), 'red') : s.state === 'soon' ? L.chip(t('{n} days left', { n: s.days }), 'amber') : C.fmtDate(ce.expires)),
        h('td', { class: 'acts' }, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => L.confirm(t('Remove {cert} from {name}?', { cert: tt(ce.name), name: c.name }), t('Remove'), () => { c.certs = c.certs.filter(x => x !== ce); L.commit(); }, true) }, t('Remove'))))); }));
    const trade = L.select(L.tradeOpts(), st.trades[0], { id: 'cr-trade' }), cert = L.input({ id: 'cr-cert', list: 'cert-types', name: 'cert' });
    return h('div', { class: 'stack' }, h('section', { class: 'card' }, rows.length ? L.table([t('Crew member'), t('Certification'), t('Number'), t('Expires'), ''], rows, 'certs') : L.empty(t('No certifications recorded. Add backflow, med-gas or welding cards to get an alert before they expire.'), t('+ Certification'), () => certDialog(), 'empty-cert'),
      h('p', { class: 'fine' }, t('Alerts show 30, 14 and 7 days before a certification expires. Stark Trades cannot verify a card; check it with the issuer.'))),
      h('section', { class: 'card stack' }, h('h2', null, t('Required for a trade')), h('p', { class: 'muted small' }, t('When a crew member without a current certification is put on a task in that trade, you get a warning.')),
        st.certRules.length ? h('ul', { class: 'log', id: 'cert-rules' }, st.certRules.map(r => h('li', null, tt(r.trade) + ': ' + tt(r.cert) + ' ', h('button', { class: 'btn sm ghost', type: 'button', onclick: () => L.confirm(t('Stop requiring {cert} for {trade}?', { cert: tt(r.cert), trade: tt(r.trade) }), t('Remove'), () => { st.certRules = st.certRules.filter(x => x !== r); L.commit(); }, true) }, t('Remove'))))) : null,
        L.form({ id: 'cert-rule-form' }, [h('div', { class: 'row' }, L.field(t('Trade'), trade), L.field(t('Certification'), cert), h('button', { class: 'btn', type: 'submit' }, t('Add rule'))), certList()], () => { C.setCertRule(st, trade.value, cert.value); L.commit(); })));
  }
  const certList = () => h('datalist', { id: 'cert-types' }, C.CERT_TYPES.map(x => h('option', { value: t(x) })));
  function certDialog() {
    const st = L.st; if (!st.crew.length) return L.toast(t('Add crew members on the Sub bench page first.'), true);
    const who = L.select(st.crew.map(c => [c.id, c.name]), st.crew[0].id, { id: 'ce-crew' }), name = L.input({ id: 'ce-name', name: 'name', list: 'cert-types' }), num = L.input({ name: 'number', id: 'ce-num' }), iss = L.input({ name: 'issuer' }), exp = L.date('', { id: 'ce-exp' });
    L.modal(t('Add certification'), close => L.form({}, [L.field(t('Crew member'), who), h('div', { class: 'grid2' }, L.field(t('Certification'), name), L.field(t('Card or license number'), num)), certList(), h('div', { class: 'grid2' }, L.field(t('Issued by'), iss), L.field(t('Expires (leave empty if it does not)'), exp)), L.actions(close)], () => {
      const v = name.value.trim(), match = C.CERT_TYPES.find(x => t(x) === v); C.addCert(st, who.value, { name: match || v, number: num.value, issuer: iss.value, expires: exp.value }); close(); L.commit(); }));
  }

  /* ================= safety: toolbox talks and site checklists ================= */
  L.routes.safety = function () {
    const st = L.st, d = T(), s = C.safetySummary(st, d), checks = st.safety.filter(r => r.kind === 'check').slice().sort((a, b) => a.date < b.date ? 1 : -1);
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('h1', null, t('Safety')), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'add-check', onclick: () => L.checkDialog() }, t('+ Site checklist')), h('button', { class: 'btn primary', type: 'button', id: 'add-talk', onclick: () => L.talkDialog() }, t('+ Toolbox talk')))),
      h('div', { class: 'grid4' }, stat(t('Last toolbox talk'), s.since == null ? '-' : tn(s.since, '{n} day ago', '{n} days ago'), s.last ? C.talkTitle(s.last) : t('none yet')), stat(t('Talks in 30 days'), String(s.talks30), tn(s.missing.length, '{n} crew member missed them', '{n} crew members missed them')),
        stat(t('Open safety fixes'), String(s.fixes.length), t('from site checklists')), stat(t('Sites not checked this week'), String(s.unchecked.length), s.unchecked.map(j => j.num).join(', '))),
      s.fixes.length ? h('section', { class: 'card', id: 'fixes' }, h('h2', null, t('Fix these')), h('ul', { class: 'alerts' }, s.fixes.map(f => h('li', { class: 'al amber' }, L.dot('amber'), h('span', { class: 'grow' }, (f.job ? f.job.num + ': ' : '') + t(f.label) + ' (' + C.fmtShort(f.rec.date) + ')'), h('button', { class: 'btn sm', type: 'button', onclick: guarded(() => { C.fixSafety(st, f.rec.id, f.key, d); L.commit(); }) }, t('Fixed')))))) : null,
      h('div', { class: 'grid2' },
        h('section', { class: 'card' }, h('h2', null, t('Toolbox talks')), s.talks.length ? L.table([t('Date'), t('Topic'), t('Job'), { t: t('People'), cls: 'num' }, ''], s.talks.slice(0, 20).map(r => h('tr', null, h('td', { class: 'nw' }, C.fmtShort(r.date)), h('td', null, C.talkTitle(r)), h('td', { class: 'nw' }, (C.job(st, r.jobId) || {}).num || '-'), L.num(String(r.attendees.length)),
          h('td', { class: 'acts' }, h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('toolbox talk sign-in sheet'), [L.addressChoice('city')], o => C.talkDoc(st, r.id, o)) }, t('Sign-in sheet'))))), 'talks') : L.empty(t('No talks yet. Ten minutes on Monday morning is enough.'), t('+ Toolbox talk'), () => L.talkDialog(), 'empty-talk')),
        h('section', { class: 'card' }, h('h2', null, t('Who has had a talk lately')), s.crew.length ? h('ul', { class: 'comp-list', id: 'talk-crew' }, s.crew.map(x => h('li', null, L.dot(!x.last || x.last < C.addDays(d, -30) ? 'red' : 'green'), h('span', { class: 'grow' }, x.crew.name), x.last ? C.fmtShort(x.last) : t('never')))) : L.empty(t('No crew yet. Add crew members on the Sub bench page.'), t('+ Add crew member'), () => L.go('#/subs')))),
      h('section', { class: 'card' }, h('h2', null, t('Site checklists')), checks.length ? L.table([t('Date'), t('Job'), t('By'), t('Result'), ''], checks.slice(0, 20).map(r => { const v = Object.keys(r.items).map(k => r.items[k]), fix = v.filter(x => x === 'fix').length;
        return h('tr', null, h('td', null, C.fmtShort(r.date)), h('td', null, (C.job(st, r.jobId) || {}).num || '-'), h('td', null, r.by || '-'), h('td', null, L.chip(t('{n} OK', { n: v.filter(x => x === 'ok').length }), 'green'), fix ? L.chip(tn(fix, '{n} to fix', '{n} to fix'), 'amber') : null), h('td', { class: 'acts' }, h('button', { class: 'btn sm', type: 'button', onclick: () => viewCheck(r) }, t('View')))); }), 'sfchecks') : L.empty(t('No checklists yet. Walk the site with a short list and note what needs fixing.'), t('+ Site checklist'), () => L.checkDialog(), 'empty-check')),
      h('section', { class: 'card' }, h('h2', null, t('Talk library')), h('div', { class: 'grid2' }, C.TALKS.map(x => h('details', { class: 'talk' }, h('summary', null, t(x.title)), h('ol', null, x.points.map(p => h('li', null, t(p)))))))),
      h('p', { class: 'fine' }, t('General safety reminders, not a substitute for OSHA rules, your written safety program, site-specific training or a competent person on site.')));
  };
  L.talkDialog = function () {
    const st = L.st, d = T(), active = st.crew.filter(c => c.active !== false);
    const topic = L.select(C.TALKS.map(x => [x.key, t(x.title)]).concat([['', t('Other topic')]]), C.TALKS[0].key, { id: 'tk-topic' }), custom = L.input({ name: 'custom', id: 'tk-custom' }), job = L.select(jobOpts(t('No job (shop or office)')), '', { id: 'tk-job' }), date = L.date(d), leader = L.input({ name: 'leader', value: (active[0] || {}).name || '' }), notes = L.area('', { name: 'notes', rows: 2 });
    const boxes = active.map(c => L.check(c.name, true, { value: c.id })), pts = h('ol', { class: 'small', id: 'tk-points' }), fCustom = L.field(t('Topic'), custom);
    const sync = () => { const tk = C.talk(topic.value); L.clear(pts); (tk ? tk.points : []).forEach(p => pts.appendChild(h('li', null, t(p)))); fCustom.hidden = !!tk; };
    topic.addEventListener('change', sync);
    L.modal(t('Toolbox talk'), close => L.form({ id: 'talk-form' }, [h('div', { class: 'grid2' }, L.field(t('Topic'), topic), fCustom), pts, h('div', { class: 'grid3' }, L.field(t('Job'), job), L.field(t('Date'), date), L.field(t('Led by'), leader)), h('fieldset', { class: 'checks' }, h('legend', null, t('Who attended')), boxes), L.field(t('Notes'), notes), L.actions(close, t('Save talk'))], () => {
      C.addTalk(st, { topic: topic.value, custom: custom.value, jobId: job.value, date: date.value, leader: leader.value, notes: notes.value, attendees: boxes.map(b => b.querySelector('input')).filter(i => i.checked).map(i => i.value) }, d); close(); L.commit(); L.toast(t('Talk saved. Print the sign-in sheet if you keep paper records.')); }), true);
    sync();
  };
  L.checkDialog = function (jobId) {
    const st = L.st, d = T(), job = L.select(jobOpts(), jobId || (st.jobs.find(j => ['scheduled', 'progress', 'inspection'].indexOf(j.stage) >= 0) || {}).id || '', { id: 'sc-job' }), by = L.input({ name: 'by' }), date = L.date(d), notes = L.area('', { name: 'notes', rows: 2 });
    const sels = C.SAFETY_ITEMS.map(x => L.select([['na', t('Not needed')], ['ok', t('OK')], ['fix', t('Needs fixing')]], 'na', { 'data-k': x[0], 'aria-label': t(x[1]) }));
    L.modal(t('Site safety checklist'), close => L.form({ id: 'check-form' }, [h('div', { class: 'grid3' }, L.field(t('Job'), job), L.field(t('Date'), date), L.field(t('Checked by'), by)),
      h('div', { class: 'checklist' }, C.SAFETY_ITEMS.map((x, i) => h('div', { class: 'row chk' }, h('span', { class: 'grow' }, t(x[1])), sels[i]))), L.field(t('Notes'), notes), L.actions(close, t('Save checklist'))], () => {
      const items = {}; sels.forEach(s => { items[s.dataset.k] = s.value; }); C.addSafetyCheck(st, { jobId: job.value, by: by.value, date: date.value, notes: notes.value, items }, d); close(); L.commit(); }), true);
  };
  function viewCheck(r) {
    const st = L.st, j = C.job(st, r.jobId);
    L.modal(t('Site checklist {date}', { date: C.fmtShort(r.date) }), close => h('div', { class: 'stack' }, h('p', { class: 'muted' }, (j ? j.num + ' ' + tt(j.title) : '') + (r.by ? ' · ' + r.by : '')),
      h('ul', { class: 'comp-list' }, C.SAFETY_ITEMS.filter(x => r.items[x[0]] !== 'na').map(x => h('li', null, L.dot(r.items[x[0]] === 'ok' || r.fixed[x[0]] ? 'green' : 'amber'), h('span', { class: 'grow' }, t(x[1])), r.items[x[0]] === 'fix' ? (r.fixed[x[0]] ? t('fixed {date}', { date: C.fmtShort(r.fixed[x[0]]) }) : t('needs fixing')) : t('OK')))),
      r.notes ? h('p', null, tt(r.notes)) : null, h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: close }, t('Close')))));
  }

  /* ================= permits by jurisdiction ================= */
  L.routes.permits = function () {
    const st = L.st, d = T(), board = C.permitBoard(st, d);
    const stateChip = s => L.chip(t(C.PERMIT_STATES[s]), s === 'passed' ? 'green' : s === 'failed' || s === 'expired' ? 'red' : s === 'scheduled' || s === 'issued' ? 'blue' : 'amber');
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('h1', null, t('Permits by jurisdiction')), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => L.exportFlow(t('permit list (CSV)'), [], () => ({ csv: true, text: C.permitsCSV(st, d), name: 'permits.csv', title: t('Permits') }), { noPrint: true }) }, t('Export CSV')),
        h('button', { class: 'btn primary', type: 'button', id: 'add-juris', onclick: () => jurisDialog() }, t('+ Jurisdiction')))),
      h('p', { class: 'muted' }, t('Every permit from every job, grouped by the city or county that issues it. Add permits on a job’s Site and field tab.')),
      board.length ? board.map(g => h('section', { class: 'card juris' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, g.name || t('No jurisdiction set')),
        h('span', { class: 'muted small' }, [tn(g.open, '{n} open', '{n} open'), g.avgIssue != null ? t('issued in {n} days on average', { n: g.avgIssue }) : null, g.passBps != null ? t('{pct} passed first time or after fixes', { pct: C.fmtBps(g.passBps) }) : null].filter(Boolean).join(' · ')),
        g.name ? h('button', { class: 'btn sm', type: 'button', onclick: () => jurisDialog(g.info || { name: g.name }) }, t('Notes')) : null),
        g.info && (g.info.phone || g.info.notes || g.info.typicalDays) ? h('p', { class: 'fine' }, [g.info.phone, g.info.typicalDays ? t('usually {n} days to issue', { n: g.info.typicalDays }) : '', tt(g.info.notes)].filter(Boolean).join(' · ')) : null,
        L.table([t('Job'), t('Permit'), t('Applied'), t('Issued'), t('Inspection'), t('Expires'), t('Status')], g.rows.map(r => h('tr', null, h('td', null, h('a', { href: '#/job/' + r.job.id + '/site' }, r.job.num), h('div', { class: 'fine' }, tt(r.job.title))), h('td', null, tt(r.p.kind), h('div', { class: 'fine' }, r.p.number || '')),
          h('td', null, C.fmtShort(r.p.applied)), h('td', null, C.fmtShort(r.p.issued)), h('td', null, C.fmtShort(r.p.inspDate)), h('td', null, r.p.expires ? (r.expDays != null && r.expDays <= 30 && r.state !== 'passed' ? L.chip(C.fmtShort(r.p.expires), 'amber') : C.fmtShort(r.p.expires)) : '-'),
          h('td', null, stateChip(r.state), r.wait != null ? h('div', { class: 'fine' }, tn(r.wait, 'waiting {n} day', 'waiting {n} days')) : null))), 'permits'))) : h('section', { class: 'card' }, L.empty(t('No permits recorded yet. Add permits on a job’s Site and field tab; they are grouped here by city or county.'), t('Open jobs'), () => L.go('#/jobs'), 'empty-permit')),
      h('p', { class: 'fine' }, t('Permit rules, fees and expiry periods differ by city and county. Stark Trades only tracks the dates you enter; it does not file or check permits.')));
  };
  function jurisDialog(jr) {
    const st = L.st, isNew = !jr || !jr.id; jr = jr || { name: '' };
    const f = { name: L.input({ name: 'name', value: jr.name, id: 'jr-name', disabled: !isNew }), phone: L.input({ name: 'phone', value: jr.phone || '' }), days: L.input({ value: jr.typicalDays ? String(jr.typicalDays) : '', inputmode: 'numeric', id: 'jr-days' }), valid: L.input({ value: jr.validDays ? String(jr.validDays) : '', inputmode: 'numeric' }), notes: L.area(tt(jr.notes || ''), { name: 'notes' }) };
    L.modal(isNew ? t('New jurisdiction') : jr.name, close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('City or county'), f.name), L.field(t('Permit office phone'), f.phone)), h('div', { class: 'grid2' }, L.field(t('Usual days to issue'), f.days), L.field(t('Permit valid for (days)'), f.valid, t('Used to fill in the expiry when a permit is issued.'))),
      L.field(t('Notes'), f.notes, t('For example: inspection requests by 3 pm the day before; plans needed for repipes.')), L.actions(close)], () => {
      C.setJurisdiction(st, { name: jr.name || f.name.value, phone: f.phone.value, typicalDays: f.days.value, validDays: f.valid.value, notes: keep(f.notes.value, jr.notes || '') }); close(); L.commit(); }));
  }

  /* ================= pipeline: quote to job to invoice to cash ================= */
  let pipeRange = 'year';
  const RANGES = [['month', C.N('This month')], ['quarter', C.N('Last 90 days')], ['year', C.N('This year')], ['last12', C.N('Last 12 months')]];
  const rangeOf = (k, d) => k === 'month' ? [d.slice(0, 8) + '01', d] : k === 'quarter' ? [C.addDays(d, -90), d] : k === 'last12' ? [C.addMonths(d, -12), d] : [d.slice(0, 5) + '01-01', d];
  L.routes.pipeline = function () {
    const st = L.st, d = T(), r = rangeOf(pipeRange, d), p = C.pipeline(st, r[0], r[1]), maxV = Math.max(1, ...p.stages.map(s => s.value));
    const sel = L.select(RANGES.map(x => [x[0], t(x[1])]), pipeRange, { id: 'pipe-range', 'aria-label': t('Period'), onchange: e => { pipeRange = e.target.value; L.render(); } });
    const ledgerBtn = h('button', { class: 'btn primary', type: 'button', id: 'ledger-csv', onclick: () => L.exportFlow(t('Stark Ledger bank CSV'), [{ key: 'customer', label: t('Include customer names'), value: false }], o => ({ csv: true, text: C.ledgerCSV(st, r[0], r[1], o), name: 'stark-trades-to-ledger-' + r[1] + '.csv', title: t('Payments') }), { noPrint: true }) }, t('Stark Ledger CSV (payments)'));
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, t('Pipeline: quote to cash')), h('p', { class: 'muted' }, C.fmtDate(r[0]) + ' - ' + C.fmtDate(r[1]))), h('div', { class: 'row' }, sel, ledgerBtn)),
      h('div', { class: 'grid4', id: 'pipe-stats' }, stat(t('Quoted'), C.fmt0(p.quoted.value), tn(p.quoted.n, '{n} estimate sent', '{n} estimates sent')), stat(t('Won'), C.fmt0(p.won.value), p.winBps == null ? t('no decisions yet') : t('{pct} win rate', { pct: C.fmtBps(p.winBps) })),
        stat(t('Billed'), C.fmt0(p.billed), t('invoices and plan bills')), stat(t('Collected'), C.fmt0(p.collected), p.daysToPay == null ? '' : t('paid in {n} days on average', { n: p.daysToPay }))),
      h('div', { class: 'grid4' }, stat(t('Open quotes'), C.fmt0(p.open.value), tn(p.open.n, '{n} waiting for an answer', '{n} waiting for an answer')), stat(t('Owed to you now'), C.fmt0(p.outstanding), t('all unpaid invoices')),
        stat(t('Quote to job'), p.daysToJob == null ? '-' : tn(p.daysToJob, '{n} day', '{n} days'), t('average time to win')), stat(t('Lost'), C.fmt0(p.lost.value), tn(p.lost.n, '{n} declined', '{n} declined'))),
      h('section', { class: 'card' }, h('h2', null, t('Jobs by stage today')), h('div', { class: 'pbars', id: 'pbars' }, p.stages.map(s => h('a', { class: 'pbar', href: '#/jobs' }, h('span', { class: 'pl' }, t(s.label)), h('span', { class: 'pt' }, h('i', { class: 'pw' + Math.round(10 * s.value / maxV) })), h('span', { class: 'pv' }, s.n + ' · ' + C.fmt0(s.value)))))),
      h('section', { class: 'card stack', id: 'ledger-export' }, h('h2', null, t('Send it to your books')),
        h('p', { class: 'muted small' }, t('Money that actually moved in the period: customer payments and plan payments in, sub and supplier payments out. The file has Date, Description and Amount columns (money in is positive), the bank-statement layout Stark Ledger and most bookkeeping tools import.')),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'inv-csv', onclick: () => L.exportFlow(t('invoice list (CSV)'), [{ key: 'customer', label: t('Include customer names'), value: false }], o => ({ csv: true, text: C.invoiceListCSV(st, r[0], r[1], Object.assign({ today: d }, o)), name: 'invoices-' + r[1] + '.csv', title: t('Invoices') }), { noPrint: true }) }, t('Invoice list CSV'))),
        h('p', { class: 'fine' }, t('Check the rows before you import them; Stark Trades does not keep double-entry books.'))));
  };

  /* ================= job page: parts used from stock and purchase orders ================= */
  L.partsCard = function (job) {
    const st = L.st, used = job.stockUsed || [], pos = st.pos.filter(p => p.jobId === job.id);
    return h('section', { class: 'card', id: 'job-parts' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Parts and orders')), h('button', { class: 'btn sm', type: 'button', id: 'use-stock', onclick: () => L.useStockDialog(job.id) }, t('Use stock')), h('button', { class: 'btn sm', type: 'button', onclick: () => L.poDialog(job.id) }, t('+ Purchase order'))),
      used.length ? L.table([t('Date'), t('Part'), { t: t('Quantity'), cls: 'num' }, { t: t('Cost'), cls: 'num' }], used.map(u => { const it = st.stock.find(x => x.id === u.itemId) || { name: '?', unit: '' }; return h('tr', null, h('td', null, C.fmtShort(u.date)), h('td', null, tt(it.name)), L.num(C.fmtMilli(u.qty) + ' ' + tt(it.unit)), L.num(C.fmt(u.cost))); })) : null,
      pos.length ? L.table([t('Order'), t('Status'), { t: t('Total'), cls: 'num' }], pos.map(p => h('tr', null, h('td', null, h('a', { href: '#/stock/orders' }, p.num), h('div', { class: 'fine' }, p.supplier)), h('td', null, t(C.PO_STATES[p.status])), L.num(C.fmt(C.poTotals(p).total))))) : null,
      !used.length && !pos.length ? L.empty(t('No stock used and no orders for this job.')) : null, h('p', { class: 'fine' }, t('Stock used and orders received are added to Materials above.')));
  };

  /* ================= customer reports from the job page ================= */
  L.statusReport = function (job) {
    L.exportFlow(t('status report {num}', { num: job.num }), [L.addressChoice('full'), { key: 'customer', label: t('Include customer name'), value: true }, { key: 'money', label: t('Include billing'), value: true }, { key: 'who', label: t('Include who does each step'), value: false }], o => C.statusReport(L.st, job.id, o, T()));
  };
  L.photoReportDialog = function (job) {
    const st = L.st, o = { address: 'city', customer: false, captions: true, punch: false, stages: { Before: true, During: false, After: true, Inspection: false } }, prev = h('div', { class: 'photos', id: 'pr-preview' }), info = h('p', { class: 'muted small', id: 'pr-count' });
    let rep = null; const refresh = () => { rep = C.photoReport(st, job.id, o, T()); info.textContent = rep.lines.join(' · '); L.clear(prev); rep.groups.forEach(g => g.photos.forEach(p => prev.appendChild(h('figure', null, L.photo(p.id, p.caption), h('figcaption', null, g.label + (p.caption ? ' · ' + p.caption : '')))))); };
    const box = (label, get, set) => L.check(label, get(), { onchange: e => { set(e.target.checked); refresh(); } });
    const addr = L.select([['full', t('Street and city')], ['city', t('City only')], ['none', t('Leave out (give it by phone)')]], o.address, { onchange: e => { o.address = e.target.value; refresh(); } });
    L.modal(t('Photo report {num}', { num: job.num }), close => h('div', { class: 'stack' }, h('p', { class: 'muted small' }, t('Before and after photos for the customer, an insurer or a warranty claim. Choose what goes in.')),
      h('div', { class: 'redact' }, C.PHOTO_STAGES.map(s => box(t(s), () => o.stages[s], v => { o.stages[s] = v; })), box(t('Punch list photos'), () => o.punch, v => { o.punch = v; }), box(t('Captions'), () => o.captions, v => { o.captions = v; }), box(t('Include customer name'), () => o.customer, v => { o.customer = v; }), L.field(t('Site address'), addr)),
      info, prev, h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: close }, t('Cancel')), h('button', { class: 'btn primary', type: 'button', id: 'pr-print', onclick: () => { if (rep && rep.count) L.printPhotos(rep); else L.toast(t('No photos match. Tick another stage.'), true); } }, t('Print / PDF')))), true);
    refresh();
  };
  L.printPhotos = async function (rep) {
    const root = L.clear(L.$('#print-root')), co = L.st.company, made = [];
    const doc = h('div', { class: 'print-doc' }, h('div', { class: 'print-head' }, h('b', null, co.name || 'Stark Trades'), h('span', null, [co.street, co.city, co.phone].filter(Boolean).join('  ·  '))), h('h1', null, rep.title), rep.lines.map(x => h('p', null, x)));
    const loads = [];
    rep.groups.forEach(g => { doc.appendChild(h('h2', null, g.label)); doc.appendChild(h('div', { class: 'print-photos' }, g.photos.map(p => { const img = h('img', { alt: p.caption || g.label });
      loads.push(window.StarkStore.getPhoto(p.id).then(b => new Promise(res => { const u = URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })); made.push(u); img.onload = res; img.onerror = res; img.src = u; })).catch(() => { img.alt = t('Photo missing'); }));
      return h('figure', null, img, h('figcaption', null, [p.caption, p.date ? C.fmtShort(p.date) : ''].filter(Boolean).join(' · '))); }))); });
    root.appendChild(doc); await Promise.all(loads);
    document.body.classList.add('printing'); setTimeout(() => { try { window.print(); } finally { document.body.classList.remove('printing'); setTimeout(() => made.forEach(u => URL.revokeObjectURL(u)), 4000); } }, 50);
  };

  /* ================= quick search: Ctrl+K or / ================= */
  L.ACTIONS = [[C.N('New job'), () => L.jobDialog()], [C.N('New service agreement'), () => L.planDialog()], [C.N('New purchase order'), () => L.poDialog()], [C.N('Toolbox talk'), () => L.talkDialog()],
    [C.N('Site safety checklist'), () => L.checkDialog()], [C.N('Switch language'), () => L.toggleLang()], [C.N('Switch light and dark theme'), () => L.$('#theme').click()], [C.N('Lock now'), () => L.lockNow()]];
  L.palette = function () {
    if (!L.st) return; const dlg = L.$('#dlg'); if (dlg.open) dlg.close();
    const q = L.input({ id: 'pal-q', type: 'search', placeholder: t('Jobs, customers, subs, parts, pages...'), 'aria-label': t('Search'), autocomplete: 'off' }), list = h('ul', { class: 'pal-list', id: 'pal-list', role: 'listbox' });
    let items = [], cur = 0, closeFn = null;
    const run = it => { if (closeFn) closeFn(); if (it.run) it.run(); else L.go(it.href); };
    const draw = () => {
      const s = q.value.trim(), f = C.fold(s), words = f.split(/\s+/).filter(Boolean), hit = lab => words.every(w => C.fold(lab).indexOf(w) >= 0);
      const pages = (L.NAV || []).filter(n => !words.length || hit(t(n[1]) + ' ' + n[1])).map(n => ({ kind: 'page', label: t(n[1]), sub: '', href: '#/' + n[0] }));
      const acts = L.ACTIONS.filter(a => !words.length || hit(t(a[0]) + ' ' + a[0])).map(a => ({ kind: 'action', label: t(a[0]), sub: '', run: a[1] }));
      items = words.length ? C.search(L.st, s, 20).concat(acts, pages).slice(0, 14) : acts.slice(0, 4).concat(pages.slice(0, 8));
      let ans = null; try { ans = words.length && f.length > 3 && C.askBusiness ? C.askBusiness(L.st, s, T()) : null; } catch (e) { ans = null; }
      if (ans) items = [{ kind: 'answer', label: ans.text, sub: '', href: (ans.rows[0] && ans.rows[0].href) || '#/radar' }].concat(ans.rows.slice(0, 6).map(r => ({ kind: 'answer', label: r.label, sub: r.sub, href: r.href })), items.slice(0, 6));
      cur = Math.min(cur, Math.max(0, items.length - 1)); L.clear(list);
      if (!items.length) list.appendChild(h('li', { class: 'empty' }, t('Nothing found.')));
      items.forEach((it, i) => list.appendChild(h('li', { role: 'option', 'aria-selected': i === cur ? 'true' : 'false' }, h('button', { type: 'button', class: 'pal-item' + (i === cur ? ' on' : ''), onclick: () => run(it) }, h('span', { class: 'chip' }, t(C.KINDS[it.kind])), h('span', { class: 'grow' }, it.label), it.sub ? h('span', { class: 'fine' }, it.sub) : null))));
    };
    q.addEventListener('input', () => { cur = 0; draw(); });
    q.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { cur = Math.min(items.length - 1, cur + 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); draw(); e.preventDefault(); } else if (e.key === 'Enter') { e.preventDefault(); if (items[cur]) run(items[cur]); } });
    closeFn = L.modal(t('Quick search'), () => h('div', { class: 'stack pal' }, q, list, h('p', { class: 'fine' }, t('Arrow keys to move, Enter to open, Esc to close. Shortcut: Ctrl+K or /.'))));
    draw(); q.focus();
  };
  document.addEventListener('keydown', e => {
    if (!L.st) return; const tag = (e.target && e.target.tagName) || '', typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); L.palette(); }
    else if (e.key === '/' && !typing && !L.$('#dlg').open) { e.preventDefault(); L.palette(); }
  });
})();
