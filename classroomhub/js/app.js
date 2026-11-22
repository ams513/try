/* Stark Classroom Hub. The interface. All data stays in this browser on this computer: no network, no account. */
(function () {
  'use strict';
  const SCH = window.SCH, L = SCH.lib, CAT = SCH.catalog, E = SCH.edition;
  const addS = names => (E.trial ? L.addStudents(S, names, E.cap, E.capMessage()) : L.addStudents(S, names));
  const KEY = 'stark-classroomhub-v1', THEME_KEY = 'stark-classroomhub-theme';
  const ROUTES = [['home', 'Home'], ['roster', 'Roster'], ['lessons', 'Lessons'], ['plan', 'Assignments'], ['attendance', 'Attendance'], ['seating', 'Seating'], ['collect', 'Collect'], ['grades', 'Grade book'], ['notes', 'Notes'], ['reports', 'Reports'], ['pnotes', 'Parent notes'], ['insights', 'Insights'], ['calendar', 'Calendar'], ['transfer', 'Import/export'], ['safety', 'Backup']];
  const ALIAS = { datahelp: 'transfer', rubrics: 'plan', standards: 'grades', groups: 'seating', conference: 'reports', sub: 'reports', pnbatch: 'pnotes', pnlang: 'pnotes', pnlog: 'pnotes' };
  const TITLES = { rubrics: 'Rubric library', standards: 'Standards', groups: 'Groups', conference: 'Conference', sub: 'Substitute packet', pnotes: 'Parent notes', pnbatch: 'Parent notes: whole class', pnlang: 'Parent notes: languages', pnlog: 'Parent notes: sent log', datahelp: 'Data files help', feedback: 'Send feedback' };
  let S = L.emptyState(), storageOk = true, errs = [], safe = null, lastGood = '', recovered = false;
  const ui = { batches: [], draft: null, grade: null, reportSid: '', cal: null, rosterMsg: [], confirm: '', restore: null };

  /* ---------- helpers ---------- */
  const $ = s => document.querySelector(s);
  function h(tag, attrs) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    const add = c => { if (Array.isArray(c)) c.forEach(add); else if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); };
    for (let i = 2; i < arguments.length; i++) add(arguments[i]);
    return e;
  }
  const btn = (text, fn, cls, extra) => h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick: fn }, extra || {}), text);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  const nice = iso => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
  const pctText = p => (p === null || p === undefined ? '-' : Math.round(p) + '%');
  let toastT = 0;
  /* bad = true: announced assertively and kept for 10 s; never hidden while hovered or focused. */
  function toast(msg, bad) {
    const t = $('#toast'); t.setAttribute('role', bad ? 'alert' : 'status'); t.setAttribute('aria-live', bad ? 'assertive' : 'polite'); t.classList.toggle('bad', !!bad);
    t.textContent = msg; t.classList.add('on'); clearTimeout(toastT);
    const hide = () => { if (t.matches(':hover') || t.contains(document.activeElement)) { toastT = setTimeout(hide, 1500); return; } t.classList.remove('on'); };
    toastT = setTimeout(hide, bad ? 10000 : 4200);
  }
  /* A failed save is never silent: an assertive toast at once, and the banner on every page until a save succeeds. */
  function save() {
    if (safe) return; const was = storageOk;
    try { const r = L.storeSave(localStorage, KEY, S, lastGood); storageOk = r.ok; lastGood = r.good; } catch (e) { storageOk = false; }
    if (was && !storageOk) { toast('Not saved: this browser refused to store your class. Save a backup file now.', true); const m = $('#main'); if (m && !$('#save-warn')) m.prepend(saveWarn()); }
    if (!was && storageOk) { const w = $('#save-warn'); if (w) w.remove(); }
  }
  const saveWarn = () => h('div', { class: 'notice bad', role: 'alert', id: 'save-warn' }, 'This browser is not saving your class (private window, full or blocked site data). Save a backup file before you close the page.');
  function load() {
    safe = null; recovered = false;
    try {
      const r = L.storeLoad(localStorage, KEY); S = r.state; lastGood = r.good;
      if (r.mode === 'safe') safe = { raw: r.raw, bak: r.rawBak };
      else if (r.mode === 'recovered') { recovered = true; try { localStorage.setItem(KEY + '.corrupt', r.raw); localStorage.setItem(KEY, r.good); } catch (e) { storageOk = false; } }
    } catch (e) { S = L.emptyState(); }
  }
  function download(name, text, type) {
    const u = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    const a = h('a', { href: u, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000);
  }
  async function copy(text, area) {
    try { await navigator.clipboard.writeText(text); toast('Copied.'); return; } catch (e) { /* fall through */ }
    try { area.focus(); area.select(); document.execCommand('copy'); toast('Copied.'); } catch (e) { toast('Select the text and copy it with Ctrl+C.'); }
  }
  const field = (label, input, id) => [h('label', { for: id }, label), input];
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'class';
  const get = (a, sid) => (S.grades[a.id] || {})[sid] || { scores: {}, comment: '' };
  const aTitle = id => (S.assignments.find(a => a.id === id) || {}).title || '';
  const tabs = (list, key) => h('nav', { class: 'tabs', 'aria-label': 'Sections' }, list.map(t => h('a', { href: '#/' + t[0], 'aria-current': t[0] === key ? 'page' : null }, t[1])));
  function printNodes(nodes) {
    const pa = $('#print-area'); pa.replaceChildren(...nodes);
    const clear = () => { pa.replaceChildren(); window.removeEventListener('afterprint', clear); }; window.addEventListener('afterprint', clear);
    try { window.print(); } catch (e) { toast('Printing is not available here.'); clear(); }
  }
  function useRubric(r) { ui.draft = blankDraft(); ui.draft.rubric = L.rubricText(r.criteria); ui.draft.levels = L.levelsMap(r.criteria); if (location.hash === '#/plan') render(); else location.hash = '#/plan'; }
  const XV = SCH.extViews({ h, btn, field, L, CAT, ui, save, render: () => render(), toast, download, copy, nice, today, slug, pctText, printNodes, tabs, useRubric, st: () => S });

  const NV = SCH.noteViews({ h, btn, field, L, ui, save, render: () => render(), toast, download, copy, nice, today, slug, printNodes, tabs, st: () => S });

  const IV = SCH.insightViews({ h, btn, field, L, ui, save, render: () => render(), toast, download, copy, nice, today, slug, st: () => S });

  /* ---------- Free trial and feedback ---------- */
  const buyLink = cls => h('a', { class: 'btn ' + (cls || ''), href: E.buy, target: '_blank', rel: 'noopener noreferrer' }, 'Own it forever: buy on itch.io');
  function trialCard() {
    return h('div', { class: 'notice trial-card', id: 'trial-card' }, h('b', null, 'Free trial. '), 'No time limit. The one limit: up to ' + E.cap + ' students. ' + (window.StarkTrial || {}).notIncluded + ' Nothing you save is ever deleted or locked. Save a backup any time: the same file restores in the full app, so your class comes with you. ', buyLink('btn-small'));
  }
  function vFeedback() {
    const box = h('div'), f = { likes: '', missing: '', rating: 0 };
    const a = h('a', { class: 'btn', id: 'fb-send', href: E.feedback(f).href }, 'Open in my email app'), pre = h('textarea', { id: 'fb-preview', readonly: true, rows: 9, 'aria-label': 'The message your email app will open with' });
    const sync = () => { const m = E.feedback(f); a.setAttribute('href', m.href); pre.value = m.body; };
    const ta = (id, key, label, ph) => { const t = h('textarea', { id, rows: 4, maxlength: 1000, placeholder: ph, autocomplete: 'off' }); t.addEventListener('input', () => { f[key] = t.value; sync(); }); return field(label, t, id); };
    const stars = h('fieldset', { class: 'rating' }, h('legend', null, 'Rating (1 is poor, 5 is great)'), [1, 2, 3, 4, 5].map(n => h('label', { class: 'rate', for: 'fb-r' + n }, h('input', { type: 'radio', name: 'fb-rating', id: 'fb-r' + n, value: n, onchange: () => { f.rating = n; sync(); } }), String(n))));
    box.append(h('h1', null, 'Send feedback'), h('p', { class: 'muted' }, 'Tell us what works and what you wish it did. This only opens your own email app with the message written for you. Nothing is sent from here, and nothing leaves this computer until you press send in your email app.'),
      h('div', { class: 'card' }, ta('fb-likes', 'likes', 'What you like', 'The part that saves you time'), ta('fb-missing', 'missing', 'What is missing', 'A feature, a report, a fix'), stars,
        h('label', { for: 'fb-preview' }, 'Your message (you can change it in your email app)'), pre,
        h('div', { class: 'row' }, a, h('span', { class: 'muted small' }, 'To ' + E.mail + '. No email app opens? Copy the text above and send it yourself.'))));
    sync(); return box;
  }

  /* ---------- Home ---------- */
  function vHome() {
    const c = S.classroom, td = today(), box = h('div');
    const setf = (k, el) => el.addEventListener('change', () => { c[k] = k.startsWith('term') && k !== 'termName' ? (L.isoOk(el.value) ? el.value : '') : L.clip(el.value, k === 'teacher' ? 40 : 60); save(); render(); });
    const mk = (k, label, type) => { const el = h('input', { type: type || 'text', id: 'c-' + k, value: c[k], maxlength: type ? null : 60, autocomplete: 'off' }); setf(k, el); return field(label, el, 'c-' + k); };
    const cells = S.assignments.length * S.students.length;
    let graded = 0; S.assignments.forEach(a => S.students.forEach(s => { if (L.rubricResult(a, get(a, s.id)).pct !== null) graded++; }));
    const evN = Object.keys(S.evidence).reduce((n, k) => n + S.evidence[k].length, 0);
    if (E.trial) box.append(trialCard());
    box.append(h('h1', null, c.name || 'Your class'), h('p', { class: 'muted' }, 'One offline dashboard across Stark IntraTheater, Stark Quill, Stark World Engine and Stark Math. Everything stays on this computer.'));
    if (!S.students.length && !S.assignments.length) box.append(h('div', { class: 'notice' }, h('b', null, 'New here? '), 'Add your students on the Roster page, or ', btn('look around with a sample class', () => { S = SCH.demo.build(td); save(); toast('Sample class loaded. Clear it any time on the Backup page.'); render(); }, 'btn-small btn-ghost'), '.'));
    box.append(h('div', { class: 'grid' },
      h('div', { class: 'card stat' }, h('b', null, S.students.length), h('span', null, 'students')),
      h('div', { class: 'card stat' }, h('b', null, S.assignments.length), h('span', null, 'assignments')),
      h('div', { class: 'card stat' }, h('b', null, cells ? Math.round(100 * graded / cells) + '%' : '0%'), h('span', null, 'of work graded')),
      h('div', { class: 'card stat' }, h('b', null, evN), h('span', null, 'results collected'))));
    box.append(h('div', { class: 'grid' },
      h('div', { class: 'card' }, h('h2', null, 'Your class'), mk('name', 'Class name'), mk('teacher', 'Teacher (shown on parent notes)'), mk('termName', 'Term name'),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, mk('termStart', 'Term starts', 'date')), h('div', { class: 'grow' }, mk('termEnd', 'Term ends', 'date')))),
      h('div', { class: 'card' }, h('h2', null, 'Due soon'),
        (() => { const d = S.assignments.filter(a => a.due && a.due >= td).sort((x, y) => x.due.localeCompare(y.due)).slice(0, 5); return d.length ? h('ul', { class: 'list' }, d.map(a => h('li', null, h('a', { href: '#/plan' }, a.title), h('span', { class: 'muted' }, nice(a.due))))) : h('p', { class: 'muted' }, 'Nothing due. Plan an assignment to see it here.'); })(),
        S.assignments.length ? h('p', { class: 'small' }, h('a', { href: '#/calendar' }, 'Open the term calendar')) : null),
      (() => { const day = S.attendance[td], lessons = L.plansOn(S, td), c = L.dayCounts(S, td); return h('div', { class: 'card' }, h('h2', null, 'Today'),
        h('p', null, h('a', { href: '#/attendance' }, 'Register'), ': ', day ? c.P + ' present, ' + c.L + ' late, ' + (c.A + c.E) + ' away' : 'not taken yet'),
        lessons.length ? h('ul', { class: 'list' }, lessons.map(p => h('li', null, h('div', null, h('a', { href: '#/lessons' }, p.title), p.objective ? h('div', { class: 'muted small' }, p.objective) : null)))) : h('p', { class: 'muted' }, 'No lesson planned for today. ', h('a', { href: '#/lessons' }, 'Plan one'), '.'),
        h('p', { class: 'small' }, h('a', { href: '#/sub' }, 'Make a substitute packet'))); })(),
      h('div', { class: 'card' }, h('h2', null, 'Keep your data safe'),
        h('p', null, S.lastBackup ? 'Last backup: ' + S.lastBackup.slice(0, 10) + '.' : 'You have not saved a backup yet.'),
        h('p', { class: 'small muted' }, 'The Hub keeps your class in this browser. Clearing browser data erases it, so save a backup file now and then.'),
        btn('Save a backup', () => { location.hash = '#/safety'; }, 'btn-ghost'))));
    return box;
  }

  /* ---------- Roster ---------- */
  function vRoster() {
    const box = h('div'), bad = ui.rosterMsg.length > 0, ta = h('textarea', { id: 'names', placeholder: 'Maya, Leo, Priya\nSam K.\nMary-Jane', 'aria-describedby': bad ? 'names-help names-err' : 'names-help', 'aria-invalid': bad ? 'true' : null, autocomplete: 'off', spellcheck: 'false', maxlength: 4000 });
    const add = () => { const r = addS(ta.value); ui.rosterMsg = r.rejected; save(); if (r.add.length) toast('Added ' + r.add.length + (r.add.length === 1 ? ' student.' : ' students.')); render(); };
    box.append(h('h1', null, 'Roster'),
      h('div', { class: 'card' }, h('h2', null, 'Add students'), h('p', { id: 'names-help', class: 'muted' }, 'First names or nicknames only, one per line or separated by commas. Never surnames, emails, numbers or addresses. If two students share a name, add an initial (Sam K.) or a hyphen (Mary-Jane).'),
        h('label', { for: 'names' }, 'Names'), ta, h('div', { class: 'row' }, btn('Add to roster', add), h('span', { class: 'muted small' }, S.students.length + ' of ' + (E.trial ? E.cap : L.MAX_STUDENTS) + ' students' + (E.trial ? ' (free trial)' : '')))));
    box.append(TV.rosterCard());
    if (ui.rosterMsg.length) box.append(h('div', { class: 'notice bad', role: 'alert', id: 'names-err' }, h('b', null, 'Not added:'), h('ul', null, ui.rosterMsg.map(r => h('li', null, h('b', null, r.raw || '(blank)'), ': ', r.why)))));
    box.append(h('div', { class: 'card' }, h('h2', null, 'Students'), S.students.length ? h('ul', { class: 'list' }, S.students.map(s => h('li', null, h('span', null, s.name),
      ui.confirm === 'rm:' + s.id ? h('span', null, btn('Yes, remove', () => { L.removeStudent(S, s.id); ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), ' ', btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small'))
        : btn('Remove', () => { ui.confirm = 'rm:' + s.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Remove ' + s.name })))) : h('p', { class: 'muted' }, 'No students yet.')));
    return box;
  }

  /* ---------- Assignments (planner) ---------- */
  function blankDraft() { return { id: '', title: '', due: '', weight: 1, notes: '', rubric: '', levels: {}, useQuill: false, prompt: '', wordTarget: '', intra: new Set(), world: new Set(), band: 'all', err: '' }; }
  function draftOf(a) { return { id: a.id, title: a.title, due: a.due, weight: a.weight, notes: a.notes, rubric: L.rubricText(a.rubric), levels: L.levelsMap(a.rubric), useQuill: !!a.quill, prompt: a.quill ? a.quill.prompt : '', wordTarget: a.quill && a.quill.wordTarget ? String(a.quill.wordTarget) : '', intra: new Set(a.intra), world: new Set(a.world), band: 'all', err: '' }; }
  function saveDraft() {
    const d = ui.draft, old = d.id ? S.assignments.find(a => a.id === d.id) : null;
    const title = L.clip(d.title, 120);
    if (!title) { d.err = 'Give the assignment a title.'; return false; }
    if (d.due && !L.isoOk(d.due)) { d.err = 'The due date should look like 2027-03-01.'; return false; }
    const rubric = L.rubricFromText(d.rubric, old ? old.rubric : [], d.levels);
    const quill = d.useQuill ? { prompt: d.prompt, wordTarget: d.wordTarget } : null;
    if (quill) { try { L.makeQuillAssignment(title, d.prompt, d.wordTarget, d.due, rubric.map(r => r.text), ''); } catch (e) { d.err = e.message; return false; } }
    const body = { title, due: d.due, notes: L.clip(d.notes, 600), weight: Math.min(10, Math.max(0.5, parseFloat(d.weight) || 1)), rubric, quill: quill ? { prompt: L.clip(d.prompt, 5000), wordTarget: Math.max(0, parseInt(d.wordTarget, 10) || 0) } : null, intra: [...d.intra], world: [...d.world] };
    if (old) { Object.assign(old, body); Object.keys(S.grades[old.id] || {}).forEach(sid => { const g = S.grades[old.id][sid]; Object.keys(g.scores).forEach(k => { if (!rubric.some(r => r.id === k)) delete g.scores[k]; }); }); }
    else L.pushAssignment(S, body);
    return true;
  }
  function vPlan() {
    const box = h('div'), d = ui.draft;
    box.append(tabs([['plan', 'Assignments'], ['rubrics', 'Rubric library']], 'plan'), h('h1', null, 'Assignments'), h('p', { class: 'muted' }, 'Plan one piece of work across the Suite: write a Quill assignment, pick IntraTheater lessons and World Engine lesson packs, and set the rubric you will grade against.'));
    if (d) {
      const f = (k, label, type, extra) => { const el = h('input', Object.assign({ type: type || 'text', id: 'd-' + k, value: d[k] }, extra || {})); el.addEventListener('input', () => { d[k] = el.value; }); return field(label, el, 'd-' + k); };
      const intraBox = h('div', { class: 'pick', role: 'group', 'aria-label': 'IntraTheater lessons' }), worldBox = h('div', { class: 'pick', role: 'group', 'aria-label': 'World Engine lesson packs' });
      const drawIntra = () => { intraBox.replaceChildren(...CAT.INTRA.filter(l => d.band === 'all' || l.band === d.band).map(l => h('label', null, h('input', { type: 'checkbox', checked: d.intra.has(l.id), onchange: e => { e.target.checked ? d.intra.add(l.id) : d.intra.delete(l.id); } }), h('span', null, l.title, ' ', h('span', { class: 'muted small' }, l.band + ', ' + l.kind))))); };
      drawIntra();
      CAT.WORLD.forEach(p => worldBox.append(h('label', null, h('input', { type: 'checkbox', checked: d.world.has(p.id), onchange: e => { e.target.checked ? d.world.add(p.id) : d.world.delete(p.id); } }), h('span', null, p.title, ' ', h('span', { class: 'muted small' }, p.minutes + ' min')))));
      const band = h('select', { id: 'd-band', 'aria-label': 'Filter lessons by band' }, ['all', 'K-2', '3-5', '6-8'].map(b => h('option', { value: b, selected: d.band === b }, b === 'all' ? 'All bands' : 'Band ' + b)));
      band.addEventListener('change', () => { d.band = band.value; drawIntra(); });
      const rub = h('textarea', { id: 'd-rubric', placeholder: 'Clear opening\nStrong ending\nAccuracy | 10\nUses evidence | 4 | READ.2' }); rub.value = d.rubric; rub.addEventListener('input', () => { d.rubric = rub.value; });
      const libs = L.libraryRubrics(S), from = h('select', { id: 'd-from' }, h('option', { value: '' }, 'Choose a rubric to copy in'), libs.map((r, i) => h('option', { value: String(i) }, r.title + (r.builtIn ? '' : ' (yours)'))));
      from.addEventListener('change', () => { const r = libs[+from.value]; if (!r) return; d.rubric = rub.value = L.rubricText(r.criteria); d.levels = L.levelsMap(r.criteria); });
      const notes = h('textarea', { id: 'd-notes', maxlength: 600 }); notes.value = d.notes; notes.addEventListener('input', () => { d.notes = notes.value; });
      const prompt = h('textarea', { id: 'd-prompt', maxlength: 5000, placeholder: 'What the students will see in Stark Quill' }); prompt.value = d.prompt; prompt.addEventListener('input', () => { d.prompt = prompt.value; });
      const qbox = h('div', { hidden: !d.useQuill }, field('Prompt for students', prompt, 'd-prompt'), f('wordTarget', 'Word target (0 for none)', 'number', { min: 0, max: 1000000 }));
      const useQ = h('input', { type: 'checkbox', id: 'd-useq', checked: d.useQuill, onchange: e => { d.useQuill = e.target.checked; qbox.hidden = !d.useQuill; } });
      box.append(h('div', { class: 'card', id: 'planform' }, h('h2', null, d.id ? 'Edit assignment' : 'New assignment'),
        d.err ? h('div', { class: 'notice bad', role: 'alert' }, d.err) : null,
        h('div', { class: 'row' }, h('div', { class: 'grow' }, f('title', 'Title', 'text', { maxlength: 120 })), h('div', { class: 'grow' }, f('due', 'Due date', 'date')), h('div', { class: 'grow' }, f('weight', 'Weight in the final grade', 'number', { min: 0.5, max: 10, step: 0.5 }))),
        field('Start from the rubric library', from, 'd-from'),
        field('Rubric: one criterion per line, then optional "| max points" (default 4) and "| standard code"', rub, 'd-rubric'),
        field('Notes for you (not shown to students)', notes, 'd-notes'),
        h('h3', null, 'Stark Quill'), h('label', null, useQ, ' Create a Quill assignment file for this'), qbox,
        h('h3', null, 'Stark IntraTheater lessons'), h('div', { class: 'row' }, h('label', { for: 'd-band' }, 'Show'), band), intraBox,
        h('h3', null, 'Stark World Engine lesson packs'), worldBox,
        h('div', { class: 'row' }, btn('Save assignment', () => { if (saveDraft()) { ui.draft = null; save(); toast('Assignment saved.'); } render(); }), btn('Cancel', () => { ui.draft = null; render(); }, 'btn-ghost'))));
    } else box.append(h('div', { class: 'row' }, btn('New assignment', () => { ui.draft = blankDraft(); render(); $('#d-title') && $('#d-title').focus(); })));
    if (!S.assignments.length) box.append(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'No assignments yet.')));
    S.assignments.slice().sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).forEach(a => {
      let qf = null; if (a.quill) { try { qf = L.quillFor(a, S.classroom.teacher); } catch (e) { qf = null; } }
      const nd = Object.keys(a.accom || {}).length;
      box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, a.title), a.due ? h('span', { class: 'chip' }, 'Due ' + nice(a.due)) : null, h('span', { class: 'chip' }, 'Weight ' + a.weight), nd ? h('span', { class: 'chip' }, 'Differentiated for ' + nd) : null),
        a.notes ? h('p', { class: 'muted' }, a.notes) : null,
        h('div', null, a.quill ? h('span', { class: 'chip' }, 'Quill assignment') : null, a.intra.map(id => h('span', { class: 'chip' }, 'IntraTheater: ' + (CAT.INTRA.find(l => l.id === id) || { title: id }).title)), a.world.map(id => h('span', { class: 'chip' }, 'World Engine: ' + (CAT.WORLD.find(p => p.id === id) || { title: id }).title))),
        h('p', { class: 'small muted' }, a.rubric.length ? 'Rubric: ' + a.rubric.map(r => r.text + ' (' + r.max + (r.std ? ', ' + r.std : '') + ')').join('; ') : 'No rubric yet. Add one to grade this work.'),
        h('div', { class: 'row' }, qf ? btn('Download Quill file', () => { const f = L.quillAssignmentFile(qf); download(f.filename, f.text, 'application/json'); toast('Saved ' + f.filename + '. Give it to your students to open in Stark Quill.'); }, 'btn-small') : null,
          btn('Edit', () => { ui.draft = draftOf(a); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Edit ' + a.title }),
          btn(ui.diff === a.id ? 'Hide differentiation' : 'Differentiate', () => { ui.diff = ui.diff === a.id ? '' : a.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Differentiate ' + a.title }),
          a.rubric.length ? btn('Print rubric', () => printNodes([XV.rubricSheet(a.title, a.rubric)]), 'btn-ghost btn-small', { 'aria-label': 'Print the rubric for ' + a.title }) : null,
          a.rubric.length ? btn('Save rubric to library', () => { try { L.saveRubric(S, a.title, a.rubric); save(); toast('Saved to the rubric library.'); } catch (e) { toast(e.message); } }, 'btn-ghost btn-small', { 'aria-label': 'Save the rubric for ' + a.title + ' to the library' }) : null,
          ui.confirm === 'da:' + a.id ? [btn('Yes, delete it and its grades', () => { S.assignments = S.assignments.filter(x => x.id !== a.id); delete S.grades[a.id]; ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')]
            : btn('Delete', () => { ui.confirm = 'da:' + a.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + a.title }))));
      if (ui.diff === a.id) box.append(XV.diffPanel(a));
    });
    return box;
  }

  /* ---------- Collect ---------- */
  async function inflate(u8, limit) {
    if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot open zip files; use a current Chrome, Edge, Firefox or Safari');
    const rd = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let n = 0;
    for (;;) { const r = await rd.read(); if (r.done) break; n += r.value.length; if (n > limit) { await rd.cancel(); throw new Error('the zip is damaged'); } parts.push(r.value); }
    const out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
  }
  const KIND_LABEL = { 'intra-csv': 'IntraTheater progress CSV', 'intra-backup': 'IntraTheater class backup', 'world': 'World Engine reflection', 'math-result': 'Math result', 'math-csv': 'Math leaderboard', zip: 'Quill hand-in' };
  function prepRecords(res) {
    return (res.records || []).map(r => { const m = L.matchStudent(S.students, r.name); return Object.assign({}, r, { how: m ? m.how : '', choice: m ? m.id : (r.nameOk ? '+new' : '') }); });
  }
  async function readFile(f) {
    const b = { name: f.name, label: '', ok: false, error: '', problems: [], records: [], assign: null };
    try {
      if (/\.zip$/i.test(f.name)) {
        b.label = KIND_LABEL.zip;
        if (f.size > 100 * 1024 * 1024) { b.error = 'That file is too big.'; return b; }
        const v = await L.verifySubmission(new Uint8Array(await f.arrayBuffer()), inflate), p = L.parseQuillVerified(v);
        b.ok = p.ok; b.error = p.error; b.problems = p.ok ? [] : v.problems; b.records = prepRecords(p); b.verified = v.ok; return b;
      }
      if (f.size > 5 * 1024 * 1024) { b.error = 'That file is too big.'; return b; }
      const text = await f.text(), kind = L.classifyText(f.name, text);
      if (kind === 'hub-backup') { b.label = 'Hub backup'; b.error = 'This is a Classroom Hub backup. Restore it on the Backup page.'; return b; }
      if (kind === 'quill-assign') { b.label = 'Quill assignment'; try { b.assign = L.readQuillAssignment(text); b.ok = true; } catch (e) { b.error = e.message; } return b; }
      if (!kind) { b.error = 'The Hub does not recognise this file. It reads IntraTheater CSV and backup files, Quill hand-in zips and .quillassign files, World Engine reflection .txt files and Math result files.'; return b; }
      b.label = KIND_LABEL[kind]; const p = L.parseText(kind, text);
      b.ok = p.ok; b.error = p.error; b.problems = p.problems; b.records = prepRecords(p);
    } catch (e) { b.error = 'Could not read this file: ' + (e && e.message ? e.message : 'unknown error'); }
    return b;
  }
  async function takeFiles(files) { for (const f of Array.from(files).slice(0, 60)) ui.batches.push(await readFile(f)); render(); }
  function commit() {
    let added = 0, imported = 0, rejected = 0;
    const items = [];
    ui.batches.forEach(b => b.records.forEach(r => {
      if (!r.choice) return;
      let sid = r.choice;
      if (sid === '+new') { const before = S.students.length; addS(r.name); const s = S.students.find(x => x.name.toLowerCase() === r.name.toLowerCase()); if (!s) { rejected++; return; } sid = s.id; if (S.students.length > before) added++; }
      items.push({ sid, ev: r.ev });
    }));
    imported = L.applyImport(S, items, today()); save(); ui.batches = [];
    toast('Imported ' + imported + (imported === 1 ? ' result' : ' results') + (added ? ', added ' + added + (added === 1 ? ' student' : ' students') : '') + (rejected ? ', ' + rejected + ' not added' : '') + '.'); render();
  }
  function vCollect() {
    const box = h('div'), input = h('input', { type: 'file', id: 'filepick', multiple: true, accept: '.csv,.json,.zip,.txt,.quillassign', 'aria-label': 'Choose result files', onchange: e => { takeFiles(e.target.files); } });
    const drop = h('div', { class: 'drop', id: 'drop' }, h('p', null, h('b', null, 'Drop result files here'), ' or choose them'), input, h('p', { class: 'small muted' }, 'IntraTheater progress CSV or class backup, Quill hand-in zips (checked for tampering), World Engine reflection .txt, Math result files. Files are read on this computer only.'));
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files) takeFiles(e.dataTransfer.files); });
    box.append(h('h1', null, 'Collect results'), drop);
    ui.batches.forEach((b, bi) => {
      const card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, b.name), b.label ? h('span', { class: 'chip' }, b.label) : null,
        b.ok ? h('span', { class: 'chip good' }, b.label === KIND_LABEL.zip ? 'Integrity check passed' : 'Read OK') : h('span', { class: 'chip bad' }, b.label === KIND_LABEL.zip ? 'Failed the check' : 'Not imported'),
        btn('Discard', () => { ui.batches.splice(bi, 1); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Discard ' + b.name })));
      if (b.error) card.append(h('div', { class: 'notice bad', role: 'alert' }, b.error));
      if (b.problems.length && !b.ok) card.append(h('ul', { class: 'small' }, b.problems.slice(0, 8).map(p => h('li', null, p))));
      else if (b.problems.length) card.append(h('ul', { class: 'small muted' }, b.problems.slice(0, 5).map(p => h('li', null, p))));
      if (b.assign) card.append(h('p', null, 'Assignment "', b.assign.title, '" with ', b.assign.rubric.length, ' rubric criteria', b.assign.due ? ', due ' + nice(b.assign.due) : '', '.'), btn('Add to the planner', () => {
        const a = b.assign; L.pushAssignment(S, { title: a.title, due: a.due, notes: '', weight: 1, rubric: a.rubric.map(r => ({ id: r.id, text: r.text, max: 4 })), quill: { prompt: a.prompt, wordTarget: a.word_target }, intra: [], world: [] });
        save(); ui.batches.splice(bi, 1); toast('Added "' + a.title + '" to the planner.'); render();
      }));
      if (b.records.length) {
        card.append(h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Name in file'), h('th', null, 'Student'), h('th', null, 'What it holds'))),
          h('tbody', null, b.records.map((r, ri) => {
            const sel = h('select', { 'aria-label': 'Student for ' + r.name }, h('option', { value: '' }, 'Skip this one'), r.nameOk ? h('option', { value: '+new', selected: r.choice === '+new' }, 'Add "' + r.name + '" as a new student') : null, S.students.map(s => h('option', { value: s.id, selected: r.choice === s.id }, s.name)));
            sel.addEventListener('change', () => { r.choice = sel.value; });
            return h('tr', null, h('td', null, r.name || '(no name)', r.nameOk ? null : h('div', { class: 'small', title: 'Only first names and nicknames can join the roster' }, h('span', { class: 'chip warn' }, 'not a first name'))), h('td', null, sel, r.how ? h('div', { class: 'small muted' }, 'matched by ' + r.how) : null), h('td', null, h('b', null, r.ev.label), h('div', { class: 'small muted' }, r.ev.detail)));
          })))));
      }
      box.append(card);
    });
    if (ui.batches.some(b => b.records.length)) box.append(h('div', { class: 'row' }, btn('Import the selected results', commit), h('span', { class: 'muted small' }, 'A repeat import of the same file replaces the older copy.')));
    const cols = ['intra', 'quill', 'world', 'math'];
    box.append(h('div', { class: 'card' }, h('h2', null, 'Collected so far'), S.students.length ? h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Student'), cols.map(c => h('th', { class: 'num' }, L.SOURCES[c])))),
      h('tbody', null, S.students.map(s => h('tr', null, h('td', null, s.name), cols.map(c => { const n = (S.evidence[s.id] || []).filter(e => e.source === c).length; return h('td', { class: 'num' }, n ? h('span', { class: 'chip good' }, n) : h('span', { class: 'muted' }, '-')); })))))) : h('p', { class: 'muted' }, 'Add students first, then import their results.')));
    return box;
  }

  /* ---------- Grade book ---------- */
  function cellNode(a, s) {
    const r = L.rubricResult(a, get(a, s.id)), ev = L.assignmentEvidence(S, s.id, a);
    const sel = ui.grade && ui.grade.aid === a.id && ui.grade.sid === s.id;
    const tier = L.accomOf(a, s.id).tier;
    return h('button', { type: 'button', class: 'cell' + (tier !== 'core' ? ' t-' + tier : ''), 'aria-pressed': sel ? 'true' : 'false', 'aria-label': s.name + ', ' + a.title + ': ' + (r.pct === null ? 'not graded' : Math.round(r.pct) + ' percent') + (tier !== 'core' ? ', ' + L.TIERS[tier] + ' tier' : ''), title: tier !== 'core' ? L.TIERS[tier] + ' tier' : null, onclick: () => { ui.grade = { aid: a.id, sid: s.id }; render(); } },
      h('b', { class: r.pct === null ? 'muted' : 'band-' + L.band(r.pct) }, pctText(r.pct)), ev.total ? h('small', null, ev.parts.filter(p => p.status === 'done').length + '/' + ev.total + ' in') : h('small', null, r.pct === null ? 'grade' : (r.complete ? '' : r.scored + '/' + r.total + ' scored')));
  }
  function gradeTable() {
    const as = S.assignments;
    return h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Student'), as.map(a => h('th', { class: 'num', title: a.title }, a.title.length > 22 ? a.title.slice(0, 21) + '…' : a.title)), h('th', { class: 'num' }, 'Overall'))),
      h('tbody', null, S.students.map(s => { const f = L.finalGrade(S, s.id); return h('tr', null, h('td', null, h('b', null, s.name)), as.map(a => h('td', { class: 'num' }, cellNode(a, s))),
        h('td', { class: 'num' }, f.pct === null ? h('span', { class: 'muted' }, '-') : [h('b', { class: 'band-' + f.band }, Math.round(f.pct) + '%'), h('div', { class: 'small muted' }, f.letter + ' · ' + f.band)])); })),
      h('tfoot', null, h('tr', null, h('th', null, 'Class average'), as.map(a => { const st = L.assignmentStats(S, a); return h('th', { class: 'num' }, pctText(st.mean)); }),
        h('th', { class: 'num' }, pctText(L.stats(S.students.map(s => L.finalGrade(S, s.id).pct)).mean))))));
  }
  function editor(tableBox) {
    const g = ui.grade, a = S.assignments.find(x => x.id === g.aid), s = S.students.find(x => x.id === g.sid);
    if (!a || !s) return h('div');
    const rec = () => { const m = S.grades[a.id] = S.grades[a.id] || {}; return m[s.id] = m[s.id] || { scores: {}, comment: '' }; };
    const live = h('b', { id: 'live' }), refresh = () => { const r = L.rubricResult(a, get(a, s.id)); live.textContent = r.pct === null ? 'Not graded yet' : Math.round(r.pct) + '%  ' + L.band(r.pct) + (r.complete ? '' : ' (' + r.scored + ' of ' + r.total + ' scored)'); live.className = r.pct === null ? 'muted' : 'band-' + L.band(r.pct); };
    const tidy = () => { const m = S.grades[a.id]; if (m && m[s.id] && !Object.keys(m[s.id].scores).length && !m[s.id].comment) delete m[s.id]; };
    const after = () => { tidy(); save(); refresh(); tableBox.replaceChildren(gradeTable()); };
    const ev = L.assignmentEvidence(S, s.id, a), idx = S.students.findIndex(x => x.id === s.id);
    const refl = (ev.parts.find(p => p.reflection) || {}).reflection;
    const comment = h('textarea', { id: 'g-comment', maxlength: 1000, placeholder: 'A comment for the student and family' }); comment.value = get(a, s.id).comment;
    comment.addEventListener('input', () => { rec().comment = comment.value; after(); });
    const go = d => { const n = S.students[idx + d]; if (n) { ui.grade = { aid: a.id, sid: n.id }; render(); } };
    const card = h('div', { class: 'card', id: 'editor' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, s.name, ' · ', a.title), btn('Previous', () => go(-1), 'btn-ghost btn-small', { disabled: idx <= 0 }), btn('Next student', () => go(1), 'btn-ghost btn-small', { disabled: idx >= S.students.length - 1 }), btn('Close', () => { ui.grade = null; render(); }, 'btn-ghost btn-small')),
      h('div', { class: 'row' }, live),
      a.rubric.length ? a.rubric.map(c => { const inp = h('input', { type: 'number', id: 'g-' + c.id, min: 0, max: c.max, step: 0.5, value: typeof get(a, s.id).scores[c.id] === 'number' ? get(a, s.id).scores[c.id] : '', 'aria-label': c.text + ' score out of ' + c.max });
        inp.addEventListener('input', () => { const m = rec(); if (inp.value === '') delete m.scores[c.id]; else { const v = parseFloat(inp.value); if (isFinite(v)) m.scores[c.id] = Math.min(c.max, Math.max(0, Math.round(v * 2) / 2)); } after(); });
        return h('div', { class: 'rubric-row' }, h('label', { for: 'g-' + c.id }, c.text, ' ', h('span', { class: 'muted small' }, 'out of ' + c.max)), inp); }) : h('div', { class: 'notice' }, 'This assignment has no rubric. Add criteria on the Assignments page to grade it.'),
      field('Comment', comment, 'g-comment'),
      ev.parts.length ? [h('h3', null, 'What the student handed in'), h('ul', { class: 'list' }, ev.parts.map(p => h('li', null, h('span', null, p.label, p.detail ? h('div', { class: 'small muted' }, p.detail) : null), h('span', { class: 'chip st-' + p.status }, p.status === 'done' ? 'In' : p.status === 'partial' ? 'Partly' : 'Not yet'))))] : null,
      refl ? [h('h3', null, 'Student reflection (Quill)'), h('pre', { class: 'note' }, refl)] : null);
    refresh(); return card;
  }
  function vGrades() {
    const box = h('div');
    box.append(tabs([['grades', 'Scores'], ['standards', 'Standards']], 'grades'), h('h1', null, 'Grade book'), h('div', { class: 'row' }, btn('Download grade book (CSV)', () => { download('gradebook-' + slug(S.classroom.name) + '.csv', L.gradebookCSV(S), 'text/csv;charset=utf-8'); }, 'btn-ghost', { disabled: !S.students.length || !S.assignments.length }),
      h('span', { class: 'muted small' }, 'Pick a cell to score the rubric and write a comment. Overall is the weighted average of graded work.')));
    if (!S.students.length || !S.assignments.length) { box.append(h('div', { class: 'card' }, h('p', null, 'Add students on the ', h('a', { href: '#/roster' }, 'Roster'), ' page and plan work on the ', h('a', { href: '#/plan' }, 'Assignments'), ' page, then grade here.'))); return box; }
    const tableBox = h('div', { id: 'gradetable' }, gradeTable());
    box.append(tableBox); if (ui.grade) box.append(editor(tableBox));
    return box;
  }

  /* ---------- Reports ---------- */
  function reportCard(r) {
    const evs = r.evidence;
    return h('article', { class: 'report' },
      h('div', { class: 'rh' }, h('div', null, h('h1', null, 'Progress report: ', r.name), h('small', null, [r.classroom, r.term, r.teacher].filter(Boolean).join(' · '))), h('div', { class: 'right' }, r.final.pct === null ? h('div', { class: 'muted' }, 'Not graded yet') : [h('div', { class: 'big' }, Math.round(r.final.pct) + '%'), h('div', { class: 'band-' + r.final.band }, r.final.band + ' · ' + r.final.letter)])),
      r.rows.length ? h('div', { class: 'tablewrap repwrap', role: 'region', tabindex: '0', 'aria-label': 'Work and results (scrolls sideways on a narrow screen)' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Work'), h('th', null, 'Result'), h('th', null, 'Rubric'), h('th', null, 'Teacher comment'))),
        h('tbody', null, r.rows.map(x => h('tr', null, h('td', null, h('b', null, x.title), x.due ? h('div', { class: 'small muted' }, 'Due ' + nice(x.due)) : null, x.parts.map(p => h('div', { class: 'small st-' + p.status }, (p.status === 'done' ? 'In: ' : p.status === 'partial' ? 'Partly: ' : 'Not yet: ') + p.label))),
          h('td', null, x.pct === null ? h('span', { class: 'muted' }, 'Not graded') : [h('b', null, Math.round(x.pct) + '%'), h('div', { class: 'small band-' + x.band }, x.band)]),
          h('td', null, x.rubric.map(c => h('div', { class: 'small' }, c.text + ': ' + (c.score === null ? '-' : c.score) + '/' + c.max))), h('td', null, x.comment || '')))))) : h('p', { class: 'muted' }, 'No assignments yet.'),
      evs.length ? [h('h3', null, 'Work done in the Stark apps'), h('ul', null, evs.map(e => h('li', null, h('b', null, e.label + ': '), e.detail)))] : null,
      r.strengths.length ? h('p', null, h('b', null, 'Going well: '), r.strengths.map(c => c.text).join('; ')) : null,
      r.next.length ? h('p', null, h('b', null, 'Next steps: '), r.next.map(c => c.text).join('; ')) : null,
      h('div', { class: 'foot' }, 'Prepared with Stark Classroom Hub on ' + nice(today()) + '. This report stays on the teacher\'s computer unless it is shared with you.'));
  }
  const printCards = sids => printNodes(sids.map(id => reportCard(L.studentReport(S, id))));
  function vReports() {
    const box = h('div'); box.append(tabs([['reports', 'Progress'], ['conference', 'Conference'], ['sub', 'Substitute packet']], 'reports'), h('h1', null, 'Reports'));
    if (!S.students.length) { box.append(h('div', { class: 'card' }, h('p', null, 'Add students first.'))); return box; }
    if (!S.students.some(s => s.id === ui.reportSid)) ui.reportSid = S.students[0].id;
    const sel = h('select', { id: 'rep-student', 'aria-label': 'Student' }, S.students.map(s => h('option', { value: s.id, selected: s.id === ui.reportSid }, s.name)));
    sel.addEventListener('change', () => { ui.reportSid = sel.value; render(); });
    const rep = L.studentReport(S, ui.reportSid), area = h('textarea', { id: 'parent-note', class: 'note', 'aria-label': 'Parent note, you can edit it' }); area.value = L.parentSummary(rep); area.rows = 14;
    box.append(h('div', { class: 'row' }, h('label', { for: 'rep-student' }, 'Student'), sel, btn('Print this report', () => printCards([ui.reportSid])), btn('Print every student', () => printCards(S.students.map(s => s.id)), 'btn-ghost')),
      h('div', { class: 'card' }, h('h2', null, 'Parent-friendly summary'), h('p', { class: 'muted small' }, 'Plain language, only this student, no scores for other children. Edit it, then copy or save.'), area,
        h('div', { class: 'row' }, btn('Copy', () => copy(area.value, area), 'btn-small'), btn('Save as text file', () => download('note-' + slug(rep.name) + '.txt', area.value.replace(/\n/g, '\r\n')), 'btn-ghost btn-small'))), reportCard(rep));
    return box;
  }

  /* ---------- Calendar ---------- */
  function vCalendar() {
    const box = h('div'), c = S.classroom, td = today();
    if (!ui.cal) { const base = c.termStart || td; ui.cal = { y: +base.slice(0, 4), m: +base.slice(5, 7) - 1 }; }
    const cal = ui.cal, items = L.calendarItems(S);
    const move = d => { const x = new Date(Date.UTC(cal.y, cal.m + d, 1)); cal.y = x.getUTCFullYear(); cal.m = x.getUTCMonth(); render(); };
    const title = new Date(Date.UTC(cal.y, cal.m, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const dn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const grid = L.monthGrid(cal.y, cal.m, 1);
    box.append(h('h1', null, 'Term calendar'), h('div', { class: 'row' }, btn('Previous', () => move(-1), 'btn-ghost btn-small'), h('h2', { id: 'cal-title', class: 'grow' }, title), btn('Today', () => { ui.cal = null; render(); }, 'btn-ghost btn-small'), btn('Next', () => move(1), 'btn-ghost btn-small')),
      h('div', { class: 'tablewrap' }, h('table', { class: 'cal' }, h('thead', null, h('tr', null, h('th', { class: 'wk' }, 'Wk'), dn.map(d => h('th', null, d)))),
        h('tbody', null, grid.map(w => { const wk = L.termWeek(S, w[0].iso) || L.termWeek(S, w[6].iso); return h('tr', null, h('td', { class: 'wk' }, wk ? 'W' + wk : ''), w.map(d => h('td', { class: (d.inMonth ? '' : 'out ') + (d.iso === td ? 'today' : '') }, h('div', { class: 'd' }, d.day), (items[d.iso] || []).map(it => h('span', { class: 'ev ev-' + it.kind }, it.title))))); })))));
    const tw = L.termWeeks(S);
    box.append(h('p', { class: 'muted small' }, tw ? c.termName + ' runs ' + nice(c.termStart) + ' to ' + nice(c.termEnd) + ' (' + tw + ' weeks). Set the term dates on the Home page.' : 'Set the term dates on the Home page to see term weeks. Assignment due dates appear here automatically.'));
    const dt = h('input', { type: 'date', id: 'ev-date', value: td }), ti = h('input', { type: 'text', id: 'ev-title', maxlength: 80, placeholder: 'Class trip, unit test, holiday' }), kd = h('select', { id: 'ev-kind' }, [['other', 'Other'], ['test', 'Test'], ['trip', 'Trip'], ['holiday', 'Holiday']].map(k => h('option', { value: k[0] }, k[1])));
    const msg = h('div', { class: 'notice bad', role: 'alert', id: 'ev-err', hidden: true });
    [dt, ti].forEach(x => x.setAttribute('aria-describedby', 'ev-err'));
    box.append(h('div', { class: 'card' }, h('h2', null, 'Add an event'), msg, h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Date', dt, 'ev-date')), h('div', { class: 'grow' }, field('Title', ti, 'ev-title')), h('div', null, field('Type', kd, 'ev-kind'))),
      btn('Add to calendar', () => { const t = L.clip(ti.value, 80); if (!L.isoOk(dt.value) || !t) { msg.textContent = 'Pick a date and give the event a title.'; msg.hidden = false; const f = !L.isoOk(dt.value) ? dt : ti; f.setAttribute('aria-invalid', 'true'); f.focus(); return; } if (S.events.length >= 300) { msg.textContent = 'The calendar is full.'; msg.hidden = false; return; }
        S.events.push({ id: L.newId('e', S.events), date: dt.value, title: t, kind: kd.value }); save(); render(); }),
      S.events.length ? h('ul', { class: 'list' }, S.events.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => h('li', null, h('span', null, nice(e.date) + ': ' + e.title, ' ', h('span', { class: 'chip' }, e.kind)), btn('Remove', () => { S.events = S.events.filter(x => x.id !== e.id); save(); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Remove ' + e.title })))) : null));
    return box;
  }

  function downloadBackup() { const now = new Date(), iso = today() + 'T' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2); S.lastBackup = iso; save(); download('stark-classroomhub-backup-' + slug(S.classroom.name) + '-' + today() + '.json', JSON.stringify(L.buildBackup(S, iso), null, 1), 'application/json'); toast('Backup saved to your downloads folder.'); render(); }
  /* ---------- Backup and restore ---------- */
  function vSafety() {
    const box = h('div'), msg = h('div', { class: 'notice bad', role: 'alert', hidden: true });
    const pick = h('input', { type: 'file', id: 'restorepick', accept: '.json', 'aria-label': 'Choose a backup file', onchange: async e => {
      const f = e.target.files[0]; if (!f) return; msg.hidden = true;
      try { if (f.size > 20 * 1024 * 1024) throw new Error('That file is too big.'); const r = L.readBackup(JSON.parse(await f.text())); if (!r.ok) throw new Error(r.error); ui.restore = { name: f.name, state: r.state, note: r.note }; render(); }
      catch (err) { msg.textContent = err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message; msg.hidden = false; }
    } });
    box.append(h('h1', null, 'Backup and restore'), h('p', { class: 'muted' }, 'Your class lives in this browser, on this computer, and nowhere else: the Hub has no network access at all. A backup is one JSON file you keep. It includes your private notes and attendance, so keep it somewhere safe.'), msg,
      h('div', { class: 'card' }, h('h2', null, 'Save a backup'), h('p', null, S.lastBackup ? 'Last backup: ' + S.lastBackup.replace('T', ' ').slice(0, 16) + '.' : 'No backup saved yet.'),
        h('div', { class: 'row' }, btn('Download class backup', downloadBackup),
          btn('Download grade book (CSV)', () => download('gradebook-' + slug(S.classroom.name) + '.csv', L.gradebookCSV(S), 'text/csv;charset=utf-8'), 'btn-ghost', { disabled: !S.students.length }))),
      h('div', { class: 'card' }, h('h2', null, 'Restore from a backup'), h('p', { class: 'muted' }, 'This replaces the class on this computer with the one in the file. Every name is checked again, so a file cannot bring in surnames.'), field('Backup file', pick, 'restorepick'),
        ui.restore ? h('div', { class: 'notice' }, h('b', null, ui.restore.name), ': ' + ui.restore.state.students.length + ' students, ' + ui.restore.state.assignments.length + ' assignments, class "' + (ui.restore.state.classroom.name || 'unnamed') + '" (' + ui.restore.note + ').', h('div', { class: 'row' }, btn('Replace my class with this backup', () => { S = ui.restore.state; ui.restore = null; ui.grade = null; ui.draft = null; save(); toast('Backup restored.'); render(); }, 'btn-danger'), btn('Cancel', () => { ui.restore = null; render(); }, 'btn-ghost'))) : null),
      XV.shareCard(), IV.sealCard(), IV.installCard(),
      h('div', { class: 'card' }, h('h2', null, 'Start over'), h('p', { class: 'muted' }, 'Removes the class, assignments, grades and results from this browser. Save a backup first.'),
        ui.confirm === 'wipe' ? h('div', { class: 'row' }, btn('Yes, erase everything', () => { S = L.emptyState(); ui.confirm = ''; ui.grade = null; ui.batches = []; save(); toast('Everything was erased.'); render(); }, 'btn-danger'), btn('Keep my class', () => { ui.confirm = ''; render(); }, 'btn-ghost')) : btn('Clear everything', () => { ui.confirm = 'wipe'; render(); }, 'btn-danger')),
      h('div', { class: 'card' }, h('h2', null, 'Privacy'), h('ul', null, h('li', null, 'First names and nicknames only. The roster rejects surnames, emails, numbers and addresses, and so does every import.'), h('li', null, 'No network: the page is built so the browser refuses every outside connection.'), h('li', null, 'Local protections, no tracking: saves are checked after writing and a last good copy is kept, and backup files carry a checksum that is verified before anything is restored.'), h('li', null, 'Parent notes are never sent: you print, copy or hand over each one. The sent log keeps first names, the kind of note and how it was given, never the text.'), h('li', null, 'Quill hand-in zips are checked file by file against their checksums before anything is read from them.')), h('p', { class: 'small muted', id: 'version' }, 'Stark Classroom Hub ' + L.VERSION + '. Backups from versions 1.0 to 1.2 restore here. A backup made by this version also holds your parent-note languages, family languages and sent log; an older Hub would ignore those parts.')));
    return box;
  }

  /* ---------- shell ---------- */
  const TV = SCH.transferViews({ h, btn, L, ui, save, render: () => render(), toast, download, today, slug, st: () => S, backup: downloadBackup });
  const VIEWS = { home: vHome, roster: vRoster, lessons: XV.lessons, plan: vPlan, rubrics: XV.rubrics, attendance: XV.attendance, seating: XV.seating, groups: XV.groups, collect: vCollect, grades: vGrades, standards: XV.standards,
    notes: XV.notes, reports: vReports, insights: IV.insights, pnotes: NV.write, pnbatch: NV.batch, pnlang: NV.lang, pnlog: NV.log, conference: XV.conference, sub: XV.sub, calendar: vCalendar, safety: vSafety, transfer: TV.transfer, datahelp: TV.help, feedback: vFeedback };
  function render() {
    const route = (location.hash.replace(/^#\//, '').split('?')[0]) || 'home', key = VIEWS[route] ? route : 'home';
    if (key !== 'transfer') { ui.imp = null; ui.impErr = ''; }
    const navKey = ALIAS[key] || key, nav = $('#nav'); nav.replaceChildren(...ROUTES.map(r => h('a', { href: '#/' + r[0], 'aria-current': r[0] === navKey ? 'page' : null }, r[1])));
    const main = $('#main'); main.replaceChildren();
    try { main.append(VIEWS[key]()); } catch (e) { errs.push(String(e && e.stack || e)); main.append(h('div', { class: 'notice bad' }, 'Something went wrong drawing this page: ' + e.message)); }
    if (recovered) main.prepend(h('div', { class: 'notice', role: 'status' }, 'The saved class could not be read, so the last good copy was restored. Check that your recent changes are there.'));
    if (safe) main.prepend(h('div', { class: 'notice bad', role: 'alert' }, h('b', null, 'Read-only mode. '), 'The saved class on this computer could not be read, so nothing will be saved or overwritten. You can save the raw data, or start a new empty class (the old data is kept in the browser as a separate copy). ',
      h('div', { class: 'row' }, btn('Export raw data', () => { download('stark-classroomhub-raw-' + today() + '.txt', 'MAIN' + String.fromCharCode(10) + (safe.raw || '') + String.fromCharCode(10, 10) + 'LAST GOOD COPY' + String.fromCharCode(10) + (safe.bak || '') + String.fromCharCode(10)); }, 'btn-ghost btn-small'),
        btn('Start a new empty class', () => { try { localStorage.setItem(KEY + '.corrupt', safe.raw || ''); } catch (e) { /* ignore */ } safe = null; S = L.emptyState(); lastGood = ''; save(); render(); }, 'btn-ghost btn-small')))); 
    if (!storageOk) main.prepend(saveWarn());
    main.querySelectorAll('.tablewrap').forEach(w => { const c = w.querySelector('caption, th'); w.tabIndex = 0; w.setAttribute('role', 'region'); w.setAttribute('aria-label', 'Scrollable table' + (c ? ': ' + c.textContent.trim().slice(0, 40) : '')); });
    document.title = (TITLES[key] || ROUTES.find(r => r[0] === key)[1]) + ' - Stark Classroom Hub';
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); });
  window.addEventListener('error', e => { errs.push(String(e.message)); });
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ } }
  (function init() {
    let t = null; try { t = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    setTheme(t);
    if (E.trial) { $('#trial-badge').hidden = false; $('#foot').append(' ', h('a', { href: E.buy, target: '_blank', rel: 'noopener noreferrer' }, 'Own it forever: buy on itch.io')); }
    $('#theme').addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
    load(); render();
  })();
  SCH.app = { state: () => S, errors: () => errs, render, today, load: () => { load(); render(); }, ui };
})();
