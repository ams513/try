/* Stark Builder, by Stark. "Send feedback": a small form that builds a mailto: link. Nothing is sent by this page: the link opens the
   person's own email app with the message filled in, and they press send. No network, no analytics. */
(function () {
  'use strict';
  const SB = window.SB = window.SB || {};
  const TO = 'hello@starkforall.com', SUBJECT = 'Stark Builder feedback', MAXTXT = 1500;
  const clip = (s) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, MAXTXT);

  /* Pure: the message body and the mailto link (tested without a browser). */
  function compose(f) {
    f = f || {};
    const name = f.name || 'Stark Builder', ver = f.version || '', r = parseInt(f.rating, 10), rating = r >= 1 && r <= 5 ? r : 0;
    const body = ['App: ' + name + (ver ? ' ' + ver : ''), 'Rating (1-5): ' + (rating ? rating + ' / 5' : 'not given'), '',
      'What I like:', clip(f.like) || '-', '', "What's missing:", clip(f.missing) || '-', '', '(Written in my own email app. Nothing was sent automatically.)'].join('\r\n');
    return { to: TO, subject: SUBJECT, body: body, url: 'mailto:' + TO + '?subject=' + encodeURIComponent(SUBJECT) + '&body=' + encodeURIComponent(body).replace(/%0A/g, '%0D%0A').replace(/%0D%0D%0A/g, '%0D%0A') };
  }
  SB.feedback = { compose: compose, TO: TO, SUBJECT: SUBJECT };

  const app = SB.app; if (!app || typeof document === 'undefined') return;
  const { h, $, clear } = app;
  let opener = null;
  const close = () => { const m = $('#modal'); m.hidden = true; clear(m); document.removeEventListener('keydown', onKey, true); if (opener && opener.focus) opener.focus(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

  function open() {
    const m = $('#modal'); opener = document.activeElement; clear(m); m.hidden = false;
    const like = h('textarea', { rows: 3, maxLength: MAXTXT, id: 'fb-like', placeholder: 'Optional' });
    const miss = h('textarea', { rows: 3, maxLength: MAXTXT, id: 'fb-miss', placeholder: 'Optional' });
    const stars = h('div', { class: 'row', role: 'radiogroup', 'aria-label': 'Rating from 1 to 5' });
    [1, 2, 3, 4, 5].forEach(n => stars.appendChild(h('label', { class: 'small' }, h('input', { type: 'radio', name: 'fb-rate', value: String(n) }), ' ' + n)));
    const msg = h('p', { class: 'hint', role: 'status', 'aria-live': 'polite' });
    const go = h('button', { type: 'button', class: 'btn primary', onclick: () => {
      const rd = stars.querySelector('input:checked');
      const c = compose({ name: (SB.trial && SB.trial.label) || 'Stark Builder', version: app.VERSION, rating: rd ? rd.value : 0, like: like.value, missing: miss.value });
      const a = document.createElement('a'); a.href = c.url; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
      msg.textContent = 'Your email app should open with the message ready. If nothing opens, write to ' + TO + ' and paste your text.';
    } }, 'Open my email app');
    m.appendChild(h('div', { class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Send feedback' },
      h('h2', { text: 'Send feedback' }),
      h('p', { class: 'muted small', text: 'This opens your own email app with a message to ' + TO + '. Nothing is sent from this page and nothing leaves your computer until you press send in your email app.' }),
      h('label', { class: 'f', for: 'fb-like' }, 'What you like', like), h('label', { class: 'f', for: 'fb-miss' }, "What's missing", miss),
      h('div', { class: 'f' }, h('span', { class: 'small', text: 'Rating (1 is poor, 5 is great)' }), stars), msg,
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, 'Close'), go)));
    document.addEventListener('keydown', onKey, true); like.focus();
  }
  SB.feedback.open = open;
  const b = document.getElementById('feedback-btn'); if (b) b.addEventListener('click', open);
})();
