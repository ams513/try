/* Stark Vital: safety rules (pure, no DOM, no network). LINT-ALLOW refusal-list
   Two jobs. 1) Red flags: fixed rules on the person's own entries that show one fixed, neutral banner. They can never be turned
   off. 2) Refusal: topics the app does not cover. The word lists below are why this file is the only place those words appear. */
(function (root) {
  "use strict";
  var V = root.StarkVital || (typeof require === "function" ? require("./core.js") : null);
  var D = root.VitalData || (typeof require === "function" ? require("./data.js") : null);
  var X = {};

  var BANNER = "This is worth talking about with a doctor or pharmacist soon. If you feel very unwell or think it is an emergency, call your local emergency number.";
  var STRONG = "If you might harm yourself, or you feel unsafe, contact your local emergency number or a crisis line now. You deserve support, and you do not have to carry this alone.";
  var REFUSAL = "Stark Vital does not cover this topic. It is a record of your own habits and results and gives no medical advice. For this, please talk to a doctor or pharmacist.";
  var FOOTER = "Not medical advice. Ask a clinician about your health.";

  // Words that move a note, search or question to the refusal screen. Matched on word boundaries, case-insensitive.
  var REFUSE = [/\bsteroids?\b/i, /\banabolic\b/i, /\bsarms?\b/i, /\bprohormones?\b/i, /\bpeptides?\b/i, /\bhgh\b/i, /\bgrowth hormone\b/i, /\bbpc[- ]?157\b/i, /\banavar\b/i, /\bdianabol\b/i,
    /\btrenbolone\b/i, /\btren\b/i, /\bpost[- ]cycle\b/i, /\bpct\b/i, /\bcycle (stack|cycling)\b/i, /\bstacking\b/i, /\bdos(e|es|age|ing)\b/i, /\bwhere to buy\b/i, /\bsource (it|them)\b/i,
    /\binject(ion|ing|ions)?\b/i, /\bresearch chemicals?\b/i, /\bdetox\b/i, /\btestosterone (replacement|therapy|booster|levels? up)\b/i, /\bdo i have\b/i, /\bdiagnos(e|is|ed)\b/i,
    /\bstop taking\b/i, /\bstart taking\b/i, /\bpurg(e|ing)\b/i, /\bstarv(e|ing) myself\b/i, /\bpro[- ]ana\b/i, /\bhow much should i take\b/i];
  // Custom items (1.1.0): the app tracks no medicines, drugs, supplements, hormones or doses. This is a WORD LIST, not a check that understands
  // anything: it catches common names, forms and dose units, and it cannot catch every spelling, brand or foreign name. Reuses REFUSE above.
  var MEDS = ["ibuprofen", "advil", "nurofen", "paracetamol", "acetaminophen", "tylenol", "panadol", "aspirin", "naproxen", "diclofenac", "metformin", "insulin", "statins?", "atorvastatin", "simvastatin", "rosuvastatin",
    "melatonin", "creatine", "testosterone", "oestrogen", "estrogen", "progesterone", "dhea", "thyroxine", "levothyroxine", "prednisone", "prednisolone", "cortisone", "hydrocortisone", "dexamethasone", "corticosteroids?",
    "amoxicillin", "antibiotics?", "omeprazole", "lisinopril", "amlodipine", "sertraline", "fluoxetine", "prozac", "citalopram", "escitalopram", "ssris?", "antidepressants?", "antihistamines?", "benadryl", "cetirizine", "loratadine",
    "xanax", "alprazolam", "diazepam", "valium", "lorazepam", "clonazepam", "zolpidem", "ambien", "adderall", "ritalin", "methylphenidate", "modafinil", "armodafinil", "ketamine", "lsd", "mdma", "psilocybin", "cbd", "thc",
    "opioids?", "codeine", "morphine", "tramadol", "oxycodone", "gabapentin", "warfarin", "finasteride", "minoxidil", "clomiphene", "tamoxifen", "anastrozole", "hcg", "semaglutide", "ozempic", "tirzepatide", "ashwagandha",
    "magnesium", "zinc", "omega[- ]?3", "fish oil", "probiotics?", "collagen", "nootropics?", "pre[- ]?workout", "vitamins?", "supplements?", "minerals?", "hormones?", "medic(ation|ations|ine|ines)", "drugs?", "prescriptions?",
    "pills?", "tablets?", "capsules?", "tabs", "inhalers?", "patch(es)?", "suppositor(y|ies)", "antibiotic", "anti[- ]?inflammator(y|ies)", "nsaids?", "laxatives?", "sleeping (pills?|aids?)"];
  var MEDRE = new RegExp("\\b(" + MEDS.join("|") + ")\\b", "i");
  var UNITRE = new RegExp("(^|[^a-z])(mg|mcg|ug|iu|ml|cc|mmol|units?|drops?|puffs?|sprays?|doses?|dosage|tabs?|tablets?|caps?|capsules?|pills?|[\u00b5\u03bc]g)($|[^a-z])", "i");
  var DOSENUM = new RegExp("\\d\\s*(mg|mcg|ug|iu|ml|cc|g|units?|[\u00b5\u03bc]g)\\b", "i");
  var LONGMEDS = MEDS.filter(function (m) { return /^[a-z]{8,}$/.test(m); });
  var ITEM_WHY = "Stark Vital does not track medicines, supplements, hormones, steroids, peptides or doses, so it cannot keep this item. Please ask a pharmacist or doctor. (This check is a word list and cannot catch everything, so please keep medicines out of custom items.)";
  function squash(t) { return String(t == null ? "" : t).normalize ? String(t == null ? "" : t).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") : ""; }
  function medicineLike(text) {
    var t = String(text == null ? "" : text), plain = t.normalize ? t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "") : t, sq = squash(t), i;
    if (refused(plain) || MEDRE.test(plain) || DOSENUM.test(plain)) return true;
    for (i = 0; i < LONGMEDS.length; i++) if (sq.indexOf(LONGMEDS[i]) !== -1) return true;   // "ibu profen", "i-b-u-p-r-o-f-e-n"
    return false;
  }
  // Checks the name (and the unit of a number item). Returns null when fine, else one plain line saying why.
  function checkItem(name, unit) {
    if (medicineLike(name) || (unit && (medicineLike(unit) || UNITRE.test(String(unit))))) return ITEM_WHY;
    return null;
  }
  var ITEM_INTRO = "Stark Vital does not track medicines, supplements, hormones, steroids, peptides or doses, and it refuses a name or unit that looks like one. That check is a word list and cannot catch everything. For anything like that, ask a pharmacist or doctor.";
  var KIND_OK = ["rating", "habit", "number"];
  function nameKey(t) { return String(t == null ? "" : t).normalize ? String(t).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() : String(t).toLowerCase().trim(); }
  // The one gate for adding or renaming a custom item. d: the notebook (for duplicates and the item limit), selfId: the item being renamed.
  // Returns null when fine, else one plain line. Name is judged as typed (after trimming), never silently cut.
  function validateItem(d, name, kind, unit, selfId) {
    var n = String(name == null ? "" : name).replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim(), u = String(unit == null ? "" : unit).replace(/\s+/g, " ").trim(), items = D.customItems(d, true), why;
    if (!n) return "Give the item a name.";
    if (n.length > D.NAME_MAX) return "Use " + D.NAME_MAX + " characters or fewer for the name.";
    if (KIND_OK.indexOf(kind) === -1) return "Choose a rating, a yes/no habit or a number.";
    if (kind === "number" && u.length > D.UNIT_MAX) return "Use " + D.UNIT_MAX + " characters or fewer for the unit.";
    why = checkItem(n, kind === "number" ? u : ""); if (why) return why;
    if (items.some(function (i) { return i.id !== selfId && nameKey(i.name) === nameKey(n); })) return "You already have an item with that name (it may be archived).";
    if (!selfId && items.length >= D.CUSTOM_MAX) return "You can keep up to " + D.CUSTOM_MAX + " items. Archive or delete one first.";
    return null;
  }
  // Wording that may point to self-harm (shows the stronger banner) and eating-disorder signals (shows the clinician banner).
  var HARM = [/\bsuicid/i, /\bkill myself\b/i, /\bend (it all|my life)\b/i, /\bself[- ]harm\b/i, /\bharm myself\b/i, /\bhurt myself\b/i, /\bdon'?t want to (live|be here)\b/i, /\bbetter off (dead|without me)\b/i, /\bwant to die\b/i];
  var EATING = [/\bpurg(e|ing)\b/i, /\bstarv(e|ing) myself\b/i, /\bpro[- ]ana\b/i, /\bmake myself (sick|throw up)\b/i, /\bthrow(ing)? up (my )?(food|meals?)\b/i];

  function refused(text) { var t = String(text == null ? "" : text), i; for (i = 0; i < REFUSE.length; i++) if (REFUSE[i].test(t)) return true; return false; }
  function matches(list, text) { var t = String(text == null ? "" : text), i; for (i = 0; i < list.length; i++) if (list[i].test(t)) return true; return false; }

  // asOf: today (YYYY-MM-DD). Returns { active, strong, reasons: [{id, text}] }. The same data gives the same answer; nothing is remembered.
  function redFlags(d, asOf) {
    var reasons = [], strong = false, i, run, dt, r, recent = [], notes = false, ed = false, lastLogged = null, dates = D.dates(d), j, low, mood, sym;
    function add(id, text, isStrong) { reasons.push({ id: id, text: text }); if (isStrong) strong = true; }
    for (i = dates.length - 1; i >= 0; i--) if (dates[i] <= asOf) { lastLogged = dates[i]; break; }
    // mood 1 of 5, five calendar days in a row, ending on the latest logged day (which must be today or yesterday)
    if (lastLogged && V.daysBetween(lastLogged, asOf) <= 1) {
      run = 0; for (i = 0; i < 5; i++) { r = d.days[V.addDays(lastLogged, -i)]; if (r && r.mood === 1) run++; else break; }
      if (run >= 5) add("mood", "Your notes show a mood of 1 out of 5 for five days in a row.", true);
      // sleep under 4 hours, three nights in a row
      run = 0; for (i = 0; i < 3; i++) { r = d.days[V.addDays(lastLogged, -i)]; if (r && typeof r.durMin === "number" && r.durMin < 240) run++; else break; }
      if (run >= 3) add("sleep", "Your notes show under 4 hours of sleep three nights in a row.", false);
    }
    // anything worrying ticked, or worrying words in a note, in the last 3 days
    for (i = 0; i < 3; i++) {
      r = d.days[V.addDays(asOf, -i)]; if (!r) continue;
      if (r.flags && r.flags.length) { sym = true; if (r.flags.indexOf("selfharm") !== -1) strong = true; }
      if (r.note) { if (matches(HARM, r.note)) { strong = true; notes = true; } if (matches(EATING, r.note)) ed = true; }
    }
    if (sym) add("symptom", "You noted something worrying in the last three days.", false);
    if (notes) add("words", "A recent note has wording that may mean you are struggling.", true);
    if (ed) add("eating", "A recent note has wording about eating that may be worth talking about.", false);
    // lab results taken in the last 14 days: outside the report's own range by more than half its width, or ticked by the person
    d.labs.forEach(function (l) {
      var w, lo = l.refLow, hi = l.refHigh, far = false;
      if (!l.takenOn || V.daysBetween(l.takenOn, asOf) === null || V.daysBetween(l.takenOn, asOf) > 14 || V.daysBetween(l.takenOn, asOf) < 0) return;
      if (lo != null && hi != null && hi > lo) { w = hi - lo; far = l.value < lo - 0.5 * w || l.value > hi + 0.5 * w; }
      if (far || l.urgent || (l.abnormal && lo == null && hi == null)) add("lab:" + l.id, "A recent lab result (" + l.analyte + ") may need a doctor's attention.", false);
    });
    return { active: reasons.length > 0, strong: strong, reasons: reasons, text: BANNER, strongText: STRONG };
  }

  X.BANNER = BANNER; X.STRONG = STRONG; X.REFUSAL = REFUSAL; X.FOOTER = FOOTER; X.refused = refused; X.medicineLike = medicineLike; X.checkItem = checkItem; X.validateItem = validateItem; X.ITEM_WHY = ITEM_WHY; X.ITEM_INTRO = ITEM_INTRO; X.redFlags = redFlags; X.harmWords = function (t) { return matches(HARM, t); };
  if (typeof module !== "undefined" && module.exports) module.exports = X;
  root.VitalSafety = X;
})(typeof globalThis !== "undefined" ? globalThis : this);
