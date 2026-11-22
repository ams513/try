/* Stark Fellowship, by Stark: giving records, year-end statements and fund books. Gifts are typed in by hand. */
(function () {
  "use strict";
  var A = window.FellowApp, K = StarkCore, B = StarkBooks, M = StarkCommunity, U = FellowUI, h = U.h, btn = U.btn, S = A.S;
  var tab = "gifts", year = "", fundF = "", gq = "", sy = "", by = "";

  function giverLabels() { // label -> giver key, households first
    var D = S.data.core, x = A.idx(), map = {}, seen = {};
    function put(l, k) { if (seen[l]) l += " · #" + k.slice(2, 6); seen[l] = 1; map[l] = k; map["k:" + k] = l; }
    D.households.forEach(function (hh) { put(hh.name + " (household)", "h:" + hh.id); });
    D.people.forEach(function (p) { if (p.status !== "Former") put(M.name(p) + " · " + ((x.h[p.hh] || {}).name || ""), "p:" + p.id); });
    return map;
  }
  function years(G) { var ys = {}, t = A.today().slice(0, 4); ys[t] = 1; G.gifts.forEach(function (g) { ys[g.date.slice(0, 4)] = 1; }); return Object.keys(ys).sort().reverse(); }
  function fundOpts(G) { return G.funds.map(function (f) { return [f.id, f.name]; }); }

  A.views.giving = function () {
    var G = S.data.giving, t = A.today(), y = t.slice(0, 4), root = h("div");
    year = year || y; sy = sy || String(+y - 1); by = by || y;
    var ytd = B.totals(G, y + "-01-01", t), mo = B.totals(G, t.slice(0, 7) + "-01", t), ly = B.totals(G, (+y - 1) + "-01-01", (+y - 1) + "-12-31");
    root.appendChild(A.sec("Giving", "Gifts typed in by hand from envelopes, checks and bank statements. Stark Fellowship never takes or processes payments.", [
      btn("Record gifts", "primary", function () { giftForm(null); }), btn("Record spending", "", spendForm), btn("Cash paid into the bank", "", cashForm)]));
    root.appendChild(A.kpis([["this month", B.fmt(mo.total), null, "small"], ["this year", B.fmt(ytd.total), null, "small"], ["last year", B.fmt(ly.total), null, "small"], ["named givers this year", Object.keys(ytd.byGiver).length], ["loose gifts this year", B.fmt(ytd.loose), null, "small"]]));
    if (G.lockDate) root.appendChild(h("p", { class: "fine", text: "The books are closed through " + G.lockDate + ", so gifts up to then cannot change. Reopen on the Books tab if you must." }));
    root.appendChild(h("div", { class: "tabs", role: "tablist" }, [["gifts", "Gifts"], ["pledges", "Pledges"], ["statements", "Year-end statements"], ["books", "Books"]].map(function (x) {
      return h("button", { type: "button", role: "tab", class: "tab" + (tab === x[0] ? " on" : ""), "aria-selected": tab === x[0] ? "true" : "false", text: x[1], onclick: function () { tab = x[0]; A.render(); } });
    })));
    root.appendChild(tab === "statements" ? statementsTab(G) : tab === "pledges" ? pledgesTab(G) : tab === "books" ? booksTab(G) : giftsTab(G));
    return root;
  };

  /* ---------- gifts ---------- */
  function giftsTab(G) {
    var root = h("div"), list = h("div"), x = A.idx(), timer;
    root.appendChild(h("div", { class: "row wrap filter" },
      U.select("g-year", years(G).map(function (v) { return [v, v]; }), year, function (v) { year = v; S.page.gifts = 0; draw(); }, "Year"),
      U.select("g-fund", [["", "All funds"]].concat(fundOpts(G)), fundF, function (v) { fundF = v; S.page.gifts = 0; draw(); }, "Fund"),
      h("input", { type: "search", id: "g-q", placeholder: "Search giver or reference", value: gq, "aria-label": "Search gifts", oninput: function (e) { gq = e.target.value; S.page.gifts = 0; clearTimeout(timer); timer = setTimeout(draw, 150); } })));
    root.appendChild(list);
    function draw() {
      var w = gq.trim().toLowerCase(), rows = G.gifts.filter(function (g) { return g.date.slice(0, 4) === year && (!fundF || g.fund === fundF) && (!w || (A.giverName(g.giver, x) + " " + g.ref + " " + g.memo).toLowerCase().indexOf(w) >= 0); })
        .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }), p0;
      U.clear(list);
      list.appendChild(A.pager("gifts", rows.length, 50, draw) || h("span"));
      p0 = (S.page.gifts || 0) * 50;
      list.appendChild(rows.length ? A.table(["Date", "Giver", "Fund", "Method", "Amount", "Ref", ""], rows.slice(p0, p0 + 50).map(function (g) {
        var f = B.fund(G, g.fund), locked = G.lockDate && g.date <= G.lockDate;
        return h("tr", null, h("td", { text: g.date }), h("td", { text: A.giverName(g.giver, x) }), h("td", { text: f ? f.name : "" }),
          h("td", { text: g.method + (g.gsDesc ? " · goods/services" : "") }), h("td", { class: "num", text: g.noncash ? "described" : B.fmt(g.amount) }), h("td", { text: g.ref }),
          h("td", null, h("div", { class: "row tight" }, g.giver ? btn("Receipt", "small", function () { receipt(g); }, { "aria-label": "Receipt for gift on " + g.date }) : null,
            locked ? h("span", { class: "tag", text: "closed" }) : btn("Edit", "small", function () { giftForm(g); }, { "aria-label": "Edit gift on " + g.date }))));
      }), "gifts") : A.empty("No gifts match. Record gifts with the button above."));
    }
    draw();
    return root;
  }
  function giftForm(g) {
    var G = S.data.giving, labels = giverLabels(), t = A.today();
    var fields = [
      { k: "date", label: "Date", type: "date", req: true, keep: true },
      { k: "giver", label: "Giver", max: 160, list: Object.keys(labels).filter(function (l) { return l.indexOf("k:") !== 0; }), help: "A household or a person. Leave empty for loose gifts with no name (not on statements)." },
      { k: "amount", label: "Amount", type: "money", ph: "25.00" }, { k: "fund", label: "Fund", type: "select", options: fundOpts(G), keep: true },
      { k: "method", label: "How it was given", type: "select", options: B.METHODS, keep: true }, { k: "ref", label: "Check number or reference", max: 40 },
      { k: "noncash", label: "Describe the non-cash gift", type: "textarea", wide: true, max: 300, help: "Describe it only. Do not record a value: valuing a non-cash gift is the giver's job." },
      { k: "gsDesc", label: "Goods or services given in return (if any)", max: 200, help: "For example a dinner ticket. Leave empty if nothing was given in return." },
      { k: "gsValue", label: "Fair value of those goods or services", type: "money", help: "Your good-faith estimate. It is printed on the statement." },
      { k: "memo", label: "Memo", max: 200, wide: true }];
    U.openForm(g ? "Edit gift" : "Record gifts", fields, g ? { date: g.date, giver: labels["k:" + g.giver] || "", amount: g.amount ? (g.amount / 100).toFixed(2) : "", fund: g.fund, method: g.method, ref: g.ref, noncash: g.noncash, gsDesc: g.gsDesc, gsValue: g.gsDesc ? (g.gsValue / 100).toFixed(2) : "", memo: g.memo }
      : { date: t, fund: G.funds[0] && G.funds[0].id, method: "Check" }, function (v, again) {
      var key = v.giver ? labels[v.giver] : "";
      if (v.giver && !key) throw new Error("Pick the giver from the list, or leave it empty for a loose gift.");
      var o = { date: v.date, giver: key, amount: v.amount, fund: v.fund, method: v.method, ref: v.ref, noncash: v.noncash, gsDesc: v.gsDesc, gsValue: v.gsValue, memo: v.memo };
      var saved = g ? B.updateGift(G, g.id, o) : B.addGift(G, o);
      A.save("giving"); A.log((g ? "Edited a gift" : "Recorded a gift") + " (" + saved.date + ")");
      if (again) { U.toast("Saved " + (saved.amount ? B.fmt(saved.amount) : "non-cash gift") + ". Next gift."); return; }
      A.render(); U.toast("Gift saved.");
    }, { again: g ? null : "Save and add another", del: g ? function () { U.confirmBox("Delete this gift?", "It is removed from the books too.", "Delete", true).then(function (ok) { if (ok) { try { B.removeGift(G, g.id); A.save("giving"); A.log("Deleted a gift (" + g.date + ")"); A.render(); } catch (x) { U.toast(x.message, true); } } }); } : null,
      onchange: function (form) {
        var nc = U.$("#f-method", form).value === "Non-cash gift";
        U.$("#f-noncash", form).closest(".field").hidden = !nc; U.$("#f-amount", form).closest(".field").hidden = nc;
        U.$("#f-gsValue", form).closest(".field").hidden = !U.$("#f-gsDesc", form).value.trim();
      } });
    var gs = U.$("#f-gsDesc"); if (gs) gs.addEventListener("input", function () { U.$("#f-gsValue").closest(".field").hidden = !gs.value.trim(); });
  }
  function spendForm() {
    var G = S.data.giving;
    U.openForm("Record spending from a fund", [{ k: "date", label: "Date", type: "date", req: true }, { k: "fund", label: "From fund", type: "select", options: fundOpts(G) },
      { k: "amount", label: "Amount", type: "money", req: true }, { k: "from", label: "Paid from", type: "select", options: [["bank", "Bank account"], ["cash", "Cash on hand"]] }, { k: "memo", label: "What it was for", max: 200, wide: true }],
    { date: A.today() }, function (v) { B.spend(G, v); A.save("giving"); A.log("Recorded spending from a fund"); A.render(); U.toast("Spending recorded."); });
  }
  function cashForm() {
    U.openForm("Cash paid into the bank", [{ k: "date", label: "Date", type: "date", req: true }, { k: "amount", label: "Amount", type: "money", req: true }], { date: A.today() },
      function (v) { B.moveCash(S.data.giving, v); A.save("giving"); A.log("Recorded a cash deposit"); A.render(); U.toast("Deposit recorded."); });
  }

  /* ---------- pledges and campaigns ---------- */
  function pledgesTab(G) {
    var root = h("div"), x = A.idx(), list = G.campaigns || [];
    root.appendChild(h("div", { class: "row wrap filter" }, btn("New campaign", "primary", function () { campaignForm(G); })));
    root.appendChild(h("p", { class: "fine", text: "A pledge is a promise, not money: it is never posted to the books and is not a legal commitment. Progress counts gifts you have recorded to the campaign's fund, by the same giver, between its dates." }));
    if (!list.length) { root.appendChild(A.empty("No campaigns yet. Start one for a building project or a special appeal.")); return root; }
    list.slice().sort(function (a, b) { return a.end < b.end ? 1 : -1; }).forEach(function (c) {
      var r = B.campaignReport(G, c.id), f = B.fund(G, c.fund);
      root.appendChild(h("div", { class: "card" }, h("h2", { text: c.name }),
        h("p", { class: "muted", text: (f ? f.name : "") + " · " + c.start + " to " + c.end + " · raised " + B.fmt(r.total) + (c.goal ? " of " + B.fmt(c.goal) + " (" + r.pctGoal + "%)" : "") + " · pledged " + B.fmt(r.pledged) + ", still to come " + B.fmt(r.outstanding) }),
        h("div", { class: "row tight" }, btn("Add or change a pledge", "small", function () { pledgeForm(G, c); }),
          btn("Delete campaign", "small danger-o", function () { U.confirmBox("Delete this campaign?", "Its pledges are removed. Recorded gifts and the books are not touched.", "Delete", true).then(function (ok) { if (ok) { B.removeCampaign(G, c.id); A.save("giving"); A.log("Deleted a campaign"); A.render(); } }); })),
        r.rows.length ? A.table(["Giver", "Pledged", "Given so far", "Still to come"], r.rows.map(function (p) {
          return h("tr", null, h("td", { text: A.giverName(p.giver, x) }), h("td", { class: "num", text: B.fmt(p.pledged) }), h("td", { class: "num", text: B.fmt(p.given) }), h("td", { class: "num", text: B.fmt(p.left) }));
        })) : h("p", { class: "fine", text: "No pledges yet." })));
    });
    return root;
  }
  function campaignForm(G) {
    var t = A.today();
    U.openForm("New campaign", [{ k: "name", label: "Campaign name", req: true, max: 80, ph: "For example: Roof repair appeal" }, { k: "fund", label: "Gives to fund", type: "select", options: fundOpts(G) },
      { k: "goal", label: "Goal (optional)", type: "money", ph: "50000.00" }, { k: "start", label: "Starts", type: "date", req: true }, { k: "end", label: "Ends", type: "date", req: true }],
    { start: t, end: (+t.slice(0, 4) + 1) + t.slice(4), fund: G.funds[0] && G.funds[0].id }, function (v) {
      B.addCampaign(G, { name: v.name, fund: v.fund, goal: v.goal, start: v.start, end: v.end }); A.save("giving"); A.log("Started a campaign"); A.render(); U.toast("Campaign started.");
    });
  }
  function pledgeForm(G, c) {
    var labels = giverLabels();
    U.openForm("Pledge to " + c.name, [{ k: "giver", label: "Giver", req: true, max: 160, list: Object.keys(labels).filter(function (l) { return l.indexOf("k:") !== 0; }) },
      { k: "amount", label: "Amount pledged", type: "money", req: true, help: "Enter 0 to remove this giver's pledge." }, { k: "memo", label: "Note", max: 200, wide: true }], {}, function (v) {
      var key = labels[v.giver];
      if (!key) throw new Error("Pick the giver from the list.");
      B.setPledge(G, c.id, { giver: key, amount: v.amount, memo: v.memo }); A.save("giving"); A.log("Updated a pledge"); A.render(); U.toast("Pledge saved.");
    });
  }

  /* ---------- statements and receipts ---------- */
  function receipt() { window.StarkTrial.show("giving_statements"); }
  function statementsTab(G) {
    var root = h("div"), x = A.idx(), givers = B.givers(G, sy).sort(function (a, b) { return A.giverName(a.giver, x).localeCompare(A.giverName(b.giver, x)); });
    root.appendChild(h("div", { class: "banner" }, h("strong", { text: "Check with your accountant. " }),
      "Statement wording follows common US practice for written acknowledgments (IRS Publication 1771): cash amounts, a description (never a value) of non-cash gifts, and a statement about any goods or services given in return. In the US a written acknowledgment is needed for any single gift of $250 or more. Rules differ by country and change: have an accountant check the wording before you send statements."));
    root.appendChild(h("div", { class: "row wrap filter" }, U.select("s-year", years(G).map(function (v) { return [v, v]; }), sy, function (v) { sy = v; A.render(); }, "Statement year"),
      btn("Print all " + givers.length + " statements", "primary", function () {
        window.StarkTrial.show("giving_statements");
      }, { disabled: !givers.length }),
      btn("Export " + sy + " gifts CSV", "", function () { U.downloadText("gifts-" + sy + ".csv", B.giftsCSV(G, function (k) { return A.giverName(k, x); }, sy + "-01-01", sy + "-12-31"), "text/csv"); }),
      G.lockDate >= sy + "-12-31" ? h("span", { class: "tag", text: sy + " is closed" }) : btn("Close " + sy, "", function () {
        U.confirmBox("Close " + sy + "?", "Gifts and spending up to 31 December " + sy + " can no longer change by accident. Close a year after its statements are sent. You can reopen it on the Books tab.", "Close " + sy).then(function (ok) { if (ok) { B.closeYear(G, sy); A.save("giving"); A.log("Closed the books for " + sy); A.render(); } });
      })));
    root.appendChild(givers.length ? A.table(["Giver", "Gifts", "Total", ""], givers.map(function (g) {
      return h("tr", null, h("td", { text: A.giverName(g.giver, x) }), h("td", { class: "num", text: String(g.gifts) }), h("td", { class: "num", text: B.fmt(g.total) }),
        h("td", null, btn("Preview", "small", function () { window.StarkTrial.show("giving_statements"); }, { "aria-label": "Preview statement for " + A.giverName(g.giver, x) })));
    })) : A.empty("No named gifts in " + sy + "."));
    return root;
  }

  /* ---------- books ---------- */
  function booksTab(G) {
    var root = h("div"), from = by + "-01-01", to = by + "-12-31", r = B.fundReport(G, from, to), tb = B.trialBalance(G, to), acc = {};
    G.accounts.forEach(function (a) { acc[a.id] = a; });
    root.appendChild(h("div", { class: "row wrap filter" }, U.select("b-year", years(G).map(function (v) { return [v, v]; }), by, function (v) { by = v; A.render(); }, "Books year"),
      btn("Add a fund", "", function () { U.openForm("Add a fund", [{ k: "name", label: "Fund name", req: true, max: 60, ph: "For example: Youth trip fund" }], {}, function (v) { B.addFund(G, v.name); A.save("giving"); A.log("Added fund " + v.name); A.render(); }); }),
      G.lockDate ? btn("Reopen closed years", "danger-o", function () { U.confirmBox("Reopen the books?", "Everything up to " + G.lockDate + " becomes editable again. Statements already sent will not match if you change those years.", "Reopen", true).then(function (ok) { if (ok) { B.reopen(G); A.save("giving"); A.log("Reopened the books"); A.render(); } }); }) : null));
    root.appendChild(h("div", { class: "card" }, h("h2", { text: "Funds in " + by }), A.table(["Fund", "Start of year", "Given", "Spent", "End of year"], r.rows.map(function (x) {
      return h("tr", null, h("td", { text: x.fund.name }), h("td", { class: "num", text: B.fmt(x.opening) }), h("td", { class: "num", text: B.fmt(x.given) }), h("td", { class: "num", text: B.fmt(x.spent) }), h("td", { class: "num", text: B.fmt(x.closing) }));
    }).concat([h("tr", { class: "total" }, h("td", { text: "Total" }), h("td", { class: "num", text: B.fmt(r.total.opening) }), h("td", { class: "num", text: B.fmt(r.total.given) }), h("td", { class: "num", text: B.fmt(r.total.spent) }), h("td", { class: "num", text: B.fmt(r.total.closing) }))])),
      h("p", { class: "fine", text: "Held at " + to + ": bank " + B.fmt(r.bank) + ", cash on hand " + B.fmt(r.cash) + ". " + (r.balanced ? "The books balance: money held equals the fund totals." : "The books do not balance. Check recent entries.") })));
    root.appendChild(h("div", { class: "card" }, h("h2", { text: "Trial balance at " + to }), A.table(["Account", "Debit", "Credit"], G.accounts.filter(function (a) { return tb.balances[a.id]; }).map(function (a) {
      var v = tb.balances[a.id]; return h("tr", null, h("td", { text: a.id + " " + a.name }), h("td", { class: "num", text: v > 0 ? B.fmt(v) : "" }), h("td", { class: "num", text: v < 0 ? B.fmt(-v) : "" }));
    })), h("p", { class: "fine", text: "Debits " + B.fmt(tb.debits) + ", credits " + B.fmt(tb.credits) + (tb.balanced ? ": balanced." : ": NOT balanced.") })));
    var ents = G.entries.filter(function (e) { return e.date >= from && e.date <= to; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    root.appendChild(h("div", { class: "card" }, h("h2", { text: "Journal (latest 60 of " + ents.length + ")" }), A.table(["Date", "What", "Debit", "Credit"], ents.slice(0, 60).map(function (e) {
      return h("tr", null, h("td", { text: e.date }), h("td", { text: e.memo }), h("td", { text: e.lines.filter(function (l) { return l.dr; }).map(function (l) { return acc[l.a].name + " " + B.fmt(l.dr); }).join("; ") }),
        h("td", { text: e.lines.filter(function (l) { return l.cr; }).map(function (l) { return acc[l.a].name + " " + B.fmt(l.cr); }).join("; ") }));
    }))));
    return root;
  }
})();
