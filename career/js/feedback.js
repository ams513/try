/* Send feedback: a small form that composes a mailto: link. Nothing is sent by the app; the person's own mail app opens
   with the message filled in, and they press send. No network calls, no analytics. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;
  SC.APP_NAME = "Stark Career"; SC.APP_VERSION = "2.6.0"; SC.FEEDBACK_TO = "hello@starkforall.com"; SC.FEEDBACK_SUBJECT = "Stark Career feedback";
  var MAX = 1200;

  function clean(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, MAX); }
  function rate(r) { r = Math.round(Number(r)); return r >= 1 && r <= 5 ? r : null; }
  /* The message as plain text (also used by the Copy fallback). */
  SC.feedbackText = function (f) {
    f = f || {}; var r = rate(f.rating);
    return ["App: " + SC.APP_NAME + " " + SC.APP_VERSION + (SC.trial ? " (free trial)" : ""),
      "Rating: " + (r ? r + " out of 5" : "not given"), "", "What I like:", clean(f.like) || "-", "", "What is missing:", clean(f.missing) || "-"].join("\n");
  };
  SC.feedbackMailto = function (f) {
    return "mailto:" + SC.FEEDBACK_TO + "?subject=" + encodeURIComponent(SC.FEEDBACK_SUBJECT) + "&body=" + encodeURIComponent(SC.feedbackText(f).replace(/\n/g, "\r\n"));
  };

  function read(box) {
    var r = $('input[name="fb-rate"]:checked', box);
    return { rating: r ? r.value : null, like: $("#fb-like", box).value, missing: $("#fb-miss", box).value };
  }
  function empty(f) { return !rate(f.rating) && !clean(f.like) && !clean(f.missing); }

  SC.showFeedback = function () {
    var o = $("#overlay"), stars = "";
    if (SC.openDialog) SC.openDialog("feedback");
    for (var i = 1; i <= 5; i++) stars += '<label class="fb-star"><input type="radio" name="fb-rate" value="' + i + '"><span>' + i + "</span></label>";
    o.innerHTML = '<div class="dialog feedback" role="dialog" aria-modal="true" aria-label="Send feedback" tabindex="-1"><div class="card-head"><h2>Send feedback</h2><button type="button" class="btn small ghost" data-close aria-label="Close">Close</button></div>' +
      '<div class="dlg-body"><fieldset class="fb-rate"><legend>How is it going? (1 to 5)</legend><div class="row">' + stars + "</div></fieldset>" +
      '<label for="fb-like">What do you like?</label><textarea id="fb-like" rows="3" maxlength="' + MAX + '"></textarea>' +
      '<label for="fb-miss">What is missing?</label><textarea id="fb-miss" rows="3" maxlength="' + MAX + '"></textarea>' +
      '<p class="fine">This opens your own email app with the message filled in, addressed to ' + E(SC.FEEDBACK_TO) + ". You read it and press send yourself. Nothing is sent by this app, and nothing leaves this computer unless you send it. The message holds only what you type here, plus the app name and version" + (SC.trial ? " (free trial)" : "") + ".</p>" +
      '<div class="row"><button type="button" class="btn primary" id="fb-open">Open my email app</button><button type="button" class="btn" id="fb-copy">Copy the message instead</button></div></div></div>';
    o.hidden = false;
    var box = o.querySelector(".dialog"); box.focus();
    $("#fb-open", box).addEventListener("click", function () {
      var f = read(box); if (empty(f)) { SC.toast("Pick a rating or write a line first."); return; }
      var a = document.createElement("a"); a.href = SC.feedbackMailto(f); a.rel = "noopener"; a.className = "sr-only"; document.body.appendChild(a); a.click(); a.remove();
      SC.toast("Your email app should open. Press send there when you are ready.");
    });
    $("#fb-copy", box).addEventListener("click", function () { var f = read(box); if (empty(f)) { SC.toast("Pick a rating or write a line first."); return; } SC.copy(SC.feedbackText(f)); });
  };
  var b = $("#fb-btn"); if (b) b.addEventListener("click", SC.showFeedback);
  var l = $("#fb-link"); if (l) l.addEventListener("click", SC.showFeedback);
})();
