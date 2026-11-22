/* Stark Career engine: pure, rule-based logic (no AI, no network). Runs in the browser and in node tests. */
var SC = window.SC || (window.SC = {}); SC.data = SC.data || {};
(function () {
  "use strict";

  SC.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  /* ---------- text helpers ---------- */
  var STOP = {};
  ("a an and are as at be been but by can for from had has have he her his i if in into is it its may more most " +
   "must no not of on or our out she so such than that the their them then there these they this those to up us was we were " +
   "what when where which while who will with would you your about above across after all also am any because before being " +
   "between both did do does doing down during each few how just me my myself off once only other over own same should some " +
   "too under until very why able ability including include includes within without per via etc").split(" ").forEach(function (w) { STOP[w] = 1; });
  var FILLER = {};
  ("experience experienced work working works team teams role roles job position candidate candidates company looking seeking " +
   "required requirements preferred responsibilities qualifications strong good great excellent plus join apply opportunity " +
   "years year new help support using use used day days time employer equal opportunity benefits salary full part " +
   "environment skills skill knowledge looking ideal successful will requires require hiring hire").split(" ").forEach(function (w) { FILLER[w] = 1; FILLER[stem(w)] = 1; });

  function tokens(text) {
    return (String(text || "").toLowerCase().match(/[a-z0-9][a-z0-9+#.\/]*[a-z0-9+#]|[a-z0-9]/g) || []);
  }
  function stem(w) {
    if (/[+#.\/\d]/.test(w)) return w;
    if (w.length > 5 && /ies$/.test(w)) return w.slice(0, -3) + "y";
    if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
    else if (w.length > 4 && /ed$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    if (w.length > 4 && /e$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  SC.words = function (text) { var m = String(text || "").trim().match(/\S+/g); return m ? m.length : 0; };
  SC.stem = stem; SC.tokens = tokens;

  /* ---------- job match ---------- */
  var phraseCache = null;
  function phrases() {
    if (!phraseCache) {
      phraseCache = (SC.data.skills || []).map(function (p) {
        var st = tokens(p).map(stem);
        return { text: p, key: " " + st.join(" ") + " ", single: st.length === 1, stem: st[0] };
      });
    }
    return phraseCache;
  }
  function stems(text) { return tokens(text).map(stem); }
  SC.stemList = stems;

  SC.keywords = function (jobText, limit) {
    var toks = tokens(jobText), st = toks.map(stem), joined = " " + st.join(" ") + " ";
    var map = {}, i, w, s;
    for (i = 0; i < toks.length; i++) {
      w = toks[i]; s = st[i];
      if (STOP[w] || FILLER[w] || FILLER[s] || (w.length < 3 && !/[+#]/.test(w)) || /^\d+$/.test(w)) continue;
      if (!map[s]) map[s] = { key: s, label: w, count: 0, weight: 0, phrase: false };
      map[s].count++;
    }
    var out = [];
    Object.keys(map).forEach(function (k) { var m = map[k]; m.weight = Math.min(m.count, 3); out.push(m); });
    var skillSingles = {};
    phrases().forEach(function (p) {
      if (p.single) { skillSingles[p.stem] = 1; return; }
      var idx = 0, n = 0;
      while ((idx = joined.indexOf(p.key, idx)) !== -1) { n++; idx += p.key.length - 1; }
      if (n) out.push({ key: p.key.trim(), label: p.text, count: n, weight: 3 + Math.min(n, 3), phrase: true });
    });
    out.forEach(function (m) { if (!m.phrase && skillSingles[m.key]) m.weight += 2; });
    out.sort(function (a, b) { return b.weight - a.weight || (a.label < b.label ? -1 : 1); });
    return out.slice(0, limit || 35);
  };

  SC.matchJob = function (resumeText, jobText) {
    var kws = SC.keywords(jobText, 35);
    var rs = stems(resumeText), rset = {}, rjoined = " " + rs.join(" ") + " ";
    rs.forEach(function (s) { rset[s] = 1; });
    var matched = [], missing = [], tot = 0, got = 0;
    kws.forEach(function (k) {
      var hit = k.phrase ? rjoined.indexOf(" " + k.key + " ") !== -1 : !!rset[k.key];
      tot += k.weight;
      if (hit) { got += k.weight; matched.push(k); } else missing.push(k);
    });
    var score = tot ? Math.round(100 * got / tot) : 0;
    var band = !tot ? "none" : score >= 75 ? "strong" : score >= 50 ? "fair" : "weak";
    return { score: score, band: band, matched: matched, missing: missing, total: kws.length };
  };

  /* ---------- bullet coach ---------- */
  var verbSet = null;
  function verbs() { if (!verbSet) { verbSet = {}; (SC.data.verbs || []).forEach(function (v) { verbSet[v] = 1; }); } return verbSet; }

  SC.coachBullet = function (raw) {
    var text = String(raw || "").replace(/^[\s\-•*·>]+/, "").trim();
    var low = text.toLowerCase(), wc = SC.words(text);
    var first = (tokens(text)[0] || "");
    var checks = [], score = 0;
    var weak = null;
    (SC.data.weakStarts || []).forEach(function (p) { if (!weak && (low === p || low.indexOf(p + " ") === 0)) weak = p; });
    var strong = !weak && !!verbs()[first];
    checks.push({ id: "verb", ok: strong, pts: 30, msg: strong ? "Starts with an action verb (" + first + ")." :
      weak ? "Starts with a weak phrase (\"" + weak + "\"). Lead with what you did: built, led, cut, grew." :
      "Start with a strong past-tense action verb, such as led, built, reduced or launched." });
    var real = text.replace(/\[[^\]]*\]/g, " "), holes = real !== text;
    var num = /\d|%|\$|\b(?:dozens?|hundreds?|thousands?|millions?|double[ds]?|tripled|halved)\b/i.test(real);
    checks.push({ id: "number", ok: num, pts: 30, msg: num ? "Includes a number or scale." :
      "Add a number: how many, how much, how often, how fast or what size." });
    var lenOk = wc >= 8 && wc <= 30;
    checks.push({ id: "length", ok: lenOk, pts: 25, msg: wc === 0 ? "Empty bullet." :
      wc < 8 ? "Too short (" + wc + " words). Add the result or how you did it." :
      wc > 30 ? "Too long (" + wc + " words). Split it or cut it to 30 words or fewer." :
      "Good length (" + wc + " words)." });
    var bad = [];
    (SC.data.weakWords || []).forEach(function (p) { if (new RegExp("\\b" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(text)) bad.push(p); });
    if (/\b(i|my|me|myself)\b/i.test(text)) bad.push("first person (I, my)");
    checks.push({ id: "clean", ok: bad.length === 0, pts: 15, msg: bad.length ? "Cut vague or filler wording: " + bad.join(", ") + "." : "No filler or first-person wording." });
    checks.forEach(function (c) { if (c.ok) score += c.pts; });
    if (holes) { checks.push({ id: "fill", ok: false, pts: 0, msg: "Replace the [bracketed] placeholders with your real numbers, or cut them." }); score = Math.min(score, 55); }
    if (wc === 0) score = 0;
    return { text: text, words: wc, score: score, checks: checks, grade: score >= 85 ? "strong" : score >= 60 ? "ok" : "weak" };
  };

  SC.coachList = function (bullets) {
    var list = (bullets || []).map(function (b) { return String(b || "").trim(); }).filter(Boolean);
    var res = list.map(SC.coachBullet), starts = {}, repeats = [], withNum = 0, total = 0;
    res.forEach(function (r) {
      total += r.score; if (r.checks[1].ok) withNum++;
      var f = tokens(r.text)[0]; if (f) { starts[f] = (starts[f] || 0) + 1; }
    });
    Object.keys(starts).forEach(function (k) { if (starts[k] > 1) repeats.push(k); });
    return { items: res, avg: res.length ? Math.round(total / res.length) : 0, numberShare: res.length ? Math.round(100 * withNum / res.length) : 0, repeatedVerbs: repeats };
  };

  /* ---------- resume model and templates ---------- */
  SC.TEMPLATES = [
    { id: "classic", name: "Classic", note: "Centered header, serif, thin rules. The safe default." },
    { id: "modern", name: "Modern", note: "Sans-serif with a teal accent bar under your name." },
    { id: "compact", name: "Compact", note: "Tight spacing to fit more on one page." },
    { id: "executive", name: "Executive", note: "Large serif name, spaced capitals, quiet navy." },
    { id: "minimal", name: "Minimal", note: "Light and airy, no rules at all." },
    { id: "bold", name: "Bold", note: "Heavy section bands for fast scanning." },
    { id: "slate", name: "Slate", note: "Clean sans, slate headings with a short accent rule.", fresh: true },
    { id: "harbor", name: "Harbor", note: "Navy name, a fine top band, crisp dates.", fresh: true },
    { id: "ledger", name: "Ledger", note: "Serif body, small-caps sans headings.", fresh: true },
    { id: "atlas", name: "Atlas", note: "Centered name, hairline dividers, airy.", fresh: true },
    { id: "nordic", name: "Nordic", note: "Soft grey labels, generous white space.", fresh: true },
    { id: "signal", name: "Signal", note: "Accent bar on every heading. Modern and loud.", fresh: true }
  ];
  SC.ACCENTS = [["teal", "#0f766e"], ["navy", "#1e3a8a"], ["plum", "#6b2160"], ["rust", "#9a3412"], ["forest", "#166534"], ["graphite", "#334155"]];

  SC.blankResume = function () {
    return { name: "", title: "", email: "", phone: "", location: "", links: "", summary: "", skills: "",
      experience: [], education: [], certs: "", template: "classic" };
  };
  SC.sampleResume = function () {
    return { name: "Jordan Ellis", title: "Operations Coordinator", email: "jordan.ellis@example.com", phone: "555-0142",
      location: "Columbus, OH", links: "linkedin.com/in/jordanellis",
      summary: "Operations coordinator with 6 years in logistics and customer service. Cut shipping errors by 31%, trained 14 new hires and kept on-time delivery above 97%. Looking to bring steady, detail-focused operations work to a growing regional carrier.",
      skills: "Project management, Excel, Inventory control, Customer service, Scheduling, Process improvement, Team leadership",
      experience: [
        { role: "Operations Coordinator", company: "Brightway Freight", loc: "Columbus, OH", start: "Mar 2021", end: "Present",
          bullets: ["Reduced shipping errors by 31% by building a double-check workflow for 40 daily orders", "Trained 14 new hires on warehouse software, cutting onboarding time from 3 weeks to 2", "Managed a $180K annual supplies budget and saved $22K through vendor renegotiation", "Scheduled 12 drivers across 3 routes and kept on-time delivery above 97% for eight straight months", "Wrote the weekly inventory report that leadership used to plan purchasing for two warehouses"] },
        { role: "Customer Service Representative", company: "Northline Supply", loc: "Dayton, OH", start: "Jun 2018", end: "Feb 2021",
          bullets: ["Resolved 60+ customer calls per day with a 96% satisfaction score", "Documented 25 recurring order problems in a shared log that the sales team used to fix three root causes", "Responsible for various customer issues"] }
      ],
      education: [{ school: "Ohio State University", degree: "B.S. Business Administration", year: "2018", notes: "" }],
      certs: "Lean Six Sigma Green Belt, 2022", template: "classic" };
  };

  function nz(s) { return String(s == null ? "" : s).trim(); }
  function lines(s) { return nz(s).split(/\r?\n/).map(nz).filter(Boolean); }
  SC.resumeText = function (m) {
    var out = [], c = [m.location, m.email, m.phone, m.links].map(nz).filter(Boolean);
    if (nz(m.name)) out.push(nz(m.name).toUpperCase());
    if (nz(m.title)) out.push(nz(m.title));
    if (c.length) out.push(c.join(" | "));
    if (nz(m.summary)) out.push("", "SUMMARY", nz(m.summary));
    if (nz(m.skills)) out.push("", "SKILLS", nz(m.skills));
    var ex = (m.experience || []).filter(function (e) { return nz(e.role) || nz(e.company); });
    if (ex.length) {
      out.push("", "EXPERIENCE");
      ex.forEach(function (e) {
        out.push(nz(e.role) + (nz(e.company) ? ", " + nz(e.company) : "") + (nz(e.loc) ? ", " + nz(e.loc) : "") +
          ((nz(e.start) || nz(e.end)) ? " (" + nz(e.start) + " - " + nz(e.end) + ")" : ""));
        (e.bullets || []).map(nz).filter(Boolean).forEach(function (b) { out.push("- " + b); });
      });
    }
    var ed = (m.education || []).filter(function (e) { return nz(e.school) || nz(e.degree); });
    if (ed.length) {
      out.push("", "EDUCATION");
      ed.forEach(function (e) { out.push([nz(e.degree), nz(e.school), nz(e.year)].filter(Boolean).join(", ") + (nz(e.notes) ? " - " + nz(e.notes) : "")); });
    }
    if (nz(m.certs)) { out.push("", "CERTIFICATIONS"); lines(m.certs).forEach(function (l) { out.push("- " + l); }); }
    return out.join("\n");
  };

  SC.renderResume = function (m, tplId) {
    var E = SC.esc, id = SC.TEMPLATES.some(function (t) { return t.id === tplId; }) ? tplId : "classic";
    var h = [], c = [m.location, m.email, m.phone, m.links].map(nz).filter(Boolean);
    h.push('<article class="resume tpl-' + id + '">');
    h.push("<header>");
    h.push("<h1>" + E(nz(m.name) || "Your Name") + "</h1>");
    if (nz(m.title)) h.push('<p class="r-title">' + E(nz(m.title)) + "</p>");
    if (c.length) h.push('<p class="r-contact">' + c.map(E).join(' <span aria-hidden="true">|</span> ') + "</p>");
    h.push("</header>");
    if (nz(m.summary)) h.push("<section><h2>Summary</h2><p>" + E(nz(m.summary)) + "</p></section>");
    if (nz(m.skills)) h.push("<section><h2>Skills</h2><p>" + E(nz(m.skills)) + "</p></section>");
    var ex = (m.experience || []).filter(function (e) { return nz(e.role) || nz(e.company); });
    if (ex.length) {
      h.push("<section><h2>Experience</h2>");
      ex.forEach(function (e) {
        var bl = (e.bullets || []).map(nz).filter(Boolean), dates = [nz(e.start), nz(e.end)].filter(Boolean).join(" - ");
        h.push('<div class="job"><div class="job-head"><h3>' + E(nz(e.role)) + "</h3>" + (dates ? '<span class="dates">' + E(dates) + "</span>" : "") + "</div>");
        var sub = [nz(e.company), nz(e.loc)].filter(Boolean).join(", ");
        if (sub) h.push('<p class="job-sub">' + E(sub) + "</p>");
        if (bl.length) h.push("<ul>" + bl.map(function (b) { return "<li>" + E(b) + "</li>"; }).join("") + "</ul>");
        h.push("</div>");
      });
      h.push("</section>");
    }
    var ed = (m.education || []).filter(function (e) { return nz(e.school) || nz(e.degree); });
    if (ed.length) {
      h.push("<section><h2>Education</h2>");
      ed.forEach(function (e) {
        h.push('<div class="job"><div class="job-head"><h3>' + E(nz(e.degree)) + "</h3>" + (nz(e.year) ? '<span class="dates">' + E(nz(e.year)) + "</span>" : "") + "</div>" +
          (nz(e.school) ? '<p class="job-sub">' + E(nz(e.school)) + "</p>" : "") + (nz(e.notes) ? "<p>" + E(nz(e.notes)) + "</p>" : "") + "</div>");
      });
      h.push("</section>");
    }
    if (nz(m.certs)) h.push("<section><h2>Certifications</h2><ul>" + lines(m.certs).map(function (l) { return "<li>" + E(l) + "</li>"; }).join("") + "</ul></section>");
    h.push("</article>");
    return h.join("");
  };

  /* Design mode: a two-column layout for handing over in person. Not for ATS uploads (the UI says so). */
  SC.renderDesign = function (m, accent) {
    var E = SC.esc, col = (SC.ACCENTS.filter(function (a) { return a[0] === accent; })[0] || SC.ACCENTS[0])[1];
    var name = nz(m.name) || "Your Name", ini = name.split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
    var c = [m.email, m.phone, m.location, m.links].map(nz).filter(Boolean);
    var skills = nz(m.skills).split(/[,;\n]/).map(nz).filter(Boolean);
    var ex = (m.experience || []).filter(function (e) { return nz(e.role) || nz(e.company); });
    var ed = (m.education || []).filter(function (e) { return nz(e.school) || nz(e.degree); });
    var h = ['<article class="design" style="--dz:' + col + '"><aside class="dz-side"><div class="dz-mono">' + E(ini) + "</div>"];
    if (c.length) h.push("<h2>Contact</h2>" + c.map(function (x) { return "<p>" + E(x) + "</p>"; }).join(""));
    if (skills.length) h.push('<h2>Skills</h2><p class="dz-tags">' + skills.map(function (s) { return "<span>" + E(s) + "</span>"; }).join("") + "</p>");
    if (ed.length) h.push("<h2>Education</h2>" + ed.map(function (e) { return "<p><b>" + E(nz(e.degree)) + "</b><br>" + E([nz(e.school), nz(e.year)].filter(Boolean).join(", ")) + "</p>"; }).join(""));
    if (nz(m.certs)) h.push("<h2>Certifications</h2>" + lines(m.certs).map(function (l) { return "<p>" + E(l) + "</p>"; }).join(""));
    h.push('</aside><div class="dz-main"><header><h1>' + E(name) + "</h1>" + (nz(m.title) ? '<p class="dz-title">' + E(nz(m.title)) + "</p>" : "") + "</header>");
    if (nz(m.summary)) h.push('<p class="dz-sum">' + E(nz(m.summary)) + "</p>");
    if (ex.length) {
      h.push("<h2>Experience</h2>");
      ex.forEach(function (e) {
        var dates = [nz(e.start), nz(e.end)].filter(Boolean).join(" - "), bl = (e.bullets || []).map(nz).filter(Boolean);
        h.push('<div class="dz-job"><p class="dz-when">' + E(dates) + "</p><h3>" + E(nz(e.role)) + "</h3><p class=\"dz-co\">" + E([nz(e.company), nz(e.loc)].filter(Boolean).join(", ")) + "</p>" +
          (bl.length ? "<ul>" + bl.map(function (b) { return "<li>" + E(b) + "</li>"; }).join("") + "</ul>" : "") + "</div>");
      });
    }
    h.push("</div></article>");
    return h.join("");
  };

  SC.atsCheck = function (m) {
    var items = [], bullets = [], ex = (m.experience || []).filter(function (e) { return nz(e.role) || nz(e.company); });
    ex.forEach(function (e) { (e.bullets || []).forEach(function (b) { if (nz(b)) bullets.push(b); }); });
    function add(ok, msg) { items.push({ ok: ok, msg: msg }); }
    add(!!nz(m.name), "Your name is at the top.");
    add(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nz(m.email)), "A plain email address is present.");
    add(nz(m.phone).replace(/\D/g, "").length >= 7, "A phone number is present.");
    add(ex.length > 0, "At least one job is listed under Experience.");
    add((m.education || []).some(function (e) { return nz(e.school) || nz(e.degree); }), "Education is listed.");
    add(nz(m.skills).split(/[,;\n]/).filter(function (s) { return nz(s); }).length >= 5, "Skills lists at least 5 items.");
    add(bullets.length >= 3, "There are at least 3 bullet points.");
    var t = SC.resumeText(m), wc = SC.words(t);
    add(wc >= 150 && wc <= 900, "Length looks right for 1 to 2 pages (" + wc + " words).");
    var passed = items.filter(function (i) { return i.ok; }).length;
    return { items: items, passed: passed, total: items.length, words: wc };
  };

  /* ---------- cover letter ---------- */
  SC.blankLetter = function () {
    return { name: "", contact: "", date: "", recipient: "", company: "", role: "", hook: "", why: "", proof1: "", proof2: "", close: "" };
  };
  SC.sampleLetter = function () {
    return { name: "Jordan Ellis", contact: "jordan.ellis@example.com | 555-0142", date: "", recipient: "Ms. Alvarez", company: "Harbor Logistics", role: "Operations Coordinator",
      hook: "Last year I cut shipping errors by 31% at a freight company, and I would like to bring the same attention to detail to Harbor Logistics as your next Operations Coordinator.",
      why: "Harbor's same-day delivery promise depends on a warehouse that runs without surprises, and that is the kind of operation I enjoy building. I have followed your expansion into three new regions, and I admire how you kept service levels steady while you grew. Your focus on reliable delivery is exactly why this Operations Coordinator role stands out to me among the openings I have seen this year.",
      proof1: "At Brightway Freight I built a double-check workflow for 40 daily orders, which removed 31% of shipping errors in four months. The change cost nothing to run, and it gave the floor team a simple checklist they kept using after I moved on to other projects.",
      proof2: "I also trained 14 new hires on our warehouse software and cut onboarding from three weeks to two. Along the way I wrote the training guide that the whole department now uses, and I learned how to explain a process clearly to people who are new to it.",
      close: "I would welcome a conversation about how I can help your team hit its delivery targets this year, and I am happy to share my double-check workflow as a starting point. Thank you for your time and consideration." };
  };
  SC.letterText = function (l) {
    var g = nz(l.recipient) ? "Dear " + nz(l.recipient) + "," : "Dear Hiring Manager,";
    var paras = [l.hook, l.why, l.proof1 && l.proof2 ? l.proof1 + " " + l.proof2 : (l.proof1 || l.proof2), l.close].map(nz).filter(Boolean);
    var head = [nz(l.name), nz(l.contact), nz(l.date)].filter(Boolean).join("\n");
    return (head ? head + "\n\n" : "") + g + "\n\n" + paras.join("\n\n") + "\n\nSincerely,\n" + nz(l.name);
  };
  SC.coverCheck = function (text, ctx) {
    ctx = ctx || {}; text = String(text || "");
    var wc = SC.words(text), low = text.toLowerCase(), items = [];
    function add(ok, msg) { items.push({ ok: ok, msg: msg }); }
    add(wc >= 220 && wc <= 400, wc < 220 ? "Too short (" + wc + " words). Aim for 250 to 350." : wc > 400 ? "Too long (" + wc + " words). Keep it to one page, under 400 words." : "Length is right (" + wc + " words).");
    var co = nz(ctx.company).toLowerCase(), ro = nz(ctx.role).toLowerCase();
    add(!!co && low.indexOf(co) !== -1, "Names the company" + (co ? "" : " (fill in the company field)") + ".");
    add(!!ro && low.indexOf(ro) !== -1, "Names the role" + (ro ? "" : " (fill in the role field)") + ".");
    add(!/to whom it may concern|dear sir|dear madam/.test(low), "Avoids \"To Whom It May Concern\". Find a name or use \"Dear Hiring Manager\".");
    var body = text.split(/\n\n+/).filter(function (p) { return p.length > 60; });
    var open = body.length ? body[0].toLowerCase() : "";
    add(!/^(i am writing to|i am writing in|i would like to apply|my name is|i am applying)/.test(open), "Opens with a hook, not \"I am writing to apply\".");
    add(/\d|%|\$/.test(text), "Backs a claim with a number or specific result.");
    var sents = text.split(/[.!?]+\s+/).filter(function (s) { return s.length > 3; });
    var iStarts = sents.filter(function (s) { return /^i\b/i.test(s.trim()); }).length;
    add(sents.length === 0 || iStarts / sents.length <= 0.5, "Not every sentence starts with \"I\" (" + iStarts + " of " + sents.length + ").");
    add(/look forward|would welcome|happy to discuss|glad to discuss|talk further|conversation|discuss/.test(low), "Ends with a clear next step (a conversation).");
    var passed = items.filter(function (i) { return i.ok; }).length;
    return { items: items, passed: passed, total: items.length, words: wc };
  };

  /* ---------- tracker ---------- */
  SC.STAGES = ["wishlist", "applied", "screening", "interview", "offer", "accepted", "rejected", "withdrawn"];
  SC.STAGE_LABEL = { wishlist: "Wishlist", applied: "Applied", screening: "Screening", interview: "Interview", offer: "Offer", accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn" };
  SC.TRANSITIONS = {
    wishlist: ["applied", "withdrawn"],
    applied: ["screening", "interview", "rejected", "withdrawn"],
    screening: ["interview", "rejected", "withdrawn"],
    interview: ["offer", "rejected", "withdrawn"],
    offer: ["accepted", "rejected", "withdrawn"],
    accepted: [], rejected: [], withdrawn: []
  };
  var FOLLOW = { applied: [7, "Check in on your application"], screening: [5, "Follow up after the screening call"],
    interview: [1, "Send a thank-you note"], offer: [3, "Reply to the offer"] };

  function pd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); if (!m) return null; var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 ? d : null; }
  SC.addDays = function (s, n) { var d = pd(s); if (!d) return null; d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  SC.daysBetween = function (a, b) { var x = pd(a), y = pd(b); return x && y ? Math.round((y - x) / 864e5) : null; };
  SC.today = function () { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };

  var uidN = 0;
  SC.uid = function () { uidN++; return "i" + Date.now().toString(36) + uidN.toString(36) + Math.floor(Math.random() * 1296).toString(36); };

  SC.newApp = function (o, today) {
    o = o || {}; var stage = SC.STAGES.indexOf(o.stage) >= 0 ? o.stage : "wishlist";
    var a = { id: o.id || SC.uid(), company: nz(o.company), role: nz(o.role), url: nz(o.url), notes: nz(o.notes), salary: nz(o.salary),
      stage: stage, history: [{ stage: stage, date: today || SC.today() }], contacts: [], followUp: null, followNote: "" };
    setFollow(a, today || SC.today());
    return a;
  };
  function setFollow(a, date) {
    var f = FOLLOW[a.stage];
    if (f) { a.followUp = SC.addDays(date, f[0]); a.followNote = f[1]; } else { a.followUp = null; a.followNote = ""; }
  }
  SC.canMove = function (a, to) { return (SC.TRANSITIONS[a.stage] || []).indexOf(to) >= 0; };
  SC.moveApp = function (a, to, date) {
    if (!SC.canMove(a, to)) throw new Error("Cannot move from " + a.stage + " to " + to);
    date = date || SC.today();
    var b = JSON.parse(JSON.stringify(a));
    b.stage = to; b.history.push({ stage: to, date: date }); setFollow(b, date);
    return b;
  };
  SC.dueFollowUps = function (apps, today) {
    return apps.filter(function (a) { return a.followUp && a.followUp <= today; })
      .sort(function (x, y) { return x.followUp < y.followUp ? -1 : x.followUp > y.followUp ? 1 : 0; });
  };
  SC.doneFollowUp = function (a) { var b = JSON.parse(JSON.stringify(a)); b.followUp = null; b.followNote = ""; return b; };
  SC.trackerStats = function (apps) {
    var by = {}; SC.STAGES.forEach(function (s) { by[s] = 0; }); apps.forEach(function (a) { by[a.stage]++; });
    var sent = apps.length - by.wishlist, responded = by.screening + by.interview + by.offer + by.accepted;
    return { by: by, total: apps.length, applied: sent, responseRate: sent ? Math.round(100 * responded / sent) : 0 };
  };

  /* ---------- salary negotiation ---------- */
  function roundTo(n, step) { return Math.round(n / step) * step; }
  /* Amount with the currency symbol chosen in the app (default $). Multi-letter codes get a space: "CHF 70,000". */
  function money(n, cur) {
    cur = cur || (SC.S && typeof SC.S.cur === "string" && SC.S.cur) || "$";
    var v = Math.round(+n || 0), s = Math.abs(v).toLocaleString("en-US");
    return (v < 0 ? "-" : "") + cur + (/[A-Za-z]$/.test(cur) && cur.length > 1 ? " " : "") + s;
  }
  SC.money = money;
  SC.negotiate = function (o) {
    var offer = +o.offer, target = +o.target || 0, low = +o.low || 0, high = +o.high || 0;
    if (!(offer > 0)) return { error: "Enter the offer amount." };
    var step = offer >= 50000 ? 500 : offer >= 1000 ? 100 : 1;
    var counter = Math.max(target, offer * 1.10), notes = [];
    if (high && counter > high) { counter = high; notes.push("Your counter was capped at the top of the market range you entered."); }
    counter = roundTo(counter, step);
    var meets = (target > 0 && offer >= target) || counter <= offer;
    if (meets) {
      counter = offer;
      notes.push("The offer already meets your target or the top of your range. Negotiate the rest: start date, bonus, equipment, remote days, review date, paid time off.");
    }
    if (low && offer < low) notes.push("The offer is below the market range you entered. Say so, politely, with your evidence.");
    var gap = counter - offer, pct = offer ? Math.round(1000 * gap / offer) / 10 : 0;
    var role = nz(o.role) || "the position", co = nz(o.company) || "the company", who = nz(o.contact) ? nz(o.contact) : "Hiring Manager";
    var pts = lines(o.points).map(function (p) { return p.replace(/[.\s]+$/, ""); });
    var evidence = pts.length ? pts.map(function (p) { return "- " + p; }).join("\n") : "- (add two or three results you will bring)";
    var scripts = {};
    scripts.email = "Subject: " + role + " offer\n\nDear " + who + ",\n\nThank you for the offer for " + role + " at " + co + ". I am excited about the work and the team, and I would like to make this work.\n\n" +
      (meets ? "The base salary is in line with what I was hoping for. Before I accept, I would like to talk through a few other terms: " + (nz(o.other) || "start date, review timeline and paid time off") + ".\n\n"
        : "Based on the scope of the role and what I bring, I was hoping for a base salary of " + money(counter) + ". Specifically:\n" + evidence + "\n\nIs there flexibility to move the base to " + money(counter) + "?\n\n") +
      "I am ready to accept as soon as we agree on the details. Thank you again.\n\nBest regards,\n" + (nz(o.name) || "[Your name]");
    scripts.phone = [
      "1. Open warm: \"Thank you. I'm excited about this role and about " + co + ".\"",
      meets ? "2. Ask about the rest: \"The salary works for me. Can we talk about " + (nz(o.other) || "start date and review timeline") + "?\""
        : "2. State your number once: \"Based on the scope and my results, I'm looking for " + money(counter) + ". Is there room to get there?\"",
      "3. Give evidence, briefly: " + (pts.length ? pts.join("; ") + "." : "name two or three results."),
      "4. Then stop talking. Silence is part of the process. Let them answer first.",
      "5. If the answer is no: \"I understand. Could we revisit salary after six months, or add " + (nz(o.other) || "an extra week of paid time off or a signing bonus") + "?\"",
      "6. Close: \"Thank you. May I have the final offer in writing? I would like a day to review it.\""
    ].join("\n");
    scripts.stall = "Thank you for the offer. I'm very interested. Could I have until " + (nz(o.deadline) || "[date]") + " to review the details and get back to you? I'll reply sooner if I can.";
    return { counter: counter, gap: gap, pct: pct, meets: meets, notes: notes, scripts: scripts };
  };
})();
