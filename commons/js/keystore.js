/* Stark Commons, by Stark. Signing-key store and live file sync. No network.
   Keys: the private key is a non-extractable CryptoKey kept in IndexedDB (structured clone), never as text in localStorage.
   A legacy plaintext key (sc.keys) is migrated on first use and then removed. Runs in the browser and in Node (tests inject a backend). */
(function (root) {
  'use strict';
  var SC = root.SC || (typeof require === 'function' ? require('./core.js') : null);

  /* ---------- IndexedDB backend: get/put/del by key, all promises ---------- */
  function idbBackend(dbName) {
    var idb = root.indexedDB, dbp = null;
    function db() {
      if (!idb) return Promise.reject(new Error('IndexedDB is not available'));
      if (!dbp) {
        dbp = new Promise(function (res, rej) {
          var rq; try { rq = idb.open(dbName || 'stark-commons', 1); } catch (e) { rej(e); return; }
          rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
          rq.onsuccess = function () { res(rq.result); };
          rq.onerror = function () { rej(rq.error || new Error('IndexedDB open failed')); };
        });
        dbp.catch(function () { dbp = null; });
      }
      return dbp;
    }
    function tx(mode, fn) {
      return db().then(function (d) {
        return new Promise(function (res, rej) {
          var t = d.transaction('kv', mode), st = t.objectStore('kv'), rq = fn(st);
          t.oncomplete = function () { res(rq && rq.result); };
          t.onerror = t.onabort = function () { rej(t.error || new Error('IndexedDB write failed')); };
        });
      });
    }
    return {
      get: function (k) { return tx('readonly', function (s) { return s.get(k); }); },
      put: function (k, v) { return tx('readwrite', function (s) { return s.put(v, k); }); },
      del: function (k) { return tx('readwrite', function (s) { return s.delete(k); }); }
    };
  }

  /* legacy: {read() -> pair|null, remove()} for the old plaintext localStorage key. */
  function createKeyStore(backend, legacy) {
    var cache = null, persistent = null;
    function isKeys(k) { return !!(k && k.privateKey && k.publicJwk && k.publicJwk.kty === 'EC'); }
    async function get() {
      if (cache) return cache;
      var k = null;
      try { k = await backend.get('signing'); persistent = true; } catch (e) { persistent = false; }
      if (!isKeys(k)) k = null;
      var old = legacy && legacy.read();
      if (!k && old && old.privateJwk) {
        try { k = await SC.importSigningKey(old); } catch (e) { k = null; }   // a damaged legacy key never blocks signing
        if (k) { try { await backend.put('signing', k); persistent = true; legacy.remove(); } catch (e) { persistent = false; } }
      } else if (k && old) { legacy.remove(); }
      cache = k;
      return k;
    }
    async function ensure() {
      var k = await get();
      if (k) return k;
      k = await SC.newKeyPair();
      try { await backend.put('signing', k); persistent = true; } catch (e) { persistent = false; }
      cache = k;
      return k;
    }
    /* Adopts a key pair carried by an older sealed backup, only when this browser has none yet. -> true when adopted */
    async function adopt(pair) {
      if (await get()) return false;
      var k = await SC.importSigningKey(pair);
      try { await backend.put('signing', k); persistent = true; } catch (e) { persistent = false; }
      cache = k;
      return true;
    }
    return { get: get, ensure: ensure, adopt: adopt, persistent: function () { return persistent; } };
  }

  /* ---------- live file sync (File System Access API), feature-detected ----------
     host: {pick() -> Promise<handle>, now() -> ms, setTimeout, clearTimeout}. handle: createWritable() -> {write(text), close()}.
     Writes are debounced and serialised: at most one write in flight, the newest text always wins. */
  function createFileSync(host, delay) {
    var handle = null, timer = null, pending = null, busy = false, last = { ok: null, at: 0, error: '', name: '' }, listeners = [];
    function emit() { listeners.forEach(function (f) { try { f(last); } catch (e) { /* listener */ } }); }
    async function flush() {
      if (!handle || pending == null || busy) return;
      busy = true;
      var text = pending; pending = null;
      try { var w = await handle.createWritable(); await w.write(text); await w.close(); last = { ok: true, at: host.now(), error: '', name: handle.name || '' }; }
      catch (e) { last = { ok: false, at: host.now(), error: (e && e.message) || 'write failed', name: handle.name || '' }; if (pending == null) pending = text; }
      busy = false;
      emit();
      if (pending != null && last.ok) flush();
    }
    return {
      supported: !!host.pick,
      attach: async function () { handle = await host.pick(); last = { ok: null, at: 0, error: '', name: handle.name || '' }; emit(); return handle; },
      detach: function () { handle = null; pending = null; if (timer) host.clearTimeout(timer); timer = null; last = { ok: null, at: 0, error: '', name: '' }; emit(); },
      active: function () { return !!handle; },
      queue: function (text) { if (!handle) return; pending = text; if (timer) host.clearTimeout(timer); timer = host.setTimeout(function () { timer = null; flush(); }, delay == null ? 1200 : delay); },
      flush: flush,
      status: function () { return last; },
      on: function (f) { listeners.push(f); }
    };
  }

  var api = { idbBackend: idbBackend, createKeyStore: createKeyStore, createFileSync: createFileSync };
  root.SC_KEYSTORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
