/* Stark Trades 2.5.0. Passkey unlock (WebAuthn PRF) and the automatic encrypted backup file (File System Access).
   Both are feature-detected: where the browser cannot do them, the cards say so and the passphrase and manual backups work as before.
   No server is involved: the passkey only derives a key on this device, and the backup file is written to a file you chose. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, S = window.StarkStore, h = L.h, t = C.t;
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));

  /* ---------- passkey glue ---------- */
  /* a page embedded by another site (the itch.io player) is a cross-origin frame, where browsers refuse passkeys and file pickers */
  const embedded = L.embedded = () => { if (window.top === window.self) return false; try { return !window.top.location.href; } catch (e) { return true; } };
  const P = L.passkey = {};
  P.possible = () => !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext && /^https?:$/.test(location.protocol)) && !embedded();
  P.supported = async function () {
    if (!P.possible()) return false;
    try { if (PublicKeyCredential.getClientCapabilities) { const c = await PublicKeyCredential.getClientCapabilities(); if (c && c['extension:prf'] === false) return false; } } catch (e) { /* older browser: try and see */ }
    return true;
  };
  const prfOut = cred => { const r = cred && cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}; return r && r.prf && r.prf.results && r.prf.results.first ? new Uint8Array(r.prf.results.first) : null; };
  async function assertWith(prfSalt, cred) {
    const a = await navigator.credentials.get({ publicKey: { challenge: rnd(32), timeout: 60000, userVerification: 'required', allowCredentials: [{ type: 'public-key', id: C.unb64(cred) }], extensions: { prf: { eval: { first: C.unb64(prfSalt) } } } } });
    const prf = prfOut(a); if (!prf) throw new Error(t('This passkey cannot make a key (no PRF support). Your passphrase still works.')); return { cred, prf };
  }
  async function createWith(prfSalt) {
    const c = await navigator.credentials.create({ publicKey: { challenge: rnd(32), rp: { name: 'Stark Trades' }, user: { id: rnd(16), name: 'Stark Trades workspace', displayName: 'Stark Trades workspace' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }, timeout: 60000, extensions: { prf: { eval: { first: C.unb64(prfSalt) } } } } });
    const ext = c.getClientExtensionResults ? c.getClientExtensionResults() : {}; if (!ext.prf || ext.prf.enabled === false) throw new Error(t('This passkey cannot make a key (no PRF support). Your passphrase still works.'));
    const cred = C.b64(new Uint8Array(c.rawId)), now = prfOut(c); return now ? { cred, prf: now } : assertWith(prfSalt, cred);
  }
  P.prfFn = (prfSalt, cred) => cred ? assertWith(prfSalt, cred) : createWith(prfSalt);
  const why = e => e && e.name === 'NotAllowedError' ? t('The passkey prompt was closed or timed out.') : t((e && e.message) || String(e));
  L.passkeyWhy = why;

  /* the lock screen calls this; it resolves to a state or throws */
  L.passkeyUnlock = () => S.unlockPasskey(P.prfFn);

  function passkeyCard() {
    const box = h('section', { class: 'card stack', id: 'passkey-card' }, h('h2', null, t('Passkey unlock')),
      h('p', { class: 'muted' }, t('Unlock with your fingerprint, face or security key instead of typing the passphrase. Your passphrase keeps working and is still needed for backups. Changing the passphrase or restoring a backup turns passkey unlock off.')));
    const body = h('div', { class: 'stack' }); box.appendChild(body);
    (async () => {
      const ok = await P.supported(), info = await S.passkeyInfo().catch(() => null);
      if (!ok) { body.appendChild(h('p', { class: 'note', id: 'passkey-na' }, embedded() ? t('Not available inside an embedded player (such as on itch.io): the browser blocks passkeys there. Use your passphrase.') : t('Not available here: passkeys need a browser with the PRF extension and a page opened from https or localhost. Opened as a file, use the passphrase.'))); return; }
      if (info) {
        body.appendChild(h('p', { class: 'note ok', id: 'passkey-on' }, t('Passkey unlock is on for this workspace.')));
        body.appendChild(h('div', null, h('button', { type: 'button', class: 'btn', id: 'passkey-off', onclick: async () => { try { await S.disablePasskey(); L.toast(t('Passkey unlock turned off.')); } catch (x) { L.toast(why(x), true); } L.render(); } }, t('Turn off passkey unlock'))));
        return;
      }
      const pw = L.input({ type: 'password', id: 'pk-pass', autocomplete: 'current-password' }), err = L.err(); err.id = 'pk-err'; pw.setAttribute('aria-describedby', 'pk-err');
      body.appendChild(L.field(t('Your passphrase'), pw, t('Needed once, to prove it is you before the passkey is linked.')));
      body.appendChild(err);
      body.appendChild(h('div', null, h('button', { type: 'button', class: 'btn', id: 'passkey-on-btn', onclick: async e => {
        err.textContent = ''; pw.removeAttribute('aria-invalid'); const b = e.target; b.disabled = true;
        try { await S.enablePasskey(pw.value, P.prfFn); pw.value = ''; L.toast(t('Passkey unlock is on. Next time, tap Unlock with passkey.')); L.render(); }
        catch (x) { err.textContent = why(x); pw.setAttribute('aria-invalid', 'true'); pw.focus(); }
        b.disabled = false; } }, t('Turn on passkey unlock'))));
    })();
    return box;
  }

  /* ---------- automatic encrypted backup to a file you choose ---------- */
  const A = L.autoFile = { handle: null, status: 'off', last: '', timer: null, busy: null, error: '' };
  A.supported = () => typeof window.showSaveFilePicker === 'function' && !embedded();
  async function perm(ask) { if (!A.handle || !A.handle.queryPermission) return 'denied'; const o = { mode: 'readwrite' }; let p = await A.handle.queryPermission(o); if (p !== 'granted' && ask) p = await A.handle.requestPermission(o); return p; }
  A.load = async function () { A.handle = null; A.status = 'off'; try { A.handle = (await S.getAutoFile()) || null; } catch (e) { A.handle = null; } if (A.handle) A.status = (await perm(false).catch(() => 'prompt')) === 'granted' ? 'on' : 'paused'; };
  /* resolves true only when the file was written; a failure pauses the backup and is shown on the card */
  A.writeNow = function () {
    if (A.busy) return A.busy;
    A.busy = (async () => {
      if (!A.handle || !L.st || !S.unlocked()) return false;
      try {
        const text = await S.sealBackup(L.st, await S.allPhotos(L.allPhotoIds())), w = await A.handle.createWritable();
        await w.write(text); await w.close(); A.last = new Date().toISOString(); A.status = 'on'; A.error = ''; return true;
      } catch (e) { A.status = 'paused'; A.error = (e && e.message) || String(e); return false; }
    })().finally(() => { A.busy = null; refreshCard(); });
    return A.busy;
  };
  /* called after every verified save: one write at most every 20 seconds while you work, and one when you lock */
  A.schedule = function () { if (A.status !== 'on' || A.timer) return; A.timer = setTimeout(() => { A.timer = null; A.writeNow(); }, 20000); };
  A.flush = async function () { if (A.timer) { clearTimeout(A.timer); A.timer = null; if (A.status === 'on') await A.writeNow(); } };
  A.choose = async function () {
    const hnd = await window.showSaveFilePicker({ suggestedName: 'stark-trades-auto-backup.starktrades', types: [{ description: 'Stark Trades backup', accept: { 'application/json': ['.starktrades'] } }] });
    A.handle = hnd; try { await S.setAutoFile(hnd); } catch (e) { /* this browser cannot remember the file: it works until the tab closes */ }
    A.status = 'on'; return A.writeNow();
  };
  A.stop = async function () { clearTimeout(A.timer); A.timer = null; A.handle = null; A.status = 'off'; try { await S.setAutoFile(null); } catch (e) { /* ignore */ } };
  let cardEl = null;
  function refreshCard() { if (cardEl && cardEl.isConnected) cardEl.replaceWith(autoCard()); }
  function autoCard() {
    const box = h('section', { class: 'card stack', id: 'autofile-card' }, h('h2', null, t('Automatic backup file')),
      h('p', { class: 'muted' }, t('Pick a file once (a USB stick or a synced folder works) and Stark Trades keeps it up to date while you work: an encrypted backup that opens on the Restore screen with your passphrase.')));
    cardEl = box;
    if (!A.supported()) { box.appendChild(h('p', { class: 'note', id: 'autofile-na' }, embedded() ? t('Inside an embedded player (such as on itch.io) the browser blocks writing to a file. Use Save encrypted backup above, or the offline version (unzip and open index.html in Chrome or Edge).') : t('This browser cannot write to a file you choose. Use Save encrypted backup above, or open Stark Trades in a current Chrome or Edge.'))); return box; }
    const st = h('p', { class: 'note' + (A.status === 'on' ? ' ok' : ''), id: 'autofile-status', role: 'status' },
      A.status === 'on' ? (A.last ? t('On: {file}, last written {time}.', { file: A.handle.name, time: new Date(A.last).toLocaleTimeString() }) : t('On: {file}.', { file: A.handle.name }))
        : A.status === 'paused' ? t('Paused: the browser needs your permission again to write {file}.', { file: A.handle ? A.handle.name : '' }) : t('Off.'));
    box.appendChild(st);
    if (A.error) box.appendChild(h('p', { class: 'err', role: 'alert', id: 'autofile-err' }, t('The last automatic backup could not be written: {why}', { why: A.error })));
    const go = (fn, ok) => async () => { try { const r = await fn(); if (r === false) L.toast(t('The last automatic backup could not be written: {why}', { why: A.error || t('Paused: the browser needs your permission again to write {file}.', { file: A.handle ? A.handle.name : '' }) }), true); else if (ok) L.toast(ok); } catch (e) { if (!(e && e.name === 'AbortError')) L.toast(t('The last automatic backup could not be written: {why}', { why: (e && e.message) || String(e) }), true); } refreshCard(); };
    box.appendChild(h('div', { class: 'row' },
      A.status === 'paused' ? h('button', { type: 'button', class: 'btn', id: 'autofile-resume', onclick: go(async () => { if ((await perm(true)) !== 'granted') return false; A.status = 'on'; return A.writeNow(); }, t('Automatic backup resumed.')) }, t('Allow and resume')) : null,
      h('button', { type: 'button', class: 'btn', id: 'autofile-choose', onclick: go(A.choose, t('Automatic backup is on.')) }, A.status === 'off' ? t('Choose a backup file') : t('Use a different file')),
      A.status !== 'off' ? h('button', { type: 'button', class: 'btn', id: 'autofile-now', onclick: go(A.writeNow, t('Backup file written.')) }, t('Write it now')) : null,
      A.status !== 'off' ? h('button', { type: 'button', class: 'btn ghost', id: 'autofile-stop', onclick: go(A.stop, t('Automatic backup turned off.')) }, t('Turn off')) : null));
    box.appendChild(h('p', { class: 'fine' }, t('The file is encrypted with your workspace key: anyone who has it still needs the passphrase. After a passphrase change, the next write uses the new one.')));
    return box;
  }

  /* add the cards to the existing pages */
  const baseBackup = L.routes.backup, baseSettings = L.routes.settings;
  L.routes.backup = function () { const n = baseBackup.apply(null, arguments); const first = n.querySelector('section'); const card = autoCard(); if (first && first.nextSibling) n.insertBefore(card, first.nextSibling); else n.appendChild(card); return n; };
  L.routes.settings = function () { const n = baseSettings.apply(null, arguments); const sec = Array.from(n.querySelectorAll('section')).find(s => s.querySelector('#np1')); const card = passkeyCard(); if (sec && sec.nextSibling) n.insertBefore(card, sec.nextSibling); else n.appendChild(card); return n; };
})();
