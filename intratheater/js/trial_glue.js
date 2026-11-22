/* Stark IntraTheater free trial glue. Trial package only. The TV guide page and the Big screen buttons show a card: the big-screen
   code is not in this package. The page route stays registered so every link in the app still lands somewhere. */
(function () {
  'use strict';
  var SIT = window.SIT, T = window.StarkTrial, root = null;
  if (SIT && SIT.view) SIT.view('tv', { title: 'TV and projector guide', mount: function (el) { root = el; }, show: function () { if (!root) return; root.textContent = ''; root.appendChild(T.card('big_screen')); } });
  var top = document.getElementById('bs-toggle'); if (top && top.parentNode) top.parentNode.removeChild(top);
  var foot = document.getElementById('bs-toggle-foot'); if (foot) foot.addEventListener('click', function () { T.show('big_screen'); });
})();
