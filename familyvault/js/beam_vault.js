/* Stark Family Vault 1.6.0: Beam, receiving side and the card on the Sharing page. Moves a sealed copy of the vault between two devices with no network,
   screen to camera (shared library: js/beam/, screens: beam_ui.js). Only the vault backup, already encrypted with the vault passphrase, travels; whatever
   arrives goes through the same passphrase prompt as a backup file. The sending side is a separate module (beam_vault_send.js), full version only.
   Wire format of the beamed bytes: 0x46, 0x01, 4 byte header length, the backup envelope as JSON with its ciphertext emptied, then the raw ciphertext. */
(function (root) {
  "use strict";
  var V = root.StarkVault || (typeof require === "function" ? require("./core.js") : null), MAGIC = 0x46, WIRE = 1, MAX_HEADER = 4096;
  var dec = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { fatal: true }) : null;

  /* the beamed bytes -> { env } (a sealed vault backup that passed the same checks as a backup file) or { error } */
  function unpack(b) {
    var hl, env, ct, bad = "What arrived is not a Stark Family Vault backup. Nothing was kept.";
    if (!b || b.length < 8 || b[0] !== MAGIC || b[1] !== WIRE) return { error: bad };
    hl = ((b[2] << 24) | (b[3] << 16) | (b[4] << 8) | b[5]) >>> 0;
    if (hl < 2 || hl > MAX_HEADER || 6 + hl >= b.length) return { error: bad };
    try { env = JSON.parse(dec.decode(b.subarray(6, 6 + hl))); } catch (e) { return { error: bad }; }
    if (!env || typeof env !== "object" || env.ct !== "") return { error: bad };
    ct = b.subarray(6 + hl); env.ct = V.b64(ct);
    if (V.validateEnvelope(env) || env.kind !== "vault") return { error: bad };
    return { env: env };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { unpack: unpack, MAGIC: MAGIC, WIRE: WIRE, MAX_HEADER: MAX_HEADER };
  if (typeof document === "undefined" || !root.VaultApp) return;

  var A = root.VaultApp, U = root.VaultUI, h = U.h, btn = A.btn;
  A.beamUnpack = unpack;
  /* opens the camera screen; onEnv(env) runs once a vault backup has arrived whole and checked */
  A.beamReceive = function (onEnv) {
    if (!root.StarkBeamUI) return U.toast("Beam is not available in this build.", true);
    root.StarkBeamUI.receive({ app: "Stark Family Vault", modal: U.modal, maxBytes: 6000000, text: { limits: "This moves a copy of the whole vault; it does not keep two devices in sync. Camera quality and light matter, and a vault with many scans takes much longer." }, keepAwake: function () { if (A.S) A.S.last = Date.now(); }, accept: function (bytes) {
      var r = unpack(bytes); if (r.error) return r;
      setTimeout(function () { onEnv(r.env); }, 0); return {};
    } });
  };
  /* the card on the Sharing page (a vault is open there: what arrives replaces it or is merged in, and the user chooses) */
  A.beamCard = function () {
    return h("div", { class: "card", id: "beam-card" }, h("h2", { text: "Move to another device" }),
      h("p", { class: "muted", text: "No network. Your phone's camera reads the codes on this screen. Your data stays sealed; you need your passphrase on the other device." }),
      h("div", { class: "row wrap" }, btn("Beam to another device", "primary", function () { if (A.beamSend) A.beamSend(); }),
        btn("Receive from another device", "", function () { A.beamReceive(function (env) { A.restoreFrom(env, "the vault on the other device"); }); }),
        A.svMergeEnv ? btn("Receive and merge in", "", function () { A.beamReceive(function (env) { A.svMergeEnv(env, "the vault on the other device"); }); }) : null),
      h("p", { class: "fine", text: "It moves a copy of the whole vault: it does not keep two devices in sync. Receiving asks for the other vault's passphrase; receive and replace overwrites the vault on this computer, receive and merge in shows what is new and what differs first (merge is in the full version). Camera quality and light matter, and a large vault with many scans takes longer. A browser without its own code reader uses a slower built-in one." }));
  };
})(typeof window !== "undefined" ? window : globalThis);
