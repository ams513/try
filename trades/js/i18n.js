/* Stark Trades. English and Spanish. English text is the key; js/es.js holds the Spanish.
   t('Text {n}', {n}) translates and fills in values; tt(value) translates stored data (trade names, demo labels) when a
   translation exists and otherwise shows it as typed; N('text') only marks a string for the translation check. */
(function (root) {
  'use strict';
  const I = { lang: 'en', ES: {} };
  const fill = (s, p) => p ? s.replace(/\{(\w+)\}/g, (m, k) => p[k] != null ? p[k] : m) : s;
  I.t = (s, p) => fill(I.lang === 'es' && I.ES[s] != null ? I.ES[s] : s, p);
  I.tn = (n, one, many, p) => I.t(n === 1 ? one : many, Object.assign({ n }, p));
  I.tt = s => (I.lang === 'es' && typeof s === 'string' && I.ES[s] != null ? I.ES[s] : s);
  I.N = s => s;
  I.setLang = l => { I.lang = l === 'es' ? 'es' : 'en'; return I.lang; };
  root.StarkI18n = I; if (typeof module !== 'undefined' && module.exports) module.exports = I;
})(typeof globalThis !== 'undefined' ? globalThis : this);
