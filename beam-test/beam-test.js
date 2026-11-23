/* Stark Beam receiver test: reads the fixed 40 KB test payload and checks it. Receive only; no sender code. Records and sends nothing. */
(function () {
  'use strict';
  var B = window.StarkBeam, $ = function (i) { return document.getElementById(i); }, EXP = { len: 40000, crc: 0x258DA5AE, sha: '8980e57871beca686d0a8de5dd542ac1708b0d20647104db8379c72e1bd04fc6' },
    res = window.__result = { state: 'idle' }, rc = null, cam = null, t0 = 0, tFirst = 0, tick = 0, seqs = null, minSeq = 0, maxSeq = 0, run = 0;
  function pairFmt(p) { return p.slice(0, 3) + ' ' + p.slice(3); }
  function msg(t, c) { var m = $('msg'); m.textContent = t; m.className = 'msg' + (c ? ' ' + c : ''); }
  function secs() { return tFirst ? ((Date.now() - tFirst) / 1000) : 0; }
  function counts() { var seen = rc ? rc.stats.frames : 0, uniq = seqs ? seqs.size : 0, lost = uniq ? Math.max(0, (maxSeq - minSeq + 1) - uniq) : 0; $('seen').textContent = String(seen); $('lost').textContent = String(lost); res.seen = seen; res.lost = lost; }
  function stop() { clearInterval(tick); if (cam) { try { cam.stop(); } catch (e) { /* closed */ } cam = null; } $('v').hidden = true; }
  function hex(b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function finish(bytes, info) {
    var crc = B.crc32(bytes), sec = secs(); stop(); res.seconds = sec; res.len = bytes.length; res.crc = crc; $('secs').textContent = sec.toFixed(1); counts();
    var why = bytes.length !== EXP.len ? 'length ' + bytes.length + ' instead of ' + EXP.len : crc !== EXP.crc ? 'CRC-32 ' + ('00000000' + crc.toString(16)).slice(-8).toUpperCase() + ' instead of 258DA5AE' : '';
    function end(ok, text) { res.state = ok ? 'pass' : 'fail'; res.reason = ok ? '' : text; msg(ok ? 'PASS: checksum matches' : 'FAIL: ' + text, ok ? 'pass' : 'fail'); $('again').hidden = false; }
    if (why) return end(false, why);
    if (!(window.crypto && crypto.subtle)) return end(true, '');
    crypto.subtle.digest('SHA-256', bytes).then(function (d) { var h = hex(d); res.sha = h; if (h === EXP.sha) end(true, ''); else end(false, 'SHA-256 differs'); }, function () { end(true, ''); });
  }
  function begin() {
    var mine = ++run; stop(); seqs = new Set(); minSeq = 1e9; maxSeq = -1; tFirst = 0; res = window.__result = { state: 'running', support: B.support() };
    $('again').hidden = true; $('bar').value = 0; $('pct').textContent = '0%'; $('pair').textContent = '------'; $('secs').textContent = '0.0'; $('rdr').textContent = '-'; msg('Starting the camera...');
    rc = new B.Receiver({
      maxBytes: 100000,
      onPair: function (i) { $('pair').textContent = pairFmt(i.pairing); res.pairing = i.pairing; if (!tFirst) tFirst = Date.now(); msg('Reading the codes. Keep it steady.'); },
      onProgress: function (i) { $('bar').value = i.percent; $('pct').textContent = i.percent + '%'; res.percent = i.percent; res.k = i.k; counts(); },
      onDone: function (b, i) { if (mine === run) finish(b, i); },
      onError: function (c, m) { if (mine !== run) return; if (c === 'checksum') { msg('FAIL: ' + m + ' Reading again.', 'fail'); res.state = 'running'; return; } stop(); res.state = 'fail'; res.reason = m; msg('FAIL: ' + m, 'fail'); $('again').hidden = false; }
    });
    var ff = rc.feedFrame; rc.feedFrame = function (f) { if (f.seq < minSeq) minSeq = f.seq; if (f.seq > maxSeq) maxSeq = f.seq; seqs.add(f.seq); return ff.call(this, f); };
    $('v').hidden = false;
    rc.startCamera($('v')).then(function (c) {
      if (mine !== run) { c.stop(); return; }
      cam = c; res.path = c.path; $('rdr').textContent = c.path === 'js' ? 'built-in' : 'browser'; msg('Point the camera at the moving codes.');
      tick = setInterval(function () { $('secs').textContent = secs().toFixed(1); counts(); }, 200);
    }, function () { $('v').hidden = true; $('again').hidden = false; });
  }
  $('go').onclick = begin; $('again').onclick = begin;
  if (!B.support().camera) msg('This browser has no camera access here. Open this page in Safari or Chrome over https.', 'fail');
})();
