/* Stark Fellowship, by Stark: app shell, setup, sign-in, home, users and settings.
   Offline. The only thing ever stored is the encrypted book. */
(function () {
  "use strict";
  var K = StarkCore, B = StarkBooks, M = StarkCommunity, E = StarkEdition, U = FellowUI, h = U.h, $ = U.$, btn = U.btn;
  var S = { file: null, session: null, data: null, route: "home", dirty: {}, saveTimer: null, saving: Promise.resolve(), last: Date.now(), page: {} };
  var NAV = [["home", "Home", null], ["people", "Directory", "people"], ["teams", "Teams and rotas", "teams"], ["groups", "Groups", "groups"], ["checkin", "Check-in", "checkin"], ["kids", "Children", "checkin"], ["giving", "Giving", "giving"],
    ["care", "Care", "care"], ["help", "Help requests", "help"], ["users", "Users", "users"], ["settings", "Settings", "settings"]];
  var PART_WORDS = { core: "names, households, teams, gatherings", contact: "contact details", giving: "giving and books", care: "care visits", notes: "private care notes", help: "help requests" };
  var A = window.FellowApp = { S: S, views: {}, NAV: NAV };

  /* ---------- helpers shared with the views ---------- */
  A.today = function () { return K.todayStr(); };
  A.hm = function (iso) { return M.hm(iso); };
  A.can = function (area) { return K.can(S.session, area); };
  A.holds = function (part) { return K.holds(S.session, part); };
  A.me = function () { return S.session.user.name; };
  // One directory index per render (views call A.idx() many times); cleared on every render and save.
  A.idx = function () { return S.idx || (S.idx = M.index(S.data.core)); };
  A.personName = function (pid, x) { x = x || A.idx(); return M.name(x.p[pid]); };
  A.giverName = function (key, x) {
    x = x || A.idx();
    if (!key) return "Unnamed (loose gifts)";
    var id = key.slice(2);
    if (key[0] === "h") return x.h[id] ? x.h[id].name : "Removed household";
    return M.name(x.p[id]);
  };
  A.sec = function (title, sub, actions) { return h("div", { class: "sec-head" }, h("div", null, h("h1", { text: title }), sub ? h("p", { class: "muted", text: sub }) : null), h("div", { class: "row wrap" }, actions || [])); };
  A.kpis = function (list) { return h("div", { class: "stats" }, list.map(function (k) { return h(k[2] ? "a" : "div", { class: "stat" + (k[3] ? " " + k[3] : ""), href: k[2] || null }, h("b", { text: String(k[1]) }), h("span", { text: k[0] })); })); };
  A.empty = function (text, cta) { return h("div", { class: "empty" }, h("p", { text: text }), cta || null); };
  A.table = function (heads, rows, cls) { return h("div", { class: "scroll-x" }, h("table", { class: "tbl " + (cls || "") }, h("thead", null, h("tr", null, heads.map(function (x) { return h("th", { text: x }); }))), h("tbody", null, rows))); };
  A.pager = function (key, total, per, redraw) {
    var pages = Math.max(1, Math.ceil(total / per)), p = Math.min(S.page[key] || 0, pages - 1);
    S.page[key] = p;
    if (pages < 2) return null;
    return h("div", { class: "row pager" }, btn("Previous", "small", function () { S.page[key] = Math.max(0, p - 1); redraw(); }, { disabled: p === 0 }),
      h("span", { class: "muted", text: "Page " + (p + 1) + " of " + pages + " (" + total + ")" }), btn("Next", "small", function () { S.page[key] = Math.min(pages - 1, p + 1); redraw(); }, { disabled: p >= pages - 1 }));
  };
  A.paper = function (title, sub) {
    var st = S.data.core.settings;
    return h("div", { class: "printdoc" }, h("p", { class: "kicker", text: st.name }), h("h1", { text: title }), sub ? h("p", { class: "meta", text: sub }) : null);
  };
  A.log = function (what) { M.log(S.data.core, A.me(), what); A.save("core"); };
  A.money = B.fmt;

  /* ---------- saving: only changed parts are re-encrypted ---------- */
  function saveState(text, bad) { var c = $("#save-state"); c.textContent = text; c.classList.toggle("bad", !!bad); }
  // Every failed save is shown (status chip plus an alert) and its parts stay marked, so the next save tries them again.
  function saveFailed(x) {
    saveState("Not saved", true);
    U.toast("Could not save" + (x && x.message ? ": " + x.message : ".") + " Your changes are still on screen. Make a backup from Settings.", true);
  }
  A.saveFailed = saveFailed;
  A.save = function () {
    Array.prototype.forEach.call(arguments, function (p) { if (A.holds(p)) S.dirty[p] = 1; });
    S.idx = null;
    saveState("Saving...");
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(function () { flush().catch(saveFailed); }, 400);
  };
  // Seal (generation + user-list MAC), store, read back, remember the generation, then copy to the live file if one is set.
  function persist(file, session) {
    return K.stamp(session, file).then(function () { return U.storePut(file); }).then(function () {
      U.raiseHigh(file.id, file.gen);
      if (U.mirror.handle) U.mirrorWrite(JSON.stringify(file));
    });
  }
  A.persist = persist;
  function flush() {
    clearTimeout(S.saveTimer);
    var parts = Object.keys(S.dirty), sess = S.session, file = S.file, data = S.data;
    S.dirty = {};
    if (!sess) return S.saving;
    if (data.notes && data.care) M.pruneNotes(data.care, data.notes);
    S.saving = S.saving.catch(function () { return null; }).then(function () {
      return Promise.all(parts.map(function (p) { return K.sealPart(sess, p, data[p]).then(function (box) { file.parts[p] = box; }); }));
    }).then(function () { return persist(file, sess); }).then(function () { if (S.session === sess) saveState("Saved, encrypted"); }, function (x) {
      if (S.session === sess) parts.forEach(function (p) { S.dirty[p] = 1; });
      throw x;
    });
    return S.saving;
  }
  A.flush = flush;
  A.saveFile = flush; // flush always writes the whole file, users included

  /* ---------- first run and sign-in ---------- */
  function brandMark(size) {
    var NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size); s.setAttribute("height", size); s.setAttribute("aria-hidden", "true");
    [["circle", { cx: 12, cy: 12, r: 8.2, fill: "none", stroke: "currentColor", "stroke-width": 2.2 }], ["circle", { cx: 12, cy: 3.8, r: 2.6, fill: "currentColor" }],
      ["circle", { cx: 4.9, cy: 16.1, r: 2.6, fill: "currentColor" }], ["circle", { cx: 19.1, cy: 16.1, r: 2.6, fill: "currentColor" }]].forEach(function (d) {
      var e = document.createElementNS(NS, d[0]); Object.keys(d[1]).forEach(function (k) { e.setAttribute(k, d[1][k]); }); s.appendChild(e);
    });
    return s;
  }
  A.brandMark = brandMark;
  function lockScreen() {
    var main = U.clear($("#main")), box = h("div", { class: "lock card" });
    document.body.classList.add("locked"); $("#topbar-tools").hidden = true; $("#nav").hidden = true; $("#who").hidden = true;
    main.appendChild(box);
    U.storeGet().then(function (f) { if (!f) return createView(box); if (f.corrupt) return safeView(box, f.raw); signInView(box, f); }, function () { noStorageView(box); });
  }
  // Private windows and blocked site data: say so instead of showing an empty page or silently losing work.
  function noStorageView(box) {
    U.clear(box).appendChild(h("div", null, h("h1", { text: "This browser is not letting the app store records" }),
      h("div", { class: "banner warn", role: "alert" }, h("strong", { text: "Nothing can be saved here. " }),
        "This usually means a private window, or site data is blocked for this page. Open Stark Fellowship in a normal window, or allow site data, then reload."),
      h("div", { class: "row wrap" }, btn("Try again", "primary", lockScreen))));
  }
  function honest() {
    return h("div", { class: "honest" }, h("strong", { text: "Please read this once. " }),
      "Your community's records are locked with keys made from each user's passphrase. Passphrases are never saved. A Leader can reset another user's passphrase, " +
      "but if every Leader forgets theirs, the private care notes are gone for good. Add a second Leader soon, and keep a backup file somewhere safe.");
  }
  function createView(box) {
    var err = U.errBox(), p1 = U.passField("pass1", "Choose your passphrase"), p2 = h("input", { id: "pass2", type: "password", autocomplete: "new-password", maxlength: 200 });
    var comm = h("input", { id: "cname", type: "text", maxlength: 120, placeholder: "For example: Riverside Community", autocomplete: "off" }), me = h("input", { id: "yourname", type: "text", maxlength: 80, autocomplete: "off" });
    var ack = h("input", { id: "ack", type: "checkbox" }), all = [comm, me, p1.input, p2, ack];
    U.clear(box).appendChild(h("div", null,
      h("h1", { text: "Set up your community" }),
      h("p", { class: "muted", text: "For congregations of any faith and for civic and community groups. Your directory, teams, check-in, giving records, care visits and help requests stay on this computer, encrypted with AES-256-GCM. Nothing is sent anywhere." }),
      honest(),
      h("form", { class: "form", novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var why = K.passProblem(p1.input.value, p2.value);
        if (!comm.value.trim()) return U.fieldError(err, "Enter your community's name.", comm, all);
        if (!me.value.trim()) return U.fieldError(err, "Enter your name.", me, all);
        if (why) return U.fieldError(err, why, /match/.test(why) ? p2 : p1.input, all);
        if (!ack.checked) return U.fieldError(err, "Please tick the box to confirm you understand.", ack, all);
        U.fieldError(err, "Working... this takes a moment on purpose, to slow down guessing.", null, all);
        e.target.querySelector("button[type=submit]").disabled = true;
        var data = { core: M.emptyCore(comm.value), contact: M.emptyContact(), giving: B.empty(), care: M.emptyCare(), notes: M.emptyNotes(), help: M.emptyHelp() };
        K.createBook({ name: comm.value, leader: me.value, pass: p1.input.value, data: data }).then(function (r) {
          M.log(data.core, r.session.user.name, "Community set up");
          return K.sealPart(r.session, "core", data.core).then(function (bx) { r.file.parts.core = bx; return persist(r.file, r.session); }).then(function () { p1.input.value = p2.value = ""; enter(r.file, r.session, data); });
        }).catch(function (x) { err.textContent = x.message; e.target.querySelector("button[type=submit]").disabled = false; });
      } },
        h("div", { class: "field" }, h("label", { for: "cname", text: "Community name" }), comm),
        h("div", { class: "field" }, h("label", { for: "yourname", text: "Your name (you will be a Leader)" }), me),
        p1.el, h("div", { class: "field wide" }, h("label", { for: "pass2", text: "Type it again" }), p2),
        h("div", { class: "field check wide" }, ack, h("label", { for: "ack", text: "I understand that lost passphrases cannot be recovered by anyone, including Stark." })),
        err, h("div", { class: "row wrap" }, h("button", { type: "submit", class: "btn primary big", text: "Create" }))),
      h("div", { class: "card inset" }, h("h2", { text: "Just looking?" }),
        h("p", { class: "fine", text: "Open an example community with 2,000 made-up people, six example users (one per role) and a year of example giving. You can erase it and start fresh at any time." }),
        btn("Try the example community", "", function (e) { tryDemo(e.target, err); })),
      otherOptions(false)));
  }
  function tryDemo(b, err) {
    b.disabled = true; b.textContent = "Building the example...";
    setTimeout(function () {
      StarkDemo.create(A.today(), undefined, E.isTrial() ? 12 : undefined).then(function (r) { return U.storePut(r.file).then(function () { U.setHigh(r.file.id, r.file.gen); enter(r.file, r.session, r.data); U.toast("Example community ready. You are signed in as its Leader."); }); })
        .catch(function (x) { b.disabled = false; b.textContent = "Try the example community"; err.hidden = false; err.textContent = x.message; });
    }, 30);
  }
  function signInView(box, file) {
    var chosen = null, err = U.errBox(), fails = 0;
    var pass = h("input", { id: "signin-pass", type: "password", autocomplete: "current-password", maxlength: 200, "aria-describedby": err.id });
    var list = h("div", { class: "who-list", role: "radiogroup", "aria-label": "Who is signing in?" }, file.users.map(function (u) {
      return h("button", { type: "button", class: "who-btn", role: "radio", "aria-checked": "false", "data-user": u.id, onclick: function (e) {
        chosen = u; Array.prototype.forEach.call(list.children, function (c) { c.setAttribute("aria-checked", c === e.currentTarget ? "true" : "false"); });
        form.hidden = false; $("#signin-name").textContent = u.name; pass.value = ""; err.hidden = true; pass.focus();
      } }, h("strong", { text: u.name }), h("span", { text: K.ROLES[u.role].label }));
    }));
    var form = h("form", { class: "form", novalidate: true, hidden: true, onsubmit: function (e) {
      e.preventDefault();
      var b = e.target.querySelector("button[type=submit]"), typed = pass.value; b.disabled = true; err.hidden = false; err.textContent = "Checking..."; pass.removeAttribute("aria-invalid");
      K.signIn(file, chosen.id, typed).then(function (r) {
        pass.value = "";
        return afterSignIn(file, r, typed).then(function () { typed = ""; enter(file, r.session, r.data); });
      }).catch(function (x) { typed = ""; fails++; b.disabled = false; pass.setAttribute("aria-invalid", "true"); err.textContent = x.message + (fails > 2 ? " A Leader or Administrator can set a new passphrase for you." : ""); pass.select(); });
    } }, h("p", { class: "muted" }, "Passphrase for ", h("strong", { id: "signin-name" })),
      h("div", { class: "field wide" }, h("label", { for: "signin-pass", class: "sr-only", text: "Passphrase" }), pass), err,
      h("div", { class: "row" }, h("button", { type: "submit", class: "btn primary big", text: "Sign in" })));
    U.clear(box).appendChild(h("div", null,
      h("h1", { text: file.name }),
      file.demo ? h("div", { class: "banner demo" }, h("strong", { text: "Example community. " }), "Every person, address and amount is made up. Every example user's passphrase is: ", h("code", { text: StarkDemo.PASS })) : null,
      h("p", { class: "muted", text: "Who is using this computer? Each person signs in with their own passphrase and sees only what their role allows." }),
      list, form, otherOptions(true)));
  }
  // After a good passphrase: upgrade this user's keys (format 2, 600,000 rounds) while the passphrase is in hand,
  // compare the book's generation with the highest this browser has seen, and find the live backup file.
  function afterSignIn(file, r, pass) {
    S.rollback = null;
    return U.getHigh(file.id).then(function (hw) {
      if ((file.gen || 0) < hw) S.rollback = { gen: file.gen || 0, seen: hw };
      if (!r.session.upgrade) return null;
      return K.rekeyUser(r.session, r.session.user, pass).then(function (nu) {
        var i = file.users.findIndex(function (x) { return x.id === nu.id; }), old = file.users[i];
        file.users[i] = nu; r.session.user = nu;
        return persist(file, r.session).catch(function () { file.users[i] = old; r.session.user = old; }); // the old keys still open the stored copy
      }).catch(function () { return null; }); // an upgrade problem never blocks signing in; it is tried again next time
    }).then(function () { return U.mirrorRestore(file.id); });
  }
  function safeView(box, raw) {
    U.clear(box).appendChild(h("div", null, h("h1", { text: "Safe mode" }),
      h("div", { class: "banner warn", role: "alert" }, h("strong", { text: "The stored records could not be read and there is no earlier copy. " }), "Nothing has been changed or deleted. Save the raw file now, then restore from a backup."),
      h("div", { class: "row wrap" }, btn("Save the raw file", "primary", function () { U.downloadText("stark-fellowship-raw-" + A.today() + ".starkfellowship", JSON.stringify(raw), "application/json"); })),
      otherOptions(true)));
  }
  function otherOptions(hasBook) {
    return h("details", { class: "other" }, h("summary", { text: "Other options" }), h("div", { class: "row wrap" },
      btn("Restore from a backup file", "", restore),
      hasBook ? btn("Erase everything on this computer", "danger-o", function () {
        U.confirmBox("Erase everything?", "This deletes the encrypted records stored in this browser. Without a backup file and a passphrase they cannot be brought back.", "Erase everything", true)
          .then(function (ok) { if (ok) U.storeClear().then(lockScreen, function () { U.toast("Could not erase the stored records. Close other tabs and try again.", true); }); });
      }) : null));
  }
  function restore() {
    U.pickFile(".starkfellowship,.json,application/json", 160 * 1024 * 1024).then(function (f) {
      if (!f) return;
      var file = null; try { file = JSON.parse(f.text); } catch (e) { file = null; }
      var why = file ? K.validateFile(file) : "That file could not be read.";
      if (why) return U.toast(why, true);
      U.confirmBox("Restore " + file.name + "?", "This replaces the records stored on this computer with the backup (" + file.users.length + " users). Anyone signing in uses their passphrase from the backup.", "Restore", true)
        .then(function (ok) {
          if (!ok) return;
          clearTimeout(S.saveTimer); S.dirty = {};
          // restoring on purpose: this copy becomes the newest this browser has seen
          U.storePut(file).then(function () { return U.setHigh(file.id, file.gen || 0); }).then(function () { S.session = null; S.data = null; S.file = null; U.closeAllDialogs(); lockScreen(); U.toast("Backup restored. Sign in to continue."); },
            function (x) { U.toast("The backup could not be stored" + (x && x.message ? ": " + x.message : ".") + " Nothing was changed.", true); });
        });
    });
  }
  A.restore = restore;

  /* ---------- app shell ---------- */
  function enter(file, session, data) {
    S.file = file; S.session = session; S.data = data; S.dirty = {}; S.last = Date.now(); S.page = {}; S.idx = null;
    var kidsOut = M.cleanGroups(data.core);   // small groups never hold children: a backup or an edited file cannot bring one in
    document.body.classList.remove("locked");
    $("#topbar-tools").hidden = false; $("#who").hidden = false;
    $("#who").textContent = session.user.name + " · " + K.ROLES[session.user.role].label;
    $("#save-state").textContent = "Saved, encrypted";
    var nav = U.clear($("#nav")); nav.hidden = false;
    NAV.forEach(function (n) { if (!n[2] || A.can(n[2])) nav.appendChild(h("a", { href: "#/" + n[0], "data-nav": n[0], text: n[1] })); });
    if (location.hash !== "#/home") history.replaceState(null, "", "#/home"); // each person starts at Home, never on the last person's page
    route();
    if (kidsOut) { M.log(data.core, session.user.name, "Removed " + kidsOut + " child record" + (kidsOut === 1 ? "" : "s") + " found in small groups"); A.save("core"); U.toast("Children cannot be in small groups. " + kidsOut + " child record" + (kidsOut === 1 ? " was" : "s were") + " taken out of the group lists. Children's attendance stays in Children's check-in.", true); }
  }
  A.signOut = function (why) {
    clearTimeout(S.saveTimer);
    var done = S.session ? flush().catch(function () { return null; }) : Promise.resolve();
    done.then(function () { S.session = null; S.data = null; S.file = null; S.idx = null; S.rollback = null; U.mirror.handle = null; U.closeAllDialogs(); U.clear($("#print-root")); lockScreen(); if (why) U.toast(why); });
  };
  function allowed(r) { var n = NAV.filter(function (x) { return x[0] === r; })[0]; return !!n && (!n[2] || A.can(n[2])); }
  function route() {
    if (!S.session) return;
    var r = (location.hash || "").replace(/^#\/?/, "").split("?")[0];
    S.route = allowed(r) ? r : "home";
    A.render();
  }
  A.render = function () {
    if (!S.session) return;
    S.idx = null;
    var main = U.clear($("#main")), view = S.route === "home" ? vHome : S.route === "users" ? vUsers : S.route === "settings" ? vSettings : A.views[S.route];
    Array.prototype.forEach.call(document.querySelectorAll("#nav a"), function (a) { var on = a.dataset.nav === S.route; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (S.file.demo) main.appendChild(h("div", { class: "banner demo" }, h("strong", { text: "Example community. " }), "Every person, address and amount here is made up. ",
      A.can("users") ? btn("Erase the example and start fresh", "small", function () {
        U.confirmBox("Erase the example?", "This deletes the example community from this computer so you can set up your own.", "Erase example", true).then(function (ok) { if (ok) { S.session = null; U.storeClear().then(lockScreen, function () { U.toast("Could not erase the stored records. Close other tabs and try again.", true); lockScreen(); }); } });
      }) : null));
    if (E.isTrial()) main.appendChild(trialBanner());
    if (S.rollback) main.appendChild(h("div", { class: "banner warn", role: "alert" }, h("strong", { text: "This is an older copy of the records. " }),
      "This browser has already saved a newer one (save number " + S.rollback.seen + "; this copy is number " + S.rollback.gen + "). If nobody restored a backup on purpose, someone may have put an old copy back. Check recent changes before going on. ",
      btn("I restored it on purpose", "small", function () { S.rollback = null; U.setHigh(S.file.id, S.file.gen || 0); A.render(); })));
    if (U.mirror.handle && U.mirror.state === "needs-permission") main.appendChild(h("div", { class: "banner" }, h("strong", { text: "Live backup file paused. " }),
      "The browser needs your permission again to keep writing the live backup file. ",
      btn("Reconnect the live file", "small primary", function () { U.mirrorReconnect().then(function (st) { if (st === "ready") { U.mirrorWrite(JSON.stringify(S.file)); U.toast("Live backup file reconnected."); } A.render(); }, function () { U.toast("Permission was not given.", true); }); })));
    main.appendChild((view || vHome)());
    main.focus({ preventScroll: true });
  };

  /* ---------- home ---------- */
  function vHome() {
    var D = S.data.core, t = A.today(), x = A.idx(), root = h("div"), st = M.stats(D), cards = h("div", { class: "cards" }), k = [];
    root.appendChild(A.sec(D.settings.name, "Welcome, " + A.me().replace(/ \(example\)$/, "") + ". Today is " + K.weekday(t) + ", " + t + "."));
    if (A.can("people")) k.push(["people", st.people, "#/people"], ["households", st.households, "#/people"]);
    if (A.can("checkin")) {
      var ev = D.events.filter(function (e) { return e.date === t; })[0] || D.events.filter(function (e) { return e.date > t; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
      if (ev) k.push([ev.date === t ? "checked in today" : "next: " + ev.name + " " + ev.date, ev.date === t ? M.counts(D, ev, x).total : "-", "#/checkin"]);
    }
    if (A.can("teams")) { var cov = M.coverage(M.slotsIn(D, t, K.addDays(t, 14))); k.push(["rota gaps, next 2 weeks", cov.gaps, "#/teams", cov.gaps ? "warn" : "good"]); }
    if (A.can("giving")) { var G = S.data.giving, ytd = B.totals(G, t.slice(0, 4) + "-01-01", t), mo = B.totals(G, t.slice(0, 7) + "-01", t); k.push(["given this month", B.fmt(mo.total), "#/giving", "small"], ["given this year", B.fmt(ytd.total), "#/giving", "small"]); }
    if (A.can("care")) k.push(["care follow-ups due", M.followUps(S.data.care, t, 7).length, "#/care"]);
    if (A.can("help")) k.push(["open help requests", M.helpTotals(S.data.help, t.slice(0, 4)).open, "#/help"]);
    root.appendChild(A.kpis(k));
    if (A.can("care")) {
      var ns = M.notSeen(D, t, D.settings.notSeenWeeks);
      cards.appendChild(h("div", { class: "card" }, h("h2", { text: "Not seen lately" }), h("p", { class: "fine", text: "Members and regular attenders with no check-in for " + D.settings.notSeenWeeks + " weeks. A call or visit may be welcome." }),
        ns.length ? h("ul", { class: "plain" }, ns.slice(0, 6).map(function (r) { return h("li", null, h("strong", { text: M.name(r.person) }), " ", h("span", { class: "muted", text: r.last ? "last seen " + r.last : "no check-in yet" })); }),
          ns.length > 6 ? h("li", null, h("a", { href: "#/care", text: "See all " + ns.length })) : null) : h("p", { class: "muted", text: "Everyone has been seen recently." })));
    }
    if (A.holds("contact") && A.can("people")) {
      var bd = M.birthdays(D, S.data.contact, t, 7);
      cards.appendChild(h("div", { class: "card" }, h("h2", { text: "Birthdays this week" }),
        bd.length ? h("ul", { class: "plain" }, bd.slice(0, 8).map(function (b) { return h("li", null, h("strong", { text: M.name(b.person) }), " ", h("span", { class: "muted", text: b.inDays === 0 ? "today" : K.weekday(b.date) + " " + b.date })); }),
          bd.length > 8 ? h("li", { class: "muted", text: "and " + (bd.length - 8) + " more" }) : null) : h("p", { class: "muted", text: "No birthdays recorded this week." })));
    }
    if (A.can("teams")) {
      var up = M.slotsIn(D, t, K.addDays(t, 7)).filter(function (s) { return s.people.length < s.need; }), tn = {};
      D.teams.forEach(function (q) { tn[q.id] = q.name; });
      cards.appendChild(h("div", { class: "card" }, h("h2", { text: "This week's rota gaps" }),
        up.length ? h("ul", { class: "plain" }, up.slice(0, 6).map(function (s) { return h("li", null, h("strong", { text: tn[s.team] + ": " + s.role }), " ", h("span", { class: "muted", text: K.weekday(s.date) + " " + s.date + ", needs " + (s.need - s.people.length) + " more" })); })) :
          h("p", { class: "muted", text: "Every slot this week is filled." })));
    }
    if (!A.can("people")) cards.appendChild(h("div", { class: "card" }, h("h2", { text: "Check-in" }), h("p", { text: "Your role is set up for check-in at gatherings." }), h("a", { class: "btn primary", href: "#/checkin", text: "Open check-in" })));
    if (A.homeInsight && A.can("people")) cards.appendChild(A.homeInsight());
    root.appendChild(cards);
    root.appendChild(h("p", { class: "fine", text: "Signed in as " + A.me() + " (" + K.ROLES[S.session.user.role].label + "). This role can read: " + Object.keys(S.session.keys).map(function (p) { return PART_WORDS[p]; }).join(", ") + "." }));
    return root;
  }

  /* ---------- users and roles ---------- */
  function vUsers() {
    var root = h("div"), me = S.session.user;
    root.appendChild(A.sec("Users", "Everyone who uses this computer for the community signs in as themselves. Reading rights are enforced by encryption: a role simply does not hold the keys to what it may not see.",
      [btn("Add a user", "primary", function () { userForm(null); })]));
    root.appendChild(A.table(["Name", "Role", "Can read", ""], S.file.users.map(function (u) {
      return h("tr", null, h("td", null, h("strong", { text: u.name }), u.id === me.id ? h("span", { class: "tag", text: "you" }) : null, K.needsReset(u) ? h("span", { class: "tag warn", text: "needs a new passphrase" }) : null), h("td", { text: K.ROLES[u.role].label }),
        h("td", { class: "fine", text: K.needsReset(u) ? "Nothing until a new passphrase is set" : Object.keys(u.keys).map(function (p) { return PART_WORDS[p]; }).join(", ") }),
        h("td", null, canManage(u) ? h("div", { class: "row tight" }, btn("New passphrase or role", "small", function () { userForm(u); }, { "aria-label": "New passphrase or role for " + u.name }),
          u.id !== me.id ? btn("Remove", "small danger-o", function () { removeUser(u); }, { "aria-label": "Remove " + u.name }) : null) : h("span", { class: "fine", text: "Only a Leader can change this user." })));
    })));
    root.appendChild(h("div", { class: "card" }, h("h2", { text: "Roles" }), h("dl", { class: "roles" }, Object.keys(K.ROLES).map(function (r) {
      return [h("dt", { text: K.ROLES[r].label }), h("dd", { text: K.ROLES[r].desc })];
    })), h("p", { class: "fine", text: "You can only give access you have yourself. An Administrator, for example, cannot create a Leader or a Care team member, because Administrators do not hold the private care notes key." })));
    root.appendChild(securityCard());
    return root;
  }
  /* ---------- security check-up and key rotation ---------- */
  function securityCard() {
    var r = K.securityReport(S.file, S.rollback ? S.rollback.seen : null), held = K.PARTS.filter(function (p) { return A.holds(p); }), list = [];
    list.push([r.sealed ? "good" : "warn", r.sealed ? "The user list and every encrypted part are sealed together (save number " + r.gen + "). Changes made outside the app are refused at sign-in." : "This book is from an earlier version. It is sealed on the next save."]);
    list.push([r.older ? "bad" : "good", r.older ? "This copy is older than one this browser saved before. See the warning at the top." : "No older copy has been put back since this browser last saved."]);
    list.push([r.leaders >= 2 ? "good" : "warn", r.leaders >= 2 ? r.leaders + " Leaders can sign in, so the private care notes cannot be lost by one forgotten passphrase." : "Only one Leader. If that passphrase is forgotten, the private care notes are gone. Add a second Leader."]);
    if (r.legacy) list.push(["warn", r.legacy + " user" + (r.legacy > 1 ? "s have" : " has") + " older keys. They upgrade by signing in once. Until then a key change would ask them for a new passphrase."]);
    if (r.reset) list.push(["warn", r.reset + " user" + (r.reset > 1 ? "s need" : " needs") + " a new passphrase after a key change: use New passphrase or role."]);
    return h("div", { class: "card", id: "security" }, h("h2", { text: "Security check-up" }),
      h("ul", { class: "plain checks" }, list.map(function (x) { return h("li", { class: "chk " + x[0] }, h("span", { class: "chk-dot", "aria-hidden": "true" }), h("span", { class: "sr-only", text: x[0] === "good" ? "Good: " : x[0] === "bad" ? "Problem: " : "Attention: " }), x[1]); })),
      h("p", { class: "fine", text: "Removing a user or lowering a role gives every part they could read a fresh key, so an old copy of the file or an old passphrase cannot open anything written after that. Use Change all keys now if a passphrase may have been seen by someone else." }),
      A.can("users") ? btn("Change all keys now", "", function () {
        U.confirmBox("Change all keys now?", "Fresh keys are made for " + held.map(function (p) { return PART_WORDS[p]; }).join(", ") + ", and handed to every user who should have them. Nobody's passphrase changes." +
          (r.legacy ? " Users with older keys will need a new passphrase from you." : ""), "Change keys", true).then(function (ok) { if (ok) rotateNow(held, "Changed all keys"); });
      }) : null);
  }
  // Rotates `parts`, saves, and reports anyone who now needs a new passphrase.
  // undo (optional) puts back the user-list change that led here when the key change itself fails, so a removal or
  // role change is never saved without its new keys. K.rotate changes nothing when it fails.
  function rotateNow(parts, what, undo) {
    clearTimeout(S.saveTimer); // the pending parts stay marked and go out with the save below
    // queued on the save chain: any save in flight finishes first, and any save started now waits for the new keys
    var turn = S.saving.catch(function () { return null; }).then(function () {
      return K.rotate(S.session, S.file, S.data, parts).catch(function (x) { if (undo) undo(); x.rotateFailed = true; throw x; });
    });
    S.saving = turn;
    return turn.then(function (res) {
      M.log(S.data.core, A.me(), what + (res.lost.length ? " (" + res.lost.length + " need a new passphrase)" : ""));
      S.dirty.core = 1;
      return A.saveFile().then(function () {
        U.toast("New keys made for " + res.rotated.length + " part" + (res.rotated.length === 1 ? "" : "s") + "." + (res.lost.length ? " Set a new passphrase for: " + res.lost.join(", ") + "." : ""), !!res.lost.length);
        A.render();
      });
    }).catch(function (x) {
      if (x && x.rotateFailed) U.toast("The keys could not be changed, so nothing was changed: " + x.message, true); else saveFailed(x);
      A.render();
    });
  }
  // A manager may only manage users whose role they could grant: no silent role changes, no removing a Leader by an Administrator.
  function canManage(u) { return K.ROLES[u.role].parts.every(function (p) { return A.holds(p); }); }
  function roleOpts() { return Object.keys(K.ROLES).filter(function (r) { return K.ROLES[r].parts.every(function (p) { return A.holds(p); }); }).map(function (r) { return [r, K.ROLES[r].label]; }); }
  function userForm(u) {
    if (u && !canManage(u)) return U.toast("Only a Leader can change this user.", true);
    var p1 = U.passField("np1", u ? "New passphrase for " + u.name : "Their passphrase"), p2 = h("input", { id: "np2", type: "password", autocomplete: "new-password", maxlength: 200 });
    var extra = h("div", { class: "form" }, p1.el, h("div", { class: "field wide" }, h("label", { for: "np2", text: "Type it again" }), p2),
      h("p", { class: "fine", text: "Tell them the passphrase in person. They can change it after signing in with the Passphrase button at the top." }));
    U.openForm(u ? "New passphrase or role" : "Add a user", [
      { k: "name", label: "Name", req: true, max: 80, hidden: !!u },
      { k: "role", label: "Role", type: "select", options: roleOpts(), help: "See the role list below the table." }
    ], u ? { name: u.name, role: u.role } : { role: "checkin" }, function (v) {
      var why = K.passProblem(p1.input.value, p2.value), leaders;
      if (why) throw new Error(why);
      if (u && u.role === "leader" && v.role !== "leader") { leaders = S.file.users.filter(function (x) { return x.role === "leader"; }); if (leaders.length < 2) throw new Error("Keep at least one Leader. Add another Leader first."); }
      if (!u && S.file.users.some(function (x) { return x.name.toLowerCase() === v.name.toLowerCase(); })) throw new Error("There is already a user with that name.");
      // parts the old role could read and the new one cannot: they get fresh keys, because this person has seen the old ones
      var dropped = u ? K.ROLES[u.role].parts.filter(function (p) { return K.ROLES[v.role].parts.indexOf(p) < 0; }) : [];
      return (u ? K.rekeyUser(S.session, u, p1.input.value, v.role) : K.makeUser(S.session, v.name, v.role, p1.input.value)).then(function (nu) {
        var i = S.file.users.findIndex(function (x) { return x.id === nu.id; }), old = i < 0 ? null : S.file.users[i], wasMe = nu.id === S.session.user.id;
        if (i < 0) S.file.users.push(nu); else S.file.users[i] = nu;
        if (wasMe) S.session.user = nu;
        if (dropped.length) return rotateNow(dropped, "Changed the role of " + nu.name + " to " + K.ROLES[nu.role].label + " and changed keys", function () { S.file.users[i] = old; if (wasMe) S.session.user = old; });
        M.log(S.data.core, A.me(), (u ? "Reset the passphrase of " : "Added user ") + nu.name + " (" + K.ROLES[nu.role].label + ")");
        S.dirty.core = 1;
        return A.saveFile().then(function () { U.toast(u ? "New passphrase set for " + nu.name + "." : nu.name + " can now sign in."); A.render(); });
      });
    }, { extra: extra });
  }
  function removeUser(u) {
    if (!canManage(u)) return U.toast("Only a Leader can remove this user.", true);
    if (u.role === "leader" && S.file.users.filter(function (x) { return x.role === "leader"; }).length < 2) return U.toast("Keep at least one Leader.", true);
    var legacy = S.file.users.filter(function (x) { return x.id !== u.id && K.isLegacy(x) && !K.needsReset(x); }).map(function (x) { return x.name; });
    U.confirmBox("Remove " + u.name + "?", "They will no longer be able to sign in, and everything they could read gets a fresh key, so a copy of the file they may keep cannot open anything written from now on. The records they entered stay." +
      (legacy.length ? " These users have older keys and will need a new passphrase from you afterwards: " + legacy.join(", ") + "." : ""), "Remove and change keys", true).then(function (ok) {
      if (!ok) return;
      var before = S.file.users;
      S.file.users = before.filter(function (x) { return x.id !== u.id; });
      rotateNow(K.ROLES[u.role].parts.filter(function (p) { return A.holds(p); }), "Removed user " + u.name + " and changed keys", function () { S.file.users = before; });
    });
  }
  function changeOwnPass() {
    var cur = h("input", { id: "cur-pass", type: "password", autocomplete: "current-password", maxlength: 200 }), p1 = U.passField("own1", "New passphrase"), p2 = h("input", { id: "own2", type: "password", autocomplete: "new-password", maxlength: 200 });
    var err = U.errBox(), dlg, all = [cur, p1.input, p2];
    dlg = U.modal("Change my passphrase", h("form", { class: "form dlg-body", novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var why = K.passProblem(p1.input.value, p2.value), u = S.session.user;
      if (why) return U.fieldError(err, why, /match/.test(why) ? p2 : p1.input, all);
      U.fieldError(err, "Checking...", null, all);
      K.checkPass(S.file, u, cur.value).then(function (ok) {
        if (!ok) { var x = new Error("Your current passphrase is not right."); x.field = cur; throw x; }
        return K.rekeyUser(S.session, u, p1.input.value);
      }).then(function (nu) {
        S.file.users[S.file.users.findIndex(function (x) { return x.id === nu.id; })] = nu; S.session.user = nu;
        return A.saveFile();
      }).then(function () { dlg.close(); U.toast("Your passphrase has been changed."); }).catch(function (x) { U.fieldError(err, x.message, x.field || null, all); });
    } }, h("div", { class: "field wide" }, h("label", { for: "cur-pass", text: "Current passphrase" }), cur), p1.el,
      h("div", { class: "field wide" }, h("label", { for: "own2", text: "Type it again" }), p2), err,
      h("div", { class: "row end" }, btn("Cancel", "", function () { dlg.close(); }), h("button", { type: "submit", class: "btn primary", text: "Change passphrase" }))));
    cur.focus();
  }

  /* ---------- free trial and feedback ---------- */
  function buyLink(cls) { return h("a", { class: "btn " + (cls || "primary"), href: E.ITCH, target: "_blank", rel: "noopener noreferrer", text: "Own it forever: buy on Gumroad" }); }
  function trialBanner() {
    var n = S.data.core.people.length;
    return h("div", { class: "banner trial" }, h("strong", { text: "Free trial. " }),
      "Using " + n + " of " + E.TRIAL_PEOPLE + " people. Nothing expires and nothing is ever deleted. " + (window.StarkTrial || {}).notIncluded + " Save a backup file in Settings and the paid app opens it as it is. ", buyLink("small primary"));
  }
  function feedbackDlg() {
    U.openForm("Send feedback", [
      { k: "like", label: "What you like", type: "textarea", wide: true, max: 600 },
      { k: "missing", label: "What is missing", type: "textarea", wide: true, max: 600 },
      { k: "rating", label: "Rating (1 is poor, 5 is great)", type: "select", options: ["5", "4", "3", "2", "1"] }
    ], { rating: "5" }, function (v) {
      var a = h("a", { href: E.feedbackUrl(v, E.isTrial()), class: "sr-only" });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      U.toast("Your email app should open with the message ready. Press send there, or close it to send nothing.");
    }, { saveLabel: "Open my email app", intro: "This opens your own email app with a message to " + E.MAIL + " already written, including the app name and version. Nothing is sent until you press send there. No records or names are included." });
  }
  /* ---------- settings ---------- */
  function vSettings() {
    var D = S.data.core, st = D.settings, root = h("div");
    root.appendChild(A.sec("Settings", "Community details used on statements and printouts, sign-out, backups and the activity log."));
    var c = h("div", { class: "card" }, h("h2", { text: "Community details" }),
      h("dl", { class: "kv-list" }, [["Name", st.name], ["Address", st.address || "not set"], ["Tax ID (for example a US EIN)", st.taxId || "not set"], ["Statements signed by", (st.signer || "not set") + (st.signerTitle ? ", " + st.signerTitle : "")],
        ["Statement wording", st.wording === "religious" ? "Religious organization wording (intangible religious benefits)" : "Standard wording"], ["Sign out after", st.lockMin + " quiet minutes"], ["Not seen lately after", st.notSeenWeeks + " weeks"]]
        .map(function (r) { return h("div", { class: "kv" }, h("dt", { text: r[0] }), h("dd", { text: r[1] })); })),
      btn("Edit details", "primary", function () {
        U.openForm("Community details", [
          { k: "name", label: "Community name", req: true, max: 120 }, { k: "address", label: "Address (printed on statements)", max: 200, wide: true },
          { k: "taxId", label: "Tax ID (optional)", max: 40, help: "For example a US EIN. Printed on statements if set." }, { k: "signer", label: "Statements signed by", max: 80 },
          { k: "signerTitle", label: "Their title", max: 80, ph: "For example: Treasurer" },
          { k: "wording", label: "Statement wording", type: "select", options: [["standard", "Standard: no goods or services"], ["religious", "Religious organization: intangible religious benefits only"]],
            help: "Religious organizations in the US may state that only intangible religious benefits were provided. Check with your accountant which fits your community." },
          { k: "lockMin", label: "Sign out after (quiet minutes)", type: "select", options: ["5", "10", "15", "30"] },
          { k: "notSeenWeeks", label: "Not seen lately after (weeks)", type: "select", options: ["3", "4", "6", "8", "12"] }
        ], { name: st.name, address: st.address, taxId: st.taxId, signer: st.signer, signerTitle: st.signerTitle, wording: st.wording, lockMin: String(st.lockMin), notSeenWeeks: String(st.notSeenWeeks) }, function (v) {
          st.name = v.name.slice(0, 120); st.address = v.address; st.taxId = v.taxId; st.signer = v.signer; st.signerTitle = v.signerTitle; st.wording = v.wording === "religious" ? "religious" : "standard";
          st.lockMin = +v.lockMin || 10; st.notSeenWeeks = +v.notSeenWeeks || 6; S.file.name = st.name;
          A.log("Updated community details"); A.render();
        });
      }));
    root.appendChild(c);
    root.appendChild(h("div", { class: "card" }, h("h2", { text: "Backup" }),
      h("p", { class: "fine", text: "The backup file is the whole encrypted book, exactly as stored here. It opens only with a user's passphrase. Keep a copy off this computer, for example on a USB stick in a safe place." }),
      h("div", { class: "row wrap" }, btn("Save a backup file", "primary", function () {
        A.flush().then(function () { U.downloadText("stark-fellowship-backup-" + A.today() + ".starkfellowship", JSON.stringify(S.file), "application/json"); U.toast("Backup saved to your downloads."); }, saveFailed);
      }), btn("Restore from a backup file", "", restore))));
    root.appendChild(liveFileCard());
    root.appendChild(h("div", { class: "card" }, h("h2", { text: "Activity" }), h("p", { class: "fine", text: "Who changed what, newest first. It records actions, never the private details themselves." }),
      D.log.length ? A.table(["When", "Who", "What"], D.log.slice(0, 60).map(function (l) { return h("tr", null, h("td", { text: l.at.slice(0, 16).replace("T", " ") }), h("td", { text: l.by }), h("td", { text: l.what })); })) : A.empty("Nothing yet.")));
    return root;
  }

  /* ---------- live backup file ---------- */
  var MIRROR_WORDS = { off: "Off", ready: "On: every save is also written to your file", "needs-permission": "Paused: the browser needs your permission again", failed: "Problem: the last copy could not be written" };
  function liveFileCard() {
    var st = U.mirror.handle ? U.mirror.state : "off", ok = U.mirrorSupported(), card = h("div", { class: "card", id: "live-file" });
    card.appendChild(h("h2", { text: "Live backup file" }));
    card.appendChild(h("p", { class: "fine", text: "Choose one file, for example on a USB stick or in a folder your own backup program copies, and every save is written to it as well, encrypted exactly like a backup. If this computer fails, that file restores everything. It stays locked without a passphrase." }));
    if (!ok) { card.appendChild(h("p", { class: "fine", text: "This browser (or this embedded page) cannot keep a live file. Use Save a backup file above, or open the downloaded version in Chrome or Edge." })); return card; }
    card.appendChild(h("p", null, h("strong", { text: "Status: " }), h("span", { class: st === "ready" ? "good-text" : st === "off" ? "muted" : "warn-text", text: MIRROR_WORDS[st] + (st === "failed" && U.mirror.err ? " (" + U.mirror.err + ")" : "") })));
    card.appendChild(h("div", { class: "row wrap" },
      btn(U.mirror.handle ? "Choose a different file" : "Choose the live file", U.mirror.handle ? "" : "primary", function () {
        U.mirrorChoose(S.file.id, "stark-fellowship-live.starkfellowship").then(function (hd) {
          if (!hd) return;
          return A.flush().then(function () { return U.mirrorWrite(JSON.stringify(S.file)); }).then(function (w) { U.toast(w ? "Live backup file is on." : "The live file could not be written.", !w); A.render(); });
        }).catch(function (x) { U.toast(x.message, true); });
      }),
      st === "needs-permission" ? btn("Reconnect", "primary", function () { U.mirrorReconnect().then(function (s) { if (s === "ready") U.mirrorWrite(JSON.stringify(S.file)); A.render(); }, function () { U.toast("Permission was not given.", true); }); }) : null,
      U.mirror.handle ? btn("Stop", "danger-o", function () { U.mirrorStop(S.file.id).then(function () { U.toast("Live backup file stopped. The file itself was left as it is."); A.render(); }); }) : null));
    return card;
  }

  /* ---------- start ---------- */
  function boot() {
    $("#brand-mark").appendChild(brandMark(22));
    U.wireToasts();
    var lastMirror = "off";
    U.mirror.onstate = function (st) { if (st === "failed" && lastMirror !== "failed" && S.session) U.toast("The live backup file could not be written. Open Settings to check it.", true); lastMirror = st; };
    $("#feedback-btn").addEventListener("click", feedbackDlg);
    if (E.isTrial()) { $("#trial-badge").hidden = false; $("#trial-buy").hidden = false; $("#trial-buy").href = E.ITCH; }
    $("#signout-btn").addEventListener("click", function () { A.signOut(); });
    $("#pass-btn").addEventListener("click", changeOwnPass);
    $("#theme-btn").addEventListener("click", function () { var d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("sf-theme", d.dataset.theme); } catch (e) { /* storage may be blocked */ } });
    try { var t = localStorage.getItem("sf-theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch (e) { /* storage may be blocked */ }
    window.addEventListener("hashchange", route);
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (ev) { document.addEventListener(ev, function () { S.last = Date.now(); }, { passive: true }); });
    setInterval(function () { if (S.session && Date.now() - S.last > (S.data.core.settings.lockMin || 10) * 60000) A.signOut("Signed out after " + S.data.core.settings.lockMin + " quiet minutes."); }, 15000);
    window.addEventListener("beforeunload", function () { if (S.session && Object.keys(S.dirty).length) flush(); });
    lockScreen();
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
