/* Stark Tenancy: the example tenancy (made-up names, places, amounts and drawn photos), kept in its own "example" profile and
   marked on every screen. Used to explore the app and for the store screenshots. */
(function (root) {
  'use strict';
  var TN = root.TN, S = TN.store, D = TN.dates, R = TN.report, P = 'example';

  function cv(w, ht) { var c = root.document.createElement('canvas'); c.width = w; c.height = ht; return c; }
  function scene(kind) {
    var c = cv(1200, 900), g = c.getContext('2d'), i, j, gr;
    function rect(x, y, w, ht, col) { g.fillStyle = col; g.fillRect(x, y, w, ht); }
    function line(pts, col, w) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0], pts[1]); for (i = 2; i < pts.length; i += 2) { g.lineTo(pts[i], pts[i + 1]); } g.stroke(); }
    if (kind === 'wall' || kind === 'floor') {
      gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, '#ece5d6'); gr.addColorStop(1, '#d8cdb6'); g.fillStyle = gr; g.fillRect(0, 0, 1200, 900);
      if (kind === 'floor') { for (i = 0; i < 9; i++) { rect(0, 300 + i * 70, 1200, 66, i % 2 ? '#a7835a' : '#b08b60'); for (j = 0; j < 4; j++) { rect((j * 330 + i * 140) % 1200, 300 + i * 70, 4, 66, '#7d5f3e'); } } rect(0, 280, 1200, 24, '#f4efe4'); }
      else {
        rect(0, 760, 1200, 140, '#b5a78d'); rect(0, 740, 1200, 26, '#f4efe4'); rect(80, 120, 230, 640, '#8a6a49'); rect(98, 140, 194, 620, '#9c7b57'); g.fillStyle = '#d9c38f'; g.beginPath(); g.arc(270, 470, 12, 0, 7); g.fill();
        line([430, 560, 520, 548, 560, 556], '#6f6a62', 9); line([450, 610, 540, 602], '#7d776d', 6); g.fillStyle = '#4c4842'; g.beginPath(); g.arc(760, 300, 7, 0, 7); g.fill();
        rect(820, 380, 70, 110, '#f8f5ee'); rect(842, 410, 26, 46, '#e3ddd0');
      }
    } else if (kind === 'sink') {
      rect(0, 0, 1200, 900, '#e6e9e8'); for (i = 0; i < 6; i++) { rect(0, i * 70, 1200, 66, '#f3f5f4'); }
      rect(0, 430, 1200, 470, '#7e8a8f'); rect(0, 430, 1200, 40, '#949fa3');
      g.fillStyle = '#c9d0d3'; g.beginPath(); g.ellipse(640, 600, 260, 120, 0, 0, 7); g.fill(); g.fillStyle = '#aeb7ba'; g.beginPath(); g.ellipse(640, 610, 220, 92, 0, 0, 7); g.fill();
      line([640, 470, 640, 330, 760, 330, 760, 400], '#d5dadc', 34); g.fillStyle = '#4f9fd1'; g.beginPath(); g.ellipse(760, 440, 9, 15, 0, 0, 7); g.fill();
      g.fillStyle = '#3b2f28'; g.beginPath(); g.ellipse(250, 520, 38, 18, 0.3, 0, 7); g.fill();
    } else if (kind === 'tile') {
      rect(0, 0, 1200, 900, '#c9d1d0'); for (i = 0; i < 8; i++) { for (j = 0; j < 7; j++) { rect(i * 150 + 4, j * 130 + 4, 142, 122, '#eef2f1'); } }
      line([604, 264, 640, 300, 625, 330, 668, 372, 700, 386], '#5a5f60', 4); rect(0, 780, 1200, 120, '#f8fafa');
    } else if (kind === 'window') {
      rect(0, 0, 1200, 900, '#e4ded2'); rect(260, 120, 680, 620, '#f6f3ec'); gr = g.createLinearGradient(0, 140, 0, 720); gr.addColorStop(0, '#9fc7e4'); gr.addColorStop(1, '#dcebf3'); g.fillStyle = gr; g.fillRect(290, 150, 620, 560);
      rect(590, 150, 20, 560, '#f6f3ec'); rect(290, 420, 620, 18, '#f6f3ec'); rect(560, 400, 80, 58, '#b9b2a4'); line([600, 430, 650, 470], '#8b8477', 10);
    } else {
      rect(0, 0, 1200, 900, '#d9d4c9'); g.save(); g.translate(600, 450); g.rotate(-0.04); rect(-330, -380, 660, 760, '#fdfcf8');
      g.fillStyle = '#2a2f2e'; g.font = '700 44px Georgia, serif'; g.fillText('RENT RECEIPT', -280, -290); g.font = '28px Georgia, serif';
      ['Received from: Sam Rivera', 'Property: 14 Birch Lane, Unit 2', 'Amount: $1,450.00', 'For: rent', 'Paid by bank transfer'].forEach(function (t, k) { g.fillText(t, -280, -200 + k * 64); });
      line([-280, 220, 40, 210, 120, 226], '#2a3b6a', 4); g.font = '22px Georgia, serif'; g.fillText('Signature', -280, 262); g.restore();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.86)'; g.fillRect(28, 28, 380, 66); g.fillStyle = '#b4452a'; g.font = '800 40px system-ui, Segoe UI, Arial, sans-serif'; g.fillText('EXAMPLE PHOTO', 46, 76);
    return c;
  }
  function sig(seed) {
    var c = cv(600, 180), g = c.getContext('2d'), x = 40, k;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 600, 180); g.strokeStyle = '#c4d0cd'; g.lineWidth = 1; g.beginPath(); g.moveTo(24, 142); g.lineTo(576, 142); g.stroke();
    g.strokeStyle = '#10201e'; g.lineWidth = 2.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, 110);
    for (k = 0; k < 7; k++) { g.bezierCurveTo(x + 18, 30 + (seed * 13 + k * 29) % 50, x + 40, 150 - (seed * 7 + k * 17) % 40, x + 62, 100); x += 62; }
    g.stroke();
    return c.toDataURL('image/png');
  }
  function photo(kind, added, label) { var rec = TN.photos.render(scene(kind), { added: added, label: label }); rec.profile = P; return TN.photos.put(rec); }

  function load() {
    var st = S.settings(), today = D.today(), m0 = D.addMonths(today.slice(0, 7) + '-01', -9), ph = {}, jobs;
    if (st.profiles.indexOf(P) < 0) { st.profiles.push(P); }
    st.names[P] = 'Example: 14 Birch Lane, Unit 2'; st.profile = P; S.setSettings(st);
    jobs = [['wall', 'wall', m0], ['floor', 'floor', m0], ['sink', 'sink', m0], ['tile', 'tile', m0], ['window', 'window', m0], ['latch', 'window', D.addDays(today, -12)], ['drip', 'sink', D.addDays(m0, 40)], ['rcpt1', 'receipt', m0], ['rcpt2', 'receipt', today.slice(0, 7) + '-01'], ['owall', 'wall', today], ['ofloor', 'floor', today], ['osink', 'sink', today]];
    return S.removeProfile(P).then(function () {
      return jobs.reduce(function (p, j) { return p.then(function () { return photo(j[1], j[2] + ' 10:1' + (jobs.indexOf(j) % 10), j[0] === 'latch' || j[0] === 'drip' ? 'Repair: example' : (j[1] === 'receipt' ? 'Receipt: rent' : (j[0].charAt(0) === 'o' ? 'Move-out report: example' : 'Move-in report: example'))).then(function (r) { ph[j[0]] = r; }); }); }, Promise.resolve());
    }).then(function () {
      var tn = { role: 'tenant', address: '14 Birch Lane, Unit 2\nAnytown, USA 00000', tenantName: 'Sam Rivera', tenantContact: 'sam.rivera@example.com', landlordName: 'Jordan Lee', landlordContact: 'jordan.lee@example.com',
          landlordAddress: 'Lee Rentals, 200 Example Avenue, Suite 5\nAnytown, USA 00000', leaseStart: m0, leaseEnd: D.addDays(D.addMonths(m0, 12), -1), moveIn: m0, rent: '1450', dueDay: '1', deposit: '1450' },
        rep = R.newReport('in', 'one', m0, 'en'), out, outSet, hashes = {}, set, repairs, ledger = [], m, n = 0, win, hs, ho;
      set = function (room, item, cond, note, pid) {
        var rm = rep.rooms.filter(function (r) { return r.name === room; })[0], it = rm.items.filter(function (x) { return x.key === item; })[0];
        it.cond = cond; it.note = note || '';
        if (pid && rm.photos.indexOf(ph[pid].id) < 0) { rm.photos.push(ph[pid].id); }
      };
      rep.rooms.forEach(function (rm) { rm.items.forEach(function (it) { it.cond = it.key === 'extinguisher' ? 'na' : 'good'; }); });
      set('Living room', 'walls', 'fair', 'Two scuff marks by the front door, about 10 cm. Small nail hole above the light switch.', 'wall');
      set('Living room', 'floor', 'good', 'Wood floor, no scratches seen.', 'floor');
      set('Kitchen', 'counters', 'fair', 'Small burn mark left of the sink.', 'sink');
      set('Kitchen', 'sink', 'good', 'Faucet works, no drips.');
      set('Bathroom', 'tiles', 'poor', 'One cracked tile beside the tub.', 'tile');
      set('Bedroom', 'windows', 'good', 'Latch works. Screen in place.', 'window');
      set('Bedroom', 'blinds', 'fair', 'One slat bent.');
      set('Safety items and keys', 'smoke', 'good', 'Tested at the walk-through: both sounded.');
      rep.extras = { keys: '2 front door keys, 1 mailbox key, 1 building fob', meters: 'Electric meter 04512 kWh', other: 'Landlord to replace the cracked bathroom tile (agreed at the walk-through).' };
      Object.keys(ph).forEach(function (k) { hashes[ph[k].id] = ph[k].hash; });
      hs = R.fingerprint(rep, hashes);
      rep.sign = { tenant: { name: 'Sam Rivera', at: m0 + ' 10:40', sig: sig(1), comment: '', hash: hs }, landlord: { name: 'Jordan Lee', at: m0 + ' 10:42', sig: sig(4), comment: 'Will replace the cracked tile this month.', hash: hs } };
      /* the move-out report (a walk-through before leaving, dated today): the same rooms and items, a few changed, one item only here, three drawn photos */
      out = R.fromReport(rep, today);
      outSet = function (room, item, cond, note, pid) {
        var rm = out.rooms.filter(function (r) { return r.name === room; })[0], it = rm.items.filter(function (x) { return x.key === item; })[0];
        it.cond = cond; it.note = note || '';
        if (pid && rm.photos.indexOf(ph[pid].id) < 0) { rm.photos.push(ph[pid].id); }
      };
      out.rooms.forEach(function (rm) { rm.items.forEach(function (it) { it.cond = it.key === 'extinguisher' ? 'na' : 'good'; }); });
      outSet('Living room', 'walls', 'fair', 'The same two scuffs by the front door and the nail hole. No new marks.', 'owall');
      outSet('Living room', 'floor', 'fair', 'Light scratches in front of the sofa, about 30 cm long.', 'ofloor');
      outSet('Kitchen', 'counters', 'fair', 'Burn mark left of the sink, unchanged.');
      outSet('Kitchen', 'sink', 'good', 'Faucet works, no drips since the repair.', 'osink');
      outSet('Bathroom', 'tiles', 'good', 'Cracked tile was replaced by the landlord.');
      outSet('Bedroom', 'windows', 'poor', 'Latch spins freely and does not lock (see the repair log).');
      outSet('Bedroom', 'blinds', 'poor', 'Two slats bent now, one more than at move-in.');
      outSet('Safety items and keys', 'smoke', 'good', 'Tested during the walk-through: both sounded.');
      out.rooms.filter(function (r) { return r.name === 'Bedroom'; })[0].items.push({ id: TN.uid(), key: 'custom', name: 'Ceiling fan (added by the landlord)', cond: 'good', note: 'Installed in the spring, works on all speeds.' });
      out.extras = { keys: '2 front door keys, 1 mailbox key, 1 building fob', meters: 'Electric meter 12980 kWh', other: 'Walk-through before moving out. Bedroom window latch still waiting for repair.' };
      ho = {}; ['owall', 'ofloor', 'osink'].forEach(function (k) { ho[ph[k].id] = ph[k].hash; });
      hs = R.fingerprint(out, ho);
      out.sign = { tenant: { name: 'Sam Rivera', at: today + ' 16:20', sig: sig(2), comment: '', hash: hs }, landlord: { name: 'Jordan Lee', at: today + ' 16:25', sig: sig(5), comment: 'Will re-check the window latch before the final day.', hash: hs } };
      win = { id: TN.uid(), title: 'Bedroom window latch broken: window will not lock', room: 'Bedroom', priority: 'soon', detail: 'The latch spins freely, so the window can be opened from outside.', reportedOn: D.addDays(today, -12), how: 'email', reportedTo: 'Jordan Lee',
        status: 'open', followUpOn: D.addDays(today, -2), photos: [ph.latch.id], updates: [{ date: D.addDays(today, -5), kind: 'followup', note: 'Emailed again with the photo.' }] };
      repairs = [
        { id: TN.uid(), title: 'Kitchen faucet drips', room: 'Kitchen', priority: 'soon', detail: 'Drips about once a second, even when fully closed.', reportedOn: D.addDays(m0, 40), how: 'text', reportedTo: 'Jordan Lee', status: 'fixed', fixedOn: D.addDays(m0, 49), followUpOn: '', photos: [ph.drip.id],
          updates: [{ date: D.addDays(m0, 47), kind: 'followup', note: 'Texted again.' }, { date: D.addDays(m0, 48), kind: 'reply', note: 'Jordan replied: plumber booked for Friday.' }, { date: D.addDays(m0, 49), kind: 'visit', note: 'Plumber replaced the cartridge. Fixed.' }] },
        win,
        { id: TN.uid(), title: 'Bathroom fan is loud and weak', room: 'Bathroom', priority: 'routine', detail: 'Rattles and barely clears the mirror after a shower.', reportedOn: D.addDays(today, -4), how: 'portal', reportedTo: 'Lee Rentals portal', status: 'scheduled', followUpOn: D.addDays(today, 10), photos: [],
          updates: [{ date: D.addDays(today, -3), kind: 'reply', note: 'Visit booked for next week.' }] }];
      ledger.push({ id: TN.uid(), date: D.addDays(m0, -7), kind: 'deposit', period: '', amount: '1450.00', method: 'Bank transfer', ref: 'TX-55102', note: 'Security deposit', receipt: '' });
      for (m = m0; m <= today && n < 24; m = D.addMonths(m, 1)) {
        n++;
        ledger.push({ id: TN.uid(), date: D.addDays(m, n % 3 === 0 ? -1 : 0), kind: 'rent', period: m.slice(0, 7), amount: '1450.00', method: 'Bank transfer', ref: 'TX-' + (55200 + n), note: '', receipt: n === 1 ? ph.rcpt1.id : (m.slice(0, 7) === today.slice(0, 7) ? ph.rcpt2.id : '') });
      }
      S.set('tenancy', tn); S.set('reports', [rep, out]); S.set('repairs', repairs); S.set('ledger', ledger);
      S.set('alarms', [
        { id: TN.uid(), location: 'Hallway ceiling', kind: 'smoke', power: 'battery', made: '2019-05', replaceBy: '', lastTested: D.addDays(today, -35), batteryOn: m0, tests: [{ date: m0, ok: true }, { date: D.addDays(today, -35), ok: true }] },
        { id: TN.uid(), location: 'Bedroom', kind: 'smoke', power: 'sealed', made: '2023-03', replaceBy: '', lastTested: D.addDays(today, -9), batteryOn: '', tests: [{ date: m0, ok: true }, { date: D.addDays(today, -9), ok: true }] },
        { id: TN.uid(), location: 'Hallway, by the bedroom', kind: 'co', power: 'battery', made: '2024-06', replaceBy: '2031-06-01', lastTested: D.addDays(today, -9), batteryOn: m0, tests: [{ date: m0, ok: true }, { date: D.addDays(today, -9), ok: true }] }]);
      var a = { role: 'tenant', need: { repair: true, fix: true }, repairId: win.id, replyBy: D.addDays(today, 7), access: 'Weekdays after 3 p.m. Please text first.' },
        b = TN.interview.build(a, { tenancy: tn, reports: [rep], repairs: repairs, ledger: ledger, alarms: [], depositPaid: 1450 }, today);
      b.letters.repair.repairId = win.id; b.letters.fix.repairId = win.id;
      S.set('interview', a); S.set('letters', b.letters);
    });
  }
  function remove() {
    var st = S.settings();
    st.profiles = st.profiles.filter(function (p) { return p !== P; });
    delete st.names[P];
    if (st.profiles.indexOf('main') < 0) { st.profiles.unshift('main'); st.names.main = st.names.main || 'My tenancy'; }
    if (st.profile === P) { st.profile = 'main'; }
    S.setSettings(st);
    return S.removeProfile(P);
  }
  TN.demo = { load: load, remove: remove };
})(typeof window !== 'undefined' ? window : globalThis);
