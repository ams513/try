/* Stark Beam 1.0, receive screen. Needs beam.js (and beam_qrdec.js for browsers without BarcodeDetector) and beam.css. No network.
   StarkBeamUI.receive({ app, accept(bytes), modal, text }) opens a dialog that reads the camera and hands the finished bytes to accept().
   accept returns { error: 'message' } to refuse them (the dialog stays open with the message and Start over), or anything else to accept (the dialog closes).
   keepAwake() is optional: called while the screen is open (the app can use it to postpone its idle lock, since nobody touches the screen while a camera reads).
   modal(title, bodyNode, { onclose }) -> { close() } is optional: pass the app's own dialog so the screen matches; otherwise a plain <dialog> is used.
   Everything is built with textContent and DOM nodes, never parsed markup. */
(function (root) {
  'use strict';
  var U = root.StarkBeamUI = root.StarkBeamUI || {};
  var TEXT = {
    title: 'Receive from another device',
    intro: 'No network. This camera reads the codes on the other device\'s screen. Hold it steady, about 20 to 30 cm away, with the whole code in view.',
    looking: 'Looking for the codes...',
    paired: 'Code on the other screen. It must match the code shown there. If it does not, press Cancel.',
    again: 'Start over', cancel: 'Cancel', retry: 'Try again',
    other: 'These codes belong to a different transfer. Press Start over to read them instead.',
    readerNative: 'Reading with your browser\'s own code reader.',
    readerJs: 'Reading with the built-in reader. It is slower than a browser\'s own, so it can take longer.',
    limits: 'This moves a copy; it does not keep two devices in sync. Camera quality and light matter, and a large notebook takes longer.',
    received: 'Received. Opening it still needs your passphrase.'
  };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function ownModal(title, body, opts) {
    var d = document.createElement('dialog'), head = el('div', 'beam-head'), x = el('button', 'beam-x', '×');
    d.className = 'beam-dialog'; head.appendChild(el('h2', null, title)); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = function () { d.close(); }; head.appendChild(x);
    d.appendChild(head); d.appendChild(body);
    d.addEventListener('close', function () { if (d.parentNode) d.parentNode.removeChild(d); if (opts && opts.onclose) opts.onclose(); });
    document.body.appendChild(d); d.showModal(); return d;
  }
  U.ownModal = ownModal; U.el = el; U.TEXT = TEXT;
  U.texts = function (o) { var t = {}, k; for (k in TEXT) t[k] = o && o.text && o.text[k] != null ? o.text[k] : TEXT[k]; return t; };

  U.receive = function (o) {
    var T = U.texts(o), B = root.StarkBeam, body = el('div', 'beam-body'), video = el('video', 'beam-video'), bar = el('progress', 'beam-bar'), status = el('p', 'beam-status', T.looking), pairBox = el('p', 'beam-pair'),
      pairCode = el('span', 'beam-code', '------'), readerEl = el('p', 'beam-fine'), errEl = el('p', 'beam-err'), row = el('div', 'beam-row'), again = el('button', 'beam-btn', T.again), cancel = el('button', 'beam-btn', T.cancel),
      rc = null, cam = null, dlg = null, closed = false, gen = 0, idle = 0;
    video.setAttribute('playsinline', ''); video.muted = true; video.setAttribute('aria-label', 'Camera'); bar.max = 100; bar.value = 0; bar.setAttribute('aria-label', 'Progress');
    errEl.setAttribute('role', 'alert'); errEl.hidden = true; pairBox.hidden = true; pairBox.appendChild(pairCode); pairBox.appendChild(document.createTextNode(' ' + T.paired));
    again.type = 'button'; cancel.type = 'button'; row.appendChild(again); row.appendChild(cancel);
    body.appendChild(el('p', 'beam-intro', T.intro)); body.appendChild(video); body.appendChild(pairBox); body.appendChild(bar); body.appendChild(status); body.appendChild(readerEl); body.appendChild(errEl); body.appendChild(row); body.appendChild(el('p', 'beam-fine', T.limits));
    function stopCam() { if (cam) { try { cam.stop(); } catch (e) { /* closed */ } cam = null; } }
    function fail(msg) { errEl.textContent = msg; errEl.hidden = false; }
    function begin() {
      var mine = ++gen; stopCam(); errEl.hidden = true; pairBox.hidden = true; bar.value = 0; status.textContent = T.looking; pairCode.textContent = '------';
      rc = new B.Receiver({
        maxBytes: o.maxBytes || 8000000,
        onPair: function (i) { pairCode.textContent = i.pairing.slice(0, 3) + ' ' + i.pairing.slice(3); pairBox.hidden = false; },
        onProgress: function (i) {
          if (o.keepAwake) o.keepAwake();
          bar.value = i.percent; status.textContent = i.percent + '%';
          if (i.percent < 100 && i.stats.otherSession >= 15 && i.stats.otherSession > i.stats.accepted) fail(T.other); else if (errEl.textContent === T.other) errEl.hidden = true;
        },
        onDone: function (bytes) {
          if (mine !== gen) return;
          stopCam(); status.textContent = T.received;
          Promise.resolve().then(function () { return o.accept(bytes); }).then(function (r) {
            if (r && r.error) { fail(r.error); again.textContent = T.retry; } else if (dlg && !closed) dlg.close();
          }, function (e) { fail(String(e && e.message || e)); again.textContent = T.retry; });
        },
        onError: function (code, msg) { if (mine === gen) { fail(msg); if (code === 'checksum') begin(); } }
      });
      if (o.keepAwake) o.keepAwake();
      rc.startCamera(video, o.camera).then(function (c) { if (mine !== gen || closed) { c.stop(); return; } cam = c; readerEl.textContent = c.path === 'js' ? T.readerJs : T.readerNative; }, function () { /* reported through onError */ });
    }
    idle = o.keepAwake ? setInterval(o.keepAwake, 5000) : 0;
    again.onclick = function () { begin(); };
    cancel.onclick = function () { if (dlg) dlg.close(); };
    dlg = (o.modal || ownModal)(T.title, body, { onclose: function () { closed = true; gen++; stopCam(); clearInterval(idle); } });
    begin();
    return { close: function () { if (dlg) dlg.close(); } };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
