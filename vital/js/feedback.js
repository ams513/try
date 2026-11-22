/* Stark Vital: "Send feedback". Builds a mailto: link from a small form. Nothing is sent by this app: the person's own mail
   app opens with the message filled in, and they press send. No network, no storage, no records are included. */
(function (root) {
  "use strict";
  var TO = "hello@starkforall.com", SUBJECT = "Stark Vital feedback", MAX = 800;

  function clean(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, MAX); }
  function appLine() {
    var v = root.StarkVital && root.StarkVital.VERSION || "";
    return "Stark Vital " + v + (root.STARK_TRIAL ? " (Free trial)" : "");
  }
  function rating(r) { r = parseInt(r, 10); return r >= 1 && r <= 5 ? r : 0; }
  // f = { like, missing, rating }. The body holds only what the person typed plus the app name and version.
  function compose(f) {
    f = f || {};
    var r = rating(f.rating);
    return "App: " + appLine().trim() + "\nRating: " + (r ? r + " of 5" : "not rated") + "\n\nWhat I like:\n" + clean(f.like) + "\n\nWhat is missing:\n" + clean(f.missing) + "\n";
  }
  function mailto(f) { return "mailto:" + TO + "?subject=" + encodeURIComponent(SUBJECT) + "&body=" + encodeURIComponent(compose(f)); }
  root.StarkFeedback = { TO: TO, SUBJECT: SUBJECT, MAX: MAX, compose: compose, mailto: mailto, rating: rating };
  if (typeof module !== "undefined" && module.exports) module.exports = root.StarkFeedback;
  if (typeof document === "undefined" || !root.VitalUI) return;

  var U = root.VitalUI, h = U.h;
  function open() {
    var like = h("textarea", { id: "fb-like", rows: 3, maxlength: MAX }), miss = h("textarea", { id: "fb-miss", rows: 3, maxlength: MAX }),
      rate = h("select", { id: "fb-rate" }, h("option", { value: "", text: "Not rated" }), [5, 4, 3, 2, 1].map(function (n) { return h("option", { value: n, text: n + (n === 1 ? " (poor)" : n === 5 ? " (great)" : "") }); })),
      dlg;
    function val() { return { like: like.value, missing: miss.value, rating: rate.value }; }
    dlg = U.modal("Send feedback", h("form", { class: "form dlg-body", onsubmit: function (e) {
      e.preventDefault();
      var a = h("a", { href: mailto(val()), class: "sr-only", text: "Email" });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      dlg.close(); U.toast("Your email app should open with the message ready. Press send there, or close it to cancel.");
    } },
      h("p", { class: "notice", text: "This opens your own email app with a message to " + TO + ". Nothing is sent from here and nothing leaves this computer until you press send in your email app. Your records are never included. Only the text below and the app name and version are." }),
      h("div", { class: "field wide" }, h("label", { for: "fb-like", text: "What you like" }), like),
      h("div", { class: "field wide" }, h("label", { for: "fb-miss", text: "What is missing" }), miss),
      h("div", { class: "field" }, h("label", { for: "fb-rate", text: "Rating, 1 to 5" }), rate),
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Cancel", onclick: function () { dlg.close(); } }),
        h("button", { type: "submit", class: "btn primary", text: "Open my email app" }))));
    like.focus();
  }
  document.addEventListener("DOMContentLoaded", function () { var b = document.getElementById("feedback-btn"); if (b) b.addEventListener("click", open); });
})(typeof window !== "undefined" ? window : globalThis);
