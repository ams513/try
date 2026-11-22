/* Stark IntraTheater. Museum Builder: curate an exhibit from history moments, countries, primary sources, art and your own
   cards; write the labels, walk through it like a gallery, save it as a web page or share it as a file. Uses SIT.familyLib. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const F = SIT.familyLib;
  const MAX_EXHIBITS = 20;
  const st = { open: null, addKind: 'event', q: '', walk: -1 };
  let root;

  const list = () => { const p = SIT.progress(); p.exhibits = (Array.isArray(p.exhibits) ? p.exhibits : []).map(F.sanitizeExhibit).filter(Boolean); return p.exhibits; };
  const save = ex => { ex.updated = Date.now(); const L = list(), i = L.findIndex(x => x.id === ex.id), clean = F.sanitizeExhibit(ex); if (i >= 0) L[i] = clean; else L.unshift(clean); SIT.saveProgress(); return clean; };
  const find = id => list().find(x => x.id === id);

  /* used by History and Sources: add a card to the most recent exhibit (or start one) */
  SIT.museum = {
    add(kind, ref) {
      const L = list();
      let ex = L.slice().sort((a, b) => b.updated - a.updated)[0];
      if (!ex) { if (L.length >= MAX_EXHIBITS) return; if (!SIT.edition.canCreate()) { SIT.edition.limitReached(); return; } ex = F.newExhibit('x' + SIT.uid()); }
      if (ex.items.length >= F.MAX_ITEMS) { SIT.toast('That exhibit is full (24 cards). Start a new one in the Museum.'); return; }
      if (ex.items.some(it => it.kind === kind && it.ref === ref)) { SIT.toast('It is already in “' + ex.title + '”.'); return; }
      const it = F.exhibitItem(kind, ref, data, kind + '-' + SIT.uid());
      if (!it) return;
      ex.items.push(it); save(ex);
      SIT.toast('Added to “' + ex.title + '”.', { label: 'Open museum', fn: () => { st.open = ex.id; SIT.go('#/museum'); } });
    }
  };

  function render() {
    if (!root) return;
    clear(root);
    const ex = st.open && find(st.open);
    if (ex && st.walk >= 0) return renderWalk(ex);
    root.appendChild(h('header', { class: 'view-head' },
      h('a', { class: 'btn btn-back btn-small', href: '#/family' }, '⬅ Family'),
      h('h1', null, h('span', { 'aria-hidden': 'true' }, '🏺 '), 'Museum Builder'),
      h('p', { class: 'lede' }, SIT.isGrown() ? 'Be the curator: choose the objects, put them in order and write the labels. Then walk through it, print it or share it.' : 'Make your own museum! Pick things from history and the world, and write a label for each one.')));
    if (ex) renderEditor(ex); else renderList();
  }

  function renderList() {
    const L = list();
    const imp = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(txt => {
        const r = F.readExhibitFile(txt);
        if (!r.ok) { SIT.toast(r.error); return; }
        if (list().length >= MAX_EXHIBITS) { SIT.toast('You have 20 exhibits already. Delete one first.'); return; }
        if (!SIT.edition.canCreate()) { SIT.edition.limitReached(); return; }
        r.exhibit.id = 'x' + SIT.uid(); save(r.exhibit); st.open = r.exhibit.id; render(); SIT.toast('Exhibit imported.');
      });
      e.target.value = '';
    } });
    root.appendChild(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-primary', disabled: L.length >= MAX_EXHIBITS, onclick: () => { if (!SIT.edition.canCreate()) { SIT.edition.limitReached(); return; } const ex = save(F.newExhibit('x' + SIT.uid())); st.open = ex.id; render(); } }, '➕ New exhibit'),
      h('button', { type: 'button', class: 'btn', onclick: () => imp.click() }, '📂 Open a shared exhibit (.json)'), imp));
    if (!L.length) { root.appendChild(h('p', { class: 'muted' }, 'No exhibits yet. Start one, or tap “Add to my museum” on any history moment or primary source.')); return; }
    root.appendChild(h('div', { class: 'lesson-grid' }, L.map(ex => h('button', { type: 'button', class: 'menu-card museum-pick theme-' + ex.theme, onclick: () => { st.open = ex.id; render(); } },
      h('span', { class: 'menu-title' }, ex.title), h('span', { class: 'muted' }, ex.items.length + ' card' + (ex.items.length === 1 ? '' : 's') + (ex.curator ? ' · by ' + ex.curator : '')),
      h('span', { class: 'museum-icons', 'aria-hidden': 'true' }, ex.items.slice(0, 8).map(i => i.icon).join(' '))))));
  }

  function renderEditor(ex) {
    const upd = (k, v) => { ex[k] = v; save(ex); };
    const field = (id, label, key, max, ph) => [h('label', { for: id }, label), h('input', { type: 'text', id, value: ex[key], maxlength: max, placeholder: ph || '', onchange: e => upd(key, e.target.value) })];
    let armed = false;
    root.appendChild(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => { st.open = null; render(); } }, '⬅ All exhibits'),
      h('button', { type: 'button', class: 'btn btn-primary', disabled: !ex.items.length, onclick: () => { st.walk = 0; render(); } }, '🚶 Gallery walk'),
      h('button', { type: 'button', class: 'btn', disabled: !ex.items.length, onclick: () => SIT.download(fileName(ex) + '.html', F.exhibitHTML(ex), 'text/html;charset=utf-8') }, '🖨️ Save as web page'),
      h('button', { type: 'button', class: 'btn', onclick: () => SIT.download(fileName(ex) + '.exhibit.json', JSON.stringify(F.exhibitFile(ex), null, 1), 'application/json') }, '📤 Share file (.json)'),
      h('button', { type: 'button', class: 'btn btn-danger', onclick: e => {
        if (!armed) { armed = true; e.currentTarget.textContent = 'Tap again to delete'; return; }
        const p = SIT.progress(); p.exhibits = list().filter(x => x.id !== ex.id); SIT.saveProgress(); st.open = null; render(); SIT.toast('Exhibit deleted.');
      } }, 'Delete exhibit')));
    root.appendChild(h('section', { class: 'card museum-meta' },
      h('div', { class: 'form-grid' }, field('mx-title', 'Exhibit title', 'title', 80, 'e.g. Inventions that changed the world'),
        field('mx-sub', 'What is it about?', 'subtitle', 160, 'One sentence for visitors'), field('mx-cur', 'Curated by', 'curator', 40, 'Your name')),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Room colour' }, F.THEMES.map(t => h('button', { type: 'button', class: 'chip theme-chip theme-' + t, 'aria-pressed': ex.theme === t ? 'true' : 'false', onclick: () => { upd('theme', t); render(); } }, t[0].toUpperCase() + t.slice(1))))));
    root.appendChild(h('h2', null, 'Exhibit cards ', h('span', { class: 'muted small' }, ex.items.length + ' of ' + F.MAX_ITEMS)));
    if (!ex.items.length) root.appendChild(h('p', { class: 'muted' }, 'Add your first card below.'));
    root.appendChild(h('ol', { class: 'museum-items' }, ex.items.map((it, i) => h('li', { class: 'card museum-item theme-' + ex.theme },
      h('div', { class: 'museum-item-head' },
        h('span', { class: 'museum-icon', 'aria-hidden': 'true' }, it.icon),
        h('div', null, it.kind === 'note'
          ? h('input', { type: 'text', value: it.title, maxlength: 100, 'aria-label': 'Card title', onchange: e => { it.title = e.target.value; save(ex); } })
          : h('h3', null, it.title), it.date ? h('p', { class: 'date' }, it.date) : null),
        h('div', { class: 'museum-moves' },
          h('button', { type: 'button', class: 'icon-btn', disabled: i === 0, 'aria-label': 'Move ' + it.title + ' up', onclick: () => { ex.items = SIT.worldLib.moveIn(ex.items, i, i - 1); save(ex); render(); } }, '▲'),
          h('button', { type: 'button', class: 'icon-btn', disabled: i === ex.items.length - 1, 'aria-label': 'Move ' + it.title + ' down', onclick: () => { ex.items = SIT.worldLib.moveIn(ex.items, i, i + 1); save(ex); render(); } }, '▼'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove ' + it.title, onclick: () => { const gone = ex.items.splice(i, 1)[0]; save(ex); render(); SIT.toast('Card removed.', { label: 'Undo', fn: () => { ex.items.splice(i, 0, gone); save(ex); render(); } }); } }, '✕'))),
      it.fact ? h('p', { class: 'muted' }, it.fact) : null,
      h('label', { for: 'cap-' + it.id }, 'Your label'),
      h('textarea', { id: 'cap-' + it.id, rows: 2, maxlength: 500, value: it.caption, placeholder: 'Tell visitors what they are looking at.', onchange: e => { it.caption = e.target.value; save(ex); } }),
      h('label', { for: 'why-' + it.id }, 'Why I chose it'),
      h('input', { type: 'text', id: 'why-' + it.id, maxlength: 300, value: it.why, onchange: e => { it.why = e.target.value; save(ex); } })))));
    renderAdd(ex);
  }

  /* the add panel: search the app's own collections, or make your own card */
  const KINDS = [['event', '🏛️ History'], ['country', '🌍 Countries'], ['source', '📜 Sources'], ['art', '🎨 Art and music'], ['note', '⭐ My own card']];
  function candidates(kind, q) {
    const m = s => !q || s.toLowerCase().indexOf(q) >= 0, grown = SIT.isGrown();
    if (kind === 'event') return data.events.filter(e => m(e.title + ' ' + e.date + ' ' + e.region)).map(e => [e.id, e.icon + ' ' + e.title, e.date]);
    if (kind === 'country') return data.countries.filter(c => m(c.name + ' ' + c.capital + ' ' + c.continent)).map(c => [c.iso2, c.name, c.capital]);
    if (kind === 'source') return (data.sources || []).filter(s => (grown || s.level !== 'grown') && m(s.title + ' ' + s.author)).map(s => [s.id, '📜 ' + s.title, s.date]);
    if (kind === 'art') return (data.arts || []).filter(a => m(a.title + ' ' + a.by)).map(a => [a.id, '🎨 ' + a.title, a.date]);
    return [];
  }
  function renderAdd(ex) {
    const full = ex.items.length >= F.MAX_ITEMS;
    const results = h('ul', { class: 'museum-results plain', 'aria-live': 'polite' });
    const fill = () => {
      clear(results);
      const c = candidates(st.addKind, st.q.toLowerCase()), have = {};
      ex.items.forEach(it => { have[it.kind + ':' + it.ref] = 1; });
      c.slice(0, 12).forEach(x => results.appendChild(h('li', { class: 'row nowrap' },
        h('span', { class: 'grow' }, h('strong', null, x[1]), h('span', { class: 'muted small' }, ' · ' + x[2])),
        h('button', { type: 'button', class: 'btn btn-small', disabled: full || !!have[st.addKind + ':' + x[0]], 'aria-label': 'Add ' + x[1].replace(/^\S+ /, ''),
          onclick: () => { const it = F.exhibitItem(st.addKind, x[0], data, st.addKind + '-' + SIT.uid()); if (it) { ex.items.push(it); save(ex); render(); } } }, have[st.addKind + ':' + x[0]] ? 'Added' : 'Add'))));
      if (!c.length) results.appendChild(h('li', { class: 'muted' }, 'Nothing matches.'));
      else if (c.length > 12) results.appendChild(h('li', { class: 'muted small' }, (c.length - 12) + ' more: type to narrow the list.'));
    };
    const search = h('input', { type: 'search', id: 'mx-search', value: st.q, placeholder: 'Search…', oninput: e => { st.q = e.target.value.trim(); fill(); } });
    root.appendChild(h('section', { class: 'card museum-add' },
      h('h2', null, 'Add a card'),
      full ? h('p', { class: 'muted' }, 'This exhibit is full. Remove a card to add another.') : null,
      h('div', { class: 'chips', role: 'group', 'aria-label': 'What to add' }, KINDS.map(k => h('button', { type: 'button', class: 'chip', 'aria-pressed': st.addKind === k[0] ? 'true' : 'false', onclick: () => { st.addKind = k[0]; st.q = ''; render(); } }, k[1]))),
      st.addKind === 'note'
        ? h('div', null, h('p', { class: 'muted' }, 'A card for anything: a family heirloom, a drawing you made, a place you visited.'),
          h('button', { type: 'button', class: 'btn btn-primary', disabled: full, onclick: () => { ex.items.push(F.exhibitItem('note', '', data, 'note-' + SIT.uid())); save(ex); render(); } }, '➕ Add my own card'))
        : h('div', null, h('label', { for: 'mx-search', class: 'sr-only' }, 'Search'), search, results)));
    if (st.addKind !== 'note') fill();
  }

  function renderWalk(ex) {
    const n = ex.items.length, i = Math.min(st.walk, n - 1), it = ex.items[i];
    const go = j => { st.walk = Math.max(0, Math.min(n - 1, j)); render(); };
    const panel = h('section', { class: 'gallery theme-' + ex.theme, tabindex: '-1', 'aria-roledescription': 'gallery walk', 'aria-label': ex.title },
      h('p', { class: 'gallery-top' }, ex.title + ' · exhibit ' + (i + 1) + ' of ' + n),
      h('div', { class: 'gallery-icon', 'aria-hidden': 'true' }, it.icon),
      h('h1', null, it.title), it.date ? h('p', { class: 'date' }, it.date) : null,
      it.fact ? h('p', { class: 'gallery-fact' }, it.fact) : null,
      it.caption ? h('p', { class: 'gallery-cap' }, '“' + it.caption + '”') : null,
      it.why ? h('p', { class: 'muted' }, 'Why it is here: ' + it.why) : null,
      h('div', { class: 'row center' },
        h('button', { type: 'button', class: 'btn', disabled: i === 0, onclick: () => go(i - 1) }, '◀ Previous'),
        SIT.speakButton(() => it.title + '. ' + (it.date ? it.date + '. ' : '') + (it.fact || '') + ' ' + (it.caption || '')),
        h('button', { type: 'button', class: 'btn btn-primary', disabled: i === n - 1, onclick: () => go(i + 1) }, 'Next ▶'),
        h('button', { type: 'button', class: 'btn', onclick: () => { st.walk = -1; render(); } }, 'Leave the gallery')));
    panel.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === 'Escape') { st.walk = -1; render(); } });
    root.appendChild(panel);
    panel.focus({ preventScroll: true });
  }
  const fileName = ex => (ex.title || 'exhibit').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'exhibit';

  SIT.view('museum', { title: 'Museum Builder', navAs: 'family', mount(el) { root = el; }, show() { st.walk = -1; render(); } });
  SIT.on('mode', () => { if (SIT.currentView() === 'museum') { st.open = null; render(); } });
})();
