/* Stark Warden: debt-collection pages, part 2: deadlines, time limits, letters, settle and plan, collector notebook. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, S = SW.store, U = SW.util, TABS = SW.debtTabs;
  var STATES = Object.keys(SW.data.sol.states).sort();
  var STATE_OPTS = [{ v: '', l: 'Choose a state' }].concat(STATES.map(function (k) { return { v: k, l: SW.data.sol.states[k].name }; }));
  function num(x) { var n = parseFloat(String(x).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; }
  function daysFromNow(date) { return SW.sol.diffDays(SW.sol.parseDate(ui.today()), SW.sol.parseDate(date)); }

  /* ---------- Deadlines, mail tracker, court dates, calendar export ---------- */
  TABS.dates = function (main) {
    var dl = S.get('deadlines', []), mail = S.get('mail', []), court = S.get('court', []), listBox = h('div'), winBox = h('div');
    function allEvents() {
      var ev = dl.map(function (d) { return { id: d.id, date: d.date, title: d.title, desc: d.note || '' }; });
      court.forEach(function (c) { ev.push({ id: c.id, date: c.date, title: 'Court: ' + (c.court || 'hearing') + (c.time ? ' at ' + c.time : ''), desc: (c.caseNo ? 'Case ' + c.caseNo + '. ' : '') + (c.notes || '') }); });
      mail.forEach(function (m) { if (m.sent) { ev.push({ id: m.id, date: SW.sol.fmt(SW.sol.addDays(SW.sol.parseDate(m.sent), 30)), title: 'Follow up: ' + m.letter, desc: 'Sent ' + m.sent + (m.tracking ? ', tracking ' + m.tracking : '') + '. Check for a response and the return receipt.' }); } });
      return ev.filter(function (e) { return SW.sol.parseDate(e.date); }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    }
    function draw() {
      var ev = allEvents();
      ui.clear(listBox);
      listBox.appendChild(ui.card('Upcoming dates', [ev.length ? h('ul', { class: 'dated' }, ev.map(function (e) {
        var d = daysFromNow(e.date); return h('li', { class: d < 0 ? 'past' : (d <= 7 ? 'soon' : '') }, h('strong', { text: e.date }), ' ', e.title, h('span', { class: 'small', text: d < 0 ? ' (' + (-d) + ' days ago)' : (d === 0 ? ' (today)' : ' (in ' + d + ' days)') }));
      })) : h('p', { class: 'muted', text: 'Nothing yet.' }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { ui.saveText('warden-deadlines.ics', SW.deadlines.toICS(allEvents()), 'text/calendar;charset=utf-8'); } }, 'Export calendar (.ics)'),
        h('button', { type: 'button', class: 'btn', onclick: function () { ui.copyText(SW.deadlines.toICS(allEvents())); } }, 'Copy calendar text')),
      h('p', { class: 'small', text: 'The .ics file opens in Google Calendar, Apple Calendar and Outlook. Each date has a reminder one day before.' })]));
    }
    var sent = h('input', { type: 'date', id: 'vw-sent' }), stated = h('input', { type: 'date', id: 'vw-end' });
    main.appendChild(ui.card('Validation period calculator', [
      h('p', { class: 'lead', text: 'The validation period is 30 days from when you receive (or are assumed to receive) the collector’s notice. Regulation F lets the collector assume you received it five business days after sending.' }),
      h('div', { class: 'grid2' }, h('div', { class: 'field' }, h('label', { for: 'vw-sent', text: 'Date on the notice (or when it was mailed)' }), sent), h('div', { class: 'field' }, h('label', { for: 'vw-end', text: 'End date printed on the notice, if any' }), stated)),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var w = SW.deadlines.validationWindow(sent.value, stated.value); ui.clear(winBox);
        if (!w) { winBox.appendChild(ui.notice('Enter the date on the notice.', 'soft')); return; }
        var by = SW.sol.fmt(SW.sol.addDays(SW.sol.parseDate(w.endsOn), -7));
        winBox.appendChild(h('div', { class: 'card result' }, h('p', null, 'Assumed received: ', h('strong', { text: w.assumedReceived })), h('p', null, 'Validation period ends: ', h('strong', { text: w.endsOn })), h('p', null, 'Mail your dispute by about: ', h('strong', { text: by }), ' (a week early, certified mail).'),
          h('p', { class: 'small', text: w.note }), h('p', { class: 'small', text: 'If you dispute in writing before the end date, the collector must stop collection until it mails you verification (15 U.S.C. 1692g(b); 12 CFR 1006.38).' }),
          h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: function () {
            dl.push({ id: ui.uid(), date: by, title: 'Mail dispute letter (validation ends ' + w.endsOn + ')', note: 'Send certified mail, return receipt.' }); dl.push({ id: ui.uid(), date: w.endsOn, title: 'Validation period ends', note: '' }); S.set('deadlines', dl); draw(); ui.toast('Added to your dates.');
          } }, 'Add both dates to my list'))));
      } }, 'Calculate'))]));
    main.appendChild(winBox);
    var df = ui.form([{ id: 'date', label: 'Date', type: 'date' }, { id: 'title', label: 'What is due', wide: true }, { id: 'note', label: 'Notes', wide: true }], {});
    main.appendChild(ui.card('Add a date', [df.el, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { var v = df.read(); if (!v.date || !v.title) { ui.toast('Enter a date and a title.'); return; } v.id = ui.uid(); dl.push(v); S.set('deadlines', dl); draw(); } }, 'Add'))]));
    var mf = ui.form([{ id: 'letter', label: 'Which letter' }, { id: 'sent', label: 'Date mailed', type: 'date' }, { id: 'tracking', label: 'Certified mail number' }, { id: 'delivered', label: 'Date delivered (from the return receipt)', type: 'date' }], {}), mailBox = h('div');
    function drawMail() {
      ui.clear(mailBox);
      mail.forEach(function (m, i) { mailBox.appendChild(h('div', { class: 'logrow' }, h('strong', { text: m.letter }), ' sent ' + m.sent + (m.tracking ? ', no. ' + m.tracking : '') + (m.delivered ? ', delivered ' + m.delivered : ', not yet delivered'),
        h('button', { type: 'button', class: 'btn small danger', onclick: function () { mail.splice(i, 1); S.set('mail', mail); drawMail(); draw(); } }, 'Delete'))); });
    }
    main.appendChild(ui.card('Letter mail tracker', [h('p', { class: 'small', text: 'The collector’s duty to stop contact starts when it RECEIVES your cease letter, so keep the return-receipt date and enter it in “Your situation” on the Contact log tab.' }), mf.el,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { var v = mf.read(); if (!v.letter || !v.sent) { ui.toast('Enter the letter and the date mailed.'); return; } v.id = ui.uid(); mail.push(v); S.set('mail', mail); drawMail(); draw(); } }, 'Add')), mailBox]));
    var cf = ui.form([{ id: 'date', label: 'Hearing date', type: 'date' }, { id: 'time', label: 'Time' }, { id: 'court', label: 'Court' }, { id: 'caseNo', label: 'Case number' }, { id: 'notes', label: 'Notes', wide: true }], {}), courtBox = h('div');
    function drawCourt() {
      ui.clear(courtBox);
      court.forEach(function (c, i) { courtBox.appendChild(h('div', { class: 'logrow' }, h('strong', { text: c.date }), ' ' + (c.time || '') + ' ' + (c.court || '') + ' ' + (c.caseNo ? '(case ' + c.caseNo + ')' : ''), h('button', { type: 'button', class: 'btn small danger', onclick: function () { court.splice(i, 1); S.set('court', court); drawCourt(); draw(); } }, 'Delete'))); });
    }
    main.appendChild(ui.card('Court dates', [h('p', { class: 'small', text: 'If you have been sued, the answer deadline on the summons is critical. Add it as a date above, and go to every hearing.' }), cf.el,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { var v = cf.read(); if (!v.date) { ui.toast('Enter the hearing date.'); return; } v.id = ui.uid(); court.push(v); S.set('court', court); drawCourt(); draw(); } }, 'Add')), courtBox, h('a', { href: '#/learn/judgment', text: 'Read: I have been sued, response checklist' })]));
    main.appendChild(listBox);
    drawMail(); drawCourt(); draw();
  };

  /* ---------- Time limits (statute of limitations) ---------- */
  TABS.limits = function (main) {
    var st = h('select', { id: 'sl-st' }, STATE_OPTS.map(function (o) { return h('option', { value: o.v }, o.l); })), ty = h('select', { id: 'sl-ty' }, SW.data.sol.types.map(function (t) { return h('option', { value: t.id }, t.label); })),
      dt = h('input', { type: 'date', id: 'sl-dt' }), out = h('div'), tableBox = h('div'), prof = SW.debtProfile();
    if (prof.state) { st.value = prof.state; }
    function run() {
      var r = SW.sol.evaluate({ state: st.value, type: ty.value, start: dt.value, now: ui.today() }); ui.clear(out);
      if (r.error) { out.appendChild(ui.notice(r.error, 'soft')); return; }
      S.set('stat:limit', true);
      var cls = r.status === 'expired' ? 'caution' : (r.status === 'soon' ? 'high' : 'low');
      out.appendChild(h('div', { class: 'card result' }, h('p', null, h('span', { class: 'badge lv-' + cls, text: r.status === 'expired' ? 'Probably past the time limit' : (r.status === 'soon' ? 'Limit ends within 6 months' : 'Probably still within the time limit') })),
        h('p', null, r.state.name + ': ' + r.years + ' years for this type. Estimated end date: ', h('strong', { text: r.expiry }), r.daysLeft >= 0 ? ' (in ' + r.daysLeft + ' days).' : ' (' + (-r.daysLeft) + ' days ago).'),
        h('ul', null, r.warnings.map(function (w) { return h('li', { text: w }); })), ui.notice(SW.data.sol.sourceNote, 'soft')));
    }
    function drawTable() {
      var key = ty.value;
      ui.clear(tableBox);
      tableBox.appendChild(ui.table(['State', 'Years', 'Check'], STATES.map(function (k) { var s = SW.data.sol.states[k]; return [s.name, String(s[key]), s.check ? 'Sources differ: verify' : '']; })));
    }
    ty.addEventListener('change', drawTable);
    main.appendChild(ui.card('Statute of limitations checker', [
      h('p', { class: 'lead', text: 'After the time limit, a collector generally cannot win a lawsuit on the debt, but the debt does not vanish and a payment can restart the clock in many states.' }),
      h('div', { class: 'grid2' }, h('div', { class: 'field' }, h('label', { for: 'sl-st', text: 'State' }), st), h('div', { class: 'field' }, h('label', { for: 'sl-ty', text: 'Debt type' }), ty)),
      h('div', { class: 'field' }, h('label', { for: 'sl-dt', text: 'Date of your last payment (or the date you stopped paying)' }), dt),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: run }, 'Check time limit')),
      ui.notice('Do not pay or sign anything on an old debt until you have confirmed the time limit with your state attorney general, legal aid or an attorney. The table is a summary as of ' + SW.data.sol.asOf + ' and states change their laws.', 'warn')
    ]));
    main.appendChild(out);
    main.appendChild(ui.card('All states for the type above', [tableBox, h('p', { class: 'small', text: SW.data.sol.sourceNote }), ui.copyLine('naag.org/find-my-ag/')]));
    drawTable();
  };

  TABS.letters = function (main) { main.appendChild(window.StarkTrial.card('letters')); };
  /* ---------- Settle and plan: calculators ---------- */
  function calcCard(title, intro, defs, run, vals) {
    var f = ui.form(defs, vals || {}), out = h('div');
    return ui.card(title, [h('p', { class: 'small', text: intro }), f.el, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { ui.clear(out); out.appendChild(run(f.read())); } }, 'Calculate')), out]);
  }
  function res(lines) { return h('div', { class: 'card result' }, lines.map(function (l) { return typeof l === 'string' ? h('p', { text: l }) : l; })); }

  TABS.plan = function (main) {
    var debts = S.get('debts', []);
    main.appendChild(ui.card(null, [h('p', { class: 'lead', text: 'Work out what you can afford, in what order, and what a settlement really costs. These are estimates for planning, not offers from anyone.' }), ui.notice('Never pay on a spoken promise. Get any settlement in writing before you pay a cent, and pay by a traceable method. No one can guarantee that a settlement removes a debt from your credit report.', 'warn')]));
    main.appendChild(calcCard('Payoff calculator', 'How long will one balance take, and how much interest will it cost?', [{ id: 'bal', label: 'Balance', type: 'money' }, { id: 'apr', label: 'APR %', type: 'number' }, { id: 'pay', label: 'Monthly payment', type: 'money' }], function (v) {
      var r = SW.calc.payoff(v.bal, v.apr, v.pay);
      return r.never ? res(['That payment does not cover the monthly interest, so the balance would never fall.']) : res(['Months to pay off: ' + r.months + ' (about ' + (r.months / 12).toFixed(1) + ' years).', 'Total interest: ' + U.money(r.totalInterest), 'Total paid: ' + U.money(r.totalPaid)]);
    }));
    main.appendChild(calcCard('Snowball or avalanche?', 'Uses the debts on your dashboard (' + debts.length + ' with a balance). Snowball pays the smallest balance first; avalanche pays the highest rate first.', [{ id: 'extra', label: 'Extra you can add each month', type: 'money' }], function (v) {
      var list = debts.filter(function (d) { return num(d.balance) > 0; }).map(function (d) { return { name: d.collector || d.creditor, balance: num(d.balance), apr: num(d.apr), min: num(d.min) }; }), r;
      if (!list.length) { return ui.notice('Add debts with balances on the My debts tab first.', 'soft'); }
      r = SW.calc.strategies(list, v.extra);
      if (r.snowball.never || r.avalanche.never) { return res(['Your payments do not cover the interest on at least one debt. Raise the monthly amount or ask the creditors about a hardship plan.']); }
      return res(['Snowball: ' + r.snowball.months + ' months, interest ' + U.money(r.snowball.interest), 'Avalanche: ' + r.avalanche.months + ' months, interest ' + U.money(r.avalanche.interest), 'Avalanche saves ' + U.money(r.snowball.interest - r.avalanche.interest) + ' in interest; snowball gives quicker wins. Pick the one you will stick to.', 'Avalanche order: ' + r.avalanche.order.join(', ')]);
    }));
    main.appendChild(calcCard('Lump sum or payment plan?', 'Compare paying a one-time settlement with paying the whole balance over time.', [{ id: 'balance', label: 'Amount they claim', type: 'money' }, { id: 'lump', label: 'Lump-sum offer', type: 'money' }, { id: 'planMonthly', label: 'Plan: monthly payment', type: 'money' }, { id: 'planMonths', label: 'Plan: number of months', type: 'number' }], function (v) {
      var r = SW.calc.lumpVsPlan(v);
      return res(['Lump sum is ' + r.pctOfBalance + '% of the claimed balance (' + U.money(r.lump) + ').', 'The plan would cost ' + U.money(r.planTotal) + ' in total, which is ' + U.money(r.planVsLump) + ' more than the lump sum.', 'Amount cancelled by a lump-sum settlement: ' + U.money(r.cancelled)].concat(r.notes.map(function (n) { return h('p', { class: 'small', text: n }); })));
    }));
    main.appendChild(calcCard('Interest and fee calculator', 'Check what a collector or lender added. Interest and fees must be allowed by your agreement or by law.', [{ id: 'principal', label: 'Principal', type: 'money' }, { id: 'apr', label: 'APR %', type: 'number' }, { id: 'days', label: 'Days', type: 'number' }, { id: 'fee1', label: 'Fee 1', type: 'money' }, { id: 'fee2', label: 'Fee 2', type: 'money' }, { id: 'fee3', label: 'Fee 3', type: 'money' }], function (v) {
      var i = SW.calc.simpleInterest(v.principal, v.apr, v.days), fees = SW.calc.feeTotal([{ amount: v.fee1 }, { amount: v.fee2 }, { amount: v.fee3 }]);
      return res(['Simple interest for ' + v.days + ' days: ' + U.money(i), 'Fees: ' + U.money(fees), 'Principal + interest + fees: ' + U.money(num(v.principal) + i + fees), 'If the collector’s total is much higher, ask for an itemization (Regulation F requires one in the validation notice).']);
    }));
    main.appendChild(calcCard('Wage garnishment limit', 'Federal cap for most consumer debts: the lesser of 25% of weekly disposable earnings, or the amount above 30 times the federal minimum wage. Your state may protect more.', [{ id: 'weekly', label: 'Weekly take-home after required deductions', type: 'money' }, { id: 'minWage', label: 'Minimum wage (federal is 7.25)', type: 'number' }], function (v) {
      var r = SW.calc.garnishmentCap(v.weekly, v.minWage || 7.25);
      return res(['Most that can be taken per week: ' + U.money(r.cap), '25% of your pay: ' + U.money(r.quarter) + '; pay above ' + U.money(r.protectedFloor) + ': ' + U.money(r.overFloor), 'Social Security, SSI, VA and similar benefits are generally protected from private creditors.']);
    }, { minWage: '7.25' }));
    main.appendChild(ui.card('Which debts first?', [h('ul', null, h('li', { text: 'Protect essentials first: housing, utilities, food, transportation to work, insurance, child support and taxes.' }), h('li', { text: 'Secured debts (car, mortgage) can cost you the asset; federal student loans and taxes have strong collection powers.' }), h('li', { text: 'Old collection accounts and unsecured credit cards usually come after, and may be negotiable or past the time limit.' }), h('li', { text: 'If you cannot cover the essentials, do not pay a collector first. Ask a nonprofit credit counselor.' })),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/debt/letters/hardship' }, 'Hardship letter'), h('a', { class: 'btn', href: '#/debt/letters/settlement' }, 'Settlement letter'), h('a', { class: 'btn', href: '#/debt/letters/payfordelete' }, 'Pay-for-delete letter'), h('a', { class: 'btn', href: '#/life/budget' }, 'Budget')),
      h('p', { class: 'small' }, 'Nonprofit credit counseling: nfcc.org. Bankruptcy basics: ', h('a', { href: '#/learn/bankruptcy', text: 'read the guide' }), ' and then see an attorney.'), ui.copyLine('nfcc.org')]));
  };

  /* ---------- Collector notebook and recording laws ---------- */
  TABS.collectors = function (main) {
    var list = S.get('collectors', []), box = h('div'), f = ui.form([{ id: 'name', label: 'Company name' }, { id: 'address', label: 'Mailing address' }, { id: 'phones', label: 'Phone numbers they use' }, { id: 'license', label: 'State collection license number (if any)' },
      { id: 'licenseOk', label: 'I checked the license with my state', type: 'checkbox' }, { id: 'sentValidation', label: 'Did they send a validation notice?', type: 'select', options: [{ v: '', l: 'Not sure' }, { v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }] },
      { id: 'complaints', label: 'Complaints you found about them (CFPB database, state regulator, reviews)', type: 'textarea', rows: 3, wide: true }, { id: 'notes', label: 'Notes', type: 'textarea', rows: 2, wide: true }], {});
    function draw() {
      ui.clear(box);
      list.forEach(function (c, i) { box.appendChild(ui.card(c.name || 'Collector', [h('p', { class: 'small', text: [c.address, c.phones, c.license ? 'License ' + c.license + (c.licenseOk ? ' (checked)' : ' (not checked)') : 'No license number', c.sentValidation ? 'Validation notice: ' + c.sentValidation : ''].filter(Boolean).join(' · ') }), c.complaints ? h('p', { text: c.complaints }) : null,
        h('button', { type: 'button', class: 'btn small danger', onclick: function () { list.splice(i, 1); S.set('collectors', list); draw(); } }, 'Delete')])); });
    }
    main.appendChild(ui.card('Collector notebook', [h('p', { class: 'lead', text: 'Keep what you learn about each collector in one place. Many states license debt collectors; check your state regulator or attorney general, and the NMLS consumer access site for some licenses.' }), ui.copyLine('nmlsconsumeraccess.org'), f.el,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { var v = f.read(); if (!v.name) { ui.toast('Enter a company name.'); return; } list.push(v); S.set('collectors', list); draw(); } }, 'Add collector'))]));
    main.appendChild(box);
    var st = h('select', { id: 'rec-st' }, STATE_OPTS.map(function (o) { return h('option', { value: o.v }, o.l); })), out = h('div');
    st.addEventListener('change', function () {
      var c = SW.data.consent, k = st.value, s = SW.data.sol.states[k]; ui.clear(out);
      if (!k) { return; }
      out.appendChild(h('div', { class: 'card result' }, h('p', null, h('strong', { text: s.name + ': ' }), c.allParty.indexOf(k) >= 0 ? 'all-party (two-party) consent. Everyone on the call must agree to be recorded.' : (c.special[k] || 'one-party consent. You may record a call you are part of.')),
        h('p', { class: 'small', text: 'If the other person is in a different state, follow the stricter rule. When in doubt, say “I am recording this call” at the start. This is general information, not legal advice. Checked ' + c.asOf + '.' })));
    });
    main.appendChild(ui.card('Can I record the call?', [h('div', { class: 'field' }, h('label', { for: 'rec-st', text: 'Your state' }), st), out, h('a', { href: '#/learn/recording', text: 'Read the recording guide' }), ' · ', h('a', { href: '#/learn/scripts', text: 'Call scripts: what to say' })]));
  };
})(typeof window !== 'undefined' ? window : globalThis);
