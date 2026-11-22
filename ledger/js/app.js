/* Stark Ledger. Shell: passphrase screen and book picker, grouped navigation, quick search (Ctrl+K), language, idle lock, theme. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, S = window.StarkStore;
  const NAV = L.NAV = [
    ['', [['dashboard', 'Dashboard']]],
    ['Sales', [['invoices', 'Invoices'], ['estimates', 'Estimates'], ['clients', 'Clients'], ['receivables', 'Receivables'], ['reminders', 'Reminders'], ['time', 'Time']]],
    ['Purchases', [['bills', 'Bills and orders'], ['vendors', 'Vendors'], ['items', 'Products and stock']]],
    ['Banking', [['transactions', 'Transactions'], ['reconcile', 'Reconcile'], ['receipts', 'Receipts'], ['import', 'Import bank file'], ['recurring', 'Recurring'], ['mileage', 'Mileage']]],
    ['Reports', [['ask', 'Ask your books'], ['doctor', 'Books Doctor'], ['reports', 'Reports'], ['forecast', 'Cash forecast'], ['budgets', 'Budgets'], ['salestax', 'Sales tax'], ['vat', 'VAT / GST'], ['tax', 'Tax worksheet']]],
    ['Household', [['cover', 'Months of cover']]],
    ['Company', [['yearend', 'Year-end'], ['backup', 'Backup'], ['feedback', 'Send feedback'], ['settings', 'Settings']]]
  ];
  const NAV_ACTIVE = { invoice: 'invoices', estimate: 'estimates', bill: 'bills', po: 'bills', statement: 'clients' };
  let idleTimer = null, lastHash = null; const IDLE_MS = 15 * 60 * 1000;
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

  L.migrate = function () { C.migrate(L.st); };

  function topbar() {
    const st = L.st, tm = st && st.settings.timer, chip = L.$('#timer-chip');
    L.clear(L.$('#theme')).append(h('span', { 'aria-hidden': 'true' }, '◐ '), h('span', { class: 'tlbl' }, 'Theme')); L.clear(L.$('#lock-btn')).append(h('span', { 'aria-hidden': 'true' }, '🔒 '), h('span', { class: 'tlbl' }, 'Lock')); L.$('#search-label').textContent = 'Search';
    L.$('.by').textContent = S.books().length > 1 ? S.bookLabel() : 'Offline and encrypted';
    chip.hidden = !tm; if (tm) chip.textContent = '⏱ ' + C.fmtMinutes(C.timerMinutes(tm.start, Date.now()));
    L.$('.footer').textContent = 'Stark Ledger ' + C.VERSION + '. Works offline. Bookkeeping software, not tax advice: check with a tax professional.';
    if (L.shellExtras) L.shellExtras();
  }
  L.render = function () {
    const app = L.$('#app'), lock = L.$('#lock'); if (!L.st) return;
    lock.hidden = true; app.hidden = false;
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/'); let name = parts[0]; if (!L.routes[name]) name = 'dashboard';
    const nav = L.$('#nav'); L.clear(nav); const cur = NAV_ACTIVE[name] || name;
    NAV.forEach(g => { if (g[0]) nav.appendChild(h('div', { class: 'navgrp' }, g[0])); g[1].forEach(n => { if (n[0] === 'vat' && !(L.st.settings.taxMode === 'vat' || L.st.invoices.some(d => d.taxMode === 'vat') || L.st.bills.some(d => d.taxMode === 'vat'))) return; nav.appendChild(h('a', { href: '#/' + n[0], 'aria-current': cur === n[0] ? 'page' : null }, n[1])); }); });
    topbar();
    const main = L.clear(L.$('#main')); let node; try { node = C.readScope(L.st, () => L.routes[name].apply(null, parts.slice(1))); } catch (e) { node = h('div', { class: 'card' }, h('h2', null, 'Something went wrong'), h('p', null, e.message)); console.error(e); }
    main.appendChild(node); L.tr(app); document.title = 'Stark Ledger'; if (location.hash !== lastHash) window.scrollTo(0, 0); lastHash = location.hash;
  };

  /* ---------- language and theme ---------- */
  const langNow = () => (window.StarkI18n ? window.StarkI18n.current() : L.lang);   // the screen language code (en, es, de, ar...)
  L.useLang = function (code, fromPicker) {   // es is this app's own Spanish; every other language is the shared runtime over English
    const P = window.StarkI18n; if (P && !P.languages.some(l => l[0] === code)) code = 'en';
    L.setLang(code); lsSet('stark-ledger-lang', code);
    if (P && !fromPicker && P.current() !== code) P.use(code);
    if (L.st) { L.st.settings.lang = code; L.save(); L.render(); } else showLock(lockMode);
  };
  L.toggleLang = function () { const p = L.$(L.st ? '#lang-pick' : '#lock-lang'); if (p) { p.focus(); try { p.showPicker(); } catch (e) { /* older browser: focus is enough */ } } };
  function toggleTheme() { const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', nx); lsSet('stark-ledger-theme', nx); }

  /* ---------- quick search and command palette ---------- */
  const ACTIONS = [['New invoice', '#/invoice/new'], ['New estimate', '#/estimate/new'], ['New bill', '#/bill/new'], ['New purchase order', '#/po/new'], ['Money in', () => L.addMoneyDialog('in')], ['Money out', () => L.addMoneyDialog('out')],
    ['Ask your books', '#/ask'], ['Run Books Doctor', '#/doctor'], ['Reconcile the bank', '#/reconcile'], ['Log time', '#/time'], ['Write payment reminders', '#/reminders'], ['Download backup', '#/backup'], ['Accountant package', '#/yearend'], ['Switch language', () => L.toggleLang()], ['Switch theme', toggleTheme], ['Lock now', () => L.lockNow()]];
  const KIND = { page: 'Page', action: 'Action', client: 'Client', vendor: 'Vendor', item: 'Item', invoice: 'Invoice', estimate: 'Estimate', bill: 'Bill', po: 'Order', entry: 'Entry', answer: 'Answer' };
  L.palette = function () {
    if (!L.st) return;
    L.modal('Search', close => {
      const q = L.input({ type: 'search', id: 'pal-q', placeholder: 'Pages, actions, clients, invoices, amounts...', 'aria-label': 'Search', 'aria-controls': 'pal-list', spellcheck: 'false' });
      const list = h('ul', { class: 'pal', id: 'pal-list', role: 'listbox' }); let items = [], sel = 0;
      const run = it => { close(); if (typeof it.go === 'function') it.go(); else L.go(it.go); };
      const draw = () => {
        const t = q.value.trim().toLowerCase(), match = s => !t || s.toLowerCase().indexOf(t) >= 0 || L.t(s).toLowerCase().indexOf(t) >= 0;
        const pages = []; NAV.forEach(g => g[1].forEach(n => { if (match(n[1])) pages.push({ kind: 'page', label: n[1], go: '#/' + n[0] }); }));
        const acts = ACTIONS.filter(a => match(a[0])).map(a => ({ kind: 'action', label: a[0], go: a[1] }));
        const found = t ? C.search(L.st, t, 25).map(r => ({ kind: r.kind, label: r.label, sub: r.sub, go: r.hash })) : [];
        const ans = t.length > 3 && /\s/.test(t) ? C.ask(L.st, t, C.today()) : null, answer = ans ? [{ kind: 'answer', label: ans.title, go: '#/ask/' + encodeURIComponent(q.value.trim()) }] : [];
        items = (t ? answer.concat(found, acts, pages) : acts.concat(pages)).slice(0, 40); sel = Math.min(sel, Math.max(0, items.length - 1));
        L.clear(list); items.forEach((it, i) => list.appendChild(h('li', { role: 'option', 'aria-selected': String(i === sel), class: i === sel ? 'on' : '', onclick: () => run(it) }, h('span', { class: 'pk' }, KIND[it.kind]), h('span', { class: 'pl' }, it.label), it.sub ? h('span', { class: 'ps' }, it.sub) : null)));
        if (!items.length) list.appendChild(h('li', { class: 'none' }, 'Nothing found.'));
        const on = list.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
      };
      q.addEventListener('input', () => { sel = 0; draw(); });
      q.addEventListener('keydown', ev => { if (ev.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); ev.preventDefault(); } else if (ev.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); ev.preventDefault(); } else if (ev.key === 'Enter') { ev.preventDefault(); if (items[sel]) run(items[sel]); } });
      draw(); setTimeout(() => q.focus(), 0);
      return h('div', { class: 'stack' }, q, list, h('p', { class: 'muted small' }, 'Arrow keys move, Enter opens, Esc closes. Ctrl+K opens search from anywhere.'));
    }, true);
  };
  document.addEventListener('keydown', ev => {
    if (!L.st) return; const k = (ev.key || '').toLowerCase(), typing = /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target && ev.target.nodeName) || '');
    if ((ev.ctrlKey || ev.metaKey) && k === 'k') { ev.preventDefault(); L.palette(); } else if (k === '/' && !typing && !L.$('#dlg').open) { ev.preventDefault(); L.palette(); }
  });

  /* ---------- passphrase screen with the book picker ---------- */
  let lockMode = 'unlock';
  async function reopen() { showLock((await S.hasVault()) ? 'unlock' : 'create'); }
  function showLock(mode) { // mode: 'create' | 'unlock' | 'newbook'
    lockMode = mode; L.st = null; const app = L.$('#app'), lock = L.$('#lock'); app.hidden = true; lock.hidden = false; L.clear(lock); const create = mode === 'create';
    const langBtn = L.select((window.StarkI18n ? window.StarkI18n.languages : [['en', 'English'], ['es', 'Español']]), langNow(), { id: 'lock-lang', class: 'lang-pick', 'aria-label': 'Language', 'data-i18n-skip': '' });
    langBtn.addEventListener('change', () => L.useLang(langBtn.value));
    const brand = h('div', { class: 'brand big' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('div', null, h('div', { class: 'stark' }, h('span', { class: 'stark-wm', role: 'img', 'aria-label': 'Stark' })), h('div', { class: 'name' }, 'LEDGER')), h('span', { class: 'grow' }), langBtn);
    if (mode === 'newbook') {
      const lab = L.input({ id: 'book-label', placeholder: 'Business name' }), err = h('p', { class: 'err', id: 'book-err', role: 'alert' });
      lock.appendChild(h('form', { class: 'lockbox', onsubmit: ev => { ev.preventDefault(); try { const id = S.addBook(lab.value); S.useBook(id); showLock('create'); } catch (e) { L.invalid(lab, err, e.message); } } }, brand,
        h('h1', null, 'Separate books'), h('p', { class: 'muted' }, 'Each business gets its own encrypted books with its own passphrase. The name below is stored without encryption so you can pick the books before unlocking, so a nickname is fine.'),
        L.field('Name', lab), err, h('button', { class: 'btn primary wide', id: 'book-create' }, 'Create separate books'), h('button', { type: 'button', class: 'btn ghost', onclick: () => reopen() }, 'Cancel'))); lab.focus(); return;
    }
    const books = S.books(), bookSel = books.length > 1 ? L.select(books.map(b => [b.id, b.label]), S.book(), { id: 'book-sel', 'aria-label': 'Books' }) : null;
    if (bookSel) bookSel.addEventListener('change', () => { S.useBook(bookSel.value); reopen(); });
    const p1 = L.input({ type: 'password', id: 'pass', autocomplete: create ? 'new-password' : 'current-password' }), p2 = L.input({ type: 'password', id: 'pass2', autocomplete: 'new-password' }), err = h('p', { class: 'err', id: 'lock-err', role: 'alert' });
    let bad = p1;
    const form = h('form', { class: 'lockbox', onsubmit: async ev => { ev.preventDefault(); L.valid(p1, err); L.valid(p2); bad = p1; const btn = L.$('#lock-go'); btn.disabled = true;
      try {
        if (create) { if (p1.value.length < 10) throw new Error('Use at least 10 characters. A few random words work well.'); if (p1.value !== p2.value) { bad = p2; throw new Error('The two passphrases differ.'); } L.st = await S.create(p1.value); }
        else L.st = await S.unlock(p1.value);
        L.migrate(); if (!lsGet('stark-ledger-lang') && L.st.settings.lang && L.st.settings.lang !== langNow()) { L.setLang(L.st.settings.lang); if (window.StarkI18n) window.StarkI18n.use(L.st.settings.lang); } else L.st.settings.lang = langNow();
        const n = C.runRecurring(L.st, C.today()), m = C.runSchedules(L.st, C.today()); if (n || m.total) L.save(); p1.value = p2.value = ''; startIdle(); L.render();
        if (S.rollback) L.toast('These books are older than the last save this browser remembers (save ' + S.rollback.found + ', expected ' + S.rollback.expected + '). If you did not put an older copy back yourself, check your recent work and make a backup.', true, true);
        else if (S.recovered) L.toast('Your latest save was unreadable, so the previous good copy was restored.', true);
        else if (S.upgraded) L.toast('Encryption upgraded: every record is now sealed to its place, at ' + C.KDF_ITER.toLocaleString('en-US') + ' key rounds.');
        else if (n || m.total) L.toast('Posted ' + n + ' recurring expense(s) and made ' + m.total + ' recurring invoice(s) that were due.');
      } catch (e) { if (e && e.safe) { safeMode(e.safe); return; } L.invalid(bad, err, e.message || String(e)); L.st = null; } btn.disabled = false; } },
    brand, h('h1', null, create ? 'Create your passphrase' : 'Unlock your books'),
    bookSel ? L.field('Books', bookSel) : null,
    create ? h('p', { class: 'muted' }, 'Your books and receipts are encrypted with this passphrase before they are saved in this browser. Nothing is sent anywhere. There is no recovery: if you forget it, the data cannot be opened. Make backups.') : h('p', { class: 'muted' }, 'Offline bookkeeping and invoicing. Everything stays on this computer.'),
    L.field('Passphrase', p1), create ? L.field('Repeat passphrase', p2) : null, err, h('button', { class: 'btn primary wide', id: 'lock-go' }, create ? 'Create encrypted books' : 'Unlock'),
    h('button', { type: 'button', class: 'btn ghost sm', id: 'book-new', onclick: () => showLock('newbook') }, '+ Separate books for another business'),
    h('p', { class: 'fine' }, 'Stark Ledger is bookkeeping software, not tax advice. Check with a tax professional.'), L.trialNote ? L.trialNote() : null);
    lock.appendChild(form); p1.focus();
    if (!create && L.passkeyUsable && L.passkeyUsable()) S.getPasskey().then(rec => { if (!rec || !form.isConnected) return;   // passkey unlock: the PRF secret opens the sealed passphrase, then the normal unlock runs
      const go = h('button', { type: 'button', class: 'btn wide', id: 'passkey-go', onclick: async () => { err.textContent = ''; try { p1.value = await L.passkeyPass(); form.requestSubmit(); } catch (e) { L.invalid(p1, err, e && e.name === 'NotAllowedError' ? 'The passkey request was cancelled or timed out.' : e.message); } } }, 'Unlock with passkey');
      form.insertBefore(go, L.$('#book-new', form)); }).catch(() => { /* no passkey */ });
  }
  /* safe mode: stored books failed to read or validate. Read-only, nothing is written or overwritten. */
  function safeMode(info) {
    L.st = null; const lock = L.$('#lock'); L.clear(lock); lock.hidden = false; L.$('#app').hidden = true;
    const enc = () => JSON.stringify({ app: 'stark-ledger-raw', note: 'Encrypted raw records, exactly as stored. Not modified.', vault: info.vault && { salt: C.b64(info.vault.salt), iter: info.vault.iter }, main: info.main ? { iv: C.b64(info.main.iv), ct: C.b64(info.main.ct) } : null, bak: info.bak ? { iv: C.b64(info.bak.iv), ct: C.b64(info.bak.ct) } : null });
    const btns = [h('button', { class: 'btn primary', id: 'raw-export', onclick: () => { try { L.download('stark-ledger-raw-' + C.today() + '.json', enc(), 'application/json'); } catch (e) { L.toast('Export failed: ' + e.message, true); } } }, 'Export raw data (encrypted)')];
    if (info.plain) btns.push(h('button', { class: 'btn', id: 'raw-plain', onclick: () => { L.download('stark-ledger-unvalidated-' + C.today() + '.json', JSON.stringify(info.plain), 'application/json'); } }, 'Export readable copy (not encrypted)'));
    btns.push(h('button', { class: 'btn ghost', onclick: () => location.reload() }, 'Back'));
    lock.appendChild(h('div', { class: 'lockbox' }, h('h1', null, 'Safe mode (read-only)'), h('p', { class: 'note bad', role: 'alert', id: 'safe-banner' }, 'Your saved books could not be read, so Stark Ledger opened in safe mode. Nothing has been changed or overwritten. Export your raw data first, then try a backup file or ask for help.'), h('div', { class: 'row wrap' }, btns)));
  }
  L.lockNow = async function () { clearTimeout(idleTimer); await S.flush().catch(() => { /* a failed save is already shown by the Not saved badge; locking always wins */ }); S.lock(); L.$('#dlg').close && L.$('#dlg').open && L.$('#dlg').close(); showLock('unlock'); };
  function startIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (L.st) { L.lockNow(); L.toast('Locked after 15 quiet minutes.'); } }, IDLE_MS); }
  ['click', 'keydown', 'pointerdown'].forEach(ev => document.addEventListener(ev, () => { if (L.st) startIdle(); }, { passive: true }));

  /* save state: a persistent badge while a save is failing, plus one alert; never a silent failure */
  let saveAlerted = false;
  function saveBadge(state, err) {
    const b = L.$('#save-state'); if (!b) return;
    if (state === 'error') { b.hidden = false; b.className = 'chip red save-state'; b.textContent = 'Not saved'; b.title = (err && err.message) || 'Saving failed';
      if (!saveAlerted) { saveAlerted = true; L.toast('Your last change was NOT saved: ' + ((err && err.message) || 'storage error') + ' Download a backup now; Stark Ledger keeps retrying on the next change.', true, true); } }
    else if (state === 'saved') { if (saveAlerted) L.toast('Saved again. Your books are stored.'); saveAlerted = false; b.hidden = true; }
  }
  async function boot() {
    const saved = lsGet('stark-ledger-theme'); if (saved) document.documentElement.setAttribute('data-theme', saved);
    L.setLang(lsGet('stark-ledger-lang') || 'en'); L.startTranslating();
    L.$('#theme').addEventListener('click', toggleTheme); L.$('#search-btn').addEventListener('click', () => L.palette());
    L.$('#lock-btn').addEventListener('click', () => L.lockNow());
    document.addEventListener('change', e => { if (e.target && e.target.id === 'lang-pick') L.useLang(e.target.value, true); }, true);   // header picker (js/stark_lang.js)
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => { const c = langNow(); if ((c === 'es') !== (L.lang === 'es')) { L.setLang(c); if (L.st) L.render(); else if (L.$('#lock-go')) showLock(lockMode); } }));   // first visit: the browser language may be Spanish
    window.addEventListener('hashchange', () => L.render());
    window.addEventListener('pagehide', () => { S.flush().catch(() => { /* already reported */ }); });
    S.onSaveState = saveBadge; S.onBlocked = () => L.toast('Close the other Stark Ledger tabs to finish erasing.', true, true); S.onGone = () => location.reload();
    try { S.restoreLastBook(); await reopen(); }
    catch (e) { L.clear(L.$('#lock')).appendChild(h('div', { class: 'lockbox' }, h('h1', null, 'Storage is not available'), h('p', null, 'This browser blocks IndexedDB (private windows often do). Open Stark Ledger in a normal window.'))); L.$('#lock').hidden = false; }
  }
  boot();
})();
