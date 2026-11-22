/* Stark Builder, free trial layer. Shipped only in dist/StarkBuilder_trial_web.zip (tools/build_trial_zip.py).
   Printed sheets and PDFs carry a "Stark trial" watermark, and the modules listed in tools/trial_manifest.json are not in the trial at all (the stub cards say so).
   No timer, no counter, nothing is ever deleted or blocked, and saved project files are identical to the paid app's, so they open there.
   The buy button is a plain link; this page makes no network calls. */
(function () {
  'use strict';
  const SB = window.SB, app = SB.app, BUY = 'https://ams513.itch.io/stark-builder', NOT = (window.StarkTrial || {}).notIncluded || '';
  SB.trial = { on: true, label: 'Stark Builder (free trial)', buyUrl: BUY, watermark: 'Stark trial' };
  const { h, $ } = app;

  const bar = document.querySelector('.topbar');
  if (bar) {
    bar.appendChild(h('span', { class: 'trial-badge', title: 'Printed sheets carry a Stark trial watermark. ' + NOT, text: 'Free trial' }));
    bar.appendChild(h('a', { class: 'btn primary trial-buy', href: BUY, target: '_blank', rel: 'noopener noreferrer' }, 'Own it forever: buy on itch.io'));
  }

  function mark() {
    const paper = document.querySelector('#sheet .paper'); if (!paper || paper.querySelector('.trial-wm')) return;
    for (let i = 0; i < 6; i++) paper.appendChild(h('div', { class: 'trial-wm', 'aria-hidden': 'true', style: 'top:' + (i * 17 + 4) + '%', text: SB.trial.watermark + '   ' + SB.trial.watermark + '   ' + SB.trial.watermark }));
    paper.appendChild(h('div', { class: 'trial-foot' }, 'Printed from the Stark Builder free trial. Own it forever, without the watermark: ' + BUY));
  }
  const show = app.showSheet;
  app.showSheet = function (kind) { show(kind); mark(); };

  /* Project tab: tell people their trial work carries over. */
  const projView = app.views.project;
  app.views.project = function () {
    projView.apply(this, arguments);
    const box = $('#project'); if (!box) return;
    box.insertBefore(h('div', { class: 'card trial-card' }, h('h2', { text: 'You are using the free trial' }),
      h('p', { text: 'Nothing is ever time-limited or deleted. Printed sheets and PDFs carry a "Stark trial" watermark. ' + NOT }),
      h('p', { text: 'Your work carries over. Use "Save project file" below, then in the full app open it with "Open a project file". The file is the same format, so nothing is lost.' }),
      h('a', { class: 'btn primary', href: BUY, target: '_blank', rel: 'noopener noreferrer' }, 'Own it forever: buy on itch.io')), box.firstChild);
  };
  if (app.tab === 'project') app.views.project();
})();
