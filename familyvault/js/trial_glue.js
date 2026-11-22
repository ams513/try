/* Stark Family Vault free trial: the pages and buttons of the full-version-only features show a plain card. Trial package only. */
(function () {
  "use strict";
  var A = window.VaultApp, U = window.VaultUI, T = window.StarkTrial, h = U.h;
  A.views.recovery = function () {
    return h("div", null, A.section("Recovery kit", "Protect the family from a lost passphrase."), T.card("recovery_shares"));
  };
  A.recoverDialog = function () { T.show("recovery_shares"); };
  A.views.pack = function () { return h("div", null, A.section("Emergency access pack", "A sealed copy for one trusted person."), T.card("emergency_pack")); };
  A.svPackOpenDialog = function () { T.show("emergency_pack"); };
  A.beamSend = function () { T.show("beam_send"); };
  A.ext.shareCards = function (wrap) { wrap.appendChild(T.card("emergency_pack")); wrap.appendChild(T.card("merge_in")); };
})();
