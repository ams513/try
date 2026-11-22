/* Stark Career FREE TRIAL layer. Shipped only in dist/StarkCareer_trial_web.zip (tools/build_web_zip.py adds it).
   One limit: up to 15 tracked applications. The modules in tools/trial_manifest.json are not in the trial at all (stub cards say so). Never time-limited, never deletes or hides
   saved data, never touches the network. Backups made here restore in the paid app unchanged. */
(function () {
  "use strict";
  var CAP = 15, BUY = "https://ams513.itch.io/stark-career", NOT = (window.StarkTrial || {}).notIncluded || "";
  SC.trial = { capApps: CAP, buyUrl: BUY, onLimit: function () {
    SC.toast("Free trial: the tracker holds " + CAP + " applications. Nothing was deleted and the rest of the trial still works. Download a backup any time to carry your data into the full version, or buy it once on itch.io to remove this limit.", true);
  } };
  SC.trialUsed = function () { return Math.min(SC.S.apps.length, CAP); };

  function buyLink(cls, label) {
    var a = document.createElement("a"); a.href = BUY; a.target = "_blank"; a.rel = "noopener noreferrer"; a.className = cls; a.textContent = label; return a;
  }
  var $ = SC.$;
  var by = $(".brand-by");
  if (by) { var bd = document.createElement("span"); bd.className = "trial-badge"; bd.textContent = "Free trial"; by.parentNode.appendChild(bd); }
  var foot = $(".side-foot"); if (foot) foot.appendChild(buyLink("btn small primary", "Own it forever: buy on itch.io"));
  var f = $(".footer p"); if (f) f.appendChild(document.createTextNode(" Free trial: up to " + CAP + " tracked applications, no time limit. " + NOT + " Your data is never deleted, and a backup from here restores in the full version."));
  document.title = "Stark Career (free trial)";

  var base = SC.views.tracker;
  SC.views.tracker = function (root) {
    base(root);
    var c = document.createElement("div"); c.className = "card trial-card";
    function paint() {
      var n = SC.S.apps.length;
      c.innerHTML = "<h2>Free trial</h2><p><b>" + n + " of " + CAP + "</b> applications used" + (n >= CAP ? ". The tracker is full; your records stay safe and editable." : ".") + '</p><div class="trial-bar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(n * 100 / CAP)) + '%"></i></div><p class="fine">' + NOT + ' Download a backup to carry your data into the full version.</p>';
      c.appendChild(buyLink("btn primary", "Own it forever: buy on itch.io"));
    }
    paint();
    var head = root.querySelector(".view-head"); if (head) head.parentNode.insertBefore(c, head.nextSibling); else root.insertBefore(c, root.firstChild);
    /* the tracker redraws its own list in place, so keep the count live (add, delete, restore) */
    ["click", "change"].forEach(function (ev) { root.addEventListener(ev, function () { Promise.resolve().then(function () { if (c.isConnected) paint(); }); }); });
  };
  var bb = SC.views.backup;
  SC.views.backup = function (root) {
    bb(root);
    var c = document.createElement("div"); c.className = "card trial-card";
    c.innerHTML = "<h2>Free trial: take your data with you</h2><p>Download a backup here, then use Restore in the full version. Everything you entered, including all " + CAP + " applications, comes across.</p>";
    c.appendChild(buyLink("btn primary", "Own it forever: buy on itch.io"));
    var head = root.querySelector(".view-head"); if (head) head.parentNode.insertBefore(c, head.nextSibling);
  };
})();
