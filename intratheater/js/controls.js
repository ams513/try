/* Stark IntraTheater. Kids' limits (parental controls): which sections kids may open, a daily time allowance and quiet hours,
   plus a parent activity report. Enforced by the router: core.js asks SIT.kidGate before it shows any page in Kids mode,
   and the allowance is re-checked every 30 seconds. Hiding the menu links is only a courtesy on top of that. */
(function () {
  'use strict';
  const { h, clear, store } = SIT;
  const F = SIT.familyLib;
  const controls = () => F.sanitizeControls(SIT.family().settings.controls);
  let usage = store.get('usage', {});
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) usage = {};

  SIT.kidGate = function (view) {
    if (SIT.isGrown()) return { ok: true, left: null };
    return F.kidGate(controls(), view, usage, SIT.activeKid().id, new Date());
  };

  /* ---------- time tracking: Kids mode, page visible, and someone touched it in the last 2 minutes (or a video plays) ---------- */
  let lastInput = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }));
  function tick() {
    if (SIT.isGrown() || document.visibilityState === 'hidden') return;
    const vid = document.getElementById('theater-video');
    const watching = vid && !vid.paused;
    if (!watching && Date.now() - lastInput > 120000) return;
    usage = F.addUsage(usage, SIT.activeKid().id, new Date(), 0.5);
    store.set('usage', usage);
    recheck();
  }
  setInterval(tick, 30000);
  function recheck() {
    const v = SIT.currentView();
    if (!v || v === 'rest' || SIT.isGrown()) return;
    if (!SIT.kidGate(v).ok) { SIT.stopSpeaking(); if (vidPlaying()) document.getElementById('theater-video').pause(); if (SIT.anywhere) SIT.anywhere.endGracefully('limit'); SIT.reroute(); }
  }
  const vidPlaying = () => { const v = document.getElementById('theater-video'); return v && !v.paused; };
  function updateNav() {
    const c = controls(), kid = !SIT.isGrown();
    document.querySelectorAll('.mainnav a[data-nav]').forEach(a => { a.hidden = kid && c.blocked.indexOf(F.sectionOf(a.getAttribute('data-nav'))) >= 0; });
  }
  SIT.on('mode', () => { updateNav(); if (!SIT.isGrown()) recheck(); });
  /* true unless a grown-up closed this section for kids (used to hide tiles; the router enforces it anyway) */
  SIT.sectionOpen = view => SIT.isGrown() || controls().blocked.indexOf(F.sectionOf(view)) < 0;
  document.addEventListener('DOMContentLoaded', updateNav);
  if (document.readyState !== 'loading') setTimeout(updateNav, 0);

  /* ---------- the rest page, shown instead of a page that is closed right now ---------- */
  const LABEL = {}; F.SECTIONS.forEach(s => { LABEL[s[0]] = s[1]; });
  const ROUTE = { theater: '#/theater', studio: '#/studio', history: '#/history', geo: '#/geo', explore: '#/explore', kids: '#/kids', lessons: '#/lessons', family: '#/family' };
  let root;
  function renderRest(r) {
    clear(root);
    const g = r.gate, kid = SIT.activeKid();
    if (!g) {
      root.appendChild(h('header', { class: 'view-head' }, h('h1', null, 'Everything is open'), h('p', { class: 'lede' }, 'Nothing is closed right now.'), h('a', { class: 'btn btn-primary', href: '#/home' }, 'Go home')));
      return;
    }
    const icon = g.reason === 'section' ? '🔒' : g.reason === 'quiet' ? '🌙' : '⏰';
    const title = g.reason === 'section' ? (LABEL[g.section] || 'This part') + ' is closed for now'
      : g.reason === 'quiet' ? 'Quiet hours: time to rest' : 'That’s all the screen time for today';
    const text = g.reason === 'section' ? 'A grown-up has chosen which parts of Stark IntraTheater are open. You can still explore these:'
      : g.reason === 'quiet' ? 'Stark IntraTheater is resting until ' + g.until + '. Read a book, draw on paper or tell someone about something you learned today.'
        : 'Great exploring, ' + kid.name + '! You can come back tomorrow. How about telling someone one thing you learned today?';
    const open = g.reason === 'section' ? F.SECTIONS.filter(s => controls().blocked.indexOf(s[0]) < 0) : [];
    const wanted = r.wanted || '#/home';
    const card = h('section', { class: 'card rest-card' },
      h('div', { class: 'rest-icon', 'aria-hidden': 'true' }, icon),
      h('h1', null, title),
      h('p', { class: 'lede' }, text),
      open.length ? h('div', { class: 'chips' }, open.map(s => h('a', { class: 'chip', href: ROUTE[s[0]] }, s[1]))) : null,
      h('div', { class: 'row center' },
        h('a', { class: 'btn', href: '#/home' }, '🏠 Home'),
        g.reason === 'time' ? h('button', { type: 'button', class: 'btn', onclick: () => SIT.requestGrown(() => {
          usage = F.addBonus(usage, kid.id, new Date(), 15); store.set('usage', usage);
          SIT.lockToKids(true); SIT.toast('15 more minutes for ' + kid.name + '.'); SIT.go(wanted);
        }) }, '⏱️ Grown-up: add 15 minutes') : null,
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => SIT.requestGrown(() => SIT.go(wanted)) }, '🔑 Grown-up: unlock')),
      h('p', { class: 'fine' }, 'Grown-ups can change these limits in Grown-ups, Family settings, Kids’ limits.'));
    root.appendChild(card);
  }
  SIT.view('rest', { title: 'Ask a grown-up', navAs: 'home', mount(el) { root = el; }, show: renderRest });

  /* ---------- Family settings card: limits and activity ---------- */
  const TIME_OPTS = [[0, 'No daily limit'], [15, '15 minutes'], [30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], [90, '1 hour 30'], [120, '2 hours'], [180, '3 hours']];
  const fmtMin = m => (m >= 60 ? Math.floor(m / 60) + ' h ' + Math.round(m % 60) + ' min' : Math.round(m) + ' min');
  SIT.controlsCard = function (rerender) {
    const fam = SIT.family();
    const save = c => { fam.settings.controls = F.sanitizeControls(c); SIT.saveFamily(); updateNav(); };
    const c = controls();
    const boxes = F.SECTIONS.map(s => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: c.blocked.indexOf(s[0]) < 0, onchange: e => {
        const cur = controls(); cur.blocked = cur.blocked.filter(x => x !== s[0]); if (!e.target.checked) cur.blocked.push(s[0]); save(cur);
      } }), h('span', null, s[1])));
    const daily = h('select', { id: 'set-daily', onchange: e => { const cur = controls(); cur.dailyMin = +e.target.value; save(cur); } },
      TIME_OPTS.map(o => h('option', { value: String(o[0]) }, o[1])));
    daily.value = String(TIME_OPTS.some(o => o[0] === c.dailyMin) ? c.dailyMin : 0);
    const qFrom = h('input', { type: 'time', id: 'set-qfrom', value: c.quietFrom || '' });
    const qTo = h('input', { type: 'time', id: 'set-qto', value: c.quietTo || '' });
    const qMsg = h('p', { class: 'fine', 'aria-live': 'polite' }, c.quietFrom ? 'Quiet hours: ' + c.quietFrom + ' to ' + c.quietTo + '.' : 'No quiet hours set.');
    const applyQuiet = () => {
      const cur = controls(); cur.quietFrom = qFrom.value; cur.quietTo = qTo.value;
      const ok = F.sanitizeControls(cur);
      if (qFrom.value && qTo.value && !ok.quietFrom) { qMsg.textContent = 'Pick two different times.'; return; }
      save(cur); qMsg.textContent = ok.quietFrom ? 'Quiet hours: ' + ok.quietFrom + ' to ' + ok.quietTo + '.' : 'No quiet hours set.';
    };
    const now = new Date();
    const activity = SIT.family().kids.map(k => {
      const week = F.weekMinutes(usage, k.id, now), max = Math.max(30, ...week.map(d => d.min));
      const p = SIT.progress(k.id);
      return h('div', { class: 'act-kid' },
        h('h3', null, h('span', { 'aria-hidden': 'true' }, k.avatar + ' '), k.name, h('span', { class: 'muted small' }, ' · today ' + fmtMin(week[6].min))),
        h('div', { class: 'act-bars', role: 'img', 'aria-label': k.name + ', minutes in the last 7 days: ' + week.map(d => d.label + ' ' + Math.round(d.min)).join(', ') },
          week.map(d => h('span', { class: 'act-bar' }, h('span', { class: 'act-fill', style: 'height:' + Math.round(100 * d.min / max) + '%' }), h('span', { class: 'act-day' }, d.label)))),
        h('p', { class: 'muted small' }, [[(p.seen || []).length, 'moment', ' explored'], [(p.sources || []).length, 'source', ' read'], [(p.writing || []).length, 'story', ' in Story Studio', 'stories'],
          [(p.exhibits || []).length, 'museum exhibit', ''], [Object.keys(p.best || {}).length, 'quiz', ' played', 'quizzes']].map(x => x[0] + ' ' + (x[0] === 1 ? x[1] : x[3] || x[1] + 's') + x[2]).join(' · ') + ' · ⭐ ' + (p.stars || 0)));
    });
    return h('section', { class: 'card', id: 'kids-limits' },
      h('h2', null, 'Kids’ limits'),
      h('p', { class: 'muted' }, 'These apply in Kids mode to every child profile; Grown-up mode is never limited. They are checked every time a page opens and again every 30 seconds. Time counts only while the app is open, in front and in use.'),
      h('fieldset', { class: 'limits-sections' }, h('legend', null, 'Open for kids'), boxes),
      h('div', { class: 'form-grid' },
        h('label', { for: 'set-daily' }, 'Daily screen time'), daily,
        h('label', { for: 'set-qfrom' }, 'Quiet hours from'), qFrom,
        h('label', { for: 'set-qto' }, 'Quiet hours until'), qTo),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-small', onclick: applyQuiet }, 'Save quiet hours'),
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => { qFrom.value = qTo.value = ''; applyQuiet(); } }, 'No quiet hours')),
      qMsg,
      h('h3', null, 'Activity this week'),
      h('div', { class: 'act-list' }, activity),
      h('div', { class: 'row' }, SIT.armBtn('Clear activity history', 'Tap again to clear it', () => { usage = {}; store.set('usage', usage); SIT.toast('Activity history cleared.'); if (rerender) rerender(); }, 'btn-small')),
      h('p', { class: 'fine' }, 'Like the PIN, these limits are a family tool, not strong security: they live in this browser, and clearing the browser’s data removes them.'));
  };
})();
