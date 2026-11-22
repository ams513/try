/* Stark Ledger. Business logic added in 1.1: estimates, recurring invoices, reminders and statements, payables (vendors,
   purchase orders, bills), products and inventory, time tracking, sales tax by rate, budgets, cash-flow forecast,
   balance sheet and year-end close, the accountant package (a zip of CSVs), separate books and quick search.
   Pure functions on the books object. No DOM and no network; runs in the browser and in Node for the tests. */
(function (root) {
  'use strict';
  const C = root.StarkCore || require('./core.js');
  const acct = C.account, money = c => (c / 100).toFixed(2), clone = v => JSON.parse(JSON.stringify(v == null ? null : v));
  const byDate = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const find = (list, id, what) => { const x = list.find(i => i.id === id); if (!x) throw new Error('No such ' + what); return x; };
  const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
  const DOCK = ['taxMode', 'incl', 'round', 'cur', 'fx'], dk = (to, from) => { DOCK.forEach(k => { if (from[k] !== undefined) to[k] = from[k]; }); return to; }; // VAT / currency fields travel with a document's copy

  /* ---------- upgrade older books: new lists, settings and accounts; never removes anything ---------- */
  C.migrate = function (st) {
    const d = C.newState();
    Object.keys(d).forEach(k => { if (st[k] == null) st[k] = d[k]; });
    Object.keys(d.settings).forEach(k => { if (st.settings[k] === undefined) st.settings[k] = d.settings[k]; });
    let added = false; d.accounts.forEach(a => { if (!acct(st, a.id)) { st.accounts.push(a); added = true; } });
    if (added) st.accounts.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return st;
  };
  C.takeNumber = function (st, kind) {
    const P = { estimate: ['estPrefix', 'nextEstimate'], po: ['poPrefix', 'nextPO'], bill: ['billPrefix', 'nextBill'] }[kind]; const s = st.settings;
    const n = s[P[0]] + s[P[1]]; s[P[1]]++; return n;
  };
  C.fmtQty = q => { const s = (q / 1000).toFixed(3).replace(/\.?0+$/, ''); return s === '' ? '0' : s; }; // milli units to "1.5"
  C.checkLines = function (lines) {
    if (!Array.isArray(lines) || !lines.length) throw new Error('Add at least one line');
    lines.forEach((l, i) => { const q = l.q != null ? l.q : C.qtyToMilli(l.qty); if (isNaN(q) || q <= 0) throw new Error('Line ' + (i + 1) + ': quantity must be more than zero'); if (!Number.isInteger(l.unit)) throw new Error('Line ' + (i + 1) + ': unit price must be whole cents'); });
  };

  /* ---------- estimates and quotes (no posting until they become an invoice) ---------- */
  C.estimateExpiry = e => C.addDays(e.date, e.terms == null ? 30 : e.terms);
  C.estimateStatus = (e, asOf) => (e.status === 'sent' && asOf && C.estimateExpiry(e) < asOf) ? 'expired' : e.status;
  C.setEstimateStatus = function (st, id, status) {
    const e = find(st.estimates, id, 'estimate'); if (e.status === 'invoiced') throw new Error('This estimate is already invoiced');
    if (['draft', 'sent', 'accepted', 'declined'].indexOf(status) < 0) throw new Error('Unknown status'); e.status = status; return e;
  };
  C.estimateToInvoice = function (st, id, date) {
    const e = find(st.estimates, id, 'estimate'); if (e.status === 'invoiced') throw new Error('Already turned into an invoice'); if (e.status === 'declined') throw new Error('This estimate was declined');
    C.checkLines(e.lines);
    const inv = { id: C.nid(st, 'i'), clientId: e.clientId, date: date || C.today(), terms: st.settings.terms, lines: clone(e.lines), taxes: clone(e.taxes || []), notes: e.notes || '', status: 'draft', fromEstimate: e.id }; dk(inv, e);
    st.invoices.push(inv); e.status = 'invoiced'; e.invId = inv.id; return inv;
  };

  /* ---------- recurring invoices: a template that makes a draft or an issued invoice on each due date ---------- */
  C.scheduleFromInvoice = function (st, invId, o) {
    const inv = find(st.invoices, invId, 'invoice'); o = o || {}; if (!C.isDate(o.start)) throw new Error('Pick a start date');
    if (['weekly', 'monthly', 'quarterly', 'yearly'].indexOf(o.freq) < 0) throw new Error('Pick how often it repeats'); C.checkLines(inv.lines);
    const s = { id: C.nid(st, 's'), name: o.name || ((acctName(st, inv) || 'Invoice') + ' repeat'), clientId: inv.clientId, lines: clone(inv.lines), taxes: clone(inv.taxes || []), notes: inv.notes || '', terms: inv.terms, freq: o.freq, start: o.start, end: o.end || '', next: 0, active: true, auto: o.auto === 'issue' ? 'issue' : 'draft' }; dk(s, inv);
    st.schedules.push(s); return s;
  };
  function acctName(st, inv) { const c = st.clients.find(x => x.id === inv.clientId); return c ? c.name : ''; }
  C.scheduleTotal = s => C.invoiceTotals(s).total;
  C.runSchedules = function (st, today) {
    let drafts = 0, issued = 0, failed = 0; const lk = st.settings.lockDate;
    st.schedules.forEach(s => {
      if (!s.active) return; s.next = s.next || 0;
      for (let g = 0; g < 400; g++) {
        const d = C.recurDate(s, s.next); if (d > today || (s.end && d > s.end)) break;
        if (C.invoiceLimitReached(st)) break; // free trial: the schedule waits, nothing is skipped or lost
        s.next++; if (lk && d <= lk) continue;
        const inv = { id: C.nid(st, 'i'), clientId: s.clientId, date: d, terms: s.terms == null ? st.settings.terms : s.terms, lines: clone(s.lines), taxes: clone(s.taxes || []), notes: s.notes || '', status: 'draft', fromSchedule: s.id }; dk(inv, s);
        st.invoices.push(inv);
        if (s.auto === 'issue') { try { C.issueInvoice(st, inv.id); issued++; } catch (e) { failed++; drafts++; } } else drafts++;
      }
    });
    return { drafts, issued, failed, total: drafts + issued };
  };

  /* ---------- payment reminders and client statements ---------- */
  C.reminderStage = late => late <= 0 ? 0 : late <= 14 ? 1 : late <= 44 ? 2 : 3;
  C.overdueList = (st, asOf) => C.readScope(st, () => { const sc = C.scoped(st);
    return st.invoices.filter(i => i.status === 'issued' && C.balance(st, i) > 0 && C.dueDate(i) < asOf).map(i => {
      const late = C.daysBetween(C.dueDate(i), asOf), log = (sc.rem.get(i.id) || []).slice().sort(byDate);
      return { inv: i, client: sc.client.get(i.clientId) || { name: '?' }, late, balance: C.balanceH(st, i), stage: C.reminderStage(late), last: log.length ? log[log.length - 1] : null, count: log.length };
    }).sort((a, b) => b.late - a.late);
  });
  const REM = {
    en: {
      subj: ['', 'Friendly reminder: invoice {n}', 'Second notice: invoice {n} is {d} days past due', 'Final notice: invoice {n}'],
      body: ['', 'Hello {c},\n\nA quick reminder that invoice {n} for {a} was due on {due}. If it is already on its way, thank you, and please ignore this note.\n\nKind regards,\n{b}',
        'Hello {c},\n\nInvoice {n} for {a} is now {d} days past its due date of {due}. Could you let me know when payment will be made? I am happy to resend the invoice if that helps.\n\nThank you,\n{b}',
        'Hello {c},\n\nInvoice {n} for {a} is {d} days overdue (due {due}). Please arrange payment within 7 days, or contact me to agree a plan. After that I may need to pause further work.\n\nRegards,\n{b}']
    },
    es: {
      subj: ['', 'Recordatorio amable: factura {n}', 'Segundo aviso: la factura {n} lleva {d} días vencida', 'Aviso final: factura {n}'],
      body: ['', 'Hola {c}:\n\nLe recuerdo que la factura {n} por {a} venció el {due}. Si ya la ha pagado, muchas gracias y disculpe este mensaje.\n\nSaludos cordiales,\n{b}',
        'Hola {c}:\n\nLa factura {n} por {a} lleva {d} días vencida (vencimiento {due}). ¿Podría indicarme cuándo se realizará el pago? Con gusto le reenvío la factura si lo necesita.\n\nGracias,\n{b}',
        'Hola {c}:\n\nLa factura {n} por {a} lleva {d} días vencida (vencimiento {due}). Le ruego que la pague en los próximos 7 días o que me contacte para acordar un plan. Después de esa fecha podría tener que pausar el trabajo.\n\nAtentamente,\n{b}']
    }
  };
  C.reminderText = function (st, invId, stage, asOf, lang) {
    const inv = find(st.invoices, invId, 'invoice'), T = REM[lang === 'es' ? 'es' : 'en'], k = Math.min(3, Math.max(1, stage || 1));
    const c = st.clients.find(x => x.id === inv.clientId) || { name: '' }; const late = Math.max(0, C.daysBetween(C.dueDate(inv), asOf));
    const fill = s => s.replace(/\{n\}/g, inv.number).replace(/\{c\}/g, c.name).replace(/\{a\}/g, C.fmtDoc(inv, C.balance(st, inv))).replace(/\{due\}/g, C.dueDate(inv)).replace(/\{d\}/g, String(late)).replace(/\{b\}/g, st.settings.business || '');
    return { subject: fill(T.subj[k]), body: fill(T.body[k]), to: c.email || '' };
  };
  C.logReminder = function (st, invId, date, stage) { find(st.invoices, invId, 'invoice'); const r = { id: C.nid(st, 'n'), invId, date, stage }; st.reminders.push(r); return r; };
  C.statement = function (st, clientId, from, to) { // every receivable movement for one client, with a running balance
    const ids = new Set(st.invoices.filter(i => i.clientId === clientId).map(i => i.id)); let opening = 0; const rows = [];
    st.entries.slice().sort(byDate).forEach(e => {
      if (!ids.has(e.ref)) return; const ar = sum(e.lines.filter(l => l.a === C.AR), l => l.dr - l.cr); if (!ar) return;
      if (e.date < from) { opening += ar; return; } if (e.date > to) return;
      rows.push({ date: e.date, memo: e.memo, kind: e.kind, charge: ar > 0 ? ar : 0, credit: ar < 0 ? -ar : 0 });
    });
    let bal = opening; rows.forEach(r => { bal += r.charge - r.credit; r.balance = bal; });
    const ag = C.aging(st, to).rows.find(r => r.clientId === clientId) || null;
    return { clientId, from, to, opening, rows, closing: bal, aging: ag };
  };

  /* ---------- vendors, purchase orders, bills and payables ---------- */
  C.billTotals = b => C.invoiceTotals(b);
  C.billPaid = (st, id) => { const sc = C.scoped(st); return sc ? (sc.billPay.get(id) || 0) : sum(st.billPayments.filter(p => p.billId === id), p => p.amount); };
  C.billBalance = (st, b) => b.status === 'open' ? C.billTotals(b).total - C.billPaid(st, b.id) : 0;
  C.billDue = b => C.addDays(b.date, b.terms == null ? 30 : b.terms);
  C.billStatus = function (st, b, asOf) {
    if (b.status === 'draft' || b.status === 'void') return b.status;
    const bal = C.billBalance(st, b); if (bal <= 0) return 'paid'; if (asOf && C.billDue(b) < asOf) return 'overdue';
    return bal < C.billTotals(b).total ? 'partial' : 'open';
  };
  const itemOf = (st, id) => st.items.find(i => i.id === id);
  C.enterBill = function (st, id) {
    const b = find(st.bills, id, 'bill'); if (b.status !== 'draft') throw new Error('This bill is already entered');
    if (!st.vendors.some(v => v.id === b.vendorId)) throw new Error('Choose a vendor'); C.checkLines(b.lines);
    const t = C.billTotals(b); if (t.total <= 0) throw new Error('Bill total must be above zero');
    const lines = [], moves = [], hp = C.homeParts(st, b, t, 'buy');
    t.lines.forEach((l, i) => {
      const it = l.itemId && itemOf(st, l.itemId), a = it && it.track ? C.INV : l.acct, ac = acct(st, a), v = hp.lines[i];
      if (!ac || (ac.type !== 'expense' && a !== C.INV)) throw new Error('Bill lines go to an expense category or a stocked product');
      if (v > 0) lines.push({ a, dr: v }); else if (v < 0) lines.push({ a, cr: -v });
      if (it && it.track) moves.push({ itemId: it.id, q: l.q != null ? l.q : C.qtyToMilli(l.qty), value: v });
    });
    const txSum = hp.taxes.reduce((s, x) => s + x, 0); if (txSum > 0) lines.push({ a: C.taxAcct(b, 'buy'), dr: txSum }); else if (txSum < 0) lines.push({ a: C.taxAcct(b, 'buy'), cr: -txSum });
    lines.push({ a: C.AP, cr: hp.total });
    const number = st.settings.billPrefix + st.settings.nextBill, v = st.vendors.find(x => x.id === b.vendorId);
    const entry = C.post(st, { date: b.date, memo: 'Bill ' + number + ', ' + v.name + (b.ref ? ' (' + b.ref + ')' : ''), kind: 'bill', ref: b.id, lines: C.netLines(lines) });
    st.settings.nextBill++; // only after the entry posted, so a refused bill never burns a number
    moves.forEach(m => C.receiveStock(st, m.itemId, m.q, m.value));
    b.number = number; b.status = 'open'; b.entryId = entry.id; b.stock = moves; return b;
  };
  C.payBill = function (st, billId, date, amount, memo, opt) {
    const b = find(st.bills, billId, 'bill'); if (b.status !== 'open') throw new Error('Only entered bills can be paid');
    if (!(amount > 0)) throw new Error('Payment must be more than zero'); const bal = C.billBalance(st, b);
    if (amount > bal) throw new Error('Payment is more than the balance of ' + C.fmt(bal));
    const sx = C.settle(st, b, 'pay', amount, opt);
    const e = C.post(st, { date, memo: memo || 'Paid bill ' + b.number, kind: 'billpay', ref: b.id, lines: sx ? sx.lines : [{ a: C.AP, dr: amount }, { a: C.CASH, cr: amount }] });
    const p = Object.assign({ id: C.nid(st, 'q'), billId, date, amount, entryId: e.id }, sx ? sx.rec : {}); st.billPayments.push(p); return p;
  };
  C.removeBillPayment = function (st, pid) { const i = st.billPayments.findIndex(p => p.id === pid); if (i < 0) return false; C.removeEntry(st, st.billPayments[i].entryId); st.billPayments.splice(i, 1); return true; };
  C.voidBill = function (st, id, date) {
    const b = find(st.bills, id, 'bill'); if (b.status !== 'open') throw new Error('Only entered bills can be voided'); if (C.billPaid(st, id) > 0) throw new Error('Remove the payments first');
    const orig = st.entries.find(e => e.id === b.entryId);
    C.post(st, { date: date || b.date, memo: 'Void ' + b.number, kind: 'void', ref: b.id, lines: orig.lines.map(l => ({ a: l.a, dr: l.cr, cr: l.dr })) });
    (b.stock || []).forEach(m => { const it = itemOf(st, m.itemId); if (it) { it.onHand -= m.q; it.value -= m.value; } });
    b.status = 'void'; return b;
  };
  C.apAging = function (st, asOf) {
    const buckets = ['current', '1-30', '31-60', '61-90', '90+'], rows = {}, totals = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
    st.bills.forEach(b => {
      const bal = C.billBalanceH(st, b); if (bal <= 0 || b.date > asOf) return; const late = C.daysBetween(C.billDue(b), asOf);
      const k = late <= 0 ? 'current' : late <= 30 ? '1-30' : late <= 60 ? '31-60' : late <= 90 ? '61-90' : '90+';
      const r = rows[b.vendorId] || (rows[b.vendorId] = { vendorId: b.vendorId, current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0, bills: [] });
      r[k] += bal; r.total += bal; totals[k] += bal; totals.total += bal; r.bills.push({ id: b.id, number: b.number, due: C.billDue(b), late: Math.max(0, late), balance: bal, bucket: k });
    });
    return { buckets, rows: Object.values(rows), totals };
  };
  C.poToBill = function (st, poId, date) {
    const po = find(st.pos, poId, 'purchase order'); if (po.status === 'billed') throw new Error('Already turned into a bill'); if (po.status === 'cancelled') throw new Error('This order was cancelled');
    C.checkLines(po.lines); const v = st.vendors.find(x => x.id === po.vendorId);
    const b = { id: C.nid(st, 'b'), vendorId: po.vendorId, date: date || C.today(), terms: v && v.terms != null ? v.terms : 30, ref: '', lines: clone(po.lines), notes: po.notes || '', status: 'draft', fromPO: po.id };
    st.bills.push(b); po.status = 'billed'; po.billId = b.id; return b;
  };

  /* ---------- products and inventory (average cost; tracked stock posts cost of goods when invoiced) ---------- */
  C.addItem = function (st, o) {
    if (!o.name || !String(o.name).trim()) throw new Error('Give the product or service a name');
    const kind = o.kind === 'product' ? 'product' : 'service', track = kind === 'product' && !!o.track;
    const it = { id: C.nid(st, 't'), name: String(o.name).trim(), sku: o.sku || '', kind, price: o.price || 0, acct: o.acct || (kind === 'product' ? '4100' : '4000'), expAcct: o.expAcct || (kind === 'product' ? '6130' : '6040'), track, onHand: 0, value: 0, lastCost: o.cost || 0, reorder: o.reorder || 0, vendorId: o.vendorId || '' };
    if (!acct(st, it.acct) || acct(st, it.acct).type !== 'income') throw new Error('Pick an income category for sales');
    st.items.push(it);
    if (track && o.qty > 0) {
      const value = C.roundDiv(o.qty * (o.cost || 0), 1000);
      if (value > 0) C.post(st, { date: o.date || C.today(), memo: 'Opening stock: ' + it.name, kind: 'stock', ref: it.id, lines: [{ a: C.INV, dr: value }, { a: C.OPENING, cr: value }] });
      it.onHand = o.qty; it.value = value;
    }
    return it;
  };
  C.receiveStock = function (st, itemId, q, value) { const it = itemOf(st, itemId); if (!it) return; it.onHand += q; it.value += value; if (q > 0 && value > 0) it.lastCost = C.roundDiv(value * 1000, q); };
  C.takeStock = function (st, itemId, q) { // returns the cost of q (milli units) at average cost, and lowers stock
    const it = itemOf(st, itemId); if (!it || q <= 0) return 0; let cost;
    if (it.onHand > 0 && q <= it.onHand) cost = C.roundDiv(it.value * q, it.onHand);
    else if (it.onHand > 0) cost = it.value + C.roundDiv((q - it.onHand) * it.lastCost, 1000);
    else cost = C.roundDiv(q * it.lastCost, 1000);
    it.onHand -= q; it.value -= cost; return cost;
  };
  C.itemAvgCost = it => it.onHand > 0 ? C.roundDiv(it.value * 1000, it.onHand) : it.lastCost;
  C.adjustStock = function (st, itemId, counted, date, memo) { // counted: milli units actually on the shelf
    const it = find(st.items, itemId, 'product'); if (!it.track) throw new Error('This product does not track stock');
    if (!Number.isInteger(counted) || counted < 0) throw new Error('Enter the counted quantity'); const diff = counted - it.onHand; if (!diff) return null;
    let value; if (diff < 0) value = -C.takeStock(st, itemId, -diff); else { value = C.roundDiv(diff * it.lastCost, 1000); C.receiveStock(st, itemId, diff, value); }
    if (!value) return null;
    return C.post(st, { date: date || C.today(), memo: memo || 'Stock count: ' + it.name, kind: 'stock', ref: it.id, lines: value > 0 ? [{ a: C.INV, dr: value }, { a: C.COGS, cr: value }] : [{ a: C.COGS, dr: -value }, { a: C.INV, cr: -value }] });
  };
  C.lowStock = st => st.items.filter(i => i.track && i.reorder > 0 && i.onHand <= i.reorder);
  C.inventoryValue = st => sum(st.items.filter(i => i.track), i => i.value);
  C.reorderPO = function (st, vendorId, date) { // a draft purchase order for low-stock products
    const low = C.lowStock(st).filter(i => !vendorId || !i.vendorId || i.vendorId === vendorId); if (!low.length) throw new Error('Nothing is below its reorder level');
    if (!st.vendors.some(v => v.id === vendorId)) throw new Error('Choose a vendor');
    const po = { id: C.nid(st, 'o'), number: C.takeNumber(st, 'po'), vendorId, date: date || C.today(), terms: 7, notes: '', status: 'draft',
      lines: low.map(i => ({ desc: i.name + (i.sku ? ' (' + i.sku + ')' : ''), qty: C.fmtQty(Math.max(i.reorder * 2 - i.onHand, i.reorder)), unit: i.lastCost, acct: i.expAcct, itemId: i.id })) };
    st.pos.push(po); return po;
  };
  const issue0 = C.issueInvoice, void0 = C.voidInvoice;
  C.issueInvoice = function (st, id) { // revenue as before, then cost of goods for stocked products
    const inv = issue0(st, id); delete inv.stock; delete inv.cogsEntryId; const moves = []; let cogs = 0;
    inv.lines.forEach(l => { const it = l.itemId && itemOf(st, l.itemId); if (!it || !it.track) return; const q = l.q != null ? l.q : C.qtyToMilli(l.qty); if (!(q > 0)) return; const c = C.takeStock(st, it.id, q); moves.push({ itemId: it.id, q, cost: c }); cogs += c; });
    if (cogs) inv.cogsEntryId = C.post(st, { date: inv.date, memo: 'Cost of goods, ' + inv.number, kind: 'cogs', ref: inv.id, lines: cogs > 0 ? [{ a: C.COGS, dr: cogs }, { a: C.INV, cr: cogs }] : [{ a: C.INV, dr: -cogs }, { a: C.COGS, cr: -cogs }] }).id;
    if (moves.length) inv.stock = moves; return inv;
  };
  C.voidInvoice = function (st, id, date) {
    const inv = void0(st, id, date);
    if (inv.cogsEntryId) { const e = st.entries.find(x => x.id === inv.cogsEntryId); if (e) C.post(st, { date: date || inv.date, memo: 'Void cost of goods, ' + inv.number, kind: 'void', ref: inv.id, lines: e.lines.map(l => ({ a: l.a, dr: l.cr, cr: l.dr })) }); }
    (inv.stock || []).forEach(m => { const it = itemOf(st, m.itemId); if (it) { it.onHand += m.q; it.value += m.cost; } });
    return inv;
  };

  /* ---------- time tracking to invoice ---------- */
  C.parseDuration = function (s) { // "1:30", "1.5", "90m", "2h", "1h 15m" -> minutes
    s = String(s == null ? '' : s).trim().toLowerCase(); let m;
    if ((m = /^(\d+):([0-5]?\d)$/.exec(s))) return +m[1] * 60 + +m[2];
    if ((m = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?$/.exec(s)) && (m[1] || m[2])) return Math.round((+m[1] || 0) * 60) + (+m[2] || 0);
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);
    return NaN;
  };
  C.fmtMinutes = n => Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  C.addTime = function (st, o) {
    if (!st.clients.some(c => c.id === o.clientId)) throw new Error('Choose a client'); if (!C.isDate(o.date)) throw new Error('Pick a valid date');
    if (!Number.isInteger(o.minutes) || o.minutes <= 0 || o.minutes > 24 * 60) throw new Error('Time must be between 1 minute and 24 hours');
    if (!Number.isInteger(o.rate) || o.rate < 0) throw new Error('Rate must be zero or more');
    const t = { id: C.nid(st, 'h'), clientId: o.clientId, date: o.date, minutes: o.minutes, desc: (o.desc || '').trim(), rate: o.rate, billable: o.billable !== false, invId: '' };
    st.time.push(t); return t;
  };
  C.timeBilled = (st, t) => { if (!t.invId) return false; const sc = C.scoped(st); if (sc) { const i = sc.inv.get(t.invId); return !!i && i.status !== 'void'; } return st.invoices.some(i => i.id === t.invId && i.status !== 'void'); };
  C.unbilledTime = (st, clientId) => C.readScope(st, () => st.time.filter(t => t.billable && (!clientId || t.clientId === clientId) && !C.timeBilled(st, t)).sort(byDate));
  C.billMinutes = (m, step) => step > 1 ? Math.ceil(m / step) * step : m;
  C.timeValue = (t, step) => C.roundDiv(C.roundDiv(C.billMinutes(t.minutes, step) * 1000, 60) * t.rate, 1000);
  C.invoiceTime = function (st, clientId, ids, date) {
    let list = C.unbilledTime(st, clientId); if (ids) list = list.filter(t => ids.indexOf(t.id) >= 0); if (!list.length) throw new Error('No unbilled time for this client');
    const step = st.settings.timeRound || 1;
    const inv = { id: C.nid(st, 'i'), clientId, date: date || C.today(), terms: st.settings.terms, status: 'draft', notes: '', taxes: [], fromTime: true,
      lines: list.map(t => ({ desc: t.date + ' ' + (t.desc || 'Time'), qty: C.fmtQty(C.roundDiv(C.billMinutes(t.minutes, step) * 1000, 60)), unit: t.rate, acct: '4000' })) };
    st.invoices.push(inv); list.forEach(t => { t.invId = inv.id; }); return inv;
  };
  C.timerMinutes = (startMs, nowMs) => Math.max(1, Math.round((nowMs - startMs) / 60000));

  /* ---------- sales tax by rate ---------- */
  C.salesTaxReport = function (st, from, to) {
    const rows = {}; let taxable = 0, exempt = 0;
    st.invoices.filter(i => i.status === 'issued' && i.date >= from && i.date <= to).forEach(i => {
      if (i.taxMode) return; const t = C.homeTotals(i); if (t.taxes.length) taxable += t.subtotal; else exempt += t.subtotal;
      t.taxes.forEach(x => { const k = x.name + '|' + x.bps; const r = rows[k] || (rows[k] = { name: x.name, bps: x.bps, sales: 0, tax: 0, invoices: 0 }); r.sales += t.subtotal; r.tax += x.amount; r.invoices++; });
    });
    const list = Object.values(rows).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.bps - b.bps);
    const remitted = sum(st.entries.filter(e => e.kind === 'taxremit' && e.date >= from && e.date <= to), e => sum(e.lines.filter(l => l.a === C.SALESTAX), l => l.dr));
    const owed = -(C.trialBalance(st, to).balances[C.SALESTAX] || 0);
    return { from, to, rows: list, taxableSales: taxable, exemptSales: exempt, collected: sum(list, r => r.tax), remitted, owed };
  };
  C.remitSalesTax = function (st, date, amount, memo) {
    if (!(amount > 0)) throw new Error('Payment must be more than zero');
    return C.post(st, { date, memo: memo || 'Sales tax payment', kind: 'taxremit', lines: [{ a: C.SALESTAX, dr: amount }, { a: C.CASH, cr: amount }] });
  };

  /* ---------- budgets vs actuals ---------- */
  C.spread = function (total) { const base = Math.trunc(total / 12), r = total - base * 12; return Array.from({ length: 12 }, (_, i) => base + (i < Math.abs(r) ? Math.sign(r) : 0)); };
  C.setBudget = function (st, year, acctId, months) {
    const a = acct(st, acctId); if (!a || (a.type !== 'income' && a.type !== 'expense')) throw new Error('Budgets are for income and expense categories');
    if (!Array.isArray(months) || months.length !== 12 || !months.every(Number.isInteger)) throw new Error('A budget needs 12 monthly amounts in cents');
    const i = st.budgets.findIndex(b => b.year === year && b.acct === acctId);
    if (months.every(m => m === 0)) { if (i >= 0) st.budgets.splice(i, 1); return null; }
    const b = { id: i >= 0 ? st.budgets[i].id : C.nid(st, 'g'), year, acct: acctId, months: months.slice() }; if (i >= 0) st.budgets[i] = b; else st.budgets.push(b); return b;
  };
  C.budgetVsActual = function (st, year, through) { // through: last month counted (1-12)
    through = Math.min(12, Math.max(1, through || 12)); const from = year + '-01-01', to = C.addDays(C.addMonths(year + '-' + String(through).padStart(2, '0') + '-01', 1), -1);
    const pl = C.profitLoss(st, from, to), actual = {}; pl.income.concat(pl.expenses).forEach(x => { actual[x.acct] = x.amount; });
    const ids = new Set(st.budgets.filter(b => b.year === year).map(b => b.acct).concat(Object.keys(actual)));
    const rows = st.accounts.filter(a => ids.has(a.id) && (a.type === 'income' || a.type === 'expense')).map(a => {
      const b = st.budgets.find(x => x.year === year && x.acct === a.id), budget = b ? sum(b.months.slice(0, through), m => m) : 0, act = actual[a.id] || 0;
      return { acct: a.id, name: a.name, type: a.type, budget, annual: b ? sum(b.months, m => m) : 0, actual: act, variance: a.type === 'income' ? act - budget : budget - act, pct: budget ? Math.round(act * 100 / budget) : null };
    });
    const tot = t => ({ budget: sum(rows.filter(r => r.type === t), r => r.budget), actual: sum(rows.filter(r => r.type === t), r => r.actual) });
    const inc = tot('income'), exp = tot('expense');
    return { year, through, from, to, rows, income: inc, expenses: exp, net: { budget: inc.budget - exp.budget, actual: inc.actual - exp.actual } };
  };

  /* ---------- cash-flow forecast: open invoices and bills by due date, recurring expenses and recurring invoices ---------- */
  C.forecast = function (st, today, weeks, opt) { // opt (what-if): {delay, billDelay, skipClient, extra:[{date, amount, label, kind}]}
    opt = opt || {}; weeks = weeks || 13; const end = C.addDays(today, weeks * 7 - 1), cashIds = st.accounts.filter(a => a.cash).map(a => a.id);
    const tb = C.trialBalance(st, today), start = sum(cashIds, id => tb.balances[id] || 0), ev = [];
    st.invoices.forEach(i => { if (opt.skipClient && i.clientId === opt.skipClient) return; const bal = C.balanceH(st, i); if (bal > 0) { const due = C.dueDate(i); ev.push({ date: C.addDays(due < today ? today : due, opt.delay || 0), amount: bal, label: 'Invoice ' + i.number, kind: 'invoice', late: due < today }); } });
    st.bills.forEach(b => { const bal = C.billBalanceH(st, b); if (bal > 0) { const due = C.billDue(b); ev.push({ date: C.addDays(due < today ? today : due, opt.billDelay || 0), amount: -bal, label: 'Bill ' + b.number, kind: 'bill', late: due < today }); } });
    st.recurring.forEach(r => { if (!r.active) return; for (let k = r.next || 0, g = 0; g < 400; k++, g++) { const d = C.recurDate(r, k); if (d > end || (r.end && d > r.end)) break; if (d > today) ev.push({ date: d, amount: -r.amount, label: r.name, kind: 'recurring' }); } });
    st.schedules.forEach(s => { if (!s.active || (opt.skipClient && s.clientId === opt.skipClient)) return; const tot = C.scheduleTotal(s); for (let k = s.next || 0, g = 0; g < 400; k++, g++) { const d = C.recurDate(s, k); if (s.end && d > s.end) break; const paid = C.addDays(d, s.terms == null ? st.settings.terms : s.terms); if (paid > end) break; if (paid >= today) ev.push({ date: paid, amount: tot, label: s.name, kind: 'schedule' }); } });
    (opt.extra || []).forEach(x => { if (x.date >= today && x.date <= end) ev.push(x); });
    ev.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    let bal = start; const rows = [];
    for (let w = 0; w < weeks; w++) {
      const f = C.addDays(today, w * 7), t = C.addDays(f, 6), inW = ev.filter(e => e.date >= f && e.date <= t);
      const inflow = sum(inW.filter(e => e.amount > 0), e => e.amount), outflow = -sum(inW.filter(e => e.amount < 0), e => e.amount); bal += inflow - outflow;
      rows.push({ from: f, to: t, inflow, outflow, net: inflow - outflow, balance: bal });
    }
    const low = rows.reduce((m, r) => r.balance < m.balance ? r : m, { from: today, balance: start }); // today counts too
    return { start, end, weeks: rows, events: ev, low, finish: bal };
  };

  /* ---------- balance sheet and year-end close ---------- */
  C.balanceSheet = function (st, asOf) {
    const tb = C.trialBalance(st, asOf), ys = asOf.slice(0, 4) + '-01-01', prior = C.trialBalance(st, C.addDays(ys, -1));
    const pl = (b) => -sum(st.accounts.filter(a => a.type === 'income' || a.type === 'expense'), a => b.balances[a.id] || 0);
    const pick = (t, sign) => st.accounts.filter(a => a.type === t && tb.balances[a.id]).map(a => ({ acct: a.id, name: a.name, amount: sign * tb.balances[a.id] }));
    const assets = pick('asset', 1), liabilities = pick('liability', -1), equity = pick('equity', -1);
    const retained = pl(prior), current = pl(tb) - retained;
    const totalAssets = sum(assets, x => x.amount), totalLiabilities = sum(liabilities, x => x.amount), totalEquity = sum(equity, x => x.amount) + retained + current;
    return { asOf, assets, liabilities, equity, retained, current, totalAssets, totalLiabilities, totalEquity, balanced: totalAssets === totalLiabilities + totalEquity };
  };
  C.closeYear = function (st, year, today) {
    const d = year + '-12-31'; if (st.settings.lockDate && st.settings.lockDate >= d) throw new Error(year + ' is already closed');
    if (today && d >= today) throw new Error('Close a year only after it has ended');
    if (!C.trialBalance(st, d).balanced) throw new Error('The books do not balance; restore a backup before closing');
    const drafts = st.invoices.filter(i => i.status === 'draft' && i.date <= d).length + st.bills.filter(b => b.status === 'draft' && b.date <= d).length;
    const pl = C.profitLoss(st, year + '-01-01', d), bs = C.balanceSheet(st, d);
    const rec = { id: C.nid(st, 'y'), year, closedOn: today || C.today(), net: pl.net, assets: bs.totalAssets, drafts };
    st.closings.push(rec); st.settings.lockDate = d; return rec;
  };
  C.reopenYear = function (st, year) {
    const d = year + '-12-31'; if (!st.settings.lockDate || st.settings.lockDate < d) throw new Error(year + ' is not closed');
    st.closings = st.closings.filter(c => c.year < year); const prev = st.closings.map(c => c.year + '-12-31').sort().pop();
    st.settings.lockDate = prev || ''; return st.settings.lockDate;
  };

  /* ---------- accountant package: CSV files in common column layouts, zipped (store method, no compression) ---------- */
  const bom = s => '﻿' + s;
  C.generalLedgerCSV = function (st, from, to) {
    const rows = [['Account', 'Account name', 'Type', 'Date', 'Entry', 'Memo', 'Debit', 'Credit', 'Balance']], tb = C.trialBalance(st, C.addDays(from, -1)), ents = st.entries.filter(e => e.date >= from && e.date <= to).sort(byDate);
    st.accounts.forEach(a => {
      let bal = tb.balances[a.id] || 0; const mine = []; ents.forEach(e => e.lines.forEach(l => { if (l.a === a.id) mine.push([e, l]); })); if (!mine.length && !bal) return;
      rows.push([a.id, a.name, a.type, from, '', 'Opening balance', '', '', money(bal)]);
      mine.forEach(([e, l]) => { bal += l.dr - l.cr; rows.push([a.id, a.name, a.type, e.date, e.id, e.memo, l.dr ? money(l.dr) : '', l.cr ? money(l.cr) : '', money(bal)]); });
    });
    return C.toCSV(rows);
  };
  C.trialBalanceCSV = function (st, asOf) { const tb = C.trialBalance(st, asOf), rows = [['Account', 'Account name', 'Type', 'Debit', 'Credit']]; st.accounts.forEach(a => { const v = tb.balances[a.id]; if (v) rows.push([a.id, a.name, a.type, v > 0 ? money(v) : '', v < 0 ? money(-v) : '']); }); rows.push(['', 'Totals', '', money(tb.debits), money(tb.credits)]); return C.toCSV(rows); };
  C.accountsCSV = st => C.toCSV([['Account', 'Account name', 'Type', 'Schedule C line (guide)', 'Deductible percent']].concat(st.accounts.map(a => [a.id, a.name, a.type, a.sc || '', a.type === 'expense' ? (a.pct || 100) : ''])));
  C.balanceSheetCSV = function (st, asOf) {
    const b = C.balanceSheet(st, asOf), rows = [['Section', 'Account', 'Account name', 'Amount']];
    b.assets.forEach(x => rows.push(['Assets', x.acct, x.name, money(x.amount)])); rows.push(['Assets', '', 'Total assets', money(b.totalAssets)]);
    b.liabilities.forEach(x => rows.push(['Liabilities', x.acct, x.name, money(x.amount)])); rows.push(['Liabilities', '', 'Total liabilities', money(b.totalLiabilities)]);
    b.equity.forEach(x => rows.push(['Equity', x.acct, x.name, money(x.amount)])); rows.push(['Equity', '', 'Retained earnings (prior years)', money(b.retained)], ['Equity', '', 'Current year earnings', money(b.current)], ['Equity', '', 'Total equity', money(b.totalEquity)]);
    return C.toCSV(rows);
  };
  C.profitLossCSV = function (st, from, to) { const p = C.profitLoss(st, from, to), rows = [['Section', 'Account', 'Account name', 'Amount']]; p.income.forEach(x => rows.push(['Income', x.acct, x.name, money(x.amount)])); p.expenses.forEach(x => rows.push(['Expenses', x.acct, x.name, money(x.amount)])); rows.push(['', '', 'Net profit', money(p.net)]); return C.toCSV(rows); };
  C.receivablesCSV = function (st, asOf) { const rows = [['Invoice', 'Client', 'Due', 'Days late', 'Bucket', 'Balance']]; C.aging(st, asOf).rows.forEach(r => { const c = st.clients.find(x => x.id === r.clientId); r.invoices.forEach(i => rows.push([i.number, c ? c.name : '', i.due, i.late, i.bucket, money(i.balance)])); }); return C.toCSV(rows); };
  C.payablesCSV = function (st, asOf) { const rows = [['Bill', 'Vendor', 'Due', 'Days late', 'Bucket', 'Balance']]; C.apAging(st, asOf).rows.forEach(r => { const v = st.vendors.find(x => x.id === r.vendorId); r.bills.forEach(b => rows.push([b.number, v ? v.name : '', b.due, b.late, b.bucket, money(b.balance)])); }); return C.toCSV(rows); };
  C.billsCSV = function (st, from, to) { const rows = [['Bill', 'Vendor reference', 'Date', 'Due', 'Vendor', 'Status', 'Total', 'Paid', 'Balance']]; st.bills.filter(b => b.status !== 'draft' && b.date >= from && b.date <= to).forEach(b => { const v = st.vendors.find(x => x.id === b.vendorId); rows.push([b.number, b.ref || '', b.date, C.billDue(b), v ? v.name : '', C.billStatus(st, b, to), money(C.billTotals(b).total), money(C.billPaid(st, b.id)), money(C.billBalance(st, b))]); }); return C.toCSV(rows); };
  C.salesTaxCSV = function (st, from, to) { const r = C.salesTaxReport(st, from, to), rows = [['Tax', 'Rate percent', 'Invoices', 'Taxable sales', 'Tax collected']]; r.rows.forEach(x => rows.push([x.name, (x.bps / 100).toFixed(2), x.invoices, money(x.sales), money(x.tax)])); rows.push(['Exempt or untaxed sales', '', '', money(r.exemptSales), ''], ['Paid to tax agencies in period', '', '', '', money(r.remitted)], ['Owed at period end', '', '', '', money(r.owed)]); return C.toCSV(rows); };
  C.inventoryCSV = st => C.toCSV([['SKU', 'Product', 'On hand', 'Average cost', 'Value', 'Reorder at']].concat(st.items.filter(i => i.track).map(i => [i.sku, i.name, C.fmtQty(i.onHand), money(C.itemAvgCost(i)), money(i.value), C.fmtQty(i.reorder)])));
  C.timeCSV = function (st, from, to) { const rows = [['Date', 'Client', 'Description', 'Hours', 'Rate', 'Value', 'Billable', 'Invoiced']]; st.time.filter(t => t.date >= from && t.date <= to).sort(byDate).forEach(t => { const c = st.clients.find(x => x.id === t.clientId), i = st.invoices.find(x => x.id === t.invId); rows.push([t.date, c ? c.name : '', t.desc, (t.minutes / 60).toFixed(2), money(t.rate), money(C.timeValue(t, 1)), t.billable ? 'yes' : 'no', i && i.status !== 'void' ? (i.number || 'draft') : '']); }); return C.toCSV(rows); };
  C.accountantFiles = function (st, from, to, generated) {
    const f = (name, text) => ({ name, data: bom(text) });
    const files = [
      f('journal.csv', C.journalCSV(st, from, to)), f('general-ledger.csv', C.generalLedgerCSV(st, from, to)), f('trial-balance.csv', C.trialBalanceCSV(st, to)), f('chart-of-accounts.csv', C.accountsCSV(st)),
      f('profit-and-loss.csv', C.profitLossCSV(st, from, to)), f('balance-sheet.csv', C.balanceSheetCSV(st, to)), f('schedule-c-guide.csv', C.scheduleCCSV(st, from, to)),
      f('invoices.csv', C.invoicesCSV(st, from, to)), f('open-receivables.csv', C.receivablesCSV(st, to)), f('bills.csv', C.billsCSV(st, from, to)), f('open-payables.csv', C.payablesCSV(st, to)),
      f('sales-tax.csv', C.salesTaxCSV(st, from, to)), f('inventory.csv', C.inventoryCSV(st)), f('mileage.csv', C.mileageCSV(st, from, to)), f('time.csv', C.timeCSV(st, from, to))
    ];
    if (C.vatCSV && (st.settings.taxMode === 'vat' || st.invoices.concat(st.bills).some(d => d.taxMode === 'vat'))) files.push(f('vat-gst-summary.csv', C.vatCSV(st, from, to)));
    const tb = C.trialBalance(st, to);
    files.unshift({ name: 'README.txt', data: ['Stark Ledger ' + C.VERSION + ' accountant package', 'Business: ' + (st.settings.business || '(not set)'), 'Period: ' + from + ' to ' + to, 'Generated: ' + (generated || C.today()),
      'Basis: accrual (invoices count as income when issued, bills as expenses when entered).', 'Books balanced at period end: ' + (tb.balanced ? 'yes' : 'NO'), 'Books closed through: ' + (st.settings.lockDate || 'not closed'),
      'Money is in ' + (C.homeCur ? C.homeCur() : 'USD') + ' (the home currency of these books) with two decimals. CSV files are UTF-8 with a byte-order mark so spreadsheet programs read accents correctly.',
      'Schedule C lines are a guide only. This package is bookkeeping data, not tax advice.', ''].join('\r\n') });
    return files;
  };
  let CRC = null;
  C.crc32 = function (u8) {
    if (!CRC) { CRC = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; } }
    let c = -1; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0;
  };
  C.zipStore = function (files, date) {
    const enc = new TextEncoder(), d = date || '2026-01-01', dosDate = ((+d.slice(0, 4) - 1980) << 9) | (+d.slice(5, 7) << 5) | +d.slice(8, 10), parts = [], central = []; let off = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = C.crc32(data);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      parts.push(new Uint8Array(lh.buffer), name, data); central.push(new Uint8Array(ch.buffer), name); off += 30 + name.length + data.length;
    });
    const cd = central.reduce((s, p) => s + p.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd, true); end.setUint32(16, off, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]), out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let p = 0; all.forEach(a => { out.set(a, p); p += a.length; }); return out;
  };

  /* ---------- separate books (one encrypted database each) ---------- */
  C.bookDb = id => id ? 'stark-ledger-' + id : 'stark-ledger';
  C.parseBooks = function (json) {
    let a; try { a = JSON.parse(json); } catch (e) { return []; } if (!Array.isArray(a)) return [];
    const seen = {}; return a.filter(b => b && typeof b.id === 'string' && /^b\d{1,6}$/.test(b.id) && typeof b.label === 'string' && !seen[b.id] && (seen[b.id] = 1)).map(b => ({ id: b.id, label: b.label.slice(0, 60) }));
  };
  C.newBookId = books => 'b' + (books.reduce((m, b) => Math.max(m, +b.id.slice(1) || 0), 1) + 1);

  /* ---------- quick search across the books ---------- */
  C.search = function (st, q, limit) {
    q = String(q || '').trim().toLowerCase(); if (!q) return []; const out = [], cents = C.toCents(q), amt = !isNaN(cents) && /\d/.test(q) ? Math.abs(cents) : null;
    const hit = s => String(s || '').toLowerCase().indexOf(q) >= 0, party = (list, id) => (list.find(x => x.id === id) || { name: '' }).name;
    st.clients.forEach(c => { if (hit(c.name) || hit(c.email)) out.push({ kind: 'client', label: c.name, sub: c.email || '', hash: '#/statement/' + c.id }); });
    st.vendors.forEach(v => { if (hit(v.name) || hit(v.email)) out.push({ kind: 'vendor', label: v.name, sub: v.email || '', hash: '#/vendors' }); });
    st.items.forEach(i => { if (hit(i.name) || hit(i.sku)) out.push({ kind: 'item', label: i.name, sub: (i.sku ? i.sku + ', ' : '') + C.fmt(i.price), hash: '#/items' }); });
    const doc = (list, kind, route, partyList, partyKey, total) => list.forEach(d => { const p = party(partyList, d[partyKey]), t = total(d);
      if (hit(d.number) || hit(p) || hit(d.ref) || d.lines.some(l => hit(l.desc)) || (amt != null && t === amt)) out.push({ kind, label: (d.number || 'Draft') + ' ' + p, sub: C.fmt(t) + ', ' + d.date, hash: route + d.id }); });
    doc(st.invoices, 'invoice', '#/invoice/', st.clients, 'clientId', d => C.invoiceTotals(d).total); doc(st.estimates, 'estimate', '#/estimate/', st.clients, 'clientId', d => C.invoiceTotals(d).total);
    doc(st.bills, 'bill', '#/bill/', st.vendors, 'vendorId', d => C.billTotals(d).total); doc(st.pos, 'po', '#/po/', st.vendors, 'vendorId', d => C.billTotals(d).total);
    st.entries.slice().sort(byDate).reverse().forEach(e => { if (out.length > 200) return; const v = e.lines.reduce((s, l) => s + l.dr, 0); if (hit(e.memo) || (amt != null && e.lines.some(l => l.dr === amt))) out.push({ kind: 'entry', label: e.memo || '(no memo)', sub: e.date + ', ' + C.fmt(v), hash: '#/transactions/' + encodeURIComponent(e.memo ? q : '') }); });
    return out.slice(0, limit || 30);
  };

  root.StarkCore = C; if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
