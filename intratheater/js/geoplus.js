/* Stark IntraTheater. Geography extras: "Find it on the map" (tap where a capital is; points by real distance)
   and "Capitals review", a spaced-review deck that brings back the capitals you find hard. Uses SIT.worldLib. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const W = SIT.worldLib;
  const C = data.countries;
  const byIso = {}; C.forEach(c => { byIso[c.iso2] = c; });
  const COLOR = { 'Africa': '#e0a63c', 'Asia': '#d1603f', 'Europe': '#6f93c9', 'North America': '#5fae6b', 'South America': '#b783cf', 'Oceania': '#3fb0a9' };
  const S = SIT.svg;
  const ROUNDS = 10;
  const today = () => SIT.familyLib.dayKey(new Date());

  /* ================= Find it on the map ================= */
  const fs = { level: null, list: [], i: 0, points: 0, right: 0, guess: null };
  function contBox(cont) {
    const pts = C.filter(c => c.continent === cont);
    let x0 = Math.min(...pts.map(W.mapX)) - 10, x1 = Math.max(...pts.map(W.mapX)) + 10, y0 = Math.min(...pts.map(c => -c.lat)) - 10, y1 = Math.max(...pts.map(c => -c.lat)) + 10;
    let w = x1 - x0, hh = y1 - y0;
    if (w < hh * 2) { x0 -= (hh * 2 - w) / 2; w = hh * 2; } else { y0 -= (w / 2 - hh) / 2; hh = w / 2; }
    return [x0, y0, w, hh];
  }
  function findMenu(host) {
    clear(host);
    const best = SIT.progress().best;
    const card = (lv, title, text) => h('button', { type: 'button', class: 'menu-card', onclick: () => findStart(host, lv) },
      h('span', { class: 'menu-title' }, title), h('span', { class: 'muted' }, text),
      best['geo-find-' + lv] ? h('span', { class: 'badge' }, 'Best: ' + best['geo-find-' + lv].score + '/' + best['geo-find-' + lv].total) : null);
    host.appendChild(h('section', { class: 'quiz-setup' },
      h('h2', null, '📍 Find it on the map'),
      h('p', { class: 'muted' }, 'We name a country; you tap where its capital is. The closer you are, the more points: 100 for the right dot, and it counts as right within 500 km. No borders are drawn, so the dots and lines of latitude are your clues.'),
      h('div', { class: 'lesson-grid' },
        card('kid', '🧒 Kids: famous countries', 'The map zooms to the right continent for you.'),
        card('grown', '🎓 Grown-ups: all 193', 'The whole world, every capital.'))));
  }
  function findStart(host, level) {
    fs.level = level; fs.list = W.findRound(C, level, ROUNDS, Math.random); fs.i = 0; fs.points = 0; fs.right = 0; fs.guess = null;
    findRender(host);
  }
  function findRender(host) {
    clear(host);
    const target = fs.list[fs.i], kid = fs.level === 'kid', answered = !!fs.guess;
    const vb = kid ? contBox(target.continent) : [-180, -90, 360, 180], k = vb[2] / 360;
    const svg = S('svg', { class: 'dotmap findmap', viewBox: vb.join(' '), role: 'img', 'aria-label': 'World map of capital cities as dots, no borders. Tap where you think the capital of ' + target.name + ' is.' },
      S('rect', { x: -200, y: -100, width: 440, height: 200, class: 'ocean' }));
    for (let lon = -180; lon <= 210; lon += 30) svg.appendChild(S('line', { x1: lon, y1: -90, x2: lon, y2: 90, class: 'grat', 'stroke-width': 0.35 * k }));
    for (let lat = -60; lat <= 60; lat += 30) svg.appendChild(S('line', { x1: -200, y1: -lat, x2: 240, y2: -lat, class: lat === 0 ? 'grat eq' : 'grat', 'stroke-width': 0.35 * k }));
    C.forEach(c => svg.appendChild(S('g', { class: 'dot' + (kid && c.continent !== target.continent ? ' dim' : ''), style: '--cont:' + COLOR[c.continent], 'data-iso': c.iso2 },
      S('circle', { cx: W.mapX(c), cy: -c.lat, r: 4 * k, class: 'hit' }), S('circle', { cx: W.mapX(c), cy: -c.lat, r: 1.5 * k, class: 'pt' }))));
    if (answered) {
      const g = fs.guess, tx = W.mapX(target), ty = -target.lat;
      svg.appendChild(S('line', { x1: g.x, y1: g.y, x2: tx, y2: ty, class: 'find-line', 'stroke-width': 0.8 * k }));
      svg.appendChild(S('circle', { cx: g.x, cy: g.y, r: 2.4 * k, class: 'find-guess' }));
      svg.appendChild(S('circle', { cx: tx, cy: ty, r: 3 * k, class: 'find-target' }));
      const t = S('text', { x: tx + 3.5 * k, y: ty + 2 * k, class: 'map-label', 'font-size': 7 * k }); t.textContent = target.capital; svg.appendChild(t);
    }
    const choose = (lat, lon, x, y) => {
      if (fs.guess) return;
      const km = Math.round(W.haversineKm({ lat, lon }, target)), pts = W.findPoints(km), grade = W.findGrade(km);
      fs.guess = { x, y, km, pts, grade }; fs.points += pts;
      if (km <= 500) { fs.right++; if (!SIT.isGrown()) SIT.addStars(1); }
      findRender(host);
      const nb = host.querySelector('.find-next'); if (nb) nb.focus();
    };
    if (!answered) svg.addEventListener('click', ev => {
      const dot = ev.target.closest && ev.target.closest('g.dot');
      if (dot) { const c = byIso[dot.getAttribute('data-iso')]; choose(c.lat, c.lon, W.mapX(c), -c.lat); return; }
      const m = svg.getScreenCTM(); if (!m) return;
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(m.inverse());
      const lon = p.x > 180 ? p.x - 360 : p.x, lat = Math.max(-90, Math.min(90, -p.y));
      choose(lat, lon, p.x, p.y);
    });
    const pickList = h('select', { id: 'find-list', disabled: answered },
      h('option', { value: '' }, 'Or choose a capital from a list…'),
      C.filter(c => !kid || c.continent === target.continent).slice().sort((a, b) => a.capital.localeCompare(b.capital)).map(c => h('option', { value: c.iso2 }, c.capital)));
    pickList.addEventListener('change', () => { const c = byIso[pickList.value]; if (c) choose(c.lat, c.lon, W.mapX(c), -c.lat); });
    const g = fs.guess;
    const msg = !g ? null : g.grade === 'right' ? 'Spot on! That is ' + target.capital + '. +' + g.pts + ' points.'
      : g.grade === 'close' ? 'Close: ' + g.km.toLocaleString('en-US') + ' km away. That counts! +' + g.pts + ' points.'
        : g.grade === 'near' ? g.km.toLocaleString('en-US') + ' km away. The capital is ' + target.capital + '. +' + g.pts + ' points.'
          : g.km.toLocaleString('en-US') + ' km away. The capital of ' + target.name + ' is ' + target.capital + ', in ' + target.continent + '.' + (g.pts ? ' +' + g.pts + ' points.' : '');
    host.appendChild(h('section', { class: 'card find-card' },
      h('p', { class: 'quiz-progress' }, 'Round ' + (fs.i + 1) + ' of ' + fs.list.length + ' · ' + fs.points + ' points · ' + fs.right + ' right'),
      h('h2', null, 'Where is the capital of ' + target.name + '?'),
      h('div', { class: 'row find-status' },
        g ? h('p', { class: 'quiz-feedback ' + (g.km <= 500 ? 'good' : 'bad'), role: 'status' }, msg) : h('p', { class: 'muted', role: 'status' }, kid ? 'Hint: it is in ' + target.continent + '. Tap the map, or use the list below.' : 'Tap the map, or use the list below.'),
        g ? h('button', { type: 'button', class: 'btn btn-primary find-next', onclick: () => {
          fs.i++; fs.guess = null;
          if (fs.i < fs.list.length) findRender(host); else findFinish(host);
        } }, fs.i + 1 < fs.list.length ? 'Next country' : 'See my score') : null,
        g ? SIT.speakButton(() => target.name + '. The capital is ' + target.capital + '.', 'Hear it', 'btn-small') : null),
      h('div', { class: 'find-map-wrap' }, svg),
      h('label', { class: 'sr-only', for: 'find-list' }, 'Choose a capital from a list'), pickList));
  }
  function findFinish(host) {
    const record = SIT.setBest('geo-find-' + fs.level, fs.right, fs.list.length);
    clear(host);
    host.appendChild(h('div', { class: 'quiz-done' },
      h('div', { class: 'quiz-stars', 'aria-hidden': 'true' }, fs.right >= 9 ? '⭐⭐⭐' : fs.right >= 6 ? '⭐⭐' : '⭐'),
      h('h3', { tabindex: '-1' }, fs.points + ' points'),
      h('p', null, fs.right + ' of ' + fs.list.length + ' within 500 km.'),
      record ? h('p', { class: 'badge' }, 'New personal best') : null,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => findStart(host, fs.level) }, 'Play again'),
        h('button', { type: 'button', class: 'btn', onclick: () => findMenu(host) }, 'Choose a level'))));
    host.querySelector('h3').focus();
  }

  /* ================= Capitals review (spaced repetition) ================= */
  const rv = { scope: null, card: null, result: null, recent: [] };
  const deckIds = scope => (scope === 'kid' ? C.filter(c => c.kid) : C.slice().sort((a, b) => (b.kid ? 1 : 0) - (a.kid ? 1 : 0))).map(c => c.iso2);
  const deck = () => { const p = SIT.progress(); p.review = W.cleanDeck(p.review); return p.review; };
  function reviewRender(host) {
    clear(host);
    if (!rv.scope) rv.scope = SIT.isGrown() ? 'all' : 'kid';
    const d = deck(), ids = deckIds(rv.scope), t = today(), maxNew = rv.scope === 'kid' ? 5 : 10;
    const stats = W.reviewStats(d, ids, t);
    if (!rv.card && !rv.result) rv.card = W.reviewNext(d, ids, t, maxNew, rv.recent.slice(-2)) || W.reviewNext(d, ids, t, maxNew);
    host.appendChild(h('section', { class: 'card review-card' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Which countries' },
        [['kid', 'Famous countries (' + C.filter(c => c.kid).length + ')'], ['all', 'All 193']].map(o => h('button', { type: 'button', class: 'chip', 'aria-pressed': rv.scope === o[0] ? 'true' : 'false', onclick: () => { rv.scope = o[0]; rv.card = null; rv.result = null; reviewRender(host); } }, o[1]))),
      h('p', { class: 'review-stats' },
        h('span', { class: 'badge' }, stats.due + ' due'), ' ', h('span', { class: 'badge' }, stats.learning + ' learning'), ' ',
        h('span', { class: 'badge' }, stats.strong + ' strong'), ' ', h('span', { class: 'badge' }, stats.unseen + ' new')),
      rv.result ? resultBlock(host) : rv.card ? askBlock(host, byIso[rv.card.id], rv.card.fresh)
        : h('div', { class: 'review-done' }, h('h2', null, '🎉 All done for today!'),
          h('p', null, 'Nothing is due. Come back tomorrow: capitals you found hard come back sooner, and ones you know well come back later.'),
          h('p', { class: 'muted small' }, 'New capitals per day: ' + maxNew + '.')),
      h('p', { class: 'fine' }, 'How it works: every right answer moves a capital up a box (back in 1, 2, 4, 8, then 16 days); a wrong one sends it back to box 1. Small spelling slips count, and accents are optional.')));
    const inp = host.querySelector('#review-input'); if (inp) inp.focus({ preventScroll: true });
    const nx = host.querySelector('.review-next'); if (nx) nx.focus({ preventScroll: true });
  }
  function askBlock(host, c, fresh) {
    const inp = h('input', { type: 'text', id: 'review-input', autocomplete: 'off', spellcheck: 'false', maxlength: 60 });
    const submit = typed => {
      const r = typed === null ? 'wrong' : W.checkCapital(c, typed);
      const card = W.reviewAnswer(deck(), c.iso2, r !== 'wrong', today());
      SIT.saveProgress();
      if (r !== 'wrong' && !SIT.isGrown()) SIT.addStars(1);
      rv.recent.push(c.iso2); rv.result = { c, r, typed, box: card.box }; rv.card = null;
      reviewRender(host);
    };
    return h('form', { class: 'review-ask', onsubmit: e => { e.preventDefault(); if (inp.value.trim()) submit(inp.value); } },
      fresh ? h('p', { class: 'badge' }, 'New card') : null,
      h('h2', null, 'What is the capital of ' + c.name + '?'),
      h('p', { class: 'muted' }, c.continent),
      h('label', { for: 'review-input', class: 'sr-only' }, 'Capital of ' + c.name), inp,
      h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Check'), h('button', { type: 'button', class: 'btn', onclick: () => submit(null) }, 'Show me')));
  }
  function resultBlock(host) {
    const x = rv.result, c = x.c;
    const text = x.r === 'right' ? 'Yes! ' + c.capital + ' is the capital of ' + c.name + '.'
      : x.r === 'close' ? 'Yes, nearly spelled right: it is ' + c.capital + '.'
        : (x.typed === null ? '' : 'Not this time. ') + 'The capital of ' + c.name + ' is ' + c.capital + '.';
    return h('div', { class: 'review-result' },
      h('p', { class: 'quiz-feedback ' + (x.r === 'wrong' ? 'bad' : 'good'), role: 'status' }, text),
      c.note ? h('p', { class: 'muted' }, c.note) : null,
      h('p', { class: 'muted small' }, x.r === 'wrong' ? 'It will come back soon.' : 'Box ' + x.box + ': next review in ' + W.GAPS[x.box] + ' day' + (W.GAPS[x.box] === 1 ? '' : 's') + '.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-primary review-next', onclick: () => { rv.result = null; reviewRender(host); } }, 'Next card')));
  }

  SIT.geoPlus = { findMenu, review: host => { rv.card = null; rv.result = null; reviewRender(host); } };
})();
