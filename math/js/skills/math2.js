/* Stark Math. Mathematics generators, part 2: exponents and roots, polynomials and factoring,
   quadratics, functions and graphing, geometry, statistics and probability, and introductory trigonometry. */
(function () {
  'use strict';
  const SM = (typeof window !== 'undefined' ? window : globalThis).SM;
  const { Q, Num, H, A, mk, gcd } = SM;
  const { m, pn, qs, poly } = H;
  const sq = n => new Num(1, n).toString();
  const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]];
  // exact trig values at reference angles
  const SIN = { 0: '0', 30: '1/2', 45: 'sqrt(2)/2', 60: 'sqrt(3)/2', 90: '1' }, COS = { 0: '1', 30: 'sqrt(3)/2', 45: 'sqrt(2)/2', 60: '1/2', 90: '0' }, TAN = { 0: '0', 30: 'sqrt(3)/3', 45: '1', 60: 'sqrt(3)' };
  function trigExact(fn, deg) {
    const a = ((deg % 360) + 360) % 360, ref = a <= 90 ? a : a <= 180 ? 180 - a : a <= 270 ? a - 180 : 360 - a, quad = a <= 90 ? 1 : a <= 180 ? 2 : a <= 270 ? 3 : 4;
    const sgn = fn === 'sin' ? (quad <= 2 ? 1 : -1) : fn === 'cos' ? (quad === 1 || quad === 4 ? 1 : -1) : (quad === 1 || quad === 3 ? 1 : -1);
    const base = { sin: SIN, cos: COS, tan: TAN }[fn][ref]; if (base === undefined) return null;
    return base === '0' ? '0' : (sgn < 0 ? '-' : '') + (base.includes('/') && sgn < 0 ? '(' + base + ')' : base);
  }
  SM.trigExact = trigExact;

  SM.addSkills('math', [
    /* ---------------- exponents and roots ---------------- */
    { id: 'exp-eval', strand: 'Exponents & roots', title: 'Evaluate powers', lv: [0, 3], grade: '5-9', focus: 'repeated multiplication, including zero and negative powers',
      gen(r, L) { const b = r.int(2, L.span(5, 12)) * (L.t > 0.5 && r.chance(0.3) ? -1 : 1); const n = L.t < 0.35 ? r.int(2, 4) : r.int(L.t > 0.5 ? -3 : 0, 4); return { b, n: Math.abs(b) > 6 && n > 3 ? 2 : n }; },
      make({ b, n }, L) {
        const v = new Q(b).pow(n);
        return { q: 'Work out ' + m(pn(b) + '^' + pn(n)), ans: A.num(v.toString()),
          steps: n > 0 ? [{ t: 'Multiply ' + b + ' by itself ' + n + ' times.', m: Array(n).fill(pn(b)).join(' × ') + ' = ' + v }] : n === 0 ? [{ t: 'Any non-zero number to the power 0 is 1.' }] : [{ t: 'A negative power means one over the positive power.', m: pn(b) + '^' + n + ' = 1/' + pn(b) + '^' + -n + ' = ' + v }],
          hints: ['What does the little number tell you to do?', n < 0 ? 'Negative power: take the reciprocal.' : n === 0 ? 'Think of the pattern 2³ = 8, 2² = 4, 2¹ = 2, 2⁰ = ?' : 'Multiply ' + n + ' copies of ' + b + '.', n < 0 ? 'Work out ' + pn(b) + '^' + -n + ' first.' : 'Start: ' + b + ' × ' + b + ' = ' + b * b + '.'],
          mistakes: [n > 1 ? mk(b * n, 'times-n', 'That multiplies ' + b + ' by ' + n + '. A power means multiplying ' + b + ' by itself ' + n + ' times.') : null, n < 0 ? mk(new Q(b).pow(-n).neg().toString(), 'neg-power', 'A negative power does not make the answer negative. It means one over: 1/' + pn(b) + '^' + -n + '.') : null, n === 0 ? mk(0, 'zero', 'Any non-zero number to the power 0 is 1, not 0.') : null].filter(z => z && !Q.of(z.v).eq(v)) };
      } },
    { id: 'exp-rules', strand: 'Exponents & roots', title: 'Laws of exponents', lv: [1, 3], grade: '8-9', focus: 'adding, subtracting and multiplying the powers',
      gen(r, L) { return { rule: r.int(0, 2), a: r.int(2, L.span(5, 12)), b: r.int(2, L.span(4, 9)) }; },
      make({ rule, a, b }, L) {
        const txt = ['x^' + a + ' · x^' + b, '(x^' + a + ')^' + b, 'x^' + (a + b) + '/x^' + b][rule], k = [a + b, a * b, a][rule];
        const law = ['Multiplying powers of the same base: add the exponents.', 'A power of a power: multiply the exponents.', 'Dividing powers of the same base: subtract the exponents.'][rule];
        return { q: 'Simplify ' + m(txt) + ' to a single power of x.', ans: A.expr('x^' + k, { form: 'simplified' }),
          steps: [{ t: law, m: txt + ' = x^' + k }],
          hints: ['Write out what the powers mean if it helps.', law, 'The new exponent is ' + ['a + b', 'a × b', 'a - b'][rule].replace('a', [a, a, a + b][rule]).replace('b', b) + '.'],
          mistakes: [{ spec: A.expr('x^' + [a * b, a + b, (a + b) * b][rule]), id: 'wrong-law', msg: ['When you multiply powers, add the exponents (do not multiply them).', 'For a power of a power, multiply the exponents (do not add them).', 'When you divide powers, subtract the exponents.'][rule] }].filter(z => z.spec.v !== 'x^' + k) };
      } },
    { id: 'sci-notation', strand: 'Exponents & roots', title: 'Scientific notation', lv: [1, 3], grade: '8', focus: 'one digit before the decimal point',
      gen(r, L) { const sf = r.int(2, 3), mant = r.int(Math.pow(10, sf - 1) + 1, Math.pow(10, sf) - 1); let e = r.int(L.t > 0.4 ? -6 : 3, 8); if (e === 0) e = 4; return { mant, sf, e }; },
      make({ mant, sf, e }, L) {
        const mStr = Q.of(mant).div(Math.pow(10, sf - 1)).toDecimal(), val = Q.of(mant).mul(new Q(10).pow(e - sf + 1)), plain = val.toDecimal();
        return { q: 'Write ' + H.num(+plain).replace(/,/g, ',') + ' in scientific notation.', ans: A.num(val.toString(), { sci: true, text: mStr + ' × 10^' + e }),
          steps: [{ t: 'Move the decimal point so one non-zero digit is in front of it: ' + mStr + '.' }, { t: 'Count how many places it moved: ' + Math.abs(e) + (e < 0 ? ' to the right, so the power is negative.' : ' to the left.'), m: mStr + ' × 10^' + e }],
          hints: ['The first part must be at least 1 and less than 10.', 'Start with ' + mStr + '.', 'How many places did the point move?'],
          mistakes: [{ spec: A.num(Q.of(mStr).mul(new Q(10).pow(-e)).toString()), id: 'sign-e', msg: 'The power has the wrong sign. Big numbers have positive powers of 10; small numbers have negative ones.' }] };
      } },
    { id: 'roots', strand: 'Exponents & roots', title: 'Simplify square roots', lv: [1, 3], grade: '8-10', focus: 'taking out the largest square factor',
      gen(r, L) { const s = r.pick([2, 3, 5, 6, 7, 10, 11]), k = r.int(2, L.span(4, 12)); return { k, s }; },
      make({ k, s }, L) {
        const n = k * k * s, ans = k + 'sqrt(' + s + ')';
        return { q: 'Simplify ' + m('sqrt(' + n + ')') + '.', ans: A.num(ans, { surd: true, text: k + '√' + s }),
          steps: [{ t: 'Find the largest square factor of ' + n + ': ' + k * k + '.', m: 'sqrt(' + n + ') = sqrt(' + k * k + ' × ' + s + ')' }, { m: '= sqrt(' + k * k + ') × sqrt(' + s + ') = ' + k + 'sqrt(' + s + ')' }],
          hints: ['Which square numbers (4, 9, 16, 25, ...) divide ' + n + '?', 'The largest is ' + k * k + '.', n + ' = ' + k * k + ' × ' + s + '.'], mistakes: [] };
      } },

    /* ---------------- polynomials and factoring ---------------- */
    { id: 'poly-add', strand: 'Polynomials & factoring', title: 'Add and subtract polynomials', lv: [1, 3], grade: '8-9', focus: 'distributing the minus sign',
      gen(r, L) { const hi = L.span(6, 12), t = () => r.int(-hi, hi); return { a: r.nz(-hi, hi), b: t(), c: t(), d: r.nz(-hi, hi), e: t(), f: t(), sub: r.chance(L.t > 0.3 ? 0.7 : 0.2) ? 1 : 0 }; },
      make({ a, b, c, d, e, f, sub }, L) {
        const s = sub ? -1 : 1, P1 = poly([[a, 'x^2'], [b, 'x'], [c, '']]), P2 = poly([[d, 'x^2'], [e, 'x'], [f, '']]), ans = poly([[a + s * d, 'x^2'], [b + s * e, 'x'], [c + s * f, '']]);
        return { q: (sub ? 'Subtract' : 'Add') + ': ' + m('(' + P1 + ') ' + (sub ? '-' : '+') + ' (' + P2 + ')'), ans: A.expr(ans, { form: 'simplified' }),
          steps: (sub ? [{ t: 'The minus sign changes the sign of every term in the second bracket.', m: P1 + ' + ' + '(' + poly([[-d, 'x^2'], [-e, 'x'], [-f, '']]) + ')' }] : []).concat([{ t: 'Combine like terms.', m: ans }]),
          hints: [sub ? 'What does the minus in front of the bracket do?' : 'Which terms are like terms?', sub ? 'It flips the sign of every term inside.' : 'Add the x² terms, the x terms and the numbers separately.', 'The x² terms give ' + (a + s * d) + 'x².'],
          mistakes: sub ? [{ spec: A.expr(poly([[a - d, 'x^2'], [b + e, 'x'], [c + f, '']])), id: 'first-only', msg: 'Only the first term of the second bracket changed sign. The minus applies to every term inside it.' }] : [] };
      } },
    { id: 'poly-mult', strand: 'Polynomials & factoring', title: 'Multiply binomials', lv: [1, 4], grade: '8-10', focus: 'multiplying every term by every term',
      gen(r, L) { const hi = L.span(5, 12); return { a: L.t < 0.4 ? 1 : r.nz(-5, 5), b: r.nz(-hi, hi), c: L.t < 0.4 ? 1 : r.nz(-5, 5), d: r.nz(-hi, hi) }; },
      make({ a, b, c, d }, L) {
        const ans = poly([[a * c, 'x^2'], [a * d + b * c, 'x'], [b * d, '']]);
        return { q: 'Expand and simplify: ' + m('(' + poly([[a, 'x'], [b, '']]) + ')(' + poly([[c, 'x'], [d, '']]) + ')'), ans: A.expr(ans, { form: 'expanded' }),
          steps: [{ t: 'Multiply each term in the first bracket by each term in the second (first, outer, inner, last).', m: poly([[a * c, 'x^2'], [a * d, 'x'], [b * c, 'x'], [b * d, '']]) }, { t: 'Combine the x terms.', m: ans }],
          hints: ['How many products should you get?', 'Four products: ' + a + 'x·' + c + 'x, ' + a + 'x·' + pn(d) + ', ' + pn(b) + '·' + c + 'x, ' + pn(b) + '·' + pn(d) + '.', 'The middle terms combine to ' + (a * d + b * c) + 'x.'],
          mistakes: a * d + b * c ? [{ spec: A.expr(poly([[a * c, 'x^2'], [b * d, '']])), id: 'no-middle', msg: 'The middle term is missing. Multiply the outer and inner pairs too, then combine them.' }] : [],
          proof: 'Distributivity twice: (a + b)(c + d) = a(c + d) + b(c + d) = ac + ad + bc + bd. Nothing else is needed; FOIL is just a way to remember the four products.' };
      } },
    { id: 'factor-gcf', strand: 'Polynomials & factoring', title: 'Factor out the GCF', lv: [1, 3], grade: '8-9', focus: 'finding the greatest common factor',
      gen(r, L) { const k = r.int(2, L.span(4, 9)); let a, b; do { a = r.int(1, 7); b = r.nz(-9, 9); } while (gcd(a, Math.abs(b)) !== 1); return { k, a, b, xp: L.t > 0.4 ? 1 : 0 }; },
      make({ k, a, b, xp }, L) {
        const e = xp ? poly([[k * a, 'x^2'], [k * b, 'x']]) : poly([[k * a, 'x'], [k * b, '']]), out = k + (xp ? 'x' : ''), ans = out + '(' + poly([[a, 'x'], [b, '']]) + ')';
        return { q: 'Factor completely: ' + m(e), ans: A.expr(ans, { form: 'factored' }),
          steps: [{ t: 'The greatest common factor is ' + out + '.' }, { m: e + ' = ' + ans }],
          hints: ['What divides every term?', 'Every coefficient divides by ' + k + (xp ? ', and every term has an x.' : '.'), 'Take ' + out + ' outside a bracket.'],
          mistakes: [] };
      } },
    { id: 'factor-tri', strand: 'Polynomials & factoring', title: 'Factor trinomials', lv: [1, 4], grade: '9-10', focus: 'two numbers with the right product and sum',
      gen(r, L) { const hi = L.span(5, 12), a = L.t < 0.5 ? 1 : r.pick([2, 3, 5]); let p = r.nz(-hi, hi); while (gcd(a, p) !== 1) p = r.nz(-hi, hi); return { a, p, q: r.nz(-hi, hi) }; },
      make({ a, p, q }, L) {
        const e = poly([[a, 'x^2'], [p + a * q, 'x'], [p * q, '']]), ans = '(' + poly([[a, 'x'], [p, '']]) + ')(' + poly([[1, 'x'], [q, '']]) + ')';
        return { q: 'Factor: ' + m(e), ans: A.expr(ans, { form: 'factored' }),
          steps: a === 1 ? [{ t: 'Find two numbers that multiply to ' + p * q + ' and add to ' + (p + q) + ': ' + p + ' and ' + q + '.' }, { m: e + ' = ' + ans }]
            : [{ t: 'Multiply a × c = ' + a * p * q + '. Find two numbers with that product and sum ' + (p + a * q) + ': ' + p + ' and ' + a * q + '.' }, { t: 'Split the middle term and group.', m: e + ' = ' + ans }],
          hints: ['What two numbers multiply to give the constant term?', 'They must also add to the x coefficient' + (a === 1 ? ', ' + (p + q) + '.' : '.'), 'Try ' + p + ' and ' + (a === 1 ? q : a * q) + '.'],
          mistakes: [{ spec: A.expr('(' + poly([[a, 'x'], [-p, '']]) + ')(' + poly([[1, 'x'], [-q, '']]) + ')'), id: 'signs', msg: 'The numbers are right but the signs are flipped. Expand your answer to check the middle term.' }] };
      } },
    { id: 'factor-dos', strand: 'Polynomials & factoring', title: 'Difference of two squares', lv: [1, 3], grade: '9-10', focus: 'spotting a² - b² = (a - b)(a + b)',
      gen(r, L) { const a = L.t < 0.4 ? 1 : r.int(2, 6); let b = r.int(1, L.span(6, 12)); while (gcd(a, b) !== 1) b++; return { a, b }; },
      make({ a, b }, L) {
        const e = poly([[a * a, 'x^2'], [-b * b, '']]), ans = '(' + poly([[a, 'x'], [-b, '']]) + ')(' + poly([[a, 'x'], [b, '']]) + ')';
        return { q: 'Factor: ' + m(e), ans: A.expr(ans, { form: 'factored' }),
          steps: [{ t: 'Both terms are perfect squares: ' + (a === 1 ? 'x²' : a * a + 'x² = (' + a + 'x)²') + ' and ' + b * b + ' = ' + b + '².' }, { m: e + ' = ' + ans }],
          hints: ['Is each term a perfect square?', 'a² - b² = (a - b)(a + b).', 'Here a = ' + (a === 1 ? 'x' : a + 'x') + ' and b = ' + b + '.'],
          mistakes: [{ spec: A.expr('(' + poly([[a, 'x'], [-b, '']]) + ')^2'), id: 'square', msg: '(a - b)² gives a middle term. The difference of squares factors as (a - b)(a + b).' }] };
      } },

    /* ---------------- quadratics ---------------- */
    { id: 'quad-factor', strand: 'Quadratics', title: 'Solve quadratics by factoring', lv: [1, 4], grade: '9-11', focus: 'setting each factor to zero',
      gen(r, L) { const hi = L.span(6, 12); let p, q; do { p = r.int(-hi, hi); q = r.int(-hi, hi); } while (p === -q && L.t < 0.3); return { p, q }; },
      make({ p, q }, L) {
        const e = poly([[1, 'x^2'], [-(p + q), 'x'], [p * q, '']]);
        return { q: 'Solve: ' + m(e + ' = 0'), ans: A.set(p === q ? [p] : [p, q]),
          steps: [{ t: 'Factor.', m: '(' + poly([[1, 'x'], [-p, '']]) + ')(' + poly([[1, 'x'], [-q, '']]) + ') = 0' }, { t: 'A product is zero when one of its factors is zero.', m: 'x = ' + p + (p !== q ? ' or x = ' + q : '') }],
          hints: ['Can you factor the left side?', 'Find two numbers that multiply to ' + p * q + ' and add to ' + -(p + q) + '.', 'Factors: (' + poly([[1, 'x'], [-p, '']]) + ')(' + poly([[1, 'x'], [-q, '']]) + '). Set each to zero.'],
          mistakes: p || q ? [{ spec: A.set(p === q ? [-p] : [-p, -q]), id: 'factor-sign', msg: 'Those are the numbers from inside the factors. Set each factor to zero: x - ' + pn(p) + ' = 0 gives x = ' + p + '.' }] : [] };
      } },
    { id: 'quad-formula', strand: 'Quadratics', title: 'The quadratic formula', lv: [1, 4], grade: '10-12', focus: 'using x = (-b ± √(b² - 4ac)) / 2a',
      gen(r, L) { let a, b, c, D; do { a = L.t < 0.4 ? 1 : r.nz(-4, 5); b = r.int(-9, 9); c = r.int(-9, 9); D = b * b - 4 * a * c; } while (D <= 0 || Number.isInteger(Math.sqrt(D))); return { a, b, c }; },
      make({ a, b, c }, L) {
        const D = b * b - 4 * a * c, r1 = (-b + Math.sqrt(D)) / (2 * a), r2 = (-b - Math.sqrt(D)) / (2 * a);
        return { q: 'Solve ' + m(poly([[a, 'x^2'], [b, 'x'], [c, '']]) + ' = 0') + '. Round to 2 decimal places.', ans: A.set([r1, r2], { dp: 2 }),
          steps: [{ t: 'Here a = ' + a + ', b = ' + b + ', c = ' + c + '.' }, { t: 'Discriminant:', m: 'b^2 - 4ac = ' + D }, { m: 'x = (' + -b + ' ± sqrt(' + D + '))/' + pn(2 * a) }, { m: 'x ≈ ' + SM.roundDP(r1, 2) + ' or x ≈ ' + SM.roundDP(r2, 2) }],
          hints: ['Write down a, b and c first.', 'b² - 4ac = ' + D + '.', 'x = (' + -b + ' ± √' + D + ') / ' + 2 * a + '.'],
          mistakes: [a !== 1 ? { spec: A.set([(-b + Math.sqrt(D)) / 2, (-b - Math.sqrt(D)) / 2], { dp: 2 }), id: 'div-2', msg: 'The denominator is 2a = ' + 2 * a + ', not just 2.' } : null, { spec: A.set([(b + Math.sqrt(D)) / (2 * a), (b - Math.sqrt(D)) / (2 * a)], { dp: 2 }), id: 'minus-b', msg: 'The formula starts with -b. Since b = ' + b + ', -b = ' + -b + '.' }, { spec: A.set([-b + Math.sqrt(D) / (2 * a), -b - Math.sqrt(D) / (2 * a)], { dp: 2 }), id: 'partial-div', msg: 'Divide the whole numerator, -b ± √(b² - 4ac), by 2a, not just the square root.' }].filter(Boolean),
          proof: 'Complete the square. From ax² + bx + c = 0 divide by a: x² + (b/a)x = -c/a. Add (b/2a)²: (x + b/2a)² = (b² - 4ac)/4a². Take square roots: x + b/2a = ±√(b² - 4ac)/2a, so x = (-b ± √(b² - 4ac))/2a. When b² - 4ac < 0 there is no real root.' };
      } },
    { id: 'discriminant', strand: 'Quadratics', title: 'The discriminant', lv: [1, 3], grade: '10-11', focus: 'b² - 4ac decides how many real roots',
      gen(r, L) { return { a: r.nz(-5, 5), b: r.int(-10, 10), c: r.int(-10, 10) }; },
      make({ a, b, c }, L) {
        const D = b * b - 4 * a * c;
        return { q: 'Find the discriminant of ' + m(poly([[a, 'x^2'], [b, 'x'], [c, '']]) + ' = 0') + '. (Then think: how many real solutions?)', ans: A.num(D),
          steps: [{ m: 'b^2 - 4ac = ' + pn(b) + '^2 - 4(' + a + ')(' + c + ') = ' + D }, { t: D > 0 ? 'Positive: two real solutions.' : D === 0 ? 'Zero: one repeated real solution.' : 'Negative: no real solutions.' }],
          hints: ['The discriminant is b² - 4ac.', 'a = ' + a + ', b = ' + b + ', c = ' + c + '.', pn(b) + '² = ' + b * b + ' and 4ac = ' + 4 * a * c + '.'],
          mistakes: [mk(b * b + 4 * a * c, 'plus', 'The formula subtracts: b² - 4ac. Check the sign of 4ac.'), mk(-b * b - 4 * a * c, 'neg-b-sq', 'b² is never negative: ' + pn(b) + '² = ' + b * b + '.')].filter(z => +z.v !== D) };
      } },
    { id: 'vertex', strand: 'Quadratics', title: 'Vertex of a parabola', lv: [1, 4], grade: '10-12', focus: 'x = -b / 2a',
      gen(r, L) { return { a: r.nz(-3, 3), h: r.int(-6, 6), k: r.int(-9, 9) }; },
      make({ a, h, k }, L) {
        const b = -2 * a * h, c = a * h * h + k;
        return { q: 'Find the vertex of ' + m('y = ' + poly([[a, 'x^2'], [b, 'x'], [c, '']])) + '. Give ' + m('(x, y)') + '.', ans: A.pair(h, k), graph: { fns: [poly([[a, 'x^2'], [b, 'x'], [c, '']])] },
          steps: [{ t: 'The x-coordinate of the vertex is -b/2a.', m: 'x = ' + -b + '/' + pn(2 * a) + ' = ' + h }, { t: 'Substitute to find y.', m: 'y = ' + k }],
          hints: ['The vertex lies on the axis of symmetry.', 'Use x = -b/(2a) with a = ' + a + ', b = ' + b + '.', 'x = ' + h + '. Now put it into the equation.'],
          mistakes: h ? [{ spec: A.pair(-h, 4 * a * h * h + k), id: 'sign-h', msg: 'The x-coordinate is -b/(2a). Watch the minus sign.' }] : [],
          proof: 'Complete the square: ax² + bx + c = a(x + b/2a)² + c - b²/4a. The square is never negative, so the extreme value occurs at x = -b/2a.' };
      } },

    /* ---------------- functions and graphing ---------------- */
    { id: 'func-eval', strand: 'Functions & graphing', title: 'Function notation', lv: [1, 3], grade: '8-10', focus: 'replacing x with the input',
      gen(r, L) { const hi = L.span(5, 9); return { a: r.nz(-hi, hi), b: r.int(-hi, hi), c: r.int(-hi, hi), x: r.int(-5, 5) }; },
      make({ a, b, c, x }, L) {
        const f = poly([[a, 'x^2'], [b, 'x'], [c, '']]), v = a * x * x + b * x + c;
        return { q: 'If ' + m('f(x) = ' + f) + ', find ' + m('f(' + x + ')') + '.', ans: A.num(v), graph: { fns: [f] },
          steps: [{ t: 'Replace every x with (' + x + ').', m: 'f(' + x + ') = ' + a + '(' + x + ')^2 + ' + pn(b) + '(' + x + ') + ' + pn(c) }, { m: '= ' + v }],
          hints: ['f(' + x + ') means: put ' + x + ' in for x.', '(' + x + ')² = ' + x * x + '.', a + ' × ' + x * x + ' = ' + a * x * x + '.'],
          mistakes: [x < 0 ? mk(-a * x * x + b * x + c, 'neg-sq', 'Squaring a negative gives a positive: (' + x + ')² = ' + x * x + '.') : null, mk(a * 2 * x + b * x + c, 'sq-2x', 'x² means x × x, not 2x.')].filter(z => z && +z.v !== v) };
      } },
    { id: 'composite', strand: 'Functions & graphing', title: 'Composite functions', lv: [2, 4], grade: '11-12', focus: 'working from the inside out',
      gen(r, L) { return { a: r.nz(-5, 5), b: r.int(-6, 6), c: r.nz(-3, 3), d: r.int(-5, 5), x: r.int(-4, 4) }; },
      make({ a, b, c, d, x }, L) {
        const g = c * x * x + d, v = a * g + b, wrong = c * (a * x + b) * (a * x + b) + d;
        return { q: 'Let ' + m('f(x) = ' + poly([[a, 'x'], [b, '']])) + ' and ' + m('g(x) = ' + poly([[c, 'x^2'], [d, '']])) + '. Find ' + m('f(g(' + x + '))') + '.', ans: A.num(v),
          steps: [{ t: 'Inside first.', m: 'g(' + x + ') = ' + g }, { m: 'f(' + g + ') = ' + v }],
          hints: ['Which function do you apply first?', 'Work out g(' + x + ') first.', 'g(' + x + ') = ' + g + '. Now find f of that.'],
          mistakes: wrong !== v ? [mk(wrong, 'order', 'That is g(f(' + x + ')). For f(g(x)), apply g first, then f.')] : [] };
      } },
    { id: 'slope', strand: 'Functions & graphing', title: 'Slope from two points', lv: [1, 3], grade: '8-9', focus: 'rise over run',
      gen(r, L) { const hi = L.span(6, 12); let x1, x2, y1, y2; do { x1 = r.int(-hi, hi); x2 = r.int(-hi, hi); y1 = r.int(-hi, hi); y2 = r.int(-hi, hi); } while (x1 === x2 || y1 === y2); return { x1, y1, x2, y2 }; },
      make({ x1, y1, x2, y2 }, L) {
        const s = qs(y2 - y1, x2 - x1);
        return { q: 'Find the slope of the line through ' + m('(' + x1 + ', ' + y1 + ')') + ' and ' + m('(' + x2 + ', ' + y2 + ')') + '.', ans: A.num(s), pic: { type: 'grid', pts: [[x1, y1], [x2, y2]], line: true },
          steps: [{ t: 'Slope = change in y ÷ change in x.', m: 'm = (' + y2 + ' - ' + pn(y1) + ')/(' + x2 + ' - ' + pn(x1) + ') = ' + (y2 - y1) + '/' + (x2 - x1) }, { m: '= ' + s }],
          hints: ['Slope is rise over run.', 'Rise: ' + y2 + ' - ' + pn(y1) + ' = ' + (y2 - y1) + '.', 'Run: ' + x2 + ' - ' + pn(x1) + ' = ' + (x2 - x1) + '.'],
          mistakes: [mk(qs(x2 - x1, y2 - y1), 'run-rise', 'That is run over rise. Slope is the change in y divided by the change in x.'), mk(qs(y2 - y1, x1 - x2), 'order', 'Subtract in the same order on top and bottom: (y₂ - y₁)/(x₂ - x₁).')].filter(z => !Q.of(z.v).eq(Q.of(s))) };
      } },
    { id: 'line-eq', strand: 'Functions & graphing', title: 'Equation of a line', lv: [1, 4], grade: '9-10', focus: 'finding the slope, then the intercept',
      gen(r, L) { const m1 = r.nz(-5, 5), b = r.int(-9, 9), x1 = r.int(-5, 5); let x2 = r.int(-5, 5); if (x2 === x1) x2 = x1 + 1; return { m: m1, b, x1, x2 }; },
      make(p, L) {
        const y1 = p.m * p.x1 + p.b, y2 = p.m * p.x2 + p.b, eq = 'y = ' + poly([[p.m, 'x'], [p.b, '']]);
        return { q: 'Write the equation of the line through ' + m('(' + p.x1 + ', ' + y1 + ')') + ' and ' + m('(' + p.x2 + ', ' + y2 + ')') + ' in the form ' + m('y = mx + b') + '.', ans: A.eqn(eq.replace(/ /g, ''), { form: 'slope-intercept', text: eq }), pic: { type: 'grid', pts: [[p.x1, y1], [p.x2, y2]], line: true },
          steps: [{ t: 'Slope:', m: 'm = (' + y2 + ' - ' + pn(y1) + ')/(' + p.x2 + ' - ' + pn(p.x1) + ') = ' + p.m }, { t: 'Put one point into y = mx + b to find b.', m: y1 + ' = ' + p.m + '(' + p.x1 + ') + b, so b = ' + p.b }, { m: eq }],
          hints: ['Find the slope first.', 'm = ' + p.m + '.', 'Now use (' + p.x1 + ', ' + y1 + ') to solve for b.'],
          mistakes: [] };
      } },
    { id: 'intercepts', strand: 'Functions & graphing', title: 'Intercepts of a line', lv: [1, 3], grade: '8-10', focus: 'setting y = 0',
      gen(r, L) { return { a: r.nz(-9, 9), b: r.nz(-9, 9), c: r.nz(-30, 30) }; },
      make({ a, b, c }, L) {
        const xi = qs(c, a);
        return { q: 'Find the x-intercept of ' + m(poly([[a, 'x'], [b, 'y']]) + ' = ' + c) + ' (give the x-value).', ans: A.num(xi),
          steps: [{ t: 'On the x-axis, y = 0.', m: a + 'x = ' + c }, { m: 'x = ' + xi }],
          hints: ['What is y at the x-intercept?', 'Set y = 0.', a + 'x = ' + c + '.'],
          mistakes: [mk(qs(c, b), 'y-int', 'That is the y-intercept (where x = 0). For the x-intercept, set y = 0.')].filter(z => !Q.of(z.v).eq(Q.of(xi))) };
      } },

    /* ---------------- geometry ---------------- */
    { id: 'area', strand: 'Geometry', title: 'Area of shapes', lv: [0, 3], grade: '3-7', focus: 'choosing the right area formula',
      gen(r, L) { const sh = r.pick(L.stage([['rect'], ['rect', 'tri'], ['rect', 'tri', 'para', 'trap'], ['tri', 'trap']])); const hi = L.span(9, 30); return { sh, a: r.int(2, hi), b: r.int(2, hi), c: r.int(2, hi) }; },
      make({ sh, a, b, c }, L) {
        const v = { rect: Q.of(a * b), tri: new Q(a * b, 2), para: Q.of(a * b), trap: new Q((a + c) * b, 2) }[sh];
        const name = { rect: 'rectangle', tri: 'triangle', para: 'parallelogram', trap: 'trapezoid' }[sh];
        const desc = { rect: 'is ' + a + ' cm long and ' + b + ' cm wide', tri: 'has base ' + a + ' cm and height ' + b + ' cm', para: 'has base ' + a + ' cm and height ' + b + ' cm', trap: 'has parallel sides ' + a + ' cm and ' + c + ' cm and height ' + b + ' cm' }[sh];
        const f = { rect: 'A = length × width', tri: 'A = ½ × base × height', para: 'A = base × height', trap: 'A = ½ × (a + b) × h' }[sh];
        return { q: 'A ' + name + ' ' + desc + '. What is its area in cm²?', ans: A.num(v.toString(), { text: v.toString() }), pic: { type: 'shape', sh, a, b, c },
          steps: [{ t: f + '.' }, { m: { rect: a + ' × ' + b, tri: '1/2 × ' + a + ' × ' + b, para: a + ' × ' + b, trap: '1/2 × (' + a + ' + ' + c + ') × ' + b }[sh] + ' = ' + (v.toDecimal() || v) }],
          hints: ['What formula gives the area of a ' + name + '?', f + '.', 'Put in the numbers.'],
          mistakes: [sh === 'tri' || sh === 'trap' ? mk(v.mul(2).toString(), 'no-half', 'Remember the ½. A ' + name + ' is half of a ' + (sh === 'tri' ? 'rectangle' : 'parallelogram') + '.') : null, sh === 'rect' ? mk(2 * (a + b), 'perimeter', 'That is the perimeter (the distance around). Area counts the squares inside: length × width.') : null].filter(Boolean) };
      } },
    { id: 'perimeter', strand: 'Geometry', title: 'Perimeter', lv: [0, 2], grade: '3-5', focus: 'adding every side',
      gen(r, L) { const sh = r.pick(L.stage([['rect'], ['rect', 'reg'], ['reg', 'L']])); return { sh, a: r.int(2, L.span(9, 40)), b: r.int(2, L.span(9, 40)), n: r.int(3, 8) }; },
      make({ sh, a, b, n }, L) {
        const names = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon' };
        if (sh === 'reg') return { q: 'A regular ' + names[n] + ' has sides of ' + a + ' cm. What is its perimeter in cm?', ans: A.num(n * a), pic: { type: 'shape', sh: 'reg', n, a },
          steps: [{ t: 'All ' + n + ' sides are equal.', m: n + ' × ' + a + ' = ' + n * a }], hints: ['How many sides does a ' + names[n] + ' have?', n + ' sides.', 'Each side is ' + a + ' cm.'], mistakes: [] };
        const A2 = Math.max(a, b) + 2, B2 = Math.min(a, b) + 1;
        if (sh === 'L') return { q: 'An L-shape is a ' + A2 + ' cm by ' + B2 + ' cm rectangle with a 1 cm by 1 cm square cut from one corner. What is its perimeter in cm?', ans: A.num(2 * (A2 + B2)), pic: { type: 'shape', sh: 'L', a: A2, b: B2 },
          steps: [{ t: 'Cutting a square from a corner moves two edges inward but does not change their total length.', m: '2 × (' + A2 + ' + ' + B2 + ') = ' + 2 * (A2 + B2) }], hints: ['Trace around the outside edge.', 'The notch swaps two edges for two edges of the same total length.', 'So the perimeter equals that of the full rectangle.'], mistakes: [mk(2 * (A2 + B2) - 2, 'notch', 'The cut corner does not shorten the perimeter: the two new edges replace two edges of the same total length.')] };
        return { q: 'A rectangle is ' + a + ' m long and ' + b + ' m wide. What is its perimeter in metres?', ans: A.num(2 * (a + b)), pic: { type: 'shape', sh: 'rect', a, b },
          steps: [{ t: 'Add all four sides.', m: a + ' + ' + b + ' + ' + a + ' + ' + b + ' = ' + 2 * (a + b) }], hints: ['How many sides does a rectangle have?', 'Two lengths and two widths.', '2 × (' + a + ' + ' + b + ').'],
          mistakes: [mk(a + b, 'two-sides', 'That adds only two sides. A rectangle has four sides: two lengths and two widths.'), mk(a * b, 'area', 'That is the area. Perimeter is the distance around the outside.')].filter(z => +z.v !== 2 * (a + b)) };
      } },
    { id: 'circle', strand: 'Geometry', title: 'Circles', lv: [1, 3], grade: '7-8', focus: 'radius versus diameter, area versus circumference',
      gen(r, L) { return { r: r.int(1, L.span(9, 25)), useD: r.chance(0.5) ? 1 : 0, what: r.chance(0.5) ? 'A' : 'C' }; },
      make(p, L) {
        const rr = p.r, given = p.useD ? 'diameter ' + 2 * rr + ' cm' : 'radius ' + rr + ' cm', v = p.what === 'A' ? rr * rr + 'pi' : 2 * rr + 'pi';
        return { q: 'A circle has ' + given + '. Find its ' + (p.what === 'A' ? 'area in cm²' : 'circumference in cm') + ', in terms of π.', ans: A.num(v, { text: v.replace('pi', 'π') }), pic: { type: 'shape', sh: 'circle', r: rr, useD: p.useD },
          steps: (p.useD ? [{ t: 'The radius is half the diameter: ' + rr + ' cm.' }] : []).concat([{ t: p.what === 'A' ? 'A = πr².' : 'C = 2πr.', m: p.what === 'A' ? 'π × ' + rr + '^2 = ' + rr * rr + 'π' : '2 × π × ' + rr + ' = ' + 2 * rr + 'π' }]),
          hints: [p.useD ? 'Is that the radius or the diameter?' : 'Which formula: area or circumference?', p.what === 'A' ? 'Area = πr².' : 'Circumference = 2πr.', 'r = ' + rr + '.'],
          mistakes: [mk(p.what === 'A' ? 2 * rr + 'pi' : rr * rr + 'pi', 'formula', p.what === 'A' ? 'That is the circumference (2πr). Area is πr².' : 'That is the area (πr²). Circumference is 2πr.'), p.useD ? mk(p.what === 'A' ? 4 * rr * rr + 'pi' : 4 * rr + 'pi', 'diameter', 'The formula uses the radius. Halve the diameter first: r = ' + rr + '.') : null].filter(z => z && z.v !== v) };
      } },
    { id: 'angles', strand: 'Geometry', title: 'Missing angles', lv: [0, 3], grade: '4-8', focus: 'angles on a line, in a right angle and in a triangle',
      gen(r, L) { const kind = r.pick(L.stage([['right', 'line'], ['line', 'tri'], ['tri', 'point', 'vert']])); return { kind, a: r.int(10, 80), b: r.int(10, 80) }; },
      make({ kind, a, b }, L) {
        const T = { right: [90, 'Angles in a right angle add up to 90°.', 90 - a, [a]], line: [180, 'Angles on a straight line add up to 180°.', 180 - a - b, [a, b]], tri: [180, 'Angles in a triangle add up to 180°.', 180 - a - b, [a, b]], point: [360, 'Angles around a point add up to 360°.', 360 - a - b - 90, [a, b, 90]], vert: [0, 'Vertically opposite angles are equal.', a, [a]] }[kind];
        const v = T[2];
        return { q: kind === 'vert' ? 'Two straight lines cross. One angle is ' + a + '°. What is the angle vertically opposite it, in degrees?' : 'Angles of ' + H.list(T[3].map(x => x + '°')) + ' together with a missing angle ' + { right: 'make a right angle', line: 'lie on a straight line', tri: 'are the three angles of a triangle', point: 'go all the way around a point' }[kind] + '. Find the missing angle in degrees.', ans: A.num(v), pic: { type: 'angles', kind, given: T[3], missing: v },
          steps: [{ t: T[1] }, kind === 'vert' ? { m: a + '°' } : { m: T[0] + ' - ' + T[3].join(' - ') + ' = ' + v }],
          hints: ['What do these angles add up to?', T[1], kind === 'vert' ? 'The opposite angle matches.' : 'Subtract the known angles from ' + T[0] + '°.'],
          mistakes: [kind === 'tri' || kind === 'line' ? mk(90 - a - b, '90', 'These angles add to 180°, not 90°.') : null, kind === 'right' ? mk(180 - a, '180', 'A right angle is 90°, so subtract from 90°, not 180°.') : null, kind === 'vert' ? mk(180 - a, 'adjacent', 'That is the angle next to it on the line. The vertically opposite angle is equal: ' + a + '°.') : null].filter(z => z && +z.v !== v) };
      } },
    { id: 'pythagoras', strand: 'Geometry', title: 'Pythagoras\' theorem', lv: [1, 3], grade: '8-9', focus: 'a² + b² = c² with c the longest side',
      gen(r, L) { const exactTriple = L.t < 0.35 || r.chance(0.4); const t = r.pick(TRIPLES), k = r.int(1, L.span(2, 6)); const a = exactTriple ? t[0] * k : r.int(2, L.span(9, 20)), b = exactTriple ? t[1] * k : r.int(2, L.span(9, 20)); return { a, b, leg: r.chance(L.t > 0.3 ? 0.45 : 0) ? 1 : 0 }; },
      make({ a, b, leg }, L) {
        if (!leg) { const h = new Num(1, a * a + b * b);
          return { q: 'A right triangle has legs ' + a + ' and ' + b + '. Find the hypotenuse (exact, or to 2 decimal places).', ans: A.num(h.toString(), { text: h.pretty(), dp: 2 }), pic: { type: 'righttri', a, b, ask: 'c' },
            steps: [{ t: 'Pythagoras: c² = a² + b².', m: 'c^2 = ' + a + '^2 + ' + b + '^2 = ' + (a * a + b * b) }, { m: 'c = sqrt(' + (a * a + b * b) + ')' + (h.isRational() ? ' = ' + h : h.c.eq(1) ? '' : ' = ' + h.toString().replace('sqrt', 'sqrt')) + (h.isRational() ? '' : ' ≈ ' + SM.roundDP(h.toFloat(), 2)) }],
            hints: ['Which side is the hypotenuse?', 'c² = a² + b².', a + '² + ' + b + '² = ' + (a * a + b * b) + '.'],
            mistakes: [mk(a + b, 'add-sides', 'The sides themselves do not add. Square them first: c² = a² + b².'), mk(a * a + b * b, 'no-root', 'That is c². Take the square root to find c.')].filter(z => +z.v !== h.toFloat()),
            proof: 'Arrange four copies of the triangle inside a square of side a + b so that they leave a tilted square of side c in the middle. Area two ways: (a + b)² = 4 × ½ab + c², so a² + 2ab + b² = 2ab + c², giving a² + b² = c².' };
        }
        const c = Math.max(a, b) + Math.min(a, b) % 5 + 1, sh = Math.min(a, b), l = new Num(1, c * c - sh * sh);
        return { q: 'A right triangle has hypotenuse ' + c + ' and one leg ' + sh + '. Find the other leg (exact, or to 2 decimal places).', ans: A.num(l.toString(), { text: l.pretty(), dp: 2 }), pic: { type: 'righttri', a: sh, c, ask: 'b' },
          steps: [{ t: 'Rearrange: b² = c² - a².', m: 'b^2 = ' + c + '^2 - ' + sh + '^2 = ' + (c * c - sh * sh) }, { m: 'b = sqrt(' + (c * c - sh * sh) + ')' + (l.isRational() ? ' = ' + l : ' ≈ ' + SM.roundDP(l.toFloat(), 2)) }],
          hints: ['The hypotenuse is the longest side, so the leg is shorter than ' + c + '.', 'b² = c² - a².', c + '² - ' + sh + '² = ' + (c * c - sh * sh) + '.'],
          mistakes: [mk(new Num(1, c * c + sh * sh).toString(), 'added', 'To find a leg, subtract: b² = c² - a². Adding gives something longer than the hypotenuse.')] };
      } },
    { id: 'volume', strand: 'Geometry', title: 'Volume', lv: [0, 4], grade: '5-10', focus: 'base area times height (and the ⅓ for points)',
      gen(r, L) { const sh = r.pick(L.stage([['box'], ['box', 'cyl'], ['cyl', 'cone', 'sphere'], ['cone', 'sphere', 'cyl']])); return { sh, a: r.int(2, L.span(6, 15)), b: r.int(2, L.span(6, 15)), c: r.int(2, L.span(6, 15)), r: r.int(1, L.span(5, 12)), h: r.int(2, L.span(6, 15)) * 3 }; },
      make(p, L) {
        const { sh } = p;
        const V = { box: [String(p.a * p.b * p.c), 'V = l × w × h', p.a + ' × ' + p.b + ' × ' + p.c], cyl: [p.r * p.r * p.h + 'pi', 'V = πr²h', 'π × ' + p.r + '^2 × ' + p.h], cone: [p.r * p.r * p.h / 3 + 'pi', 'V = ⅓πr²h', '1/3 × π × ' + p.r + '^2 × ' + p.h], sphere: [Q.of(4 * p.r * p.r * p.r).div(3).toString().replace(/^(\d+)\/(\d+)$/, '$1pi/$2').replace(/^(\d+)$/, '$1pi'), 'V = ⁴⁄₃πr³', '4/3 × π × ' + p.r + '^3'] }[sh];
        const desc = { box: 'A box measures ' + p.a + ' cm by ' + p.b + ' cm by ' + p.c + ' cm. Find its volume in cm³.', cyl: 'A cylinder has radius ' + p.r + ' cm and height ' + p.h + ' cm. Find its volume in cm³, in terms of π.', cone: 'A cone has radius ' + p.r + ' cm and height ' + p.h + ' cm. Find its volume in cm³, in terms of π.', sphere: 'A sphere has radius ' + p.r + ' cm. Find its volume in cm³, in terms of π.' }[sh];
        return { q: desc, ans: A.num(V[0], { text: V[0].replace('pi', 'π') }), pic: { type: 'solid', sh, a: p.a, b: p.b, c: p.c, r: p.r, h: p.h },
          steps: [{ t: V[1] + '.' }, { m: V[2] + ' = ' + V[0].replace('pi', 'π') }],
          hints: ['Which volume formula fits this shape?', V[1] + '.', 'Substitute the measurements.'],
          mistakes: sh === 'cone' ? [mk(p.r * p.r * p.h + 'pi', 'no-third', 'A cone holds one third of the cylinder with the same base and height. Multiply by ⅓.')] : sh === 'cyl' ? [mk(2 * p.r * p.h + 'pi', 'r-not-sq', 'The base area is πr², so square the radius.')] : [],
          proof: sh === 'sphere' ? 'Cavalieri: a hemisphere of radius r has the same cross-sections as a cylinder of radius r and height r with a cone removed: π(r² - z²) at height z. So V(hemisphere) = πr³ - ⅓πr³ = ⅔πr³ and the sphere is ⁴⁄₃πr³. With calculus: V = ∫ π(r² - z²) dz from -r to r = ⁴⁄₃πr³.' : sh === 'cone' ? 'Slice at height z from the apex: radius rz/h, area π r² z²/h². Integrating from 0 to h gives π r² h/3.' : undefined };
      } },
    { id: 'polygon-angles', strand: 'Geometry', title: 'Angles in polygons', lv: [1, 3], grade: '8-9', focus: 'splitting the polygon into triangles',
      gen(r, L) { return { n: r.int(5, L.span(8, 20)), each: r.chance(0.5) ? 1 : 0 }; },
      make({ n, each }, L) {
        const S = (n - 2) * 180, v = each ? new Q(S, n) : Q.of(S);
        return { q: each ? 'What is each interior angle of a regular ' + n + '-sided polygon, in degrees?' : 'What is the sum of the interior angles of a ' + n + '-sided polygon, in degrees?', ans: A.num(v.toString()),
          steps: [{ t: 'A polygon with n sides splits into n - 2 triangles from one corner.', m: '(' + n + ' - 2) × 180 = ' + S }].concat(each ? [{ t: 'Regular: all angles equal.', m: S + ' ÷ ' + n + ' = ' + (v.toDecimal() || v) }] : []),
          hints: ['How many triangles can you split it into from one corner?', n - 2 + ' triangles.', 'Each triangle has 180°.'],
          mistakes: [mk(each ? new Q(n * 180, n).toString() : n * 180, 'n-180', 'There are n - 2 triangles, not n. Use (n - 2) × 180°.')] };
      } },

    /* ---------------- statistics and probability ---------------- */
    { id: 'mean', strand: 'Statistics & probability', title: 'Mean', lv: [0, 2], grade: '5-7', focus: 'adding up and dividing by how many',
      gen(r, L) { const n = r.int(3, L.span(5, 9)); return { xs: Array.from({ length: n }, () => r.int(L.t > 0.6 ? -10 : 1, L.span(10, 99))) }; },
      make({ xs }, L) {
        const S = xs.reduce((a, b) => a + b, 0), v = new Q(S, xs.length);
        return { q: 'Find the mean of ' + xs.join(', ') + '.', ans: A.num(v.toString(), { dp: 2 }),
          steps: [{ t: 'Add them up.', m: xs.map(pn).join(' + ') + ' = ' + S }, { t: 'Divide by how many there are (' + xs.length + ').', m: S + ' ÷ ' + xs.length + ' = ' + (v.toDecimal() || v + ' ≈ ' + SM.roundDP(v.toFloat(), 2)) }],
          hints: ['Mean = total ÷ count.', 'The total is ' + S + '.', 'There are ' + xs.length + ' numbers.'],
          mistakes: [mk(S, 'no-divide', 'That is the total. Divide it by how many numbers there are (' + xs.length + ').'), mk(new Q(S, xs.length - 1).toString(), 'n-1', 'Divide by the count of numbers, ' + xs.length + ', not ' + (xs.length - 1) + '.')] };
      } },
    { id: 'median', strand: 'Statistics & probability', title: 'Median, mode and range', lv: [0, 2], grade: '5-7', focus: 'putting the data in order first',
      gen(r, L) { const n = r.int(5, L.span(7, 10)); let xs; do { xs = Array.from({ length: n }, () => r.int(1, L.span(15, 60))); } while ([...xs].sort((a, b) => a - b).join() === xs.join()); const what = r.pick(L.t < 0.3 ? ['median', 'range'] : ['median', 'range', 'median']); return { xs, what }; },
      make({ xs, what }, L) {
        const s = [...xs].sort((a, b) => a - b), n = s.length, med = n % 2 ? Q.of(s[(n - 1) / 2]) : new Q(s[n / 2 - 1] + s[n / 2], 2), rng = s[n - 1] - s[0];
        if (what === 'range') return { q: 'Find the range of ' + xs.join(', ') + '.', ans: A.num(rng), steps: [{ t: 'Range = largest - smallest.', m: s[n - 1] + ' - ' + s[0] + ' = ' + rng }], hints: ['Range measures the spread.', 'Find the largest and smallest values.', 'Largest ' + s[n - 1] + ', smallest ' + s[0] + '.'], mistakes: [mk(xs[xs.length - 1] - xs[0], 'unsorted', 'That uses the last and first numbers as listed. Use the largest and the smallest.')].filter(z => +z.v !== rng) };
        const um = n % 2 ? Q.of(xs[(n - 1) / 2]) : new Q(xs[n / 2 - 1] + xs[n / 2], 2);
        return { q: 'Find the median of ' + xs.join(', ') + '.', ans: A.num(med.toString()),
          steps: [{ t: 'Put the numbers in order.', m: s.join(', ') }, { t: n % 2 ? 'The middle value is the median.' : 'Two middle values: take their mean.', m: (n % 2 ? '' : '(' + s[n / 2 - 1] + ' + ' + s[n / 2] + ')/2 = ') + (med.toDecimal() || med) }],
          hints: ['What do you do with the list first?', 'Sort it: ' + s.join(', ') + '.', n % 2 ? 'Take the middle one.' : 'There are two middle numbers.'],
          mistakes: [mk(um.toString(), 'unsorted', 'That is the middle of the list as written. Put the numbers in order first.')].filter(z => !Q.of(z.v).eq(med)) };
      } },
    { id: 'prob-simple', strand: 'Statistics & probability', title: 'Simple probability', lv: [0, 2], grade: '5-7', focus: 'favourable outcomes over total outcomes',
      gen(r, L) { return { red: r.int(1, L.span(5, 15)), blue: r.int(1, L.span(5, 15)), green: r.int(0, L.span(3, 10)) }; },
      make({ red, blue, green }, L) {
        const N = red + blue + green, v = qs(red, N);
        return { q: 'A bag has ' + red + ' red, ' + blue + ' blue' + (green ? ' and ' + green + ' green' : '') + ' marbles. One is picked at random. What is the probability it is red?', ans: A.num(v), pic: L.kid ? { type: 'marbles', counts: [red, blue, green] } : null,
          steps: [{ t: 'Total marbles: ' + N + '.' }, { m: 'P(red) = ' + red + '/' + N + (v !== red + '/' + N ? ' = ' + v : '') }],
          hints: ['How many marbles are there altogether?', N + ' in total.', red + ' of them are red.'],
          mistakes: [mk(qs(red, N - red), 'odds', 'That compares red with not-red (odds). Probability compares red with all the marbles: ' + red + '/' + N + '.'), mk(qs(red, blue), 'red-blue', 'Divide by the total number of marbles, not just the blue ones.')].filter(z => !Q.of(z.v).eq(Q.of(v))) };
      } },
    { id: 'prob-compound', strand: 'Statistics & probability', title: 'Combined events', lv: [1, 3], grade: '7-10', focus: 'multiplying for "and", adjusting without replacement',
      gen(r, L) { return { red: r.int(2, 8), blue: r.int(2, 8), repl: L.t < 0.4 || r.chance(0.4) ? 1 : 0 }; },
      make({ red, blue, repl }, L) {
        const N = red + blue, v = repl ? new Q(red * blue, N * N) : new Q(red * blue, N * (N - 1));
        return { q: 'A bag has ' + red + ' red and ' + blue + ' blue counters. Two are drawn ' + (repl ? 'with' : 'without') + ' replacement. What is the probability the first is red and the second is blue?', ans: A.num(v.toString()),
          steps: [{ m: 'P(red first) = ' + red + '/' + N }, { t: repl ? 'The counter goes back, so nothing changes.' : 'One counter is gone, so ' + (N - 1) + ' remain.', m: 'P(blue second) = ' + blue + '/' + (repl ? N : N - 1) }, { t: '"And" means multiply.', m: red + '/' + N + ' × ' + blue + '/' + (repl ? N : N - 1) + ' = ' + v }],
          hints: ['Find the probability of each step.', repl ? 'Both draws are from ' + N + ' counters.' : 'The second draw is from ' + (N - 1) + ' counters.', 'Multiply the two probabilities.'],
          mistakes: [mk(new Q(red, N).add(new Q(blue, repl ? N : N - 1)).toString(), 'added', 'For "first this AND then that", multiply the probabilities instead of adding them.'), !repl ? mk(new Q(red * blue, N * N).toString(), 'replace', 'Without replacement there are only ' + (N - 1) + ' counters left for the second draw.') : null].filter(z => z && !Q.of(z.v).eq(v)) };
      } },

    /* ---------------- trigonometry ---------------- */
    { id: 'trig-ratio', strand: 'Trigonometry', title: 'Sine, cosine and tangent ratios', lv: [1, 3], grade: '9-10', focus: 'SOH CAH TOA',
      gen(r, L) { const t = r.pick(TRIPLES.slice(0, 4)); return { o: t[0], a: t[1], h: t[2], k: r.int(1, 3), fn: r.pick(['sin', 'cos', 'tan']), swap: r.chance(0.5) ? 1 : 0 }; },
      make(p, L) {
        const o = (p.swap ? p.a : p.o) * p.k, a = (p.swap ? p.o : p.a) * p.k, h = p.h * p.k, v = { sin: qs(o, h), cos: qs(a, h), tan: qs(o, a) }[p.fn];
        return { q: 'In a right triangle, angle θ has opposite side ' + o + ', adjacent side ' + a + ' and hypotenuse ' + h + '. Find ' + m(p.fn + ' θ') + ' as a fraction.', ans: A.num(v), pic: { type: 'righttri', a: a, b: o, c: h, theta: true },
          steps: [{ t: { sin: 'sin = opposite / hypotenuse', cos: 'cos = adjacent / hypotenuse', tan: 'tan = opposite / adjacent' }[p.fn] + '.' }, { m: p.fn + ' θ = ' + { sin: o + '/' + h, cos: a + '/' + h, tan: o + '/' + a }[p.fn] + ' = ' + v }],
          hints: ['SOH CAH TOA.', { sin: 'S: opposite over hypotenuse.', cos: 'C: adjacent over hypotenuse.', tan: 'T: opposite over adjacent.' }[p.fn], 'Opposite = ' + o + ', adjacent = ' + a + ', hypotenuse = ' + h + '.'],
          mistakes: ['sin', 'cos', 'tan'].filter(f => f !== p.fn).map(f => mk({ sin: qs(o, h), cos: qs(a, h), tan: qs(o, a) }[f], 'used-' + f, 'That is ' + f + ' θ. For ' + p.fn + ', use ' + { sin: 'opposite over hypotenuse', cos: 'adjacent over hypotenuse', tan: 'opposite over adjacent' }[p.fn] + '.')).concat([mk(qs(h, { sin: o, cos: a, tan: a }[p.fn]), 'upside', 'The fraction is upside down. The hypotenuse (or adjacent side for tan) goes on the bottom.')]).filter(z => !Q.of(z.v).eq(Q.of(v))) };
      } },
    { id: 'trig-special', strand: 'Trigonometry', title: 'Exact trig values', lv: [1, 4], grade: '10-12', focus: 'the 30-60-90 and 45-45-90 triangles',
      gen(r, L) { const angs = L.t < 0.4 ? [30, 45, 60] : [30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330]; let fn, d; do { fn = r.pick(['sin', 'cos', 'tan']); d = r.pick(angs); } while (!trigExact(fn, d)); return { fn, d }; },
      make({ fn, d }, L) {
        const v = trigExact(fn, d), ref = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
        return { q: 'Give the exact value of ' + m(fn + '(' + d + '°)') + '.', ans: A.num(v, { text: v.replace(/sqrt\((\d)\)/g, '√$1') }), pic: { type: 'unit', deg: d },
          steps: (d > 90 ? [{ t: 'Reference angle: ' + ref + '°. In this quadrant ' + fn + ' is ' + (v[0] === '-' ? 'negative' : 'positive') + '.' }] : []).concat([{ t: ref === 45 ? 'Use the 45-45-90 triangle with sides 1, 1, √2.' : 'Use the 30-60-90 triangle with sides 1, √3, 2.', m: fn + '(' + d + '°) = ' + v }]),
          hints: ['Which special triangle has a ' + ref + '° angle?', ref === 45 ? 'Sides 1, 1, √2.' : 'Sides 1 (opposite 30°), √3 (opposite 60°), 2.', d > 90 ? 'Then fix the sign for the quadrant.' : 'Now apply SOH CAH TOA.'],
          mistakes: [fn !== 'tan' ? mk(trigExact(fn === 'sin' ? 'cos' : 'sin', d), 'swap', 'That is the ' + (fn === 'sin' ? 'cosine' : 'sine') + ' value. Check which side is opposite the angle.') : null, d > 90 ? mk(v[0] === '-' ? v.slice(1) : '-' + v, 'quad-sign', 'Right size, wrong sign. Check which quadrant ' + d + '° is in.') : null].filter(z => z && z.v !== v),
          proof: 'Halve an equilateral triangle of side 2: the halves have sides 1, √3, 2 and angles 30°, 60°, 90°, so sin 30° = 1/2 and sin 60° = √3/2. Halve a unit square along the diagonal for 45°: sides 1, 1, √2, so sin 45° = 1/√2 = √2/2. On the unit circle (cos θ, sin θ) is the point at angle θ, which fixes the signs in each quadrant.' };
      } },
    { id: 'trig-side', strand: 'Trigonometry', title: 'Find a side with trigonometry', lv: [1, 3], grade: '9-10', focus: 'choosing the right ratio',
      gen(r, L) { return { h: r.int(5, L.span(20, 80)), th: r.int(15, 75), want: r.pick(['opp', 'adj']) }; },
      make({ h, th, want }, L) {
        const v = want === 'opp' ? h * Math.sin(th * Math.PI / 180) : h * Math.cos(th * Math.PI / 180), other = want === 'opp' ? h * Math.cos(th * Math.PI / 180) : h * Math.sin(th * Math.PI / 180);
        return { q: 'A right triangle has hypotenuse ' + h + ' cm and an angle of ' + th + '°. Find the side ' + (want === 'opp' ? 'opposite' : 'adjacent to') + ' that angle, in cm, to 1 decimal place.', ans: A.approx(v, 1, { deg: true }), pic: { type: 'righttri', c: h, th, ask: want },
          steps: [{ t: want === 'opp' ? 'Opposite and hypotenuse: use sine.' : 'Adjacent and hypotenuse: use cosine.', m: want === 'opp' ? 'x = ' + h + ' sin(' + th + '°)' : 'x = ' + h + ' cos(' + th + '°)' }, { m: 'x ≈ ' + v.toFixed(1) }],
          hints: ['Which two sides are involved?', want === 'opp' ? 'sin = opposite / hypotenuse.' : 'cos = adjacent / hypotenuse.', 'Multiply ' + h + ' by ' + (want === 'opp' ? 'sin' : 'cos') + '(' + th + '°). Make sure your calculator is in degrees.'],
          mistakes: [{ spec: A.approx(other, 1, { deg: true }), id: 'wrong-fn', msg: 'That used ' + (want === 'opp' ? 'cosine' : 'sine') + '. For the ' + (want === 'opp' ? 'opposite' : 'adjacent') + ' side with the hypotenuse, use ' + (want === 'opp' ? 'sine' : 'cosine') + '.' }, { spec: A.approx(h * (want === 'opp' ? Math.sin(th) : Math.cos(th)), 1, { deg: true }), id: 'radians', msg: 'Your calculator seems to be in radians. Switch it to degrees.' }].filter(z => Math.abs(z.spec.v - v) > 0.1) };
      } },
    { id: 'trig-angle', strand: 'Trigonometry', title: 'Find an angle with inverse trig', lv: [1, 3], grade: '10-11', focus: 'using tan⁻¹, sin⁻¹ or cos⁻¹',
      gen(r, L) { return { o: r.int(2, L.span(10, 40)), a: r.int(2, L.span(10, 40)) }; },
      make({ o, a }, L) {
        const v = Math.atan(o / a) * 180 / Math.PI;
        return { q: 'A right triangle has legs ' + o + ' (opposite θ) and ' + a + ' (adjacent to θ). Find θ in degrees to 1 decimal place.', ans: A.approx(v, 1), pic: { type: 'righttri', a, b: o, theta: true, ask: 'θ' },
          steps: [{ t: 'Opposite and adjacent: use tangent.', m: 'tan θ = ' + o + '/' + a }, { m: 'θ = tan^-1(' + o + '/' + a + ') ≈ ' + v.toFixed(1) + '°' }],
          hints: ['Which ratio uses opposite and adjacent?', 'tan θ = ' + o + '/' + a + '.', 'Use the inverse: θ = tan⁻¹(' + o + '/' + a + ').'],
          mistakes: [{ spec: A.approx(90 - v, 1), id: 'other-angle', msg: 'That is the other acute angle. Opposite goes on top: tan θ = ' + o + '/' + a + '.' }, { spec: A.approx(Math.atan(o / a), 1), id: 'radians', msg: 'That is the angle in radians. Switch your calculator to degrees.' }].filter(z => Math.abs(z.spec.v - v) > 0.1) };
      } },
  ]);
})();
