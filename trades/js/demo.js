/* Stark Trades 2.1. A clearly fictional demo company so the first screen looks real.
   Every name, address and number is invented and marked "(demo)". Dates are relative to today. Text is stored in English
   and shown in the reader's language (each label has a Spanish translation in js/es.js). */
(function (root) {
  'use strict';
  /* 2.1: service agreements, recurring visits, van stock, purchase orders, timesheets, certifications, safety, permits by jurisdiction */
  function pro(C, st, T, J) {
    const N = C.N, D = n => C.addDays(T, n), M = (d, n) => C.addMonths(d, n), crew = id => ({ t: 'crew', id }), wk = C.weekOf(T);
    st.company.stockLocs = ['Shop', 'Van 1', 'Van 2'];
    const cert = (cid, name, exp, num) => C.addCert(st, cid, { name, expires: exp, number: num || '', issuer: '' });
    cert('c1', 'OSHA 30', D(420), 'DEMO-O30-1'); cert('c1', 'Journeyman license', D(610), 'DEMO-JP-778'); cert('c1', 'Backflow tester', D(11), 'DEMO-BF-12');
    cert('c2', 'OSHA 10', ''); cert('c2', 'First aid and CPR', D(-6)); cert('c3', 'OSHA 10', '');
    C.setCertRule(st, 'Gas line', 'Journeyman license');
    st.estimates.filter(e => e.status === 'draft').forEach(e => { e.status = 'sent'; }); // an open quote for the pipeline
    /* service agreements: one up for renewal, a quarterly plan with history, a new monthly plan */
    const visit = (r, day, done, hours) => { const j = C.spawnRecurring(st, r.id, day); if (done) { j.stage = 'paid'; j.tasks.forEach(k => { k.status = 'done'; k.hours = hours; k.who = crew('c2'); }); } return j; };
    const s1 = C.addDays(M(T, -12), 20);
    const p1 = C.addPlan(st, { customerId: 'u1', title: N('Yearly water heater service'), street: '7 Fictional Rd', city: 'Sampleton', trade: 'Water heater', start: s1, firstVisit: C.addDays(s1, 7), price: 18900, billEvery: 'year', visits: 1, visitHours: 150, covers: N('Flush the tank, test the relief valve, check anode, venting and gas connections'), discountBps: 1000 }, s1);
    visit(st.recurring.find(r => r.id === p1.recurringId), C.addDays(s1, 7), true, 150); const b1 = C.billPlan(st, p1.id, s1, s1); C.payPlanBill(st, p1.id, b1.id, C.addDays(s1, 6));
    const p2 = C.addPlan(st, { customerId: 'u4', title: N('Quarterly drain care, both units'), street: '300 Placeholder Ave', city: 'Sampleton', trade: 'Drain and sewer', start: D(-100), price: 96000, billEvery: 'quarter', visits: 4, visitHours: 200, covers: N('Jet the main line, camera check, clean traps, test the sump pump'), discountBps: 1000, who: crew('c1') }, D(-100));
    const r2 = st.recurring.find(r => r.id === p2.recurringId); visit(r2, r2.next, true, 200); visit(r2, r2.next, true, 220);
    const b2 = C.billPlan(st, p2.id, D(-100), D(-100)); C.payPlanBill(st, p2.id, b2.id, D(-92)); C.billPlan(st, p2.id, C.addMonths(D(-100), 3), C.addMonths(D(-100), 3));
    C.addPlan(st, { customerId: 'u6', title: N('Monthly backflow and fixture check'), street: '20 Mock Plaza', city: 'Mocktown', trade: 'Service and repair', start: D(-20), firstVisit: D(4), price: 114000, billEvery: 'month', visits: 12, visitHours: 100, covers: N('Backflow test record, check flush valves and faucets, look for leaks'), discountBps: 1500, who: crew('c3') }, D(-20));
    C.addRecurring(st, { customerId: 'u3', title: N('Sewer line camera check'), street: '48 Example Ct', city: 'Exampleville', trade: 'Drain and sewer', every: 6, unit: 'month', first: D(26), base: 22500, hours: 150, who: crew('c2') });
    /* van stock */
    const sup1 = 'Sample Supply House (demo)', sup2 = 'Example Plumbing Wholesale (demo)', q = n => Math.round(n * 1000);
    const part = (name, unit, cost, supplier, have, par, sku) => { const it = C.addStockItem(st, { name, unit, cost, supplier, sku, par: { Shop: q(par[0]), 'Van 1': q(par[1]), 'Van 2': q(par[2]) } }); ['Shop', 'Van 1', 'Van 2'].forEach((l, i) => { if (have[i]) it.qty[l] = q(have[i]); }); return it; };
    part(N('1/2 in PEX-A pipe'), N('ft'), 45, sup2, [500, 80, 120], [300, 100, 100], 'PEX-050');
    const cpl = part(N('1/2 in PEX coupling'), N('each'), 120, sup2, [60, 25, 6], [40, 20, 20], 'PXC-050');
    part(N('3/4 in ball valve'), N('each'), 1450, sup1, [12, 3, 4], [10, 4, 4], 'BV-075');
    const wax = part(N('Wax ring with bolts'), N('each'), 650, sup1, [18, 6, 5], [12, 6, 6], 'WR-STD');
    const flex = part(N('Water heater flex connector, 18 in'), N('each'), 1100, sup1, [4, 2, 2], [10, 2, 2], 'WHC-18');
    part(N('Thermal expansion tank, 2 gal'), N('each'), 4200, sup1, [3, 1, 0], [2, 1, 0], 'ET-2');
    part(N('Thread seal tape'), N('roll'), 99, sup1, [40, 6, 6], [24, 6, 6], 'TST');
    C.moveStock(st, { itemId: cpl.id, kind: 'use', from: 'Van 1', jobId: J.j4.id, qty: q(4), date: D(-1) }, D(-1));
    /* purchase orders: one received and paid for the shop, one late for the repipe job */
    const po1 = C.newPO(st, { supplier: sup1, loc: 'Shop', date: D(-16), needBy: D(-12), lines: [{ stockId: flex.id, qty: q(2) }, { stockId: wax.id, qty: q(6) }] }, D(-16));
    C.sendPO(st, po1.id, D(-16)); C.receivePO(st, po1.id, { [po1.lines[0].id]: q(2), [po1.lines[1].id]: q(6) }, D(-12), D(-12)); C.payPO(st, po1.id, D(-5));
    const po2 = C.newPO(st, { supplier: sup2, jobId: J.j7.id, date: D(-4), needBy: D(-1), lines: [{ name: N('3/4 in PEX-A, 100 ft coil'), unit: N('coil'), qty: q(2), cost: 18500 }, { name: N('1/2 in PEX-A, 300 ft coil'), unit: N('coil'), qty: q(1), cost: 21900 }, { name: N('PEX manifold, 12 port'), unit: N('each'), qty: q(1), cost: 14800 }], notes: N('Deliver to the site before 8 am; call the office on arrival.') }, D(-4));
    C.sendPO(st, po2.id, D(-4));
    /* last week's hours: one person over 40, one approved */
    const jobs = [J.j4, J.j5, J.j6, J.j4, J.j4];
    [['c1', '07:00', '16:30'], ['c2', '07:30', '16:00'], ['c3', '08:00', '14:30']].forEach(x => [0, 1, 2, 3, 4].forEach(i => st.timeLog.push({ id: C.nid(st, 'tl'), crewId: x[0], jobId: jobs[i].id, date: C.addDays(wk, i - 7), clockIn: x[1], clockOut: x[2], u: 1 })));
    C.approveTimesheet(st, 'c2', C.addDays(wk, -7), 'Example Plumbing Co. (demo)', D(-2));
    /* safety */
    C.addTalk(st, { topic: 'heat', date: D(-40), leader: 'Pat Placeholder', attendees: ['c1', 'c2', 'c3'] }, D(-40));
    C.addTalk(st, { topic: 'trench', jobId: J.j5.id, date: D(-8), leader: 'Pat Placeholder', attendees: ['c1', 'c2'], notes: N('Trench box on site for the sewer repair.') }, D(-8));
    C.addSafetyCheck(st, { jobId: J.j4.id, date: D(-1), by: 'Pat Placeholder', items: { ppe: 'ok', ladder: 'ok', gfci: 'fix', fire: 'ok', firstaid: 'ok', gas: 'ok', house: 'ok' }, notes: N('Replace the cracked cord on the hall bath saw.') }, D(-1));
    /* permits by jurisdiction */
    C.setJurisdiction(st, { name: 'Sampleton (demo)', phone: '555-0300', typicalDays: 5, validDays: 180, notes: N('Inspection requests by 3 pm the day before.') });
    C.setJurisdiction(st, { name: 'Exampleville (demo)', phone: '555-0310', typicalDays: 3, validDays: 180, notes: '' });
    J.j4.permits.forEach(p => { p.jurisdiction = 'Sampleton (demo)'; p.expires = C.addDays(p.issued, 180); });
    J.j1.permits.push({ id: C.nid(st, 'pm'), kind: N('Plumbing'), number: 'DEMO-BP-23980', applied: D(-126), issued: D(-122), inspDate: D(-104), result: 'passed', notes: '', jurisdiction: 'Sampleton (demo)', expires: '' });
    J.j2.permits.push({ id: C.nid(st, 'pm'), kind: N('Sewer'), number: 'DEMO-SW-1140', applied: D(-95), issued: D(-93), inspDate: D(-85), result: 'passed', notes: '', jurisdiction: 'Exampleville (demo)', expires: '' });
    J.j6.permits.push({ id: C.nid(st, 'pm'), kind: N('Water heater'), number: 'DEMO-WH-5521', applied: D(-14), issued: D(-12), inspDate: C.addWorkdays(D(1), 1), result: '', notes: '', jurisdiction: 'Exampleville (demo)', expires: D(168) });
    J.j7.permits.push({ id: C.nid(st, 'pm'), kind: N('Repipe'), number: '', applied: D(-11), issued: '', inspDate: '', result: '', notes: N('Plans submitted at the counter.'), jurisdiction: 'Sampleton (demo)', expires: '' });
  }
  function demoState(C, T) {
    const N = C.N, st = C.newState('plumbing'), D = n => C.addDays(T, n), M = (d, n) => C.addMonths(d, n);
    st.demo = true; st.device = { id: C.randomId(), role: 'office', lastHandoff: '' };
    Object.assign(st.company, { name: 'Example Plumbing Co. (demo)', phone: '555-0100', email: 'office@example.invalid', street: '1 Sample Way', city: 'Sampleton', state: 'XX', license: 'DEMO-MP-0001' });
    st.crew = [
      { id: 'c1', name: 'Pat Placeholder', role: N('Lead plumber'), skills: ['Underground', 'Rough-in', 'Repipe', 'Gas line', 'Service and repair'], cost: 4800, active: true },
      { id: 'c2', name: 'Sam Sample', role: N('Journeyman'), skills: ['Fixtures and finish', 'Water heater', 'Drain and sewer', 'Service and repair'], cost: 3900, active: true },
      { id: 'c3', name: 'Casey Example', role: N('Apprentice'), skills: ['Fixtures and finish', 'Service and repair', 'Water heater'], cost: 2600, active: true }];
    const S = (id, name, o) => Object.assign({ id, name, contact: '', phone: '', email: '', trades: [], specialty: '', licNo: '', licState: 'XX', licExp: '', glExp: '', glLimit: 100000000, wcExp: '', wcExempt: false, w9: true, entity: 'LLC', rate: '', area: 'Sampleton, Exampleville', crews: 1, notes: '', active: true, bench: '', dnuReason: '', onboard: {} }, o);
    const ob = (keys, date) => { const o = {}; keys.forEach(k => { o[k] = date; }); return o; };
    const ALL = ['license', 'coi', 'addl', 'wos', 'wc', 'w9', 'msa', 'emergency', 'refs'];
    st.subs = [
      S('s1', 'Pretend Repipe Partners (demo)', { contact: 'Robin Demo', phone: '555-0111', trades: ['Repipe', 'Rough-in', 'Underground'], specialty: N('PEX and copper repipes, occupied homes'), licNo: 'DEMO-PL-1001', licExp: D(410), glExp: D(205), wcExp: D(205), rate: N('$85/h or fixed bid'), crews: 2, notes: N('Shows up early. Cleans up well.'), bench: 'preferred', onboard: ob(ALL, D(-300)) }),
      S('s2', 'Sample Trench & Sewer (demo)', { contact: 'Lee Fictional', phone: '555-0122', trades: ['Drain and sewer', 'Excavation', 'Underground'], specialty: N('Sewer laterals, spot repairs, trenching'), licNo: 'DEMO-PL-2002', licExp: D(300), glExp: D(5), wcExp: D(90), entity: 'Corporation', rate: N('Fixed bid'), area: 'Sampleton, Exampleville, Mocktown', notes: N('Owns a mini excavator. Ask for the new GL certificate.'), bench: 'backup', onboard: ob(ALL.filter(k => k !== 'refs'), D(-200)) }),
      S('s3', 'Fictional Gas Line Co. (demo)', { contact: 'Jess Notreal', phone: '555-0133', trades: ['Gas line'], specialty: N('Black iron and CSST gas runs'), licNo: 'DEMO-GF-3003', licExp: D(12), glExp: D(150), wcExempt: true, entity: 'Individual / sole proprietor', rate: '$95/h', area: 'Sampleton', bench: 'backup', onboard: ob(['license', 'coi', 'addl', 'wos', 'wc', 'w9', 'msa'], D(-150)) }),
      S('s4', 'Placeholder Heater Pros (demo)', { contact: 'Quinn Mock', phone: '555-0144', trades: ['Water heater', 'Repipe'], specialty: N('Tankless installs and descaling'), licNo: 'DEMO-PL-4004', licExp: D(500), glExp: D(25), wcExp: D(-4), w9: false, rate: '$80/h', area: 'Exampleville, Mocktown', onboard: ob(['license', 'coi', 'wc'], D(-20)) }),
      S('s5', 'Budget Pipe Demo Co. (demo)', { contact: 'Alex Madeup', phone: '555-0155', trades: ['Repipe', 'Rough-in'], specialty: N('Low bids'), licNo: 'DEMO-PL-5005', licExp: D(-12), glExp: D(60), wcExp: '', rate: N('Fixed bid'), notes: N('License lapsed. Do not use until renewed.'), bench: 'dnu', dnuReason: N('License lapsed twice; left a trench open overnight'), onboard: ob(['license', 'w9'], D(-400)) }),
      S('s6', 'Mock Fixture Finishers (demo)', { contact: 'Drew Invented', phone: '555-0166', trades: ['Fixtures and finish'], specialty: N('Trim-out, high-end fixtures'), licNo: 'DEMO-PL-6006', licExp: D(640), glExp: D(320), glLimit: 200000000, wcExp: D(320), rate: '$75/h', bench: 'preferred', onboard: ob(ALL, D(-250)) })];
    st.customers = [
      { id: 'u1', name: 'Avery Example (demo)', phone: '555-0201', email: '', notes: N('Prefers texts. Dog in back yard.') },
      { id: 'u2', name: 'Jordan Sample (demo)', phone: '555-0202', email: '', notes: '' },
      { id: 'u3', name: 'Morgan Placeholder (demo)', phone: '555-0203', email: '', notes: N('Gate code given by phone only.') },
      { id: 'u4', name: 'Example Property Group (demo)', phone: '555-0204', email: 'units@example.invalid', notes: N('Rental duplex. Tenant notice 48 h.') },
      { id: 'u5', name: 'Riley Sample (demo)', phone: '555-0205', email: '', notes: '' },
      { id: 'u6', name: 'Mocktown Dental Office (demo)', phone: '555-0206', email: '', notes: N('Work after 5 pm only.') }];
    const wd = st.company.workDays, W = (s, n) => C.addWorkdays(s, n, wd), job = (o, today) => C.newJob(st, o, today || T);
    const task = (j, o, who) => { const k = C.newTask(st, o); if (who) k.who = who; if (o.cost) k.cost = o.cost; if (o.status) k.status = o.status; if (o.booked) k.booked = o.booked; j.tasks.push(k); return k; };
    const sub = id => ({ t: 'sub', id }), crew = id => ({ t: 'crew', id });
    const rate = (subId, jobId, date, onTime, q, c, p, cb, note) => st.ratings.push({ id: C.nid(st, 'r'), subId, jobId, taskId: '', date, onTime, quality: q, cleanup: c, paperwork: p, callback: cb, note: note || '' });

    /* finished jobs */
    const j1 = job({ customerId: 'u2', title: N('Bathroom rough-in, new addition'), street: '12 Demo Lane', city: 'Sampleton', stage: 'paid', base: 1840000, materials: 310000 }, D(-120));
    task(j1, { name: N('Rough-in'), trade: 'Rough-in', start: D(-118), end: D(-114), cost: 620000, bill: 860000, status: 'done' }, sub('s1'));
    task(j1, { name: N('Gas line'), trade: 'Gas line', start: D(-113), end: D(-113), cost: 185000, bill: 260000, status: 'done' }, sub('s3'));
    task(j1, { name: N('Fixtures and finish'), trade: 'Fixtures and finish', start: D(-105), end: D(-103), hours: 2200, bill: 410000, status: 'done' }, crew('c2'));
    const j2 = job({ customerId: 'u3', title: N('Sewer lateral replacement, 40 ft'), street: '48 Example Ct', city: 'Exampleville', stage: 'paid', base: 1520000, materials: 160000 }, D(-90));
    task(j2, { name: N('Drain and sewer'), trade: 'Drain and sewer', start: D(-88), end: D(-85), cost: 940000, bill: 1290000, status: 'done' }, sub('s2'));
    const j3 = job({ customerId: 'u4', title: N('Duplex repipe, both units'), street: '300 Placeholder Ave', city: 'Sampleton', stage: 'done', base: 2460000, materials: 420000, retainBps: 500 }, D(-40));
    task(j3, { name: N('Repipe unit A'), trade: 'Repipe', start: D(-35), end: D(-31), cost: 640000, bill: 980000, status: 'done' }, sub('s1'));
    task(j3, { name: N('Repipe unit B'), trade: 'Repipe', start: D(-30), end: D(-26), cost: 640000, bill: 980000, status: 'done' }, sub('s1'));
    task(j3, { name: N('Water heater flush and expansion tank'), trade: 'Water heater', start: D(-25), end: D(-25), cost: 45000, bill: 80000, status: 'done' }, sub('s4'));

    /* ratings: a track record with real trends */
    [[-400, 1, 5, 5, 5, 0], [-330, 1, 4, 5, 4, 0], [-260, 1, 5, 4, 5, 0], [-118, 1, 5, 5, 5, 0], [-33, 1, 5, 5, 4, 0], [-28, 1, 4, 4, 5, 1]].forEach(r => rate('s1', r[0] > -120 ? (r[0] > -40 ? j3.id : j1.id) : '', D(r[0]), !!r[1], r[2], r[3], r[4], !!r[5], r[0] === -28 ? N('Small leak at one fitting, fixed same day') : ''));
    [[-380, 1, 5, 4, 4, 0], [-300, 1, 4, 4, 4, 0], [-210, 1, 4, 3, 4, 0], [-150, 0, 3, 2, 3, 0], [-86, 0, 4, 2, 3, 0]].forEach(r => rate('s2', r[0] === -86 ? j2.id : '', D(r[0]), !!r[1], r[2], r[3], r[4], !!r[5], r[0] === -86 ? N('Two days late; trench left unfinished') : ''));
    [[-350, 0, 3, 3, 2, 0], [-250, 1, 3, 4, 3, 0], [-180, 1, 4, 4, 4, 0], [-113, 1, 5, 4, 5, 0]].forEach(r => rate('s3', r[0] === -113 ? j1.id : '', D(r[0]), !!r[1], r[2], r[3], r[4], !!r[5]));
    rate('s4', j3.id, D(-25), true, 4, 4, 2, false, N('Late W-9 and certificate')); rate('s4', '', D(-200), true, 4, 3, 3, false);
    [[-240, 1, 5, 5, 5], [-170, 1, 5, 4, 5], [-95, 1, 4, 5, 5]].forEach(r => rate('s6', '', D(r[0]), !!r[1], r[2], r[3], r[4], false));
    rate('s5', '', D(-420), false, 2, 1, 2, true, N('Left a trench open overnight')); rate('s5', '', D(-380), false, 3, 2, 1, false);

    /* money on the finished jobs: pays with full waiver trails */
    const pay = (jobId, subId, o, conds, paidOn, uncondOn) => { const p = C.addSubPay(st, Object.assign({ jobId, subId }, o), o.date); st.waivers.filter(w => w.payId === p.id).forEach(w => { if (w.cond && conds) w.received = conds; }); if (paidOn) C.paySub(st, p.id, paidOn); if (uncondOn) st.waivers.filter(w => w.payId === p.id && !w.cond).forEach(w => { w.received = uncondOn; }); return p; };
    pay(j1.id, 's1', { gross: 620000, final: true, date: D(-100) }, D(-100), D(-98), D(-92));
    pay(j1.id, 's3', { gross: 185000, final: true, date: D(-100) }, D(-100), D(-98), D(-95));
    pay(j2.id, 's2', { gross: 500000, date: D(-86) }, D(-86), D(-84), D(-80));
    pay(j2.id, 's2', { final: true, date: D(-70) }, D(-70), D(-68), D(-61));
    pay(j3.id, 's1', { gross: 640000, date: D(-30) }, D(-30), D(-28), D(-24));
    pay(j3.id, 's1', { final: true, date: D(-8) }, D(-8), D(-3), '');
    pay(j3.id, 's4', { final: true, date: D(-22) }, D(-22), D(-20), D(-18));
    const paid = (i, n) => { i.paid = true; i.paidDate = C.addDays(i.date, n || 9); };
    paid(C.addInvoice(st, j1.id, { final: true, date: D(-100), retainBps: 0 }, D(-100)));
    paid(C.addInvoice(st, j2.id, { final: true, date: D(-70), retainBps: 0 }, D(-70)), 23);
    paid(C.addInvoice(st, j3.id, { gross: 1600000, date: D(-28), retainBps: 500 }, D(-28)), 17);
    C.addInvoice(st, j3.id, { final: true, date: D(-12) }, D(-12));
    st.backcharges.push({ id: C.nid(st, 'bc'), jobId: j2.id, subId: 's2', date: D(-84), desc: N('Trench not backfilled and compacted; our crew finished it'), amount: 42000, photoIds: [], status: 'open', callbackId: '', appliedPayId: '', notice: D(-83) });
    st.callbacks.push({ id: C.nid(st, 'cb'), jobId: j3.id, warrantyId: '', who: sub('s1'), date: D(-20), desc: N('Small leak at a PEX fitting, unit B'), cost: 18000, status: 'done', backchargeId: '' });
    st.callbacks.push({ id: C.nid(st, 'cb'), jobId: j1.id, warrantyId: '', who: sub('s1'), date: D(-2), desc: N('Slow drain at the addition tub'), cost: 0, status: 'open', backchargeId: '' });

    /* active work: two-bath remodel with a full sequence and a slipped sub */
    const j4 = job({ customerId: 'u1', title: N('Two-bath remodel, rough-in to trim'), street: '7 Fictional Rd', city: 'Sampleton', stage: 'progress', base: 2380000, materials: 520000, start: W(D(-18), 1) }, D(-24));
    const ug = task(j4, { name: N('Underground'), trade: 'Underground', start: W(D(-18), 1), end: W(D(-18), 2), hours: 1600, bill: 0, status: 'done', scope: N('New drain lines under slab for both baths') }, crew('c1'));
    const ugi = task(j4, { name: N('Underground inspection'), trade: 'Inspection', kind: 'inspection', start: W(D(-15), 1), end: W(D(-15), 1), status: 'done', booked: D(-17), after: [ug.id] });
    const ri = task(j4, { name: N('Rough-in, both baths'), trade: 'Rough-in', start: W(D(-6), 1), end: W(D(0), 1), hours: 3800, bill: 1040000, scope: N('Drain-waste-vent and supply for two baths, per plan sheet P1'), after: [ugi.id] }, crew('c1'));
    const gas = task(j4, { name: N('Gas line to new range'), trade: 'Gas line', start: W(D(-3), 1), end: W(D(-1), 1), cost: 240000, bill: 360000, scope: N('3/4 in black iron, 32 ft, pressure test'), after: [ugi.id] }, sub('s3'));
    gas.slips.push({ date: D(-1), days: 2, reason: N('Waiting on a gas meter upgrade from the utility') }); gas.end = W(D(1), 2);
    const rii = task(j4, { name: N('Rough-in inspection'), trade: 'Inspection', kind: 'inspection', start: W(D(1), 1), end: W(D(1), 1), after: [ri.id, gas.id] });
    const trim = task(j4, { name: N('Fixtures and trim'), trade: 'Fixtures and finish', start: W(D(5), 1), end: W(D(5), 3), hours: 2400, bill: 780000, scope: N('Set 2 toilets, 2 vanities, 1 tub/shower valve trim'), after: [rii.id] }, crew('c2'));
    task(j4, { name: N('Final inspection'), trade: 'Inspection', kind: 'inspection', start: W(D(9), 1), end: W(D(9), 1), after: [trim.id] });
    j4.end = W(D(9), 1);
    j4.permits.push({ id: C.nid(st, 'pm'), kind: N('Plumbing'), number: 'DEMO-BP-24117', applied: D(-26), issued: D(-22), inspDate: '', result: '', notes: '' });
    j4.sov = [{ id: C.nid(st, 'sv'), item: N('Underground and inspection'), value: 340000 }, { id: C.nid(st, 'sv'), item: N('Rough-in plumbing'), value: 980000 }, { id: C.nid(st, 'sv'), item: N('Gas line'), value: 360000 }, { id: C.nid(st, 'sv'), item: N('Fixtures and trim'), value: 700000 }];
    C.addCO(st, j4.id, { desc: N('Move shower valve 18 in. to the left wall'), amount: 65000, days: 0, date: D(-4) }, D(-4)); C.signCO(st, j4.id, j4.changeOrders[0].id, 'Avery Example (demo)', D(-3), true);
    C.addCO(st, j4.id, { desc: N('Add frost-free hose bib on north wall'), amount: 38000, days: 1, date: D(-1) }, D(-1));
    const pcts = {}; pcts[j4.sov[0].id] = 10000; pcts[j4.sov[1].id] = 4000; paid(C.addSovInvoice(st, j4.id, pcts, D(-5), D(-5)));
    pay(j4.id, 's3', { gross: 120000, date: D(-2) }, D(-2), D(-1), '');
    const si = C.addSubInvoice(st, { jobId: j4.id, subId: 's3', num: 'FG-2210', amount: 80000, date: D(0), note: N('Gas line, second draw') }, D(0)); C.approveSubInvoice(st, si.id, {}, D(0));
    j4.punch = [{ id: C.nid(st, 'pu'), text: N('Caulk tub spout, hall bath'), photoId: '', done: false, by: 'Pat Placeholder', u: 1 }, { id: C.nid(st, 'pu'), text: N('Label the new shutoff valves'), photoId: '', done: false, by: 'Pat Placeholder', u: 1 }, { id: C.nid(st, 'pu'), text: N('Clean flux off copper at the water heater'), photoId: '', done: true, by: 'Sam Sample', u: 1 }];
    j4.pickup = [{ id: C.nid(st, 'pk'), item: N('3 in cleanout adapters'), qty: '2', supplier: 'Supply House (demo)', got: false, u: 1 }, { id: C.nid(st, 'pk'), item: N('1/2 in PEX crimp rings'), qty: '1 box', supplier: 'Supply House (demo)', got: true, u: 1 }];
    j4.logs = [{ id: C.nid(st, 'lg'), date: D(-1), by: 'Pat Placeholder', weather: N('Clear'), text: N('Finished vents in hall bath. Gas line sub waiting on the utility meter.'), photoIds: [], u: 1 },
      { id: C.nid(st, 'lg'), date: D(0), by: 'Pat Placeholder', weather: N('Rain'), text: N('Pressure test on the supply lines held. Master bath drains next.'), photoIds: [], u: 1 }];
    st.timeLog = [{ id: C.nid(st, 'tl'), crewId: 'c1', jobId: j4.id, date: D(-1), clockIn: '07:30', clockOut: '16:00', u: 1 }, { id: C.nid(st, 'tl'), crewId: 'c1', jobId: j4.id, date: D(0), clockIn: '07:30', clockOut: '', u: 1 }];

    const j5 = job({ customerId: 'u2', title: N('Main sewer line spot repair'), street: '12 Demo Lane', city: 'Sampleton', stage: 'scheduled', base: 640000, materials: 60000, start: W(D(2), 1), end: W(D(2), 3) }, D(-9));
    task(j5, { name: N('Sewer spot repair, 6 ft'), trade: 'Drain and sewer', start: W(D(2), 1), end: W(D(2), 2), cost: 310000, bill: 480000, scope: N('Excavate, replace 6 ft of 4 in. PVC, camera before and after') }, sub('s2'));
    task(j5, { name: N('Two-way cleanout'), trade: 'Drain and sewer', start: W(D(5), 2), end: W(D(5), 2), hours: 400, bill: 100000, scope: N('Install two-way cleanout at the property line') }, crew('c2'));
    C.addSubInvoice(st, { jobId: j5.id, subId: 's2', num: 'STS-518', amount: 160000, date: D(-1), note: N('Mobilization and excavation deposit') }, D(-1));

    const j6 = job({ customerId: 'u3', title: N('Tankless water heater swap'), street: '48 Example Ct', city: 'Exampleville', stage: 'inspection', base: 495000, materials: 285000, start: D(-3), end: D(-2) }, D(-15));
    const whk = task(j6, { name: N('Water heater'), trade: 'Water heater', start: W(D(-3), 1), end: W(D(-3), 1), hours: 900, bill: 495000, status: 'done', scope: N('Remove 50 gal tank, install tankless, new venting') }, crew('c3'));
    task(j6, { name: N('Final inspection'), trade: 'Inspection', kind: 'inspection', start: W(D(1), 1), end: W(D(1), 1), booked: D(-2), after: [whk.id] });

    const j8 = job({ customerId: 'u5', title: N('Kitchen sink and disposal'), street: '5 Notreal St', city: 'Exampleville', stage: 'lead', notes: N('Asked for a price this week.') }, D(-1));
    task(j8, { name: N('Fixtures and finish'), trade: 'Fixtures and finish' });
    job({ customerId: 'u6', title: N('Commercial restroom remodel, 4 fixtures'), street: '20 Mock Plaza', city: 'Mocktown', stage: 'estimate', base: 3800000, start: C.addMonths(T.slice(0, 8) + '05', 1) }, D(-4));
    job({ customerId: 'u2', title: N('Basement bathroom addition'), street: '12 Demo Lane', city: 'Sampleton', stage: 'lead', base: 1650000, start: C.addMonths(T.slice(0, 8) + '10', 2) }, D(-2));

    /* estimates: one accepted (the repipe job with a bid package), one draft built with the fixture helper */
    const e1 = { id: C.nid(st, 'e'), num: 'E-' + (st.company.nextEst++), customerId: 'u4', title: N('Whole-house PEX repipe, 2 baths'), street: '300 Placeholder Ave', city: 'Sampleton', date: D(-6), lines: C.assemblyLines(st, 'repipe', 18).concat(C.assemblyLines(st, 'wh50', 1).slice(1, 2)), labRate: st.company.labRate, markupBps: st.company.markupBps, taxBps: 0, status: 'sent', notes: '' };
    e1.lines.push({ id: C.nid(st, 'l'), cat: 'Repipe', name: 'Main shutoff valve, replace', unit: 'each', qty: 1000, mat: 8000, lab: 150, takeoff: [] });
    const e2 = { id: C.nid(st, 'e'), num: 'E-' + (st.company.nextEst++), customerId: 'u5', title: N('Kitchen sink and disposal'), street: '5 Notreal St', city: 'Exampleville', date: D(0), lines: C.fixtureLines(st, { ksink: 1, dw: 1 }), labRate: st.company.labRate, markupBps: st.company.markupBps, taxBps: 0, status: 'draft', notes: '' };
    const disp = st.priceBook.find(b => b.key === 'disposal'); e2.lines.push({ id: C.nid(st, 'l'), cat: disp.cat, name: disp.name, unit: disp.unit, qty: 1000, mat: disp.mat, lab: disp.lab, takeoff: [] });
    st.estimates.push(e1, e2);
    const j7 = C.estimateToJob(st, e1.id, D(-2)); j7.retainBps = 500;
    const rp = j7.tasks.find(k => k.trade === 'Repipe'); rp.start = W(D(8), 1); rp.end = W(D(8), 4);
    j7.tasks.filter(k => k !== rp).forEach(k => { k.who = crew('c1'); k.start = W(D(15), 1); k.end = W(D(15), 1); k.after = [rp.id]; });
    const bid = C.newBid(st, { jobId: j7.id, title: N('Whole-house PEX repipe'), trade: 'Repipe', deadline: D(1), forTask: rp.id, invited: ['s1', 's4', 's5'],
      items: [{ text: N('Remove and cap old galvanized supply lines') }, { text: N('PEX-A home runs to 18 fixture points') }, { text: N('New main shutoff valve') }, { text: N('Cut and patch drywall access holes'), allow: 90000 }, { text: N('Permit and inspections'), allow: 35000 }, { text: N('Haul away and daily cleanup'), allow: 15000 }] }, D(-5));
    const cov = ex => { const o = {}; bid.items.forEach((x, i) => { o[x.id] = ex.indexOf(i) < 0; }); return o; };
    C.recordBid(st, bid.id, { subId: 's1', price: 745000, days: 4, covers: cov([]), note: N('Includes drywall patch at access holes'), date: D(-1) }, D(-1));
    C.recordBid(st, bid.id, { subId: 's4', price: 698000, days: 6, covers: cov([3]), exclusions: N('Drywall patching by others'), note: N('Can start in 10 days'), date: D(0) }, D(0));
    C.recordBid(st, bid.id, { subId: 's5', price: 590000, days: 5, covers: cov([3, 4, 5]), exclusions: N('No permit, no patching, no haul-away'), date: D(-1) }, D(-1));
    st.bids[0].invited.push('s2');

    /* warranties */
    st.warranties = [
      { id: C.nid(st, 'wr'), jobId: j6.id, customerId: 'u3', item: N('Tankless gas water heater'), installed: D(-3), laborYears: 1, mfrYears: 12, callbackMonths: 12, lastCallback: '', notes: N('Annual descale') },
      { id: C.nid(st, 'wr'), jobId: '', customerId: 'u1', item: N('Gas tank water heater, 50 gal'), installed: C.addDays(M(T, -12), 12), laborYears: 1, mfrYears: 6, callbackMonths: 12, lastCallback: '', notes: N('Flush tank, check anode') },
      { id: C.nid(st, 'wr'), jobId: j1.id, customerId: 'u2', item: N('Addition bath plumbing'), installed: D(-103), laborYears: 1, mfrYears: 0, callbackMonths: 0, lastCallback: '', notes: '' }];
    /* Quotes and invoices page (what the Accounting export reads): a few sent and paid invoices, dated relative to today, the newest inside the last 25 days so
       the default export range (previous month to today) always has rows. One older paid invoice and one quote show the other states. */
    if (C.newInvoiceFromJob && C.newQuote && C.recordInvoicePayment) {   // core5.js (quotes and invoices) is loaded in the app; some node tests load core.js alone
    const sentOn = (job, date, pays) => { const inv = C.newInvoiceFromJob(st, job.id, date); C.setInvoiceStatus(st, inv.id, 'sent', date, date); (pays || []).forEach(p => C.recordInvoicePayment(st, inv.id, p[0] === 'all' ? C.docTotals(inv).balance : p[0], p[1], '', p[1])); return inv; };
    sentOn(j1, D(-100), [['all', D(-88)]]);
    sentOn(j3, D(-25), [['all', D(-12)]]);
    sentOn(j2, D(-16), [['all', D(-4)]]);
    sentOn(j6, D(-3));
    const dq = C.newQuote(st, j5.id, D(-8)); C.setQuoteStatus(st, dq.id, 'sent', D(-8), D(-8));
    }
    pro(C, st, T, { j1, j2, j3, j4, j5, j6, j7 });
    st.audit = [{ date: T, text: N('Demo company loaded. Everything here is invented.') }];
    return st;
  }
  const api = { demoState };
  root.StarkTradesDemo = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
