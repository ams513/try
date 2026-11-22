/* Stark Caregiver, by Stark: the emergency number of the country you choose, shown as information.
   You pick your country once; the choice is kept in this browser (not in the care record, never in a share file).
   The app cannot call anyone. Built with DOM calls and textContent, never parsed markup. */
(function () {
  "use strict";
  var A = window.CareApp, U = CareUI, C = CareContent, E = CareEmergency, h = U.h;
  var KEY = "sc-country", seq = 0;

  function saved() { try { var c = localStorage.getItem(KEY) || ""; return E.lookup(c) ? c : ""; } catch (e) { return ""; } }
  function keep(code) { try { if (code) localStorage.setItem(KEY, code); else localStorage.removeItem(KEY); } catch (e) { /* storage off: the choice lasts until the page closes */ } }
  function shown(list) { return list.map(function (n) { return n.number + (n.verified ? "" : " (?)"); }).join(" or "); }

  function fill(out, code, withCrisis) {
    var r = code ? E.lookup(code) : null, kinds = [["Ambulance", "ambulance"], ["Police", "police"], ["Fire", "fire"]], lines;
    U.clear(out);
    if (!r) { out.appendChild(h("p", { class: "muted", text: "Choose your country once. This page then shows that country's emergency number." })); return; }
    if (!r.main) {
      out.appendChild(h("p", null, h("strong", { text: "No public emergency number is listed for " + r.name + "." })));
      if (r.note) out.appendChild(h("p", { class: "fine", text: r.note }));
      return;
    }
    if (r.general.length) out.appendChild(h("p", { class: "emg-main" }, h("span", { class: "emg-label", text: "Emergency number" }), h("strong", { class: "emg-num", text: shown(r.general) })));
    lines = kinds.filter(function (k) { return r[k[1]].length && shown(r[k[1]]) !== shown(r.general); });
    if (lines.length) out.appendChild(h("ul", { class: "emg-list" }, !r.general.length ? h("li", { class: "emg-label", text: "Emergency number" }) : null,
      lines.map(function (k) { return h("li", null, h("span", { text: k[0] + ": " }), h("strong", { class: "emg-num", text: shown(r[k[1]]) })); })));
    out.appendChild(h("p", { class: "emg-check" }, h("strong", { text: "Check this number is right for where you are." })));
    if (r.status !== "verified") out.appendChild(h("p", { class: "fine", text: "A number marked (?) is not confirmed against the official list its country reported." }));
    if (r.note) out.appendChild(h("p", { class: "fine", text: r.note }));
    if (withCrisis) C.CRISIS.filter(function (c) { return c.codes.indexOf(code) !== -1; }).forEach(function (c) {
      out.appendChild(h("p", { class: "emg-line" }, h("strong", { text: c.where + ": " }), c.what + ". This line is free and confidential."));
    });
  }

  // The picker and the number. withCrisis adds the crisis line recorded for that country, where the app has one.
  A.ext.emergencyNumber = function (withCrisis) {
    var id = "emg-country-" + (++seq), cur = saved(), out = h("div", { class: "emg-out", dir: "ltr", lang: "en", "aria-live": "polite" });   // English text and digits: kept left to right so "999 or 112" is never reordered on a right-to-left page
    var pick = h("select", { id: id, class: "emg-pick", "data-i18n-skip": true, onchange: function () { keep(pick.value); fill(out, pick.value, withCrisis); } },
      h("option", { value: "", text: "..." }), E.list().map(function (c) { return h("option", { value: c[0], text: c[1] }); }));
    pick.value = cur;
    fill(out, cur, withCrisis);
    return h("div", { class: "emg" }, h("div", { class: "field emg-field" }, h("label", { for: id, text: "Your country" }), pick), out);
  };
  A.ext.emergencyCountry = saved;
})();
