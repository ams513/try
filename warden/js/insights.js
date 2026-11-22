/* Stark Warden: on-device call pattern insights. A week-by-hour heat map of collector contacts, a weekly trend, and a per-collector
   "call budget" under the Regulation F call-frequency presumptions (12 CFR 1006.14(b)(2)): more than 7 call attempts in 7 days,
   or a call within 7 days after a phone conversation, is presumed to be harassment. These are counts from your own log with fixed
   rules, not legal conclusions. Pure functions; no DOM, no network, no storage. Times are wall-clock minutes in your time zone. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var DAY = 1440, WEEK = 7 * DAY, LIMIT = 7, MAX_ROWS = 20000;
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  /* collector-started contacts with a usable date, sorted by time (capped so a huge log cannot stall the page). Date-only
     entries count as noon, the same as the violation timeline, so the call budget and the 7-in-7 flag agree; the heat map
     needs an hour and skips them. */
  function rows(log, tz) {
    var out = [], i, e, p, src = Array.isArray(log) ? log.slice(-MAX_ROWS) : [];
    for (i = 0; i < src.length; i++) {
      e = src[i];
      if (!e || typeof e !== 'object' || e.dir === 'consumer') { continue; }
      p = SW.violations.localParts(e.at, tz);
      if (p) { out.push({ e: e, p: p, call: e.channel === 'call' || e.channel === 'voicemail' }); }
    }
    return out.sort(function (a, b) { return a.p.epoch - b.p.epoch; });
  }
  /* Monday = 0 ... Sunday = 6 (epoch 0 is a Thursday) */
  function dow(epoch) { return (Math.floor(epoch / DAY) + 3) % 7; }
  function odd(p) { return p.minutes < 8 * 60 || p.minutes > 21 * 60; }

  function heatmap(log, tz) {
    var grid = [], r = rows(log, tz).filter(function (x) { return x.e.channel !== 'letter' && !x.p.dateOnly; }), max = 0, outside = 0, d, best = null;
    for (d = 0; d < 7; d++) { grid.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); }
    r.forEach(function (x) {
      var g = grid[dow(x.p.epoch)], v = ++g[x.p.h];
      if (v > max) { max = v; best = { day: DAYS[dow(x.p.epoch)], hour: x.p.h, n: v }; }
      if (odd(x.p)) { outside++; }
    });
    return { grid: grid, max: max, total: r.length, outside: outside, busiest: best, days: DAYS };
  }

  /* calls per week for the last `weeks` weeks ending at now, oldest first, and a least-squares slope (calls per week, per week) */
  function trend(log, tz, now, weeks) {
    var n = weeks || 6, counts = [], i, sx = 0, sy = 0, sxy = 0, sxx = 0, slope, start = now - n * WEEK, dir;
    for (i = 0; i < n; i++) { counts.push(0); }
    rows(log, tz).forEach(function (x) { var k; if (x.call && x.p.epoch > start && x.p.epoch <= now) { k = Math.min(n - 1, Math.floor((x.p.epoch - start) / WEEK)); counts[k]++; } });
    for (i = 0; i < n; i++) { sx += i; sy += counts[i]; sxy += i * counts[i]; sxx += i * i; }
    slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    dir = slope >= 0.5 && counts[n - 1] > counts[0] ? 'rising' : slope <= -0.5 && counts[n - 1] < counts[0] ? 'falling' : 'steady';
    return { counts: counts, slope: Math.round(slope * 10) / 10, dir: dir, total: sy };
  }

  /* Per debt (or collector): calls used in the last 7 days, calls left before the 7-in-7 presumption, and the moment the
     presumption stops covering a new call (the later of the 7-day window and 7 days after the last conversation). */
  function budget(log, tz, now) {
    var groups = {}, out = [];
    rows(log, tz).forEach(function (x) { var k; if (!x.call || x.p.epoch > now) { return; } k = String(x.e.debtRef || x.e.collector || 'All calls').trim() || 'All calls'; (groups[k] = groups[k] || []).push(x); });
    Object.keys(groups).forEach(function (k) {
      var arr = groups[k], win = arr.filter(function (x) { return x.p.epoch > now - WEEK; }), used = win.length, quiet = 0, why = [], talk = null, i;
      if (used >= LIMIT) { quiet = win[used - LIMIT].p.epoch + WEEK; why.push('7 calls in 7 days'); }
      for (i = arr.length - 1; i >= 0; i--) { if (arr[i].e.spoke && arr[i].p.epoch > now - WEEK) { talk = arr[i]; break; } }
      if (talk && talk.p.epoch + WEEK > quiet) { quiet = talk.p.epoch + WEEK; why.unshift('a phone conversation on ' + talk.p.day); }
      else if (talk) { why.push('a phone conversation on ' + talk.p.day); }
      out.push({ name: k, used: used, left: Math.max(0, LIMIT - used), over: Math.max(0, used - LIMIT), quietUntil: quiet > now ? quiet : 0, minutesLeft: quiet > now ? quiet - now : 0, why: why, last: arr[arr.length - 1].p.day });
    });
    return out.sort(function (a, b) { return b.used - a.used || b.minutesLeft - a.minutesLeft || (a.name < b.name ? -1 : 1); });
  }

  function hourLabel(h) { return h === 0 ? '12 a.m.' : h < 12 ? h + ' a.m.' : h === 12 ? '12 p.m.' : (h - 12) + ' p.m.'; }
  function span(min) { var d = Math.floor(min / DAY), hh = Math.floor((min % DAY) / 60), mm = min % 60; return (d ? d + ' d ' : '') + (d || hh ? hh + ' h ' : '') + mm + ' min'; }
  function stamp(epoch) { var d = new Date(epoch * 60000), U = SW.util; return DAYS[dow(epoch)].slice(0, 3) + ' ' + d.getUTCFullYear() + '-' + U.pad2(d.getUTCMonth() + 1) + '-' + U.pad2(d.getUTCDate()) + ' ' + U.pad2(d.getUTCHours()) + ':' + U.pad2(d.getUTCMinutes()); }

  /* plain sentences for the top of the screen; facts about the log only */
  function observations(log, tz, now) {
    var hm = heatmap(log, tz), tr = trend(log, tz, now, 6), bd = budget(log, tz, now), out = [], work;
    if (!rows(log, tz).length) { return ['No collector contacts with a date are logged yet. Log each call, voicemail and text to see patterns here.']; }
    if (hm.busiest) { out.push('Busiest time: ' + hm.busiest.day + 's around ' + hourLabel(hm.busiest.hour) + ' (' + hm.busiest.n + (hm.busiest.n === 1 ? ' contact' : ' contacts') + ').'); }
    if (hm.outside) { out.push(hm.outside + ' of ' + hm.total + ' contacts came before 8 a.m. or after 9 p.m. your time. Those hours are treated as inconvenient unless you agreed to them.'); }
    if (tr.total) { out.push(tr.dir === 'rising' ? 'Calls are rising: ' + tr.counts.join(', ') + ' per week over the last 6 weeks.' : tr.dir === 'falling' ? 'Calls are falling: ' + tr.counts.join(', ') + ' per week over the last 6 weeks.' : 'Calls are steady: ' + tr.counts.join(', ') + ' per week over the last 6 weeks.'); }
    bd.filter(function (b) { return b.over > 0; }).forEach(function (b) { out.push(b.name + ': ' + b.used + ' calls in the last 7 days, ' + b.over + ' more than the 7-call presumption.'); });
    work = rows(log, tz).filter(function (x) { return x.e.atWork; }).length;
    if (work) { out.push(work + (work === 1 ? ' contact reached' : ' contacts reached') + ' you at work. If you told them your employer does not allow it, note the date you said so.'); }
    return out;
  }

  SW.insights = { heatmap: heatmap, trend: trend, budget: budget, observations: observations, hourLabel: hourLabel, span: span, stamp: stamp, dow: dow, LIMIT: LIMIT, DAYS: DAYS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.insights; }
})(typeof window !== 'undefined' ? window : globalThis);
