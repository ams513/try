/* Stark Warden: "Call patterns" screen. Heat map of when collectors reach you, a weekly trend, and a live call-budget clock per debt.
   Built from the contact log saved on this device; nothing is sent anywhere. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, sv = ui.sv, S = SW.store, I = SW.insights;

  function tz() { var p = S.get('dprofile', {}); return (p && typeof p.tz === 'string' && p.tz) || 'America/New_York'; }
  function nowEpoch(zone) { var p = SW.violations.localParts(new Date().toISOString(), zone); return p ? p.epoch : Math.floor(Date.now() / 60000); }
  function level(v, max) { return v === 0 ? 0 : max <= 1 ? 4 : Math.min(4, 1 + Math.floor((v - 1) * 4 / max)); }

  function heatSvg(hm) {
    var cw = 26, ch = 26, L = 44, T = 22, W = L + 24 * cw + 4, H = T + 7 * ch + 20, kids = [], d, hr, v;
    for (hr = 0; hr < 24; hr += 3) { kids.push(sv('text', { x: L + hr * cw + 2, y: 14, class: 'axis', text: I.hourLabel(hr).replace('.m.', 'm').replace(' ', '') })); }
    for (d = 0; d < 7; d++) {
      kids.push(sv('text', { x: 0, y: T + d * ch + 17, class: 'axis', text: hm.days[d].slice(0, 3) }));
      for (hr = 0; hr < 24; hr++) {
        v = hm.grid[d][hr];
        kids.push(sv('rect', { x: L + hr * cw + 1, y: T + d * ch + 1, width: cw - 2, height: ch - 2, rx: 4, class: 'hm h' + level(v, hm.max) + (hr < 8 || hr >= 21 ? ' odd' : '') },
          sv('title', { text: hm.days[d] + ' ' + I.hourLabel(hr) + ': ' + v + (v === 1 ? ' contact' : ' contacts') })));
      }
    }
    kids.push(sv('rect', { x: L + 8 * cw, y: T - 2, width: 13 * cw, height: 7 * ch + 4, rx: 6, class: 'hm-window' }));
    kids.push(sv('text', { x: L + 8 * cw + 4, y: H - 4, class: 'axis', text: 'Outlined: 8 a.m. to 9 p.m., the usual allowed hours' }));
    return sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'wchart heat', role: 'img', 'aria-label': 'Heat map of ' + hm.total + ' collector contacts by weekday and hour.' + (hm.busiest ? ' Busiest: ' + hm.busiest.day + ' at ' + I.hourLabel(hm.busiest.hour) + '.' : '') + ' ' + hm.outside + ' outside 8 a.m. to 9 p.m.' }, kids);
  }

  function heatTable(hm) {
    var rows = [];
    hm.days.forEach(function (d, i) { var cells = []; hm.grid[i].forEach(function (v, hr) { if (v) { cells.push(I.hourLabel(hr) + ': ' + v); } }); if (cells.length) { rows.push([d, cells.join(', ')]); } });
    return rows.length ? ui.table(['Day', 'Contacts by hour'], rows) : h('p', { class: 'muted', text: 'No contacts yet.' });
  }

  /* now: minutes in the log's time zone; the card shows the budget as of that minute */
  function budgetCard(b, i, now) {
    var id = 'bd-' + i, left = b.quietUntil ? b.quietUntil - now : 0, clock;
    clock = left > 0 ? h('p', { class: 'budget-clock hot', text: 'A new call before ' + I.stamp(b.quietUntil) + ' would be presumed harassment (' + b.why.join(' and ') + '). Time left: ' + I.span(left) + '.' })
      : h('p', { class: 'budget-clock', text: b.left + (b.left === 1 ? ' call' : ' calls') + ' left in the last 7 days before the 7-in-7 presumption would apply.' });
    return h('div', { class: 'budget' + (left > 0 ? ' hot' : '') },
      h('div', { class: 'row between' }, h('strong', { text: b.name }), h('span', { class: 'small', text: 'last call ' + b.last })),
      h('label', { class: 'small', for: id }, b.used + ' of 7 calls in the last 7 days'),
      h('progress', { id: id, max: 7, value: Math.min(7, b.used) }), clock);
  }
  /* the whole budget is worked out again on each tick, so calls leaving the 7-day window free up the count as well as the clock */
  function drawBudget(box, log, zone) {
    var now = nowEpoch(zone), bd = I.budget(log, zone, now);
    ui.clear(box);
    if (!bd.length) { box.appendChild(h('p', { class: 'muted', text: 'No calls logged in a way that can be counted yet.' })); return 0; }
    bd.forEach(function (b, i) { box.appendChild(budgetCard(b, i, now)); });
    return bd.length;
  }

  ui.route('insights', null, function (main) {
    var log = S.list('log'), zone = tz(), now = nowEpoch(zone), hm = I.heatmap(log, zone), tr = I.trend(log, zone, now, 6), budgetBox = h('div', { class: 'budgets' }), timer, obs = I.observations(log, zone, now);
    main.appendChild(h('h2', { text: 'Call patterns' }));
    main.appendChild(ui.card(null, [h('p', { class: 'lead', text: 'When they call, how often, and how close each debt is to the call-frequency limits. Worked out on this device from your contact log.' }),
      h('ul', { class: 'insights' }, obs.map(function (o) { return h('li', { text: o }); })),
      h('p', { class: 'small', text: 'Time zone: ' + zone + ' (change it under Debt help, Your situation). Counts only: whether a rule was broken depends on facts this screen cannot see.' }), ui.disclaimerBar()]));
    main.appendChild(ui.card('When they reach you', [hm.total ? h('div', { class: 'tablewrap' }, heatSvg(hm)) : h('p', { class: 'muted', text: 'Log contacts with a date and time to fill the map.' }),
      h('details', null, h('summary', { text: 'Show the heat map as a table' }), heatTable(hm))]));
    main.appendChild(ui.card('Weekly trend', [h('p', null, h('strong', { text: tr.dir === 'rising' ? 'Rising' : tr.dir === 'falling' ? 'Falling' : 'Steady' }), ' · calls and voicemails per week, oldest first: ' + tr.counts.join(', ') + '.')]));
    main.appendChild(ui.card('Call budget per debt (live)', [h('p', { class: 'small', text: 'Regulation F presumes harassment when a collector makes more than 7 call attempts in 7 days about one debt, or calls again within 7 days after a phone conversation about it (12 CFR 1006.14(b)(2)). The clock counts down on this screen and updates every 30 seconds.' }),
      budgetBox,
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/debt/log', text: 'Open the contact log' }), h('a', { class: 'btn', href: '#/debt/timeline', text: 'Violation timeline' }))]));
    ui.announce(obs[0]);
    if (drawBudget(budgetBox, log, zone)) { timer = setInterval(function () { if (!main.contains(budgetBox)) { clearInterval(timer); return; } drawBudget(budgetBox, log, zone); }, 30000); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
