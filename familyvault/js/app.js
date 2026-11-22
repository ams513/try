/* Stark Family Vault, by Stark: views and app flow. Offline; the only thing ever stored is the encrypted vault. */
(function () {
  "use strict";
  var V = StarkVault, C = VaultContent, U = VaultUI, K = VaultKit, h = U.h, $ = U.$;
  var S = { vault: null, session: null, readonly: false, person: "all", route: "home", last: 0, saveTimer: null, saving: Promise.resolve(), rev: 0, savedRev: 0, locking: false, shareInfo: null, q: "" };
  var NAV = [["home", "Home"], ["insights", "Insights"], ["reminders", "Reminders"], ["docs", "Documents"], ["insurance", "Insurance"], ["health", "Health"], ["money", "Money and contacts"], ["digital", "Digital"],
    ["plan", "Planning"], ["emergency", "Emergency"], ["inventory", "Home inventory"], ["share", "Sharing"], ["recovery", "Recovery kit"], ["family", "Family"], ["settings", "Settings"]];
  var ROUTES = NAV.map(function (n) { return n[0]; }).concat(["search"]);
  // Views added by views2.js register here (window.VaultApp.views) before anything renders.
  var A = window.VaultApp = { views: {}, ext: {} };

  /* ---------- helpers ---------- */
  function pname(id) { var p = S.vault.people.filter(function (x) { return x.id === id; })[0]; return p ? p.name : "Unknown"; }
  function peopleOpts(withAll) { var o = S.vault.people.map(function (p) { return { v: p.id, l: p.name }; }); return withAll ? [{ v: "all", l: "Everyone" }].concat(o) : o; }
  function visible(p) { return S.person === "all" || p === S.person; }
  function ro() { return S.readonly; }
  function fmtDate(d) { return d || "none"; }
  function money(n) { return (+n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
  function btn(text, cls, fn) { return h("button", { type: "button", class: "btn " + (cls || ""), text: text, onclick: fn }); }
  function section(title, sub, actions) {
    return h("div", { class: "sec-head" }, h("div", null, h("h1", { text: title }), sub ? h("p", { class: "muted", text: sub }) : null), h("div", { class: "row" }, actions || []));
  }
  function empty(text, cta) { return h("div", { class: "empty" }, h("p", { text: text }), cta || null); }
  function badge(text, cls) { return h("span", { class: "badge " + (cls || ""), text: text }); }
  // Every save goes through one chain, so two writes never interleave (no false "did not read back" and no .bak clobbering).
  // persist() resolves when this snapshot is stored and rejects with the reason when it is not; failures are always shown.
  function persist() {
    var sess = S.session, vault = S.vault, rev = S.rev;
    var run = S.saving.catch(function () { return null; }).then(function () {
      if (!sess || !vault) return null;
      return V.seal(sess, vault).then(function (env) { return U.storePut(env).then(function () { if (A.afterSave) A.afterSave(env); return env; }); });
    });
    S.saving = run;
    return run.then(function (env) { if (S.vault === vault) { S.savedRev = Math.max(S.savedRev, rev); if (S.savedRev === S.rev) $("#save-state").textContent = "Saved, encrypted"; } return env; }, function (e) {
      $("#save-state").textContent = "Not saved";
      U.toast("Not saved: " + (e && e.message ? e.message : "storage error") + " Your changes are still on screen. Save a backup file from Sharing.", true);
      throw e;
    });
  }
  function save() {
    if (S.readonly || !S.vault) return;
    $("#save-state").textContent = "Saving..."; S.rev++;
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(function () { persist().catch(function () { return null; }); }, 350);
  }
  function flush() { clearTimeout(S.saveTimer); if (S.readonly || !S.vault) return S.saving.catch(function () { return null; }); return persist(); }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function upsert(list, item) { var i = list.indexOf(byId(list, item.id)); if (i < 0) { if (A.canAdd && A.canAdd(list) === false) return false; list.push(item); } else list[i] = item; return true; }
  function personFilterBar() {
    if (S.vault.people.length < 2) return null;
    return h("div", { class: "filter row" }, h("label", { for: "pf", text: "Show" }), h("select", { id: "pf", onchange: function (e) { S.person = e.target.value; render(); } },
      peopleOpts(true).map(function (o) { return h("option", { value: o.v, text: o.l, selected: o.v === S.person }); })));
  }
  function actions(item, list, edit) {
    if (ro()) return null;
    return h("div", { class: "row tight" }, btn("Edit", "small", function () { edit(item); }),
      btn("Delete", "small danger-o", function () { U.confirmBox("Delete this?", "This removes it from the vault. It cannot be undone.", "Delete", true).then(function (ok) { if (ok) { list.splice(list.indexOf(item), 1); save(); render(); } }); }));
  }

  /* ---------- lock screen ---------- */
  function lockScreen() {
    var main = U.clear($("#main")), box = h("div", { class: "lock card" });
    document.body.classList.add("locked");
    $("#topbar-tools").hidden = true; $("#nav").hidden = true;
    main.appendChild(box);
    U.storeGet().then(function (env) { env ? (env.corrupt ? safeView(box, env.raw, "The stored vault could not be read and there is no earlier copy.") : unlockView(box, env)) : createView(box); });
  }
  function honest() {
    return h("div", { class: "honest" }, h("strong", { text: "Please read this once. " }),
      "Your vault is locked with a key made from your passphrase. The passphrase is never saved, not here and not anywhere. There is no reset, no recovery email and no back door, because we cannot see your data. If the passphrase is lost, the data is gone for good. Keep it somewhere safe that a trusted person can find, such as a sealed note with your attorney.");
  }
  function createView(box) {
    var ok = false, p1, p2, strong = false, err = h("p", { class: "form-err", id: "create-err", role: "alert", hidden: true }), ack = h("input", { id: "ack", type: "checkbox" }), name = h("input", { id: "yourname", type: "text", maxlength: 60, placeholder: "Your first name", autocomplete: "off" });
    p1 = U.passField("pass1", "Choose a passphrase", function (s) { strong = s; });
    p2 = h("input", { id: "pass2", type: "password", autocomplete: "new-password" });
    U.clear(box).appendChild(h("div", null,
      h("h1", { text: "Create your family vault" }),
      h("p", { class: "muted", text: "Everything is encrypted on this computer with AES-256-GCM. Nothing is sent anywhere." }),
      honest(),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var pw = p1.input.value, nm = name.value.trim() || "Me";
        err.hidden = false;
        [p1.input, p2, ack].forEach(function (x) { U.markField(x, null); });
        if (pw.length < 12) return fail(p1.input, "Use at least 12 characters. A few random words is best.");
        if (!strong || !strong.ok) return fail(p1.input, "That passphrase is too easy to guess. Try four or more unrelated words.");
        if (pw !== p2.value) return fail(p2, "The two passphrases do not match.");
        if (!ack.checked) return fail(ack, "Please tick the box to confirm you understand.");
        function fail(x, t) { err.textContent = t; U.markField(x, err.id); x.focus(); }
        err.textContent = "Working... this takes about a second on purpose, to slow down guessing.";
        e.target.querySelector("button[type=submit]").disabled = true;
        V.newSession(pw, "vault").then(function (sess) { return U.storeHigh().then(function (hw) { sess.n = hw; var v = V.emptyVault(nm); S.vault = v; S.session = sess; S.readonly = false; return V.seal(sess, v).then(U.storePut); }); })
          .then(function () { p1.input.value = p2.value = ""; enter(); })
          .catch(function (x) { S.vault = null; S.session = null; e.target.querySelector("button[type=submit]").disabled = false; err.textContent = "The vault could not be saved in this browser: " + (x && x.message ? x.message : "storage error") + " Try a normal (not private) window."; });
      } },
        h("div", { class: "field" }, h("label", { for: "yourname", text: "Your name" }), name),
        p1.el,
        h("div", { class: "field wide" }, h("label", { for: "pass2", text: "Type it again" }), p2),
        h("div", { class: "field check wide" }, ack, h("label", { for: "ack", text: "I understand that if I lose this passphrase my data cannot be recovered by anyone." })),
        err,
        h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary big", text: "Create vault" }))),
      otherOptions()));
  }
  function unlockView(box, env) {
    var pass = h("input", { id: "unlock-pass", type: "password", autocomplete: "current-password", maxlength: 200, "aria-describedby": "unlock-err" }), err = h("p", { class: "form-err", id: "unlock-err", role: "alert", hidden: true }), fails = 0;
    U.clear(box).appendChild(h("div", null,
      h("h1", { text: "Unlock your vault" }),
      h("p", { class: "muted", text: "Enter your passphrase. It is checked on this computer and never stored." }),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var b = e.target.querySelector("button[type=submit]"); b.disabled = true; err.hidden = false; err.textContent = "Unlocking...";
        V.openVault(env, pass.value, { upgrade: true }).then(function (r) { pass.value = ""; return adopt(r, false); })
          .catch(function (x) {
            if (x.invalid) return safeView(box, env, x.message, x.data);
            return U.storeGetBak().then(function (bak) { return bak ? V.openVault(bak, pass.value, { upgrade: true }).then(function (r) { return { r: r, bak: bak }; }) : Promise.reject(x); })
              .then(function (o) { pass.value = ""; return U.storePut(o.bak).then(function () { return adopt(o.r, true); }).then(function () { U.toast("The latest copy was damaged, so your last good copy was restored."); }); })
              .catch(function () { throw x; });
          }).catch(function (x) { if (!x || !x.message) return; fails++; b.disabled = false; pass.setAttribute("aria-invalid", "true"); err.textContent = x.message + (fails > 2 ? " Remember: there is no way to reset a lost passphrase." : ""); pass.select(); });
      } },
        h("div", { class: "field wide" }, h("label", { for: "unlock-pass", text: "Passphrase" }), pass),
        err, h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary big", text: "Unlock" }))),
      otherOptions(env)));
    pass.focus();
  }
  // Safe mode: stored data failed to read or validate. Nothing is overwritten; the person can only export what is there.
  function safeView(box, env, reason, data) {
    var kids = [h("h1", { text: "Safe mode (read-only)" }),
      h("div", { class: "banner", role: "alert" }, h("strong", { text: "Your vault could not be opened normally." }), " " + reason + " Nothing has been changed or deleted. Save a copy of the raw data now, then ask for help or restore from a backup file."),
      h("div", { class: "row wrap" }, btn("Export raw data", "primary", function () { U.downloadText("stark-vault-raw-" + stamp() + ".starkvault", JSON.stringify(env), "application/json"); }))];
    if (data) kids.push(h("p", { class: "fine", text: "The vault opened with your passphrase but its contents failed the safety checks, so it was not loaded. The raw export above is still encrypted." }));
    kids.push(otherOptions(null));
    U.clear(box).appendChild(h("div", null, kids));
  }
  function otherOptions(env) {
    return h("details", { class: "other" }, h("summary", { text: "Other ways in" }),
      h("div", { class: "row wrap" },
        btn("Open a share file someone sent me", "", openShare),
        btn("Restore from a backup file", "", restoreBackup),
        btn("Rebuild my passphrase from recovery shares", "", function () { if (A.recoverDialog) A.recoverDialog(); }),
        env ? btn("Erase this vault from this computer", "danger-o", function () {
          U.confirmBox("Erase this vault?", "This deletes the encrypted vault stored on this computer. Without a backup file and your passphrase it cannot be brought back.", "Erase everything", true).then(function (ok) { if (ok) U.storeClear().then(lockScreen); });
        }) : null));
  }
  // Take an opened vault into the app. Warns when the copy is older than the newest save written on this computer
  // (storage rolled back), keeps the save counter climbing, and re-saves at full strength when the file used fewer iterations.
  function adopt(r, restored) {
    return U.storeHigh().then(function (hw) {
      var old = r.session.n || 0;
      S.vault = r.data; S.session = r.session; S.readonly = false; S.session.n = Math.max(old, hw); migrate(); enter();
      if (!restored && old && hw > old) U.toast("This is an older copy than the newest one saved on this computer (save " + old + " of " + hw + "). If you did not restore a backup, browser storage may have been rolled back: check your backup files.", true);
      if (r.upgraded) persist().then(function () { U.toast("Your vault was re-encrypted at full strength (" + V.KDF_ITER.toLocaleString("en") + " iterations)."); }, function () { return null; });
    });
  }
  function migrate() {
    var v = S.vault;
    ["docs", "contacts", "accounts", "inventory", "people", "meds", "policies", "digital", "tasks"].forEach(function (k) { if (!Array.isArray(v[k])) v[k] = []; });
    ["health", "plan", "emergency"].forEach(function (k) { if (!v[k] || typeof v[k] !== "object" || Array.isArray(v[k])) v[k] = {}; });
    v.settings = v.settings || { lockMin: 5 };
    if (!Array.isArray(v.settings.juris)) v.settings.juris = [];
    if (!v.people.length) v.people.push({ id: V.uid(), name: "Me", rel: "Self", dob: "" });
  }
  function askPass(title, text, cb) {
    var inp = h("input", { id: "ask-pass", type: "password", autocomplete: "off", maxlength: 200 }), err = h("p", { class: "form-err", hidden: true, role: "alert" }), dlg;
    dlg = U.modal(title, h("form", { class: "form dlg-body", onsubmit: function (e) {
      e.preventDefault(); err.hidden = false; err.textContent = "Checking...";
      cb(inp.value).then(function () { dlg.close(); }).catch(function (x) { err.textContent = x.message; });
    } }, h("p", { text: text }), h("div", { class: "field wide" }, h("label", { for: "ask-pass", text: "Passphrase" }), inp), err,
      h("div", { class: "row end" }, btn("Cancel", "", function () { dlg.close(); }), h("button", { type: "submit", class: "btn primary", text: "Open" }))));
    inp.focus();
  }
  function openShare() {
    U.pickFile().then(function (f) {
      if (!f) return;
      if (!f.env || f.env.format !== V.FORMAT) return U.toast("That file is not a Stark Family Vault file.", true);
      askPass("Open shared file", "Enter the passphrase the sender gave you for " + f.name + ".", function (pw) {
        return V.openVault(f.env, pw).then(function (r) {
          if (r.legacy) U.toast("This file has no checksum, validated.");
          S.vault = r.data; S.session = null; S.readonly = true; S.shareInfo = { name: f.name, kind: f.env.kind };
          migrate(); enter();
        });
      });
    });
  }
  function restoreBackup() {
    U.pickFile().then(function (f) {
      if (!f) return;
      if (!f.env || f.env.format !== V.FORMAT || f.env.kind !== "vault") return U.toast("That is not a full vault backup file.", true);
      askPass("Restore backup", "Enter the passphrase for this backup. It becomes the passphrase of the restored vault. This replaces any vault on this computer.", function (pw) {
        return V.openVault(f.env, pw, { upgrade: true }).then(function (r) {
          return U.storeHigh().then(function (hw) {
            r.session.n = Math.max(r.session.n || 0, hw);
            return V.seal(r.session, r.data).then(U.storePut).then(function () { S.vault = r.data; S.session = r.session; S.readonly = false; migrate(); enter(); if (r.legacy) U.toast("Restored: no checksum, validated."); });
          }).catch(function (x) { throw new Error(x && x.message && x.message.indexOf("passphrase") === -1 ? "Not restored: " + x.message + " Nothing on this computer was changed." : x.message); });
        });
      });
    });
  }

  /* ---------- app shell ---------- */
  function enter() {
    document.body.classList.remove("locked"); document.body.classList.toggle("readonly", S.readonly);
    $("#topbar-tools").hidden = false; $("#nav").hidden = false;
    S.person = "all"; S.last = Date.now();
    var hash = (location.hash || "").replace("#/", ""); S.route = NAV.some(function (n) { return n[0] === hash; }) ? hash : "home"; S.q = "";
    $("#q").value = "";
    $("#lock-btn").textContent = S.readonly ? "Close" : "Lock now";
    $("#save-state").textContent = S.readonly ? "Read-only" : "Saved, encrypted";
    if (A.ext.onEnter) A.ext.onEnter();
    render();
  }
  function lock(why) {
    clearTimeout(S.saveTimer);
    if (S.locking) return;
    var needSave = !S.readonly && S.vault && S.rev !== S.savedRev, done = needSave ? flush() : (S.readonly ? Promise.resolve() : S.saving.catch(function () { return null; }));
    S.locking = true;
    done.then(function () {
      S.locking = false;
      S.vault = null; S.session = null; S.readonly = false; S.shareInfo = null; S.savedRev = S.rev; if (A.ext.onLock) A.ext.onLock(); U.closeAllDialogs(); U.clear($("#print-root")); U.clear($("#main"));
      lockScreen(); if (why) U.toast(why);
    }, function () {
      // Unsaved changes would be lost: stay open, say so plainly, and try again on the next idle period.
      S.locking = false; S.last = Date.now();
      U.toast("Not locked: your latest changes could not be saved. Save a backup file from Sharing, then lock again.", true);
    });
  }
  function render() {
    if (!S.vault) return;
    var main = U.clear($("#main")), views = { home: vHome, docs: vDocs, health: vHealth, money: vMoney, plan: vPlan, inventory: vInventory, share: vShare, family: vFamily, settings: vSettings }, view = views[S.route] || A.views[S.route] || vHome;
    Array.prototype.forEach.call(document.querySelectorAll("#nav a"), function (a) { a.classList.toggle("on", a.dataset.nav === S.route); a.toggleAttribute("aria-current", a.dataset.nav === S.route); });
    if (S.readonly) main.appendChild(h("div", { class: "banner" }, h("strong", { text: "Read-only view of a shared file." }), " Opened from " + S.shareInfo.name + (S.vault.shared ? ", shared " + S.vault.shared : "") + ". Nothing here is saved to this computer. ",
      S.vault.note ? h("em", { text: "Note from the sender: " + S.vault.note }) : null));
    main.appendChild(view());
    main.focus({ preventScroll: true });
  }
  function buildShell() {
    var nav = $("#nav");
    NAV.forEach(function (n) { nav.appendChild(h("a", { href: "#/" + n[0], "data-nav": n[0], text: n[1] })); });
    $("#lock-btn").addEventListener("click", function () { lock(); });
    $("#theme-btn").addEventListener("click", function () { var d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("sv-theme", d.dataset.theme); } catch (e) { /* ignore */ } });
    $("#search-form").addEventListener("submit", function (e) { e.preventDefault(); if (!S.vault) return; S.q = $("#q").value.trim(); if (location.hash === "#/search") render(); else location.hash = "#/search"; });
    window.addEventListener("hashchange", function () { var r = (location.hash || "").replace("#/", ""); if (S.vault && ROUTES.indexOf(r) !== -1) { S.route = r; render(); window.scrollTo(0, 0); } });
    ["mousemove", "keydown", "click", "touchstart", "scroll", "wheel"].forEach(function (ev) { document.addEventListener(ev, function () { S.last = Date.now(); }, { passive: true, capture: true }); });
    setInterval(tick, 1000);
    try { var t = localStorage.getItem("sv-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
  }
  function tick() {
    var t = $("#lock-timer");
    if (!S.vault || S.readonly) { t.textContent = ""; return; }
    var left = (S.vault.settings.lockMin || 5) * 60 - Math.floor((Date.now() - S.last) / 1000);
    if (left <= 0) return lock("Vault locked after " + (S.vault.settings.lockMin || 5) + " minutes of inactivity.");
    t.textContent = left <= 60 ? "Locking in " + left + "s" : "Auto-lock " + Math.ceil(left / 60) + " min";
  }

  /* ---------- Home ---------- */
  // One list for every kind of date: documents, policies, medicine refills, warranties and the family's own checks.
  function remList(rem, limit) {
    if (!rem.length) return h("p", { class: "muted", text: "Nothing is due soon." });
    return h("ul", { class: "remlist" }, rem.slice(0, limit || 50).map(function (r) {
      var who = r.person && r.person !== "household" ? pname(r.person) : "";
      return h("li", { class: r.state }, badge(r.state === "expired" ? (r.src === "doc" ? "Expired" : "Overdue") : r.state === "soon" ? "Soon" : "Later", r.state),
        h("span", { class: "grow" }, h("a", { href: "#/" + r.route, text: r.title }), who ? " " : null, who ? h("span", { class: "muted", text: who }) : null),
        h("span", { text: K.dueText(r) + " (" + r.date + ")" }));
    }));
  }
  function reminderList(docs, limit) {
    var ids = new Set(docs.filter(function (d) { return visible(d.person); }).map(function (d) { return d.id; }));   // Set: linear, not docs x reminders
    return remList(K.allReminders(S.vault, V.todayStr()).filter(function (r) { return r.src === "doc" && ids.has(r.id); }), limit);
  }
  function vHome() {
    var v = S.vault, rem = K.allReminders(v, V.todayStr()), exp = rem.filter(function (r) { return r.state === "expired"; }).length, plans = 0, tot = 0, rd = K.readiness(v, V.todayStr());
    v.people.forEach(function (p) { var pg = K.planProgress(v, p.id); plans += pg.done; tot += pg.total; });
    var bk = v.settings.lastBackup ? V.daysUntil(V.todayStr(), v.settings.lastBackup) : null, wrap = h("div", null, section("Welcome to your vault", "Offline and encrypted. " + v.people.length + (v.people.length === 1 ? " person" : " people") + " in this family.",
      [btn("Emergency binder", "", function () { location.hash = "#/emergency"; })]));
    wrap.appendChild(h("div", { class: "stats" },
      stat(rd.pct + "%", "ready for a bad week", "emergency"), stat(v.docs.length, "documents", "docs"), stat(v.policies.length, "insurance policies", "insurance"), stat(Object.keys(v.health).length, "health records", "health"),
      stat(v.contacts.length + v.accounts.length, "contacts and accounts", "money"), stat(tot ? Math.round(plans * 100 / tot) + "%" : "0%", "planning done", "plan"), stat(v.inventory.length, "home items", "inventory")));
    wrap.appendChild(h("div", { class: "grid2 gap" },
      h("div", { class: "card" }, h("h2", { text: "Reminders and renewals" }), exp ? h("p", { class: "warn-text", text: exp + " overdue or expired. Deal with these first." }) : null, remList(rem, 8),
        h("a", { href: "#/reminders", text: rem.length > 8 ? "See all " + rem.length + " in Reminders" : "Open Reminders" })),
      h("div", { class: "card" }, h("h2", { text: "Family readiness " + rd.pct + "%" }), h("div", { class: "prog" }, h("span", { class: "prog-fill rd-fill" })),
        h("ul", { class: "readiness" }, rd.items.map(function (i) { return h("li", { class: i.done ? "done" : "" }, h("span", { class: "tick", "aria-hidden": "true", text: i.done ? "✓" : "○" }), i.done ? h("span", { text: i.label }) : h("a", { href: "#/" + i.route, text: i.label })); }))),
      h("div", { class: "card" }, h("h2", { text: "Keep it safe" }),
        h("ul", { class: "tips" }, tip(!ro() && (bk === null || bk > 90), bk === null ? "You have never made a backup. Make one in Sharing." : "Last backup was " + bk + " days ago. Make a fresh one in Sharing."),
          tip(true, "Tell a trusted person that this vault exists and where your passphrase is kept. If it is lost, the data cannot be recovered."),
          tip(true, "Store account numbers as the last 4 digits only. Never keep passwords or PINs here."),
          tip(true, "Lock the vault when you step away. It also locks itself after " + (v.settings.lockMin || 5) + " minutes.")))));
    $(".rd-fill", wrap).style.width = rd.pct + "%";
    if (!v.docs.length && !ro()) wrap.appendChild(h("div", { class: "card start" }, h("h2", { text: "Start here" }), h("ol", null,
      h("li", null, "Add everyone in the family under ", h("a", { href: "#/family", text: "Family" }), "."),
      h("li", null, "Add your key papers under ", h("a", { href: "#/docs", text: "Documents" }), " with their expiry dates, and your policies under ", h("a", { href: "#/insurance", text: "Insurance" }), "."),
      h("li", null, "Fill in a ", h("a", { href: "#/health", text: "Health" }), " summary and medicine list, and print the emergency card."),
      h("li", null, "Write the family ", h("a", { href: "#/emergency", text: "Emergency plan" }), " and print the binder."),
      h("li", null, "Work through the ", h("a", { href: "#/plan", text: "Planning" }), " checklist and the ", h("a", { href: "#/digital", text: "Digital" }), " legacy list."))));
    return wrap;
  }
  function stat(n, label, route) { return h("a", { class: "stat", href: "#/" + route }, h("b", { text: String(n) }), h("span", { text: label })); }
  function tip(show, text) { return show ? h("li", { text: text }) : null; }

  /* ---------- Documents ---------- */
  function docFields() {
    return [{ k: "person", label: "Whose document", type: "select", options: peopleOpts(false), req: true }, { k: "type", label: "Type", type: "select", options: C.DOC_TYPES, req: true },
      { k: "title", label: "Name", req: true, ph: "Passport, Home policy HP-..., Deed for 12 Oak St", wide: true }, { k: "issuer", label: "Issued by or company", ph: "Passport office, Acme Insurance" },
      { k: "ref", label: "Reference (last 4 only)", max: 4, ph: "1234", help: "Last 4 characters only. Never the full number." }, { k: "issued", label: "Issued on", type: "date" }, { k: "expires", label: "Expires or renews on", type: "date" },
      { k: "leadDays", label: "Remind me before", type: "select", options: [{ v: "30", l: "30 days" }, { v: "60", l: "60 days" }, { v: "90", l: "90 days" }, { v: "180", l: "6 months" }, { v: "365", l: "1 year" }] },
      { k: "location", label: "Where the original is kept", ph: "Fireproof box, bank safe deposit, attorney's office", wide: true }, { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true },
      { k: "scan", label: "Scan or photo (JPG, PNG or PDF up to 4 MB)", type: "scan", wide: true }];
  }
  function editDoc(d) {
    d = d || { id: V.uid(), person: S.person !== "all" ? S.person : S.vault.people[0].id, leadDays: "60" };
    U.openForm(S.vault.docs.indexOf(d) < 0 ? "Add document" : "Edit document", docFields(), d, function (o) {
      o.ref = V.cleanLast4(o.ref); o.id = d.id; upsert(S.vault.docs, o); save(); render();
    });
  }
  function vDocs() {
    var wrap = h("div", null, section("Documents", "IDs, insurance, deeds, titles and certificates, with scans and renewal reminders.", [ro() ? null : btn("Add document", "primary", function () { editDoc(); })])),
      docs = S.vault.docs.filter(function (d) { return visible(d.person); }), f = personFilterBar(), today = V.todayStr();
    if (f) wrap.appendChild(f);
    var rem = V.reminders(docs, today); if (rem.length) wrap.appendChild(h("div", { class: "card alert" }, h("h2", { text: "Needs attention" }), reminderList(docs)));
    if (!docs.length && !ro() && S.vault.docs.length === 0) wrap.appendChild(h("p", { class: "fine", text: "Insurance policies have their own page with renewal dates, claims numbers and agents: see Insurance." }));
    if (!docs.length) { wrap.appendChild(empty("No documents yet. Add a passport, an insurance policy or a deed and set its expiry date.")); return wrap; }
    docs.sort(function (a, b) { var x = V.daysUntil(a.expires, today), y = V.daysUntil(b.expires, today); return (x === null ? 1e9 : x) - (y === null ? 1e9 : y); });
    wrap.appendChild(h("div", { class: "cards" }, docs.map(function (d) {
      var r = V.reminderStatus(d, today);
      return h("article", { class: "card item " + r.state }, h("div", { class: "item-top" }, h("h3", { text: d.title }), r.state !== "none" ? badge(r.state === "ok" ? "Valid" : r.state === "soon" ? "Renew soon" : "Expired", r.state) : badge("No expiry")),
        h("p", { class: "muted", text: d.type + " · " + pname(d.person) }),
        h("dl", null, row("Expires", r.state === "none" ? "none" : d.expires + " (" + V.reminderText({ state: r.state === "ok" ? "soon" : r.state, days: r.days }) + ")"), row("Reminder on", r.remindOn), row("Issued by", d.issuer), row("Reference", d.ref ? "ending " + d.ref : ""), row("Original kept", d.location), row("Notes", d.notes)),
        h("div", { class: "row tight wrap" }, d.scan ? btn("View scan", "small", function () { U.viewScan(d.scan, d.title); }) : badge("No scan", "mute"),
          !ro() && d.expires ? btn("Mark renewed", "small", function () { renewDoc(d); }) : null, actions(d, S.vault.docs, editDoc)));
    })));
    return wrap;
  }
  function row(k, v) { return v ? h("div", { class: "kv" }, h("dt", { text: k }), h("dd", { text: String(v) })) : null; }
  function renewDoc(d) {
    var next = V.addYears(d.expires, 5) || "";
    U.openForm("Mark renewed: " + d.title, [{ k: "expires", label: "New expiry date", type: "date", req: true }, { k: "scan", label: "New scan (optional)", type: "scan", wide: true }], { expires: next }, function (o) {
      d.expires = o.expires; if (o.scan) d.scan = o.scan; save(); render();
    });
  }

  /* ---------- Health ---------- */
  var HF = [{ k: "blood", label: "Blood type", type: "select", options: C.BLOOD }, { k: "donor", label: "Organ donor", type: "select", options: ["", "Yes", "No", "Not decided"] },
    { k: "allergies", label: "Allergies and reactions", type: "textarea", wide: true, ph: "Penicillin (rash), peanuts (severe)" },
    { k: "meds", label: "Medications and doses", type: "textarea", wide: true, ph: "Metformin 500 mg twice daily" },
    { k: "conditions", label: "Conditions and past surgeries", type: "textarea", wide: true }, { k: "doctors", label: "Doctors and clinics", type: "textarea", wide: true, ph: "Dr Lee (family doctor) 555-0100" },
    { k: "insurer", label: "Health insurer and member ID (last 4)", ph: "Acme Health, member ending 4821" }, { k: "vacc", label: "Vaccinations and dates", type: "textarea", wide: true },
    { k: "notes", label: "Other notes for responders", type: "textarea", wide: true }];
  function vHealth() {
    var wrap = h("div", null, section("Health", "A medical summary for each person, and a printable emergency card."));
    wrap.appendChild(h("p", { class: "fine", text: "General record keeping, not medical advice. Keep it accurate and ask your doctor about anything you are unsure of." }));
    var f = personFilterBar(); if (f) wrap.appendChild(f);
    var people = S.vault.people.filter(function (p) { return visible(p.id); });
    wrap.appendChild(h("div", { class: "cards" }, people.map(function (p) {
      var hr = S.vault.health[p.id];
      return h("article", { class: "card item" }, h("div", { class: "item-top" }, h("h3", { text: p.name }), hr && hr.blood ? badge("Blood " + hr.blood, "ok") : badge("No record", "mute")),
        hr ? h("dl", null, HF.map(function (x) { return row(x.label.replace(/ \(.*$/, ""), hr[x.k]); }), row("Updated", hr.updated)) : h("p", { class: "muted", text: "No health summary yet." }),
        h("div", { class: "row tight wrap" }, ro() ? null : btn(hr ? "Edit summary" : "Add summary", "small primary", function () { editHealth(p); }),
          hr ? btn("Emergency card", "small", function () { showCard(p); }) : null));
    })));
    if (A.ext.medsCard) wrap.appendChild(A.ext.medsCard(people));
    return wrap;
  }
  function medsLine(pid) {
    return S.vault.meds.filter(function (m) { return m.person === pid && m.active !== false; }).map(function (m) { return m.name + (m.dose ? " " + m.dose : "") + (m.how ? ", " + m.how : ""); }).join("\n");
  }
  function editHealth(p) {
    var cur = S.vault.health[p.id] || {};
    U.openForm("Health summary: " + p.name, HF, cur, function (o) { o.updated = V.todayStr(); S.vault.health[p.id] = o; save(); render(); });
  }
  function cardEl(p) {
    var hr = S.vault.health[p.id] || {}, ecs = S.vault.contacts.filter(function (c) { return c.emergency; }), line = function (k, v) { return v ? h("div", { class: "ec-row" }, h("b", { text: k }), h("span", { text: v })) : null; };
    return h("div", { class: "ecard" }, h("div", { class: "ec-head" }, h("span", { text: "EMERGENCY MEDICAL CARD" }), h("small", { text: "Stark Family Vault" })),
      h("div", { class: "ec-name", text: p.name + (p.dob ? "  ·  born " + p.dob : "") }),
      line("Blood type", hr.blood), line("Allergies", hr.allergies), line("Medications", [medsLine(p.id), hr.meds].filter(Boolean).join("\n")), line("Conditions", hr.conditions), line("Doctors", hr.doctors), line("Insurance", hr.insurer), line("Organ donor", hr.donor), line("Notes", hr.notes),
      ecs.length ? h("div", { class: "ec-contacts" }, h("b", { text: "In an emergency call" }), ecs.map(function (c) { return h("div", { text: c.name + (c.rel ? " (" + c.rel + ")" : "") + "  " + (c.phone || "") }); })) : line("Emergency contacts", "Add them under Money and contacts"),
      h("small", { class: "ec-foot", text: "Printed " + V.todayStr() + ". Check this is up to date." }));
  }
  function printNode(node) {
    var pr = U.clear($("#print-root")); pr.appendChild(node); document.body.classList.add("printing");
    var after = function () { document.body.classList.remove("printing"); U.clear($("#print-root")); window.removeEventListener("afterprint", after); };
    window.addEventListener("afterprint", after); setTimeout(function () { window.print(); }, 50);
  }
  function showCard(p) {
    var body = h("div", { class: "dlg-body" }, cardEl(p), h("p", { class: "fine", text: "Print it, trim along the edge, and keep one in your wallet and one on the fridge. Printed copies are not encrypted: treat them like cash." }),
      h("div", { class: "row end" }, btn("Print card", "primary", function () { printNode(cardEl(p)); })));
    U.modal("Emergency card: " + p.name, body, { wide: true });
  }

  /* ---------- Money and contacts ---------- */
  function vMoney() {
    var wrap = h("div", null, section("Money and contacts", "Who to call, and which institutions hold the money.", [ro() ? null : btn("Add contact", "", function () { editContact(); }), ro() ? null : btn("Add account", "primary", function () { editAccount(); })]));
    wrap.appendChild(h("div", { class: "banner warn" }, h("strong", { text: "Store the institution and the last 4 digits only. " }), "Never put full account or card numbers, passwords, PINs or security codes in this vault. The point is to tell your family whom to call, and the bank will verify them. The app blocks entries that look like full numbers or passwords."));
    wrap.appendChild(h("h2", { text: "Emergency contacts and people to call" }));
    var cs = S.vault.contacts.slice().sort(function (a, b) { return (b.emergency ? 1 : 0) - (a.emergency ? 1 : 0); });
    wrap.appendChild(cs.length ? h("div", { class: "cards" }, cs.map(function (c) {
      return h("article", { class: "card item" }, h("div", { class: "item-top" }, h("h3", { text: c.name }), c.emergency ? badge("Emergency", "expired") : badge(c.role || "Contact", "mute")),
        h("dl", null, row("Role", c.role), row("Relationship", c.rel), row("Phone", c.phone), row("Email", c.email), row("Notes", c.notes)), actions(c, S.vault.contacts, editContact));
    })) : empty("No contacts yet. Add at least two people to call in an emergency."));
    wrap.appendChild(h("h2", { text: "Financial accounts (last 4 digits only)" }));
    wrap.appendChild(S.vault.accounts.length ? h("div", { class: "cards" }, S.vault.accounts.map(function (a) {
      return h("article", { class: "card item" }, h("div", { class: "item-top" }, h("h3", { text: a.institution }), badge(a.kind || "Account", "mute")),
        h("dl", null, row("Account", a.last4 ? "ending " + a.last4 : ""), row("Owner", a.owner ? pname(a.owner) : ""), row("Contact", a.contact), row("Notes", a.notes)), actions(a, S.vault.accounts, editAccount));
    })) : empty("No accounts listed yet."));
    return wrap;
  }
  function editContact(c) {
    c = c || { id: V.uid() };
    U.openForm(S.vault.contacts.indexOf(c) < 0 ? "Add contact" : "Edit contact", [{ k: "name", label: "Name", req: true }, { k: "role", label: "Role", type: "select", options: C.CONTACT_ROLES }, { k: "rel", label: "Relationship", ph: "Sister, family doctor" },
      { k: "phone", label: "Phone", type: "tel", max: 40 }, { k: "email", label: "Email", type: "email", wide: true }, { k: "emergency", label: "Show on the emergency card", type: "checkbox", wide: true },
      { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true }], c, function (o) { o.id = c.id; upsert(S.vault.contacts, o); save(); render(); });
  }
  function editAccount(a) {
    a = a || { id: V.uid(), owner: S.vault.people[0].id };
    U.openForm(S.vault.accounts.indexOf(a) < 0 ? "Add account" : "Edit account", [{ k: "institution", label: "Bank or institution", req: true, wide: true }, { k: "kind", label: "Kind", type: "select", options: C.ACCOUNT_KINDS },
      { k: "last4", label: "Last 4 digits only", max: 4, inputmode: "numeric", ph: "1234", help: "Only the last four. Longer entries are cut down automatically." }, { k: "owner", label: "Owner", type: "select", options: peopleOpts(false) },
      { k: "contact", label: "Phone or website to contact them", ph: "Branch phone number" }, { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true, help: "No passwords, PINs or full numbers." }], a, function (o) {
      o.last4 = V.cleanLast4(o.last4); o.id = a.id; upsert(S.vault.accounts, o); save(); render();
    });
  }

  /* ---------- Planning ---------- */
  function vPlan() {
    var wrap = h("div", null, section("Planning", "An estate planning checklist and an \"if something happens to me\" letter."));
    wrap.appendChild(h("div", { class: "banner" }, h("strong", { text: "General information, not legal advice. " }), "Laws about wills, trusts, powers of attorney and taxes differ by country and state and change over time. Use this list to get organised, then see an attorney or notary to make it valid."));
    var juris = S.vault.settings.juris || [];
    wrap.appendChild(h("details", { class: "card juris", open: !juris.length && !ro() }, h("summary", null, h("strong", { text: "Where you live and what applies" }), " ",
      h("span", { class: "muted", text: juris.length ? juris.length + " selected" : "none selected" })),
      h("p", { class: "fine", text: "Tick every type that fits your family. Each one adds questions to take to a qualified local professional. This is organisation help, not legal advice: rules differ by country and state and change over time, and nothing here says what the law is where you live." }),
      h("div", { class: "jgrid" }, C.JURISDICTIONS.map(function (j) {
        return h("label", { class: "chk jur" }, h("input", { type: "checkbox", id: "jur-" + j.id, checked: juris.indexOf(j.id) !== -1, disabled: ro(), onchange: function (e) {
          var s = S.vault.settings.juris = (S.vault.settings.juris || []).filter(function (x) { return x !== j.id; }); if (e.target.checked) s.push(j.id); save(); render(); } }),
          h("span", null, h("b", { text: j.label }), h("span", { class: "fine block", text: j.ex })));
      }))));
    var f = personFilterBar(); if (f) wrap.appendChild(f);
    var items = K.checklistFor(juris);
    S.vault.people.filter(function (p) { return visible(p.id); }).forEach(function (p) {
      var pl = S.vault.plan[p.id] = S.vault.plan[p.id] || { checks: {}, letter: {} }, checks = pl.checks = pl.checks || {}, done = items.filter(function (i) { return checks[i.id] && checks[i.id].done; }).length,
        roles = pl.roles || {}, wishes = pl.wishes || {}, nw = C.WISHES.filter(function (x) { return wishes[x.k]; }).length;
      wrap.appendChild(h("section", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: p.name }), badge(done + " of " + items.length + " done", done === items.length ? "ok" : "soon")),
        h("div", { class: "prog" }, h("span", { class: "prog-fill" })),
        h("ul", { class: "checklist" }, items.map(function (i) {
          var st = checks[i.id] || {}, cb = h("input", { type: "checkbox", id: "ck-" + p.id + i.id, checked: !!st.done, disabled: ro(), onchange: function (e) { checks[i.id] = { done: e.target.checked, note: st.note || "", date: e.target.checked ? V.todayStr() : "" }; save(); render(); } });
          return h("li", null, cb, h("div", null, h("label", { for: "ck-" + p.id + i.id, text: i.title }), i.group ? h("span", { class: "tag", text: i.group }) : null, h("p", { class: "fine", text: i.why }),
            st.done && st.date ? h("p", { class: "fine", text: "Done " + st.date + (st.note ? ". " + st.note : "") }) : null,
            ro() ? null : btn(st.note ? "Edit note" : "Add note", "tiny", function () { U.openForm(i.title, [{ k: "note", label: "Note (where it is, who has it)", type: "textarea", wide: true, warn: true }], st, function (o) { checks[i.id] = { done: !!st.done, note: o.note, date: st.date || "" }; save(); render(); }); })));
        })),
        h("div", { class: "grid2" },
          h("div", null, h("h3", { text: "Key roles" }), C.ROLES.some(function (r) { return roles[r.k]; }) ? h("dl", null, C.ROLES.map(function (r) { return row(r.label, roles[r.k]); })) : h("p", { class: "muted", text: "Not recorded yet: executor, guardians, powers of attorney." })),
          h("div", null, h("h3", { text: "Final wishes" }), nw ? h("dl", null, C.WISHES.map(function (x) { return row(x.label, wishes[x.k]); })) : h("p", { class: "muted", text: "Not recorded yet." }))),
        h("div", { class: "row wrap" }, btn("Letter: if something happens to me", "primary", function () { letterBuilder(p); }),
          ro() ? null : btn("Key roles", "", function () { editRoles(p); }), ro() ? null : btn("Final wishes", "", function () { editWishes(p); }))));
      $(".prog-fill", wrap.lastChild).style.width = Math.round(done * 100 / items.length) + "%";
    });
    return wrap;
  }
  function editRoles(p) {
    var pl = S.vault.plan[p.id];
    U.openForm("Key roles: " + p.name, C.ROLES.map(function (r) { return { k: r.k, label: r.label, ph: "Name, and how to reach them", warn: true }; }), pl.roles || {}, function (o) { pl.roles = o; save(); render(); },
      h("p", { class: "fine", text: "Ask each person before you name them, and record the same names in your legal documents. Writing a name here does not appoint anyone." }));
  }
  function editWishes(p) {
    var pl = S.vault.plan[p.id];
    U.openForm("Final wishes: " + p.name, C.WISHES.map(function (x) { return { k: x.k, label: x.label, type: "textarea", wide: true, rows: 2, ph: x.ph, max: 2000 }; }), pl.wishes || {}, function (o) { o.updated = V.todayStr(); pl.wishes = o; save(); render(); },
      h("p", { class: "fine", text: "Personal wishes to guide your family. They are not a legal instruction; some wishes, such as organ donation, may also need registering where you live." }));
  }
  function letterText(p) { return K.letterText(S.vault, p); }
  function letterBuilder(p) {
    var pl = S.vault.plan[p.id], cur = pl.letter || {}, fields = C.LETTER.map(function (q) { return { k: q.k, label: q.label, type: "textarea", wide: true, ph: q.ph, warn: true, rows: 3, max: 3000 }; });
    var dlg = U.openForm("Letter by " + p.name, fields, cur, function (o) { o.date = V.todayStr(); pl.letter = o; save(); render(); },
      h("div", { class: "row wrap" }, btn("Preview and print", "", function () {
        var o = {}; fields.forEach(function (f) { o[f.k] = $("#f-" + f.k).value; }); o.date = V.todayStr(); pl.letter = o; save();
        var pre = h("pre", { class: "letter", text: letterText(p) });
        U.modal("Letter preview", h("div", { class: "dlg-body" }, pre, h("p", { class: "fine", text: "A printed copy is not encrypted. Keep it with your papers, not in a public place." }),
          h("div", { class: "row end" }, btn("Print", "primary", function () { printNode(h("pre", { class: "letter", text: letterText(p) })); }))), { wide: true });
      })));
    return dlg;
  }

  /* ---------- Home inventory ---------- */
  function vInventory() {
    var inv = S.vault.inventory, total = K.invTotal(inv), rooms = {};
    inv.forEach(function (x) { rooms[x.room || "Other"] = (rooms[x.room || "Other"] || 0) + K.itemTotal(x); });
    var wrap = h("div", null, section("Home inventory", "Photos, receipts and values for insurance claims.", [btn("Claim report", "", claimDialog), btn("Spreadsheet (CSV)", "", exportCSV),
      btn("Print list", "", function () { printNode(invPrint()); }), ro() ? null : btn("Add item", "primary", function () { editItem(); })]));
    wrap.appendChild(h("div", { class: "stats" }, h("div", { class: "stat" }, h("b", { text: money(total) }), h("span", { text: "total value (your currency)" })), h("div", { class: "stat" }, h("b", { text: String(inv.length) }), h("span", { text: "items" })),
      Object.keys(rooms).sort().map(function (r) { return h("div", { class: "stat small" }, h("b", { text: money(rooms[r]) }), h("span", { text: r })); })));
    if (!inv.length) { wrap.appendChild(empty("No items yet. Walk through each room and photograph what you would need to replace.")); return wrap; }
    wrap.appendChild(h("p", { class: "fine", text: "Tip: photograph each room from every corner too, and keep receipts for valuable things. After a loss, the claim report prints every item with its photos and receipts." }));
    wrap.appendChild(h("div", { class: "cards photos" }, inv.slice().sort(function (a, b) { return (a.room || "").localeCompare(b.room || "") || a.item.localeCompare(b.item); }).map(function (x) {
      var pics = ["photo", "photo2", "photo3"].filter(function (k) { return x[k] && x[k].data; }), q = +x.qty > 1 ? +x.qty : 1;
      return h("article", { class: "card item" }, pics.length ? h("img", { class: "thumb", src: x[pics[0]].data, alt: x.item }) : h("div", { class: "thumb none", text: "No photo" }),
        h("div", { class: "item-top" }, h("h3", { text: x.item + (q > 1 ? " ×" + q : "") }), badge(money(K.itemTotal(x)), "ok")),
        h("dl", null, row("Room", x.room), row("Brand and model", x.brand), row("Bought", x.purchased), row("Serial", x.serial), row("Value each", q > 1 ? money(x.value) : ""), row("Warranty ends", x.warranty), row("Notes", x.notes)),
        h("div", { class: "row tight wrap" }, pics.length > 1 ? badge(pics.length + " photos", "mute") : null, x.receipt ? btn("Receipt", "small", function () { U.viewScan(x.receipt, "Receipt: " + x.item); }) : badge("No receipt", "mute"),
          pics.length > 1 ? btn("Photos", "small", function () { showPhotos(x, pics); }) : null, actions(x, S.vault.inventory, editItem)));
    })));
    return wrap;
  }
  function showPhotos(x, pics) {
    U.modal(x.item, h("div", { class: "dlg-body" }, h("div", { class: "photogrid" }, pics.map(function (k) { return h("img", { src: x[k].data, alt: x.item }); }))), { wide: true });
  }
  function invPrint() {
    var inv = S.vault.inventory.slice().sort(function (a, b) { return (a.room || "").localeCompare(b.room || ""); });
    return h("div", { class: "invprint" }, h("h1", { text: "Home inventory, " + V.todayStr() }), h("table", null, h("thead", null, h("tr", null, ["Room", "Item", "Qty", "Bought", "Serial or model", "Value"].map(function (t) { return h("th", { text: t }); }))),
      h("tbody", null, inv.map(function (x) { return h("tr", null, h("td", { text: x.room || "" }), h("td", { text: x.item }), h("td", { class: "num", text: String(+x.qty > 1 ? +x.qty : 1) }), h("td", { text: x.purchased || "" }), h("td", { text: [x.brand, x.serial].filter(Boolean).join(", ") }), h("td", { class: "num", text: money(K.itemTotal(x)) })); })),
      h("tfoot", null, h("tr", null, h("td", { colspan: 5, text: "Total" }), h("td", { class: "num", text: money(K.invTotal(inv)) })))));
  }
  function exportCSV() { window.StarkTrial.show("exports"); }
  function claimDialog() { window.StarkTrial.show("claim_report"); }
  function editItem(x) {
    x = x || { id: V.uid(), qty: "1" };
    U.openForm(S.vault.inventory.indexOf(x) < 0 ? "Add item" : "Edit item", [{ k: "item", label: "Item", req: true, wide: true }, { k: "room", label: "Room", type: "select", options: [""].concat(C.ROOMS) },
      { k: "qty", label: "Quantity", type: "number", min: 1, step: 1, inputmode: "numeric" }, { k: "value", label: "Value to replace (each)", type: "number", min: 0, step: "any", inputmode: "decimal" },
      { k: "brand", label: "Brand and model" }, { k: "serial", label: "Serial number" }, { k: "purchased", label: "Bought on", type: "date" }, { k: "warranty", label: "Warranty ends", type: "date", help: "Shows in Reminders." },
      { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true }, { k: "photo", label: "Main photo", type: "photo", wide: true }, { k: "photo2", label: "Second photo (another angle or the label)", type: "photo", wide: true },
      { k: "photo3", label: "Third photo", type: "photo", wide: true }, { k: "receipt", label: "Receipt or proof of purchase (picture or PDF)", type: "scan", wide: true }], x, function (o) { o.id = x.id; upsert(S.vault.inventory, o); save(); render(); });
  }

  /* ---------- Sharing ---------- */
  function stamp() { return V.todayStr(); }
  function vShare() {
    var wrap = h("div", null, section("Sharing", "Give a trusted person an encrypted copy, or back up the whole vault."));
    if (ro()) { wrap.appendChild(h("p", { class: "muted", text: "Sharing is turned off in a read-only view." })); return wrap; }
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Export a share file" }),
      h("p", { class: "muted", text: "Choose what to include. The file is encrypted with its own passphrase, so you can send it by email or USB. Give the passphrase over a different channel, such as a phone call." }), shareForm()));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Open or import a share file" }),
      h("p", { class: "muted", text: "Add what a family member shared with you into your own vault. People are matched by name and everything gets new entries, so nothing is overwritten." }),
      btn("Choose a share file", "", function () {
        U.pickFile().then(function (f) {
          if (!f) return; if (!f.env || f.env.format !== V.FORMAT) return U.toast("That file is not a Stark Family Vault file.", true);
          if (f.env.kind !== "share") return U.toast("That is a full backup. Restore it from the lock screen instead.", true);
          askPass("Import shared file", "Enter the passphrase for " + f.name + ".", function (pw) {
            return V.openVault(f.env, pw).then(function (r) { var a = V.mergeInto(S.vault, r.data); save(); render(); U.toast((r.legacy ? "No checksum, validated. " : "") + "Imported " + a.docs + " documents, " + a.people + " new people, " + (a.contacts + a.accounts + a.inventory) + " other entries."); });
          });
        });
      })));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Backup of the whole vault" }),
      h("p", { class: "muted", text: "The vault lives only in this browser's storage. Clearing site data, a new computer or a reinstall would lose it. Save a backup file to a USB drive or another safe place. It is encrypted with your current passphrase." }),
      h("p", { class: "fine", text: S.vault.settings.lastBackup ? "Last backup: " + S.vault.settings.lastBackup : "No backup yet." }),
      btn("Save a backup file", "primary", function () {
        U.toast("Encrypting backup...");
        S.vault.settings.lastBackup = stamp();
        flush().then(function (env) { U.downloadText("family-vault-backup-" + stamp() + ".starkvault", JSON.stringify(env), "application/json"); render(); U.toast("Backup saved. Keep it somewhere safe, away from this computer."); })
          .catch(function () { return null; });   // persist() already showed why
      })));
    return wrap;
  }
  function shareForm() {
    var secs = [["docs", "Documents"], ["health", "Health summaries"], ["meds", "Medicine lists"], ["contacts", "Contacts"], ["accounts", "Accounts (last 4)"], ["policies", "Insurance policies"],
      ["plan", "Planning: checklist, key roles, wishes, letter"], ["digital", "Digital accounts and devices"], ["emergency", "Emergency plan"], ["tasks", "Repeating checks"], ["inventory", "Home inventory"]], st = false, msg = h("p", { class: "form-err", id: "share-err", role: "alert", hidden: true });
    var pf = U.passField("share-pass", "Passphrase for this share file (different from your vault passphrase)", function (s) { st = s; }), note = h("input", { id: "share-note", type: "text", maxlength: 200, placeholder: "Optional note for the recipient" });
    return h("form", { class: "form", novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var people = S.vault.people.filter(function (p) { return $("#sp-" + p.id).checked; }).map(function (p) { return p.id; }), sections = secs.filter(function (s) { return $("#ss-" + s[0]).checked; }).map(function (s) { return s[0]; }), pw = pf.input.value;
      msg.hidden = false;
      if (!people.length || !sections.length) return (msg.textContent = "Choose at least one person and one section.");
      U.markField(pf.input, null);
      // The file leaves this computer, so it needs the full "Strong" bar (12+ characters, score 3+).
      if (pw.length < 12 || !st || !st.ok) { U.markField(pf.input, msg.id); pf.input.focus(); return (msg.textContent = "Use a stronger passphrase for the share file: at least 12 characters and rated Strong, because the file leaves this computer."); }
      msg.textContent = "Encrypting...";
      V.exportShare(S.vault, { people: people, sections: sections, scans: $("#share-scans").checked, hints: $("#share-hints").checked, note: note.value.trim() }, pw).then(function (env) {
        U.downloadText("family-share-" + stamp() + ".starkvault", JSON.stringify(env), "application/json"); msg.textContent = "Saved. Send the file, then tell them the passphrase separately."; pf.input.value = "";
      }).catch(function (x) { msg.textContent = "The share file could not be made: " + (x && x.message ? x.message : "unknown error"); });
    } },
      h("fieldset", null, h("legend", { text: "People" }), S.vault.people.map(function (p) { return h("label", { class: "chk" }, h("input", { type: "checkbox", id: "sp-" + p.id, checked: true }), p.name); })),
      h("fieldset", null, h("legend", { text: "Sections" }), secs.map(function (s) { return h("label", { class: "chk" }, h("input", { type: "checkbox", id: "ss-" + s[0], checked: ["docs", "health", "meds", "contacts", "emergency"].indexOf(s[0]) !== -1 }), s[1]); }),
        h("label", { class: "chk" }, h("input", { type: "checkbox", id: "share-scans" }), "Include scans and photos (makes the file larger)"),
        h("label", { class: "chk" }, h("input", { type: "checkbox", id: "share-hints" }), "Include password hints in Digital (hints only, never passwords)")),
      h("div", { class: "field wide" }, h("label", { for: "share-note", text: "Note" }), note), pf.el, msg,
      h("p", { class: "fine", text: "The recipient opens it with this app, using Other ways in on the lock screen. Anyone with both the file and the passphrase can read it, so share carefully." }),
      h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary", text: "Create share file" })));
  }

  /* ---------- Family ---------- */
  function vFamily() {
    var wrap = h("div", null, section("Family", "A profile for each family member. Documents, health and planning are kept per person.", [ro() ? null : btn("Add person", "primary", function () { editPerson(); })]));
    wrap.appendChild(h("div", { class: "cards" }, S.vault.people.map(function (p) {
      var n = S.vault.docs.filter(function (d) { return d.person === p.id; }).length;
      return h("article", { class: "card item" }, h("div", { class: "item-top" }, h("h3", { text: p.name }), badge(p.rel || "Family", "mute")), h("dl", null, row("Born", p.dob), row("Documents", n)),
        ro() ? null : h("div", { class: "row tight" }, btn("Edit", "small", function () { editPerson(p); }), S.vault.people.length > 1 ? btn("Remove", "small danger-o", function () {
          U.confirmBox("Remove " + p.name + "?", "This also deletes their " + n + " documents, health summary, medicines, digital accounts and planning notes from the vault. Their insurance policies and reminders move to the household.", "Remove", true).then(function (ok) {
            if (!ok) return; var v = S.vault, gone = function (x) { return x.person !== p.id; };
            v.people.splice(v.people.indexOf(p), 1); v.docs = v.docs.filter(gone); v.meds = v.meds.filter(gone); v.digital = v.digital.filter(gone); delete v.health[p.id]; delete v.plan[p.id];
            v.policies.concat(v.tasks).forEach(function (x) { if (x.person === p.id) x.person = "household"; }); S.person = "all"; save(); render();
          });
        }) : null));
    })));
    return wrap;
  }
  function editPerson(p) {
    p = p || { id: V.uid() };
    U.openForm(S.vault.people.indexOf(p) < 0 ? "Add person" : "Edit person", [{ k: "name", label: "Name", req: true }, { k: "rel", label: "Relationship", ph: "Spouse, child, parent" }, { k: "dob", label: "Date of birth", type: "date" }], p, function (o) { o.id = p.id; upsert(S.vault.people, o); save(); render(); });
  }

  /* ---------- Settings ---------- */
  function vSettings() {
    var wrap = h("div", null, section("Settings", "Security and housekeeping."));
    if (ro()) { wrap.appendChild(h("p", { class: "muted", text: "Settings are not available in a read-only view." })); return wrap; }
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Auto-lock" }), h("p", { class: "muted", text: "The vault locks when there has been no mouse, keyboard or touch activity for this long. Unsaved work is saved first." }),
      h("div", { class: "field" }, h("label", { for: "lockmin", text: "Lock after" }), h("select", { id: "lockmin", onchange: function (e) { S.vault.settings.lockMin = +e.target.value; save(); tick(); } },
        [1, 2, 5, 10, 15, 30].map(function (m) { return h("option", { value: m, text: m + (m === 1 ? " minute" : " minutes"), selected: m === (S.vault.settings.lockMin || 5) }); })))));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Change passphrase" }), changePass()));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "How your data is protected" }), h("ul", { class: "tips" },
      h("li", { text: "Encryption: AES-256-GCM. The key comes from your passphrase with PBKDF2-SHA256, " + V.KDF_ITER.toLocaleString() + " iterations and a random salt." }),
      h("li", { text: "Tamper detection: GCM authenticates the data. A changed or corrupted file is refused, never half-opened. Each save carries a counter bound to the data, so an older copy put back in this browser's storage in place of a newer one is noticed on unlock (not when the whole browser profile is put back)." }),
      h("li", { text: "Imported files may use between " + V.MIN_ITER.toLocaleString("en") + " and " + V.MAX_ITER.toLocaleString("en") + " iterations. A vault opened from a file with fewer than " + V.KDF_ITER.toLocaleString("en") + " is re-encrypted at full strength." }),
      h("li", { text: "Your passphrase is never stored. Only the derived key is held in memory while the vault is open, and it is dropped when you lock." }),
      h("li", { text: "No network: this page blocks all connections. There is no account, server, analytics or cloud." }),
      h("li", { text: "Honest limits: it cannot protect you from malware on this computer, a weak passphrase, or someone watching you type. Printed pages and saved scans are not encrypted. A lost passphrase cannot be recovered." }))));
    if (A.ext.settingsCards) A.ext.settingsCards(wrap);
    var mb = K.vaultSize(S.vault) / 1048576;
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "About" }), h("p", { text: "Stark Family Vault " + V.VERSION + ", by Stark. Works offline; nothing is ever sent anywhere." }), h("p", { class: "lang-note", text: "This translation is a machine draft, not yet reviewed by a native speaker. To suggest a correction, use the Send feedback button." }),
      h("p", { class: "fine", text: "Vault size: " + (mb < 0.1 ? "under 0.1" : mb.toFixed(1)) + " MB, most of it scans and photos. Large vaults save and back up more slowly, so keep scans to what you need." + (mb > 80 ? " Your vault is large: consider removing old scans." : "") })));
    wrap.appendChild(h("div", { class: "card danger-zone" }, h("h2", { text: "Erase" }), h("p", { class: "muted", text: "Deletes the vault from this computer. Make a backup first if you might want it again." }),
      btn("Erase vault", "danger", function () { U.confirmBox("Erase everything?", "Your vault will be deleted from this computer. This cannot be undone without a backup file.", "Erase everything", true).then(function (ok) { if (ok) U.storeClear().then(function () { S.vault = null; S.session = null; lock(); }); }); })));
    return wrap;
  }
  function changePass() {
    var cur = h("input", { id: "cur-pass", type: "password", autocomplete: "current-password" }), st = false, pf = U.passField("new-pass", "New passphrase", function (s) { st = s; }), msg = h("p", { class: "form-err", id: "cp-err", hidden: true, role: "alert" });
    return h("form", { class: "form", novalidate: true, onsubmit: function (e) {
      e.preventDefault(); msg.hidden = false; U.markField(cur, null); U.markField(pf.input, null);
      if (pf.input.value.length < 12 || !st || !st.ok) { U.markField(pf.input, msg.id); return (msg.textContent = "The new passphrase is too weak. Use at least 12 characters and aim for Strong."); }
      msg.textContent = "Checking and re-encrypting...";
      V.checkPass(S.session, cur.value).then(function (right) {
        if (!right) { U.markField(cur, msg.id); cur.focus(); msg.textContent = "The current passphrase is wrong."; return; }
        return flush().then(function () { return V.newSession(pf.input.value, "vault"); }).then(function (sess) {
          var prev = S.session; sess.n = prev.n || 0; S.session = sess;
          return persist().then(function () { cur.value = pf.input.value = ""; msg.textContent = "Passphrase changed. Old backup files still need the old passphrase."; U.toast("Passphrase changed."); },
            function (x) { S.session = prev; msg.textContent = "Not changed: " + (x && x.message ? x.message : "the new copy could not be saved") + " Your old passphrase still works."; });
        });
      }).catch(function (x) { msg.textContent = "Not changed: " + (x && x.message ? x.message : "unknown error"); });
    } }, h("div", { class: "field wide" }, h("label", { for: "cur-pass", text: "Current passphrase" }), cur), pf.el, msg, h("div", { class: "row" }, h("button", { type: "submit", class: "btn", text: "Change passphrase" })));
  }

  /* ---------- boot ---------- */
  window.__vault = { state: S, lock: lock, render: render };
  // Shared helpers for the views in views2.js (same closure rules: build with textContent, never markup).
  A.S = S; A.btn = btn; A.section = section; A.empty = empty; A.badge = badge; A.save = save; A.render = render; A.row = row; A.pname = pname; A.peopleOpts = peopleOpts;
  A.visible = visible; A.ro = ro; A.personFilterBar = personFilterBar; A.actions = actions; A.upsert = upsert; A.byId = byId; A.printNode = printNode; A.money = money; A.stamp = stamp; A.remList = remList;
  // Boot once every script (including views2.js) has run.
  document.addEventListener("DOMContentLoaded", function () { buildShell(); lockScreen(); });
})();
