/* Stark Tenancy: which edition this is. The paid build ships this file as is; the trial zip swaps in a copy with trial: true (tools/build_web_zip.py). */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  TN.data = TN.data || {};
  TN.data.edition = { trial: true };
})(typeof window !== 'undefined' ? window : globalThis);
