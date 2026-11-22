/* Stark Resonance: the local store. Saved experiments, the chosen level and which guided steps are done, kept in this browser only
   (localStorage), exported and imported as a plain JSON file. Imports are validated and clamped; nothing is ever sent anywhere. */
(function (root) {
  "use strict";
  var KEY = "stark-resonance-v1", MAX_SAVED = 200, MAX_BYTES = 1000000;
  var mem = null;   // fallback when storage is blocked

  function blank() { return { app: "stark-resonance", v: 1, level: "adult", saved: [], done: {} }; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function text(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, n).trim(); }

  // Clamp one sim's parameter object to its declared controls; drop anything unknown.
  function cleanParams(def, params) {
    var out = {}, i, c, v;
    params = params && typeof params === "object" ? params : {};
    for (i = 0; i < def.controls.length; i++) {
      c = def.controls[i]; if (c.type === "button") continue;
      v = params[c.id];
      if (c.type === "toggle") out[c.id] = typeof v === "boolean" ? v : c.val;
      else if (c.type === "select") out[c.id] = c.options.some(function (o) { return o[0] === v; }) ? v : c.val;
      else if (c.type === "text") out[c.id] = typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, c.max || 1000) : c.val;
      else out[c.id] = typeof v === "number" && isFinite(v) ? Math.max(c.min, Math.min(c.max, v)) : c.val;
    }
    return out;
  }
  function defaults(def) { var o = {}; def.controls.forEach(function (c) { if (c.type !== "button") o[c.id] = c.val; }); return o; }

  // Validate a whole state object (from storage or an import). sims = StarkSims.list.
  function sanitize(obj, sims) {
    var st = blank(), dropped = 0, seen = {};
    if (!obj || typeof obj !== "object" || obj.app !== "stark-resonance") return { ok: false, error: "This is not a Stark Resonance file.", state: st, dropped: 0 };
    if (obj.v !== 1) return { ok: false, error: "This file comes from a newer version.", state: st, dropped: 0 };
    st.level = obj.level === "teen" ? "teen" : "adult";
    (Array.isArray(obj.saved) ? obj.saved : []).slice(0, MAX_SAVED).forEach(function (e) {
      var def = e && sims.filter(function (s) { return s.id === e.sim; })[0];
      if (!def) { dropped++; return; }
      var id = typeof e.id === "string" && /^[a-z0-9]{4,24}$/.test(e.id) && !seen[e.id] ? e.id : uid(); seen[id] = 1;
      st.saved.push({ id: id, sim: def.id, name: text(e.name, 60) || def.title, note: text(e.note, 400), ts: typeof e.ts === "number" && isFinite(e.ts) ? e.ts : Date.now(), params: cleanParams(def, e.params) });
    });
    if (obj.done && typeof obj.done === "object") sims.forEach(function (s) {
      var a = obj.done[s.id]; if (Array.isArray(a)) st.done[s.id] = a.filter(function (n, i) { return Number.isInteger(n) && n >= 0 && n < s.experiment.length && a.indexOf(n) === i; });
    });
    return { ok: true, state: st, dropped: dropped };
  }
  function parse(json, sims) {
    if (typeof json !== "string" || json.length > MAX_BYTES) return { ok: false, error: "The file is too large or empty.", state: blank(), dropped: 0 };
    var obj; try { obj = JSON.parse(json); } catch (e) { return { ok: false, error: "The file is not valid JSON.", state: blank(), dropped: 0 }; }
    return sanitize(obj, sims);
  }
  function serialize(st) { return JSON.stringify(st, null, 1); }

  function load(sims) {
    var raw = null; try { raw = root.localStorage && root.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (raw == null && mem) raw = mem;
    if (!raw) return blank();
    var r = parse(raw, sims); return r.ok ? r.state : blank();
  }
  function save(st) {
    var s = serialize(st); mem = s;
    try { if (root.localStorage) root.localStorage.setItem(KEY, s); return true; } catch (e) { return false; }
  }
  function add(st, def, name, note, params, limit) {
    if (limit != null && st.saved.length >= limit) return { ok: false, full: true };
    var e = { id: uid(), sim: def.id, name: text(name, 60) || def.title, note: text(note, 400), ts: Date.now(), params: cleanParams(def, params) };
    st.saved.unshift(e); if (st.saved.length > MAX_SAVED) st.saved.pop(); return { ok: true, entry: e };
  }
  function remove(st, id) { st.saved = st.saved.filter(function (e) { return e.id !== id; }); }
  function toggleDone(st, simId, n, on) {
    var a = st.done[simId] || []; a = a.filter(function (x) { return x !== n; }); if (on) a.push(n); st.done[simId] = a.sort();
  }

  var api = { KEY: KEY, MAX_SAVED: MAX_SAVED, blank: blank, defaults: defaults, cleanParams: cleanParams, sanitize: sanitize, parse: parse, serialize: serialize, load: load, save: save, add: add, remove: remove, toggleDone: toggleDone };
  root.StarkStore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
