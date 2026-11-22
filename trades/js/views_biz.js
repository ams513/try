/* Stark Trades 2.1. Bid invitations and leveling, estimates with plumbing helpers and takeoff, price book,
   customers, warranties, reports and 1099 prep, capacity forecast. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, t = C.t, tn = C.tn, tt = C.tt;
  const T = () => C.today();

  /* ---------------- bids: invite, record, level, award ---------------- */
  L.routes.bids = function (sub, jobId) {
    const st = L.st, d = T();
    if (sub === 'new') setTimeout(() => newBidDialog(jobId), 0);
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, t('Bids')), h('button', { class: 'btn primary', type: 'button', id: 'new-bid', onclick: () => newBidDialog() }, t('+ Bid package'))),
      h('p', { class: 'muted' }, t('Invite several subs to the same scope with a deadline. Record each bid item by item, then compare them in the leveling grid: exclusions are priced in, so you compare like with like.')),
      h('section', { class: 'card' }, st.bids.length ? L.table([t('Bid'), t('Job'), t('Scope'), t('Deadline'), t('Bids in'), t('Status')], st.bids.slice().reverse().map(b => { const j = C.job(st, b.jobId);
        return h('tr', { class: 'clickable', onclick: () => L.go('#/bid/' + b.id) }, h('td', null, h('a', { href: '#/bid/' + b.id }, b.num)), h('td', null, j ? j.num : '-'), h('td', null, tt(b.title), h('div', { class: 'fine' }, tn(b.items.length, '{n} scope item', '{n} scope items'))),
          h('td', null, b.deadline < d && b.status === 'open' ? L.chip(t('closed {date}', { date: C.fmtShort(b.deadline) }), 'dim') : C.fmtShort(b.deadline)), h('td', null, b.responses.length + ' / ' + b.invited.length),
          h('td', null, b.status === 'awarded' ? L.chip(t('Awarded: {sub}', { sub: (C.sub(st, b.awardedSub) || {}).name }), 'green') : L.chip(t('Open'), 'blue'))); })) : L.empty(t('No bid packages yet. A bid package asks several subs to price the same work, then lines the prices up side by side.'), t('+ Bid package'), () => newBidDialog(), 'empty-bid')));
  };
  function newBidDialog(jobId) {
    const st = L.st, d = T(), jobs = st.jobs.filter(j => j.stage !== 'paid' && j.stage !== 'done'); if (!jobs.length) return L.toast(t('Create a job first.'), true);
    const job = L.select(jobs.map(j => [j.id, j.num + ' ' + tt(j.title)]), jobId && C.job(st, jobId) ? jobId : jobs[0].id, { id: 'bid-job' }), title = L.input({ name: 'title', id: 'bid-title' }), trade = L.select(L.tradeOpts(), st.trades[1] || st.trades[0], { id: 'bid-trade' }),
      deadline = L.date(C.addDays(d, 7), { id: 'bid-deadline' }), items = L.area('', { rows: 6, name: 'items', id: 'bid-items', placeholder: t('One scope item per line. Add | and an amount to price it if a bidder excludes it, e.g. Patch drywall | 900') }), task = h('select', { id: 'bid-task' }), subs = h('div', { class: 'checks', id: 'bid-subs' });
    const fill = () => { L.clear(task).appendChild(h('option', { value: '' }, t('Create a new task when awarded'))); C.job(st, job.value).tasks.filter(k => k.kind !== 'inspection' && !(k.who && k.who.t)).forEach(k => task.appendChild(h('option', { value: k.id }, tt(k.name)))); L.clear(subs);
      C.benchSearch(st, { trade: trade.value }, d).forEach(r => subs.appendChild(L.check(r.sub.name + ' · ' + r.card.score + (r.comp === 'red' ? ' · ' + t('Not compliant') : ''), r.sub.bench === 'preferred' || r.sub.bench === 'backup', { value: r.sub.id }))); };
    job.addEventListener('change', fill); trade.addEventListener('change', fill); fill();
    L.modal(t('New bid package'), close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('Job'), job), L.field(t('Trade'), trade)), L.field(t('Package name'), title), L.field(t('Scope items'), items), h('div', { class: 'grid2' }, L.field(t('Bids due'), deadline), L.field(t('Award to'), task)),
      h('fieldset', { class: 'checks' }, h('legend', null, t('Invite (preferred and backup subs are ticked)')), subs), L.actions(close, t('Create bid package'))], () => {
      const its = items.value.split('\n').map(x => x.trim()).filter(Boolean).map(x => { const p = x.split('|'); const allow = p[1] ? C.toCents(p[1]) : 0; if (isNaN(allow) || allow < 0) throw new Error(t('Check the amount after | on: {line}', { line: x })); return { text: p[0].trim(), allow }; });
      const b = C.newBid(st, { jobId: job.value, title: title.value, trade: trade.value, deadline: deadline.value, items: its, forTask: task.value, invited: L.$$('input:checked', subs).map(i => i.value) }, T()); close(); L.save(); L.go('#/bid/' + b.id); }), true);
  }
  L.routes.bid = function (id) {
    const st = L.st, d = T(), b = st.bids.find(x => x.id === id); if (!b) return L.gone(t('No such bid package.'), '#/bids', t('Bids'));
    const lv = C.levelBids(st, id, d), j = C.job(st, b.jobId), open = b.status === 'open';
    const head = [t('Scope item')].concat(lv.cols.map(c => h('span', null, L.dot(c.comp), c.sub.name.replace(' (demo)', ''), ' ', L.benchChip(c.sub.bench))));
    const rows = lv.items.map(x => h('tr', null, h('th', null, tt(x.text), x.allow ? h('div', { class: 'fine' }, t('if excluded, add {amt}', { amt: C.fmt(x.allow) })) : null),
      lv.cols.map(c => c.r.covers[x.id] === false ? h('td', { class: 'exc' }, '✗ ' + t('Excluded')) : h('td', { class: 'inc' }, '✓ ' + t('Included')))));
    const R = (label, f, cls) => h('tr', { class: cls || '' }, h('th', null, label), lv.cols.map(c => h('td', { class: c.low && cls === 'lev' ? 'low' : '' }, f(c))));
    rows.push(R(t('Bid price'), c => C.fmt(c.r.price), 'money'), R(t('Leveled price (exclusions priced in)'), c => h('b', null, C.fmt(c.adj)), 'lev'), R(t('Above the leveled low'), c => c.low ? L.chip(t('Leveled low'), 'green') : (c.spread > 0 ? '+' : '') + C.fmt(c.spread)),
      R(t('Working days'), c => String(c.r.days)), R(t('Score'), c => [h('b', null, c.card.score), ' ', L.trend(c.card.trend)]), R(t('Paperwork'), c => L.compChip(c.comp)),
      R(t('Flags'), c => c.flags.length ? h('ul', { class: 'warns small' }, c.flags.map(f => h('li', null, f))) : '-'),
      R('', c => !open ? (b.awardedSub === c.sub.id ? L.chip(t('Awarded'), 'green') : '') : h('button', { class: 'btn sm' + (c.low ? ' next' : ''), type: 'button', 'data-award': c.sub.id, onclick: () => award(c) }, t('Award'))));
    function award(c) {
      const k = b.forTask && j.tasks.find(x => x.id === b.forTask), tmp = { id: 'tmp', trade: b.trade, start: k ? k.start : '', end: k && k.start ? C.addWorkdays(k.start, c.r.days, st.company.workDays) : '' }, chk = C.assignCheck(st, tmp, { t: 'sub', id: c.sub.id }, d);
      const go = reason => { try { const r = C.awardBid(st, id, c.sub.id, { today: d, override: reason }); L.commit(); L.toast(t('Awarded to {sub}. Task and draft agreement created.', { sub: c.sub.name })); return r; } catch (e) { L.toast(e.message, true); } };
      if (!chk.hard.length) return L.confirm(t('Award {title} to {sub} for {amt}? This creates the task and a draft sub agreement.', { title: tt(b.title), sub: c.sub.name, amt: C.fmt(c.r.price) }) + (chk.soft.length ? ' ' + chk.soft.join(' ') : ''), t('Award'), () => go(''));
      L.modal(t('Hard warning: {who}', { who: c.sub.name }), close => { const ack = h('input', { type: 'checkbox', id: 'ovr-ack' }), reason = L.input({ id: 'ovr-reason' }), btn = h('button', { class: 'btn danger', type: 'button', id: 'ovr-go', disabled: true, onclick: () => { close(); go(reason.value); } }, t('Assign anyway, at my risk'));
        const upd = () => { btn.disabled = !(ack.checked && reason.value.trim().length >= 5); }; ack.addEventListener('change', upd); reason.addEventListener('input', upd);
        return h('div', { class: 'stack', id: 'hard-warning' }, h('div', { class: 'note bad' }, h('ul', { class: 'warns' }, chk.hard.map(w => h('li', null, w)))), h('label', { class: 'check' }, ack, h('span', null, t('I understand the risk and I still want to assign this work.'))), L.field(t('Reason'), reason), h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'button', onclick: close }, t('Do not assign')), btn)); });
    }
    const ag = b.agreementId && st.agreements.find(a => a.id === b.agreementId);
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, h('a', { href: '#/bids' }, t('Bids')), ' / ', b.num), h('h1', null, tt(b.title)), h('p', { class: 'muted' }, h('a', { href: '#/job/' + j.id }, j.num + ' ' + tt(j.title)), '  ·  ' + t('due {date}', { date: C.fmtDate(b.deadline) }) + '  ·  ' + tt(b.trade))),
        open ? h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => inviteDialog(b) }, t('Invitation letters')), h('button', { class: 'btn primary', type: 'button', id: 'record-bid', onclick: () => recordDialog(b) }, t('Record a bid'))) : null),
      ag ? h('p', { class: 'note' }, t('Awarded. A draft agreement is ready: '), h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('agreement with {sub}', { sub: C.sub(st, ag.subId).name }), [L.addressChoice('full')], o => C.agreementDoc(st, ag.jobId, ag.subId, o, d)) }, t('Open agreement'))) : null,
      lv.waiting.length ? h('p', { class: 'muted' }, t('Still waiting on: {list}', { list: lv.waiting.map(s => s.name).join(', ') })) : null,
      h('section', { class: 'card' }, h('h2', null, t('Bid leveling')), lv.cols.length ? h('div', { class: 'scroll' }, h('table', { class: 'tbl level', id: 'leveling' }, h('thead', null, h('tr', null, head.map(x => h('th', null, x)))), h('tbody', null, rows))) : L.empty(t('No bids recorded yet.')),
        h('p', { class: 'fine' }, t('The leveled low is the lowest price after adding your allowance for each excluded item, among subs with paperwork in order who are not on the do-not-use list.'))));
  };
  function inviteDialog(b) {
    const st = L.st, subs = b.invited.map(id => C.sub(st, id)).filter(Boolean);
    L.modal(t('Invitation letters'), close => h('div', { class: 'stack' }, h('p', { class: 'muted' }, t('One letter per sub. Customer names stay out.')), h('div', { class: 'row' }, subs.map(s => h('button', { class: 'btn sm', type: 'button', onclick: () => { close(); L.exportFlow(t('bid invitation to {sub}', { sub: s.name }), [L.addressChoice('city')], o => C.inviteDoc(st, b.id, s.id, o, T())); } }, s.name.replace(' (demo)', '')))), h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: close }, t('Close')))));
  }
  function recordDialog(b) {
    const st = L.st, sub = L.select(st.subs.filter(s => s.active !== false).map(s => [s.id, s.name]), b.invited.find(id => !b.responses.some(r => r.subId === id)) || b.invited[0], { id: 'rb-sub' }), price = L.money('', { id: 'rb-price', name: 'price' }), days = L.input({ id: 'rb-days', value: '3', inputmode: 'numeric', name: 'days' }),
      exc = L.input({ id: 'rb-exc', name: 'exclusions' }), note = L.input({ name: 'note' }), date = L.date(T()), boxes = b.items.map(x => L.check(tt(x.text), true, { value: x.id }));
    L.modal(t('Record a bid'), close => L.form({}, [h('div', { class: 'grid4' }, L.field(t('Sub'), sub), L.field(t('Price'), price), L.field(t('Working days'), days), L.field(t('Received'), date)), h('fieldset', { class: 'checks col', id: 'rb-items' }, h('legend', null, t('Included in their price (untick what they exclude)')), boxes),
      L.field(t('Other exclusions they wrote'), exc), L.field(t('Note'), note), L.actions(close, t('Save bid'))], () => {
      const covers = {}; boxes.forEach(x => { const i = x.querySelector('input'); covers[i.value] = i.checked; });
      C.recordBid(st, b.id, { subId: sub.value, price: L.cents(price.value, t('the price')), days: parseInt(days.value, 10), covers, exclusions: exc.value, note: note.value, date: date.value }, T()); close(); L.commit(); }), true);
  }

  /* ---------------- estimates with helpers ---------------- */
  L.routes.estimates = function () {
    const st = L.st;
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, t('Estimates')), h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/pricebook' }, t('Price book')), h('button', { class: 'btn primary', type: 'button', id: 'new-est', onclick: newEstimate }, t('+ New estimate')))),
      h('section', { class: 'card' }, st.estimates.length ? L.table([t('Estimate'), t('Customer'), t('Work'), t('Date'), { t: t('Total'), cls: 'num' }, t('Status')], st.estimates.slice().reverse().map(e => h('tr', { class: 'clickable', onclick: () => L.go('#/estimate/' + e.id) },
        h('td', null, h('a', { href: '#/estimate/' + e.id }, e.num)), h('td', null, (C.customer(st, e.customerId) || {}).name || '-'), h('td', null, tt(e.title)), h('td', null, C.fmtShort(e.date)), L.num(C.fmt(C.estimateTotals(e).total)), h('td', null, L.chip(t(e.status), e.status === 'accepted' ? 'green' : e.status === 'sent' ? 'blue' : ''))))) : L.empty(t('No estimates yet. Price a job from your price book, print it for the customer, and turn it into a job when they say yes.'), t('+ New estimate'), newEstimate, 'empty-est')));
  };
  C.N('draft'); C.N('sent'); C.N('accepted'); C.N('declined');
  function newEstimate() {
    const st = L.st, e = { id: C.nid(st, 'e'), num: 'E-' + (st.company.nextEst++), customerId: '', title: t('New estimate'), street: '', city: '', date: T(), lines: [], labRate: st.company.labRate, markupBps: st.company.markupBps, taxBps: st.company.matTaxBps, status: 'draft', notes: '' };
    st.estimates.push(e); L.save(); L.go('#/estimate/' + e.id);
  }
  L.routes.estimate = function (id) {
    const st = L.st, e = st.estimates.find(x => x.id === id); if (!e) return L.gone(t('No such estimate.'), '#/estimates', t('Estimates'));
    const tot = C.estimateTotals(e), locked = e.status === 'accepted';
    const upd = fn => ev => { try { fn(ev.target.value); C.guard(e); L.save(); refresh(); } catch (x) { L.toast(x.message, true); } };
    const totals = h('div', { class: 'totals', id: 'est-totals' }), refresh = () => { const x = C.estimateTotals(e); L.clear(totals).appendChild(h('div', { class: 'stack' }, [[t('Materials'), x.mat], [t('Labor ({h} h)', { h: C.fmtHrs(x.hours) }), x.lab], [t('Markup {pct}', { pct: C.fmtBps(e.markupBps) }), x.markup], [t('Tax on materials'), x.tax]].map(r => h('div', null, h('span', null, r[0]), h('span', null, C.fmt(r[1])))), h('div', { class: 'grand' }, h('span', null, t('Total')), h('b', null, C.fmt(x.total))))); L.$$('[data-line]').forEach((el, i) => { if (x.lines[i]) el.textContent = C.fmt(x.lines[i].cost); }); };
    const head = h('div', { class: 'grid3' }, L.field(t('Customer'), L.select([['', t('Choose')]].concat(st.customers.map(c => [c.id, c.name])), e.customerId, { disabled: locked, onchange: upd(v => { e.customerId = v; }) })),
      L.field(t('Work'), L.input({ value: tt(e.title), disabled: locked, id: 'est-title', onchange: upd(v => { e.title = v; }) })), L.field(t('Status'), L.select([['draft', t('draft')], ['sent', t('sent')], ['accepted', t('accepted')], ['declined', t('declined')]], e.status, { disabled: locked, onchange: upd(v => { if (v !== 'accepted') e.status = v; }) })),
      L.field(t('Site street'), L.input({ value: e.street, disabled: locked, onchange: upd(v => { e.street = v; }) })), L.field(t('City'), L.input({ value: e.city, disabled: locked, onchange: upd(v => { e.city = v; }) })), L.field(t('Date'), L.date(e.date, { disabled: locked, onchange: upd(v => { if (C.isDate(v)) e.date = v; }) })));
    const rates = h('div', { class: 'grid3' }, L.field(t('Labor rate per hour'), L.money(e.labRate, { disabled: locked, onchange: upd(v => { e.labRate = L.cents(v, t('the labor rate')); }) })), L.field(t('Markup %'), L.input({ value: C.fmtBps(e.markupBps).replace('%', ''), disabled: locked, inputmode: 'decimal', id: 'est-markup', onchange: upd(v => { const b = C.toBps(v); if (isNaN(b)) throw new Error(t('Markup is a percent')); e.markupBps = b; }) })),
      L.field(t('Tax on materials %'), L.input({ value: C.fmtBps(e.taxBps).replace('%', ''), disabled: locked, inputmode: 'decimal', onchange: upd(v => { const b = C.toBps(v); if (isNaN(b)) throw new Error(t('Tax is a percent')); e.taxBps = b; }) })));
    const lineRows = e.lines.map((l, i) => h('tr', null, h('td', null, h('div', { class: 'fine' }, tt(l.cat)), L.input({ value: tt(l.name), disabled: locked, 'aria-label': t('Item'), onchange: upd(v => { l.name = v; }) })),
      h('td', { class: 'lq' }, L.input({ value: C.fmtMilli(l.qty), disabled: locked, inputmode: 'decimal', 'aria-label': t('Quantity'), onchange: upd(v => { const q = C.toMilli(v); if (isNaN(q)) throw new Error(t('Quantity is a number')); if (l.takeoff && l.qty) l.takeoff = l.takeoff.map(x => [x[0], x[1] * q / l.qty, x[2]]); l.qty = q; }) }), h('div', { class: 'fine' }, tt(l.unit))),
      h('td', { class: 'lu' }, L.money(l.mat, { disabled: locked, 'aria-label': t('Material per unit'), onchange: upd(v => { l.mat = L.cents(v, t('the material cost')); }) })), h('td', { class: 'lq' }, L.input({ value: C.fmtHrs(l.lab), disabled: locked, inputmode: 'decimal', 'aria-label': t('Labor hours per unit'), onchange: upd(v => { const n = Math.round(parseFloat(v) * 100); if (isNaN(n) || n < 0) throw new Error(t('Hours is a number')); l.lab = n; }) })),
      h('td', { class: 'num', 'data-line': i }, C.fmt(tot.lines[i].cost)), h('td', null, locked ? null : h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': t('Remove line'), onclick: () => { e.lines.splice(i, 1); L.commit(); } }, '✕'))));
    const pick = L.select(st.priceBook.map(b => [b.id, tt(b.cat) + ': ' + tt(b.name) + ' (' + C.fmt(b.mat) + ', ' + C.fmtHrs(b.lab) + ' h)' + (b.example ? ' [' + t('example') + ']' : '')]), null, { id: 'pb-pick', 'aria-label': t('Price book item') });
    const take = C.takeoff(e);
    refresh();
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, h('a', { href: '#/estimates' }, t('Estimates')), ' / ', e.num), h('h1', null, e.num + ' ', L.chip(t(e.status), e.status === 'accepted' ? 'green' : 'blue'))),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => L.exportFlow(t('estimate {num}', { num: e.num }), [L.addressChoice('full'), { key: 'customer', label: t('Include customer name'), value: true }, { key: 'detail', label: t('Show every line (off: one price per trade)'), value: true }], o => C.estimateDoc(st, e.id, o, T())) }, t('Print for customer')),
        e.jobId ? h('a', { class: 'btn primary', href: '#/job/' + e.jobId }, t('Open job')) : h('button', { class: 'btn primary', type: 'button', id: 'est-accept', onclick: () => { try { const j = C.estimateToJob(st, e.id, T()); L.save(); L.go('#/job/' + j.id); } catch (x) { L.toast(x.message, true); } } }, t('Accepted: make it a job')))),
      h('div', { class: 'invgrid' }, h('div', { class: 'stack' }, h('section', { class: 'card' }, head), h('section', { class: 'card' }, h('h2', null, t('Line items')),
        e.lines.length ? L.table([t('Item'), t('Qty'), t('Material / unit'), t('Labor h / unit'), { t: t('Line'), cls: 'num' }, ''], lineRows, 'lines') : L.empty(t('Add items from your price book, or use the helpers.')),
        locked ? null : h('div', { class: 'row' }, pick, h('button', { class: 'btn', type: 'button', id: 'add-line', onclick: () => { const b = st.priceBook.find(x => x.id === pick.value); if (!b) return; e.lines.push({ id: C.nid(st, 'l'), cat: b.cat, name: b.name, unit: b.unit, qty: 1000, mat: b.mat, lab: b.lab, takeoff: [] }); L.commit(); } }, t('+ Add line')))),
        locked ? null : helpers(e), take.length ? h('section', { class: 'card', id: 'takeoff' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Material takeoff')), h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('material takeoff'), [], () => ({ csv: true, text: C.takeoffCSV(e), name: 'takeoff-' + e.num + '.csv', title: t('Material takeoff') }), { noPrint: true }) }, t('Export CSV'))),
          h('p', { class: 'note big' }, t(C.HELPER_NOTE)), L.table([t('Material'), { t: t('Quantity'), cls: 'num' }, t('Unit')], take.map(x => h('tr', null, h('td', null, tt(x.item)), L.num(String(+x.qty.toFixed(2))), h('td', null, tt(x.unit)))))) : null,
        h('section', { class: 'card' }, rates)), h('div', { class: 'stack' }, totals, h('p', { class: 'fine' }, t('Markup applies to materials plus labor. Each trade becomes a task with its share of the price when you accept, ready for bids.')))));
  };
  function helpers(e) {
    const st = L.st, counts = {}, fx = C.FIXTURES.map(f => { counts[f.key] = L.input({ value: '0', inputmode: 'numeric', class: 'short', 'aria-label': t(f.name), 'data-fx': f.key }); return L.field(t(f.name), counts[f.key]); });
    const asm = L.select(C.ASSEMBLIES.map(a => [a.key, t(a.name)]), C.ASSEMBLIES[0].key, { id: 'asm-pick' }), aq = L.input({ value: '1', inputmode: 'decimal', class: 'short', id: 'asm-qty', 'aria-label': t('Quantity') });
    return h('section', { class: 'card', id: 'helpers' }, h('h2', null, t('Plumbing estimate helpers')), h('p', { class: 'note big' }, t(C.HELPER_NOTE)),
      h('h3', null, t('Fixture list')), h('p', { class: 'muted small' }, t('Count the fixtures. Stark Trades adds underground, rough-in and trim lines from your price book, plus a material takeoff.')), h('div', { class: 'grid4' }, fx),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'fx-go', onclick: () => { const c = {}; Object.keys(counts).forEach(k => { c[k] = parseInt(counts[k].value, 10) || 0; }); const ls = C.fixtureLines(st, c); if (!ls.length) return L.toast(t('Enter at least one fixture'), true); ls.forEach(l => e.lines.push(l)); L.commit(); L.toast(tn(ls.length, '{n} line added', '{n} lines added')); } }, t('Add fixture lines'))),
      h('h3', null, t('Assemblies')), h('div', { class: 'row' }, L.field(t('Assembly'), asm), L.field(t('Quantity'), aq), h('button', { class: 'btn', type: 'button', id: 'asm-go', onclick: () => { C.assemblyLines(st, asm.value, parseFloat(aq.value) || 1).forEach(l => e.lines.push(l)); L.commit(); } }, t('Add assembly'))));
  }
  L.routes.pricebook = function () {
    const st = L.st;
    const rows = st.priceBook.map(b => h('tr', null, h('td', null, tt(b.cat)), h('td', null, tt(b.name), b.code ? h('span', { class: 'tag' }, b.code) : null, b.example ? h('span', { class: 'tag' }, t('example price')) : null), h('td', null, tt(b.unit)), L.num(C.fmt(b.mat)), L.num(C.fmtHrs(b.lab)), h('td', { class: 'acts' }, h('button', { class: 'btn sm', type: 'button', onclick: () => bookDialog(b) }, t('Edit')))));
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, h('a', { href: '#/estimates' }, t('Estimates')), ' / ' + t('price book')), h('h1', null, t('Price book'))),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => L.priceImport() }, t('Import CSV')), L.priceUndoButton(), h('button', { class: 'btn', type: 'button', onclick: () => L.exportFlow(t('price book (CSV)'), [], () => ({ csv: true, text: C.priceBookCSV(st), name: 'price-book.csv', title: t('Price book') }), { noPrint: true }) }, t('Export CSV')), h('button', { class: 'btn primary', type: 'button', onclick: () => bookDialog() }, t('+ Item')))),
      h('p', { class: 'note big', id: 'example-note' }, h('b', null, t('Example prices.') + ' '), t('The starting prices are placeholders, not market rates. Replace them with your supplier costs and your real labor hours. Editing an item clears its "example price" mark.')),
      h('section', { class: 'card' }, L.table([t('Trade'), t('Item'), t('Unit'), { t: t('Material cost'), cls: 'num' }, { t: t('Labor hours'), cls: 'num' }, ''], rows)));
  };
  function bookDialog(b) {
    const st = L.st, isNew = !b; b = b || { cat: st.trades[0], name: '', unit: 'each', mat: 0, lab: 100, key: '' };
    const cat = L.select(L.tradeOpts(), b.cat), name = L.input({ name: 'name', value: tt(b.name) }), unit = L.input({ name: 'unit', value: tt(b.unit) }), mat = L.money(b.mat, { name: 'mat' }), lab = L.input({ name: 'lab', value: C.fmtHrs(b.lab), inputmode: 'decimal' });
    L.modal(isNew ? t('New price book item') : t('Edit item'), close => L.form({}, [L.field(t('Trade'), cat), L.field(t('Item'), name), h('div', { class: 'grid3' }, L.field(t('Unit'), unit), L.field(t('Material cost per unit'), mat), L.field(t('Labor hours per unit'), lab)),
      h('div', { class: 'row end' }, isNew ? null : h('button', { type: 'button', class: 'btn danger', onclick: () => { close(); L.confirm(t('Delete {name} from the price book? Estimates already made keep their lines.', { name: tt(b.name) }), t('Delete'), () => { st.priceBook = st.priceBook.filter(x => x !== b); L.commit(); }, true); } }, t('Delete')), isNew ? null : h('span', { class: 'grow' }), h('button', { type: 'button', class: 'btn', onclick: close }, t('Cancel')), h('button', { class: 'btn primary', type: 'submit' }, t('Save')))], () => {
      const n = Math.round(parseFloat(lab.value) * 100); if (!name.value.trim()) throw new Error(t('Name the item')); if (isNaN(n) || n < 0) throw new Error(t('Labor hours is a number'));
      Object.assign(b, { cat: cat.value, name: name.value.trim() === tt(b.name) ? b.name : name.value.trim(), unit: unit.value.trim() === tt(b.unit) ? b.unit : unit.value.trim() || 'each', mat: L.cents(mat.value || '0', t('the material cost')), lab: n, example: false }); if (isNew) { b.id = C.nid(st, 'pb'); st.priceBook.push(b); } close(); L.commit(); }));
  }

  /* ---------------- customers ---------------- */
  L.routes.customers = function () {
    const st = L.st;
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, t('Customers')), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => L.csvImport(t('customers'), x => C.importCustomers(st, x)) }, t('Import CSV')),
      h('button', { class: 'btn', type: 'button', onclick: () => L.exportFlow(t('customers (CSV)'), [{ key: 'contact', label: t('Include phones and emails'), value: true }, { key: 'notes', label: t('Include notes'), value: false }], o => ({ csv: true, text: C.customersCSV(st, o), name: 'customers.csv', title: t('Customers') }), { noPrint: true }) }, t('Export CSV')), h('button', { class: 'btn primary', type: 'button', onclick: () => custDialog() }, t('+ Customer')))),
      h('p', { class: 'muted' }, t('Only what you need to do the work and get paid: a name, a way to reach them, and the job site on each job. No birth dates, ID numbers or payment details.')),
      h('section', { class: 'card' }, st.customers.length ? L.table([t('Customer'), t('Phone'), t('Jobs'), { t: t('Contract value'), cls: 'num' }], st.customers.map(c => { const js = st.jobs.filter(j => j.customerId === c.id);
        return h('tr', { class: 'clickable', onclick: () => L.go('#/customer/' + c.id) }, h('td', null, h('a', { href: '#/customer/' + c.id }, c.name)), h('td', null, c.phone || '-'), h('td', null, js.map(j => j.num).join(', ') || '-'), L.num(C.fmt(js.reduce((s, j) => s + C.contractTotal(j), 0)))); })) : L.empty(t('No customers yet. Add the people you work for: a name and a phone number is enough.'), t('+ Customer'), () => custDialog(), 'empty-cust')));
  };
  function custDialog(c) {
    const st = L.st, isNew = !c; c = c || { name: '', phone: '', email: '', notes: '' };
    const name = L.input({ name: 'name', value: c.name, id: 'cu-name' }), phone = L.input({ name: 'phone', value: c.phone, type: 'tel' }), email = L.input({ name: 'email', value: c.email, type: 'email' }), notes = L.area(tt(c.notes), { name: 'notes', id: 'cu-notes' });
    L.modal(isNew ? t('New customer') : t('Edit customer'), close => L.form({}, [L.field(t('Name'), name), h('div', { class: 'grid2' }, L.field(t('Phone'), phone), L.field(t('Email (optional)'), email)), L.field(t('Notes'), notes, t('Access notes only: gate codes are better given by phone.')), L.actions(close)], () => {
      if (!name.value.trim()) throw new Error(t('Enter a name')); Object.assign(c, { name: name.value.trim(), phone: phone.value.trim(), email: email.value.trim(), notes: notes.value === tt(c.notes) ? c.notes : notes.value }); if (isNew) { c.id = C.nid(st, 'u'); st.customers.push(c); } close(); L.commit(); }));
  }
  L.routes.customer = function (id) {
    const st = L.st, c = C.customer(st, id); if (!c) return L.gone(t('No such customer.'), '#/customers', t('Customers'));
    const js = st.jobs.filter(j => j.customerId === id), es = st.estimates.filter(e => e.customerId === id), inv = [], permits = []; js.forEach(j => { j.invoices.forEach(i => inv.push({ j, i })); j.permits.forEach(p => permits.push({ j, p })); });
    const ws = st.warranties.filter(w => w.customerId === id);
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, h('a', { href: '#/customers' }, t('Customers')), ' / ', c.name), h('h1', null, c.name), h('p', { class: 'muted' }, [c.phone, c.email].filter(Boolean).join('  ·  '))),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => custDialog(c) }, t('Edit')))),
      c.notes ? h('p', { class: 'note' }, tt(c.notes)) : null,
      h('div', { class: 'grid2' }, h('section', { class: 'card' }, h('h2', null, t('Jobs')), js.length ? L.table([t('Job'), t('Stage'), { t: t('Contract'), cls: 'num' }], js.map(j => h('tr', null, h('td', null, h('a', { href: '#/job/' + j.id }, j.num + ' ' + tt(j.title))), h('td', null, L.stage(j.stage)), L.num(C.fmt(C.contractTotal(j)))))) : L.empty(t('No jobs for this customer yet.'), t('+ New job'), () => L.jobDialog())),
        h('section', { class: 'card' }, h('h2', null, t('Estimates')), es.length ? L.table([t('Estimate'), t('Status'), { t: t('Total'), cls: 'num' }], es.map(e => h('tr', null, h('td', null, h('a', { href: '#/estimate/' + e.id }, e.num + ' ' + tt(e.title))), h('td', null, t(e.status)), L.num(C.fmt(C.estimateTotals(e).total))))) : L.empty(t('No estimates for this customer yet.'), t('+ New estimate'), newEstimate)),
        h('section', { class: 'card' }, h('h2', null, t('Invoices')), inv.length ? L.table([t('Invoice'), t('Job'), t('Due'), { t: t('Amount due'), cls: 'num' }, t('Status')], inv.map(x => h('tr', null, h('td', null, x.i.num), h('td', null, x.j.num), h('td', null, C.fmtShort(x.i.dueDate)), L.num(C.fmt(x.i.due)), h('td', null, x.i.paid ? L.chip(t('Paid'), 'green') : L.chip(t('Open'), 'amber'))))) : L.empty(t('No invoices.'))),
        h('section', { class: 'card' }, h('h2', null, t('Permits, inspections and warranties')), permits.length ? L.table([t('Job'), t('Permit'), t('Inspection')], permits.map(x => h('tr', null, h('td', null, x.j.num), h('td', null, tt(x.p.kind) + ' ' + x.p.number), h('td', null, C.fmtShort(x.p.inspDate) + ' ' + (x.p.result ? t(x.p.result === 'passed' ? 'Passed' : 'Failed') : t('Pending')))))) : L.empty(t('No permits.')),
          ws.length ? h('ul', null, ws.map(w => h('li', null, t('{item}, installed {date}', { item: tt(w.item), date: C.fmtDate(w.installed) })))) : null)),
      h('div', { class: 'row end danger-zone' }, h('button', { class: 'btn danger', type: 'button', onclick: () => js.length ? L.toast(t('This customer has jobs. Keep the record for warranty and tax reasons.'), true) : L.confirm(t('Delete {name}?', { name: c.name }), t('Delete'), () => { st.customers = st.customers.filter(x => x !== c); L.save(); L.go('#/customers'); }, true) }, t('Delete'))));
  };

  /* ---------------- warranties and callbacks ---------------- */
  L.routes.warranties = function () {
    const st = L.st, d = T();
    const rows = st.warranties.map(w => { const s = C.warrantyStatus(w, d), cu = C.customer(st, w.customerId), j = C.job(st, w.jobId);
      return h('tr', null, h('td', null, h('b', null, tt(w.item)), h('div', { class: 'fine' }, (cu ? cu.name : '-') + (j ? ' · ' + j.num : '')), w.notes ? h('div', { class: 'fine' }, tt(w.notes)) : null), h('td', null, C.fmtShort(w.installed)), h('td', null, s.labEnd ? (s.laborLeft < 0 ? L.chip(t('ended {date}', { date: C.fmtShort(s.labEnd) }), 'dim') : C.fmtDate(s.labEnd)) : '-'), h('td', null, s.mfrEnd ? C.fmtDate(s.mfrEnd) : '-'),
        h('td', null, s.next ? (s.nextDays < 0 ? L.chip(t('was due {date}', { date: C.fmtShort(s.next) }), 'amber') : s.nextDays <= 30 ? L.chip(t('due {date}', { date: C.fmtShort(s.next) }), 'blue') : C.fmtDate(s.next)) : '-'),
        h('td', { class: 'acts' }, s.next ? h('button', { class: 'btn sm', type: 'button', onclick: () => { w.lastCallback = d; C.log(st, d, tt(w.item) + ': ' + t('Callback done')); L.commit(); } }, t('Callback done')) : null, h('button', { class: 'btn sm', type: 'button', onclick: () => warDialog(w) }, t('Edit')))); });
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, t('Warranties and callbacks')), h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/money/callbacks' }, t('Callback log')), h('button', { class: 'btn primary', type: 'button', onclick: () => warDialog() }, t('+ Warranty')))),
      h('p', { class: 'muted' }, t('Track your workmanship warranty and the maker’s warranty on what you installed, and set a service reminder, for example a yearly water heater flush. Reminders show on Today 30 days ahead. Warranty work caused by a sub goes in the callback log.')),
      h('section', { class: 'card' }, st.warranties.length ? L.table([t('Item'), t('Installed'), t('Your labor warranty to'), t('Maker warranty to'), t('Next service'), ''], rows) : L.empty(t('No warranties recorded. Add a water heater or fixture you installed to get a service reminder before it is due.'), t('+ Warranty'), () => warDialog(), 'empty-war')));
  };
  function warDialog(w) {
    const st = L.st, isNew = !w; w = w || { item: '', jobId: '', customerId: '', installed: T(), laborYears: st.company.warrantyYears, mfrYears: 0, callbackMonths: 12, lastCallback: '', notes: '' };
    const item = L.input({ name: 'item', value: tt(w.item) }), job = L.select([['', t('No job')]].concat(st.jobs.map(j => [j.id, j.num + ' ' + tt(j.title)])), w.jobId), cust = L.select([['', t('Choose')]].concat(st.customers.map(c => [c.id, c.name])), w.customerId),
      inst = L.date(w.installed), ly = L.input({ value: String(w.laborYears), inputmode: 'numeric' }), my = L.input({ value: String(w.mfrYears), inputmode: 'numeric' }), cb = L.input({ value: String(w.callbackMonths), inputmode: 'numeric' }), notes = L.area(tt(w.notes), { name: 'notes' });
    L.modal(isNew ? t('New warranty') : t('Edit warranty'), close => L.form({}, [L.field(t('What was installed'), item), h('div', { class: 'grid2' }, L.field(t('Customer'), cust), L.field(t('Job'), job)), h('div', { class: 'grid4' }, L.field(t('Installed'), inst), L.field(t('Your labor warranty (years)'), ly), L.field(t('Maker warranty (years)'), my), L.field(t('Service every (months, 0 = none)'), cb)), L.field(t('Notes'), notes), L.actions(close)], () => {
      if (!item.value.trim()) throw new Error(t('What was installed?')); if (!C.isDate(inst.value)) throw new Error(t('Pick the install date'));
      const j = C.job(st, job.value); Object.assign(w, { item: item.value.trim() === tt(w.item) ? w.item : item.value.trim(), jobId: job.value, customerId: cust.value || (j ? j.customerId : ''), installed: inst.value, laborYears: parseInt(ly.value, 10) || 0, mfrYears: parseInt(my.value, 10) || 0, callbackMonths: parseInt(cb.value, 10) || 0, notes: notes.value === tt(w.notes) ? w.notes : notes.value });
      if (isNew) { w.id = C.nid(st, 'wr'); st.warranties.push(w); } close(); L.commit(); }), true);
  }

  /* ---------------- reports ---------------- */
  let repYear = null;
  L.routes.reports = function () {
    const st = L.st, d = T(); repYear = repYear || +d.slice(0, 4);
    const jobs = st.jobs.filter(j => j.stage !== 'lead').map(j => ({ j, k: C.jobCost(st, j) })), tot = jobs.reduce((a, x) => ({ c: a.c + x.k.contract, p: a.p + x.k.profit }), { c: 0, p: 0 });
    const subs = C.subStats(st, d).filter(x => x.tasks);
    /* full version only */
    return h('div', { class: 'stack' }, h('h1', null, t('Reports')),
      h('section', { class: 'card' }, h('h2', null, t('Profit by job')), L.table([t('Job'), t('Stage'), { t: t('Contract'), cls: 'num' }, { t: t('Subs'), cls: 'num' }, { t: t('Crew'), cls: 'num' }, { t: t('Materials and other'), cls: 'num' }, { t: t('Profit'), cls: 'num' }, { t: t('Margin'), cls: 'num' }],
        jobs.map(x => h('tr', null, h('td', null, h('a', { href: '#/job/' + x.j.id + '/profit' }, x.j.num), h('div', { class: 'fine' }, tt(x.j.title))), h('td', null, L.stage(x.j.stage)), L.num(C.fmt(x.k.contract)), L.num(C.fmt(x.k.subs)), L.num(C.fmt(x.k.crew)), L.num(C.fmt(x.k.materials + x.k.other + x.k.callbacks - x.k.backcharges)), L.num(C.fmt(x.k.profit), x.k.profit < 0 ? 'neg' : ''), L.num(C.fmtBps(x.k.marginBps))))
          .concat([h('tr', { class: 'foot' }, h('td', null, t('All jobs')), h('td'), L.num(C.fmt(tot.c)), h('td'), h('td'), h('td'), L.num(C.fmt(tot.p)), L.num(tot.c ? C.fmtBps(C.roundDiv(tot.p * 10000, tot.c)) : '-'))]))),
      h('section', { class: 'card' }, h('h2', null, t('Profit by sub')), h('p', { class: 'fine' }, t('What you billed the customer for each sub’s tasks, against what you agreed to pay them.')),
        L.table([t('Sub'), { t: t('Tasks'), cls: 'num' }, { t: t('Billed for their work'), cls: 'num' }, { t: t('Agreed with sub'), cls: 'num' }, { t: t('Your spread'), cls: 'num' }, { t: t('Paid'), cls: 'num' }, { t: t('Backcharges'), cls: 'num' }, { t: t('Score'), cls: 'num' }],
          subs.map(x => h('tr', null, h('td', null, L.dot(x.comp), h('a', { href: '#/sub/' + x.sub.id }, x.sub.name)), L.num(x.tasks), L.num(C.fmt(x.bill)), L.num(C.fmt(x.awarded)), L.num(C.fmt(x.margin), x.margin < 0 ? 'neg' : ''), L.num(C.fmt(x.paid)), L.num(C.fmt(x.backcharges)), L.num(String(x.rel.score)))))),
      window.StarkTrial.card('tax_1099'));
  };
  /* ---------------- capacity forecast ---------------- */
  L.routes.forecast = function () {
    const st = L.st, d = T(), f = C.forecast(st, d, 6), maxV = Math.max(1, ...f.months.map(m => m.booked + m.weighted)), next = f.months[1];
    const trades = Object.keys(f.profile.prof);
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, t('Capacity forecast')), h('a', { class: 'btn', href: '#/schedule' }, t('Can we take a job?'))),
      next ? h('section', { class: 'card hero', id: 'forecast-hero' }, h('div', { class: 'big' }, tn(next.take, 'You can take about {n} more typical job in {month}.', 'You can take about {n} more typical jobs in {month}.', { month: next.label })),
        next.bottleneck ? h('p', null, t('Bottleneck trade: {trade}. Adding a sub or crew time there raises the number fastest.', { trade: tt(next.bottleneck) })) : null) : null,
      h('section', { class: 'card' }, h('h2', null, t('Pipeline and room by month')), h('div', { class: 'fbars', id: 'fbars' }, f.months.map(m => h('div', { class: 'fcol' }, h('div', { class: 'fstack' }, h('i', { class: 'w h' + Math.round(10 * m.weighted / maxV), title: C.fmt0(m.weighted) }), h('i', { class: 'b h' + Math.round(10 * m.booked / maxV), title: C.fmt0(m.booked) })),
          h('div', { class: 'flab' }, m.label.split(' ')[0].slice(0, 3)), h('div', { class: 'ftake' + (m.take === 0 ? ' zero' : '') }, '+' + m.take)))),
        h('div', { class: 'legend' }, h('span', null, h('i', { class: 'sw b' }), t('Booked work starting that month')), h('span', null, h('i', { class: 'sw w' }), t('Leads and estimates, weighted')), h('span', null, h('b', null, '+n'), ' ' + t('more typical jobs you could take'))),
        L.table([t('Month'), { t: t('Booked'), cls: 'num' }, { t: t('Weighted pipeline'), cls: 'num' }, { t: t('Busy'), cls: 'num' }, { t: t('Room for'), cls: 'num' }, t('Bottleneck')], f.months.map(m => h('tr', null, h('td', null, m.label), L.num(C.fmt0(m.booked)), L.num(C.fmt0(m.weighted)), L.num(m.util + '%'), L.num(tn(m.take, '{n} job', '{n} jobs')), h('td', null, m.bottleneck ? tt(m.bottleneck) : '-'))))),
      h('section', { class: 'card' }, h('h2', null, t('Trade days by month')), L.table([t('Trade'), t('Per typical job')].concat(f.months.map(m => m.label.split(' ')[0].slice(0, 3))), trades.map(tr => h('tr', null, h('td', null, tt(tr)), L.num(String(f.profile.prof[tr])), f.months.map(m => { const free = Math.round((m.supply[tr] || 0) - (m.demand[tr] || 0)); return L.num(free + ' / ' + Math.round(m.supply[tr] || 0), free <= 0 ? 'neg' : ''); })))),
        h('p', { class: 'fine' }, t('Free days / total days per trade. A typical job is the average of your jobs so far ({n} jobs, about {v} each). Your crew counts fully; subs count at {s}% of their days, split across their trades (change it in Settings). Leads count at 25%, estimates at 50%. A rough planning aid, not a promise.', { n: f.profile.jobs, v: C.fmt0(f.profile.avgValue), s: st.company.subShare }))));
  };
})();
