/* Stark Warden 2.0: negotiation coach, medical debt shield, lawsuit-ready packet and identity-theft plan content.
   Every legal fact carries a citation; the date is SW.data.meta.asOf. General information, not legal advice. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  SW.data = SW.data || {};

  function F(t, cite, src) { return { t: t, cite: cite, src: src || [] }; }

  SW.data.negotiate = {
    stages: [
      { id: 'prepare', title: 'Before you talk', lines: [
        'Make sure the debt is yours and the amount is right. Ask for the written validation notice first.',
        'Check your state’s time limit. On an old debt, a payment or a promise to pay can restart the clock in many states.',
        'Know your number: the most you can truly pay without missing rent, food, utilities or the ride to work.',
        'Decide: one lump sum, or a monthly plan you can keep every month.',
        'Have a pen ready. Write down the name of everyone you speak to, and the date.'], say: [] },
      { id: 'open', title: 'Make your offer', lines: ['Many people start below their real limit, so they have room to move up.', 'Pauses are fine. You do not have to fill the silence.'], say: [
        '“I’m calling about account [number]. I can’t pay the full balance. I can offer $[amount] as a one-time payment to settle this account in full.”',
        '“I can pay $[amount] a month for [months] months. Can you accept that with no added interest or fees?”'] },
      { id: 'counter', title: 'When they push back', lines: ['Never give bank or card access on the call. Pay only after the written agreement arrives, by a method you control.', 'A deadline on the phone is pressure. A real offer can be put on paper.'], say: [
        '“That’s more than I can pay. My best offer is $[amount].”',
        '“Can you ask a supervisor whether they can approve this?”',
        '“I need to think about it. I’ll get back to you.”',
        '“I will only pay once I have this agreement in writing.”'] },
      { id: 'after', title: 'After you pay', lines: [
        'Keep the agreement and proof of payment for good. Old debts sometimes come back.',
        'Check your credit reports in 30 to 60 days. Dispute anything that does not match the agreement.',
        'If $600 or more is forgiven, you may get an IRS Form 1099-C, and you may owe tax on it unless an exception such as insolvency applies. Ask a tax helper.',
        'Add it to My wins. You earned it.'], say: [] }
    ],
    writing: [
      'The exact amount, and that it settles the account in full.',
      'Your name and the account or reference number.',
      'The payment date or dates, and how you will pay.',
      'The company’s name and address, signed by someone who can approve it.',
      'What they will report to the credit bureaus, for example “settled in full” or “paid in full.”',
      'That no one will try to collect the rest, and the rest will not be sold or passed on.',
      'You keep a copy, and you pay by a traceable method (never cash, gift cards or crypto).'],
    facts: [
      F('If a creditor forgives $600 or more of a debt, it generally must report it to the IRS on Form 1099-C. Insolvency and some other exceptions can make it non-taxable.', 'IRS Form 1099-C and Form 982; 26 U.S.C. 108', ['irs982']),
      F('No one can promise a settlement will be accepted or how it will appear on your credit report. Get it in writing before you pay.', 'General information', [])
    ]
  };

  SW.data.medical = {
    first: [
      'Do not pay a medical bill you have not checked. Errors are common.',
      'Ask for an itemized bill with billing codes, and compare it with your insurer’s explanation of benefits (EOB).',
      'Ask the provider to hold the bill (not send it to collections) while you review it or apply for help.',
      'Ask about financial assistance (charity care), a self-pay discount, and a no-interest payment plan.'],
    nsa: [
      F('Emergency care is billed at in-network cost-sharing, even at an out-of-network hospital.', 'No Surprises Act, 42 U.S.C. 300gg-111; 45 CFR Part 149', ['nsa']),
      F('Out-of-network providers at an in-network hospital generally cannot bill you for the balance without your written consent.', 'No Surprises Act, 45 CFR Part 149', ['nsa']),
      F('If you are uninsured or pay yourself, you can ask for a good-faith estimate before scheduled care. If the bill is at least $400 more than the estimate, you can dispute it within 120 days of getting the bill.', '45 CFR 149.610 and 149.620', ['nsa']),
      F('Ground ambulances are generally not covered by the federal law; some states cover them.', 'No Surprises Act; state law', ['nsa'])],
    charity: [
      F('Nonprofit hospitals must have a written financial assistance policy and make it easy to get.', '26 U.S.C. 501(r)(4)', ['irs-fap']),
      F('They must limit what they charge people who qualify for help.', '26 U.S.C. 501(r)(5)', ['irs-fap']),
      F('Before steps like credit reporting, selling the debt or suing, they must make reasonable efforts to find out if you qualify.', '26 U.S.C. 501(r)(6); 26 CFR 1.501(r)-6', ['irs-fap']),
      F('You can generally apply for at least 240 days after the first bill you get after leaving the hospital.', '26 CFR 1.501(r)-1 (application period)', ['irs-fap']),
      F('These rules cover nonprofit (tax-exempt) hospitals. Other hospitals and clinics may have their own programs, and some states add rules.', 'State law (varies)', [])],
    report: [
      F('Equifax, Experian and TransUnion say they do not include paid medical collections on credit reports.', 'Credit bureau policies (voluntary, announced 2022 and 2023)', ['eq', 'ex', 'tu']),
      F('They say an unpaid medical collection is not reported until it is a year old.', 'Credit bureau policies (voluntary)', ['eq', 'ex', 'tu']),
      F('They say medical collections under $500 are not reported.', 'Credit bureau policies (voluntary)', ['eq', 'ex', 'tu']),
      F('A federal rule to remove most medical debt from credit reports was finalized in January 2025 and then set aside by a federal court in July 2025.', 'CFPB rule (vacated)', ['cfpb-debt']),
      F('Some states have their own laws that limit medical debt on credit reports.', 'State law (varies)', [])],
    gather: ['Recent pay stubs, or a benefits or unemployment letter', 'Your most recent tax return, if you filed one', 'Bank statements, if they ask', 'The bill and your insurer’s explanation of benefits (EOB)', 'Proof of who lives in your household']
  };

  SW.data.sued = {
    steps: [
      'Find the deadline to answer. It is on the court papers (the summons). It is often between 14 and 30 days, and your state and court set it.',
      'If you miss it, the court can decide against you without hearing your side. This is called a default judgment.',
      'Make sure the lawsuit is real. Look up the court yourself and call the clerk. Do not use a number from a caller.',
      'File your answer by the deadline, even if you are also trying to settle. Ask the clerk or legal aid how.',
      'Go to every court date. Bring your evidence bundle and copies of every letter.',
      'Get help now. Legal aid is free if you qualify, and many consumer attorneys offer a free first talk.'],
    ask: [
      'Is this debt past my state’s time limit to sue?',
      'Can they prove they own the debt, and prove the amount?',
      'Was I properly served with the papers?',
      'Did the collector break the FDCPA, and could that be a counterclaim?',
      'What income and property are protected if they win?'],
    fees: F('Many consumer attorneys take FDCPA cases on contingency or with no upfront fee, because the law lets a court order the collector to pay your attorney’s fees if you win. Ask about fees on the first call and get the fee agreement in writing.', 'FDCPA, 15 U.S.C. 1692k(a)(3)', ['fdcpa', 'naca'])
  };

  SW.data.idplan = {
    steps: [
      { t: 'Report it at IdentityTheft.gov.', d: 'Copy the address into your browser. You get a recovery plan and an official Identity Theft Report.', cite: 'FTC' },
      { t: 'Freeze your credit at all three bureaus.', d: 'Free by federal law. A freeze stops most new accounts from being opened in your name. You can lift it when you need credit.', cite: '15 U.S.C. 1681c-1(i)' },
      { t: 'Place a fraud alert.', d: 'Free. Contact one bureau and it tells the other two. An initial alert lasts one year.', cite: '15 U.S.C. 1681c-1(a)' },
      { t: 'Get your free credit reports.', d: 'At AnnualCreditReport.com. Look for accounts, inquiries and addresses that are not yours.', cite: '15 U.S.C. 1681j' },
      { t: 'Ask the bureaus to block what is not yours.', d: 'Send the identity theft letter with your Identity Theft Report. Bureaus must block information that resulted from identity theft, with limited exceptions.', cite: 'FCRA, 15 U.S.C. 1681c-2' },
      { t: 'Tell each collector in writing the debt is not yours.', d: 'Use the identity theft letter, and keep the certified mail receipt.', cite: 'FDCPA, 15 U.S.C. 1692g(b)' },
      { t: 'Get an IRS Identity Protection PIN.', d: 'It helps stop someone filing a tax return in your name.', cite: 'IRS' },
      { t: 'Change passwords and turn on two-step sign-in.', d: 'Start with your email and your bank.', cite: '' }],
    bureaus: [{ id: 'eq', n: 'Equifax' }, { id: 'ex', n: 'Experian' }, { id: 'tu', n: 'TransUnion' }]
  };
})(typeof window !== 'undefined' ? window : globalThis);
