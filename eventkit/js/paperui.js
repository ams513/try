/* Stark Event Kit paper play screens: answer sheets and A/B/C/D cards (A4 or US Letter), the host scoring screen and the projector leaderboard.
   Teams answer on paper and hand the sheets in; the host types each team's answers with the keyboard. Phones cannot join: there is no server. */
(function (g) {
  'use strict';
  var S = g.SEK, UI = S.ui, h = UI.h, P = S.paper, H = S.host, R = UI.routes, doc = g.document;
  var PX = S.paperui = {}, LETTERS = 'ABCDEF';

  /* ---------- paper choice: remembered on this computer only ---------- */
  PX.pick = P.current;
  PX.remember = P.choose;

  /* ---------- sheets ---------- */
  function lineRow(q, open) { return h('div', { class: 'arow' }, h('strong', { class: 'qn', text: q.n + '.' }), open ? h('div', { class: 'ln' }) : null); }
  function cardRow(q) {
    if (q.open) return h('div', { class: 'arow crow' }, h('strong', { class: 'qn', text: q.n + '.' }), h('span', { class: 'cwrite', text: 'Write:' }), h('div', { class: 'ln' }));
    return h('div', { class: 'arow crow' }, h('strong', { class: 'qn', text: q.n + '.' }), h('span', { class: 'bubs' }, q.choices.map(function (c, i) { return h('span', { class: 'bub', text: LETTERS.charAt(i) }); })));
  }
  function questionRow(q) {
    var blk = h('div', { class: 'qblock' }, h('div', null, h('strong', { text: q.n + '. ' }), q.q));
    if (q.choices.length) blk.appendChild(h('div', { class: 'qchoices' }, q.choices.map(function (c, ci) { return h('span', { class: 'qch' }, h('span', { class: 'bub', text: LETTERS.charAt(ci) }), c); })));
    else blk.appendChild(h('div', { class: 'ansline' }, h('div', { class: 'ln' })));
    return blk;
  }
  PX.sheetEl = function (d, eventName) {
    var pg = h('div', { class: 'paper sheetpg sz-' + d.paper + ' st-' + d.style }), part = d.parts > 1 ? ' (sheet ' + d.part + ' of ' + d.parts + ')' : '';
    var from = d.qs.length ? d.qs[0].n : 0, to = d.qs.length ? d.qs[d.qs.length - 1].n : 0, grid;
    pg.appendChild(h('div', { class: 'brandline', text: 'Stark Event Kit - ' + (d.style === 'card' ? 'answer card' : 'answer sheet') }));
    pg.appendChild(h('h2', { text: eventName }));
    pg.appendChild(h('h3', { text: d.round + part + '  -  questions ' + from + (to > from ? ' to ' + to : '') }));
    pg.appendChild(h('p', { class: 'teamline' }, 'Team: ', d.blank ? h('span', { class: 'blankline' }) : h('strong', { text: d.team }), h('span', { class: 'scoreline', text: 'Score: ____ / ' + d.qs.length })));
    if (d.style === 'questions') grid = h('div', { class: 'qlist' }, d.qs.map(questionRow));
    else {
      grid = h('div', { class: 'ansgrid cols-' + d.cols }, d.qs.map(function (q) { return d.style === 'card' ? cardRow(q) : lineRow(q, true); }));
      grid.style.gridTemplateColumns = 'repeat(' + d.cols + ', 1fr)'; grid.style.gridTemplateRows = 'repeat(' + d.rows + ', ' + d.rowMm + 'mm)'; grid.style.gridAutoFlow = 'column';
    }
    pg.appendChild(grid);
    if (d.style === 'card') pg.appendChild(h('p', { class: 'fine cardnote', text: 'Fill in one circle per question, or write the answer where it says Write. Hand the card to the host at the end of the round.' }));
    if (d.tie) pg.appendChild(h('div', { class: 'tiebox' }, h('strong', { text: 'Tie-break guess (a number):' }), h('span', { class: 'tiefield' })));
    return pg;
  };
  PX.keyEl = function (d) {
    var kp = h('div', { class: 'paper sheetpg sz-' + d.paper + ' st-key' }, h('div', { class: 'brandline', text: 'Stark Event Kit - answer key (host copy)' }), h('h2', { text: d.name }));
    d.rounds.forEach(function (rd) {
      kp.appendChild(h('h3', { text: rd.name }));
      rd.qs.forEach(function (q) { kp.appendChild(h('div', { class: 'keyrow' }, h('strong', { text: q.n + '.' }), h('span', null, (q.letter ? q.letter + ': ' : '') + q.a, q.src ? h('em', { class: 'keysrc', text: '   (' + q.src + ')' }) : null))); });
    });
    return kp;
  };
  // Pages for the results screen: the descriptors from js/paper.js drawn as elements.
  PX.sheets = function (model, o) {
    var pages = P.pages(model, { paper: o.paper, style: o.style, copies: o.copies, tie: o.tie, key: o.key, order: o.order });
    return { desc: pages, els: pages.map(function (d) { return d.type === 'key' ? PX.keyEl(d) : PX.sheetEl(d, model.name); }) };
  };

  /* ---------- the host scoring screen ---------- */
  function pointsText(n) { return (n > 0 ? '+' : '') + n; }
  R.score = function (root) {
    H.isControl = true; H.open(); H.load();
    var s = H.s, ri = 0, rowsEl = {}, boardEl = h('div', { class: 'card' }), progEl = h('div', { class: 'row scoretabs', role: 'tablist' }), keyEl = h('p', { class: 'keyline' }), body = h('div'), keyFn;
    root.appendChild(h('h1', { text: 'Score paper answers' }));
    root.appendChild(h('p', { class: 'muted', text: 'Teams answer on printed sheets or A/B/C/D cards and hand them in. Type each team\'s answers here with the keyboard; totals and the projector leaderboard update as you type. Phones cannot join: there is no server, and nothing leaves this computer.' }));
    if (!s || !s.teams.length || !s.questions.length) {
      root.appendChild(h('div', { class: 'card' }, h('h2', { text: 'No event to score yet' }), h('p', { text: 'Set up an event with teams and rounds, print the sheets from Results and print, then come back here.' }),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/new', text: 'Set up an event' }), h('a', { class: 'btn', href: '#/results?tab=sheets', text: 'Print answer sheets' }))));
      return;
    }
    root.appendChild(body);
    function commit() { H.commit(); }
    function roundQs() { return P.roundQs(s, ri); }
    function inputs() { return Array.prototype.slice.call(body.querySelectorAll('input.ans')); }
    function focusRow(i) { var l = inputs(); if (l[i]) { l[i].focus(); l[i].select(); } }
    function refresh() {
      var board = P.board(s), byId = {}; board.forEach(function (b) { byId[b.team.id] = b; });
      s.teams.forEach(function (t) {
        var e = rowsEl[t.id], rp = P.roundPoints(s, t.id, ri), b = byId[t.id]; if (!e) return;
        e.pts.textContent = P.entry(s, t.id, ri) === '' ? '-' : pointsText(rp.pts); e.right.textContent = P.entry(s, t.id, ri) === '' ? '-' : rp.right + ' right';
        e.total.textContent = String(b.total); e.rank.textContent = (b.tied ? '=' : '') + b.rank;
      });
      UI.clear(progEl);
      P.progress(s).forEach(function (p, i) { progEl.appendChild(h('button', { type: 'button', role: 'tab', 'aria-selected': i === ri ? 'true' : 'false', class: 'btn small' + (i === ri ? ' primary' : ''), onclick: function () { ri = i; draw(); } }, p.round + ' (' + p.done + '/' + p.of + ')' + (p.complete ? ' done' : ''))); });
      UI.clear(boardEl); drawBoard(boardEl, board);
    }
    function drawBoard(box, board) {
      box.appendChild(h('h2', { text: 'Leaderboard' }));
      var heads = ['#', 'Team'].concat(s.rounds.map(function (rd, i) { return 'R' + (i + 1); })).concat(['Total']);
      box.appendChild(h('div', { class: 'scroll-x' }, h('table', { id: 'board-table' }, h('thead', null, h('tr', null, heads.map(function (x) { return h('th', { text: x }); }))),
        h('tbody', null, board.map(function (b) { return h('tr', null, h('td', { text: (b.tied ? '=' : '') + b.rank }), h('td', null, h('span', { class: 'dot', style: { background: b.team.color } }), b.team.name), b.rounds.map(function (p, i) { return h('td', { text: P.entry(s, b.team.id, i) === '' ? '-' : String(p) }); }), h('td', null, h('strong', { text: String(b.total) }))); })))));
      if (board.some(function (b) { return b.tied; })) box.appendChild(h('p', { class: 'fine', text: 'Equal ranks (=) are tied. Tie-break rules: ' + (s.scoring.order || S.DEFAULT_ORDER).map(function (x) { return S.ORDER_LABEL[x]; }).join(', then ') + '.' }));
    }
    function draw() {
      UI.clear(body); rowsEl = {};
      var qs = roundQs(), n = qs.length, rd = s.rounds[ri], tbl = h('tbody');
      body.appendChild(h('div', { class: 'card' }, h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } }, h('h2', { text: 'Round answers' }), h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', id: 'open-board', onclick: function () { var w = null; try { w = g.open(g.location.href.split('#')[0] + '#/leaderboard', 'sek_board', 'popup=yes,width=1280,height=720'); } catch (e) { /* ignore */ } if (!w) UI.toast('The browser blocked the window. Allow pop-ups, or open #/leaderboard in a new window.'); } }, 'Open projector leaderboard'),
        h('a', { class: 'btn', href: '#/leaderboard', target: '_blank', rel: 'noopener', text: 'Leaderboard in a new tab' }))),
      progEl,
      h('p', { class: 'fine' }, 'Round: ', h('strong', { text: rd.name }), ', ' + n + ' question' + (n === 1 ? '' : 's') + '. Type one character per question: a letter for a multiple-choice question, 1 (right) or 0 (wrong) for an open question, - for no answer. ',
        h('kbd', { text: 'Enter' }), ' or ', h('kbd', { text: 'Down' }), ' next team, ', h('kbd', { text: 'Shift+Enter' }), ' or ', h('kbd', { text: 'Up' }), ' previous, ', h('kbd', { text: 'PageDown' }), ' / ', h('kbd', { text: 'PageUp' }), ' next or previous round.'),
      keyEl,
      h('div', { class: 'scroll-x' }, h('table', { id: 'score-table' }, h('thead', null, h('tr', null, ['Team', 'Answers', 'Round points', 'Right', 'Tie-break guess', 'Total', 'Rank'].map(function (x) { return h('th', { text: x }); }))), tbl))));
      keyEl.textContent = 'Answer key (host only): ' + P.keyLine(s, ri);
      s.teams.forEach(function (t, i) {
        var err = h('p', { class: 'field-err', role: 'alert', hidden: true }), saved = P.entry(s, t.id, ri);
        var inp = h('input', { type: 'text', class: 'ans', id: 'ans-' + t.id, maxlength: String(n + 12), autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', value: saved, 'aria-label': 'Answers for ' + t.name + ', ' + rd.name, 'aria-describedby': 'err-' + t.id });
        err.id = 'err-' + t.id;
        var guess = h('input', { type: 'text', class: 'tbg', id: 'tb-' + t.id, inputmode: 'decimal', autocomplete: 'off', value: s.tbGuess[t.id] == null ? '' : String(s.tbGuess[t.id]), 'aria-label': 'Tie-break guess for ' + t.name });
        var e = rowsEl[t.id] = { pts: h('td', { class: 'num' }), right: h('td'), total: h('td', { class: 'num' }), rank: h('td') };
        inp.addEventListener('input', function () {
          var cleaned = P.clean(inp.value), pos = inp.selectionStart; if (cleaned !== inp.value) { inp.value = cleaned; try { inp.setSelectionRange(Math.min(pos, cleaned.length), Math.min(pos, cleaned.length)); } catch (x) { /* ignore */ } }
          var r = P.setEntry(s, t.id, ri, cleaned);
          if (r.err) { err.textContent = r.err; err.hidden = false; inp.setAttribute('aria-invalid', 'true'); return; }
          err.hidden = true; inp.removeAttribute('aria-invalid'); commit(); refresh();
          if (r.done && inp.selectionStart === cleaned.length) focusRow(i + 1);
        });
        inp.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); focusRow(ev.shiftKey ? i - 1 : i + 1); }
          else if (ev.key === 'ArrowDown') { ev.preventDefault(); focusRow(i + 1); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); focusRow(i - 1); }
        });
        guess.addEventListener('change', function () {
          var r = P.setTieGuess(s, t.id, guess.value);
          if (r.err) { UI.toast(r.err, true); guess.setAttribute('aria-invalid', 'true'); return; }
          guess.removeAttribute('aria-invalid'); commit(); refresh();
        });
        tbl.appendChild(h('tr', null, h('td', null, h('span', { class: 'dot', style: { background: t.color } }), h('strong', { text: t.name })), h('td', null, inp, err), e.pts, e.right, h('td', null, guess), e.total, e.rank));
      });
      var ta = h('input', { type: 'text', id: 'tb-answer', inputmode: 'decimal', autocomplete: 'off', value: s.tb && s.tb.answer ? s.tb.answer : '', 'aria-label': 'Tie-break true answer', onchange: function (ev) { P.setTieAnswer(s, ev.target.value); commit(); refresh(); } });
      body.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Tie-break' }), h('p', { class: 'fine', text: 'Only used if teams are level on every rule before it. Enter the true answer (a number) and each team\'s guess from its sheet; the closest guess ranks higher.' }), UI.field('True answer', ta)));
      body.appendChild(boardEl);
      refresh();
      var first = inputs()[0]; if (first && !g.__scoreNoFocus) first.focus();
    }
    keyFn = function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'PageDown' && ri + 1 < s.rounds.length) { ev.preventDefault(); ri++; draw(); } else if (ev.key === 'PageUp' && ri > 0) { ev.preventDefault(); ri--; draw(); }
    };
    g.addEventListener('keydown', keyFn);
    UI.onLeave(function () { g.removeEventListener('keydown', keyFn); H.close(); });
    draw();
  };

  /* ---------- projector leaderboard: its own window, follows the host's scoring ---------- */
  R.leaderboard = function (root) {
    H.isControl = false; H.open(); H.load();
    var tick;
    function build() {
      var s = H.s; UI.clear(root);
      var box = h('div', { class: 'pres lbpres' }); root.appendChild(box);
      if (!s) { box.appendChild(h('div', { class: 'pbody' }, h('div', { class: 'ptitle', text: 'Stark Event Kit' }), h('div', { class: 'psub', text: 'Waiting for the host. Open Score paper answers on the host computer.' }))); return; }
      var board = P.board(s), prog = P.progress(s), max = Math.max(1, Math.max.apply(null, board.map(function (b) { return b.total; }))), scored = prog.filter(function (p) { return p.done > 0; });
      var last = scored.length ? scored[scored.length - 1] : null;
      box.appendChild(h('div', { class: 'ptop' }, h('span', { text: s.name }), h('span', { text: last ? (last.complete ? 'After ' : 'Scoring ') + last.round : 'Leaderboard' })));
      box.appendChild(h('div', { class: 'pbody' }, h('div', { class: 'ptitle lbtitle', text: 'Leaderboard' }),
        h('div', { class: 'lbrows' }, board.map(function (b) {
          var w = Math.max(3, Math.round(Math.max(0, b.total) / max * 100)), bar = h('i'); bar.style.width = w + '%'; bar.style.background = b.team.color;
          var rp = h('span', { class: 'lbrounds', text: b.rounds.map(function (p, i) { return P.entry(s, b.team.id, i) === '' ? '' : 'R' + (i + 1) + ' ' + p; }).filter(Boolean).join('  -  ') });
          return h('div', { class: 'lbrow' }, h('span', { class: 'lbrank', text: (b.tied ? '=' : '') + b.rank }), h('div', { class: 'lbname' }, h('span', { class: 'lbteam', text: b.team.name }), rp), h('div', { class: 'sbar' }, bar), h('span', { class: 'lbtotal', text: String(b.total) }));
        })),
        board.some(function (b) { return b.tied; }) ? h('div', { class: 'psrc', text: 'Equal ranks (=) are level. The tie-break rules decide the final order.' }) : null));
      box.appendChild(h('div', { class: 'hint', text: 'F fullscreen  -  follows the host\'s scoring screen' }));
    }
    function key(e) { if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) { try { if (doc.fullscreenElement) doc.exitFullscreen(); else doc.documentElement.requestFullscreen(); } catch (x) { /* ignore */ } } }
    H.render = build; build();
    H.post({ type: 'hello' });
    tick = setInterval(function () { H.post({ type: 'ping' }); }, 2500);
    g.addEventListener('keydown', key);
    UI.onLeave(function () { clearInterval(tick); g.removeEventListener('keydown', key); H.render = null; H.close(); });
  };
})(window);
