/* Stark Family Vault, by Stark: live mirror file. After every successful save, the same encrypted file is written to a file
   the person chose (a USB stick or a synced folder), using the browser's File System Access API where it exists.
   Only the sealed, already-encrypted envelope is ever written; the mirror is a valid backup file. No network, no DOM. */
(function (root) {
  "use strict";
  var V = root.StarkVault || (typeof require === "function" ? require("./core.js") : null);
  var KEY = "mirror", MODE = { mode: "readwrite" };

  // Browsers refuse file pickers inside a frame from another site (such as a store page that embeds the app).
  function framed(win) {
    try { return !!win && win.top != null && win.top !== win && !win.top.location.href; } catch (e) { return true; }
  }
  function supported(win) { return !!(win && typeof win.showSaveFilePicker === "function") && !framed(win); }
  function permission(handle, ask) {
    if (!handle || typeof handle.queryPermission !== "function") return Promise.resolve("denied");
    return Promise.resolve(handle.queryPermission(MODE)).then(function (p) {
      if (p === "granted" || !ask || typeof handle.requestPermission !== "function") return p;
      return handle.requestPermission(MODE);
    }, function () { return "denied"; });
  }
  // Writes one envelope. Refuses anything that is not a valid encrypted vault file, so plaintext can never reach the disk this way.
  function writeEnv(handle, env) {
    var why = V.validateEnvelope(env), text;
    if (why || env.kind !== "vault") return Promise.reject(new Error("Only the encrypted vault file can be mirrored."));
    text = JSON.stringify(env);
    return Promise.resolve(handle.createWritable()).then(function (w) {
      return Promise.resolve(w.write(text)).then(function () { return w.close(); }, function (e) { try { w.abort && w.abort(); } catch (x) { /* ignore */ } throw e; });
    }).then(function () { return text.length; });
  }

  // A small controller. store = { get(key), put(key, value|null) } (IndexedDB in the app, a Map in tests).
  // onChange(state) is called whenever the status changes. Status: unsupported | off | on | paused | error.
  function create(opts) {
    var win = opts.win, store = opts.store, onChange = opts.onChange || function () {};
    var st = { status: supported(win) ? "off" : "unsupported", name: "", last: null, error: "", writes: 0 }, rec = null, busy = null, pending = null;
    function set(p) { var k; for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) st[k] = p[k]; onChange(st); return st; }
    function remember() { return Promise.resolve(store.put(KEY, rec)).catch(function () { return null; }); }
    function load() {
      if (st.status === "unsupported") return Promise.resolve(st);
      return Promise.resolve(store.get(KEY)).then(function (r) {
        if (!r || !r.handle || typeof r.handle.createWritable !== "function") { rec = null; return set({ status: "off", name: "", last: null }); }
        rec = r;
        return permission(r.handle, false).then(function (p) { return set({ status: p === "granted" ? "on" : "paused", name: r.name || "", last: r.last || null }); });
      }, function () { return set({ status: "off" }); });
    }
    function flushPending() {
      if (busy || !pending || st.status !== "on" || !rec) return busy || Promise.resolve(st);
      var env = pending; pending = null;
      busy = writeEnv(rec.handle, env).then(function () {
        rec.last = new Date().toISOString(); rec.sum = env.sum || null; st.writes++;
        return remember().then(function () { set({ status: "on", last: rec.last, error: "" }); });
      }, function (e) {
        set({ status: "error", error: e && e.message ? e.message : "The mirror file could not be written." });
      }).then(function () { busy = null; return pending ? flushPending() : st; });
      return busy;
    }
    // Called after each successful save. Writes are coalesced: while one is running only the newest envelope waits.
    // The file already holding this exact envelope (same checksum) is not rewritten.
    function push(env) {
      if (!rec || (st.status !== "on" && st.status !== "error")) return Promise.resolve(st);
      if (st.status === "on" && !busy && env && env.sum && rec.sum === env.sum) return Promise.resolve(st);
      if (st.status === "error") st.status = "on"; pending = env; return flushPending();
    }
    function choose(env) {
      if (!supported(win)) return Promise.reject(new Error("This browser cannot keep a file updated."));
      return Promise.resolve(win.showSaveFilePicker({ suggestedName: "family-vault-mirror.starkvault",
        types: [{ description: "Stark Family Vault file", accept: { "application/json": [".starkvault"] } }] })).then(function (handle) {
        rec = { handle: handle, name: handle.name || "mirror file", last: null };
        set({ status: "on", name: rec.name, last: null, error: "" });
        return remember().then(function () { return env ? push(env) : st; });
      });
    }
    // Browsers forget the write permission between visits; resuming needs a click (a user gesture).
    function resume(env) {
      if (!rec) return Promise.resolve(st);
      return permission(rec.handle, true).then(function (p) {
        if (p !== "granted") return set({ status: "paused", error: "Permission was not given." });
        set({ status: "on", error: "" });
        return env ? push(env) : st;
      });
    }
    function stop() { rec = null; pending = null; return Promise.resolve(store.put(KEY, null)).catch(function () { return null; }).then(function () { return set({ status: "off", name: "", last: null, error: "" }); }); }
    return { state: function () { return st; }, load: load, push: push, choose: choose, resume: resume, stop: stop, idle: function () { return busy || Promise.resolve(st); } };
  }

  var api = { supported: supported, framed: framed, permission: permission, writeEnv: writeEnv, create: create, KEY: KEY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.StarkMirror = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
