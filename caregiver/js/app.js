/* Stark Caregiver, by Stark: app shell, lock screen, Today, health, care team, documents, people, sharing and settings.
   Offline; the only thing ever stored is the encrypted care record. Built with textContent, never parsed markup. */
(function () {
  "use strict";
  var V = CareCore, C = CareContent, U = CareUI, K = CareKit, L = CareLogic, h = U.h, $ = U.$;
  var S = { vault: null, session: null, readonly: false, demo: false, person: "all", route: "home", last: 0, saveTimer: null, saving: Promise.resolve(), shareInfo: null, q: "", by: "" };
  var NAV = [["home", "Today"], ["radar", "Radar"], ["ask", "Ask"], ["meds", "Medicines"], ["diary", "Diary"], ["rota", "Care rota"], ["you", "You"], ["reminders", "Reminders"], ["health", "Health"],
    ["contacts", "Care team"], ["docs", "Documents"], ["emergency", "Emergency"], ["share", "Sharing"], ["people", "People"], ["settings", "Settings"]];
  var ROUTES = NAV.map(function (n) { return n[0]; }).concat(["search"]);
  // Views added by views2.js and views3.js register here (window.CareApp.views) before anything renders.
  var A = window.CareApp = { views: {}, ext: {} };

  /* ---------- helpers ---------- */
  function pname(id) { var p = S.vault.people.filter(function (x) { return x.id === id; })[0]; return p ? p.name : "Unknown"; }
  function peopleOpts(withAll) { var o = S.vault.people.map(function (p) { return { v: p.id, l: p.name }; }); return withAll ? [{ v: "all", l: "Everyone" }].concat(o) : o; }
  function visible(p) { return S.person === "all" || p === S.person; }
  function ro() { return S.readonly; }
  function btn(text, cls, fn) { return h("button", { type: "button", class: "btn " + (cls || ""), text: text, onclick: fn }); }
  function section(title, sub, actions) {
    return h("div", { class: "sec-head" }, h("div", null, h("h1", { text: title }), sub ? h("p", { class: "muted", text: sub }) : null), h("div", { class: "row wrap" }, actions || []));
  }
  function empty(text, cta) { return h("div", { class: "empty" }, h("p", { text: text }), cta || null); }
  function badge(text, cls) { return h("span", { class: "badge " + (cls || ""), text: text }); }
  function today() { return V.todayStr(); }
  function dayLabel(d) { return C.WEEKDAYS[L.weekday(d)] + " " + d; }
  // Every save goes through one queue (timer saves and lock-time flushes never overlap), starts its sequence number above the
  // highest one this computer has saved, and shows a failure until a later save succeeds.
  function persist() {
    var sess = S.session, vault = S.vault;
    S.saving = S.saving.catch(function () { return null; }).then(function () {
      sess.seq = Math.max(sess.seq || 0, U.highSeq());
      return V.seal(sess, vault).then(U.storePut);
    });
    S.saving.then(function () { if (S.unsaved) { S.unsaved = false; U.toast("Saved again. Your record is safe in this browser."); } setSaveState("Saved, encrypted"); },
      function (e) { S.unsaved = true; setSaveState("Not saved"); U.toast("Not saved: " + (e && e.message ? e.message : "the browser refused the write.") + " Your changes are still on screen. Save a backup file from Sharing now.", true); });
    return S.saving;
  }
  function setSaveState(t) { var el = $("#save-state"); if (el) { el.textContent = t; el.classList.toggle("bad", t === "Not saved"); } }
  function save() {
    if (S.readonly || !S.vault) return;
    if (S.demo) { setSaveState("Example: not saved"); return; }
    setSaveState("Saving...");
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(persist, 350);
  }
  function flush() { clearTimeout(S.saveTimer); if (S.readonly || S.demo || !S.vault) return S.saving; return persist(); }
  function firstStore(sess, vault) { sess.seq = Math.max(sess.seq || 0, U.highSeq()); return V.seal(sess, vault).then(U.storePut); }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function upsert(list, item) { var i = list.indexOf(byId(list, item.id)); if (i < 0) list.push(item); else list[i] = item; }
  function personFilterBar() {
    if (S.vault.people.length < 2) return null;
    return h("div", { class: "filter row" }, h("label", { for: "pf", text: "Show" }), h("select", { id: "pf", onchange: function (e) { S.person = e.target.value; render(); } },
      peopleOpts(true).map(function (o) { return h("option", { value: o.v, text: o.l, selected: o.v === S.person }); })));
  }
  function actions(item, list, edit) {
    if (ro()) return null;
    return h("div", { class: "row tight" }, btn("Edit", "small", function () { edit(item); }),
      btn("Delete", "small danger-o", function () { U.confirmBox("Delete this?", "This removes it from the care record. It cannot be undone.", "Delete", true).then(function (ok) { if (ok) { list.splice(list.indexOf(item), 1); save(); render(); } }); }));
  }
  function row(k, v) { return v ? h("div", { class: "kv" }, h("dt", { text: k }), h("dd", { text: String(v) })) : null; }
  function stamp() { return V.todayStr(); }
  // Who is using the app right now. Doses and handovers record this name, so relatives sharing one computer can see who did what.
  function helpers() { return L.clean(S.vault.rota).helpers; }
  function curBy() { var hs = helpers(); return byId(hs, S.by) || hs[0] || null; }
  function byName() { var p = curBy(); return p ? p.name : ""; }
  function helperOpts() { return helpers().map(function (p) { return { v: p.id, l: p.name }; }); }
  function whoBar() {
    if (ro() || !helpers().length) return null;
    return h("div", { class: "who row" }, h("label", { for: "who-sel", text: "Logging as" }), h("select", { id: "who-sel", onchange: function (e) { S.by = e.target.value; S.vault.settings.lastBy = S.by; save(); } },
      helperOpts().map(function (o) { return h("option", { value: o.v, text: o.l, selected: o.v === (curBy() || {}).id }); })),
      h("span", { class: "fine", text: "Doses and handovers are signed with this name." }));
  }

  /* ---------- lock screen ---------- */
  function lockScreen() {
    var main = U.clear($("#main")), box = h("div", { class: "lock card" });
    document.body.classList.add("locked");
    $("#topbar-tools").hidden = true; $("#nav").hidden = true;
    main.appendChild(box); main.appendChild(starkNotice());
    U.storeGet().then(function (env) { env ? (env.corrupt ? safeView(box, env.raw, "The stored care record could not be read and there is no earlier copy.") : unlockView(box, env)) : createView(box); });
  }
  function honest() {
    return h("div", { class: "honest" }, h("strong", { text: "Please read this once. " }),
      "Your care record is locked with a key made from your passphrase. The passphrase is never saved, not here and not anywhere. There is no reset and no recovery email, because we cannot see your data. If the passphrase is lost, the data is gone for good. Keep it somewhere safe that one trusted person can find.");
  }
  function createView(box) {
    var p1, strong = false, err = h("p", { class: "form-err", role: "alert", hidden: true }), ack = h("input", { id: "ack", type: "checkbox" }),
      name = h("input", { id: "yourname", type: "text", maxlength: 60, placeholder: "Your first name", autocomplete: "off" }),
      cared = h("input", { id: "caredname", type: "text", maxlength: 60, placeholder: "For example: Mum, Dad, Sam", autocomplete: "off" }), p2;
    p1 = U.passField("pass1", "Choose a passphrase", function (s) { strong = s; });
    p2 = h("input", { id: "pass2", type: "password", autocomplete: "new-password" });
    U.clear(box).appendChild(h("div", null,
      h("h1", { text: "Set up your care record" }),
      h("p", { class: "muted", text: "Medicines, doses, appointments, the care rota and your own wellbeing, in one private place. Everything is encrypted on this computer with AES-256-GCM. Nothing is sent anywhere." }),
      h("div", { class: "row wrap" }, btn("Look around with example data first", "", startDemo), h("span", { class: "fine", text: "Made-up people and medicines. Nothing is saved." })),
      honest(),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var pw = p1.input.value, nm = name.value.trim() || "Me", cn = cared.value.trim();
        err.hidden = false;
        if (!cn) return (err.textContent = "Add the name of the person you care for. You can add more people later.");
        if (pw.length < 12) return (err.textContent = "Use at least 12 characters. A few random words is best.");
        if (!strong || !strong.ok) return (err.textContent = "That passphrase is too easy to guess. Try four or more unrelated words.");
        if (pw !== p2.value) return (err.textContent = "The two passphrases do not match.");
        if (!ack.checked) return (err.textContent = "Please tick the box to confirm you understand.");
        err.textContent = "Working... this takes about a second on purpose, to slow down guessing.";
        e.target.querySelector("button[type=submit]").disabled = true;
        var sub = e.target.querySelector("button[type=submit]");
        V.newSession(pw, "vault").then(function (sess) { var v = V.emptyVault(nm, cn); S.vault = v; S.session = sess; S.readonly = false; S.demo = false; return firstStore(sess, v); })
          .then(function () { p1.input.value = p2.value = ""; enter(); },
            function (x) { S.vault = null; S.session = null; sub.disabled = false; err.textContent = "Could not save the new care record in this browser: " + (x && x.message ? x.message : "storage is blocked or full.") + " Nothing was created."; });
      } },
        h("div", { class: "grid2" }, h("div", { class: "field" }, h("label", { for: "yourname", text: "Your name" }), name),
          h("div", { class: "field" }, h("label", { for: "caredname", text: "Who do you care for?" }), cared)),
        p1.el,
        h("div", { class: "field wide" }, h("label", { for: "pass2", text: "Type it again" }), p2),
        h("div", { class: "field check wide" }, ack, h("label", { for: "ack", text: "I understand that if I lose this passphrase my data cannot be recovered by anyone." })),
        err,
        h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary big", text: "Create care record" }))),
      otherOptions()));
  }
  function startDemo() {
    S.vault = CareDemo.build(V.todayStr(), V.nowHM()); S.session = null; S.readonly = false; S.demo = true; S.shareInfo = null;
    migrate(); enter();
  }
  function unlockView(box, env) {
    var pass = h("input", { id: "unlock-pass", type: "password", autocomplete: "current-password", maxlength: 200 }), err = h("p", { class: "form-err", role: "alert", hidden: true }), fails = 0;
    U.clear(box).appendChild(h("div", null,
      h("h1", { text: "Unlock your care record" }),
      h("p", { class: "muted", text: "Enter your passphrase. It is checked on this computer and never stored." }),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var b = e.target.querySelector("button[type=submit]"); b.disabled = true; err.hidden = false; err.textContent = "Unlocking...";
        V.openVault(env, pass.value).then(function (r) {
          var high = U.highSeq();
          S.vault = r.data; S.session = r.session; S.readonly = false; S.demo = false; pass.value = ""; migrate(); enter(); restoreMirror();
          if (r.seq && high > r.seq) U.toast("This copy is older than the newest one saved on this computer (save " + r.seq + " of " + high + "). Someone may have put back an old copy, or the browser rolled its storage back. Check recent doses and notes.", true);
        })
          .catch(function (x) {
            if (x.invalid) return safeView(box, env, x.message, x.data);
            return U.storeGetBak().then(function (bak) { return bak ? V.openVault(bak, pass.value).then(function (r) { return { r: r, bak: bak }; }) : Promise.reject(x); })
              .then(function (o) { S.vault = o.r.data; S.session = o.r.session; S.readonly = false; S.demo = false; pass.value = ""; migrate(); return firstStore(S.session, S.vault).then(function () { enter(); restoreMirror(); U.toast("The latest copy was damaged, so your last good copy was restored."); }); })
              .catch(function () { throw x; });
          }).catch(function (x) { if (!x || !x.message) return; fails++; b.disabled = false; err.textContent = x.message + (fails > 2 ? " Remember: there is no way to reset a lost passphrase." : ""); pass.select(); });
      } },
        h("div", { class: "field wide" }, h("label", { for: "unlock-pass", text: "Passphrase" }), pass),
        err, h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary big", text: "Unlock" }))),
      otherOptions(env)));
    pass.focus();
  }
  // Safe mode: stored data failed to read or validate. Nothing is overwritten; the person can only export what is there.
  function safeView(box, env, reason, data) {
    var kids = [h("h1", { text: "Safe mode (read-only)" }),
      h("div", { class: "banner", role: "alert" }, h("strong", { text: "Your care record could not be opened normally." }), " " + reason + " Nothing has been changed or deleted. Save a copy of the raw data now, then restore from a backup file."),
      h("div", { class: "row wrap" }, btn("Export raw data", "primary", function () { U.downloadText("stark-caregiver-raw-" + stamp() + ".starkcare", JSON.stringify(env), "application/json"); }))];
    if (data) kids.push(h("p", { class: "fine", text: "The record opened with your passphrase but its contents failed the safety checks, so it was not loaded. The raw export above is still encrypted." }));
    kids.push(otherOptions(null));
    U.clear(box).appendChild(h("div", null, kids));
  }
  function otherOptions(env) {
    return h("details", { class: "other" }, h("summary", { text: "Other ways in" }),
      h("div", { class: "row wrap" },
        btn("Open a share file a relative sent me", "", openShare),
        btn("Restore from a backup file", "", restoreBackup),
        env ? btn("Look around with example data", "", startDemo) : null,
        env ? btn("Erase this care record from this computer", "danger-o", function () {
          U.confirmBox("Erase this care record?", "This deletes the encrypted care record stored on this computer. Without a backup file and your passphrase it cannot be brought back.", "Erase everything", true).then(function (ok) { if (ok) U.storeClear().then(lockScreen); });
        }) : null));
  }
  function migrate() {
    var v = S.vault;
    ["docs", "contacts", "people", "meds", "doses", "diary", "checkins", "tasks"].forEach(function (k) { if (!Array.isArray(v[k])) v[k] = []; });
    ["health", "emergency"].forEach(function (k) { if (!v[k] || typeof v[k] !== "object" || Array.isArray(v[k])) v[k] = {}; });
    if (!v.rota || typeof v.rota !== "object" || Array.isArray(v.rota)) v.rota = V.emptyRota();
    L.clean(v.rota);
    v.settings = v.settings || { lockMin: 5 };
    if (!v.people.length) v.people.push({ id: V.uid(), name: "The person I care for", rel: "", dob: "" });
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
      if (!f.env || f.env.format !== V.FORMAT) return U.toast("That file is not a Stark Caregiver file.", true);
      askPass("Open shared file", "Enter the passphrase the sender gave you for " + f.name + ".", function (pw) {
        return V.openVault(f.env, pw).then(function (r) {
          if (r.legacy) U.toast("This file has no checksum, validated.");
          S.vault = r.data; S.session = null; S.readonly = true; S.demo = false; S.shareInfo = { name: f.name, kind: f.env.kind };
          migrate(); enter();
        });
      });
    });
  }
  function restoreBackup() {
    U.pickFile().then(function (f) {
      if (!f) return;
      if (!f.env || f.env.format !== V.FORMAT || f.env.kind !== "vault") return U.toast("That is not a full backup file.", true);
      askPass("Restore backup", "Enter the passphrase for this backup. It becomes the passphrase of the restored record. This replaces any care record on this computer.", function (pw) {
        return V.openVault(f.env, pw).then(function (r) { S.vault = r.data; S.session = r.session; S.readonly = false; S.demo = false; migrate(); if (r.legacy) U.toast("Restored: no checksum, validated."); return firstStore(r.session, S.vault).then(enter); });
      });
    });
  }

  /* ---------- app shell ---------- */
  function enter() {
    document.body.classList.remove("locked"); document.body.classList.toggle("readonly", S.readonly); document.body.classList.toggle("demo", S.demo);
    $("#topbar-tools").hidden = false; $("#nav").hidden = false;
    S.person = "all"; S.last = Date.now();
    S.by = (S.vault.settings || {}).lastBy || (S.vault.settings || {}).me || "";
    var hash = (location.hash || "").replace("#/", ""); S.route = NAV.some(function (n) { return n[0] === hash; }) ? hash : "home"; S.q = "";
    $("#q").value = "";
    $("#lock-btn").textContent = S.readonly ? "Close" : S.demo ? "Close example" : "Lock now";
    $("#save-state").textContent = S.readonly ? "Read-only" : S.demo ? "Example: not saved" : "Saved, encrypted";
    render();
  }
  function lock(why) {
    clearTimeout(S.saveTimer);
    var done = S.readonly || S.demo ? Promise.resolve() : (S.vault ? flush().catch(function () { return null; }) : Promise.resolve());
    done.then(function () {
      S.vault = null; S.session = null; S.readonly = false; S.demo = false; S.shareInfo = null; U.closeAllDialogs(); U.clear($("#print-root")); U.clear($("#main"));
      document.body.classList.remove("demo", "readonly");
      lockScreen(); if (why) U.toast(why);
    });
  }
  function render() {
    if (!S.vault) return;
    var main = U.clear($("#main")), views = { home: vHome, health: vHealth, contacts: vContacts, docs: vDocs, share: vShare, people: vPeople, settings: vSettings }, view = views[S.route] || A.views[S.route] || vHome;
    Array.prototype.forEach.call(document.querySelectorAll("#nav a"), function (a) { a.classList.toggle("on", a.dataset.nav === S.route); a.toggleAttribute("aria-current", a.dataset.nav === S.route); });
    if (S.readonly) main.appendChild(h("div", { class: "banner" }, h("strong", { text: "Read-only view of a shared file." }), " Opened from " + S.shareInfo.name + (S.vault.shared ? ", shared " + S.vault.shared : "") + ". Nothing here is saved to this computer. ",
      S.vault.note ? h("em", { text: "Note from the sender: " + S.vault.note }) : null));
    if (S.demo) main.appendChild(h("div", { class: "banner demo-banner" }, h("strong", { text: "Example data. " }), "Rose, Walter and their helpers are made up, to show how Stark Caregiver works. Nothing you change here is saved. ",
      btn("Close the example and set up my own", "small primary", function () { lock(); })));
    main.appendChild(view());
    main.focus({ preventScroll: true });
  }
  function buildShell() {
    var nav = $("#nav");
    NAV.forEach(function (n) { nav.appendChild(h("a", { href: "#/" + n[0], "data-nav": n[0], text: n[1] })); });
    $("#lock-btn").addEventListener("click", function () { lock(); });
    $("#theme-btn").addEventListener("click", function () { var d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("sc-theme", d.dataset.theme); } catch (e) { /* ignore */ } });
    $("#search-form").addEventListener("submit", function (e) { e.preventDefault(); if (!S.vault) return; S.q = $("#q").value.trim(); if (location.hash === "#/search") render(); else location.hash = "#/search"; });
    window.addEventListener("hashchange", function () { var r = (location.hash || "").replace("#/", ""); if (S.vault && ROUTES.indexOf(r) !== -1) { S.route = r; render(); window.scrollTo(0, 0); } });
    ["mousemove", "keydown", "click", "touchstart", "scroll", "wheel"].forEach(function (ev) { document.addEventListener(ev, function () { S.last = Date.now(); }, { passive: true, capture: true }); });
    setInterval(tick, 1000);
    try { var t = localStorage.getItem("sc-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
  }
  function tick() {
    var t = $("#lock-timer");
    if (!S.vault || S.readonly || S.demo) { t.textContent = ""; return; }
    var left = (S.vault.settings.lockMin || 5) * 60 - Math.floor((Date.now() - S.last) / 1000);
    if (left <= 0) return lock("Locked after " + (S.vault.settings.lockMin || 5) + " minutes of inactivity.");
    t.textContent = left <= 60 ? "Locking in " + left + "s" : "Auto-lock " + Math.ceil(left / 60) + " min";
  }

  /* ---------- Today ---------- */
  function remList(rem, limit) {
    if (!rem.length) return h("p", { class: "muted", text: "Nothing is due soon." });
    return h("ul", { class: "remlist" }, rem.slice(0, limit || 50).map(function (r) {
      var who = r.person && r.person !== "household" ? pname(r.person) : "";
      return h("li", { class: r.state }, badge(r.state === "expired" ? (r.src === "doc" ? "Expired" : "Overdue") : r.state === "soon" ? "Soon" : "Later", r.state),
        h("span", { class: "grow" }, h("a", { href: "#/" + r.route, text: r.title }), who ? " " : null, who ? h("span", { class: "muted", text: who }) : null),
        h("span", { text: K.dueText(r) + " (" + r.date + ")" }));
    }));
  }
  function vHome() {
    var v = S.vault, t = today(), carer = byName(), rem = K.allReminders(v, t, { person: S.person }), rd = K.readiness(v, t), cs = L.checkinSummary(v.checkins, t),
      R = L.clean(v.rota), duty = L.onDuty(R, t, V.nowHM()), todays = L.coverage(R, t, t).rows, ahead = L.coverage(R, t, V.addDays(t, 6)), last = L.latestHandovers(R, 1)[0],
      appts = L.upcoming(v, t, S.person).slice(0, 3);
    var wrap = h("div", null, section("Today, " + dayLabel(t), (carer ? "Hello, " + carer + ". " : "") + "One thing at a time. Here is what matters today.",
      [btn("Doctor summary", "", function () { location.hash = "#/diary"; }), btn("Emergency binder", "", function () { location.hash = "#/emergency"; })]));
    var w = whoBar(); if (w) wrap.appendChild(w);
    var f = personFilterBar(); if (f) wrap.appendChild(f);
    var dutyCard = h("div", { class: "card" }, h("div", { class: "item-top" }, h("h2", { text: "Who is on" }), ahead.gaps ? h("a", { class: "badge soon", href: "#/rota", text: ahead.gaps + (ahead.gaps === 1 ? " gap" : " gaps") + " this week" }) : badge("Week covered", "ok")),
      duty.length ? h("p", null, h("strong", { text: "Now: " }), duty.map(function (d) { return (d.names.join(", ") || "nobody yet") + " (" + d.shift.role + " until " + d.shift.end + ")"; }).join("; ")) : h("p", { class: "muted", text: "Nobody is on a shift right now." }),
      todays.length ? h("ul", { class: "remlist" }, todays.map(function (r) {
        var names = (R.assign[r.shift.id] || []).map(function (id) { return L.helperName(R, id); });
        return h("li", { class: r.gap ? "soon" : "" }, h("span", { class: "nowrap", text: r.shift.start + "-" + r.shift.end }), h("span", { class: "grow", text: r.shift.role }), h("span", { text: names.join(", ") || "Not covered" }), r.gap ? badge("Needs " + r.gap, "soon") : null);
      })) : h("p", { class: "fine", text: "No shifts today. Add the regular visits on the Care rota page." }),
      last ? h("div", { class: "handover" }, h("p", { class: "fine", text: "Latest handover, " + last.date + (last.time ? " " + last.time : "") + (last.byName ? ", from " + last.byName : "") }), h("p", { class: "pre", text: last.text }),
        last.next ? h("p", { class: "pre" }, h("strong", { text: "For the next person: " }), last.next) : null) : null,
      ro() ? null : h("div", { class: "row wrap" }, btn("Write a handover", "small", function () { if (A.ext.handover) A.ext.handover(); }), h("a", { href: "#/rota", text: "Open the rota" })));
    var you = h("div", { class: "card you-card" }, h("h2", { text: "How are you?" }),
      cs.todayDone ? h("p", null, "You checked in today: ", h("strong", { text: (C.FEEL.filter(function (x) { return x.v === +cs.last.feel; })[0] || {}).l || "" }), ". Thank you for looking after yourself too.")
        : h("p", { text: "A 30-second check-in, just for you. It stays private: never shared or printed." }),
      h("p", { class: "fine", text: C.RESPITE[L.weekday(t) % C.RESPITE.length].t + ": " + C.RESPITE[L.weekday(t) % C.RESPITE.length].d }),
      ro() ? null : btn(cs.todayDone ? "Open your page" : "Check in", cs.todayDone ? "small" : "small coral", function () { location.hash = "#/you"; }));
    var soon = h("div", { class: "card" }, h("h2", { text: "Coming up" }),
      appts.length ? h("ul", { class: "remlist" }, appts.map(function (a) { return h("li", null, badge(a.date === t ? "Today" : V.daysUntil(a.date, t) === 1 ? "Tomorrow" : a.date, a.date === t ? "soon" : ""), h("span", { class: "grow" }, h("a", { href: "#/diary", text: (a.title || a.with || "Appointment") + (a.time ? " at " + a.time : "") }), " ", h("span", { class: "muted", text: pname(a.person) }))); }))
        : h("p", { class: "muted", text: "No appointments booked." }),
      h("h3", { class: "sub", text: "Reminders" }), remList(rem.filter(function (r) { return r.src !== "appt"; }), 5), h("a", { href: "#/reminders", text: "All reminders" }));
    wrap.appendChild(h("div", { class: "grid2 gap" }, A.ext.doseToday ? A.ext.doseToday(S.person) : null, dutyCard, soon, you));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Ready for a bad day: " + rd.pct + "%" }), h("div", { class: "prog" }, h("span", { class: "prog-fill rd-fill" })),
      h("ul", { class: "readiness" }, rd.items.map(function (i) { return h("li", { class: i.done ? "done" : "" }, h("span", { class: "tick", "aria-hidden": "true", text: i.done ? "✓" : "○" }), i.done ? h("span", { text: i.label }) : h("a", { href: "#/" + i.route, text: i.label })); }))));
    $(".rd-fill", wrap).style.width = rd.pct + "%";
    if (!v.meds.length && !ro()) wrap.appendChild(h("div", { class: "card start" }, h("h2", { text: "Start here, a little at a time" }), h("ol", null,
      h("li", null, "Add the medicines and the times you give them under ", h("a", { href: "#/meds", text: "Medicines" }), ". Then tick doses off here each day."),
      h("li", null, "Add relatives and helpers to the ", h("a", { href: "#/rota", text: "Care rota" }), " and let it fill the gaps fairly."),
      h("li", null, "Note appointments and anything you notice in the ", h("a", { href: "#/diary", text: "Diary" }), ". It builds the summary for the doctor."),
      h("li", null, "Fill in the ", h("a", { href: "#/health", text: "Health" }), " summary and the ", h("a", { href: "#/emergency", text: "Emergency" }), " plan, and print the binder."))));
    return wrap;
  }

  /* ---------- Documents ---------- */
  function docFields() {
    return [{ k: "person", label: "Whose document", type: "select", options: peopleOpts(false), req: true }, { k: "type", label: "Type", type: "select", options: C.DOC_TYPES, req: true },
      { k: "title", label: "Name", req: true, ph: "Health power of attorney, Discharge letter March", wide: true }, { k: "issuer", label: "From", ph: "Riverside General, Dr Lee, the council" },
      { k: "ref", label: "Reference (last 4 only)", max: 4, ph: "1234", help: "Last 4 characters only. Never the full number." }, { k: "issued", label: "Dated", type: "date" }, { k: "expires", label: "Expires or needs renewing on", type: "date" },
      { k: "leadDays", label: "Remind me before", type: "select", options: [{ v: "30", l: "30 days" }, { v: "60", l: "60 days" }, { v: "90", l: "90 days" }, { v: "180", l: "6 months" }] },
      { k: "location", label: "Where the original is kept", ph: "Blue folder in the hall drawer, with the lawyer", wide: true }, { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true },
      { k: "scan", label: "Scan or photo (JPG, PNG or PDF up to 4 MB)", type: "scan", wide: true }];
  }
  function editDoc(d) {
    d = d || { id: V.uid(), person: S.person !== "all" ? S.person : S.vault.people[0].id, leadDays: "60" };
    U.openForm(S.vault.docs.indexOf(d) < 0 ? "Add document" : "Edit document", docFields(), d, function (o) {
      o.ref = V.cleanLast4(o.ref); o.id = d.id; upsert(S.vault.docs, o); save(); render();
    });
  }
  function vDocs() {
    var wrap = h("div", null, section("Documents", "Powers of attorney, advance directives, discharge letters and care plans, with scans and where each original is kept.", [ro() ? null : btn("Add document", "primary", function () { editDoc(); })])),
      docs = S.vault.docs.filter(function (d) { return visible(d.person); }), f = personFilterBar(), t = today();
    if (f) wrap.appendChild(f);
    if (!docs.length) { wrap.appendChild(empty("No documents yet. Start with any power of attorney, advance directive or the latest hospital letter.")); return wrap; }
    docs.sort(function (a, b) { var x = V.daysUntil(a.expires, t), y = V.daysUntil(b.expires, t); return (x === null ? 1e9 : x) - (y === null ? 1e9 : y); });
    wrap.appendChild(h("div", { class: "cards" }, docs.map(function (d) {
      var r = V.reminderStatus(d, t);
      return h("article", { class: "card item " + r.state }, h("div", { class: "item-top" }, h("h3", { text: d.title }), r.state !== "none" ? badge(r.state === "ok" ? "Valid" : r.state === "soon" ? "Renew soon" : "Expired", r.state) : badge("No expiry")),
        h("p", { class: "muted", text: d.type + " · " + pname(d.person) }),
        h("dl", null, row("Expires", r.state === "none" ? "" : d.expires + " (" + V.reminderText({ state: r.state === "ok" ? "soon" : r.state, days: r.days }) + ")"), row("From", d.issuer), row("Dated", d.issued), row("Reference", d.ref ? "ending " + d.ref : ""), row("Original kept", d.location), row("Notes", d.notes)),
        h("div", { class: "row tight wrap" }, d.scan ? btn("View scan", "small", function () { U.viewScan(d.scan, d.title); }) : badge("No scan", "mute"), actions(d, S.vault.docs, editDoc)));
    })));
    return wrap;
  }

  /* ---------- Health ---------- */
  var HF = [{ k: "blood", label: "Blood type", type: "select", options: C.BLOOD }, { k: "insurer", label: "Health insurer and member ID (last 4)", ph: "Acme Health, member ending 4821" },
    { k: "allergies", label: "Allergies and reactions", type: "textarea", wide: true, ph: "Penicillin (rash)" },
    { k: "conditions", label: "Conditions and past operations, as the doctors have described them", type: "textarea", wide: true },
    { k: "doctors", label: "Doctors and clinics", type: "textarea", wide: true, ph: "Dr Lee (family doctor) 555-0100" },
    { k: "routine", label: "Daily routine and what helps", type: "textarea", wide: true, ph: "Up at 7. Likes tea with milk. Calmer with the radio on." },
    { k: "communication", label: "Communication, memory, sight or hearing", type: "textarea", wide: true, ph: "Hard of hearing on the left. Speak slowly, one question at a time." },
    { k: "mobility", label: "Moving around and equipment", type: "textarea", wide: true, ph: "Walking frame indoors, wheelchair for trips out" },
    { k: "eating", label: "Eating and drinking", type: "textarea", wide: true, ph: "Soft food, thickened drinks, small portions, likes to eat at the table" },
    { k: "wishes", label: "Care wishes", type: "textarea", wide: true, ph: "Wants to stay at home. Advance directive: see Documents." },
    { k: "notes", label: "Other notes for helpers and responders", type: "textarea", wide: true }];
  function vHealth() {
    var wrap = h("div", null, section("Health", "A summary for each person you care for, and a printable emergency card."));
    wrap.appendChild(h("p", { class: "fine", text: "Record what the doctors and the person have told you. This is a record, not a diagnosis tool." }));
    var f = personFilterBar(); if (f) wrap.appendChild(f);
    var people = S.vault.people.filter(function (p) { return visible(p.id); });
    wrap.appendChild(h("div", { class: "cards" }, people.map(function (p) {
      var hr = S.vault.health[p.id];
      return h("article", { class: "card item" }, h("div", { class: "item-top" }, h("h3", { text: p.name }), hr && hr.blood ? badge("Blood " + hr.blood, "ok") : badge(hr ? "Summary" : "No summary", "mute")),
        hr ? h("dl", null, HF.map(function (x) { return row(x.label.replace(/ \(.*$/, "").replace(/, as the doctors.*$/, ""), hr[x.k]); }), row("Updated", hr.updated)) : h("p", { class: "muted", text: "No health summary yet. It takes about ten minutes and helps every new helper." }),
        h("div", { class: "row tight wrap" }, ro() ? null : btn(hr ? "Edit summary" : "Add summary", "small primary", function () { editHealth(p); }),
          btn("Emergency card", "small", function () { showCard(p); })));
    })));
    return wrap;
  }
  function medsLine(pid) {
    return S.vault.meds.filter(function (m) { return m.person === pid && L.medOn(m, today()); }).map(function (m) { return m.name + (m.dose ? " " + m.dose : "") + (m.prn ? ", as needed" : L.parseTimes(m.times).length ? " at " + L.parseTimes(m.times).join(", ") : ""); }).join("\n");
  }
  function editHealth(p) {
    var cur = S.vault.health[p.id] || {};
    U.openForm("Health summary: " + p.name, HF, cur, function (o) { o.updated = today(); S.vault.health[p.id] = o; save(); render(); });
  }
  function cardEl(p) {
    var hr = S.vault.health[p.id] || {}, ecs = S.vault.contacts.filter(function (c) { return c.emergency; }), line = function (k, v) { return v ? h("div", { class: "ec-row" }, h("b", { text: k }), h("span", { text: v })) : null; };
    return h("div", { class: "ecard" }, h("div", { class: "ec-head" }, h("span", { text: "EMERGENCY CARE CARD" }), h("small", { text: "Stark Caregiver" })),
      h("div", { class: "ec-name", text: p.name + (p.dob ? "  ·  born " + p.dob : "") }),
      line("Blood type", hr.blood), line("Allergies", hr.allergies), line("Medicines", medsLine(p.id)), line("Conditions", hr.conditions), line("Communication", hr.communication), line("Doctors", hr.doctors), line("Insurance", hr.insurer),
      ecs.length ? h("div", { class: "ec-contacts" }, h("b", { text: "In an emergency call" }), ecs.map(function (c) { return h("div", { text: c.name + (c.rel ? " (" + c.rel + ")" : "") + "  " + (c.phone || "") }); })) : line("Emergency contacts", "Add them under Care team"),
      h("small", { class: "ec-foot", text: "Printed " + today() + ". Check it is up to date. " + C.DISCLAIMER }));
  }
  function printNode(node) {
    var pr = U.clear($("#print-root")); pr.appendChild(node); document.body.classList.add("printing");
    var after = function () { document.body.classList.remove("printing"); U.clear($("#print-root")); window.removeEventListener("afterprint", after); };
    window.addEventListener("afterprint", after); setTimeout(function () { window.print(); }, 50);
  }
  function showCard(p) {
    var body = h("div", { class: "dlg-body" }, cardEl(p), h("p", { class: "fine", text: "Print it and keep one in a wallet or bag and one on the fridge. Printed copies are not encrypted." }),
      h("div", { class: "row end" }, btn("Print card", "primary", function () { printNode(cardEl(p)); })));
    U.modal("Emergency card: " + p.name, body, { wide: true });
  }

  /* ---------- Care team (contacts) ---------- */
  function vContacts() {
    var wrap = h("div", null, section("Care team", "Doctors, nurses, the pharmacy, family, and the people who support you.", [ro() ? null : btn("Add contact", "primary", function () { editContact(); })]));
    var cs = S.vault.contacts.slice().sort(function (a, b) { return (b.emergency ? 1 : 0) - (a.emergency ? 1 : 0) || String(a.role || "").localeCompare(String(b.role || "")); });
    wrap.appendChild(cs.length ? h("div", { class: "cards" }, cs.map(function (c) {
      return h("article", { class: "card item" }, h("div", { class: "item-top" }, h("h3", { text: c.name }), c.emergency ? badge("Emergency", "expired") : badge(c.role || "Contact", "mute")),
        h("dl", null, row("Role", c.role), row("Relationship", c.rel), row("Phone", c.phone), row("Email", c.email), row("Hours", c.hours), row("Notes", c.notes)), actions(c, S.vault.contacts, editContact));
    })) : empty("No contacts yet. Add the family doctor, the pharmacy, and two people to call in an emergency."));
    wrap.appendChild(h("p", { class: "fine", text: "Helpers who take shifts are added on the Care rota page, with the days they cannot do." }));
    return wrap;
  }
  function editContact(c, preset) {
    c = c || Object.assign({ id: V.uid() }, preset || {});
    U.openForm(S.vault.contacts.indexOf(c) < 0 ? "Add contact" : "Edit contact", [{ k: "name", label: "Name", req: true }, { k: "role", label: "Role", type: "select", options: C.CONTACT_ROLES }, { k: "rel", label: "Relationship or service", ph: "Daughter, district nurse" },
      { k: "phone", label: "Phone", type: "tel", max: 40 }, { k: "email", label: "Email", type: "email" }, { k: "hours", label: "Hours or when to call", ph: "Weekdays 9 to 5; out-of-hours line 555-0111" },
      { k: "emergency", label: "Show on the emergency card", type: "checkbox", wide: true }, { k: "notes", label: "Notes", type: "textarea", wide: true, warn: true }], c, function (o) { o.id = c.id; upsert(S.vault.contacts, o); save(); render(); });
  }

  /* ---------- Sharing ---------- */
  function vShare() {
    var wrap = h("div", null, section("Sharing", "Send relatives an encrypted copy, or back up the whole care record."));
    if (ro()) { wrap.appendChild(h("p", { class: "muted", text: "Sharing is turned off in a read-only view." })); return wrap; }
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Export a share file for a relative" }),
      h("p", { class: "muted", text: "Choose what to include. The file is encrypted with its own passphrase, so you can send it by email or on a USB stick. Tell them the passphrase another way, such as a phone call. They open it with Stark Caregiver." }),
      h("p", { class: "fine", text: "Your check-ins on the You page are private and are never included." }), shareForm()));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Add a relative's share file to this record" }),
      h("p", { class: "muted", text: "Brings in their dose log, diary entries, handovers and shifts. People, helpers and medicines are matched by name, and entries you already have are skipped, so swapping files every week does not create duplicates." }),
      btn("Choose a share file", "", function () {
        if (S.demo) return U.toast("Not available with example data.", true);
        U.pickFile().then(function (f) {
          if (!f) return; if (!f.env || f.env.format !== V.FORMAT) return U.toast("That file is not a Stark Caregiver file.", true);
          if (f.env.kind !== "share") return U.toast("That is a full backup. Restore it from the lock screen instead.", true);
          askPass("Import shared file", "Enter the passphrase for " + f.name + ".", function (pw) {
            return V.openVault(f.env, pw).then(function (r) { var a = V.mergeInto(S.vault, r.data); save(); render();
              U.toast((r.legacy ? "No checksum, validated. " : "") + "Added " + a.doses + " doses, " + a.diary + " diary entries, " + a.handovers + " handovers, " + a.shifts + " shifts and " + (a.meds + a.docs + a.contacts + a.people + a.helpers) + " other entries."); });
          });
        });
      })));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Backup of the whole care record" }),
      h("p", { class: "muted", text: "The care record lives only in this browser's storage. Clearing site data, a new computer or a reinstall would lose it. Save a backup file to a USB stick or another safe place. It is encrypted with your current passphrase." }),
      h("p", { class: "fine", text: S.vault.settings.lastBackup ? "Last backup: " + S.vault.settings.lastBackup : "No backup yet." }),
      btn("Save a backup file", "primary", function () {
        if (S.demo) return U.toast("Example data is never saved or backed up.", true);
        U.toast("Encrypting backup...");
        V.seal(S.session, S.vault).then(function (env) { U.downloadText("caregiver-backup-" + stamp() + ".starkcare", JSON.stringify(env), "application/json"); S.vault.settings.lastBackup = stamp(); save(); render(); })
          .catch(function (e) { U.toast("The backup could not be made: " + (e && e.message || e), true); });
      })));
    if (A.ext.shareExtra) wrap.appendChild(A.ext.shareExtra());
    return wrap;
  }
  function shareForm() {
    var secs = [["meds", "Medicine list"], ["doses", "Dose log (given and missed)"], ["diary", "Diary: appointments and symptoms"], ["rota", "Care rota and handover notes"], ["health", "Health summaries"],
      ["contacts", "Care team contacts"], ["emergency", "Emergency plan"], ["docs", "Documents"], ["tasks", "Reminders and checks"]], st = false, msg = h("p", { class: "form-err", role: "alert", hidden: true });
    var pf = U.passField("share-pass", "Passphrase for this share file (different from your own)", function (s) { st = s; }), note = h("input", { id: "share-note", type: "text", maxlength: 200, placeholder: "Optional note, for example: This week's doses and the new rota" });
    return h("form", { class: "form", novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var people = S.vault.people.filter(function (p) { return $("#sp-" + p.id).checked; }).map(function (p) { return p.id; }), sections = secs.filter(function (s) { return $("#ss-" + s[0]).checked; }).map(function (s) { return s[0]; }), pw = pf.input.value;
      msg.hidden = false;
      if (!people.length || !sections.length) return (msg.textContent = "Choose at least one person and one section.");
      if (pw.length < 12 || !st || !st.ok) return (msg.textContent = "Use a stronger passphrase for the share file: at least 12 characters and not easy to guess.");
      if (S.demo) return (msg.textContent = "Share files cannot be made from example data. Set up your own record first.");
      msg.textContent = "Encrypting...";
      V.exportShare(S.vault, { people: people, sections: sections, scans: $("#share-scans").checked, note: note.value.trim() }, pw).then(function (env) {
        U.downloadText("caregiver-share-" + stamp() + ".starkcare", JSON.stringify(env), "application/json"); msg.textContent = "Saved. Send the file, then tell them the passphrase separately."; pf.input.value = "";
      });
    } },
      h("fieldset", null, h("legend", { text: "People you care for" }), S.vault.people.map(function (p) { return h("label", { class: "chk" }, h("input", { type: "checkbox", id: "sp-" + p.id, checked: true }), p.name); })),
      h("fieldset", null, h("legend", { text: "Sections" }), h("div", { class: "cols" }, secs.map(function (s) { return h("label", { class: "chk" }, h("input", { type: "checkbox", id: "ss-" + s[0], checked: s[0] !== "docs" }), s[1]); })),
        h("label", { class: "chk" }, h("input", { type: "checkbox", id: "share-scans" }), "Include document scans (makes the file larger)")),
      h("div", { class: "field wide" }, h("label", { for: "share-note", text: "Note" }), note), pf.el, msg,
      h("p", { class: "fine", text: "Anyone with both the file and the passphrase can read it, so share carefully." }),
      h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary", text: "Create share file" })));
  }

  /* ---------- People ---------- */
  function vPeople() {
    var wrap = h("div", null, section("People you care for", "Medicines, the diary, health and documents are kept for each person.", [ro() ? null : btn("Add person", "primary", function () { editPerson(); })]));
    wrap.appendChild(h("div", { class: "cards" }, S.vault.people.map(function (p) {
      var nm = S.vault.meds.filter(function (m) { return m.person === p.id; }).length, nd = S.vault.diary.filter(function (d) { return d.person === p.id; }).length;
      return h("article", { class: "card item" }, h("div", { class: "item-top" }, h("h3", { text: p.name }), badge(p.rel || "Cared for", "mute")), h("dl", null, row("Born", p.dob), row("Medicines", nm), row("Diary entries", nd)),
        ro() ? null : h("div", { class: "row tight" }, btn("Edit", "small", function () { editPerson(p); }), S.vault.people.length > 1 ? btn("Remove", "small danger-o", function () {
          U.confirmBox("Remove " + p.name + "?", "This also deletes their medicines, dose log, diary, health summary and documents from this record.", "Remove", true).then(function (ok) {
            if (!ok) return; var v = S.vault, gone = function (x) { return x.person !== p.id; }, meds = v.meds.filter(function (m) { return m.person === p.id; }).map(function (m) { return m.id; });
            v.people.splice(v.people.indexOf(p), 1); v.docs = v.docs.filter(gone); v.meds = v.meds.filter(gone); v.diary = v.diary.filter(gone);
            v.doses = v.doses.filter(function (d) { return meds.indexOf(d.med) === -1; }); delete v.health[p.id];
            v.tasks.concat(v.rota.shifts).forEach(function (x) { if (x.person === p.id) x.person = ""; }); S.person = "all"; save(); render();
          });
        }) : null));
    })));
    wrap.appendChild(h("p", { class: "fine", text: "Helpers (relatives, friends, paid carers) are on the Care rota page." }));
    return wrap;
  }
  function editPerson(p) {
    p = p || { id: V.uid() };
    U.openForm(S.vault.people.indexOf(p) < 0 ? "Add person" : "Edit person", [{ k: "name", label: "Name", req: true }, { k: "rel", label: "Relationship to you", ph: "Mum, husband, son" }, { k: "dob", label: "Date of birth", type: "date" }], p, function (o) { o.id = p.id; upsert(S.vault.people, o); save(); render(); });
  }

  /* ---------- Live backup file: the encrypted record mirrored to a file you choose, after every save ---------- */
  function restoreMirror() {
    if (!window.CareStore.canMirror(window)) return;
    U.store.sideGet("mirror").then(function (hd) {
      if (!hd || !hd.queryPermission) return;
      return hd.queryPermission({ mode: "readwrite" }).then(function (p) {
        S.mirrorWaiting = p === "granted" ? null : hd;
        if (p === "granted") U.mirror.set(hd);
        if (S.route === "settings" && S.vault) render();
      });
    }).catch(function () { return null; });
  }
  function liveFileCard() {
    var st = U.mirror.status(), card = h("div", { class: "card" }, h("h2", { text: "Live backup file" }),
      h("p", { class: "muted", text: "Keep a second copy of the encrypted record in a file you choose, for example on a USB stick or in a folder your own cloud drive syncs. After every save the file is replaced with the newest encrypted copy. It is the same kind of file as a backup, so it opens from the lock screen with Restore." }));
    if (!window.CareStore.canMirror(window)) {
      card.appendChild(h("p", { class: "fine", text: "This browser cannot keep a live file for a page. It needs Chrome or Edge, with the app opened from the downloaded copy rather than inside another site. Use \"Save a backup file\" on the Sharing page instead." }));
      return card;
    }
    var line = st.on ? "Writing to " + st.name + (st.last ? ". Last written at " + new Date(st.last).toLocaleTimeString() : ". Waiting for the next save") + "." + (st.error ? " Last problem: " + st.error : "")
      : S.mirrorWaiting ? "The browser needs your permission again to write to " + S.mirrorWaiting.name + "." : "Off.";
    card.appendChild(h("p", { class: "fine", text: line }));
    var row = h("div", { class: "row wrap" });
    if (S.mirrorWaiting) row.appendChild(btn("Resume writing to " + S.mirrorWaiting.name, "primary", function () {
      var hd = S.mirrorWaiting;
      hd.requestPermission({ mode: "readwrite" }).then(function (p) {
        if (p !== "granted") return U.toast("Permission was not given, so the live file stays off.", true);
        S.mirrorWaiting = null; U.mirror.set(hd); return flush().then(render);
      }).catch(function (e) { U.toast("Could not reopen the file: " + (e && e.message || e), true); });
    }));
    if (!st.on) row.appendChild(btn(S.mirrorWaiting ? "Choose a different file" : "Choose a file", S.mirrorWaiting ? "" : "primary", function () {
      window.showSaveFilePicker({ suggestedName: "caregiver-live.starkcare", types: [{ description: "Stark Caregiver encrypted record", accept: { "application/json": [".starkcare"] } }] })
        .then(function (hd) { S.mirrorWaiting = null; U.mirror.set(hd); return U.store.sideSet("mirror", hd).catch(function () { return null; }).then(flush); })
        .then(function () { U.toast("Live backup file is on."); render(); }, function (e) { if (e && e.name === "AbortError") return; U.toast("Could not use that file: " + (e && e.message || e), true); });
    }));
    else row.appendChild(btn("Stop writing to the file", "", function () {
      U.mirror.stop(); U.store.sideSet("mirror", undefined).catch(function () { return null; });
      U.toast("Live backup file is off. The file stays where it is."); render();
    }));
    card.appendChild(row);
    card.appendChild(h("p", { class: "fine", text: "The file is encrypted with your passphrase. Anyone with the file and the passphrase can read it. The browser may ask for permission again after a restart." }));
    return card;
  }

  /* ---------- Settings ---------- */
  function vSettings() {
    var wrap = h("div", null, section("Settings", "Security and housekeeping."));
    if (ro() || S.demo) { wrap.appendChild(h("p", { class: "muted", text: S.demo ? "Settings are not available with example data." : "Settings are not available in a read-only view." })); wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "About" }), h("p", { text: "Stark Caregiver " + V.VERSION + ", by Stark." }), starkNotice())); return wrap; }
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Auto-lock" }), h("p", { class: "muted", text: "The care record locks when there has been no mouse, keyboard or touch activity for this long. Unsaved work is saved first." }),
      h("div", { class: "field" }, h("label", { for: "lockmin", text: "Lock after" }), h("select", { id: "lockmin", onchange: function (e) { S.vault.settings.lockMin = +e.target.value; save(); tick(); } },
        [1, 2, 5, 10, 15, 30].map(function (m) { return h("option", { value: m, text: m + (m === 1 ? " minute" : " minutes"), selected: m === (S.vault.settings.lockMin || 5) }); })))));
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "Change passphrase" }), changePass()));
    wrap.appendChild(liveFileCard());
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "How your data is protected" }), h("ul", { class: "tips" },
      h("li", { text: "Encryption: AES-256-GCM. The key comes from your passphrase with PBKDF2-SHA256, " + V.KDF_ITER.toLocaleString() + " iterations and a random salt." }),
      h("li", { text: "Tamper detection: GCM authenticates the data. A changed or corrupted file is refused, never half-opened." }),
      h("li", { text: "Your passphrase is never stored. Only the derived key is held in memory while the record is open, and it is dropped when you lock." }),
      h("li", { text: "No network: this page blocks all connections. There is no account, server, analytics or cloud." }),
      h("li", { text: "Shared computer: anyone who knows the passphrase can read everything, including your check-ins. Use your own passphrase and lock it when you step away." }),
      h("li", { text: "Honest limits: it cannot protect you from malware on this computer, a weak passphrase, or someone watching you type. Printed pages and saved files are not encrypted. A lost passphrase cannot be recovered." }))));
    var mb = K.vaultSize(S.vault) / 1048576;
    wrap.appendChild(h("div", { class: "card" }, h("h2", { text: "About" }), h("p", { text: "Stark Caregiver " + V.VERSION + ", by Stark. Works offline; nothing is ever sent anywhere." }), h("p", { class: "lang-note", text: "This translation is a machine draft, not yet reviewed by a native speaker. To suggest a correction, use the Send feedback button." }),
      h("p", { class: "fine", text: C.DISCLAIMER + " Stark Caregiver is a record-keeping tool. It is not a medical device: it gives no dosing advice, does not check medicines against each other and does not diagnose." }),
      h("p", { class: "fine", text: "Record size: " + (mb < 0.1 ? "under 0.1" : mb.toFixed(1)) + " MB." }), starkNotice()));
    wrap.appendChild(h("div", { class: "card danger-zone" }, h("h2", { text: "Erase" }), h("p", { class: "muted", text: "Deletes the care record from this computer. Make a backup first if you might want it again." }),
      btn("Erase care record", "danger", function () { U.confirmBox("Erase everything?", "Your care record will be deleted from this computer. This cannot be undone without a backup file.", "Erase everything", true).then(function (ok) { if (ok) U.storeClear().then(function () { S.vault = null; S.session = null; lock(); }); }); })));
    return wrap;
  }
  // The licence line and build mark live in index.html (a template); apply_protect.py swaps the mark word at stamp time.
  function starkNotice() {
    var t = document.getElementById("stark-notice-tpl");
    return t && t.content.firstElementChild ? t.content.firstElementChild.cloneNode(true) : document.createComment("");
  }
  function changePass() {
    var cur = h("input", { id: "cur-pass", type: "password", autocomplete: "current-password" }), st = false, pf = U.passField("new-pass", "New passphrase", function (s) { st = s; }), msg = h("p", { class: "form-err", hidden: true, role: "alert" });
    return h("form", { class: "form", novalidate: true, onsubmit: function (e) {
      e.preventDefault(); msg.hidden = false;
      if (pf.input.value.length < 12 || !st || !st.ok) return (msg.textContent = "The new passphrase is too weak. Use at least 12 characters and a few unrelated words.");
      msg.textContent = "Checking and re-encrypting...";
      flush().then(U.storeGet).then(function (env) { return V.open(env, cur.value); }).then(function () { return V.newSession(pf.input.value, "vault"); })
        .then(function (sess) { S.session = sess; return firstStore(sess, S.vault); }).then(function () { cur.value = pf.input.value = ""; msg.textContent = "Passphrase changed. Old backup files still need the old passphrase."; U.toast("Passphrase changed."); })
        .catch(function () { msg.textContent = "The current passphrase is wrong."; });
    } }, h("div", { class: "field wide" }, h("label", { for: "cur-pass", text: "Current passphrase" }), cur), pf.el, msg, h("div", { class: "row" }, h("button", { type: "submit", class: "btn", text: "Change passphrase" })));
  }

  /* ---------- boot ---------- */
  window.__care = { state: S, lock: lock, render: render, startDemo: startDemo };
  // Shared helpers for views2.js and views3.js (same rules: build with textContent, never markup).
  A.S = S; A.btn = btn; A.section = section; A.empty = empty; A.badge = badge; A.save = save; A.render = render; A.row = row; A.pname = pname; A.peopleOpts = peopleOpts;
  A.visible = visible; A.ro = ro; A.personFilterBar = personFilterBar; A.actions = actions; A.upsert = upsert; A.byId = byId; A.printNode = printNode; A.stamp = stamp; A.remList = remList;
  A.whoBar = whoBar; A.curBy = curBy; A.byName = byName; A.helperOpts = helperOpts; A.today = today; A.dayLabel = dayLabel; A.editContact = editContact; A.lock = lock;
  // Boot once every script (including views2.js and views3.js) has run.
  document.addEventListener("DOMContentLoaded", function () { buildShell(); lockScreen(); });
})();
