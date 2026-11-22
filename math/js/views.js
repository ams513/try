/* Stark Math. Screens: home, learn (skill map), lesson (worked example), practice launcher,
   progress, and settings (profiles, level, read-aloud, theme, backups, about). */
(function () {
  'use strict';
  const SM = window.SM;
  const { h, clear, btn } = SM;
  const V = SM.views = {};

  function greet(L, name) {
    const hr = new Date().getHours(), part = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    return L.kid ? 'Hi ' + name + '! I\'m Madeline. Let\'s learn something fun today!' : L.adv ? part + ', ' + name + '. Pick up where you left off, or choose a topic.' : part + ', ' + name + '. Ready for some practice?';
  }
  const HONEST = 'I\'m a teaching guide built from written rules and many worked examples. I\'m not an AI and not a real person, so I can\'t chat, but I can check your answers exactly, explain each step and spot common mistakes.';

  /* ---------- level picker ---------- */
  function levelPicker(onChange) {
    const cur = SM.level(), wrap = h('div', { class: 'level-picker' });
    const lvRow = h('div', { class: 'lv-row', role: 'radiogroup', 'aria-label': 'Level' });
    SM.LEVELS.forEach((l, i) => lvRow.appendChild(h('button', { type: 'button', role: 'radio', 'aria-checked': String(cur.lv === i), class: 'lv-card' + (cur.lv === i ? ' on' : ''), onclick: () => { SM.setLevel(i, SM.level().df); onChange(); } }, h('strong', null, l.name), h('span', null, l.ages), h('small', null, l.blurb))));
    const dfRow = h('div', { class: 'df-row', role: 'radiogroup', 'aria-label': 'Difficulty' }, h('span', { class: 'df-label' }, 'Difficulty'));
    SM.DIFFS.forEach((d, i) => dfRow.appendChild(h('button', { type: 'button', role: 'radio', 'aria-checked': String(cur.df === i), class: 'chip' + (cur.df === i ? ' on' : ''), onclick: () => { SM.setLevel(SM.level().lv, i); onChange(); } }, d.name)));
    const pre = h('select', { 'aria-label': 'Grade-band preset', onchange: e => { const p = SM.PRESETS.find(x => x.id === e.target.value); if (p) { SM.setLevel(p.lv, p.df, p.id); onChange(); } } }, h('option', { value: '' }, 'Grade-band presets...'), SM.PRESETS.map(p => h('option', { value: p.id }, p.name + ' → ' + SM.LEVELS[p.lv].name + ', ' + SM.DIFFS[p.df].name.toLowerCase())));
    wrap.append(lvRow, h('div', { class: 'row wrap' }, dfRow, pre));
    return wrap;
  }
  V.levelPicker = levelPicker;

  function ring(p, label) {
    const r = 15, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p));
    const el = h('span', { class: 'ring', title: label, 'aria-hidden': 'true' });
    el.innerHTML = '<svg viewBox="0 0 36 36" width="34" height="34"><circle cx="18" cy="18" r="' + r + '" class="ring-bg"/><circle cx="18" cy="18" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * v).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 18 18)"/></svg>';
    return el;
  }

  /* ---------- home ---------- */
  V.home = function (main) {
    const prof = SM.profile(), { lv, df } = SM.level(), L = SM.ctx({ lv: [0, 4] }, lv, df), data = SM.data();
    const madBox = h('div', { class: 'mad-figure mad-hero', 'aria-hidden': 'true' });
    const bubble = h('div', { class: 'bubble bubble-hero', role: 'status' });
    const first = !data.seen.intro;
    const text = greet(L, prof.name) + (first ? ' ' + HONEST : '');
    bubble.textContent = text;
    const pool = SM.learn.poolFor(lv), weak = pool.map(id => [id, SM.learn.weight(data.mastery[id])]).sort((a, b) => b[1] - a[1]);
    const tried = weak.filter(([id]) => data.mastery[id] && data.mastery[id].n).slice(0, 3), fresh = weak.filter(([id]) => !(data.mastery[id] && data.mastery[id].n)).slice(0, 3);
    const levelBox = h('div', { class: 'card' }, h('h2', null, 'Your level'), levelPicker(() => V.home(clear(main))));
    const sum = SM.learn.summary(data.mastery, lv), due = SM.learn.dueList(data.mastery).length;
    const today = h('div', { class: 'card' }, h('h2', null, 'Today'), h('ul', { class: 'sugg' },
      h('li', null, h('a', { href: '#/review' }, due ? due + ' skill' + (due === 1 ? '' : 's') + ' to review' : 'Reviews'), h('span', { class: 'muted' }, due ? ' · spaced repetition' : ' · nothing due right now')),
      data.placement && data.placement.band ? h('li', null, h('a', { href: '#/placement' }, 'Placement: ' + data.placement.bandName), h('span', { class: 'muted' }, ' · retake any time')) : h('li', null, h('a', { href: '#/placement' }, 'Not sure of your level?'), h('span', { class: 'muted' }, ' · take the placement check')),
      h('li', null, h('a', { href: '#/fluency' }, 'Fact fluency sprint'), h('span', { class: 'muted' }, ' · one minute')), h('li', null, h('a', { href: '#/study' }, 'All study tools'), h('span', { class: 'muted' }, ' · worksheets, word problems, algebra checker, report'))));
    main.append(h('section', { class: 'hero' }, madBox, h('div', { class: 'hero-talk' }, h('div', { class: 'mad-name' }, 'Madeline', h('span', { class: 'mad-tag' }, 'rule-based guide')), bubble,
      h('div', { class: 'row wrap' }, btn('Start mixed practice', () => { location.hash = '#/practice?mode=mixed'; }, 'btn-primary btn-big'), btn('Choose a topic', () => { location.hash = '#/learn'; }, 'btn-big'), SM.canSpeak() ? btn('Hear Madeline', () => mad.say(text), 'btn-ghost') : null))),
      h('section', { class: 'grid2' },
        h('div', { class: 'card' }, h('h2', null, 'Suggested next'), h('ul', { class: 'sugg' }, (tried.length ? tried : []).concat(fresh).slice(0, 5).map(([id]) => { const s = SM.SKILL[id]; return h('li', null, h('a', { href: '#/lesson/' + id }, s.title), h('span', { class: 'muted' }, ' · ' + SM.subjectName(s.subject) + ' · ' + SM.learn.band(data.mastery[id]))); }))),
        today, h('div', { class: 'card' }, h('h2', null, 'At your level'), h('ul', { class: 'subj-sum' }, Object.keys(sum).map(k => h('li', null, h('a', { href: '#/learn?subject=' + k }, SM.subjectName(k)), h('span', { class: 'bar', 'aria-label': sum[k].strong + ' of ' + sum[k].total + ' strong' }, h('span', { style: 'width:' + Math.round(100 * sum[k].strong / sum[k].total) + '%' })), h('span', { class: 'muted' }, sum[k].strong + '/' + sum[k].total)))))),
      levelBox);
    const mad = SM.Madeline.mount(madBox); mad.set(first ? 'smiling' : 'neutral', 'open');
    main._cleanup = () => mad.destroy();
    if (first) { data.seen.intro = 1; SM.saveData(); }
  };

  /* ---------- learn: skill map ---------- */
  V.learn = function (main, q) {
    const data = SM.data(), { lv } = SM.level();
    let subject = q.subject || 'math', all = q.all === '1';
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Subjects' });
    SM.SUBJECTS.forEach(s => { const n = SM.SKILLS.filter(k => k.subject === s.id && (all || SM.inRange(k, lv))).length; tabs.appendChild(h('a', { role: 'tab', 'aria-selected': String(s.id === subject), class: 'tab' + (s.id === subject ? ' on' : ''), href: '#/learn?subject=' + s.id + (all ? '&all=1' : '') }, s.name, h('span', { class: 'tab-n' }, String(n)))); });
    const list = h('div', { class: 'strands' });
    const skills = SM.SKILLS.filter(s => s.subject === subject && (all || SM.inRange(s, lv)));
    const strands = [...new Set(skills.map(s => s.strand))];
    if (!skills.length) list.appendChild(h('p', { class: 'card' }, 'No ' + SM.subjectName(subject).toLowerCase() + ' skills at the ' + SM.LEVELS[lv].name + ' level yet. ', h('a', { href: '#/learn?subject=' + subject + '&all=1' }, 'Show every level'), '.'));
    strands.forEach(st => {
      const ss = skills.filter(s => s.strand === st);
      list.appendChild(h('section', { class: 'strand card' }, h('div', { class: 'strand-head' }, h('h2', null, st), btn('Practise ' + st.toLowerCase(), () => { location.hash = '#/practice?subject=' + subject + '&strand=' + encodeURIComponent(st) + (all ? '&all=1' : ''); }, 'btn-small')),
        h('ul', { class: 'skill-list' }, ss.map(s => { const rec = data.mastery[s.id], b = SM.learn.band(rec), inLv = SM.inRange(s, lv); return h('li', { class: 'skill' + (inLv ? '' : ' off-level') }, ring(SM.learn.effective(rec), b), h('div', { class: 'skill-text' }, h('a', { href: '#/lesson/' + s.id, class: 'skill-name' }, s.title), h('span', { class: 'muted' }, b + ' · ' + SM.LEVELS[s.lv[0]].name + (s.lv[1] > s.lv[0] ? ' to ' + SM.LEVELS[s.lv[1]].name : '') + (inLv ? '' : ' (outside your level)'))), btn('Practise', () => { location.hash = '#/practice?skill=' + s.id; }, 'btn-small btn-ghost', { 'aria-label': 'Practise ' + s.title })); }))));
    });
    main.append(h('div', { class: 'page-head' }, h('h1', null, 'Learn'), h('p', { class: 'muted' }, SM.SKILLS.length + ' skills across ' + SM.SUBJECTS.length + ' subjects. Showing ' + (all ? 'every level' : 'your level: ' + SM.LEVELS[lv].name) + '. '), h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: all, onchange: e => { location.hash = '#/learn?subject=' + subject + (e.target.checked ? '&all=1' : ''); } }), ' Show skills outside my level')), tabs, list);
  };

  /* ---------- lesson: Madeline walks through a worked example ---------- */
  V.lesson = function (main, q, id) {
    const s = SM.SKILL[id]; if (!s) { main.append(h('p', null, 'That skill was not found. ', h('a', { href: '#/learn' }, 'Back to Learn'))); return; }
    const { lv, df } = SM.level(), L = SM.ctx(s, lv, df), ex = SM.example(id, lv, 0);
    const madBox = h('div', { class: 'mad-figure', 'aria-hidden': 'true' }), bubble = h('div', { class: 'bubble', role: 'status', 'aria-live': 'polite' });
    const stepsEl = h('ol', { class: 'steps lesson-steps' });
    let k = -1; const seen = new Set(), rd = t => SM.rd(t, seen);
    const intro = L.kid ? 'Let\'s learn ' + s.title.toLowerCase() + '! Watch me do one first.' : L.adv ? s.title + '. The key idea is ' + s.focus + '. Here is a worked example.' : 'Today: ' + s.title.toLowerCase() + '. The key idea is ' + s.focus + '. Let me show you one.';
    const nextBtn = btn('Next step', () => step(), 'btn-primary');
    const tryBtn = btn('Try one yourself', () => { location.hash = '#/practice?skill=' + id; }, 'btn-primary', { hidden: true });
    function step() {
      k++;
      if (k < ex.steps.length) {
        const st = ex.steps[k], tt = rd(st.t || '');
        stepsEl.appendChild(h('li', { class: 'appear' }, st.t ? h('span', { html: SM.renderText(tt) }) : null, st.m ? h('div', { class: 'step-math math', html: SM.renderMath(st.m, { kid: L.kid }) }) : null));
        const t = tt + (st.m ? ' ' + '$' + st.m + '$' : '');
        bubble.innerHTML = SM.renderText(t); mad.set(k === 0 ? 'thinking' : 'encouraging', 'point'); mad.say(t);
        if (k === ex.steps.length - 1) { nextBtn.textContent = 'Show the answer'; }
      } else {
        stepsEl.appendChild(h('li', { class: 'step-ans appear' }, h('strong', null, 'Answer: '), SM.answerText(ex.ans)));
        const t = L.kid ? 'And that\'s the answer! Now you try one.' : 'So the answer is ' + SM.answerText(ex.ans) + '. Now try one yourself.';
        bubble.textContent = t; mad.set('smiling', 'open'); mad.say(t);
        nextBtn.hidden = true; tryBtn.hidden = false; tryBtn.focus();
      }
    }
    const proof = ex.proof && L.adv ? h('details', { class: 'proof card' }, h('summary', null, L.pro ? 'Derivation and proof' : 'Why it works'), h('p', { html: SM.renderText(ex.proof) })) : null;
    main.append(h('div', { class: 'page-head' }, h('a', { href: '#/learn?subject=' + s.subject, class: 'back' }, '← ' + SM.subjectName(s.subject)), h('h1', null, s.title), h('p', { class: 'muted' }, s.strand + ' · ' + SM.LEVELS[s.lv[0]].name + (s.lv[1] > s.lv[0] ? ' to ' + SM.LEVELS[s.lv[1]].name : '') + ' · taught at ' + SM.LEVELS[L.lv].name + ' level')),
      h('div', { class: 'practice' }, h('aside', { class: 'mad-panel' }, madBox, h('div', { class: 'mad-talk' }, h('div', { class: 'mad-name' }, 'Madeline'), bubble)),
        h('section', { class: 'prob-card' }, h('h2', { class: 'prob-title' }, 'Worked example'), h('div', { class: 'prob-q', html: SM.renderText(rd(ex.q), { kid: L.kid }) }), ex.pic ? h('div', { class: 'prob-pic', html: SM.picture(ex.pic) }) : null, stepsEl,
          h('div', { class: 'row btn-row' }, nextBtn, tryBtn, btn('Skip to practice', () => { location.hash = '#/practice?skill=' + id; }, 'btn-ghost')),
          ex.mistakes && ex.mistakes.length ? h('details', { class: 'mistakes' }, h('summary', null, 'Common mistakes Madeline watches for'), h('ul', null, ex.mistakes.map(m => h('li', null, m.msg)))) : null, proof)));
    const mad = SM.Madeline.mount(madBox); mad.set('neutral', 'point');
    bubble.textContent = intro; main._cleanup = () => mad.destroy();
    setTimeout(() => nextBtn.focus({ preventScroll: true }), 50);
  };

  /* ---------- practice launcher ---------- */
  V.practice = function (main, q) {
    const { lv } = SM.level();
    let skills, title, adaptive = true, count = 10;
    if (q.skill && SM.SKILL[q.skill]) { skills = [q.skill]; title = SM.SKILL[q.skill].title; count = 0; adaptive = false; }
    else if (q.subject) { skills = SM.SKILLS.filter(s => s.subject === q.subject && (!q.strand || s.strand === q.strand) && (q.all === '1' || SM.inRange(s, lv))).map(s => s.id); title = q.strand || SM.subjectName(q.subject); }
    if (!skills || !skills.length) {
      const subs = SM.prefs().mixSubjects || ['math'];
      const box = h('div', { class: 'card' }, h('h2', null, 'Mixed practice'), h('p', null, 'Ten problems chosen for you. Weak skills come up more often; strong ones return for review.'), h('fieldset', { class: 'subj-pick' }, h('legend', null, 'Subjects'), SM.SUBJECTS.map(s => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: s.id, checked: subs.includes(s.id) }), ' ' + s.name))),
        h('div', { class: 'row' }, btn('Start', () => { const pick = Array.from(box.querySelectorAll('input:checked')).map(i => i.value); SM.setPref('mixSubjects', pick.length ? pick : ['math']); go(); }, 'btn-primary btn-big')));
      main.append(h('div', { class: 'page-head' }, h('h1', null, 'Practice')), box);
      const go = () => { const subj = SM.prefs().mixSubjects || ['math']; const pool = SM.SKILLS.filter(s => subj.includes(s.subject) && SM.inRange(s, lv)).map(s => s.id); clear(main); if (!pool.length) { main.append(h('p', { class: 'card' }, 'No skills at this level for those subjects.')); return; } SM.practice(main, { skills: pool, adaptive: true, count: 10, title: 'Mixed practice' }); };
      if (q.mode === 'mixed') { clear(main); go(); }
      return;
    }
    SM.practice(main, { skills, adaptive, count, title });
  };

  /* ---------- progress ---------- */
  V.progress = function (main) {
    const data = SM.data(), { lv } = SM.level(), st = data.stats;
    const acc = st.attempted ? Math.round(100 * st.correct / st.attempted) : 0;
    const rows = SM.SKILLS.filter(s => data.mastery[s.id] && data.mastery[s.id].n).sort((a, b) => SM.learn.effective(data.mastery[a.id]) - SM.learn.effective(data.mastery[b.id]));
    const sum = SM.learn.summary(data.mastery, lv);
    main.append(h('div', { class: 'page-head' }, h('h1', null, 'Progress'), h('p', { class: 'muted' }, SM.profile().name + ' · ' + SM.LEVELS[lv].name + ' level')),
      h('section', { class: 'stats' }, [['Problems tried', st.attempted], ['Correct', st.correct], ['Accuracy', acc + '%'], ['Days practised', st.days.length], ['Skills practised', rows.length]].map(([k, v]) => h('div', { class: 'stat' }, h('strong', null, String(v)), h('span', null, k)))),
      h('section', { class: 'card' }, h('h2', null, 'By subject (your level)'), h('ul', { class: 'subj-sum' }, Object.keys(sum).map(k => h('li', null, h('span', null, SM.subjectName(k)), h('span', { class: 'bar' }, h('span', { style: 'width:' + Math.round(100 * sum[k].strong / sum[k].total) + '%' })), h('span', { class: 'muted' }, sum[k].strong + ' strong of ' + sum[k].total))))),
      h('section', { class: 'card' }, h('h2', null, 'Skills you have practised'), rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Skill', 'Subject', 'Status', 'Tried', 'Correct', 'Best streak'].map(x => h('th', { scope: 'col' }, x)))),
        h('tbody', null, rows.map(s => { const r = data.mastery[s.id]; return h('tr', null, h('td', null, h('a', { href: '#/lesson/' + s.id }, s.title)), h('td', null, SM.subjectName(s.subject)), h('td', null, SM.learn.band(r) + (SM.learn.reviewDue(r) ? ' · review due' : '')), h('td', null, String(r.n)), h('td', null, String(r.c)), h('td', null, String(r.best))); })))) : h('p', { class: 'muted' }, 'Nothing yet. Try a practice session.'),
        h('div', { class: 'row' }, btn('Download report (CSV)', () => SM.download('stark-math-progress-' + SM.profile().name + '.csv', csv(rows, data), 'text/csv;charset=utf-8'), 'btn-small'))));
  };
  function csv(rows, data) {
    const q = v => { v = String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return ['Skill,Subject,Status,Tried,Correct,Best streak'].concat(rows.map(s => { const r = data.mastery[s.id]; return [s.title, SM.subjectName(s.subject), SM.learn.band(r), r.n, r.c, r.best].map(q).join(','); })).join('\r\n') + '\r\n';
  }

  /* ---------- settings ---------- */
  V.settings = function (main) {
    const P = SM.prefs(), st = SM.store();
    const rerender = () => V.settings(clear(main));
    const profs = h('ul', { class: 'prof-list' }, st.profiles.map(p => h('li', null, h('span', { class: 'avatar', style: 'background:' + SM.COLORS[p.color % SM.COLORS.length] }, p.name.slice(0, 1).toUpperCase()), h('span', { class: 'grow' }, p.name + (p.id === st.active ? ' (active)' : '')),
      p.id !== st.active ? btn('Switch', () => { SM.switchProfile(p.id); rerender(); }, 'btn-small') : null,
      btn('Rename', e => { const li = e.target.closest('li'); const inp = h('input', { value: p.name, maxlength: 24, 'aria-label': 'New name' }); const ok = btn('Save', () => { p.name = SM.cleanName(inp.value) || p.name; SM.saveStore(); SM.emit('profile'); rerender(); }, 'btn-small btn-primary'); clear(li).append(inp, ok); inp.focus(); }, 'btn-small btn-ghost'),
      st.profiles.length > 1 ? btn('Delete', e => { const li = e.target.closest('li'); clear(li).append(h('span', { class: 'grow' }, 'Delete ' + p.name + ' and all their progress?'), btn('Yes, delete', () => { SM.deleteProfile(p.id); rerender(); }, 'btn-small btn-danger'), btn('Cancel', rerender, 'btn-small')); }, 'btn-small btn-ghost') : null)));
    const newName = h('input', { placeholder: 'Name (first name only)', maxlength: 24, 'aria-label': 'New learner name' });
    const voiceSel = h('select', { 'aria-label': 'Voice', onchange: e => SM.setPref('voice', e.target.value) }, h('option', { value: '' }, 'Default voice'), SM.voices().map(v => h('option', { value: v.name, selected: v.name === P.voice }, v.name)));
    main.append(h('div', { class: 'page-head' }, h('h1', null, 'Settings')),
      h('section', { class: 'card' }, h('h2', null, 'Learners'), profs, h('div', { class: 'row' }, newName, btn('Add learner', () => { SM.addProfile(newName.value, st.profiles.length % SM.COLORS.length, SM.level().lv); rerender(); }, 'btn-primary btn-small'))),
      h('section', { class: 'card' }, h('h2', null, 'Level for ' + SM.profile().name), levelPicker(rerender),
        h('div', { class: 'row wrap' }, h('label', { for: 'reading-sel' }, 'Reading support for ' + SM.profile().name + ' '), h('select', { id: 'reading-sel', onchange: e => { SM.setReading(e.target.value); SM.toast('Reading support: ' + e.target.selectedOptions[0].textContent + '.'); } }, SM.reading.MODES.map(m => h('option', { value: m.id, selected: m.id === SM.readingMode() }, m.name)))),
        h('p', { class: 'muted' }, 'Separate from the maths level. Plain words swaps hard words for everyday ones, explains maths words the first time they appear and splits long sentences; Detailed adds definitions of key words. The maths itself never changes.')),
      h('section', { class: 'card' }, h('h2', null, 'Madeline and accessibility'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: P.readAloud, onchange: e => SM.setPref('readAloud', e.target.checked) }), ' Read aloud (uses this device\'s voices' + (SM.canSpeak() ? ')' : '; none found on this device)')),
        h('div', { class: 'row wrap' }, voiceSel, h('label', null, 'Speed ', h('input', { type: 'range', min: '0.6', max: '1.4', step: '0.1', value: P.rate, onchange: e => SM.setPref('rate', +e.target.value), 'aria-label': 'Speech speed' }))),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: P.calm, onchange: e => { SM.setPref('calm', e.target.checked); SM.applyTheme(); } }), ' Calm mode: no animation (also follows your system\'s reduce-motion setting)'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: P.theme === 'light', onchange: e => { SM.setPref('theme', e.target.checked ? 'light' : 'dark'); SM.applyTheme(); } }), ' Light theme'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: P.keypad, onchange: e => SM.setPref('keypad', e.target.checked) }), ' Show the maths keyboard by default')),
      h('section', { class: 'card' }, h('h2', null, 'Backups'), h('p', { class: 'muted' }, 'Progress is saved in this browser only. A backup file moves it to another device. It uses the shared Stark profile format, so a future Stark bundle can read it.'),
        h('div', { class: 'row' }, btn('Back up everything', () => SM.download('stark-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(SM.buildBackup(), null, 1), 'application/json'), 'btn-small'),
          btn('Restore from a backup', () => SM.pickFile('.json', txt => { const r = SM.restoreBackupText(txt); SM.toast(r.ok ? 'Restored ' + r.count + ' learner' + (r.count === 1 ? '' : 's') + (r.note === 'no checksum, validated' ? ' (no checksum, validated).' : '.') : r.error); rerender(); }), 'btn-small'))),
      h('section', { class: 'card' }, h('h2', null, 'Feedback'), h('p', { class: 'muted' }, 'Tell us what you like and what is missing. This opens your own email app with the message written; nothing is sent until you press send.'), h('div', { class: 'row' }, btn('Send feedback', () => SM.openFeedback(), 'btn-small'))),
      h('section', { class: 'card about' }, h('h2', null, 'About'), h('p', null, h('strong', null, 'Stark Math ' + SM.VERSION), ', a Stark product.'),
        h('p', null, 'Madeline is a rule-based teaching guide. Her explanations, hints and mistake checks were written by people as rules and templates. She is not an AI, not a chatbot and not a real person. Her character was drawn in code for this app.'),
        h('p', null, 'Every answer is checked exactly by the app\'s own maths engine, which accepts equivalent forms (1/2, 0.5 and 2/4 where the question allows). Physical constants are CODATA 2018 values; atomic masses are IUPAC standard values.'),
        h('p', null, 'No accounts, no ads, no tracking and no network calls. Fonts are your system\'s own.'), h('p', null, 'Local protections: your data stays on this device. Saves are checked and a spare copy is kept, backup files carry a checksum and are validated before restoring, and if saved data is ever damaged the app opens read-only instead of overwriting it.'), SM.starkNotice()));
  };

  /* the licence line and build mark live in index.html (<template id=stark-notice-tpl>); apply_protect.py stamps the mark at release */
  SM.starkNotice = function () { const t = document.getElementById('stark-notice-tpl'); return t ? t.content.cloneNode(true) : document.createTextNode(''); };

  /* ---------- profile dialog ---------- */
  V.profileDialog = function () {
    const dlg = SM.$('#profile-dialog'), body = clear(SM.$('#profile-body')), st = SM.store();
    body.append(h('h2', { id: 'profile-title' }, 'Who is learning?'), h('ul', { class: 'prof-list' }, st.profiles.map(p => h('li', null, h('button', { type: 'button', class: 'prof-btn' + (p.id === st.active ? ' on' : ''), onclick: () => { SM.switchProfile(p.id); dlg.close(); } }, h('span', { class: 'avatar', style: 'background:' + SM.COLORS[p.color % SM.COLORS.length] }, p.name.slice(0, 1).toUpperCase()), p.name, h('small', null, ' ' + SM.LEVELS[(p.prefs || {}).level === undefined ? 1 : p.prefs.level].name))))),
      h('div', { class: 'row end' }, btn('Manage learners', () => { dlg.close(); location.hash = '#/settings'; }, 'btn-ghost'), btn('Close', () => dlg.close(), '')));
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  };
})();
