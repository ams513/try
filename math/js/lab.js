/* Stark Math 1.2: the Lab. Exact calculus with every rule shown, a rotatable 3D surface plotter, a fuzzy command
   palette (Ctrl+K) and sealed (encrypted) backups. The first half is pure (runs in node for the tests); the second
   half draws the screens. Nothing here touches the network and all text is set as text nodes. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM, Q = SM.Q;
  const fail = (m) => { throw new SM.MathErr('lab', m); };

  /* ---------- polynomials in x with exact coefficients ---------- */
  /* returns { deg: Q } (only non-zero terms). Accepts anything the exact engine can expand into a polynomial in x. */
  function parsePoly(src) {
    src = String(src || '').trim().replace(/^(y|f\s*\(\s*x\s*\)|f)\s*=\s*/i, '');
    if (!src) fail('Type a function of x, for example 3x^2 - 4x + 1.');
    if (src.length > 200) fail('That expression is too long.');
    const ast = SM.parse(src), vars = SM.varsOf(ast).filter(v => v !== 'x');
    if (vars.length) fail('Use x as the only letter (found ' + vars.join(', ') + ').');
    let P; try { P = SM.evalPoly(ast); } catch (e) { fail('This lab works with polynomials in x (sums of terms like 3x^2). Try the Graph screen for other functions.'); }
    const c = {};
    P.forEach((v, k) => { const m = SM.parseKey(k); c[m.x || 0] = v; });
    return c;
  }
  const degOf = c => Object.keys(c).reduce((m, k) => Math.max(m, +k), 0);
  const isZero = c => Object.keys(c).length === 0;
  function qText(q, paren) { const s = q.toString(); return paren && q.d !== 1 ? '(' + s + ')' : s; }
  function polyText(c) {
    const ks = Object.keys(c).map(Number).sort((a, b) => b - a);
    if (!ks.length) return '0';
    let out = '';
    ks.forEach((k, i) => {
      const q = c[k], neg = q.sign() < 0, a = q.abs();
      const body = k === 0 ? a.toString() : (a.eq(1) ? '' : qText(a, true)) + 'x' + (k === 1 ? '' : '^' + k);
      out += i === 0 ? (neg ? '-' : '') + body : (neg ? ' - ' : ' + ') + body;
    });
    return out;
  }
  const evalAt = (c, x) => { let r = 0; Object.keys(c).forEach(k => { r += c[k].toFloat() * Math.pow(x, +k); }); return r; };
  const evalExact = (c, x) => { let r = Q.ZERO; Object.keys(c).forEach(k => { r = r.add(c[k].mul(x.pow(+k))); }); return r; };
  function derivative(c) { const d = {}; Object.keys(c).forEach(k => { if (+k > 0) d[k - 1] = c[k].mul(+k); }); return d; }
  function antiderivative(c) { const d = {}; Object.keys(c).forEach(k => { d[+k + 1] = c[k].div(+k + 1); }); return d; }
  const parseQ = (s, what) => {
    let n; try { n = SM.evalNum(SM.parse(String(s))); } catch (e) { fail(what + ' must be a plain number such as 2 or -1/2.'); }
    if (n.r !== 1 || n.p !== 0) fail(what + ' must be a rational number such as 2 or -1/2.');
    return n.c;
  };
  const termText = (q, k) => (k === 0 ? q.toString() : (q.eq(1) ? '' : q.eq(-1) ? '-' : qText(q, true)) + 'x' + (k === 1 ? '' : '^' + k));

  /* real roots of a polynomial: exact rational roots (rational root test) plus sign changes, sorted, as floats */
  function realRoots(c) {
    const ks = Object.keys(c).map(Number); if (!ks.length) return [];
    const lowest = Math.min.apply(null, ks), P = {}; ks.forEach(k => { P[k - lowest] = c[k]; });
    const roots = []; if (lowest > 0) roots.push({ x: 0, exact: true });
    const deg = degOf(P); if (deg === 0) return roots;
    let L = 1; Object.keys(P).forEach(k => { L = SM.lcm(L, P[k].d); });
    const ints = {}; Object.keys(P).forEach(k => { ints[k] = P[k].mul(L).n; });
    const lead = Math.abs(ints[deg]), low = Math.abs(ints[0]);
    const divs = n => { const r = []; for (let i = 1; i * i <= n && i < 20000; i++) if (n % i === 0) { r.push(i); if (i * i !== n) r.push(n / i); } return r; };
    if (low && lead && low < 1e9 && lead < 1e9) {
      const seen = {};
      divs(low).forEach(p => divs(lead).forEach(qd => [1, -1].forEach(s => { const x = new Q(s * p, qd), key = x.toString(); if (seen[key]) return; seen[key] = 1; if (evalExact(P, x).isZero()) roots.push({ x: x.toFloat(), exact: true }); })));
    }
    let R = 1; Object.keys(P).forEach(k => { if (+k < deg) R = Math.max(R, 1 + Math.abs(P[k].toFloat() / P[deg].toFloat())); });
    R = Math.min(R, 1e6);
    const N = 6000; let px = -R, py = evalAt(P, px);
    for (let i = 1; i <= N; i++) {
      const x = -R + 2 * R * i / N, y = evalAt(P, x);
      if (py * y < 0) { let lo = px, hi = x; for (let j = 0; j < 80; j++) { const m = (lo + hi) / 2; if (evalAt(P, lo) * evalAt(P, m) <= 0) hi = m; else lo = m; } const r = (lo + hi) / 2; if (!roots.some(q => Math.abs(q.x - r) < 1e-6 * Math.max(1, Math.abs(r)))) roots.push({ x: r, exact: false }); }
      px = x; py = y;
    }
    return roots.sort((a, b) => a.x - b.x);
  }

  /* One call, everything: derivative with rules, second derivative, antiderivative, definite integral, tangent, critical points. */
  function analyse(src, aTxt, bTxt, tTxt) {
    const f = parsePoly(src);
    if (degOf(f) > 20) fail('Keep the degree at 20 or below.');
    const a = parseQ(aTxt === undefined || aTxt === '' ? '0' : aTxt, 'The lower limit'), b = parseQ(bTxt === undefined || bTxt === '' ? '1' : bTxt, 'The upper limit'), t = parseQ(tTxt === undefined || tTxt === '' ? '1' : tTxt, 'The tangent point');
    const f1 = derivative(f), f2 = derivative(f1), F = antiderivative(f);
    const ks = Object.keys(f).map(Number).sort((x, y) => y - x);
    const dSteps = ks.map(k => k === 0 ? 'The constant ' + f[k].toString() + ' has slope 0, so it vanishes.' : 'Power rule on ' + termText(f[k], k) + ': bring down the exponent ' + k + ' and lower it by one, giving ' + termText(f[k].mul(k), k - 1) + '.');
    const iSteps = ks.map(k => 'Reverse power rule on ' + termText(f[k], k) + ': raise the exponent to ' + (k + 1) + ' and divide by ' + (k + 1) + ', giving ' + termText(f[k].div(k + 1), k + 1) + '.');
    const Fa = evalExact(F, a), Fb = evalExact(F, b), area = Fb.sub(Fa);
    const m = evalExact(f1, t), y0 = evalExact(f, t), icpt = y0.sub(m.mul(t));
    const tan = {}; if (!m.isZero()) tan[1] = m; if (!icpt.isZero()) tan[0] = icpt;
    const crit = realRoots(f1).map(r => {
      const x = r.x, y = evalAt(f, x), s2 = evalAt(f2, x), eps = 1e-3 * Math.max(1, Math.abs(x)), l = evalAt(f1, x - eps), rr = evalAt(f1, x + eps);
      const kind = l < 0 && rr > 0 ? 'minimum' : l > 0 && rr < 0 ? 'maximum' : 'flat point (not a turning point)';
      return { x, y, kind, secondDerivative: s2, exact: r.exact };
    });
    return { f: polyText(f), degree: degOf(f), derivative: polyText(f1), derivativeSteps: dSteps, second: polyText(f2), antiderivative: polyText(F) + ' + C', antiderivativeSteps: iSteps,
      integral: { a: a.toString(), b: b.toString(), Fa: Fa.toString(), Fb: Fb.toString(), value: area.toString(), float: area.toFloat(), text: 'F(' + b + ') - F(' + a + ') = ' + Fb + ' - ' + (Fa.sign() < 0 ? '(' + Fa + ')' : Fa) + ' = ' + area },
      tangent: { at: t.toString(), slope: m.toString(), y: y0.toString(), line: 'y = ' + polyText(tan) }, critical: crit,
      coef: { f, f1, F, tan } };
  }

  /* ---------- 3D surfaces ---------- */
  function compile2(src) {
    src = String(src || '').trim().replace(/^(z|f\s*\(\s*x\s*,\s*y\s*\))\s*=\s*/i, '');
    if (!src) fail('Type a formula in x and y, for example sin(x)*cos(y).');
    if (src.length > 200) fail('That expression is too long.');
    const ast = SM.parse(src), vars = SM.varsOf(ast).filter(v => v !== 'x' && v !== 'y');
    if (vars.length) fail('Use only x and y (found ' + vars.join(', ') + ').');
    return (x, y) => { try { return SM.evalF(ast, { x, y }); } catch (e) { return NaN; } };
  }
  /* sample on [-r, r]^2 into an (n+1) x (n+1) grid; heights are scaled into [-1, 1] and x, y into [-1, 1] */
  function mesh(fn, r, n) {
    n = Math.max(4, Math.min(80, n | 0)); r = Math.max(0.5, Math.min(100, +r || 3));
    const zs = []; let lo = Infinity, hi = -Infinity;
    for (let j = 0; j <= n; j++) { const row = []; for (let i = 0; i <= n; i++) { const z = fn(-r + 2 * r * i / n, -r + 2 * r * j / n); row.push(isFinite(z) && Math.abs(z) < 1e9 ? z : NaN); if (isFinite(z) && Math.abs(z) < 1e9) { if (z < lo) lo = z; if (z > hi) hi = z; } } zs.push(row); }
    if (lo > hi) { lo = 0; hi = 0; }
    const mid = (lo + hi) / 2, half = (hi - lo) / 2 || 1;
    return { n, r, zs, lo, hi, norm: zs.map(row => row.map(z => (z - mid) / half * 0.9)) };
  }
  /* orthographic view. yaw turns the surface about the vertical axis, pitch tips the camera from side-on (0) to top-down (pi/2).
     Returns screen x, screen y (down is positive) and depth (larger is farther from the viewer). */
  function project(x, y, z, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), x1 = x * cy - y * sy, y1 = x * sy + y * cy, cp = Math.cos(pitch), sp = Math.sin(pitch);
    return { sx: x1, sy: -(y1 * sp + z * cp), d: y1 * cp - z * sp };
  }
  /* quads far to near for the painter's algorithm; t is the mean height from 0 (lowest) to 1 (highest) */
  function quads(m, yaw, pitch) {
    const out = [], n = m.n;
    const X = i => -1 + 2 * i / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const zz = [m.norm[j][i], m.norm[j][i + 1], m.norm[j + 1][i + 1], m.norm[j + 1][i]];
      if (zz.some(z => !isFinite(z))) continue;
      const ps = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map((q, k) => project(X(q[0]), X(q[1]), zz[k], yaw, pitch));
      const d = ps.reduce((s, p) => s + p.d, 0) / 4, t = (zz.reduce((s, z) => s + z, 0) / 4 / 0.9 + 1) / 2;
      const nx = (zz[0] - zz[1] + zz[3] - zz[2]) / 2, ny = (zz[0] - zz[3] + zz[1] - zz[2]) / 2;
      out.push({ pts: ps.map(p => [p.sx, p.sy]), d, t: Math.max(0, Math.min(1, t)), slope: Math.min(1, Math.sqrt(nx * nx + ny * ny) * n / 8) });
    }
    return out.sort((p, q) => q.d - p.d);
  }
  function describeSurface(fn, m) {
    const at = fn(0, 0);
    return 'Height runs from ' + SM.fmtNum(m.lo, 4) + ' to ' + SM.fmtNum(m.hi, 4) + ' over x and y from -' + m.r + ' to ' + m.r + '. At the centre (0, 0) the height is ' + (isFinite(at) ? SM.fmtNum(at, 4) : 'undefined') + '.';
  }

  /* ---------- fuzzy search ---------- */
  function fuzzyScore(query, text) {
    const q = String(query || '').toLowerCase().replace(/\s+/g, ''), t = String(text || '').toLowerCase();
    if (!q) return 0;
    let ti = 0, score = 0, run = 0, first = -1;
    for (let qi = 0; qi < q.length; qi++) {
      let found = -1; for (let i = ti; i < t.length; i++) if (t[i] === q[qi]) { found = i; break; }
      if (found < 0) return -1;
      if (first < 0) first = found;
      const ws = found === 0 || /[^a-z0-9]/.test(t[found - 1]);
      run = found === ti && qi > 0 ? run + 1 : 0; score += 1 + (ws ? 6 : 0) + run * 3; ti = found + 1;
    }
    if (t.indexOf(q) === 0) score += 12; else if (t.indexOf(q) > 0) score += 5;
    return score - first * 0.2 - t.length * 0.02;
  }
  function fuzzyRank(query, items, limit) {
    const out = []; items.forEach((it, i) => { const s = fuzzyScore(query, it.label + ' ' + (it.keys || '')); if (s >= 0) out.push({ it, s, i }); });
    return out.sort((a, b) => b.s - a.s || a.i - b.i).slice(0, limit || 8).map(x => x.it);
  }

  /* ---------- sealed backups: WebCrypto PBKDF2-SHA256 + AES-256-GCM, header authenticated ---------- */
  const SEAL_APP = 'stark-math-sealed', SEAL_ITER = 600000;
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const cryptoOk = () => !!(G.crypto && G.crypto.subtle && G.crypto.getRandomValues);
  async function deriveKey(pass, salt, iter) {
    const base = await G.crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return G.crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  /** Sealed backups hold children's records and can be attacked offline: 12+ characters, 5+ different characters, not a run or repeat. */
  function passIssue(pass) {
    if (typeof pass !== 'string' || pass.length < 12) return 'Use a passphrase of at least 12 characters (four or five ordinary words work well).';
    if (new Set(pass.toLowerCase()).size < 5 || /^(.{1,3})\1+$/.test(pass) || /^(?:0123456789|1234567890|abcdefghijkl|qwertyuiop)/i.test(pass)) return 'That passphrase is too easy to guess. Use four or five ordinary words.';
    return '';
  }
  async function seal(text, pass, iter) {
    if (!cryptoOk()) throw new Error('This browser has no WebCrypto, so sealed backups are not available.');
    const why = passIssue(pass); if (why) throw new Error(why);
    const it = iter || SEAL_ITER, salt = G.crypto.getRandomValues(new Uint8Array(16)), iv = G.crypto.getRandomValues(new Uint8Array(12));
    const hdr = { app: SEAL_APP, version: 1, kdf: 'PBKDF2-SHA256', iter: it, salt: b64(salt), iv: b64(iv), alg: 'AES-256-GCM' };
    const key = await deriveKey(pass, salt, it);
    const ct = new Uint8Array(await G.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(JSON.stringify(hdr)) }, key, new TextEncoder().encode(text)));
    return Object.assign({}, hdr, { data: b64(ct) });
  }
  async function unseal(o, pass) {
    if (!cryptoOk()) return { ok: false, error: 'This browser has no WebCrypto, so sealed backups cannot be opened.' };
    if (!o || typeof o !== 'object' || o.app !== SEAL_APP || o.version !== 1 || o.kdf !== 'PBKDF2-SHA256' || o.alg !== 'AES-256-GCM' || typeof o.data !== 'string' || typeof o.salt !== 'string' || typeof o.iv !== 'string') return { ok: false, error: 'This file is not a sealed Stark Math backup.' };
    if (!Number.isInteger(o.iter) || o.iter < 100000 || o.iter > 5000000) return { ok: false, error: 'This sealed backup has unsafe settings, so it was not opened.' };
    try {
      const hdr = { app: o.app, version: o.version, kdf: o.kdf, iter: o.iter, salt: o.salt, iv: o.iv, alg: o.alg };
      const key = await deriveKey(String(pass || ''), unb64(o.salt), o.iter);
      const pt = await G.crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv), additionalData: new TextEncoder().encode(JSON.stringify(hdr)) }, key, unb64(o.data));
      return { ok: true, text: new TextDecoder().decode(pt) };
    } catch (e) { return { ok: false, error: 'Wrong passphrase, or the file was changed after it was sealed.' }; }
  }

  SM.lab = { parsePoly, polyText, derivative, antiderivative, analyse, realRoots, evalAt, compile2, mesh, project, quads, describeSurface, fuzzyScore, fuzzyRank, seal, unseal, passIssue, cryptoOk, SEAL_APP, SEAL_ITER };

  /* =====================================================================================================
     Screens (browser only)
     ===================================================================================================== */
  if (typeof document === 'undefined' || !SM.views || !SM.h) return;
  const { h, btn, clear } = SM, V = SM.views;
  const NS = 'http://www.w3.org/2000/svg';
  const cssVar = (n, d) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d);
  const num = (x, dp) => (isFinite(x) ? String(Math.round(x * Math.pow(10, dp || 3)) / Math.pow(10, dp || 3)) : 'undefined');

  /* ---------- Calculus lab ---------- */
  V.calculus = function (main, q) {
    const inp = (id, label, val, cls) => [h('label', { for: id }, label), h('input', { id, value: val, class: cls || '', autocomplete: 'off', spellcheck: 'false', maxlength: 200 })];
    const fIn = inp('cl-f', 'f(x) =', q.f || '2x^3 - 3x^2 - 12x + 5', 'fn-in'), aIn = inp('cl-a', 'Area from x =', '0'), bIn = inp('cl-b', 'to x =', '3'), tIn = inp('cl-t', 'Tangent at x =', '2');
    const out = h('div', { id: 'cl-out', 'aria-live': 'polite' }), err = h('div', { class: 'card warn', role: 'alert', hidden: true });
    const canvas = h('canvas', { id: 'cl-plot', class: 'graph-canvas lab-plot', role: 'img', 'aria-label': 'Plot of the function, its slope curve, the tangent line and the shaded area.' });
    function plot(r) {
      const dpr = window.devicePixelRatio || 1, Wd = Math.max(280, canvas.getBoundingClientRect().width || 600), Ht = Math.round(Math.min(360, Wd * 0.6));
      canvas.style.height = Ht + 'px'; canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(Ht * dpr);
      const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const a = +r.integral.a.split('/').reduce((x, y) => x / y), b = +r.integral.b.split('/').reduce((x, y) => x / y), t = +r.tangent.at.split('/').reduce((x, y) => x / y);
      const lo = Math.min(a, b, t) - 2, hi = Math.max(a, b, t) + 2, xs = []; for (let i = 0; i <= 240; i++) xs.push(lo + (hi - lo) * i / 240);
      const f = x => evalAt(r.coef.f, x), d = x => evalAt(r.coef.f1, x), tg = x => evalAt(r.coef.tan, x);
      let ymin = Infinity, ymax = -Infinity; xs.forEach(x => { [f(x), d(x)].forEach(y => { if (isFinite(y)) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); } }); });
      if (ymin === ymax) { ymin -= 1; ymax += 1; } const pad = (ymax - ymin) * 0.12; ymin -= pad; ymax += pad;
      const X = x => (x - lo) / (hi - lo) * Wd, Y = y => Ht - (y - ymin) / (ymax - ymin) * Ht;
      ctx.fillStyle = cssVar('--surface', '#16201c'); ctx.fillRect(0, 0, Wd, Ht);
      ctx.strokeStyle = cssVar('--grid', 'rgba(160,175,168,.2)'); ctx.lineWidth = 1; ctx.beginPath(); if (ymin < 0 && ymax > 0) { ctx.moveTo(0, Y(0)); ctx.lineTo(Wd, Y(0)); } if (lo < 0 && hi > 0) { ctx.moveTo(X(0), 0); ctx.lineTo(X(0), Ht); } ctx.stroke();
      ctx.fillStyle = cssVar('--accent-soft', 'rgba(169,156,240,.2)'); ctx.beginPath(); ctx.moveTo(X(Math.min(a, b)), Y(0));
      for (let i = 0; i <= 80; i++) { const x = Math.min(a, b) + Math.abs(b - a) * i / 80; ctx.lineTo(X(x), Y(f(x))); } ctx.lineTo(X(Math.max(a, b)), Y(0)); ctx.closePath(); ctx.fill();
      const line = (fn, col, w, dash) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); xs.forEach((x, i) => { const y = fn(x); if (i) ctx.lineTo(X(x), Y(y)); else ctx.moveTo(X(x), Y(y)); }); ctx.stroke(); ctx.setLineDash([]); };
      line(tg, cssVar('--ok', '#7fd3a8'), 2, [6, 5]); line(d, cssVar('--gold', '#d9a441'), 2); line(f, cssVar('--accent', '#a99cf0'), 3);
      ctx.fillStyle = cssVar('--ok', '#7fd3a8'); ctx.beginPath(); ctx.arc(X(t), Y(f(t)), 5, 0, 7); ctx.fill();
    }
    function run() {
      const get = id => document.getElementById(id).value;
      clear(out); err.hidden = true;
      let r; try { r = SM.lab.analyse(get('cl-f'), get('cl-a'), get('cl-b'), get('cl-t')); } catch (e) { err.textContent = e.message || String(e); err.hidden = false; return; }
      const list = items => h('ol', { class: 'lab-steps' }, items.map(s => h('li', null, s)));
      out.append(
        h('section', { class: 'card' }, h('h2', null, 'Derivative'), h('p', { class: 'lab-result', id: 'cl-d' }, "f'(x) = " + r.derivative), list(r.derivativeSteps), h('p', { class: 'muted' }, "Second derivative: f''(x) = " + r.second)),
        h('section', { class: 'card' }, h('h2', null, 'Integral'), h('p', { class: 'lab-result', id: 'cl-i' }, 'Antiderivative: F(x) = ' + r.antiderivative), list(r.antiderivativeSteps),
          h('p', { class: 'lab-result', id: 'cl-area' }, 'Exact area from ' + r.integral.a + ' to ' + r.integral.b + ': ' + r.integral.value + ' (about ' + num(r.integral.float, 4) + ')'), h('p', { class: 'muted' }, r.integral.text + '. Where the curve is below the axis the area counts as negative.')),
        h('section', { class: 'card' }, h('h2', null, 'Tangent line'), h('p', { class: 'lab-result', id: 'cl-tan' }, 'At x = ' + r.tangent.at + ': slope ' + r.tangent.slope + ', f = ' + r.tangent.y + '. Tangent: ' + r.tangent.line)),
        h('section', { class: 'card' }, h('h2', null, 'Turning points'), r.critical.length ? h('ul', { id: 'cl-crit' }, r.critical.map(c => h('li', null, 'x = ' + num(c.x, 4) + (c.exact ? ' (exact)' : ' (approximate)') + ', f = ' + num(c.y, 4) + ': ' + c.kind))) : h('p', { class: 'muted' }, "The slope never reaches zero, so there are no turning points.")));
      plot(r);
    }
    [fIn, aIn, bIn, tIn].forEach(p => p[1].addEventListener('input', run));
    main.append(h('div', { class: 'page-head' }, h('h1', null, 'Calculus lab'), h('p', { class: 'muted' }, 'Type a polynomial in x. Every derivative and integral is worked out exactly, with each rule shown. Purple is f, gold is its slope curve, green is the tangent and the shaded area is the integral.')),
      h('section', { class: 'card lab-form' }, h('div', { class: 'lab-grid' }, h('div', { class: 'lab-wide' }, fIn), h('div', null, aIn), h('div', null, bIn), h('div', null, tIn)),
        h('div', { class: 'row wrap' }, ['x^2', 'x^3 - 3x', '2x^3 - 3x^2 - 12x + 5', '(x - 1)(x + 2)(x - 3)', '1/2x^4 - 2x^2'].map(p => btn(p, () => { document.getElementById('cl-f').value = p; run(); }, 'btn-small btn-ghost')))), err, h('div', { class: 'card' }, canvas), out);
    run(); setTimeout(run, 60);
    let rt = 0; const ro = window.ResizeObserver ? new ResizeObserver(() => { cancelAnimationFrame(rt); rt = requestAnimationFrame(run); }) : null; if (ro) ro.observe(canvas);
    main._cleanup = () => { if (ro) ro.disconnect(); };
  };

  /* ---------- 3D surface lab ---------- */
  const PRESETS = [['Ripple', 'sin(sqrt(x^2 + y^2) * 2) / (1 + 0.3 * sqrt(x^2 + y^2))'], ['Saddle', 'x^2 - y^2'], ['Egg box', 'sin(x) * cos(y)'], ['Hill', 'exp(-(x^2 + y^2) / 2) * 3'], ['Bowl', 'x^2 + y^2'], ['Monkey saddle', 'x^3 - 3 * x * y^2']];
  V.surface = function (main, q) {
    const st = { yaw: 0.8, pitch: 0.75, zoom: 1, spin: false, wire: true, n: window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 28 : 40, r: 3, fn: null, mesh: null };
    const canvas = h('canvas', { id: 'sf-canvas', class: 'graph-canvas lab-plot', tabindex: '0', role: 'img', 'aria-label': '3D surface. Use the arrow keys to rotate, plus and minus to zoom, and the S key to start or stop spinning.' });
    const info = h('p', { id: 'sf-info', class: 'muted', 'aria-live': 'polite' }), err = h('div', { class: 'card warn', role: 'alert', hidden: true }), table = h('div', { class: 'table-wrap' });
    const fIn = h('input', { id: 'sf-f', value: q.f || PRESETS[0][1], class: 'fn-in', autocomplete: 'off', spellcheck: 'false', maxlength: 200, 'aria-label': 'z as a formula in x and y' });
    const rIn = h('input', { id: 'sf-r', type: 'range', min: 1, max: 10, step: 0.5, value: st.r, 'aria-label': 'How far x and y reach from the centre' });
    function build() {
      err.hidden = true;
      try { st.fn = SM.lab.compile2(fIn.value); st.r = +rIn.value; st.mesh = SM.lab.mesh(st.fn, st.r, st.n); }
      catch (e) { err.textContent = e.message || String(e); err.hidden = false; return; }
      info.textContent = SM.lab.describeSurface(st.fn, st.mesh);
      const pts = [-1, -0.5, 0, 0.5, 1].map(k => k * st.r);
      clear(table).append(h('table', { class: 'tbl' }, h('caption', null, 'Heights at sample points (rows are y, columns are x)'), h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'y \\ x'), pts.map(x => h('th', { scope: 'col' }, num(x, 2))))),
        h('tbody', null, pts.slice().reverse().map(y => h('tr', null, h('th', { scope: 'row' }, num(y, 2)), pts.map(x => h('td', null, num(st.fn(x, y), 3))))))));
      draw();
    }
    function draw() {
      if (!st.mesh) return;
      const dpr = window.devicePixelRatio || 1, Wd = Math.max(280, canvas.getBoundingClientRect().width || 640), Ht = Math.round(Math.min(520, Wd * 0.75));
      canvas.style.height = Ht + 'px'; if (canvas.width !== Math.round(Wd * dpr) || canvas.height !== Math.round(Ht * dpr)) { canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(Ht * dpr); }
      const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = cssVar('--surface', '#16201c'); ctx.fillRect(0, 0, Wd, Ht);
      const sc = Math.min(Wd, Ht) * 0.34 * st.zoom, ox = Wd / 2, oy = Ht / 2;
      const lowC = hexRgb(cssVar('--pic2', '#62b8d8')), highC = hexRgb(cssVar('--pic3', '#f0b35e')), edge = cssVar('--surface', '#16201c');
      const qs = SM.lab.quads(st.mesh, st.yaw, st.pitch);
      ctx.lineJoin = 'round';
      qs.forEach(p => {
        const k = 0.62 + 0.38 * (1 - p.slope), c = [0, 1, 2].map(i => Math.round((lowC[i] + (highC[i] - lowC[i]) * p.t) * k));
        ctx.fillStyle = 'rgb(' + c.join(',') + ')'; ctx.beginPath(); p.pts.forEach((pt, i) => { const x = ox + pt[0] * sc, y = oy + pt[1] * sc; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill();
        if (st.wire) { ctx.strokeStyle = edge; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.6; ctx.stroke(); ctx.globalAlpha = 1; }
      });
      // axes cross for orientation
      const ax = [[1.1, 0, 0, 'x'], [0, 1.1, 0, 'y'], [0, 0, 1, 'z']]; ctx.font = '12px system-ui, sans-serif'; ctx.lineWidth = 1.5;
      ax.forEach(a => { const o = SM.lab.project(0, 0, 0, st.yaw, st.pitch), p = SM.lab.project(a[0], a[1], a[2], st.yaw, st.pitch); ctx.strokeStyle = cssVar('--text', '#e7efe9'); ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(ox + o.sx * sc, oy + o.sy * sc); ctx.lineTo(ox + p.sx * sc, oy + p.sy * sc); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = cssVar('--text', '#e7efe9'); ctx.fillText(a[3], ox + p.sx * sc + 4, oy + p.sy * sc - 4); });
    }
    function hexRgb(s) { const m = /^#?([0-9a-f]{6})$/i.exec(s.trim()); if (!m) return [160, 170, 200]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    let drag = null, raf = 0, spinT = 0;
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!drag) return; st.yaw = drag.yaw + (e.clientX - drag.x) * 0.01; st.pitch = Math.max(0, Math.min(Math.PI / 2, drag.pitch + (e.clientY - drag.y) * 0.01)); draw(); });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'ArrowLeft') st.yaw -= 0.1; else if (k === 'ArrowRight') st.yaw += 0.1; else if (k === 'ArrowUp') st.pitch = Math.min(Math.PI / 2, st.pitch + 0.08); else if (k === 'ArrowDown') st.pitch = Math.max(0, st.pitch - 0.08);
      else if (k === '+' || k === '=') return zoom(1.15); else if (k === '-') return zoom(1 / 1.15); else if (k === 's' || k === 'S') return toggleSpin(); else return;
      e.preventDefault(); draw();
    });
    function zoom(f) { st.zoom = Math.max(0.4, Math.min(3, st.zoom * f)); draw(); }
    const spinBtn = btn('Spin', () => toggleSpin(), 'btn-small', { 'aria-pressed': 'false' });
    function toggleSpin() {
      if (SM.reduceMotion()) { SM.toast('Spinning is off because reduced motion is on. Use the arrow keys to turn the surface.'); return; }
      st.spin = !st.spin; spinBtn.setAttribute('aria-pressed', st.spin ? 'true' : 'false'); spinBtn.textContent = st.spin ? 'Stop' : 'Spin';
      cancelAnimationFrame(spinT); if (st.spin) { const tick = () => { st.yaw += 0.01; draw(); spinT = requestAnimationFrame(tick); }; spinT = requestAnimationFrame(tick); }
    }
    fIn.addEventListener('input', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(build); }); rIn.addEventListener('input', build);
    main.append(h('div', { class: 'page-head' }, h('h1', null, '3D surface'), h('p', { class: 'muted' }, 'Plot z as a formula in x and y. Drag to rotate, scroll or press + and - to zoom, use the arrow keys to turn it. Colour runs from low (blue) to high (amber).')),
      h('section', { class: 'card lab-form' }, h('label', { for: 'sf-f' }, 'z ='), fIn, h('div', { class: 'row wrap' }, PRESETS.map(p => btn(p[0], () => { fIn.value = p[1]; build(); }, 'btn-small btn-ghost')),
        h('label', { for: 'sf-r', class: 'inline' }, 'Reach'), rIn, spinBtn, btn('Wireframe', e => { st.wire = !st.wire; e.currentTarget.setAttribute('aria-pressed', st.wire ? 'true' : 'false'); draw(); }, 'btn-small', { 'aria-pressed': 'true' }), btn('Reset view', () => { st.yaw = 0.8; st.pitch = 0.75; st.zoom = 1; draw(); }, 'btn-small btn-ghost'))),
      err, h('div', { class: 'card' }, canvas, info), table);
    build(); setTimeout(build, 60);
    let rt = 0; const ro = window.ResizeObserver ? new ResizeObserver(() => { cancelAnimationFrame(rt); rt = requestAnimationFrame(draw); }) : null; if (ro) ro.observe(canvas);
    main._cleanup = () => { cancelAnimationFrame(spinT); cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  };

  /* ---------- command palette ---------- */
  let pal = null, lastFocus = null;
  function commands() {
    const go = hash => () => { location.hash = hash; }, list = [];
    [['home', 'Home'], ['sim', 'Physics simulators (projectile, pendulum)'], ['learn', 'Learn: browse every skill'], ['practice', 'Practice'], ['review', 'Review (spaced repetition)'], ['placement', 'Placement check'], ['worksheets', 'Worksheets'], ['words', 'Word problems'], ['algebra', 'Algebra step checker'], ['fluency', 'Fact fluency'], ['curriculum', 'Curriculum map'], ['report', 'Parent report'], ['notebook', 'Notebook'], ['graph', 'Graph (2D)'], ['surface', '3D surface'], ['calculus', 'Calculus lab'], ['contest', 'Contests'], ['progress', 'Progress'], ['settings', 'Settings and backup']]
      .forEach(r => list.push({ label: 'Go to ' + r[1], kind: 'Page', run: go('#/' + r[0]) }));
    (SM.SKILLS || []).forEach(s => { list.push({ label: s.title, kind: SM.subjectName(s.subject), keys: (s.strand || '') + ' lesson learn', run: go('#/lesson/' + s.id) }); list.push({ label: 'Practise: ' + s.title, kind: 'Practice', keys: 'practice', run: go('#/practice?skill=' + s.id) }); });
    list.push({ label: 'Mixed practice', kind: 'Action', keys: 'start', run: go('#/practice?mode=mixed') });
    list.push({ label: 'Switch light and dark theme', kind: 'Action', keys: 'theme', run: () => { SM.setPref('theme', SM.prefs().theme === 'light' ? 'dark' : 'light'); SM.applyTheme(); } });
    list.push({ label: 'Calm mode on or off', kind: 'Action', keys: 'motion reduce', run: () => { SM.setPref('calm', !SM.prefs().calm); SM.applyTheme(); } });
    return list;
  }
  function closePalette() { if (!pal) return; pal.root.remove(); pal = null; document.removeEventListener('keydown', trap, true); if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* gone */ } } }
  function trap(e) { if (!pal) return; if (e.key === 'Escape') { e.preventDefault(); closePalette(); } else if (e.key === 'Tab') { e.preventDefault(); pal.input.focus(); } }
  function openPalette() {
    if (pal) { pal.input.focus(); return; }
    lastFocus = document.activeElement; const all = commands(); let shown = [], sel = 0;
    const input = h('input', { type: 'text', id: 'pal-input', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false', placeholder: 'Search skills, pages and actions', 'aria-label': 'Command palette' });
    const listEl = h('ul', { id: 'pal-list', role: 'listbox', 'aria-label': 'Results' }), live = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    const run = i => { const c = shown[i]; if (!c) return; closePalette(); c.run(); };
    const paint = () => {
      shown = input.value.trim() ? SM.lab.fuzzyRank(input.value, all, 8) : all.slice(0, 8);
      if (sel >= shown.length) sel = Math.max(0, shown.length - 1);
      listEl.replaceChildren(...shown.map((c, i) => h('li', { id: 'pal-' + i, role: 'option', 'aria-selected': i === sel ? 'true' : 'false', class: i === sel ? 'on' : '', onmousedown: ev => { ev.preventDefault(); run(i); } }, h('span', null, c.label), h('small', null, c.kind))));
      input.setAttribute('aria-activedescendant', shown.length ? 'pal-' + sel : ''); live.textContent = shown.length ? shown.length + ' results' : 'No match';
      if (!shown.length) listEl.append(h('li', { class: 'none' }, 'No match. Try a topic such as fractions or quadratics.'));
    };
    input.addEventListener('input', () => { sel = 0; paint(); });
    input.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); paint(); } else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); } else if (e.key === 'Enter') { e.preventDefault(); run(sel); } });
    const rootEl = h('div', { class: 'pal-back', onmousedown: ev => { if (ev.target === rootEl) closePalette(); } }, h('div', { class: 'pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' }, input, listEl, live, h('p', { class: 'pal-hint' }, 'Up and down to choose, Enter to go, Esc to close.')));
    document.body.append(rootEl); pal = { root: rootEl, input }; document.addEventListener('keydown', trap, true); paint(); input.focus();
  }
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); pal ? closePalette() : openPalette(); } });
  SM.openPalette = openPalette; SM.closePalette = closePalette;

  /* ---------- sealed backup card in Settings ---------- */
  function sealCard() {
    const msg = h('div', { class: 'card warn', role: 'alert', id: 'seal-msg', hidden: true }), ok = h('div', { class: 'card', role: 'status', hidden: true });
    const pass = h('input', { type: 'password', id: 'seal-pass', autocomplete: 'new-password', minlength: 12, 'aria-describedby': 'seal-help seal-msg' }), file = h('input', { type: 'file', id: 'seal-file', accept: '.json,.mathvault', 'aria-label': 'Choose a sealed backup file' });
    const fail2 = t => { ok.hidden = true; msg.textContent = t; msg.hidden = false; if (/passphrase/i.test(t)) { pass.setAttribute('aria-invalid', 'true'); pass.focus(); } };
    pass.addEventListener('input', () => pass.removeAttribute('aria-invalid'));
    return h('section', { class: 'card', id: 'seal' }, h('h2', null, 'Sealed backup (encrypted)'),
      h('p', { class: 'muted', id: 'seal-help' }, SM.lab.cryptoOk() ? 'Locks every learner profile with your passphrase (AES-256-GCM, key from PBKDF2-SHA256, 600,000 rounds) using your browser\'s built-in WebCrypto. The passphrase is never stored or sent anywhere. Forget it and nobody can open the file.' : 'This browser has no WebCrypto, so sealed backups are not available here.'), msg, ok,
      h('label', { for: 'seal-pass' }, 'Passphrase (12 or more characters)'), pass,
      h('div', { class: 'row wrap' }, btn('Download sealed backup', async () => { msg.hidden = true; ok.hidden = true; try { const o = await SM.lab.seal(JSON.stringify(SM.buildBackup()), pass.value); SM.download('stark-math-sealed-' + new Date().toISOString().slice(0, 10) + '.mathvault', JSON.stringify(o), 'application/json'); ok.textContent = 'Sealed backup saved. Keep the passphrase safe.'; ok.hidden = false; pass.value = ''; } catch (e) { fail2(e.message); } }, '', { disabled: !SM.lab.cryptoOk() })),
      h('h3', null, 'Open a sealed backup'), h('label', { for: 'seal-file' }, 'Sealed file'), file,
      h('div', { class: 'row wrap' }, btn('Unlock and restore', async () => { msg.hidden = true; ok.hidden = true; const f = file.files[0]; if (!f) return fail2('Choose a sealed backup file first.');
        try { if (f.size > 25 * 1024 * 1024) throw new Error('That file is too big.'); const r = await SM.lab.unseal(JSON.parse(await f.text()), pass.value); if (!r.ok) throw new Error(r.error); const res = SM.restoreBackupText(r.text); if (!res.ok) throw new Error(res.error); pass.value = ''; SM.toast('Restored ' + res.count + ' profile' + (res.count === 1 ? '' : 's') + ' from the sealed backup.'); } catch (e) { fail2(e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message); } }, 'btn-ghost', { disabled: !SM.lab.cryptoOk() })));
  }
  const baseSettings = V.settings;
  /* ---------- install as an app (offline worker) ---------- */
  function pwaCard() {
    const P = window.StarkPWA, status = h('p', { id: 'pwa-status', role: 'status' }), inst = btn('Install Stark Math', async () => { const ok = await P.install(); SM.toast(ok ? 'Installed. Open Stark Math from your apps.' : 'Not installed.'); }, 'btn-primary');
    const upd = () => { if (!document.body.contains(status)) { window.removeEventListener('stark-pwa', upd); return; } status.textContent = P ? P.statusText() : 'Offline mode is not available in this browser.'; inst.hidden = !(P && P.canInstall); };
    window.addEventListener('stark-pwa', upd); setTimeout(upd, 0);
    return h('section', { class: 'card', id: 'pwa' }, h('h2', null, 'Install and offline'), h('p', { class: 'muted' }, 'On the web version, Stark Math keeps its own files on this device so it opens with no connection, and your browser may offer to install it as an app. It never downloads anything from anywhere else.'), status, h('div', { class: 'row wrap' }, inst));
  }
  V.settings = function (main, q, arg) { baseSettings(main, q, arg); main.append(sealCard(), pwaCard()); };
})();
