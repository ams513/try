/* Stark Fellowship, by Stark: encryption, key ring, roles, dates (no DOM, no network).
   Encryption adapted from Stark Family Vault: PBKDF2-SHA256 (600,000 rounds) to AES-256-GCM via standard WebCrypto.
   The book is split into six parts, each sealed with its own random key. Each user holds wrapped copies of only
   the part keys their role allows, so a role that may not read care notes cannot decrypt them at all. */
(function (root) {
  "use strict";
  var VERSION = "1.3.0", KDF_ITER = 600000, MIN_ITER = 300000, MAX_ITER = 2000000, FORMAT = "StarkFellowship";
  var PUBLIC_PASSES = ["example only: river stones lantern"]; // the example community's published passphrase
  var PARTS = ["core", "contact", "giving", "care", "notes", "help"];
  var enc = new TextEncoder(), dec = new TextDecoder();
  function subtle() { return root.crypto.subtle; }

  /* ---- roles: which part keys a role receives, and which screens it may use ---- */
  var ROLES = {
    leader: { label: "Leader", parts: PARTS, areas: ["people", "edit", "teams", "groups", "checkin", "giving", "care", "help", "users", "settings"],
      desc: "Everything, including private care notes. Adds and removes users." },
    admin: { label: "Administrator", parts: ["core", "contact", "giving", "care", "help"], areas: ["people", "edit", "teams", "groups", "checkin", "giving", "care", "help", "users", "settings"],
      desc: "Everything except private care notes. Adds and removes users." },
    care: { label: "Care team", parts: ["core", "contact", "care", "notes", "help"], areas: ["people", "edit", "groups", "checkin", "care", "help"],
      desc: "Directory, care visits with private notes, and help requests." },
    finance: { label: "Treasurer", parts: ["core", "contact", "giving"], areas: ["people", "giving"],
      desc: "Directory, giving records, books and year-end statements." },
    teams: { label: "Team coordinator", parts: ["core", "contact"], areas: ["people", "teams", "groups", "checkin"],
      desc: "Directory, teams and rotas, gatherings and check-in." },
    checkin: { label: "Check-in helper", parts: ["core"], areas: ["checkin"],
      desc: "Check-in only. Sees names and households, never contact details." }
  };
  var AREA_PART = { people: "core", edit: "core", teams: "core", groups: "core", checkin: "core", giving: "giving", care: "care", help: "help", users: "core", settings: "core" };

  function b64(buf) {
    var b = new Uint8Array(buf), s = "", i;
    for (i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(str) { var s = atob(str), out = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
  function rand(n) { return root.crypto.getRandomValues(new Uint8Array(n)); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function uid() { return hex(rand(8)); }

  function deriveKek(pass, salt, iter) {
    return subtle().importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return subtle().deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  function partKey(raw) { return subtle().importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]); }
  function gcm(key, bytes, aad) {
    var iv = rand(12);
    return subtle().encrypt({ name: "AES-GCM", iv: iv, additionalData: aad }, key, bytes).then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }
  function ungcm(key, box, aad) { return subtle().decrypt({ name: "AES-GCM", iv: unb64(box.iv), additionalData: aad }, key, unb64(box.ct)).then(function (pt) { return new Uint8Array(pt); }); }
  // Additional data binds every box to its book, part and (for key wraps) the user's id, role and salt,
  // so swapping boxes between parts or editing a stored role makes decryption fail.
  function partAad(book, part) { return enc.encode(FORMAT + "|part|1|" + book + "|" + part); }
  function wrapAad(book, u, part) { return enc.encode(FORMAT + "|wrap|1|" + book + "|" + u.id + "|" + u.role + "|" + u.iter + "|" + u.salt + "|" + part); }
  // Format 2 users (1.1 and later) own an ECDH P-256 key pair. The private key is wrapped by the passphrase key;
  // part keys are wrapped to the public key with a fresh ephemeral key each time, so a manager can hand new
  // part keys to every remaining user (key rotation) without knowing anyone's passphrase.
  function skAad(book, u) { return enc.encode(FORMAT + "|sk|2|" + book + "|" + u.id + "|" + u.iter + "|" + u.salt + "|" + u.pub); }
  function ewrapAad(book, u, part) { return enc.encode(FORMAT + "|wrap|2|" + book + "|" + u.id + "|" + u.role + "|" + u.pub + "|" + part); }
  var EC = { name: "ECDH", namedCurve: "P-256" };
  function hkdf(bits, info, alg, uses) {
    return subtle().importKey("raw", bits, "HKDF", false, ["deriveKey"]).then(function (base) {
      return subtle().deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: info }, base, alg, false, uses);
    });
  }
  function ecShared(priv, pubRaw, info) {
    return subtle().importKey("raw", pubRaw, EC, false, []).then(function (pub) { return subtle().deriveBits({ name: "ECDH", public: pub }, priv, 256); })
      .then(function (bits) { return hkdf(bits, info, { name: "AES-GCM", length: 256 }, ["encrypt", "decrypt"]); });
  }
  function wrapTo(book, u, part, raw) {
    var aad = ewrapAad(book, u, part), eph;
    return subtle().generateKey(EC, true, ["deriveBits"]).then(function (kp) { eph = kp; return subtle().exportKey("raw", kp.publicKey); }).then(function (epk) {
      return ecShared(eph.privateKey, unb64(u.pub), aad).then(function (k) { return gcm(k, raw, aad); }).then(function (box) { box.epk = b64(epk); return box; });
    });
  }
  function unwrapFrom(priv, book, u, part, box) {
    var aad = ewrapAad(book, u, part);
    return ecShared(priv, unb64(box.epk), aad).then(function (k) { return ungcm(k, box, aad); });
  }
  function clampIter(n) { n = typeof n === "number" && Math.floor(n) === n ? n : KDF_ITER; return Math.min(MAX_ITER, Math.max(MIN_ITER, n)); }

  /* ---- strict validation of the stored file and of decrypted parts ---- */
  var FILE_KEYS = ["format", "v", "id", "created", "name", "demo", "users", "parts", "gen", "mac"], USER_KEYS = ["id", "name", "role", "iter", "salt", "pub", "sk", "keys"];
  var MAX_CT = 120 * 1024 * 1024, MAX_ITEMS = 60000, MAX_STR = 200000, MAX_DEPTH = 9, MAX_NODES = 3000000;
  var BAD_KEYS = { "__proto__": 1, "constructor": 1, "prototype": 1 };
  var B64 = /^[A-Za-z0-9+/]*={0,2}$/, IV = /^[A-Za-z0-9+/]{16}$/, PUB = /^[A-Za-z0-9+/]{86}[AEIMQUYcgkosw048]=$/, MAC = /^[A-Za-z0-9+/]{43}=$/;
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function boxOk(b, epk) {
    return isObj(b) && typeof b.iv === "string" && IV.test(b.iv) && typeof b.ct === "string" && b.ct.length <= MAX_CT && b.ct.length % 4 === 0 && B64.test(b.ct) &&
      (epk ? typeof b.epk === "string" && PUB.test(b.epk) : !own(b, "epk")) && Object.keys(b).length === (epk ? 3 : 2);
  }
  function userOk(u) {
    var k, v2;
    if (!isObj(u) || typeof u.id !== "string" || !/^[0-9a-f]{16}$/.test(u.id) || typeof u.name !== "string" || u.name.length > 80 || !own(ROLES, u.role) ||
        typeof u.iter !== "number" || u.iter < MIN_ITER || u.iter > MAX_ITER || Math.floor(u.iter) !== u.iter || typeof u.salt !== "string" || u.salt.length !== 24 || !B64.test(u.salt) || !isObj(u.keys)) return false;
    for (k in u) if (own(u, k) && USER_KEYS.indexOf(k) < 0) return false;
    v2 = own(u, "pub");
    if (v2 !== own(u, "sk") || (v2 && (typeof u.pub !== "string" || !PUB.test(u.pub) || !boxOk(u.sk)))) return false;
    for (k in u.keys) if (own(u.keys, k) && (PARTS.indexOf(k) < 0 || !boxOk(u.keys[k], v2))) return false;
    return true;
  }
  // Checks a stored or imported file before anything else touches it: exact keys, sizes, types and a capped key-derivation cost
  // (a file asking for more than 2,000,000 rounds is refused, so a crafted backup cannot freeze the tab).
  function validateFile(f) {
    var bad = "This is not a Stark Fellowship file.", k, i, ids = {};
    if (!isObj(f) || f.format !== FORMAT || (f.v !== 1 && f.v !== 2) || typeof f.id !== "string" || !/^[0-9a-f]{16}$/.test(f.id) || typeof f.name !== "string" || f.name.length > 120) return bad;
    for (k in f) if (own(f, k) && FILE_KEYS.indexOf(k) < 0) return bad;
    if (own(f, "created") && (typeof f.created !== "string" || f.created.length > 10)) return bad;
    if (own(f, "demo") && f.demo !== true) return bad;
    if (f.v === 2 ? typeof f.gen !== "number" || Math.floor(f.gen) !== f.gen || f.gen < 1 || f.gen > 1e12 || typeof f.mac !== "string" || !MAC.test(f.mac) : own(f, "gen") || own(f, "mac")) return bad;
    if (!Array.isArray(f.users) || !f.users.length || f.users.length > 200 || !isObj(f.parts)) return bad;
    for (k in f.parts) if (own(f.parts, k) && (PARTS.indexOf(k) < 0 || !boxOk(f.parts[k]))) return bad;
    if (!f.parts.core) return bad;
    for (i = 0; i < f.users.length; i++) { if (!userOk(f.users[i]) || ids[f.users[i].id]) return bad; ids[f.users[i].id] = 1; }
    // A 1.0 file never holds key-pair users: refusing them stops a sealed book being relabelled as 1.0 to skip its seal.
    if (f.v === 1 && f.users.some(function (u) { return own(u, "pub"); })) return bad;
    return null;
  }

  /* ---- seal over the user list and every box, with a generation counter (format 2) ---- */
  // HMAC-SHA256 under a key derived from the core part key. Anyone without a core key cannot add, remove or reorder users,
  // change a role or name, or swap in an older box. The generation goes up on every save so an older copy can be recognised.
  function macKey(book, coreRaw) { return hkdf(coreRaw, enc.encode(FORMAT + "|mac|2|" + book), { name: "HMAC", hash: "SHA-256", length: 256 }, ["sign", "verify"]); }
  function sealInput(f) {
    return enc.encode(JSON.stringify([FORMAT, 2, f.id, f.gen, f.created || "", f.name, !!f.demo,
      f.users.map(function (u) { return [u.id, u.name, u.role, u.iter, u.salt, u.pub || "", u.sk ? u.sk.iv : "", Object.keys(u.keys).sort().map(function (k) { return [k, u.keys[k].iv, u.keys[k].epk || ""]; })]; }),
      Object.keys(f.parts).sort().map(function (p) { return [p, f.parts[p].iv]; })]));
  }
  function stamp(session, file) {
    if (!session.raws.core) return Promise.reject(new Error("No core key."));
    file.v = 2; file.gen = (typeof file.gen === "number" ? file.gen : 0) + 1;
    return macKey(file.id, session.raws.core).then(function (k) { return subtle().sign("HMAC", k, sealInput(file)); }).then(function (sig) { file.mac = b64(sig); return file; });
  }
  function verifySeal(coreRaw, file) {
    if (file.v !== 2) return Promise.resolve(false);
    return macKey(file.id, coreRaw).then(function (k) { return subtle().verify("HMAC", k, unb64(file.mac), sealInput(file)); }).then(function (ok) {
      if (!ok) throw new Error("The stored records do not match their seal: the user list or an encrypted part was changed outside Stark Fellowship. Nothing was opened. Restore a backup file.");
      return true;
    });
  }
  function plainOk(x, depth, st) {
    var k, i, t = typeof x;
    if (++st.n > MAX_NODES || depth > MAX_DEPTH) return false;
    if (x === null || t === "boolean") return true;
    if (t === "number") return isFinite(x);
    if (t === "string") return x.length <= MAX_STR;
    if (Array.isArray(x)) { if (x.length > MAX_ITEMS) return false; for (i = 0; i < x.length; i++) if (!plainOk(x[i], depth + 1, st)) return false; return true; }
    if (isObj(x)) { for (k in x) { if (!own(x, k)) continue; if (BAD_KEYS[k] || k.length > 200 || !plainOk(x[k], depth + 1, st)) return false; } return true; }
    return false;
  }
  // Expected shape of each decrypted part: lists must be arrays of records, maps must be objects.
  var SHAPES = {
    core: { arr: ["households", "people", "teams", "slots", "events", "log"], obj: ["settings", "away"], opt: ["groups"] },   // groups (1.3): absent in older books, a list of records when present
    contact: { obj: ["hh", "people"] },
    giving: { arr: ["accounts", "funds", "entries", "gifts"] },
    care: { arr: ["visits"] }, notes: { obj: ["byVisit"] }, help: { arr: ["requests"] }
  };
  function validatePart(name, d) {
    var s = SHAPES[name], bad = false;
    if (!s || !isObj(d) || d.v !== 1) return "The " + name + " data is not in a shape this app understands.";
    (s.arr || []).forEach(function (k) { if (!Array.isArray(d[k]) || !d[k].every(isObj)) bad = true; });
    (s.obj || []).forEach(function (k) { if (!isObj(d[k])) bad = true; });
    (s.opt || []).forEach(function (k) { if (own(d, k) && (!Array.isArray(d[k]) || !d[k].every(isObj))) bad = true; });
    if (bad) return "The " + name + " data has the wrong shape.";
    if (!plainOk(d, 0, { n: 0 })) return "The " + name + " data is too large or contains unsafe content.";
    return null;
  }

  /* ---- key ring ---- */
  // A session keeps raw part keys (never passphrases) so it can seal parts and grant keys to new users.
  // iter is clamped to 300,000..2,000,000 (600,000 by default); sign-in upgrades anything below 600,000.
  function makeUser(session, name, role, pass, iter, keepId) {
    var r = ROLES[role], u, salt = rand(16), missing;
    if (!r) return Promise.reject(new Error("Unknown role."));
    missing = r.parts.filter(function (p) { return !session.raws[p]; });
    if (missing.length) return Promise.reject(new Error("You cannot give access you do not have (" + missing.join(", ") + ")."));
    u = { id: keepId || uid(), name: String(name || "").trim().slice(0, 80), role: role, iter: clampIter(iter), salt: b64(salt), pub: "", sk: null, keys: {} };
    if (!u.name) return Promise.reject(new Error("Enter a name."));
    return subtle().generateKey(EC, true, ["deriveBits"]).then(function (kp) {
      return Promise.all([subtle().exportKey("raw", kp.publicKey), subtle().exportKey("pkcs8", kp.privateKey), deriveKek(pass, salt, u.iter)]);
    }).then(function (x) {
      u.pub = b64(x[0]);
      return gcm(x[2], new Uint8Array(x[1]), skAad(session.book, u));
    }).then(function (box) {
      u.sk = box;
      return Promise.all(r.parts.map(function (p) { return wrapTo(session.book, u, p, session.raws[p]).then(function (b) { u.keys[p] = b; }); }));
    }).then(function () { return u; });
  }
  // Re-key an existing user (new passphrase and/or new role). Keeps the user's id. Older, weaker iteration counts are raised.
  function rekeyUser(session, user, pass, role, iter) { return makeUser(session, user.name, role || user.role, pass, Math.max(iter || user.iter, KDF_ITER), user.id); }
  // Unlocks one user's private key (format 2) or returns null for a format 1 user. Rejects on a wrong passphrase.
  function userPriv(bookId, u, kek) {
    if (!u.sk) return Promise.resolve(null);
    return ungcm(kek, u.sk, skAad(bookId, u)).then(function (pk8) { return subtle().importKey("pkcs8", pk8, EC, false, ["deriveBits"]); });
  }
  function needsReset(u) { return !u.keys.core; }
  function isLegacy(u) { return !u.pub; }
  // Key rotation: fresh random keys for `parts`, those parts re-sealed, and the new keys wrapped for every remaining user whose
  // role reads them. Run after removing a user or lowering a role, so a copy of the old file or an old passphrase opens nothing new.
  // Format 1 users who held a rotated key cannot be re-wrapped without their passphrase: their keys are cleared and they need a new passphrase.
  function rotate(session, file, data, parts) {
    var miss, fresh = {}, tmp = { book: file.id, keys: {} }, boxes = {}, wraps = [], lost = [];
    parts = PARTS.filter(function (p) { return parts.indexOf(p) >= 0 && file.parts[p]; });
    miss = parts.filter(function (p) { return !session.raws[p] || !data[p]; });
    if (miss.length) return Promise.reject(new Error("You cannot change keys you do not hold (" + miss.join(", ") + ")."));
    if (isLegacy(session.user)) return Promise.reject(new Error("Sign out and in again first, so your own keys are upgraded."));
    parts.forEach(function (p) { fresh[p] = rand(32); });
    return Promise.all(parts.map(function (p) { return partKey(fresh[p]).then(function (k) { tmp.keys[p] = k; }); })).then(function () {
      return Promise.all(parts.map(function (p) { return sealPart(tmp, p, data[p]).then(function (b) { boxes[p] = b; }); }));
    }).then(function () {
      return Promise.all(file.users.filter(function (u) { return !isLegacy(u); }).map(function (u) {
        var nk = {};
        Object.keys(u.keys).forEach(function (p) { if (parts.indexOf(p) < 0) nk[p] = u.keys[p]; });
        return Promise.all(parts.filter(function (p) { return ROLES[u.role].parts.indexOf(p) >= 0; }).map(function (p) {
          return wrapTo(file.id, u, p, fresh[p]).then(function (b) { nk[p] = b; });
        })).then(function () { wraps.push([u, nk]); });
      }));
    }).then(function () {
      // commit only once everything succeeded, so a failure leaves the book exactly as it was
      parts.forEach(function (p) { session.raws[p] = fresh[p]; session.keys[p] = tmp.keys[p]; file.parts[p] = boxes[p]; });
      wraps.forEach(function (w) { w[0].keys = w[1]; });
      file.users.forEach(function (u) { if (isLegacy(u) && parts.some(function (p) { return u.keys[p]; })) { u.keys = {}; lost.push(u.name); } });
      return { rotated: parts, lost: lost };
    });
  }
  function sealPart(session, name, data) {
    if (!session.keys[name]) return Promise.reject(new Error("No key for " + name));
    return gcm(session.keys[name], enc.encode(JSON.stringify(data)), partAad(session.book, name));
  }
  function openPart(key, book, name, box) {
    return ungcm(key, box, partAad(book, name)).then(function (pt) {
      var d = JSON.parse(dec.decode(pt)), why = validatePart(name, d);
      if (why) throw new Error(why + " Nothing was changed.");
      return d;
    });
  }
  function withKeys(session) {
    return Promise.all(Object.keys(session.raws).map(function (p) { return partKey(session.raws[p]).then(function (k) { session.keys[p] = k; }); })).then(function () { return session; });
  }
  // New book: the first user is a Leader and holds every part key.
  function createBook(o) {
    var file = { format: FORMAT, v: 1, id: uid(), created: todayStr(), name: String(o.name || "Our community").trim().slice(0, 120), users: [], parts: {} };
    var session = { book: file.id, raws: {}, keys: {}, user: null };
    if (o.demo) file.demo = true;
    if (PUBLIC_PASSES.indexOf(o.pass) >= 0 && !o.demo) return Promise.reject(new Error("That is the example community's published passphrase. Choose your own."));
    PARTS.forEach(function (p) { session.raws[p] = rand(32); });
    return withKeys(session).then(function () { return makeUser(session, o.leader, "leader", o.pass, o.iter); }).then(function (u) {
      file.users.push(u); session.user = u;
      return sealAll(session, file, o.data);
    }).then(function () { return stamp(session, file); }).then(function () { return { file: file, session: session }; });
  }
  function sealAll(session, file, data) {
    return Promise.all(Object.keys(session.keys).map(function (p) { return sealPart(session, p, data[p]).then(function (box) { file.parts[p] = box; }); }));
  }
  // Sign in: unwrap this user's part keys, check the seal over the user list, then open those parts. Parts the role lacks stay sealed.
  // session.upgrade is true when this user's keys should be re-made now (format 1, or fewer than 600,000 rounds).
  function signIn(file, userId, pass) {
    var u = (file.users || []).filter(function (x) { return x.id === userId; })[0], bad = new Error("Wrong passphrase for this user.");
    if (!u) return Promise.reject(new Error("No such user."));
    if (needsReset(u)) return Promise.reject(new Error("This user needs a new passphrase from a Leader or Administrator, because the keys were changed after someone was removed."));
    var session = { book: file.id, raws: {}, keys: {}, user: u }, data = {};
    return deriveKek(pass, unb64(u.salt), u.iter).then(function (kek) {
      return userPriv(file.id, u, kek).then(function (priv) {
        return Promise.all(Object.keys(u.keys).map(function (p) {
          return (priv ? unwrapFrom(priv, file.id, u, p, u.keys[p]) : ungcm(kek, u.keys[p], wrapAad(file.id, u, p))).then(function (raw) { session.raws[p] = raw; });
        }));
      }).catch(function () { throw bad; });
    }).then(function () { return verifySeal(session.raws.core, file); }).then(function (sealed) {
      session.sealed = sealed; session.upgrade = isLegacy(u) || u.iter < KDF_ITER;
      return withKeys(session);
    }).then(function () {
      return Promise.all(Object.keys(session.keys).filter(function (p) { return file.parts[p]; }).map(function (p) {
        return openPart(session.keys[p], file.id, p, file.parts[p]).then(function (d) { data[p] = d; });
      }));
    }).then(function () { return { session: session, data: data }; });
  }
  function checkPass(file, user, pass) {
    return deriveKek(pass, unb64(user.salt), user.iter).then(function (kek) {
      return user.sk ? ungcm(kek, user.sk, skAad(file.id, user)) : ungcm(kek, user.keys.core, wrapAad(file.id, user, "core"));
    }).then(function () { return true; }, function () { return false; });
  }
  // A plain summary for the security check-up screen: nothing secret, only what the stored file says.
  function securityReport(file, hw) {
    var users = file.users.map(function (u) { return { id: u.id, name: u.name, role: u.role, legacy: isLegacy(u), reset: needsReset(u), weak: u.iter < KDF_ITER }; });
    return { format: file.v, gen: file.gen || 0, sealed: file.v === 2, older: typeof hw === "number" && (file.gen || 0) < hw, lastSeen: hw || 0, users: users,
      legacy: users.filter(function (u) { return u.legacy && !u.reset; }).length, reset: users.filter(function (u) { return u.reset; }).length,
      leaders: users.filter(function (u) { return u.role === "leader" && !u.reset; }).length };
  }
  function holds(session, part) { return !!(session && session.keys[part]); }
  function can(session, area) {
    if (!session || !session.user) return false;
    var r = ROLES[session.user.role];
    return !!r && r.areas.indexOf(area) >= 0 && holds(session, AREA_PART[area] || "core");
  }

  /* ---- passphrase strength (honest estimate, no network), from Stark Family Vault ---- */
  var COMMON = ["password", "passphrase", "qwerty", "letmein", "welcome", "iloveyou", "admin", "123456", "abc123", "monkey", "dragon", "football", "community", "fellowship", "stark", "church", "member"];
  function strength(p) {
    p = p || "";
    var pool = 0, bits, lower = p.toLowerCase(), i, score, notes = [], uniq = {};
    if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/[0-9]/.test(p)) pool += 10; if (/[^A-Za-z0-9 ]/.test(p)) pool += 32; if (/ /.test(p)) pool += 1;
    for (i = 0; i < p.length; i++) uniq[p[i]] = 1;
    bits = pool ? Math.log2(pool) * Math.min(p.length, Object.keys(uniq).length * 2.5) : 0;
    if (/(.)\1{2,}/.test(p)) { bits -= 6; notes.push("repeated characters"); }
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf)/i.test(p)) { bits -= 8; notes.push("an easy sequence"); }
    for (i = 0; i < COMMON.length; i++) if (lower.indexOf(COMMON[i]) !== -1) { bits -= 14; notes.push("a very common word"); break; }
    if (p.length < 12) notes.push("shorter than 12 characters");
    bits = Math.max(0, Math.round(bits));
    score = bits < 28 ? 0 : bits < 45 ? 1 : bits < 62 ? 2 : bits < 80 ? 3 : 4;
    if (p.length < 8) score = 0;
    return { score: score, label: ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score], bits: bits, notes: notes };
  }
  function passProblem(p, again) {
    if ((p || "").length < 10) return "Use at least 10 characters. A few unrelated words is best.";
    if (PUBLIC_PASSES.indexOf(p) >= 0) return "That is the example community's published passphrase. Choose your own.";
    if (strength(p).score < 2) return "That passphrase is too easy to guess. Try four or more unrelated words.";
    if (again != null && p !== again) return "The two passphrases do not match.";
    return null;
  }

  /* ---- dates: whole days on YYYY-MM-DD strings (no time zone drift) ---- */
  function pad(n) { return ("0" + n).slice(-2); }
  function dayNum(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""), y, mo, d, t, c;
    if (!m) return NaN;
    y = +m[1]; mo = +m[2]; d = +m[3]; t = Date.UTC(y, mo - 1, d); c = new Date(t);
    if (c.getUTCFullYear() !== y || c.getUTCMonth() !== mo - 1 || c.getUTCDate() !== d) return NaN;
    return Math.round(t / 86400000);
  }
  function fromDay(n) { var d = new Date(n * 86400000); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function todayStr(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(date, n) { var t = dayNum(date); return isNaN(t) ? null : fromDay(t + n); }
  function isDate(s) { return !isNaN(dayNum(s)); }
  function weekday(date) { var t = dayNum(date); return isNaN(t) ? "" : ["Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"][((t % 7) + 7) % 7]; }
  function hm(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(s || ""); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; }

  var api = { VERSION: VERSION, FORMAT: FORMAT, KDF_ITER: KDF_ITER, MIN_ITER: MIN_ITER, MAX_ITER: MAX_ITER, PARTS: PARTS, ROLES: ROLES, b64: b64, unb64: unb64, uid: uid, hex: hex,
    validateFile: validateFile, validatePart: validatePart, createBook: createBook, makeUser: makeUser, rekeyUser: rekeyUser, sealPart: sealPart, sealAll: sealAll,
    signIn: signIn, checkPass: checkPass, holds: holds, can: can, strength: strength, passProblem: passProblem,
    stamp: stamp, verifySeal: verifySeal, rotate: rotate, needsReset: needsReset, isLegacy: isLegacy, securityReport: securityReport, clampIter: clampIter,
    dayNum: dayNum, fromDay: fromDay, todayStr: todayStr, addDays: addDays, isDate: isDate, weekday: weekday, hm: hm, pad: pad };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.StarkCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
