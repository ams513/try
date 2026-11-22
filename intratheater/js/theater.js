/* Stark IntraTheater by Stark. Theater: local video playlist, resume, chapter notes, Family Night queue.
   Files are opened with the browser's file picker and played from memory (blob URLs). Nothing is uploaded or copied. */
(function () {
  'use strict';
  const { h, clear, store, fmtTime } = SIT;

  let items = [];                         // this session's opened files
  let meta = store.get('theater.meta', {}); // per-file: name, size, pos, dur, notes, last, done
  let queue = store.get('theater.queue', []); // Family Night: list of file keys
  let current = null, queueMode = false, lastSave = 0, external = false;   // external: Anywhere (hands-free) decides what plays next
  let el = {};

  const keyOf = f => f.name + '|' + f.size + '|' + (f.lastModified || 0);
  const base = n => n.replace(/\.[^.]+$/, '').toLowerCase();
  const isVideo = f => /^video\//.test(f.type) || /\.(mp4|m4v|webm|ogv|mov|mkv)$/i.test(f.name);
  const isSub = f => /\.(vtt|srt)$/i.test(f.name);
  const saveMeta = () => store.set('theater.meta', meta);
  const saveQueue = () => store.set('theater.queue', queue);
  const canOpen = () => SIT.isGrown() || SIT.family().settings.kidsOpenFiles;
  const nameOf = key => (meta[key] && meta[key].name) || key.split('|')[0];
  const itemFor = key => items.find(i => i.key === key);

  function addFiles(list) {
    const files = Array.from(list || []);
    const subs = files.filter(isSub);
    let added = 0;
    files.filter(isVideo).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).forEach(f => {
      const key = keyOf(f);
      if (itemFor(key)) return;
      const sub = subs.find(s => base(s.name) === base(f.name) || base(s.name).indexOf(base(f.name) + '.') === 0);
      items.push({ key, name: f.name, size: f.size, url: URL.createObjectURL(f), sub });
      const m = meta[key] || (meta[key] = { name: f.name, size: f.size, pos: 0, dur: 0, notes: [], last: 0 });
      m.name = f.name; added++;
    });
    saveMeta();
    if (added) SIT.toast(added + (added === 1 ? ' video' : ' videos') + ' ready. They play from your drive; nothing is uploaded.');
    else if (files.length) SIT.toast('No video files found there. MP4 and WebM play best.');
    if (!current && items.length) load(items[0], false);
    renderLists();
  }

  function srtToVtt(t) {
    return 'WEBVTT\n\n' + t.replace(/\r/g, '').replace(/^\d+\n(?=\d\d:\d\d)/gm, '').replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
  }
  function attachSubs(it) {
    el.video.querySelectorAll('track').forEach(t => t.remove());
    if (!it.sub) return;
    it.sub.text().then(txt => {
      if (current !== it) return;
      const vtt = /\.srt$/i.test(it.sub.name) ? srtToVtt(txt) : txt;
      const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
      el.video.appendChild(h('track', { kind: 'subtitles', label: 'Subtitles', srclang: 'en', src: url, default: true }));
    }).catch(() => SIT.toast('Could not read the subtitle file.'));
  }

  function load(it, autoplay) {
    savePos(true);
    current = it;
    el.video.src = it.url;
    attachSubs(it);
    el.now.textContent = it.name;
    el.stage.classList.add('has-video');
    SIT.emit('theater-load', { key: it.key, name: it.name });
    const m = meta[it.key];
    el.video.onloadedmetadata = () => {
      m.dur = el.video.duration || 0;
      if (m.pos > 10 && (!m.dur || m.pos < m.dur - Math.min(15, m.dur * 0.1))) {
        el.video.currentTime = m.pos;
        SIT.toast('Resumed at ' + fmtTime(m.pos) + '.', { label: 'Start over', fn: () => { el.video.currentTime = 0; } });
      }
      saveMeta(); renderLists();
    };
    if (autoplay) el.video.play().catch(() => { /* user can press play */ });
    renderNotes(); renderLists();
  }

  function savePos(force) {
    if (!current || !el.video) return;
    const now = Date.now();
    if (!force && now - lastSave < 4000) return;
    lastSave = now;
    const m = meta[current.key]; if (!m) return;
    const t = el.video.currentTime || 0;
    if (t > 0) { m.pos = t; m.last = now; }
    saveMeta();
  }

  function playNextInQueue() {
    const idx = queue.indexOf(current && current.key);
    for (let i = idx + 1; i < queue.length; i++) { const it = itemFor(queue[i]); if (it) { load(it, true); return; } }
    queueMode = false; SIT.toast('That’s the end of Family Night. Goodnight!'); renderLists();
  }
  function startQueue() {
    const first = queue.map(itemFor).find(Boolean);
    if (!first) { SIT.toast('Open tonight’s video files first, then press Start.'); return; }
    queueMode = true; load(first, true); SIT.scrollIntoView(el.stage, 'start');
  }

  /* ---------- notes ---------- */
  function addNote() {
    if (!current) { SIT.toast('Play a video first.'); return; }
    const text = el.noteInput.value.trim(); if (!text) { el.noteInput.focus(); return; }
    const m = meta[current.key];
    m.notes.push({ t: el.video.currentTime || 0, text });
    m.notes.sort((a, b) => a.t - b.t);
    el.noteInput.value = ''; saveMeta(); renderNotes();
  }
  function renderNotes() {
    clear(el.notes);
    el.noteAt.textContent = current ? 'at ' + fmtTime(el.video.currentTime) : '';
    if (!current) { el.notes.appendChild(h('li', { class: 'muted' }, 'Play a video to add chapter notes.')); return; }
    const m = meta[current.key];
    if (!m.notes.length) { el.notes.appendChild(h('li', { class: 'muted' }, 'No notes yet. Mark a favourite scene, a question to talk about, or where to stop tonight.')); return; }
    m.notes.forEach((n, i) => el.notes.appendChild(h('li', { class: 'note' },
      h('button', { type: 'button', class: 'note-jump', onclick: () => { el.video.currentTime = n.t; el.video.play().catch(() => {}); } },
        h('span', { class: 'time' }, fmtTime(n.t)), ' ', n.text),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Delete note at ' + fmtTime(n.t), onclick: () => { const gone = m.notes.splice(i, 1)[0]; saveMeta(); renderNotes(); SIT.toast('Note deleted.', { label: 'Undo', fn: () => { m.notes.splice(i, 0, gone); saveMeta(); renderNotes(); } }); } }, '✕'))));
  }

  /* ---------- playlist + queue ---------- */
  function progressBar(m) {
    const pct = m && m.dur ? Math.min(100, 100 * m.pos / m.dur) : 0;
    return h('span', { class: 'meter thin', 'aria-hidden': 'true' }, h('span', { style: 'width:' + pct + '%' }));
  }
  function renderLists() {
    const grown = SIT.isGrown();
    el.openRow.hidden = !canOpen();
    el.kidNote.hidden = canOpen();
    clear(el.list);
    if (!items.length) el.list.appendChild(h('li', { class: 'muted' }, canOpen() ? 'No videos open yet. Use “Open videos” or drop files here.' : 'No videos open yet. Ask a grown-up to open tonight’s videos.'));
    items.forEach(it => {
      const m = meta[it.key]; const inQ = queue.indexOf(it.key) >= 0;
      el.list.appendChild(h('li', { class: 'pl-item' + (current === it ? ' playing' : '') },
        h('button', { type: 'button', class: 'pl-play', onclick: () => { queueMode = false; load(it, true); } },
          h('span', { class: 'pl-name' }, (current === it ? '▶ ' : '') + it.name),
          h('span', { class: 'pl-meta' }, m && m.dur ? fmtTime(m.pos) + ' / ' + fmtTime(m.dur) : 'Not started', it.sub ? ' · subtitles' : ''),
          progressBar(m)),
        grown ? h('button', { type: 'button', class: 'btn btn-small', 'aria-pressed': inQ ? 'true' : 'false',
          onclick: () => { if (inQ) queue.splice(queue.indexOf(it.key), 1); else queue.push(it.key); saveQueue(); renderLists(); } }, inQ ? '★ In Family Night' : '☆ Add to Family Night') : null));
    });

    clear(el.queue);
    if (!queue.length) el.queue.appendChild(h('li', { class: 'muted' }, grown ? 'Add videos to build tonight’s line-up.' : 'A grown-up can build tonight’s line-up.'));
    queue.forEach((key, i) => {
      const it = itemFor(key);
      el.queue.appendChild(h('li', { class: 'q-item' + (it ? '' : ' missing') + (current && current.key === key ? ' playing' : '') },
        h('span', { class: 'q-num', 'aria-hidden': 'true' }, String(i + 1)),
        h('span', { class: 'q-name' }, nameOf(key), it ? null : h('small', null, 'Open this file again to play it')),
        it ? h('button', { type: 'button', class: 'btn btn-small', onclick: () => { queueMode = true; load(it, true); } }, 'Play') : null,
        grown ? h('span', { class: 'q-tools' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { queue.splice(i - 1, 0, queue.splice(i, 1)[0]); saveQueue(); renderLists(); } }, '▲'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move down', disabled: i === queue.length - 1, onclick: () => { queue.splice(i + 1, 0, queue.splice(i, 1)[0]); saveQueue(); renderLists(); } }, '▼'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove from Family Night', onclick: () => { const gone = queue.splice(i, 1)[0]; saveQueue(); renderLists(); SIT.toast('Removed from Family Night.', { label: 'Undo', fn: () => { queue.splice(i, 0, gone); saveQueue(); renderLists(); } }); } }, '✕')) : null));
    });
    el.startQ.disabled = !queue.some(itemFor);
    el.startQ.classList.toggle('btn-primary', !el.startQ.disabled);   // one main action: open videos until a line-up is ready
    el.openBtn.classList.toggle('btn-primary', el.startQ.disabled);
  }

  /* ---------- view ---------- */
  function mount(root) {
    const fileInput = h('input', { type: 'file', accept: 'video/*,.mkv,.mov,.vtt,.srt', multiple: true, hidden: true, onchange: e => { addFiles(e.target.files); e.target.value = ''; } });
    const dirInput = h('input', { type: 'file', multiple: true, hidden: true, onchange: e => { addFiles(e.target.files); e.target.value = ''; } });
    dirInput.setAttribute('webkitdirectory', '');
    el.video = h('video', { id: 'theater-video', controls: true, playsinline: true, preload: 'metadata' });
    el.video.addEventListener('timeupdate', () => { savePos(false); el.noteAt.textContent = current ? 'at ' + fmtTime(el.video.currentTime) : ''; });
    el.video.addEventListener('pause', () => { savePos(true); renderLists(); });
    el.video.addEventListener('ended', () => {
      if (current) { const m = meta[current.key]; m.pos = 0; m.done = true; m.last = Date.now(); saveMeta(); }
      SIT.emit('theater-ended', { key: current && current.key });
      if (queueMode && !external) playNextInQueue(); else renderLists();
    });
    el.video.addEventListener('error', () => { if (current) SIT.toast('This browser can’t play “' + current.name + '”. MP4 (H.264) and WebM work best.'); });
    window.addEventListener('pagehide', () => savePos(true));

    el.now = h('p', { class: 'now-playing' }, 'Nothing playing yet');
    const skip = s => () => { if (current) el.video.currentTime = Math.max(0, el.video.currentTime + s); };
    el.stage = h('div', { class: 'stage' },
      h('div', { class: 'screen' }, el.video, h('div', { class: 'screen-empty', 'aria-hidden': 'true' }, h('span', null, '🎬'), h('span', null, 'Your film appears here'))),
      h('div', { class: 'stage-bar' }, el.now,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', onclick: skip(-10), 'aria-label': 'Back 10 seconds' }, '⏪ 10s'),
          h('button', { type: 'button', class: 'btn', onclick: () => { if (!current) return; if (el.video.paused) el.video.play().catch(() => {}); else el.video.pause(); } }, '⏯ Play / Pause'),
          h('button', { type: 'button', class: 'btn', onclick: skip(10), 'aria-label': 'Forward 10 seconds' }, '10s ⏩'),
          h('button', { type: 'button', class: 'btn', onclick: () => { const s = el.video; if (current && s.requestFullscreen) s.requestFullscreen().catch(() => {}); } }, '⛶ Full screen'))));

    el.openRow = h('div', { class: 'row' },
      el.openBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => fileInput.click() }, '📂 Open videos'),
      h('button', { type: 'button', class: 'btn', onclick: () => dirInput.click() }, '🗂️ Open a folder'),
      fileInput, dirInput);
    el.kidNote = h('p', { class: 'muted' }, 'A grown-up opens the videos. Then press Play!');
    el.list = h('ul', { class: 'playlist', 'aria-label': 'Playlist' });
    el.queue = h('ol', { class: 'queue', 'aria-label': 'Family Night line-up' });
    el.startQ = h('button', { type: 'button', class: 'btn', onclick: startQueue }, '🍿 Start Family Night');
    el.notes = h('ul', { class: 'notes', 'aria-label': 'Chapter notes' });
    el.noteInput = h('input', { type: 'text', id: 'note-input', maxlength: 200, placeholder: 'e.g. Pause here for snacks', onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } } });
    el.noteAt = h('span', { class: 'muted small' });

    root.appendChild(h('header', { class: 'view-head' },
      h('h1', null, 'Theater'),
      h('p', { class: 'lede' }, 'Play videos from your own computer. Positions, notes and the Family Night line-up are remembered here; the videos themselves never leave your drive.')));
    root.appendChild(h('div', { class: 'theater-grid' },
      el.stage,
      h('aside', { class: 'theater-side' },
        h('section', { class: 'card' }, h('h2', null, 'Playlist'), el.openRow, el.kidNote, el.list),
        h('section', { class: 'card' }, h('h2', null, '🍿 Family Night'), el.queue, h('div', { class: 'row' }, el.startQ)),
        SIT.anywhere ? SIT.anywhere.card(el.stage) : null,
        h('section', { class: 'card' }, h('h2', null, 'Chapter notes ', el.noteAt),
          h('div', { class: 'row nowrap' }, h('label', { class: 'sr-only', for: 'note-input' }, 'Note text'), el.noteInput, h('button', { type: 'button', class: 'btn', onclick: addNote }, 'Add note')),
          el.notes))));
    root.appendChild(h('p', { class: 'fine' }, 'Browsers can’t reopen files on their own, so after closing the app, open the same files again: IntraTheater matches them by name and size and resumes where you stopped. Subtitles: pick a .vtt or .srt file with the same name alongside the video.'));

    root.addEventListener('dragover', e => { if (canOpen()) { e.preventDefault(); root.classList.add('drop'); } });
    root.addEventListener('dragleave', e => { if (e.target === root) root.classList.remove('drop'); });
    root.addEventListener('drop', e => { root.classList.remove('drop'); if (!canOpen()) return; e.preventDefault(); addFiles(e.dataTransfer.files); });
    renderLists(); renderNotes();
  }

  SIT.view('theater', {
    title: 'Theater', mount,
    show() { meta = store.get('theater.meta', meta); renderLists(); },
    hide() { savePos(true); }
  });
  SIT.on('mode', () => { if (el.list) renderLists(); });
  /* The small, explicit surface Anywhere (js/anywhere.js) uses. Nothing here changes Theater when SIT.anywhere is absent. */
  const playable = () => queue.filter(k => itemFor(k));
  SIT.theater = {
    video: () => el.video, stage: () => el.stage, current: () => current && current.key,
    items: () => items.map(i => i.key), queueKeys: () => playable(), nameOf,
    setExternal(v) { external = !!v; if (external) queueMode = false; },
    playKey(key) { const it = itemFor(key); if (!it) return false; queueMode = false; load(it, true); return true; },
    forget() { meta = {}; queue = []; saveMeta(); saveQueue(); if (el.list) { renderLists(); renderNotes(); } }
  };
})();
