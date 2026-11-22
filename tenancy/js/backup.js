/* Stark Tenancy: local-protection helpers (copied from Stark Warden). Crash-safe saves (write, read back, keep the last good
   copy), backup checksum (SHA-256, photos included) and strict backup validation. Pure functions; no network, no storage of their own. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  var BAD = ['__proto__', 'constructor', 'prototype'];
  var MAX_VALUE = 3000000, MAX_TOTAL = 20000000, MAX_KEYS = 2000;

  /* ---------- SHA-256 (sync, UTF-8 input) ---------- */
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(s) {
    var u = unescape(encodeURIComponent(s)), a = new Uint8Array(u.length), i;
    for (i = 0; i < u.length; i++) { a[i] = u.charCodeAt(i); }
    return a;
  }
  function sha256(str) {
    var m = utf8(String(str)), l = m.length, n = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(n), w = new Int32Array(64), H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], i, j, o, a, e, t1, t2, s0, s1, v, out = '', hv;
    function rr(x, c) { return (x >>> c) | (x << (32 - c)); }
    b.set(m); b[l] = 0x80;
    hv = Math.floor(l / 0x20000000); b[n - 8] = hv >>> 24; b[n - 7] = hv >>> 16; b[n - 6] = hv >>> 8; b[n - 5] = hv;
    hv = (l << 3) >>> 0; b[n - 4] = hv >>> 24; b[n - 3] = hv >>> 16; b[n - 2] = hv >>> 8; b[n - 1] = hv;
    for (o = 0; o < n; o += 64) {
      for (i = 0; i < 16; i++) { w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3]; }
      for (i = 16; i < 64; i++) {
        s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3); s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      v = H.slice();
      for (i = 0; i < 64; i++) {
        s1 = rr(v[4], 6) ^ rr(v[4], 11) ^ rr(v[4], 25); a = (v[4] & v[5]) ^ (~v[4] & v[6]); t1 = (v[7] + s1 + a + K[i] + w[i]) | 0;
        s0 = rr(v[0], 2) ^ rr(v[0], 13) ^ rr(v[0], 22); e = (v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]); t2 = (s0 + e) | 0;
        v = [(t1 + t2) | 0, v[0], v[1], v[2], (v[3] + t1) | 0, v[4], v[5], v[6]];
      }
      for (i = 0; i < 8; i++) { H[i] = (H[i] + v[i]) | 0; }
    }
    for (j = 0; j < 8; j++) { out += ('00000000' + (H[j] >>> 0).toString(16)).slice(-8); }
    return out;
  }

  /* ---------- backup seal and strict validation (photos travel with their own SHA-256) ---------- */
  var PHOTO_KEYS = ['id', 'profile', 'data', 'mime', 'addedAt', 'taken', 'fileDate', 'label', 'w', 'h', 'hash'];
  var MAX_PHOTOS = 4000, MAX_PHOTO = 4000000, MAX_PHOTO_TOTAL = 600000000;
  function canonical(app, version, exported, data, photos) {
    return JSON.stringify([app, version, exported, Object.keys(data).sort().map(function (k) { return [k, data[k]]; }),
      (photos || []).map(function (p) { return [p.id, p.hash]; }).sort(function (x, y) { return x[0] < y[0] ? -1 : (x[0] > y[0] ? 1 : 0); })]);
  }
  function seal(app, version, exported, data, photos) {
    var o = { app: app, version: version, exported: exported, data: data, photos: photos || [] };
    o.sha256 = sha256(canonical(app, version, exported, data, o.photos));
    return o;
  }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function hasBadKey(x, depth) {
    var k, i;
    if (depth > 24) { return true; }
    if (Array.isArray(x)) { for (i = 0; i < x.length; i++) { if (hasBadKey(x[i], depth + 1)) { return true; } } return false; }
    if (isObj(x)) { for (k in x) { if (BAD.indexOf(k) >= 0 || hasBadKey(x[k], depth + 1)) { return true; } } }
    return false;
  }
  function validateSettings(s) {
    var k;
    if (!isObj(s)) { return false; }
    if ('theme' in s && ['auto', 'dark', 'light'].indexOf(s.theme) < 0) { return false; }
    if ('large' in s && typeof s.large !== 'boolean') { return false; }
    if ('lang' in s && ['en', 'es'].indexOf(s.lang) < 0) { return false; }
    if ('profile' in s && (typeof s.profile !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(s.profile))) { return false; }
    if ('profiles' in s && (!Array.isArray(s.profiles) || s.profiles.length > 50 || s.profiles.some(function (p) { return typeof p !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(p); }))) { return false; }
    if ('names' in s) { if (!isObj(s.names)) { return false; } for (k in s.names) { if (typeof s.names[k] !== 'string' || s.names[k].length > 200) { return false; } } }
    return true;
  }
  function validPhoto(p) {
    var k;
    if (!isObj(p)) { return false; }
    for (k in p) { if (PHOTO_KEYS.indexOf(k) < 0) { return false; } }
    return typeof p.id === 'string' && /^[a-z0-9]{6,40}$/.test(p.id) && typeof p.profile === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(p.profile) &&
      typeof p.data === 'string' && p.data.length <= MAX_PHOTO && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+\/]+=*$/.test(p.data) &&
      typeof p.hash === 'string' && p.hash === sha256(p.data) &&
      ['mime', 'addedAt', 'taken', 'fileDate', 'label'].every(function (f) { return p[f] === undefined || (typeof p[f] === 'string' && p[f].length <= 300); }) &&
      ['w', 'h'].every(function (f) { return p[f] === undefined || (typeof p[f] === 'number' && p[f] >= 0 && p[f] <= 20000); });
  }
  /* returns { ok, msg, checksum } ; never throws */
  function validate(obj) {
    var keys, total = 0, i, k, v, p, bad = false, photos, seen = {};
    try {
      if (!isObj(obj) || obj.app !== 'Stark Tenancy') { return { ok: false, msg: 'This is not a Stark Tenancy backup. Nothing was changed.' }; }
      for (k in obj) { if (['app', 'version', 'exported', 'data', 'photos', 'sha256'].indexOf(k) < 0) { return { ok: false, msg: 'This backup has unexpected content. Nothing was changed.' }; } }
      if (typeof obj.version !== 'string' || obj.version.length > 30 || typeof obj.exported !== 'string' || obj.exported.length > 40 || !isObj(obj.data)) { return { ok: false, msg: 'This backup is damaged or incomplete. Nothing was changed.' }; }
      keys = Object.keys(obj.data);
      if (keys.length > MAX_KEYS) { return { ok: false, msg: 'This backup is too large to be genuine. Nothing was changed.' }; }
      for (i = 0; i < keys.length && !bad; i++) {
        k = keys[i]; v = obj.data[k];
        if (!/^stn:(settings|p:[A-Za-z0-9_-]{1,60}:[A-Za-z0-9_-]{1,40})$/.test(k) || typeof v !== 'string' || v.length > MAX_VALUE) { bad = true; break; }
        total += k.length + v.length;
        if (total > MAX_TOTAL) { bad = true; break; }
        try { p = JSON.parse(v); } catch (e) { bad = true; break; }
        if (hasBadKey(p, 0)) { bad = true; break; }
        if (k === 'stn:settings' && !validateSettings(p)) { bad = true; }
      }
      photos = obj.photos === undefined ? [] : obj.photos;
      if (!bad && (!Array.isArray(photos) || photos.length > MAX_PHOTOS)) { bad = true; }
      for (i = 0, total = 0; !bad && i < photos.length; i++) {
        if (!validPhoto(photos[i]) || seen[photos[i].id]) { bad = true; break; }
        seen[photos[i].id] = 1; total += photos[i].data.length;
        if (total > MAX_PHOTO_TOTAL) { bad = true; }
      }
      if (bad) { return { ok: false, msg: 'This backup failed the safety check (an entry or photo is malformed). Nothing was changed.' }; }
      if (typeof obj.sha256 !== 'string' || obj.sha256 !== sha256(canonical(obj.app, obj.version, obj.exported, obj.data, photos))) { return { ok: false, msg: 'This backup file was changed or damaged (checksum does not match). Nothing was changed.' }; }
      return { ok: true, checksum: true, photos: photos.length, msg: 'Checksum verified.' };
    } catch (e2) { return { ok: false, msg: 'This backup could not be checked. Nothing was changed.' }; }
  }

  /* ---------- crash-safe storage helpers (st = object with getItem/setItem/removeItem) ---------- */
  function parses(s) { try { JSON.parse(s); return true; } catch (e) { return false; } }
  /* write, read back, keep the previous good value as key.bak; returns true when the stored value matches */
  function safeWrite(st, k, v) {
    var prev = st.getItem(k);
    if (prev != null && prev !== v && parses(prev)) { st.setItem(k + '.bak', prev); }
    st.setItem(k, v);
    if (st.getItem(k) !== v) {
      if (prev != null) { try { st.setItem(k, prev); } catch (e) { /* nothing more to do */ } }
      return false;
    }
    return true;
  }
  /* returns { v, state: ok | recovered | corrupt | none } ; recovers from key.bak when the main copy is corrupt */
  function safeRead(st, k) {
    var v = st.getItem(k), b;
    if (v == null) { return { v: null, state: 'none' }; }
    if (parses(v)) { return { v: v, state: 'ok' }; }
    b = st.getItem(k + '.bak');
    if (b != null && parses(b)) { st.setItem(k, b); return { v: b, state: 'recovered' }; }
    return { v: v, state: 'corrupt' };
  }

  var PROFILE_RX = /^[A-Za-z0-9_-]{1,60}$/;
  /* Settings (d = defaults) from storage or a restored backup: known keys only, each type-checked, built on a fresh object (no own __proto__). */
  function cleanSettings(raw, d) {
    var s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}, names = {};
    if (['auto', 'light', 'dark'].indexOf(s.theme) >= 0) { d.theme = s.theme; }
    if (typeof s.large === 'boolean') { d.large = s.large; }
    if (s.lang === 'en' || s.lang === 'es') { d.lang = s.lang; }
    /* region format, currency and paper: checked with Intl; anything else falls back to Automatic, USD and the print dialog's paper */
    if (TN.fmt) {
      if (typeof s.region === 'string') { d.region = TN.fmt.validLocale(s.region); }
      if (typeof s.currency === 'string') { d.currency = TN.fmt.validCurrency(s.currency) || d.currency || 'USD'; }
      if (s.paper === 'a4' || s.paper === 'letter' || s.paper === 'auto') { d.paper = s.paper; }
    }
    if (Array.isArray(s.profiles)) {
      d.profiles = s.profiles.filter(function (p, i, a) { return typeof p === 'string' && PROFILE_RX.test(p) && ['__proto__', 'constructor', 'prototype'].indexOf(p) < 0 && a.indexOf(p) === i; }).slice(0, 50);
      if (!d.profiles.length) { d.profiles = ['main']; }
    }
    d.profiles.forEach(function (p) { var n = s.names && Object.prototype.hasOwnProperty.call(s.names, p) ? s.names[p] : null; names[p] = typeof n === 'string' && n.trim() ? n.slice(0, 80) : (p === 'main' ? 'My tenancy' : p); });
    d.names = names;
    d.profile = typeof s.profile === 'string' && d.profiles.indexOf(s.profile) >= 0 ? s.profile : d.profiles[0];
    return d;
  }
  /* 'image/jpeg' etc. from a validated data URL; the file's own mime field is never trusted */
  function mimeOf(data) { var m = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(String(data || '')); return m ? m[1] : 'image/jpeg'; }
  TN.backup = { sha256: sha256, canonical: canonical, seal: seal, validate: validate, safeWrite: safeWrite, safeRead: safeRead, mimeOf: mimeOf, cleanSettings: cleanSettings };
  if (typeof module !== 'undefined' && module.exports) { module.exports = TN.backup; }
})(typeof window !== 'undefined' ? window : globalThis);
