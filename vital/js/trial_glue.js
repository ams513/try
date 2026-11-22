/* Stark Vital free trial: the screens of the full-version-only features show a plain card. Trial package only. */
(function () {
  "use strict";
  var T = window.StarkTrial, A = window.VitalApp, h = window.VitalUI.h;
  function page(title, lead, id) { var w = h("div"); w.appendChild(A.section(title, lead)); w.appendChild(T.card(id)); return w; }
  A.views.items = function () { return page("My items", "Your own ratings, yes/no habits and numbers.", "items_year"); };
  A.views.year = function () { return page("Year at a glance", "One small cell per day for each item.", "items_year"); };
  A.beamSend = function () { T.show("beam_send"); };
  A.views.experiments = function () { return page("Experiments", "Change one habit for two weeks and see what changed.", "experiments"); };
})();
