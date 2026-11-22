/* Stark Homeroom. The interface. Every record stays in this browser on this computer: no network, no account,
   no analytics. Portfolio files live in the browser's own file store (IndexedDB) on this computer too. */
(function () {
  'use strict';
  const SHR = window.SHR, L = SHR.lib, CAT = SHR.catalog;
  const KEY = 'stark-homeroom-v1', THEME_KEY = 'stark-homeroom-theme', FILE_DB = 'stark-homeroom-files';
  const ROUTES = [['home', 'Home'], ['insights', 'Insights'], ['learners', 'Learners'], ['lessons', 'Lessons'], ['plan', 'Assignments'], ['attendance', 'Attendance'], ['hours', 'Hours'], ['courses', 'Courses'], ['grades', 'Grade book'], ['portfolio', 'Portfolio'], ['reports', 'Reports'], ['states', 'States'], ['safety', 'Backup']];
  const ALIAS = { calendar: 'lessons', rubrics: 'plan', standards: 'grades', notes: 'learners', collect: 'portfolio', transcript: 'reports', hoursreport: 'reports', portreport: 'reports', yearsummary: 'reports' };
  const TITLES = { calendar: 'Calendar', rubrics: 'Rubric library', standards: 'Skills', notes: 'Private notes', collect: 'From the Stark apps', transcript: 'Transcript', hoursreport: 'Attendance and hours report', portreport: 'Portfolio report', yearsummary: 'Year summary', reports: 'Progress report', states: 'State requirements' };
  let S = L.emptyState(), storageOk = true, errs = [], safe = null, lastGood = '', recovered = false, filesAvailable = true;
  const ui = { batches: [], draft: null, grade: null, cal: null, rosterMsg: [], confirm: '', restore: null };

  /* ---------- helpers ---------- */
  const $ = s => document.querySelector(s);
  function h(tag, attrs) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    const add = c => { if (Array.isArray(c)) c.forEach(add); else if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); };
    for (let i = 2; i < arguments.length; i++) add(arguments[i]);
    return e;
  }
  const btn = (text, fn, cls, extra) => h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick: fn }, extra || {}), text);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  const nowIso = () => { const n = new Date(); return today() + 'T' + ('0' + n.getHours()).slice(-2) + ':' + ('0' + n.getMinutes()).slice(-2); };
  const nowSec = () => nowIso() + ':' + ('0' + new Date().getSeconds()).slice(-2);
  const nice = iso => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
  const pctText = p => (p === null || p === undefined ? '-' : Math.round(p) + '%');
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  let toastT = 0;
  /* success: a polite toast that waits while hovered. Failure (bad): an assertive alert bar that stays until dismissed. */
  function toast(msg, bad) {
    if (bad) { const a = $('#alerts'); a.replaceChildren(h('span', { class: 'grow' }, msg), h('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => a.replaceChildren() }, 'Dismiss')); return; }
    const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(hideToast, 6000);
  }
  function hideToast() { const t = $('#toast'); if (t.matches(':hover')) { toastT = setTimeout(hideToast, 1500); return; } t.classList.remove('on'); }
  /* every save stamps the records (rev and changed, for the rollback guard), writes, reads back, and on failure keeps a
     bar on screen until a later save works: it never fails silently */
  function save() {
    if (safe) return false;
    const was = storageOk; S.rev = (S.rev || 0) + 1; S.changed = nowSec();
    try { const r = L.storeSave(localStorage, KEY, S, lastGood); storageOk = r.ok; lastGood = r.good; } catch (e) { storageOk = false; }
    saveBar();
    if (was && !storageOk) toast('Your last change was not saved. The browser\'s storage may be full or blocked. Download a backup now.', true);
    if (storageOk) MIRROR.soon();
    return storageOk;
  }
  function saveBar() {
    const b = $('#savebar'); if (!b) return;
    if (storageOk) { if (!b.hidden) { b.hidden = true; b.replaceChildren(); toast('Saving works again.'); } return; }
    if (!b.hidden) return;
    b.replaceChildren(h('b', null, 'Not saved. '), 'This browser is not keeping your changes (storage full, a private window or blocked site data). ', btn('Download a backup now', () => downloadBackup(), 'btn-small'), ' ', h('a', { href: '#/safety' }, 'Backup page'));
    b.hidden = false;
  }
  function downloadBackup() { const iso = nowIso(); S.lastBackup = iso; save(); download('stark-homeroom-backup-' + slug(S.classroom.name || 'family') + '-' + today() + '.json', JSON.stringify(L.buildBackup(S, iso), null, 1), 'application/json'); toast('Backup saved to your downloads folder.'); }
  function load() {
    safe = null; recovered = false; storageOk = true;
    try {
      const r = L.storeLoad(localStorage, KEY); S = r.state; lastGood = r.good;
      if (r.mode === 'safe') safe = { raw: r.raw, bak: r.rawBak };
      else if (r.mode === 'recovered') { recovered = true; try { if (r.raw.length < 2 * 1024 * 1024) localStorage.setItem(KEY + '.corrupt', r.raw); localStorage.setItem(KEY, r.good); } catch (e) { storageOk = false; } }
    } catch (e) { S = L.emptyState(); }
  }
  function downloadBlob(name, blob) {
    const u = URL.createObjectURL(blob);
    const a = h('a', { href: u, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000);
  }
  const download = (name, text, type) => downloadBlob(name, new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
  async function copy(text, area) {
    try { await navigator.clipboard.writeText(text); toast('Copied.'); return; } catch (e) { /* fall through */ }
    try { area.focus(); area.select(); document.execCommand('copy'); toast('Copied.'); } catch (e) { toast('Select the text and copy it with Ctrl+C.', true); }
  }
  const field = (label, input, id) => [h('label', { for: id }, label), input];
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'family';
  const get = (a, sid) => (S.grades[a.id] || {})[sid] || { scores: {}, comment: '' };
  const nameOf = sid => (S.students.find(s => s.id === sid) || {}).name || '';
  const tabs = (list, key) => h('nav', { class: 'tabs', 'aria-label': 'Sections' }, list.map(t => h('a', { href: '#/' + t[0], 'aria-current': t[0] === key ? 'page' : null }, t[1])));
  function printNodes(nodes) {
    const pa = $('#print-area'); pa.replaceChildren(...nodes);
    const clear = () => { pa.replaceChildren(); window.removeEventListener('afterprint', clear); }; window.addEventListener('afterprint', clear);
    try { window.print(); } catch (e) { toast('Printing is not available here.', true); clear(); }
  }
  const schoolLine = () => [S.classroom.name, S.classroom.termName, S.classroom.teacher].filter(Boolean).join(' · ');
  const sheet = (title, sub, body) => h('article', { class: 'report' }, h('div', { class: 'rh' }, h('div', null, h('h1', null, title), sub ? h('small', null, sub) : null)), body, h('div', { class: 'foot' }, 'Prepared with Stark Homeroom on ' + nice(today()) + '.'));
  const meter = (value, goal, label) => h('span', { class: 'meter' }, h('progress', { max: goal, value: Math.min(value, goal), 'aria-label': label + ': ' + value + ' of ' + goal }), h('span', { class: 'small' }, Math.round(100 * value / goal) + '%'));
  /* the school year from the Home page, or every date when it is not set */
  function yearRange() {
    const c = S.classroom;
    if (c.termStart && c.termEnd && c.termEnd >= c.termStart) return { from: c.termStart, to: c.termEnd, label: (c.termName || 'This school year') + ': ' + nice(c.termStart) + ' to ' + nice(c.termEnd) };
    return { from: '', to: '', label: 'All dates (set your school year on the Home page)' };
  }
  function yearLabel() {
    const c = S.classroom;
    if (/^\d{4}-\d{2,4}$/.test(c.termName || '')) return c.termName;
    const base = c.termStart || today(), y = +base.slice(0, 4), m = +base.slice(5, 7);
    const a = m >= 7 ? y : y - 1; return a + '-' + String(a + 1).slice(-2);
  }
  function useRubric(r) { ui.draft = blankDraft(); ui.draft.rubric = L.rubricText(r.criteria); ui.draft.levels = L.levelsMap(r.criteria); if (location.hash === '#/plan') render(); else location.hash = '#/plan'; }

  /* ---------- the browser's own file store for portfolio files (IndexedDB, this computer only) ---------- */
  const FILES = (() => {
    let dbp = null;
    function db() {
      if (!dbp) dbp = new Promise((res, rej) => { try { const r = indexedDB.open(FILE_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
      return dbp;
    }
    const tx = (mode, fn) => db().then(d => new Promise((res, rej) => { const t = d.transaction('files', mode), req = fn(t.objectStore('files')); t.oncomplete = () => res(req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('The browser refused to store the file (it may be out of space).')); }));
    return { put: (k, v) => tx('readwrite', s => s.put(v, k)), get: k => tx('readonly', s => s.get(k)), del: k => tx('readwrite', s => s.delete(k)), clear: () => tx('readwrite', s => s.clear()), keys: () => tx('readonly', s => s.getAllKeys()), ok: () => db().then(() => true, () => false) };
  })();
  /* ---------- autosave to a file the parent picks (File System Access API, Chrome and Edge; feature-detected) ----------
     After each verified save the family backup is rewritten into that one file, at most every 1.2 s. The browser writes
     to a temporary copy and swaps it in on close, so the file is never left half-written. The file handle is kept in
     the browser's own storage; after a restart the browser asks once before writing again. */
  const MIRROR = (() => {
    const can = typeof window.showSaveFilePicker === 'function' && typeof indexedDB !== 'undefined';
    const st = { handle: null, name: '', at: '', err: '', perm: '', t: 0, busy: false, again: false, held: false };
    let hdb = null, statusEl = null;
    const store = (mode, fn) => {
      if (!hdb) hdb = new Promise((res, rej) => { try { const r = indexedDB.open('stark-homeroom-mirror', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
      return hdb.then(d => new Promise((res, rej) => { const t = d.transaction('h', mode), q = fn(t.objectStore('h')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
    };
    /* an empty or sample record book is never copied over the file: after "Clear everything", a cleared browser or the
       sample family, the file keeps the last real records */
    const blank = () => !!S.demo || (!S.students.length && !S.assignments.length && !(S.hours || []).length && !(S.portfolio || []).length);
    const text = () => !st.handle ? '' : st.perm !== 'granted' ? 'Autosave to ' + st.name + ' is paused until you allow it again.' : st.err ? 'Autosave to ' + st.name + ' failed: ' + st.err : st.held ? 'Autosave is holding: ' + st.name + ' keeps your last real records, because an empty or sample record book is never copied over it.' : 'Every change is copied to ' + st.name + (st.at ? ' (last copy ' + st.at.slice(11) + ').' : '.');
    const paint = () => { if (statusEl && document.contains(statusEl)) { statusEl.textContent = text(); statusEl.classList.toggle('bad', !!st.err || (!!st.handle && st.perm !== 'granted')); } };
    async function write() {
      if (!st.handle || st.perm !== 'granted' || safe) return;
      st.held = blank(); if (st.held) { paint(); return; }
      if (st.busy) { st.again = true; return; }
      st.busy = true;
      try { const w = await st.handle.createWritable(); await w.write(JSON.stringify(L.buildBackup(S, nowIso()), null, 1)); await w.close(); st.at = nowSec(); st.err = ''; }
      catch (e) {
        const first = !st.err; st.err = e && e.name === 'NotAllowedError' ? 'permission to write the file was withdrawn.' : 'the file could not be written' + (e && e.message ? ' (' + e.message + ')' : '') + '.';
        if (e && e.name === 'NotAllowedError') st.perm = 'prompt';
        if (first) toast('Autosave to ' + st.name + ' failed: ' + st.err + ' Your records are still saved in this browser.', true);
      }
      st.busy = false; paint();
      if (st.again) { st.again = false; soon(); }
    }
    function soon() { if (!st.handle || st.perm !== 'granted') return; clearTimeout(st.t); st.t = setTimeout(write, 1200); }
    async function choose() {
      try {
        const fh = await window.showSaveFilePicker({ suggestedName: 'stark-homeroom-autosave-' + slug(S.classroom.name || 'family') + '.json', types: [{ description: 'Stark Homeroom backup', accept: { 'application/json': ['.json'] } }] });
        st.handle = fh; st.name = fh.name; st.perm = 'granted'; st.err = '';
        try { await store('readwrite', s => s.put(fh, 'file')); } catch (e) { /* works for this visit only */ }
        await write(); if (!st.err) toast(st.held ? 'Autosave is ready. It starts copying once you add your own records.' : 'Autosave is on: every change is copied to ' + fh.name + '.');
      } catch (e) {
        if (!e || e.name !== 'AbortError') toast(e && e.name === 'SecurityError' ? 'This page cannot open a save dialog here (for example inside an embedded player). Open Homeroom in its own tab, or use the offline version.' : 'Autosave could not start: ' + (e && e.message || 'unknown problem') + '.', true);
      }
      render();
    }
    async function resume() { if (!st.handle) return; try { st.perm = await st.handle.requestPermission({ mode: 'readwrite' }); } catch (e) { st.perm = 'denied'; } if (st.perm === 'granted') { st.err = ''; await write(); } render(); }
    async function stop() { clearTimeout(st.t); Object.assign(st, { handle: null, name: '', at: '', err: '', perm: '', held: false }); try { await store('readwrite', s => s.delete('file')); } catch (e) { /* nothing kept */ } toast('Autosave is off. The file you chose stays where it is.'); render(); }
    async function init() {
      if (!can) return;
      try { const fh = await store('readonly', s => s.get('file')); if (fh && typeof fh.queryPermission === 'function') { st.handle = fh; st.name = fh.name; st.perm = await fh.queryPermission({ mode: 'readwrite' }); if (st.perm === 'granted') soon(); render(); } } catch (e) { /* none kept */ }
    }
    function card() {
      const box = h('div', { class: 'card', id: 'mirror-card' }, h('h2', null, 'Autosave to a file'));
      if (!can) { box.append(h('p', { class: 'muted' }, 'This browser cannot keep a file up to date by itself (Chrome and Edge on a computer can). Here, download a backup now and then.')); return box; }
      statusEl = h('div', { class: 'notice', role: 'status', id: 'mirror-status', hidden: !st.handle }); paint();
      box.append(h('p', { class: 'muted' }, 'Pick a file once, for example in a folder your computer backs up. After every change Homeroom rewrites that file with the full family backup, so a cleared browser never costs you more than the last second of work. An empty or sample record book is never copied over it. The file is the plain (unencrypted) backup: keep it in a private folder. Restore it like any backup.'), statusEl,
        h('div', { class: 'row' }, !st.handle ? btn('Choose an autosave file', choose) : st.perm !== 'granted' ? btn('Resume autosave to ' + st.name, resume) : btn('Copy now', () => { clearTimeout(st.t); write(); }, 'btn-small'),
          st.handle ? btn('Stop autosave', stop, 'btn-ghost btn-small') : null));
      return box;
    }
    return { can, soon, init, card, st };
  })();
  /* installable app: the service worker (sw.js) keeps only this app's own files, and only when served from a web address */
  const PWA = { prompt: null };
  function installCard() {
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches, served = /^https?:$/.test(location.protocol), framed = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
    const say = PWA.prompt ? 'Install Homeroom as an app with its own window and icon. It then opens with no connection at all.' : standalone ? 'You are using the installed app. It opens with no connection.' : framed ? 'Inside an embedded player the page cannot be installed. Open Homeroom in its own tab to install it.' : served ? 'Your browser can install this page from its menu (Install app, or Add to Home Screen). Once installed it opens with no connection.' : 'Opened from a file on this computer, so it already works offline. Installing as an app needs Homeroom served from a web address.';
    return h('div', { class: 'card', id: 'install-card' }, h('h2', null, 'Use it like an app'), h('p', { class: 'muted' }, say),
      PWA.prompt ? btn('Install Homeroom', async () => { const p = PWA.prompt; PWA.prompt = null; try { await p.prompt(); const c = await p.userChoice; toast(c && c.outcome === 'accepted' ? 'Installing Homeroom.' : 'Not installed.'); } catch (e) { toast('The browser did not install it.', true); } render(); }) : null,
      h('p', { class: 'small muted' }, 'The app keeps a copy of its own files only. Your records stay in this browser\'s storage, exactly as before.'));
  }
  async function sha256(buf) {
    try { if (window.crypto && crypto.subtle) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf)); return Array.from(d, b => ('0' + b.toString(16)).slice(-2)).join(''); } } catch (e) { /* fall back */ }
    return L.sha256(new Uint8Array(buf));
  }
  async function makeThumb(blob, id) {
    try {
      if (typeof createImageBitmap !== 'function') return;
      const bmp = await createImageBitmap(blob), k = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
      await FILES.put('t' + id, c.toDataURL('image/jpeg', 0.82));
    } catch (e) { /* no thumbnail; the file itself is kept */ }
  }
  function saveFile(meta) {
    FILES.get(meta.id).then(v => { if (!v) toast('This file is not on this computer. Restore it from a portfolio zip on the Backup page.', true); else downloadBlob(meta.name, new Blob([v.data], { type: L.safeType(v.type) })); }).catch(() => toast('This browser could not read the file.', true));
  }
  async function portfolioZip(sids) {
    const blobs = {};
    for (const p of S.portfolio) { if (p.file && sids.indexOf(p.sid) >= 0) { try { const v = await FILES.get(p.file.id); if (v) blobs[p.file.id] = new Uint8Array(v.data); } catch (e) { /* listed as missing */ } } }
    const r = L.portfolioZip(S, sids, blobs, nowIso());
    downloadBlob('portfolio-' + slug(sids.length === 1 ? nameOf(sids[0]) : S.classroom.name || 'family') + '-' + today() + '.zip', new Blob([r.zip], { type: 'application/zip' }));
    toast('Saved ' + plural(r.count, 'piece') + ' with ' + plural(r.files, 'file') + (r.missing.length ? '; ' + r.missing.length + ' file(s) were not on this computer' : '') + '.');
  }
  async function restorePortfolio(f) {
    if (f.size > 200 * 1024 * 1024) throw new Error('That zip is bigger than 200 MB. Save the portfolio in smaller parts (one learner at a time).');
    const r = await L.readPortfolioZip(new Uint8Array(await f.arrayBuffer()), inflate);
    if (!r.ok) throw new Error(r.error);
    let put = 0, added = 0, skipped = 0;
    for (const x of r.files) {
      const it = x.item, f0 = it.file, mine = S.portfolio.find(p => p.file && p.file.id === x.id && p.file.sha === f0.sha);
      let id = x.id;
      if (!mine) {
        const m = L.matchStudent(S.students, it.learner);
        if (!m || S.portfolio.some(p => p.file && p.file.sha === f0.sha && p.sid === m.id)) { skipped++; continue; }
        if (S.portfolio.some(p => p.file && p.file.id === id)) id = L.freshId('f', S.portfolio.filter(p => p.file).map(p => p.file.id));
        try { L.addPortfolioItem(S, { sid: m.id, date: it.date, title: it.title, subject: it.subject, note: it.note, from: it.from, file: { id, name: f0.name, type: f0.type, size: x.data.length, sha: f0.sha } }); added++; } catch (e) { skipped++; continue; }
      }
      await FILES.put(id, { name: f0.name, type: L.safeType(f0.type), data: x.data.buffer.slice(x.data.byteOffset, x.data.byteOffset + x.data.length) });
      if (L.imageType(f0.type)) await makeThumb(new Blob([x.data], { type: f0.type }), id);
      put++;
    }
    save();
    return { put, added, skipped, problems: r.problems };
  }
  async function inflate(u8, limit) {
    if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot open zip files; use a current Chrome, Edge, Firefox or Safari');
    const rd = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let n = 0;
    for (;;) { const r = await rd.read(); if (r.done) break; n += r.value.length; if (n > limit) { await rd.cancel(); throw new Error('the zip is damaged'); } parts.push(r.value); }
    const out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
  }

  const X = { h, btn, field, L, CAT, ui, save, render: () => render(), toast, download, copy, nice, today, slug, pctText, printNodes, tabs, plural, useRubric, sheet, schoolLine, meter, yearRange, yearLabel, st: () => S,
    FILES, sha256, makeThumb, saveFile, portfolioZip, filesOk: () => filesAvailable, STATES: SHR.states, downloadBlob, nowIso, flag, unflag };
  const XV = SHR.extViews(X);
  X.whoChecks = XV.whoChecks;
  const HV = SHR.homeViews(X);
  const RV = SHR.reportViews(X, HV);
  const IV = SHR.insightViews(X);
  const opt = (v, text, sel) => h('option', { value: v, selected: v === sel }, text);

  /* ---------- Home ---------- */
  function vHome() {
    const c = S.classroom, td = today(), box = h('div'), yr = yearRange();
    const setf = (k, el) => el.addEventListener('change', () => { c[k] = (k === 'termStart' || k === 'termEnd') ? (L.isoOk(el.value) ? el.value : '') : L.clip(el.value, k === 'termName' ? 40 : 60); save(); render(); });
    const mk = (k, label, type, ph) => { const el = h('input', { type: type || 'text', id: 'c-' + k, value: c[k], maxlength: type ? null : 60, autocomplete: 'off', placeholder: ph || null }); setf(k, el); return field(label, el, 'c-' + k); };
    const stSel = h('select', { id: 'c-state' }, opt('', 'Another state, or not set', c.state), SHR.states.list.map(s => opt(s.code, s.name, c.state)));
    stSel.addEventListener('change', () => { c.state = stSel.value; save(); render(); });
    const goal = (k, label, max) => { const el = h('input', { type: 'number', id: 'g-' + k, min: 0, max, value: S.goals[k] || '', placeholder: 'none' }); el.addEventListener('change', () => { S.goals[k] = Math.max(0, Math.min(max, parseInt(el.value, 10) || 0)); save(); render(); }); return field(label, el, 'g-' + k); };
    const days = S.students.reduce((n, s) => n + L.attendanceSummary(S, s.id, yr.from, yr.to).school, 0);
    const mins = S.students.reduce((n, s) => n + L.hoursSummary(S, s.id, yr.from, yr.to).total, 0);
    const earned = S.students.reduce((n, s) => n + L.creditSummary(S, s.id).earned, 0);
    box.append(h('h1', null, c.name || 'Your home school'), h('p', { class: 'muted lead' }, 'Plan the week, mark the days, log the hours and keep each child\'s best work, ready for the progress report and the transcript. Everything stays on this computer.'));
    if (!S.students.length && !S.assignments.length) box.append(h('div', { class: 'notice' }, h('b', null, 'Welcome. '), 'Start by adding your learners on the ', h('a', { href: '#/learners' }, 'Learners'), ' page, or ', btn('look around with a sample family', () => { S = SHR.demo.build(td); save(); toast('Sample family loaded. Clear it any time on the Backup page.'); render(); }, 'btn-small btn-ghost'), '.'));
    box.append(h('div', { class: 'grid' },
      h('div', { class: 'card stat' }, h('b', null, S.students.length), h('span', null, S.students.length === 1 ? 'learner' : 'learners')),
      h('div', { class: 'card stat' }, h('b', null, days), h('span', null, 'school days marked')),
      h('div', { class: 'card stat' }, h('b', null, L.hoursOf(mins)), h('span', null, 'hours logged')),
      h('div', { class: 'card stat' }, h('b', null, Math.round(earned * 100) / 100), h('span', null, 'credits earned'))));
    const dayRec = S.attendance[td], dc = L.dayCounts(S, td), lessons = L.plansOn(S, td);
    box.append(h('div', { class: 'grid' },
      h('div', { class: 'card' }, h('h2', null, 'Your home school'), mk('name', 'Home school name', null, 'Maple Grove Home School'), mk('teacher', 'Parent or teacher (signs the transcript)'), mk('termName', 'School year', null, '2026-27'),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, mk('termStart', 'Year starts', 'date')), h('div', { class: 'grow' }, mk('termEnd', 'Year ends', 'date'))),
        field('Your state', stSel, 'c-state'), h('div', { class: 'row' }, h('div', { class: 'grow' }, goal('days', 'Days goal for the year', 400)), h('div', { class: 'grow' }, goal('hours', 'Hours goal per learner', 5000))),
        c.state ? h('p', { class: 'small' }, h('a', { href: '#/states' }, 'What ' + SHR.states.list.find(s => s.code === c.state).name + '\'s rules say'), ' (information only)') : h('p', { class: 'small muted' }, 'Goals are optional. Set them if your state counts days or hours.')),
      h('div', { class: 'card' }, h('h2', null, 'Today'),
        h('p', null, h('a', { href: '#/attendance' }, 'Attendance'), ': ', dayRec ? [dc.P ? plural(dc.P, 'school day') : '', dc.H ? plural(dc.H, 'half day') : '', dc.T ? plural(dc.T, 'field trip') : '', dc.A ? dc.A + ' absent' : ''].filter(Boolean).join(', ') : 'not marked yet'),
        lessons.length ? h('ul', { class: 'list' }, lessons.map(p => h('li', null, h('div', null, h('a', { href: '#/lessons' }, p.title), h('div', { class: 'muted small' }, XV.whoText(p.who) + (p.objective ? ' · ' + p.objective : '')))))) : h('p', { class: 'muted' }, 'No lesson planned for today. ', h('a', { href: '#/lessons' }, 'Plan one'), '.'),
        h('p', null, btn('Log time', () => { location.hash = '#/hours'; }, 'btn-small'), ' ', btn('Add best work', () => { location.hash = '#/portfolio'; }, 'btn-small btn-ghost'))),
      S.students.length ? h('div', { class: 'card' }, h('h2', null, 'Each learner'), h('ul', { class: 'list' }, S.students.map(s => { const a = L.attendanceSummary(S, s.id, yr.from, yr.to), hs = L.hoursSummary(S, s.id, yr.from, yr.to);
        return h('li', null, h('div', { class: 'grow' }, h('b', null, s.name), s.grade ? h('span', { class: 'muted small' }, ' ' + L.gradeLabel(s.grade)) : null, h('div', { class: 'small muted' }, a.school + ' days, ' + L.hoursOf(hs.total) + ' hours')), S.goals.hours ? meter(L.hoursOf(hs.total), S.goals.hours, s.name + ' hours') : S.goals.days ? meter(a.school, S.goals.days, s.name + ' days') : null); })),
        h('p', { class: 'small muted' }, yr.label)) : null,
      h('div', { class: 'card' }, h('h2', null, 'Keep your records safe'),
        h('p', null, S.lastBackup ? 'Last backup: ' + S.lastBackup.slice(0, 10) + '.' : 'You have not saved a backup yet.'),
        h('p', { class: 'small muted' }, 'Homeroom keeps your family\'s records in this browser. Clearing browser data erases them, so save a backup file now and then.'),
        btn('Save a backup', () => { location.hash = '#/safety'; }, 'btn-ghost'))));
    return box;
  }

  /* ---------- Assignments ---------- */
  function blankDraft() { return { id: '', title: '', due: '', weight: 1, notes: '', rubric: '', levels: {}, who: new Set(), courseId: '', useQuill: false, prompt: '', wordTarget: '', intra: new Set(), world: new Set(), band: 'all', err: '' }; }
  function draftOf(a) { return { id: a.id, title: a.title, due: a.due, weight: a.weight, notes: a.notes, rubric: L.rubricText(a.rubric), levels: L.levelsMap(a.rubric), who: new Set(a.for), courseId: a.courseId, useQuill: !!a.quill, prompt: a.quill ? a.quill.prompt : '', wordTarget: a.quill && a.quill.wordTarget ? String(a.quill.wordTarget) : '', intra: new Set(a.intra), world: new Set(a.world), band: 'all', err: '' }; }
  function saveDraft() {
    const d = ui.draft, old = d.id ? S.assignments.find(a => a.id === d.id) : null;
    const title = L.clip(d.title, 120);
    if (!title) { d.err = 'Give the assignment a title.'; return false; }
    if (d.due && !L.isoOk(d.due)) { d.err = 'The due date should look like 2027-03-01.'; return false; }
    const rubric = L.rubricFromText(d.rubric, old ? old.rubric : [], d.levels);
    const quill = d.useQuill ? { prompt: d.prompt, wordTarget: d.wordTarget } : null;
    if (quill) { try { L.makeQuillAssignment(title, d.prompt, d.wordTarget, d.due, rubric.map(r => r.text), ''); } catch (e) { d.err = e.message; return false; } }
    const who = L.cleanFor(S, [...d.who], d.courseId);
    const body = { title, due: d.due, notes: L.clip(d.notes, 600), weight: Math.min(10, Math.max(0.5, parseFloat(d.weight) || 1)), rubric, quill: quill ? { prompt: L.clip(d.prompt, 5000), wordTarget: Math.max(0, parseInt(d.wordTarget, 10) || 0) } : null, intra: [...d.intra], world: [...d.world], for: who.for, courseId: who.courseId };
    if (old) {
      Object.assign(old, body);
      Object.keys(S.grades[old.id] || {}).forEach(sid => { const g = S.grades[old.id][sid]; if (!L.appliesTo(old, sid)) { delete S.grades[old.id][sid]; return; } Object.keys(g.scores).forEach(k => { if (!rubric.some(r => r.id === k)) delete g.scores[k]; }); });
    } else L.pushAssignment(S, body);
    return true;
  }
  function vPlan() {
    const box = h('div'), d = ui.draft;
    box.append(tabs([['plan', 'Assignments'], ['rubrics', 'Rubric library']], 'plan'), h('h1', null, 'Assignments'), h('p', { class: 'muted' }, 'Set a piece of work for one learner or several: a Quill writing task, IntraTheater lessons, World Engine lesson packs, and the rubric you will grade against. Link it to a course and its grade counts toward that course.'));
    if (d) {
      const f = (k, label, type, extra) => { const el = h('input', Object.assign({ type: type || 'text', id: 'd-' + k, value: d[k] }, extra || {})); el.addEventListener('input', () => { d[k] = el.value; }); return field(label, el, 'd-' + k); };
      const intraBox = h('div', { class: 'pick', role: 'group', 'aria-label': 'IntraTheater lessons' }), worldBox = h('div', { class: 'pick', role: 'group', 'aria-label': 'World Engine lesson packs' });
      const drawIntra = () => { intraBox.replaceChildren(...CAT.INTRA.filter(l => d.band === 'all' || l.band === d.band).map(l => h('label', null, h('input', { type: 'checkbox', checked: d.intra.has(l.id), onchange: e => { e.target.checked ? d.intra.add(l.id) : d.intra.delete(l.id); } }), h('span', null, l.title, ' ', h('span', { class: 'muted small' }, l.band + ', ' + l.kind))))); };
      drawIntra();
      CAT.WORLD.forEach(p => worldBox.append(h('label', null, h('input', { type: 'checkbox', checked: d.world.has(p.id), onchange: e => { e.target.checked ? d.world.add(p.id) : d.world.delete(p.id); } }), h('span', null, p.title, ' ', h('span', { class: 'muted small' }, p.minutes + ' min')))));
      const band = h('select', { id: 'd-band', 'aria-label': 'Filter lessons by band' }, ['all', 'K-2', '3-5', '6-8'].map(b => h('option', { value: b, selected: d.band === b }, b === 'all' ? 'All bands' : 'Band ' + b)));
      band.addEventListener('change', () => { d.band = band.value; drawIntra(); });
      const rub = h('textarea', { id: 'd-rubric', placeholder: 'Clear opening\nStrong ending\nAccuracy | 10\nUses evidence | 4 | READ.2' }); rub.value = d.rubric; rub.addEventListener('input', () => { d.rubric = rub.value; });
      const libs = L.libraryRubrics(S), from = h('select', { id: 'd-from' }, h('option', { value: '' }, 'Choose a rubric to copy in'), libs.map((r, i) => h('option', { value: String(i) }, r.title + (r.builtIn ? '' : ' (yours)'))));
      from.addEventListener('change', () => { const r = libs[+from.value]; if (!r) return; d.rubric = rub.value = L.rubricText(r.criteria); d.levels = L.levelsMap(r.criteria); });
      const notes = h('textarea', { id: 'd-notes', maxlength: 600 }); notes.value = d.notes; notes.addEventListener('input', () => { d.notes = notes.value; });
      const prompt = h('textarea', { id: 'd-prompt', maxlength: 5000, placeholder: 'What your learner will see in Stark Quill' }); prompt.value = d.prompt; prompt.addEventListener('input', () => { d.prompt = prompt.value; });
      const qbox = h('div', { hidden: !d.useQuill }, field('Prompt', prompt, 'd-prompt'), f('wordTarget', 'Word target (0 for none)', 'number', { min: 0, max: 1000000 }));
      const useQ = h('input', { type: 'checkbox', id: 'd-useq', checked: d.useQuill, onchange: e => { d.useQuill = e.target.checked; qbox.hidden = !d.useQuill; } });
      const course = h('select', { id: 'd-course' }, opt('', 'No course', d.courseId), S.courses.map(c => opt(c.id, nameOf(c.sid) + ': ' + c.title, d.courseId)));
      const whoBox = h('div', { hidden: !!d.courseId }, h('h3', null, 'Who is it for? ', h('span', { class: 'muted small' }, '(leave all unticked for every learner)')), XV.whoChecks(d.who, 'Learners for this assignment'));
      course.addEventListener('change', () => { d.courseId = course.value; whoBox.hidden = !!d.courseId; });
      box.append(h('div', { class: 'card', id: 'planform' }, h('h2', null, d.id ? 'Edit assignment' : 'New assignment'),
        d.err ? h('div', { class: 'notice bad', role: 'alert' }, d.err) : null,
        h('div', { class: 'row' }, h('div', { class: 'grow' }, f('title', 'Title', 'text', { maxlength: 120 })), h('div', { class: 'grow' }, f('due', 'Due date', 'date')), h('div', { class: 'grow' }, f('weight', 'Weight in the grade', 'number', { min: 0.5, max: 10, step: 0.5 }))),
        field('Course (optional; the work then belongs to that course\'s learner)', course, 'd-course'), whoBox,
        field('Start from the rubric library', from, 'd-from'),
        field('Rubric: one criterion per line, then optional "| max points" (default 4) and "| skill code"', rub, 'd-rubric'),
        field('Notes for you', notes, 'd-notes'),
        h('h3', null, 'Stark Quill'), h('label', null, useQ, ' Create a Quill assignment file for this'), qbox,
        h('h3', null, 'Stark IntraTheater lessons'), h('div', { class: 'row' }, h('label', { for: 'd-band' }, 'Show'), band), intraBox,
        h('h3', null, 'Stark World Engine lesson packs'), worldBox,
        h('div', { class: 'row' }, btn('Save assignment', () => { if (saveDraft()) { ui.draft = null; save(); toast('Assignment saved.'); } render(); }), btn('Cancel', () => { ui.draft = null; render(); }, 'btn-ghost'))));
    } else box.append(h('div', { class: 'row' }, btn('New assignment', () => { ui.draft = blankDraft(); render(); $('#d-title') && $('#d-title').focus(); })));
    if (!S.assignments.length) box.append(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'No assignments yet.')));
    S.assignments.slice().sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).forEach(a => {
      let qf = null; if (a.quill) { try { qf = L.quillFor(a, S.classroom.teacher); } catch (e) { qf = null; } }
      const course = a.courseId ? S.courses.find(c => c.id === a.courseId) : null;
      box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, a.title), h('span', { class: 'chip who-chip' }, XV.whoText(a.for)), course ? h('span', { class: 'chip' }, course.title) : null, a.due ? h('span', { class: 'chip' }, 'Due ' + nice(a.due)) : null, h('span', { class: 'chip' }, 'Weight ' + a.weight)),
        a.notes ? h('p', { class: 'muted' }, a.notes) : null,
        h('div', null, a.quill ? h('span', { class: 'chip' }, 'Quill assignment') : null, a.intra.map(id => h('span', { class: 'chip' }, 'IntraTheater: ' + (CAT.INTRA.find(l => l.id === id) || { title: id }).title)), a.world.map(id => h('span', { class: 'chip' }, 'World Engine: ' + (CAT.WORLD.find(p => p.id === id) || { title: id }).title))),
        h('p', { class: 'small muted' }, a.rubric.length ? 'Rubric: ' + a.rubric.map(r => r.text + ' (' + r.max + (r.std ? ', ' + r.std : '') + ')').join('; ') : 'No rubric yet. Add one to grade this work.'),
        h('div', { class: 'row' }, qf ? btn('Download Quill file', () => { const f = L.quillAssignmentFile(qf); download(f.filename, f.text, 'application/json'); toast('Saved ' + f.filename + '. Open it in Stark Quill.'); }, 'btn-small') : null,
          btn('Edit', () => { ui.draft = draftOf(a); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Edit ' + a.title }),
          a.rubric.length ? btn('Print rubric', () => printNodes([XV.rubricSheet(a.title, a.rubric)]), 'btn-ghost btn-small', { 'aria-label': 'Print the rubric for ' + a.title }) : null,
          a.rubric.length ? btn('Save rubric to library', () => { try { L.saveRubric(S, a.title, a.rubric); save(); toast('Saved to the rubric library.'); } catch (e) { toast(e.message, true); } }, 'btn-ghost btn-small', { 'aria-label': 'Save the rubric for ' + a.title + ' to the library' }) : null,
          ui.confirm === 'da:' + a.id ? [btn('Yes, delete it and its grades', () => { S.assignments = S.assignments.filter(x => x.id !== a.id); delete S.grades[a.id]; ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')]
            : btn('Delete', () => { ui.confirm = 'da:' + a.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Delete ' + a.title }))));
    });
    return box;
  }

  /* ---------- From the Stark apps (imports) ---------- */
  const KIND_LABEL = { 'intra-csv': 'IntraTheater progress CSV', 'intra-backup': 'IntraTheater class backup', 'world': 'World Engine reflection', 'math-result': 'Math result', 'math-csv': 'Math leaderboard', zip: 'Quill hand-in' };
  function prepRecords(res) {
    return (res.records || []).map(r => { const m = L.matchStudent(S.students, r.name); return Object.assign({}, r, { how: m ? m.how : '', choice: m ? m.id : (r.nameOk ? '+new' : '') }); });
  }
  async function readFile(f) {
    const b = { name: f.name, label: '', ok: false, error: '', problems: [], records: [], assign: null };
    try {
      if (/\.zip$/i.test(f.name)) {
        b.label = KIND_LABEL.zip;
        if (f.size > 100 * 1024 * 1024) { b.error = 'That file is too big.'; return b; }
        const v = await L.verifySubmission(new Uint8Array(await f.arrayBuffer()), inflate), p = L.parseQuillVerified(v);
        b.ok = p.ok; b.error = p.error; b.problems = p.ok ? [] : v.problems; b.records = prepRecords(p); return b;
      }
      if (f.size > 5 * 1024 * 1024) { b.error = 'That file is too big.'; return b; }
      const text = await f.text(), kind = L.classifyText(f.name, text);
      if (kind === 'home-backup') { b.label = 'Homeroom backup'; b.error = 'This is a Homeroom backup. Restore it on the Backup page.'; return b; }
      if (kind === 'quill-assign') { b.label = 'Quill assignment'; try { b.assign = L.readQuillAssignment(text); b.ok = true; } catch (e) { b.error = e.message; } return b; }
      if (!kind) { b.error = 'Homeroom does not recognise this file. It reads IntraTheater CSV and backup files, Quill hand-in zips and .quillassign files, World Engine reflection .txt files and Math result files.'; return b; }
      b.label = KIND_LABEL[kind]; const p = L.parseText(kind, text);
      b.ok = p.ok; b.error = p.error; b.problems = p.problems; b.records = prepRecords(p);
    } catch (e) { b.error = 'Could not read this file: ' + (e && e.message ? e.message : 'unknown error'); }
    return b;
  }
  async function takeFiles(files) { for (const f of Array.from(files).slice(0, 60)) ui.batches.push(await readFile(f)); render(); }
  function commit() {
    let added = 0, rejected = 0;
    const items = [];
    ui.batches.forEach(b => b.records.forEach(r => {
      if (!r.choice) return;
      let sid = r.choice;
      if (sid === '+new') { const before = S.students.length; L.addStudents(S, r.name); const s = S.students.find(x => x.name.toLowerCase() === r.name.toLowerCase()); if (!s) { rejected++; return; } sid = s.id; if (S.students.length > before) added++; }
      items.push({ sid, ev: r.ev });
    }));
    const imported = L.applyImport(S, items, today()); save(); ui.batches = [];
    toast('Brought in ' + plural(imported, 'result') + (added ? ', added ' + plural(added, 'learner') : '') + (rejected ? ', ' + rejected + ' not added' : '') + '. Add the best ones to the portfolio.'); render();
  }
  function vCollect() {
    const box = h('div'), input = h('input', { type: 'file', id: 'filepick', multiple: true, accept: '.csv,.json,.zip,.txt,.quillassign', 'aria-label': 'Choose result files', onchange: e => { takeFiles(e.target.files); } });
    const drop = h('div', { class: 'drop', id: 'drop' }, h('p', null, h('b', null, 'Drop result files here'), ' or choose them'), input, h('p', { class: 'small muted' }, 'IntraTheater progress CSV or class backup, Quill hand-in zips (checked for tampering), World Engine reflection .txt, Math result files. Files are read on this computer only.'));
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files) takeFiles(e.dataTransfer.files); });
    box.append(HV.portTabs('collect'), h('h1', null, 'From the Stark apps'), h('p', { class: 'muted' }, 'Bring in what your learners made in Stark IntraTheater, Quill, World Engine and Math. It shows in the grade book, and you can add the best of it to the portfolio.'), drop);
    ui.batches.forEach((b, bi) => {
      const card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { class: 'grow' }, b.name), b.label ? h('span', { class: 'chip' }, b.label) : null,
        b.ok ? h('span', { class: 'chip good' }, b.label === KIND_LABEL.zip ? 'Integrity check passed' : 'Read OK') : h('span', { class: 'chip bad' }, b.label === KIND_LABEL.zip ? 'Failed the check' : 'Not brought in'),
        btn('Discard', () => { ui.batches.splice(bi, 1); render(); }, 'btn-ghost btn-small', { 'aria-label': 'Discard ' + b.name })));
      if (b.error) card.append(h('div', { class: 'notice bad', role: 'alert' }, b.error));
      if (b.problems.length && !b.ok) card.append(h('ul', { class: 'small' }, b.problems.slice(0, 8).map(p => h('li', null, p))));
      else if (b.problems.length) card.append(h('ul', { class: 'small muted' }, b.problems.slice(0, 5).map(p => h('li', null, p))));
      if (b.assign) card.append(h('p', null, 'Assignment "', b.assign.title, '" with ', b.assign.rubric.length, ' rubric criteria', b.assign.due ? ', due ' + nice(b.assign.due) : '', '.'), btn('Add to Assignments', () => {
        const a = b.assign; L.pushAssignment(S, { title: a.title, due: a.due, notes: '', weight: 1, rubric: a.rubric.map(r => ({ id: r.id, text: r.text, max: 4 })), quill: { prompt: a.prompt, wordTarget: a.word_target }, intra: [], world: [] });
        save(); ui.batches.splice(bi, 1); toast('Added "' + a.title + '" to Assignments.'); render();
      }));
      if (b.records.length) {
        card.append(h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Name in file'), h('th', null, 'Learner'), h('th', null, 'What it holds'))),
          h('tbody', null, b.records.map(r => {
            const sel = h('select', { 'aria-label': 'Learner for ' + r.name }, h('option', { value: '' }, 'Skip this one'), r.nameOk ? h('option', { value: '+new', selected: r.choice === '+new' }, 'Add "' + r.name + '" as a new learner') : null, S.students.map(s => h('option', { value: s.id, selected: r.choice === s.id }, s.name)));
            sel.addEventListener('change', () => { r.choice = sel.value; });
            return h('tr', null, h('td', null, r.name || '(no name)', r.nameOk ? null : h('div', { class: 'small', title: 'Only first names and nicknames can be learners' }, h('span', { class: 'chip warn' }, 'not a first name'))), h('td', null, sel, r.how ? h('div', { class: 'small muted' }, 'matched by ' + r.how) : null), h('td', null, h('b', null, r.ev.label), h('div', { class: 'small muted' }, r.ev.detail)));
          })))));
      }
      box.append(card);
    });
    if (ui.batches.some(b => b.records.length)) box.append(h('div', { class: 'row' }, btn('Bring in the selected results', commit), h('span', { class: 'muted small' }, 'Bringing in the same file again replaces the older copy.')));
    const cols = ['intra', 'quill', 'world', 'math'];
    box.append(h('div', { class: 'card' }, h('h2', null, 'Brought in so far'), S.students.length ? h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Learner'), cols.map(c => h('th', { class: 'num' }, L.SOURCES[c])))),
      h('tbody', null, S.students.map(s => h('tr', null, h('td', null, s.name), cols.map(c => { const n = (S.evidence[s.id] || []).filter(e => e.source === c).length; return h('td', { class: 'num' }, n ? h('span', { class: 'chip good' }, n) : h('span', { class: 'muted' }, '-')); })))))) : h('p', { class: 'muted' }, 'Add learners first, then bring in their results.')));
    return box;
  }

  /* ---------- Grade book ---------- */
  const shownLearners = () => (ui.gradeSid && S.students.some(s => s.id === ui.gradeSid) ? S.students.filter(s => s.id === ui.gradeSid) : S.students);
  const shownWork = list => S.assignments.filter(a => list.some(s => L.appliesTo(a, s.id)));
  function cellNode(a, s) {
    if (!L.appliesTo(a, s.id)) return h('span', { class: 'na', title: 'Not set for ' + s.name }, '·');
    const r = L.rubricResult(a, get(a, s.id)), ev = L.assignmentEvidence(S, s.id, a);
    const sel = ui.grade && ui.grade.aid === a.id && ui.grade.sid === s.id;
    return h('button', { type: 'button', class: 'cell', 'aria-pressed': sel ? 'true' : 'false', 'aria-label': s.name + ', ' + a.title + ': ' + (r.pct === null ? 'not graded' : Math.round(r.pct) + ' percent'), onclick: () => { ui.grade = { aid: a.id, sid: s.id }; render(); } },
      h('b', { class: r.pct === null ? 'muted' : 'band-' + L.band(r.pct) }, pctText(r.pct)), ev.total ? h('small', null, ev.parts.filter(p => p.status === 'done').length + '/' + ev.total + ' in') : h('small', null, r.pct === null ? 'grade' : (r.complete ? '' : r.scored + '/' + r.total + ' scored')));
  }
  function gradeTable() {
    const ls = shownLearners(), as = shownWork(ls);
    return h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Learner'), as.map(a => h('th', { class: 'num', title: a.title }, a.title.length > 22 ? a.title.slice(0, 21) + '…' : a.title)), h('th', { class: 'num' }, 'Overall'))),
      h('tbody', null, ls.map(s => { const f = L.finalGrade(S, s.id); return h('tr', null, h('td', null, h('b', null, s.name), s.grade ? h('div', { class: 'small muted' }, L.gradeLabel(s.grade)) : null), as.map(a => h('td', { class: 'num' }, cellNode(a, s))),
        h('td', { class: 'num' }, f.pct === null ? h('span', { class: 'muted' }, '-') : [h('b', { class: 'band-' + f.band }, Math.round(f.pct) + '%'), h('div', { class: 'small muted' }, f.letter + ' · ' + f.band)])); })),
      ls.length > 1 ? h('tfoot', null, h('tr', null, h('th', null, 'Average'), as.map(a => h('th', { class: 'num' }, pctText(L.assignmentStats(S, a).mean))), h('th', { class: 'num' }, pctText(L.stats(ls.map(s => L.finalGrade(S, s.id).pct)).mean)))) : null));
  }
  function editor(tableBox) {
    const g = ui.grade, a = S.assignments.find(x => x.id === g.aid), s = S.students.find(x => x.id === g.sid);
    if (!a || !s || !L.appliesTo(a, s.id)) return h('div');
    const rec = () => { const m = S.grades[a.id] = S.grades[a.id] || {}; return m[s.id] = m[s.id] || { scores: {}, comment: '' }; };
    const live = h('b', { id: 'live' }), refresh = () => { const r = L.rubricResult(a, get(a, s.id)); live.textContent = r.pct === null ? 'Not graded yet' : Math.round(r.pct) + '%  ' + L.band(r.pct) + (r.complete ? '' : ' (' + r.scored + ' of ' + r.total + ' scored)'); live.className = r.pct === null ? 'muted' : 'band-' + L.band(r.pct); };
    const tidy = () => { const m = S.grades[a.id]; if (m && m[s.id] && !Object.keys(m[s.id].scores).length && !m[s.id].comment) delete m[s.id]; };
    const after = () => { tidy(); save(); refresh(); tableBox.replaceChildren(gradeTable()); };
    const mates = S.students.filter(x => L.appliesTo(a, x.id)), idx = mates.findIndex(x => x.id === s.id), ev = L.assignmentEvidence(S, s.id, a);
    const refl = (ev.parts.find(p => p.reflection) || {}).reflection;
    const comment = h('textarea', { id: 'g-comment', maxlength: 1000, placeholder: 'A comment for your learner' }); comment.value = get(a, s.id).comment;
    comment.addEventListener('input', () => { rec().comment = comment.value; after(); });
    const go = d => { const n = mates[idx + d]; if (n) { ui.grade = { aid: a.id, sid: n.id }; render(); } };
    const card = h('div', { class: 'card', id: 'editor' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, s.name, ' · ', a.title), btn('Previous', () => go(-1), 'btn-ghost btn-small', { disabled: idx <= 0 }), btn('Next learner', () => go(1), 'btn-ghost btn-small', { disabled: idx >= mates.length - 1 }), btn('Close', () => { ui.grade = null; render(); }, 'btn-ghost btn-small')),
      h('div', { class: 'row' }, live),
      a.rubric.length ? a.rubric.map(c => { const inp = h('input', { type: 'number', id: 'g-' + c.id, min: 0, max: c.max, step: 0.5, value: typeof get(a, s.id).scores[c.id] === 'number' ? get(a, s.id).scores[c.id] : '', 'aria-label': c.text + ' score out of ' + c.max });
        inp.addEventListener('input', () => { const m = rec(); if (inp.value === '') delete m.scores[c.id]; else { const v = parseFloat(inp.value); if (isFinite(v)) m.scores[c.id] = Math.min(c.max, Math.max(0, Math.round(v * 2) / 2)); } after(); });
        return h('div', { class: 'rubric-row' }, h('label', { for: 'g-' + c.id }, c.text, ' ', h('span', { class: 'muted small' }, 'out of ' + c.max)), inp); }) : h('div', { class: 'notice' }, 'This assignment has no rubric. Add criteria on the Assignments page to grade it.'),
      field('Comment', comment, 'g-comment'),
      ev.parts.length ? [h('h3', null, 'What came in from the Stark apps'), h('ul', { class: 'list' }, ev.parts.map(p => h('li', null, h('span', null, p.label, p.detail ? h('div', { class: 'small muted' }, p.detail) : null), h('span', { class: 'chip st-' + p.status }, p.status === 'done' ? 'In' : p.status === 'partial' ? 'Partly' : 'Not yet'))))] : null,
      refl ? [h('h3', null, 'Their reflection (Quill)'), h('pre', { class: 'note' }, refl)] : null);
    refresh(); return card;
  }
  function vGrades() {
    const box = h('div');
    const filter = h('select', { id: 'gb-filter', 'aria-label': 'Show the grade book for' }, opt('', 'Every learner', ui.gradeSid || ''), S.students.map(s => opt(s.id, s.name, ui.gradeSid || '')));
    filter.addEventListener('change', () => { ui.gradeSid = filter.value; ui.grade = null; render(); });
    box.append(tabs([['grades', 'Scores'], ['standards', 'Skills']], 'grades'), h('h1', null, 'Grade book'), h('div', { class: 'row' }, h('label', { for: 'gb-filter' }, 'Show'), filter, btn('Download grade book (CSV)', () => { download('gradebook-' + slug(S.classroom.name || 'family') + '.csv', L.gradebookCSV(S), 'text/csv;charset=utf-8'); }, 'btn-ghost', { disabled: !S.students.length || !S.assignments.length }),
      h('span', { class: 'muted small' }, 'Pick a cell to score the rubric. A dot means the work was not set for that learner. Overall is the weighted average of graded work.')));
    if (!S.students.length || !S.assignments.length) { box.append(h('div', { class: 'card' }, h('p', null, 'Add learners on the ', h('a', { href: '#/learners' }, 'Learners'), ' page and set work on the ', h('a', { href: '#/plan' }, 'Assignments'), ' page, then grade here.'))); return box; }
    const tableBox = h('div', { id: 'gradetable' }, gradeTable());
    box.append(tableBox); if (ui.grade) box.append(editor(tableBox));
    return box;
  }

  /* ---------- Calendar ---------- */
  function vCalendar() {
    const box = h('div'), c = S.classroom, td = today();
    if (!ui.cal) { const base = c.termStart && c.termStart > td ? c.termStart : td; ui.cal = { y: +base.slice(0, 4), m: +base.slice(5, 7) - 1 }; }
    const cal = ui.cal, items = L.calendarItems(S);
    const move = d => { const x = new Date(Date.UTC(cal.y, cal.m + d, 1)); cal.y = x.getUTCFullYear(); cal.m = x.getUTCMonth(); render(); };
    const title = new Date(Date.UTC(cal.y, cal.m, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const dn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const grid = L.monthGrid(cal.y, cal.m, 1);
    box.append(XV.lessonTabs('calendar'), h('h1', null, 'Calendar'), h('div', { class: 'row' }, btn('Previous', () => move(-1), 'btn-ghost btn-small'), h('h2', { id: 'cal-title', class: 'grow' }, title), btn('Today', () => { ui.cal = null; render(); }, 'btn-ghost btn-small'), btn('Next', () => move(1), 'btn-ghost btn-small')),
      h('div', { class: 'tablewrap' }, h('table', { class: 'cal' }, h('thead', null, h('tr', null, h('th', { class: 'wk' }, 'Wk'), dn.map(d => h('th', null, d)))),
        h('tbody', null, grid.map(w => { const wk = L.termWeek(S, w[0].iso) || L.termWeek(S, w[6].iso); return h('tr', null, h('td', { class: 'wk' }, wk ? 'W' + wk : ''), w.map(d => h('td', { class: (d.inMonth ? '' : 'out ') + (d.iso === td ? 'today' : '') }, h('div', { class: 'd' }, d.day), (items[d.iso] || []).map(it => h('span', { class: 'ev ev-' + it.kind }, it.title))))); })))));
    const tw = L.termWeeks(S);
    box.append(h('p', { class: 'muted small' }, tw ? (c.termName || 'The school year') + ' runs ' + nice(c.termStart) + ' to ' + nice(c.termEnd) + ' (' + tw + ' weeks).' : 'Set your school year on the Home page to see week numbers. Due dates and lessons appear here by themselves.'));
    const dt = h('input', { type: 'date', id: 'ev-date', value: td }), ti = h('input', { type: 'text', id: 'ev-title', maxlength: 80, placeholder: 'Museum trip, library day, holiday' }), kd = h('select', { id: 'ev-kind' }, [['other', 'Other'], ['test', 'Test'], ['trip', 'Trip'], ['holiday', 'Holiday']].map(k => h('option', { value: k[0] }, k[1])));
    const msg = h('div', { class: 'notice bad', role: 'alert', hidden: true });
    box.append(h('div', { class: 'card' }, h('h2', null, 'Add an event'), msg, h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Date', dt, 'ev-date')), h('div', { class: 'grow' }, field('Title', ti, 'ev-title')), h('div', null, field('Type', kd, 'ev-kind'))),
      btn('Add to calendar', () => { const t = L.clip(ti.value, 80); unflag(dt, ti); if (!L.isoOk(dt.value) || !t) { msg.textContent = !L.isoOk(dt.value) ? 'Pick a date for the event.' : 'Give the event a title.'; msg.hidden = false; const bad = !L.isoOk(dt.value) ? dt : ti; flag(bad, msg); bad.focus(); return; } if (S.events.length >= 300) { msg.textContent = 'The calendar is full.'; msg.hidden = false; return; }
        S.events.push({ id: L.freshId('e', S.events.map(x => x.id)), date: dt.value, title: t, kind: kd.value }); save(); render(); }),
      S.events.length ? h('ul', { class: 'list' }, S.events.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => h('li', null, h('span', null, nice(e.date) + ': ' + e.title, ' ', h('span', { class: 'chip' }, e.kind)), ui.confirm === 'de:' + e.id ? h('span', { class: 'row tight' }, btn('Yes, remove', () => { S.events = S.events.filter(x => x.id !== e.id); ui.confirm = ''; save(); render(); }, 'btn-danger btn-small'), btn('Keep', () => { ui.confirm = ''; render(); }, 'btn-ghost btn-small')) : btn('Remove', () => { ui.confirm = 'de:' + e.id; render(); }, 'btn-ghost btn-small', { 'aria-label': 'Remove ' + e.title })))) : null));
    return box;
  }

  /* ---------- Backup and restore ---------- */
  function vSafety() {
    const box = h('div'), msg = h('div', { class: 'notice bad', role: 'alert', hidden: true, id: 'safety-msg' });
    const pick = h('input', { type: 'file', id: 'restorepick', accept: '.json', 'aria-label': 'Choose a backup file', onchange: async e => {
      const f = e.target.files[0]; if (!f) return; msg.hidden = true;
      try { if (f.size > 20 * 1024 * 1024) throw new Error('That file is too big.'); const r = L.readBackup(JSON.parse(await f.text())); if (!r.ok) throw new Error(r.error); ui.restore = { name: f.name, state: r.state, note: r.note }; render(); }
      catch (err) { msg.textContent = err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message; msg.hidden = false; }
    } });
    const zpick = h('input', { type: 'file', id: 'zippick', accept: '.zip', 'aria-label': 'Choose a portfolio zip', onchange: async e => {
      const f = e.target.files[0]; if (!f) return; msg.hidden = true;
      try { const r = await restorePortfolio(f); toast('Restored ' + plural(r.put, 'file') + (r.added ? ' (' + r.added + ' new pieces)' : '') + (r.skipped ? '; ' + r.skipped + ' skipped' : '') + (r.problems.length ? '; ' + r.problems.length + ' failed the check' : '') + '.'); if (r.problems.length) { msg.textContent = 'Some files were not restored: ' + r.problems.slice(0, 3).join('; ') + '.'; msg.hidden = false; } render(); }
      catch (err) { msg.textContent = err && err.message ? err.message : 'That zip could not be read.'; msg.hidden = false; }
    } });
    const withFiles = S.portfolio.filter(p => p.file).length;
    box.append(h('h1', null, 'Backup and restore'), h('p', { class: 'muted' }, 'Your family\'s records live in this browser, on this computer, and nowhere else: Homeroom has no network access at all. A backup is one file you keep. It holds your children\'s records, private notes and any legal names you typed for transcripts, so keep it somewhere safe.'), msg,
      h('div', { class: 'card' }, h('h2', null, 'Save a backup'), h('p', null, S.lastBackup ? 'Last backup: ' + S.lastBackup.replace('T', ' ').slice(0, 16) + '.' : 'No backup saved yet.'),
        h('div', { class: 'row' }, btn('Download family backup', () => { downloadBackup(); render(); }),
          btn('Download grade book (CSV)', () => download('gradebook-' + slug(S.classroom.name || 'family') + '.csv', L.gradebookCSV(S), 'text/csv;charset=utf-8'), 'btn-ghost', { disabled: !S.students.length })),
        h('p', { class: 'small muted' }, 'The backup lists the portfolio pieces but not the files themselves, which can be large. Save those as a zip below.')),
      MIRROR.card(),
      IV.vaultCard(),
      h('div', { class: 'card' }, h('h2', null, 'Portfolio files'), h('p', null, plural(withFiles, 'piece') + ' with a file attached.'),
        h('div', { class: 'row' }, btn('Download every portfolio file (zip)', () => portfolioZip(S.students.map(s => s.id)), 'btn-small', { disabled: !S.portfolio.length })),
        field('Restore portfolio files from a zip (restore the backup first)', zpick, 'zippick'),
        h('p', { class: 'small muted' }, 'Every file is checked against the list inside the zip before it is restored. The zip has a folder per learner and a README, so an evaluator can read it without Homeroom.')),
      h('div', { class: 'card' }, h('h2', null, 'Restore from a backup'), h('p', { class: 'muted' }, 'This replaces the records on this computer with the ones in the file. Every name is checked again.'), field('Backup file', pick, 'restorepick'),
        ui.restore ? restorePreview() : null),
      h('div', { class: 'card' }, h('h2', null, S.demo ? 'Clear the sample family' : 'Start over'), h('p', { class: 'muted' }, 'Removes every learner, record and portfolio file from this browser. Save a backup first.'),
        ui.confirm === 'wipe' ? h('div', { class: 'row' }, btn('Yes, erase everything', () => { S = L.emptyState(); ui.confirm = ''; ui.grade = null; ui.batches = []; save(); FILES.clear().catch(() => {}); toast('Everything was erased.'); render(); }, 'btn-danger'), btn('Keep my records', () => { ui.confirm = ''; render(); }, 'btn-ghost')) : btn(S.demo ? 'Clear the sample family' : 'Clear everything', () => { ui.confirm = 'wipe'; render(); }, 'btn-danger')),
      h('div', { class: 'card' }, h('h2', null, 'Privacy'), h('ul', null, h('li', null, 'No account, no sign-in, no analytics, no advertising. Children\'s data stays on this computer.'), h('li', null, 'No network: the page is built so the browser refuses every outside connection.'), h('li', null, 'First names or nicknames for learners. A full legal name is only used on the transcript, and only if you type it.'), h('li', null, 'Saves are checked after writing and a last good copy is kept; backups and portfolio zips carry checksums that are verified before anything is restored. A checksum catches damage, not a deliberate edit: the encrypted vault refuses both.'),
          h('li', null, 'Records kept in this browser are not encrypted, like any website\'s stored data: anyone who can use this computer account can read them. Use your computer\'s disk encryption and its own account per adult, and the encrypted vault for any copy that leaves this computer.')),
        h('p', { class: 'small muted', id: 'version' }, 'Stark Homeroom ' + L.VERSION + '.')), installCard());
    return box;
  }
  /* what a restore would replace, side by side, and a guard against rolling back to an older backup by mistake */
  function restorePreview() {
    const r = ui.restore, c = L.backupCompare(S, r.state), when = s => (s ? s.replace('T', ' ').slice(0, 16) : '');
    const ack = h('input', { type: 'checkbox', id: 'rb-ack' }), go = btn(c.older ? 'Roll back to this older backup' : 'Replace my records with this backup', () => {
      if (c.older && !ack.checked) { ack.setAttribute('aria-invalid', 'true'); ack.focus(); return; }
      S = r.state; ui.restore = null; ui.grade = null; ui.draft = null; save(); toast('Backup restored.'); render();
    }, 'btn-danger', { 'aria-describedby': c.older ? 'rb-warn' : null });
    return h('div', { class: 'notice', id: 'restore-preview' }, h('p', null, h('b', null, r.name), ': home school "' + (r.state.classroom.name || 'unnamed') + '" (' + r.note + ').'),
      c.older ? h('div', { class: 'notice bad', role: 'alert', id: 'rb-warn' }, h('b', null, 'This backup is older than your records here. '), 'It was last changed ' + (when(c.fileChanged) || 'before Homeroom recorded change times') + '; the records on this computer changed ' + when(c.hereChanged) + '. Restoring it undoes every change made since.') : null,
      c.same ? h('p', { class: 'small' }, 'This backup matches the records on this computer, so restoring it changes nothing.') : null,
      h('div', { class: 'tablewrap' }, h('table', { id: 'rb-table' }, h('caption', { class: 'sr-only' }, 'What the restore replaces'), h('thead', null, h('tr', null, h('th', null, 'Records'), h('th', { class: 'num' }, 'On this computer'), h('th', { class: 'num' }, 'In the file'))),
        h('tbody', null, c.rows.map(x => h('tr', { class: x.file < x.here ? 'fewer' : null }, h('td', null, x.kind), h('td', { class: 'num' }, x.here), h('td', { class: 'num' }, x.file, x.file < x.here ? h('span', { class: 'chip bad' }, (x.file - x.here) + '') : null)))))),
      c.lost.length ? h('p', null, h('b', null, 'Learners not in the file: '), c.lost.join(', '), '. Their records here would be removed.') : null,
      c.gained.length ? h('p', null, h('b', null, 'Learners only in the file: '), c.gained.join(', '), '.') : null,
      c.older ? h('label', { class: 'check', for: 'rb-ack' }, ack, ' I understand this replaces newer records with older ones.') : null,
      h('div', { class: 'row' }, go, btn('Cancel', () => { ui.restore = null; render(); }, 'btn-ghost')));
  }

  /* ---------- shell ---------- */
  const VIEWS = { home: vHome, insights: IV.insights, learners: HV.learners, notes: XV.notes, lessons: XV.lessons, calendar: vCalendar, plan: vPlan, rubrics: XV.rubrics, attendance: XV.attendance, hours: HV.hours, courses: HV.courses,
    grades: vGrades, standards: XV.standards, portfolio: HV.portfolio, collect: vCollect, reports: HV.reports, transcript: HV.transcript, hoursreport: RV.hoursreport, portreport: RV.portreport, yearsummary: RV.yearsummary, states: HV.states, safety: vSafety };
  function render() {
    const route = (location.hash.replace(/^#\//, '').split('?')[0]) || 'home', key = VIEWS[route] ? route : 'home';
    const navKey = ALIAS[key] || key, nav = $('#nav'); nav.replaceChildren(...ROUTES.map(r => h('a', { href: '#/' + r[0], 'aria-current': r[0] === navKey ? 'page' : null }, r[1])));
    const main = $('#main'); main.replaceChildren();
    try { main.append(VIEWS[key]()); } catch (e) { errs.push(String(e && e.stack || e)); main.append(h('div', { class: 'notice bad' }, 'Something went wrong drawing this page: ' + e.message)); }
    if (S.demo) main.prepend(h('div', { class: 'notice demo', role: 'note', id: 'demo-note' }, h('b', null, 'Sample family. '), 'Every learner and record here is an example, so you can look around. ', h('a', { href: '#/safety' }, 'Clear it'), ' when you are ready to add your own family.'));
    if (recovered) main.prepend(h('div', { class: 'notice', role: 'status' }, 'The saved records could not be read, so the last good copy was restored. Check that your recent changes are there.'));
    if (safe) main.prepend(h('div', { class: 'notice bad', role: 'alert' }, h('b', null, 'Read-only mode. '), 'The saved records on this computer could not be read, so nothing will be saved or overwritten. You can save the raw data, or start fresh (the old data is kept in the browser as a separate copy). ',
      h('div', { class: 'row' }, btn('Export raw data', () => { download('stark-homeroom-raw-' + today() + '.txt', 'MAIN' + String.fromCharCode(10) + (safe.raw || '') + String.fromCharCode(10, 10) + 'LAST GOOD COPY' + String.fromCharCode(10) + (safe.bak || '') + String.fromCharCode(10)); }, 'btn-ghost btn-small'),
        btn('Start fresh', () => { try { localStorage.setItem(KEY + '.corrupt', safe.raw || ''); } catch (e) { /* ignore */ } safe = null; S = L.emptyState(); lastGood = ''; save(); render(); }, 'btn-ghost btn-small'))));
    saveBar();
    regions(main);
    document.title = (TITLES[key] || ROUTES.find(r => r[0] === key)[1]) + ' - Stark Homeroom';
  }
  /* wide tables scroll sideways: make each scroller a named, focusable region so keyboard users can pan it */
  function regions(root) {
    root.querySelectorAll('.tablewrap').forEach(w => {
      if (w.hasAttribute('role')) return;
      const card = w.closest('.card, .notice'), cap = w.querySelector('caption'), hd = card && card.querySelector('h2, h3');
      w.setAttribute('role', 'region'); w.tabIndex = 0; w.setAttribute('aria-label', ((cap || hd || {}).textContent || document.title.split(' - ')[0] || 'Table').trim() + ' (table)');
    });
  }
  /* links a field to the message that explains its error: aria-invalid plus aria-describedby (WCAG 3.3.1) */
  function flag(input, msg) {
    if (!input || !msg) return;
    if (!msg.id) msg.id = 'err-' + (input.id || L.rnd36(5));
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', ((input.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x.indexOf('err-') !== 0).concat([msg.id])).join(' '));
  }
  function unflag() { Array.from(arguments).forEach(i => { if (!i) return; i.removeAttribute('aria-invalid'); const d = (i.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x.indexOf('err-') !== 0).join(' '); if (d) i.setAttribute('aria-describedby', d); else i.removeAttribute('aria-describedby'); }); }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); });
  window.addEventListener('error', e => { errs.push(String(e.message)); });
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ } }
  (function init() {
    let t = null; try { t = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    setTheme(t);
    $('#theme').addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
    IV.palette({ routes: ROUTES.filter(r => r[0] !== 'insights').concat([['transcript', 'Transcript'], ['hoursreport', 'Attendance and hours report'], ['portreport', 'Portfolio report'], ['yearsummary', 'Year summary'], ['calendar', 'Calendar'], ['rubrics', 'Rubric library'], ['standards', 'Skills'], ['notes', 'Private notes'], ['collect', 'Bring in work from the Stark apps']]), actions: { theme: () => $('#theme').click(), backup: () => { location.hash = '#/safety'; } } });
    load(); render();
    FILES.ok().then(v => { if (!v) { filesAvailable = false; render(); } });
    MIRROR.init();
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); PWA.prompt = e; if (/safety/.test(location.hash)) render(); });
    window.addEventListener('appinstalled', () => { PWA.prompt = null; toast('Homeroom is installed. It opens with no connection.'); });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { /* runs as a normal page */ });
  })();
  SHR.app = { state: () => S, errors: () => errs, render, today, load: () => { load(); render(); }, ui, files: FILES, mirror: MIRROR.st, save };
})();
