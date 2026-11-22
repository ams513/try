/* Stark Family Vault, by Stark: on-device intelligence. Fuzzy search, plain-language questions, a 12-month look ahead with pile-up and
   spend detection, gap finding and crisis drills. Pure functions over the decrypted vault: no DOM, no network, nothing leaves this computer. */
(function (root) {
  "use strict";
  var V = root.StarkVault || (typeof require === "function" ? require("./core.js") : null);
  var K = root.VaultKit || (typeof require === "function" ? require("./kit.js") : null);
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function list(x) { return Array.isArray(x) ? x : []; }
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function money(n) { return (Math.round(+n || 0)).toLocaleString("en-US"); }
  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }

  /* ---- fuzzy matching: exact, prefix, contained and typo-tolerant words, all of them required ---- */
  function lev(a, b, max) {
    var la = a.length, lb = b.length, prev, cur, i, j, best;
    if (Math.abs(la - lb) > max) return max + 1;
    prev = []; for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur = [i]; best = i;
      for (j = 1; j <= lb; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[lb];
  }
  function wordScore(q, w) {
    if (q === w) return 1;
    if (w.indexOf(q) === 0) return 0.9;
    if (q.length >= 3 && w.indexOf(q) !== -1) return 0.7;
    if (q.length >= 4 && lev(q, w, 1) <= 1) return 0.62;
    if (q.length >= 7 && lev(q, w, 2) <= 2) return 0.5;
    return 0;
  }
  function fuzzy(query, text) {
    var qs = norm(query).split(" ").filter(Boolean), ws = norm(text).split(" ").filter(Boolean), total = 0, i, j, b, s;
    if (!qs.length || !ws.length) return 0;
    for (i = 0; i < qs.length; i++) {
      b = 0;
      for (j = 0; j < ws.length; j++) { s = wordScore(qs[i], ws[j]); if (s > b) b = s; if (b === 1) break; }
      if (b === 0) return 0;
      total += b;
    }
    return total / qs.length;
  }

  /* ---- every searchable record, flattened. Password hints, scans, photos and ids are never included. ---- */
  var SKIP = { id: 1, person: 1, owner: 1, scan: 1, photo: 1, photo2: 1, photo3: 1, receipt: 1, data: 1, hint: 1, bag: 1 };
  function textOf(o, d) {
    if (o == null) return "";
    if (typeof o === "string" || typeof o === "number") return String(o);
    if (d > 4) return "";
    if (Array.isArray(o)) return o.map(function (x) { return textOf(x, d + 1); }).join(" ");
    if (isObj(o)) return Object.keys(o).filter(function (k) { return !SKIP[k]; }).map(function (k) { return textOf(o[k], d + 1); }).filter(Boolean).join(" ");
    return "";
  }
  function records(vault) {
    var out = [], pn = {};
    list(vault.people).forEach(function (p) { pn[p.id] = p.name; });
    function add(section, route, title, rec, who) { out.push({ section: section, route: route, title: String(title || ""), text: textOf(rec, 0) + (who ? " " + who : "") }); }
    list(vault.people).forEach(function (p) { add("Family", "family", p.name, p); });
    list(vault.docs).forEach(function (d) { add("Documents", "docs", d.title, d, pn[d.person]); });
    Object.keys(vault.health || {}).forEach(function (pid) { add("Health", "health", "Health summary: " + (pn[pid] || "Unknown"), vault.health[pid]); });
    list(vault.meds).forEach(function (m) { add("Medications", "health", m.name + (pn[m.person] ? " (" + pn[m.person] + ")" : ""), m); });
    list(vault.contacts).forEach(function (c) { add("Contacts", "money", c.name, c); });
    list(vault.accounts).forEach(function (a) { add("Accounts", "money", a.institution, a, pn[a.owner]); });
    list(vault.policies).forEach(function (p) { add("Insurance", "insurance", (p.insurer || "Policy") + " " + (p.type || ""), p, pn[p.person]); });
    list(vault.digital).forEach(function (d) { add("Digital", "digital", d.service, d, pn[d.person]); });
    list(vault.inventory).forEach(function (x) { add("Home inventory", "inventory", x.item, x); });
    list(vault.tasks).forEach(function (k) { add("Reminders", "reminders", k.title, k); });
    if (isObj(vault.emergency) && Object.keys(vault.emergency).length) add("Emergency plan", "emergency", "Emergency plan", vault.emergency);
    return out;
  }
  function fuzzySearch(vault, query, limit) {
    var out = [];
    records(vault).forEach(function (r) {
      var t = fuzzy(query, r.title), x = fuzzy(query, r.text), s = Math.max(t ? Math.min(1, t * 1.15) : 0, x * 0.85);
      if (s > 0) out.push({ section: r.section, route: r.route, title: r.title, score: s, snippet: r.text.slice(0, 110) });
    });
    out.sort(function (a, b) { return b.score - a.score || a.title.localeCompare(b.title); });
    return out.slice(0, limit || 20);
  }

  /* ---- plain-language questions ---- */
  function windowDays(n) {
    var m = n.match(/\b(?:next|within|in|coming)?\s*(\d{1,3})\s*(day|week|month|year)s?\b/), k;
    if (m) { k = +m[1] * ({ day: 1, week: 7, month: 30, year: 365 })[m[2]]; return k; }
    if (/\bthis week\b|\bnext week\b/.test(n)) return 7;
    if (/\bthis month\b|\bnext month\b/.test(n)) return 31;
    if (/\bthis year\b|\bnext year\b/.test(n)) return 365;
    return 90;
  }
  function personIn(vault, n) {
    var hit = null;
    list(vault.people).forEach(function (p) { var nm = norm(p.name); if (nm && (" " + n + " ").indexOf(" " + nm + " ") !== -1 && (!hit || nm.length > norm(hit.name).length)) hit = p; });
    return hit;
  }
  function item(title, detail, route) { return { title: title, detail: detail || "", route: route }; }
  function ask(vault, question, today) {
    var t = today || V.todayStr(), n = norm(question), who = personIn(vault, n), res, items, w, total, rooms, room, pol, ms, cs, ds, tops;
    function mine(p) { return !who || p === who.id || p === "household" || !p; }
    if (!n) return { intent: "none", answer: "Ask about dates, insurance cost, medicines, contacts, documents or what your things are worth.", items: [] };

    if (/\b(overdue|expired|late|missed|past due)\b/.test(n)) {
      res = K.allReminders(vault, t, { includeOk: false }).filter(function (r) { return r.state === "expired" && mine(r.person); });
      return { intent: "overdue", answer: res.length ? plural(res.length, "item") + " " + (res.length === 1 ? "is" : "are") + " overdue" + (who ? " for " + who.name : "") + "." : "Nothing is overdue" + (who ? " for " + who.name : "") + ".",
        items: res.slice(0, 12).map(function (r) { return item(r.title, K.dueText(r), r.route); }) };
    }
    if (/\b(expir\w*|renew\w*|due|refill\w*|run out|comes? up|coming up|ends?|deadlines?|what s next)\b/.test(n) && !/\b(premium|cost|pay)\b/.test(n)) {
      w = windowDays(n);
      res = K.allReminders(vault, t, { includeOk: true }).filter(function (r) { return r.state !== "expired" && r.days <= w && mine(r.person); });
      return { intent: "dates", answer: res.length ? plural(res.length, "date") + " in the next " + w + " days" + (who ? " for " + who.name : "") + ". First: " + res[0].title + ", " + K.dueText(res[0]).toLowerCase() + "." : "No dates fall in the next " + w + " days" + (who ? " for " + who.name : "") + ".",
        items: res.slice(0, 14).map(function (r) { return item(r.title, r.date + " · " + K.dueText(r), r.route); }) };
    }
    if (/\b(premium\w*|insurance|insured|policy|policies|cover\w*)\b/.test(n) && /\b(cost|pay|spend|spent|much|total|premium\w*|annual|year|month)\b/.test(n)) {
      pol = list(vault.policies).filter(function (p) { return mine(p.person); }); total = pol.reduce(function (s, p) { return s + K.annualPremium(p); }, 0);
      return { intent: "premiums", answer: pol.length ? "Recorded premiums come to about " + money(total) + " a year (" + money(total / 12) + " a month) across " + plural(pol.length, "policy") + "." : "No policies are recorded yet.",
        items: pol.sort(function (a, b) { return K.annualPremium(b) - K.annualPremium(a); }).map(function (p) { return item((p.insurer || "Policy") + " " + (p.type || ""), money(K.annualPremium(p)) + " a year" + (p.renews ? " · renews " + p.renews : ""), "insurance"); }) };
    }
    if (/\b(worth|value|valued|total|how much)\b/.test(n) && /\b(inventory|home|house|contents|things|stuff|belongings|items|room|kitchen|bedroom|garage|office|living|attic|basement|cellar)\b/.test(n) || /\bworth\b/.test(n)) {
      rooms = {}; list(vault.inventory).forEach(function (x) { if (x.room) rooms[norm(x.room)] = x.room; });
      room = Object.keys(rooms).filter(function (r) { return r && (" " + n + " ").indexOf(" " + r + " ") !== -1; })[0];
      items = list(vault.inventory).filter(function (x) { return !room || norm(x.room) === room; });
      if (!room) { var named = list(vault.inventory).filter(function (x) { return x.item && fuzzy(x.item, n) >= 0.9 && norm(x.item).length > 2; }); if (named.length && named.length < items.length) items = named; }
      total = K.invTotal(items);
      return { intent: "value", answer: items.length ? "Recorded value" + (room ? " in " + rooms[room] : "") + ": " + money(total) + " across " + plural(items.length, "item") + "." : "No matching items are recorded.",
        items: items.sort(function (a, b) { return K.invTotal([b]) - K.invTotal([a]); }).slice(0, 12).map(function (x) { return item(x.item, money(K.invTotal([x])) + (x.room ? " · " + x.room : ""), "inventory"); }) };
    }
    if (/\b(medic\w*|medicines?|pills?|drugs?|prescri\w*|tablets?|dose)\b/.test(n)) {
      ms = list(vault.meds).filter(function (m) { return m.active !== false && mine(m.person); });
      return { intent: "meds", answer: ms.length ? plural(ms.length, "medicine") + (who ? " for " + who.name : " in use") + "." : "No active medicines are recorded" + (who ? " for " + who.name : "") + ".",
        items: ms.map(function (m) { return item(m.name + (m.dose ? " " + m.dose : ""), [who ? "" : (list(vault.people).filter(function (p) { return p.id === m.person; })[0] || {}).name, m.how, m.refill ? "refill " + m.refill : ""].filter(Boolean).join(" · "), "health"); }) };
    }
    if (/\b(phone|call|number|contact\w*|reach|ring|email)\b/.test(n)) {
      cs = list(vault.contacts); tops = cs.filter(function (c) { return fuzzy(n, c.name + " " + (c.role || "")) > 0.5 || fuzzy(c.name, n) >= 0.9; });
      if (tops.length) cs = tops; else if (/\bemergency|urgent|ice\b/.test(n)) cs = cs.filter(function (c) { return c.emergency; });
      return { intent: "contacts", answer: cs.length ? plural(cs.length, "contact") + " found." : "No matching contacts are recorded.",
        items: cs.slice(0, 12).map(function (c) { return item(c.name, [c.role || c.rel, c.phone, c.email, c.emergency ? "emergency contact" : ""].filter(Boolean).join(" · "), "money"); }) };
    }
    if (/\b(documents?|docs?|passport\w*|licen[cs]e\w*|certificate\w*|deed\w*|title\w*|id)\b/.test(n)) {
      ds = list(vault.docs).filter(function (d) { return mine(d.person); }); tops = ds.filter(function (d) { return fuzzy(n.replace(/\b(documents?|docs?|where|is|are|the|my|our|show|find)\b/g, ""), d.title + " " + d.type) > 0.5; });
      if (tops.length) ds = tops;
      return { intent: "docs", answer: ds.length ? plural(ds.length, "document") + " found." : "No matching documents are recorded.",
        items: ds.slice(0, 12).map(function (d) { return item(d.title, [d.expires ? "expires " + d.expires : "", d.location ? "original: " + d.location : "original location not noted", d.scan ? "scan stored" : "no scan"].filter(Boolean).join(" · "), "docs"); }) };
    }
    res = fuzzySearch(vault, question, 8);
    return { intent: "search", answer: res.length ? "Closest matches for “" + String(question).trim() + "”." : "Nothing in the vault matched. Try fewer or shorter words.", items: res.map(function (r) { return item(r.title, r.section, r.route); }) };
  }

  /* ---- twelve months ahead: what comes due, what it costs, and where it piles up ---- */
  function ym(date) { return date.slice(0, 7); }
  function monthKey(y, m) { return y + "-" + ("0" + (m + 1)).slice(-2); }
  function forecast(vault, today, months) {
    var t = today || V.todayStr(), n = months || 12, y = +t.slice(0, 4), m = +t.slice(5, 7) - 1, buckets = [], idx = {}, i, pols, evs, hot = [], notes = [], counts, mean, sd, pm, tasks, d, guard;
    for (i = 0; i < n; i++) { var mm = (m + i) % 12, yy = y + Math.floor((m + i) / 12), k = monthKey(yy, mm); idx[k] = i; buckets.push({ key: k, label: MONTHS[mm] + " " + yy, short: MONTHS[mm], events: [], premium: 0, overdue: 0 }); }
    evs = K.allReminders(vault, t, { includeOk: true });
    evs.forEach(function (r) {
      var b = r.state === "expired" ? buckets[0] : buckets[idx[ym(r.date)]];
      if (!b || r.src === "task") return;
      b.events.push({ title: r.title, date: r.date, src: r.src, route: r.route, overdue: r.state === "expired" });
      if (r.state === "expired") b.overdue++;
    });
    tasks = list(vault.tasks);
    tasks.forEach(function (k) {
      var step = +k.repeat, dt = k.due, g = 0;
      if (!dt || isNaN(V.dayNum(dt))) return;
      if (V.dayNum(dt) < V.dayNum(t)) { buckets[0].events.push({ title: k.title, date: dt, src: "task", route: "reminders", overdue: true }); buckets[0].overdue++; if (!step) return; dt = K.nextDue(k, t); if (!dt) return; }
      while (dt && g++ < 200) {
        var b = buckets[idx[ym(dt)]];
        if (!b) { if (idx[ym(dt)] === undefined && V.dayNum(dt) > V.dayNum(t)) break; }
        else b.events.push({ title: k.title, date: dt, src: "task", route: "reminders", overdue: false });
        if (!step) break; dt = K.addMonths(dt, step);
      }
    });
    pols = list(vault.policies);
    pols.forEach(function (p) {
      var amt = +p.premium || 0, f = p.freq || "Yearly", start = p.renews && !isNaN(V.dayNum(p.renews)) ? +p.renews.slice(5, 7) - 1 : null, step = f === "Monthly" ? 1 : f === "Quarterly" ? 3 : f === "Twice a year" ? 6 : f === "Yearly" ? 12 : 0, j;
      if (!amt || !step) return;
      for (j = 0; j < n; j++) {
        var cm = (m + j) % 12;
        if (step === 1 || (start !== null && ((cm - start) % step + step) % step === 0)) buckets[j].premium += amt;
      }
    });
    buckets.forEach(function (b) { b.events.sort(function (a, c) { return a.date.localeCompare(c.date); }); b.count = b.events.length; });
    counts = buckets.map(function (b) { return b.count; }); mean = counts.reduce(function (s, c) { return s + c; }, 0) / n;
    sd = Math.sqrt(counts.reduce(function (s, c) { return s + (c - mean) * (c - mean); }, 0) / n);
    buckets.forEach(function (b) { if (b.count >= 4 && b.count >= mean + 1.5 * sd) { b.crunch = true; notes.push({ kind: "pileup", month: b.label, text: b.label + " is a pile-up: " + plural(b.count, "date") + " fall in one month, against an average of " + (Math.round(mean * 10) / 10) + "." }); } });
    pm = buckets.map(function (b) { return b.premium; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    if (pm.length >= 3) {
      var med = pm[Math.floor(pm.length / 2)];
      buckets.forEach(function (b) { if (b.premium >= med * 2 && b.premium - med >= 50) { b.spike = true; notes.push({ kind: "spend", month: b.label, text: b.label + " is a heavy month for premiums: about " + money(b.premium) + ", against a typical " + money(med) + "." }); } });
    }
    return { months: buckets, notes: notes, total: buckets.reduce(function (s, b) { return s + b.premium; }, 0), dates: buckets.reduce(function (s, b) { return s + b.count; }, 0), max: Math.max.apply(null, counts.concat([1])), maxPremium: Math.max.apply(null, buckets.map(function (b) { return b.premium; }).concat([1])) };
  }

  /* ---- gaps and oddities in what is recorded ---- */
  function maxNumberAfter(text, word) {
    var re = new RegExp(word + "[^0-9]{0,24}([0-9][0-9.,]*)", "ig"), m, best = null, v;
    while ((m = re.exec(String(text || "")))) { v = +m[1].replace(/,/g, ""); if (isFinite(v) && (best === null || v > best)) best = v; }
    return best;
  }
  function isAdult(p, t) { var a = K.ageOn(p.dob, t); return a === null || a >= 18; }
  function gaps(vault, today) {
    var t = today || V.todayStr(), out = [], pols = list(vault.policies), inv = K.invTotal(vault.inventory), contentsPol = pols.filter(function (p) { return /home|content|renter|tenant|property/i.test(p.type || ""); }), pn = {};
    list(vault.people).forEach(function (p) { pn[p.id] = p.name; });
    function add(id, level, title, detail, route) { out.push({ id: id, level: level, title: title, detail: detail, route: route }); }
    if (inv > 0 && !contentsPol.length) add("no-contents", "high", "Belongings recorded, no home or contents policy", "Your inventory totals about " + money(inv) + " but no home, renters or contents policy is recorded. If you have one, add it; if not, that is worth a conversation with an insurer or broker.", "insurance");
    contentsPol.forEach(function (p) {
      var lim = maxNumberAfter(p.cover, "content"), name = (p.insurer || "Policy") + " " + (p.type || "").toLowerCase();
      if (lim !== null && inv > lim) add("under-" + p.id, "high", "Inventory is above the contents limit you noted", "Your inventory totals about " + money(inv) + "; " + name + " notes a contents limit of " + money(lim) + ". Check the figures with your insurer.", "insurance");
    });
    pols.forEach(function (p) {
      var days = p.renews ? V.daysUntil(p.renews, t) : null, name = (p.insurer || "Policy") + " " + (p.type || "").toLowerCase();
      if (days !== null && days <= 30 && days >= -30 && !String(p.claims || "").trim()) add("claims-" + p.id, "med", "No claims contact on a policy that renews soon", name + " renews " + (days < 0 ? "was due" : "in " + plural(days, "day")) + " and has no claims phone or web address noted.", "insurance");
      if (/life|disab|income|long/i.test(p.type || "") && !String(p.beneficiaries || "").trim()) add("bene-" + p.id, "med", "No beneficiaries noted", name + " has no beneficiaries recorded.", "insurance");
      if ((+p.premium || 0) > 0 && !p.renews) add("norenew-" + p.id, "low", "Premium recorded without a renewal date", name + " costs money every period but has no renewal date, so it never appears in your look ahead.", "insurance");
    });
    list(vault.meds).forEach(function (m) {
      if (m.active === false) return;
      if (!m.refill) add("refill-" + m.id, "low", "Medicine without a refill date", m.name + " has no refill date, so it cannot remind you.", "health");
      else if (!String(m.pharmacy || "").trim() && V.daysUntil(m.refill, t) <= 14) add("pharm-" + m.id, "low", "Refill soon and no pharmacy noted", m.name + " is due for a refill and no pharmacy is recorded.", "health");
    });
    list(vault.people).forEach(function (p) {
      if (!isAdult(p, t)) return;
      var ids = list(vault.docs).filter(function (d) { return d.person === p.id && /passport|licen|id card|national id/i.test((d.type || "") + " " + (d.title || "")); });
      if (!ids.length) add("id-" + p.id, "med", p.name + " has no ID document recorded", "No passport, licence or ID card is recorded for " + p.name + ".", "docs");
      if (!(vault.health || {})[p.id]) add("health-" + p.id, "med", p.name + " has no health summary", "Allergies, blood type and conditions are what responders look for first.", "health");
    });
    list(vault.docs).forEach(function (d) {
      if (!d.scan && !String(d.location || "").trim()) add("loc-" + d.id, "low", "Document with no scan and no stated location", d.title + " has neither a scan nor a note about where the original is kept.", "docs");
    });
    var soon = K.allReminders(vault, t, { includeOk: true }).filter(function (r) { return (r.src === "doc" || r.src === "policy") && r.days >= 0 && r.days <= 120; }), w;
    for (w = 0; w < soon.length; w++) {
      var cluster = soon.filter(function (r) { return Math.abs(r.days - soon[w].days) <= 30; });
      if (cluster.length >= 3) { add("pileup", "med", "Several papers expire close together", plural(cluster.length, "document or policy") + " run out within about a month of " + soon[w].date + ": " + cluster.slice(0, 4).map(function (r) { return r.title; }).join(", ") + ". Start the earliest one now.", "reminders"); break; }
    }
    if (list(vault.contacts).filter(function (c) { return c.emergency; }).length < 2) add("contacts", "med", "Fewer than two emergency contacts", "Two people who can be reached on different days is the usual minimum.", "money");
    var bk = (vault.settings || {}).lastBackup, bd = bk ? V.daysUntil(t, bk) : null;
    if (bd === null || bd > 90) add("backup", "high", bd === null ? "No backup file saved yet" : "Backup is " + bd + " days old", "Your vault lives only in this browser. A backup file is the only protection against cleared site data.", "share");
    if (!(vault.settings || {}).recovery) add("recovery", "med", "No recovery shares made", "If the passphrase is lost, nobody can recover the vault. Split it between people you trust in Recovery kit.", "recovery");
    list(vault.digital).forEach(function (d) { if (!d.twofa && /email|bank|phone|cloud/i.test((d.kind || "") + " " + (d.service || ""))) add("twofa-" + d.id, "low", "No sign-in code location for " + d.service, "Say where sign-in codes go so a trusted person is not locked out.", "digital"); });
    var rank = { high: 0, med: 1, low: 2 };
    out.sort(function (a, b) { return rank[a.level] - rank[b.level] || a.title.localeCompare(b.title); });
    return out;
  }

  /* ---- crisis drills: "what if" scenarios checked against what you have recorded ---- */
  function drills(vault, today) {
    var t = today || V.todayStr(), e = vault.emergency || {}, people = list(vault.people), adults = people.filter(function (p) { return isAdult(p, t); }), pols = list(vault.policies), docs = list(vault.docs), bk = (vault.settings || {}).lastBackup,
      ec = list(vault.contacts).filter(function (c) { return c.emergency; }), bag = K.goBag(vault, t), packed = bag.filter(function (b) { return (e.bag || {})[b.id]; }).length, plan = vault.plan || {},
      typeIn = function (re) { return pols.some(function (p) { return re.test(p.type || ""); }); }, idDocs = docs.filter(function (d) { return /passport|licen|id card|national id/i.test((d.type || "") + " " + (d.title || "")); }),
      overdue = K.allReminders(vault, t).filter(function (r) { return r.state === "expired"; }).length, bd = bk ? V.daysUntil(t, bk) : null, hs = vault.health || {};
    function c(label, ok, route, tip) { return { label: label, ok: !!ok, route: route, tip: tip || "" }; }
    var sc = [
      { id: "fire", title: "A fire tonight", blurb: "You leave with what you are holding.", checks: [
        c("Meeting place and out-of-area contact written down", e.meetNear && e.outName, "emergency", "Add them in the Emergency plan."),
        c("Go-bag at least half packed", bag.length && packed * 2 >= bag.length, "emergency", "Tick items as you pack them."),
        c("A home, renters or contents policy is recorded", typeIn(/home|content|renter|property/i), "insurance", "Add the policy, or note that you have none."),
        c("A claims phone or web address is noted for one policy", pols.some(function (p) { return String(p.claims || "").trim(); }), "insurance", "Add it to the policy."),
        c("Home inventory has at least 10 items with a photo on some", list(vault.inventory).length >= 10 && list(vault.inventory).some(function (x) { return x.photo; }), "inventory", "Walk through a room with your phone camera."),
        c("A backup file saved in the last 90 days", bd !== null && bd <= 90, "share", "Save a backup from Sharing.")] },
      { id: "wallet", title: "Lost wallet or phone", blurb: "Everything on it is gone or in someone else's hands.", checks: [
        c("An ID document with a stored scan", idDocs.some(function (d) { return d.scan; }), "docs", "Scan a passport or licence."),
        c("Accounts listed (institution and last 4 only)", list(vault.accounts).length > 0, "money", "Add the banks and cards to call."),
        c("Where sign-in codes go is noted for digital accounts", list(vault.digital).length > 0 && list(vault.digital).every(function (d) { return d.twofa; }), "digital", "Fill the sign-in codes field."),
        c("Two or more emergency contacts", ec.length >= 2, "money", "Mark two contacts as emergency contacts.")] },
      { id: "hospital", title: "A hospital stay", blurb: "A family member is admitted and you are asked questions.", checks: [
        c("Every person has a health summary", people.length > 0 && people.every(function (p) { return hs[p.id]; }), "health", "Add allergies, blood type and conditions."),
        c("Medicines listed with a dose", list(vault.meds).some(function (m) { return m.name && m.dose; }), "health", "Add each regular medicine and its dose."),
        c("A health policy is recorded", typeIn(/health/i), "insurance", "Add it with the member number's last 4."),
        c("Emergency contacts recorded", ec.length >= 1, "money", "Mark at least one emergency contact.")] },
      { id: "away", title: "Away for two weeks", blurb: "Someone else has to run the household.", checks: [
        c("Nothing is overdue", overdue === 0, "reminders", "Clear or renew the overdue items."),
        c("Emergency plan filled in", e.meetNear && e.outName, "emergency", "Complete the plan."),
        c("Medicines and refill dates recorded", list(vault.meds).some(function (m) { return m.refill; }), "health", "Add refill dates."),
        c("Pets or special needs noted if they apply", !!String(e.pets || "").trim() || list(e.hazards).length > 0, "emergency", "Add pets and local hazards to the plan.")] },
      { id: "gone", title: "You cannot be reached", blurb: "A trusted person has to open things without you.", checks: [
        c("Recovery shares made for the passphrase", !!(vault.settings || {}).recovery, "recovery", "Split the passphrase into recovery shares."),
        c("A will recorded for at least one adult", adults.some(function (p) { var k = (plan[p.id] || {}).checks || {}; return k.will && k.will.done; }), "plan", "Tick the will step in Planning."),
        c("Key roles named for at least one adult", adults.some(function (p) { var r = (plan[p.id] || {}).roles || {}; return Object.keys(r).some(function (k) { return String(r[k] || "").trim(); }); }), "plan", "Name an executor and guardians."),
        c("Digital accounts have a stated wish", list(vault.digital).length > 0 && list(vault.digital).every(function (d) { return d.action; }), "digital", "Pick a wish for each account.")] }];
    sc.forEach(function (s) { var ok = s.checks.filter(function (x) { return x.ok; }).length; s.score = Math.round(ok * 100 / s.checks.length); s.ok = ok; });
    return sc;
  }

  var api = { norm: norm, fuzzy: fuzzy, fuzzySearch: fuzzySearch, records: records, ask: ask, forecast: forecast, gaps: gaps, drills: drills, lev: lev };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.VaultIntel = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
