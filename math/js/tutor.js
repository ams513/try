/* Stark Math.
   The practice screen: Madeline presents a problem, checks the answer, diagnoses mistakes from the actual wrong
   answer, climbs the hint ladder (nudge, hint, next step, full solution) and gives specific encouragement.
   Her lines are written rules and templates, adapted to the learner's level. */
(function () {
  'use strict';
  const SM = window.SM;
  const { h, clear } = SM;

  /* ---------- Madeline's lines by tier (kid / std / adv) ---------- */
  const LINES = {
    intro: { kid: ['Let\'s try this one together!', 'Here\'s a fun one for you.', 'Ready? Take your time.'], std: ['Here\'s the next one. Take your time.', 'Let\'s work through this one.', 'Try this one. Read it carefully first.'], adv: ['Next problem.', 'Consider the following.', 'Here is one to work through.'] },
    firstTry: { kid: ['Yes! You got it on the first try!', 'Wow, first try!', 'That\'s right! Great thinking.'], std: ['Correct, first try.', 'That\'s right, and first time.', 'Exactly right.'], adv: ['Correct.', 'Right, first attempt.', 'Exactly.'] },
    afterFix: { kid: ['You fixed it! That\'s what real mathematicians do.', 'Yes! You found the slip and fixed it.'], std: ['That\'s it. You went back, found the slip and fixed it, which is exactly the habit that matters.', 'Correct now. Spotting your own mistake is a real skill.'], adv: ['Correct. Good recovery: you located the error rather than guessing.', 'Right. Checking the step that failed is the efficient fix.'] },
    afterHint: { kid: ['You did it with a little help. Next time, try it on your own first!', 'Yes! The hint helped and you finished it.'], std: ['Correct. The hint got you moving; next time see if you can start without it.', 'Right. You used the hint well.'], adv: ['Correct, with a hint. Try the next one unaided.', 'Right. Note which step needed the hint.'] },
    wrong1: { kid: ['Not quite. Want to try again?', 'Hmm, not yet. Have another go!'], std: ['Not quite. Have another look.', 'Not yet. Check your working and try again.'], adv: ['Not correct. Recheck the computation.', 'That does not match. Try again.'] },
    wrong2: { kid: ['Still not it. Let\'s use a nudge.', 'Tricky one! Tap Nudge for help.'], std: ['Still not right. A nudge might help.', 'Let\'s use the hint ladder on this one.'], adv: ['Still incorrect. Consider the hint.', 'Try the next rung of the hint ladder.'] },
    form: { kid: ['So close!'], std: ['Nearly there.'], adv: ['Nearly.'] },
    reveal: { kid: ['Here\'s how it works, step by step.', 'Let\'s look at it together.'], std: ['Here is the full solution. Read each step, then try a similar one.', 'Here\'s the worked solution.'], adv: ['Full solution below. Then attempt a fresh instance.', 'Worked solution follows.'] },
    streak: { kid: ['{n} in a row! You\'re on fire!'], std: ['That\'s {n} in a row on {skill}.'], adv: ['{n} consecutive correct on {skill}.'] },
    levelUp: { kid: ['Hooray! {skill} is now {band}!'], std: ['{skill} just moved up to {band}.'], adv: ['{skill}: now {band}.'] },
    focus: { kid: ['You were great at {focus}.'], std: ['Nice work {focus}.', 'Good {focus}.'], adv: ['Solid {focus}.'] },
  };
  let rot = 0;
  const line = (key, L, vars) => { const t = LINES[key][L.kid ? 'kid' : L.adv ? 'adv' : 'std']; let s = t[rot++ % t.length]; for (const k in vars || {}) s = s.split('{' + k + '}').join(vars[k]); return s; };
  SM.LINES = LINES;


  /**
   * Run a practice session in `root`.
   * opts: { skills: [ids] (pool), adaptive: bool, count: n (0 = endless), title, lv, df, onDone(summary) }
   */
  function practice(root, opts) {
    clear(root);
    const lvl = SM.level(), lv = opts.lv !== undefined ? opts.lv : lvl.lv, df = opts.df !== undefined ? opts.df : lvl.df;
    const data = SM.data(), recent = [], results = [];
    let pr = null, skill = null, L = null, hints = 0, wrongs = 0, revealed = false, done = false, lastDiag = null, stepShown = 0, seedBase = SM.uid(), seen = new Set();
    const rd = t => SM.rd(t, seen); // reading support (Plain words / Standard / Detailed)
    const rnd = SM.rng(seedBase).next;

    // ----- layout -----
    const madBox = h('div', { class: 'mad-figure', 'aria-hidden': 'true' });
    const bubble = h('div', { class: 'bubble', role: 'status', 'aria-live': 'polite' });
    const replay = SM.btn('Read aloud', () => say(bubble.textContent), 'btn-ghost btn-small', { 'aria-label': 'Read Madeline\'s message aloud' });
    const madPanel = h('aside', { class: 'mad-panel', 'aria-label': 'Madeline' }, madBox, h('div', { class: 'mad-talk' }, h('div', { class: 'mad-name' }, 'Madeline', h('span', { class: 'mad-tag' }, 'rule-based guide')), bubble, h('div', { class: 'row' }, replay)));
    const head = h('div', { class: 'prob-head' }), qEl = h('div', { class: 'prob-q' }), picEl = h('div', { class: 'prob-pic' });
    const input = h('input', { class: 'ans-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer', inputmode: 'text' });
    const choiceBox = h('div', { class: 'choices', role: 'group', 'aria-label': 'Choices' });
    const checkBtn = SM.btn('Check', () => doCheck(), 'btn-primary');
    const hintBtn = SM.btn('Nudge', () => doHint(), '');
    const solveBtn = SM.btn('Show solution', () => doReveal(), 'btn-ghost');
    const nextBtn = SM.btn('Next problem', () => next(), 'btn-primary', { hidden: true });
    const noteBtn = SM.btn('Save to notebook', () => saveToNotebook(), 'btn-ghost btn-small', { hidden: true });
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const hintList = h('ol', { class: 'hint-list' });
    const stepsEl = h('ol', { class: 'steps' });
    const proofEl = h('details', { class: 'proof', hidden: true });
    const kb = SM.mathkb.mount(input, { onEnter: () => (!nextBtn.hidden ? next() : doCheck()), enterLabel: 'Check my answer, or go to the next problem', open: SM.prefs().keypad });
    const progressEl = h('div', { class: 'sess-progress' });
    const answerRow = h('div', { class: 'ans-row' }, h('label', { class: 'sr-only', for: 'ans' }, 'Your answer'), input, kb.toggle);
    input.id = 'ans';
    const card = h('section', { class: 'prob-card', 'aria-label': 'Problem' }, progressEl, head, qEl, picEl, choiceBox, answerRow, kb.preview, kb.msg, kb.status, kb.panel,
      h('div', { class: 'row btn-row' }, checkBtn, hintBtn, solveBtn, nextBtn, noteBtn), feedback, hintList, stepsEl, proofEl);
    root.appendChild(h('div', { class: 'practice' }, madPanel, card));
    const mad = SM.Madeline.mount(madBox);
    root._cleanup = () => { mad.destroy(); SM.stopSpeech(); };

    input.setAttribute('aria-describedby', kb.status.id);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!nextBtn.hidden) next(); else doCheck(); } });

    function say(text, expr, gest) { text = rd(text); bubble.innerHTML = SM.renderText(text); mad.set(expr || mad.expr, gest); mad.say(text); }
    function chooseSkill() {
      const pool = opts.skills;
      if (opts.order && opts.order.length) return opts.order[results.length % opts.order.length];
      if (!opts.adaptive || pool.length === 1) return pool[Math.floor(rnd() * pool.length)];
      return SM.learn.pick(data.mastery, pool, rnd, recent.slice(-Math.min(3, pool.length - 1)));
    }
    function next() {
      if (opts.count && results.length >= opts.count) return finish();
      const id = chooseSkill(); recent.push(id);
      skill = SM.SKILL[id]; L = SM.ctx(skill, lv, df);
      pr = SM.generate(id, lv, df, seedBase + '-' + results.length + '-' + Math.floor(rnd() * 1e9));
      hints = 0; wrongs = 0; revealed = false; done = false; lastDiag = null; stepShown = 0; seen = new Set();
      clear(head).appendChild(h('div', { class: 'prob-meta' }, h('span', { class: 'badge' }, SM.subjectName(skill.subject)), h('span', { class: 'badge badge-soft' }, skill.strand), SM.levelBadge(pr.lv, pr.df)));
      head.appendChild(h('h2', { class: 'prob-title' }, skill.title));
      qEl.innerHTML = SM.renderText(rd(pr.q), { kid: L.kid });
      picEl.innerHTML = SM.picture(pr.pic); picEl.hidden = !pr.pic;
      clear(choiceBox); choiceBox.hidden = pr.ans.k !== 'choice';
      answerRow.hidden = pr.ans.k === 'choice'; kb.setKind(pr.ans.k);
      if (pr.ans.k === 'choice') pr.ans.options.forEach((o, i) => choiceBox.appendChild(h('button', { type: 'button', class: 'btn choice', html: SM.renderText(/[\d/^]/.test(o) && !/[a-zA-Z]{3}/.test(o) ? '$' + o + '$' : o), onclick: () => doCheck(String(i)) })));
      kb.reset(); input.placeholder = placeholder(pr.ans);
      clear(feedback); clear(hintList); clear(stepsEl); proofEl.hidden = true; clear(proofEl);
      checkBtn.hidden = pr.ans.k === 'choice'; hintBtn.hidden = false; hintBtn.textContent = 'Nudge'; solveBtn.hidden = false; nextBtn.hidden = true; noteBtn.hidden = true; checkBtn.disabled = false;
      progressEl.textContent = opts.count ? 'Problem ' + (results.length + 1) + ' of ' + opts.count : results.length ? results.filter(r => r.ok).length + ' of ' + results.length + ' correct so far' : '';
      say(line('intro', L), 'neutral', results.length === 0 ? 'point' : 'rest');
      if (pr.ans.k !== 'choice') setTimeout(() => input.focus({ preventScroll: true }), 30); else { const b = choiceBox.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
    }
    function placeholder(a) {
      return { num: a.pct ? 'e.g. 35%' : 'e.g. 3/4 or 0.75', approx: 'decimal, ' + a.dp + ' place' + (a.dp === 1 ? '' : 's'), qty: a.opt ? 'number (unit optional)' : 'number and unit, e.g. 12.5 m/s', expr: a.c ? 'e.g. x^3/3 + C' : 'e.g. 3x^2 - 2x', eqn: 'e.g. y = 2x + 3', set: 'e.g. 2, -3', pair: a.names && a.names[0] === 'q' ? 'e.g. 5 R 2' : 'e.g. (2, -1)', ineq: 'e.g. x > 3', ratio: 'e.g. 3:4', matrix: 'e.g. 1 2; 3 4', text: a.norm === 'hex' ? 'e.g. 1F' : 'e.g. 1011' }[a.k] || '';
    }
    function record(ok) {
      const before = SM.learn.band(data.mastery[skill.id]);
      data.mastery[skill.id] = SM.learn.update(data.mastery[skill.id], { correct: ok, hints, revealed, choice: pr.ans.k === 'choice' });
      const after = SM.learn.band(data.mastery[skill.id]);
      data.history.push({ t: Date.now(), s: skill.id, ok: ok && !revealed, h: hints, lv: pr.lv }); if (data.history.length > 600) data.history.splice(0, data.history.length - 600);
      data.stats.attempted++; if (ok && !revealed) data.stats.correct++;
      const day = new Date().toISOString().slice(0, 10); if (!data.stats.days.includes(day)) { data.stats.days.push(day); if (data.stats.days.length > 400) data.stats.days.shift(); }
      SM.saveData();
      results.push({ skill: skill.id, ok: ok && !revealed, hints, wrongs });
      return { before, after };
    }
    function doCheck(val) {
      if (done) return;
      const v = val !== undefined ? val : input.value;
      const res = SM.check(pr.ans, v);
      if (res.verdict === 'empty' || res.verdict === 'syntax') { feedback.className = 'feedback fb-info'; feedback.textContent = res.msg; say(res.msg, 'thinking'); return; }
      if (res.ok) {
        done = true;
        const { before, after } = record(true), rec = data.mastery[skill.id];
        let msg = wrongs && lastDiag ? line('afterFix', L) : hints ? line('afterHint', L) : line('firstTry', L);
        if (!hints && !wrongs) msg += ' ' + line('focus', L, { focus: skill.focus });
        if (res.note === 'simplify') msg += ' (You could simplify it to ' + SM.answerText(pr.ans) + '.)';
        if (res.note === 'exact') msg += ' The exact value is ' + SM.answerText(pr.ans) + '.';
        if (res.note === 'plusC') msg += ' Remember the constant of integration, + C.';
        if (res.note === 'sf-many') msg += ' (That is more significant figures than the data supports; ' + pr.ans.sf + ' is enough.)';
        const up = before !== after && ['Practising', 'Strong', 'Mastered'].includes(after);
        if (up) msg += ' ' + line('levelUp', L, { skill: skill.title, band: after });
        else if (rec.streak >= 3 && rec.streak % 2 === 1) msg += ' ' + line('streak', L, { n: rec.streak, skill: skill.title });
        feedback.className = 'feedback fb-ok'; feedback.textContent = 'Correct.';
        say(msg, up || rec.streak >= 5 ? 'celebrating' : 'smiling');
        finishProblem();
        return;
      }
      const soft = ['not-simplest', 'form', 'precision', 'sigfig', 'need-unit', 'partial', 'extra', 'swapped', 'boundary', 'shape', 'unit', 'transposed'];
      if (soft.includes(res.verdict)) { feedback.className = 'feedback fb-info'; feedback.textContent = res.msg; say(line('form', L) + ' ' + res.msg, 'encouraging'); return; }
      wrongs++;
      const diag = SM.diagnose(pr, v, res);
      feedback.className = 'feedback fb-bad';
      if (diag) {
        lastDiag = diag; feedback.textContent = diag.msg;
        say((L.kid ? 'Hmm, let\'s look at that. ' : '') + diag.msg, 'concerned');
      } else {
        feedback.textContent = res.msg || 'Not quite.';
        say((res.msg ? res.msg + ' ' : '') + (wrongs >= 2 ? line('wrong2', L) : line('wrong1', L)), 'encouraging');
        if (wrongs >= 2 && hints === 0) hintBtn.classList.add('pulse');
      }
      if (wrongs >= 4 && !revealed) solveBtn.classList.add('pulse');
    }
    function doHint() {
      hintBtn.classList.remove('pulse');
      if (hints < pr.hints.length) {
        const label = ['Nudge', 'Hint', 'Next step'][hints], t = pr.hints[hints];
        hintList.appendChild(h('li', { class: 'hint hint-' + hints }, h('strong', null, label + ': '), h('span', { html: SM.renderText(rd(t)) })));
        hints++;
        hintBtn.textContent = hints < pr.hints.length ? ['Nudge', 'Hint', 'Show next step'][hints] : 'Show full solution';
        say(t, 'thinking');
      } else doReveal();
    }
    function showSteps() {
      clear(stepsEl);
      pr.steps.forEach(s => stepsEl.appendChild(h('li', null, s.t ? h('span', { html: SM.renderText(rd(s.t)) }) : null, s.m ? h('div', { class: 'step-math math', html: SM.renderMath(s.m, { kid: L.kid }) }) : null)));
      stepsEl.appendChild(h('li', { class: 'step-ans' }, h('strong', null, 'Answer: '), h('span', { class: 'math', html: SM.renderMath(SM.answerText(pr.ans).replace(/ (m|s|J|N|W|V|A|K|Hz|Pa|g|L|C|Ω)(\b|\/|²|\^)/, ' $1$2')) })));
      if (pr.proof && L.adv) { proofEl.hidden = false; clear(proofEl).append(h('summary', null, L.pro ? 'Derivation' : 'Why it works'), h('p', { html: SM.renderText(pr.proof) })); }
    }
    function doReveal() {
      if (!done) { revealed = true; done = true; record(false); }
      showSteps();
      say(line('reveal', L), 'encouraging', 'point');
      finishProblem();
    }
    function finishProblem() {
      checkBtn.disabled = true; hintBtn.hidden = true; solveBtn.hidden = true; nextBtn.hidden = false; noteBtn.hidden = false;
      solveBtn.classList.remove('pulse');
      if (!stepsEl.children.length) { const more = SM.btn('See the worked solution', () => { showSteps(); more.remove(); }, 'btn-ghost btn-small'); feedback.appendChild(h('div', null, more)); }
      nextBtn.textContent = opts.count && results.length >= opts.count ? 'See summary' : 'Next problem';
      setTimeout(() => nextBtn.focus({ preventScroll: true }), 30);
    }
    function saveToNotebook() {
      const body = '## ' + skill.title + '\n' + pr.q + '\n\n' + pr.steps.map(s => (s.t ? s.t : '') + (s.m ? ' $' + s.m + '$' : '')).join('\n') + '\n\nAnswer: ' + SM.answerText(pr.ans);
      data.notebook.unshift({ id: SM.uid(), title: skill.title, body, updated: Date.now() }); SM.saveData(); SM.toast('Saved to your notebook.'); noteBtn.hidden = true;
    }
    function finish() {
      const ok = results.filter(r => r.ok).length, total = results.length;
      clear(card);
      const L0 = SM.ctx({ lv: [0, 4] }, lv, df);
      const weak = [...new Set(results.filter(r => !r.ok).map(r => r.skill))];
      card.appendChild(h('div', { class: 'summary' }, h('h2', null, 'Session complete'), h('p', { class: 'big-score' }, ok + ' / ' + total),
        h('ul', { class: 'sum-list' }, results.map(r => h('li', { class: r.ok ? 'ok' : 'miss' }, (r.ok ? '✓ ' : '• ') + SM.SKILL[r.skill].title + (r.hints ? ' (' + r.hints + ' hint' + (r.hints > 1 ? 's' : '') + ')' : '')))),
        weak.length ? h('p', null, 'Worth another look: ' + weak.map(id => SM.SKILL[id].title).join(', ') + '.') : h('p', null, 'Every problem correct.'),
        h('div', { class: 'row' }, SM.btn('Practise again', () => practice(root, opts), 'btn-primary'), SM.btn('Back to Learn', () => { location.hash = '#/learn'; }, ''))));
      const pct = total ? ok / total : 0;
      say(pct === 1 ? (L0.kid ? 'Every single one! Amazing work!' : 'A perfect session. Well done.') : pct >= 0.7 ? (L0.kid ? 'Great job! You got most of them!' : ok + ' out of ' + total + '. Strong work; the ones you missed are listed.') : (L0.kid ? 'Good effort! Let\'s practise the tricky ones again.' : ok + ' out of ' + total + '. Those skills will come up more often until they stick.'), pct >= 0.7 ? 'celebrating' : 'encouraging');
      if (opts.onDone) opts.onDone({ ok, total, results });
    }
    next();
    return { next, get problem() { return pr; } };
  }
  SM.practice = practice;
})();
