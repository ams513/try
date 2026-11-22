/* Stark Warden: "If you were scammed", Family mode, Practice quiz. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, S = SW.store;

  /* ---------- If you were scammed ---------- */
  function stepsTab(main, args) {
    var cur = args[0] || 'giftcard', sc = SW.data.scammed.filter(function (x) { return x.id === cur; })[0] || SW.data.scammed[0], saved = S.get('scam:' + sc.id, {});
    main.appendChild(ui.card('First, breathe', [h('p', { class: 'lead', text: 'It happens to smart, careful people. Scammers are professionals. What matters now is speed, and the steps below. You are not alone, and it is not your fault.' }),
      h('ol', null, h('li', { text: 'Stop all contact and stop sending money, however convincing the reason.' }), h('li', { text: 'Call your bank, card company or the payment service right away.' }), h('li', { text: 'Pick what happened below and work down the list.' }), h('li', { text: 'Tell someone you trust.' }))]));
    main.appendChild(ui.card('What happened?', [h('div', { class: 'chips' }, SW.data.scammed.map(function (x) { return h('a', { class: 'chip' + (x.id === sc.id ? ' active' : ''), href: '#/scammed/steps/' + x.id, text: x.title }); }))]));
    var box = h('div', { class: 'checklist' });
    sc.steps.forEach(function (s, i) {
      var id = 'sc-' + sc.id + '-' + i;
      box.appendChild(h('div', { class: 'checkrow' }, h('input', { type: 'checkbox', id: id, checked: !!saved[i], onchange: function (e) { saved[i] = e.target.checked; S.set('scam:' + sc.id, saved); } }), h('label', { for: id }, h('strong', { text: s.t }), s.d ? h('span', { class: 'sub', text: s.d }) : null)));
    });
    main.appendChild(ui.card(sc.title, [box, ui.notice('No result is guaranteed. Banks and agencies decide what they can recover. Be wary of anyone who contacts you offering to get your money back for a fee.', 'soft')]));
  }

  function reportTab(main) {
    var f = ui.form(SW.data.reportFields, S.get('scamreport', {})), pre = h('pre', { class: 'doc' }), box = h('div', { class: 'card print-letter' });
    function text() {
      var v = f.read(), L = ['SCAM REPORT', 'Prepared: ' + ui.today(), ''];
      SW.data.reportFields.forEach(function (d) { var val = v[d.id] || ''; if (d.type === 'date') { val = val ? SW.letters.prettyDate(val) : ''; } if (d.type === 'money' && val) { var n = parseFloat(String(val).replace(/[$,\s]/g, '')); val = isFinite(n) ? SW.util.money(n) : val; } L.push(d.label + ':', '   ' + (val || '[not provided]'), ''); });
      L.push('This report was prepared with Stark Warden to help me report to the FTC (ReportFraud.ftc.gov), the FBI IC3 (ic3.gov), my bank and my state attorney general. It is general information, not legal advice.');
      return L.join('\n');
    }
    function upd() { pre.textContent = text(); S.set('scamreport', f.read()); }
    f.el.addEventListener('input', upd); f.el.addEventListener('change', upd);
    main.appendChild(ui.card('Printable report template', [h('p', { class: 'lead', text: 'Fill in what you know. Take this to your bank or police, and use it to answer the questions on ReportFraud.ftc.gov and IC3.gov.' }), f.el]));
    box.appendChild(h('h3', { text: 'Your report' })); box.appendChild(pre);
    box.appendChild(h('div', { class: 'row' }, ui.copyBtn(function () { return pre.textContent; }, 'Copy'), h('button', { type: 'button', class: 'btn small', onclick: function () { ui.saveText('scam-report.txt', pre.textContent); } }, 'Save as .txt'), h('button', { type: 'button', class: 'btn small', onclick: function () { ui.printEl(box); } }, 'Print')));
    main.appendChild(box); upd();
  }

  function whereTab(main) {
    var ids = ['ftc-report', 'ic3', 'ftc-id', 'naag', 'tigta', 'ssaoig', 'fcc', 'acr', 'dnc'], src = SW.data.sources.filter(function (s) { return ids.indexOf(s.id) >= 0; });
    main.appendChild(ui.card('Where to report (copy into your browser)', [h('p', { class: 'small', text: 'Stark Warden never opens these. Copy the address and paste it into your browser’s address bar.' }),
      src.map(function (s) { return h('div', { class: 'srcrow' }, h('strong', { text: s.org + ': ' + s.title }), ui.copyLine(s.url), s.note ? h('p', { class: 'small', text: s.note }) : null); }),
      h('h4', { text: 'By phone or text' }), SW.data.phoneSources.map(function (p) { return h('p', null, h('strong', { text: p.n }), ' ' + p.t); })]));
  }

  ui.route('scammed', 'If scammed', function (main, args) {
    var t = args[0] || 'steps', defs = [{ id: 'steps', label: 'What to do' }, { id: 'idplan', label: 'Identity theft plan' }, { id: 'report', label: 'Report template' }, { id: 'where', label: 'Where to report' }];
    main.appendChild(h('h2', { text: 'What to do if you were scammed' }));
    main.appendChild(ui.tabs(defs, t, 'scammed'));
    ({ steps: stepsTab, idplan: function (m) { SW.views.idplan(m); }, report: reportTab, where: whereTab }[t] || stepsTab)(main, args.slice(1));
  });

  /* ---------- Family mode ---------- */
  var BEFORE = ['Is someone rushing me or telling me I must act right now?', 'Did they ask for gift cards, crypto, a wire transfer, or an app payment?', 'Did they tell me to keep it secret or not to talk to family or my bank?',
    'Did they say they are from the government, my bank, or a tech company and contacted me first?', 'Do they want a code, a password, or access to my computer?'];

  function familyTools(main) {
    var wrap = h('div', { class: 'family' }), who = S.get('trusted', { name: '', phone: '' }), nm = h('input', { type: 'text', id: 'tp-n', placeholder: 'Name, for example my daughter Maria', value: who.name }), ph = h('input', { type: 'text', id: 'tp-p', placeholder: 'Phone number', value: who.phone, inputmode: 'tel' }),
      ta = h('textarea', { id: 'fm', rows: 6, placeholder: 'Paste the message here' }), out = h('div', { 'aria-live': 'polite' }), pay = h('div');
    function trusted() { var w = S.get('trusted', { name: '', phone: '' }); return w.name ? 'Call ' + w.name + (w.phone ? ' on ' + w.phone : '') + ' before you do anything.' : 'Call someone you trust before you do anything.'; }
    function check() {
      var r = SW.analyzer.analyze(ta.value, {}), box, cls, head, lines;
      ui.clear(out);
      if (!ta.value.trim()) { out.appendChild(h('p', { class: 'big', text: 'Paste a message first.' })); return; }
      if (r.level.rank >= 2) { cls = 'stop'; head = 'STOP. This looks like a scam.'; lines = ['Do not click anything. Do not call any number in it.', 'Do not pay or send money.', trusted()]; }
      else if (r.level.rank === 1) { cls = 'careful'; head = 'BE CAREFUL.'; lines = ['This has warning signs.', 'Do not click or pay yet.', trusted()]; }
      else { cls = 'ok'; head = 'No common warning signs found.'; lines = ['That does not mean it is safe.', 'If it asks for money, a code, or quick action, ask someone first.', trusted()]; }
      box = h('div', { class: 'verdict-big ' + cls }, h('h3', { text: head }), lines.map(function (l) { return h('p', { text: l }); }));
      if (r.flags.length) { box.appendChild(h('p', { class: 'big-sub', text: 'Why: ' + r.flags.slice(0, 3).map(function (f) { return f.title.toLowerCase(); }).join('; ') + '.' })); }
      out.appendChild(box);
    }
    function drawPay() {
      var yes = 0, res = h('div', { 'aria-live': 'polite' }), box = h('div');
      BEFORE.forEach(function (q, i) {
        var yb = h('button', { type: 'button', class: 'btn big', onclick: function () { mark(i, true); } }, 'Yes'), nb = h('button', { type: 'button', class: 'btn big', onclick: function () { mark(i, false); } }, 'No');
        box.appendChild(h('div', { class: 'qrow', 'data-i': String(i) }, h('p', { class: 'big', text: q }), h('div', { class: 'row' }, yb, nb)));
      });
      var answers = {};
      function mark(i, v) {
        answers[i] = v; yes = 0; Object.keys(answers).forEach(function (k) { if (answers[k]) { yes++; } });
        Array.prototype.forEach.call(box.querySelectorAll('.qrow'), function (r) { var k = r.getAttribute('data-i'); r.classList.toggle('yes', answers[k] === true); r.classList.toggle('no', answers[k] === false); });
        ui.clear(res);
        if (yes > 0) { res.appendChild(h('div', { class: 'verdict-big stop' }, h('h3', { text: 'STOP. Do not pay yet.' }), h('p', { text: trusted() }), h('p', { text: 'Any “yes” is a reason to slow down. Real banks and agencies do not mind if you check first.' }))); }
        else if (Object.keys(answers).length === BEFORE.length) { res.appendChild(h('div', { class: 'verdict-big ok' }, h('h3', { text: 'No warning answers.' }), h('p', { text: 'Still, if you are not sure, ask someone you trust before you pay.' }))); }
      }
      ui.clear(pay); pay.appendChild(box); pay.appendChild(res);
    }
    wrap.appendChild(h('p', { class: 'big', text: 'Big, simple tools for checking a message and for the moment before you pay. Set up the trusted person here first.' }));
    wrap.appendChild(ui.card('My trusted person', [h('p', { class: 'big', text: 'Someone to call before paying. Ask a relative to set this up with you.' }), h('div', { class: 'field' }, h('label', { for: 'tp-n', text: 'Name' }), nm), h('div', { class: 'field' }, h('label', { for: 'tp-p', text: 'Phone' }), ph),
      h('button', { type: 'button', class: 'btn big primary', onclick: function () { S.set('trusted', { name: nm.value.trim(), phone: ph.value.trim() }); ui.toast('Saved.'); } }, 'Save')]));
    wrap.appendChild(ui.card('Check a message', [h('label', { for: 'fm', class: 'big', text: 'Paste a text, email or message:' }), ta, h('button', { type: 'button', class: 'btn big primary', onclick: check }, 'Is this a scam?'), out]));
    wrap.appendChild(ui.card('Before you pay anyone', [h('p', { class: 'big', text: 'Answer these five questions, every time.' }), pay]));
    wrap.appendChild(ui.notice('This tool looks for common warning signs. It can never tell you that something is safe. When in doubt, call someone you trust.', 'legal'));
    main.appendChild(wrap);
    drawPay();
  }
  ui.route('family', 'Family', function (main, args) {
    var es = SW.i18n.lang() === 'es', t = args[0] || 'simple',
      defs = [{ id: 'simple', label: es ? 'Pantalla sencilla' : 'Simple screen' }, { id: 'tools', label: es ? 'Revisar y configurar' : 'Check and set up' }, { id: 'card', label: es ? 'Tarjeta de confianza' : 'Trusted person card' }, { id: 'fridge', label: es ? 'Tarjetas para el refrigerador' : 'Fridge cards' }],
      views = { simple: SW.views.familySimple, tools: familyTools, card: SW.views.trustedCard, fridge: SW.views.fridgeCards };
    if (!views[t]) { t = 'simple'; }
    if (t !== 'tools') { ui.esReady(); }
    main.appendChild(h('h2', { text: es ? 'Modo familiar' : 'Family mode' }));
    main.appendChild(ui.tabs(defs, t, 'family'));
    views[t](main);
  });

  /* ---------- Quiz ---------- */
  function shuffle(a) { var r = a.slice(), i, j, t; for (i = r.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = r[i]; r[i] = r[j]; r[j] = t; } return r; }
  ui.route('quiz', null, function (main) {
    var order = shuffle(SW.data.quiz), i = 0, score = 0, box = h('div'), best = S.get('quizbest', 0);
    function show() {
      var q, bubble, fb = h('div', { 'aria-live': 'polite' }), done = false;
      ui.clear(box);
      if (i >= order.length) {
        if (score > best) { best = score; S.set('quizbest', best); }
        box.appendChild(ui.card('Quiz finished', [h('p', { class: 'lead', text: 'You got ' + score + ' of ' + order.length + ' right. Best so far: ' + best + '.' }), h('p', { text: score >= order.length - 2 ? 'Sharp eyes. The habit that matters most: when anything asks for money, codes or speed, verify another way.' : 'These are hard on purpose. The habit that matters most: when anything asks for money, codes or speed, verify another way.' }),
          h('button', { type: 'button', class: 'btn primary', onclick: function () { order = shuffle(SW.data.quiz); i = 0; score = 0; show(); } }, 'Play again')]));
        return;
      }
      q = order[i];
      function answer(said) {
        var right = said === q.scam, res;
        if (done) { return; } done = true; if (right) { score++; }
        res = SW.analyzer.analyze(q.text, {});
        fb.appendChild(h('div', { class: 'verdict ' + (right ? 'lv-low' : 'lv-high') }, h('strong', { text: right ? 'Right.' : 'Not quite.' }), h('p', { text: 'This one is ' + (q.scam ? 'a scam' : 'ordinary') + '. ' + q.why }),
          q.tells.length ? h('p', { class: 'small', text: 'Clues: ' + q.tells.join(', ') + '.' }) : null, h('p', { class: 'small', text: 'The checker’s view: ' + res.level.label + (res.flags.length ? ' (' + res.flags.slice(0, 3).map(function (f) { return f.title; }).join('; ') + ')' : '') + '.' }),
          h('button', { type: 'button', class: 'btn primary', onclick: function () { i++; show(); } }, i + 1 >= order.length ? 'See my score' : 'Next message')));
        Array.prototype.forEach.call(box.querySelectorAll('.answer'), function (b) { b.disabled = true; });
      }
      bubble = h('blockquote', { class: 'bubble', text: q.text });
      box.appendChild(ui.card('Message ' + (i + 1) + ' of ' + order.length, [h('p', { class: 'small', text: 'Score so far: ' + score }), bubble, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn answer big', onclick: function () { answer(true); } }, 'Scam'), h('button', { type: 'button', class: 'btn answer big', onclick: function () { answer(false); } }, 'Looks legitimate')), fb]));
    }
    main.appendChild(h('h2', { text: 'Practice: spot the scam' }));
    main.appendChild(h('p', { class: 'lead', text: 'Real-style messages, with made-up names and numbers. Decide, then see the clues.' }));
    main.appendChild(box); show();
  });
})(typeof window !== 'undefined' ? window : globalThis);
