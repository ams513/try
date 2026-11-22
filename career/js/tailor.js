/* Job match and one-click tailoring, with saved resume versions linked to the tracker. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;

  SC.versionsHTML = function () {
    var V = SC.S.versions;
    if (!V.length) return '<p class="muted">No saved versions yet. Tailor your resume to a posting and save it here, one version per application.</p>';
    return '<ul class="vlist">' + V.map(function (v) {
      var app = v.appId ? SC.S.apps.filter(function (a) { return a.id === v.appId; })[0] : null;
      return '<li data-v="' + v.id + '"><div><b>' + E(v.name) + '</b><span class="fine">' + E(v.created) + (v.score != null ? " &middot; match " + v.score + "%" : "") +
        (app ? ' &middot; <a href="#/tracker">' + E(SC.STAGE_LABEL[app.stage]) + " in tracker</a>" : "") + '</span></div><div class="row">' +
        '<button type="button" class="btn tiny" data-vact="print">Print</button><button type="button" class="btn tiny ghost" data-vact="main">Make main</button>' +
        (app ? "" : '<button type="button" class="btn tiny ghost" data-vact="track">Track</button>') + '<button type="button" class="btn tiny danger" data-vact="del">Delete</button></div></li>';
    }).join("") + "</ul>";
  };
  SC.versionAction = function (id, act, btn) {
    var V = SC.S.versions, i = V.findIndex(function (v) { return v.id === id; }), v = V[i]; if (!v) return false;
    if (act === "print") SC.printResume(v.resume, false);
    else if (act === "main") { SC.saveVersion(SC.S.resume, { name: "Main resume before \"" + v.name + "\"" }); SC.S.resume = JSON.parse(JSON.stringify(v.resume)); SC.save(); SC.toast("That version is now your main resume. The old main is saved as a version."); return true; }
    else if (act === "track") { var a = SC.newApp({ company: v.company, role: v.role, stage: "wishlist" }, SC.today()); a.versionId = v.id; v.appId = a.id; SC.S.apps.unshift(a); SC.save(); SC.toast("Added to the tracker as Wishlist."); return true; }
    else if (act === "del") {
      if (btn.getAttribute("data-sure") !== "1") { btn.setAttribute("data-sure", "1"); btn.textContent = "Sure?"; return false; }
      SC.S.apps.forEach(function (a) { if (a.versionId === id) a.versionId = null; }); V.splice(i, 1); SC.save(); return true;
    }
    return false;
  };

  SC.views.match = function (root) {
    var S = SC.S, T = null, dismissed = {}, job = "";
    root.innerHTML = '<div class="view-head"><p class="eyebrow">Tailor</p><h1>Tailor your resume to a job</h1><p class="lede">Paste a posting. In one click you get a keyword match, a tailored copy (matching skills first, the most relevant bullets on top, the summary reordered) and the missing keywords, each with an honest "add only if true" prompt. Save one version per application.</p></div>' +
      '<div class="two"><div class="card"><label for="job">Job posting</label><textarea id="job" rows="13" placeholder="Paste the full posting here">' + E(S.jobText) + "</textarea>" +
      '<div class="cols"><div><label for="t-role">Role</label><input id="t-role" value="' + E(S.tailor.role) + '" placeholder="Found in the posting"></div><div><label for="t-company">Company</label><input id="t-company" value="' + E(S.tailor.company) + '" placeholder="Found in the posting"></div></div>' +
      '<label for="src">Compare against</label><select id="src"><option value="built">My resume from the builder (tailor it)</option><option value="paste">Text I paste below (score only)</option></select>' +
      '<div id="pastebox" hidden><label for="rtext">Resume text</label><textarea id="rtext" rows="8">' + E(S.matchResume) + "</textarea></div>" +
      '<div class="row" style="margin-top:.7rem"><button type="button" class="btn primary" id="go" data-primary>Tailor my resume</button><span class="fine"><kbd>Ctrl Enter</kbd></span></div>' +
      '<div class="row" style="margin-top:.6rem"><button type="button" class="btn" id="p-rep">Word-overlap report</button><label class="sr-only" for="p-stage">Stage for the saved job</label><select id="p-stage" class="inline"><option value="wishlist">Wishlist</option><option value="applied">Applied</option></select><button type="button" class="btn" id="p-save">Save posting as a job</button></div>' +
      '<p class="fine">The report and the saved job use the posting above. Everything runs on this device with plain rules.</p></div>' +
      '<div id="out" class="card" aria-live="polite"><h2>What you get</h2><ul class="checks"><li class="ok">A match score and the key terms you cover or miss.</li><li class="ok">A tailored copy: matching skills moved up, the most relevant bullets first in each job.</li><li class="ok">Missing keywords with honest prompts. Nothing is added unless you say it is true.</li><li class="ok">One saved version per application, linked to your tracker.</li></ul></div></div>' +
      '<div id="rep" class="card" aria-live="polite" hidden></div>' +
      '<div class="card"><div class="card-head"><h2>Saved versions</h2><span class="fine">' + S.versions.length + " saved</span></div><div id=\"vers\">" + SC.versionsHTML() + "</div></div>";
    var src = $("#src"); src.value = S.matchSource;
    function vis() { $("#pastebox").hidden = src.value !== "paste"; $("#go").textContent = src.value === "paste" ? "Check the match" : "Tailor my resume"; }
    vis(); src.addEventListener("change", function () { S.matchSource = src.value; vis(); SC.save(); });
    var saveSoon = SC.debounce(SC.save, 300);
    root.addEventListener("input", function (ev) {
      var id = ev.target.id;
      if (id === "job") S.jobText = ev.target.value; else if (id === "rtext") S.matchResume = ev.target.value;
      else if (id === "t-role") S.tailor.role = ev.target.value; else if (id === "t-company") S.tailor.company = ev.target.value; else return;
      saveSoon();
    });
    SC.onPrint = function () { SC.printResume(T ? T.resume : S.resume, false); };

    function matchHTML(m) {
      var label = { strong: "Strong match", fair: "Fair match", weak: "Weak match", none: "Nothing to compare" }[m.band];
      return '<div class="row">' + SC.ringHTML(m.score, m.score + "%") + "<div><h2>" + label + '</h2><p class="fine">' + m.matched.length + " of " + m.total + " key terms found. A keyword check, not a verdict on you.</p></div></div>" +
        '<h3>Found in your resume</h3><p class="chips">' + (m.matched.length ? m.matched.map(function (k) { return '<span class="chip ok">' + E(k.label) + "</span>"; }).join("") : '<span class="muted">None yet.</span>') + "</p>" +
        '<h3>Missing, most important first</h3><p class="chips">' + (m.missing.length ? m.missing.map(function (k) { return '<span class="chip no">' + E(k.label) + (k.count > 1 ? " x" + k.count : "") + "</span>"; }).join("") : '<span class="muted">Nothing missing.</span>') + "</p>";
    }
    function tailorHTML() {
      var now = SC.matchJob(SC.resumeText(T.resume), job), gain = now.score - T.match.score;
      var miss = T.missing.filter(function (k) { return !dismissed[k.label]; }).slice(0, 10);
      return matchHTML(T.match) +
        '<h2 class="section-title">Your tailored copy</h2><div class="stat">' +
        "<div><b>" + T.skillsUp + "</b>skills moved up</div><div><b>" + T.bulletsMoved + "</b>bullets reordered</div><div><b>" + T.topBefore + "% &rarr; " + T.topAfter + "%</b>matching evidence in each job's top 3 bullets</div>" +
        (gain > 0 ? "<div><b>" + now.score + "%</b>match with your additions</div>" : "") + "</div>" +
        (T.summaryMoved ? '<p class="fine">Your summary now leads with the sentence closest to this job (your opening line stays first).</p>' : "") +
        (miss.length ? '<h3>Missing keywords: add only if true</h3><ul class="kw">' + miss.map(function (k) {
          var added = SC.relevance(T.resume.skills, [{ key: SC.stemList(k.label).join(" "), label: k.label, weight: 1, phrase: SC.stemList(k.label).length > 1 }]).score > 0;
          return '<li data-kw="' + E(k.label) + '"><div><b>' + E(k.label) + "</b><span>" + E(k.prompt) + '</span><span class="frame" hidden>Bullet frame: ' + E(k.frame) + '</span></div><div class="row">' +
            (added ? '<span class="chip ok">Added to skills</span>' : '<button type="button" class="btn tiny primary" data-kwadd>It is true: add to skills</button>') +
            '<button type="button" class="btn tiny ghost" data-kwframe>Bullet frame</button><button type="button" class="btn tiny ghost" data-kwno>Not true</button></div></li>';
        }).join("") + "</ul>" : "") +
        '<div class="row" style="margin-top:.8rem"><label for="t-stage" class="sr-only">Stage</label><select id="t-stage" class="inline"><option value="wishlist">Track as Wishlist</option><option value="applied">Track as Applied</option></select>' +
        '<button type="button" class="btn primary" id="t-save-track">Save version and track</button><button type="button" class="btn" id="t-save">Save version only</button><button type="button" class="btn" id="t-print">Print tailored copy</button><button type="button" class="btn ghost" id="t-main">Make it my main resume</button></div>' +
        '<details class="tpv"><summary>Preview the tailored copy</summary><div class="paper-wrap"><div class="paper-mini"><div class="paper">' + SC.renderResume(T.resume, T.resume.template) + "</div></div></div></details>";
    }
    function run() {
      job = $("#job").value; S.jobText = job;
      var meta = SC.postingMeta(job);
      if (!$("#t-role").value.trim() && meta.role) { $("#t-role").value = meta.role; S.tailor.role = meta.role; }
      if (!$("#t-company").value.trim() && meta.company) { $("#t-company").value = meta.company; S.tailor.company = meta.company; }
      SC.save();
      var out = $("#out"), paste = src.value === "paste";
      if (!job.trim()) { out.innerHTML = '<p class="muted">Paste a job posting first.</p>'; return; }
      if (paste) {
        var res = $("#rtext").value; if (!res.trim()) { out.innerHTML = '<p class="muted">Paste your resume text below the menu, or switch to your builder resume.</p>'; return; }
        T = null; out.innerHTML = matchHTML(SC.matchJob(res, job)) + '<div class="hint">Add a missing term only where it is true. Switch to "My resume from the builder" to get a tailored copy.</div>'; return;
      }
      if (!SC.hasResume()) { out.innerHTML = '<p class="muted">Your resume is empty. <a href="#/import">Import one</a>, use the <a href="#/start">10-minute flow</a>, or paste text and choose "Text I paste below".</p>'; return; }
      var t1 = performance.now(); T = SC.tailorResume(S.resume, job); SC.perf.tailor = Math.round((performance.now() - t1) * 10) / 10; dismissed = {};
      out.innerHTML = tailorHTML(); out.classList.remove("enter"); void out.offsetWidth; out.classList.add("enter");
    }
    function repResume() { return src.value === "paste" ? $("#rtext").value : SC.resumeText(S.resume); }
/* full version only */
    $("#p-rep").addEventListener("click", function () {
      var post = $("#job").value, box = $("#rep"), rt = repResume();
      S.jobText = post; SC.save();
      box.hidden = false;
      if (!post.trim()) { box.innerHTML = '<p class="muted">Paste a job posting first.</p>'; return; }
      if (!rt.trim()) { box.innerHTML = '<p class="muted">Your resume is empty. <a href="#/import">Import one</a>, or switch "Compare against" to pasted text.</p>'; return; }
      box.innerHTML = window.StarkTrial.cardHTML("posting_report");
    });
