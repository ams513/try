/* Stark Family Vault, by Stark: crypto and data core (no DOM, no network).
   Runs in the browser and in Node (tests) using the standard WebCrypto API. */
(function (root) {
  "use strict";
  var VERSION = "1.4.0";
  var KDF_ITER = 600000;            // PBKDF2-SHA256 iterations (OWASP 2023 guidance)
  var MIN_ITER = 100000, MAX_ITER = 2000000; // accepted range in files: a crafted file cannot freeze the tab or downgrade the vault
  var FORMAT = "StarkVault";
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
  // `n` is the save counter (1.2.1+). It is bound too, so an older copy cannot be relabelled as newer (rollback detection).
  function aad(kind, iter, salt, n) { return enc.encode(FORMAT + "|1|" + kind + "|" + iter + "|" + salt + (n != null ? "|n" + n : "")); }

  // A session holds the derived key (never the passphrase) so every save can re-encrypt with a fresh IV.
  function newSession(pass, kind, iter) {
    var salt = rand(16), it = iter || KDF_ITER;
    return deriveKey(pass, salt, it).then(function (key) { return { key: key, salt: b64(salt), iter: it, kind: kind || "vault" }; });
  }
  // True when `pass` is the passphrase this session's key was made from (the passphrase itself is never kept).
  function checkPass(session, pass) {
    var iv = rand(12);
    return subtle().encrypt({ name: "AES-GCM", iv: iv }, session.key, enc.encode("probe")).then(function (ct) {
      return deriveKey(String(pass), unb64(session.salt), session.iter).then(function (k) { return subtle().decrypt({ name: "AES-GCM", iv: iv }, k, ct); });
    }).then(function () { return true; }, function () { return false; });
  }
  /* ---- integrity and strict validation of files and decrypted data ---- */
  var ENV_KEYS = ["format", "v", "kind", "kdf", "iter", "salt", "iv", "ct", "sum", "n"];
  var B64 = /^[A-Za-z0-9+\/]*={0,2}$/;
  // image/jpg too: readScan keeps a picture's own type when it cannot be redrawn, and a vault holding one must still open.
  var MEDIA_URL = /^data:(image\/(png|jpe?g|webp|gif|bmp)|application\/pdf);base64,[A-Za-z0-9+\/]*={0,2}$/, MEDIA_MIME = /^(image\/(png|jpeg|jpg|webp|gif|bmp)|application\/pdf)$/;
  var VAULT_KEYS = ["v", "created", "shared", "note", "settings", "people", "docs", "health", "contacts", "accounts", "plan", "inventory", "meds", "policies", "digital", "tasks", "emergency"];
  var MAX_CT = 160 * 1024 * 1024, MAX_ITEMS = 50000, MAX_STR = 12 * 1024 * 1024, MAX_DEPTH = 8, MAX_NODES = 2000000;
  var BAD_KEYS = { "__proto__": 1, "constructor": 1, "prototype": 1 };
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  // SHA-256 over the canonical header + ciphertext, stored in the file as "sum".
  function sumOf(env) {
    var parts = [FORMAT, env.v, env.kind, env.kdf, env.iter, env.salt, env.iv, env.ct];
    if (env.n != null) parts.push("n" + env.n);
    return subtle().digest("SHA-256", enc.encode(parts.join("|"))).then(hex);
  }
  function validateEnvelope(env) {
    var k;
    if (!isObj(env) || env.format !== FORMAT || env.v !== 1 || env.kdf !== "PBKDF2-SHA256" || (env.kind !== "vault" && env.kind !== "share") ||
        typeof env.iter !== "number" || !(env.iter >= MIN_ITER && env.iter <= MAX_ITER) || Math.floor(env.iter) !== env.iter ||
        typeof env.salt !== "string" || typeof env.iv !== "string" || typeof env.ct !== "string" ||
        env.salt.length > 64 || env.iv.length > 64 || env.ct.length > MAX_CT || (env.sum != null && !/^[0-9a-f]{64}$/.test(env.sum)) ||
        !env.salt || !env.iv || !B64.test(env.salt) || !B64.test(env.iv) || !B64.test(env.ct) ||
        (env.n != null && (typeof env.n !== "number" || !(env.n >= 1 && env.n <= 9007199254740991) || Math.floor(env.n) !== env.n))) return "This is not a Stark Family Vault file.";
    for (k in env) if (Object.prototype.hasOwnProperty.call(env, k) && ENV_KEYS.indexOf(k) === -1) return "This is not a Stark Family Vault file.";
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
  function validateVault(v) {
    var k, lists = ["people", "docs", "contacts", "accounts", "inventory", "meds", "policies", "digital", "tasks"], i;
    if (!isObj(v) || v.v !== 1) return "The data inside is not a vault this app understands.";
    for (k in v) if (Object.prototype.hasOwnProperty.call(v, k) && VAULT_KEYS.indexOf(k) === -1) return "The data inside has unexpected fields.";
    for (i = 0; i < lists.length; i++) {
      if (v[lists[i]] != null && (!Array.isArray(v[lists[i]]) || !v[lists[i]].every(isObj))) return "The data inside has the wrong shape.";
    }
    if (v.people && !v.people.every(function (p) { return typeof p.id === "string" && typeof p.name === "string"; })) return "The data inside has the wrong shape.";
    if (v.health != null && !isObj(v.health)) return "The data inside has the wrong shape.";
    if (v.plan != null && !isObj(v.plan)) return "The data inside has the wrong shape.";
    if (v.emergency != null && !isObj(v.emergency)) return "The data inside has the wrong shape.";
    if (v.settings != null && !isObj(v.settings)) return "The data inside has the wrong shape.";
    ["created", "shared", "note"].forEach(function (f) { if (v[f] != null && typeof v[f] !== "string") i = -1; });
    if (i === -1) return "The data inside has the wrong shape.";
    if (!plainOk(v, 0, { n: 0 })) return "The data inside is too large or contains unsafe content.";
    if (!mediaOk(v)) return "The data inside has a scan or photo this app does not accept.";
    return null;
  }
  // Scans, photos and receipts must be real pictures or PDFs (data URLs with an allowed type), never anything a browser could run.
  function mediaUrlOk(m) {
    if (m == null || m === "") return true;
    if (typeof m === "string") return MEDIA_URL.test(m);
    if (!isObj(m) || typeof m.data !== "string" || !MEDIA_URL.test(m.data)) return false;
    return m.mime == null || (typeof m.mime === "string" && MEDIA_MIME.test(m.mime));
  }
  function mediaOk(v) {
    var lists = ["docs", "contacts", "accounts", "inventory", "policies", "meds", "digital", "tasks"], i, j, k, x;
    for (i = 0; i < lists.length; i++) {
      x = v[lists[i]] || [];
      for (j = 0; j < x.length; j++) for (k = 0; k < MEDIA.length; k++) if (!mediaUrlOk(x[j][MEDIA[k]])) return false;
    }
    return true;
  }
  function seal(session, obj) {
    var iv = rand(12), data = enc.encode(JSON.stringify(obj)), n = (session.n || 0) + 1;
    session.n = n;
    return subtle().encrypt({ name: "AES-GCM", iv: iv, additionalData: aad(session.kind, session.iter, session.salt, n) }, session.key, data)
      .then(function (ct) {
        var env = { format: FORMAT, v: 1, kind: session.kind, kdf: "PBKDF2-SHA256", iter: session.iter, salt: session.salt, iv: b64(iv), ct: b64(ct), n: n };
        return sumOf(env).then(function (sum) { env.sum = sum; return env; });
      });
  }
  // Resolves { data, session, legacy, upgraded }. legacy = the file has no checksum (older backups): it is accepted only because it passed strict validation.
  // opts.upgrade: when the file used fewer than KDF_ITER iterations, the session is re-made at KDF_ITER with a fresh salt, so the next save is at full strength.
  function open(env, pass, opts) {
    var bad = new Error("Wrong passphrase, or the file was damaged or changed."), why = validateEnvelope(env);
    if (why) return Promise.reject(new Error(why));
    var bin;
    try { bin = { salt: unb64(env.salt), iv: unb64(env.iv), ct: unb64(env.ct) }; } catch (e) { return Promise.reject(bad); }
    return Promise.resolve().then(function () { return env.sum ? sumOf(env) : null; }).then(function (sum) {
      if (env.sum && sum !== env.sum) throw new Error("Wrong passphrase, or the file was damaged or changed (checksum mismatch). Nothing was changed.");
      return deriveKey(pass, bin.salt, env.iter).then(function (key) {
        return subtle().decrypt({ name: "AES-GCM", iv: bin.iv, additionalData: aad(env.kind, env.iter, env.salt, env.n) }, key, bin.ct)
          .then(function (pt) { return JSON.parse(dec.decode(pt)); }).catch(function () { throw bad; })
          .then(function (data) {
            var r = { data: data, session: { key: key, salt: env.salt, iter: env.iter, kind: env.kind, n: env.n || 0 }, legacy: !env.sum, upgraded: false };
            if (!(opts && opts.upgrade) || env.iter >= KDF_ITER) return r;
            return newSession(pass, env.kind, KDF_ITER).then(function (s) { s.n = r.session.n; r.session = s; r.upgraded = true; return r; });
          });
      });
    });
  }
  // open() plus strict schema validation of the decrypted vault. On a schema failure the error has invalid=true and carries data.
  function openVault(env, pass, opts) {
    return open(env, pass, opts).then(function (r) {
      var w = validateVault(r.data), e;
      if (w) { e = new Error(w + " Nothing was changed."); e.invalid = true; e.data = r.data; throw e; }
      return r;
    });
  }
  function encryptOnce(obj, pass, kind, iter) {
    return newSession(pass, kind, iter).then(function (s) { return seal(s, obj); });
  }

  /* ---- passphrase strength (honest estimate, no network) ---- */
  var COMMON = ["password", "passphrase", "qwerty", "letmein", "welcome", "iloveyou", "admin", "family", "123456", "abc123", "monkey", "dragon", "football", "baseball", "starkvault", "vault"];
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
  /* ---- guessing-time simulator: rough, honest orders of magnitude, no network ----
     Rates are PBKDF2-SHA256 iterations per second for each attacker class, from public benchmark figures for
     2024-era hardware (one high-end graphics card is about 9 billion iterations a second). Real attackers vary. */
  var ATTACKERS = [
    { id: "laptop", label: "A thief with one ordinary computer", rate: 3e8 },
    { id: "gpu", label: "One high-end graphics card", rate: 9e9 },
    { id: "rack", label: "A rented rack of 100 graphics cards", rate: 9e11 },
    { id: "nation", label: "A very well funded attacker (100,000 cards)", rate: 9e14 }];
  var YEAR = 31557600;
  // Average time to guess (half the search space) for `bits` of guessing strength at `iter` iterations per guess.
  function guessSeconds(bits, iter, rate) { return Math.pow(2, Math.max(0, bits) - 1) * Math.max(1, iter) / rate; }
  function durationText(s) {
    if (!(s >= 0) || s < 1) return "under a second";
    var u = [[YEAR * 1e9, "billion years"], [YEAR * 1e6, "million years"], [YEAR * 1000, "thousand years"], [YEAR, "years"], [86400 * 30.44, "months"], [86400, "days"], [3600, "hours"], [60, "minutes"], [1, "seconds"]], i, n;
    if (s > YEAR * 1e12) return "far longer than the age of the universe";
    for (i = 0; i < u.length; i++) if (s >= u[i][0]) { n = s / u[i][0]; return "about " + (n < 10 ? Math.round(n * 10) / 10 : Math.round(n)).toLocaleString("en") + " " + (n < 1.05 && u[i][1].indexOf(" ") === -1 && u[i][1] !== "seconds" ? u[i][1].replace(/s$/, "") : u[i][1]); }
    return "under a second";
  }
  // One row per attacker class: average guessing time with the vault's slow key (iter) and, for contrast, with a single fast hash.
  function guessTable(bits, iter) {
    return ATTACKERS.map(function (a) {
      var slow = guessSeconds(bits, iter || KDF_ITER, a.rate), fast = guessSeconds(bits, 1, a.rate * 2);
      return { id: a.id, label: a.label, seconds: slow, text: durationText(slow), fastSeconds: fast, fastText: durationText(fast) };
    });
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
  function reminders(docs, today, includeOk) {
    var out = [];
    (docs || []).forEach(function (doc) {
      var r = reminderStatus(doc, today);
      if (r.state === "none" || (r.state === "ok" && !includeOk)) return;
      out.push({ id: doc.id, title: doc.title, person: doc.person, expires: doc.expires, state: r.state, days: r.days, remindOn: r.remindOn });
    });
    out.sort(function (a, b) { return a.days - b.days; });
    return out;
  }
  function reminderText(r) {
    if (r.state === "expired") return "Expired " + Math.abs(r.days) + (Math.abs(r.days) === 1 ? " day" : " days") + " ago";
    if (r.days === 0) return "Expires today";
    return "Expires in " + r.days + (r.days === 1 ? " day" : " days");
  }

  /* ---- safety checks for the money section ---- */
  function cleanLast4(s) { return String(s || "").replace(/\D/g, "").slice(-4); }
  function looksSensitive(text) {
    var t = String(text || ""), flags = [];
    if (/\b(?:\d[ -]?){13,19}\b/.test(t)) flags.push("what looks like a full card or account number");
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(t)) flags.push("what looks like a national ID number");
    if (/\b(pass(word|code)?|pwd|pin|cvv|cvc|security code|secret)\b\s*[:=]/i.test(t)) flags.push("what looks like a password or PIN");
    return flags;
  }

  /* ---- vault shape and sharing ---- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function emptyVault(name) {
    var id = uid();
    return { v: 1, created: todayStr(), settings: { lockMin: 5, lastBackup: null },
      people: [{ id: id, name: name || "Me", rel: "Self", dob: "" }],
      docs: [], health: {}, contacts: [], accounts: [], plan: {}, inventory: [], meds: [], policies: [], digital: [], tasks: [], emergency: {} };
  }
  var SECTIONS = ["docs", "health", "contacts", "accounts", "plan", "inventory", "meds", "policies", "digital", "tasks", "emergency"];
  // Every field that can hold a scan, photo or receipt. Share files leave them out unless the sender ticks "include scans and photos".
  var MEDIA = ["scan", "photo", "photo2", "photo3", "receipt"];
  function stripMedia(x) { MEDIA.forEach(function (k) { if (x[k]) x[k] = null; }); return x; }
  function subset(vault, opts) {
    var people = vault.people.filter(function (p) { return opts.people.indexOf(p.id) !== -1; }), ids = people.map(function (p) { return p.id; });
    var out = { v: 1, shared: todayStr(), note: opts.note || "", people: clone(people), docs: [], health: {}, contacts: [], accounts: [], plan: {}, inventory: [],
      meds: [], policies: [], digital: [], tasks: [], emergency: {}, settings: { lockMin: 5 } };
    var s = opts.sections || [], has = function (k) { return s.indexOf(k) !== -1; }, mine = function (pid) { return ids.indexOf(pid) !== -1; },
      house = function (pid) { return !pid || pid === "household" || mine(pid); }, media = function (x) { return opts.scans ? x : stripMedia(x); };
    if (has("docs")) out.docs = (vault.docs || []).filter(function (d) { return mine(d.person); }).map(clone).map(media);
    if (has("health")) ids.forEach(function (i) { if (vault.health[i]) out.health[i] = clone(vault.health[i]); });
    if (has("plan")) { ids.forEach(function (i) { if (vault.plan[i]) out.plan[i] = clone(vault.plan[i]); }); out.settings.juris = clone((vault.settings || {}).juris || []); }
    ["contacts", "accounts", "inventory"].forEach(function (k) { if (has(k)) out[k] = clone(vault[k] || []).map(media); });
    if (has("meds")) out.meds = clone((vault.meds || []).filter(function (m) { return mine(m.person); }));
    if (has("policies")) out.policies = clone((vault.policies || []).filter(function (p) { return house(p.person); })).map(media);
    if (has("tasks")) out.tasks = clone((vault.tasks || []).filter(function (t) { return house(t.person); }));
    if (has("digital")) out.digital = clone((vault.digital || []).filter(function (d) { return mine(d.person); })).map(function (d) { if (!opts.hints) d.hint = ""; return d; });
    if (has("emergency")) out.emergency = clone(vault.emergency || {});
    return out;
  }
  function exportShare(vault, opts, pass, iter) { return encryptOnce(subset(vault, opts), pass, "share", iter); }
  function exportBackup(vault, pass, iter) { return encryptOnce(vault, pass, "vault", iter); }
  // Merge shared data into a vault. Everything gets fresh ids; people are matched by name or added.
  function mergeInto(vault, shared) {
    var map = {}, added = { people: 0, docs: 0, contacts: 0, accounts: 0, inventory: 0, health: 0, meds: 0, policies: 0, digital: 0, tasks: 0 };
    ["docs", "contacts", "accounts", "inventory", "meds", "policies", "digital", "tasks"].forEach(function (k) { if (!Array.isArray(vault[k])) vault[k] = []; });
    ["health", "plan"].forEach(function (k) { if (!isObj(vault[k])) vault[k] = {}; });
    (shared.people || []).forEach(function (p) {
      var hit = vault.people.filter(function (q) { return q.name.toLowerCase() === p.name.toLowerCase(); })[0];
      if (!hit) { hit = clone(p); hit.id = uid(); vault.people.push(hit); added.people++; }
      map[p.id] = hit.id;
    });
    (shared.docs || []).forEach(function (d) { var c = clone(d); c.id = uid(); c.person = map[d.person] || vault.people[0].id; vault.docs.push(c); added.docs++; });
    ["contacts", "accounts", "inventory"].forEach(function (k) {
      (shared[k] || []).forEach(function (x) { var c = clone(x); c.id = uid(); vault[k].push(c); added[k]++; });
    });
    // Person-linked records keep their person when matched; household records (no person) stay household.
    ["meds", "digital"].forEach(function (k) {
      (shared[k] || []).forEach(function (x) { var c = clone(x); c.id = uid(); c.person = map[x.person] || vault.people[0].id; vault[k].push(c); added[k]++; });
    });
    ["policies", "tasks"].forEach(function (k) {
      (shared[k] || []).forEach(function (x) { var c = clone(x); c.id = uid(); c.person = map[x.person] || (x.person === "household" ? "household" : ""); vault[k].push(c); added[k]++; });
    });
    Object.keys(shared.health || {}).forEach(function (pid) { if (map[pid] && !vault.health[map[pid]]) { vault.health[map[pid]] = clone(shared.health[pid]); added.health++; } });
    Object.keys(shared.plan || {}).forEach(function (pid) { if (map[pid] && !vault.plan[map[pid]]) vault.plan[map[pid]] = clone(shared.plan[pid]); });
    if (shared.emergency && Object.keys(shared.emergency).length && (!vault.emergency || !Object.keys(vault.emergency).length)) vault.emergency = clone(shared.emergency);
    return added;
  }

  var api = { VERSION: VERSION, MEDIA: MEDIA, stripMedia: stripMedia, KDF_ITER: KDF_ITER, MIN_ITER: MIN_ITER, MAX_ITER: MAX_ITER, FORMAT: FORMAT,
    guessSeconds: guessSeconds, guessTable: guessTable, durationText: durationText, ATTACKERS: ATTACKERS, mediaUrlOk: mediaUrlOk, b64: b64, unb64: unb64, uid: uid, newSession: newSession, checkPass: checkPass, seal: seal, open: open, openVault: openVault,
    encryptOnce: encryptOnce, strength: strength, dayNum: dayNum, todayStr: todayStr, daysUntil: daysUntil, addYears: addYears, addDays: addDays,
    reminderStatus: reminderStatus, reminders: reminders, reminderText: reminderText, cleanLast4: cleanLast4, looksSensitive: looksSensitive,
    emptyVault: emptyVault, SECTIONS: SECTIONS, subset: subset, exportShare: exportShare, exportBackup: exportBackup, mergeInto: mergeInto, validateEnvelope: validateEnvelope, validateVault: validateVault, sumOf: sumOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.StarkVault = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
