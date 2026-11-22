/* Stark Math.
   A small self-written math renderer (fractions, powers, roots, absolute values, relations) that turns the same
   plain syntax learners type into typeset HTML, plus the SVG pictures used in problems (dot groups, fraction bars,
   number lines, shapes, triangles, circuits, matrices). Output is built from escaped text only. */
(function () {
  'use strict';
  const SM = window.SM;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RELSYM = { '=': '=', '<': '<', '>': '>', '<=': '≤', '>=': '≥', '!=': '≠', '≈': '≈' };
  const FNAME = { asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹', arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan' };
  const isAtomic = a => ['num', 'var', 'const', 'box', 'grp', 'fn', 'call', 'tuple'].includes(a.t);

  function node(a, o) {
    const r = x => node(x, o), strip = x => (x.t === 'grp' ? x.a : x);
    switch (a.t) {
      case 'num': return '<span class="mn">' + esc(a.raw) + '</span>';
      case 'var': return '<i class="mi">' + esc(a.n) + '</i>';
      case 'const': return '<span class="mi">' + (a.n === 'pi' ? 'π' : a.n === 'inf' ? '∞' : '<i>e</i>') + '</span>';
      case 'box': return '<span class="mbox" aria-label="blank"></span>';
      case 'grp': return '<span class="mp">(</span>' + r(a.a) + '<span class="mp">)</span>';
      case 'neg': return '<span class="mo mo-u">−</span>' + r(a.a);
      case 'add': return r(a.a) + '<span class="mo">+</span>' + r(a.b);
      case 'sub': return r(a.a) + '<span class="mo">−</span>' + r(a.b);
      case 'pm': return (a.pre ? '' : r(a.a)) + '<span class="mo' + (a.pre ? ' mo-u' : '') + '">±</span>' + r(a.b);
      case 'mul': {
        const L = a.a, R = a.b, lnum = /^(num|mixed)$/.test(lastLeaf(L).t), rnum = /^(num|mixed)$/.test(firstLeaf(R).t);
        if (a.sci) return r(L) + '<span class="mo">×</span>' + r(R);
        if (a.imp && !(lnum && rnum)) return r(L) + '<span class="mimp"></span>' + r(R);
        const sym = a.x || o.kid || (lnum && rnum) ? '×' : '·';
        return r(L) + '<span class="mo">' + sym + '</span>' + r(R);
      }
      case 'div': if (a.obel || o.inlineDiv) return r(a.a) + '<span class="mo">÷</span>' + r(a.b);
        // "5/3 × 6/7" parses as ((5/3) × 6) / 7; show it as written: 5/3 × (6 over 7), the same value
        if (a.a.t === 'mul' && a.a.x) return r(Object.assign({}, a.a, { b: { t: 'div', a: a.a.b, b: a.b } }));
        return '<span class="mfrac"><span class="mnum">' + r(strip(a.a)) + '</span><span class="mden">' + r(strip(a.b)) + '</span></span>';
      case 'mixed': return '<span class="mn">' + a.w + '</span><span class="mfrac"><span class="mnum"><span class="mn">' + a.n + '</span></span><span class="mden"><span class="mn">' + a.d + '</span></span></span>';
      case 'pow': return (isAtomic(a.a) || a.a.t === 'pow' ? r(a.a) : '<span class="mp">(</span>' + r(a.a) + '<span class="mp">)</span>') + '<sup class="msup">' + r(strip(a.b)) + '</sup>';
      case 'fn':
        if (a.n === 'sqrt') return '<span class="msqrt"><span class="mrad" aria-hidden="true">√</span><span class="mrad-body">' + r(strip(a.a)) + '</span></span>';
        if (a.n === 'cbrt') return '<span class="msqrt"><sup class="mroot">3</sup><span class="mrad" aria-hidden="true">√</span><span class="mrad-body">' + r(strip(a.a)) + '</span></span>';
        if (a.n === 'abs') return '<span class="mp">|</span>' + r(strip(a.a)) + '<span class="mp">|</span>';
        return '<span class="mfn">' + esc(FNAME[a.n] || a.n) + '</span>' + (a.a.t === 'grp' || isAtomic(a.a) && a.a.t !== 'num' && a.a.t !== 'var' ? r(a.a) : '<span class="mp">(</span>' + r(a.a) + '<span class="mp">)</span>');
      case 'call': return '<i class="mi">' + esc(a.n) + '</i><span class="mp">(</span>' + r(a.a) + '<span class="mp">)</span>';
      case 'pct': return r(a.a) + '<span class="mn">%</span>';
      case 'deg': return r(a.a) + '<span class="mn">°</span>';
      case 'fact': return r(a.a) + '<span class="mn">!</span>';
      case 'prime': return r(a.a) + '<span class="mn">′</span>';
      case 'tuple': return '<span class="mp">(</span>' + a.items.map(r).join('<span class="mo mo-c">,</span>') + '<span class="mp">)</span>';
    }
    return '';
  }
  function lastLeaf(a) { while (a && ['add', 'sub', 'mul', 'div', 'pm'].includes(a.t)) a = a.b; return a && (a.t === 'pow' || a.t === 'pct' || a.t === 'deg' ? lastLeaf(a.a) : a) || {}; }
  function firstLeaf(a) { while (a && ['add', 'sub', 'mul', 'div', 'pow', 'pct', 'deg', 'fact'].includes(a.t)) a = a.a; return a || {}; }

  /** Render one math expression (may contain relations, commas, limits and integrals) to HTML. */
  function renderMath(src, o) {
    o = o || {};
    src = String(src).replace(/≈/g, ' ≈ ');
    const pieces = src.split(/(lim_\([^)]*\)|∫_[^\s^]+\^[^\s(]+|∫|\bd[xyt]\b(?!\w))/);
    if (pieces.length > 1) return pieces.map(p => {
      let mm;
      if ((mm = /^lim_\(([^)]*)\)$/.exec(p))) return '<span class="mlim">lim<span class="msub">' + esc(mm[1]) + '</span></span>';
      if ((mm = /^∫_([^\s^]+)\^(\S+)$/.exec(p))) return '<span class="mint">∫<span class="mlims"><span>' + esc(mm[2]) + '</span><span>' + esc(mm[1]) + '</span></span></span>';
      if (p === '∫') return '<span class="mint">∫</span>';
      if (/^d[xyt]$/.test(p)) return '<span class="mimp"></span><i class="mi">d' + p[1] + '</i>';
      return p.trim() ? renderMath(p, o) : '';
    }).join('');
    // top-level commas separate independent expressions
    let depth = 0, cut = [], start = 0;
    for (let i = 0; i < src.length; i++) { const c = src[i]; if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--; else if (c === ',' && depth === 0) { cut.push(src.slice(start, i)); start = i + 1; } }
    if (cut.length) { cut.push(src.slice(start)); return cut.map(p => renderMath(p, o)).join('<span class="mo mo-c">,</span> '); }
    try {
      const parts = src.split(/(<=|>=|!=|≤|≥|≠|≈|=|<|>)/);
      const out = [];
      for (let i = 0; i < parts.length; i++) {
        if (i % 2) { out.push('<span class="mo mrel">' + (RELSYM[parts[i]] || esc(parts[i])) + '</span>'); continue; }
        if (!parts[i].trim()) continue;
        out.push(node(SM.parse(parts[i]), o));
      }
      return out.join('');
    } catch (e) {
      return esc(src).replace(/\^(\(?[-\w]+\)?)/g, '<sup>$1</sup>').replace(/sqrt\(([^)]*)\)/g, '√($1)');
    }
  }
  /** Render text with $...$ math segments. */
  function renderText(text, o) {
    // "\$" is a literal dollar sign (money); a pair of plain $ marks maths
    return String(text).split(/((?<!\\)\$[^$]*\$)/).map(seg => (seg.length > 1 && seg[0] === '$' && seg[seg.length - 1] === '$' ? '<span class="math" role="math" aria-label="' + esc(speakable(seg)) + '">' + renderMath(seg.slice(1, -1), o) + '</span>' : esc(seg.replace(/\\\$/g, '$')))).join('');
  }
  /** Plain speakable text for read-aloud. */
  function speakable(text) {
    return String(text).replace(/(?<!\\)\$([^$]*)\$/g, (m, x) => ' ' + x + ' ').replace(/\\\$/g, '$').replace(/sqrt\(([^)]*)\)/g, 'the square root of $1').replace(/√(\d+)/g, 'root $1')
      .replace(/\^2\b|²/g, ' squared').replace(/\^3\b|³/g, ' cubed').replace(/\^\(?(-?\w+)\)?/g, ' to the power $1').replace(/(\d)\/(\d)/g, '$1 over $2')
      .replace(/×|·|\*/g, ' times ').replace(/÷/g, ' divided by ').replace(/ - | − /g, ' minus ').replace(/≤/g, ' is at most ').replace(/≥/g, ' is at least ').replace(/≈/g, ' is about ').replace(/π/g, ' pi ').replace(/θ/g, ' theta ').replace(/\s+/g, ' ').trim();
  }

  /* ---------------- pictures (SVG strings) ---------------- */
  const svg = (w, h, body, label) => '<svg class="pic" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(label) + '" preserveAspectRatio="xMidYMid meet">' + body + '</svg>';
  const T = (x, y, s, cls) => '<text x="' + x + '" y="' + y + '" class="' + (cls || 'pt') + '" text-anchor="middle">' + esc(s) + '</text>';
  const PALETTE = ['var(--pic1)', 'var(--pic2)', 'var(--pic3)'];
  function dots(groups, cross) {
    let x = 14, body = '', n = 0; const total = groups.reduce((a, b) => a + b, 0), perRow = 5;
    groups.forEach((g, gi) => {
      const cols = Math.ceil(g / perRow) || 1;
      for (let i = 0; i < g; i++) { const cx = x + Math.floor(i / perRow) * 22, cy = 16 + (i % perRow) * 22; n++; body += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="' + PALETTE[gi % 3] + '"/>' + (cross && n > total - cross ? '<path d="M' + (cx - 7) + ' ' + (cy - 7) + 'l14 14M' + (cx + 7) + ' ' + (cy - 7) + 'l-14 14" stroke="var(--ink-strong)" stroke-width="2.5"/>' : ''); }
      x += cols * 22 + 18;
    });
    return svg(x, 122, body, groups.join(' and ') + ' dots' + (cross ? ', ' + cross + ' crossed out' : ''));
  }
  function bars(fracs) {
    const W = 260; let body = '';
    fracs.forEach(([n, d], k) => { const y = 8 + k * 38, w = W / d; for (let i = 0; i < d; i++) body += '<rect x="' + (10 + i * w) + '" y="' + y + '" width="' + w + '" height="28" rx="3" fill="' + (i < n ? PALETTE[k % 3] : 'var(--pic-empty)') + '" stroke="var(--pic-line)"/>'; body += T(W + 34, y + 19, n + '/' + d); });
    return svg(W + 60, fracs.length * 38 + 10, body, fracs.map(f => f[0] + ' out of ' + f[1] + ' parts shaded').join('; '));
  }
  function numline(o) {
    const { from, to } = o, W = 300, sx = v => 20 + (v - from) / (to - from || 1) * (W - 40); let body = '<line x1="12" y1="50" x2="' + (W - 12) + '" y2="50" class="pl"/>';
    const span = to - from, step = span <= 24 ? 1 : Math.pow(10, Math.floor(Math.log10(span)) - 1) * (span / Math.pow(10, Math.floor(Math.log10(span))) > 5 ? 5 : 2);
    for (let v = Math.ceil(from / step) * step; v <= to; v += step) body += '<line x1="' + sx(v) + '" y1="44" x2="' + sx(v) + '" y2="56" class="pl"/>' + (span <= 24 || Math.abs(v - from) < 1e-9 || Math.abs(v - to) < 1e-9 ? T(sx(v), 74, v) : '');
    if (o.mark !== undefined) body += '<circle cx="' + sx(o.mark) + '" cy="50" r="7" fill="var(--pic1)"/>' + T(sx(o.mark), 32, o.mark, 'pt pt-b');
    if (o.jump) { const [a, b] = o.jump; body += '<path d="M' + sx(a) + ' 44 Q' + (sx(a) + sx(b)) / 2 + ' 4 ' + sx(b) + ' 44" fill="none" stroke="var(--pic2)" stroke-width="3" marker-end="url(#ah)"/><circle cx="' + sx(a) + '" cy="50" r="6" fill="var(--pic1)"/>'; }
    return svg(W, 84, '<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--pic2)"/></marker></defs>' + body, 'number line from ' + from + ' to ' + to);
  }
  function shape(o) {
    const L = (x, y, s) => T(x, y, s, 'pt pt-s');
    switch (o.sh) {
      case 'rect': return svg(240, 150, '<rect x="40" y="25" width="160" height="90" class="pf"/>' + L(120, 138, o.a + ' cm') + L(222, 75, o.b + ' cm'), 'rectangle ' + o.a + ' by ' + o.b);
      case 'tri': return svg(240, 150, '<path d="M30 120 L210 120 L150 25 Z" class="pf"/><path d="M150 25 V120" class="pd"/>' + L(120, 140, 'base ' + o.a) + L(172, 80, 'h ' + o.b), 'triangle base ' + o.a + ' height ' + o.b);
      case 'para': return svg(240, 150, '<path d="M30 120 L170 120 L210 30 L70 30 Z" class="pf"/><path d="M70 30 V120" class="pd"/>' + L(100, 140, 'base ' + o.a) + L(90, 80, 'h ' + o.b), 'parallelogram');
      case 'trap': return svg(240, 150, '<path d="M20 120 L220 120 L170 30 L70 30 Z" class="pf"/><path d="M70 30 V120" class="pd"/>' + L(120, 22, o.c + ' cm') + L(120, 140, o.a + ' cm') + L(88, 80, 'h ' + o.b), 'trapezoid');
      case 'circle': return svg(200, 170, '<circle cx="100" cy="85" r="68" class="pf"/>' + (o.useD ? '<path d="M32 85 H168" class="pd2"/>' + L(100, 78, 'd = ' + 2 * o.r) : '<path d="M100 85 H168" class="pd2"/><circle cx="100" cy="85" r="3" fill="currentColor"/>' + L(134, 78, 'r = ' + o.r)), 'circle');
      case 'reg': { const n = o.n, pts = Array.from({ length: n }, (_, i) => { const t = -Math.PI / 2 + i * 2 * Math.PI / n; return (100 + 62 * Math.cos(t)).toFixed(1) + ' ' + (82 + 62 * Math.sin(t)).toFixed(1); }); return svg(200, 165, '<path d="M' + pts.join(' L') + ' Z" class="pf"/>' + L(100, 160, 'each side ' + o.a + ' cm'), 'regular polygon with ' + n + ' sides'); }
      case 'L': return svg(240, 160, '<path d="M30 130 H210 V30 H190 V50 H30 Z" class="pf"/>' + L(120, 150, o.a + ' cm') + L(228, 85, o.b + ' cm'), 'L shape');
    }
    return '';
  }
  function righttri(o) {
    const lab = (s, x, y, ask) => T(x, y, s, ask ? 'pt pt-ask' : 'pt pt-s');
    let body = '<path d="M30 140 L230 140 L230 30 Z" class="pf"/><path d="M216 140 V126 H230" class="pd"/>';
    if (o.a !== undefined) body += lab(o.ask === 'adj' ? '?' : String(o.a), 130, 160, o.ask === 'adj');
    else if (o.ask === 'adj') body += lab('?', 130, 160, true);
    if (o.b !== undefined) body += lab(o.ask === 'b' ? '?' : String(o.b), 252, 90, o.ask === 'b');
    else if (o.ask === 'opp' || o.ask === 'b') body += lab('?', 252, 90, true);
    if (o.c !== undefined || o.ask === 'c') body += lab(o.ask === 'c' ? '?' : String(o.c), 112, 74, o.ask === 'c');
    if (o.theta || o.th) body += '<path d="M62 140 A32 32 0 0 0 58 124" fill="none" stroke="var(--pic2)" stroke-width="2.5"/>' + T(76, 132, o.th ? o.th + '°' : (o.ask === 'θ' ? 'θ ?' : 'θ'), o.ask === 'θ' ? 'pt pt-ask' : 'pt pt-s');
    return svg(280, 170, body, 'right triangle');
  }
  function grid(o) {
    const pts = o.pts, lim = Math.max(6, ...pts.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1])))) + 1, S = 220, sx = x => S / 2 + x / lim * (S / 2 - 10), sy = y => S / 2 - y / lim * (S / 2 - 10);
    let body = '<rect width="' + S + '" height="' + S + '" fill="none"/>';
    for (let k = -lim; k <= lim; k++) body += '<line x1="' + sx(k) + '" y1="5" x2="' + sx(k) + '" y2="' + (S - 5) + '" class="pg"/><line x1="5" y1="' + sy(k) + '" x2="' + (S - 5) + '" y2="' + sy(k) + '" class="pg"/>';
    body += '<line x1="5" y1="' + sy(0) + '" x2="' + (S - 5) + '" y2="' + sy(0) + '" class="pl"/><line x1="' + sx(0) + '" y1="5" x2="' + sx(0) + '" y2="' + (S - 5) + '" class="pl"/>';
    if (o.line && pts.length === 2) { const [[x1, y1], [x2, y2]] = pts, m = (y2 - y1) / (x2 - x1), y = x => y1 + m * (x - x1); body += '<line x1="' + sx(-lim) + '" y1="' + sy(y(-lim)) + '" x2="' + sx(lim) + '" y2="' + sy(y(lim)) + '" stroke="var(--pic2)" stroke-width="2"/>'; }
    pts.forEach(p => { body += '<circle cx="' + sx(p[0]) + '" cy="' + sy(p[1]) + '" r="5" fill="var(--pic1)"/>' + T(sx(p[0]) + 4, sy(p[1]) - 9, '(' + p[0] + ', ' + p[1] + ')', 'pt pt-xs'); });
    return '<svg class="pic" viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="coordinate grid with points ' + esc(pts.map(p => '(' + p + ')').join(' ')) + '"><defs><clipPath id="gc"><rect width="' + S + '" height="' + S + '"/></clipPath></defs><g clip-path="url(#gc)">' + body + '</g></svg>';
  }
  function circuit(o) {
    const R = (x, y, lbl, vert) => (vert ? '<rect x="' + (x - 8) + '" y="' + (y - 20) + '" width="16" height="40" class="pr"/>' + T(x + 34, y + 5, lbl, 'pt pt-xs') : '<rect x="' + (x - 20) + '" y="' + (y - 8) + '" width="40" height="16" class="pr"/>' + T(x, y - 14, lbl, 'pt pt-xs'));
    const lab = v => (v >= 1000 ? v / 1000 + ' kΩ' : v + ' Ω');
    const body = o.par ? '<path d="M30 40 H230 V140 H30 Z M100 40 V140 M180 40 V140" class="pw"/>' + R(100, 90, lab(o.r1), true) + R(180, 90, lab(o.r2), true) + '<path d="M22 82 h16 M26 98 h8" class="pw"/>'
      : '<path d="M30 40 H230 V140 H30 Z" class="pw"/>' + R(100, 40, lab(o.r1)) + R(170, 40, lab(o.r2)) + '<path d="M22 82 h16 M26 98 h8" class="pw"/>';
    return svg(270, 170, body, (o.par ? 'parallel' : 'series') + ' circuit');
  }
  function matrices(items) {
    return '<div class="mats">' + items.map(it => '<div class="mat"><span class="mat-name">' + esc(it.name) + ' =</span><table class="mat-t" aria-label="matrix ' + esc(it.name) + '">' + it.m.map(row => '<tr>' + row.map(x => '<td>' + esc(String(x).replace('-', '−')) + '</td>').join('') + '</tr>').join('') + '</table></div>').join('') + '</div>';
  }
  /* Every string inside picture parameters is escaped before it reaches the SVG string (types that escape their own text are left alone). */
  const SELF_ESCAPED = { code: 1, matrices: 1, elements: 1 };
  const escDeep = v => (typeof v === 'string' ? esc(v) : Array.isArray(v) ? v.map(escDeep) : v && typeof v === 'object' ? Object.keys(v).reduce((o, k) => { o[k] = escDeep(v[k]); return o; }, {}) : v);
  function picture(p) {
    if (!p || typeof p !== 'object') return '';
    if (!SELF_ESCAPED[p.type]) p = escDeep(p);
    switch (p.type) {
      case 'dots': return dots(p.groups, p.cross);
      case 'array': { let b = ''; for (let i = 0; i < p.rows; i++) for (let j = 0; j < p.cols; j++) b += '<circle cx="' + (16 + j * 22) + '" cy="' + (16 + i * 22) + '" r="8" fill="var(--pic1)"/>'; return svg(p.cols * 22 + 10, p.rows * 22 + 10, b, p.rows + ' rows of ' + p.cols); }
      case 'share': { let b = ''; const per = Math.floor(p.n / p.d), rem = p.n % p.d; for (let g = 0; g < p.d; g++) { b += '<rect x="' + (6 + g * 56) + '" y="6" width="50" height="' + (Math.ceil(per / 2) * 20 + 14) + '" rx="8" class="pf"/>'; for (let i = 0; i < per; i++) b += '<circle cx="' + (20 + g * 56 + (i % 2) * 20) + '" cy="' + (20 + Math.floor(i / 2) * 20) + '" r="7" fill="var(--pic1)"/>'; } for (let i = 0; i < rem; i++) b += '<circle cx="' + (20 + i * 20) + '" cy="' + (Math.ceil(per / 2) * 20 + 40) + '" r="7" fill="var(--pic2)"/>'; return svg(p.d * 56 + 10, Math.ceil(per / 2) * 20 + 56, b, p.n + ' shared into ' + p.d + ' groups, ' + rem + ' left over'); }
      case 'places': { const s = String(p.n), names = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions']; let b = ''; s.split('').forEach((d, i) => { const pos = s.length - 1 - i, x = 10 + i * 46; b += '<rect x="' + x + '" y="20" width="40" height="44" rx="6" class="' + (pos === p.pos ? 'pf pf-hi' : 'pf') + '"/>' + T(x + 20, 50, d, 'pt pt-b') + T(x + 20, 80, names[pos].replace('hundred ', 'h. ').replace('thousands', 'th.').replace('ten ', 't. '), 'pt pt-xs'); }); return svg(s.length * 46 + 14, 90, b, 'place value chart'); }
      case 'numline': return numline(p);
      case 'bars': return bars(p.fracs);
      case 'area': { const [[a, b], [c, d]] = p.fracs, W = 200, H = 140; let g = ''; for (let i = 0; i < b; i++) for (let j = 0; j < d; j++) g += '<rect x="' + (10 + i * W / b) + '" y="' + (10 + j * H / d) + '" width="' + W / b + '" height="' + H / d + '" fill="' + (i < a && j < c ? 'var(--pic3)' : i < a ? 'var(--pic1)' : j < c ? 'var(--pic2)' : 'var(--pic-empty)') + '" stroke="var(--pic-line)"/>'; return svg(W + 20, H + 20, g, a + '/' + b + ' of ' + c + '/' + d); }
      case 'hundred': { let g = ''; for (let i = 0; i < 100; i++) g += '<rect x="' + (6 + (i % 10) * 14) + '" y="' + (6 + Math.floor(i / 10) * 14) + '" width="12" height="12" rx="2" fill="' + (i < Math.round(p.pct) ? 'var(--pic1)' : 'var(--pic-empty)') + '"/>'; return svg(150, 150, g, p.pct + ' out of 100 squares'); }
      case 'marbles': { let g = '', k = 0; p.counts.forEach((n, ci) => { for (let i = 0; i < n; i++, k++) g += '<circle cx="' + (16 + (k % 10) * 22) + '" cy="' + (16 + Math.floor(k / 10) * 22) + '" r="9" fill="' + ['#d9534f', '#4a7fd6', '#3e9e6a'][ci] + '"/>'; }); return svg(236, Math.ceil(k / 10) * 22 + 12, g, p.counts[0] + ' red, ' + p.counts[1] + ' blue, ' + p.counts[2] + ' green marbles'); }
      case 'grid': return grid(p);
      case 'shape': return shape(p);
      case 'righttri': return righttri(p);
      case 'angles': { const g = p.kind === 'tri' ? '<path d="M30 130 L230 130 L120 30 Z" class="pf"/>' : p.kind === 'right' ? '<path d="M40 130 H230 M40 130 V20" class="pl"/><path d="M40 130 L200 50" class="pl"/><path d="M40 116 h14 v14" class="pd"/>' : '<path d="M20 120 H240 M130 120 L60 30" class="pl"/>' + (p.kind === 'line' ? '<path d="M130 120 L210 40" class="pl"/>' : ''); return svg(260, 150, g + T(130, 146, 'given: ' + p.given.map(x => x + '°').join(', '), 'pt pt-s'), 'angle diagram'); }
      case 'solid': { const g = p.sh === 'box' ? '<path d="M40 60 L140 60 L140 140 L40 140 Z M40 60 L80 30 L180 30 L140 60 M180 30 L180 110 L140 140" class="pf"/>' + T(90, 158, p.a + ' cm', 'pt pt-s') + T(175, 135, p.b + ' cm', 'pt pt-s') + T(20, 104, p.c + ' cm', 'pt pt-s')
          : p.sh === 'sphere' ? '<circle cx="110" cy="85" r="65" class="pf"/><ellipse cx="110" cy="85" rx="65" ry="18" fill="none" class="pd"/><path d="M110 85 H175" class="pd2"/>' + T(142, 78, 'r = ' + p.r, 'pt pt-s')
          : '<ellipse cx="110" cy="135" rx="60" ry="16" class="pf"/>' + (p.sh === 'cone' ? '<path d="M50 135 L110 20 L170 135" class="pf"/>' : '<path d="M50 135 V40 M170 135 V40" class="pl"/><ellipse cx="110" cy="40" rx="60" ry="16" class="pf"/>') + '<path d="M110 135 H170" class="pd2"/>' + T(140, 130, 'r = ' + p.r, 'pt pt-s') + T(196, 90, 'h = ' + p.h, 'pt pt-s');
        return svg(230, 170, g, p.sh); }
      case 'unit': { const t = p.deg * Math.PI / 180, x = 100 + 70 * Math.cos(t), y = 100 - 70 * Math.sin(t); return svg(200, 200, '<circle cx="100" cy="100" r="70" fill="none" class="pl"/><path d="M20 100 H180 M100 20 V180" class="pg"/><path d="M100 100 L' + x.toFixed(1) + ' ' + y.toFixed(1) + '" stroke="var(--pic2)" stroke-width="3"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5" fill="var(--pic1)"/>' + T(150, 30, p.deg + '°', 'pt pt-b'), 'unit circle at ' + p.deg + ' degrees'); }
      case 'road': return svg(300, 90, '<path d="M10 60 H290" stroke="var(--pic-line)" stroke-width="10" stroke-linecap="round"/><path d="M10 60 H290" stroke="var(--pic-empty)" stroke-width="2" stroke-dasharray="10 10"/><rect x="18" y="30" width="54" height="20" rx="6" fill="var(--pic1)"/><circle cx="30" cy="52" r="6" fill="var(--ink-strong)"/><circle cx="60" cy="52" r="6" fill="var(--ink-strong)"/>' + T(150, 86, p.d + ' km in ' + p.t + ' hours', 'pt pt-s'), 'train trip of ' + p.d + ' km');
      case 'incline': { const t = p.th * Math.PI / 180, h = 180 * Math.tan(t); return svg(240, Math.min(200, h + 30), '<path d="M20 ' + (Math.min(180, h) + 15) + ' H200 V' + (Math.min(180, h) + 15 - Math.min(180, h)) + ' Z" class="pf"/>' + T(60, Math.min(180, h) + 10, p.th + '°', 'pt pt-s'), 'slope at ' + p.th + ' degrees'); }
      case 'circuit': return circuit(p);
      case 'matrices': return matrices(p.items);
      case 'code': return '<pre class="code-pic">' + esc(p.text) + '</pre>';
      case 'bits': return '<div class="bits">' + p.b.split('').map((d, i) => '<span class="bit"><b>' + d + '</b><small>' + Math.pow(2, p.b.length - 1 - i) + '</small></span>').join('') + '</div>';
      case 'elements': { const AW = window.SM_DATA.AW, N = Object.fromEntries(window.SM_DATA.elements.list.map(e => [e[0], e[1]])); return '<table class="el-table"><caption>Atomic masses (g/mol)</caption>' + p.els.map(e => '<tr><th>' + esc(e) + '</th><td>' + esc(N[e]) + '</td><td>' + AW[e] + '</td></tr>').join('') + '</table>'; }
    }
    return '';
  }

  Object.assign(SM, { esc, renderMath, renderText, speakable, picture });
})();
