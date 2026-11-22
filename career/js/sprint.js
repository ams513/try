/* Job-search sprint: weekly goals, streaks, today's to-do list, pipeline funnel and an activity heatmap. */
(function () {
  "use strict";
  var E = SC.esc, $ = SC.$;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function nice(iso) { var p = iso.split("-"); return MON[+p[1] - 1] + " " + (+p[2]); }

  SC.pipelineTip = function (pipe) {
    var ap = pipe[0].n, resp = pipe[1].n, iv = pipe[2].n, off = pipe[3].n;
    if (ap < 5) return "Too early to judge the funnel. Hit your weekly application goal first.";
    if (resp / ap < 0.15) return "Few replies so far. Tailor each resume to the posting, apply in the first week a job is posted, and ask for referrals.";
    if (iv >= 4 && off / iv < 0.25) return "Interviews are not turning into offers yet. Run mock interviews and work the drills on your scorecard.";
    if (resp && iv / resp < 0.4) return "Screening calls are not moving forward. Prepare a sharp two-minute \"tell me about yourself\" and your salary range.";
    return "A healthy funnel. Keep the weekly volume steady.";
  };

  SC.views.sprint = function (root) {
    var SP = SC.S.sprint;
    function draw() {
      var today = SC.today(), wk = SC.sprintWeek(SP.log, SP.goals, today), streak = SC.sprintStreak(SP.log, today), weeks = SC.weekStreak(SP.log, SP.goals, today);
      var plan = SC.todayPlan(SC.S.apps, SP, today), pipe = SC.pipeline(SC.S.apps), grid = SC.activityGrid(SP.log, today, 12), maxN = 1;
      grid.forEach(function (c) { c.forEach(function (d) { maxN = Math.max(maxN, d.n); }); });
      var top = Math.max(1, pipe[0].n);
      root.innerHTML = '<div class="view-head"><p class="eyebrow">Sprint</p><h1>Week of ' + nice(wk.start) + " to " + nice(wk.end) + '</h1><p class="lede">A job search is a numbers game you can control. Set a weekly target, do a little every day, and watch the pipeline fill.</p></div>' +
        '<div class="hero-grid"><section class="card"><div class="row">' + SC.ringHTML(wk.pct, wk.pct + "%", "lg") + '<div><h2>' + (wk.met ? "Week complete" : wk.daysLeft + " day" + (wk.daysLeft > 1 ? "s" : "") + " left") + '</h2>' +
        '<p class="fine"><b class="streak">' + streak.days + "-day streak</b>" + (weeks ? " &middot; " + weeks + " goal week" + (weeks > 1 ? "s" : "") + " in a row" : "") + "</p>" +
        '<p class="fine">' + (streak.activeToday ? "You logged something today." : "Do one thing from the list to keep the streak.") + "</p></div></div>" +
        '<div class="goals">' + SC.SPRINT_TYPES.map(function (t) {
          var p = wk.per[t[0]];
          return '<div class="goal" data-t="' + t[0] + '"><div class="goal-top"><b>' + t[1] + '</b><span class="fine">' + p.done + " of " + p.goal + (p.left ? " &middot; " + p.today + " today" : " &middot; done") + '</span></div>' +
            '<div class="bar"><i style="width:' + p.pct + '%" class="' + (p.pct >= 100 ? "good" : "") + '"></i></div><div class="row goal-ctl"><button type="button" class="btn tiny" data-unlog aria-label="Remove one ' + t[1] + '">-1</button>' +
            '<button type="button" class="btn tiny primary" data-log aria-label="Log one ' + t[1] + '">+1</button><label class="fine" for="sg-' + t[0] + '">Goal</label><input id="sg-' + t[0] + '" class="num" type="number" min="0" max="99" value="' + p.goal + '"></div></div>';
        }).join("") + "</div></section>" +
        '<section class="card today"><h2>Today</h2>' + (plan.length ? '<ul class="todo">' + plan.map(function (p) { return '<li class="k-' + p.kind.split("-")[0] + '"><a href="' + p.href + '"><b>' + E(p.text) + "</b><span>" + E(p.meta) + "</span></a></li>"; }).join("") + "</ul>"
          : '<p class="muted">All clear for today. Nice.</p>') + "</section></div>" +
        '<div class="two"><section class="card"><h2>Pipeline</h2><div class="funnel">' + pipe.map(function (s) {
          return '<div class="f-row"><span>' + SC.STAGE_LABEL[s.stage] + '</span><div class="bar"><i style="width:' + Math.round(100 * s.n / top) + '%"></i></div><b>' + s.n + "</b><small>" + (s.rate == null ? "" : s.rate + "%") + "</small></div>"; }).join("") + "</div>" +
        '<p class="fine">Counts every application that ever reached the stage; the percentage is the step from the stage above.</p><div class="hint">' + E(SC.pipelineTip(pipe)) + "</div></section>" +
        '<section class="card"><h2>Last 12 weeks</h2><div class="heat" role="img" aria-label="Activity per day over the last 12 weeks">' + grid.map(function (col) {
          return '<div class="hcol">' + col.map(function (d) { var lv = d.n < 0 ? "f" : d.n === 0 ? 0 : Math.min(4, Math.ceil(4 * d.n / maxN)); return '<i class="l' + lv + '" title="' + d.d + ": " + Math.max(0, d.n) + '"></i>'; }).join("") + "</div>";
        }).join("") + '</div><p class="fine">Each square is a day (Monday at the top). Applications, follow-ups, messages and mock interviews all count.</p>' +
        '<h3>How the numbers move on their own</h3><ul class="fine"><li>Moving a job to Applied in the tracker logs an application.</li><li>Marking a follow-up done logs a follow-up.</li><li>"Mark as sent" on a networking message logs a message.</li><li>Finishing a mock interview counts toward your streak.</li></ul></section></div>';
    }
    draw();
    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return; var g = b.closest("[data-t]"); if (!g) return;
      var t = g.getAttribute("data-t");
      if (b.hasAttribute("data-log")) { SC.log(t); draw(); }
      else if (b.hasAttribute("data-unlog")) { if (SC.unlogActivity(SP, t, SC.today())) { SC.save(); draw(); } }
    });
    root.addEventListener("change", function (ev) {
      var m = /^sg-(\w+)$/.exec(ev.target.id || ""); if (!m) return;
      SP.goals[m[1]] = Math.max(0, Math.min(99, Math.round(+ev.target.value || 0))); SC.save(); draw();
    });
  };
})();
