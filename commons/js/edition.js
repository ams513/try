/* Stark Commons, by Stark. Edition + feedback helpers. The build script swaps this one file to make the free-trial zip.
   Pure functions, no network. The trial never expires and never deletes anything: it only stops NEW notebook entries past the limit. */
(function (root) {
  'use strict';
  var ed = { name: 'Stark Commons', version: '1.1.0', trial: true, limit: 15, buyUrl: 'https://starkforall.com/commons.html', mailTo: 'hello@starkforall.com' };
  /* How many more records may be added when `count` exist. Infinity in the paid app. Never negative. */
  ed.room = function (count) { return ed.trial ? Math.max(0, ed.limit - (count | 0)) : Infinity; };
  function clip(s, n) { s = typeof s === 'string' ? s : ''; return s.length > n ? s.slice(0, n) : s; }
  /* -> mailto: URL. Opens the person's own mail app; nothing is sent from here. */
  ed.feedbackUrl = function (f) {
    f = f || {};
    var r = parseInt(f.rating, 10), rating = r >= 1 && r <= 5 ? r + ' / 5' : 'not given';
    var body = 'App: ' + ed.name + (ed.trial ? ' (free trial)' : '') + '\nVersion: ' + ed.version + '\nRating: ' + rating + '\n\nWhat I like:\n' + clip(f.like, 1200) + '\n\nWhat is missing:\n' + clip(f.missing, 1200) + '\n';
    return 'mailto:' + ed.mailTo + '?subject=' + encodeURIComponent('Stark Commons feedback') + '&body=' + encodeURIComponent(body);
  };
  root.SC_EDITION = ed;
  if (typeof module !== 'undefined' && module.exports) module.exports = ed;
})(typeof window !== 'undefined' ? window : globalThis);
