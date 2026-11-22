/* Stark Math. Reading support: the same explanation at three reading levels, separate from the maths level.
   Plain words swaps hard words for everyday ones, explains maths words in brackets the first time they appear and
   splits long sentences. Detailed adds a "Words to know" line with definitions. Maths ($...$) is never changed.
   Written rules, not an AI. Pure (no DOM). */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;
  const MODES = [{ id: 'plain', name: 'Plain words' }, { id: 'standard', name: 'Standard' }, { id: 'detailed', name: 'Detailed (with key words)' }];

  /* Everyday swaps (whole words, case kept). */
  const SWAP = [['calculate', 'work out'], ['calculates', 'works out'], ['compute', 'work out'], ['evaluate', 'work out'], ['determine', 'find'], ['obtain', 'get'], ['therefore', 'so'], ['hence', 'so'],
    ['thus', 'so'], ['consequently', 'so'], ['approximately', 'about'], ['sufficient', 'enough'], ['require', 'need'], ['requires', 'needs'], ['subsequently', 'then'], ['utilise', 'use'], ['utilize', 'use'],
    ['in order to', 'to'], ['equivalent to', 'equal to'], ['corresponding', 'matching'], ['respectively', 'in that order'], ['consider', 'look at'], ['initial', 'starting'],
    ['additional', 'extra'], ['identical', 'the same'], ['magnitude', 'size'], ['indicates', 'shows'], ['demonstrate', 'show'], ['eliminate', 'get rid of']];
  /* Maths words: plain meaning (shown in brackets in Plain words) and a definition (Detailed). */
  const TERMS = {
    numerator: ['top number', 'the top number of a fraction: how many parts you have'],
    denominator: ['bottom number', 'the bottom number of a fraction: how many equal parts make a whole'],
    coefficient: ['number in front of the letter', 'the number multiplying a letter, like the 3 in 3x'],
    integer: ['whole number, positive or negative', 'a whole number such as -2, 0 or 7 (no fractions or decimals)'],
    quotient: ['answer to a division', 'the result of dividing one number by another'],
    remainder: ['amount left over', 'what is left over when a number does not divide exactly'],
    variable: ['letter that stands for a number', 'a letter, like x, that stands for a number we do not know yet'],
    expression: ['maths phrase', 'numbers and letters joined by + − × ÷, with no equals sign'],
    equation: ['maths sentence with an equals sign', 'a statement that two expressions are equal'],
    inequality: ['comparison like < or >', 'a statement that one amount is bigger or smaller than another'],
    perimeter: ['distance around the edge', 'the total length around the outside of a shape'],
    area: ['space inside a flat shape', 'how much flat space a shape covers, in square units'],
    volume: ['space inside a solid', 'how much space a solid takes up, in cubic units'],
    ratio: ['comparison of amounts', 'a way to compare amounts, like 2:3'],
    percentage: ['out of 100', 'a number of parts out of 100'],
    exponent: ['small raised number', 'the small raised number that says how many times to multiply, like the 2 in 5²'],
    hypotenuse: ['longest side', 'the longest side of a right-angled triangle, opposite the right angle'],
    gradient: ['steepness', 'how steep a line is: how much it goes up for each step across'],
    slope: ['steepness', 'how steep a line is: rise divided by run'],
    median: ['middle value', 'the middle value when the data are in order'],
    probability: ['chance', 'how likely something is, from 0 (impossible) to 1 (certain)'],
    acceleration: ['how fast speed changes', 'the change in velocity each second'],
    velocity: ['speed in a direction', 'speed together with the direction of motion'],
    displacement: ['distance in a direction', 'how far something ends up from where it started, with a direction'],
    momentum: ['mass times velocity', 'how hard it is to stop a moving object: mass × velocity'],
  };
  const wordRe = w => new RegExp('\\b' + w.replace(/ /g, '\\s+') + '\\b', 'gi');
  const keepCase = (src, rep) => (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase() ? rep[0].toUpperCase() + rep.slice(1) : rep);
  /** Split text into prose and maths ($...$) segments. */
  const segs = text => String(text).split(/((?<!\\)\$[^$]*\$)/); // "\$" is a literal dollar sign
  const isMath = s => s.length > 1 && s[0] === '$' && s[s.length - 1] === '$';

  /** Words in sentences, counting maths segments as one word. */
  function sentences(text) {
    const flat = segs(text).map(s => (isMath(s) ? ' M ' : s)).join('');
    return flat.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean).map(s => s.split(/\s+/).filter(w => /\w/.test(w)).length);
  }
  const longest = text => Math.max(0, ...sentences(text));
  /** Terms used in a text (lower case, in order of appearance). */
  function termsIn(text) {
    const prose = segs(text).filter(s => !isMath(s)).join(' ').toLowerCase(), found = [];
    Object.keys(TERMS).forEach(t => { const m = prose.search(new RegExp('\\b' + t + 's?\\b')); if (m >= 0) found.push([m, t]); });
    return found.sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  /** Break a sentence longer than `max` words at "; ", ", so " or ", which ". */
  function splitLong(s, max) {
    if (s.split(/\s+/).length <= max) return s;
    return s.replace(/;\s+(\w)/g, (m, c) => '. ' + c.toUpperCase()).replace(/,\s+so\s+(\w)/g, (m, c) => '. So ' + c).replace(/,\s+which\s+/g, '. This ');
  }
  /**
   * Adjust one explanation. mode: 'plain' | 'standard' | 'detailed'. seen: optional Set of terms already explained
   * (so a term is bracketed only the first time on a screen).
   */
  function adjust(text, mode, seen) {
    if (!text || mode === 'standard' || !MODES.some(m => m.id === mode)) return text;
    if (mode === 'detailed') {
      const ts = termsIn(text).filter(t => !(seen && seen.has(t)));
      ts.forEach(t => seen && seen.add(t));
      return ts.length ? text + ' (Words to know: ' + ts.map(t => t + ': ' + TERMS[t][1]).join('; ') + '.)' : text;
    }
    const used = seen || new Set();
    const out = segs(text).map(seg => {
      if (isMath(seg)) return seg;
      let s = seg;
      SWAP.forEach(([w, rep]) => { s = s.replace(wordRe(w), m => keepCase(m, rep)); });
      Object.keys(TERMS).forEach(t => {
        if (used.has(t)) return;
        const re = new RegExp('\\b(' + t + 's?)\\b(?!\\s*\\()', 'i'), m = s.match(re);
        if (m) { s = s.replace(re, m[1] + ' (' + TERMS[t][0] + ')'); used.add(t); }
      });
      return s;
    }).join('');
    return out.split(/(?<=[.!?])\s+/).map(x => splitLong(x, 18)).join(' ');
  }
  /** A rough reading grade (Flesch-Kincaid) for prose only; maths segments are skipped. */
  function grade(text) {
    const prose = segs(text).filter(s => !isMath(s)).join(' '), words = prose.split(/\s+/).filter(w => /[a-z]/i.test(w));
    if (!words.length) return 0;
    const syl = w => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1); };
    const sents = Math.max(1, (prose.match(/[.!?](\s|$)/g) || []).length), sy = words.reduce((a, w) => a + syl(w), 0);
    return +(0.39 * words.length / sents + 11.8 * sy / words.length - 15.59).toFixed(1);
  }
  const mathOf = text => segs(text).filter(isMath);
  SM.reading = { MODES, SWAP, TERMS, adjust, termsIn, grade, sentences, longest, mathOf };
})();
