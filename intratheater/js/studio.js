/* Stark IntraTheater by Stark. Movie Studio: record, import, edit and export family movies, fully offline.
   Clips, photos and sounds are kept in this browser's IndexedDB. Nothing is uploaded: the page blocks network access.
   Timeline maths lives in studiolib.js (tested under node); this file is the screen, the player and the exporter. */
(function () {
  'use strict';
  const { h, clear, store, toast } = SIT;
  const L = SIT.studioLib;
  const W = 1280, H = 720, BIG_FILE = 300 * 1048576, MAX_REC = 600;
  const FILTER_OK = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
  const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
  const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const HAND = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", cursive';
  const ROUND = '"Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", sans-serif';
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : (d === undefined ? 1 : d));
  const reduce = () => SIT.reduceMotion();
  const newId = () => 'c' + SIT.uid();
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fmt = (s, tenths) => L.fmtT(s, tenths);
  const safeName = s => (String(s || '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'movie');

  /* ---------- IndexedDB: media blobs and projects ---------- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      let r;
      try { r = window.indexedDB && indexedDB.open('starkIT-studio', 1); } catch (e) { r = null; }
      if (!r) { rej(Object.assign(new Error('noidb'), { name: 'noidb' })); return; }
      r.onupgradeneeded = () => { const d = r.result; ['media', 'projects'].forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(Object.assign(new Error('noidb'), { name: 'noidb' }));
    });
    return dbp;
  }
  function idb(name, mode, op) {
    return db().then(d => new Promise((res, rej) => {
      const tx = d.transaction(name, mode); const req = op(tx.objectStore(name));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = tx.onabort = () => rej(tx.error || new Error('idb'));
    }));
  }
  const dbGet = (s, k) => idb(s, 'readonly', st => st.get(k));
  const dbPut = (s, v) => idb(s, 'readwrite', st => st.put(v));
  const dbDel = (s, k) => idb(s, 'readwrite', st => st.delete(k));
  const dbAll = s => idb(s, 'readonly', st => st.getAll());
  async function estimate() {
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } } catch (e) { /* ignore */ }
    return { used: 0, quota: 0 };
  }
  async function room(bytes) {
    const e = await estimate();
    if (e.quota && e.quota - e.used < bytes * 1.05) throw Object.assign(new Error('noroom'), { name: 'noroom' });
  }

  /* ---------- media cache ---------- */
  const M = new Map();                     // id -> { rec, url, img, imgP }
  function cacheRec(rec) { let m = M.get(rec.id); if (!m) { m = { rec, url: URL.createObjectURL(rec.blob) }; M.set(rec.id, m); } return m; }
  function ensureMedia(id) { if (M.has(id)) return Promise.resolve(M.get(id)); return dbGet('media', id).then(r => (r ? cacheRec(r) : null)).catch(() => null); }
  function elImage(url) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(Object.assign(new Error('unplayable'), { name: 'unplayable' })); im.src = url; }); }
  function decodeImage(blob, url) { return window.createImageBitmap ? createImageBitmap(blob).catch(() => elImage(url)) : elImage(url); }
  const dims = img => [img.naturalWidth || img.width, img.naturalHeight || img.height];
  function imgOf(m) {
    if (!m || m.rec.kind !== 'photo') return null;
    if (m.img) return m.img;
    if (!m.imgP) m.imgP = decodeImage(m.rec.blob, m.url).then(img => { m.img = img; requestDraw(); return img; }).catch(() => { m.bad = true; });
    return null;
  }
  function once(el, ev, ms) {
    return new Promise(res => {
      let done = false;
      const fin = ok => { if (done) return; done = true; clearTimeout(tm); el.removeEventListener(ev, on); el.removeEventListener('error', er); res(ok); };
      const on = () => fin(true), er = () => fin(false), tm = setTimeout(() => fin(false), ms);
      el.addEventListener(ev, on); el.addEventListener('error', er);
    });
  }
  const bad = () => Object.assign(new Error('unplayable'), { name: 'unplayable' });
  async function probeTimed(el, url, hint) {
    el.muted = true; el.preload = 'auto'; el.src = url;
    if (!(await once(el, 'loadedmetadata', 12000))) throw bad();
    let dur = el.duration;
    if (!isFinite(dur) || dur <= 0) {            // recordings often report Infinity until seeked to the end
      el.currentTime = 1e7; await once(el, 'seeked', 6000);
      dur = isFinite(el.duration) && el.duration > 0 ? el.duration : num(hint, 0);
    }
    if (!(dur > 0)) throw bad();
    return dur;
  }
  function snapThumb(src, iw, ih) {
    const c = document.createElement('canvas'); c.width = 192; c.height = 108;
    const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 192, 108);
    if (iw && ih) { const r = L.fitRect(iw, ih, 192, 108, true); try { x.drawImage(src, r.x, r.y, r.w, r.h); } catch (e) { /* ignore */ } }
    try { return c.toDataURL('image/jpeg', 0.72); } catch (e) { return ''; }
  }
  async function probeVideo(url, hint) {
    const v = document.createElement('video'); v.playsInline = true;
    try {
      const dur = await probeTimed(v, url, hint);
      if (!v.videoWidth) throw bad();
      v.currentTime = Math.min(0.5, dur / 3); await once(v, 'seeked', 6000);
      return { dur, w: v.videoWidth, h: v.videoHeight, thumb: snapThumb(v, v.videoWidth, v.videoHeight) };
    } finally { v.removeAttribute('src'); try { v.load(); } catch (e) { /* ignore */ } }
  }
  const toBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));
  async function preparePhoto(blob, url) {
    const img = await decodeImage(blob, url);
    const [iw, ih] = dims(img);
    if (!iw || !ih) throw bad();
    const k = Math.min(1, 2048 / Math.max(iw, ih)), w = Math.round(iw * k), hh = Math.round(ih * k);
    let out = blob;
    if (k < 1 || !/^image\/(jpeg|png|webp)$/.test(blob.type)) {          // keep storage small: photos are stored at up to 2048 px
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, w, hh); x.drawImage(img, 0, 0, w, hh);
      out = (await toBlob(c, 'image/jpeg', 0.9)) || blob;
    }
    return { blob: out, w, h: hh, thumb: snapThumb(img, iw, ih) };
  }
  function kindOf(f) {
    const n = f.name || '', t = f.type || '';
    if (/^video\//.test(t) || /\.(mp4|m4v|webm|mov|ogv|mkv)$/i.test(n)) return 'video';
    if (/^image\//.test(t) || /\.(jpe?g|png|gif|webp|bmp|avif|heic)$/i.test(n)) return 'photo';
    if (/^audio\//.test(t) || /\.(mp3|m4a|wav|ogg|oga|opus|flac|aac)$/i.test(n)) return 'audio';
    return '';
  }
  async function storeMedia(blob, kind, name, hint) {
    const rec = { id: 'm' + SIT.uid(), kind, name: String(name || kind).slice(0, 120), type: blob.type || '', created: Date.now(), dur: 0, w: 0, h: 0, thumb: '' };
    const url = URL.createObjectURL(blob);
    try {
      if (kind === 'video') Object.assign(rec, await probeVideo(url, hint));
      else if (kind === 'audio') rec.dur = await probeTimed(document.createElement('audio'), url, hint);
      else { const ph = await preparePhoto(blob, url); blob = ph.blob; rec.type = blob.type; Object.assign(rec, { w: ph.w, h: ph.h, thumb: ph.thumb }); }
    } finally { URL.revokeObjectURL(url); }
    rec.size = blob.size; rec.blob = blob;
    await room(blob.size);
    await dbPut('media', rec);
    cacheRec(rec);
    libDirty = true;
    return rec;
  }
  function mediaError(e, name) {
    const n = e && (e.name || e.message);
    if (n === 'QuotaExceededError' || n === 'noroom') return 'There isn’t enough storage space in this browser for “' + name + '”. Delete old projects or unused media in Projects, then try again.';
    if (n === 'unplayable') return 'This browser can’t open “' + name + '”. MP4 (H.264) and WebM videos, JPEG or PNG photos, and MP3, M4A or WAV sounds work best.';
    if (n === 'noidb') return 'This browser is blocking storage for this page (private windows often do), so the Studio can’t keep media.';
    return 'Could not add “' + name + '”.';
  }
  async function fixDuration(blob, ms) {          // make recordings seekable in every player
    if (!/webm/.test(blob.type) || !blob.slice) return blob;
    try {
      const head = new Uint8Array(await blob.slice(0, 65536).arrayBuffer());
      const out = L.webmSetDuration(head, ms);
      return out ? new Blob([out, blob.slice(65536)], { type: blob.type }) : blob;
    } catch (e) { return blob; }
  }

  /* ---------- project state, undo, autosave ---------- */
  let P = null, sel = -1, pps = 48, liveSnap = null, saveTimer = 0, libDirty = true, storageOk = true;
  const hist = L.history(120);
  const ui = {};
  const snapshot = () => JSON.stringify(P);
  const kidsUI = () => !SIT.isGrown() || !!store.get('studio.simple', false);
  function edit(fn, opts) { if (!P) return; const before = snapshot(); fn(); if (snapshot() !== before) { L.record(hist, before); changed(opts); } }
  function live(fn, opts) { if (!P) return; if (liveSnap === null) liveSnap = snapshot(); fn(); changed(Object.assign({ insp: true }, opts)); }
  function commitLive() { if (liveSnap !== null && P && liveSnap !== snapshot()) L.record(hist, liveSnap); liveSnap = null; renderBar(); }
  function changed(opts) {
    E.lay = null; E.duck = null;
    sel = clamp(sel, -1, P.clips.length - 1);
    if (!E.playing && E.t > layNow().total) E.t = layNow().total;
    renderEditor(opts); requestDraw(); scheduleSave(); prepareMusic();
  }
  function restore(s) { if (!s) return; P = JSON.parse(s); loadMediaFor(P).then(() => requestDraw()); E.lay = null; E.duck = null; sel = clamp(sel, -1, P.clips.length - 1); renderEditor(); requestDraw(); scheduleSave(); prepareMusic(); }
  function doUndo() { commitLive(); const s = L.undo(hist, snapshot()); if (s) restore(s); else toast('Nothing to undo.'); }
  function doRedo() { commitLive(); const s = L.redo(hist, snapshot()); if (s) restore(s); else toast('Nothing to redo.'); }
  function scheduleSave() { clearTimeout(saveTimer); if (ui.saved) ui.saved.textContent = 'Saving…'; saveTimer = setTimeout(saveNow, 600); }
  function saveNow() {
    clearTimeout(saveTimer);
    if (!P) return Promise.resolve();
    P.updated = Date.now(); store.set('studio.last', P.id);
    return dbPut('projects', L.clone(P)).then(() => { storageOk = true; if (ui.saved) ui.saved.textContent = '✓ Saved on this device'; })
      .catch(e => { storageOk = false; if (ui.saved) ui.saved.textContent = 'Not saved'; toast(e && e.name === 'QuotaExceededError' ? 'Storage is full, so the project could not be saved. Free some space in Projects.' : 'This browser would not save the project (storage may be blocked).'); });
  }
  async function loadMediaFor(p) {
    await Promise.all(L.mediaIds(p).map(ensureMedia));
    p.clips.forEach(c => { if (c.kind === 'photo') imgOf(M.get(c.media)); });
  }
  async function openProject(p) {
    stopAll();
    P = L.sanitizeProject(p).project; sel = -1; hist.past.length = 0; hist.future.length = 0; liveSnap = null;
    E.t = 0; E.lay = null; E.duck = null; dropAllEls();
    await loadMediaFor(P);
    store.set('studio.last', P.id);
    renderEditor(); requestDraw(); prepareMusic();
  }
  function newProject(tpl) {
    const p = L.fromTemplate(tpl, () => 'x' + SIT.uid(), Date.now());
    if (!tpl) p.name = 'My movie';
    return openProject(p).then(saveNow).then(() => { if (tpl) toast('Template ready. Tap an empty slot, then record or add photos to fill it.'); });
  }

  /* ---------- adding clips ---------- */
  let motionTurn = 0;
  const CYCLE = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left'];
  function clipFor(rec) {
    const base = { id: newId(), media: rec.id, name: rec.name };
    if (rec.kind === 'video') {
      const wide = rec.w && rec.h && Math.abs(rec.w / rec.h - 16 / 9) < 0.2;
      return Object.assign(base, { kind: 'video', src: rec.dur, in: 0, out: rec.dur, vol: 1, fit: wide ? 'fill' : 'fit', trans: { type: 'cut', dur: 0.8 } });
    }
    const mo = reduce() ? 'still' : CYCLE[motionTurn++ % CYCLE.length];
    return Object.assign(base, { kind: 'photo', dur: 4, motion: mo, kb: { from: L.clone(L.MOTIONS[mo].from), to: L.clone(L.MOTIONS[mo].to) }, fit: rec.w >= rec.h ? 'fill' : 'fit', trans: { type: 'cross', dur: 0.8 } });
  }
  /* New clips fill a selected empty slot, else go after the selected clip, else at the end. */
  function insertClips(list) {
    if (!list.length) return;
    edit(() => {
      const cur = P.clips[sel];
      let at = sel >= 0 ? sel + 1 : P.clips.length;
      if (cur && cur.slot) { list[0].trans = L.clone(cur.trans); P.clips.splice(sel, 1); at = sel; }
      P.clips.splice(at, 0, ...list);
      sel = at + list.length - 1;
    });
    const it = layNow().items[sel];
    if (it && !E.playing) E.t = it.start;
    requestDraw();
  }
  async function importFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    const clips = [], sounds = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i], kind = kindOf(f);
      if (!kind) { toast('“' + f.name + '” isn’t a video, photo or sound file.'); continue; }
      if (f.size > BIG_FILE) toast('“' + f.name + '” is large (' + L.fmtBytes(f.size) + '). Big files fill the browser’s storage quickly.');
      busy('Adding ' + (i + 1) + ' of ' + list.length + ': ' + f.name);
      try { const rec = await storeMedia(f, kind, f.name.replace(/\.[^.]+$/, '')); if (kind === 'audio') sounds.push(rec); else clips.push(clipFor(rec)); }
      catch (e) { toast(mediaError(e, f.name)); }
    }
    busy('');
    if (clips.length) { insertClips(clips); toast(clips.length + (clips.length === 1 ? ' clip' : ' clips') + ' added. They stay on this device.'); }
    if (sounds.length) askSoundUse(sounds[sounds.length - 1]);
    renderLibrary();
  }
  function addTitle() {
    const prev = P.clips[sel] || P.clips[P.clips.length - 1];
    const style = (prev && prev.kind === 'title' && prev.text.style) || store.get('studio.style', 'classic');
    insertClips([{ id: newId(), kind: 'title', dur: 3.5, text: { title: 'Your title', sub: '', style }, trans: { type: 'fade', dur: 1 } }]);
    if (kidsUI()) openWords(); else setTimeout(() => { const t = ui.side.querySelector('#st-title-text'); if (t) { t.focus(); t.select(); } }, 30);
  }
  function selected() { return P && P.clips[sel]; }
  function select(i, seekInto) {
    sel = i;
    const it = layNow().items[i];
    if (seekInto !== false && it && !E.playing && !(E.t >= it.start && E.t < it.end)) E.t = it.start + Math.min(0.5, it.len / 2);
    renderEditor(); requestDraw();
  }
  function splitAtPlayhead() {
    const lay = layNow(), i = L.clipIndexAt(lay, E.t);
    if (i < 0) { toast('Move the playhead over a clip to split it.'); return; }
    const out = L.split(P.clips, i, E.t - lay.items[i].start, newId());
    if (!out) { toast('Too close to the edge of the clip to split there.'); return; }
    edit(() => { P.clips = out; sel = i + 1; });
  }
  function deleteSel() {
    if (!selected()) { toast('Select a clip first.'); return; }
    const name = clipLabel(selected());
    edit(() => { P.clips = L.remove(P.clips, sel); sel = Math.min(sel, P.clips.length - 1); });
    toast('Removed “' + name + '”.', { label: 'Undo', fn: doUndo });
  }
  function duplicateSel() { const c = selected(); if (!c) return; edit(() => { const d = L.clone(c); d.id = newId(); delete d.slot; P.clips.splice(sel + 1, 0, d); sel++; }); }
  function moveSel(d) { const to = sel + d; if (!selected() || to < 0 || to >= P.clips.length) return; edit(() => { P.clips = L.move(P.clips, sel, to); sel = to; }); }
  function clipLabel(c) {
    if (!c) return '';
    if (c.slot) return 'Empty slot: ' + (c.hint || '');
    if (c.kind === 'title') return (c.text.title || 'Title card');
    return c.name || (c.kind === 'video' ? 'Video' : 'Photo');
  }

  /* ---------- engine: one player for preview and export ---------- */
  const E = { canvas: null, ctx: null, t: 0, playing: false, starting: false, t0: 0, wall0: 0, raf: 0, lay: null, duck: null, els: new Map(), ac: null, mix: null, out: null, master: null,
    musicGain: null, musicSrc: null, musicBuf: null, musicKey: '', exp: null, onEnd: null, drawQueued: false, stallAt: 0 };
  const clipsNow = () => (E.exp ? E.exp.clips : P ? P.clips : []);
  function layNow() { if (E.exp) return E.exp.lay; if (!E.lay) E.lay = L.layout(P ? P.clips : []); return E.lay; }
  function ensureAudio() {
    if (E.ac) return E.ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { E.ac = new AC(); } catch (e) { return null; }
    const ac = E.ac;
    E.mix = ac.createGain();
    E.out = ac.createDynamicsCompressor();          // a soft limiter: stacked layers never clip
    E.out.threshold.value = -10; E.out.knee.value = 2; E.out.ratio.value = 20; E.out.attack.value = 0.002; E.out.release.value = 0.2;
    E.master = ac.createGain(); E.master.gain.value = 0.9;    // the compressor adds make-up gain; trim so peaks sit near -3 dBFS
    E.mix.connect(E.out); E.out.connect(E.master); E.master.connect(ac.destination);
    E.musicGain = ac.createGain(); E.musicGain.gain.value = 0; E.musicGain.connect(E.mix);
    E.els.forEach(attachAudio);
    return ac;
  }
  function attachAudio(e) {
    if (!E.ac || e.g) return;
    try { const s = E.ac.createMediaElementSource(e.el); e.g = E.ac.createGain(); e.g.gain.value = 0; s.connect(e.g); e.g.connect(E.mix); e.el.muted = false; } catch (err) { e.g = null; }
  }
  function elFor(key, url, tag) {
    let e = E.els.get(key);
    if (e && e.url !== url) { dropEl(key); e = null; }
    if (!e) {
      const el = document.createElement(tag);
      el.preload = 'auto'; el.playsInline = true; el.muted = true; el.src = url;
      el.addEventListener('seeked', requestDraw); el.addEventListener('loadeddata', requestDraw);
      e = { el, url, g: null, seen: false }; E.els.set(key, e); attachAudio(e);
    }
    return e;
  }
  function dropEl(key) {
    const e = E.els.get(key); if (!e) return;
    e.el.pause(); e.el.removeAttribute('src'); try { e.el.load(); } catch (x) { /* ignore */ }
    if (e.g) try { e.g.disconnect(); } catch (x) { /* ignore */ }
    E.els.delete(key);
  }
  function dropAllEls() { Array.from(E.els.keys()).forEach(dropEl); }
  function setGain(e, g) {
    g = Math.max(0, g);
    if (e.g) e.g.gain.setTargetAtTime(g, E.ac.currentTime, 0.02);
    else { e.el.volume = clamp(g, 0, 1); e.el.muted = g <= 0; }
  }
  function follow(key, mediaId, tag, layer, near, want, gain, playing) {
    const e0 = E.els.get(key);
    if (!near) { if (e0) { if (!e0.el.paused) e0.el.pause(); setGain(e0, 0); e0.seen = true; } return; }
    const m = M.get(mediaId); if (!m) return;
    const e = elFor(key, m.url, tag), el = e.el;
    e.seen = true;
    const past = isFinite(el.duration) && want >= el.duration - 0.02;
    if (playing && layer && !past) {
      if (el.paused) { if (Math.abs(el.currentTime - want) > 0.1) el.currentTime = want; el.play().catch(() => { /* blocked until a tap */ }); }
      else if (Math.abs(el.currentTime - want) > 0.35) el.currentTime = want;
    } else {
      if (!el.paused) el.pause();
      if (!past && el.readyState >= 1 && !el.seeking && Math.abs(el.currentTime - want) > 0.04) el.currentTime = want;
    }
    setGain(e, playing && layer && !past ? gain : 0);
  }
  function syncMedia(t, playing) {
    const clips = clipsNow(), lay = layNow();
    const st = L.frameState(clips, lay, t, { endFade: P ? P.endFade : 1 });
    const on = {}; st.layers.forEach(l => { on[l.id] = l; });
    lay.items.forEach(it => {
      const c = clips[it.i], l = on[c.id], near = !!l || (t >= it.start - 1.5 && t < it.start);
      const fade = 1 - st.black;
      if (c.kind === 'video') follow('v:' + c.id, c.media, 'video', l, near, l ? l.src : c.in, l ? l.gain * num(c.vol) * fade : 0, playing);
      if (c.voice && c.voice.media) follow('a:' + c.id, c.voice.media, 'audio', l, near, num(c.voice.off, 0) + (l ? l.local : 0), l ? l.gain * num(c.voice.vol) * fade : 0, playing);
    });
    let n = E.els.size;
    E.els.forEach((e, key) => { if (!e.seen) { if (!e.el.paused) e.el.pause(); if (n > 8) { dropEl(key); n--; } } e.seen = false; });
    return st;
  }
  function stalled(st) {
    const clips = clipsNow();
    return st.layers.some(l => {
      const c = clips[l.i]; if (c.kind !== 'video' || !M.get(c.media)) return false;
      const e = E.els.get('v:' + c.id); if (e && e.el.error) return false;
      return !e || e.el.readyState < 2 || e.el.seeking;
    });
  }
  async function primeAt(t) {
    const st = syncMedia(t, false);
    const clips = clipsNow();
    const imgs = st.layers.map(l => clips[l.i]).filter(c => c.kind === 'photo').map(c => { const m = M.get(c.media); imgOf(m); return m && m.imgP; }).filter(Boolean);
    const until = performance.now() + 3000;
    while (stalled(st) && performance.now() < until) await wait(40);
    await Promise.all(imgs);
  }
  function requestDraw() {
    if (E.drawQueued || E.playing || !E.ctx) return;
    E.drawQueued = true;
    requestAnimationFrame(() => { E.drawQueued = false; if (!E.playing && P) { const t = posterT(); syncMedia(t, false); draw(E.ctx, t); onTime(); } });
  }
  /* Parked at 0:00 the first clip is still fading in from black; show the first clear frame instead. */
  function posterT() {
    const it = layNow().items[0];
    return E.t < 0.02 && it && it.type === 'fade' && !E.exp ? Math.min(it.d / 2 + 0.04, it.end - 0.01) : E.t;
  }
  async function play(from) {
    if (E.playing || E.starting || !P) return;
    const lay = layNow();
    if (!lay.items.length) { toast('Add a clip, photo or title first.'); return; }
    ensureAudio();
    if (E.ac && E.ac.state !== 'running') { try { await E.ac.resume(); } catch (e) { /* ignore */ } }
    let t = from != null ? from : E.t;
    if (t >= lay.total - 0.05) t = 0;
    E.t = t; E.starting = true; E.cancelStart = false; updateTransport();
    await Promise.all([primeAt(t), prepareMusic()]);
    E.starting = false;
    if (E.cancelStart) { E.cancelStart = false; updateTransport(); return; }
    E.playing = true; E.t0 = t; E.wall0 = performance.now(); E.stallAt = 0;
    startMusic(t); updateTransport();
    E.raf = requestAnimationFrame(tick);
  }
  function halt() {
    E.playing = false; cancelAnimationFrame(E.raf); stopMusic();
    E.els.forEach(e => { if (!e.el.paused) e.el.pause(); setGain(e, 0); });
  }
  function pause() { if (E.starting) E.cancelStart = true; halt(); updateTransport(); requestDraw(); }
  function stopAll() { if (E.exp) cancelExport(); pause(); }
  function togglePlay() { if (E.playing || E.starting) pause(); else play(); }
  function tick() {
    if (!E.playing) return;
    const lay = layNow(), now = performance.now();
    const t = Math.min(E.t0 + (now - E.wall0) / 1000, lay.total);
    const st = syncMedia(t, true);
    if (stalled(st) && t < lay.total) {                       // a clip is still loading: hold the clock instead of skipping
      if (!E.stallAt) E.stallAt = now;
      if (now - E.stallAt < 4000) { E.t0 = E.t; E.wall0 = now; E.raf = requestAnimationFrame(tick); return; }
    } else E.stallAt = 0;
    E.t = t;
    draw(E.ctx, t); musicLevelNow(); onTime();
    if (E.exp && E.exp.progress) E.exp.progress(t / Math.max(lay.total, 0.001));
    if (t >= lay.total) { halt(); updateTransport(); const f = E.onEnd; E.onEnd = null; if (f) f(); return; }
    E.raf = requestAnimationFrame(tick);
  }
  function seek(t) {
    const lay = layNow();
    t = clamp(t, 0, lay.total);
    if (E.playing) { halt(); E.t = t; play(t); return; }
    E.t = t; requestDraw(); onTime();
  }

  /* ---------- music: generated tracks (WebAudio) and the family's own songs ---------- */
  const bufCache = new Map();
  let noise = null;
  function musicKey(m) { return !m || m.kind === 'none' ? '' : m.kind === 'gen' ? 'g:' + m.track : 'f:' + m.media; }
  function bufferFor(m) {
    const key = musicKey(m);
    if (!bufCache.has(key)) {
      const p = m.kind === 'gen' ? renderTrack(m.track) : decodeSong(m.media);
      bufCache.set(key, p); p.catch(() => bufCache.delete(key));
    }
    return bufCache.get(key);
  }
  async function prepareMusic() {
    if (!P) return null;
    const key = musicKey(P.music);
    if (key === E.musicKey) return E.musicBuf;
    E.musicKey = key; E.musicBuf = null;
    if (!key) return null;
    try { const b = await bufferFor(P.music); if (E.musicKey === key) E.musicBuf = b; }
    catch (e) { if (E.musicKey === key) { E.musicKey = ''; toast('The music could not be prepared in this browser.'); } }
    return E.musicBuf;
  }
  const OAC = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;
  async function decodeSong(id) {
    const m = await ensureMedia(id); if (!m) throw new Error('missing');
    const ab = await m.rec.blob.arrayBuffer();
    const Ctx = OAC(); return new Ctx(2, 44100, 44100).decodeAudioData(ab);
  }
  function env(p, t, a, peak, hold, rel) {
    p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a);
    if (hold > 0) p.setValueAtTime(peak, t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + a + Math.max(0, hold) + rel);
    return t + a + Math.max(0, hold) + rel + 0.02;
  }
  function osc(ctx, type, f, t, end, dest, detune) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; }
  function noiseHit(ctx, t, dur, ftype, freq, q, dest) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q || 0.7;
    s.connect(f); f.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function voice(ctx, bus, e, t) {
    const g = ctx.createGain(); let dest = bus;
    if (e.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = e.pan; p.connect(bus); dest = p; }
    g.connect(dest);
    const f = L.midiHz(e.m), v = e.v;
    switch (e.w) {
      case 'pluck': { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3400, t); lp.frequency.exponentialRampToValueAtTime(800, t + 0.45); lp.connect(g); osc(ctx, 'triangle', f, t, env(g.gain, t, 0.004, v, 0, 0.75), lp); break; }
      case 'bell': { const end = env(g.gain, t, 0.006, v, 0, 1.8); osc(ctx, 'sine', f, t, end, g); const g2 = ctx.createGain(); g2.gain.value = 0.18; g2.connect(g); osc(ctx, 'sine', f * 2.76, t, end, g2); break; }
      case 'mallet': { const end = env(g.gain, t, 0.003, v, 0, 0.5); osc(ctx, 'sine', f, t, end, g); const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.3, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08); g2.connect(g); osc(ctx, 'sine', f * 4, t, t + 0.1, g2); break; }
      case 'bass': { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g); const end = env(g.gain, t, 0.012, v, e.d - 0.1, 0.14); osc(ctx, 'triangle', f, t, end, lp); osc(ctx, 'sine', f, t, end, lp); break; }
      case 'pad': { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.4; lp.connect(g); const end = env(g.gain, t, 0.6, v, e.d - 0.6, 0.9); osc(ctx, 'sawtooth', f, t, end, lp, -7); osc(ctx, 'sawtooth', f, t, end, lp, 7); break; }
      case 'lead': { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.connect(g); osc(ctx, 'square', f, t, env(g.gain, t, 0.01, v * 0.55, e.d - 0.05, 0.1), lp); break; }
      case 'kick': { const o = osc(ctx, 'sine', 130, t, env(g.gain, t, 0.002, v, 0, 0.35), g); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); break; }
      case 'taiko': { const o = osc(ctx, 'sine', 96, t, env(g.gain, t, 0.003, v, 0, 0.7), g); o.frequency.exponentialRampToValueAtTime(50, t + 0.28); const g2 = ctx.createGain(); env(g2.gain, t, 0.002, v * 0.5, 0, 0.18); g2.connect(dest); noiseHit(ctx, t, 0.2, 'lowpass', 380, 0.7, g2); break; }
      case 'clap': { [0, 0.011, 0.023].forEach(o => { const gg = ctx.createGain(); env(gg.gain, t + o, 0.001, v * 0.6, 0, o === 0.023 ? 0.16 : 0.02); gg.connect(dest); noiseHit(ctx, t + o, 0.2, 'bandpass', 1500, 0.9, gg); }); break; }
      case 'hat': env(g.gain, t, 0.001, v, 0, 0.045); noiseHit(ctx, t, 0.06, 'highpass', 7500, 0.7, g); break;
      case 'shaker': env(g.gain, t, 0.01, v * 0.5, 0, 0.07); noiseHit(ctx, t, 0.1, 'bandpass', 6000, 1.2, g); break;
      case 'tick': osc(ctx, 'sine', 1700, t, env(g.gain, t, 0.001, v, 0, 0.03), g); break;
      default: break;
    }
  }
  async function renderTrack(id) {
    const sc = L.musicScore(id); if (!sc) throw new Error('track');
    const Ctx = OAC(); if (!Ctx) throw new Error('no audio');
    const sr = 44100, n = Math.ceil(sc.seconds * sr);
    const ctx = new Ctx(2, n * 2, sr);                         // render two loops and keep the second: its tails wrap seamlessly
    noise = ctx.createBuffer(1, sr, sr); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const bus = ctx.createDynamicsCompressor(); bus.threshold.value = -10; bus.ratio.value = 3; bus.connect(ctx.destination);
    sc.events.forEach(e => { voice(ctx, bus, e, e.t); voice(ctx, bus, e, e.t + sc.seconds); });
    const full = await ctx.startRendering();
    const out = ctx.createBuffer(2, n, sr);
    let peak = 0;
    for (let c = 0; c < 2; c++) { const src = full.getChannelData(c).subarray(n, 2 * n); out.copyToChannel ? out.copyToChannel(src, c) : out.getChannelData(c).set(src); for (let i = 0; i < src.length; i += 7) peak = Math.max(peak, Math.abs(src[i])); }
    const k = peak > 0 ? 0.7 / peak : 1;
    for (let c = 0; c < 2; c++) { const ch = out.getChannelData(c); for (let i = 0; i < ch.length; i++) ch[i] *= k; }
    return out;
  }
  function musicLevelNow() {
    if (!E.musicGain || !P) return;
    const lay = layNow(), m = P.music;
    if (!E.duck) E.duck = L.duckRegions(clipsNow(), lay);
    E.musicGain.gain.setTargetAtTime(L.musicLevel(E.t, lay.total, m.vol, m.duck ? E.duck : null, 0.35), E.ac.currentTime, 0.05);
  }
  function startMusic(t) {
    stopMusic();
    if (!E.ac || !E.musicBuf || !P || P.music.kind === 'none') return;
    const s = E.ac.createBufferSource(); s.buffer = E.musicBuf; s.loop = true; s.connect(E.musicGain);
    E.musicGain.gain.cancelScheduledValues(E.ac.currentTime); E.musicGain.gain.setValueAtTime(0, E.ac.currentTime);
    s.start(E.ac.currentTime, t % E.musicBuf.duration); E.musicSrc = s; musicLevelNow();
  }
  function stopMusic() { if (E.musicSrc) { try { E.musicSrc.stop(); } catch (e) { /* ignore */ } E.musicSrc.disconnect(); E.musicSrc = null; } if (E.musicGain) E.musicGain.gain.value = 0; }
  let listening = null;
  async function listen(m, btn) {
    const was = listening && listening.btn === btn; stopListen();
    if (was) return;
    const ac = ensureAudio(); if (!ac) { toast('This browser can’t play generated music.'); return; }
    try { await ac.resume(); } catch (e) { /* ignore */ }
    btn.textContent = '…';
    let buf; try { buf = await bufferFor(m); } catch (e) { btn.textContent = '▶ Listen'; toast('That music could not be prepared.'); return; }
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = buf; s.loop = true; s.connect(g); g.connect(E.mix);
    const now = ac.currentTime;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.75, now + 0.3); g.gain.setValueAtTime(0.75, now + 9); g.gain.linearRampToValueAtTime(0, now + 10.5);
    s.start(now); s.stop(now + 10.6);
    listening = { s, btn }; btn.textContent = '■ Stop';
    s.onended = () => { if (listening && listening.s === s) stopListen(); };
  }
  function stopListen() { if (!listening) return; try { listening.s.stop(); } catch (e) { /* ignore */ } listening.btn.textContent = '▶ Listen'; listening = null; }

  /* ---------- drawing ---------- */
  let small = null;
  function rr(x, X, Y, w, hh, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + hh, r); x.arcTo(X + w, Y + hh, X, Y + hh, r); x.arcTo(X, Y + hh, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function wrap(x, text, maxW) {
    const out = []; let cur = '';
    String(text || '').split(/\s+/).filter(Boolean).forEach(w => { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; });
    if (cur) out.push(cur);
    return out;
  }
  function fit(x, text, font, size, min, maxW, maxLines) {
    for (let s = size; s >= min; s -= 4) { x.font = font(s); const ls = wrap(x, text, maxW); if (ls.length <= maxLines) return { s, ls }; }
    x.font = font(min); const ls = wrap(x, text, maxW);
    return { s: min, ls: ls.length > maxLines ? ls.slice(0, maxLines - 1).concat([ls.slice(maxLines - 1).join(' ')]) : ls };
  }
  function lines(x, ls, cx, cy, lh) { const top = cy - (ls.length - 1) * lh / 2; ls.forEach((l, i) => x.fillText(l, cx, top + i * lh)); }
  function spacing(x, px) { if ('letterSpacing' in x) x.letterSpacing = px + 'px'; }
  const ease = p => 1 - Math.pow(1 - p, 3);
  function seededList(n, seed, fn) { let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; return Array.from({ length: n }, () => fn(r)); }
  const CONFETTI = seededList(70, 7, r => ({ x: r() * W, y: r() * H, w: 8 + r() * 10, h: 4 + r() * 6, rot: r() * 6.28, sp: 30 + r() * 50, c: ['#ffd23f', '#ff4fa0', '#4fd1ff', '#7cff8a', '#ffffff', '#ff8a3d'][Math.floor(r() * 6)] }));
  const SMUDGE = seededList(36, 11, r => ({ x: r() * W, y: r() * H, rx: 40 + r() * 160, ry: 10 + r() * 50, a: r() * 3.14 }));
  function drawTitle(x, c, local, len) {
    const t = c.text || {}, st = t.style || 'classic', base = x.globalAlpha;
    const a = reduce() ? 1 : ease(clamp(local / (st === 'trailer' ? 1.1 : 0.7), 0, 1)), rise = (1 - a) * 16;
    const title = t.title || '', sub = t.sub || '';
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
    if (st === 'classic') {
      const g = x.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H / 2, W * 0.75); g.addColorStop(0, '#4a1219'); g.addColorStop(1, '#12070a');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      const f = fit(x, title, s => '700 ' + s + 'px ' + SERIF, 88, 40, W * 0.8, 2), cy = H / 2 - (sub ? 26 : 0) + rise;
      x.globalAlpha = base * a;
      x.strokeStyle = 'rgba(236,185,80,.6)'; x.lineWidth = 2;
      const ry = cy + f.ls.length * f.s * 0.62 + 18;
      x.beginPath(); x.moveTo(W / 2 - 170, ry); x.lineTo(W / 2 + 170, ry); x.stroke();
      x.fillStyle = '#ecb950'; x.beginPath(); x.moveTo(W / 2, ry - 7); x.lineTo(W / 2 + 7, ry); x.lineTo(W / 2, ry + 7); x.lineTo(W / 2 - 7, ry); x.fill();
      const tg = x.createLinearGradient(0, cy - f.s, 0, cy + f.s); tg.addColorStop(0, '#fff1c7'); tg.addColorStop(0.6, '#ecb950'); tg.addColorStop(1, '#b8862f');
      x.fillStyle = tg; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 18; lines(x, f.ls, W / 2, cy, f.s * 1.12); x.shadowBlur = 0;
      if (sub) { x.font = '600 26px ' + SANS; spacing(x, 6); x.fillStyle = '#e9d9bd'; lines(x, wrap(x, sub.toUpperCase(), W * 0.8).slice(0, 2), W / 2, ry + 48, 34); }
    } else if (st === 'modern') {
      const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0d1015'); g.addColorStop(1, '#1d2433');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.textAlign = 'left'; x.globalAlpha = base * a;
      const f = fit(x, title, s => '800 ' + s + 'px ' + SANS, 92, 40, W * 0.74, 2), bh = f.ls.length * f.s * 1.05 + (sub ? 60 : 0);
      const top = H / 2 - bh / 2 + rise, left = 140 - (1 - a) * 30;
      x.fillStyle = '#ecb950'; x.fillRect(110 - (1 - a) * 30, top, 9, bh);
      x.fillStyle = '#ffffff'; f.ls.forEach((l, i) => x.fillText(l, left, top + f.s * 0.55 + i * f.s * 1.05));
      if (sub) { x.font = '400 30px ' + SANS; x.fillStyle = '#aeb7c6'; x.fillText(wrap(x, sub, W * 0.74)[0] || '', left, top + bh - 22); }
    } else if (st === 'storybook') {
      x.fillStyle = '#f1e3c6'; x.fillRect(0, 0, W, H);
      const g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72); g.addColorStop(0, 'rgba(120,80,30,0)'); g.addColorStop(1, 'rgba(120,80,30,.42)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#8a6a3f'; x.lineWidth = 3; x.strokeRect(30, 30, W - 60, H - 60); x.lineWidth = 1; x.strokeRect(42, 42, W - 84, H - 84);
      x.globalAlpha = base * a;
      x.fillStyle = '#8a5a2b'; x.font = '44px ' + SERIF; x.fillText('❦', W / 2, H / 2 - 150 + rise);
      const f = fit(x, title, s => 'italic 700 ' + s + 'px ' + SERIF, 80, 36, W * 0.76, 2), cy = H / 2 - (sub ? 20 : 0) + rise;
      x.fillStyle = '#3b2414'; lines(x, f.ls, W / 2, cy, f.s * 1.12);
      if (sub) { x.font = '400 32px ' + SERIF; x.fillStyle = '#6b4a2b'; lines(x, wrap(x, sub, W * 0.74).slice(0, 2), W / 2, cy + f.ls.length * f.s * 0.6 + 44, 40); }
    } else if (st === 'chalk') {
      x.fillStyle = '#5b3d22'; x.fillRect(0, 0, W, H); x.fillStyle = '#24352c'; x.fillRect(22, 22, W - 44, H - 44);
      x.fillStyle = 'rgba(255,255,255,.035)'; SMUDGE.forEach(s => { x.beginPath(); x.ellipse(s.x, s.y, s.rx, s.ry, s.a, 0, 6.283); x.fill(); });
      x.globalAlpha = base * a;
      const f = fit(x, title, s => '700 ' + s + 'px ' + HAND, 78, 36, W * 0.78, 2), cy = H / 2 - (sub ? 30 : 0) + rise;
      x.fillStyle = '#f4f1e8'; x.shadowColor = 'rgba(255,255,255,.25)'; x.shadowBlur = 6; lines(x, f.ls, W / 2, cy, f.s * 1.15); x.shadowBlur = 0;
      const uy = cy + f.ls.length * f.s * 0.6 + 16, uw = Math.min(W * 0.7, x.measureText(f.ls[0] || '').width + 40);
      x.strokeStyle = 'rgba(244,241,232,.7)'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath();
      for (let i = 0; i <= 24; i++) { const px = W / 2 - uw / 2 + uw * i / 24, py = uy + Math.sin(i * 1.3) * 2.2; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
      x.stroke();
      if (sub) { x.font = '400 34px ' + HAND; x.fillStyle = '#cfe3d3'; lines(x, wrap(x, sub, W * 0.76).slice(0, 2), W / 2, uy + 56, 42); }
    } else if (st === 'party') {
      const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2b1260'); g.addColorStop(1, '#8a1f62');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      const move = reduce() ? 0 : local;
      CONFETTI.forEach(p => { const y = ((p.y + move * p.sp) % (H + 40)) - 20; x.save(); x.translate(p.x, y); x.rotate(p.rot + move * 0.8); x.fillStyle = p.c; x.globalAlpha = base * 0.85; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore(); });
      x.globalAlpha = base * a;
      const pop = reduce() ? 1 : 0.85 + 0.15 * ease(clamp(local / 0.5, 0, 1));
      x.save(); x.translate(W / 2, H / 2 - (sub ? 30 : 0)); x.scale(pop, pop);
      const f = fit(x, title, s => '800 ' + s + 'px ' + ROUND, 96, 40, W * 0.8, 2);
      x.fillStyle = '#ff4fa0'; lines(x, f.ls, 0, 6, f.s * 1.1); x.fillStyle = '#ffffff'; lines(x, f.ls, 0, 0, f.s * 1.1);
      x.restore();
      if (sub) { x.font = '700 36px ' + ROUND; x.fillStyle = '#ffe27a'; lines(x, wrap(x, sub, W * 0.78).slice(0, 2), W / 2, H / 2 + 92 + rise, 44); }
    } else {                                                       // trailer
      x.fillStyle = '#050505'; x.fillRect(0, 0, W, H);
      const g = x.createRadialGradient(W / 2, -H * 0.2, 10, W / 2, H * 0.2, W * 0.7); g.addColorStop(0, 'rgba(255,238,205,.16)'); g.addColorStop(1, 'rgba(255,238,205,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.globalAlpha = base * a;
      const z = reduce() ? 1 : 1 + 0.05 * clamp(local / Math.max(len, 0.1), 0, 1);
      x.save(); x.translate(W / 2, H / 2 - (sub ? 22 : 0)); x.scale(z, z);
      spacing(x, 10); const f = fit(x, title.toUpperCase(), s => '600 ' + s + 'px ' + SERIF, 68, 32, W * 0.8, 2);
      x.fillStyle = '#ece5d8'; lines(x, f.ls, 0, 0, f.s * 1.25); x.restore();
      if (sub) { spacing(x, 5); x.font = '500 22px ' + SANS; x.fillStyle = '#a89f8f'; lines(x, wrap(x, sub.toUpperCase(), W * 0.8).slice(0, 2), W / 2, H / 2 + 70, 30); }
    }
    x.restore();
    if (c.slot) {
      x.save(); x.setLineDash([16, 12]); x.strokeStyle = 'rgba(138,90,43,.9)'; x.lineWidth = 4; x.strokeRect(60, 60, W - 120, H - 120);
      x.restore();
    }
  }
  function drawCaption(x, cap, local) {
    const base = x.globalAlpha, a = reduce() ? 1 : clamp(local / 0.35, 0, 1);
    x.save(); x.globalAlpha = base * a; x.textBaseline = 'middle';
    if (cap.style === 'lower') {
      x.font = '700 36px ' + SERIF; x.textAlign = 'left';
      const ls = wrap(x, cap.text, W * 0.6).slice(0, 2), w = Math.max(...ls.map(l => x.measureText(l).width)) + 56, hh = ls.length * 46 + 26, y = H - 96 - hh;
      x.fillStyle = 'rgba(18,12,10,.82)'; x.fillRect(64, y, w, hh); x.fillStyle = '#ecb950'; x.fillRect(64, y, 8, hh);
      x.fillStyle = '#f5e9d6'; ls.forEach((l, i) => x.fillText(l, 64 + 34, y + 36 + i * 46));
    } else if (cap.style === 'bubble') {
      x.font = '700 34px ' + ROUND; x.textAlign = 'left';
      const ls = wrap(x, cap.text, W * 0.42).slice(0, 3), w = Math.max(...ls.map(l => x.measureText(l).width)) + 56, hh = ls.length * 42 + 30;
      x.fillStyle = '#ffffff'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 16; rr(x, 64, 56, w, hh, 26); x.fill();
      x.beginPath(); x.moveTo(110, 56 + hh - 2); x.lineTo(98, 56 + hh + 34); x.lineTo(150, 56 + hh - 2); x.fill(); x.shadowBlur = 0;
      x.fillStyle = '#1b120c'; ls.forEach((l, i) => x.fillText(l, 64 + 28, 56 + 36 + i * 42));
    } else {
      x.font = '600 38px ' + SANS; x.textAlign = 'center';
      const ls = wrap(x, cap.text, W * 0.78).slice(0, 2), w = Math.max(...ls.map(l => x.measureText(l).width)) + 48, hh = ls.length * 48 + 22, y = H - 64 - hh;
      x.fillStyle = 'rgba(0,0,0,.62)'; rr(x, W / 2 - w / 2, y, w, hh, 14); x.fill();
      x.fillStyle = '#ffffff'; ls.forEach((l, i) => x.fillText(l, W / 2, y + 35 + i * 48));
    }
    x.restore();
  }
  function backdrop(x, src, iw, ih) {                // soft blurred fill behind portrait or odd-shaped pictures
    if (!small) { small = document.createElement('canvas'); small.width = 32; small.height = 18; }
    const s = small.getContext('2d'), r = L.fitRect(iw, ih, 32, 18, true);
    try { s.drawImage(src, r.x, r.y, r.w, r.h); } catch (e) { return; }
    x.imageSmoothingEnabled = true; x.drawImage(small, 0, 0, W, H); x.fillStyle = 'rgba(0,0,0,.38)'; x.fillRect(0, 0, W, H);
  }
  function drawPicture(x, src, iw, ih, mode, v) {
    if (mode === 'fill') {
      const r = L.kbRect(iw, ih, W, H, v || { s: 1, x: 0.5, y: 0.5 });
      x.drawImage(src, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
    } else {
      const f = L.fitRect(iw, ih, W, H, false);
      if (Math.abs(iw / ih - W / H) > 0.03) backdrop(x, src, iw, ih);
      const s = v ? v.s : 1, dw = f.w * s, dh = f.h * s;
      x.drawImage(src, W / 2 - (v ? v.x : 0.5) * dw, H / 2 - (v ? v.y : 0.5) * dh, dw, dh);
    }
  }
  function card(x, emoji, text, sub) {
    const g = x.createRadialGradient(W / 2, H * 0.35, 20, W / 2, H / 2, W * 0.7); g.addColorStop(0, '#2a1812'); g.addColorStop(1, '#000');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '90px ' + SANS; x.fillStyle = '#c6b096'; x.fillText(emoji, W / 2, H / 2 - 80);
    x.font = '700 40px ' + SERIF; x.fillStyle = '#f5e9d6'; x.fillText(text, W / 2, H / 2 + 30);
    if (sub) { x.font = '400 26px ' + SANS; x.fillStyle = '#c6b096'; x.fillText(sub, W / 2, H / 2 + 80); }
  }
  function lookOf(c, override) { return L.LOOKS[override || c.look || (P && P.look) || 'none'] || L.LOOKS.none; }
  function drawClip(x, c, l, lookKey) {
    const len = L.len(c);
    if (c.kind === 'title') drawTitle(x, c, l.local, len);
    else {
      const m = M.get(c.media), look = lookOf(c, lookKey);
      if (FILTER_OK && look.filter !== 'none') x.filter = look.filter;
      let drawn = false;
      if (c.kind === 'video') {
        const e = E.els.get('v:' + c.id), v = e && e.el;
        if (v && v.readyState >= 2 && v.videoWidth) { drawPicture(x, v, v.videoWidth, v.videoHeight, c.fit, null); drawn = true; }
        else if (v && v.error) { if (FILTER_OK) x.filter = 'none'; card(x, '⚠️', 'This clip can’t play in this browser', 'MP4 (H.264) and WebM work best'); drawn = 'card'; }
      } else {
        const img = imgOf(m);
        if (img) { const [iw, ih] = dims(img); drawPicture(x, img, iw, ih, c.fit, L.kbAt(L.motionOf(c), l.local / Math.max(len, 0.001))); drawn = true; }
      }
      if (FILTER_OK) x.filter = 'none';
      if (!drawn) { x.save(); card(x, m ? '⏳' : '❓', m ? 'Loading…' : 'Missing clip', m ? '' : 'This clip was deleted from the library'); x.restore(); }
      else if (drawn === true) {
        if (look.tint) { x.save(); x.globalCompositeOperation = look.tint[1]; x.fillStyle = look.tint[0]; x.fillRect(0, 0, W, H); x.restore(); }
        if (look.vignette) { const g = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.68); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + look.vignette + ')'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
      }
    }
    if (c.cap && c.cap.text) drawCaption(x, c.cap, l.local);
  }
  function draw(x, t, opts) {
    if (!x) return false;
    opts = opts || {};
    const clips = clipsNow(), lay = layNow(), st = L.frameState(clips, lay, t, { endFade: P ? P.endFade : 1 });
    if (x === E.ctx && (E.playing || E.drawn) && stalled(st)) return false;   // keep the last good frame while a clip loads
    const k = x.canvas.width / W;
    x.setTransform(k, 0, 0, k, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    if (!st.layers.length) card(x, '🎬', 'Your movie appears here', 'Record, add photos and videos, or start from a template');
    st.layers.forEach(l => { x.save(); x.globalAlpha = l.alpha; drawClip(x, clips[l.i], l, opts.look); x.restore(); });
    if (st.black > 0) { x.globalAlpha = 1; x.fillStyle = 'rgba(0,0,0,' + st.black.toFixed(3) + ')'; x.fillRect(0, 0, W, H); }
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (x === E.ctx) E.drawn = true;
    return true;
  }
  const titleThumbs = new Map();
  function titleThumb(c) {
    const key = JSON.stringify([c.text, !!c.slot]);
    if (titleThumbs.has(key)) return titleThumbs.get(key);
    const cv = document.createElement('canvas'); cv.width = 192; cv.height = 108;
    const x = cv.getContext('2d'); x.setTransform(192 / W, 0, 0, 108 / H, 0, 0);
    drawTitle(x, c, 5, 5);
    let url = ''; try { url = cv.toDataURL('image/jpeg', 0.8); } catch (e) { /* ignore */ }
    if (titleThumbs.size > 200) titleThumbs.clear();
    titleThumbs.set(key, url);
    return url;
  }
  function thumbOf(c) { if (c.kind === 'title') return titleThumb(c); const m = M.get(c.media); return m ? m.rec.thumb : ''; }

  /* ---------- screen layout ---------- */
  function sizeCanvas(w, hh) { if (E.canvas.width !== w || E.canvas.height !== hh) { E.canvas.width = w; E.canvas.height = hh; E.drawn = false; } }
  function previewSize() {
    if (E.exp) return;
    const cw = (ui.screen && ui.screen.clientWidth || 640) * Math.min(2, window.devicePixelRatio || 1);
    if (cw >= 1100) sizeCanvas(1280, 720); else if (cw >= 760) sizeCanvas(960, 540); else sizeCanvas(640, 360);
    requestDraw();
  }
  function btn(label, onclick, cls, attrs) { return h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick }, attrs || {}), label); }
  function busy(msg) { if (!ui.busy) return; ui.busy.hidden = !msg; ui.busy.lastChild.textContent = msg || ''; }

  function mount(root) {
    ui.root = root; root.classList.add('studio');
    E.canvas = h('canvas', { class: 'st-canvas', width: 1280, height: 720, role: 'img', 'aria-label': 'Movie preview' });
    E.ctx = E.canvas.getContext('2d');
    ui.fileIn = h('input', { type: 'file', accept: 'video/*,image/*,audio/*,.mkv,.mov,.heic', multiple: true, hidden: true, onchange: e => { importFiles(e.target.files); e.target.value = ''; } });
    ui.soundIn = h('input', { type: 'file', accept: 'audio/*', hidden: true, onchange: e => { importFiles(e.target.files); e.target.value = ''; } });
    ui.bundleIn = h('input', { type: 'file', accept: '.starkmovie', hidden: true, onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBundle(f); } });
    ui.busy = h('div', { class: 'st-busy', hidden: true, role: 'status' }, h('span', { class: 'st-spin', 'aria-hidden': 'true' }), h('span'));
    ui.screen = h('div', { class: 'st-screen' }, E.canvas, ui.busy);
    ui.play = btn('▶ Play', togglePlay, 'st-playbtn', { 'data-act': 'play', 'aria-keyshortcuts': 'Space' });
    ui.time = h('span', { class: 'st-time', 'aria-live': 'off' }, '0:00.0 / 0:00.0');
    ui.scrub = h('input', { type: 'range', class: 'st-scrub', min: 0, max: 1, step: 0.05, value: 0, 'aria-label': 'Position in the movie', oninput: e => seek(+e.target.value) });
    const transport = h('div', { class: 'st-transport' },
      btn('⏮', () => seek(0), 'icon-btn', { 'aria-label': 'Back to the start', 'aria-keyshortcuts': 'Home' }), ui.play, ui.time, ui.scrub,
      btn('📸', saveStill, 'icon-btn', { 'aria-label': 'Save this frame as a picture', title: 'Save this frame as a picture' }),
      btn('⛶', () => { if (E.canvas.requestFullscreen) E.canvas.requestFullscreen().catch(() => {}); }, 'icon-btn', { 'aria-label': 'Full screen preview', title: 'Full screen' }));
    ui.bar = h('div', { class: 'st-bar' });
    ui.side = h('aside', { class: 'st-side card', 'aria-label': 'Clip settings' });
    ui.adds = h('div', { class: 'st-adds', role: 'toolbar', 'aria-label': 'Add to your movie' });
    ui.tl = h('section', { class: 'st-tl card', 'aria-label': 'Timeline' });
    ui.board = h('section', { class: 'st-board card', 'aria-label': 'Your movie, clip by clip' });
    ui.lib = h('section', { class: 'st-lib card', 'aria-label': 'Media library' });
    ui.dlg = h('dialog', { class: 'dialog st-dlg', 'aria-labelledby': 'st-dlg-title' });
    ui.dlg.addEventListener('close', () => { const f = ui.dlgClose; ui.dlgClose = null; if (f) f(); });

    root.appendChild(h('header', { class: 'view-head st-head' },
      h('h1', null, 'Movie Studio'),
      h('p', { class: 'lede' }, 'Make movies anywhere, even with no internet: record with the camera, add your own photos, videos and sounds, add titles, music and transitions, then save a real movie file.'),
      h('p', { class: 'st-privacy' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), h('strong', null, 'Nothing leaves this device. '), 'Your recordings, photos and projects are kept in this browser on this computer, and this page has no internet access at all.')));
    root.appendChild(ui.bar);
    root.appendChild(h('div', { class: 'st-main' }, h('div', { class: 'st-stagecol' }, ui.screen, transport), ui.side));
    root.appendChild(ui.adds);
    root.appendChild(ui.tl); root.appendChild(ui.board); root.appendChild(ui.lib);
    root.appendChild(h('details', { class: 'st-notes card' },
      h('summary', null, 'Good to know: camera access, exporting, storage'),
      h('ul', null,
        h('li', null, h('strong', null, 'Camera and microphone: '), 'whether the Studio may use them depends on your browser and on how the app is opened. Opened from the offline download (index.html on your computer), Chrome, Edge and Firefox ask your permission. Inside the itch.io page, the browser may block the camera completely; importing files still works there.'),
        h('li', null, h('strong', null, 'Screen recording '), 'works in desktop Chrome, Edge and Firefox. Phones and tablets do not offer it.'),
        h('li', null, h('strong', null, 'Making the movie file '), 'is in the full version. Save a project file to keep your work and open it there.'),
        h('li', null, h('strong', null, 'Storage: '), 'media is kept in this browser’s own storage. Browsers limit how much a page may keep; Projects shows how much is used. Save a project file to move a movie to another device or keep a backup.'),
        h('li', null, h('strong', null, 'Keyboard: '), 'Space plays, S splits, Delete removes, Ctrl+Z undoes. Press ? for the full list.'))));
    root.appendChild(ui.dlg);
    root.appendChild(h('div', { hidden: true }, ui.fileIn, ui.soundIn, ui.bundleIn));
    root.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0) { e.preventDefault(); root.classList.add('drop'); } });
    root.addEventListener('dragleave', e => { if (e.target === root) root.classList.remove('drop'); });
    root.addEventListener('drop', e => { root.classList.remove('drop'); if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); const f = e.dataTransfer.files; if (f.length === 1 && /\.starkmovie$/i.test(f[0].name)) importBundle(f[0]); else importFiles(f); });
    window.addEventListener('resize', () => { clearTimeout(ui.rz); ui.rz = setTimeout(() => { previewSize(); if (P && !kidsUI()) renderTimeline(); }, 150); });
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => { if (P) saveNow(); });
    boot();
  }
  async function boot() {
    previewSize();
    let p = null;
    try {
      await db();
      const last = store.get('studio.last', '');
      if (last) p = await dbGet('projects', last);
      if (!p) { const all = await dbAll('projects'); all.sort((a, b) => (b.updated || 0) - (a.updated || 0)); p = all[0] || null; }
    } catch (e) { storageOk = false; toast('This browser is blocking storage for this page, so the Studio can’t keep your work after you close it.'); }
    if (p) { try { await openProject(p); return; } catch (e) { /* fall through to a fresh project */ } }
    await newProject('');
  }

  /* ---------- top bar ---------- */
  function renderBar() {
    if (!ui.bar || !P) return;
    clear(ui.bar);
    const kids = kidsUI();
    ui.saved = h('span', { class: 'st-saved muted small', role: 'status' }, storageOk ? '✓ Saved on this device' : 'Not saved');
    const name = kids ? h('span', { class: 'st-name' }, '🎬 ', P.name)
      : h('input', { type: 'text', class: 'st-name-in', value: P.name, maxlength: 80, 'aria-label': 'Movie name', oninput: e => live(() => { P.name = e.target.value || 'My movie'; }, { bar: false }), onchange: commitLive });
    ui.bar.appendChild(h('div', { class: 'st-bar-name' }, name, ui.saved));
    ui.bar.appendChild(h('div', { class: 'st-bar-tools' },
      btn(h('span', null, '📁 Projects'), openProjects, kids ? 'btn-lg' : '', { 'data-act': 'projects' }),
      btn('↶', doUndo, 'icon-btn st-undo', { 'aria-label': 'Undo', title: 'Undo (Ctrl+Z)', disabled: !hist.past.length && liveSnap === null, 'aria-keyshortcuts': 'Control+Z' }),
      btn('↷', doRedo, 'icon-btn st-undo', { 'aria-label': 'Redo', title: 'Redo (Ctrl+Y)', disabled: !hist.future.length, 'aria-keyshortcuts': 'Control+Y' }),
      SIT.isGrown()
        ? btn(kids ? '🛠️ Full editor' : '🧸 Simple view', () => { store.set('studio.simple', !kids); renderEditor(); previewSize(); }, 'btn-small', { title: 'Switch between the full editor and the big-button view' })
        : btn('🛠️ Full editor', () => SIT.requestGrown(() => { store.set('studio.simple', false); renderEditor(); }), 'btn-small', { title: 'The full editor is for grown-ups (parent PIN)' }),
      btn(kids ? '🎬 Make my movie' : '⬇ Export movie', openExport, 'btn-primary' + (kids ? ' btn-lg' : ''), { 'data-act': 'export' })));
  }
  function renderEditor(opts) {
    if (!ui.root || !P) return;
    opts = opts || {};
    const kids = kidsUI();
    ui.root.classList.toggle('st-kids', kids);
    if (opts.bar !== false) renderBar();
    renderAdds();
    ui.tl.hidden = kids; ui.board.hidden = !kids;
    if (kids) renderBoard(); else renderTimeline();
    if (!opts.insp) renderSide();
    if (libDirty) renderLibrary();
    updateTransport(); onTime();
  }
  function renderAdds() {
    clear(ui.adds);
    const kids = kidsUI(), md = navigator.mediaDevices;
    const canScreen = !!(md && md.getDisplayMedia);
    const a = (icon, label, fn, act, extra) => btn(h('span', null, h('span', { class: 'st-ico', 'aria-hidden': 'true' }, icon), h('span', null, label)), fn, 'st-add' + (extra || ''), { 'data-act': act });
    if (kids) {
      [a('🎥', 'Record a clip', () => openRecorder('camera'), 'camera'), a('🖼️', 'Add photos and videos', () => ui.fileIn.click(), 'import'),
        a('🔤', 'Add words', addTitle, 'title'), a('🎵', 'Music', openMusic, 'music'), a('✨', 'Magic look', openLooks, 'looks')].forEach(b => ui.adds.appendChild(b));
      return;
    }
    [a('🎥', 'Camera', () => openRecorder('camera'), 'camera'), canScreen ? a('🖥️', 'Screen', () => openRecorder('screen'), 'screen') : null,
      a('🎙️', 'Voice-over', () => openRecorder('voice'), 'voice'), a('📂', 'Import', () => ui.fileIn.click(), 'import'),
      a('🔤', 'Title card', addTitle, 'title'), a('🎵', 'Music', openMusic, 'music'), a('✨', 'Looks', openLooks, 'looks'),
      a('✂️', 'Split', splitAtPlayhead, 'split'), a('⌨️', 'Shortcuts', openKeys, 'keys')].forEach(b => { if (b) ui.adds.appendChild(b); });
  }

  /* ---------- grown-up timeline ---------- */
  const tl = {};
  function renderTimeline() {
    if (!tl.scroll) {
      tl.zoom = h('input', { type: 'range', min: 8, max: 220, step: 1, value: pps, 'aria-label': 'Timeline zoom', oninput: e => { pps = +e.target.value; renderTimeline(); } });
      tl.total = h('span', { class: 'muted small' });
      tl.ruler = h('div', { class: 'st-ruler', 'aria-hidden': 'true' });
      tl.track = h('div', { class: 'st-track' });
      tl.music = h('div', { class: 'st-lane' });
      tl.head = h('div', { class: 'st-head-line', 'aria-hidden': 'true' });
      tl.marker = h('div', { class: 'st-drop', hidden: true, 'aria-hidden': 'true' });
      tl.inner = h('div', { class: 'st-tl-inner' }, tl.ruler, tl.track, tl.music, tl.marker, tl.head);
      tl.scroll = h('div', { class: 'st-tl-scroll' }, tl.inner);
      ui.tl.appendChild(h('div', { class: 'st-tl-tools' },
        h('h2', null, 'Timeline'), tl.total,
        h('span', { class: 'st-tl-hint muted small' }, 'Drag a clip to move it. Drag its edges to trim. Click the ruler to jump.'),
        h('label', { class: 'st-zoom' }, h('span', { 'aria-hidden': 'true' }, '🔍'), tl.zoom),
        btn('Fit', () => { const t = Math.max(layNow().total, 1); pps = clamp(Math.floor((tl.scroll.clientWidth - 30) / (t + 1)), 8, 220); tl.zoom.value = pps; renderTimeline(); }, 'btn-small')));
      ui.tl.appendChild(tl.scroll);
      tl.inner.addEventListener('pointerdown', tlDown);
      tl.inner.addEventListener('pointermove', tlMove);
      tl.inner.addEventListener('pointerup', tlUp);
      tl.inner.addEventListener('pointercancel', tlUp);
      tl.scroll.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); pps = clamp(Math.round(pps * (e.deltaY < 0 ? 1.15 : 0.87)), 8, 220); tl.zoom.value = pps; renderTimeline(); }, { passive: false });
    }
    const lay = layNow(), total = lay.total, hadFocus = tl.track.contains(document.activeElement);
    tl.total.textContent = P.clips.length + (P.clips.length === 1 ? ' clip · ' : ' clips · ') + fmt(total, true);
    tl.inner.style.width = Math.max(tl.scroll.clientWidth - 2, (total + 3) * pps) + 'px';
    clear(tl.ruler);
    const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120].find(s => s * pps >= 64) || 300;
    for (let s = 0; s <= total + 3; s += step) tl.ruler.appendChild(h('span', { class: 'st-tick', style: 'left:' + (s * pps) + 'px' }, fmt(s, step < 1)));
    clear(tl.track);
    if (!P.clips.length) tl.track.appendChild(h('p', { class: 'st-empty muted' }, 'Your timeline is empty. Record a clip, import files or add a title card.'));
    lay.items.forEach(it => {
      const c = P.clips[it.i], th = thumbOf(c);
      const b = h('button', {
        type: 'button', class: 'st-clip k-' + c.kind + (c.slot ? ' slot' : '') + (it.i === sel ? ' sel' : '') + (it.i % 2 ? ' lane-b' : ''),
        'data-i': it.i, 'aria-pressed': it.i === sel ? 'true' : 'false',
        'aria-label': 'Clip ' + (it.i + 1) + ' of ' + P.clips.length + ': ' + clipLabel(c) + ', ' + it.len.toFixed(1) + ' seconds' + (it.d ? ', ' + L.TRANS[it.type].toLowerCase() + ' in' : ''),
        onclick: () => { if (!tl.justDragged) select(it.i); }
      },
      h('span', { class: 'st-clip-name' }, (c.kind === 'video' ? '🎞️ ' : c.kind === 'photo' ? '🖼️ ' : c.slot ? '➕ ' : '🔤 ') + clipLabel(c)),
      h('span', { class: 'st-clip-meta' }, it.len.toFixed(1) + 's', c.voice ? ' · 🎙️' : '', c.cap && c.cap.text ? ' · 💬' : '', c.kind === 'video' && num(c.vol) === 0 ? ' · 🔇' : ''),
      it.d > 0 ? h('span', { class: 'st-trans t-' + it.type, style: 'width:' + (it.d * pps) + 'px', title: L.TRANS[it.type] + ' ' + it.d.toFixed(1) + 's' }) : null,
      h('span', { class: 'st-h st-h-in', 'data-h': 'in', 'aria-hidden': 'true' }), h('span', { class: 'st-h st-h-out', 'data-h': 'out', 'aria-hidden': 'true' }));
      b.style.left = (it.start * pps) + 'px'; b.style.width = Math.max(10, it.len * pps) + 'px';
      if (th) b.style.backgroundImage = 'url("' + th + '")';
      tl.track.appendChild(b);
    });
    clear(tl.music);
    const m = P.music;
    if (m.kind !== 'none') tl.music.appendChild(h('button', { type: 'button', class: 'st-music', style: 'width:' + Math.max(40, total * pps) + 'px', onclick: openMusic }, '🎵 ' + musicName(m) + ' · ' + Math.round(m.vol * 100) + '%' + (m.duck ? ' · softer under voices' : '')));
    else tl.music.appendChild(h('button', { type: 'button', class: 'st-music none', onclick: openMusic }, '🎵 Add music'));
    if (hadFocus && sel >= 0) { const b = tl.track.querySelector('[data-i="' + sel + '"]'); if (b) b.focus({ preventScroll: true }); }
    placeHead();
  }
  function placeHead() { if (tl.head) tl.head.style.transform = 'translateX(' + (E.t * pps) + 'px)'; }
  function tlTime(e) { const r = tl.inner.getBoundingClientRect(); return Math.max(0, (e.clientX - r.left) / pps); }
  function tlDown(e) {
    if (e.button > 0) return;
    const blk = e.target.closest('.st-clip');
    tl.justDragged = false;
    if (!blk) { if (e.target.closest('.st-music')) return; tl.drag = { mode: 'scrub' }; tl.inner.setPointerCapture(e.pointerId); seek(tlTime(e)); return; }
    const i = +blk.dataset.i, hnd = e.target.dataset.h, c = P.clips[i];
    tl.drag = { mode: hnd ? 'trim-' + hnd : 'move', i, x0: e.clientX, orig: L.clone(c), started: false, touch: e.pointerType === 'touch', el: blk };
    if (hnd || e.pointerType !== 'touch') { tl.inner.setPointerCapture(e.pointerId); if (hnd) e.preventDefault(); }
    if (sel !== i) { sel = i; renderSide(); tl.track.querySelectorAll('.st-clip').forEach(b => { const on = +b.dataset.i === i; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
  }
  function tlMove(e) {
    const d = tl.drag; if (!d) return;
    if (d.mode === 'scrub') { seek(tlTime(e)); return; }
    const dx = e.clientX - d.x0, dt = dx / pps;
    if (d.mode === 'move') {
      if (d.touch) return;
      if (!d.started && Math.abs(dx) < 6) return;
      d.started = true;
      const blk = tl.track.querySelector('[data-i="' + d.i + '"]');
      if (blk) { blk.style.transform = 'translateX(' + dx + 'px)'; blk.classList.add('dragging'); }
      const lay = layNow(), it = lay.items[d.i], to = L.dropIndex(lay, d.i, it.start + dt + it.len / 2);
      d.to = to;
      const others = lay.items.filter(x => x.i !== d.i);
      const edge = to >= others.length ? lay.total : others[to].start;
      tl.marker.hidden = false; tl.marker.style.transform = 'translateX(' + (edge * pps) + 'px)';
      return;
    }
    d.started = true;
    const o = d.orig;
    let nc;
    if (d.mode === 'trim-in') nc = o.kind === 'video' ? L.trimIn(o, o.in + dt) : L.setDur(o, o.dur - dt);
    else nc = o.kind === 'video' ? L.trimOut(o, o.out + dt) : L.setDur(o, o.dur + dt);
    live(() => { P.clips[d.i] = nc; }, { insp: false });
    const it = layNow().items[d.i];
    if (it && !E.playing) { E.t = d.mode === 'trim-in' ? it.start : Math.max(it.start, it.end - 0.04); requestDraw(); }
  }
  function tlUp() {
    const d = tl.drag; tl.drag = null; if (!d) return;
    tl.marker.hidden = true;
    if (d.mode === 'move' && d.started && d.to !== undefined) {
      tl.justDragged = true; setTimeout(() => { tl.justDragged = false; }, 0);
      if (d.to !== d.i) edit(() => { P.clips = L.move(P.clips, d.i, d.to); sel = d.to; }); else renderTimeline();
    } else if (d.mode.indexOf('trim') === 0 && d.started) { tl.justDragged = true; setTimeout(() => { tl.justDragged = false; }, 0); commitLive(); }
  }

  /* ---------- kids storyboard ---------- */
  const TRANS_ICON = { cut: '✂️', cross: '💫', fade: '🌙' };
  function renderBoard() {
    clear(ui.board);
    const lay = layNow();
    ui.board.appendChild(h('div', { class: 'st-board-head' }, h('h2', null, 'Your movie'), h('span', { class: 'muted' }, P.clips.length ? P.clips.length + ' parts · ' + fmt(lay.total) + ' long' : 'Nothing yet: tap a big button to start!')));
    const row = h('div', { class: 'st-cards', role: 'list' });
    P.clips.forEach((c, i) => {
      if (i > 0) {
        const t = L.transType(c);
        row.appendChild(h('button', { type: 'button', class: 'st-join', 'aria-label': 'How clip ' + i + ' joins clip ' + (i + 1) + ': ' + L.TRANS[t] + '. Tap to change.', title: L.TRANS[t],
          onclick: () => edit(() => { const order = ['cut', 'cross', 'fade']; c.trans = { type: order[(order.indexOf(t) + 1) % 3], dur: t === 'cut' ? 1 : num(c.trans.dur, 1) }; }) }, TRANS_ICON[t]));
      }
      const th = thumbOf(c), it = lay.items[i];
      row.appendChild(h('div', { role: 'listitem', class: 'st-card-wrap' }, h('button', {
        type: 'button', class: 'st-card' + (i === sel ? ' sel' : '') + (c.slot ? ' slot' : ''), 'aria-pressed': i === sel ? 'true' : 'false',
        'aria-label': 'Part ' + (i + 1) + ': ' + clipLabel(c), onclick: () => select(i)
      },
      th ? h('img', { src: th, alt: '' }) : h('span', { class: 'st-card-ph', 'aria-hidden': 'true' }, c.kind === 'video' ? '🎞️' : '🖼️'),
      h('span', { class: 'st-card-num', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 'st-card-dur', 'aria-hidden': 'true' }, it ? it.len.toFixed(0) + 's' : ''),
      c.slot ? h('span', { class: 'st-card-slot' }, '➕ ' + (c.hint || 'Fill me')) : null)));
    });
    row.appendChild(h('div', { role: 'listitem', class: 'st-card-wrap' }, h('button', { type: 'button', class: 'st-card st-card-add', onclick: () => { sel = P.clips.length - 1; ui.fileIn.click(); }, 'aria-label': 'Add photos and videos at the end' }, h('span', { 'aria-hidden': 'true' }, '＋'), h('span', null, 'Add more'))));
    ui.board.appendChild(row);
    const selCard = row.querySelector('.st-card.sel');
    if (selCard) { const w = selCard.parentNode; if (w.offsetLeft < row.scrollLeft || w.offsetLeft + w.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = w.offsetLeft - row.clientWidth / 2 + w.offsetWidth / 2; }
  }

  /* ---------- side panel: kids tray or grown-up inspector ---------- */
  function field(label, control, hint) { return h('label', { class: 'st-field' }, h('span', { class: 'st-flabel' }, label), control, hint ? h('small', { class: 'muted' }, hint) : null); }
  function select_(opts, value, onchange, label) { return h('select', { 'aria-label': label, onchange: e => onchange(e.target.value) }, Object.keys(opts).map(k => h('option', { value: k, selected: k === value }, opts[k]))); }
  function renderSide() {
    clear(ui.side);
    const c = selected(), kids = kidsUI();
    if (kids) return renderTray(c);
    if (!c) {
      ui.side.appendChild(h('h2', null, 'Movie settings'));
      ui.side.appendChild(h('p', { class: 'muted' }, 'Select a clip on the timeline to trim it, add words, change its transition or record a voice-over.'));
      ui.side.appendChild(field('Look for the whole movie', select_(lookOpts(), P.look, v => edit(() => { P.look = v; }), 'Look for the whole movie')));
      ui.side.appendChild(field('Fade out at the end', h('input', { type: 'range', min: 0, max: 3, step: 0.1, value: P.endFade, 'aria-label': 'Fade out at the end, seconds', oninput: e => live(() => { P.endFade = +e.target.value; }), onchange: commitLive }), P.endFade.toFixed(1) + ' s'));
      ui.side.appendChild(h('p', null, btn('🎵 Music: ' + musicName(P.music), openMusic, 'btn-small')));
      return;
    }
    const it = layNow().items[sel];
    ui.side.appendChild(h('div', { class: 'st-side-head' }, h('h2', null, 'Clip ' + (sel + 1) + ' of ' + P.clips.length), h('span', { class: 'badge' }, c.slot ? 'Empty slot' : c.kind === 'video' ? 'Video' : c.kind === 'photo' ? 'Photo' : 'Title card')));
    if (c.slot) ui.side.appendChild(h('p', { class: 'st-slot-hint' }, (c.hint || 'Empty slot') + ': record or import now and the new clip takes this place. Empty slots are left out of the exported movie.'));
    const set = (fn, o) => live(() => fn(P.clips[sel]), o);
    if (c.kind !== 'title') ui.side.appendChild(field('Name', h('input', { type: 'text', value: c.name || '', maxlength: 120, oninput: e => set(x => { x.name = e.target.value; }), onchange: commitLive })));
    if (c.kind === 'video') {
      const inIn = h('input', { type: 'number', step: 0.1, min: 0, max: c.src, value: c.in.toFixed(2), oninput: e => set(x => { Object.assign(x, L.trimIn(x, +e.target.value)); }), onchange: () => { commitLive(); renderSide(); } });
      const outIn = h('input', { type: 'number', step: 0.1, min: 0, max: c.src, value: c.out.toFixed(2), oninput: e => set(x => { Object.assign(x, L.trimOut(x, +e.target.value)); }), onchange: () => { commitLive(); renderSide(); } });
      ui.side.appendChild(h('div', { class: 'st-two' }, field('Starts at (s)', inIn), field('Ends at (s)', outIn)));
      ui.side.appendChild(h('div', { class: 'row' },
        btn('[ Start here', () => trimToHead('in'), 'btn-small', { title: 'Trim the start to the playhead ([)' }),
        btn('End here ]', () => trimToHead('out'), 'btn-small', { title: 'Trim the end to the playhead (])' }),
        h('span', { class: 'muted small' }, 'Uses ' + L.len(c).toFixed(1) + ' of ' + c.src.toFixed(1) + ' s')));
      ui.side.appendChild(field('Clip volume', h('input', { type: 'range', min: 0, max: 2, step: 0.05, value: num(c.vol), 'aria-label': 'Clip volume', oninput: e => set(x => { x.vol = +e.target.value; }), onchange: () => { commitLive(); renderSide(); } }), Math.round(num(c.vol) * 100) + '%' + (num(c.vol) === 0 ? ' (muted)' : '')));
    } else {
      ui.side.appendChild(field('Length (seconds)', h('input', { type: 'number', step: 0.5, min: L.MIN, max: L.MAX_DUR, value: c.dur, oninput: e => set(x => { Object.assign(x, L.setDur(x, +e.target.value)); }), onchange: commitLive })));
    }
    if (c.kind === 'title') {
      ui.side.appendChild(field('Title', h('input', { type: 'text', id: 'st-title-text', value: c.text.title, maxlength: 200, oninput: e => set(x => { x.text.title = e.target.value; delete x.slot; }), onchange: () => { commitLive(); renderEditor(); } })));
      ui.side.appendChild(field('Second line', h('input', { type: 'text', value: c.text.sub, maxlength: 200, oninput: e => set(x => { x.text.sub = e.target.value; }), onchange: commitLive })));
      ui.side.appendChild(styleChips(c));
    }
    if (c.kind === 'photo') {
      ui.side.appendChild(field('Movement', select_(Object.assign(mapLabels(L.MOTIONS), c.motion === 'custom' ? { custom: 'Custom (from a split)' } : {}), c.motion || 'still', v => { if (v === 'custom') return; edit(() => { const x = P.clips[sel]; x.motion = v; x.kb = { from: L.clone(L.MOTIONS[v].from), to: L.clone(L.MOTIONS[v].to) }; }); }, 'Photo movement')));
    }
    if (c.kind !== 'title') {
      ui.side.appendChild(field('Framing', select_({ fill: 'Fill the screen (crops the edges)', fit: 'Show it all (soft background)' }, c.fit, v => edit(() => { P.clips[sel].fit = v; }), 'Framing')));
      ui.side.appendChild(h('div', { class: 'st-two' },
        field('Look', select_(Object.assign({ '': 'Same as the movie' }, lookOpts()), c.look || '', v => edit(() => { const x = P.clips[sel]; if (v) x.look = v; else delete x.look; }), 'Look for this clip')),
        h('div', { class: 'st-field' }, h('span', { class: 'st-flabel' }, ' '), btn('Use on every clip', () => edit(() => { const v = P.clips[sel].look || P.look; P.look = v; P.clips.forEach(x => { delete x.look; }); }), 'btn-small'))));
    }
    const cap = c.cap || { text: '', style: 'subtitle' };
    ui.side.appendChild(h('div', { class: 'st-two' },
      field('Caption', h('input', { type: 'text', value: cap.text, maxlength: 200, placeholder: 'Words on screen', oninput: e => set(x => { if (e.target.value) x.cap = { text: e.target.value, style: (x.cap && x.cap.style) || 'subtitle' }; else delete x.cap; }), onchange: () => { commitLive(); renderTimeline(); } })),
      field('Caption style', select_(L.CAPTION_STYLES, cap.style, v => edit(() => { const x = P.clips[sel]; x.cap = { text: (x.cap && x.cap.text) || 'Caption', style: v }; }), 'Caption style'))));
    const tt = L.transType(c);
    ui.side.appendChild(h('div', { class: 'st-two' },
      field(sel === 0 ? 'Start of the movie' : 'Join from the clip before', select_(sel === 0 ? { cut: 'Cut (straight in)', fade: 'Fade in from black', cross: 'Fade in from black (dissolve)' } : L.TRANS, tt, v => edit(() => { P.clips[sel].trans = { type: v, dur: num(P.clips[sel].trans.dur, 0.8) }; }), 'Transition')),
      tt !== 'cut' ? field('Transition length', h('input', { type: 'range', min: 0.2, max: 3, step: 0.1, value: c.trans.dur, 'aria-label': 'Transition length, seconds', oninput: e => set(x => { x.trans.dur = +e.target.value; }), onchange: () => { commitLive(); renderSide(); } }), (it ? it.d : c.trans.dur).toFixed(1) + ' s' + (it && it.d < c.trans.dur - 0.05 ? ' (shortened to fit)' : '')) : h('span')));
    if (c.voice) {
      const vm = M.get(c.voice.media);
      ui.side.appendChild(h('div', { class: 'st-voicebox' }, h('strong', null, '🎙️ Voice-over: '), vm ? vm.rec.name : 'missing sound',
        field('Voice volume', h('input', { type: 'range', min: 0, max: 2, step: 0.05, value: num(c.voice.vol), 'aria-label': 'Voice-over volume', oninput: e => set(x => { x.voice.vol = +e.target.value; }), onchange: commitLive })),
        btn('Remove voice-over', () => edit(() => { delete P.clips[sel].voice; }), 'btn-small')));
    } else {
      ui.side.appendChild(h('div', { class: 'row' }, btn('🎙️ Record a voice-over', () => openRecorder('voice'), 'btn-small'), btn('🎵 Use a sound file', () => pickSoundFor('voice'), 'btn-small')));
    }
    ui.side.appendChild(h('div', { class: 'row st-actions' },
      btn('✂️ Split', splitAtPlayhead, 'btn-small', { title: 'Split at the playhead (S)' }),
      btn('⧉ Duplicate', duplicateSel, 'btn-small', { title: 'Duplicate (Ctrl+D)' }),
      btn('◀', () => moveSel(-1), 'icon-btn', { 'aria-label': 'Move earlier', title: 'Move earlier (Alt+Left)', disabled: sel === 0 }),
      btn('▶', () => moveSel(1), 'icon-btn', { 'aria-label': 'Move later', title: 'Move later (Alt+Right)', disabled: sel === P.clips.length - 1 }),
      btn('🗑️ Delete', deleteSel, 'btn-small btn-danger', { title: 'Delete (Del)' })));
  }
  function mapLabels(o) { const r = {}; Object.keys(o).forEach(k => { r[k] = o[k].label; }); return r; }
  function lookOpts() { return mapLabels(L.LOOKS); }
  function styleChips(c) {
    return h('div', { class: 'st-styles', role: 'group', 'aria-label': 'Title style' }, Object.keys(L.TITLE_STYLES).map(k => {
      const prev = { text: { title: 'Aa', sub: '', style: k } };
      return h('button', { type: 'button', class: 'st-style' + (c.text.style === k ? ' on' : ''), 'aria-pressed': c.text.style === k ? 'true' : 'false',
        onclick: () => { store.set('studio.style', k); edit(() => { P.clips[sel].text.style = k; }); if (ui.dlg.open && ui.dlgKind === 'words') openWords(); } },
      h('img', { src: titleThumb(prev), alt: '' }), h('span', null, L.TITLE_STYLES[k]));
    }));
  }
  function trimToHead(which) {
    const c = selected(), it = layNow().items[sel];
    if (!c || c.kind !== 'video' || !it) return;
    const local = E.t - it.start;
    if (local <= 0 || local >= it.len) { toast('Move the playhead inside this clip first.'); return; }
    edit(() => { P.clips[sel] = which === 'in' ? L.trimIn(c, c.in + local) : L.trimOut(c, c.in + local); });
    if (which === 'in') E.t = layNow().items[sel].start;
    requestDraw();
  }
  function renderTray(c) {
    const big = (icon, label, fn, cls, attrs) => btn(h('span', null, h('span', { class: 'st-ico', 'aria-hidden': 'true' }, icon), h('span', null, label)), fn, 'st-big ' + (cls || ''), attrs);
    if (!c) {
      ui.side.appendChild(h('h2', null, P.clips.length ? 'Tap a part of your movie' : 'Let’s make a movie!'));
      ui.side.appendChild(h('p', { class: 'muted' }, P.clips.length ? 'Then you can move it, make it shorter or longer, or add words.' : 'Record yourself, add photos, or open Projects to start from a template like “Birthday” or “Science report”.'));
      ui.side.appendChild(h('div', { class: 'st-bigs' }, big('▶', 'Watch it', togglePlay), big('📁', 'Templates', openProjects)));
      return;
    }
    ui.side.appendChild(h('h2', null, 'Part ' + (sel + 1) + (c.slot ? ': empty' : '')));
    if (c.slot) ui.side.appendChild(h('p', { class: 'st-slot-hint' }, (c.hint || '') + ' Tap “Record a clip” or “Add photos and videos” to fill it.'));
    ui.side.appendChild(h('div', { class: 'st-bigs' },
      big('◀', 'Move left', () => moveSel(-1), '', { disabled: sel === 0 }), big('▶', 'Move right', () => moveSel(1), '', { disabled: sel === P.clips.length - 1 }),
      big('➖', 'Shorter', () => edit(() => { P.clips[sel] = L.nudgeLength(P.clips[sel], -1); })),
      big('➕', 'Longer', () => edit(() => { P.clips[sel] = L.nudgeLength(P.clips[sel], 1); }), '', { disabled: c.kind === 'video' && c.out >= c.src - 0.05 }),
      big('✏️', c.kind === 'title' ? 'Change words' : 'Add words', openWords),
      big('🎙️', c.voice ? 'Talk again' : 'Talk over it', () => openRecorder('voice')),
      c.voice ? big('🔇', 'Remove talking', () => edit(() => { delete P.clips[sel].voice; })) : null,
      big('🗑️', 'Remove', deleteSel, 'st-danger')));
  }

  /* ---------- transport ---------- */
  function updateTransport() {
    if (!ui.play) return;
    const on = E.playing || E.starting;
    ui.play.textContent = on ? '⏸ Pause' : '▶ Play';
    ui.play.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function onTime() {
    if (!ui.time || !P) return;
    const total = layNow().total;
    ui.time.textContent = fmt(E.t, true) + ' / ' + fmt(total, true);
    ui.scrub.max = Math.max(total, 0.1); ui.scrub.value = E.t;
    placeHead();
    if (E.playing && tl.scroll && !kidsUI()) {
      const x = E.t * pps, s = tl.scroll;
      if (x > s.scrollLeft + s.clientWidth - 40 || x < s.scrollLeft) s.scrollLeft = x - 60;
    }
  }
  function saveStill() {
    if (!E.canvas.toBlob) return;
    E.canvas.toBlob(b => { if (b) { SIT.download(safeName(P.name) + '-' + fmt(E.t).replace(':', 'm') + 's.png', b); toast('Picture saved to your downloads.'); } }, 'image/png');
  }

  /* ---------- dialogs ---------- */
  function openDialog(kind, title, onClose) {
    const prev = ui.dlgClose; ui.dlgClose = null;
    if (prev && ui.dlg.open) prev();                     // re-using an open dialog: no close event fires, so tidy up here
    clear(ui.dlg); ui.dlgKind = kind; ui.dlgClose = onClose || null;
    ui.dlg.className = 'dialog st-dlg st-dlg-' + kind;
    const body = h('div', { class: 'dialog-body' });
    ui.dlg.appendChild(h('div', { class: 'st-dlg-head' }, h('h2', { id: 'st-dlg-title' }, title), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => ui.dlg.close() }, '✕')));
    ui.dlg.appendChild(body);
    if (!ui.dlg.open) { if (typeof ui.dlg.showModal === 'function') ui.dlg.showModal(); else ui.dlg.setAttribute('open', ''); }
    return body;
  }
  function closeDialog() { if (ui.dlg.open) ui.dlg.close(); }
  function musicName(m) { return m.kind === 'gen' ? L.TRACKS[m.track].label : m.kind === 'file' ? (m.name || 'Your song') : 'No music'; }

  function openMusic() {
    const body = openDialog('music', '🎵 Music for the whole movie', stopListen);
    const m = P.music;
    body.appendChild(h('p', { class: 'muted' }, 'These tunes are made right here in your browser, so they are free to use and work with no internet. Or use a song of your own.'));
    const grid = h('div', { class: 'st-tracks' });
    Object.keys(L.TRACKS).forEach(k => {
      const T = L.TRACKS[k], on = m.kind === 'gen' && m.track === k;
      const lb = btn('▶ Listen', e => listen({ kind: 'gen', track: k }, e.currentTarget), 'btn-small');
      grid.appendChild(h('div', { class: 'st-track-card' + (on ? ' on' : '') }, h('strong', null, T.label), h('span', { class: 'muted small' }, T.mood + ' · ' + T.bpm + ' beats a minute'),
        h('div', { class: 'row' }, lb, btn(on ? '✓ Chosen' : 'Use this', () => { stopListen(); edit(() => { P.music = Object.assign({}, P.music, { kind: 'gen', track: k }); delete P.music.media; delete P.music.name; }); openMusic(); }, on ? 'btn-small btn-primary' : 'btn-small', { 'data-track': k }))));
    });
    body.appendChild(grid);
    body.appendChild(h('div', { class: 'row' },
      btn('🎧 Use my own song', () => pickSoundFor('music'), 'btn-small'),
      m.kind !== 'none' ? btn('No music', () => { stopListen(); edit(() => { P.music = Object.assign({}, P.music, { kind: 'none' }); delete P.music.track; delete P.music.media; }); openMusic(); }, 'btn-small') : null,
      m.kind === 'file' ? h('span', { class: 'badge' }, '✓ ' + (m.name || 'Your song')) : null));
    body.appendChild(field('Music volume', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: m.vol, 'aria-label': 'Music volume', oninput: e => live(() => { P.music.vol = +e.target.value; }), onchange: commitLive }), 'The music fades in at the start and out at the end.'));
    body.appendChild(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: m.duck, onchange: e => edit(() => { P.music.duck = e.target.checked; }) }), 'Make the music softer while people are talking (clips with sound and voice-overs)'));
    body.appendChild(h('div', { class: 'row end' }, btn('Done', closeDialog, 'btn-primary')));
  }
  async function pickSoundFor(target) {
    const sounds = (await dbAll('media').catch(() => [])).filter(r => r.kind === 'audio').sort((a, b) => b.created - a.created);
    const body = openDialog('sounds', target === 'music' ? '🎧 Choose your song' : '🎵 Choose a sound for this clip');
    body.appendChild(h('p', { class: 'muted' }, 'Pick a sound you added before, or add a new one from this device (MP3, M4A, WAV or OGG). Only use music you have the right to use.'));
    const list = h('ul', { class: 'plain st-soundlist' });
    if (!sounds.length) list.appendChild(h('li', { class: 'muted' }, 'No sounds yet.'));
    sounds.forEach(r => list.appendChild(h('li', null, btn('🎵 ' + r.name + ' · ' + fmt(r.dur), () => { cacheRec(r); useSound(r, target); closeDialog(); }, 'btn-small'))));
    body.appendChild(list);
    body.appendChild(h('div', { class: 'row' }, btn('📂 Add a sound file', () => { ui.pendingSound = target; ui.soundIn.click(); }, 'btn-primary')));
  }
  function useSound(rec, target) {
    if (target === 'voice') {
      if (!selected()) { toast('Select a clip first.'); return; }
      edit(() => { P.clips[sel].voice = { media: rec.id, vol: 1, off: 0 }; });
      toast('“' + rec.name + '” now plays over clip ' + (sel + 1) + '.');
    } else {
      edit(() => { P.music = { kind: 'file', media: rec.id, name: rec.name, vol: P.music.vol, duck: P.music.duck }; });
      toast('“' + rec.name + '” is now the movie’s music. It repeats if the movie is longer.');
    }
  }
  function askSoundUse(rec) {
    if (ui.pendingSound) { const t = ui.pendingSound; ui.pendingSound = null; useSound(rec, t); return; }
    const body = openDialog('soundas', '🎵 How should “' + rec.name + '” be used?');
    body.appendChild(h('div', { class: 'st-bigs' },
      btn('🎵 Music for the whole movie', () => { useSound(rec, 'music'); closeDialog(); }, 'st-big'),
      selected() ? btn('🎙️ Plays over clip ' + (sel + 1), () => { useSound(rec, 'voice'); closeDialog(); }, 'st-big') : null,
      btn('Keep it in the library for later', closeDialog, 'st-big')));
  }

  function openLooks() {
    const body = openDialog('looks', '✨ Choose a look');
    body.appendChild(h('p', { class: 'muted' }, 'A colour look changes the whole movie. Grown-ups can also give one clip its own look in the full editor.'));
    const grid = h('div', { class: 'st-looks' });
    Object.keys(L.LOOKS).forEach(k => {
      const cv = h('canvas', { width: 256, height: 144, 'aria-hidden': 'true' });
      const on = P.look === k && !P.clips.some(c => c.look);
      grid.appendChild(h('button', { type: 'button', class: 'st-look' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false',
        onclick: () => { edit(() => { P.look = k; P.clips.forEach(c => { delete c.look; }); }); closeDialog(); toast(L.LOOKS[k].label + ' look on the whole movie.'); } }, cv, h('span', null, L.LOOKS[k].label)));
      const x = cv.getContext('2d'); syncMedia(E.t, false); draw(x, E.t, { look: k });
    });
    body.appendChild(grid);
    if (!FILTER_OK) body.appendChild(h('p', { class: 'fine' }, 'This browser can only tint pictures, so some looks are gentler here than in Chrome, Edge or Firefox.'));
  }

  function openWords() {
    const c = selected(); if (!c) return;
    const body = openDialog('words', c.kind === 'title' ? '🔤 Words on the title card' : '💬 Words on this part');
    if (c.kind === 'title') {
      const t1 = h('input', { type: 'text', class: 'st-bigin', value: c.slot ? '' : c.text.title, placeholder: 'Big words', maxlength: 120, 'aria-label': 'Big words', oninput: e => live(() => { const x = P.clips[sel]; x.text.title = e.target.value; delete x.slot; }), onchange: commitLive });
      const t2 = h('input', { type: 'text', class: 'st-bigin', value: c.slot ? '' : c.text.sub, placeholder: 'Small words (you can leave this empty)', maxlength: 160, 'aria-label': 'Small words', oninput: e => live(() => { P.clips[sel].text.sub = e.target.value; }), onchange: commitLive });
      body.appendChild(t1); body.appendChild(t2);
      body.appendChild(h('p', { class: 'st-flabel' }, 'Style'));
      body.appendChild(styleChips(c));
      setTimeout(() => t1.focus(), 30);
    } else {
      const cap = c.cap || { text: '', style: 'subtitle' };
      const t = h('input', { type: 'text', class: 'st-bigin', value: cap.text, placeholder: 'What should it say?', maxlength: 160, 'aria-label': 'Words on screen', oninput: e => live(() => { const x = P.clips[sel]; if (e.target.value) x.cap = { text: e.target.value, style: (x.cap && x.cap.style) || 'subtitle' }; else delete x.cap; }), onchange: commitLive });
      body.appendChild(t);
      body.appendChild(h('div', { class: 'st-bigs' }, Object.keys(L.CAPTION_STYLES).map(k => btn(L.CAPTION_STYLES[k], () => edit(() => { const x = P.clips[sel]; x.cap = { text: (x.cap && x.cap.text) || t.value || 'Hello!', style: k }; }), 'st-big' + (cap.style === k ? ' on' : '')))));
      setTimeout(() => t.focus(), 30);
    }
    body.appendChild(h('div', { class: 'row end' }, btn('Done', () => { commitLive(); closeDialog(); }, 'btn-primary btn-lg')));
  }

  function openKeys() {
    const body = openDialog('keys', '⌨️ Keyboard shortcuts');
    const rows = [['Space or K', 'Play or pause'], ['← / →', 'Step one frame (Shift: one second)'], ['Home / End', 'Jump to the start or end'], ['S', 'Split the clip at the playhead'],
      ['Delete', 'Delete the selected clip'], ['Ctrl+Z', 'Undo'], ['Ctrl+Y or Ctrl+Shift+Z', 'Redo'], ['Ctrl+D', 'Duplicate the selected clip'], ['[ and ]', 'Trim the start or end to the playhead'],
      ['Alt+← / Alt+→', 'Move the selected clip earlier or later'], ['T', 'Add a title card'], ['Ctrl + mouse wheel', 'Zoom the timeline'], ['?', 'Show this list']];
    body.appendChild(h('table', { class: 'st-keys' }, h('tbody', null, rows.map(r => h('tr', null, h('th', null, h('kbd', null, r[0])), h('td', null, r[1]))))));
  }

  /* ---------- recording: camera, screen, voice ---------- */
  const REC = { stream: null, mr: null, chunks: [], t0: 0, timer: 0, take: null, takeUrl: '', meterRaf: 0, analyser: null, mode: 'camera', clipId: '', state: 'idle', dur: 0, gainWas: null };
  function recMsg(text, isErr) { if (REC.ui) { REC.ui.msg.textContent = text; REC.ui.msg.classList.toggle('bad', !!isErr); } }
  function permissionText(e) {
    const n = e && e.name, framed = document.documentElement.classList.contains('framed');
    const where = framed ? ' Inside the itch.io page your browser may not allow the camera at all; the offline download works better for recording.' : '';
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return (REC.mode === 'screen' ? 'Screen recording was not allowed. ' : 'The camera or microphone was not allowed. ') + 'To try again, allow it with the camera icon in the address bar or in the browser’s site settings. You can still import videos and photos you already have.' + where;
    if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return REC.mode === 'voice' ? 'No microphone was found on this device.' : 'No camera was found on this device. You can still import videos and photos.';
    if (n === 'NotReadableError' || n === 'TrackStartError') return 'The camera or microphone is busy in another app. Close it there and try again.';
    if (n === 'AbortError') return 'Recording was cancelled.';
    return 'The recorder could not start in this browser (' + (n || 'unknown reason') + ').' + where;
  }
  function stopStream() { if (REC.stream) REC.stream.getTracks().forEach(t => t.stop()); REC.stream = null; cancelAnimationFrame(REC.meterRaf); REC.analyser = null; }
  function cleanupRec() {
    if (REC.mr && REC.mr.state !== 'inactive') { REC.discard = true; try { REC.mr.stop(); } catch (e) { /* ignore */ } }
    clearInterval(REC.timer); clearTimeout(REC.countT); stopStream();
    if (REC.takeUrl) URL.revokeObjectURL(REC.takeUrl);
    REC.takeUrl = ''; REC.take = null; REC.ui = null; REC.state = 'idle';
    if (REC.gainWas !== null && E.mix) { E.mix.gain.value = REC.gainWas; REC.gainWas = null; }
    if (E.playing) pause();
  }
  function setRecState(s) {
    REC.state = s; const u = REC.ui; if (!u) return;
    u.start.hidden = s !== 'ready'; u.stop.hidden = s !== 'recording'; u.use.hidden = u.again.hidden = s !== 'review';
    u.pick.hidden = !(REC.mode === 'screen' && (s === 'idle' || s === 'ready'));
    u.live.hidden = s === 'review' || REC.mode === 'voice'; u.takeEl.hidden = s !== 'review';
    u.dot.hidden = s !== 'recording'; u.devices.hidden = !(s === 'ready' && REC.mode !== 'screen');
    if (u.mirror) u.mirror.hidden = s === 'review';
  }
  function openRecorder(mode) {
    REC.mode = mode;
    if (mode === 'voice' && !selected()) { toast('Select a clip first, then record a voice-over for it.'); return; }
    REC.clipId = mode === 'voice' ? selected().id : '';
    const titles = { camera: '🎥 Record from the camera', screen: '🖥️ Record the screen', voice: '🎙️ Record a voice-over for clip ' + (sel + 1) };
    const body = openDialog('rec', titles[mode], cleanupRec);
    const u = REC.ui = {};
    u.msg = h('p', { class: 'st-rec-msg', role: 'status', 'aria-live': 'polite' });
    u.live = h('video', { class: 'st-live', muted: true, playsinline: true, autoplay: true });
    u.live.muted = true;
    u.takeEl = h(mode === 'voice' ? 'audio' : 'video', { class: 'st-take', controls: true, playsinline: true, hidden: true });
    u.count = h('div', { class: 'st-count', 'aria-live': 'assertive', hidden: true });
    u.dot = h('div', { class: 'st-recdot', hidden: true }, h('span', { 'aria-hidden': 'true' }), h('b', null, '0:00'));
    if (mode === 'voice') u.mirror = h('canvas', { class: 'st-mirror', width: 640, height: 360, 'aria-label': 'The clip you are talking over' });
    u.meter = h('div', { class: 'meter st-level', 'aria-hidden': 'true' }, h('span'));
    u.cam = h('select', { 'aria-label': 'Camera', onchange: () => startPreview() });
    u.mic = h('select', { 'aria-label': 'Microphone', onchange: () => startPreview() });
    u.devices = h('div', { class: 'row st-devices', hidden: true }, mode === 'camera' ? field('Camera', u.cam) : null, field('Microphone', u.mic));
    u.pick = btn('🖥️ Choose a screen or window', () => startPreview(), 'btn-primary', { hidden: true });
    u.start = btn('● Start recording', startRecording, 'btn-primary btn-lg st-recbtn', { hidden: true, 'data-act': 'rec-start' });
    u.stop = btn('■ Stop', stopRecording, 'btn-lg st-stopbtn', { hidden: true, 'data-act': 'rec-stop' });
    u.use = btn('✓ Use this take', useTake, 'btn-primary btn-lg', { hidden: true, 'data-act': 'rec-use' });
    u.again = btn('↺ Try again', () => { if (REC.takeUrl) URL.revokeObjectURL(REC.takeUrl); REC.takeUrl = ''; REC.take = null; u.takeEl.removeAttribute('src'); if (REC.stream) setRecState('ready'); else startPreview(); }, 'btn-lg', { hidden: true });
    body.appendChild(u.msg);
    body.appendChild(h('div', { class: 'st-recscreen' + (mode === 'voice' ? ' voice' : '') }, u.mirror || null, u.live, u.takeEl, u.count, u.dot, mode === 'voice' && !u.mirror ? h('span', { class: 'st-mic', 'aria-hidden': 'true' }, '🎙️') : null));
    body.appendChild(u.meter);
    body.appendChild(u.devices);
    body.appendChild(h('div', { class: 'row center st-recbtns' }, u.pick, u.start, u.stop, u.use, u.again));
    body.appendChild(h('p', { class: 'fine' }, mode === 'voice'
      ? 'The clip plays quietly while you talk, so you can match your words to the picture. Headphones stop the clip’s sound getting into the recording.'
      : mode === 'screen' ? 'Your browser asks which screen, window or tab to share. Tab sound is included where the browser offers it. Stop sharing or press Stop to finish.'
        : 'Camera access depends on your browser and on how the app is opened: from the offline download your browser asks permission; inside the itch.io page the camera may be blocked. Nothing you record leaves this device.'));
    setRecState('idle');
    if (mode === 'voice') { const it = layNow().items[sel]; if (it) { E.t = it.start; requestDraw(); } drawMirror(); }
    if (mode !== 'screen') startPreview(); else { recMsg('Press the button and choose what to record.'); setRecState('idle'); }
  }
  /* the preview mirror is throttled to about 10 fps while recording; the recorded canvas keeps full speed */
  let mirrorAt = 0;
  function drawMirror(t) {
    const u = REC.ui; if (!u || !u.mirror) return;
    const now = typeof t === 'number' ? t : performance.now();
    if (REC.state !== 'recording' || now - mirrorAt >= 100) { mirrorAt = now; u.mirror.getContext('2d').drawImage(E.canvas, 0, 0, 640, 360); }
    if (REC.state === 'recording') requestAnimationFrame(drawMirror);
  }
  async function startPreview() {
    const u = REC.ui; if (!u) return;
    stopStream();
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia || (REC.mode === 'screen' && !md.getDisplayMedia)) {
      recMsg(REC.mode === 'screen' ? 'This browser can’t record the screen. Desktop Chrome, Edge and Firefox can.' : 'This browser doesn’t allow the camera here. Camera access depends on the browser and on how the app is opened: try the offline download in Chrome, Edge or Firefox. Importing videos still works.', true);
      return;
    }
    if (!window.MediaRecorder) { recMsg('This browser can’t record video. Chrome, Edge, Firefox and recent Safari can.', true); return; }
    recMsg(REC.mode === 'screen' ? 'Choose what to share…' : 'Asking for the ' + (REC.mode === 'voice' ? 'microphone' : 'camera') + '…');
    const audio = { echoCancellation: true, noiseSuppression: true };
    if (u.mic.value) audio.deviceId = { exact: u.mic.value };
    try {
      let s;
      if (REC.mode === 'screen') s = await md.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      else s = await md.getUserMedia({ audio, video: REC.mode === 'camera' ? Object.assign({ width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, u.cam.value ? { deviceId: { exact: u.cam.value } } : {}) : false });
      if (!REC.ui) { s.getTracks().forEach(t => t.stop()); return; }
      REC.stream = s;
      u.live.srcObject = s; u.live.play().catch(() => {});
      const vt = s.getVideoTracks()[0]; if (vt) vt.addEventListener('ended', () => { if (REC.state === 'recording') stopRecording(); });
      startMeter(s);
      recMsg(REC.mode === 'voice' ? 'Ready. Press Start, wait for 3-2-1, then talk.' : 'Ready when you are. Press Start for a 3-2-1 countdown.');
      setRecState('ready');
      if (REC.mode !== 'screen') fillDevices();
    } catch (e) { recMsg(permissionText(e), true); setRecState('idle'); }
  }
  async function fillDevices() {
    const u = REC.ui; if (!u || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const ds = await navigator.mediaDevices.enumerateDevices();
      const curV = REC.stream && REC.stream.getVideoTracks()[0], curA = REC.stream && REC.stream.getAudioTracks()[0];
      const fill = (selEl, kind, cur, word) => {
        const list = ds.filter(d => d.kind === kind); clear(selEl);
        const curId = cur && cur.getSettings ? cur.getSettings().deviceId : '';
        list.forEach((d, i) => selEl.appendChild(h('option', { value: d.deviceId, selected: d.deviceId === curId }, d.label || word + ' ' + (i + 1))));
        selEl.closest('.st-field').hidden = list.length < 2;
      };
      if (REC.mode === 'camera') fill(u.cam, 'videoinput', curV, 'Camera');
      fill(u.mic, 'audioinput', curA, 'Microphone');
      u.devices.hidden = !Array.from(u.devices.querySelectorAll('.st-field')).some(f => !f.hidden);
    } catch (e) { /* device names are optional */ }
  }
  function startMeter(stream) {
    const ac = ensureAudio(); if (!ac || !stream.getAudioTracks().length || !REC.ui) return;
    try {
      const an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an); REC.analyser = an;
      const buf = new Float32Array(an.fftSize), bar = REC.ui.meter.firstChild;
      const loop = () => { if (!REC.analyser || !REC.ui) return; an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; bar.style.width = Math.min(100, Math.sqrt(s / buf.length) * 400) + '%'; REC.meterRaf = requestAnimationFrame(loop); };
      loop();
    } catch (e) { /* the level meter is optional */ }
  }
  function startRecording() {
    const u = REC.ui; if (!u || !REC.stream) return;
    setRecState('counting'); u.start.hidden = true;
    const steps = [3, 2, 1];
    let i = 0; u.count.hidden = false;
    const next = () => {
      if (!REC.ui) return;
      if (i < steps.length) { u.count.textContent = String(steps[i++]); REC.countT = setTimeout(next, 800); return; }
      u.count.hidden = true; beginCapture();
    };
    next();
  }
  function beginCapture() {
    const u = REC.ui; if (!u || !REC.stream) return;
    const voice = REC.mode === 'voice';
    const type = L.pickType(t => MediaRecorder.isTypeSupported(t), voice ? L.AUDIO_TYPES : L.VIDEO_TYPES);
    const stream = voice ? new MediaStream(REC.stream.getAudioTracks()) : REC.stream;
    try { REC.mr = new MediaRecorder(stream, Object.assign(type ? { mimeType: type } : {}, voice ? { audioBitsPerSecond: 128000 } : { videoBitsPerSecond: 4000000 })); }
    catch (e) { recMsg('This browser could not start recording (' + (e.name || 'error') + ').', true); setRecState('ready'); return; }
    REC.chunks = []; REC.discard = false;
    REC.mr.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
    REC.mr.onstop = finishCapture;
    REC.mr.start(1000); REC.t0 = performance.now();
    setRecState('recording'); recMsg('Recording…');
    REC.timer = setInterval(() => {
      const s = (performance.now() - REC.t0) / 1000;
      if (REC.ui) REC.ui.dot.lastChild.textContent = fmt(s);
      if (s >= MAX_REC) { recMsg('That’s the 10-minute limit for one take.'); stopRecording(); }
    }, 250);
    if (voice) {
      const idx = P.clips.findIndex(c => c.id === REC.clipId), it = layNow().items[idx];
      if (it) {
        ensureAudio(); if (E.mix) { REC.gainWas = E.mix.gain.value; E.mix.gain.value = 0.25; }
        E.onEnd = null; play(it.start).then(drawMirror);
        const stopAt = () => { if (REC.state !== 'recording') return; if (E.t >= it.end - 0.02 || !E.playing && !E.starting) { stopRecording(); return; } setTimeout(stopAt, 100); };
        setTimeout(stopAt, 400);
      }
    }
  }
  function stopRecording() {
    if (!REC.mr || REC.mr.state === 'inactive') return;
    REC.dur = (performance.now() - REC.t0) / 1000;
    clearInterval(REC.timer);
    try { REC.mr.stop(); } catch (e) { /* ignore */ }
    if (REC.mode === 'voice') { pause(); if (REC.gainWas !== null && E.mix) { E.mix.gain.value = REC.gainWas; REC.gainWas = null; } }
  }
  async function finishCapture() {
    if (REC.discard) { REC.discard = false; return; }
    const u = REC.ui; if (!u) return;
    const type = (REC.mr.mimeType || REC.chunks[0] && REC.chunks[0].type || 'video/webm').split(';')[0];
    let blob = new Blob(REC.chunks, { type });
    if (!blob.size) { recMsg('Nothing was recorded. Try again.', true); setRecState('ready'); return; }
    blob = await fixDuration(blob, REC.dur * 1000);
    REC.take = blob;
    REC.takeUrl = URL.createObjectURL(blob); u.takeEl.src = REC.takeUrl;
    recMsg('Here’s your take (' + fmt(REC.dur) + '). Keep it or try again.');
    setRecState('review');
  }
  async function useTake() {
    if (!REC.take) return;
    const voice = REC.mode === 'voice', blob = REC.take, d = new Date();
    const name = (REC.mode === 'camera' ? 'Camera ' : REC.mode === 'screen' ? 'Screen ' : 'Voice ') + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    REC.ui.use.disabled = true; recMsg('Saving to this device…');
    try {
      const rec = await storeMedia(blob, voice ? 'audio' : 'video', name, REC.dur);
      if (voice) {
        const idx = P.clips.findIndex(c => c.id === REC.clipId);
        if (idx >= 0) { sel = idx; edit(() => { P.clips[idx].voice = { media: rec.id, vol: 1, off: 0 }; }); }
        toast('Voice-over added to clip ' + (idx + 1) + '.');
      } else { insertClips([clipFor(rec)]); toast('Clip added to your movie.'); }
      closeDialog();
    } catch (e) { if (REC.ui) { REC.ui.use.disabled = false; recMsg(mediaError(e, name), true); } }
  }

  let lastExport = null;
  function openExport() { window.StarkTrial.show('movie_export'); }
  function cancelExport() {}
  function onVisibility() {}
  /* ---------- projects, templates, bundles, storage ---------- */
  async function openProjects() {
    await saveNow();
    const body = openDialog('projects', '📁 Projects');
    const est = await estimate();
    const lvl = L.storageLevel(est.used, est.quota);
    body.appendChild(h('div', { class: 'st-storage ' + lvl },
      h('div', { class: 'meter', 'aria-hidden': 'true' }, h('span', { style: 'width:' + (est.quota ? Math.min(100, 100 * est.used / est.quota) : 0) + '%' })),
      h('p', { class: 'small' }, est.quota ? 'This browser is keeping ' + L.fmtBytes(est.used) + ' for this page, out of about ' + L.fmtBytes(est.quota) + ' it allows.' : 'This browser does not say how much storage is left.',
        lvl === 'high' ? ' Storage is getting full: delete media you no longer need, or save project files as backups.' : lvl === 'full' ? ' Storage is full! New clips can’t be saved until you free some space.' : ''),
      navigator.storage && navigator.storage.persist ? btn('🛡️ Ask the browser to keep my movies safe', async e => {
        const b = e.currentTarget; let ok = false; try { ok = await navigator.storage.persist(); } catch (x) { /* ignore */ }
        b.textContent = ok ? '✓ The browser will keep them unless you clear its data' : 'The browser said no (it may still keep them; save project files to be sure)'; b.disabled = true;
      }, 'btn-small') : null));
    body.appendChild(h('h3', null, 'Start something new'));
    const tg = h('div', { class: 'st-templates' });
    tg.appendChild(btn(h('span', null, h('span', { class: 'st-ico', 'aria-hidden': 'true' }, '🎞️'), h('strong', null, 'Blank movie'), h('small', null, 'Start from nothing.')), () => { closeDialog(); newProject(''); }, 'st-tpl', { 'data-tpl': 'blank' }));
    Object.keys(L.TEMPLATES).forEach(k => { const T = L.TEMPLATES[k]; tg.appendChild(btn(h('span', null, h('span', { class: 'st-ico', 'aria-hidden': 'true' }, T.icon), h('strong', null, T.label), h('small', null, T.blurb)), () => { closeDialog(); newProject(k); }, 'st-tpl', { 'data-tpl': k })); });
    body.appendChild(tg);
    body.appendChild(h('h3', null, 'Your projects'));
    const list = h('ul', { class: 'plain st-projlist' });
    const all = (await dbAll('projects').catch(() => [])).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    if (!all.length) list.appendChild(h('li', { class: 'muted' }, 'No saved projects yet.'));
    all.forEach(p => {
      let tot = 0; try { tot = L.totalDuration(L.exportClips(L.sanitizeProject(p).project.clips)); } catch (e) { /* ignore */ }
      const cur = P && p.id === P.id;
      list.appendChild(h('li', { class: 'st-proj' + (cur ? ' cur' : '') },
        h('div', { class: 'st-proj-text' }, h('strong', null, p.name || 'Untitled'), h('small', { class: 'muted' }, (p.clips || []).length + ' parts · ' + fmt(tot) + ' · ' + (p.updated ? new Date(p.updated).toLocaleDateString() : ''), cur ? ' · open now' : '')),
        h('div', { class: 'row' },
          cur ? null : btn('Open', () => { closeDialog(); openProject(p); }, 'btn-small btn-primary'),
          btn('Duplicate', async () => { const d = L.clone(p); d.id = 'x' + SIT.uid(); d.name = (p.name || 'Movie') + ' (copy)'; d.updated = Date.now(); await dbPut('projects', d).catch(() => {}); openProjects(); }, 'btn-small'),
          armed('Delete', 'Tap again to delete', async () => {
            await dbDel('projects', p.id).catch(() => {});
            if (cur) { closeDialog(); store.del('studio.last'); await boot(); } else openProjects();
          }))));
    });
    body.appendChild(list);
    body.appendChild(h('h3', null, 'Move a movie to another device'));
    body.appendChild(h('p', { class: 'muted small' }, 'A project file holds the whole project with its clips, photos and sounds. Copy it on a USB stick or by any means you like, then open it in the Studio there.'));
    body.appendChild(h('div', { class: 'row' }, btn('⬇ Save this project as a file', exportBundle, 'btn-small', { 'data-act': 'bundle-save' }), btn('📂 Open a project file', () => ui.bundleIn.click(), 'btn-small')));
    body.appendChild(h('h3', null, 'Tidy up'));
    body.appendChild(h('div', { class: 'row' }, armed('🧹 Delete media no project uses', 'Tap again to delete unused media', cleanUnused)));
  }
  function armed(label, armedLabel, fn) {
    let tm = 0;
    const b = btn(label, () => {
      if (b.dataset.armed) { clearTimeout(tm); delete b.dataset.armed; fn(); return; }
      b.dataset.armed = '1'; b.textContent = armedLabel; b.classList.add('btn-danger');
      tm = setTimeout(() => { delete b.dataset.armed; b.textContent = label; b.classList.remove('btn-danger'); }, 4000);
    }, 'btn-small');
    return b;
  }
  async function usedMedia() {
    const used = new Set(L.mediaIds(P));
    (await dbAll('projects').catch(() => [])).forEach(p => { try { L.mediaIds(p).forEach(id => used.add(id)); } catch (e) { /* ignore */ } });
    return used;
  }
  async function cleanUnused() {
    await saveNow();
    const used = await usedMedia(), all = await dbAll('media').catch(() => []);
    let n = 0, bytes = 0;
    for (const r of all) if (!used.has(r.id)) { await dbDel('media', r.id).catch(() => {}); forget(r.id); n++; bytes += r.size || 0; }
    toast(n ? 'Deleted ' + n + ' unused ' + (n === 1 ? 'item' : 'items') + ', freeing ' + L.fmtBytes(bytes) + '.' : 'Everything in the library is used by a project.');
    libDirty = true; renderLibrary(); if (ui.dlg.open && ui.dlgKind === 'projects') openProjects();
  }
  function forget(id) { const m = M.get(id); if (m) { URL.revokeObjectURL(m.url); M.delete(id); } bufCache.delete('f:' + id); }
  async function exportBundle() {
    await saveNow();
    const recs = (await Promise.all(L.mediaIds(P).map(id => dbGet('media', id).catch(() => null)))).filter(Boolean);
    const head = L.bundleHeader(P, recs.map(r => ({ id: r.id, kind: r.kind, name: r.name, type: r.type, dur: r.dur, w: r.w, h: r.h, thumb: r.thumb, size: r.blob.size })));
    const blob = new Blob([head.prefix, head.json].concat(recs.map(r => r.blob)), { type: 'application/octet-stream' });
    SIT.download(safeName(P.name) + '.starkmovie', blob);
    toast('Project file saved to your downloads (' + L.fmtBytes(blob.size) + ').');
  }
  async function importBundle(file) {
    busy('Opening ' + file.name + '…');
    try {
      const pre = L.parsePrefix(await file.slice(0, 23).text());
      const ds = pre.start + pre.jsonLen;
      const b = L.checkBundle(JSON.parse(await file.slice(pre.start, ds).text()), file.size, ds);
      for (const e of b.media) {
        if (await dbGet('media', e.id).catch(() => null)) continue;
        await room(e.size);
        await dbPut('media', { id: e.id, kind: e.kind, name: String(e.name || e.kind).slice(0, 120), type: e.type || '', dur: +e.dur || 0, w: +e.w || 0, h: +e.h || 0, thumb: typeof e.thumb === 'string' && e.thumb.indexOf('data:image/') === 0 ? e.thumb : '', size: e.size, created: Date.now(), blob: file.slice(ds + e.off, ds + e.off + e.size, e.type || '') });
      }
      const p = b.project;
      if (await dbGet('projects', p.id).catch(() => null)) { p.id = 'x' + SIT.uid(); p.name = (p.name + ' (imported)').slice(0, 80); }
      p.updated = Date.now();
      await dbPut('projects', p);
      libDirty = true; closeDialog();
      await openProject(p);
      toast('Opened “' + p.name + '”.');
    } catch (e) {
      toast(/bundle/.test(e && e.message) || e instanceof SyntaxError ? 'That file is not a Stark movie project file, or it is damaged.' : mediaError(e, file.name));
    } finally { busy(''); }
  }

  /* ---------- library ---------- */
  async function renderLibrary() {
    if (!ui.lib) return;
    libDirty = false;
    const all = (await dbAll('media').catch(() => [])).sort((a, b) => b.created - a.created);
    const kids = kidsUI(), inProj = new Set(L.mediaIds(P || { clips: [] }));
    const shown = kids ? all.filter(r => r.kind !== 'audio') : all;
    let bytes = 0; all.forEach(r => { bytes += r.size || 0; });
    clear(ui.lib);
    ui.lib.appendChild(h('div', { class: 'st-lib-head' }, h('h2', null, kids ? 'Your clips and photos' : 'Media library'),
      h('span', { class: 'muted small' }, all.length + (all.length === 1 ? ' item · ' : ' items · ') + L.fmtBytes(bytes) + ' on this device'),
      btn('📂 Add files', () => ui.fileIn.click(), 'btn-small')));
    if (!shown.length) { ui.lib.appendChild(h('p', { class: 'muted' }, 'Everything you record or import appears here, ready to use again in any project. You can also drop files onto this page.')); return; }
    const grid = h('ul', { class: 'plain st-media' });
    shown.slice(0, 120).forEach(r => {
      const add = () => { cacheRec(r); if (r.kind === 'audio') askSoundUse(r); else insertClips([clipFor(r)]); };
      grid.appendChild(h('li', { class: 'st-mitem' + (inProj.has(r.id) ? ' used' : '') },
        h('button', { type: 'button', class: 'st-mbtn', onclick: add, 'aria-label': (r.kind === 'audio' ? 'Use sound ' : 'Add ') + r.name + (r.dur ? ', ' + fmt(r.dur) : '') },
          r.thumb ? h('img', { src: r.thumb, alt: '' }) : h('span', { class: 'st-mph', 'aria-hidden': 'true' }, r.kind === 'audio' ? '🎵' : '🎞️'),
          h('span', { class: 'st-mname' }, r.name), h('span', { class: 'st-mmeta' }, (r.kind === 'video' ? '🎞️ ' : r.kind === 'photo' ? '🖼️ ' : '🎵 ') + (r.dur ? fmt(r.dur) + ' · ' : '') + L.fmtBytes(r.size))),
        kids ? null : armed('✕', 'Delete?', async () => {
          const used = await usedMedia();
          if (used.has(r.id)) { toast('“' + r.name + '” is used in a project. Remove it there first.'); return; }
          await dbDel('media', r.id).catch(() => {}); forget(r.id); renderLibrary();
        })));
    });
    ui.lib.appendChild(grid);
  }

  /* ---------- keyboard ---------- */
  function onKey(e) {
    if (SIT.currentView() !== 'studio' || !P || E.exp) return;
    if (document.querySelector('dialog[open]')) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || (tag === 'INPUT' && !/^(range|checkbox|radio|button)$/.test(t.type))) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key;
    const lay = layNow();
    let done = true;
    if (mod && (k === 'z' || k === 'Z')) { if (e.shiftKey) doRedo(); else doUndo(); }
    else if (mod && (k === 'y' || k === 'Y')) doRedo();
    else if (mod && (k === 'd' || k === 'D')) duplicateSel();
    else if (mod || e.altKey && k !== 'ArrowLeft' && k !== 'ArrowRight') done = false;
    else if (k === ' ' || k === 'k' || k === 'K') { if (tag === 'BUTTON' && k === ' ') { done = false; } else togglePlay(); }
    else if (e.altKey && k === 'ArrowLeft') moveSel(-1);
    else if (e.altKey && k === 'ArrowRight') moveSel(1);
    else if (k === 'ArrowLeft' && tag !== 'INPUT') seek(E.t - (e.shiftKey ? 1 : 1 / 30));
    else if (k === 'ArrowRight' && tag !== 'INPUT') seek(E.t + (e.shiftKey ? 1 : 1 / 30));
    else if (k === 'Home') seek(0);
    else if (k === 'End') seek(lay.total);
    else if (k === 's' || k === 'S') splitAtPlayhead();
    else if (k === 'Delete' || k === 'Backspace') deleteSel();
    else if (k === '[') trimToHead('in');
    else if (k === ']') trimToHead('out');
    else if (k === 't' || k === 'T') addTitle();
    else if (k === '?') openKeys();
    else done = false;
    if (done) e.preventDefault();
  }

  SIT.view('studio', {
    title: 'Movie Studio', mount,
    show() { if (P) { renderEditor(); previewSize(); } },
    hide() { if (!E.exp) pause(); stopListen(); if (P) saveNow(); }
  });
  SIT.on('mode', () => { if (!ui.root || !P || E.exp) return; if (ui.dlg.open && ui.dlgKind !== 'rec') closeDialog(); renderEditor(); renderLibrary(); });
  /* For checks and debugging (read-only views of state). */
  SIT.studio = { project: () => P && L.clone(P), lastExport: () => lastExport, time: () => E.t, playing: () => E.playing, exporting: () => !!E.exp };
})();
