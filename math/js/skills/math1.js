/* Stark Math. Mathematics generators, part 1: arithmetic, place value, fractions, decimals,
   percentages, ratios, integers, order of operations, pre-algebra, linear equations, inequalities and systems. */
(function () {
  'use strict';
  const SM = (typeof window !== 'undefined' ? window : globalThis).SM;
  const { Q, H, A, mk, gcd, lcm } = SM;
  const { m, pn, qs, poly } = H;
  const digits = n => String(n).split('').map(Number);
  /** Column addition without carrying (each column mod 10): the classic "forgot to carry" answer. */
  function noCarry(a, b) { const A1 = digits(a).reverse(), B1 = digits(b).reverse(); let out = 0; for (let i = 0; i < Math.max(A1.length, B1.length); i++) out += (((A1[i] || 0) + (B1[i] || 0)) % 10) * Math.pow(10, i); return out; }
  /** Column subtraction taking the smaller digit from the larger: the classic "no borrowing" answer. */
  function noBorrow(a, b) { const A1 = digits(a).reverse(), B1 = digits(b).reverse(); let out = 0; for (let i = 0; i < A1.length; i++) out += Math.abs((A1[i] || 0) - (B1[i] || 0)) * Math.pow(10, i); return out; }
  const frac = (n, d) => n + '/' + d;

  SM.addSkills('math', [
    /* ---------------- arithmetic and place value ---------------- */
    { id: 'add', strand: 'Arithmetic & place value', title: 'Addition', lv: [0, 2], grade: 'K-4', focus: 'adding column by column',
      gen(r, L) { const hi = L.span(9, 9999); return { a: r.int(1, hi), b: r.int(1, hi) }; },
      make({ a, b }, L) {
        const s = a + b, carry = noCarry(a, b) !== s;
        return { q: L.say('What is ' + m(a + ' + ' + b) + '?', 'Add: ' + m(a + ' + ' + b)), ans: A.num(s),
          pic: L.kid && s <= 20 ? { type: 'dots', groups: [a, b] } : null,
          steps: a + b <= 20 ? [{ t: L.say('Start at ' + Math.max(a, b) + ' and count on ' + Math.min(a, b) + ' more.', 'Count on from the larger number.'), m: a + ' + ' + b + ' = ' + s }]
            : [{ t: 'Line the numbers up by place value: ones under ones, tens under tens.' }, { t: 'Add each column from the right' + (carry ? ', carrying a 1 to the next column whenever a column makes 10 or more.' : '.') }, { m: a + ' + ' + b + ' = ' + s }],
          hints: [L.say('Can you start with the bigger number and count on?', 'Which column do you add first?'), carry ? 'One of the columns adds up to 10 or more, so carry a 1 into the next column.' : 'Add the ones, then the tens, then the hundreds.', 'The ones column gives ' + ((a % 10 + b % 10) % 10) + (a % 10 + b % 10 >= 10 ? ', carry 1.' : '.')],
          mistakes: carry ? [mk(noCarry(a, b), 'no-carry', 'It looks like a carry was missed. When a column adds up to 10 or more, write the ones digit and carry the 1 to the next column.')] : [] };
      } },
    { id: 'sub', strand: 'Arithmetic & place value', title: 'Subtraction', lv: [0, 2], grade: 'K-4', focus: 'regrouping when a digit is too small',
      gen(r, L) { const hi = L.span(10, 9999); const a = r.int(2, hi); return { a, b: r.int(1, a - 1) }; },
      make({ a, b }, L) {
        const d = a - b, nb = noBorrow(a, b);
        return { q: L.say('What is ' + m(a + ' - ' + b) + '?', 'Subtract: ' + m(a + ' - ' + b)), ans: A.num(d),
          pic: L.kid && a <= 20 ? { type: 'dots', groups: [a], cross: b } : null,
          steps: [{ t: 'Line up the places. Work from the ones column to the left.' }, { t: nb !== d ? 'When the top digit is smaller, borrow 10 from the next column.' : 'Each top digit is big enough, so no borrowing is needed.' }, { m: a + ' - ' + b + ' = ' + d }],
          hints: [L.say('Can you count back from ' + a + '?', 'Start with the ones column.'), 'If the top digit is smaller than the bottom digit, borrow 1 ten from the column to its left.', 'Check: ' + d + ' + ' + b + ' should give ' + a + '.'],
          mistakes: nb !== d ? [mk(nb, 'no-borrow', 'It looks like the smaller digit was taken from the larger one in a column. When the top digit is smaller, borrow 10 from the next column instead.')] : [] };
      } },
    { id: 'mult-facts', strand: 'Arithmetic & place value', title: 'Times tables', lv: [0, 1], grade: '2-4', focus: 'knowing your times tables',
      gen(r, L) { const hi = L.span(5, 12); return { a: r.int(2, hi), b: r.int(2, hi) }; },
      make({ a, b }, L) {
        return { q: 'What is ' + m(a + ' × ' + b) + '?', ans: A.num(a * b), pic: L.kid && a * b <= 40 ? { type: 'array', rows: a, cols: b } : null,
          steps: [{ t: L.say(a + ' rows of ' + b + ' make ' + a * b + ' in all.', a + ' groups of ' + b + '.'), m: a + ' × ' + b + ' = ' + a * b }],
          hints: ['Multiplying means equal groups. How many groups, and how many in each?', 'Skip count by ' + b + ', ' + a + ' times.', 'Start: ' + [1, 2, 3].map(k => k * b).join(', ') + ', ...'],
          mistakes: [mk(a + b, 'added', 'That is ' + a + ' + ' + b + '. Multiplying means ' + a + ' groups of ' + b + ', not adding the two numbers.')] };
      } },
    { id: 'mult', strand: 'Arithmetic & place value', title: 'Multi-digit multiplication', lv: [0, 2], grade: '4-5', focus: 'multiplying by tens and ones separately',
      gen(r, L) { return { a: r.int(12, L.span(30, 999)), b: r.int(11, L.span(19, 99)) }; },
      make({ a, b }, L) {
        const t = Math.floor(b / 10) * 10, o = b % 10, wrong = a * o + a * Math.floor(b / 10);
        return { q: 'Multiply: ' + m(a + ' × ' + b), ans: A.num(a * b),
          steps: [{ t: 'Split ' + b + ' into ' + t + ' + ' + o + '.' }, { m: a + ' × ' + o + ' = ' + a * o }, { m: a + ' × ' + t + ' = ' + a * t }, { t: 'Add the two parts.', m: a * o + ' + ' + a * t + ' = ' + a * b }],
          hints: ['Break the second number into tens and ones.', 'Work out ' + a + ' × ' + o + ' and ' + a + ' × ' + t + ' separately.', a + ' × ' + o + ' = ' + a * o + '. Now do ' + a + ' × ' + t + '.'],
          mistakes: o ? [mk(wrong, 'no-zero', 'It looks like the tens part was multiplied by ' + Math.floor(b / 10) + ' instead of ' + t + '. In the second row, put a 0 in the ones place first.')] : [] };
      } },
    { id: 'div', strand: 'Arithmetic & place value', title: 'Division with remainders', lv: [0, 2], grade: '3-5', focus: 'checking with multiplication',
      gen(r, L) { const d = r.int(2, L.span(5, 12)), qq = r.int(2, L.span(9, 250)); const rem = L.t < 0.2 ? 0 : r.int(0, d - 1); return { n: d * qq + rem, d }; },
      make({ n, d }, L) {
        const qq = Math.floor(n / d), rem = n % d;
        return { q: rem || L.t >= 0.2 ? 'Divide ' + m(n + ' ÷ ' + d) + '. Give the quotient and the remainder (for example ' + m('5 R 2') + ').' : 'What is ' + m(n + ' ÷ ' + d) + '?',
          ans: rem || L.t >= 0.2 ? A.pair(qq, rem, ['q', 'r']) : A.num(qq), pic: L.kid && n <= 30 ? { type: 'share', n, d } : null,
          steps: [{ t: 'How many times does ' + d + ' fit into ' + n + '?', m: d + ' × ' + qq + ' = ' + d * qq }, { t: 'What is left over is the remainder.', m: n + ' - ' + d * qq + ' = ' + rem }, { t: 'Check: ' + d + ' × ' + qq + ' + ' + rem + ' = ' + n + '.' }],
          hints: ['Think of the ' + d + ' times table.', 'Find the biggest multiple of ' + d + ' that is not more than ' + n + '.', d + ' × ' + qq + ' = ' + d * qq + '. How much is left?'],
          mistakes: rem ? [mk(null, 'rem-big', 'The remainder must be smaller than ' + d + '. If it is not, ' + d + ' fits in one more time.', { k: 'pair', v: [String(qq - 1), String(rem + d)], names: ['q', 'r'] })] : [] };
      } },
    { id: 'place-value', strand: 'Arithmetic & place value', title: 'Place value', lv: [0, 1], grade: '1-4', focus: 'reading the value of a digit from its place',
      gen(r, L) { const len = L.span(2, 7); let n; do { n = r.int(Math.pow(10, len - 1), Math.pow(10, len) - 1); } while (new Set(String(n)).size < len); return { n, pos: r.int(0, len - 1) }; },
      make({ n, pos }, L) {
        const s = String(n), dg = +s[s.length - 1 - pos], names = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions'];
        return { q: 'What is the value of the digit ' + dg + ' in ' + H.num(n) + '?', ans: A.num(dg * Math.pow(10, pos)), pic: L.kid ? { type: 'places', n, pos } : null,
          steps: [{ t: 'The ' + dg + ' is in the ' + names[pos] + ' place.' }, { m: dg + ' × ' + Math.pow(10, pos) + ' = ' + dg * Math.pow(10, pos) }],
          hints: ['Count the places from the right: ones, tens, hundreds...', 'The ' + dg + ' is in the ' + names[pos] + ' place.', 'So it is worth ' + dg + ' ' + names[pos] + '.'],
          mistakes: pos ? [mk(dg, 'digit', 'That is the digit itself. Its value depends on its place: here it is worth ' + dg + ' ' + names[pos] + '.')] : [] };
      } },
    { id: 'round', strand: 'Arithmetic & place value', title: 'Rounding', lv: [0, 1], grade: '3-4', focus: 'looking at the digit to the right',
      gen(r, L) { const place = L.stage([10, 10, 100, 1000]); return { n: r.int(place + 1, L.span(99, 99999)), place }; },
      make({ n, place }, L) {
        const down = Math.floor(n / place) * place, up = down + place, ans = n - down >= place / 2 ? up : down, nm = { 10: 'ten', 100: 'hundred', 1000: 'thousand' }[place];
        return { q: 'Round ' + H.num(n) + ' to the nearest ' + nm + '.', ans: A.num(ans), pic: L.kid ? { type: 'numline', from: down, to: up, mark: n } : null,
          steps: [{ t: H.num(n) + ' is between ' + H.num(down) + ' and ' + H.num(up) + '.' }, { t: 'Look at the digit to the right of the ' + nm + 's place: ' + (Math.floor((n % place) / (place / 10))) + '. ' + (ans === up ? '5 or more rounds up.' : 'Less than 5 rounds down.') }, { m: n + ' ≈ ' + ans }],
          hints: ['Which two multiples of ' + place + ' is ' + n + ' between?', 'It is between ' + down + ' and ' + up + '. Which is closer?', 'The deciding digit is ' + Math.floor((n % place) / (place / 10)) + '.'],
          mistakes: ans === up ? [mk(down, 'trunc', 'That rounds down. The digit after the ' + nm + 's place is 5 or more, so round up.')] : [mk(up, 'up', 'That rounds up. The digit after the ' + nm + 's place is less than 5, so round down.')] };
      } },

    /* ---------------- fractions ---------------- */
    { id: 'frac-equiv', strand: 'Fractions', title: 'Equivalent fractions', lv: [0, 2], grade: '3-4', focus: 'multiplying top and bottom by the same number',
      gen(r, L) { const b = r.int(2, L.span(5, 12)); let a = r.int(1, b - 1); while (gcd(a, b) !== 1) a = r.int(1, b - 1); return { a, b, k: r.int(2, L.span(3, 9)) }; },
      make({ a, b, k }, L) {
        return { q: 'Fill in the missing number: ' + m(frac(a, b) + ' = ?/' + b * k), ans: A.num(a * k), pic: L.kid ? { type: 'bars', fracs: [[a, b], [a * k, b * k]] } : null,
          steps: [{ t: 'The bottom went from ' + b + ' to ' + b * k + ', so it was multiplied by ' + k + '.' }, { t: 'Multiply the top by the same number.', m: a + ' × ' + k + ' = ' + a * k }],
          hints: ['What did the denominator get multiplied by?', b + ' × ' + k + ' = ' + b * k + '.', 'Multiply ' + a + ' by ' + k + ' too.'],
          mistakes: [mk(a + b * k - b, 'added', 'It looks like the same amount was added to the top as to the bottom. Equivalent fractions multiply top and bottom by the same number.')] };
      } },
    { id: 'frac-simplify', strand: 'Fractions', title: 'Simplify fractions', lv: [0, 2], grade: '4-6', focus: 'dividing by the greatest common factor',
      gen(r, L) { const b = r.int(2, L.span(6, 15)); let a = r.int(1, b - 1); while (gcd(a, b) !== 1) a = r.int(1, b - 1); return { a, b, k: r.int(2, L.span(3, 12)) }; },
      make({ a, b, k }, L) {
        const n = a * k, d = b * k;
        return { q: 'Write ' + m(frac(n, d)) + ' in lowest terms.', ans: A.num(qs(a, b), { lowest: true, frac: true }), pic: L.kid ? { type: 'bars', fracs: [[n, d], [a, b]] } : null,
          steps: [{ t: 'Find the greatest common factor of ' + n + ' and ' + d + ': it is ' + k + '.' }, { t: 'Divide top and bottom by ' + k + '.', m: frac(n, d) + ' = ' + frac(a, b) }],
          hints: ['What is the biggest number that divides both ' + n + ' and ' + d + '?', 'Both divide by ' + k + '.', n + ' ÷ ' + k + ' = ' + a + '.'],
          mistakes: [] };
      } },
    { id: 'frac-compare', strand: 'Fractions', title: 'Compare fractions', lv: [0, 1], grade: '3-5', focus: 'comparing with a common denominator',
      gen(r, L) { const hi = L.span(6, 12); let a, b, c, d; do { b = r.int(2, hi); d = r.int(2, hi); a = r.int(1, b - 1); c = r.int(1, d - 1); } while (b === d || a * d === b * c); return { a, b, c, d }; },
      make({ a, b, c, d }, L) {
        const v = a * d > c * b ? 0 : 1, l = lcm(b, d);
        return { q: 'Which is bigger: ' + m(frac(a, b)) + ' or ' + m(frac(c, d)) + '?', ans: A.choice([frac(a, b), frac(c, d)], v), pic: L.kid ? { type: 'bars', fracs: [[a, b], [c, d]] } : null,
          steps: [{ t: 'Rewrite both with denominator ' + l + '.', m: frac(a, b) + ' = ' + frac(a * l / b, l) + ',  ' + frac(c, d) + ' = ' + frac(c * l / d, l) }, { t: 'Compare the tops: ' + (v ? frac(c, d) : frac(a, b)) + ' is bigger.' }],
          hints: ['You can only compare the tops when the bottoms match.', 'Use the common denominator ' + l + '.', frac(a, b) + ' = ' + frac(a * l / b, l) + '.'],
          mistakes: (b > d) === (v === 0) ? [] : [{ spec: A.choice([frac(a, b), frac(c, d)], 1 - v), id: 'bigger-den', msg: 'A bigger denominator means smaller pieces, not a bigger fraction. Compare using a common denominator.' }] };
      } },
    { id: 'frac-add-like', strand: 'Fractions', title: 'Add fractions with like denominators', lv: [0, 1], grade: '3-4', focus: 'adding the tops and keeping the bottom',
      gen(r, L) { const d = r.int(3, L.span(6, 12)); const a = r.int(1, d - 2); return { a, b: r.int(1, d - 1 - a + (L.t > 0.5 ? d - 1 : 0)), d }; },
      make({ a, b, d }, L) {
        return { q: 'Add: ' + m(frac(a, d) + ' + ' + frac(b, d)), ans: A.num(qs(a + b, d)), pic: L.kid ? { type: 'bars', fracs: [[a, d], [b, d]] } : null,
          steps: [{ t: 'The pieces are the same size (' + H.ord(d) + 's), so add how many pieces there are.', m: frac(a, d) + ' + ' + frac(b, d) + ' = ' + frac(a + b, d) }].concat(gcd(a + b, d) > 1 || a + b > d ? [{ t: 'Simplify.', m: frac(a + b, d) + ' = ' + qs(a + b, d) }] : []),
          hints: ['Are the pieces the same size?', 'Keep the denominator ' + d + ' and add the numerators.', a + ' + ' + b + ' = ' + (a + b) + '.'],
          mistakes: [mk(qs(a + b, 2 * d), 'add-den', 'It looks like the denominators were added too. The bottom number says the size of the pieces, and that does not change when you add.')] };
      } },
    { id: 'frac-add', strand: 'Fractions', title: 'Add fractions with unlike denominators', lv: [0, 3], grade: '4-6', focus: 'finding a common denominator before adding',
      gen(r, L) { const hi = L.span(5, 16); let b, d, a, c; do { b = r.int(2, hi); d = r.int(2, hi); a = r.int(1, L.t > 0.6 ? 2 * b : b - 1); c = r.int(1, L.t > 0.6 ? 2 * d : d - 1); } while (b === d || gcd(a, b) !== 1 || gcd(c, d) !== 1); return { a, b, c, d }; },
      make({ a, b, c, d }, L) {
        const l = lcm(b, d), A1 = a * l / b, C1 = c * l / d, s = qs(a * d + c * b, b * d);
        return { q: 'Add: ' + m(frac(a, b) + ' + ' + frac(c, d)), ans: A.num(s), pic: L.kid ? { type: 'bars', fracs: [[a, b], [c, d]] } : null,
          steps: [{ t: 'The denominators are different, so find a common denominator. The least common multiple of ' + b + ' and ' + d + ' is ' + l + '.' }, { m: frac(a, b) + ' = ' + frac(A1, l) + ',  ' + frac(c, d) + ' = ' + frac(C1, l) }, { t: 'Add the numerators.', m: frac(A1, l) + ' + ' + frac(C1, l) + ' = ' + frac(A1 + C1, l) }].concat(frac(A1 + C1, l) !== s ? [{ t: 'Simplify.', m: frac(A1 + C1, l) + ' = ' + s }] : []),
          hints: [L.say('Are the pieces the same size? What size could both become?', 'What must be true about the denominators before you can add?'), 'Use the common denominator ' + l + '.', 'Rewrite: ' + frac(a, b) + ' = ' + frac(A1, l) + ' and ' + frac(c, d) + ' = ' + frac(C1, l) + '. Now add the numerators.'],
          mistakes: [mk(qs(a + c, b + d), 'add-den', 'It looks like the tops and the bottoms were both added. The denominator gives the size of the pieces, so first rewrite both fractions with the same denominator, then add only the numerators.'),
            mk(qs(a + c, b * d), 'mult-den-only', 'The denominators were multiplied but the numerators were not changed to match. When you change a denominator, multiply its numerator by the same number.'),
            mk(qs(a + c, l), 'no-scale', 'The common denominator ' + l + ' is right, but the numerators need scaling too: multiply each numerator by the same number as its denominator.')] };
      } },
    { id: 'frac-sub', strand: 'Fractions', title: 'Subtract fractions', lv: [0, 3], grade: '4-6', focus: 'rewriting with a common denominator',
      gen(r, L) { const hi = L.span(5, 16); let b, d, a, c; do { b = r.int(2, hi); d = r.int(2, hi); a = r.int(1, b - 1); c = r.int(1, d - 1); } while (b === d || gcd(a, b) !== 1 || gcd(c, d) !== 1 || (L.t < 0.6 && a * d <= c * b)); return { a, b, c, d }; },
      make({ a, b, c, d }, L) {
        const l = lcm(b, d), A1 = a * l / b, C1 = c * l / d, s = qs(a * d - c * b, b * d);
        return { q: 'Subtract: ' + m(frac(a, b) + ' - ' + frac(c, d)), ans: A.num(s), pic: L.kid ? { type: 'bars', fracs: [[a, b], [c, d]] } : null,
          steps: [{ t: 'Common denominator: ' + l + '.', m: frac(a, b) + ' = ' + frac(A1, l) + ',  ' + frac(c, d) + ' = ' + frac(C1, l) }, { t: 'Subtract the numerators.', m: frac(A1, l) + ' - ' + frac(C1, l) + ' = ' + qs(A1 - C1, l) }],
          hints: ['Same denominators first.', 'Use ' + l + ' as the denominator.', frac(a, b) + ' = ' + frac(A1, l) + ' and ' + frac(c, d) + ' = ' + frac(C1, l) + '.'],
          mistakes: b - d !== 0 ? [mk(qs(a - c, b - d), 'sub-den', 'It looks like the denominators were subtracted too. Rewrite with a common denominator, then subtract only the numerators.'), mk(qs(a - c, l), 'no-scale', 'Right common denominator, but each numerator must be multiplied by the same number as its denominator.')] : [] };
      } },
    { id: 'frac-mult', strand: 'Fractions', title: 'Multiply fractions', lv: [0, 3], grade: '5-6', focus: 'multiplying tops and bottoms',
      gen(r, L) { const hi = L.span(5, 15); return { a: r.int(1, hi), b: r.int(2, hi), c: r.int(1, hi), d: r.int(2, hi) }; },
      make({ a, b, c, d }, L) {
        const s = qs(a * c, b * d);
        return { q: 'Multiply: ' + m(frac(a, b) + ' × ' + frac(c, d)), ans: A.num(s), pic: L.kid && a < b && c < d ? { type: 'area', fracs: [[a, b], [c, d]] } : null,
          steps: [{ t: 'Multiply the numerators and multiply the denominators.', m: frac(a, b) + ' × ' + frac(c, d) + ' = ' + frac(a * c, b * d) }].concat(frac(a * c, b * d) !== s ? [{ t: 'Simplify.', m: frac(a * c, b * d) + ' = ' + s }] : []),
          hints: ['Do you need a common denominator to multiply? (You do not.)', 'Top times top, bottom times bottom.', a + ' × ' + c + ' = ' + a * c + '.'],
          mistakes: a * d * b * c && qs(a * d, b * c) !== s ? [mk(qs(a * d, b * c), 'cross', 'That looks like cross-multiplying, which is a method for dividing or comparing. To multiply, go straight across: top times top, bottom times bottom.')] : [] };
      } },
    { id: 'frac-div', strand: 'Fractions', title: 'Divide fractions', lv: [0, 3], grade: '6-7', focus: 'multiplying by the reciprocal',
      gen(r, L) { const hi = L.span(5, 15); return { a: r.int(1, hi), b: r.int(2, hi), c: r.int(1, hi), d: r.int(2, hi) }; },
      make({ a, b, c, d }, L) {
        const s = qs(a * d, b * c);
        return { q: 'Divide: ' + m(frac(a, b) + ' ÷ ' + frac(c, d)), ans: A.num(s),
          steps: [{ t: 'Dividing by a fraction is the same as multiplying by its reciprocal (flip the second fraction).', m: frac(a, b) + ' ÷ ' + frac(c, d) + ' = ' + frac(a, b) + ' × ' + frac(d, c) }, { m: '= ' + frac(a * d, b * c) + (frac(a * d, b * c) !== s ? ' = ' + s : '') }],
          hints: ['What is the reciprocal of ' + frac(c, d) + '?', 'Keep the first fraction, change ÷ to ×, flip the second.', frac(a, b) + ' × ' + frac(d, c) + '.'],
          mistakes: [qs(a * c, b * d) !== s ? mk(qs(a * c, b * d), 'no-flip', 'That multiplies straight across without flipping. To divide, multiply by the reciprocal of the second fraction.') : null, qs(b * c, a * d) !== s ? mk(qs(b * c, a * d), 'flip-first', 'The first fraction was flipped instead of the second. Keep the first one and flip the one you divide by.') : null].filter(Boolean) };
      } },
    { id: 'mixed', strand: 'Fractions', title: 'Mixed numbers to improper fractions', lv: [0, 2], grade: '4-5', focus: 'whole times denominator, plus the numerator',
      gen(r, L) { const d = r.int(2, L.span(5, 12)); let n = r.int(1, d - 1); while (gcd(n, d) !== 1) n = r.int(1, d - 1); return { w: r.int(1, L.span(4, 15)), n, d }; },
      make({ w, n, d }, L) {
        return { q: 'Write ' + m(w + ' ' + frac(n, d)) + ' as an improper fraction.', ans: A.num(qs(w * d + n, d), { frac: true, improper: true }), pic: L.kid && w <= 3 ? { type: 'bars', fracs: Array(w).fill([d, d]).concat([[n, d]]) } : null,
          steps: [{ t: 'Each whole is ' + frac(d, d) + ', so ' + w + ' wholes are ' + frac(w * d, d) + '.' }, { t: 'Add the ' + frac(n, d) + '.', m: frac(w * d, d) + ' + ' + frac(n, d) + ' = ' + frac(w * d + n, d) }],
          hints: ['How many ' + H.ord(d) + 's are in one whole?', 'Multiply the whole number by the denominator: ' + w + ' × ' + d + '.', w + ' × ' + d + ' = ' + w * d + '. Now add ' + n + '.'],
          mistakes: [mk(qs(w + n, d), 'add-whole', 'It looks like the whole number was added to the numerator. Each whole is ' + d + ' pieces, so multiply ' + w + ' × ' + d + ' first.'), mk(qs(w * n + d, d), 'swap', 'Close, but the multiplication is whole × denominator, then add the numerator: ' + w + ' × ' + d + ' + ' + n + '.')] };
      } },

    /* ---------------- decimals ---------------- */
    { id: 'dec-add', strand: 'Decimals', title: 'Add decimals', lv: [0, 2], grade: '4-6', focus: 'lining up the decimal points',
      gen(r, L) { const da = r.int(1, 2), db = da === 1 ? 2 : r.int(1, 3); return { a: r.int(1, L.span(9, 999)) * Math.pow(10, -da), b: r.int(1, L.span(99, 9999)) * Math.pow(10, -db), da, db }; },
      make(p, L) {
        const a = Q.parseDecimal(p.a.toFixed(p.da)), b = Q.parseDecimal(p.b.toFixed(p.db)), s = a.add(b), dp = Math.max(p.da, p.db);
        const ai = Math.round(p.a * Math.pow(10, p.da)), bi = Math.round(p.b * Math.pow(10, p.db)), wrong = new Q(ai + bi, Math.pow(10, dp));
        return { q: 'Add: ' + m(p.a.toFixed(p.da) + ' + ' + p.b.toFixed(p.db)), ans: A.num(s.toString()),
          steps: [{ t: 'Line up the decimal points. Fill empty places with zeros.', m: p.a.toFixed(dp) + ' + ' + p.b.toFixed(dp) }, { t: 'Add like whole numbers and keep the point in line.', m: '= ' + s.toDecimal() }],
          hints: ['Where do the decimal points go when you stack the numbers?', 'Write both with ' + dp + ' decimal places: ' + p.a.toFixed(dp) + ' and ' + p.b.toFixed(dp) + '.', 'Now add as if there were no points, then put the point back ' + dp + ' places from the right.'],
          mistakes: !wrong.eq(s) ? [mk(wrong.toString(), 'align', 'It looks like the digits were lined up from the right instead of at the decimal point. Tenths must line up with tenths.')] : [] };
      } },
    { id: 'dec-mult', strand: 'Decimals', title: 'Multiply decimals', lv: [0, 2], grade: '5-6', focus: 'counting decimal places',
      gen(r, L) { return { ai: r.int(2, L.span(9, 99)), da: r.int(1, 2), bi: r.int(2, L.span(9, 99)), db: r.int(1, 2) }; },
      make({ ai, da, bi, db }, L) {
        const a = new Q(ai, Math.pow(10, da)), b = new Q(bi, Math.pow(10, db)), s = a.mul(b);
        return { q: 'Multiply: ' + m(a.toDecimal() + ' × ' + b.toDecimal()), ans: A.num(s.toString()),
          steps: [{ t: 'Multiply as whole numbers.', m: ai + ' × ' + bi + ' = ' + ai * bi }, { t: 'Count decimal places: ' + da + ' + ' + db + ' = ' + (da + db) + '. Put the point that many places from the right.', m: '= ' + s.toDecimal() }],
          hints: ['Ignore the decimal points for a moment.', ai + ' × ' + bi + ' = ' + ai * bi + '.', 'The answer needs ' + (da + db) + ' decimal places.'],
          mistakes: da !== db || true ? [mk(new Q(ai * bi, Math.pow(10, Math.max(da, db))).toString(), 'dp', 'The digits are right, but the decimal point is misplaced. Add the decimal places of both numbers: ' + da + ' + ' + db + ' = ' + (da + db) + '.')].filter(x => x.v !== s.toString()) : [] };
      } },
    { id: 'dec-div', strand: 'Decimals', title: 'Divide decimals', lv: [0, 2], grade: '5-6', focus: 'making the divisor a whole number',
      gen(r, L) { const bi = r.int(2, L.span(9, 49)), db = r.int(1, 2), qi = r.int(2, L.span(20, 400)), dq = r.int(0, 1); return { bi, db, qi, dq }; },
      make({ bi, db, qi, dq }, L) {
        const b = new Q(bi, Math.pow(10, db)), qv = new Q(qi, Math.pow(10, dq)), a = b.mul(qv), k = Math.pow(10, db);
        return { q: 'Divide: ' + m(a.toDecimal() + ' ÷ ' + b.toDecimal()), ans: A.num(qv.toString()),
          steps: [{ t: 'Multiply both numbers by ' + k + ' so the divisor is a whole number.', m: a.toDecimal() + ' ÷ ' + b.toDecimal() + ' = ' + a.mul(k).toDecimal() + ' ÷ ' + bi }, { m: '= ' + qv.toDecimal() }],
          hints: ['Dividing is easier when the divisor is a whole number.', 'Multiply both by ' + k + '.', 'Now work out ' + a.mul(k).toDecimal() + ' ÷ ' + bi + '.'],
          mistakes: [] };
      } },
    { id: 'frac-dec', strand: 'Decimals', title: 'Fractions to decimals', lv: [0, 2], grade: '4-6', focus: 'dividing the top by the bottom',
      gen(r, L) { const d = r.pick(L.stage([[2, 4, 5, 10], [2, 4, 5, 8, 10, 20, 25], [8, 16, 20, 25, 40, 50, 125]])); let n = r.int(1, L.t > 0.6 ? 3 * d : d - 1); return { n, d }; },
      make({ n, d }, L) {
        const v = new Q(n, d);
        return { q: 'Write ' + m(frac(n, d)) + ' as a decimal.', ans: A.num(v.toString(), { dec: true }), pic: L.kid ? { type: 'bars', fracs: [[n, d]] } : null,
          steps: [{ t: 'A fraction is a division: top ÷ bottom.', m: n + ' ÷ ' + d + ' = ' + v.toDecimal() }],
          hints: ['What does the fraction bar mean?', 'Divide ' + n + ' by ' + d + '.', 'Or make the denominator 10, 100 or 1000 first.'],
          mistakes: [mk(Q.parseDecimal(n + '.' + d).toString(), 'concat', 'That writes the two numbers next to each other. A fraction means top divided by bottom: ' + n + ' ÷ ' + d + '.')].filter(x => !Q.of(x.v).eq(v)) };
      } },

    /* ---------------- percentages ---------------- */
    { id: 'pct-of', strand: 'Percentages', title: 'Percent of a number', lv: [0, 2], grade: '6-7', focus: 'turning the percent into a fraction of 100',
      gen(r, L) { const p = r.pick(L.stage([[10, 50, 25], [10, 20, 25, 50, 75], [5, 15, 30, 35, 40, 60, 12.5, 2.5]])); return { p, n: r.int(1, L.span(10, 200)) * 4 * (p === 12.5 || p === 2.5 ? 10 : 1) }; },
      make({ p, n }, L) {
        const v = Q.of(p).mul(n).div(100);
        return { q: 'What is ' + p + '% of ' + n + '?', ans: A.num(v.toString()), pic: L.kid ? { type: 'hundred', pct: p } : null,
          steps: [{ t: 'Percent means "out of 100".', m: p + '% = ' + p + '/100' }, { m: p + '/100 × ' + n + ' = ' + (v.toDecimal() || v.toString()) }],
          hints: ['What fraction is ' + p + '%?', 'Find 1% first: ' + n + ' ÷ 100 = ' + Q.of(n).div(100).toDecimal() + '.', 'Then multiply by ' + p + '.'],
          mistakes: [mk(Q.of(p).mul(n).toString(), 'no-100', 'That is ' + p + ' × ' + n + '. Remember to divide by 100, because percent means out of 100.'), mk(Q.of(n).div(p).mul(100).toString(), 'flip', 'It looks like the division went the wrong way. Multiply ' + n + ' by ' + p + '/100.')].filter(x => !Q.of(x.v).eq(v)) };
      } },
    { id: 'pct-change', strand: 'Percentages', title: 'Percent change', lv: [1, 3], grade: '7-8', focus: 'dividing the change by the original amount',
      gen(r, L) { const o = r.pick([20, 25, 40, 50, 80, 120, 200, 250, 400, 500, 800]), p = r.pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]) * r.sign(); return { o, nw: o + o * p / 100 }; },
      make({ o, nw }, L) {
        const ch = nw - o, pc = Q.of(ch).div(o).mul(100).abs(), word = ch > 0 ? 'increase' : 'decrease';
        return { q: 'A price changes from $' + o + ' to $' + nw + '. What is the percent ' + word + '?', ans: A.num(pc.toString(), { pct: true }),
          steps: [{ t: 'Change: ' + nw + ' - ' + o + ' = ' + ch + '.' }, { t: 'Divide by the original amount, then multiply by 100.', m: Math.abs(ch) + '/' + o + ' × 100 = ' + pc + '%' }],
          hints: ['How much did it change by?', 'Percent change compares the change with the original value, $' + o + '.', Math.abs(ch) + ' ÷ ' + o + ' = ' + Q.of(Math.abs(ch)).div(o).toDecimal() + '.'],
          mistakes: [mk(Q.of(Math.abs(ch)).div(nw).mul(100).toString(), 'new-base', 'That divides by the new price. Percent change is measured against the original price, $' + o + '.')].filter(x => !Q.of(x.v).eq(pc)) };
      } },
    { id: 'pct-convert', strand: 'Percentages', title: 'Fractions and decimals as percents', lv: [0, 2], grade: '6-7', focus: 'multiplying by 100',
      gen(r, L) { const d = r.pick([2, 4, 5, 10, 20, 25, 50, 8]); return { n: r.int(1, L.t > 0.6 ? 2 * d : d - 1), d, asDec: r.chance(0.5) ? 1 : 0 }; },
      make({ n, d, asDec }, L) {
        const v = new Q(n, d), pc = v.mul(100), shown = asDec ? v.toDecimal() : frac(n, d);
        return { q: 'Write ' + m(shown) + ' as a percent.', ans: A.num(pc.toString(), { pct: true, text: pc.toString() + '%' }),
          steps: [{ t: 'Multiply by 100 to get a percent.', m: shown + ' × 100 = ' + (pc.toDecimal() || pc) + '%' }],
          hints: ['Percent means per hundred.', 'Multiply by 100.', asDec ? 'Move the decimal point two places to the right.' : 'What is ' + frac(n, d) + ' with denominator 100?'],
          mistakes: asDec ? [mk(v.toString(), 'no-x100', 'That is the decimal itself. To turn it into a percent, multiply by 100.', { k: 'num', v: v.toString() })].filter(x => !v.eq(pc)) : [] };
      } },
    { id: 'pct-reverse', strand: 'Percentages', title: 'Reverse percentages', lv: [1, 3], grade: '8-10', focus: 'dividing by the multiplier',
      gen(r, L) { const p = r.pick([10, 20, 25, 50, 5, 15, 40]), up = r.chance(0.6) ? 1 : -1; let o = r.int(2, 40) * 20; return { o, p, up }; },
      make({ o, p, up }, L) {
        const mult = Q.of(100 + up * p).div(100), nw = mult.mul(o);
        return { q: 'After a ' + p + '% ' + (up > 0 ? 'increase' : 'discount') + ', an item costs $' + (nw.toDecimal()) + '. What was the original price in dollars?', ans: A.num(o),
          steps: [{ t: 'The new price is ' + (100 + up * p) + '% of the original.', m: 'original × ' + mult.toDecimal() + ' = ' + nw.toDecimal() }, { t: 'Divide by the multiplier.', m: nw.toDecimal() + ' ÷ ' + mult.toDecimal() + ' = ' + o }],
          hints: ['The new price is what percent of the original?', 'It is ' + (100 + up * p) + '% of the original, a multiplier of ' + mult.toDecimal() + '.', 'Divide $' + nw.toDecimal() + ' by ' + mult.toDecimal() + '.'],
          mistakes: [mk(nw.mul(Q.of(100 - up * p).div(100)).toString(), 'apply-again', 'That takes ' + p + '% of the new price. The ' + p + '% was worked out on the original price, so divide by ' + mult.toDecimal() + ' instead.')] };
      } },

    /* ---------------- ratios ---------------- */
    { id: 'ratio-simplify', strand: 'Ratios & proportion', title: 'Simplify ratios', lv: [0, 2], grade: '6', focus: 'dividing both parts by the same factor',
      gen(r, L) { let a, b; do { a = r.int(1, L.span(6, 15)); b = r.int(1, L.span(6, 15)); } while (gcd(a, b) !== 1 || a === b); return { a, b, k: r.int(2, L.span(4, 12)) }; },
      make({ a, b, k }, L) {
        return { q: 'Simplify the ratio ' + m(a * k + ':' + b * k) + '.', ans: A.ratio([a, b]),
          steps: [{ t: 'Both numbers divide by ' + k + '.', m: a * k + ':' + b * k + ' = ' + a + ':' + b }],
          hints: ['What is the greatest common factor of ' + a * k + ' and ' + b * k + '?', 'It is ' + k + '.', 'Divide both parts by ' + k + '.'], mistakes: [] };
      } },
    { id: 'unit-rate', strand: 'Ratios & proportion', title: 'Unit rates', lv: [0, 2], grade: '6-7', focus: 'dividing to find the amount for one',
      gen(r, L) { return { n: r.int(2, L.span(5, 24)), c: r.int(1, L.span(20, 400)) * 5 }; },
      make({ n, c }, L) {
        const per = new Q(c, n * 100);
        return { q: n + ' notebooks cost $' + (c / 100).toFixed(2) + '. How much does one notebook cost in dollars?', ans: A.num(per.toString(), { dp: 2 }),
          steps: [{ t: 'Divide the total cost by the number of notebooks.', m: (c / 100).toFixed(2) + ' ÷ ' + n + ' = ' + (per.toDecimal() || SM.roundDP(per.toFloat(), 4)) }].concat(per.toDecimal() ? [] : [{ t: 'Round to the nearest cent: $' + per.toFloat().toFixed(2) + '.' }]),
          hints: ['You want the cost for one.', 'Divide the total by ' + n + '.', '$' + (c / 100).toFixed(2) + ' ÷ ' + n + '.'],
          mistakes: [] };
      } },
    { id: 'proportion', strand: 'Ratios & proportion', title: 'Solve proportions', lv: [1, 3], grade: '7', focus: 'cross-multiplying',
      gen(r, L) { const b = r.int(2, L.span(6, 15)), a = r.int(1, L.span(9, 30)), k = r.int(2, L.span(4, 12)); return { a, b, c: b * k }; },
      make({ a, b, c }, L) {
        const x = Q.of(a * c).div(b);
        return { q: 'Solve for ' + m('x') + ': ' + m(frac(a, b) + ' = x/' + c), ans: A.num(x.toString()),
          steps: [{ t: 'Cross-multiply.', m: b + 'x = ' + a + ' × ' + c }, { m: 'x = ' + a * c + '/' + b + ' = ' + x }],
          hints: ['How does ' + b + ' become ' + c + '?', 'Multiply ' + b + ' by ' + c / b + ' to get ' + c + '. Do the same to the top.', a + ' × ' + c / b + '.'],
          mistakes: [mk(Q.of(b * c).div(a).toString(), 'cross-wrong', 'The cross-multiplication pairs got mixed up. Multiply diagonally: ' + b + ' × x = ' + a + ' × ' + c + '.')].filter(x2 => !Q.of(x2.v).eq(x)) };
      } },
    { id: 'ratio-share', strand: 'Ratios & proportion', title: 'Share in a ratio', lv: [0, 2], grade: '6-8', focus: 'finding the value of one part',
      gen(r, L) { let a, b; do { a = r.int(1, L.span(4, 9)); b = r.int(1, L.span(4, 9)); } while (a === b); return { a, b, k: r.int(2, L.span(5, 40)) }; },
      make({ a, b, k }, L) {
        const N = (a + b) * k, big = Math.max(a, b) * k;
        return { q: 'Share ' + N + ' sweets between Ana and Ben in the ratio ' + m(a + ':' + b) + '. How many does the one with more get?', ans: A.num(big),
          steps: [{ t: 'Total parts: ' + a + ' + ' + b + ' = ' + (a + b) + '.' }, { t: 'One part is ' + N + ' ÷ ' + (a + b) + ' = ' + k + '.' }, { t: 'The bigger share is ' + Math.max(a, b) + ' parts.', m: Math.max(a, b) + ' × ' + k + ' = ' + big }],
          hints: ['How many parts are there altogether?', (a + b) + ' parts. What is one part worth?', 'One part is ' + k + '.'],
          mistakes: [mk(Q.of(N).mul(Math.max(a, b)).div(Math.min(a, b)).toString(), 'part-ratio', 'That multiplies by ' + Math.max(a, b) + '/' + Math.min(a, b) + '. Divide by the total number of parts (' + (a + b) + ') to find one part first.')].filter(x => !Q.of(x.v).eq(big)) };
      } },

    /* ---------------- integers ---------------- */
    { id: 'int-add', strand: 'Integers', title: 'Add integers', lv: [0, 2], grade: '6-7', focus: 'thinking on the number line',
      gen(r, L) { const hi = L.span(10, 200); let a, b; do { a = r.nz(-hi, hi); b = r.nz(-hi, hi); } while (a > 0 && b > 0); return { a, b }; },
      make({ a, b }, L) {
        const s = a + b;
        return { q: 'Work out ' + m(a + ' + ' + pn(b)), ans: A.num(s), pic: L.lv <= 1 && Math.abs(a) <= 12 && Math.abs(s) <= 12 ? { type: 'numline', from: Math.min(0, a, s) - 1, to: Math.max(0, a, s) + 1, jump: [a, s] } : null,
          steps: [{ t: Math.sign(a) === Math.sign(b) ? 'Same signs: add the sizes and keep the sign.' : 'Different signs: subtract the sizes and keep the sign of the larger size.', m: a + ' + ' + pn(b) + ' = ' + s }],
          hints: ['Picture a number line: start at ' + a + '.', b < 0 ? 'Adding ' + b + ' means moving ' + -b + ' to the left.' : 'Adding ' + b + ' means moving ' + b + ' to the right.', 'Start at ' + a + ' and move ' + Math.abs(b) + ' ' + (b < 0 ? 'left' : 'right') + '.'],
          mistakes: [mk(Math.abs(a) + Math.abs(b), 'drop-signs', 'It looks like the signs were dropped. Use the number line: adding a negative moves left.'), mk(-(Math.abs(a) + Math.abs(b)), 'all-neg', 'Both sizes were added, but the signs are different, so the sizes should be subtracted.')].filter(x => +x.v !== s) };
      } },
    { id: 'int-sub', strand: 'Integers', title: 'Subtract integers', lv: [0, 2], grade: '6-7', focus: 'adding the opposite',
      gen(r, L) { const hi = L.span(10, 200); return { a: r.nz(-hi, hi), b: -r.int(1, hi) * (r.chance(0.8) ? 1 : -1) }; },
      make({ a, b }, L) {
        const s = a - b;
        return { q: 'Work out ' + m(a + ' - ' + pn(b)), ans: A.num(s),
          steps: [{ t: 'Subtracting a number is the same as adding its opposite.', m: a + ' - ' + pn(b) + ' = ' + a + ' + ' + pn(-b) }, { m: '= ' + s }],
          hints: ['What is the opposite of ' + b + '?', 'Change "subtract ' + b + '" into "add ' + -b + '".', a + ' + ' + pn(-b) + '.'],
          mistakes: [mk(a + b, 'minus-neg', 'Two minus signs together make a plus: subtracting ' + b + ' is the same as adding ' + -b + '.')].filter(x => +x.v !== s) };
      } },
    { id: 'int-muldiv', strand: 'Integers', title: 'Multiply and divide integers', lv: [1, 2], grade: '7', focus: 'the sign rules',
      gen(r, L) { const hi = L.span(6, 15); return { a: r.nz(-hi, hi), b: r.nz(-hi, hi), div: r.chance(0.5) ? 1 : 0 }; },
      make({ a, b, div }, L) {
        const P = a * b, txt = div ? P + ' ÷ ' + pn(b) : a + ' × ' + pn(b), v = div ? a : P;
        return { q: 'Work out ' + m(txt), ans: A.num(v),
          steps: [{ t: 'Signs: ' + (Math.sign(div ? P : a) === Math.sign(b) ? 'same signs give a positive.' : 'different signs give a negative.') }, { m: txt + ' = ' + v }],
          hints: ['Work out the size first, ignoring signs.', 'Then decide the sign: same signs positive, different signs negative.', 'The size is ' + Math.abs(v) + '.'], mistakes: [] };
      } },

    /* ---------------- order of operations ---------------- */
    { id: 'order-ops', strand: 'Order of operations', title: 'Order of operations', lv: [0, 3], grade: '5-7', focus: 'brackets, powers, then × and ÷, then + and -',
      gen(r, L) { const T = L.stage([[0, 1], [0, 1, 2, 3], [2, 3, 4, 5], [4, 5, 6]]); const tpl = r.pick(T), hi = L.span(5, 12); let c = r.int(2, hi), d = r.int(2, 6); return { tpl, a: r.int(2, hi * 2), b: r.int(2, hi), c, d, e: c * r.int(1, 5) }; },
      make(p, L) {
        const { tpl, a, b, c, d, e } = p;
        // [text, correct, left-to-right value]
        const T = [[a + ' + ' + b + ' × ' + c, a + b * c, (a + b) * c], [a + ' × ' + b + ' - ' + c, a * b - c, a * (b - c)], ['(' + a + ' + ' + b + ') × ' + c, (a + b) * c, a + b * c], [a + ' + ' + e + ' ÷ ' + c, a + e / c, qs(a + e, c)],
          [a + ' - ' + b + '^2 × ' + d, a - b * b * d, (a - b) * (a - b) * d], [a + ' × (' + b + ' + ' + c + ')^2 - ' + d, a * (b + c) * (b + c) - d, a * a * (b + c) * (b + c) - d], ['(' + a + ' - ' + b + ')^2 ÷ ' + pn(-1) + ' + ' + c + ' × ' + d, -(a - b) * (a - b) + c * d, (-(a - b) * (a - b) + c) * d]][tpl];
        const v = T[1], w = T[2];
        const why = ['Multiplication comes before addition.', 'Multiplication comes before subtraction.', 'Brackets come first.', 'Division comes before addition.', 'Powers first, then multiplication, then subtraction.', 'Brackets, then the power, then ×, then -.', 'Brackets, power, then ÷ and ×, then +.'][tpl];
        return { q: 'Work out ' + m(T[0]), ans: A.num(v),
          steps: [{ t: why }, { m: T[0] + ' = ' + v }],
          hints: ['Which part do you do first?', why, 'Do that part first, then the rest.'],
          mistakes: String(w) !== String(v) ? [mk(w, 'left-right', 'That works from left to right. The order is: brackets, powers, multiply and divide, then add and subtract.')].concat(tpl === 4 ? [mk(a - 2 * b * d, 'pow-double', 'b² means b × b, not 2 × b.')] : []) : [] };
      } },

    /* ---------------- pre-algebra ---------------- */
    { id: 'eval-expr', strand: 'Pre-algebra', title: 'Evaluate expressions', lv: [1, 3], grade: '6-8', focus: 'substituting carefully with brackets',
      gen(r, L) { const hi = L.span(5, 12); return { a: r.nz(-hi, hi), b: r.nz(-hi, hi), c: r.int(-hi, hi), x: r.nz(L.t > 0.3 ? -6 : 1, 6), quad: L.t > 0.35 ? 1 : 0 }; },
      make({ a, b, c, x, quad }, L) {
        const e = quad ? poly([[a, 'x^2'], [b, 'x'], [c, '']]) : poly([[a, 'x'], [b, '']]), v = quad ? a * x * x + b * x + c : a * x + b;
        return { q: 'Evaluate ' + m(e) + ' when ' + m('x = ' + x), ans: A.num(v),
          steps: [{ t: 'Replace x with (' + x + ').' }, { m: (quad ? a + '(' + x + ')^2 + ' + pn(b) + '(' + x + ') + ' + pn(c) : a + '(' + x + ') + ' + pn(b)) + ' = ' + v }],
          hints: ['Put the value in brackets wherever x appears.', quad ? 'Square first: (' + x + ')^2 = ' + x * x + '.' : 'Multiply first: ' + a + ' × ' + pn(x) + ' = ' + a * x + '.', quad ? a + ' × ' + x * x + ' = ' + a * x * x + '.' : 'Then add ' + b + '.'],
          mistakes: quad ? [mk(a * 2 * x + b * x + c, 'sq-2x', 'x² means x × x, not 2 × x.'), x < 0 ? mk(-a * x * x + b * x + c, 'neg-sq', 'A negative number squared is positive: (' + x + ')² = ' + x * x + '.') : null].filter(Boolean).filter(z => +z.v !== v) : [] };
      } },
    { id: 'like-terms', strand: 'Pre-algebra', title: 'Combine like terms', lv: [1, 3], grade: '6-8', focus: 'adding only terms with the same variable part',
      gen(r, L) { const hi = L.span(6, 15); return { a: r.nz(-hi, hi), b: r.nz(-hi, hi), c: r.nz(-hi, hi), d: r.nz(-hi, hi) }; },
      make({ a, b, c, d }, L) {
        const e = poly([[a, 'x'], [b, '']]) + (c < 0 ? ' - ' + (c === -1 ? '' : -c) + 'x' : ' + ' + (c === 1 ? '' : c) + 'x') + (d < 0 ? ' - ' + -d : ' + ' + d), ans = poly([[a + c, 'x'], [b + d, '']]);
        return { q: 'Simplify: ' + m(e), ans: A.expr(ans, { form: 'simplified' }),
          steps: [{ t: 'Group the x terms and the number terms.', m: '(' + a + ' + ' + pn(c) + ')x + (' + b + ' + ' + pn(d) + ')' }, { m: '= ' + ans }],
          hints: ['Which terms are "like" (same letter part)?', 'The x terms are ' + a + 'x and ' + c + 'x.', a + ' + ' + pn(c) + ' = ' + (a + c) + '.'],
          mistakes: [{ spec: A.expr(String(a + b + c + d) + 'x'), id: 'all', msg: 'Numbers and x terms cannot be combined: 3x + 2 is not 5x. Only add terms with the same letter part.' }] };
      } },
    { id: 'distribute', strand: 'Pre-algebra', title: 'Expand brackets', lv: [1, 3], grade: '7-8', focus: 'multiplying every term inside the bracket',
      gen(r, L) { const hi = L.span(5, 12); return { k: r.nz(-hi, hi), b: r.nz(-hi, hi), c: r.nz(-hi, hi) }; },
      make({ k, b, c }, L) {
        const ans = poly([[k * b, 'x'], [k * c, '']]);
        return { q: 'Expand: ' + m(k + '(' + poly([[b, 'x'], [c, '']]) + ')'), ans: A.expr(ans, { form: 'expanded' }),
          steps: [{ t: 'Multiply ' + k + ' by each term inside.', m: k + ' × ' + pn(b) + 'x + ' + k + ' × ' + pn(c) }, { m: '= ' + ans }],
          hints: ['How many terms are inside the bracket?', 'Multiply ' + k + ' by ' + b + 'x and by ' + c + '.', k + ' × ' + pn(b) + 'x = ' + k * b + 'x.'],
          mistakes: [{ spec: A.expr(poly([[k * b, 'x'], [c, '']])), id: 'first-only', msg: 'Only the first term was multiplied. The ' + k + ' multiplies every term inside the bracket, including ' + c + '.' }, { spec: A.expr(poly([[k * b, 'x'], [-k * c, '']])), id: 'sign', msg: 'Check the sign of the last term: ' + k + ' × ' + pn(c) + ' = ' + k * c + '.' }] };
      } },
    { id: 'one-step', strand: 'Linear equations', title: 'One-step equations', lv: [0, 2], grade: '5-7', focus: 'doing the inverse operation',
      gen(r, L) { const hi = L.span(9, 60); return { op: r.int(0, L.t > 0.3 ? 3 : 1), x: r.int(L.t > 0.5 ? -hi : 1, hi), k: r.int(2, L.span(9, 15)) }; },
      make({ op, x, k }, L) {
        const v = ['x', 'n', 'y'][0];
        const eq = [v + ' + ' + k + ' = ' + (x + k), v + ' - ' + k + ' = ' + (x - k), k + v + ' = ' + k * x, v + '/' + k + ' = ' + x][op];
        const inv = ['subtract ' + k + ' from both sides', 'add ' + k + ' to both sides', 'divide both sides by ' + k, 'multiply both sides by ' + k][op];
        const xs = op === 3 ? x * k : x;
        return { q: L.say('What number goes in the box? ' + m(eq.replace(/x/g, '?')), 'Solve: ' + m(eq)), ans: A.num(xs),
          steps: [{ t: 'To undo it, ' + inv + '.' }, { m: v + ' = ' + xs }],
          hints: ['What is being done to ' + v + '?', 'Do the opposite: ' + inv + '.', 'Check by putting your answer back in.'],
          mistakes: [mk([x + 2 * k, x - 2 * k, k * k * x, qs(x, k)][op], 'same-op', 'That does the same operation again instead of undoing it. Use the inverse: ' + inv + '.')].filter(z => +z.v !== xs) };
      } },
    { id: 'two-step', strand: 'Linear equations', title: 'Two-step equations', lv: [1, 3], grade: '7-8', focus: 'undoing addition first, then multiplication',
      gen(r, L) { const hi = L.span(6, 15); return { a: r.nz(L.t > 0.4 ? -hi : 2, hi), b: r.nz(-hi * 2, hi * 2), x: r.nz(-hi, hi) }; },
      make({ a, b, x }, L) {
        const c = a * x + b;
        return { q: 'Solve for ' + m('x') + ': ' + m(poly([[a, 'x'], [b, '']]) + ' = ' + c), ans: A.num(x),
          steps: [{ t: (b > 0 ? 'Subtract ' + b : 'Add ' + -b) + ' on both sides.', m: a + 'x = ' + (c - b) }, { t: 'Divide both sides by ' + a + '.', m: 'x = ' + x }],
          hints: ['What is the last thing done to x? Undo that first.', (b > 0 ? 'Subtract ' + b : 'Add ' + -b) + ' from both sides: ' + a + 'x = ' + (c - b) + '.', 'Now divide by ' + a + '.'],
          mistakes: [mk(Q.of(c + b).div(a).toString(), 'wrong-inverse', 'It looks like ' + b + ' was added instead of subtracted (or the other way round). Undo +' + b + ' with -' + b + '.'), mk(Q.of(c).div(a).sub(b).toString(), 'div-first', 'Dividing first is fine only if you divide every term. Undo the ' + (b > 0 ? '+' : '') + b + ' first, then divide.'), mk(Q.of(c - b).mul(a).toString(), 'mult', 'To undo multiplying by ' + a + ', divide by ' + a + '.')].filter(z => !Q.of(z.v).eq(x)) };
      } },
    { id: 'both-sides', strand: 'Linear equations', title: 'Variables on both sides', lv: [1, 3], grade: '8-9', focus: 'collecting x terms on one side',
      gen(r, L) { const hi = L.span(6, 15); let a, c; do { a = r.nz(-hi, hi); c = r.nz(-hi, hi); } while (a === c); return { a, c, b: r.int(-hi * 2, hi * 2), x: r.nz(-hi, hi) }; },
      make({ a, b, c, x }, L) {
        const d = (a - c) * x + b;
        return { q: 'Solve: ' + m(poly([[a, 'x'], [b, '']]) + ' = ' + poly([[c, 'x'], [d, '']])), ans: A.num(x),
          steps: [{ t: 'Subtract ' + c + 'x from both sides.', m: poly([[a - c, 'x'], [b, '']]) + ' = ' + d }, { t: 'Move the constant.', m: (a - c) + 'x = ' + (d - b) }, { m: 'x = ' + x }],
          hints: ['Get all the x terms on one side.', 'Subtract ' + c + 'x from both sides.', 'You should get ' + poly([[a - c, 'x'], [b, '']]) + ' = ' + d + '.'],
          mistakes: [a + c ? mk(Q.of(d - b).div(a + c).toString(), 'sign-move', 'When ' + c + 'x moves to the other side it changes sign. Subtract ' + c + 'x from both sides.') : null, mk(Q.of(d + b).div(a - c).toString(), 'const-sign', 'Check the constant: moving ' + b + ' across the equals sign changes its sign.')].filter(z => z && !Q.of(z.v).eq(x)) };
      } },
    { id: 'lin-ineq', strand: 'Linear equations', title: 'Linear inequalities', lv: [1, 3], grade: '7-9', focus: 'flipping the sign when dividing by a negative',
      gen(r, L) { const hi = L.span(6, 12); return { a: r.nz(-hi, hi), b: r.int(-hi * 2, hi * 2), x: r.int(-hi, hi), op: r.pick(['<', '>', '<=', '>=']) }; },
      make({ a, b, x, op }, L) {
        const c = a * x + b, flip = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }, fop = a < 0 ? flip[op] : op, sym = s => s.replace('<=', '≤').replace('>=', '≥');
        return { q: 'Solve: ' + m(poly([[a, 'x'], [b, '']]) + ' ' + sym(op) + ' ' + c), ans: A.ineq('x', fop, x),
          steps: [{ t: 'Move the constant.', m: a + 'x ' + sym(op) + ' ' + (c - b) }, { t: 'Divide by ' + a + (a < 0 ? '. It is negative, so the inequality sign flips.' : '.'), m: 'x ' + sym(fop) + ' ' + x }],
          hints: ['Solve it like an equation, but watch one thing.', 'You will divide by ' + a + '. Is that negative?', a < 0 ? 'Dividing by a negative flips the sign.' : 'Dividing by a positive keeps the sign.'],
          mistakes: [] };
      } },
    { id: 'systems', strand: 'Linear equations', title: 'Systems of two equations', lv: [1, 4], grade: '8-11', focus: 'eliminating one variable',
      gen(r, L) { const hi = L.span(4, 9); let a1, b1, a2, b2; do { a1 = r.nz(-hi, hi); b1 = r.nz(-hi, hi); a2 = r.nz(-hi, hi); b2 = r.nz(-hi, hi); } while (a1 * b2 - a2 * b1 === 0); return { a1, b1, a2, b2, x: r.int(-hi, hi), y: r.int(-hi, hi) }; },
      make({ a1, b1, a2, b2, x, y }, L) {
        const c1 = a1 * x + b1 * y, c2 = a2 * x + b2 * y, det = a1 * b2 - a2 * b1;
        return { q: 'Solve the system: ' + m(poly([[a1, 'x'], [b1, 'y']]) + ' = ' + c1) + ' and ' + m(poly([[a2, 'x'], [b2, 'y']]) + ' = ' + c2) + '. Give ' + m('(x, y)') + '.', ans: A.pair(x, y),
          steps: L.adv ? [{ t: 'By Cramer\'s rule, with determinant D = a₁b₂ - a₂b₁ = ' + det + ':' }, { m: 'x = (' + c1 + ' × ' + pn(b2) + ' - ' + pn(c2) + ' × ' + pn(b1) + ')/' + pn(det) + ' = ' + x }, { m: 'y = (' + a1 + ' × ' + pn(c2) + ' - ' + pn(a2) + ' × ' + pn(c1) + ')/' + pn(det) + ' = ' + y }]
            : [{ t: 'Multiply the equations so the y terms cancel: first by ' + b2 + ', second by ' + b1 + ', then subtract.', m: det + 'x = ' + (c1 * b2 - c2 * b1) }, { m: 'x = ' + x }, { t: 'Substitute back to find y.', m: 'y = ' + y }],
          hints: ['Pick a variable to eliminate.', 'Make the y coefficients match: multiply the first equation by ' + b2 + ' and the second by ' + b1 + '.', 'Subtracting gives ' + det + 'x = ' + (c1 * b2 - c2 * b1) + '.'],
          mistakes: [] };
      } },
  ]);
})();
