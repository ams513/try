(function (root) {
  "use strict";
  var VERSION = "1.1.0";
  var KDF_ITER = 600000;            // PBKDF2-SHA256 iterations (OWASP 2023 guidance)
  var MIN_ITER = 100000, MAX_ITER = 2000000;   // accepted from a file: higher is a UI-freeze trap; lower is upgraded on unlock
  var FORMAT = "StarkVital", BUNDLE = "StarkVitalBackup";
  var enc = new TextEncoder(), dec = new TextDecoder();
  function subtle() { return root.crypto.subtle; }

  function b64(buf) {
    var b = new Uint8Array(buf), s = "", i;
    for (i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), out = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function rand(n) { return root.crypto.getRandomValues(new Uint8Array(n)); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function uid() { return hex(rand(8)); }
  function sha256(bytes) { return subtle().digest("SHA-256", bytes).then(hex); }

  // Passphrases are Unicode-normalised (NFKC) so the same words typed on another system or keyboard open the same records.
  function normPass(pass) { pass = String(pass == null ? "" : pass); return typeof pass.normalize === "function" ? pass.normalize("NFKC") : pass; }
  function deriveKey(pass, salt, iter) {
    return subtle().importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return subtle().deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, base,
        { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  // Header (format, kind, iterations, salt, ref, save number) is bound to the ciphertext as AES-GCM additional data: changing
  // any field, moving an evidence file under another record's id, or stripping the save number fails like a bit flip in the data.
  function aad(kind, iter, salt, ref, seq) { return enc.encode(FORMAT + "|1|" + kind + "|" + iter + "|" + salt + "|" + (ref || "") + (seq != null ? "|" + seq : "")); }

  // A session holds the derived key (never the passphrase) so every save can re-encrypt with a fresh IV.
  function newSession(pass, iter) {
    var salt = rand(16), it = iter || KDF_ITER;
    return deriveKey(normPass(pass), salt, it).then(function (key) { return { key: key, salt: b64(salt), iter: it }; });
  }

  /* ---- integrity and strict validation ---- */
  var ENV_KEYS = ["format", "v", "kind", "kdf", "iter", "salt", "seq", "iv", "ct", "sum"];
  var DATA_KEYS = ["v", "created", "example", "settings", "days", "labs", "experiments", "questions", "log", "custom"];
  var LISTS = ["labs", "experiments", "questions", "log"];
  var MAX_CT = 48 * 1024 * 1024, MAX_ITEMS = 20000, MAX_STR = 1024 * 1024, MAX_DEPTH = 8, MAX_NODES = 1000000, MAX_DAYS = 20000;
  var BAD_KEYS = { "__proto__": 1, "constructor": 1, "prototype": 1 };
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function sumOf(env) {
    var parts = [FORMAT, env.v, env.kind, env.kdf, env.iter, env.salt, "", env.iv, env.ct];
    if (env.seq != null) parts.push("seq" + env.seq);
    return subtle().digest("SHA-256", enc.encode(parts.join("|"))).then(hex);
  }
  var NOT_OURS = "This is not a Stark Vital file.";
  function validateEnvelope(env, kind) {
    var k;
    if (!isObj(env) || env.format !== FORMAT || env.v !== 1 || env.kdf !== "PBKDF2-SHA256" || env.kind !== "vital" || (kind && env.kind !== kind) ||
        typeof env.iter !== "number" || !(env.iter >= MIN_ITER && env.iter <= MAX_ITER) || Math.floor(env.iter) !== env.iter ||
        typeof env.salt !== "string" || typeof env.iv !== "string" || typeof env.ct !== "string" ||
        env.salt.length > 64 || env.iv.length > 64 || env.ct.length > MAX_CT || (env.sum != null && !/^[0-9a-f]{64}$/.test(env.sum)) ||
        (env.seq != null && !(typeof env.seq === "number" && Math.floor(env.seq) === env.seq && env.seq >= 0 && env.seq <= 9007199254740991))) return NOT_OURS;
    for (k in env) if (Object.prototype.hasOwnProperty.call(env, k) && ENV_KEYS.indexOf(k) === -1) return NOT_OURS;
    return null;
  }
  // Plain data only: no forbidden keys, bounded depth, size and node count.
  function plainOk(x, depth, st) {
    var k, i, t = typeof x;
    if (++st.n > MAX_NODES || depth > MAX_DEPTH) return false;
    if (x === null || t === "boolean") return true;
    if (t === "number") return isFinite(x);
    if (t === "string") return x.length <= MAX_STR;
    if (Array.isArray(x)) { if (x.length > MAX_ITEMS) return false; for (i = 0; i < x.length; i++) if (!plainOk(x[i], depth + 1, st)) return false; return true; }
    if (isObj(x)) {
      for (k in x) { if (!Object.prototype.hasOwnProperty.call(x, k)) continue; if (BAD_KEYS[k] || k.length > 200 || !plainOk(x[k], depth + 1, st)) return false; }
      return true;
    }
    return false;
  }
  // Shape check (the fine ranges are enforced by VitalData.sanitize): a crafted file cannot crash a view.
  function validateData(d) {
    var k, shape = "The data inside has the wrong shape.", n = 0;
    if (!isObj(d) || d.v !== 1) return "The data inside is not something this app understands.";
    for (k in d) if (Object.prototype.hasOwnProperty.call(d, k) && DATA_KEYS.indexOf(k) === -1) return "The data inside has unexpected fields.";
    if (d.days != null) {
      if (!isObj(d.days)) return shape;
      for (k in d.days) {
        if (!Object.prototype.hasOwnProperty.call(d.days, k)) continue;
        if (isNaN(dayNum(k)) || !isObj(d.days[k]) || ++n > MAX_DAYS) return shape;
        for (var f in d.days[k]) if (Object.prototype.hasOwnProperty.call(d.days[k], f) && d.days[k][f] !== null && typeof d.days[k][f] === "object" && !Array.isArray(d.days[k][f])) return shape;
      }
    }
    for (var i = 0; i < LISTS.length; i++) {
      var L = d[LISTS[i]];
      if (L != null && (!Array.isArray(L) || !L.every(function (x) { return isObj(x) && typeof x.id === "string"; }))) return shape;
    }
    if (d.custom != null) {
      if (!isObj(d.custom) || !Array.isArray(d.custom.items) || !isObj(d.custom.vals) || Object.keys(d.custom).some(function (x) { return x !== "items" && x !== "vals"; })) return shape;
      if (!d.custom.items.every(function (x) { return isObj(x) && typeof x.id === "string"; })) return shape;
      for (k in d.custom.vals) if (Object.prototype.hasOwnProperty.call(d.custom.vals, k) && (isNaN(dayNum(k)) || !isObj(d.custom.vals[k]))) return shape;
    }
    if (d.settings != null && !isObj(d.settings)) return shape;
    if (d.created != null && typeof d.created !== "string") return shape;
    if (d.example != null && typeof d.example !== "boolean") return shape;
    if (!plainOk(d, 0, { n: 0 })) return "The data inside is too large or contains unsafe content.";
    return null;
  }

  // seq: the save number of the main record (one higher per save), bound into the additional data for rollback checks.
  function seal(session, obj, kind, ref, seq) {
    var iv = rand(12), k = kind || "vital", data = enc.encode(JSON.stringify(obj)), sq = k === "vital" && typeof seq === "number" ? seq : null;
    return subtle().encrypt({ name: "AES-GCM", iv: iv, additionalData: aad(k, session.iter, session.salt, ref, sq) }, session.key, data)
      .then(function (ct) {
        var env = { format: FORMAT, v: 1, kind: k, kdf: "PBKDF2-SHA256", iter: session.iter, salt: session.salt };
        if (ref) env.ref = ref;
        if (sq != null) env.seq = sq;
        env.iv = b64(iv); env.ct = b64(ct);
        return sumOf(env).then(function (sum) { env.sum = sum; return env; });
      });
  }
  var BAD = "Wrong passphrase, or the file was damaged or changed.";
  function decryptWith(env, key) {
    return Promise.resolve().then(function () { return env.sum ? sumOf(env) : null; }).then(function (sum) {
      if (env.sum && sum !== env.sum) throw new Error(BAD + " (checksum mismatch). Nothing was changed.");
      return subtle().decrypt({ name: "AES-GCM", iv: unb64(env.iv), additionalData: aad(env.kind, env.iter, env.salt, env.ref, env.seq) }, key, unb64(env.ct))
        .then(function (pt) { return JSON.parse(dec.decode(pt)); }, function () { throw new Error(BAD); });
    });
  }
  // Resolves { data, session, seq, upgrade }. The damage check runs before any key work. The normalised passphrase is tried
  // first, then the passphrase exactly as typed (records made before normalisation). upgrade = true asks the app to
  // re-encrypt at today's cost with the normalised passphrase.
  function open(env, pass) {
    var why = validateEnvelope(env, "vital"), raw = String(pass == null ? "" : pass), nf = normPass(raw);
    if (why) return Promise.reject(new Error(why));
    function attempt(p) { return deriveKey(p, unb64(env.salt), env.iter).then(function (key) { return decryptWith(env, key).then(function (data) { return { data: data, key: key }; }); }); }
    return Promise.resolve().then(function () { return env.sum ? sumOf(env) : null; }).then(function (sum) {
      if (env.sum && sum !== env.sum) throw new Error(BAD + " (checksum mismatch). Nothing was changed.");
      return attempt(nf).then(function (r) { r.legacy = false; return r; }, function (e) {
        if (nf === raw) throw e;
        return attempt(raw).then(function (r) { r.legacy = true; return r; }, function () { throw e; });
      });
    }).then(function (r) {
      return { data: r.data, session: { key: r.key, salt: env.salt, iter: env.iter }, seq: env.seq || 0, upgrade: r.legacy || env.iter < KDF_ITER };
    });
  }
  // open() plus strict validation of what was decrypted. A schema failure carries invalid=true.
  function openData(env, pass) {
    return open(env, pass).then(function (r) {
      var w = validateData(r.data), e;
      if (w) { e = new Error(w + " Nothing was changed."); e.invalid = true; throw e; }
      return r;
    });
  }
  /* ---- backup file: the stored ciphertext as it is, so nothing is decrypted to make a backup ---- */
  function makeBundle(mainEnv) { return { format: BUNDLE, v: 1, created: todayStr(), main: mainEnv }; }
  function validateBundle(b) {
    var k, bad = "This is not a Stark Vital backup file.";
    if (!isObj(b) || b.format !== BUNDLE || b.v !== 1) return bad;
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k) && ["format", "v", "created", "main"].indexOf(k) === -1) return bad;
    if (validateEnvelope(b.main, "vital")) return bad;
    return null;
  }

  /* ---- passphrase strength (honest estimate, no network) ---- */
  var COMMON = ["password", "passphrase", "qwerty", "letmein", "welcome", "iloveyou", "admin", "123456", "abc123", "monkey", "dragon", "football", "vital", "stark"];
  function strength(p) {
    p = p || "";
    var pool = 0, bits, lower = p.toLowerCase(), i, score, notes = [], uniq = {}, u;
    if (/[a-z]/.test(p)) pool += 26;
    if (/[A-Z]/.test(p)) pool += 26;
    if (/[0-9]/.test(p)) pool += 10;
    if (/[^A-Za-z0-9 ]/.test(p)) pool += 32;
    if (/ /.test(p)) pool += 1;
    for (i = 0; i < p.length; i++) uniq[p[i]] = 1;
    u = Object.keys(uniq).length;
    bits = pool ? Math.log2(pool) * Math.min(p.length, u * 2.5) : 0;
    if (/(.)\1{2,}/.test(p)) { bits -= 6; notes.push("repeated characters"); }
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf)/i.test(p)) { bits -= 8; notes.push("an easy sequence"); }
    for (i = 0; i < COMMON.length; i++) if (lower.indexOf(COMMON[i]) !== -1) { bits -= 14; notes.push("a very common word"); break; }
    if (p.length < 16) notes.push("shorter than 16 characters");
    bits = Math.max(0, Math.round(bits));
    score = bits < 28 ? 0 : bits < 45 ? 1 : bits < 62 ? 2 : bits < 80 ? 3 : 4;
    if (p.length < 8) score = 0;
    return { score: score, label: ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score], bits: bits, notes: notes, ok: score >= 3 && p.length >= 16 };
  }

  /* ---- dates: whole-day maths on YYYY-MM-DD strings (no time zone drift) ---- */
  function dayNum(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return NaN;
    var y = +m[1], mo = +m[2], d = +m[3], t = Date.UTC(y, mo - 1, d), c = new Date(t);
    if (c.getUTCFullYear() !== y || c.getUTCMonth() !== mo - 1 || c.getUTCDate() !== d) return NaN;
    return Math.round(t / 86400000);
  }
  function pad(n) { return ("0" + n).slice(-2); }
  function todayStr(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function daysBetween(from, to) { var a = dayNum(from), b = dayNum(to); return isNaN(a) || isNaN(b) ? null : b - a; }
  function addDays(date, n) {
    var t = dayNum(date);
    if (isNaN(t)) return null;
    var d = new Date((t + n) * 86400000);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  /* ---- data shape ---- */
  function emptyData() {
    return { v: 1, created: todayStr(), example: false,
      settings: { lockMin: 10, lockOnHide: false, tracked: ["sleep", "mood", "energy"], detail: "simple", goal: "any", reduceMotion: null, adult: false, restricted: false, started: null, remind: "" },
      days: {}, labs: [], experiments: [], questions: [], log: [] };
  }
  function migrate(d) {
    var base = emptyData(), k;
    LISTS.forEach(function (n) { if (!Array.isArray(d[n])) d[n] = []; });
    if (!isObj(d.days)) d.days = {};
    if (!isObj(d.settings)) d.settings = {};
    for (k in base.settings) if (d.settings[k] === undefined) d.settings[k] = base.settings[k];
    if (typeof d.example !== "boolean") d.example = false;
    if (typeof d.created !== "string") d.created = base.created;
    return d;
  }

  var api = { VERSION: VERSION, KDF_ITER: KDF_ITER, MAX_ITER: MAX_ITER, normPass: normPass, FORMAT: FORMAT, BUNDLE: BUNDLE, b64: b64, unb64: unb64, uid: uid, sha256: sha256, newSession: newSession,
    seal: seal, open: open, openData: openData, makeBundle: makeBundle, validateBundle: validateBundle,
    validateEnvelope: validateEnvelope, validateData: validateData, sumOf: sumOf, strength: strength, dayNum: dayNum, todayStr: todayStr,
    daysBetween: daysBetween, addDays: addDays, emptyData: emptyData, migrate: migrate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.StarkVital = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
