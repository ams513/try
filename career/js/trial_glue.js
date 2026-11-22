/* Stark Career free trial: the buttons and previews of the full-version-only features show a plain card. Trial package only.
   Plain-text export and copy stay in the trial and use the app's own text builders. */
(function () {
  "use strict";
  var T = window.StarkTrial, SC = window.SC;
  SC.exportResume = function (resume, design, how) {
    var name = String((resume && resume.name) || "resume").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "resume";
    if (how === "txt") SC.download(name + ".txt", SC.resumeText(resume), "text/plain;charset=utf-8");
    else if (how === "copy") SC.copy(SC.resumeText(resume));
    else T.show("word_export");
  };
  SC.exportLetter = function (letter, how) {
    if (how === "txt") SC.download("cover_letter.txt", SC.letterText(letter), "text/plain;charset=utf-8");
    else if (how === "copy") SC.copy(SC.letterText(letter));
    else T.show("word_export");
  };
  SC.FORMATS = [
    { id: "europass", name: "Europass-style CV", note: "Full version" },
    { id: "german", name: "German-style CV", note: "Full version" },
    { id: "uk", name: "UK-style CV", note: "Full version" }
  ];
  SC.renderFormat = function () { return T.cardHTML("country_formats"); };
  SC.cvToday = function () { return ""; };
})();
