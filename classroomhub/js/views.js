/* Stark Classroom Hub 1.1: the screens for the teacher tools. Lessons and units, attendance, seating chart and groups,
   private notes, standards, rubric library, differentiation, parent conferences, substitute packets and planning packs.
   app.js passes in its helpers; all logic lives in teachlib.js. Nothing here touches the network. */
(function (root) {
  'use strict';
  const SCH = root.SCH = root.SCH || {};
  SCH.extViews = function (X) {
    const { h, btn, field, L, ui, save, render, toast, download, copy, nice, today, slug, printNodes, tabs } = X;
    const S = () => X.st();
    const $id = id => document.getElementById(id);
    const redo = id => { save(); render(); const el = id && $id(id); if (el) el.focus(); };
    const dayName = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' });
    const opt = (v, text, sel) => h('option', { value: v, selected: v === sel }, text);
    const studentSelect = (id, label, val, extra) => h('select', { id, 'aria-label': label }, extra || null, S().students.map(s => opt(s.id, s.name, val)));
    const area = (id, value, max, ph) => { const t = h('textarea', { id, maxlength: max, placeholder: ph || null }); t.value = value || ''; return t; };
    const empty = msg => h('div', { class: 'card' }, h('p', { class: 'muted' }, msg));
    const needStudents = () => (S().students.length ? null : empty('Add students on the Roster page first.'));
    const codeChecks = (picked, group) => { const st = S().standards; return st.length ? h('div', { class: 'pick small-pick', role: 'group', 'aria-label': group }, st.map(x => h('label', null, h('input', { type: 'checkbox', checked: picked.has(x.code), onchange: e => { e.target.checked ? picked.add(x.code) : picked.delete(x.code); } }), h('span', null, h('b', null, x.code), ' ', x.label)))) : h('p', { class: 'small muted' }, 'Add standard codes on the Grade book > Standards page to tag them here.'); };
    const sheet = (title, sub, body) => h('article', { class: 'report' }, h('div', { class: 'rh' }, h('div', null, h('h1', null, title), sub ? h('small', null, sub) : null)), body, h('div', { class: 'foot' }, 'Prepared with Stark Classroom Hub on ' + nice(today()) + '.'));
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
    const classLine = () => [S().classroom.name, S().classroom.termName, S().classroom.teacher].filter(Boolean).join(' · ');

    /* ---------- Lessons and units ---------- */
    function weekSheet(days) {
      return sheet('Week plan: ' + nice(days[0].date), classLine(), h('table', null, h('thead', null, h('tr', null, h('th', null, 'Day'), h('th', null, 'Lesson'), h('th', null, 'Objective and activities'), h('th', null, 'Materials and homework'))),
        h('tbody', null, days.map(d => (d.plans.length ? d.plans : [null]).map((p, i) => h('tr', null, h('td', null, i ? '' : [h('b', null, dayName(d.date)), h('div', { class: 'small' }, nice(d.date))]),
          p ? [h('td', null, h('b', null, p.title), unitOf(p) ? h('div', { class: 'small' }, unitOf(p)) : null), h('td', null, p.objective ? h('div', null, h('b', null, 'Objective: '), p.objective) : null, p.activities ? h('div', { class: 'pre' }, p.activities) : null), h('td', null, p.materials ? h('div', null, h('b', null, 'Materials: '), p.materials) : null, p.homework ? h('div', null, h('b', null, 'Homework: '), p.homework) : null)]
            : [h('td', { class: 'muted' }, 'No lesson planned'), h('td'), h('td')]))))));
    }
    const unitOf = p => (S().units.find(u => u.id === p.unitId) || {}).title || '';
    function planForm() {
      const d = ui.planDraft, st = S(), picked = d.standards;
      const f = (k, label, type, extra) => { const el = h('input', Object.assign({ type: type || 'text', id: 'pl-' + k, value: d[k] }, extra || {})); el.addEventListener('input', () => { d[k] = el.value; }); return field(label, el, 'pl-' + k); };
      const ta = (k, label, max) => { const el = area('pl-' + k, d[k], max); el.addEventListener('input', () => { d[k] = el.value; }); return field(label, el, 'pl-' + k); };
      const unit = h('select', { id: 'pl-unit' }, opt('', 'No unit', d.unitId), st.units.map(u => opt(u.id, u.title, d.unitId))); unit.addEventListener('change', () => { d.unitId = unit.value; });
      return h('div', { class: 'card', id: 'planbox' }, h('h2', null, d.id ? 'Edit lesson' : 'New lesson'), d.err ? h('div', { class: 'notice bad', role: 'alert' }, d.err) : null,
        h('div', { class: 'row' }, h('div', { class: 'grow' }, f('date', 'Date', 'date')), h('div', { class: 'grow' }, field('Unit', unit, 'pl-unit')), h('div', { class: 'grow' }, f('title', 'Lesson title', 'text', { maxlength: 120 }))),
        f('objective', 'Learning objective (students will be able to...)', 'text', { maxlength: 300 }), ta('activities', 'Activities (opening, main task, closing)', 2000),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, f('materials', 'Materials', 'text', { maxlength: 600 })), h('div', { class: 'grow' }, f('homework', 'Homework', 'text', { maxlength: 300 }))),
        h('h3', null, 'Standards this lesson covers'), codeChecks(picked, 'Standards for this lesson'),
        h('div', { class: 'row' }, btn('Save lesson', () => { try { L.addPlan(st, Object.assign({}, d, { standards: [...picked] })); ui.planDraft = null; ui.week = L.weekStart(d.date); save(); toast('Lesson saved.'); } catch (e) { d.err = e.message; } render(); }), btn('Cancel', () => { ui.planDraft = null; render(); }, 'btn-ghost')));
    }
    function unitForm() {
      const d = ui.unitDraft, st = S();
      const f = (k, label, type, extra) => { const el = h('input', Object.assign({ type: type || 'text', id: 'un-' + k, value: d[k] }, extra || {})); el.addEventListener('input', () => { d[k] = el.value; }); return field(label, el, 'un-' + k); };
      const goal = area('un-goal', d.goal, 600, 'What students will understand by the end'); goal.addEventListener('input', () => { d.goal = goal.value; });
      return h('div', { class: 'card', id: 'unitbox' }, h('h2', null, 'New unit'), d.err ? h('div', { class: 'notice bad', role: 'alert' }, d.err) : null,
        h('div', { class: 'row' }, h('div', { class: 'grow' }, f('title', 'Unit title', 'text', { maxlength: 120 })), h('div', { class: 'grow' }, f('start', 'Starts', 'date')), h('div', { class: 'grow' }, f('end', 'Ends', 'date'))),
        field('Big goal', goal, 'un-goal'), h('h3', null, 'Standards in this unit'), codeChecks(d.standards, 'Standards for this unit'),
        h('div', { class: 'row' }, btn('Save unit', () => { try { L.addUnit(st, Object.assign({}, d, { standards: [...d.standards] })); ui.unitDraft = null; save(); toast('Unit saved.'); } catch (e) { d.err = e.message; } render(); }), btn('Cancel', () => { ui.unitDraft = null; render(); }, 'btn-ghost')));
    }
    function vLessons() {
      const st = S(), td = today(), box = h('div');
      if (!ui.week) ui.week = L.weekStart(td);
      const days = L.weekPlans(st, ui.week);
      box.append(h('h1', null, 'Lessons and units'), h('p', { class: 'muted' }, 'Plan units, then the lessons inside them. Lessons appear on the calendar and in the substitute packet.'));
      if (ui.unitDraft) box.append(unitForm());
      if (ui.planDraft) box.append(planForm());
      const wk = h('div', { class: 'card' }, h('div', { class: 'row' }, btn('Previous week', () => { ui.week = L.addDays(ui.week, -7); render(); }, 'btn-ghost btn-small'), h('h2', { class: 'grow', id: 'week-title' }, 'Week of ' + nice(ui.week)),
        btn('This week', () => { ui.week = L.weekStart(td); render(); }, 'btn-ghost btn-small'), btn('Next week', () => { ui.week = L.addDays(ui.week, 7); render(); }, 'btn-ghost btn-small'), btn('Print week', () => printNodes([weekSheet(days)]), 'btn-small')));
      days.forEach(d => {
        wk.append(h('div', { class: 'day' + (d.date === td ? ' is-today' : '') }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, dayName(d.date), ' ', h('span', { class: 'muted small' }, nice(d.date))), btn('Add a lesson', () => { ui.planDraft = { id: '', date: d.date, unitId: (st.units.find(u => u.start && u.start <= d.date && (!u.end || u.end >= d.date)) || {}).id || '', title: '', objective: '', activities: '', materials: '', homework: '', standards: new Set(), err: '' }; render(); const t = $id('pl-title'); if (t) t.focus(); }, 'btn-ghost btn-small', { 'aria-label': 'Add a lesson on ' + dayName(d.date) })),
          d.plans.length ? h('ul', { class: 'list' }, d.plans.map(p => h('li', null, h('div', { class: 'grow' }, h('b', null, p.title), unitOf(p) ? h('span', { class: 'chip' }, unitOf(p)) : null, p.standards.map(c => h('span', { class: 'chip std' }, c)), p.objective ? h('div', { class: 'small muted' }, p.objective) : null),
            h('span', { class: 'row tight' }, btn('Edit', () => { ui.planDraft = Object.assign({}, p, { standards: new Set(p.standards), err: '' }); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Edit ' + p.title }),
              btn('Copy to next week', () => { L.copyPlan(st, p.id, L.addDays(p.date, 7)); save(); toast('Copied to ' + nice(L.addDays(p.date, 7)) + '.'); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Copy ' + p.title + ' to next week' }),
              btn('Delete', () => { st.plans = st.plans.filter(x => x.id !== p.id); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + p.title }))))) : h('p', { class: 'small muted' }, 'Nothing planned.')));
      });
      box.append(wk);
      const units = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Units'), ui.unitDraft ? null : btn('New unit', () => { ui.unitDraft = { title: '', start: ui.week, end: L.addDays(ui.week, 25), goal: '', standards: new Set(), err: '' }; render(); const t = $id('un-title'); if (t) t.focus(); }, 'btn-small')));
      if (!st.units.length) units.append(h('p', { class: 'muted' }, 'No units yet. A unit groups lessons over a few weeks and shows on the calendar.'));
      st.units.slice().sort((a, b) => (a.start || '9').localeCompare(b.start || '9')).forEach(u => {
        const s = L.unitStatus(st, u, td), shift = h('input', { type: 'number', id: 'shift-' + u.id, min: -365, max: 365, value: 7, 'aria-label': 'Days to move ' + u.title, class: 'narrow' });
        units.append(h('div', { class: 'unit' }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, u.title), u.start ? h('span', { class: 'chip' }, nice(u.start) + (u.end ? ' to ' + nice(u.end) : '')) : null, h('span', { class: 'chip' }, plural(s.lessons, 'lesson') + ', ' + s.taught + ' taught')),
          u.goal ? h('p', { class: 'small' }, u.goal) : null, u.standards.length ? h('div', null, u.standards.map(c => h('span', { class: 'chip std' }, c))) : null,
          h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Move this unit and its lessons by'), shift, h('span', { class: 'small muted' }, 'days'), btn('Move', () => { const n = L.shiftUnit(st, u.id, shift.value); save(); toast('Moved the unit and ' + n + ' lessons.'); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Move ' + u.title }),
            ui.confirm === 'du:' + u.id ? [btn('Yes, delete the unit (lessons stay)', () => { L.removeUnit(st, u.id); ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')] : btn('Delete unit', () => { ui.confirm = 'du:' + u.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + u.title }))));
      });
      box.append(units);
      return box;
    }

    /* ---------- Attendance ---------- */
    const MARK_CLASS = { P: 'm-p', L: 'm-l', A: 'm-a', E: 'm-e' };
    function vAttendance() {
      const st = S(), box = h('div'); if (!ui.attDate) ui.attDate = today();
      box.append(h('h1', null, 'Attendance'));
      const need = needStudents(); if (need) { box.append(need); return box; }
      const date = h('input', { type: 'date', id: 'att-date', value: ui.attDate }); date.addEventListener('change', () => { if (L.isoOk(date.value)) { ui.attDate = date.value; render(); } });
      const day = st.attendance[ui.attDate], c = L.dayCounts(st, ui.attDate);
      box.append(h('div', { class: 'row' }, h('label', { for: 'att-date' }, 'Date'), h('div', null, date), btn('Previous day', () => { ui.attDate = L.addDays(ui.attDate, -1); render(); }, 'btn-ghost btn-small'), btn('Today', () => { ui.attDate = today(); render(); }, 'btn-ghost btn-small'), btn('Next day', () => { ui.attDate = L.addDays(ui.attDate, 1); render(); }, 'btn-ghost btn-small')));
      const reg = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Register: ', dayName(ui.attDate), ' ', nice(ui.attDate)),
        day ? h('span', { class: 'chip good' }, c.P + ' present, ' + c.L + ' late, ' + c.A + ' absent, ' + c.E + ' excused') : btn('Mark everyone present', () => { L.takeRegister(st, ui.attDate); redo('att-' + st.students[0].id + '-P'); }),
        day ? btn('Clear this day', () => { delete st.attendance[ui.attDate]; redo(); }, 'btn-ghost btn-small') : null));
      if (!day) reg.append(h('p', { class: 'small muted' }, 'Not taken yet. Mark everyone present, then change the few who are not, or mark each student below.'));
      reg.append(h('ul', { class: 'list' }, st.students.map(s => h('li', null, h('b', null, s.name), h('span', { class: 'seg', role: 'group', 'aria-label': 'Attendance for ' + s.name },
        Object.keys(L.MARKS).map(m => h('button', { type: 'button', id: 'att-' + s.id + '-' + m, class: 'segb ' + MARK_CLASS[m], 'aria-pressed': day && day[s.id] === m ? 'true' : 'false', 'aria-label': s.name + ': ' + L.MARKS[m], title: L.MARKS[m],
          onclick: () => { if (!day) L.takeRegister(st, ui.attDate); L.setMark(st, ui.attDate, s.id, m); redo('att-' + s.id + '-' + m); } }, L.MARKS[m])))))));
      box.append(reg);
      const rows = st.students.map(s => ({ s, a: L.attendanceSummary(st, s.id) }));
      box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Summary'), btn('Download attendance (CSV)', () => download('attendance-' + slug(st.classroom.name) + '.csv', L.attendanceCSV(st), 'text/csv;charset=utf-8'), 'btn-ghost btn-small', { disabled: !Object.keys(st.attendance).length })),
        h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Student', 'Days', 'Present', 'Late', 'Absent', 'Excused', 'Attendance'].map((t, i) => h('th', { class: i ? 'num' : null }, t)))),
          h('tbody', null, rows.map(({ s, a }) => h('tr', null, h('td', null, s.name, a.concern ? h('span', { class: 'chip bad' }, 'below 90%') : null), [a.days, a.P, a.L, a.A, a.E].map(v => h('td', { class: 'num' }, v)), h('td', { class: 'num' }, a.rate === null ? '-' : a.rate + '%')))))),
        h('p', { class: 'small muted' }, 'Late counts as attended: attendance = (present + late) / days recorded. A flag shows when a student is below 90% after 10 or more recorded days. The register is a classroom record, not a legal register.')));
      return box;
    }

    /* ---------- Seating chart ---------- */
    function seatTable(grid, clash) {
      return h('div', { class: 'seatwrap' }, h('div', { class: 'front' }, 'Front of the room'), h('div', { class: 'seats', style: null, 'data-cols': grid[0].length }, grid.map(row => row.map(x => {
        const on = ui.seatPick === x.key;
        return h('button', { type: 'button', class: 'seat' + (x.sid ? ' taken' : '') + (clash.has(x.sid) ? ' clash' : ''), 'aria-pressed': on ? 'true' : 'false', 'aria-label': 'Seat row ' + (x.r + 1) + ', column ' + (x.c + 1) + ': ' + (x.name || 'empty'), onclick: () => { ui.seatPick = on ? '' : x.key; render(); } }, x.name || h('span', { class: 'muted' }, '+'));
      }))));
    }
    function chartSheet() {
      const grid = L.seatGrid(S());
      return sheet('Seating chart', classLine(), [h('p', { class: 'small' }, 'Front of the room'), h('table', { class: 'seatprint' }, h('tbody', null, grid.map(row => h('tr', null, row.map(x => h('td', null, x.name || ''))))))]);
    }
    function applySeatCols(box) { const g = box.querySelector('.seats'); if (g) g.style.gridTemplateColumns = 'repeat(' + g.dataset.cols + ', minmax(4.6rem, 1fr))'; }
    function vSeating() {
      const st = S(), box = h('div'); box.append(tabs([['seating', 'Seating chart'], ['groups', 'Groups']], 'seating'), h('h1', null, 'Seating chart'));
      const need = needStudents(); if (need) { box.append(need); return box; }
      const rows = h('input', { type: 'number', id: 'seat-rows', min: 1, max: 10, value: st.seating.rows, class: 'narrow' }), cols = h('input', { type: 'number', id: 'seat-cols', min: 1, max: 12, value: st.seating.cols, class: 'narrow' });
      const resize = () => { L.resizeSeating(st, rows.value, cols.value); save(); render(); };
      rows.addEventListener('change', resize); cols.addEventListener('change', resize);
      const auto = mode => () => { const r = L.autoSeat(st, mode, String(Date.now())); save(); toast('Seated ' + r.seated + (r.unseated.length ? '; no seat for ' + r.unseated.join(', ') : '') + (r.conflicts ? '; ' + r.conflicts + ' keep-apart pair(s) still next to each other' : '') + '.'); render(); };
      box.append(h('div', { class: 'row' }, h('label', { for: 'seat-rows' }, 'Rows'), rows, h('label', { for: 'seat-cols' }, 'Columns'), cols,
        btn('Seat randomly', auto('random'), 'btn-small'), btn('Seat alphabetically', auto('alpha'), 'btn-ghost btn-small'), btn('Seat by groups', auto('groups'), 'btn-ghost btn-small', { disabled: !st.groupSets.length }),
        btn('Clear seats', () => { st.seating.seats = {}; save(); render(); }, 'btn-ghost btn-small'), btn('Print chart', () => printNodes([chartSheet()]), 'btn-ghost btn-small')));
      const bad = L.seatConflicts(st), clash = new Set([].concat.apply([], bad)), name = sid => (st.students.find(s => s.id === sid) || {}).name;
      if (bad.length) box.append(h('div', { class: 'notice bad', role: 'alert' }, 'Sitting next to each other but marked keep apart: ', bad.map(p => name(p[0]) + ' and ' + name(p[1])).join('; '), '.'));
      const card = h('div', { class: 'card' }, seatTable(L.seatGrid(st), clash));
      if (ui.seatPick) {
        const k = ui.seatPick.split('-').map(Number), cur = st.seating.seats[ui.seatPick] || '', seated = new Set(Object.values(st.seating.seats));
        const sel = h('select', { id: 'seat-who' }, opt('', 'Empty seat', cur), st.students.map(s => opt(s.id, s.name + (seated.has(s.id) && s.id !== cur ? ' (moves from another seat)' : ''), cur)));
        card.append(h('div', { class: 'row', id: 'seatpick' }, h('label', { for: 'seat-who' }, 'Row ' + (k[0] + 1) + ', column ' + (k[1] + 1)), sel, btn('Put here', () => { L.assignSeat(st, ui.seatPick, sel.value); ui.seatPick = ''; save(); render(); }, 'btn-small'), btn('Cancel', () => { ui.seatPick = ''; render(); }, 'btn-ghost btn-small')));
      }
      const left = L.unseated(st);
      card.append(h('p', { class: 'small muted' }, left.length ? 'Not seated yet: ' + left.map(s => s.name).join(', ') + '. Pick a seat to place someone.' : 'Everyone has a seat. Pick a seat to change it.'));
      box.append(card);
      const a = studentSelect('apart-a', 'First student'), b = studentSelect('apart-b', 'Second student'); if (st.students[1]) b.value = st.students[1].id;
      box.append(h('div', { class: 'card' }, h('h2', null, 'Keep apart'), h('p', { class: 'small muted' }, 'Random seating and new groups try to keep these pairs apart. Private to you.'),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, a), h('div', { class: 'grow' }, b), btn('Add pair', () => { if (L.addApart(st, a.value, b.value)) { save(); render(); } else toast('Pick two different students who are not already a pair.'); }, 'btn-small')),
        st.seating.apart.length ? h('ul', { class: 'list' }, st.seating.apart.map((p, i) => h('li', null, h('span', null, name(p[0]) + ' and ' + name(p[1])), btn('Remove', () => { st.seating.apart.splice(i, 1); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Remove pair ' + name(p[0]) + ' and ' + name(p[1]) })))) : null));
      applySeatCols(box);
      return box;
    }

    /* ---------- Groups ---------- */
    function groupsSheet(set) { const name = sid => (S().students.find(s => s.id === sid) || {}).name || ''; return sheet('Groups: ' + set.name, classLine(), h('div', { class: 'gprint' }, set.groups.map(g => h('div', null, h('h3', null, g.name), h('ul', null, g.sids.map(sid => h('li', null, name(sid)))))))); }
    function groupCards(groups) { const name = sid => (S().students.find(s => s.id === sid) || {}).name || ''; return h('div', { class: 'grid groups' }, groups.map(g => h('div', { class: 'card gcard' }, h('h3', null, g.name), h('ul', null, g.sids.map(sid => h('li', null, name(sid))))))); }
    function vGroups() {
      const st = S(), box = h('div'); box.append(tabs([['seating', 'Seating chart'], ['groups', 'Groups']], 'groups'), h('h1', null, 'Groups'));
      const need = needStudents(); if (need) { box.append(need); return box; }
      const o = ui.groupOpts = ui.groupOpts || { method: 'mixed', size: 4, basis: 'overall', present: false };
      const method = h('select', { id: 'gr-method' }, [['mixed', 'Mixed levels (a spread in each group)'], ['similar', 'Similar levels (for targeted teaching)'], ['random', 'Random']].map(m => opt(m[0], m[1], o.method)));
      const size = h('input', { type: 'number', id: 'gr-size', min: 2, max: 10, value: o.size });
      const basis = h('select', { id: 'gr-basis' }, opt('overall', 'Overall grade', o.basis), st.standards.map(x => opt('std:' + x.code, 'Standard ' + x.code, o.basis)));
      const present = h('input', { type: 'checkbox', id: 'gr-present', checked: o.present, disabled: !st.attendance[today()] });
      const sync = () => { o.method = method.value; o.size = +size.value || 4; o.basis = basis.value; o.present = present.checked; };
      [method, size, basis, present].forEach(el => el.addEventListener('change', sync));
      const make = () => { sync(); ui.groupPreview = L.makeGroups(st, { method: o.method, size: o.size, basis: o.basis, seed: String(Date.now()), presentOn: o.present ? today() : '' }); render(); };
      box.append(h('div', { class: 'card' }, h('h2', null, 'Make groups'), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('How', method, 'gr-method')), h('div', null, field('Students per group', size, 'gr-size')), h('div', { class: 'grow' }, field('Levels from', basis, 'gr-basis'))),
        h('label', null, present, ' Only students marked present or late today', st.attendance[today()] ? null : h('span', { class: 'muted small' }, ' (take the register first)')),
        h('div', { class: 'row' }, btn(ui.groupPreview ? 'Make them again' : 'Make groups', make)),
        h('p', { class: 'small muted' }, 'Mixed and similar use each student\'s overall grade or one standard. Students with no grades yet go last. Keep-apart pairs from the seating chart are kept apart where possible.')));
      const pv = ui.groupPreview;
      if (pv) {
        const nm = h('input', { type: 'text', id: 'gr-name', maxlength: 60, value: (pv.method === 'similar' ? 'Skill groups ' : 'Groups ') + nice(today()) });
        box.append(h('div', { class: 'card', id: 'grpreview' }, h('h2', null, 'Preview'), pv.clashes ? h('div', { class: 'notice bad' }, pv.clashes + ' keep-apart pair(s) could not be separated.') : null, pv.left ? h('p', { class: 'small muted' }, pv.left + ' student(s) not present were left out.') : null,
          groupCards(pv.groups), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Name this set', nm, 'gr-name')), btn('Save this set', () => { L.saveGroupSet(st, nm.value, today(), pv); ui.groupPreview = null; save(); toast('Groups saved.'); render(); }), btn('Discard', () => { ui.groupPreview = null; render(); }, 'btn-ghost'))));
      }
      box.append(h('h2', null, 'Saved group sets'));
      if (!st.groupSets.length) box.append(empty('No saved groups yet.'));
      st.groupSets.slice().reverse().forEach(g => box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, g.name), g.made ? h('span', { class: 'chip' }, nice(g.made)) : null, h('span', { class: 'chip' }, g.method + (g.basis ? ', ' + g.basis.replace('std:', '') : '')),
        btn('Print', () => printNodes([groupsSheet(g)]), 'btn-ghost btn-small', { 'aria-label': 'Print ' + g.name }), btn('Delete', () => { st.groupSets = st.groupSets.filter(x => x.id !== g.id); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + g.name })), groupCards(g.groups))));
      return box;
    }

    /* ---------- Private notes ---------- */
    function vNotes() {
      const st = S(), box = h('div');
      box.append(h('h1', null, 'Private notes'), h('div', { class: 'notice' }, h('b', null, 'Only for you. '), 'Notes never appear on progress reports, parent summaries, the grade book export or planning packs. A note appears on a conference report or a substitute packet only if you tick its box here and also choose to include notes when you make that report.'));
      const need = needStudents(); if (need) { box.append(need); return box; }
      const who = studentSelect('nt-sid', 'Student', ui.noteSid || st.students[0].id), date = h('input', { type: 'date', id: 'nt-date', value: today() });
      const kind = h('select', { id: 'nt-kind' }, Object.keys(L.KINDS).map(k => opt(k, L.KINDS[k], 'positive'))), text = area('nt-text', '', 500, 'What happened, briefly and factually');
      const sp = h('input', { type: 'checkbox', id: 'nt-parent' }), ss = h('input', { type: 'checkbox', id: 'nt-sub' }), msg = h('div', { class: 'notice bad', role: 'alert', hidden: true });
      box.append(h('div', { class: 'card' }, h('h2', null, 'Add a note'), msg, h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Student', who, 'nt-sid')), h('div', { class: 'grow' }, field('Date', date, 'nt-date')), h('div', { class: 'grow' }, field('Kind', kind, 'nt-kind'))),
        field('Note', text, 'nt-text'), h('label', null, sp, ' May be shared with the family on a conference report'), h('label', null, ss, ' Useful for a substitute teacher'),
        btn('Save note', () => { try { L.addNote(st, { sid: who.value, date: date.value, kind: kind.value, text: text.value, share: { parent: sp.checked, sub: ss.checked } }); ui.noteSid = who.value; save(); toast('Note saved.'); render(); } catch (e) { msg.textContent = e.message; msg.hidden = false; } })));
      const filter = h('select', { id: 'nt-filter', 'aria-label': 'Show notes for' }, opt('', 'All students', ui.noteFilter || ''), st.students.map(s => { const c = L.noteCounts(st, s.id); return opt(s.id, s.name + ' (' + (c.positive + c.concern + c.note) + ')', ui.noteFilter || ''); }));
      filter.addEventListener('change', () => { ui.noteFilter = filter.value; render(); });
      const list = L.notesFor(st, ui.noteFilter || ''), name = sid => (st.students.find(s => s.id === sid) || {}).name;
      box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Notes'), h('label', { for: 'nt-filter' }, 'Show'), filter),
        list.length ? h('ul', { class: 'list' }, list.map(n => h('li', null, h('div', { class: 'grow' }, h('b', null, name(n.sid)), ' ', h('span', { class: 'chip k-' + n.kind }, L.KINDS[n.kind]), ' ', h('span', { class: 'muted small' }, nice(n.date)), n.share.parent ? h('span', { class: 'chip' }, 'family') : null, n.share.sub ? h('span', { class: 'chip' }, 'substitute') : null, h('div', null, n.text)),
          ui.confirm === 'dn:' + n.id ? h('span', { class: 'row tight' }, btn('Yes, delete', () => { st.notes = st.notes.filter(x => x.id !== n.id); ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')) : btn('Delete', () => { ui.confirm = 'dn:' + n.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete note from ' + nice(n.date) })))) : h('p', { class: 'muted' }, 'No notes yet.')));
      return box;
    }

    /* ---------- Standards ---------- */
    function vStandards() {
      const st = S(), box = h('div'); box.append(tabs([['grades', 'Scores'], ['standards', 'Standards']], 'standards'), h('h1', null, 'Standards-based grading'),
        h('p', { class: 'muted' }, 'Use your school\'s skill codes or your own. Tag a rubric criterion with a code on the Assignments page ("Criterion | 4 | CODE"); every scored criterion then counts as evidence on a 1 to 4 scale.'));
      const ta = area('std-add', '', 6000, 'READ.1 Finds the main idea\nWRITE.2 Organises ideas into paragraphs\nMATH.3 Adds fractions');
      const editor = h('div', { class: 'card' }, h('h2', null, 'Your standards'), field('Add codes, one per line: code, then a short description in your own words', ta, 'std-add'),
        btn('Add', () => { const r = L.parseStandards(ta.value, st.standards); st.standards.push(...r.add); ui.stdMsg = r.rejected; save(); if (r.add.length) toast('Added ' + r.add.length + '.'); render(); }, 'btn-small'),
        (ui.stdMsg || []).length ? h('ul', { class: 'small notice bad' }, ui.stdMsg.map(r => h('li', null, h('b', null, r.raw), ': ', r.why))) : null,
        st.standards.length ? h('ul', { class: 'list cols2' }, st.standards.map((x, i) => h('li', null, h('span', null, h('b', null, x.code), ' ', x.label), btn('Remove', () => { st.standards.splice(i, 1); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Remove ' + x.code })))) : null);
      if (!st.standards.length || !st.students.length) { box.append(empty('Add standards and students, tag rubric criteria, then grade to see mastery here.'), editor); return box; }
      const method = h('select', { id: 'std-method' }, Object.keys(L.METHODS).map(k => opt(k, L.METHODS[k], st.sbg.method)));
      method.addEventListener('change', () => { st.sbg.method = method.value; save(); render(); });
      const sum = L.standardsSummary(st);
      box.append(h('div', { class: 'row' }, h('label', { for: 'std-method' }, 'Combine evidence by'), h('div', { class: 'grow' }, method), btn('Download standards (CSV)', () => download('standards-' + slug(st.classroom.name) + '.csv', L.standardsCSV(st), 'text/csv;charset=utf-8'), 'btn-ghost btn-small')),
        h('div', { class: 'tablewrap' }, h('table', { class: 'sbg' }, h('thead', null, h('tr', null, h('th', null, 'Student'), st.standards.map(x => h('th', { class: 'num', title: x.label }, x.code)))),
          h('tbody', null, st.students.map(s => h('tr', null, h('td', null, h('b', null, s.name)), L.mastery(st, s.id).map(m => h('td', { class: 'num' }, m.score === null ? h('span', { class: 'muted' }, '-') : h('span', { class: 'lv lv' + m.level, title: m.n + ' piece(s) of evidence' }, (Math.round(m.score * 10) / 10).toFixed(1), h('small', null, m.prof))))))),
          h('tfoot', null, h('tr', null, h('th', null, 'Meets or above'), sum.map(x => { const n = x.counts[4] + x.counts[3], all = st.students.length - x.counts[0]; return h('th', { class: 'num' }, all ? n + ' of ' + all : '-'); }))))),
        h('p', { class: 'small muted' }, '4 Exceeds (3.5 and up), 3 Meets (2.5 to 3.4), 2 Approaching (1.5 to 2.4), 1 Beginning. The decaying average weights the newest evidence at 65%, so recent growth counts most.'), editor);
      return box;
    }

    /* ---------- Rubric library ---------- */
    function rubricSheet(title, crit) {
      const lv = crit.some(c => c.levels && c.levels.length === 4);
      return sheet('Rubric: ' + title, classLine(), h('table', { class: 'rubric' }, h('thead', null, h('tr', null, h('th', null, 'Criterion'), lv ? ['4', '3', '2', '1'].map(n => h('th', null, 'Level ' + n)) : h('th', null, 'Points'))),
        h('tbody', null, crit.map(c => h('tr', null, h('td', null, h('b', null, c.text), c.std ? h('div', { class: 'small' }, c.std) : null), lv ? (c.levels && c.levels.length === 4 ? c.levels : ['', '', '', '']).map(t => h('td', { class: 'small' }, t)) : h('td', null, 'out of ' + c.max))))));
    }
    function vRubrics() {
      const st = S(), box = h('div'); box.append(tabs([['plan', 'Assignments'], ['rubrics', 'Rubric library']], 'rubrics'), h('h1', null, 'Rubric library'),
        h('p', { class: 'muted' }, 'Six ready-made rubrics with a description for each level, plus any you save from your assignments ("Save rubric to library"). Use one to start a new assignment.'));
      L.libraryRubrics(st).forEach(r => {
        box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, r.title), h('span', { class: 'chip' }, r.builtIn ? 'Built in' : 'Yours'), h('span', { class: 'chip' }, r.criteria.length + ' criteria')),
          h('div', { class: 'tablewrap' }, rubricSheet(r.title, r.criteria).querySelector('table')),
          h('div', { class: 'row' }, btn('Use for a new assignment', () => X.useRubric(r), 'btn-small', { 'aria-label': 'Use ' + r.title + ' for a new assignment' }), btn('Print', () => printNodes([rubricSheet(r.title, r.criteria)]), 'btn-ghost btn-small', { 'aria-label': 'Print ' + r.title }),
            r.builtIn ? null : btn('Delete', () => { st.rubrics = st.rubrics.filter(x => x.id !== r.id); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + r.title }))));
      });
      return box;
    }

    /* ---------- Differentiation (a panel under an assignment) ---------- */
    function taskCard(t) {
      return h('article', { class: 'report task' }, h('div', { class: 'rh' }, h('div', null, h('h1', null, t.title), h('small', null, t.name + (S().classroom.name ? ' · ' + S().classroom.name : ''))), h('div', { class: 'right' }, h('div', { class: 'big' }, t.tierName), t.due ? h('div', null, 'Due ' + nice(t.due)) : null)),
        t.prompt ? h('p', null, t.prompt) : null, t.instructions ? h('p', null, h('b', null, 'Your task: '), t.instructions) : null,
        t.criteria.length ? [h('h3', null, 'You will be marked on'), h('ul', null, t.criteria.map(c => h('li', null, c)))] : null);
    }
    function diffPanel(a) {
      const st = S(), tiers = a.tiers = a.tiers || { support: '', core: '', extend: '' };
      const ti = k => { const t = area('tier-' + k, tiers[k], 600, k === 'core' ? 'The main task (most students)' : k === 'support' ? 'For example: use the sentence starters and the word bank' : 'For example: add a second viewpoint'); t.addEventListener('input', () => { tiers[k] = L.clip(t.value, 600); save(); }); return h('div', { class: 'grow' }, field(L.TIERS[k] + ' instructions', t, 'tier-' + k)); };
      return h('div', { class: 'card diff', id: 'diffpanel' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Differentiate: ', a.title), btn('Set tiers from current grades', () => { const c = L.tiersFromGrades(st, a.id); save(); toast(c.support + ' support, ' + c.core + ' core, ' + c.extend + ' extend' + (c.kept ? ', ' + c.kept + ' not graded yet kept their tier' : '') + '.'); render(); }, 'btn-ghost btn-small'),
        btn('Print task cards', () => printNodes(st.students.map(s => taskCard(L.studentTask(st, a.id, s.id)))), 'btn-small'), btn('Close', () => { ui.diff = ''; render(); }, 'btn-ghost btn-small')),
        h('div', { class: 'row' }, ['support', 'core', 'extend'].map(ti)),
        st.students.length ? h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Student'), h('th', null, 'Tier'), h('th', null, 'Extra days'), h('th', null, 'Support note (only you)'), h('th', null, 'Due'))),
          h('tbody', null, st.students.map(s => {
            const x = L.accomOf(a, s.id), tier = h('select', { 'aria-label': 'Tier for ' + s.name }, Object.keys(L.TIERS).map(k => opt(k, L.TIERS[k], x.tier)));
            const days = h('input', { type: 'number', min: 0, max: 60, value: x.extraDays, class: 'narrow', 'aria-label': 'Extra days for ' + s.name }), note = h('input', { type: 'text', maxlength: 200, value: x.note, 'aria-label': 'Support note for ' + s.name });
            const due = h('td', null, L.studentDue(a, s.id) ? nice(L.studentDue(a, s.id)) : '-');
            const upd = () => { L.setAccom(st, a.id, s.id, { tier: tier.value, extraDays: days.value, note: note.value }); save(); due.textContent = L.studentDue(a, s.id) ? nice(L.studentDue(a, s.id)) : '-'; };
            [tier, days, note].forEach(el => el.addEventListener('change', upd));
            return h('tr', null, h('td', null, s.name), h('td', null, tier), h('td', null, days), h('td', null, note), due);
          })))) : h('p', { class: 'muted' }, 'Add students to set tiers.'),
        h('p', { class: 'small muted' }, 'Task cards show each student their tier\'s instructions and their own due date. Support notes stay with you; a substitute packet includes them only if you choose.'));
    }

    /* ---------- Parent conference ---------- */
    function confSheet(c) {
      return h('article', { class: 'report' }, h('div', { class: 'rh' }, h('div', null, h('h1', null, 'Parent conference: ', c.name), h('small', null, [c.classroom, c.term, c.teacher, c.date ? nice(c.date) : ''].filter(Boolean).join(' · '))),
        h('div', { class: 'right' }, c.final.pct === null ? h('div', { class: 'muted' }, 'Not graded yet') : [h('div', { class: 'big' }, Math.round(c.final.pct) + '%'), h('div', { class: 'band-' + c.final.band }, c.final.band)])),
        h('div', { class: 'cols' }, h('div', null, h('h3', null, 'Attendance'), c.attendance.days ? h('p', null, c.attendance.rate + '% of ' + c.attendance.days + ' days recorded', h('br'), c.attendance.A + ' absent, ' + c.attendance.L + ' late, ' + c.attendance.E + ' excused') : h('p', { class: 'muted' }, 'No register taken yet.')),
          h('div', null, h('h3', null, 'Work'), c.missing.length ? h('p', null, 'Still to hand in: ' + c.missing.join('; ') + '.') : h('p', null, 'Nothing overdue.'))),
        c.standards.length ? [h('h3', null, 'Skills (1 to 4)'), h('table', null, h('tbody', null, c.standards.map(m => h('tr', null, h('td', null, h('b', null, m.code), ' ', m.label), h('td', null, m.prof + ' (' + (Math.round(m.score * 10) / 10).toFixed(1) + ')')))))] : null,
        c.rows.some(x => x.pct !== null) ? [h('h3', null, 'Marked work'), h('table', null, h('tbody', null, c.rows.filter(x => x.pct !== null).map(x => h('tr', null, h('td', null, x.title), h('td', null, Math.round(x.pct) + '% ', h('span', { class: 'band-' + x.band }, x.band)), h('td', null, x.comment)))))] : null,
        c.strengths.length ? h('p', null, h('b', null, 'Going well: '), c.strengths.join('; ')) : null, c.next.length ? h('p', null, h('b', null, 'Next steps: '), c.next.join('; ')) : null,
        c.notes.length ? [h('h3', null, 'Notes shared with the family'), h('ul', null, c.notes.map(n => h('li', null, nice(n.date) + ' (' + n.kind + '): ' + n.text)))] : null,
        c.points ? [h('h3', null, 'Talking points'), h('p', { class: 'pre' }, c.points)] : null, c.goals ? [h('h3', null, 'Goals we agreed'), h('p', { class: 'pre' }, c.goals)] : h('div', { class: 'lines' }, h('h3', null, 'Goals we agreed'), h('div'), h('div'), h('div')),
        h('div', { class: 'foot' }, 'Prepared with Stark Classroom Hub on ' + nice(today()) + '. It stays on the teacher\'s computer unless it is shared with you.'));
    }
    const repTabs = k => tabs([['reports', 'Progress'], ['conference', 'Conference'], ['sub', 'Substitute packet']], k);
    function vConference() {
      const st = S(), box = h('div'); box.append(repTabs('conference'), h('h1', null, 'Parent conference'));
      const need = needStudents(); if (need) { box.append(need); return box; }
      if (!st.students.some(s => s.id === ui.reportSid)) ui.reportSid = st.students[0].id;
      const sid = ui.reportSid, rec = () => (st.conf[sid] = st.conf[sid] || { points: '', goals: '', date: '' });
      const sel = studentSelect('cf-student', 'Student', sid); sel.addEventListener('change', () => { ui.reportSid = sel.value; render(); });
      const date = h('input', { type: 'date', id: 'cf-date', value: (st.conf[sid] || {}).date || '' }); date.addEventListener('change', () => { rec().date = L.isoOk(date.value) ? date.value : ''; save(); render(); });
      const inc = h('input', { type: 'checkbox', id: 'cf-notes', checked: !!ui.confNotes, onchange: e => { ui.confNotes = e.target.checked; render(); } });
      const pts = area('cf-points', (st.conf[sid] || {}).points, 2000, 'What you want to cover'), goals = area('cf-goals', (st.conf[sid] || {}).goals, 1000, 'Two or three goals for home and school');
      const c = () => L.conferenceReport(st, sid, { includeNotes: !!ui.confNotes, today: today() });
      const prev = h('div', { id: 'cf-sheet' }, confSheet(c()));
      const upd = () => { rec().points = L.clip(pts.value, 2000); rec().goals = L.clip(goals.value, 1000); save(); prev.replaceChildren(confSheet(c())); };
      pts.addEventListener('input', upd); goals.addEventListener('input', upd);
      const shared = L.notesFor(st, sid, 'parent').length;
      box.append(h('div', { class: 'row' }, h('label', { for: 'cf-student' }, 'Student'), h('div', { class: 'grow' }, sel), h('label', { for: 'cf-date' }, 'Meeting date'), h('div', null, date)),
        h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Talking points', pts, 'cf-points')), h('div', { class: 'grow' }, field('Goals we agreed', goals, 'cf-goals'))),
          h('label', null, inc, ' Include notes marked for the family (' + shared + ')'), h('p', { class: 'small muted' }, 'Off by default. Other private notes never appear here.'),
          h('div', { class: 'row' }, btn('Print', () => printNodes([confSheet(c())]), 'btn-small'), btn('Copy as text', () => copy(L.conferenceText(c()), pts), 'btn-ghost btn-small'), btn('Save as text file', () => download('conference-' + slug(c().name) + '.txt', L.conferenceText(c()).replace(/\n/g, '\r\n')), 'btn-ghost btn-small'))), prev);
      return box;
    }

    /* ---------- Substitute packet ---------- */
    function subSheet(p) {
      const sec = (t, v) => (v ? [h('h3', null, t), h('p', { class: 'pre' }, v)] : null);
      return h('article', { class: 'report' }, h('div', { class: 'rh' }, h('div', null, h('h1', null, 'Substitute packet: ', p.classroom || 'class'), h('small', null, [dayName(p.date) + ' ' + nice(p.date), p.teacher ? 'Class teacher: ' + p.teacher : ''].filter(Boolean).join(' · ')))),
        p.events.length ? h('p', null, h('b', null, 'Today: '), p.events.join('; ')) : null,
        h('h3', null, 'Lesson plans'), p.plans.length ? p.plans.map((x, i) => h('div', { class: 'plan' }, h('b', null, (i + 1) + '. ' + x.title), x.unit ? h('span', { class: 'small' }, ' (' + x.unit + ')') : null,
          [['Objective', x.objective], ['Activities', x.activities], ['Materials', x.materials], ['Homework', x.homework]].filter(f => f[1]).map(f => h('div', { class: 'pre' }, h('b', null, f[0] + ': '), f[1])))) : h('p', { class: 'muted' }, 'No lesson plan is saved for this day.'),
        sec('Daily routines', p.info.routines), sec('Emergency procedures', p.info.emergency), sec('Helpful students and staff', p.info.helpers), sec('Where things are', p.info.materials),
        p.groups ? [h('h3', null, 'Groups (' + p.groups.name + ')'), h('ul', null, p.groups.groups.map(g => h('li', null, h('b', null, g.name + ': '), g.members.join(', '))))] : null,
        p.seated ? [h('h3', null, 'Seating chart (front of the room at the top)'), h('table', { class: 'seatprint' }, h('tbody', null, p.seating.map(row => h('tr', null, row.map(n => h('td', null, n))))))] : null,
        p.supports.length ? [h('h3', null, 'Supports'), h('ul', null, p.supports.map(s => h('li', null, s.name + ', ' + s.work + ': ' + s.tier + (s.extraDays ? ', ' + s.extraDays + ' extra days' : '') + (s.note ? '. ' + s.note : ''))))] : null,
        p.notes.length ? [h('h3', null, 'Notes from the teacher'), h('ul', null, p.notes.map(n => h('li', null, h('b', null, n.name + ': '), n.text)))] : null, sec('Other notes', p.info.notes),
        h('h3', null, 'Register'), h('table', { class: 'register' }, h('thead', null, h('tr', null, h('th', null, 'Student'), ['P', 'L', 'A'].map(m => h('th', null, m)))), h('tbody', null, p.roster.map(n => h('tr', null, h('td', null, n), h('td'), h('td'), h('td'))))),
        h('div', { class: 'foot' }, 'Prepared with Stark Classroom Hub on ' + nice(today()) + '. Please leave this packet and the register for the class teacher.'));
    }
    function vSub() {
      const st = S(), box = h('div'); box.append(repTabs('sub'), h('h1', null, 'Substitute teacher packet'));
      if (!ui.subDate) ui.subDate = today();
      const o = ui.subOpts = ui.subOpts || { supports: false, notes: false };
      const date = h('input', { type: 'date', id: 'sb-date', value: ui.subDate }); date.addEventListener('change', () => { if (L.isoOk(date.value)) { ui.subDate = date.value; render(); } });
      const p = () => L.subPacket(st, ui.subDate, { includeSupports: o.supports, includeNotes: o.notes });
      const prev = h('div', { id: 'sb-sheet' }, subSheet(p()));
      const fields = [['routines', 'Daily routines (start of day, breaks, end of day)'], ['emergency', 'Emergency procedures (fire, lockdown, first aid)'], ['helpers', 'Helpful students and staff'], ['materials', 'Where things are'], ['notes', 'Other notes']];
      box.append(h('div', { class: 'row' }, h('label', { for: 'sb-date' }, 'Day'), h('div', null, date)),
        h('div', { class: 'card' }, h('h2', null, 'What a substitute needs to know'), h('p', { class: 'small muted' }, 'Saved and reused for every packet. Lessons, groups and the seating chart come from the other pages.'),
          h('div', { class: 'grid two' }, fields.map(f => { const t = area('sb-' + f[0], st.sub[f[0]], 2000); t.addEventListener('input', () => { st.sub[f[0]] = L.clip(t.value, 2000); save(); prev.replaceChildren(subSheet(p())); }); return h('div', null, field(f[1], t, 'sb-' + f[0])); })),
          h('label', null, h('input', { type: 'checkbox', id: 'sb-inc-supports', checked: o.supports, onchange: e => { o.supports = e.target.checked; render(); } }), ' Include supports (tiers, extra time and support notes)'),
          h('label', null, h('input', { type: 'checkbox', id: 'sb-inc-notes', checked: o.notes, onchange: e => { o.notes = e.target.checked; render(); } }), ' Include notes marked for a substitute'),
          h('p', { class: 'small muted' }, 'Both are off by default. Grades are never in the packet.'),
          h('div', { class: 'row' }, btn('Print packet', () => printNodes([subSheet(p())]), 'btn-small'), btn('Save as text file', () => download('substitute-packet-' + ui.subDate + '.txt', L.subPacketText(p()).replace(/\n/g, '\r\n')), 'btn-ghost btn-small'))), prev);
      return box;
    }

    /* ---------- Planning packs (Backup page) ---------- */
    function shareCard() {
      const st = S(), msg = h('div', { class: 'notice bad', id: 'pack-msg', role: 'alert', hidden: true }), pack = L.buildSharePack(st, ''), names = L.packMentions(st, pack);
      const pick = h('input', { type: 'file', id: 'packpick', accept: '.json,.starkplan', 'aria-label': 'Choose a planning pack', onchange: async e => {
        const f = e.target.files[0]; if (!f) return; msg.hidden = true;
        try { if (f.size > 10 * 1024 * 1024) throw new Error('That file is too big.'); const r = L.readSharePack(JSON.parse(await f.text())); if (!r.ok) throw new Error(r.error); ui.pack = { name: f.name, data: r.data, counts: r.counts }; render(); }
        catch (err) { msg.textContent = err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message; msg.hidden = false; }
      } });
      const c = pack.data, shift = h('input', { type: 'number', id: 'pack-shift', min: -730, max: 730, value: 0, class: 'narrow' });
      return h('div', { class: 'card' }, h('h2', null, 'Share plans with a colleague'), h('p', { class: 'muted' }, 'A planning pack is one file with your units, lessons, rubrics, standards and assignments. It never holds students, grades, attendance, notes or results. Hand it over on a USB stick, a school drive or email; the other teacher adds it with the button below.'), msg,
        names.length ? h('div', { class: 'notice' }, 'These first names appear in your plans: ' + names.join(', ') + '. Edit them out before sharing if they refer to students.') : null,
        h('div', { class: 'row' }, btn('Download planning pack', () => { const now = new Date().toISOString().slice(0, 16); download('stark-classroomhub-plans-' + slug(st.classroom.name) + '-' + today() + '.json', JSON.stringify(L.buildSharePack(st, now), null, 1), 'application/json'); toast('Planning pack saved to your downloads folder.'); }, 'btn-small', { disabled: !(c.units.length + c.plans.length + c.rubrics.length + c.standards.length + c.assignments.length) }),
          h('span', { class: 'small muted' }, c.units.length + ' units, ' + c.plans.length + ' lessons, ' + c.rubrics.length + ' rubrics, ' + c.standards.length + ' standards, ' + c.assignments.length + ' assignments')),
        field('Add a colleague\'s planning pack', pick, 'packpick'),
        ui.pack ? h('div', { class: 'notice' }, h('b', null, ui.pack.name), ': ' + Object.keys(ui.pack.counts).map(k => ui.pack.counts[k] + ' ' + k).join(', ') + '. Items you already have (same title or code) are skipped.',
          h('div', { class: 'row' }, h('label', { for: 'pack-shift' }, 'Move dates by (days)'), shift, btn('Add to my plans', () => { const r = L.mergeSharePack(st, ui.pack.data, shift.value); ui.pack = null; save(); toast('Added ' + Object.keys(r.added).map(k => r.added[k] + ' ' + k).join(', ') + '.'); render(); }), btn('Cancel', () => { ui.pack = null; render(); }, 'btn-ghost'))) : null);
    }

    return { lessons: vLessons, attendance: vAttendance, seating: vSeating, groups: vGroups, notes: vNotes, standards: vStandards, rubrics: vRubrics, conference: vConference, sub: vSub, diffPanel, shareCard, rubricSheet };
  };
})(typeof window !== 'undefined' ? window : globalThis);
