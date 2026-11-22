/* Stark Warden: shared helpers used by the rule engines (browser and node). No network, no storage. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};

  var LEVELS = {
    low: { id: 'low', rank: 0, glyph: 'i', label: 'Few common warning signs found',
      line: 'Nothing here matched the usual scam patterns. That does not mean it is safe: new tricks appear all the time.' },
    caution: { id: 'caution', rank: 1, glyph: '!', label: 'Some warning signs',
      line: 'Be careful. Do not click, pay, or share anything until you have checked it another way.' },
    high: { id: 'high', rank: 2, glyph: '!!', label: 'Many warning signs: treat it as a likely scam',
      line: 'Several classic scam patterns match. Do not reply, click, or pay. Check using a number or website you already trust.' },
    severe: { id: 'severe', rank: 3, glyph: 'X', label: 'Strong scam pattern: do not respond or pay',
      line: 'This matches the most common ways people lose money. Stop, and talk to someone you trust before doing anything.' }
  };

  function levelFor(score) {
    if (score >= 10) { return LEVELS.severe; }
    if (score >= 6) { return LEVELS.high; }
    if (score >= 3) { return LEVELS.caution; }
    return LEVELS.low;
  }

  /* Optimal-string-alignment distance (insert, delete, replace, swap two neighbours). */
  function editDistance(a, b) {
    var i, j, cost, d = [];
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) { d[0][j] = j; }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }

  function clip(s, n) {
    s = String(s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function money(n) {
    if (!isFinite(n)) { return '$0.00'; }
    var neg = n < 0, s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + s;
  }

  SW.util = { LEVELS: LEVELS, levelFor: levelFor, editDistance: editDistance, clip: clip, pad2: pad2, money: money };
})(typeof window !== 'undefined' ? window : globalThis);
