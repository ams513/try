/* Stark Homeroom 1.3.0: Beam, receiving side and the card on the Backup page. Moves a sealed copy of the family's records between two devices with no
   network, screen to camera (shared library: js/beam/, screens: beam_ui.js). Only the ENCRYPTED VAULT travels (the passphrase-locked file the Encrypted vault card
   makes, so no child's record is ever readable on the screen); what arrives is held until the vault passphrase is typed and then goes through the same checks and
   the same restore preview as a vault file. The sending side is a separate module (beam_homeroom_send.js), full version only.
   Wire format of the beamed bytes: 0x48, 0x01, 4 byte header length, the vault's header as JSON with its ciphertext emptied, then the raw ciphertext. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const MAGIC = 0x48, WIRE = 1, MAX_HEADER = 2048, APP = 'stark-homeroom-vault', B64 = /^[A-Za-z0-9+/]+={0,2}$/;
  const KEYS = ['app', 'version', 'cipher', 'kdf', 'iterations', 'salt', 'iv', 'saved', 'data'];
  const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: true }) : null;
  function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  const rawLen = t => { try { return atob(t).length; } catch (e) { return -1; } };

  /* the beamed bytes -> { vault } (the vault file's object, exactly as the Encrypted vault card writes it) or { error } */
  function unpack(b) {
    const bad = 'What arrived is not a Stark Homeroom vault. Nothing was kept.';
    if (!b || b.length < 8 || b[0] !== MAGIC || b[1] !== WIRE) return { error: bad };
    const hl = ((b[2] << 24) | (b[3] << 16) | (b[4] << 8) | b[5]) >>> 0;
    if (hl < 2 || hl > MAX_HEADER || 6 + hl >= b.length) return { error: bad };
    let j; try { j = JSON.parse(dec.decode(b.subarray(6, 6 + hl))); } catch (e) { return { error: bad }; }
    if (!j || typeof j !== 'object' || Array.isArray(j) || j.data !== '') return { error: bad };
    if (Object.keys(j).some(k => KEYS.indexOf(k) < 0)) return { error: bad };
    if (j.app !== APP || j.version !== 2 || j.cipher !== 'AES-256-GCM' || j.kdf !== 'PBKDF2-SHA-256' || !Number.isInteger(j.iterations) || j.iterations < 300000 || j.iterations > 2000000 ||
        typeof j.salt !== 'string' || typeof j.iv !== 'string' || !B64.test(j.salt) || !B64.test(j.iv) || rawLen(j.salt) !== 16 || rawLen(j.iv) !== 12 || typeof j.saved !== 'string' || j.saved.length > 30) return { error: bad };
    const ct = b.subarray(6 + hl); if (ct.length < 17) return { error: bad };
    const out = {}; KEYS.forEach(k => { out[k] = j[k]; }); out.data = b64(ct);   /* the order the vault file is written in */
    return { vault: out };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { unpack, MAGIC, WIRE, MAX_HEADER };
  if (typeof document === 'undefined') return;

  SHR.beamUnpack = unpack;
  /* opens the camera screen; onVault(vault) runs once a vault has arrived whole and well-formed */
  SHR.beamReceive = function (onVault) {
    if (!root.StarkBeamUI) return;
    root.StarkBeamUI.receive({ app: 'Stark Homeroom', maxBytes: 6000000, text: { limits: 'This moves a copy of the whole family vault; it does not keep two devices in sync. Camera quality and light matter, and a large record set takes longer.' }, accept: function (bytes) {
      const r = unpack(bytes); if (r.error) return r;
      setTimeout(function () { onVault(r.vault); }, 0); return {};
    } });
  };
  /* X: the app's helpers (h, btn, field, ...). arrived(vault) hands a received vault to the Encrypted vault card. Sending needs a passphrase typed here:
     the copy is sealed with it on the spot and the passphrase is never stored. */
  SHR.beamCard = function (X, arrived) {
    const { h, btn, field } = X;
    const pass = h('input', { type: 'password', id: 'beam-pass', autocomplete: 'new-password', 'aria-describedby': 'beam-msg' });
    const msg = h('p', { id: 'beam-msg', class: 'small muted', role: 'status', 'aria-live': 'polite' });
    const say = (t, bad) => { msg.textContent = t; msg.className = bad ? 'notice bad' : 'small muted'; if (bad) pass.setAttribute('aria-invalid', 'true'); else pass.removeAttribute('aria-invalid'); };
    return h('div', { class: 'card', id: 'beam-card' }, h('h2', null, 'Move to another device'),
      h('p', { class: 'muted' }, 'No network. Your phone\'s camera reads the codes on this screen. Your data stays sealed; you need your passphrase on the other device.'),
      field('Passphrase for the copy you beam (at least 8 characters)', pass, 'beam-pass'),
      h('div', { class: 'row' }, btn('Beam to another device', () => { if (SHR.beamSend) SHR.beamSend(X, pass.value, say); }, '', { id: 'beam-send-btn' }),
        btn('Receive from another device', () => { SHR.beamReceive(arrived); }, 'btn-ghost', { id: 'beam-recv-btn' })),
      msg,
      h('p', { class: 'small muted' }, 'Only the encrypted vault is shown, never your children\'s records in the clear. It moves a copy: it does not keep two devices in sync, and what arrives replaces the records here only after you type its passphrase, look at the preview and press the restore button. Camera quality and light matter, and a large record set takes longer. A browser without its own code reader uses a slower built-in one.'));
  };
})(typeof window !== 'undefined' ? window : globalThis);
