/* Stark Warden free trial: the screens of the full-version-only features show a plain card. Trial package only. */
(function () {
  'use strict';
  var SW = window.SW, ui = SW.ui, T = window.StarkTrial, h = ui.h;
  ui.route('practice', 'Call practice', function (main) {
    main.appendChild(h('section', { class: 'hero2 small-hero' }, h('h1', { text: 'Call practice' })));
    main.appendChild(T.card('practice'));
  });
  ui.route('packs', null, function (main) {
    main.appendChild(h('section', { class: 'hero2 small-hero' }, h('h1', { text: 'Pattern packs' })));
    main.appendChild(T.card('packs'));
    main.appendChild(h('p', { class: 'small', text: 'This trial uses the built-in warning-sign patterns, dated ' + SW.data.meta.patternsAsOfLabel + '. Scams change, and a result with no warning signs does not mean a message is safe.' }));
  });
})();
