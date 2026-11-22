/* Stark Warden: boot. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, doc = root.document;
  /* Screen language. js/i18n.js (the picker, 16 languages) sets <html lang>. Warden's own hand-written Spanish screens are drawn
     when that language is Spanish; every other language draws the English screens, which js/i18n.js then translates label by label.
     A person who chose Spanish (or went back to English) in an earlier version keeps that choice: it is carried over once. */
  var LANG_KEY = 'stark-warden-lang', SEEN_KEY = 'stark-warden-lang-seen';
  function langBridge() {
    var el = doc.documentElement, last = null, ls;
    try {
      ls = root.localStorage;
      if (ls && !ls.getItem(SEEN_KEY)) {
        if (!ls.getItem(LANG_KEY) && ls.getItem('sw:settings') !== null) { ls.setItem(LANG_KEY, SW.store.settings().lang === 'es' ? 'es' : 'en'); }
        ls.setItem(SEEN_KEY, '1');
      }
      if (ls && ls.getItem(LANG_KEY) && root.StarkI18n) { el.setAttribute('lang', ls.getItem(LANG_KEY)); }   /* first paint in the saved language */
    } catch (e) { /* storage off: the picker starts from the browser language */ }
    last = el.getAttribute('lang') || 'en';
    function follow() {
      var now = el.getAttribute('lang') || 'en', want = now === 'es' ? 'es' : 'en', s;
      if (now === last) { return; }
      last = now;
      s = SW.store.settings();
      if (s.lang !== want) { s.lang = want; SW.store.setSettings(s); }
      try { if (now !== 'en' && ls && !ls.getItem(LANG_KEY)) { ls.setItem(LANG_KEY, now); } } catch (e2) { /* storage off */ }   /* a language taken from the browser stays chosen */
      ui.applySettings(); ui.buildNav(); ui.renderRoute();
    }
    if (root.StarkI18n && root.MutationObserver) { new root.MutationObserver(follow).observe(el, { attributes: true, attributeFilter: ['lang'] }); }
  }
  function boot() {
    SW.store.scan();
    langBridge();
    ui.applySettings();
    ui.buildNav();
    root.addEventListener('hashchange', ui.renderRoute);
    var skip = doc.getElementById('skip-link');
    if (skip) { skip.addEventListener('click', function () { doc.getElementById('main').focus(); }); }
    var ver = doc.getElementById('ver');
    if (ver) { ver.textContent = 'v' + SW.data.meta.version + ' · information as of ' + SW.data.meta.asOfLabel; }
    if (SW.feedbackUI) { SW.feedbackUI.mount(); }
    ui.renderRoute();
  }
  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})(window);
