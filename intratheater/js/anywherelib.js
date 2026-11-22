/* Stark IntraTheater by Stark. Anywhere (1.1.0): pure logic with no DOM and no timers of its own, shared by the app and the node tests.
   Hands-free queue order and session states, the sleep timer (it only reads the clock it is given, so tests can use a fake one),
   the touch-lock state machine, and the saved settings (with a migration for data from before 1.1.0). */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SIT = G.SIT = G.SIT || {};

  const SAFETY = 'Stark software cannot make any device waterproof or safe near water.';
  const LOCK_NOTE = 'Touch lock only protects this page. It does not make your device waterproof.';
  const SETTINGS_VERSION = 1;
  const SLEEP_CHOICES = [15, 30, 45, 60];      // minutes; 'title' (end of this title) is the other choice
  const GAP_CHOICES = [0, 5, 10, 30];          // quiet seconds between two titles
  const REPEAT_CHOICES = ['off', 'all', 'one'];
  const FADE_MS = 60000, FADE_TITLE_MS = 15000, HOLD_MS = 2000;

  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const clamp01 = x => (x > 1 ? 1 : x > 0 ? x : 0);

  /* ---------- saved settings ---------- */
  function defaultSettings() { return { v: SETTINGS_VERSION, gapSec: 5, repeat: 'off', sleep: 0, showCount: true }; }
  /* Anything (nothing saved, a damaged value, a newer or older shape) becomes a valid settings object; unknown fields are dropped. */
  function sanitizeSettings(x) {
    const d = defaultSettings();
    if (!x || typeof x !== 'object' || Array.isArray(x)) return d;
    if (GAP_CHOICES.indexOf(x.gapSec) >= 0) d.gapSec = x.gapSec;
    if (REPEAT_CHOICES.indexOf(x.repeat) >= 0) d.repeat = x.repeat;
    if (x.sleep === 'title' || SLEEP_CHOICES.indexOf(x.sleep) >= 0) d.sleep = x.sleep;
    if (typeof x.showCount === 'boolean') d.showCount = x.showCount;
    return d;
  }

  /* ---------- hands-free order ---------- */
  /* Next index in a list of n playable titles, or -1 when the line-up is finished. repeat: 'off' | 'all' | 'one'. */
  function nextIndex(n, idx, repeat) {
    if (!(n > 0)) return -1;
    if (!(idx >= 0 && idx < n)) return 0;
    if (repeat === 'one') return idx;
    if (idx + 1 < n) return idx + 1;
    return repeat === 'all' ? 0 : -1;
  }
  const prevIndex = idx => (idx > 0 ? idx - 1 : 0);
  /* Playable keys, in order: the line-up if one is built and any of it is open, else every opened title. */
  function playOrder(queueKeys, itemKeys) {
    const have = {}; itemKeys.forEach(k => { have[k] = 1; });
    const q = queueKeys.filter((k, i) => have[k] && queueKeys.indexOf(k) === i);
    return q.length ? q : itemKeys.slice();
  }

  /* The session: phases idle | playing | gap | ending | done.
     State { phase, idx, next, n, repeat, locked }. Events: start{n,repeat}, ended, gapDone, next, prev, endDone, sleepFired, lockToggle, abort.
     Returns a NEW state with act: null | 'load' (play state.idx) | 'gap' (wait, then gapDone; state.next is the title after) | 'fade' (finish with a fade to black) | 'stop'.
     Locking never changes playback. */
  const idle = () => ({ phase: 'idle', idx: -1, next: -1, n: 0, repeat: 'off', locked: false, act: null });
  function sessionReduce(s, ev) {
    s = s || idle();
    const o = Object.assign({}, s, { act: null });
    switch (ev && ev.type) {
      case 'start': {
        const n = Math.floor(num(ev.n, 0));
        if (n < 1) return Object.assign(o, { phase: 'idle' });
        return Object.assign(o, { phase: 'playing', idx: 0, next: -1, n, repeat: REPEAT_CHOICES.indexOf(ev.repeat) >= 0 ? ev.repeat : 'off', act: 'load' });
      }
      case 'ended': {
        if (s.phase !== 'playing') return o;
        const nx = nextIndex(s.n, s.idx, s.repeat);
        if (nx < 0) return Object.assign(o, { phase: 'ending', next: -1, act: 'fade' });
        return Object.assign(o, { phase: 'gap', next: nx, act: 'gap' });
      }
      case 'gapDone':
        if (s.phase !== 'gap') return o;
        return Object.assign(o, { phase: 'playing', idx: s.next, next: -1, act: 'load' });
      case 'next': {
        if (s.phase !== 'playing' && s.phase !== 'gap') return o;
        const from = s.phase === 'gap' ? s.next : s.idx;
        const nx = from + 1 < s.n ? from + 1 : s.repeat === 'off' ? -1 : 0;      // a manual skip always moves on, even in repeat-one
        if (nx < 0) return Object.assign(o, { phase: 'ending', next: -1, act: 'fade' });
        return Object.assign(o, { phase: 'playing', idx: nx, next: -1, act: 'load' });
      }
      case 'prev':
        if (s.phase !== 'playing' && s.phase !== 'gap') return o;
        return Object.assign(o, { phase: 'playing', idx: prevIndex(s.phase === 'gap' ? s.next : s.idx), next: -1, act: 'load' });
      case 'endDone':
        return s.phase === 'ending' ? Object.assign(o, { phase: 'done', act: 'stop' }) : o;
      case 'sleepFired':
        return s.phase === 'idle' || s.phase === 'done' ? o : Object.assign(o, { phase: 'done', next: -1, act: 'stop' });
      case 'lockToggle':
        return Object.assign(o, { locked: !s.locked });
      case 'abort':
        return s.phase === 'idle' || s.phase === 'done' ? o : Object.assign(o, { phase: 'done', next: -1, act: 'stop' });
      default:
        return o;
    }
  }

  /* ---------- sleep timer ---------- */
  /* Volume factor 0..1: 1 before the fade window, falling smoothly to 0 at the end, never outside 0..1. */
  function fadeGain(remainingMs, fadeMs) {
    const f = num(fadeMs, FADE_MS), r = remainingMs === Infinity ? Infinity : num(remainingMs, 0);
    if (r <= 0) return 0;
    if (!(f > 0) || r >= f) return 1;
    const x = r / f;
    return clamp01(x * x * (3 - 2 * x));      // smoothstep: gentle at both ends
  }
  /* A sleep timer that only knows the clock it is handed. choice: 15 | 30 | 45 | 60 (minutes) or 'title' (until this title ends).
     tick(nowMs, titleLeftMs) -> { state: 'off' | 'running' | 'fading' | 'fired', remainingMs, gain }.
     A title with an unknown length (titleLeftMs not finite) simply runs to its end event (ended()). */
  function sleepTimer() {
    let choice = 0, endAt = 0, firedFlag = false;
    const t = {
      arm(c, nowMs) {
        if (c === 'title') { choice = 'title'; endAt = 0; } else if (SLEEP_CHOICES.indexOf(c) >= 0) { choice = c; endAt = num(nowMs, 0) + c * 60000; } else return false;
        firedFlag = false; return true;
      },
      cancel() { choice = 0; endAt = 0; firedFlag = false; },
      armed() { return choice !== 0; },
      choice() { return choice; },
      ended() { if (choice === 'title') { firedFlag = true; } return firedFlag; },
      tick(nowMs, titleLeftMs) {
        if (!choice) return { state: 'off', remainingMs: 0, gain: 1 };
        if (firedFlag) return { state: 'fired', remainingMs: 0, gain: 0 };
        let rem, fade;
        if (choice === 'title') { rem = num(titleLeftMs, Infinity); fade = FADE_TITLE_MS; } else { rem = endAt - num(nowMs, 0); fade = FADE_MS; }
        if (rem <= 0) { firedFlag = true; return { state: 'fired', remainingMs: 0, gain: 0 }; }
        const gain = fadeGain(rem, fade);
        return { state: gain < 1 ? 'fading' : 'running', remainingMs: rem, gain };
      }
    };
    return t;
  }
  /* "14:59", "1:00:00"; rounds up so the display never says 0:00 while time is left. */
  function fmtRemaining(ms) {
    const s = Math.max(0, Math.ceil(num(ms, 0) / 1000)), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = n => (n < 10 ? '0' : '') + n;
    return hh ? hh + ':' + p(mm) + ':' + p(ss) : mm + ':' + p(ss);
  }

  /* ---------- touch lock ---------- */
  /* How far a deliberate hold has come, 0..1. A clock that goes backwards counts as no progress. */
  function holdProgress(downAt, nowMs, needMs) {
    const need = num(needMs, HOLD_MS), a = num(downAt, NaN), n = num(nowMs, NaN);
    if (!(need > 0) || isNaN(a) || isNaN(n)) return 0;
    return clamp01((n - a) / need);
  }
  /* The lock: { locked, holding, downAt, pointers }. Events: lock, down{id,at,onTarget,key}, move{id,onTarget}, up{id}, cancel, tick{at}.
     Unlock needs ONE pointer (or the U key) held on the unlock target for HOLD_MS with no other pointer down; a second finger,
     leaving the target, lifting, or any cancel starts over. A tap does nothing but show the hint (hint: true). */
  const unlocked = () => ({ locked: false, holding: false, downAt: 0, pointers: 0, id: null, hint: false, unlocked: false });
  function lockReduce(s, ev) {
    s = s || unlocked();
    const o = Object.assign({}, s, { hint: false, unlocked: false });
    const reset = () => Object.assign(o, { holding: false, downAt: 0, id: null });
    switch (ev && ev.type) {
      case 'lock': return Object.assign(o, { locked: true, holding: false, downAt: 0, pointers: 0, id: null });
      case 'down': {
        if (!s.locked) return o;
        o.pointers = s.pointers + (ev.key ? 0 : 1);
        if (o.pointers > 1 || (ev.key && s.pointers > 0)) return reset();   // a second touch, or a touch beside the key: water, a palm, a bump
        if (ev.onTarget || ev.key) return Object.assign(o, { holding: true, downAt: num(ev.at, 0), id: ev.id });
        return Object.assign(o, { hint: true });
      }
      case 'move':
        if (s.holding && ev.id === s.id && !ev.onTarget) return reset();
        return o;
      case 'up': {
        if (!s.locked) return o;
        o.pointers = Math.max(0, s.pointers - (ev.key ? 0 : 1));
        if (s.holding && (ev.key || ev.id === s.id)) return Object.assign(reset(), { hint: true });
        return o;
      }
      case 'cancel': return Object.assign(reset(), { pointers: 0 });
      case 'tick':
        if (s.locked && s.holding && holdProgress(s.downAt, ev.at, HOLD_MS) >= 1) return Object.assign(o, { locked: false, holding: false, downAt: 0, pointers: 0, id: null, unlocked: true });
        return o;
      default: return o;
    }
  }

  SIT.anywherelib = { SAFETY, LOCK_NOTE, SETTINGS_VERSION, SLEEP_CHOICES, GAP_CHOICES, REPEAT_CHOICES, FADE_MS, FADE_TITLE_MS, HOLD_MS,
    defaultSettings, sanitizeSettings, nextIndex, prevIndex, playOrder, idle, sessionReduce, fadeGain, sleepTimer, fmtRemaining, holdProgress, unlocked, lockReduce };
})();
