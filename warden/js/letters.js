/* Stark Warden: fills the letter templates in data/letters.js. Required fields left empty become visible [PLACEHOLDERS]. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function prettyDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? MONTHS[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : String(s || '');
  }
/* full version only */
  SW.letters = { prettyDate: prettyDate };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.letters; }
})(typeof window !== 'undefined' ? window : globalThis);
