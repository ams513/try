/* Stark IntraTheater. History extras: the "Order it" timeline challenge and "Meanwhile around the world",
   which shows what was happening in other regions at about the same time. Uses SIT.worldLib for the maths. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const W = SIT.worldLib;
  const EV = data.events, ERAS = data.eras;
  const byId = {}; EV.forEach(e => { byId[e.id] = e; });
  const ROUNDS = 5;

  /* ================= Order it ================= */
  const ord = { level: null, round: 0, placed: 0, slots: 0, perfect: 0, cur: null, list: [], checked: null };
  function orderStart(host, level) {
    ord.level = level; ord.round = 0; ord.placed = 0; ord.slots = 0; ord.perfect = 0;
    orderNext(host);
  }
  function orderNext(host) {
    const n = ord.level === 'kid' ? 4 : 6;
    ord.cur = W.orderRound(EV, n, ord.level, Math.random);
    ord.list = ord.cur.items.map(e => e.id); ord.checked = null;
    orderRender(host);
  }
  function orderMenu(host) {
    clear(host);
    const best = SIT.progress().best;
    const card = (lv, title, text) => h('button', { type: 'button', class: 'menu-card', onclick: () => orderStart(host, lv) },
      h('span', { class: 'menu-title' }, title), h('span', { class: 'muted' }, text),
      best['hist-order-' + lv] ? h('span', { class: 'badge' }, 'Best: ' + best['hist-order-' + lv].score + '/' + best['hist-order-' + lv].total) : null);
    host.appendChild(h('section', { class: 'quiz-setup' },
      h('h2', null, '🔀 Put history in order'),
      h('p', { class: 'muted' }, 'Five rounds. Move the moments into order, oldest at the top, then check. Dates appear when you check.'),
      h('div', { class: 'lesson-grid' },
        card('kid', '🧒 Kids: 4 moments', 'Each from a different era, far apart in time.'),
        card('grown', '🎓 Grown-ups: 6 moments', 'From any era, as close as 40 years apart.'))));
  }
  function orderRender(host) {
    clear(host);
    const n = ord.list.length, done = !!ord.checked;
    const moveBtn = (i, d, e) => h('button', {
      type: 'button', class: 'icon-btn', disabled: done || i + d < 0 || i + d >= n, 'aria-label': 'Move ' + e.title + (d < 0 ? ' earlier' : ' later'),
      onclick: () => { ord.list = W.moveIn(ord.list, i, i + d); orderRender(host); const b = host.querySelectorAll('.order-item')[i + d]; if (b) { const f = b.querySelector(d < 0 ? '.mv-up' : '.mv-down') || b.querySelector('button:not(:disabled)'); if (f) f.focus(); } }
    }, d < 0 ? '▲' : '▼');
    const items = ord.list.map((id, i) => {
      const e = byId[id], right = done && ord.cur.answer[i] === id, at = ord.cur.answer.indexOf(id) + 1;
      const up = moveBtn(i, -1, e), down = moveBtn(i, 1, e); up.classList.add('mv-up'); down.classList.add('mv-down');
      return h('li', { class: 'order-item' + (done ? (right ? ' is-right' : ' is-wrong') : '') },
        h('span', { class: 'order-n', 'aria-hidden': 'true' }, String(i + 1)),
        h('span', { class: 'order-icon', 'aria-hidden': 'true' }, e.icon),
        h('span', { class: 'order-text' }, h('strong', null, e.title), done ? h('span', { class: 'date' }, e.date + (right ? ' ✓' : ' · belongs in place ' + at)) : h('span', { class: 'muted small' }, e.region)),
        h('span', { class: 'order-moves' }, up, down));
    });
    host.appendChild(h('section', { class: 'card order-card' },
      h('p', { class: 'quiz-progress' }, 'Round ' + (ord.round + 1) + ' of ' + ROUNDS + ' · ' + ord.placed + ' placed right so far'),
      h('h2', null, 'Oldest at the top, newest at the bottom'),
      h('ol', { class: 'order-list', 'aria-label': 'Moments to put in order' }, items),
      done ? h('p', { class: 'quiz-feedback ' + (ord.checked.perfect ? 'good' : 'try'), role: 'status' },
        ord.checked.perfect ? 'Perfect order! ' : ord.checked.placed + ' of ' + n + ' in the right place. ',
        ord.checked.pairsRight + ' of ' + ord.checked.pairs + ' pairs were the right way round.') : null,
      h('div', { class: 'row' },
        done ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
          ord.round++;
          if (ord.round < ROUNDS) { orderNext(host); return; }
          orderFinish(host);
        } }, ord.round + 1 < ROUNDS ? 'Next round' : 'See my score')
          : h('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
            ord.checked = W.scoreOrder(ord.cur.answer, ord.list);
            ord.placed += ord.checked.placed; ord.slots += n;
            if (ord.checked.perfect) { ord.perfect++; if (!SIT.isGrown()) SIT.addStars(1); }
            ord.cur.answer.forEach(id => SIT.markIn('seen', id));
            orderRender(host);
            const nb = host.querySelector('.btn-primary'); if (nb) nb.focus();
          } }, 'Check my order'),
        h('button', { type: 'button', class: 'btn', onclick: () => orderMenu(host) }, 'Stop'))));
  }
  function orderFinish(host) {
    const record = SIT.setBest('hist-order-' + ord.level, ord.placed, ord.slots);
    clear(host);
    host.appendChild(h('div', { class: 'quiz-done' },
      h('div', { class: 'quiz-stars', 'aria-hidden': 'true' }, ord.perfect >= 4 ? '⭐⭐⭐' : ord.perfect >= 2 ? '⭐⭐' : '⭐'),
      h('h3', { tabindex: '-1' }, ord.placed + ' of ' + ord.slots + ' placed right'),
      h('p', null, ord.perfect + ' perfect round' + (ord.perfect === 1 ? '' : 's') + ' out of ' + ROUNDS + '.'),
      record ? h('p', { class: 'badge' }, 'New personal best') : null,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => orderStart(host, ord.level) }, 'Play again'),
        h('button', { type: 'button', class: 'btn', onclick: () => orderMenu(host) }, 'Choose a level'))));
    host.querySelector('h3').focus();
  }

  /* ================= Meanwhile around the world ================= */
  const mw = { anchor: 'writing' };
  function meanwhileRender(host, anchorId, onOpen) {
    if (anchorId && byId[anchorId]) mw.anchor = anchorId;
    clear(host);
    const a = byId[mw.anchor] || EV[0], grown = SIT.isGrown();
    const res = W.meanwhile(EV, a.year, a.id, 3);
    const sel = h('select', { id: 'mw-anchor', onchange: e => meanwhileRender(host, e.target.value, onOpen) },
      ERAS.map(E => h('optgroup', { label: E.name }, EV.filter(e => e.era === E.id).map(e => h('option', { value: e.id }, e.date + ': ' + e.title)))));
    sel.value = a.id;
    const i = EV.indexOf(a);
    host.appendChild(h('section', { class: 'card mw-anchor' },
      h('div', { class: 'filters' },
        h('label', { class: 'grow' }, h('span', null, 'Pick a moment'), sel),
        h('button', { type: 'button', class: 'btn btn-small', disabled: i <= 0, onclick: () => meanwhileRender(host, EV[i - 1].id, onOpen) }, '◀ Earlier'),
        h('button', { type: 'button', class: 'btn btn-small', disabled: i >= EV.length - 1, onclick: () => meanwhileRender(host, EV[i + 1].id, onOpen) }, 'Later ▶'),
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => meanwhileRender(host, SIT.pick(EV).id, onOpen) }, '🎲 Surprise me')),
      h('div', { class: 'ev-head' }, h('span', { class: 'ev-icon', 'aria-hidden': 'true' }, a.icon),
        h('div', null, h('p', { class: 'date' }, a.date + ' · ' + a.region), h('h2', null, a.title))),
      h('p', null, grown ? a.adult : a.kid)));
    host.appendChild(h('h2', { class: 'mw-title' }, '🌐 Meanwhile around the world ',
      h('span', { class: 'muted small' }, '(within about ' + W.deltaText(res.window).replace(/ (earlier|later)$/, '') + ' either side)')));
    if (!res.regions.length) {
      host.appendChild(h('p', { class: 'muted' }, 'No other moments in this collection are that close in time. Try “Surprise me” or a later moment.'));
    } else {
      host.appendChild(h('div', { class: 'mw-grid' }, res.regions.map(g => h('article', { class: 'card mw-region' },
        h('h3', null, g.region),
        h('ul', { class: 'plain' }, g.items.map(x => h('li', null,
          h('button', { type: 'button', class: 'mw-item', onclick: () => onOpen(x.id) },
            h('span', { 'aria-hidden': 'true' }, x.icon + ' '), h('strong', null, x.title),
            h('span', { class: 'muted small' }, ' ' + x.date + ' · ' + W.deltaText(x.delta))))))))));
    }
    host.appendChild(h('p', { class: 'fine' }, 'Regions with nothing listed may still have had a lot going on: this shows only the ' + EV.length + ' moments in Stark IntraTheater, so treat it as a starting point, not the whole picture.'));
  }

  SIT.historyPlus = { orderMenu, meanwhile: meanwhileRender };
})();
