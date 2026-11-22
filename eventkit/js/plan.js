/* Stark Event Kit planning logic: schemas, full backup, registration and check-in, seating, run of show, budget,
   volunteer roster, provable prize draw, league and season standings. Pure logic with no DOM, so it runs under node. */
(function (g) {
  'use strict';
  var S = g.SEK = g.SEK || {};
  var MAXS = 4000, seq = 0;
  function trim(v) { return (v == null ? '' : String(v)).trim(); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function uid(p) { seq = (seq + 1) % 1679616; return p + Date.now().toString(36) + seq.toString(36); }
  function iso(now) { return new Date(now || Date.now()).toISOString(); }
  S.uid = uid;

  /* ---------- tiny schema: check (strict, for restore) and fill (lenient, for load) ----------
     'str' 'num' 'int' 'bool' with optional '?' (null allowed) and '=default'; ['enum', a, b]; ['arr', spec, max];
     ['map', spec]; a plain object is a record whose fields are all optional. */
  function prim(spec) { var m = /^(\w+)(\?)?(?:=(.*))?$/.exec(spec); return { t: m[1], nul: !!m[2], d: m[3] }; }
  function primOk(t, v) {
    if (t === 'str') return typeof v === 'string' && v.length <= MAXS;
    if (t === 'num') return typeof v === 'number' && isFinite(v);
    if (t === 'int') return typeof v === 'number' && isFinite(v) && Math.floor(v) === v;
    if (t === 'bool') return typeof v === 'boolean';
    return false;
  }
  var KEY_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
  function check(spec, v, p) {
    var k, e, i, P;
    if (typeof spec === 'string') {
      P = prim(spec); if (v === null && P.nul) return '';
      return primOk(P.t, v) ? '' : p + (P.t === 'str' ? ' must be text' : P.t === 'bool' ? ' must be true or false' : ' must be a number');
    }
    if (Array.isArray(spec)) {
      if (spec[0] === 'enum') return spec.indexOf(v, 1) > 0 ? '' : p + ' has an unknown value';
      if (spec[0] === 'arr') {
        if (!Array.isArray(v)) return p + ' must be a list';
        if (v.length > (spec[2] || 5000)) return p + ' is too long';
        for (i = 0; i < v.length; i++) { e = check(spec[1], v[i], p + '[' + i + ']'); if (e) return e; }
        return '';
      }
      if (!isObj(v)) return p + ' must be an object';
      i = 0;
      for (k in v) { if (++i > 5000) return p + ' is too large'; if (!KEY_RE.test(k)) return p + ' has a bad key'; e = check(spec[1], v[k], p + '.' + k); if (e) return e; }
      return '';
    }
    if (!isObj(v)) return p + ' must be an object';
    for (k in v) if (!own(spec, k)) return p + ' has an unknown field "' + k + '"';
    for (k in spec) if (own(v, k)) { e = check(spec[k], v[k], p + '.' + k); if (e) return e; }
    return '';
  }
  function fill(spec, v) {
    var k, out, P;
    if (typeof spec === 'string') {
      P = prim(spec);
      if (P.t === 'str' && typeof v === 'string') return v.slice(0, MAXS);
      if (primOk(P.t, v)) return v;
      if (P.t === 'int' && typeof v === 'number' && isFinite(v)) return Math.round(v);
      if (v === null && P.nul) return null;
      if (P.d != null) return P.t === 'str' ? P.d : P.t === 'bool' ? P.d === 'true' : +P.d;
      return P.nul ? null : P.t === 'str' ? '' : P.t === 'bool' ? false : 0;
    }
    if (Array.isArray(spec)) {
      if (spec[0] === 'enum') return spec.indexOf(v, 1) > 0 ? v : spec[1];
      if (spec[0] === 'arr') {
        if (!Array.isArray(v)) return [];
        return v.slice(0, spec[2] || 5000).filter(function (x) { return !isObj(spec[1]) || isObj(x); }).map(function (x) { return fill(spec[1], x); });
      }
      out = {}; if (isObj(v)) for (k in v) if (KEY_RE.test(k)) out[k] = fill(spec[1], v[k]);
      return out;
    }
    out = {}; for (k in spec) out[k] = fill(spec[k], isObj(v) ? v[k] : undefined);
    return out;
  }
  S.schema = { check: check, fill: fill };

  var PERSON = { id: 'str', name: 'str', team: 'str', email: 'str', phone: 'str', type: 'str', paid: 'bool', notes: 'str', status: ['enum', 'registered', 'waitlist', 'cancelled'], inAt: 'str?', created: 'num' };
  var DRAW = { id: 'str', at: 'str', name: 'str', entrants: 'str', prizes: ['arr', 'str', 200], multi: 'bool', listHash: 'str', commit: 'str', seed: 'str', audience: 'str',
    state: ['enum', 'committed', 'drawn'], winners: ['arr', { prize: 'str', name: 'str', ticket: 'int' }, 200], revealed: 'bool' };
  S.SPECS = {
    plan: { name: 'str', date: 'str', venue: 'str', start: 'str=19:00', currency: 'str=$', ccode: 'str', cdec: 'int=2' },
    guests: { capacity: 'int', types: ['arr', { id: 'str', name: 'str', price: 'int' }, 50], people: ['arr', PERSON, 5000] },
    seating: { tables: ['arr', { id: 'str', name: 'str', seats: 'int=8', shape: ['enum', 'round', 'rect'] }, 300], seat: ['map', 'str'] },
    show: { items: ['arr', { id: 'str', title: 'str', dur: 'num=10', owner: 'str', cue: 'str' }, 300], live: { on: 'bool', startedAt: 'num', idx: 'int', log: ['arr', 'num', 400] } },
    budget: { attendees: 'int', items: ['arr', { id: 'str', kind: ['enum', 'expense', 'income'], cat: 'str', name: 'str', est: 'int', act: 'int?', paid: 'bool' }, 500] },
    crew: { people: ['arr', { id: 'str', name: 'str', phone: 'str', notes: 'str' }, 500], shifts: ['arr', { id: 'str', role: 'str', start: 'str=18:00', end: 'str=20:00', need: 'int=1' }, 500], assign: ['map', ['arr', 'str', 200]] },
    raffle: { name: 'str=Prize draw', entrants: 'str', prizes: 'str', multi: 'bool', draws: ['arr', DRAW, 50] },
    league: { name: 'str=League', teams: ['arr', 'str', 64], win: 'num=3', draw: 'num=1', loss: 'num', double: 'bool', fixtures: ['arr', { id: 'str', round: 'int', a: 'int', b: 'int', sa: 'num?', sb: 'num?' }, 5000],
      season: { mode: ['enum', 'place', 'score'], pick: ['arr', 'str', 200] } },
    design: { badge: { layout: ['enum', '8', '6'], accent: 'str=#0b7d74', sub: 'str', showTeam: 'bool=true', showType: 'bool=true', src: ['enum', 'guests', 'teams', 'paste'], paste: 'str' },
      cert: { style: ['enum', 'classic', 'modern', 'minimal'], accent: 'str=#0b7d74', line: 'str', perMember: 'bool' } },
    passes: { secret: 'str', scans: ['arr', { code: 'str', at: 'str', pid: 'str', ok: 'bool' }, 10000] },
    overlay: { bg: ['enum', 'green', 'clear', 'dark'], pos: ['enum', 'bottom', 'top'], ticker: 'str', board: 'bool=true', question: 'bool=true', timer: 'bool=true' }
  };
  S.PLAN_KEYS = Object.keys(S.SPECS);
  S.load = function (key) { return fill(S.SPECS[key], S.store ? S.store.get(key, null) : null); };
  S.save = function (key, v) { return S.store.set(key, v); };
  S.ACCENTS = ['#0b7d74', '#1d4ed8', '#b45309', '#be123c', '#6d28d9', '#1f2937'];
  S.color = function (c, d) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : (d || '#0b7d74'); };

  /* ---------- time and money helpers ---------- */
  S.hm = function (t) { var m = /^(\d{1,2}):(\d{2})$/.exec(trim(t)); if (!m || +m[1] > 23 || +m[2] > 59) return null; return +m[1] * 60 + +m[2]; };
  S.fmtHm = function (min) { min = Math.round(min); min = ((min % 1440) + 1440) % 1440; return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); };
  S.money = {
    parse: function (s) {
      s = trim(s).replace(/[,\s]/g, '').replace(/^[^\d.\-]+/, '');
      if (!/^-?\d+(\.\d{0,2})?$|^-?\.\d{1,2}$/.test(s)) return NaN;
      var neg = s.charAt(0) === '-', p = s.replace('-', '').split('.'), c = (+(p[0] || 0)) * 100 + +(((p[1] || '') + '00').slice(0, 2));
      return neg ? -c : c;
    },
    fmt: function (c, cur) {
      if (c == null || !isFinite(c)) return '-';
      var neg = c < 0, a = Math.abs(Math.round(c)), whole = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return (neg ? '-' : '') + (cur == null ? '$' : cur) + whole + '.' + ('0' + (a % 100)).slice(-2);
    }
  };

  /* ---------- registration and check-in ---------- */
  var YES = /^(y|yes|true|1|x|paid)$/i;
  S.reg = {
    count: function (G, status) { return G.people.filter(function (p) { return p.status === status; }).length; },
    find: function (G, id) { for (var i = 0; i < G.people.length; i++) if (G.people[i].id === id) return G.people[i]; return null; },
    add: function (G, o, now) {
      var name = trim(o.name), email = trim(o.email).toLowerCase(), full, p;
      if (!name) return { error: 'Enter a name.' };
      if (G.people.some(function (x) { return x.status !== 'cancelled' && x.name.toLowerCase() === name.toLowerCase() && x.email.toLowerCase() === email; })) return { error: name + ' is already on the list.' };
      full = G.capacity > 0 && S.reg.count(G, 'registered') >= G.capacity;
      p = { id: uid('p'), name: name, team: trim(o.team), email: trim(o.email), phone: trim(o.phone), type: trim(o.type), paid: !!o.paid, notes: trim(o.notes),
        status: full && !o.walkIn ? 'waitlist' : 'registered', inAt: o.walkIn ? iso(now) : null, created: now || Date.now() };
      G.people.push(p); return { person: p, waitlisted: p.status === 'waitlist' };
    },
    checkIn: function (G, id, now) {
      var p = S.reg.find(G, id); if (!p || p.status === 'cancelled') return { error: 'Not on the list.' };
      if (p.inAt) { p.inAt = null; return { person: p, undone: true }; }
      if (p.status === 'waitlist') {
        if (G.capacity > 0 && S.reg.count(G, 'registered') >= G.capacity) return { error: p.name + ' is on the waiting list and the event is full.' };
        p.status = 'registered';
      }
      p.inAt = iso(now); return { person: p };
    },
    promote: function (G) {
      var out = [], w;
      while (!(G.capacity > 0 && S.reg.count(G, 'registered') >= G.capacity)) {
        w = G.people.filter(function (p) { return p.status === 'waitlist'; }).sort(function (a, b) { return a.created - b.created; })[0];
        if (!w) break; w.status = 'registered'; out.push(w);
      }
      return out;
    },
    cancel: function (G, id) { var p = S.reg.find(G, id); if (!p) return []; p.status = 'cancelled'; p.inAt = null; return S.reg.promote(G); },
    restore: function (G, id) { var p = S.reg.find(G, id); if (!p || p.status !== 'cancelled') return null; p.status = G.capacity > 0 && S.reg.count(G, 'registered') >= G.capacity ? 'waitlist' : 'registered'; return p; },
    stats: function (G) {
      var o = { registered: 0, waitlist: 0, cancelled: 0, checkedIn: 0, paid: 0, revenue: 0, byType: {}, over: 0 }, price = {};
      G.types.forEach(function (t) { price[t.name] = t.price; });
      G.people.forEach(function (p) {
        o[p.status]++;
        if (p.status !== 'registered') return;
        if (p.inAt) o.checkedIn++;
        if (p.paid) { o.paid++; o.revenue += price[p.type] || 0; }
        var k = p.type || 'General'; o.byType[k] = o.byType[k] || { count: 0, inside: 0 }; o.byType[k].count++; if (p.inAt) o.byType[k].inside++;
      });
      o.notIn = o.registered - o.checkedIn; o.over = G.capacity > 0 ? Math.max(0, o.registered - G.capacity) : 0;
      return o;
    },
    search: function (G, q) {
      q = trim(q).toLowerCase();
      return G.people.filter(function (p) { return !q || (p.name + ' ' + p.team + ' ' + p.email + ' ' + p.phone + ' ' + p.type).toLowerCase().indexOf(q) >= 0; });
    },
    HEAD: ['name', 'team', 'email', 'phone', 'type', 'paid', 'status', 'checked_in', 'notes'],
    csv: function (G) {
      return [S.csvLine(S.reg.HEAD)].concat(G.people.map(function (p) {
        return S.csvLine([p.name, p.team, p.email, p.phone, p.type, p.paid ? 'yes' : 'no', p.status, p.inAt ? p.inAt.slice(0, 16).replace('T', ' ') : '', p.notes]);
      })).join('\r\n') + '\r\n';
    },
    importCsv: function (G, text, now) {
      var rows = S.csvParse(text), head, ix, out = { added: 0, waitlisted: 0, skipped: [] }, i, r, f, res;
      if (!rows.length) { out.skipped.push({ row: 0, msg: 'nothing to import' }); return out; }
      head = rows[0].map(function (x) { return trim(x).toLowerCase(); });
      ix = function (names) { for (var k = 0; k < names.length; k++) if (head.indexOf(names[k]) >= 0) return head.indexOf(names[k]); return -1; };
      if (ix(['name', 'full name']) < 0) { out.skipped.push({ row: 1, msg: 'the first row needs a "name" column' }); return out; }
      if (rows.length > 5001) { out.skipped.push({ row: 0, msg: 'too many rows (limit 5000)' }); return out; }
      for (i = 1; i < rows.length; i++) {
        r = rows[i]; f = function (names) { var k = ix(names); return k >= 0 ? S.csvUnguard(r[k] || '') : ''; };
        res = S.reg.add(G, { name: f(['name', 'full name']), team: f(['team', 'party', 'group', 'table']), email: f(['email', 'e-mail']), phone: f(['phone', 'mobile']), type: f(['type', 'ticket', 'ticket type']), paid: YES.test(f(['paid'])), notes: f(['notes', 'note']) }, (now || Date.now()) + i);
        if (res.error) out.skipped.push({ row: i + 1, msg: res.error }); else { out.added++; if (res.waitlisted) out.waitlisted++; }
      }
      return out;
    },
    teams: function (G, onlyIn) {
      var order = [], by = {};
      G.people.forEach(function (p) {
        if (p.status !== 'registered' || (onlyIn && !p.inAt)) return;
        var key = p.team ? 't:' + p.team.toLowerCase() : 'p:' + p.id;
        if (!by[key]) { by[key] = { name: p.team || p.name, members: [] }; order.push(key); }
        by[key].members.push(p.name);
      });
      return order.map(function (k) { return by[k]; });
    }
  };

  /* ---------- seating ---------- */
  S.seat = {
    addTables: function (SE, n, seats, shape) {
      for (var i = 0; i < n; i++) SE.tables.push({ id: uid('tb'), name: 'Table ' + (SE.tables.length + 1), seats: Math.max(1, Math.min(40, seats | 0 || 8)), shape: shape === 'rect' ? 'rect' : 'round' });
    },
    clean: function (SE, G) {
      var ok = {}, tid = {}, k;
      G.people.forEach(function (p) { if (p.status === 'registered') ok[p.id] = 1; });
      SE.tables.forEach(function (t) { tid[t.id] = 1; });
      for (k in SE.seat) if (!ok[k] || !tid[SE.seat[k]]) delete SE.seat[k];
    },
    occupancy: function (SE, G) {
      S.seat.clean(SE, G);
      var by = {}, unseated = [], seats = 0;
      SE.tables.forEach(function (t) { by[t.id] = []; seats += t.seats; });
      G.people.forEach(function (p) { if (p.status !== 'registered') return; if (SE.seat[p.id]) by[SE.seat[p.id]].push(p); else unseated.push(p); });
      return { tables: SE.tables.map(function (t) { return { table: t, people: by[t.id], free: t.seats - by[t.id].length, over: by[t.id].length > t.seats }; }), unseated: unseated, seats: seats,
        seated: G.people.filter(function (p) { return p.status === 'registered'; }).length - unseated.length };
    },
    auto: function (SE, G, keep) {
      if (!keep) SE.seat = {};
      S.seat.clean(SE, G);
      var free = {}, teamAt = {}, groups = [], gi = {}, split = [], placed = 0;
      SE.tables.forEach(function (t) { free[t.id] = t.seats; });
      G.people.forEach(function (p) {
        if (p.status !== 'registered') return;
        var key = p.team ? p.team.toLowerCase() : '';
        if (SE.seat[p.id]) { free[SE.seat[p.id]]--; if (key) teamAt[key + '|' + SE.seat[p.id]] = 1; return; }
        var gk = key ? 't:' + key : 'p:' + p.id;
        if (gi[gk] == null) { gi[gk] = groups.length; groups.push({ key: key, label: p.team || p.name, people: [] }); }
        groups[gi[gk]].people.push(p);
      });
      groups = groups.map(function (gr, i) { gr.i = i; return gr; }).sort(function (a, b) { return b.people.length - a.people.length || a.i - b.i; });
      groups.forEach(function (gr) {
        var n = gr.people.length, fit = SE.tables.filter(function (t) { return free[t.id] >= n; });
        var mates = fit.filter(function (t) { return gr.key && teamAt[gr.key + '|' + t.id]; });
        var pick = (mates.length ? mates : fit).sort(function (a, b) { return free[a.id] - free[b.id]; })[0];
        if (pick) { gr.people.forEach(function (p) { SE.seat[p.id] = pick.id; }); free[pick.id] -= n; placed += n; if (gr.key) teamAt[gr.key + '|' + pick.id] = 1; return; }
        var left = gr.people.slice(), used = 0;
        SE.tables.slice().sort(function (a, b) { return free[b.id] - free[a.id]; }).forEach(function (t) {
          if (!left.length || free[t.id] <= 0) return; used++;
          left.splice(0, free[t.id]).forEach(function (p) { SE.seat[p.id] = t.id; free[t.id]--; placed++; });
        });
        if (used > 1 || left.length) split.push(gr.label);
      });
      var occ = S.seat.occupancy(SE, G);
      return { placed: placed, unseated: occ.unseated.length, split: split };
    },
    move: function (SE, pid, tid) { if (tid) SE.seat[pid] = tid; else delete SE.seat[pid]; }
  };

  /* ---------- run of show ---------- */
  S.STARTER_SHOW = [['Doors open and check-in', 30, 'Door team'], ['Welcome and house rules', 5, 'Host'], ['Round 1', 15, 'Host'], ['Round 2', 15, 'Host'],
    ['Break and raffle tickets', 15, 'Raffle desk'], ['Round 3', 15, 'Host'], ['Round 4', 15, 'Host'], ['Scores, prize draw and awards', 15, 'Host'], ['Thanks and close', 5, 'Organiser']];
  S.show = {
    plan: function (SH, start) {
      var t0 = S.hm(start); if (t0 == null) t0 = 19 * 60;
      var at = 0, rows = SH.items.map(function (it) { var r = { item: it, off: at, s: t0 + at, e: t0 + at + (+it.dur || 0) }; at += Math.max(0, +it.dur || 0); return r; });
      return { rows: rows, total: at, start: t0, end: t0 + at };
    },
    start: function (SH, now) { SH.live = { on: true, startedAt: now, idx: 0, log: [now] }; },
    next: function (SH, now) { var L = SH.live; if (!L.on || L.idx >= SH.items.length) return false; L.idx++; L.log.push(now); return true; },
    back: function (SH) { var L = SH.live; if (!L.on || L.idx <= 0) return false; L.idx--; L.log.pop(); return true; },
    stop: function (SH) { SH.live = { on: false, startedAt: 0, idx: 0, log: [] }; },
    status: function (SH, start, now) {
      var L = SH.live; if (!L.on) return null;
      var P = S.show.plan(SH, start), done = L.idx >= SH.items.length, row = P.rows[L.idx] || null;
      var plannedOff = row ? row.off : P.total, actualOff = ((L.log[L.idx] != null ? L.log[L.idx] : now) - L.startedAt) / 60000;
      var elapsed = done ? 0 : (now - L.log[L.idx]) / 60000, dur = row ? (+row.item.dur || 0) : 0;
      var drift = actualOff - plannedOff + (done ? 0 : Math.max(0, elapsed - dur));
      return { idx: L.idx, done: done, item: row ? row.item : null, next: P.rows[L.idx + 1] ? P.rows[L.idx + 1].item : null, elapsed: elapsed, left: dur - elapsed, drift: drift,
        endsAt: P.start + P.total + drift };
    },
    csv: function (SH, start) {
      var P = S.show.plan(SH, start);
      return [S.csvLine(['Start', 'End', 'Minutes', 'Segment', 'Owner', 'Cue notes'])].concat(P.rows.map(function (r) { return S.csvLine([S.fmtHm(r.s), S.fmtHm(r.e), r.item.dur, r.item.title, r.item.owner, r.item.cue]); })).join('\r\n') + '\r\n';
    }
  };

  /* ---------- budget ---------- */
  S.STARTER_BUDGET = [['expense', 'Venue', 'Room hire', 25000], ['expense', 'Prizes', 'Prizes for the top three', 9000], ['expense', 'Printing', 'Answer sheets and certificates', 2000],
    ['expense', 'Food and drink', 'Snacks for volunteers', 4000], ['income', 'Tickets', 'Ticket sales', 0], ['income', 'Raffle', 'Raffle tickets', 6000], ['income', 'Sponsorship', 'Local sponsor', 10000]];
  S.budget = {
    totals: function (B, unit) {   // unit: smallest step of an amount, 100 for a currency without decimals (see js/currency.js)
      unit = unit > 1 ? unit : 1;
      var o = { exp: { est: 0, act: 0, fc: 0 }, inc: { est: 0, act: 0, fc: 0 }, cats: {}, unpaid: 0, ticketsEst: 0 };
      B.items.forEach(function (it) {
        var side = it.kind === 'income' ? o.inc : o.exp, fc = it.act != null ? it.act : it.est, ck = it.kind + '|' + (it.cat || 'Other');
        side.est += it.est; side.act += it.act || 0; side.fc += fc;
        o.cats[ck] = o.cats[ck] || { kind: it.kind, cat: it.cat || 'Other', est: 0, fc: 0 }; o.cats[ck].est += it.est; o.cats[ck].fc += fc;
        if (it.kind === 'expense' && !it.paid) o.unpaid += fc;
        if (it.kind === 'income' && /^tickets?$/i.test(trim(it.cat))) o.ticketsEst += it.est;
      });
      o.net = { est: o.inc.est - o.exp.est, act: o.inc.act - o.exp.act, fc: o.inc.fc - o.exp.fc };
      o.perHead = B.attendees > 0 ? Math.round(o.exp.fc / B.attendees / unit) * unit : null;
      o.breakEven = B.attendees > 0 ? Math.max(0, Math.ceil((o.exp.est - (o.inc.est - o.ticketsEst)) / B.attendees / unit) * unit) : null;
      o.cats = Object.keys(o.cats).map(function (k) { return o.cats[k]; });
      return o;
    },
    // cur (optional, from S.cur): the currency of the event. Amounts are plain numbers with its decimals and a Currency column says which.
    csv: function (B, cur) {
      var dec = cur && cur.dec === 0 ? 0 : 2, code = cur ? (cur.code || cur.symbol || '') : '', f = function (c) { return (Math.round(c / (dec ? 1 : 100)) / (dec ? 100 : 1)).toFixed(dec); };
      return [S.csvLine(['Kind', 'Category', 'Item', 'Estimate', 'Actual', 'Paid'].concat(cur ? ['Currency'] : []))].concat(B.items.map(function (it) {
        return S.csvLine([it.kind, it.cat, it.name, f(it.est), it.act == null ? '' : f(it.act), it.kind === 'expense' ? (it.paid ? 'yes' : 'no') : ''].concat(cur ? [code] : []));
      })).join('\r\n') + '\r\n';
    }
  };

  /* ---------- volunteer roster ---------- */
  S.STARTER_SHIFTS = [['Door and check-in', '18:00', '20:00', 2], ['Scorekeeper', '19:00', '22:00', 1], ['Raffle desk', '19:30', '21:00', 1], ['Runner', '19:00', '22:00', 2], ['Set-down', '22:00', '23:00', 3]];
  S.crew = {
    /* minutes on the event day; times before 05:00 count as after midnight, so late shifts compare correctly */
    win: function (sh) { var s = S.hm(sh.start), e = S.hm(sh.end); if (s == null || e == null) return null; if (s < 300) s += 1440; if (e < 300) e += 1440; if (e <= s) e += 1440; return [s, e]; },
    overlap: function (a, b) { var x = S.crew.win(a), y = S.crew.win(b); return !!(x && y && x[0] < y[1] && y[0] < x[1]); },
    clean: function (C) {
      var pid = {}, sid = {}, k; C.people.forEach(function (p) { pid[p.id] = 1; }); C.shifts.forEach(function (s) { sid[s.id] = 1; });
      for (k in C.assign) { if (!sid[k]) { delete C.assign[k]; continue; } C.assign[k] = C.assign[k].filter(function (id, i, a) { return pid[id] && a.indexOf(id) === i; }); }
    },
    shiftsOf: function (C, pid) { return C.shifts.filter(function (s) { return (C.assign[s.id] || []).indexOf(pid) >= 0; }); },
    coverage: function (C) {
      S.crew.clean(C);
      var rows = C.shifts.map(function (s) { var n = (C.assign[s.id] || []).length; return { shift: s, filled: n, gap: Math.max(0, s.need - n) }; });
      return { rows: rows, need: rows.reduce(function (a, r) { return a + r.shift.need; }, 0), gaps: rows.reduce(function (a, r) { return a + r.gap; }, 0) };
    },
    conflicts: function (C) {
      S.crew.clean(C);
      var out = [];
      C.people.forEach(function (p) {
        var mine = S.crew.shiftsOf(C, p.id), i, j;
        for (i = 0; i < mine.length; i++) for (j = i + 1; j < mine.length; j++) if (S.crew.overlap(mine[i], mine[j])) out.push({ person: p, a: mine[i], b: mine[j] });
      });
      return out;
    },
    minutes: function (C, pid) { return S.crew.shiftsOf(C, pid).reduce(function (a, s) { var w = S.crew.win(s); return a + (w ? w[1] - w[0] : 0); }, 0); },
    assign: function (C, sid, pid, on) {
      var l = C.assign[sid] = C.assign[sid] || [], i = l.indexOf(pid);
      if (on && i < 0) l.push(pid); else if (!on && i >= 0) l.splice(i, 1);
    },
    autoFill: function (C) {
      S.crew.clean(C);
      var added = 0;
      C.shifts.slice().sort(function (a, b) { var x = S.crew.win(a), y = S.crew.win(b); return (x ? x[0] : 0) - (y ? y[0] : 0); }).forEach(function (s) {
        var l = C.assign[s.id] = C.assign[s.id] || [];
        while (l.length < s.need) {
          var cand = C.people.filter(function (p) { return l.indexOf(p.id) < 0 && !S.crew.shiftsOf(C, p.id).some(function (o) { return S.crew.overlap(o, s); }); });
          if (!cand.length) break;
          cand.sort(function (a, b) { return S.crew.minutes(C, a.id) - S.crew.minutes(C, b.id) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
          l.push(cand[0].id); added++;
        }
      });
      return { added: added, gaps: S.crew.coverage(C).gaps };
    },
    csv: function (C) {
      var by = {}; C.people.forEach(function (p) { by[p.id] = p.name; });
      return [S.csvLine(['Role', 'Start', 'End', 'Needed', 'Assigned'])].concat(C.shifts.map(function (s) { return S.csvLine([s.role, s.start, s.end, s.need, (C.assign[s.id] || []).map(function (id) { return by[id]; }).join('; ')]); })).join('\r\n') + '\r\n';
    }
  };

  /* ---------- provable prize draw ----------
     Commit: a 256-bit secret seed from crypto.getRandomValues; the screen shows SHA-256("stark-draw-1|" + seed) and the
     hash of the locked entrant list before anything is drawn. An audience number, chosen after the commitment is shown,
     is mixed in so the host cannot try seeds until one suits them. Draw: uint32 words from
     SHA-256(seed | audience | listHash | counter), turned into an index with rejection sampling (no modulo bias).
     Reveal: the seed is shown, and anyone can recompute the commitment and every winner. */
  S.raffle = {
    METHOD: 'stark-draw-1: commit = SHA-256("stark-draw-1|" + seed); stream block i = SHA-256(seed + "|" + audience + "|" + listHash + "|" + i), read as eight big-endian uint32 words; index = first word w below 2^32 - (2^32 mod n), then w mod n; tickets are numbered in list order; a winner\'s other tickets leave the pool unless multiple wins are allowed.',
    parse: function (text) {
      var out = [], by = {}, dups = 0, errors = [];
      String(text || '').split(/\r?\n/).forEach(function (line, i) {
        line = trim(line); if (!line) return;
        var m = /^(.*?)(?:\s*(?:[,;\t]|\s[x*])\s*(\d+))?$/i.exec(line), name = trim(m[1]).replace(/\s+/g, ' '), n = m[2] ? +m[2] : 1;
        if (!name) return;
        if (n < 1 || n > 1000) { errors.push('Line ' + (i + 1) + ': tickets must be 1 to 1000'); return; }
        var k = name.toLowerCase();
        if (by[k]) { by[k].tickets += n; dups++; } else { by[k] = { name: name, tickets: n }; out.push(by[k]); }
      });
      var total = out.reduce(function (a, e) { return a + e.tickets; }, 0);
      if (out.length > 5000) errors.push('Too many entrants (limit 5000)');
      if (total > 100000) errors.push('Too many tickets (limit 100000)');
      return { entrants: out, total: total, dups: dups, errors: errors };
    },
    canonical: function (entrants) { return entrants.map(function (e) { return e.name.replace(/[\t\r\n]/g, ' ') + '\t' + e.tickets; }).join('\n'); },
    fromCanonical: function (text) { return String(text).split('\n').filter(Boolean).map(function (l) { var p = l.split('\t'); return { name: p[0], tickets: Math.max(1, +p[1] | 0) }; }); },
    newSeed: function () {
      var c = g.crypto; if (!c || !c.getRandomValues) throw new Error('This browser has no secure random source.');
      var b = new Uint8Array(32), s = ''; c.getRandomValues(b);
      for (var i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2);
      return s;
    },
    commitOf: function (seed) { return S.sha256('stark-draw-1|' + seed); },
    stream: function (seed, audience, listHash) {
      var ctr = 0, words = [];
      return function () {
        if (!words.length) { var h = S.sha256(seed + '|' + (audience || '') + '|' + listHash + '|' + ctr++); for (var i = 0; i < 64; i += 8) words.push(parseInt(h.slice(i, i + 8), 16)); }
        return words.shift();
      };
    },
    below: function (next, n) {
      if (!(n >= 1 && n <= 4294967296)) throw new Error('bad range');
      var lim = 4294967296 - (4294967296 % n), x;
      do { x = next(); } while (x >= lim);
      return x % n;
    },
    secureBelow: function (n) { var c = g.crypto, a = new Uint32Array(1); return S.raffle.below(function () { c.getRandomValues(a); return a[0]; }, n); },
    run: function (entrantsText, prizes, multi, seed, audience) {
      var ents = S.raffle.fromCanonical(entrantsText), listHash = S.sha256(entrantsText), next = S.raffle.stream(seed, audience, listHash), pool = [], t = 0, out = [];
      ents.forEach(function (e, i) { for (var k = 0; k < e.tickets; k++) pool.push({ e: i, t: ++t }); });
      prizes.forEach(function (prize) {
        if (!pool.length) return;
        var pick = pool[S.raffle.below(next, pool.length)];
        out.push({ prize: prize, name: ents[pick.e].name, ticket: pick.t });
        pool = pool.filter(function (x) { return multi ? x.t !== pick.t : x.e !== pick.e; });
      });
      return out;
    },
    commit: function (R, now, seed) {
      var p = S.raffle.parse(R.entrants), prizes = String(R.prizes || '').split(/\r?\n/).map(trim).filter(Boolean).slice(0, 200);
      if (p.errors.length) return { error: p.errors[0] };
      if (!p.entrants.length) return { error: 'Add at least one entrant.' };
      if (!prizes.length) return { error: 'Add at least one prize.' };
      var text = S.raffle.canonical(p.entrants);
      seed = seed || S.raffle.newSeed();
      var d = { id: uid('d'), at: iso(now), name: trim(R.name) || 'Prize draw', entrants: text, prizes: prizes, multi: !!R.multi, listHash: S.sha256(text), commit: S.raffle.commitOf(seed), seed: seed,
        audience: '', state: 'committed', winners: [], revealed: false };
      R.draws.unshift(d); if (R.draws.length > 50) R.draws.length = 50;
      return { draw: d };
    },
    draw: function (D, audience) { if (D.state !== 'committed') return false; D.audience = trim(audience).slice(0, 200); D.winners = S.raffle.run(D.entrants, D.prizes, D.multi, D.seed, D.audience); D.state = 'drawn'; return true; },
    record: function (D) {
      return { format: 'stark-event-kit-draw', version: 1, name: D.name, at: D.at, method: S.raffle.METHOD, entrants: D.entrants, listHash: D.listHash, prizes: D.prizes, multi: D.multi,
        commit: D.commit, audience: D.audience, seed: D.revealed ? D.seed : '(not revealed yet)', winners: D.winners };
    },
    verify: function (rec) {
      var o = { problems: [] };
      if (!isObj(rec) || typeof rec.entrants !== 'string' || typeof rec.seed !== 'string' || typeof rec.commit !== 'string' || !Array.isArray(rec.prizes)) { o.problems.push('This is not a draw record.'); return o; }
      if (!/^[0-9a-f]{64}$/.test(rec.seed)) { o.problems.push('The seed has not been revealed (or is not 64 hex characters).'); return o; }
      o.commitOk = S.raffle.commitOf(rec.seed) === rec.commit; if (!o.commitOk) o.problems.push('The seed does not match the commitment shown before the draw.');
      o.listOk = rec.listHash == null || S.sha256(rec.entrants) === rec.listHash; if (!o.listOk) o.problems.push('The entrant list does not match the list hash shown before the draw.');
      o.winners = S.raffle.run(rec.entrants, rec.prizes.map(String), !!rec.multi, rec.seed, typeof rec.audience === 'string' ? rec.audience : '');
      if (Array.isArray(rec.winners)) { o.winnersOk = JSON.stringify(o.winners.map(function (w) { return [w.prize, w.name, w.ticket]; })) === JSON.stringify(rec.winners.map(function (w) { return [w.prize, w.name, w.ticket]; })); if (!o.winnersOk) o.problems.push('The recorded winners differ from a fresh re-run.'); }
      o.ok = !o.problems.length; return o;
    }
  };

/* full version only */
  /* ---------- full backup and restore ---------- */
  var BMAX = 40000000;
  function gameOk(v, p) {
    if (!isObj(v) || !Array.isArray(v.teams) || !Array.isArray(v.questions) || !Array.isArray(v.rounds) || !isObj(v.marks) || !isObj(v.scoring)) return p + ' is not an event';
    for (var i = 0; i < v.teams.length; i++) if (!isObj(v.teams[i]) || typeof v.teams[i].id !== 'string' || typeof v.teams[i].name !== 'string') return p + ' has a bad team';
    for (i = 0; i < v.questions.length; i++) {
      var q = v.questions[i];
      if (!isObj(q) || typeof q.q !== 'string' || typeof q.a !== 'string' || !Array.isArray(q.choices)) return p + ' has a bad question';
      if (q.img != null && !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/=]+$/.test(q.img)) return p + ' has a bad picture';
    }
    return '';
  }
  S.backup = {
    KEYS: ['custom', 'history', 'game', 'bracket', 'jam'].concat(Object.keys(S.SPECS)),
    collect: function () { var d = {}; S.backup.KEYS.forEach(function (k) { var v = S.store.get(k, null); if (v != null) d[k] = v; }); return d; },
    make: function (data, now) { return { format: 'stark-event-kit-backup', version: 1, app: S.VERSION, savedAt: iso(now), checksum: S.sha256(JSON.stringify(data)), data: data }; },
    checkKey: function (k, v) {
      var i, e;
      if (S.SPECS[k]) return check(S.SPECS[k], v, k);
      if (k === 'custom') {
        if (!Array.isArray(v) || v.length > 5000) return 'custom questions must be a list';
        for (i = 0; i < v.length; i++) { e = S.validate(v[i]); if (e.length) return 'custom question ' + (i + 1) + ': ' + e[0]; }
        return '';
      }
      if (k === 'game') return gameOk(v, 'the current event');
      if (k === 'history') { if (!Array.isArray(v) || v.length > 50) return 'history must be a list'; for (i = 0; i < v.length; i++) { e = gameOk(v[i], 'past event ' + (i + 1)); if (e) return e; } return ''; }
      if (k === 'bracket') return check({ names: ['arr', 'str', 128], winners: ['map', 'int'] }, v, 'bracket');
      if (k === 'jam') return isObj(v) && isObj(v.rubric) && Array.isArray(v.rubric.criteria) && Array.isArray(v.rubric.judges) && Array.isArray(v.rubric.entries) && Array.isArray(v.checklist) && isObj(v.scores) && isObj(v.timer) ? '' : 'game jam data is not valid';
      return 'unknown section "' + k + '"';
    },
    parse: function (text) {
      var j, k, e, note;
      text = String(text || '').trim();
      if (!text) return { error: 'Choose a backup file first.' };
      if (text.length > BMAX) return { error: 'File refused: it is too large. Nothing was changed.' };
      try { j = JSON.parse(text, function (key, v) { if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('forbidden key ' + key); return v; }); }
      catch (x) { return { error: 'File refused: not valid JSON (' + x.message + '). Nothing was changed.' }; }
      if (!isObj(j) || j.format !== 'stark-event-kit-backup') return { error: 'File refused: this is not a Stark Event Kit backup. Nothing was changed.' };
      for (k in j) if (['format', 'version', 'app', 'savedAt', 'checksum', 'data'].indexOf(k) < 0) return { error: 'File refused: unknown field "' + k + '". Nothing was changed.' };
      if (j.version !== 1) return { error: 'File refused: made by a newer version. Nothing was changed.' };
      if (!isObj(j.data)) return { error: 'File refused: no data section. Nothing was changed.' };
      if (j.checksum != null) {
        if (j.checksum !== S.sha256(JSON.stringify(j.data))) return { error: 'File refused: its checksum does not match, so it was changed or damaged. Nothing was changed.' };
        note = 'Checksum verified.';
      } else note = 'No checksum; every section was validated.';
      for (k in j.data) { if (S.backup.KEYS.indexOf(k) < 0) return { error: 'File refused: unknown section "' + k + '". Nothing was changed.' }; e = S.backup.checkKey(k, j.data[k]); if (e) return { error: 'File refused: ' + e + '. Nothing was changed.' }; }
      return { data: j.data, note: note, savedAt: typeof j.savedAt === 'string' ? j.savedAt : '', keys: Object.keys(j.data) };
    },
    restore: function (data) {
      var ok = [], failed = [];
      Object.keys(data).forEach(function (k) { if (S.store.set(k, data[k])) ok.push(k); else failed.push(k); });
      return { ok: ok, failed: failed };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
