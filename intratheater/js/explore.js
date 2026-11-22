/* Stark IntraTheater by Stark. Explorers hub and the shared page frame for Science, Art and Music, Math and Languages:
   header, tabs, kid and grown-up text split, and a quiz menu with personal bests. Everything runs offline. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const best = key => (SIT.progress().best || {})[key];

  /* tiny SVG builder: svg('circle', {cx: 5, ...}, children...) */
  SIT.svg = function (tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v === null || v === undefined || v === false) continue; if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v); else el.setAttribute(k, v); }
    const put = c => { if (!c) return; if (Array.isArray(c)) c.forEach(put); else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); };
    for (let i = 2; i < arguments.length; i++) put(arguments[i]);
    return el;
  };

  /* An explorer page. o: {title, icon, ledeKid, ledeGrown, tabs: [{id, label, render(box, q)}]}. Deep links: #/name?tab=...&id=... */
  SIT.explorer = function (name, o) {
    let root; const st = { tab: o.tabs[0].id, q: {} };
    function render() {
      if (!root) return;
      clear(root);
      const kid = !SIT.isGrown();
      root.classList.toggle('ex-kid', kid);
      root.appendChild(h('header', { class: 'view-head' },
        h('a', { class: 'btn btn-back btn-small', href: '#/explore' }, '⬅ All explorers'),
        h('h1', null, h('span', { 'aria-hidden': 'true' }, o.icon + ' '), o.title),
        h('p', { class: 'lede' }, kid ? o.ledeKid : o.ledeGrown)));
      root.appendChild(h('div', { class: 'tabs', role: 'group', 'aria-label': o.title + ' sections' },
        o.tabs.map(t => h('button', { type: 'button', 'aria-pressed': t.id === st.tab ? 'true' : 'false', onclick: () => { st.tab = t.id; st.q = {}; render(); } }, t.label))));
      const body = h('div', { class: 'ex-body' });
      root.appendChild(body);
      o.tabs.find(t => t.id === st.tab).render(body, st.q);
    }
    SIT.view(name, {
      title: o.title, navAs: 'explore',
      mount(el) { root = el; },
      show(r) { st.tab = o.tabs.some(t => t.id === r.q.tab) ? r.q.tab : o.tabs[0].id; st.q = r.q; render(); }
    });
    SIT.on('mode', () => { if (SIT.currentView() === name) render(); });
  };

  /* Quiz menu. items: [{key(level), label, text, make(level) -> questions}]. Level chips default to the profile's mode. */
  SIT.exQuiz = function (host, items) {
    let level = SIT.isGrown() ? 'grown' : 'kid';
    function menu() {
      clear(host);
      host.appendChild(h('section', { class: 'quiz-setup' },
        h('h2', null, 'Pick a quiz'),
        h('div', { class: 'chips', role: 'group', 'aria-label': 'Quiz level' },
          [['kid', 'Kid level'], ['grown', 'Grown-up level']].map(l => h('button', { type: 'button', class: 'chip', 'aria-pressed': level === l[0] ? 'true' : 'false', onclick: () => { level = l[0]; menu(); } }, l[1]))),
        h('div', { class: 'lesson-grid' }, items.map(it => {
          const b = best(it.key(level));
          return h('button', { type: 'button', class: 'menu-card', onclick: () => start(it) },
            h('span', { class: 'menu-title' }, it.label), h('span', { class: 'muted' }, it.text), b ? h('span', { class: 'badge' }, 'Best ' + b.score + '/' + b.total) : null);
        }))));
    }
    function start(it) {
      const questions = it.make(level).map(q => Object.assign({}, q, { choices: SIT.shuffle(q.choices) }));
      SIT.runQuiz(host, { questions, kid: level === 'kid', bestKey: it.key(level), again: () => start(it), onDone: menu });
    }
    menu();
  };
  /* static quiz lists: a random set of n questions */
  SIT.staticQuiz = (list, n) => SIT.sample(list, Math.min(n, list.length));

  /* ---------- hub ---------- */
  const CARDS = [
    ['#/science', '🔬', 'Science Explorer', 'The solar system, all 118 elements and the human body.', 'Planets, moons, the periodic table and how your body works.'],
    ['#/arts', '🎨', 'Art and Music History', data.arts ? data.arts.length + ' famous works and composers from the Stone Age to today.' : '', 'Dated works across eras and regions, with facts and quizzes.'],
    ['#/math', '➗', 'Math Playground', 'Pie fractions, times tables, shapes, angles and a graph toy.', 'Fractions, times-table mastery, polygon angles and straight-line graphs.'],
    ['#/lang', '🗣️', 'World Languages', 'Hello, numbers and colours in 10 languages, read aloud.', 'Greetings, numbers 1 to 10 and colours in ten widely spoken languages, with read-aloud where a voice is installed.']
  ];
  let hub;
  function renderHub() {
    clear(hub);
    const kid = !SIT.isGrown();
    hub.appendChild(h('header', { class: 'view-head' }, h('h1', null, 'Explorers'),
      h('p', { class: 'lede' }, kid ? 'Pick a world to explore: space, art, numbers or other languages!' : 'Four offline explorers with kid-level and grown-up-level text, quizzes, and lesson sets for the classroom.')));
    hub.appendChild(h('section', { class: 'tiles', 'aria-label': 'Explorers' },
      CARDS.map(c => h('a', { class: 'tile', href: c[0] }, h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, c[1]), h('span', { class: 'tile-title' }, c[2]), h('span', { class: 'tile-text' }, kid ? c[3] : c[4])))));
    hub.appendChild(h('p', { class: 'fine' }, 'Approximate values are marked with words like about, roughly or c. (circa). Lesson sets for these explorers are in Lessons.',
      ' ', h('a', { href: '#/lessons' }, 'Open Lessons')));
  }
  SIT.view('explore', { title: 'Explorers', mount(el) { hub = el; }, show: renderHub });
  SIT.on('mode', () => { if (SIT.currentView() === 'explore') renderHub(); });
})();
