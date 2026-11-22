/* Stark Warden 2.0 engines (browser and node, no DOM, no network): language helper, "Is this even real?" verifier,
   "what happened?" interview, weekly call timeline, call-practice coach, wins tracker, red-flag phrase highlighter. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};

  /* ---------- language ---------- */
  /* In the browser the screen-language picker (js/i18n.js) sets <html lang>, and Warden's own Spanish follows it. */
  function lang() {
    try {
      if (root.StarkI18n && root.document) { return root.document.documentElement.getAttribute('lang') === 'es' ? 'es' : 'en'; }
      return SW.store && SW.store.settings().lang === 'es' ? 'es' : 'en';
    } catch (e) { return 'en'; }
  }
  function t(key, lg, vars) {
    var d = SW.data.calm[lg || lang()] || SW.data.calm.en, v = key in d ? d[key] : SW.data.calm.en[key];
    if (typeof v === 'string' && vars) { v = v.replace(/\{(\w+)\}/g, function (a, k) { return k in vars ? vars[k] : a; }); }
    return v;
  }
  SW.i18n = { lang: lang, t: t };

  /* ---------- "Is this even real?" verifier ---------- */
  var NOTICE = [
    { id: 'isCollector', label: 'Says it is a debt collector trying to collect a debt', cite: '15 U.S.C. 1692e(11); 12 CFR 1006.34(c)(1)' },
    { id: 'collectorAddr', label: 'The collector’s name and a mailing address for disputes', cite: '12 CFR 1006.34(c)(2)' },
    { id: 'yourInfo', label: 'Your name and mailing address', cite: '12 CFR 1006.34(c)(2)' },
    { id: 'creditorThen', label: 'The creditor on the itemization date (for card, loan and similar debts)', cite: '12 CFR 1006.34(c)(2)' },
    { id: 'acctNum', label: 'An account number (it may be partly hidden)', cite: '12 CFR 1006.34(c)(2)' },
    { id: 'creditorNow', label: 'Who the debt is owed to now', cite: '15 U.S.C. 1692g(a)(2); 12 CFR 1006.34(c)(2)' },
    { id: 'itemDate', label: 'An “itemization date” and the amount owed on that date', cite: '12 CFR 1006.34(c)(2)' },
    { id: 'itemization', label: 'Interest, fees, payments and credits since that date', cite: '12 CFR 1006.34(c)(2)' },
    { id: 'amountNow', label: 'The current amount of the debt', cite: '15 U.S.C. 1692g(a)(1); 12 CFR 1006.34(c)(2)' },
    { id: 'endDate', label: 'The date your dispute window ends, and that you can dispute in writing by then', cite: '15 U.S.C. 1692g(a)(3)-(4); 12 CFR 1006.34(c)(3)' },
    { id: 'origRequest', label: 'That you can ask for the original creditor’s name and address', cite: '15 U.S.C. 1692g(a)(5); 12 CFR 1006.34(c)(3)' },
    { id: 'cfpbRef', label: 'A note that more information is on the CFPB website', cite: '12 CFR 1006.34(c)(3)' }
  ];
  var CHECK_FLAGS = [
    { id: 'payMethod', scam: true, tick: 'They want gift cards, crypto, a wire or a payment app', title: 'Wants gift cards, crypto, a wire or a payment app', cite: 'FTC consumer advice',
      why: 'Real collectors take payments that leave a paper trail. These methods are how scammers get money that cannot be traced or returned.',
      re: /\b(?:gift ?cards?|prepaid (?:debit )?cards?|bitcoin|crypto(?:currency)?|usdt|wire (?:transfer|the money|it)|western union|moneygram|zelle|cash ?app|venmo)\b/i },
    { id: 'arrest', scam: true, tick: 'They threatened arrest, jail or police', title: 'Threatens arrest, jail or police', cite: 'FDCPA, 15 U.S.C. 1692e(4)',
      why: 'A debt collector may not say or imply that you will be arrested for not paying. Real police do not call to collect debts.',
      re: /\b(?:arrest(?:ed)?|warrant|jail|prison|police|sheriff|handcuff\w*|criminal (?:charges?|case|complaint)|deport\w*)\b/i },
    { id: 'noWriting', scam: true, tick: 'They refuse to send anything in writing', title: 'Refuses to put anything in writing', cite: 'FDCPA, 15 U.S.C. 1692g(a); 12 CFR 1006.34',
      why: 'A real collector must give you a written validation notice. Refusing is a sign of a fake collector.',
      re: /\b(?:can(?:no|’|')?t|won(?:’|')?t|will not|unable to|do(?:es)? not|don(?:’|')?t|never)\s+(?:mail|send|email|provide|put)\b[^.\n]{0,30}\b(?:anything|letters?|notice|paper\w*|writing|documents?)\b|\bno (?:letters?|paperwork|notices?) (?:will be |can be )?(?:sent|mailed)\b/i },
    { id: 'numbers', scam: true, tick: 'They asked for my Social Security, bank or card numbers', title: 'Asks for your Social Security, bank or card numbers', cite: 'FTC consumer advice on debt collection',
      why: 'Scammers pose as collectors to get your numbers. Never give them to someone who contacted you.',
      re: /\b(?:social security|ssn|routing number|bank account (?:number|info\w*)|card number|online banking|log ?in|password|pin)\b/i },
    { id: 'gov', scam: true, tick: 'They said they were police, a court or the government', title: 'Claims to be police, a court or the government', cite: 'FDCPA, 15 U.S.C. 1692e(1) and 1692e(9)',
      why: 'A collector may not pretend to be, or be connected with, the government or a court.',
      re: /\b(?:officer|agent|deputy|detective|irs|fbi|department of justice|county (?:fraud|court)|court officer|process server|federal (?:agent|investigator))\b/i },
    { id: 'today', scam: false, tick: 'They pressure me to pay today', title: 'Pressure to pay today', cite: 'FTC consumer advice',
      why: 'Pressure is meant to stop you from checking. You have the right to see the debt in writing first.',
      re: /\b(?:today|right now|immediately|within (?:the next )?\d+ ?(?:hours?|minutes?)|end of (?:the )?day|final (?:notice|chance|offer)|last chance)\b/i },
    { id: 'suitNow', scam: false, tick: 'They threaten to sue right away', title: 'Threatens a lawsuit right away', cite: 'FDCPA, 15 U.S.C. 1692e(5)',
      why: 'A collector may not threaten a lawsuit it does not intend to file or cannot file, such as on a debt past the time limit.',
      re: /\b(?:lawsuit|sue you|legal action|court)\b[^.\n]{0,40}\b(?:today|tomorrow|immediately|within)\b/i },
    { id: 'thirdParty', scam: false, tick: 'They brought up my employer, family or neighbors', title: 'Brings up your employer, family or neighbors', cite: 'FDCPA, 15 U.S.C. 1692c(b)',
      why: 'Collectors may not discuss your debt with others, except your spouse. They may contact others only to find you.',
      re: /\b(?:call(?:ed)?|contact(?:ed)?|talk(?:ed)? to|told|spoke (?:to|with)|notify)\s+(?:your\s+)?(?:employer|boss|hr|human resources|family|sister|brother|mother|father|parents|neighbou?rs?|co-?workers?)\b/i },
    { id: 'legalDept', scam: false, tick: 'They use scary “legal department” or “case number” words', title: 'Scary “legal department” or “case number” language', cite: 'FDCPA, 15 U.S.C. 1692e(3) and 1692e(10)',
      why: 'Fake collectors use legal-sounding words to scare you. A real lawsuit comes as court papers from a real court.',
      re: /\b(?:legal (?:department|division|team)|pre-?legal|case (?:number|no\.?|#))\b/i },
    { id: 'creditPromise', scam: false, tick: 'They promise paying will fix my credit', title: 'Promises paying will fix your credit', cite: 'FTC consumer advice',
      why: 'No one can promise what your credit report or score will show. Get any reporting terms in writing.',
      re: /\b(?:remove|delete|erase|fix|restore|boost|repair)\b[^.\n]{0,30}\b(?:credit|report|score)\b/i },
    { id: 'abuse', scam: false, tick: 'They insulted me or swore at me', title: 'Insults or abusive language', cite: 'FDCPA, 15 U.S.C. 1692d(2)',
      why: 'Collectors may not use obscene, profane or abusive language.',
      re: /\b(?:deadbeat|loser|idiot|stupid|liar|thief|scum|damn|hell)\b/i },
    { id: 'unknown', scam: false, tick: 'I do not recognize the debt or the company', title: 'You do not recognize the debt', cite: 'FDCPA, 15 U.S.C. 1692g(b)',
      why: 'You can dispute a debt you do not recognize. Collection must pause until they mail verification.' },
    { id: 'lateCalls', scam: false, tick: 'They called before 8 a.m. or after 9 p.m.', title: 'Calls before 8 a.m. or after 9 p.m.', cite: 'FDCPA, 15 U.S.C. 1692c(a)(1)',
      why: 'These times are presumed inconvenient unless you agreed to them.' }
  ];

  function findAll(re, text) {
    var out = [], g = new RegExp(re.source, re.flags.replace('g', '') + 'g'), m, n = 0;
    while ((m = g.exec(text)) && n++ < 200) {
      if (!m[0].length) { g.lastIndex++; continue; }
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    return out;
  }

  function verify(input) {
    input = input || {};
    var have = input.notice || {}, ticks = input.ticks || {}, text = String(input.text || ''), red = [], missing = [], unsure = [], level, head, steps = [];
    CHECK_FLAGS.forEach(function (f) {
      var hits = f.re && text ? findAll(f.re, text) : [];
      if (ticks[f.id] || hits.length) { red.push({ id: f.id, scam: f.scam, title: f.title, why: f.why, cite: f.cite, evidence: hits.map(function (x) { return x.text; }), spans: hits }); }
    });
    NOTICE.forEach(function (n) { if (have[n.id] === 'no') { missing.push(n); } else if (have[n.id] !== 'yes') { unsure.push(n); } });
    var scam = red.filter(function (r) { return r.scam; });
    if (scam.length) { level = 'scam'; head = 'Strong signs of a scam or an illegal collector. Do not pay.'; }
    else if (red.length) { level = 'red'; head = 'Red flags. Do not pay until you have the debt in writing.'; }
    else if (input.written !== 'yes') { level = 'nowritten'; head = 'Nothing in writing yet. Ask for the validation notice.'; }
    else if (missing.length) { level = 'missing'; head = 'Their notice is missing required details.'; }
    else if (unsure.length) { level = 'unsure'; head = 'Check the rest of the notice against the list.'; }
    else { level = 'complete'; head = 'Nothing we checked is missing. That does not prove the debt is valid or that it is yours.'; }
    if (level === 'scam') { steps.push('Do not pay, and do not give any numbers. End the call.', 'Look up the original creditor yourself and call them on a number you find.', 'Report it at ReportFraud.ftc.gov and to your state attorney general.'); }
    if (level !== 'complete') { steps.push('Send the dispute and validation letter by certified mail. It asks for every missing item.'); }
    if (missing.length || level === 'nowritten') { steps.push('A real collector must give you this notice in the first contact or within 5 days (15 U.S.C. 1692g(a)).'); }
    steps.push('Check your state’s time limit before you pay anything on an old debt.', 'Log every contact. Patterns become evidence.');
    return { level: level, headline: head, missing: missing, unsure: unsure, red: red, scam: scam.length > 0, steps: steps };
  }
  SW.verify = { NOTICE: NOTICE, FLAGS: CHECK_FLAGS, check: verify, findAll: findAll };

  /* ---------- "What happened?" interview ---------- */
  var CONDUCT = [
    { id: 'lateCalls', label: 'They called before 8 a.m. or after 9 p.m.', title: 'Contact before 8 a.m. or after 9 p.m.', cite: '15 U.S.C. 1692c(a)(1); 12 CFR 1006.6(b)(1)' },
    { id: 'manyCalls', label: 'They called more than 7 times in a week', title: 'Repeated calls, more than 7 in 7 days', cite: '12 CFR 1006.14(b)(2)' },
    { id: 'work', label: 'They called me at work after I said no', title: 'Contact at work after being told it was not allowed', cite: '15 U.S.C. 1692c(a)(3)' },
    { id: 'thirdParty', label: 'They told my family, boss or neighbors about the debt', title: 'Discussed the debt with other people', cite: '15 U.S.C. 1692c(b)' },
    { id: 'arrest', label: 'They threatened arrest or jail', title: 'Threatened arrest or jail', cite: '15 U.S.C. 1692e(4)' },
    { id: 'fakeLaw', label: 'They said they were a lawyer, police or the government', title: 'Falsely implied a lawyer, police or government connection', cite: '15 U.S.C. 1692e(1), 1692e(3)' },
    { id: 'abuse', label: 'They insulted me, swore, or threatened harm', title: 'Abusive language or threats of harm', cite: '15 U.S.C. 1692d' },
    { id: 'payMethod', label: 'They demanded gift cards, a wire, crypto or a payment app', title: 'Demanded gift cards, a wire, crypto or app payment (a common sign of a fake collector)', cite: 'FTC consumer advice' },
    { id: 'noWriting', label: 'They would not send anything in writing', title: 'No written validation notice', cite: '15 U.S.C. 1692g(a); 12 CFR 1006.34' },
    { id: 'oldSuit', label: 'They threatened to sue on a very old debt', title: 'Threatened to sue on a possibly time-barred debt', cite: '12 CFR 1006.26(b)' },
    { id: 'fees', label: 'They added fees or an amount I do not understand', title: 'Claimed a wrong amount or fees not allowed', cite: '15 U.S.C. 1692e(2)(A), 1692f(1)' },
    { id: 'afterStop', label: 'They kept contacting me after I told them in writing to stop', title: 'Contact after a written request to stop', cite: '15 U.S.C. 1692c(c)' }
  ];
  var DISPUTE = { no: 'I do not recognize this debt and do not believe it is mine.', unsure: 'I dispute this debt in full.', yes: 'I dispute the amount you claim and believe it is wrong.' };

  function money(x) { var n = parseFloat(String(x || '').replace(/[$,\s]/g, '')); return isFinite(n) && n > 0 ? SW.util.money(n) : ''; }

  function interview(a, todayIso) {
    a = a || {};
    var c = a.conduct || {}, w = a.wants || {}, issues = CONDUCT.filter(function (x) { return c[x.id]; }).map(function (x) { return { id: x.id, title: x.title, cite: x.cite }; }),
      who = (a.collectorName || '').trim() || 'A debt collector', amt = money(a.amount), rec = a.recognize || 'unsure', S = [], plan = [], win = null, base, scammy;
    base = { yourName: a.name || '', yourAddress: a.address || '', collectorName: a.collectorName || '', collectorAddress: a.collectorAddress || '', accountRef: a.accountRef || '' };
    S.push(who + ' has been contacting me about a debt' + (amt ? ' of ' + amt : '') + (a.creditor ? ' that they say I owe to ' + a.creditor : '') + '.' + (a.phone ? ' They call from ' + a.phone + '.' : ''));
    S.push({ no: 'I do not recognize this debt.', unsure: 'I am not sure this debt is mine, and I have asked for proof.', yes: 'I recognize the account, but I have questions about it.' }[rec] || '');
    if (a.firstContact) { S.push('The first contact was on ' + SW.letters.prettyDate(a.firstContact) + '.'); }
    S.push(a.notice === 'yes' ? 'I received a written notice' + (a.noticeDate ? ' dated ' + SW.letters.prettyDate(a.noticeDate) : '') + '.' : (a.notice === 'no' ? 'I have not received a written validation notice.' : 'I am not sure whether I received a written validation notice.'));
    if (issues.length) { S.push('During these contacts: ' + issues.map(function (x) { return x.title.replace(/ \(a common sign of a fake collector\)/, '').toLowerCase(); }).join('; ') + '.'); }
    if (a.details && String(a.details).trim()) { S.push(String(a.details).trim()); }
    if (a.notice === 'yes' && a.noticeDate && SW.deadlines) { win = SW.deadlines.validationWindow(a.noticeDate); }
    scammy = c.arrest || c.payMethod || (c.noWriting && rec !== 'yes') || c.fakeLaw;
    if (scammy) { plan.push({ id: 'verify', title: 'Check if this is even real', why: 'Some signs point to a fake collector. Do not pay or give any numbers until you see a written notice.', href: '#/debt/verify', urgent: true }); }
    plan.push({ id: 'validation', title: 'Send your dispute letter (filled in for you)', href: '#/debt/letters/validation', urgent: !!win,
      why: win ? 'Mail it by certified mail before your dispute window ends on about ' + win.endsOn + '. Collection must pause until they verify.' : 'Ask for proof in writing. Send it by certified mail and keep a copy.' });
    if (w.stop) { plan.push({ id: 'cease', title: 'Send the stop-contact letter', href: '#/debt/letters/cease', why: 'They must stop, with a few exceptions. It does not erase the debt, and they could still sue.' }); }
    if (w.limit) { plan.push({ id: 'limit', title: 'Send the limit-contact letter', href: '#/debt/letters/limit', why: 'Choose how, when and where they may reach you, in writing.' }); }
    plan.push({ id: 'limits', title: 'Check the time limit before paying anything', href: '#/debt/limits', urgent: !!c.oldSuit, why: 'On an old debt, a payment or a promise to pay can restart the clock in many states.' });
    plan.push({ id: 'log', title: 'Log every call and letter from now on', href: '#/debt/log', why: 'Dates and times turn pressure into evidence. The log flags call-limit patterns for you.' });
    if (w.report || issues.length) { plan.push({ id: 'complaint', title: 'Send your complaint (CFPB, FTC, state attorney general)', href: '#/debt/complaint', why: 'Your answers are already in the draft. Filing is free and creates a record.' }); }
    if (w.lawyer || issues.length) { plan.push({ id: 'lawyer', title: 'Talk to a consumer attorney or legal aid', href: '#/hope', why: 'Many take collection abuse cases with no upfront fee. If you were sued, act now.' }); }
    plan.push({ id: 'practice', title: 'Practice your next call', href: '#/practice', why: 'Two minutes of practice makes the next call easier.' });
    return {
      profile: { name: a.name || '', address: a.address || '', state: a.state || '', firstContactDate: a.firstContact || '', noticeReceived: a.notice === 'yes' ? 'yes' : (a.notice === 'no' ? 'no' : '') },
      letters: {
        validation: Object.assign({}, base, { amountClaimed: a.amount || '', noticeDate: a.notice === 'yes' ? (a.noticeDate || '') : '', disputeText: DISPUTE[rec] || DISPUTE.unsure,
          noticeStatus: a.notice === 'no' ? 'I have not received a written validation notice from you. Please send one.' : '' }),
        cease: Object.assign({}, base, { alsoDispute: rec !== 'yes' ? 'yes' : '' }),
        limit: Object.assign({}, base)
      },
      story: S.filter(Boolean).join(' '), issues: issues, plan: plan, window: win, scammy: !!scammy, date: todayIso || ''
    };
  }
  SW.interview = { CONDUCT: CONDUCT, build: interview };

/* full version only */
/* full version only */
  /* ---------- wins tracker ---------- */
  function daysBetween(a, b) { var pa = SW.sol.parseDate(a), pb = SW.sol.parseDate(b); return pa && pb ? SW.sol.diffDays(pa, pb) : null; }
  function wins(st, todayIso) {
    st = st || {};
    var out = [], p = st.profile || {}, log = st.log || [], tz = p.tz || 'America/New_York', sim = st.simBest || {}, best = 0, k, manual = st.manual || [];
    function W(id, stage, title, detail, date) { out.push({ id: id, stage: stage, title: title, detail: detail || '', date: date || '' }); }
    if (st.interview) { W('story', 'understand', 'You told your story', 'Your answers filled in your letters and your complaint draft.'); }
    if (st.seenRights) { W('rights', 'understand', 'You learned your rights in 60 seconds', 'Ten rules, each with its source.'); }
    if (st.verified) { W('verify', 'understand', 'You checked whether the collector is real', 'You looked before you paid.'); }
    for (k in sim) { if (Object.prototype.hasOwnProperty.call(sim, k)) { best = Math.max(best, sim[k] || 0); } }
    if (best > 0) { W('practice', 'protect', 'You practiced a collector call', 'Best confidence so far: ' + best + ' out of 100.'); }
    if (st.trusted) { W('trusted', 'protect', 'You chose a trusted person', 'Someone to call before you pay anyone.'); }
    if (st.checks > 0) { W('checked', 'protect', 'You checked a message before acting', st.checks + (st.checks === 1 ? ' check' : ' checks') + ' so far.'); }
    if (st.limitChecked) { W('limit', 'protect', 'You checked the time limit before paying', 'That protects you from restarting the clock.'); }
    var collLog = log.filter(function (e) { return e.dir !== 'consumer'; });
    if (collLog.length) { W('log', 'pushback', 'You started a record', collLog.length + (collLog.length === 1 ? ' contact' : ' contacts') + ' logged. Every entry is evidence.'); }
    if (p.disputeDate) { W('dispute', 'pushback', 'You disputed the debt in writing', 'Sent ' + SW.letters.prettyDate(p.disputeDate) + '.', p.disputeDate); }
    if (p.verificationDate) { W('verified', 'pushback', 'They had to answer you', 'Verification mailed ' + SW.letters.prettyDate(p.verificationDate) + '.', p.verificationDate); }
    if (p.ceaseDate) {
      var after = collLog.filter(function (e) { var lp = SW.violations.localParts(e.at, tz); return lp && lp.day > p.ceaseDate && !e.permittedException; }), quiet = todayIso ? daysBetween(p.ceaseDate, todayIso) : null;
      W('stop', 'pushback', after.length ? 'You told them to stop' : 'You made the calls stop', after.length ? after.length + ' contact(s) logged since ' + SW.letters.prettyDate(p.ceaseDate) + '. Those can be reported.' : (quiet != null && quiet >= 0 ? 'No contact logged in the ' + quiet + (quiet === 1 ? ' day' : ' days') + ' since they received your letter.' : 'Received ' + SW.letters.prettyDate(p.ceaseDate) + '.'), p.ceaseDate);
    }
    if ((st.mail || []).length) { W('mailed', 'pushback', 'You mailed ' + st.mail.length + (st.mail.length === 1 ? ' letter' : ' letters') + ' with tracking', 'Proof that you acted.'); }
    if (st.packet) { W('packet', 'pushback', 'You built an evidence packet', 'Your timeline, flags and dates, ready to print.'); }
    if (st.complaint) { W('complaint', 'pushback', 'You drafted a complaint', 'Ready to paste into the regulator’s form.'); }
    if (st.inWriting) { W('writing', 'rebuild', 'You got the deal in writing before paying', 'Every item on the checklist.'); }
    if (st.budget) { W('budget', 'rebuild', 'You made a budget', 'You know your real numbers now.'); }
    manual.forEach(function (m) { if (m && m.title) { W('m-' + (m.id || ''), m.stage || 'rebuild', m.title, m.note || '', m.date || ''); } });
    var stages = { understand: 0, protect: 0, pushback: 0, rebuild: 0 };
    out.forEach(function (x) { if (x.stage in stages) { stages[x.stage]++; } });
    return { wins: out, stages: stages, total: out.length };
  }
  SW.wins = { compute: wins };

  /* ---------- red-flag phrase highlighter for the message checker ---------- */
  function segments(text, res) {
    var s = String(text || ''), spans = [], adv = [], ruleById = {}, out = [], pos = 0;
    (SW.data.rules || []).forEach(function (r) { ruleById[r.id] = r; });
    (SW.data.adviceStrippers || []).forEach(function (re) { findAll(re, s).forEach(function (x) { adv.push(x); }); });
    (res && res.flags || []).forEach(function (f) {
      var r = ruleById[f.id];
      if (r) { r.groups.forEach(function (g) { g.forEach(function (re) { findAll(re, s).forEach(function (x) { x.title = f.title; spans.push(x); }); }); }); }
      else if (f.evidence) { var i = s.indexOf(f.evidence.replace(/…$/, '')); if (i >= 0) { spans.push({ start: i, end: i + f.evidence.replace(/…$/, '').length, title: f.title }); } }
    });
    spans = spans.filter(function (x) { return !adv.some(function (a) { return x.start < a.end && x.end > a.start; }); }).sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    spans.forEach(function (x) {
      var lastSpan = out.length ? out[out.length - 1] : null;
      if (lastSpan && lastSpan.hit && x.start < lastSpan.end) {
        if (x.end > lastSpan.end) { lastSpan.t += s.slice(lastSpan.end, x.end); lastSpan.end = x.end; pos = x.end; }
        if (lastSpan.titles.indexOf(x.title) < 0) { lastSpan.titles.push(x.title); }
        return;
      }
      if (x.start < pos) { return; }
      if (x.start > pos) { out.push({ t: s.slice(pos, x.start), hit: false }); }
      out.push({ t: s.slice(x.start, x.end), hit: true, titles: [x.title], end: x.end });
      pos = x.end;
    });
    if (pos < s.length) { out.push({ t: s.slice(pos), hit: false }); }
    return out.map(function (o) { return o.hit ? { t: o.t, hit: true, title: o.titles.join('; ') } : { t: o.t, hit: false }; });
  }
  SW.highlight = { segments: segments };

  /* ---------- lawsuit answer deadline ---------- */
  function answerBy(served, days) {
    var d = SW.sol.parseDate(served), n = parseInt(days, 10);
    if (!d || !(n > 0 && n < 120)) { return null; }
    return SW.sol.fmt(SW.sol.addDays(d, n));
  }
  SW.sued = { answerBy: answerBy };

  if (typeof module !== 'undefined' && module.exports) { module.exports = { verify: SW.verify, interview: SW.interview, timeline: SW.timeline, sim: SW.sim, wins: SW.wins, highlight: SW.highlight }; }
})(typeof window !== 'undefined' ? window : globalThis);
