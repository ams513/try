/* Stark Homeroom free trial glue. Trial package only. The three report pages show a card instead of the report code (it is not in this package).
   Every page keeps the plain line the printed records always carry. */
(function () {
  'use strict';
  var SHR = window.SHR = window.SHR || {}, T = window.StarkTrial;
  SHR.reportViews = function (X, HV) {
    var h = X.h;
    function page(title, tab) {
      return function () {
        var b = h('div');
        b.append(HV.repTabs(tab), h('h1', null, title), T.card('printed_reports'), h('p', { class: 'small muted' }, SHR.reports.NOTE));
        return b;
      };
    }
    return { hoursreport: page('Attendance and hours report', 'hoursreport'), portreport: page('Portfolio report', 'portreport'), yearsummary: page('Year summary', 'yearsummary') };
  };
})();
