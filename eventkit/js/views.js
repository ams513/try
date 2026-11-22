/* Stark Event Kit views: home, event setup, templates, question bank and editor. */
(function (g) {
  'use strict';
  var S = g.SEK, UI = S.ui, h = UI.h, R = UI.routes, doc = g.document;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function catOptions(extra) { return [['all', 'All categories']].concat(S.CATS.map(function (c) { return [c.id, c.name]; })).concat(extra || []); }

  /* ---------- home ---------- */
  R.home = function (root) {
    var game = S.store.get('game', null), n = S.builtin().length;
    root.appendChild(h('section', { class: 'hero' }, h('h1', { text: 'Run a great event, offline.' }),
      h('p', { text: 'Quiz nights, trivia, buzzer rounds, game jams and tournaments. A projector view for the room, a host panel for you, and everything saved on this computer.' }),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/new', text: 'Set up an event' }), h('a', { class: 'btn', href: '#/templates', text: 'Business and school templates' }),
        game ? h('a', { class: 'btn', href: '#/control', text: 'Resume: ' + game.name }) : null),
      h('p', { class: 'fine', style: { marginTop: '10px' }, text: n + ' built-in questions, ' + S.CATS.length + ' categories, 3 difficulties. No account, no network.' })));
    var f = [
      ['Two windows, one machine', 'Put the big question display on the projector and keep the host panel with the answers on your own screen. They stay in sync with no network.', '#/new'],
      ['Question banks', n + ' original questions with sources noted where a fact needs one. Add your own, attach pictures, import and export JSON or CSV.', '#/bank'],
      ['Every format', 'Pub quiz rounds, buzzer-style, picture rounds, team mode with turns, and a seeded bracket tournament for 2 to 128 teams with byes.', '#/bracket'],
      ['Game jam mode', 'Theme generator, countdown timer, submission checklist and a weighted judging rubric with printable score sheets.', '#/jam'],
      ['Results and print', 'Answer sheets, answer keys, certificates and a results export, all print-ready on plain paper.', '#/results'],
      ['Templates', 'Team-building hours, department showdowns, classroom reviews, exit tickets, raffle nights and league seasons, ready to run.', '#/templates'],
      ['Guests and check-in', 'Registration with capacity and a waiting list, ticket types, fast door check-in, CSV import and a printable sign-in sheet.', '#/plan'],
      ['Seating and run of show', 'Table planner that keeps parties together, a timed running order with live late or early tracking, budget and volunteer roster.', '#/plan?tab=seating'],
      ['Provable prize draw', 'A raffle anyone can verify: the fingerprint of a secret number is shown before the draw and the number is revealed after.', '#/raffle'],
      ['Leagues and seasons', 'Round-robin fixtures with a live league table, and a season ladder that adds up every quiz night.', '#/league'],
      ['Stream overlay', 'A lower-third scoreboard, question and timer window for streaming software, synced to the host panel.', '#/control'],
      ['Badges and backup', 'Name badges for every guest, certificate designs, and one-file backup and restore of everything.', '#/results?tab=badges']
    ];
    root.appendChild(h('div', { class: 'grid g3' }, f.map(function (x) { return h('a', { class: 'card feature', href: x[2], style: { textDecoration: 'none', color: 'inherit' } }, h('h3', { text: x[0] }), h('p', { class: 'muted', text: x[1] })); })));
    root.appendChild(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Quick start' }),
      h('div', { class: 'row' }, [['pub', 'Pub quiz'], ['buzzer', 'Buzzer round'], ['picture', 'Picture round'], ['team', 'Team mode']].map(function (x) { return h('a', { class: 'btn', href: '#/new?fmt=' + x[0], text: x[1] }); }))));
    root.appendChild(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Keep your data safe' }),
      h('p', { class: 'muted', text: 'Everything is stored in this browser on this computer. Download one backup file before clearing the browser or moving to another machine.' }),
      h('a', { class: 'btn', href: '#/backup', text: 'Back up or restore' })));
  };

  /* ---------- templates ---------- */
  R.templates = function (root) {
    root.appendChild(h('h1', { text: 'Business and school templates' }));
    root.appendChild(h('p', { class: 'muted', text: 'Each template fills in the rounds, scoring and timing for you. Adjust anything before you start.' }));
    [['business', 'Business and team-building'], ['school', 'Classroom and school'], ['community', 'Community, charity and leagues']].forEach(function (k) {
      root.appendChild(h('h2', { text: k[1], style: { marginTop: '18px' } }));
      root.appendChild(h('div', { class: 'grid g2' }, S.TEMPLATES.filter(function (t) { return t.kind === k[0]; }).map(function (t) {
        return h('div', { class: 'card' }, h('h3', { text: t.name }), h('p', { class: 'muted', text: t.blurb }),
          h('p', { class: 'fine', text: 'About ' + t.minutes + ' minutes.' }),
          h('details', null, h('summary', { text: 'Suggested agenda' }), h('ul', null, t.agenda.map(function (a) { return h('li', { text: a }); }))),
          h('div', { class: 'row', style: { marginTop: '10px' } }, h('a', { class: 'btn primary', href: t.link || ('#/new?tpl=' + t.id), text: t.link ? 'Open the tool' : 'Use this template' })));
      })));
    });
  };

  /* ---------- event setup ---------- */
  var PRESETS = {
    pub: { mode: 'pub', showChoices: false, timerSec: 30, penalty: 0, bonus: 0, rounds: [{ name: 'Round 1', type: 'quiz', cat: 'all', diff: 'mixed', count: 8 }, { name: 'Round 2', type: 'quiz', cat: 'all', diff: 'mixed', count: 8 }, { name: 'Round 3', type: 'quiz', cat: 'all', diff: 'mixed', count: 8 }] },
    buzzer: { mode: 'buzzer', showChoices: true, timerSec: 15, penalty: 1, bonus: 1, rounds: [{ name: 'Buzzer round 1', type: 'quiz', cat: 'all', diff: 'mixed', count: 10 }, { name: 'Buzzer round 2', type: 'quiz', cat: 'all', diff: 'mixed', count: 10 }] },
    picture: { mode: 'picture', showChoices: true, timerSec: 30, penalty: 0, bonus: 0, rounds: [{ name: 'Picture round', type: 'picture', cat: 'all', diff: 'mixed', count: 6 }, { name: 'General round', type: 'quiz', cat: 'all', diff: 'mixed', count: 8 }] },
    team: { mode: 'team', showChoices: true, timerSec: 30, penalty: 0, bonus: 0, rounds: [{ name: 'Round 1', type: 'quiz', cat: 'all', diff: 'mixed', count: 8 }, { name: 'Round 2', type: 'quiz', cat: 'all', diff: 'mixed', count: 8 }, { name: 'Round 3', type: 'quiz', cat: 'all', diff: 'mixed', count: 8 }] }
  };
  function teamsText(n, members) { var out = []; for (var i = 1; i <= n; i++) out.push('Team ' + i + (members ? ': ' : '')); return out.join('\n'); }
  function parseTeams(text) {
    return text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 24).map(function (l) {
      var p = l.split(':'); return { name: p[0].trim(), members: p.length > 1 ? p.slice(1).join(':').split(',').map(function (m) { return m.trim(); }).filter(Boolean) : [] };
    });
  }
  R.new = function (root, q) {
    var tpl = q.tpl ? S.TEMPLATES.filter(function (t) { return t.id === q.tpl; })[0] : null, fmt = PRESETS[q.fmt] ? q.fmt : 'pub', d;
    if (tpl && tpl.cfg) {
      var c = clone(tpl.cfg), sc = c.scoring || {};
      d = { name: c.name, mode: c.mode, showChoices: c.showChoices, timerSec: c.timerSec, penalty: sc.penalty || 0, bonus: sc.bonus || 0, rounds: c.rounds, pts: sc.pts || { easy: 1, medium: 2, hard: 3 }, teamsText: teamsText(c.teams, c.mode === 'team') };
    } else {
      var p = clone(PRESETS[fmt]); d = { name: 'Quiz night', mode: p.mode, showChoices: p.showChoices, timerSec: p.timerSec, penalty: p.penalty, bonus: p.bonus, rounds: p.rounds, pts: { easy: 1, medium: 2, hard: 3 }, teamsText: teamsText(5, p.mode === 'team') };
    }
    d.autoTimer = false; d.includeCustom = true; d.openPresenter = true;
    function guestTeams() {
      var G = S.load('guests'), anyIn = G.people.some(function (p) { return p.status === 'registered' && p.inAt; }), t = S.reg.teams(G, anyIn).slice(0, 24);
      return t.map(function (x) { return x.name + (x.members.length > 1 || x.members[0] !== x.name ? ': ' + x.members.join(', ') : ''); }).join('\n');
    }
    if (q.from === 'guests') { var gt = guestTeams(); if (gt) d.teamsText = gt; }
    var picCount = S.custom.all().filter(function (x) { return x.img; }).length;

    function draw() {
      UI.clear(root);
      root.appendChild(h('h1', { text: tpl ? tpl.name : 'Set up an event' }));
      if (tpl) root.appendChild(h('p', { class: 'muted', text: tpl.blurb }));
      var form = h('div', { class: 'grid g2' });
      var a = h('div', { class: 'card' }, h('h2', { text: '1. Format and teams' }));
      a.appendChild(UI.field('Event name', h('input', { type: 'text', value: d.name, maxlength: '80', oninput: function (e) { d.name = e.target.value; } }), 'f-name'));
      a.appendChild(UI.field('Format', UI.select([['pub', 'Pub quiz (written answers)'], ['buzzer', 'Buzzer-style'], ['picture', 'Picture rounds'], ['team', 'Team mode (turns and steals)']], d.mode, function (e) {
        var p = clone(PRESETS[e.target.value]); d.mode = p.mode; d.showChoices = p.showChoices; d.timerSec = p.timerSec; d.penalty = p.penalty; d.bonus = p.bonus; d.rounds = p.rounds; draw();
      }), 'f-mode'));
      a.appendChild(UI.field('Teams, one per line. In team mode add players after a colon: Falcons: Ana, Raj, Kim', h('textarea', { rows: '8', oninput: function (e) { d.teamsText = e.target.value; } }, d.teamsText), 'f-teams'));
      a.appendChild(h('button', { type: 'button', class: 'btn small', id: 'f-from-guests', onclick: function () { var gt = guestTeams(); if (!gt) { UI.toast('No booked guests yet. Add them in the Planner.'); return; } d.teamsText = gt; draw(); } }, 'Fill from the guest list (checked-in first)'));
      form.appendChild(a);
      var b = h('div', { class: 'card' }, h('h2', { text: '2. Scoring and timing' }));
      var pts = h('div', { class: 'row' }, S.DIFFS.map(function (k) { return h('div', { class: 'field', style: { width: '90px' } }, h('label', { for: 'pts-' + k, text: k + ' pts' }), h('input', { type: 'number', min: '0', max: '20', id: 'pts-' + k, value: String(d.pts[k]), onchange: function (e) { d.pts[k] = +e.target.value; } })); }));
      b.appendChild(pts);
      b.appendChild(UI.field('Points lost for a wrong answer', h('input', { type: 'number', min: '0', max: '10', value: String(d.penalty), onchange: function (e) { d.penalty = +e.target.value; } }), 'f-pen'));
      b.appendChild(UI.field('Speed bonus (extra points for a fast correct answer, buzzer and team mode)', h('input', { type: 'number', min: '0', max: '10', value: String(d.bonus), onchange: function (e) { d.bonus = +e.target.value; } }), 'f-bonus'));
      b.appendChild(UI.field('Seconds per question', h('input', { type: 'number', min: '5', max: '600', value: String(d.timerSec), onchange: function (e) { d.timerSec = +e.target.value; } }), 'f-sec'));
      [['showChoices', 'Show answer choices on the projector'], ['autoTimer', 'Start the timer automatically for every question'], ['includeCustom', 'Include my own questions in the draw'], ['openPresenter', 'Open the projector window when I start']].forEach(function (x) {
        b.appendChild(h('div', { class: 'field inline' }, h('input', { type: 'checkbox', id: 'c-' + x[0], checked: d[x[0]], onchange: function (e) { d[x[0]] = e.target.checked; } }), h('label', { for: 'c-' + x[0], text: x[1] })));
      });
      var past = S.pastIds(S.store.get('history', [])), nPast = Object.keys(past).length;
      if (nPast) b.appendChild(h('div', { class: 'field inline' }, h('input', { type: 'checkbox', id: 'c-fresh', checked: d.fresh !== false, onchange: function (e) { d.fresh = e.target.checked; } }),
        h('label', { for: 'c-fresh', text: 'Fresh questions for regulars: skip the ' + nPast + ' question' + (nPast === 1 ? '' : 's') + ' already asked at your past nights (they are only reused, least-asked first, if the bank runs short)' })));
      b.appendChild(h('p', { class: 'fine', text: 'Ties are broken by: ' + S.DEFAULT_ORDER.map(function (o) { return S.ORDER_LABEL[o]; }).join(', then ') + '.' }));
      form.appendChild(b); root.appendChild(form);

      var rc = h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: '3. Rounds' }));
      if (d.rounds.some(function (r) { return r.type === 'picture'; }) && !picCount) rc.appendChild(h('p', { class: 'fine', style: { color: 'var(--warn)' }, text: 'Picture rounds need pictures. Add picture questions in the question editor first, or this round will be empty.' }));
      var sets = [], t = h('div', { class: 'scroll-x' });
      var tbody = h('tbody');
      d.rounds.forEach(function (r, i) {
        var catVal = Array.isArray(r.cat) ? 'set:' + r.cat.join(',') : (r.cat || 'all'), extra = [];
        if (Array.isArray(r.cat)) extra.push([catVal, r.cat.map(S.catName).join(' + ')]);
        tbody.appendChild(h('tr', null,
          h('td', null, h('input', { type: 'text', value: r.name, 'aria-label': 'Round ' + (i + 1) + ' name', onchange: function (e) { r.name = e.target.value; } })),
          h('td', null, UI.select([['quiz', 'Questions'], ['picture', 'Picture'], ['prompts', 'Icebreaker prompts']], r.type || 'quiz', function (e) { r.type = e.target.value; })),
          h('td', null, UI.select(catOptions(extra), catVal, function (e) { var v = e.target.value; r.cat = v.indexOf('set:') === 0 ? v.slice(4).split(',') : v; })),
          h('td', null, UI.select([['mixed', 'Easy to hard'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], r.diff || 'mixed', function (e) { r.diff = e.target.value; })),
          h('td', null, h('input', { type: 'number', min: '1', max: '60', value: String(r.count), 'aria-label': 'Round ' + (i + 1) + ' question count', style: { width: '80px' }, onchange: function (e) { r.count = +e.target.value; } })),
          h('td', null, h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove round ' + (i + 1), onclick: function () { d.rounds.splice(i, 1); draw(); } }, 'Remove'))));
      });
      t.appendChild(h('table', null, h('thead', null, h('tr', null, ['Name', 'Type', 'Category', 'Difficulty', 'Questions', ''].map(function (x) { return h('th', { text: x }); }))), tbody));
      rc.appendChild(t);
      rc.appendChild(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { type: 'button', class: 'btn', onclick: function () { d.rounds.push({ name: 'Round ' + (d.rounds.length + 1), type: 'quiz', cat: 'all', diff: 'mixed', count: 8 }); draw(); } }, 'Add a round')));
      root.appendChild(rc);
      root.appendChild(h('div', { class: 'row end', style: { marginTop: '16px' } }, h('button', { type: 'button', class: 'btn primary', id: 'btn-start-event', onclick: start }, 'Create event and open host panel')));
    }
    function start() {
      var teams = parseTeams(d.teamsText);
      if (teams.length < 2) { UI.toast('Add at least two teams.'); return; }
      if (!d.rounds.length) { UI.toast('Add at least one round.'); return; }
      var cfg = { name: d.name, mode: d.mode, teams: teams, rounds: d.rounds, showChoices: d.showChoices, timerSec: d.timerSec, autoTimer: d.autoTimer,
        scoring: { pts: d.pts, penalty: d.penalty, bonus: d.bonus }, avoid: d.fresh !== false ? S.pastIds(S.store.get('history', [])) : null };
      var s = S.game.create(cfg, d.includeCustom ? S.pool() : S.builtin());
      if (!s.questions.length) { UI.toast('No questions matched. Loosen the category or difficulty.'); return; }
      var want = d.rounds.reduce(function (a, r) { return a + (r.count | 0); }, 0);
      S.store.set('game', s);
      if (s.questions.length < want) UI.toast('Only ' + s.questions.length + ' of ' + want + ' questions were available for those filters.');
      else if (s.fresh && s.fresh.repeats) UI.toast(s.fresh.repeats + ' question' + (s.fresh.repeats === 1 ? ' was' : 's were') + ' reused from past nights because the filters left too few new ones.');
      if (d.openPresenter) S.host.openPresenter();
      UI.go('#/control');
    }
    draw();
  };

  /* ---------- question bank and editor ---------- */
  function readImage(file, cb) {
    var fr = new g.FileReader();
    fr.onload = function () {
      var img = new g.Image();
      img.onload = function () {
        var max = 1100, k = Math.min(1, max / Math.max(img.width, img.height)), c = doc.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var url = c.toDataURL('image/jpeg', 0.82); if (url.length > 700000) url = c.toDataURL('image/jpeg', 0.6);
        cb(url);
      };
      img.onerror = function () { UI.toast('That file is not a picture the browser can read.'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  R.bank = function (root) {
    var f = { cat: 'all', diff: 'all', src: 'all', text: '', limit: 30 }, edit = null, imp = null, imgData = '';
    function list() {
      var t = f.text.toLowerCase(), pool = S.pool().filter(function (q) {
        return (f.cat === 'all' || q.cat === f.cat) && (f.diff === 'all' || q.diff === f.diff) && (f.src === 'all' || (f.src === 'custom') === !q.builtin) && (!t || (q.q + ' ' + q.a).toLowerCase().indexOf(t) >= 0);
      });
      return pool;
    }
    function draw() {
      UI.clear(root);
      var builtin = S.builtin(), counts = S.counts(), custom = S.custom.all();
      root.appendChild(h('h1', { text: 'Question banks' }));
      root.appendChild(h('p', { class: 'muted', text: builtin.length + ' built-in questions across ' + S.CATS.length + ' categories and 3 difficulties, plus ' + custom.length + ' of your own. Every built-in question has its answer among the choices and was written for this kit.' }));
      var rows = S.CATS.map(function (c) { var t = 0; var tds = S.DIFFS.map(function (d) { var n = counts[c.id + '|' + d] || 0; t += n; return h('td', { text: String(n) }); }); return h('tr', null, h('td', null, h('span', { class: 'dot', style: { background: c.color } }), c.name), tds, h('td', { text: String(t) })); });
      root.appendChild(h('div', { class: 'card scroll-x' }, h('table', { class: 'matrix' }, h('thead', null, h('tr', null, [h('th', { text: 'Category' })].concat(S.DIFFS.map(function (d) { return h('th', { text: d }); }), [h('th', { text: 'Total' })]))), h('tbody', null, rows)),
        h('details', { style: { marginTop: '10px' } }, h('summary', { text: 'Where the facts come from' }), h('ul', null, S.CATS.map(function (c) { return h('li', null, h('strong', { text: c.name + ': ' }), S.categorySources[c.id]); })),
          h('p', { class: 'fine', text: 'Questions with a specific caveat show a source note on the host panel and, after the reveal, on the projector.' }))));

      /* browse */
      var pool = list(), shown = pool.slice(0, f.limit);
      var browse = h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Browse' }),
        h('div', { class: 'grid g4' },
          UI.field('Category', UI.select(catOptions(), f.cat, function (e) { f.cat = e.target.value; f.limit = 30; draw(); }), 'b-cat'),
          UI.field('Difficulty', UI.select([['all', 'All'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], f.diff, function (e) { f.diff = e.target.value; f.limit = 30; draw(); }), 'b-diff'),
          UI.field('Show', UI.select([['all', 'Built-in and mine'], ['builtin', 'Built-in only'], ['custom', 'Mine only']], f.src, function (e) { f.src = e.target.value; f.limit = 30; draw(); }), 'b-src'),
          UI.field('Search', h('input', { type: 'search', value: f.text, onchange: function (e) { f.text = e.target.value; f.limit = 30; draw(); } }), 'b-text')),
        h('p', { class: 'fine', text: pool.length + ' matching questions.' }));
      shown.forEach(function (q) {
        var acts = h('div', { class: 'row' });
        if (!q.builtin) { acts.appendChild(h('button', { type: 'button', class: 'btn small', onclick: function () { edit = q; imgData = q.img || ''; draw(); g.scrollTo(0, doc.body.scrollHeight); } }, 'Edit')); acts.appendChild(h('button', { type: 'button', class: 'btn small bad', onclick: function () { S.custom.remove(q.id); UI.toast('Deleted'); draw(); } }, 'Delete')); }
        browse.appendChild(h('div', { class: 'qrow' }, UI.catTag(q.cat), h('div', null, h('div', { class: 'qtext', text: q.q }), q.img ? h('img', { src: q.img, alt: 'Question picture', style: { maxHeight: '70px', borderRadius: '6px', margin: '4px 0' } }) : null,
          h('div', { class: 'qmeta' }, 'Answer: ', h('strong', { text: q.a }), q.choices.length ? '   Other choices: ' + q.choices.filter(function (c) { return c !== q.a; }).join(' / ') : '   (open answer)', q.src ? '   Source: ' + q.src : '')), h('div', null, UI.diffTag(q.diff), acts)));
      });
      if (pool.length > shown.length) browse.appendChild(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { type: 'button', class: 'btn', onclick: function () { f.limit += 60; draw(); } }, 'Show more')));
      root.appendChild(browse);

      /* editor */
      var e = edit || { cat: 'geography', diff: 'easy', q: '', a: '', choices: [], src: '' }, wrong = (e.choices || []).filter(function (c) { return c !== e.a; });
      var form = { cat: e.cat, diff: e.diff, q: e.q, a: e.a, w: [wrong[0] || '', wrong[1] || '', wrong[2] || ''], src: e.src || '' };
      var ed = h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: edit ? 'Edit your question' : 'Add your own question' }),
        h('div', { class: 'grid g2' },
          h('div', null,
            UI.field('Category', UI.select(S.CATS.map(function (c) { return [c.id, c.name]; }), form.cat, function (ev) { form.cat = ev.target.value; }), 'e-cat'),
            UI.field('Difficulty', UI.select(S.DIFFS.map(function (d) { return [d, d]; }), form.diff, function (ev) { form.diff = ev.target.value; }), 'e-diff'),
            UI.field('Question', h('textarea', { rows: '3', oninput: function (ev) { form.q = ev.target.value; } }, form.q), 'e-q'),
            UI.field('Correct answer', h('input', { type: 'text', value: form.a, oninput: function (ev) { form.a = ev.target.value; } }), 'e-a')),
          h('div', null,
            [0, 1, 2].map(function (i) { return UI.field('Wrong answer ' + (i + 1) + ' (leave all empty for an open question)', h('input', { type: 'text', value: form.w[i], oninput: function (ev) { form.w[i] = ev.target.value; } }), 'e-w' + i); }),
            UI.field('Source or note (optional)', h('input', { type: 'text', value: form.src, oninput: function (ev) { form.src = ev.target.value; } }), 'e-src'),
            UI.field('Picture (optional, from this computer)', h('input', { type: 'file', accept: 'image/*', onchange: function (ev) { var file = ev.target.files && ev.target.files[0]; if (file) readImage(file, function (u) { imgData = u; prev.src = u; prev.hidden = false; }); } }), 'e-img'))));
      var prev = h('img', { alt: 'Chosen picture preview', hidden: !imgData, src: imgData || undefined, style: { maxHeight: '120px', borderRadius: '8px' } });
      ed.appendChild(prev);
      var msg = h('p', { class: 'fine', role: 'status' });
      ed.appendChild(h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { type: 'button', class: 'btn primary', id: 'btn-save-q', onclick: function () {
          var q = S.makeCustom({ id: edit ? edit.id : null, cat: form.cat, diff: form.diff, q: form.q, a: form.a, wrong: form.w, src: form.src, img: imgData });
          var p = S.validate(q), fq = doc.getElementById('e-q'), fa = doc.getElementById('e-a'), fw = doc.getElementById('e-w0');
          [fw, fa, fq].forEach(function (c) { if (c) UI.fieldError(c, ''); });
          if (p.length) {
            msg.textContent = 'Fix this first: ' + p.join('; ');
            // link each problem to its control (aria-describedby + aria-invalid); the first one gets focus
            [[fw, /choice/], [fa, /answer/], [fq, /question/]].forEach(function (x) { var hit = p.filter(function (t) { return x[1].test(t); }); if (x[0] && hit.length) UI.fieldError(x[0], 'Fix: ' + hit.join('; ') + '.'); });
            return;
          }
          if (!S.custom.upsert(q)) { msg.textContent = 'The browser could not store this question (storage full). Try a smaller picture.'; return; }
          edit = null; imgData = ''; UI.toast('Question saved'); draw();
        } }, edit ? 'Save changes' : 'Add question'),
        edit ? h('button', { type: 'button', class: 'btn', onclick: function () { edit = null; imgData = ''; draw(); } }, 'Cancel') : null));
      ed.appendChild(msg);
      root.appendChild(ed);

      /* import / export */
      var ta = h('textarea', { rows: '6', placeholder: 'Paste JSON or CSV here, or choose a file. CSV columns: ' + S.CSV_HEAD.join(', '), 'aria-label': 'Questions to import' });
      var out = h('div', { role: 'status' });
      function doImport(text) {
        var r = S.importQuestions(text); UI.clear(out);
        if (r.good.length) { var all = S.custom.all().concat(r.good); if (S.custom.save(all)) out.appendChild(h('p', { class: 'status-right', text: 'Imported ' + r.good.length + ' question' + (r.good.length === 1 ? '' : 's') + '.' })); else out.appendChild(h('p', { class: 'status-wrong', text: 'Storage is full, nothing was saved.' })); }
        if (r.refused) out.appendChild(h('p', { class: 'status-wrong', text: r.errors[0].msg }));
        else if (r.errors.length) out.appendChild(h('div', null, h('p', { class: 'status-wrong', text: r.errors.length + ' row' + (r.errors.length === 1 ? '' : 's') + ' skipped:' }), h('ul', null, r.errors.slice(0, 12).map(function (x) { return h('li', { text: 'Row ' + x.row + ': ' + x.msg }); }))));
        if (r.note && !r.refused) out.appendChild(h('p', { class: 'fine', text: r.note === 'no checksum, validated' ? 'This file has no checksum; it was validated.' : r.note }));
        if (r.good.length) setTimeout(draw, 1200);
      }
      var fileIn = h('input', { type: 'file', accept: '.json,.csv,.txt', 'aria-label': 'Import file', onchange: function (ev) { var file = ev.target.files && ev.target.files[0]; if (!file) return; var fr = new g.FileReader(); fr.onload = function () { ta.value = String(fr.result); }; fr.readAsText(file); } });
      var ie = h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Import and export' }),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', onclick: function () { UI.download('stark-questions-all.json', S.exportQuestions(S.pool(), 'json'), 'application/json'); } }, 'Export all (JSON)'),
          h('button', { type: 'button', class: 'btn', onclick: function () { UI.download('stark-questions-all.csv', S.exportQuestions(S.pool(), 'csv'), 'text/csv'); } }, 'Export all (CSV)'),
          h('button', { type: 'button', class: 'btn', disabled: !custom.length, onclick: function () { UI.download('stark-my-questions.json', S.exportQuestions(custom, 'json'), 'application/json'); } }, 'Export mine (JSON)')),
        h('div', { style: { height: '12px' } }), fileIn, h('div', { style: { height: '8px' } }), ta,
        h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { type: 'button', class: 'btn primary', id: 'btn-import', onclick: function () { doImport(ta.value); } }, 'Import questions')), out);
      root.appendChild(ie);
    }
    draw();
  };
})(window);
