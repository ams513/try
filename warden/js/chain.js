/* Stark Warden: evidence seal. A tamper-evident hash chain over your contact log (SHA-256, on this device).
   Each entry is hashed together with the one before it, so changing, removing, adding or re-ordering an entry later changes the
   seal code. It shows whether the log changed after you sealed it. It does not prove the entries are true or who made them. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var FIELDS = ['id', 'at', 'channel', 'dir', 'collector', 'phone', 'debtRef', 'thirdPartyName', 'spoke', 'atWork', 'demandsPayment', 'permittedException', 'notes', 'flags'];

  function sha(s) { return SW.backup.sha256(s); }
  function canon(v) {
    if (Array.isArray(v)) { return '[' + v.map(canon).join(',') + ']'; }
    if (v && typeof v === 'object') { return '{' + Object.keys(v).sort().filter(function (x) { return v[x] !== undefined; }).map(function (x) { return JSON.stringify(x) + ':' + canon(v[x]); }).join(',') + '}'; }
    return JSON.stringify(v === undefined || v === null ? '' : v);
  }
  function pick(e) {
    var o = {}, i, f, k;
    for (i = 0; i < FIELDS.length; i++) {
      if (FIELDS[i] === 'flags') {
        if (e && e.flags) { f = {}; for (k in e.flags) { if (e.flags[k]) { f[k] = true; } } o.flags = f; }
      } else if (e && e[FIELDS[i]] !== undefined && e[FIELDS[i]] !== '' && e[FIELDS[i]] !== false) { o[FIELDS[i]] = e[FIELDS[i]]; }
    }
    return o;
  }
  function content(e) { return sha(canon(pick(e))); }
  function order(entries) {
    return entries.map(function (e, i) { return { e: e, i: i }; }).sort(function (a, b) {
      var x = String(a.e.at || ''), y = String(b.e.at || ''), p = String(a.e.id || ''), q = String(b.e.id || '');
      return x < y ? -1 : x > y ? 1 : (p < q ? -1 : p > q ? 1 : a.i - b.i);
    }).map(function (x) { return x.e; });
  }
  /* The seal code is the first 20 hex characters in 5 groups: short enough to copy by hand. */
  function anchorOf(h) { return h.slice(0, 20).toUpperCase().replace(/(.{4})(?=.)/g, '$1-'); }

  function seal(entries, sealedAt) {
    var list = order(entries || []), prev = sha('stark-warden-evidence-seal-v1'), links = list.map(function (e) {
      var c = content(e);
      prev = sha(prev + '|' + c);
      return { id: e.id || '', c: c.slice(0, 16), h: prev };
    });
    return { v: 1, sealedAt: sealedAt || '', n: links.length, links: links, head: prev, anchor: anchorOf(prev) };
  }

  /* Compare the log as it is now with a saved seal. */
  function check(entries, saved) {
    var now = seal(entries, ''), have = {}, changed = [], missing = [], added = [], i, l, nl, ids = {};
    if (!saved || saved.v !== 1 || !Array.isArray(saved.links)) { return { ok: false, status: 'invalid', changed: [], missing: [], added: [], note: 'That is not a Warden seal.' }; }
    if (saved.head === now.head && saved.n === now.n) {
      return { ok: true, status: 'intact', changed: [], missing: [], added: [], note: 'The log matches the seal exactly. Nothing was changed, added or removed after it was sealed.' };
    }
    now.links.forEach(function (x) { have[x.id + '#' + x.c] = true; ids[x.id] = true; });
    for (i = 0; i < saved.links.length; i++) {
      l = saved.links[i];
      if (!have[l.id + '#' + l.c]) { (l.id && ids[l.id] ? changed : missing).push(l.id || ('#' + (i + 1))); }
    }
    have = {}; ids = {};
    saved.links.forEach(function (x) { have[x.id + '#' + x.c] = true; ids[x.id] = true; });
    for (i = 0; i < now.links.length; i++) {
      nl = now.links[i];
      if (!have[nl.id + '#' + nl.c] && !(nl.id && ids[nl.id])) { added.push(nl.id || ('#' + (i + 1))); }
    }
    return { ok: false, status: 'changed', changed: changed, missing: missing, added: added,
      note: 'The log is different from the seal: ' + changed.length + ' changed, ' + missing.length + ' removed, ' + added.length + ' added since sealing. Added entries are normal if you kept logging: seal again to include them.' };
  }

  /* Does a seal code someone gave you (typed with or without dashes and spaces) match the log as it is now? */
  function matchesAnchor(entries, code) {
    var a = String(code || '').toUpperCase().replace(/[^0-9A-F]/g, ''), now = seal(entries, '');
    return a.length >= 12 && now.head.toUpperCase().indexOf(a) === 0;
  }

  /* Plain-text certificate to print, save or keep elsewhere. The seal code is the part to keep outside this device. */
  function certificate(entries, s, name, today) {
    var list = order(entries || []), L = [];
    L.push('STARK WARDEN EVIDENCE SEAL');
    L.push('Prepared ' + today + (name ? ' for ' + name : ''));
    L.push('Sealed at: ' + s.sealedAt + '   Entries: ' + s.n);
    L.push('Seal code: ' + s.anchor);
    L.push('Full seal: ' + s.head);
    L.push('');
    L.push('What this is: each entry below was hashed (SHA-256) together with the entry before it. If any entry is later changed, removed or inserted, the seal code no longer matches.');
    L.push('What this is not: it does not prove the entries are true or who wrote them, and a person can always seal again. To make it useful, keep the seal code somewhere other than this device (email it to yourself, write it on paper, tell a trusted person).');
    L.push('This is general information, not legal advice. Whether a record can be used in any case is for a court or an attorney to decide.');
    L.push('');
    list.forEach(function (e, i) { L.push((i + 1) + '. ' + (e.at || '?') + '  ' + (e.channel || '') + '  ' + (e.collector || '') + '  link ' + s.links[i].h.slice(0, 12)); });
    return L.join('\n');
  }

  SW.chain = { seal: seal, check: check, matchesAnchor: matchesAnchor, certificate: certificate, content: content, canon: canon, anchorOf: anchorOf };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.chain; }
})(typeof window !== 'undefined' ? window : globalThis);
