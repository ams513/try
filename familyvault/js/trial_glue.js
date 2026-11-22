/* Stark Family Vault free trial: the pages and buttons of the full-version-only features show a plain card. Trial package only. */
(function () {
  "use strict";
  var A = window.VaultApp, U = window.VaultUI, T = window.StarkTrial, h = U.h;
  A.views.recovery = function () {
    return h("div", null, A.section("Recovery kit", "Protect the family from a lost passphrase."), T.card("recovery_shares"));
  };
  A.recoverDialog = function () { T.show("recovery_shares"); };
})();
