/* Stark IntraTheater by Stark. Backup safety: pure functions with no DOM, shared by the app and the node tests.
   A SHA-256 checksum over a canonical payload plus strict validation (types, key shapes, size caps, no prototype pollution). */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SIT = G.SIT = G.SIT || {};
  const APP = 'stark-intratheater';
  const MAX_TEXT = 40 * 1024 * 1024, MAX_KEYS = 400, MAX_DEPTH = 12, MAX_NODES = 400000;
  const BAD = { '__proto__': 1, constructor: 1, prototype: 1 };
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);

  /* stable JSON: keys sorted, so the same data always gives the same text */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (isObj(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    const s = JSON.stringify(v);
    return s === undefined ? 'null' : s;
  }
  async function sha256Hex(text) {
    const buf = await G.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => (b < 16 ? '0' : '') + b.toString(16)).join('');
  }
  /* walks a parsed value: only JSON types, bounded depth and size, no polluting keys */
  function cleanJson(v) {
    let nodes = 0;
    (function walk(x, d) {
      if (++nodes > MAX_NODES || d > MAX_DEPTH) throw new Error('size');
      if (x === null || typeof x === 'string' || typeof x === 'boolean') return;
      if (typeof x === 'number') { if (!isFinite(x)) throw new Error('num'); return; }
      if (Array.isArray(x)) { x.forEach(y => walk(y, d + 1)); return; }
      if (isObj(x)) { Object.keys(x).forEach(k => { if (BAD[k]) throw new Error('key'); walk(x[k], d + 1); }); return; }
      throw new Error('type');
    })(v, 0);
  }
  function validFamily(f) {
    if (f === null) return true;
    if (!isObj(f) || !Array.isArray(f.kids) || !f.kids.length || f.kids.length > 60) return false;
    if (!f.kids.every(k => isObj(k) && typeof k.id === 'string' && k.id.length <= 40 && typeof k.name === 'string' && k.name.length <= 80)) return false;
    if (f.activeKid !== undefined && typeof f.activeKid !== 'string') return false;
    if (f.pin !== null && f.pin !== undefined && !(isObj(f.pin) && typeof f.pin.salt === 'string' && f.pin.hash !== undefined)) return false;
    return f.settings === undefined || isObj(f.settings);
  }
  /* the data map of a backup: key names are plain, values are clean JSON, family has the right shape */
  function validData(data) {
    if (!isObj(data)) return false;
    const keys = Object.keys(data);
    if (keys.length > MAX_KEYS) return false;
    try {
      for (const k of keys) {
        if (!/^[A-Za-z0-9._-]{1,80}$/.test(k) || BAD[k] || /\.bak$/.test(k)) return false;
        cleanJson(data[k]);
      }
    } catch (e) { return false; }
    return !('family' in data) || validFamily(data.family);
  }
  function validPlan(o) {
    if (!isObj(o) || !Array.isArray(o.nights) || o.nights.length > 2000) return false;
    try { cleanJson(o); } catch (e) { return false; }
    return o.nights.every(n => isObj(n));
  }
  /* adds the checksum to a backup object (called with {app, version, saved, data}) */
  async function seal(o) { const c = Object.assign({}, o); delete c.sha256; c.sha256 = await sha256Hex(canon(c)); return c; }
  /* text of a backup file in, {ok, message, backup, checksum} out. Nothing is written here. */
  async function check(txt) {
    const no = message => ({ ok: false, message, backup: null, checksum: false });
    let o;
    if (typeof txt !== 'string' || txt.length > MAX_TEXT) return no('That file is too big to be a backup.');
    try { o = JSON.parse(txt); } catch (e) { return no('That file is not a Stark IntraTheater backup.'); }
    if (!isObj(o) || o.app !== APP || !validData(o.data)) return no('That file is not a valid Stark IntraTheater backup. Nothing was changed.');
    if (o.sha256 === undefined) return { ok: true, message: 'No checksum, validated.', backup: o, checksum: false };
    const c = Object.assign({}, o); delete c.sha256;
    let h = '';
    try { h = await sha256Hex(canon(c)); } catch (e) { return no('This browser cannot check the backup. Nothing was changed.'); }
    if (typeof o.sha256 !== 'string' || o.sha256.toLowerCase() !== h) return no('This backup file has been changed or damaged (checksum does not match). Nothing was changed.');
    return { ok: true, message: 'Checksum verified.', backup: o, checksum: true };
  }
  SIT.safe = { canon, sha256Hex, cleanJson, validData, validFamily, validPlan, seal, check };
})();
