/* Stark Beam 1.0, core and receiver. No library, no network. Moves a sealed copy of an app's data from one device to another
   screen to camera: the sender shows an endless sequence of QR codes, the receiver reads them. This file holds the frame format,
   the checksums, the fountain-code decoder and the camera receiver. The sender is in beam_send.js, the pure-JS QR reader in beam_qrdec.js.
   Fountain code: a random linear fountain code over GF(2), the dense end of the LT family (Luby, "LT Codes", FOCS 2002, doi 10.1109/SFCS.2002.1181950;
   Ho et al., "A Random Linear Network Coding Approach to Multicast", IEEE Trans. Inf. Theory 2006, doi 10.1109/TIT.2006.881746). Every frame is the XOR of a
   pseudo-random half of the blocks of one generation, so any n plus about two frames of a generation of n blocks recover it, in any order, whichever frames were missed.
   The payload is cut into generations of at most 256 blocks (Chou, Wu, Jain, "Practical Network Coding", Allerton 2003) so the elimination stays cheap;
   the generation of each frame comes from a shuffled round, so a camera that sees every second frame still gets every generation.
   The receiver keeps a row-reduced basis per generation (incremental Gaussian elimination), so the progress percentage is the exact rank found so far.
   Everything here is written for Stark from those published ideas; no code was copied.
   PRNG: mulberry32 (Tommy Ettinger, public domain). CRC-32: the IEEE polynomial 0xEDB88320, as in zlib and PNG.
   Frame = 16 byte header + block + CRC-32, sent as base64 text inside one QR code:
     byte 0 magic 0x42 | 1..4 session id | 5..7 payload length | 8 block size | 9..11 frame number | 12..15 payload CRC-32 | block | 4 byte CRC-32 of all before it.
   The payload is XORed with a stream from the session id before it is cut up, so no frame shows the structure of what is inside
   (the payload is already sealed by the app; this is only so a frame never looks like text). */
