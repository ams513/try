/* Stark Caregiver, by Stark: crash-safe storage for the encrypted care record, and the live backup file. No DOM, no network.
   One backend at a time: IndexedDB whenever it opens; localStorage only when IndexedDB cannot open at all. A failed write is
   reported, never quietly sent to the other backend (that used to leave an older copy in front on the next unlock).
   Every vault envelope carries a sequence number bound into its encryption; the highest one saved here is remembered, so an
   older copy put back in its place is noticed. */
(function (root) {
  "use strict";
  var BAK = ".bak";

  function make(o) {
    var IDB = o.indexedDB, LS = o.localStorage, DB = o.db, KEY = o.key, valid = o.validate, MARK = DB + ".seq";
    var dbp = null, backend = null, chain = Promise.resolve();
    function lsKey(k) { return k === KEY ? DB : k === KEY + BAK ? DB + BAK : DB + "." + k; }
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        if (!IDB) return rej(new Error("IndexedDB is not available."));
        var r;
        try { r = IDB.open(DB, 1); } catch (e) { return rej(e); }
        r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
        r.onsuccess = function () {
          var db = r.result;
          db.onversionchange = function () { db.close(); dbp = null; };
          db.onclose = function () { dbp = null; };
          backend = "indexeddb"; res(db);
        };
        r.onerror = function () { rej(r.error || new Error("IndexedDB could not open.")); };
      }).catch(function (e) { dbp = null; backend = "localstorage"; throw e; });
      return dbp;
    }
    function lsGet(k) { try { var t = LS && LS.getItem(lsKey(k)); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
    function lsPut(k, v) { if (!LS) throw new Error("This browser blocks storage for this page."); LS.setItem(lsKey(k), JSON.stringify(v)); }
    function lsDel(k) { try { if (LS) LS.removeItem(lsKey(k)); } catch (e) { /* nothing stored */ } }
    function idbGet(db, k) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("kv"), q = tx.objectStore("kv").get(k);
        q.onsuccess = function () { res(q.result == null ? null : q.result); };
        q.onerror = function () { rej(q.error); };
        tx.onabort = function () { rej(tx.error || new Error("The browser cancelled the read.")); };
      });
    }
    function idbPut(db, k, v) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("kv", "readwrite");
        if (v === undefined) tx.objectStore("kv").delete(k); else tx.objectStore("kv").put(v, k);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error || new Error("The save failed.")); };
        tx.onabort = function () { rej(tx.error || new Error("The browser cancelled the save (storage may be full).")); };
      });
    }
    function seqOf(e) { return e && typeof e.seq === "number" ? e.seq : 0; }
    // Reads IndexedDB when it opens. A localStorage copy (left by an older version's fallback) wins only if it is newer.
    function rawGet(k) {
      return open().then(function (db) {
        return idbGet(db, k).then(function (v) { var l = lsGet(k); return !v ? l : l && seqOf(l) > seqOf(v) ? l : v; });
      }, function () { return lsGet(k); });
    }
    function rawPut(k, v) {
      return open().then(function (db) { return idbPut(db, k, v).then(function () { lsDel(k); }); }, function () { if (v === undefined) lsDel(k); else lsPut(k, v); });
    }
    function same(a, b) { return !!a && !!b && a.ct === b.ct && a.iv === b.iv && a.salt === b.salt && a.iter === b.iter && a.sum === b.sum && seqOf(a) === seqOf(b); }
    function highSeq() { try { var n = LS ? parseInt(LS.getItem(MARK) || "0", 10) : 0; return n > 0 ? n : 0; } catch (e) { return 0; } }
    function mark(n) { try { if (LS && n > highSeq()) LS.setItem(MARK, String(n)); } catch (e) { /* the mark is a hint, not the data */ } }
    // Writes are queued, so a timed save and a lock-time flush can never interleave their read-back checks.
    function serial(fn) { var run = chain.then(fn); chain = run.catch(function () { return null; }); return run; }
    function put(env) {
      return serial(function () {
        return rawGet(KEY).then(function (prev) {
          // The last good copy is best effort: if it cannot be written, the main save still goes ahead.
          var keep = prev && !valid(prev) && !same(prev, env) ? rawPut(KEY + BAK, prev).catch(function () { return null; }) : Promise.resolve();
          return keep.then(function () { return rawPut(KEY, env); });
        }).then(function () { return rawGet(KEY); }).then(function (back) {
          if (!same(back, env)) throw new Error("The saved copy did not read back correctly.");
          mark(seqOf(env));
        });
      });
    }
    // Resolves the stored envelope; falls back to the last good copy; { corrupt, raw } when only unreadable data is stored.
    function get() {
      return rawGet(KEY).then(function (main) {
        if (main && !valid(main)) return main;
        return rawGet(KEY + BAK).then(function (bak) { return bak && !valid(bak) ? bak : main ? { corrupt: true, raw: main } : null; });
      });
    }
    function getBak() { return rawGet(KEY + BAK).then(function (b) { return b && !valid(b) ? b : null; }); }
    function clear() {
      return serial(function () {
        lsDel(KEY); lsDel(KEY + BAK); try { if (LS) LS.removeItem(MARK); } catch (e) { /* ignore */ }
        return Promise.all([rawPut(KEY, undefined), rawPut(KEY + BAK, undefined), rawPut("mirror", undefined)]).catch(function () { return null; });
      });
    }
    // Small side values (the live backup file handle). IndexedDB only: a file handle cannot go into localStorage.
    function sideGet(k) { return open().then(function (db) { return idbGet(db, k); }).catch(function () { return null; }); }
    function sideSet(k, v) { return open().then(function (db) { return idbPut(db, k, v); }); }
    return { get: get, getBak: getBak, put: put, clear: clear, highSeq: highSeq, seqOf: seqOf, sideGet: sideGet, sideSet: sideSet,
      backend: function () { return backend; } };
  }

  /* Live backup file: after each good save, the same encrypted envelope is written to a file the person chose
     (File System Access API, Chromium browsers on a local copy). Only the newest envelope is written; a write in
     progress is never interrupted, and a newer one waits behind it. */
  function mirror(o) {
    var handle = null, busy = null, next = null, last = null, err = null;
    function writeNow(env) {
      return Promise.resolve().then(function () { return handle.createWritable(); }).then(function (w) {
        return w.write(JSON.stringify(env)).then(function () { return w.close(); }, function (e) { return Promise.resolve(w.abort && w.abort()).then(function () { throw e; }); });
      });
    }
    function pump() {
      if (busy || !next || !handle) return busy || Promise.resolve();
      var env = next; next = null;
      busy = writeNow(env).then(function () { last = o.now ? o.now() : Date.now(); err = null; }, function (e) { err = e; if (o.onError) o.onError(e); })
        .then(function () { busy = null; return pump(); });
      return busy;
    }
    return {
      set: function (h) { handle = h; err = null; return this; },
      handle: function () { return handle; },
      write: function (env) { next = env; return pump(); },
      status: function () { return { on: !!handle, name: handle && handle.name || "", last: last, error: err ? String(err.message || err) : "" }; },
      stop: function () { handle = null; next = null; }
    };
  }
  function canMirror(w) {
    try { return !!(w && typeof w.showSaveFilePicker === "function" && w.self === w.top); } catch (e) { return false; }
  }

  var api = { make: make, mirror: mirror, canMirror: canMirror };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CareStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
