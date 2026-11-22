/* Stark IntraTheater. Primary-source reading guides: public-domain excerpts with context, words to know, questions to ask
   any source (who, when, why, for whom), discussion questions and a short reading check. Kids see the sources marked for all ages. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const SRC = data.sources || [];
  const F = SIT.familyLib;
  const evById = {}; (data.events || []).forEach(e => { evById[e.id] = e; });
  const st = { open: null };
  const visible = () => SRC.filter(s => SIT.isGrown() || s.level !== 'grown');

  function list(host) {
    clear(host);
    const read = SIT.progress().sources || [];
    const items = visible();
    host.appendChild(h('section', { class: 'src-intro' },
      h('h2', null, '📜 Primary sources'),
      h('p', { class: 'muted' }, SIT.isGrown()
        ? items.length + ' short, public-domain texts written by people who were there, each with a reading guide: context, words to know, questions historians ask of any source, and a quick check.'
        : 'Real words from long ago, written by people who were there. Read one, then try the questions!'),
      h('p', { class: 'badge' }, read.filter(id => items.some(s => s.id === id)).length + ' of ' + items.length + ' read')));
    host.appendChild(h('div', { class: 'src-grid' }, items.map(s => h('button', { type: 'button', class: 'menu-card src-card' + (read.indexOf(s.id) >= 0 ? ' seen' : ''), onclick: () => { st.open = s.id; reader(host, s); } },
      h('span', { class: 'src-kind' }, s.kind + ' · ' + s.date),
      h('span', { class: 'menu-title' }, s.title),
      h('span', { class: 'muted' }, s.author + ' · ' + s.region),
      read.indexOf(s.id) >= 0 ? h('span', { class: 'badge' }, '✓ Read') : null))));
  }

  function reader(host, s) {
    clear(host);
    const grown = SIT.isGrown();
    const p = SIT.progress(); p.sources = p.sources || [];
    SIT.markIn('sources', s.id);
    const ev = s.event && evById[s.event];
    const quizHost = h('div', { class: 'quiz-host' });
    const best = p.best['src-' + s.id];
    const ask = [['who', 'Who made it?'], ['when', 'When?'], ['why', 'Why was it made?'], ['audience', 'Who was it for?']];
    host.appendChild(h('article', { class: 'card src-reader' },
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-small btn-back', onclick: () => { st.open = null; list(host); } }, '⬅ All sources'),
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => SIT.scrollIntoView(quizHost, 'center') }, '✔ Go to the reading check')),
      h('p', { class: 'src-kind' }, s.kind + ' · ' + s.date + ' · ' + s.region),
      h('h2', { tabindex: '-1', class: 'src-title' }, s.title),
      h('p', { class: 'muted' }, s.author),
      h('section', { class: 'src-block' }, h('h3', null, 'Before you read'), h('p', null, grown ? s.context : s.kidContext)),
      h('section', { class: 'src-block' }, h('h3', null, 'The source'),
        h('blockquote', { class: 'src-text', lang: s.id === 'magna-carta-39' ? 'la' : 'en' }, s.excerpt),
        s.plain ? h('div', { class: 'src-plain' }, h('h4', null, 'In plain English'), h('p', null, s.plain)) : null,
        h('p', { class: 'fine' }, (s.translation ? s.translation + '. ' : '') + 'Public domain. ' + s.pd + ' A short excerpt.'),
        h('div', { class: 'row' }, SIT.speakButton(() => s.title + '. ' + (s.plain || s.excerpt), 'Read it aloud'))),
      h('section', { class: 'src-block' }, h('h3', null, 'Words to know'),
        h('dl', { class: 'ex-facts' }, s.vocab.map(v => [h('dt', null, v[0]), h('dd', null, v[1])]))),
      h('section', { class: 'src-block' }, h('h3', null, 'Ask the source'),
        h('p', { class: 'muted small' }, 'Historians ask these four questions of every source. Think of your answer, then open each one.'),
        h('div', { class: 'src-ask' }, ask.map(a => h('details', { class: 'src-q' }, h('summary', null, a[1]), h('p', null, s.sourcing[a[0]]))))),
      h('section', { class: 'src-block' }, h('h3', null, 'Think about it'),
        h('ul', null, s.think.map(q => h('li', null, q)))),
      h('section', { class: 'src-block' }, h('h3', null, 'Check your reading'),
        best ? h('p', { class: 'badge' }, 'Best: ' + best.score + '/' + best.total) : null,
        quizHost),
      h('div', { class: 'row' },
        ev ? h('a', { class: 'btn', href: '#/history?e=' + ev.id }, '📜 See ' + ev.title + ' on the timeline') : null,
        SIT.museum ? h('button', { type: 'button', class: 'btn', onclick: () => SIT.museum.add('source', s.id) }, '🏺 Add to my museum') : null,
        grown ? h('button', { type: 'button', class: 'btn', onclick: () => SIT.download('reading-guide-' + s.id + '.html', guideHTML(s), 'text/html;charset=utf-8') }, '🖨️ Save reading guide (.html)') : null)));
    const startQuiz = () => SIT.runQuiz(quizHost, { questions: s.check.map(q => Object.assign({}, q, { choices: SIT.shuffle(q.choices) })), kid: !grown, bestKey: 'src-' + s.id, again: startQuiz, onDone: () => reader(host, s) });
    quizHost.appendChild(h('button', { type: 'button', class: 'btn btn-lg src-start', onclick: startQuiz }, 'Start the 3-question check'));
    host.querySelector('.src-title').focus({ preventScroll: true });
    SIT.scrollIntoView(host, 'start');
  }

  /* a printable worksheet for one source: the text, context, vocabulary and every question, with space to write */
  function guideHTML(s) {
    const e = F.esc, lines = '<div class="lines"></div>';
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">' +
      '<title>Reading guide: ' + e(s.title) + '</title><style>body{font:16px/1.5 Georgia,serif;color:#222;max-width:760px;margin:2rem auto;padding:0 1rem}blockquote{border-left:4px solid #b88a2e;margin:1rem 0;padding:.4rem 1rem;white-space:pre-wrap;background:#faf5ea}' +
      'h1{margin-bottom:.2rem}.meta{color:#555}.lines{height:4.5em;border-bottom:1px solid #999;background:repeating-linear-gradient(transparent,transparent 1.45em,#ccc 1.5em)}li{margin:.6rem 0}footer{color:#777;font-size:.8rem;margin-top:2rem}</style></head><body>' +
      '<h1>' + e(s.title) + '</h1><p class="meta">' + e(s.author) + ' · ' + e(s.date) + ' · ' + e(s.kind) + '</p>' +
      '<h2>Before you read</h2><p>' + e(s.context) + '</p><h2>The source</h2><blockquote>' + e(s.excerpt) + '</blockquote>' +
      (s.plain ? '<p><strong>In plain English:</strong> ' + e(s.plain) + '</p>' : '') + '<p class="meta">' + (s.translation ? e(s.translation) + '. ' : '') + 'Public domain. ' + e(s.pd) + '</p>' +
      '<h2>Words to know</h2><ul>' + s.vocab.map(v => '<li><strong>' + e(v[0]) + ':</strong> ' + e(v[1]) + '</li>').join('') + '</ul>' +
      '<h2>Ask the source</h2><ol><li>Who made it?' + lines + '</li><li>When?' + lines + '</li><li>Why was it made?' + lines + '</li><li>Who was it for?' + lines + '</li></ol>' +
      '<h2>Think about it</h2><ol>' + s.think.map(q => '<li>' + e(q) + lines + '</li>').join('') + '</ol>' +
      '<h2>Check your reading</h2><ol>' + s.check.map(q => '<li>' + e(q.q) + '<br>' + q.choices.map(c => '&#9744; ' + e(c)).join('&nbsp;&nbsp; ') + '</li>').join('') + '</ol>' +
      '<footer>Answers: ' + s.check.map((q, i) => (i + 1) + '. ' + e(q.answer)).join(' · ') + '<br>Made with Stark IntraTheater.</footer></body></html>\n';
  }

  SIT.sourcesUI = {
    render(host, q) {
      const want = q && q.src && SRC.find(s => s.id === q.src && (SIT.isGrown() || s.level !== 'grown'));
      if (want) { st.open = want.id; reader(host, want); return; }
      if (q && q.list) st.open = null;
      const cur = st.open && visible().find(s => s.id === st.open);
      if (cur) reader(host, cur); else list(host);
    },
    guideHTML
  };
})();
