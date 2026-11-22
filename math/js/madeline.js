/* Stark Math.
   Madeline: an original illustrated teacher drawn in SVG. Six expressions (neutral, smiling, thinking,
   encouraging, celebrating, gently concerned), idle blinking, a mouth that moves with read-aloud, and small gestures.
   She is a rule-based teaching guide written by people. She is not an AI and not a real person. */
(function () {
  'use strict';
  const SM = window.SM;
  const SKIN = '#9b6447', SKIN_D = '#7f4d34', SKIN_L = '#b57d5c', HAIR = '#2b1b17', HAIR_L = '#46302a', LIP = '#8a3f39', MOUTH = '#4a1c1a';
  const JACKET = '#4e2f63', JACKET_D = '#3d2350', JACKET_L = '#64437c', BLOUSE = '#f2e8da', BLOUSE_D = '#ddd0bd', FRAME = '#b9876a', ACC = '#a99cf0';

  const MOUTHS = {
    neutral: '<path d="M147 187 Q160 194 173 187" fill="none" stroke="' + LIP + '" stroke-width="3.2" stroke-linecap="round"/>',
    smiling: '<path d="M143 184 Q160 203 177 184 Q160 191 143 184 Z" fill="' + MOUTH + '"/><path d="M147 186 Q160 192 173 186 Q160 189.5 147 186 Z" fill="#fff"/><path d="M143 184 Q160 203 177 184" fill="none" stroke="' + LIP + '" stroke-width="2.4" stroke-linecap="round"/>',
    thinking: '<path d="M150 190 Q161 188 172 183" fill="none" stroke="' + LIP + '" stroke-width="3.2" stroke-linecap="round"/>',
    encouraging: '<path d="M145 185 Q160 198 175 185" fill="none" stroke="' + LIP + '" stroke-width="3.6" stroke-linecap="round"/><path d="M152 195 Q160 198 168 195" fill="none" stroke="' + SKIN_D + '" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>',
    celebrating: '<path d="M140 182 Q160 214 180 182 Q160 189 140 182 Z" fill="' + MOUTH + '"/><path d="M145 184 Q160 191 175 184 Q160 188 145 184 Z" fill="#fff"/><path d="M150 201 Q160 196 170 201 Q160 207 150 201 Z" fill="#c4615a"/><path d="M140 182 Q160 214 180 182" fill="none" stroke="' + LIP + '" stroke-width="2.4" stroke-linecap="round"/>',
    concerned: '<path d="M149 190 Q160 187.5 171 190" fill="none" stroke="' + LIP + '" stroke-width="3.2" stroke-linecap="round"/>',
  };
  const VISEMES = [
    '<ellipse cx="160" cy="189" rx="7" ry="3.2" fill="' + MOUTH + '"/><path d="M153 189 Q160 186 167 189" fill="none" stroke="' + LIP + '" stroke-width="2.2"/>',
    '<ellipse cx="160" cy="190" rx="8.5" ry="6" fill="' + MOUTH + '"/><path d="M152.5 188 Q160 185.5 167.5 188" fill="none" stroke="#fff" stroke-width="2"/><ellipse cx="160" cy="190" rx="8.5" ry="6" fill="none" stroke="' + LIP + '" stroke-width="2.2"/>',
    '<ellipse cx="160" cy="190" rx="5.5" ry="6.5" fill="' + MOUTH + '"/><ellipse cx="160" cy="190" rx="5.5" ry="6.5" fill="none" stroke="' + LIP + '" stroke-width="2.4"/>',
    '<ellipse cx="160" cy="190" rx="10" ry="4.5" fill="' + MOUTH + '"/><path d="M151 188.5 Q160 186.5 169 188.5" fill="none" stroke="#fff" stroke-width="2"/><ellipse cx="160" cy="190" rx="10" ry="4.5" fill="none" stroke="' + LIP + '" stroke-width="2.2"/>',
  ];
  const BROWS = {
    neutral: ['M124 123 Q137 116 151 121', 'M169 121 Q183 116 196 123'],
    smiling: ['M124 120 Q137 112 151 118', 'M169 118 Q183 112 196 120'],
    thinking: ['M124 125 Q137 121 151 123', 'M169 117 Q183 108 196 116'],
    encouraging: ['M124 121 Q137 115 151 117', 'M169 117 Q183 115 196 121'],
    celebrating: ['M123 116 Q137 106 151 113', 'M169 113 Q183 106 197 116'],
    concerned: ['M125 121 Q138 120 151 115', 'M169 115 Q182 120 195 121'],
  };
  const EYE = { neutral: [0, 0, 1], smiling: [0, 0.5, 0.82], thinking: [-3.2, -2.6, 1], encouraging: [0, 0, 0.95], celebrating: [0, 0, 0], concerned: [0, 0.6, 0.92] }; // [dx, dy, open]
  const GESTURE = { neutral: 'rest', smiling: 'rest', thinking: 'chin', encouraging: 'open', celebrating: 'cheer', concerned: 'heart' };

  const hand = (x, y, rot, flip) => '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + (flip ? -1.35 : 1.35) + ' 1.35)"><path d="M-11 6 C-13 -6 -9 -16 -3 -17 C-1 -24 6 -24 7 -17 C11 -16 13 -10 12 -4 C16 -5 18 0 14 4 C11 10 4 14 -2 14 C-7 14 -10 11 -11 6 Z" fill="' + SKIN + '"/><path d="M-3 -17 L-2 -4 M3 -19 L3 -5 M8 -15 L7 -4" stroke="' + SKIN_D + '" stroke-width="1.1" stroke-linecap="round" opacity=".7"/></g>';
  const point = (x, y, rot) => '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(1.3)"><path d="M-10 8 C-12 -2 -8 -8 -2 -9 L-2 -30 C-2 -35 5 -35 5 -30 L5 -10 C10 -10 14 -6 13 1 C13 9 7 14 -1 14 C-6 14 -9 12 -10 8 Z" fill="' + SKIN + '"/><path d="M-2 -9 L5 -10" stroke="' + SKIN_D + '" stroke-width="1.1" opacity=".7"/></g>';
  /** A sleeve from the shoulder (x1, y1) to the wrist (x2, y2), w wide, with a blouse cuff. */
  function sleeve(x1, y1, x2, y2, w) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, w1 = w / 2 + 4, w2 = w / 2;
    const P = (x, y) => x.toFixed(1) + ' ' + y.toFixed(1);
    const d = 'M' + P(x1 + nx * w1, y1 + ny * w1) + ' L' + P(x2 + nx * w2, y2 + ny * w2) + ' L' + P(x2 - nx * w2, y2 - ny * w2) + ' L' + P(x1 - nx * w1, y1 - ny * w1) + ' Z';
    const cx = x2 - dx / L * 4, cy = y2 - dy / L * 4;
    return '<path d="' + d + '" fill="' + JACKET + '" stroke="' + JACKET_D + '" stroke-width="1.5" stroke-linejoin="round"/>'
      + '<path d="M' + P(cx + nx * (w2 + 1), cy + ny * (w2 + 1)) + ' L' + P(cx - nx * (w2 + 1), cy - ny * (w2 + 1)) + '" stroke="' + BLOUSE + '" stroke-width="6" stroke-linecap="round"/>';
  }
  const ARMS = {
    rest: '',
    point: sleeve(252, 300, 282, 214, 30) + point(288, 196, 16),
    chin: sleeve(92, 330, 136, 238, 30) + hand(146, 222, 22),
    open: sleeve(250, 310, 284, 262, 30) + hand(298, 248, 14, true),
    cheer: sleeve(80, 292, 58, 204, 30) + hand(54, 184, -10) + sleeve(240, 292, 262, 204, 30) + hand(266, 184, 10, true),
    heart: sleeve(100, 350, 160, 310, 30) + hand(176, 300, -64, true),
  };

  function svgMarkup() {
    return '<svg class="madeline-svg" viewBox="0 0 320 360" role="img" aria-label="Madeline, the Stark Math teacher">'
      + '<defs><radialGradient id="md-face" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="' + SKIN_L + '"/><stop offset=".65" stop-color="' + SKIN + '"/><stop offset="1" stop-color="' + SKIN_D + '"/></radialGradient>'
      + '<linearGradient id="md-jacket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + JACKET_L + '"/><stop offset="1" stop-color="' + JACKET_D + '"/></linearGradient></defs>'
      + '<g class="md-body">'
      // shoulders and jacket
      + '<path d="M28 360 C30 300 62 262 124 246 L160 262 L196 246 C258 262 290 300 292 360 Z" fill="url(#md-jacket)"/>'
      + '<path d="M138 206 L182 206 L184 246 C176 256 144 256 136 246 Z" fill="' + SKIN_D + '"/><path d="M138 206 L182 206 L182 222 C170 230 150 230 138 222 Z" fill="#6a3f2b" opacity=".5"/>'
      + '<path d="M132 244 L160 300 L188 244 C178 252 142 252 132 244 Z" fill="' + BLOUSE + '"/>'
      + '<path d="M132 244 L146 270 L160 262 L174 270 L188 244 L196 248 L178 286 L160 266 L142 286 L124 248 Z" fill="' + BLOUSE_D + '"/>'
      + '<path d="M124 248 L142 286 L160 360 L112 360 L98 300 Z" fill="' + JACKET_L + '" opacity=".55"/><path d="M196 248 L178 286 L160 360 L208 360 L222 300 Z" fill="' + JACKET_L + '" opacity=".55"/>'
      + '<path d="M146 258 Q160 272 174 258" fill="none" stroke="' + FRAME + '" stroke-width="1.4"/><path d="M160 268 l-5 9 h10 z" fill="' + ACC + '"/>'
      + '<rect x="214" y="298" width="22" height="5" rx="2" fill="' + ACC + '" transform="rotate(-8 225 300)" opacity=".9"/>'
      + '</g>'
      + '<g class="md-arms"></g>'
      + '<g class="md-head">'
      // hair behind, bun and pencil
      + '<g fill="' + HAIR + '"><ellipse cx="160" cy="132" rx="80" ry="78"/><circle cx="160" cy="54" r="32"/>'
      + [[136, 36], [150, 26], [168, 25], [184, 34], [190, 52], [130, 54], [140, 72], [182, 72]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="11"/>').join('')
      + [[86, 110], [82, 134], [88, 158], [234, 110], [238, 134], [232, 158], [96, 88], [224, 88], [112, 70], [208, 70], [98, 180], [222, 180]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="14"/>').join('') + '</g>'
      + '<g fill="none" stroke="' + HAIR_L + '" stroke-width="2.2" stroke-linecap="round" opacity=".8"><path d="M146 40 q8 -8 16 0"/><path d="M164 58 q8 -8 16 0"/><path d="M92 128 q-6 8 0 16"/><path d="M228 128 q6 8 0 16"/><path d="M104 96 q-4 8 2 14"/><path d="M216 96 q4 8 -2 14"/></g>'
      + '<g transform="rotate(-24 160 50)"><rect x="112" y="46" width="96" height="8" rx="2" fill="#e2ad4c"/><path d="M208 46 L222 50 L208 54 Z" fill="#f1d9b0"/><path d="M218 48.8 L222 50 L218 51.2 Z" fill="#3b2a24"/><rect x="104" y="46" width="10" height="8" rx="2" fill="#d98b8b"/><rect x="112" y="46" width="5" height="8" fill="#b8b2a8"/></g>'
      // ears + earrings
      + '<ellipse cx="103" cy="150" rx="9" ry="14" fill="' + SKIN_D + '"/><ellipse cx="217" cy="150" rx="9" ry="14" fill="' + SKIN_D + '"/>'
      + '<circle cx="102" cy="166" r="3.6" fill="' + ACC + '"/><circle cx="218" cy="166" r="3.6" fill="' + ACC + '"/>'
      // face
      + '<path d="M106 140 C106 96 130 80 160 80 C190 80 214 96 214 140 C214 182 191 214 160 216 C129 214 106 182 106 140 Z" fill="url(#md-face)"/>'
      // front hair (side-swept)
      + '<path d="M104 142 C98 92 124 64 162 64 C202 64 226 94 216 146 C212 124 204 106 190 98 C172 110 140 106 124 96 C112 106 106 122 104 142 Z" fill="' + HAIR + '"/>'
      + '<path d="M124 96 C140 106 170 108 190 98 C178 90 150 88 124 96 Z" fill="' + HAIR_L + '" opacity=".55"/>'
      + '<g class="md-cheeks" opacity="0"><ellipse cx="128" cy="168" rx="11" ry="6.5" fill="#d47e6a" opacity=".45"/><ellipse cx="192" cy="168" rx="11" ry="6.5" fill="#d47e6a" opacity=".45"/></g>'
      // brows
      + '<path class="md-brow-l" d="' + BROWS.neutral[0] + '" fill="none" stroke="' + HAIR + '" stroke-width="4.2" stroke-linecap="round"/>'
      + '<path class="md-brow-r" d="' + BROWS.neutral[1] + '" fill="none" stroke="' + HAIR + '" stroke-width="4.2" stroke-linecap="round"/>'
      // eyes
      + ['l', 'r'].map((s, i) => { const cx = i ? 182 : 138; return '<g class="md-eye md-eye-' + s + '"><ellipse cx="' + cx + '" cy="141" rx="9.5" ry="6.6" fill="#fbf6ef"/><g class="md-iris"><circle cx="' + cx + '" cy="141" r="5.2" fill="#3c2419"/><circle cx="' + cx + '" cy="141" r="2.5" fill="#120907"/><circle cx="' + (cx + 1.8) + '" cy="139.2" r="1.4" fill="#fff"/></g><path d="M' + (cx - 10) + ' 140 Q' + cx + ' 131 ' + (cx + 10) + ' 140" fill="none" stroke="' + HAIR + '" stroke-width="2.4" stroke-linecap="round"/></g>'
        + '<path class="md-happy md-happy-' + s + '" d="M' + (cx - 9) + ' 143 Q' + cx + ' 134 ' + (cx + 9) + ' 143" fill="none" stroke="' + HAIR + '" stroke-width="3" stroke-linecap="round" opacity="0"/>'; }).join('')
      // glasses
      + '<g fill="none" stroke="' + FRAME + '" stroke-width="2.6"><rect x="120" y="126" width="36" height="29" rx="12"/><rect x="164" y="126" width="36" height="29" rx="12"/><path d="M156 137 Q160 133 164 137"/><path d="M120 134 L106 138 M200 134 L214 138"/></g>'
      + '<path d="M125 129 l8 -1" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/><path d="M169 129 l8 -1" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/>'
      // nose, smile lines
      + '<path d="M161 146 Q157 163 153 168 Q160 173 168 169" fill="none" stroke="' + SKIN_D + '" stroke-width="2.2" stroke-linecap="round"/>'
      + '<path d="M139 180 q-2.5 5 0 9 M181 180 q2.5 5 0 9" fill="none" stroke="' + SKIN_D + '" stroke-width="1.3" opacity=".3" stroke-linecap="round"/>'
      + '<g class="md-mouth">' + MOUTHS.neutral + '</g>'
      + '</g></svg>';
  }

  /** Mount Madeline in a container. Returns a controller. */
  function mount(container) {
    container.innerHTML = svgMarkup();
    const root = container.querySelector('svg'), q = s => root.querySelector(s);
    let expr = 'neutral', gest = 'rest', blinkT = 0, talkT = 0, talking = false, viseme = 0, alive = true;
    function setExpr(e, g) {
      expr = BROWS[e] ? e : 'neutral';
      q('.md-brow-l').setAttribute('d', BROWS[expr][0]); q('.md-brow-r').setAttribute('d', BROWS[expr][1]);
      const [dx, dy, open] = EYE[expr];
      root.querySelectorAll('.md-iris').forEach(i => i.setAttribute('transform', 'translate(' + dx + ' ' + dy + ')'));
      root.querySelectorAll('.md-eye').forEach(i => { i.style.opacity = open ? '1' : '0'; i.setAttribute('data-open', open); i.style.transform = 'scaleY(' + (open || 1) + ')'; });
      root.querySelectorAll('.md-happy').forEach(i => { i.style.opacity = open ? '0' : '1'; });
      q('.md-cheeks').style.opacity = expr === 'smiling' || expr === 'celebrating' ? '1' : '0';
      q('.md-head').style.transform = expr === 'concerned' ? 'rotate(-4deg)' : expr === 'thinking' ? 'rotate(3deg)' : 'rotate(0deg)';
      if (!talking) q('.md-mouth').innerHTML = MOUTHS[expr];
      gesture(g || GESTURE[expr]);
      container.setAttribute('data-expr', expr);
    }
    function gesture(g) {
      gest = ARMS[g] !== undefined ? g : 'rest';
      const arms = q('.md-arms');
      arms.innerHTML = ARMS[gest];
      arms.classList.remove('md-pop'); void arms.getBBox; if (!SM.reduceMotion()) { arms.classList.add('md-pop'); }
      container.setAttribute('data-gesture', gest);
    }
    function blink() {
      if (!alive) return;
      if (EYE[expr][2] && !document.hidden) {
        root.querySelectorAll('.md-eye').forEach(i => { i.style.transform = 'scaleY(0.08)'; });
        setTimeout(() => root.querySelectorAll('.md-eye').forEach(i => { i.style.transform = 'scaleY(' + (EYE[expr][2] || 1) + ')'; }), 130);
      }
      blinkT = setTimeout(blink, 2600 + Math.random() * 3800);
    }
    blinkT = setTimeout(blink, 1800);
    function mouthTick() { if (!talking) return; viseme = (viseme + 1 + Math.floor(Math.random() * 2)) % VISEMES.length; q('.md-mouth').innerHTML = VISEMES[viseme]; talkT = setTimeout(mouthTick, 95 + Math.random() * 70); }
    function stopTalk() { talking = false; clearTimeout(talkT); q('.md-mouth').innerHTML = MOUTHS[expr]; container.classList.remove('talking'); }
    /** Speak with the mouth synced to word boundaries (timer fallback between boundaries). */
    function say(text, e, g) {
      if (e) setExpr(e, g);
      stopTalk();
      const spoke = SM.speak(text, {
        onstart: () => { talking = true; container.classList.add('talking'); mouthTick(); },
        onword: () => { if (talking) { q('.md-mouth').innerHTML = VISEMES[1 + Math.floor(Math.random() * 3)]; } },
        onend: stopTalk,
      });
      return spoke;
    }
    setExpr('neutral');
    return { root, set: setExpr, gesture, say, stop: () => { SM.stopSpeech(); stopTalk(); }, destroy: () => { alive = false; clearTimeout(blinkT); stopTalk(); }, get expr() { return expr; } };
  }
  SM.Madeline = { mount, svgMarkup, EXPRESSIONS: Object.keys(MOUTHS), GESTURES: Object.keys(ARMS) };
})();
