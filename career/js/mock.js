/* Mock interview mode: random questions for a role, think time, a countdown with auto-advance, optional local recording,
   a self-scored rubric per answer and a scorecard with drills. No speech-to-text: there is no network and no AI. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;
  function fmt(sec) { sec = Math.max(0, Math.ceil(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }

  SC.mockPane = function (pane, ALL, IV) {
    var cfg = Object.assign({ role: SC.mockRole || "general", n: 5, ans: 120, prep: 15, rec: false, video: false }, SC.S.iv.mockCfg || {});
    if (SC.mockRole) { cfg.role = SC.mockRole; SC.mockRole = null; }
    var M = { phase: "setup", qs: [], i: 0, deadline: 0, started: 0, answers: [], stream: null, mr: null, h: 0, note: "" };
    SC._mock = M;
    var canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

    function stopTick() { clearInterval(M.h); M.h = 0; }
    function stopRecorder() { if (M.mr && M.mr.state !== "inactive") { try { M.mr.stop(); } catch (e) { } } M.mr = null; }
    function stopAll() {
      stopTick(); stopRecorder();
      if (M.stream) { M.stream.getTracks().forEach(function (t) { t.stop(); }); M.stream = null; }
    }
    function freeUrls() { M.answers.forEach(function (a) { if (a.url) URL.revokeObjectURL(a.url); }); }
    SC.cleanups.push(function () { stopAll(); freeUrls(); SC._mock = null; });

    function setup() {
      var hist = (IV.mocks || []).slice(-5).reverse();
      pane.innerHTML = '<div class="two"><div class="card"><h2>Mock interview</h2><p class="fine">A random set of questions for the role, read one at a time. Think, answer out loud, and the next question comes up when the time runs out.</p>' +
        '<div class="cols"><div><label for="m-role">Role</label><select id="m-role">' + SC.data.roles.map(function (r) { return '<option value="' + r.id + '"' + (cfg.role === r.id ? " selected" : "") + ">" + E(r.name) + "</option>"; }).join("") + "</select></div>" +
        '<div><label for="m-n">Questions</label><select id="m-n">' + [3, 5, 8].map(function (n) { return '<option value="' + n + '"' + (cfg.n === n ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</select></div>" +
        '<div><label for="m-ans">Answer time</label><select id="m-ans">' + [60, 90, 120, 180].map(function (n) { return '<option value="' + n + '"' + (cfg.ans === n ? " selected" : "") + ">" + fmt(n) + "</option>"; }).join("") + "</select></div>" +
        '<div><label for="m-prep">Thinking time</label><select id="m-prep">' + [0, 10, 15, 30].map(function (n) { return '<option value="' + n + '"' + (cfg.prep === n ? " selected" : "") + ">" + (n ? n + " seconds" : "None") + "</option>"; }).join("") + "</select></div></div>" +
        (canRec ? '<label class="check"><input type="checkbox" id="m-rec"' + (cfg.rec ? " checked" : "") + '> Record each answer so I can replay it</label><label class="check"><input type="checkbox" id="m-vid"' + (cfg.video ? " checked" : "") + "> Include video</label>" :
          '<p class="muted">Recording is not available in this browser or context. Practise out loud, or record on a phone.</p>') +
        '<div class="hint">Recordings stay in this browser\'s memory and are gone when you leave the page. <b>There is no speech-to-text</b>: Stark Career has no network and no AI, so it cannot transcribe or judge your words. You score each answer yourself with a five-point rubric.</div>' +
        '<div class="row" style="margin-top:.8rem"><button type="button" class="btn primary" id="m-start" data-primary>Start the interview</button><span class="fine"><kbd>Ctrl Enter</kbd></span></div></div>' +
        '<div class="card"><h2>How it is scored</h2><ul class="checks">' + SC.data.rubric.map(function (r) { return '<li class="ok"><b>' + E(r.name) + ":</b> " + E(r.q) + "</li>"; }).join("") + "</ul>" +
        '<p class="fine">Each is 0 (no), 1 (partly) or 2 (yes). The scorecard points you to the drills for your weakest areas.</p>' +
        (hist.length ? "<h3>Recent mock interviews</h3><ul class=\"bank\">" + hist.map(function (h) { return "<li>" + E(h.date) + ": " + E(h.roleName || h.role) + ", " + h.n + " questions, <b>" + h.pct + "%</b></li>"; }).join("") + "</ul>" : "") + "</div></div>";
    }

    function begin() {
      ["role", "n", "ans", "prep"].forEach(function (k) { var el = $("#m-" + k); if (el) cfg[k] = k === "role" ? el.value : +el.value; });
      cfg.rec = !!($("#m-rec") && $("#m-rec").checked); cfg.video = !!($("#m-vid") && $("#m-vid").checked);
      SC.S.iv.mockCfg = cfg; SC.save();
      M.qs = SC.pickMock(ALL, cfg.role, cfg.n); M.i = 0; M.answers = M.qs.map(function (q) { return { q: q, scores: {}, secs: 0, url: null, video: false }; }); M.started = Date.now(); M.note = "";
      if (!M.qs.length) { SC.toast("No questions for that role."); return; }
      if (cfg.rec && canRec) {
        pane.innerHTML = '<div class="card"><p>Asking the browser for the ' + (cfg.video ? "camera and microphone" : "microphone") + "...</p></div>";
        navigator.mediaDevices.getUserMedia({ audio: true, video: cfg.video }).then(function (s) { M.stream = s; phase(cfg.prep ? "prep" : "answer"); },
          function () { M.note = "Recording is off: the browser did not allow the microphone. Continuing without it."; phase(cfg.prep ? "prep" : "answer"); });
      } else phase(cfg.prep ? "prep" : "answer");
    }

    function startRecorder() {
      if (!M.stream) return;
      var a = M.answers[M.i], chunks = [], mr;
      try { mr = new MediaRecorder(M.stream); } catch (e) { return; }
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () { if (!chunks.length) return; a.url = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || (cfg.video ? "video/webm" : "audio/webm") })); a.video = !!cfg.video; };
      mr.start(); M.mr = mr;
    }

    function runHTML() {
      var q = M.qs[M.i], think = M.phase === "prep", total = think ? cfg.prep : cfg.ans;
      return '<div class="card mock-run"><div class="row between"><p class="eyebrow">Question ' + (M.i + 1) + " of " + M.qs.length + " &middot; " + E(q.roleName) + " &middot; " + SC.data.qtypes[q.type] + "</p>" +
        '<div class="dots">' + M.qs.map(function (x, i) { return '<span class="' + (i < M.i ? "done" : i === M.i ? "on" : "") + '"></span>'; }).join("") + "</div></div>" +
        '<div class="mock-q" id="m-q">' + E(q.q) + "</div>" +
        '<div class="mock-clock"><div class="ring lg ' + (think ? "think" : "talk") + '" id="m-ring" style="--p:100"><span id="m-left">' + fmt(total) + '</span></div><div><p class="phase">' + (think ? "Think" : "Answer now") + "</p>" +
        '<p class="fine">' + (think ? "Plan it: " + E(SC.data.qtips[q.type]) : "Speak out loud as if they were in the room." + (M.stream ? ' <span class="rec-dot">Recording</span>' : "")) + "</p>" +
        '<div class="row">' + (think ? '<button type="button" class="btn primary" id="m-go">Start answering <kbd>N</kbd></button>' : '<button type="button" class="btn primary" id="m-next">' + (M.i === M.qs.length - 1 ? "Finish" : "Done, next question") + " <kbd>Space</kbd></button>") +
        '<button type="button" class="btn ghost" id="m-end">End interview</button></div></div></div>' + (M.note ? '<p class="fine">' + E(M.note) + "</p>" : "") + "</div>";
    }
    function phase(p) {
      stopTick(); M.phase = p;
      if (p === "review") { stopRecorder(); if (M.stream) { M.stream.getTracks().forEach(function (t) { t.stop(); }); M.stream = null; } setTimeout(review, 120); return; }
      var total = p === "prep" ? cfg.prep : cfg.ans;
      M.deadline = Date.now() + total * 1000; M.t0 = Date.now();
      pane.innerHTML = runHTML();
      if (p === "answer") startRecorder();
      M.h = setInterval(tick, 200);
    }
    function tick() {
      var total = M.phase === "prep" ? cfg.prep : cfg.ans, left = (M.deadline - Date.now()) / 1000, el = $("#m-left"), ring = $("#m-ring");
      if (!el) { stopTick(); return; }
      el.textContent = fmt(left); ring.style.setProperty("--p", Math.max(0, Math.round(100 * left / total)));
      ring.classList.toggle("low", M.phase === "answer" && left <= 15);
      if (left <= 0) advance();
    }
    function advance() {
      if (M.phase === "prep") { phase("answer"); return; }
      M.answers[M.i].secs = Math.max(1, Math.min(cfg.ans, Math.round((Date.now() - M.t0) / 1000)));
      stopRecorder();
      if (M.i >= M.qs.length - 1) { phase("review"); return; }
      M.i++; phase(cfg.prep ? "prep" : "answer");
    }
    SC.mockAdvance = advance;

    function review() {
      M.phase = "review";
      var done = M.answers.filter(function (a) { return a.secs > 0; });
      pane.innerHTML = '<div class="card"><div class="card-head"><h2>Score your answers</h2><button type="button" class="btn primary" id="m-card" data-primary>See my scorecard</button></div>' +
        '<p class="fine">Replay each answer if you recorded it, then score it honestly. 0 = no, 1 = partly, 2 = yes. Unscored answers are left out.</p></div>' +
        M.answers.map(function (a, i) {
          if (!a.secs) return "";
          return '<div class="card answer" data-ai="' + i + '"><p class="eyebrow">Question ' + (i + 1) + " &middot; " + fmt(a.secs) + " used of " + fmt(cfg.ans) + "</p><h3>" + E(a.q.q) + "</h3>" +
            (a.url ? (a.video ? '<video class="rec" controls src="' + a.url + '"></video>' : '<audio controls src="' + a.url + '"></audio>') : '<p class="fine">No recording for this answer.</p>') +
            '<div class="rubric">' + SC.data.rubric.map(function (r) {
              return '<div class="rub-row"><span title="' + E(r.q) + '"><b>' + E(r.name) + "</b><small>" + E(r.q) + '</small></span><div class="seg sm" role="group" aria-label="' + E(r.name) + '">' +
                [0, 1, 2].map(function (v) { var on = a.scores[r.id] === v; return '<button type="button" data-ms="' + i + ":" + r.id + ":" + v + '" class="' + (on ? "on" : "") + '" aria-pressed="' + on + '">' + ["No", "Partly", "Yes"][v] + "</button>"; }).join("") + "</div></div>";
            }).join("") + "</div></div>";
        }).join("") + (done.length ? "" : '<div class="card"><p class="muted">No answers were given. Start a new mock interview.</p></div>');
    }

    function card() {
      var sc = SC.mockScore(M.answers), role = SC.data.roles.filter(function (r) { return r.id === cfg.role; })[0];
      if (sc.scored) {
        IV.mocks = IV.mocks || [];
        IV.mocks.push({ date: SC.today(), role: cfg.role, roleName: role ? role.name : cfg.role, n: sc.scored, pct: sc.pct, crit: sc.crit.map(function (c) { return [c.id, c.pct]; }) });
        M.answers.forEach(function (a) { var r = SC.answerRating(a.scores); if (r) IV.ratings[a.q.id] = { r: r, at: SC.today() }; });
        SC.log("iv"); SC.save();
      }
      pane.innerHTML = '<div class="two"><div class="card scorecard"><h2>Scorecard</h2><div class="row">' + SC.ringHTML(sc.pct, sc.pct + "%", "lg") + "<div><h3>" + E(sc.verdict) + '</h3><p class="fine">' + sc.scored + " answer" + (sc.scored === 1 ? "" : "s") + " scored, " + (function (m) { return m < 1 ? "under a minute" : m + " minute" + (m > 1 ? "s" : ""); })(Math.round((Date.now() - M.started) / 60000)) + ".</p></div></div>" +
        '<div class="bars">' + sc.crit.map(function (c) { return '<div class="bar-row"><span>' + E(c.name) + '</span><div class="bar"><i style="width:' + (c.pct || 0) + '%" class="' + (c.pct == null ? "" : c.pct >= 75 ? "good" : c.pct >= 50 ? "mid" : "low") + '"></i></div><b>' + (c.pct == null ? "-" : c.pct + "%") + "</b></div>"; }).join("") + "</div>" +
        '<h3>Per answer</h3><ul class="bank">' + M.answers.filter(function (a) { return a.secs; }).map(function (a) { var r = SC.answerRating(a.scores); return "<li>" + E(a.q.q) + ' <span class="chip ' + (r >= 4 ? "ok" : r ? "no" : "") + '">' + (r ? r + "/5" : "not scored") + "</span></li>"; }).join("") + "</ul></div>" +
        '<div class="card"><h2>Your drills</h2>' + (sc.drills.length ? '<ol class="drills">' + sc.drills.map(function (d) { return "<li><b>" + E(d.name) + ".</b> " + E(d.text) + "</li>"; }).join("") + "</ol>" : '<p>No weak spots on this run. Try a harder role set or less thinking time.</p>') +
        '<div class="row" style="margin-top:1rem"><button type="button" class="btn primary" id="m-again" data-primary>New mock interview</button><button type="button" class="btn" id="m-weak">Practise weak questions</button></div>' +
        '<p class="fine">Ratings from this run are saved to Progress, and "Practice a weak one" will bring these questions back.</p></div></div>';
    }

    pane.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.id === "m-start") begin();
      else if (b.id === "m-go") phase("answer");
      else if (b.id === "m-next") advance();
      else if (b.id === "m-end") { if (M.phase === "answer") M.answers[M.i].secs = Math.max(1, Math.round((Date.now() - M.t0) / 1000)); phase("review"); }
      else if (b.id === "m-card") card();
      else if (b.id === "m-again") { freeUrls(); M.answers = []; M.phase = "setup"; setup(); }
      else if (b.id === "m-weak") { SC.go("#/interview"); }
      else if (b.hasAttribute("data-ms")) {
        var p = b.getAttribute("data-ms").split(":"), a = M.answers[+p[0]], v = +p[2];
        a.scores[p[1]] = a.scores[p[1]] === v ? undefined : v;
        SC.$$('[data-ms^="' + p[0] + ":" + p[1] + ':"]', pane).forEach(function (x) { var on = a.scores[p[1]] === +x.getAttribute("data-ms").split(":")[2]; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
      }
    });
    SC.onKey = function (ev) {
      if (ev.target && ev.target.tagName === "BUTTON") return;
      if (M.phase === "answer" && ev.key === " ") { ev.preventDefault(); advance(); }
      else if (M.phase === "prep" && (ev.key === "n" || ev.key === "N")) { ev.preventDefault(); phase("answer"); }
    };
    setup();
    return function () { stopAll(); SC.onKey = null; };
  };
})();
