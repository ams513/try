/* Stark Math free trial: the screens of the full-version-only features show a plain card, and the subject list shows only the subjects that are present.
   Trial package only. */
(function () {
  'use strict';
  var SM = window.SM, T = window.StarkTrial, h = SM.h;
  SM.views.countrymaps = function (main) { main.append(h('h1', null, 'Country curriculum maps'), T.card('country_maps')); };
  SM.views.contest = function (main) { main.append(h('h1', null, 'Contests'), T.card('contests')); };
  SM.SUBJECTS = SM.SUBJECTS.filter(function (s) { return SM.SKILLS.some(function (k) { return k.subject === s.id; }); });
})();
