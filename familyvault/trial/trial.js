/* Stark Family Vault, by Stark: free trial layer. Shipped only in dist/StarkFamilyVault_trial_web.zip.
   One limit: up to LIMIT saved records (documents, policies, medicines, contacts, accounts, digital items, inventory, reminders).
   Never time-limited. Nothing is ever deleted or locked: existing data stays readable, editable and exportable
   (Backup files open in the paid app). No network; the buy button is a plain link. */
(function (root) {
  "use strict";
  var LIMIT = 15, KEYS = ["docs", "policies", "meds", "contacts", "accounts", "digital", "inventory", "tasks"];
  var BUY = "https://ams513.itch.io/stark-family-vault";
  function count(v) { var n = 0; if (v) KEYS.forEach(function (k) { n += Array.isArray(v[k]) ? v[k].length : 0; }); return n; }
  function isNew(v, vals) {
    if (!v || !vals || !vals.id) return false;
    var known = KEYS.concat(["people"]).some(function (k) { return Array.isArray(v[k]) && v[k].some(function (x) { return x && x.id === vals.id; }); });
    return !known;
  }
  // A new record is refused only when the limit is reached; people and edits are never limited.
  function blocks(v, vals) { return isNew(v, vals) && count(v) >= LIMIT; }
  var api = { LIMIT: LIMIT, KEYS: KEYS, BUY: BUY, count: count, isNew: isNew, blocks: blocks };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  root.__STARK_TRIAL = true;
  var U = root.VaultUI, A = root.VaultApp, h = U.h, inForm = U.openForm;
  function vault() { return root.__vault && root.__vault.state && root.__vault.state.vault; }
  function buyLink(cls) { return h("a", { class: "btn " + (cls || "primary"), href: BUY, target: "_blank", rel: "noopener", text: "Own it forever: buy on itch.io" }); }
  function limitDialog() {
    var dlg = U.modal("Free trial limit reached", h("div", { class: "dlg-body" },
      h("p", { text: "The free trial keeps up to " + LIMIT + " records. Everything you saved is still here, still yours, and still works. Nothing is deleted and the trial never expires." }),
      h("p", { text: "You can edit or delete records to make room, or save a backup file (Sharing, Save a backup file) and restore it in the full version." }),
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Not now", onclick: function () { dlg.close(); } }), buyLink())));
  }
  // New-record forms are refused up front so nobody loses what they typed.
  U.openForm = function (title, fields, values) {
    if (blocks(vault(), values) && !/person/i.test(String(title))) { limitDialog(); return null; }
    return inForm.apply(U, arguments);
  };
  A.room = function () { return LIMIT - count(vault()); };
  A.canAdd = function (list) { var v = vault(); if (v && list === v.people) return true; if (count(vault()) >= LIMIT) { limitDialog(); return false; } return true; };

  function paint() {
    var el = document.getElementById("trial-count"), v = vault();
    if (el) el.textContent = v ? count(v) + " of " + LIMIT + " records" : LIMIT + " records";
  }
  document.addEventListener("DOMContentLoaded", function () {
    paint();
    var main = document.getElementById("main");
    if (main && root.MutationObserver) new MutationObserver(paint).observe(main, { childList: true });
  });
})(typeof window !== "undefined" ? window : globalThis);
