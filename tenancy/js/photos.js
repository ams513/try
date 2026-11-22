/* Stark Tenancy: dated photos and receipt pictures, kept in this browser's IndexedDB and never sent anywhere.
   Image reading and shrinking is adapted from Stark Family Vault (resize, re-encode as JPEG). Each picture is stamped with the
   date and time it was added, plus the camera's own date when the file carries one, and gets a SHA-256 fingerprint. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  var T = TN.i18n.T, DB = 'stark-tenancy', STORE = 'photos', MAX_SIDE = 1280, MAX_IN = 30 * 1024 * 1024, CACHE_MAX = 300;
  var mem = {}, cache = {}, cacheOrder = [], dbp = null, persistent = true;

  /* ---------- storage ---------- */
  function open() {
    if (dbp) { return dbp; }
    dbp = new Promise(function (res) {
      var req;
      try { req = root.indexedDB.open(DB, 1); } catch (e) { persistent = false; res(null); return; }
      req.onupgradeneeded = function () { var db = req.result; if (!db.objectStoreNames.contains(STORE)) { db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('profile', 'profile'); } };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { persistent = false; res(null); };
      req.onblocked = function () { persistent = false; res(null); };
    });
    return dbp;
  }
  function run(mode, fn) {
    return open().then(function (db) {
      if (!db) { return fn(null); }
      return new Promise(function (res, rej) {
        var t, r, out;
        try { t = db.transaction(STORE, mode); r = fn(t.objectStore(STORE)); } catch (e) { rej(e); return; }
        if (r) { r.onsuccess = function () { out = r.result; }; }
        t.oncomplete = function () { res(out); };
        t.onerror = t.onabort = function () { rej(new Error(T('Could not save on this device. Storage may be full: remove some photos or save a backup.', 'No se pudo guardar en este dispositivo. El espacio puede estar lleno: quite algunas fotos o guarde una copia.'))); };
      });
    });
  }
  function remember(rec) {
    if (!rec) { return rec; }
    if (!cache[rec.id]) { cacheOrder.push(rec.id); }
    cache[rec.id] = rec;
    while (cacheOrder.length > CACHE_MAX) { delete cache[cacheOrder.shift()]; }
    return rec;
  }
  function put(rec) { return run('readwrite', function (st) { if (!st) { mem[rec.id] = rec; return null; } return st.put(rec); }).then(function () { return remember(rec); }); }
  function get(id) {
    if (!id) { return Promise.resolve(null); }
    if (cache[id]) { return Promise.resolve(cache[id]); }
    return run('readonly', function (st) { return st ? st.get(id) : null; }).then(function (r) { return remember(r || mem[id] || null); });
  }
  function getMany(ids) { return Promise.all((ids || []).map(get)).then(function (a) { return a.filter(Boolean); }); }
  function del(ids) {
    ids = [].concat(ids || []).filter(Boolean);
    ids.forEach(function (id) { delete mem[id]; delete cache[id]; });
    return run('readwrite', function (st) { if (st) { ids.forEach(function (id) { st.delete(id); }); } return null; });
  }
  function all() { return run('readonly', function (st) { return st ? st.getAll() : null; }).then(function (a) { return (a || []).concat(Object.keys(mem).map(function (k) { return mem[k]; })); }); }
  function clearAll() { mem = {}; cache = {}; cacheOrder = []; return run('readwrite', function (st) { return st ? st.clear() : null; }); }
  function delProfile(p) { return all().then(function (a) { return del(a.filter(function (x) { return x.profile === p; }).map(function (x) { return x.id; })); }); }
  function usage() { return all().then(function (a) { return { count: a.length, bytes: a.reduce(function (s, x) { return s + Math.round((x.data || '').length * 0.75); }, 0) }; }); }

  /* ---------- reading, shrinking and stamping ---------- */
  function stampTime(d) { return TN.dates.today(d) + ' ' + TN.util.pad2(d.getHours()) + ':' + TN.util.pad2(d.getMinutes()); }
  /* draw any image source (bitmap or canvas) onto a JPEG with a date strip along the bottom */
  function render(src, o) {
    var w = src.width, h = src.height, s = Math.min(1, MAX_SIDE / Math.max(w, h)), c = root.document.createElement('canvas'), g, strip, fs, text, data;
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0, c.width, c.height);
    strip = Math.max(20, Math.round(Math.min(c.width, c.height) * 0.06)); fs = Math.round(strip * 0.52);
    text = 'Added ' + o.added + (o.taken ? '  ·  Camera date ' + o.taken : '') + (o.label ? '  ·  ' + o.label : '');
    g.font = '600 ' + fs + 'px system-ui, Segoe UI, Arial, sans-serif';
    while (fs > 9 && g.measureText(text).width > c.width - strip) { fs--; g.font = '600 ' + fs + 'px system-ui, Segoe UI, Arial, sans-serif'; }
    g.fillStyle = 'rgba(8, 20, 22, 0.72)'; g.fillRect(0, c.height - strip, c.width, strip);
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.fillText(text, Math.round(strip / 2), c.height - strip / 2);
    data = c.toDataURL('image/jpeg', 0.82);
    return { id: TN.uid(), data: data, mime: 'image/jpeg', addedAt: o.added, taken: o.taken || '', fileDate: o.fileDate || '', label: o.label || '', w: c.width, h: c.height, hash: TN.backup.sha256(data) };
  }
  function fromFile(file, label, profile) {
    if (!file) { return Promise.reject(new Error(T('Choose a photo first.', 'Elija una foto primero.'))); }
    if (!/^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type)) { return Promise.reject(new Error(T('Choose a picture file (JPG, PNG or WebP).', 'Elija un archivo de imagen (JPG, PNG o WebP).'))); }
    if (file.size > MAX_IN) { return Promise.reject(new Error(T('That picture is over 30 MB. Choose a smaller one.', 'Esa imagen pesa más de 30 MB. Elija una más pequeña.'))); }
    if (!root.createImageBitmap || !file.arrayBuffer) { return Promise.reject(new Error(T('This browser cannot read pictures here.', 'Este navegador no puede leer imágenes aquí.'))); }
    return file.arrayBuffer().then(function (buf) {
      var taken = TN.exif.dateTaken(new Uint8Array(buf, 0, Math.min(buf.byteLength, 262144)));
      return root.createImageBitmap(new root.Blob([buf], { type: file.type })).then(function (bmp) {
        var rec = render(bmp, { added: stampTime(new Date()), taken: taken, label: label, fileDate: file.lastModified ? stampTime(new Date(file.lastModified)) : '' });
        if (bmp.close) { bmp.close(); }
        rec.profile = profile;
        return put(rec);
      }, function () { throw new Error(T('Could not read that picture.', 'No se pudo leer esa imagen.')); });
    });
  }

  TN.photos = { put: put, get: get, getMany: getMany, del: del, all: all, clearAll: clearAll, delProfile: delProfile, usage: usage, render: render, fromFile: fromFile, stampTime: stampTime,
    persistent: function () { return open().then(function () { return persistent; }); } };
})(typeof window !== 'undefined' ? window : globalThis);
