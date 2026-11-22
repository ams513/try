/* Stark Warden: debt-collection pages, part 1: hub, rights, debt dashboard, contact log with violation flags, complaints. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, S = SW.store, U = SW.util;
  var TABS = {};
  SW.debtTabs = TABS;

  var TZ = [['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona (no DST)'], ['America/Los_Angeles', 'Pacific'],
    ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii']];
  var STATES = Object.keys(SW.data.sol.states).sort();
  var STATE_OPTS = [{ v: '', l: 'Choose a state' }].concat(STATES.map(function (k) { return { v: k, l: SW.data.sol.states[k].name }; }));
  var CHANNELS = [['call', 'Phone call'], ['voicemail', 'Voicemail'], ['text', 'Text message'], ['email', 'Email'], ['letter', 'Letter'], ['inperson', 'In person'], ['thirdparty', 'Contact with someone else about me']];

  function guideCard(g) { return h('a', { class: 'tile', href: '#/learn/' + g.id }, h('strong', { text: g.title }), h('span', { text: g.summary || '' })); }

  /* ---------- Rights ---------- */
  TABS.rights = function (main) {
    var cats = ['debt', 'court', 'medical', 'student'];
    main.appendChild(ui.card('Know your rights', [
      h('p', { class: 'lead', text: 'The Fair Debt Collection Practices Act (FDCPA) and Regulation F decide how debt collectors may treat you. Here is the short version, in plain words.' }),
      h('ul', null,
        h('li', null, h('strong', { text: 'Validation notice. ' }), 'A collector must tell you who it is, who the creditor is, how much, and how to dispute (15 U.S.C. 1692g; 12 CFR 1006.34).'),
        h('li', null, h('strong', { text: '30-day dispute window. ' }), 'Dispute in writing within the period and collection must pause until it verifies the debt.'),
        h('li', null, h('strong', { text: 'Call limits. ' }), 'Not before 8 a.m. or after 9 p.m.; more than 7 calls in 7 days is presumed harassment (12 CFR 1006.14).'),
        h('li', null, h('strong', { text: 'Stop contact. ' }), 'A written request makes it stop, except for limited notices (15 U.S.C. 1692c(c)).'),
        h('li', null, h('strong', { text: 'No threats or lies. ' }), 'No arrest threats, no false claims of being a lawyer or the government, no hidden fees.'),
        h('li', null, h('strong', { text: 'Old debts. ' }), 'A time-barred debt cannot be sued on, and a payment can restart the clock in many states.')),
      ui.notice('None of this makes a valid debt disappear, and no one can promise that it will. Anyone who promises to “erase” your debt is likely running a scam.', 'warn')
    ]));
    cats.forEach(function (c) {
      var gs = SW.data.guides.filter(function (g) { return g.cat === c; }), lab = SW.data.guideCats.filter(function (x) { return x.id === c; })[0].label;
      main.appendChild(ui.card(lab, [h('div', { class: 'tiles' }, gs.map(guideCard))]));
    });
  };

  /* ---------- Profile (shared with the log and letters) ---------- */
  var PROFILE_DEFS = [
    { id: 'name', label: 'Your name' }, { id: 'address', label: 'Your mailing address', type: 'textarea', rows: 2 },
    { id: 'state', label: 'Your state', type: 'select', options: STATE_OPTS }, { id: 'tz', label: 'Your time zone (call times are judged in it)', type: 'select', options: TZ.map(function (t) { return { v: t[0], l: t[1] }; }) },
    { id: 'firstContactDate', label: 'Date of the first contact from the collector', type: 'date' },
    { id: 'noticeReceived', label: 'Did a validation notice arrive?', type: 'select', options: [{ v: '', l: 'Not sure yet' }, { v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }] },
    { id: 'validationEnd', label: 'Validation period end date (from the notice)', type: 'date' },
    { id: 'disputeDate', label: 'Date you sent a written dispute', type: 'date' },
    { id: 'verificationDate', label: 'Date they mailed verification (if they did)', type: 'date' },
    { id: 'ceaseDate', label: 'Date the collector RECEIVED your stop-contact letter', type: 'date' },
    { id: 'workBanDate', label: 'Date you told them not to contact you at work', type: 'date' },
    { id: 'attorneyNoticeDate', label: 'Date you told them you have a lawyer', type: 'date' },
    { id: 'optText', label: 'Date you opted out of text messages', type: 'date' }, { id: 'optEmail', label: 'Date you opted out of email', type: 'date' }, { id: 'optCall', label: 'Date you opted out of calls', type: 'date' }
  ];
  function getProfile() {
    var p = S.get('dprofile', { tz: 'America/New_York' });
    return Object.assign({}, p, { stateName: p.state && SW.data.sol.states[p.state] ? SW.data.sol.states[p.state].name : '', noticeReceived: p.noticeReceived === 'no' ? false : (p.noticeReceived === 'yes' ? true : undefined),
      optOut: { text: p.optText || '', email: p.optEmail || '', call: p.optCall || '', voicemail: p.optCall || '' } });
  }
  function profileForm(onSave) {
    var f = ui.form(PROFILE_DEFS, S.get('dprofile', { tz: 'America/New_York' }));
    return ui.card('Your situation (kept on this device)', [h('p', { class: 'small', text: 'These dates drive the violation flags in the log, the letters, and the dispute deadlines. Fill what you know.' }), f.el,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { S.set('dprofile', f.read()); ui.toast('Saved.'); if (onSave) { onSave(); } } }, 'Save'))]);
  }
  SW.debtProfile = getProfile;

  /* ---------- Debt dashboard ---------- */
  var DEBT_DEFS = [
    { id: 'creditor', label: 'Original creditor' }, { id: 'collector', label: 'Collector or debt buyer now' },
    { id: 'type', label: 'Debt type (for the time limit)', type: 'select', options: SW.data.sol.types.map(function (t) { return { v: t.id, l: t.label }; }) },
    { id: 'state', label: 'State whose law applies (usually where you lived)', type: 'select', options: STATE_OPTS },
    { id: 'original', label: 'Original amount', type: 'money' }, { id: 'balance', label: 'Amount claimed now', type: 'money' }, { id: 'apr', label: 'Interest rate (APR %)', type: 'number' }, { id: 'min', label: 'Minimum or agreed monthly payment', type: 'money' },
    { id: 'dofd', label: 'First missed payment (date of first delinquency)', type: 'date' }, { id: 'lastPay', label: 'Last payment or acknowledgement', type: 'date' }, { id: 'chargeOff', label: 'Charge-off date', type: 'date' },
    { id: 'dEq', label: 'First-delinquency date shown by Equifax', type: 'date' }, { id: 'dEx', label: '...by Experian', type: 'date' }, { id: 'dTu', label: '...by TransUnion', type: 'date' }, { id: 'dCol', label: '...in the collector’s letter', type: 'date' },
    { id: 'sold', label: 'It has been sold or transferred', type: 'checkbox' }, { id: 'unfamiliar', label: 'I do not recognise the creditor or collector', type: 'checkbox' },
    { id: 'noOrig', label: 'No one has named the original creditor', type: 'checkbox' }, { id: 'notes', label: 'Notes', type: 'textarea', rows: 2 }
  ];
  function num(x) { var n = parseFloat(String(x).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; }

  function debtSummary(d) {
    var start = d.lastPay || d.dofd, sol = d.state && start ? SW.sol.evaluate({ state: d.state, type: d.type, start: start, now: ui.today() }) : null,
      dates = [['Equifax', d.dEq], ['Experian', d.dEx], ['TransUnion', d.dTu], ['Collector letter', d.dCol]].filter(function (x) { return x[1]; }).map(function (x) { return { label: x[0], date: x[1] }; }),
      re = SW.sol.reage(dates), years = d.dofd ? SW.sol.diffDays(SW.sol.parseDate(d.dofd), SW.sol.parseDate(ui.today())) / 365.25 : 0,
      z = SW.sol.zombie({ timeBarred: sol && sol.status === 'expired', ageYears: years, sold: d.sold, unfamiliar: d.unfamiliar, amountUp: num(d.balance) > num(d.original) * 1.15 && num(d.original) > 0, noOriginalCreditor: d.noOrig, datesMoved: re.differs });
    return { sol: sol, re: re, z: z, drop: d.dofd ? SW.sol.reportingDropOff(d.dofd) : null };
  }

  TABS.dash = function (main) {
    var debts = S.get('debts', []), listBox = h('div'), editing = null, f = ui.form(DEBT_DEFS, { type: 'open' }), formCard;
    function save() { S.set('debts', debts); draw(); }
    function draw() {
      var tot = debts.reduce(function (s, d) { return s + num(d.balance); }, 0), mins = debts.reduce(function (s, d) { return s + num(d.min); }, 0);
      ui.clear(listBox);
      listBox.appendChild(ui.card('Your debts', [h('div', { class: 'stats' }, h('div', null, h('strong', { text: U.money(tot) }), h('span', { text: 'total claimed' })), h('div', null, h('strong', { text: U.money(mins) }), h('span', { text: 'monthly payments' })), h('div', null, h('strong', { text: String(debts.length) }), h('span', { text: 'debts tracked' }))),
        debts.length ? null : h('p', { class: 'muted', text: 'No debts yet. Add one below.' })]));
      debts.forEach(function (d, i) {
        var s = debtSummary(d), c = h('section', { class: 'card debt' });
        c.appendChild(h('div', { class: 'row between' }, h('h3', { text: (d.collector || d.creditor || 'Debt') + (d.creditor && d.collector ? ' (from ' + d.creditor + ')' : '') }), h('strong', { text: U.money(num(d.balance)) })));
        if (s.sol && !s.sol.error) {
          c.appendChild(h('p', null, h('span', { class: 'badge ' + (s.sol.status === 'expired' ? 'lv-caution' : 'lv-low'), text: s.sol.status === 'expired' ? 'May be time-barred' : (s.sol.status === 'soon' ? 'Time limit within 6 months' : 'Within the time limit') }), ' ', s.sol.years + ' years in ' + s.sol.state.name + '; estimated limit ' + s.sol.expiry + '.'));
        } else { c.appendChild(h('p', { class: 'muted', text: 'Add a state and a date to see the time limit.' })); }
        if (s.drop) { c.appendChild(h('p', null, 'Credit reporting: this item should drop off around ', h('strong', { text: s.drop }), ' (seven years plus 180 days from the first missed payment).')); }
        if (s.re.enough) { c.appendChild(h('p', { class: s.re.differs ? 'warn-text' : 'ok' }, s.re.differs ? 'Possible re-aging: the first-delinquency dates differ by ' + s.re.spreadDays + ' days (' + s.re.flagged.map(function (x) { return x.label + ' ' + x.date; }).join(', ') + ' later than ' + s.re.earliest.label + ' ' + s.re.earliest.date + '). Dispute the later dates.' : 'The first-delinquency dates agree across the sources you entered.')); }
        c.appendChild(h('p', null, h('strong', { text: 'Zombie-debt screen: ' + ({ low: 'few signs', possible: 'some signs', high: 'many signs' }[s.z.level]) + '. ' }), s.z.flags.join(' ')));
        c.appendChild(h('div', { class: 'row' }, h('a', { class: 'btn small', href: '#/debt/letters/validation' }, 'Dispute letter'), h('a', { class: 'btn small', href: '#/debt/letters/chain' }, 'Chain-of-title letter'),
          h('button', { type: 'button', class: 'btn small', onclick: function () { editing = i; f.set(Object.assign({}, d)); formCard.querySelector('h3').textContent = 'Edit this debt'; formCard.scrollIntoView({ behavior: 'smooth' }); } }, 'Edit'),
          h('button', { type: 'button', class: 'btn small danger', onclick: function () { debts.splice(i, 1); save(); } }, 'Delete')));
        listBox.appendChild(c);
      });
    }
    formCard = ui.card('Add a debt', [f.el, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
      var v = f.read(); if (!v.creditor && !v.collector) { ui.toast('Enter a creditor or a collector.'); return; }
      if (editing != null) { debts[editing] = v; editing = null; } else { debts.push(v); }
      save(); ui.toast('Saved.');
    } }, 'Save debt'))]);
    main.appendChild(ui.card(null, [h('p', { class: 'lead', text: 'Keep every debt in one place. The dashboard estimates each time limit, when the item should leave your credit report, and whether dates were re-aged or the debt shows zombie-debt signs.' }), ui.notice('Estimates, not legal conclusions. Verify with your state attorney general or an attorney.', 'soft')]));
    main.appendChild(listBox);
    main.appendChild(formCard);
    draw();
  };

  /* ---------- Contact log and violation flags ---------- */
  var ENTRY_DEFS = [
    { id: 'at', label: 'Date and time (your local time)', type: 'datetime-local' }, { id: 'channel', label: 'How they contacted you', type: 'select', options: CHANNELS.map(function (c) { return { v: c[0], l: c[1] }; }) },
    { id: 'dir', label: 'Who started it', type: 'select', options: [{ v: 'collector', l: 'The collector' }, { v: 'consumer', l: 'I did' }] },
    { id: 'collector', label: 'Collector name' }, { id: 'phone', label: 'Phone number shown' }, { id: 'debtRef', label: 'Which debt (reference or nickname)' }, { id: 'thirdPartyName', label: 'If someone else was contacted: who' },
    { id: 'spoke', label: 'I spoke with someone', type: 'checkbox' }, { id: 'atWork', label: 'It reached me at work', type: 'checkbox' }, { id: 'demandsPayment', label: 'They demanded payment', type: 'checkbox' },
    { id: 'permittedException', label: 'It was only to confirm they would stop, or to say they will sue or use another specific remedy', type: 'checkbox' },
    { id: 'notes', label: 'What was said or written (as exactly as you can)', type: 'textarea', rows: 3, wide: true }
  ];

  TABS.log = function (main) {
    var entries = S.list('log'), MAX_LOG = 5000, SHOW = 300, showAll = false, listBox = h('div'), vioBox = h('div'), packBox = h('div'),
      flagDefs = Object.keys(SW.violations.FLAGS).map(function (k) { return { id: k, label: SW.violations.FLAGS[k].t, type: 'checkbox' }; }),
      f = ui.form(ENTRY_DEFS, { channel: 'call', dir: 'collector' }), ff = ui.form(flagDefs, {});
    function violations() {
      var prof = getProfile();
      return SW.violations.evaluate(entries.map(function (e) { return Object.assign({}, e, { dir: e.dir === 'consumer' ? 'consumer' : 'to' }); }), prof, new Date().toISOString());
    }
    /* full version only */
    function draw() {
      var v = violations(), sorted = entries.slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }), idx = new Map(), flaggedIds = {}, shown, tz = getProfile().tz;
      entries.forEach(function (e, i) { idx.set(e, i); });
      v.forEach(function (x) { x.entryIds.forEach(function (id) { flaggedIds[id] = true; }); });
      shown = showAll ? sorted : sorted.slice(0, SHOW);
      ui.clear(listBox); ui.clear(vioBox);
      vioBox.appendChild(ui.card('Possible violations flagged (' + v.length + ')', [
        v.length ? h('ul', { class: 'flags' }, v.map(function (x) { return h('li', { class: 'flag w' + (x.severity === 'likely' ? 4 : 2) }, h('div', { class: 'flag-head' }, h('strong', { text: x.title }), h('span', { class: 'badge ' + (x.severity === 'likely' ? 'lv-high' : 'lv-caution'), text: x.severity === 'likely' ? 'likely' : 'possible' })), h('p', { text: x.why }), h('p', { class: 'small' }, 'Rule: ' + x.cite)); })) : h('p', { class: 'muted', text: 'Nothing flagged yet. Log every contact and fill “Your situation” above to get accurate flags.' }),
        SW.violations.DISCLAIMER && ui.notice(SW.violations.DISCLAIMER, 'soft')]));
      listBox.appendChild(ui.card('Your log (' + entries.length + ')', [entries.length ? null : h('p', { class: 'muted', text: 'No entries yet.' }), shown.map(function (e) {
        var realIdx = idx.get(e), p = SW.violations.localParts(e.at, tz), flagged = !!flaggedIds[e.id];
        return h('div', { class: 'logrow' + (flagged ? ' flagged' : '') }, h('div', { class: 'row between' }, h('strong', { text: (p ? p.day + ' ' + U.pad2(p.h) + ':' + U.pad2(p.mi) : e.at) + ' · ' + (CHANNELS.filter(function (c) { return c[0] === e.channel; })[0] || [0, e.channel])[1] + (e.collector ? ' · ' + e.collector : '') }),
          h('button', { type: 'button', class: 'btn small danger', onclick: function () { entries.splice(realIdx, 1); S.set('log', entries); draw(); } }, 'Delete')),
          flagged ? h('span', { class: 'badge lv-high', text: 'flagged' }) : null, e.notes ? h('p', { class: 'small', text: e.notes }) : null);
      }), shown.length < sorted.length ? h('button', { type: 'button', class: 'btn small', onclick: function () { showAll = true; draw(); } }, 'Show all ' + sorted.length + ' entries (newest ' + SHOW + ' shown)') : null]));
    }
    function showPacket() { window.StarkTrial.show('evidence_packet'); }
    main.appendChild(ui.card(null, [h('p', { class: 'lead', text: 'Write down every call, voicemail, text, email and letter as soon as it happens. The log checks them against call-time limits, the 7-calls-in-7-days rule, and your cease, dispute and work-contact dates.' }), ui.disclaimerBar()]));
    main.appendChild(profileForm(draw));
    var addCard = ui.card('Add a contact', [f.el, h('details', null, h('summary', { text: 'Did they do any of these? (tick all that apply)' }), ff.el),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var v = f.read(), flags = ff.read(), k;
        if (!v.at) { f.error('at', 'Enter the date and time.'); return; }
        f.error('at', '');
        if (entries.length >= MAX_LOG) { ui.toast('The log holds up to ' + MAX_LOG + ' entries. Export it, then delete old entries to add more.', 'bad'); return; }
        if (!SW.trial.canAdd(entries.length)) { ui.toast(SW.trial.blockedMessage(), 'bad'); return; }
        v.id = ui.uid(); v.flags = {}; for (k in flags) { if (flags[k]) { v.flags[k] = true; } }
        entries.push(v); S.set('log', entries); draw(); f.set({ notes: '', spoke: false, atWork: false, demandsPayment: false, permittedException: false }); ff.set({}); Object.keys(ff.inputs).forEach(function (x) { ff.inputs[x].checked = false; }); ui.toast('Added.');
      } }, 'Add to log'))]);
    main.appendChild(addCard);
    main.appendChild(vioBox);
    main.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: showPacket }, 'Build evidence packet'), h('a', { class: 'btn', href: '#/debt/timeline' }, 'See the timeline and chart'), h('a', { class: 'btn', href: '#/debt/complaint' }, 'Draft a complaint'),
      h('a', { class: 'btn', href: '#/insights' }, 'Call patterns and live call budget'),
      h('button', { type: 'button', class: 'btn', onclick: function () { ui.saveText('contact-log.json', JSON.stringify(entries, null, 2), 'application/json'); } }, 'Export log (.json)'),
      h('button', { type: 'button', class: 'btn', onclick: function () {
        var head = ['at', 'channel', 'dir', 'collector', 'phone', 'debtRef', 'spoke', 'atWork', 'demandsPayment', 'notes'];
        ui.saveText('contact-log.csv', head.join(',') + '\n' + entries.map(function (e) { return head.map(function (k) { return '"' + String(e[k] == null ? '' : e[k]).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'), 'text/csv;charset=utf-8');
      } }, 'Export log (.csv)')));
    main.appendChild(packBox);
    main.appendChild(listBox);
    draw();
  };

  /* ---------- Complaint generator ---------- */
  TABS.complaint = function (main) { main.appendChild(window.StarkTrial.card('evidence_packet')); };
  /* ---------- Hub ---------- */
  var LABELS = [{ id: 'rights', label: 'Rights' }, { id: 'verify', label: 'Is it real?' }, { id: 'log', label: 'Contact log' }, { id: 'timeline', label: 'Timeline' }, { id: 'letters', label: 'Letters' },
    { id: 'complaint', label: 'Complaints' }, { id: 'negotiate', label: 'Negotiate' }, { id: 'medical', label: 'Medical bills' }, { id: 'sued', label: 'If you are sued' }, { id: 'dash', label: 'My debts' },
    { id: 'limits', label: 'Time limits' }, { id: 'dates', label: 'Deadlines' }, { id: 'plan', label: 'Calculators' }, { id: 'collectors', label: 'Collectors' }];
  ui.route('debt', 'Debt help', function (main, args) {
    var t = args[0] && TABS[args[0]] ? args[0] : 'rights';
    main.appendChild(h('h2', { text: 'Debt collection help (United States)' }));
    main.appendChild(ui.tabs(LABELS, t, 'debt'));
    main.appendChild(h('p', { class: 'small', text: 'General information, not legal advice. Federal rules as of ' + SW.data.meta.asOfLabel + '. Check the date.' }));
    TABS[t](main, args.slice(1));
  });
})(typeof window !== 'undefined' ? window : globalThis);
