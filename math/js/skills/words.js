/* Stark Math. Word problems: one-step stories, equal groups, shopping and change, fractions and percentages of amounts,
   best buys and stories that need an equation. Every worked solution follows the same four steps
   (Understand, Plan, Solve, Check), so learners practise reading the story, not just the arithmetic. */
(function () {
  'use strict';
  const SM = (typeof window !== 'undefined' ? window : globalThis).SM;
  const { Q, H, A, mk } = SM;
  const { m } = H;
  const NAMES = ['Amara', 'Kenji', 'Sofia', 'Liam', 'Priya', 'Mateo', 'Zainab', 'Oliver', 'Mei', 'Noah', 'Fatima', 'Lucas', 'Aisha', 'Diego', 'Hana', 'Kwame', 'Elena', 'Ravi', 'Nadia', 'Tomas'];
  const ITEMS = ['stickers', 'marbles', 'shells', 'books', 'apples', 'stamps', 'cards', 'pencils', 'seeds', 'beads'];
  const GOODS = ['notebooks', 'pens', 'juice boxes', 'tickets', 'muffins', 'plants'];
  const BIG = ['jacket', 'bike', 'lamp', 'backpack', 'board game', 'chair'];
  const PACKS = ['granola bars', 'batteries', 'pencils', 'juice boxes', 'notebooks', 'tennis balls'];
  SM.WORD_NAMES = NAMES;
  const money = c => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));
  const dollars = c => new Q(c, 100);
  const cash = c => A.num(dollars(c).toString(), { text: money(c) });
  const two = (r, n) => { const a = r.int(0, n - 1); let b = r.int(0, n - 2); if (b >= a) b++; return [a, b]; };
  const lab = w => t => (w + ': ' + t).trim(), UND = lab('Understand'), PLN = lab('Plan'), SLV = lab('Solve'), CHK = lab('Check');

  SM.addSkills('words', [
    { id: 'wp-join', strand: 'One-step stories', title: 'Add or subtract? Story problems', lv: [0, 2], grade: 'K-3', focus: 'deciding whether a story puts together or takes away',
      gen(r, L) { const kind = r.int(0, 2), hi = L.span(10, 900); let a = r.int(2, hi), b = r.int(1, hi); if (kind && a <= b) { a = b + r.int(1, Math.max(1, Math.round(hi / 3))); } const [n1, n2] = two(r, NAMES.length); return { kind, a, b, n1, n2, it: r.int(0, ITEMS.length - 1) }; },
      make({ kind, a, b, n1, n2, it }, L) {
        const X = NAMES[n1], Y = NAMES[n2], t = ITEMS[it], ans = kind ? a - b : a + b;
        const q = [X + ' has ' + a + ' ' + t + '. ' + Y + ' gives ' + X + ' ' + b + ' more. How many ' + t + ' does ' + X + ' have now?',
          X + ' had ' + a + ' ' + t + ' and gave ' + b + ' of them to ' + Y + '. How many ' + t + ' does ' + X + ' have left?',
          X + ' has ' + a + ' ' + t + ' and ' + Y + ' has ' + b + '. How many more ' + t + ' does ' + X + ' have than ' + Y + '?'][kind];
        const plan = [L.say('Getting more means adding.', 'The story puts two amounts together, so add.'), L.say('Giving some away means taking away.', 'Some are taken away, so subtract.'), L.say('"How many more" means find the difference.', '"How many more" compares two amounts: subtract the smaller from the larger.')][kind];
        return { q, ans: A.num(ans),
          steps: [{ t: UND('we know ' + a + ' and ' + b + '; we want ' + (kind === 2 ? 'the difference.' : kind ? 'how many are left.' : 'the new total.')) }, { t: PLN(plan) }, { t: SLV(''), m: kind ? a + ' - ' + b + ' = ' + ans : a + ' + ' + b + ' = ' + ans }, { t: CHK(kind ? ans + ' + ' + b + ' = ' + a + ', so it fits.' : ans + ' is more than ' + a + ', which makes sense after getting more.') }],
          hints: ['Does the amount get bigger, get smaller, or are two amounts being compared?', plan, kind ? 'Work out ' + m(a + ' - ' + b) + '.' : 'Work out ' + m(a + ' + ' + b) + '.'],
          mistakes: kind ? [mk(a + b, 'wrong-op', kind === 2 ? '"How many more" compares two amounts, so subtract to find the difference instead of adding.' : 'That adds, but giving some away makes the amount smaller, so subtract.')]
            : a !== b ? [mk(Math.abs(a - b), 'wrong-op', 'That subtracts, but the story puts two amounts together ("gives ... more"), so add them.')] : [] };
      } },
    { id: 'wp-groups', strand: 'Equal groups', title: 'Equal groups and sharing', lv: [0, 2], grade: '3-5', focus: 'spotting equal groups and what a remainder means',
      gen(r, L) { const kind = r.int(0, 3), hi = L.span(5, 12); const k = r.int(2, hi), n = r.int(2, hi); if (kind < 2) return { kind, a: kind ? k * n : k, b: kind ? k : n, it: r.int(0, ITEMS.length - 1), n1: r.int(0, NAMES.length - 1) }; let P; do { P = r.int(n + 1, n * hi + n - 1); } while (P % n === 0); return { kind, a: P, b: n, it: r.int(0, ITEMS.length - 1), n1: r.int(0, NAMES.length - 1) }; },
      make({ kind, a, b, it, n1 }, L) {
        const t = ITEMS[it], X = NAMES[n1], fl = Math.floor(a / b), ce = Math.ceil(a / b), rem = a % b;
        if (kind === 0) return { q: 'There are ' + a + ' boxes with ' + b + ' ' + t + ' in each box. How many ' + t + ' are there altogether?', ans: A.num(a * b),
          steps: [{ t: UND(a + ' equal groups of ' + b + '.') }, { t: PLN('Equal groups means multiply.') }, { t: SLV(''), m: a + ' × ' + b + ' = ' + a * b }, { t: CHK(a * b + ' ÷ ' + a + ' = ' + b + '.') }],
          hints: ['Is every box the same size?', 'Equal groups: multiply the number of groups by the size of each group.', 'Work out ' + m(a + ' × ' + b) + '.'],
          mistakes: [mk(a + b, 'add-not-mult', 'That adds the two numbers. There are ' + a + ' groups of ' + b + ', so multiply.')] };
        if (kind === 1) return { q: X + ' shares ' + a + ' ' + t + ' equally between ' + b + ' friends. How many ' + t + ' does each friend get?', ans: A.num(a / b),
          steps: [{ t: UND(a + ' shared into ' + b + ' equal groups.') }, { t: PLN('Sharing equally means divide.') }, { t: SLV(''), m: a + ' ÷ ' + b + ' = ' + a / b }, { t: CHK(b + ' × ' + a / b + ' = ' + a + '.') }],
          hints: ['Sharing equally: is that adding, taking away, multiplying or dividing?', 'Divide the total by the number of friends.', 'Work out ' + m(a + ' ÷ ' + b) + '.'],
          mistakes: [mk(a - b, 'subtracted', 'That takes ' + b + ' away. Sharing between ' + b + ' friends means dividing by ' + b + '.'), mk(a * b, 'wrong-op', 'Sharing equally means dividing, not multiplying.')] };
        if (kind === 2) return { q: a + ' students are going on a trip. Each minibus holds ' + b + ' students. How many minibuses are needed so that everyone can go?', ans: A.num(ce),
          steps: [{ t: UND(a + ' students, ' + b + ' per minibus, and nobody can be left behind.') }, { t: PLN('Divide, then think about the remainder.') }, { t: SLV(''), m: a + ' ÷ ' + b + ' = ' + fl + ' r ' + rem }, { t: CHK(fl + ' minibuses carry ' + fl * b + ', leaving ' + rem + ', so one more is needed: ' + ce + '.') }],
          hints: ['How many full minibuses can you fill?', 'Divide ' + a + ' by ' + b + '. What happens to the students left over?', a + ' ÷ ' + b + ' = ' + fl + ' remainder ' + rem + '.'],
          mistakes: [mk(fl, 'no-round-up', 'That leaves ' + rem + ' students behind. There is a remainder, so one more minibus is needed.'), mk(new Q(a, b).toString(), 'decimal', 'You cannot order part of a minibus. Round up to a whole number.')] };
        return { q: a + ' eggs are packed into boxes of ' + b + '. How many eggs are left over after filling as many boxes as possible?', ans: A.num(rem),
          steps: [{ t: UND('boxes of ' + b + '; we want the eggs that do not fill a box.') }, { t: PLN('Divide and keep the remainder.') }, { t: SLV(''), m: a + ' ÷ ' + b + ' = ' + fl + ' r ' + rem }, { t: CHK(fl + ' × ' + b + ' + ' + rem + ' = ' + a + '.') }],
          hints: ['How many full boxes can you make?', 'Divide ' + a + ' by ' + b + ' and look at the remainder.', fl + ' boxes use ' + fl * b + ' eggs.'],
          mistakes: [mk(fl, 'quotient', 'That is the number of full boxes. The question asks for the eggs left over (the remainder).')] };
      } },
    { id: 'wp-money', strand: 'Money', title: 'Shopping and change', lv: [0, 3], grade: '3-6', focus: 'finding the total before working out the change',
      gen(r, L) {
        const q = r.int(2, L.span(3, 9)), pc = L.kid ? 100 * r.int(1, L.span(3, 9)) : 5 * r.int(5, L.span(60, 800));
        const cost = q * pc, pay = [5, 10, 20, 50, 100, 200, 500].find(n => n * 100 > cost) || 500 * Math.ceil((cost + 1) / 50000);
        return { q, pc, pay, it: r.int(0, GOODS.length - 1), n1: r.int(0, NAMES.length - 1) };
      },
      make({ q, pc, pay, it, n1 }, L) {
        const X = NAMES[n1], t = GOODS[it], cost = q * pc, ch = pay * 100 - cost;
        return { q: X + ' buys ' + q + ' ' + t + ' at \\$' + money(pc) + ' each and pays with a \\$' + pay + ' note. How much change should ' + X + ' get, in dollars?', ans: cash(ch),
          steps: [{ t: UND('we know the price of one, how many, and the money paid; we want the change.') }, { t: PLN('two steps: find the total cost, then subtract it from ' + '\\$' + pay + '.') }, { t: SLV('total cost'), m: q + ' × ' + money(pc) + ' = ' + money(cost) }, { t: SLV('change'), m: pay + ' - ' + money(cost) + ' = ' + money(ch) }, { t: CHK('\\$' + money(cost) + ' + \\$' + money(ch) + ' = \\$' + pay + '.') }],
          hints: ['Before you can find the change, what do you need to know?', 'Find the total cost first: ' + q + ' × \\$' + money(pc) + '.', 'The total is \\$' + money(cost) + '. Now subtract it from \\$' + pay + '.'],
          mistakes: [mk(dollars(cost).toString(), 'forgot-change', 'That is the total cost. The question asks for the change: subtract the cost from the money paid.'), mk(dollars(pay * 100 - pc).toString(), 'one-item', 'That takes off the price of one item only. Multiply by ' + q + ' first to get the total cost.')] };
      } },
    { id: 'wp-fraction', strand: 'Fractions and percentages of amounts', title: 'Fractions of amounts in stories', lv: [0, 2], grade: '4-6', focus: 'finding one part first',
      gen(r, L) { const b = r.int(2, L.span(4, 12)), k = r.int(2, L.span(5, 30)); let a; do { a = r.int(1, b - 1); } while (SM.gcd(a, b) !== 1); return { a, b, k, rest: r.int(0, 1), c: r.int(0, 2) }; },
      make({ a, b, k, rest, c }, L) {
        const N = b * k, part = a * k, ans = rest ? N - part : part, ctx = [['pupils in a class', 'walk to school', 'do not walk to school'], ['animals on a farm', 'are sheep', 'are not sheep'], ['books on a shelf', 'are stories', 'are not stories']][c];
        const f = m(a + '/' + b);
        return { q: 'There are ' + N + ' ' + ctx[0] + '. ' + f + ' of them ' + ctx[1] + '. How many ' + ctx[rest ? 2 : 1] + '?', ans: A.num(ans),
          steps: [{ t: UND(f + ' of ' + N + (rest ? ', and we want the rest.' : '.')) }, { t: PLN('find one part (divide by ' + b + '), then take ' + a + (a === 1 ? ' part.' : ' parts.') + (rest ? ' Then subtract from ' + N + '.' : '')) }, { t: SLV('one part'), m: N + ' ÷ ' + b + ' = ' + k }, { t: SLV(a + (a === 1 ? ' part' : ' parts')), m: k + ' × ' + a + ' = ' + part }].concat(rest ? [{ t: SLV('the rest'), m: N + ' - ' + part + ' = ' + ans }] : []).concat([{ t: CHK(b + ' parts of ' + k + ' make ' + N + ', the whole amount, so one part is right.') }]),
          hints: ['What is ' + m('1/' + b) + ' of ' + N + '?', 'One part is ' + N + ' ÷ ' + b + ' = ' + k + '.', rest ? a + ' parts are ' + part + '. How many are left from ' + N + '?' : 'Now multiply ' + k + ' by ' + a + '.'],
          mistakes: (a > 1 && !rest ? [mk(k, 'one-part', 'That is one part (' + N + ' ÷ ' + b + '). Multiply by ' + a + ' to get ' + a + '/' + b + '.')] : []).concat(rest ? [mk(part, 'other-part', 'That is how many ' + ctx[1] + '. The question asks about the rest: subtract from ' + N + '.')] : []) };
      } },
    { id: 'wp-percent', strand: 'Fractions and percentages of amounts', title: 'Discounts and service charges', lv: [1, 3], grade: '6-8', focus: 'turning the percentage into an amount first',
      gen(r, L) { const kind = r.int(0, 2), P = r.int(20, L.span(60, 900)), rate = kind === 2 ? r.pick([5, 8, 10, 12, 15, 20]) : L.stage([[10, 20, 25, 50], [5, 10, 15, 20, 25, 30, 40], [5, 12, 15, 35, 40, 45, 75]])[r.int(0, 3)]; return { kind, P, rate, it: r.int(0, BIG.length - 1) }; },
      make({ kind, P, rate, it }, L) {
        const amt = new Q(P * rate, 100), cents = P * rate, item = BIG[it];
        const val = kind === 0 ? P * 100 - cents : kind === 1 ? cents : P * 100 + cents;
        const q = kind === 0 ? 'A ' + item + ' costs \\$' + P + '. In a sale it is ' + rate + '% off. What is the sale price, in dollars?'
          : kind === 1 ? 'A ' + item + ' costs \\$' + P + '. In a sale it is ' + rate + '% off. How much money is saved, in dollars?'
            : 'A meal costs \\$' + P + '. A ' + rate + '% service charge is added. What is the total, in dollars?';
        const mis = kind === 0 ? [mk(amt.toString(), 'discount-only', 'That is the discount (the amount taken off). Subtract it from the original price to get the sale price.'), mk(P - rate, 'took-off-number', 'That subtracts ' + rate + ' dollars, not ' + rate + '% of the price.')]
          : kind === 1 ? [mk(dollars(P * 100 - cents).toString(), 'sale-price', 'That is the sale price. The question asks how much is saved: the discount itself.')]
            : [mk(amt.toString(), 'charge-only', 'That is just the service charge. Add it to the cost of the meal.'), mk(P + rate, 'added-number', 'That adds ' + rate + ' dollars, not ' + rate + '% of the cost.')];
        return { q, ans: cash(val),
          steps: [{ t: UND(rate + '% of \\$' + P + (kind === 1 ? ' is the saving.' : kind ? ' is added on.' : ' is taken off.')) }, { t: PLN('find ' + rate + '% of ' + P + ' first' + (kind === 1 ? '.' : kind ? ', then add it.' : ', then subtract it.')) }, { t: SLV(rate + '% of ' + P), m: P + ' × ' + rate + ' ÷ 100 = ' + money(cents) }]
            .concat(kind === 1 ? [] : [{ t: SLV(kind ? 'add it on' : 'take it off'), m: P + (kind ? ' + ' : ' - ') + money(cents) + ' = ' + money(val) }]).concat([{ t: CHK(kind === 2 ? 'the total is a bit more than \\$' + P + '.' : 'the answer is less than \\$' + P + '.') }]),
          hints: ['What is 10% of \\$' + P + '?', 'Find ' + rate + '% of \\$' + P + ' first: ' + P + ' × ' + rate + ' ÷ 100.', rate + '% of \\$' + P + ' is \\$' + money(cents) + '.'],
          mistakes: mis };
      } },
    { id: 'wp-rate', strand: 'Money', title: 'Best buys', lv: [1, 3], grade: '6-7', focus: 'comparing the price of one item',
      gen(r, L) { const n1 = r.int(2, 6), n2 = r.int(n1 + 1, 12), u1 = r.int(40, L.span(150, 900)); let u2; do { u2 = Math.round(u1 * (1 + r.sign() * r.int(5, 20) / 100)); } while (u2 === u1 || u2 < 10); return { n1, n2, u1, u2, it: r.int(0, PACKS.length - 1) }; },
      make({ n1, n2, u1, u2, it }, L) {
        const t = PACKS[it], c1 = n1 * u1, c2 = n2 * u2, v = u1 < u2 ? 0 : 1, opts = ['Pack A', 'Pack B'];
        return { q: t[0].toUpperCase() + t.slice(1) + ' are sold in two packs. Pack A: ' + n1 + ' for \\$' + money(c1) + '. Pack B: ' + n2 + ' for \\$' + money(c2) + '. Which pack is the better buy (cheaper for each one)?', ans: A.choice(opts, v),
          steps: [{ t: UND('the packs have different sizes, so compare the price of one item.') }, { t: PLN('divide each price by the number in the pack.') }, { t: SLV('Pack A'), m: money(c1) + ' ÷ ' + n1 + ' = ' + money(u1) }, { t: SLV('Pack B'), m: money(c2) + ' ÷ ' + n2 + ' = ' + money(u2) }, { t: CHK('\\$' + money(Math.min(u1, u2)) + ' each is cheaper, so ' + opts[v] + ' is the better buy.') }],
          hints: ['The cheaper pack is not always the better buy. Why?', 'Work out the price of one item in each pack.', 'Pack A: \\$' + money(c1) + ' ÷ ' + n1 + '.'],
          mistakes: (c1 < c2 ? 0 : 1) !== v ? [{ spec: A.choice(opts, 1 - v), id: 'cheaper-total', msg: 'That pack costs less in total, but it has fewer items. Compare the price for one item.' }] : [] };
      } },
    { id: 'wp-equation', strand: 'Stories that need an equation', title: 'Write and solve an equation', lv: [1, 3], grade: '7-9', focus: 'naming the unknown and writing an equation',
      gen(r, L) {
        const kind = r.int(0, 3), [n1, n2] = two(r, NAMES.length);
        if (kind === 0) { const x = r.int(4, L.span(12, 60)), k = r.int(2, L.span(5, 30)); return { kind, S: 2 * x + k, k, n1, n2 }; }
        if (kind === 1) { const n = r.int(3, L.span(20, 400)); return { kind, S: 3 * n + 3, n1, n2 }; }
        if (kind === 2) { const w = r.int(2, L.span(10, 80)), k = r.int(1, L.span(5, 20)); return { kind, P: 4 * w + 2 * k, k, n1, n2 }; }
        const a = r.int(6, L.span(10, 30)), c = r.int(2, a - 1), n = r.int(4, L.span(8, 40)), x = r.int(1, n - 1); return { kind, n, a, c, T: a * x + c * (n - x), n1, n2 };
      },
      make(p, L) {
        const X = NAMES[p.n1], Y = NAMES[p.n2];
        if (p.kind === 0) { const x = (p.S - p.k) / 2; return { q: X + ' is ' + p.k + ' years older than ' + Y + '. Their ages add up to ' + p.S + '. How old is ' + Y + '?', ans: A.num(x),
          steps: [{ t: UND('let ' + m('y') + ' be ' + Y + '\'s age, so ' + X + ' is ' + m('y + ' + p.k) + '.') }, { t: PLN('the two ages add up to ' + p.S + ':'), m: 'y + (y + ' + p.k + ') = ' + p.S }, { t: SLV(''), m: '2y = ' + (p.S - p.k) + ',  y = ' + x }, { t: CHK(x + ' + ' + (x + p.k) + ' = ' + p.S + '.') }],
          hints: ['Give the unknown age a letter.', 'If ' + Y + ' is y, ' + X + ' is y + ' + p.k + '. What do they add up to?', 'Solve ' + m('2y + ' + p.k + ' = ' + p.S) + '.'],
          mistakes: [mk(new Q(p.S, 2).toString(), 'split-evenly', 'Halving the total ignores the ' + p.k + '-year gap. Take the gap off first, then halve.'), mk(x + p.k, 'older-one', 'That is ' + X + '\'s age. The question asks for ' + Y + '.')] }; }
        if (p.kind === 1) { const n = (p.S - 3) / 3; return { q: 'Three consecutive whole numbers add up to ' + p.S + '. What is the smallest of them?', ans: A.num(n),
          steps: [{ t: UND('consecutive numbers go up by 1: call them ' + m('n') + ', ' + m('n + 1') + ' and ' + m('n + 2') + '.') }, { t: PLN('they add up to ' + p.S + ':'), m: 'n + (n + 1) + (n + 2) = ' + p.S }, { t: SLV(''), m: '3n + 3 = ' + p.S + ',  n = ' + n }, { t: CHK(n + ' + ' + (n + 1) + ' + ' + (n + 2) + ' = ' + p.S + '.') }],
          hints: ['Call the smallest number n. What are the next two?', 'n + (n + 1) + (n + 2) = ' + p.S + '.', 'That simplifies to 3n + 3 = ' + p.S + '.'],
          mistakes: [mk(new Q(p.S, 3).toString(), 'middle', 'That is the middle number. The smallest is one less.')] }; }
        if (p.kind === 2) { const w = (p.P - 2 * p.k) / 4; return { q: 'A rectangle is ' + p.k + ' cm longer than it is wide. Its perimeter is ' + p.P + ' cm. How wide is it, in cm?', ans: A.num(w),
          steps: [{ t: UND('let the width be ' + m('w') + ', so the length is ' + m('w + ' + p.k) + '.') }, { t: PLN('the perimeter adds all four sides:'), m: '2w + 2(w + ' + p.k + ') = ' + p.P }, { t: SLV(''), m: '4w + ' + 2 * p.k + ' = ' + p.P + ',  w = ' + w }, { t: CHK('2 × ' + w + ' + 2 × ' + (w + p.k) + ' = ' + p.P + '.') }],
          hints: ['Call the width w. What is the length?', 'Perimeter = 2 × width + 2 × length.', 'Solve ' + m('4w + ' + 2 * p.k + ' = ' + p.P) + '.'],
          mistakes: [mk(new Q(p.P, 4).toString(), 'square', 'Dividing the perimeter by 4 treats the rectangle as a square. Write the perimeter as 2w + 2(w + ' + p.k + ') first.'), mk(w + p.k, 'length', 'That is the length. The question asks for the width.')] }; }
        const x = (p.T - p.c * p.n) / (p.a - p.c);
        return { q: 'A family buys ' + p.n + ' tickets for a show, some adult and some child. Adult tickets cost \\$' + p.a + ' and child tickets cost \\$' + p.c + '. They pay \\$' + p.T + '. How many adult tickets did they buy?', ans: A.num(x),
          steps: [{ t: UND('let ' + m('a') + ' be the number of adult tickets, so ' + m(p.n + ' - a') + ' are child tickets.') }, { t: PLN('the costs add up to ' + p.T + ':'), m: p.a + 'a + ' + p.c + '(' + p.n + ' - a) = ' + p.T }, { t: SLV(''), m: (p.a - p.c) + 'a + ' + p.c * p.n + ' = ' + p.T + ',  a = ' + x }, { t: CHK(x + ' × ' + p.a + ' + ' + (p.n - x) + ' × ' + p.c + ' = ' + p.T + '.') }],
          hints: ['Call the number of adult tickets a. How many child tickets are there?', 'Adult cost + child cost = ' + p.T + '.', 'Solve ' + m(p.a + 'a + ' + p.c + '(' + p.n + ' - a) = ' + p.T) + '.'],
          mistakes: x !== p.n - x ? [mk(p.n - x, 'child', 'That is the number of child tickets. The question asks for adult tickets.')] : [] };
      } },
  ]);
})();
