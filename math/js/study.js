/* Stark Math. Study tools: the Study hub, spaced-repetition Review, the placement check, printable worksheets, word
   problems (built in and your own), the step-by-step algebra checker, fact fluency sprints, the curriculum map and the
   parent and carer report. Madeline's words here are written rules, like everywhere else in the app. */
(function () {
  'use strict';
  const SM = window.SM;
  const { h, clear, btn } = SM;
  const V = SM.views;
  const DAY = 86400000;

  /* reading support for the active learner */
  SM.readingMode = () => (SM.profile().prefs || {}).reading || 'standard';
  SM.rd = (t, seen) => (SM.reading ? SM.reading.adjust(t, SM.readingMode(), seen) : t);
  SM.setReading = mode => { const p = SM.profile(); p.prefs = Object.assign({}, p.prefs, { reading: mode }); SM.saveStore(); };
  const head = (title, sub) => h('div', { class: 'page-head' }, h('a', { href: '#/study', class: 'back' }, '← Study'), h('h1', null, title), sub ? h('p', { class: 'muted' }, sub) : null);
  const fmtDate = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  /* print view with its own buttons (Print, Download as text) */
  function printView(html, name, text) {
    const ov = h('div', { class: 'print-overlay', role: 'dialog', 'aria-label': 'Print view' });
    const close = btn('Close', () => ov.remove(), '');
    ov.append(h('div', { class: 'print-bar row' }, btn('Print', () => { try { window.print(); } catch (e) { SM.toast('Printing is not available here; use the download instead.'); } }, 'btn-primary'),
      text ? btn('Download (text)', () => SM.download(name + '.txt', text, 'text/plain;charset=utf-8'), '') : null, close), h('div', { class: 'print-page', html }));
    document.body.appendChild(ov); close.focus();
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') ov.remove(); });
    return ov;
  }
  SM.printView = printView;

  /* ---------- Study hub ---------- */
  V.study = function (main) {
    const data = SM.data(), due = SM.learn.dueList(data.mastery).length, pl = data.placement || {};
    const tools = [
      ['#/review', 'Review', due ? due + ' skill' + (due === 1 ? '' : 's') + ' due today.' : 'Nothing due right now.', 'Spaced repetition brings each skill back just before it is forgotten: a day later, then 3 days, then longer.'],
      ['#/placement', 'Placement check', pl.band ? 'Last result: ' + pl.bandName + '.' : 'About 10 questions.', 'A short adaptive test that finds the right starting level.'],
      ['#/words', 'Word problems', 'Story problems with a four-step plan.', 'Practise built-in stories, or write your own with number slots and an answer formula.'],
      ['#/algebra', 'Algebra step checker', 'Check working line by line.', 'Type each line of your working; every step is checked exactly and the first slip is explained.'],
      ['#/fluency', 'Fact fluency', 'One-minute sprints.', 'Addition, subtraction, times tables and division facts, with a grid showing which facts are fluent.'],
      ['#/worksheets', 'Worksheets', 'Print with answer keys.', 'Build a sheet from any skills at any level; the code rebuilds the same sheet and key later.'],
      ['#/curriculum', 'Curriculum map', 'Grade bands and reference codes.', 'Every skill by grade band, with ages, international equivalents and US standard codes.'],
      ['#/countrymaps', 'Country curriculum maps', 'India, Australia, Brazil and the IB.', 'Pick a country and a grade to see what Stark Math covers and what it does not. Printable on A4.'],
      ['#/report', 'Parent and carer report', 'Printable progress summary.', 'Activity, accuracy, strengths, skills to work on and suggestions for home.'],
    ];
    main.append(h('div', { class: 'page-head' }, h('h1', null, 'Study'), h('p', { class: 'muted' }, 'Tools for reviewing, checking your level, printing and tracking progress. All of it runs offline on this device.')),
      h('div', { class: 'tool-grid' }, tools.map(([href, title, status, blurb]) => h('a', { class: 'tool-card', href }, h('strong', null, title), h('span', { class: 'tool-status' }, status), h('span', { class: 'muted' }, blurb)))));
  };

  /* ---------- Review (spaced repetition) ---------- */
  V.review = function (main) {
    const data = SM.data(), now = Date.now(), due = SM.learn.dueList(data.mastery, now), fc = SM.learn.forecast(data.mastery, now, 7);
    const max = Math.max(1, ...fc), names = fc.map((_, i) => (i === 0 ? 'Today' : fmtDate(now + i * DAY)));
    const upcoming = Object.keys(data.mastery).filter(id => SM.SKILL[id] && data.mastery[id].n && SM.learn.dueAt(data.mastery[id]) > now).sort((a, b) => SM.learn.dueAt(data.mastery[a]) - SM.learn.dueAt(data.mastery[b])).slice(0, 8);
    main.append(head('Review', 'Spaced repetition: a skill you answer cleanly comes back after 1 day, then 3 days, then a longer gap each time. A slip brings it back at once.'),
      h('section', { class: 'card' }, h('h2', null, due.length ? due.length + ' skill' + (due.length === 1 ? '' : 's') + ' due now' : 'Nothing due right now'),
        due.length ? h('ul', { class: 'sugg' }, due.slice(0, 12).map(id => h('li', null, h('a', { href: '#/lesson/' + id }, SM.SKILL[id].title), h('span', { class: 'muted' }, ' · ' + SM.subjectName(SM.SKILL[id].subject) + ' · ' + SM.learn.band(data.mastery[id]))))) : h('p', { class: 'muted' }, Object.keys(data.mastery).length ? 'Come back when the next review is due, or practise something new.' : 'Practise a few skills first; they will appear here when they are due.'),
        h('div', { class: 'row wrap' }, due.length ? btn('Start review (' + Math.min(15, due.length) + ')', () => { clear(main); SM.practice(main, { skills: due, order: due.slice(0, 15), count: Math.min(15, due.length), adaptive: false, title: 'Review' }); }, 'btn-primary btn-big') : btn('Mixed practice', () => { location.hash = '#/practice?mode=mixed'; }, 'btn-primary'))),
      h('section', { class: 'card' }, h('h2', null, 'Next 7 days'), h('div', { class: 'fc-bars', role: 'img', 'aria-label': 'Reviews due: ' + fc.map((n, i) => names[i] + ' ' + n).join(', ') }, fc.map((n, i) => h('div', { class: 'fc-col' }, h('span', { class: 'fc-n' }, String(n)), h('span', { class: 'fc-bar', style: 'height:' + Math.round(6 + 84 * n / max) + 'px' }), h('span', { class: 'fc-day' }, names[i])))),
        upcoming.length ? h('ul', { class: 'sugg' }, upcoming.map(id => h('li', null, h('span', null, SM.SKILL[id].title), h('span', { class: 'muted' }, ' · due ' + fmtDate(SM.learn.dueAt(data.mastery[id])) + (data.mastery[id].ivl ? ' · every ' + data.mastery[id].ivl + ' day' + (data.mastery[id].ivl === 1 ? '' : 's') : ''))))) : null));
  };

  /* ---------- Placement check ---------- */
  V.placement = function (main) {
    const data = SM.data(), pl = data.placement || {};
    const grp = h('select', { 'aria-label': 'Subject area' }, Object.keys(SM.placement.GROUPS).map(k => h('option', { value: k }, SM.placement.GROUPS[k].name)));
    const startSel = h('select', { 'aria-label': 'Starting point' }, SM.curriculum.BANDS.map(b => h('option', { value: b.id, selected: b.id === (SM.level().lv === 0 ? 'g35' : SM.level().lv >= 3 ? 'g912' : 'g68') }, b.name + ' (ages ' + b.ages + ')')));
    main.append(head('Placement check', 'About 10 questions, chosen to find your level quickly. There is no time limit and no penalty: it only sets a starting level, which you can change any time.'),
      pl.band ? h('section', { class: 'card' }, h('h2', null, 'Last result'), h('p', null, pl.bandName + ' · ' + pl.correct + ' of ' + pl.total + ' correct · ' + String(pl.date || '').slice(0, 10)), h('p', { class: 'muted' }, pl.note || '')) : null,
      h('section', { class: 'card' }, h('h2', null, 'Start'), h('div', { class: 'form-grid' }, h('label', null, 'Subject area', grp), h('label', null, 'Start near', startSel)),
        h('div', { class: 'row' }, btn('Begin the placement check', () => run(clear(main), grp.value, startSel.value), 'btn-primary btn-big'))));
  };
  function run(main, group, startBand) {
    const st = SM.placement.start({ group, start: startBand, seed: SM.uid() }), data = SM.data();
    const box = h('section', { class: 'prob-card', 'aria-label': 'Placement question' }), info = h('p', { class: 'muted', 'aria-live': 'polite' });
    main.append(head('Placement check'), box, info);
    let pr = null;
    function ask() {
      const q = SM.placement.next(st); clear(box);
      if (!q) return finish();
      pr = SM.generate(q.skill, q.lv, q.df, q.seed);
      const input = h('input', { class: 'ans-input', 'aria-label': 'Your answer', autocomplete: 'off', spellcheck: 'false' }), fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
      const submit = v => {
        const res = SM.check(pr.ans, v);
        if (res.verdict === 'empty' || res.verdict === 'syntax') { fb.className = 'feedback fb-info'; fb.textContent = res.msg; return; }
        record(res.ok || !!res.equal);
      };
      const record = ok => { data.mastery[q.skill] = SM.learn.update(data.mastery[q.skill], { correct: ok, hints: 0, choice: pr.ans.k === 'choice' }); SM.placement.answer(st, ok); ask(); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(input.value); } });
      const kb = SM.mathkb.mount(input, { onEnter: () => submit(input.value), enterLabel: 'Submit my answer', open: SM.prefs().keypad }); kb.setKind(pr.ans.k); input.setAttribute('aria-describedby', kb.status.id);
      box.append(h('div', { class: 'prob-meta' }, h('span', { class: 'badge' }, 'Question ' + (st.log.length + 1)), h('span', { class: 'badge badge-soft' }, SM.curriculum.BAND[q.band].name)), h('h2', { class: 'prob-title' }, SM.SKILL[q.skill].title),
        h('div', { class: 'prob-q', html: SM.renderText(SM.rd(pr.q)) }), pr.pic ? h('div', { class: 'prob-pic', html: SM.picture(pr.pic) }) : null,
        pr.ans.k === 'choice' ? h('div', { class: 'choices', role: 'group', 'aria-label': 'Choices' }, pr.ans.options.map((o, i) => h('button', { type: 'button', class: 'btn choice', html: SM.renderText(/[\d/^]/.test(o) && !/[a-zA-Z]{3}/.test(o) ? '$' + o + '$' : o), onclick: () => submit(String(i)) })))
          : h('div', { class: 'ans-row' }, input, kb.toggle), pr.ans.k === 'choice' ? null : h('div', null, kb.preview, kb.msg, kb.status, kb.panel),
        h('div', { class: 'row btn-row' }, pr.ans.k === 'choice' ? null : btn('Submit', () => submit(input.value), 'btn-primary'), btn('I don\'t know this yet', () => record(false), 'btn-ghost')), fb);
      info.textContent = 'Answers are not marked during the check, so you can keep going. You will see how you did at the end.';
      setTimeout(() => { const f = box.querySelector('input, .choice'); if (f) f.focus({ preventScroll: true }); }, 30);
    }
    function finish() {
      const r = SM.placement.result(st); data.placement = Object.assign({ date: new Date().toISOString() }, r); SM.saveData();
      const preset = SM.PRESETS.find(p => p.id === r.preset);
      clear(box).append(h('h2', null, 'Result: ' + r.bandName), h('p', null, r.note), h('p', { class: 'muted' }, r.correct + ' of ' + r.total + ' correct. Suggested setting: ' + SM.LEVELS[r.lv].name + ', ' + SM.DIFFS[r.df].name + '.'),
        h('ul', { class: 'sum-list' }, r.log.map(x => h('li', { class: x.ok ? 'ok' : 'miss' }, (x.ok ? '✓ ' : '• ') + SM.SKILL[x.skill].title + ' (' + SM.curriculum.BAND[x.band].short + ')'))),
        h('div', { class: 'row wrap' }, btn('Use this level', () => { SM.setLevel(r.lv, r.df, preset ? preset.id : ''); SM.toast('Level set to ' + SM.LEVELS[r.lv].name + ', ' + SM.DIFFS[r.df].name + '.'); location.hash = '#/home'; }, 'btn-primary'), btn('Keep my current level', () => { location.hash = '#/study'; }, '')));
      info.textContent = '';
    }
    ask();
  }

  V.worksheets = function (main) { main.append(h('h1', null, 'Worksheets'), window.StarkTrial.card('worksheets')); };
  /* ---------- Word problems ---------- */
  V.words = function (main, q) {
    const data = SM.data(), { lv } = SM.level(), tab = q.tab === 'build' ? 'build' : 'stories';
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Word problems' }, [['stories', 'Story problems'], ['build', 'Build your own']].map(([id, name]) => h('a', { role: 'tab', 'aria-selected': String(id === tab), class: 'tab' + (id === tab ? ' on' : ''), href: '#/words' + (id === 'build' ? '?tab=build' : '') }, name)));
    main.append(head('Word problems', 'Every worked solution follows four steps: Understand the story, Plan, Solve, then Check the answer makes sense.'), tabs);
    if (tab === 'stories') {
      const skills = SM.SKILLS.filter(s => s.subject === 'words');
      main.append(h('section', { class: 'card' }, h('h2', null, 'Built-in story problems'), h('ul', { class: 'skill-list' }, skills.map(s => h('li', { class: 'skill' + (SM.inRange(s, lv) ? '' : ' off-level') }, h('div', { class: 'skill-text' }, h('a', { href: '#/lesson/' + s.id, class: 'skill-name' }, s.title), h('span', { class: 'muted' }, SM.learn.band(data.mastery[s.id]) + ' · ' + SM.LEVELS[s.lv[0]].name + ' to ' + SM.LEVELS[s.lv[1]].name)),
        btn('Practise', () => { location.hash = '#/practice?skill=' + s.id; }, 'btn-small btn-ghost', { 'aria-label': 'Practise ' + s.title })))),
        h('div', { class: 'row' }, btn('Mixed story practice', () => { location.hash = '#/practice?subject=words'; }, 'btn-primary'))));
      return;
    }
    buildTab(main, data);
  };
  function buildTab(main, data) {
    const sets = data.wordsets = data.wordsets || [];
    const listBox = h('section', { class: 'card' }), editBox = h('section', { class: 'card' });
    const rerender = () => { drawList(); };
    function drawList() {
      clear(listBox).append(h('h2', null, 'Your word problems'), sets.length ? h('ul', { class: 'sugg' }, sets.map(t => h('li', null, h('strong', { class: 'grow' }, t.title),
        btn('Practise', () => practiseSet(t), 'btn-small btn-primary', { 'aria-label': 'Practise ' + t.title }), btn('Edit', () => edit(t), 'btn-small', { 'aria-label': 'Edit ' + t.title }),
        btn('Delete', () => { const i = sets.indexOf(t); if (i >= 0) { sets.splice(i, 1); SM.saveData(); rerender(); edit(null); } }, 'btn-small btn-ghost', { 'aria-label': 'Delete ' + t.title })))) : h('p', { class: 'muted' }, 'None yet. Write one below, or load the example.'),
        h('div', { class: 'row wrap' }, sets.length ? btn('Practise all (mixed)', () => practiseSet(null), 'btn-primary btn-small') : null,
          sets.length ? btn('Share as a file', () => SM.download('stark-math-word-problems.json', JSON.stringify(SM.wordsets.toFile(sets), null, 1), 'application/json'), 'btn-small') : null,
          btn('Import a file', () => SM.pickFile('.json', txt => { const r = SM.wordsets.fromFile(txt); if (!r.ok) { SM.toast(r.error); return; } let n = 0; r.sets.forEach(t => { if (sets.length < SM.wordsets.MAX_SETS) { t.id = SM.uid(); sets.push(t); n++; } }); SM.saveData(); SM.toast('Imported ' + n + ' word problem' + (n === 1 ? '' : 's') + '.'); rerender(); }), 'btn-small')));
    }
    function edit(t0) {
      const t = t0 ? JSON.parse(JSON.stringify(t0)) : { title: '', text: '', vars: {}, formula: '', unit: '', whole: true, positive: true };
      const titleIn = h('input', { value: t.title, maxlength: 80, 'aria-label': 'Title' });
      const textIn = h('textarea', { rows: 3, maxlength: 600, 'aria-label': 'Story text', placeholder: '{name} has {a} apples and buys {b} more. How many apples now?' }); textIn.value = t.text;
      const formulaIn = h('input', { value: t.formula, maxlength: 120, 'aria-label': 'Answer formula', placeholder: 'a + b' });
      const unitIn = h('input', { value: t.unit || '', maxlength: 30, 'aria-label': 'Unit (optional)', placeholder: 'apples' });
      const whole = h('input', { type: 'checkbox', checked: t.whole !== false }), pos = h('input', { type: 'checkbox', checked: t.positive !== false });
      const varsBox = h('div', { class: 'wp-vars' }), out = h('div', { class: 'wp-preview', 'aria-live': 'polite' });
      const varRow = (k, v) => h('div', { class: 'row wrap wp-var', 'data-k': k }, h('strong', null, '{' + k + '}'), h('label', null, 'from ', h('input', { type: 'number', step: 'any', value: v.lo, class: 'v-lo', 'aria-label': 'Slot ' + k + ' from' })), h('label', null, 'to ', h('input', { type: 'number', step: 'any', value: v.hi, class: 'v-hi', 'aria-label': 'Slot ' + k + ' to' })), h('label', null, 'step ', h('input', { type: 'number', step: 'any', value: v.step, class: 'v-step', 'aria-label': 'Slot ' + k + ' step' })));
      const syncVars = () => {
        const want = [...new Set(SM.wordsets.slotsIn(textIn.value).concat((formulaIn.value.match(/[a-h]/g) || [])))].sort(), cur = read().vars;
        clear(varsBox).append(...want.map(k => varRow(k, cur[k] || t.vars[k] || { lo: 1, hi: 10, step: 1 })));
        if (!want.length) varsBox.append(h('p', { class: 'muted' }, 'Put number slots in the story like {a} and {b}. {name} and {name2} become names.'));
      };
      const read = () => { const vars = {}; varsBox.querySelectorAll('.wp-var').forEach(r => { vars[r.dataset.k] = { lo: +r.querySelector('.v-lo').value, hi: +r.querySelector('.v-hi').value, step: +r.querySelector('.v-step').value }; }); return { id: t.id, title: titleIn.value.trim(), text: textIn.value, vars, formula: formulaIn.value.trim(), unit: unitIn.value.trim(), whole: whole.checked, positive: pos.checked }; };
      const preview = () => {
        const cur = read(), bad = SM.wordsets.validate(cur); clear(out);
        if (bad) { out.append(h('p', { class: 'feedback fb-info' }, 'Not ready: ' + bad + '.')); return false; }
        for (let i = 0; i < 3; i++) { const inst = SM.wordsets.instance(cur, 'pv' + i); out.append(inst.error ? h('p', { class: 'feedback fb-info' }, inst.error) : h('p', null, h('span', null, inst.q + ' '), h('strong', null, '→ ' + inst.shown + (inst.unit ? ' ' + inst.unit : '')))); if (inst.error) return false; }
        return true;
      };
      textIn.addEventListener('input', syncVars); formulaIn.addEventListener('change', syncVars);
      clear(editBox).append(h('h2', null, t0 ? 'Edit: ' + t0.title : 'New word problem'),
        h('div', { class: 'form-grid' }, h('label', null, 'Title', titleIn), h('label', null, 'Answer formula (use the slot letters)', formulaIn), h('label', null, 'Unit (optional)', unitIn)),
        h('label', { class: 'stack' }, 'Story (use {a} to {h} for numbers, {name} and {name2} for names)', textIn), varsBox,
        h('label', { class: 'check' }, whole, ' Only use numbers that give a whole-number answer'), h('label', { class: 'check' }, pos, ' Only use numbers that give a positive answer'),
        h('div', { class: 'row wrap' }, btn('Preview', preview, ''), btn(t0 ? 'Save changes' : 'Save', () => {
          if (!preview()) { SM.toast('Fix the problem shown under Preview first.'); return; }
          const c = SM.wordsets.clean(read());
          if (t0) { const i = sets.indexOf(t0); if (i >= 0) sets[i] = c; } else { if (sets.length >= SM.wordsets.MAX_SETS) { SM.toast('You can keep up to ' + SM.wordsets.MAX_SETS + ' word problems.'); return; } c.id = SM.uid(); sets.push(c); }
          SM.saveData(); SM.toast('Saved.'); rerender(); edit(null);
        }, 'btn-primary'), t0 ? null : btn('Load the example', () => { const e = SM.wordsets.EXAMPLE; titleIn.value = e.title; textIn.value = e.text; formulaIn.value = e.formula; unitIn.value = e.unit; t.vars = e.vars; syncVars(); preview(); }, 'btn-ghost')), out);
      syncVars();
    }
    function practiseSet(only) {
      const pool = only ? [only] : sets.slice(); let n = 0, ok = 0;
      const box = h('section', { class: 'prob-card' }); clear(main).append(head('Word problems: practice'), box);
      const next = () => {
        const t = pool[Math.floor(Math.random() * pool.length)], inst = SM.wordsets.instance(t, SM.uid()); clear(box);
        if (inst.error) { box.append(h('p', null, inst.error)); return; }
        const input = h('input', { class: 'ans-input', 'aria-label': 'Your answer', autocomplete: 'off' }), fb = h('div', { class: 'feedback', 'aria-live': 'polite' }), stepsEl = h('ol', { class: 'steps' });
        let done = false;
        const check = () => { if (done) return; const r = SM.wordsets.checkAnswer(inst, input.value); if (r.verdict === 'empty' || r.verdict === 'syntax') { fb.className = 'feedback fb-info'; fb.textContent = r.msg; return; } n++; if (r.ok) ok++; done = true; fb.className = 'feedback ' + (r.ok ? 'fb-ok' : 'fb-bad'); fb.textContent = (r.ok ? 'Correct. ' : 'Not quite: the answer is ' + inst.shown + (inst.unit ? ' ' + inst.unit : '') + '. ') + ok + ' of ' + n + ' so far.'; show(); };
        const show = () => { clear(stepsEl); SM.wordsets.steps(inst).forEach(s => stepsEl.append(h('li', null, h('span', { html: SM.renderText(s.t) }), s.m ? h('div', { class: 'step-math math', html: SM.renderMath(s.m) }) : null))); };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (done) next(); else check(); } });
        const kb = SM.mathkb.mount(input, { kind: 'qty', onEnter: () => (done ? next() : check()), enterLabel: 'Check my answer, or go to the next problem', open: SM.prefs().keypad }); input.setAttribute('aria-describedby', kb.status.id);
        box.append(h('h2', { class: 'prob-title' }, t.title), h('div', { class: 'prob-q' }, inst.q), h('div', { class: 'ans-row' }, input, kb.toggle), kb.preview, kb.msg, kb.status, kb.panel, h('div', { class: 'row btn-row' }, btn('Check', check, 'btn-primary'), btn('Show solution', () => { done = true; show(); }, 'btn-ghost'), btn('Next', next, ''), btn('Back to my problems', () => { location.hash = '#/words?tab=build'; V.words(clear(main), { tab: 'build' }); }, 'btn-ghost')), fb, stepsEl);
        setTimeout(() => input.focus({ preventScroll: true }), 30);
      };
      next();
    }
    main.append(listBox, editBox); drawList(); edit(null);
  }

  /* ---------- Algebra step checker ---------- */
  V.algebra = function (main, q) {
    const ta = h('textarea', { class: 'alg-input', rows: 6, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Your working, one line per step', placeholder: '3x + 5 = 20\n3x = 15\nx = 5' });
    ta.value = q.eq ? q.eq : '';
    const rows = h('ol', { class: 'alg-rows', 'aria-live': 'polite' }), bubble = h('div', { class: 'bubble', role: 'status' });
    const madBox = h('div', { class: 'mad-figure', 'aria-hidden': 'true' });
    let timer = 0, n = 0;
    function render() {
      const lines = ta.value.split('\n'), r = SM.algebra.check(lines); clear(rows);
      r.rows.forEach((row, i) => rows.append(h('li', { class: 'alg-row ' + (row.status === 'start' ? 'st' : row.ok ? 'ok' : 'bad') }, h('span', { class: 'alg-mark', 'aria-hidden': 'true' }, row.status === 'start' ? '•' : row.ok ? '✓' : '✗'), h('span', { class: 'math alg-line', html: SM.renderMath(row.text) }), h('span', { class: 'alg-msg' }, SM.rd(row.msg)))));
      bubble.textContent = SM.rd(!ta.value.trim() ? 'Type an equation on the first line, then one line for each step. I check every line against the one above.' : r.firstError >= 0 ? 'Line ' + (r.firstError + 1) + ': ' + r.hint : r.solved ? 'Every line follows from the one above. ' + r.hint : 'So far so good. ' + (r.hint ? 'Next: ' + r.hint : ''));
      mad.set(r.firstError >= 0 ? 'concerned' : r.solved ? 'celebrating' : 'encouraging');
      return r;
    }
    ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 250); });
    const give = btn('Give me an equation', () => { const e = SM.algebra.practiceEquation(SM.uid(), Math.min(2, SM.level().lv)); ta.value = e.text + '\n'; ta.focus(); render(); n++; }, '');
    main.append(head('Algebra step checker', 'Write your working one line at a time. Each line is checked exactly against the line above, so you find the step that went wrong, not just a wrong answer. Linear and quadratic equations, and expressions to simplify.'),
      h('div', { class: 'practice' }, h('aside', { class: 'mad-panel' }, madBox, h('div', { class: 'mad-talk' }, h('div', { class: 'mad-name' }, 'Madeline', h('span', { class: 'mad-tag' }, 'rule-based guide')), bubble)),
        h('section', { class: 'prob-card' }, h('label', { class: 'stack', for: 'alg-ta' }, 'Your working (one line per step)'), ta, h('div', { class: 'row wrap' }, btn('Check my working', render, 'btn-primary'), give, btn('Clear', () => { ta.value = ''; render(); ta.focus(); }, 'btn-ghost')),
          rows, h('details', { class: 'mistakes' }, h('summary', null, 'How to type it'), h('ul', null, h('li', null, 'Powers: x^2. Multiply: 3x or 3*x. Fractions: x/4 or (x + 1)/2.'), h('li', null, 'Two answers: x = 2 or x = 3, or x = ±3.'), h('li', null, 'Expressions (no equals sign) are checked for staying equal while you expand and collect terms.'))))));
    ta.id = 'alg-ta';
    const mad = SM.Madeline.mount(madBox); main._cleanup = () => { clearTimeout(timer); mad.destroy(); };
    render();
  };

  /* ---------- Fact fluency ---------- */
  V.fluency = function (main, q) {
    const data = SM.data(), F = SM.fluency, fl = data.fluency = data.fluency || {};
    const setId = F.SET[q.set] ? q.set : (SM.level().lv === 0 ? 'add20' : 'mul');
    const tables = (q.t || '').split(',').map(Number).filter(n => n >= 2 && n <= 12);
    const list = F.facts(setId, tables), stats = fl[setId] = fl[setId] || {}, sum = F.summary(stats, list), best = (fl.best || {})[setId] || 0;
    const setSel = h('select', { 'aria-label': 'Fact set', onchange: e => { location.hash = '#/fluency?set=' + e.target.value; } }, F.SETS.map(s => h('option', { value: s.id, selected: s.id === setId }, s.name)));
    const tBox = (setId === 'mul' || setId === 'div') ? h('fieldset', null, h('legend', null, 'Tables'), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: n, checked: !tables.length || tables.includes(n), onchange: () => { const t = Array.from(tBox.querySelectorAll('input:checked')).map(i => i.value); location.hash = '#/fluency?set=' + setId + (t.length && t.length < 11 ? '&t=' + t.join(',') : ''); } }), ' ' + n))) : null;
    main.append(head('Fact fluency', 'One-minute sprints. A fact counts as fluent after two correct answers at about 3 seconds or less; slow and missed facts come back more often.'),
      h('section', { class: 'card' }, h('div', { class: 'form-grid' }, h('label', null, 'Facts', setSel)), tBox,
        h('section', { class: 'stats' }, [['Fluent', sum.fluent + ' of ' + sum.total], ['Slow', sum.slow], ['Missed', sum.missed], ['Not tried', sum.new], ['Best sprint', best]].map(([k, v]) => h('div', { class: 'stat' }, h('strong', null, String(v)), h('span', null, k)))),
        h('div', { class: 'row' }, btn('Start a 1-minute sprint', () => sprint(clear(main), setId, tables), 'btn-primary btn-big'))),
      h('section', { class: 'card' }, h('h2', null, 'Fact grid'), grid(setId, list, stats), h('p', { class: 'legend' }, [['fluent', 'Fluent'], ['slow', 'Slow'], ['missed', 'Missed last time'], ['new', 'Not tried']].map(([c, t]) => h('span', { class: 'lg' }, h('span', { class: 'fc-cell st-' + c, 'aria-hidden': 'true' }), t)))));
  };
  function grid(setId, list, stats) {
    const F = SM.fluency, wrap = h('div', { class: 'table-wrap' }), tbl = h('div', { class: 'fc-grid', role: 'list', 'aria-label': 'Facts by status' });
    list.forEach(f => { const st = F.status(stats[f.key]); tbl.appendChild(h('span', { role: 'listitem', class: 'fc-cell st-' + st, title: F.prompt(f) + ' = ' + f.ans + ' (' + st + ')', 'aria-label': F.prompt(f) + ', ' + st }, F.prompt(f))); });
    wrap.append(tbl); return wrap;
  }
  function sprint(main, setId, tables) {
    const F = SM.fluency, data = SM.data(), list = F.facts(setId, tables), stats = data.fluency[setId], answers = [], rnd = SM.rng(SM.uid()).next;
    const promptEl = h('div', { class: 'fl-prompt', 'aria-live': 'polite' }), timeEl = h('div', { class: 'timer' }), fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const input = h('input', { class: 'ans-input fl-input', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Answer' });
    const pad = h('div', { class: 'numpad' }, ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', '↵'].map(k => h('button', { type: 'button', class: 'key', 'aria-label': k === '⌫' ? 'Delete' : k === '↵' ? 'Enter' : k, onclick: () => { if (k === '⌫') input.value = input.value.slice(0, -1); else if (k === '↵') submit(); else input.value += k; input.focus(); } }, k)));
    let cur = null, t0 = 0, end = Date.now() + 60000, timer = 0, over = false;
    main.append(head(F.SET[setId].name + ': sprint'), h('section', { class: 'prob-card fl-card' }, h('div', { class: 'row spread' }, h('span', { class: 'badge' }, '1 minute'), timeEl), promptEl, h('div', { class: 'ans-row' }, input), pad, fb));
    function show() { cur = F.pick(stats, list, rnd, cur && cur.key); promptEl.textContent = F.prompt(cur) + ' = ?'; input.value = ''; t0 = Date.now(); input.focus({ preventScroll: true }); }
    function submit() {
      if (over || !input.value.trim()) return;
      const ok = +input.value.trim() === cur.ans, ms = Date.now() - t0;
      stats[cur.key] = F.record(stats[cur.key], ok, ms); answers.push({ key: cur.key, ok, ms });
      fb.className = 'feedback ' + (ok ? 'fb-ok' : 'fb-bad'); fb.textContent = ok ? '✓' : F.prompt(cur) + ' = ' + cur.ans;
      show();
    }
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    function tick() { const left = Math.max(0, Math.ceil((end - Date.now()) / 1000)); timeEl.textContent = left + ' s'; timeEl.classList.toggle('low', left <= 10); if (left <= 0) finish(); }
    function finish() {
      if (over) return; over = true; clearInterval(timer);
      const sc = F.score(answers), best = data.fluency.best = data.fluency.best || {};
      const rec = sc.correct > (best[setId] || 0); if (rec) best[setId] = sc.correct; SM.saveData();
      clear(main).append(head('Sprint finished'), h('section', { class: 'card' }, h('p', { class: 'big-score' }, sc.correct + ' correct'), h('p', null, sc.total + ' answered · ' + sc.accuracy + '% accurate' + (rec ? ' · a new best!' : '')),
        h('div', { class: 'row wrap' }, btn('Another sprint', () => sprint(clear(main), setId, tables), 'btn-primary'), btn('See the fact grid', () => { V.fluency(clear(main), { set: setId, t: tables.join(',') }); }, ''))), h('section', { class: 'card' }, h('h2', null, 'Fact grid'), grid(setId, list, stats)));
    }
    main._cleanup = () => { clearInterval(timer); if (!over && answers.length) SM.saveData(); };
    timer = setInterval(tick, 250); tick(); show();
  }

  /* ---------- Curriculum map ---------- */
  V.curriculum = function (main, q) {
    const C = SM.curriculum, data = SM.data(), band = C.BAND[q.band] ? q.band : '', subject = q.subject || '';
    const search = h('input', { type: 'search', class: 'curr-search', placeholder: 'Search a skill or a code, e.g. 5.NF or HS-PS2', 'aria-label': 'Search skills or codes', value: q.q || '' });
    const chips = h('div', { class: 'df-row', role: 'group', 'aria-label': 'Grade band' }, h('a', { class: 'chip' + (band ? '' : ' on'), href: '#/curriculum' + (subject ? '?subject=' + subject : '') }, 'All bands'), C.BANDS.map(b => h('a', { class: 'chip' + (band === b.id ? ' on' : ''), href: '#/curriculum?band=' + b.id + (subject ? '&subject=' + subject : '') }, b.short)));
    const subSel = h('select', { 'aria-label': 'Subject', onchange: e => { location.hash = '#/curriculum?' + (band ? 'band=' + band + '&' : '') + (e.target.value ? 'subject=' + e.target.value : ''); } }, h('option', { value: '' }, 'All subjects'), SM.SUBJECTS.map(s => h('option', { value: s.id, selected: s.id === subject }, s.name)));
    const body = h('tbody');
    const draw = () => {
      const hits = search.value.trim() ? new Set(C.search(search.value)) : null;
      const rows = SM.SKILLS.filter(s => (!band || C.bandFor(s.grade) === band) && (!subject || s.subject === subject) && (!hits || hits.has(s.id)));
      clear(body).append(...rows.map(s => { const b = C.BAND[C.bandFor(s.grade)]; return h('tr', null, h('td', null, h('a', { href: '#/lesson/' + s.id }, s.title)), h('td', null, SM.subjectName(s.subject)), h('td', null, b.short), h('td', { class: 'codes' }, C.codesOf(s.id).join(', ') || '·'), h('td', null, SM.learn.band(data.mastery[s.id]))); }));
      count.textContent = rows.length + ' skill' + (rows.length === 1 ? '' : 's');
    };
    const count = h('span', { class: 'muted' });
    search.addEventListener('input', draw);
    const eq = band ? C.BAND[band] : null;
    main.append(head('Curriculum map', 'Every skill by grade band. Reference codes are US maths (Common Core) and science (NGSS) codes, listed as codes only. They are the Stark team\'s own alignment to help you find skills, not an official or certified mapping.'),
      h('section', { class: 'card' }, chips, h('div', { class: 'row wrap' }, subSel, search, count),
        eq ? h('p', { class: 'band-eq' }, h('strong', null, eq.name), ' · ages ' + eq.ages + ' · ' + eq.isced + ' · England and Wales: ' + eq.ew + '. ', btn('Practise this band', () => { const ids = C.inBand(band, subject ? [subject] : null).filter(id => SM.inRange(SM.SKILL[id], eq.lv)); if (!ids.length) { SM.toast('No skills here at this band\'s level.'); return; } clear(main); SM.practice(main, { skills: ids, adaptive: true, count: 10, lv: eq.lv, df: eq.df, title: eq.name }); }, 'btn-small')) : null,
        h('div', { class: 'table-wrap' }, h('table', { class: 'tbl curr-tbl' }, h('thead', null, h('tr', null, ['Skill', 'Subject', 'Band', 'Reference codes', 'Your status'].map(x => h('th', { scope: 'col' }, x)))), body)),
        h('p', { class: 'muted' }, 'Studying outside the US? ', h('a', { href: '#/countrymaps' }, 'See what Stark Math covers for India, Australia, Brazil and the IB.')),
        h('div', { class: 'row' }, btn('Download the map (CSV)', () => SM.download('stark-math-curriculum-map.csv', C.csv(), 'text/csv;charset=utf-8'), 'btn-small'))),
      h('section', { class: 'card' }, h('h2', null, 'Grade bands around the world'), h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Band', 'Ages', 'International (ISCED)', 'England and Wales', 'Stark Math setting'].map(x => h('th', { scope: 'col' }, x)))),
        h('tbody', null, C.BANDS.map(b => h('tr', null, h('td', null, b.name), h('td', null, b.ages), h('td', null, b.isced), h('td', null, b.ew), h('td', null, SM.LEVELS[b.lv].name + ', ' + SM.DIFFS[b.df].name))))))));
    draw();
  };

  V.report = function (main) { main.append(h('h1', null, 'Progress report'), window.StarkTrial.card('report')); };
})();
