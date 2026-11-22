/* Stark Event Kit tools: bracket tournament, game jam mode, results, answer sheets, certificates and export. */
(function (g) {
  'use strict';
  var S = g.SEK, UI = S.ui, h = UI.h, R = UI.routes, doc = g.document;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function doPrint() { UI.print(); }
  function todayIso() { return new Date().toISOString().slice(0, 10); }

  R.bracket = function (root) { root.appendChild(h('h1', { text: 'Bracket' })); root.appendChild(window.StarkTrial.card('bracket')); };
  /* ---------- game jam ---------- */
  function jamDefault() {
    return { seed: (Date.now() & 0x7fffffff), theme: null, locked: false, constraints: [], dur: 172800, timer: { running: false, endsAt: 0, left: 172800 },
      checklist: S.JAM_CHECKLIST.map(function (t) { return { t: t, d: false }; }),
      rubric: { criteria: S.RUBRIC_DEFAULT.map(function (c) { return { id: c.id, name: c.name, weight: c.weight, max: 5, desc: c.desc }; }), judges: [{ id: 'j1', name: 'Judge 1' }, { id: 'j2', name: 'Judge 2' }, { id: 'j3', name: 'Judge 3' }], entries: [] },
      scores: {}, judge: 'j1', event: 'Game jam' };
  }
  S.jamLoad = function () { var j = S.store.get('jam', null); return j && j.rubric ? j : jamDefault(); };
  S.jamRows = function (j) {
    if (!j || !j.rubric.entries.length) return null;
    var any = false; for (var k in j.scores) any = true; if (!any) return null;
    return S.rubric.totals(j.rubric, j.scores);
  };
  R.jam = function (root, q) {
    var j = S.jamLoad(), tab = q.tab || 'theme', tick = null;
    if (!j.theme) { var p = S.pickTheme(j.seed); j.theme = p.theme; j.constraints = p.constraints; }
    function save() { S.store.set('jam', j); }
    function remaining() { return j.timer.running ? Math.max(0, (j.timer.endsAt - Date.now()) / 1000) : j.timer.left; }
    function draw() {
      UI.clear(root); if (tick) { clearInterval(tick); tick = null; }
      root.appendChild(h('h1', { text: 'Game jam mode' }));
      root.appendChild(UI.tabs([['theme', 'Theme'], ['timer', 'Timer'], ['checklist', 'Submission checklist'], ['rubric', 'Judging rubric'], ['sheets', 'Score sheets']], tab, function (t) { tab = t; draw(); }));
      ({ theme: tTheme, timer: tTimer, checklist: tCheck, rubric: tRubric, sheets: tSheets })[tab]();
    }
    function tTheme() {
      var card = h('div', { class: 'card' }, h('h2', { text: 'Theme generator' }),
        h('div', { id: 'jam-theme', style: { fontSize: 'clamp(1.8rem, 5vw, 3.4rem)', fontWeight: '900', color: 'var(--accent)', margin: '8px 0' }, text: j.theme }),
        h('p', { class: 'muted' }, 'Optional constraints for an extra challenge: ', h('strong', { text: j.constraints.join('  |  ') })),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', id: 'jam-roll', disabled: j.locked, onclick: function () { j.seed = (j.seed * 1103515245 + 12345) & 0x7fffffff; var p = S.pickTheme(j.seed); j.theme = p.theme; j.constraints = p.constraints; save(); draw(); } }, 'Roll a new theme'),
          h('div', { class: 'field inline', style: { margin: 0 } }, h('input', { type: 'checkbox', id: 'jam-lock', checked: j.locked, onchange: function (e) { j.locked = e.target.checked; save(); draw(); } }), h('label', { for: 'jam-lock', text: 'Lock this theme' })),
          h('button', { type: 'button', class: 'btn', onclick: function () { var o = h('div', { style: { position: 'fixed', inset: '0', zIndex: '60', background: '#060b14', color: '#2dd4bf', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5vw', textAlign: 'center', cursor: 'pointer' }, role: 'button', tabindex: '0', 'aria-label': 'Close the theme reveal', onclick: function () { o.remove(); } },
            h('div', { style: { fontSize: '2vw', color: '#9fb4cf', letterSpacing: '.2em', textTransform: 'uppercase' }, text: j.event + ' theme' }), h('div', { style: { fontSize: '8vw', fontWeight: '900', lineHeight: '1.05' }, text: j.theme }), h('div', { style: { fontSize: '2vw', color: '#9fb4cf', marginTop: '3vw' }, text: j.constraints.join('   |   ') })); doc.body.appendChild(o); } }, 'Reveal on the big screen')));
      root.appendChild(card);
      root.appendChild(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', { text: 'Event name' }), h('input', { type: 'text', value: j.event, 'aria-label': 'Jam event name', onchange: function (e) { j.event = e.target.value || 'Game jam'; save(); } })));
    }
    function tTimer() {
      var num = h('div', { id: 'jam-time', style: { fontSize: 'clamp(3rem, 12vw, 8rem)', fontWeight: '900', fontVariantNumeric: 'tabular-nums', lineHeight: '1' } });
      var bar = h('i', { style: { display: 'block', height: '100%', background: 'var(--accent)', width: '100%' } }), barBox = h('div', { style: { height: '12px', background: 'var(--surface2)', borderRadius: '99px', overflow: 'hidden', margin: '14px 0' } }, bar);
      function paint() { var r = remaining(); num.textContent = S.fmtTime(r); num.style.color = r <= 60 ? 'var(--bad)' : r <= 600 ? 'var(--warn)' : 'var(--text)'; bar.style.width = Math.max(0, Math.min(100, r / j.dur * 100)) + '%'; if (j.timer.running && r <= 0) { j.timer.running = false; j.timer.left = 0; save(); UI.beep(520, 600); draw(); } }
      var card = h('div', { class: 'card' }, h('h2', { text: 'Jam countdown' }), num, barBox,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', id: 'jam-start', onclick: function () { if (j.timer.running) { j.timer.left = remaining(); j.timer.running = false; } else if (j.timer.left > 0) { j.timer.running = true; j.timer.endsAt = Date.now() + j.timer.left * 1000; } save(); draw(); } }, j.timer.running ? 'Pause' : 'Start'),
          h('button', { type: 'button', class: 'btn', onclick: function () { j.timer = { running: false, endsAt: 0, left: j.dur }; save(); draw(); } }, 'Reset')),
        h('h3', { text: 'Length', style: { marginTop: '16px' } }),
        h('div', { class: 'row' }, S.JAM_DURATIONS.map(function (d) { return h('button', { type: 'button', class: 'btn small' + (j.dur === d.sec ? ' primary' : ''), onclick: function () { j.dur = d.sec; j.timer = { running: false, endsAt: 0, left: d.sec }; save(); draw(); } }, d.label); })),
        h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { class: 'field inline' }, h('label', { for: 'jam-h', text: 'Custom: hours' }), h('input', { type: 'number', min: '0', max: '200', id: 'jam-h', style: { width: '90px' } }), h('label', { for: 'jam-m', text: 'minutes' }), h('input', { type: 'number', min: '0', max: '59', id: 'jam-m', style: { width: '90px' } }),
          h('button', { type: 'button', class: 'btn small', onclick: function () { var s2 = (+doc.getElementById('jam-h').value || 0) * 3600 + (+doc.getElementById('jam-m').value || 0) * 60; if (s2 < 60) { UI.toast('Enter at least one minute.'); return; } j.dur = s2; j.timer = { running: false, endsAt: 0, left: s2 }; save(); draw(); } }, 'Set'))),
        h('p', { class: 'fine', text: 'The countdown keeps its place if you reload or close the page. It turns amber at 10 minutes and red at 1 minute.' }));
      root.appendChild(card); paint(); tick = setInterval(paint, 500); UI.onLeave(function () { clearInterval(tick); });
    }
    function tCheck() {
      var done = j.checklist.filter(function (x) { return x.d; }).length;
      var card = h('div', { class: 'card' }, h('h2', { text: 'Submission checklist' }), h('p', { class: 'muted', id: 'jam-prog', text: done + ' of ' + j.checklist.length + ' done' }));
      j.checklist.forEach(function (it, i) {
        card.appendChild(h('div', { class: 'field inline' }, h('input', { type: 'checkbox', id: 'ck' + i, checked: it.d, onchange: function (e) { it.d = e.target.checked; save(); doc.getElementById('jam-prog').textContent = j.checklist.filter(function (x) { return x.d; }).length + ' of ' + j.checklist.length + ' done'; } }), h('label', { for: 'ck' + i, text: it.t }),
          h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove: ' + it.t, onclick: function () { j.checklist.splice(i, 1); save(); draw(); } }, 'Remove')));
      });
      var nw = h('input', { type: 'text', placeholder: 'Add your own item', 'aria-label': 'New checklist item' });
      card.appendChild(h('div', { class: 'row', style: { marginTop: '10px' } }, nw, h('button', { type: 'button', class: 'btn', onclick: function () { if (nw.value.trim()) { j.checklist.push({ t: nw.value.trim(), d: false }); save(); draw(); } } }, 'Add')));
      card.appendChild(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { type: 'button', class: 'btn', onclick: function () { j.checklist.forEach(function (x) { x.d = false; }); save(); draw(); } }, 'Untick all'), h('button', { type: 'button', class: 'btn', onclick: doPrint }, 'Print checklist')));
      root.appendChild(card);
    }
    function tRubric() {
      var rub = j.rubric, wsum = rub.criteria.reduce(function (a, c) { return a + (+c.weight || 0); }, 0);
      var ct = h('div', { class: 'card' }, h('h2', { text: 'Criteria and weights' }), h('p', { class: 'fine', text: 'Weights are relative; the total score is out of 100. Each judge scores every criterion from 0 to its maximum. Scores from several judges are averaged. Ties are broken by the highest-weighted criterion, then the next.' }));
      var body = h('tbody');
      rub.criteria.forEach(function (c, i) {
        body.appendChild(h('tr', null, h('td', null, h('input', { type: 'text', value: c.name, 'aria-label': 'Criterion name', onchange: function (e) { c.name = e.target.value || c.name; save(); } })),
          h('td', null, h('input', { type: 'number', min: '1', max: '100', value: String(c.weight), 'aria-label': 'Weight for ' + c.name, style: { width: '80px' }, onchange: function (e) { c.weight = +e.target.value || 1; save(); draw(); } })),
          h('td', null, h('input', { type: 'number', min: '1', max: '20', value: String(c.max), 'aria-label': 'Maximum score for ' + c.name, style: { width: '80px' }, onchange: function (e) { c.max = +e.target.value || 5; save(); } })),
          h('td', null, h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove ' + c.name, disabled: rub.criteria.length <= 1, onclick: function () { rub.criteria.splice(i, 1); save(); draw(); } }, 'Remove'))));
      });
      ct.appendChild(h('div', { class: 'scroll-x' }, h('table', null, h('thead', null, h('tr', null, ['Criterion', 'Weight', 'Max score', ''].map(function (x) { return h('th', { text: x }); }))), body)));
      ct.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { type: 'button', class: 'btn', onclick: function () { rub.criteria.push({ id: 'c' + Date.now().toString(36), name: 'New criterion', weight: 10, max: 5, desc: '' }); save(); draw(); } }, 'Add criterion'), h('span', { class: 'fine', text: 'Total weight: ' + wsum })));
      root.appendChild(ct);

      var ej = h('div', { class: 'grid g2', style: { marginTop: '16px' } });
      var entries = h('textarea', { rows: '6', id: 'jam-entries', 'aria-label': 'Entries, one per line' }, rub.entries.map(function (e) { return e.name; }).join('\n'));
      ej.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Entries (one per line)' }), entries, h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { type: 'button', class: 'btn', id: 'jam-save-entries', onclick: function () {
        var old = {}; rub.entries.forEach(function (e) { old[e.name] = e.id; });
        rub.entries = entries.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 100).map(function (nm, i) { return { id: old[nm] || ('e' + Date.now().toString(36) + i), name: nm }; }); save(); draw(); } }, 'Save entries'))));
      var judges = h('textarea', { rows: '6', id: 'jam-judges', 'aria-label': 'Judges, one per line' }, rub.judges.map(function (x) { return x.name; }).join('\n'));
      ej.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Judges (one per line)' }), judges, h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { type: 'button', class: 'btn', onclick: function () {
        var old = {}; rub.judges.forEach(function (x) { old[x.name] = x.id; });
        rub.judges = judges.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12).map(function (nm, i) { return { id: old[nm] || ('j' + Date.now().toString(36) + i), name: nm }; }); if (!rub.judges.length) rub.judges = [{ id: 'j1', name: 'Judge 1' }]; j.judge = rub.judges[0].id; save(); draw(); } }, 'Save judges'))));
      root.appendChild(ej);

      if (!rub.entries.length) { root.appendChild(h('div', { class: 'card', style: { marginTop: '16px' } }, h('p', { class: 'muted', text: 'Add entries above to start scoring.' }))); return; }
      if (!rub.judges.some(function (x) { return x.id === j.judge; })) j.judge = rub.judges[0].id;
      var sc = h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Score entries' }),
        UI.field('Scoring as', UI.select(rub.judges.map(function (x) { return [x.id, x.name]; }), j.judge, function (e) { j.judge = e.target.value; save(); draw(); }), 'jam-judge'));
      var sb = h('tbody');
      rub.entries.forEach(function (en) {
        var tr = h('tr', null, h('td', { text: en.name }));
        rub.criteria.forEach(function (c) {
          var cur = j.scores[en.id] && j.scores[en.id][j.judge] && j.scores[en.id][j.judge][c.id];
          tr.appendChild(h('td', null, h('input', { type: 'number', min: '0', max: String(c.max), step: '0.5', value: cur == null ? '' : String(cur), 'aria-label': en.name + ', ' + c.name, style: { width: '72px' }, onchange: function (e) {
            var v = e.target.value; j.scores[en.id] = j.scores[en.id] || {}; j.scores[en.id][j.judge] = j.scores[en.id][j.judge] || {};
            if (v === '') delete j.scores[en.id][j.judge][c.id]; else j.scores[en.id][j.judge][c.id] = Math.max(0, Math.min(+c.max, +v));
            save(); draw(); } })));
        });
        sb.appendChild(tr);
      });
      sc.appendChild(h('div', { class: 'scroll-x' }, h('table', null, h('thead', null, h('tr', null, [h('th', { text: 'Entry' })].concat(rub.criteria.map(function (c) { return h('th', { text: c.name + ' /' + c.max }); })))), sb)));
      root.appendChild(sc);
      var res = S.rubric.totals(rub, j.scores), rb = h('tbody');
      res.forEach(function (r) { rb.appendChild(h('tr', null, h('td', { text: (res.some(function (x) { return x !== r && x.rank === r.rank; }) ? '=' : '') + r.rank }), h('td', { text: r.entry.name }), h('td', { text: r.judged ? r.total.toFixed(2) : '-' }), rub.criteria.map(function (c) { return h('td', { text: r.per[c.id] == null ? '-' : r.per[c.id].toFixed(2) }); }))); });
      root.appendChild(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Results' }), h('div', { class: 'scroll-x' }, h('table', { id: 'jam-results' }, h('thead', null, h('tr', null, [h('th', { text: '#' }), h('th', { text: 'Entry' }), h('th', { text: 'Score /100' })].concat(rub.criteria.map(function (c) { return h('th', { text: c.name }); })))), rb)),
        h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { type: 'button', class: 'btn', onclick: function () {
          var ls = [S.csvLine([j.event]), S.csvLine(['Rank', 'Entry', 'Score out of 100'].concat(rub.criteria.map(function (c) { return c.name + ' (average, max ' + c.max + ')'; })))];
          res.forEach(function (r) { ls.push(S.csvLine([r.rank, r.entry.name, r.total].concat(rub.criteria.map(function (c) { return r.per[c.id] == null ? '' : Math.round(r.per[c.id] * 100) / 100; })))); });
          UI.download('jam-results.csv', ls.join('\r\n') + '\r\n', 'text/csv'); } }, 'Export results (CSV)'), h('a', { class: 'btn', href: '#/results', text: 'Certificates' }))));
    }
    function tSheets() {
      var rub = j.rubric;
      root.appendChild(h('div', { class: 'row noprint', style: { marginBottom: '12px' } }, h('button', { type: 'button', class: 'btn primary', onclick: doPrint }, 'Print score sheets'), h('span', { class: 'fine', text: 'One sheet per judge, with a row for every entry. Add entries and judges on the rubric tab first.' })));
      rub.judges.forEach(function (jg) {
        var tb = h('tbody'), rows = rub.entries.length ? rub.entries : [{ name: '' }, { name: '' }, { name: '' }, { name: '' }, { name: '' }];
        rows.forEach(function (en) { tb.appendChild(h('tr', null, h('td', { text: en.name, style: { minWidth: '140px', height: '34px' } }), rub.criteria.map(function () { return h('td', { text: '' }); }), h('td', { text: '' }))); });
        root.appendChild(h('div', { class: 'paper' }, h('div', { class: 'brandline', text: 'Stark Event Kit - score sheet' }), h('h2', { text: j.event + ': judging sheet' }), h('p', null, 'Judge: ', h('strong', { text: jg.name }), '     Date: ' + '_'.repeat(12)),
          h('table', null, h('thead', null, h('tr', null, [h('th', { text: 'Entry' })].concat(rub.criteria.map(function (c) { return h('th', { text: c.name + ' (0-' + c.max + ', weight ' + c.weight + ')' }); }), [h('th', { text: 'Notes' })]))), tb),
          h('p', { class: 'fine', style: { color: '#444', marginTop: '10px' }, text: rub.criteria.map(function (c) { return c.name + ': ' + (c.desc || ''); }).join('   ') })));
      });
    }
    draw();
    UI.onLeave(function () { if (tick) clearInterval(tick); });
  };

  /* ---------- results, certificates, sheets, export ---------- */
  function sources() {
    var list = [], seen = {}, cur = S.store.get('game', null), hist = S.store.get('history', []), jr = S.jamRows(S.jamLoad());
    if (cur) { list.push({ key: 'cur', label: 'Current event: ' + cur.name, kind: 'event', s: cur }); seen[cur.id] = 1; }
    hist.forEach(function (x) { if (!seen[x.id]) { seen[x.id] = 1; list.push({ key: x.id, label: x.name + ' (' + (x.created || '').slice(0, 10) + ')', kind: 'event', s: x }); } });
    if (jr) list.push({ key: 'jam', label: 'Game jam judging results', kind: 'jam', rows: jr });
    return list;
  }
  function normalise(src) {
    if (src.kind === 'jam') { var j = S.jamLoad(); return { name: j.event, date: todayIso(), unit: 'entry', rows: src.rows.map(function (r) { return { rank: r.rank, tied: src.rows.some(function (x) { return x !== r && x.rank === r.rank; }), name: r.entry.name, score: r.total.toFixed(2) + ' / 100' }; }) }; }
    var s = src.s; return { name: s.name, date: (s.created || '').slice(0, 10) || todayIso(), unit: 'team', rows: S.game.standings(s).map(function (r) { return { rank: r.rank, tied: r.tied, name: r.team.name, score: r.team.score + ' points', by: r.by, team: r.team }; }) };
  }
  function ordinal(n) { var v = n % 100; return n + (v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'); }

/* full version only */
  function swatches(cur, on, label) {
    return h('div', { class: 'swatches', role: 'group', 'aria-label': label }, S.ACCENTS.map(function (c, i) {
      var b = h('button', { type: 'button', class: 'swatch' + (c === cur ? ' on' : ''), 'aria-label': label + ' ' + (i + 1) + (c === cur ? ' (chosen)' : ''), onclick: function () { on(c); } });
      b.style.background = c; return b;
    }));
  }
  function badgePeople(B) {
    if (B.src === 'guests') return S.load('guests').people.filter(function (p) { return p.status === 'registered'; }).map(function (p) { return { name: p.name, team: p.team, type: p.type }; });
    if (B.src === 'teams') {
      var gm = S.store.get('game', null), out = []; if (!gm || !Array.isArray(gm.teams)) return out;
      gm.teams.forEach(function (t) { if (t.members && t.members.length) t.members.forEach(function (m) { out.push({ name: m, team: t.name, type: '' }); }); else out.push({ name: t.name, team: '', type: '' }); });
      return out;
    }
    return B.paste.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 2000).map(function (l) { var p = l.split(','); return { name: p[0].trim(), team: (p[1] || '').trim(), type: (p[2] || '').trim() }; });
  }
  function badges(B, title) {
    var people = badgePeople(B), per = B.layout === '6' ? 6 : 8, pages = [], types = [], acc = S.color(B.accent), i;
    people.forEach(function (p) { if (p.type && types.indexOf(p.type) < 0) types.push(p.type); });
    for (i = 0; i < people.length; i += per) {
      var sheet = h('div', { class: 'paper badgesheet b' + per });
      people.slice(i, i + per).forEach(function (p) {
        var parts = p.name.split(/\s+/), band = h('div', { class: 'badge-band', text: title }), strip = null;
        band.style.background = acc;
        if (B.showType && p.type) { strip = h('div', { class: 'badge-type', text: p.type }); strip.style.background = S.TEAM_COLORS[types.indexOf(p.type) % S.TEAM_COLORS.length]; }
        sheet.appendChild(h('div', { class: 'badge' }, band, h('div', { class: 'badge-first', text: parts[0] }), parts.length > 1 ? h('div', { class: 'badge-full', text: p.name }) : null,
          B.showTeam && p.team ? h('div', { class: 'badge-team', text: p.team }) : null, strip));
      });
      pages.push(sheet);
    }
    return { pages: pages, count: people.length };
  }
  function sheetModel(s) { return { name: s.name, teams: s.teams.map(function (t) { return t.name; }), rounds: s.rounds.map(function (r) { return { name: r.name, qs: s.questions.slice(r.start, r.start + r.count) }; }) }; }
  R.results = function (root, q) {
    var des = S.load('design'), list = sources(), tab = q.tab || 'standings', idx = 0, o = { top: 3, part: true, title: 'Certificate of Achievement', sign1: 'Event host', sign2: 'Organiser', src: 'event', copies: 4, style: 'lines', paper: S.paperui.pick(), order: 'team', tie: true, key: true, cat: 'all', diff: 'mixed', count: 10, seed: 7 };
    function draw() {
      UI.clear(root);
      var np = tab === 'sheets' ? 'noprint' : null;   // the sheets print on their own, without this heading
      root.appendChild(h('h1', { text: 'Results, sheets and certificates', class: np }));
      var tabsEl = UI.tabs([['standings', 'Standings'], ['certs', 'Certificates'], ['badges', 'Name badges'], ['sheets', 'Answer sheets'], ['export', 'Export']], tab, function (t) { tab = t; draw(); });
      if (np) tabsEl.classList.add(np);
      root.appendChild(tabsEl);
      var src = list[idx], model = src ? normalise(src) : null;
      if (list.length && tab !== 'sheets' && tab !== 'badges') root.appendChild(h('div', { class: 'row noprint', style: { marginBottom: '12px' } }, UI.field('Results from', UI.select(list.map(function (x, i) { return [i, x.label]; }), idx, function (e) { idx = +e.target.value; draw(); }), 'res-src')));
      if (tab === 'standings') {
        if (!model) { root.appendChild(h('div', { class: 'card' }, h('p', { text: 'No finished events yet. Run an event or score a game jam and the results appear here.' }), h('a', { class: 'btn primary', href: '#/new', text: 'Set up an event' }))); return; }
        var tb = h('tbody');
        model.rows.forEach(function (r) {
          var t = r.team;
          tb.appendChild(h('tr', null, h('td', { text: (r.tied ? '=' : '') + r.rank }), h('td', { text: r.name }), h('td', { text: r.score }), t ? [h('td', { text: String(t.correct) }), h('td', { text: String(t.wrong) }), h('td', { text: String(t.hard) }), h('td', { text: t.tbDist == null ? '-' : String(t.tbDist) }), h('td', { text: r.tied ? 'tied' : (r.by && r.by !== 'score' ? 'ahead on ' + S.ORDER_LABEL[r.by] : '') })] : null));
        });
        root.appendChild(h('div', { class: 'card scroll-x' }, h('h2', { text: model.name }), h('table', { id: 'res-table' }, h('thead', null, h('tr', null, ['#', model.unit === 'team' ? 'Team' : 'Entry', 'Score'].concat(model.unit === 'team' ? ['Correct', 'Wrong', 'Hard', 'Tie-break', 'Note'] : []).map(function (x) { return h('th', { text: x }); }))), tb),
          h('p', { class: 'fine', text: 'Equal ranks (=) mean a genuine tie after every tie-break rule. Order of rules: ' + S.DEFAULT_ORDER.map(function (x) { return S.ORDER_LABEL[x]; }).join(', then ') + '.' })));
      } else if (tab === 'badges') {
        var B = des.badge, P = S.load('plan'), title = B.sub || P.name || (list[0] && list[0].kind === 'event' ? list[0].s.name : 'Welcome'), made = badges(B, title);
        root.appendChild(h('div', { class: 'card noprint', style: { marginBottom: '14px' } }, h('div', { class: 'grid g4' },
          UI.field('Names from', UI.select([['guests', 'Guest list (booked)'], ['teams', 'Current event teams and players'], ['paste', 'A list I paste']], B.src, function (e) { B.src = e.target.value; saveDes(); draw(); }), 'bd-src'),
          UI.field('Sheet', UI.select([['8', '8 per sheet (3.375 x 2.333 in)'], ['6', '6 per sheet (4 x 3 in)']], B.layout, function (e) { B.layout = e.target.value; saveDes(); draw(); }), 'bd-layout'),
          UI.field('Top line', h('input', { type: 'text', value: B.sub, placeholder: title, maxlength: '60', onchange: function (e) { B.sub = e.target.value.trim(); saveDes(); draw(); } }), 'bd-sub'),
          h('div', null, h('label', { text: 'Colour' }), swatches(S.color(B.accent), function (c) { B.accent = c; saveDes(); draw(); }, 'Badge colour'))),
          B.src === 'paste' ? UI.field('One person per line: name, team, ticket type', h('textarea', { rows: '5', onchange: function (e) { B.paste = e.target.value; saveDes(); draw(); } }, B.paste), 'bd-paste') : null,
          h('div', { class: 'row' }, UI.check('bd-team', 'Show team', B.showTeam, function (v) { B.showTeam = v; saveDes(); draw(); }), UI.check('bd-type', 'Show ticket type as a coloured strip', B.showType, function (v) { B.showType = v; saveDes(); draw(); }),
            h('button', { type: 'button', class: 'btn primary', id: 'bd-print', disabled: !made.count, onclick: doPrint }, 'Print ' + made.count + ' badge' + (made.count === 1 ? '' : 's'))),
          h('p', { class: 'fine', text: 'Laid out as a centred grid on the paper chosen at the top (A4 or US Letter); it is not matched to any brand of label or badge sheet. Print at 100% (no fit to page) and test on plain paper first.' })));
        if (!made.count) root.appendChild(h('div', { class: 'card' }, h('p', { class: 'muted', text: B.src === 'guests' ? 'No booked guests yet. Add them in the Planner, or choose another source.' : B.src === 'teams' ? 'No event yet. Set one up, or choose another source.' : 'Paste some names above.' })));
        made.pages.forEach(function (p) { root.appendChild(p); });
      } else if (tab === 'certs') {
        root.appendChild(window.StarkTrial.card('certificates'));
      } else if (tab === 'sheets') {
        var evs = list.filter(function (x) { return x.kind === 'event'; }), fromEv = o.src === 'event' && evs.length;
        root.appendChild(h('div', { class: 'card noprint', style: { marginBottom: '14px' } }, h('div', { class: 'grid g4' },
          UI.field('Questions from', UI.select([['event', 'A saved event']].concat([['quick', 'A new quick quiz']]), o.src, function (e) { o.src = e.target.value; draw(); }), 's-src'),
          fromEv ? UI.field('Event', UI.select(evs.map(function (x, i) { return [i, x.label]; }), Math.min(idx, evs.length - 1), function (e) { idx = list.indexOf(evs[+e.target.value]); draw(); }), 's-ev') : null,
          !fromEv ? UI.field('Category', UI.select(catOpts(), o.cat, function (e) { o.cat = e.target.value; draw(); }), 's-cat') : null,
          !fromEv ? UI.field('Difficulty', UI.select([['mixed', 'Easy to hard'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], o.diff, function (e) { o.diff = e.target.value; draw(); }), 's-diff') : null,
          !fromEv ? UI.field('Questions', h('input', { type: 'number', min: '1', max: '60', value: String(o.count), onchange: function (e) { o.count = +e.target.value || 10; draw(); } }), 's-count') : null,
          !fromEv ? UI.field('Blank copies', h('input', { type: 'number', min: '1', max: '60', value: String(o.copies), onchange: function (e) { o.copies = +e.target.value || 4; draw(); } }), 's-copies') : null,
          !fromEv ? UI.field('Shuffle number', h('input', { type: 'number', min: '1', max: '99999', value: String(o.seed), onchange: function (e) { o.seed = +e.target.value || 1; draw(); } }), 's-seed') : null,
          UI.field('Sheet style', UI.select(S.paper.STYLES, o.style, function (e) { o.style = e.target.value; draw(); }), 's-style'),
          UI.field('Paper', UI.select(Object.keys(S.paper.PAPERS).map(function (k) { return [k, S.paper.PAPERS[k].label]; }), o.paper, function (e) { o.paper = e.target.value; S.paperui.remember(o.paper); draw(); }), 's-paper'),
          UI.field('Print order', UI.select([['team', 'By team'], ['round', 'By round']], o.order, function (e) { o.order = e.target.value; draw(); }), 's-order')),
          h('div', { class: 'row' }, [['tie', 'Tie-break line'], ['key', 'Answer key page']].map(function (x) { return h('div', { class: 'field inline', style: { margin: 0 } }, h('input', { type: 'checkbox', id: 's-' + x[0], checked: o[x[0]], onchange: function (e) { o[x[0]] = e.target.checked; draw(); } }), h('label', { for: 's-' + x[0], text: x[1] })); }),
            h('button', { type: 'button', class: 'btn primary', onclick: doPrint }, 'Print sheets'))));
        var m;
        if (fromEv) { var ev = list[Math.min(idx, list.length - 1)]; if (!ev || ev.kind !== 'event') ev = evs[0]; m = sheetModel(ev.s); }
        else { var picked = S.pick(S.pool(), { type: 'quiz', cat: o.cat, diff: o.diff, count: o.count }, {}, S.rng(o.seed)); m = { name: 'Quick quiz', teams: null, rounds: [{ name: 'Round 1', qs: picked }] }; }
        var made2 = S.paperui.sheets(m, o), nSheets = made2.desc.filter(function (d) { return d.type === 'sheet'; }).length, bad = made2.desc.filter(function (d) { return d.type === 'sheet' && !d.fits; }).length;
        root.appendChild(h('p', { class: 'fine noprint', id: 's-count', text: nSheets + ' sheet' + (nSheets === 1 ? '' : 's') + (o.key ? ' and an answer key page' : '') + ' on ' + S.paper.paper(o.paper).label + '. Choose the same paper size in the print window and set margins to default. Layouts are sized for A4 and US Letter only; they are not matched to any brand of pre-cut sheet.' + (bad ? ' ' + bad + ' sheet' + (bad === 1 ? ' is' : 's are') + ' too full for one page and may run over.' : '') }));
        made2.els.forEach(function (p) { root.appendChild(p); });
      } else {
        if (!model) { root.appendChild(h('div', { class: 'card', text: 'Nothing to export yet.' })); return; }
        var csv = src.kind === 'event' ? S.game.resultsCsv(src.s) : [S.csvLine([model.name]), S.csvLine(['Rank', 'Entry', 'Score'])].concat(model.rows.map(function (r) { return S.csvLine([r.rank, r.name, r.score]); })).join('\r\n') + '\r\n';
        var base = (model.name || 'results').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        root.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Export results' }), h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', id: 'btn-export-csv', onclick: function () { UI.download(base + '-results.csv', csv, 'text/csv'); } }, 'Download CSV'),
          src.kind === 'event' ? h('button', { type: 'button', class: 'btn', onclick: function () { var c = clone(src.s); c.questions.forEach(function (x) { delete x.img; }); UI.download(base + '-event.json', JSON.stringify(c, null, 1), 'application/json'); } }, 'Download full event (JSON)') : null),
          h('p', { class: 'fine', text: 'If your browser blocks the download, select and copy the text below.' }), h('textarea', { rows: '10', readonly: true, 'aria-label': 'Results CSV text', id: 'export-text' }, csv)));
      }
    }
    function saveDes() { if (!S.save('design', des)) UI.toast('Could not save the design.'); }
    function catOpts() { return [['all', 'All categories']].concat(S.CATS.map(function (c) { return [c.id, c.name]; })); }
    if (!list.length) o.src = 'quick';
    draw();
  };
})(window);
