/* Stark IntraTheater by Stark. Free trial edition (replaces js/edition.js in the trial zip only).
   One limit: up to 15 saved creations (Story Studio stories plus Museum exhibits, all profiles together).
   Never time-limited. Never deletes or hides anything the family made. Everything stays exportable with
   "Back up everything", and "Restore a backup" in the full version opens that file. No network calls: the buy button
   is an ordinary link that the person chooses to open. */
(function () {
  'use strict';
  const SIT = window.SIT = window.SIT || {};
  const CAP = 15;
  const BUY = 'https://ams513.itch.io/stark-intratheater';
  const { h } = SIT;

  function count() {
    const ids = (SIT.family().kids || []).map(k => k.id).concat('grown');
    let n = 0;
    ids.forEach(id => { const p = SIT.progress(id); n += (Array.isArray(p.writing) ? p.writing.length : 0) + (Array.isArray(p.exhibits) ? p.exhibits.length : 0); });
    return n;
  }
  const buyLink = cls => h('a', { class: cls, href: BUY, target: '_blank', rel: 'noopener noreferrer' }, 'Own it forever: buy on itch.io');

  SIT.edition = {
    id: 'trial', trial: true, label: 'Free trial', cap: CAP, buyUrl: BUY, count,
    canCreate: () => count() < CAP,
    limitReached() {
      SIT.toast('The free trial keeps up to ' + CAP + ' saved creations (stories and museum exhibits). Yours are all safe. Back up your data to carry it into the full version.',
        { label: 'Buy on itch.io', fn: () => window.open(BUY, '_blank', 'noopener,noreferrer') });
    }
  };

  document.documentElement.setAttribute('data-edition', 'trial');
  const chip = document.getElementById('profile-chip');
  if (chip && chip.parentNode) chip.parentNode.insertBefore(h('span', { class: 'trial-badge' }, 'Free trial'), chip);

  const footer = document.querySelector('.footer');
  if (footer) {
    const used = h('strong', { class: 'trial-used' });
    const paint = () => { used.textContent = count() + ' of ' + CAP; };
    footer.appendChild(h('div', { class: 'trial-note' },
      h('p', null, h('strong', null, 'Free trial. '), 'Keep up to ' + CAP + ' saved creations (stories and museum exhibits): ', used, ' used. There is no timer, and nothing is ever deleted. ' + ((window.StarkTrial || {}).notIncluded || '')),
      h('p', { class: 'fine' }, 'Your trial data exports with “Back up everything” (Grown-ups, Family settings) and opens in the full version with “Restore a backup”.'),
      h('div', { class: 'row center' },
        buyLink('btn btn-primary btn-small'),
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => SIT.go('#/grown/settings') }, 'Back up my trial data'))));
    paint(); SIT.on('progress', paint);
  }
})();
