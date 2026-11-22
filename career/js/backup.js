/* Export and backup view. */
(function () {
  "use strict";
  var $ = SC.$, E = SC.esc;

  /* Live backup file: a backup file you choose once, rewritten after every save (Chrome and Edge on a downloaded copy). */
  SC.liveFile = SC.makeMirror({ onError: function (e) { SC.toast("The live backup file could not be written: " + (e && e.message || e) + ". Your data is still saved in this browser.", true); } });
  var waiting = null;
  function hdb() {
    return new Promise(function (res, rej) {
      try { var r = indexedDB.open("stark_career_files", 1); r.onupgradeneeded = function () { r.result.createObjectStore("kv"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; } catch (e) { rej(e); }
    });
  }
  function handleIO(v) {
    return hdb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("kv", v === undefined ? "readonly" : "readwrite"), st = tx.objectStore("kv"), q = v === undefined ? st.get("live") : v === null ? st.delete("live") : st.put(v, "live");
        tx.oncomplete = function () { db.close(); res(v === undefined ? q.result || null : null); }; tx.onerror = tx.onabort = function () { db.close(); rej(tx.error); };
      });
    });
  }
  SC.resumeLiveFile = function () {
    if (!SC.canMirror(window)) return;
    handleIO().then(function (hd) {
      if (!hd || !hd.queryPermission) return;
      return hd.queryPermission({ mode: "readwrite" }).then(function (p) { if (p === "granted") SC.liveFile.set(hd); else waiting = hd; });
    }).catch(function () { return null; });
  };
  SC.stopLiveFile = function () { waiting = null; SC.liveFile.stop(); return handleIO(null).catch(function () { return null; }); };
  function liveCard(host) {
    var c = document.createElement("div"); c.className = "card live-file"; host.appendChild(c);
    function draw() {
      var st = SC.liveFile.status(), can = SC.canMirror(window);
      c.innerHTML = "<h2>Live backup file</h2><p>Choose a file once, for example on a USB stick or in a folder your own cloud drive syncs, and Stark Career rewrites it with a fresh checksummed backup after every change. Restore it here like any backup.</p>" +
        (!can ? '<p class="fine">This browser cannot keep a live file for a page. It needs Chrome or Edge, with the app opened from the downloaded copy rather than inside another site. Use "Download backup" instead.</p>' :
        '<p class="fine" id="lf-state">' + E(st.on ? "Writing to " + st.name + (st.last ? ", last written at " + new Date(st.last).toLocaleTimeString() : ", waiting for the next change") + "." + (st.error ? " Last problem: " + st.error : "") : waiting ? "The browser needs your permission again to write to " + waiting.name + "." : "Off.") + "</p>" +
        '<div class="row">' + (waiting && !st.on ? '<button type="button" class="btn primary" id="lf-resume">Resume writing to ' + E(waiting.name) + "</button>" : "") +
        (st.on ? '<button type="button" class="btn" id="lf-stop">Stop writing to the file</button>' : '<button type="button" class="btn' + (waiting ? "" : " primary") + '" id="lf-pick">' + (waiting ? "Choose a different file" : "Choose a file") + "</button>") + "</div>" +
        '<p class="fine">The file is a normal backup: not encrypted. Pick a place only you can reach, or use a sealed backup for anything you share. The browser may ask for permission again after a restart.</p>');
      var pick = $("#lf-pick", c), stop = $("#lf-stop", c), resume = $("#lf-resume", c);
      if (pick) pick.addEventListener("click", function () {
        window.showSaveFilePicker({ suggestedName: "stark_career_live_backup.json", types: [{ description: "Stark Career backup", accept: { "application/json": [".json"] } }] }).then(function (hd) {
          waiting = null; SC.liveFile.set(hd); handleIO(hd).catch(function () { return null; });
          return SC.liveFile.write(SC.wrapBackup(SC.S));
        }).then(function () { SC.toast("Live backup file is on."); draw(); }, function (e) { if (e && e.name === "AbortError") return; SC.toast("Could not use that file: " + (e && e.message || e), true); });
      });
      if (stop) stop.addEventListener("click", function () { SC.stopLiveFile(); SC.toast("Live backup file is off. The file stays where it is."); draw(); });
      if (resume) resume.addEventListener("click", function () {
        var hd = waiting;
        hd.requestPermission({ mode: "readwrite" }).then(function (p) {
          if (p !== "granted") { SC.toast("Permission was not given, so the live file stays off.", true); return; }
          waiting = null; SC.liveFile.set(hd); return SC.liveFile.write(SC.wrapBackup(SC.S)).then(draw);
        }).catch(function (e) { SC.toast("Could not reopen the file: " + (e && e.message || e), true); });
      });
    }
    draw();
  }

  SC.views.backup = function (root) {
    root.innerHTML = '<div class="view-head"><p class="eyebrow">Export and backup</p><h1>Export and backup</h1><p class="lede">Your data lives in this browser on this computer. Save a backup file now and then, especially before clearing browser data.</p></div>' +
      '<div class="two"><div class="card"><h2>Backup</h2><p>One file with your resume, saved resume versions, cover letter, applications, sprint log, interview ratings and mock scores, networking drafts, contacts and references, salary benchmark and offers, skills plan, roadmap, wins, freelance clients and portfolio.</p><div class="row"><button type="button" class="btn primary" id="b-save">Download backup (.json)</button></div>' +
      '<h3 style="margin-top:1rem">Restore</h3><label for="b-file">Choose a backup file</label><input id="b-file" type="file" accept=".json,application/json"><p class="fine" id="b-msg" aria-live="polite">Restoring replaces what is here now. Backups carry a checksum, so a damaged or edited file is refused.</p></div>' +
      '<div class="card"><h2>Export</h2><div class="row"><button type="button" class="btn" id="e-txt">Resume (.txt)</button><button type="button" class="btn" id="e-docx">Resume (.docx)</button><button type="button" class="btn" id="e-html">Resume (.html)</button><button type="button" class="btn" id="e-let">Cover letter (.txt)</button><button type="button" class="btn" id="e-letdocx">Cover letter (.docx)</button><button type="button" class="btn" id="e-csv">Applications (.csv)</button><button type="button" class="btn" id="e-ics">Calendar of dates (.ics)</button><button type="button" class="btn" id="e-con">Contacts (.csv)</button></div>' +
      '<p class="fine">For a PDF, use "Print or save as PDF" in the resume builder.</p>' +
      '<h2 style="margin-top:1rem">Erase everything</h2><p class="fine">Removes all saved data from this browser. Download a backup first.</p><button type="button" class="btn danger" id="b-wipe">Erase all data</button></div></div>';
    if (SC.sealedCard) SC.sealedCard($(".two", root));
    liveCard($(".two", root));
    $("#b-save").addEventListener("click", function () { SC.download("stark_career_backup_" + SC.today() + ".json", SC.wrapBackup(SC.S), "application/json"); });
    $("#e-txt").addEventListener("click", function () { SC.download("resume.txt", SC.resumeText(SC.S.resume)); });
    $("#e-docx").addEventListener("click", function () { SC.exportResume(SC.S.resume, SC.S.design, "docx"); });
    $("#e-letdocx").addEventListener("click", function () { SC.exportLetter(SC.S.letter, "docx"); });
    $("#e-html").addEventListener("click", function () {
      var css = "body{margin:0;background:#fff}.resume{max-width:7.3in;margin:.6in auto;font:10.5pt/1.4 Arial,sans-serif;color:#111}.resume h1{font-size:22pt;margin:0}.resume h2{font-size:11pt;text-transform:uppercase;margin:14pt 0 5pt}.resume h3{font-size:10.5pt;margin:0}.resume .job-head{display:flex;justify-content:space-between}.resume p{margin:0 0 3pt}";
      SC.download("resume.html", '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><title>' + SC.esc(SC.S.resume.name || "Resume") + "</title><style>" + css + "</style></head><body>" + SC.renderResume(SC.S.resume, SC.S.resume.template) + "</body></html>", "text/html");
    });
    $("#e-let").addEventListener("click", function () { SC.download("cover_letter.txt", SC.letterText(SC.S.letter)); });
    $("#e-csv").addEventListener("click", function () { SC.download("applications.csv", SC.appsCSV(SC.S.apps), "text/csv"); });
    $("#e-ics").addEventListener("click", SC.kit.calendar);
    $("#e-con").addEventListener("click", function () { SC.download("contacts.csv", SC.contactsCSV(SC.S.contacts, SC.today()), "text/csv"); });
    $("#b-file").addEventListener("change", function (ev) {
      var f = ev.target.files[0], msg = $("#b-msg"); if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var res = SC.readBackup(String(r.result), SC.stateTemplate());
        if (!res.ok) { msg.textContent = "Could not restore: " + res.error + ". Nothing was changed."; return; }
        try {
          if (SC.isSafe()) SC.leaveSafe();
          SC.S = SC.mergeState(res.state); SC.save(); msg.textContent = "Restored (" + res.note + "): " + SC.S.apps.length + " applications and your resume are back.";
        } catch (e) { msg.textContent = "Could not restore: " + e.message + ". Nothing was changed."; }
      };
      r.readAsText(f);
    });
    $("#b-wipe").addEventListener("click", function (ev) {
      var b = ev.target;
      if (b.getAttribute("data-sure") !== "1") { b.setAttribute("data-sure", "1"); b.textContent = "Click again to erase everything"; return; }
      if (SC.isSafe()) { SC.toast("Safe mode: export your raw data first, then restore a backup."); return; }
      // Turn the live file off first, so erasing never overwrites the person's last good backup file with empty data.
      SC.stopLiveFile();
      SC.S = SC.mergeState({}); SC.save(); SC.toast("All data erased. A live backup file, if you had one, was left as it was."); SC.route();
    });
  };
})();
