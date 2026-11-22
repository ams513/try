/* Stark IntraTheater by Stark. Live backup file: grown-ups pick a file once (on a USB stick or a synced folder) and the app keeps
   it up to date with a checksummed backup a few seconds after every change. Uses the File System Access API where the browser
   offers it (Chrome and Edge on a computer); elsewhere the card says so and "Back up everything" still works.
   The chosen file handle is kept in this browser's IndexedDB; nothing leaves the device. */
(function () {
  'use strict';
  const { h } = SIT;
  const DB = 'stark-intratheater-autosave', DELAY = 4000;
  const st = { handle: null, on: false, state: 'off', at: null, lastText: null, timer: 0, busy: false, again: false };
  const supported = () => typeof window.showSaveFilePicker === 'function';
  let paint = null;

  /* ---------- tiny IndexedDB key/value (the handle cannot live in localStorage) ---------- */
  function idb(mode, fn) {
    return new Promise((res, rej) => {
      let rq; try { rq = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onerror = () => rej(rq.error);
      rq.onblocked = () => rej(new Error('blocked'));
      rq.onsuccess = () => {
        const db = rq.result;
        try {                                            // a throw here (say, a handle that cannot be stored) must reject, not hang
          const tx = db.transaction('kv', mode), out = fn(tx.objectStore('kv'));
          tx.oncomplete = () => { db.close(); res(out && out.result); };
          tx.onerror = tx.onabort = () => { db.close(); rej(tx.error); };
        } catch (e) { db.close(); rej(e); }
      };
    });
  }
  const saveHandle = hd => idb('readwrite', s => hd ? s.put(hd, 'file') : s.delete('file'));
  const loadHandle = () => idb('readonly', s => s.get('file'));

  /* the same checksummed backup format as "Back up everything", so "Restore a backup" opens the live file too */
  async function snapshot() {
    const o = { app: 'stark-intratheater', version: 1, saved: new Date().toISOString(), data: {} };
    SIT.store.keys().forEach(k => { o.data[k] = SIT.store.get(k, null); });
    return { o, key: JSON.stringify(o.data) };
  }
  function set(state, at) { st.state = state; if (at) st.at = at; if (paint) paint(); }

  async function writeNow() {
    if (!st.on || !st.handle) return;
    if (st.busy) { st.again = true; return; }
    st.busy = true;
    try {
      const snap = await snapshot();
      if (snap.key === st.lastText) { set('saved'); return; }
      const sealed = await SIT.safe.seal(snap.o);
      const w = await st.handle.createWritable();
      await w.write(JSON.stringify(sealed)); await w.close();
      st.lastText = snap.key; set('saved', new Date());
    } catch (e) {
      st.on = false; set(e && e.name === 'NotAllowedError' ? 'paused' : 'error');
      SIT.toast(e && e.name === 'NotAllowedError' ? 'Live backup is paused: the browser needs your permission again (Grown-ups, Settings).' : 'Live backup could not write its file. Your data is still saved in this browser.', null, true);
    } finally {
      st.busy = false;
      if (st.again) { st.again = false; schedule(); }
    }
  }
  function schedule() { if (!st.on) return; clearTimeout(st.timer); st.timer = setTimeout(writeNow, DELAY); }

  async function choose() {
    if (!supported()) return;
    let hd;
    try {
      hd = await window.showSaveFilePicker({ suggestedName: 'stark-intratheater-live-backup.json', types: [{ description: 'Stark IntraTheater backup', accept: { 'application/json': ['.json'] } }] });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      set('blocked'); SIT.toast('This page cannot open a save dialog here (inside the itch.io page browsers block it). Use the offline download, or Back up everything.', null, true); return;
    }
    st.handle = hd; st.on = true; st.lastText = null;
    try { await saveHandle(hd); } catch (e) { SIT.toast('Live backup is on for this visit; this browser would not remember the file for next time.'); }
    await writeNow();
  }
  async function resume() {
    if (!st.handle) return;
    try {
      const p = await st.handle.requestPermission({ mode: 'readwrite' });
      if (p !== 'granted') { set('paused'); return; }
    } catch (e) { set('error'); return; }
    st.on = true; st.lastText = null; await writeNow();
  }
  async function stop() { st.on = false; st.handle = null; clearTimeout(st.timer); try { await saveHandle(null); } catch (e) { /* nothing stored */ } set('off'); }

  /* every successful store write, and every delete, schedules a live backup */
  const rawSet = SIT.store.set, rawDel = SIT.store.del;
  SIT.store.set = function (k, v) { const ok = rawSet.call(SIT.store, k, v); if (ok && st.on) schedule(); return ok; };
  SIT.store.del = function (k) { const r = rawDel.call(SIT.store, k); if (st.on) schedule(); return r; };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && st.on) { clearTimeout(st.timer); writeNow(); } });

  async function boot() {
    if (!supported()) return;
    let hd = null; try { hd = await loadHandle(); } catch (e) { return; }
    if (!hd) return;
    st.handle = hd;
    let p = 'prompt'; try { p = await hd.queryPermission({ mode: 'readwrite' }); } catch (e) { /* ask later */ }
    if (p === 'granted') { st.on = true; set('saved'); schedule(); } else set('paused');
  }
  boot();

  const WORDS = { off: 'Off.', saved: 'On.', paused: 'Paused: the browser wants your OK again.', error: 'Stopped after a write error.', blocked: 'Not available on this page.' };
  SIT.autosaveCard = function () {
    const status = h('p', { class: 'fine', role: 'status' });
    const btns = h('div', { class: 'row' });
    paint = () => {
      status.textContent = 'Live backup: ' + WORDS[st.state] + (st.on && st.at ? ' Last written ' + st.at.toLocaleTimeString() + (st.handle && st.handle.name ? ' to ' + st.handle.name : '') + '.' : '');
      while (btns.firstChild) btns.removeChild(btns.firstChild);
      if (st.on) btns.appendChild(h('button', { type: 'button', class: 'btn btn-small', onclick: stop }, 'Turn off live backup'));
      else if (st.handle) { btns.appendChild(h('button', { type: 'button', class: 'btn', onclick: resume }, '▶️ Resume live backup')); btns.appendChild(h('button', { type: 'button', class: 'btn btn-small', onclick: stop }, 'Forget the file')); }
      else btns.appendChild(h('button', { type: 'button', class: 'btn', onclick: choose }, '📁 Choose a live backup file'));
    };
    if (!supported()) return h('section', { class: 'card' }, h('h2', null, 'Live backup file'), h('p', { class: 'muted' }, 'This browser cannot keep a file up to date by itself (Chrome and Edge on a computer can). Use Back up everything below instead.'));
    paint();
    return h('section', { class: 'card' }, h('h2', null, 'Live backup file'),
      h('p', { class: 'muted' }, 'Pick a file once, for example on a USB stick or in a folder your computer already syncs, and the app rewrites it with a checksummed backup a few seconds after every change. Open it with Restore a backup on any computer. The file is not encrypted: use the Family vault for a locked copy.'),
      btns, status);
  };
  /* forget: used by "Erase everything" so the live file keeps the last good backup instead of being overwritten with nothing */
  SIT.autosave = { state: () => st.state, writeNow, forget: stop };
})();
