/* Stark Warden: statute-of-limitations table (years) for collecting a consumer debt in court, by state and debt type.
   Summary figures compiled from published state statutes and consumer guides. Periods change, depend on the exact
   contract, and the clock rules differ by state, so every result is a starting point to check, never an answer.
   check:true marks rows where published sources disagree or the law changed recently. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  SW.data = SW.data || {};

  /* [name, written, oral, promissory, open account, check?, note] */
  var T = {
    AL: ['Alabama', 6, 6, 6, 3], AK: ['Alaska', 3, 3, 3, 3], AZ: ['Arizona', 6, 3, 6, 3], AR: ['Arkansas', 5, 3, 6, 3],
    CA: ['California', 4, 2, 4, 4, 0, 'California also has its own collector law, the Rosenthal Act, which can cover original creditors.'],
    CO: ['Colorado', 6, 6, 6, 6], CT: ['Connecticut', 6, 3, 6, 3, 1], DE: ['Delaware', 3, 3, 3, 3], DC: ['District of Columbia', 3, 3, 3, 3],
    FL: ['Florida', 5, 4, 5, 5], GA: ['Georgia', 6, 4, 6, 4], HI: ['Hawaii', 6, 6, 6, 6], ID: ['Idaho', 5, 4, 5, 5],
    IL: ['Illinois', 10, 5, 10, 5], IN: ['Indiana', 6, 6, 10, 6, 1], IA: ['Iowa', 10, 5, 10, 5], KS: ['Kansas', 5, 3, 5, 3],
    KY: ['Kentucky', 15, 5, 15, 5, 1], LA: ['Louisiana', 10, 10, 10, 3, 1], ME: ['Maine', 6, 6, 6, 6], MD: ['Maryland', 3, 3, 6, 3],
    MA: ['Massachusetts', 6, 6, 6, 6], MI: ['Michigan', 6, 6, 6, 6], MN: ['Minnesota', 6, 6, 6, 6], MS: ['Mississippi', 3, 3, 3, 3],
    MO: ['Missouri', 10, 5, 10, 5], MT: ['Montana', 8, 5, 8, 5], NE: ['Nebraska', 5, 4, 5, 4], NV: ['Nevada', 6, 4, 6, 4, 1],
    NH: ['New Hampshire', 3, 3, 6, 3],
    NJ: ['New Jersey', 6, 6, 6, 6],
    NM: ['New Mexico', 6, 4, 6, 4],
    NY: ['New York', 6, 6, 6, 3, 0, 'New York’s Consumer Credit Fairness Act (2022) sets a 3-year limit for most consumer credit debts, and a later payment generally cannot revive an expired one. Other contracts may be 6 years.'],
    NC: ['North Carolina', 3, 3, 5, 3], ND: ['North Dakota', 6, 6, 6, 6],
    OH: ['Ohio', 6, 4, 6, 6, 0, 'Ohio shortened its written and oral periods in 2021, so older debts may follow the earlier rules.'],
    OK: ['Oklahoma', 5, 3, 5, 3], OR: ['Oregon', 6, 6, 6, 6], PA: ['Pennsylvania', 4, 4, 4, 4], RI: ['Rhode Island', 10, 10, 10, 10],
    SC: ['South Carolina', 3, 3, 3, 3], SD: ['South Dakota', 6, 6, 6, 6], TN: ['Tennessee', 6, 6, 6, 6], TX: ['Texas', 4, 4, 4, 4],
    UT: ['Utah', 6, 4, 6, 4], VT: ['Vermont', 6, 6, 5, 6, 1], VA: ['Virginia', 5, 3, 6, 3], WA: ['Washington', 6, 3, 6, 3],
    WV: ['West Virginia', 10, 5, 6, 5], WI: ['Wisconsin', 6, 6, 6, 6], WY: ['Wyoming', 10, 8, 10, 8]
  };

  var states = {};
  Object.keys(T).forEach(function (k) {
    var r = T[k];
    states[k] = { code: k, name: r[0], written: r[1], oral: r[2], promissory: r[3], open: r[4], check: !!r[5], note: r[6] || '' };
  });

  SW.data.sol = {
    asOf: '2026-11-20',
    types: [
      { id: 'open', label: 'Credit card or other open-ended account' },
      { id: 'written', label: 'Written contract (loan agreement, lease, signed agreement)' },
      { id: 'promissory', label: 'Promissory note or installment loan note' },
      { id: 'oral', label: 'Oral (spoken) agreement' }
    ],
    states: states,
    sourceNote: 'Check your state: your state attorney general’s consumer page, your state court self-help site, or legal aid will confirm the current period. Find your attorney general at naag.org/find-my-ag. The statute itself is the final word.'
  };

  /* Two-party ("all-party") recording consent. Everywhere else the rule for a call you are part of is one-party consent.
     Federal law (18 U.S.C. § 2511(2)(d)) allows recording when one party consents. Calls across states: be careful and follow the stricter rule. */
  SW.data.consent = {
    asOf: '2026-11-20',
    allParty: ['CA', 'FL', 'IL', 'MD', 'MA', 'MT', 'NH', 'PA', 'WA'],
    special: {
      CT: 'Connecticut: all-party consent for recorded phone calls in civil matters.',
      NV: 'Nevada: the state supreme court has read the law to require all-party consent for phone calls.',
      DE: 'Delaware: commonly described as all-party; the statute is not entirely clear.',
      MI: 'Michigan: the statute is read differently by different courts; treat as all-party to be safe.',
      OR: 'Oregon: one-party for phone calls, all-party for in-person conversations.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
