/* Stark Math. Boot and hash router. */
(function () {
  'use strict';
  const SM = window.SM;
  const { $, h, clear } = SM;
  const main = $('#main');
  let current = null;
  const STUDY = ['review', 'placement', 'worksheets', 'words', 'algebra', 'fluency', 'curriculum', 'countrymaps', 'report'];

  function parseHash() {
    const raw = (location.hash || '#/home').slice(2), qi = raw.indexOf('?');
    const path = (qi < 0 ? raw : raw.slice(0, qi)).split('/').filter(Boolean), q = {};
    if (qi >= 0) raw.slice(qi + 1).split('&').forEach(kv => { const [k, v] = kv.split('='); if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { name: path[0] || 'home', arg: path[1] ? decodeURIComponent(path[1]) : '', q };
  }
  function cleanup(el) { if (!el) return; if (el._cleanup) { try { el._cleanup(); } catch (e) { /* ignore */ } el._cleanup = null; } el.querySelectorAll('*').forEach(n => { if (n._cleanup) { try { n._cleanup(); } catch (e) { /* ignore */ } n._cleanup = null; } }); }
  function route() {
    const r = parseHash();
    cleanup(main); SM.stopSpeech(); clear(main); document.querySelectorAll('.print-overlay').forEach(x => x.remove()); // a print view never outlives its screen
    const v = SM.views[r.name] ? r.name : 'home';
    const navOf = v === 'lesson' ? 'learn' : STUDY.includes(v) ? 'study' : v;
    document.querySelectorAll('.mainnav a').forEach(a => { const on = a.dataset.nav === navOf; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    try { SM.views[v](main, r.q, r.arg); }
    catch (e) { console.error(e); main.append(h('div', { class: 'card warn' }, h('h2', null, 'Something went wrong on this screen'), h('p', null, String(e && e.message || e)), h('a', { href: '#/home' }, 'Back to Home'))); }
    document.title = (v === 'home' ? '' : (v === 'lesson' && SM.SKILL[r.arg] ? SM.SKILL[r.arg].title : v[0].toUpperCase() + v.slice(1)) + ' · ') + 'Stark Math' + (SM.edition.trial ? ' (free trial)' : '');
    if (current !== null) main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    current = v;
  }
  function chip() {
    const p = SM.profile(), { lv, df } = SM.level();
    const av = $('.profile-avatar'); av.textContent = p.name.slice(0, 1).toUpperCase(); av.style.background = SM.COLORS[p.color % SM.COLORS.length];
    $('.profile-name').textContent = p.name; $('.profile-mode').textContent = SM.LEVELS[lv].name + ' · ' + SM.DIFFS[df].name;
  }
  /* Safe mode: stored data could not be read, so the app is read-only and shows how to save the raw data. */
  if (SM.safeMode) {
    const raw = SM.safeMode.raw;
    const bar = h('div', { class: 'safe-banner', role: 'alert' },
      h('p', null, 'Some saved data on this device could not be read, so Stark Math has opened in read-only mode. Nothing has been changed or overwritten. You can save a copy of the raw data below.'),
      SM.btn('Export raw data', () => SM.download('stark-math-raw-data.json', JSON.stringify(raw, null, 1), 'application/json'), 'btn-small'));
    main.parentNode.insertBefore(bar, main);
  } else if (SM.recovered && SM.recovered.length) {
    setTimeout(() => SM.toast('Some saved data was damaged, so the last good copy was restored.'), 600);
  }
  SM.applyTheme();
  $('#profile-chip').addEventListener('click', () => SM.views.profileDialog());
  $('#skip-link').addEventListener('click', () => main.focus());
  SM.on('profile', () => { chip(); route(); });
  SM.on('level', chip);
  SM.views.settings && (SM.views.about = m => { location.hash = '#/settings'; });
  window.addEventListener('hashchange', route);
  chip(); route();
})();
