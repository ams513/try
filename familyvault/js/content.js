/* Stark Family Vault: static lists (document types, planning checklist, letter prompts). No network, no data leaves the page. */
(function (root) {
  "use strict";
  var DOC_TYPES = ["Passport", "Driver licence or ID card", "National ID or tax number card", "Birth certificate", "Marriage or divorce certificate",
    "Health insurance", "Home or renters insurance", "Auto insurance", "Life insurance", "Other insurance", "Property deed", "Vehicle title",
    "Mortgage or loan papers", "Will", "Power of attorney", "Residence or work permit", "School or training record", "Other"];
  var ACCOUNT_KINDS = ["Checking", "Savings", "Credit card", "Mortgage or loan", "Retirement", "Investment", "Insurance policy", "Pension", "Crypto wallet", "Other"];
  var CONTACT_ROLES = ["Emergency contact", "Doctor", "Attorney", "Accountant or tax adviser", "Insurance agent", "Financial adviser", "Employer", "Neighbour", "Clergy or community", "Other"];
  var BLOOD = ["", "Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  var ROOMS = ["Living room", "Kitchen", "Dining room", "Bedroom", "Bathroom", "Office", "Garage", "Basement or attic", "Garden or shed", "Jewellery and valuables", "Other"];

  // General information only. Rules differ by country, state and family; an attorney or notary should confirm each item.
  var CHECKLIST = [
    { id: "will", title: "A current will", why: "Says who receives what and who looks after minor children. Without one, local law decides. Update after marriage, divorce, births or a big change in assets." },
    { id: "poa-fin", title: "Financial power of attorney", why: "Names someone to pay bills and manage money if you cannot. Many places have a 'durable' version that survives incapacity." },
    { id: "poa-health", title: "Health care proxy and living will", why: "Names who speaks for you on medical decisions and records your wishes about life support. Often called an advance directive." },
    { id: "guardian", title: "Guardian named for minor children", why: "Usually set in the will. Ask the person first, and name a backup." },
    { id: "beneficiaries", title: "Beneficiaries checked on every account", why: "Retirement accounts, life insurance and many bank accounts pass to the named beneficiary, not the will. Check they are current." },
    { id: "insurance", title: "Insurance reviewed this year", why: "Life, health, home, auto and disability. Confirm cover amounts still match your life." },
    { id: "executor", title: "Executor or trusted person knows where things are", why: "Tell them this vault exists, where the passphrase is kept (for example with a lawyer or in a safe) and how to open a share file." },
    { id: "accounts", title: "List of accounts and institutions", why: "Use the Money section: institution and last 4 digits only, so someone knows whom to call." },
    { id: "digital", title: "Digital accounts and devices plan", why: "A password manager with an emergency-access contact is safer than writing passwords down. Never store passwords in this vault's notes." },
    { id: "funeral", title: "Funeral or memorial wishes written down", why: "Burial or cremation, religion, music, who to notify. Saves the family guessing at a hard time." },
    { id: "documents", title: "Originals stored safely and scans in this vault", why: "Wills and deeds often need the original. Record where each original is kept in the Documents section." },
    { id: "trust", title: "Asked an attorney whether a trust or other planning fits", why: "Trusts, property held jointly, taxes and cross-border assets can change what is best. This is the one to ask a professional." },
    { id: "review", title: "Whole plan reviewed once a year", why: "Pick a date, for example your birthday, and walk through this list." }
  ];

  var LETTER = [
    { k: "to", label: "Who this letter is for", ph: "For my spouse, and my sister if I am not here" },
    { k: "docs", label: "Where my important papers are", ph: "Originals in the grey fireproof box in the bedroom closet. Scans are in this vault. The attorney who holds my will is ..." },
    { k: "first", label: "Who to call first", ph: "My lawyer, my employer's HR contact, my financial adviser (see Contacts)" },
    { k: "money", label: "Money and bills", ph: "Which bank pays the mortgage, which bills are automatic, where the tax returns are kept" },
    { k: "home", label: "Home, car and belongings", ph: "Spare keys, alarm company, vehicle papers, anything that needs care straight away" },
    { k: "pets", label: "Pets and dependants", ph: "Feeding schedule, the vet, who agreed to take them" },
    { k: "digital", label: "Phones, email and online accounts", ph: "My password manager is ... and my emergency-access contact is ... (never write passwords here)" },
    { k: "wishes", label: "My wishes", ph: "Funeral or memorial preferences, organ donation, what to do with keepsakes" },
    { k: "words", label: "What I want you to know", ph: "Personal words for the people I love" }
  ];

  // Organisation help, not legal advice. Each group adds questions to take to a qualified local professional; none of it states what the law is.
  var JURISDICTIONS = [
    { id: "common", label: "Common-law system", ex: "for example England and Wales, Ireland, Australia, New Zealand, most of Canada and most US states", items: [
      { id: "j-witness", title: "Asked how a will must be signed and witnessed here", why: "Signing and witness rules differ from place to place, and a will that misses one can fail. Ask a local lawyer or notary before you sign." },
      { id: "j-probate", title: "Asked whether the estate will need probate and how to keep it simple", why: "Probate is the court process that confirms a will. Ask what it involves where you live and which assets would pass outside it." },
      { id: "j-lifechange", title: "Checked whether marriage, divorce or a new partner changes the will", why: "In some places a marriage or divorce changes or cancels parts of an existing will. Ask whether that applies to you." } ] },
    { id: "community", label: "Marital or community property rules", ex: "for example US community-property states and countries with a default marital property regime", items: [
      { id: "j-marital", title: "Asked how property bought during the marriage is treated", why: "Some systems treat property from the marriage as shared, which affects what each spouse can leave. Ask which rules apply to you." },
      { id: "j-separate", title: "Records kept of what each spouse owned before marriage or inherited", why: "Keep the papers that show where an asset came from. Record where the originals are in Documents." } ] },
    { id: "civil", label: "Civil-law system", ex: "for example much of continental Europe, Latin America, Quebec and Japan", items: [
      { id: "j-notary", title: "Asked a notary whether a notarial will is usual and what it needs", why: "In many civil-law countries a notary drafts or records wills. Ask which form is common and safest where you live." },
      { id: "j-reserved", title: "Asked whether reserved shares for children or a spouse apply", why: "Some systems reserve part of an estate for close family (sometimes called forced heirship), which limits what you can leave freely." },
      { id: "j-register", title: "Checked whether there is a wills register and used it", why: "Some countries keep a central register so a will can be found. Ask whether one exists where you live." } ] },
    { id: "religious", label: "Religious or customary inheritance rules", ex: "where faith-based or customary law applies to families, alone or next to civil law", items: [
      { id: "j-faith", title: "Asked how religious or customary rules apply to this family", why: "Where both apply, ask a qualified adviser from your tradition and a lawyer how they work together, so your wishes are followed." } ] },
    { id: "cross", label: "Cross-border family or assets abroad", ex: "you live, own property, hold accounts or have citizenship in more than one country", items: [
      { id: "j-countries", title: "Listed every country with property, accounts, citizenship or residence", why: "Each country may have its own rules. A simple list saves your family weeks of searching." },
      { id: "j-law", title: "Asked which country's law will govern the estate", why: "Some places let you choose the law that applies to your estate, others decide by residence or where property is. Ask before you write or change a will." },
      { id: "j-wills", title: "Asked whether one will or one per country is better", why: "A will made in one country may not work smoothly in another. A lawyer who handles cross-border estates can advise." },
      { id: "j-translations", title: "Noted where translations of key papers are kept", why: "Officials abroad may ask for certified translations. Record where they are in Documents." } ] },
    { id: "business", label: "Business owner or farm", ex: "you own all or part of a business, practice or farm", items: [
      { id: "j-succession", title: "Business succession plan written down", why: "Who runs, sells or closes the business, and who can sign for it if you cannot." },
      { id: "j-partners", title: "Partner or shareholder agreements reviewed", why: "Check what happens to your share if you die or cannot work. Ask your adviser whether insurance should fund it." } ] },
    { id: "dependant", label: "Dependant with extra needs", ex: "a child or adult in your care who will need support for life", items: [
      { id: "j-eligibility", title: "Asked how an inheritance could affect support or benefits", why: "Leaving money directly can affect some support programmes. Ask a specialist which arrangements protect the person you care for." },
      { id: "j-intent", title: "Letter of intent written for their carers", why: "Daily routines, doctors, medicines, likes and fears. The letter builder in Planning is a good place to start." } ] }
  ];

  var ROLES = [
    { k: "executor", label: "Executor or personal representative" }, { k: "executor2", label: "Backup executor" },
    { k: "guardian", label: "Guardian for minor children" }, { k: "guardian2", label: "Backup guardian" },
    { k: "poaFin", label: "Financial power of attorney" }, { k: "poaHealth", label: "Health care proxy or agent" },
    { k: "digital", label: "Digital executor or legacy contact" }, { k: "lawyer", label: "Lawyer or notary who holds the papers" }
  ];
  var WISHES = [
    { k: "disposition", label: "Burial, cremation or other", ph: "Cremation, ashes scattered at the lake" },
    { k: "service", label: "Service or gathering", ph: "Small family service, then an open gathering" },
    { k: "place", label: "Place, faith or tradition", ph: "A church, temple, mosque or a non-religious ceremony" },
    { k: "music", label: "Music, readings and speakers", ph: "" },
    { k: "donor", label: "Organ and body donation wishes", ph: "Registered donor, see Health" },
    { k: "notify", label: "People and groups to tell", ph: "Old school friends, the running club" },
    { k: "obituary", label: "Notes for an obituary or notice", ph: "" },
    { k: "keepsakes", label: "Keepsakes and who should have them", ph: "Grandmother's ring to Sam" },
    { k: "prepaid", label: "Prepaid plans or arrangements", ph: "Funeral plan with the local provider, papers in the fireproof box" }
  ];

  var POLICY_TYPES = ["Health", "Life", "Home or buildings", "Renters or contents", "Auto or vehicle", "Disability or income protection", "Long-term care",
    "Travel", "Pet", "Liability or umbrella", "Critical illness", "Funeral plan", "Business", "Other"];
  // Common types to review. Not every family needs every one; the app only points out what is not listed.
  var POLICY_REVIEW = ["Health", "Life", "Home or buildings", "Renters or contents", "Auto or vehicle", "Disability or income protection"];

  var MED_LEAD = [{ v: "3", l: "3 days" }, { v: "7", l: "1 week" }, { v: "14", l: "2 weeks" }, { v: "30", l: "1 month" }];

  var DIGITAL_KINDS = ["Email", "Phone or tablet", "Computer", "Password manager", "Social media", "Photos and cloud storage", "Banking or payments app",
    "Shopping or subscriptions", "Work or business", "Website or domain", "Crypto exchange or wallet", "Games or media", "Home device or router", "Other"];
  var DIGITAL_ACTIONS = ["Not decided", "Memorialise", "Close or delete", "Download, then close", "Hand over to someone", "Keep running for a while"];
  var LEGACY = ["Not checked", "Legacy contact set up", "Service has no legacy option", "Not needed"];

  var DIGITAL_CHECKLIST = [
    { id: "d-manager", title: "Password manager with an emergency-access contact", why: "Many password managers let a trusted person request access after a waiting period. That beats any written list." },
    { id: "d-legacy", title: "Legacy or inactive-account settings checked on main accounts", why: "Several large email, phone and social services let you name a legacy contact or decide what happens to an inactive account." },
    { id: "d-recovery", title: "Recovery codes printed and stored with your papers", why: "Two-step sign-in can lock your family out. Keep printed recovery codes with the originals, not in this vault." },
    { id: "d-devices", title: "Devices listed with how to unlock them (hints only)", why: "Phones and laptops hold the codes for everything else. Record a hint, never the code itself." },
    { id: "d-photos", title: "Photos and family files backed up, and who should get them", why: "Decide who keeps the family photos and how they reach them." },
    { id: "d-subs", title: "Subscriptions and automatic payments listed", why: "So someone can cancel them. Add them to the Digital list with the type Shopping or subscriptions." },
    { id: "d-number", title: "Plan for the phone number", why: "Sign-in codes often go to your number. Ask whoever handles things to keep it active until accounts are sorted." },
    { id: "d-crypto", title: "Crypto or other self-held assets: where the recovery details are kept", why: "Write only where the recovery phrase is stored and who knows how to use it. Never put the phrase itself in this vault." },
    { id: "d-wishes", title: "Wishes for social media accounts recorded", why: "Memorialise, close or download first: set the action for each account in the Digital list." }
  ];

  var HAZARDS = [{ id: "fire", l: "Fire or wildfire smoke" }, { id: "flood", l: "Flood" }, { id: "quake", l: "Earthquake" }, { id: "storm", l: "Severe storm, hurricane or typhoon" },
    { id: "winter", l: "Winter storm or extreme cold" }, { id: "heat", l: "Extreme heat" }, { id: "power", l: "Long power cut" }, { id: "chemical", l: "Chemical or industrial accident" }, { id: "illness", l: "Outbreak of illness" }];
  var EMERGENCY = [
    { k: "localNumber", label: "Local emergency number", ph: "Your country's emergency number", max: 40 },
    { k: "outName", label: "Out-of-area contact", ph: "A relative in another town everyone checks in with" },
    { k: "outPhone", label: "Out-of-area contact phone", type: "tel", max: 40 },
    { k: "meetNear", label: "Meeting place near home", ph: "The big oak at the end of the street", wide: true },
    { k: "meetOut", label: "Meeting place outside the neighbourhood", ph: "The public library on Main Street", wide: true },
    { k: "meetFar", label: "Place to go if you must leave the area", ph: "Aunt Mia's house in the next region", wide: true },
    { k: "routes", label: "Ways out of home and the area", type: "textarea", wide: true, ph: "Two ways out of every room. Two driving routes out of town." },
    { k: "shelter", label: "Safe room to shelter in", ph: "Interior bathroom downstairs" },
    { k: "kitLocation", label: "Where the go-bag and first-aid kit are", ph: "Hall cupboard, top shelf" },
    { k: "water", label: "Water shut-off", ph: "Under the kitchen sink" }, { k: "gas", label: "Gas shut-off", ph: "Outside, left of the meter" },
    { k: "power", label: "Electrical panel or fuse box", ph: "Garage, by the door" },
    { k: "children", label: "School or childcare plan", type: "textarea", wide: true, ph: "Who collects the children and who is authorised on the school list" },
    { k: "pets", label: "Pets plan", type: "textarea", wide: true, ph: "Carriers in the garage, the vet's number, who can take them" },
    { k: "needs", label: "Medical or access needs", type: "textarea", wide: true, ph: "Powered medical equipment, mobility aids, hearing or sight needs" },
    { k: "neighbours", label: "Neighbours who can help", type: "textarea", wide: true },
    { k: "vaultNote", label: "Where this vault and its passphrase can be found", wide: true, ph: "The family laptop; passphrase sealed with our lawyer. Never write the passphrase here." },
    { k: "notes", label: "Other notes", type: "textarea", wide: true }
  ];

  var TASK_SUGGESTIONS = [
    { title: "Test smoke and carbon monoxide alarms", repeat: "6" }, { title: "Check the go-bag and replace expired supplies", repeat: "6" },
    { title: "Practise the family emergency plan", repeat: "12" }, { title: "Review the estate checklist and key roles", repeat: "12" },
    { title: "Update the home inventory photos", repeat: "12" }, { title: "Save a fresh vault backup file", repeat: "3" }
  ];
  var REPEAT = [{ v: "", l: "Does not repeat" }, { v: "1", l: "Every month" }, { v: "3", l: "Every 3 months" }, { v: "6", l: "Every 6 months" }, { v: "12", l: "Every year" }, { v: "24", l: "Every 2 years" }];

  var api = { DOC_TYPES: DOC_TYPES, ACCOUNT_KINDS: ACCOUNT_KINDS, CONTACT_ROLES: CONTACT_ROLES, BLOOD: BLOOD, ROOMS: ROOMS, CHECKLIST: CHECKLIST, LETTER: LETTER,
    JURISDICTIONS: JURISDICTIONS, ROLES: ROLES, WISHES: WISHES, POLICY_TYPES: POLICY_TYPES, POLICY_REVIEW: POLICY_REVIEW, MED_LEAD: MED_LEAD,
    DIGITAL_KINDS: DIGITAL_KINDS, DIGITAL_ACTIONS: DIGITAL_ACTIONS, LEGACY: LEGACY, DIGITAL_CHECKLIST: DIGITAL_CHECKLIST, HAZARDS: HAZARDS, EMERGENCY: EMERGENCY,
    TASK_SUGGESTIONS: TASK_SUGGESTIONS, REPEAT: REPEAT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.VaultContent = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
