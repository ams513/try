/* Stark Ledger 1.5. Pure logic for VAT / GST and for other currencies. No DOM and no network; runs in the browser and in Node for the tests.
   VAT / GST mode: named rates the person types (the app ships none), tax-inclusive or tax-exclusive prices, rounding per line or per rate,
   tax collected on sales and tax paid on purchases in two separate accounts, a period summary with its workings, a CSV and a payment entry.
   Other currencies: a home currency per set of books; an invoice or bill in another currency carries the exchange rate the person typed,
   the ledger holds home-currency amounts, and a payment at a different rate books the realised gain or loss. There is no rate lookup of any kind.
   Bookkeeping arithmetic on typed numbers. It is not tax advice and it knows no country's rules. */
(function (root) {
  'use strict';
  const C = root.StarkCore || require('./core.js');
  const sum = (list, f) => list.reduce((s, x) => s + f(x), 0), money = c => (c / 100).toFixed(2);
  C.OUT_TAX = '2110'; C.IN_TAX = '1300'; C.FXGL = '4910';
  C.TAX_NOTE = 'Tax rates and rules are yours to set. Stark Ledger ships no country rates and no tax rules. This is bookkeeping software, not tax advice: check with a tax professional.';

  /* ---------- accounts that exist only once these features are used ---------- */
  const EXTRA = { [C.OUT_TAX]: ['VAT / GST collected on sales', 'liability', {}], [C.IN_TAX]: ['VAT / GST paid on purchases', 'asset', {}], [C.FXGL]: ['Realised currency gain (loss)', 'income', { sc: '6' }] };
  C.ensureAccounts = function (st, ids) {
    let added = false; (ids || Object.keys(EXTRA)).forEach(id => { if (!C.account(st, id) && EXTRA[id]) { st.accounts.push(Object.assign({ id, name: EXTRA[id][0], type: EXTRA[id][1] }, EXTRA[id][2])); added = true; } });
    if (added) st.accounts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); return added;
  };

  /* ---------- exchange rates: integers scaled by 1e8 (home units per 1 unit of the document currency), typed by the person ---------- */
  C.RATE_SCALE = 100000000;
  C.parseRate = function (v) { // "1.0842" -> 108420000; NaN when not a positive number or too long to be a rate
    const s = String(v == null ? '' : v).trim().replace(',', '.'); if (!/^\d+(\.\d*)?$|^\.\d+$/.test(s)) return NaN;
    const p = s.split('.'), whole = p[0] || '0', frac = p[1] || ''; if (whole.length > 6) return NaN;
    const n = parseInt(whole, 10) * C.RATE_SCALE + parseInt((frac + '00000000').slice(0, 8), 10) + ((frac[8] || '0') >= '5' ? 1 : 0);
    return n > 0 && Number.isSafeInteger(n) ? n : NaN;
  };
  C.fmtRate = function (r) { const s = (r / C.RATE_SCALE).toFixed(8).replace(/0+$/, ''); const parts = s.split('.'); return parts[0] + '.' + (parts[1] + '0000').slice(0, Math.max(4, parts[1].length)); };
  C.convert = function (cents, rate) { // BigInt so a large amount times an 8-decimal rate never loses a cent; half rounds away from zero
    const n = BigInt(cents) * BigInt(rate), D = BigInt(C.RATE_SCALE), neg = n < 0n, a = neg ? -n : n, q = (2n * a + D) / (2n * D); return Number(neg ? -q : q);
  };
  C.isForeign = d => !!d && Number.isInteger(d.fx) && d.fx > 0 && !!d.cur;

  /* ---------- formatting: home currency and any document currency, by locale ---------- */
  C.CURRENCIES = [['USD', 'US dollar'], ['EUR', 'Euro'], ['GBP', 'Pound sterling'], ['CAD', 'Canadian dollar'], ['AUD', 'Australian dollar'], ['NZD', 'New Zealand dollar'], ['CHF', 'Swiss franc'], ['SEK', 'Swedish krona'], ['NOK', 'Norwegian krone'], ['DKK', 'Danish krone'],
    ['PLN', 'Polish zloty'], ['CZK', 'Czech koruna'], ['HUF', 'Hungarian forint'], ['RON', 'Romanian leu'], ['INR', 'Indian rupee'], ['SGD', 'Singapore dollar'], ['HKD', 'Hong Kong dollar'], ['JPY', 'Japanese yen'], ['CNY', 'Chinese yuan'], ['KRW', 'South Korean won'],
    ['MXN', 'Mexican peso'], ['BRL', 'Brazilian real'], ['ARS', 'Argentine peso'], ['CLP', 'Chilean peso'], ['COP', 'Colombian peso'], ['PEN', 'Peruvian sol'], ['ZAR', 'South African rand'], ['AED', 'UAE dirham'], ['SAR', 'Saudi riyal'], ['TRY', 'Turkish lira'], ['ILS', 'Israeli shekel'], ['THB', 'Thai baht'], ['PHP', 'Philippine peso'], ['MYR', 'Malaysian ringgit'], ['IDR', 'Indonesian rupiah']];
  C.LOCALES = [['en-US', 'English (United States): $1,234.56'], ['en-GB', 'English (United Kingdom): 1,234.56'], ['en-AU', 'English (Australia): 1,234.56'], ['en-CA', 'English (Canada): 1,234.56'], ['en-IN', 'English (India): 1,23,456.78'], ['de-DE', 'German: 1.234,56'], ['fr-FR', 'French: 1 234,56'], ['es-ES', 'Spanish (Spain): 1.234,56'],
    ['es-MX', 'Spanish (Mexico): 1,234.56'], ['pt-BR', 'Portuguese (Brazil): 1.234,56'], ['it-IT', 'Italian: 1.234,56'], ['nl-NL', 'Dutch: 1.234,56'], ['pl-PL', 'Polish: 1 234,56'], ['sv-SE', 'Swedish: 1 234,56'], ['ja-JP', 'Japanese: 1,234.56']];
  const cache = new Map();
  C.fmtIn = function (cur, cents) { // an amount in a given currency, the home locale's separators
    if (!cur || cur === C.homeCur()) return C.fmt(cents);
    const k = cur + '|' + C.homeLocale(); let nf = cache.get(k);
    if (!nf) { try { nf = new Intl.NumberFormat(C.homeLocale(), { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch (e) { nf = { format: v => cur + ' ' + v.toFixed(2) }; } cache.set(k, nf); }
    return nf.format(cents / 100);
  };
  C.fmtDoc = (doc, cents) => (C.isForeign(doc) ? C.fmtIn(doc.cur, cents) : C.fmt(cents));
  C.validCurrency = function (code) { code = String(code || '').trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(code)) return ''; try { new Intl.NumberFormat('en-US', { style: 'currency', currency: code }); return code; } catch (e) { return ''; } };
  C.symbol = function (cur) { cur = cur || C.homeCur(); try { const p = new Intl.NumberFormat(C.homeLocale(), { style: 'currency', currency: cur }).formatToParts(1); const c = p.find(x => x.type === 'currency'); return c ? c.value : cur; } catch (e) { return cur; } };
  C.applyFormat = function (st) { const s = (st && st.settings) || {}; if (!C.setFormat(s.homeCur || 'USD', s.locale || 'en-US')) C.setFormat('USD', 'en-US'); };
  C.setHomeCurrency = function (st, code) {
    const c = C.validCurrency(code); if (!c) throw new Error('Enter a three-letter currency code such as EUR or GBP.');
    if (c === st.settings.homeCur) return c;
    const used = [].concat(st.invoices, st.bills, st.estimates, st.pos || [], st.schedules || []).some(C.isForeign);
    if (used) throw new Error('Some documents are in another currency, so the home currency cannot change. Start separate books for the other currency.');
    st.settings.homeCur = c; return c;
  };

  /* ---------- VAT / GST rates (named, typed by the person) ---------- */
  C.vatRates = st => (st.settings.vatRates || []);
  C.addVatRate = function (st, name, bps) {
    name = String(name || '').trim(); if (!name) throw new Error('Give the rate a name such as Standard.'); if (!Number.isInteger(bps) || bps < 0 || bps > 100000) throw new Error('Enter a rate such as 20 or 7.5.');
    if (!st.settings.vatRates) st.settings.vatRates = []; if (st.settings.vatRates.some(r => r.name.toLowerCase() === name.toLowerCase())) throw new Error('A rate called "' + name + '" already exists.');
    st.settings.vatRates.push({ name, bps }); return st.settings.vatRates; // the app ships no rates: every entry here was typed by the person
  };
  C.removeVatRate = function (st, name) { st.settings.vatRates = C.vatRates(st).filter(r => r.name !== name); };
  C.setTaxMode = function (st, mode) { if (mode !== 'sales' && mode !== 'vat') throw new Error('Unknown tax mode'); st.settings.taxMode = mode; if (mode === 'vat') C.ensureAccounts(st, [C.OUT_TAX, C.IN_TAX]); };

  /* ---------- the arithmetic of one document ----------
     Exclusive price: tax = round(amount x rate). Inclusive price: tax = round(amount x rate / (1 + rate)), net = amount - tax. Half rounds away from zero.
     Rounding "line": every line is rounded on its own and the totals add the lines up. Rounding "doc": amounts of one rate are added first and the tax of that
     group is rounded once; the group's tax is shared back onto its lines (largest remainder) so the lines still add up to the total. */
  const floorDiv = (n, d) => { const m = ((n % d) + d) % d; return (n - m) / d; };
  const qOf = l => (l.q != null ? l.q : C.qtyToMilli(l.qty));
  const taxOf = (amount, bps, incl) => (incl ? C.roundDiv(amount * bps, 10000 + bps) : C.roundDiv(amount * bps, 10000));
  function vatTotals(inv) {
    const incl = !!inv.incl, byDoc = inv.round === 'doc';
    const lines = inv.lines.map(l => { const q = qOf(l), amount = C.roundDiv(q * l.unit, 1000), bps = l.tbps | 0, name = l.tname || 'No tax'; return Object.assign({}, l, { amount, tbps: bps, tname: name }); });
    lines.forEach(l => { l.taxAmt = taxOf(l.amount, l.tbps, incl); });
    if (byDoc) {
      const groups = new Map(); lines.forEach((l, i) => { const k = l.tname + '|' + l.tbps; (groups.get(k) || groups.set(k, []).get(k)).push(i); });
      groups.forEach(idx => {
        const bps = lines[idx[0]].tbps, D = incl ? 10000 + bps : 10000, target = taxOf(sum(idx, i => lines[i].amount), bps, incl);
        const base = idx.map(i => floorDiv(lines[i].amount * bps, D)), rem = idx.map((i, j) => lines[i].amount * bps - base[j] * D); let left = target - sum(base, x => x);
        const order = idx.map((i, j) => j).sort((a, b) => rem[b] - rem[a] || a - b); order.forEach(j => { if (left > 0) { base[j]++; left--; } });
        idx.forEach((i, j) => { lines[i].taxAmt = base[j]; });
      });
    }
    lines.forEach(l => { l.net = incl ? l.amount - l.taxAmt : l.amount; l.gross = l.net + l.taxAmt; });
    const groups = []; const at = {}; lines.forEach(l => { const k = l.tname + '|' + l.tbps; let g = at[k]; if (!g) { g = at[k] = { name: l.tname, bps: l.tbps, net: 0, amount: 0, gross: 0 }; groups.push(g); } g.net += l.net; g.amount += l.taxAmt; g.gross += l.gross; });
    const net = sum(lines, l => l.net), tax = sum(lines, l => l.taxAmt);
    return { lines, subtotal: net, taxes: groups, tax, total: net + tax, incl, vat: true };
  }
  const invoiceTotals0 = C.invoiceTotals;
  C.invoiceTotals = inv => (inv && inv.taxMode === 'vat' ? vatTotals(inv) : invoiceTotals0(inv));

  /* ---------- home-currency amounts: what the ledger holds ---------- */
  function parts(doc, t) { // pure: per line, per tax group and the total, in home currency; the rounding left over by converting piece by piece lands on the largest line
    const base = t.lines.map(l => (l.net != null ? l.net : l.amount)), tx = t.taxes.map(x => x.amount);
    if (!C.isForeign(doc)) return { lines: base, taxes: tx, total: t.total };
    const total = C.convert(t.total, doc.fx), lines = base.map(v => C.convert(v, doc.fx)), taxes = tx.map(v => C.convert(v, doc.fx));
    const resid = total - sum(lines, x => x) - sum(taxes, x => x);
    if (resid && lines.length) { let k = 0; lines.forEach((v, i) => { if (Math.abs(v) > Math.abs(lines[k])) k = i; }); lines[k] += resid; }
    return { lines, taxes, total };
  }
  const homeParts0 = C.homeParts;
  C.homeParts = function (st, doc, t, side) {
    if (doc.taxMode === 'vat') C.ensureAccounts(st, [C.OUT_TAX, C.IN_TAX]); if (C.isForeign(doc)) C.ensureAccounts(st, [C.FXGL]);
    return doc.taxMode === 'vat' || C.isForeign(doc) ? parts(doc, t) : homeParts0(st, doc, t, side);
  };
  const taxAcct0 = C.taxAcct;
  C.taxAcct = (doc, side) => (doc && doc.taxMode === 'vat' ? (side === 'buy' ? C.IN_TAX : C.OUT_TAX) : taxAcct0(doc, side));
  C.homeTotals = function (doc) { // totals of a document in the home currency (the document itself when it is already in it)
    const t = C.invoiceTotals(doc); if (!C.isForeign(doc)) return t; const p = parts(doc, t);
    return Object.assign({}, t, { lines: t.lines.map((l, i) => Object.assign({}, l, { amount: p.lines[i] })), subtotal: sum(p.lines, x => x), taxes: t.taxes.map((x, i) => Object.assign({}, x, { amount: p.taxes[i] })), tax: sum(p.taxes, x => x), total: p.total });
  };
  C.totalH = doc => C.homeTotals(doc).total;
  C.arHomeCarry = (st, inv) => C.homeTotals(inv).total - sum(st.payments.filter(p => p.invId === inv.id), p => p.arHome || 0);
  C.balanceH = function (st, inv) {
    if (!C.isForeign(inv)) return C.balance(st, inv); if (inv.status !== 'issued') return 0;
    return C.balance(st, inv) > 0 ? C.arHomeCarry(st, inv) : 0;
  };
  C.billBalanceH = function (st, b) {
    if (!C.isForeign(b)) return C.billBalance(st, b); if (b.status !== 'open') return 0;
    return C.billBalance(st, b) > 0 ? C.homeTotals(b).total - sum(st.billPayments.filter(p => p.billId === b.id), p => p.arHome || 0) : 0;
  };

  /* ---------- a payment in another currency: cash at the rate typed for that day, the receivable or payable at its own rate, the difference is the realised gain or loss ---------- */
  C.settle = function (st, doc, kind, amount, opt) {
    if (!C.isForeign(doc)) return null;
    const rate = opt && opt.fx ? opt.fx : doc.fx; if (!Number.isInteger(rate) || rate <= 0) throw new Error('Enter the exchange rate for this payment, for example 1.0842.');
    C.ensureAccounts(st, [C.FXGL]);
    const recv = kind === 'recv', pays = recv ? st.payments.filter(p => p.invId === doc.id) : st.billPayments.filter(p => p.billId === doc.id);
    const H = C.homeTotals(doc).total, used = sum(pays, p => p.arHome || 0), docBal = recv ? C.balance(st, doc) : C.billBalance(st, doc);
    const carry = amount === docBal ? H - used : Math.min(C.convert(amount, doc.fx), H - used), cash = C.convert(amount, rate), diff = cash - carry; // diff > 0: more home money than the book value
    const L = recv ? [{ a: C.CASH, dr: cash }, { a: C.AR, cr: carry }] : [{ a: C.AP, dr: carry }, { a: C.CASH, cr: cash }];
    const gain = recv ? diff : -diff; // gain > 0 is income, < 0 an expense
    if (gain > 0) L.push({ a: C.FXGL, cr: gain }); else if (gain < 0) L.push({ a: C.FXGL, dr: -gain });
    return { lines: C.netLines(L), rec: { fx: rate, home: cash, arHome: carry, gl: gain } };
  };

/* full version only */
})(typeof window !== 'undefined' ? window : globalThis);
