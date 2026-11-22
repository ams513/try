/* Stark Family Vault: UI helpers (DOM builder, dialogs, forms, files, local storage). Everything is built with textContent, never as parsed markup. */
(function (root) {
  "use strict";
  var V = root.StarkVault;

  function h(tag, props) {
    var el = document.createElement(tag), i, k, kids = Array.prototype.slice.call(arguments, 2);
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

  // Successes are announced politely and fade after 4 s. Problems are announced as alerts, stay 10 s (or until dismissed),
  // and never hide while the pointer or keyboard focus is on the message.
  var toastTimer, toastHold = false, toastWired = false;
  function toastHide() { var t = $("#toast"); if (toastHold) { toastTimer = setTimeout(toastHide, 1000); return; } t.hidden = true; }
  function toast(msg, bad) {
    var t = $("#toast"), m = $("#toast-msg") || t, x = $("#toast-x");
    if (!toastWired && x) {
      toastWired = true;
      x.addEventListener("click", function () { clearTimeout(toastTimer); toastHold = false; t.hidden = true; });
      ["mouseenter", "focusin"].forEach(function (ev) { t.addEventListener(ev, function () { toastHold = true; }); });
      ["mouseleave", "focusout"].forEach(function (ev) { t.addEventListener(ev, function () { toastHold = false; }); });
    }
    t.setAttribute("role", bad ? "alert" : "status"); t.setAttribute("aria-live", bad ? "assertive" : "polite");
    m.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(toastHide, bad ? 10000 : 4000);
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
      var body = h("div", { class: "dlg-body" }, h("p", { text: text }),
        h("div", { class: "row end" },
          h("button", { type: "button", class: "btn", text: "Cancel", onclick: function () { dlg.close(); } }),
          h("button", { type: "button", class: "btn " + (danger ? "danger" : "primary"), text: okLabel || "OK", onclick: function () { done = true; dlg.close(); } })));
      dlg = modal(title, body, { onclose: function () { resolve(done); } });
    });
  }

  /* ---- generic form ---- */
  function fieldEl(f, val, ctx) {
    var id = "f-" + f.k, input, wrap, help;
    if (f.type === "textarea") input = h("textarea", { id: id, rows: f.rows || 3, maxlength: f.max || 4000, placeholder: f.ph || "", text: val || "" });
    else if (f.type === "select") input = h("select", { id: id }, (f.options || []).map(function (o) {
      var ov = typeof o === "string" ? o : o.v, ol = typeof o === "string" ? (o || "Choose...") : o.l;
      return h("option", { value: ov, text: ol, selected: ov === val });
    }));
    else if (f.type === "checkbox") input = h("input", { id: id, type: "checkbox", checked: !!val });
    else if (f.type === "scan" || f.type === "photo") {
      var status = h("span", { class: "fine", text: val ? "Saved: " + (val.name || "photo") + ". Choose a file to replace it." : "None yet." });
      input = h("div", { class: "filebox" }, h("input", { id: id, type: "file", accept: f.type === "photo" ? "image/*" : "image/*,application/pdf",
        onchange: function (e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          status.textContent = "Reading " + file.name + "...";
          readScan(file, f.type === "photo").then(function (s) { ctx.files[f.k] = s; status.textContent = "Ready: " + s.name + " (" + Math.round(s.data.length * 0.75 / 1024) + " KB, encrypted when saved)"; })
            .catch(function (err) { e.target.value = ""; status.textContent = err.message; toast(err.message, true); });
        } }), status,
        val ? h("button", { type: "button", class: "btn small", text: "Remove", onclick: function () { ctx.files[f.k] = null; status.textContent = "Will be removed when you save."; } }) : null);
    } else input = h("input", { id: id, type: f.type || "text", value: val == null ? "" : val, maxlength: f.max || 200, placeholder: f.ph || "", min: f.min, step: f.step, inputmode: f.inputmode, autocomplete: "off" });
    help = f.help ? h("span", { class: "fine", id: id + "-help", text: f.help }) : null;
    if (help && f.type !== "scan" && f.type !== "photo") input.setAttribute("aria-describedby", id + "-help");
    wrap = h("div", { class: "field" + (f.type === "checkbox" ? " check" : "") + (f.wide ? " wide" : "") });
    if (f.type === "checkbox") wrap.appendChild(input);
    wrap.appendChild(h("label", { for: id, text: f.label + (f.req ? " *" : "") }));
    if (f.type !== "checkbox") wrap.appendChild(input);
    if (help) wrap.appendChild(help);
    if (f.warn) { var w = h("p", { class: "warn-text", hidden: true }); wrap.appendChild(w); input.addEventListener("input", function () { var fl = V.looksSensitive(input.value); w.hidden = !fl.length; w.textContent = fl.length ? "This contains " + fl.join(" and ") + ". Remove it: store only the last 4 digits and never passwords." : ""; }); }
    // Live advice that does not block saving (for example: "this hint looks like a real password").
    if (f.live) { var lw = h("p", { class: "warn-text live", hidden: true }), upd = function () { var m = f.live(input.value || ""); lw.hidden = !m; lw.textContent = m || ""; }; wrap.appendChild(lw); input.addEventListener("input", upd); upd(); }
    input.__field = f;
    return wrap;
  }
  // Field errors: the failing control gets aria-invalid and points at the error text with aria-describedby (help text kept).
  var formSeq = 0;
  function markField(el, errId) {
    if (!el || !el.setAttribute) return;
    var help = el.id && document.getElementById(el.id + "-help") ? el.id + "-help" : "";
    if (errId) { el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", (errId + " " + help).trim()); }
    else { el.removeAttribute("aria-invalid"); if (help) el.setAttribute("aria-describedby", help); else el.removeAttribute("aria-describedby"); }
  }
  function openForm(title, fields, values, onSave, extra) {
    values = values || {};
    var ctx = { files: {} }, form, err, dlg, errId = "form-err-" + (++formSeq);
    err = h("p", { class: "form-err", id: errId, role: "alert", hidden: true });
    form = h("form", { class: "form dlg-body", novalidate: true, autocomplete: "off" },
      h("div", { class: "grid2" }, fields.map(function (f) { return fieldEl(f, values[f.k], ctx); })), err, extra || null,
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Cancel", onclick: function () { dlg.close(); } }),
        h("button", { type: "submit", class: "btn primary", text: "Save" })));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = {}, bad = null, badEl = null;
      fields.forEach(function (f) {
        var el = $("#f-" + f.k, form), v, was = bad;
        if (f.type === "checkbox") v = el.checked;
        else if (f.type === "scan" || f.type === "photo") v = ctx.files.hasOwnProperty(f.k) ? ctx.files[f.k] : (values[f.k] || null);
        else v = el.value.trim();
        if (f.req && (v === "" || v == null)) bad = bad || f.label + " is required.";
        if (f.type === "date" && v && isNaN(V.dayNum(v))) bad = bad || f.label + " is not a valid date.";
        if (f.type === "number" && v !== "" && (isNaN(+v) || +v < 0)) bad = bad || f.label + " must be a positive number.";
        if (f.warn) { var fl = V.looksSensitive(v); if (fl.length) bad = bad || "Not saved: " + f.label + " contains " + fl.join(" and ") + ". Store only the last 4 digits and never passwords."; }
        markField(el, !was && bad ? errId : null);
        if (!was && bad) badEl = el;
        out[f.k] = v;
      });
      if (bad) { err.textContent = bad; err.hidden = false; if (badEl && badEl.focus) badEl.focus(); return; }
      Promise.resolve(onSave(out)).then(function (keepOpen) { if (keepOpen !== false) dlg.close(); });
    });
    dlg = modal(title, form, { wide: true });
    var first = form.querySelector("input:not([type=file]),select,textarea"); if (first) first.focus();
    return dlg;
  }

  /* ---- scans and photos: images are shrunk, PDFs kept as they are ---- */
  var MAX_PDF = 4 * 1024 * 1024;
  function readAsDataURL(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error("Could not read that file.")); }; r.readAsDataURL(file); });
  }
  function readScan(file, photoOnly) {
    if (file.type === "application/pdf") {
      if (photoOnly) return Promise.reject(new Error("Please choose a picture."));
      if (file.size > MAX_PDF) return Promise.reject(new Error("That PDF is over 4 MB. Save a smaller copy and try again."));
      return readAsDataURL(file).then(function (d) { return { name: file.name, mime: "application/pdf", data: d }; });
    }
    if (!/^image\/(png|jpe?g|webp|gif|bmp)$/.test(file.type)) return Promise.reject(new Error("Choose a picture (JPG, PNG, WebP) or a PDF."));
    return readAsDataURL(file).then(function (url) {
      return new Promise(function (res) {
        var img = new Image();
        img.onload = function () {
          var max = photoOnly ? 1000 : 1800, s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
          try {
            var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
            res({ name: file.name.replace(/\.\w+$/, "") + ".jpg", mime: "image/jpeg", data: c.toDataURL("image/jpeg", photoOnly ? 0.78 : 0.85) });
          } catch (e) { res({ name: file.name, mime: file.type, data: url }); }
        };
        img.onerror = function () { res({ name: file.name, mime: file.type, data: url }); };
        img.src = url;
      });
    });
  }
  function dataToBlobUrl(s) {
    var m = /^data:([^;]+);base64,(.*)$/.exec(s.data || ""), type; if (!m) return null;
    type = /^(image\/(png|jpe?g|webp|gif|bmp)|application\/pdf)$/.test(m[1]) ? m[1] : "application/octet-stream";   // never a type the browser would run
    try { return URL.createObjectURL(new Blob([V.unb64(m[2])], { type: type })); } catch (e) { return null; }
  }
  function downloadText(name, text, mime) {
    var url = URL.createObjectURL(new Blob([text], { type: mime || "application/octet-stream" })), a = h("a", { href: url, download: name });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function downloadScan(s) {
    var url = dataToBlobUrl(s); if (!url) return;
    var a = h("a", { href: url, download: s.name || "scan" }); document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function viewScan(s, title) {
    var body = h("div", { class: "dlg-body scanview" });
    if (/^image\//.test(s.mime)) body.appendChild(h("img", { src: s.data, alt: title + " scan" }));
    else body.appendChild(h("p", { text: "This scan is a PDF. Browsers will not show PDFs from inside an encrypted page, so save a copy to view it. Delete the saved copy afterwards, because it is no longer encrypted." }));
    body.appendChild(h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Save a copy", onclick: function () { downloadScan(s); } })));
    modal(title, body, { wide: true });
  }

  /* ---- passphrase field with strength meter ---- */
  function passField(id, label, onChange) {
    var inp = h("input", { id: id, type: "password", autocomplete: "new-password", maxlength: 200 }), bar = h("span", { class: "sbar-fill" }), lab = h("span", { class: "sbar-label", text: "Enter a passphrase" }), notes = h("span", { class: "fine" });
    var show = h("button", { type: "button", class: "btn small", text: "Show", onclick: function () { inp.type = inp.type === "password" ? "text" : "password"; show.textContent = inp.type === "password" ? "Show" : "Hide"; } });
    function upd() {
      var s = V.strength(inp.value);
      bar.className = "sbar-fill s" + s.score; bar.style.width = (inp.value ? 10 + s.score * 22.5 : 0) + "%";
      lab.textContent = inp.value ? s.label + " (about " + s.bits + " bits)" : "Enter a passphrase";
      notes.textContent = inp.value && s.notes.length ? "Weakened by: " + s.notes.join(", ") + "." : "";
      guess.textContent = inp.value ? "Rough average for one high-end graphics card to guess it: " + V.guessTable(s.bits, V.KDF_ITER)[1].text + "." : "";
      if (onChange) onChange(s);
    }
    var guess = h("span", { class: "fine guess" });
    inp.addEventListener("input", upd);
    inp.setAttribute("aria-describedby", id + "-meter");
    return { input: inp, el: h("div", { class: "field wide" }, h("label", { for: id, text: label }), h("div", { class: "row tight" }, inp, show),
      h("div", { class: "sbar", role: "img", "aria-label": "Passphrase strength" }, bar), h("span", { id: id + "-meter", class: "meter-text" }, lab, " ", notes, " ", guess)) };
  }

  /* ---- storage: the encrypted file only ----
     IndexedDB is the store. localStorage is used only when IndexedDB cannot be opened at all (some private windows);
     a failed IndexedDB write is reported as a failed save, never silently redirected, so two copies cannot drift apart.
     One cached connection, closed when another tab upgrades the database. */
  var DB = "stark_vault", KEY = "vault", BAK = ".bak", HW = "hw", dbP = null;
  function idb() {
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
        r.onsuccess = function () { var db = r.result; db.onversionchange = function () { db.close(); dbP = null; }; db.onclose = function () { dbP = null; }; res(db); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
    dbP.catch(function () { dbP = null; });
    return dbP;
  }
  function lsName(key) { return key === KEY ? DB : key === KEY + BAK ? DB + BAK : DB + "." + key; }
  function lsGet(key) { try { var t = localStorage.getItem(lsName(key)); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function lsPut(key, val) { try { localStorage.setItem(lsName(key), JSON.stringify(val)); } catch (e) { throw new Error("This browser's storage is full or turned off, so the vault could not be saved."); } }
  function lsDel(key) { try { localStorage.removeItem(lsName(key)); } catch (e) { /* ignore */ } }
  function tx(db, mode, fn) {
    return new Promise(function (res, rej) {
      var t, q;
      try { t = db.transaction("kv", mode); q = fn(t.objectStore("kv")); } catch (e) { dbP = null; return rej(e); }
      t.oncomplete = function () { res(q && mode === "readonly" ? q.result : undefined); };
      t.onerror = function () { rej(t.error || new Error("The browser refused to save.")); };
      t.onabort = function () { rej(t.error || new Error("The browser stopped the save (storage may be full).")); };
    });
  }
  function rawGet(key) {
    return idb().then(function (db) { return tx(db, "readonly", function (s) { return s.get(key); }).then(function (v) { return v || null; }, function () { return lsGet(key); }); },
      function () { return lsGet(key); });
  }
  function rawPut(key, val) {
    return idb().then(function (db) { return tx(db, "readwrite", function (s) { return s.put(val, key); }).then(function () { lsDel(key); }); },
      function () { lsPut(key, val); });
  }
  function sameEnv(a, b) { return !!a && !!b && a.ct === b.ct && a.iv === b.iv && a.salt === b.salt && a.iter === b.iter && a.sum === b.sum && (a.n || 0) === (b.n || 0); }
  function valid(e) { return e && !e.corrupt && !V.validateEnvelope(e) ? e : null; }
  function newer(a, b) { a = valid(a); b = valid(b); return !a ? b : !b ? a : (b.n || 0) > (a.n || 0) ? b : a; }
  // Highest save counter ever written on this computer (not secret). A lower one on unlock means storage was rolled back.
  function storeHigh() {
    return rawGet(HW).then(function (n) { var l = +lsGet(HW) || 0; return Math.max(typeof n === "number" ? n : 0, l); });
  }
  function markHigh(n) {
    if (!n) return Promise.resolve();
    // IndexedDB first: rawPut removes the localStorage copy of a key it wrote, so the second copy is written after it.
    return storeHigh().then(function (hw) { if (n <= hw) return; return rawPut(HW, n).catch(function () { return null; }).then(function () { try { localStorage.setItem(lsName(HW), String(n)); } catch (e) { /* best effort */ } }); });
  }
  // Crash-safe storage: keep the last good copy under KEY + ".bak", write, read back and compare.
  function storePut(env) {
    return rawGet(KEY).then(function (prev) {
      var keep = valid(prev) && !sameEnv(prev, env) ? rawPut(KEY + BAK, prev) : Promise.resolve();
      return keep.then(function () { return rawPut(KEY, env); });
    }).then(function () { return rawGet(KEY); }).then(function (back) {
      if (!sameEnv(back, env)) throw new Error("The saved copy did not read back correctly.");
      return markHigh(env.n);
    });
  }
  // Resolves the newest usable envelope (IndexedDB or an older localStorage copy, by save counter); falls back to the
  // last good copy when the main one is unreadable. If nothing is usable but something is stored, resolves { corrupt: true, raw }.
  function storeGet() {
    return rawGet(KEY).then(function (main) {
      var best = newer(main, lsGet(KEY));
      if (best) return best;
      return rawGet(KEY + BAK).then(function (bak) {
        if (valid(bak)) return bak;
        return main ? { corrupt: true, raw: main } : null;
      });
    });
  }
  function storeGetBak() { return rawGet(KEY + BAK).then(valid); }
  function storeClear() {
    [KEY, KEY + BAK, HW, "mirror"].forEach(lsDel);
    return idb().then(function (db) { return tx(db, "readwrite", function (s) { [KEY, KEY + BAK, HW, "mirror"].forEach(function (k) { s.delete(k); }); }); }).catch(function () { return null; });
  }
  // Small non-vault records (the mirror file handle). IndexedDB only: a file handle cannot live in localStorage.
  function kvGet(key) { return idb().then(function (db) { return tx(db, "readonly", function (s) { return s.get(key); }); }).then(function (v) { return v || null; }, function () { return null; }); }
  function kvPut(key, val) { return idb().then(function (db) { return tx(db, "readwrite", function (s) { return val == null ? s.delete(key) : s.put(val, key); }); }); }
  function pickFile() {
    return new Promise(function (res) {
      var inp = h("input", { type: "file", accept: ".starkvault,.json,application/json", class: "sr-only" });
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0]; if (inp.parentNode) inp.parentNode.removeChild(inp);
        if (!f) return res(null);
        if (f.size > 220 * 1024 * 1024) return res({ name: f.name, env: null });
        var r = new FileReader(); r.onload = function () { try { res({ name: f.name, env: JSON.parse(r.result) }); } catch (e) { res({ name: f.name, env: null }); } }; r.readAsText(f);
      });
      document.body.appendChild(inp); inp.click();
    });
  }

  root.VaultUI = { h: h, $: $, clear: clear, toast: toast, modal: modal, closeAllDialogs: closeAllDialogs, confirmBox: confirmBox, openForm: openForm,
    viewScan: viewScan, downloadText: downloadText, downloadScan: downloadScan, passField: passField, storeGet: storeGet, storeGetBak: storeGetBak, storePut: storePut, storeClear: storeClear, pickFile: pickFile,
    storeHigh: storeHigh, kvGet: kvGet, kvPut: kvPut, markField: markField };
})(globalThis);
