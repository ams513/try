/* Stark Fellowship free trial glue. Trial package only. The Children, Groups and Insights screens, and the Pulse card on Home, show a card in place of the code
   (it is not in this package). Plain check-in, the people directory, rotas, giving, care and backup are untouched. */
(function () {
  "use strict";
  var A = window.FellowApp, T = window.StarkTrial, U = window.FellowUI, h = U.h;
  function page(title, sub, id) { return function () { var b = h("div"); b.appendChild(A.sec(title, sub)); b.appendChild(T.card(id)); return b; }; }
  A.views.kids = page("Children", "Name labels, pickup slips and the children's register.", "kids_checkin");
  A.views.groups = page("Groups", "Meeting times, a month calendar and attendance.", "small_groups");
  A.NAV.splice(1, 0, ["insights", "Insights", "people"]);
  A.views.insights = page("Insights", "Forecasts, drift, giving pulse and the rota what-if.", "insights");
  A.homeInsight = function () { return h("div", { class: "card" }, h("h2", { text: "Insights" }), h("p", { class: "muted", text: "Forecasts and search across your records are in the full version." }), h("a", { href: "#/insights", text: "See what they do" })); };
})();
