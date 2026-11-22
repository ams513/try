/* Stark Warden: encrypted autosave to a file you choose. Where the browser offers the File System Access API (Chrome, Edge and
   others on desktop, outside embedded frames), you pick a file once; after every change Warden writes a fresh encrypted backup
   into it a few seconds later. Only a derived, non-extractable key is held in memory for this tab: the passphrase is not kept, the
   file handle is not stored, and closing the tab ends autosave. Nothing is sent anywhere. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var DELAY = 4000, st = { handle: null, session: null, timer: null, busy: false, again: false, last: 0, writes: 0, err: '', name: '' }, subs = [], hooked = false;

  function supported() { return typeof root.showSaveFilePicker === 'function'; }
  function emit() { var s = status(); subs.forEach(function (fn) { try { fn(s); } catch (e) { /* a closed screen */ } }); }
  function status() { return { on: !!st.handle, name: st.name, last: st.last, writes: st.writes, err: st.err, supported: supported() }; }
  function onStatus(fn) { subs = subs.filter(function (f) { return f !== fn; }); subs.push(fn); }
  function offStatus(fn) { subs = subs.filter(function (f) { return f !== fn; }); }

  /* one write at a time; a change during a write queues exactly one more */
  function writeNow() {
    var h = st.handle, s = st.session;
    if (!h || !s) { return Promise.resolve(false); }
    if (st.busy) { st.again = true; return Promise.resolve(false); }
    st.busy = true;
    return SW.vault.sealBackup(SW.store.exportAll(), s).then(function (env) {
      return h.createWritable().then(function (w) { return w.write(JSON.stringify(env)).then(function () { return w.close(); }); });
    }).then(function () { st.last = Date.now(); st.writes++; st.err = ''; return true; }, function (e) { st.err = (e && e.message) || 'The file could not be written.'; return false; })
      .then(function (ok) { st.busy = false; emit(); if (st.again && st.handle) { st.again = false; return writeNow(); } return ok; });
  }
  function schedule() { if (!st.handle) { return; } clearTimeout(st.timer); st.timer = setTimeout(writeNow, DELAY); }

  /* handle: a FileSystemFileHandle (or anything with createWritable); session: SW.vault.backupSession(pass) */
  function start(handle, session) {
    if (!handle || typeof handle.createWritable !== 'function' || !session || !session.key) { return Promise.reject(new Error('Choose a file and a passphrase first.')); }
    if (!hooked && SW.store && SW.store.onChange) { SW.store.onChange(schedule); hooked = true; }
    st.handle = handle; st.session = session; st.name = String(handle.name || 'your backup file'); st.writes = 0; st.err = '';
    return writeNow();
  }
  function stop() { clearTimeout(st.timer); st.handle = null; st.session = null; st.again = false; emit(); }
  function pick() {
    if (!supported()) { return Promise.reject(new Error('This browser cannot keep writing to a chosen file. Use Save an encrypted backup instead.')); }
    return root.showSaveFilePicker({ suggestedName: 'stark-warden-autosave.json', types: [{ description: 'Stark Warden encrypted backup', accept: { 'application/json': ['.json'] } }] });
  }

  SW.autosave = { supported: supported, pick: pick, start: start, stop: stop, status: status, writeNow: writeNow, schedule: schedule, onStatus: onStatus, offStatus: offStatus, DELAY: DELAY };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.autosave; }
})(typeof window !== 'undefined' ? window : globalThis);
