/* Stark Career 2.1 planning engine: salary benchmark, offer comparison, contacts with follow-up cadence, references,
   skills plan, career change roadmap, wins log, freelance rates and clients, portfolio page and calendar export.
   Pure functions on data you enter. No DOM, no network, no market data. Runs in the browser and in node tests. */
var SC = window.SC || (window.SC = {});
(function () {
  "use strict";
  var E = SC.esc;
  function nz(s) { return String(s == null ? "" : s).trim(); }
  function num(x) {
    if (typeof x === "number") return isFinite(x) ? x : 0;
    var n = parseFloat(String(x == null ? "" : x).replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : 0;
  }
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function roundTo(n, step) { return Math.round(n / step) * step; }
  function cap(s) { s = nz(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  SC.num = num;

  /* ---------- state defaults for the 2.1 tools ---------- */
  SC.careerDefaults = function () {
    return {
      cur: "$",
      bench: { role: "", place: "", adjust: "100", hours: "2080", points: [] },
      offers: { years: "3", weights: { money: 3, growth: 2, people: 2, mission: 2, flex: 2, stability: 2 }, list: [] },
      contacts: [], refs: [],
      skillsPlan: { target: "", hours: "5", start: "", skills: [] },
      roadmap: { from: "", to: "", why: "", start: "", end: "", postings: "", steps: [] },
      wins: [],
      free: { income: "", expenses: "", tax: "25", weeks: "46", hours: "25", buffer: "10", dayHours: "8", clients: [], prop: {} },
      portfolio: { headline: "", about: "", accent: "teal", dark: false, showEmail: true, showPhone: false, showExp: true, showSkills: true, showEdu: true, projects: [] }
    };
  };
  /* Fill missing sub-fields after a load or restore (lists are sanitized by cleanState in guard.js). */
  SC.mergeCareer = function (d) {
    var b = SC.careerDefaults();
    ["bench", "offers", "skillsPlan", "roadmap", "free", "portfolio"].forEach(function (k) { d[k] = Object.assign(b[k], isObj(d[k]) ? d[k] : {}); });
    d.offers.weights = Object.assign(SC.careerDefaults().offers.weights, isObj(d.offers.weights) ? d.offers.weights : {});
    if (typeof d.cur !== "string" || d.cur.length > 4) d.cur = "$";
    return d;
  };
  SC.CURRENCIES = ["$", "€", "£", "¥", "₹", "R", "kr", "CHF", "A$", "C$", "R$", "₦", "₱", "zł"];

  /* ---------- salary benchmark (your own data points) ---------- */
  SC.PERIODS = { year: 1, month: 12, week: 52, day: 260, hour: 2080 };
  SC.annualize = function (v, period, hoursYear) {
    var m = period === "hour" ? (num(hoursYear) || 2080) : (SC.PERIODS[period] || 1);
    return num(v) * m;
  };
  SC.percentile = function (sorted, p) {
    if (!sorted.length) return 0;
    var i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  };
  SC.benchStats = function (points, opt) {
    opt = opt || {};
    var f = (num(opt.adjust) || 100) / 100, vals = [];
    (points || []).forEach(function (p) {
      if (!isObj(p)) return;
      var lo = num(p.low), hi = num(p.high), v = lo > 0 && hi > 0 ? (lo + hi) / 2 : (lo > 0 ? lo : hi);
      if (v > 0) vals.push(SC.annualize(v, p.period || "year", opt.hours) * f);
    });
    vals.sort(function (a, b) { return a - b; });
    if (!vals.length) return { n: 0 };
    var sum = vals.reduce(function (a, b) { return a + b; }, 0), r = { n: vals.length, min: vals[0], max: vals[vals.length - 1] };
    r.p25 = SC.percentile(vals, 0.25); r.median = SC.percentile(vals, 0.5); r.p75 = SC.percentile(vals, 0.75); r.mean = sum / vals.length;
    var step = r.median >= 50000 ? 500 : r.median >= 1000 ? 100 : 1;
    r.floor = roundTo(r.p25, step); r.ask = roundTo(r.p75, step);
    r.spread = r.median ? Math.round(100 * (r.max - r.min) / r.median) : 0;
    r.confidence = r.n >= 5 ? "good" : r.n >= 3 ? "fair" : "thin";
    return r;
  };

  /* ---------- offer comparison ---------- */
  SC.OFFER_FACTORS = [["growth", "Growth and learning"], ["people", "Manager and team"], ["mission", "Work you care about"], ["flex", "Flexibility"], ["stability", "Stability"]];
  SC.blankOffer = function (name) {
    return { id: SC.uid(), name: nz(name) || "Offer", base: "", bonus: "", signOn: "", equity: "", vest: "4", match: "", benefits: "", raise: "3",
      pto: "20", hours: "40", commute: "", office: "5", deadline: "", notes: "", scores: { growth: 3, people: 3, mission: 3, flex: 3, stability: 3 } };
  };
  SC.offerMoney = function (o, years) {
    years = Math.max(1, Math.min(10, Math.round(num(years) || 1)));
    var base = num(o.base), raise = num(o.raise) / 100, bonusP = num(o.bonus) / 100, matchP = num(o.match) / 100;
    var vest = Math.max(1, Math.round(num(o.vest) || 4)), eqYear = num(o.equity) / vest, total = num(o.signOn), first = 0;
    for (var y = 0; y < years; y++) {
      var b = base * Math.pow(1 + raise, y), yr = b + b * bonusP + b * matchP + num(o.benefits) + (y < vest ? eqYear : 0);
      total += yr; if (y === 0) first = yr + num(o.signOn);
    }
    var weeks = Math.max(1, 52 - num(o.pto) / 5), hours = num(o.hours) || 40, workH = weeks * hours;
    var commH = num(o.commute) * 2 * Math.min(7, Math.max(0, num(o.office))) * weeks / 60, avg = total / years;
    return { years: years, first: first, total: total, avg: avg, workHours: workH, commuteHours: commH, hourly: avg / (workH + commH) };
  };
  SC.compareOffers = function (list, weights, years) {
    weights = weights || {};
    var rows = (list || []).filter(isObj).map(function (o) { return { id: o.id, name: nz(o.name) || "Offer", o: o, m: SC.offerMoney(o, years) }; });
    var top = Math.max.apply(null, rows.map(function (r) { return r.m.avg; }).concat([0]));
    function w(k, d) { var v = weights[k]; return v === undefined || v === null || v === "" ? d : Math.max(0, Math.min(5, num(v))); }
    rows.forEach(function (r) {
      var sc = isObj(r.o.scores) ? r.o.scores : {}, got = 0, max = 0;
      var moneyStars = top > 0 ? 5 * r.m.avg / top : 0;
      got += w("money", 3) * moneyStars; max += w("money", 3) * 5;
      SC.OFFER_FACTORS.forEach(function (f) { var s = Math.max(1, Math.min(5, num(sc[f[0]]) || 3)); got += w(f[0], 2) * s; max += w(f[0], 2) * 5; });
      r.score = max ? Math.round(100 * got / max) : 0;
    });
    function best(fn) { var b = null; rows.forEach(function (r) { if (!b || fn(r) > fn(b)) b = r; }); return b ? b.id : null; }
    return { rows: rows, best: { score: best(function (r) { return r.score; }), money: best(function (r) { return r.m.avg; }), hourly: best(function (r) { return r.m.hourly; }) } };
  };

  /* ---------- contacts with a follow-up cadence ---------- */
  SC.TIERS = { core: ["Close", 21], warm: ["Regular", 45], wide: ["Light touch", 90] };
  SC.blankContact = function (o) {
    o = o || {};
    return { id: SC.uid(), name: nz(o.name), company: nz(o.company), role: nz(o.role), how: nz(o.how), email: nz(o.email), phone: nz(o.phone), link: nz(o.link),
      tier: SC.TIERS[o.tier] ? o.tier : "warm", cadence: "", last: "", notes: nz(o.notes), log: [] };
  };
  SC.contactCadence = function (c) { var n = Math.round(num(c.cadence)); return n > 0 ? Math.min(n, 730) : (SC.TIERS[c.tier] || SC.TIERS.warm)[1]; };
  SC.contactNext = function (c, today) { return c.last ? SC.addDays(c.last, SC.contactCadence(c)) : today; };
  SC.contactsDue = function (list, today) {
    return (list || []).map(function (c) { var nx = SC.contactNext(c, today); return { c: c, next: nx, late: SC.daysBetween(nx, today) }; })
      .filter(function (x) { return x.late >= 0; }).sort(function (a, b) { return b.late - a.late; });
  };
  SC.touchContact = function (c, date, note, kind) {
    c.log = Array.isArray(c.log) ? c.log : [];
    c.log.unshift({ d: date, n: nz(note).slice(0, 300), k: nz(kind) || "message" });
    c.log = c.log.slice(0, 60);
    if (!c.last || date > c.last) c.last = date;
    return c;
  };
  SC.crmHealth = function (list, today) {
    var n = (list || []).length, due = SC.contactsDue(list, today).filter(function (x) { return x.late > 0 || !x.c.last; }).length;
    return { n: n, due: due, onTrack: n - due, pct: n ? Math.round(100 * (n - due) / n) : 0 };
  };
  function csv(rows) {
    function q(v) { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return rows.map(function (r) { return r.map(q).join(","); }).join("\r\n");
  }
  SC.contactsCSV = function (list, today) {
    var rows = [["Name", "Company", "Role", "How you know them", "Email", "Phone", "Link", "Tier", "Every (days)", "Last contact", "Next contact", "Notes"]];
    (list || []).forEach(function (c) {
      rows.push([c.name, c.company, c.role, c.how, c.email, c.phone, c.link, (SC.TIERS[c.tier] || SC.TIERS.warm)[0], SC.contactCadence(c), c.last || "", SC.contactNext(c, today), c.notes]);
    });
    return csv(rows);
  };

  /* ---------- references ---------- */
  SC.REF_STATUS = [["possible", "Possible"], ["asked", "Asked"], ["agreed", "Agreed"], ["declined", "Declined"]];
  SC.blankRef = function (o) {
    o = o || {};
    return { id: SC.uid(), name: nz(o.name), title: nz(o.title), company: nz(o.company), relation: nz(o.relation), email: nz(o.email), phone: nz(o.phone),
      speaks: nz(o.speaks), status: "possible", asked: "", notes: "", uses: [] };
  };
  SC.refUse = function (r, date, forWhat) {
    r.uses = Array.isArray(r.uses) ? r.uses : [];
    r.uses.unshift({ d: date, a: nz(forWhat).slice(0, 120), thanked: false });
    r.uses = r.uses.slice(0, 40);
    return r;
  };
  SC.refReport = function (refs, today) {
    var agreed = (refs || []).filter(function (r) { return r.status === "agreed"; });
    var busy = agreed.filter(function (r) { return (r.uses || []).filter(function (u) { var d = SC.daysBetween(u.d, today); return d !== null && d >= 0 && d <= 30; }).length >= 3; });
    var thanks = []; (refs || []).forEach(function (r) { (r.uses || []).forEach(function (u, i) { if (!u.thanked) thanks.push({ r: r, i: i, u: u }); }); });
    var stale = agreed.filter(function (r) { var d = r.asked ? SC.daysBetween(r.asked, today) : null; return d === null || d > 180; });
    return { agreed: agreed.length, ready: agreed.length >= 3, busy: busy, thanks: thanks, stale: stale };
  };
  SC.refSheet = function (refs, R) {
    var list = (refs || []).filter(function (r) { return r.status === "agreed"; }), me = nz(R && R.name);
    var out = ["REFERENCES" + (me ? " FOR " + me.toUpperCase() : ""), ""];
    if (!list.length) out.push("(No references marked as agreed yet.)");
    list.forEach(function (r, i) {
      out.push((i + 1) + ". " + nz(r.name));
      var t = [nz(r.title), nz(r.company)].filter(Boolean).join(", "); if (t) out.push("   " + t);
      if (nz(r.relation)) out.push("   Relationship: " + nz(r.relation));
      var c = [nz(r.phone), nz(r.email)].filter(Boolean).join(" | "); if (c) out.push("   " + c);
      out.push("");
    });
    return out.join("\n").replace(/\n+$/, "\n");
  };
  SC.refHeadsUp = function (r, ctx) {
    ctx = ctx || {};
    var first = nz(r.name).split(/\s+/)[0] || "[their name]", role = nz(ctx.role) || "[role]", co = nz(ctx.company) || "[company]";
    return "Hi " + first + ",\n\nThank you again for agreeing to be a reference. I have reached the final stage for the " + role + " role at " + co +
      ", so you may hear from them in the next few days.\n\n" +
      (nz(ctx.focus) ? "The role focuses on " + nz(ctx.focus) + ". " : "") +
      (nz(r.speaks) ? "If it helps, you could speak to " + nz(r.speaks) + "." : "If it helps, I can send you a short list of the projects we worked on together.") +
      "\n\nI will let you know how it goes. Thank you for your support.\n\n" + (nz(ctx.me) || "[Your name]");
  };

  /* ---------- skills plan and learning schedule ---------- */
  SC.blankSkill = function (name, need, have) {
    return { id: SC.uid(), name: nz(name), need: Math.max(1, Math.min(5, Math.round(num(need)) || 3)), have: Math.max(0, Math.min(5, Math.round(num(have)))), how: "", hrs: "", done: false };
  };
  function lvl(x, lo) { return Math.max(lo, Math.min(5, Math.round(num(x)))); }
  SC.skillGaps = function (skills) {
    var list = (skills || []).filter(isObj), need = 0, got = 0;
    var gaps = list.map(function (s) { var n = lvl(s.need, 1), h = lvl(s.have, 0); need += n; got += Math.min(n, s.done ? n : h); return { s: s, need: n, have: h, gap: s.done ? 0 : Math.max(0, n - h) }; })
      .filter(function (g) { return g.gap > 0; }).sort(function (a, b) { return b.gap - a.gap || b.need - a.need; });
    return { gaps: gaps, coverage: need ? Math.round(100 * got / need) : 0, total: list.length };
  };
  SC.learningPlan = function (skills, hoursPerWeek, start) {
    var h = Math.max(1, num(hoursPerWeek) || 5), d = start, items = [], total = 0;
    SC.skillGaps(skills).gaps.forEach(function (g) {
      var hrs = num(g.s.hrs) > 0 ? num(g.s.hrs) : g.gap * 10, weeks = Math.max(1, Math.ceil(hrs / h)), end = SC.addDays(d, weeks * 7);
      items.push({ id: g.s.id, name: nz(g.s.name) || "Skill", gap: g.gap, hrs: hrs, weeks: weeks, start: d, end: end });
      total += hrs; d = end;
    });
    return { items: items, totalHours: total, weeks: items.reduce(function (a, i) { return a + i.weeks; }, 0), finish: items.length ? d : start };
  };
  /* Missing keywords worth learning: known skill phrases first, then terms the posting repeats. Company names and one-off words are skipped. */
  var skillSet = null;
  SC.skillLabel = function (s) {
    return nz(s).split(/\s+/).map(function (w, i) { return w.length <= 3 && /^[a-z]+$/.test(w) && !/^(and|for|the|of)$/.test(w) ? w.toUpperCase() : i ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
  };
  SC.gapsFromPosting = function (R, jobText, n) {
    if (!nz(jobText)) return [];
    if (!skillSet) { skillSet = {}; (SC.data.skills || []).forEach(function (x) { skillSet[x.toLowerCase()] = 1; }); }
    var miss = SC.matchJob(SC.resumeText(R), jobText).missing;
    var known = miss.filter(function (k) { return k.phrase || skillSet[k.label.toLowerCase()]; }), rep = miss.filter(function (k) { return !k.phrase && !skillSet[k.label.toLowerCase()] && k.count >= 2; });
    return known.concat(rep).slice(0, n || 8).map(function (k) { return SC.skillLabel(k.label); });
  };

  /* ---------- career change roadmap ---------- */
  SC.ROADMAP_PHASES = [["explore", "Explore"], ["learn", "Learn"], ["prove", "Prove"], ["connect", "Connect"], ["apply", "Apply"]];
  var STEPS = {
    explore: ["Read 15 job postings for {to} and paste the requirements that repeat into the box below",
      "Hold 3 short informational interviews with people who work as {to}",
      "Write down what you keep and what you give up by leaving {from}"],
    learn: ["Rate yourself against the top requirements in Skills plan",
      "Finish one course, certificate or self-study block for your biggest gap",
      "Explain five core {to} ideas in plain words, out loud, without notes"],
    prove: ["Build one small project that shows {to} work and add it to your Portfolio",
      "Take on one {to}-style task: in your current job, as a volunteer or as a small freelance job",
      "Turn what you did into 3 resume bullets with numbers (log them in Wins)"],
    connect: ["Join one community, meetup or professional group for {to}",
      "Reconnect with 10 people in Contacts who know the field",
      "Ask 2 people in the field to review your new resume"],
    apply: ["Rewrite your summary and headline for {to}, leading with transferable skills",
      "Apply to 5 bridge roles that use both your {from} and {to} experience",
      "Practise \"Why are you changing careers?\" out loud in Interviews"]
  };
  SC.roadmapTemplate = function (from, to, start, end) {
    var span = SC.daysBetween(start, end); if (!(span > 14)) span = 180;
    var f = nz(from) || "your current field", t = nz(to) || "your target role", steps = [];
    SC.ROADMAP_PHASES.forEach(function (p, i) {
      var p0 = Math.round(span * i / 5), p1 = Math.round(span * (i + 1) / 5);
      STEPS[p[0]].forEach(function (txt, j) {
        steps.push({ id: SC.uid(), phase: p[0], text: txt.replace(/\{from\}/g, f).replace(/\{to\}/g, t), due: SC.addDays(start, p0 + Math.round((p1 - p0) * (j + 1) / 3)), done: false });
      });
    });
    return steps;
  };
  SC.roadmapProgress = function (steps, today) {
    var list = (steps || []).filter(isObj), done = list.filter(function (s) { return s.done; }).length;
    var overdue = list.filter(function (s) { return !s.done && s.due && s.due < today; }).length, cur = null;
    SC.ROADMAP_PHASES.some(function (p) { if (list.some(function (s) { return s.phase === p[0] && !s.done; })) { cur = p[0]; return true; } return false; });
    return { done: done, total: list.length, pct: list.length ? Math.round(100 * done / list.length) : 0, overdue: overdue, phase: cur };
  };
  /* Which of your resume words already show up in the target postings, and which repeated requirements are missing. */
  SC.transferable = function (R, postings) {
    if (!nz(postings)) return { keep: [], gaps: [], score: 0 };
    var m = SC.matchJob(SC.resumeText(R), postings);
    return { keep: m.matched.map(function (k) { return k.label; }), gaps: m.missing.map(function (k) { return k.label; }), score: m.score };
  };

  /* ---------- wins log (brag document) ---------- */
  SC.blankWin = function (o) { o = o || {}; return { id: SC.uid(), date: o.date || SC.today(), action: nz(o.action), result: nz(o.result), tags: nz(o.tags) }; };
  SC.winBullet = function (w) {
    var a = cap(nz(w.action).replace(/[.\s]+$/, "")), r = nz(w.result).replace(/[.\s]+$/, "");
    if (!a) return "";
    return r ? a + ", " + r.charAt(0).toLowerCase() + r.slice(1) : a;
  };
  SC.quarter = function (iso) { var m = /^(\d{4})-(\d{2})/.exec(iso || ""); return m ? m[1] + " Q" + Math.ceil(+m[2] / 3) : "Undated"; };
  SC.winsReview = function (wins, from, to, name) {
    var list = (wins || []).filter(function (w) { return isObj(w) && (!from || w.date >= from) && (!to || w.date <= to); })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var out = ["WINS" + (nz(name) ? ": " + nz(name) : "") + (from || to ? " (" + (from || "start") + " to " + (to || "today") + ")" : ""), ""], q = null, tags = {};
    list.forEach(function (w) {
      var k = SC.quarter(w.date); if (k !== q) { if (q) out.push(""); out.push(k); q = k; }
      out.push("- " + SC.winBullet(w) + " (" + w.date + ")");
      nz(w.tags).split(/\s*,\s*/).filter(Boolean).forEach(function (t) { t = t.toLowerCase(); tags[t] = (tags[t] || 0) + 1; });
    });
    if (!list.length) out.push("(No wins logged in this period.)");
    var tk = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a] || (a < b ? -1 : 1); });
    if (tk.length) out.push("", "Themes: " + tk.map(function (t) { return t + " (" + tags[t] + ")"; }).join(", "));
    return { text: out.join("\n"), count: list.length, themes: tk };
  };

  /* ---------- freelance ---------- */
  SC.FREE_STAGES = [["lead", "Lead"], ["proposal", "Proposal sent"], ["active", "Active"], ["delivered", "Delivered"], ["paid", "Paid"], ["lost", "Lost"]];
  SC.freelanceRate = function (o) {
    var income = num(o.income), tax = Math.min(90, Math.max(0, num(o.tax))) / 100, weeks = num(o.weeks) || 46, hours = num(o.hours) || 25;
    var buffer = Math.max(0, num(o.buffer)) / 100, dayH = num(o.dayHours) || 8, billable = weeks * hours;
    if (!(income > 0)) return { error: "Enter the yearly take-home pay you want." };
    if (!(billable > 0)) return { error: "Enter your billable hours and working weeks." };
    var gross = (income / (1 - tax) + Math.max(0, num(o.expenses))) * (1 + buffer), raw = gross / billable;
    var hourly = raw < 100 ? Math.ceil(raw) : Math.ceil(raw / 5) * 5;
    return { gross: gross, billable: billable, raw: raw, hourly: hourly, day: hourly * dayH, week: hourly * hours, month: gross / 12, utilization: Math.round(100 * hours / 40) };
  };
  SC.blankClient = function (o) { o = o || {}; return { id: SC.uid(), name: nz(o.name), project: nz(o.project), stage: "lead", value: nz(o.value), due: "", notes: "" }; };
  SC.freelancePipeline = function (clients, today) {
    var by = {}, list = (clients || []).filter(isObj);
    SC.FREE_STAGES.forEach(function (s) { by[s[0]] = { n: 0, value: 0 }; });
    list.forEach(function (c) { var b = by[c.stage] || by.lead; b.n++; b.value += num(c.value); });
    var won = by.active.n + by.delivered.n + by.paid.n, decided = won + by.lost.n;
    var overdue = list.filter(function (c) { return (c.stage === "active" || c.stage === "proposal") && c.due && c.due < today; });
    return { by: by, open: by.lead.value + by.proposal.value, booked: by.active.value + by.delivered.value, paid: by.paid.value,
      unpaid: by.delivered.value, winRate: decided ? Math.round(100 * won / decided) : null, overdue: overdue };
  };
  SC.proposalText = function (o) {
    var hours = num(o.hours), rate = num(o.rate), fee = hours * rate, dep = Math.min(100, Math.max(0, num(o.deposit))), cur = o.cur;
    var scope = nz(o.scope).split(/\r?\n/).map(nz).filter(Boolean);
    return ["PROPOSAL: " + (nz(o.project) || "[project]"), "For: " + (nz(o.client) || "[client]"), "From: " + (nz(o.me) || "[your name]"), "",
      "WHAT YOU GET", scope.length ? scope.map(function (s) { return "- " + s; }).join("\n") : "- [deliverable]", "",
      "TIMELINE", (num(o.days) > 0 ? "About " + Math.round(num(o.days)) + " working days from the deposit." : "[timeline]"), "",
      "FEE", (fee > 0 ? SC.money(fee, cur) + " (" + hours + " hours at " + SC.money(rate, cur) + " per hour)." : "[fee]"),
      (dep > 0 && fee > 0 ? "Deposit: " + dep + "% (" + SC.money(fee * dep / 100, cur) + ") to start; the rest on delivery." : ""), "",
      "TERMS", "Two rounds of changes are included. Further changes are billed at " + (rate > 0 ? SC.money(rate, cur) : "[rate]") + " per hour.",
      "Invoices are due within 14 days.", "This proposal is valid for 30 days."].filter(function (l, i, a) { return l !== "" || a[i - 1] !== ""; }).join("\n");
  };

  /* ---------- portfolio page (one self-contained HTML file, no scripts) ---------- */
  SC.safeUrl = function (u) {
    u = nz(u);
    if (/[\s"'<>`\\]/.test(u)) return "";
    if (/^https?:\/\/[^/]/i.test(u) || /^mailto:[^@]+@[^@]+$/i.test(u)) return u;
    if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(u)) return "https:" + "//" + u;
    return "";
  };
  SC.blankProject = function () { return { id: SC.uid(), title: "", role: "", summary: "", result: "", link: "", tags: "" }; };
  function linkOrText(url, label) { var s = SC.safeUrl(url); return s ? '<a href="' + E(s) + '" rel="noopener">' + E(label || url) + "</a>" : E(label || url); }
  SC.portfolioCSS = function (accent, dark) {
    var a = (SC.ACCENTS.filter(function (x) { return x[0] === accent; })[0] || SC.ACCENTS[0])[1];
    var bg = dark ? "#0e1417" : "#ffffff", tx = dark ? "#e8eef0" : "#14202a", mu = dark ? "#9db0b8" : "#53656e", ln = dark ? "#2a3a42" : "#dde5e8", card = dark ? "#152027" : "#f6f9fa";
    var ac = dark ? "#5eead4" : a;
    return ".pf{--a:" + ac + ";background:" + bg + ";color:" + tx + ";font:16px/1.6 'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif}" +
      ".pf *{box-sizing:border-box}.pf .pf-wrap{max-width:860px;margin:0 auto;padding:48px 22px 40px}" +
      ".pf .pf-top{border-bottom:3px solid var(--a);padding-bottom:18px;margin-bottom:26px}.pf h1{font-size:2.3rem;line-height:1.1;margin:0 0 6px;letter-spacing:-.02em}" +
      ".pf .pf-title{font-size:1.15rem;color:var(--a);font-weight:700;margin:0 0 8px}.pf .pf-head{font-size:1.05rem;margin:0 0 10px}" +
      ".pf .pf-contact{display:flex;flex-wrap:wrap;gap:6px 16px;color:" + mu + ";font-size:.92rem;margin:0;padding:0;list-style:none}" +
      ".pf a{color:var(--a)}.pf h2{font-size:.82rem;text-transform:uppercase;letter-spacing:.14em;color:" + mu + ";margin:30px 0 12px}" +
      ".pf .pf-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}" +
      ".pf .pf-card{background:" + card + ";border:1px solid " + ln + ";border-left:4px solid var(--a);border-radius:12px;padding:14px 16px}" +
      ".pf .pf-card h3{margin:0 0 4px;font-size:1.08rem}.pf .pf-meta{color:" + mu + ";font-size:.88rem;margin:0 0 6px}.pf .pf-card p{margin:0 0 6px}" +
      ".pf .pf-res{font-weight:650}.pf .pf-tags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0;padding:0;list-style:none}" +
      ".pf .pf-tags li{font-size:.78rem;border:1px solid " + ln + ";border-radius:999px;padding:1px 9px;color:" + mu + "}" +
      ".pf .pf-job{margin:0 0 14px}.pf .pf-job h3{margin:0;font-size:1.02rem}.pf .pf-job ul{margin:6px 0 0;padding-left:20px}" +
      ".pf .pf-foot{margin-top:36px;padding-top:14px;border-top:1px solid " + ln + ";color:" + mu + ";font-size:.8rem}" +
      "@media print{.pf .pf-card{break-inside:avoid}}";
  };
  SC.portfolioBody = function (R, P) {
    R = R || SC.blankResume(); P = P || SC.careerDefaults().portfolio;
    var contact = [], h = [];
    if (nz(R.location)) contact.push("<li>" + E(R.location) + "</li>");
    if (P.showEmail && nz(R.email)) contact.push("<li>" + linkOrText("mailto:" + nz(R.email), R.email) + "</li>");
    if (P.showPhone && nz(R.phone)) contact.push("<li>" + E(R.phone) + "</li>");
    nz(R.links).split(/\s*[|,;\n]\s*/).filter(Boolean).forEach(function (l) { contact.push("<li>" + linkOrText(l, l) + "</li>"); });
    h.push('<div class="pf-wrap"><header class="pf-top"><h1>' + E(nz(R.name) || "Your name") + "</h1>" + (nz(R.title) ? '<p class="pf-title">' + E(R.title) + "</p>" : "") +
      (nz(P.headline) ? '<p class="pf-head">' + E(P.headline) + "</p>" : "") + (contact.length ? '<ul class="pf-contact">' + contact.join("") + "</ul>" : "") + "</header>");
    var about = nz(P.about) || nz(R.summary);
    if (about) h.push("<section><h2>About</h2>" + about.split(/\n{2,}/).map(function (p) { return "<p>" + E(p).replace(/\n/g, "<br>") + "</p>"; }).join("") + "</section>");
    var pr = (P.projects || []).filter(function (p) { return isObj(p) && nz(p.title); });
    if (pr.length) {
      h.push('<section><h2>Selected work</h2><div class="pf-grid">' + pr.map(function (p) {
        var tags = nz(p.tags).split(/\s*,\s*/).filter(Boolean);
        return '<article class="pf-card"><h3>' + (SC.safeUrl(p.link) ? linkOrText(p.link, p.title) : E(p.title)) + "</h3>" + (nz(p.role) ? '<p class="pf-meta">' + E(p.role) + "</p>" : "") +
          (nz(p.summary) ? "<p>" + E(p.summary) + "</p>" : "") + (nz(p.result) ? '<p class="pf-res">' + E(p.result) + "</p>" : "") +
          (tags.length ? '<ul class="pf-tags">' + tags.map(function (t) { return "<li>" + E(t) + "</li>"; }).join("") + "</ul>" : "") + "</article>";
      }).join("") + "</div></section>");
    }
    var ex = (R.experience || []).filter(function (e) { return nz(e.role) || nz(e.company); });
    if (P.showExp && ex.length) {
      h.push("<section><h2>Experience</h2>" + ex.map(function (e) {
        var b = (e.bullets || []).map(nz).filter(Boolean).slice(0, 3);
        return '<div class="pf-job"><h3>' + E(e.role) + (nz(e.company) ? ", " + E(e.company) : "") + "</h3>" +
          ((nz(e.start) || nz(e.end)) ? '<p class="pf-meta">' + E([nz(e.start), nz(e.end)].filter(Boolean).join(" - ")) + "</p>" : "") +
          (b.length ? "<ul>" + b.map(function (x) { return "<li>" + E(x) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
      }).join("") + "</section>");
    }
    var sk = nz(R.skills).split(/\s*[,;\n]\s*/).filter(Boolean);
    if (P.showSkills && sk.length) h.push('<section><h2>Skills</h2><ul class="pf-tags">' + sk.map(function (s) { return "<li>" + E(s) + "</li>"; }).join("") + "</ul></section>");
    var ed = (R.education || []).filter(function (e) { return nz(e.school) || nz(e.degree); });
    if (P.showEdu && ed.length) h.push("<section><h2>Education</h2>" + ed.map(function (e) { return '<p class="pf-meta">' + E([nz(e.degree), nz(e.school), nz(e.year)].filter(Boolean).join(", ")) + "</p>"; }).join("") + "</section>");
    h.push('<p class="pf-foot">' + E(nz(R.name) || "Portfolio") + ". Made with Stark Career.</p></div>");
    return h.join("");
  };
  SC.portfolioHTML = function (R, P) {
    P = P || SC.careerDefaults().portfolio;
    var name = nz(R && R.name) || "Portfolio", desc = nz(P.headline) || nz(R && R.title) || "Portfolio";
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">' +
      "<title>" + E(name) + (nz(R && R.title) ? " - " + E(R.title) : "") + '</title><meta name="description" content="' + E(desc) + '">' +
      "<style>body{margin:0}" + SC.portfolioCSS(P.accent, !!P.dark) + "</style></head>" +
      '<body class="pf">' + SC.portfolioBody(R, P) + "</body></html>\n";
  };

  /* ---------- calendar export (.ics, all-day events) ---------- */
  function icsEsc(s) { return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function fold(line) {
    var out = [], s = line;
    while (s.length > 74) { var cut = 74; if (/[\uDC00-\uDFFF]/.test(s.charAt(cut))) cut--; out.push(s.slice(0, cut)); s = " " + s.slice(cut); }
    out.push(s); return out.join("\r\n");
  }
  SC.icsCalendar = function (events, stamp) {
    stamp = stamp || new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stark//Stark Career 2.1//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Stark Career"];
    (events || []).forEach(function (e) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || "")) return;
      L.push("BEGIN:VEVENT", "UID:" + String(e.uid).replace(/[^A-Za-z0-9_.-]/g, "") + "@stark-career", "DTSTAMP:" + stamp,
        "DTSTART;VALUE=DATE:" + e.date.replace(/-/g, ""), "DTEND;VALUE=DATE:" + SC.addDays(e.date, 1).replace(/-/g, ""),
        fold("SUMMARY:" + icsEsc(e.title)));
      if (e.note) L.push(fold("DESCRIPTION:" + icsEsc(e.note)));
      L.push("END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.join("\r\n") + "\r\n";
  };
  /* Everything with a date: follow-ups, contacts to reach, learning milestones, roadmap steps, offer deadlines, client deadlines. */
  SC.careerEvents = function (S, today) {
    var ev = [], done = { accepted: 1, rejected: 1, withdrawn: 1 };
    (S.apps || []).forEach(function (a) { if (a.followUp && !done[a.stage]) ev.push({ uid: "fu-" + a.id, date: a.followUp, title: "Follow up: " + (a.company || "application"), note: [a.role, a.followNote].filter(Boolean).join(". ") }); });
    (S.contacts || []).forEach(function (c) { ev.push({ uid: "ct-" + c.id, date: SC.contactNext(c, today), title: "Reach out: " + (c.name || "contact"), note: [c.company, c.how].filter(Boolean).join(". ") }); });
    var sp = S.skillsPlan || {};
    if (sp.start) SC.learningPlan(sp.skills, sp.hours, sp.start).items.forEach(function (i) { ev.push({ uid: "sk-" + i.id, date: i.end, title: "Skill goal: " + i.name, note: i.hrs + " hours planned" }); });
    ((S.roadmap || {}).steps || []).forEach(function (s) { if (!s.done && s.due) ev.push({ uid: "rm-" + s.id, date: s.due, title: "Career change: " + s.text.slice(0, 80), note: s.text }); });
    ((S.offers || {}).list || []).forEach(function (o) { if (o.deadline) ev.push({ uid: "of-" + o.id, date: o.deadline, title: "Offer deadline: " + (o.name || "offer"), note: "" }); });
    ((S.free || {}).clients || []).forEach(function (c) { if (c.due && c.stage !== "paid" && c.stage !== "lost") ev.push({ uid: "fr-" + c.id, date: c.due, title: "Client due: " + (c.name || "client") + (c.project ? " - " + c.project : ""), note: "" }); });
    return ev.filter(function (e) { return /^\d{4}-\d{2}-\d{2}$/.test(e.date || ""); }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  };
})();
