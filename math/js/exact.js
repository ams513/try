/* Stark Math.
   Exact arithmetic engine: rationals, exact surds, a seeded RNG, one math parser shared by answer checking,
   the notebook renderer and the graphing tool, plus SI units and significant figures.
   Pure functions only. No DOM, no network. Runs in the browser and under node (tests). */
(function () {
  'use strict';
  const SM = (typeof window !== 'undefined' ? window : globalThis).SM = (typeof window !== 'undefined' ? window : globalThis).SM || {};

  class MathErr extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }
  const fail = (code, msg) => { throw new MathErr(code, msg); };

  /* ---------- integers ---------- */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
  const lcm = (a, b) => (a && b ? Math.abs(a / gcd(a, b) * b) : 0);
  const safe = n => (Number.isSafeInteger(n) ? n : fail('big', 'That number is too large to work with exactly.'));
  function factorInt(n) { const f = {}; n = Math.abs(n); for (let p = 2; p * p <= n; p++) while (n % p === 0) { f[p] = (f[p] || 0) + 1; n /= p; } if (n > 1) f[n] = (f[n] || 0) + 1; return f; }
  /** n = k^2 * s with s squarefree. Returns [k, s]. */
  function squareOut(n) { let k = 1, s = 1; const f = factorInt(n); for (const p in f) { k *= Math.pow(+p, Math.floor(f[p] / 2)); if (f[p] % 2) s *= +p; } return [k, s]; }

  /* ---------- rationals ---------- */
  class Q {
    constructor(n, d) {
      if (d === undefined) d = 1;
      if (!Number.isInteger(n) || !Number.isInteger(d)) fail('nonint');
      if (d === 0) fail('div0', 'Division by zero.');
      if (d < 0) { n = -n; d = -d; }
      const g = gcd(n, d) || 1;
      this.n = safe(n / g) + 0; this.d = safe(d / g);
    }
    add(o) { o = Q.of(o); return new Q(safe(this.n * o.d) + safe(o.n * this.d), safe(this.d * o.d)); }
    sub(o) { return this.add(Q.of(o).neg()); }
    mul(o) { o = Q.of(o); const g1 = gcd(this.n, o.d) || 1, g2 = gcd(o.n, this.d) || 1; return new Q(safe((this.n / g1) * (o.n / g2)), safe((this.d / g2) * (o.d / g1))); }
    div(o) { o = Q.of(o); if (!o.n) fail('div0', 'Division by zero.'); return this.mul(new Q(o.d, o.n)); }
    neg() { return new Q(-this.n, this.d); }
    abs() { return new Q(Math.abs(this.n), this.d); }
    inv() { return new Q(this.d, this.n); }
    pow(k) { if (!Number.isInteger(k)) fail('nonint'); if (Math.abs(k) > 64) fail('big'); let r = Q.ONE, b = k < 0 ? this.inv() : this; for (let i = 0; i < Math.abs(k); i++) r = r.mul(b); return r; }
    cmp(o) { o = Q.of(o); const x = this.n * o.d - o.n * this.d; return x < 0 ? -1 : x > 0 ? 1 : 0; }
    eq(o) { o = Q.of(o); return this.n === o.n && this.d === o.d; }
    isInt() { return this.d === 1; }
    isZero() { return this.n === 0; }
    sign() { return Math.sign(this.n); }
    toFloat() { return this.n / this.d; }
    floor() { return Math.floor(this.n / this.d); }
    toString() { return this.d === 1 ? String(this.n) : this.n + '/' + this.d; }
    /** Mixed-number text like "2 1/3" (or plain integer / proper fraction). */
    toMixed() { if (this.d === 1 || Math.abs(this.n) < this.d) return this.toString(); const w = Math.trunc(this.n / this.d), r = Math.abs(this.n % this.d); return w + ' ' + r + '/' + this.d; }
    /** Exact decimal string when the denominator has only factors 2 and 5, else null. */
    toDecimal() {
      let d = this.d, k2 = 0, k5 = 0; while (d % 2 === 0) { d /= 2; k2++; } while (d % 5 === 0) { d /= 5; k5++; }
      if (d !== 1) return null;
      const k = Math.max(k2, k5); if (!k) return String(this.n);
      const scaled = Math.abs(this.n) * Math.pow(10, k) / this.d; const s = String(Math.round(scaled)).padStart(k + 1, '0');
      return (this.n < 0 ? '-' : '') + s.slice(0, -k) + '.' + s.slice(-k);
    }
    static of(x) {
      if (x instanceof Q) return x;
      if (typeof x === 'number') { if (Number.isInteger(x)) return new Q(x, 1); return Q.parseDecimal(String(x)); }
      if (typeof x === 'string') return Q.parse(x);
      if (x && typeof x.n === 'number') return new Q(x.n, x.d || 1);
      return fail('nan');
    }
    static parseDecimal(s) {
      const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(String(s).trim());
      if (!m || (m[2] === '' && !m[3])) fail('nan');
      const frac = m[3] || '', digits = (m[2] || '0') + frac;
      if (digits.replace(/^0+/, '').length > 15) fail('big', 'That number has too many digits to check exactly.');
      return new Q((m[1] === '-' ? -1 : 1) * parseInt(digits, 10), Math.pow(10, frac.length));
    }
    static parse(s) { s = String(s).trim(); const i = s.indexOf('/'); return i < 0 ? Q.parseDecimal(s) : Q.parseDecimal(s.slice(0, i)).div(Q.parseDecimal(s.slice(i + 1))); }
  }
  Q.ZERO = new Q(0); Q.ONE = new Q(1);
  const q = (n, d) => (n instanceof Q ? n : typeof n === 'string' ? Q.parse(n) : new Q(n, d === undefined ? 1 : d));

  /* ---------- exact numbers c * sqrt(r) * pi^p ---------- */
  class Num {
    constructor(c, r, p) { this.c = Q.of(c); r = r || 1; p = p || 0; if (r < 1 || !Number.isInteger(r)) fail('nonreal', 'Not a real number.'); const [k, s] = squareOut(r); this.c = this.c.mul(k); this.r = this.c.isZero() ? 1 : s; this.p = this.c.isZero() ? 0 : p; }
    static of(x) { return x instanceof Num ? x : new Num(Q.of(x), 1, 0); }
    isRational() { return this.r === 1 && this.p === 0; }
    like(o) { return this.r === o.r && this.p === o.p; }
    add(o) { o = Num.of(o); if (o.c.isZero()) return this; if (this.c.isZero()) return o; if (!this.like(o)) fail('mixed', 'Not a single exact term.'); return new Num(this.c.add(o.c), this.r, this.p); }
    sub(o) { return this.add(Num.of(o).neg()); }
    neg() { return new Num(this.c.neg(), this.r, this.p); }
    mul(o) { o = Num.of(o); return new Num(this.c.mul(o.c), safe(this.r * o.r), this.p + o.p); }
    inv() { if (this.c.isZero()) fail('div0', 'Division by zero.'); return new Num(this.c.mul(this.r).inv(), this.r, -this.p); }
    div(o) { return this.mul(Num.of(o).inv()); }
    pow(k) { if (k instanceof Num) { if (!k.isRational()) fail('inexact'); k = k.c; } k = Q.of(k);
      if (k.isInt()) { let r = Num.of(1), b = k.n < 0 ? this.inv() : this; if (Math.abs(k.n) > 64) fail('big'); for (let i = 0; i < Math.abs(k.n); i++) r = r.mul(b); return r; }
      if (k.d === 2) return this.sqrt().pow(k.n);
      if (this.isRational() && this.c.sign() >= 0) { const rt = x => { const v = Math.round(Math.pow(x, 1 / k.d)); return Math.pow(v, k.d) === x ? v : null; }; const a = rt(this.c.n), b = rt(this.c.d); if (a !== null && b !== null) return new Num(new Q(a, b)).pow(k.n); }
      return fail('inexact', 'That power is not an exact number.'); }
    sqrt() { if (this.c.sign() < 0) fail('nonreal', 'The square root of a negative number is not real.'); if (this.r !== 1 || this.p % 2) fail('inexact', 'Nested roots are not supported.'); return new Num(new Q(1, this.c.d), safe(this.c.n * this.c.d), this.p / 2); }
    eq(o) { o = Num.of(o); return this.c.eq(o.c) && (this.c.isZero() || this.like(o)); }
    toFloat() { return this.c.toFloat() * Math.sqrt(this.r) * Math.pow(Math.PI, this.p); }
    toString() {
      if (this.isRational()) return this.c.toString();
      const rad = this.r === 1 ? '' : 'sqrt(' + this.r + ')', pi = this.p === 0 ? '' : this.p === 1 ? 'pi' : 'pi^' + this.p;
      const n = this.c.n, d = this.c.d, core = [rad, pi].filter(Boolean).join('*');
      const top = Math.abs(n) === 1 ? core : Math.abs(n) + core;
      return (n < 0 ? '-' : '') + top + (d === 1 ? '' : '/' + d);
    }
    /** Pretty text with unicode: 2√3, 25π, √2/2. */
    pretty() { if (this.isRational()) return this.c.toString().replace('-', '−'); const n = this.c.n, d = this.c.d, core = (this.r === 1 ? '' : '√' + this.r) + (this.p === 1 ? 'π' : this.p ? 'π^' + this.p : ''); return (n < 0 ? '−' : '') + (Math.abs(n) === 1 ? '' : Math.abs(n)) + core + (d === 1 ? '' : '/' + d); }
  }

  /* ---------- seeded RNG (sfc32 over a string hash), shared with contest packs ---------- */
  function hashStr(str) { let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762; for (let i = 0; i < str.length; i++) { const k = str.charCodeAt(i); h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233); h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179); }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233); h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179); return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0]; }
  function rng(seed) {
    let [a, b, c, d] = hashStr(String(seed));
    const next = () => { a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; return (t >>> 0) / 4294967296; };
    for (let i = 0; i < 12; i++) next();
    const R = {
      next,
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      nz: (lo, hi) => { let v = 0; for (let i = 0; i < 50 && v === 0; i++) v = lo + Math.floor(next() * (hi - lo + 1)); return v || 1; },
      pick: arr => arr[Math.floor(next() * arr.length)],
      sign: () => (next() < 0.5 ? -1 : 1),
      chance: p => next() < p,
      shuffle: arr => { arr = arr.slice(); for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; },
      distinct: (n, lo, hi) => { const s = new Set(); let guard = 0; while (s.size < n && guard++ < 1000) s.add(lo + Math.floor(next() * (hi - lo + 1))); return [...s]; },
      /** A value with sf significant figures between lo and hi (for science data). */
      sig: (lo, hi, sf) => { const v = lo + next() * (hi - lo); return roundSF(v, sf || 3); },
    };
    return R;
  }

  /* ---------- tokenizer + parser ---------- */
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
  const VULGAR = { '½': [1, 2], '⅓': [1, 3], '⅔': [2, 3], '¼': [1, 4], '¾': [3, 4], '⅕': [1, 5], '⅖': [2, 5], '⅗': [3, 5], '⅘': [4, 5], '⅙': [1, 6], '⅚': [5, 6], '⅛': [1, 8], '⅜': [3, 8], '⅝': [5, 8], '⅞': [7, 8] };
  const FUNCS = ['arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sqrt', 'cbrt', 'abs', 'ln', 'log', 'exp'];
  const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ', mu: 'μ', sigma: 'σ', omega: 'ω', phi: 'φ', tau: 'τ', rho: 'ρ' };

  function tokenize(src) {
    const s = String(src).replace(/\*\*/g, '^').replace(/[−–—]/g, '-').replace(/[⋅·∙]/g, '*').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=');
    const out = []; let i = 0, sp = false;
    const push = (t, v, extra) => { out.push(Object.assign({ t, v, sp }, extra || {})); sp = false; };
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { sp = true; i++; continue; }
      if (/[0-9.]/.test(ch)) {
        const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!m) fail('syntax', 'I could not read "' + ch + '".');
        let raw = m[1]; i += raw.length;
        const e = /^[eE]([+-]?\d+)/.exec(s.slice(i)); if (e && !/^[a-zA-Z]/.test(s.slice(i + e[0].length))) { push('num', raw, { exp: +e[1] }); i += e[0].length; continue; }
        push('num', raw); continue;
      }
      if (SUP[ch]) { let j = i, t = ''; while (j < s.length && SUP[s[j]]) t += SUP[s[j++]]; push('^', '^'); push('supnum', t); i = j; continue; }
      if (VULGAR[ch]) { push('vulgar', VULGAR[ch]); i++; continue; }
      if (ch === '?' || ch === '□') { push('box', ch); i++; continue; }
      if (ch === 'π') { push('id', 'pi'); i++; continue; }
      if (ch === '√') { push('id', 'sqrt'); i++; continue; }
      if (ch === '∛') { push('id', 'cbrt'); i++; continue; }
      if (ch === '∞') { push('id', 'inf'); i++; continue; }
      if (/[a-zA-Zα-ωΑ-Ωθ]/.test(ch)) {
        const m = /^[a-zA-Zα-ωΑ-Ω]+/.exec(s.slice(i)); let w = m[0]; i += w.length;
        while (w.length) { // split a word into function names, pi, greek names and single letters
          const f = FUNCS.find(fn => w.toLowerCase().startsWith(fn)) || (w.toLowerCase().startsWith('pi') ? 'pi' : null) || (w.toLowerCase().startsWith('inf') ? 'inf' : null) || Object.keys(GREEK).find(g => w.toLowerCase().startsWith(g) && g !== 'pi');
          if (f) { push('id', GREEK[f] || f); w = w.slice(f.length); } else { push('id', w[0]); w = w.slice(1); }
        }
        continue;
      }
      const two = s.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '!=' || two === '+-') { push(two === '+-' ? '±' : 'rel', two === '+-' ? '±' : two); i += 2; continue; }
      if (ch === '×') { push('*', '×'); i++; continue; }
      if (ch === '÷') { push('/', '÷'); i++; continue; }
      if ('+-*/^()[]{},!%°|±'.includes(ch)) { push(ch === '[' || ch === '{' ? '(' : ch === ']' || ch === '}' ? ')' : ch, ch); i++; continue; }
      if ('<>='.includes(ch)) { push('rel', ch); i++; continue; }
      if (ch === "'") { push("'", ch); i++; continue; }
      fail('syntax', 'I could not read "' + ch + '".');
    }
    return out;
  }

  /** Parse one expression (no relations) into an AST. */
  function parse(src) {
    const toks = Array.isArray(src) ? src : tokenize(src); let i = 0, absDepth = 0;
    if (!toks.length) fail('empty', 'Type an answer first.');
    const peek = () => toks[i], eat = t => (toks[i] && toks[i].t === t ? toks[i++] : null);
    const startsAtom = tk => tk && (tk.t === 'box' || tk.t === 'num' || tk.t === 'id' || tk.t === '(' || tk.t === 'vulgar' || (tk.t === '|' && absDepth === 0));
    function expr() {
      let a = term();
      for (;;) { const tk = peek(); if (!tk) break;
        if (tk.t === '+' || tk.t === '-' || tk.t === '±') { i++; const b = term(); a = { t: tk.t === '+' ? 'add' : tk.t === '-' ? 'sub' : 'pm', a, b }; } else break; }
      return a;
    }
    function term() {
      let a = unary();
      for (;;) { const tk = peek(); if (!tk) break;
        if (tk.t === '*' || tk.t === '/') { i++; const b = unary(); a = { t: tk.t === '*' ? 'mul' : 'div', a, b }; if (tk.v === '×') a.x = true; if (tk.v === '÷') a.obel = true; continue; }
        if (startsAtom(tk)) {
          // mixed number: "2 1/3"
          const wn = a.t === 'num' ? a : a.t === 'neg' && a.a.t === 'num' ? a.a : null;
          if (wn && wn.int && tk.t === 'num' && tk.sp && toks[i + 1] && toks[i + 1].t === '/' && toks[i + 2] && toks[i + 2].t === 'num' && /^\d+$/.test(tk.v) && /^\d+$/.test(toks[i + 2].v)) {
            const n = +tk.v, d = +toks[i + 2].v; i += 3; const mx = { t: 'mixed', w: wn.v.n, n, d }; a = a.t === 'neg' ? { t: 'neg', a: mx } : mx; continue; }
          const b = unary(true); a = { t: 'mul', a, b, imp: true }; continue; }
        break; }
      return a;
    }
    function unary(noSign) {
      const tk = peek();
      if (!noSign && tk && (tk.t === '-' || tk.t === '+' || tk.t === '±')) { i++; const a = unary(); return tk.t === '-' ? { t: 'neg', a } : tk.t === '±' ? { t: 'pm', a: { t: 'num', v: Q.ZERO, raw: '0', int: true }, b: a, pre: true } : a; }
      return power();
    }
    function power() {
      const a = postfix();
      if (eat('^')) { const tk = peek(); if (tk && tk.t === 'supnum') { i++; const b = tk.v === '-' ? fail('syntax') : numNode(tk.v.replace('-', '')); return post({ t: 'pow', a, b: tk.v[0] === '-' ? { t: 'neg', a: b } : b }); } return { t: 'pow', a, b: unary() }; }
      return a;
    }
    function post(a) { for (;;) { const tk = peek(); if (!tk) return a; if (tk.t === '!') { i++; a = { t: 'fact', a }; } else if (tk.t === '%') { i++; a = { t: 'pct', a }; } else if (tk.t === '°') { i++; a = { t: 'deg', a }; } else if (tk.t === "'") { i++; a = { t: 'prime', a }; } else return a; } }
    function postfix() { return post(atom()); }
    function numNode(raw, exp) { const v = Q.parseDecimal(raw.endsWith('.') ? raw.slice(0, -1) : raw); const node = { t: 'num', v, raw, int: /^\d+$/.test(raw) }; if (exp !== undefined) return { t: 'mul', a: node, b: { t: 'pow', a: { t: 'num', v: new Q(10), raw: '10', int: true }, b: exp < 0 ? { t: 'neg', a: { t: 'num', v: new Q(-exp), raw: String(-exp), int: true } } : { t: 'num', v: new Q(exp), raw: String(exp), int: true } }, sci: true }; return node; }
    function atom() {
      const tk = toks[i++];
      if (!tk) fail('syntax', 'The answer looks unfinished.');
      if (tk.t === 'num') return numNode(tk.v, tk.exp);
      if (tk.t === 'vulgar') return { t: 'div', a: numNode(String(tk.v[0])), b: numNode(String(tk.v[1])), vulgar: true };
      if (tk.t === '(') { const a = expr(); if (eat(',')) { const items = [a]; do { items.push(expr()); } while (eat(',')); if (!eat(')')) fail('syntax', 'A bracket is not closed.'); return { t: 'tuple', items }; } if (!eat(')')) fail('syntax', 'A bracket is not closed.'); return { t: 'grp', a }; }
      if (tk.t === '|') { absDepth++; const a = expr(); absDepth--; if (!eat('|')) fail('syntax', 'An absolute-value bar is not closed.'); return { t: 'fn', n: 'abs', a, bars: true }; }
      if (tk.t === 'id') {
        const v = tk.v;
        if (FUNCS.includes(v)) {
          let powArg = null;
          if (peek() && peek().t === '^' && v !== 'sqrt') { i++; const pt = peek(); powArg = pt && pt.t === 'supnum' ? (i++, numNode(pt.v)) : atom(); }
          let arg; if (peek() && peek().t === '(') { i++; arg = expr(); if (!eat(')')) fail('syntax', 'A bracket is not closed.'); } else arg = v === 'sqrt' || v === 'cbrt' ? power() : unary();
          const f = { t: 'fn', n: v, a: arg };
          return powArg ? { t: 'pow', a: f, b: powArg } : f;
        }
        if (v === 'pi' || v === 'e' || v === 'inf') return { t: 'const', n: v };
        if (peek() && peek().t === '(' && /^[fgh]$/.test(v) && !peek().sp) { i++; const a = expr(); if (!eat(')')) fail('syntax', 'A bracket is not closed.'); return { t: 'call', n: v, a }; }
        return { t: 'var', n: v };
      }
      if (tk.t === 'supnum') return numNode(tk.v);
      if (tk.t === 'box') return { t: 'box' };
      fail('syntax', tk.v === ')' ? 'There is a closing bracket without an opening one.' : 'Something is missing before "' + tk.v + '".');
    }
    const ast = expr();
    if (i < toks.length) fail('syntax', toks[i].v === ')' ? 'There is an extra closing bracket.' : 'I could not read the part starting at "' + toks[i].v + '".');
    return ast;
  }

  /** Split "lhs op rhs [op rhs]" on relation tokens. Returns {parts:[ast...], ops:[...]} */
  function parseRel(src) {
    const toks = tokenize(src), parts = [], ops = []; let cur = [];
    toks.forEach(tk => { if (tk.t === 'rel') { parts.push(cur); ops.push(tk.v); cur = []; } else cur.push(tk); });
    parts.push(cur);
    if (parts.some(p => !p.length)) fail('syntax', 'One side of the relation is empty.');
    return { parts: parts.map(p => parse(p)), ops };
  }

  /* ---------- evaluators ---------- */
  function strip(a) { while (a.t === 'grp') a = a.a; return a; }
  /** Exact value (Num). Throws on variables or non-exact functions. */
  function evalNum(a) {
    switch (a.t) {
      case 'num': return Num.of(a.v);
      case 'grp': return evalNum(a.a);
      case 'mixed': return Num.of(new Q(a.w).add(new Q(a.n, a.d)));
      case 'neg': return evalNum(a.a).neg();
      case 'add': return evalNum(a.a).add(evalNum(a.b));
      case 'sub': return evalNum(a.a).sub(evalNum(a.b));
      case 'mul': return evalNum(a.a).mul(evalNum(a.b));
      case 'div': return evalNum(a.a).div(evalNum(a.b));
      case 'pow': return evalNum(a.a).pow(evalNum(a.b));
      case 'pct': return evalNum(a.a).div(100);
      case 'deg': return evalNum(a.a);
      case 'const': if (a.n === 'pi') return new Num(1, 1, 1); return fail('inexact', 'That value is not exact.');
      case 'fn':
        if (a.n === 'sqrt') return evalNum(a.a).sqrt();
        if (a.n === 'abs') { const v = evalNum(a.a); return v.c.sign() < 0 ? v.neg() : v; }
        if (a.n === 'cbrt') return evalNum(a.a).pow(new Q(1, 3));
        return fail('inexact', 'That value is not exact.');
      case 'fact': { const v = evalNum(a.a); if (!v.isRational() || !v.c.isInt() || v.c.n < 0 || v.c.n > 18) fail('inexact'); let r = 1; for (let k = 2; k <= v.c.n; k++) r *= k; return Num.of(r); }
      case 'var': return fail('var', 'The answer should be a number, not an expression with ' + a.n + '.');
      default: return fail('inexact', 'That is not a single number.');
    }
  }
  // mixed nodes store w as the raw digits of the whole part
  function fixMixed(a) { if (a && a.t === 'mixed' && typeof a.w !== 'number') a.w = +a.w; return a; }

  /** Polynomial: Map from monomial key (e.g. "x^2*y") to Q. */
  const monoKey = m => Object.keys(m).filter(k => m[k]).sort().map(k => (m[k] === 1 ? k : k + '^' + m[k])).join('*');
  const parseKey = key => { const m = {}; if (!key) return m; key.split('*').forEach(p => { const [v, e] = p.split('^'); m[v] = e ? +e : 1; }); return m; };
  const Poly = {
    c(v) { const p = new Map(); const x = Q.of(v); if (!x.isZero()) p.set('', x); return p; },
    v(name) { return new Map([[name, Q.ONE]]); },
    add(A, B, s) { const p = new Map(A); B.forEach((v, k) => { const w = (p.get(k) || Q.ZERO).add(s ? v.neg() : v); if (w.isZero()) p.delete(k); else p.set(k, w); }); return p; },
    mul(A, B) { let p = new Map(); A.forEach((va, ka) => B.forEach((vb, kb) => { const ma = parseKey(ka), mb = parseKey(kb); for (const k in mb) ma[k] = (ma[k] || 0) + mb[k]; const key = monoKey(ma); const w = (p.get(key) || Q.ZERO).add(va.mul(vb)); if (w.isZero()) p.delete(key); else p.set(key, w); })); return p; },
    scale(A, s) { const p = new Map(); A.forEach((v, k) => { const w = v.mul(s); if (!w.isZero()) p.set(k, w); }); return p; },
    isConst(A) { return A.size === 0 || (A.size === 1 && A.has('')); },
    constVal(A) { return A.get('') || Q.ZERO; },
    eq(A, B) { return Poly.add(A, B, true).size === 0; },
    degree(A, v) { let d = 0; A.forEach((_, k) => { const m = parseKey(k); d = Math.max(d, v ? (m[v] || 0) : Object.values(m).reduce((s, e) => s + e, 0)); }); return d; },
    toObj(A) { const o = {}; A.forEach((v, k) => { o[k] = v.toString(); }); return o; },
  };
  function evalPoly(a) {
    switch (a.t) {
      case 'num': return Poly.c(a.v);
      case 'grp': return evalPoly(a.a);
      case 'mixed': return Poly.c(new Q(+a.w).add(new Q(a.n, a.d)));
      case 'var': return Poly.v(a.n);
      case 'neg': return Poly.scale(evalPoly(a.a), -1);
      case 'add': return Poly.add(evalPoly(a.a), evalPoly(a.b));
      case 'sub': return Poly.add(evalPoly(a.a), evalPoly(a.b), true);
      case 'mul': return Poly.mul(evalPoly(a.a), evalPoly(a.b));
      case 'div': { const d = evalPoly(a.b); if (!Poly.isConst(d) || Poly.constVal(d).isZero()) fail('nonpoly'); return Poly.scale(evalPoly(a.a), Poly.constVal(d).inv()); }
      case 'pow': { const e = evalPoly(a.b); if (!Poly.isConst(e)) fail('nonpoly'); const k = Poly.constVal(e); if (!k.isInt() || k.n < 0 || k.n > 200) fail('nonpoly'); let r = Poly.c(1); const base = evalPoly(a.a); for (let j = 0; j < k.n; j++) r = Poly.mul(r, base); return r; }
      case 'pct': return Poly.scale(evalPoly(a.a), new Q(1, 100));
      default: return fail('nonpoly');
    }
  }
  const FACT = n => { let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
  function evalF(a, env) {
    env = env || {};
    switch (a.t) {
      case 'num': return a.v.toFloat();
      case 'grp': return evalF(a.a, env);
      case 'mixed': return +a.w + a.n / a.d;
      case 'var': if (a.n in env) return env[a.n]; return fail('var', 'Unknown letter ' + a.n + '.');
      case 'const': return a.n === 'pi' ? Math.PI : a.n === 'e' ? Math.E : Infinity;
      case 'neg': return -evalF(a.a, env);
      case 'add': return evalF(a.a, env) + evalF(a.b, env);
      case 'sub': return evalF(a.a, env) - evalF(a.b, env);
      case 'mul': return evalF(a.a, env) * evalF(a.b, env);
      case 'div': return evalF(a.a, env) / evalF(a.b, env);
      case 'pow': { const b = evalF(a.a, env), e = evalF(a.b, env); if (b < 0 && !Number.isInteger(e)) { const r = Math.round(1 / e); if (Math.abs(1 / e - r) < 1e-12 && r % 2) return -Math.pow(-b, e); } return Math.pow(b, e); }
      case 'pct': return evalF(a.a, env) / 100;
      case 'deg': return evalF(a.a, env) * (env.__deg ? 1 : Math.PI / 180);
      case 'fact': return FACT(Math.round(evalF(a.a, env)));
      case 'call': if (env['@' + a.n]) return env['@' + a.n](evalF(a.a, env)); return fail('var', 'Unknown function ' + a.n + '.');
      case 'fn': { const x = evalF(a.a, env), D = env.__deg ? Math.PI / 180 : 1;
        switch (a.n) {
          case 'sin': return Math.sin(x * D); case 'cos': return Math.cos(x * D); case 'tan': return Math.tan(x * D);
          case 'sec': return 1 / Math.cos(x * D); case 'csc': return 1 / Math.sin(x * D); case 'cot': return 1 / Math.tan(x * D);
          case 'asin': case 'arcsin': return Math.asin(x) / D; case 'acos': case 'arccos': return Math.acos(x) / D; case 'atan': case 'arctan': return Math.atan(x) / D;
          case 'sinh': return Math.sinh(x); case 'cosh': return Math.cosh(x); case 'tanh': return Math.tanh(x);
          case 'sqrt': return Math.sqrt(x); case 'cbrt': return Math.cbrt(x); case 'abs': return Math.abs(x);
          case 'ln': return Math.log(x); case 'log': return Math.log10(x); case 'exp': return Math.exp(x);
        } return NaN; }
      default: return fail('syntax');
    }
  }
  function walk(a, fn) { if (!a || typeof a !== 'object') return; fn(a); ['a', 'b'].forEach(k => a[k] && walk(a[k], fn)); if (a.items) a.items.forEach(x => walk(x, fn)); }
  function varsOf(a) { const s = new Set(); walk(a, n => { if (n.t === 'var') s.add(n.n); }); return [...s].sort(); }
  function mixFix(a) { walk(a, fixMixed); return a; }

  /* ---------- significant figures and number formatting ---------- */
  function roundSF(x, sf) { if (!x || !isFinite(x)) return x; const p = Math.floor(Math.log10(Math.abs(x))) - sf + 1; const m = Math.pow(10, Math.abs(p)); const v = p >= 0 ? Math.round(x / m) * m : Math.round(x * m) / m; return +v.toPrecision(15); }
  function roundDP(x, dp) { const m = Math.pow(10, dp); return Math.round((x + Math.sign(x) * 1e-12) * m) / m; }
  const SUPDIG = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const supText = s => String(s).split('').map(c => SUPDIG[c] || c).join('');
  /** Format with sf significant figures; scientific (a × 10ⁿ) outside 1e-3..1e5. */
  function fmtSF(x, sf, opts) {
    opts = opts || {};
    if (x === 0) return (0).toFixed(Math.max(0, sf - 1));
    const e = Math.floor(Math.log10(Math.abs(roundSF(x, sf))));
    if (e >= (opts.sciHi || 5) || e < (opts.sciLo || -3)) { const m = roundSF(x, sf) / Math.pow(10, e); return m.toFixed(Math.max(0, sf - 1)).replace('-', '−') + ' × 10' + supText(e); }
    const dp = Math.max(0, sf - 1 - e); return roundSF(x, sf).toFixed(dp).replace('-', '−');
  }
  /** Plain-ASCII version for answers that the parser reads back ("3.00e8"). */
  function fmtSFPlain(x, sf) { return fmtSF(x, sf).replace(/−/g, '-').replace(/ × 10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/, (m, p) => 'e' + p.split('').map(c => Object.keys(SUPDIG).find(k => SUPDIG[k] === c)).join('')); }
  /** Count significant figures in a typed mantissa. Returns [min, max] (trailing zeros of an integer are ambiguous). */
  function countSF(raw) {
    let s = String(raw).replace(/^[+\-−]/, '').trim();
    if (s.includes('.')) { const digits = s.replace('.', '').replace(/^0+/, ''); const n = digits.length || 1; return [n, n]; }
    s = s.replace(/^0+/, ''); if (!s) return [1, 1];
    const core = s.replace(/0+$/, ''); return [core.length, s.length];
  }
  const fmtNum = (x, maxDp) => { const v = roundDP(x, maxDp === undefined ? 6 : maxDp); return String(v).replace('-', '−'); };

  /* ---------- SI units ---------- */
  // dimension order: L M T I Θ N J ; factor converts to SI base
  const D = (L, M, T, I, K, N, J) => [L || 0, M || 0, T || 0, I || 0, K || 0, N || 0, J || 0];
  const EV = 1.602176634e-19;
  const UNITS = {
    m: [1, D(1)], g: [1e-3, D(0, 1)], s: [1, D(0, 0, 1)], A: [1, D(0, 0, 0, 1)], K: [1, D(0, 0, 0, 0, 1)], mol: [1, D(0, 0, 0, 0, 0, 1)], cd: [1, D(0, 0, 0, 0, 0, 0, 1)],
    N: [1, D(1, 1, -2)], J: [1, D(2, 1, -2)], W: [1, D(2, 1, -3)], Pa: [1, D(-1, 1, -2)], C: [1, D(0, 0, 1, 1)], V: [1, D(2, 1, -3, -1)],
    'Ω': [1, D(2, 1, -3, -2)], F: [1, D(-2, -1, 4, 2)], H: [1, D(2, 1, -2, -2)], T: [1, D(0, 1, -2, -1)], Wb: [1, D(2, 1, -2, -1)], Hz: [1, D(0, 0, -1)], S: [1, D(-2, -1, 3, 2)],
    L: [1e-3, D(3)], l: [1e-3, D(3)], eV: [EV, D(2, 1, -2)], Da: [1.66053906660e-27, D(0, 1)], u: [1.66053906660e-27, D(0, 1)], M: [1e3, D(-3, 0, 0, 0, 0, 1)],
    min: [60, D(0, 0, 1)], h: [3600, D(0, 0, 1)], hr: [3600, D(0, 0, 1)], day: [86400, D(0, 0, 1)], yr: [31557600, D(0, 0, 1)],
    atm: [101325, D(-1, 1, -2)], bar: [1e5, D(-1, 1, -2)], mmHg: [133.322387415, D(-1, 1, -2)], Torr: [101325 / 760, D(-1, 1, -2)], torr: [101325 / 760, D(-1, 1, -2)],
    cal: [4.184, D(2, 1, -2)], Cal: [4184, D(2, 1, -2)], t: [1000, D(0, 1)], ly: [9460730472580800, D(1)], AU: [149597870700, D(1)], 'Å': [1e-10, D(1)],
    ft: [0.3048, D(1)], in: [0.0254, D(1)], mi: [1609.344, D(1)], yd: [0.9144, D(1)], lb: [0.45359237, D(0, 1)], oz: [0.028349523125, D(0, 1)], lbf: [4.4482216152605, D(1, 1, -2)],
    psi: [6894.757293168361, D(-1, 1, -2)], mph: [0.44704, D(1, 0, -1)], kph: [1 / 3.6, D(1, 0, -1)], hp: [745.69987158227022, D(2, 1, -3)], gal: [3.785411784e-3, D(3)], kn: [1852 / 3600, D(1, 0, -1)],
    rad: [1, D()], sr: [1, D()], '°': [Math.PI / 180, D()], deg: [Math.PI / 180, D()], rev: [2 * Math.PI, D()], rpm: [2 * Math.PI / 60, D(0, 0, -1)], '%': [0.01, D()],
    '°C': [1, D(0, 0, 0, 0, 1), 273.15], '°F': [5 / 9, D(0, 0, 0, 0, 1), 459.67 * 5 / 9], B: [8, D()], bit: [1, D()], byte: [8, D()],
  };
  const PREFIXABLE = new Set(['m', 'g', 's', 'A', 'K', 'mol', 'cd', 'N', 'J', 'W', 'Pa', 'C', 'V', 'Ω', 'F', 'H', 'T', 'Wb', 'Hz', 'S', 'L', 'l', 'eV', 'M', 'bar', 'cal', 't', 'B', 'bit', 'Da']);
  const PREFIX = { Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 10, d: 0.1, c: 0.01, m: 1e-3, 'µ': 1e-6, 'μ': 1e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18 };
  const WORDS = { meter: 'm', meters: 'm', metre: 'm', metres: 'm', second: 's', seconds: 's', sec: 's', secs: 's', gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', newton: 'N', newtons: 'N', joule: 'J', joules: 'J', watt: 'W', watts: 'W', ohm: 'Ω', ohms: 'Ω', volt: 'V', volts: 'V', amp: 'A', amps: 'A', ampere: 'A', amperes: 'A', hertz: 'Hz', pascal: 'Pa', pascals: 'Pa', coulomb: 'C', coulombs: 'C', kelvin: 'K', mole: 'mol', moles: 'mol', liter: 'L', liters: 'L', litre: 'L', litres: 'L', hour: 'h', hours: 'h', hrs: 'h', minute: 'min', minutes: 'min', mins: 'min', degree: '°', degrees: '°', farad: 'F', tesla: 'T', 'kWh': 'kW*h', 'Wh': 'W*h', 'mAh': 'mA*h', 'Ah': 'A*h', degC: '°C', degF: '°F', 'C°': '°C', 'F°': '°F', 'Ohm': 'Ω', 'Ohms': 'Ω', 'kohm': 'kΩ', 'kOhm': 'kΩ', 'Mohm': 'MΩ', 'MOhm': 'MΩ', 'kmph': 'km/h', 'kmh': 'km/h', 'bytes': 'byte', 'bits': 'bit', 'feet': 'ft', 'foot': 'ft', 'inch': 'in', 'inches': 'in', 'miles': 'mi', 'mile': 'mi', 'pounds': 'lb', 'pound': 'lb', 'lbs': 'lb', 'years': 'yr', 'year': 'yr', 'days': 'day' };
  function lookupUnit(sym) {
    if (WORDS[sym] && WORDS[sym] !== sym) return parseUnit(WORDS[sym]);
    if (UNITS[sym]) { const u = UNITS[sym]; return { f: u[0], d: u[1].slice(), off: u[2] || 0, temp: !!u[2] }; }
    for (const p of ['da', ...Object.keys(PREFIX).filter(x => x !== 'da')]) {
      if (sym.startsWith(p) && sym.length > p.length) { const base = sym.slice(p.length); if (PREFIXABLE.has(base) && UNITS[base]) return { f: PREFIX[p] * UNITS[base][0], d: UNITS[base][1].slice(), off: 0 }; }
    }
    return null;
  }
  /** Parse a unit expression such as "m/s^2", "kg·m s⁻²", "J/(kg·K)", "km/h", "kWh". Returns {f, d, off, temp} */
  function parseUnit(str) {
    let s = String(str).trim().replace(/\bper\b/g, '/').replace(/[·⋅∙×*]/g, ' ').replace(/\^\s*/g, '^').replace(/ohms?\b/gi, 'Ω');
    s = s.replace(/([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, m => '^' + m.split('').map(c => SUP[c]).join('')).replace(/\(|\)/g, m => ' ' + m + ' ');
    if (!s.trim()) return { f: 1, d: D(), off: 0, none: true };
    const toks = s.split(/\s+|(?=\/)|(?<=\/)/).filter(Boolean);
    let f = 1, d = D(), sign = 1, depth = 0, groupSign = [], temp = false, off = 0; const n = toks.length;
    for (let k = 0; k < n; k++) {
      const tk = toks[k];
      if (tk === '/') { sign = -1 * (groupSign.length ? groupSign[groupSign.length - 1] : 1); continue; }
      if (tk === '(') { groupSign.push(sign); depth++; continue; }
      if (tk === ')') { groupSign.pop(); depth--; sign = groupSign.length ? groupSign[groupSign.length - 1] : 1; continue; }
      const m = /^([^\^]+?)(?:\^?(-?\d+))?$/.exec(tk); if (!m) return null;
      let sym = m[1], e = m[2] ? +m[2] : 1;
      if (!m[2] && /\d$/.test(sym)) { const mm = /^(.*?)(\d)$/.exec(sym); sym = mm[1]; e = +mm[2]; }
      const u = lookupUnit(sym); if (!u) return null;
      if (u.temp) { temp = true; if (n === 1) off = u.off; }
      f *= Math.pow(u.f, e * sign); for (let j = 0; j < 7; j++) d[j] += u.d[j] * e * sign;
      if (!groupSign.length) { /* a lone "/" applies to the next factor only, like "J/kg K" read as J/(kg K)? keep SI habit: everything after / is denominator */ }
    }
    return { f, d, off, temp };
  }
  const NUMRE = /^\s*([+\-−]?(?:\d+\.?\d*|\.\d+))(?:\s*[eE]\s*([+\-−]?\d+)|\s*(?:[x×*·]|\\times)\s*10\s*(?:\^|\*\*)\s*\(?\s*([+\-−]?\d+)\s*\)?|\s*[x×*·]\s*10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+))?/;
  /** Parse "3.00 × 10^8 m/s" → {value (SI), raw value, unit, sf:[min,max], hasUnit} */
  function parseQty(str) {
    const s = String(str).trim().replace(/,(?=\d{3}\b)/g, '');
    const m = NUMRE.exec(s); if (!m) fail('nan', 'Start with a number, then the unit.');
    let mant = m[1].replace('−', '-'), exp = 0;
    if (m[2]) exp = +m[2].replace('−', '-'); else if (m[3]) exp = +m[3].replace('−', '-'); else if (m[4]) exp = +m[4].split('').map(c => SUP[c]).join('');
    const value = parseFloat(mant) * Math.pow(10, exp);
    const rest = s.slice(m[0].length).trim();
    const u = parseUnit(rest); if (!u) fail('unit', 'I do not know the unit "' + rest + '".');
    const si = u.temp && u.off ? (value + (u.off / u.f)) * u.f : value * u.f;
    return { value: si, num: value, unit: u, sf: countSF(mant), hasUnit: !u.none, unitText: rest, dp: (mant.split('.')[1] || '').length, exp };
  }
  const DIMNAMES = [[D(1), 'a length'], [D(0, 1), 'a mass'], [D(0, 0, 1), 'a time'], [D(1, 0, -1), 'a speed'], [D(1, 0, -2), 'an acceleration'], [D(1, 1, -2), 'a force'], [D(2, 1, -2), 'an energy'], [D(2, 1, -3), 'a power'], [D(-1, 1, -2), 'a pressure'], [D(1, 1, -1), 'a momentum'], [D(0, 0, 1, 1), 'a charge'], [D(2, 1, -3, -1), 'a voltage'], [D(2, 1, -3, -2), 'a resistance'], [D(0, 0, 0, 1), 'a current'], [D(0, 0, -1), 'a frequency'], [D(2), 'an area'], [D(3), 'a volume'], [D(0, 0, 0, 0, 1), 'a temperature'], [D(0, 0, 0, 0, 0, 1), 'an amount of substance'], [D(-3, 0, 0, 0, 0, 1), 'a concentration'], [D(-3, 1), 'a density'], [D(), 'a pure number']];
  const dimEq = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  const dimName = d => { const f = DIMNAMES.find(x => dimEq(x[0], d)); return f ? f[1] : 'a different kind of quantity'; };

  /* ---------- SHA-256 + HMAC (for contest result files; pure JS so it works from disk) ---------- */
  function sha256Bytes(bytes) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const l = bytes.length, withPad = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(withPad); m.set(bytes); m[l] = 0x80;
    const bits = l * 8; for (let j = 0; j < 8; j++) m[withPad - 1 - j] = Math.floor(bits / Math.pow(2, 8 * j)) & 0xff;
    const w = new Uint32Array(64);
    for (let o = 0; o < withPad; o += 64) {
      for (let t = 0; t < 16; t++) w[t] = (m[o + 4 * t] << 24) | (m[o + 4 * t + 1] << 16) | (m[o + 4 * t + 2] << 8) | m[o + 4 * t + 3];
      for (let t = 16; t < 64; t++) { const a = w[t - 15], b = w[t - 2]; const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3), s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10); w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) { const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[t] + w[t]) | 0, S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0; }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    const out = new Uint8Array(32); H.forEach((v, j) => { out[4 * j] = v >>> 24; out[4 * j + 1] = (v >>> 16) & 255; out[4 * j + 2] = (v >>> 8) & 255; out[4 * j + 3] = v & 255; }); return out;
  }
  const utf8 = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const sha256 = s => hex(sha256Bytes(utf8(s)));
  function hmac(key, msg) { let k = utf8(key); if (k.length > 64) k = sha256Bytes(k); const kp = new Uint8Array(64); kp.set(k); const ip = kp.map(x => x ^ 0x36), op = kp.map(x => x ^ 0x5c); const inner = sha256Bytes(new Uint8Array([...ip, ...utf8(msg)])); return hex(sha256Bytes(new Uint8Array([...op, ...inner]))); }
  /** Canonical JSON: sorted keys, no spaces (matches sorted-key JSON with no spaces and unescaped Unicode, so other tools can verify it). */
  function canon(v) { if (v === null || typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'; }

  Object.assign(SM, { MathErr, fail, gcd, lcm, squareOut, factorInt, Q, q, Num, rng, hashStr, tokenize, parse: s => mixFix(parse(s)), parseRel: s => { const r = parseRel(s); r.parts.forEach(mixFix); return r; }, strip, evalNum, evalPoly, evalF, Poly, monoKey, parseKey, varsOf, walk,
    roundSF, roundDP, fmtSF, fmtSFPlain, countSF, fmtNum, supText, UNITS, PREFIX, parseUnit, parseQty, dimEq, dimName, Dim: D, sha256, hmac, canon });
})();
