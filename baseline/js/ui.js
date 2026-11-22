/* Stark Baseline: UI helpers (DOM builder, dialogs, forms, files) and the encrypted local store.
   Everything is built with textContent, never as parsed markup. Only encrypted envelopes are ever stored. */
(function (root) {
  "use strict";
  var V = root.StarkBaseline;

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

  /* ---- generic form: text, textarea, select, date, number, multi (checkbox group). warn = refuse secrets ---- */
  function opt(o) { return typeof o === "string" ? { v: o, l: o || "Choose..." } : o; }
  function fieldEl(f, val) {
    var id = "f-" + f.k, input, wrap;
    if (f.type === "textarea") input = h("textarea", { id: id, rows: f.rows || 3, maxlength: f.max || 4000, placeholder: f.ph || "", text: val || "" });
    else if (f.type === "select") input = h("select", { id: id }, (f.options || []).map(function (o) { o = opt(o); return h("option", { value: o.v, text: o.l, selected: o.v === (val == null ? f.def : val) }); }));
    else if (f.type === "multi") {
      var cur = Array.isArray(val) ? val : [];
      input = h("div", { id: id, class: "multi" }, (f.options || []).map(function (o, i) {
        return h("label", { class: "chk" }, h("input", { type: "checkbox", id: id + "-" + i, value: o.v, checked: cur.indexOf(o.v) !== -1 }), o.l);
      }));
    } else input = h("input", { id: id, type: f.type || "text", value: val == null ? "" : val, maxlength: f.max || 200, placeholder: f.ph || "", min: f.min, inputmode: f.inputmode, autocomplete: "off" });
    wrap = h("div", { class: "field" + (f.wide || f.type === "textarea" || f.type === "multi" ? " wide" : "") });
    wrap.appendChild(f.type === "multi" ? h("span", { class: "lbl", text: f.label }) : h("label", { for: id, text: f.label + (f.req ? " *" : "") }));
    wrap.appendChild(f.type === "multi" ? h("details", { class: "multi-box", open: f.open || null }, h("summary", { text: f.summary || "Choose" }), input) : input);
    if (f.help) { wrap.appendChild(h("span", { class: "fine", id: id + "-help", text: f.help })); input.setAttribute("aria-describedby", id + "-help"); }
    if (f.warn) {
      var w = h("p", { class: "warn-text", id: id + "-warn", hidden: true });
      input.setAttribute("aria-describedby", ((input.getAttribute("aria-describedby") || "") + " " + id + "-warn").trim());
      wrap.appendChild(w);
      input.addEventListener("input", function () { var fl = V.looksSensitive(input.value); w.hidden = !fl.length; w.textContent = fl.length ? "This contains " + fl.join(" and ") + ". Remove it: never store secrets here." : ""; });
    }
    return wrap;
  }
  function openForm(title, fields, values, onSave, extra) {
    values = values || {};
    var form, err, dlg;
    err = h("p", { class: "form-err", role: "alert", hidden: true });
    form = h("form", { class: "form dlg-body", novalidate: true, autocomplete: "off" },
      h("div", { class: "grid2" }, fields.map(function (f) { return fieldEl(f, values[f.k]); })), err, extra || null,
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Cancel", onclick: function () { dlg.close(); } }),
        h("button", { type: "submit", class: "btn primary", text: "Save" })));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = {}, bad = null, badEl = null;
      clearInvalid(form);
      fields.forEach(function (f) {
        var el = $("#f-" + f.k, form), v, why = null;
        if (f.type === "multi") v = Array.prototype.filter.call(el.querySelectorAll("input"), function (i) { return i.checked; }).map(function (i) { return i.value; });
        else v = el.value.trim();
        if (f.req && !v) why = f.label + " is required.";
        else if (f.type === "date" && v && isNaN(V.dayNum(v))) why = f.label + " is not a valid date.";
        else if (f.type === "number" && v !== "" && (isNaN(+v) || +v < 0)) why = f.label + " must be a positive number.";
        else if (f.warn && V.looksSensitive(v).length) why = "Not saved: " + f.label + " contains " + V.looksSensitive(v).join(" and ") + ". Never store passwords, PINs, recovery codes or full numbers here.";
        if (why) { el.setAttribute("aria-invalid", "true"); if (!bad) { bad = why; badEl = f.type === "multi" ? el.querySelector("input") : el; } }
        out[f.k] = v;
      });
      if (bad) { err.textContent = bad; err.hidden = false; markInvalid(badEl, err); return; }
      new Promise(function (res) { res(onSave(out)); }).then(function (keepOpen) { if (keepOpen !== false) dlg.close(); }, function (x) { err.textContent = x.message; err.hidden = false; });
    });
    dlg = modal(title, form, { wide: true });
    var first = form.querySelector("input:not([type=checkbox]),select,textarea"); if (first) first.focus();
    return dlg;
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

  /* ---- files ---- */
  var MAX_FILE = 5 * 1024 * 1024, MAX_PICK = 400 * 1024 * 1024;   // a picked file is read as one string: stay under the JS string limit
  var OK_EXT = /\.(pdf|png|jpe?g|gif|webp|txt|csv|md|log|json|docx?|xlsx?|pptx?|odt|ods|odp|rtf|eml)$/i;
  function readBytes(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.onerror = function () { rej(new Error("Could not read that file.")); }; r.readAsArrayBuffer(file); });
  }
  // Evidence is kept byte-for-byte (never resized), with its SHA-256 fingerprint.
  function readEvidence(file) {
    if (!OK_EXT.test(file.name)) return Promise.reject(new Error("Choose a document, spreadsheet, PDF, picture or text file."));
    if (file.size > MAX_FILE) return Promise.reject(new Error("That file is over 5 MB. Save a smaller copy, such as a PDF of just the pages you need."));
    return readBytes(file).then(function (b) { return V.sha256(b).then(function (sum) { return { name: file.name.slice(0, 200), mime: file.type || "application/octet-stream", size: file.size, sha256: sum, data: V.b64(b) }; }); });
  }
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

  /* ---- storage: IndexedDB (localStorage as a fallback). One workspace per organisation; keys never hold plaintext data.
     ws:<id>:main      the encrypted organisation record      ws:<id>:main.bak  the last good copy
     ws:<id>:f:<gen>:<file id>  one encrypted evidence file   workspaces  plaintext labels you choose, for the picker ---- */
  var DB = "stark_baseline", LS = "stark_baseline|", dbp = null, bep = null;
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
  // A chosen autosave file handle can only live in IndexedDB (it is not text).
  function handlePut(ws, handle) { return backend().then(function (b) { if (b !== "idb") throw new Error("This browser cannot remember the file."); return req("readwrite", function (s) { if (handle) s.put(handle, K(ws, "autosave")); else s.delete(K(ws, "autosave")); }); }); }
  function handleGet(ws) { return backend().then(function (b) { return b === "idb" ? req("readonly", function (s) { return s.get(K(ws, "autosave")); }) : null; }).catch(function () { return null; }); }
  function same(a, b) { return !!a && !!b && a.ct === b.ct && a.iv === b.iv && a.salt === b.salt && a.iter === b.iter && a.sum === b.sum && (a.ref || "") === (b.ref || ""); }
  function K(ws, k) { return "ws:" + ws + ":" + k; }
  // Checked save: keep the previous good copy, write, read back and compare. A mismatch is an error, never silent.
  function storePut(ws, env) {
    return rawGet(K(ws, "main")).then(function (prev) {
      var keep = prev && !V.validateEnvelope(prev, "baseline") && !same(prev, env) ? rawPut(K(ws, "main.bak"), prev) : Promise.resolve();
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
      if (stray && stray !== main && !V.validateEnvelope(stray, "baseline") && (!main || (stray.seq || 0) > (main.seq || 0))) return stray;
      if (main && !V.validateEnvelope(main, "baseline")) return main;
      return rawGet(K(ws, "main.bak")).then(function (bak) { return bak && !V.validateEnvelope(bak, "baseline") ? bak : main ? { corrupt: true, raw: main } : null; });
    });
  }
  function storeGetBak(ws) { return rawGet(K(ws, "main.bak")).then(function (b) { return b && !V.validateEnvelope(b, "baseline") ? b : null; }); }
  function setBak(ws, env) { return rawPut(K(ws, "main.bak"), env); }
  function filePut(ws, gen, id, env) {
    var key = K(ws, "f:" + gen + ":" + id);
    return rawPut(key, env).then(function () { return rawGet(key); }).then(function (back) { if (!same(back, env)) throw new Error("The evidence file did not read back correctly."); });
  }
  function fileGet(ws, gen, id) { return rawGet(K(ws, "f:" + gen + ":" + id)); }
  function fileDel(ws, gen, id) { return rawDel(K(ws, "f:" + gen + ":" + id)); }
  function fileKeys(ws, gen) { return rawKeys(K(ws, "f:" + gen + ":")); }
  function workspaces() { return rawGet("workspaces").then(function (w) { return Array.isArray(w) ? w.filter(function (x) { return x && typeof x.id === "string" && /^[0-9a-f]{16}$/.test(x.id); }) : []; }); }
  function addWorkspace(id, label) { return workspaces().then(function (w) { w = w.filter(function (x) { return x.id !== id; }); w.push({ id: id, label: String(label || "Organisation").slice(0, 60), created: V.todayStr() }); return rawPut("workspaces", w); }); }
  function renameWorkspace(id, label) { return workspaces().then(function (w) { w.forEach(function (x) { if (x.id === id) x.label = String(label || x.label).slice(0, 60); }); return rawPut("workspaces", w); }); }
  function removeWorkspace(id) {
    return rawKeys("ws:" + id + ":").then(function (keys) { return Promise.all(keys.map(rawDel)); })
      .then(workspaces).then(function (w) { return rawPut("workspaces", w.filter(function (x) { return x.id !== id; })); });
  }

  root.BaselineUI = { h: h, $: $, clear: clear, toast: toast, markInvalid: markInvalid, clearInvalid: clearInvalid, backend: backend, seqGet: seqGet, handlePut: handlePut, handleGet: handleGet, MAX_PICK: MAX_PICK, modal: modal, closeAllDialogs: closeAllDialogs, confirmBox: confirmBox, openForm: openForm, passField: passField,
    readEvidence: readEvidence, download: download, downloadText: downloadText, pickFile: pickFile, MAX_FILE: MAX_FILE,
    storePut: storePut, storeGet: storeGet, storeGetBak: storeGetBak, setBak: setBak, filePut: filePut, fileGet: fileGet, fileDel: fileDel, fileKeys: fileKeys,
    workspaces: workspaces, addWorkspace: addWorkspace, renameWorkspace: renameWorkspace, removeWorkspace: removeWorkspace };
})(globalThis);
