/* Stark Warden 2.0: the calm screens. Welcome, "I'm being pressured right now", your rights in 60 seconds, wins, next steps,
   and the family simple screen, trusted-person card and fridge cards. English and Spanish (machine translation pending review). */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, S = SW.store, T = SW.i18n.t;
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function es() { return SW.i18n.lang() === 'es'; }
  function asOf() { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(SW.data.meta.asOf); return es() && m ? (+m[3]) + ' de ' + MES[+m[2] - 1] + ' de ' + m[1] : SW.data.meta.asOfLabel; }
  function trusted() { return S.get('trusted', { name: '', phone: '' }); }
  function srcLine(f) { return h('p', { class: 'src' }, h('span', { class: 'src-k', text: T('r60Src') + ': ' }), f.cite + ' · ' + T('r60AsOf') + ' ' + asOf()); }

  function winState() {
    var tr = trusted();
    return { profile: S.get('dprofile', {}), log: S.get('log', []), mail: S.get('mail', []), simBest: S.get('sim:best', {}), trusted: !!(tr && tr.name),
      checks: S.get('stat:checks', 0) || 0, limitChecked: !!S.get('stat:limit', false), interview: !!S.get('interviewOut', null), seenRights: !!S.get('stat:rights60', false),
      verified: !!S.get('stat:verify', false), packet: !!S.get('stat:packet', false), complaint: !!S.get('stat:complaint', false), inWriting: !!S.get('stat:inwriting', false),
      budget: S.get('budget:income', []).length > 0, manual: S.get('wins', []) };
  }

  /* ---------- your rights in 60 seconds ---------- */
  function rightsCard(full) {
    var lg = SW.i18n.lang(), facts = full ? SW.data.rights60 : SW.data.rights60.slice(0, 3), box;
    box = h('section', { class: 'card r60' + (full ? ' print-letter' : ''), 'aria-labelledby': 'r60h' },
      h('div', { class: 'r60-head' }, h('h2', { id: 'r60h', text: T('r60Title') }), h('span', { class: 'clock', 'aria-hidden': 'true', text: '60s' })),
      h('p', { class: 'small', text: T('r60Lead') }),
      full ? h('p', { class: 'who', text: T('r60Who') }) : null,
      h('ol', { class: 'r60-list' }, facts.map(function (f) { return h('li', null, h('p', { class: 'r60-t', text: f[lg] || f.en }), srcLine(f)); })));
    if (full) {
      box.appendChild(h('p', { class: 'notice legal', text: T('notLegal') + ' ' + (es() ? 'Verifique la fecha.' : 'Check the date: rules change.') }));
      box.appendChild(h('div', { class: 'row noprint' }, h('button', { type: 'button', class: 'btn', onclick: function () { ui.printEl(box); } }, T('r60Print')),
        ui.copyBtn(function () { return T('r60Title') + '\n\n' + SW.data.rights60.map(function (f, i) { return (i + 1) + '. ' + (f[lg] || f.en) + '\n   ' + T('r60Src') + ': ' + f.cite + ' (' + T('r60AsOf') + ' ' + asOf() + ')'; }).join('\n') + '\n\n' + T('notLegal'); }, T('r60Copy'))));
    } else {
      box.appendChild(h('a', { class: 'btn', href: '#/rights60', text: T('r60All') + ' →' }));
    }
    return box;
  }
  ui.route('rights60', null, function (main) {
    ui.esReady(); S.set('stat:rights60', true);
    main.appendChild(ui.mtBanner());
    main.appendChild(rightsCard(true));
    main.appendChild(ui.card(es() ? 'Lea las reglas usted mismo' : 'Read the rules yourself', [h('p', { class: 'small', text: es() ? 'Copie estas direcciones en su navegador. Warden nunca las abre.' : 'Copy these addresses into your browser. Warden never opens them.' }),
      SW.data.sources.filter(function (s) { return ['fdcpa', 'regf', 'ftc-scams', 'cfpb-debt'].indexOf(s.id) >= 0; }).map(function (s) { return h('div', { class: 'srcrow' }, h('strong', { text: s.org + ': ' + s.title }), ui.copyLine(s.url)); })]));
  });

  /* ---------- welcome ---------- */
  ui.route('home', 'Home', function (main) {
    var w = SW.wins.compute(winState(), ui.today()), more;
    ui.esReady();
    main.appendChild(ui.mtBanner());
    main.appendChild(ui.usNote(false));
    main.appendChild(h('section', { class: 'hero2' }, h('h1', null, h('span', { class: 'l1', text: T('hero1') }), ' ', h('span', { class: 'l2', text: T('hero2') }), ' ', h('span', { class: 'l3', text: T('hero3') })),
      h('p', { class: 'lead', text: T('heroLead') })));
    main.appendChild(h('a', { class: 'pressbig', href: '#/now' }, h('span', { class: 'pulse', 'aria-hidden': 'true' }), h('span', { class: 'pb-text' }, h('strong', { text: T('pressBtn') }), h('span', { text: T('pressSub') }))));
    if (w.total) { main.appendChild(h('a', { class: 'winsline', href: '#/wins' }, h('span', { class: 'tk', 'aria-hidden': 'true', text: '✓' }), T('winsLine', null, { n: w.total }) + ' →')); }
    main.appendChild(h('h2', { class: 'sect', text: T('whatTitle') }));
    main.appendChild(h('div', { class: 'tiles big choices' }, T('choices').map(function (c) { return h('a', { class: 'tile', href: c[0] }, h('strong', { text: c[1] }), h('span', { text: c[2] })); })));
    main.appendChild(h('p', { class: 'dignity', text: T('dignity') }));
    main.appendChild(rightsCard(false));
    main.appendChild(ui.card('Warden power tools', [h('div', { class: 'tiles' }, [['#/call', 'Live call copilot', 'Type or tap what they say. See the calm, lawful reply and save the call to your log in one tap.'], ['#/seal', 'Evidence seal', 'Chain your log with SHA-256 so any later change shows.'],
      ['#/circle', 'Trusted circle', 'Split a passphrase into share codes. Any few rebuild it.']].map(function (c) { return h('a', { class: 'tile', href: c[0] }, h('strong', { text: c[1] }), h('span', { text: c[2] })); })),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { SW.views.openPalette(); } }, 'Search or ask a question (Ctrl K)'))]));
    more = [['#/debt/verify', 'Is this even real?'], ['#/debt/timeline', 'Evidence timeline'], ['#/debt/negotiate', 'Negotiation coach'], ['#/debt/medical', 'Medical bills'], ['#/debt/sued', 'If you are sued'], ['#/debt/limits', 'Time limits'],
      ['#/check/patterns', 'Scam patterns'], ['#/scammed/idplan', 'Identity theft plan'], ['#/debt/letters', 'Letters'], ['#/quiz', 'Practice quiz'], ['#/life/budget', 'Budget'], ['#/life/vault', 'Encrypted vault']];
    main.appendChild(ui.card(T('moreTitle'), [h('div', { class: 'chips' }, more.map(function (c) { return h('a', { class: 'chip', href: c[0], text: c[1] }); })), es() ? h('p', { class: 'small', lang: 'es', text: T('onlyEn') }) : null]));
    main.appendChild(ui.card(T('limitsTitle'), [h('p', { text: T('limits') }), h('p', { class: 'small', text: SW.data.meta.notLegal })], 'limits'));
  });

  /* ---------- I'm being pressured right now ---------- */
  function breather() {
    var orb = h('div', { class: 'orb', 'aria-hidden': 'true' }), label = h('p', { class: 'breath-label', 'aria-live': 'polite', text: T('breatheStart') }), running = false, timer = null, btn,
      phases = [['in', 'breatheIn', 4], ['hold', 'breatheHold', 4], ['out', 'breatheOut', 6]], pi = 0, left = 0;
    function tick() {
      if (!orb.isConnected || !running) { clearTimeout(timer); return; }
      if (left <= 0) { pi = (pi + 1) % phases.length; left = phases[pi][2]; orb.className = 'orb ' + phases[pi][0]; }
      label.textContent = T(phases[pi][1]) + ' · ' + left;
      left--;
      timer = setTimeout(tick, 1000);
    }
    function start() { running = true; pi = -1; left = 0; btn.textContent = T('breatheStop'); tick(); }
    function stop() { running = false; clearTimeout(timer); orb.className = 'orb'; label.textContent = T('breatheStart'); btn.textContent = T('breatheStart'); }
    btn = h('button', { type: 'button', class: 'btn', onclick: function () { if (running) { stop(); } else { start(); } } }, T('breatheStart'));
    setTimeout(function () { if (orb.isConnected && !running) { start(); } }, 400);
    return h('div', { class: 'breathe' }, h('div', { class: 'orb-wrap' }, orb), h('div', null, label, btn));
  }
  ui.route('now', null, function (main) {
    var tp = trusted(), wrap = h('div', { class: 'now' });
    ui.esReady();
    wrap.appendChild(ui.mtBanner());
    wrap.appendChild(h('div', { class: 'now-top' }, h('div', null, h('h1', { text: T('nowTitle') }), h('p', { class: 'lead', text: T('nowLead') })), breather()));
    wrap.appendChild(h('div', { class: 'grid2 sd' },
      h('section', { class: 'card say' }, h('h2', { text: T('sayTitle') }), h('ol', { class: 'saylist' }, T('say').map(function (x) { return h('li', null, h('span', { class: 'q', text: '“' + x + '”' })); }))),
      h('section', { class: 'card dont' }, h('h2', { text: T('dontTitle') }), h('ul', { class: 'dontlist' }, T('dont').map(function (x) { return h('li', { text: x }); })))));
    wrap.appendChild(h('section', { class: 'card endcall' }, h('h2', { text: T('endTitle') }), h('p', { class: 'script', text: T('endScript') }), h('p', { class: 'big-sub', text: T('endAfter') }), h('p', { text: T('scamLine') }),
      h('div', { class: 'row' }, ui.copyBtn(T('endScript').replace(/[“”]/g, ''), es() ? 'Copiar el guion' : 'Copy the script'))));
    wrap.appendChild(h('section', { class: 'card after' }, h('h2', { text: T('afterTitle') }),
      tp.name ? h('p', { class: 'callperson' }, h('strong', { text: T('callLine', null, { name: tp.name }) }), tp.phone ? ' · ' + tp.phone : '') : h('p', { class: 'small' }, T('noPerson') + ' ', h('a', { href: '#/family/tools', text: es() ? 'Modo familiar' : 'Family mode' })),
      h('div', { class: 'row bigbtns' }, h('a', { class: 'btn primary', href: '#/debt/log', text: T('afterLog') }), h('a', { class: 'btn', href: '#/debt/verify', text: T('afterVerify') }), h('a', { class: 'btn', href: '#/rights60', text: T('afterRights') }), h('a', { class: 'btn', href: '#/practice', text: T('afterPractice') }))));
    wrap.appendChild(h('p', { class: 'small', text: T('notLegal') }));
    main.appendChild(wrap);
  });

  /* ---------- wins ---------- */
  var STAGES = [['understand', 'Understand', 'You know what is happening and what your rights are.'], ['protect', 'Protect', 'You slowed down and guarded your money and numbers.'],
    ['pushback', 'Push back', 'You put it in writing and built a record.'], ['rebuild', 'Rebuild', 'You are making a plan for what comes next.']];
  var NEXT = [['story', '#/fight', 'Tell Warden what happened (5 minutes)'], ['rights', '#/rights60', 'Read your rights in 60 seconds'], ['practice', '#/practice', 'Practice a collector call'], ['trusted', '#/family/tools', 'Choose a trusted person'],
    ['verify', '#/debt/verify', 'Check if a collector is real'], ['log', '#/debt/log', 'Log your first contact'], ['dispute', '#/debt/letters/validation', 'Send a dispute letter'], ['limit', '#/debt/limits', 'Check the time limit on an old debt'],
    ['packet', '#/debt/timeline', 'Build your evidence packet'], ['budget', '#/life/budget', 'Start a budget']];
  ui.route('wins', 'My wins', function (main) {
    var r = SW.wins.compute(winState(), ui.today()), done = {}, manual = S.get('wins', []), f;
    r.wins.forEach(function (w) { done[w.id] = true; });
    main.appendChild(h('section', { class: 'hero2 small-hero' }, h('h1', { text: r.total ? 'Look how far you have come.' : 'Your first win can be small.' }),
      h('p', { class: 'lead', text: r.total ? 'Every step here is one you took. That counts.' : 'Wins show up here by themselves as you use Warden: a letter sent, a call logged, a practice round. Pick one easy step below.' })));
    main.appendChild(h('ol', { class: 'path', 'aria-label': 'Your path' }, STAGES.map(function (s) {
      var n = r.stages[s[0]] || 0;
      return h('li', { class: n ? 'lit' : '' }, h('span', { class: 'dot', 'aria-hidden': 'true', text: n ? '✓' : '' }), h('strong', { text: s[1] }), h('span', { class: 'small', text: n ? n + (n === 1 ? ' win' : ' wins') : s[2] }));
    })));
    if (r.total >= 3) { main.appendChild(ui.notice('You are not where you started. Keep going, one step at a time.', 'soft')); }
    if (r.total) {
      main.appendChild(h('div', { class: 'wingrid' }, r.wins.map(function (w, i) {
        var mi = w.id.indexOf('m-') === 0 ? i - (r.wins.length - manual.length) : -1;
        return h('div', { class: 'win st-' + w.stage }, h('span', { class: 'check', 'aria-hidden': 'true', text: '✓' }), h('div', null, h('strong', { text: w.title }), w.detail ? h('p', { class: 'small', text: w.detail }) : null, w.date ? h('p', { class: 'small', text: SW.letters.prettyDate(w.date) }) : null,
          mi >= 0 ? h('button', { type: 'button', class: 'btn small danger', onclick: function () { manual.splice(mi, 1); S.set('wins', manual); SW.ui.renderRoute(); } }, 'Remove') : null));
      })));
    }
    var todo = NEXT.filter(function (n) { return !done[n[0]]; }).slice(0, 5);
    if (todo.length) { main.appendChild(ui.card('Good next steps', [h('div', { class: 'tiles' }, todo.map(function (n) { return h('a', { class: 'tile', href: n[1] }, h('strong', { text: n[2] })); }))])); }
    f = ui.form([{ id: 'title', label: 'Add your own win', ph: 'For example: the calls stopped, or I got the deal in writing', wide: true }, { id: 'date', label: 'Date', type: 'date' },
      { id: 'stage', label: 'Kind of win', type: 'select', options: STAGES.map(function (s) { return { v: s[0], l: s[1] }; }) }], { stage: 'rebuild', date: ui.today() });
    main.appendChild(ui.card('Something good happened?', [h('p', { class: 'small', text: 'A debt validated or removed, a settlement in writing, a day without calls. Write it down. It stays on this device.' }), f.el,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { var v = f.read(); if (!v.title.trim()) { ui.toast('Write the win first.'); return; } manual.push({ id: ui.uid(), title: v.title.trim(), date: v.date, stage: v.stage }); S.set('wins', manual); ui.toast('Added. Well done.'); SW.ui.renderRoute(); } }, 'Add my win'))]));
    main.appendChild(h('p', { class: 'small', text: 'Wins come from what you saved on this device. They are a record of your effort, not a legal result.' }));
  });

  /* ---------- next steps (hope) ---------- */
  function dirList(list) { return list.map(function (d) { return h('div', { class: 'srcrow' }, h('strong', { text: d.n }), h('p', { class: 'small', text: d.d }), /\.(?:gov|org|com)\b/.test(d.w) ? ui.copyLine(d.w) : h('p', { text: d.w })); }); }
  ui.route('hope', 'Next steps', function (main) {
    var H = SW.data.helpDirs, steps = [
      ['See where your money goes', 'List your income and bills. Most people find at least one surprise.', '#/life/budget', 'Open the budget'],
      ['Protect the essentials first', 'Housing, utilities, food, the ride to work, insurance, child support and taxes come before old collection accounts.', '#/debt/plan', 'Which debts first?'],
      ['Build a small cushion', 'Even $500 can keep one surprise from becoming a new debt.', '#/life/emergency', 'Emergency fund planner'],
      ['Pick a payoff order you will keep', 'Snowball (smallest first) or avalanche (highest rate first). The best plan is the one you stick to.', '#/debt/plan', 'Compare the two'],
      ['Ask for hardship help', 'Many creditors have hardship programs. Asking in writing creates a record.', '#/debt/letters/hardship', 'Hardship letter'],
      ['Settle only in writing', 'Know your number, make an offer, and get the deal on paper before you pay.', '#/debt/negotiate', 'Negotiation coach']];
    main.appendChild(h('section', { class: 'hero2 small-hero' }, h('h1', { text: 'Getting back on your feet' }), h('p', { class: 'lead', text: 'One step at a time. You do not have to fix everything this week.' })));
    main.appendChild(h('ol', { class: 'stepcards' }, steps.map(function (s) { return h('li', { class: 'card' }, h('h3', { text: s[0] }), h('p', { text: s[1] }), h('a', { class: 'btn small', href: s[2], text: s[3] })); })));
    main.appendChild(ui.card('If you run your own business', [h('p', { text: 'Stark Ledger, another offline app from Stark, keeps simple books and invoices for freelancers and small shops. It is a separate product; Warden works fine without it.' })]));
    main.appendChild(ui.card('Free legal help', [h('p', { class: 'small', text: 'Addresses are text to copy into your browser. Warden never opens them.' }), dirList(H.legal)]));
    main.appendChild(ui.card('Nonprofit credit counseling', [dirList(H.counsel), h('h4', { text: 'Questions to ask first' }), h('ul', null, H.ask.map(function (x) { return h('li', { text: x }); }))]));
    main.appendChild(ui.card('Help with bills', [dirList(H.bills)]));
    main.appendChild(h('section', { class: 'card care' }, h('p', { text: H.care })));
    main.appendChild(h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/wins', text: 'See my wins' }), h('a', { class: 'btn', href: '#/fight', text: 'Fight back: answer a few questions' })));
    main.appendChild(ui.disclaimerBar());
  });

  /* ---------- family: simple screen, trusted card, fridge cards ---------- */
  function askWho() { var w = trusted(); return T('askFirst', null, { who: w.name ? w.name + (w.phone ? ' (' + w.phone + ')' : '') : T('someone') }); }
  SW.views = SW.views || {};
  SW.views.winState = winState;
  SW.views.familySimple = function (main) {
    var out = h('div', { class: 'simple-out', 'aria-live': 'polite' }), wrap = h('div', { class: 'family simple' });
    function show(kind) {
      var tp = trusted(), ta, res;
      ui.clear(out);
      if (kind === 'money') { out.appendChild(h('div', { class: 'verdict-big stop' }, h('h3', { text: T('moneyHead') }), T('moneyLines').map(function (l) { return h('p', { text: l }); }), h('p', { class: 'big-sub', text: askWho() }))); }
      if (kind === 'call') {
        out.appendChild(tp.name ? h('div', { class: 'verdict-big ok callcard' }, h('h3', { text: T('callHead') }), h('p', { class: 'huge', text: tp.name }), tp.phone ? h('p', { class: 'huge num', text: tp.phone }) : null)
          : h('div', { class: 'verdict-big careful' }, h('p', { text: T('noPerson') }), h('a', { class: 'btn big', href: '#/family/tools', text: es() ? 'Configurar' : 'Set up' })));
      }
      if (kind === 'msg') {
        ta = h('textarea', { id: 'fs-msg', rows: 5, placeholder: T('msgPrompt') }); res = h('div');
        out.appendChild(h('div', { class: 'card' }, h('label', { for: 'fs-msg', class: 'big', text: T('msgPrompt') }), ta, h('button', { type: 'button', class: 'btn big primary', onclick: function () {
          var r = SW.analyzer.analyze(ta.value, {}), k = r.level.rank >= 2 ? 'stop' : (r.level.rank === 1 ? 'careful' : 'ok');
          ui.clear(res);
          if (!ta.value.trim()) { return; }
          res.appendChild(h('div', { class: 'verdict-big ' + k }, h('h3', { text: T(k + 'Head') }), T(k + 'Lines').map(function (l) { return h('p', { text: l }); }), h('p', { class: 'big-sub', text: askWho() })));
        } }, T('msgBtn')), res));
      }
    }
    wrap.appendChild(ui.mtBanner());
    wrap.appendChild(h('p', { class: 'big', text: T('simpleLead') }));
    wrap.appendChild(h('div', { class: 'bigchoices' },
      h('button', { type: 'button', class: 'bigchoice stop', onclick: function () { show('money'); } }, h('span', { class: 'ic', 'aria-hidden': 'true', text: '!' }), T('bMoney')),
      h('button', { type: 'button', class: 'bigchoice', onclick: function () { show('msg'); } }, h('span', { class: 'ic', 'aria-hidden': 'true', text: '?' }), T('bMsg')),
      h('button', { type: 'button', class: 'bigchoice ok', onclick: function () { show('call'); } }, h('span', { class: 'ic', 'aria-hidden': 'true', text: '☎' }), T('bCall'))));
    wrap.appendChild(out);
    wrap.appendChild(h('p', { class: 'small', text: T('notLegal') }));
    main.appendChild(wrap);
  };
  function cardFill(s) { var tp = trusted(); return s.replace('{name}', tp.name || '______________').replace('{phone}', tp.phone || '______________'); }
  SW.views.trustedCard = function (main) {
    var tp = trusted(), box = h('div', { class: 'print-letter tcard-wrap' }, h('div', { class: 'tcard' }, h('p', { class: 'tc-title', text: T('cardTitle') }), h('p', { class: 'tc-name', text: tp.name || '______________________' }), h('p', { class: 'tc-phone', text: tp.phone || '______________________' }),
      h('p', { class: 'tc-code', text: T('cardCode') }), h('p', { class: 'tc-foot', text: T('cardFoot') })));
    main.appendChild(ui.mtBanner());
    main.appendChild(h('p', { class: 'lead', text: es() ? 'Una tarjeta para la cartera o junto al teléfono. La palabra clave se escribe a mano: nunca se guarda en este dispositivo.' : 'A card for a wallet or next to the phone. Write the code word by hand: it is never saved on this device.' }));
    if (!tp.name) { main.appendChild(h('p', null, h('a', { class: 'btn', href: '#/family/tools', text: es() ? 'Agregar una persona de confianza' : 'Add a trusted person first' }))); }
    main.appendChild(box);
    main.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { ui.printEl(box); } }, T('printBtn'))));
  };
  SW.views.fridgeCards = function (main) {
    var cards = SW.data.fridge[SW.i18n.lang()] || SW.data.fridge.en, box = h('div', { class: 'print-letter fridge' }, cards.map(function (c, i) {
      return h('div', { class: 'fcard f' + i }, h('p', { class: 'fc-title', text: c.t }), c.l.map(function (l) { return h('p', { text: cardFill(l) }); }), h('p', { class: 'fc-foot', text: 'Stark Warden' }));
    }));
    main.appendChild(ui.mtBanner());
    main.appendChild(h('p', { class: 'lead', text: T('cardsLead') }));
    main.appendChild(box);
    main.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { ui.printEl(box); } }, T('printBtn'))));
  };
})(typeof window !== 'undefined' ? window : globalThis);
