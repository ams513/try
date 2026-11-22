/* Stark IntraTheater. Family hub and Family Trivia Night: pass-and-play rounds for 2 to 8 players or teams, each answering
   at their own level (kids and grown-ups in the same game), the last round counting double. Uses SIT.familyLib. */
(function () {
  'use strict';
  const { h, clear, data, store } = SIT;
  const F = SIT.familyLib;

  /* ================= hub ================= */
  let hub;
  function renderHub() {
    clear(hub);
    const kid = !SIT.isGrown();
    const last = (store.get('trivia.history', []) || [])[0];
    hub.appendChild(h('header', { class: 'view-head' }, h('h1', null, 'Family'),
      h('p', { class: 'lede' }, kid ? 'Play, make and write together!' : 'Things to do together: a trivia night where everyone plays at their own level, a museum you curate, and a writing studio.')));
    hub.appendChild(h('section', { class: 'tiles', 'aria-label': 'Family activities' },
      [['#/trivia', '🎲', 'Trivia Night', 'Pass-and-play quiz for 2 to 8 players. Kids get kid questions, grown-ups get hard ones.'],
        ['#/museum', '🏺', 'Museum Builder', 'Curate an exhibit from history, countries, sources and art. Walk through it, print it or share it.'],
        ['#/write', '✍️', 'Story Studio', 'Writing prompts, a story-mountain planner, a word bank and gentle checks. Save it as a little book.'],
        ['#/history?tab=sources', '📖', 'Primary sources', 'Read real words from the past with a reading guide.']]
        .map(t => h('a', { class: 'tile', href: t[0] }, h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, t[1]), h('span', { class: 'tile-title' }, t[2]), h('span', { class: 'tile-text' }, t[3])))));
    if (last && Array.isArray(last.standings)) {
      hub.appendChild(h('section', { class: 'card' }, h('h2', null, 'Last trivia night'),
        h('p', { class: 'muted' }, last.when || ''),
        h('ol', null, last.standings.slice(0, 8).map(s => h('li', null, (s.avatar ? s.avatar + ' ' : '') + s.name + ': ' + s.score + ' point' + (s.score === 1 ? '' : 's'))))));
    }
  }
  SIT.view('family', { title: 'Family', mount(el) { hub = el; }, show: renderHub });
  SIT.on('mode', () => { if (SIT.currentView() === 'family') renderHub(); });

  /* ================= Trivia Night ================= */
  let root, game = null, setup = null, phase = 'setup', lastRes = null;
  function banks() {
    const C = data.countries;
    return {
      history: { kid: data.triviaKids || [], grown: data.triviaHard || [] },
      geography: { kid: F.capitalQuestions(C, 'kid', 40, Math.random), grown: F.capitalQuestions(C, 'grown', 80, Math.random) },
      science: { kid: data.sciQuizKids || [], grown: data.sciQuizGrown || [] },
      arts: { kid: data.artQuizKids || [], grown: data.artQuizGrown || [] }
    };
  }
  function defaultSetup() {
    const fam = SIT.family();
    const players = fam.kids.slice(0, 6).map(k => ({ name: k.name, level: 'kid', avatar: k.avatar }));
    players.push({ name: 'Grown-ups', level: 'grown', avatar: '🎬' });
    if (players.length < 2) players.push({ name: 'Player 2', level: 'kid', avatar: '🐼' });
    return { players, rounds: 3, cats: Object.keys(F.CATS) };
  }
  function render() {
    if (!root) return;
    clear(root);
    root.appendChild(h('header', { class: 'view-head' },
      h('a', { class: 'btn btn-back btn-small', href: '#/family' }, '⬅ Family'),
      h('h1', null, h('span', { 'aria-hidden': 'true' }, '🎲 '), 'Family Trivia Night')));
    const body = h('div', { class: 'trivia' });
    root.appendChild(body);
    ({ setup: renderSetup, pass: renderPass, ask: renderAsk, end: renderEnd })[phase](body);
  }
  function renderSetup(box) {
    if (!setup) setup = defaultSetup();
    box.appendChild(h('div', { class: 'row start-bar' },
      h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: start }, '▶ Start trivia night'),
      h('p', { class: 'muted', role: 'status' }, setup.players.length + ' players · ' + setup.rounds + ' rounds · ' + setup.cats.map(c => F.CATS[c]).join(', ') + '. Change any of it below.')));
    const rows = setup.players.map((p, i) => {
      const av = h('select', { 'aria-label': 'Avatar for player ' + (i + 1), onchange: e => { p.avatar = e.target.value; } }, SIT.AVATARS.concat(['🎬', '🧑', '👵', '👴']).map(a => h('option', { value: a }, a)));
      av.value = p.avatar || SIT.AVATARS[i % SIT.AVATARS.length];
      return h('div', { class: 'row trivia-player' }, av,
        h('input', { type: 'text', value: p.name, maxlength: 20, 'aria-label': 'Name of player ' + (i + 1), oninput: e => { p.name = e.target.value; } }),
        h('div', { class: 'chips', role: 'group', 'aria-label': 'Level for player ' + (i + 1) },
          [['kid', '🧒 Kid questions'], ['grown', '🎓 Grown-up questions']].map(l => h('button', { type: 'button', class: 'chip', 'aria-pressed': p.level === l[0] ? 'true' : 'false', onclick: () => { p.level = l[0]; render(); } }, l[1]))),
        setup.players.length > 2 ? h('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Remove player ' + (i + 1), onclick: () => { setup.players.splice(i, 1); render(); } }, 'Remove') : null);
    });
    box.appendChild(h('section', { class: 'card' },
      h('h2', null, 'Who is playing?'),
      h('p', { class: 'muted' }, 'Players can be people or teams. Everyone answers their own question while the others wait; pass the device along when it says so.'),
      rows,
      setup.players.length < 8 ? h('button', { type: 'button', class: 'btn', onclick: () => { setup.players.push({ name: 'Player ' + (setup.players.length + 1), level: 'kid', avatar: SIT.AVATARS[setup.players.length % SIT.AVATARS.length] }); render(); } }, '➕ Add a player') : null));
    box.appendChild(h('section', { class: 'card' },
      h('h2', null, 'Topics and length'),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Topics' }, Object.keys(F.CATS).map(c => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': setup.cats.indexOf(c) >= 0 ? 'true' : 'false',
        onclick: () => { const i = setup.cats.indexOf(c); if (i >= 0) { if (setup.cats.length > 1) setup.cats.splice(i, 1); } else setup.cats.push(c); render(); }
      }, F.CATS[c]))),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Rounds' }, [3, 5, 8].map(n => h('button', { type: 'button', class: 'chip', 'aria-pressed': setup.rounds === n ? 'true' : 'false', onclick: () => { setup.rounds = n; render(); } }, n + ' rounds'))),
      h('p', { class: 'muted small' }, setup.players.length * setup.rounds + ' questions in all. The last round counts double.'),
      h('button', { type: 'button', class: 'btn btn-lg', onclick: start }, '▶ Start with these settings')));
  }
  function start() {
    try { game = F.triviaNew(setup, banks(), Math.random); } catch (e) { SIT.toast('Add at least two players and one topic.'); return; }
    phase = 'pass'; lastRes = null; render();
  }
  function scoreboard() {
    return h('ol', { class: 'trivia-board', 'aria-label': 'Scores' }, F.triviaStandings(game).map(s => h('li', null,
      h('span', { 'aria-hidden': 'true' }, s.avatar + ' '), h('strong', null, s.name), h('span', { class: 'muted' }, ' · ' + s.score + ' pt' + (s.score === 1 ? '' : 's')))));
  }
  function renderPass(box) {
    const t = F.triviaCurrent(game), p = game.players[t.p];
    box.appendChild(h('section', { class: 'card trivia-pass' },
      h('p', { class: 'quiz-progress' }, 'Round ' + (t.round + 1) + ' of ' + game.rounds + (t.double ? ' · Final round: double points!' : '')),
      h('div', { class: 'trivia-avatar', 'aria-hidden': 'true' }, p.avatar || '🙂'),
      h('h2', { tabindex: '-1' }, 'Pass to ' + p.name),
      h('p', { class: 'muted' }, F.CATS[t.cat] + ' · ' + (p.level === 'kid' ? 'kid question' : 'grown-up question')),
      h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: () => { phase = 'ask'; render(); } }, 'I’m ready'),
      h('h3', null, 'Scores'), scoreboard()));
    box.querySelector('h2').focus();
  }
  function renderAsk(box) {
    const t = F.triviaCurrent(game), p = game.players[t.p], kid = p.level === 'kid';
    const fb = h('p', { class: 'quiz-feedback', role: 'status', 'aria-live': 'polite' });
    const choices = h('div', { class: 'quiz-choices' + (kid ? ' kid' : ''), role: 'group', 'aria-label': 'Answer choices' }, t.q.choices.map(c => h('button', {
      type: 'button', class: 'choice', onclick: e => {
        const r = F.triviaAnswer(game, c); if (!r) return;
        choices.querySelectorAll('button').forEach(b => { b.disabled = true; if (b.textContent === r.answer) b.classList.add('is-right'); });
        if (!r.right) e.currentTarget.classList.add('is-wrong');
        fb.textContent = (r.right ? 'Correct! +' + r.points + (r.points === 1 ? ' point. ' : ' points. ') : 'Not quite: it’s ' + r.answer + (/[.!?]$/.test(r.answer) ? ' ' : '. ')) + (r.note || '');
        fb.className = 'quiz-feedback ' + (r.right ? 'good' : 'bad');
        next.hidden = false; next.focus();
      }
    }, c)));
    const next = h('button', { type: 'button', class: 'btn btn-primary', hidden: true, onclick: () => { F.triviaNext(game); phase = game.done ? 'end' : 'pass'; if (game.done) saveResult(); render(); } },
      game.i + 1 < game.turns.length ? 'Next player' : 'See who won');
    box.appendChild(h('section', { class: 'card quiz' + (kid ? ' quiz-kid' : '') },
      h('div', { class: 'quiz-head' }, h('p', { class: 'quiz-progress' }, (p.avatar || '') + ' ' + p.name + ' · ' + F.CATS[t.cat] + (t.double ? ' · double points' : '')),
        SIT.speakButton(() => t.q.q + ' ' + t.q.choices.join(', or '), 'Read question')),
      h('h3', { class: 'quiz-q', tabindex: '-1' }, t.q.q), choices, fb, h('div', { class: 'quiz-actions' }, next)));
    box.querySelector('.quiz-q').focus();
  }
  function saveResult() {
    const hist = store.get('trivia.history', []) || [];
    hist.unshift({ when: new Date().toLocaleDateString(), standings: F.triviaStandings(game).map(s => ({ name: s.name, avatar: s.avatar, score: s.score, rank: s.rank })) });
    store.set('trivia.history', hist.slice(0, 10));
  }
  function renderEnd(box) {
    const st = F.triviaStandings(game), winners = st.filter(s => s.rank === 1);
    box.appendChild(h('section', { class: 'card trivia-end' },
      h('div', { class: 'quiz-stars', 'aria-hidden': 'true' }, '🏆'),
      h('h2', { tabindex: '-1' }, winners.length > 1 ? 'A tie! ' + winners.map(w => w.name).join(' and ') + ' share first place' : winners[0].name + ' wins!'),
      h('table', { class: 'trivia-table' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Place'), h('th', { scope: 'col' }, 'Player'), h('th', { scope: 'col' }, 'Points'), h('th', { scope: 'col' }, 'Right'), h('th', { scope: 'col' }, 'Best streak'))),
        h('tbody', null, st.map(s => h('tr', null, h('td', null, String(s.rank)), h('td', null, (s.avatar ? s.avatar + ' ' : '') + s.name + (s.level === 'kid' ? ' (kid questions)' : '')),
          h('td', null, String(s.score)), h('td', null, s.right + ' of ' + game.rounds), h('td', null, String(s.best)))))),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: start }, 'Play again, same players'),
        h('button', { type: 'button', class: 'btn', onclick: () => { phase = 'setup'; render(); } }, 'Change players'))));
    box.querySelector('h2').focus();
  }
  SIT.view('trivia', { title: 'Trivia Night', navAs: 'family', mount(el) { root = el; }, show() { render(); } });
})();
