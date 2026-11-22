/* Stark Baseline, by Stark: on-device analysis (no DOM, no network). Fuzzy search and plain-question answers over your own records,
   the Path to green planner with a what-if simulator and pace forecast, readiness snapshots for the trend line, and the exposure
   map that follows names you typed to show what one weak spot touches. Everything is a heuristic over what you entered; it does
   not scan anything. Runs in the browser and in Node (tests). Helps you organise and track your security work. */
(function (root) {
  "use strict";
  var V = root.StarkBaseline || (typeof require === "function" ? require("./core.js") : null);
  var C = root.BaselineContent || (typeof require === "function" ? require("./content.js") : null);
  var L = root.BaselineLogic || (typeof require === "function" ? require("./logic.js") : null);

/* full version only */
  // One point per day at most; a new point when the score moves, or once a month as a heartbeat. Returns true when the data changed.
  function snapshot(d, today) {
    var hist = d.history || (d.history = []), last = hist[hist.length - 1], sc = L.scores(d.checks), fns = {}, gap;
    Object.keys(sc.fns).forEach(function (k) { fns[k] = sc.fns[k].pct; });
    if (last && last.id === today) { if (last.pct === sc.overall.pct) return false; last.pct = sc.overall.pct; last.fns = fns; return true; }
    gap = last ? V.daysBetween(last.id, today) : null;
    if (last && last.pct === sc.overall.pct && (gap === null || gap < 30)) return false;
    hist.push({ id: today, pct: sc.overall.pct, fns: fns });
    while (hist.length > 400) hist.shift();
    return true;
  }

/* full version only */
  var api = { snapshot: snapshot };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BaselineSmart = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
