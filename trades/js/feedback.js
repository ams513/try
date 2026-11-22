/* Stark Trades 2.5.0. "Send feedback": a small form that builds a mailto: link. Nothing is sent by the app: the person's own mail app
   opens with a draft, and they press send there. No network calls, no tracking. The message is shown in full before it is opened. */
(function (root) {
  'use strict';
  const TO = 'hello@starkforall.com', SUBJECT = 'Stark Trades feedback', MAXLEN = 600;
  /* pure: builds the mailto: link from the form values (tested in Node) */
  function compose(v, app) {
    const clip = s => String(s || '').replace(/\r\n|\r|\n/g, '\r\n').trim().slice(0, MAXLEN), r = parseInt(v.rating, 10);
    const lines = [app.name + ' ' + app.version + (app.edition ? ' (' + app.edition + ')' : ''), '', 'Rating (1-5): ' + (r >= 1 && r <= 5 ? r : 'not given'), '', 'What I like:', clip(v.like) || '-', '', 'What is missing:', clip(v.missing) || '-'];
    const body = lines.join('\r\n');
    return { to: TO, subject: SUBJECT, body, href: 'mailto:' + TO + '?subject=' + encodeURIComponent(SUBJECT) + '&body=' + encodeURIComponent(body) };
  }
  const api = { compose, TO, SUBJECT, MAXLEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window === 'undefined' || !window.L || !window.StarkCore) return;
  const C = window.StarkCore, L = window.L, h = L.h, t = C.t;
  L.feedbackApp = () => ({ name: 'Stark Trades', version: C.VERSION, edition: window.StarkTrial ? 'free trial' : '' });
  L.feedback = function () {
    L.modal(t('Send feedback'), close => {
      let rating = '';
      const like = L.area('', { name: 'like', id: 'fb-like', rows: 3, maxlength: MAXLEN }), miss = L.area('', { name: 'missing', id: 'fb-missing', rows: 3, maxlength: MAXLEN });
      const preview = h('textarea', { class: 'preview', readonly: true, rows: 9, id: 'fb-preview', 'aria-label': t('The email that will open') });
      const stars = [1, 2, 3, 4, 5].map(n => h('label', { class: 'check fb-star' }, h('input', { type: 'radio', name: 'fb-rating', value: String(n), id: 'fb-r' + n, onchange: () => { rating = String(n); refresh(); } }), h('span', null, String(n))));
      const cur = () => compose({ rating, like: like.value, missing: miss.value }, L.feedbackApp());
      const refresh = () => { preview.value = 'To: ' + TO + '\nSubject: ' + SUBJECT + '\n\n' + cur().body.replace(/\r\n/g, '\n'); };
      like.addEventListener('input', refresh); miss.addEventListener('input', refresh); refresh();
      return L.form({ id: 'feedback-form' }, [
        h('p', { class: 'note' }, t('This opens your email app with a draft addressed to {to}. Nothing is sent by Stark Trades: you read it and press send yourself.', { to: TO })),
        h('fieldset', { class: 'checks', id: 'fb-rating-box' }, h('legend', null, t('How do you rate it? (1 = poor, 5 = great)')), stars),
        L.field(t('What do you like?'), like), L.field(t('What is missing?'), miss),
        L.field(t('Your email will contain'), preview, t('Do not put passwords, tax IDs or customer details here.')),
        L.actions(close, t('Open my email app'))], () => {
        const m = cur(), a = h('a', { href: m.href, id: 'fb-mailto' }); document.body.appendChild(a); a.click(); a.remove();
        close(); L.toast(t('Your email app should open with the draft. If it does not, write to {to}.', { to: TO }));
      });
    });
  };
  const btn = L.$('#feedback-btn'); if (btn) btn.addEventListener('click', () => L.feedback());
})(typeof globalThis !== 'undefined' ? globalThis : this);
