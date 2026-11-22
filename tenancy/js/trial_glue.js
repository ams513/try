/* Stark Tenancy free trial: the Insights and Letters screens and the finder show a plain card. Trial package only. */
(function (root) {
  'use strict';
  var TN = root.TN, ui = TN.ui, h = ui.h, T = root.StarkTrial;
  function page(title, lead, id) { return function (main) { main.appendChild(ui.hero(title, lead)); main.appendChild(T.card(id)); }; }
  ui.route('letters', 'Letters', page('Letters', 'Repair request, deposit return request and notice to fix.', 'letters'));
  ui.route('insight', 'Insights', page('Insights', 'Gaps, rent notes, a timeline and a finder.', 'insights'));
  TN.finder = { open: function () { T.show('insights'); } };
})(window);
