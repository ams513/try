/* Stark Warden: everyday money tools: budget and bill calendar, emergency fund, subscription audit, passphrase vault. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, S = SW.store, U = SW.util;
  var FREQ = [{ v: 'monthly', l: 'Monthly' }, { v: 'weekly', l: 'Weekly' }, { v: 'biweekly', l: 'Every 2 weeks' }, { v: 'semimonthly', l: 'Twice a month' }, { v: 'quarterly', l: 'Every 3 months' }, { v: 'yearly', l: 'Yearly' }];
  function num(x) { var n = parseFloat(String(x).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; }

  function rowEditor(key, title, defs, hint, after) {
    var list = S.get(key, []), box = h('div'), f = ui.form(defs, { freq: 'monthly' });
    function draw() {
      ui.clear(box);
      list.forEach(function (x, i) {
        box.appendChild(h('div', { class: 'logrow' }, h('strong', { text: x.name || '(unnamed)' }), ' ' + U.money(num(x.amount)) + ' ' + ((FREQ.filter(function (q) { return q.v === x.freq; })[0] || { l: '' }).l.toLowerCase()) + (x.day ? ' · due day ' + x.day : '') + (x.keep === 'cancel' ? ' · to cancel' : ''),
          h('button', { type: 'button', class: 'btn small danger', onclick: function () { list.splice(i, 1); S.set(key, list); draw(); if (after) { after(list); } } }, 'Delete')));
      });
      if (after) { after(list); }
    }
    draw();
    return { card: ui.card(title, [hint ? h('p', { class: 'small', text: hint }) : null, f.el, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { var v = f.read(); if (!v.name && !num(v.amount)) { ui.toast('Enter a name and an amount.'); return; } list.push(v); S.set(key, list); draw(); } }, 'Add')), box]), list: function () { return list; } };
  }

  function budgetTab(main) {
    var sum = h('div', { class: 'stats' }), defs = [{ id: 'name', label: 'Name' }, { id: 'amount', label: 'Amount', type: 'money' }, { id: 'freq', label: 'How often', type: 'select', options: FREQ }, { id: 'day', label: 'Due day of month (bills)', type: 'number' }], inc, exp;
    function totals() {
      if (!inc || !exp) { return; }
      var b = SW.calc.budget(inc.list(), exp.list());
      ui.clear(sum);
      sum.appendChild(h('div', null, h('strong', { text: U.money(b.income) }), h('span', { text: 'income / month' })));
      sum.appendChild(h('div', null, h('strong', { text: U.money(b.expenses) }), h('span', { text: 'expenses / month' })));
      sum.appendChild(h('div', { class: b.surplus < 0 ? 'neg' : '' }, h('strong', { text: U.money(b.surplus) }), h('span', { text: b.surplus < 0 ? 'short each month' : 'left each month' })));
    }
    inc = rowEditor('budget:income', 'Income', defs.slice(0, 3), 'Take-home pay and other regular income.', totals);
    exp = rowEditor('budget:expenses', 'Expenses and bills', defs, 'Rent, utilities, food, loan payments, insurance. Add a due day to get a bill calendar.', totals);
    main.appendChild(ui.card('Monthly budget', [h('p', { class: 'lead', text: 'Everything stays on this device. Weekly and yearly amounts are turned into a monthly figure.' }), sum]));
    main.appendChild(inc.card); main.appendChild(exp.card);
    main.appendChild(ui.card('Bill calendar', [h('p', { class: 'small', text: 'Every bill that has a due day, for the next three months, as a calendar file with a reminder the day before.' }), h('button', { type: 'button', class: 'btn primary', onclick: function () {
      var ev = [], now = new Date(), m, i, y, mo, d, last;
      exp.list().forEach(function (x, k) {
        if (!num(x.day)) { return; }
        for (m = 0; m < 3; m++) {
          y = now.getFullYear(); mo = now.getMonth() + m; d = new Date(y, mo, 1); last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          ev.push({ id: 'bill' + k + '-' + m, date: d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(Math.min(num(x.day), last)), title: 'Bill due: ' + x.name, desc: U.money(num(x.amount)) });
        }
      });
      if (!ev.length) { ui.toast('Add a bill with a due day first.'); return; }
      i = SW.deadlines.toICS(ev); ui.saveText('bill-calendar.ics', i, 'text/calendar;charset=utf-8');
    } }, 'Export bill calendar (.ics)')]));
    totals();
  }

  function emergencyTab(main) {
    var v = S.get('efund', { targetMonths: '3', monthlyExpenses: '', current: '0', monthlySave: '' }), f = ui.form([{ id: 'monthlyExpenses', label: 'Your essential monthly expenses', type: 'money' }, { id: 'targetMonths', label: 'Months of expenses to save', type: 'number', hint: 'Many planners suggest 3 to 6.' }, { id: 'current', label: 'Saved so far', type: 'money' }, { id: 'monthlySave', label: 'You can set aside each month', type: 'money' }], v), out = h('div');
    main.appendChild(ui.card('Emergency fund planner', [h('p', { class: 'lead', text: 'A small cushion keeps one surprise from becoming a debt. Start with $500 to $1,000 if the full target feels far away.' }), f.el,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var x = f.read(), r = SW.calc.emergency(x); S.set('efund', x); ui.clear(out);
        out.appendChild(h('div', { class: 'card result' }, h('p', null, 'Target: ', h('strong', { text: U.money(r.target) })), h('p', null, 'Still to save: ', h('strong', { text: U.money(r.gap) })), h('p', { text: r.gap === 0 ? 'You have reached the target.' : (isFinite(r.months) ? 'At this pace: about ' + r.months + ' months.' : 'Enter an amount you can save each month.') })));
      } }, 'Calculate')), out]));
  }

  function subsTab(main) {
    var tot = h('div', { class: 'stats' }), s;
    s = rowEditor('subs', 'Subscriptions', [{ id: 'name', label: 'Subscription' }, { id: 'amount', label: 'Price', type: 'money' }, { id: 'freq', label: 'How often', type: 'select', options: FREQ }, { id: 'keep', label: 'Decision', type: 'select', options: [{ v: 'keep', l: 'Keep' }, { v: 'cancel', l: 'Cancel' }] }], 'List everything that charges you regularly. Check bank and card statements for ones you forgot.', function (list) {
      var all = SW.calc.subscriptions(list), cut = SW.calc.subscriptions(list.filter(function (x) { return x.keep === 'cancel'; }));
      ui.clear(tot); tot.appendChild(h('div', null, h('strong', { text: U.money(all.monthly) }), h('span', { text: 'per month' }))); tot.appendChild(h('div', null, h('strong', { text: U.money(all.yearly) }), h('span', { text: 'per year' })));
      tot.appendChild(h('div', null, h('strong', { text: U.money(cut.yearly) }), h('span', { text: 'saved yearly if you cancel the marked ones' })));
    });
    main.appendChild(ui.card('Subscription audit', [h('p', { class: 'lead', text: 'Small charges add up. Mark what to cancel.' }), tot])); main.appendChild(s.card);
    main.appendChild(ui.card('Cancelling and negotiating', [h('p', null, 'Scripts for calling your provider are in ', h('a', { href: '#/learn/negotiate', text: 'Negotiating bills' }), '.')]));
  }

  /* ---------- Vault ----------
     The open vault holds a derived, non-extractable key (never the passphrase). Every save goes up one in a counter bound into
     the encrypted header; this device remembers the highest counter it has opened, so an older copy put back is pointed out. */
  function vaultTab(main) {
    var box = h('div'), V = SW.vault, F = V.FIELDS;
    if (!V.available()) { main.appendChild(ui.notice('This browser does not offer secure encryption here, so the vault is switched off. Open the app in a current version of Chrome, Edge, Firefox or Safari.', 'warn')); return; }
    function seen() { var n = S.get('vaultSeen', 0); return typeof n === 'number' && isFinite(n) ? n : 0; }
    function markSeen(n) { if (n > seen()) { S.set('vaultSeen', n); } }
    function store(b) { if (!S.set('vault', b)) { throw new Error('The vault could not be saved on this device (storage is full or blocked). It stays open so nothing is lost: copy your notes somewhere safe.'); } markSeen(b.n); return b; }
    function editor(data, session, info) {
      ui.clear(box);
      var contacts = data.contacts, notes = h('textarea', { id: 'vnotes', rows: 6, maxlength: 1000000, placeholder: 'Account numbers, policy numbers, where documents are kept...' }), cbox = h('div'),
        cf = ui.form([{ id: 'name', label: 'Name or company', max: F.name }, { id: 'phone', label: 'Phone', max: F.phone }, { id: 'info', label: 'Account or note', wide: true, max: F.info }], {}),
        idle = null, IDLE_MS = 5 * 60 * 1000;
      notes.value = data.notes;
      function dc() { ui.clear(cbox); contacts.forEach(function (c, i) { cbox.appendChild(h('div', { class: 'logrow' }, h('strong', { text: c.name }), ' ' + (c.phone || '') + ' ' + (c.info || ''), h('button', { type: 'button', class: 'btn small danger', onclick: function () { contacts.splice(i, 1); dc(); } }, 'Delete'))); }); }
      function saveNow() { session.n = Math.max(session.n, seen()); return V.lock({ contacts: contacts, notes: notes.value }, session).then(store); }
      function close() { clearTimeout(idle); session = null; contacts = null; start(); }
      function arm() {
        clearTimeout(idle);
        idle = setTimeout(function () {
          if (!box.isConnected || !session) { return; }
          saveNow().then(function () { close(); ui.toast('Vault locked after 5 minutes idle. Your changes were saved.'); }, function (e) { ui.toast(e.message, 'bad'); arm(); });
        }, IDLE_MS);
      }
      dc();
      ['input', 'click', 'keydown', 'pointerdown'].forEach(function (ev) { box.addEventListener(ev, arm); });
      arm();
      box.appendChild(ui.card('Vault open', [info, h('p', { class: 'small', text: 'Contacts and notes are encrypted before they are saved on this device. Press Save to lock your changes in. Save number ' + session.n + '.' }), cf.el,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () {
          var v = cf.read();
          if (!v.name.trim()) { cf.error('name', 'Enter a name or company first.'); return; }
          if (contacts.length >= V.MAX_CONTACTS) { cf.error('name', 'The vault holds up to ' + V.MAX_CONTACTS + ' contacts.'); return; }
          cf.error('name', ''); contacts.push({ name: v.name.trim(), phone: v.phone.trim(), info: v.info.trim() }); dc(); cf.set({ name: '', phone: '', info: '' });
        } }, 'Add contact')), cbox, h('label', { for: 'vnotes', text: 'Notes' }), notes,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { saveNow().then(function (b) { ui.toast('Saved and encrypted (save ' + b.n + ').'); }, function (e) { ui.toast(e.message, 'bad'); }); } }, 'Save'),
          h('button', { type: 'button', class: 'btn', onclick: function () { saveNow().then(function () { close(); ui.toast('Saved and locked.'); }, function (e) { ui.toast(e.message, 'bad'); }); } }, 'Save and lock'),
          h('button', { type: 'button', class: 'btn', onclick: close }, 'Lock without saving'))]));
    }
    function start() {
      var p1 = h('input', { type: 'password', id: 'vp1', autocomplete: 'new-password' }), p2 = h('input', { type: 'password', id: 'vp2', autocomplete: 'new-password' }), stored = S.get('vault', null), busy = false, armed = false, armTimer = null, go;
      ui.clear(box);
      if (!stored) {
        go = h('button', { type: 'button', class: 'btn primary', onclick: function () {
          var st = V.strength(p1.value), pass = p1.value;
          ui.fieldError(p2, ''); ui.fieldError(p1, '');
          if (!st.ok) { ui.fieldError(p1, 'Too short or too simple. ' + st.tip); return; }
          if (p1.value !== p2.value) { ui.fieldError(p2, 'The two passphrases do not match.'); return; }
          if (busy) { return; } busy = true; go.disabled = true;
          V.create(pass).then(function (s) { return V.lock({ contacts: [], notes: '' }, s).then(store).then(function () { p1.value = ''; p2.value = ''; editor({ contacts: [], notes: '' }, s, null); }); })
            .then(null, function (e) { busy = false; go.disabled = false; ui.toast(e.message, 'bad'); });
        } }, 'Create vault');
        box.appendChild(ui.card('Create a vault', [h('p', { class: 'lead', text: 'A private place for contacts, account numbers and notes, locked with a passphrase you choose.' }), ui.notice('There is no recovery. If you forget the passphrase, nobody, including us, can open it. Write it down and keep it somewhere safe.', 'warn'),
          h('div', { class: 'field' }, h('label', { for: 'vp1', text: 'Passphrase (4 or more unrelated words works well)' }), p1), h('div', { class: 'field' }, h('label', { for: 'vp2', text: 'Type it again' }), p2),
          h('div', { class: 'row' }, go)]));
        return;
      }
      function unlock() {
        if (busy) { return; }
        busy = true; go.disabled = true; go.textContent = 'Opening...'; ui.fieldError(p1, '');
        V.unlock(stored, p1.value).then(function (r) {
          var older = r.n < seen(), notes = [];
          p1.value = '';
          if (older) { notes.push(ui.notice('This is an older copy of the vault (save ' + r.n + ') than the newest one this device has opened (save ' + seen() + '). It may have come from an old backup, or someone with access to this device may have put it back. Check that your notes are current before you save.', 'warn')); }
          if (r.upgraded) {
            notes.push(ui.notice('This vault was saved with older protection. It has just been re-locked with the current format: 600,000 key rounds and a header that cannot be changed without the vault refusing to open.', 'soft'));
            r.session.n = Math.max(r.session.n, seen());
            V.lock(r.data, r.session).then(store).then(null, function (e) { ui.toast(e.message, 'bad'); });
          } else if (!older) { markSeen(r.n); }
          editor(r.data, r.session, notes.length ? h('div', null, notes) : null);
        }, function (e) { busy = false; go.disabled = false; go.textContent = 'Unlock'; ui.fieldError(p1, e.message); });
      }
      p1.addEventListener('keydown', function (e) { if (e.key === 'Enter') { unlock(); } });
      go = h('button', { type: 'button', class: 'btn primary', onclick: unlock }, 'Unlock');
      box.appendChild(ui.card('Unlock the vault', [h('div', { class: 'field' }, h('label', { for: 'vp1', text: 'Passphrase' }), p1), h('div', { class: 'row' }, go,
        h('button', { type: 'button', class: 'btn danger', onclick: function (e) {
          if (!armed) { armed = true; e.target.textContent = 'Press again to erase the vault for good'; armTimer = setTimeout(function () { armed = false; e.target.textContent = 'Erase vault'; }, 6000); return; }
          clearTimeout(armTimer); S.del('vault'); S.del('vaultSeen'); start(); ui.toast('Vault erased.');
        } }, 'Erase vault'))]));
    }
    main.appendChild(ui.card('Household vault', [h('p', { class: 'lead', text: 'Encrypted with AES-GCM 256 and a PBKDF2 key from your passphrase, using your browser’s built-in encryption. It never leaves this device.' }),
      h('p', { class: 'small', text: 'Everything else in Warden (your log, letters, budget) is saved on this device without encryption. Use the encrypted backup in Settings to protect a copy.' })]));
    main.appendChild(box); start();
  }

  function docsTab(main) {
    var g = SW.data.guides.filter(function (x) { return x.id === 'docs'; })[0];
    main.appendChild(ui.card(g.title, [h('p', { text: g.blocks[0].p }), SW.views.checklist(g)]));
  }

  ui.route('life', null, function (main, args) {
    var t = args[0] || 'budget', defs = [{ id: 'budget', label: 'Budget' }, { id: 'emergency', label: 'Emergency fund' }, { id: 'subs', label: 'Subscriptions' }, { id: 'vault', label: 'Vault' }, { id: 'docs', label: 'Documents' }];
    main.appendChild(h('h2', { text: 'Everyday money tools' }));
    main.appendChild(ui.tabs(defs, t, 'life'));
    ({ budget: budgetTab, emergency: emergencyTab, subs: subsTab, vault: vaultTab, docs: docsTab }[t] || budgetTab)(main);
  });
})(typeof window !== 'undefined' ? window : globalThis);
