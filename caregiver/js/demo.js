/* Stark Caregiver, by Stark: example data for "Look around with example data first". Everyone and everything here is made up.
   It is built in memory only and never saved. Dates are relative to today so the example always looks current. */
(function (root) {
  "use strict";
  var V = root.CareCore || (typeof require === "function" ? require("./core.js") : null);
  var L = root.CareLogic || (typeof require === "function" ? require("./care.js") : null);

  function build(today, now) {
    var t = today || V.todayStr(), nowMin = L.hm(now || "12:00") || 720, d = function (n) { return V.addDays(t, n); };
    var v = V.emptyVault("Ana", "Rose"), R = v.rota, rose = v.people[0], ana = R.helpers[0];
    rose.rel = "Mum"; rose.dob = "1941-03-14";
    var walter = { id: V.uid(), name: "Walter", rel: "Dad", dob: "1938-07-02" };
    v.people.push(walter);
    ana.rel = "Daughter (main carer)"; ana.phone = "555-0142";
    var ben = { id: V.uid(), name: "Ben", rel: "Son", phone: "555-0157", off: [2, 4], notes: "Works Tuesdays and Thursdays" },
      priya = { id: V.uid(), name: "Priya", rel: "Neighbour", phone: "555-0163", off: [0, 6], notes: "Weekdays only" },
      agency = { id: V.uid(), name: "Harbor Home Care", rel: "Agency carer", phone: "555-0170", off: [], notes: "Booked through the council" };
    R.helpers.push(ben, priya, agency);
    v.settings.lastBy = ana.id; v.settings.lastBackup = d(-10);

    var med = function (p, name, dose, how, times, purpose, prescriber, extra) {
      var m = { id: V.uid(), person: p.id, name: name, dose: dose, how: how, times: times, prn: false, purpose: purpose, prescriber: prescriber, pharmacy: "Main Street Pharmacy 555-0101",
        started: d(-200), refill: "", leadDays: "7", active: true, stopped: "", notes: "" };
      Object.keys(extra || {}).forEach(function (k) { m[k] = extra[k]; });
      v.meds.push(m); return m;
    };
    var metformin = med(rose, "Metformin", "500 mg, 1 tablet", "With food", "08:00, 18:00", "Blood sugar", "Dr Lee", { refill: d(5), onHand: "14", counted: d(-3) }),
      donepezil = med(rose, "Donepezil", "5 mg, 1 tablet", "At bedtime", "21:00", "Memory", "Dr Okafor", { refill: d(19), onHand: "12", counted: d(-1) }),
      amlodipine = med(rose, "Amlodipine", "5 mg, 1 tablet", "In the morning", "08:00", "Blood pressure", "Dr Lee", { refill: d(26), onHand: "30", counted: d(-2) }),
      paracetamol = med(rose, "Paracetamol", "500 mg", "As on the label", "", "Knee pain", "Dr Lee", { prn: true }),
      atorva = med(walter, "Atorvastatin", "20 mg, 1 tablet", "In the evening", "20:00", "Cholesterol", "Dr Lee", { refill: d(12) });
    var helpers = [ana, ben, priya, agency];
    // Thirty days of doses, logged by whoever was on. A few were missed; today's later doses are not due yet.
    [metformin, donepezil, amlodipine, atorva].forEach(function (m, mi) {
      for (var i = -29; i <= 0; i++) {
        L.parseTimes(m.times).forEach(function (slot, si) {
          var day = d(i), s = L.hm(slot), w = helpers[(i + 29 + si + mi) % helpers.length];
          if (i === 0 && s > nowMin - 20) return;
          var missed = (m === donepezil && i === -3) || (m === metformin && i === -6 && slot === "18:00") || (m === atorva && i === -9);
          if (i === 0 && m === amlodipine) return; // today's morning tablet not logged yet, to show an open slot
          L.addDose(v, { med: m.id, person: m.person, date: day, slot: slot, status: missed ? "missed" : "given", at: L.fmtHm(s + 5 + ((i * 7 + mi * 3) % 20 + 20) % 20), by: w.id, byName: w.name,
            note: missed ? (m === donepezil ? "Asleep in the chair before nine; did not want to be woken." : m === atorva ? "Refused, said he had already taken it." : "Out at the clinic; came back late.") : "" });
        });
      }
    });
    L.addDose(v, { med: paracetamol.id, person: rose.id, date: d(-2), slot: "", status: "given", at: "15:10", by: priya.id, byName: priya.name, note: "Knee sore after the walk" });
    L.addDose(v, { med: paracetamol.id, person: rose.id, date: d(-1), slot: "", status: "given", at: "10:40", by: ana.id, byName: ana.name, note: "Knee again" });

    var e = function (o) { o.id = V.uid(); o.by = o.by || ana.id; o.byName = o.byName || ana.name; v.diary.push(o); return o; };
    e({ kind: "appointment", person: rose.id, date: d(3), time: "10:30", title: "Memory clinic review", type: "Specialist", with: "Dr Okafor", place: "Riverside General, clinic 4", leadDays: "3",
      questions: "Could the dizziness be linked to anything we can change?\nIs there help with bathing at home?\nShould the bedtime tablet move earlier?" });
    e({ kind: "appointment", person: walter.id, date: d(9), time: "14:00", title: "Eye check", type: "Eyes or hearing", with: "Optician", place: "High Street Opticians", leadDays: "3" });
    e({ kind: "appointment", person: rose.id, date: d(-12), time: "09:15", title: "Check-up with the family doctor", type: "Family doctor", with: "Dr Lee", place: "Elm Street Surgery",
      outcome: "Blood test in 2 weeks. Keep the same tablets. Come back if the dizziness gets worse." });
    e({ kind: "symptom", person: rose.id, date: d(-10), time: "11:20", what: "Dizzy or unsteady", severity: "2", notes: "Getting up from the sofa. Passed after a minute sitting down.", by: priya.id, byName: priya.name });
    e({ kind: "symptom", person: rose.id, date: d(-7), time: "08:40", what: "Dizzy or unsteady", severity: "3", notes: "Before breakfast. Held on to the counter.", by: agency.id, byName: agency.name });
    e({ kind: "symptom", person: rose.id, date: d(-5), time: "22:15", what: "Fall or near fall", severity: "3", notes: "Near fall in the bathroom at night. Did not hit anything. Night light now on.", by: ben.id, byName: ben.name });
    e({ kind: "symptom", person: rose.id, date: d(-4), time: "07:30", what: "Poor sleep", severity: "2", notes: "Up three times in the night." });
    e({ kind: "symptom", person: rose.id, date: d(-2), time: "16:00", what: "Confused or muddled", severity: "3", notes: "Thought it was Sunday; asked for her sister twice. Better by the evening.", by: priya.id, byName: priya.name });
    e({ kind: "symptom", person: rose.id, date: d(-1), time: "09:00", what: "Dizzy or unsteady", severity: "2", notes: "Standing up quickly after breakfast." });
    e({ kind: "observation", person: rose.id, date: d(-1), time: "13:10", title: "Ate all of lunch and was chatty in the afternoon", notes: "" });
    e({ kind: "observation", person: walter.id, date: d(-3), time: "18:30", title: "Walked to the post box and back", notes: "Slow but steady, happy to be out." });

    // The rota: a morning and an evening visit every day, plus the clinic trip. Filled fairly, then two gaps left open on purpose.
    L.addRepeating(R, { role: "Morning visit", start: "08:00", end: "10:00", need: 1 }, d(-2), 16, []);
    L.addRepeating(R, { role: "Evening visit", start: "17:30", end: "20:00", need: 1 }, d(-2), 16, []);
    L.addRepeating(R, { role: "Memory clinic trip", start: "09:30", end: "12:30", need: 1, person: rose.id }, d(3), 1, []);
    L.autoFill(R, d(-2), d(13));
    var openGap = function (day, role) { var s = R.shifts.filter(function (x) { return x.date === day && x.role === role; })[0]; if (s) R.assign[s.id] = []; };
    openGap(d(4), "Evening visit"); openGap(d(6), "Morning visit");
    L.addHandover(R, { date: d(-1), time: "20:05", by: ben.id, byName: ben.name, person: rose.id, text: "Mum ate most of her dinner. A bit muddled after her nap, settled with the radio on. Evening tablets given at 18:10.", next: "Pads are running low. Memory clinic on " + d(3) + ": questions are in the diary." });
    L.addHandover(R, { date: d(-1), time: "10:05", by: priya.id, byName: priya.name, person: rose.id, text: "Breakfast and morning tablets done. Dizzy for a minute standing up; noted in the diary.", next: "" });
    L.addHandover(R, { date: d(-2), time: "20:00", by: agency.id, byName: agency.name, person: walter.id, text: "Walter in good spirits, watched the football. Evening tablet given.", next: "He asked about the eye appointment; it is in the diary." });

    v.health[rose.id] = { blood: "A+", insurer: "Acme Health, member ending 4821", allergies: "Penicillin (rash)", conditions: "Type 2 diabetes; high blood pressure; memory problems under the memory clinic since 2025",
      doctors: "Dr Lee (family doctor) 555-0100; Dr Okafor (memory clinic) 555-0133", routine: "Up at 7. Tea with milk, no sugar. Likes the radio on in the afternoon. Bed around 9.",
      communication: "Hard of hearing on the left. Speak slowly, one question at a time. Calmer when people say who they are.", mobility: "Walking frame indoors; wheelchair for trips out. Grab rail in the bathroom.",
      eating: "Small portions, likes to eat at the table.", wishes: "Wants to stay at home. Advance directive: see Documents.", notes: "", updated: d(-12) };
    v.health[walter.id] = { blood: "O+", allergies: "None known", conditions: "High cholesterol; cataracts", doctors: "Dr Lee (family doctor) 555-0100", routine: "Reads the paper every morning.", communication: "Wears glasses for reading.", mobility: "Walks with a stick.", updated: d(-30) };

    v.contacts.push({ id: V.uid(), name: "Ana", role: "Emergency contact", rel: "Daughter", phone: "555-0142", emergency: true },
      { id: V.uid(), name: "Ben", role: "Emergency contact", rel: "Son", phone: "555-0157", emergency: true },
      { id: V.uid(), name: "Dr Lee", role: "Family doctor", rel: "Elm Street Surgery", phone: "555-0100", hours: "Weekdays 8 to 6; out-of-hours 555-0111" },
      { id: V.uid(), name: "Dr Okafor", role: "Specialist", rel: "Memory clinic, Riverside General", phone: "555-0133" },
      { id: V.uid(), name: "Main Street Pharmacy", role: "Pharmacy", phone: "555-0101", hours: "Mon to Sat 9 to 6" },
      { id: V.uid(), name: "Harbor Home Care", role: "Paid carer or agency", phone: "555-0170", hours: "Office 8 to 8" },
      { id: V.uid(), name: "Riverside Carers Group", role: "Carer support line or group", phone: "555-0188", hours: "Tuesdays at 7 pm, and a phone line on weekdays" });
    v.docs.push({ id: V.uid(), person: rose.id, type: "Power of attorney (health)", title: "Health power of attorney", issuer: "Ms Shah, lawyer", issued: "2024-05-02", location: "Blue folder in the hall drawer; original with Ms Shah", expires: "", leadDays: "60", scan: null },
      { id: V.uid(), person: rose.id, type: "Advance directive or living will", title: "Advance directive", issued: "2024-05-02", location: "Signed copy on the fridge", expires: "", scan: null },
      { id: V.uid(), person: rose.id, type: "Hospital discharge letter", title: "Discharge letter after the fall", issuer: "Riverside General", issued: d(-80), location: "Blue folder", expires: "", scan: null },
      { id: V.uid(), person: walter.id, type: "Health insurance card", title: "Walter's insurance card", issuer: "Acme Health", ref: "7730", location: "His wallet", expires: d(40), leadDays: "60", scan: null });
    v.tasks.push({ id: V.uid(), title: "Order repeat prescriptions", due: d(4), repeat: "1", leadDays: "7", person: "household", notes: "" },
      { id: V.uid(), title: "Book something restful just for me", due: d(2), repeat: "1", leadDays: "3", person: "household", notes: "" });
    v.emergency = { localNumber: "911", firstCall: "Ana (daughter) 555-0142", outName: "Ben (son)", outPhone: "555-0157", hospital: "Riverside General, east entrance",
      directives: "Signed copy on the fridge; original with Ms Shah", equipment: "None powered. Spare walking frame in the garage.", access: "Spare key with Priya at number 12",
      kitLocation: "Bedroom wardrobe, bottom shelf", water: "Under the kitchen sink", power: "Hall cupboard", vaultNote: "The kitchen laptop; passphrase in a sealed envelope with Ben",
      hazards: ["heat", "power"], bag: { medlist: true, meds: true, docs: true, aids: true, chargers: true, clothes: true, toiletries: true }, updated: d(-12) };
    [[-5, 3, 2, "no", ""], [-4, 2, 1, "no", "Up three times in the night with Mum"], [-3, 2, 2, "little", ""], [-2, 3, 3, "no", ""], [-1, 2, 2, "no", "An hour to myself on Saturday"]].forEach(function (c) {
      v.checkins.push({ id: V.uid(), date: d(c[0]), time: "21:30", feel: c[1], sleep: c[2], brk: c[3], note: c[4] });
    });
    return v;
  }
  var api = { build: build };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CareDemo = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
