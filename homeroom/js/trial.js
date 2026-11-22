/* Stark Homeroom, free trial edition. Shipped only in dist/StarkHomeroom_trial_web.zip (tools/build_web_zip.py adds it).
   One limit: at most TRIAL_HOURS hours-log entries. Besides the modules the trial leaves out (tools/trial_manifest.json), nothing else is limited, nothing expires, no clock is read, and
   nothing is ever deleted: reaching the limit only stops NEW entries. Backup, restore and CSV export work in full, and
   the backup file loads straight into the paid app. The buy button is an ordinary link the parent may open. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const TRIAL_HOURS = 15, BUY_URL = 'https://starkapps.gumroad.com/l/stark-homeroom';
  const MSG = 'Free trial: the hours log holds ' + TRIAL_HOURS + ' entries. Your records are safe and nothing is deleted. Download a backup, or buy Stark Homeroom to log without a limit and load your backup into it.';
  SHR.trial = { HOURS: TRIAL_HOURS, BUY_URL, MESSAGE: MSG, left: s => Math.max(0, TRIAL_HOURS - ((s && s.hours) || []).length) };
  /* wrap the one function that adds hours entries; the sample family is exempt so the tour always works */
  const L = SHR.lib;
  if (L && typeof L.logHours === 'function') {
    const real = L.logHours;
    L.logHours = function (state, o) {
      const n = o && o.courseId ? 1 : Math.max(1, ((o && o.sids) || []).length);
      if (state && !state.demo && (state.hours || []).length + n > TRIAL_HOURS) throw new Error(MSG);
      return real.apply(this, arguments);
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = SHR.trial;
  if (typeof document === 'undefined') return;
  function init() {
    const top = document.querySelector('.topbar'), foot = document.getElementById('sitefoot'); if (!top || !foot) return;
    const badge = document.createElement('span'); badge.className = 'trial-badge'; badge.id = 'trial-badge';
    top.insertBefore(badge, document.getElementById('palette-btn'));
    const buy = document.createElement('a'); buy.className = 'btn btn-small'; buy.id = 'trial-buy'; buy.href = BUY_URL; buy.target = '_blank'; buy.rel = 'noopener noreferrer'; buy.textContent = 'Own it forever: buy on Gumroad';
    const info = document.createElement('span'); info.className = 'small muted'; info.id = 'trial-info'; info.textContent = 'Free trial. ' + ((root.StarkTrial || {}).notIncluded || '') + ' Your records stay yours: Backup exports everything you entered, and the file opens in the full version.';
    foot.prepend(buy, info);
    const paint = () => {
      const a = SHR.app, s = a && a.state ? a.state() : null, real = s && !s.demo;
      badge.textContent = 'Free trial' + (real ? ' · ' + s.hours.length + ' of ' + TRIAL_HOURS + ' hours entries' : '');
    };
    const main = document.getElementById('main');
    if (main && typeof MutationObserver === 'function') new MutationObserver(paint).observe(main, { childList: true });
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
