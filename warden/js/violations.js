/* Stark Warden: FDCPA / Regulation F pattern checker for a contact log, evidence packet and complaint drafts.
   It flags PATTERNS worth raising with a regulator or attorney. It cannot decide whether the law was broken. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var U = SW.util;
  var DAY = 1440;

  /* Wall-clock time in the consumer's time zone. `at` is "YYYY-MM-DD HH:MM" (already local) or an ISO string with Z / offset. */
  function localParts(at, tz) {
    var s = String(at || ''), m, d, parts, o = {}, p;
    if (/(?:Z|[+-]\d\d:?\d\d)$/.test(s) && /T/.test(s)) {
      d = new Date(s);
      if (isNaN(d.getTime())) { return null; }
      parts = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
      parts.forEach(function (x) { o[x.type] = x.value; });
      p = { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute };
    } else {
      m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(s);
      if (!m) {
        m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        if (!m) { return null; }
        p = { y: +m[1], m: +m[2], d: +m[3], h: 12, mi: 0, dateOnly: true };
      } else { p = { y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5] }; }
    }
    p.minutes = p.h * 60 + p.mi;
    p.day = p.y + '-' + U.pad2(p.m) + '-' + U.pad2(p.d);
    p.epoch = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) / 60000;
    return p;
  }

  var FLAGS = {
    threatArrest: { t: 'Threatened arrest or jail', cite: '15 U.S.C. 1692e(4), 1692e(5); 12 CFR 1006.18', sev: 'likely', why: 'A collector cannot threaten arrest or imprisonment for not paying a consumer debt, nor threaten action it cannot legally take.' },
    threatSuit: { t: 'Threatened a lawsuit or action it did not intend or could not take', cite: '15 U.S.C. 1692e(5)', sev: 'possible', why: 'Threatening legal action that is not intended or not legally possible is prohibited.' },
    threatTimeBarred: { t: 'Sued or threatened to sue on a possibly time-barred debt', cite: '12 CFR 1006.26(b)', sev: 'likely', why: 'A collector may not sue or threaten to sue to collect a time-barred debt (one past the state time limit to sue).' },
    violence: { t: 'Threatened violence or harm', cite: '15 U.S.C. 1692d(1)', sev: 'likely', why: 'Threats of violence or harm to a person, reputation or property are prohibited.' },
    profanity: { t: 'Profane or abusive language', cite: '15 U.S.C. 1692d(2)', sev: 'likely', why: 'Obscene, profane or abusive language is prohibited.' },
    falseAmount: { t: 'Claimed a wrong amount or added unauthorized fees', cite: '15 U.S.C. 1692e(2)(A), 1692f(1)', sev: 'possible', why: 'Collectors may not misstate the debt or collect amounts not authorized by the agreement or law.' },
    falseLawyer: { t: 'Falsely implied an attorney is involved', cite: '15 U.S.C. 1692e(3)', sev: 'possible', why: 'A collector may not falsely imply that a communication is from a lawyer.' },
    falseGov: { t: 'Falsely implied government or court connection', cite: '15 U.S.C. 1692e(1), 1692e(9)', sev: 'likely', why: 'Falsely suggesting the collector is part of a government agency or that papers are legal process is prohibited.' },
    noDisclosure: { t: 'Did not say it was a debt collector', cite: '15 U.S.C. 1692e(11)', sev: 'possible', why: 'In later contacts the collector must disclose that it is a debt collector, and in the first it must state it is attempting to collect a debt.' },
    discloseThird: { t: 'Discussed the debt with someone else', cite: '15 U.S.C. 1692c(b), 1692b(2)', sev: 'likely', why: 'Collectors may not tell family, coworkers or neighbors about the debt, and may only contact others to find where you are.' },
    envelopeShowsDebt: { t: 'Envelope or card showed it was about a debt', cite: '15 U.S.C. 1692f(7), 1692f(8); 12 CFR 1006.22', sev: 'possible', why: 'Collectors may not put anything on an envelope, other than the collector’s name, that shows it is about debt collection.' },
    publicPost: { t: 'Public social media post or message about the debt', cite: '12 CFR 1006.14(h)', sev: 'likely', why: 'A collector may not communicate about a debt through a public post visible to others.' },
    suspiciousPayment: { t: 'Demanded gift cards, wire transfer, crypto or payment-app transfer', cite: 'FTC Telemarketing Sales Rule, 16 CFR Part 310', sev: 'possible', why: 'Real collectors rarely demand these payment methods. This pattern is common among fake collectors, so check the debt is real before paying.' }
  };

  function evaluate(entries, profile, nowStr) {
    var out = [], tz = (profile && profile.tz) || 'America/New_York', list = [], i, e, p, calls, groups = {}, k, now = nowStr ? new Date(nowStr) : new Date();
    profile = profile || {};

    function add(ruleId, title, cite, sev, why, ids) { out.push({ ruleId: ruleId, title: title, cite: cite, severity: sev, why: why, entryIds: ids || [] }); }

    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      p = localParts(e.at, tz);
      if (p) { list.push({ e: e, p: p, out: e.dir !== 'consumer' }); }
    }
    list.sort(function (a, b) { return a.p.epoch - b.p.epoch; });

    /* 1. Inconvenient time (before 8 a.m. or after 9 p.m. local time) */
    list.forEach(function (x) {
      if (!x.out || x.p.dateOnly || x.e.channel === 'letter') { return; }
      if (x.p.minutes < 8 * 60 || x.p.minutes > 21 * 60) {
        add('time_of_day', 'Contact before 8 a.m. or after 9 p.m.', '15 U.S.C. 1692c(a)(1); 12 CFR 1006.6(b)(1)', 'likely',
          'Contact at ' + U.pad2(x.p.h) + ':' + U.pad2(x.p.mi) + ' your local time (' + x.p.day + '). Times before 8 a.m. or after 9 p.m. are treated as inconvenient unless you agreed to them.', [x.e.id]);
      }
    });

    /* 2. Seven calls in seven days, and a call within seven days of a conversation (12 CFR 1006.14(b)(2)) */
    calls = list.filter(function (x) { return x.out && (x.e.channel === 'call' || x.e.channel === 'voicemail'); });
    calls.forEach(function (x) { k = x.e.debtRef || x.e.collector || 'all'; (groups[k] = groups[k] || []).push(x); });
    Object.keys(groups).forEach(function (g) {
      /* sliding window over calls sorted by time: O(n) instead of rescanning every earlier call for each call */
      var arr = groups[g], ids = {}, max = 0, a, b, lo = 0, marked = -1, sp = 0, talks = [];
      for (a = 0; a < arr.length; a++) {
        while (arr[lo].p.epoch <= arr[a].p.epoch - 7 * DAY) { lo++; }
        if (a - lo + 1 > 7) {
          for (b = Math.max(lo, marked + 1); b <= a; b++) { ids[arr[b].e.id] = 1; }
          marked = a; max = Math.max(max, a - lo + 1);
        }
      }
      if (max > 7) {
        add('seven_in_seven', 'More than 7 calls in 7 days about one debt', '12 CFR 1006.14(b)(2)(i)(A)', 'likely',
          max + ' call attempts within seven days' + (g !== 'all' ? ' (' + g + ')' : '') + '. More than seven in seven days is presumed to be harassment; the collector can try to rebut the presumption.', Object.keys(ids));
      }
      /* the earliest conversation in the 7 days before each later call (same result as the old pairwise scan, in O(n)) */
      for (a = 0; a < arr.length; a++) { if (arr[a].e.spoke) { talks.push(arr[a]); } }
      for (a = 0; a < arr.length; a++) {
        while (sp < talks.length && talks[sp].p.epoch <= arr[a].p.epoch - 7 * DAY) { sp++; }
        if (!arr[a].e.spoke && sp < talks.length && talks[sp].p.epoch < arr[a].p.epoch) {
          b = talks[sp];
          add('seven_after_talk', 'Called again within 7 days of a conversation', '12 CFR 1006.14(b)(2)(i)(B)', 'likely',
            'Called on ' + arr[a].p.day + ' after a phone conversation about this debt on ' + b.p.day + '. A call within seven days after a conversation is presumed to be harassment.', [b.e.id, arr[a].e.id]);
        }
      }
    });

    /* 3. Contact after a written cease request (15 U.S.C. 1692c(c); 12 CFR 1006.6(c)) */
    if (profile.ceaseDate) {
      list.forEach(function (x) {
        if (x.out && x.p.day > profile.ceaseDate && !x.e.permittedException) {
          add('after_cease', 'Contact after your cease-communication request', '15 U.S.C. 1692c(c); 12 CFR 1006.6(c)', 'likely',
            'Contact on ' + x.p.day + ', after the request was received on ' + profile.ceaseDate + '. After a written request the collector may only confirm it will stop, or say it may take a specific action such as filing a suit.', [x.e.id]);
        }
      });
    }

    /* 4. Collection activity after a written dispute and before verification (15 U.S.C. 1692g(b); 12 CFR 1006.38) */
    if (profile.disputeDate && (!profile.validationEnd || profile.disputeDate <= profile.validationEnd)) {
      list.forEach(function (x) {
        if (x.out && x.e.demandsPayment && x.p.day > profile.disputeDate && (!profile.verificationDate || x.p.day < profile.verificationDate)) {
          add('during_dispute', 'Payment demand while a timely dispute was unanswered', '15 U.S.C. 1692g(b); 12 CFR 1006.38', 'likely',
            'Payment demand on ' + x.p.day + ' after your written dispute on ' + profile.disputeDate + ' and before verification was mailed. Collection must stop until the collector sends verification.', [x.e.id]);
        }
      });
    }

    /* 5. Work calls after being told not to; blocked channels; contact after attorney notice */
    list.forEach(function (x) {
      var ch = x.e.channel, od = profile.optOut || {};
      if (x.out && x.e.atWork && profile.workBanDate && x.p.day > profile.workBanDate) {
        add('workplace', 'Contact at work after you said it was not allowed', '15 U.S.C. 1692c(a)(3); 12 CFR 1006.6(b)', 'likely',
          'Contact at work on ' + x.p.day + ' after the collector was told on ' + profile.workBanDate + ' that you cannot receive it there.', [x.e.id]);
      }
      if (x.out && od[ch] && x.p.day > od[ch]) {
        add('channel_optout', 'Used a channel you opted out of', '12 CFR 1006.6(e), 1006.14(h)', 'likely',
          'Used ' + ch + ' on ' + x.p.day + ' after you opted out on ' + od[ch] + '.', [x.e.id]);
      }
      if (x.out && profile.attorneyNoticeDate && x.p.day > profile.attorneyNoticeDate && !x.e.toAttorney && ch !== 'letter-to-attorney') {
        add('represented', 'Contacted you after being told you have a lawyer', '15 U.S.C. 1692c(a)(2); 12 CFR 1006.6(b)', 'likely',
          'Contact on ' + x.p.day + ' after the collector knew an attorney represented you.', [x.e.id]);
      }
    });

    /* 6. Third parties */
    (function () {
      var byPerson = {};
      list.forEach(function (x) { if (x.e.channel === 'thirdparty') { var n = (x.e.thirdPartyName || 'someone').toLowerCase(); (byPerson[n] = byPerson[n] || []).push(x); } });
      Object.keys(byPerson).forEach(function (n) {
        if (byPerson[n].length > 1) {
          add('third_party_repeat', 'Contacted the same third party more than once', '15 U.S.C. 1692b(3)', 'possible',
            'More than one contact with ' + n + '. Without a request or a reason to think the earlier answer was wrong, a collector may contact a third party only once.', byPerson[n].map(function (z) { return z.e.id; }));
        }
      });
    })();

    /* 7. Missing validation notice (15 U.S.C. 1692g(a); 12 CFR 1006.34) */
    if (profile.firstContactDate && profile.noticeReceived === false) {
      var fc = SW.sol.parseDate(profile.firstContactDate);
      if (fc && SW.sol.diffDays(fc, SW.sol.parseDate(SW.sol.fmt(now))) > 7) {
        add('no_validation_notice', 'No validation notice after the first contact', '15 U.S.C. 1692g(a); 12 CFR 1006.34', 'possible',
          'The first contact was ' + profile.firstContactDate + ' and no validation notice has arrived. It is due in the first communication or within five days after it.', []);
      }
    }

    /* 8. Per-entry checkboxes */
    list.forEach(function (x) {
      var f = x.e.flags || {};
      Object.keys(f).forEach(function (key) {
        var d = FLAGS[key];
        if (f[key] && d) { add('flag_' + key, d.t, d.cite, d.sev, d.why + ' (Logged ' + x.p.day + '.)', [x.e.id]); }
      });
    });

    out.sort(function (a, b) { return (a.severity === b.severity ? 0 : (a.severity === 'likely' ? -1 : 1)); });
    return out;
  }

  var DISCLAIMER = 'General information, not legal advice. These are patterns to take to a regulator or a consumer-protection attorney; only a court can decide whether the law was broken. Keep copies of everything.';

/* full version only */
  SW.violations = { evaluate: evaluate, localParts: localParts, FLAGS: FLAGS, DISCLAIMER: DISCLAIMER };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.violations; }
})(typeof window !== 'undefined' ? window : globalThis);
