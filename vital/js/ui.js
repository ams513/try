(function (root) {
  "use strict";
  var V = root.StarkVital;

  function h(tag, props) {
    var el = document.createElement(tag), k, kids = Array.prototype.slice.call(arguments, 2);
    props = props || {};
    for (k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k) || props[k] == null || props[k] === false) continue;
      if (k === "class") el.className = props[k];
      else if (k === "text") el.textContent = props[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), props[k]);
      else if (k === "value" || k === "checked" || k === "disabled" || k === "selected" || k === "hidden") el[k] = props[k];
      else el.setAttribute(k, props[k] === true ? "" : props[k]);
    }
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) add(c);
        else el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
      });
    })(kids);
    return el;
  }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  // Problems are announced at once (role alert) and stay up at least 10 s; nothing hides while the pointer or focus is on it.
  var toastTimer;
  function toast(msg, bad) {
    var t = $("#toast"), ms = bad ? 10000 : 5000;
    if (!t) return;
    clear(t).appendChild(h("span", { class: "toast-msg", text: msg }));
    t.appendChild(h("button", { type: "button", class: "toast-x", "aria-label": "Dismiss message", text: "×", onclick: function () { clearTimeout(toastTimer); t.hidden = true; } }));
    t.className = "toast" + (bad ? " bad" : "");
    t.setAttribute("role", bad ? "alert" : "status"); t.setAttribute("aria-live", bad ? "assertive" : "polite");
    t.hidden = false;
    clearTimeout(toastTimer);
    (function later() { toastTimer = setTimeout(function () { if (t.matches(":hover") || t.contains(document.activeElement)) return later(); t.hidden = true; }, ms); })();
  }
  // Field errors: the message is linked to the control (aria-describedby + aria-invalid) and focus moves to it.
  function markInvalid(ctrl, errEl) {
    if (!ctrl || !errEl) return;
    if (!errEl.id) errEl.id = "err-" + Math.random().toString(36).slice(2, 9);
    ctrl.setAttribute("aria-invalid", "true");
    var ids = (ctrl.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
    if (ids.indexOf(errEl.id) === -1) ids.push(errEl.id);
    ctrl.setAttribute("aria-describedby", ids.join(" "));
    try { ctrl.focus(); } catch (e) { /* not focusable */ }
  }
  function clearInvalid(root) { Array.prototype.forEach.call((root || document).querySelectorAll("[aria-invalid]"), function (c) { c.removeAttribute("aria-invalid"); }); }

  /* ---- dialogs ---- */
  function modal(title, body, opts) {
    opts = opts || {};
    var dlg = h("dialog", { class: "dialog" + (opts.wide ? " wide" : ""), "aria-labelledby": "dlg-title" });
    dlg.appendChild(h("div", { class: "dlg-head" }, h("h2", { id: "dlg-title", text: title }),
      h("button", { type: "button", class: "icon-btn", "aria-label": "Close", text: "×", onclick: function () { dlg.close(); } })));
    dlg.appendChild(body);
    dlg.addEventListener("close", function () { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); if (opts.onclose) opts.onclose(); });
    document.body.appendChild(dlg);
    dlg.showModal();
    return dlg;
  }
  function closeAllDialogs() { Array.prototype.slice.call(document.querySelectorAll("dialog[open]")).forEach(function (d) { d.close(); }); }
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false, dlg;
      var body = h("div", { class: "dlg-body" }, h("p", { text: text }),
        h("div", { class: "row end" },
          h("button", { type: "button", class: "btn", text: "Cancel", onclick: function () { dlg.close(); } }),
          h("button", { type: "button", class: "btn " + (danger ? "danger" : "primary"), text: okLabel || "OK", onclick: function () { done = true; dlg.close(); } })));
      dlg = modal(title, body, { onclose: function () { resolve(done); } });
    });
  }

  /* ---- passphrase field with strength meter ---- */
  function passField(id, label, onChange) {
    var inp = h("input", { id: id, type: "password", autocomplete: "new-password", maxlength: 200 }), bar = h("span", { class: "sbar-fill" }), lab = h("span", { class: "sbar-label", text: "Enter a passphrase" }), notes = h("span", { class: "fine" });
    var show = h("button", { type: "button", class: "btn small", text: "Show", onclick: function () { inp.type = inp.type === "password" ? "text" : "password"; show.textContent = inp.type === "password" ? "Show" : "Hide"; } });
    function upd() {
      var s = V.strength(inp.value);
      bar.className = "sbar-fill s" + s.score + (inp.value ? " w" + s.score : "");
      lab.textContent = inp.value ? s.label + " (about " + s.bits + " bits)" : "Enter a passphrase";
      notes.textContent = inp.value && s.notes.length ? "Weakened by: " + s.notes.join(", ") + "." : "";
      if (onChange) onChange(s);
    }
    inp.addEventListener("input", upd);
    return { input: inp, el: h("div", { class: "field wide" }, h("label", { for: id, text: label }), h("div", { class: "row tight" }, inp, show),
      h("div", { class: "sbar", role: "img", "aria-label": "Passphrase strength" }, bar), lab, notes) };
  }

  var MAX_PICK = 400 * 1024 * 1024;
  function download(name, blob) {
    var url = URL.createObjectURL(blob), a = h("a", { href: url, download: name });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function downloadText(name, text, mime) { download(name, new Blob([text], { type: mime || "text/plain" })); }
  function pickFile(accept, asText) {
    return new Promise(function (res) {
      var inp = h("input", { type: "file", accept: accept || "", class: "sr-only" });
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0]; if (inp.parentNode) inp.parentNode.removeChild(inp);
        if (!f) return res(null);
        if (f.size > MAX_PICK) return res({ name: f.name, json: null, tooBig: true });
        var r = new FileReader(); r.onload = function () { if (asText) return res({ name: f.name, text: String(r.result) }); try { res({ name: f.name, json: JSON.parse(r.result) }); } catch (e) { res({ name: f.name, json: null }); } }; r.readAsText(f);
      });
      document.body.appendChild(inp); inp.click();
    });
  }

  var DB = "stark_vital", LS = "stark_vital|", dbp = null, bep = null;
  function idb() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
        r.onsuccess = function () { var db = r.result; db.onversionchange = function () { db.close(); dbp = null; }; res(db); };
        r.onerror = function () { rej(r.error); };
        r.onblocked = function () { rej(new Error("Storage is busy in another tab.")); };
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  // One storage backend per session, chosen once: IndexedDB when it opens, otherwise localStorage. A failed IndexedDB write is
  // an error shown to the user, never a silent switch to localStorage (that split copies and loaded old data on the next unlock).
  function backend() {
    if (!bep) bep = (typeof indexedDB === "undefined" ? Promise.reject(new Error("none")) : idb()).then(function () { return "idb"; }, function () { dbp = null; return "ls"; });
    return bep;
  }
  function storageError(e) {
    var full = e && (e.name === "QuotaExceededError" || /quota/i.test(String(e.message || "")));
    return new Error(full ? "Browser storage is full. Save a backup file, then remove old evidence files." : "Browser storage refused the write.");
  }
  function lsGet(key) { try { var t = localStorage.getItem(LS + key); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function lsPut(key, val) { try { localStorage.setItem(LS + key, JSON.stringify(val)); } catch (e) { throw storageError(e); } }
  function req(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("kv", mode), q = fn(tx.objectStore("kv")), out;
        if (q) q.onsuccess = function () { out = q.result; };
        tx.oncomplete = function () { res(out); }; tx.onerror = tx.onabort = function () { rej(tx.error || new Error("Storage failed.")); };
      });
    });
  }
  function rawGet(key) {
    return backend().then(function (b) {
      if (b === "ls") return lsGet(key);
      return req("readonly", function (s) { return s.get(key); }).then(function (v) { return v == null ? null : v; });
    });
  }
  function rawPut(key, val) {
    return backend().then(function (b) {
      if (b === "ls") return lsPut(key, val);
      return req("readwrite", function (s) { s.put(val, key); }).catch(function (e) { throw storageError(e); });
    });
  }
  function rawDel(key) {
    return backend().then(function (b) {
      try { localStorage.removeItem(LS + key); } catch (e) { /* ignore */ }   // also clears copies an older version left there
      return b === "ls" ? null : req("readwrite", function (s) { s.delete(key); });
    });
  }
  function lsKeys(prefix) { var out = [], i, k; try { for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); if (k && k.indexOf(LS + prefix) === 0) out.push(k.slice(LS.length)); } } catch (e) { /* ignore */ } return out; }
  function rawKeys(prefix) {
    return backend().then(function (b) {
      return b === "ls" ? lsKeys(prefix) : req("readonly", function (s) { return s.getAllKeys(IDBKeyRange.bound(prefix, prefix + "\uffff")); });
    });
  }
  // Rollback guard: the highest save number seen for a workspace, kept in both stores so wiping one does not reset it.
  function seqGet(ws) {
    return rawGet(K(ws, "seq")).catch(function () { return 0; }).then(function (a) { var b = lsGet(K(ws, "seq")); return Math.max(+a || 0, +b || 0); });
  }
  function seqPut(ws, n) {
    if (typeof n !== "number") return Promise.resolve();
    return seqGet(ws).then(function (cur) {   // only ever rises: restoring the last good copy does not lower it
      if (n <= cur) return null;
      try { localStorage.setItem(LS + K(ws, "seq"), JSON.stringify(n)); } catch (e) { /* the IndexedDB copy still counts */ }
      return rawPut(K(ws, "seq"), n);
    });
  }
  function same(a, b) { return !!a && !!b && a.ct === b.ct && a.iv === b.iv && a.salt === b.salt && a.iter === b.iter && a.sum === b.sum && (a.ref || "") === (b.ref || ""); }
  function K(ws, k) { return "ws:" + ws + ":" + k; }
  // Checked save: keep the previous good copy, write, read back and compare. A mismatch is an error, never silent.
  function storePut(ws, env) {
    return rawGet(K(ws, "main")).then(function (prev) {
      var keep = prev && !V.validateEnvelope(prev, "vital") && !same(prev, env) ? rawPut(K(ws, "main.bak"), prev) : Promise.resolve();
      return keep.then(function () { return rawPut(K(ws, "main"), env); });
    }).then(function () { return rawGet(K(ws, "main")); }).then(function (back) {
      if (!same(back, env)) throw new Error("The saved copy did not read back correctly.");
      return seqPut(ws, env.seq);
    });
  }
  // Resolves the stored envelope, falling back to the last good copy; { corrupt, raw } if neither is usable.
  // A copy an older version wrote to localStorage after an IndexedDB failure wins only when its save number is higher.
  function storeGet(ws) {
    return rawGet(K(ws, "main")).then(function (main) {
      var stray = lsGet(K(ws, "main"));
      if (stray && stray !== main && !V.validateEnvelope(stray, "vital") && (!main || (stray.seq || 0) > (main.seq || 0))) return stray;
      if (main && !V.validateEnvelope(main, "vital")) return main;
      return rawGet(K(ws, "main.bak")).then(function (bak) { return bak && !V.validateEnvelope(bak, "vital") ? bak : main ? { corrupt: true, raw: main } : null; });
    });
  }
  function storeGetBak(ws) { return rawGet(K(ws, "main.bak")).then(function (b) { return b && !V.validateEnvelope(b, "vital") ? b : null; }); }
  function setBak(ws, env) { return rawPut(K(ws, "main.bak"), env); }

  // Erase everything this app ever stored in this browser: the record, the last good copy, the save counter, and the database itself.
  function wipeAll() {
    return rawKeys("ws:").then(function (keys) { return Promise.all(keys.map(rawDel)); }).catch(function () { return null; }).then(function () {
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(LS) === 0 || k.indexOf("sv-") === 0) localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
      return new Promise(function (res) {
        try { if (dbp) dbp.then(function (db) { db.close(); }, function () { return null; }); dbp = null; bep = null;
          var r = indexedDB.deleteDatabase(DB); r.onsuccess = r.onerror = r.onblocked = function () { res(); }; } catch (e) { res(); }
      });
    });
  }
  function hasRecord(ws) { return rawGet(K(ws, "main")).then(function (m) { return !!m; }).catch(function () { return false; }); }

  root.VitalUI = { h: h, $: $, clear: clear, toast: toast, markInvalid: markInvalid, clearInvalid: clearInvalid, backend: backend, seqGet: seqGet, MAX_PICK: MAX_PICK, modal: modal, closeAllDialogs: closeAllDialogs, confirmBox: confirmBox, passField: passField,
    download: download, downloadText: downloadText, pickFile: pickFile, storePut: storePut, storeGet: storeGet, storeGetBak: storeGetBak, setBak: setBak, wipeAll: wipeAll, hasRecord: hasRecord };
})(globalThis);
