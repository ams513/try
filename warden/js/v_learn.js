/* Stark Warden: home, guides (Learn), about and sources, settings. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, S = SW.store;

  /* ---------- Learn ---------- */
  function renderGuide(g) {
    var box = h('div', { class: 'card guide print-letter' });
    box.appendChild(h('h2', { text: g.title }));
    if (g.summary) { box.appendChild(h('p', { class: 'lead', text: g.summary })); }
    g.blocks.forEach(function (b) {
      if (b.h) { box.appendChild(h('h3', { text: b.h })); }
      if (b.p) { box.appendChild(h('p', { text: b.p })); }
      if (b.ul) { box.appendChild(h('ul', null, b.ul.map(function (x) { return h('li', { text: x }); }))); }
    });
    if (g.id === 'recording') {
      box.appendChild(h('h3', { text: 'All-party consent states' }));
      box.appendChild(h('p', { text: SW.data.consent.allParty.map(function (k) { return SW.data.sol.states[k].name; }).join(', ') + '.' }));
      box.appendChild(h('ul', null, Object.keys(SW.data.consent.special).map(function (k) { return h('li', { text: SW.data.consent.special[k] }); })));
    }
    if (g.checks) { box.appendChild(h('h3', { text: 'Checklist' })); box.appendChild(SW.views.checklist(g)); }
    if (g.cites && g.cites.length) { box.appendChild(h('p', { class: 'small' }, h('strong', { text: 'Rules and sources: ' }), g.cites.join('; '))); }
    box.appendChild(ui.notice(SW.data.meta.notLegal, 'legal'));
    box.appendChild(h('p', { class: 'small', text: 'Information as of ' + SW.data.meta.asOfLabel + '. ' + 'Check the date.' }));
    box.appendChild(h('div', { class: 'row noprint' }, h('button', { type: 'button', class: 'btn small', onclick: function () { ui.printEl(box); } }, 'Print this one-page guide'), h('a', { class: 'btn small', href: '#/learn', text: 'All guides' })));
    return box;
  }

  function quickGuides(main) {
    var s = S.settings(), lang = s.lang || 'en', sel = h('select', { id: 'qg-lang', 'aria-label': 'Language' }, SW.data.langs.map(function (l) { return h('option', { value: l.id, selected: l.id === lang }, l.label); })), box = h('div', { class: 'print-letter' });
    function draw() {
      var q = SW.data.quick[sel.value] || SW.data.quick.en;
      ui.clear(box);
      box.appendChild(h('div', { class: 'card' }, q.draft ? ui.notice(q.draft + ' (Machine draft: not reviewed.)', 'warn') : null, h('h3', { text: q.scam.title }), h('ol', null, q.scam.items.map(function (x) { return h('li', { text: x }); })),
        h('h3', { text: q.debt.title }), h('ol', null, q.debt.items.map(function (x) { return h('li', { text: x }); })), h('div', { class: 'row noprint' }, h('button', { type: 'button', class: 'btn small', onclick: function () { ui.printEl(box); } }, 'Print'))));
    }
    sel.addEventListener('change', draw);
    main.appendChild(ui.card('Quick guides in other languages', [h('p', { class: 'small', text: 'Short versions of the core scam and debt guides. The non-English versions are machine drafts and have not been reviewed by a native speaker or a lawyer.' }), h('div', { class: 'field' }, h('label', { for: 'qg-lang', text: 'Language' }), sel), box]));
    draw();
  }

  ui.route('learn', 'Learn', function (main, args) {
    var id = args[0], g = id && SW.data.guides.filter(function (x) { return x.id === id; })[0], q = '';
    if (id === 'languages') { main.appendChild(h('p', null, h('a', { href: '#/learn', text: '← All guides' }))); quickGuides(main); return; }
    if (g) { main.appendChild(h('p', null, h('a', { href: '#/learn', text: '← All guides' }))); main.appendChild(renderGuide(g)); return; }
    var search = h('input', { type: 'search', id: 'gq', placeholder: 'Search guides' }), box = h('div');
    function draw() {
      var term = search.value.toLowerCase().trim(); ui.clear(box);
      SW.data.guideCats.forEach(function (c) {
        var gs = SW.data.guides.filter(function (x) { return x.cat === c.id && (!term || (x.title + ' ' + (x.summary || '')).toLowerCase().indexOf(term) >= 0); });
        if (gs.length) { box.appendChild(ui.card(c.label, [h('div', { class: 'tiles' }, gs.map(function (x) { return h('a', { class: 'tile', href: '#/learn/' + x.id }, h('strong', { text: x.title }), h('span', { text: x.summary || '' })); }))])); }
      });
      if (!box.firstChild) { box.appendChild(h('p', { class: 'muted', text: 'No guides match.' })); }
    }
    search.addEventListener('input', draw);
    main.appendChild(h('h2', { text: 'Guides' }));
    main.appendChild(h('div', { class: 'field' }, h('label', { for: 'gq', text: 'Search' }), search));
    main.appendChild(h('p', null, h('a', { class: 'btn small', href: '#/learn/languages', text: 'Quick guides in 7 languages (machine drafts)' })));
    main.appendChild(box); draw();
  });

  /* ---------- About and sources ---------- */
  ui.route('about', null, function (main) {
    var m = SW.data.meta;
    main.appendChild(h('h2', { text: 'About Stark Warden' }));
    main.appendChild(ui.card('What it is', [h('p', null, 'Stark Warden, ', h('em', { text: 'a Stark product' }), ', version ' + m.version + '. A private, offline companion for the moments when debt collectors or scammers pressure you: your rights, a calm script, practice, letters and a plan, for the United States.'),
      h('ul', null, h('li', { text: 'No accounts, ads, analytics or network calls. The page blocks them.' }), h('li', { text: 'Everything you type stays on this device. Use Settings to back up or erase it.' }), h('li', { text: 'Local protections, no tracking: saves are checked and a last good copy is kept, backups carry a damage check and are validated before restore, backups can be encrypted with a passphrase, and the vault is encrypted and locks itself when idle.' }), h('li', { text: 'It looks for warning signs with fixed rules you can read. It does not guess or claim certainty.' }))]));
    main.appendChild(ui.card('Honest limits', [ui.usNote(true), h('p', { text: m.notLegal }), h('p', { text: m.check }), h('p', { text: 'Scope: ' + m.scope + ' Information date: ' + m.asOfLabel + '.' }),
      h('p', { text: 'Scam patterns change constantly. A message with no warning signs can still be a scam, and a real message can look suspicious. The time-limit table and recording-law table are summaries and need checking against your state’s current law.' })]));
    main.appendChild(ui.card('Sources (copy into your browser; this app never opens them)', [SW.data.sources.map(function (s) {
      return h('div', { class: 'srcrow' }, h('strong', { text: s.org + ': ' + s.title }), ui.copyLine(s.url), s.note ? h('p', { class: 'small', text: s.note }) : null);
    })]));
    main.appendChild(ui.card('Credits', [h('p', { text: 'Stark Warden, by Stark. All sample messages, names, companies and numbers in this app are made up. No real company is named as a wrongdoer. No third-party code or assets are used. Spanish text is a machine translation pending review. The other screen languages are machine drafts of the labels, buttons and menus only: the letters, rights, scripts and everything that states United States law stay in English.' })]));
    var sn = typeof document !== 'undefined' && document.getElementById('stark-notice-tpl');
    if (sn && sn.content) { main.appendChild(document.importNode(sn.content, true)); }
  });

  /* ---------- Settings ---------- */
  var autoSub = null;
  ui.route('settings', null, function (main) {
    var s = S.settings(), file = h('input', { type: 'file', accept: '.json,application/json', id: 'imp' });
    function save(ns) { S.setSettings(ns); SW.ui.applySettings(); }
    main.appendChild(h('h2', { text: 'Settings' }));
    main.appendChild(ui.card('Look', [h('div', { class: 'row' },
      h('div', { class: 'field' }, h('label', { for: 'st-theme', text: 'Theme' }), h('select', { id: 'st-theme', onchange: function (e) { s.theme = e.target.value; save(s); } }, [['auto', 'Match my device'], ['dark', 'Dark'], ['light', 'Light']].map(function (o) { return h('option', { value: o[0], selected: s.theme === o[0] }, o[1]); }))),
      h('div', { class: 'field check' }, h('input', { type: 'checkbox', id: 'st-large', checked: !!s.large, onchange: function (e) { s.large = e.target.checked; save(s); } }), h('label', { for: 'st-large', text: 'Large text' })))]));
    var names = s.names || {}, pl = h('div');
    function drawP() {
      ui.clear(pl);
      s.profiles.forEach(function (p) {
        pl.appendChild(h('div', { class: 'logrow' }, h('strong', { text: (names[p] || p) + (p === s.profile ? ' (in use)' : '') }), p === s.profile ? null : h('button', { type: 'button', class: 'btn small', onclick: function () { s.profile = p; save(s); SW.ui.renderRoute(); } }, 'Switch to this profile')));
      });
    }
    var np = h('input', { type: 'text', id: 'np', placeholder: 'Name for a new profile, for example Mom' });
    main.appendChild(ui.card('Family profiles', [h('p', { class: 'small', text: 'Each profile keeps its own debts, log, letters and checklists on this device. The profiles are not password protected: use the Vault for secrets.' }), pl, h('div', { class: 'field' }, h('label', { for: 'np', text: 'New profile' }), np),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { var n = np.value.trim(); if (!n) { return; } var id = 'p' + ui.uid(); s.profiles.push(id); names[id] = n; s.names = names; s.profile = id; save(s); SW.ui.renderRoute(); } }, 'Add and switch'))]));
    drawP();
    /* ---------- backups: plain, encrypted, and encrypted autosave to a chosen file ---------- */
    var MAX_FILE = 30 * 1024 * 1024;
    function pairFields(prefix) {
      var a = h('input', { type: 'password', id: prefix + '1', autocomplete: 'new-password' }), b = h('input', { type: 'password', id: prefix + '2', autocomplete: 'new-password' });
      return { a: a, b: b, el: h('div', { class: 'row' }, h('div', { class: 'field' }, h('label', { for: prefix + '1', text: 'Backup passphrase' }), a), h('div', { class: 'field' }, h('label', { for: prefix + '2', text: 'Type it again' }), b)),
        check: function () { var st = SW.vault.strength(a.value); ui.fieldError(a, ''); ui.fieldError(b, ''); if (!st.ok) { ui.fieldError(a, 'Too short or too simple. ' + st.tip); return null; } if (a.value !== b.value) { ui.fieldError(b, 'The two passphrases do not match.'); return null; } return a.value; },
        reset: function () { a.value = ''; b.value = ''; } };
    }
    function restored(res) { SW.ui.applySettings(); ui.toast(res.checksum ? 'Restored. Damage check passed.' : 'Restored (older backup without a damage check, validated).'); SW.ui.renderRoute(); }
    var encPair = pairFields('bk'), autoPair = pairFields('as'), restorePass = h('input', { type: 'password', id: 'rp', autocomplete: 'current-password' }), restoreBox = h('div'), pendingEnc = null,
      autoState = h('p', { class: 'autosave-state' }), autoBtns = h('div', { class: 'row' });
    main.appendChild(ui.card('Back up and restore', [ui.notice('What Warden saves on this device (your log, letters, budget, profiles) is stored in this browser without encryption; only the vault is encrypted. A plain backup file is readable by anyone who gets it. Use an encrypted backup for anything you would not want others to read.', 'soft'),
      h('p', { class: 'small', text: 'A backup holds everything saved on this device for every profile. The vault stays encrypted inside it. Plain backups carry a damage check (it catches a broken file, not a deliberate edit).' }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { ui.saveText('stark-warden-backup.json', JSON.stringify(S.exportAll(), null, 2), 'application/json'); } }, 'Save a plain backup file'), h('button', { type: 'button', class: 'btn', onclick: function () { ui.copyText(JSON.stringify(S.exportAll())); } }, 'Copy plain backup text')),
      h('h4', { text: 'Encrypted backup' }), h('p', { class: 'small', text: 'AES-GCM 256 with a 600,000-round PBKDF2 key from a passphrase you choose. Without the passphrase nobody can read or restore it.' }), encPair.el,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function (e) {
        var pass = encPair.check(), btn = e.target;
        if (!pass) { return; }
        btn.disabled = true;
        SW.vault.sealBackup(S.exportAll(), pass).then(function (env) { encPair.reset(); ui.saveText('stark-warden-backup-encrypted.json', JSON.stringify(env), 'application/json'); }, function (er) { ui.toast(er.message, 'bad'); }).then(function () { btn.disabled = false; });
      } }, 'Save an encrypted backup')),
      h('h4', { text: 'Restore' }),
      h('div', { class: 'field' }, h('label', { for: 'imp', text: 'Restore from a backup file (plain or encrypted)' }), file), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () {
        var f = file.files && file.files[0], r;
        ui.fieldError(file, ''); ui.clear(restoreBox); pendingEnc = null;
        if (!f) { ui.fieldError(file, 'Choose a backup file first.'); return; }
        if (f.size > MAX_FILE) { ui.fieldError(file, 'This file is larger than 30 MB, too large to be a Warden backup. Nothing was changed.'); return; }
        r = new root.FileReader();
        r.onload = function () {
          var obj;
          try { obj = JSON.parse(r.result); } catch (e) { ui.fieldError(file, 'This file is not a Stark Warden backup (it is not valid JSON). Nothing was changed.'); return; }
          if (SW.vault.isEncBackup(obj)) {
            pendingEnc = obj;
            restoreBox.appendChild(h('div', { class: 'field' }, h('label', { for: 'rp', text: 'This backup is encrypted. Its passphrase' }), restorePass));
            restoreBox.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function (e) {
              var btn = e.target; btn.disabled = true; ui.fieldError(restorePass, '');
              SW.vault.openBackup(pendingEnc, restorePass.value).then(function (inner) { restorePass.value = ''; restored(S.importAll(inner)); }, function (er) { btn.disabled = false; ui.fieldError(restorePass, er.message); })
                .then(null, function (er) { btn.disabled = false; ui.fieldError(restorePass, er.message); });
            } }, 'Decrypt and restore')));
            restorePass.focus();
            return;
          }
          try { restored(S.importAll(obj)); } catch (e) { ui.fieldError(file, e.message); }
        };
        r.onerror = function () { ui.fieldError(file, 'The file could not be read. Nothing was changed.'); };
        r.readAsText(f);
      } }, 'Restore')), restoreBox]));

    function drawAuto() {
      var a = SW.autosave.status();
      ui.clear(autoBtns); autoPair.el.hidden = a.on || !a.supported;
      if (!a.supported) { autoState.textContent = 'This browser (or the page it is embedded in) does not let a page keep writing to a file you choose. Use Save an encrypted backup instead; the offline download in Chrome or Edge on a computer supports autosave.'; return; }
      if (a.on) {
        autoState.textContent = (a.err ? 'Autosave problem: ' + a.err + ' ' : 'Autosave is on. ') + 'File: ' + a.name + '. ' + (a.last ? 'Last written ' + new Date(a.last).toLocaleTimeString() + ' (' + a.writes + (a.writes === 1 ? ' write' : ' writes') + ' this session).' : 'Writing the first copy...');
        autoBtns.appendChild(h('button', { type: 'button', class: 'btn', onclick: function () { SW.autosave.writeNow(); } }, 'Write now'));
        autoBtns.appendChild(h('button', { type: 'button', class: 'btn danger', onclick: function () { SW.autosave.stop(); ui.toast('Autosave stopped. The file keeps its last copy.'); } }, 'Stop autosave'));
        return;
      }
      autoState.textContent = 'Autosave is off.';
      autoBtns.appendChild(h('button', { type: 'button', class: 'btn primary', onclick: function (e) {
        var pass = autoPair.check(), btn = e.target, handle;
        if (!pass) { return; }
        btn.disabled = true;
        SW.autosave.pick().then(function (hd) { handle = hd; return SW.vault.backupSession(pass); }).then(function (sess) { autoPair.reset(); return SW.autosave.start(handle, sess); })
          .then(function (ok) { if (ok) { ui.toast('Autosave is on. Every change is written to ' + SW.autosave.status().name + ', encrypted.'); } drawAuto(); },
            function (er) { btn.disabled = false; if (er && er.name === 'AbortError') { return; } ui.toast((er && er.name === 'SecurityError') ? 'This page is embedded in another site, which blocks file access. Open the offline download to use autosave.' : (er && er.message) || 'Autosave could not start.', 'bad'); });
      } }, 'Choose a file and turn on autosave'));
    }
    if (autoSub) { SW.autosave.offStatus(autoSub); }
    autoSub = function () { if (main.contains(autoState)) { drawAuto(); } };
    SW.autosave.onStatus(autoSub);
    main.appendChild(ui.card('Encrypted autosave to a file you choose', [h('p', { class: 'small', text: 'Pick a file once, for example in a folder your own cloud drive or a USB stick syncs. A few seconds after every change, Warden writes a fresh encrypted backup into it. The passphrase is not kept: only a locked key stays in memory until you close this tab, so autosave needs to be turned on again next time.' }),
      autoPair.el, autoState, autoBtns]));
    drawAuto();
    var armed = false;
    main.appendChild(ui.card('Erase everything', [h('p', { class: 'small', text: 'Removes all saved data on this device, including profiles and the vault. This cannot be undone.' }), h('button', { type: 'button', class: 'btn danger', onclick: function (e) {
      if (!armed) { armed = true; e.target.textContent = 'Press again to erase everything'; return; }
      S.wipe(); try { root.localStorage.removeItem('stark-warden-lang'); root.localStorage.removeItem('stark-warden-lang-seen'); } catch (e2) { /* storage off */ } SW.ui.applySettings(); ui.toast('Everything erased.'); SW.ui.go('home');
    } }, 'Erase all my data')]));
  });
})(typeof window !== 'undefined' ? window : globalThis);
