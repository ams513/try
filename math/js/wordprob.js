/* Stark Math. Word-problem builder: teachers and parents write their own story with number slots, give each slot a
   range and write the answer as a formula. Every variant is worked out exactly by the app's maths engine, so the
   answer check is as strict as the built-in skills. Sets can be shared as files. Pure (no DOM). */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;
  const FORMAT = 'stark-math-wordsets', MAX_SETS = 100, VAR = /^[a-h]$/;
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clip = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').slice(0, n);

  /** Slot letters used in the story text, e.g. "{a} apples and {b} pears" -> ['a', 'b']. */
  const slotsIn = text => [...new Set((String(text).match(/\{([a-h])\}/g) || []).map(x => x[1]))].sort();
  /** Returns '' when the set is usable, else a reason. */
  function validate(t) {
    if (!isObj(t)) return 'not a word problem';
    if (typeof t.title !== 'string' || !t.title.trim() || t.title.length > 80) return 'give it a title (up to 80 characters)';
    if (typeof t.text !== 'string' || t.text.trim().length < 10 || t.text.length > 600) return 'write the story (10 to 600 characters)';
    if (!isObj(t.vars)) return 'number slots are missing';
    const names = Object.keys(t.vars);
    if (!names.length || names.length > 6) return 'use between 1 and 6 number slots';
    for (const k of names) {
      const v = t.vars[k];
      if (!VAR.test(k)) return 'slot names are single letters a to h';
      if (!isObj(v) || ![v.lo, v.hi, v.step].every(x => typeof x === 'number' && isFinite(x))) return 'slot {' + k + '} needs numbers for from, to and step';
      if (v.lo > v.hi || v.step <= 0 || Math.abs(v.lo) > 1e6 || Math.abs(v.hi) > 1e6 || (v.hi - v.lo) / v.step > 1e5) return 'slot {' + k + '} has an unusable range';
      if (decs(v.lo) > 2 || decs(v.hi) > 2 || decs(v.step) > 2) return 'slot {' + k + '} can use at most 2 decimal places';
    }
    const used = slotsIn(t.text); if (used.some(k => !names.includes(k))) return 'the story uses a slot with no range: {' + used.find(k => !names.includes(k)) + '}';
    if (typeof t.formula !== 'string' || !t.formula.trim() || t.formula.length > 120) return 'write the answer formula';
    if (!/^[a-h0-9+\-*/^(). ]+$/.test(t.formula)) return 'the formula may use the slot letters, numbers, + - * / ^ and brackets';
    const fv = [...new Set(t.formula.match(/[a-h]/g) || [])]; if (fv.some(k => !names.includes(k))) return 'the formula uses a letter with no slot: ' + fv.find(k => !names.includes(k));
    if (t.unit !== undefined && (typeof t.unit !== 'string' || t.unit.length > 30)) return 'the unit is too long';
    return '';
  }
  const decs = x => { const s = String(x); const i = s.indexOf('.'); return i < 0 || /e/i.test(s) ? 0 : s.length - i - 1; };
  /** Exact value of a number written with at most 2 decimals. */
  const qOf = x => { const d = Math.pow(10, decs(x)); return new SM.Q(Math.round(x * d), d); };
  const show = q => q.toDecimal ? (q.toDecimal() || q.toString()) : String(q);

  /** One variant: { q, value (exact text), shown, sub, formula, unit, vals } or { error }. */
  function instance(t, seed) {
    const bad = validate(t); if (bad) return { error: bad };
    const r = SM.rng('wp|' + t.title + '|' + seed), names = Object.keys(t.vars).sort();
    for (let tries = 0; tries < 200; tries++) {
      const vals = {};
      names.forEach(k => { const v = t.vars[k], lo = qOf(v.lo), st = qOf(v.step), n = Math.floor((v.hi - v.lo) / v.step + 1e-9); vals[k] = lo.add(st.mul(r.int(0, n))); });
      const sub = t.formula.replace(/[a-h]/g, k => '(' + vals[k].toString() + ')');
      let val; try { val = SM.evalNum(SM.parse(sub)); } catch (e) { continue; }
      if (!val.isRational()) continue;
      const c = val.c;
      if (t.whole && !c.isInt()) continue;
      if (t.positive && c.sign() < 0) continue;
      const nm = SM.WORD_NAMES || ['Sam', 'Alex'], i1 = r.int(0, nm.length - 1), i2 = (i1 + 1 + r.int(0, nm.length - 2)) % nm.length;
      const q = t.text.replace(/\{([a-h])\}/g, (m, k) => show(vals[k])).replace(/\{name\}/g, nm[i1]).replace(/\{name2\}/g, nm[i2]);
      const shown = show(c);
      return { q, value: c.toString(), shown, unit: t.unit || '', vals: Object.fromEntries(names.map(k => [k, show(vals[k])])), sub: t.formula.replace(/[a-h]/g, k => show(vals[k])), formula: t.formula };
    }
    return { error: 'No numbers in these ranges give ' + (t.whole ? 'a whole-number ' : '') + (t.positive ? 'positive ' : '') + 'answer. Widen the ranges or change the formula.' };
  }
  /** Check a typed answer for a variant. A trailing unit word is allowed. */
  function checkAnswer(inst, input) {
    let s = String(input || '').trim();
    if (inst.unit) s = s.replace(new RegExp('\\s*' + inst.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i'), '');
    s = s.replace(/^[$€£¥₹]\s*/, '');
    return SM.check(SM.A.num(inst.value), s);
  }
  /** Worked solution steps for a variant. */
  const steps = inst => [{ t: 'Understand: the story gives ' + Object.keys(inst.vals).map(k => inst.vals[k]).join(', ') + '.' }, { t: 'Plan: the answer is ' + inst.formula + ' (with the story\'s numbers).' }, { t: 'Solve:', m: inst.sub + ' = ' + inst.shown }, { t: 'Check: does ' + inst.shown + (inst.unit ? ' ' + inst.unit : '') + ' make sense in the story?' }];

  /** A clean copy keeping only known fields. */
  function clean(t) {
    const vars = {}; Object.keys(t.vars || {}).forEach(k => { const v = t.vars[k]; vars[k] = { lo: +v.lo, hi: +v.hi, step: +v.step }; });
    return { id: String(t.id || 'w' + SM.sha256(String(t.title) + '|' + String(t.text)).slice(0, 10)).replace(/[^\w-]/g, '').slice(0, 40) || 'w', title: clip(t.title, 80).trim(), text: clip(t.text, 600), vars, formula: clip(t.formula, 120), unit: clip(t.unit || '', 30), whole: !!t.whole, positive: !!t.positive };
  }
  function toFile(sets) { return { format: FORMAT, version: 1, sets: sets.map(clean) }; }
  /** Parse a shared file. Returns { ok, sets } or { ok: false, error }. */
  function fromFile(text) {
    if (typeof text !== 'string' || text.length > 400000) return { ok: false, error: 'That file is too large.' };
    let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not valid JSON.' }; }
    if (!isObj(o) || o.format !== FORMAT || o.version !== 1 || !Array.isArray(o.sets)) return { ok: false, error: 'That is not a Stark Math word-problem file.' };
    if (SM.safe && SM.safe.deepIssue(o)) return { ok: false, error: 'The file is not valid (' + SM.safe.deepIssue(o) + ').' };
    if (!o.sets.length || o.sets.length > MAX_SETS) return { ok: false, error: 'The file has an unexpected number of problems.' };
    for (const t of o.sets) { const e = validate(t); if (e) return { ok: false, error: 'A problem in the file is not valid: ' + e + '.' }; }
    return { ok: true, sets: o.sets.map(clean) };
  }
  const EXAMPLE = { title: 'Garden rows', text: '{name} plants {a} rows of tomatoes with {b} plants in each row. Slugs eat {c} plants. How many plants are left?', vars: { a: { lo: 3, hi: 9, step: 1 }, b: { lo: 4, hi: 12, step: 1 }, c: { lo: 1, hi: 9, step: 1 } }, formula: 'a*b - c', unit: 'plants', whole: true, positive: true };
  SM.wordsets = { FORMAT, MAX_SETS, slotsIn, validate, instance, checkAnswer, steps, clean, toFile, fromFile, EXAMPLE };
})();
