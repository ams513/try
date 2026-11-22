/* Stark Career local protections: safe JSON parsing, backup checksum, strict backup validation. No network, no tracking. */
var SC = window.SC || (window.SC = {});
(function () {
  "use strict";
  function isBad(k) { return k === "__proto__" || k === "constructor" || k === "prototype"; }
  var ID_RE = /^[A-Za-z0-9_-]{1,64}$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var MAX_TEXT = 8000000, MAX_STR = 500000, MAX_ARR = 10000, MAX_NODES = 300000, MAX_DEPTH = 14;

  /* SHA-256 of a string (UTF-8), hex. Synchronous so it works everywhere and in the node tests. */
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(s) {
    var out = [], i, c, d;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length && (d = s.charCodeAt(i + 1)) >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
  SC.sha256 = function (str) {
    var b = utf8(String(str)), l = b.length, h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64), i, j;
    b.push(0x80); while (b.length % 64 !== 56) b.push(0);
    var hi = Math.floor(l / 0x20000000), lo = (l << 3) >>> 0;
    b.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    for (i = 0; i < b.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = (b[i + 4 * j] << 24) | (b[i + 4 * j + 1] << 16) | (b[i + 4 * j + 2] << 8) | b[i + 4 * j + 3];
      for (j = 16; j < 64; j++) { var s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10); w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0; }
      var a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (j = 0; j < 64; j++) {
        var t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[j] + w[j]) | 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + bb) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    return h.map(function (x) { return ("00000000" + (x >>> 0).toString(16)).slice(-8); }).join("");
  };

  /* Canonical JSON: sorted keys, so the checksum does not depend on key order. */
  SC.canon = function canon(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(function (x) { return x === undefined ? "null" : canon(x); }).join(",") + "]";
    return "{" + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ":" + canon(v[k]); }).join(",") + "}";
  };

  /* JSON.parse that silently drops __proto__ / constructor / prototype keys at any depth. */
  SC.parseSafe = function (text) { return JSON.parse(text, function (k, v) { return isBad(k) ? undefined : v; }); };

  /* Strict structural walk: reports the first problem, or null. Rejects dangerous keys instead of dropping them. */
  function walk(v, depth, ctr) {
    if (++ctr.n > MAX_NODES) return "the file is too large";
    if (depth > MAX_DEPTH) return "the data is nested too deeply";
    if (typeof v === "string") return v.length > MAX_STR ? "a text field is too long" : null;
    if (v === null || typeof v === "boolean") return null;
    if (typeof v === "number") return isFinite(v) ? null : "a number is not valid";
    if (Array.isArray(v)) {
      if (v.length > MAX_ARR) return "a list is too long";
      for (var i = 0; i < v.length; i++) { var r = walk(v[i], depth + 1, ctr); if (r) return r; }
      return null;
    }
    if (typeof v !== "object") return "unexpected data type";
    var ks = Object.keys(v);
    for (var j = 0; j < ks.length; j++) {
      if (isBad(ks[j])) return "it contains a forbidden key";
      var r2 = walk(v[ks[j]], depth + 1, ctr); if (r2) return r2;
    }
    return null;
  }
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function okDate(x) { return x == null || x === "" || (typeof x === "string" && DATE_RE.test(x)); }

  /* 2.1 lists: [top key, sub key or null, date fields, nested log key, label]. Every item needs a safe id; dates must be YYYY-MM-DD. */
  var LISTS = [["contacts", null, ["last"], "log", "a contact"], ["refs", null, ["asked"], "uses", "a reference"], ["wins", null, ["date"], null, "a win"],
    ["offers", "list", ["deadline"], null, "an offer"], ["bench", "points", ["date"], null, "a salary data point"], ["skillsPlan", "skills", [], null, "a skill"],
    ["roadmap", "steps", ["due"], null, "a roadmap step"], ["free", "clients", ["due"], null, "a client"], ["portfolio", "projects", [], null, "a portfolio project"]];
  SC.CAREER_LISTS = LISTS;
  function listAt(o, a, b) { var x = o[a]; return b ? (isObj(x) ? x[b] : undefined) : x; }
  function checkLists(o) {
    for (var i = 0; i < LISTS.length; i++) {
      var L = LISTS[i], parent = o[L[0]], list = listAt(o, L[0], L[1]);
      if (L[1] && parent != null && !isObj(parent)) return "field \"" + L[0] + "\" is malformed";
      if (list === undefined || list === null) continue;
      if (!Array.isArray(list)) return L[4] + " list is malformed";
      for (var j = 0; j < list.length; j++) {
        var it = list[j];
        if (!isObj(it) || typeof it.id !== "string" || !ID_RE.test(it.id)) return L[4] + " has an invalid id";
        for (var k = 0; k < L[2].length; k++) if (!okDate(it[L[2][k]])) return L[4] + " has an invalid date";
        if (L[3] && it[L[3]] !== undefined) {
          if (!Array.isArray(it[L[3]])) return L[4] + " history is malformed";
          for (var m = 0; m < it[L[3]].length; m++) if (!isObj(it[L[3]][m]) || !okDate(it[L[3]][m].d)) return L[4] + " history date is invalid";
        }
      }
    }
    return null;
  }
  function cleanLists(d) {
    function fixId(x) { return typeof x === "string" && ID_RE.test(x) ? x : SC.uid(); }
    LISTS.forEach(function (L) {
      var host = L[1] ? d[L[0]] : d, key = L[1] || L[0];
      if (!isObj(host)) return;
      host[key] = (Array.isArray(host[key]) ? host[key] : []).filter(isObj).map(function (it) {
        it.id = fixId(it.id);
        L[2].forEach(function (f) { if (!okDate(it[f]) || it[f] == null) it[f] = L[0] === "wins" ? SC.today() : ""; });
        if (L[3]) it[L[3]] = (Array.isArray(it[L[3]]) ? it[L[3]] : []).filter(function (e) { return isObj(e) && typeof e.d === "string" && DATE_RE.test(e.d); });
        return it;
      });
    });
    return d;
  }

  /* Strict schema check of a restored state against the defaults template. Returns null or a plain reason. */
  SC.strictState = function (o, tpl) {
    if (!isObj(o)) return "the file is not a Stark Career backup";
    var raw = Object.keys(o), i, k;
    for (i = 0; i < raw.length; i++) if (isBad(raw[i])) return "it contains a forbidden key";
    var w = walk(o, 0, { n: 0 }); if (w) return w;
    for (i = 0; i < raw.length; i++) {
      k = raw[i];
      if (!Object.prototype.hasOwnProperty.call(tpl, k)) return "unknown field \"" + k.slice(0, 30) + "\"";
      if (o[k] !== null && (typeof o[k] !== typeof tpl[k] || Array.isArray(o[k]) !== Array.isArray(tpl[k]))) return "field \"" + k + "\" has the wrong type";
    }
    if (!isObj(o.resume) || !Array.isArray(o.apps)) return "it has no resume or no applications list";
    var st = SC.STAGES || [];
    for (i = 0; i < o.apps.length; i++) {
      var a = o.apps[i];
      if (!isObj(a)) return "an application entry is malformed";
      if (typeof a.id !== "string" || !ID_RE.test(a.id)) return "an application has an invalid id";
      if (st.length && st.indexOf(a.stage) < 0) return "an application has an unknown stage";
      if (!okDate(a.followUp)) return "an application has an invalid date";
      if (a.history !== undefined && !Array.isArray(a.history)) return "an application history is malformed";
      for (var h = 0; h < (a.history || []).length; h++) if (!isObj(a.history[h]) || !okDate(a.history[h].date)) return "an application history date is invalid";
      if (a.contacts !== undefined && !Array.isArray(a.contacts)) return "application contacts are malformed";
    }
    var lb = checkLists(o); if (lb) return lb;
    for (i = 0; i < (o.versions || []).length; i++) {
      var v = o.versions[i];
      if (!isObj(v) || typeof v.id !== "string" || !ID_RE.test(v.id) || !isObj(v.resume) || !okDate(v.created)) return "a saved resume version is malformed";
      if (v.appId != null && (typeof v.appId !== "string" || !ID_RE.test(v.appId))) return "a saved resume version has an invalid link";
    }
    return null;
  };

  /* Make already-loaded state safe to render: replace bad ids, stages and dates. Never throws. */
  SC.cleanState = function (d) {
    function fixId(x) { return typeof x === "string" && ID_RE.test(x) ? x : SC.uid(); }
    d.apps = d.apps.filter(isObj).map(function (a) {
      a.id = fixId(a.id);
      if (SC.STAGES && SC.STAGES.indexOf(a.stage) < 0) a.stage = "wishlist";
      if (!okDate(a.followUp)) a.followUp = null;
      a.history = Array.isArray(a.history) ? a.history.filter(isObj).map(function (e) { if (!okDate(e.date)) e.date = SC.today(); return e; }) : [];
      a.contacts = Array.isArray(a.contacts) ? a.contacts.filter(isObj) : [];
      if (a.versionId != null && (typeof a.versionId !== "string" || !ID_RE.test(a.versionId))) a.versionId = null;
      return a;
    });
    d.versions = d.versions.filter(function (v) { return isObj(v) && isObj(v.resume); }).map(function (v) {
      v.id = fixId(v.id); if (!okDate(v.created)) v.created = SC.today();
      if (typeof v.score !== "number" || !isFinite(v.score)) v.score = null;
      if (v.appId != null && (typeof v.appId !== "string" || !ID_RE.test(v.appId))) v.appId = null;
      return v;
    });
    return cleanLists(d);
  };

  /* Backup file: {app, format, created, sha256, data}. sha256 is over the canonical JSON of data. */
  SC.wrapBackup = function (state) {
    return JSON.stringify({ app: "Stark Career", format: 3, created: new Date().toISOString(), sha256: SC.sha256(SC.canon(state)), data: state }, null, 2);
  };
  /* Returns {ok:true, state, note} or {ok:false, error}. Never touches saved data. */
  SC.readBackup = function (text, tpl) {
    var o, state, note;
    if (typeof text !== "string" || text.length > MAX_TEXT) return { ok: false, error: "the file is too large or unreadable" };
    try { o = JSON.parse(text); } catch (e) { return { ok: false, error: "the file is not valid JSON" }; }
    if (isObj(o) && o.app === "Stark Career" && typeof o.sha256 === "string") {
      if (!isObj(o.data)) return { ok: false, error: "the backup has no data" };
      var w = walk(o.data, 0, { n: 0 }); if (w) return { ok: false, error: w };
      if (SC.sha256(SC.canon(o.data)) !== o.sha256.toLowerCase()) return { ok: false, error: "the checksum does not match, so the file was changed or damaged" };
      state = o.data; note = "checksum verified";
    } else { state = o; note = "no checksum, validated"; }
    var bad = SC.strictState(state, tpl); if (bad) return { ok: false, error: bad };
    return { ok: true, state: state, note: note };
  };

  /* Saving to localStorage. Main copy first, read back and compared; the spare (.bak) copy is best effort. A failure is
     reported to the caller and never latches: the next save tries again, so freeing space or closing another tab recovers. */
  SC.makeStore = function (ls, key) {
    var lastGood = null, lastBak = 0, failing = false;
    function put(txt) { ls.setItem(key, txt); if (ls.getItem(key) !== txt) throw new Error("the saved copy did not read back"); }
    return {
      seed: function (txt) { lastGood = txt; },
      failing: function () { return failing; },
      save: function (txt, now) {
        try { put(txt); }
        catch (e) {
          // Make room by dropping the spare copy (main still holds the last good save), then try once more.
          try { ls.removeItem(key + ".bak"); put(txt); }
          catch (e2) { try { if (lastGood != null && ls.getItem(key) !== lastGood) ls.setItem(key, lastGood); } catch (e3) { /* keep what is there */ } failing = true; return { ok: false, error: e2 }; }
        }
        var spare = "kept";
        if (lastGood && lastGood !== txt && now - lastBak > 5000) {
          try { ls.setItem(key + ".bak", lastGood); lastBak = now; spare = "written"; } catch (e) { try { ls.removeItem(key + ".bak"); } catch (e2) { /* nothing */ } spare = "skipped"; }
        }
        lastGood = txt; var was = failing; failing = false;
        return { ok: true, recovered: was, spare: spare };
      }
    };
  };

  /* Live backup file: after each good save the newest backup text is written to a file the person chose (File System Access API).
     Only the newest text is written; a write in progress finishes before the next one starts. */
  SC.makeMirror = function (o) {
    o = o || {};
    var handle = null, busy = null, next = null, last = null, err = null;
    function writeNow(text) {
      return Promise.resolve().then(function () { return handle.createWritable(); }).then(function (w) {
        return w.write(text).then(function () { return w.close(); }, function (e) { return Promise.resolve(w.abort && w.abort()).then(function () { throw e; }); });
      });
    }
    function pump() {
      if (busy || next === null || !handle) return busy || Promise.resolve();
      var text = next; next = null;
      busy = writeNow(text).then(function () { last = o.now ? o.now() : Date.now(); err = null; }, function (e) { err = e; if (o.onError) o.onError(e); })
        .then(function () { busy = null; return pump(); });
      return busy;
    }
    return {
      set: function (h) { handle = h; err = null; return this; },
      on: function () { return !!handle; },
      write: function (text) { next = text; return pump(); },
      status: function () { return { on: !!handle, name: handle && handle.name || "", last: last, error: err ? String(err.message || err) : "" }; },
      stop: function () { handle = null; next = null; }
    };
  };
  SC.canMirror = function (w) { try { return !!(w && typeof w.showSaveFilePicker === "function" && w.self === w.top); } catch (e) { return false; } };
})();
