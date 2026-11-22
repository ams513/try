/* Stark Ledger. Pure logic: money, double-entry books, invoices, CSV import, reports, tax worksheet, crypto.
   No DOM and no network. Runs in the browser (global StarkCore) and in Node (module.exports) so the tests can use it. */
(function (root) {
  'use strict';
  const C = {};
  C.VERSION = '1.6.0';

  /* ---------- money (integer cents) ---------- */
  C.roundDiv = function (n, d) { // round half away from zero, integers only
    const s = n < 0 ? -1 : 1; n = Math.abs(n);
    return s * Math.floor((2 * n + d) / (2 * d));
  };
  C.toCents = function (v) { // "1,234.5" -> 123450 ; returns NaN when not a number
    if (typeof v === 'number') return Math.round(v * 100);
    let s = String(v == null ? '' : v).trim(); if (!s) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
    s = s.replace(/[$\s,]/g, '');
    if (s[0] === '-') { neg = !neg; s = s.slice(1); } else if (s[0] === '+') s = s.slice(1);
    if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return NaN;
    const p = s.split('.'); const frac = ((p[1] || '') + '00').slice(0, 2); const third = (p[1] || '')[2];
    let c = parseInt(p[0] || '0', 10) * 100 + parseInt(frac, 10);
    if (third !== undefined && third >= '5') c += 1;
    return neg ? -c : c;
  };
  /* display format: the default is the US look ($1,234.56). 1.5 adds a home currency and a locale per set of books (C.setFormat, js/core_tax.js). */
  let FMT = null;
  C.setFormat = function (cur, locale) {
    cur = String(cur || 'USD').toUpperCase(); locale = locale || 'en-US'; FMT = null;
    if (cur === 'USD' && locale === 'en-US') return true;
    try { FMT = { cur, loc: locale, nf: new Intl.NumberFormat(locale, { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }) }; return true; } catch (e) { FMT = null; return false; }
  };
  C.homeCur = () => (FMT ? FMT.cur : 'USD'); C.homeLocale = () => (FMT ? FMT.loc : 'en-US');
  C.fmt = function (c) {
    if (FMT) return FMT.nf.format(c / 100 + 0);
    const neg = c < 0; c = Math.abs(c);
    const d = Math.floor(c / 100), r = c % 100;
    return (neg ? '-' : '') + '$' + String(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + (r < 10 ? '0' : '') + r;
  };
  C.qtyToMilli = function (v) { // "1.5" -> 1500
    const s = String(v).trim(); if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return NaN;
    const p = s.split('.'); return parseInt(p[0] || '0', 10) * 1000 + parseInt(((p[1] || '') + '000').slice(0, 3), 10);
  };
  C.pctToBps = function (v) { // "8.25" -> 825
    const s = String(v).trim(); if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return NaN;
    const p = s.split('.'); return parseInt(p[0] || '0', 10) * 100 + parseInt(((p[1] || '') + '00').slice(0, 2), 10);
  };

  /* ---------- dates (YYYY-MM-DD strings, no timezone surprises) ---------- */
  C.isDate = function (s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
    return d.toISOString().slice(0, 10) === s;
  };
  const toDays = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
  const fromDays = n => new Date(n * 86400000).toISOString().slice(0, 10);
  C.daysBetween = (a, b) => toDays(b) - toDays(a);
  C.addDays = (s, n) => fromDays(toDays(s) + n);
  C.addMonths = function (s, k) { // keeps the original day where possible (Jan 31 + 1 month = Feb 28/29)
    const y = +s.slice(0, 4), m = +s.slice(5, 7) - 1, d = +s.slice(8, 10);
    const t = y * 12 + m + k, ny = Math.floor(t / 12), nm = t % 12;
    const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(Math.min(d, last)).padStart(2, '0');
  };
  C.today = function () { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------- chart of accounts. sc = US Schedule C line (a guide only), pct = share treated as deductible ---------- */
  const A = (id, name, type, extra) => Object.assign({ id, name, type }, extra || {});
  C.defaultAccounts = function () {
    return [
      A('1000', 'Checking', 'asset', { cash: true }), A('1100', 'Accounts receivable', 'asset'), A('1200', 'Inventory', 'asset'),
      A('2000', 'Accounts payable', 'liability'), A('2100', 'Sales tax payable', 'liability'),
      A('3000', 'Opening balance equity', 'equity'), A('3100', "Owner's contributions", 'equity'), A('3200', "Owner's draws", 'equity'),
      A('4000', 'Services income', 'income', { sc: '1' }), A('4100', 'Product sales', 'income', { sc: '1' }),
      A('4900', 'Other income', 'income', { sc: '6' }), A('4990', 'Uncategorized income', 'income', { sc: '1' }),
      A('5000', 'Cost of goods sold', 'expense', { sc: '4' }),
      A('6010', 'Advertising', 'expense', { sc: '8' }), A('6020', 'Car and truck', 'expense', { sc: '9' }),
      A('6030', 'Commissions and fees', 'expense', { sc: '10' }), A('6040', 'Contract labor', 'expense', { sc: '11' }),
      A('6050', 'Depreciation', 'expense', { sc: '13' }), A('6060', 'Insurance (not health)', 'expense', { sc: '15' }),
      A('6070', 'Interest', 'expense', { sc: '16b' }), A('6080', 'Legal and professional', 'expense', { sc: '17' }),
      A('6090', 'Office expense', 'expense', { sc: '18' }), A('6100', 'Rent: equipment', 'expense', { sc: '20a' }),
      A('6110', 'Rent: space', 'expense', { sc: '20b' }), A('6120', 'Repairs and maintenance', 'expense', { sc: '21' }),
      A('6130', 'Supplies', 'expense', { sc: '22' }), A('6140', 'Taxes and licenses', 'expense', { sc: '23' }),
      A('6150', 'Travel', 'expense', { sc: '24a' }), A('6160', 'Meals', 'expense', { sc: '24b', pct: 50 }),
      A('6170', 'Utilities', 'expense', { sc: '25' }), A('6180', 'Wages', 'expense', { sc: '26' }),
      A('6190', 'Software and subscriptions', 'expense', { sc: '27a' }), A('6200', 'Bank and card fees', 'expense', { sc: '27a' }),
      A('6210', 'Home office', 'expense', { sc: '30' }), A('6900', 'Other expenses', 'expense', { sc: '27a' }),
      A('6990', 'Uncategorized expense', 'expense', { sc: '27a' })
    ];
  };
  C.SCHED_C = { '1': 'Gross receipts or sales', '4': 'Cost of goods sold (Part III)', '6': 'Other income', '8': 'Advertising', '9': 'Car and truck expenses', '10': 'Commissions and fees', '11': 'Contract labor', '13': 'Depreciation', '15': 'Insurance (other than health)', '16b': 'Interest (other)', '17': 'Legal and professional services', '18': 'Office expense', '20a': 'Rent or lease: vehicles, machinery, equipment', '20b': 'Rent or lease: other property', '21': 'Repairs and maintenance', '22': 'Supplies', '23': 'Taxes and licenses', '24a': 'Travel', '24b': 'Deductible meals (50%)', '25': 'Utilities', '26': 'Wages', '27a': 'Other expenses', '30': 'Business use of home' };
  C.CASH = '1000'; C.AR = '1100'; C.SALESTAX = '2100'; C.CONTRIB = '3100'; C.DRAW = '3200'; C.UNCAT_IN = '4990'; C.UNCAT_OUT = '6990'; C.CAR = '6020'; C.INV = '1200'; C.AP = '2000'; C.COGS = '5000'; C.OPENING = '3000';

  C.newState = function () {
    return {
      v: 1, seq: 1, accounts: C.defaultAccounts(), entries: [], clients: [], invoices: [], payments: [], recurring: [], mileage: [],
      rules: [], importKeys: {}, lastImport: null, receipts: [], cover: null,
      estimates: [], schedules: [], reminders: [], vendors: [], bills: [], billPayments: [], pos: [], items: [], time: [], budgets: [], closings: [], recon: [], cleared: {},
      settings: { business: '', address: '', email: '', phone: '', prefix: 'INV-', nextNumber: 1001, terms: 30, taxes: [], mileageRate: 70, filing: 'single', footer: 'Thank you for your business.',
        estPrefix: 'EST-', nextEstimate: 1001, poPrefix: 'PO-', nextPO: 1001, billPrefix: 'BILL-', nextBill: 1, lockDate: '', lang: 'en', timer: null, timeRound: 6, defaultRate: 0,
        taxMode: 'sales', taxIncl: false, taxRound: 'line', taxNo: '', vatRates: [], homeCur: 'USD', locale: '' }
    };
  };
  /* Edition: the paid app has no limits. The free-trial package adds js/edition.js (window.StarkEdition) and nothing else changes.
     The one limit: new invoices stop at invoiceLimit. Existing data is never deleted, locked or hidden, and exports and backups stay complete. */
  C.edition = () => { const e = typeof globalThis !== 'undefined' && globalThis.StarkEdition; return e && e.trial === true ? e : null; };
  C.invoiceLimitReached = st => { const e = C.edition(); return !!(e && st.invoices.length >= e.invoiceLimit); };
  C.nid = function (st, p) {
    if (p === 'i' && C.invoiceLimitReached(st)) throw new Error('Free trial limit: ' + C.edition().invoiceLimit + ' invoices. Nothing is lost or locked: everything you made is still here and downloads as a backup that opens in the paid app. To keep going, own it forever on itch.io.');
    return (p || 'x') + (st.seq++);
  };
  /* feedback: a mailto link the person's own mail app opens. Nothing is sent from here; the draft holds only what they typed, the app name and the version. */
  C.FEEDBACK_TO = 'hello@starkforall.com';
  C.feedbackMailto = function (o) {
    o = o || {}; const clip = s => String(s == null ? '' : s).replace(/\r/g, '').trim().slice(0, 700), r = parseInt(o.rating, 10), e = C.edition();
    const body = ['Stark Ledger ' + C.VERSION + (e ? ' (Free trial)' : ''), r >= 1 && r <= 5 ? 'Rating: ' + r + ' / 5' : 'Rating: not given', '', 'What I like:', clip(o.liked) || '-', '', 'What is missing:', clip(o.missing) || '-'].join('\r\n');
    return 'mailto:' + C.FEEDBACK_TO + '?subject=' + encodeURIComponent('Stark Ledger feedback') + '&body=' + encodeURIComponent(body);
  };
  const acct = (st, id) => st.accounts.find(a => a.id === id);
  C.account = acct;

  /* ---------- double-entry journal ---------- */
  C.post = function (st, e) { // e: {date, memo, kind, ref, lines:[{a, dr, cr}]}  amounts are integer cents
    if (!C.isDate(e.date)) throw new Error('Bad date: ' + e.date);
    C.assertOpen(st, e.date);
    if (!Array.isArray(e.lines) || e.lines.length < 2) throw new Error('An entry needs at least two lines');
    let dr = 0, cr = 0;
    for (const l of e.lines) {
      if (!acct(st, l.a)) throw new Error('Unknown account ' + l.a);
      const d = l.dr || 0, c = l.cr || 0;
      if (!Number.isInteger(d) || !Number.isInteger(c) || d < 0 || c < 0) throw new Error('Amounts must be whole cents, not negative');
      if ((d > 0) === (c > 0)) throw new Error('A line is either a debit or a credit');
      dr += d; cr += c;
    }
    if (dr !== cr) throw new Error('Entry does not balance: debits ' + dr + ' vs credits ' + cr);
    const entry = { id: C.nid(st, 'e'), date: e.date, memo: e.memo || '', kind: e.kind || 'manual', ref: e.ref || '', lines: e.lines.map(l => ({ a: l.a, dr: l.dr || 0, cr: l.cr || 0 })) };
    st.entries.push(entry); return entry;
  };
  C.assertOpen = function (st, date) { const lk = st.settings && st.settings.lockDate; if (lk && date <= lk) throw new Error('The books are closed through ' + lk + '. Reopen that year on the Year-end page to change it.'); };
  C.removeEntry = function (st, id) { const i = st.entries.findIndex(e => e.id === id); if (i >= 0) { C.assertOpen(st, st.entries[i].date); st.entries.splice(i, 1); } return i >= 0; };
  C.trialBalance = function (st, upTo) {
    const bal = {}; let dr = 0, cr = 0;
    for (const e of st.entries) { if (upTo && e.date > upTo) continue; for (const l of e.lines) { bal[l.a] = (bal[l.a] || 0) + l.dr - l.cr; dr += l.dr; cr += l.cr; } }
    return { balances: bal, debits: dr, credits: cr, balanced: dr === cr };
  };
  C.natural = function (st, id, net) { const t = acct(st, id).type; return (t === 'asset' || t === 'expense') ? net : -net; };

  /* simple income / expense, as the plain UI sees it. amount is positive cents */
  C.addMoney = function (st, o) { // {date, kind:'in'|'out', amount, acct, memo, source, ref}
    if (!(o.amount > 0)) throw new Error('Amount must be more than zero');
    const a = acct(st, o.acct); if (!a) throw new Error('Pick a category');
    if (o.kind === 'in') {
      if (a.type !== 'income' && a.type !== 'equity') throw new Error('Money in goes to an income category');
      return C.post(st, { date: o.date, memo: o.memo, kind: o.source || 'simple', ref: o.ref, lines: [{ a: C.CASH, dr: o.amount }, { a: o.acct, cr: o.amount }] });
    }
    if (a.type !== 'expense' && a.type !== 'equity') throw new Error('Money out goes to an expense category');
    return C.post(st, { date: o.date, memo: o.memo, kind: o.source || 'simple', ref: o.ref, lines: [{ a: o.acct, dr: o.amount }, { a: C.CASH, cr: o.amount }] });
  };

  /* ---------- invoices ---------- */
  C.invoiceTotals = function (inv) {
    const lines = inv.lines.map(l => { const q = l.q != null ? l.q : C.qtyToMilli(l.qty); return Object.assign({}, l, { amount: C.roundDiv(q * l.unit, 1000) }); });
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const taxes = (inv.taxes || []).map(t => ({ name: t.name, bps: t.bps, amount: C.roundDiv(subtotal * t.bps, 10000) })); // each tax rounded on its own, half up
    const tax = taxes.reduce((s, t) => s + t.amount, 0);
    return { lines, subtotal, taxes, tax, total: subtotal + tax };
  };
  /* read scope: inside C.readScope(st, fn) lookups use maps built once (payments per invoice, bill payments per bill, invoices and clients by id),
     so list pages and reports are O(n) instead of O(n^2). Outside a scope every lookup reads the live arrays. Never mutate the books inside a scope. */
  let scope = null;
  const group = (list, k) => { const m = new Map(); for (const x of list || []) m.set(x[k], (m.get(x[k]) || 0) + x.amount); return m; };
  const byId = list => { const m = new Map(); for (const x of list || []) m.set(x.id, x); return m; };
  C.readScope = function (st, fn) {
    if (scope && scope.st === st) return fn();
    const prev = scope, memo = {}; const lazy = (k, mk) => memo[k] || (memo[k] = mk());
    scope = { st, get pay() { return lazy('pay', () => group(st.payments, 'invId')); }, get billPay() { return lazy('bp', () => group(st.billPayments, 'billId')); },
      get inv() { return lazy('inv', () => byId(st.invoices)); }, get client() { return lazy('cl', () => byId(st.clients)); },
      get rem() { return lazy('rem', () => { const m = new Map(); for (const r of st.reminders || []) { if (!m.has(r.invId)) m.set(r.invId, []); m.get(r.invId).push(r); } return m; }); } };
    try { return fn(); } finally { scope = prev; }
  };
  C.scoped = st => (scope && scope.st === st ? scope : null);
  C.paid = (st, invId) => { const sc = C.scoped(st); return sc ? (sc.pay.get(invId) || 0) : st.payments.filter(p => p.invId === invId).reduce((s, p) => s + p.amount, 0); };
  C.balance = (st, inv) => inv.status === 'issued' ? C.invoiceTotals(inv).total - C.paid(st, inv.id) : 0;
  C.dueDate = (inv) => C.addDays(inv.date, inv.terms == null ? 30 : inv.terms);
  C.invoiceStatus = function (st, inv, asOf) {
    if (inv.status === 'draft') return 'draft'; if (inv.status === 'void') return 'void';
    const bal = C.balance(st, inv), tot = C.invoiceTotals(inv).total;
    if (bal <= 0) return 'paid';
    if (asOf && C.dueDate(inv) < asOf) return 'overdue';
    return bal < tot ? 'partial' : 'open';
  };
  C.netLines = fixNeg;
  function fixNeg(lines) { // merge a debit and credit on the same account into one net line
    const net = {}; const order = [];
    lines.forEach(l => { if (!(l.a in net)) { net[l.a] = 0; order.push(l.a); } net[l.a] += (l.dr || 0) - (l.cr || 0); });
    return order.filter(a => net[a] !== 0).map(a => net[a] > 0 ? { a, dr: net[a] } : { a, cr: -net[a] });
  }
  /* hooks that js/core_tax.js replaces for VAT/GST and foreign-currency documents. The defaults are the original US sales-tax, one-currency behaviour.
     homeParts: the amounts that are posted, in the books' home currency: per line, per tax, and the total. taxAcct: where the tax of a document is posted.
     settle: null for an ordinary payment, or the entry lines and extra fields of a payment in another currency. */
  C.homeParts = (st, doc, t) => ({ lines: t.lines.map(l => (l.net != null ? l.net : l.amount)), taxes: t.taxes.map(x => x.amount), total: t.total });
  C.taxAcct = () => C.SALESTAX;
  C.settle = () => null;
  C.balanceH = (st, inv) => C.balance(st, inv); C.billBalanceH = (st, b) => C.billBalance(st, b); C.totalH = d => C.invoiceTotals(d).total; C.homeTotals = d => C.invoiceTotals(d); C.fmtDoc = (d, c) => C.fmt(c); C.isForeign = () => false;
  C.issueInvoice = function (st, id) {
    const inv = st.invoices.find(i => i.id === id); if (!inv) throw new Error('No such invoice');
    if (inv.status !== 'draft') throw new Error('Already issued');
    if (!inv.lines.length) throw new Error('Add at least one line');
    const t = C.invoiceTotals(inv); if (t.total <= 0) throw new Error('Invoice total must be above zero');
    const hp = C.homeParts(st, inv, t, 'sale'), lines = [{ a: C.AR, dr: hp.total }], txSum = hp.taxes.reduce((s, x) => s + x, 0);
    hp.lines.forEach((v, i) => { if (v > 0) lines.push({ a: t.lines[i].acct, cr: v }); else if (v < 0) lines.push({ a: t.lines[i].acct, dr: -v }); });
    if (txSum > 0) lines.push({ a: C.taxAcct(inv, 'sale'), cr: txSum }); else if (txSum < 0) lines.push({ a: C.taxAcct(inv, 'sale'), dr: -txSum });
    const number = st.settings.prefix + st.settings.nextNumber;
    const entry = C.post(st, { date: inv.date, memo: 'Invoice ' + number, kind: 'invoice', ref: inv.id, lines: fixNeg(lines) });
    inv.number = number; st.settings.nextNumber++; inv.status = 'issued'; inv.entryId = entry.id;
    return inv;
  };
  C.recordPayment = function (st, invId, date, amount, memo, opt) {
    const inv = st.invoices.find(i => i.id === invId); if (!inv || inv.status !== 'issued') throw new Error('Only issued invoices take payments');
    if (!(amount > 0)) throw new Error('Payment must be more than zero');
    const bal = C.balance(st, inv); if (amount > bal) throw new Error('Payment is more than the balance of ' + C.fmt(bal));
    const sx = C.settle(st, inv, 'recv', amount, opt);
    const e = C.post(st, { date, memo: memo || 'Payment, invoice ' + inv.number, kind: 'payment', ref: inv.id, lines: sx ? sx.lines : [{ a: C.CASH, dr: amount }, { a: C.AR, cr: amount }] });
    const p = Object.assign({ id: C.nid(st, 'p'), invId, date, amount, entryId: e.id }, sx ? sx.rec : {}); st.payments.push(p); return p;
  };
  C.removePayment = function (st, pid) { const i = st.payments.findIndex(p => p.id === pid); if (i < 0) return false; C.removeEntry(st, st.payments[i].entryId); st.payments.splice(i, 1); return true; };
  C.voidInvoice = function (st, id, date) {
    const inv = st.invoices.find(i => i.id === id); if (!inv || inv.status !== 'issued') throw new Error('Only issued invoices can be voided');
    if (C.paid(st, id) > 0) throw new Error('Remove the payments first');
    const orig = st.entries.find(e => e.id === inv.entryId);
    C.post(st, { date: date || inv.date, memo: 'Void ' + inv.number, kind: 'void', ref: inv.id, lines: orig.lines.map(l => ({ a: l.a, dr: l.cr, cr: l.dr })) });
    inv.status = 'void'; return inv;
  };
  C.aging = (st, asOf) => C.readScope(st, () => aging(st, asOf));
  function aging(st, asOf) {
    const buckets = ['current', '1-30', '31-60', '61-90', '90+']; const rows = {}; const totals = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
    st.invoices.forEach(inv => {
      const bal = C.balanceH(st, inv); if (bal <= 0 || inv.date > asOf) return;
      const late = C.daysBetween(C.dueDate(inv), asOf);
      const b = late <= 0 ? 'current' : late <= 30 ? '1-30' : late <= 60 ? '31-60' : late <= 90 ? '61-90' : '90+';
      const r = rows[inv.clientId] || (rows[inv.clientId] = { clientId: inv.clientId, current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0, invoices: [] });
      r[b] += bal; r.total += bal; totals[b] += bal; totals.total += bal; r.invoices.push({ id: inv.id, number: inv.number, due: C.dueDate(inv), late: Math.max(0, late), balance: bal, bucket: b });
    });
    return { buckets, rows: Object.values(rows), totals };
  };

  /* ---------- mileage (a standard-mileage deduction posts Dr Car and truck, Cr Owner's contributions) ---------- */
  C.addMileage = function (st, m) {
    if (!(m.miles > 0)) throw new Error('Miles must be more than zero');
    const rate = m.rate != null ? m.rate : st.settings.mileageRate; const cents = Math.round(m.miles * rate);
    if (cents <= 0) throw new Error('Deduction rounds to zero');
    const rec = { id: C.nid(st, 'm'), date: m.date, desc: m.desc || '', purpose: m.purpose || '', miles: m.miles, rate, amount: cents };
    rec.entryId = C.post(st, { date: m.date, memo: 'Mileage ' + m.miles + ' mi', kind: 'mileage', ref: rec.id, lines: [{ a: C.CAR, dr: cents }, { a: C.CONTRIB, cr: cents }] }).id;
    st.mileage.push(rec); return rec;
  };
  C.removeMileage = function (st, id) { const i = st.mileage.findIndex(m => m.id === id); if (i < 0) return false; C.removeEntry(st, st.mileage[i].entryId); st.mileage.splice(i, 1); return true; };

  /* ---------- recurring expenses ---------- */
  C.recurDate = function (r, k) { return r.freq === 'weekly' ? C.addDays(r.start, 7 * k) : r.freq === 'quarterly' ? C.addMonths(r.start, 3 * k) : r.freq === 'yearly' ? C.addMonths(r.start, 12 * k) : C.addMonths(r.start, k); };
  C.runRecurring = function (st, today) {
    let n = 0;
    st.recurring.forEach(r => {
      if (!r.active) return; r.next = r.next || 0;
      for (let guard = 0; guard < 1000; guard++) {
        const d = C.recurDate(r, r.next); if (d > today || (r.end && d > r.end)) break;
        if (st.settings.lockDate && d <= st.settings.lockDate) { r.next++; continue; } // closed period: skip, never post into it
        C.addMoney(st, { date: d, kind: 'out', amount: r.amount, acct: r.acct, memo: r.name, source: 'recurring', ref: r.id }); r.next++; n++;
      }
    });
    return n;
  };

  /* ---------- CSV bank statements ---------- */
  C.parseCSV = function (text) {
    text = String(text).replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || ''; const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
      else f += ch;
    }
    row.push(f); if (row.some(x => x.trim() !== '')) rows.push(row);
    return rows;
  };
  C.parseBankDate = function (s, fmt) {
    s = String(s).trim(); let m;
    const norm = (y, mo, d) => { const r = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'); return C.isDate(r) ? r : null; };
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return norm(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(s))) { let y = +m[3]; if (y < 100) y += 2000; return fmt === 'dmy' ? norm(y, +m[2], +m[1]) : norm(y, +m[1], +m[2]); }
    return null;
  };
  C.parseBankCSV = function (text, opt) {
    opt = opt || {}; const rows = C.parseCSV(text); const out = { rows: [], errors: [] };
    if (!rows.length) { out.errors.push('The file is empty.'); return out; }
    const head = rows[0].map(h => h.trim().toLowerCase());
    const find = re => head.findIndex(h => re.test(h));
    let di = find(/date|posted/), ni = find(/desc|memo|payee|detail|name|narrat/), ai = find(/^amount|amt/), debi = find(/debit|withdraw|paid out|money out/), cri = find(/credit|deposit|paid in|money in/);
    let start = 1;
    if (di < 0 || (ai < 0 && debi < 0 && cri < 0)) { // no header: assume date, description, amount
      if (C.parseBankDate(rows[0][0], opt.dateFormat)) { di = 0; ni = 1; ai = rows[0].length - 1; start = 0; debi = cri = -1; }
      else { out.errors.push('Could not find Date and Amount columns. Expected headers like Date, Description, Amount (or Debit and Credit).'); return out; }
    }
    if (ni < 0) ni = rows[0].findIndex((_, i) => i !== di && i !== ai && i !== debi && i !== cri);
    for (let r = start; r < rows.length; r++) {
      const row = rows[r]; const line = r + 1;
      const date = C.parseBankDate(row[di] || '', opt.dateFormat); if (!date) { out.errors.push('Line ' + line + ': bad date "' + (row[di] || '') + '"'); continue; }
      let amt;
      if (ai >= 0) amt = C.toCents(row[ai]);
      else { const dd = C.toCents(row[debi] || ''), cc = C.toCents(row[cri] || ''); amt = (isNaN(cc) ? 0 : cc) - (isNaN(dd) ? 0 : Math.abs(dd)); if (isNaN(dd) && isNaN(cc)) amt = NaN; }
      if (isNaN(amt)) { out.errors.push('Line ' + line + ': bad amount "' + (ai >= 0 ? row[ai] : (row[debi] || '') + '/' + (row[cri] || '')) + '"'); continue; }
      if (opt.invert) amt = -amt;
      if (amt === 0) { out.errors.push('Line ' + line + ': zero amount skipped'); continue; }
      out.rows.push({ date, desc: (row[ni] || '').trim().replace(/\s+/g, ' '), amount: amt });
    }
    return out;
  };
  C.matchRule = function (rules, desc, amount) {
    const d = desc.toLowerCase();
    for (const r of rules) {
      if (r.dir === 'in' && amount < 0) continue; if (r.dir === 'out' && amount > 0) continue;
      const p = (r.pattern || '').toLowerCase(); if (!p) continue;
      let hit = false;
      if (r.mode === 'regex') { try { hit = new RegExp(r.pattern, 'i').test(desc); } catch (e) { hit = false; } }
      else if (r.mode === 'starts') hit = d.startsWith(p); else hit = d.includes(p);
      if (hit) return r;
    }
    return null;
  };
  C.categorise = function (st, rows) { // adds .acct, .rule, .key, .dup to each parsed row
    const seen = {};
    return rows.map(r => {
      const rule = C.matchRule(st.rules, r.desc, r.amount);
      let key; if (r.bid) key = 'b:' + (r.bacct || '') + '|' + r.bid + (r.bidx ? '|' + r.bidx : ''); // the bank's own id (FITID, AcctSvcrRef, end-to-end id), unique in its file (core_bank.js)
      else { const base = r.date + '|' + r.amount + '|' + r.desc.toLowerCase(); seen[base] = (seen[base] || 0) + 1; key = base + '#' + seen[base]; }
      return Object.assign({}, r, { rule: rule ? rule.id : null, acct: rule ? rule.acct : (r.amount > 0 ? C.UNCAT_IN : C.UNCAT_OUT), key, dup: !!st.importKeys[key] });
    });
  };
  C.importRows = function (st, rows, skipDups) { // atomic: if any row fails (for example a closed period) nothing from this call stays posted
    let n = 0, skipped = 0; const ids = [], keys = [], len0 = st.entries.length, seq0 = st.seq;
    try {
      rows.forEach(r => {
        if (skipDups && st.importKeys[r.key]) { skipped++; return; }
        const a = acct(st, r.acct); const abs = Math.abs(r.amount); let e;
        if (r.amount > 0 && a.type === 'expense') e = C.post(st, { date: r.date, memo: r.desc, kind: 'csv', ref: r.ref, lines: [{ a: C.CASH, dr: abs }, { a: r.acct, cr: abs }] }); // refund
        else if (r.amount < 0 && a.type === 'income') e = C.post(st, { date: r.date, memo: r.desc, kind: 'csv', ref: r.ref, lines: [{ a: r.acct, dr: abs }, { a: C.CASH, cr: abs }] }); // refund given
        else e = C.addMoney(st, { date: r.date, kind: r.amount > 0 ? 'in' : 'out', amount: abs, acct: r.acct, memo: r.desc, source: 'csv', ref: r.ref });
        if (!st.importKeys[r.key]) keys.push(r.key); st.importKeys[r.key] = 1; ids.push(e.id); n++;
      });
    } catch (err) { st.entries.length = len0; st.seq = seq0; keys.forEach(k => { delete st.importKeys[k]; }); throw new Error('Nothing was imported: ' + err.message); }
    return { imported: n, skipped, ids, keys };
  };

  /* ---------- reports ---------- */
  C.profitLoss = function (st, from, to) {
    const sums = {};
    st.entries.forEach(e => { if (e.date < from || e.date > to) return; e.lines.forEach(l => { sums[l.a] = (sums[l.a] || 0) + l.dr - l.cr; }); });
    const income = [], expenses = [];
    st.accounts.forEach(a => {
      const v = sums[a.id] || 0; if (!v) return;
      if (a.type === 'income') income.push({ acct: a.id, name: a.name, sc: a.sc, amount: -v });
      else if (a.type === 'expense') expenses.push({ acct: a.id, name: a.name, sc: a.sc, pct: a.pct || 100, amount: v });
    });
    const totalIncome = income.reduce((s, x) => s + x.amount, 0), totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
    return { from, to, income, expenses, totalIncome, totalExpenses, net: totalIncome - totalExpenses };
  };
  C.scheduleC = function (st, from, to) { // a guide: totals per Schedule C line, meals at 50 percent
    const pl = C.profitLoss(st, from, to); const lines = {};
    pl.income.forEach(x => { const l = lines[x.sc] || (lines[x.sc] = { line: x.sc, label: C.SCHED_C[x.sc], amount: 0, kind: 'income' }); l.amount += x.amount; });
    pl.expenses.forEach(x => { const ded = C.roundDiv(x.amount * x.pct, 100); const l = lines[x.sc] || (lines[x.sc] = { line: x.sc, label: C.SCHED_C[x.sc], amount: 0, kind: 'expense' }); l.amount += ded; });
    const list = Object.values(lines); const key = l => parseFloat(l.line) + (/[a-z]$/.test(l.line) ? l.line.charCodeAt(l.line.length - 1) / 1000 : 0);
    list.sort((a, b) => key(a) - key(b));
    const gross = list.filter(l => l.kind === 'income').reduce((s, l) => s + l.amount, 0), exp = list.filter(l => l.kind === 'expense').reduce((s, l) => s + l.amount, 0);
    return { lines: list, gross, expenses: exp, net: gross - exp };
  };
  C.cashFlow = function (st, from, to) {
    const cashIds = st.accounts.filter(a => a.cash).map(a => a.id); let opening = 0, closing = 0; const flows = {};
    st.entries.forEach(e => {
      const cashNet = e.lines.filter(l => cashIds.includes(l.a)).reduce((s, l) => s + l.dr - l.cr, 0);
      if (e.date < from) opening += cashNet; if (e.date <= to) closing += cashNet;
      if (e.date < from || e.date > to || !cashNet) return;
      e.lines.filter(l => !cashIds.includes(l.a)).forEach(l => {
        const v = l.cr - l.dr; const a = acct(st, l.a); const sec = (a.type === 'equity') ? 'financing' : 'operating';
        const label = l.a === C.AR ? 'Customer payments' : a.name; const k = sec + '|' + label; const f = flows[k] || (flows[k] = { section: sec, label, amount: 0 }); f.amount += v;
      });
    });
    const list = Object.values(flows).filter(f => f.amount); const sum = s => list.filter(f => f.section === s).reduce((x, f) => x + f.amount, 0);
    return { opening, closing, operating: list.filter(f => f.section === 'operating'), financing: list.filter(f => f.section === 'financing'), netOperating: sum('operating'), netFinancing: sum('financing'), net: closing - opening };
  };

  /* ---------- quarterly estimated-tax worksheet. Figures are editable defaults; a rough guide only. ---------- */
  C.TAX_DEFAULTS = {
    year: 2025, ssWageBase: 17610000,
    std: { single: 1575000, mfj: 3150000, hoh: 2362500 },
    brackets: { // [upper limit in cents or null, rate]
      single: [[1192500, .10], [4847500, .12], [10335000, .22], [19730000, .24], [25052500, .32], [62635000, .35], [null, .37]],
      mfj: [[2385000, .10], [9695000, .12], [20670000, .22], [39460000, .24], [50105000, .32], [75160000, .35], [null, .37]],
      hoh: [[1700000, .10], [6485000, .12], [10335000, .22], [19730000, .24], [25050000, .32], [62635000, .35], [null, .37]]
    }
  };
  C.bracketTax = function (taxable, br) {
    let tax = 0, prev = 0;
    for (const [lim, rate] of br) { const top = lim == null ? Infinity : lim; if (taxable > prev) tax += (Math.min(taxable, top) - prev) * rate; prev = top; if (taxable <= top) break; }
    return Math.round(tax);
  };
  C.taxEstimate = function (o, T) { // o: {net, other, filing, qbi, stateRate (percent), paid}; all money in cents
    T = T || C.TAX_DEFAULTS; const net = Math.max(0, o.net || 0), other = o.other || 0;
    const seBase = Math.round(net * 0.9235); const se = seBase < 40000 ? 0 : Math.round(Math.min(seBase, T.ssWageBase) * 0.124 + seBase * 0.029);
    const halfSE = Math.round(se / 2); const agi = net - halfSE + other; const std = T.std[o.filing] != null ? T.std[o.filing] : T.std.single;
    const qbiDed = o.qbi ? Math.round(0.2 * Math.max(0, Math.min(net - halfSE, agi - std))) : 0;
    const taxable = Math.max(0, agi - std - qbiDed); const incomeTax = C.bracketTax(taxable, T.brackets[o.filing] || T.brackets.single);
    const state = Math.round(taxable * (o.stateRate || 0) / 100); const total = incomeTax + se + state;
    return { net, seBase, se, halfSE, agi, std, qbiDed, taxable, incomeTax, state, total, owed: total - (o.paid || 0) };
  };
  C.quarterDates = year => [year + '-04-15', year + '-06-15', year + '-09-15', (year + 1) + '-01-15'];
  C.quarterPlan = function (total, paid, year, today) {
    const dates = C.quarterDates(year); const remaining = dates.filter(d => d >= today); const left = Math.max(0, total - paid);
    return dates.map((d, i) => { const idx = remaining.indexOf(d); const n = remaining.length;
      const amt = idx < 0 ? 0 : (idx === n - 1 ? left - Math.floor(left / n) * (n - 1) : Math.floor(left / n)); return { quarter: 'Q' + (i + 1), due: d, amount: amt, past: idx < 0 }; });
  };
  C.projectAnnual = function (ytd, year, asOf) { // straight-line annualisation of year-to-date profit
    const start = year + '-01-01', end = year + '-12-31'; if (asOf >= end) return ytd; if (asOf < start) return 0;
    const days = C.daysBetween(start, asOf) + 1; return Math.round(ytd * 365 / days);
  };

  /* ---------- exports ---------- */
  C.csvCell = function (v) { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  C.toCSV = rows => rows.map(r => r.map(C.csvCell).join(',')).join('\r\n') + '\r\n';
  const money = c => (c / 100).toFixed(2);
  C.journalCSV = function (st, from, to) {
    const rows = [['Date', 'Entry', 'Memo', 'Account', 'Account name', 'Debit', 'Credit']];
    st.entries.filter(e => e.date >= from && e.date <= to).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).forEach(e => e.lines.forEach(l => rows.push([e.date, e.id, e.memo, l.a, acct(st, l.a).name, l.dr ? money(l.dr) : '', l.cr ? money(l.cr) : ''])));
    return C.toCSV(rows);
  };
  C.scheduleCCSV = function (st, from, to) { const s = C.scheduleC(st, from, to); const rows = [['Schedule C line (guide)', 'Description', 'Amount']]; s.lines.forEach(l => rows.push([l.line, l.label, money(l.amount)])); rows.push(['', 'Net profit (guide)', money(s.net)]); return C.toCSV(rows); };
  C.invoicesCSV = function (st, from, to) {
    const rows = [['Number', 'Date', 'Due', 'Client', 'Status', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance']];
    st.invoices.filter(i => i.status !== 'draft' && i.date >= from && i.date <= to).forEach(i => { const t = C.invoiceTotals(i); const c = st.clients.find(x => x.id === i.clientId); rows.push([i.number, i.date, C.dueDate(i), c ? c.name : '', C.invoiceStatus(st, i, to), money(t.subtotal), money(t.tax), money(t.total), money(C.paid(st, i.id)), money(C.balance(st, i))]); });
    return C.toCSV(rows);
  };
  C.mileageCSV = function (st, from, to) { const rows = [['Date', 'Trip', 'Purpose', 'Miles', 'Rate (cents/mile)', 'Deduction']]; st.mileage.filter(m => m.date >= from && m.date <= to).forEach(m => rows.push([m.date, m.desc, m.purpose, m.miles, m.rate, money(m.amount)])); return C.toCSV(rows); };

  /* ---------- crypto: PBKDF2 (SHA-256) to AES-GCM 256 via WebCrypto ---------- */
  const wc = () => root.crypto || require('node:crypto').webcrypto;
  const rnd = n => wc().getRandomValues(new Uint8Array(n));
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  C.b64 = b64; C.unb64 = unb64;
  /* new writes use KDF_ITER. Imported files must sit inside KDF_MIN..KDF_MAX (no downgrade to a weak count, no tab-freezing count);
     anything below KDF_ITER is re-keyed at KDF_ITER with a fresh salt once it is opened. */
  C.KDF_ITER = 600000; C.KDF_MIN = 100000; C.KDF_MAX = 2000000; C.KDF_LEGACY_MIN = 1000;
  C.newSalt = () => rnd(16);
  C.deriveKey = async function (pass, salt, iter) {
    const sub = wc().subtle; const base = await sub.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return sub.deriveKey({ name: 'PBKDF2', salt, iterations: iter || C.KDF_ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  };
  /* AAD: every record is bound to what it is and where it lives ("state/main" + its save number, "receipt/<id>", the vault check, a backup header),
     so a ciphertext cannot be moved to another slot or have its header edited without failing authentication. Records written with AAD carry a:1. */
  C.aad = (kind, id) => new TextEncoder().encode('stark-ledger|1|' + kind + '|' + id);
  const gcm = (iv, aad) => aad ? { name: 'AES-GCM', iv, additionalData: aad } : { name: 'AES-GCM', iv };
  C.encryptBytes = async function (key, bytes, aad) { const iv = rnd(12); const ct = new Uint8Array(await wc().subtle.encrypt(gcm(iv, aad), key, bytes)); return aad ? { iv, ct, a: 1 } : { iv, ct }; };
  C.decryptBytes = async function (key, iv, ct, aad) { return new Uint8Array(await wc().subtle.decrypt(gcm(iv, aad), key, ct)); };
  C.encryptJSON = (key, obj, aad) => C.encryptBytes(key, new TextEncoder().encode(JSON.stringify(obj)), aad);
  C.decryptJSON = async function (key, rec, aad) { return JSON.parse(new TextDecoder().decode(await C.decryptBytes(key, rec.iv, rec.ct, rec.a === 1 ? aad : undefined))); };
  /* open a stored record: bound records need their AAD; unbound (pre-1.3) records are only accepted when strict is false */
  C.openRec = async function (key, rec, aad, strict) {
    if (!rec || !(rec.iv instanceof Uint8Array) || !(rec.ct instanceof Uint8Array)) throw new Error('missing record');
    if (rec.a !== 1 && strict) throw new Error('unbound record');
    return C.decryptBytes(key, rec.iv, rec.ct, rec.a === 1 ? aad : undefined);
  };
  C.stateAad = g => C.aad('state', 'main|' + g);
  C.checkAad = (salt, iter) => C.aad('check', 'vault|' + iter + '|' + b64(salt));
  C.receiptAad = id => C.aad('receipt', id);
  C.sameBytes = (a, b) => { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
  /* ---------- strict validation, checksums ---------- */
  const hex = u8 => Array.from(u8, x => x.toString(16).padStart(2, '0')).join('');
  C.sha256 = async s => hex(new Uint8Array(await wc().subtle.digest('SHA-256', new TextEncoder().encode(s))));
  const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
  const clean = (v, d) => { // no prototype-pollution keys anywhere, bounded depth
    if (d > 40) return false; if (v === null || typeof v !== 'object') return true;
    if (Array.isArray(v)) return v.every(x => clean(x, d + 1));
    return Object.getOwnPropertyNames(v).every(k => BAD_KEYS.indexOf(k) < 0 && clean(v[k], d + 1));
  };
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const ARR = ['accounts', 'entries', 'clients', 'invoices', 'payments', 'recurring', 'mileage', 'rules', 'receipts', 'estimates', 'schedules', 'reminders', 'vendors', 'bills', 'billPayments', 'pos', 'items', 'time', 'budgets', 'closings', 'recon'];
  C.MAX_ITEMS = 500000; C.MAX_RECEIPT_B64 = 60 * 1024 * 1024; C.MAX_BACKUP_CHARS = 500 * 1024 * 1024; // below V8's ~512M-character string limit
  C.MAX_RECEIPTS_TOTAL = 150 * 1024 * 1024; C.MAX_STR = 1000000;
  const isInt = v => Number.isSafeInteger(v), isId = v => typeof v === 'string' && v.length > 0 && v.length <= 100;
  const optStr = v => v == null || (typeof v === 'string' && v.length <= C.MAX_STR);
  const INV_ST = ['draft', 'issued', 'void'];
  /* field rules for an imported backup (strict): each returns '' or a reason. Only shapes the app itself always writes. */
  const RULES = {
    accounts: a => isId(a.id) && typeof a.name === 'string' && typeof a.type === 'string' ? '' : 'an account',
    entries: e => {
      if (!isId(e.id) || !Array.isArray(e.lines) || e.lines.length < 1 || !optStr(e.memo)) return 'an entry';
      let dr = 0, cr = 0; for (const l of e.lines) { if (!isObj(l) || !isId(l.a) || !isInt(l.dr || 0) || !isInt(l.cr || 0) || (l.dr || 0) < 0 || (l.cr || 0) < 0) return 'an entry line'; dr += l.dr || 0; cr += l.cr || 0; }
      return dr === cr ? '' : 'an entry that does not balance';
    },
    clients: c => isId(c.id) && optStr(c.name) ? '' : 'a client',
    vendors: v => isId(v.id) && optStr(v.name) ? '' : 'a vendor',
    invoices: i => isId(i.id) && Array.isArray(i.lines) && i.lines.every(isObj) && INV_ST.indexOf(i.status) >= 0 && typeof i.date === 'string' ? '' : 'an invoice',
    payments: p => isId(p.id) && isId(p.invId) && isInt(p.amount) && p.amount > 0 ? '' : 'a payment',
    billPayments: p => isId(p.id) && isId(p.billId) && isInt(p.amount) && p.amount > 0 ? '' : 'a bill payment',
    bills: b => isId(b.id) && Array.isArray(b.lines) && b.lines.every(isObj) ? '' : 'a bill',
    estimates: e => isId(e.id) && Array.isArray(e.lines) && e.lines.every(isObj) ? '' : 'an estimate',
    receipts: r => isId(r.id) && (r.size == null || (isInt(r.size) && r.size >= 0)) ? '' : 'a receipt record',
    time: t => isId(t.id) && isInt(t.minutes) && t.minutes >= 0 ? '' : 'a time entry'
  };
  const strOk = (v, d) => { if (d > 40) return false; if (typeof v === 'string') return v.length <= C.MAX_STR; if (typeof v === 'number') return Number.isFinite(v); if (v === null || typeof v !== 'object') return true; if (Array.isArray(v)) return v.every(x => strOk(x, d + 1)); for (const k in v) if (!strOk(v[k], d + 1)) return false; return true; };
  C.validateState = function (st, strict) { // returns '' when fine, else a plain reason. strict = an imported file: field types, balanced entries, size caps
    if (!isObj(st)) return 'the books are not an object';
    const known = Object.keys(C.newState()); for (const k of Object.keys(st)) if (known.indexOf(k) < 0) return 'unknown field "' + String(k).slice(0, 30) + '"';
    if (!clean(st, 0)) return 'unsafe field names';
    if (st.v != null && st.v !== 1) return 'unsupported version';
    if (st.seq != null && !(Number.isSafeInteger(st.seq) && st.seq >= 0)) return 'bad counter';
    for (const k of ARR) { if (st[k] == null) continue; if (!Array.isArray(st[k])) return k + ' must be a list'; if (st[k].length > C.MAX_ITEMS) return k + ' is too large'; if (!st[k].every(isObj)) return k + ' has a bad item'; }
    if (st.entries && !st.entries.every(e => typeof e.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(e.date))) return 'an entry has a bad date';
    if (st.importKeys != null && !isObj(st.importKeys)) return 'importKeys must be an object';
    if (st.lastImport != null) { const li = st.lastImport; if (!isObj(li) || !Array.isArray(li.ids) || !Array.isArray(li.keys) || li.ids.length > C.MAX_ITEMS || li.keys.length > C.MAX_ITEMS || !li.ids.every(x => typeof x === 'string') || !li.keys.every(x => typeof x === 'string')) return 'lastImport is damaged'; }
    if (st.cleared != null && !isObj(st.cleared)) return 'cleared must be an object';
    if (st.settings != null && !isObj(st.settings)) return 'settings must be an object';
    if (st.cover != null && C.coverCheck) { const why = C.coverCheck(st.cover); if (why) return why; }
    if (strict) {
      if (!Array.isArray(st.accounts) || !st.accounts.length) return 'no chart of accounts';
      for (const k in RULES) { if (!st[k]) continue; const ids = new Set(); for (const x of st[k]) { const why = RULES[k](x); if (why) return why; if (ids.has(x.id)) return 'a repeated id in ' + k; ids.add(x.id); } }
      if (!strOk(st, 0)) return 'a value that is too long or not a number';
    }
    return '';
  };
  const envSum = f => C.sha256(['stark-ledger', f.format, f.kdf, f.iter, f.salt, f.iv, f.data].join('|'));
  C.backupAad = f => C.aad('backup', ['stark-ledger', f.format, f.kdf, f.iter, f.salt].join('|')); // format 2: the header is authenticated
  const tooBig = () => new Error('The receipts are too large for one backup file (over ' + Math.round(C.MAX_RECEIPTS_TOTAL / 1048576) + ' MB in total). Delete or shrink some receipt images first.');
  /* one encrypted backup file holding the books and every receipt */
  C.packBackup = async function (key, salt, iter, state, receipts) { // receipts: [{id, bytes:Uint8Array}]
    if (receipts.reduce((s, r) => s + r.bytes.length, 0) > C.MAX_RECEIPTS_TOTAL) throw tooBig();
    const inner = JSON.stringify({ state, receipts: receipts.map(r => ({ id: r.id, b64: b64(r.bytes) })) }); // stringified once
    const sum = await C.sha256(inner); // inside the encryption, so it leaks nothing
    const f = { app: 'stark-ledger', format: 2, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt) };
    const r = await C.encryptBytes(key, new TextEncoder().encode(inner.slice(0, -1) + ',"sum":"' + sum + '"}'), C.backupAad(f));
    f.iv = b64(r.iv); f.data = b64(r.ct); f.sum = await envSum(f); return JSON.stringify(f);
  };
  C.unpackBackup = async function (text, pass) {
    const NOT = 'This is not a Stark Ledger backup.';
    if (typeof text !== 'string') throw new Error(NOT);
    if (text.length > C.MAX_BACKUP_CHARS) throw new Error('This backup is larger than this browser can open (' + Math.round(C.MAX_BACKUP_CHARS / 1048576) + ' MB).');
    let f; try { f = JSON.parse(text); } catch (e) { throw new Error(NOT); }
    if (!isObj(f) || f.app !== 'stark-ledger' || typeof f.salt !== 'string' || typeof f.iv !== 'string' || typeof f.data !== 'string') throw new Error(NOT);
    if ((f.format !== 1 && f.format !== 2) || f.kdf !== 'PBKDF2-SHA256' || !Number.isSafeInteger(f.iter)) throw new Error(NOT);
    if (f.iter < C.KDF_MIN || f.iter > C.KDF_MAX) throw new Error('This backup uses ' + f.iter + ' key rounds, outside the safe range of ' + C.KDF_MIN + ' to ' + C.KDF_MAX + '. Nothing was changed.');
    let note = 'no checksum, validated';
    if (f.sum != null) { if (typeof f.sum !== 'string' || f.sum !== await envSum(f)) throw new Error('This backup file is damaged (checksum mismatch). Nothing was changed.'); note = 'checksum verified'; }
    let salt, iv, ct; try { salt = unb64(f.salt); iv = unb64(f.iv); ct = unb64(f.data); } catch (e) { throw new Error(NOT); }
    if (salt.length < 16 || iv.length !== 12) throw new Error(NOT);
    let key = await C.deriveKey(pass, salt, f.iter);
    let payload; try { payload = JSON.parse(new TextDecoder().decode(await C.decryptBytes(key, iv, ct, f.format === 2 ? C.backupAad(f) : undefined))); } catch (e) { throw new Error('Wrong passphrase, or the file is damaged.'); }
    const bad = m => new Error('This backup failed validation (' + m + '). Nothing was changed.');
    if (!isObj(payload) || !clean(payload, 0)) throw bad('unsafe content'); if (!Array.isArray(payload.receipts)) throw bad('receipts');
    for (const k of Object.keys(payload)) if (['state', 'receipts', 'sum'].indexOf(k) < 0) throw bad('unknown field');
    const why = C.validateState(payload.state, true); if (why) throw bad(why);
    let total = 0;
    for (const r of payload.receipts) { if (!isObj(r) || typeof r.id !== 'string' || r.id.length > 100 || typeof r.b64 !== 'string' || r.b64.length > C.MAX_RECEIPT_B64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(r.b64)) throw bad('a receipt'); total += r.b64.length * 3 / 4; }
    if (total > C.MAX_RECEIPTS_TOTAL * 1.01) throw bad('receipts too large');
    if (payload.sum != null) { if (payload.sum !== await C.sha256(JSON.stringify({ state: payload.state, receipts: payload.receipts }))) throw bad('checksum mismatch'); note = 'checksum verified'; }
    else if (f.format === 2) throw bad('checksum missing');
    let iter = f.iter, upgraded = false;
    if (iter < C.KDF_ITER) { salt = C.newSalt(); iter = C.KDF_ITER; key = await C.deriveKey(pass, salt, iter); upgraded = true; note += ', key rounds raised to ' + iter; } // never adopt a weaker count than new books get
    return { key, salt, iter, upgraded, state: payload.state, receipts: payload.receipts.map(r => ({ id: r.id, bytes: unb64(r.b64) })), note };
  };

  root.StarkCore = C; if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
