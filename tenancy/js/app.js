/* Stark Tenancy: boot. */
(function (root) {
  'use strict';
  var TN = root.TN, ui = TN.ui, doc = root.document;
  function boot() {
    TN.store.scan();
    ui.applySettings();
    ui.buildNav();
    root.addEventListener('hashchange', ui.renderRoute);
    var skip = doc.getElementById('skip-link'), lb = doc.getElementById('langbtn');
    var sb = doc.getElementById('searchbtn');
    if (sb) { sb.addEventListener('click', function () { TN.finder.open(); }); }
    if (skip) { skip.addEventListener('click', function () { doc.getElementById('main').focus(); }); }
    if (lb) { lb.addEventListener('click', function () { var st = TN.store.settings(); st.lang = st.lang === 'es' ? 'en' : 'es'; TN.store.setSettings(st); ui.applySettings(); ui.buildNav(); ui.renderRoute(); }); }
    ui.renderRoute();
  }
  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})(window);
