/* Stark Baseline, by Stark: app flow, shell, Home, Settings and Sources. Offline; only encrypted envelopes are ever stored. */
(function () {
  "use strict";
  var V = StarkBaseline, C = BaselineContent, L = BaselineLogic, U = BaselineUI, h = U.h, $ = U.$;
  var S = { d: null, session: null, ws: null, wsLabel: "", route: "home", last: 0, saveTimer: null, saving: Promise.resolve(), seq: 0 };
  var NAV = [["home", "Home"], ["inventory", "Inventory"], ["checklist", "Checklist"], ["plan", "Path to green"], ["map", "Exposure map"], ["risks", "Risks"], ["evidence", "Evidence"], ["runbook", "Runbook"],
    ["drills", "Drills"], ["staff", "Staff lessons"], ["hipaa", "HIPAA evidence"], ["ukce", "UK Cyber Essentials"], ["sources", "Sources"], ["settings", "Settings"]];
  var A = window.BaselineApp = { views: {}, S: S, NAV: NAV, full: function () { return false; }, room: function () { return Infinity; }, afterRender: null };   // full/room/afterRender: hooks the Free trial build overrides

  /* ---------- helpers shared with views.js and views2.js ---------- */
  function today() { return V.todayStr(); }
  function btn(text, cls, fn) { return h("button", { type: "button", class: "btn " + (cls || ""), text: text, onclick: fn }); }
  function section(title, sub, actions) {
    return h("div", { class: "sec-head" }, h("div", null, h("h1", { text: title }), sub ? h("p", { class: "muted", text: sub }) : null), h("div", { class: "row" }, actions || []));
  }
  function empty(text, cta) { return h("div", { class: "empty" }, h("p", { text: text }), cta || null); }
  function badge(text, cls) { return h("span", { class: "badge " + (cls || ""), text: text }); }
  function kv(k, v) { return v ? h("div", { class: "kv" }, h("dt", { text: k }), h("dd", { text: String(v) })) : null; }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function upsert(list, item) { var i = list.indexOf(byId(list, item.id)); if (i < 0) { if (A.full(list)) return false; list.push(item); } else list[i] = item; return true; }
  function covenant() { return S.d && S.d.org.preset === "covenant"; }
  function sensLabel() { return covenant() ? "Holds patient data (ePHI)?" : "Holds sensitive data?"; }
  function stamp() { return today(); }
  // Every write goes through one chain, so a timer save and a flush never interleave. Each save carries the next save number.
  function persist() {
    S.saving = S.saving.catch(function () { return null; }).then(function () {
      if (!S.d) return null;
      var ws = S.ws, seq = S.seq + 1;
      return V.seal(S.session, S.d, "baseline", null, seq).then(function (env) { return U.storePut(ws, env); }).then(function () {
        if (S.ws !== ws) return;
        S.seq = seq; $("#save-state").textContent = "Saved, encrypted"; $("#save-state").classList.remove("bad");
        if (A.autosave) A.autosave.changed();
      });
    });
    return S.saving;
  }
  function saveFailed(x) {
    var st = $("#save-state");
    st.textContent = "Not saved"; st.classList.add("bad");
    U.toast("Could not save: " + ((x && x.message) || "storage failed.") + " Your changes are still on screen. Save a backup file from Settings.", true);
  }
  function save() {
    if (!S.d) return;
    $("#save-state").textContent = "Saving...";
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(function () { persist().catch(saveFailed); }, 300);
  }
  function flush() {
    clearTimeout(S.saveTimer);
    if (!S.d) return S.saving.catch(function () { return null; });
    return persist().catch(function (x) { saveFailed(x); throw x; });
  }
  function del(list, item, what, after) {
    return U.confirmBox("Delete " + (what || "this") + "?", "This removes it from this organisation's records. It cannot be undone, except from a backup file.", "Delete", true).then(function (ok) {
      if (!ok) return false;
      list.splice(list.indexOf(item), 1); if (after) after(item); save(); render(); return true;
    });
  }
  function rowActions(item, list, edit, what) {
    return h("div", { class: "row tight" }, btn("Edit", "small", function () { edit(item); }), btn("Delete", "small danger-o", function () { del(list, item, what); }));
  }
  function printNode(node) {
    var pr = U.clear($("#print-root")); pr.appendChild(node); document.body.classList.add("printing");
    var after = function () { document.body.classList.remove("printing"); U.clear($("#print-root")); window.removeEventListener("afterprint", after); };
    window.addEventListener("afterprint", after); setTimeout(function () { window.print(); }, 50);
  }
  function printHead(title) {
    return [h("h1", { text: title }), h("p", { class: "meta", text: S.d.org.name + ". Printed " + today() + " from Stark Baseline." }), S.d.example ? h("p", { class: "notice", text: "Example data: a made-up organisation for illustration." }) : null,
      h("p", { class: "notice", text: "Helps you organise and track your security work. " + L.NOT_ADVICE + " This printout is not encrypted: keep it somewhere safe." })];
  }
  function go(route) { if (location.hash === "#/" + route) render(); else location.hash = "#/" + route; }

  /* ---------- lock screen and workspaces ---------- */
  function lockScreen() {
    var main = U.clear($("#main")), box = h("div", { class: "lock card" });
    document.body.classList.add("locked");
    $("#topbar-tools").hidden = true; $("#nav").hidden = true;
    main.appendChild(box);
    U.workspaces().then(function (list) {
      if (!list.length) return createView(box, true);
      if (list.length === 1) return openWs(box, list[0], list);
      chooser(box, list);
    });
  }
  function chooser(box, list) {
    U.clear(box).appendChild(h("div", null, h("h1", { text: "Choose an organisation" }),
      h("p", { class: "muted", text: "Each organisation has its own passphrase and its own encrypted records on this computer." }),
      h("ul", { class: "wslist" }, list.map(function (w) { return h("li", null, h("span", null, h("b", { text: w.label }), h("span", { class: "fine", text: " added " + w.created })), btn("Open", "primary small", function () { openWs(box, w, list); })); })),
      otherOptions(box, null)));
  }
  function openWs(box, w, list) {
    U.storeGet(w.id).then(function (env) {
      if (!env) return createView(box, false, w);
      if (env.corrupt) return safeView(box, w, env.raw, "The stored records could not be read and there is no earlier copy.");
      unlockView(box, w, env, list);
    });
  }
  function honest() {
    return h("div", { class: "honest" }, h("strong", { text: "Please read this once. " }),
      "Your records are locked with a key made from your passphrase. The passphrase is never saved. There is no reset, no recovery email and no back door. If the passphrase is lost, the data is gone for good. Keep it in your password manager and give a sealed copy to a second trusted person, such as your deputy.");
  }
  function createView(box, first, existing) {
    var strong = null, err = h("p", { class: "form-err", role: "alert", hidden: true }), ack = h("input", { id: "ack", type: "checkbox" }),
      name = h("input", { id: "orgname", type: "text", maxlength: 60, placeholder: "For example: Riverside Clinic, or Client A", autocomplete: "off", value: existing ? existing.label : "" }),
      p1 = U.passField("pass1", "Choose a passphrase", function (s) { strong = s; }), p2 = h("input", { id: "pass2", type: "password", autocomplete: "new-password", maxlength: 200 });
    U.clear(box).appendChild(h("div", null,
      h("h1", { text: first ? "Set up Stark Baseline" : "Add an organisation" }),
      h("p", { class: "muted", text: "Everything is encrypted on this computer with AES-256-GCM. Nothing is sent anywhere." }),
      honest(),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var pw = p1.input.value, nm = name.value.trim(), b = e.target.querySelector("button[type=submit]");
        var fail = function (ctrl, text) { err.textContent = text; U.markInvalid(ctrl, err); };
        err.hidden = false; U.clearInvalid(e.target);
        if (!nm) return fail(name, "Type a name for this organisation.");
        if (pw.length < 12) return fail(p1.input, "Use at least 12 characters. Four or more random words work well.");
        if (!strong || strong.score < 2) return fail(p1.input, "That passphrase is too easy to guess. Try four or more unrelated words.");
        if (pw !== p2.value) return fail(p2, "The two passphrases do not match.");
        if (!ack.checked) return fail(ack, "Please tick the box to confirm you understand.");
        err.textContent = "Working... this takes about a second on purpose, to slow down guessing."; b.disabled = true;
        var ws = existing ? existing.id : V.uid();
        V.newSession(pw).then(function (sess) {
          var d = V.emptyData(nm); S.d = d; S.session = sess; S.ws = ws; S.wsLabel = nm; S.seq = 0;
          return U.seqGet(ws).then(function (hw) { S.seq = hw; return persist(); }).then(function () { return U.addWorkspace(ws, nm); });
        }).then(function () { p1.input.value = p2.value = ""; enter(); }, function (x) { S.d = null; b.disabled = false; err.textContent = "Could not create the records: " + x.message; });
      } },
        h("div", { class: "field wide" }, h("label", { for: "orgname", text: "Organisation name (shown on this screen)" }), name,
          h("span", { class: "fine", text: "This name is stored without encryption so you can pick it here. Use a code name if you prefer. Everything you add later is encrypted." })),
        p1.el,
        h("div", { class: "field wide" }, h("label", { for: "pass2", text: "Type it again" }), p2),
        h("div", { class: "field check wide" }, ack, h("label", { for: "ack", text: "I understand that if this passphrase is lost, the data cannot be recovered by anyone." })),
        err, h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary big", text: first ? "Create encrypted records" : "Add organisation" }))),
      otherOptions(box, null)));
    name.focus();
  }
  function unlockView(box, w, env, list) {
    var pass = h("input", { id: "unlock-pass", type: "password", autocomplete: "current-password", maxlength: 200 }), err = h("p", { class: "form-err", role: "alert", hidden: true }), fails = 0;
    U.clear(box).appendChild(h("div", null,
      h("h1", { text: "Unlock " + w.label }),
      h("p", { class: "muted", text: "Enter the passphrase for this organisation. It is checked on this computer and never stored." }),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var b = e.target.querySelector("button[type=submit]"), pw = pass.value; b.disabled = true; err.hidden = false; err.textContent = "Unlocking..."; U.clearInvalid(e.target);
        var ok = function (r, note) {
          return U.seqGet(w.id).then(function (hw) {
            S.d = V.migrate(r.data); S.session = r.session; S.ws = w.id; S.wsLabel = w.label; S.seq = Math.max(r.seq || 0, hw); pass.value = "";
            enter();
            if (note) U.toast(note);
            else if ((r.seq || 0) < hw) U.toast(rollbackText(r.seq || 0, hw), true);
            if (r.upgrade) upgradeKey(pw);
            pw = "";
            startAutosave();
          });
        };
        V.openData(env, pw).then(function (r) { return ok(r); }).catch(function (x) {
          if (x.invalid) return safeView(box, w, env, x.message);
          return U.storeGetBak(w.id).then(function (bak) {
            if (!bak) throw x;
            return V.openData(bak, pw).then(function (r) { return U.storePut(w.id, bak).then(function () { return ok(r, "The latest copy was damaged, so the last good copy was restored."); }); });
          }).catch(function () { throw x; });
        }).catch(function (x) { fails++; b.disabled = false; err.textContent = x.message + (fails > 2 ? " Remember: there is no way to reset a lost passphrase." : ""); U.markInvalid(pass, err); pass.select(); });
      } },
        h("div", { class: "field wide" }, h("label", { for: "unlock-pass", text: "Passphrase" }), pass),
        err, h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary big", text: "Unlock" }), list && list.length > 1 ? btn("Choose another organisation", "ghost", function () { chooser(box, list); }) : null)),
      otherOptions(box, w)));
    pass.focus();
  }
  // Safe mode: stored data failed to read or validate. Nothing is overwritten; the raw encrypted data can be exported.
  function safeView(box, w, env, reason) {
    U.clear(box).appendChild(h("div", null, h("h1", { text: "Safe mode (read-only)" }),
      h("div", { class: "banner warn", role: "alert" }, h("strong", { text: "These records could not be opened normally. " }), reason + " Nothing has been changed or deleted. Save a copy of the raw encrypted data now, then restore from a backup file."),
      h("div", { class: "row" }, btn("Export raw data", "primary", function () { U.downloadText("stark-baseline-raw-" + stamp() + ".json", JSON.stringify(env), "application/json"); })),
      otherOptions(box, w)));
  }
  function otherOptions(box, w) {
    return h("details", { class: "other" }, h("summary", { text: "Other options" }),
      h("div", { class: "row" },
        btn("Add another organisation", "", function () { createView(box, false); }),
        btn("Restore from a backup file", "", restoreBackup),
        w ? btn("Erase " + w.label + " from this computer", "danger-o", function () {
          U.confirmBox("Erase " + w.label + "?", "This deletes this organisation's encrypted records and evidence from this computer. Without a backup file and the passphrase they cannot be brought back.", "Erase everything", true)
            .then(function (ok) { if (ok) U.removeWorkspace(w.id).then(lockScreen); });
        }) : null));
  }
  function askPass(title, text, withLabel, cb) {
    var inp = h("input", { id: "ask-pass", type: "password", autocomplete: "off", maxlength: 200 }), lab = h("input", { id: "ask-label", type: "text", maxlength: 60, value: "Restored organisation" }),
      err = h("p", { class: "form-err", hidden: true, role: "alert" }), dlg;
    dlg = U.modal(title, h("form", { class: "form dlg-body", onsubmit: function (e) {
      e.preventDefault(); err.hidden = false; err.textContent = "Checking...";
      cb(inp.value, lab.value.trim() || "Restored organisation").then(function () { dlg.close(); }).catch(function (x) { err.textContent = x.message; });
    } }, h("p", { text: text }), withLabel ? h("div", { class: "field wide" }, h("label", { for: "ask-label", text: "Name to show on the lock screen" }), lab) : null,
      h("div", { class: "field wide" }, h("label", { for: "ask-pass", text: "Passphrase" }), inp), err,
      h("div", { class: "row end" }, btn("Cancel", "", function () { dlg.close(); }), h("button", { type: "submit", class: "btn primary", text: "Restore" }))));
    inp.focus();
  }
  function restoreBackup() {
    U.pickFile(".starkbaseline,.json,application/json").then(function (f) {
      if (!f) return;
      if (f.tooBig) return U.toast("That file is over " + Math.round(U.MAX_PICK / 1048576) + " MB, too large to restore in a browser.", true);
      if (!f.json || V.validateBundle(f.json)) return U.toast("That is not a Stark Baseline backup file, or it was made with settings this version does not accept.", true);
      var b = f.json;
      askPass("Restore backup", "Enter the passphrase that was in use when " + f.name + " was saved. The backup is added as a new organisation; nothing on this computer is replaced.", true, function (pw, label) {
        return V.openData(b.main, pw).then(function (r) {
          var d = V.migrate(r.data), ws = V.uid();
          // Every evidence file must decrypt and match its fingerprint before anything is written.
          return Promise.all(b.files.map(function (fe) { return V.openFile(r.session, fe, fe.ref); })).then(function () {
            return b.files.reduce(function (p, fe) { return p.then(function () { return U.filePut(ws, d.fileGen, fe.ref, fe); }); }, Promise.resolve());
          }).then(function () { S.d = d; S.session = r.session; S.ws = ws; S.wsLabel = label; S.seq = r.seq || 0; return persist(); }).then(function () { return U.addWorkspace(ws, label); })
            .then(function () { enter(); U.toast("Backup restored: " + (d.evidence || []).length + " evidence items."); if (r.upgrade) upgradeKey(pw); startAutosave(); }, function (x) { S.d = null; S.session = null; S.ws = null; throw x; });
        });
      });
    });
  }

  function rollbackText(seq, hw) {
    return "Warning: these records are older than the last copy saved on this computer (save " + seq + ", but save " + hw + " was seen). If you did not restore an older copy yourself, someone may have replaced them. Check your recent work against your backup files.";
  }
  // Re-encrypt everything under a new key: every evidence file under a new generation first, then the record; the old files
  // go only after the new record is safely saved. Used by "Change passphrase" and by the automatic strength upgrade.
  // New evidence files wait for a running re-encryption (A.afterRekey), and the switch to the new key happens in the same step
  // as the last check for files still under the old generation, so a file added meanwhile is never deleted with the old ones.
  var rekeying = null;
  A.afterRekey = function () { return rekeying ? rekeying.catch(function () { return null; }) : Promise.resolve(); };
  function rekey(newPass) {
    if (rekeying) return rekeying.catch(function () { return null; }).then(function () { return rekey(newPass); });
    var old = S.session, oldGen = S.d.fileGen, newGen = V.uid(), done = {}, sess, ws = S.ws;
    function copyRest() {
      if (S.ws !== ws) throw new Error("Locked before re-encryption finished; nothing was changed.");
      var todo = evidenceWithFiles().map(function (x) { return x.id; }).filter(function (id) { return !done[id]; });
      if (!todo.length) { S.d.fileGen = newGen; S.session = sess; return null; }   // switch only when nothing is left behind
      return todo.reduce(function (p, id) {
        return p.then(function () { return U.fileGet(ws, oldGen, id); }).then(function (fe) {
          done[id] = 1;
          return fe ? V.openFile(old, fe, id).then(function (f) { return V.sealFile(sess, id, f); }).then(function (ne) { return U.filePut(ws, newGen, id, ne); }) : null;
        });
      }, Promise.resolve()).then(copyRest);
    }
    rekeying = flush().then(function () { return V.newSession(newPass); }).then(function (s) { sess = s; return copyRest(); }).then(function () {
      return persist().then(function () { return U.storeGet(ws); }).then(function (env) { return U.setBak(ws, env); });   // the old-key copy must not linger as the last good copy
    }).then(function () { return U.fileKeys(ws, oldGen); }).then(function (keys) { return Promise.all(keys.map(function (k) { return U.fileDel(ws, oldGen, k.split(":").pop()); })); })
      .catch(function (x) { if (S.d && S.d.fileGen !== newGen) S.session = old; throw x; });
    var mine = rekeying;
    mine.then(function () { if (rekeying === mine) rekeying = null; }, function () { if (rekeying === mine) rekeying = null; });
    return mine;
  }
  // Records saved at an older, cheaper key cost (or before passphrase normalisation) are re-encrypted at today's strength.
  function upgradeKey(pw) {
    rekey(pw).then(function () { U.toast("Encryption upgraded to " + V.KDF_ITER.toLocaleString() + " key-stretching rounds. Older backup files still open with the same passphrase."); },
      function (x) { U.toast("Could not upgrade the encryption strength: " + x.message, true); });
  }

  /* ---------- autosave to a file you choose (File System Access API) ---------- */
  function evidenceWithFiles() { return S.d.evidence.filter(function (e) { return e.file; }); }
  function buildBundle() {
    return U.storeGet(S.ws).then(function (main) {
      if (!main || main.corrupt) throw new Error("The stored records could not be read.");
      return Promise.all(evidenceWithFiles().map(function (e) { return U.fileGet(S.ws, S.d.fileGen, e.id); })).then(function (files) {
        var bundle = V.makeBundle(main, files.filter(Boolean)), why = V.validateBundle(bundle);
        if (why) throw new Error(why);
        return { bundle: bundle, missing: files.filter(function (x) { return !x; }).length };
      });
    });
  }
  function autosaveName() { return "stark-baseline-" + S.wsLabel.replace(/[^\w-]+/g, "-").slice(0, 40) + "-autosave.starkbaseline"; }
  A.autosave = BaselineAutosave.create({
    getBundle: function () { return buildBundle().then(function (r) { return r.bundle; }); },
    remember: function (hd) { return S.ws ? U.handlePut(S.ws, hd) : null; },
    onState: function () { var el = $("#autosave-state"); if (el) el.textContent = autosaveText(); var chip = $("#save-state"); if (chip) chip.classList.toggle("file", A.autosave && A.autosave.state === "on"); },
    onWritten: function () { if (S.d && S.d.settings.lastBackup !== today()) { S.d.settings.lastBackup = today(); save(); } }
  });
  function autosaveText() {
    var a = A.autosave, i = a.info, when = i.last ? new Date(i.last).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
    if (!a.supported()) return "This browser cannot keep a file updated. It works in Chrome and Edge when you open the downloaded copy of the app (not inside a web page embed). Save backup files by hand instead.";
    if (a.state === "on") return "On: every change is written to " + i.name + (when ? ", last at " + when : "") + ". The file is encrypted like a backup file.";
    if (a.state === "paused") return "Paused: the browser needs your permission again to write " + i.name + ". " + (i.error || "");
    if (a.state === "error") return "Stopped by a problem: " + i.error + " Choose the file again.";
    return "Off. Choose a file once and every change is also written there, encrypted, for example in a folder your own cloud or network backup already copies.";
  }
  function startAutosave() {
    if (!A.autosave.supported() || !S.ws) return;
    var ws = S.ws;
    U.handleGet(ws).then(function (hd) { if (hd && S.ws === ws) return A.autosave.attach(hd).then(function (st) { if (st === "paused" && S.route === "home") render(); }); });
  }
  function chooseAutosave() {
    var pick = function () { return window.showSaveFilePicker({ suggestedName: autosaveName(), types: [{ description: "Stark Baseline backup", accept: { "application/json": [".starkbaseline"] } }] }); };
    A.autosave.choose(pick).then(function (st) { render(); U.toast(st === "on" ? "Autosave on. The file is written now and after every change." : autosaveText(), st !== "on"); },
      function (x) { if (x && x.name === "AbortError") return; U.toast("Autosave not started: " + ((x && x.message) || "the file could not be chosen."), true); });
  }
  function autosaveCard() {
    var a = A.autosave, on = a.state === "on", paused = a.state === "paused";
    return h("div", { class: "card", id: "autosave-card" }, h("h2", { text: "Autosave to a file" }),
      h("p", { class: "muted", id: "autosave-state", text: autosaveText() }),
      a.supported() ? h("div", { class: "row" },
        paused ? btn("Resume autosave", "primary", function () { a.resume().then(function () { render(); }); }) : null,
        btn(on || paused ? "Choose another file" : "Choose a file", on ? "" : "primary", chooseAutosave),
        on || paused ? btn("Stop autosave", "", function () { a.stop(true).then(function () { render(); U.toast("Autosave stopped. The file stays where it is."); }); }) : null,
        on ? btn("Write now", "", function () { a.changed(); a.flush().then(function () { U.toast(a.state === "on" ? "Written." : autosaveText(), a.state !== "on"); }); }) : null) : null,
      h("p", { class: "fine", text: "The file is a normal encrypted backup file: restore it with 'Restore from a backup file' on the lock screen. It opens only with the passphrase in use when it was written. Writing is paused while the app is locked." }));
  }
  /* ---------- shell ---------- */
  function buildNav() {
    var nav = U.clear($("#nav"));
    NAV.forEach(function (n) { if (n[0] === "hipaa" && !covenant()) return; nav.appendChild(h("a", { href: "#/" + n[0], "data-nav": n[0], text: n[1] })); });
  }
  function enter() {
    document.body.classList.remove("locked");
    $("#topbar-tools").hidden = false; $("#nav").hidden = false; S.last = Date.now();
    var r = (location.hash || "").replace("#/", "");
    S.route = NAV.some(function (n) { return n[0] === r; }) ? r : "home";
    $("#ws-name").textContent = S.wsLabel; $("#save-state").textContent = "Saved, encrypted";
    buildNav(); render();
  }
  function lock(why) {
    clearTimeout(S.saveTimer);
    (S.d ? flush().catch(function () { return null; }).then(function () { return A.autosave ? A.autosave.flush() : null; }) : Promise.resolve()).then(function () {
      if (A.autosave) A.autosave.detach();
      S.d = null; S.session = null; S.ws = null; S.wsLabel = ""; S.seq = 0; U.closeAllDialogs(); U.clear($("#print-root")); U.clear($("#main"));
      lockScreen(); if (why) U.toast(why);
    });
  }
  function render() {
    if (!S.d) return;
    if (BaselineSmart.snapshot(S.d, today())) save();
    var main = U.clear($("#main")), views = { home: vHome, settings: vSettings, sources: vSources }, view;
    if (S.route === "hipaa" && !covenant()) S.route = "home";
    view = views[S.route] || A.views[S.route] || vHome;
    Array.prototype.forEach.call(document.querySelectorAll("#nav a"), function (a) { a.classList.toggle("on", a.dataset.nav === S.route); a.toggleAttribute("aria-current", a.dataset.nav === S.route); });
    if (S.d.example) main.appendChild(h("div", { class: "banner example", role: "note" }, h("strong", { text: "Example data. " }), "Everything here is a made-up organisation for illustration. Clear it in Settings before you add your own records."));
    main.appendChild(view());
    if (A.afterRender) A.afterRender();
    main.focus({ preventScroll: true });
  }
  function buildShell() {
    $("#lock-btn").addEventListener("click", function () { lock(); });
    $("#theme-btn").addEventListener("click", function () { var d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("sb-theme", d.dataset.theme); } catch (e) { /* ignore */ } });
    window.addEventListener("hashchange", function () { var r = (location.hash || "").replace("#/", ""); if (S.d && NAV.some(function (n) { return n[0] === r; })) { S.route = r; render(); window.scrollTo(0, 0); } });
    ["mousemove", "keydown", "click", "touchstart", "scroll", "wheel"].forEach(function (ev) { document.addEventListener(ev, function () { S.last = Date.now(); }, { passive: true, capture: true }); });
    setInterval(tick, 1000);
    try { var t = localStorage.getItem("sb-theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
  }
  function tick() {
    var t = $("#lock-timer");
    if (!S.d) { t.textContent = ""; return; }
    var left = (S.d.settings.lockMin || 5) * 60 - Math.floor((Date.now() - S.last) / 1000);
    if (left <= 0) return lock("Locked after " + (S.d.settings.lockMin || 5) + " minutes of inactivity.");
    t.textContent = left <= 60 ? "Locking in " + left + "s" : "Auto-lock " + Math.ceil(left / 60) + " min";
  }

  /* ---------- Home ---------- */
  function stat(value, label, route, cls) { return h("a", { class: "stat " + (cls || ""), href: "#/" + route }, h("b", { text: String(value) }), h("span", { text: label })); }
  function fnBars(sc) {
    return h("div", { class: "fnbars" }, C.FUNCTIONS.map(function (f) {
      var s = sc.fns[f.id];
      return h("a", { class: "fnbar", href: "#/checklist", onclick: function () { A.fn = f.id; } },
        h("div", { class: "top" }, h("b", { text: f.name }), h("span", { class: "pct", text: s.pct + "%" })),
        h("progress", { max: 100, value: s.pct, "aria-label": f.name + " progress" }),
        h("small", { text: s.done + " done, " + s.doing + " in progress, " + (s.applicable - s.done - s.doing) + " not started" + (s.na ? ", " + s.na + " do not apply" : "") + ". " + f.plain }));
    }));
  }
  function vHome() {
    var d = S.d, t = today(), sc = L.scores(d.checks), ins = L.insights(d, t), dr = L.drillStatus(d, t), tr = L.trainingStatus(d, t),
      tested = dr.filter(function (x) { return x.state === "ok" || x.state === "soon"; }).length, high = L.rankedRisks(d.risks).filter(function (r) { return r.status !== "closed" && L.riskLevel(r.likelihood, r.impact).label === "High"; }).length,
      bk = d.settings.lastBackup ? V.daysBetween(d.settings.lastBackup, t) : null;
    var wrap = h("div", null, section(d.org.name, "Security readiness at a glance. " + (covenant() ? "Covenant practice preset is on." : d.org.type + "."), [btn("Open checklist", "primary", function () { go("checklist"); })]));
    if (A.autosave.state === "paused" || A.autosave.state === "error") wrap.appendChild(h("div", { class: "banner warn" }, h("strong", { text: "Autosave to " + (A.autosave.info.name || "your file") + " is " + (A.autosave.state === "paused" ? "paused. " : "stopped. ") }),
      A.autosave.state === "paused" ? "The browser asks for permission again after a restart. " : A.autosave.info.error + " ",
      A.autosave.state === "paused" ? btn("Resume autosave", "small primary", function () { A.autosave.resume().then(function () { render(); }); }) : h("a", { href: "#/settings", text: "Go to Settings" })));
    if (bk === null || bk > 30) wrap.appendChild(h("div", { class: "banner warn" }, h("strong", { text: bk === null ? "No backup file saved yet. " : "Last backup file was " + bk + " days ago. " }),
      "These records live only in this browser on this computer. Save an encrypted backup file in Settings and keep it somewhere safe. ", h("a", { href: "#/settings", text: "Go to Settings" })));
    wrap.appendChild(h("div", { class: "stats" },
      stat(sc.overall.pct + "%", "checklist progress", "checklist"), stat(d.devices.length + d.accounts.length, "devices and accounts listed", "inventory"),
      stat(tested + " of " + dr.length, "backups with a good restore test", "drills", tested < dr.length ? "coral" : ""), stat(tr.rows.length ? tr.pct + "%" : "0%", "staff trained this year", "staff"),
      stat(d.evidence.length, "evidence items", "evidence"), stat(high, "open high risks", "risks", high ? "coral" : "")));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Progress by NIST CSF 2.0 Function" }),
      h("p", { class: "fine", text: "Done counts as 1 and in progress as half. Items marked 'does not apply' are left out. This is a measure of your own records, not a rating by anyone else." }), fnBars(sc)));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Needs attention" }),
      ins.length ? h("ul", { class: "attn" }, ins.slice(0, 10).map(function (x) { return h("li", { class: x.level }, badge(x.level === "high" ? "First" : "Soon", x.level === "high" ? "bad" : "warn"), h("span", { class: "grow", text: x.text }), h("a", { href: "#/" + x.route, text: "Open" })); }))
        : h("p", { class: "muted", text: "Nothing in your records needs attention right now. Keep the inventory up to date so this stays true." })));
    var next = C.CHECKLIST.filter(function (it) { return L.statusOf(d.checks, it.id) === "todo"; }).slice(0, 4);
    if (next.length) wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Good next steps" }), h("ul", { class: "attn" }, next.map(function (it) {
      return h("li", null, h("span", { class: "tag", text: it.fn }), h("span", { class: "grow", text: it.title }), h("a", { href: "#/checklist", onclick: function () { A.fn = it.fn; }, text: "Open" }));
    }))));
    return wrap;
  }

  /* ---------- Settings ---------- */
  function vSettings() {
    var d = S.d, o = d.org, wrap = h("div", null, section("Settings", "Organisation details, preset, backups and security."));
    var f = { name: h("input", { id: "s-name", type: "text", maxlength: 100, value: o.name }), type: h("select", { id: "s-type" }, C.ORG_TYPES.map(function (x) { return h("option", { value: x, text: x, selected: x === o.type }); })),
      staffCount: h("input", { id: "s-staff", type: "number", min: 0, value: o.staffCount || "" }), lead: h("input", { id: "s-lead", type: "text", maxlength: 100, value: o.lead, placeholder: "Name and role" }),
      deputy: h("input", { id: "s-deputy", type: "text", maxlength: 100, value: o.deputy, placeholder: "Name and role" }),
      preset: h("select", { id: "s-preset" }, [{ v: "general", l: "General small organisation" }, { v: "covenant", l: "Covenant practice: HIPAA risk-analysis evidence" }].map(function (x) { return h("option", { value: x.v, text: x.l, selected: x.v === o.preset }); })) };
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Organisation" }),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        o.name = f.name.value.trim() || o.name; o.type = f.type.value; o.staffCount = f.staffCount.value; o.lead = f.lead.value.trim(); o.deputy = f.deputy.value.trim();
        var was = o.preset; o.preset = f.preset.value; save(); buildNav(); render(); U.toast(was !== o.preset ? (o.preset === "covenant" ? "Covenant practice preset on: see HIPAA evidence." : "General preset on.") : "Saved.");
      } }, h("div", { class: "grid2" },
        h("div", { class: "field" }, h("label", { for: "s-name", text: "Name (encrypted)" }), f.name), h("div", { class: "field" }, h("label", { for: "s-type", text: "Type" }), f.type),
        h("div", { class: "field" }, h("label", { for: "s-lead", text: "Security lead" }), f.lead), h("div", { class: "field" }, h("label", { for: "s-deputy", text: "Deputy" }), f.deputy),
        h("div", { class: "field" }, h("label", { for: "s-staff", text: "Number of staff" }), f.staffCount), h("div", { class: "field" }, h("label", { for: "s-preset", text: "Preset" }), f.preset,
          h("span", { class: "fine", text: "The Covenant practice preset adds a HIPAA evidence page that helps a clinic organise and track evidence for its own HIPAA risk analysis." }))),
        h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary", text: "Save organisation" })))));
    var lab = h("input", { id: "s-label", type: "text", maxlength: 60, value: S.wsLabel });
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Lock-screen name" }), h("p", { class: "fine", text: "Shown on the lock screen so you can pick this organisation. It is stored without encryption; use a code name if you prefer." }),
      h("div", { class: "row" }, h("div", { class: "grow" }, lab), btn("Rename", "", function () { var v = lab.value.trim(); if (!v) return; U.renameWorkspace(S.ws, v).then(function () { S.wsLabel = v; $("#ws-name").textContent = v; U.toast("Renamed."); }); }))));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Timing" }), h("div", { class: "grid2" },
      h("div", { class: "field" }, h("label", { for: "lockmin", text: "Lock after no activity for" }), h("select", { id: "lockmin", onchange: function (e) { d.settings.lockMin = +e.target.value; save(); tick(); } },
        [1, 2, 5, 10, 15, 30].map(function (m) { return h("option", { value: m, text: m + (m === 1 ? " minute" : " minutes"), selected: m === (d.settings.lockMin || 5) }); }))),
      h("div", { class: "field" }, h("label", { for: "drilldays", text: "Restore test needed every" }), h("select", { id: "drilldays", onchange: function (e) { d.settings.drillDays = +e.target.value; save(); } },
        [[90, "3 months"], [180, "6 months"], [365, "12 months (CISA's minimum)"]].map(function (m) { return h("option", { value: m[0], text: m[1], selected: m[0] === (d.settings.drillDays || 365) }); }))))));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Backup file" }),
      h("p", { class: "muted", text: "Saves everything, including evidence files, as one encrypted file. It opens only with the passphrase in use today. Last saved: " + (d.settings.lastBackup || "never") + "." }),
      h("div", { class: "row" }, btn("Save a backup file", "primary", saveBackup)),
      h("p", { class: "fine", text: "To restore, or to move to another computer, use 'Restore from a backup file' under Other options on the lock screen. It is added as a separate organisation, so nothing is overwritten." })));
    wrap.appendChild(autosaveCard());
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Change passphrase" }), h("p", { class: "fine", text: "Do this whenever someone who knew the passphrase leaves. Every evidence file is re-encrypted with the new key." }), changePass()));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Example data" }),
      d.example ? [h("p", { class: "muted", text: "You are looking at a made-up example organisation." }), btn("Clear example data", "coral", function () {
        U.confirmBox("Clear the example?", "Removes all example records and starts this organisation empty. Your passphrase stays the same.", "Clear example", true).then(function (ok) {
          if (!ok) return; var oldGen = d.fileGen; S.d = V.emptyData(S.wsLabel); buildNav();
          flush().then(function () { return U.fileKeys(S.ws, oldGen); }).then(function (keys) { return Promise.all(keys.map(function (k) { return U.fileDel(S.ws, oldGen, k.split(":").pop()); })); })
            .then(function () { render(); U.toast("Example cleared."); });
        });
      })] : [h("p", { class: "muted", text: "Load a made-up clinic to see how everything fits together. Only possible while these records are empty." }),
        btn("Load example organisation", "", function () {
          if (d.devices.length || d.accounts.length || d.backups.length || d.evidence.length || d.staff.length || Object.keys(d.checks).length) return U.toast("These records are not empty, so the example was not loaded.", true);
          var x = C.example(V); x.fileGen = d.fileGen; S.d = x; buildNav(); flush().then(function () { go("home"); U.toast("Example organisation loaded."); });
        })]));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "How your data is protected" }), h("ul", null,
      h("li", { text: "AES-256-GCM encryption. The key comes from your passphrase with PBKDF2-SHA256, " + V.KDF_ITER.toLocaleString() + " iterations and a random salt." }),
      h("li", { text: "Evidence files are encrypted one by one and tied to their record. A file changed by anyone without the passphrase, or moved to another record, is refused. The SHA-256 fingerprint is a damage check, not proof against someone who knows the passphrase." }),
      h("li", { text: "Every save is read back and compared, and the last good copy is kept. Damaged data opens in a read-only safe mode instead of being overwritten." }),
      h("li", { text: "Each save carries a save number sealed into the encryption. If an older copy is put back in place of newer records, you are warned when you unlock." }),
      h("li", { text: "Records made with an older, cheaper key setting are re-encrypted at today's strength the next time you unlock them." }),
      h("li", { text: "Your passphrase is never stored. The derived key stays in memory only while unlocked." }),
      h("li", { text: "No network: this page blocks all connections. No account, server, analytics or cloud." }),
      h("li", { text: "Honest limits: it cannot protect against malware on this computer, a weak passphrase or someone watching you type. Printouts, text files and saved copies of evidence are not encrypted." }))));
    wrap.appendChild(h("div", { class: "card danger-zone" }, h("h2", { text: "Erase" }), h("p", { class: "muted", text: "Deletes this organisation and its evidence from this computer. Save a backup file first if you might want it again." }),
      btn("Erase this organisation", "danger", function () {
        U.confirmBox("Erase everything?", "This organisation's records and evidence will be deleted from this computer. This cannot be undone without a backup file.", "Erase everything", true).then(function (ok) {
          if (ok) { var ws = S.ws; clearTimeout(S.saveTimer); S.d = null; U.removeWorkspace(ws).then(function () { lock("Erased."); }); }
        });
      })));
    return wrap;
  }
  function saveBackup() {
    flush().then(buildBundle).then(function (r) {
      U.downloadText("stark-baseline-" + S.wsLabel.replace(/[^\w-]+/g, "-").slice(0, 40) + "-" + stamp() + ".starkbaseline", JSON.stringify(r.bundle), "application/json");
      S.d.settings.lastBackup = today(); save(); render();
      U.toast(r.missing ? "Backup saved, but " + r.missing + " evidence files were missing from this computer." : "Backup file saved. Keep it somewhere safe.", !!r.missing);
    }).catch(function (x) { U.toast("Backup failed: " + x.message, true); });
  }
  function changePass() {
    var cur = h("input", { id: "cur-pass", type: "password", autocomplete: "current-password", maxlength: 200 }), st = null, pf = U.passField("new-pass", "New passphrase", function (s) { st = s; }),
      msg = h("p", { class: "form-err", hidden: true, role: "alert" });
    return h("form", { class: "form", novalidate: true, onsubmit: function (e) {
      e.preventDefault(); msg.hidden = false;
      U.clearInvalid(e.target);
      if (pf.input.value.length < 12 || !st || st.score < 2) { msg.textContent = "The new passphrase is too weak. Use at least 12 characters, ideally four or more random words."; return U.markInvalid(pf.input, msg); }
      msg.textContent = "Checking and re-encrypting...";
      flush().then(function () { return U.storeGet(S.ws); }).then(function (env) { return V.open(env, cur.value); })
        .then(function () { return rekey(pf.input.value); }, function () { U.markInvalid(cur, msg); throw new Error("The current passphrase is wrong."); })
        .then(function () {
          cur.value = pf.input.value = ""; msg.textContent = "Passphrase changed. Older backup files still open only with the old passphrase."; U.toast("Passphrase changed.");
          if (A.autosave.state === "on") { A.autosave.changed(); A.autosave.flush(); }   // the autosave file must not keep the old key's copy
        })
        .catch(function (x) { msg.textContent = x.message; });
    } }, h("div", { class: "field wide" }, h("label", { for: "cur-pass", text: "Current passphrase" }), cur), pf.el, msg, h("div", { class: "row" }, h("button", { type: "submit", class: "btn", text: "Change passphrase" })));
  }

  /* ---------- Sources ---------- */
  function vSources() {
    var wrap = h("div", null, section("Sources and licences", "Where the checklist, the HIPAA preset and the staff lessons come from, and why we may use them."));
    wrap.appendChild(h("div", { class: "banner" }, h("strong", { text: "In our own words. " }),
      "Stark Baseline paraphrases public US government frameworks in plain language and cites them by name and identifier. NIST, CISA and HHS have not reviewed or endorsed Stark Baseline. Using it helps you organise and track your work; it does not show that you meet any law, contract or standard. " + L.NOT_ADVICE));
    wrap.appendChild(h("div", { class: "banner" }, h("strong", { text: "UK Cyber Essentials view. " }),
      "It uses the names of the scheme's five technical controls, taken from the UK National Cyber Security Centre's own page, with our own descriptions and mapping, reviewed against the NCSC's Requirements for IT Infrastructure v3.3 (April 2026). It is a self-check aid, not a certification, and passing Baseline's checks does not mean meeting Cyber Essentials. Stark Baseline is not affiliated with the scheme, the NCSC or IASME, and none of them has reviewed or endorsed it."));
    C.SOURCES.forEach(function (s) {
      wrap.appendChild(h("div", { class: "card" }, h("h2", { text: s.name }), h("dl", null, kv("Published by", s.by), kv("Edition", s.ref),
        s.url ? h("div", { class: "kv" }, h("dt", { text: "Address" }), h("dd", null, h("code", { class: "url", text: s.url }))) : null, kv("Date checked", s.checked), kv("Licence status", s.status),
        s.statusUrl ? h("div", { class: "kv" }, h("dt", { text: "Licence page" }), h("dd", null, h("code", { class: "url", text: s.statusUrl }))) : null, kv("How we use it", s.use))));
    });
    wrap.appendChild(h("p", { class: "fine", text: "Addresses are shown as text because this app never connects to the internet. Copy one into your browser to read the original." }));
    return wrap;
  }

  /* ---------- boot ---------- */
  window.__baseline = { state: S, lock: lock, render: render, flush: flush };
  A.btn = btn; A.section = section; A.empty = empty; A.badge = badge; A.kv = kv; A.byId = byId; A.upsert = upsert; A.save = save; A.flush = flush; A.render = render;
  A.del = del; A.rowActions = rowActions; A.printNode = printNode; A.printHead = printHead; A.go = go; A.covenant = covenant; A.sensLabel = sensLabel; A.today = today; A.stamp = stamp; A.buildNav = buildNav;
  document.addEventListener("DOMContentLoaded", function () { buildShell(); lockScreen(); });
})();
