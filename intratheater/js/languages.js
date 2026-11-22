/* Stark IntraTheater by Stark. World Languages Starter: greetings, numbers 1 to 10 and colours in ten widely spoken languages.
   Read-aloud uses the browser's speechSynthesis with offline (local) voices only, and only where such a voice exists. */
(function () {
  'use strict';
  const { h, clear, data } = SIT;
  const LANGS = data.langs, synth = window.speechSynthesis;
  const ls = { id: LANGS[0].id };
  const norm = c => String(c || '').toLowerCase().replace('_', '-');

  /* an installed local voice for a BCP 47 tag (exact match first, then same base language); null when none */
  function voiceFor(code) {
    if (!SIT.canSpeak) return null;
    const want = norm(code), base = want.slice(0, 2), vs = synth.getVoices().filter(v => v.localService);
    return vs.find(v => norm(v.lang) === want) || vs.find(v => norm(v.lang).slice(0, 2) === base) || null;
  }
  function say(text, code) {
    const v = voiceFor(code); if (!v) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.85; synth.speak(u);
    return true;
  }
  let learnBox = null;   /* voices can arrive late: redraw the Learn tab (never a running quiz) when they do */
  if (SIT.canSpeak && synth.addEventListener) synth.addEventListener('voiceschanged', () => { if (learnBox && learnBox.isConnected && SIT.currentView() === 'lang') { clear(learnBox); renderLearn(learnBox, {}); } });

  const word = (lang, w, voice, extra) => h('span', { class: 'ex-word' },
    h('span', { class: 'ex-native', lang: lang.code.slice(0, 2) }, w[0]), w[1] !== w[0] ? h('span', { class: 'ex-roman muted' }, w[1]) : null,
    voice ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Hear ' + (extra || w[1]), onclick: () => say(w[0], lang.code) }, '🔊') : null);

  function renderLearn(box, q) {
    if (q.id && LANGS.some(l => l.id === q.id)) ls.id = q.id;
    learnBox = box;
    const lang = LANGS.find(l => l.id === ls.id), voice = voiceFor(lang.code), kid = !SIT.isGrown();
    box.appendChild(h('div', { class: 'chips', role: 'group', 'aria-label': 'Language' },
      LANGS.map(l => h('button', { type: 'button', class: 'chip', 'aria-pressed': l.id === ls.id ? 'true' : 'false', onclick: () => { ls.id = l.id; clear(box); renderLearn(box, {}); } }, l.name))));
    box.appendChild(h('section', { class: 'card' },
      h('h2', null, lang.name, ' ', h('span', { class: 'muted', lang: lang.code.slice(0, 2) }, lang.native)),
      h('p', null, kid ? lang.kid : lang.adult), h('p', { class: 'muted small' }, 'Spoken in: ' + lang.where),
      h('p', { class: 'fine' }, voice ? 'A ' + lang.name + ' voice is installed on this device, so the 🔊 buttons will read words aloud.' : 'No offline ' + lang.name + ' voice was found on this device, so the words are shown but cannot be read aloud. A voice can be added in your system settings.')));
    box.appendChild(h('section', { class: 'card' }, h('h3', null, 'Greetings'),
      h('div', { class: 'ex-wordtable' }, data.langGreetings.map(g => h('div', { class: 'ex-wrow' }, h('span', { class: 'ex-en' }, g.en), word(lang, lang.words[g.id], voice, g.en))))));
    box.appendChild(h('section', { class: 'card' }, h('h3', null, 'Numbers 1 to 10'),
      voice ? h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-small', onclick: () => say(lang.numbers.map(n => n[0]).join(', '), lang.code) }, '🔊 Count 1 to 10')) : null,
      h('div', { class: 'ex-numgrid' }, lang.numbers.map((n, i) => h('div', { class: 'ex-num' }, h('span', { class: 'ex-numeral' }, String(i + 1)), word(lang, n, voice, String(i + 1)))))));
    box.appendChild(h('section', { class: 'card' }, h('h3', null, 'Colours'),
      h('div', { class: 'ex-numgrid' }, data.langColours.map(c => h('div', { class: 'ex-num' }, h('span', { class: 'ex-colour', style: 'background:' + c.hex, role: 'img', 'aria-label': c.en }), h('span', { class: 'ex-en small' }, c.en), word(lang, lang.colours[c.id], voice, c.en))))));
    box.appendChild(h('p', { class: 'fine' }, 'This is a starter set. Non-Latin scripts show the native writing with a simple romanisation under it. Pronunciation and spelling vary between regions; Arabic is shown in Modern Standard Arabic and Portuguese in its Brazilian form.'));
  }

  function renderQuiz(box) {
    SIT.exQuiz(box, LANGS.map(l => ({ key: () => 'lang-' + l.id, label: '🗣️ ' + l.name, text: l.native + ': greetings, numbers and colours.', make: lv => SIT.expLib.langQuestions(l, lv, 10) })));
  }

  SIT.explorer('lang', {
    title: 'World Languages Starter', icon: '🗣️',
    ledeKid: 'Say hello, count to ten and name the colours in ten languages!',
    ledeGrown: 'Greetings, numbers 1 to 10 and colours in ten widely spoken languages, with read-aloud through your system voices where one is installed.',
    tabs: [{ id: 'learn', label: '📖 Learn', render: renderLearn }, { id: 'quiz', label: '❓ Word game', render: renderQuiz }]
  });
})();
