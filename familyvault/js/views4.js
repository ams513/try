/* Stark Family Vault, by Stark: 1.3 views. A live mirror file and storage durability, and the guessing-time simulator.
   Built with textContent only; no network; nothing here stores a passphrase. */
(function () {
  "use strict";
  var V = StarkVault, U = VaultUI, M = StarkMirror, A = window.VaultApp, h = U.h, $ = U.$, mirror = null, statusEls = [];

  /* ---------- live mirror file ---------- */
  function chip(st) {
    var c = $("#mirror-state"); if (!c) return;
    c.textContent = A.S.vault && !A.S.readonly ? ({ on: "Mirror on", paused: "Mirror paused", error: "Mirror failed" })[st.status] || "" : "";
    c.className = "chip" + (st.status === "error" || st.status === "paused" ? " warn" : "");
  }
  function ctl() {
    if (!mirror) mirror = M.create({ win: window, store: { get: U.kvGet, put: U.kvPut }, onChange: function (st) { chip(st); statusEls.forEach(function (f) { f(st); }); } });
    return mirror;
  }
  // The envelope as stored in this browser (already sealed and read back), never a fresh seal outside the save chain.
  function current() {
    if (!A.S.session || !A.S.vault || A.S.readonly) return Promise.resolve(null);
    return U.storeGet().then(function (env) { return env && !env.corrupt && env.kind === "vault" ? env : null; }, function () { return null; });
  }
  // The app calls this after every save that was written and read back.
  A.afterSave = function (env) { if (mirror && env && env.kind === "vault") mirror.push(env); };
  // On unlock the mirror catches up with what is stored (a restored backup or a re-encryption may have been saved before it loaded).
  A.ext.onEnter = function () {
    if (A.S.readonly) { chip({ status: "off" }); return; }
    ctl().load().then(function (st) { if (st.status === "on") return current().then(function (env) { if (env) mirror.push(env); }); }).catch(function () { return null; });
  };
  A.ext.onLock = function () { chip({ status: "off" }); };

  function when(iso) { return iso ? iso.replace("T", " ").slice(0, 16) : "not yet"; }
  function mirrorCard() {
    var m = ctl(), line = h("p", { class: "fine", role: "status" }), acts = h("div", { class: "row wrap" }), card;
    function draw(st) {
      if (!card.isConnected && statusEls.indexOf(draw) !== -1) { statusEls.splice(statusEls.indexOf(draw), 1); return; }
      U.clear(acts);
      if (st.status === "unsupported") {
        line.textContent = M.framed(window) ? "This browser cannot keep a file updated while the vault runs inside another site's page. Download the app and open index.html in current Chrome or Edge on a computer to use a mirror file. Until then, save a backup file in Sharing." :
          "This browser cannot keep a file updated. It works in current Chrome and Edge on a computer. Save a backup file in Sharing instead.";
        return;
      }
      line.textContent = st.status === "off" ? "No mirror file yet." :
        st.status === "on" ? "Mirroring to " + st.name + ". Last written: " + when(st.last) + "." :
        st.status === "paused" ? "Paused: the browser needs your permission again to write " + st.name + "." :
        "The last write to " + st.name + " failed: " + st.error + " Your vault in this browser is still saved.";
      if (st.status === "off") acts.appendChild(A.btn("Choose a mirror file", "primary", function () {
        current().then(function (env) { return m.choose(env); }).then(function () { U.toast("Mirror file set. Every save now updates it."); }, function (e) { if (e && e.name !== "AbortError") U.toast("Mirror not set: " + e.message, true); });
      }));
      if (st.status === "paused" || st.status === "error") acts.appendChild(A.btn("Resume mirror", "primary", function () { current().then(function (env) { return m.resume(env); }); }));
      if (st.status !== "off") acts.appendChild(A.btn("Stop mirroring", "", function () { m.stop().then(function () { U.toast("Mirroring stopped. The file you chose is left as it is."); }); }));
    }
    card = h("div", { class: "card" }, h("h2", { text: "Live mirror file" }),
      h("p", { class: "muted", text: "Choose a file on a USB stick or in a folder your own backup or sync software looks after. After every save, the vault writes the same encrypted file there, so clearing this browser does not cost you your vault. The mirror is an ordinary backup file: restore it from the lock screen with your passphrase." }),
      line, acts,
      h("p", { class: "fine", text: "Only the encrypted file is written, never readable data. Browsers ask again for permission after a restart, so click Resume when it says paused. Anyone with the file still needs your passphrase." }));
    draw(m.state()); statusEls.push(draw);   // drawn before it is registered, so the not-yet-attached card is not dropped
    return card;
  }
  // Ask the browser not to clear this site's storage under disk pressure (it may still say no; that is the browser's choice).
  function storageCard() {
    var line = h("p", { class: "fine", role: "status" }), acts = h("div", { class: "row wrap" }), sm = navigator.storage;
    function mb(n) { return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB"; }
    function draw() {
      U.clear(acts);
      if (!sm || typeof sm.persisted !== "function") { line.textContent = "This browser does not say whether it may clear site storage. Keep backup files."; return; }
      Promise.all([sm.persisted(), sm.estimate ? sm.estimate().catch(function () { return null; }) : null]).then(function (r) {
        var est = r[1], use = est && est.quota ? " Using " + mb(est.usage || 0) + " of about " + mb(est.quota) + " this browser allows." : "";
        line.textContent = (r[0] ? "Protected: this browser has agreed not to clear the vault's storage on its own." : "Not protected yet: under low disk space this browser may clear site storage, including the vault.") + use;
        if (!r[0] && typeof sm.persist === "function") acts.appendChild(A.btn("Ask the browser to keep it", "", function () {
          sm.persist().then(function (ok) { U.toast(ok ? "The browser agreed to keep the vault's storage." : "The browser said no. Keep backup files or a mirror file.", !ok); draw(); });
        }));
      }, function () { line.textContent = "Could not read the storage status."; });
    }
    draw();
    return h("div", { class: "card" }, h("h2", { text: "Storage protection" }), line, acts,
      h("p", { class: "fine", text: "Clearing site data by hand still erases the vault. This is not a backup." }));
  }

  /* ---------- guessing-time simulator ---------- */
  var MAXLOG = 20; // a full bar is 10^20 seconds, about 3 trillion years
  function pct(s) { var x = Math.log10(Math.max(1, s)); return Math.max(2, Math.min(100, x / MAXLOG * 100)); }
  function simCard() {
    var inp = h("input", { id: "sim-pass", type: "password", autocomplete: "off", maxlength: 200, "aria-describedby": "sim-note" }), out = h("div", { class: "sim" }),
      live = h("p", { class: "sr-only", "aria-live": "polite" }), t = null, show;
    show = A.btn("Show", "small", function () { inp.type = inp.type === "password" ? "text" : "password"; show.textContent = inp.type === "password" ? "Show" : "Hide"; });
    function draw() {
      var p = inp.value, s = V.strength(p), rows = V.guessTable(s.bits, V.KDF_ITER);
      U.clear(out);
      if (!p) { out.appendChild(h("p", { class: "muted", text: "Type a passphrase in the same style as yours to see the estimate. It is never saved." })); live.textContent = ""; return; }
      out.appendChild(h("p", { class: "sim-head" }, h("strong", { text: s.label }), " about " + s.bits + " bits of guessing strength" + (s.notes.length ? ", weakened by " + s.notes.join(", ") : "") + "."));
      rows.forEach(function (r) {
        var slow = h("span", { class: "simbar-fill slow" }), fast = h("span", { class: "simbar-fill fast" });
        slow.style.width = pct(r.seconds) + "%"; fast.style.width = pct(r.fastSeconds) + "%";
        out.appendChild(h("div", { class: "simrow" }, h("div", { class: "simlabel", text: r.label }),
          h("div", { class: "simbar", "aria-hidden": "true" }, slow), h("div", { class: "simval", text: "With this vault's slow key: " + r.text }),
          h("div", { class: "simbar", "aria-hidden": "true" }, fast), h("div", { class: "simval fine", text: "If it were a single fast hash: " + r.fastText })));
      });
      clearTimeout(t); t = setTimeout(function () { live.textContent = s.label + ". One high-end graphics card would need " + rows[1].text + " on average."; }, 700);
    }
    inp.addEventListener("input", draw);
    draw();
    return h("div", { class: "card" }, h("h2", { text: "How long would a guess take?" }),
      h("p", { class: "muted", text: "Someone who copies the encrypted file can try passphrases offline as fast as their hardware allows. Your key is made with " + V.KDF_ITER.toLocaleString("en") + " rounds of PBKDF2-SHA256, so every single guess costs that much work. See what that buys you." }),
      h("div", { class: "field wide" }, h("label", { for: "sim-pass", text: "Try a passphrase (not saved)" }), h("div", { class: "row tight" }, inp, show)), out, live,
      h("p", { class: "fine", id: "sim-note", text: "Rough averages from the strength estimate and public benchmark figures for 2024-era hardware; real attackers vary, and a passphrase someone can guess from your life is weaker than any estimate. The estimate counts characters, so a passphrase made of ordinary words can be weaker than shown: five words picked at random from a large word list are about 65 bits. Bars use a log scale: each step is ten times longer." }));
  }

  A.ext.settingsCards = function (wrap) {
    wrap.appendChild(mirrorCard());
    wrap.appendChild(storageCard());
    wrap.appendChild(simCard());
  };
})();
