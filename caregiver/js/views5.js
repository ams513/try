/* Stark Caregiver, by Stark: Send feedback (a mailto: link your own mail app opens) and the free-trial badge and limit.
   Nothing is sent by this page. Built with DOM calls and textContent, never parsed markup. */
(function () {
  "use strict";
  var A = window.CareApp, V = CareCore, U = CareUI, F = CareFeedback, h = U.h, $ = U.$;
  var T = window.CareTrial || null;
  var KIND = { meds: "medicines", diary: "diary entries" };

  function open(url, blank) {
    var a = h("a", blank ? { href: url, target: "_blank", rel: "noopener noreferrer" } : { href: url });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function buyButton(cls) {
    return F.buyOk(T) ? h("span", { class: "btn " + (cls || "coral"), text: "Coming soon to the store" }) : null;
  }

  /* ---------- Send feedback ---------- */
  function feedbackForm() {
    var liked = h("textarea", { id: "fb-liked", rows: 3, maxlength: 800, "aria-describedby": "fb-note" }), missing = h("textarea", { id: "fb-missing", rows: 3, maxlength: 800 }),
      rate = h("select", { id: "fb-rate" }, [["", "No rating"], ["5", "5 - great"], ["4", "4"], ["3", "3"], ["2", "2"], ["1", "1 - poor"]].map(function (o) { return h("option", { value: o[0], text: o[1] }); })), dlg;
    var form = h("form", { class: "form dlg-body", novalidate: true, autocomplete: "off" },
      h("p", { id: "fb-note", class: "muted", text: "This opens your email app with a message to Stark, ready to read and send. Nothing is sent from here, and nothing from your care record is included. You press send yourself, or close the email and nothing happens." }),
      h("div", { class: "field wide" }, h("label", { for: "fb-liked", text: "What you like" }), liked),
      h("div", { class: "field wide" }, h("label", { for: "fb-missing", text: "What is missing" }), missing),
      h("div", { class: "field" }, h("label", { for: "fb-rate", text: "Rating, 1 to 5" }), rate),
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Cancel", onclick: function () { dlg.close(); } }),
        h("button", { type: "submit", class: "btn primary", text: "Open my email app" })));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      open(F.compose({ version: V.VERSION, trial: !!T, liked: liked.value, missing: missing.value, rating: rate.value }), false);
      dlg.close();
      U.toast("Your email app should open with the message ready. Press send there, or just close it.");
    });
    dlg = U.modal("Send feedback", form);
    liked.focus();
    return dlg;
  }

  /* ---------- Free trial ---------- */
  function limitDialog(kind) {
    var body = h("div", { class: "dlg-body" },
      h("p", { text: "The free trial holds up to " + T.limit + " medicines and diary entries together. You have reached it, so no more can be added here." }),
      h("p", { class: "muted", text: "Nothing is deleted and nothing expires. You can still edit and log doses and check-ins, and read, print and back up everything. To add more " + (KIND[kind] || "records") + ", buy the full version. Save a backup file from Sharing first: it opens in the full version with the same passphrase, so everything carries over." }),
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", text: "Close", onclick: function () { dlg.close(); } }), buyButton("coral")));
    var dlg = U.modal("Free trial limit reached", body);
  }
  // True (and explains why) when a new record of this kind must not be added. Always false in the paid build, in example data and when editing.
  A.gate = function (kind) {
    var S = A.S;
    if (!T || !S.vault || S.demo || F.canAdd(T, S.vault, kind)) return false;
    limitDialog(kind); return true;
  };

  function trialUi() {
    var badge = h("span", { class: "badge trial-badge", id: "trial-badge", title: "This is the free trial build", text: "Free trial" }), foot = $("#trial-foot"), top = $(".topbar");
    top.insertBefore(badge, $("#topbar-tools"));
    if (foot) { foot.appendChild(h("span", { text: "Free trial: up to " + T.limit + " medicines and diary entries, no time limit, nothing is ever deleted. " + ((window.StarkTrial || {}).notIncluded || "") + " " })); var b = buyButton("coral small"); if (b) foot.appendChild(b); }
    setInterval(function () {
      var S = A.S; badge.textContent = S.vault && !S.demo && !S.readonly ? "Free trial " + Math.min(F.used(T, S.vault), T.limit) + "/" + T.limit : "Free trial";
    }, 1000);
    // The Sharing page: say plainly that trial data carries over.
    A.ext.shareExtra = function () {
      return h("div", { class: "card" }, h("h2", { text: "Free trial: take your data with you" }),
        h("p", { class: "muted", text: "Backup files and share files from the trial are the same as the full version's. After you buy, choose Restore from a backup file on the lock screen and enter the same passphrase. Nothing is lost." }), buyButton("coral"));
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var fb = $("#fb-btn"); if (fb) fb.addEventListener("click", feedbackForm);
    if (T) trialUi();
  });
})();
