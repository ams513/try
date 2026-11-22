/* Stark Trades 2.2. The Cash radar page: a 13-week cash forecast with a what-if simulation, margin watch with the chance each
   job ends in the red, and plain-language answers in quick search. Logic lives in core4.js. SVG is built with DOM calls. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, t = C.t, tn = C.tn, tt = C.tt, N = C.N;
  const NS = 'http://www.w3.org/2000/svg', T = () => C.today(), stat = (k, v, sub, id) => L.stat(k, v, sub, id);
  function sv(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) { const v = attrs[k]; if (v === null || v === undefined || v === false) continue; if (k === 'text') el.textContent = v; else el.setAttribute(k, String(v)); }
    for (let i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }
  const centsIn = (v, what) => { const s = String(v == null ? '' : v).trim(); if (!s) return 0; const c = C.toCents(s); if (isNaN(c) || c < -100000000000 || c > 100000000000) throw new Error(t('Enter {what} as an amount like 2500 or 2,500.00', { what })); return c; };
  const KIND = { invoice: N('Invoice'), plan: N('Plan bill'), sub: N('Sub payment'), po: N('Supplier order') };
  const LEVEL = { red: 'red', amber: 'amber', info: 'blue' }, LEVEL_TXT = { red: N('Act now'), amber: N('Look at'), info: N('Note') };

  function fan(fc) {
    const W = 760, H = 250, pl = 70, pr = 14, pt = 12, pb = 30, s = fc.series;
    let lo = Math.min(0, ...s.map(x => x.p10), fc.open), hi = Math.max(1, ...s.map(x => x.p90), fc.open); const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const X = k => pl + (k + 0.5) / s.length * (W - pl - pr), Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'radar-svg', role: 'img', 'aria-label': t('Cash forecast chart. The middle line ends at {end}. The lowest likely point is {low} in week {w}.', { end: C.fmt0(fc.series[fc.series.length - 1].p50), low: C.fmt0(fc.lowestP10), w: fc.lowestP10Week }) });
    for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4; svg.appendChild(sv('line', { x1: pl, x2: W - pr, y1: Y(v), y2: Y(v), stroke: 'var(--line)', 'stroke-width': 1 })); svg.appendChild(sv('text', { x: pl - 6, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)', text: C.fmt0(Math.round(v / 10000) * 10000) })); }
    const pts = k => s.map((x, i) => X(i).toFixed(1) + ',' + Y(x[k]).toFixed(1));
    svg.appendChild(sv('polygon', { points: pts('p90').concat(pts('p10').reverse()).join(' '), fill: 'var(--accent)', 'fill-opacity': 0.2 }));
    if (lo < 0) { svg.appendChild(sv('rect', { x: pl, y: Y(0), width: W - pl - pr, height: Math.max(0, Y(lo) - Y(0)), fill: 'var(--coral)', 'fill-opacity': 0.09 })); }
    svg.appendChild(sv('line', { x1: pl, x2: W - pr, y1: Y(0), y2: Y(0), stroke: 'var(--coral)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
    svg.appendChild(sv('polyline', { points: pts('nominal').join(' '), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }));
    svg.appendChild(sv('polyline', { points: pts('p50').join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    s.forEach((x, i) => { if (i % 2 === 0 || s.length < 9) svg.appendChild(sv('text', { x: X(i), y: H - 10, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)', text: 'W' + x.week })); });
    const lw = s[fc.lowestP10Week - 1]; if (lw) svg.appendChild(sv('circle', { cx: X(lw.week - 1), cy: Y(lw.p10), r: 5, fill: lw.p10 < 0 ? 'var(--coral)' : 'var(--warn)', stroke: 'var(--bg)', 'stroke-width': 2 }));
    return svg;
  }
  function numInput(id, label, value, hint, onset) {
    const inp = L.input({ id, inputmode: 'decimal', value: value ? String((value / 100).toFixed(2)) : '', 'aria-label': label });
    inp.addEventListener('change', () => { try { onset(centsIn(inp.value, label)); } catch (e) { L.toast(e.message, true); } L.save(); L.render(); });
    return L.field(label, inp, hint);
  }
  function slider(id, label, value, min, max, unit, onset) {
    const out = h('output', { class: 'fine', for: id }, tn(value, '{n} day', '{n} days')), inp = h('input', { type: 'range', id, min, max, step: 1, value, 'aria-label': label });
    inp.addEventListener('input', () => { out.textContent = tn(+inp.value, '{n} day', '{n} days'); });
    inp.addEventListener('change', () => { onset(+inp.value); L.save(); L.render(); });
    return L.field(label, h('span', { class: 'row' }, inp, out), unit);
  }

  L.routes.radar = function () {
    const st = L.st, today = T(); st.company.radar = Object.assign({ open: 0, overhead: 0, delay: 0, subShift: 0 }, st.company.radar || {}); const o = st.company.radar;
    const fc = C.cashForecast(st, today, o), mw = C.marginWatch(st, today), risks = C.jobRisks(st, today).slice(0, 8);
    const short = fc.probNegative >= 0.05;
    const inputs = h('section', { class: 'card stack', id: 'radar-inputs' }, h('h2', null, t('Your numbers and what-ifs')),
      h('div', { class: 'grid2' }, numInput('radar-open', t('Cash in the bank now'), o.open, t('Optional. Type it to see when you could run short.'), v => { o.open = v; }),
        numInput('radar-over', t('Fixed costs per week'), o.overhead, t('Rent, insurance, payroll and anything else that goes out every week.'), v => { o.overhead = Math.max(0, v); })),
      h('div', { class: 'grid2' }, slider('radar-delay', t('What if customers pay later than usual by'), o.delay, 0, 45, null, v => { o.delay = v; }), slider('radar-shift', t('What if you pay subs and suppliers later by'), o.subShift, 0, 30, null, v => { o.subShift = v; })));
    const best = fc.events.ins.slice().sort((a, b) => a.expected < b.expected ? -1 : 1), outs = fc.events.outs.slice().sort((a, b) => a.expected < b.expected ? -1 : 1);
    const evRows = best.map(e => ({ e, in: true })).concat(outs.map(e => ({ e, in: false }))).sort((a, b) => a.e.expected < b.e.expected ? -1 : a.e.expected > b.e.expected ? 1 : 0).slice(0, 14);
    const evTable = evRows.length ? L.table([t('Expected'), t('What'), t('Who'), { t: t('Amount'), cls: 'num' }], evRows.map(x => h('tr', null, h('td', null, C.fmtShort(x.e.expected)), h('td', null, h('span', { class: 'chip ' + (x.in ? 'green' : 'amber') }, x.in ? t('In') : t('Out')), ' ' + t(KIND[x.e.kind]) + (x.e.ref ? ' ' + x.e.ref : '')),
      h('td', null, h('a', { href: x.e.href }, x.e.who)), h('td', { class: 'num' }, (x.in ? '+' : '-') + C.fmt0(x.e.amount))))) : L.empty(t('Nothing unpaid and nothing owed. Bill a job or record a sub payment to see money move.'));
    const watchList = mw.items.length ? h('ul', { class: 'watch-list', id: 'watch-list' }, mw.items.slice(0, 14).map(i => h('li', null, h('span', { class: 'chip ' + LEVEL[i.level] }, t(LEVEL_TXT[i.level])), ' ', h('a', { href: i.href }, i.text)))) : L.empty(t('Nothing looks off. Margins and payments are inside your targets.'));
    const riskTable = risks.length ? L.table([t('Job'), t('Stage'), { t: t('Likely profit'), cls: 'num' }, { t: t('Range (low to high)'), cls: 'num' }, { t: t('Chance of a loss'), cls: 'num' }], risks.map(x => h('tr', null, h('td', null, h('a', { href: '#/job/' + x.job.id }, x.job.num + ' ' + tt(x.job.title))), h('td', null, t(C.stageName(x.job.stage))),
      h('td', { class: 'num' }, C.fmt0(x.risk.p50)), h('td', { class: 'num' }, C.fmt0(x.risk.p10) + ' to ' + C.fmt0(x.risk.p90)), h('td', { class: 'num' }, h('span', { class: 'chip ' + (x.risk.pLoss >= 0.25 ? 'red' : x.risk.pLoss >= 0.05 ? 'amber' : 'green') }, Math.round(x.risk.pLoss * 100) + '%'))))) : L.empty(t('No active jobs with a contract yet.'));
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, t('Cash radar')), h('p', { class: 'muted' }, t('The next {n} weeks, from what customers owe you and what you owe, using how late each customer really pays.', { n: fc.weeks })))),
      h('div', { class: 'grid4', id: 'radar-stats' }, stat(t('Owed to you'), C.fmt0(fc.owed), fc.overdue ? t('{amt} is past due', { amt: C.fmt0(fc.overdue) }) : t('nothing past due'), 'rs-owed'), stat(t('You owe'), C.fmt0(fc.payable), t('subs and suppliers'), 'rs-owe'),
        stat(t('Lowest likely point'), C.fmt0(fc.lowestP10), t('week {n}, 1 time in 10', { n: fc.lowestP10Week }), 'rs-low'), stat(t('Chance of going short'), Math.round(fc.probNegative * 100) + '%', o.open || o.overhead ? t('of 1,000 what-if runs') : t('type your cash below to test this'), 'rs-short')),
      short ? h('p', { class: 'note bad', role: 'status', id: 'radar-warn' }, fc.firstShortWeek ? t('In the likely-low case you run short in week {n}. Chase the overdue invoices first, or try the sliders below.', { n: fc.firstShortWeek }) : t('Some runs dip below zero. Try the sliders below.')) : null,
      h('section', { class: 'card stack', id: 'radar-chart' }, h('h2', null, t('Cash in the bank, week by week')), fan(fc),
        h('p', { class: 'fine' }, t('Solid line: the middle outcome. Shaded band: 8 in 10 outcomes. Dashed grey: if everyone pays on their usual day. Red dashed: zero. The simulation moves each payment by how late that customer paid before ({avg}).', { avg: fc.habits.avgLate == null ? t('no history yet, so a typical spread is used') : t('{n} days late on average', { n: fc.habits.avgLate }) }))),
      inputs,
      h('section', { class: 'card stack', id: 'radar-events' }, h('h2', null, t('Next money in and out')), evTable),
      h('div', { class: 'page-head' }, h('div', null, h('h2', null, t('Margin watch')), h('p', { class: 'muted' }, t('Leaks, odd jobs out and late payments found in your own records.')))),
      h('div', { class: 'grid3', id: 'watch-stats' }, stat(t('Act now'), String(mw.red), t('losses and invoices over 30 days late'), 'ws-red'), stat(t('Look at'), String(mw.amber), t('thin margins, unbilled work, odd jobs'), 'ws-amber'), stat(t('Money in question'), C.fmt0(mw.atRisk), t('against a {n}% margin target', { n: (mw.target / 100).toFixed(0) }), 'ws-risk')),
      h('section', { class: 'card stack', id: 'watch-card' }, h('h2', null, t('What needs a look')), watchList),
      h('section', { class: 'card stack', id: 'risk-card' }, h('h2', null, t('Chance each job ends in the red')), riskTable, h('p', { class: 'fine' }, t('Each cost can still move by an amount that shrinks as the job nears the end; a finished job with real costs barely moves.'))),
      h('p', { class: 'fine' }, t('A planning aid built from the dates and amounts you entered, not a promise, a credit decision, or accounting or tax advice.')));
  };
})();
