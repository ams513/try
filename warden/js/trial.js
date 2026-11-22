/* Stark Warden: free-trial rules (pure, no storage, no network). The single limit: a trial keeps up to LIMIT evidence-log entries.
   It never expires, never deletes or hides anything you saved, and everything exports (Settings > backup) into the paid app. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  function ed() { return SW.edition || {}; }
  function on() { return ed().trial === true; }
  function limit() { var n = ed().limit; return typeof n === 'number' && n > 0 ? Math.floor(n) : 15; }
  /* count: entries already saved. Existing entries over the cap (for example a restored backup) are kept untouched. */
  function canAdd(count) { return !on() || (Number(count) || 0) < limit(); }
  function blockedMessage() {
    return 'Free trial: the log holds ' + limit() + ' entries. Everything you saved is kept and still exports. Your data is never deleted. Own it forever to remove the limit.';
  }
  function buyUrl() { var u = String(ed().buyUrl || ''); return /^https:\/\/[a-z0-9.-]+\.itch\.io\/[a-z0-9-]+$/i.test(u) ? u : ''; }
  SW.trial = { on: on, limit: limit, canAdd: canAdd, blockedMessage: blockedMessage, buyUrl: buyUrl, BUY_LABEL: 'Own it forever: buy on itch.io' };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.trial; }
})(typeof window !== 'undefined' ? window : globalThis);
