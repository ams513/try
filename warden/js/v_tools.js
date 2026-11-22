/* Stark Warden: power tools. Live call copilot, evidence seal, trusted circle, and the command palette (Ctrl+K or "/").
   All on this device. No network. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, S = SW.store, doc = root.document;

  /* ---------- Live call copilot ---------- */
  ui.route('call', null, function (main) {
    var C = SW.copilot, st = { start: null, t0: 0, secs: 0, timer: null, lines: [], tactics: [], lock: null },
      clock = h('div', { class: 'clock', role: 'timer', 'aria-label': 'Call length', text: '0:00' }), weekLine = h('p', { class: 'weekline' }),
      replies = h('div', { class: 'replies', 'aria-live': 'polite' }), said = h('ol', { class: 'saidlist' }), area = h('div'), endBox = h('div'),
      ta = h('textarea', { id: 'cp-in', rows: 2, placeholder: 'Type or paste what they just said…' }), startBtn, endBtn, prof = function () { return S.get('dprofile', { tz: 'America/New_York' }); };

    function drawWeek() {
      var n = C.callsInWeek(S.get('log', []), new Date().toISOString(), prof().tz) + (st.start ? 1 : 0);
      weekLine.textContent = 'Collector calls in your log over the last 7 days' + (st.start ? ' (counting this one)' : '') + ': ' + n + (n > 7 ? '. That is more than 7, a pattern worth raising with the CFPB or an attorney.' : '.');
    }
    function tick() {
      if (!clock.isConnected) { clearInterval(st.timer); release(); return; }
      st.secs = Math.round((Date.now() - st.t0) / 1000);
      clock.textContent = Math.floor(st.secs / 60) + ':' + SW.util.pad2(st.secs % 60);
    }
    function release() { try { if (st.lock && st.lock.release) { st.lock.release(); } } catch (e) { /* nothing to release */ } st.lock = null; }
    function addTactics(ts) {
      ts.forEach(function (t) { var i = st.tactics.indexOf(t.id); if (i >= 0) { st.tactics.splice(i, 1); } st.tactics.push(t.id); });
      drawReplies(ts);
    }
    function replyCard(t, i) {
      return h('section', { class: 'card reply' + (i === 0 ? ' newest' : '') }, h('div', { class: 'row between' }, h('strong', { text: t.label }), h('span', { class: 'badge lv-caution', text: i === 0 ? 'say this now' : 'noted' })),
        h('p', { class: 'script', text: '“' + t.say + '”' }), h('p', { class: 'small', text: t.dont }), h('p', { class: 'small', text: 'Rule: ' + t.cite }), h('div', { class: 'row' }, ui.copyBtn(t.say, 'Copy reply')));
    }
    function drawReplies() {
      var shown = C.seen(st.tactics.slice().reverse());
      ui.clear(replies);
      if (!shown.length) { replies.appendChild(h('p', { class: 'muted', text: 'Nothing flagged yet. When they say something pushy, type it above or tap what they did. You will see the calm reply here.' })); return; }
      shown.forEach(function (t, i) { replies.appendChild(replyCard(t, i)); });
    }
    function addLine(text) {
      var v = String(text || '').trim();
      if (!v) { return; }
      st.lines.push(v);
      said.appendChild(h('li', { text: v }));
      addTactics(C.detect(v));
      ta.value = '';
    }
    function begin() {
      st.start = new Date(); st.t0 = Date.now(); st.secs = 0; st.lines = []; st.tactics = [];
      ui.clear(said); ui.clear(endBox); drawReplies(); drawWeek();
      clearInterval(st.timer); st.timer = setInterval(tick, 1000); tick();
      try { if (root.navigator && root.navigator.wakeLock && root.navigator.wakeLock.request) { root.navigator.wakeLock.request('screen').then(function (l) { st.lock = l; }, function () { /* screen may sleep */ }); } } catch (e) { /* not supported */ }
      area.hidden = false; startBtn.hidden = true; endBtn.hidden = false; ta.focus();
    }
    function finish() {
      var f = ui.form([{ id: 'caller', label: 'Who said they were calling?' }, { id: 'phone', label: 'Phone number shown' }, { id: 'spoke', label: 'I spoke with someone', type: 'checkbox' }, { id: 'note', label: 'Anything to add', type: 'textarea', rows: 2, wide: true }], { spoke: st.lines.length > 0 });
      clearInterval(st.timer); tick(); release();
      startBtn.hidden = false; startBtn.textContent = 'Start a new call'; endBtn.hidden = true; area.hidden = true;
      ui.clear(endBox);
      endBox.appendChild(ui.card('Call ended: ' + C.duration(st.secs), [h('p', { class: 'script', text: 'You did well to stay calm. Save this call to your log so it counts as evidence.' }), f.el,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
          var v = f.read(), log = S.get('log', []), e = C.toEntry({ start: st.start, seconds: st.secs, caller: v.caller, phone: v.phone, spoke: v.spoke, said: st.lines, tactics: st.tactics, note: v.note }, ui.uid());
          if (!SW.trial.canAdd(log.length)) { ui.toast(SW.trial.blockedMessage(), 'bad'); return; }
          log.push(e); S.set('log', log); ui.clear(endBox);
          endBox.appendChild(ui.card('Saved to your log', [h('p', { text: 'Entry saved with ' + Object.keys(e.flags).length + ' possible-violation flag(s) ticked.' }), h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/debt/log', text: 'Open my log' }), h('a', { class: 'btn', href: '#/seal', text: 'Seal the log' }))]));
          drawWeek();
        } }, 'Save to my log'), h('button', { type: 'button', class: 'btn', onclick: function () { ui.clear(endBox); } }, 'Discard'))]));
    }
    startBtn = h('button', { type: 'button', class: 'btn primary big', onclick: begin }, 'Start the call timer');
    endBtn = h('button', { type: 'button', class: 'btn danger big', onclick: finish }, 'End call'); endBtn.hidden = true;
    ta.addEventListener('input', function () {
      var ts = C.detect(ta.value);
      if (!ts.length) { drawReplies(); return; }
      ui.clear(replies);
      ts.forEach(function (t) { replies.appendChild(replyCard(t, 0)); });
    });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addLine(ta.value); } });
    area.hidden = true;
    area.appendChild(h('div', { class: 'field' }, h('label', { for: 'cp-in', text: 'What are they saying? (Enter adds it to the call record)' }), ta));
    area.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { addLine(ta.value); } }, 'Add line')));
    area.appendChild(h('p', { class: 'small', text: 'Or tap what just happened:' }));
    area.appendChild(h('div', { class: 'chips' }, C.TACTICS.map(function (t) { return h('button', { type: 'button', class: 'chip', onclick: function () { st.lines.push('(tapped) ' + t.tap); said.appendChild(h('li', { text: '(tapped) ' + t.tap })); addTactics([t]); } }, t.tap); })));
    area.appendChild(replies); area.appendChild(h('details', null, h('summary', { text: 'Call record so far' }), said));
    main.appendChild(h('h2', { text: 'Live call copilot' }));
    main.appendChild(ui.card(null, [h('p', { class: 'lead', text: 'Keep this open while a collector or scammer is on the line. Type or tap what they say and see the calm, lawful reply for it. When you hang up, one tap saves the call to your evidence log.' }),
      h('p', { class: 'small', text: 'You may hang up at any time. You do not have to give any detail about yourself. Nothing here leaves your device.' }), clock, weekLine, h('div', { class: 'row' }, startBtn, endBtn, h('a', { class: 'btn', href: '#/now', text: 'I just need to calm down' }))]));
    main.appendChild(area); main.appendChild(endBox);
    main.appendChild(ui.disclaimerBar());
    drawWeek(); drawReplies();
  });

  /* ---------- Evidence seal ---------- */
  ui.route('seal', null, function (main) {
    var log = S.get('log', []), box = h('div'), chk = h('input', { type: 'text', id: 'sl-code', placeholder: 'For example 3FA9-0C12-…', autocomplete: 'off' }), res = h('div');
    function when(id) { var e = log.filter(function (x) { return x.id === id; })[0]; return e ? e.at : id; }
    function draw() {
      var saved = S.get('seal', null), r = saved ? SW.chain.check(log, saved) : null, cert;
      ui.clear(box);
      if (!log.length) { box.appendChild(ui.notice('Your contact log is empty. Log your first contact, then come back to seal it.', 'soft')); box.appendChild(h('a', { class: 'btn primary', href: '#/debt/log', text: 'Open my log' })); return; }
      if (saved) {
        box.appendChild(ui.card('Your seal', [h('p', { class: 'sealcode', text: saved.anchor }), h('p', { class: 'small', text: 'Sealed ' + saved.sealedAt.slice(0, 16).replace('T', ' ') + ' UTC · ' + saved.n + ' entries' }),
          h('div', { class: 'seal-state ' + (r.ok ? 'ok' : 'chg') }, h('strong', { text: r.ok ? 'Intact' : 'Changed since sealing' }), h('p', { text: r.note }),
            r.changed.length ? h('p', { class: 'small', text: 'Changed: ' + r.changed.map(when).join(', ') }) : null, r.missing.length ? h('p', { class: 'small', text: 'Removed: ' + r.missing.length + ' entry(ies) that were in the seal.' }) : null,
            r.added.length ? h('p', { class: 'small', text: 'Added: ' + r.added.map(when).join(', ') }) : null),
          h('div', { class: 'row' }, ui.copyBtn(saved.anchor, 'Copy seal code'), h('button', { type: 'button', class: 'btn small', onclick: function () { cert = SW.chain.certificate(log, saved, S.get('dprofile', {}).name || '', ui.today()); ui.saveText('evidence-seal.txt', cert); } }, 'Save certificate (.txt)'),
            h('button', { type: 'button', class: 'btn small', onclick: function () { var t = SW.chain.certificate(log, saved, S.get('dprofile', {}).name || '', ui.today()), pre = h('pre', { class: 'doc print-area', text: t }); ui.clear(res); res.appendChild(pre); ui.printEl(pre); } }, 'Print'))]));
      }
      box.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var s = SW.chain.seal(log, new Date().toISOString()), hist = S.get('sealHist', []);
        S.set('seal', s); hist.push({ anchor: s.anchor, at: s.sealedAt, n: s.n }); S.set('sealHist', hist.slice(-20)); ui.toast('Sealed ' + s.n + ' entries.'); draw();
      } }, saved ? 'Seal the log again' : 'Seal my log now')));
    }
    main.appendChild(h('h2', { text: 'Evidence seal' }));
    main.appendChild(ui.card(null, [h('p', { class: 'lead', text: 'Seal your contact log so any later change shows. Each entry is chained to the one before it with SHA-256, right here on your device.' }),
      h('p', { text: 'Keep the short seal code somewhere other than this device: email it to yourself, write it on paper, or tell someone you trust. If the log is ever changed, added to out of order, or has an entry removed, the code will no longer match.' }),
      ui.notice('A seal shows the log did not change after you sealed it. It does not prove the entries are true or who wrote them, and it is not a legal finding. Whether any record can be used is for a court or an attorney to decide.', 'legal')]));
    main.appendChild(box);
    main.appendChild(ui.card('Check a seal code', [h('p', { class: 'small', text: 'Type the code you kept earlier. Warden compares it with your log as it is right now.' }), h('div', { class: 'field' }, h('label', { for: 'sl-code', text: 'Seal code' }), chk),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { ui.clear(res); res.appendChild(ui.notice(SW.chain.matchesAnchor(log, chk.value) ? 'Match. This code is the seal of your log exactly as it is now.' : 'No match. The log is different from what this code was made from, or the code was mistyped.', SW.chain.matchesAnchor(log, chk.value) ? 'soft' : 'warn')); } }, 'Check')), res]));
    draw();
  });

  /* ---------- Trusted circle ---------- */
  ui.route('circle', null, function (main) {
    var out = h('div'), rec = h('div'), secret = h('textarea', { id: 'tc-secret', rows: 2, placeholder: 'A vault passphrase or a short recovery note', autocomplete: 'off' }),
      nIn = h('input', { type: 'number', id: 'tc-n', min: '2', max: '12', value: '5' }), kIn = h('input', { type: 'number', id: 'tc-k', min: '2', max: '12', value: '3' }),
      pasted = h('textarea', { id: 'tc-paste', rows: 4, placeholder: 'Paste one share code per line' });
    function make() {
      var shares;
      ui.clear(out);
      try { shares = SW.shamir.split(secret.value, parseInt(nIn.value, 10), parseInt(kIn.value, 10)); } catch (e) { out.appendChild(ui.notice(e.message, 'warn')); return; }
      secret.value = '';
      out.appendChild(h('div', { class: 'sharecards print-area' }, shares.map(function (c, i) {
        return h('section', { class: 'card sharecard' }, h('strong', { text: 'Share ' + (i + 1) + ' of ' + shares.length + ' · any ' + kIn.value + ' rebuild it' }), h('code', { class: 'sharecode', text: c }), h('div', { class: 'row noprint' }, ui.copyBtn(c, 'Copy share ' + (i + 1))));
      })));
      out.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { ui.printEl(out.firstChild); } }, 'Print the cards'), h('button', { type: 'button', class: 'btn', onclick: function () { ui.clear(out); } }, 'Clear them from this screen')));
      out.appendChild(ui.notice('Give each share to a different person, or keep them in different places. The secret was cleared from the box above and Warden did not save the shares. If you lose too many, nothing can rebuild it.', 'soft'));
    }
    function rebuild() {
      ui.clear(rec);
      try { var s = SW.shamir.combine(pasted.value.split(/\n+/)); rec.appendChild(h('div', { class: 'card result' }, h('strong', { text: 'Rebuilt secret' }), h('code', { class: 'sharecode', text: s }), h('div', { class: 'row' }, ui.copyBtn(s, 'Copy'), h('button', { type: 'button', class: 'btn', onclick: function () { ui.clear(rec); pasted.value = ''; } }, 'Hide it')))); }
      catch (e) { rec.appendChild(ui.notice(e.message, 'warn')); }
    }
    main.appendChild(h('h2', { text: 'Trusted circle' }));
    main.appendChild(ui.card(null, [h('p', { class: 'lead', text: 'If something happens to you, can the people you trust get into your vault? Split the passphrase into share codes. Any few of them rebuild it; fewer than that learn nothing.' }),
      h('p', { text: 'This uses Shamir secret sharing with your browser’s secure random numbers. It runs here and nothing is saved or sent. Best for a vault passphrase, a recovery note, or a key to your safe.' })]));
    main.appendChild(ui.card('Split a secret', [h('div', { class: 'field' }, h('label', { for: 'tc-secret', text: 'Secret to split' }), secret), h('div', { class: 'row' },
      h('div', { class: 'field' }, h('label', { for: 'tc-n', text: 'Make this many shares' }), nIn), h('div', { class: 'field' }, h('label', { for: 'tc-k', text: 'Needed to rebuild it' }), kIn)),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: make }, 'Make the share codes')), out]));
    main.appendChild(ui.card('Rebuild from shares', [h('div', { class: 'field' }, h('label', { for: 'tc-paste', text: 'Shares' }), pasted), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: rebuild }, 'Rebuild the secret')), rec]));
    main.appendChild(ui.disclaimerBar());
  });

  /* ---------- Command palette ---------- */
  var pal = null;
  function openPalette() {
    var back, box, input, list, hint, items, shown = [], sel = 0, prev = doc.activeElement;
    if (pal) { return; }
    items = SW.palette.build({ letters: SW.data.letters, guides: SW.data.guides, patterns: SW.data.patterns, scammed: SW.data.scammed });
    input = h('input', { type: 'text', id: 'pal-in', class: 'pal-in', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', 'aria-label': 'Search screens, letters and guides, or ask about your log', placeholder: 'Search, or ask: how many calls this week?', autocomplete: 'off', spellcheck: 'false' });
    list = h('ul', { class: 'pal-list', id: 'pal-list', role: 'listbox', 'aria-label': 'Results' });
    hint = h('p', { class: 'pal-hint', text: 'Enter to open · arrows to move · Esc to close' });
    box = h('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' }, input, list, hint);
    back = h('div', { class: 'pal-back' }, box);
    function close() { doc.removeEventListener('keydown', onKey, true); if (back.parentNode) { back.parentNode.removeChild(back); } pal = null; try { if (prev && prev.focus) { prev.focus(); } } catch (e) { /* nothing */ } }
    function go(i) { var it = shown[i]; if (!it) { return; } close(); if (it.href) { root.location.hash = it.href; } }
    function draw() {
      var q = input.value, ans = q.trim() ? SW.palette.ask(q, { log: S.get('log', []), profile: S.get('dprofile', {}), now: new Date().toISOString() }) : null, res = q.trim() ? SW.palette.search(items, q, 8) : items.slice(0, 7);
      shown = (ans ? [{ title: ans.text, href: ans.href, kind: 'answer', answer: true }] : []).concat(res);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      ui.clear(list);
      shown.forEach(function (it, i) {
        list.appendChild(h('li', { id: 'pal-' + i, role: 'option', 'aria-selected': i === sel ? 'true' : 'false', class: 'pal-item' + (i === sel ? ' on' : '') + (it.answer ? ' answer' : ''), onclick: function () { go(i); }, onmousemove: function () { if (sel !== i) { sel = i; mark(); } } },
          h('span', { class: 'pal-kind', text: it.kind }), h('span', { class: 'pal-title', text: it.title })));
      });
      if (!shown.length) { list.appendChild(h('li', { class: 'pal-none', role: 'presentation', text: 'Nothing matches. Try a word like “letter”, “gift card” or “deadline”.' })); }
      input.setAttribute('aria-activedescendant', shown.length ? 'pal-' + sel : '');
    }
    function mark() {
      Array.prototype.forEach.call(list.querySelectorAll('.pal-item'), function (li, i) { li.classList.toggle('on', i === sel); li.setAttribute('aria-selected', i === sel ? 'true' : 'false'); });
      input.setAttribute('aria-activedescendant', 'pal-' + sel);
      var cur = doc.getElementById('pal-' + sel); if (cur && cur.scrollIntoView) { cur.scrollIntoView({ block: 'nearest' }); }
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
      else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
    }
    input.addEventListener('input', function () { sel = 0; draw(); });
    back.addEventListener('mousedown', function (e) { if (e.target === back) { close(); } });
    doc.addEventListener('keydown', onKey, true);
    doc.body.appendChild(back); pal = back; draw(); input.focus();
  }
  function typing(el) { var t = el && el.tagName; return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || (el && el.isContentEditable); }
  doc.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); }
    else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(doc.activeElement) && !pal) { e.preventDefault(); openPalette(); }
  });
  (function () { var b = doc.getElementById('palbtn'); if (b) { b.addEventListener('click', openPalette); } })();

  SW.views = SW.views || {};
  SW.views.openPalette = openPalette;
})(typeof window !== 'undefined' ? window : globalThis);
