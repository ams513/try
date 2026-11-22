/* Stark Ledger 1.3: the pay-day predictor and passkey sealing. Pure logic on your own numbers; no network.
   Pay-day predictor: learns how many days late (or early) each client really pays from their fully paid invoices,
   shrinks thin histories toward your whole client base, and predicts a pay date for every open invoice plus the cash
   you can expect in each of the next weeks. Passkey sealing: a WebAuthn PRF secret (made inside the authenticator)
   is stretched with HKDF into an AES-GCM key that seals the passphrase, bound to the credential id. */
(function (root) {
  'use strict';
  const C = root.StarkCore || (typeof require !== 'undefined' ? require('./core.js') : null);
  const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
  const PRIOR = 2; // a client with n paid invoices counts n / (n + PRIOR) of their own habit; the rest is the house average

  /* full-payment date of an issued invoice, or '' when it still has a balance */
  function paidOn(inv, pays) {
    const total = C.invoiceTotals(inv).total; let got = 0;
    for (const p of pays) { got += p.amount; if (got >= total) return p.date; }
    return '';
  }
  C.paydayModel = function (st) {
    const byInv = new Map(); for (const p of st.payments) { if (!byInv.has(p.invId)) byInv.set(p.invId, []); byInv.get(p.invId).push(p); }
    byInv.forEach(l => l.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
    const per = new Map(), all = [];
    for (const inv of st.invoices) {
      if (inv.status !== 'issued') continue; const d = paidOn(inv, byInv.get(inv.id) || []); if (!d) continue;
      const late = C.daysBetween(C.dueDate(inv), d); all.push(late);
      if (!per.has(inv.clientId)) per.set(inv.clientId, []); per.get(inv.clientId).push(late);
    }
    const house = median(all), clients = new Map();
    per.forEach((l, id) => {
      const n = l.length, own = median(l), w = n / (n + PRIOR), spread = median(l.map(x => Math.abs(x - own)));
      clients.set(id, { clientId: id, n, own, expect: Math.round(w * own + (1 - w) * house), spread, onTime: Math.round(100 * l.filter(x => x <= 0).length / n) });
    });
    return { house: Math.round(house), houseN: all.length, clients, byInv };
  };
  C.payday = function (st, today, weeks) {
    weeks = Math.max(1, Math.min(26, weeks || 8));
    const m = C.paydayModel(st), out = [], buckets = [], cById = new Map(st.clients.map(c => [c.id, c]));
    for (let i = 0; i < weeks; i++) buckets.push({ start: C.addDays(today, 7 * i), amount: 0, onDue: 0 });
    const slot = d => { const k = Math.floor(C.daysBetween(today, d) / 7); return k >= 0 && k < weeks ? buckets[k] : null; };
    for (const inv of st.invoices) {
      if (inv.status !== 'issued') continue;
      const bal = C.balanceH(st, inv); if (bal <= 0) continue;
      const prof = m.clients.get(inv.clientId), expect = prof ? prof.expect : m.house, spread = prof ? prof.spread : 7, due = C.dueDate(inv);
      let when = C.addDays(due, expect), slipping = false;
      if (when < today) { if (due >= today) when = today; else { when = C.addDays(today, Math.max(7, Math.round(spread) || 7)); slipping = true; } } // never a date in the past; overdue and past the usual: slipping
      const n = prof ? prof.n : 0, conf = n >= 5 && spread <= 7 ? 'high' : n >= 2 ? 'medium' : 'low';
      const c = cById.get(inv.clientId);
      out.push({ invId: inv.id, number: inv.number || '', client: c ? c.name : '?', clientId: inv.clientId, balance: bal, due, predicted: when, lateBy: C.daysBetween(due, when), confidence: conf, slipping });
      const b = slot(when); if (b) b.amount += bal; const bd = slot(due < today ? today : due); if (bd) bd.onDue += bal;
    }
    out.sort((a, b) => (a.predicted < b.predicted ? -1 : a.predicted > b.predicted ? 1 : b.balance - a.balance));
    const profiles = Array.from(m.clients.values()).map(p => { const c = cById.get(p.clientId); return Object.assign({ name: c ? c.name : '?' }, p); }).sort((a, b) => b.expect - a.expect);
    const inWindow = buckets.reduce((s, b) => s + b.amount, 0), dueWindow = buckets.reduce((s, b) => s + b.onDue, 0);
    return { invoices: out, weeks: buckets, profiles, house: m.house, houseN: m.houseN, inWindow, dueWindow, open: out.reduce((s, x) => s + x.balance, 0) };
  };

  /* ---------- passkey sealing (WebAuthn PRF) ---------- */
  const wc = () => root.crypto || require('node:crypto').webcrypto;
  C.PRF_INFO = 'stark-ledger|1|passkey-wrap';
  C.prfKey = async function (prf) { // prf: 32 bytes from the authenticator
    const base = await wc().subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey']);
    return wc().subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('stark-ledger-prf-salt'), info: new TextEncoder().encode(C.PRF_INFO) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  };
  C.sealPass = async function (prf, credId, pass) { return C.encryptBytes(await C.prfKey(prf), new TextEncoder().encode(pass), C.aad('passkey', C.b64(credId))); };
  C.openPass = async function (prf, credId, rec) { return new TextDecoder().decode(await C.openRec(await C.prfKey(prf), rec, C.aad('passkey', C.b64(credId)), true)); };
  C.passkeyRecordOk = r => !!r && r.credId instanceof Uint8Array && r.credId.length >= 16 && r.credId.length <= 1023 && r.prfSalt instanceof Uint8Array && r.prfSalt.length === 32 && r.sealed && r.sealed.a === 1;

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
