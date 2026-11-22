/* Stark Event Kit planner: guests and check-in, seating, run of show, budget and volunteer roster. */
(function (g) {
  'use strict';
  var S = g.SEK, UI = S.ui, h = UI.h, R = UI.routes, doc = g.document;

  function input(type, value, attrs) { var a = attrs || {}; a.type = type; a.value = value == null ? '' : String(value); return h('input', a); }
  function btn(label, on, cls, attrs) { var a = attrs || {}; a.type = 'button'; a.class = 'btn ' + (cls || ''); a.onclick = on; return h('button', a, label); }
  function paper(title, sub) { return h('div', { class: 'paper' }, h('div', { class: 'brandline', text: 'Stark Event Kit - ' + sub }), h('h2', { text: title })); }

  R.plan = function (root, q) {
    var D = {}, tab = q.tab || 'guests', tick = null, find = q.find || '', limit = 150, msg = '';
    S.PLAN_KEYS.forEach(function (k) { D[k] = S.load(k); });
    function save(k) { if (!S.save(k, D[k])) UI.toast('Could not save. Storage may be full, or this item is in safe mode.'); }
    var LOC = S.cur.locale();
    if (S.cur.ensure(D.plan, D.budget.items.length || D.guests.types.length)) save('plan');
    function cur() { return S.cur.of(D.plan); }
    function money(c) { return S.cur.fmt(c, cur(), LOC); }
    function amountHint() { return cur().dec ? 'Enter an amount like ' + S.cur.input(12000, cur(), LOC) + ' or ' + S.cur.input(12050, cur(), LOC) : 'Enter a whole amount like ' + S.cur.input(1500 * 100, cur(), LOC); }
    function evName() { return D.plan.name || 'Our event'; }
    function currencySelect() {
      var k = cur(), opts = S.cur.LIST.map(function (c) { return [c[0], c[0] + '  ' + c[1] + '  ' + c[3]]; }).concat([[S.cur.OTHER, 'Other (type a symbol)']]), sel = k.other ? S.cur.OTHER : k.code;
      return UI.select(opts, sel, function (e) {
        var v = e.target.value, n = S.cur.choose(D.plan, v, D.plan.currency, D.plan.cdec, D.budget, D.guests);
        save('plan'); save('budget'); save('guests'); msg = n ? n + ' amount' + (n === 1 ? '' : 's') + ' rounded to whole units (no conversion).' : ''; draw();
      });
    }

    function draw() {
      if (tick) { clearInterval(tick); tick = null; }
      UI.clear(root);
      root.appendChild(h('h1', { text: 'Event planner' }));
      root.appendChild(h('p', { class: 'muted', text: 'Guests, check-in, seating, the running order, money and volunteers for one event, all on this computer.' }));
      var m = D.plan;
      root.appendChild(h('details', { class: 'card noprint', open: !m.name }, h('summary', { text: 'Event details: ' + evName() + (m.date ? ', ' + m.date : '') }),
        h('div', { class: 'grid g4', id: 'plan-meta' },
          UI.field('Event name', input('text', m.name, { maxlength: '80', onchange: function (e) { m.name = e.target.value.trim(); save('plan'); draw(); } }), 'pm-name'),
          UI.field('Date', input('date', m.date, { onchange: function (e) { m.date = e.target.value; save('plan'); } }), 'pm-date'),
          UI.field('Venue', input('text', m.venue, { maxlength: '120', onchange: function (e) { m.venue = e.target.value.trim(); save('plan'); } }), 'pm-venue'),
          UI.field('Start time', input('time', m.start, { onchange: function (e) { if (S.hm(e.target.value) != null) { m.start = e.target.value; save('plan'); draw(); } } }), 'pm-start'),
          UI.field('Currency of this event', currencySelect(), 'pm-ccode'),
          D.plan.ccode === S.cur.OTHER ? UI.field('Symbol to show (up to 4 characters)', input('text', m.currency, { maxlength: '4', onchange: function (e) { S.cur.choose(m, S.cur.OTHER, e.target.value, m.cdec, D.budget, D.guests); save('plan'); draw(); } }), 'pm-cur') : null,
          D.plan.ccode === S.cur.OTHER ? UI.field('Decimals', UI.select([['2', 'Two (12.50)'], ['0', 'None (1250)']], String(m.cdec === 0 ? 0 : 2), function (e) { var n = S.cur.choose(m, S.cur.OTHER, m.currency, +e.target.value, D.budget, D.guests); save('plan'); save('budget'); save('guests'); msg = n ? n + ' amount' + (n === 1 ? '' : 's') + ' rounded to whole units.' : ''; draw(); }), 'pm-cdec') : null),
        h('p', { class: 'fine', id: 'pm-cur-note', text: 'Money is shown in this event\'s currency. There are no exchange rates and nothing is converted: changing the currency keeps your numbers and only changes how they are shown (currencies without decimals, such as yen, round amounts to whole units).' })));
      root.appendChild(UI.tabs([['guests', 'Guests and check-in'], ['seating', 'Seating'], ['show', 'Run of show'], ['budget', 'Budget'], ['crew', 'Volunteers']], tab, function (t) { tab = t; msg = ''; draw(); }));
      ({ guests: tGuests, seating: tSeating, show: tShow, budget: tBudget, crew: tCrew })[tab]();
    }

    /* ---------- guests and check-in ---------- */
    function tGuests() {
      var G = D.guests, st = S.reg.stats(G), f = { name: '', team: '', email: '', phone: '', type: G.types[0] ? G.types[0].name : '', paid: false };
      root.appendChild(UI.kpis([['registered' + (G.capacity ? ' of ' + G.capacity : ''), st.registered], ['checked in', st.checkedIn, 'good'], ['not in yet', st.notIn], ['waiting list', st.waitlist, st.waitlist ? 'warn' : ''], ['paid', st.paid + (st.revenue ? ' (' + money(st.revenue) + ')' : '')]]));
      if (st.over) root.appendChild(h('p', { class: 'status-wrong', text: 'Over capacity by ' + st.over + ' (walk-ins).' }));
      var typeSel = G.types.length ? UI.select(G.types.map(function (t) { return [t.name, t.name + (t.price ? ' (' + money(t.price) + ')' : '')]; }), f.type, function (e) { f.type = e.target.value; }) : input('text', '', { placeholder: 'General', oninput: function (e) { f.type = e.target.value; } });
      var out = h('p', { class: 'fine', role: 'status', id: 'g-msg', text: msg });
      function add(walk) {
        var r = S.reg.add(G, { name: f.name, team: f.team, email: f.email, phone: f.phone, type: f.type, paid: f.paid, walkIn: walk }, Date.now());
        if (r.error) { out.textContent = r.error; return; }
        save('guests'); msg = r.waitlisted ? r.person.name + ' is on the waiting list (the event is full).' : (walk ? r.person.name + ' added and checked in.' : r.person.name + ' added.'); draw();
        var n = doc.getElementById('g-name'); if (n) n.focus();
      }
      root.appendChild(h('div', { class: 'card noprint' }, h('h2', { text: 'Add a guest' }),
        h('div', { class: 'grid g4' },
          UI.field('Name', input('text', '', { maxlength: '120', oninput: function (e) { f.name = e.target.value; }, onkeydown: function (e) { if (e.key === 'Enter') add(false); } }), 'g-name'),
          UI.field('Team or party', input('text', '', { maxlength: '80', oninput: function (e) { f.team = e.target.value; } }), 'g-team'),
          UI.field('Email (optional)', input('text', '', { maxlength: '160', oninput: function (e) { f.email = e.target.value; } }), 'g-email'),
          UI.field('Phone (optional)', input('text', '', { maxlength: '40', oninput: function (e) { f.phone = e.target.value; } }), 'g-phone'),
          UI.field('Ticket type', typeSel, 'g-type')),
        h('div', { class: 'row' }, UI.check('g-paid', 'Paid', false, function (v) { f.paid = v; }), btn('Add guest', function () { add(false); }, 'primary', { id: 'g-add' }), btn('Add walk-in and check in', function () { add(true); }, '', { id: 'g-walk' })), out));

      var list = h('div', { id: 'g-list' });
      function rows() {
        UI.clear(list);
        var nl = find ? S.nlq.run(find, { G: G, SE: D.seating }) : null, found = nl && nl.structured ? nl.people : S.reg.search(G, find), shown = found.slice(0, limit), tb = h('tbody');
        if (nl && nl.structured) list.appendChild(h('p', { class: 'fine', id: 'g-understood', role: 'status', text: 'Understood as: ' + nl.filters.join(', ') + ' (' + found.length + ').' }));
        shown.forEach(function (p) {
          var inBtn = p.status === 'cancelled' ? null : btn(p.inAt ? 'In ' + new Date(p.inAt).toTimeString().slice(0, 5) + ' (undo)' : 'Check in', function () {
            var r = S.reg.checkIn(G, p.id, Date.now()); if (r.error) { UI.toast(r.error); return; } save('guests'); rows(); kp();
          }, p.inAt ? 'small good' : 'small primary', { 'aria-label': (p.inAt ? 'Undo check-in for ' : 'Check in ') + p.name });
          tb.appendChild(h('tr', { class: p.status === 'cancelled' ? 'dimrow' : '' },
            h('td', null, h('strong', { text: p.name }), p.notes ? h('div', { class: 'fine', text: p.notes }) : null),
            h('td', { text: p.team || '-' }), h('td', { text: p.type || 'General' }),
            h('td', null, h('input', { type: 'checkbox', checked: p.paid, 'aria-label': 'Paid: ' + p.name, onchange: function (e) { p.paid = e.target.checked; save('guests'); kp(); } })),
            h('td', null, h('span', { class: 'tag' + (p.status === 'waitlist' ? ' warn' : ''), text: p.status === 'registered' ? 'booked' : p.status === 'waitlist' ? 'waiting list' : 'cancelled' })),
            h('td', null, h('div', { class: 'row nowrap' }, inBtn,
              p.status === 'cancelled' ? btn('Restore', function () { S.reg.restore(G, p.id); save('guests'); draw(); }, 'small', { 'aria-label': 'Restore ' + p.name })
                : btn('Cancel', function () { var pr = S.reg.cancel(G, p.id); save('guests'); msg = p.name + ' cancelled.' + (pr.length ? ' Moved off the waiting list: ' + pr.map(function (x) { return x.name; }).join(', ') + '.' : ''); draw(); }, 'small', { 'aria-label': 'Cancel ' + p.name })))));
        });
        list.appendChild(h('div', { class: 'scroll-x' }, h('table', { id: 'g-table' }, h('thead', null, h('tr', null, ['Guest', 'Team', 'Ticket', 'Paid', 'Status', 'Check-in'].map(function (x) { return h('th', { text: x }); }))), tb)));
        if (!found.length) list.appendChild(h('p', { class: 'muted', text: G.people.length ? 'Nobody matches that search.' : 'No guests yet. Add them above or import a CSV below.' }));
        if (found.length > shown.length) list.appendChild(btn('Show more (' + (found.length - shown.length) + ' more)', function () { limit += 300; rows(); }, 'small'));
      }
      function kp() { var s2 = S.reg.stats(G), k = UI.kpis([['registered' + (G.capacity ? ' of ' + G.capacity : ''), s2.registered], ['checked in', s2.checkedIn, 'good'], ['not in yet', s2.notIn], ['waiting list', s2.waitlist, s2.waitlist ? 'warn' : ''], ['paid', s2.paid + (s2.revenue ? ' (' + money(s2.revenue) + ')' : '')]]); var old = root.querySelector('.kpis'); if (old) old.replaceWith(k); }
      root.appendChild(h('div', { class: 'card', id: 'g-card' }, h('div', { class: 'row between noprint' }, h('h2', { text: 'Guest list and check-in' }),
        h('div', { class: 'field', style: { margin: 0, minWidth: '220px' } }, h('label', { for: 'g-find', class: 'sr-only', text: 'Search guests' }), input('search', find, { id: 'g-find', placeholder: 'Search, or ask: unpaid from team Foxes', oninput: function (e) { find = e.target.value; limit = 150; rows(); } }))), list));
      rows();

      var typesTa = h('textarea', { rows: '4', id: 'g-types', 'aria-label': 'Ticket types, one per line as name, price' }, G.types.map(function (t) { return t.name + (t.price ? ', ' + S.cur.input(t.price, cur(), LOC) : ''); }).join('\n'));
      var csvTa = h('textarea', { rows: '4', id: 'g-csv', placeholder: 'name,team,email,phone,type,paid,notes', 'aria-label': 'Guest CSV to import' });
      var impOut = h('div', { role: 'status' });
      root.appendChild(h('div', { class: 'grid g2 noprint', style: { marginTop: '16px' } },
        h('div', { class: 'card' }, h('h3', { text: 'Capacity and ticket types' }),
          UI.field('Capacity (0 means no limit; extra bookings join a waiting list)', input('number', G.capacity, { min: '0', max: '100000', onchange: function (e) { G.capacity = Math.max(0, Math.floor(+e.target.value || 0)); var pr = S.reg.promote(G); save('guests'); msg = pr.length ? 'Moved off the waiting list: ' + pr.map(function (x) { return x.name; }).join(', ') + '.' : ''; draw(); } }), 'g-cap'),
          UI.field('Ticket types, one per line: name, price', typesTa, 'g-types'),
          btn('Save ticket types', function () {
            var bad = [];
            G.types = typesTa.value.split(/\r?\n/).map(function (l) { var p = l.split(','), nm = p[0].trim(), pr = p.length > 1 ? S.cur.parse(p.slice(1).join(','), cur(), LOC) : 0; if (p.length > 1 && !isFinite(pr)) bad.push(nm); return nm ? { id: S.uid('ty'), name: nm.slice(0, 60), price: isFinite(pr) ? Math.max(0, pr) : 0 } : null; }).filter(Boolean).slice(0, 50);
            save('guests'); msg = bad.length ? 'Not a price for ' + bad.slice(0, 3).join(', ') + ' (set to 0). ' + amountHint() + '.' : ''; draw(); }, 'small')),
        h('div', { class: 'card' }, h('h3', { text: 'Import, export and print' }),
          h('input', { type: 'file', accept: '.csv,.txt', 'aria-label': 'Guest CSV file', onchange: function (e) { UI.readFile(e.target, function (t) { csvTa.value = t; }); } }),
          h('div', { style: { height: '8px' } }), csvTa,
          h('div', { class: 'row', style: { marginTop: '8px' } },
            btn('Import guests', function () {
              var r = S.reg.importCsv(G, csvTa.value, Date.now()); save('guests');
              msg = 'Imported ' + r.added + ' guest' + (r.added === 1 ? '' : 's') + (r.waitlisted ? ' (' + r.waitlisted + ' on the waiting list)' : '') + '.' + (r.skipped.length ? ' Skipped ' + r.skipped.length + ': ' + r.skipped.slice(0, 4).map(function (x) { return 'row ' + x.row + ' ' + x.msg; }).join('; ') : '');
              draw(); }, 'primary', { id: 'g-import' }),
            btn('Export CSV', function () { UI.download('guests.csv', S.reg.csv(G), 'text/csv'); }),
            btn('Print sign-in sheet', function () { printSheet(); }),
            h('a', { class: 'btn', href: '#/new?from=guests', text: 'Quiz with these teams' })), impOut)));

      var sheet = h('div', { id: 'g-print', class: 'printarea' });
      root.appendChild(sheet);
      function printSheet() {
        UI.clear(sheet);
        var people = G.people.filter(function (p) { return p.status === 'registered'; }).sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
        var p = paper(evName() + ': sign-in sheet', 'sign-in'), tb = h('tbody');
        people.forEach(function (x) { tb.appendChild(h('tr', null, h('td', { text: x.name }), h('td', { text: x.team }), h('td', { text: x.type }), h('td', { text: x.paid ? 'paid' : '' }), h('td', { class: 'signcell' }))); });
        for (var i = 0; i < 8; i++) tb.appendChild(h('tr', null, h('td', { class: 'signcell' }), h('td'), h('td'), h('td'), h('td', { class: 'signcell' })));
        p.appendChild(h('table', null, h('thead', null, h('tr', null, ['Name', 'Team', 'Ticket', 'Paid', 'Signature'].map(function (x) { return h('th', { text: x }); }))), tb));
        sheet.appendChild(p); UI.print();
      }
    }

    /* ---------- seating ---------- */
    function tSeating() {
      var SE = D.seating, G = D.guests, occ = S.seat.occupancy(SE, G), add = { n: 4, seats: 8, shape: 'round' };
      var free = occ.tables.reduce(function (a, t) { return a + Math.max(0, t.free); }, 0);
      root.appendChild(UI.kpis([['tables', SE.tables.length], ['seats', occ.seats], ['seated', occ.seated, 'good'], ['not seated', occ.unseated.length, occ.unseated.length ? 'warn' : ''], ['free seats', free]]));
      if (msg) root.appendChild(h('p', { class: 'fine', role: 'status', text: msg }));
      root.appendChild(h('div', { class: 'card noprint' }, h('div', { class: 'row' },
        h('div', { class: 'field inline' }, h('label', { for: 'st-n', text: 'Add' }), input('number', add.n, { id: 'st-n', min: '1', max: '100', class: 'w80', onchange: function (e) { add.n = +e.target.value || 1; } }),
          h('label', { for: 'st-seats', text: 'tables of' }), input('number', add.seats, { id: 'st-seats', min: '1', max: '40', class: 'w80', onchange: function (e) { add.seats = +e.target.value || 8; } }),
          h('label', { for: 'st-shape', class: 'sr-only', text: 'Table shape' }), (function () { var s = UI.select([['round', 'round'], ['rect', 'long']], add.shape, function (e) { add.shape = e.target.value; }); s.id = 'st-shape'; return s; })()),
        btn('Add tables', function () { S.seat.addTables(SE, Math.min(100, add.n), add.seats, add.shape); save('seating'); msg = ''; draw(); }, '', { id: 'st-add' })),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          btn('Seat everyone not yet seated', function () { var r = S.seat.auto(SE, G, true); save('seating'); msg = seatMsg(r); draw(); }, 'primary', { id: 'st-auto', disabled: !SE.tables.length }),
          btn('Re-seat everyone', function () { var r = S.seat.auto(SE, G, false); save('seating'); msg = seatMsg(r); draw(); }, '', { disabled: !SE.tables.length }),
          btn('Clear seats', function () { SE.seat = {}; save('seating'); msg = 'All seats cleared.'; draw(); }),
          btn('Print seating chart', function () { printChart(false); }), btn('Print table cards', function () { printChart(true); })),
        h('p', { class: 'fine', text: 'Auto-seating keeps each team or party at one table when it fits, fills tables tightly, and only splits a party that is bigger than any free table. Only booked guests (not the waiting list) are seated.' })));
      function seatMsg(r) { return 'Seated ' + r.placed + '.' + (r.unseated ? ' ' + r.unseated + ' still without a seat: add tables or seats.' : '') + (r.split.length ? ' Split across tables: ' + r.split.join(', ') + '.' : ''); }

      if (!G.people.some(function (p) { return p.status === 'registered'; })) root.appendChild(h('p', { class: 'muted', text: 'Add guests on the Guests tab first, then seat them here.' }));
      var mv = { p: occ.unseated[0] ? occ.unseated[0].id : '', t: '' }, everyone = G.people.filter(function (p) { return p.status === 'registered'; }).sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
      if (everyone.length && SE.tables.length) {
        mv.p = mv.p || everyone[0].id; mv.t = SE.tables[0].id;
        root.appendChild(h('div', { class: 'card noprint', style: { marginTop: '16px' } }, h('h3', { text: 'Move a guest' }), h('div', { class: 'row mv-row' },
          h('label', { for: 'mv-p', class: 'sr-only', text: 'Guest' }), (function () { var s = UI.select(everyone.map(function (p) { var t = SE.seat[p.id], tn = t ? SE.tables.filter(function (x) { return x.id === t; })[0].name : 'no seat'; return [p.id, p.name + (p.team ? ' (' + p.team + ')' : '') + ' - ' + tn]; }), mv.p, function (e) { mv.p = e.target.value; }); s.id = 'mv-p'; return s; })(),
          h('label', { for: 'mv-t', class: 'sr-only', text: 'Table' }), (function () { var s = UI.select(SE.tables.map(function (t) { return [t.id, t.name]; }).concat([['', 'No seat']]), mv.t, function (e) { mv.t = e.target.value; }); s.id = 'mv-t'; return s; })(),
          btn('Move', function () { S.seat.move(SE, mv.p, mv.t); save('seating'); msg = ''; draw(); }, 'primary', { id: 'mv-go' }))));
      }
      var grid = h('div', { class: 'tables', id: 'st-grid' });
      occ.tables.forEach(function (o, i) {
        var t = o.table;
        grid.appendChild(h('div', { class: 'tbl ' + t.shape + (o.over ? ' over' : '') },
          h('div', { class: 'row between nowrap' }, input('text', t.name, { 'aria-label': 'Table name', maxlength: '40', class: 'tname', onchange: function (e) { t.name = e.target.value.trim() || t.name; save('seating'); } }),
            h('span', { class: 'tag' + (o.over ? ' bad' : ''), text: o.people.length + '/' + t.seats })),
          h('ul', { class: 'seats' }, o.people.map(function (p) { return h('li', null, h('span', { text: p.name + (p.team ? ' - ' + p.team : '') }), h('button', { type: 'button', class: 'x', 'aria-label': 'Unseat ' + p.name, onclick: function () { S.seat.move(SE, p.id, null); save('seating'); draw(); } }, 'x')); })),
          h('div', { class: 'row nowrap' }, h('label', { for: 'ts-' + i, class: 'fine', text: 'Seats' }), input('number', t.seats, { id: 'ts-' + i, min: '1', max: '40', class: 'w80', onchange: function (e) { t.seats = Math.max(1, Math.min(40, +e.target.value || t.seats)); save('seating'); draw(); } }),
            btn('Remove', function () { SE.tables.splice(i, 1); S.seat.clean(SE, G); save('seating'); draw(); }, 'small', { 'aria-label': 'Remove ' + t.name }))));
      });
      if (occ.unseated.length) grid.appendChild(h('div', { class: 'tbl unseated' }, h('strong', { text: 'Not seated (' + occ.unseated.length + ')' }), h('ul', { class: 'seats' }, occ.unseated.slice(0, 200).map(function (p) { return h('li', { text: p.name + (p.team ? ' - ' + p.team : '') }); }))));
      root.appendChild(grid);
      var pr = h('div', { id: 'st-print', class: 'printarea' }); root.appendChild(pr);
      function printChart(cards) {
        UI.clear(pr);
        if (cards) occ.tables.forEach(function (o) { pr.appendChild(h('div', { class: 'paper tcard' }, h('div', { class: 'brandline', text: evName() }), h('div', { class: 'tcard-name', text: o.table.name }), h('div', { class: 'fine', text: o.people.map(function (p) { return p.name; }).join(', ') }))); });
        else {
          var p = paper(evName() + ': seating chart', 'seating'), box = h('div', { class: 'chart' });
          occ.tables.forEach(function (o) { box.appendChild(h('div', { class: 'chart-t' }, h('h3', { text: o.table.name + ' (' + o.people.length + '/' + o.table.seats + ')' }), h('ol', null, o.people.map(function (x) { return h('li', { text: x.name + (x.team ? ' - ' + x.team : '') }); })))); });
          p.appendChild(box);
          var all = []; occ.tables.forEach(function (o) { o.people.forEach(function (x) { all.push([x.name, o.table.name]); }); });
          all.sort(function (a, b) { return a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1; });
          p.appendChild(h('h3', { text: 'Find your table' }));
          p.appendChild(h('div', { class: 'cols2' }, all.map(function (x) { return h('div', { class: 'keyrow2' }, h('span', { text: x[0] }), h('strong', { text: x[1] })); })));
          pr.appendChild(p);
        }
        UI.print();
      }
    }

    /* ---------- run of show ---------- */
    function tShow() {
      var SH = D.show, start = D.plan.start, P = S.show.plan(SH, start);
      var live = h('div', { class: 'card live-show', id: 'ros-live' }), els = {};
      root.appendChild(live);
      function liveText(st) {
        var drift = Math.round(st.drift);
        return { drift: drift, txt: Math.abs(drift) < 1 ? 'On time' : drift > 0 ? 'Running ' + drift + ' min late' : Math.abs(drift) + ' min ahead' };
      }
      function tickLive() {
        var st = S.show.status(SH, start, Date.now()); if (!st || st.done || !els.clock) return;
        var lt = liveText(st), over = st.left < 0;
        els.clock.className = 'ros-clock' + (over ? ' over' : st.left < 2 ? ' warn' : '');
        els.num.textContent = (over ? '+' : '') + S.fmtTime(Math.abs(st.left) * 60); els.lab.textContent = over ? 'over time' : 'left in segment';
        els.drift.className = lt.drift > 0 ? 'status-wrong' : 'status-right';
        els.drift.textContent = lt.txt + '. Projected finish ' + S.fmtHm(st.endsAt) + '.' + (st.next ? ' Next: ' + (st.next.title || 'Segment') + '.' : ' This is the last segment.');
      }
      function paintLive() {
        UI.clear(live); els = {};
        var st = S.show.status(SH, start, Date.now());
        if (!st) {
          live.appendChild(h('div', { class: 'row between' }, h('div', null, h('h2', { text: 'Run of show' }), h('p', { class: 'muted', text: SH.items.length ? P.rows.length + ' segments, ' + P.total + ' minutes, ' + S.fmtHm(P.start) + ' to ' + S.fmtHm(P.end) + '.' : 'Add the segments of your event below, then start the show to track time live.' })),
            btn('Start the show now', function () { S.show.start(SH, Date.now()); save('show'); draw(); }, 'primary', { id: 'ros-start', disabled: !SH.items.length })));
          return;
        }
        var lt = liveText(st);
        if (st.done) live.appendChild(h('div', null, h('div', { class: 'now-label', text: 'Show finished' }), h('div', { class: 'now-title', text: 'Finished at ' + S.fmtHm(st.endsAt) }), h('p', { class: lt.drift > 0 ? 'status-wrong' : 'status-right', text: lt.txt + ' against the plan.' })));
        else {
          els.num = h('b'); els.lab = h('span'); els.clock = h('div', { class: 'ros-clock' }, els.num, els.lab); els.drift = h('p', { id: 'ros-drift', 'aria-live': 'off' });
          live.appendChild(h('div', { class: 'ros-now' }, h('div', null, h('div', { class: 'now-label', text: 'Now (' + (st.idx + 1) + ' of ' + SH.items.length + ')' }), h('div', { class: 'now-title', id: 'ros-now', text: st.item.title || 'Segment' }), st.item.owner ? h('div', { class: 'muted', text: 'Owner: ' + st.item.owner }) : null, st.item.cue ? h('div', { class: 'fine', text: 'Cue: ' + st.item.cue }) : null),
            els.clock));
          live.appendChild(els.drift); tickLive();
        }
        live.appendChild(h('div', { class: 'row noprint' }, btn(st.done ? 'Finished' : 'Next segment', function () { S.show.next(SH, Date.now()); save('show'); paintLive(); table(); }, 'primary', { id: 'ros-next', disabled: st.done }),
          btn('Back', function () { S.show.back(SH); save('show'); paintLive(); table(); }, '', { disabled: st.idx <= 0 }), btn('Stop tracking', function () { S.show.stop(SH); save('show'); draw(); })));
      }
      paintLive(); tick = setInterval(tickLive, 1000); UI.onLeave(function () { clearInterval(tick); });

      var tbox = h('div', { class: 'card', style: { marginTop: '16px' } });
      root.appendChild(tbox);
      function table() {
        UI.clear(tbox); P = S.show.plan(SH, start);
        var st = S.show.status(SH, start, Date.now()), tb = h('tbody');
        P.rows.forEach(function (r, i) {
          var it = r.item;
          tb.appendChild(h('tr', { class: st && !st.done && st.idx === i ? 'currow' : st && i < st.idx ? 'dimrow' : '' },
            h('td', { class: 'nowrap', text: S.fmtHm(r.s) + '-' + S.fmtHm(r.e) }),
            h('td', null, input('number', it.dur, { min: '0', max: '600', class: 'w80', 'aria-label': 'Minutes for ' + (it.title || 'segment ' + (i + 1)), onchange: function (e) { it.dur = Math.max(0, Math.min(600, +e.target.value || 0)); save('show'); table(); } })),
            h('td', null, input('text', it.title, { maxlength: '120', 'aria-label': 'Segment ' + (i + 1) + ' title', onchange: function (e) { it.title = e.target.value; save('show'); } })),
            h('td', null, input('text', it.owner, { maxlength: '60', 'aria-label': 'Segment ' + (i + 1) + ' owner', onchange: function (e) { it.owner = e.target.value; save('show'); } })),
            h('td', null, input('text', it.cue, { maxlength: '200', 'aria-label': 'Segment ' + (i + 1) + ' cue notes', onchange: function (e) { it.cue = e.target.value; save('show'); } })),
            h('td', null, h('div', { class: 'row nowrap' },
              btn('Up', function () { if (i > 0) { SH.items.splice(i - 1, 0, SH.items.splice(i, 1)[0]); save('show'); table(); } }, 'small', { 'aria-label': 'Move segment ' + (i + 1) + ' up', disabled: i === 0 }),
              btn('Remove', function () { SH.items.splice(i, 1); save('show'); table(); paintLive(); }, 'small', { 'aria-label': 'Remove segment ' + (i + 1) })))));
        });
        tbox.appendChild(h('h2', { text: 'Running order' }));
        tbox.appendChild(h('div', { class: 'scroll-x' }, h('table', { id: 'ros-table' }, h('thead', null, h('tr', null, ['Time', 'Min', 'Segment', 'Owner', 'Cue notes', ''].map(function (x) { return h('th', { text: x }); }))), tb)));
        tbox.appendChild(h('p', { class: 'fine', text: 'Total ' + P.total + ' minutes. Starts ' + S.fmtHm(P.start) + ' (change it under Event details), ends ' + S.fmtHm(P.end) + '.' }));
        tbox.appendChild(h('div', { class: 'row noprint' },
          btn('Add segment', function () { SH.items.push({ id: S.uid('s'), title: 'New segment', dur: 10, owner: '', cue: '' }); save('show'); table(); paintLive(); }, '', { id: 'ros-add' }),
          btn('Load the quiz-night running order', function () { S.STARTER_SHOW.forEach(function (x) { SH.items.push({ id: S.uid('s'), title: x[0], dur: x[1], owner: x[2], cue: '' }); }); save('show'); table(); paintLive(); }, '', { id: 'ros-starter' }),
          btn('Export CSV', function () { UI.download('run-of-show.csv', S.show.csv(SH, start), 'text/csv'); }),
          btn('Print run sheet', function () {
            var p = paper(evName() + ': run of show', 'run sheet'), b2 = h('tbody');
            P.rows.forEach(function (r) { b2.appendChild(h('tr', null, h('td', { text: S.fmtHm(r.s) }), h('td', { text: String(r.item.dur) }), h('td', { text: r.item.title }), h('td', { text: r.item.owner }), h('td', { text: r.item.cue }))); });
            p.appendChild(h('p', { text: [D.plan.date, D.plan.venue].filter(Boolean).join(', ') }));
            p.appendChild(h('table', null, h('thead', null, h('tr', null, ['Start', 'Min', 'Segment', 'Owner', 'Cue'].map(function (x) { return h('th', { text: x }); }))), b2));
            var pr = doc.getElementById('ros-print'); UI.clear(pr); pr.appendChild(p); UI.print(); })));
      }
      table();
      root.appendChild(h('div', { id: 'ros-print', class: 'printarea' }));
    }

    /* ---------- budget ---------- */
    function tBudget() {
      var B = D.budget, T = S.budget.totals(B, S.cur.unit(cur())), CATS = ['Venue', 'Food and drink', 'Prizes', 'Printing', 'Equipment', 'Marketing', 'Staff', 'Tickets', 'Raffle', 'Sponsorship', 'Donations', 'Other'];
      if (msg) root.appendChild(h('p', { class: 'fine', role: 'status', id: 'plan-msg', text: msg }));
      root.appendChild(UI.kpis([['expenses (forecast)', money(T.exp.fc)], ['income (forecast)', money(T.inc.fc)], ['net (forecast)', money(T.net.fc), T.net.fc < 0 ? 'bad' : 'good'],
        ['cost per head', T.perHead == null ? '-' : money(T.perHead)], ['break-even ticket', T.breakEven == null ? '-' : money(T.breakEven)], ['bills not paid', money(T.unpaid), T.unpaid ? 'warn' : '']]));
      root.appendChild(h('p', { class: 'fine', text: 'Forecast uses the actual amount where you have entered one, otherwise the estimate. Break-even ticket price = estimated costs minus other estimated income, divided by expected attendees.' }));
      var tb = h('tbody');
      B.items.forEach(function (it, i) {
        function num(field, label) {
          return input('text', it[field] == null ? '' : S.cur.input(it[field], cur(), LOC), { inputmode: 'decimal', class: 'w110', 'aria-label': label + ' for ' + (it.name || 'line ' + (i + 1)), onchange: function (e) {
            var v = e.target.value.trim(), c = S.cur.parse(v, cur(), LOC);
            if (field === 'act' && v === '') it.act = null; else if (isFinite(c)) it[field] = c; else { UI.toast(amountHint()); draw(); return; }
            save('budget'); draw(); } });
        }
        tb.appendChild(h('tr', null,
          h('td', null, (function () { var s = UI.select([['expense', 'Cost'], ['income', 'Income']], it.kind, function (e) { it.kind = e.target.value; save('budget'); draw(); }); s.setAttribute('aria-label', 'Kind of line ' + (i + 1)); return s; })()),
          h('td', null, input('text', it.cat, { list: 'b-cats', maxlength: '40', 'aria-label': 'Category of line ' + (i + 1), onchange: function (e) { it.cat = e.target.value.trim(); save('budget'); draw(); } })),
          h('td', null, input('text', it.name, { maxlength: '120', 'aria-label': 'Item of line ' + (i + 1), onchange: function (e) { it.name = e.target.value; save('budget'); } })),
          h('td', null, num('est', 'Estimate')), h('td', null, num('act', 'Actual')),
          h('td', null, it.kind === 'expense' ? h('input', { type: 'checkbox', checked: it.paid, 'aria-label': 'Paid: ' + (it.name || 'line ' + (i + 1)), onchange: function (e) { it.paid = e.target.checked; save('budget'); draw(); } }) : h('span', { class: 'fine', text: '-' })),
          h('td', null, btn('Remove', function () { B.items.splice(i, 1); save('budget'); draw(); }, 'small', { 'aria-label': 'Remove line ' + (i + 1) }))));
      });
      root.appendChild(h('datalist', { id: 'b-cats' }, CATS.map(function (c) { return h('option', { value: c }); })));
      root.appendChild(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', { text: 'Budget lines' }),
        h('div', { class: 'field inline', style: { margin: 0 } }, h('label', { for: 'b-att', text: 'Expected attendees' }), input('number', B.attendees, { id: 'b-att', min: '0', max: '100000', class: 'w110', onchange: function (e) { B.attendees = Math.max(0, Math.floor(+e.target.value || 0)); save('budget'); draw(); } }))),
        h('div', { class: 'scroll-x' }, h('table', { id: 'b-table' }, h('thead', null, h('tr', null, ['Kind', 'Category', 'Item', 'Estimate', 'Actual', 'Paid', ''].map(function (x) { return h('th', { text: x }); }))), tb)),
        B.items.length ? null : h('p', { class: 'muted', text: 'No lines yet. Add costs and income, or load a starter set.' }),
        h('div', { class: 'row noprint', style: { marginTop: '10px' } },
          btn('Add cost', function () { B.items.push({ id: S.uid('b'), kind: 'expense', cat: 'Other', name: '', est: 0, act: null, paid: false }); save('budget'); draw(); }, '', { id: 'b-add' }),
          btn('Add income', function () { B.items.push({ id: S.uid('b'), kind: 'income', cat: 'Tickets', name: '', est: 0, act: null, paid: false }); save('budget'); draw(); }),
          btn('Load a starter budget', function () { S.STARTER_BUDGET.forEach(function (x) { B.items.push({ id: S.uid('b'), kind: x[0], cat: x[1], name: x[2], est: x[3], act: null, paid: false }); }); if (!B.attendees) B.attendees = 60; save('budget'); draw(); }, '', { id: 'b-starter' }),
          btn('Export CSV', function () { UI.download('budget.csv', S.budget.csv(B, cur()), 'text/csv'); }),
          btn('Print budget report', function () { printBudget(T); }, '', { id: 'b-print' }))));
      root.appendChild(h('div', { id: 'bud-print', class: 'printarea' }));
      function printBudget(T2) {
        var p = paper(evName() + ': budget report', 'budget'), tb2 = h('tbody'), k = cur(), host = doc.getElementById('bud-print');
        p.appendChild(h('p', { text: [D.plan.date, D.plan.venue].filter(Boolean).join(', ') + ((D.plan.date || D.plan.venue) ? '. ' : '') + 'Amounts in ' + (k.other ? (k.symbol || 'the symbol shown') : k.code + ' (' + k.symbol + ')') + '. Nothing is converted.' }));
        p.appendChild(h('table', { class: 'kv' }, h('tbody', null, [['Expenses (forecast)', money(T2.exp.fc)], ['Income (forecast)', money(T2.inc.fc)], ['Net (forecast)', money(T2.net.fc)], ['Cost per head', T2.perHead == null ? '-' : money(T2.perHead)], ['Break-even ticket', T2.breakEven == null ? '-' : money(T2.breakEven)], ['Bills not paid', money(T2.unpaid)]].map(function (r) { return h('tr', null, h('th', { text: r[0] }), h('td', { class: 'num', text: r[1] })); }))));
        B.items.forEach(function (it) { tb2.appendChild(h('tr', null, h('td', { text: it.kind === 'income' ? 'Income' : 'Cost' }), h('td', { text: it.cat }), h('td', { text: it.name }), h('td', { class: 'num', text: money(it.est) }), h('td', { class: 'num', text: it.act == null ? '-' : money(it.act) }), h('td', { text: it.kind === 'expense' ? (it.paid ? 'paid' : 'not paid') : '' }))); });
        p.appendChild(h('table', null, h('thead', null, h('tr', null, ['Kind', 'Category', 'Item', 'Estimate', 'Actual', 'Paid'].map(function (x) { return h('th', { text: x }); }))), tb2));
        UI.clear(host); host.appendChild(p); UI.print();
      }
      if (T.cats.length) {
        var max = Math.max.apply(null, T.cats.map(function (c) { return Math.max(c.est, c.fc); }).concat([1])), cb = h('tbody');
        T.cats.forEach(function (c) { var bar = h('i', { class: c.kind === 'income' ? 'inc' : 'exp' }); bar.style.width = Math.round(c.fc / max * 100) + '%'; cb.appendChild(h('tr', null, h('td', { text: (c.kind === 'income' ? 'Income: ' : 'Cost: ') + c.cat }), h('td', { text: money(c.est) }), h('td', { text: money(c.fc) }), h('td', { class: 'barcell' }, h('div', { class: 'hbar' }, bar)))); });
        root.appendChild(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', { text: 'By category' }), h('div', { class: 'scroll-x' }, h('table', null, h('thead', null, h('tr', null, ['Category', 'Estimate', 'Forecast', ''].map(function (x) { return h('th', { text: x }); }))), cb))));
      }
    }

    /* ---------- volunteers ---------- */
    function tCrew() {
      var C = D.crew, cov = S.crew.coverage(C), cf = S.crew.conflicts(C), np = { name: '', phone: '' };
      var byId = {}; C.people.forEach(function (p) { byId[p.id] = p; });
      root.appendChild(UI.kpis([['volunteers', C.people.length], ['shifts', C.shifts.length], ['places to fill', cov.need], ['gaps', cov.gaps, cov.gaps ? 'warn' : 'good'], ['double bookings', cf.length, cf.length ? 'bad' : '']]));
      if (msg) root.appendChild(h('p', { class: 'fine', role: 'status', text: msg }));
      var grid = h('div', { class: 'grid g2' });
      var pl = h('div', { class: 'card' }, h('h2', { text: 'Volunteers' }),
        h('div', { class: 'row' }, h('label', { for: 'c-name', class: 'sr-only', text: 'Volunteer name' }), input('text', '', { id: 'c-name', placeholder: 'Name', maxlength: '80', oninput: function (e) { np.name = e.target.value; } }),
          h('label', { for: 'c-phone', class: 'sr-only', text: 'Volunteer phone' }), input('text', '', { id: 'c-phone', placeholder: 'Phone (optional)', maxlength: '40', oninput: function (e) { np.phone = e.target.value; } }),
          btn('Add volunteer', function () { if (!np.name.trim()) { UI.toast('Enter a name.'); return; } C.people.push({ id: S.uid('v'), name: np.name.trim(), phone: np.phone.trim(), notes: '' }); save('crew'); msg = ''; draw(); }, 'primary', { id: 'c-add' })));
      var ul = h('ul', { class: 'plain' });
      C.people.forEach(function (p, i) {
        var hrs = S.crew.minutes(C, p.id) / 60;
        ul.appendChild(h('li', { class: 'row between nowrap' }, h('span', null, h('strong', { text: p.name }), h('span', { class: 'fine', text: (p.phone ? '  ' + p.phone : '') + '  ' + (Math.round(hrs * 10) / 10) + ' h' })),
          btn('Remove', function () { C.people.splice(i, 1); S.crew.clean(C); save('crew'); draw(); }, 'small', { 'aria-label': 'Remove volunteer ' + p.name })));
      });
      pl.appendChild(ul); grid.appendChild(pl);
      var cfc = h('div', { class: 'card' }, h('h2', { text: 'Checks' }));
      if (!cf.length && !cov.gaps) cfc.appendChild(h('p', { class: 'status-right', text: C.shifts.length ? 'Every shift is covered and nobody is double-booked.' : 'Add shifts to see coverage.' }));
      cf.forEach(function (c) { cfc.appendChild(h('p', { class: 'status-wrong', text: c.person.name + ' is booked on ' + c.a.role + ' (' + c.a.start + '-' + c.a.end + ') and ' + c.b.role + ' (' + c.b.start + '-' + c.b.end + ') at the same time.' })); });
      cov.rows.forEach(function (r) { if (r.gap) cfc.appendChild(h('p', { class: 'fine', text: r.shift.role + ' ' + r.shift.start + '-' + r.shift.end + ' needs ' + r.gap + ' more.' })); });
      grid.appendChild(cfc); root.appendChild(grid);

      var tb = h('tbody');
      C.shifts.forEach(function (s, i) {
        var mine = C.assign[s.id] || [], avail = C.people.filter(function (p) { return mine.indexOf(p.id) < 0; });
        var addSel = UI.select([['', 'Add a person...']].concat(avail.map(function (p) { var clash = S.crew.shiftsOf(C, p.id).some(function (o) { return S.crew.overlap(o, s); }); return [p.id, p.name + (clash ? ' (busy then)' : '')]; })), '', function (e) { if (e.target.value) { S.crew.assign(C, s.id, e.target.value, true); save('crew'); draw(); } });
        addSel.setAttribute('aria-label', 'Add a person to ' + (s.role || 'shift ' + (i + 1)));
        var r = cov.rows[i];
        tb.appendChild(h('tr', null,
          h('td', null, input('text', s.role, { maxlength: '60', 'aria-label': 'Role of shift ' + (i + 1), onchange: function (e) { s.role = e.target.value; save('crew'); } })),
          h('td', null, input('time', s.start, { 'aria-label': 'Start of shift ' + (i + 1), onchange: function (e) { if (S.hm(e.target.value) != null) { s.start = e.target.value; save('crew'); draw(); } } })),
          h('td', null, input('time', s.end, { 'aria-label': 'End of shift ' + (i + 1), onchange: function (e) { if (S.hm(e.target.value) != null) { s.end = e.target.value; save('crew'); draw(); } } })),
          h('td', null, input('number', s.need, { min: '1', max: '50', class: 'w80', 'aria-label': 'People needed for shift ' + (i + 1), onchange: function (e) { s.need = Math.max(1, Math.min(50, +e.target.value || 1)); save('crew'); draw(); } })),
          h('td', null, h('div', { class: 'chips' }, mine.map(function (id) { var p = byId[id]; return h('span', { class: 'chip' }, p.name, h('button', { type: 'button', class: 'x', 'aria-label': 'Take ' + p.name + ' off ' + (s.role || 'this shift'), onclick: function () { S.crew.assign(C, s.id, id, false); save('crew'); draw(); } }, 'x')); }), addSel),
            r.gap ? h('span', { class: 'tag warn', text: r.gap + ' short' }) : h('span', { class: 'tag good', text: 'covered' })),
          h('td', null, btn('Remove', function () { C.shifts.splice(i, 1); S.crew.clean(C); save('crew'); draw(); }, 'small', { 'aria-label': 'Remove shift ' + (i + 1) }))));
      });
      root.appendChild(h('div', { class: 'card', style: { marginTop: '16px' } }, h('h2', { text: 'Shifts' }),
        h('div', { class: 'scroll-x' }, h('table', { id: 'c-table' }, h('thead', null, h('tr', null, ['Role', 'Start', 'End', 'Need', 'People', ''].map(function (x) { return h('th', { text: x }); }))), tb)),
        h('div', { class: 'row noprint', style: { marginTop: '10px' } },
          btn('Add shift', function () { C.shifts.push({ id: S.uid('sh'), role: 'New role', start: D.plan.start || '18:00', end: S.fmtHm((S.hm(D.plan.start) || 1080) + 120), need: 1 }); save('crew'); draw(); }, '', { id: 'c-shift' }),
          btn('Load quiz-night shifts', function () { S.STARTER_SHIFTS.forEach(function (x) { C.shifts.push({ id: S.uid('sh'), role: x[0], start: x[1], end: x[2], need: x[3] }); }); save('crew'); draw(); }, '', { id: 'c-starter' }),
          btn('Fill gaps fairly', function () { var r = S.crew.autoFill(C); save('crew'); msg = 'Added ' + r.added + ' assignment' + (r.added === 1 ? '' : 's') + ', spreading hours evenly and never double-booking.' + (r.gaps ? ' Still short: ' + r.gaps + '.' : ''); draw(); }, 'primary', { id: 'c-fill', disabled: !C.people.length || !C.shifts.length }),
          btn('Export CSV', function () { UI.download('volunteer-roster.csv', S.crew.csv(C), 'text/csv'); }),
          btn('Print roster', function () {
            var p = paper(evName() + ': volunteer roster', 'roster'), b2 = h('tbody');
            C.shifts.slice().sort(function (a, b) { return (S.crew.win(a) || [0])[0] - (S.crew.win(b) || [0])[0]; }).forEach(function (s) { b2.appendChild(h('tr', null, h('td', { text: s.start + '-' + s.end }), h('td', { text: s.role }), h('td', { text: (C.assign[s.id] || []).map(function (id) { return byId[id] ? byId[id].name + (byId[id].phone ? ' (' + byId[id].phone + ')' : '') : ''; }).join(', ') }))); });
            p.appendChild(h('table', null, h('thead', null, h('tr', null, ['Time', 'Role', 'Volunteers'].map(function (x) { return h('th', { text: x }); }))), b2));
            var pr = doc.getElementById('c-print'); UI.clear(pr); pr.appendChild(p); UI.print(); }))));
      root.appendChild(h('div', { id: 'c-print', class: 'printarea' }));
    }
    draw();
    UI.onLeave(function () { if (tick) clearInterval(tick); });
  };
})(window);
