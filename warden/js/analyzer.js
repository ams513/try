/* Stark Warden: rule-based scam message analyzer. Everything runs locally from the lists in data/rules.js.
   It reports warning signs and a caution level. It never says a message is safe for sure. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var U = SW.util;

  function stripAdvice(t) {
    SW.data.adviceStrippers.forEach(function (re) { re.lastIndex = 0; t = t.replace(re, ' . '); });
    return t;
  }

  function claimedBrands(text) {
    var out = [], names = SW.data.brandNames, k;
    for (k in names) {
      if (Object.prototype.hasOwnProperty.call(names, k) && names[k].test(text)) { out.push(k); }
    }
    return out;
  }

  function brandByName(name) {
    var b = SW.data.brands, i;
    for (i = 0; i < b.length; i++) { if (b[i].name === name) { return b[i]; } }
    return null;
  }

  function senderDomain(s) {
    s = String(s || '').trim().toLowerCase();
    var m = /@([^\s>]+)/.exec(s);
    if (m) { return m[1].replace(/[>\s]+$/, ''); }
    return s.replace(/^https?:\/\//, '').replace(/[\/>].*$/, '');
  }

  /* Extension point: a registered matcher can only ADD warning signs. Each flag it returns is re-checked here (text clipped, weight
     whole number 1 to 5), so nothing a matcher returns can lower a score or change a level downward. */
  var matchers = [], TAGS = ['collector', 'invoice', 'debtrelief'];
  function addMatcher(m) { if (m && typeof m.run === 'function') { matchers.push(m); } }
  function extraAsOf() {
    var best = null;
    matchers.forEach(function (m) { var d; try { d = typeof m.asOf === 'function' ? m.asOf() : null; } catch (e) { d = null; } if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && (!best || d > best)) { best = d; } });
    return best;
  }
  function patternsAsOf() { return { builtin: SW.data.meta.patternsAsOf, label: SW.data.meta.patternsAsOfLabel, newest: extraAsOf() }; }
  function takeMatcherFlags(clean, hits, push) {
    matchers.forEach(function (m) {
      var out;
      try { out = m.run(clean, hits); } catch (e) { out = null; }
      (Array.isArray(out) ? out : []).forEach(function (f) {
        var w = f && Math.floor(Number(f.weight));
        if (!f || typeof f.id !== 'string' || typeof f.title !== 'string' || !(w >= 1)) { return; }
        push({ id: U.clip(f.id, 80), cat: 'pack', title: U.clip(f.title, 120), why: U.clip(String(f.why || ''), 420), weight: Math.min(5, w), evidence: U.clip(String(f.evidence || ''), 90),
          tags: (Array.isArray(f.tags) ? f.tags : []).filter(function (t) { return TAGS.indexOf(t) >= 0; }), note: typeof f.note === 'string' ? U.clip(f.note, 400) : '' });
      });
    });
  }

  function analyze(text, opts) {
    opts = opts || {};
    var original = String(text || ''), clean = stripAdvice(original), hits = {}, flags = [], score = 0, urls, links = [], linkFlag, worst, i, claimed, sd, sinsp, letters, upper, bangs, ev;

    function push(f) { flags.push(f); score += f.weight; hits[f.id] = true; }

    SW.data.rules.forEach(function (rule) {
      var m = null, ok;
      if (rule.requires && !rule.requires.every(function (id) { return hits[id]; })) { return; }
      ok = rule.groups.every(function (g, gi) {
        var j, mm;
        for (j = 0; j < g.length; j++) {
          mm = g[j].exec(clean);
          if (mm) { if (gi === 0 || !m) { m = m || mm; } return true; }
        }
        return false;
      });
      if (ok) {
        ev = m ? U.clip(m[0], 90) : '';
        push({ id: rule.id, cat: rule.cat, title: rule.title, why: rule.why, weight: rule.weight, evidence: ev, tags: rule.tags || [] });
      }
    });

    takeMatcherFlags(clean, hits, push);

    urls = SW.links.extract(clean);
    for (i = 0; i < urls.length; i++) { links.push(SW.links.inspect(urls[i])); }
    worst = null;
    links.forEach(function (l) { if (l.score >= 2 && (!worst || l.score > worst.score)) { worst = l; } });
    if (worst) {
      linkFlag = worst.flags.slice().sort(function (a, b) { return b.weight - a.weight; })[0];
      push({ id: 'link', cat: 'link', title: 'Suspicious link: ' + linkFlag.title, why: linkFlag.why, weight: Math.min(8, worst.score),
        evidence: U.clip(worst.input, 90), tags: [] });
    }

    claimed = claimedBrands(clean).filter(function (n) { var b = brandByName(n); return b && b.kind !== 'crypto' || (b && b.kind === 'crypto'); });
    if (claimed.length && links.length) {
      var matched = claimed.some(function (n) {
        var b = brandByName(n);
        return links.some(function (l) { return b && b.domains.indexOf(l.registrable) >= 0; });
      });
      if (!matched) {
        push({ id: 'brand_link_mismatch', cat: 'link', title: 'Says it is from ' + claimed[0] + ' but the link goes elsewhere',
          why: 'The message names ' + claimed[0] + ' but the link leads to ' + (links[0].registrable || links[0].host) + ', not to one of its real sites.',
          weight: 4, evidence: U.clip(links[0].input, 90), tags: [] });
      }
    }

    if (opts.sender && String(opts.sender).trim()) {
      sd = senderDomain(opts.sender);
      sinsp = SW.links.inspect('https://' + sd);
      var free = SW.data.freeMail.indexOf(sinsp.registrable) >= 0;
      var claimedOk = claimed.some(function (n) { var b = brandByName(n); return b && b.domains.indexOf(sinsp.registrable) >= 0; });
      if (sinsp.lookalikeOf && !sinsp.official) {
        push({ id: 'sender_lookalike', cat: 'link', title: 'Sender address imitates ' + sinsp.lookalikeOf,
          why: 'The sender domain "' + sd + '" is built to resemble ' + sinsp.lookalikeOf + '.', weight: Math.min(6, sinsp.score), evidence: sd, tags: [] });
      } else if (claimed.length && !claimedOk) {
        push({ id: free ? 'sender_freemail' : 'sender_mismatch', cat: 'link',
          title: free ? 'Claims to be ' + claimed[0] + ' but sent from a free email address' : 'Sender does not match ' + claimed[0],
          why: free ? 'Companies write from their own domain, not from ' + sd + '.' : 'The sender domain "' + sd + '" is not one of ' + claimed[0] + '’s real domains.',
          weight: 4, evidence: sd, tags: [] });
      } else if (free && /\b(?:support|security|billing|customer service|fraud|compliance|accounts?|payroll|hr|human resources|help ?desk|service desk)\s+(?:team|department|desk|center|centre)\b/i.test(clean)) {
        push({ id: 'sender_freemail', cat: 'link', title: 'Official-sounding team using a free email address',
          why: 'A real department normally writes from its organisation’s own domain, not from ' + sd + '.', weight: 3, evidence: sd, tags: [] });
      }
    }

    letters = (original.match(/[A-Za-z]/g) || []).length;
    upper = (original.match(/[A-Z]/g) || []).length;
    bangs = (original.match(/!/g) || []).length;
    if ((letters >= 25 && upper / letters > 0.6) || bangs >= 4) {
      push({ id: 'shouting', cat: 'other', title: 'SHOUTING or heavy punctuation', why: 'Capital letters and !!! are used to create panic.', weight: 1, evidence: '', tags: [] });
    }

    if (hits.giftcard || hits.crypto_atm || hits.code_request) { score = Math.max(score, 6); }

    flags.sort(function (a, b) {
      var fa = opts.focus && a.tags.indexOf(opts.focus) >= 0 ? 1 : 0, fb = opts.focus && b.tags.indexOf(opts.focus) >= 0 ? 1 : 0;
      return (fb - fa) || (b.weight - a.weight);
    });

    return {
      score: score, level: U.levelFor(score), flags: flags, links: links, claimed: claimed, empty: !original.trim(),
      patternsAsOf: patternsAsOf(),
      steps: nextSteps(hits, U.levelFor(score)), disclaimer: SW.analysisDisclaimer
    };
  }

  function nextSteps(hits, level) {
    var s = [];
    s.push('Do not reply, click links, open attachments, or call numbers shown in the message.');
    s.push('Check another way: use the phone number on your card or statement, the official app, or type the company’s website address yourself.');
    if (hits.giftcard) { s.push('If you already bought gift cards, call the card company now (the number is on the back of the card) and report it. Quick action sometimes freezes the money.'); }
    if (hits.code_request || hits.credentials || hits.remote_access) { s.push('If you shared a code, password or gave remote access, change your passwords from a different device and tell your bank. See "If you were scammed".'); }
    if (hits.fake_collector || hits.refuse_validation || hits.threat) { s.push('For a debt claim, ask for a written validation notice. A real collector must provide one. See "Debt rights".'); }
    if (hits.debt_relief || hits.upfront_fee) { s.push('Do not pay upfront for debt or credit help. Nonprofit credit counseling (NFCC) is a safer starting point.'); }
    if (level.rank >= 1) { s.push('Report it: forward scam texts to 7726 (SPAM), and report at ReportFraud.ftc.gov (copy the address into your browser).'); }
    if (level.rank === 0) { s.push('Even with no flags: if it asks for money, codes, or quick action, verify it another way first.'); }
    return s;
  }

  SW.analysisDisclaimer = 'This is a pattern check done on your device. It cannot see who really sent a message and it cannot tell you something is safe. When in doubt, verify with the organisation using contact details you already trust.';
  SW.analyzer = { analyze: analyze, stripAdvice: stripAdvice, claimedBrands: claimedBrands, addMatcher: addMatcher, patternsAsOf: patternsAsOf };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.analyzer; }
})(typeof window !== 'undefined' ? window : globalThis);
