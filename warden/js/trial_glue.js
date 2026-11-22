/* Stark Warden free trial: the screens of the full-version-only features show a plain card. Trial package only. */
(function () {
  'use strict';
  var SW = window.SW, ui = SW.ui, T = window.StarkTrial, h = ui.h;
  ui.route('practice', 'Call practice', function (main) {
    main.appendChild(h('section', { class: 'hero2 small-hero' }, h('h1', { text: 'Call practice' })));
    main.appendChild(T.card('practice'));
  });
})();
