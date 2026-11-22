/* Stark Career smart tools: rule-based resume import, one-click tailoring, bullet power-ups, sprint maths,
   mock-interview scoring and fill-in templates. Pure functions: no DOM, no network, no AI. Runs in node tests too. */
var SC = window.SC || (window.SC = {}); SC.data = SC.data || {};
(function () {
  "use strict";
  function nz(s) { return String(s == null ? "" : s).trim(); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function uniq(a) { var seen = {}; return a.filter(function (x) { var k = x.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }); }

  /* ================= import parser ================= */
  var MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  var DATE = "(?:" + MONTH + "\\.?,?\\s+(?:19|20)\\d{2}|\\d{1,2}\\/(?:19|20)\\d{2}|(?:spring|summer|fall|autumn|winter)\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2})";
  var RANGE = new RegExp("\\(?\\s*(" + DATE + ")\\s*(?:-|\\u2013|\\u2014|to|until|through)\\s*(" + DATE + "|present|current|now|today)\\s*\\)?", "i");
  var DURATION = /\s*[··|,-]?\s*\d+\s*(?:yrs?|years?)(?:\s*\d+\s*(?:mos?|months?))?\s*$|\s*[··|,-]?\s*\d+\s*(?:mos?|months?)\s*$/i;
  var BULLET = /^\s*(?:[-*•·▪◦‣–—>●■]|\d{1,2}[.)])\s+/;
  var EMAIL = /[^\s@|,;<>()]+@[^\s@|,;<>()]+\.[a-z]{2,}/i;
  var PHONE = /(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}\b|\b\d{3}-\d{4}\b/;
  var LINK = /(?:[a-z]+:\/\/)?(?:www\.)?(?:linkedin\.com\/[^\s|,]+|github\.com\/[^\s|,]+|[a-z0-9-]+\.(?:dev|io|me|com|net|org|co)\/[^\s|,]+|[a-z0-9-]+\.(?:dev|io|me))/i;
  var STATES = "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|Ontario|Quebec|British Columbia|Alberta|England|Scotland|Wales";
  var LOC = new RegExp("([A-Z][A-Za-z.'\\- ]{1,30},\\s*(?:[A-Z]{2}\\b|" + STATES + ")(?:,\\s*(?:United States|USA|US|Canada|United Kingdom|UK))?)|\\b(Remote|Hybrid)\\b");
  var JUNK = /^(contact info|connect|message|more|follow|following|\d[\d,]*\+? (?:connections|followers)|open to work|show all.*|see more|…see more|…see more|show credential|see credential|credential id.*|endorsed by.*|\d+ endorsements?|.*endorsements?$|passed linkedin skill assessment|activity|people also viewed|page \d+ of \d+|references available.*)$/i;
  var EMPLOYMENT = /^(full-time|part-time|contract|contractor|temporary|seasonal|self-employed|freelance|apprenticeship|permanent|on-site|onsite)$/i;
  var DEGREE = /\b(b\.?\s?[as]\.?|b\.?sc|bachelor'?s?|master'?s?|m\.?\s?[as]\.?|m\.?sc|mba|ph\.?\s?d|doctorate|associate'?s?(?: degree)?|a\.?\s?[as]\.?|diploma|ged|high school|certificate|degree|bsn|rn|jd|md|bfa|mfa|m\.?ed)\b/i;
  var SCHOOL = /\b(university|college|school|institute|academy|polytechnic|conservatory|seminary)\b/i;
  var HEADS = {
    summary: /^(summary|professional summary|career summary|profile|professional profile|about|about me|objective|career objective|overview|personal statement)$/,
    experience: /^(experience|work experience|professional experience|relevant experience|employment|employment history|work history|career history|professional history)$/,
    education: /^(education|education and training|education & training|academic background|training)$/,
    skills: /^(skills|key skills|core skills|technical skills|core competencies|competencies|areas of expertise|top skills|skills & endorsements|skills and abilities|skills & abilities|expertise)$/,
    certs: /^(certifications?|licenses?|licenses? (?:and|&) certifications?|certificates?|credentials|certifications? (?:and|&) licenses?)$/,
    other: /^(projects|personal projects|volunteer|volunteering|volunteer experience|languages|honors|honors (?:and|&) awards|awards|interests|hobbies|publications|activities|recommendations|courses|coursework|organizations|affiliations|references)$/
  };

  function headingOf(line) {
    if (BULLET.test(line)) return null;
    var l = line.toLowerCase().replace(/^[#*=_\s]+|[:#*=_\s\-–—|]+$/g, "").replace(/\s+/g, " ").trim();
    if (!l || l.length > 40) return null;
    for (var k in HEADS) if (HEADS[k].test(l)) return { kind: k, label: l };
    return null;
  }
  function cap(s) { s = nz(s); return s.replace(/^(present|current|now|today)$/i, "Present").replace(/\b([a-z])([a-z]+)\b/g, function (m, a, b) { return /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|spring|summer|fall|autumn|winter)/i.test(m) ? a.toUpperCase() + b : m; }); }
  function isTitle(p) {
    var low = " " + p.toLowerCase().replace(/[^a-z ]/g, " ") + " ";
    return (SC.data.titleWords || []).some(function (w) { return low.indexOf(" " + w + " ") !== -1; });
  }
  function splitPieces(text) {
    var parts = text.split(/\s+[|·•@]\s+|\s+(?:-|–|—)\s+|\s+at\s+|\t+|\s{3,}|,\s+/i).map(nz).filter(Boolean), out = [];
    parts.forEach(function (p) { if (/^(inc|llc|ltd|co|corp|plc|gmbh|l\.?p)\.?$/i.test(p) && out.length) out[out.length - 1] += ", " + p; else out.push(p); });
    return out;
  }

  function parseHeader(lines) {
    var r = { name: "", title: "", email: "", phone: "", location: "", links: "" }, rest = [], extra = [];
    lines.forEach(function (ln) {
      var line = ln, m;
      if ((m = EMAIL.exec(line))) { if (!r.email) r.email = m[0]; line = line.replace(m[0], " "); }
      if ((m = PHONE.exec(line))) { if (!r.phone) r.phone = nz(m[0]); line = line.replace(m[0], " "); }
      if ((m = LINK.exec(line))) { if (!r.links) r.links = m[0].replace(/^[a-z]+:\/\//i, "").replace(/^www\./i, ""); line = line.replace(m[0], " "); }
      var contacty = line !== ln;
      if ((m = LOC.exec(line)) && (contacty || nz(line.replace(m[0], "")).replace(/[|,··\s]/g, "").length < 3)) { if (!r.location) r.location = nz(m[0]); line = line.replace(m[0], " "); contacty = true; }
      line = nz(line.replace(/^[|,··\s\-]+|[|,··\s\-]+$/g, "").replace(/\s*[|··]\s*[|··]\s*/g, " | "));
      if (!line || /^[|,··\s\-]*$/.test(line)) return;
      if (contacty) { line.split(/\s*[|··]\s*/).map(nz).filter(Boolean).forEach(function (p) { rest.push(p); }); }
      else rest.push(line);
    });
    rest.forEach(function (p) {
      var wc = SC.words(p);
      if (!r.name && wc >= 1 && wc <= 5 && /^[A-Za-z][A-Za-z.'\- ]+$/.test(p) && !isTitle(p)) r.name = p;
      else if (!r.title && wc <= 14 && !/[.!?]$/.test(p)) r.title = p;
      else extra.push(p);
    });
    if (!r.name && r.title && SC.words(r.title) <= 4 && !isTitle(r.title)) { r.name = r.title; r.title = ""; }
    if (r.name === r.name.toUpperCase()) r.name = r.name.toLowerCase().replace(/(^|[\s'-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return { contact: r, extra: extra };
  }

  function parseJobs(lines) {
    var jobs = [], cur = null;
    function flush() { if (cur && (cur.head.length || cur.bullets.length)) jobs.push(finishJob(cur)); cur = null; }
    lines.forEach(function (ln) {
      if (!nz(ln)) { if (cur && cur.bullets.length) cur.gap = true; return; }
      var isB = BULLET.test(ln), clean = nz(ln.replace(BULLET, "")), hasRange = RANGE.test(clean);
      if (!clean || JUNK.test(clean)) return;
      if (isB && !hasRange) { if (!cur) cur = { head: [], bullets: [] }; cur.bullets.push(clean); cur.body = true; cur.gap = false; return; }
      if (cur && cur.body && cur.bullets.length && !cur.gap && /^[a-z(&]/.test(clean) && !hasRange) { cur.bullets[cur.bullets.length - 1] += " " + clean; return; }
      var wc = SC.words(clean), verb = (SC.data.verbs || []).indexOf(SC.tokens(clean)[0] || "") !== -1;
      var bodyish = !hasRange && (wc > 14 || (wc > 4 && /[.;!]$/.test(clean)) || (verb && wc > 3 && cur && (cur.body || cur.range)));
      if (bodyish) {
        if (!cur) cur = { head: [], bullets: [] };
        (clean.match(/[^.!?]+(?:[.!?]+(?=\s+[A-Z]|$)|$)/g) || [clean]).map(nz).filter(Boolean).forEach(function (s) { cur.bullets.push(s.replace(/[.]$/, "")); });
        cur.body = true; cur.gap = false; return;
      }
      if (!cur || cur.body || (hasRange && cur.range)) flush();
      if (!cur) cur = { head: [], bullets: [] };
      cur.head.push(clean); if (hasRange) cur.range = true;
    });
    flush();
    return jobs.filter(function (j) { return j.role || j.company || j.bullets.length; });
  }
  function finishJob(c) {
    var job = { role: "", company: "", loc: "", start: "", end: "", bullets: c.bullets.map(function (b) { return b.replace(/\s+/g, " "); }) };
    var pieces = [];
    c.head.forEach(function (h) {
      var m = RANGE.exec(h);
      if (m) { if (!job.start) { job.start = cap(m[1]); job.end = cap(m[2]); } h = h.replace(m[0], " "); }
      h = h.replace(DURATION, "");
      var lm = LOC.exec(h);
      if (lm) { if (!job.loc) job.loc = nz(lm[0]); h = h.replace(lm[0], " "); }
      splitPieces(h.replace(/[()]/g, " ")).forEach(function (p) { p = p.replace(/^[|,··\-\s]+|[|,··\-\s]+$/g, ""); if (p && !EMPLOYMENT.test(p) && !DURATION.test(" " + p) && !/^\d+$/.test(p)) pieces.push(p); });
    });
    var ti = -1;
    pieces.forEach(function (p, i) { if (ti < 0 && isTitle(p)) ti = i; });
    if (ti < 0) ti = 0;
    job.role = pieces[ti] || "";
    var others = pieces.filter(function (p, i) { return i !== ti; });
    job.company = others[0] || "";
    if (!job.loc && others[1] && /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(others[1])) job.loc = others[1];
    return job;
  }

  function parseEducation(lines) {
    var out = [], cur = null;
    function flush() { if (cur && (cur.school || cur.degree)) out.push(cur); cur = null; }
    lines.forEach(function (ln) {
      var clean = nz(ln.replace(BULLET, ""));
      if (!clean) { flush(); return; }
      if (JUNK.test(clean)) return;
      var years = clean.match(/(?:19|20)\d{2}/g), noYear = nz(clean.replace(RANGE, " ").replace(/\(?\b(?:19|20)\d{2}\b\)?/g, " ").replace(/[\s,|–-]+$/, ""));
      var pieces = splitPieces(noYear), sch = pieces.filter(function (p) { return SCHOOL.test(p); })[0], deg = pieces.filter(function (p) { return DEGREE.test(p) && !SCHOOL.test(p); })[0];
      if (!sch && DEGREE.test(noYear)) { deg = nz(noYear.replace(/\s+-\s+[A-Z]{2,4}\b/, "")); pieces = [deg]; }
      if ((sch && cur && cur.school) || (deg && cur && cur.degree && !sch)) flush();
      if (!cur) cur = { school: "", degree: "", year: "", notes: "" };
      if (sch) cur.school = sch;
      if (deg) cur.degree = deg;
      if (years) cur.year = years[years.length - 1];
      pieces.forEach(function (p) { if (p !== sch && p !== deg && !LOC.test(p)) cur.notes = nz((cur.notes ? cur.notes + "; " : "") + p); });
      if (!sch && !deg && !years && !cur.school && !cur.degree) { cur.notes = ""; cur.school = clean; }
    });
    flush();
    return out;
  }

  function parseSkills(lines) {
    var out = [];
    lines.forEach(function (ln) {
      var c = nz(ln.replace(BULLET, "")); if (!c || JUNK.test(c)) return;
      c = c.replace(/^[A-Za-z &]{2,30}:\s+/, "");
      c.split(/\s*[,;|•·]\s*|\s{2,}|\t/).map(nz).forEach(function (s) { if (s && SC.words(s) <= 5 && !/^(and|or)$/i.test(s)) out.push(s.replace(/\.$/, "")); });
    });
    return uniq(out);
  }

  function parseCerts(lines) {
    var out = [];
    lines.forEach(function (ln) {
      var c = nz(ln.replace(BULLET, "")); if (!c || JUNK.test(c)) return;
      var iss = /^issued\s+(.+?)(?:\s*[··].*)?$/i.exec(c);
      if (iss && out.length) { out[out.length - 1] += ", " + nz(iss[1]).replace(/^.*?((?:19|20)\d{2}).*$/, "$1"); return; }
      if (/^(expires|no expiration)/i.test(c)) return;
      out.push(c);
    });
    return out;
  }

  SC.parseResume = function (text) {
    var raw = String(text || "").replace(/\r\n?/g, "\n").replace(/ /g, " ").replace(/[ \t]+$/gm, "");
    var lines = raw.split("\n"), sections = [], cur = { kind: "header", lines: [] }, notes = [], unplaced = [];
    lines.forEach(function (ln) {
      var h = headingOf(ln);
      if (h) { sections.push(cur); cur = { kind: h.kind, label: h.label, lines: [] }; return; }
      cur.lines.push(ln);
    });
    sections.push(cur);
    var R = SC.blankResume(), found = {};
    var headerLines = sections[0].lines.filter(function (l) { return nz(l) && !JUNK.test(nz(l)); });
    var noHeadings = sections.length === 1;
    if (noHeadings) {
      var idx = headerLines.findIndex(function (l, i) { return i > 0 && (RANGE.test(l) || BULLET.test(l)); });
      if (idx < 0) idx = Math.min(headerLines.length, 4);
      var bodyStart = idx;
      while (bodyStart > 2 && bodyStart > idx - 2 && !EMAIL.test(headerLines[bodyStart - 1]) && !PHONE.test(headerLines[bodyStart - 1]) && !LINK.test(headerLines[bodyStart - 1])) bodyStart--;
      var bodyLines = headerLines.slice(bodyStart);
      headerLines = headerLines.slice(0, bodyStart);
      sections.push({ kind: "experience", lines: bodyLines });
      notes.push("No section headings were found, so everything after the contact lines was read as work history. Check each job carefully.");
    }
    var hd = parseHeader(headerLines.slice(0, 8));
    Object.keys(hd.contact).forEach(function (k) { R[k] = hd.contact[k]; });
    var headerExtra = hd.extra.concat(headerLines.slice(8));
    headerExtra.forEach(function (x) { if (SC.words(x) > 12 && !R.summary) R.summary = nz(x); else if (nz(x)) unplaced.push(nz(x)); });
    var certs = [], skills = [];
    sections.slice(1).forEach(function (s) {
      var body = s.lines;
      found[s.kind] = true;
      if (s.kind === "summary") R.summary = nz((R.summary ? R.summary + " " : "") + body.map(nz).filter(function (l) { return l && !JUNK.test(l); }).join(" ")).replace(/\s+/g, " ");
      else if (s.kind === "experience") R.experience = R.experience.concat(parseJobs(body));
      else if (s.kind === "education") R.education = R.education.concat(parseEducation(body));
      else if (s.kind === "skills") skills = skills.concat(parseSkills(body));
      else if (s.kind === "certs") certs = certs.concat(parseCerts(body));
      else body.forEach(function (l) { l = nz(l.replace(BULLET, "")); if (l && !JUNK.test(l)) unplaced.push(l); });
    });
    R.skills = uniq(skills).join(", ");
    R.certs = certs.join("\n");
    var bullets = R.experience.reduce(function (n, j) { return n + j.bullets.length; }, 0);
    if (!R.name) notes.push("No name was found at the top. Add it in the review.");
    if (!R.email && !R.phone) notes.push("No email or phone number was found.");
    if (!R.experience.length) notes.push("No jobs were recognized. Paste the experience section with each job title, employer and dates on their own lines.");
    R.experience.forEach(function (j) { if (!j.start) notes.push("\"" + (j.role || j.company || "A job") + "\" has no dates. Add them in the review."); });
    return { resume: R, notes: notes, unplaced: unplaced, found: found,
      stats: { jobs: R.experience.length, bullets: bullets, schools: R.education.length, skills: R.skills ? R.skills.split(", ").length : 0, certs: certs.length } };
  };

  SC.mergeResume = function (base, add) {
    var R = JSON.parse(JSON.stringify(base));
    ["name", "title", "email", "phone", "location", "links", "summary"].forEach(function (k) { if (!nz(R[k]) && nz(add[k])) R[k] = add[k]; });
    var key = function (j) { return (nz(j.role) + "|" + nz(j.company)).toLowerCase(); }, have = R.experience.map(key);
    (add.experience || []).forEach(function (j) { if (have.indexOf(key(j)) === -1) R.experience.push(j); });
    var eds = R.education.map(function (e) { return nz(e.school).toLowerCase(); });
    (add.education || []).forEach(function (e) { if (eds.indexOf(nz(e.school).toLowerCase()) === -1) R.education.push(e); });
    R.skills = uniq(nz(R.skills).split(/\s*[,;\n]\s*/).concat(nz(add.skills).split(/\s*[,;\n]\s*/)).map(nz).filter(Boolean)).join(", ");
    R.certs = uniq(nz(R.certs).split("\n").concat(nz(add.certs).split("\n")).map(nz).filter(Boolean)).join("\n");
    return R;
  };

  /* Guided flow helpers: a first-draft summary from what the person typed, and skill suggestions. */
  SC.draftSummary = function (R, thisYear) {
    var title = nz(R.title) || nz((R.experience[0] || {}).role), years = [], best = null, bestScore = -1;
    (R.experience || []).forEach(function (j) {
      [j.start, j.end].forEach(function (d) { var m = /(19|20)\d{2}/.exec(nz(d)); if (m) years.push(+m[0]); else if (/present|current|now/i.test(nz(d))) years.push(thisYear); });
      (j.bullets || []).forEach(function (b) { var c = SC.coachBullet(b); if (c.score > bestScore && !/\[/.test(b)) { bestScore = c.score; best = c.text; } });
    });
    var n = years.length ? Math.max.apply(null, years) - Math.min.apply(null, years) : 0;
    var skills = nz(R.skills).split(/\s*[,;\n]\s*/).map(nz).filter(Boolean);
    var s1 = (title ? title.charAt(0).toUpperCase() + title.slice(1) : "Professional") + (n >= 1 ? " with " + n + "+ years of experience" : "") +
      (skills.length ? (n >= 1 ? " in " : " skilled in ") + skills.slice(0, 2).join(" and ").toLowerCase() : "") + ".";
    var s2 = best ? best.replace(/[.\s]+$/, "") + "." : "";
    var s3 = "Ready to bring " + (skills[2] ? skills[2].toLowerCase() + " and " : "") + "the same results to a new team.";
    return [s1, s2, s3].filter(Boolean).join(" ");
  };
  SC.suggestSkills = function (R, n) {
    var have = nz(R.skills).toLowerCase().split(/\s*[,;\n]\s*/), ctx = [R.title, R.summary].concat((R.experience || []).map(function (j) { return j.role + " " + (j.bullets || []).join(" "); })).join(" ");
    var h = hitter(ctx), common = ["communication", "problem solving", "time management", "customer service", "microsoft office", "excel", "teamwork", "scheduling", "training", "data entry"];
    var scored = (SC.data.skills || []).map(function (s, i) {
      var st = SC.stemList(s), hit = st.filter(function (x) { return h.set[x]; }).length;
      return { s: s, sc: hit ? hit / st.length + (h.joined.indexOf(" " + st.join(" ") + " ") !== -1 ? 1 : 0) : common.indexOf(s) !== -1 ? 0.1 : 0, i: i };
    }).filter(function (x) { return x.sc > 0 && have.indexOf(x.s) === -1; }).sort(function (a, b) { return b.sc - a.sc || a.i - b.i; });
    return scored.slice(0, n || 12).map(function (x) { return x.s; });
  };

  /* ================= tailoring ================= */
  function hitter(text) {
    var st = SC.stemList(text), set = {};
    st.forEach(function (s) { set[s] = 1; });
    return { set: set, joined: " " + st.join(" ") + " " };
  }
  SC.relevance = function (text, kws) {
    var h = hitter(text), score = 0, found = [];
    kws.forEach(function (k) { if (k.phrase ? h.joined.indexOf(" " + k.key + " ") !== -1 : h.set[k.key]) { score += k.weight; found.push(k.label); } });
    return { score: score, found: found };
  };
  function sentences(t) { return (nz(t).match(/[^.!?]+(?:[.!?]+|$)/g) || []).map(nz).filter(Boolean); }
  function topShare(exp, kws) {
    var shares = [];
    exp.forEach(function (j) {
      var rel = (j.bullets || []).map(function (b) { return SC.relevance(b, kws).score; }), tot = rel.reduce(function (a, b) { return a + b; }, 0);
      if (tot && rel.length > 3) shares.push(rel.slice(0, 3).reduce(function (a, b) { return a + b; }, 0) / tot);
      else if (tot) shares.push(1);
    });
    return shares.length ? Math.round(100 * shares.reduce(function (a, b) { return a + b; }, 0) / shares.length) : 0;
  }
  SC.tailorResume = function (resume, jobText) {
    var kws = SC.keywords(jobText, 35), T = JSON.parse(JSON.stringify(resume));
    var match = SC.matchJob(SC.resumeText(resume), jobText);
    var sk = nz(resume.skills).split(/\s*[,;\n]\s*/).map(nz).filter(Boolean).map(function (s, i) { return { s: s, i: i, r: SC.relevance(s, kws).score }; });
    sk.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    var skillsUp = sk.filter(function (x, i) { return x.r > 0 && x.i !== i; }).length;
    T.skills = sk.map(function (x) { return x.s; }).join(", ");
    var sents = sentences(resume.summary).map(function (s, i) { return { s: s, i: i, r: SC.relevance(s, kws).score }; });
    var lead = sents.length > 1 && /\b(with|years?|experienced|specialist|professional)\b/i.test(sents[0].s) ? sents.shift() : null;
    sents.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    if (lead) sents.unshift(lead);
    var summaryMoved = sents.some(function (x, i) { return x.i !== i; });
    T.summary = sents.map(function (x) { return x.s; }).join(" ");
    var moved = 0, bulletInfo = [];
    T.experience = (resume.experience || []).map(function (j, ji) {
      var list = (j.bullets || []).map(nz).filter(Boolean).map(function (b, i) { var rel = SC.relevance(b, kws); return { b: b, i: i, r: rel.score, found: rel.found, c: SC.coachBullet(b).score }; });
      list.sort(function (a, b) { return b.r - a.r || b.c - a.c || a.i - b.i; });
      list.forEach(function (x, ni) { if (x.i !== ni) moved++; bulletInfo.push({ job: ji, from: x.i, to: ni, score: x.r, found: x.found, text: x.b }); });
      var nj = JSON.parse(JSON.stringify(j)); nj.bullets = list.map(function (x) { return x.b; }); return nj;
    });
    var missing = match.missing.map(function (k) {
      var known = (SC.data.skills || []).indexOf(k.label) !== -1 || k.phrase;
      return { label: k.label, weight: k.weight, count: k.count, skill: known,
        prompt: known ? "Have you used " + k.label + "? Only if true, add it to Skills, then back it up in a bullet." : "Does \"" + k.label + "\" describe your work? Only if true, work the word into a bullet that shows it.",
        frame: "Used " + k.label + " to [what you did], [result with a number]" };
    });
    return { resume: T, match: match, kws: kws, skillsUp: skillsUp, skillsMatched: sk.filter(function (x) { return x.r > 0; }).map(function (x) { return x.s; }),
      summaryMoved: summaryMoved, bulletsMoved: moved, bullets: bulletInfo, missing: missing,
      topBefore: topShare(resume.experience || [], kws), topAfter: topShare(T.experience, kws) };
  };
  SC.addSkill = function (skills, label) {
    var list = nz(skills).split(/\s*[,;\n]\s*/).map(nz).filter(Boolean);
    if (!list.some(function (s) { return s.toLowerCase() === label.toLowerCase(); })) list.unshift(label);
    return list.join(", ");
  };
  SC.postingMeta = function (job) {
    var t = String(job || ""), out = { role: "", company: "" }, m;
    if ((m = /^\s*(?:job title|title|position|role)\s*[:\-]\s*(.+)$/im.exec(t))) out.role = nz(m[1]);
    if ((m = /^\s*(?:company|employer|organization|organisation)\s*[:\-]\s*(.+)$/im.exec(t))) out.company = nz(m[1]);
    var first = nz((t.split(/\n/).filter(function (l) { return nz(l); })[0] || "").split(/[.!?](?:\s|$)/)[0]);
    if (!out.role && first && SC.words(first) <= 10) {
      var at = /^(.+?)\s+(?:at|@|-|–|—|\|)\s+(.+)$/.exec(first);
      if (at && isTitle(at[1])) { out.role = nz(at[1]); if (!out.company) out.company = nz(at[2]); }
      else if (isTitle(first) && SC.words(first) <= 6) out.role = first.replace(/[.:]$/, "");
    }
    if (!out.company && (m = /\b(?:at|join)\s+([A-Z][A-Za-z0-9&'-]*(?:\s+[A-Z][A-Za-z0-9&'-]*){0,3})/.exec(t))) out.company = nz(m[1]);
    if (!out.role && (m = /\b(?:hiring|seeking|looking for)\s+(?:an?\s+)?([A-Z][A-Za-z/&-]+(?:\s+[A-Z][A-Za-z/&-]+){0,4})/.exec(t))) out.role = nz(m[1]);
    return out;
  };

  /* ================= bullet power-ups ================= */
  var altKeys = null;
  function alts() { if (!altKeys) altKeys = Object.keys(SC.data.weakAlts || {}).sort(function (a, b) { return b.length - a.length; }); return altKeys; }
  SC.weakScan = function (text) {
    var t = String(text || ""), taken = [], out = [];
    alts().forEach(function (p) {
      var re = new RegExp("(^|[^a-z-])(" + reEsc(p) + ")(?![a-z-])", "gi"), m;
      while ((m = re.exec(t))) {
        var at = m.index + m[1].length, end = at + m[2].length;
        if (taken.some(function (r) { return at < r[1] && end > r[0]; })) continue;
        taken.push([at, end]); out.push({ phrase: p, at: at, alts: SC.data.weakAlts[p] });
      }
    });
    return out.sort(function (a, b) { return a.at - b.at; });
  };
  function family(text) {
    var low = text.toLowerCase(), best = null;
    (SC.data.verbFamilies || []).forEach(function (f) { if (!best && new RegExp("\\b(?:" + f.re + ")", "i").test(low)) best = f; });
    return best || SC.data.verbFallback;
  }
  function leadVerb(text) { var f = SC.tokens(nz(text).replace(BULLET, ""))[0] || ""; return (SC.data.verbs || []).indexOf(f) !== -1 ? f : ""; }
  function core(text) {
    var t = nz(text).replace(BULLET, "").replace(/^(?:i|we)\s+/i, "");
    var starts = (SC.data.weakStarts || []).concat(alts()).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < starts.length; i++) {
      var s = starts[i]; if (t.toLowerCase().indexOf(s + " ") === 0) { t = t.slice(s.length + 1); break; }
    }
    var first = (SC.tokens(t)[0] || "");
    if ((SC.data.verbs || []).indexOf(first) !== -1) t = t.slice(t.toLowerCase().indexOf(first) + first.length);
    t = nz(t).replace(/^(?:the\s+)?(?:handling|managing|doing|working on)\s+/i, "").replace(/\b(?:various|several|many|numerous|a lot of|lots of)\b/gi, "[N]").replace(/\s*\b(?:etc\.?)$/i, "").replace(/[.;,]+$/, "");
    return t ? t.charAt(0).toLowerCase() + t.slice(1) : "";
  }
  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  SC.powerUp = function (text) {
    if (/\[[^\]]*\]/.test(String(text || ""))) return []; /* already a template: fill it in rather than rewrite it again */
    var c = core(text); if (!c) return [];
    var f = family(c), hasNum = /\d|%|\$/.test(c.replace(/\[[^\]]*\]/g, "")), own = leadVerb(text), out = [];
    var v = (own ? [own] : []).concat(f.verbs.filter(function (x) { return x !== own; }));
    var noun = f.scale.replace(/\[[^\]]*\]/g, " ").trim().split(/\s+/).pop().toLowerCase();
    var scale = hasNum || /\[N\]/.test(c) || c.toLowerCase().indexOf(noun) !== -1 ? "" : " for " + f.scale;
    out.push(capFirst(v[0]) + " " + c + (hasNum ? "" : ", " + f.result));
    out.push(capFirst(v[1]) + " " + c + scale + ", " + f.result);
    out.push(capFirst(v[2]) + " " + c + ": [before] to [after] in [time period]");
    return uniq(out.map(function (s) { return s.replace(/\s+/g, " "); }));
  };
  SC.quantifyPrompts = function (text) {
    var low = String(text || "").toLowerCase(), out = [];
    (SC.data.quantify || []).forEach(function (q) { if (out.length < 2 && new RegExp(q.re).test(low)) out.push(q.q); });
    (SC.data.quantifyGeneric || []).forEach(function (q) { if (out.length < 3) out.push(q); });
    return out;
  };

  /* ================= sprint maths ================= */
  function pd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  SC.weekStart = function (iso) { var d = pd(iso); if (!d) return null; return SC.addDays(iso, -((d.getUTCDay() + 6) % 7)); };
  SC.SPRINT_TYPES = [["apps", "Applications"], ["follow", "Follow-ups"], ["net", "Networking messages"]];
  SC.blankSprint = function () { return { goals: { apps: 10, follow: 5, net: 5 }, log: [] }; };
  SC.logActivity = function (sprint, type, date) { sprint.log.push({ t: type, d: date || SC.today() }); return sprint; };
  SC.unlogActivity = function (sprint, type, today) {
    var ws = SC.weekStart(today || SC.today());
    for (var i = sprint.log.length - 1; i >= 0; i--) if (sprint.log[i].t === type && sprint.log[i].d >= ws) { sprint.log.splice(i, 1); return true; }
    return false;
  };
  SC.sprintWeek = function (log, goals, today) {
    var ws = SC.weekStart(today), we = SC.addDays(ws, 6), daysLeft = 7 - SC.daysBetween(ws, today), per = {}, sumGoal = 0, sumDone = 0;
    SC.SPRINT_TYPES.forEach(function (t) { per[t[0]] = { done: 0, goal: Math.max(0, +goals[t[0]] || 0) }; });
    (log || []).forEach(function (e) { if (per[e.t] && e.d >= ws && e.d <= we) per[e.t].done++; });
    Object.keys(per).forEach(function (k) {
      var p = per[k]; p.left = Math.max(0, p.goal - p.done); p.pct = p.goal ? Math.min(100, Math.round(100 * p.done / p.goal)) : 100;
      p.today = Math.ceil(p.left / daysLeft); sumGoal += p.goal; sumDone += Math.min(p.done, p.goal);
    });
    return { start: ws, end: we, daysLeft: daysLeft, per: per, pct: sumGoal ? Math.round(100 * sumDone / sumGoal) : 100, met: sumDone >= sumGoal };
  };
  SC.sprintStreak = function (log, today) {
    var days = {}; (log || []).forEach(function (e) { days[e.d] = 1; });
    var d = days[today] ? today : SC.addDays(today, -1), n = 0;
    while (days[d]) { n++; d = SC.addDays(d, -1); }
    return { days: n, activeToday: !!days[today] };
  };
  SC.weekStreak = function (log, goals, today) {
    var n = 0, w = SC.weekStart(today), cur = SC.sprintWeek(log, goals, today);
    if (cur.met) n++;
    for (var i = 1; i < 200; i++) { var day = SC.addDays(w, -7 * i); if (SC.sprintWeek(log, goals, day).met) n++; else break; }
    return n;
  };
  SC.activityGrid = function (log, today, weeks) {
    var counts = {}; (log || []).forEach(function (e) { counts[e.d] = (counts[e.d] || 0) + 1; });
    var start = SC.addDays(SC.weekStart(today), -7 * (weeks - 1)), grid = [];
    for (var w = 0; w < weeks; w++) {
      var col = [];
      for (var d = 0; d < 7; d++) { var iso = SC.addDays(start, w * 7 + d); col.push({ d: iso, n: iso > today ? -1 : counts[iso] || 0 }); }
      grid.push(col);
    }
    return grid;
  };
  SC.pipeline = function (apps) {
    var order = ["applied", "screening", "interview", "offer", "accepted"], reached = {};
    order.forEach(function (s) { reached[s] = 0; });
    (apps || []).forEach(function (a) {
      var hist = (a.history || []).map(function (h) { return h.stage; }), top = -1;
      hist.forEach(function (s) { top = Math.max(top, order.indexOf(s)); });
      for (var i = 0; i <= top; i++) reached[order[i]]++;
    });
    return order.map(function (s, i) { var prev = i ? reached[order[i - 1]] : 0; return { stage: s, n: reached[s], rate: i && prev ? Math.round(100 * reached[s] / prev) : null }; });
  };
  SC.todayPlan = function (apps, sprint, today) {
    var out = [], wk = SC.sprintWeek(sprint.log, sprint.goals, today);
    SC.dueFollowUps(apps, today).forEach(function (a) {
      var late = SC.daysBetween(a.followUp, today);
      out.push({ kind: "follow", pri: 0, text: (a.followNote || "Follow up") + ": " + (a.company || a.role), meta: late > 0 ? late + " day" + (late > 1 ? "s" : "") + " late" : "due today", href: "#/tracker" });
    });
    apps.filter(function (a) { return a.stage === "interview"; }).forEach(function (a) { out.push({ kind: "prep", pri: 1, text: "Practice for the " + (a.role || "") + " interview at " + (a.company || "?"), meta: "mock interview", href: "#/interview/mock" }); });
    apps.filter(function (a) { return a.stage === "wishlist" && a.history[0] && SC.daysBetween(a.history[0].date, today) >= 3; }).slice(0, 3).forEach(function (a) {
      out.push({ kind: "apply", pri: 2, text: "Apply to " + (a.company || a.role) + " or drop it", meta: "on your wishlist " + SC.daysBetween(a.history[0].date, today) + " days", href: "#/match" });
    });
    SC.SPRINT_TYPES.forEach(function (t) {
      var p = wk.per[t[0]]; if (p.today > 0) out.push({ kind: "goal-" + t[0], pri: 3, text: { apps: "Send " + p.today + " application" + (p.today > 1 ? "s" : ""), follow: "Send " + p.today + " follow-up" + (p.today > 1 ? "s" : ""), net: "Send " + p.today + " networking message" + (p.today > 1 ? "s" : "") }[t[0]], meta: p.left + " left this week", href: { apps: "#/match", follow: "#/tracker", net: "#/network" }[t[0]] });
    });
    return out.sort(function (a, b) { return a.pri - b.pri; });
  };

  /* ================= mock interview ================= */
  SC.mockScore = function (answers) {
    var rub = SC.data.rubric, by = {}, tot = 0, max = 0, scored = 0;
    rub.forEach(function (r) { by[r.id] = { sum: 0, n: 0, name: r.name }; });
    (answers || []).forEach(function (a) {
      var s = a.scores || {}, any = false;
      rub.forEach(function (r) { var v = s[r.id]; if (v === 0 || v === 1 || v === 2) { any = true; by[r.id].sum += v; by[r.id].n++; tot += v; max += 2; } });
      if (any) scored++;
    });
    var crit = rub.map(function (r) { var b = by[r.id]; return { id: r.id, name: r.name, pct: b.n ? Math.round(50 * b.sum / b.n) : null }; });
    var weakest = crit.filter(function (c) { return c.pct !== null && c.pct < 75; }).sort(function (a, b) { return a.pct - b.pct; });
    var pct = max ? Math.round(100 * tot / max) : 0;
    return { pct: pct, scored: scored, crit: crit, weakest: weakest, drills: weakest.slice(0, 3).map(function (c) { return { id: c.id, name: c.name, text: SC.data.drills[c.id] }; }),
      verdict: !scored ? "Not scored yet" : pct >= 80 ? "Interview ready" : pct >= 60 ? "Close: sharpen the weak spots" : "Keep practising: work the drills below" };
  };
  SC.answerRating = function (scores) {
    var t = 0, n = 0; SC.data.rubric.forEach(function (r) { var v = (scores || {})[r.id]; if (v === 0 || v === 1 || v === 2) { t += v; n += 2; } });
    return n ? 1 + Math.round(4 * t / n) : 0;
  };
  SC.pickMock = function (questions, role, n, rnd) {
    rnd = rnd || Math.random;
    var pool = questions.filter(function (q) { return q.role === role; }), out = [];
    function take(list, k) { list = list.filter(function (q) { return out.indexOf(q) === -1; }); for (var i = 0; i < k && list.length; i++) out.push(list.splice(Math.floor(rnd() * list.length), 1)[0]); }
    if (role !== "general" && n >= 3) take(questions.filter(function (q) { return q.role === "general" && q.type === "M"; }).slice(0, 6), 1);
    take(pool, n - out.length);
    take(questions.filter(function (q) { return q.role === "general"; }), n - out.length);
    return out;
  };

  /* ================= fill-in templates and LinkedIn ================= */
  SC.templateFields = function (tpl) { var out = []; String(tpl || "").replace(/\{(\w+)\}/g, function (m, k) { if (out.indexOf(k) === -1) out.push(k); return m; }); return out; };
  SC.fieldLabel = function (k) { var s = k.replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); };
  SC.fillTemplate = function (tpl, vals) {
    vals = vals || {};
    return String(tpl || "").replace(/\{(\w+)\}/g, function (m, k) { return nz(vals[k]) || "[" + k.replace(/_/g, " ") + "]"; });
  };
  SC.blanksLeft = function (text) { return (String(text).match(/\[[a-z0-9 ]+\]/g) || []).length; };
  SC.charCount = function (text, limit) { var n = String(text || "").length; return { n: n, limit: limit, left: limit ? limit - n : null, over: !!limit && n > limit }; };
  SC.liAbout = function (v) {
    v = v || {};
    var proof = String(v.proof || "").split(/\n/).map(nz).filter(Boolean);
    return [nz(v.hook), nz(v.story), proof.length ? "What I've done:\n" + proof.map(function (p) { return "- " + p.replace(/[.]$/, ""); }).join("\n") : "", nz(v.skills) ? "Skills: " + nz(v.skills) : "", nz(v.cta)].filter(Boolean).join("\n\n");
  };
  SC.LI = { headline: 220, about: 2600, note: 200, seeMore: 220 };

  /* ATS X-ray: writes the resume as the plain text the app exports, reads it back with this app's own import parser, and
     reports what came through. A simple parser losing a field is a hint that some applicant systems may too; real systems differ. */
  SC.atsXray = function (R) {
    var text = SC.resumeText(R), back = SC.parseResume(text).resume, rows = [];
    function low(s) { return nz(s).toLowerCase().replace(/\s+/g, " "); }
    function row(label, yours, read, ok) { if (nz(yours)) rows.push({ label: label, yours: nz(yours), read: nz(read), ok: !!ok }); }
    ["name", "email", "phone", "location"].forEach(function (k) { row(k.charAt(0).toUpperCase() + k.slice(1), R[k], back[k], low(R[k]) === low(back[k]) || (k === "name" && low(back.name) === low(R.name))); });
    row("Summary", R.summary, back.summary, low(back.summary).indexOf(low(R.summary).slice(0, 60)) >= 0);
    var mine = uniq(nz(R.skills).split(/\s*[,;\n]\s*/).map(nz).filter(Boolean)), got = nz(back.skills).toLowerCase();
    if (mine.length) { var hit = mine.filter(function (s) { return got.indexOf(s.toLowerCase()) >= 0; }); row("Skills", mine.length + " listed", hit.length + " read", hit.length === mine.length); }
    (R.experience || []).filter(function (e) { return nz(e.role) || nz(e.company); }).forEach(function (e, i) {
      var b = (back.experience || [])[i] || {}, bl = (e.bullets || []).map(nz).filter(Boolean).length, gl = (b.bullets || []).length;
      var who = (nz(e.role) || nz(e.company)), okRole = low(b.role) === low(e.role) || low(b.company) === low(e.company);
      row("Job " + (i + 1) + ": title and employer", who + (nz(e.company) && nz(e.role) ? ", " + nz(e.company) : ""), [b.role, b.company].map(nz).filter(Boolean).join(", "), okRole);
      if (nz(e.start) || nz(e.end)) row("Job " + (i + 1) + ": dates", [e.start, e.end].map(nz).filter(Boolean).join(" - "), [b.start, b.end].map(nz).filter(Boolean).join(" - "), low(b.start) === low(e.start) && low(b.end) === low(e.end));
      if (bl) row("Job " + (i + 1) + ": bullets", bl + " bullets", gl + " read", gl === bl);
    });
    var ed = (R.education || []).filter(function (e) { return nz(e.school) || nz(e.degree); });
    if (ed.length) row("Education", ed.length + (ed.length === 1 ? " entry" : " entries"), (back.education || []).length + " read", (back.education || []).length === ed.length);
    var cl = nz(R.certs).split("\n").map(nz).filter(Boolean).length;
    if (cl) row("Certifications", cl + " listed", nz(back.certs).split("\n").map(nz).filter(Boolean).length + " read", nz(back.certs).split("\n").map(nz).filter(Boolean).length === cl);
    var ok = rows.filter(function (r) { return r.ok; }).length;
    return { rows: rows, ok: ok, total: rows.length, pct: rows.length ? Math.round(ok / rows.length * 100) : 0, text: text };
  };
})();
