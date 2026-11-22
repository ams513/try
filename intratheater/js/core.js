/* Stark IntraTheater by Stark.
   Core: local storage, DOM helper, family profiles, parent PIN gate, router, speech, quiz runner.
   Everything stays in this browser's localStorage. No network calls. */
(function () {
  'use strict';
  const SIT = window.SIT = window.SIT || {};
  const D = window.SIT_DATA || {};
  const KEY = 'starkIT.';
  SIT.VERSION = '1.2.1';

  /* ---------- tiny helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'value') el.value = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (typeof v !== 'string' && k in el) el[k] = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return el;
    if (Array.isArray(c)) { c.forEach(x => add(el, x)); return el; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    return el;
  }
  const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const sample = (a, n) => shuffle(a).slice(0, n);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function fmtTime(s) {
    s = Math.max(0, Math.floor(s || 0));
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = n => (n < 10 ? '0' : '') + n;
    return hh ? hh + ':' + p(mm) + ':' + p(ss) : mm + ':' + p(ss);
  }
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollIntoView = (el, block) => el && el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: block || 'nearest', inline: 'center' });
  Object.assign(SIT, { $, h, add, clear, shuffle, sample, pick, uid, fmtTime, reduceMotion, scrollIntoView, data: D });

  /* ---------- storage ---------- */
  /* Crash-safe: each write is read back and checked, and the last good copy is kept under key + '.bak'.
     Unreadable data is never overwritten: the app opens read-only with a banner and an Export raw data button. */
  const corrupt = {};
  const lsGet = k => { try { return localStorage.getItem(KEY + k); } catch (e) { return null; } };
  const parses = r => { try { JSON.parse(r); return true; } catch (e) { return false; } };
  const store = SIT.store = {
    get(k, d) {
      const raw = lsGet(k);
      if (raw === null) return d;
      try { return JSON.parse(raw); } catch (e) { /* try the last good copy */ }
      const bak = lsGet(k + '.bak');
      if (bak !== null && parses(bak)) {
        try { localStorage.setItem(KEY + k, bak); } catch (e) { /* ignore */ }
        return JSON.parse(bak);
      }
      corrupt[k] = raw; SIT.showSafeMode && SIT.showSafeMode();
      return d;
    },
    set(k, v) {
      if (corrupt[k] !== undefined) return false;      // read-only for damaged data: never overwrite it
      let s, prev = lsGet(k);
      try {
        s = JSON.stringify(v);
        localStorage.setItem(KEY + k, s);
        if (localStorage.getItem(KEY + k) !== s) throw new Error('verify');
      } catch (e) {
        try { if (prev !== null) localStorage.setItem(KEY + k, prev); } catch (e2) { /* ignore */ }
        toast('Could not save. This browser’s storage is full or blocked.', null, true); return false;
      }
      if (prev !== null && prev !== s && parses(prev)) { try { localStorage.setItem(KEY + k + '.bak', prev); } catch (e) { /* ignore */ } }
      return true;
    },
    del(k) { try { localStorage.removeItem(KEY + k); localStorage.removeItem(KEY + k + '.bak'); } catch (e) { /* ignore */ } delete corrupt[k]; },
    keys() {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(KEY) === 0 && !/\.bak$/.test(k)) out.push(k.slice(KEY.length)); } } catch (e) { /* ignore */ }
      return out;
    },
    damaged() { return Object.keys(corrupt); }
  };
  SIT.showSafeMode = function () {
    if (document.getElementById('safe-banner') || !document.body) return;
    const m = document.getElementById('main');
    const bar = h('div', { id: 'safe-banner', class: 'card', role: 'alert', style: 'margin:8px;border:2px solid #e0a030' },
      h('p', null, h('strong', null, 'Safe mode. '), 'Some saved data on this computer could not be read, so Stark IntraTheater is protecting it: that data is read-only and will not be overwritten. You can save a raw copy now.'),
      h('button', { type: 'button', class: 'btn', onclick: () => {
        const o = {}; Object.keys(corrupt).forEach(k => { o[k] = corrupt[k]; });
        SIT.download('stark-intratheater-raw-data.json', JSON.stringify(o, null, 1), 'application/json');
      } }, '💾 Export raw data'));
    if (m && m.parentNode) m.parentNode.insertBefore(bar, m); else document.body.insertBefore(bar, document.body.firstChild);
  };

  /* ---------- events ---------- */
  const handlers = {};
  SIT.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
  SIT.emit = (ev, x) => { (handlers[ev] || []).forEach(fn => { try { fn(x); } catch (e) { console.error(e); } }); };

  /* ---------- toast ---------- */
  /* Errors (bad = true) are announced assertively, stay 12 s, carry a Close button and never vanish while hovered or focused. */
  let toastTimer = 0;
  function toast(msg, action, bad) {
    const t = $('#toast');
    if (!t) return;
    clear(t);
    t.setAttribute('role', bad ? 'alert' : 'status'); t.setAttribute('aria-live', bad ? 'assertive' : 'polite');
    t.classList.toggle('toast-bad', !!bad);
    t.appendChild(h('span', null, msg));
    if (action) t.appendChild(h('button', { type: 'button', class: 'btn btn-small', onclick: () => { t.hidden = true; action.fn(); } }, action.label));
    if (bad) t.appendChild(h('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Close message', onclick: () => { t.hidden = true; } }, 'Close'));
    t.hidden = false;
    clearTimeout(toastTimer);
    const dwell = bad ? 12000 : action ? 8000 : 4500;
    const hide = () => { if (t.matches(':hover') || t.contains(document.activeElement)) toastTimer = setTimeout(hide, 2000); else t.hidden = true; };
    toastTimer = setTimeout(hide, dwell);
  }
  SIT.toast = toast;

  /* ---------- downloads (local only) ---------- */
  SIT.download = function (name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name, hidden: true });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  /* ---------- family, profiles and progress ---------- */
  SIT.AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🐢', '🐧', '🦉', '🐳', '🐝', '🦖'];
  const DEFAULT_SETTINGS = { kidsOpenFiles: false, theme: 'dark', idleLockMin: 15 };
  let family = store.get('family', null);
  if (!family || !Array.isArray(family.kids) || !family.kids.length) {
    family = { kids: [{ id: 'kid1', name: 'Explorer', avatar: '🦊' }], activeKid: 'kid1', pin: null };
  }
  family.settings = Object.assign({}, DEFAULT_SETTINGS, family.settings || {});
  if (!family.kids.some(k => k.id === family.activeKid)) family.activeKid = family.kids[0].id;
  SIT.family = () => family;
  SIT.saveFamily = () => store.set('family', family);
  if (store.damaged().length) SIT.showSafeMode();

  let mode = 'kids'; // Kids mode is always the starting profile.
  SIT.mode = () => mode;
  SIT.isGrown = () => mode === 'grown';
  SIT.activeKid = () => family.kids.find(k => k.id === family.activeKid) || family.kids[0];
  SIT.profileId = () => (mode === 'grown' ? 'grown' : SIT.activeKid().id);
  SIT.profileLabel = () => (mode === 'grown' ? 'Grown-ups' : SIT.activeKid().name);
  SIT.profileAvatar = () => (mode === 'grown' ? '🎬' : SIT.activeKid().avatar);

  const progCache = {};
  SIT.progress = function (id) {
    id = id || SIT.profileId();
    if (!progCache[id]) {
      progCache[id] = Object.assign({ stars: 0, seen: [], essays: [], best: {}, drawings: [], stories: [], sources: [], writing: [], exhibits: [], review: null }, store.get('progress.' + id, {}));
    }
    return progCache[id];
  };
  SIT.saveProgress = id => { id = id || SIT.profileId(); const ok = store.set('progress.' + id, SIT.progress(id)); SIT.emit('progress'); return ok; };
  SIT.resetProgress = id => { delete progCache[id]; store.del('progress.' + id); SIT.emit('progress'); };
  SIT.addStars = n => { const p = SIT.progress(); p.stars = (p.stars || 0) + n; SIT.saveProgress(); };
  SIT.markIn = (list, id) => { const p = SIT.progress(); if (p[list].indexOf(id) < 0) { p[list].push(id); SIT.saveProgress(); return true; } return false; };
  SIT.setBest = (key, score, total) => {
    const p = SIT.progress(); const prev = p.best[key];
    if (!prev || score / total > prev.score / prev.total) { p.best[key] = { score, total }; SIT.saveProgress(); return true; }
    return false;
  };
  SIT.setActiveKid = id => { family.activeKid = id; SIT.saveFamily(); SIT.emit('mode'); };

  /* ---------- parent PIN (a child lock, not strong security) ---------- */
  function pinHash(pin, salt) {
    let a = 0x811c9dc5, b = 0x9747b28c;
    const s = salt + ':' + pin;
    for (let r = 0; r < 3000; r++) {
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        a = Math.imul(a ^ c, 16777619);
        b = Math.imul(b ^ c ^ (a >>> 13), 2246822507);
      }
      a ^= b >>> 7; b ^= a << 3;
    }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
  SIT.hasPin = () => !!(family.pin && family.pin.hash);
  SIT.setPin = pin => { const salt = uid(); family.pin = { salt, hash: pinHash(pin, salt) }; SIT.saveFamily(); };
  SIT.checkPin = pin => SIT.hasPin() && pinHash(pin, family.pin.salt) === family.pin.hash;
  const validPin = p => /^\d{4,8}$/.test(p);
  SIT.validPin = validPin;

  let fails = 0, lockUntil = 0, pinState = null;
  function pinDialog() { return $('#pin-dialog'); }
  function setPinUI(title, msg) {
    $('#pin-title').textContent = title;
    $('#pin-msg').textContent = msg;
    const inp = $('#pin-input'); inp.value = ''; inp.focus();
  }
  SIT.requestGrown = function (onOk, onCancel) {
    if (mode === 'grown') { onOk && onOk(); return; }
    const dlg = pinDialog();
    pinState = { step: SIT.hasPin() ? 'enter' : 'create1', first: '', onOk, onCancel, done: false };
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (pinState.step === 'enter') setPinUI('Grown-ups only', 'Enter the parent PIN to leave Kids mode.');
    else setPinUI('Create a parent PIN', 'Grown-ups: choose a 4 to 8 digit PIN. Kids mode stays locked behind it.');
  };
  function closePin(ok) {
    const st = pinState; pinState = null;
    const dlg = pinDialog();
    if (dlg.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
    if (!st) return;
    if (ok) { mode = 'grown'; lastActivity = Date.now(); SIT.emit('mode'); st.onOk && st.onOk(); }
    else st.onCancel && st.onCancel();
  }
  function submitPin() {
    if (!pinState) return;
    const v = $('#pin-input').value.trim();
    const msg = $('#pin-msg');
    if (pinState.step === 'enter') {
      if (Date.now() < lockUntil) { msg.textContent = 'Too many tries. Wait ' + Math.ceil((lockUntil - Date.now()) / 1000) + ' seconds.'; return; }
      if (SIT.checkPin(v)) { fails = 0; closePin(true); return; }
      fails++;
      if (fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; msg.textContent = 'Too many tries. Locked for 60 seconds.'; }
      else msg.textContent = 'That PIN did not match. Try again.';
      $('#pin-input').value = '';
      return;
    }
    if (!validPin(v)) { msg.textContent = 'Use 4 to 8 digits.'; return; }
    if (pinState.step === 'create1') { pinState.first = v; pinState.step = 'create2'; setPinUI('Confirm the parent PIN', 'Type the same PIN again.'); return; }
    if (v !== pinState.first) { pinState.step = 'create1'; setPinUI('Create a parent PIN', 'The two PINs were different. Start again.'); return; }
    SIT.setPin(v); toast('Parent PIN saved on this computer.'); closePin(true);
  }
  function buildPinDialog() {
    const dlg = pinDialog();
    const keypad = $('#pin-keypad');
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].forEach(k => {
      const label = k === 'del' ? '⌫' : (k === 'ok' ? 'OK' : k);
      keypad.appendChild(h('button', {
        type: 'button', class: 'key' + (k === 'ok' ? ' key-ok' : ''), 'aria-label': k === 'del' ? 'Delete digit' : (k === 'ok' ? 'Submit PIN' : k),
        onclick: () => {
          const inp = $('#pin-input');
          if (k === 'del') inp.value = inp.value.slice(0, -1);
          else if (k === 'ok') submitPin();
          else if (inp.value.length < 8) inp.value += k;
          inp.focus();
        }
      }, label));
    });
    $('#pin-form').addEventListener('submit', e => { e.preventDefault(); submitPin(); });
    $('#pin-cancel').addEventListener('click', () => closePin(false));
    dlg.addEventListener('cancel', e => { e.preventDefault(); closePin(false); });
  }

  SIT.lockToKids = function (quiet) {
    if (mode === 'kids') return;
    mode = 'kids';
    SIT.emit('mode');
    if (!quiet) toast('Back in Kids mode.');
    if (current && current.grownOnly) location.hash = '#/home';
  };

  /* idle auto-lock back to Kids mode */
  let lastActivity = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
  setInterval(() => {
    const min = +family.settings.idleLockMin;
    const vid = $('#theater-video');
    const watching = vid && !vid.paused;
    if (mode === 'grown' && min > 0 && !watching && Date.now() - lastActivity > min * 60000) { SIT.lockToKids(true); toast('Locked back to Kids mode after a quiet spell.'); }
  }, 30000);

  /* ---------- theme ---------- */
  SIT.applyTheme = () => { document.documentElement.setAttribute('data-theme', family.settings.theme === 'light' ? 'light' : 'dark'); SIT.emit('theme'); };

  /* ---------- speech (browser speechSynthesis, offline voices where installed) ---------- */
  const synth = window.speechSynthesis;
  SIT.canSpeak = !!(synth && window.SpeechSynthesisUtterance);
  let voice = null;
  function pickVoice() {
    if (!SIT.canSpeak) return;
    const vs = synth.getVoices().filter(v => (v.lang || '').toLowerCase().indexOf('en') === 0);
    voice = vs.find(v => v.localService && /natural|aria|jenny|zira|samantha|libby|sonia/i.test(v.name)) || vs.find(v => v.localService) || vs[0] || null;
  }
  if (SIT.canSpeak) { pickVoice(); if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice); }
  function chunks(text) {
    const parts = String(text).replace(/\s+/g, ' ').match(/[^.!?]+[.!?”"]*\s*/g) || [String(text)];
    const out = []; let cur = '';
    parts.forEach(p => { if ((cur + p).length > 220 && cur) { out.push(cur); cur = p; } else cur += p; });
    if (cur.trim()) out.push(cur);
    return out;
  }
  SIT.speak = function (text, rate) {
    if (!SIT.canSpeak || !text) return false;
    synth.cancel();
    const list = chunks(text);
    list.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      if (voice) u.voice = voice;
      u.rate = rate || (mode === 'grown' ? 1 : 0.9);
      if (i === list.length - 1) u.onend = u.onerror = () => SIT.emit('speech-end');
      synth.speak(u);
    });
    return true;
  };
  SIT.stopSpeaking = () => { if (SIT.canSpeak) synth.cancel(); };
  SIT.speakButton = function (getText, label, cls) {
    const b = h('button', {
      type: 'button', class: 'btn btn-speak ' + (cls || ''), hidden: !SIT.canSpeak,
      onclick: () => {
        if (synth.speaking) { SIT.stopSpeaking(); return; }
        SIT.speak(typeof getText === 'function' ? getText() : getText);
      }
    }, h('span', { 'aria-hidden': 'true' }, '🔊 '), label || 'Read aloud');
    return b;
  };

  /* ---------- flag emoji support (Windows Chrome/Edge draw letters instead of flags) ---------- */
  let flagsOk;
  SIT.flagsOk = function () {
    if (flagsOk !== undefined) return flagsOk;
    try {
      const c = document.createElement('canvas'); c.width = c.height = 40;
      const x = c.getContext('2d'); x.textBaseline = 'top'; x.font = '32px sans-serif';
      x.fillText('🇬🇧', 0, 0);
      const d = x.getImageData(0, 0, 40, 40).data; let colored = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && (Math.abs(d[i] - d[i + 1]) > 40 || Math.abs(d[i + 1] - d[i + 2]) > 40)) colored++;
      flagsOk = colored > 30;
    } catch (e) { flagsOk = false; }
    return flagsOk;
  };
  SIT.flagEl = function (c, cls) {
    return SIT.flagsOk()
      ? h('span', { class: 'flag ' + (cls || ''), role: 'img', 'aria-label': 'Flag of ' + c.name }, c.flag)
      : h('span', { class: 'flag flag-code ' + (cls || ''), 'aria-hidden': 'true', title: 'Flag emoji are not drawn by this browser' }, c.iso2);
  };

  /* ---------- quiz runner (shared by history, geography and grown-up trivia) ---------- */
  const PRAISE = ['Yes! Brilliant!', 'Correct! Well done!', 'You got it!', 'Super!', 'Spot on!'];
  SIT.runQuiz = function (host, opts) {
    const Q = opts.questions; const kid = !!opts.kid; const n = Q.length;
    let i = 0, score = 0, firstTry = true;
    clear(host);
    const prog = h('p', { class: 'quiz-progress' });
    const bar = h('div', { class: 'meter', 'aria-hidden': 'true' }, h('span'));
    const big = h('div', { class: 'quiz-big', 'aria-hidden': 'true' });
    const qEl = h('h3', { class: 'quiz-q', tabindex: '-1' });
    const choices = h('div', { class: 'quiz-choices' + (kid ? ' kid' : ''), role: 'group', 'aria-label': 'Answer choices' });
    const fb = h('p', { class: 'quiz-feedback', role: 'status', 'aria-live': 'polite' });
    const next = h('button', { type: 'button', class: 'btn btn-primary', hidden: true, onclick: () => { i++; i < n ? show() : finish(); } }, 'Next');
    const speak = SIT.speakButton(() => (Q[i].say || Q[i].q) + ' ' + Q[i].choices.join(', or '), 'Read question');
    host.appendChild(h('div', { class: 'quiz' + (kid ? ' quiz-kid' : '') }, h('div', { class: 'quiz-head' }, prog, speak), bar, big, qEl, choices, fb, h('div', { class: 'quiz-actions' }, next)));
    function show() {
      const q = Q[i]; firstTry = true;
      prog.textContent = 'Question ' + (i + 1) + ' of ' + n + '  ·  Score ' + score;
      bar.firstChild.style.width = (100 * i / n) + '%';
      big.textContent = q.big || ''; big.hidden = !q.big && !q.node;
      if (q.node) big.appendChild(q.node());
      if (q.bigLabel) { big.setAttribute('role', 'img'); big.setAttribute('aria-label', q.bigLabel); big.removeAttribute('aria-hidden'); }
      else { big.removeAttribute('role'); big.removeAttribute('aria-label'); big.setAttribute('aria-hidden', 'true'); }
      qEl.textContent = q.q;
      clear(choices); fb.textContent = ''; fb.className = 'quiz-feedback'; next.hidden = true;
      q.choices.forEach(c => choices.appendChild(h('button', { type: 'button', class: 'choice', onclick: e => answer(c, e.currentTarget) }, c)));
      if (i > 0) qEl.focus();
    }
    function answer(c, btn) {
      const q = Q[i]; const ok = c === q.answer;
      if (ok) {
        if (firstTry) { score++; if (kid) SIT.addStars(1); }
        btn.classList.add('is-right');
        choices.querySelectorAll('button').forEach(b => { b.disabled = true; });
        fb.textContent = (firstTry ? pick(PRAISE) : 'Yes, that’s it!') + (q.note ? ' ' + q.note : '');
        fb.className = 'quiz-feedback good';
        next.hidden = false; next.textContent = i + 1 < n ? 'Next question' : 'See my score'; next.focus();
        return;
      }
      firstTry = false;
      btn.classList.add('is-wrong'); btn.disabled = true;
      if (kid) { fb.textContent = 'Almost! Have another try.'; fb.className = 'quiz-feedback try'; return; }
      choices.querySelectorAll('button').forEach(b => { b.disabled = true; if (b.textContent === q.answer) b.classList.add('is-right'); });
      fb.textContent = 'Not quite: the answer is ' + q.answer + '.' + (q.note ? ' ' + q.note : '');
      fb.className = 'quiz-feedback bad';
      next.hidden = false; next.textContent = i + 1 < n ? 'Next question' : 'See my score'; next.focus();
    }
    function finish() {
      const record = opts.bestKey ? SIT.setBest(opts.bestKey, score, n) : false;
      clear(host);
      const pct = score / n;
      const stars = pct === 1 ? '⭐⭐⭐' : pct >= 0.6 ? '⭐⭐' : '⭐';
      const panel = h('div', { class: 'quiz-done' },
        h('div', { class: 'quiz-stars', 'aria-hidden': 'true' }, stars),
        h('h3', { tabindex: '-1' }, score + ' out of ' + n),
        h('p', null, pct === 1 ? 'A perfect round!' : pct >= 0.6 ? 'Great work!' : 'Every round makes you sharper.'),
        record ? h('p', { class: 'badge' }, 'New personal best') : null,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => opts.again ? opts.again() : SIT.runQuiz(host, opts) }, 'Play again'),
          opts.onDone ? h('button', { type: 'button', class: 'btn', onclick: opts.onDone }, 'Choose another quiz') : null));
      host.appendChild(panel);
      panel.querySelector('h3').focus();
    }
    show();
  };

  /* ---------- router ---------- */
  const views = {}; let current = null; let lastHash = '#/home'; let userNav = false;
  SIT.view = (name, def) => { def.name = name; views[name] = def; };
  SIT.go = hash => { if (location.hash === hash) route(); else location.hash = hash; };
  SIT.reroute = () => route();
  SIT.currentView = () => current && current.name;
  function parse() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const qi = raw.indexOf('?');
    const path = qi >= 0 ? raw.slice(0, qi) : raw, qs = qi >= 0 ? raw.slice(qi + 1) : '';
    const parts = path.split('/').filter(Boolean);
    const q = {};
    qs.split('&').forEach(kv => { if (!kv) return; const j = kv.indexOf('='); q[decodeURIComponent(j < 0 ? kv : kv.slice(0, j))] = j < 0 ? '' : decodeURIComponent(kv.slice(j + 1)); });
    return { name: parts[0] || 'home', sub: parts[1] || '', q };
  }
  function route() {
    const r = parse();
    let def = views[r.name] || views.home;
    if (def.grownOnly && mode !== 'grown') {
      SIT.requestGrown(() => route(), () => { location.hash = lastHash && lastHash !== location.hash ? lastHash : '#/home'; });
      return;
    }
    /* kids' limits: a closed section, quiet hours or a used-up daily allowance shows the rest page instead (js/controls.js) */
    if (mode !== 'grown' && SIT.kidGate && views.rest) {
      const gate = SIT.kidGate(def.name);
      if (!gate.ok) { r.gate = gate; r.wanted = location.hash || '#/home'; def = views.rest; }
    }
    SIT.stopSpeaking();
    const changed = current !== def;
    if (current && changed && current.hide) current.hide();
    Object.keys(views).forEach(n => { if (views[n].el) views[n].el.hidden = views[n] !== def; });
    if (!def.el) {
      def.el = h('section', { class: 'view view-' + def.name });
      $('#main').appendChild(def.el);
      def.mount(def.el);
    }
    def.el.hidden = false;
    current = def; lastHash = location.hash || '#/home';
    if (def.show) def.show(r);
    document.title = (def.title ? def.title + ' · ' : '') + 'Stark IntraTheater';
    document.querySelectorAll('[data-nav]').forEach(a => {
      if (a.getAttribute('data-nav') === (def.navAs || def.name)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (changed) {
      window.scrollTo(0, 0); document.body.scrollTop = 0;
      if (userNav) { const t = def.el.querySelector('h1'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }
    }
    userNav = true;
    SIT.emit('route', def.name);
  }
  SIT.start = function () {
    let framed = true;
    try { framed = window.self !== window.top; } catch (e) { /* cross-origin parent: framed */ }
    if (framed) document.documentElement.classList.add('framed');
    buildPinDialog();
    SIT.applyTheme();
    window.addEventListener('hashchange', route);
    route();
  };
})();
