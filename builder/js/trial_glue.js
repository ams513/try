/* Stark Builder free trial: the Project tab cards and palette commands of the full-version-only features show a plain card. Trial package only. */
(function () {
  'use strict';
  const SB = window.SB, app = SB.app, T = window.StarkTrial;
  const toProject = id => { app.say(T.say(id)); location.hash = '#/project'; };
  app.scaledCard = () => T.card('scaled_plans');
  app.pictureCard = () => T.card('picture_export');
  app.scaled = { go: () => toProject('scaled_plans') };
  app.picture = { focus: null, go: () => toProject('picture_export'), showSheet: () => toProject('picture_export') };
})();
