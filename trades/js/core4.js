/* Stark Trades 2.2. Pure logic, part 4: the cash radar (a 13-week cash forecast that learns how late each customer really pays and
   runs a seeded what-if simulation), margin watch (leaks, outliers and the chance a job ends in the red) and plain-language
   questions about your own business. Money is whole cents. No DOM, no network. Extends StarkCore in the browser and in Node. */
(function (root) {
  'use strict';
  const C = root.StarkCore || require('./core3.js');
  if (typeof module !== 'undefined' && module.exports) { try { require('./es3.js'); require('./es4.js'); require('./es5.js'); } catch (e) { /* Spanish optional in Node */ } }
  const t = C.t, tt = C.tt, tn = C.tn, N = C.N;
  const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ACTIVE = ['scheduled', 'progress', 'inspection'];

  /* ---------- seeded randomness: the same data and seed always give the same answer ---------- */
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
  function normal(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const quant = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))];
  C.rng = rng;

  /* ---------- the cash radar ---------- */
  /* Days a customer's invoices were paid after their due date, from the invoices already paid. A customer with fewer than 2 paid
     invoices borrows the whole company's history; with fewer than 3 in all, a plain default is used. */
  C.paymentHabits = function (st) {
    const all = [], by = {};
    const add = (cid, due, paidDate) => { if (!C.isDate(due) || !C.isDate(paidDate)) return; const d = clamp(C.daysBetween(due, paidDate), -10, 120); all.push(d); (by[cid] = by[cid] || []).push(d); };
    st.jobs.forEach(j => j.invoices.forEach(i => { if (i.paid) add(j.customerId, i.dueDate, i.paidDate); }));
    (st.plans || []).forEach(p => (p.bills || []).concat(...(p.history || []).map(h => h.bills || [])).forEach(b => { if (b.paid) add(p.customerId, b.dueDate, b.paidDate); }));
    const base = all.length >= 3 ? all : [0, 3, 7, 14];
    return { forCustomer: cid => (by[cid] && by[cid].length >= 2 ? by[cid] : base), samples: all.length, avgLate: all.length ? Math.round(sum(all) / all.length * 10) / 10 : null };
  };
  /* Everything owed to you and by you that has not been paid. */
  C.cashEvents = function (st, today, opts) {
    opts = opts || {}; const ins = [], outs = [], terms = st.company.termsDays || 15, subTerms = st.company.subTerms || 30, poTerms = opts.poTerms != null ? opts.poTerms : 30;
    st.jobs.forEach(j => j.invoices.forEach(i => { if (!i.paid && i.due > 0) { const cu = C.customer(st, j.customerId); ins.push({ kind: 'invoice', ref: i.num, who: cu ? cu.name : j.num, cid: j.customerId, amount: i.due, due: C.isDate(i.dueDate) ? i.dueDate : C.addDays(i.date || today, terms), href: '#/job/' + j.id }); } }));
    (st.plans || []).forEach(p => (p.bills || []).forEach(b => { if (!b.paid && b.amount > 0) { const cu = C.customer(st, p.customerId); ins.push({ kind: 'plan', ref: b.num, who: cu ? cu.name : p.num, cid: p.customerId, amount: b.amount, due: C.isDate(b.dueDate) ? b.dueDate : C.addDays(b.date || today, terms), href: '#/service' }); } }));
    st.subPays.forEach(p => { if (p.status !== 'paid' && p.status !== 'void' && p.due > 0) { const s = C.sub(st, p.subId), j = C.job(st, p.jobId); outs.push({ kind: 'sub', ref: j ? j.num : '', who: s ? s.name : '?', amount: p.due, due: C.isDate(p.dueDate) ? p.dueDate : C.addDays(p.date || today, subTerms), href: '#/money' }); } });
    (st.pos || []).forEach(po => { if (po.status === 'cancelled' || po.paid || po.status === 'draft') return; const tot = C.poTotals(po).total; if (tot > 0) outs.push({ kind: 'po', ref: po.num, who: po.supplier, amount: tot, due: C.addDays(po.received || po.sentDate || po.date || today, poTerms), href: '#/stock/orders' }); });
    return { ins, outs };
  };
  /* opts: weeks (4..26, default 13), open (cash in the bank, cents), overhead (fixed cost per week, cents), delay (days every customer
     pays later than they usually do, -14..60), subShift (days you pay subs later, -14..30), runs, seed. */
  C.cashForecast = function (st, today, opts) {
    opts = opts || {}; const weeks = clamp(Math.round(opts.weeks || 13), 4, 26), open = Math.round(opts.open || 0), overhead = Math.max(0, Math.round(opts.overhead || 0));
    const delay = clamp(Math.round(opts.delay || 0), -14, 60), shift = clamp(Math.round(opts.subShift || 0), -14, 30), runs = clamp(Math.round(opts.runs || 1000), 100, 10000), r = rng(opts.seed == null ? 20261121 : opts.seed);
    const ev = C.cashEvents(st, today, opts), habits = C.paymentHabits(st), end = C.addDays(today, weeks * 7 - 1);
    const wkEnd = k => C.addDays(today, k * 7 + 6), idx = d => d < today ? 0 : Math.min(weeks, Math.floor(C.daysBetween(today, d) / 7));   // week 0..weeks-1; weeks = beyond the horizon
    const fixedOut = ev.outs.map(o => ({ o, d: (() => { const d = C.addDays(o.due, shift); return d < today ? today : d; })() }));
    const bal = [], mins = new Float64Array(runs), finals = new Float64Array(runs); for (let k = 0; k < weeks; k++) bal.push(new Float64Array(runs));
    const medianLate = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const nominal = new Array(weeks).fill(0);
    for (let run = 0; run < runs; run++) {
      const flow = new Float64Array(weeks + 1);
      ev.ins.forEach(i => { const hab = habits.forCustomer(i.cid); let d = C.addDays(i.due, hab[Math.floor(r() * hab.length)] + delay); if (d <= today) d = C.addDays(today, 1 + Math.floor(r() * 7)); flow[idx(d)] += i.amount; });
      fixedOut.forEach(x => { flow[idx(x.d)] -= x.o.amount; });
      for (let k = 0; k < weeks; k++) flow[k] -= overhead;
      let c = open, mn = c; for (let k = 0; k < weeks; k++) { c += flow[k]; bal[k][run] = c; if (c < mn) mn = c; } mins[run] = mn; finals[run] = c;
    }
    ev.ins.forEach(i => { let d = C.addDays(i.due, medianLate(habits.forCustomer(i.cid)) + delay); if (d <= today) d = C.addDays(today, 3); i.expected = d; });
    ev.outs.forEach((o, n) => { o.expected = fixedOut[n].d; });
    ev.ins.forEach(i => { const k = idx(i.expected); if (k < weeks) nominal[k] += i.amount; }); ev.outs.forEach(o => { const k = idx(o.expected); if (k < weeks) nominal[k] -= o.amount; });
    let run0 = open; const nomBal = nominal.map(v => (run0 += v - overhead));
    const series = bal.map((b, k) => { const s = Float64Array.from(b).sort(); return { week: k + 1, start: C.addDays(today, k * 7), end: wkEnd(k), p10: quant(s, 0.1), p50: quant(s, 0.5), p90: quant(s, 0.9), nominal: nomBal[k] }; });
    const ms = Float64Array.from(mins).sort(), low = series.reduce((m, x) => (x.p10 < m.p10 ? x : m), series[0]);
    const lowMedian = series.reduce((m, x) => (x.p50 < m.p50 ? x : m), series[0]);
    let neg = 0; for (let i = 0; i < runs; i++) if (mins[i] < 0) neg++;
    const owed = sum(ev.ins, i => i.amount), payable = sum(ev.outs, o => o.amount), overdue = sum(ev.ins.filter(i => i.due < today), i => i.amount);
    const within = sum(ev.ins.filter(i => i.expected <= end), i => i.amount);
    const first = series.find(x => x.p10 < 0) || null;
    return { weeks, today, end, series, probNegative: neg / runs, lowestP10: low.p10, lowestP10Week: low.week, lowestMedian: lowMedian.p50, lowestMedianWeek: lowMedian.week, firstShortWeek: first ? first.week : null, worstMin: ms[0], owed, payable, overdue, expectedIn: within,
      habits: { samples: habits.samples, avgLate: habits.avgLate }, events: ev, open, overhead, delay, shift, runs, endMedian: quant(Float64Array.from(finals).sort(), 0.5) };
  };

  /* ---------- margin watch ---------- */
  const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
  C.TARGET_BPS = 1500;
  C.marginWatch = function (st, today, opts) {
    opts = opts || {}; const target = opts.targetBps != null ? opts.targetBps : (st.company.targetBps || C.TARGET_BPS), items = [], add = (level, kind, text, amount, href, jobId) => items.push({ level, kind, text, amount: amount || 0, href: href || '#/jobs', jobId: jobId || '' });
    const costed = st.jobs.filter(j => ['lead', 'estimate'].indexOf(j.stage) < 0 && C.contractTotal(j) > 0).map(j => ({ j, c: C.jobCost(st, j) }));
    costed.forEach(x => {
      const { j, c } = x, link = '#/job/' + j.id;
      if (c.profit < 0) add('red', 'loss', t('{job} is losing {amt}: cost {cost} against a contract of {contract}', { job: j.num, amt: C.fmt0(-c.profit), cost: C.fmt0(c.cost), contract: C.fmt0(c.contract) }), -c.profit, link, j.id);
      else if (c.marginBps < target) add('amber', 'thin', t('{job} margin is {pct}%, under your {target}% target', { job: j.num, pct: (c.marginBps / 100).toFixed(1), target: (target / 100).toFixed(0) }), Math.round(c.contract * (target - c.marginBps) / 10000), link, j.id);
      if ((j.stage === 'done' || j.stage === 'inspection') && c.contract - c.billed > 0) add('amber', 'unbilled', t('{job} is {stage} but {amt} of the contract is not billed yet', { job: j.num, stage: t(C.stageName(j.stage)), amt: C.fmt0(c.contract - c.billed) }), c.contract - c.billed, link, j.id);
      if ((j.stage === 'done' || j.stage === 'paid') && c.matPlanned) add('info', 'estimate-cost', t('{job} is finished but its materials are still the estimate, so its margin is a guess', { job: j.num }), 0, link, j.id);
    });
    if (costed.length >= 5) {
      const ms = costed.map(x => x.c.marginBps), m = med(ms), mad = med(ms.map(v => Math.abs(v - m))) || 1, seen = {};
      items.forEach(i => { seen[i.jobId + i.kind] = 1; });
      costed.forEach(x => { const z = (x.c.marginBps - m) / (1.4826 * mad); if (z < -2.5 && x.c.profit >= 0 && x.c.marginBps >= target && !seen[x.j.id + 'thin']) add('amber', 'outlier', t('{job} margin ({pct}%) is far below your usual {usual}%', { job: x.j.num, pct: (x.c.marginBps / 100).toFixed(1), usual: (m / 100).toFixed(0) }), 0, '#/job/' + x.j.id, x.j.id); });
    }
    st.jobs.forEach(j => j.invoices.forEach(i => {
      if (i.paid || !C.isDate(i.dueDate) || i.dueDate >= today) return; const days = C.daysBetween(i.dueDate, today), cu = C.customer(st, j.customerId);
      add(days > 30 ? 'red' : 'amber', 'overdue', t('{num} from {who} is {n} days past due: {amt}', { num: i.num, who: cu ? cu.name : j.num, n: days, amt: C.fmt0(i.due) }), i.due, '#/job/' + j.id, j.id);
    }));
    const cbBy = {}; st.callbacks.forEach(cb => { if (cb.subId) cbBy[cb.subId] = (cbBy[cb.subId] || 0) + 1; });
    Object.keys(cbBy).forEach(id => { if (cbBy[id] >= 2) { const s = C.sub(st, id); add('amber', 'callbacks', t('{sub} caused {n} callbacks: check who pays for the return visits', { sub: s ? s.name : '?', n: cbBy[id] }), sum(st.callbacks.filter(cb => cb.subId === id), cb => cb.cost || 0), s ? '#/sub/' + s.id : '#/subs'); } });
    st.estimates.forEach(e => { if (e.status === 'sent' && C.isDate(e.date) && C.daysBetween(e.date, today) > 14) add('info', 'stale', t('Quote {num} has waited {n} days for an answer: follow up', { num: e.num, n: C.daysBetween(e.date, today) }), C.estimateTotals(e).total, '#/estimate/' + e.id); });
    const rank = { red: 0, amber: 1, info: 2 }; items.sort((a, b) => rank[a.level] - rank[b.level] || b.amount - a.amount);
    return { items, red: items.filter(i => i.level === 'red').length, amber: items.filter(i => i.level === 'amber').length, atRisk: sum(items.filter(i => i.level !== 'info'), i => i.amount), target };
  };
  /* The chance a job ends in the red. The less work is left, the less its costs can still move. */
  const LEFT = { lead: 1, estimate: 1, scheduled: 1, progress: 0.6, inspection: 0.25, done: 0.08, paid: 0 };
  C.jobRisk = function (st, job, opts) {
    opts = opts || {}; const c = C.jobCost(st, job), left = LEFT[job.stage] != null ? LEFT[job.stage] : 1, runs = clamp(opts.runs || 2000, 200, 20000), r = rng((opts.seed == null ? 7 : opts.seed) + job.num.length * 977);
    const vol = clamp(opts.vol == null ? 1 : opts.vol, 0, 3), parts = [[c.subs, 0.08], [c.crew, 0.12], [c.materials, c.matPlanned ? 0.18 : 0.04], [c.other, 0.1], [c.callbacks, 0.3]], contract = c.contract;
    const sd = parts.map(p => p[1] * left * vol), out = new Float64Array(runs), zc = new Float64Array(runs);
    for (let i = 0; i < runs; i++) { const common = normal(r); let cost = -c.backcharges; for (let k = 0; k < parts.length; k++) { const s = sd[k], z = Math.sqrt(0.4) * common + Math.sqrt(0.6) * normal(r); cost += parts[k][0] * Math.exp(s * z - s * s / 2); } out[i] = contract - cost; zc[i] = out[i]; }
    const s = Float64Array.from(out).sort(); let loss = 0; for (let i = 0; i < runs; i++) if (out[i] < 0) loss++;
    return { nominal: c.profit, p10: quant(s, 0.1), p50: quant(s, 0.5), p90: quant(s, 0.9), pLoss: loss / runs, left, contract, runs };
  };
  C.jobRisks = (st, today, opts) => st.jobs.filter(j => ACTIVE.concat(['done']).indexOf(j.stage) >= 0 && C.contractTotal(j) > 0).map(j => ({ job: j, risk: C.jobRisk(st, j, opts) })).sort((a, b) => b.risk.pLoss - a.risk.pLoss || a.risk.p50 - b.risk.p50);

  /* ---------- ask your business ---------- */
  /* Returns {text, rows:[{label, sub, href}]} or null when the question is not understood. Everything comes from your own records. */
  C.askBusiness = function (st, q, today) {
    const f = C.fold(q), has = (...w) => w.some(x => f.indexOf(x) >= 0), money = C.fmt0, rows = [];
    const unpaid = [];
    st.jobs.forEach(j => j.invoices.forEach(i => { if (!i.paid) { const cu = C.customer(st, j.customerId); unpaid.push({ who: cu ? cu.name : j.num, i, j, late: C.isDate(i.dueDate) ? C.daysBetween(i.dueDate, today) : 0 }); } }));
    if (has('lost money', 'losing', 'losers', 'in the red', 'perdiendo', 'perdio dinero', 'perdieron')) {
      const bad = C.marginWatch(st, today).items.filter(i => i.kind === 'loss'); if (!bad.length) return { text: t('No job is losing money right now.'), rows };
      return { text: tn(bad.length, '{n} job is losing money.', '{n} jobs are losing money.'), rows: bad.map(b => ({ label: b.text, sub: '', href: b.href })) };
    }
    if (has('owe', 'owes', 'unpaid', 'overdue', 'outstanding', 'receivable', 'quien me debe', 'me deben', 'sin pagar', 'vencid')) {
      const late = has('overdue', 'late', 'vencid') ? unpaid.filter(u => u.late > 0) : unpaid; late.sort((a, b) => b.late - a.late || b.i.due - a.i.due);
      if (!late.length) return { text: has('overdue', 'late', 'vencid') ? t('Nothing is overdue.') : t('Nobody owes you anything right now.'), rows };
      return { text: t('{n} unpaid invoices add up to {amt}; {late} of it is past due.', { n: late.length, amt: money(sum(late, u => u.i.due)), late: money(sum(late.filter(u => u.late > 0), u => u.i.due)) }), rows: late.slice(0, 8).map(u => ({ label: u.who + ': ' + money(u.i.due), sub: u.i.num + (u.late > 0 ? ' · ' + tn(u.late, '{n} day late', '{n} days late') : ''), href: '#/job/' + u.j.id })) };
    }
    if (has('cash', 'runway', 'broke', 'bank', 'flujo', 'efectivo')) {
      const o = st.company.radar || {}, fc = C.cashForecast(st, today, { open: o.open, overhead: o.overhead, runs: 500 });
      return { text: fc.firstShortWeek ? t('At the likely low you run short in week {n}. Open the cash radar to test what-ifs.', { n: fc.firstShortWeek }) : t('Expected to collect {amt} over the next {w} weeks, with {pay} going out to subs and suppliers.', { amt: money(fc.expectedIn), w: fc.weeks, pay: money(fc.payable) }), rows: [{ label: t('Open the cash radar'), sub: '', href: '#/radar' }] };
    }
    if (has('profit', 'margin', 'made', 'earn', 'ganancia', 'margen')) {
      const done = st.jobs.filter(j => (j.stage === 'done' || j.stage === 'paid') && C.contractTotal(j) > 0).map(j => ({ j, c: C.jobCost(st, j) })); if (!done.length) return { text: t('No finished jobs yet.'), rows };
      const tot = sum(done, x => x.c.contract), pr = sum(done, x => x.c.profit);
      return { text: t('{n} finished jobs made {profit} on {contract}: {pct}% on average.', { n: done.length, profit: money(pr), contract: money(tot), pct: tot ? (pr * 100 / tot).toFixed(1) : '0' }), rows: done.sort((a, b) => b.c.profit - a.c.profit).slice(0, 6).map(x => ({ label: x.j.num + ' ' + tt(x.j.title), sub: money(x.c.profit) + ' · ' + (x.c.marginBps / 100).toFixed(1) + '%', href: '#/job/' + x.j.id })) };
    }
    if (has('best customer', 'biggest customer', 'top customer', 'mejor cliente')) {
      const by = {}; st.jobs.forEach(j => { const c = C.jobCost(st, j); by[j.customerId] = (by[j.customerId] || 0) + c.billed; });
      const top = Object.keys(by).map(id => ({ cu: C.customer(st, id), v: by[id] })).filter(x => x.cu && x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5); if (!top.length) return null;
      return { text: t('Your biggest customer by billing is {name}: {amt}.', { name: top[0].cu.name, amt: money(top[0].v) }), rows: top.map(x => ({ label: x.cu.name, sub: money(x.v), href: '#/customer/' + x.cu.id })) };
    }
    if (has('expired', 'not compliant', 'compliance', 'vencido', 'vencida')) {
      const bad = st.subs.map(s => ({ s, c: C.compliance(s, today, st.company.glMin) })).filter(x => x.c.level === 'red'); if (!bad.length) return { text: t('Every sub is compliant on the dates you entered.'), rows };
      return { text: tn(bad.length, '{n} sub has an expired or missing document.', '{n} subs have an expired or missing document.'), rows: bad.map(x => ({ label: x.s.name, sub: (x.s.trades || []).map(tt).join(', '), href: '#/sub/' + x.s.id })) };
    }
    if (has('get paid', 'days to pay', 'how fast', 'cuanto tardan', 'pagan')) {
      const h = C.paymentHabits(st); if (h.avgLate == null) return { text: t('Not enough paid invoices to say yet.'), rows };
      return { text: h.avgLate > 0 ? t('Customers pay {n} days after the due date on average, from {s} paid invoices.', { n: h.avgLate, s: h.samples }) : t('Customers pay on time or early on average, from {s} paid invoices.', { s: h.samples }), rows };
    }
    if (has('in progress', 'active jobs', 'open jobs', 'trabajos activos', 'en curso')) {
      const act = st.jobs.filter(j => ACTIVE.indexOf(j.stage) >= 0); return { text: tn(act.length, '{n} job is active.', '{n} jobs are active.'), rows: act.slice(0, 8).map(j => ({ label: j.num + ' ' + tt(j.title), sub: t(C.stageName(j.stage)), href: '#/job/' + j.id })) };
    }
    return null;
  };

  C.KINDS.answer = N('Answer');
  C.radarOpts = st => Object.assign({ open: 0, overhead: 0, delay: 0, subShift: 0 }, st.company.radar || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof globalThis !== 'undefined' ? globalThis : this);
