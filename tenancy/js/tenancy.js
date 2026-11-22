/* Stark Tenancy engines (browser and node; no DOM, no network, no storage): condition reports and their comparison and
   sign-off fingerprint, the repair log, the rent and deposit ledger, smoke and CO alarm reminders with a calendar file,
   photo dates from the camera (EXIF), the "answer a few questions, get your letters" interview and today's to-do list. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  var D = TN.dates, U = TN.util, T = TN.i18n.T;

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function findBy(list, key, v) { for (var i = 0; i < (list || []).length; i++) { if (list[i][key] === v) { return list[i]; } } return null; }
  function byId(list, id) { return findBy(list, 'id', id); }
  function lab(o, lg) { return o ? ((lg || TN.i18n.lang()) === 'es' && o.es ? o.es : o.en) : ''; }

  /* ---------- condition reports ---------- */
  function cond(v) { return findBy(TN.data.conditions, 'v', v); }
  function itemName(key, lg) { var it = TN.data.items[key]; return it ? ((lg || TN.i18n.lang()) === 'es' ? it[1] : it[0]) : key; }
  function makeRoom(typeId, name, lg) {
    var t = byId(TN.data.roomTypes, typeId) || { id: 'custom', items: ['walls', 'ceiling', 'floor', 'lights'] };
    return { id: uid(), type: t.id, name: name || lab(t, lg), note: '', photos: [], items: t.items.map(function (k) { return { id: uid(), key: k, name: itemName(k, lg), cond: '', note: '' }; }) };
  }
  function uniqueName(rooms, base) {
    var names = rooms.map(function (r) { return norm(r.name); }), n = 2;
    if (names.indexOf(norm(base)) < 0) { return base; }
    while (names.indexOf(norm(base + ' ' + n)) >= 0) { n++; }
    return base + ' ' + n;
  }
  function addRoom(report, typeId, name, lg) {
    var t = byId(TN.data.roomTypes, typeId), room = makeRoom(typeId, uniqueName(report.rooms, name || (t ? lab(t, lg) : T('Room', 'Cuarto'))), lg);
    report.rooms.push(room);
    return room;
  }
  function newReport(phase, presetId, dateIso, lg) {
    var p = byId(TN.data.presets, presetId) || TN.data.presets[1], r = { id: uid(), phase: phase === 'out' ? 'out' : 'in', date: dateIso || '', rooms: [], extras: { keys: '', meters: '', other: '' }, sign: {} },
      count = {};
    p.rooms.forEach(function (t) { count[t] = (count[t] || 0) + 1; });
    var seen = {};
    p.rooms.forEach(function (t) {
      var base = lab(byId(TN.data.roomTypes, t), lg);
      seen[t] = (seen[t] || 0) + 1;
      r.rooms.push(makeRoom(t, count[t] > 1 ? base + ' ' + seen[t] : base, lg));
    });
    return r;
  }
  /* copy a move-in report's rooms and items into a fresh move-out report (conditions and photos left blank) */
  function fromReport(src, dateIso) {
    return { id: uid(), phase: 'out', date: dateIso || '', extras: { keys: '', meters: '', other: '' }, sign: {},
      rooms: (src.rooms || []).map(function (rm) { return { id: uid(), type: rm.type, name: rm.name, note: '', photos: [], items: rm.items.map(function (it) { return { id: uid(), key: it.key, name: it.name, cond: '', note: '' }; }) }; }) };
  }
  function progress(r) {
    var total = 0, rated = 0, photos = 0, done = 0;
    (r.rooms || []).forEach(function (rm) {
      var n = 0;
      rm.items.forEach(function (it) { total++; if (it.cond) { rated++; n++; } });
      photos += (rm.photos || []).length;
      if (n === rm.items.length && rm.items.length) { done++; }
    });
    return { total: total, rated: rated, photos: photos, rooms: (r.rooms || []).length, roomsDone: done, pct: total ? Math.round(100 * rated / total) : 0 };
  }
  /* comparison: full version only */
  /* what both parties sign: everything in the report except the signatures, with each photo's SHA-256 */
  function canonical(r, hashes) {
    hashes = hashes || {};
    return JSON.stringify([r.phase, r.date, (r.rooms || []).map(function (rm) {
      return [rm.name, rm.note || '', rm.items.map(function (it) { return [it.name, it.cond || '', it.note || '']; }), (rm.photos || []).map(function (id) { return hashes[id] || id; })];
    }), [(r.extras || {}).keys || '', (r.extras || {}).meters || '', (r.extras || {}).other || '']]);
  }
  function fingerprint(r, hashes) { return TN.backup.sha256(canonical(r, hashes)); }
  function signStatus(r, hashes) {
    var now = fingerprint(r, hashes), s = r.sign || {}, parties = ['tenant', 'landlord'].filter(function (p) { return s[p] && s[p].name && s[p].hash; }),
      changed = parties.some(function (p) { return s[p].hash !== now; });
    return { hash: now, parties: parties, state: changed ? 'changed' : (parties.length === 2 ? 'both' : (parties.length ? 'one' : 'none')) };
  }

  /* ---------- check-out comparison sheet: move-in against move-out, room by room, item by item. A record of what was written and
     photographed at each date. It marks what is the same or different; it never says who is responsible or what may be deducted. ---------- */
  var RECORD_LINE = {
    en: 'This sheet records what was written and photographed at each date. It does not say who is responsible for any change or what may be deducted from a deposit.',
    es: 'Esta hoja registra lo que se escribió y se fotografió en cada fecha. No dice quién es responsable de ningún cambio ni qué se puede descontar de un depósito.'
  };
  /* comparison: full version only */
  function signLines(r, hashes) {
    var st = signStatus(r, hashes), s = r.sign || {};
    return { state: st.state, fingerprint: st.hash, parties: st.parties.map(function (p) { return { who: p, name: s[p].name, at: s[p].at || '', hash: s[p].hash, matches: s[p].hash === st.hash, comment: s[p].comment || '' }; }) };
  }
  /* comparison: full version only */
  /* ---------- repair log ---------- */
  var PRIORITY = {
    urgent: { days: 1, en: 'Urgent: safety, no heat or water, a leak', es: 'Urgente: seguridad, sin calefacción o agua, una fuga' },
    soon: { days: 7, en: 'Soon', es: 'Pronto' },
    routine: { days: 14, en: 'Routine', es: 'De rutina' }
  };
  var STATUS = {
    open: { en: 'Open', es: 'Abierta' }, scheduled: { en: 'Scheduled', es: 'Programada' },
    fixed: { en: 'Fixed', es: 'Arreglada' }, closed: { en: 'Closed, not fixed', es: 'Cerrada sin arreglo' }
  };
  var HOW = [
    { v: 'text', en: 'Text message', es: 'Mensaje de texto', phrase: 'by text message' }, { v: 'email', en: 'Email', es: 'Correo electrónico', phrase: 'by email' },
    { v: 'letter', en: 'Letter', es: 'Carta', phrase: 'by letter' }, { v: 'portal', en: 'Online portal', es: 'Portal en línea', phrase: 'through the online portal' },
    { v: 'phone', en: 'Phone call', es: 'Llamada', phrase: 'by phone' }, { v: 'person', en: 'In person', es: 'En persona', phrase: 'in person' }
  ];
  function suggestFollowUp(priority, from) { return D.addDays(from, (PRIORITY[priority] || PRIORITY.routine).days); }
  function isOpen(r) { return !r.status || r.status === 'open' || r.status === 'scheduled'; }
  function followState(r, today) {
    if (!isOpen(r) || !D.isIso(r.followUpOn)) { return null; }
    var d = D.daysBetween(today, r.followUpOn);
    return d < 0 ? 'overdue' : (d === 0 ? 'today' : (d <= 3 ? 'soon' : 'later'));
  }
  function daysOpen(r, today) { var d = D.daysBetween(r.reportedOn, isOpen(r) ? today : (r.fixedOn || today)); return d == null ? null : Math.max(0, d); }
  function addUpdate(r, u) {
    var n = Object.assign({}, r, { updates: (r.updates || []).concat([{ date: u.date, kind: u.kind || 'note', note: u.note || '' }]) });
    if (u.status && STATUS[u.status]) { n.status = u.status; }
    if (u.followUpOn !== undefined) { n.followUpOn = u.followUpOn; }
    if (n.status === 'fixed') { n.fixedOn = n.fixedOn || u.date; } else { n.fixedOn = ''; }
    return n;
  }
  function followUpDates(r) {
    return (r.updates || []).filter(function (u) { return u.kind === 'followup' || u.kind === 'letter'; }).map(function (u) { return D.pretty(u.date, 'en'); });
  }
  function joinList(a) { return a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function howPhrase(v) { var h = findBy(HOW, 'v', v); return h ? h.phrase : ''; }
  /* plain English for letters: "I first reported this on November 2, 2026 by text message. I followed up on ..." */
  function historyLine(r) {
    var s = '', f = followUpDates(r);
    if (D.isIso(r.reportedOn)) { s = 'I first reported this on ' + D.pretty(r.reportedOn, 'en') + (howPhrase(r.how) ? ' ' + howPhrase(r.how) : '') + '.'; }
    if (f.length) { s += (s ? ' ' : '') + 'I followed up on ' + joinList(f) + '.'; }
    return s;
  }
  function repairSummary(list, today) {
    var open = (list || []).filter(isOpen), fixed = (list || []).filter(function (r) { return r.status === 'fixed' && D.isIso(r.fixedOn) && D.isIso(r.reportedOn); }),
      due = open.filter(function (r) { var s = followState(r, today); return s === 'overdue' || s === 'today'; });
    return { open: open.length, due: due, fixed: fixed.length, total: (list || []).length,
      avgDaysToFix: fixed.length ? Math.round(fixed.reduce(function (s, r) { return s + D.daysBetween(r.reportedOn, r.fixedOn); }, 0) / fixed.length) : null,
      oldestOpenDays: open.reduce(function (m, r) { var d = daysOpen(r, today); return d != null && d > m ? d : m; }, 0) };
  }

  /* ---------- rent and deposit ledger ---------- */
  var KINDS = [
    { v: 'rent', en: 'Rent payment', es: 'Pago de renta' }, { v: 'deposit', en: 'Deposit paid', es: 'Depósito pagado' },
    { v: 'deposit_back', en: 'Deposit returned', es: 'Depósito devuelto' }, { v: 'deduction', en: 'Deposit deduction', es: 'Descuento del depósito' },
    { v: 'fee', en: 'Fee or charge', es: 'Cargo' }, { v: 'credit', en: 'Credit or refund', es: 'Crédito o reembolso' }
  ];
  function kind(v) { return findBy(KINDS, 'v', v); }
  function monthOf(e) { return /^\d{4}-\d{2}$/.test(e.period || '') ? e.period : String(e.date || '').slice(0, 7); }
  function ledgerSummary(entries, cfg, today) {
    var tot = { rent: 0, deposit: 0, deposit_back: 0, deduction: 0, fee: 0, credit: 0 }, byMonth = {}, rent = U.num(cfg && cfg.rent), dueDay = Math.min(28, Math.max(1, parseInt(cfg && cfg.dueDay, 10) || 1)),
      start = cfg && D.isIso(cfg.start) ? cfg.start : '', last = today, expected = [], m, guard = 0, due;
    (entries || []).forEach(function (e) { var a = U.num(e.amount); if (e.kind in tot) { tot[e.kind] += a; } if (e.kind === 'rent') { byMonth[monthOf(e)] = (byMonth[monthOf(e)] || 0) + a; } });
    if (cfg && D.isIso(cfg.end) && cfg.end < last) { last = cfg.end; }
    if (rent > 0 && start && start <= last) {
      m = start.slice(0, 7);
      while (guard++ < 600) {
        due = m + '-' + U.pad2(dueDay);
        if (m === start.slice(0, 7) && due < start) { due = start; }
        if (due > last) { break; }
        var paid = Math.round((byMonth[m] || 0) * 100) / 100;
        expected.push({ month: m, due: due, paid: paid, owed: rent, status: paid >= rent - 0.005 ? 'paid' : (paid > 0 ? 'short' : 'missing') });
        m = D.addMonths(m + '-01', 1).slice(0, 7);
      }
    }
    return { rent: rent, dueDay: dueDay, totals: tot, expected: expected,
      missing: expected.filter(function (x) { return x.status === 'missing'; }), short: expected.filter(function (x) { return x.status === 'short'; }),
      depositPaid: tot.deposit, depositHeld: Math.round((tot.deposit - tot.deposit_back - tot.deduction) * 100) / 100,
      rows: (entries || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }) };
  }
  function csvCell(v) { var s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) { s = "'" + s; } return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function ledgerCsv(entries) {
    var rows = [['Date', 'Type', 'For month', 'Amount', 'Method', 'Reference', 'Note', 'Receipt photo']];
    (entries || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (e) {
      rows.push([e.date || '', (kind(e.kind) || { en: e.kind }).en, e.kind === 'rent' ? monthOf(e) : '', U.num(e.amount).toFixed(2), e.method || '', e.ref || '', e.note || '', e.receipt ? 'yes' : 'no']);
    });
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }
  function receiptNo(e) { return 'R-' + String(e.date || '').replace(/-/g, '') + '-' + String(e.id || '').slice(-4).toUpperCase(); }

  /* ---------- smoke and CO alarms (USFA: test smoke alarms monthly, 9-volt batteries yearly, replace 10 years from manufacture;
     NFPA: test CO alarms monthly, replace as the maker says) ---------- */
  var ALARM_KIND = { smoke: { en: 'Smoke alarm', es: 'Alarma de humo' }, co: { en: 'Carbon monoxide (CO) alarm', es: 'Alarma de monóxido de carbono (CO)' }, combo: { en: 'Smoke and CO combination', es: 'Combinada de humo y CO' } };
  var POWER = { battery: { en: 'Replaceable battery', es: 'Batería reemplazable', battery: true }, sealed: { en: 'Sealed long-life battery', es: 'Batería sellada de larga duración', battery: false },
    hardwired: { en: 'Hardwired with backup battery', es: 'Cableada con batería de respaldo', battery: true } };
  var TEST_DAYS = 30, BATTERY_DAYS = 365;
  function madeIso(s) { s = String(s || ''); return /^\d{4}-\d{2}$/.test(s) ? s + '-01' : (D.isIso(s) ? s : ''); }
  function stateOf(dueIso, today, soonDays) { var d = D.daysBetween(today, dueIso); return d == null ? null : (d < 0 ? 'overdue' : (d <= soonDays ? 'due' : 'ok')); }
  function lastTest(a) {
    var t = (a.tests || []).map(function (x) { return x.date; }).filter(D.isIso).sort();
    return t.length ? t[t.length - 1] : (D.isIso(a.lastTested) ? a.lastTested : '');
  }
  function alarmStatus(a, today) {
    var lt = lastTest(a), p = POWER[a.power] || POWER.battery, testDue = lt ? D.addDays(lt, TEST_DAYS) : today, out = {}, made = madeIso(a.made), tests = (a.tests || []).slice().sort(function (x, y) { return String(x.date).localeCompare(String(y.date)); });
    out.lastTest = lt; out.testDue = testDue; out.testState = lt ? stateOf(testDue, today, 7) : 'never';
    out.lastOk = tests.length ? tests[tests.length - 1].ok !== false : null;
    out.batteryDue = p.battery && D.isIso(a.batteryOn) ? D.addDays(a.batteryOn, BATTERY_DAYS) : '';
    out.batteryState = p.battery ? (out.batteryDue ? stateOf(out.batteryDue, today, 30) : 'unknown') : null;
    out.replaceBy = D.isIso(a.replaceBy) ? a.replaceBy : (a.kind === 'smoke' && a.power !== 'sealed' && made ? D.addMonths(made, 120) : '');
    out.replaceState = out.replaceBy ? stateOf(out.replaceBy, today, 90) : null;
    out.worst = [out.testState === 'never' ? 'overdue' : out.testState, out.batteryState === 'unknown' ? null : out.batteryState, out.replaceState, out.lastOk === false ? 'overdue' : null]
      .reduce(function (w, s) { var R = { ok: 0, due: 1, overdue: 2 }; return s && R[s] > R[w] ? s : w; }, 'ok');
    return out;
  }
  function alarmSummary(list, today) {
    var st = (list || []).map(function (a) { return { a: a, s: alarmStatus(a, today) }; });
    return { count: st.length, testsDue: st.filter(function (x) { return x.s.testState !== 'ok'; }).length,
      batteryDue: st.filter(function (x) { return x.s.batteryState === 'overdue' || x.s.batteryState === 'due'; }).length,
      replaceDue: st.filter(function (x) { return x.s.replaceState === 'overdue' || x.s.replaceState === 'due'; }).length,
      failed: st.filter(function (x) { return x.s.lastOk === false; }).length,
      nextTest: st.map(function (x) { return x.s.testDue; }).sort()[0] || '' };
  }
  function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsDate(iso) { return String(iso).replace(/-/g, ''); }
  function alarmIcs(list, today, place) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stark//Stark Tenancy 1.1//EN', 'CALSCALE:GREGORIAN'], stamp = icsDate(today) + 'T000000Z', sum = alarmSummary(list, today), first, names;
    function ev(id, start, title, desc, rrule) {
      L.push('BEGIN:VEVENT', 'UID:' + id + '@stark-tenancy.invalid', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + icsDate(start), 'SUMMARY:' + icsText(title), 'DESCRIPTION:' + icsText(desc));
      if (rrule) { L.push('RRULE:' + rrule); }
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', 'DESCRIPTION:' + icsText(title), 'END:VALARM', 'END:VEVENT');
    }
    if (!(list || []).length) { return ''; }
    first = sum.nextTest && sum.nextTest > today ? sum.nextTest : today;
    names = list.map(function (a) { return (a.location || 'Alarm') + ' (' + (ALARM_KIND[a.kind] || ALARM_KIND.smoke).en.toLowerCase() + ')'; }).join(', ');
    ev('stn-test-' + TN.backup.sha256(list.map(function (a) { return a.id; }).join()).slice(0, 12), first, 'Test smoke and CO alarms' + (place ? ': ' + place : ''),
      'Press the test button on each alarm: ' + names + '. Log the result in Stark Tenancy.', 'FREQ=MONTHLY');
    list.forEach(function (a) {
      var s = alarmStatus(a, today), nm = (a.location || 'Alarm') + ' ' + (ALARM_KIND[a.kind] || ALARM_KIND.smoke).en.toLowerCase();
      if (s.batteryDue) { ev('stn-batt-' + a.id, s.batteryDue > today ? s.batteryDue : today, 'Change battery: ' + nm, 'Change the battery, test the alarm, and log it in Stark Tenancy.', 'FREQ=YEARLY'); }
      if (s.replaceBy) { ev('stn-repl-' + a.id, s.replaceBy > today ? s.replaceBy : today, 'Replace alarm: ' + nm, 'This alarm reaches its replace-by date. Check the label and the maker’s instructions.', ''); }
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------- EXIF "date taken" from a JPEG (Uint8Array). Returns 'YYYY-MM-DD HH:MM' or ''. Never throws. ---------- */
  function exifDate(b) {
    var i = 2, n, mk, len;
    try {
      n = b.length;
      if (b[0] !== 0xFF || b[1] !== 0xD8) { return ''; }
      while (i + 9 < n) {
        if (b[i] !== 0xFF) { return ''; }
        mk = b[i + 1]; len = (b[i + 2] << 8) | b[i + 3];
        if (mk === 0xE1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66 && b[i + 8] === 0 && b[i + 9] === 0) { return tiffDate(b, i + 10, Math.min(n, i + 2 + len)); }
        if (mk === 0xDA || mk === 0xD9 || len < 2) { return ''; }
        i += 2 + len;
      }
    } catch (e) { /* malformed: no date */ }
    return '';
  }
  function tiffDate(b, t, end) {
    var le = b[t] === 0x49 && b[t + 1] === 0x49, s = '', e, ex, d, m;
    if (!le && !(b[t] === 0x4D && b[t + 1] === 0x4D)) { return ''; }
    function at(o, k) { o += t; if (o < t || o + k > end) { throw new Error('range'); } return o; }
    function u16(o) { o = at(o, 2); return le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]; }
    function u32(o) { o = at(o, 4); return (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3])) >>> 0; }
    function ascii(o, k) { var x = '', j; o = at(o, k); for (j = 0; j < k && b[o + j]; j++) { x += String.fromCharCode(b[o + j]); } return x; }
    function find(ifd, tag) { var c = u16(ifd), k; if (c > 400) { throw new Error('count'); } for (k = 0; k < c; k++) { if (u16(ifd + 2 + k * 12) === tag) { return ifd + 2 + k * 12; } } return -1; }
    function str(en) { var c = Math.min(u32(en + 4), 32); return ascii(c > 4 ? u32(en + 8) : en + 8, c); }
    e = find(u32(4), 0x8769);
    if (e >= 0) { ex = u32(e + 8); d = find(ex, 0x9003); if (d < 0) { d = find(ex, 0x9004); } if (d >= 0) { s = str(d); } }
    if (!s) { e = find(u32(4), 0x0132); if (e >= 0) { s = str(e); } }
    m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
    return m && m[1] !== '0000' ? m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] : '';
  }

  /* ---------- "answer a few questions, get your letters" (the Warden interview engine, for tenancies) ---------- */
  function recordsLine(reports) {
    var last = function (ph) { return (reports || []).filter(function (r) { return r.phase === ph && D.isIso(r.date); }).sort(function (a, b) { return a.date.localeCompare(b.date); }).pop(); },
      i = last('in'), o = last('out'), bits = [], pics;
    function one(r, what) { var s = r.sign || {}; return 'a ' + what + ' condition report on ' + D.pretty(r.date, 'en') + (s.tenant && s.landlord ? ', signed by both of us' : ''); }
    if (i) { bits.push(one(i, 'move-in')); }
    if (o) { bits.push(one(o, 'move-out')); }
    if (!bits.length) { return ''; }
    pics = [i, o].some(function (r) { return r && progress(r).photos > 0; });
    return 'We completed ' + bits.join(' and ') + '.' + (pics ? ' The reports include dated photos.' : '') + ' I can send copies.';
  }
  function interview(a, rec, today) {
    var tn, role, need, rp, problem, where, me, them, letters = {}, plan = [], replyBy, depositAmt;
    a = a || {}; rec = rec || {}; tn = rec.tenancy || {}; role = a.role === 'landlord' ? 'landlord' : 'tenant'; need = a.need || {};
    rp = a.repairId && a.repairId !== 'new' ? byId(rec.repairs, a.repairId) : null;
    problem = rp ? rp.title + (rp.detail ? ': ' + rp.detail : '') : (a.problem || '');
    where = rp ? (rp.room || '') : (a.where || '');
    me = { name: a.yourName || (role === 'tenant' ? tn.tenantName : tn.landlordName) || '', contact: a.yourContact || (role === 'tenant' ? tn.tenantContact : tn.landlordContact) || '',
      address: a.yourAddress || (role === 'tenant' ? tn.address : tn.landlordAddress) || '' };
    them = { name: a.otherName || (role === 'tenant' ? tn.landlordName : tn.tenantName) || '', address: a.otherAddress || (role === 'tenant' ? tn.landlordAddress : tn.address) || '' };
    replyBy = D.isIso(a.replyBy) ? a.replyBy : D.addDays(today, 14);
    depositAmt = rec.depositPaid > 0 ? String(rec.depositPaid) : (tn.deposit || '');
    if (role === 'tenant' && need.repair) {
      letters.repair = { yourName: me.name, yourContact: me.contact, propertyAddress: tn.address || me.address, landlordName: them.name, landlordAddress: them.address, problem: problem, where: where,
        noticedOn: '', earlier: rp ? historyLine(rp) : '', access: a.access || '', replyBy: replyBy };
      plan.push({ id: 'letter-repair', href: '#/letters/repair', title: T('Your repair request is filled in', 'Su solicitud de reparación está lista'), why: T('Check it, then send it in a way you can prove.', 'Revísela y envíela de una forma que pueda comprobar.') });
    }
    if (role === 'tenant' && need.deposit) {
      letters.deposit = { yourName: me.name, yourContact: me.contact, forwardingAddress: a.forwardingAddress || tn.forwarding || '', landlordName: them.name, landlordAddress: them.address,
        propertyAddress: tn.address || '', leaseStart: tn.leaseStart || tn.moveIn || '', moveOutDate: tn.moveOut || '', keysReturned: tn.keysReturned || '', depositAmount: depositAmt,
        records: recordsLine(rec.reports), replyBy: replyBy };
      plan.push({ id: 'letter-deposit', href: '#/letters/deposit', title: T('Your deposit return request is filled in', 'Su solicitud de devolución del depósito está lista'), why: T('It uses your move-out date, the deposit in your ledger and your condition reports.', 'Usa su fecha de salida, el depósito de su registro y sus reportes de condición.') });
      plan.push({ id: 'reports', href: '#/reports', title: T('Keep your move-in and move-out reports ready', 'Tenga listos sus reportes de entrada y salida'), why: T('Dated photos from both reports are your best record of the home’s condition.', 'Las fotos fechadas de ambos reportes son su mejor registro del estado de la vivienda.') });
    }
    if (need.fix) {
      letters.fix = { role: role, fromName: me.name, fromAddress: role === 'tenant' ? (tn.address || me.address) : me.address, toName: them.name, toAddress: them.address, propertyAddress: tn.address || '',
        problem: problem, firstRaised: rp ? rp.reportedOn || '' : '', howRaised: rp ? howPhrase(rp.how) : '', followUps: rp ? joinList(followUpDates(rp)) : '',
        fixBy: replyBy, hasPhotos: rp && (rp.photos || []).length ? 'yes' : '' };
      plan.push({ id: 'letter-fix', href: '#/letters/fix', title: T('Your notice to fix is filled in', 'Su aviso para arreglar está listo'), why: T('A firmer, dated notice. It is a request, not a formal legal notice.', 'Un aviso fechado y más firme. Es una solicitud, no un aviso legal formal.') });
    }
    if (role === 'landlord' && (need.repair || need.deposit)) {
      plan.push({ id: 'landlord', href: '#/ledger', title: T('Records that help a fair tenancy', 'Registros que ayudan a un arrendamiento justo'), why: T('The repair and deposit letters are written for tenants. As a landlord, you can give rent receipts from the ledger and a copy of the signed condition reports.', 'Las cartas de reparación y depósito son para inquilinos. Como propietario, puede dar recibos de renta desde el registro y una copia de los reportes firmados.') });
    }
    if (rp) { plan.push({ id: 'log', href: '#/repairs', title: T('Log the letter on the repair', 'Anote la carta en la reparación'), why: T('After you send it, press “Log as sent” on the letter page. It adds the date and sets a follow-up.', 'Después de enviarla, pulse “Anotar como enviada” en la página de la carta. Agrega la fecha y una fecha de seguimiento.') }); }
    plan.push({ id: 'check', href: '#/help', title: T('Check the rules where you live', 'Revise las reglas de su lugar'), why: T('Deadlines, notice rules and remedies differ by state and city. Official links and legal aid are on the Help page.', 'Los plazos, los avisos y los recursos cambian según el estado y la ciudad. Los enlaces oficiales y la asistencia legal están en Ayuda.') });
    return { role: role, letters: letters, plan: plan, repair: rp, replyBy: replyBy };
  }

  /* ---------- today: what needs attention ---------- */
  function overview(rec, today) {
    var out = [], rs = repairSummary(rec.repairs, today), al = alarmSummary(rec.alarms, today), lg, reps = rec.reports || [], tn = rec.tenancy || {};
    rs.due.forEach(function (r) { out.push({ kind: 'repair', level: followState(r, today) === 'overdue' ? 'high' : 'due', href: '#/repairs', text: T('Follow up on the repair: ', 'Dé seguimiento a la reparación: ') + r.title + ' (' + (followState(r, today) === 'overdue' ? T('overdue since ', 'atrasado desde ') : T('due ', 'para ')) + D.pretty(r.followUpOn) + ')' }); });
    if (al.testsDue) { out.push({ kind: 'alarm', level: 'due', href: '#/safety', text: T('Test your alarms: ', 'Pruebe sus alarmas: ') + al.testsDue + T(' due', ' pendientes') }); }
    if (al.failed) { out.push({ kind: 'alarm', level: 'high', href: '#/safety', text: T('An alarm failed its last test. Report it and replace the battery or the alarm.', 'Una alarma falló su última prueba. Repórtela y cambie la batería o la alarma.') }); }
    if (al.batteryDue) { out.push({ kind: 'alarm', level: 'due', href: '#/safety', text: T('Alarm batteries to change: ', 'Baterías de alarma por cambiar: ') + al.batteryDue }); }
    if (al.replaceDue) { out.push({ kind: 'alarm', level: 'due', href: '#/safety', text: T('Alarms near their replace-by date: ', 'Alarmas cerca de su fecha de reemplazo: ') + al.replaceDue }); }
    if (rec.ledgerCfg) {
      lg = ledgerSummary(rec.ledger, rec.ledgerCfg, today);
      if (lg.missing.length || lg.short.length) { out.push({ kind: 'rent', level: 'due', href: '#/ledger', text: T('Rent months with no payment or a short payment logged: ', 'Meses de renta sin pago o con pago incompleto anotado: ') + lg.missing.concat(lg.short).map(function (x) { return D.monthLabel(x.month); }).join(', ') }); }
    }
    if (!reps.some(function (r) { return r.phase === 'in'; })) { out.push({ kind: 'report', level: 'info', href: '#/reports', text: T('No move-in report yet. Walk through each room and take dated photos.', 'Aún no hay reporte de entrada. Recorra cada cuarto y tome fotos fechadas.') }); }
    if (D.isIso(tn.moveOut) && !reps.some(function (r) { return r.phase === 'out'; })) { out.push({ kind: 'report', level: 'due', href: '#/reports', text: T('You have a move-out date. Make the move-out report before you hand back the keys.', 'Tiene fecha de salida. Haga el reporte de salida antes de entregar las llaves.') }); }
    reps.forEach(function (r) { var s = r.sign || {}; if (progress(r).rated && !(s.tenant && s.landlord)) { out.push({ kind: 'sign', level: 'info', href: '#/reports/' + r.id + '/sign', text: (r.phase === 'in' ? T('Move-in', 'Entrada') : T('Move-out', 'Salida')) + T(' report is not signed by both parties yet.', ': el reporte aún no está firmado por ambas partes.') }); } });
    var R = { high: 0, due: 1, info: 2 };
    return out.sort(function (x, y) { return R[x.level] - R[y.level]; });
  }

  TN.uid = uid;
  TN.report = { cond: cond, newReport: newReport, fromReport: fromReport, addRoom: addRoom, makeRoom: makeRoom, progress: progress, /* comparison: full version only */ canonical: canonical, fingerprint: fingerprint, signStatus: signStatus,
    /* comparison: full version only */ signLines: signLines, RECORD_LINE: RECORD_LINE };
  TN.repairs = { PRIORITY: PRIORITY, STATUS: STATUS, HOW: HOW, suggestFollowUp: suggestFollowUp, isOpen: isOpen, followState: followState, daysOpen: daysOpen, addUpdate: addUpdate, historyLine: historyLine, followUpDates: followUpDates, summary: repairSummary };
  TN.ledger = { KINDS: KINDS, kind: kind, summary: ledgerSummary, csv: ledgerCsv, receiptNo: receiptNo, monthOf: monthOf };
  TN.alarms = { KIND: ALARM_KIND, POWER: POWER, TEST_DAYS: TEST_DAYS, status: alarmStatus, summary: alarmSummary, ics: alarmIcs };
  TN.exif = { dateTaken: exifDate };
  TN.interview = { build: interview, recordsLine: recordsLine };
  TN.overview = overview;
})(typeof window !== 'undefined' ? window : globalThis);
