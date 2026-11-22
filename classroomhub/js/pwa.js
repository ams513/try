/* Stark Classroom Hub. Installable offline app: registers sw.js (which caches this app's own files only) when the page is
   served from a secure web address, and offers the browser's own "install" prompt when the browser provides one.
   Opened straight from a folder (file://), browsers do not allow offline workers, and the app still works as it always has. */
(function (G) {
  'use strict';
  const nav = G.navigator || {};
  const P = { state: 'unsupported', canInstall: false, version: '' };
  let deferred = null;
  P.secure = () => !!(G.isSecureContext && G.location && /^https?:$/.test(G.location.protocol));
  P.supported = () => !!(nav.serviceWorker && P.secure());
  const emit = () => { try { G.dispatchEvent(new G.CustomEvent('stark-pwa', { detail: P.state })); } catch (e) { /* old browser */ } };
  P.statusText = function () {
    if (P.state === 'installed') return 'Installed as an app on this device.';
    if (P.state === 'ready') return 'Ready offline: this app\'s own files are kept on this device' + (P.version ? ' (build ' + P.version + ')' : '') + ', so it opens with no connection.';
    if (P.state === 'blocked') return 'This browser did not allow offline mode here (private window or blocked site data). The app still works while this page is open.';
    if (P.state === 'pending') return 'Preparing offline mode...';
    return G.location && G.location.protocol === 'file:' ? 'Opened from a folder: it already works offline. Installing as an app needs the web version.' : 'This browser does not support installing web apps. Everything else works.';
  };
  P.install = async function () {
    if (!deferred) return false;
    deferred.prompt();
    let ok = false; try { ok = (await deferred.userChoice).outcome === 'accepted'; } catch (e) { ok = false; }
    deferred = null; P.canInstall = false; emit(); return ok;
  };
  if (G.addEventListener) {
    G.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; P.canInstall = true; emit(); });
    G.addEventListener('appinstalled', () => { P.state = 'installed'; P.canInstall = false; emit(); });
  }
  if (G.matchMedia && G.matchMedia('(display-mode: standalone)').matches) P.state = 'installed';
  if (P.supported() && P.state !== 'installed') {
    P.state = 'pending';
    /* "ready" only once a worker is active, which means every file was cached (a failed install never activates) */
    const go = () => nav.serviceWorker.register('sw.js', { scope: './' }).then(() => nav.serviceWorker.ready).then(reg => {
      P.state = 'ready'; emit();
      const ask = w => { if (w) w.postMessage('version'); };
      nav.serviceWorker.addEventListener('message', e => { if (e.data && e.data.version) { P.version = String(e.data.version).slice(0, 16); emit(); } });
      ask(reg.active || reg.waiting || reg.installing);
    }, () => { P.state = 'blocked'; emit(); });
    if (G.document && G.document.readyState === 'complete') go(); else G.addEventListener('load', go);
  }
  G.StarkPWA = P;
})(typeof window !== 'undefined' ? window : globalThis);
