/* Stark Trades 2.1. Pure logic, part 2: sub scorecards and bench, bid invitations and leveling, onboarding,
   task sequencing and delay ripple, field mode and encrypted handoff, schedule-of-values billing, sub invoice approval,
   backcharges, callbacks, payment reminders, markup/margin, capacity forecast, plumbing estimate helpers, CSV, alerts. */
(function (root) {
  'use strict';
  const C = root.StarkCore || require('./core.js');
  const t = C.t, tt = C.tt, tn = C.tn, N = C.N;
  N('approved'); N('rejected'); N('open'); N('agreed'); N('disputed'); N('applied'); N('dropped'); N('done'); N('received');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- scorecards: per-job ratings, callbacks and backcharges, trend ---------- */
  C.ratingScore = r => (r.onTime ? 35 : 0) + 6 * clamp(r.quality || 3, 1, 5) + 3 * clamp(r.cleanup || 3, 1, 5) + 2 * clamp(r.paperwork || 3, 1, 5) + (r.callback ? 0 : 10);
  C.rate = function (st, o, today) {
    if (!C.sub(st, o.subId)) throw new Error(t('Pick a sub'));
    const r = { id: C.nid(st, 'r'), subId: o.subId, jobId: o.jobId || '', taskId: o.taskId || '', date: o.date || today, onTime: !!o.onTime, quality: clamp(o.quality | 0 || 3, 1, 5), cleanup: clamp(o.cleanup | 0 || 3, 1, 5), paperwork: clamp(o.paperwork | 0 || 3, 1, 5), callback: !!o.callback, note: o.note || '' };
    st.ratings.push(r); return r;
  };
  C.scorecard = function (st, subId, today) {
    today = today || C.today();
    const rs = st.ratings.filter(r => r.subId === subId).slice().sort((a, b) => a.date < b.date ? -1 : 1), n = rs.length, sc = rs.map(C.ratingScore);
    const base = Math.round((sc.reduce((a, b) => a + b, 0) + 140) / (n + 2)), yearAgo = C.addDays(today, -365);
    const cbs = st.callbacks.filter(c => c.who && c.who.t === 'sub' && c.who.id === subId && c.date >= yearAgo).length;
    const bcs = st.backcharges.filter(b => b.subId === subId && b.status !== 'dropped' && b.date >= yearAgo).length;
    const penalty = Math.min(20, 5 * cbs) + Math.min(10, 3 * bcs), score = clamp(base - penalty, 0, 100);
    const avg = k => n ? Math.round(10 * rs.reduce((a, r) => a + r[k], 0) / n) / 10 : null;
    let trend = 'new';
    if (n >= 4) { const last = sc.slice(-3), prev = sc.slice(Math.max(0, n - 6), n - 3), d = last.reduce((a, b) => a + b, 0) / last.length - prev.reduce((a, b) => a + b, 0) / prev.length; trend = d >= 5 ? 'up' : d <= -5 ? 'down' : 'steady'; }
    return { score, base, n, trend, isNew: n < 3, onTime: n ? Math.round(100 * rs.filter(r => r.onTime).length / n) : null, quality: avg('quality'), cleanup: avg('cleanup'), paperwork: avg('paperwork'),
      callbacks: rs.filter(r => r.callback).length + cbs, warrantyCallbacks: cbs, backcharges: bcs, penalty, history: sc.slice(-8) };
  };
  C.TREND = { up: N('improving'), down: N('slipping'), steady: N('steady'), new: N('new') };
  C.BENCH = [['preferred', N('Preferred')], ['backup', N('Backup')], ['', N('Not listed')], ['dnu', N('Do not use')]];
  C.benchName = k => t((C.BENCH.find(b => b[0] === (k || '')) || C.BENCH[2])[1]);
  C.setBench = function (st, subId, bench, reason, today) {
    const s = C.sub(st, subId); if (!s) throw new Error(t('Pick a sub'));
    if (bench === 'dnu' && String(reason || '').trim().length < 5) throw new Error(t('Write down why, so the decision is on record'));
    s.bench = bench || ''; s.dnuReason = bench === 'dnu' ? String(reason).trim() : '';
    C.log(st, today, s.name + ': ' + C.benchName(s.bench)); return s;
  };
  C.benchSearch = function (st, q, today) {
    q = q || {}; const area = String(q.area || '').trim().toLowerCase(), rank = { preferred: 0, backup: 1, '': 2, dnu: 3 };
    return st.subs.filter(s => s.active !== false).filter(s => q.bench ? s.bench === q.bench : s.bench !== 'dnu')
      .filter(s => !q.trade || (s.trades || []).indexOf(q.trade) >= 0).filter(s => !area || String(s.area || '').toLowerCase().indexOf(area) >= 0)
      .map(s => ({ sub: s, card: C.scorecard(st, s.id, today), comp: C.compliance(s, today, st.company.glMin).level, onboard: C.onboardStatus(s, st), free: C.isDate(q.from) ? C.isFree(st, { t: 'sub', id: s.id }, q.from, C.isDate(q.to) ? q.to : q.from) : null }))
      .filter(r => !q.minScore || r.card.score >= q.minScore).filter(r => !q.freeOnly || r.free)
      .sort((a, b) => (rank[a.sub.bench || ''] - rank[b.sub.bench || '']) || (b.card.score - a.card.score));
  };

  /* ---------- sub onboarding ---------- */
  C.ONBOARD = [['license', N('License copy, checked on the state board website')], ['coi', N('Insurance certificate with the limits we require')], ['addl', N('Additional insured endorsement naming us')],
    ['wos', N('Waiver of subrogation endorsement')], ['wc', N("Workers' comp certificate or state exemption")], ['w9', N('W-9 received (we record yes or no only)')],
    ['msa', N('Signed subcontract agreement')], ['emergency', N('Emergency contact and crew list')], ['refs', N('Two references checked')]];
  C.onboardItems = st => C.ONBOARD.filter(o => (o[0] !== 'addl' || st.company.addlInsured) && (o[0] !== 'wos' || st.company.waiverSubro));
  C.onboardStatus = function (s, st) {
    const items = st ? C.onboardItems(st) : C.ONBOARD, on = s.onboard || {};
    const done = items.filter(o => on[o[0]] || (o[0] === 'w9' && s.w9)).length;
    return { done, total: items.length, state: done === 0 ? 'none' : done === items.length ? 'complete' : 'progress', missing: items.filter(o => !(on[o[0]] || (o[0] === 'w9' && s.w9))).map(o => o[0]) };
  };
  C.ONBOARD_STATE = { none: N('Not started'), progress: N('In progress'), complete: N('Complete') };
  C.onboardPacket = function (st, subId, opts, today) {
    opts = Object.assign({ dueDays: 7 }, opts); const s = C.sub(st, subId); if (!s) throw new Error(t('No such sub'));
    const L = [t('To: {name}', { name: s.name }), C.fromLine(st), t('Date: {date}', { date: C.fmtDate(today) }), '',
      t('Thank you for working with us. Before your first job, please send the documents below by {date}.', { date: C.fmtDate(C.addDays(today, opts.dueDays)) }), '',
      t('1. A copy of your contractor license (we will also check it on the state board website).'), t('2. Insurance certificates, sent by your insurance agent, showing:')];
    C.insuranceLines(st).forEach(l => L.push('   ' + l));
    L.push(t('3. A completed W-9. Please hand it to us or mail it. Do not email or text your Social Security or tax ID number. We only record that we have it.'),
      t('4. The signed subcontract agreement.'), t('5. An emergency contact and the names of the crew who will be on our jobs.'), t('6. Two references from contractors or suppliers.'), '',
      t('Template packet. Your insurance agent should confirm these requirements fit your business and your state.'));
    return { title: t('New subcontractor document request'), lines: L, name: 'onboarding-' + s.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.txt' };
  };

  /* ---------- bid invitations and bid leveling ---------- */
  C.newBid = function (st, o, today) {
    if (!C.job(st, o.jobId)) throw new Error(t('Pick a job'));
    const items = (o.items || []).map(x => typeof x === 'string' ? { text: x } : x).filter(x => String(x.text || '').trim());
    if (!String(o.title || '').trim()) throw new Error(t('Name the bid package')); if (!items.length) throw new Error(t('List at least one scope item'));
    if (!C.isDate(o.deadline)) throw new Error(t('Pick a bid deadline'));
    const b = { id: C.nid(st, 'b'), num: 'B-' + (st.company.nextBid++), jobId: o.jobId, title: o.title.trim(), trade: o.trade || '', deadline: o.deadline, created: today,
      items: items.map(x => ({ id: C.nid(st, 'bi'), text: String(x.text).trim(), allow: x.allow || 0 })), invited: (o.invited || []).slice(), responses: [], status: 'open', awardedSub: '', taskId: '', agreementId: '', forTask: o.forTask || '' };
    st.bids.push(b); C.log(st, today, b.num + ' ' + b.title); return b;
  };
  C.inviteDoc = function (st, bidId, subId, opts, today) {
    opts = Object.assign({ address: 'city' }, opts); const b = st.bids.find(x => x.id === bidId), s = C.sub(st, subId); if (!b || !s) throw new Error(t('Pick a bid and a sub'));
    const j = C.job(st, b.jobId), L = [t('To: {name}', { name: s.name }), C.fromLine(st), t('Date: {date}', { date: C.fmtDate(today) }), '',
      t('You are invited to bid on {title} for job {job} ({site}).', { title: tt(b.title), job: j.num, site: C.siteText(j, opts.address) }), t('Bids are due by {date}.', { date: C.fmtDate(b.deadline) }), '', t('Scope items. Please mark each one INCLUDED or EXCLUDED in your bid:')];
    b.items.forEach((x, i) => L.push('  ' + (i + 1) + '. ' + tt(x.text)));
    L.push('', t('Please give a total price, the working days you need, your earliest start, and list anything you exclude.'), t('Before any award we need a current license, insurance certificates and a W-9:'));
    return { title: t('Invitation to bid: {title}', { title: tt(b.title) }), lines: L.concat(C.insuranceLines(st)), name: 'bid-invite-' + b.num + '.txt' };
  };
  C.recordBid = function (st, bidId, o, today) {
    const b = st.bids.find(x => x.id === bidId); if (!b) throw new Error(t('No such bid')); if (b.status !== 'open') throw new Error(t('This bid package is already awarded'));
    if (!C.sub(st, o.subId)) throw new Error(t('Pick a sub')); if (!(o.price > 0)) throw new Error(t('Enter the bid price')); if (!(o.days > 0)) throw new Error(t('Working days must be 1 or more'));
    const covers = {}; b.items.forEach(x => { covers[x.id] = o.covers && o.covers[x.id] === false ? false : true; });
    const r = { subId: o.subId, price: o.price, days: o.days | 0, covers, exclusions: String(o.exclusions || '').trim(), note: String(o.note || '').trim(), date: o.date || today };
    b.responses = b.responses.filter(x => x.subId !== o.subId).concat([r]); if (b.invited.indexOf(o.subId) < 0) b.invited.push(o.subId); return r;
  };
  C.levelBids = function (st, bidId, today) {
    const b = st.bids.find(x => x.id === bidId); if (!b) throw new Error(t('No such bid'));
    const cols = b.responses.map(r => {
      const s = C.sub(st, r.subId) || { name: '?' }, excluded = b.items.filter(x => r.covers[x.id] === false), card = C.scorecard(st, r.subId, today), comp = s.bench === 'dnu' ? 'red' : C.compliance(s, today, st.company.glMin).level;
      const flags = []; if (excluded.length) flags.push(tn(excluded.length, 'Excludes {n} scope item', 'Excludes {n} scope items'));
      if (r.exclusions) flags.push(t('Written exclusions: {text}', { text: tt(r.exclusions) })); if (r.date > b.deadline) flags.push(t('Arrived after the deadline'));
      if (comp === 'red') flags.push(s.bench === 'dnu' ? t('Marked do not use') : t('Paperwork expired or missing'));
      return { r, sub: s, excluded, adj: r.price + excluded.reduce((a, x) => a + (x.allow || 0), 0), card, comp, flags };
    });
    const ok = cols.filter(c => c.comp !== 'red'), low = ok.length ? ok.reduce((a, c) => c.adj < a.adj ? c : a) : null;
    cols.forEach(c => { c.low = c === low; c.spread = low ? c.adj - low.adj : 0; });
    return { bid: b, items: b.items, cols, low, waiting: b.invited.filter(id => !b.responses.some(r => r.subId === id)).map(id => C.sub(st, id)).filter(Boolean) };
  };
  C.awardBid = function (st, bidId, subId, opts) {
    opts = opts || {}; const today = opts.today || C.today(), b = st.bids.find(x => x.id === bidId); if (!b) throw new Error(t('No such bid'));
    if (b.status !== 'open') throw new Error(t('This bid package is already awarded'));
    const r = b.responses.find(x => x.subId === subId); if (!r) throw new Error(t('That sub has not bid'));
    const job = C.job(st, b.jobId), wd = st.company.workDays, inc = b.items.filter(x => r.covers[x.id] !== false), exc = b.items.filter(x => r.covers[x.id] === false);
    const reuse = b.forTask && job.tasks.find(x => x.id === b.forTask), k = reuse || C.newTask(st, { name: b.title, trade: b.trade }), scope0 = k.scope;
    k.scope = inc.map(x => x.text).join('; ');
    const start = C.isDate(opts.start) ? opts.start : k.start; if (C.isDate(start)) { k.start = C.nextWork(start, wd); k.end = C.addWorkdays(k.start, r.days, wd); }
    if (!reuse) job.tasks.push(k);
    try { C.assign(st, job.id, k.id, { t: 'sub', id: subId }, { today, override: opts.override }); } catch (e) { if (!reuse) job.tasks.splice(job.tasks.indexOf(k), 1); else k.scope = scope0; throw e; }
    k.cost = r.price;
    const ag = { id: C.nid(st, 'ag'), jobId: job.id, subId, bidId: b.id, taskIds: [k.id], price: r.price, created: today, status: 'draft', exclusions: exc.map(x => tt(x.text)).concat(r.exclusions ? [tt(r.exclusions)] : []).join('; ') };
    st.agreements.push(ag); b.status = 'awarded'; b.awardedSub = subId; b.taskId = k.id; b.agreementId = ag.id;
    C.log(st, today, b.num + ' -> ' + C.sub(st, subId).name + ' ' + C.fmt(r.price)); return { task: k, agreement: ag };
  };

  /* ---------- sequencing: dependencies, standard order, delay ripple, inspection booking ---------- */
  C.SEQ = { plumbing: [[N('Underground'), 'Underground', 2], [N('Underground inspection'), 'Inspection', 1], [N('Rough-in'), 'Rough-in', 3], [N('Rough-in inspection'), 'Inspection', 1], [N('Trim'), 'Fixtures and finish', 2], [N('Final inspection'), 'Inspection', 1]],
    electrical: [[N('Rough wiring'), 'Rough wiring', 3], [N('Rough-in inspection'), 'Inspection', 1], [N('Devices and fixtures'), 'Devices and fixtures', 2], [N('Final inspection'), 'Inspection', 1]],
    hvac: [[N('Ductwork'), 'Ductwork', 3], [N('Rough-in inspection'), 'Inspection', 1], [N('Equipment set'), 'Equipment set', 2], [N('Startup and balance'), 'Startup and balance', 1], [N('Final inspection'), 'Inspection', 1]],
    gc: [[N('Demolition'), 'Demolition', 2], [N('Framing'), 'Framing', 3], [N('Rough-in inspection'), 'Inspection', 1], [N('Drywall'), 'Drywall', 3], [N('Painting'), 'Painting', 2], [N('Final inspection'), 'Inspection', 1]] };
  C.addSequence = function (st, jobId, start, today) {
    const job = C.job(st, jobId); if (!job) throw new Error(t('No such job'));
    const wd = st.company.workDays, seq = C.SEQ[st.preset] || C.SEQ.plumbing; let cur = C.nextWork(C.isDate(start) ? start : today, wd), prev = null; const made = [];
    seq.forEach(s => { const k = C.newTask(st, { name: s[0], trade: s[1], kind: s[1] === C.INSPECTION ? 'inspection' : 'work' }); k.start = cur; k.end = C.addWorkdays(cur, s[2], wd); if (prev) k.after = [prev.id]; job.tasks.push(k); made.push(k); prev = k; cur = C.nextWork(C.addDays(k.end, 1), wd); });
    if (!job.start) job.start = made[0].start; job.end = made[made.length - 1].end; return made;
  };
  C.wouldCycle = function (job, taskId, depId) { // would making taskId depend on depId create a loop?
    const seen = {}, stack = [depId];
    while (stack.length) { const id = stack.pop(); if (id === taskId) return true; if (seen[id]) continue; seen[id] = 1; const k = job.tasks.find(x => x.id === id); if (k) stack.push.apply(stack, k.after || []); }
    return false;
  };
  C.setAfter = function (job, taskId, deps) {
    const k = job.tasks.find(x => x.id === taskId); if (!k) throw new Error(t('No such task'));
    deps.forEach(d => { if (d === taskId || C.wouldCycle(job, taskId, d)) throw new Error(t('That would make a loop: a task cannot wait on itself.')); });
    k.after = deps.slice(); return k;
  };
  C.topo = function (job) { const out = [], seen = {}; const visit = k => { if (seen[k.id]) return; seen[k.id] = 1; (k.after || []).forEach(id => { const d = job.tasks.find(x => x.id === id); if (d) visit(d); }); out.push(k); }; job.tasks.forEach(visit); return out; };
  C.ripple = function (st, job) {
    const wd = st.company.workDays, issues = [];
    C.topo(job).forEach(k => {
      if (k.status === 'done' || !C.isDate(k.start)) return;
      (k.after || []).forEach(id => { const d = job.tasks.find(x => x.id === id); if (!d || !C.isDate(d.end)) return; const earliest = C.nextWork(C.addDays(d.end, 1), wd);
        if (k.start < earliest) issues.push({ job, task: k, dep: d, earliest, late: C.workdaysIn(k.start, C.addDays(earliest, -1), wd).length }); });
    });
    return issues;
  };
  C.applyRipple = function (st, jobId, today) {
    const job = C.job(st, jobId), wd = st.company.workDays, moved = [];
    C.topo(job).forEach(k => {
      if (k.status === 'done' || !C.isDate(k.start)) return;
      const ends = (k.after || []).map(id => job.tasks.find(x => x.id === id)).filter(d => d && C.isDate(d.end)).map(d => d.end).sort();
      if (!ends.length) return; const earliest = C.nextWork(C.addDays(ends[ends.length - 1], 1), wd);
      if (k.start < earliest) { const len = Math.max(1, C.workdaysIn(k.start, k.end, wd).length); k.start = earliest; k.end = C.addWorkdays(earliest, len, wd); moved.push(k); }
    });
    const last = job.tasks.map(k => k.end).filter(Boolean).sort().pop(); if (last && (!job.end || last > job.end)) job.end = last;
    if (moved.length) C.log(st, today, job.num + ': ' + moved.map(k => tt(k.name)).join(', ') + ' -> ' + t('moved later'));
    return moved;
  };
  C.slipTask = function (st, jobId, taskId, days, reason, today) {
    const k = C.task(st, jobId, taskId); if (!k || !C.isDate(k.end)) throw new Error(t('That task has no dates yet'));
    if (!(days > 0)) throw new Error(t('Enter how many working days it slipped'));
    let e = k.end; for (let i = 0; i < days; i++) e = C.nextWork(C.addDays(e, 1), st.company.workDays);
    k.end = e; k.slips.push({ date: today, days, reason: String(reason || '').trim() });
    C.log(st, today, C.job(st, jobId).num + ' ' + tt(k.name) + ': +' + days); return C.ripple(st, C.job(st, jobId));
  };
  C.inspectionsToBook = function (st, today) {
    const out = [], lead = st.company.inspLead || 3;
    st.jobs.forEach(j => j.tasks.forEach(k => { if (k.kind === 'inspection' && k.status !== 'done' && !k.booked && C.isDate(k.start)) { const d = C.daysBetween(today, k.start); if (d <= lead + 2) out.push({ job: j, task: k, days: d, bookBy: C.addDays(k.start, -lead) }); } }));
    return out.sort((a, b) => a.days - b.days);
  };

  /* ---------- field mode: punch list, pickups, time, daily log, daily sheet ---------- */
  const stamp = () => Date.now();
  C.hoursOf = function (clockIn, clockOut) { const m = s => { const x = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return x ? (+x[1]) * 60 + (+x[2]) : null; }; const a = m(clockIn), b = m(clockOut); return a == null || b == null || b === a ? 0 : Math.round(((b - a + 1440) % 1440) * 100 / 60); }; // out before in = past midnight (night calls)
  C.addPunch = (st, job, o) => { const p = { id: C.nid(st, 'pu'), text: String(o.text || '').trim(), photoId: o.photoId || '', done: false, by: o.by || '', u: stamp() }; if (!p.text) throw new Error(t('Describe the punch item')); job.punch.push(p); return p; };
  C.addPickup = (st, job, o) => { const p = { id: C.nid(st, 'pk'), item: String(o.item || '').trim(), qty: String(o.qty || '').trim(), supplier: String(o.supplier || '').trim(), got: false, u: stamp() }; if (!p.item) throw new Error(t('What needs picking up?')); job.pickup.push(p); return p; };
  C.addLog = (st, job, o, today) => { const l = { id: C.nid(st, 'lg'), date: o.date || today, by: o.by || '', weather: o.weather || '', text: String(o.text || '').trim(), photoIds: o.photoIds || [], u: stamp() }; if (!l.text) throw new Error(t('Write what happened today')); job.logs.push(l); return l; };
  C.clock = function (st, crewId, jobId, date, kind, time) {
    if (!C.crewM(st, crewId)) throw new Error(t('Pick a crew member'));
    if (!/^\d{1,2}:\d{2}$/.test(time || '')) throw new Error(t('Enter the time like 07:30'));
    let e = st.timeLog.find(x => x.crewId === crewId && x.date === date && x.jobId === jobId && (kind === 'in' ? !x.clockIn : !x.clockOut));
    if (!e && kind === 'out') e = st.timeLog.slice().reverse().find(x => x.crewId === crewId && x.date === date && x.jobId === jobId);
    if (!e) { e = { id: C.nid(st, 'tl'), crewId, jobId, date, clockIn: '', clockOut: '', u: 0 }; st.timeLog.push(e); }
    if (kind === 'in') e.clockIn = time; else { if (e.clockIn && C.hoursOf(e.clockIn, time) === 0) throw new Error(t('Time out must be after time in')); e.clockOut = time; }
    e.u = stamp(); return e;
  };
  C.dailySheet = function (st, date) {
    return st.jobs.filter(j => j.tasks.some(k => C.isDate(k.start) && k.start <= date && k.end >= date && k.status !== 'done') || j.logs.some(l => l.date === date) || st.timeLog.some(x => x.jobId === j.id && x.date === date))
      .map(j => ({ job: j, tasks: j.tasks.filter(k => C.isDate(k.start) && k.start <= date && k.end >= date && k.status !== 'done'), crew: Array.from(new Set(j.tasks.filter(k => k.who && k.who.t === 'crew' && k.start <= date && k.end >= date).map(k => k.who.id))),
        time: st.timeLog.filter(x => x.jobId === j.id && x.date === date), punchOpen: j.punch.filter(p => !p.done).length, pickupOpen: j.pickup.filter(p => !p.got).length }));
  };

  /* encrypted handoff between the office computer and a field phone. Records merge by id; newer edits (u) win */
  C.makeHandoff = function (st, opts, today) {
    opts = Object.assign({ phone: false }, opts); const active = ['scheduled', 'progress', 'inspection'], photoIds = [];
    const jobs = st.jobs.filter(j => active.indexOf(j.stage) >= 0 || (opts.allJobs && j.stage !== 'paid')).map(j => {
      j.punch.forEach(p => { if (p.photoId) photoIds.push(p.photoId); }); j.logs.forEach(l => l.photoIds.forEach(id => photoIds.push(id)));
      const cu = C.customer(st, j.customerId);
      return { id: j.id, num: j.num, title: j.title, street: j.street, city: j.city, stage: j.stage, contact: opts.phone && cu ? { name: cu.name, phone: cu.phone } : null,
        tasks: j.tasks.map(k => ({ id: k.id, name: k.name, trade: k.trade, who: k.who, whoName: C.whoName(st, k.who), start: k.start, end: k.end, status: k.status, scope: k.scope, kind: k.kind, after: k.after, booked: k.booked })),
        permits: j.permits.map(p => ({ id: p.id, kind: p.kind, inspDate: p.inspDate, result: p.result })), punch: j.punch, pickup: j.pickup, logs: j.logs };
    });
    const ids = jobs.map(j => j.id);
    return { app: 'stark-trades', kind: 'handoff', v: 1, from: { id: st.device.id, role: st.device.role }, created: today, company: { name: st.company.name, phone: st.company.phone },
      crew: st.crew.map(c => ({ id: c.id, name: c.name, role: c.role, skills: c.skills, active: c.active })), timeLog: st.timeLog.filter(x => ids.indexOf(x.jobId) >= 0 && x.date >= C.addDays(today, -60)), jobs, photoIds: Array.from(new Set(photoIds)) };
  };
  /* one index per merge (id -> position), so a big handoff is O(n + m), not O(n x m) */
  const mergeById = C.mergeById = (mine, theirs, n) => {
    if (!Array.isArray(theirs)) return; const at = new Map(); mine.forEach((x, i) => { if (x && x.id != null) at.set(x.id, i); });
    theirs.forEach(r => { if (!r || r.id == null) return; const i = at.get(r.id); if (i === undefined) { at.set(r.id, mine.length); mine.push(JSON.parse(JSON.stringify(r))); n.added++; } else if ((r.u || 0) > (mine[i].u || 0)) { mine[i] = JSON.parse(JSON.stringify(r)); n.updated++; } });
  };
  /* handoff passphrase rotation: a salted PBKDF2 check of the last handoff passphrase is kept inside the encrypted workspace.
     When a crew member is set inactive after a handoff, the next handoff must use a new passphrase, so the old one stops opening new files. */
  C.handoffCheck = async function (pass, salt) { const wc = globalThis.crypto || require('node:crypto').webcrypto, s = salt || C.newSalt(), base = await wc.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    return { salt: s, hash: C.b64(new Uint8Array(await wc.subtle.deriveBits({ name: 'PBKDF2', salt: C.unb64(s), iterations: 100000, hash: 'SHA-256' }, base, 256))) }; };
  C.crewDeactivated = function (st, wasActive, nowActive) { if (wasActive && !nowActive && st.device && st.device.hoHash) st.device.hoRotate = true; };
  C.handoffReuse = async function (st, pass) { const d = st.device || {}; if (!d.hoRotate || !d.hoHash) return false; return (await C.handoffCheck(pass, d.hoSalt)).hash === d.hoHash; };
  C.handoffUsed = async function (st, pass) { const c = await C.handoffCheck(pass); st.device.hoSalt = c.salt; st.device.hoHash = c.hash; st.device.hoRotate = false; };
  C.mergeHandoff = function (st, pk, today) {
    if (!pk || pk.app !== 'stark-trades' || pk.kind !== 'handoff') throw new Error(t('This is not a Stark Trades handoff file.'));
    if (pk.from && pk.from.id && pk.from.id === st.device.id) throw new Error(t('This handoff file came from this device.'));
    const n = { jobs: 0, added: 0, updated: 0, done: 0 }, fromOffice = pk.from && pk.from.role === 'office';
    if (fromOffice) { pk.crew.forEach(c => { const m = C.crewM(st, c.id); if (m) Object.assign(m, c); else st.crew.push(Object.assign({ cost: 0 }, c)); }); if (!st.company.name) st.company.name = pk.company.name; if (!st.company.phone) st.company.phone = pk.company.phone; }
    pk.jobs.forEach(pj => {
      let j = C.job(st, pj.id);
      if (!j) { j = { id: pj.id, num: pj.num, customerId: '', title: pj.title, street: pj.street, city: pj.city, stage: pj.stage, created: today, start: '', end: '', base: 0, materials: 0, other: 0, notes: '', estimateId: '', retainBps: 0, tasks: [], changeOrders: [], invoices: [], permits: [], photos: [], sov: [], punch: [], pickup: [], logs: [], contact: pj.contact }; st.jobs.push(j); n.jobs++; }
      else if (fromOffice) { j.title = pj.title; j.street = pj.street; j.city = pj.city; j.stage = pj.stage; j.contact = pj.contact; }
      pj.tasks.forEach(pt => {
        let k = j.tasks.find(x => x.id === pt.id);
        if (!k) { k = C.newTask(st, pt); k.id = pt.id; j.tasks.push(k); }
        if (fromOffice) Object.assign(k, { name: pt.name, trade: pt.trade, who: pt.who, start: pt.start, end: pt.end, scope: pt.scope, kind: pt.kind, after: pt.after, booked: pt.booked, whoName: pt.whoName });
        if (pt.status === 'done' && k.status !== 'done') { k.status = 'done'; n.done++; }
      });
      if (fromOffice) j.permits = pj.permits.map(p => Object.assign({ number: '', applied: '', issued: '', notes: '' }, j.permits.find(x => x.id === p.id) || {}, p));
      mergeById(j.punch, pj.punch, n); mergeById(j.pickup, pj.pickup, n); mergeById(j.logs, pj.logs, n);
    });
    mergeById(st.timeLog, pk.timeLog, n);
    return n;
  };
  C.packHandoff = (pass, packet, photos, iter) => C.packFile('handoff', pass, { packet, photos: photos.map(p => ({ id: p.id, b64: C.b64(p.bytes) })) }, iter);
  C.unpackHandoff = async function (text, pass) { const p = await C.unpackFile('handoff', text, pass); return { packet: p.packet, photos: (p.photos || []).map(x => ({ id: x.id, bytes: C.unb64(x.b64) })) }; };

  /* ---------- money: schedule of values billing ---------- */
  C.sovLines = job => job.sov.concat(job.changeOrders.filter(c => c.status === 'approved').map(c => ({ id: c.id, item: c.num + ': ' + tt(c.desc), value: c.amount, co: true })));
  C.sovCheck = function (job) { const sum = C.sovLines(job).reduce((a, l) => a + l.value, 0), contract = C.contractTotal(job); return { sum, contract, ok: sum === contract, diff: contract - sum }; };
  C.sovPrevious = (job, lineId) => job.invoices.reduce((a, inv) => a + ((inv.sov || []).find(x => x.id === lineId) || { now: 0 }).now, 0);
  C.sovPreview = function (job, pcts) {
    const lines = C.sovLines(job).map(l => { const prev = C.sovPrevious(job, l.id), bps = pcts[l.id] != null ? clamp(pcts[l.id], 0, 10000) : (l.value ? C.roundDiv(prev * 10000, l.value) : 0), toDate = C.roundDiv(l.value * bps, 10000); return { id: l.id, item: l.item, value: l.value, prev, bps, toDate, now: toDate - prev }; });
    return { lines, gross: lines.reduce((a, l) => a + l.now, 0), bad: lines.filter(l => l.now < 0) };
  };
  C.addSovInvoice = function (st, jobId, pcts, date, today) {
    const job = C.job(st, jobId), chk = C.sovCheck(job); if (!chk.ok) throw new Error(t('The schedule of values adds up to {a} but the contract is {b}. Fix it first.', { a: C.fmt(chk.sum), b: C.fmt(chk.contract) }));
    const pv = C.sovPreview(job, pcts); if (pv.bad.length) throw new Error(t('A line cannot go below what was already billed: {item}', { item: tt(pv.bad[0].item) }));
    if (pv.gross <= 0) throw new Error(t('Nothing new to bill this period'));
    return C.addInvoice(st, jobId, { gross: pv.gross, date, sov: pv.lines.filter(l => l.now !== 0 || l.prev).map(l => ({ id: l.id, item: l.item, value: l.value, prev: l.prev, now: l.now, toDate: l.toDate })) }, today);
  };
  C.progressBillDoc = function (st, jobId, invId, opts) {
    opts = Object.assign({ address: 'full', customer: true }, opts); const job = C.job(st, jobId), inv = job.invoices.find(i => i.id === invId), cu = C.customer(st, job.customerId), co = st.company;
    const L = [(co.name || '') + (co.license ? ', ' + t('license {n}', { n: co.license }) : ''), t('Invoice {num}, {date}. Due {due}.', { num: inv.num, date: C.fmtDate(inv.date), due: C.fmtDate(inv.dueDate) })];
    if (opts.customer && cu) L.push(t('Customer: {name}', { name: cu.name })); L.push(t('Site: {site}', { site: C.siteText(job, opts.address) }), '');
    const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n), num = (s, n) => (' '.repeat(n) + s).slice(-n);
    L.push(pad(t('Item'), 30) + num(t('Value'), 13) + num(t('Before'), 13) + num(t('This bill'), 13) + num(t('To date'), 13) + num('%', 6));
    (inv.sov || []).forEach(l => L.push(pad(tt(l.item), 30) + num(C.fmt(l.value), 13) + num(C.fmt(l.prev), 13) + num(C.fmt(l.now), 13) + num(C.fmt(l.toDate), 13) + num(l.value ? Math.round(100 * l.toDate / l.value) + '%' : '-', 6)));
    if (!inv.sov) L.push(t('Work billed this period: {amt}', { amt: C.fmt(inv.gross) }));
    L.push('', t('Contract with signed change orders: {amt}', { amt: C.fmt(C.contractTotal(job)) }), t('Work billed this period: {amt}', { amt: C.fmt(inv.gross) }));
    if (inv.retained) L.push(t('Less retainage ({pct}): {amt}', { pct: C.fmtBps(inv.retainBps), amt: C.fmt(inv.retained) }));
    if (inv.release) L.push(t('Retainage released: {amt}', { amt: C.fmt(inv.release) }));
    L.push(t('AMOUNT DUE: {amt}', { amt: C.fmt(inv.due) }));
    return { title: t('Progress billing statement {num}', { num: inv.num }), lines: L, name: 'progress-bill-' + inv.num + '.txt' };
  };

  /* ---------- money: sub invoice approval ---------- */
  C.addSubInvoice = function (st, o, today) {
    if (!C.job(st, o.jobId) || !C.sub(st, o.subId)) throw new Error(t('Pick a job and a sub')); if (!(o.amount > 0)) throw new Error(t('Enter the invoice amount'));
    const si = { id: C.nid(st, 'si'), jobId: o.jobId, subId: o.subId, num: String(o.num || '').trim(), date: o.date || today, amount: o.amount, final: !!o.final, note: String(o.note || '').trim(), status: 'received', reason: '', decided: '', payId: '' };
    st.subInvoices.push(si); return si;
  };
  C.reviewSubInvoice = function (st, id, today) {
    const si = st.subInvoices.find(x => x.id === id), issues = [], warnings = [];
    const con = C.subContract(st, si.jobId, si.subId), billed = C.sumPays(st.subPays.filter(p => p.jobId === si.jobId && p.subId === si.subId)).gross, left = con - billed;
    if (!si.final && si.amount > left) issues.push(t('Asks for {a} but only {b} is left on their contract.', { a: C.fmt(si.amount), b: C.fmt(left) }));
    const tasks = C.job(st, si.jobId).tasks.filter(k => k.who && k.who.t === 'sub' && k.who.id === si.subId);
    if (si.final && tasks.some(k => k.status !== 'done')) issues.push(t('A final invoice, but some of their tasks are not marked done.'));
    if (!tasks.some(k => k.status === 'done') && con && billed + si.amount > con / 2) warnings.push(t('None of their tasks are marked done, yet this brings billing past half the contract.'));
    const s = C.sub(st, si.subId); if (C.compliance(s, today, st.company.glMin).level === 'red') warnings.push(t('{name} has expired or missing license or insurance.', { name: s.name }));
    const bcs = st.backcharges.filter(b => b.subId === si.subId && (b.status === 'open' || b.status === 'agreed'));
    if (bcs.length) warnings.push(t('{n} open backcharges ({amt}) can be deducted.', { n: bcs.length, amt: C.fmt(bcs.reduce((a, b) => a + b.amount, 0)) }));
    return { ok: !issues.length, issues, warnings, left, backcharges: bcs };
  };
  C.approveSubInvoice = function (st, id, opts, today) {
    opts = opts || {}; const si = st.subInvoices.find(x => x.id === id); if (!si || si.status !== 'received') throw new Error(t('Only received invoices can be approved'));
    const rv = C.reviewSubInvoice(st, id, today); if (!rv.ok) throw new Error(rv.issues.join(' '));
    const pay = C.addSubPay(st, { jobId: si.jobId, subId: si.subId, gross: si.final ? 0 : si.amount, final: si.final, retainBps: opts.retainBps, backcharges: opts.deduct ? rv.backcharges.map(b => b.id) : [], dueDate: C.addDays(today, st.company.subTerms), invoiceId: si.id }, today);
    si.status = 'approved'; si.decided = today; si.payId = pay.id; return pay;
  };
  C.rejectSubInvoice = function (st, id, reason, today) {
    const si = st.subInvoices.find(x => x.id === id); if (!si || si.status !== 'received') throw new Error(t('Only received invoices can be rejected'));
    if (String(reason || '').trim().length < 5) throw new Error(t('Write the reason so the sub knows what to fix'));
    si.status = 'rejected'; si.reason = String(reason).trim(); si.decided = today; return si;
  };

  /* ---------- money: backcharges and callbacks ---------- */
  C.addBackcharge = function (st, o, today) {
    if (!C.job(st, o.jobId) || !C.sub(st, o.subId)) throw new Error(t('Pick a job and a sub')); if (!String(o.desc || '').trim()) throw new Error(t('Describe what had to be fixed or cleaned up'));
    if (!(o.amount > 0)) throw new Error(t('Enter the cost'));
    const b = { id: C.nid(st, 'bc'), jobId: o.jobId, subId: o.subId, date: o.date || today, desc: o.desc.trim(), amount: o.amount, photoIds: o.photoIds || [], status: 'open', callbackId: o.callbackId || '', appliedPayId: '', notice: '' };
    st.backcharges.push(b); C.log(st, today, C.job(st, o.jobId).num + ' ' + C.sub(st, o.subId).name + ' ' + C.fmt(b.amount)); return b;
  };
  C.backchargeDoc = function (st, id, opts, today) {
    opts = Object.assign({ address: 'full' }, opts); const b = st.backcharges.find(x => x.id === id), j = C.job(st, b.jobId), s = C.sub(st, b.subId);
    return { title: t('Backcharge notice'), name: 'backcharge-' + j.num + '.txt', lines: [t('To: {name}', { name: s.name }), C.fromLine(st), t('Date: {date}', { date: C.fmtDate(today) }), '',
      t('Job: {job}, {site}', { job: j.num, site: C.siteText(j, opts.address) }), t('What we had to fix or clean up: {desc}', { desc: tt(b.desc) }), t('Date of the work: {date}', { date: C.fmtDate(b.date) }), t('Cost: {amt}', { amt: C.fmt(b.amount) }),
      tn(b.photoIds.length, 'Photo evidence: {n} photo on file.', 'Photo evidence: {n} photos on file.'), '',
      t('Under the backcharge section of our subcontract, we plan to deduct this from your next payment. If you disagree, reply in writing within 7 days.'), '',
      t('Template letter. Have a lawyer review it, and check your agreement and state law.')] };
  };
  C.addCallback = function (st, o, today) {
    if (!C.job(st, o.jobId)) throw new Error(t('Pick a job')); if (!String(o.desc || '').trim()) throw new Error(t('Describe the callback'));
    const c = { id: C.nid(st, 'cb'), jobId: o.jobId, warrantyId: o.warrantyId || '', who: o.who || { t: '', id: '' }, date: o.date || today, desc: o.desc.trim(), cost: o.cost || 0, status: 'open', backchargeId: '' };
    st.callbacks.push(c); return c;
  };
  C.callbackToBackcharge = function (st, cbId, today) {
    const c = st.callbacks.find(x => x.id === cbId); if (!c || !c.who || c.who.t !== 'sub') throw new Error(t('Only a callback caused by a sub can be backcharged'));
    if (c.backchargeId) throw new Error(t('Already backcharged')); if (!(c.cost > 0)) throw new Error(t('Enter the cost of the callback first'));
    const b = C.addBackcharge(st, { jobId: c.jobId, subId: c.who.id, desc: t('Callback: {desc}', { desc: c.desc }), amount: c.cost, callbackId: c.id }, today); c.backchargeId = b.id; return b;
  };

  /* ---------- money: reminders, markup and margin, customer messages ---------- */
  C.reminders = function (st, today) {
    const out = [];
    st.jobs.forEach(j => j.invoices.forEach(i => { if (i.paid || !C.isDate(i.dueDate)) return; const d = C.daysBetween(today, i.dueDate); if (d <= 7) out.push({ kind: 'in', level: d < 0 ? 'amber' : 'info', job: j, inv: i, days: d, amount: i.due, date: i.dueDate }); }));
    st.subPays.forEach(p => { if (p.status === 'paid' || !C.isDate(p.dueDate)) return; const d = C.daysBetween(today, p.dueDate); if (d <= 7) out.push({ kind: 'out', level: d < 0 ? 'amber' : 'info', job: C.job(st, p.jobId), pay: p, days: d, amount: p.due, date: p.dueDate, ready: C.canPaySub(st, p.id, today).ok }); });
    return out.sort((a, b) => a.days - b.days);
  };
  C.markupMargin = function (o) {
    const cost = o.cost; if (!(cost > 0)) throw new Error(t('Enter a cost above zero')); let price;
    if (o.price != null) price = o.price; else if (o.marginBps != null) { if (o.marginBps >= 10000) throw new Error(t('Margin must be under 100%')); price = C.roundDiv(cost * 10000, 10000 - o.marginBps); } else price = cost + C.roundDiv(cost * (o.markupBps || 0), 10000);
    const profit = price - cost; return { cost, price, profit, markupBps: C.roundDiv(profit * 10000, cost), marginBps: price ? C.roundDiv(profit * 10000, price) : 0 };
  };
  C.MESSAGES = [['schedule', N('Work scheduled')], ['inspection', N('Inspection day')], ['invoice', N('Invoice reminder')], ['change', N('Change order to sign')], ['done', N('Job finished')]];
  C.customerMessage = function (st, jobId, kind, today) {
    const j = C.job(st, jobId), cu = C.customer(st, j.customerId), co = st.company, hi = t('Hello {name},', { name: cu ? cu.name.split(' ')[0] : '' }), sig = t('Thank you, {co}', { co: co.name || '' }) + (co.phone ? ' ' + co.phone : ''), L = [hi, ''];
    if (kind === 'schedule') { const k = j.tasks.filter(x => C.isDate(x.start) && x.status !== 'done').sort((a, b) => a.start < b.start ? -1 : 1)[0]; L.push(k ? t('We have your job {job} on the schedule. Our crew plans to start {date}. We will text you the day before.', { job: j.num, date: C.fmtDate(k.start) }) : t('We will call you soon to schedule job {job}.', { job: j.num })); }
    else if (kind === 'inspection') { const k = j.tasks.filter(x => x.kind === 'inspection' && x.status !== 'done' && x.start).sort((a, b) => a.start < b.start ? -1 : 1)[0]; L.push(k ? t('The city inspection ({name}) is set for {date}. Please make sure the inspector can get in to the work area.', { name: tt(k.name), date: C.fmtDate(k.start) }) : t('We will let you know the inspection date as soon as it is booked.')); }
    else if (kind === 'invoice') { const i = j.invoices.find(x => !x.paid); L.push(i ? t('A friendly reminder: invoice {num} for {amt} is due {date}.', { num: i.num, amt: C.fmt(i.due), date: C.fmtDate(i.dueDate) }) : t('Your account is paid in full. Thank you.')); }
    else if (kind === 'change') { const c = j.changeOrders.find(x => x.status === 'pending'); L.push(c ? t('Change order {num} ({desc}, {amt}) needs your signature before we do that work.', { num: c.num, desc: tt(c.desc), amt: C.fmt(c.amount) }) : t('There are no change orders waiting for you.')); }
    else L.push(t('Your job {job} is finished. Our workmanship warranty is {n} year(s). If anything is not right, call us and we will come back.', { job: j.num, n: co.warrantyYears }));
    L.push('', sig);
    return { title: t('Message to customer'), lines: L, name: 'message-' + j.num + '.txt' };
  };

  /* ---------- capacity forecast: pipeline by month against crew plus sub capacity ---------- */
  C.jobProfile = function (st) {
    const wd = st.company.workDays, tot = {}; let jobs = 0;
    st.jobs.filter(j => j.stage !== 'lead' && j.tasks.some(k => k.kind !== 'inspection' && C.isDate(k.start))).forEach(j => { jobs++; j.tasks.forEach(k => { if (k.kind === 'inspection' || !C.isDate(k.start) || !k.trade) return; tot[k.trade] = (tot[k.trade] || 0) + C.workdaysIn(k.start, k.end, wd).length; }); });
    const prof = {}; Object.keys(tot).forEach(k => { prof[k] = Math.round(10 * tot[k] / jobs) / 10; });
    if (!jobs) { prof[(st.trades[1] || st.trades[0])] = 3; prof[(st.trades[2] || st.trades[0])] = 2; }
    const vals = st.jobs.filter(j => j.stage !== 'lead' && C.contractTotal(j) > 0).map(j => C.contractTotal(j));
    return { prof, jobs, avgValue: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 };
  };
  C.forecast = function (st, today, months) {
    months = months || 6; const wd = st.company.workDays, p = C.jobProfile(st), share = (st.company.subShare == null ? 50 : st.company.subShare) / 100, out = [];
    const res = C.resources(st).filter(r => r.kind === 'crew' || C.compliance(C.sub(st, r.who.id), today, st.company.glMin).level !== 'red').map(r => Object.assign({}, r, { trades: r.trades.filter(x => x !== C.INSPECTION) }));
    for (let m = 0; m < months; m++) {
      const first = C.addMonths(today.slice(0, 8) + '01', m), last = C.addDays(C.addMonths(first, 1), -1), from = m === 0 ? today : first, days = C.workdaysIn(from, last, wd).length, key = first.slice(0, 7);
      const supply = {}, demand = {};
      res.forEach(r => { if (!r.trades.length) return; const each = days * r.cap * (r.kind === 'sub' ? share : 1) / r.trades.length; r.trades.forEach(x => { supply[x] = (supply[x] || 0) + each; }); });
      C.allTasks(st).forEach(x => { const k = x.task; if (k.kind === 'inspection' || k.status === 'done' || !C.isDate(k.start) || !k.trade) return; const n = C.workdaysIn(k.start > from ? k.start : from, k.end < last ? k.end : last, wd).length; if (n) demand[k.trade] = (demand[k.trade] || 0) + n; });
      let booked = 0, weighted = 0;
      st.jobs.forEach(j => { const s = j.start || ''; if (['scheduled', 'progress', 'inspection'].indexOf(j.stage) >= 0 && s.slice(0, 7) === key) booked += C.contractTotal(j);
        if ((j.stage === 'lead' || j.stage === 'estimate') && (s ? s.slice(0, 7) === key : m === 1)) { const w = j.stage === 'lead' ? 0.25 : 0.5, v = C.contractTotal(j) || p.avgValue; weighted += Math.round(v * w);
          Object.keys(p.prof).forEach(tr => { demand[tr] = (demand[tr] || 0) + p.prof[tr] * w; }); } });
      const trades = Object.keys(p.prof).filter(tr => p.prof[tr] > 0); let take = null, neck = null, worst = Infinity;
      trades.forEach(tr => { const free = Math.max(0, (supply[tr] || 0) - (demand[tr] || 0)), can = Math.floor(free / p.prof[tr]); if (can < worst || (can === worst && (supply[tr] || 0) < (supply[neck] || 0))) { worst = can; neck = tr; } });
      take = trades.length ? worst : 0;
      const sup = Object.values(supply).reduce((a, b) => a + b, 0), dem = Object.keys(demand).filter(k => supply[k]).reduce((a, k) => a + demand[k], 0);
      out.push({ key, first, label: C.monthName(+key.slice(5, 7) - 1, true) + ' ' + key.slice(0, 4), days, supply, demand, booked, weighted, take, bottleneck: neck, util: sup ? Math.round(100 * dem / sup) : 0 });
    }
    return { months: out, profile: p };
  };

  /* ---------- plumbing estimate helpers (estimating aid only) ---------- */
  const TK = (item, qty, unit) => [item, qty, unit];
  C.FIXTURES = [
    { key: 'toilet', name: N('Toilet'), rough: 'roughFix', trim: 'toilet', ug: true, takeoff: [TK(N('3 in PVC drain pipe'), 10, N('ft')), TK(N('Closet flange'), 1, N('each')), TK(N('1/2 in PEX supply'), 15, N('ft')), TK(N('Angle stop and supply line'), 1, N('each'))] },
    { key: 'lav', name: N('Bathroom sink'), rough: 'roughFix', trim: 'lav', ug: false, takeoff: [TK(N('1-1/2 in PVC drain pipe'), 8, N('ft')), TK(N('P-trap kit'), 1, N('each')), TK(N('1/2 in PEX supply'), 30, N('ft')), TK(N('Angle stop and supply line'), 2, N('each'))] },
    { key: 'tub', name: N('Tub or shower'), rough: 'roughFix', trim: 'tub', extra: 'valve', ug: true, takeoff: [TK(N('2 in PVC drain pipe'), 10, N('ft')), TK(N('Tub drain and overflow or shower drain'), 1, N('each')), TK(N('1/2 in PEX supply'), 30, N('ft'))] },
    { key: 'ksink', name: N('Kitchen sink'), rough: 'roughFix', trim: 'ksink', ug: false, takeoff: [TK(N('2 in PVC drain pipe'), 10, N('ft')), TK(N('P-trap kit'), 1, N('each')), TK(N('1/2 in PEX supply'), 30, N('ft')), TK(N('Angle stop and supply line'), 2, N('each'))] },
    { key: 'dw', name: N('Dishwasher'), rough: '', trim: 'dw', ug: false, takeoff: [TK(N('Dishwasher supply line and elbow'), 1, N('each'))] },
    { key: 'washer', name: N('Clothes washer'), rough: 'laundry', trim: '', ug: false, takeoff: [TK(N('2 in PVC drain pipe'), 8, N('ft')), TK(N('Washer box with valves'), 1, N('each'))] },
    { key: 'hosebib', name: N('Hose bib'), rough: '', trim: 'hosebib', ug: false, takeoff: [TK(N('1/2 in PEX supply'), 20, N('ft'))] }];
  C.ASSEMBLIES = [
    { key: 'wh50', name: N('Water heater replacement, 50 gal gas'), lines: [['wh50', 1], ['exptank', 1], ['haul', 1]], takeoff: [TK(N('Gas flex connector'), 1, N('each')), TK(N('Sediment trap fittings'), 1, N('set')), TK(N('Water heater flex connectors'), 2, N('each')), TK(N('Relief valve discharge pipe'), 10, N('ft')), TK(N('Vent connector and fittings'), 1, N('set')), TK(N('Seismic straps (where required)'), 1, N('set'))] },
    { key: 'tankless', name: N('Tankless water heater, gas'), lines: [['tankless', 1], ['haul', 1], ['gasConn', 1]], takeoff: [TK(N('Isolation valve kit'), 1, N('set')), TK(N('Concentric vent kit'), 1, N('set')), TK(N('Condensate neutralizer'), 1, N('each')), TK(N('3/4 in gas pipe and fittings'), 15, N('ft'))] },
    { key: 'repipe', name: N('Repipe, per fixture point'), lines: [['pexPoint', 1]], perUnit: true, takeoff: [TK(N('1/2 in PEX supply'), 25, N('ft')), TK(N('PEX fittings and rings'), 6, N('each')), TK(N('Stub-out elbow'), 1, N('each')), TK(N('Pipe hangers'), 6, N('each'))] },
    { key: 'gasrun', name: N('Gas line to appliance, per 10 ft'), lines: [['gasFt', 10], ['gasConn', 0.1], ['gasTest', 0.1]], perUnit: true, takeoff: [TK(N('3/4 in black iron pipe'), 10, N('ft')), TK(N('Black iron fittings'), 3, N('each')), TK(N('Pipe straps'), 3, N('each'))] }];
  C.HELPER_NOTE = N('Verify against your local code and engineer; this is an estimating aid only.');
  const bookLine = (st, key, qtyMilli) => { const b = st.priceBook.find(x => x.key === key); return b ? { id: C.nid(st, 'l'), cat: b.cat, name: b.name, unit: b.unit, qty: qtyMilli, mat: b.mat, lab: b.lab, takeoff: [] } : null; };
  C.fixtureLines = function (st, counts) {
    const lines = [], add = (key, q, take) => { if (!key || q <= 0) return; let l = lines.find(x => x.key === key); if (!l) { l = bookLine(st, key, 0); if (!l) return; l.key = key; lines.push(l); } l.qty += q * 1000; if (take) take.forEach(tk => { const e = l.takeoff.find(x => x[0] === tk[0] && x[2] === tk[2]); if (e) e[1] += tk[1] * q; else l.takeoff.push([tk[0], tk[1] * q, tk[2]]); }); };
    C.FIXTURES.forEach(f => { const q = counts[f.key] | 0; if (!q) return; if (f.ug) add('ugFix', q); add(f.rough, q, f.takeoff); add(f.trim, q, f.rough ? null : f.takeoff); if (f.extra) add(f.extra, q); });
    return lines;
  };
  C.assemblyLines = function (st, key, qty) {
    const a = C.ASSEMBLIES.find(x => x.key === key); if (!a) throw new Error(t('No such assembly')); const q = Math.max(1, +qty || 1);
    return a.lines.map((x, i) => { const l = bookLine(st, x[0], Math.round(x[1] * (a.perUnit ? q : 1) * 1000)); if (l && i === 0) l.takeoff = a.takeoff.map(tk => [tk[0], tk[1] * (a.perUnit ? q : 1), tk[2]]); return l; }).filter(Boolean);
  };
  C.takeoff = function (est) { const m = {}; est.lines.forEach(l => (l.takeoff || []).forEach(tk => { const k = tk[0] + '|' + tk[2]; m[k] = m[k] || { item: tk[0], qty: 0, unit: tk[2] }; m[k].qty += tk[1]; })); return Object.values(m).sort((a, b) => a.item < b.item ? -1 : 1); };
  C.takeoffCSV = est => C.csv([[t('Material'), t('Quantity'), t('Unit')]].concat(C.takeoff(est).map(x => [tt(x.item), String(+x.qty.toFixed(2)), tt(x.unit)])).concat([[t(C.HELPER_NOTE), '', '']]));

  /* ---------- CSV import and export: subs, price book, customers ---------- */
  C.parseCSV = function (text) {
    const s = String(text || '').replace(/^﻿/, ''), rows = [], cell = v => v.replace(/^'(?=[=+\-@])/, ''); let row = [], cur = '', q = false; // undo the export's formula guard
    for (let i = 0; i < s.length; i++) { const ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(cell(cur)); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell(cur)); cur = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; } else cur += ch; }
    row.push(cell(cur)); if (row.some(x => x.trim() !== '')) rows.push(row); return rows;
  };
  const headerMap = (head, map) => { const idx = {}; head.forEach((h, i) => { const k = h.trim().toLowerCase(); Object.keys(map).forEach(f => { if (map[f].indexOf(k) >= 0 && idx[f] == null) idx[f] = i; }); }); return idx; };
  const SUBCOLS = { name: ['sub', 'name', 'business name', 'subcontratista', 'nombre'], trades: ['trades', 'oficios'], licNo: ['license no.', 'license', 'license number', 'licencia'], licState: ['license state', 'state', 'estado'],
    licExp: ['license expires', 'licencia vence'], glExp: ['gl expires', 'general liability expires', 'rc general vence'], wcExp: ['wc expires', "workers' comp expires", 'comp. laboral vence'], w9: ['w-9 on file', 'w-9', 'w9'],
    contact: ['contact', 'contacto'], phone: ['phone', 'teléfono', 'telefono'], email: ['email', 'correo'], rate: ['rate', 'rates', 'tarifa'], area: ['area', 'service area', 'zona'], notes: ['notes', 'notas'], bench: ['bench', 'lista'] };
  C.SUB_HEAD = ['Sub', 'Trades', 'License no.', 'License state', 'License expires', 'GL expires', 'WC expires', 'W-9 on file', 'Contact', 'Phone', 'Email', 'Rate', 'Area', 'Bench', 'Notes'];
  C.subsCSV = function (st, opts) {
    opts = Object.assign({ contact: false, notes: false }, opts);
    return C.csv([C.SUB_HEAD.filter(h => (opts.contact || ['Contact', 'Phone', 'Email'].indexOf(h) < 0) && (opts.notes || h !== 'Notes'))].concat(st.subs.map(s => {
      const r = [s.name, (s.trades || []).join('; '), s.licNo, s.licState, s.licExp, s.glExp, s.wcExempt ? 'exempt' : s.wcExp, s.w9 ? 'yes' : 'no']; if (opts.contact) r.push(s.contact, s.phone, s.email); r.push(s.rate, s.area, s.bench || ''); if (opts.notes) r.push(s.notes); return r; })));
  };
  C.importSubs = function (st, text, today) {
    const rows = C.parseCSV(text); if (rows.length < 2) throw new Error(t('The file has no data rows'));
    const ix = headerMap(rows[0], SUBCOLS); if (ix.name == null) throw new Error(t('No "Sub" or "Name" column found'));
    const res = { added: 0, updated: 0, skipped: [] }, g = (r, f) => ix[f] == null ? '' : String(r[ix[f]] || '').trim();
    rows.slice(1).forEach((r, i) => {
      const name = g(r, 'name'); if (!name) { res.skipped.push({ row: i + 2, reason: t('no name') }); return; }
      const rec = { name, trades: g(r, 'trades').split(/[;|]/).map(x => x.trim()).filter(Boolean), licNo: g(r, 'licNo'), licState: g(r, 'licState'), licExp: C.parseDate(g(r, 'licExp')), glExp: C.parseDate(g(r, 'glExp')),
        wcExempt: /^exempt|^exento/i.test(g(r, 'wcExp')), wcExp: C.parseDate(g(r, 'wcExp')), w9: /^(y|yes|s|sí|si|true|1)$/i.test(g(r, 'w9')), contact: g(r, 'contact'), phone: g(r, 'phone'), email: g(r, 'email'), rate: g(r, 'rate'), area: g(r, 'area'), notes: g(r, 'notes') };
      const bench = g(r, 'bench'); if (['preferred', 'backup', 'dnu'].indexOf(bench) >= 0) { rec.bench = bench; if (bench === 'dnu') rec.dnuReason = t('Imported as do not use'); }
      try { C.guard(rec); } catch (e) { res.skipped.push({ row: i + 2, reason: t('looks like a sensitive number, not imported') }); return; }
      const hit = st.subs.find(s => s.name.toLowerCase() === name.toLowerCase());
      if (hit) { Object.keys(rec).forEach(k => { if (rec[k] !== '' && !(Array.isArray(rec[k]) && !rec[k].length)) hit[k] = rec[k]; }); res.updated++; }
      else { st.subs.push(Object.assign({ id: C.nid(st, 's'), specialty: '', glLimit: '', entity: 'unknown', crews: 1, active: true, bench: '', onboard: {} }, rec)); res.added++; }
    });
    C.log(st, today, t('CSV import: {a} subs added, {u} updated', { a: res.added, u: res.updated })); return res;
  };
  C.priceBookCSV = st => C.csv([['Trade', 'Item', 'Unit', 'Material cost', 'Labor hours']].concat(st.priceBook.map(b => [b.cat, b.name, b.unit, (b.mat / 100).toFixed(2), C.fmtHrs(b.lab)])));
  C.importPriceBook = function (st, text) {
    const rows = C.parseCSV(text); if (rows.length < 2) throw new Error(t('The file has no data rows'));
    const ix = headerMap(rows[0], { cat: ['trade', 'oficio', 'category'], name: ['item', 'name', 'partida'], unit: ['unit', 'unidad'], mat: ['material cost', 'material', 'costo de material'], lab: ['labor hours', 'hours', 'horas de mano de obra', 'horas'] });
    if (ix.name == null || ix.mat == null) throw new Error(t('Needs at least "Item" and "Material cost" columns'));
    const res = { added: 0, updated: 0, skipped: [] };
    rows.slice(1).forEach((r, i) => {
      const name = String(r[ix.name] || '').trim(), mat = C.toCents(r[ix.mat]), lab = ix.lab == null ? 0 : Math.round(parseFloat(r[ix.lab] || '0') * 100);
      if (!name || isNaN(mat) || mat < 0 || isNaN(lab) || lab < 0) { res.skipped.push({ row: i + 2, reason: t('missing name or bad number') }); return; }
      const rec = { cat: ix.cat == null ? (st.trades[0]) : String(r[ix.cat] || '').trim() || st.trades[0], name, unit: ix.unit == null ? 'each' : String(r[ix.unit] || '').trim() || 'each', mat, lab, example: false };
      const hit = st.priceBook.find(b => b.name.toLowerCase() === name.toLowerCase()); if (hit) { Object.assign(hit, rec); res.updated++; } else { st.priceBook.push(Object.assign({ id: C.nid(st, 'pb'), key: '' }, rec)); res.added++; }
    });
    return res;
  };
  C.customersCSV = (st, opts) => { opts = Object.assign({ contact: true, notes: false }, opts); return C.csv([['Name'].concat(opts.contact ? ['Phone', 'Email'] : [], opts.notes ? ['Notes'] : [])].concat(st.customers.map(c => [c.name].concat(opts.contact ? [c.phone, c.email] : [], opts.notes ? [c.notes] : [])))); };
  C.importCustomers = function (st, text) {
    const rows = C.parseCSV(text); if (rows.length < 2) throw new Error(t('The file has no data rows'));
    const ix = headerMap(rows[0], { name: ['name', 'customer', 'nombre', 'cliente'], phone: ['phone', 'teléfono', 'telefono'], email: ['email', 'correo'], notes: ['notes', 'notas'] });
    if (ix.name == null) throw new Error(t('No "Name" column found'));
    const res = { added: 0, updated: 0, skipped: [] }, g = (r, f) => ix[f] == null ? '' : String(r[ix[f]] || '').trim();
    rows.slice(1).forEach((r, i) => {
      const rec = { name: g(r, 'name'), phone: g(r, 'phone'), email: g(r, 'email'), notes: g(r, 'notes') };
      if (!rec.name) { res.skipped.push({ row: i + 2, reason: t('no name') }); return; }
      try { C.guard(rec); } catch (e) { res.skipped.push({ row: i + 2, reason: t('looks like a sensitive number, not imported') }); return; }
      const hit = st.customers.find(c => c.name.toLowerCase() === rec.name.toLowerCase()); if (hit) { Object.keys(rec).forEach(k => { if (rec[k]) hit[k] = rec[k]; }); res.updated++; } else { st.customers.push(Object.assign({ id: C.nid(st, 'u') }, rec)); res.added++; }
    });
    return res;
  };

  /* ---------- alerts for the Today screen ---------- */
  C.alerts = function (st, today) {
    const out = [], add = (level, text, link, tag) => out.push({ level, text, link, tag: tag || '' });
    st.subs.filter(s => s.active !== false && s.bench !== 'dnu').forEach(s => C.compliance(s, today, st.company.glMin).items.forEach(i => {
      if (i.state === 'expired' || (i.state === 'missing' && i.hard)) add('red', s.name + ': ' + C.itemText(i), '#/sub/' + s.id, i.state === 'missing' ? t('Missing') : t('Expired'));
      else if (i.state === 'soon') add('amber', s.name + ': ' + C.itemText(i), '#/sub/' + s.id, t('{n}-day alert', { n: i.alert }));
    }));
    C.allTasks(st).forEach(x => { if (x.task.status !== 'done' && x.task.who && x.task.who.t === 'sub') { const s = C.sub(st, x.task.who.id); if (s && (s.bench === 'dnu' || C.compliance(s, today, st.company.glMin).level === 'red')) add('red', t('{job} {task} is assigned to {sub}, whose paperwork is expired or missing', { job: x.job.num, task: tt(x.task.name), sub: s.name }), '#/job/' + x.job.id, t('Assigned')); } });
    st.jobs.forEach(j => C.ripple(st, j).forEach(r => add('red', t('Delay ripple on {job}: {dep} now ends {end}, but {task} starts {start}', { job: j.num, dep: tt(r.dep.name), end: C.fmtShort(r.dep.end), task: tt(r.task.name), start: C.fmtShort(r.task.start) }), '#/job/' + j.id + '/schedule', t('Delay'))));
    C.conflicts(st).forEach(c => add('amber', t('Double-booked: {who} on {list} ({when})', { who: C.whoName(st, c.who), list: c.items.map(x => x.job.num + ' ' + tt(x.task.name)).join(t(' and ')), when: C.fmtShort(c.from) + (c.to !== c.from ? ' - ' + C.fmtShort(c.to) : '') }), '#/schedule', t('Schedule')));
    C.inspectionsToBook(st, today).forEach(x => add(x.days <= st.company.inspLead ? 'amber' : 'info', t('Book the {name} for {job} (needed {date})', { name: tt(x.task.name).toLowerCase(), job: x.job.num, date: C.fmtShort(x.task.start) }), '#/job/' + x.job.id + '/schedule', t('Book inspection')));
    C.reminders(st, today).forEach(r => add(r.level, r.kind === 'in' ? (r.days < 0 ? tn(-r.days, '{num} from {job} ({amt}) is {n} day overdue', '{num} from {job} ({amt}) is {n} days overdue', { num: r.inv.num, job: r.job.num, amt: C.fmt(r.amount) }) : t('{num} from {job} ({amt}) is due {date}', { num: r.inv.num, job: r.job.num, amt: C.fmt(r.amount), date: C.fmtShort(r.date) }))
      : t('Payment to {sub} ({amt}) due {date}', { sub: (C.sub(st, r.pay.subId) || {}).name, amt: C.fmt(r.amount), date: C.fmtShort(r.date) }) + (r.ready ? '' : ' ' + t('(waiting on a lien waiver)')), r.kind === 'in' ? '#/job/' + r.job.id + '/money' : '#/money', r.kind === 'in' ? t('Payment due') : t('Pay sub')));
    const si = st.subInvoices.filter(x => x.status === 'received'); if (si.length) add('info', tn(si.length, '{n} sub invoice waiting for approval', '{n} sub invoices waiting for approval'), '#/money/invoices', t('Sub invoice'));
    C.waiverQueue(st).forEach(x => { const s = C.sub(st, x.pay.subId), j = C.job(st, x.pay.jobId); const p = { type: C.waiverName(x.w).toLowerCase(), sub: s ? s.name : '?', amt: C.fmt(x.pay.due), job: j ? j.num : '?' }; add(x.w.cond ? 'info' : 'amber', x.w.cond ? t('Waiting on {type} from {sub} for {amt} on {job}', p) : t('Collect {type} from {sub} for {amt} on {job}', p), '#/money', t('Lien waiver')); });
    st.jobs.forEach(j => {
      j.changeOrders.filter(c => c.status === 'pending').forEach(c => add('amber', t('{job} {co} ({amt}) is not signed yet. Do not start the extra work until it is.', { job: j.num, co: c.num, amt: C.fmt(c.amount) }), '#/job/' + j.id + '/money', t('Change order')));
      j.permits.forEach(p => { if (C.isDate(p.inspDate) && !p.result) { const d = C.daysBetween(today, p.inspDate); if (d >= 0 && d <= 7) add('info', d === 0 ? t('{job} {kind} inspection today', { job: j.num, kind: tt(p.kind) }) : tn(d, '{job} {kind} inspection in {n} day', '{job} {kind} inspection in {n} days', { job: j.num, kind: tt(p.kind) }), '#/job/' + j.id + '/site', t('Inspection')); } });
    });
    st.callbacks.filter(c => c.status === 'open').forEach(c => add('amber', t('Open callback on {job}: {desc}', { job: (C.job(st, c.jobId) || {}).num, desc: tt(c.desc) }), '#/money/callbacks', t('Callback')));
    st.warranties.forEach(w => { const s = C.warrantyStatus(w, today); if (s.nextDays != null && s.nextDays <= 30) add(s.nextDays < 0 ? 'amber' : 'info', s.nextDays < 0 ? t('Warranty callback: {item} was due {date}', { item: tt(w.item), date: C.fmtShort(s.next) }) : t('Warranty callback: {item} due {date}', { item: tt(w.item), date: C.fmtShort(s.next) }), '#/warranties', t('Warranty')); });
    const obs = st.subs.filter(s => s.active !== false && s.bench !== 'dnu' && C.onboardStatus(s, st).state !== 'complete'); if (obs.length) add('info', tn(obs.length, '{n} sub has unfinished onboarding paperwork', '{n} subs have unfinished onboarding paperwork'), '#/subs', t('Onboarding'));
    const rank = { red: 0, amber: 1, info: 2 }; return out.sort((a, b) => rank[a.level] - rank[b.level]);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof globalThis !== 'undefined' ? globalThis : this);
