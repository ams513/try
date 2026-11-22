/* Stark Tenancy: help and official links, about and honest limits, settings (tenancies, example data, backup, erase). */
(function (root) {
  'use strict';
  var TN = root.TN, ui = TN.ui, h = ui.h, S = TN.store, T = TN.i18n.T, L = TN.i18n.L, D = TN.dates;

  ui.route('help', 'Help', function (main) {
    var m = TN.data.meta;
    ui.esReady();
    main.appendChild(ui.hero(T('Help and official links', 'Ayuda y enlaces oficiales'), T('Rules for repairs, deposits and notices are set by your state and city. These official pages and legal aid offices can tell you what applies where you live.', 'Las reglas de reparaciones, depósitos y avisos las fija su estado y ciudad. Estas páginas oficiales y oficinas de asistencia legal pueden decirle qué aplica donde vive.'), true));
    main.appendChild(h('div', { class: 'notice legal big' }, h('strong', { text: T(m.notLegal, m.notLegalEs) }), ' ', T(m.general, m.generalEs)));
    main.appendChild(ui.notice(T('This app never opens websites. Copy an address into your browser. Each entry shows who publishes it and the date we checked that it loads. Pages move, so check the date.', 'Esta app nunca abre sitios web. Copie una dirección en su navegador. Cada entrada muestra quién la publica y la fecha en que comprobamos que carga. Las páginas cambian, así que revise la fecha.'), 'soft'));
    TN.data.resourceGroups.forEach(function (g) {
      main.appendChild(ui.card(L(g), TN.data.resources.filter(function (r) { return r.group === g.id; }).map(function (r) {
        return h('div', { class: 'srcrow' }, h('strong', { text: r.title }), h('p', { class: 'small src', text: T('Source: ', 'Fuente: ') + r.source + T(' · Checked ', ' · Revisado el ') + D.pretty(r.checked) }), ui.copyLine(r.url), r.note ? h('p', { class: 'small', text: T(r.note, r.noteEs) }) : null);
      }), 'res-' + g.id));
    });
    main.appendChild(ui.card(T('When to get legal help', 'Cuándo buscar ayuda legal'), [h('ul', null,
      h('li', { text: T('You received court papers or an eviction notice. Deadlines can be very short: contact legal aid the same day.', 'Recibió papeles de un tribunal o un aviso de desalojo. Los plazos pueden ser muy cortos: contacte a la asistencia legal el mismo día.') }),
      h('li', { text: T('A repair affects health or safety and nothing has happened after written requests.', 'Una reparación afecta la salud o la seguridad y no ha pasado nada tras pedirla por escrito.') }),
      h('li', { text: T('You are thinking about withholding rent, repairing and deducting, or ending the lease early. These often have strict rules.', 'Está pensando en retener la renta, reparar y descontar, o terminar el contrato antes. Suelen tener reglas estrictas.') }),
      h('li', { text: T('You think you were treated differently because of race, color, religion, sex, national origin, familial status or disability.', 'Cree que le trataron distinto por raza, color, religión, sexo, origen nacional, situación familiar o discapacidad.') }))]));
  });

  ui.route('about', null, function (main) {
    var m = TN.data.meta;
    main.appendChild(h('h2', { text: 'About Stark Tenancy' }));
    main.appendChild(ui.card('What it is', [h('p', null, 'Stark Tenancy, ', h('em', { text: 'a Stark product' }), ', version ' + m.version + '. A private, offline record keeper for renters, and for small landlords who want to treat tenants fairly: condition reports with dated photos and sign-off, a repair log, a rent and deposit ledger, letters and alarm reminders.'),
      h('ul', null, h('li', { text: 'Pay once. No accounts, ads, analytics or network calls: the page blocks them.' }), h('li', { text: 'Everything stays on this device. Photos are kept in this browser’s own storage. Use Settings to back up or erase.' }),
        h('li', { text: 'Local protections: saves are checked and a last good copy is kept, backups carry a SHA-256 checksum (photos included) and are validated before restore, and signed reports carry a fingerprint that shows any later change.' }))]));
    main.appendChild(ui.card('By design', [h('p', { text: m.byDesign }), h('p', { text: 'Stark Tenancy records a home and a tenancy. It has no features for rating, screening, tracking or reporting people, and never will.' })]));
    main.appendChild(ui.card('Honest limits', [h('ul', null,
      h('li', { text: m.notLegal + ' The letters are general templates with no state-specific legal claims. They are not formal legal notices.' }),
      h('li', { text: 'Records help, but no record guarantees an outcome. Courts and agencies decide what evidence counts.' }),
      h('li', { text: 'The date strip on each photo shows when it was added to the app (this device’s clock) and, when the JPEG file carried one, its camera date. A camera date is only as right as the camera’s clock, and anyone can edit it. The app cannot prove when a photo was taken; it keeps a resized copy, so keep the original files.' }),
      h('li', { text: 'An on-device signature records that both people reviewed the report. It is not a notarized or certified electronic signature.' }),
      h('li', { text: 'Data lives only in this browser on this device. Clearing browser data erases it. Save a backup file regularly.' }),
      h('li', { text: 'Reminders show inside the app. For alerts while it is closed, add the calendar file from the Alarms page to your calendar.' }),
      h('li', { text: 'The rent ledger does not prorate partial months or calculate late fees or interest.' }),
      h('li', { text: 'Spanish text is a machine translation pending review. Letters are written in English.' }))]));
    main.appendChild(ui.card('Credits', [h('p', { text: 'Stark Tenancy, by Stark. Built on the Stark Warden shell (letters engine, crash-safe storage, backup checks) and Stark Family Vault’s photo handling. No third-party code or assets. Example data, names, addresses and photos are made up.' }), (function () { var t = document.getElementById('stark-notice-tpl'); return t && t.content ? t.content.cloneNode(true) : null; })()]));
  });

  /* ---------- region format, currency and paper (dates and money on screen and in reports go through TN.fmt) ---------- */
  var REGIONS = [['en-US', 'English, United States (en-US)'], ['en-GB', 'English, United Kingdom (en-GB)'], ['es-ES', 'Español, España (es-ES)'], ['es-MX', 'Español, México (es-MX)'], ['de-DE', 'Deutsch, Deutschland (de-DE)'],
    ['fr-FR', 'Français, France (fr-FR)'], ['pt-BR', 'Português, Brasil (pt-BR)'], ['ja-JP', '日本語 (ja-JP)'], ['en-IN', 'English, India (en-IN)'], ['ar-EG', 'العربية، مصر (ar-EG)']];
  var CURRENCIES = [['USD', 'US dollar'], ['EUR', 'Euro'], ['GBP', 'Pound sterling'], ['MXN', 'Mexican peso'], ['CAD', 'Canadian dollar'], ['AUD', 'Australian dollar'], ['BRL', 'Brazilian real'], ['JPY', 'Japanese yen'], ['INR', 'Indian rupee'], ['CHF', 'Swiss franc'], ['EGP', 'Egyptian pound']];
  function formatCard(s, save) {
    var prev = h('p', { class: 'small', id: 'fmt-preview' }), errR = h('div', { class: 'field-err', id: 'st-region-err', role: 'alert' }), errC = h('div', { class: 'field-err', id: 'st-cur-err', role: 'alert' }), regionSel, regionTxt, curSel, curTxt, paperSel,
      regionListed = !s.region || REGIONS.some(function (r) { return r[0] === s.region; }), curListed = CURRENCIES.some(function (c) { return c[0] === s.currency; });
    function preview() { ui.clear(prev).appendChild(root.document.createTextNode(T('Preview: ', 'Vista previa: ') + D.pretty('2026-11-02') + ' · ' + D.monthLabel('2026-11') + ' · ' + TN.util.money(1450.5) + ' · ' + TN.util.money(-12))); }
    function pick(sel, txt, err, valid, bad, set) {
      var v = sel.value, c;
      txt.hidden = v !== 'other'; err.textContent = ''; txt.removeAttribute('aria-invalid');
      if (v === 'other') {
        if (!txt.value.trim()) { return; }
        c = valid(txt.value);
        if (!c) { err.textContent = bad; txt.setAttribute('aria-invalid', 'true'); return; }
        set(c);
      } else { set(v); }
      save(s); preview();
    }
    regionSel = h('select', { id: 'st-region', onchange: function () { pick(regionSel, regionTxt, errR, TN.fmt.validLocale, T('This browser does not know that region format. Try a tag such as nl-NL or sv-SE.', 'Este navegador no conoce ese formato regional. Pruebe una etiqueta como nl-NL o sv-SE.'), function (c) { s.region = c; }); } },
      [['', T('Automatic (this browser)', 'Automático (este navegador)')]].concat(REGIONS, [['other', T('Other: type a language tag…', 'Otro: escriba una etiqueta de idioma…')]]).map(function (o) { return h('option', { value: o[0] }, o[1]); }));
    regionTxt = h('input', { type: 'text', id: 'st-region-other', placeholder: 'nl-NL', 'aria-label': T('Language tag, for example nl-NL', 'Etiqueta de idioma, por ejemplo nl-NL'), autocomplete: 'off', value: regionListed ? '' : s.region, onchange: function () { pick(regionSel, regionTxt, errR, TN.fmt.validLocale, T('This browser does not know that region format. Try a tag such as nl-NL or sv-SE.', 'Este navegador no conoce ese formato regional. Pruebe una etiqueta como nl-NL o sv-SE.'), function (c) { s.region = c; }); } });
    regionSel.value = !s.region ? '' : (regionListed ? s.region : 'other'); regionTxt.hidden = regionSel.value !== 'other';
    curSel = h('select', { id: 'st-currency', onchange: function () { pick(curSel, curTxt, errC, TN.fmt.validCurrency, T('That is not a currency code this browser knows. Use three letters, for example SEK.', 'Ese no es un código de moneda que este navegador conozca. Use tres letras, por ejemplo SEK.'), function (c) { s.currency = c; }); } },
      CURRENCIES.map(function (c) { return h('option', { value: c[0] }, c[0] + ' · ' + c[1]); }).concat([h('option', { value: 'other' }, T('Other: type a 3-letter code…', 'Otra: escriba un código de 3 letras…'))]));
    curTxt = h('input', { type: 'text', id: 'st-currency-other', placeholder: 'SEK', maxlength: '3', 'aria-label': T('Currency code, for example SEK', 'Código de moneda, por ejemplo SEK'), autocomplete: 'off', value: curListed ? '' : s.currency, onchange: function () { pick(curSel, curTxt, errC, TN.fmt.validCurrency, T('That is not a currency code this browser knows. Use three letters, for example SEK.', 'Ese no es un código de moneda que este navegador conozca. Use tres letras, por ejemplo SEK.'), function (c) { s.currency = c; }); } });
    curSel.value = curListed ? s.currency : 'other'; curTxt.hidden = curSel.value !== 'other';
    paperSel = h('select', { id: 'st-paper', onchange: function () { s.paper = paperSel.value; save(s); } }, [['auto', T('The print window’s default', 'El predeterminado de la ventana de impresión')], ['a4', 'A4 (210 × 297 mm)'], ['letter', 'US Letter (8.5 × 11 in)']].map(function (o) { return h('option', { value: o[0] }, o[1]); }));
    paperSel.value = s.paper || 'auto';
    preview();
    return ui.card(T('Dates, money and paper', 'Fechas, dinero y papel'), [
      h('p', { class: 'small', text: T('Choose how dates and amounts are shown on screen, in printed reports and in letters. Letters stay in English; only the date and amount format follows your choice. Your saved data does not change: dates stay YYYY-MM-DD and amounts stay plain numbers, and the CSV and calendar files you save use those machine-readable forms too. The currency is a label for your amounts; the app does not convert between currencies.', 'Elija cómo se muestran las fechas y los montos en pantalla, en los reportes impresos y en las cartas. Las cartas siguen en inglés; solo el formato de fecha y monto sigue su elección. Sus datos guardados no cambian: las fechas siguen como AAAA-MM-DD y los montos como números simples, y los archivos CSV y de calendario que guarde usan esas formas legibles por máquina. La moneda es una etiqueta para sus montos; la app no convierte entre monedas.') }),
      h('div', { class: 'row' },
        h('div', { class: 'field' }, h('label', { for: 'st-region', text: T('Region format (dates and numbers)', 'Formato regional (fechas y números)') }), regionSel, regionTxt, errR),
        h('div', { class: 'field' }, h('label', { for: 'st-currency', text: T('Currency', 'Moneda') }), curSel, curTxt, errC),
        h('div', { class: 'field' }, h('label', { for: 'st-paper', text: T('Paper for printed reports', 'Papel para los reportes impresos') }), paperSel)),
      prev]);
  }

  ui.route('settings', null, function (main) {
    var s = S.settings(), file = h('input', { type: 'file', accept: '.json,application/json', id: 'imp' }), pl = h('div'), use = h('p', { class: 'small' }), armed = false;
    function save(ns) { S.setSettings(ns); ui.applySettings(); }
    function switchTo(p) { var st = S.settings(); st.profile = p; save(st); ui.buildNav(); ui.renderRoute(); }
    main.appendChild(h('h2', { text: 'Settings' }));
    main.appendChild(ui.card('Look and language', [h('div', { class: 'row' },
      h('div', { class: 'field' }, h('label', { for: 'st-theme', text: 'Theme' }), h('select', { id: 'st-theme', onchange: function (e) { s.theme = e.target.value; save(s); } }, [['auto', 'Match my device'], ['dark', 'Dark'], ['light', 'Light']].map(function (o) { return h('option', { value: o[0], selected: s.theme === o[0] ? true : null }, o[1]); }))),
      h('div', { class: 'field' }, h('label', { for: 'st-lang', text: 'Language' }), h('select', { id: 'st-lang', onchange: function (e) { s.lang = e.target.value; save(s); ui.buildNav(); ui.renderRoute(); } }, [['en', 'English'], ['es', 'Español (machine translation pending review)']].map(function (o) { return h('option', { value: o[0], selected: s.lang === o[0] ? true : null }, o[1]); }))),
      h('div', { class: 'field check' }, h('input', { type: 'checkbox', id: 'st-large', checked: !!s.large, onchange: function (e) { s.large = e.target.checked; save(s); } }), h('label', { for: 'st-large', text: 'Large text' })))]));

    main.appendChild(formatCard(s, save));

    s.profiles.forEach(function (p) {
      pl.appendChild(h('div', { class: 'logrow' }, h('strong', { text: (s.names[p] || p) + (p === s.profile ? ' (in use)' : '') }), p === s.profile ? null : h('button', { type: 'button', class: 'btn small', onclick: function () { switchTo(p); } }, 'Switch to this tenancy'),
        p !== s.profile && p !== 'main' ? h('button', { type: 'button', class: 'btn small danger', onclick: function (e) {
          if (e.target.textContent.indexOf('again') < 0) { e.target.textContent = 'Press again to delete it and its photos'; return; }
          S.removeProfile(p).then(function () { var st = S.settings(); st.profiles = st.profiles.filter(function (x) { return x !== p; }); delete st.names[p]; save(st); ui.toast('Tenancy deleted.'); ui.renderRoute(); });
        } }, 'Delete') : null));
    });
    var np = h('input', { type: 'text', id: 'np', placeholder: 'For example: 22 Oak St, Apt 4' });
    main.appendChild(ui.card('Tenancies', [h('p', { class: 'small', text: 'Each tenancy keeps its own reports, photos, repairs, ledger, letters and alarms. Useful when you move, or when a small landlord keeps a record for each unit. Tenancies are not locked or encrypted; anyone using this browser profile can open them.' }), pl,
      h('div', { class: 'field' }, h('label', { for: 'np', text: 'New tenancy' }), np),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { var n = np.value.trim(), st = S.settings(), id; if (!n) { ui.toast('Give the tenancy a name.'); return; } id = 't' + TN.uid(); st.profiles.push(id); st.names[id] = n; st.profile = id; save(st); ui.buildNav(); ui.go('details'); } }, 'Add and switch'))]));

    main.appendChild(ui.card('Example data', [h('p', { class: 'small', text: 'Load a made-up tenancy to see every screen filled in. It is kept separate from your own tenancies and is clearly marked on every screen.' }),
      h('div', { class: 'row' }, s.profiles.indexOf('example') < 0 ? h('button', { type: 'button', class: 'btn', onclick: function () { TN.demo.load().then(function () { ui.buildNav(); ui.go('home'); ui.renderRoute(); }); } }, 'Load the example tenancy') : null,
        s.profiles.indexOf('example') >= 0 ? h('button', { type: 'button', class: 'btn danger', onclick: function () { TN.demo.remove().then(function () { ui.toast('Example removed.'); ui.go('home'); ui.renderRoute(); }); } }, 'Remove the example tenancy') : null)]));

    main.appendChild(ui.card('Back up and restore', [ui.notice('Stored unencrypted: everything you enter here, photos included, is kept as plain data in this browser on this device. Anyone who can use this browser profile, or copy its files, can read it. For a locked copy, save a sealed backup with a passphrase on the Insights page.', 'warn'),
      h('p', { class: 'small', text: 'A backup file holds every tenancy and every photo on this device, with a SHA-256 checksum. It is not encrypted: keep it somewhere private.' }), use,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { S.exportAll().then(function (b) { ui.saveText('stark-tenancy-backup-' + ui.today() + '.json', JSON.stringify(b), 'application/json'); }); } }, 'Save a backup file')),
      h('div', { class: 'field' }, h('label', { for: 'imp', text: 'Restore from a backup file' }), file), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () {
        var f = file.files && file.files[0], r;
        if (!f) { ui.toast('Choose a backup file first.'); return; }
        r = new root.FileReader();
        r.onload = function () { var obj; try { obj = JSON.parse(r.result); } catch (e) { ui.toast('That file is not a backup. Nothing was changed.', true); return; } S.importAll(obj).then(function (v) { ui.applySettings(); ui.buildNav(); ui.toast('Restored: checksum verified, ' + v.photos + ' photos.'); ui.renderRoute(); }, function (e) { ui.toast(e.message, true); }); };
        r.readAsText(f);
      } }, 'Restore'))]));
    TN.photos.usage().then(function (u) { TN.photos.persistent().then(function (ok) { use.textContent = u.count + ' photos, about ' + (u.bytes / 1048576).toFixed(1) + ' MB.' + (ok ? '' : ' This browser does not allow saving photos here, so photos last only until you close the page. Open the app in a regular browser window.'); }); });

    main.appendChild(ui.card('Erase everything', [h('p', { class: 'small', text: 'Removes all saved data on this device, including every tenancy and photo. This cannot be undone.' }), h('button', { type: 'button', class: 'btn danger', onclick: function (e) {
      if (!armed) { armed = true; e.target.textContent = 'Press again to erase everything'; return; }
      S.wipe().then(function () { ui.applySettings(); ui.buildNav(); ui.toast('Everything erased.'); ui.go('home'); ui.renderRoute(); });
    } }, 'Erase all my data')]));
  });
})(typeof window !== 'undefined' ? window : globalThis);
