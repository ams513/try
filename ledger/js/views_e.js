/* Stark Ledger. Views added in 1.3: the pay-day predictor (on Receivables) and passkey unlock (Settings and the lock screen).
   Text is always set with textContent; nothing here touches the network. Passkeys use the browser's own WebAuthn with the PRF extension,
   which only works on an https page with a passkey that supports PRF; everywhere else the feature hides itself and the passphrase works as before. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, R = L.routes, S = window.StarkStore;
  const guardAsync = fn => async ev => { try { await fn(ev); } catch (e) { L.toast(e && e.name === 'NotAllowedError' ? 'The passkey request was cancelled or timed out.' : (e.message || String(e)), true); } };

  /* ---------- pay-day predictor ---------- */
  L.paydayCard = function (st, today) {
    const p = C.readScope(st, () => C.payday(st, today, 8)), max = Math.max(1, ...p.weeks.map(w => Math.max(w.amount, w.onDue)));
    const card = h('div', { class: 'card stack payday', id: 'payday' }, h('h2', null, 'Pay-day predictor'),
      h('p', { class: 'muted small' }, p.houseN ? 'Learned from ' + p.houseN + ' fully paid invoice(s): your clients usually pay ' + (p.house > 0 ? p.house + ' day(s) after' : p.house < 0 ? -p.house + ' day(s) before' : 'on') + ' the due date. Each client\'s own habit counts more as their history grows.' : 'No paid invoices yet, so every open invoice is expected on its due date. The predictions sharpen as clients pay.'));
    if (!p.invoices.length) { card.appendChild(h('p', { class: 'muted' }, 'Nothing is owed to you right now.')); return card; }
    card.appendChild(h('div', { class: 'grid3' },
      h('div', { class: 'stat' }, h('div', { class: 'lab' }, 'Likely in the next 8 weeks'), h('div', { class: 'v', id: 'payday-in' }, C.fmt(p.inWindow))),
      h('div', { class: 'stat' }, h('div', { class: 'lab' }, 'Due in the same 8 weeks'), h('div', { class: 'v' }, C.fmt(p.dueWindow))),
      h('div', { class: 'stat' }, h('div', { class: 'lab' }, 'Open in total'), h('div', { class: 'v' }, C.fmt(p.open)))));
    card.appendChild(L.table(['Week of', { t: 'Predicted in', cls: 'num' }, { t: 'By due dates', cls: 'num' }, ''], p.weeks.map(w => h('tr', null, h('td', null, w.start), L.num(C.fmt(w.amount)), L.num(C.fmt(w.onDue)),
      h('td', { 'aria-hidden': 'true', class: 'barcell' }, h('span', { class: 'bar', style: 'width:' + Math.round(100 * w.amount / max) + '%' }))))));
    card.appendChild(L.lazyTable(['Invoice', 'Client', 'Due', 'Predicted', { t: 'Days after due', cls: 'num' }, 'Confidence', { t: 'Balance', cls: 'num' }], p.invoices, x => h('tr', null,
      h('td', null, h('a', { href: '#/invoice/' + x.invId }, x.number || 'Invoice')), h('td', null, x.client), h('td', null, x.due), h('td', { class: x.slipping ? 'late' : '' }, x.predicted + (x.slipping ? ' (later than usual)' : '')),
      L.num(String(x.lateBy)), h('td', null, L.chip(x.confidence, x.confidence === 'high' ? 'green' : x.confidence === 'medium' ? 'blue' : '')), L.num(C.fmt(x.balance))), 'paydays'));
    if (p.profiles.length) card.appendChild(h('details', null, h('summary', null, 'How each client pays'), L.table(['Client', { t: 'Paid invoices', cls: 'num' }, { t: 'Usual days after due', cls: 'num' }, { t: 'On time', cls: 'num' }, { t: 'Used for predictions', cls: 'num' }],
      p.profiles.map(c => h('tr', null, h('td', null, c.name), L.num(String(c.n)), L.num(String(c.own)), L.num(c.onTime + '%'), L.num(String(c.expect)))))));
    card.appendChild(h('p', { class: 'muted small' }, 'A projection from how your clients have paid before, not a promise. Worked out on this computer; nothing is sent anywhere.'));
    return card;
  };
  const wrap = name => { const orig = R[name]; R[name] = function () { const node = orig.apply(null, arguments); node.appendChild(L.paydayCard(L.st, C.today())); return node; }; };
  wrap('receivables');

  /* ---------- passkey unlock (WebAuthn PRF) ---------- */
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  /* an embedding frame can block WebAuthn with its permissions policy (a web player's iframe often does): then the feature stays hidden */
  const policyAllows = f => { const p = document.permissionsPolicy || document.featurePolicy; try { if (!p || typeof p.allowsFeature !== 'function') return true; if (typeof p.features === 'function' && p.features().indexOf(f) < 0) return true; return p.allowsFeature(f); } catch (e) { return true; } };
  L.passkeyUsable = setup => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && window.isSecureContext && /^https?:$/.test(location.protocol)) &&
    policyAllows('publickey-credentials-get') && (!setup || policyAllows('publickey-credentials-create'));
  const prfOut = cred => { const x = cred && cred.getClientExtensionResults ? cred.getClientExtensionResults() : null; const f = x && x.prf && x.prf.results && x.prf.results.first; return f ? new Uint8Array(f) : null; };
  async function prfGet(credId, prfSalt) {
    const cred = await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: credId }], userVerification: 'required', timeout: 60000, extensions: { prf: { eval: { first: prfSalt } } } } });
    const out = prfOut(cred); if (!out) throw new Error('This passkey does not support the PRF extension, so it cannot unlock the books. Use your passphrase.'); return out;
  }
  L.enrollPasskey = async function (pass) {
    if (!(await S.checkPass(pass))) throw new Error('That is not the passphrase of these books.');
    const prfSalt = rnd(32);
    const cred = await navigator.credentials.create({ publicKey: { rp: { name: 'Stark Ledger' }, user: { id: rnd(16), name: 'stark-ledger-' + (S.book() || 'main'), displayName: 'Stark Ledger: ' + S.bookLabel() }, challenge: rnd(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }, timeout: 60000, attestation: 'none',
      extensions: { prf: { eval: { first: prfSalt } } } } });
    const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}; if (!ext.prf || ext.prf.enabled === false) throw new Error('This passkey does not support the PRF extension, so it cannot seal the passphrase. Nothing was saved.');
    const credId = new Uint8Array(cred.rawId); const prf = prfOut(cred) || await prfGet(credId, prfSalt);
    await S.setPasskey({ credId, prfSalt, sealed: await C.sealPass(prf, credId, pass), added: C.today() });
  };
  L.passkeyPass = async function () { const r = await S.getPasskey(); if (!r) throw new Error('No passkey is set up for these books.'); return C.openPass(await prfGet(r.credId, r.prfSalt), r.credId, r.sealed); };

  L.passkeyCard = function () {
    const body = h('div', { class: 'stack' }); const card = h('div', { class: 'card stack', id: 'passkey-card' }, h('h2', null, 'Unlock with a passkey'), body);
    const draw = async () => {
      L.clear(body); const rec = await S.getPasskey().catch(() => null);
      body.appendChild(h('p', { class: 'muted' }, 'Use Windows Hello, Touch ID, a phone or a security key instead of typing the passphrase. Your passkey makes a secret inside the device (the WebAuthn PRF extension) that seals the passphrase here; the passphrase still works, and a restore removes the passkey.'));
      if (rec) {
        body.appendChild(h('p', { id: 'passkey-on' }, h('b', null, 'A passkey is set up'), ' (added ' + (rec.added || 'earlier') + ').'));
        body.appendChild(h('div', null, h('button', { type: 'button', class: 'btn danger', id: 'passkey-remove', onclick: guardAsync(async () => { await S.removePasskey(); L.toast('Passkey removed from these books. Remove it from your device settings too if you no longer need it.'); draw(); }) }, 'Remove passkey')));
      } else if (!L.passkeyUsable(true)) {
        body.appendChild(h('p', { class: 'note', id: 'passkey-na' }, 'Not available on this page: passkeys need a secure (https or localhost) page in a browser that supports them, and an embedding frame (such as a web player) can block them. Opened from a file, Stark Ledger uses the passphrase only.'));
      } else {
        const pw = L.input({ type: 'password', id: 'passkey-pass', autocomplete: 'current-password' }), err = h('p', { class: 'err', role: 'alert' });
        body.appendChild(h('form', { class: 'stack', onsubmit: guardAsync(async ev => { ev.preventDefault(); L.valid(pw, err); try { await L.enrollPasskey(pw.value); } catch (e) { L.invalid(pw, err, e && e.name === 'NotAllowedError' ? 'The passkey request was cancelled or timed out.' : e.message); return; } pw.value = ''; L.toast('Passkey set up. Next time, choose "Unlock with passkey".'); draw(); }) },
          L.field('Confirm your passphrase', pw), err, h('div', null, h('button', { class: 'btn primary', id: 'passkey-add' }, 'Set up a passkey'))));
      }
    };
    draw(); return card;
  };
  const origSettings = R.settings; R.settings = function () { const node = origSettings.apply(null, arguments); node.appendChild(L.passkeyCard()); return node; };
})();
