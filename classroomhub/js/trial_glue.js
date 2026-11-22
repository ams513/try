/* Stark Classroom Hub free trial glue. Trial package only. Loads before teachlib.js: the parent-notes and import/export screens
   become stub cards, and the three hooks the kept data code calls keep a saved parent-notes section intact (stored as is, never read here)
   so a class restored from the full version and backed up again loses nothing. */
(function () {
  'use strict';
  var SCH = window.SCH = window.SCH || {}, T = window.StarkTrial;
  var isObj = function (o) { return !!o && typeof o === 'object' && !Array.isArray(o); };
  SCH.notes = {
    emptyPn: function () { return {}; },
    sanitize: function (o, s) { s.pn = isObj(o && o.pn) ? o.pn : {}; return s; },
    removeStudent: function () {}
  };
  function page(h, title, id) { return function () { var b = h('div'); b.append(h('h1', null, title), T.card(id)); return b; }; }
  SCH.noteViews = function (X) {
    var v = page(X.h, 'Parent notes', 'parent_notes');
    return { write: v, batch: v, lang: v, log: v };
  };
  SCH.transferViews = function (X) {
    var h = X.h;
    return {
      transfer: page(h, 'Import and export', 'import_export'),
      help: page(h, 'Data files', 'import_export'),
      rosterCard: function () {
        return h('div', { class: 'card' }, h('h2', null, 'Class list in a file?'), h('p', { class: 'muted' }, 'Importing a roster from a CSV file is in the full version.'), h('a', { href: '#/transfer' }, 'See what it does'));
      }
    };
  };
})();
