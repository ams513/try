/* Stark Baseline: autosave to a file you choose (File System Access API, feature-detected; no DOM, no network).
   After each save the encrypted backup bundle (the same file "Save a backup file" makes) is written to that file, at most
   once per quiet period, then read back and compared. Browsers without the API, or an embedded copy, keep manual backups. */
(function (root) {
  "use strict";
  var DELAY = 15000;

  // Chrome and Edge offer showSaveFilePicker; it is refused inside a cross-origin frame (an itch.io embed), so check for top level.
  function supported(w) {
    w = w || root;
    try { return typeof w.showSaveFilePicker === "function" && w.self === w.top; } catch (e) { return false; }
  }

  // opts: getBundle() -> Promise(bundle object); remember(handle|null) -> Promise; onState(state, info); onWritten(info);
  //       delay (ms); setTimer(fn, ms) / clearTimer(id) (tests pass fakes); now() -> ms.
  function create(opts) {
    var handle = null, state = "off", timer = null, dirty = false, writing = Promise.resolve(), info = { name: "", last: null, error: "" };
    var setT = opts.setTimer || function (fn, ms) { return setTimeout(fn, ms); }, clearT = opts.clearTimer || function (id) { clearTimeout(id); };
    var now = opts.now || function () { return Date.now(); }, delay = opts.delay == null ? DELAY : opts.delay;
    function set(s, err) { state = s; info.error = err || ""; if (opts.onState) opts.onState(state, info); }
    function perm(h, ask) {
      var o = { mode: "readwrite" };
      if (!h) return Promise.resolve("denied");
      if (ask && typeof h.requestPermission === "function") return Promise.resolve(h.requestPermission(o));
      return typeof h.queryPermission === "function" ? Promise.resolve(h.queryPermission(o)) : Promise.resolve("granted");
    }
    function write() {
      var h = handle;
      writing = writing.catch(function () { return null; }).then(function () {
        if (!h || state !== "on" || !dirty) return null;
        dirty = false;
        return opts.getBundle().then(function (bundle) {
          var text = JSON.stringify(bundle);
          return Promise.resolve(h.createWritable()).then(function (w) {
            return Promise.resolve(w.write(text)).then(function () { return w.close(); });
          }).then(function () { return h.getFile(); }).then(function (f) { return f.text(); }).then(function (back) {
            if (back !== text) throw new Error("The autosave file did not read back correctly.");
            info.last = now(); info.bytes = text.length;
            if (opts.onWritten) opts.onWritten(info);
            set("on");
          });
        }).catch(function (e) {
          dirty = true;
          if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) set("paused", "Permission to write the file was withdrawn.");
          else set("error", (e && e.message) || "Could not write the autosave file.");
        });
      });
      return writing;
    }
    var api = {
      supported: function () { return supported(opts.win); },
      get state() { return state; },
      get info() { return info; },
      // A handle remembered from an earlier session: active if the browser still allows writing, paused until the user resumes.
      attach: function (h) {
        handle = h || null; info.name = h ? h.name || "" : "";
        if (!h) { set("off"); return Promise.resolve(state); }
        return perm(h, false).then(function (p) { set(p === "granted" ? "on" : "paused"); return state; }, function () { set("paused"); return state; });
      },
      // Called from a click: ask for the file (or reuse the remembered one), then write at once.
      choose: function (pick) {
        return Promise.resolve(pick()).then(function (h) {
          handle = h; info.name = h.name || "";
          return Promise.resolve(opts.remember ? opts.remember(h) : null).catch(function () { return null; });
        }).then(function () { set("on"); dirty = true; return write(); }).then(function () { return state; });
      },
      resume: function () {
        return perm(handle, true).then(function (p) {
          if (p !== "granted") { set("paused", "Permission was not given."); return state; }
          set("on"); dirty = true; return write().then(function () { return state; });
        });
      },
      changed: function () {
        dirty = true;
        if (state !== "on" || timer) return;
        timer = setT(function () { timer = null; write(); }, delay);
      },
      flush: function () { if (timer) { clearT(timer); timer = null; } return write(); },
      stop: function (forget) {
        if (timer) { clearT(timer); timer = null; }
        handle = null; dirty = false; info = { name: "", last: null, error: "" }; set("off");
        return forget && opts.remember ? Promise.resolve(opts.remember(null)).catch(function () { return null; }) : Promise.resolve();
      },
      detach: function () { if (timer) { clearT(timer); timer = null; } handle = null; dirty = false; state = "off"; }
    };
    return api;
  }

  var out = { supported: supported, create: create, DELAY: DELAY };
  if (typeof module !== "undefined" && module.exports) module.exports = out;
  root.BaselineAutosave = out;
})(typeof globalThis !== "undefined" ? globalThis : this);
