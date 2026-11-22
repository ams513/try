/* Prove it: the page that shows what Stark Career has done on the network this session (shared Stark Prove-It Panel, js/proveit/proveit.js). */
(function () {
  "use strict";
  SC.nav.push(["proveit", "Prove it", "", "y"]);
  SC.views.proveit = function (root) {
    root.innerHTML = '<div class="view-head"><p class="eyebrow">No network</p><h1>Prove it</h1><p class="lede">Stark Career says it never uses the network. Do not take our word for it: this page reads the app\'s own rules and counts what it has loaded, live, and shows you how to check it with tools that are not ours.</p></div><div id="pv-host"></div>';
    var h = StarkProveIt.mount(SC.$("#pv-host", root));
    SC.cleanups.push(h.stop);
  };
})();
