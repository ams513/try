/* Stark Tenancy: free-trial rules (pure; no storage, no network). The one limit: at most 15 saved records (condition reports, repairs, rent entries)
   across your own tenancies. Never time-limited. Nothing is ever deleted or locked: existing records stay readable, editable and exportable. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  var CAP = 15, LISTS = ['reports', 'repairs', 'ledger'];
  function on() { return !!(TN.data && TN.data.edition && TN.data.edition.trial === true); }
  function isList(k) { return LISTS.indexOf(k) >= 0; }
  /* does a stored key belong to a counted list of a real (non-example) tenancy? */
  function counted(storageKey) {
    var m = /^stn:p:([A-Za-z0-9_-]{1,60}):(reports|repairs|ledger)$/.exec(String(storageKey || ''));
    return !!m && m[1] !== 'example';
  }
  /* total records in the stored JSON strings of the counted keys */
  function used(rawValues) {
    return (rawValues || []).reduce(function (n, raw) { try { var a = JSON.parse(raw); return n + (Array.isArray(a) ? a.length : 0); } catch (e) { return n; } }, 0);
  }
  /* may a list go from oldLen to newLen records when the trial total is `total`? Shrinking and same-size edits always pass. */
  function allows(total, oldLen, newLen) { return !on() || newLen <= oldLen || total - oldLen + newLen <= CAP; }
  TN.trial = { CAP: CAP, LISTS: LISTS, on: on, isList: isList, counted: counted, used: used, allows: allows };
  if (typeof module !== 'undefined' && module.exports) { module.exports = TN.trial; }
})(typeof window !== 'undefined' ? window : globalThis);
