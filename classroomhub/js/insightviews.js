/* Stark Classroom Hub 1.2: screens for Insights, the command palette (Ctrl+K) and sealed backups.
   Logic lives in insight.js. Text is always set as text nodes. */
(function (root) {
  'use strict';
  const SCH = root.SCH = root.SCH || {};
  const NS = 'http://www.w3.org/2000/svg';
  SCH.insightViews = function (X) {
    const { h, btn, field, L, ui, save, render, toast, download, copy, nice, today, slug } = X;
    const I = SCH.insight, S = () => X.st();
    const svg = (tag, attrs, kids) => { const e = document.createElementNS(NS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); (kids || []).forEach(c => e.append(c)); return e; };

    /* ---------- charts ---------- */
    function lineChart(title, points, labels, summary) {
      const W = 520, H = 150, rg = I.niceRange(points), sp = I.sparkPath(points, W, H, 18, rg); sp.pts.forEach(q => { q[0] = Math.round((34 + (q[0] - 18) * (W - 48) / (W - 36)) * 10) / 10; }); sp.d = sp.pts.map((q, i) => (i ? 'L' : 'M') + q[0] + ' ' + q[1]).join(' ');
      const wrap = h('figure', { class: 'chart' });
      if (!points.length) { wrap.append(h('p', { class: 'muted' }, 'Not enough data yet.')); return wrap; }
      const kids = []; [rg[0], (rg[0] + rg[1]) / 2, rg[1]].forEach(v => { const y = 18 + (H - 36) * (1 - (v - rg[0]) / (rg[1] - rg[0])); kids.push(svg('line', { x1: 34, x2: W - 14, y1: y, y2: y, class: 'grid-line' }), svg('text', { x: 4, y: y + 4, class: 'axis' }, [document.createTextNode(Math.round(v) + '%')])); });
      const area = sp.pts.length > 1 ? svg('path', { d: sp.d + ' L' + sp.pts[sp.pts.length - 1][0] + ' ' + (H - 18) + ' L' + sp.pts[0][0] + ' ' + (H - 18) + ' Z', class: 'area' }) : null;
      if (area) kids.push(area);
      kids.push(svg('path', { d: sp.d, class: 'line', pathLength: 100 }));
      sp.pts.forEach((p, i) => { const c = svg('circle', { cx: p[0], cy: p[1], r: 4, class: 'dot' }); c.append(svg('title', {}, [document.createTextNode(labels[i] + ': ' + Math.round(points[i]) + '%')])); kids.push(c); });
      const el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': title + '. ' + summary, class: 'chart-svg' }, kids);
      const rows = points.map((v, i) => h('tr', null, h('td', null, labels[i]), h('td', { class: 'num' }, Math.round(v) + '%')));
      wrap.append(h('figcaption', null, h('b', null, title), h('span', { class: 'muted small' }, ' ' + summary)), el,
        h('details', { class: 'small' }, h('summary', null, 'Show the numbers'), h('table', null, h('thead', null, h('tr', null, h('th', null, 'When'), h('th', { class: 'num' }, 'Value'))), h('tbody', null, rows))));
      return wrap;
    }

    /* ---------- Insights view ---------- */
    function vInsights() {
      const st = S(), td = today(), box = h('div');
      box.append(h('h1', null, 'Insights'), h('p', { class: 'muted' }, 'Worked out on this computer from your own records: no network, no accounts. These are prompts for your professional judgement, not verdicts. Press Ctrl+K (or Cmd+K) anywhere to jump to a student, page or action.'));
      if (!st.students.length) { box.append(h('div', { class: 'card' }, h('p', null, 'Add students and some attendance or grades first, or load the sample class on the Home page.'))); return box; }
      const att = I.attendanceSeries(st), gr = I.gradeSeries(st);
      const attSum = att.length ? 'Daily attendance across ' + att.length + ' recorded days, latest ' + Math.round(att[att.length - 1].rate) + '%.' : '';
      const grSum = gr.length ? 'Class average per assignment, latest ' + Math.round(gr[gr.length - 1].mean) + '%.' : '';
      box.append(h('div', { class: 'grid2' },
        h('div', { class: 'card', id: 'pulse-att' }, h('h2', null, 'Attendance pulse'), lineChart('Attendance', att.map(x => x.rate), att.map(x => nice(x.date)), attSum)),
        h('div', { class: 'card', id: 'pulse-grades' }, h('h2', null, 'Grade pulse'), lineChart('Class average', gr.map(x => x.mean), gr.map(x => x.title), grSum))));
      const w = I.watchlist(st, td);
      box.append(h('div', { class: 'card', id: 'watch' }, h('h2', null, 'Worth a look'),
        w.look.length ? h('ul', { class: 'list watch' }, w.look.map(x => h('li', null, h('div', null, h('b', null, x.name), h('ul', { class: 'small' }, x.reasons.map(r => h('li', null, r)))), h('a', { href: '#/conference', onclick: () => { ui.confSid = x.sid; ui.reportSid = x.sid; } }, 'Open conference sheet')))) : h('p', { class: 'muted' }, 'Nothing stands out right now.'),
        w.bright.length ? [h('h3', null, 'Bright spots'), h('ul', { class: 'list' }, w.bright.map(x => h('li', null, h('div', null, h('b', null, x.name), h('div', { class: 'small muted' }, x.note)))))] : null,
        h('p', { class: 'small muted' }, 'Signals used: two or more absences in the last five registers, attendance under 90% after ten days, a latest result 15 or more points below the earlier average, and past-due work.')));
      box.append(pickerCard(), whatIf(), commentCard());
      return box;
    }

    /* ---------- fair picker (cold call) ---------- */
    const pk = { bag: [], last: null, seen: [] };
    function pickerCard() {
      const st = S(), td = today(), only = h('input', { type: 'checkbox', id: 'pk-present', checked: true });
      const big = h('div', { class: 'pick-name', id: 'pk-name', 'aria-hidden': 'true' }, '?'), said = h('p', { id: 'pk-live', class: 'sr-only', role: 'status', 'aria-live': 'polite' });
      const left = h('p', { class: 'small muted', id: 'pk-left' });
      const nm = id => (st.students.find(s => s.id === id) || {}).name || '';
      const info = pool => { left.textContent = pool.length ? (I.roundLeft(pool, pk.bag, pk.seen) + ' still to be picked this round, out of ' + pool.length + (only.checked ? ' present today.' : ' students.')) : 'Nobody to pick: add students, or untick "present today only".'; };
      let rolling = false;
      const pick = () => {
        if (rolling) return;
        const pool = I.pickPool(st, td, only.checked); if (!pool.length) { info(pool); return; }
        const r = I.pickNext(pool, pk.bag, pk.last); pk.bag = r.bag; pk.last = r.id; pk.seen = (r.round ? [] : pk.seen).concat(r.id);
        const name = nm(r.id), show = () => { big.textContent = name; said.textContent = name + (r.round ? ', first pick of a new round.' : '.'); info(pool); };
        if (!root.matchMedia || root.matchMedia('(prefers-reduced-motion: reduce)').matches || pool.length < 2) { show(); return; }
        let n = 0; rolling = true; big.classList.add('rolling'); const tick = () => { big.textContent = nm(pool[I.randBelow(pool.length)]); if (++n < 12) setTimeout(tick, 40 + n * 12); else { rolling = false; big.classList.remove('rolling'); show(); } }; tick();
      };
      /* changing who is in the pool keeps the round: students already picked this round wait for the next one */
      only.addEventListener('change', () => { const pool = I.pickPool(st, td, only.checked); pk.bag = I.refillBag(pool, pk.seen); info(pool); });
      info(I.pickPool(st, td, only.checked));
      return h('div', { class: 'card', id: 'picker' }, h('h2', null, 'Fair picker'), h('p', { class: 'muted small' }, 'Calls on students at random, but fairly: everyone is picked once before anyone is picked again, never the same student twice in a row. It uses your browser\'s cryptographic random numbers and saves nothing.'),
        big, said, h('div', { class: 'row' }, btn('Pick a student', pick), h('label', { for: 'pk-present' }, only, ' Present today only')), left);
    }

    /* ---------- what-if simulator ---------- */
    function whatIf() {
      const st = S(), card = h('div', { class: 'card', id: 'whatif' }, h('h2', null, 'What-if grade simulator'));
      if (!st.assignments.length) { card.append(h('p', { class: 'muted' }, 'Plan an assignment to try what-if scores.')); return card; }
      const stu = h('select', { id: 'wi-student', 'aria-label': 'Student' }, st.students.map(s => h('option', { value: s.id }, s.name)));
      const asg = h('select', { id: 'wi-assign', 'aria-label': 'Assignment' }, st.assignments.map(a => h('option', { value: a.id }, a.title)));
      const rng = h('input', { type: 'range', id: 'wi-score', min: 0, max: 100, step: 1, value: 75, 'aria-label': 'Possible result on this assignment, percent' });
      const tgt = h('input', { type: 'number', id: 'wi-target', min: 1, max: 100, value: 70, 'aria-label': 'Overall target, percent' });
      const out = h('div', { id: 'wi-out', role: 'status', 'aria-live': 'polite' }), need = h('div', { id: 'wi-need', role: 'status', 'aria-live': 'polite' });
      const calc = () => {
        const sid = stu.value, aid = asg.value, v = +rng.value, now = L.finalGrade(st, sid).pct, nxt = I.overallWith(st, sid, aid, v);
        out.replaceChildren(h('div', { class: 'big' }, nxt === null ? '-' : nxt + '%'), h('div', { class: 'small muted' }, 'If ' + (st.students.find(s => s.id === sid) || {}).name + ' scores ' + v + '% on this assignment. Now: ' + (now === null ? 'not graded' : now + '%') + (nxt !== null && now !== null ? ' (' + (nxt - now >= 0 ? '+' : '') + Math.round((nxt - now) * 10) / 10 + ')' : '') + '. Band would be ' + L.band(nxt) + '.'));
        const t = +tgt.value, n = t > 0 ? I.neededFor(st, sid, aid, t) : null;
        need.textContent = !n ? '' : n.already ? 'The ' + t + '% target is already met whatever this assignment scores.' : n.reachable ? 'To reach ' + t + '% overall, this assignment needs ' + Math.ceil(n.pct) + '% or more.' : 'The ' + t + '% target cannot be reached with this assignment alone (it would need ' + Math.ceil(n.pct) + '%).';
      };
      [stu, asg, rng, tgt].forEach(e => e.addEventListener('input', calc));
      card.append(h('p', { class: 'muted small' }, 'Slide a possible result and watch the weighted overall move. Nothing is saved.'),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Student', stu, 'wi-student')), h('div', { class: 'grow' }, field('Assignment', asg, 'wi-assign'))),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Possible result on it', rng, 'wi-score')), h('div', null, field('Overall target %', tgt, 'wi-target'))), out, need);
      calc(); return card;
    }

    /* ---------- comment draft ---------- */
    function commentCard() {
      const st = S(), stu = h('select', { id: 'cd-student', 'aria-label': 'Student' }, st.students.map(s => h('option', { value: s.id }, s.name)));
      const ta = h('textarea', { id: 'cd-text', class: 'note', rows: 6, 'aria-label': 'Comment draft, you can edit it' });
      const fill = () => { ta.value = I.commentDraft(st, stu.value, today()); };
      stu.addEventListener('change', fill); fill();
      return h('div', { class: 'card', id: 'comment' }, h('h2', null, 'Comment draft'), h('p', { class: 'muted small' }, 'Written from the record by fixed rules (results, trend, rubric strengths, attendance, past-due work). It is a starting point: read it, edit it, make it yours.'),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Student', stu, 'cd-student'))), field('Draft', ta, 'cd-text'),
        h('div', { class: 'row' }, btn('Copy', () => copy(ta.value, ta), 'btn-small'), btn('Save as text file', () => download('comment-' + slug((st.students.find(s => s.id === stu.value) || {}).name || 'student') + '.txt', ta.value.replace(/\n/g, '\r\n')), 'btn-ghost btn-small')));
    }

    /* ---------- sealed backup card (Backup page) ---------- */
    function sealCard() {
      const msg = h('div', { class: 'notice bad', role: 'alert', hidden: true }), ok = h('div', { class: 'notice', role: 'status', hidden: true });
      const pass = h('input', { type: 'password', id: 'seal-pass', autocomplete: 'new-password', minlength: 12, 'aria-describedby': 'seal-help' });
      const file = h('input', { type: 'file', id: 'seal-file', accept: '.json,.hubvault', 'aria-label': 'Choose a sealed backup file' });
      const fail = t => { ok.hidden = true; msg.textContent = t; msg.hidden = false; };
      const card = h('div', { class: 'card', id: 'seal' }, h('h2', null, 'Sealed backup (encrypted)'),
        h('p', { class: 'muted', id: 'seal-help' }, I.cryptoOk() ? 'Locks the whole class, including private notes and attendance, with your passphrase (AES-256-GCM, key from PBKDF2-SHA256, 600,000 rounds). The passphrase is never stored or sent anywhere. If you forget it, the file cannot be opened by anyone, including Stark.' : 'This browser has no WebCrypto, so sealed backups are not available here.'), msg, ok,
        field('Passphrase (12 or more characters)', pass, 'seal-pass'),
        h('div', { class: 'row' }, btn('Download sealed backup', async () => {
          msg.hidden = true; ok.hidden = true;
          try { const now = new Date(), iso = today() + 'T' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2); const o = await I.sealBackup(JSON.stringify(L.buildBackup(S(), iso)), pass.value);
            S().lastBackup = iso; save(); download('stark-classroomhub-sealed-' + slug(S().classroom.name) + '-' + today() + '.hubvault', JSON.stringify(o), 'application/json'); ok.textContent = 'Sealed backup saved. Keep the passphrase safe.'; ok.hidden = false; pass.value = ''; }
          catch (e) { fail(e.message); } }, '', { disabled: !I.cryptoOk() })),
        h('h3', null, 'Open a sealed backup'), field('Sealed file', file, 'seal-file'),
        h('div', { class: 'row' }, btn('Unlock and preview', async () => {
          msg.hidden = true; ok.hidden = true; const f = file.files[0]; if (!f) return fail('Choose a sealed backup file first.');
          try { if (f.size > 25 * 1024 * 1024) throw new Error('That file is too big.'); const o = JSON.parse(await f.text()); const r = await I.openBackup(o, pass.value); if (!r.ok) throw new Error(r.error);
            const b = L.readBackup(JSON.parse(r.text)); if (!b.ok) throw new Error(b.error); ui.restore = { name: f.name, state: b.state, note: b.note + ', unlocked' }; pass.value = ''; render(); }
          catch (e) { fail(e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message); } }, 'btn-ghost', { disabled: !I.cryptoOk() })));
      return card;
    }

    /* ---------- command palette ---------- */
    let pal = null, lastFocus = null;
    function commands() {
      const st = S(), go = hash => () => { location.hash = hash; }, list = [];
      [['home', 'Home'], ['roster', 'Roster'], ['lessons', 'Lessons and units'], ['plan', 'Assignments'], ['attendance', 'Attendance register'], ['seating', 'Seating chart'], ['groups', 'Groups'], ['collect', 'Collect results'], ['grades', 'Grade book'], ['standards', 'Standards'], ['notes', 'Private notes'], ['reports', 'Progress reports'], ['conference', 'Conference reports'], ['sub', 'Substitute packet'], ['calendar', 'Calendar'], ['insights', 'Insights'], ['safety', 'Backup and restore'], ['rubrics', 'Rubric library']]
        .forEach(r => list.push({ label: 'Go to ' + r[1], kind: 'Page', run: go('#/' + r[0]) }));
      st.students.forEach(s => {
        list.push({ label: s.name + ': progress report', kind: 'Student', keys: 'report', run: () => { ui.reportSid = s.id; go('#/reports')(); render(); } });
        list.push({ label: s.name + ': conference sheet', kind: 'Student', keys: 'conference parent', run: () => { ui.reportSid = s.id; ui.confSid = s.id; go('#/conference')(); render(); } });
      });
      st.assignments.forEach(a => list.push({ label: 'Grade: ' + a.title, kind: 'Assignment', keys: 'assignment score', run: () => { ui.grade = st.students.length ? { aid: a.id, sid: st.students[0].id } : null; go('#/grades')(); render(); } }));
      st.units.forEach(u => list.push({ label: 'Unit: ' + u.title, kind: 'Unit', run: go('#/lessons') }));
      list.push({ label: 'Switch light and dark theme', kind: 'Action', keys: 'theme dark light', run: () => { const t = document.getElementById('theme'); if (t) t.click(); } });
      list.push({ label: 'Print this page', kind: 'Action', keys: 'print', run: () => { try { window.print(); } catch (e) { toast('Printing is not available here.'); } } });
      return list;
    }
    function closePalette() { if (!pal) return; pal.root.remove(); pal = null; document.removeEventListener('keydown', trapKeys, true); if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* gone */ } } }
    function trapKeys(e) {
      if (!pal) return;
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      else if (e.key === 'Tab') { e.preventDefault(); pal.input.focus(); }
    }
    function openPalette() {
      if (pal) { pal.input.focus(); return; }
      lastFocus = document.activeElement;
      const all = commands(); let shown = [], sel = 0;
      const input = h('input', { type: 'text', id: 'pal-input', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false', placeholder: 'Type a student, page or action', 'aria-label': 'Command palette' });
      const listEl = h('ul', { id: 'pal-list', role: 'listbox', 'aria-label': 'Results' }), live = h('div', { class: 'sr', role: 'status', 'aria-live': 'polite' });
      const paint = () => {
        shown = input.value.trim() ? I.fuzzyRank(input.value, all, 8) : all.slice(0, 8);
        if (sel >= shown.length) sel = Math.max(0, shown.length - 1);
        listEl.replaceChildren(...shown.map((c, i) => h('li', { id: 'pal-' + i, role: 'option', 'aria-selected': i === sel ? 'true' : 'false', class: i === sel ? 'on' : '', onmousedown: ev => { ev.preventDefault(); run(i); } }, h('span', null, c.label), h('small', null, c.kind))));
        input.setAttribute('aria-activedescendant', shown.length ? 'pal-' + sel : '');
        live.textContent = shown.length ? shown.length + ' results' : 'No match';
        if (!shown.length) listEl.append(h('li', { class: 'none' }, 'No match. Try a student name or a page.'));
      };
      const run = i => { const c = shown[i]; if (!c) return; closePalette(); c.run(); };
      input.addEventListener('input', () => { sel = 0; paint(); });
      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
        else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      });
      const rootEl = h('div', { class: 'pal-back', onmousedown: ev => { if (ev.target === rootEl) closePalette(); } }, h('div', { class: 'pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' }, input, listEl, live, h('p', { class: 'pal-hint small muted' }, 'Up and down to choose, Enter to go, Esc to close.')));
      document.body.append(rootEl); pal = { root: rootEl, input };
      document.addEventListener('keydown', trapKeys, true); paint(); input.focus();
    }
    document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); pal ? closePalette() : openPalette(); } });
    /* ---------- install as an app (offline worker) ---------- */
    function installCard() {
      const P = root.StarkPWA, status = h('p', { id: 'pwa-status', role: 'status' }), inst = btn('Install Classroom Hub', async () => { const ok = await P.install(); toast(ok ? 'Installed. Open Stark Classroom Hub from your apps.' : 'Not installed.'); });
      const upd = () => { if (!document.body.contains(status)) { root.removeEventListener('stark-pwa', upd); return; } status.textContent = P ? P.statusText() : 'Offline mode is not available in this browser.'; inst.hidden = !(P && P.canInstall); };
      root.addEventListener('stark-pwa', upd); setTimeout(upd, 0);
      return h('div', { class: 'card', id: 'pwa' }, h('h2', null, 'Install and offline'), h('p', { class: 'muted small' }, 'On the web version, the Hub keeps its own files on this computer so it opens with no connection, and your browser may offer to install it as an app. Your class data stays where it always is. Nothing is downloaded from anywhere else.'), status, h('div', { class: 'row' }, inst));
    }
    return { insights: vInsights, sealCard, installCard, openPalette, closePalette, lineChart };
  };
})(typeof window !== 'undefined' ? window : globalThis);
