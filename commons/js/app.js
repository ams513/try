/* Stark Commons, by Stark. UI: notebook, graph, share, explorer, owner merge, about. Offline, no network calls. */
(function () {
  'use strict';
  var SC = window.SC, ED = window.SC_EDITION, main = document.getElementById('main');
  var TOPIC_COLOR = { medicine: '#ff8f84', nutrition: '#f2bf62', 'public health': '#55d3a2', safety: '#6aa7ff', education: '#c79bff', other: '#9db5aa' };

  /* ---------- storage (localStorage with in-memory fallback) ---------- */
  var mem = Object.create(null), saveFailed = false;
  function load(k, d) { try { var v = localStorage.getItem('sc.' + k); if (v != null) return JSON.parse(v); } catch (e) { /* blocked or corrupt */ } return k in mem ? mem[k] : d; }
  /* -> true when the browser kept it. A failure is announced once (role=alert) and again after the next success-then-failure. */
  function save(k, v) {
    mem[k] = v;
    try {
      var t = JSON.stringify(v); localStorage.setItem('sc.' + k, t);
      if (localStorage.getItem('sc.' + k) !== t) throw new Error('read-back mismatch');
      if (saveFailed) { saveFailed = false; toast('Saving works again.'); }
      return true;
    } catch (e) {
      if (!saveFailed) { saveFailed = true; toast('Not saved: this browser refused to store your notebook (storage full or blocked). Your work is kept until you close the tab. Use "Back up notebook" now.', true); }
      return false;
    }
  }
  /* ---------- toast: polite for success, assertive and sticky (with a close button) for failures ---------- */
  var toastEl = document.getElementById('toast'), toastTimer = null;
  function toast(text, bad) {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    while (toastEl.firstChild) toastEl.removeChild(toastEl.firstChild);
    toastEl.setAttribute('role', bad ? 'alert' : 'status'); toastEl.setAttribute('aria-live', bad ? 'assertive' : 'polite');
    toastEl.className = 'toast show' + (bad ? ' bad' : '');
    var msg = document.createElement('span'); msg.textContent = text; toastEl.appendChild(msg);
    var x = document.createElement('button'); x.type = 'button'; x.className = 'btn small'; x.textContent = 'Close';
    x.addEventListener('click', function () { toastEl.className = 'toast'; }); toastEl.appendChild(x);
    if (!bad) toastTimer = setTimeout(function hide() { if (toastEl.matches(':hover') || toastEl.contains(document.activeElement)) { toastTimer = setTimeout(hide, 2000); return; } toastEl.className = 'toast'; }, 6000);
  }
  /* Boot: every stored entry goes through the whitelist copy; anything dropped is kept aside in sc.entries.corrupt. */
  function bootEntries() {
    var raw = load('entries', []), r = SC.sanitizeNotebook(raw);
    if (r.dropped) { try { localStorage.setItem('sc.entries.corrupt', JSON.stringify(raw)); } catch (e) { /* no room */ } }
    return r;
  }
  var boot = bootEntries();
  var state = { entries: boot.entries, alias: typeof load('alias', '') === 'string' ? load('alias', '').slice(0, 60) : '', sel: null, bundle: null, mergeOut: null, q: '', topic: '', evidence: '', ai: '', mode: 'list' };
  var keys = window.SC_KEYSTORE.createKeyStore(window.SC_KEYSTORE.idbBackend('stark-commons'), {
    read: function () { var k = load('keys', null); return k && typeof k === 'object' ? k : null; },
    remove: function () { delete mem.keys; try { localStorage.removeItem('sc.keys'); } catch (e) { /* blocked */ } }
  });
  var fileSync = window.SC_KEYSTORE.createFileSync({
    pick: typeof window.showSaveFilePicker === 'function' ? function () { return window.showSaveFilePicker({ suggestedName: 'stark-commons-notebook.json', types: [{ description: 'Stark Commons notebook', accept: { 'application/json': ['.json'] } }] }); } : null,
    now: Date.now, setTimeout: setTimeout.bind(window), clearTimeout: clearTimeout.bind(window)
  });
  function backupObj() { return { format: 'stark-commons-notebook', version: 1, entries: state.entries }; }
  function persist() { save('entries', state.entries); if (fileSync.active()) fileSync.queue(JSON.stringify(backupObj(), null, 2)); }
  fileSync.on(function (s) { if (s.ok === false) toast('Live file sync failed: ' + s.error + '. Your notebook is still in this browser; reconnect the file.', true); });

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'value') el.value = v; else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v; else el.setAttribute(k, v === true ? '' : v);
    });
    kids.forEach(function function_(c) { if (Array.isArray(c)) c.forEach(function_); else if (c != null && c !== false) el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function download(name, obj, mime) {
    var blob = new Blob([typeof obj === 'string' || ArrayBuffer.isView(obj) ? obj : JSON.stringify(obj, null, 2)], { type: mime || 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function readFiles(input) {
    return Promise.all(Array.prototype.map.call(input.files, function (f) {
      if (f.size > SC.MAX_FILE_BYTES) return Promise.resolve({ name: f.name, error: 'file is larger than 20 MB' });
      return new Promise(function (res) { var r = new FileReader(); r.onload = function () { try { res({ name: f.name, json: JSON.parse(r.result) }); } catch (e) { res({ name: f.name, error: 'not valid JSON' }); } }; r.onerror = function () { res({ name: f.name, error: 'could not read file' }); }; r.readAsText(f); });
    }));
  }
  function find(id) { return state.entries.filter(function (e) { return e.id === id; })[0]; }
  function notice(cls, text) { return h('div', { class: 'notice ' + cls, role: 'status' }, text); }
  function pill(e) { return [h('span', { class: 'pill ' + e.evidence }, e.evidence || 'no evidence level'), e.ai && e.ai.used ? h('span', { class: 'pill ai' }, 'AI: ' + e.ai.tool) : null]; }

  /* ---------- Notebook ---------- */
  function viewNotebook() {
    clear(main);
    var listEl = h('ul', { class: 'list', 'aria-label': 'Entries' }), editor = h('div'), search = h('input', { type: 'search', 'aria-label': 'Search entries', placeholder: 'Search your notebook', value: state.q });
    function drawList() {
      clear(listEl);
      var q = state.q.toLowerCase(), shown = state.entries.filter(function (e) { return !q || [e.title, e.findings, e.tags.join(' ')].join(' ').toLowerCase().indexOf(q) >= 0; });
      if (!shown.length) listEl.appendChild(h('li', { class: 'muted small' }, state.entries.length ? 'No match.' : 'No entries yet. Start with "New entry".'));
      shown.forEach(function (e) {
        listEl.appendChild(h('li', null, h('button', { type: 'button', 'aria-current': state.sel === e.id, onclick: function () { state.sel = e.id; drawList(); drawEditor(); } },
          h('b', null, e.title || 'Untitled'), h('span', null, (e.topic || '') + ' - ' + (e.evidence || 'no evidence level')))));
      });
    }
    function drawEditor() {
      clear(editor);
      var e = find(state.sel);
      if (!e) { editor.appendChild(h('div', { class: 'card' }, h('h2', null, 'Research notebook'), h('p', { class: 'lede' }, 'Record a question, what you found, how you found it, and where it comes from. Everything stays on this device until you export a pack.'))); return; }
      var gatesBox = h('div', { class: 'card', id: 'gates-box' });
      function touch() { e.updated = new Date().toISOString(); persist(); drawGates(); drawListQuiet(); }
      function drawListQuiet() { var cur = document.activeElement; var id = cur && cur.id; drawList(); if (id) { var n = document.getElementById(id); if (n) n.focus(); } }
      function drawGates() {
        clear(gatesBox);
        var r = SC.gates(e);
        gatesBox.appendChild(h('h3', null, 'Quality gates'));
        gatesBox.appendChild(h('ul', { class: 'gates' }, r.gates.map(function (g) { return h('li', null, h('span', { class: g.ok ? 'ok' : 'no', 'aria-hidden': 'true' }, g.ok ? 'OK' : 'NO'), h('span', null, g.label, g.ok ? null : h('small', null, g.detail))); })));
        if (r.pii.length) {
          gatesBox.appendChild(h('div', { class: 'pii', role: 'alert' }, h('b', null, 'Personal data warning. Sharing is blocked until this is removed.'),
            h('ul', null, r.pii.map(function (p) { return h('li', null, p.field + ': ' + p.label + ' ', h('code', null, p.text)); })),
            h('button', { type: 'button', class: 'btn small', onclick: function () { ['title', 'question', 'findings', 'method'].forEach(function (k) { if (!(SC.isSealed(e) && SC.PREREG_LOCKED.indexOf(k) >= 0)) e[k] = SC.scrubText(e[k]); }); persist(); drawEditor(); } }, 'Replace flagged text with [removed]'),
            h('p', { class: 'small muted' }, 'The scrubber catches names with titles or cues, emails, phone numbers, birth dates, record numbers, addresses and case-style patient wording. It cannot catch everything: re-read your entry before sharing.')));
        }
        gatesBox.appendChild(r.ok ? h('div', { class: 'notice good' }, 'Ready to share. Open the Share tab to build a signed pack.') : h('div', { class: 'notice' }, 'Not ready to share yet.'));
        var open = r.gates.filter(function (g) { return !g.ok; }).length, said = r.ok ? 'Ready to share.' : 'Not ready to share: ' + open + ' check' + (open === 1 ? '' : 's') + ' open.';
        if (gateStatus.textContent !== said) gateStatus.textContent = said;   // one short live line, only when it changes
        linkErrors(r.schema);
        gatesBox.appendChild(window.SC_LAB_EDITOR(ctx, e));
      }
      var gateStatus = h('p', { class: 'small muted', role: 'status' }), FIELD_ERR = { title: 'f-title', findings: 'f-find', question: 'f-q', method: 'f-method' };
      /* Links schema errors to their fields: aria-invalid plus aria-describedby pointing at the visible message. */
      function linkErrors(schema) {
        Object.keys(FIELD_ERR).forEach(function (k) {
          var ctl = document.getElementById(FIELD_ERR[k]), msg = document.getElementById(FIELD_ERR[k] + '-err');
          if (!ctl || !msg) return;
          var m = schema.filter(function (s) { return s.indexOf(k + ' ') === 0; })[0] || '';
          if (msg.textContent !== m) msg.textContent = m;
          if (m) { ctl.setAttribute('aria-invalid', 'true'); ctl.setAttribute('aria-describedby', msg.id); } else { ctl.removeAttribute('aria-invalid'); ctl.removeAttribute('aria-describedby'); }
        });
      }
      function field(label, key, type, id) {
        var sealed = SC.isSealed(e) && SC.PREREG_LOCKED.indexOf(key) >= 0;
        var ctl = type === 'area' ? h('textarea', { id: id, value: e[key], readonly: sealed, 'aria-readonly': sealed ? 'true' : null }) : h('input', { id: id, type: 'text', value: e[key], readonly: sealed, 'aria-readonly': sealed ? 'true' : null });
        ctl.addEventListener('input', function () { e[key] = ctl.value; touch(); });
        return [h('label', { for: id }, label), ctl, sealed ? h('small', { class: 'muted' }, 'Locked: this entry has a sealed preregistration.') : null, h('small', { id: id + '-err', class: 'field-err' })];
      }
      var topic = h('select', { id: 'f-topic', onchange: function () { e.topic = topic.value; touch(); } }, SC.TOPICS.map(function (t) { return h('option', { value: t, selected: e.topic === t }, t); }));
      var ev = h('select', { id: 'f-ev', onchange: function () { e.evidence = ev.value; touch(); } }, [h('option', { value: '' }, 'Choose...')].concat(SC.EVIDENCE.map(function (t) { return h('option', { value: t, selected: e.evidence === t }, t); })));
      var srcBox = h('div');
      function drawSources() {
        clear(srcBox);
        e.sources.forEach(function (s, i) {
          function sf(k, ph) { var c = h('input', { type: 'text', 'aria-label': 'Source ' + (i + 1) + ' ' + k, placeholder: ph, value: s[k] || '' }); c.addEventListener('input', function () { s[k] = c.value; touch(); }); return c; }
          srcBox.appendChild(h('div', { class: 'src' }, sf('citation', 'Citation (authors, year, title)'), sf('doi', 'DOI, e.g. 10.1000/xyz'), sf('url', 'https://...'),
            h('button', { type: 'button', class: 'btn small danger', 'aria-label': 'Remove source ' + (i + 1), onclick: function () { e.sources.splice(i, 1); touch(); drawSources(); } }, 'Remove')));
        });
      }
      drawSources();
      var tags = h('input', { id: 'f-tags', type: 'text', value: e.tags.join(', '), placeholder: 'comma separated' });
      tags.addEventListener('input', function () { e.tags = tags.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean); touch(); });
      var tool = h('input', { id: 'f-tool', type: 'text', value: e.ai.tool, placeholder: 'e.g. Claude, ChatGPT, a local model', disabled: !e.ai.used });
      tool.addEventListener('input', function () { e.ai.tool = tool.value; touch(); });
      var aiBox = h('input', { type: 'checkbox', id: 'f-ai', checked: e.ai.used, onchange: function () { e.ai.used = aiBox.checked; tool.disabled = !aiBox.checked; touch(); } });
      var hc = h('input', { type: 'checkbox', id: 'f-hc', checked: e.healthClaim, onchange: function () { e.healthClaim = hc.checked; touch(); } });
      var dis = h('input', { type: 'checkbox', id: 'f-dis', checked: e.disclaimer, onchange: function () { e.disclaimer = dis.checked; touch(); } });
      var others = state.entries.filter(function (o) { return o.id !== e.id; });
      var linkBox = h('div', { class: 'checks', role: 'group', 'aria-label': 'Linked entries' }, others.length ? others.map(function (o) {
        var c = h('input', { type: 'checkbox', checked: e.links.indexOf(o.id) >= 0, onchange: function () { e.links = e.links.filter(function (x) { return x !== o.id; }); if (c.checked) e.links.push(o.id); touch(); } });
        return h('label', { class: 'inline' }, c, o.title || 'Untitled');
      }) : h('span', { class: 'muted small' }, 'Add more entries to link them.'));
      /* Sealed preregistration: a plan written before the work, locked with a hash and this device's date. It is not an independent time stamp. */
      function preregCard() {
        var p = e.prereg, sealed = SC.isSealed(e), box = h('div', { class: 'prereg', id: 'prereg-box' }), msg = h('div', { role: 'status' });
        box.appendChild(h('h3', null, 'Preregistration (optional)'));
        box.appendChild(h('p', { class: 'small muted' }, 'Write your hypothesis and analysis plan before you collect or look at results, then seal it. Sealing stores a SHA-256 hash and this device\'s date and time, and locks the title, question, method, hypothesis and analysis plan. Findings stay editable. ' + SC.PREREG_NOTE + ' Preregistrations are not included in contribution packs.'));
        function pf(label, key, id) {
          var c = h('textarea', { id: id, value: (p && p[key]) || '', readonly: sealed, 'aria-readonly': sealed ? 'true' : null, rows: 3 });
          c.addEventListener('input', function () { if (!e.prereg) e.prereg = { hypothesis: '', analysis: '', sealedAt: '', hash: '' }; e.prereg[key] = c.value; touch(); });
          return [h('label', { for: id }, label), c];
        }
        box.appendChild(h('div', null, pf('Hypothesis', 'hypothesis', 'f-hyp'), pf('Analysis plan', 'analysis', 'f-plan')));
        if (!sealed) {
          box.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', id: 'seal-btn', onclick: function () {
            clear(msg);
            if (!e.prereg) e.prereg = { hypothesis: '', analysis: '', sealedAt: '', hash: '' };
            SC.sealPrereg(e).then(function () { persist(); drawEditor(); toast('Preregistration sealed on this device. Keep a copy of the record somewhere else if you want to show it later.'); }, function (err) { msg.appendChild(notice('bad', err.message)); });
          } }, 'Seal this plan'), h('span', { class: 'small muted' }, 'Sealing cannot be undone.')));
        } else {
          var st = h('p', { id: 'seal-state', class: 'small', role: 'status' }, 'Checking...');
          SC.verifyPrereg(e).then(function (v) { st.textContent = v.state === 'valid' ? 'Check: the text matches its seal.' : 'Check: the text does NOT match its seal. It was changed after sealing.'; st.className = 'small ' + (v.state === 'valid' ? '' : 'bad'); });
          box.appendChild(h('div', { class: 'notice good', id: 'seal-info' }, h('b', null, 'Sealed. '), 'Date on this device: ' + new Date(p.sealedAt).toLocaleString() + ' (' + p.sealedAt + '). SHA-256: ', h('code', { id: 'seal-hash' }, p.hash), h('p', { class: 'small', id: 'seal-note' }, 'Not an independent time stamp. Only this device\'s clock and this hash are behind the date.')));
          box.appendChild(st);
          box.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', id: 'seal-save', onclick: function () { download('preregistration-' + p.hash.slice(0, 8) + '.txt', SC.preregRecord(e), 'text/plain'); } }, 'Save the record as a text file')));
        }
        box.appendChild(msg);
        return box;
      }
      var del = h('button', { type: 'button', class: 'btn danger small', onclick: function () {
        if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Click again to delete'; return; }
        state.entries = state.entries.filter(function (x) { return x.id !== e.id; }); state.entries.forEach(function (x) { x.links = x.links.filter(function (l) { return l !== e.id; }); });
        state.sel = null; persist(); drawList(); drawEditor(); } }, 'Delete entry');
      editor.appendChild(h('div', { class: 'card' }, h('h2', null, 'Entry'),
        field('Title', 'title', 'text', 'f-title'), field('Question', 'question', 'area', 'f-q'), field('Findings', 'findings', 'area', 'f-find'), field('Method (how you found it)', 'method', 'area', 'f-method'),
        h('div', { class: 'cols' }, h('div', null, h('label', { for: 'f-topic' }, 'Topic area'), topic), h('div', null, h('label', { for: 'f-ev' }, 'Evidence level'), ev)),
        h('p', { class: 'small muted' }, 'Anecdote: a personal or single case. Observational: patterns in data without a controlled test. Trial: a controlled experiment. Review: a systematic or published review of several studies.'),
        h('label', null, 'Sources'), srcBox,
        h('button', { type: 'button', class: 'btn small', 'data-add-source': '1', onclick: function () { e.sources.push({ citation: '', doi: '', url: '' }); touch(); drawSources(); } }, 'Add source'),
        h('label', { for: 'f-tags' }, 'Tags'), tags,
        h('label', { class: 'inline' }, aiBox, 'AI-assisted: an AI tool helped produce this entry'), h('label', { for: 'f-tool' }, 'AI tool used'), tool,
        h('label', { class: 'inline' }, hc, 'This entry makes a health claim'),
        h('label', { class: 'inline' }, dis, SC.DISCLAIMER + ' (I understand and agree; needed for health claims)'),
        h('label', null, 'Links to other entries'), linkBox, window.SC_FILES_EDITOR(ctx, e, touch), preregCard(), h('div', { class: 'row end' }, del), gateStatus));
      editor.appendChild(gatesBox); drawGates();
    }
    search.addEventListener('input', function () { state.q = search.value; drawList(); });
    main.appendChild(h('h1', null, 'Research notebook'));
    main.appendChild(h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn primary', onclick: function () { if (ED.room(state.entries.length) < 1) { toast('Free trial limit: ' + ED.limit + ' entries. Your notebook is safe and still exports. Buy to add more.', true); return; } var e = SC.newEntry(); e.title = 'New entry'; state.entries.unshift(e); state.sel = e.id; persist(); drawList(); drawEditor(); var t = document.getElementById('f-title'); if (t) { t.focus(); t.select(); } } }, 'New entry'),
      h('button', { type: 'button', class: 'btn', onclick: function () { download('stark-commons-notebook-backup.json', backupObj()); } }, 'Back up notebook'),
      h('label', { class: 'btn' }, 'Restore backup', h('input', { type: 'file', accept: '.json,application/json', class: 'hidden', hidden: true, onchange: function (ev) {
        readFiles(ev.target).then(function (r) {
          var j = r[0] && r[0].json;
          if (r[0] && r[0].error) { alert_(editor, r[0].error + '. Nothing was changed.'); return; }
          if (!j || j.format !== 'stark-commons-notebook' || !Array.isArray(j.entries)) { alert_(editor, 'That is not a notebook backup.'); return; }
          var n = mergeRestored(j.entries);
          persist(); drawList(); toast('Restored ' + n.added + ' new entr' + (n.added === 1 ? 'y' : 'ies') + (n.dropped ? '; ' + n.dropped + ' damaged or duplicate item(s) skipped' : '') + '.');
        }); } })),
      syncControl()));
    if (ED.trial) main.appendChild(trialCard());
    main.appendChild(h('div', { class: 'grid2' }, h('div', { class: 'card' }, h('label', { for: 'q' }, 'Search'), search, h('div', { class: 'row' }), listEl), editor));
    search.id = 'q';
    drawList(); drawEditor();
  }
  function alert_(where, text) { where.prepend(notice('bad', text)); toast(text, true); }
  /* Adds restored entries that are not already in the notebook. -> {added, dropped} */
  function mergeRestored(list) {
    var r = SC.sanitizeNotebook(list), have = Object.create(null), added = 0, space = SC.ATTACH_MAX_TOTAL - SC.attachmentBytes(state.entries);
    state.entries.forEach(function (x) { have[x.id] = 1; });
    r.entries.forEach(function (x) {
      if (!have[x.id] && state.entries.length < SC.MAX_NOTEBOOK && ED.room(state.entries.length) > 0) {
        if (x.attachments) { x.attachments = x.attachments.filter(function (a) { if (a.size > space) return false; space -= a.size; return true; }); if (!x.attachments.length) delete x.attachments; }   // attachments share one budget
        state.entries.push(x); have[x.id] = 1; added++;
      }
    });
    return { added: added, dropped: r.dropped + (r.entries.length - added) };
  }
  /* Live file sync control: one button that connects a file on disk and shows when it was last written. */
  function syncControl() {
    var box = h('span', { class: 'sync' }), st = h('span', { class: 'small muted' });
    function paint(s) {
      clear(st);
      if (!fileSync.active()) return;
      st.textContent = s.ok === false ? 'File sync failed' : s.at ? 'Synced to ' + (s.name || 'file') + ' at ' + new Date(s.at).toLocaleTimeString() : 'Connected to ' + (s.name || 'file');
    }
    if (!fileSync.supported) return h('span', { class: 'small muted' }, 'Live file sync needs a desktop Chromium browser; use "Back up notebook" here.');
    var b = h('button', { type: 'button', class: 'btn', 'aria-pressed': fileSync.active() ? 'true' : 'false', onclick: function () {
      if (fileSync.active()) { fileSync.detach(); b.textContent = 'Sync to a file'; b.setAttribute('aria-pressed', 'false'); toast('Live file sync stopped.'); return; }
      fileSync.attach().then(function () { b.textContent = 'Stop file sync'; b.setAttribute('aria-pressed', 'true'); fileSync.queue(JSON.stringify(backupObj(), null, 2)); fileSync.flush(); toast('Live file sync on: every change is written to the file you chose.'); },
        function (err) { if (err && err.name !== 'AbortError') toast('Could not open that file: ' + err.message, true); });
    } }, fileSync.active() ? 'Stop file sync' : 'Sync to a file');
    fileSync.on(paint); paint(fileSync.status());
    box.appendChild(b); box.appendChild(st);
    return box;
  }

  /* ---------- Graph ---------- */
  function layout(nodes, edges, W, H) {
    var n = nodes.length, i, j, it;
    nodes.forEach(function (d, k) { var a = 2 * Math.PI * k / Math.max(n, 1); d.x = W / 2 + Math.cos(a) * W * .3; d.y = H / 2 + Math.sin(a) * H * .3; d.vx = 0; d.vy = 0; });
    for (it = 0; it < 260; it++) {
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d2 = dx * dx + dy * dy + 40, f = 14000 / d2, d = Math.sqrt(d2);
        nodes[i].vx += dx / d * f; nodes[i].vy += dy / d * f; nodes[j].vx -= dx / d * f; nodes[j].vy -= dy / d * f;
      }
      edges.forEach(function (e) { var a = e[0], b = e[1], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) + .01, f = (d - 200) * .02; a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; });
      nodes.forEach(function (d) { d.vx += (W / 2 - d.x) * .002; d.vy += (H / 2 - d.y) * .002; d.x = Math.min(W - 60, Math.max(60, d.x + d.vx * .6)); d.y = Math.min(H - 30, Math.max(30, d.y + d.vy * .6)); d.vx *= .55; d.vy *= .55; });
    }
  }
  function svg(tag, attrs) { var el = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); }); Array.prototype.slice.call(arguments, 2).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return el; }
  function drawGraph(entries, host, onPick) {
    clear(host);
    var W = 900, H = 440, byId = Object.create(null), nodes = entries.map(function (e) { var d = { e: e }; byId[e.id] = d; return d; }), edges = [], seen = Object.create(null);
    nodes.forEach(function (d) { (d.e.links || []).forEach(function (l) { var o = byId[l], k = [d.e.id, l].sort().join('|'); if (o && !seen[k]) { seen[k] = 1; edges.push([d, o]); } }); });
    if (!nodes.length) { host.appendChild(h('p', { class: 'muted', style: null }, 'Nothing to show yet. Add entries and link them.')); return; }
    layout(nodes, edges, W, H);
    var deg = {}; edges.forEach(function (e) { deg[e[0].e.id] = (deg[e[0].e.id] || 0) + 1; deg[e[1].e.id] = (deg[e[1].e.id] || 0) + 1; });
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Knowledge graph: ' + nodes.length + ' entries, ' + edges.length + ' links' });
    edges.forEach(function (e) { s.appendChild(svg('line', { x1: e[0].x, y1: e[0].y, x2: e[1].x, y2: e[1].y, stroke: '#4d7a69', 'stroke-width': 2, opacity: .8 })); });
    nodes.forEach(function (d) {
      var r = 9 + Math.min(10, (deg[d.e.id] || 0) * 2.5), t = d.e.title || 'Untitled', short = t.length > 24 ? t.slice(0, 23) + '...' : t;
      var a = svg('a', { tabindex: 0, role: 'button', 'aria-label': t + ', ' + (deg[d.e.id] || 0) + ' links' }, svg('circle', { cx: d.x, cy: d.y, r: r, fill: TOPIC_COLOR[d.e.topic] || '#9db5aa', stroke: '#0c1311', 'stroke-width': 2 }), svg('text', { x: d.x, y: d.y + (nodes.indexOf(d) % 2 ? -r - 8 : r + 14), 'text-anchor': 'middle' }, short));
      a.addEventListener('click', function () { onPick(d.e); }); a.addEventListener('keydown', function (k) { if (k.key === 'Enter' || k.key === ' ') { k.preventDefault(); onPick(d.e); } });
      s.appendChild(a);
    });
    host.appendChild(s);
  }
  function legend() { return h('p', { class: 'legend' }, Object.keys(TOPIC_COLOR).map(function (t) { var i = h('i'); i.style.background = TOPIC_COLOR[t]; return h('span', null, i, t); })); }
  function viewGraph() {
    clear(main);
    var box = h('div', { class: 'graphbox' });
    main.appendChild(h('h1', null, 'Knowledge graph'));
    main.appendChild(h('p', { class: 'lede' }, 'Each dot is an entry, each line a link you made. Select a dot to open that entry. Links are made in the entry editor.'));
    main.appendChild(legend()); main.appendChild(box);
    drawGraph(state.entries, box, function (e) { state.sel = e.id; location.hash = '#notebook'; });
  }

  /* ---------- Share ---------- */
  function fingerprint(pub) { return SC.keyFingerprint(pub); }
  function viewShare() {
    clear(main);
    var picked = {}, out = h('div'), lic = h('input', { type: 'checkbox', id: 'c-lic' }), rights = h('input', { type: 'checkbox', id: 'c-rights' }), alias = h('input', { type: 'text', id: 'c-alias', value: state.alias, placeholder: 'A name or pseudonym (public in the pack; or leave blank)' });
    var btn = h('button', { type: 'button', class: 'btn primary', onclick: build }, 'Build signed contribution pack');
    var rows = state.entries.map(function (e) {
      var r = SC.gates(e), c = h('input', { type: 'checkbox', id: 'p-' + e.id, disabled: !r.ok, onchange: function () { picked[e.id] = c.checked; } });
      var fails = r.gates.filter(function (g) { return !g.ok; }).map(function (g) { return g.label; }).join(', ');
      return h('label', { class: 'inline', for: 'p-' + e.id }, c, h('span', null, h('b', null, e.title || 'Untitled'), ' ', pill(e), r.ok ? null : h('span', { class: 'small', style: null }, h('br'), 'Blocked: ' + fails)));
    });
    async function build() {
      clear(out);
      var chosen = state.entries.filter(function (e) { return picked[e.id]; });
      try {
        var kp = await keys.ensure();
        state.alias = alias.value.slice(0, 60); save('alias', state.alias);
        var pack = await SC.buildPack(chosen, { alias: alias.value, keys: kp, licenseConfirmed: lic.checked, rightsConfirmed: rights.checked });
        if (keys.persistent() === false) out.appendChild(notice('bad', 'This browser would not store the signing key, so it lasts only until you close the tab. Your next pack will carry a different key.'));
        var v = await SC.verifyPack(pack);
        download('stark-commons-pack-' + pack.digest.slice(0, 8) + '.json', pack);
        out.appendChild(notice('good', 'Pack built and verified (' + pack.entries.length + ' entries). The file was saved to your downloads. Digest ' + pack.digest.slice(0, 16) + ', signing key ' + await fingerprint(pack.contributor.publicKey) + '. Self-check: ' + (v.ok ? 'signature valid' : v.error)));
        var fp = await fingerprint(pack.contributor.publicKey), g1 = window.SC_LAB_GLYPH(ctx, pack.digest, 'Pack digest'), g2 = window.SC_LAB_GLYPH(ctx, fp, 'Signing key');
        if (g1 && g2) out.appendChild(h('div', { class: 'row glyphs' }, g1, g2, h('p', { class: 'small muted' }, 'Compare these glyphs with the ones the receiver sees to check by eye that the file and key arrived unchanged.')));
      } catch (err) { out.appendChild(notice('bad', err.message)); }
    }
    main.appendChild(h('h1', null, 'Share a contribution pack'));
    main.appendChild(h('p', { class: 'lede' }, 'A pack is a signed JSON file of the entries you choose, offered under CC BY 4.0. Only entries that pass every quality gate can be selected. You send the file to Stark; the owner reviews it before anything is merged and published. Nothing is uploaded from here.'));
    main.appendChild(h('div', { class: 'card' }, h('h2', null, '1. Choose entries'), state.entries.length ? rows : h('p', { class: 'muted' }, 'Your notebook is empty.')));
    main.appendChild(h('div', { class: 'card' }, h('h2', null, '2. Confirm'),
      h('label', { class: 'inline' }, lic, 'I offer these entries under the Creative Commons Attribution 4.0 licence (CC BY 4.0): anyone may reuse them with credit.'),
      h('label', { class: 'inline' }, rights, 'I wrote this work, or I have the right to share it, and it contains no personal data about other people.'),
      h('label', { for: 'c-alias' }, 'Credit name (optional)'), alias,
      h('p', { class: 'small muted' }, 'The pack is signed with a key made in this browser. The private half cannot be exported or read, even by this page; it stays in this browser\'s storage. The signature shows the file was not changed after you made it. It does not prove who you are, and packs can still be rejected on review.'),
      h('div', { class: 'row' }, btn), out));
  }

  /* ---------- Explorer ---------- */
  function srcId(s) { return s.doi ? 'doi:' + s.doi : s.url ? s.url : s.citation; }
  function entryCard(e, open) {
    var d = h('details', { class: 'entry', open: open ? true : null }, h('summary', null, e.title, ' ', pill(e), h('span', { class: 'pill' }, e.topic)),
      h('h4', null, 'Question'), h('p', null, e.question || 'Not stated.'), h('h4', null, 'Findings'), h('p', null, e.findings), h('h4', null, 'Method'), h('p', null, e.method || 'Not stated.'),
      h('h4', null, 'Sources'), h('ul', null, e.sources.map(function (s) { return h('li', null, s.citation, s.doi ? [' - DOI ', h('code', null, s.doi)] : null, s.url ? [' - ', h('span', { class: 'mono' }, s.url)] : null); })),
      e.tags.length ? h('p', null, e.tags.map(function (t) { return h('span', { class: 'tag' }, '#' + t); })) : null,
      h('p', { class: 'small muted' }, 'Contributed by ' + (Array.isArray(e.contributors) && e.contributors.length ? e.contributors : ['anonymous']).join(', ') + '. CC BY 4.0.' + (e.healthClaim ? ' ' + SC.DISCLAIMER : '')));
    return d;
  }
  function viewExplorer() {
    clear(main);
    var results = h('div'), status = h('div'), q = h('input', { type: 'search', id: 'x-q', 'aria-label': 'Search', placeholder: 'Search titles, findings, tags, sources', value: state.q2 || '' });
    var topic = h('select', { id: 'x-topic', 'aria-label': 'Topic' }, [h('option', { value: '' }, 'All topics')].concat(SC.TOPICS.map(function (t) { return h('option', { value: t, selected: state.topic === t }, t); })));
    var ev = h('select', { id: 'x-ev', 'aria-label': 'Evidence level' }, [h('option', { value: '' }, 'Any evidence level')].concat(SC.EVIDENCE.map(function (t) { return h('option', { value: t, selected: state.evidence === t }, t); })));
    var ai = h('select', { id: 'x-ai', 'aria-label': 'AI assistance' }, [h('option', { value: '' }, 'AI or not'), h('option', { value: 'yes', selected: state.ai === 'yes' }, 'AI-assisted'), h('option', { value: 'no', selected: state.ai === 'no' }, 'Not AI-assisted')]);
    var mode = h('select', { id: 'x-mode', 'aria-label': 'View' }, [h('option', { value: 'list' }, 'View: entries'), h('option', { value: 'source', selected: state.mode === 'source' }, 'View: by source'), h('option', { value: 'graph', selected: state.mode === 'graph' }, 'View: graph')]);
    function filtered() {
      var t = (q.value || '').toLowerCase();
      return state.bundle.entries.filter(function (e) {
        return (!topic.value || e.topic === topic.value) && (!ev.value || e.evidence === ev.value) && (!ai.value || (ai.value === 'yes') === !!e.ai.used) &&
          (!t || [e.title, e.question, e.findings, e.tags.join(' '), e.sources.map(function (s) { return s.citation + ' ' + s.doi + ' ' + s.url; }).join(' ')].join(' ').toLowerCase().indexOf(t) >= 0);
      });
    }
    function draw() {
      state.q2 = q.value; state.topic = topic.value; state.evidence = ev.value; state.ai = ai.value; state.mode = mode.value;
      clear(results);
      if (!state.bundle) { results.appendChild(h('p', { class: 'muted' }, 'Load a public bundle to begin.')); return; }
      var list = filtered();
      results.appendChild(h('p', { class: 'muted', role: 'status' }, list.length + ' of ' + state.bundle.entries.length + ' entries'));
      if (state.mode === 'graph') { var gb = h('div', { class: 'graphbox' }); results.appendChild(legend()); results.appendChild(gb); drawGraph(list, gb, function (e) { state.mode = 'list'; mode.value = 'list'; q.value = e.title; draw(); }); return; }
      if (state.mode === 'source') {
        var by = {}; list.forEach(function (e) { e.sources.forEach(function (s) { var k = srcId(s); (by[k] = by[k] || { s: s, es: [] }).es.push(e); }); });
        Object.keys(by).sort().forEach(function (k) { var g = by[k]; results.appendChild(h('div', { class: 'card' }, h('h3', null, g.s.citation), h('p', { class: 'small muted' }, (g.s.doi ? 'DOI ' + g.s.doi : '') + (g.s.url ? ' ' + g.s.url : '')), g.es.map(function (e) { return entryCard(e); }))); });
        return;
      }
      list.forEach(function (e) { results.appendChild(entryCard(e)); });
    }
    function setBundle(b, name) {
      var err = SC.validateBundle(b); clear(status);
      if (err.length) { status.appendChild(notice('bad', 'Cannot load ' + name + ': ' + err.slice(0, 4).join('; '))); return; }
      state.bundle = b; status.appendChild(notice('good', 'Loaded ' + name + ': ' + b.entries.length + ' entries, built ' + (b.built || 'unknown date') + ', licence ' + b.license + '.')); draw();
    }
    [q, topic, ev, ai, mode].forEach(function (c) { c.addEventListener('input', draw); });
    main.appendChild(h('h1', null, 'Commons explorer'));
    main.appendChild(h('p', { class: 'lede' }, 'Open the merged public bundle that Stark publishes and search it offline. Filter by topic and evidence level, or view everything grouped by source.'));
    main.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' },
      h('label', { class: 'btn primary' }, 'Open public bundle (.json)', h('input', { type: 'file', accept: '.json,application/json', hidden: true, id: 'x-file', onchange: function (ev2) { readFiles(ev2.target).then(function (r) { if (r[0].error) { clear(status); status.appendChild(notice('bad', r[0].error)); } else setBundle(r[0].json, r[0].name); }); } })),
      h('button', { type: 'button', class: 'btn', id: 'x-demo', onclick: function () { setBundle(window.SC_SAMPLE, 'demo bundle (invented examples)'); } }, 'Load demo data')), status));
    main.appendChild(h('div', { class: 'card' }, h('div', { class: 'cols' }, q, topic, ev, ai, mode)));
    main.appendChild(results); draw();
  }

  /* ---------- Owner merge ---------- */
  function viewMerge() { clear(main); main.appendChild(window.StarkTrial.card('merge')); }
  function buyLink() { return h('span', { class: 'btn primary', id: 'buy' }, 'Coming soon to the store'); }
  function trialCard() {
    return h('div', { class: 'card trial', id: 'trialcard' }, h('h2', null, 'Free trial'),
      h('p', null, 'You can keep up to ', h('b', null, String(ED.limit)), ' entries in this trial (', h('b', { id: 'trialused' }, String(state.entries.length)), ' used). It never expires and nothing is ever deleted. ' + ((window.StarkTrial || {}).notIncluded || '')),
      h('p', { class: 'small muted' }, 'Back up your notebook any time: the backup file restores straight into the full version, so your work carries over.'), h('div', { class: 'row' }, buyLink()));
  }
  function viewFeedback() {
    clear(main);
    var f = { rating: '', like: '', missing: '' };
    var link = h('a', { class: 'btn primary', id: 'fb-send', href: ED.feedbackUrl(f) }, 'Open my email app');
    function upd() { link.setAttribute('href', ED.feedbackUrl(f)); }
    function area(id, label, key) { var c = h('textarea', { id: id, rows: 4, maxlength: 1200 }); c.addEventListener('input', function () { f[key] = c.value; upd(); }); return [h('label', { for: id }, label), c]; }
    var rate = h('select', { id: 'fb-rating' }, [h('option', { value: '' }, 'Choose...')].concat([1, 2, 3, 4, 5].map(function (n) { return h('option', { value: String(n) }, n + (n === 1 ? ' (poor)' : n === 5 ? ' (great)' : '')); })));
    rate.addEventListener('change', function () { f.rating = rate.value; upd(); });
    main.appendChild(h('h1', null, 'Send feedback'));
    main.appendChild(h('p', { class: 'lede' }, 'Tell Stark what you like and what is missing. This opens your own email app with the message ready to review. Nothing is sent from here: you press send in your mail app, and you can edit or cancel it there.'));
    main.appendChild(h('div', { class: 'card' }, area('fb-like', 'What do you like?', 'like'), area('fb-missing', 'What is missing?', 'missing'), h('label', { for: 'fb-rating' }, 'Rating, 1 to 5'), rate,
      h('p', { class: 'small muted' }, 'The email will include the app name and version (' + ED.name + ' v' + ED.version + (ED.trial ? ', free trial' : '') + ') and your answers, and go to ' + ED.mailTo + '. If nothing opens, no mail app is set up on this device: write to that address yourself.'), h('div', { class: 'row' }, link)));
  }

  /* ---------- About ---------- */
  function viewAbout() {
    clear(main);
    main.appendChild(h('div', { class: 'hero' }, h('h1', null, 'About Stark Commons'), h('p', { class: 'lede' }, 'Stark Commons is a shared, well-organised library of research and AI-assisted findings, built by many people and open to everyone. It is a product of Stark.'), h('p', { class: 'lang-note' }, "This translation is a machine draft, not yet reviewed by a native speaker. To suggest a correction, use the Send feedback button.")));
    main.appendChild(h('div', { class: 'card' }, h('h2', null, 'How it works'), h('ol', null,
      h('li', null, 'You keep a private research notebook on your own device. Nothing is uploaded.'),
      h('li', null, 'When you want to share, your entries must pass quality gates: a stated evidence level, sources for any health claim, a medical safety disclaimer, no personal data, and the AI tool named when AI helped.'),
      h('li', null, 'You export a signed pack under CC BY 4.0 and send it to Stark.'),
      h('li', null, 'The owner reviews packs, merges them, removes duplicates and publishes one public dataset. Anyone can open it in the explorer.'))));
    main.appendChild(h('div', { class: 'card' }, h('h2', null, 'Mission'), h('p', null, 'The aim is to turn many people\'s careful work into knowledge that helps humanitarian work: medical advances, health and nutrition, and non-lethal defense and safety. Profits from Stark products are intended to fund that work.')));
    main.appendChild(h('div', { class: 'card plan', id: 'pledge' }, h('h2', null, 'Planned pledge: 95% of profits'),
      h('p', null, h('b', null, 'This is a planned pledge, not a current promise.'), ' Stark plans to direct 95% of its profits to humanitarian causes.'),
      h('p', null, 'The pledge takes effect only once the owner has set up the legal and charitable structure and published a public accounting of income and giving. Until both exist, the pledge is planned only, and no donation is promised, implied or guaranteed by this app. Any statement about giving will match what was actually given.')));
    main.appendChild(h('div', { class: 'card' }, h('h2', null, 'Honest limits'), h('ul', null,
      h('li', null, 'Research notes are not medical advice. Do not use anything here to diagnose or treat yourself or anyone else.'),
      h('li', null, 'The personal-data scrubber is a safety net, not a guarantee. Always re-read before sharing.'),
      h('li', null, 'A signature proves a pack was not changed after it was made. It does not prove the contributor\'s identity or that the findings are correct.'),
      h('li', null, 'Evidence labels are chosen by contributors and reviewed by the owner; they are guides, not verdicts.'),
      h('li', null, 'All contributions are CC BY 4.0: free to reuse with credit.'))));
    var tpl = document.getElementById('stark-notice-tpl');
    if (tpl && tpl.content) main.appendChild(document.importNode(tpl.content, true));
  }

  /* ---------- router ---------- */
  var ctx = { state: state, h: h, clear: clear, main: main, notice: notice, persist: persist, download: download, load: load, save: save, keys: keys, toast: toast, mergeRestored: mergeRestored };
  var views = { notebook: viewNotebook, graph: viewGraph, lab: function () { window.SC_LAB_VIEW(ctx); }, refs: function () { window.SC_REFS_VIEW(ctx); }, markdown: function () { window.SC_MD_VIEW(ctx); }, share: viewShare, explorer: viewExplorer, merge: viewMerge, about: viewAbout, feedback: viewFeedback };
  function route() {
    var v = (location.hash || '#notebook').slice(1);
    if (!views[v]) v = 'notebook';
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) { if (a.dataset.v === v) a.classList.add('on'), a.setAttribute('aria-current', 'page'); else a.classList.remove('on'), a.removeAttribute('aria-current'); });
    views[v]();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();
  window.SC_APP = { state: state, route: route, keys: keys, fileSync: fileSync };
  if (boot.dropped) toast(boot.dropped + ' damaged or duplicate notebook item(s) were set aside on load (kept in sc.entries.corrupt). Everything else loaded normally.', true);
  /* theme: follows the system until the person picks one */
  var themeBtn = document.getElementById('themebtn');
  function applyTheme(t) { if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); if (themeBtn) themeBtn.setAttribute('aria-pressed', document.documentElement.getAttribute('data-theme') === 'light' || (!t && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'true' : 'false'); }
  applyTheme(load('theme', ''));
  var tb = document.getElementById('trialbadge'); if (tb && ED.trial) tb.hidden = false;
  if (themeBtn) themeBtn.addEventListener('click', function () { var light = themeBtn.getAttribute('aria-pressed') === 'true', t = light ? 'dark' : 'light'; save('theme', t); applyTheme(t); });
  window.SC_LAB_FINDER.install(ctx);
  var sb = document.getElementById('searchbtn');
  if (sb) sb.addEventListener('click', function () { window.SC_LAB_FINDER.open(); });
})();
