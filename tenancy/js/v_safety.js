/* Stark Tenancy: smoke and carbon monoxide alarm reminders: monthly tests, battery and replace-by dates, a test log,
   and a calendar file (.ics) so reminders arrive even when the app is closed. */
(function (root) {
  'use strict';
  var TN = root.TN, ui = TN.ui, h = ui.h, S = TN.store, T = TN.i18n.T, L = TN.i18n.L, D = TN.dates, A = TN.alarms;

  function all() { return S.get('alarms', []); }
  function save(l) { S.set('alarms', l); }
  function upd(id, fn) { save(all().map(function (a) { return a.id === id ? fn(a) : a; })); }
  function opts(map) { return Object.keys(map).map(function (k) { return { v: k, l: L(map[k]) }; }); }
  var SC = { ok: 'lv-ok', due: 'lv-due', overdue: 'lv-high', never: 'lv-high', unknown: 'lv-info' };
  function twice(label, again, fn) { var armed = false; return h('button', { type: 'button', class: 'btn small danger', onclick: function (e) { if (!armed) { armed = true; e.target.textContent = again; return; } fn(); } }, label); }
  function fields() {
    return [{ id: 'location', label: T('Where it is', 'Dónde está'), ph: T('Hallway ceiling', 'Techo del pasillo') }, { id: 'kind', label: T('Kind of alarm', 'Tipo de alarma'), type: 'select', options: opts(A.KIND) },
      { id: 'power', label: T('Power', 'Energía'), type: 'select', options: opts(A.POWER) }, { id: 'made', label: T('Manufacture date (on the label)', 'Fecha de fabricación (en la etiqueta)'), type: 'month' },
      { id: 'replaceBy', label: T('Replace-by date, if the label shows one', 'Fecha de reemplazo, si la etiqueta la indica'), type: 'date' }, { id: 'lastTested', label: T('Last tested', 'Última prueba'), type: 'date' },
      { id: 'batteryOn', label: T('Battery last changed', 'Última vez que cambió la batería'), type: 'date' }];
  }

  ui.route('safety', 'Alarms', function (main) {
    var today = ui.today(), list = all(), sum = A.summary(list, today), f = ui.form(fields(), { kind: 'smoke', power: 'battery' }), tn = TN.rec.tenancy();
    ui.esReady();
    main.appendChild(ui.hero(T('Smoke and CO alarm reminders', 'Recordatorios de alarmas de humo y CO'), T('Working alarms save lives. Press the test button on each alarm once a month, log it here, and the app reminds you when the next test, battery or replacement is due.',
      'Las alarmas que funcionan salvan vidas. Pulse el botón de prueba de cada alarma una vez al mes, anótelo aquí y la app le recuerda la próxima prueba, batería o reemplazo.'), true));
    main.appendChild(ui.stats([[String(sum.count), T('alarms', 'alarmas')], [String(sum.testsDue), T('tests due', 'pruebas pendientes'), sum.testsDue ? 'neg' : ''], [String(sum.batteryDue), T('batteries due', 'baterías pendientes'), sum.batteryDue ? 'neg' : ''],
      [sum.nextTest ? D.pretty(sum.nextTest > today ? sum.nextTest : today) : '—', T('next test', 'próxima prueba')]]));
    if (!list.length) { main.appendChild(ui.empty(T('No alarms listed yet. Add each smoke and CO alarm in the home below.', 'Aún no hay alarmas. Agregue abajo cada alarma de humo y CO de la vivienda.'))); }
    list.forEach(function (a) {
      var s = A.status(a, today), tests = (a.tests || []).slice().sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); });
      main.appendChild(h('section', { class: 'card alarm lv-border-' + s.worst }, h('div', { class: 'row between tight' }, h('h3', { text: a.location || T('Alarm', 'Alarma') }), h('span', { class: 'small', text: L(A.KIND[a.kind] || A.KIND.smoke) + ' · ' + L(A.POWER[a.power] || A.POWER.battery) })),
        h('div', { class: 'badges' },
          ui.badge(s.testState === 'never' ? T('Never tested here', 'Sin pruebas anotadas') : (s.testState === 'ok' ? T('Next test ', 'Próxima prueba ') : (s.testState === 'due' ? T('Test due ', 'Prueba pendiente ') : T('Test overdue since ', 'Prueba atrasada desde '))) + (s.testState === 'never' ? '' : D.pretty(s.testDue)), SC[s.testState]),
          s.batteryState ? ui.badge(s.batteryState === 'unknown' ? T('Battery date unknown', 'Fecha de batería desconocida') : T('Battery by ', 'Batería antes del ') + D.pretty(s.batteryDue), SC[s.batteryState]) : null,
          s.replaceBy ? ui.badge(T('Replace by ', 'Reemplazar antes del ') + D.pretty(s.replaceBy), SC[s.replaceState]) : (a.kind !== 'smoke' || a.power === 'sealed' ? ui.badge(T('Replace as the maker says', 'Reemplazar según el fabricante'), 'lv-info') : null),
          s.lastOk === false ? ui.badge(T('Failed its last test', 'Falló su última prueba'), 'lv-high') : null),
        tests.length ? h('p', { class: 'small', text: T('Tests: ', 'Pruebas: ') + tests.slice(0, 4).map(function (x) { return D.pretty(x.date) + (x.ok === false ? T(' (did not sound)', ' (no sonó)') : ' ✓'); }).join(' · ') }) : null,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { upd(a.id, function (x) { x.tests = (x.tests || []).concat([{ date: today, ok: true }]); x.lastTested = today; return x; }); ui.toast(T('Test logged. Next one in about a month.', 'Prueba anotada. La próxima en un mes.')); ui.renderRoute(); } }, T('Tested today: it sounded', 'Probada hoy: sonó')),
          h('button', { type: 'button', class: 'btn', onclick: function () { upd(a.id, function (x) { x.tests = (x.tests || []).concat([{ date: today, ok: false }]); x.lastTested = today; return x; }); ui.renderRoute(); } }, T('It did not sound', 'No sonó')),
          A.POWER[a.power] && A.POWER[a.power].battery ? h('button', { type: 'button', class: 'btn small', onclick: function () { upd(a.id, function (x) { x.batteryOn = today; return x; }); ui.toast(T('Battery date saved. Test it now.', 'Fecha de batería guardada. Pruébela ahora.')); ui.renderRoute(); } }, T('Battery changed today', 'Batería cambiada hoy')) : null,
          s.lastOk === false ? h('a', { class: 'btn small', href: '#/repairs/new/alarm/' + encodeURIComponent(a.location || ''), text: T('Log a repair request', 'Anotar una solicitud de reparación') }) : null,
          twice(T('Remove', 'Quitar'), T('Press again to remove', 'Pulse otra vez para quitar'), function () { save(all().filter(function (x) { return x.id !== a.id; })); ui.renderRoute(); }))));
    });
    main.appendChild(h('div', { class: 'row' }, list.length ? h('button', { type: 'button', class: 'btn', onclick: function () { ui.saveText('stark-tenancy-alarm-reminders.ics', A.ics(all(), today, TN.rec.place(tn)), 'text/calendar;charset=utf-8'); } }, T('Add reminders to my calendar (.ics)', 'Agregar recordatorios a mi calendario (.ics)')) : null));
    if (list.length) { main.appendChild(h('p', { class: 'small', text: T('The calendar file has a monthly test reminder and, where it applies, yearly battery and replace-by reminders. Open it with your calendar app. The app itself cannot alert you while it is closed.', 'El archivo de calendario tiene un recordatorio mensual de prueba y, cuando aplica, recordatorios anuales de batería y de reemplazo. Ábralo con su app de calendario. La app no puede avisarle mientras está cerrada.') })); }
    main.appendChild(ui.card(T('Add an alarm', 'Agregar una alarma'), [f.el, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
      var v = f.read();
      if (!v.location.trim()) { ui.toast(T('Say where the alarm is.', 'Indique dónde está la alarma.')); return; }
      save(all().concat([{ id: TN.uid(), location: v.location.trim(), kind: v.kind, power: v.power, made: /^\d{4}-\d{2}$/.test(v.made) ? v.made : '', replaceBy: D.isIso(v.replaceBy) ? v.replaceBy : '',
        lastTested: D.isIso(v.lastTested) ? v.lastTested : '', batteryOn: D.isIso(v.batteryOn) ? v.batteryOn : '', tests: D.isIso(v.lastTested) ? [{ date: v.lastTested, ok: true }] : [] }]));
      ui.toast(T('Alarm added.', 'Alarma agregada.')); ui.renderRoute();
    } }, T('Add alarm', 'Agregar alarma')))], 'alarm-form'));
    main.appendChild(ui.card(T('What the safety agencies say', 'Lo que dicen las agencias de seguridad'), [h('ul', null,
      h('li', { text: T('Test smoke alarms every month. Replace 9-volt batteries at least once a year. Replace a smoke alarm 10 years from its manufacture date, or as its maker says for sealed long-life alarms. Source: U.S. Fire Administration (FEMA).', 'Pruebe las alarmas de humo cada mes. Cambie las baterías de 9 voltios al menos una vez al año. Reemplace la alarma 10 años después de su fabricación, o según el fabricante si es de batería sellada. Fuente: U.S. Fire Administration (FEMA).') }),
      h('li', { text: T('Test carbon monoxide alarms at least once a month and replace them as the maker’s instructions say. Source: National Fire Protection Association (NFPA).', 'Pruebe las alarmas de monóxido de carbono al menos una vez al mes y reemplácelas según las instrucciones del fabricante. Fuente: National Fire Protection Association (NFPA).') }),
      h('li', { text: T('If a CO alarm sounds, get everyone outside to fresh air and call for help from there.', 'Si suena una alarma de CO, salgan todos al aire libre y pidan ayuda desde afuera.') })),
      h('p', { class: 'small', text: T('Checked on ', 'Revisado el ') + D.pretty(TN.data.meta.asOf) + T('. Addresses are on the Help page.', '. Las direcciones están en la página de Ayuda.') }),
      ui.notice(T('Who must install, test and replace alarms is set by state and local law and by the lease. If an alarm fails, tell the other party in writing and keep a dated record.', 'Quién debe instalar, probar y reemplazar las alarmas lo fijan la ley estatal y local y el contrato. Si una alarma falla, avise por escrito a la otra parte y guarde un registro fechado.'), 'soft')], 'sources-card'));
    main.appendChild(ui.legal());
  });
})(typeof window !== 'undefined' ? window : globalThis);
