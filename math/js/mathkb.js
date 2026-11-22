/* Stark Math 1.4: the maths keyboard.
   Not handwriting or photo recognition: Stark Math ships no recogniser. This is a tap-in keyboard for phones and tablets, a
   matching Alt-key layer for laptops and a live preview drawn by the app's own renderer. Every key only edits the plain text
   the learner would type anyway ("3/4", "x^(n+1)", "sqrt(16)", "x<=3"), so the existing parser, checker and Madeline see the
   same text as before. The preview shows what that text means, marks what is unfinished and says what it reads as aloud.
   The pure half (apply, analyze, say, shortcutKey) runs under node and is tested; mount() builds the on-screen half. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FN_RE = /(arcsin|arccos|arctan|asin|acos|atan|sqrt|cbrt|abs|sin|cos|tan|ln|log|exp)\($/;
  const CLOSER = { '(': ')', '[': ']', '{': '}' };

  /* ---------- editing: state is {v: text, s: selection start, e: selection end} ---------- */
  const at = (v, i) => (i >= 0 && i < v.length ? v[i] : '');
  function put(st, text, back) { const v = st.v.slice(0, st.s) + text + st.v.slice(st.e), c = st.s + text.length - (back || 0); return { v, s: c, e: c }; }
  /** Insert pre+post around the selection; with nothing selected the caret lands between them. */
  function wrap(st, pre, post) {
    const sel = st.v.slice(st.s, st.e), v = st.v.slice(0, st.s) + pre + sel + post + st.v.slice(st.e);
    const c = sel ? st.s + pre.length + sel.length + post.length : st.s + pre.length; return { v, s: c, e: c };
  }
  const count = (v, ch) => v.split(ch).length - 1;
  /** A closing bracket typed right before one the keyboard added just steps over it. */
  function closeKey(st, ch) {
    if (st.s === st.e && at(st.v, st.s) === ch && count(st.v, '(') + count(st.v, '[') + count(st.v, '{') >= count(st.v, ')') + count(st.v, ']') + count(st.v, '}')) return { v: st.v, s: st.s + 1, e: st.s + 1 };
    return put(st, ch);
  }
  function backspace(st) {
    if (st.s !== st.e) return put(st, '');
    if (st.s === 0) return st;
    const b = st.v.slice(0, st.s), a = st.v.slice(st.s); let cut = 1, m;
    if ((m = FN_RE.exec(b))) { cut = m[0].length; if (a[0] === ')') return { v: b.slice(0, -cut) + a.slice(1), s: st.s - cut, e: st.s - cut }; }
    else if (b.endsWith('(') && a[0] === ')') return { v: b.slice(0, -1) + a.slice(1), s: st.s - 1, e: st.s - 1 };
    else if (/(<=|>=|!=)$/.test(b)) cut = 2;
    return { v: b.slice(0, -cut) + a, s: st.s - cut, e: st.s - cut };
  }
  const move = (st, d) => { const c = Math.max(0, Math.min(st.v.length, (st.s !== st.e ? (d < 0 ? st.s : st.e) : st.s + d))); return { v: st.v, s: c, e: c }; };

  /* ---------- the keys ---------- */
  const T = (id, label, name, act, extra) => Object.assign({ id, label, name, act }, extra || {});
  const lit = (id, text, name, label, extra) => T(id, label || text, name, st => put(st, text), extra);
  const prs = (id, label, name, open, extra) => T(id, label, name, st => wrap(st, open, ')'), extra);
  const KEYS = {};
  [['0', 'Digit 0'], ['1', 'Digit 1'], ['2', 'Digit 2'], ['3', 'Digit 3'], ['4', 'Digit 4'], ['5', 'Digit 5'], ['6', 'Digit 6'], ['7', 'Digit 7'], ['8', 'Digit 8'], ['9', 'Digit 9']].forEach(([d, n]) => { KEYS[d] = lit(d, d, n); });
  Object.assign(KEYS, {
    '.': lit('.', '.', 'Decimal point'), ',': lit(',', ',', 'Comma, to separate answers'),
    add: lit('add', '+', 'Plus', '+'), sub: lit('sub', '-', 'Minus, or negative sign', '−'), mul: lit('mul', '*', 'Times', '×'), div: lit('div', '÷', 'Divided by, written on one line'),
    frac: T('frac', '<span class="math"><span class="mfrac"><span class="mnum">a</span><span class="mden">b</span></span></span>', 'Fraction. Type the top, press this, then type the bottom',
      st => (st.s !== st.e ? wrap(st, '(', ')/') : put(st, '/')), { html: true }),
    lp: T('lp', '(', 'Open bracket. The closing bracket is added for you', st => wrap(st, '(', ')')), rp: T('rp', ')', 'Close bracket', st => closeKey(st, ')')),
    sq: T('sq', 'x<sup>2</sup>', 'Squared. Adds to the power 2', st => put(st, '^2'), { html: true }),
    pow: T('pow', 'x<sup>n</sup>', 'To the power. Type the power, then close the bracket', st => wrap(st, '^(', ')'), { html: true }),
    sqrt: prs('sqrt', '√', 'Square root. Type what is under the root', 'sqrt('), cbrt: prs('cbrt', '∛', 'Cube root', 'cbrt('), abs: prs('abs', '|x|', 'Absolute value', 'abs('),
    pi: lit('pi', 'π', 'Pi'), theta: lit('theta', 'θ', 'Theta'), e: lit('e', 'e', "Euler's number e"), x: lit('x', 'x', 'The letter x'), y: lit('y', 'y', 'The letter y'),
    pm: lit('pm', '±', 'Plus or minus'), deg: lit('deg', '°', 'Degrees'), pct: lit('pct', '%', 'Percent'), fact: lit('fact', '!', 'Factorial'), space: lit('space', ' ', 'Space, for a mixed number such as 2 1/3', '␣'),
    lt: lit('lt', '<', 'Less than'), gt: lit('gt', '>', 'Greater than'), eq: lit('eq', '=', 'Equals'), le: lit('le', '<=', 'Less than or equal to', '≤'), ge: lit('ge', '>=', 'Greater than or equal to', '≥'), ne: lit('ne', '!=', 'Not equal to', '≠'),
    sin: prs('sin', 'sin', 'Sine', 'sin('), cos: prs('cos', 'cos', 'Cosine', 'cos('), tan: prs('tan', 'tan', 'Tangent', 'tan('),
    asin: prs('asin', 'sin<sup>-1</sup>', 'Inverse sine', 'asin(', { html: true }), acos: prs('acos', 'cos<sup>-1</sup>', 'Inverse cosine', 'acos(', { html: true }), atan: prs('atan', 'tan<sup>-1</sup>', 'Inverse tangent', 'atan(', { html: true }),
    ln: prs('ln', 'ln', 'Natural logarithm', 'ln('), log: prs('log', 'log', 'Logarithm base 10', 'log('),
    left: T('left', '←', 'Move the cursor left', st => move(st, -1)), right: T('right', '→', 'Move the cursor right', st => move(st, 1)),
    bs: T('bs', '⌫', 'Delete', backspace), clear: T('clear', 'AC', 'Clear everything', () => ({ v: '', s: 0, e: 0 })),
  });
  const PAGES = [
    { id: 'num', name: 'Numbers', rows: [['7', '8', '9', 'div', 'frac', 'lp'], ['4', '5', '6', 'mul', 'sq', 'rp'], ['1', '2', '3', 'sub', 'pow', 'sqrt'], ['0', '.', ',', 'add', 'pi', 'x']] },
    { id: 'fn', name: 'Functions and signs', rows: [['lt', 'gt', 'eq', 'le', 'ge', 'ne'], ['sin', 'cos', 'tan', 'ln', 'log', 'abs'], ['asin', 'acos', 'atan', 'cbrt', 'pm', 'deg'], ['pct', 'fact', 'y', 'theta', 'space', 'e']] },
  ];
  /** Run one key on an editing state. Unknown key: unchanged. */
  function apply(st, id) { const k = KEYS[id]; return k ? k.act({ v: String(st.v), s: st.s, e: st.e }) : st; }
  /** Press a list of key ids from an empty box (used by the tests, and handy for demos). */
  function press(ids, start) { let st = start || { v: '', s: 0, e: 0 }; ids.forEach(id => { st = apply(st, id); }); return st; }

  /* Laptop layer: Alt + key (by physical key code, so keyboard layouts and macOS Option do not change it). AltGr is left alone. */
  const SHORTCUTS = [
    { code: 'Slash', key: 'frac', combo: 'Alt+/', what: 'Fraction bar (wraps a selection)' }, { code: 'KeyR', key: 'sqrt', combo: 'Alt+R', what: 'Square root' }, { code: 'KeyR', shift: true, key: 'cbrt', combo: 'Alt+Shift+R', what: 'Cube root' },
    { code: 'Digit6', key: 'pow', combo: 'Alt+6', what: 'To the power ( )' }, { code: 'Digit2', key: 'sq', combo: 'Alt+2', what: 'Squared' }, { code: 'KeyP', key: 'pi', combo: 'Alt+P', what: 'Pi' },
    { code: 'KeyB', key: 'abs', combo: 'Alt+B', what: 'Absolute value bars' }, { code: 'Comma', key: 'le', combo: 'Alt+,', what: 'Less than or equal to' }, { code: 'Period', key: 'ge', combo: 'Alt+.', what: 'Greater than or equal to' },
    { code: 'KeyN', key: 'ne', combo: 'Alt+N', what: 'Not equal to' }, { code: 'KeyM', key: 'pm', combo: 'Alt+M', what: 'Plus or minus' }, { code: 'KeyG', key: 'deg', combo: 'Alt+G', what: 'Degrees' },
    { code: 'KeyK', key: '@toggle', combo: 'Alt+K', what: 'Show or hide the on-screen keyboard' },
  ];
  /** Key id for a keydown event-like {altKey, ctrlKey, metaKey, shiftKey, code, altGraph}, or ''. */
  function shortcutKey(ev) {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.altGraph) return '';
    const s = SHORTCUTS.find(x => x.code === ev.code && !!x.shift === !!ev.shiftKey); return s ? s.key : '';
  }

  /* ---------- reading the text: is it finished, what does it look like, how does it sound ---------- */
  const REL_WORD = { '=': 'equals', '<': 'is less than', '>': 'is greater than', '<=': 'is at most', '>=': 'is at least', '!=': 'is not equal to' };
  const REL_SYM = { '<=': '≤', '>=': '≥', '!=': '≠' };
  const simple = a => ['num', 'var', 'const', 'box'].includes(a.t);
  /** The expression as words, for a screen reader. */
  function say(a) {
    const r = say;
    switch (a.t) {
      case 'num': return a.raw; case 'var': return a.n; case 'box': return 'blank';
      case 'const': return a.n === 'pi' ? 'pi' : a.n === 'inf' ? 'infinity' : 'e';
      case 'grp': return 'open bracket ' + r(a.a) + ' close bracket';
      case 'neg': return 'negative ' + r(a.a);
      case 'add': return r(a.a) + ' plus ' + r(a.b);
      case 'sub': return r(a.a) + ' minus ' + r(a.b);
      case 'pm': return (a.pre ? '' : r(a.a) + ' ') + 'plus or minus ' + r(a.b);
      case 'mul': return a.imp ? r(a.a) + ' ' + r(a.b) : r(a.a) + ' times ' + r(a.b);
      case 'div': { const n = a.a.t === 'grp' ? a.a.a : a.a, d = a.b.t === 'grp' ? a.b.a : a.b; return a.obel ? r(a.a) + ' divided by ' + r(a.b) : r(n) + ' over ' + r(d) + (simple(n) && simple(d) ? '' : ', end of fraction'); }
      case 'mixed': return a.w + ' and ' + a.n + ' over ' + a.d;
      case 'pow': { const e = a.b.t === 'grp' ? a.b.a : a.b; return r(a.a) + (e.t === 'num' && e.raw === '2' ? ' squared' : e.t === 'num' && e.raw === '3' ? ' cubed' : ' to the power ' + r(e) + (simple(e) ? '' : ', end of power')); }
      case 'fn': { const x = a.a.t === 'grp' ? a.a.a : a.a, w = { sqrt: 'the square root of', cbrt: 'the cube root of', abs: 'the absolute value of', ln: 'the natural log of', log: 'log base 10 of', asin: 'inverse sine of', acos: 'inverse cosine of', atan: 'inverse tangent of' }[a.n] || a.n + ' of';
        return w + ' ' + r(x) + (simple(x) ? '' : (a.n === 'sqrt' || a.n === 'cbrt' ? ', end of root' : ', end of ' + (a.n === 'abs' ? 'absolute value' : 'function'))); }
      case 'call': return a.n + ' of ' + r(a.a);
      case 'pct': return r(a.a) + ' percent'; case 'deg': return r(a.a) + ' degrees'; case 'fact': return r(a.a) + ' factorial'; case 'prime': return r(a.a) + ' prime';
      case 'tuple': return 'the pair ' + a.items.map(r).join(', ');
    }
    return '';
  }
  /** Split on commas that are not inside brackets. */
  function topCommas(src) { let d = 0, st = 0; const out = []; for (let i = 0; i < src.length; i++) { const c = src[i]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ',' && d === 0) { out.push(src.slice(st, i)); st = i + 1; } } out.push(src.slice(st)); return out; }
  /** Closing brackets still owed, as a string ('' when balanced or when a closer has no opener). */
  function owed(s) { const stack = []; for (const c of s) { if (CLOSER[c]) stack.push(CLOSER[c]); else if (')]}'.includes(c)) { if (!stack.length) return ''; stack.pop(); } } return stack.reverse().join(''); }
  /** Parse one piece (may hold = < > <= >= !=). Returns {ok, parts} or {ok:false, msg}. */
  function tryPiece(s) { try { const r = SM.parseRel(s); return { ok: true, parts: r.parts, ops: r.ops }; } catch (e) { return { ok: false, msg: e && e.message || 'I could not read that.' }; } }
  /** Complete an unfinished piece: a dashed box for a missing number and closing brackets for open ones. */
  function complete(s) {
    const close = owed(s), seen = new Set(), tries = [[s, 0], [s + close, 1], [s + '□', 2], [s + '□' + close, 3], ['□' + s, 2], ['□' + s + close, 3], ['□' + s + '□', 2], ['□' + s + '□' + close, 3]];
    for (const [t, bits] of tries) {
      if (seen.has(t)) continue; seen.add(t);
      const r = tryPiece(t); if (r.ok) return { text: t, res: r, box: !!(bits & 2), closed: !!(bits & 1) && !!close };
    }
    return null;
  }
  /** Where an error is, when the message says: an index into src, or -1. */
  function errPos(src, msg) {
    if (/closing bracket/.test(msg)) { let d = 0; for (let i = 0; i < src.length; i++) { const c = src[i]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) { if (!d) return i; d--; } } }
    const m = /"(.)"/.exec(msg); if (m) return src.indexOf(m[1]);
    return -1;
  }
  const NOTE_DIV_IMP = 'This reads as (top over bottom) times the next part. For one bottom that is longer, put it in brackets: 1/(2x).';
  function hasDivImp(a) { let f = false; SM.walk(a, n => { if (n && n.t === 'mul' && n.imp && n.a && n.a.t === 'div' && !n.a.vulgar && !n.a.obel) f = true; }); return f; }
  /**
   * Look at what is typed. kind is the answer kind (num, expr, eqn, set, pair, ineq, ratio, matrix, qty, text ...).
   * Returns {status: 'empty'|'ok'|'incomplete'|'error'|'plain', html, spoken, msg, notes, pos}.
   */
  function analyze(src, kind) {
    src = String(src == null ? '' : src);
    const out = { status: 'empty', html: '', spoken: '', msg: '', notes: [], pos: -1 };
    if (!src.trim()) return out;
    if (kind === 'qty' || kind === 'text' || kind === 'matrix' || /[∫]|lim_/.test(src)) { out.status = 'plain'; out.html = esc(src); out.spoken = src; return out; }
    const sepRe = kind === 'ratio' ? /:/ : kind === 'pair' && /\bR\b/.test(src) ? /\bR\b/ : null;
    const groups = sepRe ? src.split(sepRe) : [src], joiner = kind === 'ratio' ? ':' : 'R';
    let status = 'ok'; const html = [], spoken = [], notes = [];
    for (let g = 0; g < groups.length; g++) {
      const pieces = topCommas(groups[g]);
      for (let p = 0; p < pieces.length; p++) {
        const s = pieces[p];
        if (!s.trim()) { status = status === 'error' ? status : 'incomplete'; html.push('<span class="mbox mbox-miss" aria-label="missing"></span>'); spoken.push('blank'); continue; }
        let r = tryPiece(s), text = s, miss = false;
        if (!r.ok) {
          const c = complete(s);
          if (!c) { out.status = 'error'; out.msg = r.msg; out.pos = errPos(src, r.msg); out.html = out.pos >= 0 ? esc(src.slice(0, out.pos)) + '<span class="mx-err">' + esc(src[out.pos]) + '</span>' + esc(src.slice(out.pos + 1)) : '<span class="mx-err">' + esc(src) + '</span>'; out.spoken = ''; return out; }
          r = c.res; text = c.text; miss = true; status = 'incomplete';
          notes.push(c.box && c.closed ? 'Something is missing and a bracket is still open.' : c.box ? 'Something is still missing: the dashed box shows where.' : 'A bracket is still open.');
        }
        let h2 = SM.renderMath(text);
        if (miss) h2 = h2.replace(/class="mbox"/g, 'class="mbox mbox-miss"');
        html.push(h2);
        spoken.push(r.parts.map((a, i) => (i ? REL_WORD[r.ops[i - 1]] + ' ' : '') + say(a)).join(' '));
        r.parts.forEach(a => { if (hasDivImp(a) && !notes.includes(NOTE_DIV_IMP)) notes.push(NOTE_DIV_IMP); });
      }
    }
    out.status = status; out.notes = notes; out.msg = status === 'incomplete' ? 'Not finished yet. ' + notes.filter(n => n !== NOTE_DIV_IMP).join(' ') : '';
    out.html = html.join(sepRe ? '<span class="mo">' + joiner + '</span>' : '<span class="mo mo-c">,</span> ');
    out.spoken = spoken.join(sepRe ? (kind === 'ratio' ? ' to ' : ' remainder ') : ', ');
    return out;
  }

  /* ---------- the on-screen half ---------- */
  function mount(input, opts) {
    opts = opts || {};
    const h = SM.h, coarse = !!(G.matchMedia && G.matchMedia('(pointer: coarse)').matches);
    let kind = opts.kind || '', page = 0, open = opts.open !== undefined ? !!opts.open : coarse, sys = false, timer = null, off = false;
    const uid = 'mk' + Math.random().toString(36).slice(2, 7);
    const preview = h('div', { class: 'ans-preview mk-preview', 'aria-hidden': 'true' });
    const msg = h('div', { class: 'mk-msg', 'aria-hidden': 'true' });
    const status = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite', id: uid + '-s' });
    const grid = h('div', { class: 'mk-grid', role: 'group', 'aria-label': 'Maths keys. Arrow keys move between keys.', id: uid + '-g' });
    const tabs = PAGES.map((pg, i) => h('button', { type: 'button', class: 'btn btn-small mk-tab', 'aria-pressed': 'false', onclick: () => { page = i; draw(); } }, pg.name));
    const sysBtn = h('button', { type: 'button', class: 'btn btn-small btn-ghost mk-tab', 'aria-pressed': 'false', 'aria-label': 'Use the device keyboard instead of these keys', onclick: () => { sys = !sys; setMode(); if (sys) input.focus(); sysBtn.setAttribute('aria-pressed', String(sys)); } }, 'abc');
    const help = h('details', { class: 'mk-help' }, h('summary', null, 'Keyboard shortcuts'), h('ul', null, SHORTCUTS.map(s => h('li', null, h('kbd', null, s.combo), ' ' + s.what)),
      h('li', null, 'Typing works as always: 3/4, x^2, sqrt(9), pi, x<=3. Arrow keys move between the on-screen keys.')));
    const control = ['left', 'right', 'bs', 'clear'];
    const enterBtn = opts.onEnter ? h('button', { type: 'button', class: 'mk-key mk-enter', 'aria-label': opts.enterLabel || 'Check my answer', onmousedown: e => e.preventDefault(), onclick: () => opts.onEnter() }, opts.enterText || 'Check ↵') : null;
    const panel = h('div', { class: 'mk-panel', id: uid, role: 'group', 'aria-label': 'Maths keyboard', hidden: !open }, h('div', { class: 'mk-tabs' }, tabs, sysBtn), grid, help);

    function press1(id, ev) {
      const st = { v: input.value, s: input.selectionStart === null ? input.value.length : input.selectionStart, e: input.selectionEnd === null ? input.value.length : input.selectionEnd };
      const n = apply(st, id); input.value = n.v;
      try { input.setSelectionRange(n.s, n.e); } catch (x) { /* not a text field */ }
      if (ev && ev.detail > 0 && G.document.activeElement !== input) input.focus({ preventScroll: true });
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function keyBtn(id) {
      const k = KEYS[id];
      return h('button', { type: 'button', class: 'mk-key' + (/^[0-9.,]$/.test(id) ? ' mk-digit' : ''), 'data-key': id, 'aria-label': k.name, tabindex: '-1', onmousedown: e => e.preventDefault(), onclick: e => press1(id, e), [k.html ? 'html' : 'text']: k.label });
    }
    function draw() {
      tabs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === page)));
      grid.textContent = '';
      PAGES[page].rows.forEach(row => row.forEach(id => grid.appendChild(keyBtn(id))));
      control.forEach(id => grid.appendChild(keyBtn(id)));
      if (enterBtn) grid.appendChild(enterBtn);
      const first = grid.querySelector('.mk-key'); if (first) first.tabIndex = 0;
    }
    grid.addEventListener('keydown', e => {
      const keys = Array.from(grid.querySelectorAll('.mk-key')), i = keys.indexOf(G.document.activeElement); if (i < 0) return;
      const cols = 6; let j = i;
      if (e.key === 'ArrowRight') j = Math.min(keys.length - 1, i + 1); else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1);
      else if (e.key === 'ArrowDown') j = Math.min(keys.length - 1, i + cols); else if (e.key === 'ArrowUp') j = Math.max(0, i - cols);
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = keys.length - 1; else return;
      e.preventDefault(); keys[i].tabIndex = -1; keys[j].tabIndex = 0; keys[j].focus();
    });
    function setMode() { input.setAttribute('inputmode', open && coarse && !sys ? 'none' : 'text'); toggle.setAttribute('aria-expanded', String(open)); panel.hidden = !open || off; }
    const toggle = h('button', { type: 'button', class: 'btn btn-ghost btn-small mk-toggle', 'aria-controls': uid, 'aria-expanded': String(open), 'aria-label': 'Show or hide the maths keyboard (Alt+K)', onclick: () => { open = !open; setMode(); if (SM.setPref) SM.setPref('keypad', open); } }, 'Keys');
    function refresh() {
      const r = analyze(input.value, kind);
      preview.textContent = ''; msg.textContent = '';
      input.setAttribute('aria-invalid', r.status === 'error' ? 'true' : 'false');
      preview.className = 'ans-preview mk-preview mk-' + r.status;
      if (r.status === 'empty') { status.textContent = ''; return; }
      if (r.status === 'plain') { preview.append(h('span', { class: 'pv-label' }, 'You typed'), ' ', h('span', { class: 'mk-plain', text: input.value })); return; }
      if (r.status === 'error') {
        preview.append(h('span', { class: 'pv-label' }, 'You typed'), ' ', h('span', { class: 'mk-raw', html: r.html }));
        msg.textContent = 'Check this: ' + r.msg; clearTimeout(timer); timer = setTimeout(() => { status.textContent = 'Check this: ' + r.msg; }, 600); return;
      }
      preview.append(h('span', { class: 'pv-label' }, 'You typed'), ' ', h('span', { class: 'math', html: r.html }));
      msg.textContent = r.status === 'incomplete' ? r.msg : r.notes.join(' ');
      clearTimeout(timer); timer = setTimeout(() => { status.textContent = 'Reads as: ' + r.spoken + (r.status === 'incomplete' ? '. ' + r.msg : ''); }, 600);
    }
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', e => {
      const k = shortcutKey({ altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, code: e.code, altGraph: e.getModifierState && e.getModifierState('AltGraph') });
      if (k) { e.preventDefault(); if (k === '@toggle') { open = !open; setMode(); if (SM.setPref) SM.setPref('keypad', open); } else press1(k); return; }
      if (e.key === ')' && !e.altKey && !e.ctrlKey && !e.metaKey && input.selectionStart === input.selectionEnd) { const st = { v: input.value, s: input.selectionStart, e: input.selectionEnd }, n = closeKey(st, ')'); if (n.v === st.v) { e.preventDefault(); input.setSelectionRange(n.s, n.e); } }
    });
    draw(); setMode(); refresh();
    return {
      preview, msg, status, panel, toggle, refresh, el: [preview, msg, status, panel],
      setKind(k) { kind = k || ''; off = k === 'choice'; toggle.hidden = off; setMode(); refresh(); },
      reset() { input.value = ''; status.textContent = ''; refresh(); },
      get open() { return open; },
    };
  }

  /** Type literal text the way the keyboard would (a closing bracket steps over one the keyboard added). */
  function type(st, text) { for (const ch of String(text)) st = ch === ')' ? closeKey(st, ch) : put(st, ch); return st; }
  SM.mathkb = { KEYS, PAGES, SHORTCUTS, apply, press, type, shortcutKey, analyze, say, mount, complete, owed, topCommas };
})();
