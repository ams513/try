/* Stark Warden: Regulation F validation-period dates, business-day math, and .ics calendar export. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var U = SW.util;
  var S = function () { return SW.sol; };

  function nthWeekday(y, month, weekday, n) {   /* month 0-11, weekday 0=Sun, n=1..; n=-1 means last */
    var d, first, day;
    if (n > 0) {
      first = new Date(Date.UTC(y, month, 1)).getUTCDay();
      day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
    } else {
      d = new Date(Date.UTC(y, month + 1, 0));
      day = d.getUTCDate() - ((d.getUTCDay() - weekday + 7) % 7);
    }
    return new Date(Date.UTC(y, month, day));
  }

  /* Legal public holidays (5 U.S.C. 6103(a)) on their actual dates. */
  function holidays(y) {
    return [new Date(Date.UTC(y, 0, 1)), nthWeekday(y, 0, 1, 3), nthWeekday(y, 1, 1, 3), nthWeekday(y, 4, 1, -1), new Date(Date.UTC(y, 5, 19)),
      new Date(Date.UTC(y, 6, 4)), nthWeekday(y, 8, 1, 1), nthWeekday(y, 9, 1, 2), new Date(Date.UTC(y, 10, 11)), nthWeekday(y, 10, 4, 4),
      new Date(Date.UTC(y, 11, 25))].map(S().fmt);
  }

  function isBusinessDay(d) {
    var dow = d.getUTCDay();
    return dow !== 0 && dow !== 6 && holidays(d.getUTCFullYear()).indexOf(S().fmt(d)) < 0;
  }

  /* "At least five days (excluding legal public holidays, Saturdays and Sundays) after" the notice is provided. */
  function addBusinessDays(d, n) {
    var r = new Date(d.getTime()), c = 0;
    while (c < n) {
      r = S().addDays(r, 1);
      if (isBusinessDay(r)) { c++; }
    }
    return r;
  }

  /* 12 CFR 1006.34(b)(5): the validation period starts when the consumer receives (or is assumed to receive) the notice and lasts 30 days. */
  function validationWindow(sent, statedEnd) {
    var d = S().parseDate(sent), recv, end;
    if (!d) { return null; }
    recv = addBusinessDays(d, 5);
    end = S().addDays(recv, 30);
    return {
      sent: S().fmt(d), assumedReceived: S().fmt(recv), endsOn: statedEnd && S().parseDate(statedEnd) ? statedEnd : S().fmt(end), computedEnd: S().fmt(end),
      note: 'Reg F lets a collector assume you received the notice five business days after it was sent. The end date printed on your notice is the one to follow; if it differs from this estimate, send your dispute early.'
    };
  }

  function icsEscape(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {
    var out = [], i = 0;
    while (line.length - i > 73) { out.push(line.slice(i, i + 73)); i += 73; }
    out.push(line.slice(i));
    return out.join('\r\n ');
  }
  function stamp(now) {
    var d = now || new Date();
    return d.getUTCFullYear() + U.pad2(d.getUTCMonth() + 1) + U.pad2(d.getUTCDate()) + 'T' + U.pad2(d.getUTCHours()) + U.pad2(d.getUTCMinutes()) + U.pad2(d.getUTCSeconds()) + 'Z';
  }

  /* events: [{id, date:'YYYY-MM-DD', title, desc}] -> iCalendar text with a one-day-before reminder. */
  function toICS(events, now) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stark//Stark Warden//EN', 'CALSCALE:GREGORIAN'], st = stamp(now);
    events.forEach(function (e, i) {
      var d = S().parseDate(e.date), n;
      if (!d) { return; }
      n = S().addDays(d, 1);
      lines.push('BEGIN:VEVENT', 'UID:' + (e.id || ('sw' + i)) + '-' + S().fmt(d) + '@stark-warden.local', 'DTSTAMP:' + st,
        'DTSTART;VALUE=DATE:' + S().fmt(d).replace(/-/g, ''), 'DTEND;VALUE=DATE:' + S().fmt(n).replace(/-/g, ''),
        fold('SUMMARY:' + icsEscape(e.title)), fold('DESCRIPTION:' + icsEscape((e.desc || '') + ' (General information, not legal advice. Check your own paperwork for the exact date.)')),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  SW.deadlines = { holidays: holidays, isBusinessDay: isBusinessDay, addBusinessDays: addBusinessDays, validationWindow: validationWindow, toICS: toICS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.deadlines; }
})(typeof window !== 'undefined' ? window : globalThis);
