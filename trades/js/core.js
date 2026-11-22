/* Stark Trades 2.1. Pure logic, part 1: money, dates, presets, state, compliance, scheduling,
   estimates, quotes, change orders, retainage billing, lien waivers, job costing, 1099 prep, privacy guards, documents, crypto.
   No DOM and no network. Runs in the browser (global StarkCore) and in Node (module.exports) so the tests can use it. */
(function (root) {
  'use strict';
  const I = root.StarkI18n || require('./i18n.js');
  if (typeof module !== 'undefined' && module.exports && !Object.keys(I.ES).length) { try { require('./es.js'); } catch (e) { /* Spanish optional in Node */ } }
  const C = {}, t = I.t, tt = I.tt, tn = I.tn, N = I.N;
  C.I = I; C.t = t; C.tt = tt; C.tn = tn; C.N = N;

  /* ---------- money (integer cents) and rates (basis points) ---------- */
  C.roundDiv = function (n, d) { const s = n < 0 ? -1 : 1; n = Math.abs(n); return s * Math.floor((2 * n + d) / (2 * d)); };
  C.toCents = function (v) {
    if (typeof v === 'number') return Math.round(v * 100);
    let s = String(v == null ? '' : v).trim(); if (!s) return NaN;
    let neg = false; if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[$\s,]/g, ''); if (s[0] === '-') { neg = !neg; s = s.slice(1); }
    if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return NaN;
    const p = s.split('.'); let c = parseInt(p[0] || '0', 10) * 100 + parseInt(((p[1] || '') + '00').slice(0, 2), 10);
    if ((p[1] || '')[2] >= '5') c += 1; return neg ? -c : c;
  };
  C.fmt = function (c) { const neg = c < 0; c = Math.abs(Math.round(c || 0)); const d = Math.floor(c / 100), r = c % 100; return (neg ? '-' : '') + '$' + String(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + (r < 10 ? '0' : '') + r; };
  C.fmt0 = c => C.fmt(c).replace(/\.\d\d$/, '');
  C.toBps = function (v) { const s = String(v == null ? '' : v).replace('%', '').trim(); if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return NaN; const p = s.split('.'); return parseInt(p[0] || '0', 10) * 100 + parseInt(((p[1] || '') + '00').slice(0, 2), 10); };
  C.fmtBps = b => String(+(b / 100).toFixed(2)) + '%';
  C.toMilli = function (v) { const s = String(v == null ? '' : v).trim(); if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return NaN; const p = s.split('.'); return parseInt(p[0] || '0', 10) * 1000 + parseInt(((p[1] || '') + '000').slice(0, 3), 10); };
  C.fmtMilli = q => String(+(q / 1000).toFixed(3));
  C.fmtHrs = h => String(+(h / 100).toFixed(2));

  /* ---------- dates (YYYY-MM-DD strings, whole days) ---------- */
  C.isDate = function (s) { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))); return d.toISOString().slice(0, 10) === s; };
  const toDays = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
  const fromDays = n => new Date(n * 86400000).toISOString().slice(0, 10);
  C.daysBetween = (a, b) => toDays(b) - toDays(a);
  C.addDays = (s, n) => fromDays(toDays(s) + n);
  C.dow = s => new Date(toDays(s) * 86400000).getUTCDay();
  C.addMonths = function (s, k) { const y = +s.slice(0, 4), m = +s.slice(5, 7) - 1, d = +s.slice(8, 10); const tt2 = y * 12 + m + k, ny = Math.floor(tt2 / 12), nm = tt2 % 12; const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate(); return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(Math.min(d, last)).padStart(2, '0'); };
  C.today = function () { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const MON = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] };
  const MONL = { en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] };
  const DOWS = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] };
  C.dowName = d => DOWS[I.lang][d];
  C.monthName = (m, long) => (long ? MONL : MON)[I.lang][m];
  C.fmtDate = s => !C.isDate(s) ? '' : I.lang === 'es' ? (+s.slice(8, 10)) + ' ' + MON.es[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4) : MON.en[+s.slice(5, 7) - 1] + ' ' + (+s.slice(8, 10)) + ', ' + s.slice(0, 4);
  C.fmtShort = s => !C.isDate(s) ? '' : I.lang === 'es' ? (+s.slice(8, 10)) + ' ' + MON.es[+s.slice(5, 7) - 1] : MON.en[+s.slice(5, 7) - 1] + ' ' + (+s.slice(8, 10));
  C.isWork = (s, wd) => (wd || [1, 2, 3, 4, 5]).indexOf(C.dow(s)) >= 0;
  C.nextWork = function (s, wd) { let d = s; for (let i = 0; i < 8 && !C.isWork(d, wd); i++) d = C.addDays(d, 1); return d; };
  C.addWorkdays = function (start, n, wd) { let d = C.nextWork(start, wd), left = Math.max(1, n) - 1; while (left > 0) { d = C.addDays(d, 1); if (C.isWork(d, wd)) left--; } return d; };
  C.workdaysIn = function (a, b, wd) { const out = []; if (!C.isDate(a) || !C.isDate(b) || b < a) return out; for (let d = a; d <= b; d = C.addDays(d, 1)) if (C.isWork(d, wd)) out.push(d); return out; };
  C.overlaps = (a1, a2, b1, b2) => a1 <= b2 && b1 <= a2;
  C.parseDate = function (s) { s = String(s || '').trim(); if (C.isDate(s)) return s; const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (m) { const d = m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0'); if (C.isDate(d)) return d; } return ''; };

  /* ---------- trade presets: plumbing first; names stay editable ---------- */
  const P = (key, cat, name, unit, mat, lab) => ({ key, cat, name, unit, mat, lab, example: true });
  C.PRESETS = {
    plumbing: { label: N('Plumbing'), trades: [N('Underground'), N('Rough-in'), N('Fixtures and finish'), N('Water heater'), N('Repipe'), N('Drain and sewer'), N('Gas line'), N('Excavation'), N('Service and repair'), N('Inspection')],
      book: [P('toilet', 'Fixtures and finish', N('Toilet, standard, set and connect'), N('each'), 28000, 200), P('lav', 'Fixtures and finish', N('Bathroom faucet, install'), N('each'), 15000, 100),
        P('ksink', 'Fixtures and finish', N('Kitchen sink and faucet, install'), N('each'), 42000, 300), P('valve', 'Fixtures and finish', N('Shower valve, pressure balance'), N('each'), 22000, 400),
        P('disposal', 'Fixtures and finish', N('Garbage disposal, 3/4 hp'), N('each'), 26000, 150), P('tub', 'Fixtures and finish', N('Tub or shower base, set'), N('each'), 60000, 400),
        P('dw', 'Fixtures and finish', N('Dishwasher connection'), N('each'), 2500, 75), P('hosebib', 'Fixtures and finish', N('Hose bib, frost-free'), N('each'), 4500, 100),
        P('trimFix', 'Fixtures and finish', N('Set and trim, per fixture'), N('per fixture'), 2500, 150),
        P('bathRough', 'Rough-in', N('Bathroom rough-in, drain-waste-vent and supply'), N('per bath'), 85000, 1600), P('kitchenRough', 'Rough-in', N('Kitchen rough-in'), N('each'), 55000, 1000),
        P('laundry', 'Rough-in', N('Laundry box and standpipe'), N('each'), 18000, 400), P('roughFix', 'Rough-in', N('Rough-in, per fixture'), N('per fixture'), 12000, 300),
        P('ugFix', 'Underground', N('Underground drain, per fixture'), N('per fixture'), 9000, 250),
        P('wh50', 'Water heater', N('Gas tank water heater, 50 gal'), N('each'), 145000, 500), P('tankless', 'Water heater', N('Tankless gas water heater'), N('each'), 260000, 1000),
        P('exptank', 'Water heater', N('Thermal expansion tank'), N('each'), 9000, 50), P('haul', 'Water heater', N('Haul away old heater'), N('each'), 0, 50),
        P('pexPoint', 'Repipe', N('PEX repipe, per fixture point'), N('per point'), 9000, 150), P('mainValve', 'Repipe', N('Main shutoff valve, replace'), N('each'), 8000, 150),
        P('camera', 'Drain and sewer', N('Main line camera inspection'), N('each'), 0, 100), P('jet', 'Drain and sewer', N('Hydro-jet main line'), N('each'), 2000, 200),
        P('sewerFt', 'Drain and sewer', N('Sewer spot repair'), N('per ft'), 4500, 150), P('cleanout', 'Drain and sewer', N('Cleanout, install'), N('each'), 12000, 300),
        P('gasFt', 'Gas line', N('Gas line run, black iron'), N('per ft'), 1200, 30), P('gasConn', 'Gas line', N('Gas appliance connection'), N('each'), 6000, 100), P('gasTest', 'Gas line', N('Gas pressure test'), N('each'), 0, 100)] },
    electrical: { label: N('Electrical'), trades: [N('Rough wiring'), N('Panel and service'), N('Devices and fixtures'), N('Low voltage'), N('EV charger'), N('Trenching'), N('Service and repair'), N('Inspection')],
      book: [P('panel', 'Panel and service', N('200 A panel replacement'), N('each'), 180000, 1200), P('device', 'Devices and fixtures', N('Outlet or switch, replace'), N('each'), 1500, 50),
        P('light', 'Devices and fixtures', N('Light fixture, install'), N('each'), 9000, 100), P('circuit', 'Rough wiring', N('New circuit, 20 A'), N('each'), 12000, 300), P('ev', 'EV charger', N('Level 2 charger circuit'), N('each'), 45000, 600)] },
    hvac: { label: N('HVAC'), trades: [N('Equipment set'), N('Ductwork'), N('Refrigerant piping'), N('Controls'), N('Startup and balance'), N('Service and repair'), N('Inspection')],
      book: [P('split', 'Equipment set', N('Split system, 3 ton'), N('each'), 520000, 1600), P('duct', 'Ductwork', N('Supply run, flex'), N('each'), 9000, 150),
        P('tstat', 'Controls', N('Thermostat, install'), N('each'), 18000, 100), P('startup', 'Startup and balance', N('Startup and airflow check'), N('each'), 0, 200)] },
    gc: { label: N('General contracting'), trades: [N('Demolition'), N('Framing'), N('Plumbing'), N('Electrical'), N('HVAC'), N('Drywall'), N('Finish carpentry'), N('Painting'), N('Flooring'), N('Inspection')],
      book: [P('demo', 'Demolition', N('Bathroom demo and haul'), N('each'), 30000, 1200), P('drywall', 'Drywall', N('Hang and finish'), N('per sheet'), 2200, 100),
        P('paint', 'Painting', N('Interior room repaint'), N('per room'), 15000, 600), P('lvp', 'Flooring', N('LVP flooring'), N('per sq ft'), 350, 4)] }
  };
  C.INSPECTION = 'Inspection';
  C.STAGES = [['lead', N('Lead')], ['estimate', N('Estimate')], ['scheduled', N('Scheduled')], ['progress', N('In progress')], ['inspection', N('Inspection')], ['done', N('Done')], ['paid', N('Paid')]];
  C.stageName = k => t((C.STAGES.find(s => s[0] === k) || [k, k])[1]);

  C.newState = function (preset) {
    const pr = C.PRESETS[preset] || C.PRESETS.plumbing; let n = 1;
    return {
      app: 'stark-trades', v: 2, seq: 100, demo: false, preset: C.PRESETS[preset] ? preset : 'plumbing', trades: pr.trades.slice(),
      company: { name: '', phone: '', email: '', street: '', city: '', state: '', license: '', retainBps: 1000, markupBps: 2500, matTaxBps: 0, labRate: 9500,
        glMin: 100000000, glAgg: 200000000, autoMin: 100000000, umbrella: 0, addlInsured: true, waiverSubro: true, primaryNC: true,
        warrantyYears: 1, workDays: [1, 2, 3, 4, 5], lockMin: 10, nextJob: 1001, nextEst: 101, nextInv: 5001, nextBid: 1,
        termsDays: 15, subTerms: 30, inspLead: 3, subShare: 50, lang: 'en', lastBackup: '' },
      device: { id: '', role: 'office', lastHandoff: '', hoSalt: '', hoHash: '', hoRotate: false },
      crew: [], subs: [], customers: [], jobs: [], estimates: [], priceBook: pr.book.map(b => Object.assign({ id: 'pb' + (n++) }, b)),
      agreements: [], subPays: [], waivers: [], warranties: [], audit: [],
      ratings: [], bids: [], subInvoices: [], backcharges: [], callbacks: [], timeLog: []
    };
  };
  C.nid = (st, p) => (p || 'x') + (st.seq++);
  C.migrate = function (st) {
    const d = C.newState(st.preset);
    Object.keys(d).forEach(k => { if (st[k] == null) st[k] = d[k]; }); Object.keys(d.company).forEach(k => { if (st.company[k] == null) st.company[k] = d.company[k]; });
    Object.keys(d.device).forEach(k => { if (st.device[k] == null) st.device[k] = d.device[k]; });
    if ((st.v || 1) < 2) { // v1 -> v2: task ratings become scorecard ratings; new job collections
      st.jobs.forEach(j => j.tasks.forEach(x => { if (x.rating && x.who && x.who.t === 'sub') st.ratings.push({ id: C.nid(st, 'r'), subId: x.who.id, jobId: j.id, taskId: x.id, date: x.end || j.created, onTime: !!x.rating.onTime, quality: x.rating.quality || 3, cleanup: 3, paperwork: 3, callback: !!x.rating.callback, note: '' }); }));
      if (st.trades.indexOf('Inspection') < 0) st.trades.push('Inspection');
      st.v = 2;
    }
    st.jobs.forEach(j => { ['sov', 'punch', 'pickup', 'logs'].forEach(k => { if (!j[k]) j[k] = []; }); j.tasks.forEach(x => { if (!x.after) x.after = []; if (!x.kind) x.kind = x.trade === C.INSPECTION ? 'inspection' : 'work'; if (!x.slips) x.slips = []; }); j.invoices.forEach(i => { if (!i.dueDate) i.dueDate = C.addDays(i.date, st.company.termsDays); }); });
    st.subs.forEach(s => { if (!s.onboard) s.onboard = {}; if (s.bench == null) s.bench = ''; });
    return st;
  };
  C.log = (st, date, text) => { st.audit.unshift({ date, text }); if (st.audit.length > 400) st.audit.length = 400; };
  C.job = (st, id) => st.jobs.find(j => j.id === id);
  C.sub = (st, id) => st.subs.find(s => s.id === id);
  C.crewM = (st, id) => st.crew.find(c => c.id === id);
  C.customer = (st, id) => st.customers.find(c => c.id === id);
  C.task = (st, jobId, taskId) => { const j = C.job(st, jobId); return j && j.tasks.find(x => x.id === taskId); };
  C.whoName = (st, who) => !who || !who.t ? t('Unassigned') : who.t === 'crew' ? t('{name} (crew)', { name: (C.crewM(st, who.id) || {}).name || '?' }) : ((C.sub(st, who.id) || {}).name || '?');
  C.allTasks = st => { const out = []; st.jobs.forEach(j => j.tasks.forEach(x => out.push({ job: j, task: x }))); return out; };

  /* ---------- sub compliance: red (cannot safely work), amber (attention), green ---------- */
  C.docState = function (exp, today) {
    if (!exp || !C.isDate(exp)) return { state: 'missing', days: null, alert: null };
    const d = C.daysBetween(today, exp);
    return { state: d < 0 ? 'expired' : d <= 30 ? 'soon' : 'ok', days: d, alert: d < 0 ? null : d <= 7 ? 7 : d <= 14 ? 14 : d <= 30 ? 30 : null };
  };
  C.compliance = function (sub, today, glMin) {
    const items = [];
    const lic = sub.licNo ? C.docState(sub.licExp, today) : { state: 'missing', days: null, alert: null };
    items.push(Object.assign({ key: 'license', label: sub.licState ? t('License ({state})', { state: sub.licState }) : t('License'), hard: true }, lic));
    items.push(Object.assign({ key: 'gl', label: t('General liability insurance'), hard: true }, C.docState(sub.glExp, today)));
    if (sub.wcExempt) items.push({ key: 'wc', label: t("Workers' comp"), hard: false, state: 'exempt', days: null, alert: null });
    else items.push(Object.assign({ key: 'wc', label: t("Workers' comp insurance"), hard: true }, C.docState(sub.wcExp, today)));
    items.push({ key: 'w9', label: t('W-9 on file'), hard: false, state: sub.w9 ? 'ok' : 'missing', days: null, alert: null });
    if (glMin && sub.glLimit != null && sub.glLimit !== '' && sub.glLimit < glMin) items.push({ key: 'gllimit', label: t('GL limit below your {amt} requirement', { amt: C.fmt0(glMin) }), hard: false, state: 'low', days: null, alert: null });
    let level = 'green';
    items.forEach(i => { if (i.hard && (i.state === 'missing' || i.state === 'expired')) level = 'red'; else if (level !== 'red' && i.state !== 'ok') level = 'amber'; });
    return { level, items, problems: items.filter(i => i.state !== 'ok') };
  };
  C.itemText = function (i) {
    if (i.state === 'missing') return i.key === 'w9' ? t('No W-9 on file') : t('{label}: missing', { label: i.label });
    if (i.state === 'expired') return tn(Math.abs(i.days), '{label}: expired {n} day ago', '{label}: expired {n} days ago', { label: i.label });
    if (i.state === 'soon') return i.days === 0 ? t('{label}: expires today', { label: i.label }) : tn(i.days, '{label}: expires in {n} day', '{label}: expires in {n} days', { label: i.label });
    if (i.state === 'exempt') return t("Workers' comp: exempt. Keep the exemption certificate and ask your insurance agent how your own policy treats this sub");
    if (i.state === 'low') return i.label;
    return t('{label}: OK', { label: i.label });
  };
  C.reliability = (st, subId, today) => C.scorecard(st, subId, today || C.today());

  /* ---------- scheduling: load, double-booking, capacity, "can we take this job?" ---------- */
  const wkey = w => w.t + ':' + w.id;
  C.wkey = wkey;
  C.capOf = (st, w) => w.t === 'sub' ? Math.max(1, (C.sub(st, w.id) || {}).crews || 1) : 1;
  C.loadMap = function (st, skipTaskId) {
    const m = {}, wd = st.company.workDays;
    C.allTasks(st).forEach(x => {
      const k0 = x.task; if (!k0.who || !k0.who.t || k0.status === 'done' || k0.kind === 'inspection' || !C.isDate(k0.start) || !C.isDate(k0.end) || k0.id === skipTaskId) return;
      const k = wkey(k0.who), byDay = m[k] || (m[k] = {});
      C.workdaysIn(k0.start, k0.end, wd).forEach(d => (byDay[d] || (byDay[d] = [])).push(x));
    });
    return m;
  };
  C.conflicts = function (st) {
    const m = C.loadMap(st), out = {}, list = [];
    Object.keys(m).forEach(k => {
      const [ty, id] = k.split(':'), cap = C.capOf(st, { t: ty, id });
      Object.keys(m[k]).sort().forEach(d => {
        const xs = m[k][d]; if (xs.length <= cap) return;
        const key = k + '|' + xs.map(x => x.task.id).sort().join(',');
        if (!out[key]) { out[key] = { who: { t: ty, id }, from: d, to: d, items: xs }; list.push(out[key]); } else out[key].to = d;
      });
    });
    return list;
  };
  C.resources = function (st) {
    return st.crew.filter(c => c.active !== false).map(c => ({ who: { t: 'crew', id: c.id }, name: c.name, kind: 'crew', trades: c.skills || [], cap: 1 }))
      .concat(st.subs.filter(s => s.active !== false && s.bench !== 'dnu').map(s => ({ who: { t: 'sub', id: s.id }, name: s.name, kind: 'sub', trades: s.trades || [], cap: Math.max(1, s.crews || 1) })));
  };
  C.isFree = function (st, who, from, to, skipTaskId) {
    const m = C.loadMap(st, skipTaskId)[wkey(who)] || {}, cap = C.capOf(st, who);
    return C.workdaysIn(from, to, st.company.workDays).every(d => (m[d] || []).length < cap);
  };
  C.loadGrid = function (st, from, days, today) {
    const m = C.loadMap(st), wd = st.company.workDays, ds = [];
    for (let i = 0; i < days; i++) { const d = C.addDays(from, i); ds.push({ date: d, dow: C.dow(d), work: C.isWork(d, wd) }); }
    const rows = C.resources(st).map(r => {
      const byDay = m[wkey(r.who)] || {}; const comp = r.kind === 'sub' ? C.compliance(C.sub(st, r.who.id), today || from).level : 'green';
      return Object.assign({}, r, { comp, cells: ds.map(d => ({ date: d.date, items: byDay[d.date] || [], over: (byDay[d.date] || []).length > r.cap })) });
    });
    return { days: ds, rows };
  };
  C.assignCheck = function (st, task, who, today) {
    const hard = [], soft = [];
    if (!who || !who.t) return { hard, soft };
    if (who.t === 'sub') {
      const s = C.sub(st, who.id); if (!s) { hard.push(t('That sub is not in your roster.')); return { hard, soft }; }
      if (s.bench === 'dnu') hard.push(t('Marked do not use: {reason}', { reason: s.dnuReason || t('no reason recorded') }));
      const comp = C.compliance(s, today, st.company.glMin);
      comp.items.forEach(i => {
        if (i.hard && (i.state === 'missing' || i.state === 'expired')) hard.push(C.itemText(i) + '.');
        else if (i.state !== 'ok') soft.push(C.itemText(i) + '.');
        if (i.hard && i.state !== 'missing' && C.isDate(task.end) && i.days != null && i.days >= 0 && C.addDays(today, i.days) < task.end) soft.push(t('{label} expires {date}, before this task ends on {end}.', { label: i.label, date: C.fmtDate(C.addDays(today, i.days)), end: C.fmtDate(task.end) }));
      });
      if (s.active === false) soft.push(t('{name} is marked inactive.', { name: s.name }));
      if (task.trade && (s.trades || []).length && (s.trades || []).indexOf(task.trade) < 0) soft.push(t('{name} is not listed for {trade}.', { name: s.name, trade: tt(task.trade) }));
    } else {
      const c = C.crewM(st, who.id); if (!c) { hard.push(t('That crew member is not in your list.')); return { hard, soft }; }
      if (task.trade && (c.skills || []).length && (c.skills || []).indexOf(task.trade) < 0) soft.push(t('{name} is not listed for {trade}.', { name: c.name, trade: tt(task.trade) }));
    }
    if (C.isDate(task.start) && C.isDate(task.end)) {
      const m = C.loadMap(st, task.id)[wkey(who)] || {}, cap = C.capOf(st, who), clash = {};
      C.workdaysIn(task.start, task.end, st.company.workDays).forEach(d => { if ((m[d] || []).length >= cap) (m[d] || []).forEach(x => { clash[x.task.id] = x; }); });
      Object.keys(clash).forEach(k => { const x = clash[k]; soft.push(t('Double-booked: already on {job} {task} ({from} to {to}).', { job: x.job.num, task: tt(x.task.name), from: C.fmtShort(x.task.start), to: C.fmtShort(x.task.end) })); });
    }
    return { hard, soft };
  };
  C.assign = function (st, jobId, taskId, who, opts) {
    opts = opts || {}; const today = opts.today || C.today(); const job = C.job(st, jobId), k = job && job.tasks.find(x => x.id === taskId);
    if (!k) throw new Error(t('No such task'));
    const chk = C.assignCheck(st, k, who, today);
    if (chk.hard.length && !(opts.override && String(opts.override).trim().length >= 5)) throw new Error(t('Blocked:') + ' ' + chk.hard.join(' ') + ' ' + t('Fix the paperwork, or record a reason to override.'));
    k.who = who && who.t ? { t: who.t, id: who.id } : { t: '', id: '' };
    k.override = chk.hard.length ? { date: today, reason: String(opts.override).trim(), problems: chk.hard } : null;
    C.log(st, today, job.num + ' ' + k.name + ' -> ' + C.whoName(st, k.who) + (k.override ? ' (override: ' + k.override.reason + ')' : ''));
    return chk;
  };
  C.canTakeJob = function (st, req, today) {
    const wd = st.company.workDays, start = C.nextWork(req.start || today, wd), end = C.addDays(start, Math.max(1, req.windowDays || 21) - 1);
    const m = C.loadMap(st), reserved = {}, plan = []; let cursor = start;
    const load = (k, d) => ((m[k] || {})[d] || []).length + ((reserved[k] || {})[d] || 0);
    (req.needs || []).forEach(nd => {
      const days = Math.max(1, nd.days | 0); let best = null;
      C.resources(st).filter(r => r.trades.indexOf(nd.trade) >= 0).forEach(r => {
        const comp = r.kind === 'sub' ? C.compliance(C.sub(st, r.who.id), today, st.company.glMin).level : 'green';
        if (comp === 'red') return;
        const k = wkey(r.who);
        for (let s = C.nextWork(cursor, wd); s <= end; s = C.nextWork(C.addDays(s, 1), wd)) {
          const e = C.addWorkdays(s, days, wd); if (e > end) break;
          if (C.workdaysIn(s, e, wd).every(d => load(k, d) < r.cap)) {
            if (!best || e < best.end || (e === best.end && r.kind === 'crew' && best.kind !== 'crew')) best = { trade: nd.trade, days, who: r.who, name: r.name, kind: r.kind, comp, start: s, end: e };
            break;
          }
        }
      });
      if (best) { const k = wkey(best.who); C.workdaysIn(best.start, best.end, wd).forEach(d => { (reserved[k] || (reserved[k] = {}))[d] = ((reserved[k] || {})[d] || 0) + 1; }); cursor = C.addDays(best.end, 1); plan.push(best); }
      else plan.push({ trade: nd.trade, days, who: null });
    });
    const got = plan.filter(p => p.who).length;
    return { verdict: !plan.length ? 'no' : got === plan.length ? 'yes' : got ? 'partly' : 'no', plan, start, windowEnd: end, finish: got ? plan.filter(p => p.who).map(p => p.end).sort().pop() : null };
  };

  /* ---------- estimates ---------- */
  C.lineTotals = function (l, labRate) { const q = l.qty, mat = C.roundDiv(q * (l.mat || 0), 1000), lab = C.roundDiv(q * (l.lab || 0) * labRate, 100000); return { mat, lab, hours: C.roundDiv(q * (l.lab || 0), 1000), cost: mat + lab }; };
  C.estimateTotals = function (est) {
    let mat = 0, lab = 0, hours = 0; const cats = {};
    const lines = est.lines.map(l => { const x = C.lineTotals(l, est.labRate); mat += x.mat; lab += x.lab; hours += x.hours; const c = cats[l.cat] || (cats[l.cat] = { cat: l.cat, mat: 0, lab: 0, hours: 0 }); c.mat += x.mat; c.lab += x.lab; c.hours += x.hours; return Object.assign({}, l, x); });
    const markup = C.roundDiv((mat + lab) * (est.markupBps || 0), 10000), tax = C.roundDiv(mat * (est.taxBps || 0), 10000), total = mat + lab + markup + tax;
    const catList = Object.values(cats); let left = total;
    catList.forEach((c, i) => { c.price = i === catList.length - 1 ? left : (mat + lab ? C.roundDiv(total * (c.mat + c.lab), mat + lab) : 0); left -= c.price; });
    return { lines, mat, lab, hours, markup, tax, total, cats: catList };
  };
  C.newJob = function (st, o, today) {
    const job = { id: C.nid(st, 'j'), num: 'J-' + (st.company.nextJob++), customerId: o.customerId || '', title: o.title || t('New job'), street: o.street || '', city: o.city || '', stage: o.stage || 'lead',
      created: today, start: o.start || '', end: o.end || '', base: o.base || 0, materials: o.materials || 0, matPlan: o.matPlan || 0, other: 0, notes: o.notes || '', estimateId: o.estimateId || '', retainBps: o.retainBps || 0,
      tasks: [], changeOrders: [], invoices: [], permits: [], photos: [], sov: [], punch: [], pickup: [], logs: [] };
    st.jobs.push(job); return job;
  };
  C.newTask = (st, o) => ({ id: C.nid(st, 't'), name: o.name || o.trade || t('Task'), trade: o.trade || '', who: { t: '', id: '' }, start: o.start || '', end: o.end || '', hours: o.hours || 0, cost: o.cost || 0, bill: o.bill || 0,
    scope: o.scope || '', status: 'open', quotes: [], override: null, after: o.after || [], kind: o.kind || (o.trade === C.INSPECTION ? 'inspection' : 'work'), booked: '', slips: [] });
  C.estimateToJob = function (st, estId, today) {
    const est = st.estimates.find(e => e.id === estId); if (!est) throw new Error(t('No such estimate'));
    if (est.jobId && C.job(st, est.jobId)) return C.job(st, est.jobId);
    const x = C.estimateTotals(est); if (x.total <= 0) throw new Error(t('The estimate total is zero'));
    const job = C.newJob(st, { customerId: est.customerId, title: est.title, street: est.street, city: est.city, stage: 'scheduled', base: x.total, matPlan: x.mat, estimateId: est.id }, today);
    x.cats.forEach(c => job.tasks.push(C.newTask(st, { name: c.cat, trade: c.cat, hours: c.hours, bill: c.price, scope: est.lines.filter(l => l.cat === c.cat).map(l => C.fmtMilli(l.qty) + ' x ' + tt(l.name)).join('; ') })));
    job.sov = x.cats.map(c => ({ id: C.nid(st, 'sv'), item: c.cat, value: c.price }));
    est.jobId = job.id; est.status = 'accepted'; C.log(st, today, est.num + ' -> ' + job.num); return job;
  };

  /* ---------- quick quotes for one task ---------- */
  C.compareQuotes = function (st, task, today) {
    const rows = (task.quotes || []).map(q => { const s = C.sub(st, q.subId) || { name: '?' }; return { q, sub: s, comp: s.bench === 'dnu' ? 'red' : C.compliance(s, today, st.company.glMin).level, rel: C.scorecard(st, q.subId, today), badges: [] }; });
    const ok = rows.filter(r => r.comp !== 'red');
    const min = (arr, f) => arr.length ? arr.reduce((a, b) => f(b) < f(a) ? b : a) : null;
    const cheap = min(ok, r => r.q.price), fast = min(ok, r => r.q.days), rel = min(ok, r => -r.rel.score);
    if (cheap) cheap.badges.push(t('Lowest price')); if (fast) fast.badges.push(t('Fastest')); if (rel) rel.badges.push(t('Most reliable'));
    const value = min(ok.filter(r => r.rel.score >= 60), r => r.q.price * (300 - r.rel.score)) || cheap;
    if (value) value.badges.unshift(t('Best value'));
    rows.forEach(r => { if (r.comp === 'red') r.badges.push(t('Cannot assign: paperwork expired or missing')); });
    return { rows, best: value };
  };
  C.awardQuote = function (st, jobId, taskId, quoteId, opts) {
    const k = C.task(st, jobId, taskId); const q = k && k.quotes.find(x => x.id === quoteId); if (!q) throw new Error(t('No such quote'));
    const wd = st.company.workDays;
    if (opts && C.isDate(opts.start)) { k.start = C.nextWork(opts.start, wd); k.end = C.addWorkdays(k.start, q.days || 1, wd); }
    const chk = C.assign(st, jobId, taskId, { t: 'sub', id: q.subId }, opts);
    k.cost = q.price; k.awarded = q.id; return chk;
  };

  /* ---------- change orders and contract value ---------- */
  C.contractTotal = job => job.base + job.changeOrders.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0);
  C.addCO = function (st, jobId, o, today) {
    const job = C.job(st, jobId); if (!job) throw new Error(t('No such job')); if (!String(o.desc || '').trim()) throw new Error(t('Describe the change'));
    if (!Number.isInteger(o.amount)) throw new Error(t('Enter the price change (use a minus sign for a credit)'));
    const co = { id: C.nid(st, 'co'), num: 'CO-' + (job.changeOrders.length + 1), date: o.date || today, desc: o.desc.trim(), amount: o.amount, days: o.days | 0, status: 'pending', signedBy: '', signedDate: '' };
    job.changeOrders.push(co); C.log(st, today, job.num + ' ' + co.num + ' ' + C.fmt(co.amount)); return co;
  };
  C.signCO = function (st, jobId, coId, name, date, approve) {
    const job = C.job(st, jobId), co = job && job.changeOrders.find(c => c.id === coId); if (!co) throw new Error(t('No such change order'));
    if (co.status !== 'pending') throw new Error(t('Already {status}', { status: t(co.status) }));
    if (String(name || '').trim().length < 2) throw new Error(t('Type the name of the person signing'));
    if (!C.isDate(date)) throw new Error(t('Pick the date it was signed'));
    co.status = approve === false ? 'rejected' : 'approved'; co.signedBy = String(name).trim(); co.signedDate = date;
    if (co.status === 'approved' && co.days && C.isDate(job.end)) job.end = C.addDays(job.end, co.days);
    C.log(st, date, job.num + ' ' + co.num + ' ' + co.status + ': ' + co.signedBy); return co;
  };

  /* ---------- progress payments with retainage (customer bills and sub payments) ---------- */
  C.progressCalc = function (contract, prior, gross, retainBps, final) {
    const pg = prior.reduce((s, p) => s + p.gross, 0), pr = prior.reduce((s, p) => s + p.retained, 0), prel = prior.reduce((s, p) => s + (p.release || 0), 0);
    if (prior.some(p => p.final)) throw new Error(t('The final payment is already recorded'));
    if (final) { const g = contract - pg; if (g < 0) throw new Error(t('Already billed more than the contract')); return { gross: g, retained: 0, release: pr - prel, due: g + pr - prel, final: true }; }
    if (!(gross > 0)) throw new Error(t('Enter the value of work done this period'));
    if (pg + gross > contract) throw new Error(t('That is more than the {amt} left on the contract', { amt: C.fmt(contract - pg) }));
    const ret = C.roundDiv(gross * (retainBps || 0), 10000); return { gross, retained: ret, release: 0, due: gross - ret, final: false };
  };
  C.sumPays = ps => ({ gross: ps.reduce((s, p) => s + p.gross, 0), retained: ps.reduce((s, p) => s + p.retained, 0), released: ps.reduce((s, p) => s + (p.release || 0), 0), due: ps.reduce((s, p) => s + p.due, 0) });
  C.addInvoice = function (st, jobId, o, today) {
    const job = C.job(st, jobId); if (!job) throw new Error(t('No such job'));
    const bps = o.retainBps != null ? o.retainBps : (job.retainBps || 0);
    const r = C.progressCalc(C.contractTotal(job), job.invoices, o.gross, bps, o.final), date = o.date || today;
    const inv = Object.assign({ id: C.nid(st, 'i'), num: 'INV-' + (st.company.nextInv++), date, dueDate: C.addDays(date, st.company.termsDays), retainBps: bps, paid: false, paidDate: '', sov: o.sov || null }, r);
    job.invoices.push(inv); C.log(st, today, job.num + ' ' + inv.num + ' ' + C.fmt(inv.due)); return inv;
  };
  C.subContract = (st, jobId, subId) => { const j = C.job(st, jobId); return j ? j.tasks.filter(x => x.who && x.who.t === 'sub' && x.who.id === subId).reduce((s, x) => s + x.cost, 0) : 0; };
  C.WAIVER_NAMES = { cp: N('Conditional waiver on progress payment'), up: N('Unconditional waiver on progress payment'), cf: N('Conditional waiver on final payment'), uf: N('Unconditional waiver on final payment') };
  C.waiverType = w => (w.cond ? 'c' : 'u') + (w.final ? 'f' : 'p');
  C.waiverName = w => t(C.WAIVER_NAMES[C.waiverType(w)]);
  C.addSubPay = function (st, o, today) {
    const job = C.job(st, o.jobId), sub = C.sub(st, o.subId); if (!job || !sub) throw new Error(t('Pick a job and a sub'));
    const prior = st.subPays.filter(p => p.jobId === o.jobId && p.subId === o.subId);
    const bps = o.retainBps != null ? o.retainBps : st.company.retainBps;
    const r = C.progressCalc(C.subContract(st, o.jobId, o.subId), prior, o.gross, bps, o.final);
    const bcs = (o.backcharges || []).map(id => st.backcharges.find(b => b.id === id && b.subId === o.subId && (b.status === 'open' || b.status === 'agreed'))).filter(Boolean);
    const bc = bcs.reduce((s, b) => s + b.amount, 0); if (bc > r.due) throw new Error(t('The backcharges are more than this payment'));
    const pay = Object.assign({ id: C.nid(st, 'sp'), n: prior.length + 1, jobId: o.jobId, subId: o.subId, date: o.date || today, retainBps: bps, status: 'pending', paidDate: '', dueDate: o.dueDate || '', invoiceId: o.invoiceId || '' }, r, { backcharge: bc, due: r.due - bc });
    bcs.forEach(b => { b.status = 'applied'; b.appliedPayId = pay.id; });
    st.subPays.push(pay);
    [true, false].forEach(cond => st.waivers.push({ id: C.nid(st, 'w'), payId: pay.id, jobId: o.jobId, subId: o.subId, cond, final: !!r.final, amount: pay.due, through: pay.date, requested: cond ? today : '', received: '' }));
    C.log(st, today, job.num + ' ' + sub.name + ' #' + pay.n + ' ' + C.fmt(pay.due)); return pay;
  };
  C.canPaySub = function (st, payId, today) {
    const pay = st.subPays.find(p => p.id === payId), reasons = [], warnings = [];
    if (!pay) return { ok: false, reasons: [t('No such payment')], warnings };
    if (pay.status === 'paid') return { ok: false, reasons: [t('Already paid on {date}', { date: C.fmtDate(pay.paidDate) })], warnings };
    const ws = st.waivers.filter(w => w.payId === payId), cond = ws.find(w => w.cond);
    if (!cond || !cond.received) reasons.push(pay.final ? t('No conditional final lien waiver received for {amt}.', { amt: C.fmt(pay.due) }) : t('No conditional progress lien waiver received for {amt}.', { amt: C.fmt(pay.due) }));
    else if (cond.amount < pay.due) reasons.push(t('The conditional waiver covers {a}, less than this {b} payment.', { a: C.fmt(cond.amount), b: C.fmt(pay.due) }));
    st.subPays.filter(p => p.jobId === pay.jobId && p.subId === pay.subId && p.status === 'paid' && p.n < pay.n).forEach(p => {
      const u = st.waivers.find(w => w.payId === p.id && !w.cond);
      if (!u || !u.received) reasons.push(t('Unconditional waiver for payment #{n} ({amt}, paid {date}) not received yet.', { n: p.n, amt: C.fmt(p.due), date: C.fmtDate(p.paidDate) }));
    });
    const sub = C.sub(st, pay.subId); if (sub) { const c = C.compliance(sub, today || C.today(), st.company.glMin); if (c.level === 'red') warnings.push(t('{name} has expired or missing license or insurance. Talk to your insurance agent before paying.', { name: sub.name })); }
    return { ok: !reasons.length, reasons, warnings };
  };
  C.paySub = function (st, payId, date) {
    const chk = C.canPaySub(st, payId, date); if (!chk.ok) throw new Error(t('Not paid.') + ' ' + chk.reasons.join(' '));
    if (!C.isDate(date)) throw new Error(t('Pick the payment date'));
    const pay = st.subPays.find(p => p.id === payId); pay.status = 'paid'; pay.paidDate = date;
    const u = st.waivers.find(w => w.payId === payId && !w.cond); if (u) { u.requested = date; u.through = pay.date; }
    C.log(st, date, C.sub(st, pay.subId).name + ' ' + C.fmt(pay.due) + ' ' + C.job(st, pay.jobId).num); return pay;
  };
  C.receiveWaiver = function (st, wid, date, amount) {
    const w = st.waivers.find(x => x.id === wid); if (!w) throw new Error(t('No such waiver'));
    if (!C.isDate(date)) throw new Error(t('Pick the date you received it'));
    const pay = st.subPays.find(p => p.id === w.payId);
    if (!w.cond && pay && pay.status !== 'paid') throw new Error(t('An unconditional waiver comes after the payment clears. Collect the conditional one first.'));
    if (amount != null) { if (!(amount > 0)) throw new Error(t('Enter the waiver amount')); w.amount = amount; }
    w.received = date; return w;
  };
  C.waiverQueue = st => st.waivers.filter(w => !w.received).map(w => ({ w, pay: st.subPays.find(p => p.id === w.payId) })).filter(x => x.pay && (x.w.cond ? x.pay.status !== 'paid' : x.pay.status === 'paid'));

  /* ---------- job costing ---------- */
  C.taskCost = (st, k) => k.who && k.who.t === 'crew' ? C.roundDiv(k.hours * ((C.crewM(st, k.who.id) || {}).cost || 0), 100) : k.cost;
  C.jobCost = function (st, job) {
    const contract = C.contractTotal(job); let subs = 0, crew = 0;
    job.tasks.forEach(k => { if (k.who && k.who.t === 'crew') crew += C.taskCost(st, k); else if (k.who && k.who.t === 'sub') subs += k.cost; });
    const backch = st.backcharges.filter(b => b.jobId === job.id && b.status !== 'dropped').reduce((s, b) => s + b.amount, 0);
    const cb = st.callbacks.filter(c => c.jobId === job.id).reduce((s, c) => s + (c.cost || 0), 0);
    const mat = job.materials || job.matPlan || 0, cost = subs + crew + mat + (job.other || 0) + cb - backch, profit = contract - cost; // the estimate's materials stand in until real costs are recorded
    const inv = C.sumPays(job.invoices), pays = st.subPays.filter(p => p.jobId === job.id), sp = C.sumPays(pays);
    return { contract, subs, crew, materials: mat, matPlanned: !job.materials && !!job.matPlan, other: job.other || 0, callbacks: cb, backcharges: backch, cost, profit, marginBps: contract ? C.roundDiv(profit * 10000, contract) : 0,
      billed: inv.gross, collected: job.invoices.filter(i => i.paid).reduce((s, i) => s + i.due, 0), retainageByCustomer: inv.retained - inv.released,
      subPaid: pays.filter(p => p.status === 'paid').reduce((s, p) => s + p.due, 0), retainageHeld: sp.retained - sp.released };
  };
  C.subStats = function (st, today) {
    return st.subs.map(s => {
      let awarded = 0, bill = 0, tasks = 0; const jobs = {};
      C.allTasks(st).forEach(x => { if (x.task.who && x.task.who.t === 'sub' && x.task.who.id === s.id) { awarded += x.task.cost; bill += x.task.bill; tasks++; jobs[x.job.id] = 1; } });
      const pays = st.subPays.filter(p => p.subId === s.id), sp = C.sumPays(pays);
      return { sub: s, awarded, bill, margin: bill - awarded, tasks, jobs: Object.keys(jobs).length, paid: pays.filter(p => p.status === 'paid').reduce((a, p) => a + p.due, 0), retainHeld: sp.retained - sp.released, rel: C.scorecard(st, s.id, today), comp: C.compliance(s, today, st.company.glMin).level,
        backcharges: st.backcharges.filter(b => b.subId === s.id && b.status !== 'dropped').reduce((a, b) => a + b.amount, 0) };
    });
  };

/* full version only */
  /* ---------- warranties ---------- */
  C.warrantyStatus = function (w, today) {
    const labEnd = C.isDate(w.installed) ? C.addMonths(w.installed, 12 * (w.laborYears || 0)) : '', mfrEnd = C.isDate(w.installed) && w.mfrYears ? C.addMonths(w.installed, 12 * w.mfrYears) : '';
    const base = C.isDate(w.lastCallback) ? w.lastCallback : w.installed, next = C.isDate(base) && w.callbackMonths ? C.addMonths(base, w.callbackMonths) : '';
    return { labEnd, mfrEnd, next, nextDays: next ? C.daysBetween(today, next) : null, laborLeft: labEnd ? C.daysBetween(today, labEnd) : null };
  };

  /* ---------- privacy: refuse full SSNs, tax IDs, bank and card numbers ---------- */
  C.luhn = function (d) { let s = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; };
  const SENS = [
    [/\b\d{3}[- ]\d{2}[- ]\d{4}\b/, N('a Social Security number')],
    [/\b\d{2}-\d{7}\b/, N('an EIN (federal tax ID) number')],
    [/\b(ssn|social security|seguro social|itin|tin|ein|tax ?id|taxpayer)\b\D{0,15}\d(?:[ -]?\d){7,}/i, N('a tax ID number')],
    [/\b(routing|aba|account|acct|a\/c|iban|checking|savings|bank|cuenta|banco)\b\D{0,15}\d(?:[ -]?\d){5,}/i, N('a bank account or routing number')],
    [/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}\b/, N('an IBAN bank account number')],
    [/(?:^|[^\d-])\d{9}(?![\d-])/, N('a 9-digit number that could be a Social Security, tax ID or routing number')]
  ];
  C.findSensitive = function (text) {
    const s = String(text == null ? '' : text), out = [];
    SENS.forEach(p => { if (p[0].test(s) && out.indexOf(p[1]) < 0) out.push(p[1]); });
    const runs = s.match(/\d(?:[ -]?\d){12,18}/g) || [];
    if (runs.some(r => { const d = r.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 && C.luhn(d); })) out.push(N('a payment card number'));
    return out;
  };
  C.SENS_MSG = N('Stark Trades never stores full Social Security numbers, tax ID (EIN) digits, bank account or routing numbers, or card numbers. Keep those on paper or with your accountant. Remove it and save again.');
  C.guard = function (obj) {
    const hits = [];
    (function walk(v) { if (typeof v === 'string') C.findSensitive(v).forEach(h => { if (hits.indexOf(h) < 0) hits.push(h); }); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k])); })(obj);
    if (hits.length) throw new Error(t('Not saved. This looks like {what}.', { what: hits.map(h => t(h)).join(t(' and ')) }) + ' ' + t(C.SENS_MSG));
    return obj;
  };
  C.scrub = function (text) {
    let s = String(text);
    s = s.replace(/\d(?:[ -]?\d){12,18}/g, r => { const d = r.replace(/\D/g, ''); return d.length >= 13 && C.luhn(d) ? '[removed]' : r; });
    return s.replace(/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, '[removed]').replace(/\b\d{2}-\d{7}\b/g, '[removed]').replace(/(^|[^\d-])\d{9}(?![\d-])/g, '$1[removed]');
  };

  /* ---------- documents (plain text, printable, in the current language). Builders take redaction options ---------- */
  C.siteText = (job, mode) => mode === 'none' ? t('Site address given by phone') : mode === 'city' ? (job.city || t('City not set')) : [job.street, job.city].filter(Boolean).join(', ') || t('Address not set');
  const siteText = C.siteText;
  C.docText = doc => [doc.title, '='.repeat(Math.min(72, doc.title.length)), ''].concat(doc.lines).join('\n') + '\n';
  C.fromLine = (st, contact) => t('From: {name}', { name: (st.company.name || t('Your contractor')) + (contact !== false && st.company.phone ? ', ' + st.company.phone : '') });
  C.subPacket = function (st, subId, opts, today) {
    opts = Object.assign({ address: 'full', prices: true, contact: true, done: false }, opts); const s = C.sub(st, subId); if (!s) throw new Error(t('No such sub'));
    const L = [C.fromLine(st, opts.contact), t('Date: {date}', { date: C.fmtDate(today) }), ''];
    const mine = C.allTasks(st).filter(x => x.task.who && x.task.who.t === 'sub' && x.task.who.id === subId && (opts.done || x.task.status !== 'done'));
    if (!mine.length) L.push(t('No open tasks for you right now.'));
    mine.forEach(x => {
      const j = x.job, k = x.task;
      L.push(j.num + ': ' + tt(k.name) + (k.trade && k.trade !== k.name ? ' (' + tt(k.trade) + ')' : ''), '  ' + t('Site: {site}', { site: siteText(j, opts.address) }),
        '  ' + (k.start ? t('Dates: {from} to {to}', { from: C.fmtDate(k.start), to: C.fmtDate(k.end) }) : t('Dates: to be scheduled')));
      if (k.scope) L.push('  ' + t('Scope: {scope}', { scope: tt(k.scope) }));
      if (opts.prices) L.push('  ' + t('Your price: {amt}', { amt: C.fmt(k.cost) }));
      j.tasks.filter(z => z.kind === 'inspection' && z.after.indexOf(k.id) >= 0 && z.start).forEach(z => L.push('  ' + t('Inspection after your work: {date}', { date: C.fmtDate(z.start) })));
      j.permits.filter(p => C.isDate(p.inspDate) && !p.result).forEach(p => L.push('  ' + t('Inspection: {kind} on {date}', { kind: tt(p.kind), date: C.fmtDate(p.inspDate) })));
      L.push('');
    });
    L.push(t('Customer names and contact details are left out on purpose. Call us with any questions.'));
    return { title: t('Work orders for {name}', { name: s.name }), lines: L, name: 'work-orders-' + s.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.txt' };
  };
  C.insuranceLines = function (st) {
    const co = st.company, L = [t('- General liability: at least {occ} per occurrence and {agg} aggregate.', { occ: C.fmt0(co.glMin), agg: C.fmt0(co.glAgg) })];
    if (co.autoMin) L.push(t('- Auto liability: at least {amt} combined single limit for vehicles used on our jobs.', { amt: C.fmt0(co.autoMin) }));
    L.push(t("- Workers' compensation as your state requires, or your state's exemption certificate."));
    if (co.umbrella) L.push(t('- Umbrella or excess liability: at least {amt}.', { amt: C.fmt0(co.umbrella) }));
    if (co.addlInsured) L.push(t('- An additional insured endorsement naming {name}, for ongoing and completed operations.', { name: co.name || t('our company') }));
    if (co.waiverSubro) L.push(t('- A waiver of subrogation endorsement in our favor.'));
    if (co.primaryNC) L.push(t('- Your coverage is primary and non-contributory.'));
    return L;
  };
  C.quoteRequest = function (st, jobId, taskId, subId, opts, today) {
    opts = Object.assign({ address: 'city', dueDays: 5 }, opts); const j = C.job(st, jobId), k = C.task(st, jobId, taskId), s = C.sub(st, subId); if (!k || !s) throw new Error(t('Pick a task and a sub'));
    return { title: t('Request for quote: {task}', { task: tt(k.name) }), name: 'quote-request-' + j.num + '.txt', lines: [t('To: {name}', { name: s.name }), C.fromLine(st), t('Date: {date}', { date: C.fmtDate(today) }), '',
      t('We would like your price for the work below. Please reply by {date} with a total price, how many working days you need, and your earliest start.', { date: C.fmtDate(C.addDays(today, opts.dueDays)) }), '',
      t('Job: {job} ({site})', { job: j.num, site: siteText(j, opts.address) }), t('Work: {work}', { work: tt(k.name) }), t('Scope: {scope}', { scope: k.scope ? tt(k.scope) : t('see attached plans') }),
      k.start ? t('Target dates: {from} to {to}', { from: C.fmtDate(k.start), to: C.fmtDate(k.end) }) : t('Target dates: flexible'), '',
      t('Before any award we need a current license, insurance certificates and a W-9:')].concat(C.insuranceLines(st)) };
  };
  C.agreementDoc = function (st, jobId, subId, opts, today) {
    opts = Object.assign({ address: 'full', warrantyYears: st.company.warrantyYears, retainBps: st.company.retainBps }, opts);
    const j = C.job(st, jobId), s = C.sub(st, subId), co = st.company; if (!j || !s) throw new Error(t('Pick a job and a sub'));
    const tasks = j.tasks.filter(k => k.who && k.who.t === 'sub' && k.who.id === subId), price = tasks.reduce((a, k) => a + k.cost, 0);
    const starts = tasks.map(k => k.start).filter(Boolean).sort(), ends = tasks.map(k => k.end).filter(Boolean).sort();
    const ag = st.agreements.find(a => a.jobId === jobId && a.subId === subId && a.exclusions);
    const L = [t('TEMPLATE, HAVE A LAWYER REVIEW BEFORE USE. This is not legal advice. Subcontract, lien and indemnity law differs by state.'), '',
      t('1. Parties. {gc} ("Contractor") and {sub} ("Subcontractor").', { gc: co.name || t('[Contractor]'), sub: s.name }),
      t('2. Project. Job {job}, {site}.', { job: j.num, site: siteText(j, opts.address) }), t('3. Scope of work. Subcontractor will furnish labor and materials for:')];
    tasks.forEach(k => L.push('   - ' + tt(k.name) + (k.scope ? ': ' + tt(k.scope) : '')));
    if (!tasks.length) L.push('   - ' + t('[no tasks assigned to this sub on this job yet]'));
    if (ag) L.push('   ' + t('Excluded by Subcontractor in its bid: {list}', { list: ag.exclusions }));
    L.push(t('4. Price. {amt} total, paid as progress payments. Contractor holds back {pct} retainage from each progress payment, released with the final payment after the work is accepted.', { amt: C.fmt(price), pct: C.fmtBps(opts.retainBps) }),
      t('5. Schedule. Start {from}, finish {to}. Subcontractor tells Contractor at once about any delay.', { from: starts[0] ? C.fmtDate(starts[0]) : t('[date]'), to: ends.length ? C.fmtDate(ends[ends.length - 1]) : t('[date]') }),
      t('6. Insurance. Before starting and for the whole job, Subcontractor keeps this insurance and gives Contractor current certificates and endorsements:'));
    C.insuranceLines(st).forEach(l => L.push('   ' + l));
    L.push(t('7. Licenses and permits. Subcontractor holds and keeps every license the work requires and follows the applicable codes.'),
      t('8. Indemnity. To the extent allowed by law, Subcontractor will defend and indemnify Contractor against claims caused by the negligence or breach of Subcontractor or its workers. [Lawyer: many states limit indemnity clauses. Check yours.]'),
      tn(opts.warrantyYears, '9. Warranty. Subcontractor warrants its workmanship for {n} year from completion and fixes defects promptly at no charge.', '9. Warranty. Subcontractor warrants its workmanship for {n} years from completion and fixes defects promptly at no charge.'),
      t('10. Change orders. No extra work or price change without a written change order signed by both parties before the work is done.'),
      t("11. Lien waivers. Each payment requires a conditional lien waiver for that amount before payment and an unconditional waiver after it clears. Use your state's statutory forms where the law requires them."),
      t('12. Backcharges. If Contractor must fix or clean up Subcontractor work, Contractor gives written notice with photos and may deduct the reasonable cost from payments due.'),
      t('13. Independent contractor. Subcontractor runs its own business, controls how the work is done, and pays its own workers and taxes.'),
      '', t('Contractor: ______________________   Date: __________'), t('Subcontractor: ___________________   Date: __________'));
    return { title: t('Subcontract agreement (template): {job} / {sub}', { job: j.num, sub: s.name }), lines: L, name: 'agreement-' + j.num + '.txt', price };
  };
  C.waiverRequestDoc = function (st, waiverId, opts, today) {
    opts = Object.assign({ address: 'full' }, opts);
    const w = st.waivers.find(x => x.id === waiverId); if (!w) throw new Error(t('No such waiver'));
    const j = C.job(st, w.jobId), s = C.sub(st, w.subId), pay = st.subPays.find(p => p.id === w.payId), type = C.waiverName(w);
    return { title: t('Request for {type}', { type: type.toLowerCase() }), name: 'waiver-request-' + j.num + '-' + (pay ? pay.n : '') + '.txt', lines: [t('To: {name}', { name: s.name }), C.fromLine(st), t('Date: {date}', { date: C.fmtDate(today) }), '',
      t('Please send a signed {type} for:', { type: type.toLowerCase() }), '  ' + t('Job: {job}, {site}', { job: j.num, site: siteText(j, opts.address) }), '  ' + t('Payment: #{n}', { n: pay ? pay.n : '?' }) + (w.final ? ' ' + t('(final, includes retainage release)') : ''),
      '  ' + t('Amount: {amt}', { amt: C.fmt(w.amount) }), '  ' + t('Work through: {date}', { date: C.fmtDate(w.through) }), '',
      w.cond ? t('We release this payment as soon as we receive the signed conditional waiver.') : t('This payment has been made. Please send the unconditional waiver now. The next payment waits on it.'),
      t('If your state has a required statutory waiver form, please use that form.'), '', t('Template letter. Lien waiver rules differ by state; check with your state contractor board or a lawyer.')] };
  };
  C.estimateDoc = function (st, estId, opts, today) {
    opts = Object.assign({ address: 'full', detail: true, customer: true }, opts);
    const e = st.estimates.find(x => x.id === estId); if (!e) throw new Error(t('No such estimate'));
    const x = C.estimateTotals(e), cu = C.customer(st, e.customerId), co = st.company, L = [];
    L.push((co.name || t('Your contractor')) + (co.license ? ', ' + t('license {n}', { n: co.license }) : '') + (co.phone ? ', ' + co.phone : ''), t('Estimate {num}, {date}', { num: e.num, date: C.fmtDate(e.date) }), '');
    if (opts.customer && cu) L.push(t('For: {name}', { name: cu.name }));
    L.push(t('Site: {site}', { site: siteText(e, opts.address) }), t('Work: {work}', { work: tt(e.title) }), '');
    if (opts.detail) x.lines.forEach(l => L.push('  ' + C.fmtMilli(l.qty) + ' x ' + tt(l.name) + '   ' + C.fmt(l.cost))); else x.cats.forEach(c => L.push('  ' + tt(c.cat) + '   ' + C.fmt(c.price)));
    if (opts.detail) L.push('', t('Materials and labor: {amt}', { amt: C.fmt(x.mat + x.lab) }), t('Overhead and profit: {amt}', { amt: C.fmt(x.markup) }));
    if (x.tax) L.push(t('Tax on materials: {amt}', { amt: C.fmt(x.tax) }));
    L.push(t('TOTAL: {amt}', { amt: C.fmt(x.total) }), '', t('Valid 30 days. Permits and inspections included where listed. Hidden conditions found after work starts are priced as a written change order.'));
    return { title: t('Estimate {num}', { num: e.num }), lines: L, name: 'estimate-' + e.num + '.txt' };
  };
  C.coDoc = function (st, job, c, o) {
    const cu = C.customer(st, job.customerId), co = st.company;
    return { title: t('Change order {co}, job {job}', { co: c.num, job: job.num }), name: 'change-order-' + job.num + '-' + c.num + '.txt', lines: [(co.name || '') + (co.license ? ', ' + t('license {n}', { n: co.license }) : ''), t('Date: {date}', { date: C.fmtDate(c.date) }),
      o.customer && cu ? t('Customer: {name}', { name: cu.name }) : '', t('Site: {site}', { site: siteText(job, o.address) }), '',
      t('Change: {desc}', { desc: tt(c.desc) }), t('Price change: {amt}', { amt: C.fmt(c.amount) }), c.days ? t('Schedule change: +{n} working days', { n: c.days }) : t('Schedule change: none'),
      t('New contract total if approved: {amt}', { amt: C.fmt(C.contractTotal(job) + (c.status === 'approved' ? 0 : c.amount)) }), '',
      t('No extra work starts until this is signed.'), '', t('Customer: ______________________   Date: __________'), t('Contractor: ____________________   Date: __________')].filter(x => x !== '') };
  };
  const qcsv = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  C.csv = rows => rows.map(r => r.map(qcsv).join(',')).join('\r\n') + '\r\n';
/* full version only */
  C.jobsCSV = function (st, opts) {
    opts = Object.assign({ customer: false, address: 'city' }, opts);
    const head = [t('Job'), t('Title'), t('Stage'), t('Site'), t('Contract'), t('Cost'), t('Profit'), t('Margin')]; if (opts.customer) head.splice(2, 0, t('Customer'));
    return C.csv([head].concat(st.jobs.map(j => { const k = C.jobCost(st, j); const r = [j.num, tt(j.title), C.stageName(j.stage), siteText(j, opts.address), (k.contract / 100).toFixed(2), (k.cost / 100).toFixed(2), (k.profit / 100).toFixed(2), C.fmtBps(k.marginBps)]; if (opts.customer) r.splice(2, 0, (C.customer(st, j.customerId) || {}).name || ''); return r; })));
  };

  /* ---------- crypto: PBKDF2-SHA256 (600,000 rounds) to AES-GCM 256, context bound as additional data ---------- */
  const wc = () => root.crypto || require('node:crypto').webcrypto;
  const rnd = n => wc().getRandomValues(new Uint8Array(n));
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const te = new TextEncoder(), td = new TextDecoder();
  C.b64 = b64; C.unb64 = unb64; C.KDF_ITER = 600000; C.FORMAT = 'StarkTrades';
  C.newSalt = () => b64(rnd(16));
  C.randomId = () => Array.from(rnd(12), x => String.fromCharCode(97 + x % 26)).join(''); // letters only, so an id never looks like a 9-digit number
  /* iteration counts read from a file or from storage are bounded: below the floor is a downgrade, above the cap freezes the tab */
  C.KDF_MIN = 100000; C.KDF_MAX = 2000000;
  C.iterOk = n => Number.isInteger(n) && n >= C.KDF_MIN && n <= C.KDF_MAX;
  C.deriveKey = async function (pass, saltB64, iter, extractable) {
    const it = iter || C.KDF_ITER; if (!C.iterOk(it)) throw new Error('Unsupported key strength');
    const sub = wc().subtle, base = await sub.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return sub.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: it, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, !!extractable, ['encrypt', 'decrypt']);
  };
  /* passkey unlock (WebAuthn PRF): the authenticator's PRF output is stretched with HKDF into a wrapping key that seals the raw workspace key.
     The wrapped copy is bound (additional data) to the credential id and the vault salt, so it cannot be moved to another workspace or survive a passphrase change. */
  const PK_AD = (cred, vsalt) => C.FORMAT + '|passkey|1|' + cred + '|' + vsalt;
  async function prfKey(prf, wrapSalt) {
    const sub = wc().subtle, ikm = await sub.importKey('raw', prf, 'HKDF', false, ['deriveKey']);
    return sub.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: unb64(wrapSalt), info: te.encode(C.FORMAT + '|passkey-wrap|1') }, ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  C.wrapForPasskey = async function (rawKey, prf, cred, vsalt) {
    if (!(prf && prf.byteLength >= 32)) throw new Error('The passkey did not return a key.');
    const wrapSalt = C.newSalt(), r = await C.encBytes(await prfKey(prf, wrapSalt), new Uint8Array(rawKey), PK_AD(cred, vsalt));
    return { v: 1, cred, wrapSalt, vsalt, iv: b64(r.iv), ct: b64(r.ct) };
  };
  C.unwrapPasskey = async function (rec, prf, vsalt) {
    if (!rec || rec.v !== 1 || rec.vsalt !== vsalt || typeof rec.cred !== 'string') throw new Error('Passkey unlock is not set up for this workspace.');
    const raw = await C.decBytes(await prfKey(prf, rec.wrapSalt), { iv: unb64(rec.iv), ct: unb64(rec.ct) }, PK_AD(rec.cred, vsalt));
    return wc().subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  };
  C.encBytes = async function (key, bytes, ad) { const iv = rnd(12); const ct = new Uint8Array(await wc().subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(ad || C.FORMAT) }, key, bytes)); return { iv, ct }; };
  C.decBytes = async function (key, rec, ad) { return new Uint8Array(await wc().subtle.decrypt({ name: 'AES-GCM', iv: rec.iv, additionalData: te.encode(ad || C.FORMAT) }, key, rec.ct)); };
  C.encJSON = (key, obj, ad) => C.encBytes(key, te.encode(JSON.stringify(obj)), ad);
  C.decJSON = async (key, rec, ad) => JSON.parse(td.decode(await C.decBytes(key, rec, ad)));
  /* one sealed-file format for backups ('backup') and field handoffs ('handoff') */
  const fileAD = (kind, iter, salt) => C.FORMAT + '|' + kind + '|1|' + iter + '|' + salt;
  C.packFile = async function (kind, pass, payload, iter) {
    const salt = C.newSalt(), it = iter || C.KDF_ITER; return C.sealWithKey(kind, await C.deriveKey(pass, salt, it), salt, it, payload);
  };
  /* the same file format from a key already derived (salt and iteration count go in the header): auto-backup uses the workspace key and salt,
     so the file opens on the Restore screen with the usual passphrase */
  C.sealWithKey = async function (kind, key, salt, it, payload) {
    const r = await C.encJSON(key, payload, fileAD(kind, it, salt));
    return JSON.stringify({ format: C.FORMAT + '-' + kind, v: 1, kdf: 'PBKDF2-SHA256', iter: it, salt, iv: b64(r.iv), data: b64(r.ct) });
  };
  /* strict shape checks for anything restored or imported: size caps, no prototype-pollution keys, known types */
  const BADK = k => k === '__proto__' || k === 'constructor' || k === 'prototype';
  C.safeShape = function (v) {
    let n = 0;
    const walk = (x, d) => {
      if (++n > 3000000 || d > 24) return false;
      if (x === null || typeof x === 'boolean') return true;
      if (typeof x === 'number') return isFinite(x);
      if (typeof x === 'string') return x.length <= 200000;
      if (typeof x !== 'object') return false;
      if (Array.isArray(x)) return x.length <= 500000 && x.every(i => walk(i, d + 1));
      return Object.keys(x).every(k => !BADK(k) && walk(x[k], d + 1));
    };
    return walk(v, 0);
  };
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  /* returns '' when the workspace is sound, otherwise a plain reason. strictKeys also rejects unknown top-level keys (imports). */
  C.checkState = function (st, strictKeys) {
    if (!isObj(st) || st.app !== 'stark-trades') return t('This is not a Stark Trades backup.');
    const d = C.newState('plumbing'), bad = t('The saved data does not look right.');
    if (st.v != null && !(typeof st.v === 'number' && st.v >= 1 && st.v <= 2)) return bad;
    if (!C.safeShape(st)) return bad;
    for (const k of Object.keys(st)) {
      if (!(k in d)) { if (strictKeys) return bad; continue; }
      if (Array.isArray(d[k]) !== Array.isArray(st[k]) || typeof d[k] !== typeof st[k] || (d[k] !== null && st[k] === null)) return bad;
      if (Array.isArray(st[k]) && k !== 'trades' && !st[k].every(isObj)) return bad;
    }
    if (st.trades && !st.trades.every(x => typeof x === 'string')) return bad;
    for (const g of ['company', 'device']) { if (isObj(st[g])) for (const k of Object.keys(d[g])) if (st[g][k] != null && typeof st[g][k] !== typeof d[g][k]) return bad; }
    if (isObj(st.company) && !Array.isArray(st.company.workDays)) return bad;
    return '';
  };
  C.unpackFile = async function (kind, text, pass) {
    const bad = kind === 'backup' ? t('This is not a Stark Trades backup.') : t('This is not a Stark Trades handoff file.');
    if (typeof text !== 'string' || text.length > 400000000) throw new Error(bad);
    let f; try { f = JSON.parse(text); } catch (e) { throw new Error(bad); }
    if (!f || f.format !== C.FORMAT + '-' + kind || f.v !== 1 || !C.iterOk(f.iter) || typeof f.salt !== 'string' || typeof f.iv !== 'string' || typeof f.data !== 'string' || !f.salt || !f.iv || !f.data) throw new Error(bad);
    let out; try { const key = await C.deriveKey(pass, f.salt, f.iter); out = await C.decJSON(key, { iv: unb64(f.iv), ct: unb64(f.data) }, fileAD(kind, f.iter, f.salt)); } catch (e) { throw new Error(t('Wrong passphrase, or the file was damaged or changed.')); }
    if (!C.safeShape(out)) throw new Error(bad);
    return out;
  };
  C.packBackup = (pass, state, photos, iter) => C.packFile('backup', pass, { state, photos: photos.map(p => ({ id: p.id, b64: b64(p.bytes) })) }, iter);
  C.unpackBackup = async function (text, pass) {
    const p = await C.unpackFile('backup', text, pass);
    const why = C.checkState(p && p.state, true); if (why) throw new Error(why);
    const ph = p.photos == null ? [] : p.photos; if (!Array.isArray(ph) || ph.length > 20000 || !ph.every(x => isObj(x) && typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 100 && !BADK(x.id) && typeof x.b64 === 'string' && x.b64.length <= 40000000)) throw new Error(t('The saved data does not look right.'));
    /* decode photo by photo and yield every few, so a large restore does not freeze the tab */
    const photos = [];
    for (let i = 0; i < ph.length; i++) { try { photos.push({ id: ph[i].id, bytes: unb64(ph[i].b64) }); } catch (e) { throw new Error(t('The saved data does not look right.')); } if (i % 16 === 15) await new Promise(r => setTimeout(r, 0)); }
    return { state: p.state, photos };
  };
  C.passIssues = function (p) { const out = []; p = p || ''; if (p.length < 12) out.push(t('Use at least 12 characters. Four random words work well.')); if (/^(.)\1+$/.test(p) || /^(password|passphrase|123456|qwerty|contraseña)/i.test(p)) out.push(t('That is too easy to guess.')); return out; };

  root.StarkCore = C; if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof globalThis !== 'undefined' ? globalThis : this);
