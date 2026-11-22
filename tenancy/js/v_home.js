/* Stark Tenancy: record access, the home screen and the tenancy details form. */
(function (root) {
  'use strict';
  var TN = root.TN, ui = TN.ui, h = ui.h, S = TN.store, T = TN.i18n.T, D = TN.dates, U = TN.util;

  var rec = TN.rec = {
    tenancy: function () { return S.get('tenancy', {}); },
    reports: function () { return S.get('reports', []); },
    repairs: function () { return S.get('repairs', []); },
    ledger: function () { return S.get('ledger', []); },
    alarms: function () { return S.get('alarms', []); },
    ledgerCfg: function (tn) { tn = tn || rec.tenancy(); return { rent: tn.rent, dueDay: tn.dueDay, start: tn.leaseStart || tn.moveIn || '', end: tn.moveOut || tn.leaseEnd || '' }; },
    all: function () {
      var tn = rec.tenancy(), led = rec.ledger();
      return { tenancy: tn, reports: rec.reports(), repairs: rec.repairs(), ledger: led, alarms: rec.alarms(), ledgerCfg: U.num(tn.rent) > 0 ? rec.ledgerCfg(tn) : null,
        depositPaid: TN.ledger.summary(led, {}, ui.today()).depositPaid };
    },
    place: function (tn) { tn = tn || rec.tenancy(); return String(tn.address || '').split('\n')[0]; }
  };

  function detailFields() {
    return [
      { id: 'address', label: T('Address of the rental home', 'Dirección de la vivienda rentada'), type: 'textarea', rows: 2 },
      { id: 'tenantName', label: T('Tenant name(s)', 'Nombre de los inquilinos') },
      { id: 'tenantContact', label: T('Tenant phone or email', 'Teléfono o correo del inquilino') },
      { id: 'landlordName', label: T('Landlord or manager name', 'Nombre del propietario o administrador') },
      { id: 'landlordContact', label: T('Landlord phone or email', 'Teléfono o correo del propietario') },
      { id: 'landlordAddress', label: T('Landlord mailing address (for letters)', 'Dirección postal del propietario (para cartas)'), type: 'textarea', rows: 2 },
      { id: 'leaseStart', label: T('Lease start', 'Inicio del contrato'), type: 'date' },
      { id: 'leaseEnd', label: T('Lease end (if any)', 'Fin del contrato (si hay)'), type: 'date' },
      { id: 'moveIn', label: T('Move-in date', 'Fecha de entrada'), type: 'date' },
      { id: 'moveOut', label: T('Move-out date', 'Fecha de salida'), type: 'date' },
      { id: 'keysReturned', label: T('Keys returned on', 'Llaves entregadas el'), type: 'date' },
      { id: 'rent', label: T('Monthly rent', 'Renta mensual'), type: 'money', ph: '1450' },
      { id: 'dueDay', label: T('Rent due day of the month (1 to 28)', 'Día de pago de la renta (1 a 28)'), type: 'number', min: 1, max: 28 },
      { id: 'deposit', label: T('Security deposit agreed', 'Depósito de garantía acordado'), type: 'money' },
      { id: 'forwarding', label: T('Tenant forwarding address (after moving out)', 'Dirección nueva del inquilino (después de salir)'), type: 'textarea', rows: 2 }
    ];
  }

  ui.route('home', 'Home', function (main) {
    var tn = rec.tenancy(), all = rec.all(), today = ui.today(), todo = TN.overview(all, today), s = S.settings(), lg = all.ledgerCfg ? TN.ledger.summary(all.ledger, all.ledgerCfg, today) : null,
      rs = TN.repairs.summary(all.repairs, today), al = TN.alarms.summary(all.alarms, today), hasAny = tn.address || all.reports.length || all.repairs.length || all.ledger.length || all.alarms.length;
    ui.esReady();
    main.appendChild(h('section', { class: 'hero2' }, h('h1', null, h('span', { text: T('A clean record of your tenancy.', 'Un registro claro de su arrendamiento.') }), h('span', { class: 'l2', text: T('Fair to both sides. Private by design.', 'Justo para ambas partes. Privado por diseño.') })),
      h('p', { class: 'lead', text: T('Most deposit and repair disputes come down to records nobody kept. Stark Tenancy keeps them for you: condition reports with dated photos, a repair log, rent and deposit receipts, calm letters, and alarm reminders. Everything stays on this device.',
        'La mayoría de los desacuerdos por depósitos y reparaciones dependen de registros que nadie guardó. Stark Tenancy los guarda por usted: reportes de condición con fotos fechadas, registro de reparaciones, recibos de renta y depósito, cartas tranquilas y recordatorios de alarmas. Todo se queda en este dispositivo.') }),
      h('ul', { class: 'calm' }, h('li', { text: T('You do not have to do it all today.', 'No tiene que hacerlo todo hoy.') }), h('li', { text: T('Start with one room and a few photos.', 'Empiece con un cuarto y unas fotos.') }), h('li', { text: T('Good records help tenants and landlords alike.', 'Los buenos registros ayudan a inquilinos y propietarios por igual.') }))));

    if (!tn.address) {
      main.appendChild(ui.card(T('Set up this tenancy', 'Configure este arrendamiento'), [h('p', { text: T('Add the address, who is who, the dates, the rent and the deposit. Your letters and reports fill in from it.', 'Agregue la dirección, quién es quién, las fechas, la renta y el depósito. Sus cartas y reportes se llenan con esto.') }),
        h('div', { class: 'row' }, h('a', { class: 'btn primary big', href: '#/details', text: T('Set up my tenancy', 'Configurar mi arrendamiento') }),
          !hasAny && s.profile !== 'example' ? h('button', { type: 'button', class: 'btn', onclick: function () { TN.demo.load().then(function () { ui.buildNav(); ui.go('home'); ui.renderRoute(); ui.toast(T('Example tenancy loaded. Your own data is untouched.', 'Ejemplo cargado. Sus propios datos no cambian.')); }); } }, T('Explore an example first', 'Ver un ejemplo primero')) : null)], 'setup'));
    } else {
      main.appendChild(ui.card(null, [h('div', { class: 'row between tight' }, h('div', null, h('p', { class: 'eyebrow', text: tn.role === 'landlord' ? T('You are the landlord or manager', 'Usted es el propietario o administrador') : T('You are the tenant', 'Usted es el inquilino') }),
        h('h2', { class: 'addr-title', text: rec.place(tn) })), h('a', { class: 'btn small', href: '#/details', text: T('Edit details', 'Editar datos') })),
        h('dl', { class: 'kv inline' }, tn.tenantName ? [h('dt', { text: T('Tenant', 'Inquilino') }), h('dd', { text: tn.tenantName })] : null, tn.landlordName ? [h('dt', { text: T('Landlord', 'Propietario') }), h('dd', { text: tn.landlordName })] : null,
          tn.moveIn ? [h('dt', { text: T('Moved in', 'Entrada') }), h('dd', { text: D.pretty(tn.moveIn) })] : null, tn.moveOut ? [h('dt', { text: T('Moving out', 'Salida') }), h('dd', { text: D.pretty(tn.moveOut) })] : null,
          U.num(tn.rent) ? [h('dt', { text: T('Rent', 'Renta') }), h('dd', { text: U.money(U.num(tn.rent)) + T(' a month', ' al mes') })] : null)], 'tenancy-card'));
    }

    main.appendChild(ui.card(T('Needs attention', 'Necesita atención'), todo.length ? h('ul', { class: 'todo' }, todo.map(function (x) { return h('li', { class: 'lv-' + x.level }, h('a', { href: x.href, text: x.text })); }))
      : ui.empty(T('Nothing needs attention today.', 'Nada necesita atención hoy.')), 'todo-card'));

    main.appendChild(h('div', { class: 'tiles big' }, [
      ['reports', T('Move-in and move-out reports', 'Reportes de entrada y salida'), all.reports.length ? all.reports.length + T(' report(s), ', ' reporte(s), ') + all.reports.reduce(function (n, r) { return n + TN.report.progress(r).photos; }, 0) + T(' dated photos', ' fotos fechadas') : T('Room by room, with dated photos and sign-off by both parties.', 'Cuarto por cuarto, con fotos fechadas y firma de ambas partes.')],
      ['repairs', T('Repair log', 'Registro de reparaciones'), all.repairs.length ? rs.open + T(' open, ', ' abiertas, ') + rs.due.length + T(' follow-up(s) due', ' seguimiento(s) pendiente(s)') : T('Every request, reply and follow-up date in one place.', 'Cada solicitud, respuesta y fecha de seguimiento en un solo lugar.')],
      ['ledger', T('Rent and deposit', 'Renta y depósito'), lg ? U.money(lg.totals.rent) + T(' rent logged, deposit held ', ' de renta anotada, depósito retenido ') + U.money(lg.depositHeld) : T('A ledger of payments with receipt photos and printable receipts.', 'Un registro de pagos con fotos de recibos y recibos imprimibles.')],
      ['letters', T('Letters', 'Cartas'), T('Answer a few questions and get a repair request, a deposit return request or a notice to fix.', 'Responda unas preguntas y obtenga una solicitud de reparación, de devolución del depósito o un aviso para arreglar.')],
      ['safety', T('Smoke and CO alarms', 'Alarmas de humo y CO'), al.count ? al.count + T(' alarm(s), next test ', ' alarma(s), próxima prueba ') + D.pretty(al.nextTest > today ? al.nextTest : today) : T('Monthly test reminders, battery and replace-by dates, a calendar file.', 'Recordatorios de prueba mensual, fechas de batería y reemplazo, archivo de calendario.')],
      ['help', T('Help and official links', 'Ayuda y enlaces oficiales'), T('HUD, state attorneys general, legal aid. Each with its source and the date checked.', 'HUD, fiscalías estatales, asistencia legal. Cada uno con su fuente y fecha de revisión.')]
    ].map(function (t) { return h('a', { class: 'tile', href: '#/' + t[0] }, h('strong', { text: t[1] }), h('span', { text: t[2] })); })));

    main.appendChild(ui.card(T('By design', 'Por diseño'), [h('p', { text: T(TN.data.meta.byDesign, TN.data.meta.byDesignEs) + ' ' + T('Stark Tenancy keeps records of a home and a tenancy. It never rates, screens or reports people.', 'Stark Tenancy guarda registros de una vivienda y un arrendamiento. Nunca califica, evalúa ni reporta a personas.') }), ui.legal()], 'bydesign'));
  });

  ui.route('details', null, function (main) {
    var tn = rec.tenancy(), f = ui.form(detailFields(), tn), role = tn.role || 'tenant', pick = h('div');
    ui.esReady();
    function drawRole() { ui.clear(pick).appendChild(ui.choice(T('Which side are you on?', '¿De qué lado está usted?'), [['tenant', T('I am the tenant', 'Soy el inquilino')], ['landlord', T('I am the landlord or manager', 'Soy el propietario o administrador')]], role, function (v) { role = v; drawRole(); })); }
    drawRole();
    main.appendChild(ui.hero(T('Tenancy details', 'Datos del arrendamiento'), T('These fill your letters, reports and receipts. Leave out anything you do not know yet.', 'Esto llena sus cartas, reportes y recibos. Omita lo que aún no sepa.'), true));
    main.appendChild(ui.card(T('Which side are you on?', '¿De qué lado está usted?'), [pick, h('p', { class: 'small', text: T('Tenants and landlords can both use Stark Tenancy. The letters for repairs and deposits are written for tenants; the notice to fix works for both.', 'Inquilinos y propietarios pueden usar Stark Tenancy. Las cartas de reparación y depósito son para inquilinos; el aviso para arreglar sirve para ambos.') })]));
    main.appendChild(ui.card(T('The home and the people', 'La vivienda y las personas'), [f.el, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
      var v = f.read(), d = parseInt(v.dueDay, 10);
      v.role = role; v.dueDay = d >= 1 && d <= 28 ? String(d) : '';
      ['leaseStart', 'leaseEnd', 'moveIn', 'moveOut', 'keysReturned'].forEach(function (k) { if (v[k] && !D.isIso(v[k])) { v[k] = ''; } });
      S.set('tenancy', Object.assign(rec.tenancy(), v));
      if (rec.place(v)) { var st = S.settings(); if (!st.names[st.profile] || /^My tenancy$/.test(st.names[st.profile])) { st.names[st.profile] = rec.place(v); S.setSettings(st); } }
      ui.toast(T('Saved.', 'Guardado.')); ui.go('home');
    } }, T('Save details', 'Guardar datos')), h('a', { class: 'btn', href: '#/home', text: T('Cancel', 'Cancelar') }))]));
  });
})(typeof window !== 'undefined' ? window : globalThis);
