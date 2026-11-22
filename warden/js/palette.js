/* Stark Warden: command palette engine. Fuzzy search over every screen, letter, guide, scam pattern and "if scammed" plan, plus
   plain-question answers about your own contact log ("how many calls this week", "who called most"). Pure functions, no DOM,
   no network. The answers come from fixed rules over data saved on this device; they are counts, not legal conclusions. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};

  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function words(s) { return norm(s).split(' ').filter(Boolean); }
  function subseq(q, t) {
    var i = 0, j;
    for (j = 0; j < t.length && i < q.length; j++) { if (t.charAt(j) === q.charAt(i)) { i++; } }
    return i === q.length;
  }

  /* One query token against one text: prefix of a word beats substring beats typo-tolerant word beats loose letters in order. */
  function tokenScore(tok, text, ws) {
    var best = 0, i, w, d;
    if (text.indexOf(tok) < 0 && tok.length < 3) { return 0; }
    for (i = 0; i < ws.length; i++) {
      w = ws[i];
      if (w === tok) { return 100; }
      if (w.indexOf(tok) === 0) { best = Math.max(best, 80 - Math.min(20, w.length - tok.length)); }
      else if (tok.length >= 4 && Math.abs(w.length - tok.length) <= 1) { d = SW.util.editDistance(tok, w); if (d <= 1) { best = Math.max(best, 55); } }
      else if (tok.length >= 5 && w.length >= tok.length) { d = SW.util.editDistance(tok, w.slice(0, tok.length)); if (d <= 1) { best = Math.max(best, 45); } }
    }
    if (best) { return best; }
    if (text.indexOf(tok) >= 0) { return 50; }
    if (tok.length >= 3 && subseq(tok, text.replace(/ /g, ''))) { return 20; }
    return 0;
  }

  function score(query, item) {
    var qs = words(query), tt = norm(item.title), kk = norm(item.kw || '') + ' ' + norm(item.sub || ''), tw = words(item.title), kw = words(kk), total = 0, i, a, b;
    if (!qs.length) { return 0; }
    for (i = 0; i < qs.length; i++) {
      a = tokenScore(qs[i], tt, tw) * 1.6;
      b = tokenScore(qs[i], kk, kw);
      if (!a && !b) { return 0; }
      total += Math.max(a, b);
    }
    if (tt.indexOf(norm(query)) === 0) { total += 40; }
    return Math.round(total / qs.length);
  }

  function search(items, query, limit) {
    return items.map(function (it) { return { it: it, s: score(query, it) }; }).filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s || a.it.title.length - b.it.title.length; }).slice(0, limit || 8).map(function (x) { return x.it; });
  }

  /* The index: fixed screens first, then everything in the data files. */
  function build(D) {
    var out = [], P = [
      ['Pressured right now', '#/now', 'screen', 'panic scared call phone ringing hang up breathe calm script'],
      ['Live call copilot', '#/call', 'screen', 'during a call timer tactics reply log record in the moment'],
      ['Your rights in 60 seconds', '#/rights60', 'screen', 'fdcpa regulation f collector rules'],
      ['Collector call practice', '#/practice', 'screen', 'roleplay rehearse train confidence'],
      ['"What happened?" interview', '#/fight', 'screen', 'letters plan dispute stop contact complaint'],
      ['Is this even real? (verify a collector)', '#/debt/verify', 'screen', 'validation notice fake check'],
      ['Contact log and evidence packet', '#/debt/log', 'screen', 'record calls texts violations evidence'],
      ['Evidence seal (tamper check)', '#/seal', 'screen', 'hash chain tamper proof unchanged verify log integrity certificate'],
      ['Trusted circle (split a secret)', '#/circle', 'screen', 'shamir shares recovery passphrase family emergency access'],
      ['Violation timeline', '#/debt/timeline', 'screen', 'chart calls per week seven in seven'],
      ['Call patterns and live call budget', '#/insights', 'screen', 'heat map heatmap when they call trend rising seven in seven countdown budget limit hours'],
      ['Time limit (statute of limitations)', '#/debt/limits', 'screen', 'old debt zombie re-age sol'],
      ['Deadlines and dates', '#/debt/dates', 'screen', 'validation window calendar ics reminder'],
      ['Negotiation coach', '#/debt/negotiate', 'screen', 'settlement offer pay in writing'],
      ['Medical debt shield', '#/debt/medical', 'screen', 'hospital bill charity care no surprises'],
      ['If you are sued', '#/debt/sued', 'screen', 'court summons answer lawsuit'],
      ['Scam message checker', '#/check', 'screen', 'text email link phone qr suspicious'],
      ['Family screen and fridge cards', '#/family', 'screen', 'trusted person code word elderly'],
      ['My wins', '#/wins', 'screen', 'progress path'],
      ['Getting back on your feet', '#/hope', 'screen', 'next steps legal aid counseling'],
      ['Budget and money tools', '#/life', 'screen', 'budget emergency fund subscriptions vault'],
      ['Settings, backup and erase', '#/settings', 'screen', 'restore export theme large text profiles encrypted backup autosave file'],
      ['About and sources', '#/about', 'screen', 'honest limits information date']
    ];
    D = D || {};
    P.forEach(function (p) { out.push({ title: p[0], href: p[1], kind: p[2], kw: p[3], sub: '' }); });
    (D.letters || []).forEach(function (l) { out.push({ title: l.title, href: '#/debt/letters/' + l.id, kind: 'letter', kw: (l.group || '') + ' letter template ' + (l.cite || ''), sub: '' }); });
    (D.guides || []).forEach(function (g) { out.push({ title: g.title, href: '#/learn/' + g.id, kind: 'guide', kw: g.summary || '', sub: '' }); });
    (D.patterns || []).forEach(function (p) { out.push({ title: p.title, href: '#/learn', kind: 'scam pattern', kw: p.hook || '', sub: '' }); });
    (D.scammed || []).forEach(function (s) { out.push({ title: s.title, href: '#/scammed/' + s.id, kind: 'if scammed', kw: 'paid sent money report recover', sub: '' }); });
    return out;
  }

  /* ---------- plain questions about your own log ---------- */
  function lp(e, tz) { return SW.violations.localParts(e.at, tz); }
  function nowParts(nowIso, tz) { return SW.violations.localParts(nowIso, tz) || SW.violations.localParts(String(nowIso).slice(0, 16).replace('T', ' '), tz); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  function ask(q, ctx) {
    var text = norm(q), log = (ctx && ctx.log) || [], prof = (ctx && ctx.profile) || {}, tz = prof.tz || 'America/New_York', now = nowParts((ctx && ctx.now) || new Date().toISOString(), tz),
      rows, from = null, label = 'in total', want, n, c, best, k, i, max, a, b, w, late, vio;
    if (!text) { return null; }
    rows = log.map(function (e) { return { e: e, p: lp(e, tz) }; }).filter(function (x) { return x.p && x.e.dir !== 'consumer'; });
    want = /\b(call|calls|phone|rang|ring)\b/.test(text) ? 'call' : null;
    if (want) { rows = rows.filter(function (x) { return x.e.channel === 'call' || x.e.channel === 'voicemail'; }); }

    if (/\b(deadline|dispute window|validation (?:window|period)|due)\b/.test(text)) {
      if (prof.validationEnd) { return { text: 'The validation period end date you saved is ' + prof.validationEnd + '. Follow the date printed on your notice.', href: '#/debt/dates' }; }
      if (prof.noticeDate || prof.firstContactDate) {
        w = SW.deadlines.validationWindow(prof.noticeDate || prof.firstContactDate);
        if (w) { return { text: 'Estimated dispute window ends ' + w.endsOn + ' (assumes the notice reached you five business days after it was sent). Check the date printed on your notice.', href: '#/debt/dates' }; }
      }
      return { text: 'Add the date of the notice in Debt help, Dates, and Warden will estimate your dispute window.', href: '#/debt/dates' };
    }
    if (/\b(over|more than|exceed\w*|broke|break|beyond)\b.*\b(7|seven)\b|\b(7|seven)\b.*\b(rule|limit|in 7|a week)\b|call limit/.test(text)) {
      rows = rows.filter(function (x) { return x.e.channel === 'call' || x.e.channel === 'voicemail'; });
      max = 0; a = 0;
      rows.sort(function (x, y) { return x.p.epoch - y.p.epoch; });
      for (b = 0; b < rows.length; b++) {
        while (rows[b].p.epoch - rows[a].p.epoch >= 7 * 1440) { a++; }
        max = Math.max(max, b - a + 1);
      }
      return { text: max > 7 ? 'The most calls from collectors in any 7 days in your log is ' + max + '. That is more than 7, a pattern that may be worth raising with the CFPB or an attorney. Warden cannot decide whether a rule was broken.' : 'The most calls from collectors in any 7 days in your log is ' + max + ', which is not over 7. Keep logging every contact.', href: '#/debt/timeline' };
    }
    if (/\b(late|early|after 9|before 8|inconvenient|night)\b/.test(text)) {
      late = rows.filter(function (x) { return x.p.minutes < 480 || x.p.minutes >= 1260; });
      return { text: plural(late.length, 'contact') + ' in your log came before 8 a.m. or after 9 p.m. in your time zone' + (late.length ? ' (' + late.slice(0, 3).map(function (x) { return x.p.day; }).join(', ') + (late.length > 3 ? ', ...' : '') + ').' : '.'), href: '#/debt/log' };
    }
    if (/\b(violation|violations|flag|flagged|broke the law)\b/.test(text)) {
      vio = SW.violations.evaluate(log.map(function (e) { return Object.assign({}, e, { dir: e.dir === 'consumer' ? 'consumer' : 'to' }); }), prof, (ctx && ctx.now) || new Date().toISOString());
      return { text: vio.length ? plural(vio.length, 'pattern') + ' flagged for you to raise with a regulator or attorney: ' + vio.slice(0, 3).map(function (v) { return v.title; }).join('; ') + (vio.length > 3 ? '; and more.' : '.') : 'No patterns are flagged yet. Log every contact and fill in Your situation for accurate flags.', href: '#/debt/log' };
    }
    if (/\b(who)\b.*\b(most|often|more)\b|\b(top|worst|busiest) (collector|caller)\b/.test(text)) {
      c = {}; rows.forEach(function (x) { k = (x.e.collector || x.e.phone || 'Unknown').trim() || 'Unknown'; c[k] = (c[k] || 0) + 1; });
      best = Object.keys(c).sort(function (x, y) { return c[y] - c[x]; })[0];
      return best ? { text: best + ' contacted you most: ' + plural(c[best], 'time') + ' in your log.', href: '#/debt/log' } : { text: 'Your log has no contacts from a collector yet.', href: '#/debt/log' };
    }
    if (/\b(last|latest|most recent|newest)\b.*\b(call|contact|text|letter|voicemail|one)\b/.test(text)) {
      rows.sort(function (x, y) { return y.p.epoch - x.p.epoch; });
      return rows.length ? { text: 'The latest contact in your log was ' + rows[0].p.day + ' at ' + SW.util.pad2(rows[0].p.h) + ':' + SW.util.pad2(rows[0].p.mi) + (rows[0].e.collector ? ' from ' + rows[0].e.collector : '') + '.', href: '#/debt/log' } : { text: 'Your log has no contacts from a collector yet.', href: '#/debt/log' };
    }
    if (/\b(how many|count|number of|total)\b/.test(text)) {
      if (/\btoday\b/.test(text) && now) { from = now.day; label = 'today'; rows = rows.filter(function (x) { return x.p.day === now.day; }); }
      else if (/\bthis week|last 7|past 7|past week|last week\b/.test(text) && now) { label = 'in the last 7 days'; rows = rows.filter(function (x) { return now.epoch - x.p.epoch >= 0 && now.epoch - x.p.epoch < 7 * 1440; }); }
      else if (/\bthis month\b/.test(text) && now) { label = 'this month'; rows = rows.filter(function (x) { return x.p.day.slice(0, 7) === now.day.slice(0, 7); }); }
      n = rows.length;
      return { text: (want ? n + (n === 1 ? ' call or voicemail' : ' calls or voicemails') : plural(n, 'contact')) + ' from collectors ' + label + ' in your log.', href: '#/debt/timeline' };
    }
    return null;
  }

  SW.palette = { search: search, score: score, build: build, ask: ask, norm: norm };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.palette; }
})(typeof window !== 'undefined' ? window : globalThis);
