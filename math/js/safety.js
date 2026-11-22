/* Stark Math. Local safety checks: escaping, strict validation of stored and imported data,
   and the integrity checksum for backup files. Pure functions (no DOM), so the node tests can load it. */
(function () {
  'use strict';
  const SM = window.SM;
  const MAX_TEXT = 12000000, MAX_DEPTH = 14, MAX_NODES = 400000, MAX_STR = 400000;
  const BAD = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Returns '' when the value is plain JSON data (no prototype keys, bounded depth, size and string length), else a reason. */
  function deepIssue(v) {
    let nodes = 0, why = '';
    (function walk(x, d) {
      if (why) return;
      if (++nodes > MAX_NODES) { why = 'too large'; return; }
      if (d > MAX_DEPTH) { why = 'nested too deeply'; return; }
      if (typeof x === 'string') { if (x.length > MAX_STR) why = 'a text is too long'; return; }
      if (typeof x === 'number') { if (!isFinite(x)) why = 'a number is not valid'; return; }
      if (x === null || typeof x === 'boolean') return;
      if (Array.isArray(x)) { x.forEach(y => walk(y, d + 1)); return; }
      if (isObj(x)) { for (const k of Object.keys(x)) { if (BAD[k]) { why = 'it contains a reserved key'; return; } walk(x[k], d + 1); } return; }
      why = 'unsupported content';
    })(v, 0);
    return why;
  }

  const ID = /^[\w-]{1,40}$/;
  const APPKEYS = { mastery: 'o', history: 'a', notebook: 'a', stats: 'o', contests: 'a', seen: 'o', placement: 'o', fluency: 'o', sheets: 'a', wordsets: 'a' };
  const ok = (t, v) => (t === 'o' ? isObj(v) : Array.isArray(v));
  /** One app-data record. strict = refuse unknown keys (imports); loading from storage tolerates newer keys. */
  function appDataIssue(d, strict) {
    if (!isObj(d)) return 'learner data is not an object';
    for (const k of Object.keys(d)) {
      if (BAD[k]) return 'it contains a reserved key';
      if (APPKEYS[k]) { if (!ok(APPKEYS[k], d[k])) return 'learner data "' + k + '" has the wrong type'; } else if (strict) return 'unknown learner data "' + k.slice(0, 20) + '"';
    }
    if (d.history && d.history.length > 5000) return 'history is too long';
    if (d.notebook) {
      if (d.notebook.length > 2000) return 'too many notebook pages';
      for (const n of d.notebook) if (!isObj(n) || typeof n.body !== 'string' || (n.title !== undefined && typeof n.title !== 'string')) return 'a notebook page is not valid';
    }
    if (d.sheets) { if (d.sheets.length > 60) return 'too many saved worksheets'; for (const w of d.sheets) if (!isObj(w) || !Array.isArray(w.skills) || typeof w.code !== 'string') return 'a saved worksheet is not valid'; }
    if (d.wordsets) { if (d.wordsets.length > 100) return 'too many word problems'; for (const w of d.wordsets) if (!isObj(w) || typeof w.text !== 'string' || typeof w.formula !== 'string' || !isObj(w.vars)) return 'a word problem is not valid'; }
    if (d.fluency && Object.keys(d.fluency).some(k => !isObj(d.fluency[k]))) return 'fact fluency data is not valid';
    return deepIssue(d);
  }
  function profileIssue(p) {
    if (!isObj(p) || typeof p.id !== 'string' || !ID.test(p.id)) return 'a profile id is not valid';
    if (p.name !== undefined && (typeof p.name !== 'string' || p.name.length > 60)) return 'a profile name is not valid';
    if (p.color !== undefined && !(Number.isInteger(p.color) && p.color >= 0 && p.color < 100)) return 'a profile colour is not valid';
    if (p.created !== undefined && (typeof p.created !== 'string' || p.created.length > 40)) return 'a profile date is not valid';
    if (p.prefs !== undefined && !isObj(p.prefs)) return 'profile settings are not valid';
    return '';
  }
  /** The shared profile store kept in localStorage. */
  function storeIssue(s) {
    if (!isObj(s) || s.format !== 'stark-profiles') return 'not a profile store';
    if (!Array.isArray(s.profiles) || !s.profiles.length || s.profiles.length > 50) return 'profile list is not valid';
    if (s.shared !== undefined && !isObj(s.shared)) return 'shared settings are not valid';
    for (const p of s.profiles) { const e = profileIssue(p); if (e) return e; }
    return deepIssue(s);
  }

  const TOP = { format: 1, version: 1, app: 1, appVersion: 1, exported: 1, shared: 1, profiles: 1, checksum: 1 };
  const PKEYS = { id: 1, name: 1, color: 1, created: 1, prefs: 1, apps: 1 };
  /** Strict check of a parsed backup file. Returns '' when acceptable. */
  function backupIssue(o) {
    if (!isObj(o) || o.format !== 'stark-backup' || o.version !== 1 || !Array.isArray(o.profiles)) return 'This is not a Stark backup file.';
    for (const k of Object.keys(o)) if (!TOP[k]) return 'The backup has unknown content, so nothing was restored.';
    if (o.profiles.length < 1 || o.profiles.length > 50) return 'The backup has an unexpected number of learners, so nothing was restored.';
    if (o.shared !== undefined && !isObj(o.shared)) return 'The backup settings are not valid, so nothing was restored.';
    if (o.checksum !== undefined && !/^sha256:[0-9a-f]{64}$/.test(String(o.checksum))) return 'The backup checksum is not valid, so nothing was restored.';
    for (const p of o.profiles) {
      let e = profileIssue(p);
      if (!e) for (const k of Object.keys(p)) if (!PKEYS[k]) { e = 'a profile has unknown content'; break; }
      if (!e && p.apps !== undefined) {
        if (!isObj(p.apps)) e = 'profile data is not valid';
        else for (const a of Object.keys(p.apps)) { if (!ID.test(a)) { e = 'an app name is not valid'; break; } if (a === 'stark-math') { e = appDataIssue(p.apps[a], true); if (e) break; } else if (!isObj(p.apps[a])) { e = 'profile data is not valid'; break; } }
      }
      if (e) return 'The backup is not valid (' + e + '), so nothing was restored.';
    }
    const d = deepIssue(o);
    return d ? 'The backup is not valid (' + d + '), so nothing was restored.' : '';
  }
  const bodyOf = o => { const c = {}; Object.keys(o).forEach(k => { if (k !== 'checksum') c[k] = o[k]; }); return c; };
  const checksumOf = o => 'sha256:' + SM.sha256(SM.canon(bodyOf(o)));
  /** Adds the SHA-256 checksum of the canonical payload. */
  function seal(o) { o.checksum = checksumOf(o); return o; }
  /** Parse and check backup text. Returns { ok, obj, note } or { ok:false, error }. Writes nothing. */
  function openBackup(text) {
    if (typeof text !== 'string' || text.length > MAX_TEXT) return { ok: false, error: 'That file is too large to be a Stark backup, so nothing was restored.' };
    let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not valid JSON, so nothing was restored.' }; }
    const bad = backupIssue(o); if (bad) return { ok: false, error: bad };
    if (o.checksum === undefined) return { ok: true, obj: o, note: 'no checksum, validated' };
    if (o.checksum !== checksumOf(o)) return { ok: false, error: 'The backup checksum does not match: the file was changed or damaged, so nothing was restored.' };
    return { ok: true, obj: o, note: 'checksum verified' };
  }

  SM.safe = { esc, deepIssue, appDataIssue, profileIssue, storeIssue, backupIssue, checksumOf, seal, openBackup, MAX_TEXT };
})();
