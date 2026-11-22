/* Stark Math. Curriculum map: every skill gets a grade band (with age, international ISCED and England & Wales
   year equivalents) and, where we are confident, reference codes from the US maths (Common Core) and science (NGSS)
   standards. Codes only: no standard text is reproduced. These alignments are the Stark team's own mapping to help
   teachers and parents find skills; they are not official or certified. Pure data and functions (no DOM). */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SM = G.SM;

  const BANDS = [
    { id: 'k2', name: 'Grades K to 2', short: 'K-2', ages: '5 to 8', isced: 'ISCED 0-1 (early primary)', ew: 'Reception to Year 3', lv: 0, df: 0, preset: 'k2' },
    { id: 'g35', name: 'Grades 3 to 5', short: '3-5', ages: '8 to 11', isced: 'ISCED 1 (primary)', ew: 'Years 4 to 6', lv: 0, df: 2, preset: 'g35' },
    { id: 'g68', name: 'Grades 6 to 8', short: '6-8', ages: '11 to 14', isced: 'ISCED 2 (lower secondary)', ew: 'Years 7 to 9', lv: 1, df: 0, preset: 'g68' },
    { id: 'g912', name: 'Grades 9 to 12', short: '9-12', ages: '14 to 18', isced: 'ISCED 3 (upper secondary)', ew: 'Years 10 to 13', lv: 1, df: 1, preset: 'g910' },
    { id: 'col', name: 'College and beyond', short: 'College', ages: '18+', isced: 'ISCED 5-7 (tertiary)', ew: 'University', lv: 3, df: 1, preset: 'college' },
  ];
  const BAND = {}; BANDS.forEach((b, i) => { BAND[b.id] = Object.assign({ i }, b); });

  /* Reference codes. US maths: K-8 "grade.domain.cluster.standard", high school "HS<category>.<domain>.<cluster>.<standard>".
     US science (NGSS): "MS-PS2-2" style performance expectation codes. */
  const CODES = {
    'add': ['1.OA.C.6', '2.NBT.B.5', '4.NBT.B.4'], 'sub': ['1.OA.C.6', '2.NBT.B.5', '4.NBT.B.4'], 'mult-facts': ['3.OA.C.7'], 'mult': ['4.NBT.B.5', '5.NBT.B.5'],
    'div': ['4.NBT.B.6', '6.NS.B.2'], 'place-value': ['2.NBT.A.1', '4.NBT.A.2'], 'round': ['3.NBT.A.1', '4.NBT.A.3'],
    'frac-equiv': ['3.NF.A.3', '4.NF.A.1'], 'frac-simplify': ['4.NF.A.1'], 'frac-compare': ['3.NF.A.3.d', '4.NF.A.2'], 'frac-add-like': ['4.NF.B.3'],
    'frac-add': ['5.NF.A.1'], 'frac-sub': ['5.NF.A.1'], 'frac-mult': ['5.NF.B.4'], 'frac-div': ['6.NS.A.1'], 'mixed': ['4.NF.B.3.c'],
    'dec-add': ['5.NBT.B.7', '6.NS.B.3'], 'dec-mult': ['5.NBT.B.7', '6.NS.B.3'], 'dec-div': ['5.NBT.B.7', '6.NS.B.3'], 'frac-dec': ['4.NF.C.6', '7.NS.A.2.d'],
    'pct-of': ['6.RP.A.3.c'], 'pct-change': ['7.RP.A.3'], 'pct-convert': ['6.RP.A.3.c'], 'pct-reverse': ['6.RP.A.3.c', '7.RP.A.3'],
    'ratio-simplify': ['6.RP.A.1'], 'unit-rate': ['6.RP.A.2', '6.RP.A.3.b'], 'proportion': ['7.RP.A.2'], 'ratio-share': ['6.RP.A.3'],
    'int-add': ['7.NS.A.1'], 'int-sub': ['7.NS.A.1'], 'int-muldiv': ['7.NS.A.2'], 'order-ops': ['5.OA.A.1', '6.EE.A.2.c'],
    'eval-expr': ['6.EE.A.2.c'], 'like-terms': ['6.EE.A.3', '7.EE.A.1'], 'distribute': ['6.EE.A.3', '7.EE.A.1'],
    'one-step': ['6.EE.B.7'], 'two-step': ['7.EE.B.4.a'], 'both-sides': ['8.EE.C.7'], 'lin-ineq': ['7.EE.B.4.b', 'HSA.REI.B.3'], 'systems': ['8.EE.C.8', 'HSA.REI.C.6'],
    'exp-eval': ['6.EE.A.1'], 'exp-rules': ['8.EE.A.1'], 'sci-notation': ['8.EE.A.3', '8.EE.A.4'], 'roots': ['8.EE.A.2', 'HSN.RN.A.2'],
    'poly-add': ['HSA.APR.A.1'], 'poly-mult': ['HSA.APR.A.1'], 'factor-gcf': ['HSA.SSE.A.2'], 'factor-tri': ['HSA.SSE.A.2'], 'factor-dos': ['HSA.SSE.A.2'],
    'quad-factor': ['HSA.SSE.B.3.a', 'HSA.REI.B.4.b'], 'quad-formula': ['HSA.REI.B.4.b'], 'discriminant': ['HSA.REI.B.4.b'], 'vertex': ['HSA.SSE.B.3.b', 'HSF.IF.C.8.a'],
    'func-eval': ['8.F.A.1', 'HSF.IF.A.2'], 'composite': ['HSF.BF.A.1.c'], 'slope': ['8.EE.B.6', '8.F.B.4'], 'line-eq': ['8.F.B.4', 'HSA.CED.A.2'], 'intercepts': ['8.F.B.4', 'HSF.IF.B.4'],
    'area': ['3.MD.C.7', '6.G.A.1'], 'perimeter': ['3.MD.D.8'], 'circle': ['7.G.B.4'], 'angles': ['4.MD.C.7', '7.G.B.5'], 'pythagoras': ['8.G.B.7'], 'volume': ['5.MD.C.5', '8.G.C.9'], 'polygon-angles': ['8.G.A.5'],
    'mean': ['6.SP.B.5.c'], 'median': ['6.SP.B.5.c'], 'prob-simple': ['7.SP.C.5', '7.SP.C.7'], 'prob-compound': ['7.SP.C.8', 'HSS.CP.A.2'],
    'trig-ratio': ['HSG.SRT.C.6'], 'trig-special': ['HSF.TF.A.3'], 'trig-side': ['HSG.SRT.C.8'], 'trig-angle': ['HSG.SRT.C.8'],
    'la-vec': ['HSN.VM.B.4'], 'la-norm': ['HSN.VM.A.1'], 'la-matmul': ['HSN.VM.C.8'], 'la-det': ['HSN.VM.C.10'], 'la-inverse': ['HSN.VM.C.10'],
    'st-ncr': ['HSS.CP.B.9'], 'st-npr': ['HSS.CP.B.9'], 'st-binom': ['HSS.MD.A.3'], 'st-expect': ['HSS.MD.A.2'], 'st-sd': ['HSS.ID.A.2'], 'st-z': ['HSS.ID.A.4'], 'st-normal': ['HSS.ID.A.4'], 'st-bayes': ['HSS.CP.A.3'],
    'ph-newton2': ['MS-PS2-2', 'HS-PS2-1'], 'ph-weight': ['MS-PS2-4'], 'ph-friction': ['HS-PS2-1'], 'ph-incline': ['HS-PS2-1'], 'ph-gravity': ['HS-PS2-4'], 'ph-coulomb': ['HS-PS2-4'],
    'ph-ke': ['MS-PS3-1', 'HS-PS3-1'], 'ph-gpe': ['MS-PS3-2', 'HS-PS3-1'], 'ph-work': ['HS-PS3-1'], 'ph-energy-cons': ['HS-PS3-1'], 'ph-efficiency': ['HS-PS3-3'],
    'ph-momentum': ['HS-PS2-2'], 'ph-impulse': ['HS-PS2-3'], 'ph-collision': ['HS-PS2-2'], 'ph-elastic': ['HS-PS2-2'], 'ph-wave': ['HS-PS4-1'], 'ph-period': ['HS-PS4-1'],
    'ph-heat': ['HS-PS3-4'], 'ph-latent': ['HS-PS3-4'], 'ph-photon': ['HS-PS4-3'],
    'ch-molar': ['HS-PS1-7'], 'ch-moles': ['HS-PS1-7'], 'ch-stoich': ['HS-PS1-7'], 'ch-limiting': ['HS-PS1-7'], 'ch-yield': ['HS-PS1-7'], 'ch-kc': ['HS-PS1-6'],
    'wp-join': ['1.OA.A.1', '2.OA.A.1'], 'wp-groups': ['3.OA.A.3', '4.OA.A.3'], 'wp-money': ['4.MD.A.2', '4.OA.A.3'], 'wp-fraction': ['4.NF.B.4.c', '5.NF.B.6'],
    'wp-percent': ['7.RP.A.3'], 'wp-rate': ['6.RP.A.3.b'], 'wp-equation': ['7.EE.B.4.a', 'HSA.CED.A.1'],
  };
  const CODE_RE = /^(?:(?:K|[1-8])\.(?:OA|NBT|NF|MD|G|RP|NS|EE|F|SP)\.[A-D]\.\d{1,2}(?:\.[a-d])?|HS[ANFGS]\.[A-Z]{2,3}\.[A-D]\.\d{1,2}(?:\.[a-d])?|(?:MS|HS)-(?:PS|LS|ESS|ETS)\d-\d{1,2})$/;

  /** Lowest grade named in a skill's grade field: 'K-4' -> 0, '6-7' -> 6, '11-college' -> 11, 'college' -> 13, 'adult' -> 9. */
  function lowGrade(g) {
    const s = String(g || '').toLowerCase().split('-')[0];
    if (s === 'k') return 0;
    if (s === 'college') return 13;
    if (s === 'adult') return 9;
    const n = parseInt(s, 10); return isNaN(n) ? 9 : n;
  }
  function bandFor(grade) { const g = lowGrade(grade); return g <= 2 ? 'k2' : g <= 5 ? 'g35' : g <= 8 ? 'g68' : g <= 12 ? 'g912' : 'col'; }
  function bandOf(id) { const s = SM.SKILL[id]; return s ? bandFor(s.grade) : ''; }
  const codesOf = id => (CODES[id] || []).slice();
  /** Skill ids in a band, optionally limited to subjects. */
  function inBand(band, subjects) { return SM.SKILLS.filter(s => bandFor(s.grade) === band && (!subjects || subjects.includes(s.subject))).map(s => s.id); }
  /** Grade number a code names (K = 0, high school = 9, middle-school science = 6), for consistency checks. */
  function codeGrade(c) { if (/^K\./.test(c)) return 0; if (/^[1-8]\./.test(c)) return +c[0]; if (/^HS/.test(c)) return 9; if (/^MS-/.test(c)) return 6; return -1; }
  /** Search skills by code prefix or words in the title: "5.NF", "HS-PS2", "fraction". */
  function search(q) {
    q = String(q || '').trim().toLowerCase(); if (!q) return [];
    return SM.SKILLS.filter(s => s.title.toLowerCase().includes(q) || s.strand.toLowerCase().includes(q) || codesOf(s.id).some(c => c.toLowerCase().startsWith(q))).map(s => s.id);
  }
  /** CSV of the whole map (formula-safe). */
  function csv() {
    const qv = v => { v = String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const rows = ['Skill,Subject,Strand,Grade band,Ages,ISCED,England and Wales,Reference codes'];
    SM.SKILLS.forEach(s => { const b = BAND[bandFor(s.grade)]; rows.push([s.title, SM.subjectName ? SM.subjectName(s.subject) : s.subject, s.strand, b.name, b.ages, b.isced, b.ew, codesOf(s.id).join(' ')].map(qv).join(',')); });
    return rows.join('\r\n') + '\r\n';
  }
  SM.curriculum = { BANDS, BAND, CODES, CODE_RE, lowGrade, bandFor, bandOf, codesOf, inBand, codeGrade, search, csv };
})();
