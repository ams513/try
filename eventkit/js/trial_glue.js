/* Stark Event Kit free trial: Beam sending is a full-version feature, so its button shows a plain card. Trial package only. */
(function (g) {
  "use strict";
  var S = g.SEK, T = g.StarkTrial;
  S.beamSend = function () { T.show("beam_send"); };
})(typeof window !== "undefined" ? window : globalThis);
