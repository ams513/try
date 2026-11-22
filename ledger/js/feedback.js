/* Stark Ledger. "Send feedback" page and the free-trial badge. Nothing here touches the network: the feedback form only
   builds a mailto: link that opens the person's own email app, and they press send there. The trial pieces appear only
   when the trial package's js/edition.js is present; the paid app shows just the feedback page. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, R = L.routes;
  const BUY = /^https:\/\/[a-z0-9-]+\.itch\.io\/[a-z0-9-]+$/;
  const trial = () => C.edition();
  const buyUrl = () => { const e = trial(); return e && BUY.test(e.buyUrl || '') ? e.buyUrl : ''; };
  const buyLink = cls => { const u = buyUrl(); return u ? h('a', { class: 'btn ' + (cls || 'primary sm'), id: 'buy-link', href: u, target: '_blank', rel: 'noopener noreferrer' }, 'Own it forever: buy on itch.io') : null; };

  R.feedback = function () {
    const rate = h('div', { class: 'rate', role: 'radiogroup', 'aria-label': 'Rating from 1 to 5' }), liked = h('textarea', { rows: 4, id: 'fb-liked', maxlength: 700 }), missing = h('textarea', { rows: 4, id: 'fb-missing', maxlength: 700 });
    const send = h('a', { class: 'btn primary', id: 'fb-send', href: C.feedbackMailto({}) }, 'Open my email app');
    const upd = () => { const c = rate.querySelector('input:checked'); send.setAttribute('href', C.feedbackMailto({ rating: c ? c.value : '', liked: liked.value, missing: missing.value })); };
    for (let i = 1; i <= 5; i++) rate.appendChild(h('label', { class: 'rate-opt' }, h('input', { type: 'radio', name: 'fb-rating', value: String(i), onchange: upd }), ' ' + i));
    liked.addEventListener('input', upd); missing.addEventListener('input', upd);
    return h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', null, 'Send feedback')),
      h('form', { class: 'card stack', id: 'fb-form', onsubmit: ev => ev.preventDefault() },
        h('p', null, 'Tell us what works and what you wish it did. This opens your email app with a draft addressed to ' + C.FEEDBACK_TO + '. Nothing is sent from here: you read the draft and press send yourself, or close it.'),
        L.field('Your rating (1 is poor, 5 is great)', rate), L.field('What you like', liked), L.field('What is missing', missing),
        h('div', { class: 'row' }, send), h('p', { class: 'muted small' }, 'The draft holds only what you typed above, the app name and the version (Stark Ledger ' + C.VERSION + (trial() ? ', Free trial' : '') + '). None of your books, clients or amounts are included.')));
  };

  L.trialNote = () => trial() ? h('p', { class: 'fine', id: 'trial-lock-note' }, h('b', null, 'Free trial.'), ' New invoices stop at ' + trial().invoiceLimit + '. ' + ((window.StarkTrial || {}).notIncluded || '') + ' Your data is never deleted or locked. ', buyLink('ghost sm')) : null;

  /* Trial banner: says once, visibly, what the trial leaves out (the sentence generated from the manifest). Dismissal is remembered. It is drawn from
     shellExtras, which runs only after the books are unlocked, so it never sits on the lock screen. */
  const DISMISS_KEY = 'stark-ledger-trial-banner';
  const dismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; } };
  function trialBanner(e) {
    const T = window.StarkTrial, main = L.$('#main'), old = L.$('#trial-banner'); if (old) old.remove();
    if (!e || !T || !T.notIncluded || dismissed() || !main) return;
    const close = h('button', { type: 'button', class: 'btn ghost sm', id: 'trial-banner-x', 'aria-label': 'Dismiss', onclick: () => { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (x) { /* storage blocked: hidden until reload */ } const b = L.$('#trial-banner'); if (b) b.remove(); } }, 'Dismiss');
    main.insertBefore(h('div', { class: 'note trial-banner', id: 'trial-banner', role: 'note' }, h('span', null, T.notIncluded), close), main.firstChild);
  }

  L.shellExtras = function () {
    const f = L.$('.footer'), e = trial(), top = L.$('.topbar');
    f.appendChild(document.createTextNode(' ')); f.appendChild(h('a', { href: '#/feedback', id: 'footer-feedback' }, 'Send feedback'));
    const old = L.$('#trial-bar'); if (old) old.remove();
    Promise.resolve().then(() => trialBanner(e)); // after the page body is drawn, so it sits at the top of the page
    if (!e || !top) return;
    const n = L.st ? L.st.invoices.length : 0, anchor = L.$('#search-btn');
    top.insertBefore(h('span', { id: 'trial-bar', class: 'trial-bar' }, h('span', { class: 'chip amber', id: 'trial-badge', title: 'Free trial: new invoices stop at ' + e.invoiceLimit + '. Nothing is deleted.' }, 'Free trial ' + Math.min(n, e.invoiceLimit) + '/' + e.invoiceLimit + ' invoices'), buyLink('primary sm')), anchor);
  };

  if (trial()) { // the trial's Backup page says how the data moves to the paid app
    const orig = R.backup;
    if (orig) R.backup = function () { return h('div', { class: 'stack' }, h('div', { class: 'note', id: 'trial-carry' }, h('b', null, 'Your trial data carries over.'), ' Download an encrypted backup here, then use Restore in the paid Stark Ledger: every invoice, client, payment and receipt comes with it. The CSV exports below are complete too.'), orig.apply(null, arguments)); };
  }
})();
