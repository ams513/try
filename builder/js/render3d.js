/* Stark Builder, by Stark. A small WebGL 1 renderer written from scratch: flat-shaded triangles, one sun,
   fog, a translucent glass pass, an orbit camera and a first-person walkthrough with wall collision. No libraries. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const VS = 'attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;uniform mat4 uVP;varying vec3 vN;varying vec3 vC;varying vec3 vW;' +
    'void main(){vN=aN;vC=aC;vW=aP;gl_Position=uVP*vec4(aP,1.0);}';
  const FS = 'precision mediump float;varying vec3 vN;varying vec3 vC;varying vec3 vW;uniform vec3 uEye;uniform float uAlpha;uniform vec3 uSky;uniform float uFog;' +
    'void main(){vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 L=normalize(vec3(0.45,0.85,0.35));' +
    'float d=max(dot(n,L),0.0);float amb=0.50+0.18*n.y;vec3 col=vC*(amb+0.62*d);' +
    'float dist=length(vW-uEye);float f=clamp(1.0-exp(-dist*uFog),0.0,0.85);col=mix(col,uSky,f);gl_FragColor=vec4(col,uAlpha);}';

  /* column-major 4x4 helpers */
  const persp = (fovy, asp, n, f) => { const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const look = (e, t, up) => { const z = norm(sub(e, t)), x = norm(cross(up, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; };
  const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };

  function Viewer(canvas) {
    this.cv = canvas; this.mode = 'orbit'; this.scene = null; this.showRoof = true; this.keys = {}; this.dirty = true; this.raf = 0; this.last = 0;
    this.orbit = { yaw: 0.8, pitch: 0.55, dist: 14, target: [0, 1, 0] };
    this.walk = { x: 0, z: 0, yaw: 0, pitch: 0, eye: 1.6 };
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl');
    this.ok = !!gl; this.gl = gl;
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    this.pr = pr; gl.useProgram(pr);
    this.loc = { p: gl.getAttribLocation(pr, 'aP'), n: gl.getAttribLocation(pr, 'aN'), c: gl.getAttribLocation(pr, 'aC'), vp: gl.getUniformLocation(pr, 'uVP'),
      eye: gl.getUniformLocation(pr, 'uEye'), alpha: gl.getUniformLocation(pr, 'uAlpha'), sky: gl.getUniformLocation(pr, 'uSky'), fog: gl.getUniformLocation(pr, 'uFog') };
    this.buf = {};
    this.sky = [0.62, 0.78, 0.9];
    this.bind();
  }
  Viewer.prototype.upload = function (name, arr) {
    const gl = this.gl; if (!this.buf[name]) this.buf[name] = { b: gl.createBuffer(), n: 0 };
    const o = this.buf[name]; gl.bindBuffer(gl.ARRAY_BUFFER, o.b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); o.n = arr.length / 9;
  };
  /* scene = {base, roof, glass, center, radius, start, segs, flatRoof} from SB.mesh */
  Viewer.prototype.loadScene = function (sc) {
    this.scene = sc; this.upload('base', sc.base); this.upload('roof', sc.roof); this.upload('glass', sc.glass);
    const o = this.orbit; o.target = [sc.center[0], sc.center[1], sc.center[2]]; o.dist = Math.max(8, sc.radius * 1.7);
    if (sc.start) { this.walk.x = sc.start[0]; this.walk.z = sc.start[1]; }
    this.walk.eye = sc.eye || 1.6;
  };
  Viewer.prototype.setScene = function (sc, mode) {
    if (!this.ok) return;
    this.loadScene(sc);
    this.setMode(mode || this.mode);
  };
  Viewer.prototype.setMode = function (m) { this.mode = m; this.dirty = true; this.kick(); };
  Viewer.prototype.setRoof = function (v) { this.showRoof = v; this.dirty = true; this.kick(); };
  Viewer.prototype.kick = function () { if (!this.raf && this.ok) this.raf = requestAnimationFrame(t => this.frame(t)); };
  Viewer.prototype.resize = function () {
    const cv = this.cv, dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(2, Math.floor(cv.clientWidth * dpr)), h = Math.max(2, Math.floor(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; this.dirty = true; }
  };
  Viewer.prototype.eyePos = function () {
    if (this.mode === 'walk') { const w = this.walk; return [w.x, w.eye, w.z]; }
    const o = this.orbit, cp = Math.cos(o.pitch);
    return [o.target[0] + o.dist * cp * Math.sin(o.yaw), o.target[1] + o.dist * Math.sin(o.pitch), o.target[2] + o.dist * cp * Math.cos(o.yaw)];
  };
  Viewer.prototype.frame = function (t) {
    this.raf = 0; if (!this.ok || !this.scene) return;
    const dt = Math.min(0.1, (t - (this.last || t)) / 1000); this.last = t;
    let moving = false;
    if (this.mode === 'walk') moving = this.step(dt);
    if (this.dirty || moving) { this.draw(); this.dirty = false; }
    if (moving || Object.keys(this.keys).some(k => this.keys[k])) { this.raf = requestAnimationFrame(tt => this.frame(tt)); } else this.last = 0;
  };
  Viewer.prototype.step = function (dt) {
    const w = this.walk, k = this.keys; if (!dt) return false;
    const sp = (k.shift ? 4.0 : 1.8) * dt, fw = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), st = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    const tr = ((k.arrowright ? 1 : 0) - (k.arrowleft ? 1 : 0)) * 1.8 * dt;
    if (tr) { w.yaw += tr; this.dirty = true; }
    if (!fw && !st) return !!tr;
    const sy = Math.sin(w.yaw), cy = Math.cos(w.yaw);
    let nx = w.x + (-sy * fw + cy * st) * sp, nz = w.z + (-cy * fw - sy * st) * sp;
    const R = 0.22, segs = (this.scene.segs || []).concat(this.scene.blocks || []);
    for (let it = 0; it < 3; it++) segs.forEach(s => {
      const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz || 1;
      let u = ((nx - s.ax) * dx + (nz - s.az) * dz) / l2; u = Math.max(0, Math.min(1, u));
      const qx = s.ax + dx * u, qz = s.az + dz * u, ex = nx - qx, ez = nz - qz, d = Math.hypot(ex, ez), m = R + s.r;
      if (d < m) { const push = (m - d) / (d || 1); if (d < 1e-6) { nx += m; } else { nx += ex * push; nz += ez * push; } }
    });
    w.x = nx; w.z = nz; this.dirty = true; return true;
  };
  Viewer.prototype.draw = function () { this.resize(); this.aspect = this.cv.width / this.cv.height; this.paint(this.cv.width, this.cv.height, null); };
  /* Draws the scene into the current canvas at W x H pixels. o (picture export only; its glass pass keeps the alpha channel exact, so a solid picture has no see-through pixels): {bg: [r, g, b], transparent, fovy}. */
  Viewer.prototype.paint = function (W, H, o) {
    const gl = this.gl, L = this.loc, bg = o && !o.transparent ? o.bg : this.sky;
    gl.viewport(0, 0, W, H);
    gl.clearColor(o && o.transparent ? 0 : bg[0], o && o.transparent ? 0 : bg[1], o && o.transparent ? 0 : bg[2], o && o.transparent ? 0 : 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const eye = this.eyePos(); let view;
    if (this.mode === 'walk') { const w = this.walk; view = look(eye, [eye[0] - Math.sin(w.yaw) * Math.cos(w.pitch), eye[1] + Math.sin(w.pitch), eye[2] - Math.cos(w.yaw) * Math.cos(w.pitch)], [0, 1, 0]); }
    else view = look(eye, this.orbit.target, [0, 1, 0]);
    const vp = mul(persp(o && o.fovy ? o.fovy : this.mode === 'walk' ? 1.2 : 0.8, W / H, 0.05, 600), view);
    gl.uniformMatrix4fv(L.vp, false, new Float32Array(vp)); gl.uniform3fv(L.eye, new Float32Array(eye)); gl.uniform3fv(L.sky, new Float32Array(bg));
    gl.uniform1f(L.fog, this.mode === 'walk' ? 0.01 : 0.004);
    gl.uniform1f(L.alpha, 1);
    gl.disable(gl.BLEND); gl.depthMask(true);
    this.drawBuf('base'); if (this.showRoof) this.drawBuf('roof');
    gl.enable(gl.BLEND); if (o) gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false); gl.uniform1f(L.alpha, 0.38);
    this.drawBuf('glass'); gl.depthMask(true); gl.disable(gl.BLEND);
  };
/* full version only */
  Viewer.prototype.drawBuf = function (name) {
    const gl = this.gl, o = this.buf[name], L = this.loc; if (!o || !o.n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, o.b);
    gl.enableVertexAttribArray(L.p); gl.vertexAttribPointer(L.p, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(L.n); gl.vertexAttribPointer(L.n, 3, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(L.c); gl.vertexAttribPointer(L.c, 3, gl.FLOAT, false, 36, 24);
    gl.drawArrays(gl.TRIANGLES, 0, o.n);
  };
  Viewer.prototype.bind = function () {
    const cv = this.cv; let drag = null;
    const self = this;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } cv.focus(); });
    cv.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (self.mode === 'walk') { self.walk.yaw -= dx * 0.006; self.walk.pitch = Math.max(-1.2, Math.min(1.2, self.walk.pitch - dy * 0.005)); }
      else if (drag.pan) { const o = self.orbit, s = o.dist * 0.0015; o.target[0] -= (Math.cos(o.yaw) * dx - Math.sin(o.yaw) * dy) * s; o.target[2] += (Math.sin(o.yaw) * dx + Math.cos(o.yaw) * dy) * s; }
      else { self.orbit.yaw -= dx * 0.008; self.orbit.pitch = Math.max(0.05, Math.min(1.5, self.orbit.pitch + dy * 0.006)); }
      self.dirty = true; self.kick();
    });
    const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); if (self.mode === 'orbit') { self.orbit.dist = Math.max(2, Math.min(300, self.orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9))); self.dirty = true; self.kick(); } }, { passive: false });
    cv.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) { self.keys[k] = true; e.preventDefault(); self.kick(); } });
    cv.addEventListener('keyup', e => { self.keys[e.key.toLowerCase()] = false; });
    cv.addEventListener('blur', () => { self.keys = {}; });
  };
  /* Camera presets for tests and screenshots. */
  Viewer.prototype.setCamera = function (o) { if (o.orbit) Object.assign(this.orbit, o.orbit); if (o.walk) Object.assign(this.walk, o.walk); this.dirty = true; this.kick(); };
  SB.Viewer = Viewer;
})(typeof window !== 'undefined' ? window : globalThis);