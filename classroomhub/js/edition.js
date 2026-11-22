/* Stark Classroom Hub. Edition and feedback: pure functions, no DOM, no network, no storage.
   The flag below is off in the paid build. tools/build_web_zip.py makes the free-trial zip by flipping that one flag (and
   nothing else); the source stays the paid app. The trial limit is a cap on how many students can be ADDED. It never
   expires, never hides or deletes anything already saved, and a trial backup restores into the paid app unchanged.
   Feedback is only a mailto: link the person's own email app opens; nothing is sent from here. */
(function (root) {
  'use strict';
  const SCH = root.SCH = root.SCH || {};
  const E = {
    name: 'Stark Classroom Hub', version: '1.4.2', trial: true, cap: 15,
    mail: 'hello@starkforall.com', subject: 'Stark ClassroomHub feedback',
    buy: 'https://ams513.itch.io/stark-classroom-hub'
  };
  const clip = (s, n) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
  E.rating = v => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : 0; };
  E.capMessage = () => 'The free trial holds ' + E.cap + ' students. Your saved class is never touched. Own it to add up to 60.';
  /* f: { likes, missing, rating }. Returns the subject, the plain body and the mailto: link. */
  E.feedback = function (f, trial) {
    f = f || {};
    const r = E.rating(f.rating), t = trial === undefined ? E.trial : !!trial;
    const body = ['What I like:', clip(f.likes, 1000) || '(nothing written)', '', 'What is missing:', clip(f.missing, 1000) || '(nothing written)', '', 'Rating (1-5): ' + (r || 'not given'), '',
      '--', 'App: ' + E.name, 'Version: ' + E.version + (t ? ' (free trial)' : ''), ''].join('\n');
    return { to: E.mail, subject: E.subject, body, href: 'mailto:' + E.mail + '?subject=' + encodeURIComponent(E.subject) + '&body=' + encodeURIComponent(body) };
  };
  SCH.edition = E;
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
