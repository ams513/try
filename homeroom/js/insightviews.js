/* Stark Homeroom: the Insight screens. The Insights page (ask a question, pace forecast with a live what-if, records
   radar, activity heatmap), the Ctrl+K command palette with quick-log, and the encrypted vault card for the Backup
   page. app.js passes in its helpers; all logic lives in insightlib.js and vaultlib.js. Nothing here touches the
   network, and every element is built with DOM calls. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const NS = 'http://www.w3.org/2000/svg';
  SHR.insightViews = function (X) {
    const { h, btn, field, L, ui, save, render, toast, today, plural, downloadBlob, nowIso, slug, printNodes, sheet, schoolLine, nice } = X;
    const S = () => X.st();
    const opt = (v, text, sel) => h('option', { value: v, selected: v === sel }, text);
    const svg = (tag, attrs, kids) => { const e = document.createElementNS(NS, tag); for (const k in attrs || {}) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, String(attrs[k])); (kids || []).forEach(c => { if (c) e.append(c.nodeType ? c : document.createTextNode(String(c))); }); return e; };
    const hrs = m => (Math.round(m / 6) / 10) + ' h';

    /* ---------- small drawings ---------- */
    function ring(score) {
      const R = 38, C = 2 * Math.PI * R, cls = score >= 80 ? 'good' : score >= 55 ? 'warn' : 'bad';
      return svg('svg', { viewBox: '0 0 100 100', width: 96, height: 96, role: 'img', 'aria-label': 'Records health ' + score + ' out of 100', class: 'ring ring-' + cls }, [
        svg('circle', { cx: 50, cy: 50, r: R, class: 'ring-bg', fill: 'none', 'stroke-width': 9 }),
        svg('circle', { cx: 50, cy: 50, r: R, class: 'ring-fg', fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-dasharray': (C * score / 100).toFixed(1) + ' ' + C.toFixed(1), transform: 'rotate(-90 50 50)' }),
        svg('text', { x: 50, y: 56, 'text-anchor': 'middle', class: 'ring-num' }, [String(score)])]);
    }
    function heatSvg(hm, label) {
      const cell = 13, gap = 3, left = 28, top = 18, W = left + hm.weeks.length * (cell + gap) + 4, Hh = top + 7 * (cell + gap) + 2;
      const g = svg('svg', { viewBox: '0 0 ' + W + ' ' + Hh, class: 'heat', role: 'img', 'aria-label': label, preserveAspectRatio: 'xMinYMin meet' });
      ['Mon', 'Wed', 'Fri'].forEach((d, i) => g.append(svg('text', { x: 0, y: top + (i * 2) * (cell + gap) + cell - 2, class: 'heat-lab' }, [d])));
      let lastMonth = '';
      hm.weeks.forEach((col, w) => {
        const first = col.find(Boolean); if (first) { const m = first.date.slice(0, 7); if (m !== lastMonth && first.date.slice(8) <= '07') { lastMonth = m; g.append(svg('text', { x: left + w * (cell + gap), y: 11, class: 'heat-lab' }, [new Date(first.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })])); } }
        col.forEach((c, d) => { if (!c) return; g.append(svg('rect', { x: left + w * (cell + gap), y: top + d * (cell + gap), width: cell, height: cell, rx: 3, class: 'hm hm' + c.level }, [svg('title', {}, [L.fmtDay(c.date) + ': ' + (c.minutes ? L.fmtMin(c.minutes) : 'no hours logged')])])); });
      });
      return g;
    }
    function paceChart(sid, mult, from, to) {
      const td = today(), W = 640, Hh = 230, pl = 46, pr = 14, pt = 14, pb = 28, weeks = 12;
      const g = L.goalForecast(S(), sid, from, td, to), pace = g.paceWeekMin;
      const act = L.cumulativeSeries(S(), sid, from, td, 0, 0), proj = L.cumulativeSeries(S(), sid, from, td, pace * mult, weeks).filter(p => p.projected), base = mult === 1 ? [] : L.cumulativeSeries(S(), sid, from, td, pace, weeks).filter(p => p.projected);
      const all = act.concat(proj, base), t0 = all[0] ? all[0].date : from, t1 = all[all.length - 1].date;
      const span = Math.max(1, (new Date(t1) - new Date(t0)) / 86400000), ymax = Math.max(60, g.goalMin || 0, ...all.map(p => p.min)) * 1.05;
      const X0 = d => pl + (new Date(d) - new Date(t0)) / 86400000 / span * (W - pl - pr), Y0 = m => Hh - pb - m / ymax * (Hh - pt - pb);
      const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + X0(p.date).toFixed(1) + ' ' + Y0(p.min).toFixed(1)).join(' ');
      const el = svg('svg', { viewBox: '0 0 ' + W + ' ' + Hh, class: 'chart', role: 'img', 'aria-label': 'Hours so far ' + hrs(act.length ? act[act.length - 1].min : 0) + (pace ? '; at the chosen pace about ' + hrs(proj.length ? proj[proj.length - 1].min : 0) + ' in ' + weeks + ' weeks' : '; no recent pace to project') });
      for (let i = 0; i <= 4; i++) { const m = ymax * i / 4, y = Y0(m); el.append(svg('line', { x1: pl, x2: W - pr, y1: y, y2: y, class: 'chart-grid' }), svg('text', { x: pl - 6, y: y + 4, 'text-anchor': 'end', class: 'chart-lab' }, [String(Math.round(m / 60)) + ' h'])); }
      if (g.goalMin) el.append(svg('line', { x1: pl, x2: W - pr, y1: Y0(g.goalMin), y2: Y0(g.goalMin), class: 'chart-goal' }), svg('text', { x: W - pr, y: Y0(g.goalMin) - 5, 'text-anchor': 'end', class: 'chart-lab chart-goal-lab' }, ['Goal ' + Math.round(g.goalMin / 60) + ' h']));
      if (base.length) el.append(svg('path', { d: path([act[act.length - 1]].concat(base)), class: 'chart-base', fill: 'none' }));
      if (proj.length) el.append(svg('path', { d: path([act[act.length - 1]].concat(proj)), class: 'chart-proj', fill: 'none' }));
      if (act.length) el.append(svg('path', { d: path(act), class: 'chart-line', fill: 'none' }), svg('circle', { cx: X0(act[act.length - 1].date), cy: Y0(act[act.length - 1].min), r: 4, class: 'chart-dot' }));
      el.append(svg('text', { x: pl, y: Hh - 8, class: 'chart-lab' }, [L.fmtDay(t0)]), svg('text', { x: W - pr, y: Hh - 8, 'text-anchor': 'end', class: 'chart-lab' }, [L.fmtDay(t1)]));
      return el;
    }
    const bar = (pct, cls) => svg('svg', { viewBox: '0 0 100 8', class: 'bar ' + (cls || ''), role: 'img', 'aria-label': pct + ' percent', preserveAspectRatio: 'none' }, [svg('rect', { x: 0, y: 0, width: 100, height: 8, rx: 4, class: 'bar-bg' }), svg('rect', { x: 0, y: 0, width: Math.max(0, Math.min(100, pct)), height: 8, rx: 4, class: 'bar-fg' })]);

    /* ---------- the Insights page ---------- */
    function ask(text) {
      ui.insQ = text; ui.insA = L.askHomeroom(S(), text, today());
    }
    const EXAMPLES = () => { const n = (S().students[0] || {}).name || 'Maya'; return ['hours of math for ' + n + ' this month', 'credits and GPA for ' + n, 'who has no hours this week?', 'what is overdue?', 'attendance last 30 days']; };
    function askCard() {
      const q = h('input', { type: 'text', id: 'ask-q', maxlength: 200, autocomplete: 'off', placeholder: 'How many hours of reading did Leo log this month?', 'aria-describedby': 'ask-help' });
      q.value = ui.insQ || '';
      const go = () => { ask(q.value); render(); const a = document.getElementById('ask-answer'); if (a) a.focus(); };
      q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      const a = ui.insA;
      return h('div', { class: 'card' }, h('h2', null, 'Ask Homeroom'),
        h('p', { class: 'small muted', id: 'ask-help' }, 'Ask in plain words. The answer is worked out here from your own records; nothing is sent anywhere.'),
        h('div', { class: 'row' }, h('div', { class: 'grow2' }, q), btn('Ask', go)),
        h('div', { class: 'row' }, EXAMPLES().map(t => h('button', { type: 'button', class: 'chip chip-btn', onclick: () => { ask(t); render(); } }, t))),
        h('div', { id: 'ask-answer', tabindex: '-1', role: 'status', class: a ? 'answer' : null },
          a ? [h('p', { class: 'answer-text' }, a.answer), a.rows && a.rows.length ? h('ul', { class: 'list' }, a.rows.slice(0, 12).map(r => h('li', null, h('span', null, r.label), h('b', null, r.value)))) : null] : null));
    }
    function paceCard(sid, from, to) {
      const st = S(), box = h('div', { class: 'card' }), name = (st.students.find(s => s.id === sid) || {}).name || '';
      box.append(h('h2', null, 'Pace and what-if'));
      if (!sid) { box.append(h('p', { class: 'muted' }, 'Pick one learner above to see the pace forecast.')); return box; }
      const hpcIn = h('input', { type: 'range', id: 'hpc', min: 60, max: 180, step: 5, 'aria-describedby': 'hpc-note' }); hpcIn.value = ui.insHpc || 120;
      const mulIn = h('input', { type: 'range', id: 'mult', min: 25, max: 300, step: 5 }); mulIn.value = Math.round((ui.insMult || 1) * 100);
      const out = h('div'), chartHost = h('div'), said = h('p', { class: 'sr-only', role: 'status' }); let sayT = 0;   /* one short sentence is announced after the slider settles, not the whole list */
      const draw = () => {
        const hpc = +hpcIn.value, mult = +mulIn.value / 100; ui.insHpc = hpc; ui.insMult = mult;
        const rows = L.courseForecast(st, sid, today(), { hoursPerCredit: hpc, termEnd: to }), g = L.goalForecast(st, sid, from, today(), to);
        const ptxt = L.whatIf; out.replaceChildren();
        out.append(h('p', null, name + ' has averaged ', h('b', null, hrs(g.paceWeekMin) + ' a week'), ' over the last four weeks. At ', h('b', null, Math.round(mult * 100) + '%'), ' of that pace, that is ', h('b', null, hrs(g.paceWeekMin * mult) + ' a week'), '.'));
        if (g.goalMin) { const w = ptxt(g.goalMin - g.loggedMin, g.paceWeekMin * mult, today()); out.append(h('p', null, 'Hours goal: ', h('b', null, hrs(g.loggedMin) + ' of ' + hrs(g.goalMin)), g.reached ? ' reached.' : (w.date ? ' reached around ' + L.fmtDay(w.date) + (to ? (w.date <= to ? ', before the year ends.' : ', after the year ends.') : '.') : ' (no pace yet).'))); }
        out.append(rows.length ? h('ul', { class: 'list pace-list' }, rows.map(r => {
          const w = ptxt(r.remainingMin, r.paceWeekMin * mult, today());
          return h('li', null, h('div', { class: 'grow' }, h('b', null, r.title), h('div', { class: 'small muted' }, hrs(r.doneMin) + ' of ' + hrs(r.targetMin) + ' (' + r.credits + ' credit' + (r.credits === 1 ? '' : 's') + ')'), bar(r.pct, r.pct >= 100 ? 'done' : '')),
            h('div', { class: 'right' }, r.reached ? h('span', { class: 'chip good' }, 'Hours reached') : w.date ? [h('b', null, L.fmtDay(w.date)), h('div', { class: 'small ' + (to && w.date > to ? 'st-partial' : 'muted') }, plural(Math.ceil(w.weeks), 'week') + (to ? (w.date <= to ? ' - inside the year' : ' - past the year end') : ''))] : h('span', { class: 'small muted' }, 'Log hours against this course')));
        })) : h('p', { class: 'muted' }, 'No courses in progress with credits. Add one on the Courses page and log hours against it.'));
        chartHost.replaceChildren(paceChart(sid, mult, from, to));
        clearTimeout(sayT); sayT = setTimeout(() => { said.textContent = Math.round(mult * 100) + '% of pace: ' + hrs(g.paceWeekMin * mult) + ' a week' + (rows.length ? '; ' + rows[0].title + ' ' + (rows[0].reached ? 'hours reached' : (ptxt(rows[0].remainingMin, rows[0].paceWeekMin * mult, today()).date ? 'reaches its hours around ' + L.fmtDay(ptxt(rows[0].remainingMin, rows[0].paceWeekMin * mult, today()).date) : 'has no pace yet')) : '') + '.'; }, 700);
      };
      hpcIn.addEventListener('input', draw); mulIn.addEventListener('input', draw);
      box.append(h('p', { class: 'small muted' }, 'A live estimate from the hours you logged. Move the sliders to see what changes. It is a planning aid, not a promise.'),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('label', { for: 'mult' }, 'What if we work at this share of our pace'), mulIn), h('div', { class: 'grow' }, h('label', { for: 'hpc' }, 'Hours that count as one credit'), hpcIn)),
        h('p', { class: 'small muted', id: 'hpc-note' }, '120 hours per credit is a common rule of thumb, not a rule: use the number your state, program or college asks for.'), out, said, chartHost,
        h('p', { class: 'small muted' }, 'Solid line: hours logged. Dashed line: the projection at the chosen pace' + '. Faint dashed: your current pace.'));
      draw();
      return box;
    }
    function radarCard(sid) {
      const r = L.recordsRadar(S(), today()), list = r.findings.filter(f => !sid || !f.sid || f.sid === sid);
      return h('div', { class: 'card' }, h('div', { class: 'row' }, ring(r.score), h('div', { class: 'grow' }, h('h2', null, 'Records radar'), h('p', { class: 'muted' }, 'Looks for gaps, doubled entries, odd lengths and loose ends in your records. ', r.warn + r.info ? plural(r.warn, 'thing') + ' to check, ' + plural(r.info, 'note') + '.' : 'Nothing found.'))),
        list.length ? h('ul', { class: 'list' }, list.slice(0, 14).map(f => h('li', null, h('div', { class: 'grow' }, h('span', { class: 'chip ' + (f.sev === 'warn' ? 'warn' : '') }, f.sev === 'warn' ? 'Check' : 'Note'), ' ', h('b', null, f.title), h('div', { class: 'small muted' }, f.detail)), f.route ? h('a', { href: f.route, class: 'btn btn-ghost btn-small', 'aria-label': 'Open ' + f.title }, 'Open') : null))) : h('p', null, h('span', { class: 'chip good' }, 'All clear'), ' Your records look consistent.'),
        h('p', { class: 'small muted' }, 'The health number is a rough guide to loose ends in this app, not a measure of your teaching or a check against any rule.'));
    }
    function heatCard(sid) {
      const weeks = ui.insWeeks || 26, hm = L.heatmap(S(), sid, today(), weeks);
      const sel = h('select', { id: 'hm-weeks', 'aria-label': 'Weeks shown' }, [13, 26, 52].map(n => opt(String(n), 'Last ' + n + ' weeks', String(weeks))));
      sel.addEventListener('change', () => { ui.insWeeks = +sel.value; render(); const e = document.getElementById('hm-weeks'); if (e) e.focus(); });
      const label = 'Activity heatmap, ' + weeks + ' weeks: ' + plural(hm.activeDays, 'active day') + ', ' + hrs(hm.totalMin) + ' logged, current streak ' + plural(hm.streak, 'school day') + '.';
      return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Learning heatmap'), sel),
        h('div', { class: 'heat-wrap' }, heatSvg(hm, label)),
        h('div', { class: 'row small muted' }, 'Less', [0, 1, 2, 3, 4].map(l => svg('svg', { viewBox: '0 0 14 14', width: 14, height: 14, 'aria-hidden': 'true' }, [svg('rect', { width: 14, height: 14, rx: 3, class: 'hm hm' + l })])), 'More'),
        h('div', { class: 'grid' }, h('div', { class: 'stat' }, h('b', null, hm.streak), h('span', null, 'school-day streak')), h('div', { class: 'stat' }, h('b', null, hm.longest), h('span', null, 'longest run')), h('div', { class: 'stat' }, h('b', null, hm.activeDays), h('span', null, 'active days')), h('div', { class: 'stat' }, h('b', null, Math.round(hm.totalMin / 6) / 10), h('span', null, 'hours'))),
        h('p', { class: 'small muted' }, 'Weekends do not break a streak. Colours are relative to your own busiest days.'));
    }
    /* a one-page, print-ready learning snapshot for one learner: hours, subjects, course pace and the heatmap */
    function snapshot(sid, from, to) {
      const st = S(), td = today(), s0 = st.students.find(x => x.id === sid); if (!s0) return null;
      const hs = L.hoursSummary(st, sid, from, td), hm = L.heatmap(st, sid, td, 26), rows = L.courseForecast(st, sid, td, { hoursPerCredit: ui.insHpc || 120, termEnd: to }), cr = L.creditSummary(st, sid), top = hs.bySubject.length ? hs.bySubject[0].minutes : 1;
      const label = 'Activity heatmap, last 26 weeks: ' + plural(hm.activeDays, 'active day') + ', ' + hrs(hm.totalMin) + '.';
      return sheet('Learning snapshot: ' + s0.name, schoolLine() + (schoolLine() ? ' · ' : '') + (from ? 'from ' + nice(from) + ' to ' + nice(td) : 'to ' + nice(td)),
        h('div', null,
          h('table', null, h('tbody', null, h('tr', null, h('th', null, 'Hours logged'), h('td', null, hrs(hs.total)), h('th', null, 'Days with hours'), h('td', null, String(hs.days))), h('tr', null, h('th', null, 'Credits earned'), h('td', null, String(cr.earned)), h('th', null, 'In progress'), h('td', null, String(cr.progress))))),
          h('h2', null, 'Hours by subject'),
          hs.bySubject.length ? h('table', null, h('thead', null, h('tr', null, h('th', null, 'Subject'), h('th', null, 'Hours'), h('th', null, 'Share'))), h('tbody', null, hs.bySubject.map(b => h('tr', null, h('td', null, b.subject), h('td', null, hrs(b.minutes)), h('td', null, bar(Math.round(b.minutes / top * 100))))))) : h('p', null, 'No hours logged in this period.'),
          h('h2', null, 'Courses in progress'),
          rows.length ? h('table', null, h('thead', null, h('tr', null, h('th', null, 'Course'), h('th', null, 'Hours so far'), h('th', null, 'Planning target'), h('th', null, 'At the recent pace'))), h('tbody', null, rows.map(r => h('tr', null, h('td', null, r.title), h('td', null, hrs(r.doneMin)), h('td', null, hrs(r.targetMin)), h('td', null, r.reached ? 'Hours reached' : r.eta ? L.fmtDay(r.eta) : 'No recent hours'))))) : h('p', null, 'No courses in progress.'),
          h('h2', null, 'Activity, last 26 weeks'), heatSvg(hm, label),
          h('p', { class: 'small' }, 'Planning targets use ' + (ui.insHpc || 120) + ' hours per credit, a family-chosen rule of thumb. Dates are estimates from the hours logged, not promises or official records.')));
    }
    function vInsights() {
      const st = S(), box = h('div'), yr = X.yearRange();
      if (!st.students.length) { box.append(h('h1', null, 'Insights'), h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Add your learners and log some hours, or load the sample family from the Backup page, and Homeroom will show pace, gaps and a heatmap here.'))); return box; }
      if (ui.insSid === undefined || (ui.insSid && !st.students.some(s => s.id === ui.insSid))) ui.insSid = st.students[0].id;
      const sel = h('select', { id: 'ins-who', 'aria-label': 'Learner' }, opt('', 'Everyone', ui.insSid), st.students.map(s => opt(s.id, s.name, ui.insSid)));
      sel.addEventListener('change', () => { ui.insSid = sel.value; render(); const e = document.getElementById('ins-who'); if (e) e.focus(); });
      const from = yr.from || (() => { const y = +today().slice(0, 4), m = +today().slice(5, 7); return (m >= 7 ? y : y - 1) + '-07-01'; })();
      box.append(h('div', { class: 'row' }, h('h1', { class: 'grow' }, 'Insights'), h('div', null, sel)),
        h('p', { class: 'muted lead' }, 'Ask your records a question, see where you are heading, and catch loose ends early. Everything is worked out on this computer.'),
        askCard(), paceCard(ui.insSid, from, yr.to), radarCard(ui.insSid), heatCard(ui.insSid),
        h('div', { class: 'card' }, h('h2', null, 'Learning snapshot'), h('p', { class: 'muted' }, 'A one-page printout with hours, subjects, course pace and the heatmap, for a learner you pick above.'), h('div', { class: 'row' }, btn('Print snapshot', () => { const sh = snapshot(ui.insSid, yr.from, yr.to); if (sh) printNodes([sh]); }, '', { disabled: !ui.insSid }), ui.insSid ? null : h('span', { class: 'small muted' }, 'Pick one learner first.'))));
      return box;
    }

    /* ---------- the command palette ---------- */
    const pal = { el: null, input: null, list: null, items: [], idx: 0, from: null, opts: null };
    function paletteItems(q) {
      const st = S(), td = today(), t = q.trim();
      if (/^(log|add)\s/i.test(t)) {
        const r = L.parseQuickLog(st, t, td);
        return r.ok ? [{ label: r.summary, hint: 'Press Enter to log it', kind: 'quicklog', log: r }] : [{ label: r.problems[0], hint: 'Quick log: log 45 min geometry Maya yesterday', kind: 'info' }];
      }
      if (/\?$/.test(t) || /^(how|who|what|which|ask|show)\b/i.test(t)) {
        const r = L.askHomeroom(st, t.replace(/^ask\s+/i, ''), td);
        return [{ label: r.answer, hint: 'Press Enter for the details on the Insights page', kind: 'answer', q: t.replace(/^ask\s+/i, '') }];
      }
      const idx = L.commandIndex(st, pal.opts.routes);
      return t ? L.fuzzyRank(t, idx, x => x.label + ' ' + x.hint, 9) : idx.filter(x => x.kind === 'page' || x.kind === 'action').slice(0, 9);
    }
    function paletteDraw() {
      pal.items = paletteItems(pal.input.value); if (pal.idx >= pal.items.length) pal.idx = 0;
      pal.list.replaceChildren(...(pal.items.length ? pal.items.map((it, i) => h('li', { role: 'option', id: 'pal-' + i, 'aria-selected': i === pal.idx ? 'true' : 'false', class: 'pal-item' + (i === pal.idx ? ' on' : '') + (it.kind === 'info' ? ' dim' : ''), onclick: () => { pal.idx = i; paletteRun(); }, onmousemove: () => { if (pal.idx !== i) { pal.idx = i; paletteMark(); } } }, h('span', { class: 'pal-label' }, it.label), h('span', { class: 'pal-hint' }, it.hint || '')) )
        : [h('li', { class: 'pal-item dim', role: 'option', 'aria-selected': 'false' }, h('span', { class: 'pal-label' }, 'Nothing matches. Try a learner, course, or page name.'))]));
      pal.input.setAttribute('aria-activedescendant', pal.items.length ? 'pal-' + pal.idx : '');
    }
    function paletteMark() { Array.from(pal.list.children).forEach((li, i) => { li.classList.toggle('on', i === pal.idx); li.setAttribute('aria-selected', i === pal.idx ? 'true' : 'false'); }); pal.input.setAttribute('aria-activedescendant', 'pal-' + pal.idx); const on = pal.list.children[pal.idx]; if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' }); }
    function paletteClose() { if (!pal.el || pal.el.hidden) return; pal.el.hidden = true; document.body.classList.remove('pal-open'); if (pal.from && pal.from.focus && document.contains(pal.from)) pal.from.focus(); pal.from = null; }
    function paletteRun() {
      const it = pal.items[pal.idx]; if (!it || it.kind === 'info') return;
      if (it.kind === 'quicklog') {
        const r = it.log;
        try { L.logHours(S(), { date: r.date, subject: r.subject, minutes: r.minutes, courseId: r.courseId, sids: r.sids, note: r.note }); save(); paletteClose(); toast('Logged: ' + r.summary.replace(/^Log /, '') + '.'); render(); } catch (e) { toast(e.message, true); }
        return;
      }
      paletteClose();
      if (it.kind === 'answer') { ask(it.q); if (location.hash === '#/insights') render(); else location.hash = '#/insights'; return; }
      if (it.action) { pal.opts.actions[it.action](); return; }
      if (it.hash) { if (location.hash === it.hash) { render(); } else location.hash = it.hash; }
    }
    function paletteOpen() {
      if (!pal.el) return;
      pal.from = document.activeElement; pal.el.hidden = false; document.body.classList.add('pal-open'); pal.input.value = ''; pal.idx = 0; paletteDraw(); pal.input.focus();
    }
    function palette(opts) {
      pal.opts = opts;
      pal.input = h('input', { type: 'text', id: 'pal-input', role: 'combobox', autocomplete: 'off', spellcheck: 'false', 'aria-autocomplete': 'list', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-label': 'Search or type a command', placeholder: 'Search, or type: log 45 min math Maya yesterday' });
      pal.list = h('ul', { id: 'pal-list', role: 'listbox', 'aria-label': 'Results' });
      const box = h('div', { class: 'pal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' }, pal.input, pal.list, h('p', { class: 'pal-foot small muted' }, 'Up and Down to choose, Enter to go, Esc to close. Start with "log" to record time, end with ? to ask a question.'));
      pal.el = h('div', { class: 'pal', hidden: true, id: 'palette' }, h('div', { class: 'pal-back', onclick: paletteClose }), box);
      pal.input.addEventListener('input', () => { pal.idx = 0; paletteDraw(); });
      pal.el.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); paletteClose(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (pal.items.length) { pal.idx = (pal.idx + 1) % pal.items.length; paletteMark(); } }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (pal.items.length) { pal.idx = (pal.idx - 1 + pal.items.length) % pal.items.length; paletteMark(); } }
        else if (e.key === 'Enter') { e.preventDefault(); paletteRun(); }
        else if (e.key === 'Tab') { e.preventDefault(); pal.input.focus(); }
      });
      document.body.append(pal.el);
      document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (pal.el.hidden) paletteOpen(); else paletteClose(); } });
      const b = document.getElementById('palette-btn'); if (b) b.addEventListener('click', paletteOpen);
      return { open: paletteOpen, close: paletteClose };
    }

    /* ---------- the vault card (Backup page) ---------- */
    async function saveVaultFile(name, text) {
      if (root.showSaveFilePicker) {
        try { const fh = await root.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Stark Homeroom vault', accept: { 'application/json': ['.shrvault'] } }] }); const w = await fh.createWritable(); await w.write(text); await w.close(); return 'picker'; }
        catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
      }
      downloadBlob(name, new Blob([text], { type: 'application/json' })); return 'download';
    }
    function vaultCard(msg) {
      const p1 = h('input', { type: 'password', id: 'vault-pass', autocomplete: 'new-password', 'aria-describedby': 'vault-meter vault-help' }), p2 = h('input', { type: 'password', id: 'vault-pass2', autocomplete: 'new-password' });
      const meter = h('div', { id: 'vault-meter', class: 'pw' }, h('span', { class: 'pw-seg', 'aria-hidden': 'true' }), h('span', { class: 'pw-seg', 'aria-hidden': 'true' }), h('span', { class: 'pw-seg', 'aria-hidden': 'true' }), h('span', { class: 'pw-seg', 'aria-hidden': 'true' }), h('span', { class: 'pw-text small muted', 'aria-live': 'polite' }, 'Strength: type a passphrase'));
      const status = h('div', { class: 'notice', hidden: true, role: 'status', id: 'vault-status' });
      const say = (t, bad, field) => {
        status.textContent = t; status.hidden = !t; status.classList.toggle('bad', !!bad); status.setAttribute('role', bad ? 'alert' : 'status');
        [p1, p2, rp].forEach(x => { x.removeAttribute('aria-invalid'); x.setAttribute('aria-describedby', (x === p1 ? 'vault-meter vault-help' : '') + (bad && x === field ? ' vault-status' : '')); });
        if (bad && field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
      };
      p1.addEventListener('input', () => {
        const s = L.passphraseStrength(p1.value), lv = { empty: 0, weak: 1, fair: 2, strong: 3, excellent: 4 }[s.label];
        Array.from(meter.querySelectorAll('.pw-seg')).forEach((e, i) => { e.className = 'pw-seg' + (i < lv ? ' on lv' + lv : ''); });
        meter.querySelector('.pw-text').textContent = p1.value ? 'Strength: ' + s.label + (s.tips.length ? '. ' + s.tips[0] : '') : 'Strength: type a passphrase';
      });
      const go = btn('Save encrypted vault', async () => {
        const s = L.passphraseStrength(p1.value);
        if (!s.ok) { say('Choose a stronger passphrase (at least 8 characters; four unrelated words work well).', true, p1); return; }
        if (p1.value !== p2.value) { say('The two passphrases are different.', true, p2); return; }
        go.disabled = true; say('Encrypting on this computer. This takes a second or two.');
        try {
          const iso = nowIso(), v = await L.vaultSeal(JSON.stringify(L.buildBackup(S(), iso)), p1.value, { saved: iso });
          const r = await saveVaultFile('stark-homeroom-vault-' + slug(S().classroom.name || 'family') + '-' + today() + '.shrvault', JSON.stringify(v));
          if (r !== 'cancel') { S().lastBackup = iso; save(); p1.value = ''; p2.value = ''; say('Vault saved. Keep the passphrase somewhere safe: nobody, including Stark, can open the file without it.'); toast('Encrypted vault saved.'); } else say('Cancelled. Nothing was saved.');
        } catch (e) { say(e && e.message ? e.message : 'Encryption is not available in this browser. Use the plain backup instead.', true); }
        go.disabled = false;
      });
      const rp = h('input', { type: 'password', id: 'vault-open-pass', autocomplete: 'current-password' });
      /* a vault object (from a file, or from Beam: js/beam_homeroom.js) is opened with the typed passphrase, checked, and shown in the restore preview; nothing is replaced yet */
      let held = null;
      const openVault = async (o, name, again) => {
        try {
          if (!L.vaultLooksLike(o)) throw new Error('That file is not a Stark Homeroom vault.');
          say('Opening on this computer...');
          if (!rp.value) { say('Type the vault passphrase first, then ' + again, true, rp); return; }
          const r = await L.vaultOpen(o, rp.value); if (!r.ok) { say(r.error, true, /passphrase/i.test(r.error) ? rp : null); return; }
          let b; try { b = JSON.parse(r.text); } catch (er) { throw new Error('The vault opened but holds no backup.'); }
          const rb = L.readBackup(b); if (!rb.ok) throw new Error(rb.error);
          rp.value = ''; ui.restore = { name: name, state: rb.state, note: rb.note + '; from an encrypted vault' + (r.headerBound ? ', header sealed' : ''), saved: r.saved }; say(''); render();
        } catch (err) { say(err.message, true); }
      };
      const pick = h('input', { type: 'file', id: 'vaultpick', accept: '.shrvault,.json', 'aria-label': 'Choose a vault file', onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
          if (f.size > 40 * 1024 * 1024) throw new Error('That file is too big.');
          let o; try { o = JSON.parse(await f.text()); } catch (er) { throw new Error('That file is not a vault.'); }
          await openVault(o, f.name, 'choose the file again.');
        } catch (err) { say(err.message, true); }
        e.target.value = '';
      } });
      const heldBtn = btn('Open the received vault', () => { if (held) openVault(held, 'the vault on the other device', 'press Open the received vault again.'); }, '', { id: 'beam-open', hidden: true });
      const arrived = v => { held = v; heldBtn.hidden = false; say('Received from the other device. Nothing has changed yet: type the vault passphrase above, then press Open the received vault.'); rp.focus(); };
      const persist = h('div', { class: 'row' }), pstat = h('span', { class: 'small muted', role: 'status' }, '');
      if (root.navigator && navigator.storage && navigator.storage.persist) {
        const ask1 = btn('Ask the browser to keep my records', async () => { try { const ok = await navigator.storage.persist(); pstat.textContent = ok ? 'Done: the browser will not clear this site\'s data on its own.' : 'The browser did not agree. Keep saving backups.'; } catch (e) { pstat.textContent = 'Not available here.'; } }, 'btn-ghost btn-small');
        persist.append(ask1, pstat);
        if (navigator.storage.persisted) navigator.storage.persisted().then(v => { if (v) pstat.textContent = 'Already protected from automatic clearing.'; }).catch(() => {});
      } else persist.append(h('span', { class: 'small muted' }, 'This browser cannot be asked to protect stored data.'));
      const vaultEl = h('div', { class: 'card', id: 'vault-card' }, h('h2', null, 'Encrypted vault'),
        h('p', { class: 'muted', id: 'vault-help' }, 'The same backup, locked with a passphrase before it leaves the page. Good for a cloud folder or a shared drive: without the passphrase the file is unreadable. The passphrase is never stored, and it cannot be recovered if you lose it.'),
        status,
        h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Passphrase', p1, 'vault-pass')), h('div', { class: 'grow' }, field('Type it again', p2, 'vault-pass2'))), meter,
        h('div', { class: 'row' }, go),
        h('h3', null, 'Open a vault'), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Vault passphrase', rp, 'vault-open-pass')), h('div', { class: 'grow2' }, field('Vault file', pick, 'vaultpick'))),
        h('div', { class: 'row' }, heldBtn),
        h('p', { class: 'small muted' }, 'Encrypted with AES-256-GCM; the key comes from your passphrase by PBKDF2-SHA-256 (600,000 rounds), using the browser\'s own cryptography. The header, including the date it was sealed, is sealed too. A wrong passphrase or a changed file is refused without restoring anything, and a vault older than your records here is flagged before it can replace them.'),
        h('h3', null, 'Keep stored records'), persist);
      if (!SHR.beamCard) return vaultEl;
      const both = document.createDocumentFragment(); both.append(vaultEl, SHR.beamCard(X, arrived)); return both;   /* Beam (js/beam_homeroom.js): its card after the vault card */
    }

    return { insights: vInsights, palette, vaultCard };
  };
})(typeof window !== 'undefined' ? window : globalThis);
