/* Stark Warden 2.0: negotiation coach, medical debt shield, lawsuit-ready packet, scam pattern library, identity-theft plan. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, S = SW.store, U = SW.util, TABS = SW.debtTabs;
  function num(x) { var n = parseFloat(String(x).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; }
  function merge(key, vals) { var cur = S.get(key, {}), k; for (k in vals) { if (vals[k] !== '' && vals[k] != null) { cur[k] = vals[k]; } } S.set(key, cur); }
  function fact(f) { return h('li', null, h('span', { text: f.t }), h('span', { class: 'src', text: 'Source: ' + f.cite + ' · as of ' + SW.data.meta.asOfLabel })); }
  function facts(list) { return h('ul', { class: 'facts' }, list.map(fact)); }
  function savedChecklist(key, items, onAll) {
    var st = S.get(key, {}), res = h('div', { 'aria-live': 'polite' });
    function upd() {
      var n = items.filter(function (x, i) { return st[i]; }).length;
      S.set(key, st); ui.clear(res);
      res.appendChild(h('div', { class: 'verdict ' + (n === items.length ? 'lv-low' : 'lv-caution') }, h('strong', { text: n + ' of ' + items.length + ' done' }), n === items.length && onAll ? h('p', { text: onAll() }) : null));
    }
    var box = h('div', { class: 'checklist' }, items.map(function (t, i) {
      var id = key.replace(/\W/g, '') + '-' + i;
      return h('div', { class: 'checkrow' }, h('input', { type: 'checkbox', id: id, checked: !!st[i], onchange: function (e) { st[i] = e.target.checked; upd(); } }), h('label', { for: id, text: t }));
    }), res);
    upd();
    return box;
  }

  /* ---------- negotiation coach ---------- */
  TABS.negotiate = function (main) {
    var N = SW.data.negotiate, v = S.get('negnums', {}), f = ui.form([{ id: 'balance', label: 'Amount they claim', type: 'money' }, { id: 'lump', label: 'Most you could pay at once', type: 'money' },
      { id: 'monthly', label: 'Most you could pay each month', type: 'money' }, { id: 'months', label: 'Number of months', type: 'number' }], v), out = h('div'), scripts = h('div');
    function fill(s, x) {
      return s.replace('$[amount] as a one-time', x.lump ? U.money(num(x.lump)) + ' as a one-time' : '$[amount] as a one-time').replace('$[amount] a month', x.monthly ? U.money(num(x.monthly)) + ' a month' : '$[amount] a month')
        .replace('[months]', x.months || '[months]');
    }
    function draw() {
      var x = f.read(), r;
      S.set('negnums', x); ui.clear(out); ui.clear(scripts);
      if (num(x.balance) > 0 && (num(x.lump) > 0 || num(x.monthly) > 0)) {
        r = SW.calc.lumpVsPlan({ balance: x.balance, lump: x.lump, planMonthly: x.monthly, planMonths: x.months });
        out.appendChild(h('div', { class: 'stats' }, num(x.lump) > 0 ? h('div', null, h('strong', { text: r.pctOfBalance + '%' }), h('span', { text: 'of the balance as one payment' })) : null,
          num(x.monthly) > 0 && num(x.months) > 0 ? h('div', null, h('strong', { text: U.money(r.planTotal) }), h('span', { text: 'paid in total on the plan' })) : null,
          num(x.lump) > 0 ? h('div', null, h('strong', { text: U.money(r.cancelled) }), h('span', { text: 'forgiven if a lump sum is accepted' })) : null));
        r.notes.forEach(function (n) { out.appendChild(h('p', { class: 'small', text: n })); });
      }
      N.stages.forEach(function (st, i) {
        scripts.appendChild(h('section', { class: 'card stage' }, h('h3', null, h('span', { class: 'stepnum', text: String(i + 1) }), st.title),
          st.say.length ? h('div', { class: 'scripts' }, st.say.map(function (s) { var t = fill(s, x); return h('div', { class: 'scriptline' }, h('q', { text: t.replace(/^“|”$/g, '') }), ui.copyBtn(t.replace(/^“|”$/g, ''), 'Copy')); })) : null,
          h('ul', null, st.lines.map(function (l) { return h('li', { text: l }); }))));
        if (st.id === 'counter') {
          scripts.appendChild(h('section', { class: 'card stage key' }, h('h3', null, h('span', { class: 'stepnum', text: '!' }), 'Get it in writing before you pay'),
            h('p', { class: 'small', text: 'Do not pay until a letter from them says all of this. Tick each item as you check the letter.' }),
            savedChecklist('negwriting', N.writing, function () { S.set('stat:inwriting', true); return 'Everything is in writing. Pay by a traceable method and keep proof. This is a win.'; }),
            h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/debt/letters/confirm', text: 'Letter: confirm a phone deal in writing' }))));
        }
      });
    }
    f.el.addEventListener('input', draw); f.el.addEventListener('change', draw);
    main.appendChild(ui.card('Negotiation coach', [h('p', { class: 'lead', text: 'A calm plan for settling a debt you owe: know your number, make an offer, and get the deal in writing before you pay.' }),
      ui.notice('First make sure the debt is yours and check your state’s time limit. On an old debt, a payment or a promise to pay can restart the clock in many states.', 'warn'),
      h('div', { class: 'row' }, h('a', { class: 'btn small', href: '#/debt/verify', text: 'Is it real?' }), h('a', { class: 'btn small', href: '#/debt/limits', text: 'Check the time limit' }), h('a', { class: 'btn small', href: '#/life/budget', text: 'Find your number (budget)' }))]));
    main.appendChild(ui.card('Your numbers', [h('p', { class: 'small', text: 'Only you see these. They fill in the scripts below.' }), f.el, out]));
    main.appendChild(scripts);
    main.appendChild(ui.card('Settlement letters', [h('p', { class: 'small', text: 'Your offer amount is copied into the letter.' }), h('div', { class: 'row' },
      h('a', { class: 'btn primary', href: '#/debt/letters/settlement', onclick: function () { var x = f.read(); merge('letter:settlement', { offerAmount: x.lump }); }, text: 'Settlement offer letter' }),
      h('a', { class: 'btn', href: '#/debt/letters/payfordelete', onclick: function () { var x = f.read(); merge('letter:payfordelete', { offerAmount: x.lump }); }, text: 'Pay-for-delete request' }),
      h('a', { class: 'btn', href: '#/debt/letters/hardship', text: 'Hardship letter' })), facts(N.facts)]));
    main.appendChild(ui.disclaimerBar());
    draw();
  };

  /* ---------- medical debt shield ---------- */
  TABS.medical = function (main) {
    var M = SW.data.medical, f = ui.form([{ id: 'collectorName', label: 'Hospital name' }, { id: 'accountRef', label: 'Account or patient number' }, { id: 'household', label: 'People in your household', type: 'number' }, { id: 'income', label: 'Household income per year', type: 'money' }], S.get('letter:assist', {}));
    main.appendChild(ui.card('Medical debt shield', [h('p', { class: 'lead', text: 'Medical bills can have errors, and many hospitals have help programs people never hear about. Check first, ask for help, then pay only what you truly owe.' }),
      h('ol', { class: 'steps' }, M.first.map(function (x) { return h('li', { text: x }); })),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/debt/letters/medbill', text: 'Ask for an itemized bill' }), h('a', { class: 'btn', href: '#/learn/medaudit', text: 'How to check a bill' }))]));
    main.appendChild(ui.card('Surprise bills: the No Surprises Act', [facts(M.nsa), h('div', { class: 'row' }, h('a', { class: 'btn small', href: '#/learn/nosurprises', text: 'Read the guide' })), ui.copyLine('cms.gov/nosurprises')]));
    main.appendChild(ui.card('Financial assistance (charity care) helper', [facts(M.charity), h('h4', { text: 'Gather these' }), savedChecklist('medgather', M.gather),
      h('h4', { text: 'Your request letter' }), f.el, h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/debt/letters/assist', onclick: function () { merge('letter:assist', f.read()); }, text: 'Open my financial assistance letter' }))]));
    main.appendChild(ui.card('Medical debt and your credit reports', [ui.notice('Verify the current rules. This area has been changing, and bureau policies are voluntary, not law. Check consumerfinance.gov and your state.', 'warn'), facts(M.report),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/debt/letters/bureau', text: 'Dispute with a credit bureau' }), h('a', { class: 'btn', href: '#/learn/medreport', text: 'Read the guide' }))]));
    main.appendChild(ui.card('If a medical bill is in collections', [h('p', { text: 'Collection agencies that collect medical debt follow the same rules as other debt collectors. You can dispute in writing, ask for validation, and log every call.' }),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/debt/verify', text: 'Is it real?' }), h('a', { class: 'btn', href: '#/debt/letters/validation', text: 'Dispute letter' }), h('a', { class: 'btn', href: '#/practice', text: 'Practice the call' }))]));
    main.appendChild(ui.disclaimerBar());
  };

/* full version only */
  TABS.sued = function (main) {
    var D = SW.data.sued, served = h('input', { type: 'date', id: 'su-served' }), days = h('input', { type: 'number', id: 'su-days', inputmode: 'numeric', placeholder: 'for example 20' }), out = h('div', { 'aria-live': 'polite' }), court = S.get('court', []), cbox = h('div'),
      cf = ui.form([{ id: 'date', label: 'Court date', type: 'date' }, { id: 'time', label: 'Time' }, { id: 'court', label: 'Court' }, { id: 'caseNo', label: 'Case number' }], {});
    function drawCourt() { ui.clear(cbox); court.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (c) { cbox.appendChild(h('div', { class: 'logrow' }, h('strong', { text: c.date }), ' ' + [c.time, c.court, c.caseNo ? 'case ' + c.caseNo : ''].filter(Boolean).join(' · '))); }); }
    main.appendChild(h('section', { class: 'card alarm' }, h('h3', { text: 'If you were sued, do not ignore it.' }), h('p', { class: 'lead', text: 'Missing the deadline to answer is the most common way people lose a debt case they could have fought. You can still act today.' }),
      h('ol', { class: 'steps' }, D.steps.map(function (s) { return h('li', { text: s }); }))));
    main.appendChild(ui.card('Answer deadline', [h('p', { class: 'small', text: 'Use the number of days printed on your summons. Courts count days in different ways, so treat this as an estimate and answer early.' }),
      h('div', { class: 'grid2' }, h('div', { class: 'field' }, h('label', { for: 'su-served', text: 'Date you were served the papers' }), served), h('div', { class: 'field' }, h('label', { for: 'su-days', text: 'Days to answer (from the summons)' }), days)),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var by = SW.sued.answerBy(served.value, days.value), dl;
        ui.clear(out);
        if (!by) { out.appendChild(ui.notice('Enter the date you were served and the number of days on the summons.', 'soft')); return; }
        out.appendChild(h('div', { class: 'verdict lv-high' }, h('strong', { text: 'Estimated answer deadline: ' + by }), h('p', { text: 'Aim to file several days before this. Confirm the exact date with the court clerk.' }),
          h('button', { type: 'button', class: 'btn small', onclick: function () { dl = S.get('deadlines', []); dl.push({ id: ui.uid(), date: by, title: 'Court answer deadline (estimate, confirm with the clerk)', note: '' }); S.set('deadlines', dl); ui.toast('Added to your dates.'); } }, 'Add to my dates')));
      } }, 'Work it out')), out]));
    main.appendChild(ui.card('Court dates', [cf.el, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { var x = cf.read(); if (!x.date) { ui.toast('Enter the court date.'); return; } x.id = ui.uid(); court.push(x); S.set('court', court); drawCourt(); ui.toast('Saved. It also shows on the Deadlines tab.'); } }, 'Add court date'), h('a', { class: 'btn', href: '#/debt/dates', text: 'All my dates and calendar export' })), cbox]));
    main.appendChild(window.StarkTrial.card('evidence_packet'));
    main.appendChild(ui.card('Questions to ask a lawyer', [h('ul', null, D.ask.map(function (q) { return h('li', { text: q }); })), h('p', { text: D.fees.t }), h('p', { class: 'src', text: 'Source: ' + D.fees.cite + ' · as of ' + SW.data.meta.asOfLabel }),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/hope', text: 'Free legal help' }), h('a', { class: 'btn', href: '#/learn/judgment', text: 'Read: sued or judgment checklist' }), h('a', { class: 'btn', href: '#/debt/limits', text: 'Check the time limit' }))]));
    main.appendChild(ui.disclaimerBar());
    drawCourt();
  };

  /* ---------- scam pattern library ---------- */
  SW.views = SW.views || {};
  SW.views.patterns = function (main, args) {
    var P = SW.data.patterns, cur = args && args[0] && P.filter(function (p) { return p.id === args[0]; })[0], r, seg;
    if (!cur) {
      main.appendChild(ui.card('Scam pattern library', [h('p', { class: 'lead', text: 'Scams follow scripts. Once you know the next step they want, it loses its power. Each pattern shows a made-up example and what they will push you to do next.' }),
        h('div', { class: 'tiles' }, P.map(function (p) { return h('a', { class: 'tile', href: '#/check/patterns/' + p.id }, h('strong', { text: p.title }), h('span', { text: p.hook })); }))]));
      return;
    }
    r = SW.analyzer.analyze(cur.example);
    seg = SW.highlight.segments(cur.example, r);
    main.appendChild(h('p', null, h('a', { href: '#/check/patterns', text: '← All patterns' })));
    main.appendChild(h('section', { class: 'card pattern' }, h('h3', { text: cur.title }), h('p', { class: 'lead', text: cur.hook }),
      h('h4', { text: 'What it sounds like (made-up example)' }), h('blockquote', { class: 'hl' }, seg.map(function (x) { return x.hit ? h('mark', { class: 'flag-hit', title: x.title }, x.t) : x.t; })),
      h('p', { class: 'small', text: 'The checker rates this example: ' + r.level.label + ' (risk score ' + r.score + ').' }),
      h('section', { class: 'nextwarn' }, h('h4', { text: 'What they want you to do next' }), h('ol', null, cur.next.map(function (n) { return h('li', { text: n }); }))),
      h('h4', { text: 'Signs to watch for' }), h('ul', null, cur.signs.map(function (n) { return h('li', { text: n }); })),
      h('div', { class: 'truth' }, h('h4', { text: 'The truth' }), h('p', { text: cur.truth }), h('p', { class: 'src', text: 'Source: ' + cur.cite + ' · as of ' + SW.data.meta.asOfLabel })),
      h('p', null, h('strong', { text: 'Report it: ' }), cur.report),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/check', text: 'Check a message like this' }), h('a', { class: 'btn', href: cur.id === 'phantom' || cur.id === 'irs' ? '#/practice/jail' : '#/family/fridge', text: cur.id === 'phantom' || cur.id === 'irs' ? 'Practice this call' : 'Print fridge cards' }), h('a', { class: 'btn', href: '#/scammed', text: 'If it already happened' }))));
  };

  /* ---------- identity theft plan ---------- */
  SW.views.idplan = function (main) {
    var D = SW.data.idplan, st = S.get('idplan', { steps: {}, freeze: {} }), res = h('div', { 'aria-live': 'polite' });
    function save() { S.set('idplan', st); var n = D.steps.filter(function (x, i) { return st.steps[i]; }).length; ui.clear(res); res.appendChild(h('div', { class: 'verdict ' + (n === D.steps.length ? 'lv-low' : 'lv-caution') }, h('strong', { text: n + ' of ' + D.steps.length + ' steps done' }), h('p', { text: n === D.steps.length ? 'Every step is done. That is a real recovery.' : 'One step at a time. Start with the first unticked one.' }))); }
    main.appendChild(ui.card('Identity theft recovery plan', [h('p', { class: 'lead', text: 'If someone used your name or numbers, this is the order that protects you fastest. It is not your fault, and it can be fixed.' }),
      h('div', { class: 'checklist' }, D.steps.map(function (s, i) {
        var id = 'idp-' + i;
        return h('div', { class: 'checkrow' }, h('input', { type: 'checkbox', id: id, checked: !!st.steps[i], onchange: function (e) { st.steps[i] = e.target.checked; save(); } }),
          h('label', { for: id }, h('strong', { text: s.t }), h('span', { class: 'sub', text: s.d }), s.cite ? h('span', { class: 'src', text: s.cite }) : null));
      })), res]));
    main.appendChild(ui.card('Credit freeze checklist', [h('p', { class: 'small', text: 'Freeze at all three. Each one is separate. Keep each PIN or login in your Vault.' }),
      D.bureaus.map(function (b) {
        var f = st.freeze[b.id] || {}, cb = h('input', { type: 'checkbox', id: 'fz-' + b.id, checked: !!f.done }), dt = h('input', { type: 'date', id: 'fzd-' + b.id, value: f.date || '' }), src = SW.data.sources.filter(function (s) { return s.id === b.id; })[0];
        function upd() { st.freeze[b.id] = { done: cb.checked, date: dt.value }; S.set('idplan', st); }
        cb.addEventListener('change', upd); dt.addEventListener('change', upd);
        return h('div', { class: 'freeze' }, h('div', { class: 'checkrow' }, cb, h('label', { for: 'fz-' + b.id, text: b.n + ': frozen' })), h('div', { class: 'field' }, h('label', { for: 'fzd-' + b.id, text: 'Date' }), dt), src ? ui.copyLine(src.url) : null);
      }), h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/life/vault', text: 'Open the Vault' }))]));
    main.appendChild(ui.card('Letters', [h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/debt/letters/idtheft', text: 'Identity theft letter' }), h('a', { class: 'btn', href: '#/debt/letters/bureau', text: 'Credit bureau dispute' }), h('a', { class: 'btn', href: '#/debt/letters/validation', text: 'Dispute a collector’s debt' })),
      ui.copyLine('identitytheft.gov'), ui.copyLine('annualcreditreport.com')]));
    main.appendChild(ui.disclaimerBar());
    save();
  };
})(typeof window !== 'undefined' ? window : globalThis);
