/* Stark Math. Step-by-step algebra checker: the learner writes their working one line at a time and every line is
   checked against the line above with exact arithmetic. Equations (linear and quadratic) must keep the same solutions;
   expressions must stay equal. The first line that goes wrong is pointed out with a likely reason (a term moved without
   changing sign, an operation done to one side only, a sign slip), and Madeline suggests a next step. Pure (no DOM). */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;
  const { Q, Poly } = SM;
  const TOL = 1e-9;

  const tidy = s => String(s || '').replace(/[−–]/g, '-').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/\s+/g, ' ').trim();
  const varsIn = P => { const vs = new Set(); P.forEach((_, k) => Object.keys(SM.parseKey(k)).forEach(v => vs.add(v))); return [...vs]; };
  const coef = (P, key) => P.get(key) || Q.ZERO;
  /** A is a non-zero rational multiple of B. */
  function prop(A, B) {
    if (!A.size || !B.size) return A.size === B.size;
    const key = B.keys().next().value; if (!A.has(key)) return false;
    const k = A.get(key).div(B.get(key)); return !k.isZero() && Poly.eq(A, Poly.scale(B, k));
  }
  /** Solutions of D(v) = 0 for degree <= 2: { all } | { none } | { roots: [{ f, q }] } (q is exact text when rational). */
  function solve(D, v) {
    const deg = Poly.degree(D, v);
    if (deg === 0) return D.size ? { none: true, roots: [] } : { all: true, roots: [] };
    if (deg === 1) { const r = coef(D, '').neg().div(coef(D, v)); return { roots: [{ f: r.toFloat(), q: r.toString() }] }; }
    if (deg === 2) {
      const a = coef(D, v + '^2'), b = coef(D, v), c = coef(D, ''), disc = b.mul(b).sub(a.mul(c).mul(4));
      if (disc.sign() < 0) return { roots: [] };
      const sq = n => { const r = Math.round(Math.sqrt(n)); return r * r === n ? r : -1; };
      const sn = sq(disc.n), sd = sq(disc.d);
      if (sn >= 0 && sd > 0) { const s = new Q(sn, sd), r1 = b.neg().add(s).div(a.mul(2)), r2 = b.neg().sub(s).div(a.mul(2)); const rs = r1.eq(r2) ? [r1] : [r1, r2]; return { roots: rs.map(r => ({ f: r.toFloat(), q: r.toString() })).sort((x, y) => x.f - y.f) }; }
      const f = disc.toFloat(), af = a.toFloat(), bf = b.toFloat();
      return { roots: [(-bf - Math.sqrt(f)) / (2 * af), (-bf + Math.sqrt(f)) / (2 * af)].sort((x, y) => x - y).map(x => ({ f: x, q: '' })) };
    }
    return null;
  }
  const sameSet = (A, B) => {
    if (A.all || B.all) return !!A.all === !!B.all;
    const a = A.roots.map(r => r.f).sort((x, y) => x - y), b = B.roots.map(r => r.f).sort((x, y) => x - y);
    return a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= TOL * Math.max(1, Math.abs(x)));
  };
  const setText = (S, v) => (S.all ? 'every value of ' + v : !S.roots.length ? 'no solution' : S.roots.map(r => v + ' = ' + (r.q || (+r.f.toFixed(4)).toString())).join(' or '));

  /** Parse one line: an equation, a list of solutions ("x = 3 or x = -2", "x = ±3") or an expression. */
  function parseLine(raw, v) {
    const s = tidy(raw);
    if (!s) return { error: 'This line is empty.' };
    const many = s.match(new RegExp('^' + v + '\\s*=\\s*±\\s*(.+)$'));
    if (many) { try { const x = SM.evalF(SM.parse(many[1]), {}); const q = (() => { try { return SM.evalNum(SM.parse(many[1])).c.toString(); } catch (e) { return ''; } })(); return { kind: 'sol', set: { roots: [{ f: -x, q: q ? Q.of(q).neg().toString() : '' }, { f: x, q }].sort((a, b) => a.f - b.f) } }; } catch (e) { return { error: 'I could not read the value after ±.' }; } }
    const parts = s.split(/\s+or\s+|\s*[,;]\s*(?=[a-z]\s*=)|\s+and\s+(?=[a-z]\s*=)/i);
    if (parts.length > 1) {
      const roots = [];
      for (const p of parts) { const m = p.match(/^([a-z])\s*=\s*(.+)$/i); if (!m || m[1] !== v) return { error: 'Write each solution as ' + v + ' = a number.' }; try { const ast = SM.parse(m[2]); let q = ''; try { q = SM.evalNum(ast).c.toString(); } catch (e) { /* irrational */ } roots.push({ f: SM.evalF(ast, {}), q }); } catch (e) { return { error: 'I could not read "' + m[2] + '".' }; } }
      return { kind: 'sol', set: { roots: roots.sort((a, b) => a.f - b.f) } };
    }
    let rel; try { rel = SM.parseRel(s); } catch (e) { return { error: e.message || 'I could not read this line.' }; }
    if (rel.ops.length > 1 || (rel.ops.length === 1 && rel.ops[0] !== '=')) return { error: 'Use one equals sign per line (inequalities are not checked here).' };
    try {
      if (!rel.ops.length) { const P = SM.evalPoly(rel.parts[0]); return { kind: 'expr', P, text: s }; }
      const L = SM.evalPoly(rel.parts[0]), R = SM.evalPoly(rel.parts[1]), D = Poly.add(L, R, true);
      return { kind: 'eq', L, R, D, text: s };
    } catch (e) { return { error: 'This checker handles polynomial equations and expressions (no letters in a denominator, no roots of letters).' }; }
  }
  /** The variable to solve for: the single letter used in the first line. */
  function pickVar(lines) {
    const m = tidy(lines[0] || '').replace(/sqrt|pi/g, '').match(/[a-z]/gi);
    const vs = [...new Set(m || [])]; return vs.length === 1 ? vs[0] : vs.includes('x') ? 'x' : vs[0] || 'x';
  }

  /** Why line `n` is not equivalent to line `p` (both equations). */
  function diagnose(p, n, v) {
    const a = solve(p.D, v), b = solve(n.D, v);
    const flipped = a && b && a.roots.length === 1 && b.roots.length === 1 && Math.abs(a.roots[0].f + b.roots[0].f) <= TOL * Math.max(1, Math.abs(a.roots[0].f)) && Math.abs(a.roots[0].f) > TOL;
    if (flipped && isSolvedLine(n, v)) return { id: 'sign', msg: 'This line gives the right size of answer with the wrong sign. Check the step where a negative number was moved, multiplied or divided.' };
    const constDiff = (A1, A0, B1, B0) => Poly.eq(B1, B0) && !Poly.eq(A1, A0) && Poly.isConst(Poly.add(A1, A0, true));
    if (/\(/.test(p.text || '') && !/\(/.test(n.text || '') && (constDiff(n.L, p.L, n.R, p.R) || constDiff(n.R, p.R, n.L, p.L))) return { id: 'distribute', msg: 'When you expand a bracket, multiply every term inside it by the number outside, including the last one.' };
    const termsOf = P => [...P.entries()].map(([k, c]) => new Map([[k, c]]));
    for (const t of termsOf(p.L).concat(termsOf(p.R))) {
      if (prop(n.D, Poly.add(p.D, Poly.scale(t, 2), true)) || prop(n.D, Poly.add(p.D, Poly.scale(t, 2)))) return { id: 'moved-sign', msg: 'It looks like a term crossed the equals sign without changing its sign. When you move a term to the other side, + becomes − and − becomes +.' };
    }
    const oneSide = (A1, A0, B1, B0) => Poly.eq(B1, B0) && !Poly.eq(A1, A0) && (prop(A1, A0) || Poly.isConst(Poly.add(A1, A0, true)) || varsIn(Poly.add(A1, A0, true)).length === 1 && Poly.add(A1, A0, true).size === 1);
    if (oneSide(n.L, p.L, n.R, p.R) || oneSide(n.R, p.R, n.L, p.L)) return { id: 'one-side', msg: 'Only one side changed. Whatever you do to one side of an equation (add, subtract, multiply or divide), do exactly the same to the other side.' };
    if (flipped) return { id: 'sign', msg: 'This line gives the right size of answer with the wrong sign. Check the step where a negative number was moved, multiplied or divided.' };
    if (a && b && !a.all && !b.all) return { id: 'arith', msg: 'This line is not equivalent to the one above: the line above gives ' + setText(a, v) + ', but this one gives ' + setText(b, v) + '. Check the arithmetic in this step.' };
    return { id: 'other', msg: 'This line is not equivalent to the one above. Check this step.' };
  }
  /** Madeline's next-step suggestion for an equation line. */
  function nextStep(e, v) {
    const deg = Poly.degree(e.D, v);
    if (deg === 2) return 'Get everything on one side so it equals 0, then factor or use the quadratic formula.';
    if (deg !== 1) return '';
    const fr = [...e.L.values(), ...e.R.values()].filter(c => !c.isInt()), lc = fr.reduce((m, c) => SM.lcm(m, c.d), 1);
    if (lc > 1) return 'Clear the fractions: multiply both sides by ' + lc + '.';
    const lx = coef(e.L, v), rx = coef(e.R, v);
    if (!lx.isZero() && !rx.isZero()) { const keep = lx.abs().cmp(rx.abs()) >= 0 ? 'R' : 'L', c = keep === 'R' ? rx : lx; return 'Collect the ' + v + ' terms on one side: ' + (c.sign() > 0 ? 'subtract ' + c.abs().toString() + v + ' from' : 'add ' + c.abs().toString() + v + ' to') + ' both sides.'; }
    const side = lx.isZero() ? e.R : e.L, other = lx.isZero() ? e.L : e.R, k = coef(side, v), c = coef(side, '');
    if (!c.isZero()) return (c.sign() > 0 ? 'Subtract ' + c.toString() : 'Add ' + c.abs().toString()) + ' on both sides to leave the ' + v + ' term on its own.';
    if (!k.eq(1)) return 'Divide both sides by ' + k.toString() + '.';
    if (other.size > 1) return 'Tidy the other side: collect the numbers.';
    return '';
  }
  const isSolvedLine = (e, v) => (e.L.size === 1 && e.L.has(v) && coef(e.L, v).eq(1) && Poly.isConst(e.R)) || (e.R.size === 1 && e.R.has(v) && coef(e.R, v).eq(1) && Poly.isConst(e.L));
  /** Expression is fully simplified: no brackets left and one written term per monomial. */
  function simplified(text, P) { if (/\(/.test(text)) return false; const terms = tidy(text).replace(/^-/, '').split(/\s*[+-]\s*/).filter(Boolean).length; return terms === Math.max(1, P.size); }

  /**
   * Check a list of lines. Returns { mode, v, rows: [{ text, ok, status, msg }], firstError, solved, hint, answer }.
   * status: 'start' | 'ok' | 'wrong' | 'unreadable'.
   */
  function check(lines) {
    lines = (lines || []).map(tidy).filter(Boolean);
    const out = { mode: '', v: 'x', rows: [], firstError: -1, solved: false, hint: '', answer: '' };
    if (!lines.length) { out.hint = 'Type an equation or expression on the first line.'; return out; }
    const v = out.v = pickVar(lines);
    const first = parseLine(lines[0], v);
    if (first.error) { out.rows.push({ text: lines[0], ok: false, status: 'unreadable', msg: first.error }); out.firstError = 0; out.hint = first.error; return out; }
    out.mode = first.kind === 'expr' ? 'expression' : 'equation';
    if (first.kind === 'sol') { out.rows.push({ text: lines[0], ok: false, status: 'unreadable', msg: 'Start with the equation itself.' }); out.firstError = 0; out.hint = out.rows[0].msg; return out; }
    if (first.kind === 'eq' && (varsIn(first.D).some(x => x !== v) || !solve(first.D, v))) { out.rows.push({ text: lines[0], ok: false, status: 'unreadable', msg: varsIn(first.D).some(x => x !== v) ? 'Use a single letter for the unknown.' : 'This checker handles linear and quadratic equations.' }); out.firstError = 0; out.hint = out.rows[0].msg; return out; }
    const target = first.kind === 'eq' ? solve(first.D, v) : null;
    out.rows.push({ text: lines[0], ok: true, status: 'start', msg: first.kind === 'eq' ? 'Starting equation.' : 'Starting expression.' });
    let prev = first, lastEq = first;
    for (let i = 1; i < lines.length; i++) {
      const cur = parseLine(lines[i], v), row = { text: lines[i], ok: false, status: 'wrong', msg: '' };
      if (cur.error) { row.status = 'unreadable'; row.msg = cur.error; }
      else if (out.mode === 'expression') {
        if (cur.kind !== 'expr') { row.status = 'unreadable'; row.msg = 'Keep writing expressions (no equals sign) when simplifying.'; }
        else if (Poly.eq(cur.P, prev.P)) { row.ok = true; row.status = 'ok'; row.msg = simplified(cur.text, cur.P) ? 'Equal to the line above, and fully simplified.' : 'Equal to the line above.'; }
        else { const vs = varsIn(prev.P).concat(varsIn(cur.P)), env = {}; vs.forEach(x => { env[x] = 2; }); const fv = P => { let s = 0; P.forEach((c, k) => { const m = SM.parseKey(k); let t = c.toFloat(); for (const x in m) t *= Math.pow(env[x], m[x]); s += t; }); return +s.toFixed(6); };
          row.msg = 'Not equal to the line above. Test it: with ' + (vs.length ? [...new Set(vs)].map(x => x + ' = 2').join(', ') : 'these numbers') + ', the line above is ' + fv(prev.P) + ' but this line is ' + fv(cur.P) + '.'; }
      } else if (cur.kind === 'expr') { row.status = 'unreadable'; row.msg = 'Keep the equals sign on every line of an equation.'; }
      else {
        const S = cur.kind === 'sol' ? cur.set : solve(cur.D, v);
        if (!S) { row.status = 'unreadable'; row.msg = 'This checker handles linear and quadratic equations.'; }
        else if (sameSet(S, target)) { row.ok = true; row.status = 'ok'; row.msg = 'Equivalent to the line above.'; }
        else if (S.roots.length && S.roots.length < target.roots.length && S.roots.every(x => target.roots.some(y => Math.abs(x.f - y.f) <= TOL * Math.max(1, Math.abs(y.f))))) { row.why = 'missing-root'; row.msg = 'That is only part of the answer: this equation has ' + target.roots.length + ' solutions and you have found ' + S.roots.length + '. (A square root can be positive or negative.)'; }
        else if (cur.kind === 'eq' && prev.kind === 'eq') { const d = diagnose(prev, cur, v); row.msg = d.msg; row.why = d.id; }
        else row.msg = 'These solutions do not match the equation above (it gives ' + setText(target, v) + ').';
      }
      if (!row.ok && out.firstError < 0) out.firstError = i;
      out.rows.push(row);
      if (row.ok) { prev = cur; if (cur.kind === 'eq') lastEq = cur; }
      else break; // later lines build on a wrong line, so stop checking here
    }
    const last = out.rows[out.rows.length - 1];
    if (out.firstError < 0) {
      if (out.mode === 'equation') {
        const lp = parseLine(lines[lines.length - 1], v);
        out.solved = lp.kind === 'sol' || (lp.kind === 'eq' && isSolvedLine(lp, v));
        out.answer = setText(target, v);
        out.hint = out.solved ? 'Solved: ' + out.answer + '. Check it by putting it back into the first line.' : target.all ? 'Every value works: both sides are always equal.' : target.none ? 'No value works: the two sides can never be equal.' : nextStep(lastEq, v) || 'Keep going until you reach ' + v + ' = a number.';
      } else {
        out.solved = simplified(last.text, prev.P);
        out.hint = out.solved ? 'Fully simplified.' : /\(/.test(last.text) ? 'Expand the brackets: multiply each term inside by the term outside.' : 'Collect like terms: add the terms with the same letter and power.';
      }
    } else out.hint = out.rows[out.firstError].msg;
    return out;
  }

  /** A practice equation with a whole-number answer. kind: 0 ax+b=c, 1 a(x+b)=c, 2 ax+b=cx+d, 3 x/a+b=c. */
  function practiceEquation(seed, level) {
    const r = SM.rng('alg|' + seed), hi = [5, 9, 15][Math.max(0, Math.min(2, level || 0))], kind = r.int(0, 3), x = r.nz(-hi, hi), H = SM.H;
    if (kind === 0) { const a = r.int(2, hi), b = r.nz(-hi * 2, hi * 2); return { text: H.lin(a, b) + ' = ' + (a * x + b), x }; }
    if (kind === 1) { const a = r.int(2, 6), b = r.nz(-hi, hi); return { text: a + '(' + H.lin(1, b) + ') = ' + a * (x + b), x }; }
    if (kind === 2) { const a = r.int(2, hi + 2); let c; do { c = r.nz(-hi, hi); } while (c === a); const b = r.nz(-hi * 2, hi * 2); return { text: H.lin(a, b) + ' = ' + H.lin(c, a * x + b - c * x), x }; }
    const a = r.int(2, 6), b = r.nz(-hi, hi), xm = x * a; return { text: 'x/' + a + ' ' + (b < 0 ? '- ' + -b : '+ ' + b) + ' = ' + (xm / a + b), x: xm };
  }
  SM.algebra = { tidy, parseLine, solve, check, diagnose, nextStep, practiceEquation, prop };
})();
