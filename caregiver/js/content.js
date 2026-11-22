/* Stark Caregiver: static lists and wording. No network, no data leaves the page.
   Record keeping only: nothing here gives dosing advice, checks medicines against each other, or suggests a diagnosis. */
(function (root) {
  "use strict";
  var DISCLAIMER = "Not medical advice. Ask your doctor or pharmacist.";
  var DOC_TYPES = ["Power of attorney (health)", "Power of attorney (money)", "Advance directive or living will", "Do-not-resuscitate or treatment-limits form",
    "Health insurance card", "Benefits or support letter", "Hospital discharge letter", "Care plan", "Test or scan results", "Passport or ID", "Prescription copy",
    "Equipment or loan agreement", "Other"];
  var CONTACT_ROLES = ["Emergency contact", "Family or friend", "Family doctor", "Specialist", "Nurse or care team", "Pharmacy", "Paid carer or agency", "Social worker or case manager",
    "Respite or day service", "Carer support line or group", "Equipment supplier", "Neighbour", "Clergy or community", "Other"];
  var BLOOD = ["", "Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  var MED_LEAD = [{ v: "3", l: "3 days" }, { v: "7", l: "1 week" }, { v: "14", l: "2 weeks" }, { v: "30", l: "1 month" }];

  // The diary: what a carer notices. Words a family uses, not clinical categories.
  var SYMPTOMS = ["Pain", "Breathless", "Confused or muddled", "Dizzy or unsteady", "Fall or near fall", "Not eating or drinking much", "Poor sleep", "Low mood or tearful",
    "Agitated or restless", "Bowel or bladder change", "Feeling sick or vomiting", "Swelling", "High temperature", "Skin, sore or pressure area", "Cough", "Other"];
  var SEVERITY = [{ v: "1", l: "1 Barely noticeable" }, { v: "2", l: "2 Mild" }, { v: "3", l: "3 Moderate" }, { v: "4", l: "4 Bad" }, { v: "5", l: "5 Very bad" }];
  var APPT_KINDS = ["Family doctor", "Specialist", "Hospital", "Nurse visit", "Therapy", "Dentist", "Eyes or hearing", "Tests or scans", "Social care", "Other"];

  // Carer check-in: three gentle questions. Answers stay private: never shared, printed or searched.
  var FEEL = [{ v: 1, l: "Running on empty" }, { v: 2, l: "Struggling" }, { v: 3, l: "Getting by" }, { v: 4, l: "Doing OK" }, { v: 5, l: "Good today" }];
  var SLEEP = [{ v: 1, l: "Hardly slept" }, { v: 2, l: "Broken sleep" }, { v: 3, l: "OK" }, { v: 4, l: "Slept well" }];
  var BREAK = [{ v: "yes", l: "Yes" }, { v: "little", l: "A little" }, { v: "no", l: "Not really" }];
  // Kind words, chosen by how the carer says they are. They acknowledge; they never assess.
  var KIND = {
    low: "Thank you for being honest. Caring like this is heavy, and feeling worn out is not a failing. Today, aim for the minimum and one small thing for you. If you can, ask one person for one specific bit of help.",
    mid: "You are getting through it, and that takes more than people see. A short break you plan for counts. Is there one thing on today's list someone else could do?",
    good: "Glad today feels a bit lighter. Days like this are a good time to line up help for the harder ones: check the rota for gaps."
  };
  var RESPITE = [
    { t: "Ask for one specific thing", d: "\"Could you sit with Dad on Thursday from 2 to 5?\" is easier to say yes to than \"let me know if you need anything\". The care rota shows the gaps." },
    { t: "Take a small break every day", d: "Ten minutes outside, a hot drink sitting down, a call with a friend. Plan it like any other care task." },
    { t: "Find out what respite exists near you", d: "Day centres, sitting services and short stays give carers a real rest. Your local council or social services, a carers' organisation, or the Eldercare Locator in the US (1-800-677-1116) can tell you what is available." },
    { t: "Ask about a carer's assessment or support", d: "In many places carers can ask for their own needs to be looked at, separately from the person they care for. Ask your social worker, local council or carers' centre." },
    { t: "Keep your own health appointments", d: "Your health matters too. Tell your own doctor that you are a carer; it can change the help they offer you." },
    { t: "Talk to people who understand", d: "A carers' support group, online or in person, can help with both feelings and practical tips." },
    { t: "Let some things go", d: "The house does not need to be perfect. Choose what really matters this week and give yourself permission to skip the rest." }
  ];
  // Crisis lines, shown as information only, each only to people who chose one of its countries (codes). Checked in November 2026; numbers can change, so confirm them where you live.
  // The emergency number itself comes from js/emergency.js for the country the person chose.
  var CRISIS = [
    { where: "United States", what: "988 Suicide and Crisis Lifeline: call or text 988", emergency: "911", codes: ["US"] },
    { where: "Canada", what: "9-8-8 Suicide Crisis Helpline: call or text 988", emergency: "911", codes: ["CA"] },
    { where: "United Kingdom and Ireland", what: "Samaritans: call 116 123, free, day or night", emergency: "999 or 112", codes: ["GB", "IE", "GG", "JE", "IM"] },
    { where: "Australia", what: "Lifeline: call 13 11 14", emergency: "000", codes: ["AU"] },
    { where: "New Zealand", what: "Need to talk? Call or text 1737", emergency: "111", codes: ["NZ"] }
  ];

  var HAZARDS = [{ id: "heat", l: "Extreme heat" }, { id: "winter", l: "Winter storm or extreme cold" }, { id: "power", l: "Long power cut" }, { id: "fire", l: "Fire or wildfire smoke" },
    { id: "flood", l: "Flood" }, { id: "storm", l: "Severe storm, hurricane or typhoon" }, { id: "quake", l: "Earthquake" }, { id: "illness", l: "Outbreak of illness" }];
  var EMERGENCY = [
    { k: "localNumber", label: "Local emergency number", ph: "Your country's emergency number", max: 40 },
    { k: "firstCall", label: "Who to call first after emergency services", ph: "Ana (daughter) 555-0142", wide: true },
    { k: "outName", label: "Family member to keep informed", ph: "A relative who passes news on to everyone else" },
    { k: "outPhone", label: "Their phone", type: "tel", max: 40 },
    { k: "hospital", label: "Usual hospital", ph: "Riverside General, east entrance", wide: true },
    { k: "directives", label: "Where any advance directive or treatment-limits form is kept", ph: "Signed copy on the fridge; original with the lawyer", wide: true },
    { k: "equipment", label: "Powered equipment and the back-up plan", type: "textarea", wide: true, ph: "Oxygen concentrator: spare cylinders in the hall; supplier's 24-hour line" },
    { k: "access", label: "How helpers or responders get in", ph: "Spare key with the neighbour at number 12 (keep any key-safe code off printouts)", wide: true },
    { k: "kitLocation", label: "Where the hospital bag is", ph: "Bedroom wardrobe, bottom shelf" },
    { k: "water", label: "Water shut-off", ph: "Under the kitchen sink" }, { k: "power", label: "Electrical panel or fuse box", ph: "Hall cupboard" },
    { k: "pets", label: "Pets plan", type: "textarea", wide: true, ph: "Who feeds the cat if we are at the hospital overnight" },
    { k: "vaultNote", label: "Where this care record and its passphrase can be found", wide: true, ph: "The kitchen laptop; passphrase in a sealed envelope with Ana. Never write the passphrase here." },
    { k: "notes", label: "Other notes", type: "textarea", wide: true }
  ];

  var TASK_SUGGESTIONS = [
    { title: "Order repeat prescriptions", repeat: "1" }, { title: "Check the hospital bag and update the medicine list in it", repeat: "3" },
    { title: "Review the care rota for the next month", repeat: "1" }, { title: "Test smoke and carbon monoxide alarms", repeat: "6" },
    { title: "Save a fresh backup file of the care record", repeat: "1" }, { title: "Book something restful just for me", repeat: "1" }
  ];
  var REPEAT = [{ v: "", l: "Does not repeat" }, { v: "1", l: "Every month" }, { v: "3", l: "Every 3 months" }, { v: "6", l: "Every 6 months" }, { v: "12", l: "Every year" }];
  var ROTA_STARTERS = [{ role: "Morning visit", start: "08:00", end: "10:00" }, { role: "Lunch and afternoon", start: "12:00", end: "15:00" },
    { role: "Evening visit", start: "17:30", end: "20:00" }, { role: "Overnight", start: "22:00", end: "07:00" }];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var api = { DISCLAIMER: DISCLAIMER, DOC_TYPES: DOC_TYPES, CONTACT_ROLES: CONTACT_ROLES, BLOOD: BLOOD, MED_LEAD: MED_LEAD, SYMPTOMS: SYMPTOMS, SEVERITY: SEVERITY, APPT_KINDS: APPT_KINDS,
    FEEL: FEEL, SLEEP: SLEEP, BREAK: BREAK, KIND: KIND, RESPITE: RESPITE, CRISIS: CRISIS, HAZARDS: HAZARDS, EMERGENCY: EMERGENCY, TASK_SUGGESTIONS: TASK_SUGGESTIONS, REPEAT: REPEAT,
    ROTA_STARTERS: ROTA_STARTERS, WEEKDAYS: WEEKDAYS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CareContent = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
