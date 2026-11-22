/* Stark IntraTheater by Stark. Send feedback: a small form that builds a mailto: link. The person's own email app opens with
   the message ready; nothing is sent by this app, no data leaves unless they press send there. No network calls. */
(function () {
  'use strict';
  const SIT = window.SIT = window.SIT || {};
  const TO = 'hello@starkforall.com', SUBJECT = 'Stark IntraTheater feedback', MAXLEN = 1500;

  const clip = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, MAXLEN);
  function compose(f) {
    f = f || {};
    const rating = Math.round(Number(f.rating));
    const ed = SIT.edition && SIT.edition.trial ? 'Free trial' : 'Full';
    const body = ['What I like:', clip(f.like) || '(nothing written)', '', 'What is missing:', clip(f.missing) || '(nothing written)', '',
      'Rating (1 to 5): ' + (rating >= 1 && rating <= 5 ? rating : 'not rated'), '', '--',
      'App: Stark IntraTheater', 'Version: ' + (SIT.VERSION || ''), 'Edition: ' + ed].join('\n');
    const href = 'mailto:' + TO + '?subject=' + encodeURIComponent(SUBJECT) + '&body=' + encodeURIComponent(body).replace(/%0A/g, '%0D%0A');
    return { to: TO, subject: SUBJECT, body, href };
  }
  SIT.feedback = { compose, TO, SUBJECT };

  function wire() {
    const dlg = document.getElementById('feedback-dialog'), open = document.getElementById('feedback-open');
    if (!dlg || !open) return;
    const q = id => document.getElementById(id), msg = q('fb-msg');
    const read = () => { const r = dlg.querySelector('input[name="fb-rating"]:checked'); return { like: q('fb-like').value, missing: q('fb-missing').value, rating: r ? r.value : 0 }; };
    open.addEventListener('click', () => { msg.textContent = ''; dlg.showModal(); q('fb-like').focus(); });
    q('fb-cancel').addEventListener('click', () => dlg.close());
    q('fb-form').addEventListener('submit', e => {
      e.preventDefault();
      const f = read();
      if (!clip(f.like) && !clip(f.missing) && !f.rating) { msg.textContent = 'Write a line or pick a rating first.'; return; }
      const m = compose(f);
      msg.textContent = 'Opening your email app. If nothing opens, write to ' + m.to + ' yourself.';
      const a = document.createElement('a'); a.href = m.href; a.hidden = true; document.body.appendChild(a); a.click(); a.remove();
    });
  }
  if (typeof document !== 'undefined') wire();
})();
