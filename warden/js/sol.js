/* Stark Warden: statute-of-limitations lookups and "is this debt time-barred?" checks. General information only. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var U = SW.util;

  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }
  function fmt(d) { return d.getUTCFullYear() + '-' + U.pad2(d.getUTCMonth() + 1) + '-' + U.pad2(d.getUTCDate()); }
  function addYears(d, n) {
    var r = new Date(d.getTime()), m = r.getUTCMonth();
    r.setUTCFullYear(r.getUTCFullYear() + n);
    if (r.getUTCMonth() !== m) { r.setUTCDate(0); }
    return r;
  }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function diffDays(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }

  function lookup(state, type) {
    var s = SW.data.sol.states[String(state || '').toUpperCase()];
    if (!s || !(type in s) || typeof s[type] !== 'number') { return null; }
    return { years: s[type], state: s, check: s.check };
  }

  /* start = date of last payment or last acknowledgement of the debt, or the date of default if none (states differ). */
  function evaluate(o) {
    var l = lookup(o.state, o.type), start = parseDate(o.start), now = parseDate(o.now) || parseDate(new Date().toISOString()), expiry, days, status, warnings = [];
    if (!l) { return { error: 'Choose a state and debt type.' }; }
    if (!start) { return { error: 'Enter the date of the last payment, or the date you stopped paying.', years: l.years }; }
    expiry = addYears(start, l.years);
    days = diffDays(now, expiry);
    if (days < 0) { status = 'expired'; } else if (days <= 180) { status = 'soon'; } else { status = 'active'; }
    warnings.push('A payment, even a small one, or a written acknowledgement can restart the clock in many states. Do not pay or sign anything on an old debt until you have checked.');
    warnings.push('Time-barred does not mean the debt is gone. A collector may still ask you to pay, but it cannot sue or threaten to sue over a time-barred debt (12 CFR 1006.26(b)).');
    warnings.push('The limit is a defense you must raise yourself if you are sued. If you ignore a lawsuit you can lose by default even when the debt is time-barred.');
    warnings.push('Some contracts choose another state’s law, and being out of state or in bankruptcy can pause (“toll”) the clock. Treat this date as an estimate.');
    if (l.check) { warnings.push('Published sources differ on ' + l.state.name + '. Verify with your attorney general or legal aid before relying on this.'); }
    if (l.state.note) { warnings.push(l.state.note); }
    return { years: l.years, state: l.state, expiry: fmt(expiry), daysLeft: days, status: status, warnings: warnings, check: l.check };
  }

  /* FCRA: most negative items, including collections, can be reported for seven years plus 180 days from the first missed payment that led to them. */
  function reportingDropOff(firstDelinquency) {
    var d = parseDate(firstDelinquency);
    return d ? fmt(addDays(addYears(d, 7), 180)) : null;
  }

  /* Zombie-debt screen: how many classic warning signs does this debt show? */
  function zombie(o) {
    var pts = 0, flags = [];
    function add(w, t) { pts += w; flags.push(t); }
    if (o.timeBarred) { add(3, 'The debt may be past your state’s time limit.'); }
    if (o.ageYears >= 5) { add(1, 'The debt is five or more years old.'); }
    if (o.sold) { add(1, 'It has been sold or transferred.'); }
    if (o.unfamiliar) { add(2, 'You do not recognise the creditor or collector.'); }
    if (o.amountUp) { add(1, 'The balance is higher than the original amount.'); }
    if (o.noOriginalCreditor) { add(2, 'No one has named the original creditor.'); }
    if (o.datesMoved) { add(3, 'The first-delinquency date differs between sources (possible re-aging).'); }
    return { points: pts, flags: flags, level: pts >= 6 ? 'high' : (pts >= 3 ? 'possible' : 'low') };
  }

  /* Re-aging check: dates [{label, date}] for the first missed payment as shown by different sources. */
  function reage(dates) {
    var ok = (dates || []).filter(function (d) { return parseDate(d.date); }), earliest, latest, flagged;
    if (ok.length < 2) { return { enough: false, differs: false, flagged: [], spreadDays: 0 }; }
    ok.sort(function (a, b) { return parseDate(a.date) - parseDate(b.date); });
    earliest = ok[0]; latest = ok[ok.length - 1];
    flagged = ok.filter(function (d) { return diffDays(parseDate(earliest.date), parseDate(d.date)) > 31; });
    return { enough: true, earliest: earliest, latest: latest, spreadDays: diffDays(parseDate(earliest.date), parseDate(latest.date)), differs: flagged.length > 0, flagged: flagged };
  }

  SW.sol = { zombie: zombie, reage: reage, lookup: lookup, evaluate: evaluate, reportingDropOff: reportingDropOff, parseDate: parseDate, fmt: fmt, addDays: addDays, addYears: addYears, diffDays: diffDays };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.sol; }
})(typeof window !== 'undefined' ? window : globalThis);
