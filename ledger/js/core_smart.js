/* Stark Ledger. On-device smart analysis added in 1.2, all pure JavaScript with no network and no model download:
   Ask your books (plain-English questions), Books Doctor (duplicates, outliers, numbering gaps, missing regular payments),
   bank reconciliation (fuzzy matching of a statement against the books), cash what-if scenarios and learned categorisation.
   Pure functions on the books object; runs in the browser and in Node for the tests. */
(function (root) {
  'use strict';
  const C = root.StarkCore || require('./core.js'); if (!C.forecast) require('./core_biz.js');
  const acct = C.account, sum = (l, f) => l.reduce((s, x) => s + f(x), 0), fmt = c => C.fmt(c);
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], MONF = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pad = n => String(n).padStart(2, '0'), monthEnd = (y, m) => C.addDays(C.addMonths(y + '-' + pad(m) + '-01', 1), -1);
  const STOP = new Set(('a an and the of on for from to in at by with my me i we our us is are was were do does did have has had how much many what which who whom whose that this these those total totals ' +
    'show tell give list get any all about than then it its be been am or if so as per each over under during between into out up down there their they them you your can could would should will ' +
    'spend spent spending expense expenses cost costs paid pay paying pays income revenue sales sale earn earned earning made make money profit net owe owes owed unpaid outstanding receivable receivables payable payables ' +
    'top biggest largest highest most best worst cash bank balance overdue late open bills bill invoice invoices client clients customer customers vendor vendors supplier suppliers category categories ' +
    'year month quarter week day days weeks months years last next current now today ago ytd date time period').split(' '));
  const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9À-ɏ ]+/g, ' ').split(/\s+/).filter(Boolean);
  const stem = w => w.length > 4 && /s$/.test(w) ? w.slice(0, -1) : w;
  const near = (a, b) => { // equal, a prefix, or one typo apart (words of 5+ letters)
    a = stem(a); b = stem(b); if (a === b) return true; if (a.length >= 4 && (b.indexOf(a) === 0 || a.indexOf(b) === 0)) return true;
    if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
  };

  /* ---------- periods in plain words ---------- */
  C.parsePeriod = function (q, today) {
    q = ' ' + String(q || '').toLowerCase() + ' '; const y = +today.slice(0, 4), m = +today.slice(5, 7); let r;
    const out = (from, to, label, pat) => ({ from, to, label, rest: q.replace(pat, ' ') });
    if ((r = q.match(/\blast (\d{1,3}) (day|week|month)s?\b/))) { const n = +r[1], k = r[2] === 'day' ? n : r[2] === 'week' ? n * 7 : n * 30; return out(C.addDays(today, -k + 1), today, 'the last ' + n + ' ' + r[2] + (n === 1 ? '' : 's'), r[0]); }
    if ((r = q.match(/\b(this|current) month\b/))) return out(y + '-' + pad(m) + '-01', today, 'this month', r[0]);
    if ((r = q.match(/\blast month\b/))) { const p = m === 1 ? [y - 1, 12] : [y, m - 1]; return out(p[0] + '-' + pad(p[1]) + '-01', monthEnd(p[0], p[1]), 'last month', r[0]); }
    if ((r = q.match(/\b(this|current) quarter\b/))) { const qs = Math.floor((m - 1) / 3) * 3 + 1; return out(y + '-' + pad(qs) + '-01', today, 'this quarter', r[0]); }
    if ((r = q.match(/\blast quarter\b/))) { let qs = Math.floor((m - 1) / 3) * 3 + 1 - 3, yy = y; if (qs < 1) { qs += 12; yy--; } return out(yy + '-' + pad(qs) + '-01', monthEnd(yy, qs + 2), 'last quarter', r[0]); }
    if ((r = q.match(/\bq([1-4])(?: (20\d\d))?\b/))) { const yy = r[2] ? +r[2] : y, qs = (+r[1] - 1) * 3 + 1; return out(yy + '-' + pad(qs) + '-01', monthEnd(yy, qs + 2), 'Q' + r[1] + ' ' + yy, r[0]); }
    if ((r = q.match(/\blast year\b/))) return out((y - 1) + '-01-01', (y - 1) + '-12-31', String(y - 1), r[0]);
    if ((r = q.match(/\b(this year|year to date|ytd)\b/))) return out(y + '-01-01', today, 'this year so far', r[0]);
    if ((r = q.match(/\b(all time|ever|since the start|overall)\b/))) return out('1900-01-01', today, 'all time', r[0]);
    if ((r = q.match(/\btoday\b/))) return out(today, today, 'today', r[0]);
    if ((r = q.match(/\b(?:in |during |for )?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?: (20\d\d))?\b/))) {
      const mi = MON.indexOf(r[1].slice(0, 3)) + 1, yy = r[2] ? +r[2] : (mi > m ? y - 1 : y); return out(yy + '-' + pad(mi) + '-01', monthEnd(yy, mi), MONF[mi - 1] + ' ' + yy, r[0]);
    }
    if ((r = q.match(/\b(?:in |during |for )?(20\d\d)\b/))) { const yy = +r[1]; return out(yy + '-01-01', yy + '-12-31', String(yy), r[0]); }
    return out(y + '-01-01', today, 'this year so far', /$^/);
  };

  /* ---------- Ask your books ---------- */
  const monthRows = (map, from, to) => { const rows = []; let d = from.slice(0, 7) + '-01'; for (let g = 0; g < 120 && d <= to; g++) { const k = d.slice(0, 7); rows.push([MONF[+k.slice(5)-1].slice(0, 3) + ' ' + k.slice(0, 4), map[k] || 0]); d = C.addMonths(d, 1); } return rows; };
  const topRows = (map, n) => Object.keys(map).map(k => [k, map[k]]).filter(r => r[1] !== 0).sort((a, b) => b[1] - a[1]).slice(0, n || 8);
  C.ask = function (st, q, today) {
    const raw = String(q || '').trim(); if (!raw) return null;
    const P = C.parsePeriod(raw, today), t = ' ' + P.rest + ' ', has = re => re.test(t), kws = words(P.rest).filter(w => !STOP.has(w) && !/^\d+$/.test(w));
    const per = (/^all /.test(P.label) ? ' over ' : /^(this|last|today)/.test(P.label) ? ' ' : ' in ') + P.label, inP = d => d >= P.from && d <= P.to, base = { period: P, query: raw };
    const nameHit = list => list.filter(x => words(x.name).some(w => kws.some(k => near(k, w))));
    const clients = nameHit(st.clients), vendors = nameHit(st.vendors);
    const tot = i => C.totalH(i);
    // who owes me / what I owe
    if (has(/\b(owe me|owes me|owed to me|unpaid|outstanding|receivable|receivables|who owes)\b/) || (has(/\b(overdue|late)\b/) && !has(/\bbills?\b/))) {
      const m = {}; st.invoices.forEach(i => { const b = C.balanceH(st, i); if (b > 0 && (!clients.length || clients.some(c => c.id === i.clientId)) && (!has(/\b(overdue|late)\b/) || C.dueDate(i) < today)) { const n = (st.clients.find(c => c.id === i.clientId) || { name: '?' }).name; m[n] = (m[n] || 0) + b; } });
      const rows = topRows(m, 10), v = sum(rows, r => r[1]); return Object.assign(base, { intent: 'receivable', value: v, rows, hash: '#/receivables', title: v ? (has(/\b(overdue|late)\b/) ? 'Overdue invoices total ' : 'Clients owe you ') + fmt(v) + ' across ' + rows.length + ' client' + (rows.length === 1 ? '' : 's') + '.' : 'Nothing is owed to you right now.' });
    }
    if (has(/\b(i owe|we owe|payables?|bills? due|owe vendors?|owe suppliers?)\b/) || (has(/\bbills?\b/) && has(/\b(overdue|unpaid|open|outstanding)\b/))) {
      const m = {}; st.bills.forEach(b => { const bal = C.billBalanceH(st, b); if (bal > 0 && (!vendors.length || vendors.some(v => v.id === b.vendorId))) { const n = (st.vendors.find(v => v.id === b.vendorId) || { name: '?' }).name; m[n] = (m[n] || 0) + bal; } });
      const rows = topRows(m, 10), v = sum(rows, r => r[1]); return Object.assign(base, { intent: 'payable', value: v, rows, hash: '#/bills', title: v ? 'You owe vendors ' + fmt(v) + ' across ' + rows.length + ' vendor' + (rows.length === 1 ? '' : 's') + '.' : 'You have no open bills.' });
    }
    if (has(/\b(cash|bank|in the bank|on hand)\b/) && !has(/\b(spent|spend|income|earned)\b/)) {
      const ids = st.accounts.filter(a => a.cash).map(a => a.id), tb = C.trialBalance(st, today), v = sum(ids, id => tb.balances[id] || 0);
      return Object.assign(base, { intent: 'cash', value: v, rows: [], hash: '#/forecast', title: 'Cash on hand today is ' + fmt(v) + '.' });
    }
    const isTop = has(/\b(top|biggest|largest|highest|most|best)\b/);
    if (isTop && has(/\b(client|clients|customer|customers)\b/)) {
      const m = {}; st.invoices.forEach(i => { if (i.status !== 'issued' || !inP(i.date)) return; const n = (st.clients.find(c => c.id === i.clientId) || { name: '?' }).name; m[n] = (m[n] || 0) + tot(i); });
      const rows = topRows(m, 8); return Object.assign(base, { intent: 'topclients', value: sum(rows, r => r[1]), rows, hash: '#/clients', title: rows.length ? rows[0][0] + ' is your biggest client' + per + ' with ' + fmt(rows[0][1]) + ' invoiced.' : 'No invoices' + per + '.' });
    }
    if (isTop && has(/\b(vendor|vendors|supplier|suppliers)\b/)) {
      const m = {}; st.bills.forEach(b => { if (b.status === 'draft' || b.status === 'void' || !inP(b.date)) return; const n = (st.vendors.find(v => v.id === b.vendorId) || { name: '?' }).name; m[n] = (m[n] || 0) + C.totalH(b); });
      const rows = topRows(m, 8); return Object.assign(base, { intent: 'topvendors', value: sum(rows, r => r[1]), rows, hash: '#/vendors', title: rows.length ? 'Your biggest vendor' + per + ' is ' + rows[0][0] + ' at ' + fmt(rows[0][1]) + '.' : 'No bills' + per + '.' });
    }
    // money by period: spend, income, profit
    const wantProfit = has(/\b(profit|net|margin|left over|made overall)\b/), wantIn = has(/\b(income|revenue|sales|sale|earn|earned|earning|made|brought in|money in|bill|billed|invoiced)\b/), wantOut = has(/\b(spend|spent|spending|expense|expenses|cost|costs|paid|pay|bought|buy)\b/) || isTop;
    if (!(wantProfit || wantIn || wantOut)) return null;
    if (wantProfit && !kws.length) { const p = C.profitLoss(st, P.from, P.to); return Object.assign(base, { intent: 'profit', value: p.net, rows: [['Income', p.totalIncome], ['Expenses', -p.totalExpenses]], hash: '#/reports', title: 'Net profit' + per + ' is ' + fmt(p.net) + ' (income ' + fmt(p.totalIncome) + ', expenses ' + fmt(p.totalExpenses) + ').' }); }
    if (clients.length && wantIn) { // invoiced and paid per client
      const ids = new Set(clients.map(c => c.id)), inv = st.invoices.filter(i => i.status === 'issued' && ids.has(i.clientId) && inP(i.date)), v = sum(inv, tot);
      const paid = sum(st.payments.filter(p => inP(p.date) && st.invoices.some(i => i.id === p.invId && ids.has(i.clientId))), p => p.amount);
      return Object.assign(base, { intent: 'client', value: v, rows: inv.slice(-8).reverse().map(i => [i.number + ' ' + i.date, tot(i)]), hash: '#/statement/' + clients[0].id, title: clients.map(c => c.name).join(', ') + ' was invoiced ' + fmt(v) + per + ' and paid ' + fmt(paid) + '.' });
    }
    if (vendors.length && wantOut) {
      const ids = new Set(vendors.map(v => v.id)), bl = st.bills.filter(b => b.status !== 'draft' && b.status !== 'void' && ids.has(b.vendorId) && inP(b.date)), v = sum(bl, b => C.totalH(b));
      return Object.assign(base, { intent: 'vendor', value: v, rows: bl.slice(-8).reverse().map(b => [b.number + ' ' + b.date, C.totalH(b)]), hash: '#/vendors', title: 'You were billed ' + fmt(v) + ' by ' + vendors.map(x => x.name).join(', ') + per + '.' });
    }
    const type = wantOut && !wantIn ? 'expense' : 'income', want = kws, byAcct = {}, byMonth = {}; let total = 0, count = 0;
    st.entries.forEach(e => {
      if (!inP(e.date)) return; const mw = words(e.memo);
      e.lines.forEach(l => {
        const a = acct(st, l.a); if (!a || a.type !== type) return;
        if (want.length && !want.every(k => words(a.name).some(w => near(k, w)) || mw.some(w => near(k, w)))) return;
        const v = type === 'expense' ? l.dr - l.cr : l.cr - l.dr; total += v; count++; byAcct[a.name] = (byAcct[a.name] || 0) + v; const mk = e.date.slice(0, 7); byMonth[mk] = (byMonth[mk] || 0) + v;
      });
    });
    const multi = P.from.slice(0, 7) !== P.to.slice(0, 7) && P.from > '1900-01-01';
    const rows = isTop || Object.keys(byAcct).length > 1 ? topRows(byAcct, 8) : (multi ? monthRows(byMonth, P.from, P.to) : []);
    const msg = type === 'expense' ? 'You spent ' + fmt(total) + (want.length ? ' on ' + want.join(' ') : '') + per : 'You earned ' + fmt(total) + (want.length ? ' from ' + want.join(' ') : '') + per;
    return Object.assign(base, { intent: type, value: total, rows, months: multi ? monthRows(byMonth, P.from, P.to) : [], hash: '#/transactions', title: msg + (count ? ' (' + count + ' entr' + (count === 1 ? 'y' : 'ies') + ').' : '. Nothing matched.') });
  };

  /* ---------- Books Doctor ---------- */
  const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
  const normMemo = m => words(m).filter(w => !/^\d+$/.test(w)).join(' ');
  C.doctor = function (st, today) {
    const f = [], add = (sev, id, title, detail, hash, extra) => f.push(Object.assign({ sev, id, title, detail, hash: hash || '' }, extra || {}));
    const tb = C.trialBalance(st); if (!tb.balanced) add('high', 'unbalanced', 'The books do not balance', 'Debits and credits differ by ' + fmt(Math.abs(tb.debits - tb.credits)) + '. Restore a backup or check recent entries.', '#/reports');
    const cashIds = st.accounts.filter(a => a.cash).map(a => a.id), cash = sum(cashIds, id => tb.balances[id] || 0);
    if (cash < 0) add('high', 'negcash', 'Cash is below zero', 'The books show ' + fmt(cash) + ' in cash, which usually means a missing deposit or a mis-dated entry.', '#/forecast');
    // duplicates: same day (or within 2 days), same total and same memo
    const byKey = {}; st.entries.forEach(e => { if (e.kind === 'recurring' || e.kind === 'reversal') return; const v = sum(e.lines, l => l.dr), k = v + '|' + normMemo(e.memo) + '|' + e.lines.map(l => l.a + (l.dr ? 'd' : 'c')).join(','); (byKey[k] = byKey[k] || []).push(e); });
    Object.keys(byKey).forEach(k => { const g = byKey[k].sort((a, b) => a.date < b.date ? -1 : 1); if (g.length < 2 || !normMemo(g[0].memo)) return; for (let i = 1; i < g.length; i++) if (C.daysBetween(g[i - 1].date, g[i].date) <= 2) { add('med', 'dup:' + g[i].id, 'Possible duplicate: ' + (g[i].memo || 'entry'), fmt(sum(g[i].lines, l => l.dr)) + ' appears on ' + g[i - 1].date + ' and ' + g[i].date + ' with the same description.', '#/transactions/' + encodeURIComponent(g[i].memo), { amount: sum(g[i].lines, l => l.dr) }); break; } });
    // outliers per expense category (robust: median and MAD)
    const per = {}; st.entries.forEach(e => e.lines.forEach(l => { const a = acct(st, l.a); if (a && a.type === 'expense' && l.dr - l.cr > 0) (per[l.a] = per[l.a] || []).push({ v: l.dr - l.cr, e }); }));
    Object.keys(per).forEach(id => { const L = per[id]; if (L.length < 6) return; const vs = L.map(x => x.v), md = median(vs), mad = median(vs.map(v => Math.abs(v - md)));
      L.forEach(x => { const z = mad > 0 ? 0.6745 * (x.v - md) / mad : (x.v > md * 4 ? 9 : 0); if (z > 3.5 && x.v > md * 2 && today >= x.e.date && C.daysBetween(x.e.date, today) <= 180) add('med', 'out:' + x.e.id + id, 'Unusually large ' + acct(st, id).name.toLowerCase() + ' amount', fmt(x.v) + ' on ' + x.e.date + ' (' + (x.e.memo || 'no memo') + ') against a typical ' + fmt(md) + '.', '#/transactions/' + encodeURIComponent(x.e.memo || ''), { amount: x.v }); }); });
    // invoice numbering gaps
    const nums = st.invoices.filter(i => i.status !== 'draft' && i.number).map(i => { const m = /^(.*?)(\d+)$/.exec(i.number); return m ? { p: m[1], n: +m[2] } : null; }).filter(Boolean), grp = {}; nums.forEach(x => (grp[x.p] = grp[x.p] || []).push(x.n));
    Object.keys(grp).forEach(p => { const ns = new Set(grp[p]), lo = Math.min.apply(null, grp[p]), hi = Math.max.apply(null, grp[p]), miss = []; for (let n = lo; n <= hi && miss.length < 5; n++) if (!ns.has(n)) miss.push(p + n); if (miss.length) add('low', 'gap:' + p, 'Invoice numbering gap', 'No invoice found for ' + miss.join(', ') + '. A deleted draft leaves a gap; check it is expected.', '#/invoices'); });
    // uncategorised
    const un = st.entries.filter(e => e.lines.some(l => l.a === C.UNCAT_IN || l.a === C.UNCAT_OUT)); if (un.length) add('med', 'uncat', un.length + ' uncategorised entr' + (un.length === 1 ? 'y' : 'ies'), 'Worth ' + fmt(sum(un, e => sum(e.lines, l => (l.a === C.UNCAT_IN || l.a === C.UNCAT_OUT) ? l.dr + l.cr : 0))) + ' sits in an uncategorised account, so reports and the tax guide are less reliable.', '#/transactions');
    // overdue invoices, stale drafts, overdue bills
    const od = st.invoices.filter(i => C.balanceH(st, i) > 0 && C.daysBetween(C.dueDate(i), today) > 60); if (od.length) add('high', 'od60', od.length + ' invoice' + (od.length === 1 ? ' is' : 's are') + ' over 60 days late', fmt(sum(od, i => C.balanceH(st, i))) + ' outstanding. Open Reminders to write a final notice.', '#/reminders');
    const ob = st.bills.filter(b => C.billBalanceH(st, b) > 0 && C.daysBetween(C.billDue(b), today) > 0); if (ob.length) add('med', 'bills-late', ob.length + ' bill' + (ob.length === 1 ? ' is' : 's are') + ' past due', fmt(sum(ob, b => C.billBalanceH(st, b))) + ' unpaid to vendors.', '#/bills');
    const sd = st.invoices.filter(i => i.status === 'draft' && i.date && C.daysBetween(i.date, today) > 30); if (sd.length) add('low', 'stale', sd.length + ' draft invoice' + (sd.length === 1 ? '' : 's') + ' older than 30 days', 'Drafts do not count as income until issued.', '#/invoices');
    // regular payments that went quiet
    const grpM = {}; st.entries.forEach(e => { const l = e.lines.find(x => { const a = acct(st, x.a); return a && a.type === 'expense' && x.dr > 0; }); const k = normMemo(e.memo); if (l && k) (grpM[k] = grpM[k] || []).push(e.date); });
    Object.keys(grpM).forEach(k => { const ds = Array.from(new Set(grpM[k])).sort(); if (ds.length < 4) return; const gaps = []; for (let i = 1; i < ds.length; i++) gaps.push(C.daysBetween(ds[i - 1], ds[i])); const g = median(gaps); if (g < 25 || g > 35) return;
      const dev = median(gaps.map(x => Math.abs(x - g))); if (dev > 4) return; const last = ds[ds.length - 1], exp = C.addDays(last, Math.round(g)), late = C.daysBetween(exp, today); if (late > 10 && late < 100) add('med', 'quiet:' + k, 'Regular payment has gone quiet: ' + k, 'Paid about every ' + Math.round(g) + ' days, last seen ' + last + ', expected around ' + exp + '. A missed entry or a cancelled service?', '#/transactions/' + encodeURIComponent(k)); });
    const neg = st.items.filter(i => i.track && i.onHand < 0); if (neg.length) add('med', 'negstock', neg.length + ' product' + (neg.length === 1 ? '' : 's') + ' with negative stock', neg.slice(0, 3).map(i => i.name).join(', ') + ': more was sold than received.', '#/items');
    const odd = st.entries.filter(e => e.date > C.addDays(today, 60) || e.date < '2000-01-01'); if (odd.length) add('low', 'dates', odd.length + ' entr' + (odd.length === 1 ? 'y has' : 'ies have') + ' an odd date', 'Dated more than 60 days ahead or before 2000, often a typo in the year.', '#/transactions');
    const rank = { high: 0, med: 1, low: 2 }; f.sort((a, b) => rank[a.sev] - rank[b.sev]);
    const score = Math.max(0, 100 - 18 * f.filter(x => x.sev === 'high').length - 7 * f.filter(x => x.sev === 'med').length - 2 * f.filter(x => x.sev === 'low').length);
    return { findings: f, score, grade: score >= 90 ? 'Tidy' : score >= 70 ? 'Mostly tidy' : score >= 45 ? 'Needs attention' : 'Needs a close look', checked: st.entries.length };
  };

  /* ---------- bank reconciliation ---------- */
  const cashIdsOf = st => st.accounts.filter(a => a.cash).map(a => a.id);
  const net = (st, e) => { const ids = cashIdsOf(st); return sum(e.lines.filter(l => ids.indexOf(l.a) >= 0), l => l.dr - l.cr); };
  C.reconUncleared = function (st, upTo) { const out = []; st.entries.forEach(e => { if ((st.cleared || {})[e.id] || (upTo && e.date > upTo)) return; const n = net(st, e); if (n) out.push({ id: e.id, date: e.date, memo: e.memo || '', amount: n }); }); return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1)); };
  C.reconClearedBalance = st => sum(st.entries.filter(e => (st.cleared || {})[e.id]), e => net(st, e));
  const sim = (a, b) => { const x = new Set(words(a)), y = new Set(words(b)); if (!x.size || !y.size) return 0; let n = 0; x.forEach(w => { if (y.has(w)) n++; }); return n / (x.size + y.size - n); };
  C.reconMatch = function (st, rows, upTo, window) { // greedy best-first, one statement line to one entry
    const cand = C.reconUncleared(st, upTo), pairs = [], win = window == null ? 7 : window;
    rows.forEach((r, ri) => cand.forEach(c => { if (c.amount !== r.amount) return; const d = Math.abs(C.daysBetween(r.date, c.date)); if (d > win) return; pairs.push({ ri, id: c.id, score: 100 - d * 8 + Math.round(sim(r.desc, c.memo) * 30) }); }));
    pairs.sort((a, b) => b.score - a.score || a.ri - b.ri); const usedR = new Set(), usedE = new Set(), matches = [];
    pairs.forEach(p => { if (usedR.has(p.ri) || usedE.has(p.id)) return; usedR.add(p.ri); usedE.add(p.id); matches.push({ row: rows[p.ri], rowIndex: p.ri, entryId: p.id, score: p.score }); });
    return { matches, unmatchedRows: rows.filter((_, i) => !usedR.has(i)), unmatchedEntries: cand.filter(c => !usedE.has(c.id)) };
  };
  C.reconDifference = function (st, endBal, ids) { const set = new Set(ids), picked = sum(st.entries.filter(e => set.has(e.id) && !(st.cleared || {})[e.id]), e => net(st, e)); return endBal - (C.reconClearedBalance(st) + picked); };
  C.reconFinish = function (st, o) { // o: {date, endBal, ids}
    if (!C.isDate(o.date)) throw new Error('Pick the statement end date'); if (!Number.isInteger(o.endBal)) throw new Error('Enter the statement ending balance');
    const diff = C.reconDifference(st, o.endBal, o.ids); if (diff !== 0) throw new Error('The difference is ' + fmt(diff) + '. It must be $0.00 before you can finish.');
    st.recon = st.recon || []; st.cleared = st.cleared || {}; const id = C.nid(st, 'r'), ids = Array.from(new Set(o.ids)).filter(x => !st.cleared[x] && st.entries.some(e => e.id === x));
    ids.forEach(x => { st.cleared[x] = id; }); const rec = { id, date: o.date, endBal: o.endBal, count: ids.length, doneOn: C.today() }; st.recon.push(rec); return rec;
  };
  C.reconUndo = function (st) { const rec = (st.recon || [])[(st.recon || []).length - 1]; if (!rec) return false; Object.keys(st.cleared).forEach(k => { if (st.cleared[k] === rec.id) delete st.cleared[k]; }); st.recon.pop(); return true; };

  /* ---------- cash what-if ---------- */
  C.scenario = function (st, today, weeks, sc) { // sc: {delay, billDelay, skipClient, extraOut, extraIn (cents per month), oneOff:{date, amount}}
    sc = sc || {}; weeks = weeks || 13; const end = C.addDays(today, weeks * 7 - 1), extra = [];
    for (let k = 1; k < 30; k++) { const d = C.addMonths(today, k); if (d > end) break; if (sc.extraOut > 0) extra.push({ date: d, amount: -sc.extraOut, label: 'What-if: extra monthly cost', kind: 'whatif' }); if (sc.extraIn > 0) extra.push({ date: d, amount: sc.extraIn, label: 'What-if: extra monthly income', kind: 'whatif' }); }
    if (sc.oneOff && sc.oneOff.amount && sc.oneOff.date >= today && sc.oneOff.date <= end) extra.push({ date: sc.oneOff.date, amount: -Math.abs(sc.oneOff.amount), label: 'What-if: one-off purchase', kind: 'whatif' });
    const base = C.forecast(st, today, weeks), alt = C.forecast(st, today, weeks, { delay: sc.delay || 0, billDelay: sc.billDelay || 0, skipClient: sc.skipClient || '', extra });
    const run = f => { const i = f.weeks.findIndex(w => w.balance < 0); return i < 0 ? null : i + 1; };
    return { base, alt, deltaFinish: alt.finish - base.finish, deltaLow: alt.low.balance - base.low.balance, runwayBase: run(base), runwayAlt: run(alt) };
  };

  /* ---------- learned categorisation: a small naive Bayes model over your own past entries ---------- */
  const TOK_STOP = new Set(['pos', 'debit', 'card', 'purchase', 'payment', 'pmt', 'ach', 'www', 'com', 'inc', 'llc', 'the', 'and', 'for', 'check', 'chk', 'transfer', 'online', 'recurring', 'visa', 'ref', 'tst']);
  const toks = s => words(s).filter(w => w.length >= 3 && !/\d/.test(w) && !TOK_STOP.has(w));
  C.learnModel = function (st) {
    const m = { accts: {}, tok: {}, vocab: new Set(), n: 0 };
    st.entries.forEach(e => { const l = e.lines.find(x => { const a = acct(st, x.a); return a && (a.type === 'expense' || a.type === 'income') && x.a !== C.UNCAT_IN && x.a !== C.UNCAT_OUT; }); if (!l || !e.memo || (e.kind !== 'csv' && e.kind !== 'simple')) return;
      const a = l.a; m.accts[a] = (m.accts[a] || 0) + 1; m.n++; toks(e.memo).forEach(t => { (m.tok[a] = m.tok[a] || {})[t] = ((m.tok[a] || {})[t] || 0) + 1; m.vocab.add(t); }); });
    return m;
  };
  C.suggestAccount = function (model, desc, amount) { // returns {acct, conf} or null when not sure enough
    const tk = toks(desc).filter(t => model.vocab.has(t)); if (!tk.length || model.n < 3) return null;
    const type = amount > 0 ? 'income' : 'expense', cands = Object.keys(model.accts); let best = null, scores = [];
    cands.forEach(a => { const tot = sum(Object.keys(model.tok[a] || {}), k => model.tok[a][k]); let lp = Math.log(model.accts[a] / model.n); tk.forEach(t => { lp += Math.log((((model.tok[a] || {})[t] || 0) + 0.5) / (tot + 0.5 * model.vocab.size)); }); scores.push([a, lp]); });
    const mx = Math.max.apply(null, scores.map(s => s[1])), z = sum(scores, s => Math.exp(s[1] - mx)); scores = scores.map(s => [s[0], Math.exp(s[1] - mx) / z]).sort((a, b) => b[1] - a[1]);
    for (const s of scores) { const a = model.acctType ? model.acctType[s[0]] : null; if (!best && s[1] >= 0.6 && (a == null || a === type)) best = { acct: s[0], conf: Math.round(s[1] * 100) }; }
    return best;
  };
  const baseCat = C.categorise;
  C.categorise = function (st, rows, opt) {
    const out = baseCat(st, rows); if (!opt || !opt.learn) return out; const model = C.learnModel(st); model.acctType = {}; st.accounts.forEach(a => { model.acctType[a.id] = a.type === 'expense' ? 'expense' : a.type === 'income' ? 'income' : null; });
    return out.map(r => { if (r.rule) return r; const s = C.suggestAccount(model, r.desc, r.amount); return s ? Object.assign({}, r, { acct: s.acct, learned: s.conf }) : r; });
  };

  root.StarkCore = C; if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
