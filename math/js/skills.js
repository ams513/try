/* Stark Math.
   Skill registry, the level system (Kid, Teen, Adult, University, Professor x gentle / standard / challenge)
   and the helpers every problem generator uses. A skill is { id, subject, strand, title, lv:[min,max], gen(r, L), make(p, L) }.
   gen draws parameters from the seeded RNG; make turns parameters into the problem, answer spec, steps, hint ladder
   and known mistakes. Tests rebuild every answer from the same parameters with an independent checker in the test suite. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;
  const { Q, rng } = SM;

  SM.LEVELS = [
    { id: 'kid', name: 'Kid', ages: 'about 5 to 10', blurb: 'Pictures, small numbers and plain words.' },
    { id: 'teen', name: 'Teen', ages: '11 to 17', blurb: 'School maths and science, step by step.' },
    { id: 'adult', name: 'Adult', ages: 'grown-ups', blurb: 'Refresh and go further, with real-world numbers.' },
    { id: 'uni', name: 'University', ages: 'college', blurb: 'Formal notation, general methods and harder problems.' },
    { id: 'pro', name: 'Professor', ages: 'expert', blurb: 'Rigorous derivations, proofs and demanding problems.' },
  ];
  SM.DIFFS = [{ id: 'gentle', name: 'Gentle' }, { id: 'standard', name: 'Standard' }, { id: 'challenge', name: 'Challenge' }];
  SM.PRESETS = [
    { id: 'k2', name: 'Grades K to 2', lv: 0, df: 0 }, { id: 'g35', name: 'Grades 3 to 5', lv: 0, df: 2 },
    { id: 'g68', name: 'Grades 6 to 8', lv: 1, df: 0 }, { id: 'g910', name: 'Grades 9 to 10', lv: 1, df: 1 },
    { id: 'g1112', name: 'Grades 11 to 12', lv: 1, df: 2 }, { id: 'adult', name: 'Adult refresher', lv: 2, df: 1 },
    { id: 'college', name: 'College / university', lv: 3, df: 1 }, { id: 'grad', name: 'Graduate / expert', lv: 4, df: 1 },
  ];
  SM.SUBJECTS = [
    { id: 'math', name: 'Mathematics' }, { id: 'words', name: 'Word problems' }, { id: 'physics', name: 'Physics' }, { id: 'chem', name: 'Chemistry' }, { id: 'calc', name: 'Calculus' },
    { id: 'linalg', name: 'Linear algebra' }, { id: 'stats', name: 'Probability & statistics' }, { id: 'cs', name: 'Computer science' }, { id: 'eng', name: 'Engineering basics' },
  ];
  const TIER = ['kid', 'std', 'std', 'adv', 'adv'];

  /** Level context for one skill: t runs 0..1 across the skill's own level range (and difficulty). */
  function ctx(skill, lv, df) {
    const [lo, hi] = skill.lv; const L = Math.max(lo, Math.min(hi, lv)); df = Math.max(0, Math.min(2, df === undefined ? 1 : df));
    const span = (hi - lo) * 3 + 2, t = span ? ((L - lo) * 3 + df) / span : 0.5;
    return {
      lv: L, df, t, tier: TIER[L], kid: L === 0, adv: L >= 3, pro: L === 4, asked: lv,
      /** Geometric interpolation from a (easiest) to b (hardest), rounded. */
      span: (a, b) => Math.max(Math.min(a, b), Math.round(a * Math.pow(b / a, t))),
      lin: (a, b) => a + (b - a) * t,
      /** Pick by stage: arr[k] where k grows with t. */
      stage: arr => arr[Math.min(arr.length - 1, Math.floor(t * arr.length))],
      say: (kid, std, adv) => (L === 0 ? kid : L >= 3 && adv !== undefined ? adv : std),
    };
  }
  SM.ctx = ctx;

  const SKILLS = SM.SKILLS = [];
  const BY = SM.SKILL = {};
  SM.addSkills = function (subject, list) { list.forEach(s => { s.subject = s.subject || subject; if (BY[s.id]) throw new Error('duplicate skill ' + s.id); BY[s.id] = s; SKILLS.push(s); }); };
  SM.inRange = (s, lv) => lv >= s.lv[0] && lv <= s.lv[1];

  /** Build one problem. seed is any string; same seed + level gives the same problem everywhere. */
  SM.generate = function (id, lv, df, seed) {
    const s = BY[id]; if (!s) throw new Error('unknown skill ' + id);
    const L = ctx(s, lv, df), r = rng(id + '|' + L.lv + '|' + L.df + '|' + seed);
    const p = s.gen(r, L);
    const pr = s.make(p, L);
    pr.skill = id; pr.p = p; pr.seed = String(seed); pr.lv = L.lv; pr.df = L.df;
    // drop "mistakes" that happen to equal the right answer for these numbers
    pr.mistakes = (pr.mistakes || []).filter(mm => { const ms = Object.assign({}, pr.ans, mm.spec || { v: mm.v }); delete ms.text; try { return !SM.check(pr.ans, SM.answerText(ms)).ok; } catch (e) { return false; } });
    pr.hints = pr.hints || [];
    pr.steps = pr.steps || [];
    return pr;
  };
  /** Worked example: a fixed, friendly instance of the skill at this level. */
  SM.example = (id, lv, df) => SM.generate(id, lv, df === undefined ? 0 : df, 'example');

  /* ---------- text helpers used by generators ---------- */
  const H = SM.H = {
    m: x => '$' + x + '$',
    /** Number for math markup, parenthesised if negative. */
    pn: n => (String(n)[0] === '-' ? '(' + n + ')' : String(n)),
    qs: (n, d) => new Q(n, d).toString(),
    /** Polynomial text from [[coef, monomial], ...]: [[1,'x^2'],[-3,'x'],[2,'']] -> "x^2 - 3x + 2" */
    poly(terms) {
      let out = '';
      terms.forEach(([c, mono]) => {
        c = Q.of(c); if (c.isZero()) return;
        const neg = c.sign() < 0, a = c.abs(), body = mono ? (a.eq(1) ? mono : (a.isInt() ? a.toString() : '(' + a.toString() + ')') + mono) : a.toString();
        out += out ? (neg ? ' - ' : ' + ') + body : (neg ? '-' : '') + body;
      });
      return out || '0';
    },
    /** "ax + b" style linear text. */
    lin: (a, b, v) => H.poly([[a, v || 'x'], [b, '']]),
    plural: (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's')),
    list: arr => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]),
    ord: n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'),
    num: n => (Math.abs(n) >= 10000 ? n.toLocaleString('en-US') : String(n)),
    sf: (x, sf) => SM.fmtSF(x, sf),
    /** Quantity display for problem text, e.g. qty(9.81, 3, 'm/s²'). */
    qty: (x, sf, unit) => SM.fmtSF(x, sf) + (unit ? ' ' + unit : ''),
  };
  /* answer spec builders */
  SM.A = {
    num: (v, o) => Object.assign({ k: 'num', v: String(v) }, o || {}),
    approx: (v, dp, o) => Object.assign({ k: 'approx', v, dp }, o || {}),
    qty: (v, dims, sf, unit, o) => Object.assign({ k: 'qty', v, d: dims, sf, unit }, o || {}),
    expr: (v, o) => Object.assign({ k: 'expr', v: String(v) }, o || {}),
    eqn: (v, o) => Object.assign({ k: 'eqn', v }, o || {}),
    set: (v, o) => Object.assign({ k: 'set', v: v.map(x => (o && o.dp !== undefined && typeof x === 'number' ? x : String(x))) }, o || {}),
    pair: (a, b, names) => ({ k: 'pair', v: [String(a), String(b)], names: names || ['x', 'y'] }),
    ineq: (v, op, val) => ({ k: 'ineq', var: v, op, v: String(val) }),
    ratio: arr => ({ k: 'ratio', v: arr }),
    choice: (options, v) => ({ k: 'choice', options, v }),
    text: (v, norm, o) => Object.assign({ k: 'text', v: [].concat(v), norm }, o || {}),
    matrix: rows => ({ k: 'matrix', v: rows.map(r => r.map(String)) }),
  };
  /** Mistake entry: wrong value + what it reveals. */
  SM.mk = (v, id, msg, spec) => (spec ? { spec, id, msg } : { v: String(v), id, msg });
})();