(function (root) {
  'use strict';
  var B = { VERSION: '1.0', HEADER: 16, TRAIL: 4, MAGIC: 0x42, MAX_BYTES: 16777215 };

  var CRC_T = (function () { var t = new Uint32Array(256), i, j, c; for (i = 0; i < 256; i++) { c = i; for (j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  B.crc32 = function (u8, from, to) { var c = 0xFFFFFFFF, i; from = from || 0; to = to == null ? u8.length : to; for (i = from; i < to; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  /* mulberry32: returns a function giving the next unsigned 32-bit number */
  B.rng = function (seed) { var a = seed | 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) >>> 0; }; };
  function seedFor(sid, seq) { return (Math.imul(sid | 0, 0x9E3779B1) ^ Math.imul((seq | 0) + 1, 0x85EBCA6B)) >>> 0; }

  /* base64 (RFC 4648, standard alphabet) */
  var AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', REV = (function () { var r = new Int8Array(128).fill(-1), i; for (i = 0; i < 64; i++) r[AL.charCodeAt(i)] = i; return r; })();
  B.b64 = function (u8) { var s = '', i, n = u8.length, a, b, c; for (i = 0; i < n; i += 3) { a = u8[i]; b = i + 1 < n ? u8[i + 1] : 0; c = i + 2 < n ? u8[i + 2] : 0; s += AL[a >> 2] + AL[((a & 3) << 4) | (b >> 4)] + (i + 1 < n ? AL[((b & 15) << 2) | (c >> 6)] : '=') + (i + 2 < n ? AL[c & 63] : '='); } return s; };
  B.unb64 = function (s) {
    var n = s.length, pad = 0, i, out, v, acc = 0, bits = 0, o = 0, ch;
    if (n % 4 || !n) return null;
    if (s.charAt(n - 1) === '=') pad++;
    if (s.charAt(n - 2) === '=') pad++;
    out = new Uint8Array(n / 4 * 3 - pad);
    for (i = 0; i < n - pad; i++) { ch = s.charCodeAt(i); v = ch < 128 ? REV[ch] : -1; if (v < 0) return null; acc = (acc << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; if (o < out.length) out[o++] = (acc >> bits) & 255; acc &= (1 << bits) - 1; } }
    return out;
  };

  /* the pairing code: six digits both screens show, derived from the session id */
  B.pairing = function (sid) { var x = (Math.imul(sid >>> 0, 0x2C1B3C6D) ^ (sid >>> 15)) >>> 0; return ('000000' + (x % 1000000)).slice(-6); };

  /* whitening: XOR with a stream seeded by the session id; the same call undoes it */
  B.whiten = function (u8, sid) { var r = B.rng((sid ^ 0xA5A5A5A5) | 0), i, w = 0; for (i = 0; i < u8.length; i++) { if ((i & 3) === 0) w = r(); u8[i] ^= (w >>> ((i & 3) * 8)) & 255; } return u8; };

  /* generations: the blocks are cut into ng groups of at most GEN blocks; group g covers blocks start..start+n-1 */
  B.GEN = 256;
  B.plan = function (k) { var ng = Math.ceil(k / B.GEN), gs = Math.ceil(k / ng); return { ng: ng, gs: gs }; };
  var PERM = { key: '', perm: null };
  function genOf(k, sid, seq, p) {
    var cycle = Math.floor(seq / p.ng), key = sid + ':' + k + ':' + cycle, r, i, j, t;
    if (PERM.key !== key) {   // each round of ng frames visits every generation once, in an order shuffled by the session id
      r = B.rng(seedFor(sid ^ 0x5BD1E995, cycle)); PERM.perm = []; for (i = 0; i < p.ng; i++) PERM.perm.push(i);
      for (i = p.ng - 1; i > 0; i--) { j = r() % (i + 1); t = PERM.perm[i]; PERM.perm[i] = PERM.perm[j]; PERM.perm[j] = t; }
      PERM.key = key;
    }
    return PERM.perm[seq % p.ng];
  }
  /* what frame number seq is made of: { gen, start, n, idx } where idx lists the blocks (counted from start) that are XORed together */
  B.combo = function (k, sid, seq) {
    var p = B.plan(k), g = genOf(k, sid, seq, p), start = g * p.gs, n = Math.min(p.gs, k - start), r = B.rng(seedFor(sid, seq)), idx = [], i, w = 0;
    for (i = 0; i < n; i++) { if ((i & 31) === 0) w = r(); if ((w >>> (i & 31)) & 1) idx.push(i); }
    if (!idx.length) idx.push(r() % n);
    return { gen: g, start: start, n: n, idx: idx };
  };

  /* frame bytes -> fields, or null when it is not a valid Beam frame */
  B.parseFrame = function (u8) {
    var n = u8.length, bs, f;
    if (n < B.HEADER + B.TRAIL + 1 || u8[0] !== B.MAGIC) return null;
    bs = u8[8]; if (bs < 1 || n !== B.HEADER + bs + B.TRAIL) return null;
    f = (u8[n - 4] * 16777216) + (u8[n - 3] << 16) + (u8[n - 2] << 8) + u8[n - 1];
    if (B.crc32(u8, 0, n - 4) !== f) return null;
    return { sid: ((u8[1] << 24) | (u8[2] << 16) | (u8[3] << 8) | u8[4]) >>> 0, len: (u8[5] << 16) | (u8[6] << 8) | u8[7], bs: bs,
      seq: (u8[9] << 16) | (u8[10] << 8) | u8[11], pcrc: ((u8[12] << 24) | (u8[13] << 16) | (u8[14] << 8) | u8[15]) >>> 0, data: u8.subarray(B.HEADER, B.HEADER + bs) };
  };

  /* ---------- the receiver ---------- */
  /* opts: onProgress(info), onPair(info) once when a session is first seen, onDone(bytes, info), onError(code, message), expectPairing (six digits: other sessions are ignored), maxBytes */
  function Receiver(opts) { this.o = opts || {}; this.reset(); }
  Receiver.prototype.reset = function () {
    this.sid = null; this.len = 0; this.bs = 0; this.k = 0; this.pcrc = 0; this.gens = []; this.rank = 0; this.seen = {};
    this.stats = { frames: 0, accepted: 0, duplicate: 0, otherSession: 0, bad: 0, dependent: 0 }; this.done = false; this.pairing = null;
  };
  function xorInto(a, b) { var i, n = a.length; for (i = 0; i < n; i++) a[i] ^= b[i]; }
  Receiver.prototype.info = function () {
    var k = this.k, pct = this.done ? 100 : k ? Math.min(99, Math.floor(100 * this.rank / k)) : 0;
    return { sid: this.sid, pairing: this.pairing, k: k, rank: this.rank, percent: pct, bytes: this.len, stats: this.stats };
  };
  /* one text read from a QR code. Returns 'accepted', 'dependent', 'duplicate', 'other-session', 'bad', 'done', 'checksum' or 'complete'. */
  Receiver.prototype.feedText = function (text) {
    var u8, f;
    if (this.done) return 'done';
    this.stats.frames++;
    u8 = typeof text === 'string' ? B.unb64(text.trim()) : text;
    f = u8 && B.parseFrame(u8);
    if (!f) { this.stats.bad++; return 'bad'; }
    return this.feedFrame(f);
  };
  Receiver.prototype.feedFrame = function (f) {
    var c, g, row, i, W, p;
    if (this.sid == null) {
      if (this.o.expectPairing && B.pairing(f.sid) !== String(this.o.expectPairing)) { this.stats.otherSession++; return 'other-session'; }
      if (f.len < 1 || f.len > (this.o.maxBytes || B.MAX_BYTES)) { this.stats.bad++; return 'bad'; }
      this.sid = f.sid; this.len = f.len; this.bs = f.bs; this.pcrc = f.pcrc; this.k = Math.ceil(f.len / f.bs); this.pairing = B.pairing(f.sid);
      p = B.plan(this.k); for (i = 0; i < p.ng; i++) this.gens.push({ n: Math.min(p.gs, this.k - i * p.gs), start: i * p.gs, piv: [], rank: 0 });
      if (this.o.onPair) this.o.onPair(this.info());
    } else if (f.sid !== this.sid) { this.stats.otherSession++; return 'other-session'; }
    else if (f.len !== this.len || f.bs !== this.bs || f.pcrc !== this.pcrc) { this.stats.bad++; return 'bad'; }
    if (this.seen[f.seq]) { this.stats.duplicate++; return 'duplicate'; }
    this.seen[f.seq] = 1;
    c = B.combo(this.k, this.sid, f.seq); g = this.gens[c.gen];
    if (g.rank === g.n) { this.stats.dependent++; return 'dependent'; }
    W = (g.n + 31) >>> 5; row = { bits: new Uint32Array(W), data: new Uint8Array(f.data) };
    for (i = 0; i < c.idx.length; i++) row.bits[c.idx[i] >>> 5] |= 1 << (c.idx[i] & 31);
    if (!this.reduce(g, row, W)) { this.stats.dependent++; return 'dependent'; }
    this.stats.accepted++; this.rank++;
    if (this.rank === this.k) return this.finish();
    if (this.o.onProgress) this.o.onProgress(this.info());
    return 'accepted';
  };
  /* incremental elimination: cancel the lowest set bit with the stored row that owns it until the row is new (kept) or empty (dependent) */
  Receiver.prototype.reduce = function (g, row, W) {
    var w = 0, x, c, pv, j;
    for (;;) {
      while (w < W && !row.bits[w]) w++;
      if (w === W) return false;
      x = row.bits[w]; c = (w << 5) + (31 - Math.clz32(x & -x)); pv = g.piv[c];
      if (!pv) { g.piv[c] = row; g.rank++; return true; }
      for (j = w; j < W; j++) row.bits[j] ^= pv.bits[j];
      xorInto(row.data, pv.data);
    }
  };
  Receiver.prototype.finish = function () {
    var out = new Uint8Array(this.k * this.bs), gi, g, c, j, row, blk, info;
    for (gi = 0; gi < this.gens.length; gi++) {
      g = this.gens[gi]; blk = [];
      for (c = g.n - 1; c >= 0; c--) {   // back-substitute: row c has its lowest bit at c, every higher block is already solved
        row = g.piv[c];
        for (j = c + 1; j < g.n; j++) if (row.bits[j >>> 5] & (1 << (j & 31))) xorInto(row.data, blk[j]);
        blk[c] = row.data;
      }
      for (c = 0; c < g.n; c++) out.set(blk[c], (g.start + c) * this.bs);
    }
    out = B.whiten(out.subarray(0, this.len), this.sid);
    if (B.crc32(out) !== this.pcrc) {
      this.reset();
      if (this.o.onError) this.o.onError('checksum', 'The pieces do not add up to the data that was sent. Nothing was kept. Try again.');
      return 'checksum';
    }
    this.done = true; info = this.info();
    if (this.o.onProgress) this.o.onProgress(info);
    if (this.o.onDone) this.o.onDone(new Uint8Array(out), info);
    return 'complete';
  };

  /* ---------- the camera ---------- */
  B.support = function () {
    return { camera: !!(root.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia), secure: root.isSecureContext !== false, barcodeDetector: typeof root.BarcodeDetector === 'function', jsReader: !!root.StarkBeamQR };
  };
  /* Starts the camera into a <video> element and feeds every QR code to the receiver. opts.forceJS uses the pure-JS reader even where
     BarcodeDetector exists. Resolves { path: 'BarcodeDetector' | 'js', stop() }. startScreen does the same from a shared tab or window (the demo). */
  function watch(self, video, getStream, opts, noCamMsg) {
    var o = opts || {}, stopped = false, stream, det = null, canvas, cx, busy = false, timer = 0, path = 'js';
    function fail(e) { if (self.o.onError) self.o.onError(e && e.name === 'NotAllowedError' ? 'denied' : 'camera', e && e.name === 'NotAllowedError' ? 'The camera was not allowed. Allow it in the browser and try again.' : 'The camera could not be started: ' + (e && e.message || e)); throw e; }
    function stop() { stopped = true; clearTimeout(timer); try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* closed */ } try { video.srcObject = null; } catch (e2) { /* closed */ } }
    function next() { if (!stopped && !self.done) timer = setTimeout(tick, o.interval || 25); else stop(); }
    function readJS() {
      var w = video.videoWidth, h = video.videoHeight, s, img, r;
      if (!w || !h || !root.StarkBeamQR) return;
      s = Math.min(1, (o.maxWidth || 960) / w); canvas = canvas || document.createElement('canvas');
      canvas.width = Math.round(w * s); canvas.height = Math.round(h * s); cx = cx || canvas.getContext('2d', { willReadFrequently: true });
      cx.drawImage(video, 0, 0, canvas.width, canvas.height); img = cx.getImageData(0, 0, canvas.width, canvas.height);
      r = root.StarkBeamQR.scan(img.data, img.width, img.height); if (r) self.feedText(r.text);
    }
    function tick() {
      if (stopped || self.done || busy) return next();
      busy = true;
      if (det) { det.detect(video).then(function (codes) { codes.forEach(function (c) { self.feedText(c.rawValue); }); busy = false; next(); }, function () { busy = false; next(); }); }
      else { try { readJS(); } catch (e) { /* a bad frame: skip it */ } busy = false; next(); }
    }
    if (!getStream) { try { fail({ name: 'NoCamera', message: noCamMsg }); } catch (e) { return Promise.reject(e); } }
    return getStream().then(function (s) {
      stream = s; video.setAttribute('playsinline', ''); video.muted = true; video.srcObject = s;
      var pick = typeof root.BarcodeDetector === 'function' && !o.forceJS ? Promise.resolve(root.BarcodeDetector.getSupportedFormats ? root.BarcodeDetector.getSupportedFormats() : ['qr_code']).then(function (f) { if (f.indexOf('qr_code') >= 0) { det = new root.BarcodeDetector({ formats: ['qr_code'] }); path = 'BarcodeDetector'; } }, function () { /* use the JS reader */ }) : Promise.resolve();
      return pick.then(function () {
        if (path === 'js' && !root.StarkBeamQR) throw new Error('this browser has no QR reader and the fallback reader is not loaded');
        return video.play();
      }).then(function () { tick(); return { path: path, stop: stop }; });
    }).catch(function (e) { stop(); return fail(e); });
  }
  Receiver.prototype.startCamera = function (video, opts) {
    var md = root.navigator && navigator.mediaDevices;
    return watch(this, video, md && md.getUserMedia ? function () { return md.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); } : null, opts, 'this page cannot use a camera (open the app from its own file or an https address)');
  };
  Receiver.prototype.startScreen = function (video, opts) {
    var md = root.navigator && navigator.mediaDevices;
    return watch(this, video, md && md.getDisplayMedia ? function () { return md.getDisplayMedia({ video: { frameRate: 15 }, audio: false }); } : null, opts, 'this browser cannot read another tab or window');
  };

  B.Receiver = Receiver;
  root.StarkBeam = B; if (typeof module !== 'undefined' && module.exports) module.exports = B;
})(typeof globalThis !== 'undefined' ? globalThis : this);
