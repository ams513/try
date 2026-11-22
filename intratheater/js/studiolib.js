/* Stark IntraTheater by Stark. Movie Studio maths: pure functions with no DOM, shared by the app
   and the node tests. Timeline layout, transitions, trims, splits, undo history, photo motion, generated
   music scores, the project bundle format and a WebM duration fix. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SIT = G.SIT = G.SIT || {};

  const MIN = 0.3;          // shortest clip, seconds
  const MAX_DUR = 600;      // longest photo or title card, seconds
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);
  const clone = o => JSON.parse(JSON.stringify(o));

  const TRANS = { cut: 'Cut', cross: 'Crossfade', fade: 'Fade to black' };
  const LOOKS = {
    none: { label: 'Natural', filter: 'none' },
    warm: { label: 'Warm sun', filter: 'sepia(.22) saturate(1.18) brightness(1.03)', tint: ['rgba(255,170,90,.10)', 'soft-light'] },
    cool: { label: 'Cool morning', filter: 'saturate(.94) brightness(1.03)', tint: ['rgba(90,150,255,.16)', 'soft-light'] },
    vivid: { label: 'Vivid', filter: 'saturate(1.45) contrast(1.08)' },
    mono: { label: 'Black and white', filter: 'grayscale(1) contrast(1.12) brightness(1.02)', vignette: 0.25 },
    vintage: { label: 'Old film', filter: 'sepia(.55) contrast(.92) brightness(1.04) saturate(.9)', vignette: 0.35 },
    dreamy: { label: 'Dreamy', filter: 'brightness(1.08) contrast(.88) saturate(.9)', tint: ['rgba(255,214,236,.14)', 'screen'] },
    film: { label: 'Cinema', filter: 'contrast(1.12) saturate(.86)', tint: ['rgba(20,50,70,.14)', 'soft-light'], vignette: 0.45 }
  };
  const TITLE_STYLES = { classic: 'Classic gold', modern: 'Modern', storybook: 'Storybook', chalk: 'Chalkboard', party: 'Party', trailer: 'Trailer' };
  const CAPTION_STYLES = { subtitle: 'Subtitle', lower: 'Name strip', bubble: 'Speech bubble' };
  const MOTIONS = {
    still: { label: 'Still', from: { s: 1, x: 0.5, y: 0.5 }, to: { s: 1, x: 0.5, y: 0.5 } },
    'zoom-in': { label: 'Slow zoom in', from: { s: 1, x: 0.5, y: 0.5 }, to: { s: 1.18, x: 0.5, y: 0.46 } },
    'zoom-out': { label: 'Slow zoom out', from: { s: 1.18, x: 0.5, y: 0.46 }, to: { s: 1, x: 0.5, y: 0.5 } },
    'pan-left': { label: 'Drift left', from: { s: 1.14, x: 0.62, y: 0.5 }, to: { s: 1.14, x: 0.38, y: 0.5 } },
    'pan-right': { label: 'Drift right', from: { s: 1.14, x: 0.38, y: 0.5 }, to: { s: 1.14, x: 0.62, y: 0.5 } },
    'pan-up': { label: 'Drift up', from: { s: 1.14, x: 0.5, y: 0.62 }, to: { s: 1.14, x: 0.5, y: 0.38 } }
  };

  /* ---------- clips and layout ---------- */
  function len(c) { return c.kind === 'video' ? Math.max(0, num(c.out, 0) - num(c.in, 0)) : Math.max(0, num(c.dur, 0)); }
  function transType(c) { const t = c && c.trans && c.trans.type; return TRANS[t] ? t : 'cut'; }
  /* Effective transition length into clip c: never more than half of either neighbour, so overlaps never stack. */
  function transDur(prev, c) {
    const type = transType(c);
    if (type === 'cut') return 0;
    const cap = (prev ? Math.min(len(prev), len(c)) : len(c)) / 2;
    return clamp(num(c.trans.dur, 0.8), 0, cap);
  }
  /* Start and end of every clip. A crossfade overlaps the previous clip; fade to black and cut do not.
     A crossfade into the very first clip has nothing to cross from, so it fades in from black. */
  function layout(clips) {
    const items = []; let end = 0;
    clips.forEach((c, i) => {
      const prev = i ? clips[i - 1] : null;
      let type = transType(c);
      const d = transDur(prev, c);
      if (!i && type === 'cross') type = 'fade';
      const start = i && type === 'cross' ? end - d : end;
      const L = len(c);
      items.push({ id: c.id, i, start, end: start + L, len: L, type: d > 0 ? type : 'cut', d });
      end = start + L;
    });
    return { items, total: end };
  }
  const totalDuration = clips => layout(clips).total;

  /* What to draw and hear at time t: layers bottom-up with picture alpha and audio gain, plus a black overlay. */
  function frameState(clips, lay, t, opts) {
    const endFade = num(opts && opts.endFade, 0);
    const out = { layers: [], black: 0 };
    if (!lay.items.length) return out;
    if (t >= lay.total) t = Math.max(0, lay.total - 1e-6);
    if (t < 0) t = 0;
    lay.items.forEach((it, k) => {
      if (!(t >= it.start && t < it.end)) return;
      const c = clips[it.i], next = lay.items[k + 1], local = t - it.start;
      let alpha = 1, gain = 1;
      if (it.type === 'cross' && local < it.d) { const p = local / it.d; alpha = p; gain = Math.sin(p * Math.PI / 2); }
      if (next && next.type === 'cross' && t >= next.start) gain *= Math.cos(clamp((t - next.start) / next.d, 0, 1) * Math.PI / 2);
      if (it.type === 'fade' && local < it.d / 2) out.black = Math.max(out.black, 1 - local / (it.d / 2));
      if (next && next.type === 'fade' && it.end - t < next.d / 2) out.black = Math.max(out.black, 1 - (it.end - t) / (next.d / 2));
      if (!next && endFade > 0 && it.end - t < endFade) out.black = Math.max(out.black, 1 - (it.end - t) / Math.min(endFade, it.len));
      out.layers.push({ i: it.i, id: c.id, local, src: c.kind === 'video' ? num(c.in, 0) + local : local, alpha, gain });
    });
    out.black = clamp(out.black, 0, 1);
    return out;
  }
  /* The clip that owns time t: the top one when two overlap. */
  function clipIndexAt(lay, t) {
    let found = -1;
    lay.items.forEach(it => { if (t >= it.start && t < it.end) found = it.i; });
    if (found < 0 && lay.items.length && t >= lay.total) found = lay.items[lay.items.length - 1].i;
    return found;
  }

  /* ---------- edits (all return new arrays or objects) ---------- */
  function trimIn(c, v) { const o = clone(c); o.in = clamp(num(v, 0), 0, o.out - MIN); return o; }
  function trimOut(c, v) { const o = clone(c); o.out = clamp(num(v, o.out), o.in + MIN, num(o.src, o.out)); return o; }
  function setDur(c, v) { const o = clone(c); o.dur = clamp(num(v, MIN), MIN, MAX_DUR); return o; }
  /* Make a clip longer or shorter by dt seconds (videos change their out point). */
  function nudgeLength(c, dt) { return c.kind === 'video' ? trimOut(c, c.out + dt) : setDur(c, len(c) + dt); }
  function mix(a, b, p) { return { s: a.s + (b.s - a.s) * p, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }; }
  function motionOf(c) { return c.kb && c.kb.from && c.kb.to ? c.kb : MOTIONS.still; }
  const kbAt = (kb, p) => mix(kb.from, kb.to, clamp(p, 0, 1));
  /* Split clip idx at `at` seconds into it. Photo motion and voice-overs carry on seamlessly. */
  function split(clips, idx, at, newId) {
    const c = clips[idx];
    if (!c) return null;
    const L = len(c);
    if (!(at >= MIN && L - at >= MIN)) return null;
    const a = clone(c), b = clone(c);
    b.id = newId;
    b.trans = { type: 'cut', dur: num(c.trans && c.trans.dur, 0.8) };
    delete b.slot;
    if (c.kind === 'video') { a.out = c.in + at; b.in = c.in + at; }
    else { a.dur = at; b.dur = L - at; }
    if (c.kind === 'photo' && c.kb) { const mid = kbAt(c.kb, at / L); a.kb = { from: clone(c.kb.from), to: mid }; b.kb = { from: mid, to: clone(c.kb.to) }; }
    if (c.voice) b.voice = Object.assign({}, c.voice, { off: num(c.voice.off, 0) + at });
    return clips.slice(0, idx).concat([a, b], clips.slice(idx + 1));
  }
  function move(clips, from, to) {
    if (from < 0 || from >= clips.length) return clips.slice();
    to = clamp(to, 0, clips.length - 1);
    const out = clips.slice(); out.splice(to, 0, out.splice(from, 1)[0]);
    return out;
  }
  const remove = (clips, idx) => clips.filter((_, i) => i !== idx);
  /* Where a dragged clip lands: the slot whose centre the pointer passed. */
  function dropIndex(lay, from, x) {
    let to = 0;
    lay.items.forEach(it => { if (it.i !== from && x > it.start + it.len / 2) to++; });
    return to;
  }
  const exportClips = clips => clips.filter(c => !c.slot && len(c) >= MIN);
  function mediaIds(p) {
    const ids = new Set();
    (p.clips || []).forEach(c => { if (c.media) ids.add(c.media); if (c.voice && c.voice.media) ids.add(c.voice.media); });
    if (p.music && p.music.kind === 'file' && p.music.media) ids.add(p.music.media);
    return Array.from(ids);
  }

  /* ---------- photo motion: the part of the picture to show, always inside the picture ---------- */
  function kbRect(iw, ih, ow, oh, v) {
    const s = Math.max(1, num(v.s, 1));
    const base = Math.max(ow / iw, oh / ih) * s;          // cover, then zoom
    const sw = Math.min(iw, ow / base), sh = Math.min(ih, oh / base);
    const sx = clamp(v.x * iw - sw / 2, 0, iw - sw), sy = clamp(v.y * ih - sh / 2, 0, ih - sh);
    return { sx, sy, sw, sh };
  }
  function fitRect(iw, ih, ow, oh, cover) {
    const k = cover ? Math.max(ow / iw, oh / ih) : Math.min(ow / iw, oh / ih);
    const w = iw * k, hh = ih * k;
    return { x: (ow - w) / 2, y: (oh - hh) / 2, w, h: hh };
  }

  /* ---------- music bed level: fade in, fade out, and duck under speech ---------- */
  function duckRegions(clips, lay) {
    const segs = [];
    lay.items.forEach(it => {
      const c = clips[it.i];
      const loud = (c.kind === 'video' && num(c.vol, 1) > 0.05) || (c.voice && c.voice.media && num(c.voice.vol, 1) > 0.05);
      if (!loud) return;
      const last = segs[segs.length - 1];
      if (last && it.start <= last[1] + 0.5) last[1] = Math.max(last[1], it.end); else segs.push([it.start, it.end]);
    });
    return segs;
  }
  function musicLevel(t, total, vol, regions, duckTo) {
    let g = num(vol, 0.5);
    g *= clamp(t / 1.2, 0, 1) * clamp((total - t) / 2, 0, 1);
    if (regions && duckTo < 1) {
      let d = 1;
      regions.forEach(r => { const inside = t < r[0] ? r[0] - t : t > r[1] ? t - r[1] : 0; d = Math.min(d, duckTo + (1 - duckTo) * clamp(inside / 0.4, 0, 1)); });
      g *= d;
    }
    return clamp(g, 0, 1);
  }

  /* ---------- undo / redo ---------- */
  const history = limit => ({ past: [], future: [], limit: limit || 100 });
  function record(hs, snap) { hs.past.push(snap); if (hs.past.length > hs.limit) hs.past.shift(); hs.future.length = 0; }
  function undo(hs, cur) { if (!hs.past.length) return null; hs.future.push(cur); return hs.past.pop(); }
  function redo(hs, cur) { if (!hs.future.length) return null; hs.past.push(cur); return hs.future.pop(); }

  /* ---------- generated music: original note patterns, rendered by WebAudio in the app ---------- */
  const TRACKS = {
    sunny: { label: 'Sunny Afternoon', mood: 'Bright and gentle', bpm: 96, key: 60, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]] },
    party: { label: 'Party Time', mood: 'Bouncy and fun', bpm: 118, key: 65, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
    curious: { label: 'Curious Mind', mood: 'Light, for explaining things', bpm: 90, key: 57, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]] },
    starlight: { label: 'Starlight', mood: 'Calm and warm', bpm: 66, key: 57, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]] },
    epic: { label: 'Epic Tale', mood: 'Big and dramatic', bpm: 84, key: 50, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]] }
  };
  function seeded(str) {
    let s = 2166136261; for (let i = 0; i < str.length; i++) s = Math.imul(s ^ str.charCodeAt(i), 16777619);
    return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  /* One seamless loop of 8 bars (the chord progression twice, busier the second time). */
  function musicScore(id) {
    const T = TRACKS[id]; if (!T) return null;
    const rnd = seeded(id), b = 60 / T.bpm, ev = [];
    const n = (t, d, m, v, w, pan) => ev.push({ t: t * b, d: d * b, m, v, w, pan: pan || 0 });
    for (let bar = 0; bar < 8; bar++) {
      const ch = T.prog[bar % 4], root = T.key + ch[0], t0 = bar * 4, second = bar >= 4;
      const tones = ch.map(x => T.key + 12 + x).concat([T.key + 24 + ch[0]]);
      if (id === 'sunny') {
        [0, 1, 2, 3, 2, 1, 0, 2].forEach((k, j) => n(t0 + j / 2, 0.9, tones[k], j % 2 ? 0.32 : 0.42, 'pluck', -0.2));
        n(t0, 1.8, root - 12, 0.55, 'bass'); n(t0 + 2, 1.8, root - 12 + (bar % 2 ? 7 : 0), 0.5, 'bass');
        for (let j = 0; j < 4; j++) n(t0 + j + 0.5, 0.1, 0, 0.12, 'hat', 0.3);
        if (second) n(t0, 2.5, tones[3] + 12, 0.22, 'bell', 0.2);
      } else if (id === 'party') {
        for (let j = 0; j < 8; j++) n(t0 + j / 2, 0.45, root - 12 + (j % 2 ? 12 : 0), 0.5, 'bass');
        for (let j = 0; j < 4; j++) { n(t0 + j + 0.5, 0.3, 0, 0.5, 'shaker', 0.2); ch.forEach(x => n(t0 + j + 0.5, 0.35, T.key + 12 + x, 0.16, 'lead', 0.15)); }
        n(t0, 0.4, 0, 0.9, 'kick'); n(t0 + 2, 0.4, 0, 0.9, 'kick'); n(t0 + 1, 0.3, 0, 0.6, 'clap'); n(t0 + 3, 0.3, 0, 0.6, 'clap');
        for (let j = 0; j < 8; j++) n(t0 + j / 2, 0.1, 0, j % 2 ? 0.14 : 0.08, 'hat', 0.35);
        if (second) [0, 2, 4, 7].forEach((k, j) => n(t0 + j, 0.8, T.key + 24 + [0, 4, 7, 12][(bar + j) % 4] + ch[0], 0.18, 'bell', -0.25));
      } else if (id === 'curious') {
        const scale = [0, 3, 5, 7, 10, 12, 15, 17];
        let k = 2 + Math.floor(rnd() * 3);
        for (let j = 0; j < 8; j++) {
          if (rnd() < (second ? 0.12 : 0.28)) continue;
          k = clamp(k + [-2, -1, 1, 2][Math.floor(rnd() * 4)], 0, scale.length - 1);
          n(t0 + j / 2, 0.6, T.key + 12 + scale[k], 0.42, 'mallet', j % 2 ? 0.25 : -0.25);
        }
        n(t0, 3.6, root - 12, 0.45, 'bass');
        for (let j = 0; j < 4; j++) n(t0 + j, 0.05, 0, j ? 0.12 : 0.2, 'tick', 0.1);
      } else if (id === 'starlight') {
        ch.forEach(x => n(t0, 4.2, T.key + x + 12, 0.2, 'pad'));
        n(t0, 4, root - 12, 0.35, 'bass');
        [0, 1.5, 2.5].forEach((o, j) => { if (second || j !== 1) n(t0 + o, 2, tones[(bar + j) % 4] + 12, 0.16, 'bell', j % 2 ? 0.3 : -0.3); });
      } else if (id === 'epic') {
        ch.forEach(x => n(t0, 4.2, T.key + x + 12, second ? 0.26 : 0.2, 'pad'));
        n(t0, 4, root - 12, 0.5, 'bass');
        [0, 1.5, 3].forEach(o => n(t0 + o, 0.8, 0, second ? 0.95 : 0.75, 'taiko'));
        if (second) { n(t0 + 2, 0.6, 0, 0.6, 'taiko'); n(t0, 1.9, root + 12, 0.2, 'lead'); n(t0 + 2, 1.9, root + 19, 0.2, 'lead'); }
        if (bar === 7) [3.5, 3.75].forEach(o => n(t0 + o, 0.3, 0, 0.6, 'taiko'));
      }
    }
    ev.sort((x, y) => x.t - y.t);
    return { id, bpm: T.bpm, seconds: 32 * b, events: ev };
  }
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------- recorder formats ---------- */
  const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];
  const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  function pickType(isSupported, list) { for (const t of list) { try { if (isSupported(t)) return t; } catch (e) { /* ignore */ } } return ''; }
  const extFor = type => (/mp4/.test(type) ? 'mp4' : /ogg/.test(type) ? 'ogg' : 'webm');

  /* ---------- projects ---------- */
  const STYLE_KEYS = Object.keys(TITLE_STYLES), CAP_KEYS = Object.keys(CAPTION_STYLES);
  const str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
  /* Clean up a project from storage or a bundle: drop anything malformed, clamp every number. */
  function sanitizeProject(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.clips)) throw new Error('not a project');
    let dropped = 0;
    const clips = [];
    p.clips.forEach(c => {
      if (!c || typeof c !== 'object' || ['video', 'photo', 'title'].indexOf(c.kind) < 0 || typeof c.id !== 'string') { dropped++; return; }
      const o = { id: str(c.id, 40), kind: c.kind, name: str(c.name, 120) };
      if (c.kind !== 'title') { if (typeof c.media !== 'string') { dropped++; return; } o.media = str(c.media, 40); }
      if (c.kind === 'video') {
        o.src = Math.max(MIN, num(c.src, 0));
        o.in = clamp(num(c.in, 0), 0, o.src - MIN);
        o.out = clamp(num(c.out, o.src), o.in + MIN, o.src);
        o.vol = clamp(num(c.vol, 1), 0, 2);
        o.fit = c.fit === 'fill' ? 'fill' : 'fit';
      } else o.dur = clamp(num(c.dur, 4), MIN, MAX_DUR);
      if (c.kind === 'photo') {
        o.fit = c.fit === 'fit' ? 'fit' : 'fill';
        const kb = c.kb && c.kb.from && c.kb.to ? c.kb : MOTIONS.still;
        const pt = v => ({ s: clamp(num(v.s, 1), 1, 2), x: clamp(num(v.x, 0.5), 0, 1), y: clamp(num(v.y, 0.5), 0, 1) });
        o.kb = { from: pt(kb.from), to: pt(kb.to) };
        o.motion = MOTIONS[c.motion] ? c.motion : 'custom';
      }
      if (c.kind === 'title') o.text = { title: str(c.text && c.text.title, 200), sub: str(c.text && c.text.sub, 200), style: STYLE_KEYS.indexOf(c.text && c.text.style) >= 0 ? c.text.style : 'classic' };
      if (c.slot) { o.slot = true; o.hint = str(c.hint, 160); }
      const t = transType(c);
      o.trans = { type: t, dur: clamp(num(c.trans && c.trans.dur, 0.8), 0.2, 3) };
      if (c.look && LOOKS[c.look]) o.look = c.look;
      if (c.cap && typeof c.cap.text === 'string' && c.cap.text) o.cap = { text: str(c.cap.text, 200), style: CAP_KEYS.indexOf(c.cap.style) >= 0 ? c.cap.style : 'subtitle' };
      if (c.voice && typeof c.voice.media === 'string') o.voice = { media: str(c.voice.media, 40), vol: clamp(num(c.voice.vol, 1), 0, 2), off: Math.max(0, num(c.voice.off, 0)) };
      clips.push(o);
    });
    const m = p.music || {};
    const music = m.kind === 'gen' && TRACKS[m.track] ? { kind: 'gen', track: m.track } : m.kind === 'file' && typeof m.media === 'string' ? { kind: 'file', media: str(m.media, 40), name: str(m.name, 120) } : { kind: 'none' };
    music.vol = clamp(num(m.vol, 0.5), 0, 1); music.duck = m.duck !== false;
    const project = {
      v: 1, id: typeof p.id === 'string' && p.id ? str(p.id, 40) : 'p' + Date.now().toString(36),
      name: str(p.name, 80) || 'My movie', created: num(p.created, 0), updated: num(p.updated, 0),
      template: str(p.template, 30), look: LOOKS[p.look] ? p.look : 'none', endFade: clamp(num(p.endFade, 1), 0, 3), music, clips
    };
    return { project, dropped };
  }

  /* ---------- templates ---------- */
  const T = (title, sub, style, extra) => Object.assign({ kind: 'title', dur: 3.5, text: { title, sub, style } }, extra || {});
  const S = (hint, extra) => Object.assign({ kind: 'title', slot: true, hint, dur: 3, text: { title: hint, sub: 'Tap here, then record or add photos and videos', style: 'storybook' } }, extra || {});
  const cross = { trans: { type: 'cross', dur: 1 } }, fade = { trans: { type: 'fade', dur: 1.2 } };
  const TEMPLATES = {
    trip: { label: 'Family trip', icon: '🧳', blurb: 'Roads, views and funny moments, with a warm summer look.', look: 'warm', music: 'sunny',
      clips: [T('Our Family Trip', 'A film by the whole family', 'classic', fade), S('🚗 Getting there', cross), S('🏞️ The best views', cross), T('The best bit', 'What did we love most?', 'storybook', fade), S('😄 Funny moments', fade), T('The End', 'Thanks for watching', 'classic', fade)] },
    birthday: { label: 'Birthday', icon: '🎂', blurb: 'Candles, presents and a party title card.', look: 'vivid', music: 'party',
      clips: [T('Happy Birthday!', 'Type the birthday star’s name here', 'party', fade), S('🎈 Getting ready', cross), S('🕯️ Blowing out the candles', cross), S('🎁 Presents and games', cross), T('Make a wish!', 'Love from all of us', 'party', fade)] },
    science: { label: 'Science report', icon: '🔬', blurb: 'Question, guess, experiment, results and what you learned.', look: 'none', music: 'curious', vol: 0.3,
      clips: [T('My Science Report', 'Your name · your class', 'chalk', fade), T('The question', 'What did you want to find out?', 'chalk', cross), T('My guess', 'What did you think would happen?', 'chalk', cross),
        S('🧪 The experiment', cross), S('📊 The results', cross), T('What I learned', 'Your conclusion in one sentence', 'chalk', cross), T('Thank you!', 'Any questions?', 'modern', fade)] },
    trailer: { label: 'Book trailer', icon: '📚', blurb: 'A dramatic movie-style trailer for a favourite book.', look: 'film', music: 'epic',
      clips: [T('In a world of pages…', '', 'trailer', fade), S('📖 Show the book cover', fade), T('One hero', 'Who is the main character?', 'trailer', fade), S('🎭 Act out a scene', fade),
        T('One problem', 'What stands in their way?', 'trailer', fade), T('The Book Title', 'Coming soon to a bookshelf near you', 'trailer', fade)] }
  };
  function fromTemplate(key, makeId, now) {
    const tp = TEMPLATES[key];
    const p = { v: 1, id: makeId(), name: tp ? tp.label : 'My movie', created: now, updated: now, template: tp ? key : '', look: tp ? tp.look : 'none', endFade: 1,
      music: tp ? { kind: 'gen', track: tp.music, vol: tp.vol || 0.5, duck: true } : { kind: 'none', vol: 0.5, duck: true }, clips: [] };
    if (tp) p.clips = tp.clips.map(c => Object.assign(clone(c), { id: makeId(), trans: clone(c.trans || { type: 'cut', dur: 0.8 }) }));
    return sanitizeProject(p).project;
  }

  /* ---------- bundle file: "STARKMOVIE1\n" + 10-digit header length + "\n" + JSON + media bytes ---------- */
  const MAGIC = 'STARKMOVIE1\n', PREFIX = MAGIC.length + 11;
  function bundleHeader(project, medias) {
    let off = 0;
    const entries = medias.map(m => { const e = { id: m.id, kind: m.kind, name: m.name, type: m.type, dur: m.dur || 0, w: m.w || 0, h: m.h || 0, thumb: m.thumb || '', off, size: m.size }; off += m.size; return e; });
    const json = new TextEncoder().encode(JSON.stringify({ app: 'stark-intratheater-movie', v: 1, project, media: entries }));
    return { prefix: MAGIC + String(json.length).padStart(10, '0') + '\n', json, dataBytes: off };   // json: UTF-8 bytes
  }
  function parsePrefix(text) {
    if (typeof text !== 'string' || text.slice(0, MAGIC.length) !== MAGIC || text[PREFIX - 1] !== '\n') throw new Error('not a Stark movie bundle');
    const n = text.slice(MAGIC.length, PREFIX - 1);
    if (!/^\d{10}$/.test(n)) throw new Error('damaged bundle');
    return { jsonLen: +n, start: PREFIX };
  }
  function checkBundle(obj, fileSize, dataStart) {
    if (!obj || obj.app !== 'stark-intratheater-movie' || !Array.isArray(obj.media)) throw new Error('not a Stark movie bundle');
    const media = obj.media.filter(e => e && typeof e.id === 'string' && ['video', 'photo', 'audio'].indexOf(e.kind) >= 0 &&
      Number.isInteger(e.off) && Number.isInteger(e.size) && e.off >= 0 && e.size > 0 && dataStart + e.off + e.size <= fileSize);
    if (media.length !== obj.media.length) throw new Error('damaged bundle');
    return { project: sanitizeProject(obj.project).project, media };
  }

  /* ---------- WebM duration fix: MediaRecorder leaves it out, so players can't seek. Patch it into Segment Info. ---------- */
  function readVint(b, p) {
    const first = b[p]; if (first === undefined) return null;
    let n = 1, mask = 0x80; while (n <= 8 && !(first & mask)) { n++; mask >>= 1; }
    if (n > 8) return null;
    let v = first & (mask - 1); for (let i = 1; i < n; i++) v = v * 256 + b[p + i];
    return { n, v, unknown: v === Math.pow(2, 7 * n) - 1 };
  }
  function findId(b, from, to, id) {
    outer: for (let p = from; p + id.length <= to; p++) { for (let k = 0; k < id.length; k++) if (b[p + k] !== id[k]) continue outer; return p; }
    return -1;
  }
  function webmSetDuration(bytes, ms) {
    const b = bytes;
    if (!(b && b.length > 40 && b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) || !(ms > 0)) return null;
    const info = findId(b, 4, Math.min(b.length, 4096), [0x15, 0x49, 0xA9, 0x66]);
    if (info < 0) return null;
    const sz = readVint(b, info + 4); if (!sz || sz.unknown) return null;
    const cStart = info + 4 + sz.n, cEnd = cStart + sz.v; if (cEnd > b.length) return null;
    let scale = 1e6, p = cStart; const kids = [];
    while (p < cEnd) {
      const idLen = readVint(b, p); if (!idLen) return null;
      const idEnd = p + idLen.n, s = readVint(b, idEnd); if (!s) return null;
      const dStart = idEnd + s.n, dEnd = dStart + s.v; if (dEnd > cEnd) return null;
      const id = (b[p] << 8 | b[p + 1]) >>> 0;
      if (idLen.n === 3 && b[p] === 0x2A && b[p + 1] === 0xD7 && b[p + 2] === 0xB1) { scale = 0; for (let i = dStart; i < dEnd; i++) scale = scale * 256 + b[i]; scale = scale || 1e6; }
      if (!(idLen.n === 2 && id === 0x4489)) kids.push([p, dEnd]);
      p = dEnd;
    }
    const dur = new Uint8Array(11); dur[0] = 0x44; dur[1] = 0x89; dur[2] = 0x88;
    new DataView(dur.buffer).setFloat64(3, ms * 1e6 / scale);
    let bodyLen = dur.length; kids.forEach(k => { bodyLen += k[1] - k[0]; });
    const head = new Uint8Array(4 + 8); head.set([0x15, 0x49, 0xA9, 0x66, 0x01]);
    let v = bodyLen; for (let i = 11; i >= 5; i--) { head[i] = v % 256; v = Math.floor(v / 256); }
    const out = new Uint8Array(info + head.length + bodyLen + (b.length - cEnd));
    out.set(b.subarray(0, info), 0); let q = info; out.set(head, q); q += head.length;
    kids.forEach(k => { out.set(b.subarray(k[0], k[1]), q); q += k[1] - k[0]; });
    out.set(dur, q); q += dur.length; out.set(b.subarray(cEnd), q);
    return out;
  }

  /* ---------- small formatting helpers ---------- */
  function fmtT(s, tenths) {
    s = Math.max(0, num(s, 0));
    const m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (tenths ? r.toFixed(1).padStart(4, '0') : String(Math.floor(r)).padStart(2, '0'));
  }
  function fmtBytes(n) {
    n = Math.max(0, num(n, 0));
    return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB';
  }
  const storageLevel = (used, quota) => (!(quota > 0) ? 'unknown' : used / quota >= 0.95 ? 'full' : used / quota >= 0.8 ? 'high' : 'ok');

  SIT.studioLib = {
    MIN, MAX_DUR, TRANS, LOOKS, TITLE_STYLES, CAPTION_STYLES, MOTIONS, TRACKS, TEMPLATES, VIDEO_TYPES, AUDIO_TYPES,
    len, transType, transDur, layout, totalDuration, frameState, clipIndexAt, trimIn, trimOut, setDur, nudgeLength, split, move, remove, dropIndex,
    exportClips, mediaIds, kbAt, motionOf, kbRect, fitRect, duckRegions, musicLevel, history, record, undo, redo, musicScore, midiHz,
    pickType, extFor, sanitizeProject, fromTemplate, bundleHeader, parsePrefix, checkBundle, webmSetDuration, readVint, fmtT, fmtBytes, storageLevel, clone
  };
})();
