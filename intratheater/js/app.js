/* Stark IntraTheater by Stark. Home view, header profile chip and boot. */
(function () {
  'use strict';
  const { h, clear, $, data } = SIT;

  /* ---------- header: profile chip + profile dialog ---------- */
  function renderChip() {
    $('#profile-chip .profile-avatar').textContent = SIT.profileAvatar();
    $('#profile-chip .profile-name').textContent = SIT.profileLabel();
    $('#profile-chip .profile-mode').textContent = SIT.isGrown() ? 'Grown-up mode' : 'Kids mode';
    $('#profile-chip').setAttribute('aria-label', 'Profile: ' + SIT.profileLabel() + ', ' + (SIT.isGrown() ? 'grown-up mode' : 'kids mode') + '. Change profile');
    document.body.classList.toggle('is-grown', SIT.isGrown());
    const icon = document.querySelector('.grown-icon'); if (icon) icon.textContent = SIT.isGrown() ? '🎓' : '🔒';
  }
  function openProfiles() {
    const dlg = $('#profile-dialog'); const list = clear($('#profile-list'));
    const fam = SIT.family();
    fam.kids.forEach(k => {
      const active = !SIT.isGrown() && k.id === fam.activeKid;
      list.appendChild(h('button', {
        type: 'button', class: 'profile-pick' + (active ? ' active' : ''), 'aria-pressed': active ? 'true' : 'false',
        onclick: () => { dlg.close(); if (SIT.isGrown()) SIT.lockToKids(true); SIT.setActiveKid(k.id); SIT.toast('Hello, ' + k.name + '!'); }
      }, h('span', { class: 'pp-avatar', 'aria-hidden': 'true' }, k.avatar), h('span', null, k.name), h('small', null, 'Kids mode')));
    });
    list.appendChild(h('button', {
      type: 'button', class: 'profile-pick grown' + (SIT.isGrown() ? ' active' : ''), 'aria-pressed': SIT.isGrown() ? 'true' : 'false',
      onclick: () => { dlg.close(); if (!SIT.isGrown()) SIT.requestGrown(() => SIT.toast('Grown-up mode. It locks again after a quiet spell.')); }
    }, h('span', { class: 'pp-avatar', 'aria-hidden': 'true' }, '🎬'), h('span', null, 'Grown-ups'), h('small', null, SIT.isGrown() ? 'Active' : 'Needs parent PIN')));
    if (SIT.isGrown()) list.appendChild(h('button', { type: 'button', class: 'btn btn-primary wide', onclick: () => { dlg.close(); SIT.lockToKids(); } }, '🔒 Lock back to Kids mode'));
    dlg.showModal();
  }

  /* ---------- home view ---------- */
  let root;
  function dayIndex(n) { const d = new Date(); return (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % n; }
  function render() {
    if (!root) return;
    clear(root);
    const kid = !SIT.isGrown();
    const p = SIT.progress();
    const ev = data.events[dayIndex(data.events.length)];
    const country = data.countries[(dayIndex(data.countries.length) * 7) % data.countries.length];
    const meta = SIT.store.get('theater.meta', {});
    const recent = Object.keys(meta).map(k => Object.assign({ key: k }, meta[k])).filter(m => m.last && m.pos > 5).sort((a, b) => b.last - a.last).slice(0, 3);

    // first minute: one obvious thing to try that needs no files, settings or manual (the first section kids may open)
    const starts = kid ? [['#/kids', '▶ Start here: Kids Zone'], ['#/history', '▶ Start here: explore history'], ['#/geo', '▶ Start here: explore the world'], ['#/explore', '▶ Start here: Explorers']]
      : [['#/history', '▶ Start here: explore history']];
    const first = starts.find(x => !SIT.sectionOpen || SIT.sectionOpen(x[0].slice(2))) || ['#/theater', '🎬 Family Night'];
    root.appendChild(h('div', { class: 'hero' },
      h('div', { class: 'curtain left', 'aria-hidden': 'true' }), h('div', { class: 'curtain right', 'aria-hidden': 'true' }),
      h('div', { class: 'marquee', 'aria-hidden': 'true' }),
      h('div', { class: 'hero-inner' },
        h('p', { class: 'eyebrow' }, 'Now showing'),
        h('h1', null, 'Stark IntraTheater'),
        h('p', { class: 'hero-by' }, 'by Stark'),
        h('p', { class: 'hero-lede' }, kid
          ? 'Hello, ' + SIT.activeKid().name + '! Watch, draw, explore history and travel the whole wide world.'
          : 'Your family’s private theater: films from your own drive, deep history, geography and film-night planning. Nothing leaves this computer.'),
        h('div', { class: 'row center' },
          h('a', { class: 'btn btn-primary btn-lg start-here', href: first[0] }, first[1]),
          first[0] === '#/theater' ? null : h('a', { class: 'btn btn-lg', href: '#/theater' }, '🎬 Family Night')))));

    root.appendChild(h('p', { class: 'stats' },
      h('span', null, '⭐ ', h('strong', null, String(p.stars || 0)), ' stars'),
      h('span', null, '🏛️ ', h('strong', null, String(p.seen.length)), ' of ' + data.events.length + ' moments explored'),
      !kid ? h('span', null, '📚 ', h('strong', null, String(p.essays.length)), ' of ' + data.essays.length + ' essays read') : null));

    const tiles = [
      ['#/theater', '🎬', 'Theater', 'Play your own videos, queue Family Night, keep chapter notes.'],
      ['#/studio', '🎥', 'Movie Studio', 'Record, edit and export your own family movies. Works with no internet.'],
      ['#/history', '🏛️', 'History Explorer', data.events.length + ' moments from the first stone tools to today.'],
      ['#/geo', '🌍', 'Geography', 'All ' + data.countries.length + ' UN member states, a capitals map and quizzes.'],
      ['#/explore', '🔭', 'Explorers', 'Science, art and music history, a math playground and ten languages.'],
      ['#/kids', '🧸', 'Kids Zone', 'Drawing pad, story builder, maths garden and spelling bee.'],
      ['#/atlas', '🧭', 'Atlas Lab', 'Ask the timeline in plain words, light up your own constellation and press Ctrl+K to jump anywhere.'],
      ['#/family', '👪', 'Family', 'Trivia night for all ages, a museum you curate and the Story Studio.'],
      ['#/history?tab=sources', '📖', 'Primary sources', (data.sources || []).filter(s => !kid || s.level !== 'grown').length + ' real texts from the past, each with a reading guide.'],
      ['#/grown', kid ? '🔒' : '🎓', 'Grown-ups', kid ? 'Essays, film-night planner and hard trivia. Parent PIN needed.' : 'Essays, film-night planner, hard trivia and family settings.']
    ];
    root.appendChild(h('section', { class: 'tiles', 'aria-label': 'Sections' },
      tiles.filter(t => !SIT.sectionOpen || SIT.sectionOpen(t[0].replace(/^#\//, '').split(/[?/]/)[0])).map(t => h('a', { class: 'tile', href: t[0] }, h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, t[1]), h('span', { class: 'tile-title' }, t[2]), h('span', { class: 'tile-text' }, t[3])))));

    const row = h('div', { class: 'home-cards' });
    row.appendChild(h('article', { class: 'card feature' },
      h('p', { class: 'eyebrow' }, 'A moment from history'),
      h('h2', null, h('span', { 'aria-hidden': 'true' }, ev.icon + ' '), ev.title),
      h('p', { class: 'date' }, ev.date),
      h('p', null, kid ? ev.kid : ev.adult),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/history?e=' + ev.id }, 'See it on the timeline'), SIT.speakButton(() => ev.title + '. ' + (kid ? ev.kid : ev.adult)))));
    row.appendChild(h('article', { class: 'card feature' },
      h('p', { class: 'eyebrow' }, 'Country of the day'),
      h('h2', null, SIT.flagEl(country, 'flag-inline'), ' ', country.name),
      h('p', null, 'Capital: ', h('strong', null, country.capital), ' · ', country.continent),
      country.note ? h('p', { class: 'muted' }, country.note) : null,
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/geo?c=' + country.iso2 }, 'Open in Geography'))));
    if (recent.length) {
      row.appendChild(h('article', { class: 'card feature' },
        h('p', { class: 'eyebrow' }, 'Continue watching'),
        h('ul', { class: 'plain' }, recent.map(m => h('li', null, '🎞️ ', h('strong', null, m.name), ' · stopped at ' + SIT.fmtTime(m.pos)))),
        h('p', { class: 'muted' }, 'Open the same file again in the Theater and it picks up where you left off.'),
        h('a', { class: 'btn', href: '#/theater' }, 'Go to the Theater')));
    }
    root.appendChild(row);
  }
  SIT.view('home', { title: 'Home', mount(el) { root = el; }, show: render });
  SIT.on('mode', () => { renderChip(); if (SIT.currentView() === 'home') render(); });
  SIT.on('progress', () => { if (SIT.currentView() === 'home') render(); });

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
  let booted = false;
  function boot() {
    if (booted) return; booted = true;
    $('#profile-chip').addEventListener('click', openProfiles);
    $('#profile-close').addEventListener('click', () => $('#profile-dialog').close());
    $('#skip-link').addEventListener('click', () => { const m = $('#main'); const t = m.querySelector('section:not([hidden]) h1'); (t || m).setAttribute('tabindex', '-1'); (t || m).focus(); });
    renderChip();
    SIT.start();
  }
})();
