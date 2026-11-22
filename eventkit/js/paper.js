/* Stark Event Kit paper play: printable answer sheets and A/B/C/D answer cards (A4 or US Letter), and scoring a round from
   the sheets teams hand in. Pure logic, no DOM, no network. Teams answer on paper; the host types the answers in. Phones
   cannot join: there is no server. */
(function (g) {
  'use strict';
  var S = g.SEK, P = S.paper = {};
  function trim(v) { return (v == null ? '' : String(v)).trim(); }

  /* ---------- paper sizes and how much fits ---------- */
  P.PAPERS = { a4: { id: 'a4', label: 'A4', w: 210, h: 297 }, letter: { id: 'letter', label: 'US Letter', w: 215.9, h: 279.4 } };
  P.MARGIN_MM = 12;     // matches the named @page rules in css/app.css
  P.HEADER_MM = 42;     // brand line, event, round and the team line
  P.TIE_MM = 28;        // the tie-break box
  P.ROW_MM = { lines: 11, card: 10, questions: 24 };       // the least a row needs
  P.ROW_MAX = { lines: 15, card: 13, questions: 24 };      // how much a short round may spread out
  P.STYLES = [['lines', 'Numbered answer lines'], ['card', 'A / B / C / D answer card'], ['questions', 'Questions printed with choices']];
  P.MAX_COLS = 4;
  // Letter for the places that print on it (US, Canada, Mexico, Philippines); A4 everywhere else. The host can change it.
  P.defaultPaper = function (locale) { return /^(en-(US|CA|PH)|es-(US|MX)|fil-PH)$/i.test(locale || '') ? 'letter' : 'a4'; };
  P.paper = function (id) { return P.PAPERS[id] || P.PAPERS.a4; };
  /* ---------- the one paper setting: chosen once, remembered on this computer, obeyed by everything that prints ---------- */
  P.KEY = 'sek.paper';
  P.current = function () {
    var saved = ''; try { saved = g.localStorage.getItem(P.KEY) || ''; } catch (e) { /* default */ }
    return P.PAPERS[saved] ? saved : P.defaultPaper(g.navigator && g.navigator.language);
  };
  // The page size reaches the printer through a named @page chosen by html[data-paper] in css/app.css.
  P.apply = function () {
    var d = g.document, id = P.current(), sel;
    if (!d || !d.documentElement) return id;
    d.documentElement.setAttribute('data-paper', id);
    sel = d.getElementById('paper-select'); if (sel && sel.value !== id) sel.value = id;
    return id;
  };
  P.choose = function (id) { id = P.PAPERS[id] ? id : P.current(); try { g.localStorage.setItem(P.KEY, id); } catch (e) { /* kept for this visit only */ } P.apply(); return id; };

  // Columns needed so n rows fit one page of the paper; the questions style stays one column and splits across pages instead.
  P.fit = function (paperId, n, style, tie) {
    var pp = P.paper(paperId), avail = pp.h - 2 * P.MARGIN_MM, row = P.ROW_MM[style] || P.ROW_MM.lines, extra = P.HEADER_MM + (tie ? P.TIE_MM : 0), cols, maxc = style === 'questions' ? 1 : P.MAX_COLS, rows, used;
    for (cols = 1; cols <= maxc; cols++) {
      rows = Math.ceil(Math.max(1, n) / cols); used = extra + rows * row;
      if (used <= avail) {   // spread the rows over the free height (up to a comfortable maximum) so a short round is easy to write on
        var roomy = Math.min(P.ROW_MAX[style] || row, Math.floor((avail - extra) / rows * 2) / 2), rm = Math.max(row, roomy);
        return { cols: cols, rows: rows, rowMm: rm, usedMm: extra + rows * rm, availMm: avail, fits: true };
      }
    }
    rows = Math.ceil(Math.max(1, n) / maxc);
    return { cols: maxc, rows: rows, rowMm: row, usedMm: extra + rows * row, availMm: avail, fits: false };
  };
  // Questions per sheet: all of them when they fit, otherwise the largest block that does (the tie-break box is always allowed for).
  P.perSheet = function (paperId, n, style, tie) {
    var m = Math.max(1, n);
    if (P.fit(paperId, m, style, tie).fits) return m;
    while (m > 1 && !P.fit(paperId, m, style, true).fits) m--;
    return m;
  };

  /* ---------- sheets: a plain description of every page, drawn by js/paperui.js ---------- */
  // model: { name, teams: [names] | null, rounds: [{ name, qs: [{ q, choices, ans, open, a, src }] }] }
  // o: { paper, style, copies (blank sheets when there are no teams), tie, key, order: 'team' | 'round' }
  P.pages = function (model, o) {
    var out = [], who = model.teams && model.teams.length ? model.teams : null, n = who ? who.length : Math.max(1, o.copies | 0), style = o.style || 'lines', paperId = P.paper(o.paper).id, order = o.order === 'round' ? 'round' : 'team';
    var lastRound = model.rounds.length - 1;
    function sheetsFor(ri, i) {
      var rd = model.rounds[ri], per = P.perSheet(paperId, rd.qs.length, style, o.tie && ri === lastRound), parts = Math.max(1, Math.ceil(rd.qs.length / per)), list = [], k;
      for (k = 0; k < parts; k++) {
        var from = k * per, to = Math.min(rd.qs.length, from + per), isLast = ri === lastRound && k === parts - 1, tie = !!o.tie && isLast, f = P.fit(paperId, to - from, style, tie);
        list.push({ type: 'sheet', paper: paperId, style: style, team: who ? who[i] : '', blank: !who, copy: i + 1, round: rd.name, ri: ri, part: k + 1, parts: parts, from: from, to: to,
          qs: rd.qs.slice(from, to).map(function (q, j) { return { n: from + j + 1, q: q.q, choices: q.choices || [], open: !(q.choices && q.choices.length) }; }),
          tie: tie, cols: f.cols, rows: f.rows, rowMm: f.rowMm, fits: f.fits });
      }
      return list;
    }
    var i, ri;
    if (order === 'round') { for (ri = 0; ri < model.rounds.length; ri++) for (i = 0; i < n; i++) out = out.concat(sheetsFor(ri, i)); }
    else for (i = 0; i < n; i++) for (ri = 0; ri < model.rounds.length; ri++) out = out.concat(sheetsFor(ri, i));
    if (o.key) out.push({ type: 'key', paper: paperId, name: model.name, rounds: model.rounds.map(function (rd) { return { name: rd.name, qs: rd.qs.map(function (q, k) { return { n: k + 1, a: q.a, src: q.src || '', letter: q.choices && q.choices.length && q.ans >= 0 ? 'ABCDEF'.charAt(q.ans) : '' }; }) }; }) });
    return out;
  };

  /* ---------- scoring a round from the sheets ---------- */
  // One character per question: a choice letter (A to D) for a multiple-choice question, 1 or 0 for an open question the host judged
  // (also Y/N, +/x), and - or . for no answer. Spaces and commas are ignored. Fewer characters than questions is fine: the rest stay unanswered.
  P.clean = function (text) { return String(text == null ? '' : text).toUpperCase().replace(/[\s,]+/g, ''); };
  P.parse = function (text, qs) {
    var t = P.clean(text), marks = [], i, ch, q, idx, err = null;
    if (t.length > qs.length) return { marks: [], err: { pos: qs.length, msg: 'Too many answers: this round has ' + qs.length + ' question' + (qs.length === 1 ? '' : 's') + '.' }, text: t, done: false };
    for (i = 0; i < qs.length; i++) {
      if (i >= t.length) { marks.push(null); continue; }
      ch = t.charAt(i); q = qs[i];
      if (ch === '-' || ch === '.' || ch === '_') { marks.push(null); continue; }
      if (q.choices && q.choices.length) {
        idx = 'ABCDEF'.indexOf(ch);
        if (idx < 0 || idx >= q.choices.length) { err = { pos: i, msg: 'Question ' + (i + 1) + ': type a letter from A to ' + 'ABCDEF'.charAt(q.choices.length - 1) + ', or - for no answer (you typed ' + ch + ').' }; break; }
        marks.push(idx === q.ans ? 'right' : 'wrong');
      } else {
        if ('1Y+'.indexOf(ch) >= 0) marks.push('right');
        else if ('0NX'.indexOf(ch) >= 0) marks.push('wrong');
        else { err = { pos: i, msg: 'Question ' + (i + 1) + ' has no choices: type 1 for right, 0 for wrong, or - for no answer (you typed ' + ch + ').' }; break; }
      }
    }
    return err ? { marks: [], err: err, text: t, done: false } : { marks: marks, err: null, text: t, done: t.length === qs.length };
  };
  P.roundQs = function (s, ri) { return s.questions.filter(function (q) { return q.round === ri; }); };
  // Records one team's sheet for one round. A blank sheet clears it. Returns { ok } or { err }. Marks from live play on the same
  // questions are replaced for that team only.
  P.setEntry = function (s, teamId, ri, text) {
    var qs = P.roundQs(s, ri), r = P.parse(text, qs), k;
    if (r.err) return { err: r.err.msg };
    if (!s.teams.some(function (t) { return t.id === teamId; })) return { err: 'No such team.' };
    s.paper = s.paper || {}; s.paper[teamId] = s.paper[teamId] || {};
    if (r.text) s.paper[teamId][ri] = r.text; else delete s.paper[teamId][ri];
    qs.forEach(function (q, i) {
      var m = s.marks[q.id] = s.marks[q.id] || {};
      if (r.marks[i]) m[teamId] = { r: r.marks[i], f: 0, src: 'paper' }; else delete m[teamId];
      if (!Object.keys(m).length) delete s.marks[q.id];
    });
    S.game.recompute(s); s.rev = (s.rev | 0) + 1;
    return { ok: true, done: r.done };
  };
  P.entry = function (s, teamId, ri) { return ((s.paper || {})[teamId] || {})[ri] || ''; };
  // Tie-break: the host's true answer, and each team's guess from its sheet.
  P.setTieAnswer = function (s, text) { s.tb = { q: (s.tb && s.tb.q) || '', answer: trim(text) }; S.game.recompute(s); s.rev = (s.rev | 0) + 1; return true; };
  P.setTieGuess = function (s, teamId, text) {
    var v = trim(text).replace(/,/g, '');
    if (v !== '' && !isFinite(parseFloat(v))) return { err: 'A tie-break guess is a number.' };
    if (v === '') delete s.tbGuess[teamId]; else s.tbGuess[teamId] = v;
    S.game.recompute(s); s.rev = (s.rev | 0) + 1; return { ok: true };
  };
  // Points one team earned in one round (same arithmetic as S.game.recompute, without the host's manual adjustments).
  P.roundPoints = function (s, teamId, ri) {
    var pts = 0, right = 0, answered = 0;
    P.roundQs(s, ri).forEach(function (q) {
      var m = (s.marks[q.id] || {})[teamId]; if (!m) return;
      answered++;
      if (m.r === 'right') { pts += S.points(s.scoring, q, m.f); right++; } else if (m.r === 'wrong') pts -= (+s.scoring.penalty || 0);
    });
    return { pts: pts, right: right, answered: answered };
  };
  // The leaderboard: ranked rows with each round's points, the adjustments, the total and what the tie-break rules say.
  P.board = function (s) {
    var rows = S.game.standings(s);
    return rows.map(function (r) {
      var t = r.team, per = s.rounds.map(function (rd, ri) { return P.roundPoints(s, t.id, ri).pts; });
      return { rank: r.rank, tied: r.tied, by: r.by, team: t, rounds: per, adj: s.adj[t.id] | 0, total: t.score, correct: t.correct, tb: s.tbGuess[t.id] == null ? '' : String(s.tbGuess[t.id]), tbDist: t.tbDist };
    });
  };
  // How many teams have a sheet entered for each round, so the host sees what is still missing.
  P.progress = function (s) { return s.rounds.map(function (rd, ri) { var done = s.teams.filter(function (t) { return P.entry(s, t.id, ri) !== ''; }).length; return { round: rd.name, done: done, of: s.teams.length, complete: done === s.teams.length && s.teams.length > 0 }; }); };
  P.keyLine = function (s, ri) { return P.roundQs(s, ri).map(function (q) { return q.choices && q.choices.length && q.ans >= 0 ? 'ABCDEF'.charAt(q.ans) : q.open ? '?' : '1'; }).join(' '); };
})(typeof window !== 'undefined' ? window : globalThis);
