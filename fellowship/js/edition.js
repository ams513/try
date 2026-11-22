/* Stark Fellowship edition and feedback. Offline: nothing here touches a network.
   The paid build has no trial flag. The trial build adds js/trial_on.js (window.STARK_TRIAL = true), which turns on one limit:
   at most TRIAL_PEOPLE people in the directory. Existing records are never deleted or locked, there is no clock, and the
   backup file and CSV export work exactly as in the paid app, so a buyer restores the same file there. */
(function (root) {
  "use strict";
  var APP = "Stark Fellowship", TRIAL_PEOPLE = 15, MAIL = "hello@starkforall.com", SUBJECT = "Stark Fellowship feedback",
    ITCH = "https://starkapps.gumroad.com/l/stark-fellowship", MAXTEXT = 600;
  function K() { return root.StarkCore || (typeof require !== "undefined" ? require("./core.js") : { VERSION: "?" }); }
  function isTrial() { return root.STARK_TRIAL === true; }
  function clean(s) { return String(s == null ? "" : s).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, MAXTEXT); }
  function rate(n) { n = Math.round(+n); return n >= 1 && n <= 5 ? n : 0; }
  // The email text. It holds only what the person typed here plus the app name, version and edition: no records, no names.
  function feedbackBody(f, trial) {
    f = f || {};
    return ["What I like:", clean(f.like) || "-", "", "What is missing:", clean(f.missing) || "-", "", "Rating (1-5): " + (rate(f.rating) || "-"), "",
      "App: " + APP + " " + K().VERSION + (trial ? " (free trial)" : "")].join("\n");
  }
  function feedbackUrl(f, trial) { return "mailto:" + MAIL + "?subject=" + encodeURIComponent(SUBJECT) + "&body=" + encodeURIComponent(feedbackBody(f, trial)); }
  function limitMessage() { return "The free trial holds up to " + TRIAL_PEOPLE + " people. Nothing is deleted, and everything you entered still exports. Buy Stark Fellowship on Gumroad to add more."; }
  // Turn the limit on or off for a community module (done once at start-up, and by tests).
  function apply(M, trial) { M.cap = trial ? { people: TRIAL_PEOPLE, message: limitMessage() } : null; return M; }
  var api = { APP: APP, TRIAL_PEOPLE: TRIAL_PEOPLE, MAIL: MAIL, SUBJECT: SUBJECT, ITCH: ITCH, isTrial: isTrial, feedbackBody: feedbackBody, feedbackUrl: feedbackUrl, limitMessage: limitMessage, apply: apply };
  if (root.StarkCommunity) apply(root.StarkCommunity, isTrial());
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.StarkEdition = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
