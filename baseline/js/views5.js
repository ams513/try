/* Stark Baseline: the UK Cyber Essentials view. The same checklist records, grouped under the five technical control themes
   that the UK National Cyber Security Centre names on https://www.ncsc.gov.uk/cyberessentials/overview (read 2026-11-22).
   A self-check aid: not a certification, and not affiliated with the scheme. Built with textContent only. */
(function () {
  "use strict";
  var C = BaselineContent, L = BaselineLogic, U = BaselineUI, A = BaselineApp, h = U.h, S = A.S;
  var WHAT = "A self-check aid, not a certification. ";
  var NOT_SCHEME = "Stark Baseline is not affiliated with the Cyber Essentials scheme, the UK National Cyber Security Centre (NCSC) or IASME, and none of them has reviewed or endorsed it. "
    + "Passing Baseline's checks does not mean meeting Cyber Essentials: every theme has requirements that Baseline does not check, and they are listed under each theme. "
    + "The five theme names are the NCSC's. The descriptions, and the mapping of checklist items onto the themes, are our own, reviewed against the NCSC's \"Requirements for IT Infrastructure\" " + C.UKCE.reqVersion + "; they are not the scheme's requirements or its question set. "
    + "Only an assessment through the scheme itself can award a certificate.";
  A.views.ukce = function () { return h("div", null, A.section("UK Cyber Essentials view", "A second way to look at your checklist."), window.StarkTrial.card("ukce"), h("div", { class: "banner", id: "ukce-notice" }, h("strong", { text: WHAT }), NOT_SCHEME + " " + L.NOT_ADVICE)); };
})();
