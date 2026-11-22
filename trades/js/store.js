/* Stark Trades. Encrypted storage in this browser's IndexedDB. Nothing leaves the computer.
   meta/vault   : salt, iteration count and a small encrypted check value (so a wrong passphrase is detected)
   meta/hw      : the highest save counter seen for this vault (also mirrored in localStorage) for the rollback check
   meta/passkey : optional; the workspace key sealed under a passkey's PRF output (see C.wrapForPasskey)
   meta/autofile: optional; the handle of the file chosen for automatic encrypted backups
   state/main   : the whole business, one AES-GCM record; the save counter is bound into its additional data
   photos/<id>  : one AES-GCM record per job photo
   The passphrase itself is never stored; only the derived key is held in memory while unlocked. */
(function () {
  'use strict';
  const C = window.StarkCore, S = {}, DB = 'stark-trades';
  let db = null, key = null, vault = null, timer = null, pending = null, chain = Promise.resolve(), mem = null, seq = 0;
  const emit = k => { if (S.onState) S.onState(k); };

  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { ['meta', 'state', 'photos'].forEach(n => r.result.createObjectStore(n)); };
      r.onsuccess = () => { db = r.result; db.onversionchange = () => { db.close(); db = null; }; res(db); }; r.onerror = () => rej(r.error || new Error('IndexedDB is not available'));
    });
  }
  function tx(store, mode, fn) {
    return open().then(d => new Promise((res, rej) => { const t = d.transaction(store, mode); const req = fn(t.objectStore(store)); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
  }
  const get = (s, k) => tx(s, 'readonly', o => o.get(k));
  const put = (s, k, v) => tx(s, 'readwrite', o => o.put(v, k));
  const del = (s, k) => tx(s, 'readwrite', o => o.delete(k));
  const CHECK = 'stark-trades-ok', AD_STATE = 'StarkTrades|state|1', AD_SEQ = n => 'StarkTrades|state|2|' + n, AD_PHOTO = id => 'StarkTrades|photo|' + id;
  const recAD = rec => typeof rec.seq === 'number' ? AD_SEQ(rec.seq) : AD_STATE;

  /* rollback check: each save carries a counter bound into its encryption, so the counter cannot be edited without breaking the record.
     The highest counter is kept in IndexedDB and in localStorage; a main record below that mark was put back from an older copy. */
  const HW = 'stark-trades-hw';
  const lsMark = () => { try { const p = String(localStorage.getItem(HW) || '').split(':'); return p.length === 2 ? { salt: p[0], n: parseInt(p[1], 10) || 0 } : null; } catch (e) { return null; } };
  async function markOf(v) { let n = 0; const m = await get('meta', 'hw'), l = lsMark(); [m, l].forEach(x => { if (x && x.salt === v.salt && x.n > n) n = x.n; }); return n; }
  async function setMark(n) { const m = { salt: vault.salt, n }; try { localStorage.setItem(HW, m.salt + ':' + n); } catch (e) { /* storage blocked: IndexedDB copy only */ } await put('meta', 'hw', m); }

  S.hasVault = async () => !!(await get('meta', 'vault'));
  S.unlocked = () => !!key;
  /* sample mode: nothing is written to disk; photos live in memory until the tab closes or locks */
  S.tryOut = function () { S.lock(); mem = new Map(); };
  S.trying = () => !key && !!mem;
  async function setKey(pass) {
    const salt = C.newSalt(); key = await C.deriveKey(pass, salt, C.KDF_ITER);
    vault = { salt, iter: C.KDF_ITER, check: await C.encJSON(key, { ok: CHECK }, 'StarkTrades|check') }; await put('meta', 'vault', vault);
    await tx('state', 'readwrite', o => o.clear()); lastBak = 0; // the old records belong to the old key
    /* key rotation: a passkey copy of the old key must not outlive it */
    if (await get('meta', 'passkey')) { await del('meta', 'passkey'); S.passkeyDropped = true; }
  }
  S.create = async function (pass, st) { seq = 0; await setKey(pass); await S.saveNow(st); return st; };
  async function verifyKey(k, v) { try { const c = await C.decJSON(k, v.check, 'StarkTrades|check'); if (c.ok !== CHECK) throw 0; return true; } catch (e) { return false; } }
  async function vaultMeta() { const v = await get('meta', 'vault'); if (!v) throw new Error('No data yet'); if (!C.iterOk(v.iter) || typeof v.salt !== 'string') throw new Error('The saved data does not look right.'); return v; }
  S.unlock = async function (pass) {
    const v = await vaultMeta(), k = await C.deriveKey(pass, v.salt, v.iter);
    if (!(await verifyKey(k, v))) throw new Error('Wrong passphrase. Check Caps Lock and try again.');
    return openWith(k, v);
  };
  async function openWith(k, v) {
    key = k; vault = v; S.recovered = false; S.rolledBack = false;
    const main = await get('state', 'main'), bak = await get('state', 'bak'), mark = await markOf(v); let why = '';
    const read = async rec => { const st = await C.decJSON(key, rec, recAD(rec)); const w = C.checkState(st, false); if (w) throw new Error(w); return st; };
    if (!main && !bak) throw new Error('The saved data is missing. Restore a backup.');
    if (main) { try { const st = await read(main); if ((main.seq || 0) < mark) S.rolledBack = true; seq = Math.max(main.seq || 0, mark); return st; } catch (e) { why = (e && e.message) || 'unreadable'; } }
    if (bak) { try { const st = await read(bak); await put('state', 'main', bak); S.recovered = true; seq = Math.max(bak.seq || 0, mark); return st; } catch (e) { why = why || (e && e.message) || 'unreadable'; } }
    /* safe mode: nothing is overwritten; hand back the raw records so they can be exported */
    const raw = { format: 'StarkTrades-raw', note: 'Encrypted records exactly as stored. Not a backup file.', reason: why, vault: { salt: v.salt, iter: v.iter, iv: C.b64(v.check.iv), ct: C.b64(v.check.ct) } };
    const enc = r => r ? { iv: C.b64(r.iv), ct: C.b64(r.ct), seq: r.seq } : null; raw.state = enc(main); raw.bak = enc(bak);
    S.lock(); const err = new Error('corrupt'); err.code = 'corrupt'; err.raw = raw; throw err;
  }
  S.lock = function () { clearTimeout(timer); pending = null; key = null; vault = null; mem = null; };
  /* write, read back and verify; keep the previous good record as state/bak (refreshed at most once a minute); put the old record back if the check fails.
     The read-back compares the stored ciphertext byte for byte with what was written (AES-GCM: same bytes, same plaintext), so no second decrypt is needed. */
  let lastBak = 0; const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  S.saveNow = function (st) {
    const run = async () => {
      if (!key) return;
      const n = seq + 1, bytes = new TextEncoder().encode(JSON.stringify(st)), rec = await C.encBytes(key, bytes, AD_SEQ(n)), prev = await get('state', 'main'); rec.seq = n;
      if (prev && Date.now() - lastBak > 60000) { await put('state', 'bak', prev); lastBak = Date.now(); }
      await put('state', 'main', rec);
      let ok = false; try { const back = await get('state', 'main'); ok = !!back && back.seq === n && same(back.iv, rec.iv) && same(back.ct, rec.ct); } catch (e) { ok = false; }
      if (!ok) { if (prev) await put('state', 'main', prev); emit('error'); throw new Error('The save could not be verified. Your last good copy was kept.'); }
      seq = n; await setMark(n); emit('saved'); if (S.onSaved) S.onSaved();
    };
    const p = chain.catch(() => {}).then(run); chain = p; return p;
  };
  S.onSaveError = null; S.onSaved = null;
  S.save = function (st) { if (key) emit('saving'); pending = st; clearTimeout(timer); timer = setTimeout(() => { const s = pending; pending = null; if (s) S.saveNow(s).catch(e => { if (S.onSaveError) S.onSaveError(e); }); }, 200); };
  S.flush = function () { clearTimeout(timer); const s = pending; pending = null; return (s ? S.saveNow(s) : chain).catch(e => { if (S.onSaveError) S.onSaveError(e); }); };
  S.putPhoto = async function (id, bytes) { if (!key && mem) { mem.set(id, bytes.slice()); return; } await put('photos', id, await C.encBytes(key, bytes, AD_PHOTO(id))); };
  S.getPhoto = async function (id) { if (!key && mem) { if (!mem.has(id)) throw new Error('Photo data is missing'); return mem.get(id).slice(); } const r = await get('photos', id); if (!r) throw new Error('Photo data is missing'); return C.decBytes(key, r, AD_PHOTO(id)); };
  S.delPhoto = id => !key && mem ? Promise.resolve(mem.delete(id)) : tx('photos', 'readwrite', o => o.delete(id));
  S.allPhotos = async function (ids) { const out = []; for (const id of ids) { try { out.push({ id, bytes: await S.getPhoto(id) }); } catch (e) { /* skip a missing photo */ } } return out; };
  /* new passphrase: re-encrypt the check value, the state and every photo under a new salt */
  S.rekey = async function (pass, st, photoIds) { await S.flush(); const photos = await S.allPhotos(photoIds); await setKey(pass); for (const p of photos) await S.putPhoto(p.id, p.bytes); await S.saveNow(st); };
  /* restore: replace everything; the current passphrase stays */
  S.replaceAll = async function (pass, st, photos) { await S.flush(); await tx('photos', 'readwrite', o => o.clear()); await setKey(pass); for (const p of photos) await S.putPhoto(p.id, p.bytes); await S.saveNow(st); };
  S.eraseAll = async function () { S.lock(); try { localStorage.removeItem(HW); } catch (e) { /* ignore */ } if (db) { db.close(); db = null; } await new Promise(res => { const r = indexedDB.deleteDatabase(DB); r.onsuccess = r.onerror = r.onblocked = () => res(); }); };

  /* ---------- passkey unlock (WebAuthn PRF). prfFn(prfSalt, credId) returns { cred, prf } from the authenticator (js/views_secure.js). ---------- */
  S.passkeyInfo = async function () { const r = await get('meta', 'passkey'), v = await get('meta', 'vault'); return r && v && r.vsalt === v.salt ? { cred: r.cred, prfSalt: r.prfSalt } : null; };
  S.enablePasskey = async function (pass, prfFn) {
    if (!key || !vault) throw new Error('Unlock first.');
    const ex = await C.deriveKey(pass, vault.salt, vault.iter, true);
    if (!(await verifyKey(ex, vault))) throw new Error('Wrong passphrase. Check Caps Lock and try again.');
    const raw = new Uint8Array(await (globalThis.crypto || require('node:crypto').webcrypto).subtle.exportKey('raw', ex)), prfSalt = C.newSalt();
    try { const r = await prfFn(prfSalt, null); const rec = await C.wrapForPasskey(raw, r.prf, r.cred, vault.salt); rec.prfSalt = prfSalt; await put('meta', 'passkey', rec); S.passkeyDropped = false; return rec.cred; }
    finally { raw.fill(0); }
  };
  S.unlockPasskey = async function (prfFn) {
    const v = await vaultMeta(), rec = await get('meta', 'passkey'); if (!rec || rec.vsalt !== v.salt) throw new Error('Passkey unlock is not set up for this workspace.');
    const r = await prfFn(rec.prfSalt, rec.cred); let k;
    try { k = await C.unwrapPasskey(rec, r.prf, v.salt); } catch (e) { throw new Error('That passkey did not unlock this workspace. Use your passphrase.'); }
    if (!(await verifyKey(k, v))) throw new Error('That passkey did not unlock this workspace. Use your passphrase.');
    return openWith(k, v);
  };
  S.disablePasskey = () => del('meta', 'passkey');

  /* ---------- automatic encrypted backup file: sealed with the workspace key and salt, so it opens on Restore with the usual passphrase ---------- */
  S.sealBackup = function (st, photos) { if (!key || !vault) return Promise.reject(new Error('Unlock first.')); return C.sealWithKey('backup', key, vault.salt, vault.iter, { state: st, photos: photos.map(p => ({ id: p.id, b64: C.b64(p.bytes) })) }); };
  S.getAutoFile = () => get('meta', 'autofile');
  S.setAutoFile = h => h ? put('meta', 'autofile', h) : del('meta', 'autofile');
  window.StarkStore = S;
})();
