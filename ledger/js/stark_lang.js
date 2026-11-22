/* Stark screen languages. Translates what the app draws, after it draws it: text nodes and the aria-label,
   placeholder and title attributes, by exact match and then by number template ("3 of 20" -> "{n} of {n}").
   Never touches typed values, user records or printouts (#print-root, #print-area, .printdoc, article.report),
   which stay in English (an app adds its own with data-skip on the script tag). Dictionaries are i18n/<code>.js, loaded from this folder only when chosen; a string
   with no translation stays in English. Shared file: the same in every Stark app that has i18n/. */
(function () {
  'use strict';
  var me = document.currentScript;
  var APP = (me && me.getAttribute('data-app')) || 'stark';
  var ANCHOR = (me && me.getAttribute('data-anchor')) || '';
  var KEY = APP + '-lang';
  var LANGS = [['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt-BR', 'Português (Brasil)'],
    ['it', 'Italiano'], ['pl', 'Polski'], ['ru', 'Русский'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['hi', 'हिन्दी'],
    ['id', 'Bahasa Indonesia'], ['vi', 'Tiếng Việt'], ['zh-Hans', '简体中文'], ['ja', '日本語'], ['ko', '한국어']];
  // An app may ship fewer languages than the shared list: data-langs="en,es" keeps only those in the picker, and data-builtin="es"
  // names languages the app translates with its own code (no i18n/<code>.js file is loaded, so no failed request and no dead choice).
  var ONLY = (me && me.getAttribute('data-langs')) ? me.getAttribute('data-langs').split(',') : null;
  var BUILTIN = (me && me.getAttribute('data-builtin')) ? me.getAttribute('data-builtin').split(',') : [];
  if (ONLY) LANGS = LANGS.filter(function (l) { return ONLY.indexOf(l[0]) >= 0; });
  var RTL = { ar: 1 };
  var SKIP = '#print-root, #print-area, .printdoc, article.report, script, style, textarea, [contenteditable], [data-i18n-skip]'
    + ((me && me.getAttribute('data-skip')) ? ', ' + me.getAttribute('data-skip') : '');   // per-app printouts and records
  var ATTRS = ['aria-label', 'placeholder', 'title'];
  var NUM = /\d+(?:[.,]\d+)*/g;
  var store = window.STARK_I18N = window.STARK_I18N || {};
  var lang = 'en', dict = null, tpl = null, obs = null, own = false;
  var origText = new WeakMap(), setText = new WeakMap(), origAttr = new WeakMap();

  function known(code) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === code) return code; return ''; }
  function pick() {
    var saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch (e) { /* storage off */ }
    if (known(saved)) return saved;
    var prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
    for (var i = 0; i < prefs.length; i++) {
      var p = String(prefs[i] || ''), base = p.split('-')[0].toLowerCase();
      if (known(p)) return p;
      if (base === 'zh') return 'zh-Hans';
      if (base === 'pt') return 'pt-BR';
      if (known(base)) return base;
    }
    return 'en';
  }

  function tr(s) {
    if (!dict) return null;
    var t = s.trim();
    if (!t || !/[A-Za-z]/.test(t)) return null;
    var out = Object.prototype.hasOwnProperty.call(dict, t) ? dict[t] : null;
    if (out === null && /\d/.test(t)) {
      var nums = t.match(NUM), k = t.replace(NUM, '{n}');
      if (Object.prototype.hasOwnProperty.call(tpl, k)) { var i = 0; out = tpl[k].replace(/\{n\}/g, function () { return nums[i++] || ''; }); }
    }
    if (out === null || out === '') return null;
    var lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    return lead + out + trail;
  }
  function skipped(el) { return !el || (el.closest && el.closest(SKIP)); }

  function doText(n) {
    if (skipped(n.parentElement)) return;
    if (setText.get(n) !== n.data) origText.set(n, n.data);            // new English from the app
    var en = origText.get(n); if (en === undefined) return;
    var next = lang === 'en' ? en : (tr(en) || en);
    if (n.data !== next) { setText.set(n, next); n.data = next; } else setText.set(n, next);
  }
  function doAttrs(el) {
    if (skipped(el)) return;
    var o = origAttr.get(el) || {};
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a); if (v === null) continue;
      if (o['set_' + a] !== v) o[a] = v;
      var next = lang === 'en' ? o[a] : (tr(o[a]) || o[a]);
      o['set_' + a] = next; if (v !== next) el.setAttribute(a, next);
    }
    origAttr.set(el, o);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    if (skipped(root)) return;
    doAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  var titleEn = '', titleSet = '';
  function doTitle() {
    if (document.title !== titleSet) titleEn = document.title;
    var next = lang === 'en' ? titleEn : (tr(titleEn) || titleEn.split(' - ').map(function (p) { return tr(p) || p; }).join(' - '));
    titleSet = next; if (document.title !== next) document.title = next;
  }

  function apply() {
    var html = document.documentElement;
    html.setAttribute('lang', lang); html.setAttribute('dir', RTL[lang] ? 'rtl' : 'ltr');
    if (!own) { walk(document.body); doTitle(); }   // own: the app translates itself, this file only keeps the page language and the picker
    var sel = document.getElementById('lang-pick');
    if (sel) { sel.value = lang; sel.setAttribute('aria-label', (dict && dict.Language) || 'Language'); }
  }
  function use(code) {
    lang = code; own = BUILTIN.indexOf(code) >= 0;
    if (code === 'en' || own) { var wasOwn = !own && code === 'en'; dict = tpl = null; apply(); if (wasOwn) walk(document.body); return; }
    var d = store[code];
    if (!d) {
      var s = document.createElement('script'); s.src = 'i18n/' + code + '.js';
      s.onload = function () { if (lang === code && store[code]) use(code); };
      s.onerror = function () { if (lang === code) { lang = 'en'; dict = tpl = null; apply(); } };
      document.head.appendChild(s); return;
    }
    dict = {}; tpl = {};
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) (k.indexOf('{n}') >= 0 ? tpl : dict)[k] = d[k];
    apply();
  }

  function picker() {
    var anchor = ANCHOR && document.querySelector(ANCHOR); if (!anchor || document.getElementById('lang-pick')) return;
    var sel = document.createElement('select');
    sel.id = 'lang-pick'; sel.className = 'lang-pick'; sel.setAttribute('data-i18n-skip', ''); sel.setAttribute('aria-label', 'Language');
    LANGS.forEach(function (l) { var o = document.createElement('option'); o.value = l[0]; o.textContent = l[1]; o.lang = l[0]; sel.appendChild(o); });
    sel.addEventListener('change', function () { try { localStorage.setItem(KEY, sel.value); } catch (e) { /* storage off */ } use(sel.value); });
    anchor.parentNode.insertBefore(sel, anchor);
  }

  function start() {
    picker();
    obs = new MutationObserver(function (recs) {
      if (own) return;
      if (lang === 'en' && !dict) { for (var j = 0; j < recs.length; j++) if (recs[j].target.nodeName === 'TITLE') titleEn = document.title; return; }
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === 'childList') { if (r.target.nodeName === 'TITLE') { doTitle(); continue; } for (var k = 0; k < r.addedNodes.length; k++) walk(r.addedNodes[k]); }
        else if (r.type === 'characterData') { if (r.target.parentNode && r.target.parentNode.nodeName === 'TITLE') doTitle(); else doText(r.target); }
        else if (r.type === 'attributes') doAttrs(r.target);
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    use(pick());
  }
  window.StarkI18n = { languages: LANGS.slice(), current: function () { return lang; }, use: function (c) { if (known(c)) { try { localStorage.setItem(KEY, c); } catch (e) { /* storage off */ } use(c); } }, tr: function (s) { return tr(String(s)) || String(s); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
