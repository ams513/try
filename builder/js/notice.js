/* Stark Builder, by Stark. On a small or short window the planning notice is one line that can shrink to a small "About these plans"
   link, and the footer folds behind one button, so the plan and the 3D view get the room. The notice words never change and the full
   notice is always shown on a roomy window. The choice is remembered on this device only. */
(function () {
  'use strict';
  const KEY = 'starkBuilder.noticeMin', n = document.getElementById('notice'), hide = document.getElementById('notice-hide'), show = document.getElementById('notice-show'), foot = document.getElementById('foot'), tog = document.getElementById('foot-toggle');
  if (!n || !hide || !show) return;
  const get = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const set = v => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } };
  const apply = v => { n.classList.toggle('min', v); show.setAttribute('aria-expanded', String(!v)); };
  apply(get());
  hide.addEventListener('click', () => { set(true); apply(true); });
  show.addEventListener('click', () => { set(false); apply(false); });
  if (foot && tog) tog.addEventListener('click', () => { const o = foot.classList.toggle('open'); tog.setAttribute('aria-expanded', String(o)); });
})();
