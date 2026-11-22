/* Interview practice: question bank, timer, STAR guide, self-rating, optional local recording. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;

  SC.allQuestions = function () {
    var out = [];
    SC.data.roles.forEach(function (r) {
      r.q.forEach(function (s, i) { var p = s.indexOf("|"); out.push({ id: r.id + "-" + i, role: r.id, roleName: r.name, type: s.slice(0, p), q: s.slice(p + 1) }); });
    });
    return out;
  };
  function fmt(sec) { var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }

  SC.views.interview = function (root) {
    var IV = SC.S.iv, ALL = SC.allQuestions(), tab = SC.sub() === "mock" ? "mock" : "practice", cur = null, mockStop = null;
    var filt = { role: "general", type: "all" };
    var timer = { len: 120, left: 120, h: 0 };
    var rec = { stream: null, mr: null, chunks: [], url: null };

    function stopTimer() { clearInterval(timer.h); timer.h = 0; }
    function stopRec(discard) {
      if (rec.mr && rec.mr.state !== "inactive") { try { rec.mr.onstop = discard ? null : rec.mr.onstop; rec.mr.stop(); } catch (e) { } }
      if (rec.stream) { rec.stream.getTracks().forEach(function (t) { t.stop(); }); rec.stream = null; }
      if (discard && rec.url) { URL.revokeObjectURL(rec.url); rec.url = null; }
    }
    SC.cleanups.push(function () { stopTimer(); stopRec(true); if (mockStop) mockStop(); });

    function pool() { return ALL.filter(function (q) { return (filt.role === "all" || q.role === filt.role) && (filt.type === "all" || q.type === filt.type); }); }
    function pick(random) {
      var p = pool(); if (!p.length) return null;
      if (!random || p.length === 1) return p[0];
      var q; do { q = p[Math.floor(Math.random() * p.length)]; } while (cur && q.id === cur.id);
      return q;
    }

    function head() {
      return '<div class="view-head"><p class="eyebrow">Interviews</p><h1>Interview practice</h1><p class="lede">' + ALL.length + " questions across " + SC.data.roles.length + " role types. Answer out loud with the timer running, rate yourself honestly, and repeat the weak ones. Or run a full mock interview with a scorecard.</p></div>" +
        '<div class="tabs" role="tablist">' + [["practice", "Practice"], ["mock", "Mock interview"], ["bank", "Question bank"], ["star", "STAR guide"], ["progress", "Progress"]].map(function (t) {
          return '<button type="button" role="tab" data-tab="' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + "</button>"; }).join("") + '</div><div id="pane"></div>';
    }

    function filters() {
      return '<div class="row"><div class="grow"><label for="f-role">Role type</label><select id="f-role"><option value="all">All roles</option>' +
        SC.data.roles.map(function (r) { return '<option value="' + r.id + '"' + (filt.role === r.id ? " selected" : "") + ">" + E(r.name) + "</option>"; }).join("") + "</select></div>" +
        '<div class="grow"><label for="f-type">Question type</label><select id="f-type"><option value="all">All types</option>' +
        Object.keys(SC.data.qtypes).map(function (k) { return '<option value="' + k + '"' + (filt.type === k ? " selected" : "") + ">" + SC.data.qtypes[k] + "</option>"; }).join("") + "</select></div></div>";
    }

    function practice() {
      if (!cur || (filt.role !== "all" && cur.role !== filt.role) || (filt.type !== "all" && cur.type !== filt.type)) cur = pick(true);
      var pane = $("#pane");
      if (!cur) { pane.innerHTML = '<div class="card">' + filters() + '<p class="muted">No questions match.</p></div>'; bindFilters(); return; }
      var rating = IV.ratings[cur.id] ? IV.ratings[cur.id].r : 0, notes = IV.notes[cur.id] || {};
      var canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
      pane.innerHTML = '<div class="two"><div class="card">' + filters() +
        '<p class="eyebrow" style="margin-top:1rem">' + E(cur.roleName) + " &middot; " + SC.data.qtypes[cur.type] + '</p><div class="qcard" id="qtext">' + E(cur.q) + "</div>" +
        '<div class="hint">' + E(SC.data.qtips[cur.type]) + "</div>" +
        '<div class="row"><button type="button" class="btn primary" data-a="next">Next question</button><button type="button" class="btn" data-a="weak">Practice a weak one</button></div>' +
        '<h3 style="margin-top:1rem">Timer</h3><div class="row"><div class="timer" id="tm" role="timer" aria-live="off">' + fmt(timer.left) + '</div><select id="tlen" aria-label="Answer length">' +
        [60, 90, 120, 180].map(function (s) { return '<option value="' + s + '"' + (timer.len === s ? " selected" : "") + ">" + fmt(s) + "</option>"; }).join("") + '</select>' +
        '<button type="button" class="btn" data-a="tstart" id="tstart">' + (timer.h ? "Pause" : "Start") + '</button><button type="button" class="btn" data-a="treset">Reset</button></div>' +
        '<p class="fine" id="tmsg">Aim to finish an answer in 90 seconds to 2 minutes.</p>' +
        '<h3>How did that answer go?</h3><div class="rate" role="group" aria-label="Self rating">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-r="' + n + '" class="' + (rating === n ? "on" : "") + '" aria-pressed="' + (rating === n) + '">' + n + "</button>"; }).join("") + "</div>" +
        '<p class="fine">1 = lost my words, 5 = clear, specific, with a result.</p></div>' +
        '<div><div class="card"><h3>STAR notes for this question</h3><p class="fine">Jot a few words for each part. They are saved for next time.</p><div class="star-grid">' +
        [["s", "Situation", "Where and when? What was happening?"], ["t", "Task", "What was your responsibility?"], ["a", "Action", "What did YOU do, step by step?"], ["r", "Result", "What changed? Use a number."]].map(function (x) {
          return '<div><label for="n-' + x[0] + '">' + x[1] + '</label><textarea id="n-' + x[0] + '" rows="3" placeholder="' + x[2] + '">' + E(notes[x[0]] || "") + "</textarea></div>"; }).join("") + "</div></div>" +
        '<div class="card"><h3>Record yourself (optional)</h3>' + (canRec ?
          '<p class="fine">Uses your camera and microphone through the browser. The recording stays on this computer, in memory, and is gone when you leave this page unless you download it.</p>' +
          '<div class="row"><button type="button" class="btn" data-a="rec" id="recbtn">Start recording</button><label style="margin:0"><input type="checkbox" id="vid" checked> Include video</label></div><div id="recout"></div>' :
          '<p class="muted">Recording is not available in this browser or context. Practice out loud and use a phone to record instead.</p>') + "</div></div></div>";
      bindFilters();
    }

    function bindFilters() {
      var r = $("#f-role"), t = $("#f-type");
      if (r) r.addEventListener("change", function () { filt.role = r.value; cur = null; practice(); });
      if (t) t.addEventListener("change", function () { filt.type = t.value; cur = null; practice(); });
    }

    function startTimer() {
      if (timer.h) { stopTimer(); $("#tstart").textContent = "Start"; return; }
      if (timer.left <= 0) timer.left = timer.len;
      $("#tstart").textContent = "Pause";
      timer.h = setInterval(function () {
        timer.left--; var tm = $("#tm"); if (!tm) { stopTimer(); return; }
        tm.textContent = fmt(Math.max(timer.left, 0));
        if (timer.left <= 0) { stopTimer(); tm.classList.add("over"); $("#tmsg").textContent = "Time. Wrap up with your result, then rate yourself."; $("#tstart").textContent = "Start"; }
      }, 1000);
    }
    function resetTimer() { stopTimer(); timer.left = timer.len; var tm = $("#tm"); if (tm) { tm.textContent = fmt(timer.left); tm.classList.remove("over"); } var b = $("#tstart"); if (b) b.textContent = "Start"; }

    function startRec() {
      var btn = $("#recbtn"), out = $("#recout");
      if (rec.mr && rec.mr.state === "recording") { rec.mr.stop(); btn.textContent = "Start recording"; return; }
      var wantVideo = $("#vid").checked;
      navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo }).then(function (stream) {
        rec.stream = stream; rec.chunks = [];
        if (rec.url) { URL.revokeObjectURL(rec.url); rec.url = null; }
        var mr = new MediaRecorder(stream); rec.mr = mr;
        mr.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
        mr.onstop = function () {
          var blob = new Blob(rec.chunks, { type: mr.mimeType || (wantVideo ? "video/webm" : "audio/webm") });
          stream.getTracks().forEach(function (t) { t.stop(); }); rec.stream = null;
          rec.url = URL.createObjectURL(blob);
          var o = $("#recout"); if (!o) return;
          var tag = wantVideo ? "video" : "audio";
          o.innerHTML = "<p class=\"fine\">Watch it back. Look at pace, filler words, eye contact and whether you reached the result.</p><" + tag + ' class="rec" controls src="' + rec.url + '"></' + tag + '><div class="row"><a class="btn small" href="' + rec.url + '" download="interview-practice.webm">Download recording</a></div>';
        };
        mr.start(); btn.textContent = "Stop recording";
        if (wantVideo) { out.innerHTML = '<video class="rec" id="live" autoplay muted playsinline></video>'; $("#live").srcObject = stream; } else out.innerHTML = '<p class="fine">Recording audio...</p>';
        if (!timer.h) startTimer();
      }, function () { out.innerHTML = '<p class="muted">Could not open the camera or microphone. Check the browser permission, or untick Include video.</p>'; });
    }

    function bank() {
      var qs = $("#bq") ? $("#bq").value.toLowerCase() : "";
      $("#pane").innerHTML = '<div class="card">' + filters() + '<label for="bq">Search</label><input id="bq" type="search" placeholder="Search the questions"><p class="fine" id="bcount"></p><ul class="bank" id="blist"></ul></div>';
      function list() {
        var term = $("#bq").value.toLowerCase(), p = pool().filter(function (q) { return !term || q.q.toLowerCase().indexOf(term) >= 0; });
        $("#bcount").textContent = p.length + " question" + (p.length === 1 ? "" : "s");
        $("#blist").innerHTML = p.map(function (q) { var r = IV.ratings[q.id]; return '<li><button type="button" data-q="' + q.id + '">' + E(q.q) + '</button> <span class="chip">' + SC.data.qtypes[q.type] + "</span>" + (filt.role === "all" ? ' <span class="fine">' + E(q.roleName) + "</span>" : "") + (r ? ' <span class="chip ok">rated ' + r.r + "</span>" : "") + "</li>"; }).join("");
      }
      $("#bq").value = qs; list(); $("#bq").addEventListener("input", list);
      $("#f-role").addEventListener("change", function () { filt.role = $("#f-role").value; bank(); });
      $("#f-type").addEventListener("change", function () { filt.type = $("#f-type").value; bank(); });
    }

    function star() {
      $("#pane").innerHTML = '<div class="card"><h2>The STAR method</h2><p>Behavioral questions ("Tell me about a time...") are scored on evidence. STAR keeps your answer short, specific and finished.</p><div class="star-grid">' +
        [["Situation", "10-15%", "Set the scene in one or two sentences: where, when, what was at stake.", "At my last job, our weekly shipments had a 9% error rate and customers were complaining."],
         ["Task", "10%", "Your specific responsibility. What were you asked or expected to do?", "I was asked to find out why and fix it within a month."],
         ["Action", "50-60%", "What YOU did, in order. Use \"I\", not \"we\". This is the part they are scoring.", "I traced errors to mislabeled bins, built a double-check checklist and trained the team on it."],
         ["Result", "15-20%", "The outcome, with a number, plus what you learned.", "Errors fell 31% in four months, and the checklist became standard in two other sites."]].map(function (x) {
          return '<div class="card"><h4>' + x[0] + ' <span class="chip">' + x[1] + "</span></h4><p>" + x[2] + '</p><p class="fine"><i>Example: ' + x[3] + "</i></p></div>"; }).join("") + "</div>" +
        '<h3>Rules that win interviews</h3><ul><li>Prepare 6 to 8 stories (a success, a failure, a conflict, a leadership moment, a deadline, a learning moment) and reuse them across questions.</li><li>Keep answers to 90 seconds to 2 minutes.</li><li>If you failed, spend most of the time on what you changed.</li><li>For situational questions ("What would you do...") skip the story: give your steps in order, and why.</li><li>End on the result, then stop.</li></ul></div>';
    }

    function progress() {
      var rated = Object.keys(IV.ratings), byRole = {};
      rated.forEach(function (id) { var q = ALL.filter(function (x) { return x.id === id; })[0]; if (!q) return; var b = byRole[q.role] || (byRole[q.role] = { n: 0, sum: 0, name: q.roleName }); b.n++; b.sum += IV.ratings[id].r; });
      var weak = rated.map(function (id) { return { id: id, r: IV.ratings[id].r }; }).filter(function (x) { return x.r <= 3; }).sort(function (a, b) { return a.r - b.r; }).slice(0, 10);
      $("#pane").innerHTML = '<div class="card"><h2>Your progress</h2><div class="stat"><div><b>' + rated.length + '</b>questions rated</div><div><b>' + ALL.length + "</b>in the bank</div><div><b>" +
        (rated.length ? (rated.reduce(function (s, id) { return s + IV.ratings[id].r; }, 0) / rated.length).toFixed(1) : "-") + "</b>average rating</div></div>" +
        (Object.keys(byRole).length ? "<h3>By role type</h3><ul>" + Object.keys(byRole).map(function (k) { var b = byRole[k]; return "<li>" + E(b.name) + ": " + b.n + " rated, average " + (b.sum / b.n).toFixed(1) + "</li>"; }).join("") + "</ul>" : '<p class="muted">Rate a few answers and your progress shows up here.</p>') +
        ((IV.mocks || []).length ? "<h3>Mock interviews</h3><ul>" + IV.mocks.slice(-8).reverse().map(function (m) { return "<li>" + E(m.date) + ": " + E(m.roleName || m.role) + ", " + m.n + " answers, <b>" + m.pct + "%</b></li>"; }).join("") + "</ul>" : "") +
        (weak.length ? "<h3>Practice these again</h3><ul class=\"bank\">" + weak.map(function (w) { var q = ALL.filter(function (x) { return x.id === w.id; })[0]; return '<li><button type="button" data-q="' + q.id + '">' + E(q.q) + '</button> <span class="chip no">rated ' + w.r + "</span></li>"; }).join("") + "</ul>" : "") + "</div>";
    }

    function show() {
      stopTimer(); stopRec(true); if (mockStop) { mockStop(); mockStop = null; }
      if (tab === "mock") { mockStop = SC.mockPane($("#pane"), ALL, IV); return; }
      if (tab === "practice") practice(); else if (tab === "bank") bank(); else if (tab === "star") star(); else progress();
      var t = $("#tm"); if (t) t.classList.toggle("over", timer.left <= 0);
    }
    root.innerHTML = head(); show();

    function weakOne() {
      var w = ALL.filter(function (q) { return IV.ratings[q.id] && IV.ratings[q.id].r <= 3 && (filt.role === "all" || q.role === filt.role); });
      if (!w.length) { SC.toast("Nothing rated 3 or lower here yet."); return null; }
      return w[Math.floor(Math.random() * w.length)];
    }
    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b || (tab === "mock" && !b.hasAttribute("data-tab"))) return;
      var t = b.getAttribute("data-tab"), a = b.getAttribute("data-a"), r = b.getAttribute("data-r"), q = b.getAttribute("data-q");
      if (t) { tab = t; $$tabs(); show(); }
      else if (q) { cur = ALL.filter(function (x) { return x.id === q; })[0]; filt.role = cur.role; filt.type = "all"; resetTimer(); timer.left = timer.len; tab = "practice"; $$tabs(); show(); }
      else if (r) { IV.ratings[cur.id] = { r: +r, at: SC.today() }; SC.save(); SC.$$(".rate button").forEach(function (x) { var on = x.getAttribute("data-r") === r; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); }); SC.toast("Rated " + r + "."); }
      else if (a === "next") { cur = pick(true); timer.left = timer.len; show(); }
      else if (a === "weak") { var w = weakOne(); if (w) { cur = w; timer.left = timer.len; show(); } }
      else if (a === "tstart") startTimer();
      else if (a === "treset") resetTimer();
      else if (a === "rec") startRec();
    });
    function $$tabs() { SC.$$("[data-tab]").forEach(function (x) { var on = x.getAttribute("data-tab") === tab; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); }
    root.addEventListener("change", function (ev) {
      if (ev.target.id === "tlen") { timer.len = +ev.target.value; resetTimer(); }
    });
    var saveSoon = SC.debounce(SC.save, 300);
    root.addEventListener("input", function (ev) {
      var id = ev.target.id; if (!cur || !id || id.indexOf("n-") !== 0) return;
      var n = IV.notes[cur.id] || (IV.notes[cur.id] = {}); n[id.slice(2)] = ev.target.value; saveSoon();
    });
  };
})();
