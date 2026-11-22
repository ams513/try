/* Stark Ledger. Views added in 1.2: Ask your books, Books Doctor, bank reconciliation and the cash what-if simulator.
   All text is set with textContent (never innerHTML); charts are built with SVG DOM calls. Works with keyboard only. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, R = L.routes;
  const guard = fn => ev => { try { fn(ev); } catch (e) { L.toast(e.message, true); } };
  const head = (title, ...right) => h('div', { class: 'page-head' }, h('h1', null, title), right.length ? h('div', { class: 'row' }, right) : null);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs, ...kids) => { const el = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(k => el.setAttribute(k, attrs[k])); kids.forEach(k => k && el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k)); return el; };
  const money = (c, cls) => h('span', { class: cls || '' }, C.fmt(c));

  /* ---------- Ask your books ---------- */
  const EXAMPLES = ['How much did I spend on software this year?', 'Who owes me money?', 'Net profit last quarter', 'Top clients this year', 'What did I earn in March?', 'Cash on hand', 'What do I owe vendors?', 'Spend on fuel last 90 days'];
  function answerCard(a) {
    const max = Math.max(1, ...a.rows.map(r => Math.abs(r[1])));
    const list = a.rows.length ? h('ul', { class: 'askbars', 'aria-label': 'Breakdown' }, a.rows.map(r => h('li', null, h('span', { class: 'al' }, r[0]), h('span', { class: 'ab', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(2, Math.round(Math.abs(r[1]) / max * 100)) + '%' })), h('span', { class: 'av ' + (r[1] < 0 ? 'neg' : '') }, C.fmt(r[1]))))) : null;
    const mo = a.months && a.months.length > 1 ? h('div', { class: 'stack' }, h('h3', null, 'By month'), h('ul', { class: 'askbars', 'aria-label': 'By month' }, (() => { const mm = Math.max(1, ...a.months.map(r => Math.abs(r[1]))); return a.months.map(r => h('li', null, h('span', { class: 'al' }, r[0]), h('span', { class: 'ab', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(r[1] ? 2 : 0, Math.round(Math.abs(r[1]) / mm * 100)) + '%' })), h('span', { class: 'av' }, C.fmt(r[1])))); })())) : null;
    return h('div', { class: 'card stack', id: 'ask-answer' }, h('div', { class: 'bigans' }, a.value != null ? h('div', { class: 'k' }, 'Answer') : null, h('h2', { class: 'anstitle' }, a.title)), a.value != null ? h('div', { class: 'bigv ' + (a.value < 0 ? 'neg' : '') }, C.fmt(a.value)) : null,
      list, mo, h('div', { class: 'row' }, a.hash ? h('a', { class: 'btn', href: a.hash }, 'Open the details') : null, h('span', { class: 'muted small' }, 'Worked out on this computer from your books, ' + a.period.label + '.')));
  }
  R.ask = function (arg) {
    const st = L.st, t = C.today(); const q = h('input', { type: 'search', id: 'ask-q', class: 'askin', 'aria-label': 'Ask a question about your books', placeholder: 'Ask: how much did I spend on software in Q3?', autocomplete: 'off', spellcheck: 'false' }), out = h('div', { role: 'region', 'aria-live': 'polite', 'aria-label': 'Answer' });
    const run = text => { L.clear(out); text = String(text || '').trim(); if (!text) return; const a = C.ask(st, text, t);
      out.appendChild(a ? answerCard(a) : h('div', { class: 'card', id: 'ask-none' }, h('h2', null, 'I could not work that out'), h('p', { class: 'muted' }, 'Try a question about spending, income, profit, who owes you, what you owe, cash, or your top clients and vendors, with a period like "last month" or "Q3". Quick search (Ctrl+K) finds names and amounts.'))); L.tr(out); };
    q.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); run(q.value); } });
    const chips = h('div', { class: 'row wrap examples' }, EXAMPLES.map(e => h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { q.value = e; run(e); q.focus(); } }, e)));
    if (arg) { q.value = decodeURIComponent(arg); run(q.value); }
    return h('div', { class: 'stack' }, head('Ask your books'), h('div', { class: 'card stack' }, h('div', { class: 'row' }, q, h('button', { class: 'btn primary', id: 'ask-go', onclick: () => run(q.value) }, 'Ask')), chips,
      h('p', { class: 'muted small' }, 'Plain questions, answered on this computer from your own numbers. No cloud, no model download. It understands periods (this month, last quarter, Q3, in March 2025, last 30 days), categories, clients and vendors, and forgives a typo.')), out,
      L.guide('Answers add up what is in your books. If entries are missing or miscategorised the answer will be too. Not tax advice.'));
  };

  /* ---------- Books Doctor ---------- */
  const SEV = { high: ['Look first', 'red'], med: ['Worth a check', 'amber'], low: ['Minor', 'dim'] };
  R.doctor = function () {
    const st = L.st, d = C.doctor(st, C.today()), r = 54, circ = 2 * Math.PI * r, col = d.score >= 90 ? 'var(--good)' : d.score >= 70 ? 'var(--accent)' : d.score >= 45 ? 'var(--warn)' : 'var(--bad)';
    const ring = svg('svg', { viewBox: '0 0 130 130', width: '130', height: '130', role: 'img', 'aria-label': 'Books health score ' + d.score + ' out of 100: ' + d.grade }, svg('circle', { cx: 65, cy: 65, r, fill: 'none', stroke: 'var(--line)', 'stroke-width': 10 }),
      svg('circle', { cx: 65, cy: 65, r, fill: 'none', stroke: col, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': (circ * d.score / 100).toFixed(1) + ' ' + circ.toFixed(1), transform: 'rotate(-90 65 65)' }), svg('text', { x: 65, y: 72, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 700, fill: 'var(--text)' }, String(d.score)));
    const counts = ['high', 'med', 'low'].map(k => d.findings.filter(f => f.sev === k).length);
    const items = d.findings.length ? h('ul', { class: 'finds', id: 'doctor-list' }, d.findings.map(f => h('li', { class: 'find ' + f.sev }, h('div', { class: 'ft' }, L.chip(SEV[f.sev][0], SEV[f.sev][1]), h('b', null, f.title)), h('div', { class: 'muted' }, f.detail), f.hash ? h('a', { class: 'btn sm', href: f.hash }, 'Look into it') : null))) : h('p', { class: 'pos', id: 'doctor-clean' }, 'Nothing stands out. Your books look tidy.');
    return h('div', { class: 'stack' }, head('Books Doctor', h('button', { class: 'btn', id: 'doctor-rescan', onclick: () => L.render() }, 'Scan again')),
      h('div', { class: 'card doctor-top' }, ring, h('div', { class: 'stack' }, h('h2', { id: 'doctor-grade' }, d.grade), h('p', { class: 'muted' }, 'Scanned ' + d.checked + ' entries on this computer: ' + counts[0] + ' to look at first, ' + counts[1] + ' worth a check, ' + counts[2] + ' minor.'))),
      h('div', { class: 'card stack' }, h('h2', null, 'What it found'), items),
      L.guide('The scan looks for patterns that often mean a slip: repeated entries, amounts far above the usual, gaps in invoice numbers, regular payments that stopped, late items. A finding is a prompt to look, not proof of an error, and a clean scan does not prove the books are right.'));
  };

  /* ---------- bank reconciliation ---------- */
  const rc = { date: null, bal: '', ids: new Set(), rows: null, msg: '' };
  R.reconcile = function () {
    const st = L.st, t = C.today(); rc.date = rc.date || t;
    const dateIn = L.input({ type: 'date', id: 'rc-date', value: rc.date }), balIn = L.moneyInput(null, { id: 'rc-bal', 'aria-label': 'Statement ending balance' }); balIn.value = rc.bal;
    dateIn.addEventListener('change', () => { rc.date = dateIn.value || rc.date; rc.ids = new Set(Array.from(rc.ids).filter(id => C.reconUncleared(st, rc.date).some(x => x.id === id))); L.render(); });
    const list = C.reconUncleared(st, rc.date), boxes = {}, sumBox = h('div', { class: 'recsum', id: 'rc-sum', role: 'status', 'aria-live': 'polite' }), finish = h('button', { class: 'btn primary', id: 'rc-finish' }, 'Finish reconciliation');
    const cleared = C.reconClearedBalance(st);
    const update = () => {
      const bal = C.toCents(balIn.value), has = !isNaN(bal) && balIn.value.trim() !== '', ids = Array.from(rc.ids), picked = list.filter(x => rc.ids.has(x.id)).reduce((s, x) => s + x.amount, 0), diff = has ? C.reconDifference(st, bal, ids) : null; rc.bal = balIn.value; L.clear(sumBox);
      sumBox.appendChild(h('div', { class: 'grid4' }, [['Already reconciled', C.fmt(cleared)], ['Ticked now (' + ids.length + ')', C.fmt(picked)], ['Statement ending balance', has ? C.fmt(bal) : 'enter it above'], ['Difference', diff == null ? '-' : C.fmt(diff)]].map((k, i) => h('div', { class: 'card stat' + (i === 3 && diff === 0 ? ' ok' : '') }, h('div', { class: 'k' }, k[0]), h('div', { class: 'v ' + (i === 3 && diff != null ? (diff === 0 ? 'pos' : 'neg') : '') }, k[1])))));
      sumBox.appendChild(h('p', { class: diff === 0 ? 'pos' : 'muted', id: 'rc-state' }, diff === 0 ? 'Balanced: the ticked entries explain the statement exactly.' : has ? 'Keep ticking until the difference is $0.00.' : 'Type the ending balance from your bank statement.'));
      finish.disabled = !(diff === 0 && ids.length > 0);
    };
    const matchBtn = (() => { const tx = h('textarea', { rows: 4, id: 'rc-csv', placeholder: 'Paste statement CSV: Date,Description,Amount', 'aria-label': 'Statement CSV text' }), file = h('input', { type: 'file', accept: '.csv,text/csv,text/plain', id: 'rc-file', 'aria-label': 'Statement CSV file' }), note = h('p', { class: 'muted small', id: 'rc-match-note' }, rc.msg);
      const go = text => { const p = C.parseBankCSV(text, {}); if (!p.rows.length) { note.textContent = p.errors[0] || 'No usable rows found.'; return; } const m = C.reconMatch(st, p.rows, rc.date); m.matches.forEach(x => rc.ids.add(x.entryId));
        rc.msg = m.matches.length + ' of ' + p.rows.length + ' statement lines matched and ticked by amount, date and description.' + (m.unmatchedRows.length ? ' Not found in your books: ' + m.unmatchedRows.slice(0, 5).map(r => r.date + ' ' + r.desc + ' ' + C.fmt(r.amount)).join('; ') + (m.unmatchedRows.length > 5 ? '...' : '') + '. Use Import CSV to add them.' : ''); L.render(); };
      file.addEventListener('change', () => { const f = file.files[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { note.textContent = 'That file is too large for a statement.'; return; } const rd = new FileReader(); rd.onload = () => go(String(rd.result)); rd.readAsText(f); });
      return h('div', { class: 'stack' }, h('h3', null, 'Auto-match from a statement file (optional)'), file, tx, h('div', { class: 'row' }, h('button', { class: 'btn', id: 'rc-match', onclick: () => go(tx.value) }, 'Match and tick'), note)); })();
    balIn.addEventListener('input', update);
    const rows = list.map(x => { const cb = h('input', { type: 'checkbox', checked: rc.ids.has(x.id), 'aria-label': 'Cleared: ' + (x.memo || 'entry') + ' ' + C.fmt(x.amount), onchange: () => { if (cb.checked) rc.ids.add(x.id); else rc.ids.delete(x.id); update(); } }); boxes[x.id] = cb; return h('tr', null, h('td', null, cb), h('td', null, x.date), h('td', null, x.memo || '(no memo)'), L.num(C.fmt(x.amount), x.amount < 0 ? 'neg' : 'pos')); });
    const all = h('button', { class: 'btn sm', id: 'rc-all', onclick: () => { list.forEach(x => { rc.ids.add(x.id); boxes[x.id].checked = true; }); update(); } }, 'Tick all'), none = h('button', { class: 'btn sm', onclick: () => { rc.ids.clear(); list.forEach(x => { boxes[x.id].checked = false; }); update(); } }, 'Clear ticks');
    finish.addEventListener('click', guard(() => { const bal = C.toCents(balIn.value); const rec = C.reconFinish(st, { date: rc.date, endBal: bal, ids: Array.from(rc.ids) }); rc.ids = new Set(); rc.bal = ''; rc.msg = ''; L.commit(); L.toast('Reconciled ' + rec.count + ' entries through ' + rec.date + '.'); }));
    const hist = (st.recon || []).slice().reverse(), last = hist[0];
    update();
    return h('div', { class: 'stack' }, head('Reconcile'),
      h('div', { class: 'card stack' }, h('p', { class: 'muted' }, 'Tick the entries that appear on your bank statement. When the difference reaches $0.00 the books agree with the bank, and those entries are marked reconciled.'), h('div', { class: 'row' }, L.field('Statement end date', dateIn), L.field('Statement ending balance ($)', balIn)), matchBtn),
      sumBox, h('div', { class: 'card stack' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, list.length + ' entr' + (list.length === 1 ? 'y' : 'ies') + ' not yet reconciled'), all, none), list.length ? L.table(['', 'Date', 'Description', { t: 'Amount', cls: 'num' }], rows, 'recon') : h('p', { class: 'muted' }, 'Everything up to this date is reconciled.')),
      h('div', { class: 'row end' }, last ? h('button', { class: 'btn danger', id: 'rc-undo', onclick: () => L.confirm('Undo the reconciliation for ' + last.date + '? Its ' + last.count + ' entries become unreconciled again.', 'Undo', guard(() => { C.reconUndo(st); L.commit(); }), true) }, 'Undo last reconciliation') : null, finish),
      hist.length ? h('div', { class: 'card' }, h('h2', null, 'History'), L.table(['Statement date', { t: 'Ending balance', cls: 'num' }, { t: 'Entries', cls: 'num' }, 'Done on'], hist.map(x => h('tr', null, h('td', null, x.date), L.num(C.fmt(x.endBal)), L.num(String(x.count)), h('td', null, x.doneOn))))) : null,
      L.guide('Reconciling compares your books with the statement you give it. It does not contact your bank, and a $0.00 difference proves the ticked entries match the statement, not that every entry is categorised correctly.'));
  };

  /* ---------- cash what-if simulator (rendered on the Cash forecast page) ---------- */
  const SC0 = { delay: 0, billDelay: 0, skipClient: '', extraOut: 0, extraIn: 0, oneAmt: 0, oneDate: '' };
  let sc = Object.assign({}, SC0);
  L.whatIfCard = function (weeks) {
    const st = L.st, t = C.today(); if (!sc.oneDate) sc.oneDate = C.addDays(t, 21);
    const out = h('div', { class: 'stack', id: 'wi-out', role: 'region', 'aria-live': 'polite', 'aria-label': 'What-if result' });
    const range = (id, label, key, max, step, unit) => { const o = h('output', { for: id, class: 'wi-val' }, sc[key] + ' ' + unit), r = h('input', { type: 'range', id, min: 0, max, step, value: sc[key], 'aria-label': label }); r.addEventListener('input', () => { sc[key] = +r.value; o.textContent = sc[key] + ' ' + unit; draw(); }); return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label, ' ', o), r); };
    const cl = L.select([['', 'Nobody'], ...st.clients.map(c => [c.id, c.name])], sc.skipClient, { id: 'wi-client', 'aria-label': 'Lose a client' }); cl.addEventListener('change', () => { sc.skipClient = cl.value; draw(); });
    const mon = (id, label, key) => { const i = L.moneyInput(sc[key] || null, { id, 'aria-label': label }); i.addEventListener('input', () => { const c = C.toCents(i.value); sc[key] = isNaN(c) || c < 0 ? 0 : c; draw(); }); return L.field(label, i); };
    const od = L.input({ type: 'date', id: 'wi-date', value: sc.oneDate, 'aria-label': 'One-off purchase date' }); od.addEventListener('change', () => { sc.oneDate = od.value || sc.oneDate; draw(); });
    function chart(r) {
      const W = 640, H = 190, P = 28, pts = (f) => f.weeks.map(w => w.balance), a = pts(r.base), b = pts(r.alt), all = a.concat(b, [0]), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), span = Math.max(1, hi - lo), n = a.length;
      const X = i => P + i * (W - 2 * P) / Math.max(1, n - 1), Y = v => H - P - (v - lo) / span * (H - 2 * P), line = arr => arr.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
      return svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'wichart', role: 'img', 'aria-label': 'Projected cash by week. Without changes it ends at ' + C.fmt(r.base.finish) + '; with this scenario it ends at ' + C.fmt(r.alt.finish) + '.' },
        svg('line', { x1: P, x2: W - P, y1: Y(0), y2: Y(0), stroke: 'var(--line)', 'stroke-width': 1 }), svg('text', { x: P, y: Y(0) - 4, 'font-size': 11, fill: 'var(--muted)' }, '$0'),
        svg('path', { d: line(a), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }), svg('path', { d: line(b), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
        svg('circle', { cx: X(n - 1), cy: Y(b[n - 1]), r: 4.5, fill: 'var(--accent)' }));
    }
    function draw() {
      const sc2 = { delay: sc.delay, billDelay: sc.billDelay, skipClient: sc.skipClient, extraOut: sc.extraOut, extraIn: sc.extraIn, oneOff: { date: sc.oneDate, amount: sc.oneAmt } }, r = C.scenario(st, t, weeks, sc2), moved = r.deltaFinish !== 0 || r.deltaLow !== 0 || r.runwayAlt !== r.runwayBase;
      const k = (label, v, extra, cls) => h('div', { class: 'card stat' }, h('div', { class: 'k' }, label), h('div', { class: 'v ' + (cls || '') }, v), extra ? h('div', { class: 'sub' }, extra) : null);
      const rw = r.runwayAlt ? 'Cash runs out in week ' + r.runwayAlt : 'Stays above $0';
      L.clear(out); out.appendChild(chart(r));
      out.appendChild(h('div', { class: 'grid3' }, k('Cash in ' + weeks + ' weeks', C.fmt(r.alt.finish), 'was ' + C.fmt(r.base.finish) + ', change ' + (r.deltaFinish >= 0 ? '+' : '') + C.fmt(r.deltaFinish), r.deltaFinish < 0 ? 'neg' : r.deltaFinish > 0 ? 'pos' : ''), k('Lowest point', C.fmt(r.alt.low.balance), 'week of ' + r.alt.low.from + ', was ' + C.fmt(r.base.low.balance), r.alt.low.balance < 0 ? 'neg' : ''), k('Runway', rw, r.runwayBase && !r.runwayAlt ? 'it was week ' + r.runwayBase : r.runwayAlt !== r.runwayBase ? 'was ' + (r.runwayBase ? 'week ' + r.runwayBase : 'above $0') : 'no change', r.runwayAlt ? 'neg' : 'pos')));
      out.appendChild(h('p', { class: 'muted small', id: 'wi-note' }, moved ? 'Solid line: this scenario. Dashed line: your books as they are.' : 'Move a control to see how the next ' + weeks + ' weeks change. Nothing here is saved or posted to your books.')); L.tr(out);
    }
    const reset = h('button', { class: 'btn sm', id: 'wi-reset', onclick: () => { sc = Object.assign({}, SC0); L.render(); } }, 'Reset');
    draw();
    return h('div', { class: 'card stack', id: 'whatif' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'What if...'), reset), h('p', { class: 'muted small' }, 'Drag the controls and watch the forecast move. A live simulator running on your own numbers; nothing is saved.'),
      h('div', { class: 'grid3' }, range('wi-delay', 'Clients pay later by', 'delay', 60, 5, 'days'), range('wi-bill', 'You pay bills later by', 'billDelay', 45, 5, 'days'), L.field('Lose a client', cl)),
      h('div', { class: 'grid4' }, mon('wi-out-m', 'Extra cost per month ($)', 'extraOut'), mon('wi-in-m', 'Extra income per month ($)', 'extraIn'), mon('wi-one', 'One-off purchase ($)', 'oneAmt'), L.field('On', od)), out);
  };
})();
