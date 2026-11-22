/* Stark Warden: debt, budget and savings calculators. Plain arithmetic, all on your device. Estimates, not offers. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  function r2(n) { return Math.round(n * 100) / 100; }
  function num(x) { x = parseFloat(String(x).replace(/[$,\s]/g, '')); return isFinite(x) ? x : 0; }

  /* Months to pay off one balance with a fixed monthly payment and interest compounded monthly. */
  function payoff(balance, aprPct, payment) {
    var bal = num(balance), apr = num(aprPct), pay = num(payment), months = 0, interest = 0, paid = 0, i;
    if (bal <= 0) { return { months: 0, totalInterest: 0, totalPaid: 0, never: false }; }
    if (pay <= 0 || (apr > 0 && pay <= bal * apr / 1200)) { return { never: true, months: Infinity, totalInterest: Infinity, totalPaid: Infinity }; }
    while (bal > 0.004 && months < 1200) {
      i = r2(bal * apr / 1200);
      interest += i;
      bal = r2(bal + i);
      pay = Math.min(num(payment), bal);
      bal = r2(bal - pay);
      paid += pay;
      months++;
    }
    return { months: months, totalInterest: r2(interest), totalPaid: r2(paid), never: bal > 0.004 };
  }

  /* Snowball (smallest balance first) vs avalanche (highest rate first). Freed-up minimums roll into the target debt. */
  function simulate(debts, extra, order) {
    var d = debts.map(function (x, i) { return { name: x.name || 'Debt ' + (i + 1), bal: num(x.balance), apr: num(x.apr), min: Math.max(0, num(x.min)), idx: i }; }).filter(function (x) { return x.bal > 0; });
    var budget = d.reduce(function (s, x) { return s + x.min; }, 0) + Math.max(0, num(extra)), months = 0, interest = 0, paid = 0, done = [], i, left, sorted, x, pay;
    if (!d.length) { return { months: 0, interest: 0, totalPaid: 0, order: [], never: false }; }
    while (d.some(function (z) { return z.bal > 0.004; }) && months < 600) {
      d.forEach(function (z) { if (z.bal > 0) { var it = r2(z.bal * z.apr / 1200); z.bal = r2(z.bal + it); interest += it; } });
      left = budget;
      d.forEach(function (z) { if (z.bal > 0) { pay = Math.min(z.min, z.bal, left); z.bal = r2(z.bal - pay); left = r2(left - pay); paid += pay; } });
      sorted = d.filter(function (z) { return z.bal > 0.004; }).sort(order);
      for (i = 0; i < sorted.length && left > 0; i++) { x = sorted[i]; pay = Math.min(x.bal, left); x.bal = r2(x.bal - pay); left = r2(left - pay); paid += pay; }
      d.forEach(function (z) { if (z.bal <= 0.004 && done.indexOf(z.name) < 0) { done.push(z.name); z.bal = 0; } });
      months++;
    }
    return { months: months, interest: r2(interest), totalPaid: r2(paid), order: done, never: d.some(function (z) { return z.bal > 0.004; }) };
  }
  function strategies(debts, extra) {
    return {
      snowball: simulate(debts, extra, function (a, b) { return a.bal - b.bal || b.apr - a.apr; }),
      avalanche: simulate(debts, extra, function (a, b) { return b.apr - a.apr || a.bal - b.bal; })
    };
  }

  /* Lump-sum settlement versus paying the whole balance in a plan. */
  function lumpVsPlan(o) {
    var balance = num(o.balance), lump = num(o.lump), monthly = num(o.planMonthly), months = Math.ceil(num(o.planMonths)), planTotal = r2(monthly * months), cancelled = r2(Math.max(0, balance - lump));
    return {
      pctOfBalance: balance > 0 ? Math.round(lump / balance * 1000) / 10 : 0, lump: r2(lump), planTotal: planTotal, planVsLump: r2(planTotal - lump), cancelled: cancelled,
      form1099c: cancelled >= 600,
      notes: ['Get the settlement terms in writing, signed by the collector or creditor, BEFORE you pay anything.',
        'Pay by a traceable method you can prove (check or card), never by gift card, wire or a payment app to a person.',
        cancelled >= 600 ? 'About ' + cancelled.toFixed(2) + ' would be cancelled. A creditor may report cancelled debt of $600 or more on Form 1099-C, and cancelled debt can count as taxable income unless an exception applies (such as insolvency or bankruptcy). Ask a tax professional.' : 'Cancelled amounts under $600 may not get a 1099-C, but can still be reportable income in some cases.',
        'A settled debt is usually reported to credit bureaus as “settled for less than the full amount”, which can hurt your score for years.']
    };
  }

  function simpleInterest(principal, aprPct, days) { return r2(num(principal) * num(aprPct) / 100 * num(days) / 365); }
  function compoundBalance(principal, aprPct, months) { return r2(num(principal) * Math.pow(1 + num(aprPct) / 1200, num(months))); }
  function feeTotal(fees) { return r2((fees || []).reduce(function (s, f) { return s + num(f.amount); }, 0)); }

  var PER = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  function monthly(amount, freq) { return r2(num(amount) * (PER[freq] || 1)); }
  function totals(items) { return r2((items || []).reduce(function (s, x) { return s + monthly(x.amount, x.freq); }, 0)); }
  function budget(income, expenses) { var i = totals(income), e = totals(expenses); return { income: i, expenses: e, surplus: r2(i - e), savingsRate: i > 0 ? Math.round((i - e) / i * 1000) / 10 : 0 }; }
  function emergency(o) {
    var target = r2(num(o.monthlyExpenses) * num(o.targetMonths)), gap = r2(Math.max(0, target - num(o.current))), save = num(o.monthlySave);
    return { target: target, gap: gap, months: gap === 0 ? 0 : (save > 0 ? Math.ceil(gap / save) : Infinity) };
  }
  function dti(monthlyDebtPayments, grossMonthlyIncome) { return num(grossMonthlyIncome) > 0 ? Math.round(num(monthlyDebtPayments) / num(grossMonthlyIncome) * 1000) / 10 : null; }
  function subscriptions(list) {
    var m = r2(totals(list));
    return { monthly: m, yearly: r2(m * 12) };
  }

  /* Wage garnishment ceiling under the federal Consumer Credit Protection Act (15 U.S.C. 1673): lesser of 25% of disposable weekly earnings or the amount above 30x the federal minimum wage. */
  function garnishmentCap(weeklyDisposable, minWage) {
    var mw = minWage == null ? 7.25 : num(minWage), w = num(weeklyDisposable), a = r2(w * 0.25), b = r2(Math.max(0, w - 30 * mw));
    return { cap: Math.min(a, b), quarter: a, overFloor: b, protectedFloor: r2(30 * mw) };
  }

  SW.calc = { payoff: payoff, strategies: strategies, lumpVsPlan: lumpVsPlan, simpleInterest: simpleInterest, compoundBalance: compoundBalance, feeTotal: feeTotal,
    monthly: monthly, totals: totals, budget: budget, emergency: emergency, dti: dti, subscriptions: subscriptions, garnishmentCap: garnishmentCap };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.calc; }
})(typeof window !== 'undefined' ? window : globalThis);
