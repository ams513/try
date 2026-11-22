/* Stark Baseline Free trial layer. Shipped only in dist/StarkBaseline_trial_web.zip (the build copies it to js/trial.js and
   adds its script tag). One limit: at most 15 saved records in total. Never time-limited, never deletes or hides anything the
   person already has; backups made here restore in the paid app. Fully offline. */
(function (root) {
  "use strict";
  var LIMIT = 15, ITCH = "https://starkapps.gumroad.com/l/stark-baseline";
  var COUNTED = ["devices", "accounts", "backups", "datasets", "risks", "evidence", "staff", "contacts", "services", "drills", "vendors", "incidents"];
  function count(d) { var n = 0; COUNTED.forEach(function (k) { n += d && Array.isArray(d[k]) ? d[k].length : 0; }); return n; }
  // The made-up example organisation is not limited (it is cleared before real use). Records already over the limit stay untouched.
  function room(d) { return d && d.example ? Infinity : Math.max(0, LIMIT - count(d)); }
  root.STARK_TRIAL = { limit: LIMIT, itch: ITCH, counted: COUNTED, count: count, room: room };
  if (typeof module !== "undefined" && module.exports) module.exports = root.STARK_TRIAL;
  if (typeof document === "undefined" || !root.BaselineApp) return;

  var A = root.BaselineApp, U = root.BaselineUI, h = U.h, S = A.S;
  function buy(cls) { return h("a", { class: "btn primary " + (cls || ""), href: ITCH, target: "_blank", rel: "noopener noreferrer", text: "Own it forever: buy on Gumroad" }); }
  function limitDialog() {
    var dlg = U.modal("Free trial limit reached", h("div", { class: "dlg-body" },
      h("p", { text: "The free trial holds up to " + LIMIT + " saved records. You have reached that. Nothing was deleted, everything you saved is still here, and the checklist, search and reports keep working." }),
      h("p", { text: "To keep going, buy Stark Baseline once on Gumroad. Save a backup file here in Settings, then in the full version choose Restore backup: all your trial records, evidence and checklist ticks come with you." }),
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Not now", onclick: function () { dlg.close(); } }), buy())));
  }
  A.full = function (list) { if (list && S.d && room(S.d) < 1) { limitDialog(); return true; } return false; };
  A.room = function () { return S.d ? room(S.d) : Infinity; };

  function banner() {
    var main = document.getElementById("main"), b;
    if (!main || !S.d || document.getElementById("trial-banner")) return;
    b = h("div", { class: "banner trial", id: "trial-banner", role: "note" }, h("span", { class: "badge doing", text: "Free trial" }), " ",
      h("strong", { text: count(S.d) + " of " + LIMIT + " records used. " }), S.d.example ? "The example organisation is not counted. " : "",
      "No time limit, and nothing is ever deleted. " + (root.StarkTrial || {}).notIncluded + " Back up in Settings: the file restores in the full version. ", buy("small"));
    main.insertBefore(b, main.firstChild);
  }
  function mark() {
    var br = document.querySelector(".brand-text"), ft = document.querySelector(".footer p");
    if (br && !document.getElementById("trial-badge")) br.appendChild(h("span", { class: "badge doing", id: "trial-badge", text: "Free trial" }));
    if (ft && !document.getElementById("trial-foot")) ft.appendChild(h("span", { id: "trial-foot" }, " This is the Free trial: up to " + LIMIT + " records. ", buy("small")));
  }
  A.afterRender = banner;
  document.addEventListener("DOMContentLoaded", mark);
})(typeof window !== "undefined" ? window : globalThis);
