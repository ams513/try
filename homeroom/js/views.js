/* Stark Homeroom: the inherited teaching screens, adapted for a family. Lessons and units, the family register,
   private notes, standards and the rubric library. app.js passes in its helpers; all logic lives in teachlib.js.
   Nothing here touches the network. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  SHR.extViews = function (X) {
    const { h, btn, field, L, ui, save, render, toast, download, nice, today, slug, printNodes, tabs, plural } = X;
    const S = () => X.st();
    const $id = id => document.getElementById(id);
    const redo = id => { save(); render(); const el = id && $id(id); if (el) el.focus(); };
    const dayName = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' });
    const opt = (v, text, sel) => h('option', { value: v, selected: v === sel }, text);
    const learnerSelect = (id, label, val) => h('select', { id, 'aria-label': label }, S().students.map(s => opt(s.id, s.name, val)));
    const area = (id, value, max, ph) => { const t = h('textarea', { id, maxlength: max, placeholder: ph || null }); t.value = value || ''; return t; };
    const empty = msg => h('div', { class: 'card' }, h('p', { class: 'muted' }, msg));
    const needLearners = () => (S().students.length ? null : empty('Add your learners on the Learners page first.'));
    const codeChecks = (picked, group) => { const st = S().standards; return st.length ? h('div', { class: 'pick small-pick', role: 'group', 'aria-label': group }, st.map(x => h('label', null, h('input', { type: 'checkbox', checked: picked.has(x.code), onchange: e => { e.target.checked ? picked.add(x.code) : picked.delete(x.code); } }), h('span', null, h('b', null, x.code), ' ', x.label)))) : h('p', { class: 'small muted' }, 'Add skill codes on the Grade book > Standards page to tag them here.'); };
    const whoChecks = (picked, group) => h('div', { class: 'who', role: 'group', 'aria-label': group }, S().students.map(s => h('label', null, h('input', { type: 'checkbox', checked: picked.has(s.id), onchange: e => { e.target.checked ? picked.add(s.id) : picked.delete(s.id); } }), ' ', s.name)));
    const whoText = ids => (ids && ids.length ? ids.map(id => (S().students.find(s => s.id === id) || {}).name).filter(Boolean).join(', ') : 'Everyone');
    const sheet = X.sheet;
    const schoolLine = X.schoolLine;

    /* ---------- Lessons and units ---------- */
    const lessonTabs = k => tabs([['lessons', 'Lessons'], ['calendar', 'Calendar']], k);
    const unitOf = p => (S().units.find(u => u.id === p.unitId) || {}).title || '';
    function weekSheet(days) {
      return sheet('Week plan: ' + nice(days[0].date), schoolLine(), h('table', null, h('thead', null, h('tr', null, h('th', null, 'Day'), h('th', null, 'Lesson'), h('th', null, 'Goal and activities'), h('th', null, 'Materials and follow-up'))),
        h('tbody', null, days.map(d => (d.plans.length ? d.plans : [null]).map((p, i) => h('tr', null, h('td', null, i ? '' : [h('b', null, dayName(d.date)), h('div', { class: 'small' }, nice(d.date))]),
          p ? [h('td', null, h('b', null, p.title), h('div', { class: 'small' }, whoText(p.who)), unitOf(p) ? h('div', { class: 'small' }, unitOf(p)) : null), h('td', null, p.objective ? h('div', null, h('b', null, 'Goal: '), p.objective) : null, p.activities ? h('div', { class: 'pre' }, p.activities) : null), h('td', null, p.materials ? h('div', null, h('b', null, 'Materials: '), p.materials) : null, p.homework ? h('div', null, h('b', null, 'Follow-up: '), p.homework) : null)]
            : [h('td', { class: 'muted' }, 'No lesson planned'), h('td'), h('td')]))))));
    }
    function planForm() {
      const d = ui.planDraft, st = S();
      const f = (k, label, type, extra) => { const el = h('input', Object.assign({ type: type || 'text', id: 'pl-' + k, value: d[k] }, extra || {})); el.addEventListener('input', () => { d[k] = el.value; }); return field(label, el, 'pl-' + k); };
      const ta = (k, label, max) => { const el = area('pl-' + k, d[k], max); el.addEventListener('input', () => { d[k] = el.value; }); return field(label, el, 'pl-' + k); };
      const unit = h('select', { id: 'pl-unit' }, opt('', 'No unit', d.unitId), st.units.map(u => opt(u.id, u.title, d.unitId))); unit.addEventListener('change', () => { d.unitId = unit.value; });
      return h('div', { class: 'card', id: 'planbox' }, h('h2', null, d.id ? 'Edit lesson' : 'New lesson'), d.err ? h('div', { class: 'notice bad', role: 'alert' }, d.err) : null,
        h('div', { class: 'row' }, h('div', { class: 'grow' }, f('date', 'Date', 'date')), h('div', { class: 'grow' }, field('Unit', unit, 'pl-unit')), h('div', { class: 'grow' }, f('title', 'Lesson title', 'text', { maxlength: 120 }))),
        st.students.length ? [h('h3', null, 'Who is it for? ', h('span', { class: 'muted small' }, '(leave all unticked for the whole family)')), whoChecks(d.who, 'Learners for this lesson')] : null,
        f('objective', 'Goal (by the end, they will be able to...)', 'text', { maxlength: 300 }), ta('activities', 'Activities (warm-up, main task, wrap-up)', 2000),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, f('materials', 'Materials and books', 'text', { maxlength: 600 })), h('div', { class: 'grow' }, f('homework', 'Follow-up', 'text', { maxlength: 300 }))),
        h('h3', null, 'Skills this lesson covers'), codeChecks(d.standards, 'Skills for this lesson'),
        h('div', { class: 'row' }, btn('Save lesson', () => { try { L.addPlan(st, Object.assign({}, d, { standards: [...d.standards], who: [...d.who] })); ui.planDraft = null; ui.week = L.weekStart(d.date); save(); toast('Lesson saved.'); } catch (e) { d.err = e.message; } render(); }), btn('Cancel', () => { ui.planDraft = null; render(); }, 'btn-ghost')));
    }
    function unitForm() {
      const d = ui.unitDraft;
      const f = (k, label, type, extra) => { const el = h('input', Object.assign({ type: type || 'text', id: 'un-' + k, value: d[k] }, extra || {})); el.addEventListener('input', () => { d[k] = el.value; }); return field(label, el, 'un-' + k); };
      const goal = area('un-goal', d.goal, 600, 'What your learners will understand by the end'); goal.addEventListener('input', () => { d.goal = goal.value; });
      return h('div', { class: 'card', id: 'unitbox' }, h('h2', null, 'New unit'), d.err ? h('div', { class: 'notice bad', role: 'alert' }, d.err) : null,
        h('div', { class: 'row' }, h('div', { class: 'grow' }, f('title', 'Unit title', 'text', { maxlength: 120 })), h('div', { class: 'grow' }, f('start', 'Starts', 'date')), h('div', { class: 'grow' }, f('end', 'Ends', 'date'))),
        field('Big goal', goal, 'un-goal'), h('h3', null, 'Skills in this unit'), codeChecks(d.standards, 'Skills for this unit'),
        h('div', { class: 'row' }, btn('Save unit', () => { try { L.addUnit(S(), Object.assign({}, d, { standards: [...d.standards] })); ui.unitDraft = null; save(); toast('Unit saved.'); } catch (e) { d.err = e.message; } render(); }), btn('Cancel', () => { ui.unitDraft = null; render(); }, 'btn-ghost')));
    }
    function vLessons() {
      const st = S(), td = today(), box = h('div');
      if (!ui.week) ui.week = L.weekStart(td);
      const days = L.weekPlans(st, ui.week);
      box.append(lessonTabs('lessons'), h('h1', null, 'Lessons and units'), h('p', { class: 'muted' }, 'Plan a unit, then the lessons inside it, for one learner or the whole family. Lessons show on the calendar.'));
      if (ui.unitDraft) box.append(unitForm());
      if (ui.planDraft) box.append(planForm());
      const wk = h('div', { class: 'card' }, h('div', { class: 'row' }, btn('Previous week', () => { ui.week = L.addDays(ui.week, -7); render(); }, 'btn-ghost btn-small'), h('h2', { class: 'grow', id: 'week-title' }, 'Week of ' + nice(ui.week)),
        btn('This week', () => { ui.week = L.weekStart(td); render(); }, 'btn-ghost btn-small'), btn('Next week', () => { ui.week = L.addDays(ui.week, 7); render(); }, 'btn-ghost btn-small'), btn('Print week', () => printNodes([weekSheet(days)]), 'btn-small')));
      days.forEach(d => {
        wk.append(h('div', { class: 'day' + (d.date === td ? ' is-today' : '') }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, dayName(d.date), ' ', h('span', { class: 'muted small' }, nice(d.date))), btn('Add a lesson', () => { ui.planDraft = { id: '', date: d.date, unitId: (st.units.find(u => u.start && u.start <= d.date && (!u.end || u.end >= d.date)) || {}).id || '', title: '', objective: '', activities: '', materials: '', homework: '', standards: new Set(), who: new Set(), err: '' }; render(); const t = $id('pl-title'); if (t) t.focus(); }, 'btn-ghost btn-small', { 'aria-label': 'Add a lesson on ' + dayName(d.date) })),
          d.plans.length ? h('ul', { class: 'list' }, d.plans.map(p => h('li', null, h('div', { class: 'grow' }, h('b', null, p.title), ' ', h('span', { class: 'chip who-chip' }, whoText(p.who)), unitOf(p) ? h('span', { class: 'chip' }, unitOf(p)) : null, p.standards.map(c => h('span', { class: 'chip std' }, c)), p.objective ? h('div', { class: 'small muted' }, p.objective) : null),
            h('span', { class: 'row tight' }, btn('Edit', () => { ui.planDraft = Object.assign({}, p, { standards: new Set(p.standards), who: new Set(p.who), err: '' }); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Edit ' + p.title }),
              btn('Copy to next week', () => { L.copyPlan(st, p.id, L.addDays(p.date, 7)); save(); toast('Copied to ' + nice(L.addDays(p.date, 7)) + '.'); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Copy ' + p.title + ' to next week' }),
              btn('Delete', () => { st.plans = st.plans.filter(x => x.id !== p.id); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + p.title }))))) : h('p', { class: 'small muted' }, 'Nothing planned.')));
      });
      box.append(wk);
      const units = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Units'), ui.unitDraft ? null : btn('New unit', () => { ui.unitDraft = { title: '', start: ui.week, end: L.addDays(ui.week, 25), goal: '', standards: new Set(), err: '' }; render(); const t = $id('un-title'); if (t) t.focus(); }, 'btn-small')));
      if (!st.units.length) units.append(h('p', { class: 'muted' }, 'No units yet. A unit groups lessons over a few weeks and shows on the calendar.'));
      st.units.slice().sort((a, b) => (a.start || '9').localeCompare(b.start || '9')).forEach(u => {
        const s = L.unitStatus(st, u, td), shift = h('input', { type: 'number', id: 'shift-' + u.id, min: -365, max: 365, value: 7, 'aria-label': 'Days to move ' + u.title, class: 'narrow' });
        units.append(h('div', { class: 'unit' }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, u.title), u.start ? h('span', { class: 'chip' }, nice(u.start) + (u.end ? ' to ' + nice(u.end) : '')) : null, h('span', { class: 'chip' }, plural(s.lessons, 'lesson') + ', ' + s.taught + ' done')),
          u.goal ? h('p', { class: 'small' }, u.goal) : null, u.standards.length ? h('div', null, u.standards.map(c => h('span', { class: 'chip std' }, c))) : null,
          h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Move this unit and its lessons by'), shift, h('span', { class: 'small muted' }, 'days'), btn('Move', () => { const n = L.shiftUnit(st, u.id, shift.value); save(); toast('Moved the unit and ' + plural(n, 'lesson') + '.'); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Move ' + u.title }),
            ui.confirm === 'du:' + u.id ? [btn('Yes, delete the unit (lessons stay)', () => { L.removeUnit(st, u.id); ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')] : btn('Delete unit', () => { ui.confirm = 'du:' + u.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + u.title }))));
      });
      box.append(units);
      return box;
    }

    /* ---------- The family register ---------- */
    const MARK_CLASS = { P: 'm-p', H: 'm-h', T: 'm-t', A: 'm-a' };
    function vAttendance() {
      const st = S(), box = h('div'); if (!ui.attDate) ui.attDate = today();
      box.append(h('h1', null, 'Attendance'), h('p', { class: 'muted' }, 'One tap a day. Mark everyone as a school day, then change anyone who had a half day, a field trip or a day off sick.'));
      const need = needLearners(); if (need) { box.append(need); return box; }
      const date = h('input', { type: 'date', id: 'att-date', value: ui.attDate }); date.addEventListener('change', () => { if (L.isoOk(date.value)) { ui.attDate = date.value; render(); } });
      const day = st.attendance[ui.attDate], c = L.dayCounts(st, ui.attDate);
      box.append(h('div', { class: 'row' }, h('label', { for: 'att-date' }, 'Date'), h('div', null, date), btn('Previous day', () => { ui.attDate = L.addDays(ui.attDate, -1); render(); }, 'btn-ghost btn-small'), btn('Today', () => { ui.attDate = today(); render(); }, 'btn-ghost btn-small'), btn('Next day', () => { ui.attDate = L.addDays(ui.attDate, 1); render(); }, 'btn-ghost btn-small')));
      const reg = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, dayName(ui.attDate), ' ', nice(ui.attDate)),
        day ? h('span', { class: 'chip good' }, [c.P ? c.P + ' school day' : '', c.H ? c.H + ' half day' : '', c.T ? c.T + ' field trip' : '', c.A ? c.A + ' absent' : ''].filter(Boolean).join(', ')) : btn('Mark everyone as a school day', () => { L.takeRegister(st, ui.attDate); redo('att-' + st.students[0].id + '-P'); }),
        day ? btn('Clear this day', () => { delete st.attendance[ui.attDate]; redo(); }, 'btn-ghost btn-small') : null));
      if (!day) reg.append(h('p', { class: 'small muted' }, 'Not marked yet. Days you leave unmarked simply do not count.'));
      reg.append(h('ul', { class: 'list' }, st.students.map(s => h('li', null, h('b', null, s.name), h('span', { class: 'seg', role: 'group', 'aria-label': 'Attendance for ' + s.name },
        Object.keys(L.MARKS).map(m => h('button', { type: 'button', id: 'att-' + s.id + '-' + m, class: 'segb ' + MARK_CLASS[m], 'aria-pressed': day && day[s.id] === m ? 'true' : 'false', 'aria-label': s.name + ': ' + L.MARKS[m], title: L.MARKS[m],
          onclick: () => { if (!day) L.takeRegister(st, ui.attDate); L.setMark(st, ui.attDate, s.id, m); redo('att-' + s.id + '-' + m); } }, L.MARKS[m])))))));
      box.append(reg);
      const yr = X.yearRange(), goal = st.goals.days;
      const rows = st.students.map(s => ({ s, a: L.attendanceSummary(st, s.id, yr.from, yr.to) }));
      box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, yr.label), btn('Download attendance (CSV)', () => download('attendance-' + slug(st.classroom.name || 'family') + '.csv', L.attendanceCSV(st, yr.from, yr.to), 'text/csv;charset=utf-8'), 'btn-ghost btn-small', { disabled: !Object.keys(st.attendance).length })),
        h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Learner', 'School days', 'Half days', 'Field trips', 'Absent', goal ? 'Goal ' + goal + ' days' : 'Goal'].map((t, i) => h('th', { class: i ? 'num' : null }, t)))),
          h('tbody', null, rows.map(({ s, a }) => h('tr', null, h('td', null, s.name), h('td', { class: 'num' }, h('b', null, a.school)), [a.H, a.T, a.A].map(v => h('td', { class: 'num' }, v)), h('td', { class: 'num' }, goal ? X.meter(a.school, goal, s.name + ' school days') : h('span', { class: 'muted' }, 'none set'))))))),
        h('p', { class: 'small muted' }, 'A school day counts 1, a half day 0.5 and a field trip 1. Set a days goal on the Home page if your state asks for one; the States page has what five states say.')));
      return box;
    }

    /* ---------- Private notes ---------- */
    function vNotes() {
      const st = S(), box = h('div');
      box.append(tabs([['learners', 'Learners'], ['notes', 'Private notes']], 'notes'), h('h1', null, 'Private notes'), h('div', { class: 'notice' }, h('b', null, 'Only for you. '), 'Notes never appear on progress reports, transcripts, the portfolio or any export. They are in your backup file, so keep that safe.'));
      const need = needLearners(); if (need) { box.append(need); return box; }
      const who = learnerSelect('nt-sid', 'Learner', ui.noteSid || st.students[0].id), date = h('input', { type: 'date', id: 'nt-date', value: today() });
      const kind = h('select', { id: 'nt-kind' }, Object.keys(L.KINDS).map(k => opt(k, L.KINDS[k], 'positive'))), text = area('nt-text', '', 500, 'A milestone, a worry, or something to remember');
      const msg = h('div', { class: 'notice bad', role: 'alert', hidden: true });
      box.append(h('div', { class: 'card' }, h('h2', null, 'Add a note'), msg, h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Learner', who, 'nt-sid')), h('div', { class: 'grow' }, field('Date', date, 'nt-date')), h('div', { class: 'grow' }, field('Kind', kind, 'nt-kind'))),
        field('Note', text, 'nt-text'),
        btn('Save note', () => { try { L.addNote(st, { sid: who.value, date: date.value, kind: kind.value, text: text.value }); ui.noteSid = who.value; save(); toast('Note saved.'); render(); } catch (e) { msg.textContent = e.message; msg.hidden = false; } })));
      const filter = h('select', { id: 'nt-filter', 'aria-label': 'Show notes for' }, opt('', 'Everyone', ui.noteFilter || ''), st.students.map(s => { const c = L.noteCounts(st, s.id); return opt(s.id, s.name + ' (' + (c.positive + c.concern + c.note) + ')', ui.noteFilter || ''); }));
      filter.addEventListener('change', () => { ui.noteFilter = filter.value; render(); });
      const list = L.notesFor(st, ui.noteFilter || ''), name = sid => (st.students.find(s => s.id === sid) || {}).name;
      box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Notes'), h('label', { for: 'nt-filter' }, 'Show'), filter),
        list.length ? h('ul', { class: 'list' }, list.map(n => h('li', null, h('div', { class: 'grow' }, h('b', null, name(n.sid)), ' ', h('span', { class: 'chip k-' + n.kind }, L.KINDS[n.kind]), ' ', h('span', { class: 'muted small' }, nice(n.date)), h('div', null, n.text)),
          ui.confirm === 'dn:' + n.id ? h('span', { class: 'row tight' }, btn('Yes, delete', () => { st.notes = st.notes.filter(x => x.id !== n.id); ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')) : btn('Delete', () => { ui.confirm = 'dn:' + n.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete note from ' + nice(n.date) })))) : h('p', { class: 'muted' }, 'No notes yet.')));
      return box;
    }

    /* ---------- Standards ---------- */
    function vStandards() {
      const st = S(), box = h('div'); box.append(tabs([['grades', 'Scores'], ['standards', 'Skills']], 'standards'), h('h1', null, 'Skills mastery'),
        h('p', { class: 'muted' }, 'Use your curriculum\'s skill codes or make your own. Tag a rubric criterion with a code on the Assignments page ("Criterion | 4 | CODE"); every scored criterion then counts as evidence on a 1 to 4 scale.'));
      const ta = area('std-add', '', 6000, 'READ.1 Finds the main idea\nWRITE.2 Organises ideas into paragraphs\nMATH.3 Adds fractions');
      const editor = h('div', { class: 'card' }, h('h2', null, 'Your skill codes'), field('Add codes, one per line: code, then a short description in your own words', ta, 'std-add'),
        btn('Add', () => { const r = L.parseStandards(ta.value, st.standards); st.standards.push(...r.add); ui.stdMsg = r.rejected; save(); if (r.add.length) toast('Added ' + r.add.length + '.'); render(); }, 'btn-small'),
        (ui.stdMsg || []).length ? h('ul', { class: 'small notice bad' }, ui.stdMsg.map(r => h('li', null, h('b', null, r.raw), ': ', r.why))) : null,
        st.standards.length ? h('ul', { class: 'list cols2' }, st.standards.map((x, i) => h('li', null, h('span', null, h('b', null, x.code), ' ', x.label), btn('Remove', () => { st.standards.splice(i, 1); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Remove ' + x.code })))) : null);
      if (!st.standards.length || !st.students.length) { box.append(empty('Add skill codes and learners, tag rubric criteria, then grade to see mastery here.'), editor); return box; }
      const method = h('select', { id: 'std-method' }, Object.keys(L.METHODS).map(k => opt(k, L.METHODS[k], st.sbg.method)));
      method.addEventListener('change', () => { st.sbg.method = method.value; save(); render(); });
      box.append(h('div', { class: 'row' }, h('label', { for: 'std-method' }, 'Combine evidence by'), h('div', { class: 'grow' }, method), btn('Download skills (CSV)', () => download('skills-' + slug(st.classroom.name || 'family') + '.csv', L.standardsCSV(st), 'text/csv;charset=utf-8'), 'btn-ghost btn-small')),
        h('div', { class: 'tablewrap' }, h('table', { class: 'sbg' }, h('thead', null, h('tr', null, h('th', null, 'Learner'), st.standards.map(x => h('th', { class: 'num', title: x.label }, x.code)))),
          h('tbody', null, st.students.map(s => h('tr', null, h('td', null, h('b', null, s.name)), L.mastery(st, s.id).map(m => h('td', { class: 'num' }, m.score === null ? h('span', { class: 'muted' }, '-') : h('span', { class: 'lv lv' + m.level, title: plural(m.n, 'piece') + ' of evidence' }, (Math.round(m.score * 10) / 10).toFixed(1), h('small', null, m.prof))))))))),
        h('p', { class: 'small muted' }, '4 Exceeds (3.5 and up), 3 Meets (2.5 to 3.4), 2 Approaching (1.5 to 2.4), 1 Beginning. The decaying average weights the newest evidence at 65%, so recent growth counts most.'), editor);
      return box;
    }

    /* ---------- Rubric library ---------- */
    function rubricSheet(title, crit) {
      const lv = crit.some(c => c.levels && c.levels.length === 4);
      return sheet('Rubric: ' + title, schoolLine(), h('table', { class: 'rubric' }, h('thead', null, h('tr', null, h('th', null, 'Criterion'), lv ? ['4', '3', '2', '1'].map(n => h('th', null, 'Level ' + n)) : h('th', null, 'Points'))),
        h('tbody', null, crit.map(c => h('tr', null, h('td', null, h('b', null, c.text), c.std ? h('div', { class: 'small' }, c.std) : null), lv ? (c.levels && c.levels.length === 4 ? c.levels : ['', '', '', '']).map(t => h('td', { class: 'small' }, t)) : h('td', null, 'out of ' + c.max))))));
    }
    function vRubrics() {
      const st = S(), box = h('div'); box.append(tabs([['plan', 'Assignments'], ['rubrics', 'Rubric library']], 'rubrics'), h('h1', null, 'Rubric library'),
        h('p', { class: 'muted' }, 'Six ready-made rubrics with a description for each level, plus any you save from your assignments. Use one to start a new assignment.'));
      L.libraryRubrics(st).forEach(r => {
        box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, r.title), h('span', { class: 'chip' }, r.builtIn ? 'Built in' : 'Yours'), h('span', { class: 'chip' }, r.criteria.length + ' criteria')),
          h('div', { class: 'tablewrap' }, rubricSheet(r.title, r.criteria).querySelector('table')),
          h('div', { class: 'row' }, btn('Use for a new assignment', () => X.useRubric(r), 'btn-small', { 'aria-label': 'Use ' + r.title + ' for a new assignment' }), btn('Print', () => printNodes([rubricSheet(r.title, r.criteria)]), 'btn-ghost btn-small', { 'aria-label': 'Print ' + r.title }),
            r.builtIn ? null : btn('Delete', () => { st.rubrics = st.rubrics.filter(x => x.id !== r.id); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + r.title }))));
      });
      return box;
    }

    return { lessons: vLessons, lessonTabs, attendance: vAttendance, notes: vNotes, standards: vStandards, rubrics: vRubrics, rubricSheet, whoChecks, whoText };
  };
})(typeof window !== 'undefined' ? window : globalThis);
