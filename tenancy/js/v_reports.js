/* Stark Tenancy: move-in and move-out condition reports, room by room, with dated photos, sign-off by both parties
   (on one device or on paper), a printable report and a move-in vs move-out comparison. */
(function (root) {
  'use strict';
  var TN = root.TN, ui = TN.ui, h = ui.h, S = TN.store, T = TN.i18n.T, L = TN.i18n.L, D = TN.dates, R = TN.report;

  function all() { return S.get('reports', []); }
  function getR(id) { return all().filter(function (r) { return r.id === id; })[0] || null; }
  function putR(r) { var l = all(), i, f = -1; for (i = 0; i < l.length; i++) { if (l[i].id === r.id) { f = i; } } if (f < 0) { l.push(r); } else { l[f] = r; } return S.set('reports', l); }
  function delR(r) { var ids = []; r.rooms.forEach(function (rm) { ids = ids.concat(rm.photos || []); }); S.set('reports', all().filter(function (x) { return x.id !== r.id; })); return TN.photos.del(ids); }
  function phaseName(r) { return r.phase === 'out' ? T('Move-out report', 'Reporte de salida') : T('Move-in report', 'Reporte de entrada'); }
  function condOpts() { return [{ v: '', l: T('Not checked yet', 'Sin revisar') }].concat(TN.data.conditions.map(function (c) { return { v: c.v, l: L(c) }; })); }
  function condBadge(v) { var c = R.cond(v); return c ? ui.badge(L(c), 'c-' + c.v) : ui.badge(T('Not checked', 'Sin revisar'), 'c-none'); }
  function hashes(r) {
    var ids = [];
    r.rooms.forEach(function (rm) { ids = ids.concat(rm.photos || []); });
    return TN.photos.getMany(ids).then(function (ps) { var m = {}; ps.forEach(function (p) { m[p.id] = p.hash; }); return m; });
  }
  var ST_CLS = { none: 'lv-info', one: 'lv-due', both: 'lv-ok', changed: 'lv-high' };
  function stLabel(st) { return { none: T('Not signed yet', 'Sin firmar'), one: T('Signed by one party', 'Firmado por una parte'), both: T('Signed by both parties', 'Firmado por ambas partes'), changed: T('Changed after signing', 'Cambiado después de firmar') }[st]; }
  function stBadge(st) { return ui.badge(stLabel(st), ST_CLS[st]); }
  function twice(label, again, fn) {
    var armed = false;
    return h('button', { type: 'button', class: 'btn small danger', onclick: function (e) { if (!armed) { armed = true; e.target.textContent = again; return; } fn(); } }, label);
  }

  ui.route('reports', 'Move-in & out', function (main, args) {
    var r = args[0] && args[0] !== 'compare' ? getR(args[0]) : null;
    ui.esReady();
    if (args[0] === 'compare') { compareView(main, args[1], args[2]); return; }
    if (args[0] && !r) { main.appendChild(ui.notice(T('That report was not found.', 'No se encontró ese reporte.'), 'warn')); listView(main); return; }
    if (r && args[1] === 'sign') { signView(main, r); return; }
    if (r && args[1] === 'print') { printView(main, r); return; }
    if (r) { editView(main, r); return; }
    listView(main);
  });

  /* ---------- list and create ---------- */
  function listView(main) {
    var list = all().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }), ins = list.filter(function (r) { return r.phase === 'in'; }), outs = list.filter(function (r) { return r.phase === 'out'; }),
      phase = ins.length ? 'out' : 'in', copyBox = h('div');
    main.appendChild(ui.hero(T('Move-in and move-out reports', 'Reportes de entrada y salida'), T('Walk through each room, rate what you see and take dated photos. Both parties sign at the end, on this device or on paper. Do it again when you move out, then compare the two.',
      'Recorra cada cuarto, califique lo que ve y tome fotos fechadas. Ambas partes firman al final, en este dispositivo o en papel. Repítalo al salir y compare los dos.'), true));
    if (!list.length) { main.appendChild(ui.empty(T('No reports yet. Start your move-in report below: it takes about 20 minutes for a one-bedroom home.', 'Aún no hay reportes. Empiece su reporte de entrada abajo: toma unos 20 minutos en una vivienda de un dormitorio.'))); }
    list.forEach(function (r) {
      var p = R.progress(r), holder = h('span', { class: 'sigstate' });
      hashes(r).then(function (hm) { holder.appendChild(stBadge(R.signStatus(r, hm).state)); });
      main.appendChild(h('section', { class: 'card report-card' }, h('div', { class: 'row between tight' }, h('h3', { text: phaseName(r) + ' · ' + D.pretty(r.date) }), holder),
        h('progress', { max: String(p.total || 1), value: String(p.rated), 'aria-label': T('Items checked', 'Elementos revisados') }),
        h('p', { class: 'small', text: p.rated + ' / ' + p.total + T(' items checked · ', ' elementos revisados · ') + p.rooms + T(' rooms · ', ' cuartos · ') + p.photos + T(' dated photos', ' fotos fechadas') }),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/reports/' + r.id, text: T('Open', 'Abrir') }), h('a', { class: 'btn', href: '#/reports/' + r.id + '/sign', text: T('Sign-off', 'Firmas') }), h('a', { class: 'btn', href: '#/reports/' + r.id + '/print', text: T('Print', 'Imprimir') }))));
    });
    if (ins.length && outs.length) { main.appendChild(ui.card(T('Compare move-in and move-out', 'Comparar entrada y salida'), [h('p', { text: T('See every item that changed between the two reports, side by side.', 'Vea cada elemento que cambió entre los dos reportes, lado a lado.') }), h('a', { class: 'btn primary', href: '#/reports/compare', text: T('Compare the reports', 'Comparar los reportes') })], 'compare-card')); }

    var preset = h('select', { id: 'nr-preset' }, TN.data.presets.map(function (p) { return h('option', { value: p.id }, L(p)); })), date = h('input', { type: 'date', id: 'nr-date', value: ui.today() }), pick = h('div'), copy = h('input', { type: 'checkbox', id: 'nr-copy', checked: true });
    preset.value = 'one';
    function drawPick() {
      ui.clear(pick).appendChild(ui.choice(T('Which report?', '¿Qué reporte?'), [['in', T('Move-in report', 'Reporte de entrada')], ['out', T('Move-out report', 'Reporte de salida')]], phase, function (v) { phase = v; drawPick(); }));
      ui.clear(copyBox);
      if (phase === 'out' && ins.length) { copyBox.appendChild(h('div', { class: 'field check' }, copy, h('label', { for: 'nr-copy', text: T('Use the same rooms and items as the move-in report (best for comparing)', 'Usar los mismos cuartos y elementos que el reporte de entrada (mejor para comparar)') }))); }
    }
    drawPick();
    main.appendChild(ui.card(T('Start a new report', 'Empezar un reporte nuevo'), [pick, h('div', { class: 'form' }, h('div', { class: 'field' }, h('label', { for: 'nr-preset', text: T('Kind of home (you can add or remove rooms)', 'Tipo de vivienda (puede agregar o quitar cuartos)') }), preset),
      h('div', { class: 'field' }, h('label', { for: 'nr-date', text: T('Date of the walk-through', 'Fecha del recorrido') }), date)), copyBox,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var d = D.isIso(date.value) ? date.value : ui.today(), r = phase === 'out' && ins.length && copy.checked ? R.fromReport(ins[0], d) : R.newReport(phase, preset.value, d);
        if (!putR(r) && TN.trial.on()) { return; }
        ui.go('reports/' + r.id);
      } }, T('Create the report', 'Crear el reporte')))], 'new-report'));
    main.appendChild(ui.card(T('Tips for a strong record', 'Consejos para un buen registro'), [h('ul', null,
      h('li', { text: T('Take photos in daylight, wide shots of each wall and close-ups of any marks.', 'Tome fotos con luz de día, de cada pared completa y de cerca de cualquier marca.') }),
      h('li', { text: T('Test what works: taps, lights, outlets, appliances, windows, locks.', 'Pruebe lo que funciona: llaves de agua, luces, enchufes, aparatos, ventanas, cerraduras.') }),
      h('li', { text: T('Write what you see, not what it means: “two scuffs by the door, 10 cm” rather than “damaged”.', 'Escriba lo que ve, no lo que significa: “dos raspones junto a la puerta, 10 cm” en vez de “dañado”.') }),
      h('li', { text: T('Give the other party a copy, and keep your original photos too.', 'Dé una copia a la otra parte y guarde también sus fotos originales.') }))]));
  }

  /* ---------- the report editor ---------- */
  function editView(main, r) {
    var unlocked = false, wrap = h('div'), timer = null;
    function save() { clearTimeout(timer); putR(r); }
    function saveSoon() { clearTimeout(timer); timer = setTimeout(save, 300); }
    function signed() { var s = r.sign || {}; return !!(s.tenant || s.landlord); }
    function draw() {
      var dis = signed() && !unlocked, p = R.progress(r), date = h('input', { type: 'date', id: 'rp-date', value: r.date || '', disabled: dis, onchange: function (e) { if (D.isIso(e.target.value)) { r.date = e.target.value; save(); } } }),
        typeSel = h('select', { id: 'rp-addtype' }, TN.data.roomTypes.map(function (t) { return h('option', { value: t.id }, L(t)); }));
      ui.clear(wrap);
      wrap.appendChild(h('section', { class: 'hero2 small-hero' }, h('h1', { text: phaseName(r) }), h('div', { class: 'row' }, h('label', { for: 'rp-date', class: 'lbl', text: T('Walk-through date', 'Fecha del recorrido') }), date),
        h('progress', { max: String(p.total || 1), value: String(p.rated), 'aria-label': T('Items checked', 'Elementos revisados') }),
        h('p', { class: 'small', id: 'rp-prog', text: p.rated + ' / ' + p.total + T(' items checked · ', ' elementos revisados · ') + p.photos + T(' dated photos', ' fotos fechadas') }),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/reports/' + r.id + '/sign', text: T('Go to sign-off', 'Ir a las firmas') }), h('a', { class: 'btn', href: '#/reports/' + r.id + '/print', text: T('Print', 'Imprimir') }), h('a', { class: 'btn', href: '#/reports', text: T('All reports', 'Todos los reportes') }))));
      if (dis) {
        wrap.appendChild(h('div', { class: 'notice warn' }, T('This report has been signed, so it is locked to keep the record honest. If you change it, the sign-off page will show “Changed after signing” and both parties should sign again. ', 'Este reporte ya fue firmado, así que está bloqueado para mantener el registro honesto. Si lo cambia, la página de firmas mostrará “Cambiado después de firmar” y ambas partes deberán firmar de nuevo. '),
          h('button', { type: 'button', class: 'btn small', onclick: function () { unlocked = true; draw(); } }, T('Edit anyway', 'Editar de todos modos'))));
      }
      r.rooms.forEach(function (rm) { wrap.appendChild(roomCard(rm, dis)); });
      if (!dis) {
        wrap.appendChild(ui.card(T('Add a room', 'Agregar un cuarto'), [h('div', { class: 'row' }, h('label', { for: 'rp-addtype', class: 'sr-only', text: T('Room type', 'Tipo de cuarto') }), typeSel,
          h('button', { type: 'button', class: 'btn', onclick: function () { var rm = R.addRoom(r, typeSel.value); save(); draw(); var el = root.document.getElementById('room-' + rm.id); if (el) { el.scrollIntoView({ block: 'start' }); } } }, T('Add room', 'Agregar cuarto')))]));
      }
      var ex = r.extras = r.extras || {};
      wrap.appendChild(ui.card(T('Keys, meters and other notes', 'Llaves, medidores y otras notas'), [h('div', { class: 'form' }, [['keys', T('Keys, fobs and remotes handed over', 'Llaves, tarjetas y controles entregados'), '2 door keys, 1 mailbox key'], ['meters', T('Meter readings', 'Lecturas de medidores'), 'Electric 04512'], ['other', T('Anything else', 'Algo más'), '']].map(function (x) {
        return h('div', { class: 'field wide' }, h('label', { for: 'rx-' + x[0], text: x[1] }), h('textarea', { id: 'rx-' + x[0], rows: 2, placeholder: x[2], value: ex[x[0]] || '', disabled: dis, oninput: function (e) { ex[x[0]] = e.target.value; saveSoon(); } }));
      }))]));
      wrap.appendChild(h('div', { class: 'row' }, twice(T('Delete this report', 'Borrar este reporte'), T('Press again to delete it and its photos', 'Pulse otra vez para borrarlo con sus fotos'), function () { delR(r).then(function () { ui.toast(T('Report deleted.', 'Reporte borrado.')); ui.go('reports'); }); })));
      wrap.appendChild(ui.legal());
    }
    function progressText() { var p = R.progress(r), el = root.document.getElementById('rp-prog'), pr = wrap.querySelector('progress'); if (el) { el.textContent = p.rated + ' / ' + p.total + T(' items checked · ', ' elementos revisados · ') + p.photos + T(' dated photos', ' fotos fechadas'); } if (pr) { pr.value = p.rated; pr.max = p.total || 1; } }
    function roomCard(rm, dis) {
      var photos = h('div'), count = h('span', { class: 'small' }), sec;
      function done() { var n = rm.items.filter(function (it) { return it.cond; }).length; count.textContent = n + ' / ' + rm.items.length; }
      function drawPhotos() { ui.clear(photos).appendChild(rm.photos.length ? ui.photoGrid(rm.photos, dis ? null : function (id) { rm.photos = rm.photos.filter(function (x) { return x !== id; }); save(); TN.photos.del(id); drawPhotos(); progressText(); }) : ui.empty(T('No photos yet.', 'Aún no hay fotos.'))); }
      done(); drawPhotos();
      sec = h('section', { class: 'card room', id: 'room-' + rm.id },
        h('div', { class: 'row between tight roomhead' }, h('input', { type: 'text', class: 'roomname', value: rm.name, 'aria-label': T('Room name', 'Nombre del cuarto'), disabled: dis, oninput: function (e) { rm.name = e.target.value; saveSoon(); } }), count),
        h('div', { class: 'items' }, rm.items.map(function (it) {
          var row = h('div', { class: 'item c-' + (it.cond || 'none') }), sel = h('select', { 'aria-label': it.name + ': ' + T('condition', 'condición'), disabled: dis, onchange: function (e) { it.cond = e.target.value; row.className = 'item c-' + (it.cond || 'none'); save(); done(); progressText(); } },
            condOpts().map(function (o) { return h('option', { value: o.v }, o.l); }));
          sel.value = it.cond || '';
          row.appendChild(h('span', { class: 'iname', text: it.name }));
          row.appendChild(sel);
          row.appendChild(h('input', { type: 'text', value: it.note || '', placeholder: T('Notes: marks, stains, what works', 'Notas: marcas, manchas, qué funciona'), 'aria-label': it.name + ': ' + T('notes', 'notas'), disabled: dis, oninput: function (e) { it.note = e.target.value; saveSoon(); } }));
          return row;
        })),
        h('div', { class: 'field wide' }, h('label', { for: 'rn-' + rm.id, text: T('Room notes', 'Notas del cuarto') }), h('textarea', { id: 'rn-' + rm.id, rows: 2, value: rm.note || '', disabled: dis, oninput: function (e) { rm.note = e.target.value; saveSoon(); } })),
        h('h4', { text: T('Dated photos', 'Fotos fechadas') }), photos,
        dis ? null : h('div', { class: 'row' }, ui.photoPicker(T('Add photos of this room', 'Agregar fotos de este cuarto'), function () { return phaseName(r) + ': ' + rm.name; }, function (rec) { rm.photos.push(rec.id); save(); drawPhotos(); progressText(); }),
          h('button', { type: 'button', class: 'btn small', onclick: function () { rm.items.forEach(function (it) { if (!it.cond) { it.cond = 'good'; } }); save(); draw(); } }, T('Mark unchecked items Good', 'Marcar lo no revisado como Bueno')),
          twice(T('Remove room', 'Quitar cuarto'), T('Press again to remove', 'Pulse otra vez para quitar'), function () { TN.photos.del(rm.photos); r.rooms = r.rooms.filter(function (x) { return x !== rm; }); save(); draw(); })));
      return sec;
    }
    main.appendChild(wrap);
    draw();
  }

  /* ---------- signature pad (finger, pen or mouse); the drawing is optional, the typed name is the signature ---------- */
  function sigPad() {
    var c = h('canvas', { class: 'sigpad', width: '600', height: '180', role: 'img', 'aria-label': T('Signature pad: draw with a finger, pen or mouse', 'Área de firma: dibuje con el dedo, lápiz o ratón') }), g = c.getContext('2d'), drawing = false, used = false, last = null;
    function pos(e) { var b = c.getBoundingClientRect(); return [(e.clientX - b.left) * c.width / (b.width || 1), (e.clientY - b.top) * c.height / (b.height || 1)]; }
    function bg() { g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = '#c4d0cd'; g.lineWidth = 1; g.beginPath(); g.moveTo(24, 142); g.lineTo(576, 142); g.stroke(); }
    bg();
    c.addEventListener('pointerdown', function (e) { drawing = true; last = pos(e); try { c.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } e.preventDefault(); });
    c.addEventListener('pointermove', function (e) {
      var p;
      if (!drawing) { return; }
      p = pos(e); g.strokeStyle = '#10201e'; g.lineWidth = 2.8; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; used = true; e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { c.addEventListener(ev, function () { drawing = false; }); });
    return { el: h('div', { class: 'sigwrap' }, h('p', { class: 'small', text: T('Draw a signature (optional):', 'Dibuje una firma (opcional):') }), c, h('button', { type: 'button', class: 'btn small', onclick: function () { bg(); used = false; } }, T('Clear', 'Borrar'))),
      empty: function () { return !used; }, data: function () { return c.toDataURL('image/png'); }, canvas: c };
  }
  TN.sigPad = sigPad;

  /* ---------- sign-off ---------- */
  function signView(main, r) {
    var tn = TN.rec.tenancy(), stBox = h('div'), parts = h('div', { class: 'grid2 parties' });
    main.appendChild(ui.hero(T('Sign-off: ', 'Firmas: ') + phaseName(r).toLowerCase(), D.pretty(r.date) + ' · ' + TN.rec.place(tn), true));
    main.appendChild(ui.card(null, [h('p', { text: T('Walk through the report together. Each person reads it room by room, writes a comment about anything they disagree with, and signs. You can also print it and sign on paper.', 'Revisen el reporte juntos. Cada persona lo lee cuarto por cuarto, escribe un comentario sobre lo que no esté de acuerdo y firma. También puede imprimirlo y firmar en papel.') }),
      stBox, h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/reports/' + r.id, text: T('Open the report', 'Abrir el reporte') }), h('a', { class: 'btn', href: '#/reports/' + r.id + '/print', text: T('Print for paper signatures', 'Imprimir para firmar en papel') }))]));
    main.appendChild(parts);
    main.appendChild(ui.notice(T('A signature here is a record that both people reviewed this report on this device. It is not a notarized or certified electronic signature. If you need that, print the report and sign it on paper.', 'Una firma aquí es un registro de que ambas personas revisaron este reporte en este dispositivo. No es una firma notariada ni una firma electrónica certificada. Si la necesita, imprima el reporte y fírmelo en papel.'), 'soft'));
    main.appendChild(ui.legal());
    function refresh() { hashes(r).then(function (hm) { draw(R.signStatus(r, hm)); }); }
    function draw(ss) {
      var msg = { none: T('Nobody has signed yet.', 'Nadie ha firmado todavía.'), one: T('One party has signed. The other party can sign below.', 'Una parte ya firmó. La otra puede firmar abajo.'), both: T('Both parties signed this exact version of the report.', 'Ambas partes firmaron esta misma versión del reporte.'),
        changed: T('The report changed after it was signed. Review the changes together and sign again.', 'El reporte cambió después de firmarse. Revisen los cambios juntos y firmen de nuevo.') }[ss.state];
      ui.clear(stBox).appendChild(h('div', { class: 'verdict ' + ST_CLS[ss.state] }, stBadge(ss.state), h('p', { class: 'vmsg', text: msg }), h('p', { class: 'small' }, T('Report fingerprint (SHA-256 of every room, rating, note and photo): ', 'Huella del reporte (SHA-256 de cada cuarto, calificación, nota y foto): '), h('code', { class: 'fp', text: ss.hash.slice(0, 16) }))));
      ui.clear(parts);
      ['tenant', 'landlord'].forEach(function (p) { parts.appendChild(party(p, ss)); });
    }
    function party(p, ss) {
      var s = (r.sign || {})[p], who = p === 'tenant' ? T('Tenant', 'Inquilino') : T('Landlord or agent', 'Propietario o agente'), name, cm, ok, pad;
      if (s && s.name) {
        return ui.card(who, [h('p', null, h('strong', { text: s.name }), ' · ' + TN.dates.stamp(s.at)), s.sig ? h('img', { class: 'sigimg', src: s.sig, alt: T('Signature of ', 'Firma de ') + s.name }) : h('p', { class: 'small', text: T('Signed with a typed name.', 'Firmado con nombre escrito.') }),
          s.comment ? h('blockquote', { text: s.comment }) : null,
          s.hash === ss.hash ? h('p', { class: 'ok', text: T('Matches the current report.', 'Coincide con el reporte actual.') }) : ui.notice(T('Signed on an earlier version of the report.', 'Firmado sobre una versión anterior del reporte.'), 'warn'),
          h('div', { class: 'row' }, twice(T('Remove this signature', 'Quitar esta firma'), T('Press again to remove', 'Pulse otra vez para quitar'), function () { delete r.sign[p]; putR(r); refresh(); }))], 'party signed');
      }
      name = h('input', { type: 'text', id: 'sn-' + p, value: (p === 'tenant' ? tn.tenantName : tn.landlordName) || '' });
      cm = h('textarea', { id: 'sc-' + p, rows: 2, placeholder: T('Anything you disagree with or want noted (optional)', 'Algo con lo que no esté de acuerdo o quiera anotar (opcional)') });
      ok = h('input', { type: 'checkbox', id: 'sk-' + p });
      pad = sigPad();
      return ui.card(who, [h('div', { class: 'field' }, h('label', { for: 'sn-' + p, text: T('Full name', 'Nombre completo') }), name), pad.el, h('div', { class: 'field' }, h('label', { for: 'sc-' + p, text: T('Comments', 'Comentarios') }), cm),
        h('div', { class: 'field check' }, ok, h('label', { for: 'sk-' + p, text: T('I reviewed this report room by room. It describes the home as I saw it, except for my comments.', 'Revisé este reporte cuarto por cuarto. Describe la vivienda como la vi, salvo mis comentarios.') })),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
          if (!name.value.trim()) { ui.toast(T('Type your full name to sign.', 'Escriba su nombre completo para firmar.')); return; }
          if (!ok.checked) { ui.toast(T('Tick the box to confirm you reviewed the report.', 'Marque la casilla para confirmar que revisó el reporte.')); return; }
          r.sign = r.sign || {};
          r.sign[p] = { name: name.value.trim(), at: TN.photos.stampTime(new Date()), sig: pad.empty() ? '' : pad.data(), comment: cm.value.trim(), hash: ss.hash };
          putR(r); ui.toast(T('Signed.', 'Firmado.')); refresh();
        } }, T('Sign this report', 'Firmar este reporte')))], 'party');
    }
    refresh();
  }

  /* ---------- printable report ---------- */
  function printView(main, r) {
    var tn = TN.rec.tenancy(), sheet = h('article', { class: 'sheet' }), p = R.progress(r), s = r.sign || {}, fp = h('code', { class: 'fp', text: '…' }), ex = r.extras || {};
    main.appendChild(h('div', { class: 'row noprint' }, h('a', { class: 'btn', href: '#/reports/' + r.id, text: T('Back to the report', 'Volver al reporte') }), h('button', { type: 'button', class: 'btn primary', onclick: function () { ui.printEl(sheet); } }, T('Print or save as PDF', 'Imprimir o guardar como PDF'))));
    main.appendChild(ui.notice(T('Print two copies, one for each party, or save a PDF from the print window. Photos print with their date strip.', 'Imprima dos copias, una para cada parte, o guarde un PDF desde la ventana de impresión. Las fotos se imprimen con su franja de fecha.'), 'soft'));
    sheet.appendChild(h('header', { class: 'sheet-head' }, h('h1', { text: r.phase === 'out' ? T('Move-out condition report', 'Reporte de condición de salida') : T('Move-in condition report', 'Reporte de condición de entrada') }),
      h('dl', { class: 'kv' }, h('dt', { text: T('Property', 'Vivienda') }), h('dd', { text: tn.address || '________________________' }), h('dt', { text: T('Tenant', 'Inquilino') }), h('dd', { text: tn.tenantName || '________________' }),
        h('dt', { text: T('Landlord or agent', 'Propietario o agente') }), h('dd', { text: tn.landlordName || '________________' }), h('dt', { text: T('Walk-through date', 'Fecha del recorrido') }), h('dd', { text: D.pretty(r.date) }),
        h('dt', { text: T('Checked', 'Revisado') }), h('dd', { text: p.rated + ' / ' + p.total + T(' items in ', ' elementos en ') + p.rooms + T(' rooms, ', ' cuartos, ') + p.photos + T(' dated photos', ' fotos fechadas') }))));
    r.rooms.forEach(function (rm) {
      sheet.appendChild(h('section', { class: 'sheet-room' }, h('h2', { text: rm.name }), ui.table([T('Item', 'Elemento'), T('Condition', 'Condición'), T('Notes', 'Notas')], rm.items.map(function (it) { return [it.name, condBadge(it.cond), it.note || '']; }), 'ptable'),
        rm.note ? h('p', null, h('strong', { text: T('Room notes: ', 'Notas del cuarto: ') }), rm.note) : null,
        rm.photos.length ? h('div', { class: 'sheet-photos' }, rm.photos.map(function (id) { return ui.photoImg(id, rm.name, 'pimg'); })) : null));
    });
    if (ex.keys || ex.meters || ex.other) { sheet.appendChild(h('section', { class: 'sheet-room' }, h('h2', { text: T('Keys, meters and other notes', 'Llaves, medidores y otras notas') }), h('dl', { class: 'kv' }, ex.keys ? [h('dt', { text: T('Keys', 'Llaves') }), h('dd', { text: ex.keys })] : null, ex.meters ? [h('dt', { text: T('Meters', 'Medidores') }), h('dd', { text: ex.meters })] : null, ex.other ? [h('dt', { text: T('Other', 'Otro') }), h('dd', { text: ex.other })] : null))); }
    sheet.appendChild(h('section', { class: 'sheet-sign' }, h('h2', { text: T('Sign-off', 'Firmas') }), h('p', { text: T('We walked through the home together and agree that this report describes its condition on the date above, except for any comments written below.', 'Recorrimos la vivienda juntos y acordamos que este reporte describe su condición en la fecha indicada, salvo los comentarios escritos abajo.') }),
      h('div', { class: 'sigcols' }, ['tenant', 'landlord'].map(function (k) {
        var x = s[k];
        return h('div', { class: 'sigcol' }, h('h3', { text: k === 'tenant' ? T('Tenant', 'Inquilino') : T('Landlord or agent', 'Propietario o agente') }),
          x && x.sig ? h('img', { class: 'sigimg', src: x.sig, alt: T('Signature', 'Firma') }) : h('div', { class: 'sigline', text: T('Signature', 'Firma') }),
          h('p', null, T('Name: ', 'Nombre: '), x ? h('strong', { text: x.name }) : '______________________'), h('p', null, T('Date: ', 'Fecha: '), x ? TN.dates.stamp(x.at) : '______________'),
          h('p', null, T('Comments: ', 'Comentarios: '), x && x.comment ? x.comment : '______________________________'));
      }))));
    sheet.appendChild(h('footer', { class: 'sheet-foot' }, h('p', null, T('Report fingerprint (SHA-256): ', 'Huella del reporte (SHA-256): '), fp), h('p', { text: T('Made with Stark Tenancy, an offline record-keeping app. ', 'Hecho con Stark Tenancy, una app de registros sin conexión. ') + T(TN.data.meta.notLegal, TN.data.meta.notLegalEs) })));
    hashes(r).then(function (hm) { fp.textContent = R.fingerprint(r, hm); });
    main.appendChild(sheet);
  }

  function compareView(main) { main.appendChild(window.StarkTrial.card('compare')); }
})(typeof window !== 'undefined' ? window : globalThis);
