/* Stark Vital screens, part 2: What helps (patterns), Experiments, Habits (the lever library). */
(function () {
  "use strict";
  var V = window.StarkVital, U = window.VitalUI, D = window.VitalData, ST = window.VitalStats, LN = window.VitalLearn, LV = window.VitalLevers, SF = window.VitalSafety, CH = window.VitalCharts, A = window.VitalApp, h = U.h, S = A.S, btn = A.btn, badge = A.badge;
  var fmt1 = ST.fmtNum;
  function bandBadge(p) { return badge({ none: "no clear link", small: "small link", moderate: "moderate link", strong: "strong link" }[p.band], p.band === "none" ? "" : "doing"); }
  function certBadge(p) { return badge(p.cert, p.cert === "fairly sure" ? "good" : p.cert === "leaning" ? "doing" : ""); }
  function outFmt(O) { return O.unit === "min" ? function (v) { return Math.round(v) + " min"; } : function (v) { return fmt1(v, 1); }; }
  function pairTitle(p) { var E = D.exposure(p.E), O = D.outcome(p.O); return E.label[0].toUpperCase() + E.label.slice(1) + " and " + O.label + (p.lag ? (O.id === "dur" || O.id === "rested" ? " that night" : " the next day") : ""); }

  // A small picture of the finding: two groups of days for yes/no habits, three groups for scales and counts.
  function pairChart(p) {
    var d = S.d, E = D.exposure(p.E), O = D.outcome(p.O), pd = ST.pairData(d, E, O, p.lag, D.dates(d)), fo = outFmt(O);
    if (E.type === "bin") {
      var a = pd.y.filter(function (_, i) { return pd.x[i] === 1; }), b = pd.y.filter(function (_, i) { return pd.x[i] !== 1; });
      return CH.card("Each dot is one day; the bar is the middle value", CH.strip({ a: a, b: b, aLabel: "With", bLabel: "Without", median: ST.median, fmt: fo, label: pairTitle(p) }), "With: middle " + fo(ST.median(a)) + " over " + a.length + " days. Without: middle " + fo(ST.median(b)) + " over " + b.length + " days.", [["Group", "Days", "Middle value"], ["With", a.length, fo(ST.median(a))], ["Without", b.length, fo(ST.median(b))]]);
    }
    var order = pd.x.map(function (v, i) { return i; }).sort(function (i, j) { return pd.x[i] - pd.x[j]; }), items = [], k, cut = [Math.floor(order.length / 3), Math.floor(2 * order.length / 3), order.length], s0 = 0, names = ["Lowest third", "Middle third", "Highest third"];
    if (E.type === "ord") { var lv = {}; pd.x.forEach(function (x, i) { (lv[x] = lv[x] || []).push(pd.y[i]); }); Object.keys(lv).sort().forEach(function (x) { items.push({ label: ["Level " + x][0], v: ST.mean(lv[x]), n: lv[x].length }); }); }
    else for (k = 0; k < 3; k++) { var seg = order.slice(s0, cut[k]).map(function (i) { return pd.y[i]; }); s0 = cut[k]; items.push({ label: names[k], v: seg.length ? ST.mean(seg) : null, n: seg.length }); }
    return CH.card("Average " + O.label + " by amount of " + E.label, CH.bars(items, { fmt: fo, min: O.id === "dur" ? 0 : 0, label: pairTitle(p) }), items.map(function (i) { return i.label + ": " + (i.v == null ? "-" : fo(i.v)) + " (" + i.n + " days)"; }).join(". ") + ".", [["Group", "Average", "Days"]].concat(items.map(function (i) { return [i.label, i.v == null ? "-" : fo(i.v), i.n]; })));
  }
  function findingCard(p, level) {
    var t = ST.describe(p, level), card = h("div", { class: "card finding" }, h("div", { class: "item-top" }, h("h3", { text: pairTitle(p) }), h("div", { class: "row tight" }, bandBadge(p), certBadge(p))), h("p", { text: t.text }));
    if (level !== "simple") { card.appendChild(h("p", { class: "fine", text: t.caution + " Differences between weekdays were removed before testing." })); card.appendChild(h("details", null, h("summary", { text: "Show the picture" }), pairChart(p))); }
    if (level === "expert") card.appendChild(h("p", { class: "expert", text: t.expert }));
    return card;
  }
  A.views.patterns = function () {
    var d = S.d, level = d.settings.detail, wrap = h("div"), logged = Object.keys(d.days).length, flags = A.redFlags(), host = h("div");
    wrap.appendChild(A.section("What seems to help you", "Patterns in your own entries, with how many days it looked at and how sure it is."));
    if (flags.active) wrap.appendChild(A.redBanner(flags));
    wrap.appendChild(h("div", { class: "card soft" }, h("p", { text: "Stark Vital compares each habit you log with how your days went, using plain statistics on this computer. It only describes your own pattern. It cannot tell you what caused what, and many things you cannot see affect your days." }),
      h("p", { class: "fine", text: "A pattern is shown only with at least 21 paired days and 5 days that differ. When many pairs are checked, the app keeps the false-alarm rate at about 1 in 5 (Benjamini-Hochberg). Findings below that line are shown under Explore and labelled \"might be chance\"." })));
    wrap.appendChild(host);
    host.appendChild(h("p", { class: "muted", text: "Looking at your entries..." }));
    A.later(function () {
      var pat = A.patterns(), pass = pat.pairs.filter(function (p) { return p.pass; }).sort(function (a, b) { return Math.abs(b.rho) - Math.abs(a.rho); }), explore = pat.pairs.filter(function (p) { return p.eligible && !p.pass; }).sort(function (a, b) { return a.p - b.p; }), no = pat.pairs.filter(function (p) { return !p.eligible; });
      U.clear(host);
      if (!pat.tested) {
        var best = Math.max.apply(null, [0].concat(no.map(function (p) { return p.n; })));
        host.appendChild(h("div", { class: "card" }, h("h2", { text: "Not enough data yet" }), h("p", { text: "You have " + logged + " days logged. The most any pair has so far is " + best + " of the 21 days needed. Keep checking in: a few missed days are fine." }),
          h("progress", { max: 21, value: Math.min(21, best), "aria-label": "Days toward the first findings" })));
      } else if (!pass.length) host.appendChild(h("div", { class: "card" }, h("h2", { text: "No clear patterns yet" }), h("p", { text: "Out of " + pat.tested + " pairs checked, none stood out from chance. That is a normal result at this stage. More days sharpen the picture." })));
      else { host.appendChild(h("h2", { text: pass.length + " pattern" + (pass.length === 1 ? "" : "s") + " worth a look" })); pass.forEach(function (p) { host.appendChild(findingCard(p, level)); }); }
      if (explore.length) host.appendChild(h("details", { class: "card" }, h("summary", { text: "Explore: " + explore.length + " weaker links (might be chance)" }), explore.slice(0, 14).map(function (p) { return h("div", { class: "explore" }, h("b", { text: pairTitle(p) }), h("p", { class: "fine", text: ST.describe(p, "simple").text + " It might be chance." })); })));
      if (no.length) host.appendChild(h("details", { class: "card" }, h("summary", { text: "Not enough data yet for " + no.length + " pairs" }), h("ul", { class: "fine" }, no.slice(0, 40).map(function (p) { return h("li", { text: pairTitle(p) + ": " + p.reason }); }))));
      if (level === "expert") host.appendChild(h("div", { class: "card" }, h("h2", { text: "How this was calculated" }), h("p", { class: "fine", text: "Spearman rank correlation on paired days; outcome values had the weekday pattern removed first. 90% ranges: moving-block bootstrap, blocks of 3 days, 1000 resamples here (2000 in tests), widened when the outcome is very smooth day to day (lag-1 autocorrelation over 0.6, effective sample size n(1 - r)/(1 + r)). p-values: block-shuffle permutation test, 1000 shuffles, seeded from your data so reloading gives the same numbers. Selection: Benjamini-Hochberg at q = " + pat.q + " across " + pat.tested + " tested pairs. Days marked unwell or travelling, and your first 3 days, are left out. No regression in this version." })));
    });
    return wrap;
  };

  /* experiments: full version only */
  /* ---------- Habits (the lever library) ---------- */
  A.views.levers = function () {
    var wrap = h("div"), t = A.today(), rank = null;
    wrap.appendChild(A.section("Habits and their sources", "Nine everyday habits with what public research says, who said it, and the date we checked."));
    wrap.appendChild(h("div", { class: "card soft" }, h("p", { text: LV.FOOTER }), h("p", { class: "fine", text: "These are summaries of published studies and guidelines, not instructions. The grade says how strong the public evidence is: strong (guideline or several large reviews), moderate (reviews with mixed or modest findings), limited (mostly observational). Links are shown as text and never opened by the app." })));
    var cards = h("div", { class: "cards lever-cards" });
    LV.visible().forEach(function (l) {
      cards.appendChild(h("div", { class: "card lever" }, h("div", { class: "item-top" }, h("h3", { text: l.name }), badge("evidence: " + l.grade, l.grade === "strong" ? "good" : "")),
        h("p", { class: "try", text: "Try: " + l.try }), h("p", { text: l.summary }), h("p", { class: "fine", text: "Source: " + l.source + ". " }), h("code", { class: "url", text: l.url }),
        h("p", { class: "fine", text: "Checked " + l.checked + "." + " " + l.caution }),
        h("div", { class: "row" }, btn("Test it as an experiment", "small primary", function () { A.expDraft = l.id; A.go("experiments"); }))));
    });
    wrap.appendChild(cards);
    wrap.appendChild(h("p", { class: "fine", text: "More habits are planned once their sources have been read in full. A habit without a checked source is not shown. " + SF.FOOTER }));
    return wrap;
  };
})();
