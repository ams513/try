/* Stark Vital: the lever library. Ten everyday habits, each with its public source and the date a person last checked it.
   Data, not advice: every entry ends with the same footer on screen. Only entries marked "verified" or "partly" are ever shown;
   an entry without a source never reaches the screen (the build lint checks this). Public research is about groups of people.
   Sources were opened and checked against the sentences shown (see SOURCES_CHECK.md). */
(function (root) {
  "use strict";
  var L = {};
  var CHECKED = "2026-11-22";
  var FOOTER = "Public research is about groups of people. Your own results may differ. Not medical advice.";
  var LEVERS = [
    { id: "L1", name: "Regular sleep of 7 hours or more", status: "verified", grade: "strong", effort: 3,
      try: "For two weeks, plan to be in bed long enough for 7 or more hours of sleep, at times that suit your life.",
      outcomes: ["energy", "mood", "focus", "stress"], defaultOutcome: "energy", exposure: "dur",
      summary: "An expert panel of the American Academy of Sleep Medicine and the Sleep Research Society recommended that adults (aged 18 to 60) sleep 7 or more hours a night on a regular basis. It noted that regularly sleeping under 7 hours is associated with a range of adverse health outcomes. For most people it was uncertain whether sleeping more than 9 hours is linked with health risk.",
      source: "Watson NF et al., J Clin Sleep Med 2015;11(6):591-592 (AASM and SRS joint consensus statement)", url: "https://pubmed.ncbi.nlm.nih.gov/25979105/", checked: CHECKED,
      caution: "If you often cannot sleep when you try, or you feel unwell, talk to a doctor.", requires: "" },
    { id: "L2", name: "Move more: a weekly amount of moderate activity", status: "verified", grade: "strong", effort: 2,
      try: "For two weeks, add a little extra easy activity, such as a walk, on most days.",
      outcomes: ["energy", "mood", "dur", "stress"], defaultOutcome: "energy", exposure: "trainLevel",
      summary: "The WHO 2020 guidelines for adults aged 18 to 64 recommend 150 to 300 minutes a week of moderate aerobic activity (or 75 to 150 of vigorous activity) and limiting time spent sitting. They say that replacing sitting with activity of any intensity brings health benefits.",
      source: "Bull FC et al., Br J Sports Med 2020;54:1451 (WHO guidelines)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/", checked: CHECKED,
      caution: "Keep the increase gentle. If you have a heart or joint concern, ask a clinician before changing activity.", requires: "load" },
    { id: "L3", name: "Muscle-strengthening on 2 or more days a week", status: "verified", grade: "strong", effort: 3,
      try: "For two weeks, do a short strength session (body weight is fine) on 2 days a week.",
      outcomes: ["energy", "mood", "dur", "stress"], defaultOutcome: "mood", exposure: "strength",
      summary: "The WHO 2020 guidelines for adults aged 18 to 64 recommend muscle-strengthening activities at moderate or greater intensity that involve all major muscle groups on 2 or more days a week, in addition to aerobic activity.",
      source: "Bull FC et al., Br J Sports Med 2020;54:1451 (WHO guidelines)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/", checked: CHECKED,
      caution: "Start light and learn the movements. If you have an injury or a health concern, ask a clinician first.", requires: "load" },
    { id: "L4", name: "More steps on most days", status: "verified", grade: "limited", effort: 2,
      try: "For two weeks, aim for a step count a little above your usual on most days.",
      outcomes: ["energy", "mood", "dur", "stress"], defaultOutcome: "energy", exposure: "steps",
      summary: "A meta-analysis of 15 groups of adults (47,471 people, followed for a median of 7 years) found that more daily steps went with a lower risk of dying. The risk kept falling up to roughly 6,000 to 8,000 steps a day in people aged 60 and over, and roughly 8,000 to 10,000 in younger adults. This is observational: it shows an association only, not that steps caused the difference.",
      source: "Paluch AE et al., Lancet Public Health 2022;7:e219-e228", url: "https://pubmed.ncbi.nlm.nih.gov/35247352/", checked: CHECKED,
      caution: "Pick a step count you can reach comfortably. If you have a health concern, ask a clinician before changing activity.", requires: "load" },
    { id: "L5", name: "Morning daylight", status: "verified", grade: "limited", effort: 1,
      try: "For two weeks, spend some time outside in the morning, soon after waking.",
      outcomes: ["energy", "mood", "dur", "rested"], defaultOutcome: "energy", exposure: "morningLight",
      summary: "A systematic review of 45 studies in healthy adults found that brighter light in the morning was consistent with an earlier sleep period and with self-reported sleep improvements. Brighter light in the evening went with a later sleep period and worse self-reported sleep. Most of the studies (32 of 45) manipulated light experimentally, so they do not show what ordinary time outdoors does.",
      source: "Dautovich ND et al., Sleep Health 2019;5(1):31-48 (systematic review of light amount and timing and sleep in community-dwelling adults)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6814154/", checked: CHECKED,
      caution: "Never look at the sun directly.", requires: "" },
    { id: "L6", name: "A caffeine cut-off time", status: "verified", grade: "moderate", effort: 1,
      try: "For two weeks, pick a caffeine cut-off time earlier than your usual and keep to it, then compare your sleep.",
      outcomes: ["dur", "rested"], defaultOutcome: "dur", exposure: "caffeineLate",
      summary: "A systematic review and meta-analysis of 24 studies found that, on average, sleep after caffeine had about 45 minutes less total sleep time and about 7% lower sleep efficiency, and took about 9 minutes longer to start. From a model of the timing data, the authors estimated that coffee drunk less than about 8.8 hours before bed was linked with reduced sleep time. Individual responses to caffeine differ.",
      source: "Gardiner C et al., Sleep Med Rev 2023;69:101764", url: "https://pubmed.ncbi.nlm.nih.gov/36870101/", checked: CHECKED,
      caution: "If you drink a lot of caffeine every day, cut back gradually.", requires: "" },
    { id: "L7", name: "Less alcohol, especially close to bedtime", status: "verified", grade: "moderate", effort: 2,
      try: "For two weeks, skip alcohol in the evening, then compare your sleep.",
      outcomes: ["dur", "rested", "mood", "energy"], defaultOutcome: "rested", exposure: "alcohol",
      summary: "A systematic review and meta-analysis of 27 studies in healthy adults found that alcohol before sleep delayed the start of REM sleep and reduced REM sleep, and that its effect on total sleep time was uncertain. A separate meta-analysis of 11 cohort studies found no evidence that drinking reduced sleep problems and some evidence that general drinking might increase them, but said further study is needed.",
      source: "Gardiner C et al., Sleep Med Rev 2025;80:102030; Hu N et al., Drug Alcohol Depend 2020;217:108259", url: "https://pubmed.ncbi.nlm.nih.gov/39631226/", checked: CHECKED,
      caution: "This app never suggests starting to drink. If cutting back is hard, talk to a doctor.", requires: "" },
    { id: "L8", name: "Slow, paced breathing", status: "verified", grade: "moderate", effort: 1,
      try: "For two weeks, set aside a few minutes a day to breathe slowly and evenly.",
      outcomes: ["stress", "mood", "rested"], defaultOutcome: "stress", exposure: "breathMin",
      summary: "A meta-analysis and systematic review of 31 studies (1,133 people without a clinical condition) found immediate changes in blood pressure, heart rate and heart-rate variability after slow-paced breathing. The effect on negative emotion, particularly perceived stress, was marginal and not clearly different from no effect. Evidence on longer-term effects was limited.",
      source: "Shao R, Man ISC, Lee TMC, Mindfulness 2024;15(1):1-18, doi 10.1007/s12671-023-02294-2", url: "https://doi.org/10.1007/s12671-023-02294-2", checked: CHECKED,
      caution: "Stop if you feel dizzy. If you have a heart or breathing condition, ask a clinician first.", requires: "" },
    { id: "L9", name: "Time with people", status: "verified", grade: "limited", effort: 2,
      try: "For two weeks, plan a regular chance to spend time with someone you like, in person or by call.",
      outcomes: ["mood", "energy", "stress"], defaultOutcome: "mood", exposure: "social",
      summary: "A meta-analysis of 148 studies (308,849 people) found that stronger social relationships went with higher odds of survival over the follow-up periods. The link was strongest for broad measures of social integration and weakest for whether people lived alone or with others. This is observational: it shows an association only.",
      source: "Holt-Lunstad J, Smith TB, Layton JB, PLoS Med 2010;7(7):e1000316", url: "https://doi.org/10.1371/journal.pmed.1000316", checked: CHECKED,
      caution: "Choose company you enjoy. This is an association, not a prescription.", requires: "" },
    { id: "L10", name: "Regular bedtime and wake time", status: "unverified", grade: "", effort: 2, try: "", outcomes: [], defaultOutcome: "rested", exposure: "bedIrreg", summary: "", source: "", url: "", checked: "", caution: "", requires: "" }
  ];
  var PRIOR = { strong: 1, moderate: 0.6, limited: 0.3 };
  function visible() { return LEVERS.filter(function (l) { return l.status === "verified" || l.status === "partly"; }); }
  function get(id) { return LEVERS.filter(function (l) { return l.id === id; })[0]; }
  function sourced(l) { return !!(l.source && (l.url || /doi/i.test(l.source)) && /^\d{4}-\d{2}-\d{2}$/.test(l.checked)); }
  L.LEVERS = LEVERS; L.FOOTER = FOOTER; L.PRIOR = PRIOR; L.CHECKED = CHECKED; L.visible = visible; L.get = get; L.sourced = sourced;
  if (typeof module !== "undefined" && module.exports) module.exports = L;
  root.VitalLevers = L;
})(typeof globalThis !== "undefined" ? globalThis : this);
