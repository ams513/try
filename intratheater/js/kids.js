/* Stark IntraTheater by Stark. Kids Zone: drawing pad, picture story builder, maths garden, spelling bee.
   Big touch targets, read-aloud where the browser supports it, and no links out. */
(function () {
  'use strict';
  const { h, clear, data, shuffle, sample, pick } = SIT;
  const ACTS = [
    ['draw', '🎨', 'Drawing Pad', 'Draw, stamp and save your picture.'],
    ['story', '📚', 'Story Builder', 'Pick pictures and make a story.'],
    ['math', '🌻', 'Maths Garden', 'Grow flowers with sums.'],
    ['spell', '🐝', 'Spelling Bee', 'Spell the picture word.']
  ];
  let root, hub, boxes = {}, built = {};

  const backBtn = () => h('a', { class: 'btn btn-back', href: '#/kids' }, '⬅ Kids Zone');
  const stamp = () => { const d = new Date(), p = n => (n < 10 ? '0' : '') + n; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); };

  /* ================= Drawing pad ================= */
  function buildDraw(box) {
    const W = 1000, H = 680;
    const COLORS = [['Black', '#222222'], ['Red', '#e53935'], ['Orange', '#fb8c00'], ['Yellow', '#fdd835'], ['Green', '#43a047'], ['Teal', '#00897b'],
      ['Sky blue', '#4fc3f7'], ['Blue', '#1e5fd6'], ['Purple', '#8e24aa'], ['Pink', '#ec407a'], ['Brown', '#6d4c41'], ['Grey', '#9e9e9e']];
    const STAMPS = ['⭐', '❤️', '🌈', '🐱', '🌸', '🚀', '☀️', '🐟', '🦋', '🌳'];
    const ds = { color: '#222222', size: 14, tool: 'brush', stamp: '⭐' };
    const canvas = h('canvas', { width: W, height: H, class: 'pad', role: 'img', 'aria-label': 'Drawing canvas. Draw with a finger, pen or mouse.' });
    const ctx = canvas.getContext('2d');
    const undo = [];
    const blank = () => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); };
    blank();
    const pushUndo = () => { try { undo.push(ctx.getImageData(0, 0, W, H)); if (undo.length > 10) undo.shift(); } catch (e) { /* ignore */ } };
    const pt = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    let last = null, mid = null;
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ } pushUndo();
      const p = pt(e);
      if (ds.tool === 'stamp') {
        ctx.font = (ds.size * 4 + 24) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ds.stamp, p.x, p.y); return;
      }
      last = p; mid = p;
      ctx.beginPath(); ctx.fillStyle = ds.tool === 'eraser' ? '#ffffff' : ds.color; ctx.arc(p.x, p.y, ds.size / 2, 0, Math.PI * 2); ctx.fill();
    });
    canvas.addEventListener('pointermove', e => {
      if (!last) return;
      const p = pt(e); const m = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
      ctx.strokeStyle = ds.tool === 'eraser' ? '#ffffff' : ds.color; ctx.lineWidth = ds.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(mid.x, mid.y); ctx.quadraticCurveTo(last.x, last.y, m.x, m.y); ctx.stroke();
      last = p; mid = m;
    });
    const end = () => { last = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('pointerleave', end);

    const swatches = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Colours' });
    const tools = h('div', { class: 'tools', role: 'group', 'aria-label': 'Tools' });
    const sizes = h('div', { class: 'tools', role: 'group', 'aria-label': 'Brush size' });
    const stamps = h('div', { class: 'stamps', role: 'group', 'aria-label': 'Stamps', hidden: true });
    function sync() {
      swatches.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', ds.tool === 'brush' && b.dataset.c === ds.color ? 'true' : 'false'));
      tools.querySelectorAll('button[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === ds.tool ? 'true' : 'false'));
      sizes.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.s === ds.size ? 'true' : 'false'));
      stamps.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.st === ds.stamp ? 'true' : 'false'));
      stamps.hidden = ds.tool !== 'stamp';
    }
    COLORS.forEach(c => swatches.appendChild(h('button', { type: 'button', class: 'swatch-btn', 'data-c': c[1], 'aria-label': c[0], style: 'background:' + c[1], onclick: () => { ds.color = c[1]; ds.tool = 'brush'; sync(); } })));
    [['brush', '✏️ Brush'], ['eraser', '🧽 Eraser'], ['stamp', '⭐ Stamps']].forEach(t => tools.appendChild(h('button', { type: 'button', class: 'btn', 'data-tool': t[0], onclick: () => { ds.tool = t[0]; sync(); } }, t[1])));
    [['Small', 6], ['Medium', 14], ['Big', 30]].forEach(s => sizes.appendChild(h('button', { type: 'button', class: 'btn size-btn', 'data-s': s[1], 'aria-label': s[0] + ' brush', onclick: () => { ds.size = s[1]; sync(); } },
      h('span', { class: 'size-dot', style: 'width:' + Math.max(6, s[1] * 0.8) + 'px;height:' + Math.max(6, s[1] * 0.8) + 'px', 'aria-hidden': 'true' }), s[0])));
    STAMPS.forEach(st => stamps.appendChild(h('button', { type: 'button', class: 'stamp-btn', 'data-st': st, 'aria-label': 'Stamp ' + st, onclick: () => { ds.stamp = st; ds.tool = 'stamp'; sync(); } }, st)));

    let clearArmed = 0;
    const clearBtn = h('button', { type: 'button', class: 'btn', onclick: () => {
      if (Date.now() - clearArmed < 3000) { pushUndo(); blank(); clearBtn.textContent = '🗑️ Clear'; clearArmed = 0; return; }
      clearArmed = Date.now(); clearBtn.textContent = 'Tap again to clear'; setTimeout(() => { clearBtn.textContent = '🗑️ Clear'; }, 3000);
    } }, '🗑️ Clear');
    const gallery = h('div', { class: 'gallery', 'aria-label': 'My saved drawings' });
    function renderGallery() {
      const list = SIT.progress().drawings || []; clear(gallery);
      if (!list.length) { gallery.appendChild(h('p', { class: 'muted' }, 'Pictures you keep appear here.')); return; }
      list.forEach((d, i) => gallery.appendChild(h('figure', { class: 'thumb' }, h('img', { src: d.img, alt: 'Saved drawing from ' + d.when }),
        h('figcaption', null, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Delete this drawing', onclick: () => { const gone = list.splice(i, 1)[0]; SIT.saveProgress(); renderGallery(); SIT.toast('Drawing deleted.', { label: 'Undo', fn: () => { list.splice(i, 0, gone); SIT.saveProgress(); renderGallery(); } }); } }, '✕')))));
    }
    function keep() {
      const t = document.createElement('canvas'); t.width = 360; t.height = Math.round(360 * H / W);
      t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
      const p = SIT.progress(); p.drawings = p.drawings || [];
      p.drawings.unshift({ img: t.toDataURL('image/png'), when: new Date().toLocaleString() });
      p.drawings = p.drawings.slice(0, 8);
      if (SIT.saveProgress()) { SIT.addStars(1); SIT.toast('Kept in your gallery! ⭐'); } else p.drawings.shift();
      renderGallery();
    }
    box.appendChild(h('div', { class: 'kid-head' }, backBtn(), h('h1', null, '🎨 Drawing Pad')));
    box.appendChild(h('div', { class: 'draw-layout' },
      h('div', { class: 'pad-wrap' }, canvas),
      h('div', { class: 'draw-tools' }, swatches, tools, sizes, stamps,
        h('div', { class: 'tools' },
          h('button', { type: 'button', class: 'btn', onclick: () => { const u = undo.pop(); if (u) ctx.putImageData(u, 0, 0); } }, '↩️ Undo'),
          clearBtn),
        h('div', { class: 'tools' },
          h('button', { type: 'button', class: 'btn', onclick: () => canvas.toBlob(b => { if (b) SIT.download('drawing-' + stamp() + '.png', b); }, 'image/png') }, '💾 Save PNG'),
          h('button', { type: 'button', class: 'btn', onclick: keep }, '🖼️ Keep in gallery')))));
    box.appendChild(h('section', { class: 'card' }, h('h2', { class: 'sub-h' }, 'My gallery'), gallery));
    box.appendChild(h('p', { class: 'fine' }, '“Save PNG” puts the picture in this computer’s Downloads folder. The gallery keeps small copies in this browser.'));
    sync(); renderGallery();
    SIT.on('mode', renderGallery);
  }

  /* ================= Story builder ================= */
  function buildStory(box) {
    const S = data.story;
    const STEPS = [['heroes', 'Who is the hero?'], ['places', 'Where does it happen?'], ['objects', 'What do they find?'], ['problems', 'Uh-oh! What goes wrong?'], ['friends', 'Who helps?'], ['endings', 'How does it end?']];
    const TEMPLATES = [
      'Once upon a time, in {place}, there lived {hero} called {name}. One morning, {name} found {object}. “What could this be for?” {name} wondered. But then {problem}! Luckily, {friend} came along, and together they {fix}. {ending}',
      'Far away, in {place}, {hero} named {name} was looking for an adventure. Under a pile of leaves, {name} spotted {object}. Just as {name} picked it up, {problem}. {name} felt worried, but {friend} said, “Don’t give up!” So they {fix}. {ending}',
      'This is the story of {name}, {hero} from {place}. {name} loved collecting things, and the very best thing was {object}. One day {problem}. {name} took a deep breath and asked {friend} for help. Together they {fix}, and {name} learned that friends make everything better. {ending}'
    ];
    let step = 0, choice = {}, tpl = 0;
    const stage = h('div', { class: 'story-stage' });
    const saved = h('div', { class: 'saved-stories' });
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
    function compose(name) {
      const c = choice; let t = TEMPLATES[tpl]
        .replace(/\{place\}/g, c.places.phrase).replace(/\{hero\}/g, c.heroes.phrase).replace(/\{name\}/g, name)
        .replace(/\{object\}/g, c.objects.phrase).replace(/\{problem\}/g, c.problems.phrase).replace(/\{friend\}/g, c.friends.phrase)
        .replace(/\{fix\}/g, c.problems.fix).replace(/\{ending\}/g, c.endings.phrase);
      return t.replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
    }
    function renderStep() {
      clear(stage);
      const [key, prompt] = STEPS[step];
      stage.appendChild(h('p', { class: 'step-dots', 'aria-label': 'Step ' + (step + 1) + ' of ' + STEPS.length }, STEPS.map((s, i) => h('span', { class: i < step ? 'done' : i === step ? 'now' : '', 'aria-hidden': 'true' }, i < step ? choice[s[0]].pic : '●'))));
      stage.appendChild(h('h2', { class: 'big-prompt', tabindex: '-1' }, prompt));
      stage.appendChild(SIT.speakButton(prompt, 'Hear it'));
      stage.appendChild(h('div', { class: 'pic-grid' }, S[key].map(o => h('button', {
        type: 'button', class: 'pic-btn', onclick: () => { choice[key] = o; if (step < STEPS.length - 1) { step++; renderStep(); } else { tpl = Math.floor(Math.random() * TEMPLATES.length); renderStory(); } }
      }, h('span', { class: 'pic', 'aria-hidden': 'true' }, o.pic), h('span', null, o.label)))));
      if (step > 0) stage.appendChild(h('button', { type: 'button', class: 'btn', onclick: () => { step--; renderStep(); } }, '⬅ Back'));
      const t = stage.querySelector('.big-prompt'); if (step > 0) t.focus();
    }
    function renderStory() {
      clear(stage);
      const name = h('input', { type: 'text', id: 'story-name', value: choice.heroes.name, maxlength: 24 });
      const title = h('input', { type: 'text', id: 'story-title', value: choice.heroes.name + ' and ' + choice.objects.phrase.replace(/^an? /, 'the '), maxlength: 60 });
      const text = h('textarea', { id: 'story-text', rows: 7, value: compose(choice.heroes.name) });
      name.addEventListener('change', () => { text.value = compose(name.value.trim() || choice.heroes.name); });
      stage.appendChild(h('div', { class: 'story-pics', 'aria-hidden': 'true' }, STEPS.map(s => choice[s[0]].pic).join(' ')));
      stage.appendChild(h('div', { class: 'form-grid' },
        h('label', { for: 'story-title' }, 'Story title'), title,
        h('label', { for: 'story-name' }, 'Hero’s name'), name));
      stage.appendChild(h('label', { for: 'story-text', class: 'sr-only' }, 'Your story'));
      stage.appendChild(text);
      stage.appendChild(h('p', { class: 'fine' }, 'You can change any words in the story. It’s yours!'));
      stage.appendChild(h('div', { class: 'tools' },
        SIT.speakButton(() => title.value + '. ' + text.value, 'Read my story', 'btn-primary'),
        h('button', { type: 'button', class: 'btn', onclick: () => { tpl = (tpl + 1) % TEMPLATES.length; text.value = compose(name.value.trim() || choice.heroes.name); } }, '🔀 Tell it another way'),
        h('button', { type: 'button', class: 'btn', onclick: () => {
          const p = SIT.progress(); p.stories = p.stories || [];
          p.stories.unshift({ id: SIT.uid(), title: title.value.trim() || 'My story', text: text.value.trim(), pics: STEPS.map(s => choice[s[0]].pic).join(''), when: new Date().toLocaleDateString() });
          p.stories = p.stories.slice(0, 30); SIT.saveProgress(); SIT.addStars(1); SIT.toast('Story saved! ⭐'); renderSaved();
        } }, '💾 Save story'),
        h('button', { type: 'button', class: 'btn', onclick: () => { step = 0; choice = {}; renderStep(); } }, '✨ New story')));
      text.focus();
    }
    function renderSaved() {
      const list = SIT.progress().stories || []; clear(saved);
      saved.appendChild(h('h2', { class: 'sub-h' }, 'My stories'));
      if (!list.length) { saved.appendChild(h('p', { class: 'muted' }, 'Saved stories appear here.')); return; }
      list.forEach((s, i) => saved.appendChild(h('details', { class: 'story-item' },
        h('summary', null, h('span', { 'aria-hidden': 'true' }, s.pics + ' '), s.title, h('small', null, '  ' + s.when)),
        h('p', null, s.text),
        h('div', { class: 'tools' }, SIT.speakButton(() => s.title + '. ' + s.text, 'Read it'),
          h('button', { type: 'button', class: 'btn', onclick: () => SIT.download((s.title || 'story').replace(/[^\w -]+/g, '') + '.txt', s.title + '\n\n' + s.text + '\n\nMade in Stark IntraTheater.\n') }, '💾 Save as file'),
          h('button', { type: 'button', class: 'btn', onclick: () => { const gone = list.splice(i, 1)[0]; SIT.saveProgress(); renderSaved(); SIT.toast('Story deleted.', { label: 'Undo', fn: () => { list.splice(i, 0, gone); SIT.saveProgress(); renderSaved(); } }); } }, '🗑️ Delete')))));
    }
    box.appendChild(h('div', { class: 'kid-head' }, backBtn(), h('h1', null, '📚 Story Builder')));
    box.appendChild(h('section', { class: 'card' }, stage));
    box.appendChild(h('section', { class: 'card' }, saved));
    renderStep(); renderSaved();
    SIT.on('mode', renderSaved);
  }

  /* ================= Maths garden ================= */
  function buildMath(box) {
    const LEVELS = [['1', '🍎 Count and add', 'Sums up to 10 with pictures'], ['2', '➕➖ Add and take away', 'Up to 20'], ['3', '✖️ Times tables 2, 5, 10', 'Skip counting'], ['4', '🧠 All times tables', 'Up to 10 × 10']];
    const FRUIT = ['🍎', '🍓', '🐞', '⭐', '🌼', '🐟'];
    const host = h('div', { class: 'quiz-host' });
    const garden = h('p', { class: 'garden', 'aria-live': 'polite' });
    const r = n => Math.floor(Math.random() * n);
    function near(ans, count) {
      const set = new Set([ans]); let guard = 0;
      while (set.size < count && guard++ < 50) { const d = ans + (r(2) ? 1 : -1) * (1 + r(3)); if (d >= 0) set.add(d); }
      return shuffle(Array.from(set)).map(String);
    }
    function make(level) {
      const qs = [];
      for (let i = 0; i < 10; i++) {
        let a, b, ans, q, say, big = '';
        if (level === '1') { a = 1 + r(5); b = 1 + r(5); ans = a + b; const f = pick(FRUIT); big = f.repeat(a) + '  +  ' + f.repeat(b); q = 'What is ' + a + ' + ' + b + '?'; say = 'What is ' + a + ' plus ' + b + '?'; }
        else if (level === '2') {
          if (r(2)) { a = r(11) + 2; b = r(9) + 1; ans = a + b; q = 'What is ' + a + ' + ' + b + '?'; say = 'What is ' + a + ' plus ' + b + '?'; }
          else { a = r(11) + 9; b = r(9) + 1; ans = a - b; q = 'What is ' + a + ' − ' + b + '?'; say = 'What is ' + a + ' minus ' + b + '?'; }
        } else {
          a = level === '3' ? pick([2, 5, 10]) : 2 + r(9); b = 1 + r(10); ans = a * b;
          q = 'What is ' + a + ' × ' + b + '?'; say = 'What is ' + a + ' times ' + b + '?';
        }
        qs.push({ q, say, big, choices: near(ans, 3), answer: String(ans) });
      }
      return qs;
    }
    function updateGarden() {
      const n = SIT.progress().stars || 0;
      garden.textContent = n ? 'Your garden: ' + '🌷🌻🌼🌸'.repeat(Math.ceil(Math.min(n, 40) / 4)).slice(0, Math.min(n, 40) * 2) + (n > 40 ? ' and more!' : '') + '  (' + n + ' stars)' : 'Every right answer grows a flower and earns a star.';
    }
    function menu() {
      clear(host);
      const best = SIT.progress().best;
      host.appendChild(h('div', { class: 'quiz-menu' }, LEVELS.map(L => h('button', {
        type: 'button', class: 'menu-card', onclick: () => {
          const run = () => SIT.runQuiz(host, { questions: make(L[0]), kid: true, bestKey: 'math-' + L[0], again: run, onDone: menu });
          run();
        }
      }, h('span', { class: 'menu-title' }, L[1]), h('span', { class: 'muted' }, L[2]), best['math-' + L[0]] ? h('span', { class: 'badge' }, 'Best ' + best['math-' + L[0]].score + '/10') : null))));
    }
    box.appendChild(h('div', { class: 'kid-head' }, backBtn(), h('h1', null, '🌻 Maths Garden')));
    box.appendChild(garden);
    box.appendChild(h('section', { class: 'card' }, host));
    menu(); updateGarden();
    SIT.on('progress', updateGarden); SIT.on('mode', () => { updateGarden(); menu(); });
  }

  /* ================= Spelling bee ================= */
  function buildSpell(box) {
    const host = h('div', { class: 'spell' });
    let words = [], wi = 0, level = 1, placed = [], tiles = [], score = 0, missed = false;
    function start(lv) { level = lv; words = sample(data.spelling.filter(w => w.level === lv), 8); wi = 0; score = 0; round(); }
    function round() {
      const w = words[wi]; placed = []; missed = false;
      let letters = w.word.split('');
      do { letters = shuffle(letters); } while (letters.join('') === w.word && w.word.length > 1);
      tiles = letters.map((ch, i) => ({ ch, i, used: false }));
      draw();
      if (SIT.canSpeak) setTimeout(() => SIT.speak(w.word), 250);
    }
    function draw(msg, cls) {
      const w = words[wi]; clear(host);
      host.appendChild(h('p', { class: 'quiz-progress' }, 'Word ' + (wi + 1) + ' of ' + words.length + '  ·  ' + score + ' spelled'));
      host.appendChild(h('div', { class: 'spell-pic', role: 'img', 'aria-label': 'Picture clue' }, w.pic));
      host.appendChild(h('div', { class: 'tools center' },
        SIT.speakButton(() => w.word, 'Hear the word', 'btn-primary'),
        h('button', { type: 'button', class: 'btn', onclick: hint }, '💡 Hint')));
      host.appendChild(h('div', { class: 'slots', 'aria-label': 'Your word so far: ' + (placed.map(p => tiles[p].ch).join('') || 'empty') },
        w.word.split('').map((_, i) => h('button', {
          type: 'button', class: 'slot' + (placed[i] !== undefined ? ' filled' : ''), 'aria-label': placed[i] !== undefined ? 'Letter ' + tiles[placed[i]].ch + ', tap to take it back' : 'Empty space',
          onclick: () => { if (placed[i] === undefined) return; tiles[placed[i]].used = false; placed.splice(i); draw(); }
        }, placed[i] !== undefined ? tiles[placed[i]].ch : ''))));
      host.appendChild(h('div', { class: 'letter-tiles', role: 'group', 'aria-label': 'Letters' }, tiles.map((t, ti) => h('button', {
        type: 'button', class: 'tile-letter', disabled: t.used, 'aria-label': 'Letter ' + t.ch, onclick: () => put(ti)
      }, t.ch))));
      host.appendChild(h('p', { class: 'quiz-feedback ' + (cls || ''), role: 'status' }, msg || ''));
      if (cls === 'good') host.appendChild(h('div', { class: 'tools center' }, h('button', { type: 'button', class: 'btn btn-primary btn-lg', id: 'spell-next', onclick: next }, wi + 1 < words.length ? 'Next word ➡' : 'Finish 🎉')));
      const nb = host.querySelector('#spell-next'); if (nb) nb.focus();
    }
    function put(ti) {
      const w = words[wi]; if (placed.length >= w.word.length || tiles[ti].used) return;
      tiles[ti].used = true; placed.push(ti);
      if (placed.length < w.word.length) { draw(); host.querySelector('.tile-letter:not([disabled])') && host.querySelector('.tile-letter:not([disabled])').focus(); return; }
      const guess = placed.map(p => tiles[p].ch).join('');
      if (guess === w.word) {
        if (!missed) { score++; SIT.addStars(1); }
        draw(pick(['Brilliant spelling!', 'You did it!', 'Bee-autiful!', 'Perfect!']) + ' ' + w.word.toUpperCase().split('').join(' - '), 'good');
        SIT.speak(w.word.split('').join(', ') + '. ' + w.word + '!');
      } else {
        missed = true;
        const keep = []; for (let i = 0; i < placed.length; i++) { if (tiles[placed[i]].ch === w.word[i]) keep.push(placed[i]); else break; }
        placed.slice(keep.length).forEach(p => { tiles[p].used = false; });
        placed = keep;
        draw(placed.length ? 'Almost! The letters still in place are right. Try the rest again.' : 'Almost! Have another go.', 'try');
      }
    }
    function hint() {
      const w = words[wi]; const need = w.word[placed.length]; if (!need) return;
      missed = true;
      const ti = tiles.findIndex(t => !t.used && t.ch === need);
      if (ti >= 0) put(ti);
    }
    function next() {
      wi++;
      if (wi < words.length) { round(); return; }
      const rec = SIT.setBest('spell-' + level, score, words.length);
      clear(host).appendChild(h('div', { class: 'quiz-done' }, h('div', { class: 'quiz-stars', 'aria-hidden': 'true' }, '🐝 ⭐'),
        h('h2', { tabindex: '-1' }, score + ' of ' + words.length + ' spelled first time'), rec ? h('p', { class: 'badge' }, 'New personal best') : null,
        h('div', { class: 'tools center' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => start(level) }, 'Play again'), h('button', { type: 'button', class: 'btn', onclick: menu }, 'Change level'))));
      host.querySelector('.quiz-done h2').focus();
    }
    function menu() {
      clear(host).appendChild(h('div', { class: 'quiz-menu' },
        [[1, '🐣 Easy', '3-letter words'], [2, '🐥 Medium', '4 and 5 letters'], [3, '🦅 Tricky', '6 and 7 letters']].map(L => h('button', { type: 'button', class: 'menu-card', onclick: () => start(L[0]) },
          h('span', { class: 'menu-title' }, L[1]), h('span', { class: 'muted' }, L[2])))));
    }
    host.addEventListener('keydown', e => {
      if (!words.length || !tiles.length || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[a-z]$/i.test(e.key)) { const ti = tiles.findIndex(t => !t.used && t.ch === e.key.toLowerCase()); if (ti >= 0) { e.preventDefault(); put(ti); } }
      else if (e.key === 'Backspace' && placed.length) { e.preventDefault(); tiles[placed.pop()].used = false; draw(); }
    });
    box.appendChild(h('div', { class: 'kid-head' }, backBtn(), h('h1', null, '🐝 Spelling Bee')));
    box.appendChild(h('section', { class: 'card' }, host));
    box.appendChild(h('p', { class: 'fine' }, 'Tip: on a keyboard you can type the letters, and Backspace takes one back.'));
    menu();
  }

  /* ================= hub + routing ================= */
  const BUILDERS = { draw: buildDraw, story: buildStory, math: buildMath, spell: buildSpell };
  function mount(el) {
    root = el; root.classList.add('kids');
    hub = h('div', null,
      h('header', { class: 'view-head' }, h('h1', null, 'Kids Zone'), h('p', { class: 'lede' }, 'Pick something to do!')),
      h('div', { class: 'kid-tiles' }, ACTS.map(a => h('a', { class: 'kid-tile', href: '#/kids/' + a[0] },
        h('span', { class: 'kid-tile-icon', 'aria-hidden': 'true' }, a[1]), h('span', { class: 'kid-tile-title' }, a[2]), h('span', { class: 'kid-tile-text' }, a[3])))),
      h('div', { class: 'kid-tiles small' },
        h('a', { class: 'kid-tile', href: '#/history?tab=cards' }, h('span', { class: 'kid-tile-icon', 'aria-hidden': 'true' }, '🏛️'), h('span', { class: 'kid-tile-title' }, 'History stories')),
        h('a', { class: 'kid-tile', href: '#/geo?tab=quiz' }, h('span', { class: 'kid-tile-icon', 'aria-hidden': 'true' }, '🌍'), h('span', { class: 'kid-tile-title' }, 'World quiz')),
        h('a', { class: 'kid-tile', href: '#/theater' }, h('span', { class: 'kid-tile-icon', 'aria-hidden': 'true' }, '🎬'), h('span', { class: 'kid-tile-title' }, 'Theater')),
        h('a', { class: 'kid-tile', href: '#/write' }, h('span', { class: 'kid-tile-icon', 'aria-hidden': 'true' }, '✍️'), h('span', { class: 'kid-tile-title' }, 'Story Studio')),
        h('a', { class: 'kid-tile', href: '#/museum' }, h('span', { class: 'kid-tile-icon', 'aria-hidden': 'true' }, '🏺'), h('span', { class: 'kid-tile-title' }, 'My museum'))),
      SIT.canSpeak ? null : h('p', { class: 'fine' }, 'Read-aloud is not available in this browser, so the 🔊 buttons are hidden.'));
    root.appendChild(hub);
    ACTS.forEach(a => { boxes[a[0]] = h('div', { class: 'kid-act', hidden: true }); root.appendChild(boxes[a[0]]); });
  }
  SIT.view('kids', {
    title: 'Kids Zone', mount,
    show(r) {
      const sub = BUILDERS[r.sub] ? r.sub : '';
      hub.hidden = !!sub;
      Object.keys(boxes).forEach(k => { boxes[k].hidden = k !== sub; });
      if (sub && !built[sub]) { built[sub] = true; BUILDERS[sub](boxes[sub]); }
      if (sub) { const t = boxes[sub].querySelector('h1'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }
    }
  });
})();
