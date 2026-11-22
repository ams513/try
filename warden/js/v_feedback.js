/* Stark Warden: Send feedback screen (opens the person's own email app), and the free-trial badge and buy button. */
(function (root) {
  'use strict';
  var SW = root.SW, ui = SW.ui, h = ui.h, doc = root.document;

  function meta() { return { name: 'Stark Warden', version: SW.data.meta.version, trial: SW.trial.on() }; }
  function buyBtn(cls) {
    var u = SW.trial.buyUrl();
    return u ? h('a', { class: cls || 'btn primary', href: u, target: '_blank', rel: 'noopener noreferrer', text: SW.trial.BUY_LABEL }) : null;
  }

  ui.route('feedback', null, function (main) {
    var st = { like: '', missing: '', rating: 0 }, link = h('a', { class: 'btn primary', id: 'fb-send', text: 'Open my email app' }),
      like = h('textarea', { id: 'fb-like', rows: 4, maxlength: 1500 }), miss = h('textarea', { id: 'fb-miss', rows: 4, maxlength: 1500 }),
      stars = h('div', { class: 'row', role: 'radiogroup', 'aria-label': 'Rating from 1 to 5' });
    function update() { link.setAttribute('href', SW.feedback.mailto(st, meta())); }
    [1, 2, 3, 4, 5].forEach(function (n) {
      var id = 'fb-r' + n;
      stars.appendChild(h('span', null, h('input', { type: 'radio', name: 'fb-rating', id: id, value: String(n), onchange: function () { st.rating = n; update(); } }), h('label', { for: id, text: ' ' + n + ' ' })));
    });
    like.addEventListener('input', function () { st.like = like.value; update(); });
    miss.addEventListener('input', function () { st.missing = miss.value; update(); });
    update();
    main.appendChild(h('h2', { text: 'Send feedback' }));
    main.appendChild(ui.card(null, [
      h('p', { class: 'lead', text: 'Tell us what works and what is missing. This opens your own email app with a message already written. Nothing is sent from here: you read it, edit it, and press send yourself.' }),
      h('div', { class: 'field' }, h('label', { for: 'fb-like', text: 'What do you like?' }), like),
      h('div', { class: 'field' }, h('label', { for: 'fb-miss', text: 'What is missing?' }), miss),
      h('fieldset', { class: 'field' }, h('legend', { text: 'Rating (1 is poor, 5 is great)' }), stars),
      h('div', { class: 'row' }, link, h('button', { type: 'button', class: 'btn', onclick: function () { ui.copyText('To: ' + SW.feedback.TO + '\nSubject: ' + SW.feedback.SUBJECT + '\n\n' + SW.feedback.body(st, meta()), 'Message copied.'); } }, 'Copy the message instead')),
      ui.notice('This opens your email app, addressed to ' + SW.feedback.TO + '. If nothing opens, copy the message and send it from any email. Only the app name and version are added; none of your saved data is included.', 'soft')]));
  });

  /* trial badge in the top bar, and the buy strip at the top of the footer */
  function mount() {
    var bar = doc.querySelector('.topbar'), foot = doc.querySelector('.footer'), strip, b;
    if (!SW.trial.on() || !bar || doc.getElementById('trial-badge')) { return; }
    bar.insertBefore(h('span', { class: 'trial-badge', id: 'trial-badge', text: 'Free trial' }), bar.children[1] || null);
    if (foot) {
      b = buyBtn('btn small primary');
      strip = h('p', { class: 'trial-strip' }, h('strong', { text: 'Free trial. ' }), 'Keep up to ' + SW.trial.limit() + ' evidence-log entries. Nothing expires and nothing is ever deleted; back up in Settings and restore it in the full version. ' + ((window.StarkTrial || {}).notIncluded || '') + ' ', b);
      foot.insertBefore(strip, foot.firstChild);
    }
  }
  SW.feedbackUI = { mount: mount, buyBtn: buyBtn, meta: meta };
})(window);
