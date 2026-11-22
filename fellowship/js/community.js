/* Stark Fellowship, by Stark: directory, teams and rotas, gatherings and check-in, care visits and help requests.
   Pure logic, no DOM, no network. The volunteer roster (coverage, double-booking, fair fill) and check-in are
   adapted from Stark Event Kit, extended from one event day to dated rotas across weeks. */
(function (root) {
  "use strict";
  var K = root.StarkCore || (typeof require === "function" ? require("./core.js") : null);
  var M = {};
  M.STATUSES = ["Member", "Regular attender", "Visitor", "Friend", "Former"];
  M.KINDS = ["Adult", "Child"];
  M.GATHERINGS = ["Weekly gathering", "Class or study group", "Youth group", "Children's group", "Shared meal", "Festival or holy day", "Meeting", "Volunteer day", "Other"];
  M.CARE_KINDS = ["Home visit", "Hospital or care home", "Phone call", "Meeting", "New baby", "Bereavement", "Welcome visit", "Other"];
  M.NEEDS = ["Food", "Rent or housing", "Utilities", "Transport", "Medical", "Funeral costs", "Other"];
  M.HELP_STATUS = ["New", "Reviewing", "Approved", "Helped", "Referred", "Declined"];
  M.REFERRALS = ["Local food pantry", "Housing agency", "Utility assistance program", "Medical clinic", "Legal aid", "Another community group"];
  function trim(v) { return (v == null ? "" : String(v)).trim(); }
  function csvLine() { return (root.StarkBooks || require("./books.js")).csvLine; }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  M.emptyCore = function (name) {
    return { v: 1, settings: { name: trim(name) || "Our community", address: "", taxId: "", wording: "standard", signer: "", signerTitle: "", lockMin: 10, notSeenWeeks: 6 },
      households: [], people: [], teams: [], slots: [], away: {}, events: [], dayCodes: {}, groups: [], log: [] };
  };
  M.emptyContact = function () { return { v: 1, hh: {}, people: {} }; };
  M.emptyCare = function () { return { v: 1, visits: [] }; };
  M.emptyNotes = function () { return { v: 1, byVisit: {} }; };
  M.emptyHelp = function () { return { v: 1, requests: [] }; };
  M.log = function (D, by, what) { D.log.unshift({ at: new Date().toISOString(), by: by, what: what }); if (D.log.length > 400) D.log.length = 400; };

  /* ---------- directory ---------- */
  M.index = function (D) { var x = { p: {}, h: {}, members: {} }; D.households.forEach(function (h) { x.h[h.id] = h; x.members[h.id] = []; }); D.people.forEach(function (p) { x.p[p.id] = p; (x.members[p.hh] = x.members[p.hh] || []).push(p); }); return x; };
  M.name = function (p) { return p ? (p.pref || p.first) + " " + p.last : "Removed person"; };
  M.sortName = function (p) { return (p.last + " " + (p.pref || p.first)).toLowerCase(); };
  M.addHousehold = function (D, name) {
    name = trim(name).slice(0, 80);
    if (!name) throw new Error("Enter a household name.");
    var h = { id: K.uid(), name: name }; D.households.push(h); return h;
  };
  M.dupes = function (D, first, last) { first = trim(first).toLowerCase(); last = trim(last).toLowerCase(); return D.people.filter(function (p) { return p.last.toLowerCase() === last && (p.first.toLowerCase() === first || (p.pref || "").toLowerCase() === first); }); };
  M.savePerson = function (D, o) {
    var p = { id: o.id || K.uid(), hh: o.hh, first: trim(o.first).slice(0, 60), last: trim(o.last).slice(0, 60), pref: trim(o.pref).slice(0, 60),
      kind: M.KINDS.indexOf(o.kind) >= 0 ? o.kind : "Adult", status: M.STATUSES.indexOf(o.status) >= 0 ? o.status : "Member" };
    if (!p.first || !p.last) throw new Error("Enter a first and last name.");
    if (M.cap && !D.people.some(function (x) { return x.id === p.id; }) && D.people.length >= M.cap.people) throw new Error(M.cap.message);   // free trial only: adding stops, nothing is removed
    if (!p.hh || p.hh === "new") p.hh = M.addHousehold(D, (o.hhName || p.last + " household")).id;
    else if (!D.households.some(function (h) { return h.id === p.hh; })) throw new Error("Choose a household.");
    var i = D.people.findIndex(function (x) { return x.id === p.id; });
    if (i < 0) D.people.push(p); else D.people[i] = p;
    if (p.kind === "Child" && i >= 0) M.cleanGroups(D, p.id);   // a person changed to Child leaves every small group
    return p;
  };
  /* ---------- small groups: the data rule that keeps children out ----------
     Children are never members, leaders or attendees of a small group (their attendance stays in Children's check-in under its own rules).
     This runs when a book is opened, so a backup or a hand-edited file cannot bring a child into a group, and it repairs the shape of every
     group record. With a person id it only removes that one person. Returns how many children were removed. Groups sit in the shared core part. */
  var G_RULES = ["weekly", "biweekly", "monthly"], G_NTH = [1, 2, 3, 4, 5, -1];
  function gStr(v, n) { return typeof v === "string" ? v.trim().slice(0, n) : ""; }
  function gDate(v) { return typeof v === "string" && K.isDate(v) ? v : ""; }
  function gTime(v) { return typeof v === "string" && K.hm(v) != null ? v : ""; }
  M.cleanGroups = function (D, onlyPid) {
    var kids = {}, known = {}, gone = 0;
    if (!Array.isArray(D.groups)) D.groups = [];
    if (onlyPid) {
      D.groups.forEach(function (g) {
        if (Array.isArray(g.members)) g.members = g.members.filter(function (x) { return x !== onlyPid; });
        if (Array.isArray(g.leaders)) g.leaders = g.leaders.filter(function (x) { return x !== onlyPid; });
        Object.keys(g.att || {}).forEach(function (d) { if (g.att[d] && Array.isArray(g.att[d].present)) g.att[d].present = g.att[d].present.filter(function (x) { return x !== onlyPid; }); });
      });
      return 0;
    }
    D.people.forEach(function (p) { known[p.id] = 1; if (p.kind === "Child") kids[p.id] = 1; });
    function ids(list) {
      var seen = {};
      return (Array.isArray(list) ? list : []).filter(function (x) {
        if (typeof x !== "string" || seen[x]) return false;
        if (kids[x]) { gone++; return false; }
        return !!known[x] && (seen[x] = 1);
      });
    }
    D.groups = D.groups.filter(function (g) { return g && typeof g.id === "string" && g.id; }).slice(0, 300);
    D.groups.forEach(function (g) {
      var r = g.rule, att = {}, seenX = {}, skips = {};
      g.name = gStr(g.name, 80) || "Group"; g.desc = gStr(g.desc, 500); g.place = gStr(g.place, 120); g.start = gDate(g.start); g.end = gDate(g.end);
      g.members = ids(g.members).slice(0, 500);
      g.leaders = ids(g.leaders).filter(function (x) { return g.members.indexOf(x) >= 0; });
      g.rule = r && typeof r === "object" && G_RULES.indexOf(r.type) >= 0 ? { type: r.type, wd: Math.min(6, Math.max(0, r.wd | 0)), nth: G_NTH.indexOf(r.nth) >= 0 ? r.nth : 1, time: gTime(r.time), end: gTime(r.end) } : null;
      g.extra = (Array.isArray(g.extra) ? g.extra : []).filter(function (e) {
        var k = e && gDate(e.date) ? e.date + "|" + gTime(e.time) : "";
        if (!k || seenX[k]) return false;
        return (seenX[k] = 1);
      }).slice(0, 400).map(function (e) { return { date: e.date, time: gTime(e.time), end: gTime(e.end), note: gStr(e.note, 120) }; });
      (Array.isArray(g.skips) ? g.skips : []).forEach(function (d) { if (gDate(d)) skips[d] = 1; });
      g.skips = Object.keys(skips).sort().slice(0, 800);
      Object.keys(g.att && typeof g.att === "object" ? g.att : {}).forEach(function (d) {
        var a = g.att[d];
        if (gDate(d) && a && typeof a === "object") att[d] = { present: ids(a.present), visitors: Math.min(999, Math.max(0, a.visitors | 0)), note: gStr(a.note, 200) };
      });
      g.att = att;
    });
    return gone;
  };
  // Removes a person everywhere in the shared part. Giving and care records keep their history and show "Removed person".
  M.removePerson = function (D, C, pid) {
    var i = D.people.findIndex(function (p) { return p.id === pid; }), hh;
    if (i < 0) return false;
    hh = D.people[i].hh; D.people.splice(i, 1);
    D.teams.forEach(function (t) { t.members = t.members.filter(function (x) { return x !== pid; }); if (t.lead === pid) t.lead = ""; });
    D.slots.forEach(function (s) { s.people = s.people.filter(function (x) { return x !== pid; }); });
    delete D.away[pid]; M.cleanGroups(D, pid);
    Object.keys(D.dayCodes || {}).forEach(function (d) { delete D.dayCodes[d][pid]; });
    if (C) delete C.people[pid];
    if (!D.people.some(function (p) { return p.hh === hh; })) { D.households = D.households.filter(function (h) { return h.id !== hh; }); if (C) delete C.hh[hh]; }
    return true;
  };
  function fold(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  // Every word typed must match somewhere: names, household, and (when the role can see them) phone and email.
  M.search = function (D, C, q, opt) {
    opt = opt || {};
    var x = M.index(D), words = fold(q).split(/\s+/).filter(Boolean), digits = String(q || "").replace(/\D/g, "");
    return D.people.filter(function (p) {
      if (opt.status && opt.status !== "all" && p.status !== opt.status) return false;
      if (!opt.status && p.status === "Former" && !words.length) return false;
      if (!words.length) return true;
      var c = C && C.people[p.id], hay = fold([p.first, p.last, p.pref, (x.h[p.hh] || {}).name, c ? c.email : ""].join(" "));
      if (words.every(function (w) { return hay.indexOf(w) >= 0; })) return true;
      return digits.length >= 4 && !!c && String(c.phone || "").replace(/\D/g, "").indexOf(digits) >= 0;
    }).sort(function (a, b) { return cmp(M.sortName(a), M.sortName(b)); });
  };
  M.stats = function (D) {
    var s = { people: 0, households: D.households.length, children: 0, byStatus: {} };
    D.people.forEach(function (p) { s.byStatus[p.status] = (s.byStatus[p.status] || 0) + 1; if (p.status !== "Former") { s.people++; if (p.kind === "Child") s.children++; } });
    return s;
  };
  M.birthdays = function (D, C, today, days) {
    var t = K.dayNum(today), out = [];
    if (!C) return out;
    D.people.forEach(function (p) {
      var c = C.people[p.id], m, d, n, y;
      if (!c || !c.dob || p.status === "Former" || !(m = /^\d{4}-(\d{2})-(\d{2})$/.exec(c.dob))) return;
      y = +today.slice(0, 4);
      for (n = 0; n < 2; n++) { d = K.dayNum((y + n) + "-" + m[1] + "-" + m[2]); if (m[1] === "02" && m[2] === "29" && isNaN(d)) d = K.dayNum((y + n) + "-03-01"); if (d >= t && d - t <= days) { out.push({ person: p, date: K.fromDay(d), inDays: d - t }); break; } }
    });
    return out.sort(function (a, b) { return a.inDays - b.inDays; });
  };

  /* ---------- CSV (RFC 4180 quoting; tab-separated text pasted from a spreadsheet works too) ---------- */
  M.parseCSV = function (text) {
    text = String(text || "").replace(/^\uFEFF/, "");
    var first = text.split(/\r?\n/)[0] || "", sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : ",";
    var rows = [], row = [], cell = "", q = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"' && cell === "") q = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return trim(c); }); });
  };
  var HEAD = { first: /^(first|first ?name|given ?name|forename)$/, last: /^(last|last ?name|surname|family ?name)$/, pref: /^(preferred|preferred ?name|known as|nickname)$/,
    household: /^(household|family|household ?name|family ?name ?group)$/, status: /^(status|membership)$/, kind: /^(kind|adult ?or ?child|age ?group|type)$/,
    phone: /^(phone|mobile|cell|telephone|phone ?number)$/, email: /^(email|e-mail|email ?address)$/, addr1: /^(address|street|address ?1|address ?line ?1)$/, addr2: /^(address ?2|address ?line ?2)$/,
    city: /^(city|town)$/, region: /^(state|region|county|province)$/, postal: /^(zip|zip ?code|postcode|postal ?code)$/, dob: /^(birth ?date|date ?of ?birth|dob|birthday)$/, joined: /^(joined|join ?date|member ?since)$/ };
  // Import people: rows with the same household name (or the same last name and address) join one household.
  M.importCSV = function (D, C, text) {
    var rows = M.parseCSV(text), col = {}, out = { added: 0, households: 0, skipped: [], dupes: 0 }, made = {};
    if (rows.length < 2) throw new Error("Paste a header row and at least one person.");
    rows[0].forEach(function (h, i) { var k = fold(trim(h)); Object.keys(HEAD).forEach(function (f) { if (col[f] == null && HEAD[f].test(k)) col[f] = i; }); });
    if (col.first == null || col.last == null) throw new Error("The first row needs columns called First name and Last name.");
    D.households.forEach(function (h) { made["n:" + h.name.toLowerCase()] = h.id; });
    rows.slice(1).forEach(function (r, n) {
      var g = function (f) { return col[f] == null ? "" : trim(r[col[f]]); }, first = g("first"), last = g("last"), hhName, key, hid, p, st, kind, dob;
      if (!first || !last) { out.skipped.push("Row " + (n + 2) + ": no name"); return; }
      if (D.people.length >= 20000) { out.skipped.push("Row " + (n + 2) + ": directory is full"); return; }
      if (M.cap && D.people.length >= M.cap.people) { out.skipped.push("Row " + (n + 2) + ": free trial limit of " + M.cap.people + " people"); return; }
      if (M.dupes(D, first, last).length) out.dupes++;
      hhName = g("household") || (last + " household");
      key = g("household") ? "n:" + hhName.toLowerCase() : g("addr1") ? "a:" + (last + "|" + g("addr1")).toLowerCase() : "";
      hid = key && made[key];
      if (!hid) { hid = M.addHousehold(D, hhName).id; if (key) made[key] = hid; out.households++; }
      st = M.STATUSES.filter(function (s) { return s.toLowerCase() === g("status").toLowerCase(); })[0] || "Member";
      kind = /child|kid|minor|youth/i.test(g("kind")) ? "Child" : "Adult";
      p = M.savePerson(D, { hh: hid, first: first, last: last, pref: g("pref"), status: st, kind: kind });
      if (C) {
        dob = g("dob"); if (dob && !K.isDate(dob)) dob = "";
        C.people[p.id] = { phone: g("phone").slice(0, 40), email: g("email").slice(0, 120), dob: dob, joined: K.isDate(g("joined")) ? g("joined") : "", notes: "", listed: true };
        if (g("addr1") && !C.hh[hid]) C.hh[hid] = { addr1: g("addr1").slice(0, 120), addr2: g("addr2").slice(0, 120), city: g("city").slice(0, 60), region: g("region").slice(0, 60), postal: g("postal").slice(0, 20), phone: "", email: "" };
      }
      out.added++;
    });
    return out;
  };
  M.directoryCSV = function (D, C) {
    var x = M.index(D), csv = csvLine(), rows = [csv(["Household", "First name", "Last name", "Preferred name", "Status", "Adult or child", "Phone", "Email", "Address", "Address 2", "City", "State or region", "Postal code", "Birth date", "Joined"])];
    D.people.slice().sort(function (a, b) { return cmp(M.sortName(a), M.sortName(b)); }).forEach(function (p) {
      var c = (C && C.people[p.id]) || {}, a = (C && C.hh[p.hh]) || {};
      rows.push(csv([(x.h[p.hh] || {}).name, p.first, p.last, p.pref, p.status, p.kind, c.phone, c.email, a.addr1, a.addr2, a.city, a.region, a.postal, c.dob, c.joined]));
    });
    return rows.join("\r\n") + "\r\n";
  };

  /* ---------- teams and rotas (Event Kit's roster, with dates) ---------- */
  M.win = function (s) { var a = K.hm(s.start), b = K.hm(s.end); if (a == null || b == null) return null; if (b <= a) b += 1440; return [a, b]; };
  M.overlap = function (a, b) { var x = M.win(a), y = M.win(b); return a.date === b.date && !!(x && y && x[0] < y[1] && y[0] < x[1]); };
  M.slotsIn = function (D, from, to, team) { return D.slots.filter(function (s) { return s.date >= from && s.date <= to && (!team || s.team === team); }).sort(function (a, b) { return cmp(a.date + a.start, b.date + b.start); }); };
  M.addSlot = function (D, o) {
    var s = { id: K.uid(), team: o.team, date: o.date, start: o.start || "10:00", end: o.end || "11:00", role: trim(o.role).slice(0, 60) || "Helper", need: Math.max(1, Math.min(30, o.need | 0 || 1)), people: [] };
    if (!D.teams.some(function (t) { return t.id === s.team; })) throw new Error("Choose a team.");
    if (!K.isDate(s.date)) throw new Error("Enter a valid date.");
    if (K.hm(s.start) == null || K.hm(s.end) == null) throw new Error("Enter start and end times.");
    D.slots.push(s); return s;
  };
  M.repeatWeekly = function (D, slot, weeks) {
    var out = [], w;
    for (w = 1; w <= Math.min(52, weeks | 0); w++) out.push(M.addSlot(D, { team: slot.team, date: K.addDays(slot.date, 7 * w), start: slot.start, end: slot.end, role: slot.role, need: slot.need }));
    return out;
  };
  M.isAway = function (D, pid, date) { return (D.away[pid] || []).indexOf(date) >= 0; };
  M.coverage = function (slots) {
    var rows = slots.map(function (s) { return { slot: s, filled: s.people.length, gap: Math.max(0, s.need - s.people.length) }; });
    return { rows: rows, need: rows.reduce(function (a, r) { return a + r.slot.need; }, 0), gaps: rows.reduce(function (a, r) { return a + r.gap; }, 0) };
  };
  // Double bookings (one person in two overlapping slots on the same day) and people booked on a day they marked as away.
  M.conflicts = function (D, slots) {
    var out = [], by = {};
    slots.forEach(function (s) { s.people.forEach(function (pid) { (by[pid] = by[pid] || []).push(s); if (M.isAway(D, pid, s.date)) out.push({ pid: pid, a: s, away: true }); }); });
    Object.keys(by).forEach(function (pid) { var l = by[pid], i, j; for (i = 0; i < l.length; i++) for (j = i + 1; j < l.length; j++) if (M.overlap(l[i], l[j])) out.push({ pid: pid, a: l[i], b: l[j] }); });
    return out;
  };
  // Fill gaps fairly: team members only, never on an away day or in an overlapping slot, fewest turns in the range first.
  M.autoFill = function (D, from, to, team) {
    var x = M.index(D), slots = M.slotsIn(D, from, to, team), all = M.slotsIn(D, from, to), turns = {}, added = 0;
    all.forEach(function (s) { s.people.forEach(function (pid) { turns[pid] = (turns[pid] || 0) + 1; }); });
    slots.forEach(function (s) {
      var t = D.teams.filter(function (q) { return q.id === s.team; })[0], cand;
      if (!t) return;
      while (s.people.length < s.need) {
        cand = t.members.filter(function (pid) {
          return x.p[pid] && x.p[pid].status !== "Former" && s.people.indexOf(pid) < 0 && !M.isAway(D, pid, s.date) &&
            !all.some(function (o) { return o !== s && o.people.indexOf(pid) >= 0 && M.overlap(o, s); });
        });
        if (!cand.length) break;
        cand.sort(function (a, b) { return (turns[a] || 0) - (turns[b] || 0) || cmp(M.sortName(x.p[a]), M.sortName(x.p[b])); });
        s.people.push(cand[0]); turns[cand[0]] = (turns[cand[0]] || 0) + 1; added++;
      }
    });
    return { added: added, gaps: M.coverage(slots).gaps };
  };
  M.rotaCSV = function (D, slots) {
    var x = M.index(D), tn = {}, csv = csvLine();
    D.teams.forEach(function (t) { tn[t.id] = t.name; });
    return [csv(["Date", "Day", "Start", "End", "Team", "Role", "Needed", "People"])].concat(slots.map(function (s) {
      return csv([s.date, K.weekday(s.date), s.start, s.end, tn[s.team], s.role, s.need, s.people.map(function (pid) { return M.name(x.p[pid]); }).join("; ")]);
    })).join("\r\n") + "\r\n";
  };

  /* ---------- gatherings and check-in (Event Kit's check-in, plus households and children's pickup codes) ---------- */
  var CODE = "ACDEFGHJKMNPQRTUVWXY34679";
  // Six characters from 25 easy-to-read symbols (about 28 bits), drawn without bias: bytes of 250 and above are thrown away.
  var CODE_LEN = 6, PICK_TRIES = 5, PICK_LOCK_MS = 5 * 60000;
  M.code = function (rnd, taken) {
    var s, i, b, guard = 0;
    rnd = rnd || function (n) { return root.crypto.getRandomValues(new Uint8Array(n)); };
    do {
      s = "";
      while (s.length < CODE_LEN) { b = rnd(16); for (i = 0; i < b.length && s.length < CODE_LEN; i++) if (b[i] < 250) s += CODE[b[i] % 25]; if (++guard > 1000) throw new Error("No randomness."); }
    } while (taken && taken[s]);
    return s;
  };
  M.normCode = function (s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); };
  // Pickup check: finds the child whose code matches at this gathering. Older 4-character codes still match.
  M.findPickup = function (D, ev, code) {
    var c = M.normCode(code), pid;
    if (c.length < 4) return null;
    for (pid in ev.ins) if (Object.prototype.hasOwnProperty.call(ev.ins, pid) && ev.ins[pid].code === c) return { pid: pid, person: D.people.filter(function (p) { return p.id === pid; })[0] || null, at: ev.ins[pid].at, out: ev.ins[pid].out || "" };
    return null;
  };
  M.markCollected = function (ev, pid, nowIso, by) {
    if (!ev.ins[pid] || !ev.ins[pid].code) return false;
    ev.ins[pid].out = nowIso || new Date().toISOString(); if (by) ev.ins[pid].outBy = String(by).slice(0, 80);
    return true;
  };
  // Attempt guard for the pickup screen: five wrong codes lock it for five minutes. state is kept per gathering, in memory.
  M.pickupGuard = function (state, now) {
    if (state.until && now < state.until) return { locked: true, wait: Math.ceil((state.until - now) / 60000), left: 0 };
    if (state.until && now >= state.until) { state.until = 0; state.misses = 0; }
    return { locked: false, left: PICK_TRIES - (state.misses || 0) };
  };
  M.pickupMiss = function (state, now) { state.misses = (state.misses || 0) + 1; if (state.misses >= PICK_TRIES) state.until = now + PICK_LOCK_MS; return M.pickupGuard(state, now); };
  M.pickupHit = function (state) { state.misses = 0; state.until = 0; };
  M.addEvent = function (D, o) {
    var e = { id: K.uid(), name: trim(o.name).slice(0, 80) || "Gathering", date: o.date, start: o.start || "", kind: M.GATHERINGS.indexOf(o.kind) >= 0 ? o.kind : "Weekly gathering", ins: {}, guests: [] };
    if (!K.isDate(e.date)) throw new Error("Enter a valid date.");
    D.events.push(e); return e;
  };
  // Toggle: checks a person in, or undoes it. Children get a pickup code that the collecting adult must match.
  function takenCodes(ev) { var t = {}, k; for (k in ev.ins) if (Object.prototype.hasOwnProperty.call(ev.ins, k) && ev.ins[k].code) t[ev.ins[k].code] = 1; return t; }
  M.checkIn = function (D, ev, pid, nowIso, rnd, person) {
    var p = person || D.people.filter(function (x) { return x.id === pid; })[0];
    if (!p) return { error: "Not in the directory." };
    if (ev.ins[pid]) { delete ev.ins[pid]; return { person: p, undone: true }; }
    ev.ins[pid] = { at: nowIso || new Date().toISOString() };
    if (p.kind === "Child") ev.ins[pid].code = M.dayCode(D, ev.date, pid, rnd, takenCodes(ev)); // one code per child per day, never shared by two children that day
    return { person: p, code: ev.ins[pid].code };
  };
  // The day's code for a child: made once, kept for the rest of that date (a second gathering, an undo and a re-check-in all give the same code),
  // and never handed to another child on that date. Kept in D.dayCodes (date -> person -> code); only the latest DAY_KEEP dates are remembered.
  M.DAY_KEEP = 45;
  M.dayCode = function (D, date, pid, rnd, extraTaken) {
    var day, taken = {}, k, tries = 0, code, dates;
    D.dayCodes = D.dayCodes || {};
    day = D.dayCodes[date] = D.dayCodes[date] || {};
    if (day[pid]) return day[pid];
    for (k in day) if (Object.prototype.hasOwnProperty.call(day, k)) taken[day[k]] = 1;
    if (extraTaken) for (k in extraTaken) if (Object.prototype.hasOwnProperty.call(extraTaken, k)) taken[k] = 1;
    do { code = M.code(rnd, null); if (++tries > 2000) throw new Error("No free pickup code."); } while (taken[code]);
    day[pid] = code;
    dates = Object.keys(D.dayCodes).sort();
    while (dates.length > M.DAY_KEEP) { k = dates.shift(); if (k !== date) delete D.dayCodes[k]; }
    return code;
  };
  M.checkInHousehold = function (D, ev, hid, nowIso, rnd) {
    var n = 0, codes = [];
    D.people.forEach(function (p) { if (p.hh === hid && p.status !== "Former" && !ev.ins[p.id]) { var r = M.checkIn(D, ev, p.id, nowIso, rnd, p); n++; if (r.code) codes.push({ name: M.name(p), code: r.code }); } });
    return { added: n, codes: codes };
  };
  M.addGuest = function (ev, name, nowIso) {
    name = trim(name).slice(0, 80);
    if (!name) return { error: "Enter the guest's name." };
    var g = { id: K.uid(), name: name, at: nowIso || new Date().toISOString() }; ev.guests.push(g); return { guest: g };
  };
  // x (optional) is a ready index, so a list of gatherings costs one index, not one per gathering.
  M.counts = function (D, ev, x) {
    x = x || M.index(D);
    var n = { members: 0, children: 0, guests: ev.guests.length, total: 0 };
    Object.keys(ev.ins).forEach(function (pid) { n.members++; if (x.p[pid] && x.p[pid].kind === "Child") n.children++; });
    n.total = n.members + n.guests; return n;
  };
  M.lastSeen = function (D) { var m = {}; D.events.forEach(function (e) { Object.keys(e.ins).forEach(function (pid) { if (!m[pid] || e.date > m[pid]) m[pid] = e.date; }); }); return m; };
  // Members and regular attenders who have not checked in for a while: a gentle prompt that nobody is forgotten.
  M.notSeen = function (D, today, weeks) {
    var seen = M.lastSeen(D), cut = K.addDays(today, -7 * (weeks || 6)), past = D.events.filter(function (e) { return e.date <= today; });
    if (!past.length) return [];
    return D.people.filter(function (p) { return (p.status === "Member" || p.status === "Regular attender") && (!seen[p.id] || seen[p.id] < cut); })
      .map(function (p) { return { person: p, last: seen[p.id] || "" }; })
      .sort(function (a, b) { return cmp(a.last, b.last) || cmp(M.sortName(a.person), M.sortName(b.person)); });
  };
  M.trend = function (D, today, n) {
    var x = M.index(D);
    return D.events.filter(function (e) { return e.date <= today; }).sort(function (a, b) { return cmp(a.date, b.date); }).slice(-(n || 12))
      .map(function (e) { var c = M.counts(D, e, x); return { event: e, total: c.total }; });
  };

  /* ---------- care visits (private notes live in a separate, separately-keyed part) ---------- */
  M.saveVisit = function (Cv, o) {
    var v = { id: o.id || K.uid(), person: o.person, date: o.date, kind: M.CARE_KINDS.indexOf(o.kind) >= 0 ? o.kind : "Other", by: trim(o.by).slice(0, 80),
      summary: trim(o.summary).slice(0, 500), follow: o.follow || "", done: !!o.done };
    if (!v.person) throw new Error("Choose who was visited.");
    if (!K.isDate(v.date)) throw new Error("Enter a valid date.");
    if (v.follow && !K.isDate(v.follow)) throw new Error("The follow-up date is not valid.");
    var i = Cv.visits.findIndex(function (x) { return x.id === v.id; });
    if (i < 0) Cv.visits.push(v); else Cv.visits[i] = v;
    return v;
  };
  M.removeVisit = function (Cv, N, id) { Cv.visits = Cv.visits.filter(function (v) { return v.id !== id; }); if (N) delete N.byVisit[id]; };
  M.followUps = function (Cv, today, days) { var lim = K.addDays(today, days || 7); return Cv.visits.filter(function (v) { return v.follow && !v.done && v.follow <= lim; }).sort(function (a, b) { return cmp(a.follow, b.follow); }); };
  M.pruneNotes = function (Cv, N) { var ids = {}; Cv.visits.forEach(function (v) { ids[v.id] = 1; }); Object.keys(N.byVisit).forEach(function (k) { if (!ids[k]) delete N.byVisit[k]; }); };

  /* ---------- help requests (sometimes called benevolence) ---------- */
  M.saveRequest = function (H, o) {
    var r = { id: o.id || K.uid(), date: o.date, person: o.person || "", name: trim(o.name).slice(0, 80), need: M.NEEDS.indexOf(o.need) >= 0 ? o.need : "Other",
      asked: o.asked | 0, story: trim(o.story).slice(0, 2000), status: M.HELP_STATUS.indexOf(o.status) >= 0 ? o.status : "New",
      given: o.given | 0, referral: trim(o.referral).slice(0, 120), decided: o.decided || "", by: trim(o.by).slice(0, 80), entry: o.entry || "" };
    if (!r.person && !r.name) throw new Error("Choose a person from the directory or type the name of the neighbour asking for help.");
    if (!K.isDate(r.date)) throw new Error("Enter a valid date.");
    if (r.asked < 0 || r.given < 0) throw new Error("Amounts cannot be negative.");
    var i = H.requests.findIndex(function (x) { return x.id === r.id; });
    if (i < 0) H.requests.push(r); else H.requests[i] = r;
    return r;
  };
  M.helpTotals = function (H, year) {
    var y = String(year), t = { count: 0, open: 0, helped: 0, given: 0, byNeed: {} };
    H.requests.forEach(function (r) {
      if (r.status === "New" || r.status === "Reviewing" || r.status === "Approved") t.open++;
      if (r.date.slice(0, 4) !== y) return;
      t.count++; if (r.status === "Helped") t.helped++; t.given += r.given; t.byNeed[r.need] = (t.byNeed[r.need] || 0) + 1;
    });
    return t;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = M;
  root.StarkCommunity = M;
})(typeof globalThis !== "undefined" ? globalThis : this);
