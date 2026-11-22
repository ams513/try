/* Stark Warden: passphrase vault. AES-GCM 256 with a PBKDF2 (SHA-256) key from your passphrase, via the browser's WebCrypto.
   Format 2 binds the header (format, iterations, salt, save counter) to the ciphertext as additional authenticated data, so a
   changed header or a swapped counter fails to open. The open vault keeps only a derived, non-extractable key, never the passphrase.
   Nothing is sent anywhere. There is no recovery: if you forget the passphrase the contents cannot be opened. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var ITER = 600000, MIN_ITER = 100000, MAX_ITER = 2000000, LEGACY_ITER = 310000, FMT = 2;
  var MAX_CONTACTS = 2000, MAX_NOTES = 1000000, MAX_B64 = 40000000;
  var FIELDS = { name: 500, phone: 100, info: 10000 };
  var BAD_MSG = 'Wrong passphrase, or the data was changed.';

  function b64(buf) { var a = new Uint8Array(buf), s = '', i; for (i = 0; i < a.length; i += 8192) { s += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); } return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length), i; for (i = 0; i < b.length; i++) { a[i] = b.charCodeAt(i); } return a; }
  function subtle() { var c = root.crypto; return c && c.subtle ? c : null; }
  function enc(s) { return new TextEncoder().encode(s); }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function isB64(s, max) { return typeof s === 'string' && s.length > 0 && s.length <= max && /^[A-Za-z0-9+\/]+={0,2}$/.test(s); }
  function iterOk(i) { return typeof i === 'number' && Math.floor(i) === i && i >= MIN_ITER && i <= MAX_ITER; }
  function aad(kind, iter, salt, n) { return enc('StarkWarden' + kind + '|' + FMT + '|' + iter + '|' + salt + '|' + n); }

  function deriveKey(pass, salt, iter) {
    var c = subtle();
    return c.subtle.importKey('raw', enc(String(pass)), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return c.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  function available() { return !!subtle(); }

  function strength(pass) {
    var s = String(pass || ''), score = 0;
    if (s.length >= 12) { score++; } if (s.length >= 16) { score++; }
    if (/[a-z]/.test(s) && /[A-Z]/.test(s)) { score++; }
    if (/\d/.test(s)) { score++; } if (/[^A-Za-z0-9]/.test(s)) { score++; }
    if (/^(?:password|123456|qwerty|letmein)/i.test(s)) { score = 0; }
    return { ok: s.length >= 10 && score >= 3, score: score, tip: 'Use a long passphrase of 4 or more unrelated words. Write it down and keep it somewhere safe: it cannot be recovered.' };
  }

  /* Header check before any key work, so a crafted file cannot force a huge or a weak key derivation.
     Format 2: { v: 2, iter, salt, iv, ct, n }. Format 1 (Warden 1.x, no header binding) still opens, then is upgraded on save. */
  function checkBox(box) {
    if (!isObj(box) || !isB64(box.salt, 64) || !isB64(box.iv, 32) || !isB64(box.ct, MAX_B64)) { return false; }
    if (box.v === FMT) { return iterOk(box.iter) && typeof box.n === 'number' && Math.floor(box.n) === box.n && box.n >= 0 && box.n <= 1e12; }
    if (box.v === 1 || box.v === undefined) { return box.iter === undefined || iterOk(box.iter); }
    return false;
  }

  /* -> { obj, legacy, iter, n } ; kind is 'Vault' or 'Backup' (an encrypted backup cannot be opened as a vault, or the reverse) */
  function openBox(box, pass, kind) {
    var c = subtle(), legacy, iter;
    if (!c) { return Promise.reject(new Error('This browser does not offer WebCrypto here.')); }
    if (!checkBox(box)) { return Promise.reject(new Error(BAD_MSG)); }
    legacy = box.v !== FMT; iter = box.iter || LEGACY_ITER;
    if (legacy && kind !== 'Vault') { return Promise.reject(new Error(BAD_MSG)); }
    return deriveKey(pass, unb64(box.salt), iter).then(function (key) {
      var p = { name: 'AES-GCM', iv: unb64(box.iv) };
      if (!legacy) { p.additionalData = aad(kind, box.iter, box.salt, box.n); }
      return c.subtle.decrypt(p, key, unb64(box.ct)).then(function (pt) { return { key: key, pt: pt }; });
    }).then(function (r) {
      return { obj: JSON.parse(new TextDecoder().decode(r.pt)), key: r.key, legacy: legacy, iter: iter, n: legacy ? 0 : box.n };
    }, function () { throw new Error(BAD_MSG); });
  }

  function newSession(pass) {
    var c = subtle(), salt;
    if (!c) { return Promise.reject(new Error('This browser does not offer WebCrypto here.')); }
    salt = c.getRandomValues(new Uint8Array(16));
    return deriveKey(pass, salt, ITER).then(function (key) { return { key: key, salt: b64(salt), iter: ITER, n: 0 }; });
  }

  /* encrypt with a session (derived key, salt, counter); the counter goes up by one and is bound into the header */
  function sealWith(obj, s, kind) {
    var c = subtle(), iv = c.getRandomValues(new Uint8Array(12)), n = s.n + 1;
    return c.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: aad(kind, s.iter, s.salt, n) }, s.key, enc(JSON.stringify(obj))).then(function (ct) {
      s.n = n;
      return { v: FMT, iter: s.iter, salt: s.salt, iv: b64(iv), ct: b64(ct), n: n };
    });
  }

  /* Only the vault shape comes back: unknown keys are dropped, wrong types or oversize content are refused. */
  function cleanVault(d) {
    var contacts, notes;
    function fail() { throw new Error('The vault opened, but its contents are not in the expected shape. Nothing was changed.'); }
    if (!isObj(d) || (SW.backup && SW.backup.hasBadKey(d, 0))) { fail(); }
    contacts = d.contacts === undefined ? [] : d.contacts; notes = d.notes === undefined ? '' : d.notes;
    if (!Array.isArray(contacts) || contacts.length > MAX_CONTACTS || typeof notes !== 'string' || notes.length > MAX_NOTES) { fail(); }
    return { contacts: contacts.map(function (c) {
      var o = {};
      if (!isObj(c)) { fail(); }
      Object.keys(FIELDS).forEach(function (k) { var v = c[k] === undefined || c[k] === null ? '' : c[k]; if (typeof v !== 'string' || v.length > FIELDS[k]) { fail(); } o[k] = v; });
      return o;
    }), notes: notes };
  }

  /* Unlock for editing: -> { data, session, legacy, upgraded, n }. An old or weak header is re-keyed at the current cost
     (new salt, 600,000 iterations) while the passphrase is in hand, so the next save is format 2. */
  function unlock(box, pass) {
    return openBox(box, pass, 'Vault').then(function (r) {
      var data = cleanVault(r.obj);
      if (r.legacy || r.iter !== ITER) {
        return newSession(pass).then(function (s) { s.n = r.n; return { data: data, session: s, legacy: r.legacy, upgraded: true, n: r.n }; });
      }
      return { data: data, session: { key: r.key, salt: box.salt, iter: r.iter, n: r.n }, legacy: false, upgraded: false, n: r.n };
    });
  }
  function create(pass) { return newSession(pass); }
  function lock(data, session) { return Promise.resolve().then(function () { return sealWith(cleanVault(data), session, 'Vault'); }); }

  /* Generic helpers (any JSON value), kept for callers and tests. */
  function encrypt(obj, pass) { return newSession(pass).then(function (s) { return sealWith(obj, s, 'Vault'); }); }
  function decrypt(box, pass) { return openBox(box, pass, 'Vault').then(function (r) { return r.obj; }); }

  /* Encrypted backup file: the whole sealed backup inside one format-2 box with its own header label. */
  var ENV_KEYS = ['app', 'enc', 'v', 'iter', 'salt', 'iv', 'ct', 'n'];
  function isEncBackup(x) { return isObj(x) && x.app === 'Stark Warden' && x.enc === 'StarkWardenBackup'; }
  /* pass: a passphrase (a new salt and key each time) or a session from backupSession() (autosave: derive once, write often) */
  function backupSession(pass) { return newSession(pass); }
  function sealBackup(obj, pass) {
    return (typeof pass === 'string' ? newSession(pass) : Promise.resolve(pass)).then(function (s) { return sealWith(obj, s, 'Backup'); }).then(function (b) { return { app: 'Stark Warden', enc: 'StarkWardenBackup', v: b.v, iter: b.iter, salt: b.salt, iv: b.iv, ct: b.ct, n: b.n }; });
  }
  function openBackup(env, pass) {
    var k;
    if (!isEncBackup(env)) { return Promise.reject(new Error('This is not an encrypted Stark Warden backup. Nothing was changed.')); }
    for (k in env) { if (ENV_KEYS.indexOf(k) < 0) { return Promise.reject(new Error('This backup has unexpected content. Nothing was changed.')); } }
    if (env.v !== FMT) { return Promise.reject(new Error(BAD_MSG)); }
    return openBox({ v: env.v, iter: env.iter, salt: env.salt, iv: env.iv, ct: env.ct, n: env.n }, pass, 'Backup').then(function (r) { return r.obj; });
  }

  SW.vault = { encrypt: encrypt, decrypt: decrypt, strength: strength, available: available, unlock: unlock, create: create, lock: lock, cleanVault: cleanVault,
    checkBox: checkBox, backupSession: backupSession, sealBackup: sealBackup, openBackup: openBackup, isEncBackup: isEncBackup, ITER: ITER, MIN_ITER: MIN_ITER, MAX_ITER: MAX_ITER, FIELDS: FIELDS, MAX_CONTACTS: MAX_CONTACTS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.vault; }
})(typeof window !== 'undefined' ? window : globalThis);
