/* Stark Warden: offline link inspector. Parses text only; it never opens or fetches the address. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var U = SW.util;

  function punyDecode(input) {
    var base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, n = 128, i = 0, bias = 72, out = [], basic, j, index, oldi, w, k, cp, digit, t, len;
    function adapt(delta, num, first) {
      var kk = 0;
      delta = first ? Math.floor(delta / damp) : delta >> 1;
      delta += Math.floor(delta / num);
      for (; delta > (((base - tMin) * tMax) >> 1); kk += base) { delta = Math.floor(delta / (base - tMin)); }
      return Math.floor(kk + (base - tMin + 1) * delta / (delta + skew));
    }
    basic = input.lastIndexOf('-');
    if (basic < 0) { basic = 0; }
    for (j = 0; j < basic; ++j) { out.push(input.charCodeAt(j)); }
    for (index = basic > 0 ? basic + 1 : 0; index < input.length;) {
      oldi = i;
      for (w = 1, k = base; ; k += base) {
        if (index >= input.length) { throw new Error('bad punycode'); }
        cp = input.charCodeAt(index++);
        digit = cp - 48 < 10 ? cp - 22 : (cp - 65 < 26 ? cp - 65 : (cp - 97 < 26 ? cp - 97 : base));
        i += digit * w;
        t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
        if (digit < t) { break; }
        w *= base - t;
      }
      len = out.length + 1;
      bias = adapt(i - oldi, len, oldi === 0);
      n += Math.floor(i / len);
      i %= len;
      out.splice(i++, 0, n);
    }
    return String.fromCodePoint.apply(null, out);
  }

  function toUnicodeHost(host) {
    return host.split('.').map(function (l) {
      if (l.indexOf('xn--') === 0) { try { return punyDecode(l.slice(4)); } catch (e) { return l; } }
      return l;
    }).join('.');
  }

  function skeleton(s) {
    var c = SW.data.confusables, out = '', ch, i;
    s = s.toLowerCase();
    try { s = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* old engines */ }
    for (i = 0; i < s.length; i++) { ch = s.charAt(i); out += c[ch] || ch; }
    return out.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/[1i]/g, 'l').replace(/5/g, 's').replace(/3/g, 'e')
      .replace(/\$/g, 's').replace(/-/g, '');
  }

  function isIpHost(h) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || /^0x[0-9a-f]+$/i.test(h) || /^\d{8,10}$/.test(h) ||
      /^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){1,3}$/i.test(h) && /0x|\.0\d/i.test(h) || /^\[[0-9a-f:.]+\]$/i.test(h);
  }

  function registrable(host) {
    var labels = host.split('.'), i, tail2, tail;
    if (labels.length <= 2) { return { reg: host, sub: [] , suffix: labels.slice(1).join('.') }; }
    tail2 = labels.slice(-2).join('.');
    for (i = 0; i < SW.data.freeHosts.length; i++) {
      tail = SW.data.freeHosts[i];
      if (host === tail) { return { reg: host, sub: [], suffix: tail, free: true }; }
      if (host.slice(-tail.length - 1) === '.' + tail) {
        labels = host.slice(0, -tail.length - 1).split('.');
        return { reg: labels[labels.length - 1] + '.' + tail, sub: labels.slice(0, -1), suffix: tail, free: true };
      }
    }
    if (SW.data.twoLevelSuffixes.indexOf(tail2) >= 0) {
      return { reg: labels.slice(-3).join('.'), sub: labels.slice(0, -3), suffix: tail2 };
    }
    return { reg: tail2, sub: labels.slice(0, -2), suffix: labels[labels.length - 1] };
  }

  function parse(input) {
    var s = String(input).trim(), m, scheme = '', rest, auth, pathq, userinfo = '', host, port = '', at;
    m = /^([a-z][a-z0-9+.\-]*):(\/\/)?/i.exec(s);
    if (m && (m[2] || /^(javascript|data|mailto|tel|sms|file):/i.test(s))) {
      scheme = m[1].toLowerCase();
      rest = s.slice(m[0].length);
    } else { rest = s.replace(/^\/\//, ''); }
    if (/^(javascript|data|file)$/.test(scheme)) { return { scheme: scheme, host: '', raw: s, odd: true }; }
    m = /^[^\/?#]*/.exec(rest);
    auth = m[0];
    pathq = rest.slice(auth.length);
    at = auth.lastIndexOf('@');
    if (at >= 0) { userinfo = auth.slice(0, at); auth = auth.slice(at + 1); }
    m = /^(\[[^\]]*\]|[^:]*)(?::(\d*))?$/.exec(auth);
    host = (m ? m[1] : auth).toLowerCase().replace(/\.$/, '');
    port = m && m[2] ? m[2] : '';
    return { scheme: scheme, userinfo: userinfo, host: host, port: port, path: pathq, raw: s };
  }

  function brandCheck(unicodeHost, reg, sub) {
    var brands = SW.data.brands, i, j, b, best = null, label, compact, tokens, cand, sk, dist, regLabel, subText, flag, rest;
    for (i = 0; i < brands.length; i++) {
      if (brands[i].domains.indexOf(reg) >= 0) { return { official: brands[i] }; }
    }
    regLabel = reg.split('.')[0];
    label = regLabel;
    compact = label.replace(/-/g, '');
    tokens = label.split('-');
    subText = sub.join('.');
    sk = skeleton(label);
    for (i = 0; i < brands.length; i++) {
      b = brands[i];
      flag = null;
      for (j = 0; j < b.domains.length && !flag; j++) {
        cand = b.domains[j];
        if (subText && (subText + '.').indexOf(cand + '.') >= 0) { flag = { w: 6, id: 'subdomain', brand: b }; }
      }
      if (!flag && b.label.length >= 3 && sub.length && sub.some(function (l) { return skeleton(l) === skeleton(b.label) || l.split('-').indexOf(b.label) >= 0; })) {
        flag = { w: 6, id: 'subdomain', brand: b };
      }
      if (!flag && b.label.length >= 3 && sk === skeleton(b.label) && compact !== b.label) { flag = { w: 6, id: 'lookalike', brand: b }; }
      if (!flag && compact === b.label && b.label.length >= 3) { flag = { w: 5, id: 'otherdomain', brand: b }; }
      if (!flag && b.label.length >= 5 && compact.length >= 5) {
        dist = U.editDistance(compact, b.label);
        if (dist <= 1 || (dist <= 2 && b.label.length >= 10 && compact.length >= 10)) { flag = { w: 6, id: 'typosquat', brand: b }; }
      }
      if (!flag && b.label.length >= 4 && tokens.length > 1 && tokens.some(function (t) { return t !== b.label && t.length >= 4 && skeleton(t) === skeleton(b.label); })) {
        flag = { w: 6, id: 'lookalike', brand: b };
      }
      if (!flag && b.label.length >= 6 && sk.length >= skeleton(b.label).length + 3 &&
          (sk.indexOf(skeleton(b.label)) === 0 || sk.slice(-skeleton(b.label).length) === skeleton(b.label))) {
        flag = { w: 5, id: 'contains', brand: b };
      }
      if (!flag) {
        for (j = 0; j < b.tokens.length && !flag; j++) {
          if (b.tokens[j].length >= 3 && tokens.indexOf(b.tokens[j]) >= 0) { flag = { w: 4, id: 'contains', brand: b }; }
        }
      }
      if (!flag && b.label.length >= 6 && compact.length >= b.label.length + 3 &&
          (compact.indexOf(b.label) === 0 || compact.slice(-b.label.length) === b.label)) {
        rest = compact.replace(b.label, '');
        if (rest.length >= 3) { flag = { w: 4, id: 'contains', brand: b }; }
      }
      if (flag && (!best || flag.w > best.w)) { best = flag; }
    }
    return { flag: best };
  }

  var BRAND_WORDS = {
    subdomain: ['Misleading subdomain', function (b) { return 'The real site is the LAST part before the first slash, not the first word. This address puts "' + b.name + '" in front of a different site, a classic trick to look official.'; }],
    lookalike: ['Look-alike of ' , function (b) { return 'The name is built from look-alike characters (such as 0 for o, 1 for l, rn for m, or letters from other alphabets) to pass for ' + b.name + '.'; }],
    typosquat: ['Looks almost like ', function (b) { return 'One letter away from ' + b.name + '’s real name, a "typosquat". Scammers register these hoping you will not notice.'; }],
    otherdomain: ['Uses the name of ', function (b) { return 'The name matches ' + b.name + ' but the address is not one of its real domains (' + b.domains.slice(0, 2).join(', ') + '). Anyone can register such a name.'; }],
    contains: ['Brand name added to another domain', function (b) { return 'It adds extra words around "' + b.name + '". Real companies rarely send you to hyphenated "secure", "login" or "support" domains.'; }]
  };

  function inspect(input) {
    var p = parse(input), flags = [], score = 0, notes = [], host, uHost, rp, bc, label, mixed, i, tld, kw, out;
    function add(id, title, why, w) { flags.push({ id: id, title: title, why: why, weight: w }); score += w; }
    out = { input: String(input), flags: flags, notes: notes };
    if (p.odd) {
      add('scheme', 'Not a normal web address', 'Addresses starting with "' + p.scheme + ':" can run code or hide content. Do not open it.', 6);
      out.score = score; out.level = U.levelFor(score); out.host = ''; return out;
    }
    host = p.host;
    out.scheme = p.scheme || '(none given)';
    out.host = host;
    if (!host) { out.score = 0; out.level = U.levelFor(0); out.empty = true; return out; }
    uHost = toUnicodeHost(host);
    out.unicodeHost = uHost;

    if (p.scheme === 'http') { add('http', 'Not encrypted (http)', 'The page does not use HTTPS. A padlock or https alone never proves a site is honest, but a login page without it is a red flag.', 1); }

    if (p.userinfo) {
      add('userinfo', 'Text before an @ sign',
        'Everything before the @ is ignored by the browser. The real destination is "' + host + '", not what appears first.', /\./.test(p.userinfo) ? 6 : 3);
    }

    if (isIpHost(host)) {
      add('ip', 'Raw number instead of a name', 'Real organisations use names, not numbers. Numeric hosts are common in phishing and malware links.', 4);
      out.registrable = host;
      out.score = score; out.level = U.levelFor(score);
      return out;
    }

    rp = registrable(uHost);
    out.registrable = rp.reg;
    label = rp.reg.split('.')[0];

    if (host.indexOf('xn--') >= 0 || /[^\x00-\x7f]/.test(host)) {
      mixed = uHost.split('.').some(function (l) { return /[a-z]/i.test(l) && /[^\x00-\x7f]/.test(l); });
      add('idn', 'International characters in the name',
        'The name is written with non-English letters (shown as "' + uHost + '"). Some of them look identical to English letters.', mixed ? 5 : 3);
      if (mixed) { flags[flags.length - 1].title = 'Mixed alphabets in one name'; flags[flags.length - 1].why += ' It mixes alphabets in one word, which is almost never legitimate.'; }
    }

    bc = brandCheck(uHost, rp.reg, rp.sub);
    if (bc.official) {
      out.official = bc.official.name;
      notes.push('This is one of ' + bc.official.name + '’s real domains. That alone does not prove the message or page is genuine: scammers can still send you there for a bad reason, or fake the sender.');
    } else if (bc.flag) {
      var bw = BRAND_WORDS[bc.flag.id];
      add('brand-' + bc.flag.id, bw[0] + (bc.flag.id === 'lookalike' || bc.flag.id === 'typosquat' || bc.flag.id === 'otherdomain' ? bc.flag.brand.name : ''), bw[1](bc.flag.brand), bc.flag.w);
      out.lookalikeOf = bc.flag.brand.name;
    }

    if (SW.data.shorteners.indexOf(rp.reg) >= 0) {
      add('shortener', 'Link shortener', 'A shortened link hides where it really goes. Real banks and agencies rarely use them for account matters. Do not open it; ask the sender for the full address another way.', 2);
    }
    if (rp.free) { add('freehost', 'Free web hosting', 'Anyone can publish a page here under any name. The name before ".' + rp.suffix + '" is chosen by whoever made the page, not by a company.', 1); }
    tld = rp.suffix.split('.').pop();
    if (SW.data.riskyTlds.indexOf(tld) >= 0) { add('tld', 'Cheap, often-abused ending (.' + tld + ')', 'Many legitimate sites exist, but this ending is cheap and heavily used for throwaway scam sites.', 1); }
    if (uHost.split('.').length >= 5) { add('deep', 'Very many dots', 'Long chains of sub-names are used to bury the real domain. Read the address from right to left.', 1); }
    if ((label.match(/-/g) || []).length >= 3) { add('hyphens', 'Many hyphens in the name', 'Domains stuffed with hyphens and keywords are rarely real businesses.', 1); }
    if (p.port && p.port !== '80' && p.port !== '443') { add('port', 'Unusual port number', 'Ordinary sites do not need ":' + p.port + '".', 1); }
    if (String(input).length > 150) { add('long', 'Very long address', 'Very long links can hide where they go.', 1); }

    return finishPath(out, p, flags, function (w) { score += w; out.score = score; out.level = U.levelFor(score); }, rp, bc, score);
  }

  function finishPath(out, p, flags, bump, rp, bc, score) {
    var path = (p.path || '').toLowerCase(), hit, bd, i, official = bc && bc.official, w = 0;
    function add(id, title, why, ww) { flags.push({ id: id, title: title, why: why, weight: ww }); w += ww; }
    if (!official) {
      for (i = 0; i < SW.data.brands.length; i++) {
        bd = SW.data.brands[i].domains[0];
        if (bd.length >= 6 && path.indexOf(bd) >= 0) {
          add('pathbrand', 'Real company address hidden in the path', 'The page address contains "' + bd + '" after the slash, but the site itself is "' + (out.registrable || out.host) + '". Only the part before the first slash decides who runs the site.', 3);
          break;
        }
      }
      hit = /(login|log-in|signin|sign-in|verify|verification|secure|account|update|confirm|password|billing|wallet|unlock|suspend|recover|reactivate|claim)/.exec(path.split('?')[0]);
      if (hit) { add('pathword', 'Account-type words in the path', 'A path like "/' + hit[1] + '" on an unfamiliar site is how fake login pages are labelled.', 1); }
    }
    if (/[?&](?:url|redirect|redir|next|goto|dest|target|link|continue|return)=(?:https?|%68%74%74%70)/i.test(p.path || '')) {
      add('redirect', 'Redirect to another address', 'This link contains another address to bounce you to. Check where it ends up before trusting it.', 2);
    }
    bump(w);
    return out;
  }

  /* Find web addresses inside a block of text. */
  var TLDS = 'com|net|org|co|io|info|biz|xyz|top|click|link|me|ly|gl|us|gov|edu|ru|cn|tk|cc|site|online|shop|support|help|app|dev|live|icu|vip|club|work|cfd|sbs|buzz|rest|pro|in|uk|ca|de|fr|to|zip|mov|cyou|store|page|world|today|email|cloud|ws|ink|monster|quest|lol';
  function extract(text) {
    var re = new RegExp('(?:\\bhttps?:\\/\\/[^\\s<>"\']+|\\bwww\\.[^\\s<>"\']+|(?<![@\\w.\\-])(?:[a-z0-9\\u00a1-\\uffff](?:[a-z0-9\\u00a1-\\uffff\\-]*[a-z0-9\\u00a1-\\uffff])?\\.)+(?:' + TLDS + ')\\b(?:\\/[^\\s<>"\']*)?)', 'gi');
    var out = [], seen = {}, m, u;
    while ((m = re.exec(text)) !== null) {
      u = m[0].replace(/[.,;:!?)\]}>'"]+$/, '');
      if (u && !seen[u.toLowerCase()]) { seen[u.toLowerCase()] = 1; out.push(u); }
      if (out.length >= 10) { break; }
    }
    return out;
  }

  SW.links = { inspect: inspect, extract: extract, punyDecode: punyDecode, skeleton: skeleton, registrable: registrable, parse: parse };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.links; }
})(typeof window !== 'undefined' ? window : globalThis);
