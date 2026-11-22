/* Stark Trades 2.1. Pure logic, part 3: service agreements and recurring jobs, the quote-to-cash pipeline with a Stark Ledger
   export, van stock and purchase orders, weekly timesheets, crew certifications, safety checklists and toolbox talks,
   before/after photo and customer status reports, a permit tracker by jurisdiction, more trade presets and quick search.
   No DOM and no network. Extends StarkCore in the browser and in Node. */
(function (root) {
  'use strict';
  const C = root.StarkCore || require('./core2.js');
  if (typeof module !== 'undefined' && module.exports) { try { require('./es2.js'); } catch (e) { /* Spanish optional in Node */ } }
  const t = C.t, tt = C.tt, tn = C.tn, N = C.N;
  const stamp = () => Date.now();
  const txt = v => String(v == null ? '' : v).trim();
  const money = c => (Math.round(c || 0) / 100).toFixed(2);
  const cell = v => { const s = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(s) && isNaN(Number(s)) ? "'" + s : s; }; // no spreadsheet formulas
  const csvSafe = rows => C.csv(rows.map(r => r.map(cell)));
  const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
  const avg = a => a.length ? Math.round(sum(a) / a.length) : null;
  const inRange = (d, from, to) => C.isDate(d) && d >= from && d <= to;
  const ACTIVE = ['scheduled', 'progress', 'inspection'];
  C.VERSION = '2.5.1';
  N('draft'); N('sent'); N('partial'); N('received'); N('cancelled'); N('Shop'); N('Van 1'); N('Van 2');

  /* ---------- state: new collections and defaults (older workspaces gain them on unlock) ---------- */
  const EXTRA = ['plans', 'recurring', 'stock', 'stockMoves', 'pos', 'safety', 'tsApprovals', 'jurisdictions', 'certRules'];
  const baseNew = C.newState, baseMigrate = C.migrate;
  C.newState = function (preset) {
    const st = baseNew(preset); EXTRA.forEach(k => { st[k] = []; });
    Object.assign(st.company, { stockLocs: ['Shop', 'Van 1'], nextPO: 1001, nextPlan: 101, otHours: 4000, talkDays: 7 }); return st;
  };
  C.migrate = function (st) {
    baseMigrate(st);
    st.crew.forEach(c => { if (!Array.isArray(c.certs)) c.certs = []; });
    st.jobs.forEach(j => j.permits.forEach(p => { if (p.jurisdiction == null) p.jurisdiction = ''; if (p.expires == null) p.expires = ''; }));
    if (!st.company.stockLocs.length) st.company.stockLocs = ['Shop'];
    return st;
  };
  const did = (st, p) => C.nid(st, p) + '-' + (st.device && st.device.id ? st.device.id.slice(0, 4) : 'x'); // ids that stay unique across office and field devices

  /* ---------- more trade presets ---------- */
  const P = (key, cat, name, unit, mat, lab) => ({ key, cat, name, unit, mat, lab, example: true });
  Object.assign(C.PRESETS, {
    roofing: { label: N('Roofing'), trades: [N('Tear-off'), N('Decking'), N('Underlayment'), N('Shingles'), N('Flashing'), N('Gutters'), N('Service and repair'), N('Inspection')],
      book: [P('sq', 'Shingles', N('Architectural shingles, installed'), N('per square'), 16000, 150), P('tear', 'Tear-off', N('Tear-off and haul, one layer'), N('per square'), 2000, 100),
        P('deck', 'Decking', N('Replace decking, 7/16 OSB'), N('per sheet'), 2600, 50), P('ice', 'Underlayment', N('Ice and water shield'), N('per roll'), 9500, 30),
        P('drip', 'Flashing', N('Drip edge'), N('per ft'), 150, 2), P('gutter', 'Gutters', N('Seamless aluminum gutter'), N('per ft'), 450, 10)] },
    landscaping: { label: N('Landscaping and irrigation'), trades: [N('Irrigation'), N('Hardscape'), N('Planting'), N('Grading and drainage'), N('Lawn care'), N('Service and repair'), N('Inspection')],
      book: [P('zone', 'Irrigation', N('Irrigation zone, 6 heads'), N('each'), 18000, 600), P('ctrl', 'Irrigation', N('Smart irrigation controller'), N('each'), 22000, 150),
        P('bftest', 'Irrigation', N('Backflow test, yearly'), N('each'), 0, 75), P('paver', 'Hardscape', N('Paver patio'), N('per sq ft'), 900, 12),
        P('sod', 'Planting', N('Sod, installed'), N('per sq ft'), 90, 1), P('fdrain', 'Grading and drainage', N('French drain'), N('per ft'), 1200, 25)] },
    remodel: { label: N('Remodeling and carpentry'), trades: [N('Demolition'), N('Framing'), N('Cabinets'), N('Tile'), N('Drywall'), N('Finish carpentry'), N('Painting'), N('Inspection')],
      book: [P('cab', 'Cabinets', N('Base cabinet, set and level'), N('each'), 0, 150), P('base', 'Finish carpentry', N('Baseboard, paint grade'), N('per ft'), 180, 4),
        P('door', 'Finish carpentry', N('Interior door, prehung'), N('each'), 18000, 150), P('tile', 'Tile', N('Floor tile, installed'), N('per sq ft'), 500, 15),
        P('frame', 'Framing', N('Interior wall framing'), N('per ft'), 1200, 30)] }
  });
  Object.assign(C.SEQ, {
    roofing: [[N('Tear-off'), 'Tear-off', 1], [N('Decking'), 'Decking', 1], [N('Underlayment'), 'Underlayment', 1], [N('Shingles'), 'Shingles', 2], [N('Flashing'), 'Flashing', 1], [N('Final inspection'), 'Inspection', 1]],
    landscaping: [[N('Grading and drainage'), 'Grading and drainage', 2], [N('Irrigation'), 'Irrigation', 2], [N('Hardscape'), 'Hardscape', 3], [N('Planting'), 'Planting', 2]],
    remodel: [[N('Demolition'), 'Demolition', 2], [N('Framing'), 'Framing', 3], [N('Rough-in inspection'), 'Inspection', 1], [N('Drywall'), 'Drywall', 3], [N('Cabinets'), 'Cabinets', 2], [N('Tile'), 'Tile', 3], [N('Finish carpentry'), 'Finish carpentry', 2], [N('Final inspection'), 'Inspection', 1]]
  });

  /* ---------- recurring jobs: a rule makes the next visit a real job on the schedule ---------- */
  C.occ = (r, k) => r.unit === 'week' ? C.addDays(r.first, 7 * r.every * k) : C.addMonths(r.first, r.every * k);
  C.addRecurring = function (st, o) {
    const title = txt(o.title); if (!title) throw new Error(t('Name the recurring job'));
    const every = parseInt(o.every, 10), unit = o.unit === 'week' ? 'week' : 'month';
    if (!(every >= 1 && every <= (unit === 'week' ? 52 : 24))) throw new Error(t('Repeat every 1 to 52 weeks, or every 1 to 24 months'));
    if (!C.isDate(o.first)) throw new Error(t('Pick the first visit date'));
    const r = { id: C.nid(st, 'rj'), customerId: o.customerId || '', title, street: txt(o.street), city: txt(o.city), trade: o.trade || '', every, unit, first: o.first, k: 0, next: o.first,
      until: C.isDate(o.until) ? o.until : '', base: o.base > 0 ? o.base : 0, hours: o.hours > 0 ? o.hours : 0, who: o.who && o.who.t ? o.who : { t: '', id: '' }, planId: o.planId || '', active: true, made: [], skipped: 0, u: stamp() };
    if (r.until && r.until < r.first) throw new Error(t('The end date is before the first visit'));
    st.recurring.push(r); return r;
  };
  C.upcoming = function (r, n) { const out = []; for (let k = r.k; out.length < (n || 4) && k < r.k + 500; k++) { const d = C.occ(r, k); if (r.until && d > r.until) break; out.push(d); } return out; };
  C.recurringDue = (st, today, ahead) => st.recurring.filter(r => r.active && (!r.until || r.next <= r.until) && r.next <= C.addDays(today, ahead || 0));
  C.spawnRecurring = function (st, rid, today) {
    const r = st.recurring.find(x => x.id === rid); if (!r || !r.active) throw new Error(t('That recurring job is not active'));
    if (r.until && r.next > r.until) { r.active = false; throw new Error(t('This recurring job has ended')); }
    const day = C.nextWork(r.next < today ? today : r.next, st.company.workDays);
    const j = C.newJob(st, { customerId: r.customerId, title: r.title, street: r.street, city: r.city, stage: 'scheduled', start: day, end: day, base: r.base }, today);
    j.recurringId = r.id; if (r.planId) j.planId = r.planId;
    const k = C.newTask(st, { name: r.title, trade: r.trade, start: day, end: day, hours: r.hours, bill: r.base }); if (r.who && r.who.t) k.who = { t: r.who.t, id: r.who.id }; j.tasks.push(k);
    r.made.push(j.id); r.k++; r.next = C.occ(r, r.k); r.u = stamp(); if (r.until && r.next > r.until) r.active = false;
    C.log(st, today, r.title + ' -> ' + j.num); return j;
  };
  /* creates every visit due within `ahead` days. A missed visit is booked from today; older missed ones are skipped, not back-filled */
  C.spawnDue = function (st, today, ahead) {
    const jobs = []; let skipped = 0;
    st.recurring.forEach(r => {
      if (!r.active) return;
      while (r.next < today && C.occ(r, r.k + 1) < today) { r.k++; r.next = C.occ(r, r.k); r.skipped++; skipped++; } // only the latest missed visit is caught up
      let guard = 0; while (r.active && (!r.until || r.next <= r.until) && r.next <= C.addDays(today, ahead || 0) && guard++ < 60) jobs.push(C.spawnRecurring(st, r.id, today));
      if (r.until && r.next > r.until) r.active = false;
    });
    return { jobs, skipped };
  };

  /* ---------- service agreements and maintenance plans ---------- */
  const PER = { month: 12, quarter: 4, year: 1 };
  C.BILL_EVERY = [['month', N('Monthly')], ['quarter', N('Quarterly')], ['year', N('Yearly')]];
  C.planEnd = p => C.addMonths(p.start, p.termMonths);
  C.planEvery = visits => 12 % visits === 0 ? { every: 12 / visits, unit: 'month' } : { every: Math.max(1, Math.round(52 / visits)), unit: 'week' };
  C.addPlan = function (st, o, today) {
    const cu = C.customer(st, o.customerId); if (!cu) throw new Error(t('Choose a customer for the agreement'));
    const title = txt(o.title); if (!title) throw new Error(t('Name the plan, for example "Yearly water heater service"'));
    const visits = parseInt(o.visits, 10), term = parseInt(o.termMonths == null ? 12 : o.termMonths, 10), start = C.isDate(o.start) ? o.start : today;
    if (!(visits >= 1 && visits <= 52)) throw new Error(t('Visits per year must be from 1 to 52'));
    if (!(term >= 1 && term <= 60)) throw new Error(t('The term must be from 1 to 60 months'));
    if (!(o.price >= 0)) throw new Error(t('Enter the yearly price'));
    const billEvery = PER[o.billEvery] ? o.billEvery : 'year';
    const p = { id: C.nid(st, 'sa'), num: 'SA-' + (st.company.nextPlan++), customerId: cu.id, title, street: txt(o.street), city: txt(o.city), trade: o.trade || '', start, termMonths: term, price: o.price, billEvery,
      visits, visitHours: o.visitHours > 0 ? o.visitHours : 0, covers: txt(o.covers), discountBps: o.discountBps > 0 ? Math.min(5000, o.discountBps) : 0, autoRenew: o.autoRenew !== false, status: 'active', bills: [], history: [], recurringId: '', u: stamp() };
    st.plans.push(p);
    const ev = C.planEvery(visits), end = C.addDays(C.planEnd(p), -1);
    const r = C.addRecurring(st, { customerId: cu.id, title, street: p.street, city: p.city, trade: p.trade, every: ev.every, unit: ev.unit, first: C.isDate(o.firstVisit) ? o.firstVisit : start, until: end, hours: p.visitHours, who: o.who, planId: p.id });
    p.recurringId = r.id; C.log(st, today, p.num + ' ' + title); return p;
  };
  /* bill dates and amounts for the current term; the amounts add up to the term price exactly */
  C.planSchedule = function (p) {
    const step = 12 / PER[p.billEvery], n = Math.max(1, Math.round(p.termMonths / step)), total = C.roundDiv(p.price * p.termMonths, 12), each = Math.floor(total / n), out = [];
    for (let i = 0; i < n; i++) out.push({ date: C.addMonths(p.start, step * i), amount: i === n - 1 ? total - each * (n - 1) : each });
    return out;
  };
  C.planStatus = function (st, p, today) {
    const end = C.planEnd(p), days = C.daysBetween(today, end), sched = C.planSchedule(p), next = sched[p.bills.length] || null;
    const visitJobs = st.jobs.filter(j => j.planId === p.id && j.start >= p.start && j.start < end), done = visitJobs.filter(j => j.stage === 'done' || j.stage === 'paid').length;
    const owed = sum(p.bills.filter(b => !b.paid), b => b.amount);
    return { end, daysLeft: days, state: p.status === 'cancelled' ? 'cancelled' : days <= 0 ? 'ended' : days <= 30 ? 'renew' : 'active', schedule: sched, nextBill: next, billDue: p.status !== 'cancelled' && !!next && next.date <= today,
      termTotal: sum(sched, x => x.amount), visitsPlanned: Math.max(1, Math.round(p.visits * p.termMonths / 12)), visitsMade: visitJobs.length, visitsDone: done, owed };
  };
  C.billPlan = function (st, planId, date, today) {
    const p = st.plans.find(x => x.id === planId); if (!p) throw new Error(t('No such service agreement'));
    if (p.status === 'cancelled') throw new Error(t('This agreement is cancelled'));
    const next = C.planSchedule(p)[p.bills.length]; if (!next) throw new Error(t('Every bill for this term has been made'));
    const d = C.isDate(date) ? date : today;
    const b = { id: C.nid(st, 'sb'), num: 'INV-' + (st.company.nextInv++), date: d, period: next.date, dueDate: C.addDays(d, st.company.termsDays), amount: next.amount, paid: false, paidDate: '' };
    p.bills.push(b); p.u = stamp(); C.log(st, today, p.num + ' ' + b.num); return b;
  };
  C.payPlanBill = function (st, planId, billId, date) {
    const p = st.plans.find(x => x.id === planId), b = p && p.bills.find(x => x.id === billId); if (!b) throw new Error(t('No such bill'));
    if (!C.isDate(date)) throw new Error(t('Pick the date paid')); b.paid = true; b.paidDate = date; p.u = stamp(); return b;
  };
  C.renewPlan = function (st, planId, raiseBps, today) {
    const p = st.plans.find(x => x.id === planId); if (!p) throw new Error(t('No such service agreement'));
    if (p.status === 'cancelled') throw new Error(t('This agreement is cancelled'));
    if (C.planStatus(st, p, today).daysLeft > 60) throw new Error(t('Renew within 60 days of the end date'));
    const raise = raiseBps > 0 ? Math.min(5000, raiseBps) : 0;
    p.history.push({ start: p.start, termMonths: p.termMonths, price: p.price, bills: p.bills });
    p.start = C.planEnd(p); p.price = p.price + C.roundDiv(p.price * raise, 10000); p.bills = []; p.u = stamp();
    const r = st.recurring.find(x => x.id === p.recurringId); if (r) { r.until = C.addDays(C.planEnd(p), -1); r.active = true; r.u = stamp(); }
    C.log(st, today, p.num + ' renewed'); return p;
  };
  C.cancelPlan = function (st, planId, today) {
    const p = st.plans.find(x => x.id === planId); if (!p) throw new Error(t('No such service agreement'));
    p.status = 'cancelled'; p.cancelled = today; p.u = stamp(); const r = st.recurring.find(x => x.id === p.recurringId); if (r) r.active = false; C.log(st, today, p.num + ' cancelled'); return p;
  };
  C.planSummary = function (st, today) {
    const act = st.plans.filter(p => p.status !== 'cancelled' && C.planStatus(st, p, today).daysLeft > 0), annual = sum(act, p => p.price);
    return { active: act.length, members: new Set(act.map(p => p.customerId)).size, annual, monthly: C.roundDiv(annual, 12), renewSoon: act.filter(p => C.planStatus(st, p, today).state === 'renew').length,
      owed: sum(st.plans, p => sum(p.bills.filter(b => !b.paid), b => b.amount)) };
  };
  /* plan profit: what the term bills against the cost of the visit jobs */
  C.planProfit = function (st, p) {
    const end = C.planEnd(p), jobs = st.jobs.filter(j => j.planId === p.id && j.start >= p.start && j.start < end), cost = sum(jobs, j => C.jobCost(st, j).cost), revenue = sum(C.planSchedule(p), x => x.amount);
    return { revenue, cost, profit: revenue - cost, marginBps: revenue ? C.roundDiv((revenue - cost) * 10000, revenue) : 0 };
  };
  C.planDoc = function (st, planId, opts, today) {
    opts = Object.assign({ address: 'full', customer: true }, opts);
    const p = st.plans.find(x => x.id === planId); if (!p) throw new Error(t('No such service agreement'));
    const cu = C.customer(st, p.customerId), s = C.planStatus(st, p, today), co = st.company, L = [];
    L.push(t('TEMPLATE, HAVE A LAWYER REVIEW IT BEFORE USE.'), '', C.fromLine(st));
    if (opts.customer && cu) L.push(t('Customer: {name}', { name: cu.name }));
    L.push(t('Service address: {site}', { site: C.siteText(p, opts.address) }), '');
    L.push(t('Plan: {title}', { title: tt(p.title) }), t('Term: {from} to {to}', { from: C.fmtDate(p.start), to: C.fmtDate(C.addDays(s.end, -1)) }));
    L.push(t('Scheduled visits: {n} per year', { n: p.visits }));
    if (p.covers) L.push(t('Each visit covers: {what}', { what: tt(p.covers) }));
    L.push(t('Price: {amt} per year', { amt: C.fmt(p.price) }), t('Billing: {n} bill(s) of about {amt}, {how}', { n: s.schedule.length, amt: C.fmt(s.schedule[0].amount), how: t((C.BILL_EVERY.find(b => b[0] === p.billEvery) || [0, 'Yearly'])[1]).toLowerCase() }));
    if (p.discountBps) L.push(t('Plan members get {pct} off repair labor and parts quoted during the term.', { pct: C.fmtBps(p.discountBps) }));
    L.push('', t('Repairs found during a visit are quoted separately and done only after you approve them.'));
    L.push(p.autoRenew ? t('The plan renews for another term unless either side cancels in writing at least 30 days before the end date.') : t('The plan ends on the end date unless both sides agree to renew.'));
    L.push(t('Either side may cancel in writing. Visits already made are paid for; unused prepaid amounts are refunded pro rata.'), '', t('Customer signature: ____________________   Date: ________'), t('Contractor signature: ____________________   Date: ________'));
    return { title: t('Service agreement {num}', { num: p.num }), lines: L, name: 'agreement-' + p.num + '.txt' };
  };

  /* ---------- van stock: locations, par levels, use on jobs, refills ---------- */
  C.qtyAt = (it, loc) => (it.qty && it.qty[loc]) || 0;
  C.qtyAll = it => sum(Object.keys(it.qty || {}).map(k => it.qty[k]));
  C.addStockItem = function (st, o) {
    const name = txt(o.name); if (!name) throw new Error(t('Name the part'));
    if (!(o.cost >= 0)) throw new Error(t('Enter the unit cost'));
    const sku = txt(o.sku); if (sku && st.stock.some(x => x.sku && x.sku.toLowerCase() === sku.toLowerCase() && x.id !== o.id)) throw new Error(t('Another part already uses SKU {sku}', { sku }));
    const it = { id: C.nid(st, 'sk'), sku, name, unit: txt(o.unit) || 'each', cost: o.cost, supplier: txt(o.supplier), qty: {}, par: {}, u: stamp() };
    Object.keys(o.par || {}).forEach(l => { if (st.company.stockLocs.indexOf(l) >= 0 && o.par[l] > 0) it.par[l] = o.par[l]; });
    st.stock.push(it); return it;
  };
  C.moveStock = function (st, o, today) {
    const it = st.stock.find(x => x.id === o.itemId); if (!it) throw new Error(t('No such part'));
    const locs = st.company.stockLocs, q = o.qty, kind = o.kind, date = C.isDate(o.date) ? o.date : today;
    const need = l => { if (locs.indexOf(l) < 0) throw new Error(t('Unknown stock location')); };
    if (typeof q !== 'number' || isNaN(q) || q < 0 || (kind !== 'count' && q === 0)) throw new Error(t('Enter a quantity above zero'));
    const m = { id: C.nid(st, 'sm'), date, kind, itemId: it.id, qty: q, from: '', to: '', jobId: '', poId: o.poId || '', cost: 0, u: stamp() };
    if (kind === 'receive') { need(o.to); it.qty[o.to] = C.qtyAt(it, o.to) + q; m.to = o.to; if (o.cost >= 0) it.cost = o.cost; m.cost = C.roundDiv(q * it.cost, 1000); }
    else if (kind === 'use' || kind === 'transfer') {
      need(o.from); const have = C.qtyAt(it, o.from);
      if (have < q) throw new Error(t('Only {n} {unit} of {item} at {loc}', { n: C.fmtMilli(have), unit: tt(it.unit), item: tt(it.name), loc: tt(o.from) }));
      if (kind === 'transfer') { need(o.to); if (o.to === o.from) throw new Error(t('Pick two different locations')); it.qty[o.from] = have - q; it.qty[o.to] = C.qtyAt(it, o.to) + q; m.from = o.from; m.to = o.to; }
      else {
        const j = C.job(st, o.jobId); if (!j) throw new Error(t('Choose the job the parts went to'));
        it.qty[o.from] = have - q; m.from = o.from; m.jobId = j.id; m.cost = C.roundDiv(q * it.cost, 1000); j.materials = (j.materials || 0) + m.cost;
        if (!j.stockUsed) j.stockUsed = []; j.stockUsed.push({ moveId: m.id, itemId: it.id, qty: q, cost: m.cost, date });
      }
    } else if (kind === 'count') { need(o.at); m.to = o.at; m.diff = q - C.qtyAt(it, o.at); it.qty[o.at] = q; }
    else throw new Error(t('Unknown stock move'));
    it.u = stamp(); st.stockMoves.push(m); if (st.stockMoves.length > 5000) st.stockMoves.splice(0, st.stockMoves.length - 5000); return m;
  };
  C.refills = (st, loc) => st.stock.filter(it => (it.par[loc] || 0) > C.qtyAt(it, loc)).map(it => ({ item: it, loc, have: C.qtyAt(it, loc), par: it.par[loc], need: it.par[loc] - C.qtyAt(it, loc), shop: C.qtyAt(it, st.company.stockLocs[0]) }));
  C.lowStock = st => { const out = []; st.company.stockLocs.forEach(l => C.refills(st, l).forEach(r => out.push(r))); return out; };
  /* a van refill: move what the shop has, up to par; anything the shop lacks is listed to order */
  C.restockVan = function (st, loc, today) {
    const shop = st.company.stockLocs[0]; if (loc === shop) throw new Error(t('Pick a van, not the main stock location'));
    const moved = [], short = [];
    C.refills(st, loc).forEach(r => { const q = Math.min(r.need, C.qtyAt(r.item, shop)); if (q > 0) moved.push(C.moveStock(st, { itemId: r.item.id, kind: 'transfer', from: shop, to: loc, qty: q }, today)); if (q < r.need) short.push({ item: r.item, need: r.need - q }); });
    return { moved, short };
  };
  C.stockValue = st => { const by = {}; st.company.stockLocs.forEach(l => { by[l] = sum(st.stock, it => C.roundDiv(C.qtyAt(it, l) * it.cost, 1000)); }); return { by, total: sum(Object.keys(by).map(k => by[k])) }; };
  C.stockCSV = st => csvSafe([[t('SKU'), t('Part'), t('Unit'), t('Unit cost'), t('Supplier')].concat(st.company.stockLocs.map(tt), [t('Total'), t('Value')])].concat(st.stock.map(it =>
    [it.sku, tt(it.name), tt(it.unit), money(it.cost), it.supplier].concat(st.company.stockLocs.map(l => C.fmtMilli(C.qtyAt(it, l))), [C.fmtMilli(C.qtyAll(it)), money(C.roundDiv(C.qtyAll(it) * it.cost, 1000))]))));

  /* ---------- purchase orders to suppliers ---------- */
  C.PO_STATES = { draft: N('Draft'), sent: N('Sent'), partial: N('Part received'), received: N('Received'), cancelled: N('Cancelled') };
  C.newPO = function (st, o, today) {
    const supplier = txt(o.supplier); if (!supplier) throw new Error(t('Name the supplier'));
    const lines = (o.lines || []).filter(l => txt(l.name) || l.stockId).map(l => {
      const it = l.stockId ? st.stock.find(x => x.id === l.stockId) : null; const q = l.qty, c = l.cost != null ? l.cost : it ? it.cost : NaN;
      if (!(q > 0)) throw new Error(t('Each line needs a quantity above zero')); if (!(c >= 0)) throw new Error(t('Each line needs a unit cost'));
      return { id: C.nid(st, 'pl'), stockId: it ? it.id : '', name: it ? it.name : txt(l.name), unit: it ? it.unit : (txt(l.unit) || 'each'), qty: q, cost: c, got: 0 };
    });
    if (!lines.length) throw new Error(t('Add at least one line'));
    const j = o.jobId ? C.job(st, o.jobId) : null; if (o.jobId && !j) throw new Error(t('No such job'));
    const loc = j ? '' : (st.company.stockLocs.indexOf(o.loc) >= 0 ? o.loc : st.company.stockLocs[0]);
    const po = { id: C.nid(st, 'po'), num: 'PO-' + (st.company.nextPO++), supplier, jobId: j ? j.id : '', loc, date: C.isDate(o.date) ? o.date : today, needBy: C.isDate(o.needBy) ? o.needBy : '', lines,
      taxBps: o.taxBps != null && o.taxBps >= 0 ? o.taxBps : st.company.matTaxBps, status: 'draft', sentDate: '', received: '', paid: false, paidDate: '', notes: txt(o.notes), u: stamp() };
    st.pos.push(po); return po;
  };
  C.poTotals = po => { const sub = sum(po.lines, l => C.roundDiv(l.qty * l.cost, 1000)), tax = C.roundDiv(sub * (po.taxBps || 0), 10000); return { sub, tax, total: sub + tax, got: sum(po.lines, l => C.roundDiv(l.got * l.cost, 1000)) }; };
  const findPO = (st, id) => { const po = st.pos.find(x => x.id === id); if (!po) throw new Error(t('No such purchase order')); return po; };
  C.sendPO = function (st, id, today) { const po = findPO(st, id); if (po.status !== 'draft') throw new Error(t('Only a draft can be marked sent')); po.status = 'sent'; po.sentDate = today; po.u = stamp(); return po; };
  C.receivePO = function (st, id, got, date, today) {
    const po = findPO(st, id); if (po.status === 'cancelled' || po.status === 'received') throw new Error(t('This order is already closed'));
    const d = C.isDate(date) ? date : today, j = po.jobId ? C.job(st, po.jobId) : null; let any = false;
    po.lines.forEach(l => { const q = got[l.id] || 0; if (q < 0 || q > l.qty - l.got) throw new Error(t('More than ordered on {item}', { item: tt(l.name) })); });
    po.lines.forEach(l => {
      const q = got[l.id] || 0; if (!q) return; any = true; l.got += q;
      if (j) { const c = C.roundDiv(q * l.cost, 1000); j.materials = (j.materials || 0) + c + C.roundDiv(c * (po.taxBps || 0), 10000); }
      else if (l.stockId) C.moveStock(st, { itemId: l.stockId, kind: 'receive', to: po.loc, qty: q, cost: l.cost, poId: po.id, date: d }, today);
    });
    if (!any) throw new Error(t('Enter what arrived'));
    po.status = po.lines.every(l => l.got >= l.qty) ? 'received' : 'partial'; po.received = d; po.u = stamp(); return po;
  };
  C.payPO = function (st, id, date) { const po = findPO(st, id); if (po.status !== 'received' && po.status !== 'partial') throw new Error(t('Receive the order before you record payment')); if (!C.isDate(date)) throw new Error(t('Pick the date paid')); po.paid = true; po.paidDate = date; po.u = stamp(); return po; };
  C.cancelPO = function (st, id) { const po = findPO(st, id); if (po.lines.some(l => l.got)) throw new Error(t('Part of this order arrived; it cannot be cancelled')); po.status = 'cancelled'; po.u = stamp(); return po; };
  C.poFromRefills = function (st, supplier, today) {
    const shop = st.company.stockLocs[0], rs = C.refills(st, shop).filter(r => !supplier || (r.item.supplier || '').toLowerCase() === supplier.toLowerCase());
    if (!rs.length) throw new Error(t('Nothing at {loc} is below par', { loc: tt(shop) }));
    return C.newPO(st, { supplier: supplier || rs[0].item.supplier || t('Supplier'), loc: shop, lines: rs.map(r => ({ stockId: r.item.id, qty: r.need })) }, today);
  };
  C.poLate = (st, today) => st.pos.filter(po => (po.status === 'sent' || po.status === 'partial') && C.isDate(po.needBy) && po.needBy < today);
  C.poDoc = function (st, id, opts, today) {
    opts = Object.assign({ address: 'full', title: false }, opts); const po = findPO(st, id), j = po.jobId ? C.job(st, po.jobId) : null, x = C.poTotals(po), L = [];
    L.push(C.fromLine(st), t('To: {sup}', { sup: po.supplier }), t('Date: {date}', { date: C.fmtDate(po.date) }));
    if (po.needBy) L.push(t('Needed by: {date}', { date: C.fmtDate(po.needBy) }));
    L.push(j ? t('Deliver to job {num}: {site}', { num: j.num, site: C.siteText(j, opts.address) }) + (opts.title ? ' (' + tt(j.title) + ')' : '') : t('Deliver to: {loc}', { loc: tt(po.loc) }), '');
    po.lines.forEach(l => L.push(C.fmtMilli(l.qty) + ' ' + tt(l.unit) + '  ' + tt(l.name) + '  @ ' + C.fmt(l.cost) + ' = ' + C.fmt(C.roundDiv(l.qty * l.cost, 1000))));
    L.push('', t('Subtotal: {amt}', { amt: C.fmt(x.sub) })); if (x.tax) L.push(t('Tax: {amt}', { amt: C.fmt(x.tax) })); L.push(t('Total: {amt}', { amt: C.fmt(x.total) }));
    if (po.notes) L.push('', tt(po.notes));
    L.push('', t('Please confirm prices and the delivery date, and put {num} on your invoice.', { num: po.num }));
    return { title: t('Purchase order {num}', { num: po.num }), lines: L, name: po.num.toLowerCase() + '.txt' };
  };

  /* ---------- weekly timesheets from time in and out (hours only; no wages) ---------- */
  C.weekOf = d => C.addDays(d, -((C.dow(d) + 6) % 7));
  C.timesheet = function (st, crewId, week) {
    const days = [], jobs = {}; let total = 0, open = 0;
    for (let i = 0; i < 7; i++) {
      const date = C.addDays(week, i), es = st.timeLog.filter(x => x.crewId === crewId && x.date === date).map(x => ({ e: x, job: C.job(st, x.jobId), hours: C.hoursOf(x.clockIn, x.clockOut) }));
      es.forEach(x => { total += x.hours; if (x.e.clockIn && !x.e.clockOut) open++; const k = x.job ? x.job.num : '?'; jobs[k] = (jobs[k] || 0) + x.hours; });
      days.push({ date, entries: es, hours: sum(es, x => x.hours) });
    }
    const ot = st.company.otHours || 4000, appr = st.tsApprovals.find(a => a.crewId === crewId && a.week === week) || null;
    return { crewId, week, days, total, regular: Math.min(total, ot), over: Math.max(0, total - ot), open, approved: appr, changed: !!appr && appr.hours !== total, byJob: jobs };
  };
  C.approveTimesheet = function (st, crewId, week, by, today) {
    const ts = C.timesheet(st, crewId, week);
    if (ts.open) throw new Error(tn(ts.open, '{n} entry has no time out yet', '{n} entries have no time out yet'));
    if (!ts.total) throw new Error(t('No hours recorded that week'));
    st.tsApprovals = st.tsApprovals.filter(a => !(a.crewId === crewId && a.week === week));
    const a = { id: C.nid(st, 'ta'), crewId, week, by: txt(by) || t('Office'), date: today, hours: ts.total }; st.tsApprovals.push(a); return a;
  };
  C.timesheetsToApprove = (st, today) => { const wk = C.addDays(C.weekOf(today), -7); return st.crew.filter(c => c.active !== false).map(c => C.timesheet(st, c.id, wk)).filter(ts => ts.total && (!ts.approved || ts.changed)).map(ts => ({ ts, crew: C.crewM(st, ts.crewId) })); };
  C.timesheetCSV = function (st, week) {
    const rows = [[t('Crew member'), t('Date'), t('Job'), t('In'), t('Out'), t('Hours')]];
    st.crew.forEach(c => { const ts = C.timesheet(st, c.id, week); if (!ts.total && !ts.open) return;
      ts.days.forEach(d => d.entries.forEach(x => rows.push([c.name, d.date, x.job ? x.job.num : '', x.e.clockIn, x.e.clockOut, C.fmtHrs(x.hours)])));
      rows.push([c.name, t('Week total'), '', '', '', C.fmtHrs(ts.total)], [c.name, t('Regular'), '', '', '', C.fmtHrs(ts.regular)], [c.name, t('Over {h} h', { h: C.fmtHrs(st.company.otHours) }), '', '', '', C.fmtHrs(ts.over)], [c.name, t('Approved'), ts.approved ? ts.approved.date : t('no'), '', '', '']); });
    return csvSafe(rows);
  };

  /* ---------- crew certifications and the certs a trade needs ---------- */
  C.CERT_TYPES = [N('OSHA 10'), N('OSHA 30'), N('First aid and CPR'), N('Backflow tester'), N('Medical gas installer'), N('Confined space entry'), N('Excavation competent person'), N('EPA 608 refrigerant'), N('Lead-safe renovator (RRP)'), N('Journeyman license'), N('Master license'), N('Fall protection'), N('Forklift operator')];
  C.addCert = function (st, crewId, o) {
    const c = C.crewM(st, crewId); if (!c) throw new Error(t('Pick a crew member'));
    const name = txt(o.name); if (!name) throw new Error(t('Name the certification'));
    if (o.expires && !C.isDate(o.expires)) throw new Error(t('Pick a valid expiry date'));
    if (!Array.isArray(c.certs)) c.certs = [];
    const ce = { id: C.nid(st, 'ce'), name, number: txt(o.number), issuer: txt(o.issuer), expires: o.expires || '', u: stamp() }; c.certs.push(ce); return ce;
  };
  C.certState = (ce, today) => ce.expires ? C.docState(ce.expires, today) : { state: 'ok', days: null, alert: null, none: true };
  C.hasCert = (c, name, today) => (c.certs || []).some(ce => ce.name.toLowerCase() === name.toLowerCase() && C.certState(ce, today).state !== 'expired');
  C.setCertRule = function (st, trade, cert) {
    const tr = txt(trade), ce = txt(cert); if (!tr || !ce) throw new Error(t('Pick a trade and a certification'));
    if (!st.certRules.some(r => r.trade === tr && r.cert.toLowerCase() === ce.toLowerCase())) st.certRules.push({ id: C.nid(st, 'cr'), trade: tr, cert: ce }); return st.certRules;
  };
  C.certMissing = (st, crewId, trade, today) => { const c = C.crewM(st, crewId); return !c || !trade ? [] : st.certRules.filter(r => r.trade === trade && !C.hasCert(c, r.cert, today)).map(r => r.cert); };
  C.certAlerts = function (st, today) {
    const out = [];
    st.crew.filter(c => c.active !== false).forEach(c => (c.certs || []).forEach(ce => { const s = C.certState(ce, today);
      if (s.state === 'expired') out.push({ level: 'amber', crew: c, cert: ce, text: t('{name}: {cert} expired {date}', { name: c.name, cert: tt(ce.name), date: C.fmtShort(ce.expires) }) });
      else if (s.state === 'soon') out.push({ level: 'info', crew: c, cert: ce, text: t('{name}: {cert} expires in {n} days', { name: c.name, cert: tt(ce.name), n: s.days }) }); }));
    C.allTasks(st).forEach(x => { const k = x.task; if (k.status === 'done' || !k.who || k.who.t !== 'crew' || !C.isDate(k.end) || k.end < today) return;
      C.certMissing(st, k.who.id, k.trade, today).forEach(name => out.push({ level: 'red', crew: C.crewM(st, k.who.id), text: t('{name} is on {job} {task} without a current {cert}', { name: (C.crewM(st, k.who.id) || {}).name, job: x.job.num, task: tt(k.name), cert: tt(name) }) })); });
    return out;
  };
  const baseCheck = C.assignCheck;
  C.assignCheck = function (st, task, who, today) {
    const r = baseCheck(st, task, who, today);
    if (who && who.t === 'crew') C.certMissing(st, who.id, task.trade, today).forEach(name => r.soft.push(t('No current {cert}, which you require for {trade}.', { cert: tt(name), trade: tt(task.trade) })));
    return r;
  };

  /* ---------- safety: site checklists and toolbox talks ---------- */
  C.SAFETY_ITEMS = [['ppe', N('Hard hats, eye and hearing protection in use')], ['locate', N('Utility locate requested before digging (811 in the US)')], ['trench', N('Trenches 5 ft or deeper have a protective system')],
    ['spoil', N('Spoil piles at least 2 ft back from the trench edge')], ['ladder', N('Ladders inspected, at the right angle and secured')], ['gfci', N('Cords and tools on GFCI protection')],
    ['fire', N('Fire extinguisher on site and charged')], ['firstaid', N('First aid kit stocked; nearest clinic known')], ['gas', N('Gas shut off and leak-tested before and after gas work')],
    ['hotwork', N('Hot work: area cleared and a fire watch kept')], ['confined', N('Confined spaces: air tested, permit and attendant')], ['house', N('Walkways clear, materials stacked, site clean')]];
  C.TALKS = [
    { key: 'trench', title: N('Trench and excavation safety'), points: [N('Never enter a trench 5 ft or deeper without shoring, sloping or a trench box.'), N('Keep spoil and equipment at least 2 ft from the edge.'), N('Keep a ladder within 25 ft of every worker in trenches 4 ft or deeper.'), N('Request a utility locate and wait for the marks before digging.')] },
    { key: 'ladder', title: N('Ladder safety'), points: [N('Inspect the ladder before each use; tag out damaged ones.'), N('Keep three points of contact.'), N('Extension ladders: 1 ft out for every 4 ft up, and 3 ft past the landing.'), N('Never stand on the top step or the top cap.')] },
    { key: 'heat', title: N('Heat illness prevention'), points: [N('Water, rest and shade: drink before you feel thirsty.'), N('New and returning workers need a few days to get used to the heat.'), N('Know the signs: dizziness, headache, confusion, no sweating.'), N('Heat stroke is an emergency: call 911 and cool the person down.')] },
    { key: 'gas', title: N('Gas leaks and gas line work'), points: [N('Shut off and lock out the gas before opening a line.'), N('Leak-test every joint after the work; never use a flame to find a leak.'), N('If you smell gas: no switches, no phones inside, get everyone out, call the gas company.'), N('Relight pilots and check every appliance before you leave.')] },
    { key: 'ppe', title: N('Personal protective equipment'), points: [N('Safety glasses for cutting, grinding, drilling and soldering.'), N('Hearing protection around saws, jackhammers and compressors.'), N('Gloves that fit the task: cut-resistant, chemical or welding.'), N('Replace damaged gear; it is free to ask.')] },
    { key: 'lift', title: N('Lifting and back safety'), points: [N('Size up the load; get help or a dolly for heavy or awkward items.'), N('Lift with your legs, keep the load close, do not twist.'), N('Water heaters and tubs are two-person lifts.'), N('Clear the path before you carry.')] },
    { key: 'silica', title: N('Silica dust when cutting concrete'), points: [N('Cut concrete and block wet, or use a vacuum shroud.'), N('Wear a respirator when dust cannot be controlled.'), N('Never dry sweep or blow dust with compressed air.'), N('Wash up before eating or smoking.')] },
    { key: 'lead', title: N('Lead and asbestos in older homes'), points: [N('Homes built before 1978 may have lead paint; use lead-safe work practices.'), N('Old pipe wrap, tape and some floor tiles may contain asbestos: stop and test before disturbing them.'), N('Contain dust and clean with a HEPA vacuum.'), N('Tell the office before you continue.')] },
    { key: 'tools', title: N('Hand and power tools'), points: [N('Check cords, guards and blades before use.'), N('Unplug or remove the battery before changing a blade or bit.'), N('Use the right tool for the job; no cheater bars on wrenches.'), N('Store tools so nobody trips on them.')] },
    { key: 'slips', title: N('Slips, trips and falls'), points: [N('Clean up water and debris right away.'), N('Cover or guard floor openings and open trenches.'), N('Run cords and hoses along walls, not across walkways.'), N('Use fall protection above 6 ft on open sides.')] }];
  C.talk = key => C.TALKS.find(x => x.key === key) || null;
  C.addTalk = function (st, o, today) {
    const tk = C.talk(o.topic), custom = txt(o.custom); if (!tk && !custom) throw new Error(t('Choose a topic'));
    const att = (o.attendees || []).filter((id, i, a) => C.crewM(st, id) && a.indexOf(id) === i); if (!att.length) throw new Error(t('Tick who attended'));
    const r = { id: did(st, 'sf'), kind: 'talk', topic: tk ? tk.key : '', custom: tk ? '' : custom, jobId: C.job(st, o.jobId) ? o.jobId : '', date: C.isDate(o.date) ? o.date : today, leader: txt(o.leader), attendees: att, notes: txt(o.notes), u: stamp() };
    st.safety.push(r); return r;
  };
  C.addSafetyCheck = function (st, o, today) {
    const j = C.job(st, o.jobId); if (!j) throw new Error(t('Choose the job site'));
    const items = {}; let marked = 0; C.SAFETY_ITEMS.forEach(x => { const v = (o.items || {})[x[0]]; items[x[0]] = v === 'ok' || v === 'fix' ? v : 'na'; if (items[x[0]] !== 'na') marked++; });
    if (!marked) throw new Error(t('Mark at least one item OK or needs fixing'));
    const r = { id: did(st, 'sf'), kind: 'check', jobId: j.id, date: C.isDate(o.date) ? o.date : today, by: txt(o.by), items, notes: txt(o.notes), fixed: {}, u: stamp() };
    st.safety.push(r); return r;
  };
  C.fixSafety = function (st, recId, key, today) { const r = st.safety.find(x => x.id === recId); if (!r || !r.items || r.items[key] !== 'fix') throw new Error(t('Nothing to fix there')); r.fixed[key] = today; r.u = stamp(); return r; };
  C.openFixes = st => { const out = []; st.safety.filter(r => r.kind === 'check').forEach(r => Object.keys(r.items).forEach(k => { if (r.items[k] === 'fix' && !r.fixed[k]) out.push({ rec: r, key: k, label: (C.SAFETY_ITEMS.find(x => x[0] === k) || [k, k])[1], job: C.job(st, r.jobId) }); })); return out; };
  C.safetySummary = function (st, today) {
    const talks = st.safety.filter(r => r.kind === 'talk').sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0), d30 = C.addDays(today, -30), last = talks[0] || null;
    const crew = st.crew.filter(c => c.active !== false).map(c => ({ crew: c, last: (talks.find(x => x.attendees.indexOf(c.id) >= 0) || {}).date || '' }));
    const checks = st.safety.filter(r => r.kind === 'check'), active = st.jobs.filter(j => ACTIVE.indexOf(j.stage) >= 0);
    return { last, since: last ? C.daysBetween(last.date, today) : null, talks30: talks.filter(x => x.date >= d30).length, talks, crew, missing: crew.filter(x => !x.last || x.last < d30),
      fixes: C.openFixes(st), unchecked: active.filter(j => !checks.some(r => r.jobId === j.id && r.date >= C.addDays(today, -7))) };
  };
  C.talkTitle = r => r.topic ? t(C.talk(r.topic).title) : tt(r.custom);
  C.talkDoc = function (st, recId, opts) {
    opts = Object.assign({ address: 'city' }, opts); const r = st.safety.find(x => x.id === recId && x.kind === 'talk'); if (!r) throw new Error(t('No such toolbox talk'));
    const tk = C.talk(r.topic), j = C.job(st, r.jobId), L = [];
    L.push(t('Date: {date}', { date: C.fmtDate(r.date) })); if (j) L.push(t('Job: {num}, {site}', { num: j.num, site: C.siteText(j, opts.address) })); if (r.leader) L.push(t('Led by: {name}', { name: r.leader }));
    L.push('', t('Key points').toUpperCase()); (tk ? tk.points : []).forEach((p, i) => L.push((i + 1) + '. ' + t(p))); if (r.notes) L.push('', tt(r.notes));
    L.push('', t('Attendance').toUpperCase()); r.attendees.forEach(id => L.push(((C.crewM(st, id) || {}).name || '?') + '   ' + t('Signature: ____________________')));
    L.push('', t('A general safety talk, not a substitute for OSHA rules, your written safety program or site-specific training.'));
    return { title: t('Toolbox talk: {topic}', { topic: C.talkTitle(r) }), lines: L, name: 'toolbox-talk-' + r.date + '.txt' };
  };

  /* ---------- customer-facing reports: job status and before/after photos ---------- */
  C.statusReport = function (st, jobId, opts, today) {
    opts = Object.assign({ address: 'full', customer: true, money: true, who: false }, opts);
    const j = C.job(st, jobId); if (!j) throw new Error(t('No such job'));
    const cu = C.customer(st, j.customerId), co = st.company, work = j.tasks.filter(k => k.kind !== 'inspection'), done = work.filter(k => k.status === 'done');
    const pct = work.length ? Math.round(100 * done.length / work.length) : (j.stage === 'done' || j.stage === 'paid' ? 100 : 0), L = [], H = s => L.push('', t(s).toUpperCase());
    L.push(C.fromLine(st)); if (opts.customer && cu) L.push(t('Prepared for {name}', { name: cu.name }));
    L.push(t('Job {num}: {title}', { num: j.num, title: tt(j.title) }), t('Site: {site}', { site: C.siteText(j, opts.address) }), t('As of {date}', { date: C.fmtDate(today) }), t('Status: {stage}', { stage: C.stageName(j.stage) }), t('Progress: {a} of {b} work steps done ({pct}%)', { a: done.length, b: work.length, pct }));
    const byStart = (a, b) => (a.start || '9') < (b.start || '9') ? -1 : 1;
    if (done.length) { H('Done'); done.slice().sort(byStart).forEach(k => L.push('- ' + tt(k.name) + (k.end ? ' (' + C.fmtShort(k.end) + ')' : ''))); }
    const next = j.tasks.filter(k => k.status !== 'done').sort(byStart);
    if (next.length) { H('Coming up'); next.forEach(k => L.push('- ' + (k.start ? C.fmtDate(k.start) + ': ' : t('Date to be set') + ': ') + tt(k.name) + (opts.who && k.who && k.who.t ? ' (' + C.whoName(st, k.who) + ')' : ''))); }
    if (j.permits.length) { H('Permits and inspections'); j.permits.forEach(p => L.push('- ' + tt(p.kind) + ': ' + t(C.PERMIT_STATES[C.permitState(p, today)]) + (p.inspDate ? ', ' + C.fmtDate(p.inspDate) : ''))); }
    if (j.changeOrders.length) { H('Change orders'); j.changeOrders.forEach(c => L.push('- ' + c.num + ' ' + tt(c.desc) + ' ' + C.fmt(c.amount) + ': ' + (c.status === 'approved' ? t('signed') : c.status === 'rejected' ? t('not approved') : t('waiting for your signature')))); }
    if (opts.money) {
      const k = C.jobCost(st, j), unpaid = j.invoices.filter(i => !i.paid), nextDue = unpaid.map(i => i.dueDate).sort()[0];
      H('Billing'); L.push(t('Contract with signed changes: {amt}', { amt: C.fmt(k.contract) }), t('Billed so far: {amt}', { amt: C.fmt(k.billed) }), t('Paid so far: {amt}', { amt: C.fmt(k.collected) }), t('Balance due now: {amt}', { amt: C.fmt(sum(unpaid, i => i.due)) }));
      if (nextDue) L.push(t('Next payment due: {date}', { date: C.fmtDate(nextDue) }));
    }
    const punch = j.punch.filter(p => !p.done).length; if (punch) { H('Punch list'); L.push(tn(punch, '{n} small item left to finish', '{n} small items left to finish')); }
    L.push('', co.phone ? t('Questions? Call {phone}.', { phone: co.phone }) : t('Questions? Call our office.'));
    return { title: t('Job status report {num}', { num: j.num }), lines: L, name: 'status-' + j.num + '.txt' };
  };
  C.PHOTO_STAGES = ['Before', 'During', 'After', 'Inspection'];
  C.photoReport = function (st, jobId, opts, today) {
    opts = Object.assign({ address: 'city', customer: false, captions: true, stages: { Before: true, During: false, After: true, Inspection: false }, punch: false }, opts);
    const j = C.job(st, jobId); if (!j) throw new Error(t('No such job')); const cu = C.customer(st, j.customerId);
    const groups = C.PHOTO_STAGES.filter(s => opts.stages[s]).map(s => ({ stage: s, label: t(s), photos: j.photos.filter(p => (p.stage || 'Before') === s).slice().sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1).map(p => ({ id: p.id, caption: opts.captions ? tt(p.caption || '') : '', date: p.date })) })).filter(g => g.photos.length);
    if (opts.punch) { const ph = j.punch.filter(p => p.photoId).map(p => ({ id: p.photoId, caption: opts.captions ? tt(p.text) + (p.done ? ' (' + t('done') + ')' : '') : '', date: '' })); if (ph.length) groups.push({ stage: 'punch', label: t('Punch list'), photos: ph }); }
    const count = sum(groups, g => g.photos.length), lines = [t('Job {num}: {title}', { num: j.num, title: tt(j.title) }), t('Site: {site}', { site: C.siteText(j, opts.address) })];
    if (opts.customer && cu) lines.push(t('Prepared for {name}', { name: cu.name }));
    lines.push(t('As of {date}', { date: C.fmtDate(today) }), tn(count, '{n} photo', '{n} photos'));
    return { title: t('Photo report {num}', { num: j.num }), lines, groups, count };
  };

  /* ---------- permit tracker by jurisdiction ---------- */
  C.PERMIT_STATES = { draft: N('Not applied'), applied: N('Waiting for the permit'), issued: N('Issued'), scheduled: N('Inspection set'), passed: N('Passed'), failed: N('Failed, re-inspect'), expired: N('Expired') };
  C.permitState = function (p, today) {
    if (p.result === 'passed') return 'passed'; if (p.result === 'failed') return 'failed'; if (C.isDate(p.expires) && p.expires < today) return 'expired';
    if (C.isDate(p.inspDate)) return 'scheduled'; if (C.isDate(p.issued)) return 'issued'; if (C.isDate(p.applied)) return 'applied'; return 'draft';
  };
  C.setJurisdiction = function (st, o) {
    const name = txt(o.name); if (!name) throw new Error(t('Name the jurisdiction, for example the city or county'));
    const days = o.typicalDays === '' || o.typicalDays == null ? 0 : parseInt(o.typicalDays, 10); if (isNaN(days) || days < 0 || days > 365) throw new Error(t('Typical days must be from 0 to 365'));
    let jr = st.jurisdictions.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!jr) { jr = { id: C.nid(st, 'jr'), name }; st.jurisdictions.push(jr); }
    Object.assign(jr, { phone: txt(o.phone), notes: txt(o.notes), typicalDays: days, validDays: parseInt(o.validDays, 10) > 0 ? parseInt(o.validDays, 10) : 0 }); return jr;
  };
  C.permitBoard = function (st, today) {
    const groups = {};
    st.jobs.forEach(j => j.permits.forEach(p => { const k = txt(p.jurisdiction), g = groups[k.toLowerCase()] || (groups[k.toLowerCase()] = { name: k, rows: [], issue: [], passed: 0, failed: 0 }); const s = C.permitState(p, today);
      g.rows.push({ job: j, p, state: s, wait: s === 'applied' ? C.daysBetween(p.applied, today) : null, expDays: C.isDate(p.expires) ? C.daysBetween(today, p.expires) : null });
      if (C.isDate(p.applied) && C.isDate(p.issued) && p.issued >= p.applied) g.issue.push(C.daysBetween(p.applied, p.issued)); if (p.result === 'passed') g.passed++; if (p.result === 'failed') g.failed++; }));
    return Object.keys(groups).map(k => { const g = groups[k], info = st.jurisdictions.find(x => x.name.toLowerCase() === k) || null;
      return { name: g.name, info, rows: g.rows, open: g.rows.filter(r => r.state !== 'passed').length, avgIssue: avg(g.issue), passBps: g.passed + g.failed ? C.roundDiv(g.passed * 10000, g.passed + g.failed) : null }; })
      .sort((a, b) => !a.name ? 1 : !b.name ? -1 : a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1);
  };
  C.permitAlerts = function (st, today) {
    const out = [];
    C.permitBoard(st, today).forEach(g => { const usual = (g.info && g.info.typicalDays) || g.avgIssue || 14;
      g.rows.forEach(r => { const p = r.p, where = g.name || t('no jurisdiction set'), x = { job: r.job.num, kind: tt(p.kind), where };
        if (r.state === 'failed') out.push({ level: 'amber', text: t('{job} {kind} permit failed inspection: book the re-inspection', x) });
        else if (r.state === 'expired') out.push({ level: 'red', text: t('{job} {kind} permit expired {date}', Object.assign({ date: C.fmtShort(p.expires) }, x)) });
        else if (r.state !== 'passed' && r.expDays != null && r.expDays <= 30) out.push({ level: 'amber', text: tn(r.expDays, '{job} {kind} permit expires in {n} day', '{job} {kind} permit expires in {n} days', x) });
        else if (r.state === 'applied' && r.wait > usual) out.push({ level: 'info', text: tn(r.wait, '{job} {kind} permit has waited {n} day at {where}', '{job} {kind} permit has waited {n} days at {where}', x) }); }); });
    return out;
  };
  C.permitsCSV = (st, today) => csvSafe([[t('Jurisdiction'), t('Job'), t('Permit'), t('Number'), t('Applied'), t('Issued'), t('Inspection'), t('Status'), t('Expires')]].concat(
    [].concat(...C.permitBoard(st, today).map(g => g.rows.map(r => [g.name, r.job.num, tt(r.p.kind), r.p.number, r.p.applied, r.p.issued, r.p.inspDate, t(C.PERMIT_STATES[r.state]), r.p.expires || ''])))));

  /* ---------- quote-to-cash pipeline and the Stark Ledger export ---------- */
  C.pipeline = function (st, from, to) {
    const ests = st.estimates.filter(e => e.status !== 'draft' && inRange(e.date, from, to)), val = e => C.estimateTotals(e).total;
    const won = ests.filter(e => e.status === 'accepted'), lost = ests.filter(e => e.status === 'declined'), open = st.estimates.filter(e => e.status === 'sent');
    const invs = []; st.jobs.forEach(j => j.invoices.forEach(i => invs.push({ j, i })));
    const bills = []; st.plans.forEach(p => p.bills.concat(...p.history.map(h => h.bills)).forEach(b => bills.push(b)));
    const billed = invs.filter(x => inRange(x.i.date, from, to)), paid = invs.filter(x => x.i.paid && inRange(x.i.paidDate, from, to));
    const wonJobs = won.map(e => ({ e, j: C.job(st, e.jobId) })).filter(x => x.j);
    return {
      quoted: { n: ests.length, value: sum(ests, val) }, won: { n: won.length, value: sum(won, val) }, lost: { n: lost.length, value: sum(lost, val) }, open: { n: open.length, value: sum(open, val) },
      winBps: won.length + lost.length ? C.roundDiv(won.length * 10000, won.length + lost.length) : null,
      billed: sum(billed, x => x.i.due) + sum(bills.filter(b => inRange(b.date, from, to)), b => b.amount),
      collected: sum(paid, x => x.i.due) + sum(bills.filter(b => b.paid && inRange(b.paidDate, from, to)), b => b.amount),
      outstanding: sum(invs.filter(x => !x.i.paid), x => x.i.due) + sum(bills.filter(b => !b.paid), b => b.amount),
      daysToJob: avg(wonJobs.map(x => Math.max(0, C.daysBetween(x.e.date, x.j.created)))), daysToPay: avg(paid.map(x => Math.max(0, C.daysBetween(x.i.date, x.i.paidDate)))),
      stages: C.STAGES.map(s => { const js = st.jobs.filter(j => j.stage === s[0]); return { key: s[0], label: s[1], n: js.length, value: sum(js, j => C.contractTotal(j)) }; })
    };
  };
  /* bank-statement shape (Date, Description, Amount; money in is positive). Stark Ledger and most bookkeeping tools import it. */
  C.ledgerCSV = function (st, from, to, opts) {
    opts = Object.assign({ customer: false }, opts); const rows = [], inR = d => inRange(d, from, to);
    st.jobs.forEach(j => { const cu = C.customer(st, j.customerId); j.invoices.forEach(i => { if (i.paid && inR(i.paidDate)) rows.push([i.paidDate, t('Customer payment {num}, job {job}', { num: i.num, job: j.num }) + (opts.customer && cu ? ', ' + cu.name : ''), i.due]); }); });
    st.plans.forEach(p => { const cu = C.customer(st, p.customerId); p.bills.concat(...p.history.map(h => h.bills)).forEach(b => { if (b.paid && inR(b.paidDate)) rows.push([b.paidDate, t('Service agreement payment {num}, {plan}', { num: b.num, plan: p.num }) + (opts.customer && cu ? ', ' + cu.name : ''), b.amount]); }); });
    st.subPays.forEach(p => { if (p.status === 'paid' && inR(p.paidDate)) rows.push([p.paidDate, t('Sub payment #{n} to {sub}, job {job}', { n: p.n, sub: (C.sub(st, p.subId) || {}).name || '?', job: (C.job(st, p.jobId) || {}).num || '?' }), -p.due]); });
    st.pos.forEach(po => { if (po.paid && inR(po.paidDate)) rows.push([po.paidDate, t('Supplier {sup}, {num}', { sup: po.supplier, num: po.num }), -C.poTotals(po).total]); });
    rows.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    return csvSafe([['Date', 'Description', 'Amount']].concat(rows.map(r => [r[0], r[1], money(r[2])])));
  };
  /* the invoice list in the same columns as Stark Ledger's invoice export, for an accountant */
  C.invoiceListCSV = function (st, from, to, opts) {
    opts = Object.assign({ customer: false, today: to }, opts); const rows = [], inR = d => inRange(d, from, to);
    const add = (num, date, due, who, paid, amt) => rows.push([num, date, due, who, paid ? 'paid' : due < opts.today ? 'overdue' : 'sent', money(amt), '0.00', money(amt), money(paid ? amt : 0), money(paid ? 0 : amt)]);
    st.jobs.forEach(j => { const cu = C.customer(st, j.customerId); j.invoices.forEach(i => { if (inR(i.date)) add(i.num, i.date, i.dueDate, opts.customer && cu ? cu.name : j.num, i.paid, i.due); }); });
    st.plans.forEach(p => { const cu = C.customer(st, p.customerId); p.bills.forEach(b => { if (inR(b.date)) add(b.num, b.date, b.dueDate, opts.customer && cu ? cu.name : p.num, b.paid, b.amount); }); });
    rows.sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
    return csvSafe([['Number', 'Date', 'Due', 'Client', 'Status', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance']].concat(rows));
  };

  /* ---------- quick search (accents and case ignored; every word must match) ---------- */
  const MARKS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g'); // combining accents
  const fold = s => String(s == null ? '' : s).normalize('NFD').replace(MARKS, '').toLowerCase();
  C.fold = fold;
  C.KINDS = { job: N('Job'), customer: N('Customer'), sub: N('Sub'), crew: N('Crew'), estimate: N('Estimate'), bid: N('Bid'), plan: N('Service plan'), po: N('Purchase order'), stock: N('Part'), permit: N('Permit'), page: N('Page'), action: N('Action') };
  C.search = function (st, q, limit) {
    const words = fold(q).split(/\s+/).filter(Boolean); if (!words.length) return [];
    const out = [], add = (kind, label, sub, href, hay) => { const all = fold(label + ' ' + (sub || '') + ' ' + (hay || '')); if (!words.every(w => all.indexOf(w) >= 0)) return;
      const lb = fold(label); out.push({ kind, label, sub: sub || '', href, score: lb.indexOf(words[0]) === 0 ? 0 : lb.split(/[\s,.:(-]+/).some(x => x.indexOf(words[0]) === 0) ? 1 : lb.indexOf(words[0]) >= 0 ? 2 : 3 }); };
    st.jobs.forEach(j => { const cu = C.customer(st, j.customerId); add('job', j.num + ' ' + tt(j.title), [cu && cu.name, j.city, C.stageName(j.stage)].filter(Boolean).join(' · '), '#/job/' + j.id, j.title + ' ' + j.street); });
    st.customers.forEach(c => add('customer', c.name, c.phone || '', '#/customer/' + c.id, c.email));
    st.subs.forEach(s => add('sub', s.name, (s.trades || []).map(tt).join(', '), '#/sub/' + s.id, (s.trades || []).join(' ') + ' ' + (s.contact || '') + ' ' + (s.area || '')));
    st.crew.forEach(c => add('crew', c.name, tt(c.role || ''), '#/team', (c.skills || []).join(' ')));
    st.estimates.forEach(e => add('estimate', e.num + ' ' + tt(e.title), (C.customer(st, e.customerId) || {}).name || '', '#/estimate/' + e.id, e.title));
    st.bids.forEach(b => add('bid', tt(b.title), (C.job(st, b.jobId) || {}).num || '', '#/bid/' + b.id, b.title));
    st.plans.forEach(p => add('plan', p.num + ' ' + tt(p.title), (C.customer(st, p.customerId) || {}).name || '', '#/service', p.title));
    st.pos.forEach(p => add('po', p.num + ' ' + p.supplier, t(C.PO_STATES[p.status]), '#/stock/orders', ''));
    st.stock.forEach(i => add('stock', tt(i.name), i.sku, '#/stock', i.name + ' ' + i.supplier));
    st.jobs.forEach(j => j.permits.forEach(p => add('permit', tt(p.kind) + ' ' + (p.number || ''), j.num + (p.jurisdiction ? ' · ' + p.jurisdiction : ''), '#/permits', p.kind)));
    return out.sort((a, b) => a.score - b.score || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)).slice(0, limit || 30);
  };

  /* ---------- Today alerts and the office/field handoff learn about the new records ---------- */
  const baseAlerts = C.alerts;
  C.alerts = function (st, today) {
    const out = baseAlerts(st, today), add = (level, text, link, tag) => out.push({ level, text, link, tag: tag || '' });
    st.plans.forEach(p => { if (p.status === 'cancelled') return; const s = C.planStatus(st, p, today), cu = C.customer(st, p.customerId), x = { num: p.num, name: cu ? cu.name : '?', date: C.fmtShort(C.addDays(s.end, -1)), amt: s.nextBill ? C.fmt(s.nextBill.amount) : '' };
      if (s.state === 'renew') add('info', t('{num} for {name} ends {date}: offer the renewal', x), '#/service', t('Renewal'));
      else if (s.state === 'ended' && s.daysLeft > -30) add('amber', t('{num} for {name} has ended and was not renewed', x), '#/service', t('Renewal'));
      if (s.billDue) add('info', t('{num}: the next bill ({amt}) is ready to send', x), '#/service', t('Plan bill')); });
    const due = C.recurringDue(st, today, 7); if (due.length) add('info', tn(due.length, '{n} recurring visit is due within a week: create the job', '{n} recurring visits are due within a week: create the jobs'), '#/service/recurring', t('Recurring'));
    const low = C.lowStock(st); if (low.length) add('info', tn(low.length, '{n} part is below par in the shop or a van', '{n} parts are below par in the shop or vans'), '#/stock', t('Stock'));
    C.poLate(st, today).forEach(po => add('amber', t('{num} from {sup} was needed by {date} and has not arrived', { num: po.num, sup: po.supplier, date: C.fmtShort(po.needBy) }), '#/stock/orders', t('Purchase order')));
    C.certAlerts(st, today).forEach(a => add(a.level, a.text, '#/team/certs', t('Certification')));
    const ss = C.safetySummary(st, today);
    ss.fixes.forEach(f => add('amber', t('Safety fix open on {job}: {item}', { job: f.job ? f.job.num : '?', item: t(f.label) }), '#/safety', t('Safety')));
    if (st.crew.some(c => c.active !== false) && st.jobs.some(j => ACTIVE.indexOf(j.stage) >= 0) && (ss.since == null || ss.since >= (st.company.talkDays || 7)))
      add('info', ss.since == null ? t('No toolbox talk recorded yet') : tn(ss.since, 'Last toolbox talk was {n} day ago', 'Last toolbox talk was {n} days ago'), '#/safety', t('Safety'));
    C.permitAlerts(st, today).forEach(a => add(a.level, a.text, '#/permits', t('Permit')));
    C.timesheetsToApprove(st, today).forEach(x => add('info', t('Approve the timesheet for {name}, week of {date}', { name: x.crew.name, date: C.fmtShort(x.ts.week) }), '#/team', t('Timesheet')));
    const rank = { red: 0, amber: 1, info: 2 }; return out.sort((a, b) => rank[a.level] - rank[b.level]);
  };
  const baseMake = C.makeHandoff, baseMerge = C.mergeHandoff;
  C.makeHandoff = function (st, opts, today) { const pk = baseMake(st, opts, today); pk.safety = st.safety.filter(r => r.date >= C.addDays(today, -60)).map(r => JSON.parse(JSON.stringify(r))); return pk; };
  C.mergeHandoff = function (st, pk, today) {
    const n = baseMerge(st, pk, today);
    C.mergeById(st.safety, (Array.isArray(pk.safety) ? pk.safety : []).filter(r => r && typeof r.id === 'string' && (r.kind === 'talk' || r.kind === 'check')), n);
    return n;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof globalThis !== 'undefined' ? globalThis : this);
