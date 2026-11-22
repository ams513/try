/* Stark Event Kit 1.5.0: Beam, receiving side and the card on the Sealed backup page. Moves a sealed copy of everything saved here between two devices with
   no network, screen to camera (shared library: js/beam/, screens: beam_ui.js). Only the SEALED backup travels (the passphrase-locked file the Sealed backup tab
   makes); what arrives is put in the "Open a sealed backup" box and still needs its passphrase, the same Unlock and check and the same Replace step as a
   file. The sending side is a separate module (beam_events_send.js), full version only.
   Wire format of the beamed bytes: 0x45, 0x01, 4 byte header length, the sealed backup's header as JSON with its ciphertext emptied, then the raw ciphertext. */
(function (g) {
  'use strict';
  var MAGIC = 0x45, WIRE = 1, MAX_HEADER = 2048, APP = 'stark-event-kit', B64 = /^[A-Za-z0-9+\/]+={0,2}$/;
  var dec = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: true }) : null;
  var KEYS = ['format', 'v', 'app', 'kdf', 'iter', 'salt', 'iv', 'cipher', 'created', 'seq', 'ct'];

  function b64(buf) { var s = '', i; for (i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192)); return g.btoa(s); }
  /* the beamed bytes -> { text } (the sealed backup file's text, exactly as the Sealed backup tab writes it) or { error } */
  function unpack(b) {
    var hl, j, ct, k, i, bad = 'What arrived is not a Stark Event Kit sealed backup. Nothing was kept.', out = {};
    if (!b || b.length < 8 || b[0] !== MAGIC || b[1] !== WIRE) return { error: bad };
    hl = ((b[2] << 24) | (b[3] << 16) | (b[4] << 8) | b[5]) >>> 0;
    if (hl < 2 || hl > MAX_HEADER || 6 + hl >= b.length) return { error: bad };
    try { j = JSON.parse(dec.decode(b.subarray(6, 6 + hl))); } catch (e) { return { error: bad }; }
    if (!j || typeof j !== 'object' || Array.isArray(j) || j.ct !== '') return { error: bad };
    for (k in j) if (Object.prototype.hasOwnProperty.call(j, k) && KEYS.indexOf(k) < 0) return { error: bad };
    if (j.format !== 'stark-sealed-backup' || j.v !== 2 || j.app !== APP || j.kdf !== 'PBKDF2-SHA256' || j.cipher !== 'AES-256-GCM' ||
        typeof j.iter !== 'number' || Math.floor(j.iter) !== j.iter || j.iter < 100000 || j.iter > 10000000 ||
        typeof j.salt !== 'string' || typeof j.iv !== 'string' || j.salt.length > 64 || j.iv.length > 64 || !B64.test(j.salt) || !B64.test(j.iv) ||
        typeof j.created !== 'string' || j.created.length > 40 || typeof j.seq !== 'number' || Math.floor(j.seq) !== j.seq || j.seq < 1 || j.seq > 1e12) return { error: bad };
    ct = b.subarray(6 + hl); if (ct.length < 16) return { error: bad };
    for (i = 0; i < KEYS.length; i++) out[KEYS[i]] = j[KEYS[i]];   // the order the sealed file is written in (the header is bound to the seal as it is)
    out.ct = b64(ct);
    return { text: JSON.stringify(out) };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { unpack: unpack, MAGIC: MAGIC, WIRE: WIRE, MAX_HEADER: MAX_HEADER };
  if (!g.SEK || !g.SEK.ui || typeof g.document === 'undefined') return;

  var S = g.SEK, UI = S.ui, h = UI.h, doc = g.document;
  S.beamUnpack = unpack;
  /* opens the camera screen; onText(text) runs once a sealed backup has arrived whole and well-formed */
  S.beamReceive = function (onText) {
    if (!g.StarkBeamUI) return;
    g.StarkBeamUI.receive({ app: 'Stark Event Kit', maxBytes: 6000000, text: { limits: 'This moves a copy of everything saved in the kit; it does not keep two devices in sync. Camera quality and light matter, and a kit with many question pictures takes much longer.' }, accept: function (bytes) {
      var r = unpack(bytes); if (r.error) return r;
      g.setTimeout(function () { onText(r.text); }, 0); return {};
    } });
  };
  /* the card on the Sealed backup tab. Sending needs a passphrase typed here: the copy is sealed with it on the spot and the passphrase is never stored. */
  S.beamCard = function () {
    var pass = h('input', { type: 'password', id: 'beam-pass', autocomplete: 'new-password', 'aria-describedby': 'beam-msg' }), msg = h('p', { id: 'beam-msg', role: 'status', 'aria-live': 'polite', class: 'fine' });
    function say(t, bad) { msg.textContent = t; msg.className = bad ? 'status-wrong' : 'fine'; if (bad) pass.setAttribute('aria-invalid', 'true'); else pass.removeAttribute('aria-invalid'); }
    function btn(label, on, cls, id) { return h('button', { type: 'button', class: 'btn ' + (cls || ''), id: id, onclick: on }, label); }
    return h('div', { class: 'card', id: 'beam-card', style: { marginTop: '16px' } }, h('h2', { text: 'Move to another device' }),
      h('p', { class: 'muted', text: 'No network. Your phone\'s camera reads the codes on this screen. Your data stays sealed; you need your passphrase on the other device.' }),
      UI.field('Passphrase for the copy you beam (at least 12 characters)', pass, 'beam-pass'),
      h('div', { class: 'row' }, btn('Beam to another device', function () { if (S.beamSend) S.beamSend(pass.value, say); }, 'primary', 'beam-send-btn'),
        btn('Receive from another device', function () {
          S.beamReceive(function (text) {
            if (S.beamIn) S.beamIn(text); else say('Received, but this page has nowhere to open it.', true);
          });
        }, '', 'beam-recv-btn')),
      msg,
      h('p', { class: 'fine', text: 'It moves a copy: it does not keep two devices in sync, and what arrives replaces the sections it holds only after you open it with its passphrase and press Replace. Camera quality and light matter, and a kit with many question pictures takes much longer. A browser without its own code reader uses a slower built-in one.' }));
  };
})(typeof window !== 'undefined' ? window : globalThis);
