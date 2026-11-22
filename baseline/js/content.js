/* Stark Baseline, by Stark: content. Plain-language checklist mapped to NIST CSF 2.0 Functions and Categories and to
   CISA's Cross-Sector Cybersecurity Performance Goals 2.0. Every description is our own paraphrase, not source text.
   Sources, licence status and the date we checked them are in SOURCES. Organisation help, not legal or compliance advice. */
(function (root) {
  "use strict";

  var SOURCES = [
    { id: "csf", name: "The NIST Cybersecurity Framework (CSF) 2.0", by: "National Institute of Standards and Technology (NIST), US Department of Commerce",
      ref: "NIST CSWP 29, published 26 February 2024", url: "https://doi.org/10.6028/NIST.CSWP.29", checked: "2026-11-20",
      status: "Public US government work. NIST states that works by its employees are not subject to copyright protection in the United States (17 U.S.C. 105). NIST keeps rights abroad but grants a royalty-free right to reprint and adapt its technical series publications, and asks users to cite the work.",
      statusUrl: "https://www.nist.gov/open/copyright-fair-use-and-licensing-statements-srd-data-software-and-technical-series-publications",
      use: "We use the six Functions and the Category codes (for example PR.AA) to organise the checklist. The checklist wording is our own paraphrase, not NIST text." },
    { id: "cpg", name: "Cross-Sector Cybersecurity Performance Goals (CPGs), Version 2.0", by: "Cybersecurity and Infrastructure Security Agency (CISA), US Department of Homeland Security",
      ref: "Released 11 December 2025; the report is dated December 2025 and marked TLP:CLEAR. It replaced version 1.0.1.", url: "https://www.cisa.gov/cross-sector-cybersecurity-performance-goals", checked: "2026-11-20",
      status: "Public US government work. Works prepared by federal employees are not subject to US copyright (17 U.S.C. 105). The report is marked TLP:CLEAR, which allows distribution without restriction subject to standard copyright rules, and CISA describes CISA.gov as a public domain website.",
      statusUrl: "https://www.cisa.gov/linking-policy",
      use: "Each item shows the goal numbers and titles it relates to (for example 3.F Implement Multifactor Authentication). The descriptions are our own words." },
    { id: "hipaa", name: "Guidance on Risk Analysis Requirements under the HIPAA Security Rule", by: "Office for Civil Rights (OCR), US Department of Health and Human Services (HHS)",
      ref: "Final guidance, July 2010. It explains 45 CFR 164.308(a)(1)(ii)(A).", url: "https://www.hhs.gov/hipaa/for-professionals/security/guidance/guidance-risk-analysis/index.html", checked: "2026-11-20",
      status: "Public US government work (17 U.S.C. 105).", statusUrl: "",
      use: "The Covenant practice preset groups evidence under the elements this guidance describes, in our own words. HHS proposed changes to the Security Rule in January 2025 (90 FR 898). When we checked on 2026-11-20, published reports said the proposal was not final, so the current rule still applied. Check the current rule with your adviser." },
    { id: "ukce", name: "Cyber Essentials: overview", by: "National Cyber Security Centre (NCSC), United Kingdom",
      ref: "The scheme's overview page, which lists the 5 technical controls. Read on 2026-11-22.", url: "https://www.ncsc.gov.uk/cyberessentials/overview", checked: "2026-11-22",
      status: "Crown copyright. The NCSC website's terms (last updated 13 April 2026 when we read them) allow reuse of its content under the Open Government Licence v3.0 with the source acknowledged: contains public sector information licensed under the Open Government Licence v3.0. The same terms do not allow use of its logos, or suggesting an association with or endorsement by the NCSC. Stark Baseline uses no logo and claims neither.",
      statusUrl: "https://www.ncsc.gov.uk/section/about-this-website/terms-and-conditions",
      use: "The UK Cyber Essentials view uses the names of the five technical controls as that page gives them: Firewalls, Secure configuration, Security update management, User access control and Malware protection. The descriptions, and the mapping of our checklist items onto the five, are our own. The mapping was reviewed on 2026-11-22 against the NCSC's Requirements for IT Infrastructure v3.3 (April 2026), and each theme lists what Baseline does not check. We did not use the scheme's question set, and the view is not a substitute for either document." },
    { id: "ukce-req", name: "Cyber Essentials: Requirements for IT Infrastructure", by: "National Cyber Security Centre (NCSC), United Kingdom",
      ref: "Version 3.3, April 2026. Read on 2026-11-22.", url: "https://www.ncsc.gov.uk/files/cyber-essentials-requirements-for-it-infrastructure-v3-3.pdf", checked: "2026-11-22",
      status: "Crown copyright. The NCSC website's terms allow reuse under the Open Government Licence v3.0 with the source acknowledged: contains public sector information licensed under the Open Government Licence v3.0. Stark Baseline uses no logo and claims no association with or endorsement by the NCSC.",
      statusUrl: "https://www.ncsc.gov.uk/section/about-this-website/terms-and-conditions",
      use: "We read the requirements for each of the five technical controls to decide which checklist items belong under which theme, and wrote the 'Baseline does not check' lists in our own words. The document is not reproduced here. Read the current version before you apply; the scheme's rules change each April." },
    { id: "gdpr", name: "General Data Protection Regulation (GDPR)", by: "European Parliament and Council of the European Union",
      ref: "Regulation (EU) 2016/679 of 27 April 2016, OJ L 119, 4.5.2016, p. 1. Read on 2026-11-22.", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679", checked: "2026-11-22",
      status: "EU law published on EUR-Lex. The EUR-Lex legal notice (read 2026-11-22) says the Commission's document reuse policy is based on Decision 2011/833/EU and that, unless otherwise specified, legal documents published in EUR-Lex can be re-used. Stark Baseline uses no EU logo and claims no association with or endorsement by any EU body.",
      statusUrl: "https://eur-lex.europa.eu/content/legal-notice/legal-notice.html",
      use: "The GDPR view and the incident and retention policies cite article numbers and short quotations from this text. The grouping, the descriptions, the mapping of checklist items onto articles and the lists of what Baseline does not check are our own. Every article number and quotation was checked against the text on 2026-11-22. It is the EU regulation; the United Kingdom has its own version, which we did not use." },
    { id: "nis2", name: "NIS 2 Directive", by: "European Parliament and Council of the European Union",
      ref: "Directive (EU) 2022/2555 of 14 December 2022, OJ L 333, 27.12.2022, p. 80. Read on 2026-11-22.", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022L2555", checked: "2026-11-22",
      status: "EU law published on EUR-Lex, on the same reuse terms as the GDPR entry above. A directive binds each member state through its own national law, which is what an organisation must follow.",
      statusUrl: "https://eur-lex.europa.eu/content/legal-notice/legal-notice.html",
      use: "The NIS2 view cites Articles 20, 21 and 23 and recital 89 with short quotations. The grouping, the descriptions, the mapping and the lists of what Baseline does not check are our own; every article number and quotation was checked against the text on 2026-11-22. Whether the directive reaches an organisation is set by its Article 2 and by national law." },
    { id: "warden", name: "Stark Warden scam-pattern library", by: "Stark", ref: "Warden's red-flag rules and practice messages", url: "", checked: "2026-11-20",
      status: "Our own work, reused here.", statusUrl: "", use: "The staff lessons quote Warden's warning-sign descriptions and practice messages, with small edits for the workplace." }
  ];

  var FUNCTIONS = [
    { id: "GV", name: "Govern", plain: "Who is responsible, what the rules are and which risks matter most." },
    { id: "ID", name: "Identify", plain: "Know what you have, where your data lives and where the weak spots are." },
    { id: "PR", name: "Protect", plain: "Everyday safeguards that keep trouble out." },
    { id: "DE", name: "Detect", plain: "Notice quickly when something is wrong." },
    { id: "RS", name: "Respond", plain: "Act fast and calmly during an incident." },
    { id: "RC", name: "Recover", plain: "Get back to normal, and tell people." }
  ];
  // NIST CSF 2.0 Category codes and names (identifiers cited for reference).
  var CSF = {
    "GV.OC": "Organizational Context", "GV.RM": "Risk Management Strategy", "GV.RR": "Roles, Responsibilities, and Authorities", "GV.PO": "Policy",
    "GV.OV": "Oversight", "GV.SC": "Cybersecurity Supply Chain Risk Management", "ID.AM": "Asset Management", "ID.RA": "Risk Assessment",
    "ID.IM": "Improvement", "PR.AA": "Identity Management, Authentication, and Access Control", "PR.AT": "Awareness and Training",
    "PR.DS": "Data Security", "PR.PS": "Platform Security", "PR.IR": "Technology Infrastructure Resilience", "DE.CM": "Continuous Monitoring",
    "DE.AE": "Adverse Event Analysis", "RS.MA": "Incident Management", "RS.AN": "Incident Analysis", "RS.CO": "Incident Response Reporting and Communication",
    "RS.MI": "Incident Mitigation", "RC.RP": "Incident Recovery Plan Execution", "RC.CO": "Incident Recovery Communication" };
  // CISA CPG 2.0 goal numbers and titles (identifiers cited for reference).
  var CPG = {
    "1.A": "Establish Cybersecurity Responsibilities", "1.B": "Manage Cybersecurity Oversight", "1.C": "Maintain Incident Response Plans",
    "1.D": "Supply Chain Incident Reporting & Vulnerability Disclosure", "1.E": "Manage Risks from Managed Service Providers",
    "2.A": "Manage Organizational Assets", "2.B": "Mitigate Known Vulnerabilities", "2.C": "Obtain Independent Validation of Cybersecurity Controls",
    "2.D": "Maintain Vulnerability Disclosure/Reporting Process", "2.E": "Document Network Topology",
    "3.A": "Change Default Passwords", "3.B": "Establish Minimum Password Strength", "3.C": "Create Unique Credentials", "3.D": "Revoke Credentials for Departing Staff",
    "3.E": "Monitor Unsuccessful (Automated) Login Attempts", "3.F": "Implement Multifactor Authentication (MFA)",
    "3.G": "Administrators Maintain Separate User and Privileged Accounts", "3.H": "Implement the Principles of Least Privilege",
    "3.I": "Implement Logical/Physical Network Segmentation", "3.J": "Implement Cybersecurity Training", "3.K": "Utilize Strong Encryption",
    "3.L": "Enable Email Security", "3.M": "Disable Autorun & Macros by Default", "3.N": "Establish Change Management Processes",
    "3.O": "Maintain System Backups & Restoration Ability", "3.P": "Maintain Hardware & Software Approval Process", "3.Q": "Maintain Log Collection & Storage",
    "3.R": "Prohibit Connection of Unauthorized Devices", "3.S": "Secure Internet-Facing Devices", "4.A": "Establish Malicious Code Detection",
    "4.B": "Identify Adverse Events", "5.A": "Establish Incident Communication Procedures", "5.B": "Establish Incident Reporting Procedures",
    "6.A": "Execute Incident Recovery Plan" };

  function I(id, fn, title, why, steps, csf, cpg, hint) { return { id: id, fn: fn, title: title, why: why, steps: steps, csf: csf, cpg: cpg, hint: hint || "" }; }
  var CHECKLIST = [
    I("gv-owner", "GV", "Name a security lead and a deputy", "Security work slips when it belongs to everyone. One named person, on staff or a trusted contractor, keeps this list moving and has the authority to act in an incident.",
      ["Record the lead and deputy in Settings, so they appear on the runbook.", "Give them a little time each month for this work.", "Make sure leadership and staff know who they are."], ["GV.RR"], ["1.A"], "lead"),
    I("gv-policy", "GV", "Keep a short written security policy and review it every year", "One or two pages tell staff the rules for passwords, devices, email and reporting problems. A yearly review keeps it honest as people, tools and threats change.",
      ["Cover what you protect, who does what, acceptable use, sign-in rules, devices and how to report a problem.", "Have leadership approve and date it.", "Keep the approved copy in Evidence and set a review date."], ["GV.PO", "GV.OV"], ["1.B"]),
    I("gv-risks", "GV", "List your biggest risks in plain words", "Knowing what would hurt most (ransomware, a stolen laptop, a hijacked email account, a vendor outage) tells you where to spend limited time and money first.",
      ["Add each risk on the Risks page with its likelihood and impact.", "Pick the top three to work on this quarter.", "Look at the list again after any incident or big change."], ["GV.RM"], ["1.B"], "risks"),
    I("gv-rules", "GV", "Write down the laws and contracts that apply to you", "Health, education, payment-card and privacy rules, along with your contracts and insurance policy, may set security and reporting duties. Listing them early avoids surprises in an incident.",
      ["List each rule or contract with a one-line note on what it asks of you.", "Ask a qualified adviser to confirm the list.", "Note any deadlines for reporting incidents."], ["GV.OC"], ["1.A"]),
    I("gv-vendors", "GV", "Know which vendors hold your data or run your systems", "Many incidents start at a supplier. Your contracts should say how quickly a vendor must tell you about a breach or a serious weakness that affects you.",
      ["List key vendors in the runbook contacts.", "Check each contract for a breach-notice promise and note the timeframe.", "Ask for one at renewal if it is missing."], ["GV.SC"], ["1.D"], "vendors"),
    I("gv-msp", "GV", "Review what your IT provider can reach", "A managed IT provider often holds the keys to everything, and attackers go after providers to reach their customers.",
      ["List the systems and accounts the provider can reach and how they sign in.", "Require multifactor sign-in for their access.", "Agree in writing how and when they will tell you about an incident on their side."], ["GV.SC"], ["1.E"]),

    I("id-devices", "ID", "Keep a list of every device", "You cannot protect what you do not know you have. A device list speeds up recovery and shows gaps such as unencrypted laptops.",
      ["Add computers, phones, tablets, servers, routers and printers on the Inventory page.", "Note who uses each one and whether it holds sensitive data.", "Update the list when devices arrive or leave."], ["ID.AM"], ["2.A"], "devices"),
    I("id-accounts", "ID", "Keep a list of important accounts and online services", "Email, records systems, banking, payroll, the website and the domain name are all ways in. Knowing who administers each one matters most when something goes wrong.",
      ["Add each service with its admin owner and sign-in protection.", "Include the domain name and website host, which are easy to forget.", "Never record passwords here; use a password manager for those."], ["ID.AM"], ["2.A"], "accounts"),
    I("id-data", "ID", "Know where your sensitive data lives", "Records about patients, students, members, donors or staff may sit in several places: a cloud system, a shared drive, a desktop folder, paper. Each copy needs protecting.",
      ["Add each kind of sensitive data under Inventory, Data.", "Note where it is stored, who can see it and how it is shared.", "Delete copies you no longer need."], ["ID.AM"], ["2.A"], "datasets"),
    I("id-network", "ID", "Draw a simple map of your network", "A sketch of the internet connection, router, Wi-Fi networks and key devices helps a helper fix things fast and shows what is exposed.",
      ["Sketch it on paper or in a simple drawing tool.", "Mark the guest Wi-Fi and anything reachable from the internet.", "Attach a photo or file of the map in Evidence."], ["ID.AM"], ["2.E"]),
    I("id-patch", "ID", "Install security updates quickly, most urgent first", "Attackers use known weaknesses that already have fixes. Updating promptly closes those doors. Internet-facing systems and weaknesses known to be exploited come first.",
      ["Turn on automatic updates wherever you can.", "Check monthly for anything that did not update.", "Watch CISA's Known Exploited Vulnerabilities catalog, or ask your IT provider to."], ["ID.RA"], ["2.B"], "updates"),
    I("id-report", "ID", "Give outsiders a way to report a security problem to you", "Someone who spots a weakness in your website, or a leak of your data, needs a clear way to tell you.",
      ["Choose a monitored address, such as a security mailbox, or a web form.", "Publish it on your website.", "Decide who reads it and how fast they reply."], ["ID.RA"], ["2.D"]),
    I("id-check", "ID", "Have someone independent check your setup now and then", "A fresh pair of eyes, such as a different IT contractor or a free government assessment, finds what insiders miss.",
      ["Ask for a review every year or two.", "Track the findings on the Risks page or in checklist notes.", "Keep the report in Evidence."], ["ID.IM"], ["2.C"]),
    I("id-improve", "ID", "After any incident or drill, write down what to fix", "Every scare and every practice run teaches something. Writing it down and acting on it is how small teams get stronger.",
      ["Hold a short review within a week.", "Add follow-up actions to the drill log or the Risks page.", "Update the runbook."], ["ID.IM"], ["1.C"], "followups"),

    I("pr-defaults", "PR", "Change default passwords on every device", "Routers, printers, cameras and new systems often ship with a known password that anyone can look up.",
      ["Check each device in your inventory.", "Change the password before the device goes into use.", "Store the new passwords in your password manager, not here."], ["PR.AA"], ["3.A"]),
    I("pr-passwords", "PR", "Use long passphrases and a password manager", "Long passphrases are much harder to guess. CISA's goals call for at least 16 characters where systems allow it. A password manager makes long, unique passwords practical.",
      ["Pick a password manager for the organisation.", "Set the minimum length to 16 where systems allow.", "Help each person move their work passwords into it."], ["PR.AA"], ["3.B"]),
    I("pr-unique", "PR", "Give everyone their own login, with no shared or reused passwords", "Shared logins hide who did what, and one leaked password should never open several doors.",
      ["Replace shared logins with named accounts where the service allows it.", "Where sharing cannot be avoided, keep the login in the password manager and change it when anyone leaves.", "Mark shared accounts in your inventory."], ["PR.AA"], ["3.C"], "shared"),
    I("pr-mfa", "PR", "Turn on multifactor sign-in, strongest option first", "A second sign-in step stops most account takeovers. Security keys or passkeys resist phishing best, an authenticator app comes next, and text-message codes are the last resort.",
      ["Start with email, admin accounts, remote access, banking and records systems.", "Record the method for each account in your inventory.", "Move accounts up to stronger methods over time."], ["PR.AA"], ["3.F"], "mfa"),
    I("pr-admin", "PR", "Use separate admin accounts", "Doing daily work on an admin account means one bad click can take over everything.",
      ["Give admins a normal account for email and browsing.", "Use the admin account only for admin tasks.", "Protect admin accounts with the strongest sign-in you have."], ["PR.AA"], ["3.G"]),
    I("pr-least", "PR", "Give people only the access they need", "The less each account can reach, the less damage a mistake or a stolen login can do.",
      ["Review who can reach sensitive systems twice a year.", "Remove access that is no longer needed.", "Ask your IT provider to do the same for their own access."], ["PR.AA"], ["3.H"]),
    I("pr-leavers", "PR", "Remove access on the day someone leaves", "Live accounts for former staff and contractors are a quiet risk. CISA's goals also suggest disabling accounts left unused for a set time, such as 30 days.",
      ["Use a leaver checklist: accounts, devices, keys and badges, shared codes.", "Change shared passwords and door codes they knew.", "Review inactive accounts every quarter."], ["PR.AA"], ["3.D"]),
    I("pr-training", "PR", "Train every person before they get access, then every year", "Most attacks start with a message to a person. Short, regular lessons help staff spot tricks and report them.",
      ["Use the Staff lessons here for new starters.", "Repeat them yearly and after a near miss.", "Record completion dates; they are part of your evidence."], ["PR.AT"], ["3.J"], "training"),
    I("pr-encrypt", "PR", "Encrypt laptops, phones and sensitive data", "If a device is lost or stolen, encryption keeps its data unreadable. Built-in tools, such as BitLocker on Windows, FileVault on a Mac and a passcode on phones, usually cover it.",
      ["Check and record encryption for each device in your inventory.", "Turn it on where it is missing.", "Use encrypted connections (HTTPS, a VPN) for remote work."], ["PR.DS"], ["3.K"], "encryption"),
    I("pr-email", "PR", "Protect your email domain from spoofing", "Settings called SPF, DKIM and DMARC make it much harder for criminals to send mail that looks like it came from you. Your email provider or IT contractor can turn them on.",
      ["Ask your provider or IT contractor whether SPF, DKIM and DMARC are set.", "Set DMARC to quarantine or reject once mail flows correctly.", "Keep the confirmation in Evidence."], ["PR.DS"], ["3.L"]),
    I("pr-macros", "PR", "Block macros and autorun by default", "Booby-trapped documents and USB drives rely on code that runs on its own.",
      ["Ask your IT provider to block macros in documents from the internet.", "Turn off autorun for removable drives.", "Allow exceptions only for named, needed files."], ["PR.PS"], ["3.M"]),
    I("pr-supported", "PR", "Replace systems that no longer get security updates", "Operating systems and apps past their support date stay vulnerable for good. For example, mainstream Windows 10 support ended on 14 October 2025.",
      ["Note the operating system of each device in your inventory.", "Plan replacements for anything out of support.", "Isolate anything that must stay, and record why."], ["PR.PS"], ["2.B"], "unsupported"),
    I("pr-approve", "PR", "Approve new software and devices before they are used", "Unapproved apps and gadgets bring weaknesses and data leaks that nobody is watching.",
      ["Decide who approves new software, services and devices.", "Keep a short list of approved tools.", "Add approved items to your inventory."], ["PR.PS"], ["3.P"]),
    I("pr-usb", "PR", "Block unknown USB drives and devices", "Found or gifted USB sticks and unknown gadgets are a classic way to sneak in malware or carry data out.",
      ["Tell staff never to plug in unknown drives.", "Ask your IT provider to block or scan removable media.", "Keep a few approved, encrypted drives for real needs."], ["PR.DS"], ["3.R"]),
    I("pr-wifi", "PR", "Keep guest Wi-Fi separate from work systems", "Visitors, smart TVs and personal phones should not share a network with records systems and staff computers.",
      ["Set up a guest network with its own password.", "Keep printers, servers and staff devices on the work network.", "Change the Wi-Fi passwords when staff leave."], ["PR.IR"], ["3.I"]),
    I("pr-internet", "PR", "Close or protect anything reachable from the internet", "Remote desktop, old VPNs, camera systems and admin pages left open to the internet are a top way in.",
      ["Ask your IT provider for a list of everything reachable from the internet.", "Close what is not needed.", "Put multifactor sign-in and updates first on what remains."], ["PR.IR"], ["3.S"]),
    I("pr-backups", "PR", "Back up important data, with at least one copy offline", "Backups are your way back from ransomware, theft or mistakes. A copy that is offline, or cannot be changed, survives an attack that reaches your network. CISA's goals call for storing backups offsite and offline.",
      ["List every backup on the Inventory page.", "Make sure at least one copy is offline or cannot be changed.", "Write down how long each backup keeps old versions."], ["PR.DS"], ["3.O"], "backups"),
    I("pr-config", "PR", "Write down how key systems are set up, and record changes", "When a helper has to rebuild a system in a hurry, notes on how it was set up save hours. A change log shows what moved before a problem.",
      ["Keep setup notes for the router, server and key services.", "Record big changes with a date.", "Store the notes in Evidence."], ["PR.PS"], ["3.N"]),
    I("pr-logs", "PR", "Turn on sign-in and security logs, and keep them safe", "Logs show what happened during an incident. Without them, nobody can tell what an intruder touched.",
      ["Turn on audit logs in your email and cloud services.", "Keep them for as long as your adviser recommends.", "Make sure ordinary accounts cannot delete them."], ["PR.PS"], ["3.Q"]),
    I("pr-physical", "PR", "Lock up devices, network gear and paper records", "A server closet anyone can walk into, or records left on a desk, undo good digital security.",
      ["Lock the room or cabinet that holds the router and any server.", "Lock screens when stepping away.", "Store and shred paper records safely."], ["PR.AA"], []),

    I("de-malware", "DE", "Run up-to-date malware protection on every computer", "Built-in protection such as Microsoft Defender is fine if it is switched on, kept updated, and its alerts reach someone.",
      ["Check that protection is on for every computer.", "Make sure alerts go to the security lead or IT provider.", "Record it in your device notes."], ["DE.CM"], ["4.A"]),
    I("de-signins", "DE", "Watch for failed and unusual sign-ins", "Many attacks try thousands of passwords or sign in from odd places. Most email and cloud services can alert you and lock an account after repeated failures.",
      ["Turn on sign-in alerts in your email and cloud admin settings.", "Set accounts to lock after repeated failures.", "Decide who reviews alerts."], ["DE.CM"], ["3.E"]),
    I("de-events", "DE", "Agree what counts as 'something is wrong' and who to tell", "Staff should know the signs (strange pop-ups, locked files, missing money, odd messages from colleagues) and report them at once to one named person.",
      ["Write the signs and the contact on the runbook.", "Tell staff that early reports are always welcome, even false alarms.", "Practise it in the yearly drill."], ["DE.AE"], ["4.B"]),

    I("rs-plan", "RS", "Keep a written incident plan and practise it every year", "In a crisis people forget. A short plan with names, numbers and first steps, practised once a year, saves hours.",
      ["Fill in the Runbook page and print it.", "Keep a paper copy where you can reach it without a computer.", "Run a tabletop exercise or phone-tree test every year and log it."], ["RS.MA"], ["1.C"], "runbook"),
    I("rs-report", "RS", "Know who you must or should report incidents to", "Your insurer, bank, law enforcement, regulators and affected people may need to hear from you, some within set deadlines. In the US, cyber crime can be reported to the FBI's IC3 and to CISA.",
      ["List reporting contacts in the runbook.", "Ask your adviser which deadlines apply to you.", "Keep insurer and bank fraud lines on the printed copy."], ["RS.CO"], ["5.B"]),
    I("rs-comms", "RS", "Plan how you will reach staff, clients and partners", "If email is down or taken over, you need another way: a phone tree, a text group, printed numbers.",
      ["Build the phone tree on the Runbook page.", "Agree a backup channel and a meeting point.", "Keep short message templates for staff and clients."], ["RS.CO"], ["5.A"], "tree"),
    I("rs-insurance", "RS", "Know your cyber insurance terms and hotline, if you have cover", "Many policies ask you to call their hotline first and use their approved helpers. Acting alone can affect your cover.",
      ["Add the insurer hotline and policy number to the runbook contacts.", "Note what the policy asks you to do first.", "Keep a copy of the policy in Evidence."], ["RS.MA"], []),

    I("rc-restore", "RC", "Test restoring from backup at least once a year", "A backup you have never restored is a hope, not a plan. CISA's goals call for testing backups and recovery at least once a year.",
      ["Pick a file or system and restore it to a safe place.", "Time it and note any problems.", "Log the drill here, with a screenshot in Evidence."], ["RC.RP"], ["3.O", "6.A"], "drills"),
    I("rc-order", "RC", "Decide what to restore first and how long you can manage without it", "When everything is down, a ranked list stops arguments and gets the most important service back first.",
      ["List critical services on the Runbook page with a restore order.", "Note how many hours you can manage without each.", "Check the list with leadership."], ["RC.RP"], ["6.A"], "services"),
    I("rc-paper", "RC", "Have a paper fallback for critical work", "Paper schedules, sign-in sheets and contact lists keep you serving people while systems are down.",
      ["Decide which tasks must continue on paper.", "Print the forms and keep them with the runbook.", "Plan how paper records are entered once systems return."], ["RC.RP"], ["6.A"], "fallback"),
    I("rc-comms", "RC", "Tell people when you are back, and what happened", "Clear updates rebuild trust. Staff, clients and partners need to know what changed and what to watch for.",
      ["Name who approves updates.", "Prepare a short 'we are back' message.", "Include what people should do, for example reset a password."], ["RC.CO"], ["5.A"])
  ];

  var STATUS = [{ v: "todo", l: "Not started" }, { v: "doing", l: "In progress" }, { v: "done", l: "Done" }, { v: "na", l: "Does not apply" }];

  /* ---- staff lessons: warning signs quoted from Stark Warden's scam-pattern library (rule id, title, why), adapted for work ---- */
  function S(rule, title, why) { return { rule: rule, title: title, why: why }; }
  var LESSONS = [
    { id: "pressure", title: "Pressure, threats and secrecy", minutes: 8,
      intro: "Most scams try to rush you. At work the pressure often comes dressed as a boss, a bank or an angry supplier.",
      signs: [
        S("urgency", "Pressure to act right now", "Scammers rush you so you do not have time to think or check. Real organisations give you time and a way to verify."),
        S("threat", "Threats of arrest, lawsuits or shut-off", "Government agencies and honest collectors do not threaten arrest over a text, call or email. Threats are used to make you panic and pay."),
        S("secrecy", "Told to keep it secret", "Scammers isolate you so no one can warn you. Real banks and agencies do not tell you to hide a payment from family or from your bank."),
        S("account_alert", "Alarm about your account", "Messages claiming your account is locked, limited or compromised are the most common phishing opening. Check by opening the app or typing the company address yourself.")],
      atWork: ["An email that seems to come from the director says a payment must go out before noon and that you must not tell anyone.", "A caller says the office's service will be cut off within the hour unless you pay now.", "A pop-up says your mailbox is locked and you must sign in again right away."],
      todo: ["Slow down. A real request survives a five-minute check.", "Check through a channel you already know: the number on file, the official app, or walking down the hall.", "Tell your security lead, even if you are not sure."] },
    { id: "payments", title: "Payment tricks and fake invoices", minutes: 8,
      intro: "Criminals want money that is fast and hard to get back. Small organisations lose the most through changed bank details and gift-card requests.",
      signs: [
        S("giftcard", "Asks for gift cards", "Nobody legitimate (no bank, agency, utility, employer or collector) takes payment in gift cards. This is the surest sign of a scam."),
        S("crypto_atm", "Bitcoin ATM or crypto deposit demand", "Crypto payments cannot be reversed. Real agencies and companies never ask you to deposit cash into a bitcoin ATM."),
        S("untraceable", "Hard-to-reverse payment method", "Wire transfers, money orders, cash apps and cashier’s checks are hard to undo. Scammers prefer them for that reason."),
        S("fake_check", "Check or overpayment, then send money back", "In a fake-check scam you deposit a check, send part of the money away, and the check bounces days later, leaving you owing the bank."),
        S("fake_collector", "Collector-style pressure to pay today", "Real collectors must send a written validation notice and cannot threaten arrest or demand gift cards. Pushing “pay now or face court” over a call is a known fake-collector script.")],
      atWork: ["A 'supplier' emails new bank details for the next invoice.", "The 'boss' texts asking you to buy gift cards for clients and send photos of the codes.", "An invoice arrives for a service nobody ordered, with a short deadline."],
      todo: ["Never change payment details because of an email alone. Call the supplier on the number you already have.", "Use a two-person check for new payees and bank changes.", "Nobody at work needs gift-card codes sent by message."] },
    { id: "impersonation", title: "Someone pretending to be someone else", minutes: 7,
      intro: "Scammers borrow trusted names: your bank, a government office, a delivery firm, even a colleague on a 'new number'.",
      signs: [
        S("impersonate_bank", "Claims to be your bank or payment service", "Scammers copy bank and payment names. Do not use the phone number or link in the message; use the number on your card or the app you already have."),
        S("impersonate_gov", "Claims to be a government agency", "The IRS, Social Security, Medicare and the courts do not demand payment or details by text or by threatening phone calls. They write on paper first."),
        S("impersonate_delivery", "Fake delivery problem", "Texts about a missed delivery, a held package or a small “redelivery fee” are one of the biggest scam waves. Check your order in the shop’s own app or website."),
        S("new_number", "“Hi Mom, this is my new number”", "A message from an unknown number pretending to be your child or parent is the first step of a money scam."),
        S("family_emergency", "Relative in trouble needs money", "“Grandparent” and “it’s me, I got a new number” scams use fear for a loved one. Hang up and call the relative on the number you already have.")],
      atWork: ["A text from 'your manager' on a new number asks for a quick favour.", "A caller says they are from the bank or a government office and needs details about the organisation's account.", "A message about a parcel for the office asks for a small fee."],
      todo: ["Hang up and call back on a number you look up yourself.", "Check a 'new number' with the person face to face or on their known number.", "Report it, so colleagues can be warned."] },
    { id: "techsupport", title: "Fake tech support and remote access", minutes: 6,
      intro: "A stranger who controls your computer can see everything you can. Fake support calls and scary pop-ups are built to get that control.",
      signs: [
        S("impersonate_tech", "Fake tech support or fake invoice", "Real tech companies do not cold-call or pop up warnings with a phone number. “Your subscription renewed, call to cancel” is a known trap to get you onto the phone."),
        S("remote_access", "Asks for remote access to your device", "Letting a stranger control your computer lets them see your accounts and install spyware. Real support never starts by asking you to install a remote tool."),
        S("fake_charge", "Fake charge or renewal, “call to cancel”", "A surprise charge, invoice or renewal with a phone number to call is the opening of a refund or tech-support scam. Check your real account statement instead.")],
      atWork: ["A caller 'from IT' or 'from Microsoft' asks you to install a tool so they can fix your computer.", "A pop-up warns of a virus and shows a phone number.", "An email says a software subscription renewed and gives a number to call to cancel."],
      todo: ["Only your known IT contact installs remote tools, and you contact them, not the other way round.", "Close the pop-up. If it will not close, turn off Wi-Fi and call your IT contact.", "Check charges in the real account, never through the message."] },
    { id: "codes", title: "Sign-in codes and passwords", minutes: 5,
      intro: "Your password and the one-time code on your phone are the keys to the organisation's accounts. Anyone who asks for them is trying to get in as you.",
      signs: [
        S("code_request", "Asks you to read out or send a code", "One-time codes are the keys to your accounts. Anyone who asks you to read one back is trying to break in as you."),
        S("credentials", "Asks for passwords, PINs, card or ID numbers", "Real companies already have your details and never ask you to send passwords, PINs, full card numbers or your Social Security number by message.")],
      atWork: ["Someone asks you to read out the sign-in code that just arrived on your phone.", "A web page asks for your work password to 'verify' your mailbox.", "A colleague asks to borrow your login for a minute."],
      todo: ["Never share a sign-in code with anyone, ever.", "If you typed your password somewhere odd, change it now and tell your security lead.", "Use your own account. Ask for access instead of borrowing."] },
    { id: "links", title: "Links, attachments and call-back numbers", minutes: 6,
      intro: "A link or attachment in an unexpected message is the most common first step of an attack on a small organisation.",
      signs: [
        S("click_prompt", "Tells you to click or open something", "Be careful with links and attachments in unexpected messages. Open the official app or type the website address yourself."),
        S("callback", "Tells you to call a number in the message", "Do not call a number from a suspicious message. Look up the organisation’s real number yourself."),
        S("generic_greeting", "Generic greeting", "Companies that really have your account usually use your name. “Dear customer” is common in mass-sent scams."),
        S("toll_scam", "Fake unpaid toll", "Texts about an unpaid toll or road-fee balance with a payment link are a current smishing wave. Check your tolling account directly.")],
      atWork: ["An email that starts 'Dear user' asks you to open an attached invoice or shared document.", "A message asks you to call a number to fix a billing problem.", "A shared-file link asks you to sign in again before you can see it."],
      todo: ["Reach websites by typing the address or using a saved bookmark.", "Hover over a link, or press and hold on a phone, to see where it really goes. When in doubt, do not click.", "Unexpected attachment? Ask the sender on a channel you already know."] },
    { id: "toogood", title: "Offers that are too good to be true", minutes: 5,
      intro: "Prizes, grants, donations and easy jobs are bait. The catch always comes as a fee, a transfer or your personal details.",
      signs: [
        S("prize", "Prize, lottery or “you were selected”", "You cannot win a contest you did not enter. If you must pay a fee, tax or “shipping” to collect a prize, it is a scam."),
        S("advance_fee", "Pay a fee first to receive money", "Asking you to pay upfront to release a prize, loan, inheritance or package is “advance-fee fraud”. The money never arrives."),
        S("windfall", "Inheritance, “next of kin” or huge transfer", "Strangers do not hand out millions. This is a very old fraud that still works on people who are hopeful."),
        S("investment", "Promised returns or “easy money” investing", "Real investments always carry risk. Promised profits, daily payouts, trading “mentors” and private groups are classic investment-fraud hooks."),
        S("job", "Too-good job offer", "Unrequested “work from home” offers with high pay, no experience and chat-app interviews are usually scams, often to move stolen money or collect your ID.")],
      atWork: ["An email says the organisation has won a grant you never applied for, and asks for a 'processing fee'.", "A 'donor' offers a large gift if you first pay a transfer cost.", "A recruiter offers staff easy side work moving money through their own accounts."],
      todo: ["You cannot win what you did not enter.", "Never pay a fee to receive money.", "Ask your security lead before replying."] }
  ];
  // Practice messages: q1-q16 are copied from Stark Warden's practice quiz (one word adapted in q14); w1-w3 are workplace additions.
  function Q(id, lesson, text, scam, why, tells) { return { id: id, lesson: lesson, text: text, scam: scam, why: why, tells: tells }; }
  var QUIZ = [
    Q("q3", "pressure", "This is Officer Daniels from the Social Security Administration. Your number has been used in a crime. Do not tell anyone. Call us at once or a warrant will be issued.", true, "Social Security does not threaten arrest by phone and does not tell you to keep it secret. Secrecy and threats are classic scam tools.", ["Threat of arrest", "Asked to keep it secret", "Urgent"]),
    Q("q6", "pressure", "Chase: Did you attempt a $42.18 purchase at Shell on 6/3? Reply Y or N. We will never ask for your password or full card number.", false, "This asks a yes/no question and offers no link, and it says what it will not ask. If you are unsure, open your own banking app instead of replying.", ["No link", "No request for secrets", "Simple yes or no"]),
    Q("w1", "payments", "Hi, it's Dana. I'm stuck in a meeting. Please buy six $100 gift cards for client thank-yous and text me photos of the codes. Keep it quiet, it's a surprise.", true, "A boss never needs gift-card codes by text. Gift cards, secrecy and a 'meeting' excuse are the classic boss-impersonation pattern. Check with Dana on her known number.", ["Gift cards", "Secrecy", "Can't talk excuse"]),
    Q("w2", "payments", "Accounts team: our bank has changed. Please send today's payment for invoice 2231 to the new account below. Our old account is closed.", true, "Changed bank details by email are the most expensive small-business fraud. Call the supplier on the number you already have before paying.", ["New bank details", "Deadline", "Email only"]),
    Q("q11", "payments", "Final notice: you owe $1,247 on a payday loan. Pay today by gift card or we will notify the sheriff and file charges. We cannot mail anything.", true, "A real collector must send a written validation notice, cannot threaten arrest over a consumer debt, and will not demand gift cards.", ["Arrest threat", "Gift cards", "Refuses writing"]),
    Q("q7", "impersonation", "Grandma, it is me, I was in a car accident and they arrested me. Please do not tell Mom. I need $3,000 for bail, can you send gift cards?", true, "Panic, secrecy and gift cards. Hang up and call your grandchild on a number you already have. Police do not take bail in gift cards.", ["Secrecy", "Gift cards", "Emergency pressure"]),
    Q("q1", "impersonation", "USPS: Your package could not be delivered because the address is incomplete. Confirm your address within 12 hours: https://usps-redelivery.top/track", true, "The link is not usps.com, and the message pushes you to act within hours. USPS does not send links like this for missed deliveries.", ["Look-alike link", "Urgent deadline", "Delivery excuse"]),
    Q("q4", "impersonation", "Hi, this is Dana at Maple Dental. Your cleaning is booked for Monday at 9 am. Reply C to confirm or call the office to change it.", false, "It names a real appointment, asks for nothing sensitive, and has no link or payment request. If you are not a patient of that office, ignore it, but nothing here asks for money.", ["Specific appointment", "No link", "No payment ask"]),
    Q("q10", "techsupport", "MICROSOFT ALERT: Your computer is infected! Do not shut down. Call 1-888-555-0188 now for a free repair.", true, "Real warnings from Microsoft do not give you a phone number. This is a tech-support scam; calling puts you with a scammer who will ask for remote access.", ["Scary alert", "Phone number to call", "Pressure"]),
    Q("q16", "techsupport", "Sir, we overcharged you $300 by mistake. To return it, install AnyDesk so our agent can fix your account. Then please send back the difference by gift card.", true, "Remote-access tools and “send back the difference” are the refund scam. They take control of your device and your money.", ["Remote access", "Refund trick", "Gift cards"]),
    Q("q15", "techsupport", "Amazon: Your order of a desk lamp has shipped and arrives Thursday. Track it in the Amazon app or at amazon.com/orders.", false, "It is about an order, uses the real amazon.com, and does not ask you to pay or log in through a link. If you did not order a lamp, open the Amazon app yourself to check.", ["Real domain", "No payment ask", "Specific item"]),
    Q("q2", "codes", "Your verification code is 482915. It expires in 10 minutes. Do not share this code with anyone.", false, "This is the normal shape of a one-time code you asked for. It tells you not to share it. It would be a scam only if you did not request it, or if someone asked you to read it to them.", ["Tells you not to share", "No link", "No request for money"]),
    Q("w3", "codes", "Hi, this is IT. We're moving your mailbox tonight. Please read me the 6-digit code that just arrived on your phone so I can finish the move.", true, "Nobody, including real IT staff, needs your sign-in code. Asking you to read it out is how attackers take over accounts.", ["Asks for a code", "Unexpected call", "Time pressure"]),
    Q("q13", "links", "Your Netflix payment was declined. Update your billing information within 24 hours or your account will be closed: netflix-billing-update.com", true, "The domain is not netflix.com. Look-alike domains with hyphens and words like “billing” are used to steal logins and card numbers.", ["Look-alike domain", "Deadline", "Account closure threat"]),
    Q("q12", "links", "The IRS will never call or text to demand immediate payment. Learn about tax scams at irs.gov/newsroom/tax-scams-consumer-alerts", false, "This is a warning about scams, and the web address is the real irs.gov. It does not ask you to do anything risky.", ["Real irs.gov address", "Educational", "No demand"]),
    Q("q9", "links", "Your library book Dune is due Friday. Renew it online at your library’s website, or bring it back.", false, "A routine reminder: no link, no money, no pressure.", ["No link", "No payment", "Routine"]),
    Q("q8", "toogood", "We are hiring remote assistants. Earn $400 a day, no experience needed. Message us on WhatsApp to start today.", true, "Unrequested offers with high pay, no experience and a chat-app interview are a common scam, often used to collect your ID or move stolen money.", ["Too-good pay", "Chat-app interview", "Unrequested"]),
    Q("q5", "toogood", "You have won a $500 gift card! To claim, buy two $100 gift cards to cover shipping and send us the numbers on the back.", true, "You never pay to collect a prize, and no real business takes gift card numbers as payment.", ["Prize you did not enter", "Gift cards", "Pay to receive"]),
    Q("q14", "toogood", "A stranger texts you: “Wrong number? Oh sorry. You seem nice though.” A week later they suggest a crypto trading platform that has “promised” returns.", true, "This is the pig-butchering pattern: a friendly stranger, then a crypto platform with promised returns. Never invest on a new contact’s advice.", ["Wrong-number opening", "Promised returns", "Crypto platform"])
  ];

  /* ---- Covenant practice preset: evidence for a clinic's own HIPAA risk analysis, grouped by the HHS guidance elements ---- */
  function H(id, title, what, gather, link) { return { id: id, title: title, what: what, gather: gather, link: link }; }
  var HIPAA = [
    H("h-scope", "Scope: every place patient data lives", "The analysis covers all electronic protected health information (ePHI) you create, receive, keep or send, on every device, service and medium.",
      ["Device list with the devices that hold ePHI marked", "Account and service list, including vendor-hosted systems", "Portable media and home or remote devices used for work"], "inventory"),
    H("h-data", "Data collection: where ePHI is stored, received, kept and sent", "Find and write down where the data is and how it moves. Interviews, past projects and existing documents all count.",
      ["Data map (Inventory, Data) with storage place, who can see it and how it is sent", "Notes from staff interviews", "Existing policies and vendor documents"], "inventory"),
    H("h-threats", "Threats and weaknesses", "List the threats you can reasonably expect (for example ransomware, theft, staff mistakes, power or internet loss, a vendor breach) and the weaknesses they could use.",
      ["Risk list with each threat and weakness", "Findings from any outside review", "Recent incidents and near misses"], "risks"),
    H("h-measures", "Current security measures", "Record the safeguards you already have, technical and non-technical, and whether they are set up and used properly.",
      ["Checklist progress and notes", "Screenshots or letters confirming settings (sign-in protection, encryption, backups)", "Policies and training records"], "checklist"),
    H("h-likelihood", "Likelihood of each threat", "Judge how likely each threat is to happen to you, given your current measures.", ["Likelihood rating for every risk", "Reasons for each rating"], "risks"),
    H("h-impact", "Potential impact", "Judge what would happen if the threat occurred: harm to patients, care delays, cost, reputation.", ["Impact rating for every risk", "Notes on the worst realistic outcome"], "risks"),
    H("h-level", "Level of risk", "Combine likelihood and impact to rank each risk, so the highest come first.", ["Risk levels (worked out on the Risks page)", "Ranked list of the risks you will treat first"], "risks"),
    H("h-docs", "Write it all down", "HHS explains that the risk analysis must be documented, in no particular format, and that Security Rule documentation is kept for six years.",
      ["Printed evidence pack from this page, dated and signed", "Where the signed copy is kept", "Who reviewed it"], "hipaa"),
    H("h-review", "Review regularly and after changes", "The analysis is ongoing. Review it on a schedule and whenever something changes: a new system, a move, a new vendor, an incident.",
      ["Date of the last review and the next one", "List of changes since the last review"], "hipaa"),
    H("h-manage", "Next step: a plan to reduce the risks", "A risk analysis leads to risk management (45 CFR 164.308(a)(1)(ii)(B)): actions, owners and dates for bringing risks down.",
      ["Planned action, owner and due date for each risk", "Progress notes"], "risks")
  ];

  /* ---- recovery runbook scenarios (our own plain-language first steps) ---- */
  function R(id, title, first, day, recover) { return { id: id, title: title, first: first, day: day, recover: recover }; }
  var SCENARIOS = [
    R("ransomware", "Ransomware, or files suddenly locked or renamed",
      ["Disconnect affected computers from the network: unplug the cable and turn off Wi-Fi. Do not wipe them.", "If a device cannot be disconnected, power it off.", "Call the incident lead, then the IT contact.", "Do not reply to or pay the criminals. If you have cyber insurance, call the insurer's hotline first.", "Write down the time, what is on screen and which machines are affected. Take photos."],
      ["Report it to law enforcement (in the US, the FBI's IC3) and consider reporting to CISA.", "Ask your adviser whether you must notify anyone, such as clients, patients, students or a regulator, and by when.", "Change passwords for affected accounts from a clean device.", "Switch to the paper fallback for critical work."],
      ["Check that backups are clean before restoring anything.", "Restore services in the agreed order.", "Watch for the attacker coming back: new accounts, odd sign-ins, forwarding rules."]),
    R("email", "Email account taken over",
      ["From a clean device, change the password and sign out all sessions.", "Turn on or reset multifactor sign-in.", "Tell the incident lead and IT contact."],
      ["Look for forwarding rules and inbox rules the attacker may have added, and remove them.", "Warn contacts that recent messages from the account may be fake.", "Check for payment requests or bank-detail changes sent from the account.", "Ask your adviser whether any data exposure must be reported."],
      ["Review sign-in logs for other affected accounts.", "Move the account to a stronger sign-in method."]),
    R("device", "Lost or stolen laptop, phone or tablet",
      ["Use the device's find, lock or erase feature if it is set up.", "Change passwords for accounts used on it, starting with email.", "Tell the incident lead."],
      ["Check the inventory: was the device encrypted? Did it hold sensitive data?", "Report a theft to the police and note the report number.", "Ask your adviser whether the loss must be reported."],
      ["Replace the device and restore from backup.", "Update the inventory."]),
    R("outage", "Internet, phone or power outage",
      ["Call the provider and note the ticket number and expected fix time.", "Switch to the paper fallback for critical work.", "Tell staff how to reach each other (phone tree)."],
      ["Use a phone hotspot for critical online work only if your policy allows.", "Update staff and visitors on timing."],
      ["Enter paper records into the systems once they are back.", "Check that backups ran during the outage."]),
    R("system", "Key system, server or software down",
      ["Call the vendor's support line or the IT contact.", "Switch to the paper fallback.", "Tell the incident lead."],
      ["Agree a target time for the fix and when to start restoring from backup instead.", "Keep staff and clients informed."],
      ["Restore in the agreed order and check the data.", "Log what happened and what to improve."]),
    R("fraud", "Payment or invoice fraud",
      ["Call your bank's fraud line at once; speed matters for recovering money.", "Do not use any contact details from the suspicious message.", "Keep the emails and messages; do not delete them."],
      ["Report it to law enforcement (in the US, the FBI's IC3).", "Check whether an email account was taken over (see that scenario).", "Tell the supplier whose name was used."],
      ["Add a two-person check and a call-back on a known number for any payment change.", "Run the payment-tricks staff lesson again."]),
    R("vendor", "A vendor or IT provider reports a breach",
      ["Ask what systems and data of yours are affected, and what they are doing about it.", "Tell the incident lead."],
      ["Change any passwords or keys the vendor held.", "Check the contract for their notice promises and your own reporting duties.", "Ask your adviser whether you must notify anyone."],
      ["Watch affected accounts closely for a few weeks.", "Decide whether to keep the vendor, and record why."])
  ];

  /* ---- vendors and agreements; evidence renewal ---- */
  var AGREEMENT = [{ v: "", l: "Not recorded" }, { v: "signed", l: "Signed" }, { v: "pending", l: "Requested, not signed" }, { v: "none", l: "None" }, { v: "na", l: "Not needed" }];
  var EVERY = [{ v: "", l: "Does not need renewing" }, { v: "90", l: "Every 3 months" }, { v: "180", l: "Every 6 months" }, { v: "365", l: "Every year" }, { v: "730", l: "Every 2 years" }];
  var INCIDENT_STATUS = [{ v: "open", l: "Open" }, { v: "closed", l: "Closed" }];

  /* ---- tabletop exercise injects: [minute, what happens, questions for the room]. Built on the runbook scenarios. ---- */
  function T(at, text, ask) { return { at: at, text: text, ask: ask }; }
  var TABLETOP = {
    ransomware: [
      T(0, "8:10 am. Reception says files on the shared drive have strange names and a note on screen demands payment.", ["Who is told first, and how?", "Which machines are unplugged, and who does it?"]),
      T(10, "The billing laptop shows the same note. The practice system still works from the tablet.", ["Do you keep using the practice system, or stop everything?", "Where is the paper fallback, and who starts it?"]),
      T(20, "The criminals email: pay within 48 hours or the data is published.", ["Who calls the insurer and law enforcement?", "Who decides about notifying clients, and with which adviser?"]),
      T(35, "The IT contact asks which backup to restore first and when it was last tested.", ["What is the restore order?", "Has that backup had a good restore test this year?"])],
    email: [
      T(0, "A supplier phones: they received an email from your manager asking them to change bank details.", ["Who checks the account, from which device?", "Who calls the supplier back, and on which number?"]),
      T(10, "You find a forwarding rule sending all mail to an outside address.", ["Who removes it and changes the password?", "How is multifactor sign-in reset?"]),
      T(20, "Two other staff got a message from the same account with a link to a document.", ["Did anyone sign in through that link?", "How do you warn contacts without causing panic?"]),
      T(30, "A payment of a large invoice went out yesterday to the new bank details.", ["Who calls the bank fraud line now?", "What records do you keep for the police report?"])],
    device: [
      T(0, "A staff member's laptop was taken from a car overnight.", ["Was it encrypted? Check the inventory.", "Did it hold sensitive data?"]),
      T(10, "The laptop was signed in to email and the practice system.", ["Which passwords are changed first, and from where?", "Can the device be locked or erased remotely?"]),
      T(20, "The police give a report number. Your insurer asks for a list of what was on the device.", ["Where does that list come from?", "Who talks to your adviser about whether the loss must be reported?"])],
    outage: [
      T(0, "Internet and phones stop at 9 am on a busy day.", ["Who calls the provider, and with which account number?", "How do staff reach each other?"]),
      T(10, "The provider says it may take until tomorrow.", ["Which work moves to paper?", "Is a phone hotspot allowed for critical work?"]),
      T(25, "Power also fails for an hour.", ["What is at risk without power (fridges, servers, doors)?", "What gets entered into the systems once they are back, and by whom?"])],
    system: [
      T(0, "The main software will not open on any computer.", ["Who calls the vendor support line?", "What is the paper fallback for the next hour?"]),
      T(15, "The vendor says their service is down and gives no time for a fix.", ["At what point do you restore from your own backup instead?", "Who tells clients about delays?"]),
      T(30, "The system comes back but today's entries are missing.", ["How are they re-entered and checked?", "What do you log to improve next time?"])],
    fraud: [
      T(0, "Finance notices a payment of a large invoice to an account that does not match the supplier's usual details.", ["Who calls the bank fraud line, right now?", "Which messages are kept as evidence?"]),
      T(10, "The request came by email from what looked like the supplier's address.", ["Was an email account taken over? Whose?", "Who calls the supplier on a number you already had?"]),
      T(20, "The bank says it may be able to recall the money if reported fast.", ["Who files the law enforcement report?", "What two-person check would have stopped this?"])],
    vendor: [
      T(0, "Your software vendor emails: they had a breach and some customer data may be affected.", ["Who asks them which of your systems and data are involved?", "Who is the incident lead told?"]),
      T(15, "The vendor held logins to your systems for support.", ["Which passwords or keys do you change?", "What does the contract say about their notice promise?"]),
      T(30, "Clients start asking whether their data is safe.", ["Who answers, and with what words?", "Do you keep the vendor? Who decides and records why?"])]
  };

  var ORG_TYPES = ["Clinic or health practice", "School", "Small business", "Congregation", "Non-profit or charity", "Library or town office", "Other"];
  var DEVICE_TYPES = ["Laptop", "Desktop", "Phone", "Tablet", "Server", "Router or firewall", "Wi-Fi access point", "Printer or scanner", "Camera or smart device", "Other"];
  var MFA = [{ v: "", l: "Not recorded" }, { v: "strong", l: "Security key or passkey (phishing-resistant)" }, { v: "app", l: "Authenticator app or push" }, { v: "sms", l: "Text message or call" }, { v: "none", l: "None" }];
  var YESNO = [{ v: "", l: "Not recorded" }, { v: "yes", l: "Yes" }, { v: "no", l: "No" }];
  var WHERE = ["Cloud service", "Offsite", "Offline drive or tape", "Same building", "Other"];
  var EVIDENCE_KINDS = ["Policy or procedure", "Screenshot of a setting", "Contract or vendor letter", "Training record", "Drill or test report", "Review or assessment report", "Photo", "Other"];
  var CONTACT_KINDS = ["IT contractor or provider", "Cyber insurer hotline", "Bank fraud line", "Internet or phone provider", "Software vendor", "Legal or privacy adviser", "Police non-emergency", "Regulator or authority", "Other"];
  var DRILL_TYPES = [{ v: "restore", l: "Backup restore test" }, { v: "tree", l: "Phone-tree call-out" }, { v: "tabletop", l: "Tabletop exercise" }];
  var RESULTS = [{ v: "ok", l: "Worked" }, { v: "partial", l: "Partly worked" }, { v: "failed", l: "Failed" }];
  var LEVELS = [{ v: "1", l: "Low" }, { v: "2", l: "Medium" }, { v: "3", l: "High" }];

  /* ---- example organisation (made up), so buyers can look around before typing their own ---- */
  function example(V) {
    var t = V.todayStr(), d = function (n) { return V.addDays(t, n); }, id = V.uid, x = V.emptyData("Example: Riverside Family Clinic");
    var lead = id(), dep = id(), s3 = id(), s4 = id(), s5 = id(), b1 = id(), b2 = id(), b3 = id();
    x.example = true; x.settings.lastBackup = d(-12);
    x.org = { name: "Example: Riverside Family Clinic", type: "Clinic or health practice", staffCount: "9", preset: "covenant", lead: "Dana Ruiz (practice manager)", deputy: "Sam Okafor (office lead)", address: "Made-up address, for illustration" };
    x.devices = [
      { id: id(), name: "Front desk PC", type: "Desktop", user: "Reception", os: "Windows 11", encrypted: "yes", autoUpdate: "yes", sensitive: "yes", checked: d(-20), notes: "" },
      { id: id(), name: "Dr. Lee laptop", type: "Laptop", user: "Dr. Lee", os: "macOS 15", encrypted: "yes", autoUpdate: "yes", sensitive: "yes", checked: d(-20), notes: "" },
      { id: id(), name: "Billing laptop", type: "Laptop", user: "Billing", os: "Windows 10", encrypted: "", autoUpdate: "no", sensitive: "yes", checked: d(-95), notes: "Due for replacement" },
      { id: id(), name: "Check-in tablet", type: "Tablet", user: "Reception", os: "iPadOS 18", encrypted: "yes", autoUpdate: "yes", sensitive: "no", checked: d(-20), notes: "" },
      { id: id(), name: "Clinic router", type: "Router or firewall", user: "IT contractor", os: "Vendor firmware", encrypted: "", autoUpdate: "", sensitive: "no", checked: d(-200), notes: "Default password changed when installed" },
      { id: id(), name: "Copier and scanner", type: "Printer or scanner", user: "All staff", os: "Vendor firmware", encrypted: "no", autoUpdate: "no", sensitive: "yes", checked: d(-200), notes: "Stores scans on its own disk" }];
    x.accounts = [
      { id: id(), name: "Clinic email (admin)", purpose: "Email for all staff", owner: "Dana Ruiz", mfa: "app", shared: "no", notes: "" },
      { id: id(), name: "Practice management system", purpose: "Schedules, charts and billing", owner: "Dana Ruiz", mfa: "sms", shared: "no", notes: "Vendor-hosted" },
      { id: id(), name: "Online banking", purpose: "Payroll and payments", owner: "Practice owner", mfa: "strong", shared: "no", notes: "" },
      { id: id(), name: "Website and domain name", purpose: "Public website", owner: "Sam Okafor", mfa: "none", shared: "no", notes: "Renews each spring" },
      { id: id(), name: "Front desk shared login", purpose: "Check-in kiosk", owner: "Sam Okafor", mfa: "none", shared: "yes", notes: "Replace with named accounts" }];
    x.backups = [
      { id: b1, name: "Practice system (vendor backup)", what: "Charts, schedules, billing", where: "Cloud service", frequency: "Daily", offline: "no", owner: "Vendor", retention: "30 days", notes: "Ask vendor for a test restore" },
      { id: b2, name: "Shared drive to USB disk", what: "Scanned forms, policies, spreadsheets", where: "Offline drive or tape", frequency: "Weekly", offline: "yes", owner: "Sam Okafor", retention: "8 weeks", notes: "Disk kept in the locked cabinet" },
      { id: b3, name: "Email archive", what: "Staff mailboxes", where: "Cloud service", frequency: "Continuous", offline: "no", owner: "IT contractor", retention: "1 year", notes: "" }];
    x.datasets = [
      { id: id(), name: "Patient charts", kind: "ePHI", where: "Practice management system", access: "Clinicians, billing", shared: "Secure portal, fax to specialists", notes: "" },
      { id: id(), name: "Scanned intake forms", kind: "ePHI", where: "Front desk PC, Copier and scanner, shared drive", access: "Reception", shared: "Not shared", notes: "Move into the practice system" },
      { id: id(), name: "Staff payroll", kind: "Staff records", where: "Billing laptop, accountant portal", access: "Practice owner", shared: "Accountant", notes: "" }];
    x.staff = [
      { id: lead, name: "Dana Ruiz", role: "Practice manager (security lead)", phone: "555-0101", alt: "555-0111", email: "", start: d(-1400), calledBy: "lead" },
      { id: dep, name: "Sam Okafor", role: "Office lead (deputy)", phone: "555-0102", alt: "", email: "", start: d(-900), calledBy: lead },
      { id: s3, name: "Dr. Jordan Lee", role: "Physician", phone: "555-0103", alt: "", email: "", start: d(-2000), calledBy: lead },
      { id: s4, name: "Priya Shah", role: "Billing", phone: "555-0104", alt: "", email: "", start: d(-300), calledBy: dep },
      { id: s5, name: "Leo Martin", role: "Reception", phone: "555-0105", alt: "", email: "", start: d(-40), calledBy: dep }];
    x.contacts = [
      { id: id(), org: "Example IT Services", kind: "IT contractor or provider", phone: "555-0150", ref: "Support contract 2291", notes: "24/7 line" },
      { id: id(), org: "Example Mutual (cyber policy)", kind: "Cyber insurer hotline", phone: "555-0160", ref: "Policy EX-4410", notes: "Call before hiring anyone" },
      { id: id(), org: "Example Community Bank", kind: "Bank fraud line", phone: "555-0170", ref: "", notes: "" },
      { id: id(), org: "Example Health Software", kind: "Software vendor", phone: "555-0180", ref: "Customer 77-1203", notes: "Breach notice within 5 days per contract" }];
    x.services = [
      { id: id(), name: "Scheduling and charts", order: "1", maxHours: "4", backup: b1, owner: "Dana Ruiz", fallback: "Printed day sheets and paper encounter forms" },
      { id: id(), name: "Phones", order: "2", maxHours: "2", owner: "Sam Okafor", fallback: "Forward the main line to the office mobile" },
      { id: id(), name: "Email", order: "3", maxHours: "24", backup: b3, restoreHours: "3", owner: "Sam Okafor", fallback: "Phone and the staff text group" },
      { id: id(), name: "Billing", order: "4", maxHours: "72", owner: "Priya Shah", fallback: "Paper log; enter later" }];
    x.runbook = { scenarios: ["ransomware", "email", "device", "outage", "fraud"], paperCopy: "Red binder in the practice manager's office", meeting: "Staff room, or the coffee shop next door if the building is closed", altChannel: "Staff text group" };
    x.drills = [
      { id: id(), type: "restore", date: d(-200), backup: b2, what: "Restored the policies folder to a spare laptop", minutes: "25", result: "ok", issues: "", followup: "", by: "Sam Okafor" },
      { id: id(), type: "restore", date: d(-410), backup: b1, what: "Vendor restored last week's schedule to a test copy", minutes: "180", result: "partial", issues: "Took longer than expected", followup: "Ask the vendor for a written restore time", by: "Dana Ruiz" },
      { id: id(), type: "tree", date: d(-60), backup: "", what: "Phone-tree call-out at 7 am", minutes: "18", result: "ok", issues: "One number out of date", followup: "Updated Leo's number", by: "Dana Ruiz" }];
    x.risks = [
      { id: id(), threat: "Ransomware", weakness: "Billing laptop on Windows 10 without automatic updates", asset: "Billing laptop, shared drive", measures: "Weekly offline backup", likelihood: "3", impact: "3", action: "Replace the billing laptop", owner: "Dana Ruiz", due: d(30), status: "open" },
      { id: id(), threat: "Email account takeover", weakness: "Practice system uses text-message codes", asset: "Practice management system", measures: "Multifactor sign-in by text", likelihood: "2", impact: "3", action: "Switch to the authenticator app", owner: "Sam Okafor", due: d(14), status: "open" },
      { id: id(), threat: "Lost or stolen device", weakness: "Copier disk keeps scans", asset: "Copier and scanner", measures: "Locked office", likelihood: "1", impact: "2", action: "Ask the copier lessor to wipe the disk on return", owner: "Sam Okafor", due: d(90), status: "open" },
      { id: id(), threat: "Vendor outage", weakness: "No written restore time from the vendor", asset: "Scheduling and charts", measures: "Paper day sheets", likelihood: "2", impact: "2", action: "Get the restore time in writing", owner: "Dana Ruiz", due: d(45), status: "open" }];
    var done = ["gv-owner", "gv-policy", "id-devices", "id-accounts", "id-data", "pr-defaults", "pr-encrypt", "pr-backups", "pr-wifi", "de-malware", "rs-plan", "rs-comms", "rs-insurance", "rc-order", "rc-paper"];
    var doing = ["gv-risks", "gv-vendors", "id-patch", "pr-mfa", "pr-training", "pr-passwords", "rc-restore", "pr-supported"];
    done.forEach(function (k) { x.checks[k] = { status: "done", date: d(-30), owner: "Dana Ruiz", note: "" }; });
    doing.forEach(function (k) { x.checks[k] = { status: "doing", date: d(-10), owner: "Sam Okafor", note: "" }; });
    x.checks["id-report"] = { status: "na", date: d(-30), owner: "", note: "No public systems beyond the vendor-hosted website" };
    x.evidence = [
      { id: id(), title: "Security policy, version 2 (signed)", kind: "Policy or procedure", date: d(-30), checks: ["gv-policy", "gv-owner"], hipaa: ["h-measures", "h-docs"], notes: "Paper original in the red binder", file: null },
      { id: id(), title: "Vendor letter: breach notice within 5 days", kind: "Contract or vendor letter", date: d(-75), checks: ["gv-vendors"], hipaa: ["h-measures"], notes: "", file: null },
      { id: id(), title: "Restore test notes, USB backup", kind: "Drill or test report", date: d(-200), checks: ["rc-restore", "pr-backups"], hipaa: ["h-measures"], notes: "", file: null }];
    x.training = {};
    [lead, dep, s3].forEach(function (p) { x.training[p] = {}; LESSONS.forEach(function (l) { x.training[p][l.id] = d(-120); }); });
    x.training[s4] = { pressure: d(-200), payments: d(-200), codes: d(-200) };
    x.hipaa = { "h-scope": { status: "done", note: "" }, "h-data": { status: "doing", note: "Intake forms still on the front desk PC" }, "h-threats": { status: "doing", note: "" },
      "h-measures": { status: "doing", note: "" }, _review: { last: d(-330), next: d(35), by: "Dana Ruiz" } };
    x.vendors = [
      { id: id(), name: "Example Health Software", service: "Practice management system (vendor-hosted)", data: "yes", access: "yes", agreement: "signed", notice: "5", renew: d(140), reviewed: d(-75), contact: "Customer 77-1203, 555-0180", notes: "" },
      { id: id(), name: "Example IT Services", service: "IT support and the email archive", data: "yes", access: "yes", agreement: "pending", notice: "", renew: d(40), reviewed: d(-400), contact: "Support contract 2291, 555-0150", notes: "Agreement sent for signature" },
      { id: id(), name: "Example Copier Leasing", service: "Copier and scanner lease", data: "yes", access: "no", agreement: "none", notice: "", renew: d(-10), reviewed: "", contact: "", notes: "Copier disk stores scans" },
      { id: id(), name: "Example Shredding Co.", service: "Paper record shredding", data: "yes", access: "no", agreement: "signed", notice: "10", renew: d(300), reviewed: d(-60), contact: "", notes: "" }];
    x.history = [-300, -240, -180, -120, -75, -40, -14].map(function (n, i) { var pct = [8, 14, 22, 31, 38, 44, 49][i]; return { id: d(n), pct: pct, fns: { GV: pct + 6, ID: pct + 10, PR: pct - 4, DE: pct, RS: pct + 8, RC: pct - 8 } }; });
    x.evidence[0].every = "365"; x.evidence[1].every = "365"; x.evidence[1].due = d(-5); x.evidence[2].every = "365";
    x.incidents = [
      { id: id(), title: "Phishing email to reception", scenario: "email", status: "closed", opened: d(-48), closed: d(-47), lead: "Dana Ruiz", summary: "No password entered; sender blocked.",
        entries: [{ t: d(-48) + " 10:05", text: "Leo reported a fake parcel-delivery email asking to sign in.", by: "Leo Martin" },
          { t: d(-48) + " 10:12", text: "Checked sign-in logs: no new sign-ins. Blocked the sender and warned staff.", by: "Dana Ruiz" },
          { t: d(-47) + " 09:00", text: "Closed. Thanked Leo in the staff meeting.", by: "Dana Ruiz" }] }];
    x.drills.push({ id: id(), type: "tabletop", date: d(-150), backup: "", what: "Tabletop: Ransomware, or files suddenly locked or renamed", minutes: "45", result: "partial", issues: "Nobody knew where the insurer's number was", followup: "Added the insurer hotline to the runbook", by: "Dana Ruiz" });
    return x;
  }

  /* ---- UK Cyber Essentials view: a second way to look at the same checklist ----
     The five theme names are exactly as the UK National Cyber Security Centre's own page names them under
     "The 5 Cyber Essentials Technical Controls": https://www.ncsc.gov.uk/cyberessentials/overview (read 2026-11-22).
     Only the names come from that page. Each "plain" line is our own description, and "checks" is our own mapping of existing
     checklist items onto a theme (an item may sit under more than one). It is a self-check aid: not the scheme's question set. */
  function CE(id, name, plain, checks, gaps) { return { id: id, name: name, plain: plain, checks: checks, gaps: gaps }; }
  /* Reviewed 2026-11-22 against "Cyber Essentials: Requirements for IT Infrastructure v3.3" (NCSC, April 2026,
     https://www.ncsc.gov.uk/files/cyber-essentials-requirements-for-it-infrastructure-v3-3.pdf). "gaps" lists what that document
     asks for under the theme that no Baseline check covers; the view prints it as "Baseline does not check: ...". */
  var UKCE = { source: "ukce", url: "https://www.ncsc.gov.uk/cyberessentials/overview", checked: "2026-11-22",
    reqUrl: "https://www.ncsc.gov.uk/files/cyber-essentials-requirements-for-it-infrastructure-v3-3.pdf", reqVersion: "v3.3, April 2026", themes: [
    CE("ce-firewalls", "Firewalls", "A boundary between your network and the internet, set so that only the connections you need get through.",
      ["pr-internet", "pr-defaults"],
      ["a firewall switched on for every device or at the network boundary, including a software firewall on devices used on untrusted networks such as public Wi-Fi",
       "that every inbound firewall rule is approved by an authorised person and written down with its business need",
       "removing or disabling firewall rules that are no longer needed",
       "that unauthenticated inbound connections are blocked by default"]),
    CE("ce-config", "Secure configuration", "Computers and devices set up with only the software, accounts and features you need, and with no default passwords left in place.",
      ["pr-defaults", "pr-macros", "pr-approve"],
      ["removing or disabling unnecessary software, system utilities and network services",
       "removing or disabling unnecessary user accounts, such as guest accounts and unused administrator accounts",
       "device unlock controls: a password or PIN of at least 6 characters, with no more than 10 wrong guesses allowed",
       "that users are authenticated before they reach organisational data or services"]),
    CE("ce-updates", "Security update management", "Software and devices kept up to date so that known weaknesses are fixed, with nothing in use that no longer gets fixes.",
      ["id-patch", "pr-supported"],
      ["the 14-day limit for installing updates that fix critical or high-risk (CVSS 7 or above) weaknesses",
       "that automatic updates are switched on where possible",
       "that all software in use is licensed"]),
    CE("ce-access", "User access control", "Each person has their own account with only the access their work needs, and sign-ins are protected.",
      ["pr-unique", "pr-passwords", "pr-mfa", "pr-admin", "pr-least", "pr-leavers", "de-signins"],
      ["a process to create and approve user accounts",
       "disabling accounts after a defined period of inactivity",
       "technical enforcement of password quality: 12 characters or more, or 8 with a deny list of common passwords, or multi-factor sign-in",
       "limits on password guessing: throttling, or lock-out after no more than 10 wrong tries",
       "a process to change passwords promptly after a suspected compromise",
       "that every cloud service uses multi-factor sign-in, and the accounts third parties use to support you"]),
    CE("ce-malware", "Malware protection", "Protection on each device that stops known malicious software from running.",
      ["de-malware"],
      ["application allow-listing with code signing (the scheme's alternative to anti-malware): only approved, signed applications may run",
       "that anti-malware blocks malicious code and connections to malicious websites, not just that it is switched on",
       "protection on phones and tablets (the Baseline check names computers only)"])
  ] };

  root.BaselineContent = { UKCE: UKCE, SOURCES: SOURCES, FUNCTIONS: FUNCTIONS, CSF: CSF, CPG: CPG, CHECKLIST: CHECKLIST, STATUS: STATUS, LESSONS: LESSONS, QUIZ: QUIZ, HIPAA: HIPAA, SCENARIOS: SCENARIOS,
    ORG_TYPES: ORG_TYPES, DEVICE_TYPES: DEVICE_TYPES, MFA: MFA, YESNO: YESNO, WHERE: WHERE, EVIDENCE_KINDS: EVIDENCE_KINDS, CONTACT_KINDS: CONTACT_KINDS,
    DRILL_TYPES: DRILL_TYPES, RESULTS: RESULTS, LEVELS: LEVELS, AGREEMENT: AGREEMENT, EVERY: EVERY, INCIDENT_STATUS: INCIDENT_STATUS, TABLETOP: TABLETOP, example: example };
  if (typeof module !== "undefined" && module.exports) module.exports = root.BaselineContent;
})(typeof globalThis !== "undefined" ? globalThis : this);
