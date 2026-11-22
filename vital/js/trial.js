/* Stark Vital Free trial layer. Shipped only in dist/StarkVital_trial_web.zip (the build copies it to js/trial.js and adds its
   script tag). One limit: the trial covers 14 days of logging or 30 entries (days logged plus lab results), whichever comes first.
   It never deletes or hides anything, never limits reading, charts, patterns, export or backup, and a backup made here restores in
   the paid app. A local counter on the honour system: no licence server, no network. */
(function (root) {
  "use strict";
  var DAYS = 14, ENTRIES = 30, ITCH = "https://starkapps.gumroad.com/l/stark-vital";   // owner: set the product page address when the store page exists
  function days(d) { var k = {}; if (d && d.days) Object.keys(d.days).forEach(function (x) { k[x] = 1; }); if (d && d.custom && d.custom.vals) Object.keys(d.custom.vals).forEach(function (x) { k[x] = 1; }); return Object.keys(k).length; }   // a day with only your own items counts too
  function entries(d) { return days(d) + (d && Array.isArray(d.labs) ? d.labs.length : 0); }
  // The made-up example is never limited (it is not saved). Records already over the limit stay untouched.
  function over(d) { return !!d && !d.example && (days(d) >= DAYS || entries(d) >= ENTRIES); }
  function room(d) { return d && d.example ? Infinity : Math.max(0, Math.min(DAYS - days(d), ENTRIES - entries(d))); }
  root.STARK_TRIAL = { daysLimit: DAYS, entriesLimit: ENTRIES, itch: ITCH, days: days, entries: entries, over: over, room: room };
  if (typeof module !== "undefined" && module.exports) module.exports = root.STARK_TRIAL;
  if (typeof document === "undefined" || !root.VitalApp) return;

  var A = root.VitalApp, U = root.VitalUI, h = U.h, S = A.S;
  var DONE = "Your free trial is done. Your records are safe and you can export them any time.";
  function buy(cls) { return h("a", { class: "btn primary " + (cls || ""), href: ITCH, target: "_blank", rel: "noopener noreferrer", text: "Own it forever: see Stark Vital on Gumroad" }); }
  function limitDialog() {
    var dlg = U.modal("Free trial finished", h("div", { class: "dlg-body" },
      h("p", { text: DONE }),
      h("p", { text: "Everything you saved is still here: charts, patterns and export all keep working. To add new entries, get the full Stark Vital once. Save an encrypted backup in Data, then in the full app choose Restore from a backup file." }),
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Not now", onclick: function () { dlg.close(); } }), buy())));
  }
  // kind: "day" (a new day) or "lab". Called before a new entry is added; true means refused.
  A.full = function () { if (S.d && !S.example && over(S.d)) { limitDialog(); return true; } return false; };
  A.room = function () { return S.d && !S.example ? room(S.d) : Infinity; };

  function banner() {
    var main = document.getElementById("main"), b, d = S.d;
    if (!main || !d || document.getElementById("trial-banner")) return;
    var ex = S.example || d.example;   // the app flags the made-up example on S, not on the data
    b = h("div", { class: "banner trial", id: "trial-banner", role: "note" }, h("span", { class: "badge doing", text: "Free trial" }), " ",
      ex ? h("strong", { text: "The example is not counted. " }) : over(d) ? h("strong", { text: DONE + " " }) : h("strong", { text: days(d) + " of " + DAYS + " days logged. " }),
      ex ? "The " + DAYS + "-day limit applies to your own notebook. " : "No time limit and nothing is ever deleted. ", buy("small"));
    main.insertBefore(b, main.firstChild);
  }
  function mark() {
    var br = document.querySelector(".brand-text"), ft = document.querySelector(".footer p");
    if (br && !document.getElementById("trial-badge")) br.appendChild(h("span", { class: "badge doing", id: "trial-badge", text: "Free trial" }));
    if (ft && !document.getElementById("trial-foot")) ft.appendChild(h("span", { id: "trial-foot" }, " This is the Free trial: " + DAYS + " days of logging or " + ENTRIES + " entries. " + ((root.StarkTrial || {}).notIncluded || "") + " ", buy("small")));
  }
  A.afterRender = banner;
  document.addEventListener("DOMContentLoaded", mark);
})(typeof window !== "undefined" ? window : globalThis);
