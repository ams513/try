/* Stark Homeroom. "Send feedback": a small form that writes an email draft for the parent to send themselves.
   It builds one mailto: link and opens it, so the parent's own mail app opens with the draft. Nothing is sent
   by Homeroom, nothing is stored, no connection is made. The pure part (SHR.feedback.mailto) is tested in node. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const TO = 'hello@starkforall.com', SUBJECT = 'Stark Homeroom feedback', MAXTEXT = 700;
  const NL = '\r\n';
  const clip = (s, n) => String(s === null || s === undefined ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, n);
  /* the draft: { to, subject, body, url }. rating is 1-5 or empty; edition is 'Free trial' or '' (paid) */
  function mailto(o) {
    o = o || {};
    const r = Math.round(Number(o.rating)), rating = r >= 1 && r <= 5 ? r + ' of 5' : 'not given';
    const lines = ['What I like:', clip(o.like, MAXTEXT) || '(nothing written)', '', 'What is missing:', clip(o.missing, MAXTEXT) || '(nothing written)', '', 'Rating: ' + rating, '',
      '--', 'App: ' + (o.app || 'Stark Homeroom') + ' ' + (o.version || '') + (o.edition ? ' (' + o.edition + ')' : ''), 'Sent from my own email app. Homeroom sent nothing.'];
    const body = lines.join('\n').replace(/\n/g, NL);
    return { to: TO, subject: SUBJECT, body, url: 'mailto:' + TO + '?subject=' + encodeURIComponent(SUBJECT) + '&body=' + encodeURIComponent(body) };
  }
  SHR.feedback = { mailto, TO, SUBJECT };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHR.feedback;
  if (typeof document === 'undefined') return;

  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(k => { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(c => e.append(c));
    return e;
  }
  let dlg = null, opener = null;
  function build() {
    const like = el('textarea', { id: 'fb-like', rows: '3', maxlength: String(MAXTEXT) }), miss = el('textarea', { id: 'fb-missing', rows: '3', maxlength: String(MAXTEXT) });
    const rate = el('select', { id: 'fb-rating' }, [el('option', { value: '', text: 'No rating' })].concat([5, 4, 3, 2, 1].map(n => el('option', { value: String(n), text: n + ' of 5' }))));
    const open = el('button', { type: 'button', class: 'btn', id: 'fb-open', text: 'Open my email app' }), close = el('button', { type: 'button', class: 'btn btn-ghost', id: 'fb-close', text: 'Close' });
    const note = el('p', { class: 'small muted', id: 'fb-note', text: 'This opens your email app with a draft addressed to ' + TO + '. Nothing is sent until you press send there. Homeroom itself sends nothing and keeps nothing.' });
    const d = el('dialog', { class: 'fb', id: 'fb', 'aria-labelledby': 'fb-h' }, [el('h2', { id: 'fb-h', text: 'Send feedback' }),
      el('label', { for: 'fb-like', text: 'What you like' }), like, el('label', { for: 'fb-missing', text: 'What is missing' }), miss, el('label', { for: 'fb-rating', text: 'Rating (1 is low, 5 is high)' }), rate, note, el('div', { class: 'row' }, [open, close])]);
    const done = () => { if (typeof d.close === 'function' && d.open) d.close(); else d.removeAttribute('open'); if (opener) opener.focus(); };
    open.addEventListener('click', () => {
      const m = mailto({ like: like.value, missing: miss.value, rating: rate.value, app: 'Stark Homeroom', version: (SHR.teach || {}).VERSION, edition: SHR.trial ? 'Free trial' : '' });
      const a = el('a', { href: m.url }); document.body.append(a); a.click(); a.remove();
      note.textContent = 'Your email app should open now with the draft. If nothing opened, write to ' + TO + ' yourself. Nothing was sent by Homeroom.';
    });
    close.addEventListener('click', done);
    d.addEventListener('cancel', e => { e.preventDefault(); done(); });
    document.body.append(d);
    return d;
  }
  function show(from) {
    opener = from || null; if (!dlg) dlg = build();
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    const f = dlg.querySelector('#fb-like'); if (f) f.focus();
  }
  function init() {
    const foot = document.getElementById('sitefoot'); if (!foot) return;
    const b = el('button', { type: 'button', class: 'btn btn-ghost btn-small', id: 'fb-btn', text: 'Send feedback' });
    b.addEventListener('click', () => show(b)); foot.append(b);
  }
  SHR.feedback.show = show;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
