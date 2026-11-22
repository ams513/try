/* Stark Fellowship, by Stark: example community. Every name, address and amount is made up.
   Phone numbers use the fictional 555-01xx range and emails use example.org. Names and amounts repeat for a given date; record ids are random. */
(function (root) {
  "use strict";
  var K = root.StarkCore || require("./core.js"), B = root.StarkBooks || require("./books.js"), M = root.StarkCommunity || require("./community.js");
  var FIRST_A = ["Amara", "Ben", "Chen", "Dalia", "Elif", "Farid", "Grace", "Hana", "Ibrahim", "Joanna", "Kofi", "Leila", "Mateo", "Nadia", "Omar", "Priya", "Quinn", "Rosa", "Samuel", "Tamar",
    "Uche", "Valeria", "Wei", "Ximena", "Yusuf", "Zara", "Aditya", "Bridget", "Carlos", "Deborah", "Emeka", "Fatima", "Gabriel", "Hiroshi", "Ines", "Jamal", "Kavya", "Liam", "Miriam", "Noah",
    "Olga", "Pedro", "Rania", "Sofia", "Thomas", "Ayesha", "Daniel", "Esther", "Hassan", "Julia", "Kenji", "Lucia", "Moses", "Nkechi", "Oren", "Rahul", "Sana", "Tomas", "Vera", "Ruth"];
  var FIRST_C = ["Ada", "Bilal", "Clara", "Dev", "Ella", "Finn", "Gita", "Hugo", "Isla", "Jonah", "Kai", "Lina", "Maya", "Nico", "Owen", "Pia", "Rami", "Sami", "Tara", "Yara", "Zain", "Leo", "Mila", "Ari"];
  var LAST = ["Okafor", "Nguyen", "Haddad", "Rivera", "Cohen", "Patel", "Mensah", "Kowalski", "Berg", "Garcia", "Kim", "Nair", "Rossi", "Yilmaz", "Abebe", "Silva", "Novak", "Tanaka", "Ibrahim", "Murphy",
    "Schmidt", "Lopez", "Chen", "Adeyemi", "Johansson", "Khan", "Levi", "Morales", "Dubois", "Osei", "Popescu", "Singh", "Walker", "Andersen", "Farah", "Greene", "Hughes", "Jovanovic", "Kaur", "Larsen",
    "Mahmoud", "Ortiz", "Park", "Quispe", "Rahman", "Sato", "Torres", "Usman", "Varga", "Wright", "Xu", "Young", "Zhou", "Baptiste", "Castillo", "Diallo", "Edwards", "Friedman", "Gupta", "Hossain"];
  var STREETS = ["Mill Lane", "Orchard Road", "River Street", "Station Road", "Elm Avenue", "Linden Road", "Market Street", "Park Road", "Willow Way", "Hill Street", "Bridge Road", "Maple Drive"];
  var TEAMS = [["Welcome team", 14], ["Kitchen and shared meals", 12], ["Readers and speakers", 8], ["Children's group leaders", 9], ["Youth leaders", 6], ["Sound and screens", 5], ["Set-up and pack-down", 10], ["Care visitors", 8], ["Garden and grounds", 7]];
  var SUMMARIES = [["Home visit", "Visited at home after a hospital stay; recovering well."], ["Bereavement", "Phone call to check in after a bereavement."], ["Welcome visit", "Welcome visit for a new household."],
    ["Hospital or care home", "Hospital visit before surgery."], ["Meeting", "Coffee to talk about joining a team."], ["New baby", "Brought a meal after the new baby arrived."],
    ["Hospital or care home", "Visited at the care home; enjoyed hearing the community news."], ["Phone call", "Call about getting to gatherings without a car."]];
  var NOTES = ["Asked us to keep this private. Feeling low since the job loss; would welcome a regular call.", "Family is under strain. Offered to meet again next week.", "Grieving deeply. Prefers visits in the morning.",
    "Worried about the cost of medicine. Mentioned the help fund might be needed.", "Would like quiet support, no announcements please.", "Talked through a hard decision about caring for a parent."];
  var STORIES = ["Car repair needed to keep getting to work.", "Behind on the electricity bill after reduced hours.", "Family of four short on groceries this month.", "Rent shortfall after a hospital stay.",
    "Bus pass for medical appointments.", "Help with a funeral reception.", "Prescription costs not covered."];
  var DEMO_PASS = "example only: river stones lantern";
  var USERS = [["Sam Rivera (example)", "leader"], ["Dana Okafor (example)", "admin"], ["Priya Nair (example)", "care"], ["Tom Berg (example)", "finance"], ["Lena Haddad (example)", "teams"], ["Kofi Mensah (example)", "checkin"]];

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function build(today, target) {
    var cap = M.cap, out;
    M.cap = null;   // the made-up example community is not counted against the free trial limit
    try { out = build2(today, target); } finally { M.cap = cap; }
    return out;
  }
  function build2(today, target) {
    var R = rng(20261120), pick = function (a) { return a[Math.floor(R() * a.length)]; }, n = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
    var D = M.emptyCore("Riverside Community (example)"), C = M.emptyContact(), G = B.empty(), Cv = M.emptyCare(), N = M.emptyNotes(), H = M.emptyHelp();
    var year = +today.slice(0, 4), adults = [], kids = [], i, sizes = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5];
    D.settings.address = "1 River Street, Riverside, ST 00000 (example)"; D.settings.taxId = "00-0000000 (example)"; D.settings.signer = "Dana Okafor"; D.settings.signerTitle = "Administrator";
    target = target || 2000;
    var at = function (a, k) { return a[k % a.length]; };   // small example communities (the free trial) reuse entries instead of running off the end
    // households and people
    while (adults.length + kids.length < target) { // current (not former) people
      var last = pick(LAST), h = M.addHousehold(D, last + " household"), size = pick(sizes), a = size === 1 ? 1 : R() < 0.18 ? 1 : 2, st = R();
      var status = st < 0.6 ? "Member" : st < 0.8 ? "Regular attender" : st < 0.86 ? "Visitor" : st < 0.94 ? "Friend" : "Former";
      C.hh[h.id] = { addr1: n(1, 240) + " " + pick(STREETS), addr2: "", city: "Riverside", region: "ST", postal: "00000", phone: "555-01" + ("0" + n(0, 99)).slice(-2), email: "" };
      for (i = 0; i < size; i++) {
        var child = i >= a, p = M.savePerson(D, { hh: h.id, first: pick(child ? FIRST_C : FIRST_A), last: last, kind: child ? "Child" : "Adult", status: status });
        var y = child ? year - n(3, 15) : year - n(19, 84);
        C.people[p.id] = { phone: child ? "" : "555-01" + ("0" + n(0, 99)).slice(-2), email: child ? "" : p.first.toLowerCase() + "." + last.toLowerCase() + n(1, 99) + "@example.org",
          dob: R() < 0.7 ? y + "-" + K.pad(n(1, 12)) + "-" + K.pad(n(1, 28)) : "", joined: R() < 0.6 ? (year - n(0, 20)) + "-" + K.pad(n(1, 12)) + "-01" : "", notes: "", listed: R() > 0.08 };
        if (status !== "Former") (child ? kids : adults).push(p);
      }
      h.name = last + ", " + D.people.filter(function (q) { return q.hh === h.id && q.kind === "Adult"; }).map(function (q) { return q.first; }).join(" and ");
    }
    // today's birthdays, so the home page shows some
    for (i = 0; i < 3; i++) C.people[at(adults, i * 7).id].dob = (year - 40 - i) + today.slice(4, 7) + "-" + K.pad(Math.min(28, +today.slice(8, 10) + i * 2));
    // teams and rotas: next six weeks, some filled, gaps left for "fill gaps fairly"
    TEAMS.forEach(function (t, ti) {
      var team = { id: K.uid(), name: t[0], lead: "", members: [] };
      while (team.members.length < Math.min(t[1], adults.length)) { var p = adults[n(0, adults.length - 1)]; if (team.members.indexOf(p.id) < 0) team.members.push(p.id); }
      team.lead = team.members[0]; D.teams.push(team);
      if (ti > 6) return;
      var dow = ti === 1 ? 5 : ti === 4 ? 3 : 0; // shared meals on Fridays, youth on Wednesdays, the rest at the weekly gathering
      var first = K.addDays(today, ((dow - ((K.dayNum(today) + 4) % 7)) + 7) % 7);
      for (var w = 0; w < 6; w++) {
        var s = M.addSlot(D, { team: team.id, date: K.addDays(first, 7 * w), start: ti === 1 ? "17:30" : ti === 4 ? "18:30" : ti === 6 ? "09:00" : "09:45", end: ti === 1 ? "20:00" : ti === 4 ? "20:00" : ti === 6 ? "10:00" : "12:00",
          role: ["Door and welcome", "Cooking and serving", "Reader", "Children's group", "Youth leader", "Sound desk", "Set-up"][ti], need: [2, 3, 1, 2, 2, 1, 2][ti] });
        if (w < 2) s.people = team.members.slice((w * s.need) % team.members.length, (w * s.need) % team.members.length + s.need);
      }
    });
    D.away[at(D.teams[0].members, 3)] = [K.addDays(today, 2), K.addDays(today, 9)];
    // gatherings with check-ins over the last 12 weeks
    for (var wk = 12; wk >= 1; wk--) {
      var sun = K.addDays(today, -((K.dayNum(today) + 4) % 7) - 7 * (wk - 1)), meal = K.addDays(sun, -2), youth = K.addDays(sun, -4);
      [[sun, "Weekly gathering", "10:00", 0.62], [meal, "Shared meal", "18:00", 0.18], [youth, "Youth group", "18:30", 0.5]].forEach(function (g, gi) {
        if (g[0] >= today || (gi === 1 && wk % 2)) return;
        var ev = M.addEvent(D, { name: g[1], date: g[0], start: g[2], kind: g[1] });
        (gi === 2 ? kids.filter(function () { return R() < 0.5; }) : adults.concat(kids)).forEach(function (p) {
          if (p.status !== "Visitor" && R() < g[3] * (p.status === "Member" ? 1 : 0.6) && (p.id.charCodeAt(0) % 9 || p.id.charCodeAt(1) % 9)) M.checkIn(D, ev, p.id, g[0] + "T" + g[2] + ":00.000Z", function () { return [n(0, 99), n(0, 99), n(0, 99), n(0, 99)]; });
        });
        for (var q = 0; q < n(1, 6); q++) M.addGuest(ev, pick(FIRST_A) + " " + pick(LAST) + " (guest)", g[0] + "T" + g[2] + ":00.000Z");
      });
    }
    var tonight = M.addEvent(D, { name: "Shared meal", date: today, start: "18:00", kind: "Shared meal" });
    adults.slice(0, 26).forEach(function (p) { M.checkIn(D, tonight, p.id, today + "T18:05:00.000Z", function () { return [n(0, 99), n(0, 99), n(0, 99), n(0, 99)]; }); });
    kids.slice(0, 5).forEach(function (p) { M.checkIn(D, tonight, p.id, today + "T18:06:00.000Z", function () { return [n(0, 99), n(0, 99), n(0, 99), n(0, 99)]; }); });
    M.addGuest(tonight, "Rosa Lindqvist (guest)", today + "T18:10:00.000Z");
    // children's check-in to try: today's children's group, with a few children in, one already collected, and care notes in the three states (agreed, not agreed, none)
    var kidsGroup = M.addEvent(D, { name: "Children's group", date: today, start: "17:30", kind: "Children's group" }), kseen = {}, ktry = [], kk;
    for (kk = 0; kk < kids.length && ktry.length < 8; kk++) if (!kseen[kids[kk].hh]) { kseen[kids[kk].hh] = 1; ktry.push(kids[kk]); }   // one child per family, so each care-note state is its own family
    ktry.forEach(function (p, ki) { M.checkIn(D, kidsGroup, p.id, today + "T17:" + K.pad(32 + ki) + ":00.000Z", function () { return [n(0, 99), n(0, 99), n(0, 99), n(0, 99)]; }); });
    if (ktry[0]) { C.people[ktry[0].id].notes = "Peanut allergy: carries an auto-injector in her bag."; D.households.filter(function (g) { return g.id === ktry[0].hh; })[0].careOnLabel = true; }
    if (ktry[1]) { C.people[ktry[1].id].notes = "Asthma: inhaler is in his backpack."; D.households.filter(function (g) { return g.id === ktry[1].hh; })[0].careOnLabel = true; }
    if (ktry[2]) C.people[ktry[2].id].notes = "Dairy allergy. Family has not agreed to print this on a label.";
    if (ktry[3]) M.markCollected(kidsGroup, ktry[3].id, today + "T18:20:00.000Z", "Sam Rivera (example)");
    if (M.groupsExample) M.groupsExample(D, adults, today);   // adults only, no random draws: everything after this is unchanged
    // giving: last full year and this year to date, typed in by hand
    var givers = [], f = G.funds, hhs = D.households.slice(0, 260);
    hhs.forEach(function (h, k) { givers.push({ key: k % 13 === 0 ? "p:" + D.people.filter(function (p) { return p.hh === h.id; })[0].id : "h:" + h.id, base: n(2, 40) * 500, every: pick([7, 14, 30, 30, 30]), method: pick(["Check", "Bank transfer", "Bank transfer", "Cash", "Card (taken elsewhere)"]) }); });
    var start = (year - 1) + "-01-01";
    givers.forEach(function (gv, k) {
      for (var d = K.addDays(start, k % 7); d <= today; d = K.addDays(d, gv.every)) {
        if (R() < 0.12) continue;
        B.addGift(G, { date: d, giver: gv.key, amount: gv.base + (R() < 0.1 ? n(1, 20) * 500 : 0), fund: R() < 0.82 ? f[0].id : R() < 0.6 ? f[1].id : R() < 0.5 ? f[2].id : f[3].id, method: gv.method, ref: gv.method === "Check" ? String(1000 + n(1, 8999)) : "" });
      }
    });
    for (var s2 = start; s2 <= today; s2 = K.addDays(s2, 7)) B.addGift(G, { date: s2, giver: "", amount: n(60, 340) * 100 + n(0, 99), fund: f[0].id, method: "Cash", memo: "Loose collection, counted by two volunteers" });
    for (i = 0; i < Math.min(18, givers.length); i++) B.addGift(G, { date: (year - 1) + "-10-18", giver: at(givers, i * 3).key, amount: 10000, fund: f[3].id, method: "Check", ref: String(5000 + i), gsDesc: "Harvest dinner ticket", gsValue: 3500 });
    B.addGift(G, { date: (year - 1) + "-06-02", giver: at(givers, 1).key, method: "Non-cash gift", fund: f[1].id, noncash: "Two folding tables and twelve chairs for the hall" });
    B.addGift(G, { date: (year - 1) + "-11-09", giver: at(givers, 4).key, method: "Non-cash gift", fund: f[3].id, noncash: "Used laptop for the homework club" });
    for (var m = 0; m < 22; m++) { var md = K.addDays(start, m * 30 + 20); if (md > today) break; B.spend(G, { date: md, fund: f[1].id, amount: n(150, 900) * 100, memo: "Building repairs and upkeep" }); B.spend(G, { date: md, fund: f[3].id, amount: n(80, 300) * 100, memo: "Outreach supplies" }); }
    // cash is paid into the bank each Monday, keeping a small float
    var ents = G.entries.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }), ci = 0, onHand = 0;
    for (var dd = K.addDays(start, 1); dd <= today; dd = K.addDays(dd, 7)) {
      while (ci < ents.length && ents[ci].date <= dd) { ents[ci].lines.forEach(function (l) { if (l.a === B.CASH) onHand += l.dr - l.cr; }); ci++; }
      if (onHand > 20000) { B.moveCash(G, { date: dd, amount: onHand - 15000 }); onHand = 15000; }
    }
    B.closeYear(G, year - 1);
    // care visits with private notes
    for (i = 0; i < 42; i++) {
      var who = adults[n(0, adults.length - 1)], vd = K.addDays(today, -n(0, 90));
      var sm = pick(SUMMARIES), v = M.saveVisit(Cv, { person: who.id, date: vd, kind: sm[0], by: pick(["Priya Nair", "Sam Rivera", "Care visitor"]), summary: sm[1], follow: i % 3 === 0 ? K.addDays(today, n(-3, 10)) : "", done: i % 9 === 0 });
      if (i % 4 !== 3) N.byVisit[v.id] = pick(NOTES);
    }
    // help requests, some paid from the Help fund
    for (i = 0; i < 16; i++) {
      var hd = K.addDays(today, -n(1, 300)), stat = M.HELP_STATUS[i % 6], member = i % 3 !== 2, asked = n(4, 60) * 1000;
      var r = M.saveRequest(H, { date: hd, person: member ? adults[n(0, adults.length - 1)].id : "", name: member ? "" : pick(FIRST_A) + " " + pick(LAST) + " (neighbour)", need: pick(M.NEEDS), asked: asked,
        story: pick(STORIES), status: stat, given: stat === "Helped" ? asked : 0, referral: stat === "Referred" ? pick(M.REFERRALS) : "", decided: stat === "New" ? "" : K.addDays(hd, 3), by: "Priya Nair" });
      if (stat === "Helped" && K.addDays(hd, 3) > G.lockDate) r.entry = B.spend(G, { date: K.addDays(hd, 3) > today ? today : K.addDays(hd, 3), fund: f[2].id, amount: asked, memo: "Help request: " + r.need, kind: "help", ref: r.id }).id;
    }
    M.log(D, "Setup", "Example community created");
    return { core: D, contact: C, giving: G, care: Cv, notes: N, help: H };
  }

  // Creates the example book with one user per role. iter lets the tests run quickly.
  function create(today, iter, target) {
    var data = build(today, target);
    return K.createBook({ name: data.core.settings.name, leader: USERS[0][0], pass: DEMO_PASS, iter: iter, demo: true, data: data }).then(function (r) {
      var chain = Promise.resolve();
      USERS.slice(1).forEach(function (u) { chain = chain.then(function () { return K.makeUser(r.session, u[0], u[1], DEMO_PASS, iter).then(function (x) { r.file.users.push(x); }); }); });
      return chain.then(function () { return K.stamp(r.session, r.file); }).then(function () { r.data = data; return r; });
    });
  }

  var api = { build: build, create: create, PASS: DEMO_PASS, USERS: USERS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.StarkDemo = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
