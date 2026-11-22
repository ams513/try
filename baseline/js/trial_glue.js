/* Stark Baseline free trial glue. Trial package only. The planner, the exposure map, the recovery card, the GDPR and NIS2 views and the policy pack show a card in place of the code
   (it is not in this package). The records, checklist, runbook and printouts are untouched. */
(function (root) {
  "use strict";
  var A = root.BaselineApp, T = root.StarkTrial, h = root.BaselineUI.h;
  function page(title, sub, id) { return function () { return h("div", null, A.section(title, sub), T.card(id)); }; }
  A.views.plan = page("Path to green", "Which unfinished steps move your score the most.", "path_to_green");
  A.views.map = page("Exposure map", "What one weak spot touches.", "path_to_green");
  A.recoveryCard = function () { return T.card("recovery_sim"); };
  A.views.gdpr = page("GDPR view", "A self-check aid, not a certification. Not legal advice.", "eu_views");
  A.views.nis2 = page("NIS2 view", "A self-check aid, not a certification. Not legal advice.", "eu_views");
  A.views.policies = page("Policy template pack", "A self-check aid, not a certification. Not legal advice.", "policy_pack");
})(window);
