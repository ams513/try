/* Stark Homeroom: the family screens. Learners, hours by subject, courses and credits, progress reports, the
   transcript, the portfolio and the state requirements page. app.js passes in its helpers (X.files is the browser's
   own file store); all logic lives in homelib.js. Nothing here touches the network. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  SHR.homeViews = function (X) {
    const { h, btn, field, L, ui, save, render, toast, download, nice, today, slug, printNodes, tabs, plural, sheet, schoolLine, meter, FILES } = X;
    const S = () => X.st();
    const $id = id => document.getElementById(id);
    const opt = (v, text, sel) => h('option', { value: v, selected: v === sel }, text);
    const area = (id, value, max, ph) => { const t = h('textarea', { id, maxlength: max, placeholder: ph || null }); t.value = value || ''; return t; };
    const empty = msg => h('div', { class: 'card' }, h('p', { class: 'muted' }, msg));
    const nameOf = sid => (S().students.find(s => s.id === sid) || {}).name || '';
    const gradeSelect = (id, val, label) => h('select', { id, 'aria-label': label || null }, opt('', 'Grade level', val), L.GRADES.map(g => opt(g[0], g[1], val)));
    const subjectSelect = (id, val, extra) => h('select', { id }, extra ? opt('', extra, val) : null, S().subjects.map(x => opt(x, x, val)), val && S().subjects.indexOf(val) < 0 ? opt(val, val, val) : null);
    const pick = (key, id, label, all) => {
      const st = S(); if (!all && !st.students.some(s => s.id === ui[key])) ui[key] = st.students[0] ? st.students[0].id : '';
      const sel = h('select', { id, 'aria-label': label }, all ? opt('', all, ui[key] || '') : null, st.students.map(s => opt(s.id, s.name + (s.grade ? ' (' + L.gradeLabel(s.grade) + ')' : ''), ui[key] || '')));
      sel.addEventListener('change', () => { ui[key] = sel.value; render(); }); return sel;
    };
    const credits = n => (Math.round(n * 100) / 100) + (n === 1 ? ' credit' : ' credits');
    const gpaText = g => (g === null || g === undefined ? '-' : g.toFixed(2));

    /* ---------- Learners ---------- */
    function vLearners() {
      const st = S(), box = h('div');
      const name = h('input', { type: 'text', id: 'ln-name', maxlength: 20, autocomplete: 'off', spellcheck: 'false', placeholder: 'Maya', 'aria-describedby': 'ln-help' }), grade = gradeSelect('ln-grade', ui.lastGrade || '');
      const add = () => { const r = L.addStudents(st, name.value, grade.value); ui.rosterMsg = r.rejected; ui.lastGrade = grade.value; save(); if (r.add.length) toast('Welcome, ' + r.add.join(' and ') + '.'); render(); const n = $id('ln-name'); if (n) n.focus(); };
      name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      box.append(tabs([['learners', 'Learners'], ['notes', 'Private notes']], 'learners'), h('h1', null, 'Your learners'),
        h('div', { class: 'card' }, h('h2', null, 'Add a learner'), h('p', { class: 'muted', id: 'ln-help' }, 'A first name or nickname is all Homeroom needs. If two children share a name, add an initial (Sam K.). A full legal name is only needed on a transcript, and you add it there.'),
          h('div', { class: 'row' }, h('div', { class: 'grow' }, field('First name or nickname', name, 'ln-name')), h('div', { class: 'grow' }, field('Grade level', grade, 'ln-grade'))),
          h('div', { class: 'row' }, btn('Add learner', add), h('span', { class: 'muted small' }, st.students.length + ' of ' + L.MAX_STUDENTS + ' learners'))));
      if (ui.rosterMsg.length) { const m = h('div', { class: 'notice bad', role: 'alert', id: 'err-ln-name' }, h('b', null, 'Not added:'), h('ul', null, ui.rosterMsg.map(r => h('li', null, h('b', null, r.raw || '(blank)'), ': ', r.why)))); box.append(m); X.flag(name, m); }
      if (!st.students.length) { box.append(empty('No learners yet. Add each child you teach at home.')); return box; }
      const yr = X.yearRange();
      box.append(h('div', { class: 'grid' }, st.students.map(s => {
        const g = gradeSelect('lg-' + s.id, s.grade, 'Grade level for ' + s.name); g.addEventListener('change', () => { L.setGrade(st, s.id, g.value); save(); toast(s.name + ': ' + (L.gradeLabel(g.value) || 'no grade level') + '.'); });
        const a = L.attendanceSummary(st, s.id, yr.from, yr.to), hs = L.hoursSummary(st, s.id, yr.from, yr.to), c = L.creditSummary(st, s.id);
        return h('div', { class: 'card learner' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, s.name), g),
          h('ul', { class: 'facts' }, h('li', null, h('b', null, a.school), ' school days'), h('li', null, h('b', null, L.hoursOf(hs.total)), ' hours logged'), h('li', null, h('b', null, c.courses), ' courses, ', h('b', null, c.earned), ' credits earned'), h('li', null, h('b', null, L.itemsFor(st, s.id).length), ' portfolio pieces')),
          h('div', { class: 'row' }, h('a', { href: '#/hours', class: 'small' }, 'Hours'), h('a', { href: '#/courses', class: 'small', onclick: () => { ui.courseSid = s.id; } }, 'Courses'), h('a', { href: '#/portfolio', class: 'small', onclick: () => { ui.portSid = s.id; } }, 'Portfolio'), h('a', { href: '#/transcript', class: 'small', onclick: () => { ui.txSid = s.id; } }, 'Transcript')),
          ui.confirm === 'rm:' + s.id ? h('div', { class: 'notice bad' }, 'Remove ', h('b', null, s.name), ' and every record kept for them (hours, courses, grades, portfolio, notes)? Save a backup first if you may want them later.',
            h('div', { class: 'row' }, btn('Yes, remove ' + s.name, () => { const ids = L.removeStudent(st, s.id); ui.confirm = ''; save(); ids.forEach(id => { FILES.del(id).catch(() => {}); FILES.del('t' + id).catch(() => {}); }); toast(s.name + ' was removed.'); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')))
            : h('div', { class: 'row end' }, btn('Remove', () => { ui.confirm = 'rm:' + s.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Remove ' + s.name })));
      })));
      return box;
    }

    /* ---------- Hours by subject ---------- */
    function vHours() {
      const st = S(), box = h('div'), td = today();
      box.append(h('h1', null, 'Hours'), h('p', { class: 'muted' }, 'Log time as you go, by subject, for one learner or several at once (a read-aloud for everyone counts for everyone). Totals add up by themselves.'));
      if (!st.students.length) { box.append(empty('Add your learners on the Learners page first.')); return box; }
      const d = ui.hoursDraft = ui.hoursDraft || { who: new Set(st.students.map(s => s.id)), date: td, subject: st.subjects[0] || '', h: '1', m: '0', courseId: '', note: '', err: '' };
      d.who.forEach(id => { if (!st.students.some(s => s.id === id)) d.who.delete(id); });
      const date = h('input', { type: 'date', id: 'hr-date', value: d.date }), subj = subjectSelect('hr-subject', d.subject);
      const hh = h('input', { type: 'number', id: 'hr-h', min: 0, max: 24, value: d.h, class: 'narrow' }), mm = h('input', { type: 'number', id: 'hr-m', min: 0, max: 59, step: 5, value: d.m, class: 'narrow' });
      const course = h('select', { id: 'hr-course' }, opt('', 'No course', d.courseId), st.courses.filter(c => c.status !== 'done').map(c => opt(c.id, nameOf(c.sid) + ': ' + c.title, d.courseId)));
      const note = h('input', { type: 'text', id: 'hr-note', maxlength: 300, value: d.note, placeholder: 'What you did, and any books used' });
      const sync = () => { d.date = date.value; d.subject = subj.value; d.h = hh.value; d.m = mm.value; d.courseId = course.value; d.note = note.value; };
      [date, subj, hh, mm, course, note].forEach(el => el.addEventListener('input', sync));
      course.addEventListener('change', () => { sync(); const c = st.courses.find(x => x.id === course.value); if (c) { d.who = new Set([c.sid]); if (c.subject) d.subject = c.subject; render(); } });
      const log = () => {
        sync();
        try {
          const made = L.logHours(st, { sids: [...d.who], date: d.date, subject: d.subject, minutes: (parseFloat(d.h) || 0) * 60 + (parseFloat(d.m) || 0), courseId: d.courseId, note: d.note });
          d.err = ''; d.note = ''; save(); toast('Logged ' + L.fmtMinutes(made[0].minutes) + ' of ' + d.subject + ' for ' + made.map(e => nameOf(e.sid)).join(', ') + '.');
        } catch (e) { d.err = e.message; }
        render();
        const bad = document.querySelector('#hr-form [aria-invalid="true"]'); if (bad) bad.focus();
      };
      const hrErr = d.err ? h('div', { class: 'notice bad', role: 'alert', id: 'err-hr' }, d.err) : null;
      if (hrErr) X.flag(/how long|24 hours/.test(d.err) ? hh : /subject/i.test(d.err) ? subj : /date/i.test(d.err) ? date : /course/i.test(d.err) ? course : hh, hrErr);
      box.append(h('div', { class: 'card', id: 'hr-form' }, h('h2', null, 'Log time'), hrErr,
        h('h3', null, 'Who'), X.whoChecks(d.who, 'Learners for this time'),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Date', date, 'hr-date')), h('div', { class: 'grow' }, field('Subject', subj, 'hr-subject')),
          h('div', null, field('Hours', hh, 'hr-h')), h('div', null, field('Minutes', mm, 'hr-m'))),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Course (optional)', course, 'hr-course')), h('div', { class: 'grow' }, field('What we did', note, 'hr-note'))),
        h('div', { class: 'row' }, btn('Log time', log), h('span', { class: 'small muted' }, 'Picking a course logs the time for that course\'s learner.'))));
      const yr = X.yearRange(), goal = st.goals.hours;
      const sums = st.students.map(s => ({ s, x: L.hoursSummary(st, s.id, yr.from, yr.to) }));
      const subjects = st.subjects.concat([].concat.apply([], sums.map(r => r.x.bySubject.map(b => b.subject))).filter((v, i, a) => st.subjects.indexOf(v) < 0 && a.indexOf(v) === i)).filter(sub => sums.some(r => r.x.bySubject.some(b => b.subject === sub)));
      box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, yr.label), btn('Download hours (CSV)', () => download('hours-' + slug(st.classroom.name || 'family') + '.csv', L.hoursCSV(st, yr.from, yr.to), 'text/csv;charset=utf-8'), 'btn-ghost btn-small', { disabled: !st.hours.length })),
        h('div', { class: 'tablewrap' }, h('table', { id: 'hr-table' }, h('thead', null, h('tr', null, h('th', null, 'Learner'), subjects.map(x => h('th', { class: 'num' }, x)), h('th', { class: 'num' }, 'Total hours'), h('th', { class: 'num' }, 'Days'), goal ? h('th', { class: 'num' }, 'Goal ' + goal + ' h') : null)),
          h('tbody', null, sums.map(({ s, x }) => h('tr', null, h('td', null, h('b', null, s.name)), subjects.map(sub => { const b = x.bySubject.find(y => y.subject === sub); return h('td', { class: 'num' }, b ? L.hoursOf(b.minutes) : h('span', { class: 'muted' }, '-')); }),
            h('td', { class: 'num' }, h('b', null, L.hoursOf(x.total))), h('td', { class: 'num' }, x.days), goal ? h('td', { class: 'num' }, meter(L.hoursOf(x.total), goal, s.name + ' hours')) : null))))),
        h('p', { class: 'small muted' }, 'Hours are rounded to one decimal place. "Days" counts the dates with any time logged.')));
      const f = ui.hoursFilter || '', list = st.hours.filter(e => (!f || e.sid === f) && (!yr.from || e.date >= yr.from) && (!yr.to || e.date <= yr.to)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
      const filter = h('select', { id: 'hr-filter', 'aria-label': 'Show entries for' }, opt('', 'Everyone', f), st.students.map(s => opt(s.id, s.name, f))); filter.addEventListener('change', () => { ui.hoursFilter = filter.value; render(); });
      const cname = id => (st.courses.find(c => c.id === id) || {}).title || '';
      box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Recent entries'), h('label', { for: 'hr-filter' }, 'Show'), filter),
        list.length ? h('ul', { class: 'list' }, list.map(e => h('li', null, h('div', { class: 'grow' }, h('b', null, nameOf(e.sid)), ' ', h('span', { class: 'chip' }, e.subject), ' ', L.fmtMinutes(e.minutes), ' ', h('span', { class: 'muted small' }, nice(e.date)), e.courseId ? h('span', { class: 'chip' }, cname(e.courseId)) : null, e.note ? h('div', { class: 'small muted' }, e.note) : null),
          ui.confirm === 'dh:' + e.id ? h('span', { class: 'row tight' }, btn('Yes, delete', () => { st.hours = st.hours.filter(x => x.id !== e.id); ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small'))
            : btn('Delete', () => { ui.confirm = 'dh:' + e.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + e.subject + ' on ' + nice(e.date) + ' for ' + nameOf(e.sid) })))) : h('p', { class: 'muted' }, 'Nothing logged yet.')));
      const ns = h('input', { type: 'text', id: 'hr-newsub', maxlength: 40, placeholder: 'Latin, Robotics, Nature study' });
      const used = new Set(st.hours.map(e => e.subject).concat(st.courses.map(c => c.subject)));
      box.append(h('div', { class: 'card' }, h('h2', null, 'Subjects'), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Add a subject', ns, 'hr-newsub')), btn('Add subject', () => { try { L.addSubject(st, ns.value); save(); render(); } catch (e) { toast(e.message, true); } }, 'btn-small')),
        h('div', null, st.subjects.map(x => h('span', { class: 'chip sub-chip' }, x, used.has(x) ? null : h('button', { type: 'button', class: 'x', 'aria-label': 'Remove subject ' + x, onclick: () => { L.removeSubject(st, x); save(); render(); } }, '×')))),
        h('p', { class: 'small muted' }, 'A subject with time or a course in it stays on the list.')));
      return box;
    }

    /* ---------- Courses and credits ---------- */
    function blankCourse(sid) { const st = S(), s = st.students.find(x => x.id === sid) || {}; return { id: '', sid, title: '', subject: st.subjects[0] || '', year: X.yearLabel(), gradeLevel: s.grade || '', level: 'standard', credits: '1', status: 'progress', grade: '', description: '', err: '' }; }
    function courseForm() {
      const st = S(), d = ui.courseDraft;
      const f = (k, label, type, extra) => { const el = h('input', Object.assign({ type: type || 'text', id: 'co-' + k, value: d[k] }, extra || {})); el.addEventListener('input', () => { d[k] = el.value; }); return field(label, el, 'co-' + k); };
      const sel = (k, label, el) => { el.addEventListener('change', () => { d[k] = el.value; }); return field(label, el, el.id); };
      const desc = area('co-description', d.description, 1500, 'What the course covered, the main books or curriculum, labs or projects, and how it was assessed.'); desc.addEventListener('input', () => { d.description = desc.value; });
      return h('div', { class: 'card', id: 'coursebox' }, h('h2', null, d.id ? 'Edit course' : 'New course'), d.err ? h('div', { class: 'notice bad', role: 'alert' }, d.err) : null,
        h('div', { class: 'row' }, h('div', { class: 'grow' }, sel('sid', 'Learner', h('select', { id: 'co-sid' }, st.students.map(s => opt(s.id, s.name, d.sid))))), h('div', { class: 'grow2' }, f('title', 'Course title', 'text', { maxlength: 100, placeholder: 'Algebra 1' }))),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, sel('subject', 'Subject', subjectSelect('co-subject', d.subject))), h('div', { class: 'grow' }, f('year', 'School year', 'text', { maxlength: 20, placeholder: '2026-27' })), h('div', { class: 'grow' }, sel('gradeLevel', 'Grade level', gradeSelect('co-gradeLevel', d.gradeLevel)))),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, sel('level', 'Level', h('select', { id: 'co-level' }, Object.keys(L.LEVELS).map(k => opt(k, L.LEVELS[k], d.level))))), h('div', null, f('credits', 'Credits', 'number', { min: 0, max: 10, step: 0.25 })),
          h('div', { class: 'grow' }, sel('status', 'Status', h('select', { id: 'co-status' }, Object.keys(L.STATUS).map(k => opt(k, L.STATUS[k], d.status))))), h('div', { class: 'grow' }, f('grade', 'Final grade (optional)', 'text', { maxlength: 5, placeholder: 'A-, 92 or P' }))),
        field('Course description (printed on the transcript)', desc, 'co-description'),
        h('p', { class: 'small muted' }, 'Leave the final grade empty to use the grade book: graded assignments linked to this course are averaged by weight. One credit is usually a full-year course of about 120 to 180 hours; check what the colleges your learner is aiming for expect.'),
        h('div', { class: 'row' }, btn('Save course', () => { try { const c = L.saveCourse(st, d); ui.courseDraft = null; ui.courseSid = c.sid; save(); toast('Course saved.'); } catch (e) { d.err = e.message; } render(); }), btn('Cancel', () => { ui.courseDraft = null; render(); }, 'btn-ghost')));
    }
    function vCourses() {
      const st = S(), box = h('div');
      box.append(h('h1', null, 'Courses and credits'), h('p', { class: 'muted' }, 'Keep each learner\'s course list as you go, with credits, a level and a description. The transcript is built from it.'));
      if (!st.students.length) { box.append(empty('Add your learners on the Learners page first.')); return box; }
      const sel = pick('courseSid', 'co-filter', 'Show courses for');
      box.append(h('div', { class: 'row' }, h('label', { for: 'co-filter' }, 'Learner'), h('div', { class: 'grow' }, sel), ui.courseDraft ? null : btn('New course', () => { ui.courseDraft = blankCourse(ui.courseSid); render(); const t = $id('co-title'); if (t) t.focus(); })));
      if (ui.courseDraft) box.append(courseForm());
      const sid = ui.courseSid, rows = L.courseRows(st, sid, st.tx.gpa), sum = L.creditSummary(st, sid);
      box.append(h('div', { class: 'grid' }, h('div', { class: 'card stat' }, h('b', null, sum.earned), h('span', null, 'credits earned')), h('div', { class: 'card stat' }, h('b', null, sum.progress), h('span', null, 'credits in progress')),
        h('div', { class: 'card stat' }, h('b', null, gpaText(sum.unweighted)), h('span', null, 'GPA, unweighted')), h('div', { class: 'card stat' }, h('b', null, gpaText(sum.weighted)), h('span', null, 'GPA, weighted'))));
      if (!rows.length) { box.append(empty('No courses yet for ' + nameOf(sid) + '. Add the courses they are taking this year, and any they have finished.')); return box; }
      const years = rows.map(r => r.year || 'No school year').filter((v, i, a) => a.indexOf(v) === i).sort();
      years.forEach(y => {
        box.append(h('h2', { class: 'yr' }, y));
        rows.filter(r => (r.year || 'No school year') === y).forEach(r => {
          const c = st.courses.find(x => x.id === r.id), linked = st.assignments.filter(a => a.courseId === r.id).length;
          box.append(h('div', { class: 'card course' }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, r.title), h('span', { class: 'chip' }, r.subject || 'No subject'), r.level !== 'standard' ? h('span', { class: 'chip std' }, r.levelName) : null, h('span', { class: 'chip' }, credits(r.credits)), h('span', { class: 'chip st-' + r.status }, r.statusName)),
            h('p', null, h('b', null, 'Grade: '), r.letter ? L.courseGrade(st, c).text + (r.source === 'gradebook' ? ' (from the grade book)' : '') :h('span', { class: 'muted' }, linked ? 'nothing graded yet' : 'not set'), r.minutes ? [' · ', h('b', null, 'Hours: '), L.hoursOf(r.minutes)] : null, linked ? [' · ', plural(linked, 'linked assignment')] : null),
            r.description ? h('p', { class: 'small muted' }, r.description.length > 220 ? r.description.slice(0, 219) + '…' : r.description) : h('p', { class: 'small muted' }, 'No description yet. Colleges often ask for one.'),
            h('div', { class: 'row' }, btn('Edit', () => { ui.courseDraft = Object.assign({}, c, { credits: String(c.credits), err: '' }); render(); const t = $id('co-title'); if (t) t.focus(); }, 'btn-ghost btn-small', { 'aria-label': 'Edit ' + r.title }),
              ui.confirm === 'dc:' + r.id ? [btn('Yes, delete the course', () => { L.removeCourse(st, r.id); ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')] : btn('Delete', () => { ui.confirm = 'dc:' + r.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + r.title }))));
        });
      });
      return box;
    }

    /* ---------- Progress report ---------- */
    const repTabs = k => tabs([['reports', 'Progress report'], ['transcript', 'Transcript'], ['hoursreport', 'Attendance and hours'], ['portreport', 'Portfolio report'], ['yearsummary', 'Year summary']], k);
    function progressSheet(r) {
      const a = r.attendance, g = r.goals;
      return h('article', { class: 'report' }, h('div', { class: 'rh' }, h('div', null, h('h1', null, 'Progress report: ', r.name), h('small', null, [r.grade, r.school, r.year, r.from && r.to ? nice(r.from) + ' to ' + nice(r.to) : ''].filter(Boolean).join(' · '))),
        h('div', { class: 'right' }, r.final.pct === null ? h('div', { class: 'muted' }, 'No marked work yet') : [h('div', { class: 'big' }, Math.round(r.final.pct) + '%'), h('div', { class: 'band-' + r.final.band }, r.final.band)])),
        h('div', { class: 'cols' }, h('div', null, h('h3', null, 'Attendance'), a.days ? h('p', null, h('b', null, a.school), ' school days' + (g.days ? ' of a ' + g.days + '-day goal' : ''), h('br'), [a.H ? a.H + ' half days' : '', a.T ? a.T + ' field trips' : '', a.A ? a.A + ' absent' : ''].filter(Boolean).join(', ') || 'No half days or absences') : h('p', { class: 'muted' }, 'No days marked yet.')),
          h('div', null, h('h3', null, 'Hours'), r.hours.total ? h('p', null, h('b', null, L.hoursOf(r.hours.total)), ' hours on ' + plural(r.hours.days, 'day') + (g.hours ? ' (goal ' + g.hours + ')' : '')) : h('p', { class: 'muted' }, 'No time logged yet.'))),
        r.hours.bySubject.length ? [h('h3', null, 'Hours by subject'), h('table', null, h('tbody', null, r.hours.bySubject.map(b => h('tr', null, h('td', null, b.subject), h('td', null, L.hoursOf(b.minutes) + ' h')))))] : null,
        r.courses.length ? [h('h3', null, 'Courses'), h('table', null, h('thead', null, h('tr', null, h('th', null, 'Course'), h('th', null, 'Year'), h('th', null, 'Credits'), h('th', null, 'Grade'))), h('tbody', null, r.courses.map(c => h('tr', null, h('td', null, c.title), h('td', null, c.year), h('td', null, c.credits), h('td', null, c.grade)))))] : null,
        r.rows.length ? [h('h3', null, 'Marked work'), h('table', null, h('tbody', null, r.rows.map(x => h('tr', null, h('td', null, h('b', null, x.title), x.due ? h('div', { class: 'small' }, nice(x.due)) : null), h('td', null, Math.round(x.pct) + '% ', h('span', { class: 'band-' + x.band }, x.band)), h('td', null, x.comment)))))] : null,
        r.standards.length ? [h('h3', null, 'Skills (1 to 4)'), h('table', null, h('tbody', null, r.standards.map(m => h('tr', null, h('td', null, h('b', null, m.code), ' ', m.label), h('td', null, m.prof + ' (' + (Math.round(m.score * 10) / 10).toFixed(1) + ')')))))] : null,
        r.strengths.length ? h('p', null, h('b', null, 'Going well: '), r.strengths.join('; ')) : null, r.next.length ? h('p', null, h('b', null, 'Next steps: '), r.next.join('; ')) : null,
        r.missing.length ? h('p', null, h('b', null, 'Still to finish: '), r.missing.join('; ')) : null,
        r.portfolio.length ? [h('h3', null, 'Portfolio'), h('ul', null, r.portfolio.slice(0, 12).map(p => h('li', null, nice(p.date) + ': ' + p.title + (p.subject ? ' (' + p.subject + ')' : ''))))] : null,
        r.evidence.length ? [h('h3', null, 'Work in the Stark apps'), h('ul', null, r.evidence.map(e => h('li', null, h('b', null, e.label + ': '), e.detail)))] : null,
        h('div', { class: 'foot' }, 'Prepared by ' + (r.parent || 'the parent') + ' with Stark Homeroom on ' + nice(today()) + '.'));
    }
    function vReports() {
      const st = S(), box = h('div'); box.append(repTabs('reports'), h('h1', null, 'Progress report'), h('p', { class: 'muted' }, 'A one-page picture of the year for each learner: days, hours by subject, courses, marked work, skills and portfolio. Useful for your own records, an evaluator or an umbrella school.'));
      if (!st.students.length) { box.append(empty('Add your learners first.')); return box; }
      const sel = pick('repSid', 'rep-learner', 'Learner'), yr = X.yearRange();
      const rep = id => L.progressReport(st, id, { from: yr.from, to: yr.to, today: today() });
      box.append(h('div', { class: 'row' }, h('label', { for: 'rep-learner' }, 'Learner'), sel, btn('Print this report', () => printNodes([progressSheet(rep(ui.repSid))])), btn('Print every learner', () => printNodes(st.students.map(s => progressSheet(rep(s.id)))), 'btn-ghost')),
        h('p', { class: 'small muted' }, yr.label + '. Private notes never appear here.'), h('div', { id: 'rep-sheet' }, progressSheet(rep(ui.repSid))));
      return box;
    }

    function vTranscript() { const box = h('div'); box.append(repTabs('transcript'), h('h1', null, 'Transcript'), window.StarkTrial.card('transcript')); return box; }
    /* ---------- Portfolio ---------- */
    const portTabs = k => tabs([['portfolio', 'Portfolio'], ['collect', 'From the Stark apps']], k);
    function thumb(p, cls) {
      if (!p.file || !L.imageType(p.file.type)) return h('div', { class: (cls || 'thumb') + ' doc', 'aria-hidden': 'true' }, p.file ? (/\.([A-Za-z0-9]{1,6})$/.exec(p.file.name) || [0, 'file'])[1].toUpperCase() : 'NOTE');
      const img = h('img', { class: cls || 'thumb', alt: p.title });
      FILES.get('t' + p.file.id).then(u => { if (typeof u === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(u)) img.src = u; }).catch(() => {});
      return img;
    }
    function portfolioSheet(sid, items) {
      return sheet('Portfolio: ' + nameOf(sid), schoolLine(), h('div', { class: 'pprint' }, items.map(p => h('div', { class: 'pitem' }, thumb(p, 'pthumb'), h('div', null, h('h3', null, p.title), h('div', { class: 'small' }, [nice(p.date), p.subject, p.file ? p.file.name : ''].filter(Boolean).join(' · ')), p.note ? h('p', { class: 'pre' }, p.note) : null, p.from ? h('p', { class: 'small' }, 'From the Stark apps: ' + p.from) : null)))));
    }
    async function addFile(f) {
      if (f.size > L.HOME_LIM.fileBytes) throw new Error('That file is bigger than 25 MB.');
      const buf = await f.arrayBuffer(), sha = await X.sha256(buf), id = L.freshId('f', S().portfolio.filter(p => p.file).map(p => p.file.id));
      await FILES.put(id, { name: f.name, type: f.type, data: buf });
      if (L.imageType(f.type)) await X.makeThumb(f, id);
      return { id, name: f.name, type: f.type, size: f.size, sha };
    }
    function vPortfolio() {
      const st = S(), box = h('div'); box.append(portTabs('portfolio'), h('h1', null, 'Portfolio'), h('p', { class: 'muted' }, 'Keep each learner\'s best work: a photo of a project, a scanned page, a PDF, or just a note. Files stay in this browser on this computer.'));
      if (!st.students.length) { box.append(empty('Add your learners on the Learners page first.')); return box; }
      const sel = pick('portSid', 'pf-learner', 'Learner'), sid = ui.portSid;
      const title = h('input', { type: 'text', id: 'pf-title', maxlength: 120, placeholder: 'Volcano model' }), date = h('input', { type: 'date', id: 'pf-date', value: today() });
      const subj = subjectSelect('pf-subject', '', 'No subject'), course = h('select', { id: 'pf-course' }, opt('', 'No course', ''), st.courses.filter(c => c.sid === sid).map(c => opt(c.id, c.title, '')));
      const note = area('pf-note', '', 1000, 'Why it is worth keeping, what they learned, how long it took'), file = h('input', { type: 'file', id: 'pf-file', 'aria-label': 'Attach a file (optional)' });
      const msg = h('div', { class: 'notice bad', role: 'alert', hidden: true }), go = h('button', { type: 'button', class: 'btn', id: 'pf-add' }, 'Add to portfolio');
      go.addEventListener('click', async () => {
        msg.hidden = true; go.disabled = true;
        try {
          const f = file.files && file.files[0];
          if (!L.clip(title.value, 120)) throw new Error('Give this piece of work a title.');
          const meta = f ? await addFile(f) : null;
          try { L.addPortfolioItem(st, { sid, date: date.value, title: title.value, subject: subj.value, courseId: course.value, note: note.value, file: meta }); }
          catch (e) { if (meta) { FILES.del(meta.id).catch(() => {}); FILES.del('t' + meta.id).catch(() => {}); } throw e; }
          save(); toast('Added to ' + nameOf(sid) + '\'s portfolio.'); render();
        } catch (e) { msg.textContent = e && e.message ? e.message : 'This browser could not store the file.'; msg.hidden = false; go.disabled = false; X.unflag(title, date, file); const bad = /title/.test(msg.textContent) ? title : /date/.test(msg.textContent) ? date : /file|MB/.test(msg.textContent) ? file : null; if (bad) { X.flag(bad, msg); bad.focus(); } }
      });
      box.append(h('div', { class: 'row' }, h('label', { for: 'pf-learner' }, 'Learner'), sel));
      box.append(h('div', { class: 'card' }, h('h2', null, 'Add best work'), msg, X.filesOk() ? null : h('div', { class: 'notice' }, 'This browser is not letting Homeroom store files (a private window, or site data blocked). You can still add notes.'),
        h('div', { class: 'row' }, h('div', { class: 'grow2' }, field('Title', title, 'pf-title')), h('div', { class: 'grow' }, field('Date', date, 'pf-date'))),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Subject', subj, 'pf-subject')), h('div', { class: 'grow' }, field('Course', course, 'pf-course'))),
        field('Note', note, 'pf-note'), field('File (photo, scan, PDF or document, up to 25 MB; optional)', file, 'pf-file'), h('div', { class: 'row' }, go)));
      const items = L.itemsFor(st, sid), apps = L.appWork(st, sid);
      if (apps.length) box.append(h('div', { class: 'card' }, h('h2', null, 'Work from the Stark apps'), h('p', { class: 'small muted' }, 'Results you brought in on the "From the Stark apps" tab. Add the ones worth keeping.'),
        h('ul', { class: 'list' }, apps.map(e => h('li', null, h('div', { class: 'grow' }, h('b', null, e.label), h('div', { class: 'small muted' }, e.detail)), btn('Add to portfolio', () => { L.addPortfolioItem(st, { sid, date: e.when || today(), title: e.label.replace(/^[^:]+: /, ''), subject: '', note: e.detail, from: e.label }); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Add ' + e.label + ' to the portfolio' }))))));
      box.append(h('div', { class: 'row' }, h('h2', { class: 'grow' }, nameOf(sid) + ': ' + plural(items.length, 'piece')), btn('Print portfolio', () => printNodes([portfolioSheet(sid, items)]), 'btn-small', { disabled: !items.length }),
        btn('Download files (zip)', () => X.portfolioZip([sid]), 'btn-ghost btn-small', { disabled: !items.length })));
      if (!items.length) box.append(empty('Nothing here yet. A few pieces a month makes a portfolio an evaluator can read in minutes.'));
      else box.append(h('div', { class: 'grid pgrid' }, items.map(p => h('div', { class: 'card pcard' }, thumb(p), h('h3', null, p.title), h('div', { class: 'small muted' }, [nice(p.date), p.subject, p.courseId ? (st.courses.find(c => c.id === p.courseId) || {}).title : ''].filter(Boolean).join(' · ')),
        p.note ? h('p', { class: 'small' }, p.note) : null, p.from ? h('p', { class: 'small muted' }, 'From the Stark apps') : null,
        h('div', { class: 'row' }, p.file ? btn('Save a copy', () => X.saveFile(p.file), 'btn-ghost btn-small', { 'aria-label': 'Save a copy of ' + p.title }) : null,
          ui.confirm === 'dp:' + p.id ? [btn('Yes, remove', () => { const fid = L.removePortfolioItem(st, p.id); ui.confirm = ''; save(); if (fid) { FILES.del(fid).catch(() => {}); FILES.del('t' + fid).catch(() => {}); } render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')]
            : btn('Remove', () => { ui.confirm = 'dp:' + p.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Remove ' + p.title }))))));
      return box;
    }

    /* ---------- State requirements (information only) ---------- */
    const TOOL = { attendance: 'Attendance', hours: 'Hours', portfolio: 'Portfolio', reports: 'Progress report', transcript: 'Transcript', courses: 'Courses', lessons: 'Lessons' };
    function vStates() {
      const st = S(), D = X.STATES, box = h('div'), mine = st.classroom.state;
      box.append(h('h1', null, 'State requirements'), h('div', { class: 'notice warn-note', role: 'note' }, h('b', null, D.label + '. '), 'Rules change, and this is not legal advice. Each line below says what one official state page said when we checked it, and links to that page so you can read it yourself.'),
        h('p', { class: 'small muted' }, D.ranking.text, ' ', h('a', { href: D.ranking.url, target: '_blank', rel: 'noopener noreferrer' }, 'Census Bureau tables'), ' (checked ' + nice(D.ranking.checked) + ').'));
      const list = D.list.slice().sort((a, b) => (b.code === mine) - (a.code === mine));
      box.append(h('nav', { class: 'tabs', 'aria-label': 'States' }, list.map(s => h('a', { href: '#/states', onclick: e => { e.preventDefault(); const t = $id('st-' + s.code); if (t) t.scrollIntoView({ block: 'start' }); } }, s.name))));
      list.forEach(s => {
        box.append(h('section', { class: 'card state' + (s.code === mine ? ' mine' : ''), id: 'st-' + s.code, 'aria-labelledby': 'sth-' + s.code }, h('div', { class: 'row' }, h('h2', { class: 'grow', id: 'sth-' + s.code }, s.name), s.code === mine ? h('span', { class: 'chip good' }, 'Your state') : null, h('span', { class: 'chip' }, 'Census estimate: ' + s.estimate.toLocaleString('en-US'))),
          h('ol', { class: 'rules' }, s.lines.map(l => h('li', null, h('p', null, l.text), h('p', { class: 'src small' }, 'Source: ', h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.url), ' · checked ' + nice(l.checked)), l.tool ? h('p', { class: 'small' }, 'In Homeroom: ', h('a', { href: '#/' + l.tool }, TOOL[l.tool])) : null)))));
      });
      box.append(h('p', { class: 'small muted' }, 'Homeroom never opens these links by itself. They open in your own browser only when you choose one. If your state is not here, its department of education publishes its own rules.'));
      return box;
    }

    return { repTabs, learners: vLearners, hours: vHours, courses: vCourses, reports: vReports, transcript: vTranscript, portfolio: vPortfolio, portTabs, states: vStates, progressSheet };
  };
})(typeof window !== 'undefined' ? window : globalThis);
