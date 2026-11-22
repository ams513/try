/* Stark Math.
   Answer checking: exact equivalence (1/2 = 0.5 = 2/4 where the skill allows it), required forms
   (lowest terms, factored, expanded), solution sets, pairs, inequalities, ratios, matrices,
   quantities with units and significant figures, and mistake diagnosis from the actual wrong answer. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;
  const { Q, Num, Poly, parse, parseRel, strip, evalNum, evalPoly, evalF, varsOf, gcd, parseQty, dimEq, dimName, roundDP } = SM;

  const R = (ok, verdict, msg, extra) => Object.assign({ ok, verdict, msg: msg || '' }, extra || {});
  const clean = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').replace(/[−–]/g, '-').replace(/^answer\s*[:=]\s*/i, '').replace(/^[$€£¥₹]\s*(?=[\d.])/, '');
  const exact = v => (v instanceof Num ? v : evalNum(parse(String(v))));
  function tryNum(s) { try { return evalNum(parse(s)); } catch (e) { return null; } }
  const isDecimalInput = a => { a = strip(a); if (a.t === 'neg') a = strip(a.a); return a.t === 'num' && a.raw.includes('.'); };
  const decPlaces = a => { a = strip(a); if (a.t === 'neg') a = strip(a.a); return a.t === 'num' && a.raw.includes('.') ? a.raw.split('.')[1].length : 0; };
  /** Is the typed fraction in lowest terms? Looks at what was typed, not the value. */
  function lowestForm(a) {
    a = strip(a); if (a.t === 'neg') a = strip(a.a);
    if (a.t === 'mixed') return gcd(a.n, a.d) === 1 && a.n < a.d;
    if (a.t === 'div') { const n = strip(a.a), d = strip(a.b); const nn = n.t === 'neg' ? strip(n.a) : n; if (nn.t === 'num' && d.t === 'num' && nn.int && d.int) return gcd(nn.v.n, d.v.n) === 1 && d.v.n !== 1; return false; }
    return a.t === 'num' && a.int;
  }
  const isFractionInput = a => { a = strip(a); if (a.t === 'neg') a = strip(a.a); return a.t === 'div' || a.t === 'mixed' || (a.t === 'num' && a.int); };

  /* ---------- numbers ---------- */
  function checkNum(spec, input) {
    const s = clean(input).replace(/,(?=\d{3}(\D|$))/g, '').replace(/^[a-zA-Z]\s*=\s*/, '');
    let ast; try { ast = parse(spec.pct ? s.replace(/%\s*$/, '') : s.replace(/°\s*$/, '')); } catch (e) { return R(false, 'syntax', e.message); }
    const want = exact(spec.v);
    let got; try { got = evalNum(ast); }
    catch (e) {
      if (!want.isRational() || spec.dp !== undefined) { try { const f = evalF(ast); return approxNum(spec, want, f, s, ast); } catch (e2) { /* fall through */ } }
      return R(false, e.code === 'var' ? 'form' : 'syntax', e.message);
    }
    if (got.eq(want)) {
            if (spec.sci && !sciForm(ast)) return R(false, 'form', 'That is the right value. Write it in scientific notation: a number from 1 to 10 times a power of 10.', { equal: true });
      if (spec.surd && !surdForm(ast)) return R(false, 'form', 'That is equal, but the square root can be simplified further.', { equal: true });
      if (spec.frac && isDecimalInput(ast)) return R(false, 'form', 'That is the right value. Write it as a fraction.', { equal: true });
if (spec.lowest && !lowestForm(ast)) return R(false, 'not-simplest', isFractionInput(ast) ? 'That is equal, but it is not in lowest terms yet.' : 'That is equal. Now write it as a fraction in lowest terms.', { equal: true });
      if (spec.improper && strip(ast).t === 'mixed') return R(false, 'form', 'That is the same amount. Now write it as an improper fraction (top bigger than bottom).', { equal: true });
      if (spec.frac && isDecimalInput(ast)) return R(false, 'form', 'That is the right value. Write it as a fraction.', { equal: true });
      if (spec.dec && !isDecimalInput(ast) && !(strip(ast).t === 'num') && !(strip(ast).t === 'neg')) return R(false, 'form', 'That is the right value. Write it as a decimal.', { equal: true });
      const note = !spec.lowest && want.isRational() && strip(ast).t === 'div' && !lowestForm(ast) && !want.c.isInt() ? 'simplify' : '';
      return R(true, 'correct', '', { note, value: got });
    }
    if (!want.isRational() && isDecimalInput(ast)) return approxNum(spec, want, got.toFloat(), s, ast);
    return R(false, 'wrong', '', { value: got });
  }
  function approxNum(spec, want, f, s, ast) {
    const dp = spec.dp !== undefined ? spec.dp : 2, wf = want.toFloat(), typed = decPlaces(ast);
    const near = Math.abs(f - wf) <= 0.5 * Math.pow(10, -Math.max(dp, typed)) + 1e-9 * Math.max(1, Math.abs(wf));
    if (near && typed >= dp) return R(true, 'correct', '', { note: spec.dp === undefined ? 'exact' : '', value: f });
    if (near) return R(false, 'precision', 'Close. Give the answer to ' + dp + ' decimal place' + (dp === 1 ? '' : 's') + '.', { equal: true });
    if (Math.abs(f - wf) < 1e-9 * Math.max(1, Math.abs(wf))) return R(true, 'correct', '', { value: f });
    return R(false, 'wrong', '', { fvalue: f });
  }
  function sciForm(a) {
    a = strip(a); if (a.t === 'neg') a = strip(a.a);
    if (a.t !== 'mul') return false; const m0 = strip(a.a), p = strip(a.b);
    if (m0.t !== 'num' || m0.v.toFloat() < 1 || m0.v.toFloat() >= 10) return false;
    return p.t === 'pow' && strip(p.a).t === 'num' && strip(p.a).raw === '10';
  }
  function surdForm(a) { let ok = true; SM.walk(a, n => { if (n.t === 'num' && n.raw.includes('.')) ok = false; if (n.t === 'fn' && n.n === 'sqrt') { const x = strip(n.a); if (x.t !== 'num' || !x.int || SM.squareOut(x.v.n)[0] !== 1) ok = false; } }); return ok; }
  /* approximate decimal answers (rounded results) */
  function checkApprox(spec, input) {
    const s = clean(input).replace(/,(?=\d{3}(\D|$))/g, '').replace(/^[a-zA-Z]\s*=\s*/, '').replace(/°\s*$/, '').replace(/%\s*$/, '');
    let ast, f; try { ast = parse(s); f = evalF(ast, { __deg: !!spec.deg }); } catch (e) { return R(false, 'syntax', e.message); }
    if (!isFinite(f)) return R(false, 'syntax', 'That does not come out to a number.');
    const dp = spec.dp, want = roundDP(spec.v, dp), typed = decPlaces(ast), isLit = (() => { const a = strip(ast); return a.t === 'num' || (a.t === 'neg' && strip(a.a).t === 'num'); })();
    if (!isLit && (Math.abs(f - spec.v) <= 1e-9 * Math.max(1, Math.abs(spec.v)) || Math.abs(roundDP(f, dp) - want) < 1e-9)) return R(true, 'correct', '', { note: 'exact', fvalue: f });
    if (Math.abs(roundDP(f, dp) - want) < 1e-9 && typed >= dp) return R(true, 'correct', '', { fvalue: f });
    if (spec.tol && Math.abs(f - spec.v) <= spec.tol && typed >= dp) return R(true, 'correct', '', { fvalue: f });
    if (Math.abs(f - spec.v) <= 0.5 * Math.pow(10, -dp) + 1e-9 && typed >= dp) return R(true, 'correct', '', { fvalue: f });
    if (Math.abs(f - spec.v) <= 0.5 * Math.pow(10, -typed) + 1e-9 && typed < dp) return R(false, 'precision', 'Close. Round to ' + dp + ' decimal place' + (dp === 1 ? '' : 's') + '.', { fvalue: f });
    return R(false, 'wrong', '', { fvalue: f });
  }

  /* ---------- quantities with units and significant figures ---------- */
  function checkQty(spec, input) {
    let p; try { p = parseQty(clean(input)); } catch (e) { return R(false, e.code === 'unit' ? 'unit' : 'syntax', e.message); }
    const unitOf = SM.parseUnit(spec.unit || '');
    let si = p.value;
    if (!p.hasUnit) {
      const asDisplay = unitOf && unitOf.temp && unitOf.off ? (p.num + unitOf.off / unitOf.f) * unitOf.f : p.num * (unitOf ? unitOf.f : 1);
      if (!spec.opt && unitOf && !unitOf.none) {
        const okVal = within(p.num, spec.v / unitOf.f - (unitOf.temp && unitOf.off ? unitOf.off / unitOf.f : 0), spec.sf, p.sf) === 'ok';
        return R(false, 'need-unit', okVal ? 'Right number. Now add the unit.' : 'Add a unit to your answer, like ' + spec.unit + '.', { equal: okVal });
      }
      si = asDisplay;
    } else if (!dimEq(p.unit.d, spec.d)) {
      return R(false, 'wrong-dim', 'That unit measures ' + dimName(p.unit.d) + ', but the question asks for ' + dimName(spec.d) + '.', { dims: p.unit.d });
    }
    const toDisp = x => (unitOf && !unitOf.none ? x / unitOf.f - (unitOf.temp && unitOf.off ? unitOf.off / unitOf.f : 0) : x);
    const w = within(toDisp(si), toDisp(spec.v), spec.sf, p.sf);
    if (w === 'ok') {
      if (spec.sf && p.sf[0] > spec.sf + 2) return R(true, 'correct', '', { note: 'sf-many', si });
      return R(true, 'correct', '', { si });
    }
    if (w === 'sf-low') return R(false, 'sigfig', 'Right idea, but give ' + spec.sf + ' significant figures.', { equal: true, si });
    return R(false, 'wrong', '', { si });
  }
  /** Compare user SI value u with exact e, given expected sig figs and the user's typed sig figs. */
  function within(u, e, sf, usf) {
    if (!isFinite(u)) return 'no';
    if (e === 0) return Math.abs(u) < 1e-12 ? 'ok' : 'no';
    const mag = Math.floor(Math.log10(Math.abs(e)));
    const tolWant = sf ? Math.pow(10, mag - sf + 1) : Math.abs(e) * 1e-6;
    if (Math.abs(u - e) <= tolWant * 1.0001 && (!usf || usf[1] >= Math.max(1, (sf || 1) - 1))) return 'ok';
    if (usf && sf && usf[1] < sf - 1) { const tolUser = 0.5 * Math.pow(10, mag - usf[1] + 1) * 1.0001; if (Math.abs(u - e) <= tolUser) return 'sf-low'; }
    return 'no';
  }

  /* ---------- expressions ---------- */
  function terms(a, sign, out) { a = strip(a); out = out || []; sign = sign || 1;
    if (a.t === 'add') { terms(a.a, sign, out); terms(a.b, sign, out); } else if (a.t === 'sub') { terms(a.a, sign, out); terms(a.b, -sign, out); } else if (a.t === 'neg') terms(a.a, -sign, out); else out.push(a); return out; }
  function factorsOf(a, out) { a = strip(a); out = out || []; if (a.t === 'mul') { factorsOf(a.a, out); factorsOf(a.b, out); } else if (a.t === 'neg') { out.push({ t: 'num', v: new Q(-1), raw: '-1', int: true }); factorsOf(a.a, out); } else out.push(a); return out; }
  const isMonomial = a => { let ok = true; SM.walk(a, n => { if (['add', 'sub', 'grp', 'pm'].includes(n.t)) ok = false; if (n.t === 'pow' && strip(n.b).t !== 'num') ok = false; }); return ok; };
  function expandedForm(ast) { const ts = terms(ast); if (!ts.every(isMonomial)) return false; const keys = ts.map(t => { try { const p = evalPoly(t); return [...p.keys()][0] || ''; } catch (e) { return '?' + Math.random(); } }); return new Set(keys).size === keys.length; }
  function polyContent(p) { let g = 0, ints = true; p.forEach(v => { if (!v.isInt()) ints = false; else g = gcd(g, v.n); }); return ints ? g : 1; }
  function factoredForm(ast) {
    const fs = factorsOf(ast).map(f => (f.t === 'pow' && strip(f.b).t === 'num' ? strip(f.a) : f));
    let consts = 0, nonconst = 0;
    for (const f of fs) {
      let p; try { p = evalPoly(f); } catch (e) { return false; }
      if (Poly.isConst(p)) { consts++; continue; }
      nonconst++;
      if (polyContent(p) !== 1) return false;
      const vars = new Set(); p.forEach((_, k) => SM.parseKey && Object.keys(SM.parseKey(k)).forEach(v => vars.add(v)));
      const deg = Poly.degree(p);
      if (deg >= 2 && p.size > 1) { if (vars.size !== 1 || deg > 2) return false; const v = [...vars][0]; const A = p.get(v + '^2') || Q.ZERO, B = p.get(v) || Q.ZERO, C = p.get('') || Q.ZERO; if (!A.isInt() || !B.isInt() || !C.isInt()) return false; const disc = B.n * B.n - 4 * A.n * C.n; if (disc >= 0 && Number.isInteger(Math.sqrt(disc))) return false; }
    }
    return nonconst >= 1 && fs.length >= 2 && consts <= 1;
  }
  const SAMPLE = [0.37, 1.21, -0.83, 2.07, -1.46, 0.61, 1.73, -2.29];
  function numericSame(a, b, vars, allowConst) {
    let n = 0, diff = null;
    for (let i = 0; i < SAMPLE.length; i++) {
      const env = {}; vars.forEach((v, j) => { env[v] = SAMPLE[(i + j * 3) % SAMPLE.length] + j * 0.11; }); if (vars.includes('C')) env.C = 0;
      let x, y; try { x = evalF(a, env); y = evalF(b, env); } catch (e) { return false; }
      if (!isFinite(x) || !isFinite(y)) continue;
      const d = x - y; n++;
      if (allowConst) { if (diff === null) diff = d; else if (Math.abs(d - diff) > 1e-7 * Math.max(1, Math.abs(x))) return false; }
      else if (Math.abs(d) > 1e-7 * Math.max(1, Math.abs(x), Math.abs(y))) return false;
    }
    return n >= 4;
  }
  function checkExpr(spec, input) {
    let s = clean(input).replace(/^(y|f\s*\(\s*x\s*\)|[a-z]'\s*\(\s*x\s*\)|dy\/dx|f'\(x\))\s*=\s*/i, '');
    let ast; try { ast = parse(s); } catch (e) { return R(false, 'syntax', e.message); }
    const want = parse(spec.v), vars = [...new Set([...varsOf(want), ...varsOf(ast), ...(spec.vars || [])])].filter(v => v !== 'C');
    const stray = varsOf(ast).filter(v => v !== 'C' && !varsOf(want).includes(v) && !(spec.vars || []).includes(v));
    if (stray.length) return R(false, 'wrong', 'This answer should not contain ' + stray.join(', ') + '.', { stray });
    let same = false;
    if (!spec.c) { try { same = Poly.eq(evalPoly(ast), evalPoly(want)); } catch (e) { same = numericSame(ast, want, vars, false); } }
    else same = numericSame(ast, want, vars.concat(varsOf(ast).includes('C') ? ['C'] : []), true);
    if (!same) return R(false, 'wrong', '', { ast });
    if (spec.form === 'factored' && !factoredForm(ast)) return R(false, 'form', 'That is equal, but it is not fully factored yet.', { equal: true });
    if ((spec.form === 'expanded' || spec.form === 'simplified') && !expandedForm(ast)) return R(false, 'form', spec.form === 'expanded' ? 'That is equal. Now multiply it out and combine like terms.' : 'That is equal. Now combine the like terms.', { equal: true });
    if (spec.c && !varsOf(ast).includes('C')) return R(true, 'correct', '', { note: 'plusC' });
    return R(true, 'correct', '');
  }
  /* equations of lines / curves: any rearrangement is accepted */
  function checkEqn(spec, input) {
    let r, w; try { r = parseRel(clean(input)); w = parseRel(spec.v); } catch (e) { return R(false, 'syntax', e.message); }
    if (r.ops.length !== 1 || r.ops[0] !== '=') { const lone = r.ops.length === 0 ? r.parts[0] : null; if (lone && /^y=/.test(spec.v.replace(/\s/g, ''))) r = parseRel('y=' + clean(input)); else return R(false, 'form', 'Write it as an equation with one equals sign.'); }
    try {
      const P = Poly.add(evalPoly(r.parts[0]), evalPoly(r.parts[1]), true), W = Poly.add(evalPoly(w.parts[0]), evalPoly(w.parts[1]), true);
      if (P.size !== W.size || !P.size) return R(false, 'wrong', '');
      const k = [...W.keys()][0]; if (!P.has(k)) return R(false, 'wrong', ''); const ratio = P.get(k).div(W.get(k));
      for (const [key, v] of W) if (!P.has(key) || !P.get(key).eq(v.mul(ratio))) return R(false, 'wrong', '');
      if (spec.form === 'slope-intercept' && strip(r.parts[0]).t !== 'var') return R(false, 'form', 'That is the same line. Now write it as y = mx + b.', { equal: true });
      return R(true, 'correct', '');
    } catch (e) { return R(false, 'syntax', 'I could not read that as an equation.'); }
  }

  /* ---------- sets, pairs, inequalities, ratios, matrices, text, choice ---------- */
  function splitList(s) {
    s = clean(s).replace(/^\{|\}$/g, '').replace(/\b(or|and)\b/gi, ',').replace(/;/g, ',');
    return s.split(',').map(x => x.trim().replace(/^[a-zA-Z]\s*=\s*/, '')).filter(Boolean);
  }
  function expandPm(a) { // returns list of ASTs with ± resolved
    let out = [a];
    for (let guard = 0; guard < 4; guard++) {
      let found = false; const next = [];
      out.forEach(x => { const r = resolveOnePm(x); if (r) { found = true; next.push(...r); } else next.push(x); });
      out = next; if (!found) break;
    } return out;
  }
  function resolveOnePm(a) {
    if (!a || typeof a !== 'object') return null;
    if (a.t === 'pm') return [{ t: 'add', a: a.a, b: a.b }, { t: 'sub', a: a.a, b: a.b }];
    for (const k of ['a', 'b']) if (a[k]) { const r = resolveOnePm(a[k]); if (r) return r.map(x => Object.assign({}, a, { [k]: x })); }
    return null;
  }
  function checkSet(spec, input) {
    const items = splitList(input); if (!items.length) return R(false, 'syntax', 'Type the solutions separated by commas.');
    let vals = [];
    for (const it of items) { let ast; try { ast = parse(it); } catch (e) { return R(false, 'syntax', e.message); } for (const a of expandPm(ast)) { try { vals.push(spec.dp !== undefined ? evalF(a) : evalNum(a)); } catch (e) { try { vals.push(evalF(a)); } catch (e2) { return R(false, 'syntax', e2.message); } } } }
    const want = spec.v.map(v => (spec.dp !== undefined ? (typeof v === 'number' ? v : evalF(parse(String(v)))) : exact(v)));
    const same = (x, y) => (spec.dp !== undefined || typeof x === 'number' || typeof y === 'number'
      ? Math.abs((typeof x === 'number' ? x : x.toFloat()) - (typeof y === 'number' ? y : y.toFloat())) <= (spec.dp !== undefined ? 0.5 * Math.pow(10, -spec.dp) + 1e-9 : 1e-9) : x.eq(y));
    const uniq = []; vals.forEach(v => { if (!uniq.some(u => same(u, v))) uniq.push(v); });
    const wantU = []; want.forEach(v => { if (!wantU.some(u => same(u, v))) wantU.push(v); });
    const hit = wantU.filter(w => uniq.some(u => same(u, w))).length, extra = uniq.filter(u => !wantU.some(w => same(u, w))).length;
    if (hit === wantU.length && !extra) return R(true, 'correct', '');
    if (hit && hit < wantU.length && !extra) return R(false, 'partial', 'That is one of them. There ' + (wantU.length - hit === 1 ? 'is one more solution.' : 'are more solutions.'), { values: uniq });
    if (hit === wantU.length && extra) return R(false, 'extra', 'All the solutions are there, but so is something extra.', { values: uniq });
    return R(false, 'wrong', '', { values: uniq });
  }
  function checkPair(spec, input) {
    const names = spec.names || ['x', 'y']; let s = clean(input).replace(/^\s*(-?\d+)\s*(?:[rR]|rem|remainder)\s*(\d+)\s*$/, '$1, $2'), vals = null;
    const named = {}; let m; const re = /([a-zA-Z])\s*=\s*([^,;]+)/g;
    while ((m = re.exec(s))) named[m[1]] = m[2];
    try {
      if (names.every(n => named[n] !== undefined)) vals = names.map(n => evalNum(parse(named[n])));
      else { const items = splitList(s.trim().replace(/^[(\[]|[)\]]$/g, '')); vals = items.map(x => evalNum(parse(x))); }
    } catch (e) { return R(false, 'syntax', e.message || 'Write it like (2, -1).'); }
    if (!vals || vals.length !== spec.v.length) return R(false, 'syntax', 'Give ' + spec.v.length + ' values, like (2, -1).');
    const want = spec.v.map(exact), good = vals.map((v, i) => v.eq(want[i]));
    if (good.every(Boolean)) return R(true, 'correct', '');
    if (vals.length === 2 && vals[0].eq(want[1]) && vals[1].eq(want[0])) return R(false, 'swapped', 'Those are the right numbers in the wrong order. The ' + names[0] + '-value comes first.', { values: vals });
    return R(false, good.some(Boolean) ? 'partial' : 'wrong', good.some(Boolean) ? 'One of the two values is right.' : '', { values: vals, good });
  }
  const FLIP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
  function checkIneq(spec, input) {
    let r; try { r = parseRel(clean(input)); } catch (e) { return R(false, 'syntax', e.message); }
    if (r.ops.length !== 1 || !FLIP[r.ops[0]]) return R(false, 'form', 'Write an inequality like x > 3.');
    let [l, rr] = r.parts, op = r.ops[0];
    if (strip(l).t !== 'var') { if (strip(rr).t !== 'var') return R(false, 'form', 'Get ' + spec.var + ' on its own on one side.'); const t = l; l = rr; rr = t; op = FLIP[op]; }
    if (strip(l).n !== spec.var) return R(false, 'wrong', 'The variable here is ' + spec.var + '.');
    let v; try { v = evalNum(rr); } catch (e) { return R(false, 'syntax', e.message); }
    const want = exact(spec.v);
    if (v.eq(want) && op === spec.op) return R(true, 'correct', '');
    if (v.eq(want) && op === FLIP[spec.op]) return R(false, 'flipped', '', { value: v, op });
    if (v.eq(want)) return R(false, 'boundary', 'The boundary number is right. Check whether it is included.', { value: v, op });
    return R(false, 'wrong', '', { value: v, op });
  }
  function checkRatio(spec, input) {
    const s = clean(input).replace(/\s*to\s*/i, ':');
    const parts = s.split(':').map(x => x.trim());
    if (parts.length !== spec.v.length) { const n = tryNum(s); if (n && spec.v.length === 2 && n.eq(new Q(spec.v[0], spec.v[1]))) return R(false, 'form', 'Right value. Write it as a ratio with a colon, like ' + spec.v.join(':') + '.', { equal: true }); return R(false, 'syntax', 'Write a ratio like ' + spec.v.map(() => 'a').join(':').replace(/a/g, (m, i) => 'abc'[i / 2]) + '.'); }
    const nn = parts.map(tryNum); if (nn.some(x => !x || !x.isRational())) return R(false, 'syntax', 'Use numbers in the ratio.'); const nums = nn.map(x => x.c);
    const want = spec.v.map(x => new Q(x));
    const k = nums[0].div(want[0] || Q.ONE); const prop = nums.every((x, i) => x.eq(want[i].mul(k)));
    if (prop && nums.every((x, i) => x.eq(want[i]))) return R(true, 'correct', '');
    if (prop) return R(false, 'not-simplest', 'That ratio is equivalent. Can you simplify it further?', { equal: true });
    return R(false, 'wrong', '');
  }
  function parseMatrix(s) {
    s = clean(s).replace(/^\[\s*\[/, '[[').trim();
    let rows;
    if (s.startsWith('[[')) rows = s.slice(2, -2).split(/\]\s*,?\s*\[/).map(r => r.split(','));
    else if (s.includes(';')) rows = s.replace(/^\[|\]$/g, '').split(';').map(r => r.trim().split(/\s*,\s*|\s+/));
    else rows = [s.replace(/^[\[(<⟨]|[\])>⟩]$/g, '').split(/\s*,\s*|\s+/)];
    return rows.map(r => r.filter(x => x.trim() !== '').map(x => evalNum(parse(x))));
  }
  function checkMatrix(spec, input) {
    let m; try { m = parseMatrix(input); } catch (e) { return R(false, 'syntax', 'Write rows separated by semicolons, like 1 2; 3 4.'); }
    const want = spec.v.map(r => r.map(exact));
    if (m.length !== want.length || m.some((r, i) => r.length !== want[i].length)) return R(false, 'shape', 'The answer should be ' + (want.length === 1 ? 'a list of ' + want[0].length + ' numbers' : want.length + ' rows of ' + want[0].length) + '.');
    const bad = []; m.forEach((r, i) => r.forEach((x, j) => { if (!x.eq(want[i][j])) bad.push([i, j]); }));
    if (!bad.length) return R(true, 'correct', '');
    const T = want.length === m[0].length && m.every((r, i) => r.every((x, j) => want[j] && want[j][i] && x.eq(want[j][i])));
    if (T && want.length > 1) return R(false, 'transposed', 'Those are the right entries, but rows and columns are swapped.');
    return R(false, bad.length < m.length * m[0].length ? 'partial' : 'wrong', bad.length + ' entr' + (bad.length === 1 ? 'y is' : 'ies are') + ' not right yet.', { bad });
  }
  function normText(s, how) {
    s = clean(s).replace(/[\s_]/g, '');
    if (how === 'bin') s = s.replace(/^0b/i, '').replace(/₂$/, '');
    if (how === 'hex') s = s.replace(/^0x/i, '').replace(/₁₆$/, '').toUpperCase();
    if (how === 'lower') s = s.toLowerCase();
    if ((how === 'bin' || how === 'hex')) s = s.replace(/^0+(?=.)/, '');
    return s;
  }
  function checkText(spec, input) {
    const raw = clean(input).replace(/[\s_]/g, '');
    if (spec.width && spec.norm === 'bin') { const t = raw.replace(/^0b/i, ''); if (!/^[01]+$/.test(t)) return R(false, 'syntax', 'Use only 0 and 1.'); if (t.length !== spec.width) return R(false, 'form', 'Write all ' + spec.width + ' bits.'); return t === spec.v[0] ? R(true, 'correct', '') : R(false, 'wrong', ''); }
    const got = normText(input, spec.norm);
    if (spec.norm === 'bin' && !/^[01]+$/.test(got)) return R(false, 'syntax', 'Use only the digits 0 and 1.');
    if (spec.norm === 'hex' && !/^[0-9A-F]+$/.test(got)) return R(false, 'syntax', 'Use the digits 0 to 9 and the letters A to F.');
    return spec.v.some(v => normText(v, spec.norm) === got) ? R(true, 'correct', '') : R(false, 'wrong', '', { text: got });
  }
  function checkChoice(spec, input) {
    const s = clean(input); const idx = /^\d+$/.test(s) ? +s : spec.options.findIndex(o => clean(o).toLowerCase() === s.toLowerCase());
    if (idx < 0 || idx >= spec.options.length) return R(false, 'syntax', 'Pick one of the choices.');
    return idx === spec.v ? R(true, 'correct', '') : R(false, 'wrong', '', { picked: idx });
  }

  const KINDS = { num: checkNum, approx: checkApprox, qty: checkQty, expr: checkExpr, eqn: checkEqn, set: checkSet, pair: checkPair, ineq: checkIneq, ratio: checkRatio, matrix: checkMatrix, text: checkText, choice: checkChoice };
  function check(spec, input) {
    if (clean(input) === '') return R(false, 'empty', 'Type an answer first.');
    const fn = KINDS[spec.k]; if (!fn) return R(false, 'syntax', 'Unknown answer type.');
    try { return fn(spec, input); } catch (e) { return R(false, 'syntax', e && e.message ? e.message : 'I could not read that.'); }
  }

  /** The canonical typed answer for a spec (what "show answer" displays and what self-tests type). */
  function answerText(spec) {
    switch (spec.k) {
      case 'num': return spec.text || (spec.dec ? exact(spec.v).c.toDecimal() : null) || (spec.pct ? exact(spec.v).toString() + '%' : exact(spec.v).toString());
      case 'approx': return spec.text || roundDP(spec.v, spec.dp).toFixed(spec.dp);
      case 'qty': { if (spec.text) return spec.text; const u = SM.parseUnit(spec.unit) || { f: 1 }; return SM.fmtSFPlain(spec.v / u.f - (u.temp && u.off ? u.off / u.f : 0), spec.sf || 3) + ' ' + spec.unit; }
      case 'expr': return spec.text || spec.v;
      case 'eqn': return spec.v;
      case 'set': return spec.v.map(v => (spec.dp !== undefined ? roundDP(typeof v === 'number' ? v : evalF(parse(String(v))), spec.dp).toFixed(spec.dp) : String(v))).join(', ');
      case 'pair': return '(' + spec.v.join(', ') + ')';
      case 'ineq': return spec.var + ' ' + spec.op + ' ' + spec.v;
      case 'ratio': return spec.v.join(':');
      case 'matrix': return spec.v.map(r => r.join(' ')).join('; ');
      case 'text': return spec.v[0];
      case 'choice': return spec.options[spec.v];
    }
    return '';
  }

  /* ---------- diagnosis ---------- */
  /** Match a wrong answer against the skill's known mistakes, then generic patterns. Returns {id, msg} or null. */
  function diagnose(problem, input, res) { try { return diagnose0(problem, input, res); } catch (e) { return null; } }
  function diagnose0(problem, input, res) {
    const spec = problem.ans;
    for (const m of problem.mistakes || []) {
      const mspec = Object.assign({}, spec, m.spec || { v: m.v }); ['lowest', 'frac', 'dec', 'form', 'sci', 'surd', 'improper', 'text'].forEach(k => delete mspec[k]);
      if (m.op) mspec.op = m.op;
      let r; try { r = KINDS[mspec.k](mspec, input); } catch (e) { r = null; }
      if (r && r.ok) return { id: m.id, msg: m.msg };
    }
    if (res && res.verdict === 'flipped') return { id: 'ineq-flip', msg: 'The number is right, but the inequality sign points the wrong way. When you multiply or divide both sides by a negative number, the sign flips.' };
    if (res && res.verdict === 'wrong-dim') return { id: 'units', msg: res.msg };
    if (spec.k === 'num' && res && res.value instanceof Num) {
      const want = exact(spec.v), got = res.value;
      if (!want.c.isZero() && got.eq(want.neg())) return { id: 'sign', msg: 'You have the right size of answer but the wrong sign. Check each step where a negative appears.' };
      if (want.isRational() && got.isRational() && !want.c.isZero() && !got.c.isZero() && got.c.eq(want.c.inv()) && !want.c.abs().eq(1)) return { id: 'reciprocal', msg: 'Your answer is upside down: it is the reciprocal of the answer. Check which number goes on top.' };
      if (want.isRational() && got.isRational() && !want.c.isZero()) { const r = got.c.div(want.c); for (const k of [10, 100, 1000]) if (r.eq(k) || r.eq(new Q(1, k))) return { id: 'place', msg: 'The digits are right but the place value is off by a factor of ' + k + '. Check where the decimal point goes.' }; }
    }
    if (spec.k === 'qty' && res && res.si !== undefined && spec.v) {
      const r = res.si / spec.v;
      for (const k of [1e3, 1e6, 1e-3, 1e-6, 100, 0.01, 60, 1 / 60, 3600, 1 / 3600, 3.6, 1 / 3.6]) if (Math.abs(r / k - 1) < 0.02) return { id: 'unit-scale', msg: 'Your answer is off by a factor of ' + SM.fmtNum(k >= 1 ? k : 1 / k, 4) + ', which usually means a unit conversion was missed (for example km to m, g to kg, minutes to seconds).' };
      if (Math.abs(r + 1) < 0.02) return { id: 'sign', msg: 'The size is right but the sign is wrong. Check the direction you chose as positive.' };
    }
    return null;
  }

  Object.assign(SM, { check, answerText, diagnose, lowestForm, factoredForm, expandedForm, parseMatrix, within, splitList });
})();
