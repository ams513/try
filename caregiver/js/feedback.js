/* Stark Caregiver, by Stark: the feedback email and the free-trial limit. Pure functions, no DOM, no network.
   Feedback is only ever a mailto: link the person's own mail app opens; nothing is sent by this page.
   The trial build adds window.CareTrial (tools/trial/trial.js). The paid build has none, so every check here is a no-op there. */
(function (root) {
  "use strict";
  var TO = "hello@starkforall.com", SUBJECT = "Stark Caregiver feedback", APP = "Stark Caregiver", MAXTXT = 800;

  function clip(s) { s = String(s == null ? "" : s).replace(/\r\n?/g, "\n").trim(); return s.length > MAXTXT ? s.slice(0, MAXTXT) : s; }
  function rating(r) { var n = parseInt(r, 10); return n >= 1 && n <= 5 ? n : 0; }

  // The body holds the app name, version, build, a rating and the two notes the person typed. Never anything from the care record.
  function compose(o) {
    var r = rating(o.rating), body = [
      "App: " + APP, "Version: " + (o.version || ""), "Build: " + (o.trial ? "Free trial" : "Full"), "Rating (1-5): " + (r || "not given"), "",
      "What I like:", clip(o.liked) || "-", "", "What is missing:", clip(o.missing) || "-"].join("\n");
    return "mailto:" + TO + "?subject=" + encodeURIComponent(SUBJECT) + "&body=" + encodeURIComponent(body);
  }

  /* ---- free trial: at most `limit` medicines and diary entries together. Doses, check-ins, the rota, exports and backups are never limited,
     nothing is ever deleted, and an over-limit record (for example a restored backup) stays fully usable. ---- */
  function used(trial, vault) {
    var n = 0; ((trial && trial.kinds) || []).forEach(function (k) { n += vault && Array.isArray(vault[k]) ? vault[k].length : 0; });
    return n;
  }
  function left(trial, vault) { return trial ? Math.max(0, trial.limit - used(trial, vault)) : Infinity; }
  // May one more record of `kind` be added? Editing an existing record never goes through this.
  function canAdd(trial, vault, kind) {
    if (!trial) return true;
    if ((trial.kinds || []).indexOf(kind) < 0) return true;
    return used(trial, vault) < trial.limit;
  }
  function buyOk(trial) { return !!trial && /^https:\/\/[a-z0-9-]+\.itch\.io\/[a-z0-9-]+$/.test(trial.buyUrl || ""); }

  var api = { TO: TO, SUBJECT: SUBJECT, compose: compose, rating: rating, used: used, left: left, canAdd: canAdd, buyOk: buyOk };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CareFeedback = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
