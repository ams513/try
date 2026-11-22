/* Cover letter builder and salary negotiation views. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;

  var STEPS = [
    ["hook", "1. Opening hook", "One or two sentences. Name the role and lead with your single strongest result or a real connection to the company. Do not start with \"I am writing to apply\".", 3,
      "Last year I cut shipping errors by 31%, and I would like to do the same for Harbor Logistics as your Operations Coordinator."],
    ["why", "2. Why this company", "Show you read about them. Mention their product, mission, a recent project or a problem they have, and why it matters to you.", 4,
      "Harbor's same-day delivery promise depends on a warehouse that runs without surprises."],
    ["proof1", "3a. Proof, first example", "One concrete story: what you did, how, and the result with a number. Match it to something in the posting.", 4,
      "At Brightway I built a double-check workflow for 40 daily orders that removed 31% of errors in four months."],
    ["proof2", "3b. Proof, second example", "A second, different strength: for instance teamwork, a tool, or training others.", 4,
      "I also trained 14 new hires and cut onboarding from three weeks to two."],
    ["close", "4. Close", "Say what you want next (a conversation), thank them, and stop. Two sentences at most.", 3,
      "I would welcome a conversation about how I can help your team. Thank you for your time."]
  ];

  SC.views.cover = function (root) {
    var L = SC.S.letter;
    root.innerHTML = '<div class="view-head"><p class="eyebrow">Cover letters</p><h1>Cover letter builder</h1><p class="lede">A strong letter is four short parts on one page, between 250 and 350 words. Fill in each part and the letter assembles itself.</p></div>' +
      '<div class="two"><div><div class="card"><h2>Details</h2><div class="cols">' +
      [["name", "Your name"], ["contact", "Email | phone"], ["date", "Date"], ["recipient", "Recipient (e.g. Ms. Alvarez)"], ["company", "Company"], ["role", "Role you are applying for"]].map(function (f) {
        return '<div><label for="l-' + f[0] + '">' + f[1] + '</label><input id="l-' + f[0] + '" value="' + E(L[f[0]]) + '"></div>';
      }).join("") + "</div></div>" +
      STEPS.map(function (s) {
        return '<div class="card"><h3>' + s[1] + '</h3><div class="hint">' + s[2] + '</div><details><summary class="fine">Example</summary><p class="fine">' + E(s[4]) + '</p></details><label class="sr-only" for="l-' + s[0] + '">' + s[1] + '</label><textarea id="l-' + s[0] + '" rows="' + s[3] + '">' + E(L[s[0]]) + "</textarea></div>";
      }).join("") + '</div><div><div class="card" style="position:sticky;top:5rem"><div class="row"><button type="button" class="btn primary" id="lp">Print or save as PDF</button><button type="button" class="btn" id="lt">Download .txt</button><button type="button" class="btn" id="ld">Word (.docx)</button><button type="button" class="btn" id="lc">Copy as text</button><button type="button" class="btn small" id="ls">Load sample</button></div>' +
      '<h3 style="margin-top:1rem">Letter</h3><pre class="letter" id="lout"></pre><div id="lchk"></div></div></div></div>';

    function render() {
      var text = SC.letterText(L); $("#lout").textContent = text;
      var c = SC.coverCheck(text, { company: L.company, role: L.role });
      $("#lchk").innerHTML = "<h3>Checks: " + c.passed + " of " + c.total + "</h3><ul class=\"checks\">" + c.items.map(function (i) { return '<li class="' + (i.ok ? "ok" : "") + '">' + E(i.msg) + "</li>"; }).join("") + "</ul>";
    }
    render();
    SC.onPrint = function () { SC.printHTML('<div class="paper"><pre class="letter">' + E(SC.letterText(L)) + "</pre></div>"); };
    var saveSoon = SC.debounce(SC.save, 300);
    root.addEventListener("input", function (ev) {
      var id = ev.target.id; if (!id || id.indexOf("l-") !== 0) return;
      L[id.slice(2)] = ev.target.value; render(); saveSoon();
    });
    $("#lp").addEventListener("click", function () { SC.printHTML('<div class="paper"><pre class="letter">' + E(SC.letterText(L)) + "</pre></div>"); });
    $("#lt").addEventListener("click", function () { SC.download("cover_letter.txt", SC.letterText(L)); });
    $("#ld").addEventListener("click", function () { SC.exportLetter(L, "docx"); });
    $("#lc").addEventListener("click", function () { SC.copy(SC.letterText(L)); });
    $("#ls").addEventListener("click", function () { SC.S.letter = SC.sampleLetter(); SC.save(); SC.route(); SC.toast("Sample loaded."); });
  };

  SC.views.salary = function (root) {
    var Z = SC.S.salary;
    function f(id, label, ph, type) { return '<div><label for="z-' + E(id) + '">' + E(label) + '</label><input id="z-' + E(id) + '" type="' + E(type || "text") + '" value="' + E(Z[id] || "") + '"' + (ph ? ' placeholder="' + E(ph) + '"' : "") + "></div>"; }
    root.innerHTML = '<div class="view-head"><p class="eyebrow">Salary negotiation</p><h1>Negotiate the offer</h1><p class="lede">Employers expect a counteroffer. Enter the offer and your numbers and get a counter, an email, a phone script and a line to buy time.</p></div>' +
      '<div class="two"><div class="card"><h2>Your numbers</h2><div class="cols">' + f("offer", "Offer (per year)", "62000", "number") + f("target", "Your target", "70000", "number") + f("low", "Market low", "58000", "number") + f("high", "Market high", "72000", "number") + "</div>" +
      '<div class="cols">' + f("role", "Role", "") + f("company", "Company", "") + f("contact", "Recruiter name", "") + f("name", "Your name", "") + "</div>" +
      '<label for="z-points">Your evidence (one result per line)</label><textarea id="z-points" rows="4" placeholder="Cut errors by 31%&#10;Trained 14 new hires">' + E(Z.points || "") + "</textarea>" +
      '<div class="cols">' + f("other", "Other terms you would ask for", "extra paid time off, remote Fridays") + f("deadline", "Date you can reply by", "Friday") + "</div>" +
      '<div class="row" style="margin-top:.7rem"><button type="button" class="btn primary" id="zgo">Build my plan</button></div></div><div id="zout" class="card" aria-live="polite">' +
      '<h2>Rules of thumb</h2><ul><li>Never give the first number if you can avoid it. Ask for the range.</li><li>Counter once, with evidence, then stop talking.</li><li>Ask for the offer in writing and take a day to think.</li><li>If salary is fixed, negotiate title, start date, bonus, equipment, remote days, review date or paid time off.</li><li>Be warm. You are about to work with these people.</li></ul></div></div>';
    var saveSoon = SC.debounce(SC.save, 300);
    root.addEventListener("input", function (ev) { var id = ev.target.id; if (id && id.indexOf("z-") === 0) { Z[id.slice(2)] = ev.target.value; saveSoon(); } });
    $("#zgo").addEventListener("click", function () {
      var r = SC.negotiate(Z), out = $("#zout");
      if (r.error) { out.innerHTML = '<p class="muted">' + E(r.error) + "</p>"; return; }
      out.innerHTML = '<h2>' + (r.meets ? "Accept the pay, negotiate the rest" : "Counter at " + SC.money(r.counter)) + "</h2>" +
        (r.meets ? "" : '<p class="fine">That is ' + SC.money(r.gap) + " (" + r.pct + "%) above the offer.</p>") +
        r.notes.map(function (n) { return '<div class="hint">' + E(n) + "</div>"; }).join("") +
        '<h3>Email</h3><pre class="script" id="s-email">' + E(r.scripts.email) + '</pre><button type="button" class="btn small" data-copy="s-email">Copy email</button>' +
        '<h3>Phone script</h3><pre class="script" id="s-phone">' + E(r.scripts.phone) + '</pre><button type="button" class="btn small" data-copy="s-phone">Copy script</button>' +
        '<h3>If you need time</h3><pre class="script" id="s-stall">' + E(r.scripts.stall) + '</pre><button type="button" class="btn small" data-copy="s-stall">Copy</button>';
    });
    $("#zout").addEventListener("click", function (ev) { var b = ev.target.closest("[data-copy]"); if (b) SC.copy($("#" + b.getAttribute("data-copy")).textContent); });
  };
})();