/* full version only */
    $("#p-save").addEventListener("click", function () {
      var post = $("#job").value;
      if (!post.trim()) { SC.toast("Paste a job posting first."); return; }
      if (!SC.canAddApp()) return;
      var meta = SC.postingMeta(post), a = SC.newApp({ company: $("#t-company").value.trim() || meta.company, role: $("#t-role").value.trim() || meta.role, stage: $("#p-stage").value }, SC.today());
      if (!a.company && !a.role) a.role = "Saved posting";
      S.apps.unshift(a); if (a.stage === "applied") SC.log("apps"); SC.save();
      SC.toast("Saved to the tracker as " + SC.STAGE_LABEL[a.stage] + ": " + (a.role || "job") + (a.company ? " at " + a.company : "") + ".");
    });
    $("#go").addEventListener("click", run);
    function vname() { var r = $("#t-role").value.trim(), c = $("#t-company").value.trim(); return (r || "Tailored resume") + (c ? " at " + c : "") ; }
    $("#out").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b || !T) return;
      var li = b.closest("[data-kw]"), kw = li ? li.getAttribute("data-kw") : null;
      if (b.hasAttribute("data-kwadd")) { T.resume.skills = SC.addSkill(T.resume.skills, kw.charAt(0).toUpperCase() + kw.slice(1)); $("#out").innerHTML = tailorHTML(); SC.toast("Added \"" + kw + "\" to this tailored copy only."); }
      else if (b.hasAttribute("data-kwframe")) { var fr = li.querySelector(".frame"); fr.hidden = !fr.hidden; }
      else if (b.hasAttribute("data-kwno")) { dismissed[kw] = 1; $("#out").innerHTML = tailorHTML(); }
      else if (b.id === "t-save" || b.id === "t-save-track") {
        var score = SC.matchJob(SC.resumeText(T.resume), job).score;
        var v = SC.saveVersion(T.resume, { name: vname(), role: $("#t-role").value.trim(), company: $("#t-company").value.trim(), score: score, jobText: job.slice(0, 6000) });
        var wantTrack = b.id === "t-save-track", track = wantTrack && SC.canAddApp();
        if (track) {
          var stage = $("#t-stage").value, a = SC.newApp({ company: v.company, role: v.role, stage: stage, notes: "Tailored resume version: " + v.name }, SC.today());
          a.versionId = v.id; v.appId = a.id; SC.S.apps.unshift(a); if (stage === "applied") SC.log("apps"); SC.save();
          SC.toast("Saved and added to the tracker as " + SC.STAGE_LABEL[stage] + ".");
        } else if (!wantTrack) SC.toast("Version saved.");
        $("#vers").innerHTML = SC.versionsHTML();
      }
      else if (b.id === "t-print") SC.printResume(T.resume, false);
      else if (b.id === "t-main") { SC.saveVersion(S.resume, { name: "Main resume before tailoring for " + vname() }); S.resume = JSON.parse(JSON.stringify(T.resume)); SC.save(); SC.toast("Your main resume is now the tailored copy. The old one is saved as a version."); $("#vers").innerHTML = SC.versionsHTML(); }
    });
    $("#vers").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-vact]"); if (!b) return;
      if (SC.versionAction(b.closest("[data-v]").getAttribute("data-v"), b.getAttribute("data-vact"), b)) $("#vers").innerHTML = SC.versionsHTML();
    });
  };
})();
