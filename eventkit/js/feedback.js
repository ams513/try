/* Stark Event Kit feedback: a small form that composes a mailto: link. Nothing is sent by the app; the person's own
   mail app opens with the message ready and they press send. No network calls, no storage, no tracking. */
(function (g) {
  'use strict';
  var S = g.SEK, F = S.feedback = { TO: 'hello@starkforall.com', SUBJECT: 'Stark Events feedback', MAXTEXT: 800 };
  function clip(s) { return String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, F.MAXTEXT); }
  F.appName = function () { return 'Stark Event Kit' + (S.TRIAL ? ' (free trial)' : ''); };
  F.rating = function (n) { n = Math.floor(+n); return n >= 1 && n <= 5 ? n : 0; };
  /* Pure: the message text and the mailto: link for a set of answers. */
  F.compose = function (o) {
    o = o || {};
    var body = 'What I like:\n' + (clip(o.like) || '(nothing written)') + '\n\nWhat is missing:\n' + (clip(o.missing) || '(nothing written)') +
      '\n\nRating: ' + (F.rating(o.rating) ? F.rating(o.rating) + ' of 5' : 'not given') + '\n\n--\n' + F.appName() + ' ' + S.VERSION;
    return { to: F.TO, subject: F.SUBJECT, body: body,
      href: 'mailto:' + F.TO + '?subject=' + encodeURIComponent(F.SUBJECT) + '&body=' + encodeURIComponent(body) };
  };
  if (!S.ui || !g.document) return;
  var UI = S.ui, h = UI.h;
  UI.routes.feedback = function (root) {
    var a = { like: '', missing: '', rating: 0 }, link, preview, stars;
    function update() {
      var m = F.compose(a);
      link.setAttribute('href', m.href); preview.value = 'To: ' + m.to + '\nSubject: ' + m.subject + '\n\n' + m.body;
      Array.prototype.forEach.call(stars.querySelectorAll('input'), function (i) { i.checked = +i.value === a.rating; });
    }
    function ta(id, key, ph) { return h('textarea', { id: id, rows: '4', maxlength: String(F.MAXTEXT), placeholder: ph, oninput: function (e) { a[key] = e.target.value; update(); } }); }
    stars = h('div', { class: 'row', role: 'radiogroup', 'aria-label': 'Rating from 1 to 5' }, [1, 2, 3, 4, 5].map(function (n) {
      return h('label', { class: 'fb-star' }, h('input', { type: 'radio', name: 'fb-rating', value: String(n), onchange: function () { a.rating = n; update(); } }), ' ' + n);
    }));
    link = h('a', { class: 'btn primary', id: 'fb-send', href: 'mailto:' }, 'Open my email app');
    preview = h('textarea', { id: 'fb-preview', rows: '9', readonly: true, 'aria-label': 'The email that will open' });
    root.appendChild(h('h1', { text: 'Send feedback' }));
    root.appendChild(h('div', { class: 'card' },
      h('p', { class: 'muted', text: 'Tell us what works and what is missing. This does not send anything by itself: the button below opens your own email app with the message ready, and you press send. Nothing leaves this computer unless you do.' }),
      UI.field('What you like', ta('fb-like', 'like', 'What works well for your events?')),
      UI.field('What is missing', ta('fb-missing', 'missing', 'What would you add or change?')),
      h('div', { class: 'field' }, h('span', { text: 'Rating (1 to 5, optional)' }), stars),
      h('div', { class: 'row' }, link, h('a', { class: 'btn', href: '#/home', text: 'Back' })),
      h('p', { class: 'fine', id: 'fb-note', text: 'Opens your email app, addressed to ' + F.TO + ', with the app name and version added. No email app? Copy the text below and send it from anywhere.' }),
      UI.field('Preview (you can copy this)', preview)));
    update();
  };
})(window);
