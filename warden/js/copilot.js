/* Stark Warden: live call copilot engine. While a call is happening you type or tap what the caller says; fixed rules spot the pressure
   tactic and show the calm, lawful reply with its source. When the call ends it builds a contact-log entry (with the matching flags
   ticked) and tells you how many collector calls are already in the last 7 days. Pure functions, no DOM, no network.
   It cannot tell whether a caller is real or whether a rule was broken. It shows what was said and what you may calmly say back. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};

  /* id: tactic. flag: the contact-log flag it ticks. */
  var TACTICS = [
    { id: 'arrest', flag: 'threatArrest', label: 'Threatens arrest or jail', tap: 'You will be arrested',
      say: 'A debt collector may not threaten arrest. I am ending this call. Send me a written validation notice.', dont: 'Do not argue or explain. Do not confirm any detail about yourself.', cite: '15 U.S.C. 1692e(4)' },
    { id: 'payMethod', flag: 'suspiciousPayment', label: 'Wants gift cards, crypto, wire or an app', tap: 'Pay with gift cards or crypto',
      say: 'I do not pay anyone who contacted me out of the blue with gift cards, crypto or a wire. Send it in writing.', dont: 'Do not buy anything. Do not stay on the line while you shop.', cite: 'FTC consumer advice; 16 CFR Part 310' },
    { id: 'numbers', flag: null, label: 'Asks for Social Security, bank or card numbers', tap: 'Verify your Social Security number',
      say: 'I will not give personal numbers to a caller I cannot verify. Mail me your validation notice.', dont: 'Do not read out any number, even the last four digits.', cite: 'FTC consumer advice' },
    { id: 'gov', flag: 'falseGov', label: 'Claims to be police, court or government', tap: 'I am an officer or agent',
      say: 'I will verify that with the agency using a number I look up myself. Goodbye.', dont: 'Do not call back a number they give you.', cite: '15 U.S.C. 1692e(1), 1692e(9)' },
    { id: 'thirdParty', flag: 'discloseThird', label: 'Brings up your boss, family or neighbors', tap: 'We will call your employer',
      say: 'You may not discuss this with anyone else. Do not contact my employer or family.', dont: 'Do not give them anyone else’s name or number.', cite: '15 U.S.C. 1692c(b)' },
    { id: 'suitNow', flag: 'threatSuit', label: 'Threatens a lawsuit right away', tap: 'We will sue you today',
      say: 'Send me the validation notice and any court papers by mail. I will respond in writing.', dont: 'Do not promise to pay to stop it.', cite: '15 U.S.C. 1692e(5)' },
    { id: 'today', flag: null, label: 'Pressure to pay today', tap: 'You must pay today',
      say: 'I do not make payments under pressure. Send me the details in writing and I will review them.', dont: 'Do not agree to any amount or date on the phone.', cite: 'FTC consumer advice' },
    { id: 'noWriting', flag: null, label: 'Refuses to send anything in writing', tap: 'We cannot send anything in writing',
      say: 'Then I cannot confirm this is real. I will not pay or give details without a written notice.', dont: 'Do not let them talk you out of it.', cite: '15 U.S.C. 1692g(a); 12 CFR 1006.34' },
    { id: 'abuse', flag: 'profanity', label: 'Insults or swears', tap: 'Insults or swearing',
      say: 'I am ending this call because of the language. Contact me in writing only.', dont: 'Do not match their tone.', cite: '15 U.S.C. 1692d(2)' },
    { id: 'creditPromise', flag: null, label: 'Promises paying will fix your credit', tap: 'Paying will fix your credit',
      say: 'Put any credit-reporting terms in writing first. Nothing is agreed until I have it on paper.', dont: 'Do not treat a verbal promise as a deal.', cite: 'FTC consumer advice' },
    { id: 'legalDept', flag: 'falseLawyer', label: 'Scary “legal department” or “case number” words', tap: 'This is the legal department',
      say: 'Please mail me the case number and the court name. A real lawsuit comes as court papers.', dont: 'Do not ask them to repeat the threats.', cite: '15 U.S.C. 1692e(3), 1692e(10)' }
  ];
  var BY = {};
  TACTICS.forEach(function (t) { BY[t.id] = t; });

  var VERIFY = {};
  (SW.verify && SW.verify.FLAGS || []).forEach(function (f) { VERIFY[f.id] = f; });

  var EXTRA = { numbers: /\b(?:social security|ssn|last (?:four|4)|routing number|bank account (?:number|info\w*)|card number|date of birth|mother(?:’|')?s maiden)\b/i };

  /* Which tactics does this line of speech show? Order follows the TACTICS list (most serious first). */
  function detect(line) {
    var s = String(line || ''), out = [];
    TACTICS.forEach(function (t) {
      var re = EXTRA[t.id] || (VERIFY[t.id] && VERIFY[t.id].re);
      if (re && re.test(s)) { out.push(t); }
    });
    return out;
  }

  function seen(ids) { return ids.map(function (i) { return BY[i]; }).filter(Boolean); }

  /* Collector calls (call or voicemail, not made by you) in the 7 days before `nowIso`, counting this one. */
  function callsInWeek(entries, nowIso, tz) {
    var now = SW.violations.localParts(nowIso, tz), n = 0;
    if (!now) { return 0; }
    (entries || []).forEach(function (e) {
      var p = SW.violations.localParts(e.at, tz);
      if (p && e.dir !== 'consumer' && (e.channel === 'call' || e.channel === 'voicemail') && now.epoch - p.epoch >= 0 && now.epoch - p.epoch < 7 * 1440) { n++; }
    });
    return n;
  }

  function stamp(d) {
    var P = SW.util.pad2;
    return d.getFullYear() + '-' + P(d.getMonth() + 1) + '-' + P(d.getDate()) + ' ' + P(d.getHours()) + ':' + P(d.getMinutes());
  }
  function duration(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ' min ' + SW.util.pad2(sec % 60) + ' s'; }

  /* The contact-log entry for a finished call. s: { start: Date, seconds, caller, phone, spoke, said: [lines], tactics: [ids], note } */
  function toEntry(s, id) {
    var flags = {}, ts = seen(s.tactics || []), notes = [], lines = (s.said || []).filter(function (x) { return String(x).trim(); });
    ts.forEach(function (t) { if (t.flag) { flags[t.flag] = true; } });
    notes.push('Call logged live with Warden copilot. Length ' + duration(s.seconds || 0) + '.');
    if (ts.length) { notes.push('Tactics noted: ' + ts.map(function (t) { return t.label; }).join('; ') + '.'); }
    if (lines.length) { notes.push('What was said, as typed during the call: ' + lines.map(function (x) { return '“' + String(x).trim() + '”'; }).join(' ')); }
    if (s.note && String(s.note).trim()) { notes.push(String(s.note).trim()); }
    return { id: id, at: stamp(s.start), channel: 'call', dir: 'collector', collector: s.caller || '', phone: s.phone || '', debtRef: '', thirdPartyName: '', spoke: !!s.spoke,
      atWork: false, demandsPayment: ts.some(function (t) { return t.id === 'payMethod' || t.id === 'today'; }), permittedException: false, notes: notes.join(' '), flags: flags };
  }

  SW.copilot = { TACTICS: TACTICS, detect: detect, seen: seen, callsInWeek: callsInWeek, toEntry: toEntry, duration: duration, stamp: stamp };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.copilot; }
})(typeof window !== 'undefined' ? window : globalThis);
