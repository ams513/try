/* Stark Math. Edition and feedback logic (pure, no DOM). This one file is the only difference between the paid build and the
   free trial: tools/build_web_zip.py rewrites the TRIAL flag below in the trial zip. The trial never expires, never deletes
   anything and makes no network call; its single limit is the number of notebook pages (existing pages always stay). */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM = G.SM || {};
  const TRIAL = true; /* @trial-flag */
  const E = SM.edition = { trial: TRIAL, name: 'Stark Math', noteLimit: 15, buyUrl: 'https://ams513.itch.io/stark-math', mailTo: 'hello@starkforall.com', subject: 'Stark Math feedback' };
  /** True while another notebook page may be created. Paid: always. Trial: below the cap. Counts only; never removes pages. */
  E.canAddNote = count => !E.trial || count < E.noteLimit;

  const clip = (s, n) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, n);
  /** Build the mailto link for the feedback form. Nothing is sent: the person's own mail app opens with this draft. */
  SM.feedbackCompose = function (f, appVersion) {
    f = f || {};
    const r = +f.rating, rating = r >= 1 && r <= 5 ? Math.round(r) : 0;
    const body = ['App: ' + E.name, 'Version: ' + appVersion + (E.trial ? ' (free trial)' : ''), 'Rating: ' + (rating ? rating + ' / 5' : 'not given'), '',
      'What I like:', clip(f.like, 700) || '-', '', 'What is missing:', clip(f.missing, 700) || '-', ''].join('\n');
    return { to: E.mailTo, subject: E.subject, body, href: 'mailto:' + E.mailTo + '?subject=' + encodeURIComponent(E.subject) + '&body=' + encodeURIComponent(body) };
  };
})();
