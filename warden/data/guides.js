/* Stark Warden: plain-language guides. General information, not legal advice. Federal US rules as of the date on data/rights.js.
   A guide with `checks` is also a scored checklist. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  SW.data = SW.data || {};

  function H(h, p, ul) { var b = { h: h }; if (p) { b.p = p; } if (ul) { b.ul = ul; } return b; }
  function G(id, cat, title, summary, blocks, cites, extra) {
    var g = { id: id, cat: cat, title: title, summary: summary, blocks: blocks, cites: cites || [] };
    if (extra) { Object.keys(extra).forEach(function (k) { g[k] = extra[k]; }); }
    return g;
  }
  function C(items) { return items.map(function (x) { return { t: x[0], w: x[1] || 1 }; }); }

  SW.data.guideCats = [
    { id: 'debt', label: 'Debt collectors' }, { id: 'court', label: 'Court and money seized' }, { id: 'medical', label: 'Medical bills' },
    { id: 'student', label: 'Loans' }, { id: 'credit', label: 'Credit reports' }, { id: 'scams', label: 'Scam guides' }, { id: 'life', label: 'Everyday money' }
  ];

  SW.data.guides = [
    /* ---------- DEBT ---------- */
    G('fdcpa', 'debt', 'Who the debt collection law covers', 'The FDCPA and Regulation F protect you from third-party debt collectors.', [
      H('The basics', 'The Fair Debt Collection Practices Act (FDCPA, 15 U.S.C. 1692 and following) and its rule, Regulation F (12 CFR Part 1006, in effect since November 30, 2021), set the rules for how debt collectors may contact you.'),
      H('Who is covered', null, ['Debt collection companies and debt buyers who collect other people’s debts, and lawyers who regularly collect consumer debts.', 'Consumer debts: personal, family or household debts such as credit cards, medical bills, auto loans and personal loans.', 'Not usually covered: the original creditor collecting its own debt, and business debts. Your state may have laws that cover them (for example California’s Rosenthal Act).']),
      H('Your core rights', null, ['A written validation notice with the debt details.', '30 days to dispute the debt and ask for verification.', 'Limits on when, where and how often a collector may call.', 'The right to tell a collector in writing to stop contacting you.', 'Protection from harassment, false statements and unfair practices.']),
      H('Be careful', 'None of this makes a debt disappear. These rules govern how collectors behave, and whether the debt is valid is a separate question.')
    ], ['15 U.S.C. 1692a', '12 CFR 1006.2']),

    G('validation', 'debt', 'The validation notice and your 30-day window', 'What a collector must send you, and how the 30-day dispute clock works.', [
      H('What the notice must contain', 'A collector must give you validation information in its first communication, or send it within five days after. Regulation F’s model notice (Appendix B) is the usual form.', ['The collector’s name and mailing address, your name, and the creditor’s name.', 'An itemization date and the amount owed on that date, then an itemization of interest, fees, payments and credits since.', 'The current amount owed.', 'The date the validation period ends, how to dispute and how to ask for the original creditor’s name.', 'A reference to the CFPB’s website for more information.']),
      H('The validation period', 'It lasts 30 days from when you receive the notice. Regulation F lets the collector assume you received it five business days after it was sent (weekends and legal public holidays do not count). Use the Deadlines tab to estimate the dates; the end date printed on your notice is the one to follow.'),
      H('Disputing', 'A written dispute, or a written request for the original creditor’s name, sent before the validation period ends obliges the collector to stop collecting until it mails you verification. Send it by certified mail with a return receipt and keep a copy. You can still dispute after the period, but the pause is not guaranteed.'),
      H('Do not', null, ['Do not ignore the notice because you think the debt is old or wrong.', 'Do not promise to pay or give bank details to a caller before you have the notice and have checked it.'])
    ], ['15 U.S.C. 1692g', '12 CFR 1006.34', '12 CFR 1006.38']),

    G('calls', 'debt', 'Call limits, times and places', 'When and how often a collector may call.', [
      H('Time of day', 'A collector may not contact you before 8 a.m. or after 9 p.m. in your local time, unless you agree.'),
      H('How often (Regulation F)', null, ['A collector is presumed to be harassing you if it calls more than seven times in seven consecutive days about one debt.', 'It is also presumed to be harassing you if it calls within seven days after it had a phone conversation with you about that debt.', 'These are presumptions: a collector can try to show it was not harassment, but it carries the burden. A voicemail counts as a call attempt.']),
      H('Where', 'A collector may not contact you at work if it knows or has reason to know your employer prohibits it, and you can tell it your workplace is off limits.'),
      H('Texts and emails', 'Regulation F allows email and text only with clear ways to opt out, and bans contact through your employer’s email and through public social media posts. You can tell a collector to stop using a channel.'),
      H('What to do', 'Use the Contact Log to record every call and message. The log flags patterns that match these limits so you can show them to a regulator or attorney.')
    ], ['15 U.S.C. 1692c(a)', '12 CFR 1006.6', '12 CFR 1006.14']),

    G('cease', 'debt', 'Telling a collector to stop contacting you', 'How a written cease-communication request works, and its trade-offs.', [
      H('What it does', 'Once the collector receives your written request, it must stop communicating with you about the debt, except to confirm it will stop, to tell you it may use a specific remedy, or to say it intends to use one (such as filing a lawsuit).'),
      H('Trade-offs', null, ['It does not cancel or erase the debt.', 'The creditor or collector can still sue, and sometimes does after the contact stops.', 'If you want to dispute or negotiate, do that first or in the same letter.']),
      H('How', 'Use the cease-contact letter in Letters. Send by certified mail, return receipt requested, and write down the date delivered. Use the log: contact after that date is flagged.'),
      H('Short of stopping everything', 'You can instead limit the hours, the workplace, or a channel such as text, using the limit-contact letter.')
    ], ['15 U.S.C. 1692c(c)', '12 CFR 1006.6(c)']),

    G('conduct', 'debt', 'What debt collectors may not do', 'Harassment, lies, threats and unfair practices.', [
      H('Harassment and abuse (1692d)', null, ['Threats of violence or harm.', 'Obscene or profane language.', 'Publishing lists of people who do not pay.', 'Calling repeatedly or continuously to annoy, or calling without saying who is calling.']),
      H('False or misleading statements (1692e)', null, ['Saying you will be arrested or jailed for not paying a consumer debt.', 'Pretending to be a lawyer, court or government agency.', 'Misstating the amount or the legal status of the debt.', 'Threatening legal action that is not intended or not possible.', 'Failing to say, in later contacts, that it is a debt collector.']),
      H('Unfair practices (1692f)', null, ['Adding fees or interest that the agreement or the law does not allow.', 'Depositing a post-dated check early, or threatening to.', 'Putting anything on an envelope that shows it is about a debt (other than the collector’s name).']),
      H('Third parties (1692b and 1692c(b))', 'A collector may contact other people only to find out where you are, may not say you owe a debt, and generally may contact the same person only once.'),
      H('If it is a scam', 'Demands for gift cards, wire transfers or crypto, or threats of arrest over the phone, are signs of a fake collector. See the Scam checks.')
    ], ['15 U.S.C. 1692b to 1692f', '12 CFR 1006.18', '12 CFR 1006.22']),

    G('timebarred', 'debt', 'Time-barred ("zombie") debt', 'An old debt may be too old to sue on, but it is not gone.', [
      H('What it means', 'Every state sets a statute of limitations, a deadline for a creditor to sue. After it passes, the debt is time-barred. The deadline depends on your state and the type of debt, and it is commonly three to ten years. Use the Time limits tab.'),
      H('What collectors can and cannot do', null, ['They may still ask you to pay.', 'They cannot sue or threaten to sue on a time-barred debt they know or should know is time-barred (12 CFR 1006.26(b)).', 'Credit reporting follows a separate seven-year clock (see the credit guides).']),
      H('The trap: restarting the clock', 'In many states a partial payment, even a small one, or a written acknowledgement or a new promise to pay can restart the clock and make the debt suable again. Do not pay or sign anything on an old debt before you have checked.'),
      H('If you are sued anyway', 'The time limit is a defense you must raise in your answer to the court. If you ignore the lawsuit you can lose by default. See the judgment checklist.')
    ], ['12 CFR 1006.26', 'State statutes of limitations']),

    G('zombie', 'debt', 'Zombie debt and re-aging', 'Spotting old, resold or re-dated debts.', [
      H('Warning signs', null, ['You do not recognise the creditor or the collector.', 'The debt is old (past your state’s limit) but a collector is acting urgently.', 'The balance is higher than the original amount with unexplained fees.', 'It has been sold more than once and the new owner cannot show how it got the account.', 'The “date of first delinquency” keeps moving later across credit reports and letters.']),
      H('Re-aging', 'Re-aging means a debt appears newer than it is, for example by resetting the date of first delinquency, which can keep it on your credit reports longer. The reporting clock runs from the original first missed payment and a sale does not restart it. Compare your three bureau reports and the collector’s papers; the Debt dashboard compares the dates for you.'),
      H('What to do', null, ['Send a dispute and validation letter, or the chain-of-title letter for a debt buyer.', 'Dispute wrong dates with the bureaus and with the furnisher.', 'Check the statute of limitations before you pay anything.', 'Complain to the CFPB and your state attorney general if dates were changed.'])
    ], ['15 U.S.C. 1681c(c)', '15 U.S.C. 1692e(8)']),

    G('remedies', 'debt', 'If a collector breaks the law: your remedies and damages', 'You can sue, and many attorneys take these cases without upfront fees.', [
      H('What the law lets you recover', 'Under 15 U.S.C. 1692k you may recover your actual damages (for example money lost, emotional distress in many courts), plus statutory damages of up to $1,000 per lawsuit, plus the costs of the case and reasonable attorney’s fees. The fee-shifting rule is why many consumer attorneys take FDCPA cases with no upfront cost to you. A court may also award damages in a class action.'),
      H('Deadline', 'A lawsuit generally must be filed within one year from the date of the violation. Check the date of each violation in your log.'),
      H('How to find an attorney', null, ['The National Association of Consumer Advocates keeps a directory (consumeradvocates.org/find-an-attorney).', 'Free help: your local legal aid program (lsc.gov, lawhelp.org), your state bar referral service, and law school clinics.', 'Ask: “Do you take FDCPA cases on a contingency or fee-shifting basis, so I owe nothing upfront?”']),
      H('Complaints', 'A complaint to the CFPB, the FTC and your state attorney general costs nothing and creates a record, but it does not get you damages. Use the complaint generator with your log.'),
      H('Honesty note', 'No result is guaranteed. Whether a violation happened and what it is worth depends on the facts and the court.')
    ], ['15 U.S.C. 1692k']),

    G('scripts', 'debt', 'What to say, and never say, on a collector call', 'A short script library.', [
      H('You can say', null, ['“Please send me written validation of this debt. I do not agree this is my debt.”', '“I will not discuss the debt by phone. Please contact me in writing.”', '“What is your company name, mailing address and collection license number?”', '“I do not consent to being recorded” (check your state’s recording law first).', '“Please do not call me at work.”']),
      H('Never say or do', null, ['Never give bank account, card or Social Security numbers to an inbound caller you did not verify.', 'Never say “I will pay” or agree to a payment plan on a debt you have not verified.', 'Never say “that is my debt” if you are not sure: it can be used as an acknowledgement.', 'Never pay by gift card, wire or crypto, and never give a post-dated check.']),
      H('After the call', 'Write down the date, time, number, name and what was said in the Contact Log within minutes, while it is fresh.')
    ], []),

    G('recording', 'debt', 'Recording calls: one-party and all-party states', 'Why your state’s law decides whether you may record.', [
      H('The rule', 'Federal law lets you record a call you are part of if one party (you) consents. Several states require everyone on the call to agree (“all-party consent”). If the call crosses state lines, follow the stricter rule. Use the table below for your state.'),
      H('Safe approach', 'If you are unsure, say at the start, “I am recording this call. Do you consent?” If they refuse, hang up and keep written notes. Never post recordings publicly without advice.'),
      H('Debt collectors', 'Collectors often record calls too. You can ask the collector, in writing, to send recordings of calls about your account; there is no federal right to them, so a lawyer may need to request them.')
    ], ['18 U.S.C. 2511(2)(d)', 'State wiretap statutes']),

    G('garnish', 'court', 'Wage garnishment and bank levy: what is protected', 'Exempt income, federal limits and Social Security protection.', [
      H('Only after a judgment', 'Most private creditors need a court judgment before they can garnish your wages or freeze your bank account. Federal student loan, tax and child support debts follow different rules.'),
      H('Wage garnishment limit', 'Federal law caps garnishment for most consumer debts at the lesser of 25% of your disposable weekly earnings or the amount by which they exceed 30 times the federal minimum wage. Your state may protect more. The Calculators tab has a quick estimate.'),
      H('Protected money', null, ['Social Security, SSI, VA benefits, railroad retirement and certain other federal benefits are generally protected from private creditors.', 'Banks must review direct-deposited federal benefits and protect, automatically, an amount equal to the last two months of them (31 CFR Part 212).', 'Keep federal benefits in a separate account so they stay traceable.']),
      H('What to do if it happens', null, ['Read the notice: it has a deadline to claim exemptions.', 'File the exemption claim form with the court quickly and attach proof of benefits.', 'Call legal aid. Wrongful garnishment is common and often reversible.'])
    ], ['15 U.S.C. 1673', '31 CFR Part 212']),

    G('judgment', 'court', 'I have been sued or have a judgment: response checklist', 'Do not ignore a summons.', [
      H('Why it matters', 'If you do not respond by the deadline on the summons, the court can enter a default judgment. A judgment can lead to garnishment or a bank levy.'),
      H('First steps', null, ['Find the response deadline on the summons (often 20 to 30 days, set by your state and court).', 'Confirm the court is real: look it up yourself and call the clerk using a number you find independently. Fake lawsuit threats exist.', 'Contact legal aid or a consumer attorney quickly.', 'Write an answer: deny what you can, and raise defenses such as the statute of limitations, that you do not owe it, or that the plaintiff cannot prove it owns the debt. A defense you do not raise can be lost.', 'Go to every hearing. Bring your log and letters.']),
      H('If there is already a judgment', 'Ask a lawyer or legal aid about a motion to vacate a default judgment, exemptions, and payment arrangements. Interest on judgments can be high.')
    ], ['State court rules']),
    { id: 'judgment-checks', cat: 'court', hidden: true },

    G('smallclaims', 'court', 'Small claims court preparation', 'If you decide to sue a collector or creditor yourself.', [
      H('Where', 'FDCPA claims can be filed in federal court or in state court. Small claims has limits on the amount; the federal statutory damages cap of $1,000 usually fits within them. Some courts and attorneys may advise otherwise.'),
      H('Prepare', null, ['The log, evidence packet and all letters, certified mail receipts, voicemail transcripts and call recordings.', 'A one-page timeline with dates.', 'The rule each event broke.', 'Your damages: money lost, time off work, and a statement of distress.']),
      H('Court dates', 'Use the Court dates log to remember hearings and add them to your calendar export.')
    ], ['15 U.S.C. 1692k']),

    G('repo', 'court', 'Car repossession', 'What a lender can and cannot do.', [
      H('Basics', 'In many states a lender can repossess after default without going to court, but it cannot “breach the peace” (for example by breaking into a locked garage or using threats). State law decides the details.'),
      H('Your rights vary but often include', null, ['Notice before the car is sold, and a chance to get it back by paying what you owe (redeem).', 'Return of personal property inside.', 'A sale that is commercially reasonable, with credit for the sale price.', 'You may still owe a “deficiency” if the sale does not cover the loan.', 'Servicemembers have extra protection under the Servicemembers Civil Relief Act.']),
      H('What to do', null, ['Call the lender before you miss a payment and ask about deferral or modification.', 'If repossessed, read the notice, ask for the sale date, and call legal aid or your attorney general.'])
    ], ['UCC Article 9', 'State law']),

    G('payday', 'student', 'Payday and title loans: rights summary', 'High-cost loans and what protects you.', [
      H('The risks', 'Payday and title loans carry very high effective interest rates and short terms. A title loan can cost you the car.'),
      H('Protections', null, ['Many states cap rates or ban payday loans. Your state regulator or attorney general knows your state’s rules.', 'The Military Lending Act caps the cost of most loans to active-duty servicemembers and dependents at 36% (military annual percentage rate).', 'Under the CFPB’s payday rule, after two failed withdrawal attempts a lender generally must get your new authorization before trying again.', 'You can revoke permission for automatic withdrawals by telling your bank and the lender in writing.']),
      H('Alternatives', 'Ask for an extended payment plan, a payday alternative loan from a credit union, or nonprofit credit counseling (NFCC).')
    ], ['12 CFR Part 1041', '10 U.S.C. 987']),

    G('studentloans', 'student', 'Federal student loans: your options', 'Repayment plans, forgiveness and default.', [
      H('Check the date', 'Federal student loan rules changed in 2025 and may change again. Confirm every plan name and deadline on studentaid.gov.'),
      H('If you are struggling', null, ['Ask your loan servicer about income-driven repayment (IDR), which sets payments based on income and family size, and about deferment or forbearance.', 'Public Service Loan Forgiveness (PSLF) can forgive Direct loans after 120 qualifying payments while working for an eligible employer.', 'Stay out of default: it can lead to wage garnishment and offset of tax refunds and benefits.']),
      H('If you are in default', 'Rehabilitation and consolidation are ways out. Use only studentaid.gov or your servicer. Companies that charge an upfront fee to “forgive” or “lower” federal loans are a common scam.')
    ], ['20 U.S.C. 1070 and following', 'studentaid.gov']),

    G('bankruptcy', 'court', 'Bankruptcy basics', 'What it is and why to talk to an attorney.', [
      H('Overview', 'Bankruptcy is a federal court process that can stop collection and discharge many debts. Chapter 7 liquidates non-exempt assets and discharges eligible debts; Chapter 13 sets a three-to-five-year repayment plan.'),
      H('Costs and effects', null, ['It stays on your credit report for up to seven or ten years depending on the chapter.', 'Some debts are not discharged (many student loans, child support, most recent taxes).', 'Credit counseling from an approved agency is required before filing.']),
      H('Next step', 'This is a decision to make with a bankruptcy attorney or a legal aid clinic. Many offer a free first consultation. Stark Warden cannot tell you whether it is right for you.')
    ], ['11 U.S.C.']),

    G('counseling', 'student', 'Nonprofit credit counseling and debt management plans', 'A safer starting point than debt-relief companies.', [
      H('What it is', 'Nonprofit credit counselors (for example NFCC member agencies) review your budget for free or a small fee and may offer a debt management plan (DMP) that consolidates payments at lower rates.'),
      H('Checks', null, ['Look for a nonprofit with certified counselors and a clear fee list.', 'Be wary of anyone who charges big upfront fees, promises to wipe out debt, or tells you to stop paying and talk to no one.', 'For telemarketed debt relief, the FTC rule bans charging fees before a debt is settled.']),
      H('Next steps', 'Use the Hardship plan tab to prepare your budget before you call.')
    ], ['16 CFR 310.4(a)(5)']),

    G('cancelled', 'court', 'Cancelled debt and the tax form 1099-C', 'When a settled or forgiven debt can create tax.', [
      H('The form', 'When a creditor cancels $600 or more, it generally must send Form 1099-C. Cancelled debt can count as taxable income.'),
      H('Exceptions', 'There are exclusions, for example for debt cancelled in bankruptcy or when you were insolvent (your debts exceeded your assets) at the time. Form 982 is used to claim these. Details change.'),
      H('Smaller amounts', 'Even without a 1099-C, cancelled debt may still be reportable income. Ask a tax professional before you settle for a large discount, and plan for the tax.')
    ], ['26 U.S.C. 61(a)(11)', 'IRS Form 982']),

    /* ---------- MEDICAL ---------- */
    G('medaudit', 'medical', 'Auditing a medical bill', 'Check the bill before you pay it.', [
      H('Steps', null, ['Ask for an itemized bill with billing codes, and your insurer’s explanation of benefits (EOB).', 'Compare dates, services, duplicates and quantities. Check the insurer paid and adjusted correctly.', 'Ask for a billing hold while you review: it is reasonable to ask a provider not to send the account to collections.', 'Ask if you qualify for financial assistance (charity care) and for the policy in writing.', 'Ask for the “prompt-pay” or self-pay discount and for a no-interest payment plan.', 'Appeal denied insurance claims; you have internal and external review rights.']),
      H('Use the letters', 'Letters has an itemized-bill request and a financial assistance request.')
    ], ['45 CFR 164.524']),

    G('nosurprises', 'medical', 'No Surprises Act', 'Federal protection from some surprise out-of-network bills.', [
      H('What it covers', null, ['Emergency care, even at an out-of-network hospital, is billed at in-network cost-sharing.', 'Out-of-network providers at in-network facilities (for example an anesthesiologist) generally cannot balance-bill you without your informed consent.', 'Air ambulance services.', 'If you are uninsured or self-pay, providers must give a good-faith estimate of costs before scheduled care, and you can dispute a bill that is far above it.']),
      H('What to do', 'If you get a bill that looks like a surprise bill, ask your insurer and provider whether the Act applies, and file a complaint with the federal No Surprises Help Desk (cms.gov/nosurprises) if it does and they are billing you.'),
      H('Limits', 'Ground ambulances are generally not covered by the federal Act; some states cover them.')
    ], ['42 U.S.C. 300gg-111', '45 CFR 149']),

    G('medreport', 'medical', 'Medical debt and your credit reports', 'What the credit bureaus say they report.', [
      H('Bureau policies', 'As of the date on this page, Equifax, Experian and TransUnion say they do not include paid medical collections, wait a year before listing unpaid medical collections, and do not list medical collections under $500. These are voluntary policies, not federal law, and they can change.'),
      H('The federal rule', 'In January 2025 the CFPB finalized a rule to bar most medical debt from credit reports; a federal court set it aside in July 2025. Some states have their own laws. Check the current status at consumerfinance.gov.'),
      H('Act', 'If you see a medical collection that appears to break the bureau policies, dispute it with the bureau (Letters, Credit reports).')
    ], ['15 U.S.C. 1681c(a)(4)', '15 U.S.C. 1681i']),

    /* ---------- CREDIT ---------- */
    G('creditread', 'credit', 'Reading your credit report', 'What each section tells you and where errors hide.', [
      H('Get it free', 'You can get free reports from all three bureaus at AnnualCreditReport.com (copy the address into your browser). Weekly free reports have been available since 2020. Do not use look-alike sites.'),
      H('Sections', null, ['Personal information: old addresses and name variants. Remove ones that are not yours.', 'Accounts (tradelines): lender, open date, balance, limit, status, payment history.', 'Collections: who, original creditor, amount, date opened, date of first delinquency.', 'Public records: bankruptcies (judgments are no longer on reports).', 'Inquiries: hard pulls from lenders. Dispute ones you did not authorize.']),
      H('Compare the three', 'The bureaus do not share data, so errors differ. Compare dates and balances between them.')
    ], ['15 U.S.C. 1681j']),

    G('errorfinder', 'credit', 'Credit report error finder', 'Tick what you see to build a dispute list.', [
      H('How to use it', 'Go through your report and tick anything that applies. Each tick is something to dispute.')
    ], ['15 U.S.C. 1681i'], { checks: C([
      ['An account I do not recognize', 3], ['The same debt listed twice (original creditor and a collector both showing a balance)', 3], ['A balance higher than I owe', 2],
      ['A paid account still showing a balance', 2], ['A late payment I did not make', 2], ['An account that belongs to someone with a similar name or SSN', 3],
      ['A date of first delinquency that is later than it should be (re-aged)', 3], ['A collection older than seven years and 180 days from first delinquency', 3],
      ['A paid medical collection or a medical collection under $500', 2], ['An inquiry I did not authorize', 1], ['An address or employer that is not mine', 1], ['A closed account shown as open', 1]]),
      verdicts: { low: 'Nothing ticked yet.', mid: 'You found items worth disputing. Use the credit letters and keep copies.', high: 'Several errors. Dispute each with the bureau and with the furnisher, and keep proof.' } }),

    G('freeze', 'credit', 'Credit freeze and fraud alert', 'The strongest, free protection after identity theft.', [
      H('Freeze', 'A credit freeze stops most new accounts from being opened in your name. Federal law makes freezes free. You must place one at each bureau (Equifax, Experian, TransUnion). You can lift or thaw it temporarily when you apply for credit. Keep your PINs somewhere safe.'),
      H('Fraud alert', 'An initial fraud alert lasts one year and asks lenders to verify your identity. It is free and placing one at one bureau should pass it to the others. An extended alert (seven years) needs an Identity Theft Report. Servicemembers can get an active-duty alert.'),
      H('Each bureau', null, ['Equifax: equifax.com (search "freeze" if the page has moved).', 'Experian: experian.com/freeze', 'TransUnion: transunion.com/credit-freeze']),
      H('Also', 'Freeze your children’s credit too: minors can have freezes placed by a parent or guardian.')
    ], ['15 U.S.C. 1681c-1', '15 U.S.C. 1681c-2']),

    G('idtheft', 'credit', 'Identity theft affidavit helper', 'Prepare what you need for IdentityTheft.gov.', [
      H('Before you start', 'IdentityTheft.gov (copy the address into your browser) walks you through reporting and creates an Identity Theft Report and sample letters. Gather the facts first.')
    ], ['15 U.S.C. 1681c-2'], { checks: C([
      ['The date I noticed the problem', 1], ['A list of accounts or charges that are not mine, with amounts and dates', 1], ['The names of the companies involved and any reference numbers', 1],
      ['How I think my information was stolen, if I know', 1], ['My credit reports, saved or printed', 1], ['Copies of collection letters or bills', 1], ['A police report number (some companies ask for one)', 1],
      ['My credit freezes or fraud alerts placed', 1]]), verdicts: { low: 'Gather the items above.', mid: 'Getting there.', high: 'You are ready to start at IdentityTheft.gov.' } }),

    G('scoreFactors', 'credit', 'What affects a credit score', 'The main factors, in rough order.', [
      H('FICO-style factors', null, ['Payment history (about 35%): paying on time matters most.', 'Amounts owed (about 30%): keep credit card use low compared with limits.', 'Length of history (about 15%).', 'New credit (about 10%): many applications in a short time can lower it.', 'Credit mix (about 10%).']),
      H('Honesty note', 'The exact formulas are private and differ between scoring models. Be wary of anyone promising a specific score increase.')
    ], []),

    G('buildcredit', 'credit', 'Secured cards and credit-builder loans', 'Ways to rebuild, and what to avoid.', [
      H('Options', null, ['Secured credit card: you put down a deposit that becomes your limit. Use it lightly and pay it in full.', 'Credit-builder loan: payments are held in a savings account and returned at the end, and reported to bureaus.', 'Becoming an authorized user on a trusted person’s card.', 'Check that the lender reports to all three bureaus.']),
      H('Avoid', 'Upfront “credit repair” fees (the Credit Repair Organizations Act bars charging before the work is done), CPNs (a “new credit identity” is fraud), and promises to delete accurate negative items.')
    ], ['15 U.S.C. 1679b']),

    /* ---------- SCAM GUIDES ---------- */
    G('romance', 'scams', 'Romance scam timeline analyzer', 'Tick what has happened to see how it compares.', [
      H('Why this exists', 'Romance scammers follow a script. The order of events matters more than any one sign.')
    ], ['FTC consumer.ftc.gov/scams'], { checks: C([
      ['We met online or by a wrong-number text', 1], ['They moved us to WhatsApp, Telegram or another private app very fast', 2], ['They said they love me within days or weeks', 2],
      ['They cannot meet or do a live video call; there is always an excuse', 3], ['They work far away (oil rig, military, overseas)', 2], ['They had a sudden emergency (medical bill, customs, travel)', 2],
      ['They asked for money, gift cards, crypto, or to move money for them', 5], ['They suggested a special investment or trading platform', 4], ['They asked me to keep it secret from family or my bank', 3], ['I sent money and they asked for more', 4]]),
      verdicts: { low: 'Few signs so far, but be careful if money comes up.', mid: 'Several classic romance-scam signs. Do not send money. Talk to a friend you trust.', high: 'This matches a romance scam closely. Stop sending money, keep the messages, and report it.' } }),

    G('pig', 'scams', 'Crypto and "pig butchering" warning signs', 'Long-con investment scams that start as friendship.', [
      H('How it works', 'A stranger builds trust over weeks, then shows a "winning" crypto or trading app. Early small withdrawals work. Then you are pushed to invest much more, and cannot withdraw without a "tax" or "fee."')
    ], ['FTC consumer.ftc.gov/scams'], { checks: C([
      ['A stranger started a friendly chat from a "wrong number" or social media', 2], ['They mention their own investment success', 2], ['The platform is not a well-known regulated exchange, or is an app link they sent', 4],
      ['It promises high returns with little risk', 3], ['I was able to withdraw a small amount, then they said to put in more', 3], ['A fee or tax is required before I can withdraw', 5], ['They say it is urgent and spots are limited', 2], ['They asked me to buy crypto and send it to a wallet', 4]]),
      verdicts: { low: 'Not enough yet to judge. Never invest because a new contact pushed you to.', mid: 'Strong signs of an investment scam. Do not send more.', high: 'This is the standard pattern of pig butchering. Stop, keep records, and report.' } }),

    G('elder', 'scams', 'Protecting an older relative', 'What helps, and who to call.', [
      H('Why older adults are targeted', 'Scammers use fear, urgency and isolation. Anyone can be fooled; it is not a sign of weakness.'),
      H('What helps', null, ['Agree a family safe word to use if anyone calls claiming to be a relative in trouble.', 'Set the rule: always call a trusted person before paying anyone, anywhere.', 'Use Family mode here for a big-text checker.', 'Consider a credit freeze, a trusted contact on bank accounts, and alerts for large transfers.', 'Speak without blame if money has gone.']),
      H('Help', 'The National Elder Fraud Hotline (1-833-372-8311, run by the U.S. Department of Justice) helps with reporting. Report at ReportFraud.ftc.gov and IC3.gov and your state adult protective services where there is exploitation.')
    ], []),

    G('grandparent', 'scams', 'Grandparent and "family emergency" scam script', 'What the scammer says and how to respond.', [
      H('The script', 'A call or text: "Grandma, it is me, I am in trouble. Please do not tell Mom." A second voice then poses as a lawyer or police officer and asks for bail money, often in gift cards, cash couriers or crypto.'),
      H('What to do', null, ['Hang up. Call the relative on the number you already have, or another family member.', 'Ask a question only the real person can answer, or use the family safe word.', 'Do not send money, gift cards or cash to a courier.', 'Real police and courts do not take bail by gift card.'])
    ], []),

    G('popup', 'scams', 'Tech-support pop-ups and calls', 'What to do when a warning says your computer is infected.', [
      H('The rule', 'Real security warnings do not include a phone number to call. Microsoft, Apple and others do not call you out of the blue.'),
      H('If a pop-up appears', null, ['Do not call the number or click anything in the pop-up.', 'Close the browser with Ctrl+Alt+Delete (Task Manager) or force quit on a Mac. If it comes back, restart and do not restore the tabs.', 'If you already called and gave remote access, use the "I let someone control my computer" checklist.']),
      H('Refund scam variation', 'A "support" person says they refunded you too much and asks you to send the difference. They have faked a bank screen. They took nothing from the bank: they took your money.')
    ], []),

    G('invoice', 'scams', 'Fake invoice and refund scams', 'Surprise charge emails and texts with a number to call.', [
      H('Signs', null, ['A charge or renewal you did not make, with a phone number to call "to cancel".', 'An attachment or link instead of the order details you can check in your account.', 'A caller who wants remote access to "process the refund".', 'Asks you to pay a refund back by gift card or transfer.']),
      H('Do', 'Check your real account or statement. If the charge is not there, it is a scam. Use the message checker (it has an invoice mode) to see the warning signs.')
    ], []),

    G('debtrelief', 'scams', 'Debt-relief and credit-repair scams', 'Nobody can promise to erase your debt.', [
      H('Be wary of', null, ['Upfront fees, especially for debt settlement or credit repair sold by phone (the FTC Telemarketing Sales Rule bans advance fees for debt relief by phone).', 'Promises to erase, wipe out or forgive your debts, or settle “for pennies”.', 'Telling you to stop paying and stop talking to creditors.', 'Guaranteed results.', 'A “new credit identity” (CPN): that is fraud.', 'Student loan “forgiveness” programs that charge a fee: free help is at studentaid.gov.']),
      H('Safer', 'Nonprofit credit counseling (NFCC), your own letters (free here), legal aid, and a bankruptcy attorney if debts are overwhelming.')
    ], ['16 CFR 310.4(a)(5)']),

    G('fakecollector', 'scams', 'Fake debt collector detector', 'Tick what the caller said.', [
      H('Why this matters', 'Fake collectors call about debts you do not owe, or never took. Real collectors have to send a validation notice and cannot threaten arrest.')
    ], ['FTC consumer.ftc.gov'], { checks: C([
      ['They demand gift cards, a wire, crypto, or a payment app transfer', 5], ['They threaten arrest, jail, or a sheriff coming to my house', 4], ['They will not send anything in writing', 4],
      ['They will not tell me the company name, address or the original creditor', 3], ['They refuse a validation request', 3], ['They want my SSN, bank login or card number by phone', 3],
      ['I do not recognize the debt or the company', 2], ['It is about a payday loan I never took', 3], ['They insist I pay today', 2], ['They say they are a lawyer or government agent', 2], ['The caller ID shows a government number', 1]]),
      verdicts: { low: 'Few signs. Still ask for written validation before paying.', mid: 'Signs of a fake or abusive collector. Do not pay. Ask for validation in writing.', high: 'Very likely a scam. Hang up, do not pay or give details, and report it.' } }),

    G('job', 'scams', 'Job scam checklist', 'Tick what the "employer" did.', [H('Rule of thumb', 'A real employer never needs you to pay or to receive money to start.')], [], { checks: C([
      ['They contacted me first and the pay is high for the work', 2], ['No interview, or the interview is only on a chat app', 3], ['They want me to deposit a check and buy equipment or gift cards', 5], ['They ask me to pay for training, equipment or background checks', 4],
      ['They ask for my SSN or ID before an offer', 3], ['They want me to receive and forward packages or move money', 5], ['The company name does not match its email or I cannot find real info', 2], ['They push me to decide fast', 2]]),
      verdicts: { low: 'Not enough signs to judge. Check the company independently.', mid: 'Warning signs. Do not send money or ID.', high: 'This looks like a job scam. Stop and report it.' } }),

    G('rental', 'scams', 'Rental scam checklist', 'Before you pay a deposit.', [H('Rule of thumb', 'Never pay a deposit before you see the unit and meet the person who can prove they own or manage it.')], [], { checks: C([
      ['The price is far below similar places', 3], ['The “owner” is out of the country or cannot meet', 4], ['They want a deposit by Zelle, wire, gift card or crypto before a viewing', 5], ['They copied photos from another listing', 3],
      ['They pressure me because “others are interested”', 2], ['They ask for my SSN or bank login to “apply”', 3], ['They will mail the keys after payment', 4]]),
      verdicts: { low: 'Few signs. Still view in person.', mid: 'Warning signs. Do not pay yet.', high: 'This matches a rental scam. Do not pay.' } }),

    G('marketplace', 'scams', 'Marketplace buyer and seller scam checklist', 'Buying or selling online.', [H('Rule of thumb', 'Meet in a public place, use the platform’s payment, and never send codes.')], [], { checks: C([
      ['The buyer sends a code and asks me to read it back', 5], ['The buyer pays more than the price and asks for the difference', 5], ['The seller wants payment outside the platform', 3], ['The seller will not meet or video call', 2],
      ['The price is far below normal', 2], ['The payment email looks real but comes from a strange address', 3], ['A “shipper” or courier is sent to collect', 3]]),
      verdicts: { low: 'Few signs.', mid: 'Warning signs. Use the platform’s protection.', high: 'This matches a common marketplace scam.' } }),

    G('charity', 'scams', 'Charity verifier checklist', 'Before you donate.', [H('Rule of thumb', 'Search for the charity yourself, and give through its own website, not through a link or a caller.')], [], { checks: C([
      ['It contacted me after a disaster with an urgent plea', 2], ['They only accept gift cards, crypto or wire transfers', 5], ['They will not say how the money is used or give an EIN', 3], ['The name looks like a famous charity, but is different', 3],
      ['I cannot find it on Charity Navigator or IRS tax-exempt search', 3], ['They thank me for a pledge I never made', 3], ['They want my bank account or card details by phone', 3]]),
      verdicts: { low: 'Few signs. Still give through the charity’s own website.', mid: 'Warning signs. Do not give.', high: 'This looks like a fake charity.' } }),

    /* ---------- LIFE ---------- */
    G('negotiate', 'life', 'Negotiating bills: scripts', 'Internet, phone, medical and more.', [
      H('Method', null, ['Call during business hours and ask for the retention or billing-resolution team.', 'Be polite and specific. Ask what is the best price you can get.', 'Mention competitor prices and how long you have been a customer.', 'Ask for the offer in writing and the date it ends.']),
      H('Lines that work', null, ['“I want to keep my service, but I need to bring the bill down to $X. What can you do?”', '“Is there a promotion for existing customers?”', '“I can pay $X a month on this bill. Can we set that up with no interest?”', '“Please send this agreement in writing before I pay.”'])
    ], []),

    G('docs', 'life', 'Document checklist', 'What to keep for debt, credit and scam problems.', [
      H('Keep together', 'A folder, paper or digital, for each debt or problem.')
    ], [], { checks: C([
      ['Government ID and Social Security card (stored safely)', 1], ['Recent credit reports from all three bureaus', 1], ['Last 12 months of bank and card statements', 1], ['All letters from collectors, with envelopes', 1],
      ['Certified mail receipts and return-receipt cards', 1], ['A call log with dates and times', 1], ['Written settlement or payment agreements', 1], ['Proof of payment for everything you paid', 1], ['Insurance and medical bills with EOBs', 1], ['Last two years of tax returns', 1]]),
      verdicts: { low: 'Start gathering what you can.', mid: 'Good progress.', high: 'You have a strong paper trail.' } })
  ].filter(function (g) { return !g.hidden; });
})(typeof window !== 'undefined' ? window : globalThis);
