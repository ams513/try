/* Stark Caregiver, by Stark: UI helpers (DOM builder, dialogs, forms, files, local storage). Everything is built with textContent, never as parsed markup. */
(function (root) {
  "use strict";
  var V = root.CareCore;

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

  // Good news is polite and short. Problems are announced at once (role=alert), stay at least 9 seconds, wait while the
  // pointer or focus is on them, and have a close button, so nobody misses a failed save.
  var toastTimer;
  function toast(msg, bad) {
    var t = $(bad ? "#toast-alert" : "#toast"), other = $(bad ? "#toast" : "#toast-alert");
    if (!t) return;
    if (other) other.hidden = true;
    clear(t);
    t.appendChild(h("span", { text: msg }));
    if (bad) t.appendChild(h("button", { type: "button", class: "toast-x", "aria-label": "Dismiss this message", text: "×", onclick: function () { t.hidden = true; } }));
    t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
    clearTimeout(toastTimer);
    (function arm(ms) {
      toastTimer = setTimeout(function () {
        var held = false; try { held = t.matches(":hover") || t.contains(document.activeElement); } catch (e) { held = false; }
        if (held) arm(1500); else t.hidden = true;
      }, ms);
    })(bad ? 9000 : 4000);
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
    // Hint and error are linked to the control, so a screen reader reads them with the field.
    var ferr = h("span", { class: "field-err", id: id + "-err", hidden: true });
    if (f.type !== "scan" && f.type !== "photo") input.setAttribute("aria-describedby", (help ? id + "-help " : "") + id + "-err");
    wrap = h("div", { class: "field" + (f.type === "checkbox" ? " check" : "") + (f.wide ? " wide" : "") });
    if (f.type === "checkbox") wrap.appendChild(input);
    wrap.appendChild(h("label", { for: id, text: f.label + (f.req ? " *" : "") }));
    if (f.type !== "checkbox") wrap.appendChild(input);
    if (help) wrap.appendChild(help);
    wrap.appendChild(ferr);
    if (f.warn) { var w = h("p", { class: "warn-text", hidden: true }); wrap.appendChild(w); input.addEventListener("input", function () { var fl = V.looksSensitive(input.value); w.hidden = !fl.length; w.textContent = fl.length ? "This contains " + fl.join(" and ") + ". Remove it: store only the last 4 digits and never passwords." : ""; }); }
    // Live advice that does not block saving (for example: "this hint looks like a real password").
    if (f.live) { var lw = h("p", { class: "warn-text live", hidden: true }), upd = function () { var m = f.live(input.value || ""); lw.hidden = !m; lw.textContent = m || ""; }; wrap.appendChild(lw); input.addEventListener("input", upd); upd(); }
    input.__field = f;
    return wrap;
  }
  // Marks one control invalid (or clears it when msg is empty) and fills its linked error text.
  function fieldError(input, msg) {
    if (!input) return;
    var e = input.id ? document.getElementById(input.id + "-err") : null;
    if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    if (e) { e.textContent = msg || ""; e.hidden = !msg; }
  }
  function openForm(title, fields, values, onSave, extra) {
    values = values || {};
    var ctx = { files: {} }, form, err, dlg;
    err = h("p", { class: "form-err", role: "alert", hidden: true });
    form = h("form", { class: "form dlg-body", novalidate: true, autocomplete: "off" },
      h("div", { class: "grid2" }, fields.map(function (f) { return fieldEl(f, values[f.k], ctx); })), err, extra || null,
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Cancel", onclick: function () { dlg.close(); } }),
        h("button", { type: "submit", class: "btn primary", text: "Save" })));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = {}, bad = null, firstBad = null;
      fields.forEach(function (f) {
        var el = $("#f-" + f.k, form), v, was = bad;
        if (f.type === "checkbox") v = el.checked;
        else if (f.type === "scan" || f.type === "photo") v = ctx.files.hasOwnProperty(f.k) ? ctx.files[f.k] : (values[f.k] || null);
        else v = el.value.trim();
        if (f.req && (v === "" || v == null)) bad = bad || f.label + " is required.";
        if (f.type === "date" && v && isNaN(V.dayNum(v))) bad = bad || f.label + " is not a valid date.";
        if (f.type === "number" && v !== "" && (isNaN(+v) || +v < 0)) bad = bad || f.label + " must be a positive number.";
        if (f.warn) { var fl = V.looksSensitive(v); if (fl.length) bad = bad || "Not saved: " + f.label + " contains " + fl.join(" and ") + ". Store only the last 4 digits and never passwords."; }
        out[f.k] = v;
        fieldError(el, bad !== was ? bad : "");
        if (bad !== was && !firstBad) firstBad = el;
      });
      if (bad) { err.textContent = bad; err.hidden = false; if (firstBad && firstBad.focus) firstBad.focus(); return; }
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
  // Only types the app itself stores. Anything else (text/html, image/svg+xml...) is saved as plain bytes, so it can never run as a page.
  function safeMime(t) { return /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(String(t || "").toLowerCase()) ? String(t).toLowerCase() : "application/octet-stream"; }
  function dataToBlobUrl(s) {
    var m = /^data:([^;]+);base64,(.*)$/.exec(s.data || ""); if (!m) return null;
    return URL.createObjectURL(new Blob([V.unb64(m[2])], { type: safeMime(m[1]) }));
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
    if (/^image\/(png|jpeg|webp|gif)$/.test(s.mime) && /^data:image\/(png|jpeg|webp|gif);base64,/.test(s.data || "")) body.appendChild(h("img", { src: s.data, alt: title + " scan" }));
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
      if (onChange) onChange(s);
    }
    inp.addEventListener("input", upd);
    return { input: inp, el: h("div", { class: "field wide" }, h("label", { for: id, text: label }), h("div", { class: "row tight" }, inp, show),
      h("div", { class: "sbar", role: "img", "aria-label": "Passphrase strength" }, bar), lab, notes) };
  }

  /* ---- storage: the encrypted file only (see store.js: one backend, queued writes, read-back check, last good copy) ---- */
  var DB = "stark_caregiver", KEY = "vault";
  var ST = root.CareStore.make({ indexedDB: root.indexedDB, localStorage: (function () { try { return root.localStorage; } catch (e) { return null; } })(),
    db: DB, key: KEY, validate: V.validateEnvelope });
  var MIRROR = root.CareStore.mirror({ onError: function (e) { toast("The live backup file could not be written: " + (e && e.message || e) + ". Your record is still saved in this browser.", true); } });
  function storePut(env) { return ST.put(env).then(function () { if (MIRROR.handle()) MIRROR.write(env); }); }
  function pickFile() {
    return new Promise(function (res) {
      var inp = h("input", { type: "file", accept: ".starkcare,.json,application/json", class: "sr-only" });
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0]; if (inp.parentNode) inp.parentNode.removeChild(inp);
        if (!f) return res(null);
        if (f.size > 220 * 1024 * 1024) return res({ name: f.name, env: null });
        var r = new FileReader(); r.onload = function () { try { res({ name: f.name, env: JSON.parse(r.result) }); } catch (e) { res({ name: f.name, env: null }); } }; r.readAsText(f);
      });
      document.body.appendChild(inp); inp.click();
    });
  }

  root.CareUI = { h: h, $: $, clear: clear, toast: toast, modal: modal, closeAllDialogs: closeAllDialogs, confirmBox: confirmBox, openForm: openForm,
    viewScan: viewScan, downloadText: downloadText, downloadScan: downloadScan, passField: passField, storeGet: ST.get, storeGetBak: ST.getBak, storePut: storePut, storeClear: function () { MIRROR.stop(); return ST.clear(); }, highSeq: ST.highSeq, seqOf: ST.seqOf, store: ST, mirror: MIRROR, pickFile: pickFile, fieldError: fieldError };
})(globalThis);
