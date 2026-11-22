/* Stark Baseline free trial glue. Trial package only. The planner, the exposure map and the recovery card show a card in place of the code
   (it is not in this package). The records, checklist, runbook and printouts are untouched. */
(function (root) {
  "use strict";
  var A = root.BaselineApp, T = root.StarkTrial, h = root.BaselineUI.h;
  function page(title, sub, id) { return function () { return h("div", null, A.section(title, sub), T.card(id)); }; }
  A.views.plan = page("Path to green", "Which unfinished steps move your score the most.", "path_to_green");
  A.views.map = page("Exposure map", "What one weak spot touches.", "path_to_green");
  A.recoveryCard = function () { return T.card("recovery_sim"); };
})(window);
