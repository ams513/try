/* Stark IntraTheater. World learning maths with no DOM, shared by the app and the node tests:
   timeline ordering rounds, "meanwhile around the world" lookups, map distance scoring, and a spaced-review deck. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SIT = G.SIT = G.SIT || {};
  const NOW = 2026;
  const shuffleR = (a, rng) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

  /* ---------- timeline order challenge ---------- */
  /* n events far enough apart to order fairly: kids get different eras at least 300 years apart, grown-ups 40 years.
     Returns {items (shuffled, never already in order), answer (ids oldest first)} or null when the pool is too small. */
  function orderRound(events, n, level, rng) {
    const kid = level === 'kid', gap = kid ? 300 : 40;
    for (let tries = 0; tries < 60; tries++) {
      const chosen = [];
      for (const e of shuffleR(events, rng)) {
        if (chosen.some(c => Math.abs(c.year - e.year) < gap || (kid && c.era === e.era))) continue;
        chosen.push(e);
        if (chosen.length === n) break;
      }
      if (chosen.length < n) continue;
      const answer = chosen.slice().sort((a, b) => a.year - b.year).map(e => e.id);
      let items = shuffleR(chosen, rng);
      for (let k = 0; k < 8 && items.every((e, i) => e.id === answer[i]); k++) items = shuffleR(chosen, rng);
      if (items.every((e, i) => e.id === answer[i])) items = items.slice().reverse();
      return { items, answer };
    }
    return null;
  }
  /* placed: cards in exactly the right slot; pairs: pairs of cards in the right relative order (partial credit) */
  function scoreOrder(answer, user) {
    const n = answer.length, pos = {};
    answer.forEach((id, i) => { pos[id] = i; });
    let placed = 0, pairsRight = 0;
    user.forEach((id, i) => { if (answer[i] === id) placed++; });
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (pos[user[i]] < pos[user[j]]) pairsRight++;
    const pairs = n * (n - 1) / 2;
    return { placed, n, pairsRight, pairs, perfect: placed === n && user.length === n };
  }
  /* move item i to j without changing the input */
  function moveIn(list, i, j) {
    const a = list.slice();
    if (i < 0 || i >= a.length) return a;
    j = Math.max(0, Math.min(a.length - 1, j));
    const x = a.splice(i, 1)[0]; a.splice(j, 0, x);
    return a;
  }

  /* ---------- meanwhile around the world ---------- */
  /* how far either side of a year counts as "about the same time": grows with distance from today */
  const windowFor = year => Math.max(15, Math.round(0.1 * (NOW - year)));
  /* events within the window, grouped by region (closest first, up to `per` each), regions ordered by their closest event */
  function meanwhile(events, year, excludeId, per) {
    const w = windowFor(year), by = {};
    events.forEach(e => {
      if (e.id === excludeId) return;
      const d = Math.abs(e.year - year);
      if (d > w) return;
      (by[e.region] = by[e.region] || []).push({ id: e.id, title: e.title, date: e.date, icon: e.icon, year: e.year, delta: e.year - year });
    });
    const regions = Object.keys(by).map(r => ({ region: r, items: by[r].sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || a.year - b.year).slice(0, per || 3) }));
    regions.sort((a, b) => Math.abs(a.items[0].delta) - Math.abs(b.items[0].delta) || (a.region < b.region ? -1 : 1));
    return { window: w, regions };
  }
  function fmtYear(y) {
    if (y <= -100000) { const ago = NOW - y; return ago >= 1e6 ? (ago / 1e6).toFixed(1).replace('.0', '') + ' million years ago' : Math.round(ago / 1000) + ',000 years ago'; }
    if (y < 0) return (-y).toLocaleString('en-US') + ' BCE';
    return y < 1000 ? y + ' CE' : String(y);
  }
  /* "120 years earlier" / "the same year" / "30 years later" */
  function deltaText(d) {
    const a = Math.abs(d);
    if (a === 0) return 'the same year';
    const n = a >= 10000 ? Math.round(a / 1000).toLocaleString('en-US') + ',000' : a.toLocaleString('en-US');
    return n + (a === 1 ? ' year ' : ' years ') + (d < 0 ? 'earlier' : 'later');
  }

  /* ---------- map: distances and scoring ---------- */
  const R = 6371.0088;
  function haversineKm(a, b) {
    const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  /* same projection as the capitals map: x = longitude (Pacific Oceania shifted east), y = -latitude */
  const mapX = c => (c.continent === 'Oceania' && c.lon < -150 ? c.lon + 360 : c.lon);
  function nearestTo(countries, lat, lon) {
    let best = null, bd = Infinity;
    countries.forEach(c => { const d = haversineKm({ lat, lon }, c); if (d < bd) { bd = d; best = c; } });
    return best;
  }
  /* 100 points within 50 km (the right dot), falling to 0 at 3000 km; "close" within 500 km */
  function findPoints(km) {
    if (km <= 50) return 100;
    return Math.max(0, Math.round(100 * (1 - (km - 50) / 2950)));
  }
  const findGrade = km => (km <= 50 ? 'right' : km <= 500 ? 'close' : km <= 1500 ? 'near' : 'far');
  function findRound(countries, level, n, rng) {
    const pool = countries.filter(c => level !== 'kid' || c.kid);
    return shuffleR(pool, rng).slice(0, Math.min(n, pool.length));
  }

  /* ---------- typed capital answers ---------- */
  const ALT_CAPITALS = { BO: ['La Paz'], ZA: ['Cape Town', 'Bloemfontein'], SZ: ['Lobamba'], LK: ['Kotte', 'Sri Jayawardenapura Kotte'], BJ: ['Cotonou'] };
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[\u2018\u2019'`.\-]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().replace(/^the /, '').replace(/^st /, 'saint ');
  }
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 99;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  /* 'right', 'close' (a small spelling slip, still counted) or 'wrong' */
  function checkCapital(c, typed) {
    const t = norm(typed);
    if (!t) return 'wrong';
    const options = [c.capital].concat(ALT_CAPITALS[c.iso2] || []).map(norm);
    if (options.indexOf(t) >= 0) return 'right';
    const slack = t.length >= 9 ? 2 : t.length >= 5 ? 1 : 0;
    return options.some(o => editDistance(o, t) <= slack) ? 'close' : 'wrong';
  }

  /* ---------- spaced review (Leitner boxes 1 to 5 ) ---------- */
  const GAPS = [0, 1, 2, 4, 8, 16];  // days until the next review after reaching box n
  function dayNum(key) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : 0; }
  const newDeck = () => ({ cards: {}, newDay: '', newCount: 0 });
  function cleanDeck(d) {
    const out = newDeck();
    if (!d || typeof d !== 'object') return out;
    if (d.cards && typeof d.cards === 'object') Object.keys(d.cards).forEach(id => {
      const c = d.cards[id];
      if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && c && c.box >= 1 && c.box <= 5 && isFinite(c.due)) out.cards[id] = { box: Math.round(c.box), due: Math.round(c.due), right: +c.right || 0, wrong: +c.wrong || 0 };
    });
    if (typeof d.newDay === 'string') { out.newDay = d.newDay; out.newCount = Math.max(0, +d.newCount || 0); }
    return out;
  }
  /* the next card: due cards first (lowest box, then oldest), else a new one if today's new-card allowance is left */
  function reviewNext(deck, ids, todayKey, maxNew, skip) {
    const t = dayNum(todayKey), avoid = skip || [];
    const due = ids.filter(id => deck.cards[id] && deck.cards[id].due <= t && avoid.indexOf(id) < 0)
      .sort((a, b) => deck.cards[a].box - deck.cards[b].box || deck.cards[a].due - deck.cards[b].due || ids.indexOf(a) - ids.indexOf(b));
    if (due.length) return { id: due[0], fresh: false };
    const used = deck.newDay === todayKey ? deck.newCount : 0;
    if (used >= maxNew) return null;
    const fresh = ids.find(id => !deck.cards[id] && avoid.indexOf(id) < 0);
    return fresh ? { id: fresh, fresh: true } : null;
  }
  function reviewAnswer(deck, id, correct, todayKey) {
    const t = dayNum(todayKey), old = deck.cards[id];
    if (!old) { if (deck.newDay !== todayKey) { deck.newDay = todayKey; deck.newCount = 0; } deck.newCount++; }
    const c = old || { box: 0, due: t, right: 0, wrong: 0 };
    c.box = correct ? Math.min(5, c.box + 1) : 1;
    c.due = t + (correct ? GAPS[c.box] : 0);
    if (correct) c.right++; else c.wrong++;
    deck.cards[id] = c;
    return c;
  }
  function reviewStats(deck, ids, todayKey) {
    const t = dayNum(todayKey), s = { due: 0, learning: 0, strong: 0, unseen: 0, total: ids.length };
    ids.forEach(id => {
      const c = deck.cards[id];
      if (!c) { s.unseen++; return; }
      if (c.due <= t) s.due++;
      if (c.box >= 4) s.strong++; else s.learning++;
    });
    return s;
  }

  SIT.worldLib = { orderRound, scoreOrder, moveIn, windowFor, meanwhile, fmtYear, deltaText, haversineKm, mapX, nearestTo, findPoints, findGrade, findRound,
    norm, editDistance, checkCapital, ALT_CAPITALS, GAPS, dayNum, newDeck, cleanDeck, reviewNext, reviewAnswer, reviewStats };
})();
