/* Shared form, tab and list helpers for the 2.1 views (salary and offers, contacts, growth, freelance, portfolio). */
(function () {
  "use strict";
  var E = SC.esc;
  function attrs(id, o) {
    return ' id="' + id + '"' + (o.k ? ' data-k="' + o.k + '"' : "") + (o.ph ? ' placeholder="' + E(o.ph) + '"' : "") + (o.type ? ' type="' + o.type + '"' : "") +
      (o.min != null ? ' min="' + o.min + '"' : "") + (o.max != null ? ' max="' + o.max + '"' : "") + (o.step ? ' step="' + o.step + '"' : "") +
      (o.mode ? ' inputmode="' + o.mode + '"' : "") + (o.cls ? ' class="' + o.cls + '"' : "");
  }
  SC.kit = {
    /* One labelled control. o: {k: data-k, ph, type, area, rows, opts: [[value, label]], mode, wide} */
    field: function (id, label, val, o) {
      o = o || {}; var a = attrs(id, o), wrap = "<div" + (o.wide ? ' class="span-all"' : "") + '><label for="' + id + '">' + E(label) + "</label>";
      if (o.area) return wrap + "<textarea" + a + ' rows="' + (o.rows || 3) + '">' + E(val) + "</textarea></div>";
      if (o.opts) return wrap + "<select" + a + ">" + o.opts.map(function (x) { return '<option value="' + E(x[0]) + '"' + (String(x[0]) === String(val) ? " selected" : "") + ">" + E(x[1]) + "</option>"; }).join("") + "</select></div>";
      return wrap + "<input" + a + ' value="' + E(val == null ? "" : val) + '"></div>';
    },
    check: function (id, label, on, k) { return '<label class="check" for="' + id + '"><input type="checkbox" id="' + id + '"' + (k ? ' data-k="' + k + '"' : "") + (on ? " checked" : "") + "> " + E(label) + "</label>"; },
    head: function (eyebrow, title, lede) { return '<div class="view-head"><p class="eyebrow">' + E(eyebrow) + "</p><h1>" + E(title) + '</h1><p class="lede">' + lede + "</p></div>"; },
    /* Tabs that are real routes (#/base/sub), so each tab can be linked and reloaded. */
    tabs: function (base, list, cur) {
      return '<div class="tabs" role="tablist">' + list.map(function (t) {
        return '<button type="button" role="tab" data-go="#/' + base + (t[0] ? "/" + t[0] : "") + '" class="' + (cur === t[0] ? "on" : "") + '" aria-selected="' + (cur === t[0]) + '">' + E(t[1]) + "</button>";
      }).join("") + "</div>";
    },
    bindTabs: function (root) { root.addEventListener("click", function (ev) { var b = ev.target.closest("[data-go]"); if (b) SC.go(b.getAttribute("data-go")); }); },
    curField: function (id) {
      return SC.kit.field(id || "cur-pick", "Currency symbol", SC.S.cur, { opts: SC.CURRENCIES.map(function (c) { return [c, c]; }), k: "cur", cls: "cur-pick" });
    },
    levels: function (lo) { var o = []; for (var i = lo; i <= 5; i++) o.push([i, String(i)]); return o; },
    stat: function (label, val) { return "<div><b>" + E(val) + "</b>" + E(label) + "</div>"; },
    /* Two-step confirm on a button: first click arms it, second click runs. */
    sure: function (btn, text) {
      if (btn.getAttribute("data-sure") === "1") return true;
      btn.setAttribute("data-sure", "1"); btn.textContent = text || "Click again to confirm"; return false;
    },
    byId: function (list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; },
    nice: function (iso) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
      var m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+iso.slice(5, 7) - 1];
      return m + " " + (+iso.slice(8, 10)) + ", " + iso.slice(0, 4);
    },
    calendar: function () {
      var ev = SC.careerEvents(SC.S, SC.today());
      if (!ev.length) { SC.toast("Nothing with a date yet: add follow-ups, contacts, a skills plan or a roadmap first."); return; }
      SC.download("stark_career_calendar.ics", SC.icsCalendar(ev), "text/calendar");
      SC.toast(ev.length + " dates saved to a calendar file. Open it with your calendar app.");
    }
  };
})();
