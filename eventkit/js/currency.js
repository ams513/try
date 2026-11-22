/* Stark Event Kit currency: one currency per event (code and symbol from a built-in list, or "other" with a typed symbol),
   the right number of decimals for it, and amounts shown and read in the user's locale. Pure logic, no DOM, no network.
   There are no exchange rates and nothing is ever converted: choosing another currency keeps the numbers.
   Amounts are stored as whole hundredths of the main unit (cents) for every currency, as before. A currency without
   decimals (yen, won) keeps whole units only, which is enforced when amounts are typed and when the currency is changed.
   Decimals per currency follow ISO 4217 (minor unit digits; www.iso.org/iso-4217-currency-codes.html, read 2026-11-22).
   Display uses the browser's own Intl.NumberFormat, so grouping, decimal mark and symbol placement follow the locale. */
(function (g) {
  'use strict';
  var S = g.SEK, C = S.cur = {};
  function trim(v) { return (v == null ? '' : String(v)).trim(); }

  // [code, symbol, decimals, name]
  C.LIST = [
    ['USD', '$', 2, 'US dollar'], ['EUR', '€', 2, 'Euro'], ['GBP', '£', 2, 'Pound sterling'], ['JPY', '¥', 0, 'Japanese yen'],
    ['CAD', 'CA$', 2, 'Canadian dollar'], ['AUD', 'A$', 2, 'Australian dollar'], ['NZD', 'NZ$', 2, 'New Zealand dollar'], ['CHF', 'CHF', 2, 'Swiss franc'],
    ['SEK', 'kr', 2, 'Swedish krona'], ['NOK', 'kr', 2, 'Norwegian krone'], ['DKK', 'kr', 2, 'Danish krone'], ['PLN', 'zł', 2, 'Polish zloty'],
    ['CZK', 'Kč', 2, 'Czech koruna'], ['HUF', 'Ft', 2, 'Hungarian forint'], ['BRL', 'R$', 2, 'Brazilian real'], ['MXN', 'MX$', 2, 'Mexican peso'],
    ['INR', '₹', 2, 'Indian rupee'], ['ZAR', 'R', 2, 'South African rand'], ['SGD', 'S$', 2, 'Singapore dollar'], ['HKD', 'HK$', 2, 'Hong Kong dollar'],
    ['CNY', 'CN¥', 2, 'Chinese yuan'], ['KRW', '₩', 0, 'South Korean won'], ['TRY', '₺', 2, 'Turkish lira'], ['AED', 'AED', 2, 'UAE dirham'],
    ['ILS', '₪', 2, 'Israeli shekel'], ['PHP', '₱', 2, 'Philippine peso'], ['THB', '฿', 2, 'Thai baht'], ['IDR', 'Rp', 2, 'Indonesian rupiah'],
    ['VND', '₫', 0, 'Vietnamese dong'], ['CLP', 'CLP$', 0, 'Chilean peso']
  ];
  C.OTHER = 'OTHER';
  C.DEFAULT = 'USD';
  C.get = function (code) { var i; code = trim(code).toUpperCase(); for (i = 0; i < C.LIST.length; i++) if (C.LIST[i][0] === code) return { code: C.LIST[i][0], symbol: C.LIST[i][1], dec: C.LIST[i][2], name: C.LIST[i][3], other: false }; return null; };

  // Before 1.4 an event stored only a typed symbol (default "$") and every amount had two decimals. Those events are treated as the
  // old default, US dollars, and keep every amount; a symbol the list can show with two decimals maps to its code, anything else stays
  // an "other" currency with that symbol (so nothing is guessed about decimals or amounts).
  var LEGACY = { '$': 'USD', '€': 'EUR', '£': 'GBP' };
  C.legacy = function (symbol) {
    var s = trim(symbol), code = s === '' ? 'USD' : LEGACY[s];
    return code ? C.get(code) : { code: '', symbol: s.slice(0, 4), dec: 2, name: 'Other', other: true };
  };
  // The currency of an event (its plan record). Pure: never writes.
  C.of = function (plan) {
    var code = trim(plan && plan.ccode).toUpperCase(), k;
    if (code === C.OTHER) { k = +(plan.cdec); return { code: '', symbol: trim(plan.currency).slice(0, 4), dec: k === 0 || k === 1 ? k : 2, name: 'Other', other: true }; }
    if (code) { k = C.get(code); if (k) return k; }
    return C.legacy(plan && plan.currency);
  };
  C.unit = function (cur) { return cur && cur.dec === 0 ? 100 : 1; };    // smallest step of a stored amount

  /* ---------- the user's locale ---------- */
  C.locale = function () {
    var n = g.navigator, l = n && (n.language || (n.languages && n.languages[0]));
    return l || 'en-US';
  };
  function okLocale(loc) { try { return Intl.NumberFormat.supportedLocalesOf([loc]).length ? loc : 'en-US'; } catch (e) { return 'en-US'; } }
  C.forLocale = function (loc) {
    var region = '', eu = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK', by = { US: 'USD', GB: 'GBP', JP: 'JPY', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', BR: 'BRL', MX: 'MXN', IN: 'INR', ZA: 'ZAR', SG: 'SGD', HK: 'HKD', CN: 'CNY', KR: 'KRW', TR: 'TRY', AE: 'AED', IL: 'ILS', PH: 'PHP', TH: 'THB', ID: 'IDR', VN: 'VND', CL: 'CLP' };
    try { region = new Intl.Locale(loc || C.locale()).maximize().region || ''; } catch (e) { /* no region */ }
    if (eu.split(' ').indexOf(region) >= 0) return C.get('EUR');
    return C.get(by[region] || C.DEFAULT);
  };
  function decimalChar(loc) {
    try { var p = new Intl.NumberFormat(okLocale(loc)).formatToParts(1.1), i; for (i = 0; i < p.length; i++) if (p[i].type === 'decimal') return p[i].value; } catch (e) { /* fall through */ }
    return '.';
  }

  /* ---------- showing and reading amounts ---------- */
  function whole(c, cur) { var v = Math.round(c) / 100; if (cur.dec === 0) v = Math.round(v); return v === 0 ? 0 : v; }
  // For people: grouping, decimal mark and symbol placement follow the locale. cur is an object from C.of / C.get.
  C.fmt = function (c, cur, loc) {
    if (c == null || !isFinite(c)) return '-';
    cur = cur || C.get(C.DEFAULT); loc = okLocale(loc || C.locale());
    var v = whole(c, cur), n;
    try {
      if (!cur.other) return new Intl.NumberFormat(loc, { style: 'currency', currency: cur.code, minimumFractionDigits: cur.dec, maximumFractionDigits: cur.dec }).format(v);
      n = new Intl.NumberFormat(loc, { minimumFractionDigits: cur.dec, maximumFractionDigits: cur.dec }).format(Math.abs(v));
      return (v < 0 ? '-' : '') + cur.symbol + (/[A-Za-z]$/.test(cur.symbol) ? ' ' : '') + n;
    } catch (e) { return (v < 0 ? '-' : '') + cur.symbol + Math.abs(v).toFixed(cur.dec); }
  };
  // For an input box: the number only, with the locale's decimal mark and no grouping.
  C.input = function (c, cur, loc) {
    if (c == null || !isFinite(c)) return '';
    cur = cur || C.get(C.DEFAULT);
    try { return new Intl.NumberFormat(okLocale(loc || C.locale()), { useGrouping: false, minimumFractionDigits: cur.dec, maximumFractionDigits: cur.dec }).format(whole(c, cur)); } catch (e) { return whole(c, cur).toFixed(cur.dec); }
  };
  // For files that open in a spreadsheet or are read by a program: a plain number with a full stop, the right decimals, no symbol.
  C.plain = function (c, cur) { if (c == null || !isFinite(c)) return ''; cur = cur || C.get(C.DEFAULT); return whole(c, cur).toFixed(cur.dec); };
  C.label = function (cur) { return cur.other ? (cur.symbol || 'amount') : cur.code + ' ' + cur.symbol; };
  // What a person types, to stored cents, or NaN. A symbol or currency code before or after the number is ignored. With both marks present the
  // last one is the decimal mark; a single mark is the decimal mark when it is the locale's, or when one or two digits follow it; a repeated
  // mark, or three digits after a mark that is not the locale's, is grouping. More decimals than the currency has is refused, never rounded.
  C.parse = function (s, cur, loc) {
    cur = cur || C.get(C.DEFAULT); loc = loc || 'en-US';
    var t = trim(s).replace(/[\s  '’]/g, '').replace(/^[^\d.,\-]+/, '').replace(/[^\d.,]+$/, ''), neg, dsep = decimalChar(loc), dp = -1, ch, idx, cnt, ip, fp, k;
    if (!/^-?[\d.,]*$/.test(t)) return NaN;
    neg = t.charAt(0) === '-'; if (neg) t = t.slice(1);
    if (!/\d/.test(t)) return NaN;
    if (t.indexOf('.') >= 0 && t.indexOf(',') >= 0) dp = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
    else if (t.indexOf('.') >= 0 || t.indexOf(',') >= 0) {
      ch = t.indexOf('.') >= 0 ? '.' : ','; idx = t.indexOf(ch); cnt = t.split(ch).length - 1;
      if (cnt === 1) dp = ch === dsep || t.length - idx - 1 !== 3 ? idx : -1;
    }
    ip = dp < 0 ? t : t.slice(0, dp);
    if (!/^\d*$|^\d{1,3}([.,]\d{3})+$/.test(ip)) return NaN;   // grouping marks must sit every three digits
    ip = ip.replace(/\D/g, ''); fp = dp < 0 ? '' : t.slice(dp + 1);
    if (/\D/.test(fp) || ip.length > 12) return NaN;
    if (fp.replace(/0+$/, '').length > cur.dec) return NaN;
    k = (+(ip || 0)) * 100 + +((fp + '00').slice(0, 2));
    return neg ? -k : k;
  };

  /* ---------- choosing a currency for an event ---------- */
  // Writes the choice into the plan record. No conversion: stored amounts keep their numbers. A currency without decimals rounds
  // the amounts of this event to whole units so every figure shown is exactly the figure stored. Returns how many amounts were rounded.
  C.choose = function (plan, code, symbol, dec, budget, guests) {
    var k = C.get(code), n = 0;
    function snap(v) { var r = Math.round(v / 100) * 100; if (r !== v) n++; return r; }
    if (k) { plan.ccode = k.code; plan.currency = k.symbol; plan.cdec = k.dec; }
    else { plan.ccode = C.OTHER; plan.currency = trim(trim(symbol).slice(0, 4)); plan.cdec = +dec === 0 ? 0 : 2; }
    if (C.of(plan).dec === 0) {
      if (budget && budget.items) budget.items.forEach(function (it) { it.est = snap(it.est); if (it.act != null) it.act = snap(it.act); });
      if (guests && guests.types) guests.types.forEach(function (t) { t.price = snap(t.price); });
    }
    return n;
  };
  // An event without a stored choice gets one the first time money is looked at: its old default if it already holds amounts,
  // otherwise the currency of the user's locale. Returns true when the plan changed (the caller saves it).
  C.ensure = function (plan, hasMoney, loc) {
    if (trim(plan.ccode)) return false;
    var k = hasMoney ? C.legacy(plan.currency) : C.forLocale(loc);
    if (k.other) { plan.ccode = C.OTHER; plan.cdec = 2; } else { plan.ccode = k.code; plan.currency = k.symbol; plan.cdec = k.dec; }
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
