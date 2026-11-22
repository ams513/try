/* Stark Event Kit host: live game state, BroadcastChannel sync, host control panel and projector (presenter) view.
   The control window owns the state. The presenter window only draws it and forwards keys back. */
(function (g) {
  'use strict';
  var S = g.SEK, UI = S.ui, h = UI.h, H = S.host = { s: null, chan: null, lastPing: 0, isControl: false, seen: [], render: null };
  var CHAN = 'stark-event-kit';

  H.load = function () { H.s = S.store.get('game', null); return H.s; };
  H.open = function () {
    H.close();
    try { H.chan = new g.BroadcastChannel(CHAN); H.chan.onmessage = function (ev) { H.onMsg(ev.data); }; } catch (e) { H.chan = null; }
    H._st = function (ev) {
      if (ev.key === 'sek.cmd' && H.isControl && ev.newValue) { try { H.onMsg(JSON.parse(ev.newValue)); } catch (e) { /* ignore */ } }
      if (ev.key === 'sek.game' && !H.isControl) { H.load(); if (H.render) H.render(); }
    };
    g.addEventListener('storage', H._st);
  };
  H.close = function () { if (H.chan) { try { H.chan.close(); } catch (e) { /* ignore */ } H.chan = null; } if (H._st) { g.removeEventListener('storage', H._st); H._st = null; } };
  H.post = function (m) { if (H.chan) { try { H.chan.postMessage(m); } catch (e) { /* ignore */ } } };
  H.send = function (name, arg) {   // presenter -> control
    var m = { type: 'cmd', id: S.rid(), name: name, arg: arg };
    H.post(m);
    if (!H.chan) { try { g.localStorage.setItem('sek.cmd', JSON.stringify(m)); } catch (e) { /* ignore */ } }   // storage mirror only without BroadcastChannel
  };
  H.onMsg = function (m) {
    if (!m) return;
    if (H.isControl) {
      if (m.type === 'hello' || m.type === 'ohello') { H.post({ type: 'state', state: H.s }); if (m.type === 'hello') H.lastPing = Date.now(); }
      else if (m.type === 'ping') H.lastPing = Date.now();
      else if (m.type === 'cmd') { if (H.seen.indexOf(m.id) >= 0) return; H.seen.push(m.id); if (H.seen.length > 60) H.seen.shift(); H.apply(m.name, m.arg); }
    } else if (m.type === 'state' && m.state) { H.s = m.state; if (H.render) H.render(); }
  };
  H.commit = function () { S.store.set('game', H.s); H.post({ type: 'state', state: H.s }); if (H.render) H.render(); };
  H.apply = function (name, arg) {
    if (!H.s) return false;
    var r = S.game.cmd(H.s, name, arg, Date.now());
    if (r === false) return false;
    if (H.s.phase === 'final') H.archive();
    H.commit(); return true;
  };
  H.archive = function () {
    var s = H.s, list = S.store.get('history', []), copy = JSON.parse(JSON.stringify(s)), i;
    copy.questions.forEach(function (q) { delete q.img; });
    for (i = 0; i < list.length; i++) if (list[i].id === s.id) { list[i] = copy; S.store.set('history', list); return; }
    list.unshift(copy); S.store.set('history', list.slice(0, 12));
  };
  H.presenterUrl = function () { return g.location.href.split('#')[0] + '#/present'; };
  H.openOverlay = function () {
    var w = null; try { w = g.open(g.location.href.split('#')[0] + '#/overlay', 'sek_overlay', 'popup=yes,width=1280,height=720'); } catch (e) { /* ignore */ }
    if (!w) UI.toast('The browser blocked the window. Allow pop-ups, or open #/overlay in a new window.');
    return w;
  };
  H.openPresenter = function () {
    var w = null; try { w = g.open(H.presenterUrl(), 'sek_present', 'popup=yes,width=1280,height=720'); } catch (e) { /* ignore */ }
    if (!w) UI.toast('The browser blocked the window. Allow pop-ups, or open the projector view from the link on this page.');
    return w;
  };
  H.turn = function (s) {
    if (s.mode !== 'team' || !s.teams.length || s.qi < 0) return null;
    var t = s.teams[s.qi % s.teams.length], m = t.members.length ? t.members[Math.floor(s.qi / s.teams.length) % t.members.length] : '';
    return { team: t, member: m };
  };
  H.nextLabel = function (s) {
    var q = S.game.cur(s);
    if (s.phase === 'title') return 'Start event';
    if (s.phase === 'scores') { if (s.ret) return 'Back to question'; return s.qi + 1 >= s.questions.length ? 'Final results' : 'Next round'; }
    if (s.phase === 'final') return 'Finished';
    var last = s.qi + 1 >= s.questions.length || s.questions[s.qi + 1].round !== q.round;
    return last ? 'End round: show scores' : 'Next question';
  };

  /* ---------------- control panel ---------------- */
  UI.routes.control = function (root) {
    H.isControl = true; H.open(); H.load();
    if (!H.s) {
      root.appendChild(h('div', { class: 'card' }, h('h1', { text: 'Host panel' }), h('p', { class: 'muted', text: 'No event is running yet. Set one up, then run it from here while the projector window shows the questions.' }),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/new', text: 'Set up an event' }), h('a', { class: 'btn', href: '#/templates', text: 'Start from a template' }))));
      return;
    }
    var timerEls = [], tick, keyFn, beeped = -1;
    function key(e) {
      var t = e.target && e.target.tagName; if (/INPUT|TEXTAREA|SELECT/.test(t) || e.ctrlKey || e.metaKey || e.altKey) return;
      var s = H.s, k = e.key, d = /^[1-9]$/.test(k) ? +k - 1 : -1;
      if (k === 'ArrowRight' || k === 'n' || k === 'N') H.apply('next');
      else if (k === 'ArrowLeft' || k === 'b' || k === 'B') H.apply('prev');
      else if (k === 'r' || k === 'R') H.apply('reveal');
      else if (k === 't' || k === 'T') H.apply(s.timer.running ? 'timerPause' : 'timerStart');
      else if (k === 's' || k === 'S') H.apply('scores');
      else if (d >= 0 && s.mode === 'buzzer' && s.teams[d]) H.apply('buzz', s.teams[d].id);
    }
    function build() {
      var s = H.s, q = S.game.cur(s), rd = q ? s.rounds[q.round] : null, tr = H.turn(s), live = Date.now() - H.lastPing < 7000, rows = S.game.standings(s);
      var hasTie = rows.some(function (r) { return r.tied; });
      timerEls = [];
      UI.clear(root);
      root.appendChild(h('div', { class: 'row between', style: { marginBottom: '14px' } },
        h('div', null, h('h1', { text: s.name, style: { marginBottom: '2px' } }), h('div', { class: 'row' }, h('span', { class: 'tag accent', text: s.mode === 'pub' ? 'pub quiz' : s.mode }), h('span', { class: 'tag', text: s.questions.length + ' questions, ' + s.rounds.length + ' rounds' }), h('span', { class: 'tag', text: 'phase: ' + s.phase }))),
        h('div', { class: 'row' }, h('span', { class: 'fine', id: 'conn' }, h('span', { class: 'live' + (live ? ' on' : '') }), live ? 'Projector connected' : 'Projector not detected'),
          h('button', { type: 'button', class: 'btn primary', id: 'open-pres', onclick: function () { H.openPresenter(); } }, 'Open projector window'),
          h('button', { type: 'button', class: 'btn', id: 'open-overlay', onclick: function () { H.openOverlay(); } }, 'Stream overlay'))));

      var left = h('div', { class: 'card' });
      if (s.phase === 'title') left.appendChild(h('div', { class: 'qbox' }, h('div', { class: 'qtext', text: 'Ready to begin' }), h('p', { class: 'muted', text: 'Open the projector window, drag it to the big screen and press F for fullscreen. Then start the event.' })));
      if (s.phase === 'scores') left.appendChild(h('div', { class: 'qbox' }, h('div', { class: 'qtext', text: s.roundEnd && rd ? 'End of ' + rd.name : 'Standings on screen' }), h('p', { class: 'muted', text: 'The projector shows the scoreboard. Press the green button to continue.' })));
      if (s.phase === 'final') left.appendChild(h('div', { class: 'qbox' }, h('div', { class: 'qtext', text: 'Event finished' }), h('p', { class: 'muted', text: 'Final results are on the projector and saved on this computer.' }), h('a', { class: 'btn primary', href: '#/results', text: 'Certificates, sheets and export' })));
      if (q && (s.phase === 'question' || s.phase === 'reveal' || (s.phase === 'scores' && s.ret))) {
        var meta = h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'tag accent', text: (rd ? rd.name : 'Round') + ' - Q' + (s.qi + 1 - (rd ? rd.start : 0)) + ' of ' + (rd ? rd.count : '?') }), UI.catTag(q.cat), UI.diffTag(q.diff, S.points(s.scoring, q, 0)));
        var qb = h('div', { class: 'qbox' }, meta, h('div', { class: 'qtext', text: q.q }));
        if (q.img) qb.appendChild(h('img', { src: q.img, alt: 'Picture for this question', style: { maxHeight: '160px', maxWidth: '100%', marginTop: '8px', borderRadius: '8px' } }));
        if (q.choices.length) qb.appendChild(h('ol', { type: 'A', style: { margin: '8px 0 0', paddingLeft: '1.4em' } }, q.choices.map(function (c, i) { return h('li', { text: c, style: i === q.ans ? { color: 'var(--accent)', fontWeight: '800' } : null }); })));
        qb.appendChild(h('div', { class: 'ans', text: 'Answer (host only): ' + q.a }));
        if (q.src) qb.appendChild(h('div', { class: 'fine', text: 'Note: ' + q.src }));
        left.appendChild(qb);
      }
      var nextBtn = h('button', { type: 'button', class: 'btn primary', id: 'btn-next', disabled: s.phase === 'final', onclick: function () { H.apply('next'); } }, H.nextLabel(s));
      var inQ = s.phase === 'question' || s.phase === 'reveal';
      var tnum = h('span', { class: 'timer-num', 'aria-live': 'off' }); timerEls.push(tnum);
      left.appendChild(h('div', { class: 'row', style: { marginBottom: '12px' } }, nextBtn,
        h('button', { type: 'button', class: 'btn', id: 'btn-prev', disabled: s.qi <= 0 || s.phase === 'title' || s.phase === 'final', onclick: function () { H.apply('prev'); } }, 'Back'),
        h('button', { type: 'button', class: 'btn', id: 'btn-reveal', disabled: s.phase !== 'question', onclick: function () { H.apply('reveal'); } }, 'Reveal answer'),
        h('button', { type: 'button', class: 'btn', id: 'btn-scores', disabled: s.phase === 'title' || s.phase === 'final', onclick: function () { H.apply('scores'); } }, s.phase === 'scores' ? 'Hide scores' : 'Show scores')));
      if (inQ) left.appendChild(h('div', { class: 'row', style: { marginBottom: '12px' } }, tnum,
        h('button', { type: 'button', class: 'btn', id: 'btn-timer', disabled: s.phase !== 'question', onclick: function () { H.apply(s.timer.running ? 'timerPause' : 'timerStart'); } }, s.timer.running ? 'Pause timer' : 'Start timer'),
        h('button', { type: 'button', class: 'btn', onclick: function () { H.apply('timerReset'); } }, 'Reset timer')));
      if (s.buzzed && s.phase === 'question') { var bt = s.teams.filter(function (t) { return t.id === s.buzzed; })[0]; left.appendChild(h('div', { class: 'qbox', style: { borderLeft: '6px solid ' + bt.color } }, h('strong', { text: bt.name + ' buzzed in. ' }), 'Mark the answer right or wrong below.')); }
      if (tr && inQ) left.appendChild(h('p', { class: 'muted' }, 'Turn: ', h('strong', { text: tr.team.name + (tr.member ? ' (' + tr.member + ')' : '') }), '. Other teams may steal if you mark them below.'));
      if (inQ || (s.phase === 'scores' && s.ret)) {
        var m = (q && s.marks[q.id]) || {};
        left.appendChild(h('h3', { text: 'Mark answers' }));
        s.teams.forEach(function (t, i) {
          var st = m[t.id] && m[t.id].r, locked = s.locked.indexOf(t.id) >= 0;
          var btns = h('div', { class: 'row' });
          if (s.mode === 'buzzer') btns.appendChild(h('button', { type: 'button', class: 'btn small', disabled: !!s.buzzed || locked || s.phase !== 'question', onclick: function () { H.apply('buzz', t.id); } }, 'Buzz' + (i < 9 ? ' (' + (i + 1) + ')' : '')));
          btns.appendChild(h('button', { type: 'button', class: 'btn small good', 'aria-label': 'Mark ' + t.name + ' right', onclick: function () { H.apply('mark', { team: t.id, res: st === 'right' ? null : 'right' }); } }, st === 'right' ? 'Right (undo)' : 'Right'));
          btns.appendChild(h('button', { type: 'button', class: 'btn small bad', 'aria-label': 'Mark ' + t.name + ' wrong', onclick: function () { H.apply('mark', { team: t.id, res: st === 'wrong' ? null : 'wrong' }); } }, st === 'wrong' ? 'Wrong (undo)' : 'Wrong'));
          left.appendChild(h('div', { class: 'teamrow' + (s.buzzed === t.id ? ' buzzed' : '') },
            h('div', null, h('span', { class: 'dot', style: { background: t.color } }), h('span', { class: 'nm', text: t.name }), h('span', { class: 'muted', text: '  ' + t.score + ' pts' }),
              st ? h('span', { class: 'status-' + st, text: '  ' + st }) : null, locked ? h('span', { class: 'fine', text: '  locked out' }) : null), btns));
        });
      }
      var right = h('div', { class: 'grid' });
      right.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Standings' }), UI.scoreboard(s, false), hasTie ? h('p', { class: 'fine', text: 'Equal ranks (=) are tied. Tie-breaks apply in this order: ' + s.scoring.order.map(function (o) { return S.ORDER_LABEL[o]; }).join(', then ') + '.' }) : null));
      var tb = h('div', { class: 'card' }, h('h3', { text: 'Tie-break question' }),
        h('p', { class: 'fine', text: 'Ask a number question ("How many...?"). Enter the true answer, then each tied team\'s guess. Closest wins.' }));
      var tq = h('input', { type: 'text', value: s.tb.q, 'aria-label': 'Tie-break question', placeholder: 'Question', onchange: function (e) { H.apply('tbSet', { q: e.target.value, answer: s.tb.answer }); } });
      var ta = h('input', { type: 'text', value: s.tb.answer, 'aria-label': 'Tie-break true answer', placeholder: 'True answer (number)', onchange: function (e) { H.apply('tbSet', { q: s.tb.q, answer: e.target.value }); } });
      tb.appendChild(tq); tb.appendChild(h('div', { style: { height: '8px' } })); tb.appendChild(ta);
      s.teams.forEach(function (t) { tb.appendChild(h('div', { class: 'field inline', style: { marginTop: '8px' } }, h('label', { for: 'tb-' + t.id, text: t.name, style: { minWidth: '90px' } }), h('input', { type: 'text', id: 'tb-' + t.id, value: s.tbGuess[t.id] == null ? '' : s.tbGuess[t.id], inputmode: 'decimal', onchange: function (e) { H.apply('tbGuess', { team: t.id, value: e.target.value }); } }))); });
      right.appendChild(tb);
      var set = h('div', { class: 'card' }, h('h3', { text: 'Settings' }));
      set.appendChild(UI.field('Seconds per question', h('input', { type: 'number', min: '5', max: '600', value: String(s.timerSec), onchange: function (e) { H.apply('timerSet', +e.target.value); } }), 'set-sec'));
      set.appendChild(h('div', { class: 'field inline' }, h('input', { type: 'checkbox', id: 'set-choices', checked: s.showChoices, onchange: function () { H.apply('choices'); } }), h('label', { for: 'set-choices', text: 'Show answer choices on the projector' })));
      set.appendChild(h('div', { class: 'field inline' }, h('input', { type: 'checkbox', id: 'set-sound', checked: s.sound !== false, onchange: function (e) { s.sound = e.target.checked; H.commit(); } }), h('label', { for: 'set-sound', text: 'Beep when the timer ends (projector window)' })));
      set.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: function () { H.apply('finish'); } }, 'Finish event now')));
      right.appendChild(set);
      right.appendChild(overlaySettings());
      var ql = h('div', { class: 'card' }, h('h3', { text: 'Questions' }));
      s.rounds.forEach(function (r, ri) {
        ql.appendChild(h('p', { class: 'fine', text: r.name }));
        var box = h('div', { class: 'qlist' });
        for (var i = r.start; i < r.start + r.count; i++) (function (i) {
          var done = s.marks[s.questions[i].id] && Object.keys(s.marks[s.questions[i].id]).length;
          box.appendChild(h('button', { type: 'button', class: (i === s.qi ? 'cur ' : '') + (done ? 'done' : ''), 'aria-label': 'Go to question ' + (i + 1), onclick: function () { H.apply('goto', i); } }, String(i + 1)));
        })(i);
        ql.appendChild(box);
      });
      right.appendChild(ql);
      root.appendChild(h('div', { class: 'ctl' }, left, right));
      tickFn();
    }
    function overlaySettings() {
      var O = S.load('overlay'), box = h('details', { class: 'card' }, h('summary', { text: 'Stream overlay settings' }));
      function sv() { if (!S.save('overlay', O)) UI.toast('Could not save the overlay settings.'); }
      box.appendChild(h('p', { class: 'fine', text: 'Open the stream overlay window and capture it in your streaming software (window capture with a colour key on green, or a browser source with a clear background).' }));
      box.appendChild(UI.field('Background', UI.select([['green', 'Green screen (colour key)'], ['clear', 'Clear (browser source)'], ['dark', 'Dark (plain window)']], O.bg, function (e) { O.bg = e.target.value; sv(); }), 'ov-bg'));
      box.appendChild(UI.field('Position', UI.select([['bottom', 'Lower third'], ['top', 'Top band']], O.pos, function (e) { O.pos = e.target.value; sv(); }), 'ov-pos'));
      [['question', 'Show the question'], ['timer', 'Show the timer'], ['board', 'Show the standings']].forEach(function (x) { box.appendChild(UI.check('ov-' + x[0], x[1], O[x[0]], function (v) { O[x[0]] = v; sv(); })); });
      box.appendChild(UI.field('Ticker text (sponsors, wifi, next event)', h('input', { type: 'text', value: O.ticker, maxlength: '300', onchange: function (e) { O.ticker = e.target.value.trim(); sv(); } }), 'ov-ticker'));
      return box;
    }
    function tickFn() {
      var s = H.s; if (!s) return; var rem = S.game.remaining(s, Date.now());
      timerEls.forEach(function (e) { e.textContent = S.fmtTime(rem); });
      if (s.timer.running && rem <= 0) H.apply('timerEnd');
      var c = document.getElementById('conn'); if (c) { var live = Date.now() - H.lastPing < 7000; c.lastChild.nodeValue = live ? 'Projector connected' : 'Projector not detected'; c.firstChild.className = 'live' + (live ? ' on' : ''); }
    }
    H.render = build; build();
    H.post({ type: 'state', state: H.s });
    tick = setInterval(tickFn, 250); keyFn = key; g.addEventListener('keydown', keyFn);
    UI.onLeave(function () { clearInterval(tick); g.removeEventListener('keydown', keyFn); H.render = null; H.isControl = false; H.close(); });
  };

  /* ---------------- presenter (projector) ---------------- */
  UI.routes.present = function (root) {
    H.isControl = false; H.open(); H.load();
    var els = {}, beepedRev = -1, tick, ping, keyFn;
    function build() {
      var s = H.s; UI.clear(root); els = {};
      var box = h('div', { class: 'pres' }); root.appendChild(box);
      if (!s) { box.appendChild(h('div', { class: 'pbody' }, h('div', { class: 'ptitle', text: 'Stark Event Kit' }), h('div', { class: 'psub', text: 'Waiting for the host panel. Open it in your other window and set up an event.' }))); return; }
      var q = S.game.cur(s), rd = q ? s.rounds[q.round] : null;
      var top = h('div', { class: 'ptop' }, h('span', { text: s.name }), h('span', { text: s.phase === 'question' || s.phase === 'reveal' ? (rd ? rd.name : '') + '  -  Question ' + (s.qi + 1) + ' of ' + s.questions.length : '' }));
      box.appendChild(top);
      if (s.phase === 'title') {
        box.appendChild(h('div', { class: 'pbody' }, h('div', { class: 'ptitle', text: s.name }), h('div', { class: 'psub', text: s.teams.length + ' teams  -  ' + s.rounds.length + ' round' + (s.rounds.length === 1 ? '' : 's') + '  -  ' + s.questions.length + ' questions' }),
          h('div', { class: 'row' }, s.teams.map(function (t) { return h('span', { class: 'pchip', text: t.name, style: { color: t.color } }); }))));
      } else if ((s.phase === 'question' || s.phase === 'reveal') && q) {
        var rev = s.phase === 'reveal', tr = H.turn(s);
        var chips = h('div', { class: 'row' }, h('span', { class: 'pchip', text: S.catName(q.cat), style: { color: S.catColor(q.cat) } }), h('span', { class: 'pchip', text: q.diff + ' - ' + S.points(s.scoring, q, 0) + ' pt' }));
        if (tr) chips.appendChild(h('span', { class: 'pchip', text: 'Turn: ' + tr.team.name + (tr.member ? ' (' + tr.member + ')' : ''), style: { color: tr.team.color } }));
        var body = h('div', { class: 'pbody' }, chips, h('div', { class: 'pq' + (q.q.length > 90 ? ' long' : ''), text: q.q }));
        if (q.img) body.appendChild(h('img', { class: 'pimg', src: q.img, alt: 'Picture for this question' }));
        if (s.showChoices && q.choices.length) body.appendChild(h('div', { class: 'pch' }, q.choices.map(function (c, i) { return h('div', { class: 'pc' + (rev ? (i === q.ans ? ' right' : ' dim') : '') }, h('b', { text: 'ABCDEF'.charAt(i) }), h('span', { text: c })); })));
        if (rev) { if (!(s.showChoices && q.choices.length)) body.appendChild(h('div', { class: 'pans', text: q.a })); if (q.src) body.appendChild(h('div', { class: 'psrc', text: 'Source note: ' + q.src })); }
        if (s.buzzed) { var bt = s.teams.filter(function (t) { return t.id === s.buzzed; })[0]; body.appendChild(h('div', { class: 'buzz', text: bt.name + ' buzzed in!' })); }
        else if (s.locked.length && !rev) body.appendChild(h('div', { class: 'psrc', text: 'Locked out: ' + s.teams.filter(function (t) { return s.locked.indexOf(t.id) >= 0; }).map(function (t) { return t.name; }).join(', ') }));
        box.appendChild(body);
        var tn = h('span', { class: 'tnum' }), tb = h('i'), bar = h('div', { class: 'tbar' }, tb);
        els.tn = tn; els.tb = tb; els.bar = bar; box.appendChild(h('div', { class: 'ptimer' }, tn, bar));
      } else if (s.phase === 'scores') {
        box.appendChild(h('div', { class: 'pbody' }, h('div', { class: 'ptitle', text: s.roundEnd && rd ? 'After ' + rd.name : 'Scoreboard', style: { fontSize: 'calc(var(--u) * 5)' } }), UI.scoreboard(s, true)));
      } else if (s.phase === 'final') {
        var rows = S.game.standings(s), pod = h('div', { class: 'podium' });
        rows.slice(0, 3).forEach(function (r, i) {
          pod.appendChild(h('div', { class: 'pod', style: { background: r.team.color, minHeight: (28 - i * 6) + 'vh', order: i === 0 ? 2 : i === 1 ? 1 : 3 } }, h('div', { text: UI.rankLabel(r), style: { fontSize: 'calc(var(--u) * 6)' } }), h('div', { text: r.team.name, style: { fontSize: 'calc(var(--u) * 3)' } }), h('div', { text: r.team.score + ' pts', style: { fontSize: 'calc(var(--u) * 2.4)' } })));
        });
        var notes = rows.filter(function (r, i) { return i < 3 && r.by && r.by !== 'score'; }).map(function (r) { return r.team.name + ' placed ahead on ' + S.ORDER_LABEL[r.by] + '.'; });
        box.appendChild(h('div', { class: 'pbody' }, h('div', { class: 'ptitle', text: 'Final results', style: { fontSize: 'calc(var(--u) * 5)' } }), pod, notes.length ? h('div', { class: 'psrc', text: notes.join(' ') }) : null, rows.length > 3 ? UI.scoreboard({ teams: s.teams, scoring: s.scoring }, true) : null));
      }
      box.appendChild(h('div', { class: 'hint', text: 'F fullscreen  -  controlled from the host panel' }));
      tickFn();
    }
    function tickFn() {
      var s = H.s; if (!s || !els.tn) return;
      var rem = S.game.remaining(s, Date.now()), dur = s.timer.dur || 1, low = rem <= 5 && s.phase === 'question' && s.timer.running;
      els.tn.textContent = S.fmtTime(rem); els.tn.className = 'tnum' + (low ? ' low' : '');
      els.tb.style.width = Math.max(0, Math.min(100, rem / dur * 100)) + '%'; els.bar.className = 'tbar' + (low ? ' low' : '');
      if (s.timer.running && rem <= 0 && beepedRev !== s.rev && s.sound !== false) { beepedRev = s.rev; UI.beep(520, 500); }
    }
    function key(e) {
      var s = H.s, k = e.key; if (!s || e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'f' || k === 'F') { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (x) { /* ignore */ } }
      else if (k === 'ArrowRight' || k === 'n' || k === 'N') H.send('next');
      else if (k === 'ArrowLeft' || k === 'b' || k === 'B') H.send('prev');
      else if (k === 'r' || k === 'R') H.send('reveal');
      else if (k === 't' || k === 'T') H.send(s.timer.running ? 'timerPause' : 'timerStart');
      else if (k === 's' || k === 'S') H.send('scores');
      else if (/^[1-9]$/.test(k) && s.mode === 'buzzer' && s.teams[+k - 1]) H.send('buzz', s.teams[+k - 1].id);
    }
    H.render = build; build();
    H.post({ type: 'hello' }); H.post({ type: 'ping' });
    ping = setInterval(function () { H.post({ type: 'ping' }); }, 2500); tick = setInterval(tickFn, 200);
    keyFn = key; g.addEventListener('keydown', keyFn);
    UI.onLeave(function () { clearInterval(tick); clearInterval(ping); g.removeEventListener('keydown', keyFn); H.render = null; H.close(); });
  };
})(window);
