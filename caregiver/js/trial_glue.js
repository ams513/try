/* Stark Caregiver free trial: the Radar and Ask screens show a plain card. Trial package only. */
(function () {
  "use strict";
  var T = window.StarkTrial, A = window.CareApp, h = window.CareUI.h;
  function page(title, lead) { return h("div", null, A.section(title, lead), T.card("radar_ask")); }
  A.views.radar = function () { return page("Radar", "What the record shows needs attention, counted from what you recorded."); };
  A.views.ask = function () { return page("Ask the record", "Plain-words questions over your own care record."); };
})();
