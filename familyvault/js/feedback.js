/* Stark Family Vault, by Stark: "Send feedback" form. It only builds a mailto: link; the person's own mail app sends it.
   Nothing is sent by this app, nothing is stored, no network. Pure compose() is shared with the tests. */
(function (root) {
  "use strict";
  var TO = "hello@starkforall.com", SUBJECT = "Stark Vault feedback", APP = "Stark Family Vault", MAXF = 800;

  function clean(s) { return String(s == null ? "" : s).replace(/\r\n?/g, "\n").trim().slice(0, MAXF); }
  function rating(n) { n = Math.floor(+n); return n >= 1 && n <= 5 ? n : 0; }
  // Returns { href, subject, body }. `meta` is { version, trial }.
  function compose(like, missing, stars, meta) {
    meta = meta || {};
    var r = rating(stars);
    var body = "App: " + APP + (meta.trial ? " (Free trial)" : "") + "\nVersion: " + (meta.version || "unknown") + "\nRating: " + (r ? r + " of 5" : "not given") +
      "\n\nWhat I like:\n" + (clean(like) || "-") + "\n\nWhat is missing:\n" + (clean(missing) || "-") + "\n";
    return { subject: SUBJECT, body: body, href: "mailto:" + TO + "?subject=" + encodeURIComponent(SUBJECT) + "&body=" + encodeURIComponent(body) };
  }
  var api = { TO: TO, SUBJECT: SUBJECT, compose: compose, rating: rating };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }
  root.StarkFeedback = api;

  function open() {
    var U = root.VaultUI, h = U.h, dlg, like, miss, sel, a;
    like = h("textarea", { id: "fb-like", rows: 3, maxlength: MAXF, placeholder: "Optional" });
    miss = h("textarea", { id: "fb-miss", rows: 3, maxlength: MAXF, placeholder: "Optional" });
    sel = h("select", { id: "fb-rate" }, [["", "No rating"], ["5", "5 - great"], ["4", "4"], ["3", "3"], ["2", "2"], ["1", "1 - poor"]].map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
    a = h("a", { class: "fb-send", hidden: true, rel: "noopener" });
    dlg = U.modal("Send feedback", h("form", { class: "form dlg-body", novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var c = compose(like.value, miss.value, sel.value, { version: root.StarkVault && root.StarkVault.VERSION, trial: !!root.__STARK_TRIAL });
      a.setAttribute("href", c.href); document.body.appendChild(a); a.click(); document.body.removeChild(a);
      dlg.close();
    } },
      h("p", { class: "muted", text: "This opens your own email app with a message ready to send, addressed to " + TO + ". Nothing is sent from here: you read it and press send yourself. Nothing from your vault is included." }),
      h("div", { class: "field wide" }, h("label", { for: "fb-like", text: "What you like" }), like),
      h("div", { class: "field wide" }, h("label", { for: "fb-miss", text: "What is missing" }), miss),
      h("div", { class: "field" }, h("label", { for: "fb-rate", text: "Rating (1 to 5)" }), sel),
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Cancel", onclick: function () { dlg.close(); } }),
        h("button", { type: "submit", class: "btn primary", text: "Open my email app" }))));
  }
  document.addEventListener("DOMContentLoaded", function () { var b = document.getElementById("feedback-btn"); if (b) b.addEventListener("click", open); });
})(typeof window !== "undefined" ? window : globalThis);
