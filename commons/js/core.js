/* Stark Commons, by Stark. Core rules: schema, quality gates, personal-data scrubber, signed packs, merge.
   Pure functions, no DOM, no network. Runs in the browser (window.SC) and in Node (require). */
(function (root) {
  'use strict';
  var subtle = (root.crypto && root.crypto.subtle) || null;
  if (!subtle && typeof require === 'function') { try { subtle = require('node:crypto').webcrypto.subtle; } catch (e) { subtle = null; } }

  var EVIDENCE = ['anecdote', 'observational', 'trial', 'review'];
  var EVIDENCE_RANK = { anecdote: 0, observational: 1, trial: 2, review: 3 };
  var TOPICS = ['medicine', 'nutrition', 'public health', 'safety', 'education', 'other'];
  var HEALTH_TOPICS = ['medicine', 'nutrition', 'public health'];
  var LICENSE = 'CC-BY-4.0';
  var PACK_FORMAT = 'stark-commons-pack', BUNDLE_FORMAT = 'stark-commons-bundle';
  var ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
  function badKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }
  function safeId(id) { return typeof id === 'string' && ID_RE.test(id) && !badKey(id); }
  var MAX_NOTEBOOK = 5000, MAX_PACK_ENTRIES = 500, MAX_FILE_BYTES = 20e6;
  var DISCLAIMER = 'Research notes only. Not medical advice. Do not use this to diagnose, treat or delay care; talk to a qualified clinician.';
  var HEALTH_WORDS = /\b(cure[sd]?|treat(s|ed|ment)?|therap(y|ies)|dose[sd]?|dosage|mg|symptoms?|disease|infection|vaccin\w*|cancer|diabet\w*|blood pressure|supplements?|vitamin\w*|medication|drug|clinical|diagnos\w*|prevent(s|ion)?)\b/i;

  /* ---------- helpers ---------- */
  function str(v) { return typeof v === 'string' ? v : ''; }
  function norm(s) { return str(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  /* Canonical JSON: sorted keys, undefined dropped. Non-finite numbers are refused (they have no JSON form). */
  function canon(v) {
    if (typeof v === 'number' && !isFinite(v)) throw new Error('non-finite number');
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return (root.btoa || function (x) { return Buffer.from(x, 'binary').toString('base64'); })(s); }
  function unb64(t) { var s = (root.atob || function (x) { return Buffer.from(x, 'base64').toString('binary'); })(t), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function utf8(s) { return new TextEncoder().encode(s); }
  async function sha256(s) { return hex(await subtle.digest('SHA-256', utf8(s))); }
  function uid() { var a = new Uint8Array(8); (root.crypto || require('node:crypto').webcrypto).getRandomValues(a); return 'e' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

  /* ---------- entries ---------- */
  function newEntry() {
    var now = new Date().toISOString();
    return { id: uid(), title: '', question: '', findings: '', method: '', sources: [], evidence: '', topic: 'other', tags: [],
      ai: { used: false, tool: '' }, links: [], healthClaim: false, disclaimer: false, created: now, updated: now };
  }
  var DOI_RE = /^10\.\d{4,9}\/\S+$/i;
  function cleanDoi(d) { return str(d).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, ''); }
  function validUrl(u) { return /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(str(u).trim()); }
  function sourceOk(s) { return !!s && str(s.citation).trim().length >= 3 && (DOI_RE.test(cleanDoi(s.doi)) || validUrl(s.url)); }
  function isHealth(e) {
    return !!e.healthClaim || HEALTH_TOPICS.indexOf(e.topic) >= 0 ||
      HEALTH_WORDS.test([e.title, e.question, e.findings].map(str).join(' '));
  }

  /* Schema: structural errors only (types, enums, sizes). */
  function validateEntry(e) {
    var err = [];
    if (!e || typeof e !== 'object') return ['entry is not an object'];
    ['id', 'title', 'question', 'findings', 'method'].forEach(function (k) { if (typeof e[k] !== 'string') err.push(k + ' must be text'); });
    if (typeof e.title === 'string' && (e.title.trim().length < 3 || e.title.length > 200)) err.push('title must be 3-200 characters');
    if (typeof e.findings === 'string' && (e.findings.trim().length < 10 || e.findings.length > 20000)) err.push('findings must be 10-20000 characters');
    if (typeof e.question === 'string' && e.question.length > 2000) err.push('question too long');
    if (typeof e.method === 'string' && e.method.length > 10000) err.push('method too long');
    if (EVIDENCE.indexOf(e.evidence) < 0) err.push('evidence level must be one of ' + EVIDENCE.join(', '));
    if (TOPICS.indexOf(e.topic) < 0) err.push('topic must be one of ' + TOPICS.join(', '));
    if (!Array.isArray(e.tags) || e.tags.some(function (t) { return typeof t !== 'string' || t.length > 40; }) || (e.tags || []).length > 20) err.push('tags must be up to 20 short strings');
    if (!Array.isArray(e.sources) || e.sources.length > 50 || e.sources.some(function (s) { return !s || typeof s.citation !== 'string' || (s.doi != null && typeof s.doi !== 'string') || (s.url != null && typeof s.url !== 'string'); })) err.push('sources must be a list of {citation, doi, url}');
    if (!e.ai || typeof e.ai.used !== 'boolean' || typeof e.ai.tool !== 'string') err.push('ai must be {used, tool}');
    else if (e.ai.used && e.ai.tool.trim().length < 2) err.push('AI-assisted entries must name the tool used');
    if (typeof e.id === 'string' && !safeId(e.id)) err.push('id must be 4-64 letters, digits, _ or -');
    if (!Array.isArray(e.links) || e.links.length > 500 || e.links.some(function (l) { return !safeId(l); })) err.push('links must be a list of ids');
    return err;
  }

  /* ---------- untrusted input: key filter and whitelist copy (restore, boot, sealed backup) ---------- */
  function hasBadKeys(v, depth) {
    if (!v || typeof v !== 'object') return false;
    if ((depth || 0) > 8) return true;
    var ks = Object.keys(v);
    for (var i = 0; i < ks.length; i++) { if (badKey(ks[i]) || hasBadKeys(v[ks[i]], (depth || 0) + 1)) return true; }
    return false;
  }
  function clip(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  /* Builds a fresh entry from known fields only. Drafts may still fail the gates; wrong types become safe defaults. -> entry or null */
  function restoreEntry(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x) || !safeId(x.id) || hasBadKeys(x)) return null;
    var e = newEntry();
    e.id = x.id; e.title = clip(x.title, 200); e.question = clip(x.question, 2000); e.findings = clip(x.findings, 20000); e.method = clip(x.method, 10000);
    e.sources = (Array.isArray(x.sources) ? x.sources : []).filter(function (s) { return s && typeof s === 'object'; }).slice(0, 50)
      .map(function (s) { var o = { citation: clip(s.citation, 1000), doi: clip(s.doi, 300), url: clip(s.url, 2000) }, r = sanitizeRef(s.ref); if (r) o.ref = r; return o; });
    e.evidence = EVIDENCE.indexOf(x.evidence) >= 0 ? x.evidence : '';
    e.topic = TOPICS.indexOf(x.topic) >= 0 ? x.topic : 'other';
    e.tags = (Array.isArray(x.tags) ? x.tags : []).filter(function (t) { return typeof t === 'string'; }).slice(0, 20).map(function (t) { return t.slice(0, 40); });
    e.ai = { used: !!(x.ai && x.ai.used === true), tool: clip(x.ai && x.ai.tool, 100) };
    e.links = (Array.isArray(x.links) ? x.links : []).filter(function (l) { return safeId(l) && l !== x.id; }).slice(0, 500);
    e.healthClaim = x.healthClaim === true; e.disclaimer = x.disclaimer === true;
    var at = sanitizeAttachments(x.attachments); if (at.length) e.attachments = at;
    var pr = sanitizePrereg(x.prereg); if (pr) e.prereg = pr;
    if (typeof x.created === 'string' && x.created.length <= 40) e.created = x.created;
    if (typeof x.updated === 'string' && x.updated.length <= 40) e.updated = x.updated;
    return e;
  }
  /* -> {entries, dropped}. Unique ids, capped at MAX_NOTEBOOK, every entry a whitelist copy. */
  function sanitizeNotebook(list) {
    var out = [], seen = Object.create(null), dropped = 0;
    if (!Array.isArray(list)) return { entries: [], dropped: list == null ? 0 : 1 };
    for (var i = 0; i < list.length; i++) {
      var e = out.length < MAX_NOTEBOOK ? restoreEntry(list[i]) : null;
      if (!e || seen[e.id]) { dropped++; continue; }
      seen[e.id] = 1; out.push(e);
    }
    var total = 0;   // attachments share one budget so a hostile backup cannot fill the browser's storage
    out.forEach(function (e) {
      if (!e.attachments) return;
      e.attachments = e.attachments.filter(function (a) { if (total + a.size > ATTACH_MAX_TOTAL) { dropped++; return false; } total += a.size; return true; });
      if (!e.attachments.length) delete e.attachments;
    });
    return { entries: out, dropped: dropped };
  }

  /* ---------- reference metadata kept on a source (set by the reference importer; restore keeps it so backups carry it) ---------- */
  var REF_TYPES = ['article', 'book', 'chapter', 'thesis', 'report', 'conference', 'web', 'other'];
  var REF_TEXT = { title: 500, container: 300, issued: 20, volume: 40, issue: 40, pages: 40, publisher: 200, edition: 40, isbn: 40, issn: 20, language: 20, note: 1000, key: 80 };
  function cleanCtl(v, n) { return clip(v, n).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ''); }
  function sanitizeRef(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r) || hasBadKeys(r)) return null;
    var o = { type: REF_TYPES.indexOf(r.type) >= 0 ? r.type : 'other', authors: [] }, any = false;
    (Array.isArray(r.authors) ? r.authors : []).slice(0, 100).forEach(function (a) {
      if (!a || typeof a !== 'object') return;
      var f = cleanCtl(a.family, 100).trim(), g = cleanCtl(a.given, 100).trim(), l = cleanCtl(a.literal, 200).trim();
      if (f || g) o.authors.push({ family: f, given: g }); else if (l) o.authors.push({ literal: l });
    });
    if (o.authors.length) any = true;
    Object.keys(REF_TEXT).forEach(function (k) { var v = cleanCtl(r[k], REF_TEXT[k]).trim(); if (v) { o[k] = v; any = true; } });
    return any ? o : null;
  }

  /* ---------- file attachments stored inside an entry (base64, small, on this device only, never put in a pack) ---------- */
  var ATTACH_MAX_FILE = 750000, ATTACH_MAX_PER_ENTRY = 5, ATTACH_MAX_TOTAL = 2500000;
  var B64_RE = /^[A-Za-z0-9+\/]*={0,2}$/;
  function attachmentBytes(entries) { var t = 0; entries.forEach(function (e) { (e.attachments || []).forEach(function (a) { t += a.size; }); }); return t; }
  function sanitizeAttachments(list) {
    var out = [];
    (Array.isArray(list) ? list : []).slice(0, ATTACH_MAX_PER_ENTRY).forEach(function (a) {
      if (!a || typeof a !== 'object' || hasBadKeys(a) || typeof a.data !== 'string' || a.data.length > Math.ceil(ATTACH_MAX_FILE / 3) * 4 || a.data.length % 4 !== 0 || !B64_RE.test(a.data)) return;
      var pad = a.data.length ? (a.data.charAt(a.data.length - 1) === '=' ? (a.data.charAt(a.data.length - 2) === '=' ? 2 : 1) : 0) : 0, size = a.data.length / 4 * 3 - pad;
      if (size <= 0 || size > ATTACH_MAX_FILE) return;
      var name = cleanCtl(a.name, 120).replace(/[\\\/:*?"<>|]+/g, '_').replace(/^\.+/, '').trim() || 'file';
      var type = typeof a.type === 'string' && a.type.length <= 100 && /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i.test(a.type) ? a.type.toLowerCase() : 'application/octet-stream';
      out.push({ name: name, type: type, size: size, data: a.data });
    });
    return out;
  }

  /* ---------- sealed preregistration record ---------- */
  /* A plan written down before the work and sealed with a SHA-256 hash and this device's clock. It is NOT an independent time stamp:
     anyone with access to this notebook file can rewrite the text, the hash and the date together. It shows the record is unchanged
     since sealing only to a person who also holds the hash or the exported record from somewhere else. */
  var PREREG_NOTE = "Not an independent time stamp. The date comes from this device's own clock and the hash is stored next to the text, so it shows the text has not changed since sealing only if you keep a copy of the hash or of the exported record somewhere else (for example email it to yourself or a colleague).";
  function sanitizePrereg(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p) || hasBadKeys(p)) return null;
    var o = { hypothesis: clip(p.hypothesis, 5000), analysis: clip(p.analysis, 5000), sealedAt: '', hash: '' };
    if (typeof p.hash === 'string' && /^[0-9a-f]{64}$/.test(p.hash) && typeof p.sealedAt === 'string' && p.sealedAt.length <= 40 && !isNaN(Date.parse(p.sealedAt))) { o.hash = p.hash; o.sealedAt = p.sealedAt; }
    return o.hypothesis || o.analysis || o.hash ? o : null;
  }
  function preregSnapshot(e, sealedAt) {
    var p = e.prereg || {};
    return canon({ v: 1, id: str(e.id), title: str(e.title), question: str(e.question), method: str(e.method), hypothesis: str(p.hypothesis), analysis: str(p.analysis), sealedAt: sealedAt });
  }
  function isSealed(e) { return !!(e && e.prereg && e.prereg.hash); }
  var PREREG_LOCKED = ['title', 'question', 'method'];   // entry fields that cannot be edited once sealed (the hypothesis and analysis plan lock too)
  /* -> [] when ready to seal, else what is missing. */
  function preregReady(e) {
    var p = (e && e.prereg) || {}, why = [];
    if (isSealed(e)) return ['nothing: it is already sealed'];
    if (str(e.title).trim().length < 3) why.push('a title of at least 3 characters');
    if (str(e.question).trim().length < 10) why.push('a question of at least 10 characters');
    if (str(e.method).trim().length < 10) why.push('a method of at least 10 characters');
    if (str(p.hypothesis).trim().length < 10) why.push('a hypothesis of at least 10 characters');
    if (str(p.analysis).trim().length < 10) why.push('an analysis plan of at least 10 characters');
    return why;
  }
  async function sealPrereg(e, now) {
    var why = preregReady(e);
    if (why.length) throw new Error('To seal, write ' + why.join(', ') + '.');
    var at = (now instanceof Date ? now : new Date()).toISOString();
    e.prereg.sealedAt = at; e.prereg.hash = await sha256(preregSnapshot(e, at));
    return e.prereg;
  }
  /* -> {state: 'none' | 'draft' | 'valid' | 'altered', hash, sealedAt} */
  async function verifyPrereg(e) {
    if (!e || !e.prereg) return { state: 'none' };
    if (!e.prereg.hash) return { state: 'draft' };
    var h = await sha256(preregSnapshot(e, e.prereg.sealedAt));
    return { state: h === e.prereg.hash ? 'valid' : 'altered', hash: e.prereg.hash, sealedAt: e.prereg.sealedAt, recomputed: h };
  }
  /* Plain-text record the author can keep or send elsewhere. */
  function preregRecord(e) {
    var p = e.prereg || {};
    return ['STARK COMMONS PREREGISTRATION RECORD', '', 'Title: ' + str(e.title), 'Entry id: ' + str(e.id), "Sealed (this device's clock): " + p.sealedAt, 'SHA-256: ' + p.hash, '',
      PREREG_NOTE, '', '--- Question ---', str(e.question), '', '--- Method ---', str(e.method), '', '--- Hypothesis ---', str(p.hypothesis), '', '--- Analysis plan ---', str(p.analysis), '',
      'To check: the hash is SHA-256 of the canonical JSON {analysis, hypothesis, id, method, question, sealedAt, title, v:1} with keys sorted. Stark Commons shows "matches" or "altered" for it.', ''].join('\n');
  }

  /* ---------- personal-data scrubber ---------- */
  var NAME_CUES = [
    [/\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof)\.?\s+[A-Z][a-z]{1,}\b/g, 'a name with a title'],
    [/\b(?:my name is|patient name|name of (?:the )?patient|full name|name)\s*[:\-]?\s+[A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,})?/gi, 'a stated name'],
    [/\b(?:patient|man|woman|boy|girl|client|person)\s+(?:named|called)\s+[A-Z][a-z]{1,}/g, 'a named person'],
    [/\bnamed\s+[A-Z][a-z]{1,}\s+[A-Z][a-z]{1,}\b/g, 'a full name']
  ];
  var PII_RULES = [
    ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, 'an email address'],
    ['dob', /\b(?:d\.?o\.?b\.?|date of birth|birth ?date|born(?: on)?)\b[:\s-]*(?:\w+\s){0,2}?\d{1,4}[\/.\-\s]?[A-Za-z0-9]{0,9}[\/.\-\s]?\d{0,4}/gi, 'a date of birth'],
    ['patient', /\b(?:MRN|medical record (?:no|number|#)|patient (?:id|no|number|#)|NHS number|social security|SSN|insurance (?:no|number|id))\b/gi, 'a patient or record identifier'],
    ['patient', /\b\d{3}-\d{2}-\d{4}\b/g, 'a social-security-style number'],
    ['patient', /\b\d{1,3}[- ]year[- ]old\s+(?:man|woman|male|female|boy|girl|patient|gentleman|lady)\b/gi, 'an individual patient description'],
    ['patient', /\b(?:the patient|this patient|our patient|his chart|her chart|was admitted (?:on|to)|discharged on)\b/gi, 'patient-case wording'],
    ['address', /\b\d{1,5}\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Boulevard|Blvd)\b/g, 'a street address']
  ];
  NAME_CUES.forEach(function (n) { PII_RULES.push(['name', n[0], n[1]]); });

  var PHONE_CAND = /\+?\(?\d[\d\s().-]{7,}\d/g;
  var PHONE_SHAPE = /^(\+\d{1,3}[\s.-]?)?(\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}$/;
  function looksLikePhone(c) {
    var digits = c.replace(/\D/g, '').length, t = c.trim();
    if (digits < 9 || digits > 15 || !PHONE_SHAPE.test(t)) return false;
    var toks = t.split(/[\s.()-]+/).filter(Boolean);
    if (toks.every(function (x) { return /^(19|20)\d\d$/.test(x); })) return false;   // a run of years
    if (/^\d+(\.\d+)+$/.test(t) && toks.length > 3) return false;                       // version / decimal chains
    return /[+()\s.-]/.test(t);                                                         // needs separators or a +
  }
  /* Scan one text. opts.sourceMode: only email/phone, URLs and DOIs removed first. */
  function scanText(text, field, opts) {
    var out = [], t = str(text);
    if (!t) return out;
    var plain = t.replace(/https?:\/\/\S+/g, ' ').replace(/\b10\.\d{4,9}\/\S+/g, ' ');
    var src = (opts && opts.sourceMode);
    PII_RULES.forEach(function (r) {
      if (src && r[0] !== 'email') return;
      r[1].lastIndex = 0;
      var m, hay = r[0] === 'email' ? t : plain;
      while ((m = r[1].exec(hay)) !== null) {
        if (!m[0]) { r[1].lastIndex++; continue; }
        out.push({ field: field, kind: r[0], label: r[2], text: m[0].trim() });
      }
    });
    PHONE_CAND.lastIndex = 0;
    var p;
    while ((p = PHONE_CAND.exec(plain)) !== null) if (looksLikePhone(p[0])) out.push({ field: field, kind: 'phone', label: 'a phone number', text: p[0].trim() });
    return out;
  }
  function scanEntry(e) {
    var f = [];
    ['title', 'question', 'findings', 'method'].forEach(function (k) { f = f.concat(scanText(e[k], k)); });
    f = f.concat(scanText((e.tags || []).join(' '), 'tags'));
    f = f.concat(scanText(e.ai && e.ai.tool, 'ai tool'));
    (e.sources || []).forEach(function (s, i) { f = f.concat(scanText([s.citation, s.doi, s.url].map(str).join(' '), 'source ' + (i + 1), { sourceMode: true })); });
    return f;
  }
  function scrubText(text) {   // replaces flagged spans with [removed]; the writer must still re-read the result
    var t = str(text);
    scanText(t, 'x').sort(function (a, b) { return b.text.length - a.text.length; }).forEach(function (h) { t = t.split(h.text).join('[removed]'); });
    return t;
  }

  /* ---------- quality gates (what must be true before sharing) ---------- */
  function gates(e) {
    var health = isHealth(e), g = [], schema = validateEntry(e), pii = scanEntry(e);
    var okSources = (e.sources || []).filter(sourceOk).length;
    g.push({ id: 'schema', label: 'Complete entry', ok: schema.length === 0, detail: schema.join('; ') });
    g.push({ id: 'evidence', label: 'Evidence level chosen', ok: EVIDENCE.indexOf(e.evidence) >= 0, detail: 'Pick anecdote, observational, trial or review.' });
    g.push({ id: 'ai', label: 'AI provenance stated', ok: !(e.ai && e.ai.used) || str(e.ai.tool).trim().length >= 2, detail: 'Name the AI tool you used.' });
    g.push({ id: 'sources', label: health ? 'Sources for the health claim' : 'Sources (recommended)', ok: health ? okSources > 0 : true,
      detail: health ? 'A health claim needs at least one source with a citation and a valid DOI or http(s) URL.' : '' });
    g.push({ id: 'disclaimer', label: 'Medical safety disclaimer acknowledged', ok: !health || e.disclaimer === true, detail: DISCLAIMER });
    g.push({ id: 'pii', label: 'No personal data', ok: pii.length === 0, detail: pii.length + ' possible item(s) found; remove them.' });
    return { health: health, gates: g, pii: pii, schema: schema, ok: g.every(function (x) { return x.ok; }) };
  }

  /* ---------- signed packs ---------- */
  function cleanEntry(e) {
    return { id: e.id, title: e.title.trim(), question: str(e.question).trim(), findings: e.findings.trim(), method: str(e.method).trim(),
      sources: (e.sources || []).map(function (s) { return { citation: str(s.citation).trim(), doi: cleanDoi(s.doi), url: str(s.url).trim() }; }),
      evidence: e.evidence, topic: e.topic, tags: (e.tags || []).map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean),
      ai: { used: !!e.ai.used, tool: e.ai.used ? e.ai.tool.trim() : '' }, links: (e.links || []).slice(), healthClaim: isHealth(e),
      disclaimer: isHealth(e) ? true : !!e.disclaimer };
  }
  function pubOnly(j) { return { kty: j.kty, crv: j.crv, x: j.x, y: j.y }; }
  /* The private key is generated non-extractable: it can sign but can never be read out or saved as text. */
  async function newKeyPair() {
    var kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    return { privateKey: kp.privateKey, publicJwk: pubOnly(await subtle.exportKey('jwk', kp.publicKey)) };
  }
  /* Migrates a legacy {privateJwk, publicJwk} pair into a non-extractable key. */
  async function importSigningKey(pair) {
    if (!pair || !pair.privateJwk || !pair.publicJwk || pair.privateJwk.kty !== 'EC' || pair.privateJwk.crv !== 'P-256') throw new Error('not a signing key');
    var k = await subtle.importKey('jwk', pair.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    return { privateKey: k, publicJwk: pubOnly(pair.publicJwk) };
  }
  /* Short fingerprint of a public key (the same digits the Share page shows). */
  async function keyFingerprint(pub) { return (await sha256(canon(pubOnly(pub || {})))).slice(0, 16); }
  /* Throws if any selected entry fails a gate or the contributor has not confirmed the licence and rights. */
  async function buildPack(entries, opts) {
    var o = opts || {};
    if (!o.licenseConfirmed) throw new Error('Confirm the CC BY 4.0 licence.');
    if (!o.rightsConfirmed) throw new Error('Confirm that you have the right to share this work.');
    if (!entries.length) throw new Error('Select at least one entry.');
    entries.forEach(function (e) { var r = gates(e); if (!r.ok) throw new Error('"' + (e.title || 'Untitled') + '" fails the quality gates.'); });
    var ids = entries.map(function (e) { return e.id; });
    var cleaned = entries.map(function (e) { var c = cleanEntry(e); c.links = c.links.filter(function (l) { return ids.indexOf(l) >= 0 && l !== c.id; }); return c; });
    var payload = { format: PACK_FORMAT, version: 1, license: LICENSE, licenseConfirmed: true, rightsConfirmed: true,
      createdAt: o.createdAt || new Date().toISOString(), contributor: { alias: str(o.alias).trim().slice(0, 60) || 'anonymous', publicKey: o.keys.publicJwk }, entries: cleaned };
    var text = canon(payload);
    var key = o.keys.privateKey || await subtle.importKey('jwk', o.keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    var sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(text));
    payload.digest = await sha256(text);
    payload.signature = b64(sig);
    return payload;
  }
  /* -> {ok, error}. Detects any change to any field, key swap, or bad signature. */
  async function verifyPack(pack) {
    try {
      if (!pack || pack.format !== PACK_FORMAT || !pack.signature || !pack.digest) return { ok: false, error: 'not a signed Stark Commons pack' };
      var body = {}; Object.keys(pack).forEach(function (k) { if (k !== 'digest' && k !== 'signature') body[k] = pack[k]; });
      var text = canon(body);
      if (await sha256(text) !== pack.digest) return { ok: false, error: 'content does not match its digest (tampered)' };
      var pk = pack.contributor && pack.contributor.publicKey;
      var key = await subtle.importKey('jwk', pubOnly(pk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      var ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(pack.signature), utf8(text));
      return ok ? { ok: true } : { ok: false, error: 'signature does not verify (tampered or wrong key)' };
    } catch (e) { return { ok: false, error: 'malformed pack: ' + e.message }; }
  }
  /* Full owner-side validation of one pack: schema, licence flag, PII, required sources, signature. */
  /* opts.trustedKeys: fingerprints the owner has checked. trusted is null when no list is given. */
  async function validatePack(pack, opts) {
    var problems = [], accepted = [], rejected = [], o = opts || {};
    if (pack && Array.isArray(pack.entries) && pack.entries.length > MAX_PACK_ENTRIES) return { ok: false, problems: ['more than ' + MAX_PACK_ENTRIES + ' entries'], accepted: accepted, rejected: rejected, fingerprint: '', trusted: false };
    if (hasBadKeys(pack)) return { ok: false, problems: ['forbidden keys (__proto__, constructor or prototype)'], accepted: accepted, rejected: rejected, fingerprint: '', trusted: false };
    var v = await verifyPack(pack);
    if (!v.ok) return { ok: false, problems: [v.error], accepted: accepted, rejected: rejected, fingerprint: '', trusted: false };
    var fp = await keyFingerprint(pack.contributor.publicKey);
    var trusted = Array.isArray(o.trustedKeys) ? o.trustedKeys.map(function (t) { return str(t).trim().toLowerCase(); }).indexOf(fp) >= 0 : null;
    if (pack.license !== LICENSE || pack.licenseConfirmed !== true || pack.rightsConfirmed !== true) problems.push('licence or rights confirmation missing');
    if (!Array.isArray(pack.entries) || !pack.entries.length) problems.push('no entries');
    (pack.entries || []).forEach(function (e) {
      var why = validateEntry(e).slice();
      if (!why.length) {
        scanEntry(e).forEach(function (f) { why.push('personal data in ' + f.field + ' (' + f.label + ')'); });
        if (isHealth(e) && !(e.sources || []).some(sourceOk)) why.push('health claim without a valid source');
        if (isHealth(e) && e.disclaimer !== true) why.push('health claim without the disclaimer');
      }
      if (why.length) rejected.push({ title: str(e && e.title), reasons: why }); else accepted.push(e);
    });
    return { ok: problems.length === 0, problems: problems, accepted: problems.length ? [] : accepted, rejected: rejected, fingerprint: fp, trusted: trusted };
  }

  /* ---------- merge and public bundle ---------- */
  async function entryKey(e) { return (await sha256(norm(e.title))).slice(0, 12); }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
  function srcKey(s) { return DOI_RE.test(cleanDoi(s.doi)) ? 'doi:' + cleanDoi(s.doi).toLowerCase() : 'url:' + str(s.url).trim().toLowerCase().replace(/\/$/, ''); }
  /* packs: parsed pack objects. Invalid packs and entries are reported, never merged. Same normalised title = same entry. */
  /* opts.base: an existing public bundle to merge onto (incremental). opts.trustedKeys: see validatePack.
     report.changes lists every entry that is new or changed against the base, with a word diff of the findings. */
  async function mergePacks(packs, opts) {
    var byKey = Object.create(null), order = [], report = { packs: [], duplicates: 0, rejectedEntries: 0, changes: [] }, o = opts || {}, before = Object.create(null), baseById = Object.create(null);
    if (o.base) {
      if (validateBundle(o.base).length) throw new Error('the base bundle is not a valid public bundle');
      o.base.entries.forEach(function (e) { if (!byKey[e.id]) { byKey[e.id] = JSON.parse(JSON.stringify(e)); if (!Array.isArray(byKey[e.id].contributors)) byKey[e.id].contributors = []; before[e.id] = canon(byKey[e.id]); baseById[e.id] = e; order.push(e.id); } });
    }
    for (var i = 0; i < packs.length; i++) {
      var p = packs[i], r = await validatePack(p, o);
      report.packs.push({ alias: p && p.contributor && p.contributor.alias, ok: r.ok, problems: r.problems.slice(), accepted: r.accepted.length, rejected: r.rejected, fingerprint: r.fingerprint, trusted: r.trusted });
      report.rejectedEntries += r.rejected.length;
      if (!r.ok) continue;
      var map = Object.create(null);
      for (var a = 0; a < r.accepted.length; a++) map[r.accepted[a].id] = 'sc-' + (await entryKey(r.accepted[a]));
      for (var j = 0; j < r.accepted.length; j++) {
        var e = r.accepted[j], id = map[e.id], who = str(p.contributor.alias).trim().slice(0, 60) || 'anonymous';
        var links = (e.links || []).map(function (l) { return map[l]; }).filter(function (l) { return l && l !== id; });
        var cur = byKey[id];
        if (!cur) { byKey[id] = Object.assign(JSON.parse(JSON.stringify(e)), { id: id, links: uniq(links), contributors: [who] }); order.push(id); continue; }
        report.duplicates++;
        cur.contributors = uniq(cur.contributors.concat(who));
        cur.links = uniq(cur.links.concat(links));
        cur.tags = uniq(cur.tags.concat(e.tags));
        var seen = {}; cur.sources.forEach(function (s) { seen[srcKey(s)] = 1; });
        e.sources.forEach(function (s) { if (!seen[srcKey(s)]) { cur.sources.push(s); seen[srcKey(s)] = 1; } });
        if (EVIDENCE_RANK[e.evidence] > EVIDENCE_RANK[cur.evidence]) cur.evidence = e.evidence;   // keep the best-supported label
        if (e.findings.length > cur.findings.length) { cur.findings = e.findings; cur.question = e.question || cur.question; cur.method = e.method || cur.method; }
        if (e.ai.used && !cur.ai.used) cur.ai = e.ai;
      }
    }
    var entries = order.map(function (k) { return byKey[k]; });
    entries.forEach(function (e) {
      var was = before[e.id];
      if (was === undefined) report.changes.push({ id: e.id, title: e.title, kind: 'new' });
      else if (was !== canon(e)) report.changes.push({ id: e.id, title: e.title, kind: 'changed', findingsDiff: wordDiff(baseById[e.id].findings, e.findings) });
    });
    var bundle = { format: BUNDLE_FORMAT, version: 1, license: LICENSE, built: o.built || new Date().toISOString(), disclaimer: DISCLAIMER, entries: entries };
    return { bundle: bundle, report: report };
  }
  /* Word-level diff -> [{op: '=' | '+' | '-', text}]. LCS over at most 1500 words a side; longer texts fall back to one replace. */
  function wordDiff(a, b) {
    var x = str(a).split(/(\s+)/).filter(Boolean), y = str(b).split(/(\s+)/).filter(Boolean), n = x.length, m = y.length, i, j, out = [];
    if (str(a) === str(b)) return n ? [{ op: '=', text: str(a) }] : [];
    if (n > 1500 || m > 1500) return [{ op: '-', text: str(a) }, { op: '+', text: str(b) }];
    var w = m + 1, L = new Uint16Array((n + 1) * w);
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i * w + j] = x[i] === y[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
    function push(op, t) { var last = out[out.length - 1]; if (last && last.op === op) last.text += t; else out.push({ op: op, text: t }); }
    i = 0; j = 0;
    while (i < n && j < m) { if (x[i] === y[j]) { push('=', x[i]); i++; j++; } else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) { push('-', x[i]); i++; } else { push('+', y[j]); j++; } }
    while (i < n) push('-', x[i++]);
    while (j < m) push('+', y[j++]);
    return out;
  }
  function validateBundle(b) {
    var err = [];
    if (!b || b.format !== BUNDLE_FORMAT) return ['not a Stark Commons public bundle'];
    if (b.license !== LICENSE) err.push('licence must be ' + LICENSE);
    if (!Array.isArray(b.entries)) return err.concat('entries missing');
    if (b.entries.length > 100000) return err.concat('too many entries');
    if (hasBadKeys(b)) return err.concat('forbidden keys (__proto__, constructor or prototype)');
    b.entries.forEach(function (e, i) {
      validateEntry(e).forEach(function (m) { err.push('entry ' + (i + 1) + ': ' + m); });
      if (e && e.contributors !== undefined && (!Array.isArray(e.contributors) || e.contributors.length > 500 || e.contributors.some(function (c) { return typeof c !== 'string' || c.length > 60; }))) err.push('entry ' + (i + 1) + ': contributors must be a list of names');
    });
    return err;
  }

  root.SC = { EVIDENCE: EVIDENCE, EVIDENCE_RANK: EVIDENCE_RANK, TOPICS: TOPICS, HEALTH_TOPICS: HEALTH_TOPICS, LICENSE: LICENSE, DISCLAIMER: DISCLAIMER,
    newEntry: newEntry, validateEntry: validateEntry, scanText: scanText, scanEntry: scanEntry, scrubText: scrubText, gates: gates, isHealth: isHealth, sourceOk: sourceOk,
    canon: canon, sha256: sha256, newKeyPair: newKeyPair, buildPack: buildPack, verifyPack: verifyPack, validatePack: validatePack,
    mergePacks: mergePacks, validateBundle: validateBundle, entryKey: entryKey, restoreEntry: restoreEntry, sanitizeNotebook: sanitizeNotebook, hasBadKeys: hasBadKeys,
    importSigningKey: importSigningKey, sanitizeRef: sanitizeRef, REF_TYPES: REF_TYPES, sanitizeAttachments: sanitizeAttachments, attachmentBytes: attachmentBytes, ATTACH_MAX_FILE: ATTACH_MAX_FILE, ATTACH_MAX_PER_ENTRY: ATTACH_MAX_PER_ENTRY, ATTACH_MAX_TOTAL: ATTACH_MAX_TOTAL,
    sealPrereg: sealPrereg, verifyPrereg: verifyPrereg, preregReady: preregReady, preregRecord: preregRecord, isSealed: isSealed, PREREG_LOCKED: PREREG_LOCKED, PREREG_NOTE: PREREG_NOTE, keyFingerprint: keyFingerprint, wordDiff: wordDiff, ID_RE: ID_RE, MAX_NOTEBOOK: MAX_NOTEBOOK, MAX_PACK_ENTRIES: MAX_PACK_ENTRIES, MAX_FILE_BYTES: MAX_FILE_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SC;
})(typeof window !== 'undefined' ? window : globalThis);
