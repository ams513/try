/* Stark Builder, by Stark. Draws a plan or a site as an SVG string: used for library thumbnails,
   printable sheets and the SVG download. Pure string building, no DOM. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const C = SB.core || (typeof require !== 'undefined' ? require('./core.js') : null);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n2 = v => (Math.round(v * 100) / 100).toString();
  const SWING = (plan, w, o) => { // +1 means the leaf swings toward the wall's left-hand normal
    const bb = C.bbox(plan), L = C.wallLen(w), dx = (w.b[0] - w.a[0]) / L, dz = (w.b[1] - w.a[1]) / L, nx = -dz, nz = dx;
    let sg = 1;
    if (w.type === 'ext') { const mx = (w.a[0] + w.b[0]) / 2 - (bb.x0 + bb.x1) / 2, mz = (w.a[1] + w.b[1]) / 2 - (bb.y0 + bb.y1) / 2; sg = (mx * nx + mz * nz >= 0) ? -1 : 1; }
    return o.flip ? -sg : sg;
  };

  /* Draws the plan into SVG elements positioned with a world->svg transform tf = {x,y,rot} (rot in quarter turns, optional). */
  function planBody(plan, opt) {
    opt = opt || {};
    const sys = opt.units || 'metric', ink = opt.ink || '#1b2420', paper = opt.paper || '#ffffff';
    const out = [];
    const T = opt.tf || null;
    const P = p => { if (!T) return p; const c = [1, 0, -1, 0][T.rot || 0], s = [0, 1, 0, -1][T.rot || 0]; const x = p[0] - T.cx, z = p[1] - T.cz; return [T.x + x * c + z * s, T.y - x * s + z * c]; };
    const lw = (a, b) => [P(a), P(b)];
    (plan.rooms || []).forEach((r, i) => {
      const pts = r.pts.map(P).map(p => n2(p[0]) + ',' + n2(p[1])).join(' ');
      out.push('<polygon points="' + pts + '" fill="' + (opt.roomFill || '#eef3f0') + '" stroke="none"/>');
    });
    (plan.walls || []).forEach(w => {
      const [a, b] = lw(w.a, w.b); const L = C.dist(a, b); if (L < 1e-6) return;
      const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L, nx = -dy, ny = dx, h = Math.max(w.t, opt.minT || 0) / 2;
      const q = [[a[0] + nx * h, a[1] + ny * h], [b[0] + nx * h, b[1] + ny * h], [b[0] - nx * h, b[1] - ny * h], [a[0] - nx * h, a[1] - ny * h]];
      out.push('<polygon points="' + q.map(p => n2(p[0]) + ',' + n2(p[1])).join(' ') + '" fill="' + (w.type === 'ext' ? ink : '#55615a') + '" stroke="none"/>');
    });
    (plan.openings || []).forEach(o => {
      const w = C.findWall(plan, o.wall); if (!w) return;
      const [a, b] = lw(w.a, w.b); const L = C.dist(a, b), dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L, nx = -dy, ny = dx, h = Math.max(w.t, opt.minT || 0) / 2 + 0.01;
      const s0 = o.s - o.w / 2, s1 = o.s + o.w / 2, A = [a[0] + dx * s0, a[1] + dy * s0], B = [a[0] + dx * s1, a[1] + dy * s1];
      const q = [[A[0] + nx * h, A[1] + ny * h], [B[0] + nx * h, B[1] + ny * h], [B[0] - nx * h, B[1] - ny * h], [A[0] - nx * h, A[1] - ny * h]];
      out.push('<polygon points="' + q.map(p => n2(p[0]) + ',' + n2(p[1])).join(' ') + '" fill="' + paper + '" stroke="none"/>');
      const sw = Math.max(0.025, (opt.lineW || 0.03));
      if (o.type === 'window') {
        out.push('<line x1="' + n2(A[0]) + '" y1="' + n2(A[1]) + '" x2="' + n2(B[0]) + '" y2="' + n2(B[1]) + '" stroke="#2a7a9a" stroke-width="' + n2(sw * 2) + '"/>');
        [-1, 1].forEach(k => out.push('<line x1="' + n2(A[0] + nx * h * 0.5 * k) + '" y1="' + n2(A[1] + ny * h * 0.5 * k) + '" x2="' + n2(B[0] + nx * h * 0.5 * k) + '" y2="' + n2(B[1] + ny * h * 0.5 * k) + '" stroke="' + ink + '" stroke-width="' + n2(sw) + '"/>'));
      } else {
        const sg = SWING(plan, w, o);
        // hinge at A, leaf perpendicular, arc to B
        const hx = A[0], hy = A[1], r = o.w, lx = hx + nx * sg * r, ly = hy + ny * sg * r;
        const sweep = sg > 0 ? 0 : 1;
        out.push('<line x1="' + n2(hx) + '" y1="' + n2(hy) + '" x2="' + n2(lx) + '" y2="' + n2(ly) + '" stroke="' + ink + '" stroke-width="' + n2(sw) + '"/>');
        out.push('<path d="M' + n2(lx) + ' ' + n2(ly) + ' A' + n2(r) + ' ' + n2(r) + ' 0 0 ' + sweep + ' ' + n2(B[0]) + ' ' + n2(B[1]) + '" fill="none" stroke="' + ink + '" stroke-width="' + n2(sw * 0.7) + '" stroke-dasharray="' + n2(sw * 3) + ' ' + n2(sw * 2) + '"/>');
      }
    });
    if (opt.items !== false) out.push(itemsBody(plan, P, opt));
    if (opt.labels) {
      (plan.rooms || []).forEach(r => {
        const c = P(C.centroid(r.pts)), fs = opt.fontSize || 0.28;
        out.push('<text x="' + n2(c[0]) + '" y="' + n2(c[1]) + '" font-size="' + n2(fs) + '" text-anchor="middle" fill="' + ink + '" font-family="Segoe UI,Arial,sans-serif" font-weight="600">' + esc(r.name) + '</text>');
        out.push('<text x="' + n2(c[0]) + '" y="' + n2(c[1] + fs * 1.25) + '" font-size="' + n2(fs * 0.8) + '" text-anchor="middle" fill="#55615a" font-family="Segoe UI,Arial,sans-serif">' + esc(C.fmtArea(C.polyArea(r.pts), sys)) + '</text>');
      });
    }
    return out.join('');
  }

  /* Stairs (outline, treads, an arrow pointing up the run), furniture outlines and electrical / plumbing symbols. */
  const MCOL = { elec: '#b7791f', plumb: '#2f86ad' };
  function itemsBody(plan, P, opt) {
    const out = [], ink = opt.ink || '#1b2420', cat = SB.catalog || (typeof require !== 'undefined' ? require('../data/catalog.js') : null);
    const poly = pts => pts.map(P).map(p => n2(p[0]) + ',' + n2(p[1])).join(' ');
    const line = (a, b, w, col) => { const A = P(a), B = P(b); return '<line x1="' + n2(A[0]) + '" y1="' + n2(A[1]) + '" x2="' + n2(B[0]) + '" y2="' + n2(B[1]) + '" stroke="' + (col || ink) + '" stroke-width="' + n2(w) + '"/>'; };
    (plan.stairs || []).forEach(s => {
      const r = C.stairRect(s), d = r.dir, nx = -d[1], ny = d[0], n = Math.max(2, Math.ceil((C.wallH(plan) + C.FLOOR_T) / 0.19 - 1e-9)), g = s.len / (n - 1);
      out.push('<polygon points="' + poly([[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]]) + '" fill="#f6f3ec" stroke="' + ink + '" stroke-width="0.025"/>');
      for (let i = 1; i < n - 1; i++) { const c = [r.bottom[0] + d[0] * g * i, r.bottom[1] + d[1] * g * i]; out.push(line([c[0] + nx * s.w / 2, c[1] + ny * s.w / 2], [c[0] - nx * s.w / 2, c[1] - ny * s.w / 2], 0.012)); }
      const tip = [r.top[0] - d[0] * 0.12, r.top[1] - d[1] * 0.12], base = [r.bottom[0] + d[0] * 0.15, r.bottom[1] + d[1] * 0.15];
      out.push(line(base, tip, 0.03, '#5b3fc4'), line(tip, [tip[0] - d[0] * 0.25 + nx * 0.15, tip[1] - d[1] * 0.25 + ny * 0.15], 0.03, '#5b3fc4'), line(tip, [tip[0] - d[0] * 0.25 - nx * 0.15, tip[1] - d[1] * 0.25 - ny * 0.15], 0.03, '#5b3fc4'));
      const t = P([r.bottom[0] + d[0] * 0.45 + nx * s.w * 0.22, r.bottom[1] + d[1] * 0.45 + ny * s.w * 0.22]);
      out.push('<text x="' + n2(t[0]) + '" y="' + n2(t[1]) + '" font-size="0.2" text-anchor="middle" fill="#5b3fc4" font-family="Segoe UI,Arial,sans-serif" font-weight="700">UP</text>');
    });
    (plan.items || []).forEach(it => {
      if (it.cat === 'furn') {
        const odd = it.rot % 2 === 1, w = odd ? it.d : it.w, dd = odd ? it.w : it.d, f = cat && cat.furn(it.kind);
        out.push('<polygon points="' + poly([[it.x - w / 2, it.y - dd / 2], [it.x + w / 2, it.y - dd / 2], [it.x + w / 2, it.y + dd / 2], [it.x - w / 2, it.y + dd / 2]]) + '" fill="#f4f1ea" stroke="#7d8781" stroke-width="0.02"/>');
        const fs = Math.min(0.16, Math.max(w, dd) / 7), c = P([it.x, it.y]);
        if (f && Math.max(w, dd) >= 0.6) out.push('<text x="' + n2(c[0]) + '" y="' + n2(c[1] + fs * 0.35) + '" font-size="' + n2(fs) + '" text-anchor="middle" fill="#55615a" font-family="Segoe UI,Arial,sans-serif">' + esc(f.label) + '</text>');
      } else {
        const m = cat && cat.marker(it.cat, it.kind), c = P([it.x, it.y]);
        out.push('<circle cx="' + n2(c[0]) + '" cy="' + n2(c[1]) + '" r="0.14" fill="' + MCOL[it.cat] + '" stroke="#ffffff" stroke-width="0.02"/>');
        out.push('<text x="' + n2(c[0]) + '" y="' + n2(c[1] + 0.04) + '" font-size="0.11" text-anchor="middle" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif" font-weight="700">' + esc(m ? m.sym : '?') + '</text>');
      }
    });
    return out.join('');
  }

  /* A complete plan sheet SVG with overall dimensions. opt: {units, labels, dims, px (pixel width)} */
  function planSVG(plan, opt) {
    opt = Object.assign({ units: 'metric', labels: true, dims: true, px: 900 }, opt || {});
    const bb = C.bbox(plan), m = opt.dims ? 1.4 : 0.5;
    let x0 = bb.x0 - m, y0 = bb.y0 - m, W = Math.max(1, bb.w + 2 * m), Hh = Math.max(1, bb.d + 2 * m);
    const fs = Math.max(0.16, Math.min(W, Hh) / 28);
    /* picture export: opt.bg is a colour or 'none'; opt.frame {w, h, pad} centres the plan in a frame of that aspect ratio and pixel size */
    const bgc = opt.bg === 'none' ? null : (opt.bg || '#ffffff'), PIC = SB.picture || (typeof require !== 'undefined' ? require('./picture.js') : null);
    if (opt.frame && PIC) { const vb = PIC.fitViewBox([x0, y0, W, Hh], opt.frame.w / opt.frame.h, opt.frame.pad); x0 = vb[0]; y0 = vb[1]; W = vb[2]; Hh = vb[3]; }
    /* door and window gaps take the background colour; on a transparent picture they take the room colour, so no white patch is left */
    let body = planBody(plan, { units: opt.units, labels: opt.labels, fontSize: fs * 1.15, lineW: fs / 8, ink: opt.ink, paper: opt.paper || bgc || '#eef3f0' });
    if (opt.dims && bb.w > 0) {
      const ink = '#1b2420', t = fs * 0.35, yy = bb.y0 - 0.7, xx = bb.x0 - 0.7;
      const dim = (ax, ay, bx, by, txt, vert) => {
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        return '<line x1="' + n2(ax) + '" y1="' + n2(ay) + '" x2="' + n2(bx) + '" y2="' + n2(by) + '" stroke="' + ink + '" stroke-width="' + n2(fs / 10) + '"/>' +
          '<line x1="' + n2(ax - (vert ? t : 0)) + '" y1="' + n2(ay - (vert ? 0 : t)) + '" x2="' + n2(ax + (vert ? t : 0)) + '" y2="' + n2(ay + (vert ? 0 : t)) + '" stroke="' + ink + '" stroke-width="' + n2(fs / 10) + '"/>' +
          '<line x1="' + n2(bx - (vert ? t : 0)) + '" y1="' + n2(by - (vert ? 0 : t)) + '" x2="' + n2(bx + (vert ? t : 0)) + '" y2="' + n2(by + (vert ? 0 : t)) + '" stroke="' + ink + '" stroke-width="' + n2(fs / 10) + '"/>' +
          '<text x="' + n2(mx) + '" y="' + n2(my) + '" font-size="' + n2(fs) + '" text-anchor="middle" fill="' + ink + '" font-family="Segoe UI,Arial,sans-serif" ' +
          (vert ? 'transform="rotate(-90 ' + n2(mx - fs * 0.5) + ' ' + n2(my) + ')" dx="' + n2(-fs * 0.5) + '"' : 'dy="' + n2(-fs * 0.45) + '"') + '>' + esc(txt) + '</text>';
      };
      body += dim(bb.x0, yy, bb.x1, yy, C.fmtLen(bb.w, opt.units), false) + dim(xx, bb.y0, xx, bb.y1, C.fmtLen(bb.d, opt.units), true);
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + n2(x0) + ' ' + n2(y0) + ' ' + n2(W) + ' ' + n2(Hh) + '" width="' + opt.px + '" height="' + (opt.frame ? opt.frame.h : Math.round(opt.px * Hh / W)) + '" role="img" aria-label="' + esc(plan.name) + ' floor plan">' + (bgc ? '<rect x="' + n2(x0) + '" y="' + n2(y0) + '" width="' + n2(W) + '" height="' + n2(Hh) + '" fill="' + bgc + '"/>' : '') + body + '</svg>';
  }

  const UTIL = { solar: ['Solar', '#3b5b8c', 4, 2], water: ['Water', '#2f86ad', 2, 2], septic: ['Septic', '#8a7b5c', 5, 3], power: ['Power', '#5a4a38', 0.8, 0.8], parking: ['Parking', '#a49d8d', 5, 3] };
  function siteSVG(site, opt) {
    opt = Object.assign({ units: 'metric', px: 900 }, opt || {});
    const m = 4, W = site.w + 2 * m, Hh = site.d + 2 * m, fs = Math.max(0.5, Math.max(site.w, site.d) / 55);
    const out = ['<rect x="' + -m + '" y="' + -m + '" width="' + n2(W) + '" height="' + n2(Hh) + '" fill="#ffffff"/>',
      '<rect x="0" y="0" width="' + n2(site.w) + '" height="' + n2(site.d) + '" fill="#eef3ea" stroke="#1b2420" stroke-width="' + n2(fs / 6) + '"/>'];
    if (site.setback > 0) out.push('<rect x="' + n2(site.setback) + '" y="' + n2(site.setback) + '" width="' + n2(Math.max(0, site.w - 2 * site.setback)) + '" height="' + n2(Math.max(0, site.d - 2 * site.setback)) + '" fill="none" stroke="#b3261e" stroke-width="' + n2(fs / 8) + '" stroke-dasharray="' + n2(fs) + ' ' + n2(fs * 0.6) + '"/>');
    site.paths.forEach(p => out.push('<polyline points="' + p.pts.map(q => n2(q[0]) + ',' + n2(q[1])).join(' ') + '" fill="none" stroke="#b8ad98" stroke-width="' + n2(p.w) + '" stroke-linejoin="round"/>'));
    site.utils.forEach(u => {
      const d = UTIL[u.kind];
      if (u.kind === 'water' || u.kind === 'power') out.push('<circle cx="' + n2(u.x) + '" cy="' + n2(u.y) + '" r="' + n2(d[2] / 2) + '" fill="' + d[1] + '"/>');
      else out.push('<rect x="' + n2(u.x - d[2] / 2) + '" y="' + n2(u.y - d[3] / 2) + '" width="' + d[2] + '" height="' + d[3] + '" fill="' + d[1] + '" opacity="0.85"/>');
      out.push('<text x="' + n2(u.x) + '" y="' + n2(u.y + d[3] / 2 + fs * 1.1) + '" font-size="' + n2(fs) + '" text-anchor="middle" fill="#1b2420" font-family="Segoe UI,Arial,sans-serif">' + d[0] + ' (phase ' + u.phase + ')</text>');
    });
    site.buildings.forEach(b => {
      const bb = C.bbox(b.plan);
      out.push(planBody(b.plan, { units: opt.units, lineW: 0.03, tf: { cx: (bb.x0 + bb.x1) / 2, cz: (bb.y0 + bb.y1) / 2, x: b.x, y: b.y, rot: b.rot }, minT: fs / 5, items: false }));
      const w = b.rot % 2 ? bb.d : bb.w, d = b.rot % 2 ? bb.w : bb.d;
      out.push('<text x="' + n2(b.x) + '" y="' + n2(b.y - d / 2 - fs * 0.5) + '" font-size="' + n2(fs * 1.1) + '" text-anchor="middle" fill="#1b2420" font-family="Segoe UI,Arial,sans-serif" font-weight="700">' + esc(b.name) + ' (phase ' + b.phase + ')</text>');
    });
    out.push('<text x="0" y="' + n2(site.d + fs * 2.2) + '" font-size="' + n2(fs * 1.1) + '" fill="#55615a" font-family="Segoe UI,Arial,sans-serif">Lot ' + esc(C.fmtLen(site.w, opt.units)) + ' x ' + esc(C.fmtLen(site.d, opt.units)) + ', dashed red line = example setback ' + esc(C.fmtLen(site.setback, opt.units)) + ' (check your local rules)</text>');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + -m + ' ' + -m + ' ' + n2(W) + ' ' + n2(Hh) + '" width="' + opt.px + '" height="' + Math.round(opt.px * Hh / W) + '" role="img" aria-label="Site plan">' + out.join('') + '</svg>';
  }
  SB.svg = { planSVG, siteSVG, planBody, esc, UTIL, MCOL };
  if (typeof module !== 'undefined' && module.exports) module.exports = SB.svg;
})(typeof window !== 'undefined' ? window : globalThis);
