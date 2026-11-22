/* Stark IntraTheater by Stark. Atlas Lab: ask the timeline in plain words, the learning constellation, insights and the encrypted vault,
   plus the Ctrl+K command palette. Everything runs on this device; nothing is sent anywhere. */
(function () {
  'use strict';
  const { h, clear, $, data } = SIT;
  const A = SIT.atlas;
  const EV = data.events || [], ERAS = data.eras || [];
  const evById = {}; EV.forEach(e => { evById[e.id] = e; });
  const reduce = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const st = { tab: 'ask', q: '' };
  let root, body, tabs;

  /* ---------- results list shared by Ask ---------- */
  function resultList(res) {
    if (res.empty) return h('p', { class: 'muted' }, 'Try a question like “what happened in Asia between 500 and 1000?”, “oldest moments in Africa” or “inventions after 1800”.');
    if (!res.results.length) return h('p', { class: 'muted' }, 'No moments match that. Try fewer words or a wider range of years.');
    return h('ol', { class: 'at-results' }, res.results.map(e => h('li', null,
      h('a', { class: 'at-hit', href: '#/history?e=' + e.id },
        h('span', { class: 'at-icon', 'aria-hidden': 'true' }, e.icon),
        h('span', { class: 'at-hit-text' }, h('strong', null, e.title), h('small', null, e.date + ' · ' + e.region))))));
  }

  /* ---------- tab: Ask the Timeline ---------- */
  function renderAsk() {
    const out = h('div', { class: 'at-out', 'aria-live': 'polite' });
    const input = h('input', { type: 'search', id: 'at-q', class: 'at-input', placeholder: 'Ask the timeline…', autocomplete: 'off', 'aria-label': 'Ask the timeline a question' });
    input.value = st.q;
    function run() {
      st.q = input.value.trim();
      clear(out);
      if (!st.q) { out.appendChild(resultList({ empty: true })); return; }
      const res = A.ask(st.q, EV, ERAS, 14);
      if (!res.empty) out.appendChild(h('p', { class: 'at-read' }, 'I read that as: ', res.parsed.notes.length ? res.parsed.notes.map(n => h('span', { class: 'at-chip' }, n)) : h('span', { class: 'muted' }, 'everything'), h('span', { class: 'muted' }, '  ' + res.total + ' found')));
      out.appendChild(resultList(res));
    }
    input.addEventListener('input', run);
    const ex = ['what happened in Asia between 500 and 1000', 'oldest moments in Africa', 'inventions after 1800', 'empires in Europe before 1500', 'the 15th century', 'last 100 years'];
    body.appendChild(h('div', { class: 'card at-ask' },
      h('h2', null, 'Ask the Timeline'),
      h('p', { class: 'muted' }, 'Type a question in plain words. It understands years, centuries, regions and eras, and answers from the ' + EV.length + ' moments on this device.'),
      h('div', { class: 'at-box' }, h('label', { class: 'sr-only', for: 'at-q' }, 'Ask the timeline'), input),
      h('div', { class: 'chips' }, ex.map(x => h('button', { type: 'button', class: 'chip', onclick: () => { input.value = x; run(); input.focus(); } }, x))),
      out));
    run();
  }

  /* ---------- tab: Constellation ---------- */
  function renderConstellation() {
    const seen = SIT.progress().seen || [];
    const W = 960, H = 440;
    const cons = A.constellation(EV, seen, W, H);
    const canvas = h('canvas', { class: 'at-canvas', width: String(W), height: String(H), tabindex: '0', role: 'application',
      'aria-label': 'Constellation of ' + EV.length + ' moments, ' + cons.lit + ' explored. Use the arrow keys to move between moments and Enter to open one.' });
    const status = h('p', { class: 'at-status', 'aria-live': 'polite' }, 'Lit stars are moments you have explored. Dim stars are waiting for you.');
    let sel = -1, raf = 0, t0 = 0;
    const nodes = cons.nodes, idx = {}; nodes.forEach((n, i) => { idx[n.id] = i; });
    /* colours and the reduced-motion flag are read once (and again only on a theme change), never per frame */
    let pal = null, still = reduce();
    const readPal = () => { const cs = getComputedStyle(document.documentElement), g = k => cs.getPropertyValue(k).trim() || '#e9b44c'; pal = { bg: g('--bg-2'), gold: g('--gold-2'), muted: g('--muted'), line: g('--line') }; };
    root._repal = () => { readPal(); still = reduce(); start(); };
    readPal();
    function draw(t) {
      const c = canvas.getContext('2d'); if (!c) return;
      const { bg, gold, muted, line } = pal;
      c.clearRect(0, 0, W, H); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      c.font = '12px system-ui, sans-serif'; c.textBaseline = 'middle';
      cons.lanes.forEach((l, i) => {
        const y = 30 + (H - 60) * ((i + 0.5) / cons.lanes.length);
        c.strokeStyle = line; c.globalAlpha = 0.35; c.beginPath(); c.moveTo(30, y); c.lineTo(W - 30, y); c.stroke(); c.globalAlpha = 0.9;
        c.fillStyle = muted; c.fillText(l, 34, y - 10);
      });
      c.globalAlpha = 1; c.strokeStyle = gold; c.lineWidth = 1.2;
      cons.edges.forEach(e => { const a = nodes[idx[e[0]]], b = nodes[idx[e[1]]]; c.globalAlpha = 0.45; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
      /* two batched paths: every dim star in one fill, every lit star in one glowing fill */
      c.globalAlpha = 0.55; c.fillStyle = muted; c.beginPath();
      nodes.forEach(n => { if (!n.lit) { c.moveTo(n.x + n.r, n.y); c.arc(n.x, n.y, n.r, 0, 6.2832); } });
      c.fill();
      c.globalAlpha = 1; c.fillStyle = gold; c.shadowColor = gold; c.shadowBlur = still ? 4 : 10; c.beginPath();
      nodes.forEach((n, i) => { if (n.lit) { const r = n.r * (still ? 1 : 1 + 0.25 * Math.sin(t / 600 + i)); c.moveTo(n.x + r, n.y); c.arc(n.x, n.y, r, 0, 6.2832); } });
      c.fill(); c.shadowBlur = 0;
      if (sel >= 0) { const n = nodes[sel]; c.globalAlpha = 1; c.strokeStyle = gold; c.lineWidth = 2; c.beginPath(); c.arc(n.x, n.y, 11, 0, 6.2832); c.stroke(); }
      c.globalAlpha = 1;
    }
    function loop(t) { draw(t); raf = requestAnimationFrame(loop); }
    function start() { cancelAnimationFrame(raf); if (still) draw(0); else raf = requestAnimationFrame(loop); }
    function pick(i) {
      sel = Math.max(0, Math.min(nodes.length - 1, i)); const n = nodes[sel];
      status.textContent = n.title + ', ' + n.date + ', ' + n.region + (n.lit ? ', explored' : ', not yet explored') + '. Press Enter to open.';
      if (still) draw(0);
    }
    canvas.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); pick(sel + 1); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); pick(sel < 0 ? 0 : sel - 1); }
      else if (ev.key === 'Home') { ev.preventDefault(); pick(0); }
      else if (ev.key === 'End') { ev.preventDefault(); pick(nodes.length - 1); }
      else if (ev.key === 'Enter' && sel >= 0) { ev.preventDefault(); SIT.go('#/history?e=' + nodes[sel].id); }
    });
    canvas.addEventListener('click', ev => {
      const r = canvas.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height;
      let best = -1, bd = 14 * 14;
      nodes.forEach((n, i) => { const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) pick(best);
    });
    const pct = EV.length ? Math.round(100 * cons.lit / EV.length) : 0;
    body.appendChild(h('div', { class: 'card at-cons' },
      h('h2', null, 'Your constellation'),
      h('p', { class: 'muted' }, cons.lit + ' of ' + EV.length + ' moments lit (' + pct + '%). Time runs left to right, one lane per region, and the last 5,000 years get the most room.'),
      h('div', { class: 'row' },
        h('a', { class: 'btn btn-primary', href: '#/history' }, 'Light more stars'),
        h('button', { type: 'button', class: 'btn', onclick: () => { draw(0); canvas.toBlob(b => { if (b) SIT.download('my-constellation.png', b); }, 'image/png'); } }, '🖼️ Save as picture')),
      canvas, status));
    start();
    root._stop = () => { cancelAnimationFrame(raf); root._repal = null; };
  }
  SIT.on('theme', () => { if (root && root._repal) root._repal(); });

  /* ---------- tab: Insights (grown-ups) ---------- */
  function bar(x) {
    const p = x.total ? Math.round(100 * x.seen / x.total) : 0;
    return h('li', { class: 'at-bar' }, h('span', { class: 'at-bar-name' }, x.name), h('span', { class: 'at-bar-track', role: 'img', 'aria-label': x.name + ': ' + x.seen + ' of ' + x.total }, h('span', { class: 'at-bar-fill', style: 'width:' + p + '%' })), h('span', { class: 'at-bar-n' }, x.seen + '/' + x.total));
  }
  function renderInsights() {
    const kid = SIT.activeKid ? SIT.activeKid() : null;
    const ins = A.insights(SIT.progress().seen, EV, ERAS);
    const pace = h('select', { id: 'at-pace', 'aria-label': 'Moments per week' }, [3, 7, 14, 28].map(n => h('option', { value: String(n) }, n + ' a week')));
    const fc = h('strong', null, '');
    const upd = () => { const w = ins.forecast(Number(pace.value)); fc.textContent = w === null ? '' : (w === 0 ? 'done' : w + (w === 1 ? ' week' : ' weeks')); };
    pace.addEventListener('change', upd); upd();
    body.appendChild(h('div', { class: 'card at-ins' },
      h('h2', null, 'Learning insights' + (kid ? ' for ' + kid.name : '')),
      h('p', { class: 'muted' }, 'Worked out on this device from what has been explored. Nothing is sent anywhere.'),
      h('p', { class: 'at-big' }, h('strong', null, ins.pct + '%'), ' of the timeline explored (' + ins.seen + ' of ' + ins.total + ')'),
      h('div', { class: 'at-cols' },
        h('section', null, h('h3', null, 'By era'), h('ul', { class: 'plain' }, ins.eras.map(bar))),
        h('section', null, h('h3', null, 'By region'), h('ul', { class: 'plain' }, ins.regions.map(bar)))),
      h('h3', null, 'Thinnest spots'),
      h('ul', null, ins.gaps.map(g => h('li', null, g.name + (g.region ? ' (region)' : ' (era)') + ': ' + g.seen + ' of ' + g.total + ' explored'))),
      h('h3', null, 'Good next moments'),
      h('ul', { class: 'plain' }, ins.next.map(e => h('li', null, h('a', { href: '#/history?e=' + e.id }, e.icon + ' ' + e.title), ' ', h('small', { class: 'muted' }, e.date + ' · ' + e.region)))),
      h('p', null, h('label', { for: 'at-pace' }, 'At a pace of '), pace, ' the whole timeline takes about ', fc, '.')));
  }

  /* ---------- tab: Vault (grown-ups): encrypted backup ---------- */
  function renderVault() {
    const MIN = A.PASS_MIN, hint = 'Use at least ' + MIN + ' characters. A short phrase of several words works well.';
    const meter = h('p', { class: 'fine', id: 'at-pass-hint' }, hint);
    const err = h('p', { class: 'field-error', id: 'at-pass-err', role: 'alert', hidden: true });
    const pass = h('input', { type: 'password', id: 'at-pass', autocomplete: 'new-password', minlength: String(MIN), 'aria-describedby': 'at-pass-hint at-pass-err' });
    const msg = h('p', { class: 'at-status', 'aria-live': 'polite' });
    const file = h('input', { type: 'file', accept: '.starkvault,application/json', hidden: true });
    const fieldErr = text => { err.textContent = text; err.hidden = !text; if (text) pass.setAttribute('aria-invalid', 'true'); else pass.removeAttribute('aria-invalid'); if (text) pass.focus(); };
    pass.addEventListener('input', () => { const s = A.passStrength(pass.value); fieldErr(''); meter.textContent = pass.value.length < MIN ? hint : 'Passphrase strength: ' + s.label + ' (about ' + s.bits + ' bits).'; });
    const today = () => new Date().toISOString().slice(0, 10);
    const last = () => SIT.store.get('vault.last', null);
    const remember = (created, seq) => { const l = last(); if (!l || seq > l.seq || created > l.created) SIT.store.set('vault.last', { created, seq: Math.max(seq, l ? l.seq : 0) }); };
    let pending = null;
    async function seal() {
      if (pass.value.length < MIN) { fieldErr('Choose a passphrase of at least ' + MIN + ' characters.'); return; }
      if (A.passStrength(pass.value).label === 'weak') { fieldErr('That passphrase is too easy to guess. Add a few more words.'); return; }
      msg.textContent = 'Encrypting…';
      try {
        const o = { app: 'stark-intratheater', version: 1, saved: new Date().toISOString(), data: {} };
        SIT.store.keys().forEach(k => { o.data[k] = SIT.store.get(k, null); });
        const l = last(), seq = (l && l.seq ? l.seq : 0) + 1;
        const sealed = await A.vaultSeal(await SIT.safe.seal(o), pass.value, 0, seq);
        SIT.download('stark-intratheater-' + today() + '.starkvault', JSON.stringify(sealed), 'application/json');
        remember(sealed.created, sealed.seq);
        msg.textContent = 'Vault number ' + sealed.seq + ' saved to your downloads. Keep the passphrase safe: it cannot be recovered.';
      } catch (e) { msg.textContent = 'This browser could not encrypt the vault.'; }
    }
    function restore(c, r) {
      if (SIT.store.damaged().length) { msg.textContent = 'Saved data is in safe mode, so nothing can be restored over it.'; return; }
      const failed = Object.keys(c.backup.data).filter(k => !SIT.store.set(k, c.backup.data[k]));
      if (failed.length) { msg.textContent = 'Only part of the vault could be restored: ' + failed.length + ' item(s) did not fit in this browser’s storage. Nothing was reloaded.'; SIT.toast(msg.textContent, null, true); return; }
      if (r.created) remember(r.created, r.seq);
      msg.textContent = 'Restored. Reloading…'; setTimeout(() => location.reload(), 900);
    }
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = ''; pending = null; if (!f) return;
      if (pass.value.length < 1) { fieldErr('Type the vault passphrase first, then choose the file.'); return; }
      if (f.size > 300 * 1024 * 1024) { msg.textContent = 'That file is too big to be a Stark IntraTheater vault.'; return; }
      msg.textContent = 'Unlocking…';
      let j; try { j = JSON.parse(await f.text()); } catch (e) { msg.textContent = 'That file is not a Stark IntraTheater vault.'; return; }
      const r = await A.vaultOpen(j, pass.value);
      if (!r.ok) { msg.textContent = r.message; return; }
      const c = await SIT.safe.check(JSON.stringify(r.backup));
      if (!c.ok) { msg.textContent = c.message; return; }
      const older = A.rollbackNote(r, last());
      if (older) { pending = () => restore(c, r); clear(msg); msg.appendChild(h('span', null, older + ' ')); msg.appendChild(h('button', { type: 'button', class: 'btn btn-small', onclick: () => { if (pending) pending(); pending = null; } }, 'Restore the older vault anyway')); return; }
      restore(c, r);
    });
    body.appendChild(h('div', { class: 'card at-vault' },
      h('h2', null, '🔐 Family vault'),
      h('p', { class: 'muted' }, 'A backup that is locked with a passphrase, so a copy on a USB stick or in a drawer stays private. It uses your browser’s built-in encryption (AES-256-GCM, key made with PBKDF2 and 600,000 rounds). Nothing is uploaded, and there is no way to recover a lost passphrase.'),
      h('div', { class: 'form-grid' }, h('label', { for: 'at-pass' }, 'Passphrase'), pass), meter, err,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: seal }, '🔒 Save encrypted vault'),
        h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, '🔓 Open a vault file'), file),
      msg,
      h('p', { class: 'fine' }, 'Every vault carries its date and number sealed inside it, so the app warns before an older vault replaces newer data, and an edited vault file will not open.')));
  }

  /* ---------- view ---------- */
  const TABS = [['ask', 'Ask the Timeline', false], ['stars', 'Constellation', false], ['insights', 'Insights', true], ['vault', 'Vault', true]];
  function show() {
    if (!root) return;
    if (root._stop) root._stop();
    clear(tabs); clear(body);
    const grown = SIT.isGrown();
    if (!grown && (st.tab === 'insights' || st.tab === 'vault')) st.tab = 'ask';
    TABS.filter(t => grown || !t[2]).forEach(t => tabs.appendChild(h('button', { type: 'button', 'data-tab': t[0], 'aria-pressed': st.tab === t[0] ? 'true' : 'false', onclick: () => { st.tab = t[0]; show(); } }, t[1])));
    if (st.tab === 'stars') renderConstellation(); else if (st.tab === 'insights') renderInsights(); else if (st.tab === 'vault') renderVault(); else renderAsk();
  }
  SIT.view('atlas', {
    title: 'Atlas Lab', navAs: 'atlas',
    mount(el) {
      root = el;
      tabs = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Atlas Lab tools' });
      body = h('div', { class: 'at-body' });
      el.appendChild(h('h1', null, '🧭 Atlas Lab'));
      el.appendChild(h('p', { class: 'muted' }, 'Smart tools for the timeline. Everything runs on this device.'));
      el.appendChild(tabs); el.appendChild(body);
    },
    show(r) {
      if (r && r.q) { if (r.q.tab) st.tab = r.q.tab === 'ask' || r.q.tab === 'stars' || r.q.tab === 'insights' || r.q.tab === 'vault' ? r.q.tab : st.tab; if (r.q.q) { st.q = r.q.q; st.tab = 'ask'; } }
      show();
    },
    hide() { if (root && root._stop) root._stop(); }
  });
  SIT.on('mode', () => { if (SIT.currentView() === 'atlas') show(); });
  SIT.on('progress', () => { if (SIT.currentView() === 'atlas' && st.tab === 'stars') show(); });

  /* ---------- command palette (Ctrl+K or Cmd+K) ---------- */
  const SECTIONS = [['home', 'Home'], ['theater', 'Theater'], ['studio', 'Movie Studio'], ['history', 'History Explorer'], ['geo', 'Geography'], ['explore', 'Explorers'], ['kids', 'Kids Zone'], ['family', 'Family'], ['lessons', 'Lessons'], ['atlas', 'Atlas Lab'], ['grown', 'Grown-ups']];
  let items = null, dlg, input, list, active = 0, shown = [];
  function build() {
    const out = [];
    SECTIONS.forEach(s => { if (!SIT.sectionOpen || SIT.sectionOpen(s[0])) out.push({ label: s[1], sub: 'Go to section', icon: '➡️', hash: '#/' + s[0], boost: 20 }); });
    out.push({ label: 'Primary sources', sub: 'History', icon: '📖', hash: '#/history?tab=sources', boost: 12 });
    out.push({ label: 'Order it (timeline game)', sub: 'History', icon: '🔢', hash: '#/history?tab=order', boost: 4 });
    out.push({ label: 'Trivia Night', sub: 'Family', icon: '🎲', hash: '#/family', boost: 4 });
    out.push({ label: 'My constellation', sub: 'Atlas Lab', icon: '✨', hash: '#/atlas?tab=stars', boost: 8 });
    if (SIT.isGrown()) out.push({ label: 'Family vault (encrypted backup)', sub: 'Atlas Lab', icon: '🔐', hash: '#/atlas?tab=vault', boost: 8 });
    EV.forEach(e => out.push({ label: e.title, sub: e.date + ' · ' + e.region, icon: e.icon, hash: '#/history?e=' + e.id, hay: e.region + ' ' + e.date }));
    (data.countries || []).forEach(c => out.push({ label: c.name, sub: 'Capital: ' + c.capital + ' · ' + c.continent, icon: '🌍', hash: '#/geo?c=' + c.iso2, hay: c.capital }));
    (data.sources || []).filter(s => SIT.isGrown() || s.level !== 'grown').forEach(s => out.push({ label: s.title, sub: 'Primary source · ' + s.date, icon: '📜', hash: '#/history?tab=sources&src=' + s.id, hay: s.author }));
    return out;
  }
  function renderList() {
    const q = input.value.trim();
    shown = q ? A.search(items, q, 8) : items.filter(i => i.boost >= 8).slice(0, 8);
    if (q) shown.push({ label: 'Ask the timeline: “' + q + '”', sub: 'Atlas Lab', icon: '🧭', hash: '#/atlas?q=' + encodeURIComponent(q) });
    active = Math.min(active, shown.length - 1); if (active < 0) active = 0;
    clear(list);
    shown.forEach((it, i) => list.appendChild(h('li', { id: 'pal-' + i, role: 'option', 'aria-selected': i === active ? 'true' : 'false', class: 'pal-item' + (i === active ? ' on' : ''),
      onmousedown: ev => { ev.preventDefault(); choose(i); } },
      h('span', { class: 'pal-icon', 'aria-hidden': 'true' }, it.icon), h('span', { class: 'pal-label' }, it.label), h('small', { class: 'pal-sub' }, it.sub))));
    input.setAttribute('aria-activedescendant', shown.length ? 'pal-' + active : '');
  }
  function choose(i) { const it = shown[i]; if (!it) return; dlg.close(); SIT.go(it.hash); }
  function openPalette() {
    if (!dlg) {
      input = h('input', { type: 'text', class: 'pal-input', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-label': 'Search moments, countries, sources and sections', placeholder: 'Search or jump to…', autocomplete: 'off', spellcheck: 'false' });
      list = h('ul', { id: 'pal-list', class: 'pal-list', role: 'listbox', 'aria-label': 'Results' });
      dlg = h('dialog', { class: 'dialog pal', 'aria-label': 'Command palette' }, h('div', { class: 'pal-body' }, input, list, h('p', { class: 'fine' }, 'Arrow keys to move, Enter to go, Esc to close.')));
      document.body.appendChild(dlg);
      input.addEventListener('input', () => { active = 0; renderList(); });
      input.addEventListener('keydown', ev => {
        if (ev.key === 'ArrowDown') { ev.preventDefault(); active = Math.min(shown.length - 1, active + 1); renderList(); }
        else if (ev.key === 'ArrowUp') { ev.preventDefault(); active = Math.max(0, active - 1); renderList(); }
        else if (ev.key === 'Enter') { ev.preventDefault(); choose(active); }
      });
      dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
    }
    items = build(); input.value = ''; active = 0; renderList();
    if (!dlg.open) dlg.showModal();
    input.focus();
  }
  SIT.openPalette = openPalette;
  document.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')) {
      const d = document.querySelector('dialog[open]:not(.pal)'); if (d) return;
      ev.preventDefault(); openPalette();
    }
  });
  document.addEventListener('DOMContentLoaded', addButton);
  if (document.readyState !== 'loading') setTimeout(addButton, 0);
  function addButton() {
    const chip = $('#profile-chip'); if (!chip || document.getElementById('pal-btn')) return;
    chip.parentNode.insertBefore(h('button', { type: 'button', class: 'icon-btn pal-btn', id: 'pal-btn', 'aria-label': 'Search (Ctrl+K)', title: 'Search (Ctrl+K)', onclick: openPalette }, h('span', { 'aria-hidden': 'true' }, '🔍'), h('span', { class: 'pal-kbd', 'aria-hidden': 'true' }, 'Ctrl K')), chip);
  }
})();
