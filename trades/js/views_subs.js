/* Stark Trades 2.1. Sub bench and scorecards, onboarding, sub detail, crew, share-with-sub,
   and the Money page: lien waivers, sub invoice approval, backcharges, callbacks, due-date reminders, markup/margin. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, t = C.t, tn = C.tn, tt = C.tt;
  const T = () => C.today();
  const ENTITIES = [['unknown', 'Not recorded'], ['Individual / sole proprietor', 'Individual / sole proprietor'], ['LLC', 'LLC'], ['Partnership', 'Partnership'], ['Corporation', 'Corporation']];
  C.N('Not recorded'); C.N('Individual / sole proprietor'); C.N('Partnership'); C.N('Corporation');

  function nextExpiry(s, d) {
    const c = C.compliance(s, d, L.st.company.glMin), x = c.items.filter(i => i.days != null).sort((a, b) => a.days - b.days)[0];
    return x ? (x.days < 0 ? t('expired {date}', { date: C.fmtShort(C.addDays(d, x.days)) }) : C.fmtShort(C.addDays(d, x.days)) + ' (' + x.days + ' d)') + ', ' + x.label : '-';
  }
  L.spark = hist => h('span', { class: 'spark', 'aria-hidden': 'true' }, hist.map(v => h('i', { class: 'h' + Math.max(1, Math.min(10, Math.round(v / 10))) })));

  /* ---------------- bench: search, scorecards, roster ---------------- */
  const Q = { trade: '', area: '', from: '', to: '', minScore: '', bench: '', freeOnly: false };
  L.routes.subs = function () {
    const st = L.st, d = T(), rows = C.benchSearch(st, { trade: Q.trade, area: Q.area, from: Q.from, to: Q.to || Q.from, minScore: +Q.minScore || 0, bench: Q.bench, freeOnly: Q.freeOnly && !!Q.from }, d);
    const set = k => e => { Q[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; L.render(); };
    const filters = h('div', { class: 'filters', id: 'bench-filters' }, L.field(t('Trade'), L.select(L.tradeOpts(t('All trades')), Q.trade, { onchange: set('trade'), id: 'f-trade' })), L.field(t('Area'), L.input({ value: Q.area, onchange: set('area'), placeholder: t('city or area'), id: 'f-area' })),
      L.field(t('Free from'), L.date(Q.from, { onchange: set('from'), id: 'f-from' })), L.field(t('to'), L.date(Q.to, { onchange: set('to') })), L.field(t('Score at least'), L.select([['', t('Any')], ['60', '60'], ['70', '70'], ['80', '80']], Q.minScore, { onchange: set('minScore'), id: 'f-score' })),
      L.field(t('List'), L.select([['', t('All but do-not-use')], ['preferred', t('Preferred')], ['backup', t('Backup')], ['dnu', t('Do not use')]], Q.bench, { onchange: set('bench'), id: 'f-bench' })), Q.from ? L.check(t('Only subs free then'), Q.freeOnly, { onchange: set('freeOnly') }) : null);
    const trs = rows.map(r => { const s = r.sub, c = C.compliance(s, d, st.company.glMin);
      return h('tr', { class: 'clickable', onclick: () => L.go('#/sub/' + s.id) }, h('td', null, h('a', { href: '#/sub/' + s.id }, h('b', null, s.name)), ' ', L.benchChip(s.bench), h('div', { class: 'fine' }, (s.trades || []).map(tt).join(', ') + (s.area ? ' · ' + s.area : ''))),
        h('td', { class: 'num' }, h('b', { class: 'score' }, r.card.score), ' ', L.trend(r.card.trend), h('div', null, L.spark(r.card.history))), h('td', null, L.compChip(r.comp), c.problems.length ? h('div', { class: 'fine' }, C.itemText(c.problems[0])) : null),
        h('td', null, nextExpiry(s, d)), h('td', null, L.chip(t(C.ONBOARD_STATE[r.onboard.state]) + ' ' + r.onboard.done + '/' + r.onboard.total, r.onboard.state === 'complete' ? 'green' : r.onboard.state === 'none' ? 'red' : 'amber')),
        r.free == null ? null : h('td', null, r.free ? L.chip(t('Free'), 'green') : L.chip(t('Booked'), 'dim')), h('td', null, tt(s.rate) || '-'));
    });
    const crewRows = st.crew.map(c => h('tr', { class: c.active === false ? 'dim' : '' }, h('td', null, h('b', null, c.name), h('div', { class: 'fine' }, tt(c.role) || '')), h('td', null, (c.skills || []).map(tt).join(', ')), L.num(C.fmt(c.cost || 0) + '/h'), h('td', { class: 'acts' }, h('button', { class: 'btn sm', type: 'button', onclick: () => crewDialog(c) }, t('Edit')))));
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('h1', null, t('Sub bench')), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => L.csvImport(t('subs'), x => C.importSubs(st, x, T())) }, t('Import CSV')),
        h('button', { class: 'btn', type: 'button', onclick: () => L.exportFlow(t('sub list (CSV)'), [{ key: 'contact', label: t('Include contact names, phones and emails'), value: false }, { key: 'notes', label: t('Include notes'), value: false }], o => ({ csv: true, text: C.subsCSV(st, o), name: 'subs.csv', title: t('Subs') }), { noPrint: true }) }, t('Export CSV')),
        h('button', { class: 'btn primary', type: 'button', id: 'add-sub', onclick: () => L.subDialog() }, t('+ Add sub')))),
      h('section', { class: 'card' }, filters, rows.length ? L.table([t('Sub'), { t: t('Score'), cls: 'num' }, t('Compliance'), t('Next expiry'), t('Onboarding'), Q.from ? t('Availability') : null, t('Rate')].filter(x => x !== null), trs, 'roster') : (st.subs.length ? L.empty(t('No subs match. Clear a filter or add a sub.'), t('Clear filters'), () => { Object.keys(Q).forEach(k => { Q[k] = k === 'freeOnly' ? false : ''; }); L.render(); }, 'clear-filters') : L.empty(t('No subs yet. Add the subs you call for work; their insurance and license dates drive the compliance alerts.'), t('+ Add sub'), () => L.subDialog(), 'empty-sub')),
        h('p', { class: 'fine' }, t('Score: 35 for on time, up to 30 for quality, 15 for cleanup, 10 for paperwork, 10 for no callback, averaged with two neutral jobs; warranty callbacks and backcharges in the last year take points off. Preferred subs are listed first.'))),
      h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('In-house crew')), h('button', { class: 'btn', type: 'button', onclick: () => crewDialog() }, t('+ Add crew member'))),
        st.crew.length ? L.table([t('Name'), t('Can do'), { t: t('Cost rate'), cls: 'num' }, ''], crewRows) : L.empty(t('Add yourself and anyone on payroll so the schedule knows who is free.'), t('+ Add crew member'), () => crewDialog(), 'empty-crew'),
        h('p', { class: 'fine' }, t('Cost rate is what an hour of that person costs you, wages plus taxes and insurance, for job costing. Stark Trades is not a payroll system.'))));
  };
  function crewDialog(c) {
    const st = L.st, isNew = !c; c = c || { name: '', role: '', skills: [], cost: 0, active: true };
    const name = L.input({ name: 'name', value: c.name }), role = L.input({ name: 'role', value: tt(c.role) }), cost = L.money(c.cost, { name: 'cost' }), act = h('input', { type: 'checkbox', checked: c.active !== false });
    const boxes = st.trades.map(x => L.check(tt(x), (c.skills || []).indexOf(x) >= 0, { value: x }));
    L.modal(isNew ? t('Add crew member') : t('Edit {name}', { name: c.name }), close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('Name'), name), L.field(t('Role'), role)), L.field(t('Cost per hour'), cost, t('Wages plus payroll taxes and insurance')), h('fieldset', { class: 'checks' }, h('legend', null, t('Can do')), boxes), h('label', { class: 'check' }, act, h('span', null, t('Active'))), L.actions(close)], () => {
      if (!name.value.trim()) throw L.bad(name, t('Enter a name'));
      const wasActive = !isNew && c.active !== false, cents = L.cents(cost.value || '0', t('the cost rate')); // validate before anything changes
      C.crewDeactivated(st, wasActive, act.checked);
      Object.assign(c, { name: name.value.trim(), role: role.value.trim() === tt(c.role) ? c.role : role.value.trim(), cost: cents, skills: boxes.map(b => b.querySelector('input')).filter(i => i.checked).map(i => i.value), active: act.checked });
      if (isNew) { c.id = C.nid(st, 'c'); st.crew.push(c); } close(); L.commit(); }), true);
  }
  L.subDialog = function (s) {
    const st = L.st, isNew = !s; s = s || { name: '', contact: '', phone: '', email: '', trades: [], specialty: '', licNo: '', licState: st.company.state || '', licExp: '', glExp: '', glLimit: st.company.glMin, wcExp: '', wcExempt: false, w9: false, entity: 'unknown', rate: '', area: '', crews: 1, notes: '', active: true, bench: '', onboard: {} };
    const I = (k, a) => L.input(Object.assign({ name: k, id: 's-' + k, value: s[k] == null ? '' : tt(s[k]) }, a));
    const f = { name: I('name'), contact: I('contact'), phone: I('phone', { type: 'tel' }), email: I('email', { type: 'email' }), specialty: I('specialty'), crews: I('crews', { inputmode: 'numeric' }), licNo: I('licNo'), licState: I('licState', { maxlength: 20 }), licExp: L.date(s.licExp, { id: 's-licExp' }),
      glExp: L.date(s.glExp, { id: 's-glExp' }), glLimit: L.money(s.glLimit, { id: 's-glLimit', name: 'glLimit' }), wcExp: L.date(s.wcExp, { id: 's-wcExp' }), wcExempt: h('input', { type: 'checkbox', checked: !!s.wcExempt, id: 's-wcExempt' }),
      w9: L.select([['no', t('No')], ['yes', t('Yes, on file')]], s.w9 ? 'yes' : 'no', { id: 's-w9' }), entity: L.select(ENTITIES.map(e => [e[0], t(e[1])]), s.entity || 'unknown'), rate: I('rate'), area: I('area'), notes: L.area(tt(s.notes), { name: 'notes', id: 's-notes' }), active: h('input', { type: 'checkbox', checked: s.active !== false }) };
    const boxes = st.trades.filter(x => x !== C.INSPECTION).map(x => L.check(tt(x), (s.trades || []).indexOf(x) >= 0, { value: x }));
    const keep = (v, old) => v === tt(old) ? old : v;
    L.modal(isNew ? t('Add sub') : t('Edit {name}', { name: s.name }), close => L.form({ id: 'sub-form' }, [
      h('div', { class: 'grid2' }, L.field(t('Business name'), f.name), L.field(t('Contact person'), f.contact)), h('div', { class: 'grid3' }, L.field(t('Phone'), f.phone), L.field(t('Email'), f.email), L.field(t('Crews they can run at once'), f.crews)),
      h('fieldset', { class: 'checks' }, h('legend', null, t('Trades')), boxes), L.field(t('Specialty'), f.specialty),
      h('h3', null, t('License')), h('div', { class: 'grid3' }, L.field(t('License number'), f.licNo), L.field(t('State'), f.licState), L.field(t('Expires'), f.licExp)),
      h('h3', null, t('Insurance certificates')), h('div', { class: 'grid3' }, L.field(t('General liability expires'), f.glExp), L.field(t('GL limit per occurrence'), f.glLimit), L.field(t("Workers' comp expires"), f.wcExp)),
      h('label', { class: 'check' }, f.wcExempt, h('span', null, t("Exempt from workers' comp (exemption certificate on file)"))),
      h('h3', null, t('Tax form')), h('div', { class: 'grid2' }, L.field(t('W-9 on file'), f.w9, t('Yes or no only. Never type the SSN or EIN here: keep the paper W-9 locked away.')), L.field(t('Entity type (from the W-9)'), f.entity)),
      h('h3', null, t('Work')), h('div', { class: 'grid2' }, L.field(t('Rates'), f.rate, t('For example $85/h, or fixed bid')), L.field(t('Service area'), f.area)), L.field(t('Notes'), f.notes), h('label', { class: 'check' }, f.active, h('span', null, t('Active'))), L.actions(close)], () => {
      if (!f.name.value.trim()) throw new Error(t('Enter the business name'));
      const crews = parseInt(f.crews.value, 10), gl = f.glLimit.value.trim() ? L.cents(f.glLimit.value, t('the GL limit')) : '';
      Object.assign(s, { name: f.name.value.trim(), contact: f.contact.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), trades: boxes.map(b => b.querySelector('input')).filter(i => i.checked).map(i => i.value), specialty: keep(f.specialty.value.trim(), s.specialty), crews: crews > 0 ? crews : 1,
        licNo: f.licNo.value.trim(), licState: f.licState.value.trim(), licExp: f.licExp.value, glExp: f.glExp.value, glLimit: gl, wcExp: f.wcExp.value, wcExempt: f.wcExempt.checked, w9: f.w9.value === 'yes', entity: f.entity.value, rate: keep(f.rate.value.trim(), s.rate), area: f.area.value.trim(), notes: keep(f.notes.value, s.notes), active: f.active.checked });
      if (isNew) { s.id = C.nid(st, 's'); st.subs.push(s); } C.log(st, T(), s.name); close(); L.commit(); if (isNew) L.go('#/sub/' + s.id);
    }), true);
  };

  /* ---------------- one sub: scorecard, bench list, onboarding, work, money ---------------- */
  L.routes.sub = function (id) {
    const st = L.st, d = T(), s = C.sub(st, id); if (!s) return L.gone(t('That sub is not here any more.'), '#/subs', t('Sub bench'));
    const c = C.compliance(s, d, st.company.glMin), r = C.scorecard(st, s.id, d), stats = C.subStats(st, d).find(x => x.sub.id === id), ob = C.onboardStatus(s, st), on = s.onboard || {};
    const tasks = C.allTasks(st).filter(x => x.task.who && x.task.who.t === 'sub' && x.task.who.id === id), rs = st.ratings.filter(x => x.subId === id).slice().sort((a, b) => a.date < b.date ? 1 : -1);
    const bench = L.select(C.BENCH.map(b => [b[0], t(b[1])]), s.bench || '', { id: 'bench-sel', 'aria-label': t('List') });
    bench.addEventListener('change', () => { if (bench.value === 'dnu') { const why = L.input({ id: 'dnu-why' }); L.modal(t('Do not use: {name}', { name: s.name }), close => L.form({}, [L.field(t('Why? This is kept on record.'), why), L.actions(close, t('Mark do not use'))], () => { C.setBench(st, s.id, 'dnu', why.value, T()); close(); L.commit(); })); } else { C.setBench(st, s.id, bench.value, '', T()); L.commit(); } });
    const obList = C.onboardItems(st).map(o => { const done = on[o[0]] || (o[0] === 'w9' && s.w9); return h('li', { class: done ? 'ok' : 'missing' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!done, disabled: o[0] === 'w9', 'data-ob': o[0], onchange: e => { if (e.target.checked) on[o[0]] = T(); else delete on[o[0]]; s.onboard = on; L.commit(); } }), h('span', null, t(o[1]))), done && on[o[0]] ? h('span', { class: 'fine' }, C.fmtShort(on[o[0]])) : null); });
    const scoreBox = (k, v, sub) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), h('div', { class: 'sub' }, sub));
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, h('a', { href: '#/subs' }, t('Sub bench')), ' / ', s.name), h('h1', null, s.name, ' ', L.compChip(c.level), ' ', L.benchChip(s.bench)), h('p', { class: 'muted' }, [(s.trades || []).map(tt).join(', '), tt(s.specialty), s.area].filter(Boolean).join('  ·  ')), s.bench === 'dnu' ? h('p', { class: 'c-red' }, t('Do not use: {reason}', { reason: tt(s.dnuReason) })) : null),
        h('div', { class: 'row' }, L.field(t('List'), bench), h('button', { class: 'btn', type: 'button', id: 'share-sub', onclick: () => L.shareSub(s.id) }, t('Share with sub')), h('button', { class: 'btn', type: 'button', onclick: () => L.go('#/subview/' + s.id) }, t('Preview sub view')), h('button', { class: 'btn primary', type: 'button', onclick: () => L.subDialog(s) }, t('Edit')))),
      h('div', { class: 'grid2' },
        h('section', { class: 'card', id: 'scorecard' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Scorecard')), h('button', { class: 'btn sm', type: 'button', id: 'rate-btn', onclick: () => rateDialog(s) }, t('Rate a job'))),
          h('div', { class: 'grid3' }, scoreBox(t('Score'), r.score, [L.trend(r.trend), ' ', tn(r.n, '{n} rated job', '{n} rated jobs')]), scoreBox(t('On time'), r.onTime == null ? '-' : r.onTime + '%', tn(r.callbacks, '{n} callback', '{n} callbacks')), scoreBox(t('Paid to date'), C.fmt0(stats.paid), t('{amt} retainage held', { amt: C.fmt(stats.retainHeld) }))),
          h('div', { class: 'grid3' }, scoreBox(t('Quality'), r.quality == null ? '-' : r.quality + '/5', ''), scoreBox(t('Cleanup'), r.cleanup == null ? '-' : r.cleanup + '/5', ''), scoreBox(t('Paperwork'), r.paperwork == null ? '-' : r.paperwork + '/5', '')),
          r.history.length ? h('div', { class: 'histo' }, L.spark(r.history), h('span', { class: 'fine' }, t('last {n} ratings, oldest first', { n: r.history.length }))) : null,
          r.penalty ? h('p', { class: 'note bad' }, t('{p} points off for {a} warranty callbacks and {b} backcharges in the last year.', { p: r.penalty, a: r.warrantyCallbacks, b: r.backcharges })) : null,
          h('p', null, h('b', null, t('Contact:') + ' '), [s.contact, s.phone, s.email].filter(Boolean).join(', ') || '-'), h('p', null, h('b', null, t('Rates:') + ' '), tt(s.rate) || '-', '  ·  ', h('b', null, 'W-9: '), s.w9 ? t('on file ({type})', { type: t(s.entity === 'unknown' ? 'Not recorded' : s.entity) }) : t('not on file')), s.notes ? h('p', { class: 'muted' }, tt(s.notes)) : null),
        h('div', { class: 'stack' },
          h('section', { class: 'card' }, h('h2', null, t('Compliance')), h('ul', { class: 'comp-list', id: 'comp-list' }, c.items.map(i => h('li', { class: i.state }, L.dot(i.state === 'ok' ? 'green' : (i.state === 'expired' || (i.hard && i.state === 'missing')) ? 'red' : 'amber'), h('span', null, C.itemText(i)), i.alert ? h('span', { class: 'tag' }, t('{n}-day alert', { n: i.alert })) : null))),
            h('p', { class: 'fine' }, t("Check the license on your state contractor board's license lookup and ask for certificates straight from the insurance agent, not only from the sub."))),
          h('section', { class: 'card', id: 'onboarding' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Onboarding')), L.chip(t(C.ONBOARD_STATE[ob.state]) + ' ' + ob.done + '/' + ob.total, ob.state === 'complete' ? 'green' : 'amber'), h('button', { class: 'btn sm', type: 'button', id: 'ob-packet', onclick: () => L.exportFlow(t('document request for {sub}', { sub: s.name }), [], () => C.onboardPacket(st, s.id, {}, T())) }, t('Document request packet'))),
            h('ul', { class: 'oblist' }, obList), h('p', { class: 'fine' }, t('Tick each item when you have it. The W-9 line follows the W-9 field (yes or no only).'))))),
      h('section', { class: 'card' }, h('h2', null, t('Ratings')), rs.length ? L.table([t('Date'), t('Job'), t('On time'), t('Quality'), t('Cleanup'), t('Paperwork'), t('Callback'), { t: t('Score'), cls: 'num' }, t('Note')], rs.map(x => h('tr', null, h('td', null, C.fmtShort(x.date)), h('td', null, (C.job(st, x.jobId) || { num: t('Earlier job') }).num), h('td', null, x.onTime ? t('yes') : L.chip(t('late'), 'amber')), h('td', null, x.quality + '/5'), h('td', null, x.cleanup + '/5'), h('td', null, x.paperwork + '/5'), h('td', null, x.callback ? L.chip(t('yes'), 'red') : t('no')), L.num(String(C.ratingScore(x))), h('td', { class: 'fine' }, tt(x.note))))) : L.empty(t('No ratings yet. Rate each job when you mark the sub’s task done.'))),
      h('section', { class: 'card' }, h('h2', null, t('Work for this sub')), tasks.length ? L.table([t('Job'), t('Task'), t('Dates'), { t: t('Price'), cls: 'num' }, t('Status'), ''], tasks.map(x => h('tr', null, h('td', null, h('a', { href: '#/job/' + x.job.id }, x.job.num)), h('td', null, tt(x.task.name)), h('td', null, x.task.start ? C.fmtShort(x.task.start) + ' - ' + C.fmtShort(x.task.end) : '-'), L.num(C.fmt(x.task.cost)),
        h('td', null, x.task.status === 'done' ? L.chip(t('Done'), 'green') : L.chip(t('Open'), 'blue')), h('td', { class: 'acts' }, h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('agreement with {sub}', { sub: s.name }), [L.addressChoice('full')], o => C.agreementDoc(st, x.job.id, s.id, o, d)) }, t('Agreement')))))) : L.empty(t('Nothing assigned yet.'))),
      h('section', { class: 'card' }, h('h2', null, t('Payments and lien waivers')), L.payTable(st.subPays.filter(p => p.subId === id)),
        st.backcharges.some(b => b.subId === id) ? [h('h3', null, t('Backcharges')), L.bcTable(st.backcharges.filter(b => b.subId === id))] : null));
  };
  function rateDialog(s) {
    const st = L.st, f = L.rateFields(), jobs = Array.from(new Set(C.allTasks(st).filter(x => x.task.who && x.task.who.id === s.id).map(x => x.job))), job = L.select([['', t('Earlier job')]].concat(jobs.map(j => [j.id, j.num + ' ' + tt(j.title)])), jobs.length ? jobs[jobs.length - 1].id : '');
    L.modal(t('Rate {name}', { name: s.name }), close => L.form({}, [L.field(t('Job'), job)].concat(L.rateBlock(f), [L.actions(close, t('Save rating'))]), () => { C.rate(st, Object.assign({ subId: s.id, jobId: job.value }, L.rateVals(f)), T()); close(); L.commit(); }));
  }

  L.shareSub = function (id) {
    const st = L.st;
    L.exportFlow(t('work orders for {sub}', { sub: C.sub(st, id).name }), [L.addressChoice('full'), { key: 'prices', label: t('Include their agreed prices'), value: true }, { key: 'contact', label: t('Include your office phone'), value: true }, { key: 'done', label: t('Include finished tasks'), value: false }], o => C.subPacket(st, id, o, T()));
  };
  L.routes.subview = function (id) {
    const st = L.st, s = C.sub(st, id); if (!s) return L.gone(t('No such sub.'), '#/subs', t('Sub bench'));
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, h('a', { href: '#/sub/' + id }, s.name), ' / ' + t('sub view')), h('h1', null, t('Sub view: {name}', { name: s.name }))), h('button', { class: 'btn primary', type: 'button', onclick: () => L.shareSub(id) }, t('Export for this sub'))),
      h('p', { class: 'note' }, t('This is everything a "share with sub" export can contain: only this sub’s tasks. No other subs, no prices from other subs, no customer names or phone numbers.')),
      h('section', { class: 'card' }, h('pre', { class: 'doc', id: 'subview-doc' }, C.scrub(C.docText(C.subPacket(st, id, { address: 'full', prices: true, contact: true }, T()))))));
  };

  /* ---------------- Money page ---------------- */
  const MTABS = [['payments', 'Payments and waivers'], ['invoices', 'Sub invoices'], ['backcharges', 'Backcharges'], ['callbacks', 'Callbacks'], ['reminders', 'Due dates'], ['calc', 'Markup and margin']];
  C.N('Payments and waivers'); C.N('Sub invoices'); C.N('Backcharges'); C.N('Callbacks'); C.N('Due dates'); C.N('Markup and margin');
  L.routes.money = function (tab) {
    tab = MTABS.find(x => x[0] === tab) ? tab : 'payments';
    const body = { payments: payTab, invoices: invTab, backcharges: bcTab, callbacks: cbTab, reminders: remTab, calc: calcTab }[tab]();
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, t('Money')), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => L.subInvoiceDialog() }, t('Record sub invoice')), h('button', { class: 'btn primary', type: 'button', onclick: () => L.payDialog() }, t('Set up a sub payment')))),
      h('div', { class: 'tabs', role: 'tablist' }, MTABS.map(x => h('a', { class: 'tab', role: 'tab', href: '#/money/' + x[0], 'aria-selected': x[0] === tab ? 'true' : 'false' }, t(x[1])))), body);
  };
  function payTab() {
    const st = L.st, d = T(), q = C.waiverQueue(st), pending = st.subPays.filter(p => p.status === 'pending'), done = st.subPays.filter(p => p.status === 'paid').slice(-10).reverse();
    return h('div', { class: 'stack' }, h('p', { class: 'note' }, h('b', null, t('The rule:') + ' '), t('no conditional lien waiver, no payment. After each payment, collect the unconditional waiver before the next one. Retainage is held from each progress payment and released with the final.') + ' ', h('a', { href: '#/limits' }, t('Lien rules differ by state.'))),
      h('section', { class: 'card' }, h('h2', null, t('Waivers to collect ({n})', { n: q.length })), q.length ? h('ul', { class: 'alerts' }, q.map(x => { const s = C.sub(st, x.pay.subId), j = C.job(st, x.pay.jobId); return h('li', { class: 'al ' + (x.w.cond ? 'info' : 'amber') }, L.dot(x.w.cond ? 'blue' : 'amber'), h('span', { class: 'grow' }, C.waiverName(x.w) + ', ' + s.name + ', ' + j.num + ', ' + C.fmt(x.w.amount)),
        h('button', { class: 'btn sm ghost', type: 'button', onclick: () => L.exportFlow(t('waiver request'), [L.addressChoice('full')], o => C.waiverRequestDoc(st, x.w.id, o, d)) }, t('Request letter'))); })) : L.allClear(t('Every waiver is in.'))),
      h('section', { class: 'card' }, h('h2', null, t('Waiting to be paid')), L.payTable(pending)), h('section', { class: 'card' }, h('h2', null, t('Recently paid')), L.payTable(done)));
  }
  L.payDialog = function (jobId) {
    const st = L.st, jobs = st.jobs.filter(j => j.tasks.some(x => x.who && x.who.t === 'sub')); if (!jobs.length) return L.toast(t('Assign a task to a sub first.'), true);
    const job = L.select(jobs.map(j => [j.id, j.num + ' ' + tt(j.title)]), jobId || jobs[0].id, { id: 'p-job' }), sub = h('select', { id: 'p-sub' }), info = h('p', { class: 'muted small' });
    const gross = L.money('', { id: 'p-gross', name: 'gross' }), final = h('input', { type: 'checkbox', id: 'p-final' }), retain = L.input({ value: C.fmtBps(st.company.retainBps).replace('%', ''), inputmode: 'decimal', name: 'retain' });
    const upd = () => { const con = C.subContract(st, job.value, sub.value), sp = C.sumPays(st.subPays.filter(p => p.jobId === job.value && p.subId === sub.value)); info.textContent = t('Sub contract {a}, billed so far {b}, retainage held {c}.', { a: C.fmt(con), b: C.fmt(sp.gross), c: C.fmt(sp.retained - sp.released) }); };
    const fill = () => { L.clear(sub); const j = C.job(st, job.value); Array.from(new Set(j.tasks.filter(x => x.who && x.who.t === 'sub').map(x => x.who.id))).forEach(id => sub.appendChild(h('option', { value: id }, C.sub(st, id).name))); upd(); };
    job.addEventListener('change', fill); sub.addEventListener('change', upd); fill();
    L.modal(t('Set up a sub payment'), close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('Job'), job), L.field(t('Sub'), sub)), info, h('div', { class: 'grid2' }, L.field(t('Value of work this period'), gross), L.field(t('Retainage %'), retain)),
      h('label', { class: 'check' }, final, h('span', null, t('Final payment: pays the rest and releases retainage'))), h('p', { class: 'fine' }, t('This creates the payment on hold, plus the two lien waivers it needs: conditional before you pay, unconditional after.')), L.actions(close, t('Set up payment'))], () => {
      const b = C.toBps(retain.value); if (isNaN(b) || b > 2000) throw new Error(t('Retainage is a percent from 0 to 20'));
      C.addSubPay(st, { jobId: job.value, subId: sub.value, gross: final.checked ? 0 : L.cents(gross.value, t('the work value')), final: final.checked, retainBps: b, dueDate: C.addDays(T(), st.company.subTerms) }, T()); close(); L.commit(); }), true);
  };

  /* sub invoices: record, review, approve or reject */
  L.subInvoiceDialog = function (jobId) {
    const st = L.st, jobs = st.jobs.filter(j => j.tasks.some(x => x.who && x.who.t === 'sub')); if (!jobs.length) return L.toast(t('Assign a task to a sub first.'), true);
    const job = L.select(jobs.map(j => [j.id, j.num + ' ' + tt(j.title)]), jobId || jobs[0].id, { id: 'si-job' }), sub = h('select', { id: 'si-sub' }), num = L.input({ name: 'num', id: 'si-num' }), amt = L.money('', { name: 'amount', id: 'si-amt' }), date = L.date(T()), final = h('input', { type: 'checkbox', id: 'si-final' }), note = L.input({ name: 'note' });
    const fill = () => { L.clear(sub); Array.from(new Set(C.job(st, job.value).tasks.filter(x => x.who && x.who.t === 'sub').map(x => x.who.id))).forEach(id => sub.appendChild(h('option', { value: id }, C.sub(st, id).name))); }; job.addEventListener('change', fill); fill();
    L.modal(t('Record sub invoice'), close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('Job'), job), L.field(t('Sub'), sub)), h('div', { class: 'grid3' }, L.field(t('Their invoice number'), num), L.field(t('Amount'), amt), L.field(t('Date'), date)), h('label', { class: 'check' }, final, h('span', null, t('Final invoice'))), L.field(t('Note'), note), L.actions(close, t('Record'))], () => {
      C.addSubInvoice(st, { jobId: job.value, subId: sub.value, num: num.value, amount: L.cents(amt.value, t('the amount')), date: date.value, final: final.checked, note: note.value }, T()); close(); L.commit(); L.go('#/money/invoices'); }), true);
  };
  function invTab() {
    const st = L.st, d = T(), rows = st.subInvoices.slice().reverse();
    return h('section', { class: 'card' }, h('h2', null, t('Sub invoices')), h('p', { class: 'muted small' }, t('Each invoice is checked against the sub’s contract, finished tasks, paperwork and open backcharges before you approve it. Approving sets up the payment, which still waits on the lien waiver.')),
      rows.length ? L.table([t('Received'), t('Job / sub'), t('Invoice'), { t: t('Amount'), cls: 'num' }, t('Status'), ''], rows.map(si => { const j = C.job(st, si.jobId), s = C.sub(st, si.subId);
        return h('tr', null, h('td', null, C.fmtShort(si.date)), h('td', null, j.num, h('div', { class: 'fine' }, s.name)), h('td', null, si.num || '-', si.final ? h('div', { class: 'fine' }, t('final')) : null, si.note ? h('div', { class: 'fine' }, tt(si.note)) : null), L.num(C.fmt(si.amount)),
          h('td', null, si.status === 'approved' ? L.chip(t('Approved {date}', { date: C.fmtShort(si.decided) }), 'green') : si.status === 'rejected' ? [L.chip(t('Rejected'), 'red'), h('div', { class: 'fine' }, si.reason)] : L.chip(t('Waiting'), 'amber')),
          h('td', { class: 'acts' }, si.status === 'received' ? h('button', { class: 'btn sm', type: 'button', 'data-review': si.id, onclick: () => reviewDialog(si) }, t('Review')) : null)); }), 'subinv') : L.empty(t('No sub invoices recorded. Record a sub’s invoice when it arrives; it is checked against their contract before you approve it.'), t('Record sub invoice'), () => L.subInvoiceDialog(), 'empty-si'));
  }
  function reviewDialog(si) {
    const st = L.st, d = T(), rv = C.reviewSubInvoice(st, si.id, d), deduct = h('input', { type: 'checkbox', id: 'si-deduct', checked: rv.backcharges.length > 0 }), reason = L.input({ id: 'si-reason' });
    L.modal(t('Review invoice {num}', { num: si.num || '' }), close => h('div', { class: 'stack', id: 'review' }, h('p', null, C.sub(st, si.subId).name + ' · ' + C.job(st, si.jobId).num + ' · ' + C.fmt(si.amount)), h('p', { class: 'muted small' }, t('Left on their contract: {amt}', { amt: C.fmt(rv.left) })),
      rv.issues.length ? h('div', { class: 'note bad' }, h('b', null, t('Cannot approve:') + ' '), h('ul', { class: 'warns' }, rv.issues.map(x => h('li', null, x)))) : h('p', { class: 'note' }, t('Within the contract.')),
      rv.warnings.length ? h('ul', { class: 'warns' }, rv.warnings.map(x => h('li', null, x))) : null, rv.backcharges.length ? h('label', { class: 'check' }, deduct, h('span', null, t('Deduct the open backcharges from this payment'))) : null,
      L.field(t('Reason, if you reject it'), reason),
      h('div', { class: 'row end' }, h('button', { class: 'btn danger', type: 'button', id: 'si-reject', onclick: () => { try { C.rejectSubInvoice(st, si.id, reason.value, d); close(); L.commit(); } catch (e) { L.toast(e.message, true); } } }, t('Reject')),
        h('button', { class: 'btn primary', type: 'button', id: 'si-approve', disabled: !rv.ok, onclick: () => { try { C.approveSubInvoice(st, si.id, { deduct: deduct.checked }, d); close(); L.commit(); L.toast(t('Approved. The payment now waits on the conditional lien waiver.')); } catch (e) { L.toast(e.message, true); } } }, t('Approve')))));
  }

  /* backcharges with photo evidence */
  L.bcTable = bcs => L.table([t('Date'), t('Job / sub'), t('What'), { t: t('Cost'), cls: 'num' }, t('Status'), ''], bcs.map(b => { const j = C.job(L.st, b.jobId), s = C.sub(L.st, b.subId);
    return h('tr', null, h('td', null, C.fmtShort(b.date)), h('td', null, j.num, h('div', { class: 'fine' }, s.name)), h('td', null, tt(b.desc), b.photoIds.length ? h('div', { class: 'thumbs' }, b.photoIds.slice(0, 3).map(id => L.photo(id))) : h('div', { class: 'fine' }, t('no photos'))), L.num(C.fmt(b.amount)),
      h('td', null, L.chip(t(b.status), b.status === 'applied' ? 'green' : b.status === 'disputed' ? 'red' : b.status === 'dropped' ? 'dim' : 'amber')),
      h('td', { class: 'acts' }, b.status !== 'applied' ? L.select([['open', t('open')], ['agreed', t('agreed')], ['disputed', t('disputed')], ['dropped', t('dropped')]], b.status, { 'aria-label': t('Status'), onchange: e => { b.status = e.target.value; L.commit(); } }) : null,
        h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('backcharge notice'), [L.addressChoice('full')], o => C.backchargeDoc(L.st, b.id, o, T())) }, t('Notice')))); }), 'bcs');
  L.backchargeDialog = function (jobId, subId) {
    const st = L.st, jobs = st.jobs.filter(j => j.tasks.some(x => x.who && x.who.t === 'sub')), job = L.select(jobs.map(j => [j.id, j.num + ' ' + tt(j.title)]), jobId || (jobs[0] || {}).id, { id: 'bc-job' }), sub = L.select(st.subs.map(s => [s.id, s.name]), subId, { id: 'bc-sub' });
    const desc = L.area('', { name: 'desc', id: 'bc-desc' }), amt = L.money('', { name: 'amount', id: 'bc-amt' }), photos = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'bc-photos' });
    L.modal(t('Backcharge a sub'), close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('Job'), job), L.field(t('Sub'), sub)), L.field(t('What had to be fixed or cleaned up'), desc), L.field(t('Cost to you'), amt), L.field(t('Photo evidence'), photos, t('Before and after photos make a backcharge stick.')),
      h('p', { class: 'fine' }, t('Send the written notice before you deduct it. Check your agreement and state law.')), L.actions(close, t('Record backcharge'))], async () => {
      const amount = L.cents(amt.value, t('the cost')), ids = await L.savePhotos(photos.files); C.addBackcharge(st, { jobId: job.value, subId: sub.value, desc: desc.value, amount, photoIds: ids }, T()); close(); L.commit(); L.go('#/money/backcharges'); }), true);
  };
  function bcTab() {
    const st = L.st;
    return h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Backcharges')), h('button', { class: 'btn', type: 'button', id: 'add-bc', onclick: () => L.backchargeDialog() }, t('+ Backcharge'))),
      h('p', { class: 'muted small' }, t('Costs you paid to fix or clean up after a sub. Agreed or open backcharges can be deducted when you approve their next invoice.')), st.backcharges.length ? L.bcTable(st.backcharges.slice().reverse()) : L.empty(t('No backcharges.'), t('+ Backcharge'), () => L.backchargeDialog()));
  }
  /* callbacks and warranty work, attributed to whoever caused them */
  function cbTab() {
    const st = L.st, d = T();
    return h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Callbacks and warranty work')), h('button', { class: 'btn', type: 'button', id: 'add-cb', onclick: () => cbDialog() }, t('+ Callback'))),
      h('p', { class: 'muted small' }, t('Record each return trip and who caused it. Callbacks charged to a sub lower their score, and can become a backcharge.')),
      st.callbacks.length ? L.table([t('Date'), t('Job'), t('What'), t('Responsible'), { t: t('Cost'), cls: 'num' }, t('Status'), ''], st.callbacks.slice().reverse().map(c => h('tr', null, h('td', null, C.fmtShort(c.date)), h('td', null, (C.job(st, c.jobId) || {}).num), h('td', null, tt(c.desc)), h('td', null, c.who && c.who.t ? C.whoName(st, c.who) : t('Not assigned')), L.num(C.fmt(c.cost)),
        h('td', null, c.status === 'done' ? L.chip(t('Done'), 'green') : L.chip(t('Open'), 'amber')), h('td', { class: 'acts' }, c.status !== 'done' ? h('button', { class: 'btn sm', type: 'button', onclick: () => { c.status = 'done'; L.commit(); } }, t('Done')) : null,
          c.who && c.who.t === 'sub' && !c.backchargeId ? h('button', { class: 'btn sm', type: 'button', onclick: () => { try { C.callbackToBackcharge(st, c.id, d); L.commit(); L.toast(t('Backcharge created')); } catch (e) { L.toast(e.message, true); } } }, t('Backcharge the sub')) : c.backchargeId ? L.chip(t('Backcharged'), 'blue') : null)))) : L.empty(t('No callbacks recorded.'), t('+ Callback'), () => cbDialog()));
  }
  function cbDialog() {
    const st = L.st, job = L.select(st.jobs.map(j => [j.id, j.num + ' ' + tt(j.title)]), (st.jobs[0] || {}).id, { id: 'cb-job' }), who = L.select(L.who().map(w => [w[0], w[0] ? w[1] : t('Not assigned')]), '', { id: 'cb-who' }), desc = L.area('', { name: 'desc', id: 'cb-desc' }), cost = L.money('', { name: 'cost' });
    L.modal(t('Record a callback'), close => L.form({}, [L.field(t('Job'), job), L.field(t('What went wrong'), desc), h('div', { class: 'grid2' }, L.field(t('Who caused it'), who), L.field(t('Cost of the return trip'), cost)), L.actions(close)], () => {
      C.addCallback(st, { jobId: job.value, who: L.parseWho(who.value), desc: desc.value, cost: cost.value ? L.cents(cost.value, t('the cost')) : 0 }, T()); close(); L.commit(); }), true);
  }
  function remTab() {
    const st = L.st, d = T(), all = [];
    st.jobs.forEach(j => j.invoices.filter(i => !i.paid).forEach(i => all.push({ kind: 'in', date: i.dueDate, j, label: i.num, amt: i.due })));
    st.subPays.filter(p => p.status !== 'paid' && p.dueDate).forEach(p => all.push({ kind: 'out', date: p.dueDate, j: C.job(st, p.jobId), label: C.sub(st, p.subId).name + ' #' + p.n, amt: p.due, ready: C.canPaySub(st, p.id, d).ok }));
    all.sort((a, b) => a.date < b.date ? -1 : 1);
    return h('section', { class: 'card' }, h('h2', null, t('Payment due dates')), h('p', { class: 'muted small' }, t('Customer invoices are due {a} days after the invoice date; approved sub invoices {b} days after approval. Change both in Settings.', { a: st.company.termsDays, b: st.company.subTerms })),
      all.length ? L.table([t('Due'), t('Who'), t('Job'), { t: t('Amount'), cls: 'num' }, t('Status')], all.map(x => { const n = C.daysBetween(d, x.date);
        return h('tr', null, h('td', null, C.fmtShort(x.date)), h('td', null, x.kind === 'in' ? t('Customer pays you: {inv}', { inv: x.label }) : t('You pay: {sub}', { sub: x.label })), h('td', null, x.j.num), L.num(C.fmt(x.amt)),
          h('td', null, n < 0 ? L.chip(tn(-n, '{n} day overdue', '{n} days overdue'), 'red') : n <= 7 ? L.chip(tn(n, 'in {n} day', 'in {n} days'), 'amber') : L.chip(tn(n, 'in {n} day', 'in {n} days'), 'dim'), x.kind === 'out' && !x.ready ? h('div', { class: 'fine' }, t('waiting on a lien waiver')) : null)); })) : L.allClear(t('Nothing due.')));
  }
  function calcTab() {
    const cost = L.money(100000, { id: 'mm-cost' }), mode = L.select([['markup', t('Markup %')], ['margin', t('Margin %')], ['price', t('Sell price')]], 'markup', { id: 'mm-mode' }), val = L.input({ id: 'mm-val', value: '25', inputmode: 'decimal' }), out = h('div', { id: 'mm-out', class: 'grid4' });
    const run = () => { L.clear(out); try { const c = L.cents(cost.value, t('the cost')), m = mode.value, r = C.markupMargin(m === 'price' ? { cost: c, price: L.cents(val.value, t('the price')) } : m === 'margin' ? { cost: c, marginBps: C.toBps(val.value) } : { cost: c, markupBps: C.toBps(val.value) });
      [[t('Sell price'), C.fmt(r.price)], [t('Profit'), C.fmt(r.profit)], [t('Markup'), C.fmtBps(r.markupBps)], [t('Margin'), C.fmtBps(r.marginBps)]].forEach(x => out.appendChild(L.stat(x[0], x[1], ''))); } catch (e) { out.appendChild(h('p', { class: 'err' }, e.message)); } };
    [cost, mode, val].forEach(x => x.addEventListener('input', run)); mode.addEventListener('change', run); run();
    return h('section', { class: 'card' }, h('h2', null, t('Markup and margin calculator')), h('div', { class: 'grid3' }, L.field(t('Your cost'), cost), L.field(t('Work from'), mode), L.field(t('Value'), val)), out,
      h('p', { class: 'fine' }, t('Markup is profit divided by cost; margin is profit divided by the sell price. A 25% markup is a 20% margin. Pricing from markup when you mean margin is a common way to underprice.')));
  }
})();
