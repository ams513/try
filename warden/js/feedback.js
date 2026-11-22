/* Stark Warden: composes a feedback email as a mailto: link. Pure: nothing is sent; the person's own mail app opens and they press send. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var TO = 'hello@starkforall.com', SUBJECT = 'Stark Warden feedback', MAXF = 1500;

  function cut(s) { s = String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim(); return s.length > MAXF ? s.slice(0, MAXF) + '…' : s; }
  function rating(r) { r = parseInt(r, 10); return r >= 1 && r <= 5 ? r : 0; }
  function body(f, meta) {
    f = f || {}; meta = meta || {};
    return ['App: ' + (meta.name || 'Stark Warden'), 'Version: ' + (meta.version || '') + (meta.trial ? ' (Free trial)' : ''),
      'Rating: ' + (rating(f.rating) ? rating(f.rating) + ' of 5' : 'not given'), '',
      'What I like:', cut(f.like) || '(nothing written)', '',
      'What is missing:', cut(f.missing) || '(nothing written)', ''].join('\n');
  }
  function mailto(f, meta) { return 'mailto:' + TO + '?subject=' + encodeURIComponent(SUBJECT) + '&body=' + encodeURIComponent(body(f, meta)); }
  SW.feedback = { TO: TO, SUBJECT: SUBJECT, body: body, mailto: mailto, rating: rating };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.feedback; }
})(typeof window !== 'undefined' ? window : globalThis);
