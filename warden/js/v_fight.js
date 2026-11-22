/* Stark Warden 2.0: fight back, legally. The "what happened?" interview that fills the letters and complaint drafts,
   the "Is this even real?" verifier, and the violation timeline with a calls-per-week chart and printable evidence packet. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, sv = ui.sv, S = SW.store, TABS = SW.debtTabs;
  var STATE_OPTS = [{ v: '', l: 'Choose a state' }].concat(Object.keys(SW.data.sol.states).sort().map(function (k) { return { v: k, l: SW.data.sol.states[k].name }; }));
  function merge(key, vals) { var cur = S.get(key, {}), k; for (k in vals) { if (vals[k] !== '' && vals[k] != null) { cur[k] = vals[k]; } } S.set(key, cur); return cur; }

  /* ---------- Fight back: guided interview ---------- */
  function choiceRow(name, opts, cur, onPick) {
    return h('div', { class: 'bigchoices row3', role: 'radiogroup', 'aria-label': name }, opts.map(function (o) {
      return h('button', { type: 'button', class: 'bigchoice' + (cur === o[0] ? ' on' : ''), role: 'radio', 'aria-checked': cur === o[0] ? 'true' : 'false', onclick: function () { onPick(o[0]); } }, o[1]);
    }));
  }
  ui.route('fight', 'Fight back', function (main) {
    var a = S.get('interview', null) || {}, prof = S.get('dprofile', {}), step = 0, box = h('div'), STEPS;
    a.conduct = a.conduct || {}; a.wants = a.wants || { validate: true };
    if (!a.name && prof.name) { a.name = prof.name; } if (!a.address && prof.address) { a.address = prof.address; } if (!a.state && prof.state) { a.state = prof.state; }
    function save() { S.set('interview', a); }
    function fields(defs) { var f = ui.form(defs, a); f.el.addEventListener('input', function () { Object.assign(a, f.read()); save(); }); f.el.addEventListener('change', function () { Object.assign(a, f.read()); save(); }); return f.el; }
    function ticks(list, key) {
      return h('div', { class: 'tickgrid' }, list.map(function (x) {
        var id = 'iv-' + key + '-' + x.id;
        return h('label', { class: 'tick' + (a[key][x.id] ? ' on' : ''), for: id }, h('input', { type: 'checkbox', id: id, checked: !!a[key][x.id], onchange: function (e) { a[key][x.id] = e.target.checked; e.target.parentNode.classList.toggle('on', e.target.checked); save(); } }), h('span', { text: x.label }));
      }));
    }
    STEPS = [
      ['Who is contacting you?', 'Write the name they gave. If you do not know something, skip it.', function () { return fields([{ id: 'collectorName', label: 'Company name' }, { id: 'phone', label: 'Phone number they use' }, { id: 'collectorAddress', label: 'Their mailing address, if you have it', type: 'textarea', rows: 2 }]); }],
      ['What do they say you owe?', 'Copy it from a letter, or write what they said.', function () { return fields([{ id: 'amount', label: 'Amount they claim', type: 'money' }, { id: 'creditor', label: 'Who they say you owed first (original creditor)' }, { id: 'accountRef', label: 'Account or reference number' }]); }],
      ['Do you recognize this debt?', 'There is no wrong answer. Not being sure is common, especially with old or sold debts.', function () { return choiceRow('Do you recognize this debt', [['yes', 'Yes, it is mine'], ['unsure', 'I am not sure'], ['no', 'No, it is not mine']], a.recognize, function (v) { a.recognize = v; save(); draw(); }); }],
      ['Did you get a letter from them?', 'A debt collector must send a written notice (a “validation notice”) in the first contact or within 5 days.', function () {
        return h('div', null, choiceRow('Did you get a written notice', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']], a.notice, function (v) { a.notice = v; save(); draw(); }),
          fields([{ id: 'firstContact', label: 'Date they first contacted you', type: 'date' }].concat(a.notice === 'yes' ? [{ id: 'noticeDate', label: 'Date on their notice', type: 'date' }] : [])));
      }],
      ['What have they done?', 'Tick anything that happened. These can be violations, and they go into your complaint draft.', function () { return h('div', null, ticks(SW.interview.CONDUCT, 'conduct'), fields([{ id: 'details', label: 'Anything else, in your own words (optional)', type: 'textarea', rows: 3, wide: true }])); }],
      ['What do you want to happen?', 'Pick as many as you like. You can change your mind later.', function () {
        return ticks([{ id: 'validate', label: 'Make them prove it (dispute letter)' }, { id: 'stop', label: 'Make them stop contacting me' }, { id: 'limit', label: 'Limit how and when they contact me' },
          { id: 'report', label: 'Report them to regulators' }, { id: 'lawyer', label: 'Talk to a lawyer about it' }], 'wants');
      }],
      ['About you, for the letters', 'This stays on this device. It fills the “from” part of your letters.', function () { return fields([{ id: 'name', label: 'Your full name' }, { id: 'address', label: 'Your mailing address', type: 'textarea', rows: 2 }, { id: 'state', label: 'Your state', type: 'select', options: STATE_OPTS }]); }]
    ];
    function result() {
      var r = SW.interview.build(a, ui.today());
      merge('dprofile', r.profile);
      merge('letter:validation', r.letters.validation); merge('letter:cease', r.letters.cease); merge('letter:limit', r.letters.limit);
      S.set('interviewOut', { story: r.story, issues: r.issues, date: ui.today() });
      ui.clear(box);
      box.appendChild(h('section', { class: 'hero2 small-hero' }, h('h1', { text: 'Here is your plan.' }), h('p', { class: 'lead', text: 'You do not have to do it all today. Start at the top. Your letters and complaint draft are already filled in from your answers.' })));
      if (r.scammy) { box.appendChild(ui.notice('Some of what you described is common in scams. Do not pay or share any numbers until you have checked.', 'warn')); }
      box.appendChild(h('ol', { class: 'plan' }, r.plan.map(function (p) { return h('li', { class: 'card' + (p.urgent ? ' urgent' : '') }, h('div', null, h('h3', { text: p.title }), h('p', { text: p.why })), h('a', { class: 'btn primary', href: p.href, text: 'Open' })); })));
      box.appendChild(ui.card('What happened, in plain words', [h('p', { class: 'small', text: 'This goes into your complaint draft under “In my own words.” Edit it there if you like.' }), h('blockquote', { class: 'story', text: r.story }), ui.copyBtn(r.story, 'Copy'),
        r.issues.length ? h('div', null, h('h4', { text: 'Rules that may have been broken' }), h('ul', null, r.issues.map(function (x) { return h('li', null, x.title + ' ', h('span', { class: 'small', text: '(' + x.cite + ')' })); }))) : null]));
      box.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { step = 0; draw(); } }, 'Change my answers'), h('button', { type: 'button', class: 'btn danger', onclick: function () { S.del('interview'); a = { conduct: {}, wants: { validate: true } }; step = 0; draw(); } }, 'Start over')));
      box.appendChild(ui.disclaimerBar());
      root.scrollTo(0, 0);
    }
    function draw() {
      var s = STEPS[step];
      ui.clear(box);
      if (!s) { result(); return; }
      box.appendChild(h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(STEPS.length), 'aria-valuenow': String(step + 1), 'aria-label': 'Question ' + (step + 1) + ' of ' + STEPS.length },
        STEPS.map(function (x, i) { return h('span', { class: i <= step ? 'on' : '' }); })));
      box.appendChild(h('section', { class: 'card step' }, h('p', { class: 'small', text: 'Question ' + (step + 1) + ' of ' + STEPS.length }), h('h2', { text: s[0] }), h('p', { class: 'muted', text: s[1] }), s[2](),
        h('div', { class: 'row between' }, step ? h('button', { type: 'button', class: 'btn', onclick: function () { step--; draw(); } }, '← Back') : h('span'),
          h('button', { type: 'button', class: 'btn primary big', onclick: function () { step++; draw(); } }, step + 1 >= STEPS.length ? 'Show my plan' : 'Next'))));
    }
    main.appendChild(h('section', { class: 'hero2 small-hero' }, h('h1', { text: 'Fight back, legally.' }), h('p', { class: 'lead', text: 'Tell Warden what happened. Seven short questions. You get your letters filled in, a complaint draft, and a plan in order. Nothing leaves this device.' })));
    main.appendChild(box);
    draw();
  });

  /* ---------- Is this even real? ---------- */
  TABS.verify = function (main) {
    var st = S.get('verify', { notice: {}, ticks: {}, text: '', written: '' }), out = h('div', { 'aria-live': 'polite' }), ta = h('textarea', { id: 'vf-text', rows: 5, placeholder: 'Optional: paste their letter, text or email, or write what they said on the phone.' });
    ta.value = st.text || '';
    function save() { st.text = ta.value; S.set('verify', st); }
    function tri(n) {
      var name = 'vn-' + n.id;
      return h('div', { class: 'tri' }, h('div', null, h('span', { text: n.label }), h('span', { class: 'src', text: n.cite })),
        h('div', { class: 'seg3', role: 'radiogroup', 'aria-label': n.label }, [['yes', 'Yes'], ['no', 'No'], ['', 'Not sure']].map(function (o) {
          var id = name + '-' + (o[0] || 'u');
          return h('span', null, h('input', { type: 'radio', name: name, id: id, value: o[0], checked: (st.notice[n.id] || '') === o[0], onchange: function () { st.notice[n.id] = o[0]; save(); } }), h('label', { for: id, text: o[1] }));
        })));
    }
    function run() {
      var r, seg, spans = [];
      save(); S.set('stat:verify', true);
      r = SW.verify.check({ notice: st.notice, ticks: st.ticks, text: ta.value, written: st.written });
      ui.clear(out);
      r.red.forEach(function (x) { (x.spans || []).forEach(function (sp) { spans.push({ start: sp.start, end: sp.end, title: x.title }); }); });
      spans.sort(function (p, q) { return p.start - q.start; });
      seg = []; var pos = 0, txt = ta.value;
      spans.forEach(function (sp) { if (sp.start < pos) { return; } if (sp.start > pos) { seg.push(txt.slice(pos, sp.start)); } seg.push(h('mark', { class: 'flag-hit', title: sp.title }, txt.slice(sp.start, sp.end))); pos = sp.end; });
      if (pos < txt.length) { seg.push(txt.slice(pos)); }
      var cls = { scam: 'severe', red: 'high', nowritten: 'caution', missing: 'caution', unsure: 'caution', complete: 'low' }[r.level];
      out.appendChild(h('section', { class: 'card result verify-out' }, h('div', { class: 'verdict lv-' + cls }, h('strong', { class: 'vhead', text: r.headline })),
        spans.length ? h('div', null, h('h4', { text: 'Red-flag words in what you pasted' }), h('blockquote', { class: 'hl' }, seg)) : null,
        r.red.length ? h('div', null, h('h4', { text: 'Red flags (' + r.red.length + ')' }), h('ul', { class: 'flags' }, r.red.map(function (x) { return h('li', { class: 'flag ' + (x.scam ? 'w5' : 'w3') }, h('div', { class: 'flag-head' }, h('strong', { text: x.title }), x.scam ? h('span', { class: 'badge lv-severe', text: 'scam sign' }) : null), h('p', { text: x.why }), h('p', { class: 'src', text: 'Rule or source: ' + x.cite })); }))) : null,
        r.missing.length ? h('div', null, h('h4', { text: 'Missing from their notice (' + r.missing.length + ')' }), h('ul', null, r.missing.map(function (m) { return h('li', null, m.label + ' ', h('span', { class: 'src', text: '(' + m.cite + ')' })); }))) : null,
        h('h4', { text: 'What to do next' }), h('ol', { class: 'steps' }, r.steps.map(function (s) { return h('li', { text: s }); })),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/debt/letters/validation', text: 'Open my dispute letter' }), h('a', { class: 'btn', href: '#/debt/log', text: 'Log this contact' }), h('a', { class: 'btn', href: '#/check/patterns/phantom', text: 'How fake collectors work' })),
        ui.notice('A checklist cannot prove a debt is real or fake. Missing items are worth asking about in writing. Information as of ' + SW.data.meta.asOfLabel + '. General information, not legal advice.', 'legal')));
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    main.appendChild(ui.card('Is this even real?', [h('p', { class: 'lead', text: 'Check what a collector sent or said against what the law requires. You get the missing pieces and the red flags, in plain words.' }),
      h('h4', { text: '1. Did you get anything in writing?' }),
      choiceRow('Did you get anything in writing', [['yes', 'Yes, a letter or email'], ['no', 'No, only calls or texts'], ['unsure', 'Not sure']], st.written, function (v) { st.written = v; save(); ui.renderRoute(); })]));
    if (st.written === 'yes') { main.appendChild(ui.card('2. What does their notice show?', [h('p', { class: 'small', text: 'A validation notice must include each item below. Look at the letter and answer each one.' }), h('div', { class: 'trilist' }, SW.verify.NOTICE.map(tri))])); }
    main.appendChild(ui.card((st.written === 'yes' ? '3' : '2') + '. What did they say or do?', [h('div', { class: 'tickgrid' }, SW.verify.FLAGS.map(function (f) {
      var id = 'vt-' + f.id;
      return h('label', { class: 'tick' + (st.ticks[f.id] ? ' on' : ''), for: id }, h('input', { type: 'checkbox', id: id, checked: !!st.ticks[f.id], onchange: function (e) { st.ticks[f.id] = e.target.checked; e.target.parentNode.classList.toggle('on', e.target.checked); save(); } }), h('span', { text: f.tick }));
    })), h('label', { for: 'vf-text', class: 'lbl', text: 'Their words (optional)' }), ta,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary big', onclick: run }, 'Check it'), h('button', { type: 'button', class: 'btn', onclick: function () { S.del('verify'); ui.renderRoute(); } }, 'Clear'))]));
    main.appendChild(out);
  };

  /* ---------- Violation timeline, chart, evidence packet ---------- */
  TABS.timeline = function (main) { main.appendChild(window.StarkTrial.card('evidence_packet')); };
})(typeof window !== 'undefined' ? window : globalThis);
