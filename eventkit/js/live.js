/* Stark Event Kit live tools: provable prize draw (+ big screen), league and season standings, stream overlay, backup. */
(function (g) {
  'use strict';
  var S = g.SEK, UI = S.ui, h = UI.h, R = UI.routes, doc = g.document;

  function btn(label, on, cls, attrs) { var a = attrs || {}; a.type = 'button'; a.class = 'btn ' + (cls || ''); a.onclick = on; return h('button', a, label); }
  function input(type, value, attrs) { var a = attrs || {}; a.type = type; a.value = value == null ? '' : String(value); return h('input', a); }
  function groups(hex) { return hex.replace(/(.{8})/g, '$1 ').trim(); }
  function fullscreenKey(e) { if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) { try { if (doc.fullscreenElement) doc.exitFullscreen(); else doc.documentElement.requestFullscreen(); } catch (x) { /* ignore */ } } }

  /* ---------- prize draw ---------- */
  R.raffle = function (root, q) {
    var RF = S.load('raffle'), tab = q.tab || 'draw', setup = !RF.draws.length || (RF.draws[0].state === 'drawn' && RF.draws[0].revealed), audience = '', vText = '', vRes = null, confirmNew = false;
    function save() { if (!S.save('raffle', RF)) UI.toast('Could not save the draw. Storage may be full.'); }
    function openBig() { var w = null; try { w = g.open(g.location.href.split('#')[0] + '#/draw', 'sek_draw', 'popup=yes,width=1280,height=720'); } catch (e) { /* ignore */ } if (!w) UI.toast('The browser blocked the window. Allow pop-ups, or open #/draw in a new window.'); }
    function draw() {
      UI.clear(root);
      root.appendChild(h('h1', { text: 'Prize draw' }));
      root.appendChild(h('p', { class: 'muted', text: 'A fair raffle anyone can check. The room sees a fingerprint of a secret number before the draw; the number is revealed afterwards so the result can be re-run and verified.' }));
      root.appendChild(UI.tabs([['draw', 'Draw'], ['history', 'Past draws (' + RF.draws.length + ')'], ['verify', 'Verify a draw']], tab, function (t) { tab = t; draw(); }));
      ({ draw: tDraw, history: tHistory, verify: tVerify })[tab]();
    }
    function tDraw() {
      var D = RF.draws[0];
      if (setup || !D) return tSetup();
      var box = h('div', { class: 'card', id: 'rf-active' }, h('div', { class: 'row between' }, h('h2', { text: D.name }), h('div', { class: 'row' }, btn('Open the big screen', openBig, '', { id: 'rf-big' }), btn('New draw', function () { if (D.state === 'committed' && !confirmNew) { confirmNew = true; draw(); return; } confirmNew = false; setup = true; draw(); }, D.state === 'committed' && confirmNew ? 'bad' : '', { id: 'rf-new' }))));
      if (confirmNew) box.appendChild(h('p', { class: 'status-wrong', text: 'This draw has not happened yet. Press New draw again to leave it unused (it stays in the history).' }));
      var ents = S.raffle.fromCanonical(D.entrants), tickets = ents.reduce(function (a, e) { return a + e.tickets; }, 0);
      box.appendChild(h('p', { text: ents.length + ' entrants, ' + tickets + ' tickets, ' + D.prizes.length + ' prize' + (D.prizes.length === 1 ? '' : 's') + '. ' + (D.multi ? 'One person can win more than once.' : 'One prize per person.') }));
      box.appendChild(h('div', { class: 'commit' }, h('div', { class: 'fine', text: 'Commitment (shown before the draw)' }), h('code', { id: 'rf-commit', text: groups(D.commit) }), h('div', { class: 'fine', text: 'Entrant list fingerprint: ' + D.listHash.slice(0, 16) + '...' })));
      if (D.state === 'committed') {
        box.appendChild(h('ol', { class: 'steps' }, h('li', { text: 'Show the commitment on the big screen, or read out its first 8 characters.' }), h('li', { text: 'Ask someone in the room for any number or word. It is mixed in, so nobody (not even you) could know the result in advance.' }), h('li', { text: 'Draw, then reveal the secret so anyone can check.' })));
        box.appendChild(h('div', { class: 'row' }, h('div', { class: 'field', style: { margin: 0, flex: '1', minWidth: '200px' } }, h('label', { for: 'rf-aud', text: 'Audience number or word' }), input('text', audience, { id: 'rf-aud', maxlength: '200', oninput: function (e) { audience = e.target.value; } })),
          btn('Draw winners', function () { S.raffle.draw(D, audience); save(); UI.beep(880, 200); draw(); }, 'primary', { id: 'rf-draw' })));
      } else {
        var wl = h('ol', { class: 'winners', id: 'rf-winners' });
        D.winners.forEach(function (w) { wl.appendChild(h('li', null, h('span', { class: 'prize', text: w.prize }), h('strong', { text: w.name }), h('span', { class: 'fine', text: ' ticket ' + w.ticket }))); });
        box.appendChild(h('h3', { text: 'Winners' })); box.appendChild(wl);
        if (D.winners.length < D.prizes.length) box.appendChild(h('p', { class: 'fine', text: (D.prizes.length - D.winners.length) + ' prize(s) left over: there were more prizes than eligible entrants.' }));
        box.appendChild(h('p', { class: 'fine', text: 'Audience input mixed in: ' + (D.audience ? '"' + D.audience + '"' : '(none)') }));
        if (!D.revealed) box.appendChild(btn('Reveal the secret for checking', function () { D.revealed = true; save(); draw(); }, 'primary', { id: 'rf-reveal' }));
        else {
          var rec = JSON.stringify(S.raffle.record(D), null, 1);
          box.appendChild(h('div', { class: 'commit' }, h('div', { class: 'fine', text: 'Secret (seed), revealed after the draw' }), h('code', { id: 'rf-seed', text: groups(D.seed) })));
          box.appendChild(h('div', { class: 'row' }, btn('Download the draw record', function () { UI.download('draw-record-' + D.at.slice(0, 10) + '.json', rec, 'application/json'); }, '', { id: 'rf-dl' }), btn('Print winners', UI.print)));
          box.appendChild(h('details', null, h('summary', { text: 'Draw record (anyone can paste this into Verify a draw)' }), h('textarea', { rows: '8', readonly: true, 'aria-label': 'Draw record', id: 'rf-record' }, rec)));
        }
      }
      root.appendChild(box);
      root.appendChild(h('p', { class: 'fine', text: 'Honest limit: the secret is kept on this computer until you reveal it, so the fairness proof relies on the audience number being chosen after the commitment is shown.' }));
    }
    function tSetup() {
      var c = h('div', { class: 'card' }, h('h2', { text: 'Set up a draw' }));
      var sum = h('p', { class: 'fine', id: 'rf-sum', role: 'status' });
      function summary() { var p = S.raffle.parse(RF.entrants); sum.textContent = p.errors.length ? p.errors[0] : p.entrants.length + ' entrants, ' + p.total + ' tickets' + (p.dups ? ' (' + p.dups + ' repeated name' + (p.dups === 1 ? '' : 's') + ' merged into one entry)' : '') + '.'; }
      var ta = h('textarea', { rows: '8', id: 'rf-ents', placeholder: 'One per line. Extra tickets after a comma:\nAna Silva, 3\nRaj Patel\nKim Lee, 2', oninput: function (e) { RF.entrants = e.target.value; summary(); }, onchange: save }, RF.entrants);
      c.appendChild(UI.field('Draw name', input('text', RF.name, { maxlength: '80', onchange: function (e) { RF.name = e.target.value.trim() || 'Prize draw'; save(); } }), 'rf-name'));
      c.appendChild(h('div', { class: 'grid g2' },
        h('div', null, UI.field('Entrants (one per line; "Name, 3" for three tickets)', ta, 'rf-ents'), sum,
          h('div', { class: 'row' }, btn('Use checked-in guests', function () { fromGuests(true); }, 'small', { id: 'rf-guests' }), btn('Use all booked guests', function () { fromGuests(false); }, 'small'))),
        h('div', null, UI.field('Prizes, one per line, drawn in this order', h('textarea', { rows: '8', placeholder: 'Hamper\nBook voucher\nBox of chocolates', oninput: function (e) { RF.prizes = e.target.value; }, onchange: save }, RF.prizes), 'rf-prizes'),
          UI.check('rf-multi', 'Allow one person to win more than one prize', RF.multi, function (v) { RF.multi = v; save(); }))));
      var err = h('p', { class: 'status-wrong', role: 'alert' });
      c.appendChild(h('div', { class: 'row' }, btn('Lock the entries and show the commitment', function () {
        var r; try { r = S.raffle.commit(RF, Date.now()); } catch (e) { err.textContent = e.message; return; }
        if (r.error) { err.textContent = r.error; return; }
        save(); setup = false; audience = ''; draw(); }, 'primary', { id: 'rf-commit-btn' })), err);
      root.appendChild(c); summary();
      function fromGuests(onlyIn) {
        var G = S.load('guests'), names = G.people.filter(function (p) { return p.status === 'registered' && (!onlyIn || p.inAt); }).map(function (p) { return p.name; });
        if (!names.length) { UI.toast(onlyIn ? 'Nobody is checked in yet.' : 'No booked guests yet.'); return; }
        RF.entrants = names.join('\n'); save(); draw();
      }
    }
    function tHistory() {
      if (!RF.draws.length) { root.appendChild(h('div', { class: 'card' }, h('p', { class: 'muted', text: 'No draws yet.' }))); return; }
      var tb = h('tbody');
      RF.draws.forEach(function (D) {
        tb.appendChild(h('tr', null, h('td', { text: D.at.slice(0, 16).replace('T', ' ') }), h('td', { text: D.name }), h('td', { text: D.state === 'drawn' ? (D.revealed ? 'drawn, secret revealed' : 'drawn') : 'not drawn' }),
          h('td', { text: D.winners.map(function (w) { return w.prize + ': ' + w.name; }).join('; ') || '-' }), h('td', null, h('code', { text: D.commit.slice(0, 16) + '...' })),
          h('td', null, D.revealed ? btn('Record', function () { UI.download('draw-record-' + D.at.slice(0, 10) + '.json', JSON.stringify(S.raffle.record(D), null, 1), 'application/json'); }, 'small', { 'aria-label': 'Download record for ' + D.name }) : null)));
      });
      root.appendChild(h('div', { class: 'card scroll-x' }, h('table', null, h('thead', null, h('tr', null, ['When', 'Draw', 'State', 'Winners', 'Commitment', ''].map(function (x) { return h('th', { text: x }); }))), tb)));
    }
    function tVerify() {
      var ta = h('textarea', { rows: '8', id: 'rf-vtext', 'aria-label': 'Draw record to verify', placeholder: 'Paste a draw record (JSON) here, or choose the file.', oninput: function (e) { vText = e.target.value; } }, vText);
      var out = h('div', { id: 'rf-vout', role: 'status' });
      if (vRes) {
        if (vRes.problems.length) vRes.problems.forEach(function (p) { out.appendChild(h('p', { class: 'status-wrong', text: p })); });
        else out.appendChild(h('p', { class: 'status-right', text: 'Verified: the secret matches the commitment, the entrant list matches its fingerprint, and a fresh re-run gives exactly the recorded winners.' }));
        if (vRes.winners) out.appendChild(h('ol', null, vRes.winners.map(function (w) { return h('li', { text: w.prize + ': ' + w.name + ' (ticket ' + w.ticket + ')' }); })));
      }
      root.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Verify a draw' }),
        h('p', { class: 'muted', text: 'Works for any Stark Event Kit draw record, including one made on another computer. Nothing is sent anywhere.' }),
        h('input', { type: 'file', accept: '.json,.txt', 'aria-label': 'Draw record file', onchange: function (e) { UI.readFile(e.target, function (t) { vText = t; draw(); }); } }), h('div', { style: { height: '8px' } }), ta,
        h('div', { class: 'row', style: { marginTop: '8px' } }, btn('Verify', function () { var j; try { j = JSON.parse(vText); } catch (e) { vRes = { problems: ['That is not valid JSON.'] }; draw(); return; } vRes = S.raffle.verify(j); draw(); }, 'primary', { id: 'rf-verify' })), out,
        h('details', null, h('summary', { text: 'Method' }), h('p', { class: 'fine', text: S.raffle.METHOD }))));
    }
    draw();
  };

  /* big screen for the prize draw (follows the draw page through storage events) */
  R.draw = function (root) {
    function build() {
      var RF = S.load('raffle'), D = RF.draws[0], box = h('div', { class: 'pres' });
      UI.clear(root); root.appendChild(box);
      if (!D) { box.appendChild(h('div', { class: 'pbody' }, h('div', { class: 'ptitle', text: 'Prize draw' }), h('div', { class: 'psub', text: 'Waiting for the host to lock the entries.' }))); return; }
      var ents = S.raffle.fromCanonical(D.entrants), tickets = ents.reduce(function (a, e) { return a + e.tickets; }, 0);
      box.appendChild(h('div', { class: 'ptop' }, h('span', { text: D.name }), h('span', { text: ents.length + ' entrants  -  ' + tickets + ' tickets' })));
      var body = h('div', { class: 'pbody' });
      if (D.state === 'committed') {
        body.appendChild(h('div', { class: 'ptitle', text: 'Entries are locked' }));
        body.appendChild(h('div', { class: 'psub', text: 'Fingerprint of the secret draw number. Write down the first 8 characters:' }));
        body.appendChild(h('div', { class: 'phash', id: 'draw-commit', text: groups(D.commit) }));
        body.appendChild(h('div', { class: 'psub', text: 'Next: someone in the room picks any number or word, then we draw.' }));
      } else {
        body.appendChild(h('div', { class: 'ptitle small', text: 'Winners' }));
        var ol = h('ol', { class: 'pwin', id: 'draw-winners' });
        D.winners.forEach(function (w, i) { var li = h('li', null, h('span', { class: 'pz', text: w.prize }), h('span', { class: 'pn', text: w.name }), h('span', { class: 'pt', text: 'ticket ' + w.ticket })); li.style.animationDelay = (i * 0.6) + 's'; ol.appendChild(li); });
        body.appendChild(ol);
        body.appendChild(h('div', { class: 'psrc', text: 'Commitment ' + D.commit.slice(0, 8) + '...  -  audience input "' + D.audience + '"' + (D.revealed ? '  -  secret ' + D.seed.slice(0, 16) + '... (check it in Verify a draw)' : '') }));
      }
      box.appendChild(body);
      box.appendChild(h('div', { class: 'hint', text: 'F fullscreen  -  controlled from the Prize draw page' }));
    }
    function st(e) { if (e.key === 'sek.raffle') build(); }
    build();
    g.addEventListener('storage', st); g.addEventListener('keydown', fullscreenKey);
    UI.onLeave(function () { g.removeEventListener('storage', st); g.removeEventListener('keydown', fullscreenKey); });
  };

  R.league = function (root) { root.appendChild(h('h1', { text: 'League' })); root.appendChild(window.StarkTrial.card('league')); };
  /* ---------- stream overlay (capture this window in OBS or similar) ---------- */
  R.overlay = function (root) {
    var H = S.host, O = S.load('overlay'), els = {}, tick;
    H.isControl = false; H.open(); H.load();
    function apply() { doc.body.classList.remove('ov-green', 'ov-clear', 'ov-dark'); doc.body.classList.add('ov-' + O.bg); }
    function build() {
      var s = H.s; UI.clear(root); els = {}; apply();
      var box = h('div', { class: 'ov ' + O.pos }); root.appendChild(box);
      if (!s) { box.appendChild(h('div', { class: 'ov-bar' }, h('div', { class: 'ov-ev', text: 'Stark Event Kit' }), h('div', { class: 'ov-q', text: 'Waiting for the host panel.' }))); return; }
      var q = S.game.cur(s), rd = q ? s.rounds[q.round] : null, inQ = (s.phase === 'question' || s.phase === 'reveal') && q;
      if (O.board && s.teams.length) {
        var rows = S.game.standings(s).slice(0, 6);
        box.appendChild(h('div', { class: 'ov-board', id: 'ov-board' }, h('div', { class: 'ov-ev', text: s.phase === 'final' ? 'Final standings' : 'Standings' }), rows.map(function (r) { var d = h('span', { class: 'dot' }); d.style.background = r.team.color; return h('div', { class: 'ov-row' }, h('span', { text: UI.rankLabel(r) }), h('span', { class: 'ov-nm' }, d, r.team.name), h('b', { text: String(r.team.score) })); })));
      }
      var bar = h('div', { class: 'ov-bar' }, h('div', { class: 'ov-ev', text: s.name + (inQ && rd ? '  -  ' + rd.name + ', question ' + (s.qi + 1 - rd.start) + ' of ' + rd.count : s.phase === 'scores' ? '  -  scores' : s.phase === 'final' ? '  -  final results' : '') }));
      if (O.question && inQ) {
        bar.appendChild(h('div', { class: 'ov-q', id: 'ov-q', text: q.q }));
        if (s.phase === 'reveal') bar.appendChild(h('div', { class: 'ov-a', text: 'Answer: ' + q.a }));
        else if (s.showChoices && q.choices.length) bar.appendChild(h('div', { class: 'ov-ch' }, q.choices.map(function (c, i) { return h('span', null, h('b', { text: 'ABCDEF'.charAt(i) }), ' ' + c); })));
      } else if (s.phase === 'title') bar.appendChild(h('div', { class: 'ov-q', text: 'Starting soon' }));
      else if (s.phase === 'final') { var top = S.game.standings(s)[0]; bar.appendChild(h('div', { class: 'ov-q', text: top ? 'Winner: ' + top.team.name + ' with ' + top.team.score + ' points' : 'Final results' })); }
      if (O.timer && inQ) { els.t = h('div', { class: 'ov-timer', id: 'ov-timer' }); bar.appendChild(els.t); }
      box.appendChild(bar);
      if (O.ticker) box.appendChild(h('div', { class: 'ov-ticker' }, h('span', { text: O.ticker })));
      paint();
    }
    function paint() { var s = H.s; if (!s || !els.t) return; var rem = S.game.remaining(s, Date.now()), txt = S.fmtTime(rem); if (els.t.textContent !== txt) els.t.textContent = txt; els.t.classList.toggle('low', rem <= 5 && s.timer.running); }
    function st(e) { if (e.key === 'sek.overlay') { O = S.load('overlay'); build(); } }
    H.render = build; build();
    H.post({ type: 'ohello' });
    tick = setInterval(paint, 250);
    g.addEventListener('storage', st);
    UI.onLeave(function () { clearInterval(tick); g.removeEventListener('storage', st); doc.body.classList.remove('ov-green', 'ov-clear', 'ov-dark'); H.render = null; H.close(); });
  };

  /* ---------- backup and restore ---------- */
  R.backup = function (root) {
    var parsed = null, msg = '', done = null;
    /* Live autosave card: pick a file once; every save then rewrites it as a full backup (Chromium browsers). */
    function autoCard() {
      var A = UI.autosave, st = A ? A.state : null, line = h('p', { id: 'as-status', role: 'status' }), card = h('div', { class: 'card', id: 'as-card', style: { marginTop: '16px' } }, h('h2', { text: 'Autosave to a file' }));
      function say() {
        line.textContent = !st.handle ? 'Off. Choose a file, for example on a USB stick or a synced folder, and every change is written to it a moment later.'
          : st.waiting ? 'Paused for "' + st.name + '": the browser needs your permission again after a reload.'
          : st.error ? st.error : 'On: writing to "' + st.name + '"' + (st.writes ? ', last written ' + new Date(st.lastAt).toTimeString().slice(0, 8) + ' (' + st.writes + ' write' + (st.writes === 1 ? '' : 's') + ' this session).' : '.');
      }
      if (!A || !S.autosave.supported(g)) {
        card.appendChild(h('p', { class: 'muted', text: 'This browser cannot write to a file you choose (it needs a current Chrome or Edge, with the kit opened directly rather than inside another page). Use "Download backup file" instead.' }));
        return card;
      }
      UI.onAutosave = function () { if (line.isConnected) say(); };
      card.appendChild(h('p', { class: 'fine', text: 'The file is a normal backup (checksummed, not encrypted) that "Restore from a backup" can read. Keep it somewhere private if it holds guest contact details.' }));
      card.appendChild(h('div', { class: 'row' },
        btn(st.handle ? 'Choose a different file' : 'Choose autosave file', function () {
          g.showSaveFilePicker({ suggestedName: 'stark-event-kit-autosave.json', types: [{ description: 'Stark Event Kit backup', accept: { 'application/json': ['.json'] } }] })
            .then(function (hd) { return A.attach(hd).then(function () { A.remember(hd); draw(); }); }, function () { /* picker closed */ });
        }, 'primary', { id: 'as-pick' }),
        st.handle && st.waiting ? btn('Resume autosave', function () { A.resume().then(draw); }, '', { id: 'as-resume' }) : null,
        st.handle ? btn('Stop autosave', function () { A.detach(); A.remember(null); draw(); }, '', { id: 'as-stop' }) : null));
      card.appendChild(line); say();
      return card;
    }
    function sizeOf(v) { var n = JSON.stringify(v).length; return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
    var LABEL = { custom: 'Your questions', history: 'Finished events', game: 'Current event', bracket: 'Bracket', jam: 'Game jam', plan: 'Event details', guests: 'Guests and check-in', seating: 'Seating', show: 'Run of show', budget: 'Budget', crew: 'Volunteers', raffle: 'Prize draws', league: 'League and season', design: 'Badge and certificate designs', overlay: 'Stream overlay settings', passes: 'Door pass secret and scan log' };
    function draw() {
      UI.clear(root);
      var data = S.backup.collect(), keys = Object.keys(data);
      root.appendChild(h('h1', { text: 'Back up and restore' }));
      root.appendChild(h('p', { class: 'muted', text: 'Everything lives in this browser on this computer. Save a backup file before clearing the browser, and use it to move your events to another computer.' }));
      root.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Back up everything' }),
        keys.length ? h('ul', { id: 'bk-list' }, keys.map(function (k) { return h('li', { text: (LABEL[k] || k) + ' (' + sizeOf(data[k]) + ')' }); })) : h('p', { class: 'muted', text: 'Nothing saved yet.' }),
        h('div', { class: 'row' }, btn('Download backup file', function () { var b = S.backup.make(data, Date.now()); UI.download('stark-event-kit-backup-' + b.savedAt.slice(0, 10) + '.json', JSON.stringify(b), 'application/json'); }, 'primary', { id: 'bk-save', disabled: !keys.length })),
        h('p', { class: 'fine', text: 'The file has a checksum, so a damaged or edited copy is refused on restore. It is not encrypted: keep it somewhere private if it holds guest contact details.' })));
      root.appendChild(autoCard());
      var ta = h('textarea', { rows: '5', id: 'bk-text', 'aria-label': 'Backup file contents', placeholder: 'Choose a backup file, or paste its contents here.' });
      var res = h('div', { role: 'status', id: 'bk-out' });
      if (msg) res.appendChild(h('p', { class: parsed ? 'status-right' : 'status-wrong', text: msg }));
      if (parsed) {
        res.appendChild(h('p', { text: 'This backup' + (parsed.savedAt ? ' from ' + parsed.savedAt.slice(0, 16).replace('T', ' ') : '') + ' holds: ' + parsed.keys.map(function (k) { return LABEL[k] || k; }).join(', ') + '. Restoring replaces those sections on this computer; other sections stay as they are.' }));
        res.appendChild(btn('Replace my data with this backup', function () { done = S.backup.restore(parsed.data); parsed = null; msg = ''; draw(); }, 'bad', { id: 'bk-restore' }));
      }
      if (done) res.appendChild(h('p', { class: done.failed.length ? 'status-wrong' : 'status-right', text: 'Restored: ' + (done.ok.map(function (k) { return LABEL[k] || k; }).join(', ') || 'nothing') + '.' + (done.failed.length ? ' Not restored (storage full or in safe mode): ' + done.failed.map(function (k) { return LABEL[k] || k; }).join(', ') + '.' : '') }));
      root.appendChild(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Restore from a backup' }),
        h('input', { type: 'file', accept: '.json', 'aria-label': 'Backup file', onchange: function (e) { UI.readFile(e.target, function (t) { ta.value = t; check(t); }); } }), h('div', { style: { height: '8px' } }), ta,
        h('div', { class: 'row', style: { marginTop: '8px' } }, btn('Check this backup', function () { check(ta.value); }, '', { id: 'bk-check' })), res));
      function check(t) { var r = S.backup.parse(t); done = null; if (r.error) { parsed = null; msg = r.error; } else { parsed = r; msg = r.note; } draw(); }
    }
    draw();
  };
})(window);
