/* Stark IntraTheater. Family learning logic with no DOM, shared by the app and the node tests:
   Family Trivia Night, museum exhibits, Story Studio writing checks, and the kids' limits (parental controls). */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const SIT = G.SIT = G.SIT || {};
  const APP = 'stark-intratheater';
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const str = (v, max) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max).trim();
  const shuffleR = (a, rng) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ================= Family Trivia Night ================= */
  const CATS = { history: 'History', geography: 'Geography', science: 'Science', arts: 'Art and Music' };
  /* capital questions built from the country list (kids: famous countries, 3 choices; grown-ups: same-continent neighbours, 4 choices) */
  function capitalQuestions(countries, level, n, rng) {
    const kid = level === 'kid';
    const pool = countries.filter(c => !c.multi && (!kid || c.kid));
    return shuffleR(pool, rng).slice(0, n).map(c => {
      const near = kid ? pool : countries.filter(o => o.continent === c.continent && !o.multi);
      const others = shuffleR(near.filter(o => o !== c), rng).slice(0, kid ? 2 : 3);
      return { id: 'cap-' + c.iso2, q: 'What is the capital of ' + c.name + '?', choices: [c.capital].concat(others.map(o => o.capital)), answer: c.capital, note: c.note || c.capital + ' is in ' + c.continent + '.' };
    });
  }
  /* setup: {players: [{name, level, avatar}], rounds, cats}; banks: {cat: {kid: [q], grown: [q]}}.
     Every player gets one question per round at their own level; the last round counts double. */
  function triviaNew(setup, banks, rng) {
    const players = (setup.players || []).map((p, i) => ({ name: str(p.name, 20) || 'Player ' + (i + 1), level: p.level === 'grown' ? 'grown' : 'kid', avatar: str(p.avatar, 8), score: 0, right: 0, streak: 0, best: 0 })).slice(0, 8);
    if (players.length < 2) throw new Error('players');
    const rounds = Math.max(1, Math.min(10, Math.round(+setup.rounds || 3)));
    const cats = (setup.cats || []).filter(c => CATS[c] && banks[c] && banks[c].kid && banks[c].kid.length && banks[c].grown && banks[c].grown.length);
    if (!cats.length) throw new Error('cats');
    const used = {}, turns = [];
    for (let r = 0; r < rounds; r++) {
      players.forEach((p, pi) => {
        const cat = cats[(r + pi) % cats.length], key = cat + '/' + p.level;
        used[key] = used[key] || [];
        let pool = banks[cat][p.level].filter(q => used[key].indexOf(q.id || q.q) < 0);
        if (!pool.length) { used[key] = []; pool = banks[cat][p.level]; }
        const q = pool[Math.floor(rng() * pool.length)];
        used[key].push(q.id || q.q);
        turns.push({ p: pi, round: r, cat, double: rounds > 1 && r === rounds - 1, q: { q: q.q, choices: shuffleR(q.choices, rng), answer: q.answer, note: q.note || '' }, chosen: null, right: null });
      });
    }
    return { players, rounds, cats, turns, i: 0, done: false };
  }
  const triviaCurrent = g => (g.done ? null : g.turns[g.i]);
  /* records the current player's answer: 1 point (2 in the final round) when right */
  function triviaAnswer(g, choice) {
    const t = triviaCurrent(g);
    if (!t || t.chosen !== null) return null;
    const p = g.players[t.p];
    t.chosen = choice; t.right = choice === t.q.answer;
    const points = t.right ? (t.double ? 2 : 1) : 0;
    p.score += points;
    if (t.right) { p.right++; p.streak++; p.best = Math.max(p.best, p.streak); } else p.streak = 0;
    return { right: t.right, points, answer: t.q.answer, note: t.q.note };
  }
  function triviaNext(g) {
    const t = triviaCurrent(g);
    if (!t || t.chosen === null) return false;
    g.i++;
    if (g.i >= g.turns.length) g.done = true;
    return true;
  }
  /* competition ranking: equal scores share a place (1, 1, 3) */
  function triviaStandings(g) {
    const list = g.players.map((p, i) => ({ i, name: p.name, avatar: p.avatar, level: p.level, score: p.score, right: p.right, best: p.best }))
      .sort((a, b) => b.score - a.score || a.i - b.i);
    list.forEach((x, k) => { x.rank = k && list[k - 1].score === x.score ? list[k - 1].rank : k + 1; });
    return list;
  }

  /* ================= Museum exhibits ================= */
  const THEMES = ['gold', 'sea', 'forest', 'plum', 'stone'];
  const KINDS = ['event', 'country', 'source', 'art', 'note'];
  const MAX_ITEMS = 24;
  /* an exhibit card from the app's own data (D: SIT_DATA). Returns null for an unknown reference. */
  function exhibitItem(kind, ref, D, id) {
    const base = { id: id || kind + '-' + ref, kind, ref: String(ref), caption: '', why: '' };
    if (kind === 'event') { const e = (D.events || []).find(x => x.id === ref); return e ? Object.assign(base, { icon: e.icon, title: e.title, date: e.date, fact: e.kid }) : null; }
    if (kind === 'country') { const c = (D.countries || []).find(x => x.iso2 === ref); return c ? Object.assign(base, { icon: '🌍', title: c.name, date: '', fact: 'Capital: ' + c.capital + '. Continent: ' + c.continent + '.' + (c.note ? ' ' + c.note : '') }) : null; }
    if (kind === 'source') { const s = (D.sources || []).find(x => x.id === ref); return s ? Object.assign(base, { icon: '📜', title: s.title, date: s.date, fact: s.author + '. ' + s.kidContext }) : null; }
    if (kind === 'art') { const a = (D.arts || []).find(x => x.id === ref); return a ? Object.assign(base, { icon: '🎨', title: a.title, date: a.date, fact: a.by + '. ' + a.kid }) : null; }
    if (kind === 'note') return Object.assign(base, { ref: '', icon: '⭐', title: 'My own card', date: '', fact: '' });
    return null;
  }
  function newExhibit(id) { return { id: id || 'x1', title: 'My museum', subtitle: '', curator: '', theme: 'gold', items: [], updated: 0 }; }
  /* strict copy: only known fields, clipped strings, whitelisted kinds and themes, at most 24 cards. null when it is not an exhibit. */
  function sanitizeExhibit(o) {
    if (!isObj(o) || !Array.isArray(o.items)) return null;
    const ex = {
      id: /^[A-Za-z0-9_-]{1,40}$/.test(o.id) ? o.id : 'x' + Math.abs(hash(JSON.stringify(o.title || ''))).toString(36),
      title: str(o.title, 80) || 'My museum', subtitle: str(o.subtitle, 160), curator: str(o.curator, 40),
      theme: THEMES.indexOf(o.theme) >= 0 ? o.theme : 'gold', items: [], updated: isFinite(o.updated) ? +o.updated : 0
    };
    const seen = {};
    o.items.forEach(it => {
      if (!isObj(it) || KINDS.indexOf(it.kind) < 0 || ex.items.length >= MAX_ITEMS) return;
      let id = /^[A-Za-z0-9_-]{1,60}$/.test(it.id) ? it.id : it.kind + '-' + ex.items.length;
      while (seen[id]) id += '_';
      seen[id] = 1;
      ex.items.push({ id, kind: it.kind, ref: str(it.ref, 40), icon: str(it.icon, 8) || '⭐', title: str(it.title, 100) || 'Untitled', date: str(it.date, 80), fact: str(it.fact, 700), caption: str(it.caption, 500), why: str(it.why, 300) });
    });
    return ex;
  }
  function hash(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x | 0; }
  const exhibitFile = ex => ({ app: APP, kind: 'exhibit', version: 1, exhibit: sanitizeExhibit(ex) });
  function readExhibitFile(text) {
    let o;
    if (typeof text !== 'string' || text.length > 512 * 1024) return { ok: false, error: 'That file is too big to be a museum exhibit.' };
    try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not a Stark IntraTheater exhibit.' }; }
    if (!isObj(o) || o.app !== APP || o.kind !== 'exhibit') return { ok: false, error: 'That file is not a Stark IntraTheater exhibit.' };
    const ex = sanitizeExhibit(o.exhibit);
    return ex ? { ok: true, exhibit: ex } : { ok: false, error: 'That exhibit file is damaged. Nothing was changed.' };
  }
  const THEME_CSS = { gold: ['#1d1510', '#f5e9d6', '#ecb950'], sea: ['#0f1c24', '#e6f2f5', '#5fc2d6'], forest: ['#121c14', '#e8f1e3', '#8cc47a'], plum: ['#1c1220', '#f3e8f5', '#c98ee0'], stone: ['#1a1a1c', '#ececec', '#b9b9c2'] };
  /* a standalone web page for the exhibit: escaped text, no scripts, no links out, prints well */
  function exhibitHTML(o) {
    const ex = sanitizeExhibit(o) || newExhibit();
    const c = THEME_CSS[ex.theme];
    const cards = ex.items.map((it, i) => '<article class="card"><p class="n">Exhibit ' + (i + 1) + '</p><h2><span aria-hidden="true">' + esc(it.icon) + '</span> ' + esc(it.title) + '</h2>' +
      (it.date ? '<p class="date">' + esc(it.date) + '</p>' : '') + (it.fact ? '<p>' + esc(it.fact) + '</p>' : '') +
      (it.caption ? '<p class="cap">' + esc(it.caption) + '</p>' : '') + (it.why ? '<p class="why"><strong>Why it is here:</strong> ' + esc(it.why) + '</p>' : '') + '</article>').join('\n');
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">' +
      '<title>' + esc(ex.title) + '</title><style>body{margin:0;background:' + c[0] + ';color:' + c[1] + ';font:17px/1.55 Georgia,serif;padding:2rem 1rem}' +
      'main{max-width:900px;margin:0 auto}h1{color:' + c[2] + ';font-size:2.2rem;margin:.2rem 0}.sub{opacity:.85}.card{border:2px solid ' + c[2] + ';border-radius:14px;padding:1rem 1.2rem;margin:1.2rem 0;break-inside:avoid}' +
      '.n{text-transform:uppercase;letter-spacing:.12em;font-size:.75rem;opacity:.75;margin:0}.date{font-style:italic;opacity:.85}.cap{font-size:1.1rem}.why{opacity:.9}footer{opacity:.7;font-size:.85rem;margin-top:2rem}' +
      '@media print{body{background:#fff;color:#000}.card{border-color:#777}h1{color:#000}}</style></head><body><main>' +
      '<p class="n">A museum exhibit</p><h1>' + esc(ex.title) + '</h1>' + (ex.subtitle ? '<p class="sub">' + esc(ex.subtitle) + '</p>' : '') +
      (ex.curator ? '<p>Curated by ' + esc(ex.curator) + '</p>' : '') + '\n' + cards +
      '\n<footer>Made with Stark IntraTheater. ' + ex.items.length + ' exhibit card' + (ex.items.length === 1 ? '' : 's') + '.</footer></main></body></html>\n';
  }

  /* ================= Story Studio ================= */
  const STOP = new Set('a an and the of to in on at for with is was were be been it its he she they them his her their i me my we our you your that this then than so but or as by from had has have not no yes up down out into over just very there here what when who how all one two said'.split(' '));
  const words = t => (String(t || '').toLowerCase().match(/[a-z\u00c0-\u024f]+(?:['’][a-z]+)?/g) || []);
  /* counts and gentle checks: long sentences, words used a lot, how often "said" appears */
  function writingStats(text) {
    const t = String(text || '');
    const w = words(t);
    const sentences = (t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”’']?|[^.!?]+$/g) || []).map(s => s.trim()).filter(s => /[A-Za-z]/.test(s));
    const lens = sentences.map(s => words(s).length);
    const counts = {};
    w.forEach(x => { if (!STOP.has(x) && x.length > 2) counts[x] = (counts[x] || 0) + 1; });
    const limit = Math.max(3, Math.ceil(w.length / 60));
    const repeats = Object.keys(counts).filter(k => counts[k] >= limit).sort((a, b) => counts[b] - counts[a] || (a < b ? -1 : 1)).slice(0, 5).map(k => [k, counts[k]]);
    return {
      words: w.length, sentences: sentences.length, paragraphs: t.split(/\n\s*\n/).filter(p => p.trim()).length,
      avg: sentences.length ? Math.round(10 * w.length / sentences.length) / 10 : 0,
      long: lens.filter(n => n > 25).length, repeats, said: w.filter(x => x === 'said').length,
      readMin: Math.max(1, Math.round(w.length / 180)), dialogue: (t.match(/["“”]/g) || []).length >= 2
    };
  }
  const PLAN_KEYS = ['opening', 'buildup', 'problem', 'resolution', 'ending'];
  function newStory(id) { return { id: id || 's1', title: 'My story', prompt: '', genre: '', target: 300, plan: { opening: '', buildup: '', problem: '', resolution: '', ending: '' }, text: '', checks: [], updated: 0 }; }
  function sanitizeStory(o) {
    if (!isObj(o)) return null;
    const s = newStory(/^[A-Za-z0-9_-]{1,40}$/.test(o.id) ? o.id : undefined);
    s.title = str(o.title, 80) || 'My story'; s.prompt = str(o.prompt, 400); s.genre = str(o.genre, 30);
    s.target = Math.max(50, Math.min(5000, Math.round(+o.target || 300)));
    if (isObj(o.plan)) PLAN_KEYS.forEach(k => { s.plan[k] = str(o.plan[k], 1200); });
    s.text = str(o.text, 30000);
    s.checks = Array.isArray(o.checks) ? o.checks.filter(x => typeof x === 'string' && x.length <= 40).slice(0, 20) : [];
    s.updated = isFinite(o.updated) ? +o.updated : 0;
    return s;
  }
  function storyPlainText(o) {
    const s = sanitizeStory(o) || newStory();
    return s.title + '\n\n' + (s.prompt ? 'Prompt: ' + s.prompt + '\n\n' : '') + s.text + '\n\n(' + writingStats(s.text).words + ' words. Written in Stark IntraTheater.)\n';
  }
  /* a printable little book: title page then the story, paragraphs kept */
  function storyBookHTML(o, author) {
    const s = sanitizeStory(o) || newStory();
    const paras = s.text.split(/\n\s*\n|\n/).filter(p => p.trim()).map(p => '<p>' + esc(p.trim()) + '</p>').join('\n');
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">' +
      '<title>' + esc(s.title) + '</title><style>body{margin:0;background:#fffaf2;color:#2a1c14;font:19px/1.7 Georgia,serif;padding:2rem 1rem}main{max-width:720px;margin:0 auto}' +
      '.cover{text-align:center;padding:4rem 0 3rem;border-bottom:2px solid #d99a2b;margin-bottom:2rem;break-after:page}h1{font-size:2.6rem;margin:.3rem 0}.by{font-style:italic}footer{opacity:.65;font-size:.8rem;margin-top:3rem;text-align:center}</style></head><body><main>' +
      '<section class="cover"><h1>' + esc(s.title) + '</h1>' + (author ? '<p class="by">by ' + esc(str(author, 40)) + '</p>' : '') + '</section>\n' + paras +
      '\n<footer>' + writingStats(s.text).words + ' words. Written in Stark IntraTheater.</footer></main></body></html>\n';
  }
  function pickPrompt(prompts, f, rng, avoidId) {
    let pool = prompts.filter(p => (!f.genre || f.genre === 'any' || p.genre === f.genre) && (!f.level || p.level === f.level));
    if (pool.length > 1) pool = pool.filter(p => p.id !== avoidId);
    return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
  }

  /* ================= Kids' limits (parental controls) ================= */
  /* sections a grown-up can open or close for kids; sub-pages count as their section */
  const SECTIONS = [['theater', 'Theater'], ['studio', 'Movie Studio'], ['history', 'History'], ['geo', 'Geography'], ['explore', 'Explorers (science, art, math, languages)'],
    ['kids', 'Kids Zone'], ['lessons', 'Lessons'], ['family', 'Family (trivia, museum, Story Studio)']];
  const SECTION_OF = { science: 'explore', arts: 'explore', math: 'explore', lang: 'explore', trivia: 'family', museum: 'family', write: 'family', anywhere: 'theater' };
  const ALWAYS = { home: 1, rest: 1 };
  const sectionOf = view => SECTION_OF[view] || view;
  const pad = n => (n < 10 ? '0' : '') + n;
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hhmm = s => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : -1; };
  function defaultControls() { return { blocked: [], dailyMin: 0, quietFrom: '', quietTo: '' }; }
  function sanitizeControls(c) {
    const o = defaultControls();
    if (!isObj(c)) return o;
    const ids = SECTIONS.map(s => s[0]);
    if (Array.isArray(c.blocked)) o.blocked = ids.filter(id => c.blocked.indexOf(id) >= 0);
    o.dailyMin = Math.max(0, Math.min(600, Math.round(+c.dailyMin || 0)));
    if (hhmm(c.quietFrom) >= 0 && hhmm(c.quietTo) >= 0 && c.quietFrom !== c.quietTo) { o.quietFrom = c.quietFrom; o.quietTo = c.quietTo; }
    return o;
  }
  /* quiet hours may cross midnight (20:00 to 07:00) */
  function inQuiet(c, date) {
    const a = hhmm(c.quietFrom), b = hhmm(c.quietTo);
    if (a < 0 || b < 0 || a === b) return false;
    const t = date.getHours() * 60 + date.getMinutes();
    return a < b ? t >= a && t < b : t >= a || t < b;
  }
  const usedOn = (usage, kidId, key) => (((usage || {}).days || {})[key] || {})[kidId] || 0;
  const bonusOn = (usage, kidId, key) => (((usage || {}).bonus || {})[key] || {})[kidId] || 0;
  /* may a child open this view now? {ok, reason: 'section' | 'quiet' | 'time', section, left (minutes, or null for no limit)} */
  function kidGate(controls, view, usage, kidId, date) {
    const c = sanitizeControls(controls), key = dayKey(date);
    const allowance = c.dailyMin ? c.dailyMin + bonusOn(usage, kidId, key) : 0;
    const left = c.dailyMin ? Math.max(0, Math.round(10 * (allowance - usedOn(usage, kidId, key))) / 10) : null;
    if (ALWAYS[view]) return { ok: true, left, section: view };
    const section = sectionOf(view);
    if (c.blocked.indexOf(section) >= 0) return { ok: false, reason: 'section', section, left };
    if (inQuiet(c, date)) return { ok: false, reason: 'quiet', section, left, until: c.quietTo };
    if (c.dailyMin && left <= 0) return { ok: false, reason: 'time', section, left: 0 };
    return { ok: true, left, section };
  }
  /* adds minutes of use; keeps 35 days */
  function addUsage(usage, kidId, date, minutes) {
    const u = isObj(usage) ? usage : {};
    u.days = isObj(u.days) ? u.days : {}; u.bonus = isObj(u.bonus) ? u.bonus : {};
    const key = dayKey(date);
    u.days[key] = isObj(u.days[key]) ? u.days[key] : {};
    u.days[key][kidId] = Math.round(10 * ((+u.days[key][kidId] || 0) + minutes)) / 10;
    const cutoff = dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 35));
    Object.keys(u.days).forEach(k => { if (k < cutoff) delete u.days[k]; });
    Object.keys(u.bonus).forEach(k => { if (k < key) delete u.bonus[k]; });
    return u;
  }
  function addBonus(usage, kidId, date, minutes) {
    const u = isObj(usage) ? usage : {};
    u.days = isObj(u.days) ? u.days : {}; u.bonus = isObj(u.bonus) ? u.bonus : {};
    const key = dayKey(date);
    u.bonus[key] = isObj(u.bonus[key]) ? u.bonus[key] : {};
    u.bonus[key][kidId] = Math.min(600, (+u.bonus[key][kidId] || 0) + minutes);
    return u;
  }
  /* the last 7 days, oldest first: [{key, label, min}] */
  function weekMinutes(usage, kidId, date) {
    const out = [], names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - i), key = dayKey(d);
      out.push({ key, label: i === 0 ? 'Today' : names[d.getDay()], min: usedOn(usage, kidId, key) });
    }
    return out;
  }

  SIT.familyLib = { CATS, capitalQuestions, triviaNew, triviaCurrent, triviaAnswer, triviaNext, triviaStandings,
    THEMES, KINDS, MAX_ITEMS, exhibitItem, newExhibit, sanitizeExhibit, exhibitFile, readExhibitFile, exhibitHTML, esc,
    writingStats, PLAN_KEYS, newStory, sanitizeStory, storyPlainText, storyBookHTML, pickPrompt,
    SECTIONS, sectionOf, dayKey, hhmm, defaultControls, sanitizeControls, inQuiet, kidGate, addUsage, addBonus, weekMinutes, usedOn };
})();
