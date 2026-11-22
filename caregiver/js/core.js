/* Stark Caregiver, by Stark: crypto and data core (no DOM, no network).
   Runs in the browser and in Node (tests) using the standard WebCrypto API.
   The encryption layer is the one from Stark Family Vault, with the care record types added. */
(function (root) {
  "use strict";
  var VERSION = "1.4.0";
  var KDF_ITER = 600000;            // PBKDF2-SHA256 iterations (OWASP 2023 guidance)
  var FORMAT = "StarkCaregiver";
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
  function uid() { return Array.prototype.map.call(rand(8), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }

  function deriveKey(pass, salt, iter) {
    return subtle().importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return subtle().deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, base,
        { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  // The header (format, kind, iterations, salt) is bound to the ciphertext as AES-GCM additional data,
  // so changing any header field makes decryption fail the same way a bit flip in the data does.
  // A vault envelope also binds its save sequence number, so the number cannot be edited to pass an old copy off as new.
  function aad(kind, iter, salt, seq) { return enc.encode(FORMAT + "|1|" + kind + "|" + iter + "|" + salt + (seq != null ? "|" + seq : "")); }

  // A session holds the derived key (never the passphrase) so every save can re-encrypt with a fresh IV.
  function newSession(pass, kind, iter) {
    var salt = rand(16), it = iter || KDF_ITER;
    return deriveKey(pass, salt, it).then(function (key) { return { key: key, salt: b64(salt), iter: it, kind: kind || "vault" }; });
  }
  /* ---- integrity and strict validation of files and decrypted data ---- */
  var ENV_KEYS = ["format", "v", "kind", "kdf", "iter", "salt", "iv", "ct", "sum", "seq"];
  var VAULT_KEYS = ["v", "created", "shared", "note", "settings", "people", "docs", "health", "contacts", "meds", "doses", "diary", "rota", "checkins", "tasks", "emergency"];
  var LISTS = ["people", "docs", "contacts", "meds", "doses", "diary", "checkins", "tasks"];
  var MAX_CT = 160 * 1024 * 1024, MAX_ITEMS = 50000, MAX_STR = 12 * 1024 * 1024, MAX_DEPTH = 8, MAX_NODES = 2000000;
  var BAD_KEYS = { "__proto__": 1, "constructor": 1, "prototype": 1 };
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  // SHA-256 over the canonical header + ciphertext, stored in the file as "sum".
  function sumOf(env) {
    return subtle().digest("SHA-256", enc.encode([FORMAT, env.v, env.kind, env.kdf, env.iter, env.salt, env.iv, env.ct].concat(env.seq != null ? [env.seq] : []).join("|"))).then(hex);
  }
  function validateEnvelope(env) {
    var k;
    if (!isObj(env) || env.format !== FORMAT || env.v !== 1 || env.kdf !== "PBKDF2-SHA256" || (env.kind !== "vault" && env.kind !== "share") ||
        typeof env.iter !== "number" || !(env.iter >= 100000 && env.iter <= 10000000) || Math.floor(env.iter) !== env.iter ||
        typeof env.salt !== "string" || typeof env.iv !== "string" || typeof env.ct !== "string" ||
        env.salt.length > 64 || env.iv.length > 64 || env.ct.length > MAX_CT || (env.sum != null && !/^[0-9a-f]{64}$/.test(env.sum)) ||
        (env.seq != null && !(typeof env.seq === "number" && Math.floor(env.seq) === env.seq && env.seq >= 1 && env.seq <= 9e15 && env.kind === "vault"))) return "This is not a Stark Caregiver file.";
    for (k in env) if (Object.prototype.hasOwnProperty.call(env, k) && ENV_KEYS.indexOf(k) === -1) return "This is not a Stark Caregiver file.";
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
  function rotaOk(r) {
    if (!isObj(r)) return false;
    var arrs = ["helpers", "shifts", "handovers"], i, k;
    for (i = 0; i < arrs.length; i++) if (r[arrs[i]] != null && (!Array.isArray(r[arrs[i]]) || !r[arrs[i]].every(isObj))) return false;
    if (r.assign != null) {
      if (!isObj(r.assign)) return false;
      for (k in r.assign) if (Object.prototype.hasOwnProperty.call(r.assign, k) && (!Array.isArray(r.assign[k]) || !r.assign[k].every(function (x) { return typeof x === "string"; }))) return false;
    }
    return true;
  }
  function validateVault(v) {
    var k, i;
    if (!isObj(v) || v.v !== 1) return "The data inside is not a care record this app understands.";
    for (k in v) if (Object.prototype.hasOwnProperty.call(v, k) && VAULT_KEYS.indexOf(k) === -1) return "The data inside has unexpected fields.";
    for (i = 0; i < LISTS.length; i++) {
      if (v[LISTS[i]] != null && (!Array.isArray(v[LISTS[i]]) || !v[LISTS[i]].every(isObj))) return "The data inside has the wrong shape.";
    }
    if (v.people && !v.people.every(function (p) { return typeof p.id === "string" && typeof p.name === "string"; })) return "The data inside has the wrong shape.";
    if (v.health != null && !isObj(v.health)) return "The data inside has the wrong shape.";
    if (v.emergency != null && !isObj(v.emergency)) return "The data inside has the wrong shape.";
    if (v.settings != null && !isObj(v.settings)) return "The data inside has the wrong shape.";
    if (v.rota != null && !rotaOk(v.rota)) return "The data inside has the wrong shape.";
    ["created", "shared", "note"].forEach(function (f) { if (v[f] != null && typeof v[f] !== "string") i = -1; });
    if (i === -1) return "The data inside has the wrong shape.";
    if (!plainOk(v, 0, { n: 0 })) return "The data inside is too large or contains unsafe content.";
    return null;
  }
  function seal(session, obj) {
    var iv = rand(12), data = enc.encode(JSON.stringify(obj)), seq = session.kind === "vault" ? (session.seq || 0) + 1 : null;
    return subtle().encrypt({ name: "AES-GCM", iv: iv, additionalData: aad(session.kind, session.iter, session.salt, seq) }, session.key, data)
      .then(function (ct) {
        var env = { format: FORMAT, v: 1, kind: session.kind, kdf: "PBKDF2-SHA256", iter: session.iter, salt: session.salt, iv: b64(iv), ct: b64(ct) };
        if (seq != null) { env.seq = seq; session.seq = seq; }
        return sumOf(env).then(function (sum) { env.sum = sum; return env; });
      });
  }
  // Resolves { data, session, legacy }. legacy = the file has no checksum: it is accepted only because it passed strict validation.
  function open(env, pass) {
    var bad = new Error("Wrong passphrase, or the file was damaged or changed."), why = validateEnvelope(env);
    if (why) return Promise.reject(new Error(why));
    return Promise.resolve().then(function () { return env.sum ? sumOf(env) : null; }).then(function (sum) {
      if (env.sum && sum !== env.sum) throw new Error("Wrong passphrase, or the file was damaged or changed (checksum mismatch). Nothing was changed.");
      return deriveKey(pass, unb64(env.salt), env.iter).then(function (key) {
        return subtle().decrypt({ name: "AES-GCM", iv: unb64(env.iv), additionalData: aad(env.kind, env.iter, env.salt, env.seq) }, key, unb64(env.ct))
          .then(function (pt) { return JSON.parse(dec.decode(pt)); }).catch(function () { throw bad; })
          .then(function (data) { return { data: data, session: { key: key, salt: env.salt, iter: env.iter, kind: env.kind, seq: env.seq || 0 }, legacy: !env.sum, seq: env.seq || 0 }; });
      });
    });
  }
  // open() plus strict schema validation of the decrypted record. On a schema failure the error has invalid=true and carries data.
  function openVault(env, pass) {
    return open(env, pass).then(function (r) {
      var w = validateVault(r.data), e;
      if (w) { e = new Error(w + " Nothing was changed."); e.invalid = true; e.data = r.data; throw e; }
      return r;
    });
  }
  function encryptOnce(obj, pass, kind, iter) {
    return newSession(pass, kind, iter).then(function (s) { return seal(s, obj); });
  }

  /* ---- passphrase strength (honest estimate, no network) ---- */
  var COMMON = ["password", "passphrase", "qwerty", "letmein", "welcome", "iloveyou", "admin", "family", "123456", "abc123", "monkey", "dragon", "football", "baseball", "caregiver", "starkcare"];
  function strength(p) {
    p = p || "";
    var pool = 0, bits, lower = p.toLowerCase(), i, score, label, notes = [], uniq = {}, u;
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
    if (p.length < 12) notes.push("shorter than 12 characters");
    bits = Math.max(0, Math.round(bits));
    score = bits < 28 ? 0 : bits < 45 ? 1 : bits < 62 ? 2 : bits < 80 ? 3 : 4;
    if (p.length < 8) score = 0;
    label = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score];
    return { score: score, label: label, bits: bits, notes: notes, ok: score >= 3 && p.length >= 12 };
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
  function nowHM(d) { d = d || new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function daysUntil(date, today) { var a = dayNum(date), b = dayNum(today || todayStr()); return isNaN(a) || isNaN(b) ? null : a - b; }
  function addYears(date, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
    if (!m) return null;
    var y = +m[1] + n, mo = +m[2], d = +m[3], last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return y + "-" + m[2] + "-" + pad(Math.min(d, last));
  }
  function addDays(date, n) {
    var t = dayNum(date);
    if (isNaN(t)) return null;
    var d = new Date((t + n) * 86400000);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  // state: expired (past), soon (inside the reminder window), ok (later), none (no date)
  function reminderStatus(item, today) {
    var d = daysUntil(item.expires, today), lead = item.leadDays == null || item.leadDays === "" ? 60 : +item.leadDays;
    if (d === null) return { state: "none", days: null, lead: lead };
    return { state: d < 0 ? "expired" : d <= lead ? "soon" : "ok", days: d, lead: lead, remindOn: addDays(item.expires, -lead) };
  }
  function reminderText(r) {
    if (r.state === "expired") return "Expired " + Math.abs(r.days) + (Math.abs(r.days) === 1 ? " day" : " days") + " ago";
    if (r.days === 0) return "Expires today";
    return "Expires in " + r.days + (r.days === 1 ? " day" : " days");
  }

  /* ---- safety checks for free-text notes ---- */
  function cleanLast4(s) { return String(s || "").replace(/\D/g, "").slice(-4); }
  function looksSensitive(text) {
    var t = String(text || ""), flags = [];
    if (/\b(?:\d[ -]?){13,19}\b/.test(t)) flags.push("what looks like a full card or account number");
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(t)) flags.push("what looks like a national ID number");
    if (/\b(pass(word|code)?|pwd|pin|cvv|cvc|security code|secret)\b\s*[:=]/i.test(t)) flags.push("what looks like a password or PIN");
    return flags;
  }

  /* ---- record shape and sharing ---- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function emptyRota() { return { helpers: [], shifts: [], assign: {}, handovers: [] }; }
  function emptyVault(carer, cared) {
    var me = uid(), rota = emptyRota();
    rota.helpers.push({ id: me, name: carer || "Me", rel: "Main carer", phone: "", off: [] });
    return { v: 1, created: todayStr(), settings: { lockMin: 5, lastBackup: null, me: me },
      people: [{ id: uid(), name: cared || "The person I care for", rel: "", dob: "" }],
      docs: [], health: {}, contacts: [], meds: [], doses: [], diary: [], rota: rota, checkins: [], tasks: [], emergency: {} };
  }
  // Sections a share file can carry. The carer's own check-ins are private and are never shared.
  var SECTIONS = ["docs", "health", "meds", "doses", "diary", "rota", "contacts", "emergency", "tasks"];
  var MEDIA = ["scan"];
  function stripMedia(x) { MEDIA.forEach(function (k) { if (x[k]) x[k] = null; }); return x; }
  function subset(vault, opts) {
    var people = vault.people.filter(function (p) { return opts.people.indexOf(p.id) !== -1; }), ids = people.map(function (p) { return p.id; });
    var out = { v: 1, shared: todayStr(), note: opts.note || "", people: clone(people), docs: [], health: {}, contacts: [], meds: [], doses: [], diary: [], rota: emptyRota(),
      checkins: [], tasks: [], emergency: {}, settings: { lockMin: 5 } };
    var s = opts.sections || [], has = function (k) { return s.indexOf(k) !== -1; }, mine = function (pid) { return ids.indexOf(pid) !== -1; },
      house = function (pid) { return !pid || pid === "household" || mine(pid); }, media = function (x) { return opts.scans ? x : stripMedia(x); };
    if (has("docs")) out.docs = (vault.docs || []).filter(function (d) { return mine(d.person); }).map(clone).map(media);
    if (has("health")) ids.forEach(function (i) { if ((vault.health || {})[i]) out.health[i] = clone(vault.health[i]); });
    if (has("contacts")) out.contacts = clone(vault.contacts || []);
    if (has("meds") || has("doses")) out.meds = clone((vault.meds || []).filter(function (m) { return mine(m.person); }));
    if (has("doses")) {
      var medIds = out.meds.map(function (m) { return m.id; });
      out.doses = clone((vault.doses || []).filter(function (d) { return medIds.indexOf(d.med) !== -1; }));
    }
    if (has("diary")) out.diary = clone((vault.diary || []).filter(function (d) { return mine(d.person); }));
    if (has("rota") && isObj(vault.rota)) {
      out.rota = clone(vault.rota);
      out.rota.shifts = (out.rota.shifts || []).filter(function (sh) { return house(sh.person); });
      var keep = {}; out.rota.shifts.forEach(function (sh) { keep[sh.id] = 1; });
      Object.keys(out.rota.assign || {}).forEach(function (k) { if (!keep[k]) delete out.rota.assign[k]; });
    }
    if (has("tasks")) out.tasks = clone((vault.tasks || []).filter(function (t) { return house(t.person); }));
    if (has("emergency")) out.emergency = clone(vault.emergency || {});
    return out;
  }
  function exportShare(vault, opts, pass, iter) { return encryptOnce(subset(vault, opts), pass, "share", iter); }
  function exportBackup(vault, pass, iter) { return encryptOnce(vault, pass, "vault", iter); }

  // Merge a relative's share file into this record. People and helpers are matched by name, medicines by person, name and dose.
  // Records already present (same signature) are skipped, so importing the same file twice adds nothing new.
  function low(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
  function mergeInto(vault, shared) {
    var map = {}, medMap = {}, helperMap = {}, shiftMap = {}, added = { people: 0, docs: 0, contacts: 0, meds: 0, doses: 0, diary: 0, health: 0, tasks: 0, helpers: 0, shifts: 0, handovers: 0 };
    ["docs", "contacts", "meds", "doses", "diary", "tasks", "checkins"].forEach(function (k) { if (!Array.isArray(vault[k])) vault[k] = []; });
    ["health", "emergency"].forEach(function (k) { if (!isObj(vault[k])) vault[k] = {}; });
    if (!isObj(vault.rota)) vault.rota = emptyRota();
    ["helpers", "shifts", "handovers"].forEach(function (k) { if (!Array.isArray(vault.rota[k])) vault.rota[k] = []; });
    if (!isObj(vault.rota.assign)) vault.rota.assign = {};
    function addIfNew(list, rec, sig, key) {
      var s = sig(rec);
      if (list.some(function (x) { return sig(x) === s; })) return false;
      list.push(rec); added[key]++; return true;
    }
    (shared.people || []).forEach(function (p) {
      var hit = vault.people.filter(function (q) { return low(q.name) === low(p.name); })[0];
      if (!hit) { hit = clone(p); hit.id = uid(); vault.people.push(hit); added.people++; }
      map[p.id] = hit.id;
    });
    var who = function (pid) { return map[pid] || vault.people[0].id; };
    (shared.docs || []).forEach(function (d) { var c = clone(d); c.id = uid(); c.person = who(d.person); addIfNew(vault.docs, c, function (x) { return [x.person, low(x.title), x.expires || ""].join("|"); }, "docs"); });
    (shared.contacts || []).forEach(function (x) { var c = clone(x); c.id = uid(); addIfNew(vault.contacts, c, function (y) { return low(y.name) + "|" + low(y.phone); }, "contacts"); });
    (shared.meds || []).forEach(function (m) {
      var pid = who(m.person), hit = vault.meds.filter(function (x) { return x.person === pid && low(x.name) === low(m.name) && low(x.dose) === low(m.dose); })[0];
      if (!hit) { hit = clone(m); hit.id = uid(); hit.person = pid; vault.meds.push(hit); added.meds++; }
      medMap[m.id] = hit.id;
    });
    (shared.doses || []).forEach(function (d) {
      if (!medMap[d.med]) return;
      var c = clone(d); c.id = uid(); c.med = medMap[d.med]; c.person = who(d.person);
      addIfNew(vault.doses, c, function (x) { return [x.med, x.date, x.slot || "", x.status, x.at || ""].join("|"); }, "doses");
    });
    (shared.diary || []).forEach(function (d) {
      var c = clone(d); c.id = uid(); c.person = who(d.person);
      addIfNew(vault.diary, c, function (x) { return [x.person, x.kind, x.date, x.time || "", low(x.title)].join("|"); }, "diary");
    });
    (shared.tasks || []).forEach(function (x) {
      var c = clone(x); c.id = uid(); c.person = map[x.person] || (x.person === "household" ? "household" : "");
      addIfNew(vault.tasks, c, function (y) { return low(y.title) + "|" + (y.due || ""); }, "tasks");
    });
    var R = shared.rota || {}, VR = vault.rota;
    (R.helpers || []).forEach(function (hp) {
      var hit = VR.helpers.filter(function (x) { return low(x.name) === low(hp.name); })[0];
      if (!hit) { hit = clone(hp); hit.id = uid(); VR.helpers.push(hit); added.helpers++; }
      helperMap[hp.id] = hit.id;
    });
    (R.shifts || []).forEach(function (sh) {
      var pid = sh.person ? (map[sh.person] || "") : "", sig = [sh.date, sh.start, sh.end, low(sh.role)].join("|"),
        hit = VR.shifts.filter(function (x) { return [x.date, x.start, x.end, low(x.role)].join("|") === sig; })[0];
      if (!hit) { hit = clone(sh); hit.id = uid(); hit.person = pid; VR.shifts.push(hit); added.shifts++; }
      shiftMap[sh.id] = hit.id;
    });
    Object.keys(R.assign || {}).forEach(function (sid) {
      var to = shiftMap[sid]; if (!to) return;
      var l = VR.assign[to] = VR.assign[to] || [];
      (R.assign[sid] || []).forEach(function (hid) { var h = helperMap[hid]; if (h && l.indexOf(h) === -1) l.push(h); });
    });
    (R.handovers || []).forEach(function (n) {
      var c = clone(n); c.id = uid(); c.by = helperMap[n.by] || ""; c.byName = n.byName || ""; c.person = n.person ? (map[n.person] || "") : "";
      addIfNew(VR.handovers, c, function (x) { return [x.date, x.time || "", low(x.text)].join("|"); }, "handovers");
    });
    Object.keys(shared.health || {}).forEach(function (pid) { if (map[pid] && !vault.health[map[pid]]) { vault.health[map[pid]] = clone(shared.health[pid]); added.health++; } });
    if (shared.emergency && Object.keys(shared.emergency).length && !Object.keys(vault.emergency).length) vault.emergency = clone(shared.emergency);
    return added;
  }

  var api = { VERSION: VERSION, MEDIA: MEDIA, stripMedia: stripMedia, KDF_ITER: KDF_ITER, FORMAT: FORMAT, b64: b64, unb64: unb64, uid: uid, newSession: newSession, seal: seal, open: open, openVault: openVault,
    encryptOnce: encryptOnce, strength: strength, dayNum: dayNum, todayStr: todayStr, nowHM: nowHM, daysUntil: daysUntil, addYears: addYears, addDays: addDays,
    reminderStatus: reminderStatus, reminderText: reminderText, cleanLast4: cleanLast4, looksSensitive: looksSensitive, clone: clone,
    emptyVault: emptyVault, emptyRota: emptyRota, SECTIONS: SECTIONS, subset: subset, exportShare: exportShare, exportBackup: exportBackup, mergeInto: mergeInto, validateEnvelope: validateEnvelope, validateVault: validateVault, sumOf: sumOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CareCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
