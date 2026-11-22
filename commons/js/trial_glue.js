/* Stark Commons free trial: the places where the app calls the Lab show a plain card instead. Trial package only. */
(function () {
  'use strict';
  var T = window.StarkTrial;
  window.SC_LAB_GLYPH = function () { return null; };
  window.SC_LAB_EDITOR = function () { return document.createElement('div'); };
  window.SC_LAB_VIEW = function (ctx) { ctx.clear(ctx.main); ctx.main.appendChild(T.card('lab')); };
  window.SC_LAB_FINDER = { install: function () {}, open: function () { T.show('lab'); } };
})();
