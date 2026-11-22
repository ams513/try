/* Stark Event Kit boot: theme, skip link and the hash router. */
(function (g) {
  'use strict';
  var S = g.SEK, UI = S.ui, doc = g.document, root = doc.documentElement;
  function applyTheme(t) { root.setAttribute('data-theme', t); }
  try { var saved = g.localStorage.getItem('sek.theme'); if (saved === 'light' || saved === 'dark') applyTheme(saved); } catch (e) { /* default theme */ }
  doc.getElementById('theme-toggle').addEventListener('click', function () {
    var t = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; applyTheme(t); try { g.localStorage.setItem('sek.theme', t); } catch (e) { /* ignore */ }
  });
  /* One paper setting for every printout (A4 or US Letter), remembered, defaulting from the browser's locale. */
  S.paper.apply();
  doc.getElementById('paper-select').addEventListener('change', function (e) { S.paper.choose(e.target.value); if (/^#\/results/.test(g.location.hash)) UI.render(); });
  doc.getElementById('skip-link').addEventListener('click', function () { doc.getElementById('main').focus(); });
  /* Safe mode: stored data that cannot be read is never overwritten; say so and offer the raw data. */
  function safeBanner() {
    var bad = S.store.check().bad, keys = Object.keys(bad), old = doc.getElementById('safe-banner'), b, raw = {};
    if (old) old.remove();
    if (!keys.length) return;
    keys.forEach(function (k) { raw[k] = bad[k]; });
    b = UI.h('div', { id: 'safe-banner', class: 'card noprint', role: 'alert', style: { margin: '8px 16px', borderColor: '#f59e0b' } },
      UI.h('strong', { text: 'Safe mode: some saved data could not be read (' + keys.join(', ') + '). ' }),
      UI.h('span', { text: 'Nothing has been changed or deleted, and saving to those items is switched off so the data is not lost. ' }),
      UI.h('button', { type: 'button', class: 'btn small', id: 'safe-export', onclick: function () { UI.download('stark-event-kit-raw-data.json', JSON.stringify(raw, null, 1), 'application/json'); } }, 'Export raw data'));
    doc.body.insertBefore(b, doc.getElementById('main'));
  }
  safeBanner();

  /* Live autosave to a chosen file: the handle is kept in IndexedDB (handles cannot go in localStorage), so after a
     reload one click on "Resume autosave" re-grants access. */
  function idb(mode, fn) {
    return new Promise(function (ok) {
      var rq; try { rq = g.indexedDB.open('stark-event-kit', 1); } catch (e) { ok(null); return; }
      rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
      rq.onerror = function () { ok(null); };
      rq.onsuccess = function () { try { var tx = rq.result.transaction('kv', mode), r = fn(tx.objectStore('kv')); tx.oncomplete = function () { ok(r && r.result); rq.result.close(); }; tx.onerror = function () { ok(null); }; } catch (e) { ok(null); } };
    });
  }
  UI.autosave = S.autosave.make({ getText: function () { return JSON.stringify(S.backup.make(S.backup.collect(), Date.now())); },
    onStatus: function (st) { if (st.error && !st.waiting) UI.toast(st.error, true); if (UI.onAutosave) UI.onAutosave(st); } });
  UI.autosave.remember = function (handle) { return idb('readwrite', function (s) { return handle ? s.put(handle, 'autosave') : s.delete('autosave'); }); };
  S.store.onSaved = function () { UI.autosave.schedule(); };
  if (S.autosave.supported(g) && g.indexedDB) idb('readonly', function (s) { return s.get('autosave'); }).then(function (hd) { if (hd && hd.kind === 'file') { UI.autosave.state.handle = hd; UI.autosave.state.name = hd.name; UI.autosave.state.waiting = true; } });
  UI.wake = S.wake.make(g.navigator, doc);

  g.addEventListener('hashchange', function () { safeBanner(); UI.render(); });
  UI.render();
})(window);
