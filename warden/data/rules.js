/* Stark Warden: scam-message rules. Each rule has plain-words text, a weight, and one or more regex groups;
   a rule fires when EVERY group has at least one match. These are red-flag patterns, not proof. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  SW.data = SW.data || {};

  function R(id, cat, weight, title, why, groups, extra) {
    var r = { id: id, cat: cat, weight: weight, title: title, why: why, groups: groups };
    if (extra) { Object.keys(extra).forEach(function (k) { r[k] = extra[k]; }); }
    return r;
  }

  SW.data.rules = [
    R('urgency', 'pressure', 2, 'Pressure to act right now',
      'Scammers rush you so you do not have time to think or check. Real organisations give you time and a way to verify.',
      [[/\b(?:urgent(?:ly)?|immediate(?:ly)?|right away|right now|asap|act (?:now|fast|today)|last (?:chance|warning|notice)|final (?:notice|warning|reminder|attempt)|time[- ]sensitive|expires? (?:today|tonight|soon|in \d+)|within (?:the next )?\d+\s*(?:hours?|hrs?|minutes?|mins?)|before (?:midnight|it(?:'|’)s too late)|do not delay|don(?:'|’)?t delay|failure to (?:respond|comply|act|pay))\b/i]]),

    R('threat', 'pressure', 3, 'Threats of arrest, lawsuits or shut-off',
      'Government agencies and honest collectors do not threaten arrest over a text, call or email. Threats are used to make you panic and pay.',
      [[/\b(?:arrest(?:ed)?|warrant for|lawsuit|sue you|legal action|criminal (?:charges?|investigation|complaint)|prosecut\w+|jail|deport\w*|police (?:will|are|have|officers)|will be (?:suspended|blocked|locked|frozen|closed|terminated|disabled|deactivated|cancel(?:l)?ed|seized|garnished)|seiz(?:e|ed|ure) (?:of )?your|(?:wage )?garnishment|your (?:ssn|social security number) (?:has|will|was) (?:been )?(?:suspended|blocked|compromised|linked))\b/i]]),

    R('account_alert', 'pressure', 1, 'Alarm about your account',
      'Messages claiming your account is locked, limited or compromised are the most common phishing opening. Check by opening the app or typing the company address yourself.',
      [[/\b(?:(?:has|have|had) been (?:suspended|locked|limited|restricted|compromised|flagged|disabled|blocked)|(?:account|card) (?:on hold|limited|restricted|locked|suspended)|unusual (?:sign[- ]?in|login|activity)|suspicious (?:sign[- ]?in|login|activity|transaction)|unauthori[sz]ed (?:charge|purchase|transaction|login|access|order)|payment (?:declined|failed|could not be (?:processed|completed))|billing (?:problem|issue))\b/i]]),

    R('giftcard', 'payment', 5, 'Asks for gift cards',
      'Nobody legitimate (no bank, agency, utility, employer or collector) takes payment in gift cards. This is the surest sign of a scam.',
      [[/\b(?:buy|purchase|get|pick up|load|scratch|send|read|give|photograph|take a (?:photo|picture))\b[^.\n]{0,60}\b(?:gift ?cards?|itunes|google play|steam cards?|prepaid cards?|vanilla (?:visa|card))\b/i,
        /\b(?:gift ?cards?|itunes|google play|steam|prepaid)\b[^.\n]{0,60}\b(?:codes?|numbers?|pins?|back of (?:the|each) card|photos?|pictures?)\b/i,
        /\b(?:pay|payment|paid)\b[^.\n]{0,30}\bgift ?cards?/i]]),

    R('crypto_atm', 'payment', 5, 'Bitcoin ATM or crypto deposit demand',
      'Crypto payments cannot be reversed. Real agencies and companies never ask you to deposit cash into a bitcoin ATM.',
      [[/\b(?:bitcoin|crypto(?:currency)?) (?:atm|machine|kiosk)s?\b/i, /\b(?:coinflip|bitcoin depot|athena bitcoin|bitstop|rockitcoin|crypto dispensers?)\b/i]]),

    R('crypto', 'payment', 3, 'Asks for crypto',
      'Requests to pay, send or "invest" in crypto are a favourite of scammers because the money is nearly impossible to get back.',
      [[/\b(?:bitcoin|btc|ethereum|usdt|tether|crypto(?:currency)?|wallet address|stablecoin)\b/i], [/\b(?:send|transfer|deposit|pay|payment|invest|buy|convert|wire|withdraw|scan)\b/i]]),

    R('untraceable', 'payment', 2, 'Hard-to-reverse payment method',
      'Wire transfers, money orders, cash apps and cashier’s checks are hard to undo. Scammers prefer them for that reason.',
      [[/\b(?:wire (?:transfer|the money|funds)|western union|moneygram|money gram|zelle|cash ?app|venmo|cashier(?:'|’)?s check|money order)\b/i], [/\b(?:send|pay|payment|transfer|owe|fee|deposit)\b/i]]),

    R('impersonate_bank', 'impersonation', 2, 'Claims to be your bank or payment service',
      'Scammers copy bank and payment names. Do not use the phone number or link in the message; use the number on your card or the app you already have.',
      [[/\b(?:chase|wells ?fargo|bank of america|citi(?:bank)?|capital ?one|u\.?s\.? bank|truist|pnc|td bank|usaa|navy federal|american express|amex|discover (?:card|bank)|paypal|venmo|zelle|cash ?app|your bank|fraud (?:department|team|prevention))\b/i],
       [/\b(?:verify|confirm|update|unlock|restore|re-?activate|secure your|validate|log ?in|sign ?in|unusual|suspicious|unauthori[sz]ed|locked|suspended|limited)\b/i]]),

    R('impersonate_gov', 'impersonation', 3, 'Claims to be a government agency',
      'The IRS, Social Security, Medicare and the courts do not demand payment or details by text or by threatening phone calls. They write on paper first.',
      [[/\b(?:irs|internal revenue service|social security (?:administration|office)|ssa|medicare|medicaid|fbi|dea|homeland security|treasury|uscis|immigration|customs and border|dmv|department of (?:motor vehicles|justice|treasury)|sheriff(?:'|’)?s? office|federal (?:agent|government|reserve)|attorney general|irs agent|u\.?s\.? marshals?)\b/i],
       [/\b(?:owe|owed|back taxes|unpaid|penalt(?:y|ies)|suspend\w*|arrest\w*|warrant|refund|payment|verify|confirm|benefits|compromised|illegal|criminal|crimes?|laundering|drug|trafficking|identity theft|case number)\b/i]]),

    R('impersonate_delivery', 'impersonation', 3, 'Fake delivery problem',
      'Texts about a missed delivery, a held package or a small “redelivery fee” are one of the biggest scam waves. Check your order in the shop’s own app or website.',
      [[/\b(?:usps|ups|fedex|dhl|amazon|postal service|post office|courier|your (?:package|parcel|shipment|delivery|order))\b/i],
       [/\b(?:unable to deliver|undeliverable|failed (?:delivery|to deliver)|delivery (?:attempt|fee|issue|problem|failed)|(?:address (?:is )?(?:incomplete|invalid|incorrect|unconfirmed))|incomplete address|confirm (?:your )?address|update (?:your )?address|re-?schedule|redeliver\w*|customs (?:fee|charge)|redelivery fee|small fee|held (?:at|in)|on hold)\b/i]]),

    R('impersonate_tech', 'impersonation', 3, 'Fake tech support or fake invoice',
      'Real tech companies do not cold-call or pop up warnings with a phone number. “Your subscription renewed, call to cancel” is a known trap to get you onto the phone.',
      [[/\b(?:microsoft|windows|apple|norton|mcafee|geek ?squad|tech(?:nical)? support|support (?:team|agent|technician)|your (?:computer|pc|device|ip address|router))\b/i],
       [/\b(?:virus(?:es)?|malware|infected|hacked|hackers?|security (?:breach|alert|warning)|suspicious activity|trojan|expired (?:license|subscription)|(?:renewed|auto[- ]?renew\w*|invoice|order #?\w*|charged|billed|debited)\b[^.\n]{0,60}\$\s?\d{2,})\b/i,
        /(?:renewed|auto[- ]?renew\w*|invoice|charged|billed|debited)[^.\n]{0,60}\$\s?\d{2,}/i],
       [/\b(?:call|dial|phone|toll[- ]free|helpline|hotline|contact (?:us|support|our))\b/i]]),

    R('remote_access', 'credentials', 4, 'Asks for remote access to your device',
      'Letting a stranger control your computer lets them see your accounts and install spyware. Real support never starts by asking you to install a remote tool.',
      [[/\b(?:anydesk|teamviewer|ultraviewer|quick ?assist|logmein|screen ?connect|splashtop|ammyy|remote (?:access|desktop|control|session))\b/i]]),

    R('code_request', 'credentials', 5, 'Asks you to read out or send a code',
      'One-time codes are the keys to your accounts. Anyone who asks you to read one back is trying to break in as you.',
      [[/\b(?:send|share|reply with|reply|read (?:out|back|me|it)|tell|give|provide|forward|text)\b(?:\s+(?:me|us|him|her|them|back))?\s+(?:the|that|this|your|a|any|the 6[- ]digit)?\s*(?:\w+\s+){0,3}(?:code|otp|passcode)\b/i,
        /\b(?:code|otp)\b[^.\n]{0,40}\b(?:sent to (?:your )?(?:phone|number)|we (?:just )?sent|texted to you)\b[^.\n]{0,60}\b(?:read|send|share|tell|reply)\b/i,
        /\b(?:one[- ]time|verification|security|6[- ]digit|login)\s+(?:code|passcode)\b[^\n]{0,100}\b(?:read|tell|send|share|give)\b[^.\n]{0,20}\b(?:it|them|that|back)\b/i,
        /\b(?:sent|texted)\b[^.\n]{0,30}\bcode\b[^.\n]{0,20}\bby mistake\b/i]]),

    R('credentials', 'credentials', 4, 'Asks for passwords, PINs, card or ID numbers',
      'Real companies already have your details and never ask you to send passwords, PINs, full card numbers or your Social Security number by message.',
      [[/\b(?:send|provide|enter|confirm|verify|reply with|submit|update|re-?enter|share|give|tell|fill in)\b[^.\n]{0,50}?\b(?:password|passcode|login (?:details|credentials|info)|pin(?: number)?|ssn|social security (?:number|#)|card number|(?:credit|debit) card (?:number|details|info\w*)|cvv|cvc|routing number|bank account (?:number|details)|seed phrase|recovery phrase|private key|mother(?:'|’)?s maiden name)\b/i]]),

    R('prize', 'lure', 3, 'Prize, lottery or “you were selected”',
      'You cannot win a contest you did not enter. If you must pay a fee, tax or “shipping” to collect a prize, it is a scam.',
      [[/\b(?:you(?:'ve|’ve| have)? (?:been selected|won|are (?:a|the) winner)|congratulations|winner|lottery|sweepstakes|jackpot|prize|free (?:iphone|gift|cash|vacation)|claim (?:your|the) (?:prize|reward|gift|winnings|refund)|unclaimed|reward points? (?:expire|expiring))\b/i],
       [/\b(?:claim|click|fee|tax|shipping|processing|redeem|act|reply|respond|call|pay)\b/i]]),

    R('advance_fee', 'lure', 4, 'Pay a fee first to receive money',
      'Asking you to pay upfront to release a prize, loan, inheritance or package is “advance-fee fraud”. The money never arrives.',
      [[/\b(?:pay|send)\b[^.\n]{0,40}\b(?:fee|tax(?:es)?|shipping|processing|insurance|customs|clearance)\b[^.\n]{0,40}\b(?:claim|release|receive|collect|prize|winnings|package|inheritance|funds|loan)\b/i]]),

    R('windfall', 'lure', 3, 'Inheritance, “next of kin” or huge transfer',
      'Strangers do not hand out millions. This is a very old fraud that still works on people who are hopeful.',
      [[/\b(?:inheritance|next of kin|unclaimed (?:funds|estate)|beneficiary|million (?:dollars|usd|pounds)|barrister|late (?:husband|client|father)|transfer (?:of )?(?:funds|\$?\d+ ?million))\b/i]]),

    R('romance_hook', 'relationship', 2, 'Romance-style language from a stranger',
      'Fast affection, a faraway job (oil rig, military, overseas) and reasons you cannot meet or video call are common in romance scams.',
      [[/\b(?:my (?:dear|love|darling|beautiful|dearest)|sweetheart|beloved|dear (?:friend|beloved)|soul ?mate|god (?:brought|sent) you|i(?:'m| am) (?:a )?(?:widow(?:er)?|divorced|single (?:dad|mom|father|mother))|oil rig|offshore|deployed|stationed (?:overseas|abroad)|working (?:overseas|abroad)|military (?:engineer|doctor|general))\b/i]]),

    R('romance_money', 'relationship', 4, 'Someone you met online needs money',
      'A person you have not met in real life who asks for money, a ticket, a fee or gift cards is the heart of a romance scam, however real the feelings seem.',
      [[/\b(?:my (?:account|funds|money|card) (?:is|are|has|was)|i (?:need|am in need of|am asking|have an emergency|am stuck|am stranded)|help me|can you (?:send|help|lend|wire|transfer|buy)|lend me|plane ticket|flight ticket|customs fee|medical (?:bills?|emergency))\b/i],
       [/\b(?:send|wire|transfer|pay|loan|lend|money|funds|\$\d+|gift ?cards?|bitcoin|crypto|western union|moneygram|ticket|fee)\b/i]],
      { requires: ['romance_hook'] }),

    R('investment', 'lure', 4, 'Guaranteed returns or “easy money” investing',
      'Real investments always carry risk. Guaranteed profits, daily payouts, trading “mentors” and private groups are classic investment-fraud hooks.',
      [[/\b(?:guaranteed (?:returns?|profits?|income|payouts?)|risk[- ]free|no risk|double your (?:money|investment|bitcoin|crypto)|(?:daily|weekly|monthly) (?:profits?|returns?|payouts?|income)|\d{2,}% (?:return|profit|roi|per (?:day|week|month)|daily|weekly|monthly|guaranteed)|trading (?:signals?|bot|platform|expert|mentor|group)|insider (?:tip|info|trade)|get rich|financial freedom|passive income|crypto (?:mining|trading|investment)|investment (?:opportunity|manager|group)|limited (?:spots|slots|seats)|join (?:our|my|the) (?:whatsapp|telegram|vip) (?:group|channel)|fund manager|withdraw(?:al)? (?:fee|tax)|tax to (?:withdraw|release))\b/i]]),

    R('job', 'lure', 3, 'Too-good job offer',
      'Unrequested “work from home” offers with high pay, no experience and chat-app interviews are usually scams, often to move stolen money or collect your ID.',
      [[/\b(?:work from home|earn \$?\d[\d,]*\+? ?(?:per|a|\/|an) ?(?:day|hour|week|hr)|no experience (?:needed|necessary|required)|hiring (?:now|immediately|remote)|(?:package|parcel) (?:reshipping|forwarding)|mystery shopper|data entry (?:job|position)|(?:product|app) (?:rating|review) (?:job|task)|tasks? (?:platform|job)|personal assistant (?:job|position)|recruiter)\b/i],
       [/\b(?:whatsapp|telegram|text (?:me|us)|interview (?:via|on|through)|dm|reply (?:yes|interested)|apply|click|deposit|send)\b/i]]),

    R('fake_check', 'payment', 4, 'Check or overpayment, then send money back',
      'In a fake-check scam you deposit a check, send part of the money away, and the check bounces days later, leaving you owing the bank.',
      [[/\b(?:cashier(?:'|’)?s check|check|cheque|money order)\b[^.\n]{0,80}\b(?:deposit|cash|send back|send the (?:balance|difference|remaining)|keep \$?\d|wire (?:me|the)|(?:buy|purchase)\b[^.\n]{0,30}(?:gift|equipment|supplies))/i,
        /\b(?:overpa(?:id|yment)|sent (?:you )?too much|refund (?:the )?(?:difference|excess))\b/i,
        /\b(?:sent|paid|deposited)\b[^.\n]{0,25}\bby mistake\b[^\n]{0,60}\b(?:send|return|pay)\b[^.\n]{0,20}\bback\b/i]]),

    R('secrecy', 'pressure', 3, 'Told to keep it secret',
      'Scammers isolate you so no one can warn you. Real banks and agencies do not tell you to hide a payment from family or from your bank.',
      [[/\b(?:don(?:'|’)?t|do not|never|not) (?:tell|let|inform|alert|speak (?:to|with)|talk to|mention (?:this )?to)\b[^.\n]{0,40}\b(?:anyone|anybody|your (?:bank|family|wife|husband|kids|children|son|daughter|parents|friends)|the (?:bank|police|teller)|mom|dad|grandma|grandpa)\b/i,
        /\bkeep (?:this|it) (?:a )?(?:secret|confidential|between us|private|quiet)\b/i,
        /\b(?:tell|say) (?:the )?(?:bank|teller) (?:you|it)(?:'re| are| is|’re)?\b[^.\n]{0,30}\b(?:home|renovat\w+|family|friend|gift|personal|medical)\b/i]]),

    R('family_emergency', 'impersonation', 4, 'Relative in trouble needs money',
      '“Grandparent” and “it’s me, I got a new number” scams use fear for a loved one. Hang up and call the relative on the number you already have.',
      [[/\b(?:grandma|grandpa|grandmother|grandfather|nana|papa|mom|mum|dad|it(?:'|’)?s me|it is me|your (?:grandson|granddaughter|nephew|niece|son|daughter))\b/i],
       [/\b(?:in (?:jail|custody|trouble|the hospital)|arrested|accident|crash(?:ed)?|bail|lawyer|attorney|stranded|lost my (?:phone|wallet|passport)|new number)\b/i],
       [/\b(?:send|wire|pay|need|money|gift ?cards?|cash|bitcoin|\$\d+|help me)\b/i]]),

    R('new_number', 'impersonation', 3, '“Hi Mom, this is my new number”',
      'A message from an unknown number pretending to be your child or parent is the first step of a money scam.',
      [[/\bhi (?:mom|mum|dad)\b[^.\n]{0,60}\b(?:new number|lost my phone|phone (?:broke|died|got))\b/i, /\bthis is my new number\b/i]]),

    R('debt_relief', 'lure', 5, 'Promises to erase or wipe out debt',
      'Nobody can legally promise to erase your debt or settle it “for pennies”. Debt-relief sellers who charge upfront by phone break the FTC Telemarketing Sales Rule.',
      [[/\b(?:erase|eliminate|wipe out|forgive|cancel|get rid of|remove)\b[^.\n]{0,30}\b(?:your |all )?(?:debts?|loans?|balances?|student loans?|credit card debt)\b/i,
        /\bpennies on the dollar\b/i, /\bguaranteed (?:debt|credit) (?:relief|repair|settlement)\b/i,
        /\bremove (?:accurate|bad|negative)\b[^.\n]{0,20}\b(?:items?|information|marks?|accounts?)\b[^.\n]{0,20}\bcredit report\b/i,
        /\b(?:credit privacy number|cpn|new credit identity)\b/i,
        /\bstudent loan forgiveness\b[^.\n]{0,60}\b(?:program|fee|deadline|processing|apply now)\b/i]],
      { tags: ['debtrelief'] }),

    R('upfront_fee', 'lure', 4, 'Upfront fee for debt or credit help',
      'Charging before delivering results is banned for telephone debt-relief sales (16 CFR 310.4(a)(5)) and is a hallmark of credit-repair scams.',
      [[/\b(?:upfront|up-front|advance|enrollment|processing|retainer|activation|setup|set-up)\s+(?:fee|payment|deposit)\b/i, /\bpay (?:us )?(?:a |the )?(?:fee|deposit)\b[^.\n]{0,30}\b(?:first|today|now|before)\b/i],
       [/\b(?:debt|loan|credit|settle\w*|relief|forgiveness|repair|negotiat\w+|consolidat\w+)\b/i]],
      { tags: ['debtrelief'] }),

    R('fake_collector', 'impersonation', 3, 'Collector-style pressure to pay today',
      'Real collectors must send a written validation notice and cannot threaten arrest or demand gift cards. Pushing “pay now or face court” over a call is a known fake-collector script.',
      [[/\b(?:you (?:owe|have)|outstanding|past[- ]due|delinquent|unpaid)\b[^.\n]{0,60}\b(?:payday loan|loan|account|balance|debt|bill)\b/i],
       [/\b(?:pay (?:today|now|immediately)|settle (?:today|now)|(?:avoid|prevent) (?:a )?(?:lawsuit|legal action|court|garnishment|arrest)|final (?:attempt|opportunity)|process server|affidavit|case (?:number|file))\b/i]],
      { tags: ['collector'] }),

    R('refuse_validation', 'impersonation', 4, 'Refuses to put the debt in writing',
      'Under the FDCPA you can ask for written validation. A caller who refuses or says you “lose your rights” if you ask is not following the law.',
      [[/\b(?:won(?:'|’)?t|will not|cannot|can(?:'|’)?t|refuse to|no need to|not able to)\b[^.\n]{0,30}\b(?:send|mail|put)\b[^.\n]{0,25}\b(?:anything|it|proof|validation|documents?|paperwork|in writing)\b/i,
        /\bonly (?:pay|settle) (?:by|over) (?:the )?phone\b/i]],
      { tags: ['collector'] }),

    R('fake_charge', 'impersonation', 3, 'Fake charge or renewal, “call to cancel”',
      'A surprise charge, invoice or renewal with a phone number to call is the opening of a refund or tech-support scam. Check your real account statement instead.',
      [[/\b(?:unauthori[sz]ed (?:charge|purchase|transaction)|if (?:this|that) (?:was ?n(?:'|’)?t|was not|wasn(?:'|’)?t) you|did not (?:make|place|authori[sz]e)|didn(?:'|’)?t (?:make|place|authori[sz]e)|(?:auto[- ]?renew\w*|invoice|renewed)\b[^.\n]{0,60}\$\s?\d{2,}|receive a refund)/i],
       [/\b(?:call|phone|dial|contact)\b/i]],
      { tags: ['invoice'] }),

    R('toll_scam', 'impersonation', 3, 'Fake unpaid toll',
      'Texts about an unpaid toll or road-fee balance with a payment link are a current smishing wave. Check your tolling account directly.',
      [[/\b(?:e-?z ?pass|sunpass|fastrak|i-?pass|peach pass|toll(?:s)? (?:balance|violation|notice)|(?:unpaid|outstanding|overdue) tolls?)\b/i],
       [/\b(?:pay|balance|fee|penalt\w+|fine|violation|overdue|late fee)\b/i]]),

    R('rental', 'lure', 3, 'Landlord who is away asks for a deposit',
      'A “landlord” who is out of the country, will mail keys, and wants a deposit by app is a rental scam. Never pay before seeing the place and meeting the owner.',
      [[/\b(?:out of (?:the )?(?:country|town)|abroad|overseas|missionary|relocat\w+|traveling)\b/i],
       [/\b(?:deposit|first month|keys|hold the (?:unit|apartment|house|place)|application fee)\b/i]],
      { tags: ['invoice'] }),

    R('generic_greeting', 'other', 1, 'Generic greeting',
      'Companies that really have your account usually use your name. “Dear customer” is common in mass-sent scams.',
      [[/\b(?:dear (?:customer|user|member|client|account holder|valued (?:customer|member)|sir(?:\/| or )madam|friend|beneficiary|winner)|valued customer|account holder)\b/i]]),

    R('click_prompt', 'other', 1, 'Tells you to click or open something',
      'Be careful with links and attachments in unexpected messages. Open the official app or type the website address yourself.',
      [[/\b(?:click (?:on )?(?:the |this |here|below)|tap (?:the |this )?link|follow (?:the|this) link|use (?:the|this) link|open (?:the|this) (?:link|attachment)|log ?in (?:here|below|now)|sign ?in (?:here|below|now)|click here|see attached|open the attached)\b/i]]),

    R('callback', 'other', 1, 'Tells you to call a number in the message',
      'Do not call a number from a suspicious message. Look up the organisation’s real number yourself.',
      [[/\b(?:call|dial|text)\b[^.\n]{0,25}\b(?:this|the following|our|that) (?:number|line|toll[- ]free)\b/i, /\bcall (?:us |now )?(?:at|on) \(?\d{3}\)?/i,
        /\bcall\b[^.\n]{0,15}\b(?:1[- .]?)?\(?8\d\d\)?[-. ]?\d{3}[-. ]?\d{4}\b/i]])
  ];

  /* Phrases that are safety advice ("never share your code") are removed before matching so they are not mistaken for a request. */
  SW.data.adviceStrippers = [
    /\b(?:we|[a-z ]{2,30}) (?:will |would )?never (?:ask|call|text|email|request|contact|send)[^.\n]*/gi,
    /\b(?:never|do not|don(?:'|’)?t|please do not)\s+(?:share|give|provide|send|disclose|reveal|tell|read)\b[^.\n]*\b(?:code|otp|password|pin|passcode|credentials|details|number)\b[^.\n]*/gi,
    /\b(?:never|do not|don(?:'|’)?t)\s+(?:click|open|tap)\b[^.\n]*/gi
  ];
})(typeof window !== 'undefined' ? window : globalThis);
