/* Stark Fellowship, by Stark: children's check-in labels, pickup slips, check-out and the children's register.
   Pure logic, no DOM, no network. Extends StarkCommunity (js/community.js). A matching code is an aid for volunteers, not a guarantee of safety. */
(function (root) {
  "use strict";
  var M = root.StarkCommunity || (typeof require === "function" ? require("./community.js") : null);
  function trim(v) { return (v == null ? "" : String(v)).trim(); }
  function csv() { return (root.StarkBooks || require("./books.js")).csvLine; }

  // Local clock time (HH:MM) of a stored ISO time; "" when there is none.
  M.hm = function (iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) : ""; };

/* full version only */
  M.attendanceCSV = function (D, ev) {
    var x = M.index(D), line = csv();
    var rows = Object.keys(ev.ins).map(function (pid) { return { pid: pid, r: ev.ins[pid] }; }).sort(function (a, b) { return a.r.at < b.r.at ? -1 : 1; });
    return [line(["Name", "Household", "Time in", "Pickup code", "Collected at", "Collected by", "Guest"])].concat(rows.map(function (o) {
      var p = x.p[o.pid]; return line([M.name(p), p ? (x.h[p.hh] || {}).name : "", o.r.at, o.r.code || "", o.r.out || "", o.r.outBy || "", ""]);
    })).concat(ev.guests.map(function (g) { return line([g.name, "", g.at, "", "", "", "yes"]); })).join("\r\n") + "\r\n";
  };

  if (typeof module !== "undefined" && module.exports) module.exports = M;
})(typeof globalThis !== "undefined" ? globalThis : this);
