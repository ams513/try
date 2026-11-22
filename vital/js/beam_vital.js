/* Stark Vital 1.2.0: Beam, receiving side and the Data card. Moves a sealed copy of the notebook between two devices with no network,
   screen to camera (shared library: js/beam/, screens: beam_ui.js). Only the encrypted backup travels; whatever arrives goes through the
   same passphrase prompt and preview as a backup file. The sending side is a separate module (beam_vital_send.js).
   Wire format of the beamed bytes: 0x56, 0x01, 4 byte header length, the backup bundle as JSON with its ciphertext emptied, then the raw ciphertext. */
(function (root) {
  "use strict";
  var V = root.StarkVital || (typeof require === "function" ? require("./core.js") : null), MAGIC = 0x56, WIRE = 1, MAX_HEADER = 4096;
  var dec = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { fatal: true }) : null;

  /* the beamed bytes -> { env } (a sealed envelope that passed the same checks as a backup file) or { error } */
  function unpack(b) {
    var hl, bundle, ct, why, bad = "What arrived is not a Stark Vital notebook. Nothing was kept.";
    if (!b || b.length < 8 || b[0] !== MAGIC || b[1] !== WIRE) return { error: bad };
    hl = ((b[2] << 24) | (b[3] << 16) | (b[4] << 8) | b[5]) >>> 0;
    if (hl < 2 || hl > MAX_HEADER || 6 + hl >= b.length) return { error: bad };
    try { bundle = JSON.parse(dec.decode(b.subarray(6, 6 + hl))); } catch (e) { return { error: bad }; }
    if (!bundle || typeof bundle !== "object" || !bundle.main || typeof bundle.main !== "object" || bundle.main.ct !== "") return { error: bad };
    ct = b.subarray(6 + hl); bundle.main.ct = V.b64(ct);
    why = V.validateBundle(bundle); if (why) return { error: bad };
    return { env: bundle.main };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { unpack: unpack, MAGIC: MAGIC, WIRE: WIRE, MAX_HEADER: MAX_HEADER };
  if (typeof document === "undefined" || !root.VitalApp) return;

  var A = root.VitalApp, U = root.VitalUI, h = U.h, btn = A.btn;
  A.beamUnpack = unpack;
  /* opens the camera screen; onEnv(env) runs once a notebook has arrived whole and checked */
  A.beamReceive = function (onEnv) {
    if (!root.StarkBeamUI) return U.toast("Beam is not available in this build.", true);
    root.StarkBeamUI.receive({ app: "Stark Vital", modal: U.modal, maxBytes: 6000000, keepAwake: function () { A.S.last = Date.now(); }, accept: function (bytes) {
      var r = unpack(bytes); if (r.error) return r;
      setTimeout(function () { onEnv(r.env); }, 0); return {};
    } });
  };
  /* the card in Data */
  A.beamCard = function () {
    return h("div", { class: "card", id: "beam-card" }, h("h2", { text: "Move to another device" }),
      h("p", { class: "muted", text: "No network. Your phone's camera reads the codes on this screen. Your notebook stays sealed; you need your passphrase on the other device." }),
      h("div", { class: "row" }, btn("Beam to another device", "primary", function () { if (A.beamSend) A.beamSend(); }), btn("Receive from another device", "", function () { A.beamReceive(function (env) { A.importEnv(env, "the notebook on the other device"); }); })),
      h("p", { class: "fine", text: "It moves a copy: it does not keep two devices in sync. Camera quality and light matter, and a very large notebook takes longer. A browser without its own code reader uses a slower built-in one. See About for the details." }));
  };
})(typeof window !== "undefined" ? window : globalThis);
