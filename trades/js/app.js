/* Stark Trades 2.1. Shell: passphrase screen, language, routing, auto-lock, theme, quick search button. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, S = window.StarkStore, t = C.t, N = C.N;
  const NAV = [['today', N('Today')], ['field', N('Field')], ['jobs', N('Jobs')], ['pipeline', N('Pipeline')], ['radar', N('Cash radar')], ['schedule', N('Schedule')], ['service', N('Service plans')], ['subs', N('Sub bench')], ['bids', N('Bids')], ['estimates', N('Estimates')], ['docs', N('Quotes and invoices')], ['money', N('Money')], ['stock', N('Stock and orders')], ['customers', N('Customers')], ['team', N('Timesheets and certs')], ['safety', N('Safety')], ['permits', N('Permits')], ['warranties', N('Warranties')], ['forecast', N('Forecast')], ['reports', N('Reports')], ['backup', N('Share and backup')], ['settings', N('Settings')], ['limits', N('Honest limits')]];
  const FIELD_NAV = ['field', 'today', 'jobs', 'schedule', 'safety', 'backup', 'settings', 'limits'];
  const ACTIVE = { job: 'jobs', sub: 'subs', subview: 'subs', estimate: 'estimates', quote: 'docs', invoice: 'docs', pricebook: 'estimates', customer: 'customers', bid: 'bids' };
  L.NAV = NAV;
  const SAVE = { saved: N('Saved'), saving: N('Saving...'), error: N('Not saved'), sample: N('Sample: not saved') };
  /* the save chip in the top bar: what is saved right now, always visible */
  L.saveState = function (k) {
    const el = L.$('#save-state'); k = S.trying() ? 'sample' : k || el.dataset.s || 'saved'; el.dataset.s = k; el.className = 'save-state ' + k; el.textContent = t(SAVE[k]); el.hidden = !L.st;
    el.title = k === 'saved' ? t('Everything you entered is saved, encrypted, on this computer.') : k === 'sample' ? t('Sample company: changes stay until you lock or close the tab.') : k === 'error' ? t('The last save could not be verified. Your previous good copy was kept. Make a backup now.') : '';
  };
  let idleTimer = null, lastHash = null;

  let fromPicker = false;   // the picker's own change handler applies the chosen language after ours
  L.setLang = function (lang) {
    C.I.setLang(lang); document.documentElement.lang = C.I.lang;
    try { const sv = localStorage.getItem('stark-trades-lang'); if (C.I.lang === 'es' || !sv || sv === 'en' || sv === 'es') localStorage.setItem('stark-trades-lang', C.I.lang); } catch (e) { /* storage blocked */ }   // a screen language the shared picker saved (fr, ja...) stays saved
    const P = window.StarkI18n;   // the shared picker (js/stark_lang.js) drives the other languages; Spanish is this app's own
    if (!fromPicker && P && P.use && P.current) { const cur = P.current(); if (C.I.lang === 'es' ? cur !== 'es' : cur === 'es') P.use(C.I.lang); else if (cur !== C.I.lang) document.documentElement.lang = cur; }
    L.$('#footer-text').textContent = t('Stark Trades {v}. Works offline; your data stays on this computer. A business tool, not legal or tax advice: lien, licensing and insurance rules differ by state, so check with your state contractor board and a lawyer.', { v: C.VERSION });
    L.$('#lang-btn').textContent = C.I.lang === 'es' ? 'English' : 'Español'; L.$('#lang-btn').setAttribute('aria-label', t('Switch language'));
    L.$('#theme').textContent = t('Theme'); L.$('#lock-btn').textContent = t('Lock'); L.$('#offline').textContent = t('Offline · encrypted'); L.$('#demo-flag').textContent = t('Demo data'); L.$('#by').textContent = t('Offline trade operations'); L.$('#search-btn').textContent = t('Search'); L.$('#feedback-btn').textContent = t('Send feedback'); L.$('#search-btn').title = t('Quick search (Ctrl+K)');
    if (L.st) L.st.company.lang = C.I.lang;
    L.saveState();
  };
  L.render = function () {
    const app = L.$('#app'), lock = L.$('#lock'); if (!L.st) return;
    if (!lock.hidden || lock.firstChild) { lock.hidden = true; L.clear(lock); } app.hidden = false; L.freePhotos();   // no stale passphrase form lingers while unlocked
    const field = L.st.device.role === 'field', parts = (location.hash.replace(/^#\/?/, '') || (field ? 'field' : 'today')).split('/'); let name = parts[0]; if (!L.routes[name]) name = field ? 'field' : 'today';
    const nav = L.clear(L.$('#nav')); (field ? FIELD_NAV.map(k => NAV.find(n => n[0] === k)) : NAV).forEach(n => nav.appendChild(h('a', { href: '#/' + n[0], 'aria-current': (ACTIVE[name] || name) === n[0] ? 'page' : null }, t(n[1]))));
    const main = L.clear(L.$('#main')); let node;
    try { node = L.routes[name].apply(null, parts.slice(1)); } catch (e) { node = h('div', { class: 'card stack' }, h('h1', null, t('Something went wrong')), h('p', null, t('This screen could not be shown. Your data is safe. Go back to Today and try again; if it keeps happening, make a backup on the Share and backup page.')), h('div', null, h('a', { class: 'btn primary', href: '#/today' }, t('Back to Today'))), h('p', { class: 'fine' }, e.message)); console.error(e); }
    if (S.trying() && name === 'today') main.appendChild(h('div', { class: 'note demo try-banner', id: 'try-banner' }, h('span', { class: 'grow' }, h('b', null, t('Sample company.') + ' '), t('Look around and change anything. Nothing is saved: lock or close the tab and it is gone.')), h('button', { type: 'button', class: 'btn', id: 'start-own', onclick: () => { S.lock(); showLock('create', true); } }, t('Start my own'))));
    main.appendChild(node); if (location.hash !== lastHash) window.scrollTo(0, 0); lastHash = location.hash;
    L.$('#demo-flag').hidden = !L.st.demo; document.body.classList.toggle('field-device', field); L.saveState();
  };
  L.toggleLang = function () { L.setLang(C.I.lang === 'es' ? 'en' : 'es'); if (L.st) { L.save(); L.render(); } else showLock(lockMode); };

  let lockMode = 'create';
  /* safe mode: the data could not be read; nothing is written, the stored records can be exported as they are */
  function safeMode(raw) {
    const lock = L.$('#lock'); L.clear(lock);
    lock.appendChild(h('div', { class: 'lockbox' }, h('h1', null, t('Safe mode')),
      h('p', { class: 'note bad', role: 'alert', id: 'safe-banner' }, t('Your saved data could not be read, so the app stays closed and nothing was changed or overwritten. Export the raw data first, then try again or restore a backup.')),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', id: 'safe-export', onclick: () => L.download('stark-trades-raw-' + C.today() + '.json', JSON.stringify(raw), 'application/json') }, t('Export raw data')),
        h('button', { class: 'btn', type: 'button', id: 'safe-retry', onclick: () => showLock('unlock') }, t('Try again')))));
  }
  /* one tap from the first screen: the sample company opens in memory, with no passphrase and nothing written */
  L.tryIt = function () {
    S.tryOut(); const st = window.StarkTradesDemo.demoState(C, C.today()); st.device = { id: C.randomId(), role: 'office', lastHandoff: '' }; st.company.lang = C.I.lang; L.st = st;
    L.restartIdle(); L.go('#/today'); L.toast(t('Sample company open. Tap anything; nothing is saved.'));
  };
  function showLock(mode, fresh) {
    lockMode = mode; L.st = null; pkSlot = pkSlot0(); const app = L.$('#app'), lock = L.$('#lock'); app.hidden = true; lock.hidden = false; L.clear(lock); const create = mode === 'create';
    const p1 = L.input({ type: 'password', id: 'pass', autocomplete: create ? 'new-password' : 'current-password' }), p2 = L.input({ type: 'password', id: 'pass2', autocomplete: 'new-password' }), err = h('p', { class: 'err', id: 'lock-err', role: 'alert' });
    const demo = h('input', { type: 'checkbox', id: 'with-demo', checked: !fresh }), preset = L.select(Object.keys(C.PRESETS).map(k => [k, t(C.PRESETS[k].label)]), 'plumbing', { id: 'preset' }), role = L.select([['office', t('Office computer')], ['field', t('Field phone')]], 'office', { id: 'role' });
    /* the same language control as the rest of the app: the shared picker's list (every language that ships a dictionary, plus English); Spanish is the app's own switch */
    const P = window.StarkI18n, langBtn = P && P.languages ? L.select(P.languages.map(l => [l[0], l[1]]), P.current(), { id: 'lock-lang', class: 'lang-pick', 'aria-label': 'Language', 'data-i18n-skip': '' })
      : h('button', { type: 'button', class: 'btn ghost sm', id: 'lock-lang', onclick: () => L.toggleLang() }, C.I.lang === 'es' ? 'English' : 'Español');
    if (langBtn.tagName === 'SELECT') langBtn.addEventListener('change', () => { const v = langBtn.value; P.use(v); if ((v === 'es') !== (C.I.lang === 'es')) { fromPicker = true; try { L.toggleLang(); } finally { fromPicker = false; } } });
    role.addEventListener('change', () => { demo.checked = role.value === 'office' && demo.checked; });
    const form = h('form', { class: 'lockbox', onsubmit: async ev => { ev.preventDefault(); err.textContent = ''; const btn = L.$('#lock-go'); btn.disabled = true; btn.textContent = create ? t('Encrypting...') : t('Unlocking...');
      try {
        if (create) { const iss = C.passIssues(p1.value); if (iss.length) throw new Error(iss.join(' ')); if (p1.value !== p2.value) throw new Error(t('The two passphrases differ.'));
          const st = demo.checked && role.value === 'office' ? window.StarkTradesDemo.demoState(C, C.today()) : C.newState(preset.value);
          st.device = { id: st.device.id || C.randomId(), role: role.value, lastHandoff: '' }; st.company.lang = C.I.lang; L.st = await S.create(p1.value, st); }
        else opened(await S.unlock(p1.value));
        p1.value = p2.value = ''; afterOpen();
      } catch (e) { if (e && e.code === 'corrupt') { L.st = null; safeMode(e.raw); return; } err.textContent = t(e.message || String(e)); p1.setAttribute('aria-invalid', 'true'); p1.focus(); L.st = null; }
      btn.disabled = false; btn.textContent = create ? t('Create encrypted workspace') : t('Unlock'); } },
    h('div', { class: 'row' }, h('div', { class: 'brand big grow' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('div', null, h('div', { class: 'stark' }, h('span', { class: 'stark-wm', role: 'img', 'aria-label': 'Stark' })), h('div', { class: 'name' }, 'TRADES'))), langBtn),
    create ? h('h1', null, t('Welcome to Stark Trades')) : h('h1', null, t('Unlock Stark Trades')),
    create ? h('div', { class: 'try-box', id: 'try-box' }, h('p', null, t('See it working first: a sample plumbing company with jobs, subs, a schedule and money owed. No passphrase, nothing saved.')),
      h('button', { type: 'button', class: 'btn primary wide', id: 'try-it', onclick: () => L.tryIt() }, t('Try it with a sample company'))) : null,
    create ? h('h2', null, t('Set your passphrase')) : null,
    create ? h('p', { class: 'muted' }, t('Jobs, subs, customers and photos are encrypted with this passphrase before they are saved on this computer. Nothing is sent anywhere. There is no reset: if you forget it, the data cannot be opened. Make backups.')) : h('p', { class: 'muted' }, t('Jobs and subcontractor command center. Everything stays on this computer.')),
    L.field(t('Passphrase'), p1, create ? t('At least 12 characters. Four random words work well.') : null), create ? L.field(t('Repeat passphrase'), p2) : null,
    create ? L.field(t('This device is'), role, t('Set up a field phone empty, then import a handoff file from the office.')) : null,
    create ? h('label', { class: 'check' }, demo, h('span', null, t('Start with the demo company (all names invented; clear it later in Settings)'))) : null,
    create ? L.field(t('Trade (when starting empty)'), preset) : null,
    err, h('button', { class: create ? 'btn wide' : 'btn primary wide', id: 'lock-go' }, create ? t('Create encrypted workspace') : t('Unlock')),
    create ? null : pkSlot,
    h('p', { class: 'fine' }, t('A business tool, not legal or tax advice. Lien, licensing and insurance rules differ by state.')));
    p1.setAttribute('aria-describedby', 'lock-err'); p1.addEventListener('input', () => p1.removeAttribute('aria-invalid'));
    lock.appendChild(form); if (create) L.$('#try-it').focus(); else p1.focus();
    /* passkey unlock: offered only when this workspace has one and the browser can use it */
    if (!create && L.passkey && L.passkey.possible()) S.passkeyInfo().then(info => { if (!info || !pkSlot.isConnected) return;
      pkSlot.appendChild(h('button', { type: 'button', class: 'btn wide', id: 'lock-passkey', onclick: async e => { err.textContent = ''; const b = e.target; b.disabled = true;
        try { opened(await L.passkeyUnlock()); p1.value = ''; afterOpen(); } catch (x) { if (x && x.code === 'corrupt') { L.st = null; safeMode(x.raw); return; } err.textContent = L.passkeyWhy(x); L.st = null; } b.disabled = false; } }, t('Unlock with passkey'))); }).catch(() => { /* no passkey */ });
  }
  const pkSlot0 = () => h('div', { class: 'stack', id: 'pk-slot' });
  let pkSlot = pkSlot0();
  function opened(st) { L.st = C.migrate(st); if (!L.st.device.id) L.st.device.id = C.randomId(); if (L.st.company.lang && L.st.company.lang !== C.I.lang) L.setLang(L.st.company.lang); }
  function afterOpen() {
    if (S.recovered) { S.recovered = false; L.toast(t('The latest save was damaged, so the last good copy was restored.'), true); }
    else if (S.rolledBack) { S.rolledBack = false; L.toast(t('Warning: this is an older copy than the last one saved on this computer. Someone or something may have put back old data. Check recent work and restore a backup if needed.'), true); }
    L.restartIdle(); if (location.hash === '' || location.hash === '#') location.hash = L.st.device.role === 'field' ? '#/field' : '#/today'; L.render();
    if (L.autoFile) L.autoFile.load().then(() => { if (L.autoFile.status === 'paused') L.toast(t('Automatic backup is paused. Open Share and backup to allow it again.')); }).catch(() => { /* not supported */ });
  }
  L.lockNow = async function () { clearTimeout(idleTimer); await S.flush(); if (L.autoFile) await L.autoFile.flush().catch(() => { /* reported on the card */ }); S.lock(); L.freePhotos(); const d = L.$('#dlg'); if (d.open) d.close(); L.clear(L.$('#main')); L.clear(L.$('#print-root')); L.$('#save-state').hidden = true; showLock((await S.hasVault()) ? 'unlock' : 'create'); };
  L.restartIdle = function () { clearTimeout(idleTimer); if (!L.st) return; const min = L.st.company.lockMin || 10; idleTimer = setTimeout(() => { if (L.st) { L.lockNow(); L.toast(t('Locked after {n} quiet minutes.', { n: min })); } }, min * 60000); };
  ['click', 'keydown', 'pointerdown'].forEach(ev => document.addEventListener(ev, () => { if (L.st) L.restartIdle(); }, { passive: true }));

  async function boot() {
    let saved = null, lang = null; try { saved = localStorage.getItem('stark-trades-theme'); lang = localStorage.getItem('stark-trades-lang'); } catch (e) { /* storage blocked */ }
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    if (!lang) lang = /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
    L.setLang(lang);
    L.$('#theme').addEventListener('click', () => { const cur = document.documentElement.getAttribute('data-theme') || 'dark', nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', nx); try { localStorage.setItem('stark-trades-theme', nx); } catch (e) { /* ignore */ } });
    L.$('#lang-btn').addEventListener('click', () => L.toggleLang());
    document.addEventListener('change', e => { if (e.target && e.target.id === 'lang-pick' && (e.target.value === 'es') !== (C.I.lang === 'es')) { fromPicker = true; try { L.toggleLang(); } finally { fromPicker = false; } } }, true);   // picker: es = the app's own Spanish, any other = English underneath
    L.$('#lock-btn').addEventListener('click', () => L.lockNow());
    L.$('#search-btn').addEventListener('click', () => L.palette());
    window.addEventListener('hashchange', () => L.render());
    window.addEventListener('pagehide', () => { S.flush(); });
    S.onState = k => { if (L.st) L.saveState(k); };
    S.onSaved = () => { if (L.autoFile && L.st) L.autoFile.schedule(); };
    S.onSaveError = () => L.saveState('error') || L.toast(t('The last save could not be verified. Your previous good copy was kept. Make a backup now.'), true);
    try { showLock((await S.hasVault()) ? 'unlock' : 'create'); }
    catch (e) { L.clear(L.$('#lock')).appendChild(h('div', { class: 'lockbox' }, h('h1', null, t('Storage is not available')), h('p', null, t('This browser blocks IndexedDB (private windows often do). Open Stark Trades in a normal window.')))); L.$('#lock').hidden = false; }
  }
  boot();
})();
