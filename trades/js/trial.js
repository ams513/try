/* Stark Trades 2.3, FREE TRIAL overlay. Shipped ONLY in dist/StarkTrades_trial_web.zip (tools/build_web_zip.py --trial); the paid app never loads it.
   One limit: up to 15 of your own jobs (the sample company's jobs do not count). The full-only modules named in tools/trial_manifest.json are not in this package.
   Never time-limited, never deletes or hides data: past the limit you can still open, edit, print and export every record, and the
   encrypted backup restores into the paid app. No network calls: the buy button is a plain link the person chooses to open. */
(function (root) {
  'use strict';
  const LIMIT = 15, BUY = 'https://ams513.itch.io/stark-trades';
  const api = { LIMIT, BUY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  let C = root.StarkCore; if (!C && typeof require === 'function') { try { C = require('../js/core4.js'); } catch (e) { /* not available */ } } if (!C) return;
  const L = root.L, t = C.t, N = C.N;
  C.I.ES = C.I.ES || {};
  /* wording written for the trial package, with its Spanish, in one table (the paid files stay untouched) */
  const TX = {
    banner: ['Up to {n} of your own jobs. No time limit; your data is never deleted.', 'Hasta {n} trabajos propios. Sin límite de tiempo; sus datos nunca se borran.'],
    limit: ['Free trial limit: {n} of your own jobs. Nothing is lost: all your data stays, opens and exports anytime, and the backup file opens in the full version. Buy Stark Trades to remove the limit.', 'Límite de la prueba gratis: {n} trabajos propios. No se pierde nada: todos sus datos se quedan, se abren y se exportan siempre, y el archivo de respaldo abre en la versión completa. Compre Stark Trades para quitar el límite.'],
    kept: ['Nothing is lost: all your data stays and opens anytime.', 'No se pierde nada: todos sus datos se quedan y se abren siempre.']
  };
  Object.keys(TX).forEach(k => { C.I.ES[TX[k][0]] = TX[k][1]; });
  /* sample jobs of the demo company are free; count only the jobs after them */
  let demoJobs = null;
  const sampleCount = st => { if (!st || !st.demo) return 0; if (demoJobs == null) { try { demoJobs = (root.StarkTradesDemo || require('../js/demo.js')).demoState(C, C.today()).jobs.length; } catch (e) { demoJobs = 13; } } return Math.min(demoJobs, st.jobs.length); };
  api.used = st => st ? st.jobs.length - sampleCount(st) : 0;
  api.full = st => api.used(st) >= LIMIT;
  api.message = () => t(TX.limit[0], { n: LIMIT });
  const newJob = C.newJob, spawnDue = C.spawnDue;
  C.newJob = function (st) { if (api.full(st)) throw new Error(api.message()); return newJob.apply(this, arguments); };
  C.spawnDue = function (st) {
    const before = st.jobs.length;
    try { return spawnDue.apply(this, arguments); }
    catch (e) { if (api.full(st) && st.jobs.length > before) return { jobs: st.jobs.slice(before), skipped: 0, limited: true }; throw e; }
  };
  root.StarkTrial = Object.assign(root.StarkTrial || {}, api);   /* the generated stub (js/trial_stub.js) defines StarkTrial first */
  if (!L || typeof document === 'undefined') return;
  const h = L.h;
  const buy = (cls, id) => h('a', { class: cls, id: id || null, href: BUY, target: '_blank', rel: 'noopener noreferrer' }, t('Own it forever: buy on itch.io'));
  const bar = h('div', { class: 'trial-bar no-print', id: 'trial-bar' });
  function paintBar() {
    L.clear(bar); bar.appendChild(h('span', { class: 'chip amber', id: 'trial-badge' }, t('Free trial')));
    bar.appendChild(h('span', { class: 'trial-txt' }, t(TX.banner[0], { n: LIMIT }) + ' ' + ((root.StarkTrial || {}).notIncluded || ''))); bar.appendChild(buy('btn sm primary', 'trial-buy'));
  }
  document.body.insertBefore(bar, document.body.firstChild); paintBar();
  const setLang = L.setLang; L.setLang = function () { const r = setLang.apply(this, arguments); paintBar(); return r; };
  const jobsRoute = L.routes.jobs, backup = L.routes.backup, jobDialog = L.jobDialog;
  L.routes.jobs = function () {
    const n = jobsRoute.apply(null, arguments), st = L.st, used = api.used(st), full = api.full(st);
    const note = h('div', { class: 'note trial-note' + (full ? ' bad' : ''), id: 'trial-jobs' }, h('span', { class: 'grow' }, h('b', null, t('Free trial: {a} of {b} jobs used.', { a: used, b: LIMIT }) + ' '), full ? t('You can still open, edit and export everything. Buy to add more jobs.') : st.demo ? t('The sample company jobs do not count.') : t(TX.kept[0])), buy('btn sm', 'trial-buy-jobs'));
    n.insertBefore(note, n.children[1] || null); return n;
  };
  L.routes.backup = function () {
    const n = backup.apply(null, arguments);
    n.insertBefore(h('p', { class: 'note', id: 'trial-carry' }, t('Your trial data is yours. The encrypted backup below opens in the full Stark Trades with Restore, with all your jobs and photos, so nothing is lost when you buy.')), n.children[1] || null); return n;
  };
  L.jobDialog = function (job) {
    if (job || !api.full(L.st)) return jobDialog.apply(this, arguments);
    return L.modal(t('Free trial limit reached'), close => h('div', { class: 'stack', id: 'trial-limit' }, h('p', null, api.message()), h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: close }, t('Close')), buy('btn primary', 'trial-buy-dlg'))));
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
