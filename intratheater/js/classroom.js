/* Stark IntraTheater by Stark. Classroom: the Lessons view for students, and Teacher mode
   (inside Grown-ups, behind the parent PIN): class roster, lesson assignment, progress report, class backup.
   Students are the app's kid profiles: first names or nicknames only, stored in this browser. Nothing is sent anywhere. */
(function () {
  'use strict';
  const { h, clear, data, store } = SIT;
  const L = SIT.classLib;
  const LESSONS = (data.lessons || []).concat(data.exLessons || []);
  const evById = {}; data.events.forEach(e => { evById[e.id] = e; });
  const cByIso = {}; data.countries.forEach(c => { cByIso[c.iso2] = c; });
  const byId = {}; LESSONS.forEach(x => { byId[x.id] = x; });
  const steps = {}; LESSONS.forEach(x => { steps[x.id] = L.lessonSteps(x, evById, cByIso); });
  const today = () => new Date().toISOString().slice(0, 10);
  const classroom = () => Object.assign({ name: '', assigned: [] }, store.get('classroom', {}));
  const saveClassroom = c => store.set('classroom', c);
  const bandTag = b => h('span', { class: 'tag plain band band-' + b.replace('-', '') }, 'Grades ' + b);

  /* ================= Lessons view (students and grown-ups) ================= */
  const st = { band: 'all' };
  let root;
  function visibleLessons() {
    const a = classroom().assigned.filter(id => byId[id]);
    return !SIT.isGrown() && a.length ? a.map(id => byId[id]) : LESSONS;
  }
  function renderList(sub) {
    clear(root);
    const cl = classroom();
    const assignedOnly = !SIT.isGrown() && cl.assigned.some(id => byId[id]);
    const prog = SIT.progress();
    root.appendChild(h('header', { class: 'view-head' }, h('h1', null, 'Lessons'),
      h('p', { class: 'lede' }, assignedOnly
        ? (cl.name ? cl.name + ': ' : '') + 'the lessons your teacher picked. Each one has moments to read, places to find, a quiz and something to make.'
        : LESSONS.length + ' ready-made lessons for grades K-2, 3-5 and 6-8. Each one links history moments, countries, explorer pages, a quiz and an activity to one learning goal.')));
    if (sub && byId[sub]) return renderLesson(byId[sub]);
    const list = visibleLessons();
    if (!assignedOnly) {
      root.appendChild(h('div', { class: 'chips', role: 'group', 'aria-label': 'Grade band' },
        ['all'].concat(L.BANDS).map(b => h('button', { type: 'button', class: 'chip', 'aria-pressed': st.band === b ? 'true' : 'false', onclick: () => { st.band = b; renderList(); } }, b === 'all' ? 'All grades' : 'Grades ' + b))));
    }
    root.appendChild(h('div', { class: 'lesson-grid' }, list.filter(x => assignedOnly || st.band === 'all' || x.band === st.band).map(x => {
      const s = L.lessonState(x, steps[x.id], prog);
      return h('a', { class: 'menu-card lesson-card' + (s.complete ? ' done' : ''), href: '#/lessons/' + x.id },
        h('span', { class: 'lesson-icon', 'aria-hidden': 'true' }, x.icon),
        h('span', { class: 'menu-title' }, x.title),
        h('span', null, bandTag(x.band), h('span', { class: 'muted small' }, '≈ ' + x.minutes + ' min')),
        h('span', { class: 'muted' }, x.goal),
        s.complete ? h('span', { class: 'badge' }, '✓ Completed') : h('span', { class: 'small' }, s.done.length + ' of ' + s.total + ' steps done'));
    })));
  }
  function renderLesson(x) {
    const prog = SIT.progress();
    const list = steps[x.id];
    const s = L.lessonState(x, list, prog);
    const manual = (prog.lessonSteps || {})[x.id] || [];
    const toggle = key => {
      const p = SIT.progress(); p.lessonSteps = p.lessonSteps || {};
      const arr = p.lessonSteps[x.id] = (p.lessonSteps[x.id] || []).slice();
      const i = arr.indexOf(key); if (i >= 0) arr.splice(i, 1); else arr.push(key);
      SIT.saveProgress();
    };
    const finish = () => {
      const p = SIT.progress(); p.lessons = p.lessons || []; p.lessonDates = p.lessonDates || {};
      if (p.lessons.indexOf(x.id) < 0) { p.lessons.push(x.id); p.lessonDates[x.id] = today(); }
      SIT.addStars(3); SIT.toast('Lesson complete! Three stars for you.');
    };
    const allDone = s.done.length === s.total;
    root.appendChild(h('article', { class: 'card lesson' },
      h('div', { class: 'row' }, h('a', { class: 'btn btn-back', href: '#/lessons' }, '⬅ All lessons'), SIT.speakButton(() => x.title + '. ' + x.intro + ' Goal: ' + x.goal, 'Read aloud')),
      h('p', null, bandTag(x.band), h('span', { class: 'muted small' }, '≈ ' + x.minutes + ' min')),
      h('h2', { class: 'lesson-h', tabindex: '-1' }, h('span', { 'aria-hidden': 'true' }, x.icon + ' '), x.title),
      h('p', { class: 'lesson-goal' }, h('strong', null, 'Goal: '), x.goal),
      h('p', null, x.intro),
      h('ol', { class: 'lesson-steps' }, list.map(step => {
        const auto = L.autoDone(step, prog);
        const done = auto || manual.indexOf(step.key) >= 0;
        return h('li', { class: done ? 'done' : '' },
          h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: done, disabled: auto, onchange: () => toggle(step.key) }),
            h('span', null, h('span', { 'aria-hidden': 'true' }, step.icon + ' '), step.label, auto ? h('small', { class: 'muted' }, ' · done') : null)),
          step.href ? h('a', { class: 'btn btn-small', href: step.href }, 'Open') : null,
          step.key === 'talk' ? h('ul', { class: 'discuss' }, x.discuss.map(q => h('li', null, q))) : null);
      })),
      h('p', { class: 'fine' }, 'Reading a moment on the timeline and playing a quiz tick themselves. Tick the others when you have done them.'),
      h('div', { class: 'row' }, s.complete
        ? h('span', { class: 'badge' }, '✓ Completed' + ((prog.lessonDates || {})[x.id] ? ' on ' + prog.lessonDates[x.id] : ''))
        : h('button', { type: 'button', class: 'btn btn-primary', disabled: !allDone, onclick: finish }, allDone ? '🎉 Finish the lesson' : 'Finish the lesson (' + s.done.length + ' of ' + s.total + ' done)'))));
    const t = root.querySelector('.lesson-h'); if (t) t.focus({ preventScroll: true });
  }
  let lastSub = '';
  SIT.view('lessons', { title: 'Lessons', mount(el) { root = el; }, show(r) { lastSub = r.sub; renderList(r.sub); } });
  const rerender = () => { if (SIT.currentView() === 'lessons') renderList(lastSub); };
  SIT.on('progress', rerender);
  SIT.on('mode', rerender);

  /* ================= Teacher mode (Grown-ups > Classroom) ================= */
  let box, bulkMsg = '';
  function render(host) {
    box = host || box; if (!box) return;
    clear(box);
    const fam = SIT.family();
    const cl = classroom();
    const save = () => { SIT.saveFamily(); SIT.emit('mode'); };
    const arm = SIT.armBtn;

    /* class + roster */
    const nameIn = h('input', { type: 'text', id: 'cl-name', maxlength: 60, value: cl.name, placeholder: 'e.g. Room 4, Year 3 Kestrels', onchange: e => { const c = classroom(); c.name = e.target.value.trim(); saveClassroom(c); } });
    const one = h('input', { type: 'text', id: 'cl-add', maxlength: 20, placeholder: 'First name or nickname', 'aria-label': 'First name or nickname' });
    const addOne = () => {
      const r = L.parseRoster(one.value, fam.kids.map(k => k.name));
      if (!r.add.length) { SIT.toast(r.rejected.length ? r.rejected[0].why : 'Type a first name or nickname.'); one.focus(); return; }
      addKids(r.add); one.value = ''; render(); const f = document.getElementById('cl-add'); if (f) f.focus();
    };
    one.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addOne(); } });
    const bulk = h('textarea', { id: 'cl-bulk', rows: 5, placeholder: 'One name per line, or separated by commas:\nAisha\nBen\nCarmen, Dev, Eli' });
    function addKids(names) {
      names.forEach(n => { fam.kids.push({ id: 'kid' + SIT.uid(), name: n, avatar: SIT.AVATARS[fam.kids.length % SIT.AVATARS.length] }); });
      save();
    }
    const roster = h('table', { class: 'roster' },
      h('thead', null, h('tr', null, ['Avatar', 'Name', 'Stars', 'Lessons done', ''].map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', null, fam.kids.map(k => {
        const av = h('select', { 'aria-label': 'Avatar for ' + k.name, onchange: e => { k.avatar = e.target.value; save(); } }, SIT.AVATARS.map(a => h('option', { value: a }, a)));
        av.value = k.avatar;
        const p = SIT.progress(k.id);
        return h('tr', null, h('td', null, av),
          h('td', null, h('input', { type: 'text', value: k.name, maxlength: 20, 'aria-label': 'Name', onchange: e => {
            const r = L.cleanName(e.target.value);
            const clash = fam.kids.some(o => o !== k && o.name.toLowerCase() === r.name.toLowerCase());
            if (r.error || clash) { SIT.toast(r.error && r.error !== 'empty' ? r.error : clash ? 'Another student already has that name.' : 'Type a first name or nickname.'); e.target.value = k.name; return; }
            k.name = r.name; save();
          } })),
          h('td', null, '⭐ ' + (p.stars || 0)),
          h('td', null, String((p.lessons || []).filter(id => byId[id]).length)),
          h('td', null, fam.kids.length > 1 ? arm('Remove', 'Tap again to remove', () => {
            fam.kids = fam.kids.filter(x => x !== k); if (fam.activeKid === k.id) fam.activeKid = fam.kids[0].id;
            SIT.resetProgress(k.id); save(); render();
          }, 'btn-small') : null));
      })));
    box.appendChild(h('section', { class: 'card no-print' }, h('h2', null, '🏫 Your class'),
      h('p', { class: 'muted' }, 'Teacher mode stays behind the parent PIN. Students are the profiles on the "Who\'s watching?" list: each one picks their own name and their stars, quiz scores and lessons are kept separately. Use first names or nicknames only. There are no emails, accounts or network, and nothing leaves this computer.'),
      h('div', { class: 'form-grid' }, h('label', { for: 'cl-name' }, 'Class name'), nameIn),
      h('h3', null, 'Class roster (' + fam.kids.length + ' of ' + L.MAX_STUDENTS + ')'),
      h('div', { class: 'table-wrap' }, roster),
      h('div', { class: 'row nowrap' }, one, h('button', { type: 'button', class: 'btn', onclick: addOne }, '➕ Add student')),
      h('details', { class: 'bulk', open: !!bulkMsg },
        h('summary', null, h('strong', null, '📋 Add many students at once')),
        h('label', { for: 'cl-bulk', class: 'small muted' }, 'Paste a list of first names or nicknames. Anything that looks like an email, a number or a full name is skipped.'),
        bulk,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => {
          const r = L.parseRoster(bulk.value, fam.kids.map(k => k.name));
          if (r.add.length) addKids(r.add);
          bulkMsg = 'Added ' + r.add.length + (r.add.length === 1 ? ' student.' : ' students.') + (r.rejected.length ? ' Skipped ' + r.rejected.length + ': ' + r.rejected.map(x => '"' + x.raw + '" (' + x.why + ')').join(' ') : '');
          render(); SIT.toast('Added ' + r.add.length + ', skipped ' + r.rejected.length + '.');
        } }, 'Add these students')),
        bulkMsg ? h('p', { class: 'small', role: 'status' }, bulkMsg) : null)));
    bulkMsg = '';

    /* lesson assignment */
    const assigned = new Set(cl.assigned);
    const setAssigned = (ids, on) => { const c = classroom(); const s = new Set(c.assigned); ids.forEach(id => { if (on) s.add(id); else s.delete(id); }); c.assigned = LESSONS.map(x => x.id).filter(id => s.has(id)); saveClassroom(c); render(); };
    box.appendChild(h('section', { class: 'card no-print' }, h('h2', null, '📒 Lessons for this class'),
      h('p', { class: 'muted' }, 'Tick the lessons your students should see. With nothing ticked, students see all ' + LESSONS.length + ' lessons.'),
      L.BANDS.map(b => {
        const ids = LESSONS.filter(x => x.band === b).map(x => x.id);
        return h('div', { class: 'band-group' },
          h('div', { class: 'row' }, h('h3', null, 'Grades ' + b),
            h('button', { type: 'button', class: 'btn btn-small', onclick: () => setAssigned(ids, true) }, 'Tick all'),
            h('button', { type: 'button', class: 'btn btn-small', onclick: () => setAssigned(ids, false) }, 'Clear')),
          LESSONS.filter(x => x.band === b).map(x => h('div', { class: 'row assign-row' },
            h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: assigned.has(x.id), onchange: e => setAssigned([x.id], e.target.checked) }),
              h('span', null, h('strong', null, x.icon + ' ' + x.title), h('br'), h('span', { class: 'small muted' }, x.goal))),
            h('a', { class: 'btn btn-small', href: '#/lessons/' + x.id }, 'Preview'))));
      })));

    /* progress report */
    const rows = reportRows();
    const lessonTotal = cl.assigned.filter(id => byId[id]).length || LESSONS.length;
    box.appendChild(h('section', { class: 'card class-report' },
      h('h2', null, '📊 Progress report' + (cl.name ? ': ' + cl.name : '')),
      h('p', { class: 'muted' }, 'Made on ' + today() + ' from this computer only. Quiz scores are each student\'s best round. Moments explored are counted out of ' + data.events.length + '.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'report' },
        h('thead', null, h('tr', null, ['Student', 'Stars', 'Moments explored', 'Lessons completed', 'Average best quiz', 'Best quiz scores'].map(t => h('th', { scope: 'col' }, t)))),
        h('tbody', null, rows.map(r => h('tr', null,
          h('th', { scope: 'row' }, r.name),
          h('td', null, String(r.stars)),
          h('td', null, String(r.explored)),
          h('td', null, r.lessonsDoneCount + ' of ' + lessonTotal, r.lessonsDone.length ? h('div', { class: 'small muted' }, r.lessonsDone.join('; ')) : null),
          h('td', null, r.avgPct === null ? 'No quizzes yet' : r.avgPct + '%'),
          h('td', { class: 'small' }, r.quizzes.length ? r.quizzes.map(q => h('div', null, q.label + ': ' + q.score + '/' + q.total)) : '-')))))),
      h('div', { class: 'row no-print' },
        h('button', { type: 'button', class: 'btn', onclick: printReport }, '🖨️ Print report'),
        h('button', { type: 'button', class: 'btn', onclick: () => SIT.download('class-report-' + today() + '.csv', '\ufeff' + L.reportCSV(rows), 'text/csv;charset=utf-8') }, '⬇️ Download CSV'))));

    /* class backup */
    const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: ev => {
      const f = ev.target.files[0]; if (!f) return;
      f.text().then(txt => {
        const r = L.readBackup(JSON.parse(txt), LESSONS.map(x => x.id));
        if (!r.ok) { SIT.toast(r.error); return; }
        const fresh = r.students.filter(s => !fam.kids.some(k => k.id === s.id)).length;
        if (fam.kids.length + fresh > L.MAX_STUDENTS) { SIT.toast('Restoring would put more than ' + L.MAX_STUDENTS + ' students on the roster.'); return; }
        r.students.forEach(s => { const k = fam.kids.find(x => x.id === s.id); if (k) { k.name = s.name; k.avatar = s.avatar; } else fam.kids.push(s); });
        SIT.saveFamily();
        Object.keys(r.progress).forEach(id => store.set('progress.' + id, r.progress[id]));
        saveClassroom(r.classroom);
        SIT.toast('Class restored: ' + r.students.length + ' students. Reloading…'); setTimeout(() => location.reload(), 900);
      }).catch(() => SIT.toast('That file is not a Stark IntraTheater class backup.'));
      ev.target.value = '';
    } });
    box.appendChild(h('section', { class: 'card no-print' }, h('h2', null, '💾 Class backup'),
      h('p', { class: 'muted' }, 'One JSON file with the class name, assigned lessons, the roster and every student\'s progress. Use it to move the class to another computer. Restoring adds students who are missing and updates the ones already here; nobody is deleted.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: () => {
          const progress = {}; fam.kids.forEach(k => { progress[k.id] = SIT.progress(k.id); });
          SIT.download('stark-class-backup-' + today() + '.json', JSON.stringify(L.buildBackup(classroom(), fam.kids, progress, new Date().toISOString())), 'application/json');
        } }, '💾 Back up the class'),
        h('button', { type: 'button', class: 'btn', onclick: () => restore.click() }, '📂 Restore a class backup'), restore)));
  }
  function reportRows() {
    const fam = SIT.family(); const progress = {};
    fam.kids.forEach(k => { progress[k.id] = SIT.progress(k.id); });
    return L.buildReport(fam.kids, progress, LESSONS, data.events.length);
  }
  function printReport() {
    document.body.classList.add('print-report');
    const done = () => { document.body.classList.remove('print-report'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }
  SIT.classroom = { render };
})();
