/* Stark Homeroom 1.2: the printable records. Pure functions (no DOM, no storage, no network) that gather what the app
   already keeps into three documents: an attendance and hours report, a portfolio report and a one-learner year summary.
   Every number comes from the existing functions (attendanceSummary, hoursSummary, courseRows, transcript, itemsFor);
   nothing here is a second calculator. hublib.js installs this into SHR.lib and tests/test_homeroom.py runs it in node. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  /* the plain line every report and the summary carries, in the document and in the page footer of the printout */
  const NOTE = 'This is a record kept by the family. It is not a statement of legal compliance.';
  const PAPER = { a4: { label: 'A4', size: '210 x 297 mm' }, letter: { label: 'US Letter', size: '8.5 x 11 in' } };
  function install() { return {}; }
  SHR.reports = { install, NOTE, PAPER };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHR.reports;
})(typeof window !== 'undefined' ? window : globalThis);
