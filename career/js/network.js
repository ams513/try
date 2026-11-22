/* Networking templates (fill-in-the-blank) and the LinkedIn profile helper with character counts. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;
  function marked(text) { return E(text).replace(/\[([a-z0-9 ]+)\]/g, '<mark class="blank">[$1]</mark>'); }
  function meter(c, label) {
    var pct = c.limit ? Math.min(100, Math.round(100 * c.n / c.limit)) : 0;
    return '<div class="meter' + (c.over ? " over" : pct > 90 ? " near" : "") + '"><div class="bar"><i style="width:' + pct + '%"></i></div><span>' + c.n + (c.limit ? " / " + c.limit : "") + " characters" + (label ? " " + label : "") + (c.over ? ": " + (-c.left) + " over" : "") + "</span></div>";
  }
  function prefill() {
    var R = SC.S.resume, sk = String(R.skills || "").split(/\s*[,;\n]\s*/).filter(Boolean), j = R.experience[0] || {};
    var years = []; R.experience.forEach(function (e) { [e.start, e.end].forEach(function (d) { var m = /(19|20)\d{2}/.exec(d || ""); if (m) years.push(+m[0]); else if (/present/i.test(d || "")) years.push(new Date().getFullYear()); }); });
    var best = null, bs = -1; R.experience.forEach(function (e) { (e.bullets || []).forEach(function (b) { var c = SC.coachBullet(b); if (c.checks[1].ok && c.score > bs) { bs = c.score; best = c.text; } }); });
    return { your_name: R.name, your_role: R.title || j.role, role: R.title || j.role, target_role: R.title, location: R.location, company: "", years: years.length ? String(Math.max.apply(null, years) - Math.min.apply(null, years)) : "",
      field: sk[0] ? sk[0].toLowerCase() : "", skill_1: sk[0], skill_2: sk[1], skill_3: sk[2], one_result: best ? best.charAt(0).toLowerCase() + best.slice(1) : "", proof: best || "" };
  }

  SC.views.network = function (root) {
    var N = SC.S.net, L = SC.S.li, tab = SC.sub() === "linkedin" ? "linkedin" : "messages", pre = prefill();
    Object.keys(pre).forEach(function (k) { if (pre[k] && N.vals[k] == null) N.vals[k] = pre[k]; if (pre[k] && L.vals[k] == null) L.vals[k] = pre[k]; });
    if (!L.about.skills && SC.S.resume.skills) L.about.skills = SC.S.resume.skills;
    if (!L.about.proof) {
      var proofs = []; SC.S.resume.experience.forEach(function (e) { (e.bullets || []).forEach(function (b) { var c = SC.coachBullet(b); if (c.checks[1].ok) proofs.push([c.score, c.text]); }); });
      proofs.sort(function (a, b) { return b[0] - a[0]; }); if (proofs.length) L.about.proof = proofs.slice(0, 3).map(function (p) { return p[1]; }).join("\n");
    }

    function tpl() { return SC.data.netTemplates.filter(function (t) { return t.id === N.tpl; })[0] || SC.data.netTemplates[0]; }
    function fieldsHTML(keys, vals, prefix) {
      return '<div class="cols">' + keys.map(function (k) { return '<div><label for="' + prefix + k + '">' + E(SC.fieldLabel(k)) + '</label><input id="' + prefix + k + '" data-v="' + k + '" value="' + E(vals[k] || "") + '"></div>'; }).join("") + "</div>";
    }
    function messages() {
      var t = tpl(), keys = SC.templateFields(t.subject + " " + t.body);
      return '<div class="net"><div class="card tlist"><h2>Templates</h2><ul>' + SC.data.netTemplates.map(function (x) {
        return '<li><button type="button" data-tpl="' + x.id + '" class="' + (x.id === t.id ? "on" : "") + '" aria-pressed="' + (x.id === t.id) + '"><b>' + E(x.name) + "</b><small>" + E(x.use) + "</small></button></li>"; }).join("") + "</ul></div>" +
        '<div class="card"><h2>' + E(t.name) + '</h2><p class="fine">' + E(t.use) + " Fill the blanks; anything left empty stays marked in the message.</p>" + fieldsHTML(keys, N.vals, "nv-") + "</div>" +
        '<div class="card"><h2>Message</h2><div id="nout"></div><div class="row" style="margin-top:.6rem"><button type="button" class="btn primary" id="ncopy" data-primary>Copy message</button><button type="button" class="btn" id="nsent">Mark as sent (+1 this week)</button></div>' +
        '<p class="fine">Tips: send on a weekday morning, keep one clear ask, and follow up once after about a week if there is no reply.</p></div></div>';
    }
    function msgText() { var t = tpl(); return { subject: t.subject ? SC.fillTemplate(t.subject, N.vals) : "", body: SC.fillTemplate(t.body, N.vals) }; }
    function drawMsg() {
      var t = tpl(), m = msgText(), c = SC.charCount(m.body, t.limit), left = SC.blanksLeft(m.subject + " " + m.body);
      $("#nout").innerHTML = (m.subject ? '<p class="fine"><b>Subject:</b> ' + marked(m.subject) + "</p>" : '<p class="fine">LinkedIn connection note (no subject).</p>') + '<pre class="script">' + marked(m.body) + "</pre>" +
        (t.limit ? meter(c, "(keep connection notes under " + t.limit + " so they fit every account)") : meter(c)) +
        (left ? '<p class="fine warn-text">' + left + " blank" + (left > 1 ? "s" : "") + " still to fill.</p>" : '<p class="fine ok-text">All blanks filled.</p>');
    }
    function linkedin() {
      var f = SC.data.liHeadlines.filter(function (x) { return x.id === L.formula; })[0] || SC.data.liHeadlines[0], keys = SC.templateFields(f.tpl);
      return '<div class="two"><div><div class="card"><h2>Headline</h2><p class="fine">The line under your name. It shows in search results and on every comment you post, so lead with the job title recruiters search for.</p>' +
        '<div class="formula" role="group" aria-label="Headline formula">' + SC.data.liHeadlines.map(function (x) { return '<button type="button" data-formula="' + x.id + '" class="' + (x.id === f.id ? "on" : "") + '" aria-pressed="' + (x.id === f.id) + '"><b>' + E(x.name) + "</b><small>" + E(x.ex) + "</small></button>"; }).join("") + "</div>" +
        fieldsHTML(keys, L.vals, "lv-") + '<div id="hout"></div><button type="button" class="btn small" id="hcopy">Copy headline</button></div>' +
        '<div class="card"><h2>Profile checklist</h2><ul class="checklist">' + SC.data.liChecklist.map(function (c, i) { var on = !!(L.check && L.check[i]); return '<li><label class="check"><input type="checkbox" data-ck="' + i + '"' + (on ? " checked" : "") + "> " + E(c) + "</label></li>"; }).join("") + "</ul></div></div>" +
        '<div class="card"><h2>About section</h2><p class="fine">Five short parts. Your resume filled in the proof and skills; edit them so they read like you talking.</p>' +
        SC.data.liAboutParts.map(function (p) { return '<label for="la-' + p.id + '">' + E(p.label) + '</label><textarea id="la-' + p.id + '" data-about="' + p.id + '" rows="' + (p.id === "story" || p.id === "proof" ? 3 : 2) + '" placeholder="' + E(p.ph) + '">' + E(L.about[p.id] || "") + "</textarea>"; }).join("") +
        '<div id="aout"></div><button type="button" class="btn small" id="acopy">Copy About section</button></div></div>';
    }
    function headline() { var f = SC.data.liHeadlines.filter(function (x) { return x.id === L.formula; })[0] || SC.data.liHeadlines[0]; return SC.fillTemplate(f.tpl, L.vals); }
    function drawLI() {
      var h = headline(), a = SC.liAbout(L.about), ca = SC.charCount(a, SC.LI.about), cut = Math.min(a.length, SC.LI.seeMore);
      $("#hout").innerHTML = '<pre class="script headline">' + marked(h) + "</pre>" + meter(SC.charCount(h, SC.LI.headline));
      $("#aout").innerHTML = '<h3>Preview</h3><pre class="script about"><span class="above">' + E(a.slice(0, cut)) + '</span>' + (a.length > cut ? '<span class="fold">' + E(a.slice(cut)) + "</span>" : "") + "</pre>" +
        '<p class="fine">The highlighted opening is roughly what shows before "see more" (about ' + SC.LI.seeMore + " characters, depending on the screen). Make it count.</p>" + meter(ca);
    }
    function draw() {
      root.innerHTML = '<div class="view-head"><p class="eyebrow">Network</p><h1>Networking and LinkedIn</h1><p class="lede">Most jobs are filled through people. Fill-in-the-blank messages for every situation, and formulas for a LinkedIn profile that gets found.</p></div>' +
        '<div class="tabs" role="tablist"><button type="button" role="tab" data-tab="messages" class="' + (tab === "messages" ? "on" : "") + '" aria-selected="' + (tab === "messages") + '">Messages</button><button type="button" role="tab" data-tab="linkedin" class="' + (tab === "linkedin" ? "on" : "") + '" aria-selected="' + (tab === "linkedin") + '">LinkedIn profile</button></div>' +
        '<div id="npane">' + (tab === "messages" ? messages() : linkedin()) + "</div>";
      if (tab === "messages") drawMsg(); else drawLI();
    }
    draw();
    var saveSoon = SC.debounce(SC.save, 300);
    root.addEventListener("input", function (ev) {
      var t = ev.target, k = t.getAttribute("data-v"), ab = t.getAttribute("data-about");
      if (k) { (tab === "messages" ? N.vals : L.vals)[k] = t.value; if (tab === "messages") drawMsg(); else drawLI(); saveSoon(); }
      else if (ab) { L.about[ab] = t.value; drawLI(); saveSoon(); }
    });
    root.addEventListener("change", function (ev) { var c = ev.target.getAttribute("data-ck"); if (c != null) { L.check = L.check || {}; L.check[c] = ev.target.checked; SC.save(); } });
    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-tab")) { tab = b.getAttribute("data-tab"); draw(); }
      else if (b.hasAttribute("data-tpl")) { N.tpl = b.getAttribute("data-tpl"); SC.save(); draw(); }
      else if (b.hasAttribute("data-formula")) { L.formula = b.getAttribute("data-formula"); SC.save(); draw(); }
      else if (b.id === "ncopy") { var m = msgText(); SC.copy((m.subject ? "Subject: " + m.subject + "\n\n" : "") + m.body); }
      else if (b.id === "nsent") { SC.log("net"); SC.toast("Logged. " + SC.sprintWeek(SC.S.sprint.log, SC.S.sprint.goals, SC.today()).per.net.done + " networking messages this week."); }
      else if (b.id === "hcopy") SC.copy(headline());
      else if (b.id === "acopy") SC.copy(SC.liAbout(L.about));
    });
  };
})();
