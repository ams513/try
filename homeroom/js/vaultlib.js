/* Stark Homeroom: the encrypted vault. A backup sealed with a passphrase: AES-256-GCM through the browser's own
   WebCrypto, the key made from the passphrase with PBKDF2-SHA-256 (600,000 rounds, a fresh random salt and nonce
   every time). Version 2 binds the whole header (rounds, salt, nonce and the sealed-on stamp) into the seal as
   additional data, so changing any header field, including the date shown before opening, makes it fail to open.
   Rounds read from a file are capped (300,000 to 2,000,000), so a crafted file can neither freeze the tab nor
   downgrade the key; version 1 vaults still open.
   Nothing is sent anywhere and no passphrase is stored: lose the passphrase and the vault cannot be opened by
   anyone. Pure functions; tests/test_homeroom.py runs them in node. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const NODE = typeof module !== 'undefined' && module.exports;
  const APP = 'stark-homeroom-vault', ITER = 600000, ITER_MIN = 300000, ITER_MAX = 2000000, MAX_BYTES = 64 * 1024 * 1024;
  const subtle = () => { const c = root.crypto && root.crypto.subtle ? root.crypto : (NODE ? require('node:crypto').webcrypto : null); if (!c || !c.subtle) throw new Error('This browser cannot do encryption here. Use the plain backup instead.'); return c; };
  const enc = s => new TextEncoder().encode(s);
  function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(t) { if (typeof t !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw new Error('bad'); const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  const aad1 = iter => enc(APP + '|1|AES-256-GCM|PBKDF2-SHA-256|' + iter);
  const aad2 = f => enc([APP, 2, 'AES-256-GCM', 'PBKDF2-SHA-256', f.iterations, f.salt, f.iv, f.saved].join('|'));
  async function derive(c, pass, salt, iter) {
    const base = await c.subtle.importKey('raw', enc(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return c.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(text, pass, o) {
    o = o || {}; const c = subtle(), iter = o.iterations || ITER;
    if (typeof pass !== 'string' || pass.length < 8) throw new Error('Use a passphrase of at least 8 characters.');
    if (!(iter >= ITER_MIN && iter <= ITER_MAX)) throw new Error('Unsupported setting.');
    const salt = c.getRandomValues(new Uint8Array(16)), iv = c.getRandomValues(new Uint8Array(12));
    const key = await derive(c, pass, salt, iter);
    const head = { app: APP, version: 2, cipher: 'AES-256-GCM', kdf: 'PBKDF2-SHA-256', iterations: iter, salt: b64(salt), iv: b64(iv), saved: String(o.saved || '').replace(/\|/g, '').slice(0, 30) };
    const ct = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad2(head) }, key, enc(String(text))));
    return Object.assign(head, { data: b64(ct) });
  }
  function looksLike(o) { return !!o && typeof o === 'object' && !Array.isArray(o) && o.app === APP; }
  async function open(file, pass) {
    try {
      if (!looksLike(file) || (file.version !== 1 && file.version !== 2) || file.cipher !== 'AES-256-GCM' || file.kdf !== 'PBKDF2-SHA-256') return { ok: false, error: 'This is not a Stark Homeroom vault file.' };
      if (Object.keys(file).some(k => ['app', 'version', 'cipher', 'kdf', 'iterations', 'salt', 'iv', 'saved', 'data'].indexOf(k) < 0)) return { ok: false, error: 'This vault has unexpected content, so it was not opened.' };
      if (file.version === 1 && file.saved === undefined) file = Object.assign({}, file, { saved: '' });   /* the date was optional in version 1 */
      if (typeof file.saved !== 'string' || file.saved.length > 30) return { ok: false, error: 'This vault file is damaged.' };
      const iter = file.iterations; if (!Number.isInteger(iter) || iter < ITER_MIN || iter > ITER_MAX) return { ok: false, error: 'This vault uses settings Homeroom does not accept.' };
      if (typeof file.data !== 'string' || file.data.length > MAX_BYTES * 1.4) return { ok: false, error: 'This vault file is too large.' };
      const salt = unb64(file.salt), iv = unb64(file.iv), ct = unb64(file.data);
      if (salt.length !== 16 || iv.length !== 12 || ct.length < 17) return { ok: false, error: 'This vault file is damaged.' };
      if (typeof pass !== 'string' || !pass) return { ok: false, error: 'Type the passphrase.' };
      const c = subtle(), key = await derive(c, pass, salt, iter);
      let pt; try { pt = await c.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: file.version === 2 ? aad2(file) : aad1(iter) }, key, ct); } catch (e) { return { ok: false, error: 'Wrong passphrase, or the file was changed. Nothing was restored.' }; }
      return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(pt), saved: file.saved || '', version: file.version, headerBound: file.version === 2 };
    } catch (e) { return { ok: false, error: e && /encryption/.test(e.message) ? e.message : 'This vault file is damaged.' }; }
  }
  /* a rough guess at guessing effort in bits, so the screen can say weak, fair, strong; not a promise */
  const COMMON = ['password', 'passw0rd', 'letmein', 'qwerty', 'welcome', 'homeschool', 'homeroom', 'iloveyou', 'admin', 'login', 'abc123', '123456', 'monkey', 'dragon', 'master', 'family'];
  function passphraseStrength(p) {
    p = String(p || ''); const len = Array.from(p).length;
    if (!len) return { bits: 0, label: 'empty', ok: false, tips: ['Type a passphrase.'] };
    let pool = 0; if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10; if (/[^A-Za-z0-9\s]/.test(p)) pool += 32; if (/\s/.test(p)) pool += 1; if (/[^\x00-\x7f]/.test(p)) pool += 64;
    let bits = len * Math.log2(Math.max(pool, 2));
    const low = p.toLowerCase(), uniq = new Set(low).size;
    bits *= Math.min(1, 0.35 + uniq / Math.max(len, 1) * 0.9);   // repeated characters count for less
    if (/(.)\1{2,}/.test(low)) bits -= 8;
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/.test(low)) bits -= 10;
    COMMON.forEach(w => { if (low.indexOf(w) >= 0) bits -= 14; });
    const words = p.trim().split(/[\s\-_.]+/).filter(w => w.length >= 3);
    if (words.length >= 4 && len >= 16) bits = Math.max(bits, words.length * 11);   // several unrelated words are strong even in lower case
    bits = Math.max(0, Math.round(bits));
    const label = bits < 40 ? 'weak' : bits < 60 ? 'fair' : bits < 80 ? 'strong' : 'excellent';
    const tips = []; if (len < 12) tips.push('Longer is stronger: aim for 12 characters or more.'); if (words.length < 4 && len < 20) tips.push('Four or five unrelated words in a row is easy to remember and hard to guess.');
    return { bits, label, ok: bits >= 45 && len >= 8, tips };
  }
  const api = { seal, open, looksLike, passphraseStrength, ITER, ITER_MIN, ITER_MAX, APP };
  if (NODE) module.exports = api; else SHR.vault = api;
})(typeof window !== 'undefined' ? window : globalThis);
