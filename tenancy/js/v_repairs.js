/* Stark Tenancy: the repair request log, with replies, visits, follow-up dates, photos and a printable history. */
(function (root) {
  'use strict';
  var TN = root.TN, ui = TN.ui, h = ui.h, S = TN.store, T = TN.i18n.T, L = TN.i18n.L, D = TN.dates, RP = TN.repairs;

  function all() { return S.get('repairs', []); }
  function byId(id) { return all().filter(function (r) { return r.id === id; })[0] || null; }
  function put(r) { var l = all(), i, f = -1; for (i = 0; i < l.length; i++) { if (l[i].id === r.id) { f = i; } } if (f < 0) { l.push(r); } else { l[f] = r; } return S.set('repairs', l); }
  function del(r) { S.set('repairs', all().filter(function (x) { return x.id !== r.id; })); return TN.photos.del(r.photos || []); }
  function opts(map) { return Object.keys(map).map(function (k) { return { v: k, l: L(map[k]) }; }); }
  function fsLabel(fs) { return { overdue: [T('Follow-up overdue', 'Seguimiento atrasado'), 'lv-high'], today: [T('Follow up today', 'Seguimiento hoy'), 'lv-due'], soon: [T('Follow-up soon', 'Seguimiento pronto'), 'lv-due'], later: [T('Follow-up', 'Seguimiento'), 'lv-info'] }[fs]; }
  function kinds() { return [{ v: 'followup', l: T('I followed up', 'Di seguimiento') }, { v: 'reply', l: T('They replied', 'Respondieron') }, { v: 'visit', l: T('Repair visit', 'Visita de reparación') }, { v: 'letter', l: T('Letter sent', 'Carta enviada') }, { v: 'note', l: T('Note', 'Nota') }]; }
  function kindLabel(v) { var k = kinds().filter(function (x) { return x.v === v; })[0]; return k ? k.l : v; }
  function howLabel(v) { var x = RP.HOW.filter(function (o) { return o.v === v; })[0]; return x ? L(x) : ''; }
  function roomNames() { var n = []; S.get('reports', []).forEach(function (r) { r.rooms.forEach(function (rm) { if (n.indexOf(rm.name) < 0) { n.push(rm.name); } }); }); return n; }
  function twice(label, again, fn) { var armed = false; return h('button', { type: 'button', class: 'btn small danger', onclick: function (e) { if (!armed) { armed = true; e.target.textContent = again; return; } fn(); } }, label); }

  ui.route('repairs', 'Repairs', function (main, args) {
    var r;
    ui.esReady();
    if (args[0] === 'print') { printView(main); return; }
    if (args[0] === 'new') { formView(main, null, args.slice(1)); return; }
    if (args[0] === 'edit' && (r = byId(args[1]))) { formView(main, r, []); return; }
    listView(main, args[0] === 'all');
  });

  function listView(main, showAll) {
    var today = ui.today(), list = all(), sum = RP.summary(list, today), RANK = { overdue: 0, today: 1, soon: 2, later: 3 }, shown;
    shown = list.filter(function (r) { return showAll || RP.isOpen(r); }).sort(function (a, b) {
      var x = RANK[RP.followState(a, today)], y = RANK[RP.followState(b, today)];
      x = x == null ? 9 : x; y = y == null ? 9 : y;
      return x - y || String(b.reportedOn).localeCompare(String(a.reportedOn));
    });
    main.appendChild(ui.hero(T('Repair log', 'Registro de reparaciones'), T('Write down every request the day you make it, how you made it and to whom. Set a follow-up date you choose, and log every reply and visit. A dated history settles most arguments.',
      'Anote cada solicitud el día que la hace, cómo y a quién. Elija una fecha de seguimiento y anote cada respuesta y visita. Un historial fechado resuelve la mayoría de los desacuerdos.'), true));
    main.appendChild(ui.stats([[String(sum.open), T('open', 'abiertas')], [String(sum.due.length), T('follow-ups due', 'seguimientos pendientes'), sum.due.length ? 'neg' : ''], [String(sum.fixed), T('fixed', 'arregladas')],
      [sum.avgDaysToFix == null ? '—' : String(sum.avgDaysToFix), T('average days to fix', 'días promedio para arreglar')]]));
    main.appendChild(h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/repairs/new', text: T('Log a repair request', 'Anotar una solicitud') }), h('a', { class: 'btn', href: '#/repairs/print', text: T('Print the history', 'Imprimir el historial') })));
    main.appendChild(ui.tabs([{ id: 'open', label: T('Open', 'Abiertas') + ' (' + sum.open + ')' }, { id: 'all', label: T('All', 'Todas') + ' (' + sum.total + ')' }], showAll ? 'all' : 'open', 'repairs'));
    if (!shown.length) { main.appendChild(ui.empty(showAll ? T('No repairs logged yet.', 'Aún no hay reparaciones anotadas.') : T('No open repairs. Nice.', 'No hay reparaciones abiertas.'))); }
    shown.forEach(function (r) { main.appendChild(card(r, today)); });
    main.appendChild(ui.notice(T('Follow-up dates are reminders you choose, not legal deadlines. Repair duties and time limits differ by state and city, and urgent problems such as no heat, no water, gas smells or a broken lock may have their own rules.',
      'Las fechas de seguimiento son recordatorios que usted elige, no plazos legales. Las obligaciones y plazos de reparación cambian por estado y ciudad, y los problemas urgentes como falta de calefacción o agua, olor a gas o una cerradura rota pueden tener sus propias reglas.'), 'soft'));
    main.appendChild(ui.legal());
  }

  function card(r, today) {
    var fs = RP.followState(r, today), dOpen = RP.daysOpen(r, today), box = h('div'), st = r.status || 'open', fl = fs ? fsLabel(fs) : null, tn = TN.rec.tenancy();
    function addForm() {
      var f = ui.form([{ id: 'date', label: T('Date', 'Fecha'), type: 'date' }, { id: 'kind', label: T('What happened', 'Qué pasó'), type: 'select', options: kinds() },
        { id: 'note', label: T('Details', 'Detalles'), type: 'textarea', rows: 2 }, { id: 'status', label: T('Status now', 'Estado ahora'), type: 'select', options: opts(RP.STATUS) },
        { id: 'followUpOn', label: T('Next follow-up (a date you choose)', 'Próximo seguimiento (fecha que usted elige)'), type: 'date' }], { date: today, kind: 'followup', status: st, followUpOn: RP.suggestFollowUp(r.priority, today) });
      ui.clear(box).appendChild(h('div', { class: 'subform' }, f.el, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var v = f.read();
        if (!D.isIso(v.date)) { ui.toast(T('Choose a date.', 'Elija una fecha.')); return; }
        put(RP.addUpdate(r, { date: v.date, kind: v.kind, note: v.note.trim(), status: v.status, followUpOn: RP.isOpen({ status: v.status }) && D.isIso(v.followUpOn) ? v.followUpOn : '' }));
        ui.toast(T('Update saved.', 'Actualización guardada.')); ui.renderRoute();
      } }, T('Save update', 'Guardar')), h('button', { type: 'button', class: 'btn', onclick: function () { ui.clear(box); } }, T('Cancel', 'Cancelar')))));
    }
    return h('section', { class: 'card repair' + (fs === 'overdue' ? ' urgent' : '') + (st === 'fixed' ? ' done' : '') },
      h('div', { class: 'row between tight' }, h('h3', { text: r.title }), h('div', { class: 'badges' }, ui.badge(L(RP.STATUS[st]), 'st-' + st), ui.badge(L(RP.PRIORITY[r.priority] || RP.PRIORITY.routine).split(':')[0], 'pr-' + (r.priority || 'routine')), fl ? ui.badge(fl[0] + ': ' + D.pretty(r.followUpOn), fl[1]) : null)),
      h('p', { class: 'small', text: [r.room, D.isIso(r.reportedOn) ? T('Reported ', 'Reportada el ') + D.pretty(r.reportedOn) + (howLabel(r.how) ? ' · ' + howLabel(r.how) : '') + (r.reportedTo ? T(' to ', ' a ') + r.reportedTo : '') : '',
        dOpen != null ? (RP.isOpen(r) ? dOpen + T(' days open', ' días abierta') : T('Fixed after ', 'Arreglada en ') + dOpen + T(' days', ' días')) : ''].filter(Boolean).join(' · ') }),
      r.detail ? h('p', { text: r.detail }) : null,
      (r.photos || []).length ? ui.photoGrid(r.photos) : null,
      (r.updates || []).length ? h('ol', { class: 'timeline' }, r.updates.map(function (u) { return h('li', null, h('strong', { text: D.pretty(u.date) + ' · ' + kindLabel(u.kind) }), u.note ? h('span', { text: ' ' + u.note }) : null); })) : null,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: addForm }, T('Add an update', 'Agregar actualización')),
        RP.isOpen(r) ? h('button', { type: 'button', class: 'btn small', onclick: function () { put(RP.addUpdate(r, { date: today, kind: 'visit', note: T('Marked fixed.', 'Marcada como arreglada.'), status: 'fixed', followUpOn: '' })); ui.toast(T('Marked fixed.', 'Marcada como arreglada.')); ui.renderRoute(); } }, T('Mark fixed', 'Marcar arreglada')) : null,
        RP.isOpen(r) && tn.role !== 'landlord' ? h('a', { class: 'btn small', href: '#/letters/repair/from/' + r.id, text: T('Repair request letter', 'Carta de solicitud') }) : null,
        RP.isOpen(r) ? h('a', { class: 'btn small', href: '#/letters/fix/from/' + r.id, text: T('Notice to fix', 'Aviso para arreglar') }) : null,
        h('a', { class: 'btn small', href: '#/repairs/edit/' + r.id, text: T('Edit', 'Editar') }),
        twice(T('Delete', 'Borrar'), T('Press again to delete', 'Pulse otra vez para borrar'), function () { del(r).then(function () { ui.toast(T('Deleted.', 'Borrada.')); ui.renderRoute(); }); })),
      box);
  }

  function formView(main, r, extra) {
    var today = ui.today(), isNew = !r, photos, ph = h('div'), touched = false, f, dl = h('datalist', { id: 'rp-rooms' }, roomNames().map(function (n) { return h('option', { value: n }); }));
    r = r || { id: TN.uid(), status: 'open', priority: 'soon', reportedOn: today, how: 'text', photos: [], updates: [] };
    if (isNew && extra[0] === 'alarm') { r.title = T('Alarm not working: ', 'Alarma no funciona: ') + (extra[1] || ''); r.priority = 'urgent'; r.room = extra[1] || ''; r.detail = T('The alarm did not sound when tested on ', 'La alarma no sonó al probarla el ') + D.pretty(today) + '.'; }
    if (isNew) { r.followUpOn = RP.suggestFollowUp(r.priority, r.reportedOn); }
    photos = (r.photos || []).slice();
    f = ui.form([{ id: 'title', label: T('What needs repair (short)', 'Qué necesita reparación (breve)'), ph: T('Kitchen faucet drips', 'La llave de la cocina gotea'), wide: true },
      { id: 'room', label: T('Where in the home', 'Dónde en la vivienda') }, { id: 'priority', label: T('How urgent', 'Qué tan urgente'), type: 'select', options: opts(RP.PRIORITY) },
      { id: 'detail', label: T('Details: what happens, since when, what you tried', 'Detalles: qué pasa, desde cuándo, qué intentó'), type: 'textarea' },
      { id: 'reportedOn', label: T('Date you asked for the repair', 'Fecha en que pidió la reparación'), type: 'date' }, { id: 'how', label: T('How you asked', 'Cómo lo pidió'), type: 'select', options: RP.HOW.map(function (x) { return { v: x.v, l: L(x) }; }) },
      { id: 'reportedTo', label: T('Who you told', 'A quién le dijo') }, { id: 'followUpOn', label: T('Follow up on (a date you choose)', 'Dar seguimiento el (fecha que usted elige)'), type: 'date', hint: T('Suggested from how urgent it is: 1 day, 7 days or 14 days. Change it to suit you.', 'Sugerida según la urgencia: 1, 7 o 14 días. Cámbiela como quiera.') }], r);
    f.inputs.room.setAttribute('list', 'rp-rooms');
    f.inputs.followUpOn.addEventListener('change', function () { touched = true; });
    function suggest() { if (!touched) { f.inputs.followUpOn.value = RP.suggestFollowUp(f.inputs.priority.value, D.isIso(f.inputs.reportedOn.value) ? f.inputs.reportedOn.value : today); } }
    f.inputs.priority.addEventListener('change', suggest); f.inputs.reportedOn.addEventListener('change', suggest);
    function drawPh() { ui.clear(ph).appendChild(photos.length ? ui.photoGrid(photos, function (id) { photos = photos.filter(function (x) { return x !== id; }); TN.photos.del(id); drawPh(); }) : ui.empty(T('No photos yet.', 'Aún no hay fotos.'))); }
    drawPh();
    main.appendChild(ui.hero(isNew ? T('Log a repair request', 'Anotar una solicitud de reparación') : T('Edit repair', 'Editar reparación'), null, true));
    main.appendChild(ui.card(null, [dl, f.el, h('h4', { text: T('Dated photos', 'Fotos fechadas') }), ph,
      h('div', { class: 'row' }, ui.photoPicker(T('Add photos', 'Agregar fotos'), function () { return T('Repair: ', 'Reparación: ') + (f.inputs.title.value || ''); }, function (rec) { photos.push(rec.id); drawPh(); })),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var v = f.read();
        if (!v.title.trim()) { ui.toast(T('Write what needs repair.', 'Escriba qué necesita reparación.')); return; }
        Object.assign(r, { title: v.title.trim(), room: v.room.trim(), priority: v.priority, detail: v.detail.trim(), reportedOn: D.isIso(v.reportedOn) ? v.reportedOn : today, how: v.how, reportedTo: v.reportedTo.trim(), followUpOn: D.isIso(v.followUpOn) ? v.followUpOn : '', photos: photos });
        if (!put(r) && TN.trial.on()) { return; }
        ui.toast(T('Saved.', 'Guardado.')); ui.go('repairs');
      } }, T('Save', 'Guardar')), h('a', { class: 'btn', href: '#/repairs', text: T('Cancel', 'Cancelar') }))]));
  }

  function printView(main) {
    var tn = TN.rec.tenancy(), today = ui.today(), list = all().sort(function (a, b) { return String(a.reportedOn).localeCompare(String(b.reportedOn)); }), sheet = h('article', { class: 'sheet' });
    main.appendChild(h('div', { class: 'row noprint' }, h('a', { class: 'btn', href: '#/repairs', text: T('Back to the repair log', 'Volver al registro') }), h('button', { type: 'button', class: 'btn primary', onclick: function () { ui.printEl(sheet); } }, T('Print or save as PDF', 'Imprimir o guardar como PDF'))));
    sheet.appendChild(h('header', { class: 'sheet-head' }, h('h1', { text: T('Repair history', 'Historial de reparaciones') }), h('dl', { class: 'kv' }, h('dt', { text: T('Property', 'Vivienda') }), h('dd', { text: tn.address || '' }),
      h('dt', { text: T('Prepared on', 'Preparado el') }), h('dd', { text: D.pretty(today) }), h('dt', { text: T('Requests', 'Solicitudes') }), h('dd', { text: String(list.length) }))));
    if (!list.length) { sheet.appendChild(ui.empty(T('No repairs logged yet.', 'Aún no hay reparaciones anotadas.'))); }
    list.forEach(function (r) {
      var d = RP.daysOpen(r, today);
      sheet.appendChild(h('section', { class: 'sheet-room' }, h('h2', { text: r.title }),
        h('p', { text: [L(RP.STATUS[r.status || 'open']), r.room, T('Reported ', 'Reportada el ') + D.pretty(r.reportedOn) + (howLabel(r.how) ? ' (' + howLabel(r.how) + ')' : '') + (r.reportedTo ? T(' to ', ' a ') + r.reportedTo : ''),
          r.status === 'fixed' && r.fixedOn ? T('Fixed ', 'Arreglada el ') + D.pretty(r.fixedOn) : '', d != null ? d + T(' days', ' días') : ''].filter(Boolean).join(' · ') }),
        r.detail ? h('p', { text: r.detail }) : null,
        (r.updates || []).length ? ui.table([T('Date', 'Fecha'), T('What happened', 'Qué pasó'), T('Details', 'Detalles')], r.updates.map(function (u) { return [D.pretty(u.date), kindLabel(u.kind), u.note || '']; }), 'ptable') : null,
        (r.photos || []).length ? h('div', { class: 'sheet-photos' }, r.photos.map(function (id) { return ui.photoImg(id, r.title, 'pimg'); })) : null));
    });
    sheet.appendChild(h('footer', { class: 'sheet-foot' }, h('p', { text: T('Made with Stark Tenancy, an offline record-keeping app. ', 'Hecho con Stark Tenancy, una app de registros sin conexión. ') + T(TN.data.meta.notLegal, TN.data.meta.notLegalEs) })));
    main.appendChild(sheet);
  }
})(typeof window !== 'undefined' ? window : globalThis);
