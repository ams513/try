/* Stark Family Vault, by Stark: Insights (ask your vault, 12-month look ahead, gaps, crisis drills), Recovery kit (split-passphrase shares)
   and the Ctrl+K command palette. Everything runs on this computer. Built with textContent and createElementNS only, never parsed markup. */
(function () {
  "use strict";
  var A = window.VaultApp, V = StarkVault, I = VaultIntel, K = VaultKit, U = VaultUI, h = U.h, btn = A.btn, badge = A.badge;
  var SVGNS = "http://www.w3.org/2000/svg";
  function vault() { return A.S.vault; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function money(n) { return A.money(n); }
  function svg(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag), k, kids = Array.prototype.slice.call(arguments, 2);
    for (k in (attrs || {})) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    kids.forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }

  /* ---------- Ask your vault ---------- */
  var EXAMPLES = ["What expires in the next 90 days?", "How much do we pay for insurance?", "What is in the kitchen worth?", "Which medicines are active?", "Who do we call in an emergency?", "What is overdue?"];
  function askCard() {
    var input = h("input", { id: "ask-q", type: "text", maxlength: 160, autocomplete: "off", placeholder: "Ask in your own words, for example: what renews next month?" }),
      out = h("div", { class: "ask-out" }), said = h("p", { class: "sr-only", "aria-live": "polite" });   // only the one-line answer is announced, not the whole list
    function run(q) {
      var r, ul;
      U.clear(out);
      q = String(q || "").trim();
      if (!q) { said.textContent = ""; return; }
      r = I.ask(vault(), q);
      said.textContent = r.answer + (r.items.length ? " " + r.items.length + (r.items.length === 1 ? " record" : " records") + " listed below." : "");
      out.appendChild(h("p", { class: "ask-answer", text: r.answer }));
      if (r.items.length) {
        ul = h("ul", { class: "asklist" }, r.items.map(function (it) {
          return h("li", null, h("a", { href: "#/" + it.route }, h("strong", { text: it.title })), it.detail ? h("span", { class: "fine", text: " " + it.detail }) : null);
        }));
        out.appendChild(ul);
      }
      out.appendChild(h("p", { class: "fine", text: "Answered on this computer from what you have recorded. It reads your records; it does not know anything else." }));
    }
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); run(input.value); } });
    if (A.S.ask) { input.value = A.S.ask; A.S.ask = ""; setTimeout(function () { run(input.value); }, 0); }
    return h("div", { class: "card ask" }, h("h2", { text: "Ask your vault" }),
      h("div", { class: "field wide" }, h("label", { for: "ask-q", text: "Your question" }), h("div", { class: "row" }, input, btn("Ask", "primary", function () { run(input.value); }))),
      h("div", { class: "row wrap chips" }, EXAMPLES.map(function (q) { return h("button", { type: "button", class: "chipbtn", text: q, onclick: function () { input.value = q; run(q); input.focus(); } }); })),
      said, out);
  }

  /* ---------- 12-month look ahead ---------- */
  function chart(fc) {
    var W = 720, H = 230, L = 10, R = 10, T = 26, B = 30, cw = (W - L - R) / fc.months.length, bw = Math.min(40, cw * 0.62), ph = H - T - B, g = svg("g"), pts = [], dots = [], desc;
    fc.months.forEach(function (m, i) {
      var x = L + i * cw + (cw - bw) / 2, bh = m.count ? Math.max(3, Math.round(m.count / fc.max * ph)) : 0, cx = L + i * cw + cw / 2;
      if (bh) g.appendChild(svg("rect", { class: "ch-bar" + (m.crunch ? " crunch" : "") + (m.overdue ? " late" : ""), x: x, y: T + ph - bh, width: bw, height: bh, rx: 4 }));
      if (m.count) g.appendChild(svg("text", { class: "ch-num", x: cx, y: T + ph - bh - 5, "text-anchor": "middle" }, String(m.count)));
      g.appendChild(svg("text", { class: "ch-lab", x: cx, y: H - 10, "text-anchor": "middle" }, m.short));
      if (fc.total > 0) { var py = T + ph - Math.round(m.premium / fc.maxPremium * ph); pts.push(Math.round(cx) + "," + py); dots.push(svg("circle", { class: "ch-dot" + (m.spike ? " spike" : ""), cx: cx, cy: py, r: m.spike ? 5 : 3 })); }
    });
    g.appendChild(svg("line", { class: "ch-axis", x1: L, x2: W - R, y1: T + ph, y2: T + ph }));
    if (pts.length) { g.appendChild(svg("polyline", { class: "ch-line", points: pts.join(" "), fill: "none" })); dots.forEach(function (d) { g.appendChild(d); }); }
    desc = "Dates due per month for the next 12 months: " + fc.months.map(function (m) { return m.short + " " + m.count; }).join(", ") + (fc.total > 0 ? ". Premiums total about " + money(fc.total) + "." : ".");
    return svg("svg", { class: "chart", viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": desc, preserveAspectRatio: "xMidYMid meet" }, svg("title", null, desc), g);
  }
  function aheadCard() {
    var fc = I.forecast(vault(), V.todayStr(), 12), card = h("div", { class: "card" }, h("h2", { text: "The year ahead" }),
      h("p", { class: "muted", text: fc.dates ? plural(fc.dates, "date") + " in the next 12 months" + (fc.total > 0 ? ", and about " + money(fc.total) + " in recorded premiums." : ".") : "Add expiry dates, renewals and refills and they appear here month by month." }));
    if (!fc.dates && !fc.total) return card;
    fc.notes.forEach(function (n) { card.appendChild(h("div", { class: "banner warn", text: n.text })); });
    card.appendChild(chart(fc));
    card.appendChild(h("p", { class: "fine legend" }, h("span", { class: "key bar" }), " dates due per month   ", h("span", { class: "key crunch" }), " pile-up   ", h("span", { class: "key line" }), " premiums paid (line, scaled to the busiest month)"));
    fc.months.forEach(function (m, i) {
      if (!m.count && !m.premium) return;
      card.appendChild(h("details", { class: "month", open: i === 0 && m.count > 0 }, h("summary", null, h("strong", { text: m.label }), " ", m.count ? plural(m.count, "date") : "", m.count && m.premium ? " · " : "", m.premium ? "about " + money(m.premium) + " premiums" : "", m.crunch ? " " : "", m.crunch ? badge("Pile-up", "soon") : null),
        m.events.length ? h("ul", { class: "remlist" }, m.events.map(function (e) { return h("li", { class: e.overdue ? "expired" : "" }, h("a", { href: "#/" + e.route, text: e.title }), h("span", { class: "fine", text: (e.overdue ? "overdue since " : "") + e.date })); })) : h("p", { class: "fine", text: "Premiums only." })));
    });
    return card;
  }

  /* ---------- gaps ---------- */
  function gapsCard() {
    var g = I.gaps(vault(), V.todayStr()), cls = { high: "expired", med: "soon", low: "" }, word = { high: "Worth fixing first", med: "Worth fixing", low: "Tidy-up" };
    return h("div", { class: "card" }, h("h2", { text: "Gaps and oddities" }),
      h("p", { class: "muted", text: g.length ? plural(g.length, "thing") + " noticed in what you have recorded. These are prompts to look, not verdicts." : "Nothing stands out in what is recorded. That says nothing about what has not been entered." }),
      g.length ? h("ul", { class: "gaplist" }, g.map(function (x) {
        return h("li", { class: "gap " + x.level }, h("div", { class: "grow" }, h("strong", { text: x.title }), h("div", { class: "fine", text: x.detail })), badge(word[x.level], cls[x.level]), h("a", { class: "btn small", href: "#/" + x.route, text: "Open" }));
      })) : null);
  }

  /* ---------- crisis drills ---------- */
  function ring(pct) {
    var C = 2 * Math.PI * 26, cls = pct >= 80 ? "good" : pct >= 50 ? "mid" : "low";
    return svg("svg", { class: "ring " + cls, viewBox: "0 0 64 64", width: 64, height: 64, "aria-hidden": "true" }, svg("circle", { class: "ring-bg", cx: 32, cy: 32, r: 26, fill: "none" }),
      svg("circle", { class: "ring-fg", cx: 32, cy: 32, r: 26, fill: "none", "stroke-dasharray": (C * pct / 100).toFixed(1) + " " + C.toFixed(1), transform: "rotate(-90 32 32)" }), svg("text", { x: 32, y: 37, "text-anchor": "middle" }, pct + "%"));
  }
  function drillsCard() {
    var ds = I.drills(vault(), V.todayStr());
    return h("div", { class: "card" }, h("h2", { text: "Crisis drills" }),
      h("p", { class: "muted", text: "Pick a bad day and see what your records would give you. Each drill checks only what is written down here." }),
      h("div", { class: "cards drills" }, ds.map(function (d) {
        return h("details", { class: "drill" }, h("summary", null, ring(d.score), h("span", { class: "grow" }, h("strong", { text: d.title }), h("span", { class: "fine", text: d.blurb + " " + d.ok + " of " + d.checks.length + " ready." }))),
          h("ul", { class: "checklist" }, d.checks.map(function (c) {
            return h("li", { class: c.ok ? "ok" : "miss" }, h("span", { class: "tick", "aria-hidden": "true", text: c.ok ? "✓" : "✗" }), h("div", { class: "grow" }, h("span", { class: "sr", text: c.ok ? "Ready: " : "Missing: " }), c.label, c.ok ? null : h("div", { class: "fine" }, c.tip + " ", h("a", { href: "#/" + c.route, text: "Open" }))));
          })));
      })));
  }
  A.views.insights = function () {
    var wrap = h("div", null, A.section("Insights", "Smart answers, a look at the year ahead, gaps and what-if drills, worked out on this computer from your own records."));
    wrap.appendChild(askCard()); wrap.appendChild(aheadCard()); wrap.appendChild(gapsCard()); wrap.appendChild(drillsCard());
    return wrap;
  };

/* full version only */
  /* ---------- command palette (Ctrl+K) ---------- */
  var ASKY = /\?|^(what|when|which|who|how|where|do|does|is|are|show|list|find|any|total)\b/i;
  function paletteItems(q) {
    var out = [], qn = I.norm(q), r, nav = Array.prototype.slice.call(document.querySelectorAll("#nav a"));
    nav.forEach(function (a) { var s = qn ? I.fuzzy(qn, a.textContent) : 0.3; if (s > 0) out.push({ kind: "Go to", label: a.textContent, score: s + (qn ? 0.05 : 0), run: function () { location.hash = a.getAttribute("href"); } }); });
    [["Lock now", function () { document.getElementById("lock-btn").click(); }], ["Switch light or dark theme", function () { document.getElementById("theme-btn").click(); }],
      ["Ask your vault", function () { location.hash = "#/insights"; }]].forEach(function (a) { var s = qn ? I.fuzzy(qn, a[0]) : 0.2; if (s > 0) out.push({ kind: "Action", label: a[0], score: s, run: a[1] }); });
    if (qn) {
      r = I.ask(vault(), q);
      if (r.intent !== "search" && r.intent !== "none" && ASKY.test(q.trim())) out.unshift({ kind: "Answer", label: r.answer, score: 9, run: function () { A.S.ask = q; location.hash = "#/insights"; if (A.S.route === "insights") A.render(); } });
      I.fuzzySearch(vault(), q, 10).forEach(function (m) { out.push({ kind: m.section, label: m.title, score: m.score - 0.01, run: function () { location.hash = "#/" + m.route; } }); });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 12);
  }
  function openPalette() {
    var input = h("input", { id: "pal-q", type: "text", role: "combobox", "aria-expanded": "true", "aria-controls": "pal-list", "aria-autocomplete": "list", "aria-label": "Search, jump to a section or ask a question", placeholder: "Search, jump to a section, or ask a question", autocomplete: "off", maxlength: 120 }),
      list = h("ul", { id: "pal-list", class: "pal-list", role: "listbox", "aria-label": "Results" }), items = [], sel = 0, dlg;
    if (!vault() || document.querySelector("dialog[open]")) return;
    function draw() {
      U.clear(list); items = paletteItems(input.value);
      if (sel >= items.length) sel = Math.max(0, items.length - 1);
      items.forEach(function (it, i) {
        list.appendChild(h("li", { id: "pal-" + i, role: "option", class: "pal-item" + (i === sel ? " on" : ""), "aria-selected": i === sel ? "true" : "false", onclick: function () { go(i); } }, h("span", { class: "tag", text: it.kind }), " ", h("span", { text: it.label })));
      });
      if (!items.length) list.appendChild(h("li", { class: "pal-empty", text: "Nothing matched. Try fewer or shorter words." }));
      input.setAttribute("aria-activedescendant", items.length ? "pal-" + sel : "");
    }
    function go(i) { var it = items[i]; if (!it) return; dlg.close(); it.run(); }
    input.addEventListener("input", function () { sel = 0; draw(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); go(sel); }
    });
    dlg = U.modal("Quick find", h("div", { class: "dlg-body pal" }, input, list, h("p", { class: "fine", text: "Arrow keys to move, Enter to open, Esc to close. Try “what renews next month” or “passport”." })), { onclose: function () { document.body.classList.remove("pal-open"); } });
    draw(); input.focus();
  }
  A.openPalette = openPalette;
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === "k" || e.key === "K")) { if (!vault()) return; e.preventDefault(); openPalette(); }
  });
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("palette-btn");
    if (b) b.addEventListener("click", openPalette);
  });
})();
