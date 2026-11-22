/* Stark Tenancy: the rent and deposit ledger, with receipt photos, month-by-month rent status, a spreadsheet file,
   a printable statement and printable rent receipts. */
(function (root) {
  'use strict';
  var TN = root.TN, ui = TN.ui, h = ui.h, S = TN.store, T = TN.i18n.T, L = TN.i18n.L, D = TN.dates, U = TN.util, LG = TN.ledger;

  function all() { return S.get('ledger', []); }
  function put(e) { var l = all(), i, f = -1; for (i = 0; i < l.length; i++) { if (l[i].id === e.id) { f = i; } } if (f < 0) { l.push(e); } else { l[f] = e; } return S.set('ledger', l); }
  function byId(id) { return all().filter(function (e) { return e.id === id; })[0] || null; }
  function kindOpts() { return LG.KINDS.map(function (k) { return { v: k.v, l: L(k) }; }); }
  function kindLabel(v) { var k = LG.kind(v); return k ? L(k) : v; }
  function twice(label, again, fn) { var armed = false; return h('button', { type: 'button', class: 'btn small danger', onclick: function (e) { if (!armed) { armed = true; e.target.textContent = again; return; } fn(); } }, label); }
  var MS = { paid: ['lv-ok', 'Paid', 'Pagado'], short: ['lv-due', 'Short', 'Incompleto'], missing: ['lv-high', 'No payment logged', 'Sin pago anotado'] };

  ui.route('ledger', 'Rent & deposit', function (main, args) {
    ui.esReady();
    if (args[0] === 'print') { printView(main); return; }
    if (args[0] === 'receipt' && byId(args[1])) { receiptView(main, byId(args[1])); return; }
    view(main);
  });

  function view(main) {
    var tn = TN.rec.tenancy(), today = ui.today(), cfg = TN.rec.ledgerCfg(tn), list = all(), sum = LG.summary(list, cfg, today), receipt = '', rph = h('div'), f;
    main.appendChild(ui.hero(T('Rent and deposit', 'Renta y depósito'), T('Log every payment the day it happens, with a photo of the receipt or transfer. The ledger shows each month’s rent, what the deposit holds now, and prints receipts and statements.',
      'Anote cada pago el día que ocurre, con una foto del recibo o la transferencia. El registro muestra la renta de cada mes, lo que queda del depósito, e imprime recibos y estados de cuenta.'), true));
    main.appendChild(ui.stats([[U.money(sum.totals.rent), T('rent logged', 'renta anotada')],
      [sum.expected.length ? (sum.expected.length - sum.missing.length - sum.short.length) + ' / ' + sum.expected.length : '—', T('months fully paid', 'meses pagados completos'), sum.missing.length + sum.short.length ? 'neg' : ''],
      [U.money(sum.depositHeld), T('deposit held now', 'depósito retenido ahora')], [U.money(sum.totals.fee - sum.totals.credit), T('fees minus credits', 'cargos menos créditos')]]));

    if (!(U.num(tn.rent) > 0)) {
      var q = ui.form([{ id: 'rent', label: T('Monthly rent', 'Renta mensual'), type: 'money' }, { id: 'dueDay', label: T('Due day of the month (1 to 28)', 'Día de pago (1 a 28)'), type: 'number', min: 1, max: 28 },
        { id: 'deposit', label: T('Security deposit agreed', 'Depósito acordado'), type: 'money' }, { id: 'leaseStart', label: T('Rent starts on', 'La renta empieza el'), type: 'date' }], { dueDay: '1', leaseStart: tn.leaseStart || tn.moveIn || '' });
      main.appendChild(ui.card(T('Set the rent to track each month', 'Indique la renta para seguir cada mes'), [q.el, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var v = q.read(), d = parseInt(v.dueDay, 10);
        S.set('tenancy', Object.assign(TN.rec.tenancy(), { rent: v.rent, dueDay: d >= 1 && d <= 28 ? String(d) : '1', deposit: v.deposit, leaseStart: D.isIso(v.leaseStart) ? v.leaseStart : (tn.leaseStart || '') }));
        ui.renderRoute();
      } }, T('Save', 'Guardar')))]));
    } else if (sum.expected.length) {
      main.appendChild(ui.card(T('Rent by month', 'Renta por mes'), [h('div', { class: 'months' }, sum.expected.slice().reverse().map(function (m) {
        return h('div', { class: 'month ' + MS[m.status][0] }, h('strong', { text: D.monthLabel(m.month) }), h('span', { text: U.money(m.paid) + ' / ' + U.money(m.owed) }), h('span', { class: 'small', text: T(MS[m.status][1], MS[m.status][2]) }));
      })), h('p', { class: 'small', text: T('Rent ', 'Renta ') + U.money(sum.rent) + T(', due on day ', ', se paga el día ') + sum.dueDay + T(' of each month. Partial months are not prorated: if your lease prorates, note the agreed amount on the payment.', ' de cada mes. Los meses parciales no se prorratean: si su contrato lo hace, anote el monto acordado en el pago.') })], 'months-card'));
    }

    f = ui.form([{ id: 'date', label: T('Date paid', 'Fecha de pago'), type: 'date' }, { id: 'kind', label: T('Type', 'Tipo'), type: 'select', options: kindOpts() },
      { id: 'period', label: T('Rent for month', 'Renta del mes'), type: 'month', hint: T('Rent payments only.', 'Solo pagos de renta.') }, { id: 'amount', label: T('Amount', 'Monto'), type: 'money', ph: tn.rent || '' },
      { id: 'method', label: T('How it was paid', 'Cómo se pagó'), ph: T('Bank transfer, check 1024, money order', 'Transferencia, cheque 1024, giro') }, { id: 'ref', label: T('Reference or confirmation number', 'Referencia o número de confirmación') },
      { id: 'note', label: T('Note', 'Nota'), type: 'textarea', rows: 2 }], { date: today, kind: 'rent', period: today.slice(0, 7) });
    f.inputs.date.addEventListener('change', function () { if (D.isIso(f.inputs.date.value)) { f.inputs.period.value = f.inputs.date.value.slice(0, 7); } });
    function drawR() { ui.clear(rph).appendChild(receipt ? ui.photoGrid([receipt], function () { TN.photos.del(receipt); receipt = ''; drawR(); }) : ui.empty(T('No receipt photo yet (optional).', 'Aún no hay foto del recibo (opcional).'))); }
    drawR();
    main.appendChild(ui.card(T('Log a payment', 'Anotar un pago'), [f.el, h('h4', { text: T('Receipt or proof of payment', 'Recibo o comprobante') }), rph,
      h('div', { class: 'row' }, ui.photoPicker(T('Add a receipt photo', 'Agregar foto del recibo'), function () { return T('Receipt: ', 'Recibo: ') + kindLabel(f.inputs.kind.value) + ' ' + (f.inputs.amount.value || ''); }, function (rec) { if (receipt) { TN.photos.del(receipt); } receipt = rec.id; drawR(); })),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () {
        var v = f.read(), amt = U.num(v.amount);
        if (!D.isIso(v.date)) { ui.toast(T('Choose the date it was paid.', 'Elija la fecha de pago.')); return; }
        if (!(amt > 0)) { f.error('amount', T('Enter an amount above zero.', 'Escriba un monto mayor que cero.')); return; }
        f.error('amount', '');
        if (!put({ id: TN.uid(), date: v.date, kind: v.kind, period: v.kind === 'rent' && /^\d{4}-\d{2}$/.test(v.period) ? v.period : '', amount: amt.toFixed(2), method: v.method.trim(), ref: v.ref.trim(), note: v.note.trim(), receipt: receipt }) && TN.trial.on()) { return; }
        ui.toast(T('Payment logged.', 'Pago anotado.')); ui.renderRoute();
      } }, T('Save payment', 'Guardar pago')))], 'pay-form'));

    main.appendChild(ui.card(T('All entries', 'Todos los movimientos'), [sum.rows.length ? ui.table([T('Date', 'Fecha'), T('Type', 'Tipo'), T('For', 'Para'), T('Amount', 'Monto'), T('How', 'Cómo'), T('Receipt', 'Recibo'), ''],
      sum.rows.slice().reverse().map(function (e) {
        return [D.pretty(e.date), kindLabel(e.kind), e.kind === 'rent' ? D.monthLabel(LG.monthOf(e)) : (e.note ? U.clip(e.note, 40) : ''), U.money(U.num(e.amount)), [e.method, e.ref].filter(Boolean).join(' · '),
          e.receipt ? h('button', { type: 'button', class: 'btn small', onclick: function () { ui.modal(T('Receipt photo', 'Foto del recibo'), ui.photoInfo(e.receipt)); } }, T('View', 'Ver')) : '—',
          h('div', { class: 'row tight' }, h('a', { class: 'btn small', href: '#/ledger/receipt/' + e.id, text: T('Print receipt', 'Imprimir recibo') }), twice(T('Delete', 'Borrar'), T('Press again', 'Pulse otra vez'), function () { S.set('ledger', all().filter(function (x) { return x.id !== e.id; })); if (e.receipt) { TN.photos.del(e.receipt); } ui.renderRoute(); }))];
      }), 'ltable') : ui.empty(T('No payments logged yet.', 'Aún no hay pagos anotados.')),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: function () { ui.saveText('stark-tenancy-ledger.csv', LG.csv(all()), 'text/csv;charset=utf-8'); } }, T('Save as a spreadsheet (CSV)', 'Guardar como hoja de cálculo (CSV)')), h('a', { class: 'btn', href: '#/ledger/print', text: T('Print a statement', 'Imprimir estado de cuenta') }))]));
    main.appendChild(ui.notice(T('The ledger adds up what you log; it does not know about payments you have not entered. Deposit rules (limits, interest, where it is held, how and when it is returned) are set by state and local law.',
      'El registro suma lo que usted anota; no sabe de pagos que no haya escrito. Las reglas del depósito (límites, intereses, dónde se guarda, cómo y cuándo se devuelve) las fija la ley estatal y local.'), 'soft'));
    main.appendChild(ui.legal());
  }

  function receiptView(main, e) {
    var tn = TN.rec.tenancy(), sheet = h('article', { class: 'sheet receipt' }), what = e.kind === 'rent' ? T('Rent for ', 'Renta de ') + D.monthLabel(LG.monthOf(e)) : kindLabel(e.kind);
    main.appendChild(h('div', { class: 'row noprint' }, h('a', { class: 'btn', href: '#/ledger', text: T('Back to the ledger', 'Volver al registro') }), h('button', { type: 'button', class: 'btn primary', onclick: function () { ui.printEl(sheet); } }, T('Print or save as PDF', 'Imprimir o guardar como PDF'))));
    main.appendChild(ui.notice(T('Landlords: giving a dated receipt for every payment is a simple way to keep things fair and clear. Tenants: ask for one, or keep this as your own record.', 'Propietarios: dar un recibo fechado por cada pago es una forma simple de mantener las cosas claras y justas. Inquilinos: pídalo, o guarde este como su propio registro.'), 'soft'));
    sheet.appendChild(h('header', { class: 'sheet-head' }, h('h1', { text: T('Payment receipt', 'Recibo de pago') }), h('p', { class: 'rno', text: T('Receipt no. ', 'Recibo n.º ') + LG.receiptNo(e) })));
    sheet.appendChild(h('dl', { class: 'kv big' }, h('dt', { text: T('Amount', 'Monto') }), h('dd', null, h('strong', { text: U.money(U.num(e.amount)) })), h('dt', { text: T('For', 'Por') }), h('dd', { text: what }),
      h('dt', { text: T('Date paid', 'Fecha de pago') }), h('dd', { text: D.pretty(e.date) }), h('dt', { text: T('Paid by', 'Pagado por') }), h('dd', { text: tn.tenantName || '______________________' }),
      h('dt', { text: T('Received by', 'Recibido por') }), h('dd', { text: tn.landlordName || '______________________' }), h('dt', { text: T('Property', 'Vivienda') }), h('dd', { text: tn.address || '______________________' }),
      e.method ? [h('dt', { text: T('Method', 'Forma de pago') }), h('dd', { text: e.method })] : null, e.ref ? [h('dt', { text: T('Reference', 'Referencia') }), h('dd', { text: e.ref })] : null, e.note ? [h('dt', { text: T('Note', 'Nota') }), h('dd', { text: e.note })] : null));
    sheet.appendChild(h('div', { class: 'sigcols' }, h('div', { class: 'sigcol' }, h('div', { class: 'sigline', text: T('Signature of the person receiving payment', 'Firma de quien recibe el pago') })), h('div', { class: 'sigcol' }, h('div', { class: 'sigline', text: T('Date', 'Fecha') }))));
    sheet.appendChild(h('footer', { class: 'sheet-foot' }, h('p', { text: T('Made with Stark Tenancy, an offline record-keeping app.', 'Hecho con Stark Tenancy, una app de registros sin conexión.') })));
    main.appendChild(sheet);
  }

  function printView(main) {
    var tn = TN.rec.tenancy(), today = ui.today(), sum = LG.summary(all(), TN.rec.ledgerCfg(tn), today), sheet = h('article', { class: 'sheet' });
    main.appendChild(h('div', { class: 'row noprint' }, h('a', { class: 'btn', href: '#/ledger', text: T('Back to the ledger', 'Volver al registro') }), h('button', { type: 'button', class: 'btn primary', onclick: function () { ui.printEl(sheet); } }, T('Print or save as PDF', 'Imprimir o guardar como PDF'))));
    sheet.appendChild(h('header', { class: 'sheet-head' }, h('h1', { text: T('Rent and deposit statement', 'Estado de cuenta de renta y depósito') }), h('dl', { class: 'kv' }, h('dt', { text: T('Property', 'Vivienda') }), h('dd', { text: tn.address || '' }),
      h('dt', { text: T('Tenant', 'Inquilino') }), h('dd', { text: tn.tenantName || '' }), h('dt', { text: T('Landlord', 'Propietario') }), h('dd', { text: tn.landlordName || '' }), h('dt', { text: T('Prepared on', 'Preparado el') }), h('dd', { text: D.pretty(today) }))));
    sheet.appendChild(ui.stats([[U.money(sum.totals.rent), T('rent paid', 'renta pagada')], [U.money(sum.totals.deposit), T('deposit paid', 'depósito pagado')], [U.money(sum.totals.deposit_back + sum.totals.deduction), T('deposit returned or deducted', 'depósito devuelto o descontado')], [U.money(sum.depositHeld), T('deposit held now', 'depósito retenido')]]));
    if (sum.expected.length) { sheet.appendChild(ui.table([T('Month', 'Mes'), T('Due', 'Vence'), T('Rent', 'Renta'), T('Paid', 'Pagado'), T('Status', 'Estado')], sum.expected.map(function (m) { return [D.monthLabel(m.month), D.pretty(m.due), U.money(m.owed), U.money(m.paid), T(MS[m.status][1], MS[m.status][2])]; }), 'ptable')); }
    sheet.appendChild(ui.table([T('Date', 'Fecha'), T('Type', 'Tipo'), T('For', 'Para'), T('Amount', 'Monto'), T('How', 'Cómo'), T('Receipt', 'Recibo')], sum.rows.map(function (e) { return [D.pretty(e.date), kindLabel(e.kind), e.kind === 'rent' ? D.monthLabel(LG.monthOf(e)) : (e.note || ''), U.money(U.num(e.amount)), [e.method, e.ref].filter(Boolean).join(' · '), e.receipt ? T('photo kept', 'foto guardada') : '—']; }), 'ptable'));
    sheet.appendChild(h('footer', { class: 'sheet-foot' }, h('p', { text: T('Made with Stark Tenancy, an offline record-keeping app. Totals add up the entries logged in the app. ', 'Hecho con Stark Tenancy, una app de registros sin conexión. Los totales suman los movimientos anotados. ') + T(TN.data.meta.notLegal, TN.data.meta.notLegalEs) })));
    main.appendChild(sheet);
  }
})(typeof window !== 'undefined' ? window : globalThis);
