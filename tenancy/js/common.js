/* Stark Tenancy: shared helpers used by the engines and the screens (browser and node). No network, no storage. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  /* typed amounts: "1,450.50", "1.450,50", "1450,5", "$1 450" and "€ 12,50" all read as numbers. A lone comma followed by 1 or 2
     digits is a decimal comma; a lone comma followed by 3 digits is a thousands comma. A lone dot is always a decimal point (type
     "1.450,50" or "1450,50", not "1.450"). Reading never depends on the chosen region, so saved text means the same everywhere. */
  function parseNum(x) {
    var raw = String(x == null ? '' : x), s = raw.replace(/[^\d.,\-]/g, ''), neg = /^\s*[^\d.,]*-/.test(raw), dot = s.lastIndexOf('.'), com = s.lastIndexOf(','), dec = '', n;
    s = s.replace(/-/g, '');
    if (!/\d/.test(s)) { return NaN; }
    dot = s.lastIndexOf('.'); com = s.lastIndexOf(',');
    if (dot >= 0 && com >= 0) { dec = dot > com ? '.' : ','; }
    else if (com >= 0) { dec = s.split(',').length === 2 && /^\d{1,2}$/.test(s.slice(com + 1)) ? ',' : ''; }
    else if (dot >= 0) { dec = s.split('.').length === 2 ? '.' : ''; }
    s = dec ? s.slice(0, s.lastIndexOf(dec)).replace(/[.,]/g, '') + '.' + s.slice(s.lastIndexOf(dec) + 1).replace(/[.,]/g, '') : s.replace(/[.,]/g, '');
    n = parseFloat(s);
    return isFinite(n) ? (neg ? -n : n) : NaN;
  }
  function num(x) { var n = parseNum(x); return isFinite(n) ? n : 0; }

  /* ---------- region format and currency: every date and money DISPLAY goes through TN.fmt (Intl). Stored values stay ISO
     dates and plain numbers; CSV and calendar files stay machine readable. ---------- */
  var cfg = { region: '', currency: 'USD', paper: 'auto' }, cache = {};
  function lgOf(tag) { return String(tag || '').split('-')[0].toLowerCase(); }
  function validLocale(tag) {
    var t = String(tag == null ? '' : tag).trim(), c;
    if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/.test(t)) { return ''; }
    try {
      c = Intl.getCanonicalLocales(t)[0];
      if (Intl.DateTimeFormat.supportedLocalesOf([c]).length !== 1 || Intl.NumberFormat.supportedLocalesOf([c]).length !== 1) { return ''; }
      new Intl.DateTimeFormat(c).format(0); new Intl.NumberFormat(c).format(1);
      return c;
    } catch (e) { return ''; }
  }
  function validCurrency(code) {
    var c = String(code == null ? '' : code).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) { return ''; }
    try {
      new Intl.NumberFormat('en', { 'style': 'currency', currency: c }).format(1);
      if (typeof Intl.supportedValuesOf === 'function' && Intl.supportedValuesOf('currency').indexOf(c) < 0) { return ''; }
      return c;
    } catch (e) { return ''; }
  }
  function configure(o) {
    o = o || {};
    cfg.region = o.region ? validLocale(o.region) : '';
    cfg.currency = validCurrency(o.currency) || 'USD';
    cfg.paper = o.paper === 'a4' || o.paper === 'letter' ? o.paper : 'auto';
    cache = {};
  }
  function browserTag() { try { var n = root.navigator; return root.document && n ? validLocale((n.languages && n.languages[0]) || n.language || '') : ''; } catch (e) { return ''; } }
  function autoTag(lg) { var b = browserTag(); return b && lgOf(b) === lg ? b : (lg === 'en' ? 'en-US' : 'es'); }
  function sample(loc) { try { return new Intl.DateTimeFormat(loc, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 10, 2))); } catch (e) { return ''; } }
  /* the locale used for DATES on a screen in language lg: the chosen region, with the screen language's words when the region has its own
     data for that language (de-DE on an English screen gives en-DE: "2 November 2026"); otherwise the chosen tag itself (ja-JP shows
     Japanese dates). Automatic uses this browser's locale when it is in the screen language, otherwise plain en-US / es. */
  function locale(lg) {
    var tag = cfg.region, reg, cand;
    lg = lg === 'es' ? 'es' : (lg === 'en' ? 'en' : lang());
    if (!tag) { return autoTag(lg); }
    if (lgOf(tag) === lg) { return tag; }
    try {
      reg = new Intl.Locale(tag).maximize().region; cand = lg + '-' + reg;
      if (reg && sample(cand) && sample(cand) !== sample(lg)) { return cand; }
    } catch (e) { /* use the chosen tag itself */ }
    return tag;
  }
  /* the locale used for NUMBERS and MONEY: the chosen tag itself (digits, separators and symbol placement do not depend on the screen language) */
  function numLocale(lg) { lg = lg === 'es' ? 'es' : (lg === 'en' ? 'en' : lang()); return cfg.region || autoTag(lg); }
  function dtf(loc, o) { var k = 'd|' + loc + '|' + JSON.stringify(o); return cache[k] || (cache[k] = new Intl.DateTimeFormat(loc, o)); }
  function utc(y, m, d) { var t = new Date(Date.UTC(2000, m - 1, d)); t.setUTCFullYear(y); return t; }
  function fmtDate(s, lg) {
    var m = ISO.exec(String(s || '').slice(0, 10)), t;
    if (!m) { return String(s || ''); }
    t = utc(+m[1], +m[2], +m[3]);
    if (t.getUTCMonth() !== +m[2] - 1 || t.getUTCDate() !== +m[3]) { return String(s).slice(0, 10); }
    try { return dtf(locale(lg), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(t); } catch (e) { return String(s).slice(0, 10); }
  }
  function fmtMonth(key, lg) {
    var m = /^(\d{4})-(\d{2})$/.exec(key || '');
    if (!m || +m[2] < 1 || +m[2] > 12) { return String(key || ''); }
    try { return dtf(locale(lg), { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(utc(+m[1], +m[2], 1)); } catch (e) { return String(key); }
  }
  /* "2026-11-20 14:05" (a wall-clock stamp stored by the app, no time zone) shown as a date and a time in the chosen format */
  function fmtStamp(s, lg) {
    var m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ''));
    if (!m) { return fmtDate(s, lg); }
    try { return fmtDate(m[1], lg) + ', ' + dtf(locale(lg), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, +m[2], +m[3]))); } catch (e) { return String(s); }
  }
  function fmtMoney(n, lg) {
    var k, loc;
    n = typeof n === 'number' && isFinite(n) ? n : 0;
    try { loc = numLocale(lg); k = 'n|' + loc + '|' + cfg.currency; return (cache[k] || (cache[k] = new Intl.NumberFormat(loc, { 'style': 'currency', currency: cfg.currency, currencyDisplay: 'narrowSymbol' }))).format(n); }
    catch (e) { return (n < 0 ? '-' : '') + cfg.currency + ' ' + Math.abs(n).toFixed(2); }
  }
  function paperSize() { return cfg.paper; }
  function money(n) { return fmtMoney(n); }

  /* ---------- dates: plain YYYY-MM-DD strings, calculated in UTC so time zones never shift a day ---------- */
  var ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  function isIso(s) { var m = ISO.exec(String(s || '')); return !!m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31; }
  function toUtc(s) { var m = ISO.exec(String(s || '').slice(0, 10)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function fromUtc(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function addDays(s, n) { var t = toUtc(s); return isFinite(t) ? fromUtc(t + n * 86400000) : ''; }
  function addMonths(s, n) {
    var m = ISO.exec(String(s || '').slice(0, 10)), y, mo, last;
    if (!m) { return ''; }
    y = +m[1]; mo = +m[2] - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return y + '-' + pad2(mo + 1) + '-' + pad2(Math.min(+m[3], last));
  }
  function daysBetween(a, b) { var x = toUtc(a), y = toUtc(b); return isFinite(x) && isFinite(y) ? Math.round((y - x) / 86400000) : null; }
  function localToday(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  /* display helpers: kept under their old names so every screen, report and letter goes through TN.fmt */
  function pretty(s, lg) { return fmtDate(s, lg); }
  function monthLabel(key, lg) { return fmtMonth(key, lg); }

  /* ---------- language: English is the reference; Spanish is a machine translation pending review ---------- */
  var cur = 'en';
  function lang() { return cur; }
  function setLang(l) { cur = l === 'es' ? 'es' : 'en'; }
  function T(en, es) { return cur === 'es' && es ? es : en; }
  function L(o) { return o ? (cur === 'es' && o.es ? o.es : o.en) : ''; }

  TN.util = { clip: clip, pad2: pad2, num: num, parseNum: parseNum, money: money, MONTHS: MONTHS };
  TN.dates = { isIso: isIso, addDays: addDays, addMonths: addMonths, daysBetween: daysBetween, today: localToday, pretty: pretty, monthLabel: monthLabel, stamp: fmtStamp };
  TN.fmt = { configure: configure, validLocale: validLocale, validCurrency: validCurrency, locale: locale, numLocale: numLocale, date: fmtDate, month: fmtMonth, stamp: fmtStamp, money: fmtMoney, paper: paperSize,
    settings: function () { return { region: cfg.region, currency: cfg.currency, paper: cfg.paper }; } };
  TN.i18n = { lang: lang, setLang: setLang, T: T, L: L };
})(typeof window !== 'undefined' ? window : globalThis);
