/* Stark Tenancy: "Send feedback" (opens the person's own email app) and the free-trial chrome (badge, usage note, buy button). No network, no tracking. */
(function (root) {
  'use strict';
  var TN = root.TN, ui = TN.ui, h = ui.h, S = TN.store, T = TN.i18n.T, doc = root.document, F = TN.feedback;

  ui.route('feedback', null, function (main) {
    var like = h('textarea', { id: 'fb-like', rows: 3, maxlength: 800 }), miss = h('textarea', { id: 'fb-miss', rows: 3, maxlength: 800 }), stars = h('div', { class: 'row tight', role: 'radiogroup', 'aria-label': T('Rating from 1 to 5', 'Calificación de 1 a 5') }),
      rate = 0, link = h('a', { class: 'btn primary', id: 'fb-send', href: F.mailto({}), text: T('Open my email app', 'Abrir mi correo') }), i;
    function state() { return { liked: like.value, missing: miss.value, rating: rate }; }
    function sync() { link.setAttribute('href', F.mailto(state())); }
    function pick(n) { rate = n; Array.prototype.forEach.call(stars.querySelectorAll('input'), function (x) { x.checked = +x.value === n; }); sync(); }
    for (i = 1; i <= 5; i++) { stars.appendChild(h('label', { class: 'btn small' }, h('input', { type: 'radio', name: 'fb-rate', value: String(i), onchange: (function (n) { return function () { pick(n); }; })(i) }), ' ' + i)); }
    like.addEventListener('input', sync); miss.addEventListener('input', sync);
    ui.esReady();
    main.appendChild(ui.hero(T('Send feedback', 'Enviar comentarios'), T('Tell us what works and what is missing. Stark reads every message.', 'Cuéntenos qué funciona y qué falta. Stark lee cada mensaje.'), true));
    main.appendChild(ui.card(T('Your feedback', 'Sus comentarios'), [
      ui.notice(T('This opens your own email app with a message already written. Nothing is sent until you press send there, and the app sends nothing by itself. No tenancy data is included.', 'Esto abre su propia app de correo con el mensaje ya escrito. No se envía nada hasta que usted lo envíe allí, y la app no envía nada por sí sola. No se incluyen datos de su arrendamiento.'), 'soft'),
      h('div', { class: 'field wide' }, h('label', { for: 'fb-like', text: T('What do you like?', '¿Qué le gusta?') }), like),
      h('div', { class: 'field wide' }, h('label', { for: 'fb-miss', text: T('What is missing?', '¿Qué falta?') }), miss),
      h('div', { class: 'field wide' }, h('span', { text: T('Rating (1 = poor, 5 = great)', 'Calificación (1 = mala, 5 = excelente)') }), stars),
      h('div', { class: 'row' }, link, h('button', { type: 'button', class: 'btn', onclick: function () { ui.copyText(F.body(state()), T('Feedback text copied. Paste it into an email to ' + F.TO + '.', 'Texto copiado. Péguelo en un correo a ' + F.TO + '.')); } }, T('Copy the text instead', 'Copiar el texto')), h('a', { class: 'btn', href: '#/home', text: T('Back', 'Volver') })),
      h('p', { class: 'small', text: T('To: ', 'Para: ') + F.TO + ' · ' + T('Subject: ', 'Asunto: ') + F.SUBJECT })], 'feedback'));
  });

  function buyBtn(big) { return h('span', { class: 'btn primary' + (big ? ' big' : ''), text: T('Coming soon to the store', 'Próximamente en la tienda') }); }

  /* called after every screen draw (core.updateChrome) */
  TN.chrome = function () {
    var es = TN.i18n.lang() === 'es', ff = doc.getElementById('foot-feedback'), bar = doc.querySelector('.topbar'), b = doc.getElementById('trial-badge'), fb = doc.getElementById('foot-buy'), main = doc.getElementById('main'),
      r = ui.parseHash().name, used, left;
    if (ff) { ff.textContent = es ? 'Enviar comentarios' : 'Send feedback'; }
    if (!TN.trial.on()) { return; }
    if (!b && bar) { b = h('span', { class: 'trial-badge', id: 'trial-badge', role: 'note' }); bar.insertBefore(b, doc.querySelector('.gear')); }
    if (b) { b.textContent = es ? 'Prueba gratis' : 'Free trial'; }
    if (!fb) { fb = h('p', { id: 'foot-buy', class: 'footlinks' }); doc.querySelector('.footer').insertBefore(fb, doc.querySelector('.footer .small')); }
    ui.clear(fb).appendChild(h('span', { text: T('Free trial · Coming soon to the store', 'Prueba gratis · Próximamente en la tienda') }));
    if (main && (r === 'home' || r === 'settings' || r === 'feedback')) {
      used = S.trialUsed(); left = Math.max(0, TN.trial.CAP - used);
      main.insertBefore(h('div', { class: 'notice soft trial-note', role: 'note', id: 'trial-note' },
        h('strong', { text: T('Free trial: ', 'Prueba gratis: ') }),
        T(used + ' of ' + TN.trial.CAP + ' saved records used (condition reports, repairs and rent entries). ' + (left ? left + ' left.' : 'Full: you can still view, edit, delete and export everything.') + ' No time limit, and your data is never deleted. Save a backup file in Settings and restore it in the full app to carry everything over. ' + ((root.StarkTrial || {}).notIncluded || ''),
          used + ' de ' + TN.trial.CAP + ' registros usados (reportes, reparaciones y pagos de renta). ' + (left ? 'Quedan ' + left + '.' : 'Completo: aún puede ver, editar, borrar y exportar todo.') + ' Sin límite de tiempo, y sus datos nunca se borran. Guarde una copia en Ajustes y restáurela en la app completa para llevarlo todo.'),
        ' ', buyBtn(false)), main.firstChild);
    }
  };
})(window);
