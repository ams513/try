/* Stark IntraTheater. Story Studio: spin a writing prompt, plan on a story mountain, draft with a word target and a word bank,
   check the writing (counts, long sentences, repeated words, a revision checklist), then read it aloud or save it as a little book.
   Stories are saved per profile in this browser. All checks are simple rules, not AI. Uses SIT.familyLib. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const F = SIT.familyLib;
  const MAX_STORIES = 40;
  const LEVELS = [['young', 'Ages 5 to 8'], ['junior', 'Ages 9 to 12'], ['teen', 'Teens and grown-ups']];
  const st = { open: null, genre: 'any', level: null, prompt: null, checked: false };
  let root, saveTimer = 0, pending = null;

  const list = pid => { const p = SIT.progress(pid); p.writing = (Array.isArray(p.writing) ? p.writing : []).map(F.sanitizeStory).filter(Boolean); return p.writing; };
  function persist(s, pid) {
    clearTimeout(saveTimer); pending = null;
    pid = pid || SIT.profileId();
    s.updated = Date.now();
    const L = list(pid), i = L.findIndex(x => x.id === s.id), clean = F.sanitizeStory(s);
    if (i >= 0) L[i] = clean; else L.unshift(clean);
    SIT.saveProgress(pid);
  }
  /* a debounced save remembers whose story it is, so switching profile never files it under someone else */
  const later = s => { clearTimeout(saveTimer); const pid = SIT.profileId(); pending = [s, pid]; saveTimer = setTimeout(() => persist(s, pid), 600); };
  const flush = () => { if (pending) persist(pending[0], pending[1]); };
  window.addEventListener('pagehide', flush);

  function render() {
    if (!root) return;
    clear(root);
    if (!st.level) st.level = SIT.isGrown() ? 'teen' : 'young';
    root.appendChild(h('header', { class: 'view-head' },
      h('a', { class: 'btn btn-back btn-small', href: '#/family' }, '⬅ Family'),
      h('h1', null, h('span', { 'aria-hidden': 'true' }, '✍️ '), 'Story Studio'),
      h('p', { class: 'lede' }, SIT.isGrown() ? 'Prompts, a story-mountain planner, a word bank and gentle, rule-based checks. Everything stays on this computer.' : 'Pick an idea, plan your story, then write it! You can hear it read aloud and save it as a book.')));
    const s = st.open && list().find(x => x.id === st.open);
    if (s) renderEditor(s); else renderHome();
  }

  function promptPanel(onUse) {
    const box = h('section', { class: 'card write-prompt' });
    const draw = () => {
      clear(box);
      box.appendChild(h('h2', null, '💡 Spin a prompt'));
      box.appendChild(h('div', { class: 'chips', role: 'group', 'aria-label': 'Kind of story' },
        [['any', '🎲 Any']].concat(data.writeGenres.map(g => [g.id, g.icon + ' ' + g.label])).map(g => h('button', { type: 'button', class: 'chip', 'aria-pressed': st.genre === g[0] ? 'true' : 'false', onclick: () => { st.genre = g[0]; st.prompt = null; draw(); } }, g[1]))));
      box.appendChild(h('div', { class: 'chips', role: 'group', 'aria-label': 'Age level' },
        LEVELS.map(l => h('button', { type: 'button', class: 'chip', 'aria-pressed': st.level === l[0] ? 'true' : 'false', onclick: () => { st.level = l[0]; st.prompt = null; draw(); } }, l[1]))));
      if (st.prompt) box.appendChild(h('blockquote', { class: 'write-prompt-text' }, st.prompt.text));
      box.appendChild(h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: () => { st.prompt = F.pickPrompt(data.writePrompts, { genre: st.genre, level: st.level }, Math.random, st.prompt && st.prompt.id); draw(); } }, st.prompt ? '🎲 Another one' : '🎲 Spin'),
        st.prompt ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => onUse(st.prompt) }, 'Use this prompt') : null,
        st.prompt ? SIT.speakButton(() => st.prompt.text, 'Hear it', 'btn-small') : null));
    };
    draw();
    return box;
  }

  function renderHome() {
    const L = list();
    const create = prompt => {
      if (list().length >= MAX_STORIES) { SIT.toast('You have 40 stories. Delete one to start another.'); return; }
      if (!SIT.edition.canCreate()) { SIT.edition.limitReached(); return; }
      const s = F.newStory('w' + SIT.uid());
      if (prompt) { s.prompt = prompt.text; s.genre = prompt.genre; }
      s.target = st.level === 'young' ? 100 : st.level === 'junior' ? 300 : 500;
      persist(s); st.open = s.id; st.checked = false; render();
    };
    root.appendChild(promptPanel(create));
    root.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => create(null) }, '📝 Start with my own idea')));
    root.appendChild(h('h2', null, 'My stories'));
    if (!L.length) { root.appendChild(h('p', { class: 'muted' }, 'No stories yet. Spin a prompt or start with your own idea.')); return; }
    root.appendChild(h('div', { class: 'lesson-grid' }, L.map(s => h('button', { type: 'button', class: 'menu-card', onclick: () => { st.open = s.id; st.checked = false; render(); } },
      h('span', { class: 'menu-title' }, s.title), h('span', { class: 'muted' }, F.writingStats(s.text).words + ' words' + (s.updated ? ' · ' + new Date(s.updated).toLocaleDateString() : '')),
      s.prompt ? h('span', { class: 'muted small' }, s.prompt.slice(0, 90) + (s.prompt.length > 90 ? '…' : '')) : null))));
  }

  function renderEditor(s) {
    const kid = !SIT.isGrown();
    let armed = false;
    root.appendChild(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => { persist(s); st.open = null; render(); } }, '⬅ My stories'),
      SIT.speakButton(() => s.title + '. ' + s.text, 'Read my story', 'btn-small'),
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => SIT.download(fileName(s) + '.txt', F.storyPlainText(s)) }, '💾 Save as text'),
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => SIT.download(fileName(s) + '-book.html', F.storyBookHTML(s, SIT.isGrown() ? '' : SIT.activeKid().name), 'text/html;charset=utf-8') }, '📕 Save as a book'),
      h('button', { type: 'button', class: 'btn btn-small btn-danger', onclick: e => {
        if (!armed) { armed = true; e.currentTarget.textContent = 'Tap again to delete'; return; }
        const p = SIT.progress(); p.writing = list().filter(x => x.id !== s.id); SIT.saveProgress(); st.open = null; render(); SIT.toast('Story deleted.');
      } }, 'Delete')));
    if (s.prompt) root.appendChild(h('blockquote', { class: 'write-prompt-text' }, h('strong', null, 'Prompt: '), s.prompt));

    /* plan: the story mountain */
    root.appendChild(h('details', { class: 'card write-plan', open: !s.text },
      h('summary', null, h('h2', null, '⛰️ Plan on the story mountain')),
      h('div', { class: 'mountain' }, data.storyMountain.map((m, i) => h('div', { class: 'mountain-step step-' + i },
        h('label', { for: 'plan-' + m.id }, h('span', { 'aria-hidden': 'true' }, m.icon + ' '), m.label),
        h('p', { class: 'muted small' }, kid ? m.kid : m.grown),
        h('textarea', { id: 'plan-' + m.id, rows: 3, maxlength: 1200, value: s.plan[m.id], oninput: e => { s.plan[m.id] = e.target.value; later(s); } }))))));

    /* write */
    const stats = F.writingStats(s.text);
    const count = h('p', { class: 'write-count', 'aria-live': 'polite' });
    const meter = h('div', { class: 'meter', 'aria-hidden': 'true' }, h('span'));
    const upCount = () => {
      const n = F.writingStats(text.value).words;
      count.textContent = n + ' of ' + s.target + ' words' + (n >= s.target ? ' · target reached! 🎉' : '');
      meter.firstChild.style.width = Math.min(100, Math.round(100 * n / s.target)) + '%';
    };
    const text = h('textarea', { id: 'write-text', class: 'write-text', rows: kid ? 10 : 16, maxlength: 30000, value: s.text, spellcheck: 'true',
      oninput: e => { s.text = e.target.value; upCount(); later(s); } });
    const target = h('select', { id: 'write-target', onchange: e => { s.target = +e.target.value; upCount(); persist(s); } }, [50, 100, 200, 300, 500, 800, 1000, 2000, 5000].map(n => h('option', { value: String(n) }, n + ' words')));
    target.value = String([50, 100, 200, 300, 500, 800, 1000, 2000, 5000].indexOf(s.target) >= 0 ? s.target : 300);
    const insert = w => {
      const a = text.selectionStart || text.value.length, b = text.selectionEnd || a, before = text.value.slice(0, a);
      const pre = before && !/\s$/.test(before) ? ' ' : '';
      text.value = before + pre + w + ' ' + text.value.slice(b);
      const pos = (before + pre + w + ' ').length; text.focus(); text.setSelectionRange(pos, pos);
      s.text = text.value; upCount(); later(s);
    };
    root.appendChild(h('section', { class: 'card write-draft' },
      h('h2', null, '📝 Write'),
      h('div', { class: 'form-grid' },
        h('label', { for: 'write-title' }, 'Title'), h('input', { type: 'text', id: 'write-title', value: s.title, maxlength: 80, oninput: e => { s.title = e.target.value; later(s); } }),
        h('label', { for: 'write-target' }, 'Word target'), target),
      h('label', { for: 'write-text', class: 'sr-only' }, 'Your story'), text, meter, count,
      h('details', { class: 'word-bank' }, h('summary', null, '🧺 Word bank: tap a word to add it'),
        data.wordBank.map(g => h('div', { class: 'wb-group' }, h('h3', null, g.label),
          h('div', { class: 'chips' }, g.words.map(w => h('button', { type: 'button', class: 'chip wb-word', onclick: () => insert(w) }, w))))))));
    upCount();

    /* check */
    const checkBox = h('section', { class: 'card write-check' });
    const drawCheck = () => {
      clear(checkBox);
      checkBox.appendChild(h('h2', null, '🔎 Check my writing'));
      if (!st.checked) {
        checkBox.appendChild(h('p', { class: 'muted' }, 'Simple counting rules look for long sentences and words used a lot. They are hints, not marks.'));
        checkBox.appendChild(h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { st.checked = true; persist(s); drawCheck(); } }, 'Check it'));
      } else {
        const x = F.writingStats(s.text);
        const tips = [];
        if (!x.words) tips.push('Start writing, then check again.');
        if (x.long) tips.push(x.long + ' sentence' + (x.long === 1 ? ' is' : 's are') + ' over 25 words. Could ' + (x.long === 1 ? 'it' : 'they') + ' be split?');
        if (x.repeats.length) tips.push('Words you used a lot: ' + x.repeats.map(r => r[0] + ' (' + r[1] + ')').join(', ') + '. Try a different word for some of them.');
        if (x.said >= 4) tips.push('“said” appears ' + x.said + ' times. The word bank has other choices.');
        if (x.words >= 40 && x.sentences && x.avg < 6) tips.push('Most sentences are very short. Try joining a few with and, but, because or when.');
        if (x.words && x.paragraphs < 2 && x.words > 150) tips.push('Try splitting the story into paragraphs: leave an empty line between them.');
        if (x.words && !tips.length) tips.push('No problems found by the counting rules. Now read it aloud and listen to how it sounds.');
        checkBox.appendChild(h('dl', { class: 'ex-facts' },
          h('dt', null, 'Words'), h('dd', null, x.words + ' (target ' + s.target + ')'),
          h('dt', null, 'Sentences'), h('dd', null, x.sentences + (x.sentences ? ', about ' + x.avg + ' words each' : '')),
          h('dt', null, 'Paragraphs'), h('dd', null, String(x.paragraphs)),
          h('dt', null, 'Speech'), h('dd', null, x.dialogue ? 'Yes, your characters talk' : 'No speech marks yet'),
          h('dt', null, 'Reading time'), h('dd', null, 'about ' + x.readMin + ' minute' + (x.readMin === 1 ? '' : 's'))));
        checkBox.appendChild(h('ul', { class: 'write-tips' }, tips.map(t => h('li', null, t))));
        checkBox.appendChild(h('button', { type: 'button', class: 'btn btn-small', onclick: drawCheck }, 'Check again'));
      }
      const listC = kid ? data.reviseKid : data.reviseGrown;
      checkBox.appendChild(h('fieldset', { class: 'revise' }, h('legend', null, kid ? 'My checklist' : 'Revision checklist'),
        listC.map(c => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.checks.indexOf(c.id) >= 0, onchange: e => {
          s.checks = s.checks.filter(x => x !== c.id); if (e.target.checked) s.checks.push(c.id); persist(s);
          if (listC.every(k => s.checks.indexOf(k.id) >= 0)) { SIT.toast('Checklist complete! ⭐'); if (kid) SIT.addStars(1); }
        } }), h('span', null, c.text)))));
    };
    drawCheck();
    root.appendChild(checkBox);
    root.appendChild(h('p', { class: 'fine' }, 'Saved automatically on this computer. ' + stats.words + ' words when you opened it.'));
  }
  const fileName = s => (s.title || 'story').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'story';

  SIT.view('write', { title: 'Story Studio', navAs: 'family', mount(el) { root = el; }, show() { render(); }, hide: flush });
  SIT.on('mode', () => { flush(); if (SIT.currentView() === 'write') { st.open = null; st.level = null; render(); } });
})();
