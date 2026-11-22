/* Stark Tenancy: feedback by the person's own email app. Builds a mailto: link; nothing is sent by the app, nothing leaves until they press send in their mail app. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  var TO = 'hello@starkforall.com', SUBJECT = 'Stark Tenancy feedback';
  function rating(r) { r = parseInt(r, 10); return r >= 1 && r <= 5 ? r : 0; }
  function body(f) {
    var m = TN.data.meta, ed = TN.data.edition && TN.data.edition.trial ? ' (free trial)' : '';
    f = f || {};
    return ['App: Stark Tenancy ' + m.version + ed,
      'Rating (1-5): ' + (rating(f.rating) || 'not given'),
      '', 'What I like:', String(f.liked || '').slice(0, 800),
      '', 'What is missing:', String(f.missing || '').slice(0, 800),
      '', '(No tenancy data is included.)'].join('\r\n');
  }
  function mailto(f) { return 'mailto:' + TO + '?subject=' + encodeURIComponent(SUBJECT) + '&body=' + encodeURIComponent(body(f)); }
  TN.feedback = { TO: TO, SUBJECT: SUBJECT, rating: rating, body: body, mailto: mailto };
  if (typeof module !== 'undefined' && module.exports) { module.exports = TN.feedback; }
})(typeof window !== 'undefined' ? window : globalThis);
