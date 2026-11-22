/* Stark Fellowship: UI helpers (DOM builder, dialogs, forms, files, encrypted local storage).
   Adapted from Stark Family Vault. Everything is built with textContent, never as parsed markup. */
(function (root) {
  "use strict";
  var K = root.StarkCore;

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
  function btn(text, cls, fn, attrs) { var b = h("button", attrs || {}); b.type = "button"; b.className = "btn " + (cls || ""); b.textContent = text; b.addEventListener("click", fn); return b; }
  function select(id, opts, val, onchange, label) {
    var s = h("select", { id: id, "aria-label": label || null, onchange: onchange ? function (e) { onchange(e.target.value); } : null });
    opts.forEach(function (o) { var v = typeof o === "string" ? o : o[0], l = typeof o === "string" ? o : o[1]; s.appendChild(h("option", { value: v, text: l, selected: v === val })); });
    return s;
  }

  // Two regions: #toast (role=status, polite) for confirmations and #toast-bad (role=alert) for problems.
  // Problems stay at least 9 seconds, never hide while hovered or focused, and have a close button.
  var toastTimers = {};
  function toast(msg, bad) {
    var id = bad ? "toast-bad" : "toast", t = $("#" + id), other = $("#" + (bad ? "toast" : "toast-bad")), m;
    if (!t) return;
    m = t.querySelector(".toast-msg") || t;
    if (other && !bad) { /* a confirmation never covers a problem that is still showing */ if (!other.hidden) t.classList.add("raised"); else t.classList.remove("raised"); }
    m.textContent = msg; t.hidden = false;
    arm(id, t, bad ? 9000 : 3800);
  }
  function arm(id, t, ms) {
    clearTimeout(toastTimers[id]);
    toastTimers[id] = setTimeout(function hide() {
      if (t.matches(":hover") || t.contains(document.activeElement)) { toastTimers[id] = setTimeout(hide, 1500); return; }
      t.hidden = true;
    }, ms);
  }
  function wireToasts() {
    Array.prototype.forEach.call(document.querySelectorAll(".toast .toast-x"), function (b) {
      b.addEventListener("click", function () { var t = b.closest(".toast"); clearTimeout(toastTimers[t.id]); t.hidden = true; });
    });
  }
  /* ---- field errors: linked to the control so screen readers read them with it ---- */
  function markField(input, errEl, on) {
    if (!input) return;
    var ids = (input.getAttribute("aria-describedby") || "").split(" ").filter(function (x) { return x && x !== errEl.id; });
    if (on) { input.setAttribute("aria-invalid", "true"); ids.push(errEl.id); } else input.removeAttribute("aria-invalid");
    if (ids.length) input.setAttribute("aria-describedby", ids.join(" ")); else input.removeAttribute("aria-describedby");
  }
  var errSeq = 0;
  function errBox() { return h("p", { class: "form-err", role: "alert", id: "err-" + (++errSeq), hidden: true }); }
  // Shows msg in errEl, marks `input` invalid and linked (clearing marks on `all`), and focuses it.
  function fieldError(errEl, msg, input, all) {
    (all || []).forEach(function (x) { markField(x, errEl, false); });
    errEl.textContent = msg; errEl.hidden = !msg;
    if (input && msg) { markField(input, errEl, true); input.focus(); }
  }

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
      dlg = modal(title, h("div", { class: "dlg-body" }, h("p", { text: text }),
        h("div", { class: "row end" }, btn("Cancel", "", function () { dlg.close(); }), btn(okLabel || "OK", danger ? "danger" : "primary", function () { done = true; dlg.close(); }))),
        { onclose: function () { resolve(done); } });
    });
  }

  /* ---- generic form: fields [{k, label, type, options, req, help, wide, max, list, show}] ---- */
  function fieldEl(f, val) {
    var id = "f-" + f.k, input, wrap;
    if (f.type === "textarea") input = h("textarea", { id: id, rows: f.rows || 3, maxlength: f.max || 2000, placeholder: f.ph || "", text: val || "" });
    else if (f.type === "select") input = select(id, f.options, val == null ? "" : String(val));
    else if (f.type === "checkbox") input = h("input", { id: id, type: "checkbox", checked: !!val });
    else {
      input = h("input", { id: id, type: f.type === "money" ? "text" : (f.type || "text"), value: val == null ? "" : val, maxlength: f.max || 200, placeholder: f.ph || "",
        inputmode: f.type === "money" ? "decimal" : null, autocomplete: "off", list: f.list ? id + "-list" : null });
    }
    wrap = h("div", { class: "field" + (f.type === "checkbox" ? " check" : "") + (f.wide ? " wide" : ""), hidden: f.hidden });
    if (f.type === "checkbox") wrap.appendChild(input);
    wrap.appendChild(h("label", { for: id, text: f.label + (f.req ? " *" : "") }));
    if (f.type !== "checkbox") wrap.appendChild(input);
    if (f.list) wrap.appendChild(h("datalist", { id: id + "-list" }, f.list.map(function (o) { return h("option", { value: o }); })));
    if (f.help) { wrap.appendChild(h("span", { class: "fine", id: id + "-help", text: f.help })); input.setAttribute("aria-describedby", id + "-help"); }
    return wrap;
  }
  // onSave(values) may throw an Error (shown in the form) or return false to keep the dialog open.
  function openForm(title, fields, values, onSave, opts) {
    opts = opts || {};
    values = values || {};
    var err = errBox(), dlg, form;
    form = h("form", { class: "form dlg-body", novalidate: true, autocomplete: "off" },
      opts.intro ? h("p", { class: "fine", text: opts.intro }) : null,
      h("div", { class: "grid2" }, fields.map(function (f) { return fieldEl(f, values[f.k]); })), err, opts.extra || null,
      h("div", { class: "row end" }, opts.del ? btn(opts.delLabel || "Delete", "danger-o push", function () { dlg.close(); opts.del(); }) : null, btn("Cancel", "", function () { dlg.close(); }),
        opts.again ? h("button", { type: "submit", class: "btn", "data-again": "1", text: opts.again }) : null,
        h("button", { type: "submit", class: "btn primary", text: opts.saveLabel || "Save" })));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = {}, bad = null, badEl = null, again = e.submitter && e.submitter.getAttribute("data-again"), all = [];
      fields.forEach(function (f) {
        var el = $("#f-" + f.k, form), v, why = null;
        all.push(el);
        if (f.type === "checkbox") v = el.checked;
        else v = el.value.trim();
        if (f.req && v === "" && !el.closest("[hidden]")) why = f.label + " is required.";
        if ((f.type === "date") && v && !K.isDate(v)) why = why || f.label + " is not a valid date.";
        if (f.type === "money" && v !== "") { var c = root.StarkBooks.toCents(v); if (isNaN(c) || c < 0) why = why || f.label + " must be an amount like 25.00."; else v = c; }
        else if (f.type === "money") v = 0;
        if (why && !bad) { bad = why; badEl = el; }
        out[f.k] = v;
      });
      if (bad) return fieldError(err, bad, badEl, all);
      fieldError(err, "", null, all);
      var keep;
      try { keep = onSave(out, !!again); } catch (x) { err.textContent = x.message; err.hidden = false; return; }
      Promise.resolve(keep).then(function (k) {
        if (again) { form.reset(); fields.forEach(function (f) { if (f.keep) $("#f-" + f.k, form).value = f.type === "money" ? "" : out[f.k]; }); err.hidden = true; var fi = form.querySelector("[data-first]") || form.querySelector("input,select"); if (fi) fi.focus(); return; }
        if (k !== false) dlg.close();
      }, function (x) { err.textContent = x.message; err.hidden = false; });
    });
    form.addEventListener("change", function () { if (opts.onchange) opts.onchange(form); });
    dlg = modal(title, form, { wide: true });
    if (opts.onchange) opts.onchange(form);
    var first = form.querySelector("input:not([type=checkbox]),select,textarea"); if (first) { first.setAttribute("data-first", "1"); first.focus(); }
    return dlg;
  }

  /* ---- passphrase field with strength meter ---- */
  function passField(id, label) {
    var inp = h("input", { id: id, type: "password", autocomplete: "new-password", maxlength: 200 }), bar = h("span", { class: "sbar-fill" }), lab = h("span", { class: "sbar-label", text: "Enter a passphrase" });
    var show = btn("Show", "small", function () { inp.type = inp.type === "password" ? "text" : "password"; show.textContent = inp.type === "password" ? "Show" : "Hide"; });
    inp.addEventListener("input", function () {
      var s = K.strength(inp.value);
      bar.className = "sbar-fill s" + s.score; bar.style.width = (inp.value ? 10 + s.score * 22.5 : 0) + "%";
      lab.textContent = inp.value ? s.label + (s.notes.length ? ", weakened by " + s.notes.join(", ") : "") : "Enter a passphrase";
    });
    return { input: inp, el: h("div", { class: "field wide" }, h("label", { for: id, text: label }), h("div", { class: "row tight" }, inp, show),
      h("div", { class: "sbar", role: "img", "aria-label": "Passphrase strength" }, bar), lab) };
  }

  /* ---- files ---- */
  function downloadText(name, text, mime) {
    var url = URL.createObjectURL(new Blob([text], { type: mime || "application/octet-stream" })), a = h("a", { href: url, download: name });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function pickFile(accept, maxBytes) {
    return new Promise(function (res) {
      var inp = h("input", { type: "file", accept: accept, class: "sr-only" });
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0]; if (inp.parentNode) inp.parentNode.removeChild(inp);
        if (!f) return res(null);
        if (f.size > maxBytes) return res({ name: f.name, text: null, tooBig: true });
        var r = new FileReader(); r.onload = function () { res({ name: f.name, text: String(r.result) }); }; r.onerror = function () { res({ name: f.name, text: null }); }; r.readAsText(f);
      });
      document.body.appendChild(inp); inp.click();
    });
  }
  // Print one document: it is placed in #print-root, the page prints, and the copy is removed.
  function printDoc(el) {
    var pr = clear($("#print-root"));
    pr.appendChild(el); document.body.classList.add("printing");
    setTimeout(function () { window.print(); document.body.classList.remove("printing"); }, 50);
  }

  /* ---- storage: the encrypted book only. IndexedDB only (no second store that could hold a different copy),
     read back after each write, last good copy kept. One cached connection; aborts and errors always reject. ---- */
  var DB = "stark_fellowship", KEY = "book", BAK = "book.bak", dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
        r.onsuccess = function () { var db = r.result; db.onversionchange = function () { db.close(); dbp = null; }; db.onclose = function () { dbp = null; }; res(db); };
        r.onerror = function () { rej(r.error || new Error("Storage is not available.")); };
        r.onblocked = function () { rej(new Error("Storage is busy in another tab. Close other Stark Fellowship tabs.")); };
      } catch (e) { rej(e); }
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }
  function txDone(tx, res, rej) { tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error || new Error("Could not save.")); }; tx.onabort = function () { rej(tx.error || new Error("Saving was stopped, perhaps because the disk is full.")); }; }
  function rawGet(key) { return idb().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction("kv"), q = tx.objectStore("kv").get(key); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { rej(q.error); }; tx.onabort = function () { rej(tx.error || new Error("Could not read.")); }; }); }); }
  function rawPut(key, file) { return idb().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(file, key); txDone(tx, res, rej); }); }); }
  // Highest generation this browser has saved or opened for a book: a lower one later means an older copy was put back.
  function getHigh(id) { return rawGet("hw:" + id).then(function (n) { return typeof n === "number" ? n : 0; }, function () { return 0; }); }
  // setHigh replaces the mark (a backup restored on purpose, or the warning dismissed); raiseHigh only ever moves it up,
  // so saving on top of an older copy does not quietly erase the evidence that an older copy was put back.
  function setHigh(id, gen) { return rawPut("hw:" + id, gen || 0).catch(function () { return null; }); }
  function raiseHigh(id, gen) { return getHigh(id).then(function (hw) { return (gen || 0) > hw ? setHigh(id, gen) : null; }); }
  function same(a, b) {
    if (!a || !b || !a.parts || !b.parts || JSON.stringify(a.users) !== JSON.stringify(b.users)) return false;
    var ka = Object.keys(a.parts).sort(), kb = Object.keys(b.parts).sort();
    return ka.join() === kb.join() && ka.every(function (k) { return a.parts[k].iv === b.parts[k].iv && a.parts[k].ct === b.parts[k].ct; });
  }
  function storePut(file) {
    return rawGet(KEY).then(function (prev) {
      return prev && !K.validateFile(prev) && !same(prev, file) ? rawPut(BAK, prev) : null;
    }).then(function () { return rawPut(KEY, file); }).then(function () { return rawGet(KEY); }).then(function (back) {
      if (!same(back, file)) throw new Error("The saved copy did not read back correctly.");
    });
  }
  // Resolves the stored book, the last good copy if the main one is unreadable, { corrupt, raw } if neither is, or null.
  function storeGet() {
    return rawGet(KEY).then(function (main) {
      if (main && !K.validateFile(main)) return main;
      return rawGet(BAK).then(function (bak) { return bak && !K.validateFile(bak) ? bak : main ? { corrupt: true, raw: main } : null; });
    });
  }
  function storeGetBak() { return rawGet(BAK).then(function (b) { return b && !K.validateFile(b) ? b : null; }); }
  function storeClear() { return idb().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").clear(); txDone(tx, res, rej); }); }); }

  /* ---- live backup file: every save is also written to one file the user chose (File System Access API) ----
     Only the encrypted book is written, exactly like a backup. Feature-detected: browsers or embeds without the API keep
     the manual backup button. The file handle stays in this browser's storage; no path is ever read or shown by us. */
  var mirror = { handle: null, state: "off", pending: null, busy: false, onstate: null, err: "" };
  function mirrorSupported(w) { w = w || root; return typeof w.showSaveFilePicker === "function"; }
  function mirrorSet(st, err) { mirror.state = st; mirror.err = err || ""; if (mirror.onstate) mirror.onstate(st, mirror.err); }
  function mirrorKey(id) { return "mirror:" + id; }
  function mirrorChoose(bookId, suggested, w) {
    w = w || root;
    if (!mirrorSupported(w)) return Promise.reject(new Error("This browser cannot keep a live file. Use Save a backup file instead."));
    return w.showSaveFilePicker({ suggestedName: suggested, types: [{ description: "Stark Fellowship encrypted book", accept: { "application/json": [".starkfellowship"] } }] })
      .then(function (hd) { mirror.handle = hd; mirrorSet("ready"); return rawPut(mirrorKey(bookId), hd).catch(function () { return null; }).then(function () { return hd; }); },
        function (e) { if (e && e.name === "AbortError") return null; throw new Error(e && e.name === "SecurityError" ? "This page is not allowed to choose files here (for example inside an embedded player). Use the downloaded version." : "Could not choose a file."); });
  }
  // Called on sign-in: finds the remembered file. Returns "ready", "needs-permission" (a click must reconnect) or "off".
  function mirrorRestore(bookId) {
    return rawGet(mirrorKey(bookId)).then(function (hd) {
      if (!hd || typeof hd.createWritable !== "function") { mirror.handle = null; mirrorSet("off"); return "off"; }
      mirror.handle = hd;
      return (hd.queryPermission ? hd.queryPermission({ mode: "readwrite" }) : Promise.resolve("granted")).then(function (p) { var st = p === "granted" ? "ready" : "needs-permission"; mirrorSet(st); return st; });
    }, function () { mirrorSet("off"); return "off"; });
  }
  function mirrorReconnect() {
    var hd = mirror.handle;
    if (!hd) return Promise.resolve("off");
    return (hd.requestPermission ? hd.requestPermission({ mode: "readwrite" }) : Promise.resolve("granted")).then(function (p) { var st = p === "granted" ? "ready" : "needs-permission"; mirrorSet(st); return st; });
  }
  function mirrorStop(bookId) { mirror.handle = null; mirror.pending = null; mirrorSet("off"); return rawPut(mirrorKey(bookId), null).catch(function () { return null; }); }
  // Writes the newest text; while a write is running only the latest waiting copy is kept (no queue build-up).
  function mirrorWrite(text) {
    if (!mirror.handle || mirror.state === "needs-permission") return Promise.resolve(false);
    mirror.pending = text;
    if (mirror.busy) return Promise.resolve(true);
    mirror.busy = true;
    function next() {
      var t = mirror.pending, w; mirror.pending = null;
      if (t == null || !mirror.handle) { mirror.busy = false; return Promise.resolve(true); }
      return mirror.handle.createWritable().then(function (ws) { w = ws; return w.write(t); }).then(function () { return w.close(); })
        .then(function () { mirrorSet("ready"); return next(); }, function (e) {
          mirror.busy = false; mirror.pending = null;
          mirrorSet(e && e.name === "NotAllowedError" ? "needs-permission" : "failed", e && e.message);
          return false;
        });
    }
    return next();
  }

  root.FellowUI = { h: h, $: $, clear: clear, btn: btn, select: select, toast: toast, wireToasts: wireToasts, modal: modal, closeAllDialogs: closeAllDialogs, confirmBox: confirmBox, openForm: openForm,
    errBox: errBox, fieldError: fieldError, markField: markField,
    passField: passField, downloadText: downloadText, pickFile: pickFile, printDoc: printDoc, storeGet: storeGet, storeGetBak: storeGetBak, storePut: storePut, storeClear: storeClear,
    getHigh: getHigh, setHigh: setHigh, raiseHigh: raiseHigh,
    mirror: mirror, mirrorSupported: mirrorSupported, mirrorChoose: mirrorChoose, mirrorRestore: mirrorRestore, mirrorReconnect: mirrorReconnect, mirrorStop: mirrorStop, mirrorWrite: mirrorWrite };
})(globalThis);
