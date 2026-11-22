/* Stark Warden: trusted circle. Shamir secret sharing over GF(256): split a short secret (a vault passphrase, a recovery note) into
   N share codes so any K of them rebuild it and fewer than K reveal nothing. Runs on this device with the browser's secure random
   numbers. Each share carries a checksum so a mistyped share is caught, and the secret carries a 4-byte SHA-256 tag (format SWS2)
   so a wrong but well-formed mix of shares is refused instead of rebuilding garbage. No network, nothing stored. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1, i;
    for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = (x ^ (x << 1) ^ (x & 0x80 ? 0x11b : 0)) & 0xff; }
    for (i = 255; i < 512; i++) { EXP[i] = EXP[i - 255]; }
  })();
  function mul(a, b) { return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]; }
  function div(a, b) { return a === 0 ? 0 : EXP[LOG[a] + 255 - LOG[b]]; }

  function rnd(n) {
    var a = new Uint8Array(n), c = root.crypto;
    if (!c || !c.getRandomValues) { throw new Error('This browser has no secure random numbers, so shares cannot be made safely here.'); }
    c.getRandomValues(a);
    return a;
  }
  function hex(a) { var s = '', j; for (j = 0; j < a.length; j++) { s += ('0' + a[j].toString(16)).slice(-2); } return s; }
  function unhex(s) { var a = new Uint8Array(s.length / 2), j; for (j = 0; j < a.length; j++) { a[j] = parseInt(s.substr(j * 2, 2), 16); } return a; }
  function sum(s) { return SW.backup.sha256('sw-share|' + s).slice(0, 4); }
  function tag(secret) { return unhex(SW.backup.sha256('sw-secret|' + secret).slice(0, 8)); }

  /* Share code: SWS2-<k>of<n>-<index>-<set id>-<payload hex in groups of 8>-<checksum>. The set id ties shares of one split together. */
  function split(secret, n, k, rng) {
    var raw = new TextEncoder().encode(String(secret)), bytes, coef, shares = [], j, b, i, y, xi, setId, rand = rng || rnd;
    n = n | 0; k = k | 0;
    if (!raw.length) { throw new Error('Type the secret first.'); }
    if (raw.length > 400) { throw new Error('That is too long. Keep the secret under 400 bytes (a passphrase or a short note).'); }
    if (k < 2 || n < k || n > 12) { throw new Error('Choose 2 or more shares needed, and at most 12 shares in all.'); }
    bytes = new Uint8Array(raw.length + 4); bytes.set(raw); bytes.set(tag(String(secret)), raw.length);
    setId = hex(rand(3));
    for (j = 1; j <= n; j++) { shares.push({ x: j, y: new Uint8Array(bytes.length) }); }
    for (b = 0; b < bytes.length; b++) {
      coef = rand(k - 1);
      for (j = 0; j < n; j++) {
        xi = shares[j].x; y = 0;
        for (i = k - 2; i >= 0; i--) { y = mul(y, xi) ^ coef[i]; }
        shares[j].y[b] = mul(y, xi) ^ bytes[b];
      }
    }
    return shares.map(function (s) {
      var body = 'SWS2-' + k + 'of' + n + '-' + s.x + '-' + setId + '-' + hex(s.y).replace(/(.{8})(?=.)/g, '$1.');
      return body + '-' + sum(body);
    });
  }

  function parse(code) {
    var t = String(code || '').replace(/\s+/g, ''), m = /^SWS([12])-(\d+)of(\d+)-(\d+)-([0-9a-f]{6})-([0-9a-f.]+)-([0-9a-f]{4})$/i.exec(t), body, hx;
    if (!m) { return { ok: false, err: 'That does not look like a share code.' }; }
    body = 'SWS' + m[1] + t.slice(4, t.lastIndexOf('-')).toLowerCase();
    if (sum(body) !== m[7].toLowerCase()) { return { ok: false, err: 'This share has a typing mistake (its checksum does not match).' }; }
    hx = m[6].replace(/\./g, '').toLowerCase();
    if (+m[4] < 1 || +m[4] > 255 || +m[2] < 2 || hx.length % 2 || (m[1] === '2' && hx.length < 10)) { return { ok: false, err: 'That share code is not valid.' }; }
    return { ok: true, ver: +m[1], k: +m[2], n: +m[3], x: +m[4], set: m[5].toLowerCase(), y: unhex(hx) };
  }

  function combine(codes) {
    var ps = [], seen = {}, j, i, b, a, len, out, num, den, acc, k, set, secret, t;
    for (j = 0; j < codes.length; j++) {
      if (!String(codes[j] || '').trim()) { continue; }
      a = parse(codes[j]);
      if (!a.ok) { throw new Error('Share ' + (j + 1) + ': ' + a.err); }
      if (seen[a.x]) { throw new Error('Share number ' + a.x + ' was entered twice.'); }
      seen[a.x] = true; ps.push(a);
    }
    if (!ps.length) { throw new Error('Paste at least one share.'); }
    k = ps[0].k; set = ps[0].set; len = ps[0].y.length;
    for (j = 1; j < ps.length; j++) { if (ps[j].set !== set || ps[j].k !== k || ps[j].ver !== ps[0].ver || ps[j].y.length !== len) { throw new Error('These shares come from different splits and cannot be combined.'); } }
    if (ps.length < k) { throw new Error('You need ' + k + ' shares and have ' + ps.length + '.'); }
    ps = ps.slice(0, k); out = new Uint8Array(len);
    for (b = 0; b < len; b++) {
      acc = 0;
      for (j = 0; j < k; j++) {
        num = 1; den = 1;
        for (i = 0; i < k; i++) { if (i !== j) { num = mul(num, ps[i].x); den = mul(den, ps[i].x ^ ps[j].x); } }
        acc ^= mul(ps[j].y[b], div(num, den));
      }
      out[b] = acc;
    }
    if (ps[0].ver === 1) {
      try { return new TextDecoder('utf-8', { fatal: true }).decode(out); } catch (e) { throw new Error('The shares did not rebuild a readable secret. One of them may belong to a different split.'); }
    }
    try { secret = new TextDecoder('utf-8', { fatal: true }).decode(out.subarray(0, len - 4)); } catch (e2) { secret = null; }
    t = secret === null ? null : tag(secret);
    if (!t || hex(t) !== hex(out.subarray(len - 4))) { throw new Error('The shares did not rebuild the secret: its built-in check failed. One of them may belong to a different split or be mistyped.'); }
    return secret;
  }

  SW.shamir = { split: split, combine: combine, parse: parse };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.shamir; }
})(typeof window !== 'undefined' ? window : globalThis);
