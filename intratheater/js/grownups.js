/* Stark IntraTheater by Stark. Grown-ups (behind the parent PIN):
   deep-dive essays, documentary and film-night planner, hard trivia, family settings. */
(function () {
  'use strict';
  const { h, clear, data, store } = SIT;
  const ES = data.essays;
  const evById = {}; data.events.forEach(e => { evById[e.id] = e; });
  const st = { tab: 'essays', essay: null, themeDraft: '' };
  let el = {};

  /* two-tap confirm buttons instead of blocking dialogs */
  function armBtn(label, armed, fn, cls) {
    let t = 0;
    const b = h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick: () => {
      if (Date.now() - t < 3500) { t = 0; b.textContent = label; fn(); return; }
      t = Date.now(); b.textContent = armed; setTimeout(() => { if (t && Date.now() - t >= 3400) { t = 0; b.textContent = label; } }, 3600);
    } }, label);
    return b;
  }
  SIT.armBtn = armBtn;
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = d => { if (!d) return 'No date yet'; const x = new Date(d + 'T12:00:00'); return isNaN(x) ? d : x.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };

  /* ================= Essays ================= */
  function renderEssays() {
    const box = clear(el.essays);
    if (st.essay) return renderReader(box, ES.find(e => e.id === st.essay));
    const read = SIT.progress('grown').essays;
    box.appendChild(h('p', { class: 'lede' }, ES.length + ' essays for grown-ups and older kids. Each links to moments on the timeline and ends with questions to talk about after a documentary.'));
    box.appendChild(h('div', { class: 'essay-grid' }, ES.map(e => h('button', { type: 'button', class: 'essay-card', onclick: () => { st.essay = e.id; renderEssays(); } },
      h('span', { class: 'date' }, e.era), h('span', { class: 'essay-title' }, e.title), h('span', { class: 'muted' }, e.summary),
      h('span', { class: 'essay-meta' }, '≈ ' + e.minutes + ' min read', read.indexOf(e.id) >= 0 ? h('span', { class: 'badge' }, '✓ Read') : null)))));
  }
  function renderReader(box, e) {
    const read = SIT.progress('grown').essays.indexOf(e.id) >= 0;
    const fullText = () => e.title + '. ' + e.summary + ' ' + e.sections.map(s => s.h + '. ' + s.p.join(' ')).join(' ');
    box.appendChild(h('article', { class: 'essay' },
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-back', onclick: () => { st.essay = null; SIT.stopSpeaking(); renderEssays(); } }, '⬅ All essays'), SIT.speakButton(fullText, 'Read aloud')),
      h('p', { class: 'date' }, e.era + ' · ≈ ' + e.minutes + ' min read'),
      h('h2', { class: 'essay-h', tabindex: '-1' }, e.title),
      h('p', { class: 'essay-summary' }, e.summary),
      e.sections.map(s => [h('h3', null, s.h), s.p.map(p => h('p', null, p))]),
      h('aside', { class: 'card related' }, h('h3', null, 'On the timeline'),
        h('div', { class: 'chips' }, e.related.filter(id => evById[id]).map(id => h('a', { class: 'chip', href: '#/history?e=' + id }, evById[id].icon + ' ' + evById[id].title + ' · ' + evById[id].date)))),
      h('aside', { class: 'card related' }, h('h3', null, 'Talk about it'), h('ul', null, e.discuss.map(q => h('li', null, q)))),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-primary', 'aria-pressed': read ? 'true' : 'false', onclick: () => {
          const p = SIT.progress('grown'); const i = p.essays.indexOf(e.id);
          if (i >= 0) p.essays.splice(i, 1); else p.essays.push(e.id);
          SIT.saveProgress('grown'); renderEssays();
        } }, read ? '✓ Read' : 'Mark as read'),
        h('button', { type: 'button', class: 'btn', onclick: () => { st.themeDraft = e.id; setTab('planner'); } }, '🍿 Plan a film night on this'))));
    box.querySelector('.essay-h').focus();
  }

  /* ================= Film-night planner ================= */
  let plan = store.get('planner', { nights: [] });
  const savePlan = () => store.set('planner', plan);
  let noteTimer = 0;
  const saveSoon = () => { clearTimeout(noteTimer); noteTimer = setTimeout(savePlan, 400); };
  function themeSelect(id, val) {
    const sel = h('select', { id }, h('option', { value: '' }, 'No theme'), ES.map(e => h('option', { value: e.id }, e.title)));
    sel.value = val || '';
    return sel;
  }
  function renderPlanner() {
    const box = clear(el.planner);
    const date = h('input', { type: 'date', id: 'pn-date', value: today() });
    const title = h('input', { type: 'text', id: 'pn-title', maxlength: 80, placeholder: 'e.g. Ancient Egypt night' });
    const theme = themeSelect('pn-theme', st.themeDraft);
    const aud = h('select', { id: 'pn-aud' }, h('option', { value: 'family' }, 'Whole family'), h('option', { value: 'grown' }, 'Grown-ups'), h('option', { value: 'kids' }, 'Kids'));
    if (st.themeDraft && !title.value) { const e = ES.find(x => x.id === st.themeDraft); if (e) title.value = e.title + ' night'; }
    st.themeDraft = '';
    box.appendChild(h('details', { class: 'card', open: !plan.nights.length || theme.value !== '' },
      h('summary', null, h('strong', null, '➕ Plan a new film night')),
      h('div', { class: 'form-grid compact' },
        h('label', { for: 'pn-date' }, 'Date'), date, h('label', { for: 'pn-title' }, 'Title'), title,
        h('label', { for: 'pn-theme' }, 'History theme'), theme, h('label', { for: 'pn-aud' }, 'Who’s watching'), aud),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
        plan.nights.push({ id: SIT.uid(), date: date.value, title: title.value.trim() || (theme.value ? ES.find(x => x.id === theme.value).title + ' night' : 'Film night'), theme: theme.value, audience: aud.value, notes: '', films: [] });
        savePlan(); renderPlanner(); SIT.toast('Film night added. Add films or documentaries to it below.');
      } }, 'Add film night'), h('span', { class: 'muted small' }, 'Notes, films and documentaries go on the night once it is added.'))));
    const t = today();
    const upcoming = plan.nights.filter(n => !n.date || n.date >= t).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    const past = plan.nights.filter(n => n.date && n.date < t).sort((a, b) => b.date.localeCompare(a.date));
    box.appendChild(h('h2', null, 'Coming up'));
    if (!upcoming.length) box.appendChild(h('p', { class: 'muted' }, 'Nothing planned yet.'));
    upcoming.forEach(n => box.appendChild(nightCard(n)));
    if (past.length) { box.appendChild(h('h2', null, 'Past nights')); past.forEach(n => box.appendChild(nightCard(n))); }
    const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: ev => {
      const f = ev.target.files[0]; if (!f) return;
      f.text().then(txt => { const o = JSON.parse(txt); if (!SIT.safe.validPlan(o)) throw new Error('bad'); plan = o; savePlan(); renderPlanner(); SIT.toast('Planner restored.'); })
        .catch(() => SIT.toast('That file is not a planner backup.'));
      ev.target.value = '';
    } });
    box.appendChild(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: () => SIT.download('film-nights-' + t + '.txt', planText()) }, '📝 Download notes (.txt)'),
      h('button', { type: 'button', class: 'btn', onclick: () => SIT.download('film-nights-backup-' + t + '.json', JSON.stringify(plan, null, 1), 'application/json') }, '💾 Back up planner (.json)'),
      h('button', { type: 'button', class: 'btn', onclick: () => restore.click() }, '📂 Restore backup'), restore));
  }
  function nightCard(n) {
    const essay = ES.find(e => e.id === n.theme);
    const filmTitle = h('input', { type: 'text', maxlength: 100, placeholder: 'Film or documentary title', 'aria-label': 'Film or documentary title' });
    const filmYear = h('input', { type: 'number', min: 1880, max: 2100, placeholder: 'Year', 'aria-label': 'Year', class: 'year' });
    const filmKind = h('select', { 'aria-label': 'Kind' }, ['Documentary', 'Film', 'Series episode', 'Short'].map(k => h('option', { value: k }, k)));
    const addFilm = () => {
      const tt = filmTitle.value.trim(); if (!tt) { filmTitle.focus(); return; }
      n.films.push({ id: SIT.uid(), title: tt, year: filmYear.value, kind: filmKind.value, notes: '', watched: false, rating: 0 });
      savePlan(); renderPlanner();
    };
    filmTitle.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addFilm(); } });
    const nightNotes = h('textarea', { rows: 2, value: n.notes || '', 'aria-label': 'Notes for ' + n.title, oninput: e => { n.notes = e.target.value; saveSoon(); } });
    return h('article', { class: 'card night' },
      h('div', { class: 'night-head' },
        h('div', null, h('p', { class: 'date' }, fmtDate(n.date)), h('h3', null, n.title),
          h('p', { class: 'tags' }, h('span', { class: 'tag plain' }, { family: 'Whole family', grown: 'Grown-ups', kids: 'Kids' }[n.audience] || 'Whole family'),
            essay ? h('button', { type: 'button', class: 'tag link', onclick: () => { st.essay = essay.id; setTab('essays'); } }, '📚 ' + essay.title) : null)),
        armBtn('Delete', 'Tap again to delete', () => { plan.nights = plan.nights.filter(x => x !== n); savePlan(); renderPlanner(); }, 'btn-small')),
      essay ? h('details', { class: 'discuss' }, h('summary', null, 'Questions for after the film'), h('ul', null, essay.discuss.map(q => h('li', null, q)))) : null,
      h('ul', { class: 'films' }, n.films.map(f => filmRow(n, f))),
      h('div', { class: 'row add-film' }, filmTitle, filmYear, filmKind, h('button', { type: 'button', class: 'btn', onclick: addFilm }, 'Add')),
      h('label', { class: 'small muted' }, 'Night notes'), nightNotes);
  }
  function filmRow(n, f) {
    const stars = h('span', { class: 'stars', role: 'group', 'aria-label': 'Rating for ' + f.title });
    for (let i = 1; i <= 5; i++) stars.appendChild(h('button', { type: 'button', class: 'star' + (i <= f.rating ? ' on' : ''), 'aria-label': i + (i === 1 ? ' star' : ' stars'), 'aria-pressed': i === f.rating ? 'true' : 'false',
      onclick: () => { f.rating = f.rating === i ? 0 : i; savePlan(); renderPlanner(); } }, '★'));
    return h('li', { class: 'film' + (f.watched ? ' watched' : '') },
      h('div', { class: 'film-head' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!f.watched, onchange: e => { f.watched = e.target.checked; savePlan(); renderPlanner(); } }),
          h('span', null, h('strong', null, f.title), f.year ? ' (' + f.year + ')' : '', h('small', null, ' · ' + f.kind))),
        stars,
        armBtn('✕', 'Remove?', () => { n.films = n.films.filter(x => x !== f); savePlan(); renderPlanner(); }, 'btn-small')),
      h('textarea', { rows: 2, value: f.notes || '', placeholder: 'Film notes: favourite scene, what was accurate, what to look up…', 'aria-label': 'Notes on ' + f.title, oninput: e => { f.notes = e.target.value; saveSoon(); } }));
  }
  function planText() {
    const out = ['Stark IntraTheater by Stark: film-night notes', ''];
    plan.nights.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(n => {
      out.push('== ' + fmtDate(n.date) + ': ' + n.title + ' ==');
      const e = ES.find(x => x.id === n.theme); if (e) out.push('Theme: ' + e.title);
      if (n.notes) out.push('Notes: ' + n.notes);
      n.films.forEach(f => {
        out.push('- ' + f.title + (f.year ? ' (' + f.year + ')' : '') + ' [' + f.kind + ']' + (f.watched ? ' watched' : '') + (f.rating ? ' ' + '★'.repeat(f.rating) : ''));
        if (f.notes) out.push('    ' + f.notes.replace(/\n/g, '\n    '));
      });
      out.push('');
    });
    return out.join('\n');
  }

  /* ================= Hard trivia ================= */
  function renderTrivia() {
    const box = clear(el.trivia);
    const best = SIT.progress('grown').best['hard-trivia'];
    box.appendChild(h('div', { class: 'quiz-menu' },
      h('button', { type: 'button', class: 'menu-card', onclick: () => {
        const run = () => SIT.runQuiz(box, { questions: SIT.sample(data.triviaHard, 12), bestKey: 'hard-trivia', again: run, onDone: renderTrivia });
        run();
      } }, h('span', { class: 'menu-title' }, '🎓 Hard mode: 12 questions'), h('span', { class: 'muted' }, data.triviaHard.length + ' questions on history and geography, one try each, with the story behind every answer.'),
        best ? h('span', { class: 'badge' }, 'Best: ' + best.score + '/' + best.total) : null),
      h('a', { class: 'menu-card', href: '#/geo?tab=quiz' }, h('span', { class: 'menu-title' }, '🌍 Geography, grown-up level'), h('span', { class: 'muted' }, 'All 193 capitals, with distractors from the same continent.'))));
  }

  /* ================= Family settings ================= */
  function renderSettings() {
    const box = clear(el.settings);
    const fam = SIT.family(); const set = fam.settings;
    const save = () => { SIT.saveFamily(); SIT.emit('mode'); };

    const kidsList = h('div', { class: 'kid-profiles' });
    fam.kids.forEach(k => {
      const av = h('select', { 'aria-label': 'Avatar for ' + k.name, onchange: e => { k.avatar = e.target.value; save(); } }, SIT.AVATARS.map(a => h('option', { value: a }, a)));
      av.value = k.avatar;
      kidsList.appendChild(h('div', { class: 'row kid-profile' }, av,
        h('input', { type: 'text', value: k.name, maxlength: 20, 'aria-label': 'Name', onchange: e => { k.name = e.target.value.trim() || k.name; save(); } }),
        h('span', { class: 'muted small' }, '⭐ ' + (SIT.progress(k.id).stars || 0)),
        fam.kids.length > 1 ? armBtn('Remove', 'Tap again to remove', () => {
          fam.kids = fam.kids.filter(x => x !== k); if (fam.activeKid === k.id) fam.activeKid = fam.kids[0].id;
          SIT.resetProgress(k.id); save(); renderSettings();
        }, 'btn-small') : null,
        armBtn('Reset progress', 'Tap again to reset', () => { SIT.resetProgress(k.id); renderSettings(); SIT.toast(k.name + '’s progress was reset.'); }, 'btn-small')));
    });
    const newPin = h('input', { type: 'password', inputmode: 'numeric', maxlength: 8, id: 'set-pin1', autocomplete: 'new-password' });
    const newPin2 = h('input', { type: 'password', inputmode: 'numeric', maxlength: 8, id: 'set-pin2', autocomplete: 'new-password' });
    const idle = h('select', { id: 'set-idle', onchange: e => { set.idleLockMin = +e.target.value; save(); } }, [[5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [0, 'Never']].map(o => h('option', { value: String(o[0]) }, o[1])));
    idle.value = String(set.idleLockMin);
    const restore = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: ev => {
      const f = ev.target.files[0]; if (!f) return;
      f.text().then(txt => SIT.safe.check(txt)).then(r => {
        if (!r.ok) { SIT.toast(r.message); return; }
        const o = r.backup;
        if (SIT.store.damaged().length) { SIT.toast('Saved data is in safe mode, so nothing can be restored over it.'); return; }
        Object.keys(o.data).forEach(k => store.set(k, o.data[k]));
        SIT.toast('Restored' + (r.checksum ? '' : ' (no checksum, validated)') + '. Reloading…'); setTimeout(() => location.reload(), 900);
      }).catch(() => SIT.toast('That file is not a Stark IntraTheater backup.'));
      ev.target.value = '';
    } });

    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Kids profiles'),
      h('p', { class: 'muted' }, 'Each child has their own stars, stories, drawings and quiz records. Kids can switch between their own profiles without the PIN.'),
      kidsList,
      h('button', { type: 'button', class: 'btn', onclick: () => {
        const id = 'kid' + SIT.uid(); fam.kids.push({ id, name: 'Explorer ' + (fam.kids.length + 1), avatar: SIT.AVATARS[fam.kids.length % SIT.AVATARS.length] }); save(); renderSettings();
      } }, '➕ Add a kid')));
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Parent PIN'),
      h('p', { class: 'muted' }, 'The app always starts in Kids mode. Leaving it needs this PIN. It is a family lock, not strong security: anyone who can open the browser’s developer tools could get around it.'),
      h('div', { class: 'form-grid' }, h('label', { for: 'set-pin1' }, 'New PIN (4–8 digits)'), newPin, h('label', { for: 'set-pin2' }, 'Repeat new PIN'), newPin2),
      h('button', { type: 'button', class: 'btn', onclick: () => {
        if (!SIT.validPin(newPin.value)) { SIT.toast('Use 4 to 8 digits.'); return; }
        if (newPin.value !== newPin2.value) { SIT.toast('The two PINs are different.'); return; }
        SIT.setPin(newPin.value); newPin.value = newPin2.value = ''; SIT.toast('Parent PIN changed.');
      } }, 'Change PIN'),
      h('div', { class: 'form-grid' }, h('label', { for: 'set-idle' }, 'Lock back to Kids mode after'), idle)));
    if (SIT.controlsCard) box.appendChild(SIT.controlsCard(renderSettings));
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Theater and look'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!set.kidsOpenFiles, onchange: e => { set.kidsOpenFiles = e.target.checked; save(); } }), h('span', null, 'Let kids open video files themselves')),
      h('div', { class: 'pick-row', role: 'group', 'aria-label': 'Look' },
        h('button', { type: 'button', class: 'menu-card', 'aria-pressed': set.theme !== 'light' ? 'true' : 'false', onclick: () => { set.theme = 'dark'; save(); SIT.applyTheme(); renderSettings(); } }, '🌙 Theater (dark)'),
        h('button', { type: 'button', class: 'menu-card', 'aria-pressed': set.theme === 'light' ? 'true' : 'false', onclick: () => { set.theme = 'light'; save(); SIT.applyTheme(); renderSettings(); } }, '☀️ Lights up (light)')),
      armBtn('Forget saved video positions, notes and Family Night', 'Tap again to forget them', () => { SIT.theater.forget(); SIT.toast('Theater memory cleared.'); }, 'btn-small')));
    if (SIT.autosaveCard) box.appendChild(SIT.autosaveCard());
    box.appendChild(h('section', { class: 'card' }, h('h2', null, 'Your data'),
      h('p', { class: 'muted' }, 'Everything lives in this browser on this computer: profiles, progress, notes and the planner. Nothing is sent anywhere. Back it up to move it to another computer or browser.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: () => {
          const o = { app: 'stark-intratheater', version: 1, saved: new Date().toISOString(), data: {} };
          store.keys().forEach(k => { o.data[k] = store.get(k, null); });
          SIT.safe.seal(o).then(sealed => SIT.download('stark-intratheater-backup-' + today() + '.json', JSON.stringify(sealed), 'application/json'));
        } }, '💾 Back up everything'),
        h('button', { type: 'button', class: 'btn', onclick: () => restore.click() }, '📂 Restore a backup'), restore,
        armBtn('Erase everything', 'Tap again: erase all data', async () => { if (SIT.autosave) await SIT.autosave.forget(); store.keys().forEach(k => store.del(k)); location.reload(); }, 'btn-danger'))));
    box.appendChild(h('p', { class: 'fine' }, 'Stark IntraTheater by Stark · version ' + SIT.VERSION + ' · works offline, no accounts, nothing uploaded. Saves are checked and keep a last-good copy, backups carry a checksum, and nothing is tracked.'));
  }

  /* ================= view ================= */
  function setTab(t) {
    st.tab = t;
    el.tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === t ? 'true' : 'false'));
    ['essays', 'planner', 'trivia', 'classroom', 'settings'].forEach(k => { el[k].hidden = k !== t; });
    ({ essays: renderEssays, planner: renderPlanner, trivia: renderTrivia, classroom: () => SIT.classroom.render(el.classroom), settings: renderSettings })[t]();
  }
  function mount(root) {
    const tab = (id, label) => h('button', { type: 'button', 'data-tab': id, 'aria-pressed': 'false', onclick: () => setTab(id) }, label);
    el.tabs = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Grown-up sections' },
      tab('essays', '📚 Essays'), tab('planner', '🍿 Film nights'), tab('trivia', '🎓 Hard trivia'), tab('classroom', '🏫 Classroom'), tab('settings', '⚙️ Family settings'));
    ['essays', 'planner', 'trivia', 'classroom', 'settings'].forEach(k => { el[k] = h('div', { class: 'g-' + k, hidden: true }); });
    root.appendChild(h('header', { class: 'view-head' }, h('h1', null, 'Grown-ups'),
      h('p', { class: 'lede' }, 'History essays, film nights, hard trivia, the classroom and family settings.'),
      h('button', { type: 'button', class: 'btn', onclick: () => SIT.lockToKids() }, '🔒 Back to Kids mode')));
    root.appendChild(el.tabs);
    ['essays', 'planner', 'trivia', 'classroom', 'settings'].forEach(k => root.appendChild(el[k]));
  }
  SIT.view('grown', {
    title: 'Grown-ups', grownOnly: true, mount,
    show(r) { if (r.sub && el[r.sub]) st.tab = r.sub; setTab(st.tab); }
  });
})();
