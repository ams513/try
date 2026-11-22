/* Stark Trades 2.1. Today, job board, job detail (tasks, schedule, money, site, profit) and capacity. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, t = C.t, tn = C.tn, tt = C.tt;
  const T = () => C.today(), ACTIVE = ['scheduled', 'progress', 'inspection'];
  const stat = (k, v, sub, id) => h('div', { class: 'card stat', id }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), h('div', { class: 'sub' }, sub));
  L.stat = stat;

  /* ---------------- Today ---------------- */
  L.routes.today = function () {
    const st = L.st, d = T(), al = C.alerts(st, d), comp = { red: 0, amber: 0, green: 0 };
    st.subs.filter(s => s.active !== false && s.bench !== 'dnu').forEach(s => comp[C.compliance(s, d, st.company.glMin).level]++);
    const active = st.jobs.filter(j => ACTIVE.indexOf(j.stage) >= 0), onHand = active.reduce((s, j) => s + C.contractTotal(j), 0), leads = st.jobs.filter(j => j.stage === 'lead' || j.stage === 'estimate').length;
    const wq = C.waiverQueue(st).length, blocked = st.subPays.filter(p => p.status === 'pending' && !C.canPaySub(st, p.id, d).ok).length, fc = C.forecast(st, d, 3).months[1];
    return h('div', { class: 'stack' },
      st.demo && !window.StarkStore.trying() ? h('p', { class: 'note demo' }, h('b', null, t('Demo company.') + ' '), t('Every name, address and number here is invented. When you are ready, go to Settings and choose "Start fresh" to clear it.')) : null,
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, t('Today')), h('p', { class: 'muted' }, (st.company.name || t('Your company')) + '  ·  ' + C.fmtDate(d))),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/field' }, t('Field mode')), h('a', { class: 'btn', href: '#/schedule' }, t('Can we take a job?')), h('button', { class: 'btn primary', type: 'button', onclick: () => L.jobDialog() }, t('+ New job')))),
      h('div', { class: 'grid4' },
        stat(t('Active jobs'), String(active.length), tn(leads, '{n} lead or estimate', '{n} leads and estimates')),
        stat(t('Work on hand'), C.fmt0(onHand), t('contract value of active jobs')),
        h('div', { class: 'card stat' }, h('div', { class: 'k' }, t('Sub compliance')), h('div', { class: 'v comp3' }, h('span', { class: 'c-green' }, comp.green), h('span', { class: 'c-amber' }, comp.amber), h('span', { class: 'c-red' }, comp.red)), h('div', { class: 'sub' }, t('compliant · attention · not compliant'))),
        stat(t('Lien waivers waiting'), String(wq), tn(blocked, '{n} payment on hold until they arrive', '{n} payments on hold until they arrive'))),
      h('div', { class: 'grid2' },
        h('section', { class: 'card' }, h('h2', null, t('Needs attention')), al.length ? h('ul', { class: 'alerts', id: 'alerts' }, al.map(a => h('li', { class: 'al ' + a.level }, L.dot(a.level), h('span', { class: 'tag' }, a.tag), h('a', { href: a.link }, a.text)))) : st.jobs.length ? L.allClear(t('Nothing needs you right now.')) : L.empty(t('No jobs yet. Add your first job; late tasks, inspections, expiring sub paperwork and money due show up here.'), t('+ New job'), () => L.jobDialog(), 'empty-job')),
        h('div', { class: 'stack' }, h('section', { class: 'card' }, h('h2', null, t('Next two weeks')), L.miniGrid(d, 10), h('p', { class: 'fine' }, t('Numbers are jobs booked per person or sub crew per day. Red means double-booked.'))),
          fc ? h('a', { class: 'card outlook', href: '#/forecast' }, h('div', { class: 'k' }, t('Capacity outlook')), h('div', { class: 'big' }, tn(fc.take, 'About {n} more job in {month}', 'About {n} more jobs in {month}', { month: fc.label })), fc.bottleneck ? h('div', { class: 'sub' }, t('Bottleneck: {trade}', { trade: tt(fc.bottleneck) })) : null) : null)));
  };
  L.miniGrid = function (from, days) {
    const g = C.loadGrid(L.st, from, days, T());
    return h('div', { class: 'scroll' }, h('table', { class: 'cal mini' }, h('thead', null, h('tr', null, h('th', null, ''), g.days.map(x => h('th', { class: x.work ? '' : 'off' }, C.dowName(x.dow).slice(0, 2), h('br'), x.date.slice(8))))),
      h('tbody', null, g.rows.map(r => h('tr', null, h('th', { class: 'who' }, L.dot(r.comp), r.name.replace(' (demo)', '')), r.cells.map((c, i) => h('td', { class: (g.days[i].work ? '' : 'off ') + (c.over ? 'over' : c.items.length ? 'busy' : ''), title: c.items.map(x => x.job.num + ' ' + tt(x.task.name)).join(', ') }, c.items.length || '')))))));
  };

  /* ---------------- Jobs board ---------------- */
  L.routes.jobs = function () {
    const st = L.st, d = T();
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('h1', null, t('Jobs')), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => L.exportFlow(t('jobs list (CSV)'), [L.addressChoice('city'), { key: 'customer', label: t('Include customer names'), value: false }], o => ({ csv: true, text: C.jobsCSV(st, o), name: 'jobs.csv', title: t('Jobs') }), { noPrint: true }) }, t('Export CSV')), h('button', { class: 'btn primary', type: 'button', onclick: () => L.jobDialog() }, t('+ New job')))),
      h('div', { class: 'board', id: 'board' }, C.STAGES.map(sg => {
        const js = st.jobs.filter(j => j.stage === sg[0]);
        return h('section', { class: 'col' }, h('h2', null, t(sg[1]), h('span', { class: 'count' }, js.length)),
          js.map(j => { const cu = C.customer(st, j.customerId), red = j.tasks.some(x => x.status !== 'done' && x.who && x.who.t === 'sub' && C.compliance(C.sub(st, x.who.id) || {}, d, st.company.glMin).level === 'red'), late = C.ripple(st, j).length;
            return h('a', { class: 'jcard' + (red || late ? ' risk' : ''), href: '#/job/' + j.id }, h('div', { class: 'row' }, h('b', null, j.num), h('span', { class: 'grow' }), h('span', { class: 'amt' }, C.fmt0(C.contractTotal(j)))), h('div', { class: 'jt' }, tt(j.title)),
              h('div', { class: 'fine' }, (cu ? cu.name : t('No customer')) + (j.city ? ' · ' + j.city : '')), j.start ? h('div', { class: 'fine' }, C.fmtShort(j.start) + (j.end ? ' - ' + C.fmtShort(j.end) : '')) : null,
              j.tasks.length ? h('div', { class: 'fine' }, t('{a} of {b} tasks assigned', { a: j.tasks.filter(x => x.kind === 'inspection' || (x.who && x.who.t)).length, b: j.tasks.length })) : null,
              red ? h('div', { class: 'fine c-red' }, t('Sub paperwork problem')) : null, late ? h('div', { class: 'fine c-red' }, t('Delay ripple')) : null); }));
      })));
  };
  L.jobDialog = function (job) {
    const st = L.st, isNew = !job; job = job || { title: '', customerId: '', street: '', city: '', stage: 'lead', start: '', end: '', base: 0, notes: '' };
    const f = { title: L.input({ name: 'title', value: tt(job.title), id: 'j-title' }), cust: L.select([['', t('Choose a customer')]].concat(st.customers.map(c => [c.id, c.name])), job.customerId, { id: 'j-cust' }),
      street: L.input({ name: 'street', value: job.street }), city: L.input({ name: 'city', value: job.city }), stage: L.select(C.STAGES.map(s => [s[0], t(s[1])]), job.stage), start: L.date(job.start), end: L.date(job.end),
      base: L.money(job.base, { name: 'base', id: 'j-base' }), notes: L.area(tt(job.notes), { name: 'notes' }) };
    L.modal(isNew ? t('New job') : t('Edit {num}', { num: job.num }), close => L.form({}, [L.field(t('What is the job?'), f.title), h('div', { class: 'grid2' }, L.field(t('Customer'), f.cust, t('Add customers on the Customers page.')), L.field(t('Stage'), f.stage)),
      h('div', { class: 'grid2' }, L.field(t('Site street'), f.street), L.field(t('City'), f.city)), h('div', { class: 'grid3' }, L.field(t('Start'), f.start), L.field(t('Finish'), f.end), L.field(t('Contract price'), f.base, t('Before change orders'))), L.field(t('Notes'), f.notes), L.actions(close)], () => {
      if (!f.title.value.trim()) throw new Error(t('Give the job a name'));
      const vals = { title: f.title.value.trim() === tt(job.title) ? job.title : f.title.value.trim(), customerId: f.cust.value, street: f.street.value.trim(), city: f.city.value.trim(), stage: f.stage.value, start: f.start.value, end: f.end.value, base: L.cents(f.base.value || '0', t('the contract price')), notes: f.notes.value === tt(job.notes) ? job.notes : f.notes.value };
      if (isNew) { const j = C.newJob(st, vals, T()); close(); L.commit(); L.go('#/job/' + j.id); } else { Object.assign(job, vals); close(); L.commit(); }
    }), true);
  };

  /* ---------------- Job detail ---------------- */
  const TABS = [['tasks', 'Tasks and dispatch'], ['schedule', 'Schedule'], ['money', 'Money'], ['site', 'Site and field'], ['profit', 'Profit']];
  L.routes.job = function (id, tab) {
    const st = L.st, job = C.job(st, id); if (!job) return L.gone(t('That job is not here any more.'), '#/jobs', t('Jobs'));
    tab = TABS.find(x => x[0] === tab) ? tab : 'tasks'; const cu = C.customer(st, job.customerId);
    const stageSel = L.select(C.STAGES.map(s => [s[0], t(s[1])]), job.stage, { id: 'stage-sel', 'aria-label': t('Stage'), onchange: () => { job.stage = stageSel.value; C.log(st, T(), job.num + ' -> ' + C.stageName(job.stage)); L.commit(); } });
    const names = { tasks: t('Tasks and dispatch'), schedule: t('Schedule'), money: t('Money'), site: t('Site and field'), profit: t('Profit') };
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, h('a', { href: '#/jobs' }, t('Jobs')), ' / ', job.num), h('h1', null, tt(job.title)),
        h('p', { class: 'muted' }, (cu ? cu.name : t('No customer')) + '  ·  ' + ([job.street, job.city].filter(Boolean).join(', ') || t('no site address')) + (job.start ? '  ·  ' + C.fmtShort(job.start) + ' - ' + C.fmtShort(job.end) : ''))),
        h('div', { class: 'row' }, L.field(t('Stage'), stageSel), cu ? h('button', { class: 'btn', type: 'button', onclick: () => msgDialog(job) }, t('Message customer')) : null, h('button', { class: 'btn', type: 'button', id: 'status-report', onclick: () => L.statusReport(job) }, t('Status report')), h('button', { class: 'btn', type: 'button', onclick: () => L.jobDialog(job) }, t('Edit job')))),
      h('div', { class: 'tabs', role: 'tablist' }, TABS.map(x => h('a', { class: 'tab', role: 'tab', href: '#/job/' + job.id + '/' + x[0], 'aria-selected': x[0] === tab ? 'true' : 'false' }, names[x[0]]))),
      tab === 'tasks' ? tasksTab(job) : tab === 'schedule' ? ganttTab(job) : tab === 'money' ? moneyTab(job) : tab === 'site' ? siteTab(job) : profitTab(job));
  };
  function msgDialog(job) {
    L.exportFlow(t('message to customer'), [{ key: 'kind', label: t('Message'), value: 'schedule', choices: C.MESSAGES.map(m => [m[0], t(m[1])]) }], o => C.customerMessage(L.st, job.id, o.kind, T()));
  }

  function tasksTab(job) {
    const st = L.st, d = T();
    const rows = C.topo(job).map(x => {
      const s = x.who && x.who.t === 'sub' ? C.sub(st, x.who.id) : null, lvl = s ? (s.bench === 'dnu' ? 'red' : C.compliance(s, d, st.company.glMin).level) : null, deps = (x.after || []).map(id => job.tasks.find(k => k.id === id)).filter(Boolean);
      return h('tr', { class: x.kind === 'inspection' ? 'insp' : '' }, h('td', null, h('b', null, tt(x.name)), x.trade && x.trade !== x.name ? h('div', { class: 'fine' }, tt(x.trade)) : null, deps.length ? h('div', { class: 'fine' }, t('after: {list}', { list: deps.map(k => tt(k.name)).join(', ') })) : null, x.override ? h('div', { class: 'fine c-red' }, t('Override: {reason}', { reason: x.override.reason })) : null),
        h('td', null, x.kind === 'inspection' ? (x.booked ? L.chip(t('Booked'), 'green') : L.chip(t('Not booked'), 'amber')) : [lvl ? L.dot(lvl) : null, C.whoName(st, x.who)]), h('td', null, x.start ? C.fmtShort(x.start) + ' - ' + C.fmtShort(x.end) : '-'),
        L.num(x.kind === 'inspection' ? '' : x.who && x.who.t === 'crew' ? C.fmtHrs(x.hours) + ' h' : C.fmt(x.cost)), L.num(x.bill ? C.fmt(x.bill) : ''),
        h('td', null, x.status === 'done' ? L.chip(t('Done'), 'green') : L.chip(t('Open'), 'blue')),
        h('td', { class: 'acts' }, x.kind === 'inspection' ? null : h('button', { class: 'btn sm', type: 'button', onclick: () => L.quotesDialog(job, x) }, x.quotes.length ? t('Quotes ({n})', { n: x.quotes.length }) : t('Quotes')),
          h('button', { class: 'btn sm', type: 'button', onclick: () => taskDialog(job, x) }, t('Edit')), x.status !== 'done' ? h('button', { class: 'btn sm', type: 'button', onclick: () => doneDialog(job, x) }, t('Done')) : null));
    });
    return h('div', { class: 'stack' }, h('div', { class: 'row' }, h('p', { class: 'muted grow' }, t('Split the job into tasks, then give each one to your crew or a sub. Invite bids for bigger scopes, or get quick quotes per task.')),
      h('button', { class: 'btn', type: 'button', id: 'add-seq', onclick: () => seqDialog(job) }, t('Add standard sequence')), h('a', { class: 'btn', href: '#/bids/new/' + job.id }, t('Invite bids')), h('button', { class: 'btn primary', type: 'button', id: 'add-task', onclick: () => taskDialog(job) }, t('+ Add task'))),
      job.tasks.length ? L.table([t('Task'), t('Who'), t('Dates'), { t: t('Cost'), cls: 'num' }, { t: t('Billed'), cls: 'num' }, t('Status'), ''], rows, 'tasks') : L.empty(t('No tasks yet. Add the steps of the job, or the standard sequence for your trade.'), t('+ Add task'), () => taskDialog(job), 'empty-task'));
  }
  function seqDialog(job) {
    const start = L.date(job.start || T(), { id: 'seq-start' }), seq = C.SEQ[L.st.preset] || C.SEQ.plumbing;
    L.modal(t('Add standard sequence'), close => h('div', { class: 'stack' }, h('p', null, seq.map(s => tt(s[0])).join(' → ')), h('p', { class: 'muted small' }, t('Each step waits for the one before. Edit the days and who does each step afterwards.')), L.field(t('Start'), start),
      h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: close }, t('Cancel')), h('button', { class: 'btn primary', type: 'button', id: 'seq-go', onclick: () => { C.addSequence(L.st, job.id, start.value, T()); close(); L.commit(); L.go('#/job/' + job.id + '/schedule'); } }, t('Add steps')))));
  }
  function taskDialog(job, task) {
    const st = L.st, isNew = !task; task = task || C.newTask(st, {});
    const f = { name: L.input({ name: 'name', value: task.name === t('Task') ? '' : tt(task.name), id: 't-name' }), trade: L.select(L.tradeOpts(t('Any')), task.trade, { id: 't-trade' }),
      who: L.select(L.who(), L.whoVal(task.who), { id: 't-who' }), start: L.date(task.start, { id: 't-start' }), end: L.date(task.end, { id: 't-end' }), hours: L.input({ name: 'hours', value: task.hours ? C.fmtHrs(task.hours) : '', inputmode: 'decimal' }),
      cost: L.money(task.cost, { name: 'cost', id: 't-cost' }), bill: L.money(task.bill, { name: 'bill' }), scope: L.area(tt(task.scope), { name: 'scope', id: 't-scope' }), kind: L.check(t('This is an inspection'), task.kind === 'inspection', { id: 't-insp' }) };
    const deps = job.tasks.filter(k => k.id !== task.id).map(k => L.check(tt(k.name), (task.after || []).indexOf(k.id) >= 0, { value: k.id }));
    L.modal(isNew ? t('Add task to {job}', { job: job.num }) : t('Edit task'), close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('Task'), f.name), L.field(t('Trade'), f.trade)), f.kind, L.field(t('Who does it'), f.who, t('Subs with expired or missing license or insurance get a hard warning.')),
      h('div', { class: 'grid2' }, L.field(t('Start'), f.start), L.field(t('Finish'), f.end)), h('div', { class: 'grid3' }, L.field(t('Crew hours'), f.hours), L.field(t('Sub price'), f.cost, t('What you pay the sub')), L.field(t('Billed to customer'), f.bill)), L.field(t('Scope (shared with the sub)'), f.scope),
      deps.length ? h('fieldset', { class: 'checks' }, h('legend', null, t('Starts after')), deps) : null, L.actions(close)], () => {
      const name = f.name.value.trim() || f.trade.value; if (!name) throw new Error(t('Name the task'));
      if (f.start.value && f.end.value && f.end.value < f.start.value) throw new Error(t('The finish date is before the start'));
      const hrs = f.hours.value.trim() ? Math.round(parseFloat(f.hours.value) * 100) : 0; if (isNaN(hrs) || hrs < 0) throw new Error(t('Hours must be a number'));
      Object.assign(task, { name: name === tt(task.name) ? task.name : name, trade: f.trade.value, start: f.start.value, end: f.end.value || f.start.value, hours: hrs, cost: L.cents(f.cost.value || '0', t('the sub price')), bill: L.cents(f.bill.value || '0', t('the billed amount')), scope: f.scope.value.trim() === tt(task.scope) ? task.scope : f.scope.value.trim(), kind: L.$('#t-insp').checked ? 'inspection' : 'work' });
      if (isNew) job.tasks.push(task);
      C.setAfter(job, task.id, deps.map(x => x.querySelector('input')).filter(i => i.checked).map(i => i.value));
      const who = task.kind === 'inspection' ? { t: '', id: '' } : L.parseWho(f.who.value); close();
      if (L.whoVal(who) !== L.whoVal(task.who)) L.tryAssign(job, task, who); else L.commit();
    }), true);
  }
  /* the assignment gate: hard warnings need a ticked box and a written reason; soft warnings need a second click */
  L.tryAssign = function (job, task, who, after) {
    const st = L.st, chk = C.assignCheck(st, task, who, T());
    const doIt = reason => { try { C.assign(st, job.id, task.id, who, { today: T(), override: reason }); if (after) after(); L.commit(); L.toast(t('{task} assigned to {who}', { task: tt(task.name), who: C.whoName(st, who) })); } catch (e) { L.toast(e.message, true); } };
    if (!chk.hard.length && !chk.soft.length) return doIt('');
    if (!chk.hard.length) return L.modal(t('Check before assigning'), close => h('div', { class: 'stack' }, h('ul', { class: 'warns' }, chk.soft.map(w => h('li', null, w))),
      h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: () => { close(); L.commit(); } }, t('Cancel')), h('button', { class: 'btn primary', type: 'button', id: 'assign-anyway', onclick: () => { close(); doIt(''); } }, t('Assign anyway')))));
    L.modal(t('Hard warning: {who}', { who: C.whoName(st, who) }), close => {
      const ack = h('input', { type: 'checkbox', id: 'ovr-ack' }), reason = L.input({ id: 'ovr-reason', placeholder: t('Why, for the record (for example: renewal shown on screen, certificate coming today)') }), go = h('button', { class: 'btn danger', type: 'button', id: 'ovr-go', disabled: true, onclick: () => { close(); doIt(reason.value); } }, t('Assign anyway, at my risk'));
      const upd = () => { go.disabled = !(ack.checked && reason.value.trim().length >= 5); }; ack.addEventListener('change', upd); reason.addEventListener('input', upd);
      return h('div', { class: 'stack', id: 'hard-warning' }, h('div', { class: 'note bad' }, h('b', null, t('This sub should not be on a job right now.')), h('ul', { class: 'warns' }, chk.hard.concat(chk.soft).map(w => h('li', null, w)))),
        h('p', null, t('If an unlicensed or uninsured sub is hurt on the job or damages a home, the claim and the penalties can land on you, and your own insurer may charge or refuse to cover it. Get the renewed license or certificate first.')),
        h('label', { class: 'check' }, ack, h('span', null, t('I understand the risk and I still want to assign this work.'))), L.field(t('Reason'), reason), h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { close(); L.commit(); } }, t('Do not assign')), go));
    });
  };
  /* finishing a task rates the sub on five points; the scorecard updates */
  L.rateFields = () => ({ onTime: h('input', { type: 'checkbox', checked: true, id: 'r-ontime' }), quality: L.select(L.scale(), '4', { id: 'r-quality' }), cleanup: L.select(L.scale(), '4', { id: 'r-cleanup' }), paperwork: L.select(L.scale(), '4', { id: 'r-paper' }), callback: h('input', { type: 'checkbox', id: 'r-callback' }), note: L.input({ id: 'r-note', name: 'note' }) });
  L.scale = () => [['5', t('5, excellent')], ['4', t('4, good')], ['3', t('3, fine')], ['2', t('2, poor')], ['1', t('1, unacceptable')]];
  L.rateBlock = f => [h('label', { class: 'check' }, f.onTime, h('span', null, t('Finished on time'))), h('div', { class: 'grid3' }, L.field(t('Quality'), f.quality), L.field(t('Cleanup'), f.cleanup), L.field(t('Paperwork'), f.paperwork)), h('label', { class: 'check' }, f.callback, h('span', null, t('Needed a callback or redo'))), L.field(t('Note'), f.note)];
  L.rateVals = f => ({ onTime: f.onTime.checked, quality: +f.quality.value, cleanup: +f.cleanup.value, paperwork: +f.paperwork.value, callback: f.callback.checked, note: f.note.value.trim() });
  function doneDialog(job, task) {
    const isSub = task.who && task.who.t === 'sub', f = L.rateFields();
    L.modal(t('Mark done: {task}', { task: tt(task.name) }), close => L.form({}, [isSub ? h('p', { class: 'muted' }, t('Rate {who} on this job. It feeds their scorecard.', { who: C.whoName(L.st, task.who) })) : null, isSub ? L.rateBlock(f) : null,
      L.actions(close, t('Mark done'))], () => {
      task.status = 'done'; if (isSub) C.rate(L.st, Object.assign({ subId: task.who.id, jobId: job.id, taskId: task.id }, L.rateVals(f)), T()); C.log(L.st, T(), job.num + ' ' + tt(task.name) + ': ' + t('Done')); close(); L.commit(); }));
  }

  /* quick quotes for one task */
  L.quotesDialog = function (job, task) {
    const st = L.st, d = T(), cmp = C.compareQuotes(st, task, d), able = st.subs.filter(s => s.active !== false && s.bench !== 'dnu' && (!task.trade || (s.trades || []).indexOf(task.trade) >= 0));
    L.modal(t('Quotes: {job} {task}', { job: job.num, task: tt(task.name) }), close => {
      const sub = L.select(st.subs.map(s => [s.id, s.name]), able[0] && able[0].id, { id: 'q-sub' }), price = L.money('', { id: 'q-price', name: 'price' }), days = L.input({ id: 'q-days', value: '1', inputmode: 'numeric', name: 'days' }), note = L.input({ id: 'q-note', name: 'note' });
      const award = r => { const tmp = { id: task.id, trade: task.trade, start: task.start, end: task.start ? C.addWorkdays(task.start, r.q.days, st.company.workDays) : task.end }, chk = C.assignCheck(st, tmp, { t: 'sub', id: r.q.subId }, d);
        if (chk.hard.length) return L.tryAssign(job, task, { t: 'sub', id: r.q.subId }, () => { task.cost = r.q.price; task.awarded = r.q.id; });
        try { C.awardQuote(st, job.id, task.id, r.q.id, { start: task.start, today: d }); L.commit(); L.toast(t('Awarded to {sub} for {amt}', { sub: r.sub.name, amt: C.fmt(r.q.price) }) + (chk.soft.length ? '. ' + chk.soft.join(' ') : ''), chk.soft.length > 0); } catch (e) { L.toast(e.message, true); } };
      const rows = cmp.rows.map(r => h('tr', { class: r === cmp.best ? 'best' : r.comp === 'red' ? 'blocked' : '' },
        h('td', null, L.dot(r.comp), h('b', null, r.sub.name), r.q.note ? h('div', { class: 'fine' }, tt(r.q.note)) : null), L.num(C.fmt(r.q.price)), L.num(tn(r.q.days, '{n} day', '{n} days')), L.num(String(r.rel.score)), h('td', null, L.compChip(r.comp)),
        h('td', null, r.badges.map(b => L.chip(b, b === t('Best value') ? 'green' : r.comp === 'red' ? 'red' : 'blue'))), h('td', { class: 'acts' }, task.awarded === r.q.id ? L.chip(t('Awarded'), 'green') : h('button', { class: 'btn sm' + (r === cmp.best ? ' next' : ''), type: 'button', 'data-award': r.sub.id, onclick: () => { close(); award(r); } }, t('Award')))));
      return h('div', { class: 'stack' }, cmp.rows.length ? L.table([t('Sub'), { t: t('Price'), cls: 'num' }, { t: t('Time'), cls: 'num' }, { t: t('Score'), cls: 'num' }, t('Paperwork'), '', ''], rows, 'compare') : L.empty(t('No quotes yet. Send requests below, then record the prices as they come in.')),
        h('p', { class: 'fine' }, t('Best value is the lowest price weighted by score, among subs with paperwork in order and a score of 60 or more. For a bigger scope with exclusions, use a bid package instead.')),
        h('h3', null, t('Record a quote')), L.form({ id: 'quote-form' }, [h('div', { class: 'grid4' }, L.field(t('Sub'), sub), L.field(t('Price'), price), L.field(t('Working days'), days), L.field(t('Note'), note)), h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'submit' }, t('Add quote')))], () => {
          const n = parseInt(days.value, 10); if (!(n > 0)) throw new Error(t('Working days must be 1 or more'));
          task.quotes.push({ id: C.nid(st, 'q'), subId: sub.value, price: L.cents(price.value, t('the price')), days: n, note: note.value.trim(), date: d }); close(); L.commit(); L.quotesDialog(job, task); }),
        h('h3', null, t('Request quotes')), h('div', { class: 'row' }, able.map(s => h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('quote request to {sub}', { sub: s.name }), [L.addressChoice('city')], o => C.quoteRequest(st, job.id, task.id, s.id, o, d)) }, s.name.replace(' (demo)', '')))));
    }, true);
  };

  /* ---------------- schedule tab: Gantt, ripple, slips, inspection booking ---------------- */
  function ganttTab(job) {
    const st = L.st, d = T(), wd = st.company.workDays, issues = C.ripple(st, job), dated = job.tasks.filter(k => C.isDate(k.start));
    const starts = dated.map(k => k.start).sort(), ends = dated.map(k => k.end).sort();
    const top = h('div', { class: 'row' }, h('p', { class: 'muted grow' }, t('Each task waits for the ones it depends on. When a sub slips, record it and Stark Trades shows what moves.')), h('button', { class: 'btn', type: 'button', onclick: () => seqDialog(job) }, t('Add standard sequence')));
    if (!dated.length) return h('div', { class: 'stack' }, top, L.empty(t('No dated tasks yet. Add the standard sequence or give tasks dates.')));
    const from = C.addDays(starts[0] < d ? starts[0] : d, -1), span = Math.min(56, Math.max(14, C.daysBetween(from, ends[ends.length - 1]) + 3)), days = []; for (let i = 0; i < span; i++) days.push(C.addDays(from, i));
    const lateIds = issues.map(x => x.task.id);
    const rows = C.topo(job).map(k => h('tr', { class: (k.kind === 'inspection' ? 'insp ' : '') + (lateIds.indexOf(k.id) >= 0 ? 'late' : '') },
      h('th', { class: 'who' }, h('b', null, tt(k.name)), h('div', { class: 'fine' }, k.kind === 'inspection' ? (k.booked ? t('booked {date}', { date: C.fmtShort(k.booked) }) : t('not booked')) : C.whoName(st, k.who)), k.slips.length ? h('div', { class: 'fine c-red' }, tn(k.slips.reduce((a, s) => a + s.days, 0), 'slipped {n} day', 'slipped {n} days')) : null),
      days.map(x => { const on = C.isDate(k.start) && x >= k.start && x <= k.end && C.isWork(x, wd); return h('td', { class: (C.isWork(x, wd) ? '' : 'off ') + (x === d ? 'now ' : '') + (on ? 'bar ' + (k.status === 'done' ? 'done' : k.kind === 'inspection' ? 'ib' : '') : '') }); }),
      h('td', { class: 'acts' }, k.status !== 'done' && k.kind === 'inspection' && !k.booked ? h('button', { class: 'btn sm', type: 'button', 'data-book': k.id, onclick: () => { k.booked = d; C.log(st, d, job.num + ' ' + tt(k.name) + ': ' + t('Booked')); L.commit(); } }, t('Mark booked')) : null,
        k.status !== 'done' && k.kind !== 'inspection' && k.start ? h('button', { class: 'btn sm', type: 'button', 'data-slip': k.id, onclick: () => slipDialog(job, k) }, t('Slipped')) : null)));
    return h('div', { class: 'stack' }, top,
      issues.length ? h('div', { class: 'note bad', id: 'ripple' }, h('b', null, t('Delay ripple:') + ' '), issues.map(r => h('div', null, t('{dep} now ends {end}, but {task} starts {start}. Earliest it can start: {earliest}.', { dep: tt(r.dep.name), end: C.fmtShort(r.dep.end), task: tt(r.task.name), start: C.fmtShort(r.task.start), earliest: C.fmtShort(r.earliest) }))),
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'button', id: 'ripple-go', onclick: () => { const m = C.applyRipple(st, job.id, d); L.commit(); L.toast(tn(m.length, '{n} task moved later', '{n} tasks moved later')); } }, t('Move later tasks')))) : null,
      h('section', { class: 'card' }, h('div', { class: 'scroll' }, h('table', { class: 'gantt', id: 'gantt' }, h('thead', null, h('tr', null, h('th', null, t('Task')), days.map(x => h('th', { class: (C.isWork(x, wd) ? '' : 'off ') + (x === d ? 'now' : '') }, C.dowName(C.dow(x)).slice(0, 2), h('br'), x.slice(8))), h('th'))), h('tbody', null, rows))),
        h('p', { class: 'fine' }, t('Teal: work. Peach: inspection. Faded: done. Red row: starts before what it waits on is finished. Book inspections {n} working days ahead.', { n: st.company.inspLead }))));
  }
  function slipDialog(job, k) {
    const days = L.input({ id: 'slip-days', value: '1', inputmode: 'numeric', name: 'days' }), reason = L.input({ id: 'slip-reason', name: 'reason' });
    L.modal(t('Slipped: {task}', { task: tt(k.name) }), close => L.form({}, [h('p', { class: 'muted' }, t('Currently ends {date}.', { date: C.fmtDate(k.end) })), h('div', { class: 'grid2' }, L.field(t('Working days late'), days), L.field(t('Why'), reason)), L.actions(close, t('Record slip'))], () => {
      const iss = C.slipTask(L.st, job.id, k.id, parseInt(days.value, 10), reason.value, T()); close(); L.commit(); if (iss.length) L.toast(tn(iss.length, '{n} later task is now affected', '{n} later tasks are now affected'), true); }));
  }

  /* ---------------- money on one job ---------------- */
  function moneyTab(job) {
    const st = L.st, d = T(), k = C.jobCost(st, job), sc = C.sovCheck(job);
    const coRows = job.changeOrders.map(c => h('tr', null, h('td', null, c.num), h('td', null, tt(c.desc), c.days ? h('div', { class: 'fine' }, tn(c.days, '+{n} day', '+{n} days')) : null), L.num(C.fmt(c.amount)),
      h('td', null, c.status === 'approved' ? L.chip(t('Signed {date}', { date: C.fmtShort(c.signedDate) }), 'green') : c.status === 'rejected' ? L.chip(t('Rejected'), 'dim') : L.chip(t('Waiting for sign-off'), 'amber'), c.signedBy ? h('div', { class: 'fine' }, c.signedBy) : null),
      h('td', { class: 'acts' }, c.status === 'pending' ? h('button', { class: 'btn sm next', type: 'button', onclick: () => signDialog(job, c) }, t('Sign-off')) : null,
        h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('change order {num}', { num: c.num }), [L.addressChoice('full'), { key: 'customer', label: t('Include customer name'), value: true }], o => C.coDoc(st, job, c, o)) }, t('Print')))));
    const invRows = job.invoices.map(i => { const late = !i.paid && i.dueDate < d;
      return h('tr', null, h('td', null, i.num, i.sov ? h('div', { class: 'fine' }, t('schedule of values')) : null), h('td', null, C.fmtShort(i.date)), h('td', null, i.paid ? '-' : late ? L.chip(t('overdue {date}', { date: C.fmtShort(i.dueDate) }), 'red') : C.fmtShort(i.dueDate)), L.num(C.fmt(i.gross)), L.num(i.retained ? '-' + C.fmt(i.retained) : i.release ? '+' + C.fmt(i.release) : '-'), L.num(h('b', null, C.fmt(i.due))),
        h('td', { class: 'acts' }, i.paid ? L.chip(t('Paid {date}', { date: C.fmtShort(i.paidDate) }), 'green') : h('button', { class: 'btn sm', type: 'button', onclick: () => { i.paid = true; i.paidDate = d; L.commit(); } }, t('Mark paid')),
          h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('invoice {num}', { num: i.num }), [L.addressChoice('full'), { key: 'customer', label: t('Include customer name'), value: true }], o => C.progressBillDoc(st, job.id, i.id, o)) }, t('Print')))); });
    const subIds = Array.from(new Set(job.tasks.filter(x => x.who && x.who.t === 'sub').map(x => x.who.id)));
    const retain = L.input({ value: C.fmtBps(job.retainBps || 0).replace('%', ''), inputmode: 'decimal', id: 'cust-retain', 'aria-label': t('Customer retainage percent'), class: 'short' });
    const sovRows = C.sovLines(job).map(l => { const prev = C.sovPrevious(job, l.id); return h('tr', null, h('td', null, tt(l.item)), L.num(C.fmt(l.value)), L.num(C.fmt(prev)), L.num(l.value ? Math.round(100 * prev / l.value) + '%' : '-')); });
    const bcs = st.backcharges.filter(b => b.jobId === job.id);
    return h('div', { class: 'stack' },
      h('div', { class: 'grid4' }, stat(t('Contract'), C.fmt(k.contract), t('base {amt} + signed changes', { amt: C.fmt(job.base) })), stat(t('Billed'), C.fmt(k.billed), t('{amt} collected', { amt: C.fmt(k.collected) })), stat(t('Paid to subs'), C.fmt(k.subPaid), t('{amt} retainage held', { amt: C.fmt(k.retainageHeld) })), stat(t('Profit (planned)'), C.fmt(k.profit), t('{pct} margin', { pct: C.fmtBps(k.marginBps) }))),
      h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Change orders')), h('button', { class: 'btn', type: 'button', id: 'add-co', onclick: () => coDialog(job) }, t('+ Change order'))),
        job.changeOrders.length ? L.table(['#', t('Change'), { t: t('Price'), cls: 'num' }, t('Status'), ''], coRows) : L.empty(t('No change orders. Any extra work gets one, signed before you do it.'))),
      h('section', { class: 'card', id: 'sov' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Schedule of values')), h('button', { class: 'btn', type: 'button', onclick: () => sovDialog(job) }, t('Edit lines')), h('button', { class: 'btn primary', type: 'button', id: 'sov-bill', onclick: () => sovBillDialog(job) }, t('Bill by percent complete'))),
        sovRows.length ? L.table([t('Item'), { t: t('Value'), cls: 'num' }, { t: t('Billed so far'), cls: 'num' }, { t: '%', cls: 'num' }], sovRows) : L.empty(t('No schedule of values yet. Split the contract into lines to bill by percent complete.')),
        sovRows.length && !sc.ok ? h('p', { class: 'note bad' }, t('The lines add up to {a}; the contract is {b}. Difference: {c}.', { a: C.fmt(sc.sum), b: C.fmt(sc.contract), c: C.fmt(sc.diff) })) : null, h('p', { class: 'fine' }, t('Signed change orders are added as their own lines automatically.'))),
      h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Customer billing')), L.field(t('Retainage %'), retain), h('button', { class: 'btn sm', type: 'button', onclick: () => { const b = C.toBps(retain.value); if (isNaN(b) || b > 2000) return L.toast(t('Retainage is a percent from 0 to 20'), true); job.retainBps = b; L.commit(); } }, t('Set')),
        h('button', { class: 'btn', type: 'button', id: 'bill-progress', onclick: () => billDialog(job) }, t('Bill an amount'))),
        job.invoices.length ? L.table([t('Invoice'), t('Date'), t('Due'), { t: t('Work billed'), cls: 'num' }, { t: t('Retainage'), cls: 'num' }, { t: t('Amount due'), cls: 'num' }, ''], invRows) : L.empty(t('Nothing billed yet.'))),
      L.jobDocsCard ? L.jobDocsCard(job) : null,
      h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Sub payments and lien waivers')), subIds.length ? h('button', { class: 'btn', type: 'button', onclick: () => L.subInvoiceDialog(job.id) }, t('Record sub invoice')) : null),
        subIds.map(id => { const s = C.sub(st, id), con = C.subContract(st, job.id, id), ps = st.subPays.filter(p => p.jobId === job.id && p.subId === id), sp = C.sumPays(ps);
          return h('div', { class: 'subpay' }, h('div', { class: 'row' }, h('b', null, s.name), h('span', { class: 'muted small' }, t('contract {a} · billed {b} · retainage held {c}', { a: C.fmt(con), b: C.fmt(sp.gross), c: C.fmt(sp.retained - sp.released) })), h('span', { class: 'grow' }),
            h('button', { class: 'btn sm', type: 'button', onclick: () => L.exportFlow(t('agreement with {sub}', { sub: s.name }), [L.addressChoice('full')], o => C.agreementDoc(st, job.id, id, o, d)) }, t('Sub agreement')), h('button', { class: 'btn sm', type: 'button', onclick: () => L.backchargeDialog(job.id, id) }, t('Backcharge'))), L.payTable(ps)); }),
        subIds.length ? null : L.empty(t('No subs on this job.')),
        bcs.length ? h('div', { class: 'subpay' }, h('h3', null, t('Backcharges on this job')), L.bcTable(bcs)) : null));
  }
  function coDialog(job) {
    const desc = L.area('', { name: 'desc', id: 'co-desc' }), amt = L.money('', { name: 'amount', id: 'co-amt', placeholder: t('0.00 (minus for a credit)') }), days = L.input({ name: 'days', value: '0', inputmode: 'numeric' });
    L.modal(t('Change order for {job}', { job: job.num }), close => L.form({}, [L.field(t('What changes'), desc), h('div', { class: 'grid2' }, L.field(t('Price change'), amt), L.field(t('Extra working days'), days)), L.actions(close, t('Write change order'))], () => {
      C.addCO(L.st, job.id, { desc: desc.value, amount: L.cents(amt.value, t('the price change'), true), days: parseInt(days.value, 10) || 0 }, T()); close(); L.commit(); }));
  }
  function signDialog(job, c) {
    const name = L.input({ name: 'signer', id: 'co-signer', value: (C.customer(L.st, job.customerId) || {}).name || '' }), date = L.date(T(), { id: 'co-date' }), ok = h('input', { type: 'checkbox', id: 'co-ok' });
    L.modal(t('Sign-off: {num}', { num: c.num }), close => L.form({}, [h('p', null, tt(c.desc) + ' · ' + C.fmt(c.amount)), L.field(t('Signed by'), name), L.field(t('Date signed'), date), h('label', { class: 'check' }, ok, h('span', null, t('The customer signed the printed or on-screen change order'))),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn danger', onclick: () => { try { C.signCO(L.st, job.id, c.id, name.value, date.value, false); close(); L.commit(); } catch (e) { L.toast(e.message, true); } } }, t('Customer rejected')), h('button', { class: 'btn primary', type: 'submit' }, t('Approve')))], () => {
      if (!ok.checked) throw new Error(t('Tick the box once the customer has signed')); C.signCO(L.st, job.id, c.id, name.value, date.value, true); close(); L.commit(); }));
  }
  function billDialog(job) {
    const gross = L.money('', { name: 'gross', id: 'bill-gross' }), final = h('input', { type: 'checkbox', id: 'bill-final' }), date = L.date(T()), left = C.contractTotal(job) - C.sumPays(job.invoices).gross;
    L.modal(t('Bill progress on {job}', { job: job.num }), close => L.form({}, [h('p', { class: 'muted' }, t('{amt} of the contract is left to bill. Retainage on this job: {pct}.', { amt: C.fmt(left), pct: C.fmtBps(job.retainBps || 0) })), L.field(t('Value of work done this period'), gross), h('label', { class: 'check' }, final, h('span', null, t('Final bill: bills the rest and releases retainage'))), L.field(t('Date'), date), L.actions(close, t('Create invoice'))], () => {
      C.addInvoice(L.st, job.id, { gross: final.checked ? 0 : L.cents(gross.value, t('the work value')), final: final.checked, date: date.value }, T()); close(); L.commit(); }));
  }
  function sovDialog(job) {
    const st = L.st, rows = h('div', { class: 'stack', id: 'sov-lines' });
    const line = (l) => h('div', { class: 'row sovl' }, L.input({ value: tt(l.item), 'aria-label': t('Item'), 'data-id': l.id || '', 'data-orig': l.item, class: 'grow' }), L.money(l.value, { 'aria-label': t('Value'), class: 'short2' }), h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': t('Remove'), onclick: e => e.target.closest('.sovl').remove() }, '✕'));
    job.sov.forEach(l => rows.appendChild(line(l))); if (!job.sov.length) job.tasks.filter(k => k.kind !== 'inspection').forEach(k => rows.appendChild(line({ item: k.name, value: k.bill })));
    L.modal(t('Schedule of values'), close => L.form({}, [h('p', { class: 'muted small' }, t('Base contract: {amt}. The lines should add up to it.', { amt: C.fmt(job.base) })), rows, h('button', { class: 'btn sm', type: 'button', onclick: () => rows.appendChild(line({ item: '', value: 0 })) }, t('+ Line')), L.actions(close)], () => {
      const lines = L.$$('.sovl', rows).map(r => { const i = r.querySelectorAll('input'); return { id: i[0].dataset.id || C.nid(st, 'sv'), item: i[0].value.trim() === tt(i[0].dataset.orig) ? i[0].dataset.orig : i[0].value.trim(), value: L.cents(i[1].value || '0', t('the line value')) }; }).filter(l => l.item);
      job.sov = lines; close(); L.commit(); }), true);
  }
  function sovBillDialog(job) {
    const pv = C.sovPreview(job, {}), inputs = {}, date = L.date(T()), total = h('b', { id: 'sov-total' });
    const upd = () => { const p = {}; Object.keys(inputs).forEach(id => { p[id] = C.toBps(inputs[id].value || '0'); }); const r = C.sovPreview(job, p); total.textContent = C.fmt(r.gross); return p; };
    const rows = pv.lines.map(l => { inputs[l.id] = L.input({ value: String(l.bps / 100), inputmode: 'decimal', class: 'short', 'aria-label': t('Percent complete'), oninput: () => upd() }); return h('tr', null, h('td', null, tt(l.item)), L.num(C.fmt(l.value)), L.num(C.fmt(l.prev)), h('td', { class: 'num' }, inputs[l.id], ' %')); });
    L.modal(t('Bill by percent complete'), close => L.form({}, [L.table([t('Item'), { t: t('Value'), cls: 'num' }, { t: t('Billed so far'), cls: 'num' }, { t: t('Complete to date'), cls: 'num' }], rows), h('p', null, t('This bill (before retainage): '), total), L.field(t('Date'), date), L.actions(close, t('Create invoice'))], () => {
      C.addSovInvoice(L.st, job.id, upd(), date.value, T()); close(); L.commit(); }), true);
    upd();
  }

  /* sub payments with the lien-waiver gate (shared by the job page and the Money page) */
  L.payTable = function (ps) {
    const st = L.st, d = T(); if (!ps.length) return L.empty(t('No payments set up yet. Set one up when a sub finishes work; it stays on hold until their lien waiver is in.'), t('Set up a sub payment'), () => L.payDialog());
    return L.table(['#', t('Job / sub'), { t: t('Work'), cls: 'num' }, { t: t('Retainage'), cls: 'num' }, { t: t('Pay'), cls: 'num' }, t('Conditional waiver'), t('Payment'), t('Unconditional waiver')], ps.map(p => {
      const ws = st.waivers.filter(w => w.payId === p.id), cw = ws.find(w => w.cond), uw = ws.find(w => !w.cond), chk = C.canPaySub(st, p.id, d), j = C.job(st, p.jobId), s = C.sub(st, p.subId);
      const wcell = (w, needed) => !w ? h('td', null, '-') : w.received ? h('td', null, L.chip(t('Received {date}', { date: C.fmtShort(w.received) }), 'green')) : !needed ? h('td', { class: 'muted small' }, t('after payment')) :
        h('td', null, h('button', { class: 'btn sm', type: 'button', 'data-recv': w.id, onclick: () => recvDialog(w) }, t('Mark received')), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => L.exportFlow(t('waiver request'), [L.addressChoice('full')], o => C.waiverRequestDoc(st, w.id, o, d)) }, t('Request letter')));
      return h('tr', { class: chk.ok || p.status === 'paid' ? '' : 'held' }, h('td', null, p.n, p.final ? h('div', { class: 'fine' }, t('final')) : null), h('td', null, j.num, h('div', { class: 'fine' }, s ? s.name : '?'), p.dueDate && p.status !== 'paid' ? h('div', { class: 'fine' }, t('due {date}', { date: C.fmtShort(p.dueDate) })) : null),
        L.num(C.fmt(p.gross)), L.num(p.retained ? '-' + C.fmt(p.retained) : p.release ? '+' + C.fmt(p.release) : '-'), L.num(h('b', null, C.fmt(p.due)), p.backcharge ? '' : null), wcell(cw, true),
        h('td', null, p.status === 'paid' ? L.chip(t('Paid {date}', { date: C.fmtShort(p.paidDate) }), 'green') : chk.ok ? h('button', { class: 'btn sm', type: 'button', 'data-pay': p.id, onclick: () => payNow(p) }, t('Pay')) : h('div', null, L.chip(t('On hold'), 'red'), h('button', { class: 'btn sm ghost', type: 'button', 'data-why': p.id, onclick: () => L.modal(t('Why this payment is on hold'), c => h('div', { class: 'stack' }, h('ul', { class: 'warns', id: 'hold-reasons' }, chk.reasons.map(r => h('li', null, r))), h('p', { class: 'muted' }, t('Stark Trades never lets you mark a sub paid without the matching lien waiver. This protects you from paying twice if the sub does not pay their own suppliers.')), h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'button', onclick: c }, t('OK'))))) }, t('Why?'))),
          p.backcharge ? h('div', { class: 'fine' }, t('less backcharge {amt}', { amt: C.fmt(p.backcharge) })) : null), wcell(uw, p.status === 'paid'));
    }), 'pays');
  };
  function recvDialog(w) {
    const date = L.date(T(), { id: 'w-date' }), amt = L.money(w.amount, { id: 'w-amt' });
    L.modal(t('Received: {type}', { type: C.waiverName(w) }), close => L.form({}, [h('p', { class: 'muted' }, t("Check that the signed waiver names the right job, amount and date, and is your state's required form if it has one.")), h('div', { class: 'grid2' }, L.field(t('Date received'), date), L.field(t('Amount on the waiver'), amt)), L.actions(close, t('Mark received'))], () => {
      C.receiveWaiver(L.st, w.id, date.value, L.cents(amt.value, t('the waiver amount'))); close(); L.commit(); }));
  }
  function payNow(p) {
    const st = L.st, chk = C.canPaySub(st, p.id, T()), date = L.date(T(), { id: 'pay-date' });
    L.modal(t('Pay {amt}', { amt: C.fmt(p.due) }), close => h('div', { class: 'stack' }, chk.warnings.length ? h('div', { class: 'note bad' }, chk.warnings.join(' ')) : null, h('p', null, t('The conditional waiver is in. After you pay, collect the unconditional waiver: the next payment waits on it.')), L.field(t('Date paid'), date),
      h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: close }, t('Cancel')), h('button', { class: 'btn primary', type: 'button', id: 'pay-go', onclick: () => { try { C.paySub(st, p.id, date.value); close(); L.commit(); L.toast(t('Recorded. Now collect the unconditional waiver.')); } catch (e) { L.toast(e.message, true); } } }, t('Record payment')))));
  }

  /* ---------------- site and field summary ---------------- */
  function siteTab(job) {
    const st = L.st, grid = h('div', { class: 'photos', id: 'photos' });
    job.photos.forEach(p => grid.appendChild(h('figure', null, L.photo(p.id, p.caption), h('figcaption', null, (p.stage ? t(p.stage) + ' · ' : '') + (p.caption || '') + ' · ' + C.fmtShort(p.date),
      h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': t('Delete photo'), onclick: () => L.confirm(t('Delete this photo?'), t('Delete'), async () => { await window.StarkStore.delPhoto(p.id); job.photos = job.photos.filter(x => x !== p); L.commit(); }, true) }, '✕')))));
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'photo-file', class: 'sr-only', onchange: async ev => {
      const stage = L.$('#photo-stage').value, cap = L.$('#photo-cap').value.trim(); try { C.guard({ cap }); } catch (e) { return L.toast(e.message, true); }
      (await L.savePhotos(ev.target.files)).forEach(id => job.photos.push({ id, caption: cap, stage, date: T() })); L.commit(); } });
    return h('div', { class: 'stack' },
      h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Job photos')), job.photos.length ? h('button', { class: 'btn', type: 'button', id: 'photo-report', onclick: () => L.photoReportDialog(job) }, t('Photo report')) : null), h('p', { class: 'muted small' }, t('Photos are resized, encrypted and kept only in this browser. Resizing also removes location data stored inside the photo.')),
        h('div', { class: 'row' }, L.field(t('Stage'), L.select([['Before', t('Before')], ['During', t('During')], ['After', t('After')], ['Inspection', t('Inspection')]], 'Before', { id: 'photo-stage' })), L.field(t('Caption'), L.input({ id: 'photo-cap' })), h('label', { class: 'btn primary', for: 'photo-file' }, t('Add photos')), file),
        job.photos.length ? grid : L.empty(t('No photos yet. Before and after shots help with warranty claims and disputes.'))),
      h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('Permits and inspections')), h('button', { class: 'btn', type: 'button', onclick: () => permitDialog(job) }, t('+ Permit'))),
        job.permits.length ? L.table([t('Permit'), t('Number'), t('Applied'), t('Issued'), t('Inspection'), t('Result'), ''], job.permits.map(p => h('tr', null, h('td', null, tt(p.kind), p.jurisdiction ? h('div', { class: 'fine' }, p.jurisdiction) : null), h('td', null, p.number, p.expires ? h('div', { class: 'fine' }, t('expires {date}', { date: C.fmtShort(p.expires) })) : null), h('td', null, C.fmtShort(p.applied)), h('td', null, C.fmtShort(p.issued)), h('td', null, C.fmtDate(p.inspDate)),
          h('td', null, p.result === 'passed' ? L.chip(t('Passed'), 'green') : p.result === 'failed' ? L.chip(t('Failed'), 'red') : L.chip(t('Pending'), 'amber')), h('td', { class: 'acts' }, h('button', { class: 'btn sm', type: 'button', onclick: () => permitDialog(job, p) }, t('Edit')))))) : L.empty(t('No permits recorded.')),
        h('p', { class: 'fine' }, t('Inspection steps in the job schedule get booking reminders too.'), ' ', h('a', { href: '#/permits' }, t('All permits by jurisdiction')))),
      h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, t('From the field')), h('a', { class: 'btn', href: '#/field/' + job.id }, t('Open in field mode'))),
        h('div', { class: 'grid3' }, stat(t('Punch list'), t('{a} open', { a: job.punch.filter(p => !p.done).length }), tn(job.punch.length, '{n} item in total', '{n} items in total')), stat(t('Pick up'), t('{a} to get', { a: job.pickup.filter(p => !p.got).length }), ''), stat(t('Daily log'), String(job.logs.length), job.logs.length ? t('last {date}', { date: C.fmtShort(job.logs[job.logs.length - 1].date) }) : '')),
        job.logs.slice(-3).reverse().map(l => h('p', { class: 'logline' }, h('b', null, C.fmtShort(l.date) + ' · ' + (l.by || '') + (l.weather ? ' · ' + tt(l.weather) : '') + ': '), tt(l.text)))));
  }
  function permitDialog(job, p) {
    const isNew = !p; p = p || { id: '', kind: 'Plumbing', number: '', applied: T(), issued: '', inspDate: '', result: '', notes: '', jurisdiction: (job.permits[0] || {}).jurisdiction || '', expires: '' };
    const f = { kind: L.input({ name: 'kind', value: tt(p.kind) }), number: L.input({ name: 'number', value: p.number }), applied: L.date(p.applied), issued: L.date(p.issued), insp: L.date(p.inspDate), result: L.select([['', t('Pending')], ['passed', t('Passed')], ['failed', t('Failed')]], p.result), notes: L.area(p.notes, { name: 'notes' }), juris: L.input({ name: 'jurisdiction', value: p.jurisdiction || '', list: 'juris-list', id: 'pm-juris' }), exp: L.date(p.expires || '', { id: 'pm-exp' }) };
    const jl = h('datalist', { id: 'juris-list' }, Array.from(new Set(L.st.jurisdictions.map(x => x.name).concat(...L.st.jobs.map(j => j.permits.map(x => x.jurisdiction))).filter(Boolean))).map(n => h('option', { value: n })));
    L.modal(isNew ? t('Add permit') : t('Edit permit'), close => L.form({}, [h('div', { class: 'grid2' }, L.field(t('Permit type'), f.kind), L.field(t('Permit number'), f.number)), h('div', { class: 'grid3' }, L.field(t('Applied'), f.applied), L.field(t('Issued'), f.issued), L.field(t('Inspection date'), f.insp)), h('div', { class: 'grid3' }, L.field(t('Result'), f.result), L.field(t('City or county'), f.juris), L.field(t('Permit expires'), f.exp)), jl, L.field(t('Notes'), f.notes), L.actions(close)], () => {
      const kind = f.kind.value.trim(); Object.assign(p, { kind: kind === tt(p.kind) ? p.kind : kind || t('Permit'), number: f.number.value.trim(), applied: f.applied.value, issued: f.issued.value, inspDate: f.insp.value, result: f.result.value, notes: f.notes.value, jurisdiction: f.juris.value.trim(), expires: f.exp.value });
      const jr = L.st.jurisdictions.find(x => x.name.toLowerCase() === p.jurisdiction.toLowerCase()); if (!p.expires && C.isDate(p.issued) && jr && jr.validDays) p.expires = C.addDays(p.issued, jr.validDays); if (isNew) { p.id = C.nid(L.st, 'pm'); job.permits.push(p); } close(); L.commit(); }));
  }

  function profitTab(job) {
    const k = C.jobCost(L.st, job), row = (a, b, cls) => h('tr', { class: cls || '' }, h('td', null, a), L.num(C.fmt(b)));
    return h('div', { class: 'grid2' }, h('section', { class: 'card' }, h('h2', null, t('Job costing')), L.table(['', { t: t('Amount'), cls: 'num' }], [row(t('Contract with signed change orders'), k.contract, 'sec'), row(t('Subs (agreed prices)'), -k.subs), row(t('In-house crew (hours x cost rate)'), -k.crew), row(k.matPlanned ? t('Materials (from the estimate until real costs are recorded)') : t('Materials'), -k.materials), row(t('Other costs'), -k.other), row(t('Callbacks and warranty work'), -k.callbacks), row(t('Backcharges recovered from subs'), k.backcharges), row(t('Gross profit'), k.profit, 'grand')], 'rpt'),
      h('p', { class: 'fine' }, t('Margin {pct}. Planned figures from agreed prices; edit materials and other costs as receipts come in.', { pct: C.fmtBps(k.marginBps) })),
      h('div', { class: 'row' }, L.field(t('Materials'), L.money(job.materials, { id: 'pf-mat' })), L.field(t('Other costs'), L.money(job.other, { id: 'pf-oth' })), h('button', { class: 'btn', type: 'button', onclick: () => { try { job.materials = L.cents(L.$('#pf-mat').value || '0', t('materials')); job.other = L.cents(L.$('#pf-oth').value || '0', t('other costs')); L.commit(); } catch (e) { L.toast(e.message, true); } } }, t('Update')))),
      L.partsCard(job),
      h('section', { class: 'card' }, h('h2', null, t('Cash so far')), L.table(['', { t: t('Amount'), cls: 'num' }], [row(t('Billed to customer'), k.billed), row(t('Collected'), k.collected), row(t('Retainage the customer still holds'), k.retainageByCustomer), row(t('Paid to subs'), k.subPaid), row(t('Retainage you hold for subs'), k.retainageHeld)], 'rpt')));
  }

  /* ---------------- schedule and capacity ---------------- */
  let schedFrom = null, lastCheck = null;
  L.routes.schedule = function () {
    const st = L.st, d = T(); schedFrom = schedFrom || C.addDays(d, -((C.dow(d) + 6) % 7));
    const g = C.loadGrid(st, schedFrom, 14, d), conf = C.conflicts(st), rip = []; st.jobs.forEach(j => C.ripple(st, j).forEach(r => rip.push(r)));
    const cal = h('div', { class: 'scroll' }, h('table', { class: 'cal', id: 'cal' }, h('thead', null, h('tr', null, h('th', null, t('Who')), g.days.map(x => h('th', { class: (x.work ? '' : 'off') + (x.date === d ? ' now' : '') }, C.dowName(x.dow), h('br'), C.fmtShort(x.date))))),
      h('tbody', null, g.rows.map(r => h('tr', null, h('th', { class: 'who' }, L.dot(r.comp), r.name, h('div', { class: 'fine' }, r.kind === 'sub' ? (r.cap > 1 ? t('sub, {n} crews', { n: r.cap }) : t('sub')) : t('crew'))),
        r.cells.map((c, i) => h('td', { class: (g.days[i].work ? '' : 'off ') + (c.over ? 'over' : c.items.length ? 'busy' : 'free') }, c.items.map(x => h('a', { href: '#/job/' + x.job.id, class: 'slot' }, x.job.num, h('span', null, tt(x.task.name)))))))))));
    const start = L.date(d, { id: 'ct-start' }), win = L.input({ id: 'ct-window', value: '21', inputmode: 'numeric' }), needs = h('div', { class: 'stack', id: 'ct-needs' });
    const work = st.trades.filter(x => x !== C.INSPECTION);
    const needRow = (trade, days) => h('div', { class: 'row need' }, L.select(work.map(x => [x, tt(x)]), trade, { 'aria-label': t('Trade') }), L.input({ value: String(days), inputmode: 'numeric', 'aria-label': t('Working days'), class: 'short' }), h('span', { class: 'muted small' }, t('days')), h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': t('Remove'), onclick: e => e.target.closest('.need').remove() }, '✕'));
    needs.appendChild(needRow(work.indexOf('Rough-in') >= 0 ? 'Rough-in' : work[0], 3)); needs.appendChild(needRow(work.indexOf('Fixtures and finish') >= 0 ? 'Fixtures and finish' : work[1] || work[0], 2));
    const out = h('div', { id: 'ct-out' }); if (lastCheck) out.appendChild(verdict(lastCheck));
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('h1', null, t('Schedule and capacity')), h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', id: 'go-can-take', onclick: () => { L.$('#can-take').scrollIntoView({ block: 'start' }); L.$('#ct-start').focus({ preventScroll: true }); } }, t('Can we take a job?')), h('button', { class: 'btn', type: 'button', onclick: () => { schedFrom = C.addDays(schedFrom, -7); L.render(); } }, '‹ ' + t('Week')), h('button', { class: 'btn', type: 'button', onclick: () => { schedFrom = null; L.render(); } }, t('This week')), h('button', { class: 'btn', type: 'button', onclick: () => { schedFrom = C.addDays(schedFrom, 7); L.render(); } }, t('Week') + ' ›'))),
      conf.length ? h('div', { class: 'note bad', id: 'conflicts' }, h('b', null, t('Double-booked:') + ' '), conf.map(c => h('div', null, C.whoName(st, c.who) + ': ' + c.items.map(x => x.job.num + ' ' + tt(x.task.name)).join(t(' and ')) + ', ' + C.fmtShort(c.from) + (c.to !== c.from ? ' - ' + C.fmtShort(c.to) : '')))) : null,
      rip.length ? h('div', { class: 'note bad' }, h('b', null, t('Delay ripple:') + ' '), rip.map(r => h('div', null, h('a', { href: '#/job/' + r.job.id + '/schedule' }, r.job.num), ' ' + t('{dep} now ends {end}, but {task} starts {start}. Earliest it can start: {earliest}.', { dep: tt(r.dep.name), end: C.fmtShort(r.dep.end), task: tt(r.task.name), start: C.fmtShort(r.task.start), earliest: C.fmtShort(r.earliest) })))) : null,
      h('section', { class: 'card' }, cal, h('p', { class: 'fine' }, t('Green dot: paperwork in order. Amber: something expires soon. Red: cannot be booked without an override. Subs with more than one crew can take that many jobs a day.'))),
      h('section', { class: 'card', id: 'can-take' }, h('h2', null, t('Can we take this job?')), h('p', { class: 'muted' }, t('List the work in order. Stark Trades looks for your crew first, then compliant subs, and books each step after the one before.')),
        h('div', { class: 'grid2' }, L.field(t('Earliest start'), start), L.field(t('Must finish within (days)'), win)), needs,
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => needs.appendChild(needRow(work[0], 1)) }, t('+ Step')), h('button', { class: 'btn next', type: 'button', id: 'ct-go', onclick: () => {
          const req = { start: start.value || d, windowDays: parseInt(win.value, 10) || 21, needs: L.$$('.need', needs).map(n => ({ trade: n.querySelector('select').value, days: parseInt(n.querySelector('input').value, 10) || 1 })) };
          lastCheck = C.canTakeJob(st, req, d); L.clear(out).appendChild(verdict(lastCheck)); out.scrollIntoView({ block: 'nearest' }); } }, t('Check the dates'))), out));
  };
  function verdict(r) {
    const txt = { yes: t('Yes, you have room.'), partly: t('Partly. Some steps have nobody free.'), no: t('Not in that window.') }[r.verdict];
    return h('div', { class: 'stack' }, h('p', { class: 'verdict ' + r.verdict }, txt, r.finish ? ' ' + t('Earliest finish {date}.', { date: C.fmtDate(r.finish) }) : ''),
      L.table([t('Step'), t('Who'), t('Dates')], r.plan.map(p => h('tr', null, h('td', null, tt(p.trade) + ', ' + tn(p.days, '{n} day', '{n} days')), h('td', null, p.who ? [L.dot(p.comp), p.name, p.kind === 'sub' ? ' (' + t('sub') + ')' : ' (' + t('crew') + ')'] : L.chip(t('Nobody free'), 'red')), h('td', null, p.who ? C.fmtShort(p.start) + ' - ' + C.fmtShort(p.end) : '-')))));
  }
})();
