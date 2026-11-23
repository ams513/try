/* Stark Beam 1.0, the fallback QR reader for browsers without BarcodeDetector. Pure JS, no library, no network.
   Written for Stark from the public QR standard (ISO/IEC 18004; the layout rules as described in the free QR code tutorials and the standard's own tables)
   and the textbook Reed-Solomon decoder (Berlekamp-Massey, Chien search, Forney). No third-party QR code was copied, so no third-party licence applies.
   Reads QR versions 1 to 10, byte mode, any error-correction level, any rotation, mild perspective. It does not read mirrored codes or other modes.
   StarkBeamQR.scan(rgba, width, height) -> { text } or null.   StarkBeamQR.scanGray(gray, w, h) the same from one byte per pixel.
   StarkBeamQR.readMatrix(rows) reads an already sampled matrix (rows of 0/1), used by the tests. */
(function (root) {
  'use strict';
  var R = {};

  /* ---------- GF(256), polynomial 0x11D ---------- */
  var GX = new Uint8Array(512), GL = new Uint8Array(256);
  (function () { var x = 1, i; for (i = 0; i < 255; i++) { GX[i] = x; GL[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (i = 255; i < 512; i++) GX[i] = GX[i - 255]; })();
  function gm(a, b) { return a && b ? GX[GL[a] + GL[b]] : 0; }
  function gd(a, b) { return a ? GX[(GL[a] + 255 - GL[b]) % 255] : 0; }

  /* Reed-Solomon: corrects up to nsym/2 wrong codewords in place; returns false when it cannot (or the result does not check) */
  function syndromes(msg, nsym) {
    var s = [], j, i, v, any = false;
    for (j = 0; j < nsym; j++) { v = 0; for (i = 0; i < msg.length; i++) v = gm(v, GX[j]) ^ msg[i]; s.push(v); if (v) any = true; }
    return any ? s : null;
  }
  function rsFix(msg, nsym) {
    var S = syndromes(msg, nsym), n = msg.length, C, Bp, L, m, b, i, d, T, coef, nI, pos, p, x, v, omega, deriv, e, xi;
    if (!S) return true;
    C = [1]; Bp = [1]; L = 0; m = 1; b = 1;
    for (nI = 0; nI < nsym; nI++) {
      d = S[nI]; for (i = 1; i <= L; i++) d ^= gm(C[i] || 0, S[nI - i]);
      if (!d) { m++; continue; }
      T = C.slice(); coef = gd(d, b);
      for (i = 0; i < Bp.length; i++) C[i + m] = (C[i + m] || 0) ^ gm(coef, Bp[i]);
      if (2 * L <= nI) { L = nI + 1 - L; Bp = T; b = d; m = 1; } else m++;
    }
    if (L > nsym >> 1) return false;
    pos = [];
    for (p = 0; p < n; p++) { x = GX[(255 - p) % 255]; v = 0; for (i = C.length - 1; i >= 0; i--) v = gm(v, x) ^ (C[i] || 0); if (!v) pos.push(p); }
    if (pos.length !== L) return false;
    omega = [];   // S(x) * C(x) mod x^nsym
    for (i = 0; i < nsym; i++) { v = 0; for (e = 0; e <= i; e++) v ^= gm(C[e] || 0, S[i - e]); omega.push(v); }
    deriv = []; for (i = 1; i < C.length; i += 2) deriv[(i - 1) >> 1] = C[i] || 0;
    for (i = 0; i < pos.length; i++) {
      xi = GX[pos[i]]; x = GX[(255 - pos[i]) % 255];
      v = 0; for (e = omega.length - 1; e >= 0; e--) v = gm(v, x) ^ omega[e];
      d = 0; for (e = deriv.length - 1; e >= 0; e--) d = gm(d, gm(x, x)) ^ (deriv[e] || 0);
      if (!d) return false;
      msg[n - 1 - pos[i]] ^= gm(xi, gd(v, d));
    }
    return !syndromes(msg, nsym);
  }
  R.rsFix = rsFix;

  /* ---------- the standard's tables for versions 1 to 10: [EC codewords per block, blocks of the first size, data codewords each, blocks of the second size, data codewords each] ---------- */
  var EC_LEVELS = { 1: 'L', 0: 'M', 3: 'Q', 2: 'H' };   // the two format bits -> level
  var TAB = {
    1: { L: [7, 1, 19, 0, 0], M: [10, 1, 16, 0, 0], Q: [13, 1, 13, 0, 0], H: [17, 1, 9, 0, 0] },
    2: { L: [10, 1, 34, 0, 0], M: [16, 1, 28, 0, 0], Q: [22, 1, 22, 0, 0], H: [28, 1, 16, 0, 0] },
    3: { L: [15, 1, 55, 0, 0], M: [26, 1, 44, 0, 0], Q: [18, 2, 17, 0, 0], H: [22, 2, 13, 0, 0] },
    4: { L: [20, 1, 80, 0, 0], M: [18, 2, 32, 0, 0], Q: [26, 2, 24, 0, 0], H: [16, 4, 9, 0, 0] },
    5: { L: [26, 1, 108, 0, 0], M: [24, 2, 43, 0, 0], Q: [18, 2, 15, 2, 16], H: [22, 2, 11, 2, 12] },
    6: { L: [18, 2, 68, 0, 0], M: [16, 4, 27, 0, 0], Q: [24, 4, 19, 0, 0], H: [28, 4, 15, 0, 0] },
    7: { L: [20, 2, 78, 0, 0], M: [18, 4, 31, 0, 0], Q: [18, 2, 14, 4, 15], H: [26, 4, 13, 1, 14] },
    8: { L: [24, 2, 97, 0, 0], M: [22, 2, 38, 2, 39], Q: [22, 4, 18, 2, 19], H: [26, 4, 14, 2, 15] },
    9: { L: [30, 2, 116, 0, 0], M: [22, 3, 36, 2, 37], Q: [20, 4, 16, 4, 17], H: [24, 4, 12, 4, 13] },
    10: { L: [18, 2, 68, 2, 69], M: [26, 4, 43, 1, 44], Q: [24, 6, 19, 2, 20], H: [28, 6, 15, 2, 16] }
  };
  var AP = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  var MASK = [function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; }, function (r, c) { return c % 3 === 0; }, function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; }, function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; }, function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }];

  /* the 15-bit format word (BCH(15,5), generator 0x537, masked with 0x5412) for every level and mask, to match a damaged word by distance */
  var FORMATS = (function () { var out = [], d, r, i; for (d = 0; d < 32; d++) { r = d; for (i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); out.push({ word: ((d << 10) | r) ^ 0x5412, ec: EC_LEVELS[d >> 3], mask: d & 7 }); } return out; })();
  function bitCount(x) { var n = 0; while (x) { n++; x &= x - 1; } return n; }
  function bestFormat(word) { var best = null, bd = 99, i, dist; for (i = 0; i < 32; i++) { dist = bitCount(word ^ FORMATS[i].word); if (dist < bd) { bd = dist; best = FORMATS[i]; } } return bd <= 3 ? best : null; }

  /* which modules are not data: finders with separators, timing, alignment, format and version areas, the dark module */
  var FN_CACHE = {};
  function functionMap(v) {
    if (FN_CACHE[v]) return FN_CACHE[v];
    var n = 17 + 4 * v, f = [], r, c, i, j, a = AP[v], ci, rr;
    for (r = 0; r < n; r++) f.push(new Uint8Array(n));
    for (r = 0; r < 9; r++) for (c = 0; c < 9; c++) f[r][c] = 1;
    for (r = 0; r < 9; r++) for (c = n - 8; c < n; c++) f[r][c] = 1;
    for (r = n - 8; r < n; r++) for (c = 0; c < 9; c++) f[r][c] = 1;
    for (i = 0; i < n; i++) { f[6][i] = 1; f[i][6] = 1; }
    for (i = 0; i < a.length; i++) for (j = 0; j < a.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === a.length - 1) || (i === a.length - 1 && j === 0)) continue;
      for (rr = -2; rr <= 2; rr++) for (ci = -2; ci <= 2; ci++) f[a[i] + rr][a[j] + ci] = 1;
    }
    if (v >= 7) for (r = 0; r < 6; r++) for (c = n - 11; c < n - 8; c++) { f[r][c] = 1; f[c][r] = 1; }
    f[n - 8][8] = 1;
    return (FN_CACHE[v] = f);
  }

  /* modules (rows of 0/1, row 0 at the top) -> text, or null */
  R.readMatrix = function (m) {
    var n = m.length, v = (n - 17) / 4, i, w1 = 0, w2 = 0, fm, bits, bytes, row, col, up, b, k, tab, blocks, data, off, total, len, p, text, fn, x, y, j;
    if (v !== Math.floor(v) || v < 1 || v > 10) return null;
    for (i = 0; i <= 5; i++) w1 |= m[i][8] << i;   // the first copy of the format word, around the top left finder
    w1 |= m[7][8] << 6; w1 |= m[8][8] << 7; w1 |= m[8][7] << 8;
    for (i = 9; i < 15; i++) w1 |= m[8][14 - i] << i;
    for (i = 0; i < 8; i++) w2 |= m[8][n - 1 - i] << i;   // the second copy, split between the top right and bottom left finders
    for (i = 8; i < 15; i++) w2 |= m[n - 15 + i][8] << i;
    fm = bestFormat(w1) || bestFormat(w2);
    if (!fm) return null;
    fn = functionMap(v); bits = [];
    up = true;
    for (x = n - 1; x >= 1; x -= 2) {   // the zigzag in column pairs from the bottom right, skipping the vertical timing column
      if (x === 6) x = 5;
      for (k = 0; k < n; k++) { y = up ? n - 1 - k : k; for (j = 0; j < 2; j++) { col = x - j; if (!fn[y][col]) bits.push(m[y][col] ^ (MASK[fm.mask](y, col) ? 1 : 0)); } }
      up = !up;
    }
    tab = TAB[v][fm.ec]; total = tab[1] * (tab[2] + tab[0]) + tab[3] * (tab[4] + tab[0]);
    if (bits.length < total * 8) return null;
    bytes = []; for (i = 0; i < total; i++) { b = 0; for (j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j]; bytes.push(b); }
    blocks = []; for (i = 0; i < tab[1]; i++) blocks.push({ d: tab[2], data: [], ec: [] }); for (i = 0; i < tab[3]; i++) blocks.push({ d: tab[4], data: [], ec: [] });
    off = 0; for (i = 0; i < tab[4] || i < tab[2]; i++) blocks.forEach(function (bl) { if (i < bl.d) bl.data.push(bytes[off++]); });
    for (i = 0; i < tab[0]; i++) blocks.forEach(function (bl) { bl.ec.push(bytes[off++]); });
    data = [];
    for (i = 0; i < blocks.length; i++) { row = blocks[i].data.concat(blocks[i].ec); if (!rsFix(row, tab[0])) return null; data = data.concat(row.slice(0, blocks[i].d)); }
    /* the data: 4 bit mode, character count, bytes. Only byte mode (0100). */
    p = 0; function take(nb) { var r = 0, q; for (q = 0; q < nb; q++) { r = (r << 1) | ((data[p >> 3] >> (7 - (p & 7))) & 1); p++; } return r; }
    if (take(4) !== 4) return null;
    len = take(v <= 9 ? 8 : 16); if (p + len * 8 > data.length * 8) return null;
    text = []; for (i = 0; i < len; i++) text.push(take(8));
    return utf8(text);
  };
  function utf8(a) { var s = '', i = 0, c, t; while (i < a.length) { c = a[i++]; if (c < 128) s += String.fromCharCode(c); else if (c >= 0xC0 && c < 0xE0 && i < a.length) s += String.fromCharCode(((c & 31) << 6) | (a[i++] & 63)); else if (c >= 0xE0 && c < 0xF0 && i + 1 < a.length) { t = ((c & 15) << 12) | ((a[i] & 63) << 6) | (a[i + 1] & 63); i += 2; s += String.fromCharCode(t); } else s += '�'; } return s; }

  /* ---------- from a picture to the matrix ---------- */
  /* one bit per pixel (1 = dark) from grey values, using the mean of a window around each pixel so uneven light does not matter */
  function binarize(g, w, h) {
    var I = new Int32Array((w + 1) * (h + 1)), x, y, row, win = Math.max(15, ((Math.max(w, h) / 10) | 0) | 1), hw = win >> 1, out = new Uint8Array(w * h), x0, x1, y0, y1, sum, area, W1 = w + 1;
    for (y = 0; y < h; y++) { row = 0; for (x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; } }
    for (y = 0; y < h; y++) {
      y0 = Math.max(0, y - hw); y1 = Math.min(h, y + hw + 1);
      for (x = 0; x < w; x++) {
        x0 = Math.max(0, x - hw); x1 = Math.min(w, x + hw + 1);
        sum = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]; area = (x1 - x0) * (y1 - y0);
        out[y * w + x] = g[y * w + x] * area < sum * 0.88 ? 1 : 0;
      }
    }
    return out;
  }
  /* finder pattern candidates: runs dark-light-dark-light-dark in the ratio 1:1:3:1:1 across a row, confirmed down the column and across again */
  function ratioOk(a, b, c, d, e) { var t = a + b + c + d + e, u = t / 7, tol = u * 0.55; return t >= 7 && Math.abs(a - u) < tol && Math.abs(b - u) < tol && Math.abs(c - 3 * u) < 3 * tol && Math.abs(d - u) < tol && Math.abs(e - u) < tol; }
  function crossRuns(bin, w, h, x, y, dx, dy) {   // lengths of the runs [c, light, dark] going out from a dark centre pixel in one direction (and the other, summed by the caller)
    var out = [0, 0, 0], st = 0, px = x, py = y, want = 1;
    while (px >= 0 && py >= 0 && px < w && py < h && st < 3) { if (bin[py * w + px] === want) out[st]++; else { st++; want ^= 1; if (st < 3) out[st]++; } px += dx; py += dy; }
    return st >= 2 ? out : null;   // a pattern that runs off the picture does not count
  }
  function checkLine(bin, w, h, x, y, dx, dy) {   // returns { size, centre } along one axis through (x, y), or null
    var a = crossRuns(bin, w, h, x, y, dx, dy), b = crossRuns(bin, w, h, x, y, -dx, -dy);
    if (!a || !b) return null;
    var c = a[0] + b[0] - 1;   // the centre dark run, counted twice at the middle pixel
    if (!ratioOk(b[2], b[1], c, a[1], a[2])) return null;
    return { size: b[2] + b[1] + c + a[1] + a[2], shift: (a[0] - b[0]) / 2 };
  }
  function findFinders(bin, w, h) {
    var cands = [], y, x, runs, starts, i, a, b, c, d, e, cx, cy, hv, vv, hh, unit, found, k, q, v0, s0, firstDark;
    for (y = 0; y < h; y++) {
      runs = []; starts = []; x = 0;
      while (x < w) { v0 = bin[y * w + x]; s0 = x; while (x < w && bin[y * w + x] === v0) x++; runs.push(x - s0); starts.push(s0); }
      firstDark = bin[y * w] === 1 ? 0 : 1;
      for (i = firstDark; i + 4 < runs.length; i += 2) {
        a = runs[i]; b = runs[i + 1]; c = runs[i + 2]; d = runs[i + 3]; e = runs[i + 4];
        if (!ratioOk(a, b, c, d, e)) continue;
        cx = Math.round(starts[i + 2] + c / 2 - 0.5);
        vv = checkLine(bin, w, h, cx, y, 0, 1); if (!vv) continue;
        cy = Math.round(y + vv.shift);
        hv = checkLine(bin, w, h, cx, cy, 1, 0); if (!hv) continue;
        hh = checkLine(bin, w, h, Math.round(cx + hv.shift), cy, 0, 1); if (!hh) continue;
        cx = cx + hv.shift; cy = cy + hh.shift; unit = (hv.size + hh.size) / 14;
        found = false;
        for (k = 0; k < cands.length; k++) { q = cands[k]; if (Math.abs(q.x - cx) < q.unit * 3.5 && Math.abs(q.y - cy) < q.unit * 3.5) { q.x = (q.x * q.n + cx) / (q.n + 1); q.y = (q.y * q.n + cy) / (q.n + 1); q.unit = (q.unit * q.n + unit) / (q.n + 1); q.n++; found = true; break; } }
        if (!found) cands.push({ x: cx, y: cy, unit: unit, n: 1 });
      }
    }
    return cands.filter(function (q) { return q.n >= 2; }).sort(function (p, q) { return q.n - p.n; }).slice(0, 12);
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  /* projective map from 4 model points to 4 image points: solves the 8 unknowns by elimination */
  function homography(mp, ip) {
    var A = [], i, r, c, k, p, t, f, h;
    for (i = 0; i < 4; i++) {
      A.push([mp[i][0], mp[i][1], 1, 0, 0, 0, -ip[i][0] * mp[i][0], -ip[i][0] * mp[i][1], ip[i][0]]);
      A.push([0, 0, 0, mp[i][0], mp[i][1], 1, -ip[i][1] * mp[i][0], -ip[i][1] * mp[i][1], ip[i][1]]);
    }
    for (c = 0; c < 8; c++) {
      p = c; for (r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-12) return null;
      t = A[p]; A[p] = A[c]; A[c] = t;
      for (r = 0; r < 8; r++) if (r !== c) { f = A[r][c] / A[c][c]; for (k = c; k < 9; k++) A[r][k] -= f * A[c][k]; }
    }
    h = []; for (i = 0; i < 8; i++) h.push(A[i][8] / A[i][i]);
    return function (x, y) { var d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };
  }
  function at(bin, w, h, x, y) { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < w && y < h ? bin[y * w + x] : 0; }
  /* the bottom right alignment pattern (a dark centre, a light ring, a dark ring): look for it near where the three finders say it should be */
  function alignScore(bin, w, h, cx, cy, ex, ey) {
    var s = 0, i, j;
    for (j = -2; j <= 2; j++) for (i = -2; i <= 2; i++) if (at(bin, w, h, cx + i * ex.x + j * ey.x, cy + i * ex.y + j * ey.y) === (Math.max(Math.abs(i), Math.abs(j)) === 1 ? 0 : 1)) s++;
    return s;
  }
  /* the bottom right alignment pattern (a dark centre, a light ring, a dark ring): a coarse search around where the three finders say it should be, then a fine one */
  function findAlign(bin, w, h, pred, ex, ey) {
    var best = null, bs = -1, sx, sy, s, cx, cy, pen, c = { x: pred.x, y: pred.y }, r, st;
    function pass(radius, step) {
      var k, l, bx = c.x, by = c.y;
      for (l = -radius; l <= radius; l += step) for (k = -radius; k <= radius; k += step) {
        cx = c.x + k * ex.x + l * ey.x; cy = c.y + k * ex.y + l * ey.y; s = alignScore(bin, w, h, cx, cy, ex, ey) - 0.01 * Math.hypot(k, l);
        if (s > bs) { bs = s; bx = cx; by = cy; }
      }
      c = { x: bx, y: by };
    }
    pass(6, 0.5); bs = -1; pass(0.6, 0.15);
    return alignScore(bin, w, h, c.x, c.y, ex, ey) >= 21 ? c : null;
  }
  function sample(bin, w, h, T, n) {
    var m = [], r, c, row, off = [[0, 0], [-0.22, 0], [0.22, 0], [0, -0.22], [0, 0.22]], k, sum, p;
    for (r = 0; r < n; r++) { row = []; for (c = 0; c < n; c++) { sum = 0; for (k = 0; k < 5; k++) { p = T(c + 0.5 + off[k][0], r + 0.5 + off[k][1]); sum += at(bin, w, h, p[0], p[1]); } row.push(sum >= 3 ? 1 : 0); } m.push(row); }
    return m;
  }
  function tryTriple(bin, w, h, a, b, c) {
    var tl, tr, bl, cross, unit, dimF, v0, vs, vi, v, n, ex, ey, pred, al, T, mp, ip, m, text, p1, att;
    // the corner is the finder opposite the longest side
    var dab = dist(a, b), dac = dist(a, c), dbc = dist(b, c);
    if (dab >= dac && dab >= dbc) { tl = c; tr = a; bl = b; } else if (dac >= dab && dac >= dbc) { tl = b; tr = a; bl = c; } else { tl = a; tr = b; bl = c; }
    cross = (tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x);
    if (cross < 0) { p1 = tr; tr = bl; bl = p1; }
    unit = (tl.unit + tr.unit + bl.unit) / 3;
    p1 = Math.atan2(tr.y - tl.y, tr.x - tl.x) % (Math.PI / 2); if (p1 < 0) p1 += Math.PI / 2; if (p1 > Math.PI / 4) p1 -= Math.PI / 2;
    unit *= Math.cos(p1);   // a run measured along the picture rows is longer when the code is turned
    dimF = (dist(tl, tr) + dist(tl, bl)) / 2 / unit + 7; v0 = Math.round((dimF - 17) / 4);
    vs = [v0, v0 - 1, v0 + 1];
    for (vi = 0; vi < vs.length; vi++) {
      v = vs[vi]; if (v < 1 || v > 10) continue;
      n = 17 + 4 * v; ex = { x: (tr.x - tl.x) / (n - 7), y: (tr.y - tl.y) / (n - 7) }; ey = { x: (bl.x - tl.x) / (n - 7), y: (bl.y - tl.y) / (n - 7) };
      pred = { x: tr.x + bl.x - tl.x, y: tr.y + bl.y - tl.y };   // where the bottom right finder would be if the picture were flat
      al = v >= 2 ? findAlign(bin, w, h, { x: tl.x + ex.x * (n - 10) + ey.x * (n - 10), y: tl.y + ex.y * (n - 10) + ey.y * (n - 10) }, ex, ey) : null;
      for (att = al ? 0 : 1; att < 2; att++) {   // first with the alignment pattern as the fourth point, then with the flat guess
        mp = [[3.5, 3.5], [n - 3.5, 3.5], [3.5, n - 3.5]]; ip = [[tl.x, tl.y], [tr.x, tr.y], [bl.x, bl.y]];
        if (att === 0) { mp.push([n - 6.5, n - 6.5]); ip.push([al.x, al.y]); } else { mp.push([n - 3.5, n - 3.5]); ip.push([pred.x, pred.y]); }
        T = homography(mp, ip); if (!T) continue;
        m = sample(bin, w, h, T, n); text = R.readMatrix(m);
        if (text != null) return text;
      }
    }
    return null;
  }
  R.scanGray = function (g, w, h) {
    var bin = binarize(g, w, h), cands = findFinders(bin, w, h), trip = [], i, j, k, a, b, c, d1, d2, d3, lg, t, text, ls;
    for (i = 0; i < cands.length; i++) for (j = i + 1; j < cands.length; j++) for (k = j + 1; k < cands.length; k++) {
      a = cands[i]; b = cands[j]; c = cands[k];
      if (Math.max(a.unit, b.unit, c.unit) > Math.min(a.unit, b.unit, c.unit) * 1.8) continue;
      d1 = dist(a, b); d2 = dist(a, c); d3 = dist(b, c); lg = Math.max(d1, d2, d3);
      // a right isosceles triangle: the two short sides alike, and the long side about 1.41 times as long
      ls = [d1, d2, d3].sort(function (p, q) { return p - q; });
      if (ls[0] < ls[2] * 0.5 || ls[2] / ls[1] > 1.7 || ls[1] / ls[0] > 1.35) continue;
      trip.push({ s: Math.abs(ls[1] / ls[0] - 1) + Math.abs(ls[2] / ls[1] - 1.414) - (a.n + b.n + c.n) * 0.002, t: [a, b, c] });
    }
    trip.sort(function (p, q) { return p.s - q.s; });
    for (i = 0; i < trip.length && i < 6; i++) { t = trip[i].t; text = tryTriple(bin, w, h, t[0], t[1], t[2]); if (text != null) return { text: text }; }
    return null;
  };
  R.scan = function (rgba, w, h) {
    var g = new Uint8Array(w * h), i, j;
    for (i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
    return R.scanGray(g, w, h);
  };

  root.StarkBeamQR = R; if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
