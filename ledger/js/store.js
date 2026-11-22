/* Stark Ledger. Encrypted storage in this browser's IndexedDB. Nothing leaves the computer.
   Each set of books (one per business) is its own database: stark-ledger, stark-ledger-b2, ...; only the book labels sit in localStorage.
   meta/vault   : salt, iteration count and a small encrypted check value (so a wrong passphrase is detected); v:2 = every record is AAD-bound
   state/main   : the whole books, one AES-GCM record bound to "state/main/<save number>" (g); main.bak is the last verified copy
   receipts/<id>: one encrypted record per receipt image, bound to its id
   Rollback check: the highest save number this browser has written is also kept in localStorage, so an older ciphertext put back
   into IndexedDB is noticed at unlock (both stores would have to be rolled back together to hide it). */
(function () {
  'use strict';
  const C = window.StarkCore; const S = {}; let db = null, key = null, vault = null, timer = null, pending = null, chain = Promise.resolve();
  let DB = 'stark-ledger', book = '', gen = 0, strict = false, lastGood = null, bakAt = 0;
  const LIST = 'stark-ledger-books', LAST = 'stark-ledger-book';
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } }
  };
  const GEN = () => 'stark-ledger-gen:' + DB;
  const hwm = () => { const n = +ls.get(GEN()); return Number.isSafeInteger(n) && n > 0 ? n : 0; };
  S.SAVE_MS = 400; S.BAK_MS = 60000; // debounce while typing; refresh the last-good copy at most once a minute
  S.saveState = 'saved'; S.saveError = null; S.onSaveState = null; S.onBlocked = null; S.onGone = null;
  const report = (s, e) => { S.saveState = s; S.saveError = e || null; if (S.onSaveState) { try { S.onSaveState(s, e); } catch (x) { /* UI hook only */ } } };

  S.books = () => [{ id: '', label: 'Main books' }].concat(C.parseBooks(ls.get(LIST) || '[]'));
  S.book = () => book;
  S.bookLabel = () => (S.books().find(b => b.id === book) || { label: 'Main books' }).label;
  S.useBook = function (id) { // only while locked
    if (key) throw new Error('Lock first');
    if (!S.books().some(b => b.id === id)) id = '';
    if (db) { db.close(); db = null; } book = id; DB = C.bookDb(id); ls.set(LAST, id); // storage blocked: stay on this book for the session
  };
  S.addBook = function (label) {
    label = String(label || '').trim().slice(0, 60); if (!label) throw new Error('Give the new books a name, such as the business name.');
    const list = S.books().slice(1); const id = C.newBookId(list); list.push({ id, label });
    if (!ls.set(LIST, JSON.stringify(list))) throw new Error('This browser blocks local storage, so only one set of books is possible here.');
    return id;
  };
  S.restoreLastBook = function () { const id = ls.get(LAST) || ''; if (id && S.books().some(b => b.id === id)) { book = id; DB = C.bookDb(id); } };

  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { ['meta', 'state', 'receipts'].forEach(n => r.result.createObjectStore(n)); };
      r.onblocked = () => rej(new Error('Another Stark Ledger tab is holding these books open. Close it and try again.'));
      r.onsuccess = () => { db = r.result; db.onversionchange = () => { db.close(); db = null; key = null; if (S.onGone) S.onGone(); }; res(db); };
      r.onerror = () => rej(r.error || new Error('IndexedDB is not available'));
    });
  }
  function tx(store, mode, fn) {
    return open().then(d => new Promise((res, rej) => { const t = d.transaction(store, mode); const req = fn(Array.isArray(store) ? t : t.objectStore(store)); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('The write was cancelled. The browser storage may be full.')); }));
  }
  const get = (s, k) => tx(s, 'readonly', o => o.get(k));
  const put = (s, k, v) => tx(s, 'readwrite', o => o.put(v, k));
  /* vault, books and receipts in ONE transaction: a crash or a full disk leaves either the old set or the new set, never a mix */
  const commitAll = (v, main, recs, clearReceipts) => tx(['meta', 'state', 'receipts'], 'readwrite', t => {
    const R = t.objectStore('receipts'); if (clearReceipts) R.clear(); for (const r of recs) R.put(r[1], r[0]);
    const s = t.objectStore('state'); s.put(main, 'main'); s.put(main, 'main.bak'); const me = t.objectStore('meta'); me.put(v, 'vault'); if (clearReceipts) me.delete('passkey'); return null; // a restore changes the passphrase, so a passkey seal is dropped
  });
  const mkVault = async (k, salt, iter) => ({ salt, iter, v: 2, check: await C.encryptJSON(k, { ok: 'stark-ledger', v: 2 }, C.checkAad(salt, iter)) });
  const sealState = async (k, st, g) => { const rec = await C.encryptJSON(k, st, C.stateAad(g)); rec.g = g; return rec; };

  S.hasVault = async () => !!(await get('meta', 'vault'));
  S.unlocked = () => !!key;
  S.create = async function (pass) {
    const salt = C.newSalt(), k = await C.deriveKey(pass, salt, C.KDF_ITER), v = await mkVault(k, salt, C.KDF_ITER);
    await put('meta', 'vault', v); key = k; vault = v; strict = true; gen = hwm(); lastGood = null; bakAt = 0;
    const st = C.newState(); await S.saveNow(st); return st;
  };
  S.recovered = false; S.rollback = null; S.upgraded = false;
  const readable = async (k, rec, strictMode) => {
    if (!rec) return null;
    try { const g = rec.a === 1 ? rec.g : 0; if (!Number.isSafeInteger(g) || g < 0) return null;
      const st = JSON.parse(new TextDecoder().decode(await C.openRec(k, rec, C.stateAad(g), strictMode)));
      return C.validateState(st) ? { bad: st } : { ok: st, g };
    } catch (e) { return null; }
  };
  /* pre-1.3 books (no AAD) or a weak key count: re-encrypt everything, bound, at KDF_ITER, in one transaction */
  async function upgrade(pass, st) {
    let k2 = key, salt = vault.salt, iter = vault.iter;
    if (iter < C.KDF_ITER) { salt = C.newSalt(); iter = C.KDF_ITER; k2 = await C.deriveKey(pass, salt, iter); }
    const ids = await tx('receipts', 'readonly', o => o.getAllKeys()), recs = [];
    for (const id of ids) { try { const bytes = await C.openRec(key, await get('receipts', id), C.receiptAad(id), strict); recs.push([id, await C.encryptBytes(k2, bytes, C.receiptAad(id))]); } catch (e) { /* unreadable already: left as it is */ } }
    const v2 = await mkVault(k2, salt, iter), g = gen + 1, main = await sealState(k2, st, g);
    await commitAll(v2, main, recs, false);
    key = k2; vault = v2; strict = true; gen = g; lastGood = main; bakAt = Date.now(); ls.set(GEN(), String(g)); S.upgraded = true;
  }
  S.unlock = async function (pass) {
    const v = await get('meta', 'vault'); if (!v) throw new Error('No vault yet');
    if (!Number.isSafeInteger(v.iter) || v.iter < C.KDF_LEGACY_MIN || v.iter > C.KDF_MAX) throw new Error('The stored key settings are out of range, so these books were not opened.');
    const k = await C.deriveKey(pass, v.salt, v.iter);
    let c; try { c = await C.decryptJSON(k, v.check, C.checkAad(v.salt, v.iter)); if (c.ok !== 'stark-ledger') throw 0; } catch (e) { throw new Error('Wrong passphrase.'); }
    const isStrict = c.v === 2 && v.check.a === 1; // a v2 vault never accepts an unbound record (no downgrade)
    S.recovered = false; S.rollback = null; S.upgraded = false;
    const main = await get('state', 'main'); let r = await readable(k, main, isStrict); // on failure the key stays unset, so nothing can be overwritten
    if (!(r && r.ok)) {
      const bak = await get('state', 'main.bak'), rb = await readable(k, bak, isStrict);
      if (!(rb && rb.ok)) { if (!main && !bak) r = { ok: C.newState(), g: 0 }; else { const err = new Error('Your saved books could not be read.'); err.safe = { main, bak, vault: v, plain: (r && r.bad) || (rb && rb.bad) || null }; throw err; } }
      else { r = rb; S.recovered = true; }
    }
    const h = hwm(); if (!S.recovered && r.g < h) S.rollback = { found: r.g, expected: h };
    key = k; vault = v; strict = isStrict; gen = Math.max(r.g, h); lastGood = S.recovered ? null : main; bakAt = 0;
    if (!strict || vault.iter < C.KDF_ITER) { try { await upgrade(pass, r.ok); } catch (e) { console.warn('Stark Ledger: upgrade postponed', e); } }
    return r.ok;
  };
  S.lock = function () { key = null; vault = null; lastGood = null; };
  S.saveNow = function (st) { // serialised so two saves never interleave; keeps a last good copy (main.bak); verifies what it wrote
    report('saving');
    chain = chain.then(async () => {
      if (!key) return;
      const now = Date.now();
      if (lastGood && now - bakAt >= S.BAK_MS) { await put('state', 'main.bak', lastGood); bakAt = now; }
      const g = gen + 1, rec = await sealState(key, st, g);
      for (let i = 0; i < 2; i++) {
        await put('state', 'main', rec); const back = await get('state', 'main');
        if (back && back.g === g && C.sameBytes(back.iv, rec.iv) && C.sameBytes(back.ct, rec.ct)) { gen = g; lastGood = rec; ls.set(GEN(), String(g)); return; } // a byte compare, no second decrypt
      }
      throw new Error('Saving could not be verified. Make a backup now.');
    });
    const p = chain.then(() => { if (!pending) report('saved'); }, e => { report('error', e); throw e; });
    chain = chain.catch(() => {}); return p;
  };
  S.save = function (st) { pending = st; clearTimeout(timer); report('pending'); timer = setTimeout(() => { const s = pending; pending = null; if (s) S.saveNow(s).catch(() => { /* reported through onSaveState */ }); }, S.SAVE_MS); };
  S.flush = function () { clearTimeout(timer); const s = pending; pending = null; return s ? S.saveNow(s) : chain; };
  S.putReceipt = async function (id, bytes) { const r = await C.encryptBytes(key, bytes, C.receiptAad(id)); await put('receipts', id, r); };
  S.getReceipt = async function (id) { const r = await get('receipts', id); if (!r) throw new Error('Receipt data is missing'); return C.openRec(key, r, C.receiptAad(id), strict); };
  S.delReceipt = id => tx('receipts', 'readwrite', o => o.delete(id));
  S.keyInfo = () => ({ key, salt: vault.salt, iter: vault.iter });
  /* passkey unlock: meta/passkey holds {credId, prfSalt, sealed} where sealed is the passphrase under a key only the passkey's PRF can make */
  S.checkPass = async function (pass) { const v = vault || await get('meta', 'vault'); if (!v) return false; try { const c = await C.decryptJSON(await C.deriveKey(pass, v.salt, v.iter), v.check, C.checkAad(v.salt, v.iter)); return c.ok === 'stark-ledger'; } catch (e) { return false; } };
  S.getPasskey = async () => { const r = await get('meta', 'passkey'); return C.passkeyRecordOk && C.passkeyRecordOk(r) ? r : null; };
  S.setPasskey = rec => { if (!key) throw new Error('Unlock first'); return put('meta', 'passkey', rec); };
  S.removePasskey = () => tx('meta', 'readwrite', o => o.delete('passkey'));
  /* replace everything with a restored backup; the backup's passphrase becomes the vault passphrase. One transaction: all or nothing. */
  S.replaceAll = async function (b) {
    await S.flush().catch(() => { /* the restore replaces it anyway */ });
    const recs = []; for (const r of b.receipts) recs.push([r.id, await C.encryptBytes(b.key, r.bytes, C.receiptAad(r.id))]);
    const v = await mkVault(b.key, b.salt, b.iter), g = Math.max(gen, hwm()) + 1, main = await sealState(b.key, b.state, g);
    await commitAll(v, main, recs, true);
    key = b.key; vault = v; strict = true; gen = g; lastGood = main; bakAt = Date.now(); ls.set(GEN(), String(g)); report('saved');
  };
  S.eraseAll = async function () {
    S.recovered = false; await S.flush().catch(() => { /* erasing anyway */ }); key = null; vault = null; lastGood = null; if (db) { db.onversionchange = null; db.close(); db = null; }
    await new Promise((res, rej) => { const r = indexedDB.deleteDatabase(DB); r.onsuccess = () => res(); r.onerror = () => rej(r.error || new Error('The browser could not erase the books.')); r.onblocked = () => { if (S.onBlocked) S.onBlocked(); }; });
    ls.del(GEN());
    if (book) { ls.set(LIST, JSON.stringify(S.books().slice(1).filter(b => b.id !== book))); S.useBook(''); }
  };
  window.StarkStore = S;
})();
