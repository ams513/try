/* Stark Math.
   Core: DOM helpers, the shared Stark profile store (a format a future Stark bundle launcher can read),
   routing, toasts, local downloads and read-aloud. Everything stays in this browser's localStorage. */
(function () {
  'use strict';
  const SM = window.SM;
  const APP = 'stark-math', VERSION = '1.5.0';
  SM.APP = APP; SM.VERSION = VERSION;

  /* ---------- DOM helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // only ever given output of SM.renderText / SM.picture (escaped)
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) { if (c === null || c === undefined || c === false) return el; if (Array.isArray(c)) { c.forEach(x => add(el, x)); return el; } el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); return el; }
  const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  const reduceMotion = () => (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || (SM.prefs && SM.prefs().calm);
  const rnd36 = n => { const c = window.crypto; if (c && c.getRandomValues) { const b = c.getRandomValues(new Uint8Array(n)); return Array.from(b, x => (x % 36).toString(36)).join(''); } let s = ''; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 36).toString(36); return s; };
  const uid = () => Date.now().toString(36) + rnd36(7);
  Object.assign(SM, { $, h, add, clear, reduceMotion, uid });

  /* ---------- shared Stark profile store ----------
     localStorage "stark.profiles"           : { format: "stark-profiles", version: 1, active, profiles: [...], shared: {...} }
     localStorage "stark.app.stark-math.<id>" : this app's data for one profile
     A backup file bundles both (see STARK_PROFILE_FORMAT.md). */
  const KEY = 'stark.profiles', APPKEY = id => 'stark.app.' + APP + '.' + id;
  /* Crash-safe saving: each write is read back and verified, the previous good copy is kept under key + ".bak", and a
     corrupt or invalid value is recovered from .bak. If neither copy is usable the app opens read-only (safe mode):
     nothing is ever overwritten, and the raw text can be exported. */
  const BAK = '.bak';
  const rawGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const parses = r => { try { JSON.parse(r); return true; } catch (e) { return false; } };
  SM.safeMode = null; // { raw: { key: rawText } } when stored data could not be read
  function load(k, d, issue) {
    const raw = rawGet(k);
    if (raw === null) return d;
    const tryParse = r => { try { const v = JSON.parse(r); return issue && issue(v) ? undefined : v; } catch (e) { return undefined; } };
    let v = tryParse(raw);
    if (v !== undefined) return v;
    const b = rawGet(k + BAK);
    if (b !== null) { v = tryParse(b); if (v !== undefined) { SM.recovered = (SM.recovered || []).concat(k); return v; } }
    SM.safeMode = SM.safeMode || { raw: {} }; SM.safeMode.raw[k] = raw;
    return d;
  }
  let roToast = 0;
  const set = (k, v) => {
    if (SM.safeMode) { if (Date.now() - roToast > 5000) { roToast = Date.now(); toast('Read-only mode: your saved data could not be read, so nothing was changed.'); } return false; }
    let s, prev = null;
    try {
      s = JSON.stringify(v); prev = rawGet(k);
      if (prev !== null && prev !== s && parses(prev)) { try { localStorage.setItem(k + BAK, prev); } catch (e) { /* no room for a spare copy */ } }
      localStorage.setItem(k, s);
      if (localStorage.getItem(k) !== s) throw new Error('verify');
      saveState(true); return true;
    } catch (e) {
      try { if (prev !== null) localStorage.setItem(k, prev); } catch (e2) { /* ignore */ }
      saveState(false); return false;
    }
  };
  /* A failed save is never silent: an assertive toast plus a banner that stays until a later save succeeds. */
  SM.saveOk = true;
  function saveState(ok) {
    if (ok === SM.saveOk) return;
    SM.saveOk = ok;
    if (!ok) toast('Could not save: this browser\'s storage is full or blocked. Save a backup in Settings before you close the page.', true);
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
      let b = document.getElementById('save-warn');
      if (!ok && !b && document.body) { b = h('div', { id: 'save-warn', class: 'save-warn', role: 'alert' }, 'Not saved: this browser is refusing to store your progress. Save a backup in Settings before you close the page.'); document.body.insertBefore(b, document.body.firstChild); }
      if (ok && b) b.remove();
    }
    SM.emit('save', ok);
  }
  SM.loadJSON = load; SM.saveJSON = set;
  SM.COLORS = ['#a99cf0', '#62b8d8', '#f0b35e', '#e98aa8', '#7fcf9a', '#c9a27a', '#8fa3ff', '#f08f72'];
  const DEFAULT_SHARED = { theme: 'dark', readAloud: true, voice: '', rate: 1, calm: false, keypad: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) };
  let store = load(KEY, null, SM.safe.storeIssue);
  if (!store || store.format !== 'stark-profiles' || !Array.isArray(store.profiles) || !store.profiles.length) {
    store = { format: 'stark-profiles', version: 1, active: 'p1', profiles: [{ id: 'p1', name: 'Learner', color: 0, created: new Date().toISOString(), prefs: { level: 1, diff: 1, preset: 'g68' } }], shared: {} };
  }
  store.shared = Object.assign({}, DEFAULT_SHARED, store.shared || {});
  if (!store.profiles.some(p => p.id === store.active)) store.active = store.profiles[0].id;
  const saveStore = () => set(KEY, store);
  SM.store = () => store;
  SM.saveStore = saveStore;
  SM.prefs = () => store.shared;
  SM.setPref = (k, v) => { store.shared[k] = v; saveStore(); SM.emit('prefs', k); };
  SM.profile = () => store.profiles.find(p => p.id === store.active) || store.profiles[0];
  SM.level = () => { const p = SM.profile().prefs || {}; return { lv: p.level === undefined ? 1 : p.level, df: p.diff === undefined ? 1 : p.diff }; };
  SM.setLevel = (lv, df, preset) => { const p = SM.profile(); p.prefs = Object.assign({}, p.prefs, { level: lv, diff: df, preset: preset || '' }); saveStore(); SM.emit('level'); };

  const cache = {};
  const BLANK = () => ({ mastery: {}, history: [], notebook: [], stats: { attempted: 0, correct: 0, days: [] }, contests: [], seen: {}, placement: {}, fluency: {}, sheets: [], wordsets: [] });
  SM.data = function (id) {
    id = id || store.active;
    if (!cache[id]) cache[id] = Object.assign(BLANK(), load(APPKEY(id), {}, d => SM.safe.appDataIssue(d, false)));
    return cache[id];
  };
  SM.saveData = id => set(APPKEY(id || store.active), SM.data(id));
  SM.addProfile = function (name, color, level) {
    const id = 'p' + uid();
    store.profiles.push({ id, name: cleanName(name) || 'Learner', color: color || 0, created: new Date().toISOString(), prefs: { level: level === undefined ? 1 : level, diff: 1 } });
    store.active = id; saveStore(); SM.emit('profile'); return id;
  };
  SM.switchProfile = id => { if (store.profiles.some(p => p.id === id)) { store.active = id; saveStore(); SM.emit('profile'); } };
  SM.deleteProfile = function (id) {
    if (store.profiles.length < 2) return false;
    store.profiles = store.profiles.filter(p => p.id !== id);
    try { localStorage.removeItem(APPKEY(id)); localStorage.removeItem(APPKEY(id) + BAK); } catch (e) { /* ignore */ }
    delete cache[id];
    if (store.active === id) store.active = store.profiles[0].id;
    saveStore(); SM.emit('profile'); return true;
  };
  function cleanName(s) { return String(s || '').replace(/[<>]/g, '').trim().slice(0, 24); }
  SM.cleanName = cleanName;

  /** Backup in the shared Stark format. */
  SM.buildBackup = function () {
    return SM.safe.seal({ format: 'stark-backup', version: 1, app: APP, appVersion: VERSION, exported: new Date().toISOString(), shared: store.shared,
      profiles: store.profiles.map(p => ({ id: p.id, name: p.name, color: p.color, created: p.created, prefs: p.prefs || {}, apps: { [APP]: SM.data(p.id) } })) });
  };
  /** Validate and merge a backup. Keeps other apps' sections untouched for a bundle launcher. */
  SM.readBackup = function (obj) {
    if (SM.safeMode) return { ok: false, error: 'Read-only mode: saved data could not be read, so nothing was restored.' };
    const bad = SM.safe.backupIssue(obj); if (bad) return { ok: false, error: bad };
    let n = 0;
    obj.profiles.forEach(p => {
      if (!p || typeof p.id !== 'string' || !/^[\w-]{1,40}$/.test(p.id)) return;
      const existing = store.profiles.find(x => x.id === p.id);
      const prof = { id: p.id, name: cleanName(p.name) || 'Learner', color: +p.color || 0, created: String(p.created || ''), prefs: Object.assign({}, p.prefs || {}) };
      if (existing) Object.assign(existing, prof); else store.profiles.push(prof);
      const mine = p.apps && p.apps[APP];
      if (mine && typeof mine === 'object') { cache[p.id] = Object.assign(BLANK(), mine); SM.saveData(p.id); }
      n++;
    });
    if (obj.shared && typeof obj.shared === 'object') store.shared = Object.assign({}, DEFAULT_SHARED, store.shared, obj.shared);
    saveStore(); SM.emit('profile');
    return { ok: true, count: n };
  };
  /** Check (size, JSON, strict schema, checksum) and then restore backup text. Nothing is written unless every check passes. */
  SM.restoreBackupText = function (txt) {
    const o = SM.safe.openBackup(txt); if (!o.ok) return o;
    const r = SM.readBackup(o.obj); if (r.ok) r.note = o.note; return r;
  };

  /* ---------- events ---------- */
  const handlers = {};
  SM.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
  SM.emit = (ev, x) => (handlers[ev] || []).forEach(fn => { try { fn(x); } catch (e) { console.error(e); } });

  /* ---------- toast ---------- */
  let toastTimer = 0;
  /* bad = true: announced assertively (role="alert") and kept for 10 s, and never hidden while hovered or focused. */
  function toast(msg, bad) {
    const t = $('#toast'); if (!t) return;
    t.setAttribute('role', bad ? 'alert' : 'status'); t.setAttribute('aria-live', bad ? 'assertive' : 'polite'); t.classList.toggle('toast-bad', !!bad);
    t.textContent = msg; t.hidden = false; clearTimeout(toastTimer);
    const hide = () => { if (t.matches(':hover') || t.contains(document.activeElement)) { toastTimer = setTimeout(hide, 1500); return; } t.hidden = true; };
    toastTimer = setTimeout(hide, bad ? 10000 : 4200);
  }
  SM.toast = toast;

  /* ---------- downloads and file reading (local only) ---------- */
  SM.download = function (name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = h('a', { href: url, download: name, hidden: true });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  SM.pickFile = function (accept, cb) {
    const inp = h('input', { type: 'file', accept: accept || '.json', hidden: true, multiple: true });
    inp.addEventListener('change', () => { const files = Array.from(inp.files || []); inp.remove(); files.forEach(f => { const r = new FileReader(); r.onload = () => cb(String(r.result), f.name); r.readAsText(f); }); });
    document.body.appendChild(inp); inp.click();
  };

  /* ---------- read-aloud ---------- */
  const synth = window.speechSynthesis;
  let voices = [];
  const loadVoices = () => { try { voices = synth ? synth.getVoices().filter(v => /^en/i.test(v.lang)) : []; } catch (e) { voices = []; } SM.emit('voices'); };
  if (synth) { loadVoices(); try { synth.addEventListener('voiceschanged', loadVoices); } catch (e) { /* older browsers */ } }
  SM.voices = () => voices;
  SM.canSpeak = () => !!synth && voices.length > 0;
  /** Speak text. hooks: { onword(i), onend() }. Returns false when no voice is available or read-aloud is off. */
  SM.speak = function (text, hooks) {
    hooks = hooks || {};
    if (!synth || !store.shared.readAloud || !voices.length) { if (hooks.onend) hooks.onend(); return false; }
    try { synth.cancel(); } catch (e) { /* ignore */ }
    const u = new SpeechSynthesisUtterance(SM.speakable(text));
    const v = voices.find(x => x.name === store.shared.voice) || voices.find(x => /female|samantha|zira|aria|jenny|libby|sonia|karen|moira|tessa|fiona/i.test(x.name)) || voices[0];
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = +store.shared.rate || 1; u.pitch = 1;
    u.onboundary = e => { if (hooks.onword && (e.name === 'word' || !e.name)) hooks.onword(e.charIndex); };
    u.onend = u.onerror = () => { if (hooks.onend) hooks.onend(); };
    if (hooks.onstart) u.onstart = hooks.onstart;
    synth.speak(u); return true;
  };
  SM.stopSpeech = () => { try { if (synth) synth.cancel(); } catch (e) { /* ignore */ } };

  /* ---------- theme ---------- */
  SM.applyTheme = () => { document.documentElement.setAttribute('data-theme', store.shared.theme === 'light' ? 'light' : 'dark'); document.documentElement.classList.toggle('calm', !!store.shared.calm); };

  /* ---------- small UI kit ---------- */
  SM.btn = (label, onclick, cls, attrs) => h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick }, attrs || {}), label);
  SM.levelName = lv => SM.LEVELS[lv].name;
  SM.levelBadge = (lv, df) => h('span', { class: 'badge badge-lv' }, SM.LEVELS[lv].name + ' · ' + SM.DIFFS[df].name);
  SM.subjectName = id => (SM.SUBJECTS.find(s => s.id === id) || { name: id }).name;
})();
