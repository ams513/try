/* Stark Warden: sources, "if you were scammed" checklists, report template fields.
   Web addresses are plain text for you to copy. The app never opens or fetches them. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  SW.data = SW.data || {};

  SW.data.meta = {
    version: '2.2.0',
    asOf: '2026-11-20',
    asOfLabel: 'November 20, 2026',
    check: 'Check the date on this information. It was written from the federal rules in force when this version was built (see the date above) and was not re-checked against live websites. Laws, deadlines, dollar limits and agency practices change. Before you rely on any rule, confirm it with the official source listed on the Sources page, your state attorney general, legal aid, or a consumer-protection attorney.',
    notLegal: 'Stark Warden gives general information, not legal advice, and it is not a law firm or a credit counselor. Using it does not create a lawyer-client relationship. Rules differ by state and by facts. No tool can promise that a debt will go away, a score will rise, or a scam will be caught: be careful of anyone who promises those things.',
    scope: 'United States federal rules, with state data where the tool says so.'
  };

  function S(id, org, title, url, note) { return { id: id, org: org, title: title, url: url, note: note || '' }; }
  SW.data.sources = [
    S('cfpb-debt', 'CFPB', 'Debt collection: rights, sample letters and tools', 'consumerfinance.gov/consumer-tools/debt-collection/'),
    S('cfpb-complaint', 'CFPB', 'Submit a complaint about a debt collector or credit reporting problem', 'consumerfinance.gov/complaint/', 'The CFPB’s staffing and operations have been in flux. Also file with the FTC and your state attorney general.'),
    S('regf', 'eCFR', 'Regulation F, 12 CFR Part 1006 (current text)', 'ecfr.gov/current/title-12/chapter-X/part-1006'),
    S('fdcpa', 'U.S. Code', 'Fair Debt Collection Practices Act, 15 U.S.C. 1692 to 1692p', 'uscode.house.gov (search 15 U.S.C. 1692)'),
    S('ftc-report', 'FTC', 'Report fraud and scams', 'reportfraud.ftc.gov'),
    S('ftc-debt', 'FTC', 'Debt collection FAQs', 'consumer.ftc.gov/articles/debt-collection-faqs'),
    S('ftc-scams', 'FTC', 'Common scams and how to spot them', 'consumer.ftc.gov/scams'),
    S('ftc-id', 'FTC', 'Identity theft: report and recovery plan', 'identitytheft.gov'),
    S('ic3', 'FBI', 'Internet Crime Complaint Center (IC3)', 'ic3.gov'),
    S('naag', 'NAAG', 'Find your state attorney general', 'naag.org/find-my-ag/'),
    S('acr', 'Federal law', 'Free annual credit reports from Equifax, Experian and TransUnion', 'annualcreditreport.com'),
    S('studentaid', 'U.S. Dept. of Education', 'Federal student loan repayment, forgiveness and default help', 'studentaid.gov', 'Federal student loan rules changed in 2025 and may change again. Check this site for current plans.'),
    S('nfcc', 'NFCC', 'Nonprofit credit counseling (member agencies)', 'nfcc.org'),
    S('ust', 'U.S. Trustee Program', 'Approved credit counseling and debtor education agencies for bankruptcy', 'justice.gov/ust'),
    S('uscourts', 'U.S. Courts', 'Bankruptcy basics', 'uscourts.gov/court-programs/bankruptcy'),
    S('nmls', 'NMLS', 'Look up licensed lenders and some collectors', 'nmlsconsumeraccess.org', 'Collection licensing differs by state. Your state regulator or attorney general has the current list.'),
    S('dnc', 'FTC', 'National Do Not Call Registry', 'donotcall.gov'),
    S('fcc', 'FCC', 'Spoofing and robocall complaints', 'fcc.gov/spoofing'),
    S('irs982', 'IRS', 'Form 982 and cancelled debt (insolvency and other exclusions)', 'irs.gov/forms-pubs/about-form-982'),
    S('tigta', 'TIGTA', 'Report IRS impersonation', 'tigta.gov'),
    S('irs-scams', 'IRS', 'Tax scams: how the IRS contacts you and how to report a scam', 'irs.gov (search: tax scams how to report them)', 'The IRS usually mails a bill first and does not demand gift cards, wires or crypto.'),
    S('ftc-relief', 'FTC', 'Debt relief and credit repair scams', 'consumer.ftc.gov (search: debt relief scams)'),
    S('ssaoig', 'SSA OIG', 'Report Social Security scams', 'oig.ssa.gov'),
    S('irs-fap', 'IRS', 'Requirements for nonprofit hospitals, Section 501(r): financial assistance and billing', 'irs.gov (search: 501(r) hospitals)'),
    S('nsa', 'CMS', 'No Surprises Act: your rights and protections against surprise medical bills', 'cms.gov/nosurprises'),
    S('naca', 'NACA', 'Find a consumer-protection attorney (many take FDCPA cases with no upfront fee)', 'consumeradvocates.org/find-an-attorney'),
    S('lawhelp', 'LawHelp', 'Free legal help by state', 'lawhelp.org'),
    S('lsc', 'Legal Services Corporation', 'Find a legal aid program', 'lsc.gov/about-lsc/what-legal-aid/get-legal-help'),
    S('eq', 'Equifax', 'Credit freeze and fraud alert', 'equifax.com', 'If a page has moved, start at the company’s home page and search "freeze".'),
    S('ex', 'Experian', 'Credit freeze and fraud alert', 'experian.com/freeze'),
    S('tu', 'TransUnion', 'Credit freeze and fraud alert', 'transunion.com/credit-freeze'),
    S('ippin', 'IRS', 'Identity Protection PIN', 'irs.gov/ippin'),
    S('milone', 'Military OneSource', 'Military Lending Act and servicemember financial help', 'militaryonesource.mil')
  ];

  SW.data.phoneSources = [
    { n: '7726 (SPAM)', t: 'Forward scam text messages to your carrier at 7726.' },
    { n: 'reportphishing@apwg.org', t: 'Forward phishing emails to the Anti-Phishing Working Group.' },
    { n: '1-833-372-8311', t: 'National Elder Fraud Hotline (U.S. Department of Justice). Confirm the number at ic3.gov or ftc.gov before calling.' }
  ];

  function Step(t, d) { return { t: t, d: d || '' }; }
  SW.data.scammed = [
    { id: 'giftcard', title: 'I paid with gift cards', steps: [
      Step('Call the gift card company now.', 'Use the number on the back of the card or the company’s real website. Say it was used in a scam and give the card numbers. Acting within hours sometimes lets them freeze the balance.'),
      Step('Keep the cards, receipts and packaging.', 'Photograph them. The store receipt can help.'),
      Step('Tell the store where you bought them.', 'Some retailers can flag the cards or help with the report.'),
      Step('Report it at ReportFraud.ftc.gov.', 'Copy the address into your browser. Include the card company, amounts, and what the scammer said.'),
      Step('Stop all contact with the scammer.', 'Do not send “just one more” card to get your money back.'),
      Step('Tell someone you trust.', 'Shame keeps people quiet, and scammers count on it.')] },
    { id: 'bank', title: 'I sent a wire, Zelle, Cash App or a bank transfer', steps: [
      Step('Call your bank or the app right away.', 'Ask them to recall or reverse the transfer and to flag the recipient. Speed matters most in the first hours; recovery is not guaranteed.'),
      Step('Ask what protection you have.', 'Payments you authorized yourself are often not covered the way unauthorized ones are, but ask in case of fraud rules or error-resolution rights.'),
      Step('Change your online banking password and PIN.', 'Do it from a device you trust, and turn on two-step sign-in.'),
      Step('File a report at ReportFraud.ftc.gov and IC3.gov.', 'IC3 is the FBI’s internet-crime center. Copy the addresses into your browser.'),
      Step('File a police report.', 'Banks and some agencies ask for it, and it helps with identity-theft disputes.'),
      Step('Beware of “recovery” offers.', 'People who promise to get your money back for a fee are usually running a second scam.')] },
    { id: 'card', title: 'I gave my credit card number', steps: [
      Step('Call the card issuer (number on the back of the card).', 'Report the fraud, close the card, and ask for a new one.'),
      Step('Dispute the charges in writing.', 'Under the Fair Credit Billing Act you generally have 60 days from the statement date to dispute a billing error, and your liability for unauthorized card charges is limited to $50 by federal law (Truth in Lending / Regulation Z).'),
      Step('Check every recent statement.', 'Look for small test charges you do not recognise.'),
      Step('Watch for follow-up scams.', 'Scammers sometimes call again pretending to be the bank.')] },
    { id: 'debit', title: 'Someone took money from my debit card or bank account', steps: [
      Step('Call your bank now and report the unauthorized transfers.', 'Under Regulation E, reporting within two business days of learning about the loss caps your liability at $50. After that, up to $500, and after 60 days from the statement, it can be unlimited. Report fast.'),
      Step('Put a written dispute in after the phone call.', 'Keep the date, the name of who you spoke to, and a reference number.'),
      Step('Close the account or change the numbers.', 'Ask for a new account number and a new debit card.'),
      Step('Change passwords and turn on two-step sign-in.', '')] },
    { id: 'crypto', title: 'I sent crypto or used a bitcoin ATM', steps: [
      Step('Contact the exchange or ATM operator right away.', 'Report the wallet address and ask them to flag it. Crypto transfers are usually final, so recovery is uncommon, but fast reports sometimes help.'),
      Step('Report it at IC3.gov and ReportFraud.ftc.gov.', 'Include wallet addresses, transaction IDs, dates and amounts.'),
      Step('Do not send more to “unlock” or “release” the funds.', 'Fake withdrawal fees are part of the scam.'),
      Step('Ignore “recovery” services.', 'Offers to trace and recover your crypto for a fee are a common follow-up scam.')] },
    { id: 'password', title: 'I shared a password, a code, or clicked a bad link', steps: [
      Step('Change that password now, from a different, trusted device.', 'Then change any other account that used the same password.'),
      Step('Turn on two-step sign-in with an authenticator app, and sign out of all devices.', ''),
      Step('Check your email for forwarding rules and unknown sign-ins.', 'Scammers hide rules that forward your mail to themselves.'),
      Step('Tell your bank if you shared a banking code or login.', ''),
      Step('Run a security scan on the device you used.', ''),
      Step('Report phishing.', 'Forward phishing emails to reportphishing@apwg.org and scam texts to 7726.')] },
    { id: 'remote', title: 'I let someone control my computer', steps: [
      Step('Disconnect from the internet now.', 'Turn off Wi-Fi or unplug the cable.'),
      Step('Uninstall the remote tool (AnyDesk, TeamViewer, Quick Assist and similar) and restart.', ''),
      Step('From a different device, change your email, bank and other important passwords.', ''),
      Step('Call your bank and card issuers.', 'Tell them a stranger had access.'),
      Step('Consider a full security scan or reset, or ask a trusted local technician.', 'Do not use a number from a pop-up.'),
      Step('Place a credit freeze.', 'See the freeze checklist under Learn, Credit.')] },
    { id: 'identity', title: 'I shared my Social Security number or ID', steps: [
      Step('Go to IdentityTheft.gov for a personal recovery plan.', 'Copy the address into your browser. It creates an official Identity Theft Report and letters.'),
      Step('Freeze your credit at Equifax, Experian and TransUnion.', 'Freezes are free by federal law and stay until you lift them. Each bureau has its own page.'),
      Step('Consider a fraud alert.', 'An initial fraud alert lasts one year and is free; an extended alert lasts seven years with an Identity Theft Report.'),
      Step('Get your free credit reports and look for accounts you do not know.', 'AnnualCreditReport.com is the official source.'),
      Step('Ask the IRS for an Identity Protection PIN.', 'It helps prevent someone filing a false tax return in your name.'),
      Step('Report it to your state attorney general.', 'Find yours at naag.org/find-my-ag.')] },
    { id: 'romance', title: 'A romance or investment scam took my money', steps: [
      Step('Stop sending money and stop moving money for them.', 'Even if the feelings seem real, the demand for money is the scam.'),
      Step('Save every message, account number, wallet address and receipt.', ''),
      Step('Report to IC3.gov, ReportFraud.ftc.gov, and the app or site where you met.', ''),
      Step('Contact your bank and any crypto exchange you used.', ''),
      Step('Do not pay “recovery” fees.', ''),
      Step('Talk to someone.', 'These scams are designed by professionals. Support groups and a trusted friend help more than blame does.')] }
  ];

  SW.data.reportFields = [
    { id: 'whenFound', label: 'Date you realized it was a scam', type: 'date' },
    { id: 'how', label: 'How they contacted you (phone, text, email, social media, website, mail)' },
    { id: 'who', label: 'Scammer name, handle or company used' },
    { id: 'phone', label: 'Phone numbers' },
    { id: 'email', label: 'Email addresses, websites or usernames' },
    { id: 'story', label: 'What they said and asked you to do', type: 'textarea' },
    { id: 'method', label: 'How you paid or what you shared (gift cards, wire, app, crypto, card, codes, ID)' },
    { id: 'amount', label: 'Total amount lost', type: 'money' },
    { id: 'payDate', label: 'Date(s) of payment' },
    { id: 'recipient', label: 'Where the money went (account, wallet, card, app tag, transaction ID)' },
    { id: 'info', label: 'Personal information you shared (SSN, passwords, ID, card numbers)' },
    { id: 'done', label: 'What you have already done (bank called, card closed, police report)', type: 'textarea' },
    { id: 'reported', label: 'Agencies you have reported to' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
