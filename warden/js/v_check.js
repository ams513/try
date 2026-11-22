/* Stark Warden: scam checking pages (message, link, phone, QR, checklists). */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h;

  var EXAMPLES = [
    'USPS: Your package is on hold due to an incomplete address. Confirm your address within 24 hours: https://usps-redelivery.top/track',
    'Hi Mom this is my new number, I lost my phone. Can you help me with a payment? I will pay you back.',
    'Your Norton subscription has been renewed for $399.99. If you did not authorize this charge call 1-844-555-0111 to cancel and get a refund.',
    'Your appointment with Dr. Lee is tomorrow at 3:00 PM. Reply C to confirm or call the office to reschedule.'
  ];

  function highlighted(text, res) {
    var seg = SW.highlight.segments(text, res), hits = seg.filter(function (x) { return x.hit; }).length;
    if (!hits) { return null; }
    return h('div', { class: 'hl-wrap' }, h('h4', { text: 'The red-flag words in your message (' + hits + ')' }),
      h('blockquote', { class: 'hl' }, seg.map(function (x) { return x.hit ? h('mark', { class: 'flag-hit', title: x.title }, x.t) : x.t; })),
      h('p', { class: 'small', text: 'Highlighted words match a warning sign. Point at one, or read the list below, to see which.' }));
  }
  /* "patterns as of": the built-in date and, when a pattern pack is loaded, the newest pack date. It never claims to be current. */
  function patternsAsOfText(res) {
    var a = res.patternsAsOf || SW.analyzer.patternsAsOf();
    return 'Warning-sign patterns as of ' + (a.label || a.builtin || 'the build date') + ' (built in)' + (a.newest ? '; newest loaded pattern pack dated ' + a.newest : '') + '. Scams change, and a result with no warning signs does not mean a message is safe.';
  }
  function analysisCard(res, opts) {
    var card = h('section', { class: 'card result' }), steps = h('ol', { class: 'steps' }, res.steps.map(function (s) { return h('li', { text: s }); }));
    opts = opts || {};
    ui.announce(res.level.label + '. Risk score ' + res.score + '.');
    card.appendChild(ui.meter(res.level));
    card.appendChild(h('p', { class: 'scoreline' }, h('span', { class: 'badge lv-' + res.level.id, text: 'Risk score ' + res.score }), ' ', h('span', { class: 'small', text: '0 to 2: few signs. 3 to 5: some. 6 to 9: many. 10 or more: strong pattern.' })));
    card.appendChild(h('p', { class: 'lead', text: res.level.line }));
    var hl = opts.text ? highlighted(opts.text, res) : null;
    if (hl) { card.appendChild(hl); }
    card.appendChild(h('h4', { text: res.flags.length ? 'Why (' + res.flags.length + ' warning sign' + (res.flags.length === 1 ? '' : 's') + ')' : 'What we looked for' }));
    card.appendChild(ui.flagList(res.flags));
    if (res.links.length) {
      card.appendChild(h('h4', { text: 'Links found in the message' }));
      res.links.forEach(function (l) { card.appendChild(linkPanel(l, true)); });
    }
    card.appendChild(h('h4', { text: 'What to do next' }));
    card.appendChild(steps);
    card.appendChild(ui.notice(res.disclaimer, 'soft'));
    card.appendChild(h('p', { class: 'small patterns-asof', text: patternsAsOfText(res) }));
    card.appendChild(h('div', { class: 'row' }, ui.copyBtn(function () {
      return 'Stark Warden check: ' + res.level.label + '\n' + res.flags.map(function (f) { return '- ' + f.title; }).join('\n') + '\n' + res.disclaimer + '\n' + patternsAsOfText(res);
    }, 'Copy summary'), h('a', { class: 'btn small', href: '#/packs', text: 'Pattern packs' })));
    return card;
  }

  function addressDisplay(l) {
    var host = l.unicodeHost || l.host, reg = l.registrable || host, i = host.lastIndexOf(reg), pre = i > 0 ? host.slice(0, i) : '', post = i >= 0 ? host.slice(i + reg.length) : '';
    if (i < 0) { return h('code', { class: 'addr' }, host); }
    return h('code', { class: 'addr', 'aria-label': 'Real site is ' + reg }, h('span', { class: 'dim', text: pre }), h('strong', { class: 'real', text: reg }), h('span', { class: 'dim', text: post }));
  }

  function linkPanel(l, compact) {
    var p = h('div', { class: 'linkpanel lv-' + l.level.id });
    p.appendChild(h('div', { class: 'row between' }, h('span', { class: 'badge lv-' + l.level.id, text: l.level.glyph + ' ' + l.level.label }), compact ? null : null));
    if (l.empty) { p.appendChild(h('p', { class: 'muted', text: 'No address found.' })); return p; }
    if (l.host) {
      p.appendChild(h('p', { class: 'small', text: 'The site this address really belongs to is the bold part:' }));
      p.appendChild(addressDisplay(l));
    }
    if (l.official) { p.appendChild(h('p', { class: 'ok', text: 'Belongs to ' + l.official + '’s real domain. ' + l.notes[0] })); }
    if (l.flags.length) { p.appendChild(ui.flagList(l.flags)); } else if (!l.official) { p.appendChild(h('p', { class: 'muted', text: 'No warning signs in the address itself. That does not make the page safe.' })); }
    return p;
  }

  function messageView(root_) {
    var ta = h('textarea', { id: 'msg', rows: 8, placeholder: 'Paste the text, email or direct message here. It is checked on this device and never leaves it.' }),
      sender = h('input', { id: 'sender', type: 'text', placeholder: 'Optional: who it came from (email address, or domain)' }),
      mode = h('select', { id: 'mode' }, [['', 'General check'], ['invoice', 'Fake invoice, refund, rental or marketplace'], ['debtrelief', 'Debt-relief or credit-repair offer'], ['collector', 'Debt collector call or letter']].map(function (o) { return h('option', { value: o[0] }, o[1]); })),
      out = h('div', { id: 'out' }), exN = 0;
    function run() {
      var res = SW.analyzer.analyze(ta.value, { sender: sender.value, focus: mode.value || null });
      ui.clear(out);
      if (res.empty) { out.appendChild(ui.notice('Paste a message first.', 'soft')); return; }
      out.appendChild(analysisCard(res, { text: ta.value }));
      SW.store.set('stat:checks', (SW.store.get('stat:checks', 0) || 0) + 1);
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    root_.appendChild(ui.card('Check a message', [
      h('p', { class: 'lead', text: 'Paste a text, email or direct message. You get the warning signs it matches, in plain words, and a caution level. Nothing is sent anywhere.' }),
      (root.document.documentElement.getAttribute('lang') || 'en') !== 'en' ? h('p', { class: 'small', text: SW.i18n.t('usMsg') }) : null,   /* the rules are English phrases: say so to anyone reading in another language */
      h('label', { for: 'msg', class: 'sr-only', text: 'Message to check' }), ta,
      h('div', { class: 'grid2' }, h('div', { class: 'field' }, h('label', { for: 'sender', text: 'Sender (optional)' }), sender), h('div', { class: 'field' }, h('label', { for: 'mode', text: 'Kind of message' }), mode)),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: run }, 'Check this message'),
        h('button', { type: 'button', class: 'btn', onclick: function () { ta.value = EXAMPLES[exN++ % EXAMPLES.length]; run(); } }, 'Try an example'),
        h('button', { type: 'button', class: 'btn', onclick: function () { ta.value = ''; sender.value = ''; ui.clear(out); } }, 'Clear'))
    ]));
    root_.appendChild(out);
    root_.appendChild(ui.notice('A pattern check cannot see who really sent a message and it cannot prove anything is safe. Use it to slow down, then verify with the organisation using a phone number or website you already trust.', 'soft'));
    root_.appendChild(h('p', { class: 'small patterns-asof' }, patternsAsOfText({}) + ' ', h('a', { href: '#/packs', text: 'Pattern packs' })));
  }

  function linkView(root_) {
    var inp = h('input', { id: 'url', type: 'text', placeholder: 'Paste a web address, for example https://paypa1-secure.com/login', autocomplete: 'off', spellcheck: 'false' }), out = h('div');
    function run() {
      var l = SW.links.inspect(inp.value);
      ui.clear(out);
      if (l.empty || !String(inp.value).trim()) { out.appendChild(ui.notice('Paste a web address first.', 'soft')); return; }
      ui.announce(l.level.label + '.');
      out.appendChild(h('section', { class: 'card result' }, ui.meter(l.level), linkPanel(l), ui.notice('The address was only read as text. It was never opened. A clean result does not prove a site is honest.', 'soft')));
    }
    root_.appendChild(ui.card('Inspect a link, offline', [
      h('p', { class: 'lead', text: 'Look-alike names, number addresses, shorteners, tricks with @ signs and misleading sub-names are shown without opening the link.' }),
      h('label', { for: 'url', class: 'sr-only', text: 'Web address' }), inp,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: run }, 'Inspect link'),
        h('button', { type: 'button', class: 'btn', onclick: function () { inp.value = 'https://paypal.com.account-verify.xyz/login'; run(); } }, 'Example: misleading sub-name'),
        h('button', { type: 'button', class: 'btn', onclick: function () { inp.value = 'https://www.paypa1.com/signin'; run(); } }, 'Example: look-alike'))
    ]));
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { run(); } });
    root_.appendChild(out);
    root_.appendChild(ui.card('How to read an address', [h('ul', null,
      h('li', null, 'The real site is the part just before the first single slash, counting from the right: in ', h('code', { text: 'paypal.com.verify.xyz' }), ' it is ', h('strong', { text: 'verify.xyz' }), ', not paypal.com.'),
      h('li', null, 'Everything before an @ sign is ignored: ', h('code', { text: 'google.com@evil.com' }), ' goes to evil.com.'),
      h('li', null, 'A padlock or https means the connection is encrypted, not that the owner is honest.'),
      h('li', null, 'When in doubt, type the company’s address yourself.'))]));
  }

  function phoneView(root_) {
    var inp = h('input', { id: 'ph', type: 'text', placeholder: 'A phone number, for example (876) 555-0142', inputmode: 'tel' }),
      mine = h('input', { id: 'mine', type: 'text', placeholder: 'Optional: your own number, to spot copycat (spoofed) numbers', inputmode: 'tel' }), out = h('div');
    function run() {
      var r = SW.phone.analyzePhone(inp.value, { mine: mine.value });
      ui.clear(out);
      if (r.empty) { out.appendChild(ui.notice('Enter a number first.', 'soft')); return; }
      out.appendChild(h('section', { class: 'card result' }, ui.meter(r.level), h('p', { class: 'lead', text: r.formatted || inp.value }), ui.flagList(r.flags), r.notes.map(function (n) { return h('p', { class: 'small', text: n }); })));
    }
    root_.appendChild(ui.card('Phone number hints', [
      h('p', { class: 'lead', text: 'Spot numbers that cannot be real, look American but are overseas, or copy yours. Scammers fake caller ID, so this gives hints, never proof.' }),
      h('div', { class: 'grid2' }, h('div', { class: 'field' }, h('label', { for: 'ph', text: 'Number' }), inp), h('div', { class: 'field' }, h('label', { for: 'mine', text: 'Your number (optional)' }), mine)),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: run }, 'Check number'))
    ]));
    root_.appendChild(out);
    root_.appendChild(ui.card('Report spoofed calls', [h('p', { text: 'You can report spoofing or robocalls to the FCC and add your number to the Do Not Call Registry. Copy the addresses into your browser:' }), ui.copyLine('fcc.gov/spoofing'), ui.copyLine('donotcall.gov')]));
  }

  function qrView(root_) {
    var ta = h('textarea', { id: 'qr', rows: 4, placeholder: 'Paste the text your phone shows after scanning the code (do not open it). For example https://example.com/pay' }), out = h('div');
    function run() {
      var r = SW.phone.analyzeQR(ta.value);
      ui.clear(out);
      if (r.empty) { out.appendChild(ui.notice('Paste the decoded text first.', 'soft')); return; }
      out.appendChild(h('section', { class: 'card result' }, ui.meter(r.level), h('p', { class: 'lead', text: 'The code contains: ' + ({ link: 'a web address', script: 'a script', wifi: 'Wi-Fi details', phone: 'a call or text', email: 'an email', crypto: 'a crypto payment', payment: 'a payment request', app: 'an app install link', contact: 'a contact card', text: 'plain text' }[r.kind] || r.kind) }),
        r.link ? linkPanel(r.link) : ui.flagList(r.flags), r.notes.map(function (n) { return h('p', { class: 'small', text: n }); })));
    }
    root_.appendChild(ui.card('QR code checker', [
      h('p', { class: 'lead', text: 'Most phone cameras show the web address before opening it. Read it there, then paste it here to check it. This tool never reads images and never opens anything.' }),
      h('label', { for: 'qr', class: 'sr-only', text: 'Decoded QR text' }), ta,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: run }, 'Check QR text'))
    ]));
    root_.appendChild(out);
  }

  /* ----- scored checklist (also used by the guides) ----- */
  var POSITIVE = { docs: true, idtheft: true };
  function checklist(g) {
    var saved = SW.store.get('chk:' + g.id, {}), prog = !!POSITIVE[g.id], res = h('div', { class: 'verdict', 'aria-live': 'polite' }), total = g.checks.reduce(function (s, c) { return s + c.w; }, 0);
    function update() {
      var score = 0, n = 0, level, text, cls;
      g.checks.forEach(function (c, i) { if (saved[i]) { score += c.w; n++; } });
      SW.store.set('chk:' + g.id, saved);
      if (prog) { cls = n / g.checks.length >= 0.8 ? 'low' : (n / g.checks.length >= 0.4 ? 'caution' : 'high'); text = g.verdicts[n / g.checks.length >= 0.8 ? 'high' : (n / g.checks.length >= 0.4 ? 'mid' : 'low')]; level = n + ' of ' + g.checks.length + ' done'; }
      else {
        var hi = g.cat === 'credit' ? 5 : 8, mid = g.cat === 'credit' ? 2 : 3;
        if (score >= hi) { cls = 'severe'; text = g.verdicts.high; level = 'Strong signs'; } else if (score >= mid) { cls = 'caution'; text = g.verdicts.mid; level = 'Some signs'; } else { cls = 'low'; text = g.verdicts.low; level = score ? 'A few signs' : 'Nothing ticked'; }
      }
      ui.clear(res); res.className = 'verdict lv-' + cls;
      res.appendChild(h('strong', { text: level })); res.appendChild(h('p', { text: text + (prog ? '' : ' This is a guide, not proof either way.') }));
    }
    return h('div', { class: 'checklist' }, g.checks.map(function (c, i) {
      var id = 'c-' + g.id + '-' + i;
      return h('div', { class: 'checkrow' }, h('input', { type: 'checkbox', id: id, checked: !!saved[i], onchange: function (e) { saved[i] = e.target.checked; update(); } }), h('label', { for: id, text: c.t }));
    }), res, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: function () { saved = {}; Array.prototype.forEach.call(root.document.querySelectorAll('.checklist input'), function (x) { x.checked = false; }); update(); } }, 'Reset')), (update(), null));
  }

  function listsView(root_, args) {
    var gs = SW.data.guides.filter(function (g) { return g.checks && g.cat === 'scams'; }), cur = args[0] && gs.filter(function (g) { return g.id === args[0]; })[0];
    if (cur) {
      root_.appendChild(h('p', null, h('a', { href: '#/check/lists', text: '← All checklists' })));
      root_.appendChild(ui.card(cur.title, [cur.blocks.map(function (b) { return h('p', { text: b.p || '' }); }), checklist(cur)]));
      return;
    }
    root_.appendChild(ui.card('Scam checklists', [h('p', { class: 'lead', text: 'Tick what you have seen to see how it compares. Each one is a guide, not a verdict.' }),
      h('div', { class: 'tiles' }, gs.map(function (g) { return h('a', { class: 'tile', href: '#/check/lists/' + g.id }, h('strong', { text: g.title }), h('span', { text: g.summary || '' })); }))]));
  }

  function checkView(main, args) {
    var tabsDef = [{ id: 'message', label: 'Message' }, { id: 'link', label: 'Link' }, { id: 'phone', label: 'Phone number' }, { id: 'qr', label: 'QR code' }, { id: 'patterns', label: 'Scam patterns' }, { id: 'lists', label: 'Checklists' }], t = args[0] || 'message';
    main.appendChild(h('h2', { text: 'Check something' }));
    main.appendChild(ui.tabs(tabsDef, t, 'check'));
    ({ message: messageView, link: linkView, phone: phoneView, qr: qrView, patterns: function (m, a) { SW.views.patterns(m, a); }, lists: listsView }[t] || messageView)(main, args.slice(1));
  }

  SW.views = SW.views || {};
  SW.views.checklist = checklist;
  SW.views.analysisCard = analysisCard;
  SW.views.linkPanel = linkPanel;
  ui.route('check', 'Check', checkView);
})(typeof window !== 'undefined' ? window : globalThis);
