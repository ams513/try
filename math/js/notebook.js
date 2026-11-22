/* Stark Math. The notebook: write notes with maths in them and see them typeset as you type.
   Syntax: $...$ for maths inside a sentence; a line starting with = is a maths line; end a maths line with "= ?" and the
   notebook works out the exact value; # starts a heading. */
(function () {
  'use strict';
  const SM = window.SM;
  const { h, clear, btn } = SM;

  /** Evaluate "expr = ?" exactly when possible, otherwise to 10 significant figures. */
  function evaluate(expr) {
    try { const ast = SM.parse(expr); try { const v = SM.evalNum(ast); return v.isRational() ? (v.c.isInt() ? v.c.toString() : v.c.toString() + (v.c.toDecimal() ? ' = ' + v.c.toDecimal() : ' ≈ ' + SM.fmtNum(v.toFloat(), 8))) : v.toString() + ' ≈ ' + SM.fmtNum(v.toFloat(), 8); } catch (e) { const f = SM.evalF(ast, {}); return isFinite(f) ? '≈ ' + SM.fmtNum(f, 10) : null; } } catch (e) { return null; }
  }
  SM.nbEvaluate = evaluate;
  function renderNote(text) {
    return String(text).split('\n').map(line => {
      const t = line.trim();
      if (!t) return '<div class="nb-gap"></div>';
      if (t[0] === '#') return '<h3 class="nb-h">' + SM.renderText(t.replace(/^#+\s*/, '')) + '</h3>';
      if (t[0] === '=') {
        let m = t.slice(1).trim(), mm;
        if ((mm = /^(.*?)=\s*\?$/.exec(m))) { const r = evaluate(mm[1]); return '<div class="nb-math math">' + SM.renderMath(mm[1]) + '<span class="mo mrel">=</span>' + (r ? '<span class="nb-result">' + SM.renderMath(r.replace(/^≈ /, '')).replace(/^/, r.startsWith('≈') ? '<span class="mo">≈</span>' : '') + '</span>' : '<span class="muted"> (could not evaluate)</span>') + '</div>'; }
        return '<div class="nb-math math">' + SM.renderMath(m) + '</div>';
      }
      return '<p class="nb-p">' + SM.renderText(t.replace(/\$([^$]*?)=\s*\?\$/g, (x, e) => { const r = evaluate(e); return '$' + e + ' = ' + (r ? r.replace(/^≈ /, '') : '?') + '$'; })) + '</p>';
    }).join('');
  }
  SM.renderNote = renderNote;

  SM.views.notebook = function (main) {
    const data = SM.data();
    if (!data.notebook.length) data.notebook.push({ id: SM.uid(), title: 'Getting started', updated: Date.now(), body: '# My first page\nType maths between dollar signs, like $3/4 + 1/6$ or $x^2 - 5x + 6 = 0$.\n\nStart a line with = for a maths line:\n= sqrt(72) = 6sqrt(2)\n\nEnd a maths line with "= ?" and the notebook works it out exactly:\n= 3/4 + 1/6 = ?\n= (2/3)^3 - 1/9 = ?\n= sqrt(2) * sqrt(18) = ?' });
    let cur = data.notebook[0];
    const list = h('ul', { class: 'nb-list', 'aria-label': 'Pages' });
    const title = h('input', { class: 'nb-title', 'aria-label': 'Page title', maxlength: 80 });
    const ta = h('textarea', { class: 'nb-text', 'aria-label': 'Page text', spellcheck: 'true' });
    const view = h('div', { class: 'nb-view', 'aria-live': 'polite' });
    let saveT = 0;
    function drawList() {
      clear(list);
      data.notebook.forEach(n => list.appendChild(h('li', null, h('button', { type: 'button', class: 'nb-item' + (n === cur ? ' on' : ''), 'aria-current': n === cur ? 'true' : null, onclick: () => { cur = n; load(); drawList(); } }, n.title || 'Untitled', h('small', null, new Date(n.updated).toLocaleDateString())))));
    }
    function load() { title.value = cur.title; ta.value = cur.body; view.innerHTML = renderNote(cur.body); }
    function changed() { cur.title = title.value; cur.body = ta.value; cur.updated = Date.now(); view.innerHTML = renderNote(cur.body); clearTimeout(saveT); saveT = setTimeout(() => { SM.saveData(); drawList(); }, 400); }
    title.addEventListener('input', changed); ta.addEventListener('input', changed);
    const tools = h('div', { class: 'row wrap' },
      btn('New page', () => { if (!SM.edition.canAddNote(data.notebook.length)) { SM.trialLimitHit(); return; } cur = { id: SM.uid(), title: 'New page', body: '', updated: Date.now() }; data.notebook.unshift(cur); SM.saveData(); load(); drawList(); title.focus(); title.select(); }, 'btn-small btn-primary'),
      btn('Insert fraction', () => ins('$a/b$'), 'btn-small btn-ghost'), btn('Insert power', () => ins('$x^2$'), 'btn-small btn-ghost'), btn('Insert root', () => ins('$sqrt(x)$'), 'btn-small btn-ghost'), btn('Insert calculation', () => ins('\n= 1/2 + 1/3 = ?\n'), 'btn-small btn-ghost'),
      btn('Download page', () => SM.download((cur.title || 'page').replace(/[^\w -]/g, '') + '.txt', cur.title + '\n\n' + cur.body), 'btn-small btn-ghost'),
      btn('Delete page', e => { const b = e.target; if (b.dataset.sure) { data.notebook = data.notebook.filter(n => n !== cur); if (!data.notebook.length) data.notebook.push({ id: SM.uid(), title: 'New page', body: '', updated: Date.now() }); cur = data.notebook[0]; SM.data().notebook = data.notebook; SM.saveData(); load(); drawList(); b.textContent = 'Delete page'; delete b.dataset.sure; } else { b.dataset.sure = '1'; b.textContent = 'Press again to delete'; setTimeout(() => { b.textContent = 'Delete page'; delete b.dataset.sure; }, 3000); } }, 'btn-small btn-ghost'));
    function ins(s) { const a = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, a) + s + ta.value.slice(ta.selectionEnd || a); ta.focus(); ta.setSelectionRange(a + s.length, a + s.length); changed(); }
    main.append(h('div', { class: 'page-head' }, h('h1', null, 'Notebook'), h('p', { class: 'muted' }, 'Your pages stay on this device. Maths between $ signs is typeset as you type.')),
      h('div', { class: 'notebook' }, h('nav', { class: 'nb-side', 'aria-label': 'Notebook pages' }, list), h('div', { class: 'nb-main' }, tools, title, h('div', { class: 'nb-split' }, h('div', null, h('label', { class: 'sr-only' }, 'Page text'), ta), view))));
    load(); drawList();
    main._cleanup = () => { clearTimeout(saveT); SM.saveData(); };
  };
})();
