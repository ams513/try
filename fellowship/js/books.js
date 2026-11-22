/* Stark Fellowship, by Stark: giving records and fund books. Pure logic, no DOM, no network.
   Money and the double-entry journal are adapted from Stark Ledger (integer cents, balanced entries, closed-year lock).
   Gifts are typed in by hand: this app never takes or processes payments. */
(function (root) {
  "use strict";
  var B = {}, BANK = "1000", CASH = "1010";
  B.BANK = BANK; B.CASH = CASH;
  B.METHODS = ["Cash", "Check", "Bank transfer", "Card (taken elsewhere)", "Other", "Non-cash gift"];
  B.DEFAULT_FUNDS = ["General fund", "Building fund", "Help fund", "Outreach fund"];
  B.WORDING = {
    standard: "No goods or services were provided in exchange for these contributions.",
    religious: "No goods or services were provided in exchange for these contributions other than intangible religious benefits."
  };
  B.ADVICE = "Please keep this statement for your tax records. We cannot give tax advice: check with your accountant or tax adviser about what you can deduct.";

  /* ---------- money (integer cents), from Stark Ledger ---------- */
  B.toCents = function (v) { // "1,234.5" -> 123450 ; NaN when not a number
    if (typeof v === "number") return Math.round(v * 100);
    var s = String(v == null ? "" : v).trim(), neg = false, p, frac, third, c;
    if (!s) return NaN;
    s = s.replace(/[$\s,]/g, "");
    if (s[0] === "-") { neg = true; s = s.slice(1); } else if (s[0] === "+") s = s.slice(1);
    if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return NaN;
    p = s.split("."); frac = ((p[1] || "") + "00").slice(0, 2); third = (p[1] || "")[2];
    c = parseInt(p[0] || "0", 10) * 100 + parseInt(frac, 10);
    if (third !== undefined && third >= "5") c += 1;
    return neg ? -c : c;
  };
  B.fmt = function (c) {
    var neg = c < 0, d, r; c = Math.abs(c || 0); d = Math.floor(c / 100); r = c % 100;
    return (neg ? "-" : "") + "$" + String(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + (r < 10 ? "0" : "") + r;
  };
  function isDate(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
    return d.toISOString().slice(0, 10) === s;
  }
  function nid(G, p) { G.seq = (G.seq || 0) + 1; return p + G.seq.toString(36); }
  function acct(G, id) { for (var i = 0; i < G.accounts.length; i++) if (G.accounts[i].id === id) return G.accounts[i]; return null; }
  B.fund = function (G, id) { for (var i = 0; i < G.funds.length; i++) if (G.funds[i].id === id) return G.funds[i]; return null; };

  B.empty = function () {
    var G = { v: 1, seq: 0, lockDate: "", accounts: [{ id: BANK, name: "Bank account", type: "asset" }, { id: CASH, name: "Cash on hand", type: "asset" }], funds: [], entries: [], gifts: [] };
    B.DEFAULT_FUNDS.forEach(function (n) { B.addFund(G, n); });
    return G;
  };
  B.addFund = function (G, name) {
    name = String(name || "").trim().slice(0, 60);
    if (!name) throw new Error("Enter a fund name.");
    if (G.funds.some(function (f) { return f.name.toLowerCase() === name.toLowerCase(); })) throw new Error("There is already a fund called " + name + ".");
    var n = G.funds.length + 1, f = { id: "f" + n, name: name, inc: String(4000 + n), exp: String(5000 + n) };
    while (B.fund(G, f.id)) { n++; f = { id: "f" + n, name: name, inc: String(4000 + n), exp: String(5000 + n) }; }
    G.funds.push(f);
    G.accounts.push({ id: f.inc, name: name + ": gifts", type: "income", fund: f.id }, { id: f.exp, name: name + ": spent", type: "expense", fund: f.id });
    return f;
  };

  /* ---------- double-entry journal, from Stark Ledger ---------- */
  B.assertOpen = function (G, date) { if (G.lockDate && date <= G.lockDate) throw new Error("The books are closed through " + G.lockDate + ". Reopen the year on the Books tab to change it."); };
  B.post = function (G, e) { // e: {date, memo, kind, ref, lines:[{a, dr, cr}]} amounts in whole cents
    var dr = 0, cr = 0, i, l, d, c, entry;
    if (!isDate(e.date)) throw new Error("Enter a valid date.");
    B.assertOpen(G, e.date);
    if (!Array.isArray(e.lines) || e.lines.length < 2) throw new Error("An entry needs at least two lines.");
    for (i = 0; i < e.lines.length; i++) {
      l = e.lines[i]; d = l.dr || 0; c = l.cr || 0;
      if (!acct(G, l.a)) throw new Error("Unknown account " + l.a);
      if (!Number.isInteger(d) || !Number.isInteger(c) || d < 0 || c < 0) throw new Error("Amounts must be whole cents, not negative.");
      if ((d > 0) === (c > 0)) throw new Error("A line is either a debit or a credit.");
      dr += d; cr += c;
    }
    if (dr !== cr) throw new Error("Entry does not balance: debits " + dr + " vs credits " + cr);
    entry = { id: nid(G, "e"), date: e.date, memo: String(e.memo || "").slice(0, 200), kind: e.kind || "manual", ref: e.ref || "", lines: e.lines.map(function (x) { return { a: x.a, dr: x.dr || 0, cr: x.cr || 0 }; }) };
    G.entries.push(entry);
    return entry;
  };
  B.removeEntry = function (G, id) {
    var i = G.entries.findIndex(function (e) { return e.id === id; });
    if (i >= 0) { B.assertOpen(G, G.entries[i].date); G.entries.splice(i, 1); }
    return i >= 0;
  };
  B.trialBalance = function (G, upTo) {
    var bal = {}, dr = 0, cr = 0;
    G.entries.forEach(function (e) { if (upTo && e.date > upTo) return; e.lines.forEach(function (l) { bal[l.a] = (bal[l.a] || 0) + l.dr - l.cr; dr += l.dr; cr += l.cr; }); });
    return { balances: bal, debits: dr, credits: cr, balanced: dr === cr };
  };

  /* ---------- gifts ---------- */
  // o: {date, giver ("h:<household id>", "p:<person id>" or "" for loose/unnamed), amount (cents), fund, method, ref, memo, noncash, gsDesc, gsValue (cents)}
  function cleanGift(G, o) {
    var g = { id: o.id || nid(G, "g"), date: o.date, giver: String(o.giver || ""), fund: o.fund, method: B.METHODS.indexOf(o.method) >= 0 ? o.method : "Cash",
      amount: o.amount | 0, ref: String(o.ref || "").slice(0, 40), memo: String(o.memo || "").slice(0, 200), noncash: "", gsDesc: "", gsValue: 0, entry: "" };
    if (!isDate(g.date)) throw new Error("Enter a valid date.");
    if (!B.fund(G, g.fund)) throw new Error("Choose a fund.");
    if (g.giver && !/^[hp]:[\w-]{1,40}$/.test(g.giver)) throw new Error("Choose a giver.");
    if (g.method === "Non-cash gift") {
      g.amount = 0; g.noncash = String(o.noncash || "").trim().slice(0, 300);
      if (!g.noncash) throw new Error("Describe the non-cash gift. Do not put a value on it: valuing it is the giver's job.");
      if (!g.giver) throw new Error("A non-cash gift needs a named giver.");
    } else if (!(g.amount > 0)) throw new Error("Enter an amount above zero.");
    if (o.gsDesc && String(o.gsDesc).trim()) {
      g.gsDesc = String(o.gsDesc).trim().slice(0, 200); g.gsValue = o.gsValue | 0;
      if (g.gsValue < 0) throw new Error("The value of goods or services cannot be negative.");
    }
    B.assertOpen(G, g.date);
    return g;
  }
  function postGift(G, g) {
    if (!g.amount) return;
    var f = B.fund(G, g.fund);
    g.entry = B.post(G, { date: g.date, memo: "Gift to " + f.name + (g.ref ? " (" + g.ref + ")" : ""), kind: "gift", ref: g.id,
      lines: [{ a: g.method === "Cash" ? CASH : BANK, dr: g.amount }, { a: f.inc, cr: g.amount }] }).id;
  }
  B.addGift = function (G, o) { var g = cleanGift(G, o); postGift(G, g); G.gifts.push(g); return g; };
  B.updateGift = function (G, id, o) {
    var i = G.gifts.findIndex(function (x) { return x.id === id; }), old, g;
    if (i < 0) throw new Error("That gift is gone.");
    old = G.gifts[i]; B.assertOpen(G, old.date);
    o.id = id; g = cleanGift(G, o);
    if (old.entry) B.removeEntry(G, old.entry);
    postGift(G, g); G.gifts[i] = g; return g;
  };
  B.removeGift = function (G, id) {
    var i = G.gifts.findIndex(function (x) { return x.id === id; });
    if (i < 0) return false;
    B.assertOpen(G, G.gifts[i].date);
    if (G.gifts[i].entry) B.removeEntry(G, G.gifts[i].entry);
    G.gifts.splice(i, 1); return true;
  };
  // Money spent from a fund (for example a help payment). from: "bank" or "cash".
  B.spend = function (G, o) {
    var f = B.fund(G, o.fund), amt = o.amount | 0;
    if (!f) throw new Error("Choose a fund.");
    if (!(amt > 0)) throw new Error("Enter an amount above zero.");
    return B.post(G, { date: o.date, memo: String(o.memo || "Spent from " + f.name), kind: o.kind || "spend", ref: o.ref || "",
      lines: [{ a: f.exp, dr: amt }, { a: o.from === "cash" ? CASH : BANK, cr: amt }] });
  };
  B.moveCash = function (G, o) {
    var amt = o.amount | 0;
    if (!(amt > 0)) throw new Error("Enter an amount above zero.");
    return B.post(G, { date: o.date, memo: o.memo || "Cash paid into the bank", kind: "transfer", lines: [{ a: BANK, dr: amt }, { a: CASH, cr: amt }] });
  };

  /* ---------- reports ---------- */
  B.fundReport = function (G, from, to) {
    var rows = G.funds.map(function (f) { return { fund: f, opening: 0, given: 0, spent: 0, closing: 0 }; }), by = {}, cash = { bank: 0, cash: 0 };
    rows.forEach(function (r) { by[r.fund.inc] = { r: r, k: "given" }; by[r.fund.exp] = { r: r, k: "spent" }; });
    G.entries.forEach(function (e) {
      if (e.date > to) return;
      e.lines.forEach(function (l) {
        if (l.a === BANK) cash.bank += l.dr - l.cr; else if (l.a === CASH) cash.cash += l.dr - l.cr;
        var m = by[l.a]; if (!m) return;
        var v = m.k === "given" ? l.cr - l.dr : l.dr - l.cr;
        if (e.date < from) m.r.opening += m.k === "given" ? v : -v; else m.r[m.k] += v;
      });
    });
    rows.forEach(function (r) { r.closing = r.opening + r.given - r.spent; });
    var tot = rows.reduce(function (a, r) { a.opening += r.opening; a.given += r.given; a.spent += r.spent; a.closing += r.closing; return a; }, { opening: 0, given: 0, spent: 0, closing: 0 });
    return { from: from, to: to, rows: rows, total: tot, bank: cash.bank, cash: cash.cash, balanced: cash.bank + cash.cash === tot.closing && B.trialBalance(G, to).balanced };
  };
  B.totals = function (G, from, to) {
    var out = { total: 0, count: 0, named: 0, loose: 0, byFund: {}, byGiver: {}, noncash: 0 };
    G.gifts.forEach(function (g) {
      if (g.date < from || g.date > to) return;
      out.count++;
      if (!g.amount) { out.noncash++; return; }
      out.total += g.amount; out.byFund[g.fund] = (out.byFund[g.fund] || 0) + g.amount;
      if (g.giver) { out.named += g.amount; out.byGiver[g.giver] = (out.byGiver[g.giver] || 0) + g.amount; } else out.loose += g.amount;
    });
    return out;
  };
  B.givers = function (G, year) { // named givers with any gift in the year, cash total included
    var y = String(year), m = {};
    G.gifts.forEach(function (g) { if (g.giver && g.date.slice(0, 4) === y) { m[g.giver] = m[g.giver] || { giver: g.giver, total: 0, gifts: 0 }; m[g.giver].total += g.amount; m[g.giver].gifts++; } });
    return Object.keys(m).map(function (k) { return m[k]; });
  };

  /* ---------- pledges and campaigns ---------- */
  // A pledge is a promise, not money: it posts nothing to the books. Progress counts real gifts to the campaign's fund by the same giver inside the campaign dates.
  function campaign(G, id) { var l = G.campaigns || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  B.campaign = campaign;
  B.addCampaign = function (G, o) {
    var c = { id: "", name: String(o.name || "").trim().slice(0, 80), fund: o.fund, goal: o.goal | 0, start: o.start, end: o.end, pledges: [] };
    if (!c.name) throw new Error("Enter a campaign name.");
    if (!B.fund(G, c.fund)) throw new Error("Choose the fund this campaign gives to.");
    if (!isDate(c.start) || !isDate(c.end)) throw new Error("Enter valid start and end dates.");
    if (c.end < c.start) throw new Error("The end date cannot be before the start date.");
    if (c.goal < 0) throw new Error("The goal cannot be negative.");
    G.campaigns = G.campaigns || [];
    if (G.campaigns.length >= 200) throw new Error("Too many campaigns. Delete an old one first.");
    c.id = nid(G, "c"); G.campaigns.push(c); return c;
  };
  B.removeCampaign = function (G, id) { var l = G.campaigns || [], i = l.findIndex(function (c) { return c.id === id; }); if (i < 0) return false; l.splice(i, 1); return true; };
  B.setPledge = function (G, cid, o) { // one pledge per giver per campaign; re-entering replaces it, amount 0 removes it
    var c = campaign(G, cid), amt = o.amount | 0, i;
    if (!c) throw new Error("That campaign is gone.");
    if (!/^[hp]:[\w-]{1,40}$/.test(String(o.giver || ""))) throw new Error("Choose a giver.");
    if (amt < 0 || amt > 100000000000) throw new Error("Enter a pledge amount of zero or more.");
    i = c.pledges.findIndex(function (p) { return p.giver === o.giver; });
    if (i >= 0) c.pledges.splice(i, 1);
    if (amt > 0) { if (c.pledges.length >= 5000) throw new Error("Too many pledges in one campaign."); c.pledges.push({ giver: o.giver, amount: amt, memo: String(o.memo || "").slice(0, 200) }); }
    return amt > 0;
  };
  B.campaignReport = function (G, cid) {
    var c = campaign(G, cid), given = {}, total = 0, pledged = 0, toward = 0, rows;
    if (!c) return null;
    G.gifts.forEach(function (g) {
      if (g.fund !== c.fund || g.date < c.start || g.date > c.end || !g.amount) return;
      total += g.amount; if (g.giver) given[g.giver] = (given[g.giver] || 0) + g.amount;
    });
    rows = c.pledges.map(function (p) {
      var gv = given[p.giver] || 0; pledged += p.amount; toward += Math.min(gv, p.amount);
      return { giver: p.giver, pledged: p.amount, given: gv, left: Math.max(0, p.amount - gv), memo: p.memo || "" };
    });
    return { campaign: c, rows: rows, pledged: pledged, toward: toward, total: total, goal: c.goal, pctGoal: c.goal ? Math.min(100, Math.round(total * 100 / c.goal)) : 0, outstanding: pledged - toward };
  };

  /* ---------- year-end statement and single-gift receipt (US written acknowledgment practice) ---------- */
/* full version only */
  // Close a year once statements are sent, so nothing in it changes by accident (Stark Ledger's year-end lock).
  B.closeYear = function (G, year) { var d = String(year) + "-12-31"; if (!isDate(d)) throw new Error("Choose a year."); if (!G.lockDate || d > G.lockDate) G.lockDate = d; return G.lockDate; };
  B.reopen = function (G) { G.lockDate = ""; };

  function csvCell(v) { v = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  B.csvLine = function (a) { return a.map(csvCell).join(","); };
  B.giftsCSV = function (G, nameOf, from, to) {
    var rows = [B.csvLine(["Date", "Giver", "Fund", "Method", "Amount", "Reference", "Non-cash description", "Goods or services", "Value of goods or services", "Memo"])];
    G.gifts.filter(function (g) { return g.date >= from && g.date <= to; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (g) {
      var f = B.fund(G, g.fund);
      rows.push(B.csvLine([g.date, g.giver ? nameOf(g.giver) : "Unnamed", f ? f.name : "", g.method, (g.amount / 100).toFixed(2), g.ref, g.noncash, g.gsDesc, g.gsDesc ? (g.gsValue / 100).toFixed(2) : "", g.memo]));
    });
    return rows.join("\r\n") + "\r\n";
  };

  if (typeof module !== "undefined" && module.exports) module.exports = B;
  root.StarkBooks = B;
})(typeof globalThis !== "undefined" ? globalThis : this);
