/* Stark Ledger. Views: dashboard, transactions, receipts, clients, invoices, receivables. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, S = window.StarkStore;
  const R = L.routes;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const signCls = v => v < 0 ? 'neg' : v > 0 ? 'pos' : '';
  const dateInput = v => L.input({ type: 'date', value: v || C.today() });
  const parseMoney = (s, what) => { const c = C.toCents(s); if (isNaN(c)) throw new Error(what + ' is not a valid amount'); return c; };
  const guard = fn => ev => { try { fn(ev); } catch (e) { L.toast(e.message, true); } };
  const guardAsync = fn => async ev => { try { await fn(ev); } catch (e) { L.toast(e.message, true); } };

  /* ---------- receipts (encrypted images) ---------- */
  L.attachReceipt = async function (entryId, file) {
    if (!/^image\//.test(file.type)) throw new Error('Receipts must be image files (photo or scan).');
    if (file.size > 12 * 1024 * 1024) throw new Error('That image is over 12 MB. Shrink it first.');
    let bytes = new Uint8Array(await file.arrayBuffer()), mime = file.type; const id = 'r' + C.b64(crypto.getRandomValues(new Uint8Array(9))).replace(/[+/=]/g, 'x');
    const small = await shrinkImage(file); if (small && small.length < bytes.length) { bytes = small; mime = 'image/jpeg'; }
    const used = L.st.receipts.reduce((s, r) => s + (r.size || 0), 0); if (used + bytes.length > C.MAX_RECEIPTS_TOTAL) throw new Error('Receipts are limited to ' + Math.round(C.MAX_RECEIPTS_TOTAL / 1048576) + ' MB in total so one backup file can hold them all. Delete some old receipts first.');
    await S.putReceipt(id, bytes);
    L.st.receipts.push({ id, entryId, name: file.name, mime, size: bytes.length, added: C.today() }); L.save();
  };
  /* photos over 2.5 MB are redrawn at most 2400 px on the long side as JPEG (quality 0.88): still clearly legible, a fraction of the size */
  async function shrinkImage(file) {
    if (file.size <= 2.5 * 1024 * 1024 || typeof createImageBitmap !== 'function' || /gif|svg/.test(file.type)) return null;
    try { const bmp = await createImageBitmap(file), k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); if (bmp.close) bmp.close(); const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.88)); return blob ? new Uint8Array(await blob.arrayBuffer()) : null; } catch (e) { return null; }
  }
  L.viewReceipt = async function (rec) {
    const bytes = await S.getReceipt(rec.id); const url = URL.createObjectURL(new Blob([bytes], { type: rec.mime }));
    const close = L.modal(rec.name, c => h('div', { class: 'stack' }, h('img', { class: 'receipt-img', src: url, alt: 'Receipt ' + rec.name }), h('p', { class: 'muted small' }, 'Stored encrypted in this browser. Decrypted only while this window is open.'), h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: c }, 'Close'))), true);
    L.$('#dlg').addEventListener('close', () => URL.revokeObjectURL(url), { once: true }); return close;
  };
  L.deleteReceipt = async function (rec) { await S.delReceipt(rec.id); L.st.receipts = L.st.receipts.filter(r => r.id !== rec.id); L.commit(); };
  function receiptPicker(entryId, onDone) {
    const f = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', 'aria-label': 'Choose receipt image', onchange: guardAsync(async () => { if (f.files[0]) { await L.attachReceipt(entryId, f.files[0]); L.toast('Receipt saved, encrypted.'); onDone && onDone(); } }) });
    return f;
  }

  /* ---------- dashboard ---------- */
  R.dashboard = function () {
    const st = L.st, t = C.today(), y = t.slice(0, 4); const [from, to] = [y + '-01-01', y + '-12-31'];
    const pl = C.profitLoss(st, from, to), tb = C.trialBalance(st), ag = C.aging(st, t);
    const overdue = ag.totals['1-30'] + ag.totals['31-60'] + ag.totals['61-90'] + ag.totals['90+'];
    const card = (k, v, cls, sub) => h('div', { class: 'card stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v), sub ? h('div', { class: 'sub' }, sub) : null);
    const months = []; for (let i = 5; i >= 0; i--) { const m = C.addMonths(t.slice(0, 8) + '01', -i); const e = C.addDays(C.addMonths(m, 1), -1); const p = C.profitLoss(st, m, e); months.push({ label: MONTHS[+m.slice(5, 7) - 1], inc: p.totalIncome, exp: p.totalExpenses }); }
    const max = Math.max(1, ...months.map(m => Math.max(m.inc, m.exp)));
    const bars = h('div', { class: 'bars', role: 'img', 'aria-label': 'Income and expenses for the last six months' }, months.map(m => h('div', { class: 'bargrp' }, h('div', { class: 'pair' }, h('div', { class: 'bar inc', style: 'height:' + Math.round(m.inc / max * 100) + '%', title: 'Income ' + C.fmt(m.inc) }), h('div', { class: 'bar exp', style: 'height:' + Math.round(m.exp / max * 100) + '%', title: 'Expenses ' + C.fmt(m.exp) })), h('div', { class: 'lab' }, m.label))));
    const recent = st.entries.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0).slice(0, 8);
    const od = C.overdueList(st, t), billsDue = st.bills.filter(b => C.billBalance(st, b) > 0 && C.billDue(b) <= C.addDays(t, 7)), low = C.lowStock(st), unb = C.unbilledTime(st), waiting = st.estimates.filter(e => C.estimateStatus(e, t) === 'sent'), drafts = st.invoices.filter(i => i.status === 'draft');
    const todo = [od.length && [od.length + ' overdue invoice(s) to chase', '#/reminders'], billsDue.length && [billsDue.length + ' bill(s) due within 7 days', '#/bills'], low.length && [low.length + ' product(s) at or below reorder level', '#/items'],
      unb.length && [C.fmt(unb.reduce((s, x) => s + C.timeValue(x, st.settings.timeRound), 0)) + ' of unbilled time', '#/time'], waiting.length && [waiting.length + ' estimate(s) awaiting an answer', '#/estimates'], drafts.length && [drafts.length + ' draft invoice(s)', '#/invoices']].filter(Boolean);
    const todoCard = h('div', { class: 'card', id: 'todo' }, h('h2', null, 'To do'), todo.length ? h('ul', { class: 'todo' }, todo.map(x => h('li', null, h('a', { href: x[1] }, x[0])))) : h('p', { class: 'muted' }, 'Nothing needs you right now.'));
    return h('div', { class: 'stack' },
      h('div', { class: 'page-head' }, h('h1', null, 'Dashboard'), h('div', { class: 'row' },
        h('button', { class: 'btn primary', id: 'add-in', onclick: () => addMoneyDialog('in') }, '+ Money in'), h('button', { class: 'btn', id: 'add-out', onclick: () => addMoneyDialog('out') }, '+ Money out'), h('a', { class: 'btn', href: '#/invoice/new' }, 'New invoice'))),
      h('div', { class: 'grid4' }, card('Cash in checking', C.fmt(tb.balances[C.CASH] || 0), signCls(tb.balances[C.CASH] || 0), 'all time'), card('Income ' + y, C.fmt(pl.totalIncome), 'pos'), card('Expenses ' + y, C.fmt(pl.totalExpenses)), card('Net profit ' + y, C.fmt(pl.net), signCls(pl.net), 'before any tax')),
      h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('h2', null, 'Last six months'), bars, h('div', { class: 'legend' }, h('span', null, h('i', { class: 'sw inc' }), 'Income'), h('span', null, h('i', { class: 'sw exp' }), 'Expenses'))),
        h('div', { class: 'card' }, h('h2', null, 'Owed to you'), h('div', { class: 'v big' }, C.fmt(ag.totals.total)), h('p', { class: overdue ? 'neg' : 'muted' }, overdue ? C.fmt(overdue) + ' is past due.' : 'Nothing is past due.'), h('a', { class: 'btn', href: '#/receivables' }, 'Aged receivables'))),
      todoCard,
      h('div', { class: 'card' }, h('h2', null, 'Recent activity'), recent.length ? txnTable(recent, true) : h('p', { class: 'muted' }, 'Nothing yet. Add money in or out, or import a bank CSV.')),
      L.guide('Stark Ledger keeps your books on this computer, encrypted. It is bookkeeping software, not tax, legal or accounting advice.'));
  };

  /* ---------- transactions ---------- */
  function summarize(e) {
    const st = L.st, cash = e.lines.filter(l => l.a === C.CASH);
    if (cash.length) return { amount: cash.reduce((s, l) => s + l.dr - l.cr, 0), cat: e.lines.filter(l => l.a !== C.CASH).map(l => C.account(st, l.a).name).join(', ') };
    return { amount: e.lines.reduce((s, l) => s + l.dr, 0), cat: e.lines.map(l => C.account(st, l.a).name).join(' / '), noncash: true };
  }
  function txnTable(list, compact) {
    const st = L.st; const rows = [];
    list.forEach(e => {
      const s = summarize(e); const rc = st.receipts.filter(r => r.entryId === e.id); const can = ['simple', 'csv', 'recurring', 'manual'].includes(e.kind);
      const det = h('tr', { class: 'journal', hidden: true }, h('td', { colspan: compact ? 4 : 6 }, h('table', { class: 'tbl mini' }, h('thead', null, h('tr', null, h('th', null, 'Account'), h('th', { class: 'num' }, 'Debit'), h('th', { class: 'num' }, 'Credit'))),
        h('tbody', null, e.lines.map(l => h('tr', null, h('td', null, l.a + ' ' + C.account(st, l.a).name), L.num(l.dr ? C.fmt(l.dr) : ''), L.num(l.cr ? C.fmt(l.cr) : '')))))));
      const tog = h('button', { class: 'btn ghost sm', 'aria-expanded': 'false', 'aria-label': 'Show journal lines', onclick: ev => { det.hidden = !det.hidden; ev.currentTarget.setAttribute('aria-expanded', String(!det.hidden)); } }, '⋯');
      const cells = [h('td', null, e.date), h('td', null, e.memo || '(no memo)', e.kind !== 'simple' ? h('span', { class: 'tag' }, e.kind) : null), h('td', null, s.cat), L.num(C.fmt(s.amount), s.noncash ? 'muted' : signCls(s.amount))];
      if (!compact) {
        const file = receiptPicker(e.id, () => L.render());
        cells.push(h('td', { class: 'acts' }, rc.map(r => h('button', { class: 'btn ghost sm', 'aria-label': 'View receipt ' + r.name, onclick: guardAsync(() => L.viewReceipt(r)) }, '🧾')), h('button', { class: 'btn ghost sm attach', onclick: () => file.click() }, '+ receipt'), file));
        cells.push(h('td', { class: 'acts' }, tog, can ? h('button', { class: 'btn ghost sm del', 'aria-label': 'Delete entry', onclick: () => L.confirm('Delete this entry and its receipts?', 'Delete', async () => { for (const r of rc) await L.deleteReceipt(r); C.removeEntry(st, e.id); L.commit(); }, true) }, '🗑') : null));
      }
      rows.push(h('tr', null, cells)); if (!compact) rows.push(det);
    });
    return L.table(compact ? ['Date', 'Description', 'Category', { t: 'Amount', cls: 'num' }] : ['Date', 'Description', 'Category', { t: 'Amount', cls: 'num' }, 'Receipts', ''], rows, 'txns');
  }
  function addMoneyDialog(kind) {
    L.modal(kind === 'in' ? 'Money in' : 'Money out', close => {
      let k = kind; const date = dateInput(), amt = L.moneyInput(null, { id: 'm-amt' }), memo = L.input({ placeholder: 'What was it for?', id: 'm-memo' }); let cat = L.select(L.cats(k), k === 'in' ? '4000' : '6090', { id: 'm-cat' });
      const file = h('input', { type: 'file', accept: 'image/*', id: 'm-file' }); const catWrap = h('div');
      const setKind = nk => { k = nk; L.clear(catWrap); cat = L.select(L.cats(k), k === 'in' ? '4000' : '6090', { id: 'm-cat' }); catWrap.appendChild(L.field('Category', cat, k === 'out' ? 'Schedule C lines are a guide only.' : null)); };
      setKind(kind);
      return h('form', { class: 'stack', onsubmit: guardAsync(async ev => { ev.preventDefault();
        const e = C.addMoney(L.st, { date: date.value, kind: k, amount: parseMoney(amt.value, 'Amount'), acct: cat.value, memo: memo.value.trim() });
        if (file.files[0]) await L.attachReceipt(e.id, file.files[0]); close(); L.commit(); L.toast('Saved.'); }) },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Direction' }, ['in', 'out'].map(x => h('label', null, h('input', { type: 'radio', name: 'dir', value: x, checked: x === kind, onchange: () => setKind(x) }), h('span', null, x === 'in' ? 'Money in' : 'Money out')))),
      h('div', { class: 'grid2' }, L.field('Date', date), L.field('Amount ($)', amt)), catWrap, L.field('Memo', memo), L.field('Receipt image (optional)', file, 'Encrypted with your passphrase before it is stored.'),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', id: 'm-save' }, 'Save')));
    });
  }
  L.addMoneyDialog = addMoneyDialog;
  R.transactions = function (preset) {
    const st = L.st; const q = L.input({ type: 'search', placeholder: 'Search memo or category', id: 'tx-q', 'aria-label': 'Search', value: preset ? decodeURIComponent(preset) : '' }); const yr = L.select([['all', 'All years']].concat([...new Set(st.entries.map(e => e.date.slice(0, 4)).concat([C.today().slice(0, 4)]))].sort().reverse().map(y => [y, y])), 'all', { id: 'tx-year', 'aria-label': 'Year' });
    const kindSel = L.select([['all', 'Everything'], ['cash', 'Bank only'], ['simple', 'Added by hand'], ['csv', 'Imported'], ['invoice', 'Invoices'], ['payment', 'Payments']], 'all', { id: 'tx-kind', 'aria-label': 'Type' });
    const out = h('div'); const draw = () => {
      const t = q.value.trim().toLowerCase(); let list = st.entries.filter(e => (yr.value === 'all' || e.date.startsWith(yr.value)) && (kindSel.value === 'all' || (kindSel.value === 'cash' ? e.lines.some(l => l.a === C.CASH) : e.kind === kindSel.value)));
      if (t) list = list.filter(e => (e.memo + ' ' + summarize(e).cat).toLowerCase().includes(t));
      list.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1)); const shown = list.slice(0, 300);
      L.clear(out).appendChild(h('div', null, shown.length ? txnTable(shown) : h('p', { class: 'muted' }, 'No entries match.'), list.length > 300 ? h('p', { class: 'muted' }, 'Showing the newest 300 of ' + list.length + '. Narrow the filters.') : null));
    };
    [q, yr, kindSel].forEach(x => x.addEventListener('input', draw)); draw();
    const tb = C.trialBalance(st);
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, 'Transactions'), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => addMoneyDialog('in') }, '+ Money in'), h('button', { class: 'btn', onclick: () => addMoneyDialog('out') }, '+ Money out'))),
      h('div', { class: 'card' }, h('div', { class: 'filters' }, q, yr, kindSel), out),
      h('p', { class: 'muted small' }, 'Under the hood every entry is double-entry: tap ⋯ to see the debits and credits. Books balanced: ', h('b', { class: tb.balanced ? 'pos' : 'neg' }, tb.balanced ? 'yes (' + C.fmt(tb.debits) + ' in debits and credits)' : 'NO, please restore a backup')));
  };

  /* ---------- receipts ---------- */
  R.receipts = function () {
    const st = L.st, eById = new Map(st.entries.map(e => [e.id, e])), list = st.receipts.slice().reverse(), row = r => { const e = eById.get(r.entryId);
      return h('tr', null, h('td', null, r.added), h('td', null, r.name), h('td', null, e ? (e.date + ' ' + e.memo) : '(entry deleted)'), L.num((r.size / 1024).toFixed(0) + ' KB'), h('td', { class: 'acts' }, h('button', { class: 'btn sm', onclick: guardAsync(() => L.viewReceipt(r)) }, 'View'), h('button', { class: 'btn sm danger', onclick: () => L.confirm('Delete this receipt image?', 'Delete', () => L.deleteReceipt(r), true) }, 'Delete'))); };
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, 'Receipts')),
      h('p', { class: 'muted' }, 'Receipt images are encrypted with your passphrase (AES-GCM, key from PBKDF2) before they are saved in this browser. Attach them from the Transactions page.'),
      h('div', { class: 'card' }, list.length ? L.lazyTable(['Added', 'File', 'Transaction', { t: 'Size', cls: 'num' }, ''], list, row) : h('p', { class: 'muted' }, 'No receipts yet.')));
  };

  /* ---------- clients ---------- */
  function clientDialog(c) {
    L.modal(c ? 'Edit client' : 'New client', close => {
      const n = L.input({ value: c ? c.name : '', id: 'c-name', required: true }), e = L.input({ value: c ? c.email : '', type: 'email', id: 'c-email' }), a = h('textarea', { rows: 3, id: 'c-addr' }, c ? c.address : ''), note = L.input({ value: c ? c.notes : '' }), tn = L.input({ value: c ? c.taxNo || '' : '', id: 'c-taxno', maxlength: 40 });
      return h('form', { class: 'stack', onsubmit: guard(ev => { ev.preventDefault(); if (!n.value.trim()) throw new Error('Give the client a name.');
        const rec = c || { id: C.nid(L.st, 'c') }; Object.assign(rec, { name: n.value.trim(), email: e.value.trim(), address: a.value.trim(), notes: note.value.trim(), taxNo: tn.value.trim() }); if (!c) L.st.clients.push(rec); close(); L.commit(); }) },
      L.field('Name', n), L.field('Email', e), L.field('Billing address', a), L.field('Tax number (optional, printed on their invoices)', tn), L.field('Notes', note), h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', id: 'c-save' }, 'Save')));
    });
  }
  R.clients = function () {
    const st = L.st, byClient = new Map(); st.invoices.forEach(i => { if (i.status === 'draft') return; if (!byClient.has(i.clientId)) byClient.set(i.clientId, []); byClient.get(i.clientId).push(i); });
    const used = new Set(); ['invoices', 'estimates', 'time', 'schedules'].forEach(k => st[k].forEach(i => used.add(i.clientId)));
    const list = st.clients.slice().sort((a, b) => a.name.localeCompare(b.name)), row = c => { const invs = byClient.get(c.id) || []; const billed = invs.reduce((s, i) => s + C.totalH(i), 0); const owed = invs.reduce((s, i) => s + C.balanceH(st, i), 0);
      return h('tr', null, h('td', null, h('b', null, c.name), c.email ? h('div', { class: 'muted small' }, c.email) : null), L.num(String(invs.length)), L.num(C.fmt(billed)), L.num(C.fmt(owed), owed ? 'neg' : ''), h('td', { class: 'acts' }, h('a', { class: 'btn sm', href: '#/invoice/new/' + c.id }, 'Invoice'), h('a', { class: 'btn sm', href: '#/statement/' + c.id }, 'Statement'),h('button', { class: 'btn sm', onclick: () => clientDialog(c) }, 'Edit'), h('button', { class: 'btn sm danger', onclick: () => { if (used.has(c.id)) return L.toast('This client has invoices, estimates or time, so it can not be deleted.', true); L.confirm('Delete ' + c.name + '?', 'Delete', () => { st.clients = st.clients.filter(x => x !== c); L.commit(); }, true); } }, 'Delete'))); };
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, 'Clients'), h('button', { class: 'btn primary', id: 'new-client', onclick: () => clientDialog() }, '+ New client')),
      h('div', { class: 'card' }, list.length ? L.lazyTable(['Client', { t: 'Invoices', cls: 'num' }, { t: 'Billed', cls: 'num' }, { t: 'Owes', cls: 'num' }, ''], list, row) : h('p', { class: 'muted' }, 'Add your first client to start invoicing.')));
  };

  /* ---------- invoices ---------- */
  const STATUS_CHIP = { draft: '', open: 'blue', partial: 'amber', overdue: 'red', paid: 'green', void: 'dim' };
  R.invoices = function () {
    const st = L.st, t = C.today(); const sel = L.select([['all', 'All'], ['draft', 'Draft'], ['open', 'Open'], ['partial', 'Partly paid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['void', 'Void']], 'all', { id: 'inv-filter', 'aria-label': 'Status filter' });
    const out = h('div'); const draw = () => C.readScope(st, () => { const list = st.invoices.slice().reverse().filter(i => sel.value === 'all' || C.invoiceStatus(st, i, t) === sel.value);
      L.clear(out).appendChild(list.length ? L.lazyTable(['Number', 'Client', 'Date', 'Due', { t: 'Total', cls: 'num' }, { t: 'Balance', cls: 'num' }, 'Status'], list, i => { const c = L.client(i.clientId), s = C.invoiceStatus(st, i, t), tot = C.invoiceTotals(i).total;
        return h('tr', { class: 'clickable', onclick: () => L.go('#/invoice/' + i.id) }, h('td', null, h('a', { href: '#/invoice/' + i.id }, i.number || 'Draft')), h('td', null, c ? c.name : '?'), h('td', null, i.date), h('td', null, C.dueDate(i)), L.num(C.fmtDoc(i, tot)), L.num(i.status === 'issued' ? C.fmtDoc(i, C.balance(st, i)) : ''), h('td', null, L.chip(s, STATUS_CHIP[s]))); }) : h('p', { class: 'muted' }, 'No invoices here yet.')); });
    sel.addEventListener('input', draw); draw();
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, 'Invoices'), h('a', { class: 'btn primary', id: 'new-invoice', href: '#/invoice/new' }, '+ New invoice')), h('div', { class: 'card' }, h('div', { class: 'filters' }, sel), out));
  };

  /* ---------- documents: invoices, estimates, bills and purchase orders share one editor and one printable paper ---------- */
  const DOCS = L.DOCS = {
    invoice: { coll: 'invoices', pk: 'clientId', party: 'clients', acctType: 'income', defAcct: '4000', taxes: true, dateLbl: 'Invoice date', termsLbl: 'Terms (days)', newT: 'New invoice', editT: 'Edit draft', back: '#/invoices', route: '#/invoice/', title: 'INVOICE', partyK: 'Bill to', endK: 'Due', idp: 'i' },
    estimate: { coll: 'estimates', pk: 'clientId', party: 'clients', acctType: 'income', defAcct: '4000', taxes: true, dateLbl: 'Estimate date', termsLbl: 'Valid for (days)', newT: 'New estimate', editT: 'Edit estimate', back: '#/estimates', route: '#/estimate/', title: 'ESTIMATE', partyK: 'Prepared for', endK: 'Valid until', idp: 'k' },
    bill: { coll: 'bills', pk: 'vendorId', party: 'vendors', acctType: 'expense', defAcct: '6130', taxes: false, dateLbl: 'Bill date', termsLbl: 'Terms (days)', newT: 'New bill', editT: 'Edit draft bill', back: '#/bills', route: '#/bill/', title: 'BILL', partyK: 'From', endK: 'Due', idp: 'b' },
    po: { coll: 'pos', pk: 'vendorId', party: 'vendors', acctType: 'expense', defAcct: '6130', taxes: false, dateLbl: 'Order date', termsLbl: 'Expected in (days)', newT: 'New purchase order', editT: 'Edit purchase order', back: '#/bills/pos', route: '#/po/', title: 'PURCHASE ORDER', partyK: 'Order from', endK: 'Expected', idp: 'o' }
  };
  L.partyOf = (kind, doc) => L.st[DOCS[kind].party].find(p => p.id === doc[DOCS[kind].pk]) || { name: '?' };
  L.docEnd = doc => C.addDays(doc.date, doc.terms == null ? 30 : doc.terms);
  const vatKind = kind => kind !== 'po' && L.st.settings.taxMode === 'vat';
  const defRate = () => { const r = C.vatRates(L.st)[0]; return L.st.settings.taxMode === 'vat' && r ? { tname: r.name, tbps: r.bps } : { tname: '', tbps: 0 }; };
  function blankDoc(kind, party) {
    const s = L.st.settings, K = DOCS[kind], v = K.party === 'vendors' && party ? L.st.vendors.find(x => x.id === party) : null;
    const vat = vatKind(kind);
    return { party: party || '', date: C.today(), terms: kind === 'estimate' ? 30 : kind === 'po' ? 7 : (v && v.terms != null ? v.terms : s.terms), ref: '', lines: [Object.assign({ desc: '', qty: '1', unitStr: '', acct: (v && v.defAcct) || K.defAcct }, defRate())], taxes: K.taxes && !vat ? s.taxes.map(t => ({ name: t.name, bps: t.bps })) : [], notes: '',
      vat, incl: !!s.taxIncl, round: s.taxRound === 'doc' ? 'doc' : 'line', cur: '', fxStr: '' };
  }
  function editor(kind, id, preset) {
    const st = L.st, K = DOCS[kind], list = st[K.coll], existing = id ? list.find(i => i.id === id) : null;
    const vatEx = existing && (existing.taxMode === 'vat' || (!existing.taxMode && existing.status === 'draft' && vatKind(kind))); // a draft opened after VAT / GST mode was switched on becomes a VAT draft
    const d = existing ? { party: existing[K.pk], date: existing.date, terms: existing.terms, ref: existing.ref || '', lines: existing.lines.map(l => ({ desc: l.desc, qty: l.qty, unitStr: (l.unit / 100).toFixed(2), acct: l.acct, itemId: l.itemId, tname: l.tname != null ? l.tname : defRate().tname, tbps: l.tbps != null ? l.tbps : defRate().tbps })), taxes: vatEx ? [] : (existing.taxes || []).map(t => ({ name: t.name, bps: t.bps })), notes: existing.notes || '',
      vat: !!vatEx, incl: existing.taxMode === 'vat' ? !!existing.incl : !!L.st.settings.taxIncl, round: existing.taxMode === 'vat' ? (existing.round === 'doc' ? 'doc' : 'line') : (L.st.settings.taxRound === 'doc' ? 'doc' : 'line'), cur: existing.fx ? existing.cur || '' : '', fxStr: existing.fx ? C.fmtRate(existing.fx) : '' } : blankDoc(kind, preset);
    const acctOpts = st.accounts.filter(a => a.type === K.acctType).map(a => [a.id, a.name]), vend = K.party === 'vendors';
    const clientSel = L.select([['', vend ? 'Choose a vendor' : 'Choose a client']].concat(st[K.party].map(c => [c.id, c.name])), d.party, { id: 'i-client' }); clientSel.onchange = () => { d.party = clientSel.value; const v = kind === 'bill' && st.vendors.find(x => x.id === d.party); if (v && v.terms != null) { d.terms = v.terms; terms.value = String(v.terms); upd(); } };
    const date = dateInput(d.date), terms = L.input({ type: 'number', min: 0, max: 365, value: String(d.terms), id: 'i-terms' }); date.id = 'i-date'; date.oninput = () => { d.date = date.value; upd(); }; terms.oninput = () => { d.terms = Math.max(0, parseInt(terms.value, 10) || 0); upd(); };
    const ref = L.input({ value: d.ref, id: 'i-ref', placeholder: 'Their invoice number' }); ref.oninput = () => { d.ref = ref.value; };
    const linesBody = h('tbody'), totals = h('div', { class: 'totals' }), taxBox = h('div', { class: 'stack' }), dueTxt = h('span', { class: 'muted' });
    const foreign = () => !!d.cur && d.cur !== C.homeCur(), fxNow = () => (foreign() ? C.parseRate(d.fxStr) : NaN), fm = c => (foreign() ? C.fmtIn(d.cur, c) : C.fmt(c));
    const docObj = () => Object.assign({ lines: d.lines.map(l => ({ desc: l.desc, qty: l.qty, unit: isNaN(C.toCents(l.unitStr)) ? 0 : C.toCents(l.unitStr), acct: l.acct, tname: l.tname, tbps: l.tbps })).map(l => Object.assign(l, { q: isNaN(C.qtyToMilli(l.qty)) ? 0 : undefined })), taxes: d.vat ? [] : d.taxes }, d.vat ? { taxMode: 'vat', incl: d.incl, round: d.round } : {}, foreign() && fxNow() > 0 ? { cur: d.cur, fx: fxNow() } : {});
    const calc = () => C.invoiceTotals(docObj());
    function upd() {
      const t = calc(); L.clear(totals);
      totals.appendChild(h('div', null, h('span', null, d.vat ? 'Net amount' : 'Subtotal'), h('b', null, fm(t.subtotal)))); t.taxes.forEach(x => totals.appendChild(h('div', null, h('span', null, x.name + ' (' + (x.bps / 100) + '%)'), h('b', null, fm(x.amount))))); totals.appendChild(h('div', { class: 'grand' }, h('span', null, d.vat && d.incl ? 'Total (includes tax)' : 'Total'), h('b', null, fm(t.total))));
      if (foreign() && fxNow() > 0) totals.appendChild(h('div', { class: 'home-eq', id: 'home-eq' }, h('span', null, 'Booked in ' + C.homeCur() + ' at ' + C.fmtRate(fxNow())), h('b', null, C.fmt(C.homeTotals(docObj()).total))));
      dueTxt.textContent = C.isDate(d.date) ? K.endK + ' ' + L.docEnd({ date: d.date, terms: d.terms }) : '';
      t.lines.forEach((l, i) => { const row = linesBody.children[i], c = row && row.querySelector('.amt'), x = row && row.querySelector('.ltx'); if (c) c.textContent = fm(l.amount); if (x) x.textContent = fm(l.taxAmt || 0); });
    }
    function drawLines() {
      L.clear(linesBody); d.lines.forEach((l, i) => {
        const it = l.itemId && st.items.find(x => x.id === l.itemId);
        const desc = L.input({ value: l.desc, placeholder: 'Description', 'aria-label': 'Description', class: 'ld' }), qty = L.input({ value: l.qty, inputmode: 'decimal', placeholder: 'Qty', 'aria-label': 'Quantity', class: 'lq' }), unit = L.input({ value: l.unitStr, inputmode: 'decimal', placeholder: vend ? 'Unit cost' : 'Unit price', 'aria-label': 'Unit price', class: 'lu' }), cat = L.select(acctOpts, l.acct, { 'aria-label': vend ? 'Expense category' : 'Income category' });
        desc.oninput = () => { l.desc = desc.value; }; qty.oninput = () => { l.qty = qty.value; upd(); }; unit.oninput = () => { l.unitStr = unit.value; upd(); }; cat.onchange = () => { l.acct = cat.value; };
        const rateOpts = [['|0', 'No tax']].concat(C.vatRates(st).map(r => [r.name + '|' + r.bps, r.name + ' ' + (r.bps / 100) + '%'])); if (l.tname && !rateOpts.some(o => o[0] === l.tname + '|' + l.tbps)) rateOpts.push([l.tname + '|' + l.tbps, l.tname + ' ' + (l.tbps / 100) + '%']);
        const rate = d.vat ? L.select(rateOpts, (l.tname || '') + '|' + (l.tbps | 0), { 'aria-label': 'Tax rate', class: 'lr' }) : null; if (rate) rate.onchange = () => { const k = rate.value.lastIndexOf('|'); l.tname = rate.value.slice(0, k); l.tbps = parseInt(rate.value.slice(k + 1), 10) || 0; upd(); };
        linesBody.appendChild(h('tr', null, h('td', null, desc, it ? h('span', { class: 'tag' }, it.track ? 'stock' : 'item') : null), h('td', null, qty), h('td', null, unit), d.vat ? h('td', null, rate) : null, h('td', null, vend && it && it.track ? h('span', { class: 'muted small' }, 'Inventory') : cat), d.vat ? h('td', { class: 'num ltx' }, '') : null, h('td', { class: 'num amt' }, ''), h('td', null, h('button', { type: 'button', class: 'btn ghost sm', 'aria-label': 'Remove line', onclick: () => { if (d.lines.length > 1) { d.lines.splice(i, 1); drawLines(); } } }, '✕'))));
      }); upd();
    }
    const pick = st.items.length ? L.select([['', '+ Add from products and services']].concat(st.items.map(i => [i.id, i.name + (i.sku ? ' (' + i.sku + ')' : '') + (i.track ? ', ' + C.fmtQty(i.onHand) + ' in stock' : '')])), '', { id: 'i-item', 'aria-label': 'Add a product or service' }) : null;
    if (pick) pick.onchange = () => { const it = st.items.find(x => x.id === pick.value); pick.value = ''; if (!it) return; const ln = Object.assign({ desc: it.name, qty: '1', unitStr: ((vend ? it.lastCost : it.price) / 100).toFixed(2), acct: vend ? it.expAcct : it.acct, itemId: it.id }, defRate());
      if (d.lines.length === 1 && !d.lines[0].desc && !d.lines[0].unitStr) d.lines[0] = ln; else d.lines.push(ln); drawLines(); };
    function drawTaxes() {
      L.clear(taxBox); d.taxes.forEach((t, i) => taxBox.appendChild(h('div', { class: 'row' }, h('span', null, t.name + ' ' + (t.bps / 100) + '%'), h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { d.taxes.splice(i, 1); drawTaxes(); } }, 'Remove'))));
      const nm = L.input({ placeholder: 'Tax name', 'aria-label': 'Tax name', id: 'tax-name' }), rt = L.input({ placeholder: 'Rate %', inputmode: 'decimal', 'aria-label': 'Tax rate percent', id: 'tax-rate' });
      taxBox.appendChild(h('div', { class: 'row' }, nm, rt, h('button', { type: 'button', class: 'btn sm', id: 'tax-add', onclick: guard(() => { const b = C.pctToBps(rt.value); if (!nm.value.trim() || isNaN(b)) throw new Error('Enter a tax name and a rate such as 8.25.'); d.taxes.push({ name: nm.value.trim(), bps: b }); drawTaxes(); }) }, 'Add tax line'))); upd();
    }
    const notes = h('textarea', { rows: 3, id: 'i-notes', placeholder: vend ? 'Notes' : 'Notes shown on the document' }, d.notes); notes.oninput = () => { d.notes = notes.value; };
    function save() {
      if (!d.party) throw new Error(vend ? 'Choose a vendor.' : 'Choose a client.'); if (!C.isDate(d.date)) throw new Error('Pick a valid date.');
      if (foreign() && !(fxNow() > 0)) throw new Error('Type the exchange rate, for example 1.0842. Nothing is looked up for you.');
      const lines = d.lines.filter(l => l.desc.trim() || l.unitStr.trim()).map((l, i) => { const u = C.toCents(l.unitStr), q = C.qtyToMilli(l.qty); if (isNaN(u)) throw new Error('Line ' + (i + 1) + ': unit price is not a number.'); if (isNaN(q) || q <= 0) throw new Error('Line ' + (i + 1) + ': quantity must be more than zero.'); if (!l.desc.trim()) throw new Error('Line ' + (i + 1) + ': add a description.'); return Object.assign({ desc: l.desc.trim(), qty: l.qty.trim(), unit: u, acct: l.acct }, l.itemId ? { itemId: l.itemId } : {}, d.vat ? { tname: l.tname || 'No tax', tbps: l.tbps | 0 } : {}); });
      if (!lines.length) throw new Error('Add at least one line.');
      const rec = existing || { id: C.nid(st, K.idp), status: 'draft' }; rec[K.pk] = d.party; Object.assign(rec, { date: d.date, terms: d.terms, lines, taxes: d.vat ? [] : d.taxes.map(t => ({ name: t.name, bps: t.bps })), notes: d.notes.trim() });
      if (d.vat) Object.assign(rec, { taxMode: 'vat', incl: !!d.incl, round: d.round }); else { delete rec.taxMode; delete rec.incl; delete rec.round; }
      if (foreign()) { rec.cur = d.cur; rec.fx = fxNow(); } else { delete rec.cur; delete rec.fx; }
      if (kind === 'bill') rec.ref = d.ref.trim(); if ((kind === 'estimate' || kind === 'po') && !rec.number) rec.number = C.takeNumber(st, kind);
      if (!existing) list.push(rec); return rec;
    }
    const done = (r, msg) => { L.save(); L.go(K.route + r.id); L.toast(msg); };
    const second = { invoice: ['Issue invoice', r => { C.issueInvoice(st, r.id); done(r, 'Issued as ' + r.number); }], estimate: ['Save and mark sent', r => { C.setEstimateStatus(st, r.id, 'sent'); done(r, 'Saved as ' + r.number); }],
      bill: ['Enter bill', r => { C.enterBill(st, r.id); done(r, 'Entered as ' + r.number); }], po: ['Save and mark sent', r => { r.status = 'sent'; done(r, 'Saved as ' + r.number); }] }[kind];
    const curOpts = [['', 'Home currency (' + C.homeCur() + ')']].concat(C.CURRENCIES.filter(c => c[0] !== C.homeCur()).map(c => [c[0], c[0] + ' ' + c[1]])); if (d.cur && !curOpts.some(o => o[0] === d.cur)) curOpts.push([d.cur, d.cur]);
    const curSel = L.select(curOpts, d.cur, { id: 'i-cur', 'aria-label': 'Document currency' }), fxIn = L.input({ value: d.fxStr, id: 'i-fx', inputmode: 'decimal', placeholder: '1.0000', 'aria-label': 'Exchange rate' }), fxBox = h('div', { class: 'stack', id: 'fx-box' });
    const showFx = () => { L.clear(fxBox); if (foreign()) fxBox.appendChild(L.field('1 ' + d.cur + ' = ? ' + C.homeCur(), fxIn, 'You type this rate. Nothing is looked up, so it stays on this computer and on this document.')); upd(); };
    curSel.onchange = () => { d.cur = curSel.value; showFx(); }; fxIn.oninput = () => { d.fxStr = fxIn.value; upd(); };
    const inclSel = L.select([['excl', 'Prices exclude tax (tax is added)'], ['incl', 'Prices include tax (tax is inside)']], d.incl ? 'incl' : 'excl', { id: 'i-incl', 'aria-label': 'Prices and tax' }), roundSel = L.select([['line', 'Round the tax on each line'], ['doc', 'Round the tax once per rate']], d.round, { id: 'i-round', 'aria-label': 'Tax rounding' });
    inclSel.onchange = () => { d.incl = inclSel.value === 'incl'; upd(); }; roundSel.onchange = () => { d.round = roundSel.value; upd(); };
    const opts = (d.vat || kind !== 'po') ? h('div', { class: 'grid3 doc-opts', id: 'doc-opts' }, d.vat ? L.field('Prices', inclSel) : null, d.vat ? L.field('Tax rounding', roundSel) : null, kind !== 'po' ? L.field('Currency', curSel) : null) : null;
    drawLines(); drawTaxes(); showFx();
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, existing ? K.editT : K.newT), h('a', { class: 'btn', href: K.back }, 'Back')),
      h('div', { class: 'card stack' }, h('div', { class: kind === 'bill' ? 'grid4' : 'grid3' }, L.field(vend ? 'Vendor' : 'Client', clientSel, st[K.party].length ? null : (vend ? 'Add a vendor first on the Vendors page.' : 'Add a client first on the Clients page.')), L.field(K.dateLbl, date), L.field(K.termsLbl, terms, dueTxt), kind === 'bill' ? L.field("Vendor's invoice number", ref) : null),
        opts, fxBox, d.vat ? h('p', { class: 'muted small', id: 'vat-note' }, C.TAX_NOTE) : null,
        h('div', { class: 'scroll' }, h('table', { class: 'tbl lines' }, h('thead', null, h('tr', null, ['Description', 'Qty', vend ? 'Unit cost' : 'Unit price'].concat(d.vat ? ['Tax rate'] : [], [vend ? 'Expense category' : 'Income category'], d.vat ? ['Tax'] : [], ['Amount', '']).map(x => h('th', { class: x === 'Amount' || x === 'Tax' ? 'num' : '' }, x)))), linesBody)),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn sm', id: 'add-line', onclick: () => { d.lines.push(Object.assign({ desc: '', qty: '1', unitStr: '', acct: K.defAcct }, defRate())); drawLines(); } }, '+ Add line'), pick),
        h('div', { class: 'grid2' }, h('div', { class: 'stack' }, K.taxes && !d.vat ? h('h3', null, 'Tax lines') : null, K.taxes && !d.vat ? taxBox : null, L.field('Notes', notes)), totals),
        h('div', { class: 'row end' }, h('button', { class: 'btn', id: 'save-draft', onclick: guard(() => { const r = save(); done(r, 'Draft saved.'); }) }, 'Save draft'),
          h('button', { class: 'btn primary', id: 'issue', onclick: guard(() => second[1](save())) }, second[0]))));
  }
  L.docEditor = editor;

  function paper(inv, kind) {
    kind = kind || 'invoice'; const st = L.st, s = st.settings, K = DOCS[kind], c = L.partyOf(kind, inv), t = C.invoiceTotals(inv), vat = inv.taxMode === 'vat', foreign = C.isForeign(inv), fm = x => C.fmtDoc(inv, x);
    const paid = kind === 'invoice' ? C.paid(st, inv.id) : kind === 'bill' ? C.billPaid(st, inv.id) : 0, bal = kind === 'invoice' ? C.balance(st, inv) : kind === 'bill' ? C.billBalance(st, inv) : 0, live = inv.status === 'issued' || (kind === 'bill' && inv.status === 'open');
    const lines = h('div'); (s.address || '').split('\n').forEach(x => lines.appendChild(h('div', null, x)));
    const addr = h('div'); (c.address || '').split('\n').forEach(x => addr.appendChild(h('div', null, x)));
    const termed = kind === 'invoice' || kind === 'bill', pct = b => (b / 100) + '%';
    const head = vat ? ['Description', 'Qty', inv.incl ? 'Unit price (with tax)' : 'Unit price', 'Net', 'Tax rate', 'Tax', 'Total'] : ['Description', 'Qty', kind === 'po' || kind === 'bill' ? 'Unit cost' : 'Unit price', 'Amount'];
    const body = t.lines.map(l => vat ? h('tr', null, h('td', null, l.desc), L.num(l.qty), L.num(fm(l.unit)), L.num(fm(l.net)), L.num(l.tname + ' ' + pct(l.tbps)), L.num(fm(l.taxAmt)), L.num(fm(l.gross))) : h('tr', null, h('td', null, l.desc), L.num(l.qty), L.num(fm(l.unit)), L.num(fm(l.amount))));
    const summary = vat ? h('table', { class: 'p-tbl p-sum', id: 'p-sum' }, h('thead', null, h('tr', null, ['Tax summary', 'Net', 'Tax', 'Total'].map((x, k) => h('th', { class: k ? 'num' : '' }, x)))), h('tbody', null, t.taxes.map(g => h('tr', null, h('td', null, g.name + ' ' + pct(g.bps)), L.num(fm(g.net)), L.num(fm(g.amount)), L.num(fm(g.gross)))))) : null;
    const home = foreign ? C.homeTotals(inv) : null;
    return h('div', { class: 'paper', id: 'paper' }, h('div', { class: 'p-head' }, h('div', null, h('div', { class: 'p-biz' }, s.business || 'Your business name'), lines, s.email ? h('div', null, s.email) : null, s.phone ? h('div', null, s.phone) : null, s.taxNo ? h('div', { class: 'p-taxno' }, 'Tax number: ' + s.taxNo) : null), h('div', { class: 'p-title' }, h('h2', null, inv.status === 'void' ? 'VOID' : K.title), h('div', null, inv.number || 'DRAFT'))),
      h('div', { class: 'p-meta' }, h('div', null, h('div', { class: 'p-k' }, K.partyK), h('b', null, c.name), addr, c.email ? h('div', null, c.email) : null, c.taxNo ? h('div', null, 'Tax number: ' + c.taxNo) : null), h('div', null, h('div', { class: 'p-k' }, 'Date'), inv.date, h('div', { class: 'p-k' }, K.endK), L.docEnd(inv), termed ? h('div', { class: 'p-k' }, 'Terms') : null, termed ? (inv.terms ? 'Net ' + inv.terms : 'Due on receipt') : null, inv.ref ? h('div', { class: 'p-k' }, 'Reference') : null, inv.ref || null, foreign ? h('div', { class: 'p-k' }, 'Currency') : null, foreign ? inv.cur : null)),
      h('table', { class: 'p-tbl' + (vat ? ' p-vat' : '') }, h('thead', null, h('tr', null, head.map((x, k) => h('th', { class: k ? 'num' : '' }, x)))), h('tbody', null, body)), summary,
      h('div', { class: 'p-tot' }, h('div', null, h('span', null, vat ? 'Net total' : 'Subtotal'), h('span', null, fm(t.subtotal))), vat ? h('div', null, h('span', null, 'Tax total'), h('span', null, fm(t.tax))) : t.taxes.map(x => h('div', null, h('span', null, x.name + ' (' + x.bps / 100 + '%)'), h('span', null, fm(x.amount)))), h('div', { class: 'grand' }, h('span', null, kind === 'invoice' ? 'Total due' : 'Total'), h('span', null, fm(t.total))),
        live && paid ? h('div', null, h('span', null, 'Paid'), h('span', null, '-' + fm(paid))) : null, live && paid ? h('div', { class: 'grand' }, h('span', null, 'Balance'), h('span', null, fm(bal))) : null),
      foreign ? h('p', { class: 'p-note p-fx', id: 'p-fx' }, 'Exchange rate used for the books: 1 ' + inv.cur + ' = ' + C.fmtRate(inv.fx) + ' ' + C.homeCur() + ', typed by the business. Value in ' + C.homeCur() + ': ' + C.fmt(home.total) + (vat ? ', of which tax ' + C.fmt(home.tax) : '') + '.') : null,
      inv.notes ? h('p', { class: 'p-note' }, inv.notes) : null, s.footer && kind !== 'bill' ? h('p', { class: 'p-foot' }, s.footer) : null);
  }
  L.paper = paper;
  function invoiceView(inv) {
    const st = L.st, t = C.today(); const s = C.invoiceStatus(st, inv, t); const pays = st.payments.filter(p => p.invId === inv.id);
    const pay = () => L.modal('Record payment', close => { const a = L.moneyInput(C.balance(st, inv), { id: 'p-amt' }), d = dateInput(), memo = L.input({ placeholder: 'Check number, transfer reference...' }), fx = C.isForeign(inv) ? L.input({ id: 'pay-fx', inputmode: 'decimal', value: C.fmtRate(inv.fx), 'aria-label': 'Exchange rate for this payment' }) : null, prev = h('p', { class: 'muted small', id: 'p-prev' });
      const upd = () => { if (!fx) return; const r = C.parseRate(fx.value), c = C.toCents(a.value); L.clear(prev); if (!(r > 0) || isNaN(c) || c <= 0) return; const cash = C.convert(c, r), book = c === C.balance(st, inv) ? C.balanceH(st, inv) : Math.min(C.convert(c, inv.fx), C.balanceH(st, inv)), g = cash - book; prev.textContent = 'You receive ' + C.fmt(cash) + ' at this rate. The invoice was booked at ' + C.fmt(book) + ': ' + (g === 0 ? 'no gain or loss.' : (g > 0 ? 'realised gain ' : 'realised loss ') + C.fmt(Math.abs(g)) + '.'); };
      if (fx) { fx.oninput = upd; a.oninput = upd; }
      return h('form', { class: 'stack', onsubmit: guard(ev => { ev.preventDefault(); const r = fx ? C.parseRate(fx.value) : undefined; if (fx && !(r > 0)) throw new Error('Type the exchange rate for this payment, for example 1.0842.'); C.recordPayment(st, inv.id, d.value, parseMoney(a.value, 'Amount'), memo.value.trim() || undefined, fx ? { fx: r } : undefined); close(); L.commit(); L.toast('Payment recorded.'); }) }, h('p', { class: 'muted' }, 'Balance is ' + C.fmtDoc(inv, C.balance(st, inv)) + '. A smaller amount records a partial payment.'), h('div', { class: 'grid2' }, L.field(C.isForeign(inv) ? 'Amount (' + inv.cur + ')' : 'Amount (' + C.symbol() + ')', a), L.field('Date', d)), fx ? L.field('1 ' + inv.cur + ' = ? ' + C.homeCur() + ' on the day you were paid', fx, 'You type the rate you actually got. Nothing is looked up.') : null, prev, L.field('Reference', memo), h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', id: 'p-save' }, 'Record payment'))); });
    const est = inv.fromEstimate && st.estimates.find(e => e.id === inv.fromEstimate);
    const side = h('div', { class: 'card stack no-print' }, h('div', null, 'Status ', L.chip(s, STATUS_CHIP[s])),
      inv.status === 'issued' ? h('div', null, h('div', { class: 'k' }, 'Balance'), h('div', { class: 'v big' }, C.fmtDoc(inv, C.balance(st, inv)))) : null,
      inv.status === 'issued' && C.balance(st, inv) > 0 ? h('button', { class: 'btn primary', id: 'pay', onclick: pay }, 'Record payment') : null,
      s === 'overdue' ? h('button', { class: 'btn', id: 'remind', onclick: () => L.reminderDialog && L.reminderDialog(inv) }, 'Write a reminder') : null,
      h('button', { class: 'btn', id: 'print', onclick: () => window.print() }, 'Print / save as PDF'),
      h('p', { class: 'muted small' }, 'In the print window choose "Save as PDF" as the printer.'),
      est ? h('p', { class: 'small' }, 'From estimate ', h('a', { href: '#/estimate/' + est.id }, est.number)) : null,
      pays.length ? h('div', null, h('h3', null, 'Payments'), L.table(['Date', { t: 'Amount', cls: 'num' }, ''], pays.map(p => h('tr', null, h('td', null, p.date), L.num(C.fmtDoc(inv, p.amount) + (p.fx ? ' at ' + C.fmtRate(p.fx) + (p.gl ? (p.gl > 0 ? ', gain ' : ', loss ') + C.fmt(Math.abs(p.gl)) : '') : '')), h('td', null, h('button', { class: 'btn ghost sm', 'aria-label': 'Remove payment', onclick: () => L.confirm('Remove this payment?', 'Remove', guard(() => { C.removePayment(st, p.id); L.commit(); }), true) }, '✕')))))) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: guard(() => { const n = Object.assign(JSON.parse(JSON.stringify(inv)), { id: C.nid(st, 'i'), status: 'draft', number: undefined, entryId: undefined, date: t }); ['stock', 'cogsEntryId', 'fromEstimate', 'fromSchedule', 'fromTime'].forEach(k => delete n[k]); st.invoices.push(n); L.save(); L.go('#/invoice/' + n.id); L.toast('Copied to a new draft.'); }) }, 'Duplicate'),
        h('button', { class: 'btn sm', id: 'repeat', onclick: () => L.scheduleDialog && L.scheduleDialog(inv) }, 'Repeat'),
        h('a', { class: 'btn sm', href: '#/statement/' + inv.clientId }, 'Statement'),
        inv.status === 'issued' ? h('button', { class: 'btn sm danger', onclick: () => L.confirm('Void ' + inv.number + '? A reversing entry keeps the books honest.', 'Void invoice', guard(() => { C.voidInvoice(st, inv.id, t < inv.date ? inv.date : t); L.commit(); }), true) }, 'Void') : null));
    return h('div', { class: 'stack' }, h('div', { class: 'page-head no-print' }, h('h1', null, inv.number), h('a', { class: 'btn', href: '#/invoices' }, 'Back')), h('div', { class: 'invgrid' }, paper(inv), side));
  }
  L.draftPage = function (kind, doc) { // editor, preview and a delete button for any draft document
    const K = DOCS[kind]; return h('div', { class: 'stack' }, editor(kind, doc.id), h('div', { class: 'card' }, h('h3', null, 'Preview'), paper(doc, kind)), h('div', { class: 'row' }, h('button', { class: 'btn danger sm', id: 'del-draft', onclick: () => L.confirm('Delete this draft?', 'Delete', () => { L.st[K.coll] = L.st[K.coll].filter(i => i !== doc); if (kind === 'invoice') L.st.time.forEach(x => { if (x.invId === doc.id) x.invId = ''; }); L.save(); L.go(K.back); }, true) }, 'Delete draft')));
  };
  R.invoice = function (arg, arg2) {
    if (arg === 'new') return editor('invoice', null, arg2);
    const inv = L.st.invoices.find(i => i.id === arg); if (!inv) return h('p', null, 'No such invoice. ', h('a', { href: '#/invoices' }, 'Back to invoices'));
    return inv.status === 'draft' ? L.draftPage('invoice', inv) : invoiceView(inv);
  };

  /* ---------- aged receivables ---------- */
  R.receivables = function () {
    const st = L.st; const asOf = L.input({ type: 'date', value: C.today(), id: 'ar-date', 'aria-label': 'As of' }); const out = h('div', { class: 'stack' });
    const draw = () => { const ag = C.aging(st, asOf.value || C.today()); L.clear(out);
      const cols = ag.buckets; out.appendChild(h('div', { class: 'card' }, ag.rows.length ? L.table(['Client'].concat(cols.map(c => ({ t: c === 'current' ? 'Current' : c + ' days', cls: 'num' })), [{ t: 'Total', cls: 'num' }]),
        ag.rows.map(r => h('tr', null, h('td', null, (L.client(r.clientId) || { name: '?' }).name), cols.map(c => L.num(r[c] ? C.fmt(r[c]) : '-', c !== 'current' && r[c] ? 'neg' : '')), L.num(C.fmt(r.total), 'strong'))).concat([h('tr', { class: 'foot' }, h('td', null, 'Total'), cols.map(c => L.num(C.fmt(ag.totals[c]))), L.num(C.fmt(ag.totals.total)))]), 'aging') : h('p', { class: 'muted' }, 'Nothing is owed as of this date.')));
      const inv = ag.rows.flatMap(r => r.invoices.map(i => Object.assign({ client: (L.client(r.clientId) || { name: '?' }).name }, i))).sort((a, b) => b.late - a.late);
      if (inv.length) out.appendChild(h('div', { class: 'card' }, h('h2', null, 'Open invoices'), L.table(['Invoice', 'Client', 'Due', { t: 'Days late', cls: 'num' }, { t: 'Balance', cls: 'num' }], inv.map(i => h('tr', null, h('td', null, h('a', { href: '#/invoice/' + i.id }, i.number)), h('td', null, i.client), h('td', null, i.due), L.num(String(i.late), i.late ? 'neg' : ''), L.num(C.fmt(i.balance)))))));
    };
    asOf.addEventListener('input', draw); draw();
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, 'Aged receivables'), L.field('As of', asOf)), out);
  };
})();
