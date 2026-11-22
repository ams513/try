/* Stark Homeroom service worker. It keeps this app's own files (the lists below, nothing else) in the browser's cache
   so the installed app opens with no connection. It answers only for those files at this app's own address, never
   contacts another site, and never sees a family's records: they live in the browser's storage, not in requests.
   tools/build_web_zip.py writes the two lists from the files that ship, and tests/test_homeroom.py checks them. */
'use strict';
const CACHE = /* BUILD */'stark-homeroom-trial-1.3.0-2107a542e6d50a4f'/* END */;   /* tools/build_web_zip.py renames it from the content hash of every shipped file */
const CORE = /* CORE */["css/app.css", "css/beam.css", "css/trial_stub.css", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "js/app.js", "js/beam/beam.js", "js/beam/beam_qrdec.js", "js/beam/beam_ui.js", "js/beam_homeroom.js", "js/catalog.js", "js/demo.js", "js/feedback.js", "js/homelib.js", "js/homeviews.js", "js/hublib.js", "js/i18n.js", "js/insightlib.js", "js/insightviews.js", "js/reportlib.js", "js/states.js", "js/teachlib.js", "js/trial.js", "js/trial_glue.js", "js/trial_stub.js", "js/vaultlib.js", "js/views.js", "manifest.webmanifest"]/* END */;
const LANGS = /* LANGS */["i18n/ar.js", "i18n/de.js", "i18n/es.js", "i18n/fr.js", "i18n/hi.js", "i18n/id.js", "i18n/it.js", "i18n/ja.js", "i18n/ko.js", "i18n/pl.js", "i18n/pt-BR.js", "i18n/ru.js", "i18n/tr.js", "i18n/vi.js", "i18n/zh-Hans.js"]/* END */;
const BASE = new URL('./', self.location.href);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.indexOf('stark-homeroom-') === 0 && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* the app-relative path of a request for one of our own files, or '' for anything else (left to the browser) */
function ownPath(req) {
  if (req.method !== 'GET') return '';
  const u = new URL(req.url);
  if (u.origin !== BASE.origin || u.pathname.indexOf(BASE.pathname) !== 0) return '';
  let rel; try { rel = decodeURIComponent(u.pathname.slice(BASE.pathname.length)) || 'index.html'; } catch (e) { return ''; }
  return CORE.indexOf(rel) >= 0 || LANGS.indexOf(rel) >= 0 ? rel : '';
}
self.addEventListener('fetch', e => {
  const rel = ownPath(e.request);
  if (!rel) return;
  const url = new URL(rel, BASE).href;
  e.respondWith(caches.open(CACHE).then(c => c.match(url).then(hit => hit || fetch(url).then(res => {
    if (res.ok && res.type === 'basic') c.put(url, res.clone());   /* a language pack is kept after its first use */
    return res;
  }))));
});
