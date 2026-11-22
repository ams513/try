/* Stark Builder, by Stark. Live save to a project file you choose (File System Access API, in Chrome and Edge).
   Pick a file once; every autosave then also rewrites that .json file (with its checksum), at most every few seconds.
   The file handle is remembered in this browser's IndexedDB so a reload can reconnect with one click. Feature-detected:
   other browsers keep the normal "Save project file" download. Nothing is uploaded. */
(function () {
  'use strict';
  const SB = window.SB, app = SB.app, { h, $ } = app;
  const DB = 'stark-builder-files', GAP = 3000;
  const F = app.fileSave = { handle: null, status: 'off', last: '', error: '', timer: null, busy: null, pending: false };
  /* a page embedded by another site (the itch.io player) is a cross-origin frame, where browsers refuse file pickers */
  F.embedded = () => { if (window.top === window.self) return false; try { return !window.top.location.href; } catch (e) { return true; } };
  F.supported = () => typeof window.showSaveFilePicker === 'function' && !F.embedded();

  /* a tiny IndexedDB key-value store for the one handle */
  function idb(mode, fn) {
    return new Promise((res, rej) => {
      if (typeof indexedDB === 'undefined') { rej(new Error('no IndexedDB')); return; }
      const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onerror = () => rej(r.error); r.onsuccess = () => { const db = r.result, t = db.transaction('kv', mode), q = fn(t.objectStore('kv')); t.oncomplete = () => { db.close(); res(q && q.result); }; t.onerror = t.onabort = () => { db.close(); rej(t.error); }; };
    });
  }
  const remember = hd => idb('readwrite', o => hd ? o.put(hd, 'project') : o.delete('project'));
  async function perm(ask) { if (!F.handle || !F.handle.queryPermission) return 'denied'; const o = { mode: 'readwrite' }; let p = await F.handle.queryPermission(o); if (p !== 'granted' && ask) p = await F.handle.requestPermission(o); return p; }

  F.load = async function () { try { F.handle = (await idb('readonly', o => o.get('project'))) || null; } catch (e) { F.handle = null; } F.status = F.handle ? ((await perm(false).catch(() => 'prompt')) === 'granted' ? 'on' : 'paused') : 'off'; refresh(); };
  F.write = function (text) {
    if (F.busy) { F.pending = true; return F.busy; }
    F.busy = (async () => {
      if (!F.handle) return;
      try { const w = await F.handle.createWritable(); await w.write(text || JSON.stringify(app.projectObject(), null, 1)); await w.close(); F.last = new Date().toLocaleTimeString(); F.status = 'on'; F.error = ''; }
      catch (e) { F.status = 'paused'; F.error = (e && e.message) || String(e); }
    })().finally(() => { F.busy = null; refresh(); if (F.pending) { F.pending = false; F.schedule(); } });
    return F.busy;
  };
  /* after each browser autosave: one file write at most every GAP ms, always with the newest project */
  F.schedule = function () { if (F.status !== 'on' || F.timer) return; F.timer = setTimeout(() => { F.timer = null; F.write(); }, GAP); };
  F.flush = function () { if (F.timer) { clearTimeout(F.timer); F.timer = null; if (F.status === 'on') F.write(); } };
  F.choose = async function () {
    const hd = await window.showSaveFilePicker({ suggestedName: app.slug(app.plan.name) + '.starkbuilder.json', types: [{ description: 'Stark Builder project', accept: { 'application/json': ['.json'] } }] });
    F.handle = hd; try { await remember(hd); } catch (e) { /* not remembered: works until the tab closes */ }
    F.status = 'on'; await F.write();
  };
  F.resume = async function () { if ((await perm(true)) === 'granted') { F.status = 'on'; await F.write(); } };
  F.stop = async function () { clearTimeout(F.timer); F.timer = null; F.handle = null; F.status = 'off'; F.error = ''; try { await remember(null); } catch (e) { /* ignore */ } };

  let card = null;
  function refresh() { if (card && card.isConnected) card.replaceWith(build()); }
  function build() {
    card = h('div', { class: 'card', id: 'filesave-card' }, h('h2', { text: 'Live save to a file' }),
      h('p', { class: 'muted', text: 'Choose a project file once and every change is also written to it, a few seconds after you stop. Put it in a synced folder or on a USB stick and your plan is never only in this browser.' }));
    if (!F.supported()) { card.appendChild(h('p', { class: 'small muted', id: 'filesave-na', text: F.embedded() ? 'Inside an embedded player (such as on itch.io) the browser blocks writing to a file. Use "Save project file" above, or the offline version (unzip and open index.html in Chrome or Edge) for live saving.' : 'This browser cannot write to a file you choose. Use "Save project file" above; Chrome and Edge can do live saving.' })); return card; }
    const say = F.status === 'on' ? 'On: ' + F.handle.name + (F.last ? ', last written ' + F.last + '.' : '.') : F.status === 'paused' ? 'Paused: the browser needs your permission again to write ' + (F.handle ? F.handle.name : 'the file') + '.' : 'Off.';
    card.appendChild(h('p', { class: 'small', id: 'filesave-status', role: 'status', text: say }));
    if (F.error) card.appendChild(h('p', { class: 'small', role: 'alert', id: 'filesave-err', text: 'The last write to the file failed: ' + F.error }));
    const act = fn => async () => { try { await fn(); } catch (e) { if (!(e && e.name === 'AbortError')) { F.error = (e && e.message) || String(e); } } refresh(); };
    card.appendChild(h('div', { class: 'row' },
      F.status === 'paused' ? h('button', { type: 'button', class: 'btn primary', id: 'filesave-resume', onclick: act(F.resume) }, 'Allow and resume') : null,
      h('button', { type: 'button', class: 'btn' + (F.status === 'off' ? ' primary' : ''), id: 'filesave-choose', onclick: act(F.choose) }, F.status === 'off' ? 'Choose a project file' : 'Use a different file'),
      F.status !== 'off' ? h('button', { type: 'button', class: 'btn', id: 'filesave-stop', onclick: act(F.stop) }, 'Stop live saving') : null));
    return card;
  }
  F.card = build;

  /* hook into the app: the Project tab shows the card; every autosave schedules a file write, including one the browser refused
     (storage full or blocked), because then the file is the only up-to-date copy */
  const baseProject = app.views.project;
  app.views.project = function () { baseProject(); const box = $('#project'), first = box && box.querySelector('.card'); if (box) { const c = build(); if (first && first.nextSibling) box.insertBefore(c, first.nextSibling); else box.appendChild(c); } };
  const prevSaved = app.onSaved;
  app.onSaved = function (text) { if (prevSaved) prevSaved(text); F.schedule(); };
  window.addEventListener('pagehide', () => F.flush());
  if (F.supported()) F.load();
})();
