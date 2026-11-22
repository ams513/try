/* Stark Math. App shell extras: the "Send feedback" form (opens the person's own email app, sends nothing itself) and, in the
   free trial only, the "Free trial" badge, its limit notice and the "buy on itch.io" button. */
(function () {
  'use strict';
  const SM = window.SM, E = SM.edition, { h, clear, btn } = SM;
  const dlg = id => SM.$('#' + id);
  const open = d => { if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); };
  const buyLink = cls => h('a', { class: 'btn btn-primary ' + (cls || ''), href: E.buyUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Own it forever: buy on itch.io');

  SM.openFeedback = function () {
    const d = dlg('feedback-dialog'), body = clear(dlg('feedback-body'));
    const like = h('textarea', { id: 'fb-like', rows: 3, maxlength: 700 }), miss = h('textarea', { id: 'fb-miss', rows: 3, maxlength: 700 });
    let rating = 0;
    const stars = h('div', { class: 'row wrap fb-rate', role: 'radiogroup', 'aria-label': 'Rating from 1 to 5' });
    const go = h('a', { class: 'btn btn-primary', id: 'fb-send' }, 'Open my email app');
    const paint = () => { Array.from(stars.children).forEach((b, i) => { b.setAttribute('aria-checked', String(rating === i + 1)); b.classList.toggle('btn-primary', rating === i + 1); }); go.setAttribute('href', SM.feedbackCompose({ rating, like: like.value, missing: miss.value }, SM.VERSION).href); };
    for (let i = 1; i <= 5; i++) stars.appendChild(btn(String(i), () => { rating = rating === i ? 0 : i; paint(); }, 'btn-small', { role: 'radio', 'aria-checked': 'false', 'aria-label': i + ' out of 5' }));
    like.addEventListener('input', paint); miss.addEventListener('input', paint);
    body.append(h('h2', { id: 'feedback-title' }, 'Send feedback'),
      h('p', { class: 'muted' }, 'This opens your own email app with a message to ' + E.mailTo + ' already written. Nothing is sent from here: you read it and press send yourself. If no email app opens, copy the address and write to us any way you like.'),
      h('label', { for: 'fb-like' }, 'What do you like?'), like, h('label', { for: 'fb-miss' }, 'What is missing?'), miss,
      h('div', null, h('span', null, 'Rating (optional) '), stars),
      h('div', { class: 'row end' }, btn('Close', () => d.close(), 'btn-ghost'), go));
    paint(); open(d);
  };

  SM.openTrial = function (why) {
    const d = dlg('trial-dialog'), body = clear(dlg('trial-body'));
    body.append(h('h2', { id: 'trial-title' }, 'Free trial'),
      why ? h('p', { class: 'warn-text', role: 'status' }, why) : null,
      h('p', null, 'The notebook holds up to ' + E.noteLimit + ' pages. ' + ((window.StarkTrial || {}).notIncluded || '') + ' Nothing expires, and nothing you made is ever deleted.'),
      h('p', { class: 'muted' }, 'Your work is yours. "Export my trial data" saves a backup file; in the full version, use Settings, Backups, Restore from a backup to carry it over.'),
      h('div', { class: 'row wrap end' }, btn('Close', () => d.close(), 'btn-ghost'),
        btn('Export my trial data', () => SM.download('stark-math-trial-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(SM.buildBackup(), null, 1), 'application/json'), ''), buyLink()));
    open(d);
  };
  SM.trialLimitHit = () => { SM.openTrial('The free trial notebook is full (' + E.noteLimit + ' pages). Your pages are all still here.'); };

  const fb = SM.$('#feedback-open'); if (fb) fb.addEventListener('click', () => SM.openFeedback());
  const badge = SM.$('#trial-badge');
  if (E.trial) {
    if (badge) { badge.hidden = false; badge.addEventListener('click', () => SM.openTrial()); }
    const f = SM.$('#footer-extra'); if (f) f.append(' ', h('span', { class: 'trial-note' }, 'Free trial. ' + ((window.StarkTrial || {}).notIncluded || '')), ' ', h('a', { href: E.buyUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Own it forever: buy on itch.io'));
    document.title = 'Stark Math (free trial)';
  }
})();
