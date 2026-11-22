/* Salary and offers: the negotiation planner (letters.js) plus a salary benchmark worksheet and an offer comparison. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$, K = SC.kit;
  var negotiate = SC.views.salary;
  var TABS = [["", "Negotiate"], ["bench", "Benchmark"], ["offers", "Compare offers"]];
  var PERIODS = [["year", "per year"], ["month", "per month"], ["week", "per week"], ["day", "per day"], ["hour", "per hour"]];

  SC.views.salary = function (root) {
    var tab = SC.sub(); if (tab !== "bench" && tab !== "offers") tab = "";
    if (!tab) {
      negotiate(root);
      var st = SC.benchStats(SC.S.bench.points, SC.S.bench);
      root.querySelector(".view-head").insertAdjacentHTML("afterend", K.tabs("salary", TABS, "") +
        (st.n ? '<p class="fine">Your benchmark: median ' + SC.money(st.median) + " from " + st.n + " data point" + (st.n > 1 ? "s" : "") + '. <a href="#/salary/bench">Open the benchmark</a> to copy its range into "Market low" and "Market high".</p>' : ""));
      K.bindTabs(root);
      return;
    }
    if (tab === "bench") bench(root); else offers(root);
    K.bindTabs(root);
  };

  /* ---------- benchmark ---------- */
  function bench(root) {
    var B = SC.S.bench, saveSoon = SC.debounce(SC.save, 300);
    root.innerHTML = K.head("Salary and offers", "Salary benchmark",
      "Collect pay figures you find yourself: postings that list pay, salary surveys, recruiters, offers friends were willing to share. See the spread, the middle and a fair ask. <b>Stark Career has no market data of its own</b>; every number here is one you entered.") +
      K.tabs("salary", TABS, "bench") +
      '<div class="two"><div><div class="card"><h2>Role</h2><div class="cols">' +
      K.field("b-role", "Role you are pricing", B.role, { k: "role", ph: "Operations Coordinator" }) + K.field("b-place", "Place or remote", B.place, { k: "place", ph: "Columbus, OH" }) + K.curField("b-cur") +
      K.field("b-adjust", "Location adjustment (%)", B.adjust, { k: "adjust", type: "number", min: 30, max: 300, mode: "decimal" }) +
      K.field("b-hours", "Hours per year (for hourly pay)", B.hours, { k: "hours", type: "number", min: 200, max: 4000 }) + "</div>" +
      '<p class="fine">Location adjustment: 100 means no change. If most of your data comes from a city about 10% more expensive than yours, enter 90.</p></div>' +
      '<div class="card"><h2>Add a data point</h2><div class="cols">' +
      K.field("bp-source", "Source", "", { ph: "Posting: Acme, Coordinator" }) + K.field("bp-low", "Low (or the only figure)", "", { type: "number", min: 0, mode: "decimal" }) +
      K.field("bp-high", "High (optional)", "", { type: "number", min: 0, mode: "decimal" }) + K.field("bp-period", "Period", "year", { opts: PERIODS }) +
      K.field("bp-date", "Date seen", SC.today(), { type: "date" }) + "</div>" +
      '<div class="row" style="margin-top:.6rem"><button type="button" class="btn primary" id="bp-add" data-primary>Add data point</button><button type="button" class="btn small" id="bp-ex">Add 5 example points</button></div>' +
      '<p class="fine">Example points are made up to show how the page works. Delete them before you rely on the numbers.</p></div>' +
      '<div class="card"><h2>Your data points</h2><ul class="vlist" id="b-list"></ul></div></div>' +
      '<div><div class="card" id="b-out" aria-live="polite"></div></div></div>';

    function list() {
      $("#b-list").innerHTML = B.points.length ? B.points.map(function (p) {
        var lo = SC.num(p.low), hi = SC.num(p.high), v = lo > 0 && hi > 0 ? (lo + hi) / 2 : lo || hi, old = p.date && SC.daysBetween(p.date, SC.today()) > 365;
        return '<li data-id="' + p.id + '"><div><b>' + E(p.source || "Data point") + '</b><span class="fine">' + (lo && hi ? SC.money(lo) + " to " + SC.money(hi) : SC.money(lo || hi)) + " " + E((PERIODS.filter(function (x) { return x[0] === p.period; })[0] || PERIODS[0])[1]) +
          " &middot; " + SC.money(SC.annualize(v, p.period, B.hours)) + " a year" + (p.date ? " &middot; " + E(K.nice(p.date)) : "") + (old ? ' <span class="warn-text">(over a year old)</span>' : "") + '</span></div><button type="button" class="btn small" data-rm aria-label="Remove data point">Remove</button></li>';
      }).join("") : '<li class="muted">No data yet. Add three or more points for a useful range.</li>';
    }
    function out() {
      var s = SC.benchStats(B.points, B), o = $("#b-out");
      if (!s.n) { o.innerHTML = "<h2>Your range</h2><p class=\"muted\">Add data points to see the low, middle and high of what you found.</p>" + tips(); return; }
      var span = Math.max(1, s.max - s.min), pos = function (v) { return (100 * (v - s.min) / span).toFixed(1); };
      o.innerHTML = "<h2>Your range" + (B.role ? ": " + E(B.role) : "") + "</h2>" +
        '<div class="stat">' + K.stat("data points", s.n) + K.stat("25th percentile", SC.money(s.p25)) + K.stat("median", SC.money(s.median)) + K.stat("75th percentile", SC.money(s.p75)) + "</div>" +
        '<div class="rangebar" role="img" aria-label="Range from ' + SC.money(s.min) + " to " + SC.money(s.max) + '"><i class="band" style="left:' + pos(s.p25) + "%;width:" + (pos(s.p75) - pos(s.p25)).toFixed(1) + '%"></i><i class="mid" style="left:' + pos(s.median) + '%"></i></div>' +
        '<div class="row between fine"><span>' + SC.money(s.min) + "</span><span>" + SC.money(s.max) + "</span></div>" +
        '<div class="hint' + (s.confidence === "thin" ? " warn" : "") + '">' + (s.confidence === "good" ? "Five or more points: a usable range." : s.confidence === "fair" ? "Three or four points: a rough range. Add more if you can." : "Fewer than three points: treat this as a guess.") +
        (s.spread > 60 ? " The spread is wide (" + s.spread + "% of the median), so check that every point is for the same level of role." : "") + "</div>" +
        "<p>A fair ask sits near the 75th percentile (<b>" + SC.money(s.ask) + "</b>) when your experience is at or above the level of the role. Treat the 25th percentile (<b>" + SC.money(s.floor) + "</b>) as your floor.</p>" +
        '<div class="row"><button type="button" class="btn primary" id="b-use">Use in negotiation</button><button type="button" class="btn" id="b-csv">Download data (.csv)</button></div>' + tips();
    }
    function tips() { return '<p class="fine">Mix sources, prefer the last 12 months, compare like with like (same level, same hours), and count only base pay here. Put bonus and equity in Compare offers.</p>'; }
    list(); out();
    function onEdit(ev) {
      var k = ev.target.getAttribute("data-k"); if (!k) return;
      if (k === "cur") SC.S.cur = ev.target.value; else B[k] = ev.target.value;
      saveSoon(); list(); out();
    }
    root.addEventListener("input", onEdit);
    root.addEventListener("change", function (ev) { if (ev.target.getAttribute("data-k")) { onEdit(ev); SC.save(); } });
    root.addEventListener("click", function (ev) {
      var t = ev.target;
      if (t.id === "bp-add") {
        var lo = $("#bp-low").value, hi = $("#bp-high").value, d = $("#bp-date").value;
        if (!(SC.num(lo) > 0 || SC.num(hi) > 0)) { SC.toast("Enter at least one figure."); $("#bp-low").focus(); return; }
        B.points.push({ id: SC.uid(), source: $("#bp-source").value.trim(), low: lo, high: hi, period: $("#bp-period").value, date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "" });
        ["#bp-source", "#bp-low", "#bp-high"].forEach(function (s) { $(s).value = ""; });
        SC.save(); list(); out(); $("#bp-source").focus();
      } else if (t.id === "bp-ex") {
        [["Example posting A", 56000, 64000], ["Example posting B", 60000, 0], ["Example survey", 58000, 70000], ["Example recruiter call", 62000, 68000], ["Example posting C", 29, 33, "hour"]].forEach(function (x) {
          B.points.push({ id: SC.uid(), source: x[0], low: String(x[1]), high: x[2] ? String(x[2]) : "", period: x[3] || "year", date: SC.today() });
        });
        if (!B.role) B.role = "Operations Coordinator";
        SC.save(); SC.route();
      } else if (t.hasAttribute("data-rm")) {
        var id = t.closest("[data-id]").getAttribute("data-id");
        B.points = B.points.filter(function (p) { return p.id !== id; }); SC.save(); list(); out();
      } else if (t.id === "b-use") {
        var s = SC.benchStats(B.points, B), Z = SC.S.salary;
        Z.low = String(s.floor); Z.high = String(s.ask); if (!Z.target) Z.target = String(s.ask); if (!Z.role && B.role) Z.role = B.role;
        SC.save(); SC.go("#/salary"); SC.toast("Market low and high filled in from your benchmark.");
      } else if (t.id === "b-csv") {
        var rows = [["Source", "Low", "High", "Period", "Per year", "Date"]].concat(B.points.map(function (p) {
          var lo = SC.num(p.low), hi = SC.num(p.high); return [p.source, p.low, p.high, p.period, Math.round(SC.annualize(lo > 0 && hi > 0 ? (lo + hi) / 2 : lo || hi, p.period, B.hours)), p.date];
        }));
        SC.download("salary_benchmark.csv", rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\r\n"), "text/csv");
      }
    });
  }

  /* ---------- offer comparison ---------- */
  var MONEY = [["base", "Base pay per year"], ["bonus", "Target bonus (% of base)"], ["signOn", "Signing bonus (once)"], ["equity", "Equity, total grant value"], ["vest", "Equity vests over (years)"],
    ["match", "Retirement match (% of base)"], ["benefits", "Benefits worth per year"], ["raise", "Expected raise per year (%)"], ["pto", "Paid days off incl. holidays"], ["hours", "Hours per week"],
    ["commute", "Commute, minutes one way"], ["office", "Office days per week"]];
  function offers(root) {
    var O = SC.S.offers, saveSoon = SC.debounce(SC.save, 300);
    function card(o, i) {
      return '<div class="card offer" data-id="' + o.id + '"><div class="card-head"><h3>Offer ' + (i + 1) + '</h3><button type="button" class="btn small" data-rm aria-label="Remove offer ' + (i + 1) + '">Remove</button></div>' +
        K.field("o-name-" + o.id, "Company and role", o.name, { k: "name" }) + '<div class="cols">' +
        MONEY.map(function (m) { return K.field("o-" + m[0] + "-" + o.id, m[1], o[m[0]], { k: m[0], type: "number", min: 0, mode: "decimal" }); }).join("") +
        K.field("o-deadline-" + o.id, "Reply by", o.deadline, { k: "deadline", type: "date" }) + "</div>" +
        "<h4>What money cannot measure (1 low to 5 high)</h4><div class=\"cols\">" + SC.OFFER_FACTORS.map(function (f) {
          return K.field("o-s-" + f[0] + "-" + o.id, f[1], (o.scores || {})[f[0]] || 3, { k: "s." + f[0], opts: K.levels(1) }); }).join("") + "</div>" +
        K.field("o-notes-" + o.id, "Notes", o.notes, { k: "notes", area: true, rows: 2 }) + "</div>";
    }
    function draw() {
      root.innerHTML = K.head("Salary and offers", "Compare offers",
        "Put offers side by side: pay over several years, bonus, equity, retirement match, benefits, time off and commute, then weigh what money cannot measure. Every figure is yours to enter; equity is your own estimate, not a prediction.") +
        K.tabs("salary", TABS, "offers") +
        '<div class="card"><div class="row"><button type="button" class="btn primary" id="o-add">Add an offer</button><button type="button" class="btn small" id="o-ex">Add 2 example offers</button>' +
        '<div class="grow"></div>' + K.field("o-years", "Compare over", O.years, { k: "years", opts: [["1", "1 year"], ["2", "2 years"], ["3", "3 years"], ["4", "4 years"], ["5", "5 years"]] }) + K.curField("o-cur") + "</div></div>" +
        '<div class="card" id="o-out" aria-live="polite"></div>' +
        (O.list.length ? '<div class="offers">' + O.list.map(card).join("") + "</div>" : '<p class="muted">No offers yet. Add one for each offer you hold, or one for your current job to compare against.</p>') +
        '<div class="card"><h2>What matters most to you (0 to 5)</h2><div class="cols">' + [["money", "Money"]].concat(SC.OFFER_FACTORS).map(function (f) {
          return K.field("w-" + f[0], f[1], O.weights[f[0]], { k: "w." + f[0], opts: K.levels(0) }); }).join("") + '</div><p class="fine">The score is a weighted average. Money gets 5 stars for the offer with the highest average yearly value and proportionally fewer for the rest.</p></div>';
      out();
    }
    function out() {
      var r = SC.compareOffers(O.list, O.weights, O.years), o = $("#o-out");
      if (!r.rows.length) { o.innerHTML = "<h2>Side by side</h2><p class=\"muted\">Add at least two offers to compare them.</p>"; return; }
      var y = r.rows[0].m.years;
      function cell(row, v, key) { return "<td" + (r.best[key] === row.id && r.rows.length > 1 ? ' class="best"' : "") + ">" + SC.esc(v) + "</td>"; }
      o.innerHTML = '<h2>Side by side over ' + y + " year" + (y > 1 ? "s" : "") + '</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Offer</th><th scope="col">Average per year</th><th scope="col">Total</th><th scope="col">First year</th><th scope="col">Per hour incl. commute</th><th scope="col">Commute h / year</th><th scope="col">Score</th></tr></thead><tbody>' +
        r.rows.map(function (row) {
          return '<tr><th scope="row">' + E(row.name) + "</th>" + cell(row, SC.money(row.m.avg), "money") + "<td>" + SC.money(row.m.total) + "</td><td>" + SC.money(row.m.first) + "</td>" +
            cell(row, SC.money(row.m.hourly), "hourly") + "<td>" + Math.round(row.m.commuteHours) + "</td>" + cell(row, row.score + " / 100", "score") + "</tr>";
        }).join("") + "</tbody></table></div>" +
        (r.rows.length > 1 ? '<p class="fine">Highlighted: the best in each column. ' + (r.best.score !== r.best.money ? "<b>The offer with the most money is not the one with the best overall score</b>, so talk it through before you decide." : "The same offer leads on money and overall score.") + "</p>" : "") +
        '<p class="fine">Per hour divides the average yearly value by the hours you work plus the hours you commute, after paid days off. Equity is spread evenly over its vesting years and counted at the value you entered.</p>';
    }
    draw();
    root.addEventListener("input", function (ev) { apply(ev.target, false); });
    root.addEventListener("change", function (ev) { if (ev.target.tagName === "SELECT") apply(ev.target, true); });
    function apply(el, now) {
      var k = el.getAttribute("data-k"); if (!k) return;
      var card = el.closest("[data-id]"), o = card ? K.byId(O.list, card.getAttribute("data-id")) : null;
      if (k === "cur") SC.S.cur = el.value;
      else if (k === "years") O.years = el.value;
      else if (k.indexOf("w.") === 0) O.weights[k.slice(2)] = +el.value;
      else if (o && k.indexOf("s.") === 0) { o.scores = o.scores || {}; o.scores[k.slice(2)] = +el.value; }
      else if (o) o[k] = el.value;
      if (now) SC.save(); else saveSoon();
      out();
    }
    root.addEventListener("click", function (ev) {
      var t = ev.target;
      if (t.id === "o-add") { O.list.push(SC.blankOffer("Offer " + (O.list.length + 1))); SC.save(); draw(); var f = root.querySelector(".offer:last-child input"); if (f) f.focus(); }
      else if (t.id === "o-ex") {
        var a = SC.blankOffer("Example: Harbor Logistics, Ops Lead"), b = SC.blankOffer("Example: Northwind, Ops Manager");
        Object.assign(a, { base: "72000", bonus: "5", match: "4", benefits: "6000", pto: "25", commute: "15", office: "3", scores: { growth: 4, people: 4, mission: 3, flex: 4, stability: 4 } });
        Object.assign(b, { base: "80000", bonus: "10", signOn: "5000", equity: "20000", match: "3", benefits: "5000", pto: "18", hours: "45", commute: "50", office: "5", scores: { growth: 3, people: 3, mission: 3, flex: 2, stability: 3 } });
        O.list.push(a, b); SC.save(); draw();
      } else if (t.hasAttribute("data-rm")) {
        var id = t.closest("[data-id]").getAttribute("data-id");
        if (!K.sure(t, "Click again to remove")) return;
        O.list = O.list.filter(function (o) { return o.id !== id; }); SC.save(); draw();
      }
    });
  }
})();
