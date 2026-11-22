/* Stark IntraTheater by Stark. Anywhere (1.1.0): hands-free sessions, a sleep timer, a touch lock and the Theater anywhere guide.
   The logic lives in js/anywherelib.js (tested under node); this file is the screen, the clock and the browser's own features:
   full screen, Screen Wake Lock and Media Session. Nothing here uses the network, the camera or the microphone. */
(function () {
  'use strict';
  const { h, add, clear, store } = SIT;
  const A = SIT.anywherelib;
  const T = () => SIT.theater;

  let settings = A.sanitizeSettings(store.get('anywhere.settings', null));
  let S = A.idle();                 // hands-free session state
  let L = A.unlocked();             // touch lock state
  const timer = A.sleepTimer();
  let keys = [];                    // playable titles, in order, for this session
  let gapEnd = 0, gapTimer = 0, endTimer = 0, loopId = 0, holdId = 0, quietId = 0;
  let sentinel = null, userVol = 1, fadeSeen = false, fadeBroken = false, coverOn = false;
  const el = {};                    // the card and the layer
  const now = () => performance.now();
  const save = () => store.set('anywhere.settings', settings);

  /* ---------- small helpers ---------- */
  const video = () => (T() && T().video && T().video()) || null;
  const stage = () => (T() && T().stage && T().stage()) || null;
  const fullscreenOn = () => !!document.fullscreenElement;
  const say = msg => { if (el.status) el.status.textContent = msg; };
  const nameAt = i => (keys[i] != null && T() ? T().nameOf(keys[i]) : '');

  /* ---------- keep the screen awake (the browser may refuse; say so plainly) ---------- */
  function wakeAcquire() {
    if (sentinel) return;
    if (!('wakeLock' in navigator) || !navigator.wakeLock || !navigator.wakeLock.request) { el.wake.textContent = 'This browser cannot keep the screen awake. Turn off the screen timeout in your device settings.'; return; }
    navigator.wakeLock.request('screen').then(s => {
      sentinel = s; el.wake.textContent = 'The screen is being kept awake.';
      s.addEventListener('release', () => { sentinel = null; });
    }).catch(() => { el.wake.textContent = 'The device would not keep the screen awake (power saving can refuse this). Turn off the screen timeout in your device settings.'; });
  }
  function wakeRelease() { if (sentinel) { try { sentinel.release(); } catch (e) { /* already released */ } sentinel = null; } if (el.wake) el.wake.textContent = ''; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && active() && !sentinel) wakeAcquire(); });

  /* ---------- Media Session: headset, keyboard and Bluetooth remote buttons ---------- */
  function mediaOn() {
    if (!('mediaSession' in navigator)) return;
    const v = () => video();
    const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* this action is not supported here */ } };
    set('play', () => { if (v()) v().play().catch(() => {}); });
    set('pause', () => { if (v()) v().pause(); });
    set('nexttrack', () => dispatch({ type: 'next' }));
    set('previoustrack', () => dispatch({ type: 'prev' }));
    set('seekbackward', () => { if (v()) v().currentTime = Math.max(0, v().currentTime - 10); });
    set('seekforward', () => { if (v()) v().currentTime += 10; });
  }
  function mediaOff() {
    if (!('mediaSession' in navigator)) return;
    ['play', 'pause', 'nexttrack', 'previoustrack', 'seekbackward', 'seekforward'].forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch (e) { /* ignore */ } });
    try { navigator.mediaSession.metadata = null; } catch (e) { /* ignore */ }
  }
  function mediaTitle(name) {
    try { if ('mediaSession' in navigator && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: name }); } catch (e) { /* ignore */ }
  }

  /* ---------- the cover: black screen for the quiet gap, the end of a line-up and a finished sleep timer ---------- */
  function cover(text, sub, instant) {
    clearTimeout(quietId);
    clear(el.coverText); add(el.coverText, text || ''); el.coverSub.textContent = sub || '';
    el.cover.classList.toggle('instant', !!instant || SIT.reduceMotion());
    el.cover.classList.remove('quiet'); el.cover.hidden = false;
    void el.cover.offsetWidth;                    // let the fade start from clear
    el.cover.classList.add('on'); coverOn = true;
  }
  function uncover() {
    clearTimeout(quietId);
    el.cover.classList.remove('on', 'quiet'); coverOn = false;
    quietId = setTimeout(() => { if (!coverOn) el.cover.hidden = true; }, SIT.reduceMotion() ? 0 : 700);
  }
  /* after a few seconds the words fade away and only black is left, so nothing glows in a dark room */
  const hushCover = () => { clearTimeout(quietId); quietId = setTimeout(() => el.cover.classList.add('quiet'), 8000); };

  /* ---------- the session ---------- */
  const active = () => S.phase === 'playing' || S.phase === 'gap' || S.phase === 'ending' || timer.armed();

  function dispatch(ev) {
    const before = S.phase;
    S = A.sessionReduce(S, ev);
    if (before === 'gap' && S.phase !== 'gap') { clearTimeout(gapTimer); gapEnd = 0; }
    if (S.act === 'load') loadCurrent();
    else if (S.act === 'gap') beginGap();
    else if (S.act === 'fade') beginFade();
    else if (S.act === 'stop') stopSession();
    if (ev.type === 'abort') { uncover(); leaveFullscreen(); }
    render();
  }
  function loadCurrent() {
    uncover();
    const k = keys[S.idx];
    if (!T() || !T().playKey(k)) { say('That title is not open any more.'); dispatch({ type: 'abort' }); return; }
    mediaTitle(T().nameOf(k));
    say(`Hands-free: title ${S.idx + 1} of ${S.n}.`);
  }
  function beginGap() {
    const sec = settings.gapSec;
    if (!sec) { dispatch({ type: 'gapDone' }); return; }
    gapEnd = now() + sec * 1000;
    cover(['Next:', ' ', h('span', { 'data-i18n-skip': '' }, nameAt(S.next))], '', false);
    gapTimer = setTimeout(() => dispatch({ type: 'gapDone' }), sec * 1000);
    startLoop();
  }
  function beginFade() {
    cover('That was the last title.', 'Tap or press a key to close.', false);
    say('Hands-free finished: that was the last title.');
    hushCover();
    endTimer = setTimeout(() => dispatch({ type: 'endDone' }), SIT.reduceMotion() ? 0 : 3000);
  }
  function stopSession() {
    clearTimeout(gapTimer); clearTimeout(endTimer);
    wakeRelease(); mediaOff();
    if (T()) T().setExternal(false);
    restoreVolume();
  }
  function startHandsFree() {
    if (!T()) return;
    keys = A.playOrder(T().queueKeys(), T().items());
    if (!keys.length) { SIT.toast('Open tonight’s video files first, then press Start hands-free.'); return; }
    clearTimeout(endTimer);
    T().setExternal(true);
    S = Object.assign(A.sessionReduce(A.idle(), { type: 'start', n: keys.length, repeat: settings.repeat }), { locked: L.locked });
    enterFullscreen();
    wakeAcquire(); mediaOn();
    loadCurrent(); render(); startLoop();
    if (el.lockBtn) el.lockBtn.focus({ preventScroll: true });
  }
  function enterFullscreen() {
    const s = stage();
    if (s && s.requestFullscreen && !fullscreenOn()) { try { const p = s.requestFullscreen(); if (p && p.catch) p.catch(() => { say('Full screen was not allowed here. Hands-free still works in the page.'); }); } catch (e) { /* ignore */ } }
  }
  function leaveFullscreen() { if (fullscreenOn() && document.exitFullscreen) { try { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } } }

  /* When a title is picked by hand (or by the media buttons through Theater) keep the session in step; leave if it is not part of the order. */
  SIT.on('theater-load', e => {
    if (S.phase !== 'playing' && S.phase !== 'gap') return;
    const i = keys.indexOf(e.key);
    if (i < 0) { dispatch({ type: 'abort' }); return; }
    if (i !== S.idx && S.phase === 'playing') { S = Object.assign({}, S, { idx: i }); render(); }
  });
  SIT.on('theater-ended', () => {
    if (timer.armed() && timer.choice() === 'title') { timer.ended(); sleepNow(); return; }
    if (S.phase === 'playing') dispatch({ type: 'ended' });
  });

  /* ---------- sleep timer ---------- */
  function startSleep(choice) {
    if (!timer.arm(choice, now())) return;
    fadeSeen = false; fadeBroken = false;
    const v = video(); if (v) userVol = v.volume;
    settings.sleep = choice; save();
    wakeAcquire(); startLoop(); render();
    say(choice === 'title' ? 'Sleep timer: playback will stop when this title ends.' : `Sleep timer: playback will stop in ${choice} minutes.`);
  }
  function cancelSleep() {
    const was = timer.armed();
    timer.cancel(); restoreVolume(); render();
    if (was) say('Sleep timer cancelled.');
    if (!active()) wakeRelease();
  }
  function restoreVolume() { const v = video(); if (v && fadeSeen) { try { v.volume = userVol; } catch (e) { /* ignore */ } } fadeSeen = false; }
  function sleepNow() {
    const v = video();
    if (v) { v.pause(); }
    restoreVolume();
    timer.cancel();
    cover('Goodnight.', 'The sleep timer has ended playback. Tap or press a key to wake the screen.', false);
    hushCover();
    say('Sleep timer finished. Playback is paused and the position is saved.');
    if (S.phase !== 'idle' && S.phase !== 'done') dispatch({ type: 'sleepFired' }); else { wakeRelease(); render(); }
  }

  /* ---------- the one clock: 4 times a second while something is armed or waiting ---------- */
  function startLoop() { if (!loopId) loopId = setInterval(loop, 250); }
  function stopLoop() { clearInterval(loopId); loopId = 0; }
  function loop() {
    const v = video(), t = now();
    /* leaving Theater ends hands-free (the film itself is left as it is) */
    if (S.phase !== 'idle' && S.phase !== 'done' && SIT.currentView() !== 'theater' && SIT.currentView() !== 'anywhere') { dispatch({ type: 'abort' }); }
    if (timer.armed()) {
      let left = Infinity;
      if (v && isFinite(v.duration) && v.duration > 0) left = Math.max(0, (v.duration - v.currentTime) * 1000 / (v.playbackRate || 1));
      const r = timer.tick(t, left);
      if (r.state === 'fired') { sleepNow(); }
      else if (v) {
        if (r.state === 'running') { if (!fadeSeen) userVol = v.volume; }
        else if (!fadeBroken) {
          if (!fadeSeen) { fadeSeen = true; }
          try { v.volume = Math.max(0, Math.min(1, userVol * r.gain)); } catch (e) { fadeBroken = true; }
          if (!fadeBroken && r.gain < 0.9 && Math.abs(v.volume - userVol) < 0.001) { fadeBroken = true; say('This device does not let the page fade the volume, so the picture will pause on time without a fade.'); }
        }
      }
      if (el.count) updateCount(r);
    }
    if (S.phase === 'gap' && gapEnd) { const sec = Math.max(0, Math.ceil((gapEnd - t) / 1000)); const txt = sec === 1 ? 'In 1 second' : `In ${sec} seconds`; if (el.coverSub.textContent !== txt) el.coverSub.textContent = txt; }
    if (!timer.armed() && S.phase !== 'gap' && S.phase !== 'playing' && S.phase !== 'ending') stopLoop();
  }
  function updateCount(r) {
    const show = settings.showCount && timer.armed();
    el.count.hidden = !show;
    if (!show) return;
    el.countLabel.textContent = timer.choice() === 'title' ? 'Sleep at the end of this title' : 'Sleep in';
    el.countTime.textContent = timer.choice() === 'title' ? '' : A.fmtRemaining(r.remainingMs);
  }

  /* ---------- touch lock ---------- */
  const HOLD_KEYS = { u: 1, U: 1 };
  function lockOn() {
    L = A.lockReduce(L, { type: 'lock' });
    S = Object.assign({}, S, { locked: true });
    el.shield.hidden = false; if (stage()) stage().classList.add('aw-locked');
    el.ring.style.setProperty('--p', '0');
    el.lockStatus.textContent = 'Locked. Touches on this page do nothing. Hold the corner button for two seconds to unlock, or hold the U key.';
    render();
    el.unlock.focus({ preventScroll: true });
  }
  /* the screen side of an unlock (a finished hold, or the time limit ending) */
  function unlockUI(why) {
    S = Object.assign({}, S, { locked: false });
    stopHold(); el.shield.hidden = true; if (stage()) stage().classList.remove('aw-locked');
    el.lockStatus.textContent = '';
    render();
    say(why === 'limit' ? 'Touch lock was released because the time limit ended.' : 'Unlocked.');
    if (el.lockBtn && why !== 'limit') el.lockBtn.focus({ preventScroll: true });
  }
  function lockForceOff(why) { if (!L.locked) return; L = A.unlocked(); unlockUI(why); }
  function overUnlock(e) { const r = el.unlock.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
  function runLock(ev) {
    const was = L.locked;
    L = A.lockReduce(L, ev);
    if (L.holding) startHold(); else stopHold();
    if (L.hint) { el.lockStatus.textContent = 'Locked. Press and hold the corner button for two seconds to unlock.'; }
    if (was && !L.locked) unlockUI();
  }
  function startHold() {
    if (holdId) return;
    holdId = setInterval(() => {
      el.ring.style.setProperty('--p', String(A.holdProgress(L.downAt, now(), A.HOLD_MS)));
      runLock({ type: 'tick', at: now() });
    }, 50);
    el.unlock.classList.add('holding');
  }
  function stopHold() { clearInterval(holdId); holdId = 0; if (el.ring) el.ring.style.setProperty('--p', '0'); if (el.unlock) el.unlock.classList.remove('holding'); }
  function buildShield() {
    const swallow = e => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); };
    el.ring = h('span', { class: 'aw-ring', 'aria-hidden': 'true' });
    el.unlock = h('button', { type: 'button', class: 'aw-unlock', 'aria-label': 'Unlock: press and hold for two seconds, or hold the U key' },
      el.ring, h('span', { class: 'aw-unlock-text' }, 'Hold to unlock'));
    el.lockStatus = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    el.shield = h('div', { class: 'aw-shield', hidden: true },
      h('p', { class: 'aw-badge' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), 'Locked'),
      el.unlock, el.lockStatus);
    const s = el.shield;
    s.addEventListener('pointerdown', e => { swallow(e); runLock({ type: 'down', id: e.pointerId, at: now(), onTarget: overUnlock(e) }); });
    s.addEventListener('pointermove', e => { swallow(e); runLock({ type: 'move', id: e.pointerId, onTarget: overUnlock(e) }); });
    s.addEventListener('pointerup', e => { swallow(e); runLock({ type: 'up', id: e.pointerId }); });
    s.addEventListener('pointercancel', e => { swallow(e); runLock({ type: 'cancel' }); });
    ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'click', 'dblclick', 'contextmenu', 'wheel', 'dragstart', 'mousedown', 'mouseup', 'auxclick'].forEach(n => s.addEventListener(n, swallow, { passive: false }));
    document.addEventListener('keydown', e => {
      if (!L.locked) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'Escape' || /^F\d+$/.test(e.key) || /^(Media|Audio|Volume|Browser)/.test(e.key)) return;   // the device's own keys keep working
      const onBtn = document.activeElement === el.unlock;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat && (HOLD_KEYS[e.key] || (onBtn && (e.key === 'Enter' || e.key === ' ')))) runLock({ type: 'down', id: 'key', at: now(), key: true });
    }, true);
    document.addEventListener('keyup', e => {
      if (!L.locked) return;
      if (HOLD_KEYS[e.key] || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); runLock({ type: 'up', id: 'key', key: true }); }
    }, true);
    window.addEventListener('blur', () => { if (L.locked) runLock({ type: 'cancel' }); });
  }

  /* ---------- the card on the Theater page ---------- */
  const optionList = (opts, cur) => opts.map(o => h('option', { value: String(o[0]), selected: String(o[0]) === String(cur) }, o[1]));
  function render() {
    if (!el.card) return;
    const running = S.phase === 'playing' || S.phase === 'gap' || S.phase === 'ending';
    el.end.hidden = !running;
    el.go.textContent = running ? '■ End hands-free' : '▶ Start hands-free';
    el.go.setAttribute('aria-pressed', running ? 'true' : 'false');
    if (!timer.armed() || !settings.showCount) el.count.hidden = true;
    el.sleepGo.textContent = timer.armed() ? 'Cancel sleep timer' : 'Start sleep timer';
    el.sleepGo.setAttribute('aria-pressed', timer.armed() ? 'true' : 'false');
    el.lockBtn.setAttribute('aria-pressed', L.locked ? 'true' : 'false');
    el.lockBtn.textContent = L.locked ? '🔒 Touch is locked' : '🔓 Lock touch';
    clear(el.state);
    add(el.state, [running ? (S.n ? h('span', null, `Hands-free is on: title ${S.idx + 1} of ${S.n}.`) : h('span', null, 'Hands-free is on.')) : h('span', null, 'Hands-free is off.'),
      timer.armed() ? [' ', h('span', null, 'Sleep timer is on.')] : null, L.locked ? [' ', h('span', null, 'Touch is locked.')] : null]);
    el.state.classList.toggle('on', running || timer.armed() || L.locked);
  }

  function card(st) {
    if (el.card && el.card.isConnected) return el.card;
    /* the layer: lives inside the stage, so it is shown in full screen too */
    el.coverText = h('p', { class: 'aw-cover-text' }); el.coverSub = h('p', { class: 'aw-cover-sub', 'aria-hidden': 'true' });
    el.cover = h('div', { class: 'aw-cover', hidden: true }, el.coverText, el.coverSub);
    const wakeUp = () => { if (!coverOn || L.locked || S.phase === 'gap' || S.phase === 'playing') return; uncover(); if (S.phase === 'done' || S.phase === 'idle') leaveFullscreen(); };
    el.cover.addEventListener('click', wakeUp);
    document.addEventListener('keydown', e => { if (coverOn && !L.locked && (S.phase === 'done' || S.phase === 'idle' || S.phase === 'ending')) wakeUp(e); });
    el.countLabel = h('span', null, 'Sleep in'); el.countTime = h('span', { class: 'aw-count-time' });
    el.count = h('button', { type: 'button', class: 'aw-count', hidden: true, 'aria-label': 'Cancel the sleep timer', onclick: cancelSleep }, el.countLabel, ' ', el.countTime, h('span', { class: 'aw-count-x' }, ' · tap to cancel'));
    /* in full screen the page's own buttons are out of reach: one dim button (shown on any touch, mouse move or key) ends hands-free */
    el.end = h('button', { type: 'button', class: 'aw-end', hidden: true, onclick: () => dispatch({ type: 'abort' }) }, '■ End hands-free');
    const screen = st && st.querySelector('.screen');
    if (screen) { screen.appendChild(el.cover); screen.appendChild(el.count); screen.appendChild(el.end); }
    if (st) {
      let awake = 0;
      const wake = () => { st.classList.add('aw-awake'); clearTimeout(awake); awake = setTimeout(() => st.classList.remove('aw-awake'), 4000); };
      ['pointerdown', 'pointermove', 'keydown'].forEach(n => st.addEventListener(n, wake, { passive: true }));
    }
    buildShield();
    if (st) st.appendChild(el.shield);

    el.go = h('button', { type: 'button', class: 'btn aw-go', onclick: () => { if (S.phase === 'playing' || S.phase === 'gap' || S.phase === 'ending') dispatch({ type: 'abort' }); else startHandsFree(); } }, '▶ Start hands-free');
    const rep = h('select', { id: 'aw-repeat', onchange: e => { settings.repeat = e.target.value; save(); if (S.phase !== 'idle' && S.phase !== 'done') S = Object.assign({}, S, { repeat: settings.repeat }); } },
      optionList([['off', 'Play each once'], ['all', 'Repeat the whole line-up'], ['one', 'Repeat this title']], settings.repeat));
    const gap = h('select', { id: 'aw-gap', onchange: e => { settings.gapSec = +e.target.value; save(); } },
      optionList(A.GAP_CHOICES.map(g => [g, g ? `${g} seconds of quiet between titles` : 'No pause between titles']), settings.gapSec));
    const sl = h('select', { id: 'aw-sleep' },
      optionList([[0, 'Choose a time']].concat(A.SLEEP_CHOICES.map(m => [m, `${m} minutes`])).concat([['title', 'End of this title']]), settings.sleep));
    el.sleepGo = h('button', { type: 'button', class: 'btn', onclick: () => {
      if (timer.armed()) { cancelSleep(); return; }
      const v = sl.value === 'title' ? 'title' : +sl.value;
      if (!v) { sl.focus(); say('Choose a time for the sleep timer first.'); return; }
      startSleep(v);
    } }, 'Start sleep timer');
    const showCount = h('input', { type: 'checkbox', id: 'aw-showcount', checked: settings.showCount, onchange: e => { settings.showCount = e.target.checked; save(); if (!settings.showCount) el.count.hidden = true; } });
    el.lockBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => { if (!L.locked) lockOn(); } }, '🔓 Lock touch');
    el.state = h('p', { class: 'aw-state' });
    el.status = h('p', { class: 'fine', role: 'status', 'aria-live': 'polite' });
    el.wake = h('p', { class: 'fine', role: 'status', 'aria-live': 'polite' });

    el.card = h('section', { class: 'card anywhere-card', 'aria-labelledby': 'aw-title' },
      h('h2', { id: 'aw-title' }, '🌙 Hands-free, sleep timer and touch lock'),
      h('p', { class: 'muted' }, 'Start once and the line-up plays through by itself, full screen, with no touching. It uses tonight’s line-up if you built one, otherwise every open video in order.'),
      h('div', { class: 'aw-grid' },
        h('div', { class: 'aw-block' },
          h('h3', null, 'Hands-free'),
          h('div', { class: 'row' }, el.go),
          h('label', { for: 'aw-repeat' }, 'Order and repeat'), rep,
          h('label', { for: 'aw-gap' }, 'Between titles'), gap),
        h('div', { class: 'aw-block' },
          h('h3', null, 'Sleep timer'),
          h('label', { for: 'aw-sleep' }, 'Stop playing after'), sl,
          h('div', { class: 'row' }, el.sleepGo),
          h('label', { class: 'check' }, showCount, h('span', null, 'Show a small countdown on the picture')),
          h('p', { class: 'fine' }, 'The sound fades out gently, then it pauses and the position is saved. It only stops the film; it makes no promise about sleep.')),
        h('div', { class: 'aw-block' },
          h('h3', null, 'Touch lock'),
          h('div', { class: 'row' }, el.lockBtn),
          h('p', { class: 'fine' }, 'While locked, taps and swipes on this page do nothing. To unlock, press and hold the corner button for two seconds.'),
          h('p', { class: 'fine aw-note' }, A.LOCK_NOTE))),
      el.state, el.status, el.wake,
      h('p', { class: 'fine' }, h('a', { href: '#/anywhere' }, 'Theater anywhere: a guide for the backyard, camp, bedside and the bath'), '. ', h('strong', null, A.SAFETY)));
    render();
    return el.card;
  }

  /* ---------- the Theater anywhere guide ---------- */
  const li = t => h('li', null, t);
  function guide(root) {
    root.appendChild(h('header', { class: 'view-head' },
      h('h1', null, 'Theater anywhere'),
      h('p', { class: 'lede' }, 'Ideas for watching in the backyard, at camp, in the bathroom and by the bed, and the safety rules that come first.')));
    root.appendChild(h('section', { class: 'card aw-safety', 'aria-labelledby': 'aw-g-safe' },
      h('h2', { id: 'aw-g-safe' }, 'Safety comes first'),
      h('p', { class: 'aw-bold' }, A.SAFETY),
      h('ul', { class: 'aw-list' },
        li('Use only devices rated for the place you use them. Read the maker’s own rating and limits. A water-resistance rating comes from a lab test; it does not promise safety in hot water, steam, soap or salt water, and it can wear off with age.'),
        li('Nothing connected to the mains in or near a bath or shower. No charger, extension lead, laptop on charge, plug-in projector or speaker.'),
        li('No screens while driving. A vehicle is not a theater. In a parked vehicle, keep any screen out of the driver’s sight. Never run a projector from a moving vehicle.'),
        li('Keep projectors, power banks and cables away from fires, candles, stoves and heaters. Keep the vents clear. Do not cover a projector. Do not charge a wet device, and do not leave a phone or power bank in a hot, damp place.'),
        li('A bathtub is a drowning risk with or without a screen. Never leave a child alone in a bath for a film.'),
        li('Public showings may need the film’s licence and the venue’s permission. Follow fire bans, noise rules and quiet hours.')),
      h('p', { class: 'aw-bold' }, A.SAFETY)));
    const place = (id, title, safe, items) => h('section', { class: 'card', 'aria-labelledby': id },
      h('h2', { id }, title), safe ? h('p', { class: 'aw-bold' }, safe) : null, h('ul', { class: 'aw-list' }, items.map(li)));
    root.appendChild(place('aw-g-yard', 'Backyard', null, [
      'Put the projector on something flat and steady, and weigh the screen down against wind.',
      'Keep cables out of walking paths.',
      'Wait for full dark. A dark yard hides uneven ground, so keep a dim red light to find your way.',
      'Choose a speaker that carries but does not annoy the neighbours.',
      'Plan for insects, and for weather ending the night.']));
    root.appendChild(place('aw-g-camp', 'Camp', null, [
      'Plan battery or power bank for the length of the film plus a margin. Claimed battery times are often far more than you get at full brightness.',
      'Keep the projector away from the fire, and away from dew and damp.',
      'Use a dim red light to find the way, and leave no trace.']));
    root.appendChild(place('aw-g-bath', 'Bath and bathroom', A.SAFETY, [
      'Watch from outside the wet area, on a battery device, or use a device made for the room and installed by a qualified person.',
      'Do not rest a device on the edge of a bath, or anywhere it can be knocked into water.',
      'Touch lock makes this page ignore touches. The wet screen, the power button and the system gestures still reach the device.',
      'Do not play loud sound that hides real sounds, such as a smoke alarm or a child.']));
    root.appendChild(place('aw-g-bed', 'Bedside', null, [
      'Point a projector at a wall or the ceiling, not at a person.',
      'Keep the device charging on a hard surface away from the bed, never on a pillow or blanket, and keep every vent clear.',
      'Turn on the sleep timer and the touch lock before you settle.']));
    root.appendChild(h('section', { class: 'card', 'aria-labelledby': 'aw-g-tools' },
      h('h2', { id: 'aw-g-tools' }, 'What the three tools do and do not do'),
      h('ul', { class: 'aw-list' },
        li('Hands-free plays the line-up in order, full screen, and asks the browser to keep the screen awake. A browser can refuse that on power saving or low battery, and the app says so when it does. You still open the video files once each time you start the app: browsers cannot reopen them for you.'),
        li('Sleep timer fades the sound, then pauses and saves where you stopped. Some phones and tablets do not let a page change the volume; then it pauses on time without the fade.'),
        li(['Touch lock ignores touches on this page only.', ' ', A.LOCK_NOTE, ' ', 'Your device’s own buttons, gestures and alerts still work: the page cannot block them.']))));
    root.appendChild(h('p', null, h('a', { class: 'btn', href: '#/theater' }, '← Back to the Theater')));
  }
  SIT.view('anywhere', { title: 'Theater anywhere', navAs: 'theater', mount: guide });

  /* ---------- Kids' limits ended the session (called from js/controls.js before it leaves the page) ---------- */
  function endGracefully(why) {
    lockForceOff(why || 'limit');
    const v = video(); if (v && !v.paused) v.pause();
    timer.cancel(); restoreVolume();
    if (S.phase !== 'idle' && S.phase !== 'done') dispatch({ type: 'abort' }); else { wakeRelease(); render(); }
    clearTimeout(quietId); if (el.cover) { el.cover.hidden = true; el.cover.classList.remove('on'); coverOn = false; }
    if (el.count) el.count.hidden = true;
    leaveFullscreen(); stopLoop();
  }

  SIT.anywhere = { card, endGracefully, startHandsFree, startSleep, cancelSleep, lockOn, isLocked: () => L.locked, phase: () => S.phase };
})();
