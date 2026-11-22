/* Stark Resonance Free trial layer. Shipped only in dist/StarkResonance_trial_web.zip (the build copies it to js/trial.js and adds
   its script tag). Two limits: one lab is playable (the rotating field and induction motor) and at most 3 experiments can be saved.
   The history timeline, the myth table, the frontier section and the About page stay fully open. Never time-limited, never deletes
   anything the person saved; a backup file made here restores in the full version. Fully offline. */
(function (root) {
  "use strict";
  var T = { free: ["field"], saveLimit: 3, store: "https://starkapps.gumroad.com/l/stark-resonance" };
  T.allows = function (id) { return T.free.indexOf(id) >= 0; };
  root.STARK_TRIAL = T;
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(typeof window !== "undefined" ? window : globalThis);
