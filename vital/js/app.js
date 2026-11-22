/* Stark Vital: the app shell. Welcome and example, set-up, lock and unlock, saving, routing, the search palette, theme and motion.
   Screens live in views*.js and register themselves in VitalApp.views. Everything is built with textContent, never parsed markup. */
(function () {
  "use strict";
  var V = window.StarkVital, U = window.VitalUI, D = window.VitalData, SF = window.VitalSafety, LN = window.VitalLearn, ST = window.VitalStats, h = U.h, $ = U.$;
  var WS = "me";
  var NAV = [["home", "Home"], ["checkin", "Check-in"], ["trends", "Trends"], ["year", "Year"], ["patterns", "What helps"], ["experiments", "Experiments"], ["levers", "Habits"], ["items", "My items"], ["labs", "Labs"], ["week", "Your week"], ["summary", "Visit summary"], ["data", "Data"], ["settings", "Settings"], ["about", "About"]];
  var S = { d: null, session: null, seq: 0, route: "home", param: "", example: false, last: Date.now(), saving: Promise.resolve(), saveTimer: null, rev: 0, pat: null, patRev: -1, ack: "" };
  var A = window.VitalApp = { views: {}, S: S, NAV: NAV, full: function () { return false; }, room: function () { return Infinity; }, afterRender: null, WS: WS };   // full / room / afterRender: hooks the Free trial build overrides

  /* ---- small helpers shared by the views ---- */
  function today() { return V.todayStr(); }
  function btn(text, cls, fn, extra) { return h("button", Object.assign({ type: "button", class: "btn " + (cls || ""), text: text, onclick: fn }, extra || {})); }
  function badge(text, cls) { return h("span", { class: "badge " + (cls || ""), text: text }); }
  function section(title, sub, actions) { return h("div", { class: "sec-head" }, h("div", null, h("h1", { text: title }), sub ? h("p", { class: "muted", text: sub }) : null), actions ? h("div", { class: "row" }, actions) : null); }
  function go(route, param) { S.param = param || ""; if (location.hash === "#/" + route + (param ? "/" + param : "")) render(); else location.hash = "#/" + route + (param ? "/" + param : ""); }
  function fmtDate(date, long) { var t = V.dayNum(date); if (isNaN(t)) return date; var dt = new Date(t * 86400000); return dt.toLocaleDateString(undefined, long ? { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" } : { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }); }
  function reduceMotion() { var s = S.d && S.d.settings.reduceMotion; if (s === true || s === false) return s; try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function applyMotion() { document.documentElement.dataset.motion = reduceMotion() ? "reduce" : "ok"; }
  function changed() { S.rev++; S.pat = null; }
  A.today = today; A.btn = btn; A.badge = badge; A.section = section; A.go = go; A.fmtDate = fmtDate; A.reduceMotion = reduceMotion; A.changed = changed;
  // Patterns are the heavy part; they are recomputed only when the entries changed.
  A.patterns = function () { if (!S.d) return { pairs: [], n: 0, tested: 0 }; if (!S.pat || S.patRev !== S.rev) { S.pat = ST.patterns(S.d, { boot: 1000, perm: 1000 }); S.patRev = S.rev; } return S.pat; };
  A.redFlags = function () { return S.d ? SF.redFlags(S.d, today()) : { active: false, reasons: [] }; };
  A.footerLine = SF.FOOTER;

  /* ---- saving ---- */
  function setState(text, bad) { var el = $("#save-state"); if (!el) return; el.textContent = text; el.classList.toggle("bad", !!bad); }
  function persist() {
    if (!S.d || S.example || !S.session) return Promise.resolve();
    S.saving = S.saving.catch(function () { return null; }).then(function () {
      var seq = S.seq + 1;
      return V.seal(S.session, S.d, "vital", null, seq).then(function (env) { return U.storePut(WS, env); }).then(function () { S.seq = seq; setState("Saved, encrypted"); });
    });
    return S.saving;
  }
  function saveFailed(x) { setState("NOT SAVED", true); U.toast("Could not save: " + (x && x.message || "storage refused the write") + " Download a backup in Data now.", true); }
  function save() { changed(); if (S.example) return; setState("Saving..."); clearTimeout(S.saveTimer); S.saveTimer = setTimeout(function () { persist().catch(saveFailed); }, 250); }
  function flush() { clearTimeout(S.saveTimer); if (!S.d) return S.saving.catch(function () { return null; }); return persist().catch(function (x) { saveFailed(x); throw x; }); }
  A.save = save; A.flush = flush;
  function askPersistence() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ } }

  /* ---- welcome, example, set-up ---- */
  function box() { return U.clear($("#main")); }
  function promises() {
    return h("ul", { class: "promises" },
      h("li", null, h("b", { text: "Private." }), " Everything stays on this computer, encrypted with your passphrase. No account, no server, no network."),
      h("li", null, h("b", { text: "Plain statistics." }), " It shows which of your habits went with your better days, how many days it looked at, and how sure it is."),
      h("li", null, h("b", { text: "Not medical advice." }), " It is a notebook and a habit tool. It does not tell you what a result or a symptom means for your health."));
  }
  function welcome() {
    var main = box(), wrap;
    document.body.classList.add("locked");
    wrap = h("div", { class: "welcome" },
      h("div", { class: "hero-intro" },
        h("p", { class: "eyebrow", text: "Stark Vital" }),
        h("h1", { text: "See which of your habits go with your better days." }),
        h("p", { class: "lede", text: "A daily check-in that takes a few taps. After about three weeks of entries it can show patterns in your own sleep, mood and energy, with how sure it is. Then test one change at a time." }),
        promises(),
        h("div", { class: "row big-row" }, btn("Look around with example data", "primary big", startExample), btn("Start my own", "big", function () { setup(); })),
        h("p", { class: "fine", text: "The example is made up, marked EXAMPLE on every screen, and never saved. Starting your own takes about a minute." }),
        h("p", { class: "fine" }, btn("Restore from a backup file", "small ghost", function () { restore(); }), " ", A.beamReceive ? btn("Receive from another device", "small ghost", function () { A.beamReceive(function (env) { restoreEnv(env, "the notebook on the other device"); }); }) : null)));
    main.appendChild(wrap);
    $("#topbar-tools").hidden = true; $("#nav").hidden = true;
  }
  function startExample() {
    S.d = D.exampleData(today()); S.example = true; S.session = null; S.seq = 0; S.rev++; S.pat = null; S.route = "home"; S.last = Date.now();
    location.hash = "#/home"; enter();
  }
  function setup() {
    var main = box(), err = h("p", { class: "form-err", role: "alert", hidden: true }), strong = null, adult, preg, b,
      p1 = U.passField("pass1", "Choose a passphrase", function (s) { strong = s; }), p2 = h("input", { id: "pass2", type: "password", autocomplete: "new-password", maxlength: 200 }),
      tracked = h("fieldset", null, h("legend", { text: "What to track (you can change this any time)" }), D.TRACKABLE.map(function (t) {
        var names = { sleep: "Sleep", mood: "Mood", energy: "Energy", training: "Training", food: "Food and drink (caffeine, alcohol, late meals)", light: "Light and screens", stress: "Stress", focus: "Focus", social: "Time with people", breath: "Slow breathing" };
        return h("label", { class: "chk" }, h("input", { type: "checkbox", value: t, checked: ["sleep", "mood", "energy"].indexOf(t) !== -1 }), names[t]);
      }));
    adult = h("input", { type: "checkbox", id: "adult" }); preg = h("input", { type: "checkbox", id: "preg" });
    b = h("button", { type: "submit", class: "btn primary big", text: "Create my private notebook" });
    main.appendChild(h("div", { class: "card lock" }, h("h1", { text: "Choose a passphrase" }),
      h("p", { class: "honest", text: "If you lose this passphrase, your data cannot be recovered. There is no reset and nobody to ask. Use a few unrelated words and write them down somewhere safe." }),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault(); err.hidden = true; U.clearInvalid(main);
        var pw = p1.input.value, fail = function (ctrl, text) { err.textContent = text; err.hidden = false; U.markInvalid(ctrl, err); };
        if (!adult.checked) return fail(adult, "Stark Vital is for adults. Please confirm you are 18 or older.");
        if (pw.length < 12) return fail(p1.input, "Use at least 12 characters. A few unrelated words work well.");
        if (strong && strong.score < 2) return fail(p1.input, "That passphrase is too easy to guess. Add more words.");
        if (pw !== p2.value) return fail(p2, "The two passphrases do not match.");
        b.disabled = true; b.textContent = "Creating...";
        var d = V.emptyData(); d.settings.adult = true; d.settings.restricted = preg.checked; d.settings.started = today();
        d.settings.tracked = Array.prototype.filter.call(tracked.querySelectorAll("input"), function (i) { return i.checked; }).map(function (i) { return i.value; });
        if (!d.settings.tracked.length) d.settings.tracked = ["mood"];
        V.newSession(pw).then(function (sess) {
          S.d = d; S.session = sess; S.example = false; S.rev++;
          return U.seqGet(WS).then(function (hw) { S.seq = hw; return persist(); });
        }).then(function () { askPersistence(); p1.input.value = p2.value = ""; location.hash = "#/checkin"; enter(); }, function (x) { S.d = null; b.disabled = false; b.textContent = "Create my private notebook"; err.textContent = "Could not create the notebook: " + x.message; err.hidden = false; });
      } },
        p1.el, h("div", { class: "field wide" }, h("label", { for: "pass2", text: "Type it again" }), p2), tracked,
        h("label", { class: "chk" }, adult, "I am 18 or older. (Stark Vital is for adults.)"),
        h("label", { class: "chk" }, preg, "I am pregnant or may be. (Switches off the sleep and training experiments; ask a clinician before changing habits.)"),
        err, h("div", { class: "row" }, b, btn("Back", "ghost", welcome))),
      h("p", { class: "fine", text: "Stark Vital protects your data from someone reading the files or a stolen drive. It cannot protect a computer with malware, someone watching you type, or a weak passphrase." })));
    $("#topbar-tools").hidden = true; $("#nav").hidden = true; p1.input.focus();
  }
  function lockScreen() {
    document.body.classList.add("locked"); $("#topbar-tools").hidden = true; $("#nav").hidden = true;
    U.hasRecord(WS).then(function (has) { if (!has) return welcome(); U.storeGet(WS).then(function (env) { if (!env) return welcome(); if (env.corrupt) return safeView(env.raw); unlockView(env); }); });
  }
  function unlockView(env) {
    var main = box(), pass = h("input", { id: "unlock-pass", type: "password", autocomplete: "current-password", maxlength: 200 }), err = h("p", { class: "form-err", role: "alert", hidden: true }), b = h("button", { type: "submit", class: "btn primary big", text: "Unlock" }), fails = 0;
    main.appendChild(h("div", { class: "card lock" }, h("h1", { text: "Unlock Stark Vital" }), h("p", { class: "muted", text: "Your notebook is encrypted on this computer. Enter your passphrase." }),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault(); err.hidden = true; var pw = pass.value; if (!pw) return;
        b.disabled = true; b.textContent = "Unlocking...";
        U.seqGet(WS).then(function (hw) {
          return V.openData(env, pw).then(function (r) { return finishUnlock(r, pw, hw); }).catch(function (x) {
            return U.storeGetBak(WS).then(function (bak) {
              if (!bak || x.invalid) throw x;
              return V.openData(bak, pw).then(function (r) { return U.storePut(WS, bak).then(function () { return finishUnlock(r, pw, hw, "The latest copy was damaged, so the last good copy was restored."); }); });
            }).catch(function () { throw x; });
          });
        }).catch(function (x) { fails++; b.disabled = false; b.textContent = "Unlock"; err.textContent = x.message + (fails > 2 ? " Remember: there is no way to reset a lost passphrase." : ""); err.hidden = false; U.markInvalid(pass, err); pass.select(); });
      } }, h("div", { class: "field wide" }, h("label", { for: "unlock-pass", text: "Passphrase" }), pass), err,
        h("div", { class: "row" }, b, btn("Restore from a backup file", "ghost", function () { restore(); })))),
      h("p", { class: "fine" }, "Forgot it? It cannot be recovered. ", btn("Erase this notebook from this computer", "small danger-o", function () { eraseAll(); })));
    pass.focus();
  }
  function finishUnlock(r, pw, hw, note) {
    var d = D.sanitize(r.data);
    S.d = d; S.session = r.session; S.seq = Math.max(r.seq || 0, hw || 0); S.example = false; S.rev++;
    enter();
    if (note) U.toast(note);
    else if (r.seq < hw) U.toast("This copy is older than the last one saved on this computer (save " + r.seq + " of " + hw + ").", true);
    if (r.upgrade) V.newSession(pw).then(function (sess) { S.session = sess; return persist(); }).then(function () { return U.storeGet(WS); }).then(function (env) { return U.setBak(WS, env); })
      .then(function () { U.toast("Encryption upgraded to " + V.KDF_ITER.toLocaleString() + " key-stretching rounds."); }, function (x) { U.toast("Could not upgrade the encryption strength: " + x.message, true); });
    return null;
  }
  function safeView(raw) {
    var main = box();
    main.appendChild(h("div", { class: "card lock" }, h("h1", { text: "The saved copy is damaged" }), h("p", { text: "Neither the latest copy nor the last good copy could be read. If you have a backup file, restore it. You can also keep the damaged data for later." }),
      h("div", { class: "row" }, btn("Restore from a backup file", "primary", function () { restore(); }), btn("Save the damaged data", "", function () { U.downloadText("stark-vital-raw-" + today() + ".json", JSON.stringify(raw), "application/json"); }),
        btn("Erase and start again", "danger-o", function () { eraseAll(); }))));
  }
  function eraseAll() {
    return U.confirmBox("Erase everything?", "This deletes your Stark Vital notebook from this computer. It cannot be undone, except from a backup file.", "Erase", true).then(function (ok) {
      if (!ok) return null; return U.wipeAll().then(function () { S.d = null; S.session = null; S.seq = 0; lockScreen(); U.toast("Everything was erased from this computer."); });
    });
  }
  A.eraseAll = function () { return U.wipeAll().then(function () { clearTimeout(S.saveTimer); S.d = null; S.session = null; S.seq = 0; S.example = false; U.closeAllDialogs(); location.hash = ""; lockScreen(); }); };

  /* ---- restore a backup file (from the welcome or lock screen) and import inside the app ---- */
  function readBackup(f) {
    var env;
    if (!f || f.tooBig || !f.json) return { error: "That file could not be read as a Stark Vital backup." };
    if (f.json.format === V.BUNDLE) { var why = V.validateBundle(f.json); if (why) return { error: why }; env = f.json.main; } else { var why2 = V.validateEnvelope(f.json, "vital"); if (why2) return { error: why2 }; env = f.json; }
    return { env: env };
  }
  A.readBackup = readBackup;
  function askPass(title, text, cb) {
    var inp = h("input", { id: "bk-pass", type: "password", autocomplete: "current-password", maxlength: 200 }), err = h("p", { class: "form-err", role: "alert", hidden: true }), dlg, go2 = h("button", { type: "submit", class: "btn primary", text: "Continue" });
    dlg = U.modal(title, h("form", { class: "form dlg-body", onsubmit: function (e) {
      e.preventDefault(); err.hidden = true; go2.disabled = true;
      cb(inp.value).then(function () { dlg.close(); }).catch(function (x) { go2.disabled = false; err.textContent = x.message; err.hidden = false; U.markInvalid(inp, err); });
    } }, h("p", { text: text }), h("div", { class: "field" }, h("label", { for: "bk-pass", text: "Passphrase of the backup" }), inp), err, h("div", { class: "row end" }, btn("Cancel", "", function () { dlg.close(); }), go2)));
    inp.focus();
  }
  A.askPass = askPass;
  function restoreEnv(env, from) {   // from: the file name, or where a beamed copy came from
    askPass("Restore backup", "Enter the passphrase that was in use when " + from + " was saved. It becomes your notebook on this computer.", function (pw) {
      return V.openData(env, pw).then(function (r) {
        return U.seqGet(WS).then(function (hw) {
          S.d = D.sanitize(r.data); S.session = r.session; S.seq = hw; S.example = false; S.rev++;
          return persist().then(function () { askPersistence(); enter(); U.toast("Backup restored: " + Object.keys(S.d.days).length + " days."); if (r.upgrade) V.newSession(pw).then(function (s) { S.session = s; return persist(); }); });
        });
      });
    });
  }
  function restore() {
    U.pickFile(".starkvital,.json,application/json").then(function (f) {
      if (!f) return; var rb = readBackup(f); if (rb.error) return U.toast(rb.error, true);
      restoreEnv(rb.env, f.name);
    });
  }

  /* ---- entering, locking, rendering ---- */
  function buildNav() {
    var nav = U.clear($("#nav"));
    NAV.forEach(function (n) { nav.appendChild(h("a", { href: "#/" + n[0], "data-nav": n[0], text: n[1] })); });
  }
  function parseHash() { var m = (location.hash || "").replace("#/", "").split("/"); return { route: m[0], param: m[1] || "" }; }
  function enter() {
    var p = parseHash();
    document.body.classList.remove("locked"); document.body.classList.toggle("example-mode", S.example);
    $("#topbar-tools").hidden = false; $("#nav").hidden = false; S.last = Date.now();
    S.route = NAV.some(function (n) { return n[0] === p.route; }) ? p.route : "home"; S.param = p.param;
    $("#ws-name").textContent = S.example ? "EXAMPLE, not saved" : "Private notebook"; $("#ws-name").classList.toggle("example", S.example);
    setState(S.example ? "Nothing is saved" : "Saved, encrypted"); applyMotion(); buildNav(); render();
  }
  function lock(why) {
    clearTimeout(S.saveTimer);
    (S.d && !S.example ? flush().catch(function () { return null; }) : Promise.resolve()).then(function () {
      var wasExample = S.example;
      S.d = null; S.session = null; S.seq = 0; S.example = false; S.pat = null; U.closeAllDialogs(); U.clear($("#print-root")); U.clear($("#main"));
      document.body.classList.remove("example-mode");
      if (wasExample) welcome(); else lockScreen();
      if (why) U.toast(why);
    });
  }
  A.lock = lock;
  function exampleBanner() {
    return h("div", { class: "banner example", role: "note" }, h("strong", { text: "EXAMPLE data, made up. " }), "Nothing you do here is saved. ", btn("Start my own", "small primary", function () { setup(); }));
  }
  function render() {
    if (!S.d) return;
    var main = U.clear($("#main")), view = A.views[S.route] || A.views.home;
    Array.prototype.forEach.call(document.querySelectorAll("#nav a"), function (a) { var on = a.dataset.nav === S.route; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (S.example) main.appendChild(exampleBanner());
    main.appendChild(view());
    if (A.afterRender) A.afterRender();
    document.title = (S.example ? "EXAMPLE " : "") + "Stark Vital" + (S.route === "home" ? "" : " - " + (NAV.filter(function (n) { return n[0] === S.route; })[0] || ["", ""])[1]);
    main.focus({ preventScroll: true });
  }
  A.render = render; A.enter = enter;

  /* ---- search palette (Ctrl+K): jump to a screen or search your own notes. Never answers questions about topics it does not cover. ---- */
  function palette() {
    if (!S.d) return;
    var inp = h("input", { class: "pal-input", type: "search", placeholder: "Go to a screen, or search your notes", "aria-label": "Search", autocomplete: "off", maxlength: 120 }), list = h("ul", { class: "pal-list", role: "listbox" }), dlg, items = [], sel = 0;
    function show(q) {
      U.clear(list); items = []; sel = 0; q = q.trim().toLowerCase();
      if (q && SF.refused(q)) { list.appendChild(h("li", { class: "pal-refuse", text: SF.REFUSAL })); return; }
      NAV.forEach(function (n) { if (!q || n[1].toLowerCase().indexOf(q) !== -1) items.push({ t: n[1], sub: "Go to screen", fn: function () { go(n[0]); } }); });
      if (q.length > 1) D.dates(S.d).sort(function (a, b) { return a < b ? 1 : -1; }).forEach(function (date) { var r = S.d.days[date]; if (r.note && r.note.toLowerCase().indexOf(q) !== -1 && items.length < 14) items.push({ t: r.note, sub: fmtDate(date, true), fn: function () { go("checkin", date); } }); });
      if (q.length > 1) S.d.labs.forEach(function (l) { if ((l.analyte + " " + l.lab + " " + l.panel).toLowerCase().indexOf(q) !== -1 && items.length < 18) items.push({ t: l.analyte + ": " + l.value + " " + l.unit, sub: "Lab, " + fmtDate(l.takenOn), fn: function () { go("labs"); } }); });
      if (!items.length) list.appendChild(h("li", { class: "pal-empty", text: "Nothing found in your entries." }));
      items.slice(0, 14).forEach(function (it, i) { list.appendChild(h("li", { role: "option", "aria-selected": i === 0 ? "true" : "false", class: i === 0 ? "on" : "", onclick: function () { dlg.close(); it.fn(); } }, h("span", { text: it.t }), h("small", { text: it.sub }))); });
    }
    inp.addEventListener("input", function () { show(inp.value); });
    inp.addEventListener("keydown", function (e) {
      var lis = list.querySelectorAll("li[role=option]");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!lis.length) return; lis[sel].classList.remove("on"); lis[sel].setAttribute("aria-selected", "false"); sel = (sel + (e.key === "ArrowDown" ? 1 : lis.length - 1)) % lis.length; lis[sel].classList.add("on"); lis[sel].setAttribute("aria-selected", "true"); lis[sel].scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") { e.preventDefault(); if (items[sel]) { dlg.close(); items[sel].fn(); } }
    });
    dlg = U.modal("Search", h("div", { class: "dlg-body" }, inp, list), { wide: false }); dlg.classList.add("pal"); show(""); inp.focus();
  }
  A.palette = palette;

  /* ---- shell ---- */
  function applyTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem("sv-theme", t); } catch (e) { /* ignore */ } }
  function applySize(n) { document.documentElement.style.fontSize = n + "%"; try { localStorage.setItem("sv-size", String(n)); } catch (e) { /* ignore */ } }
  A.applyTheme = applyTheme; A.applySize = applySize; A.applyMotion = applyMotion;
  A.size = function () { try { return +localStorage.getItem("sv-size") || 100; } catch (e) { return 100; } };
  function tick() {
    var t = $("#lock-timer");
    if (!S.d || S.example) { if (t) t.textContent = ""; return; }
    var left = (S.d.settings.lockMin || 10) * 60 - Math.floor((Date.now() - S.last) / 1000);
    if (left <= 0) return lock("Locked after " + (S.d.settings.lockMin || 10) + " minutes of inactivity.");
    t.textContent = left <= 60 ? "Locking in " + left + "s" : "Auto-lock " + Math.ceil(left / 60) + " min";
  }
  function buildShell() {
    $("#lock-btn").addEventListener("click", function () { lock(); });
    $("#search-btn").addEventListener("click", palette);
    $("#theme-btn").addEventListener("click", function () { applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); });
    window.addEventListener("hashchange", function () { var p = parseHash(); if (S.d && NAV.some(function (n) { return n[0] === p.route; })) { S.route = p.route; S.param = p.param; render(); window.scrollTo(0, 0); } });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); palette(); }
      else if (S.d && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === "g" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) { A.gPending = Date.now(); }
      else if (S.d && A.gPending && Date.now() - A.gPending < 1200 && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) {
        var map = { h: "home", c: "checkin", t: "trends", p: "patterns", e: "experiments", l: "labs" }; if (map[e.key]) { go(map[e.key]); } A.gPending = 0;
      }
    });
    ["mousemove", "keydown", "click", "touchstart", "scroll", "wheel"].forEach(function (ev) { document.addEventListener(ev, function () { S.last = Date.now(); }, { passive: true, capture: true }); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && S.d && !S.example && S.d.settings.lockOnHide) lock("Locked because the tab was hidden."); });
    window.addEventListener("beforeunload", function () { if (S.d && !S.example) { clearTimeout(S.saveTimer); persist(); } });
    setInterval(tick, 1000);
    try { var t = localStorage.getItem("sv-theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; var z = +localStorage.getItem("sv-size"); if (z >= 100 && z <= 160) document.documentElement.style.fontSize = z + "%"; } catch (e) { /* ignore */ }
    applyMotion();
  }
  document.addEventListener("DOMContentLoaded", function () { buildShell(); lockScreen(); });
})();
