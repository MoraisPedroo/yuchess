/* PieceFactory.js — gerador procedural das 6 peças em SVG (estilo Rubber Hose dos anos 1930):
   corpo com contorno grosso, olhos "pie-cut", braços em curvas de Bézier sem cotovelos e luvas
   brancas com 3 vincos. O animador mexe os braços e o corpo "on twos" (12 fps). */
(function (YC) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#141210';
  const SW = 4.5;
  const TEAM_COLORS = {
    WHITE: { F: '#FFF8E7', A: '#E5A93C', D: '#141210', cheek: '#F2A08B' },
    BLACK: { F: '#2B262D', A: '#C83E3B', D: '#F4E7C5', cheek: null }
  };

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const stroke = (w = SW) => ({ stroke: INK, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });

  /** Olho pie-cut: esclera oval + pupila elíptica com uma cunha aberta virada para a luz. */
  function eye(parent, x, y, s, lashes) {
    const g = el('g', { transform: `translate(${x} ${y}) scale(${s})` }, parent);
    const blink = el('g', { class: 'pc-eye' }, g);
    el('ellipse', { cx: 0, cy: 0, rx: 8, ry: 11, fill: '#FFFDF7', ...stroke(3) }, blink);
    // cunha entre −50° e 5°: arco grande no sentido horário de P(5°) até P(−50°)
    el('path', { d: 'M1,1.5 L6.48,2.15 A5.5,7.5 0 1,1 4.54,-4.24 Z', fill: INK }, blink);
    if (lashes) el('path', { d: 'M-6,-10 L-9,-15 M0,-11.5 L0,-17 M6,-10 L9,-15', fill: 'none', ...stroke(2.4) }, blink);
    return blink;
  }

  function face(parent, cx, cy, s, kind, C) {
    const eyes = [eye(parent, cx - 9.5 * s, cy, s, kind === 'queen'), eye(parent, cx + 9.5 * s, cy, s, kind === 'queen')];
    const m = el('g', { transform: `translate(${cx} ${cy + 15 * s}) scale(${s})` }, parent);
    if (kind === 'queen') {
      el('path', { d: 'M-6,0 Q-3,-3 0,-1 Q3,-3 6,0 Q0,6 -6,0 Z', fill: '#C83E3B', ...stroke(2) }, m);
    } else if (kind === 'grin') {
      el('path', { d: 'M-12,-2 Q0,12 12,-2 Z', fill: INK, ...stroke(2.4) }, m);
      el('path', { d: 'M-9,-1 L9,-1 L8,2.5 L-8,2.5 Z', fill: '#FFFDF7' }, m);
    } else {
      el('path', { d: 'M-9,0 Q0,13 9,0 Q0,4 -9,0 Z', fill: INK, ...stroke(2.4) }, m);
      el('ellipse', { cx: 0, cy: 5.5, rx: 3.6, ry: 1.8, fill: '#C83E3B' }, m);
    }
    if (C.cheek) {
      el('ellipse', { cx: cx - 17 * s, cy: cy + 11 * s, rx: 4 * s, ry: 2.6 * s, fill: C.cheek, opacity: 0.75 }, parent);
      el('ellipse', { cx: cx + 17 * s, cy: cy + 11 * s, rx: 4 * s, ry: 2.6 * s, fill: C.cheek, opacity: 0.75 }, parent);
    }
    return eyes;
  }

  /** Luva cartunesca desenhada a apontar para +x (é rodada pela tangente da curva do braço). */
  function glove(parent) {
    const g = el('g', { class: 'pc-glove' }, parent);
    el('rect', { x: -11, y: -6.5, width: 7, height: 13, rx: 2.5, fill: '#FAF6EE', ...stroke(2.6) }, g);
    el('ellipse', { cx: 3, cy: -8, rx: 4, ry: 3, fill: '#FAF6EE', ...stroke(2.2) }, g);
    el('ellipse', { cx: 4, cy: 0, rx: 8.5, ry: 7.5, fill: '#FAF6EE', ...stroke(2.6) }, g);
    el('path', { d: 'M1,-2 L1,4 M4,-3 L4,5 M7,-2 L7,4', fill: 'none', stroke: INK, 'stroke-width': 1.7, 'stroke-linecap': 'round' }, g);
    return g;
  }

  // ── Corpos (cada função devolve a configuração dos ombros/mãos e desenha a silhueta) ──
  const BODIES = {
    PAWN(g, C) { // Peão Mug: caneca com palhinha
      el('path', { d: 'M36,130 C36,118 44,110 50,104 L70,104 C76,110 84,118 84,130 Z', fill: C.F, ...stroke() }, g);
      el('ellipse', { cx: 60, cy: 104, rx: 17, ry: 5, fill: C.A, ...stroke(3.5) }, g);
      el('path', { d: 'M82,58 C99,56 101,84 82,86', fill: 'none', ...stroke(9) }, g);
      el('path', { d: 'M82,58 C99,56 101,84 82,86', fill: 'none', stroke: C.F, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M66,48 L74,20 L86,16', fill: 'none', ...stroke(8) }, g);
      el('path', { d: 'M66,48 L74,20 L86,16', fill: 'none', stroke: '#FFFDF7', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M66,48 L74,20 L86,16', fill: 'none', stroke: '#C83E3B', 'stroke-width': 4, 'stroke-dasharray': '4 4' }, g);
      el('rect', { x: 36, y: 46, width: 48, height: 52, rx: 12, fill: C.F, ...stroke() }, g);
      el('ellipse', { cx: 60, cy: 47, rx: 22, ry: 6, fill: C.A, ...stroke(3.5) }, g);
      return { face: [60, 68, 0.95, 'smile'], sh: [[40, 106], [80, 106]], rest: [[24, 118], [96, 118]], ctl: [[28, 100], [92, 100]] };
    },
    KNIGHT(g, C) { // Cavalo Swing
      el('path', { d: 'M76,36 L92,42 L80,50 L94,58 L82,64 L94,74 L80,80 L90,92 L76,92 Z', fill: C.A, ...stroke(3.5) }, g);
      el('path', { d: 'M84,130 C86,108 82,92 74,80 C82,70 84,52 76,38 L82,20 L68,30 C56,26 44,32 38,44 C32,52 24,58 21,67 C19,76 26,83 34,81 C40,79 46,79 50,83 C44,96 38,112 36,130 Z', fill: C.F, ...stroke() }, g);
      el('path', { d: 'M50,30 C46,24 52,18 58,22', fill: 'none', ...stroke(3.5) }, g);
      el('ellipse', { cx: 28, cy: 70, rx: 2.6, ry: 1.8, fill: INK }, g);
      el('path', { d: 'M24,77 Q32,81 41,76', fill: 'none', ...stroke(2.6) }, g);
      el('path', { d: 'M46,106 Q60,100 76,106', fill: 'none', stroke: C.A, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
      return { face: [56, 50, 0.72, 'none'], sh: [[44, 108], [80, 108]], rest: [[26, 120], [98, 120]], ctl: [[30, 102], [94, 102]] };
    },
    BISHOP(g, C) { // Bispo Jazz
      el('path', { d: 'M40,80 C36,96 32,116 30,130 L90,130 C88,116 84,96 80,80 Z', fill: C.F, ...stroke() }, g);
      el('path', { d: 'M60,92 L60,118 M51,101 L69,101', fill: 'none', stroke: C.A, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M60,20 C42,32 36,54 41,76 L79,76 C84,54 78,32 60,20 Z', fill: C.F, ...stroke() }, g);
      el('path', { d: 'M70,30 L60,44', fill: 'none', ...stroke(4.5) }, g);
      el('circle', { cx: 60, cy: 15, r: 6.5, fill: C.A, ...stroke(3.5) }, g);
      el('rect', { x: 39, y: 72, width: 42, height: 9, rx: 3, fill: C.A, ...stroke(3.5) }, g);
      return { face: [60, 56, 0.72, 'smile'], sh: [[42, 90], [78, 90]], rest: [[24, 112], [96, 112]], ctl: [[28, 94], [92, 94]] };
    },
    ROOK(g, C) { // Torre BigBen
      el('path', { d: 'M30,20 H44 V31 H52 V20 H68 V31 H76 V20 H90 V48 L84,53 V118 L91,130 H29 L36,118 V53 L30,48 Z', fill: C.F, ...stroke() }, g);
      el('rect', { x: 36, y: 46, width: 48, height: 7, fill: C.A, ...stroke(3) }, g);
      el('path', { d: 'M42,100 h10 M64,106 h12 M46,114 h9 M70,94 h8', fill: 'none', stroke: C.D, 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.55 }, g);
      el('circle', { cx: 60, cy: 37, r: 5, fill: '#FFFDF7', ...stroke(2.4) }, g);
      el('path', { d: 'M60,37 L60,34 M60,37 L62.5,38', fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      return { face: [60, 72, 0.9, 'smile'], sh: [[37, 92], [83, 92]], rest: [[20, 112], [100, 112]], ctl: [[24, 92], [96, 92]] };
    },
    QUEEN(g, C) { // Dama Cala
      el('path', { d: 'M44,84 C40,100 30,118 26,130 L94,130 C90,118 80,100 76,84 Z', fill: C.F, ...stroke() }, g);
      el('path', { d: 'M60,92 L60,126', fill: 'none', stroke: C.A, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, g);
      el('circle', { cx: 60, cy: 58, r: 23, fill: C.F, ...stroke() }, g);
      el('path', { d: 'M38,84 Q44,76 50,84 Q55,76 60,84 Q65,76 70,84 Q76,76 82,84 Q60,92 38,84 Z', fill: C.A, ...stroke(3) }, g);
      el('path', { d: 'M39,42 L34,18 L47,30 L52,11 L60,27 L68,11 L73,30 L86,18 L81,42 Z', fill: C.A, ...stroke(4) }, g);
      for (const [x, y] of [[34, 18], [52, 11], [68, 11], [86, 18]]) el('circle', { cx: x, cy: y, r: 3.6, fill: '#FFFDF7', ...stroke(2.4) }, g);
      return { face: [60, 58, 0.8, 'queen'], sh: [[44, 94], [76, 94]], rest: [[24, 114], [96, 114]], ctl: [[30, 96], [90, 96]] };
    },
    KING(g, C) { // Rei Dice: cabeça de dado coroada
      el('path', { d: 'M40,82 C34,98 30,116 30,130 L90,130 C90,116 86,98 80,82 Z', fill: C.F, ...stroke() }, g);
      el('circle', { cx: 60, cy: 106, r: 3, fill: C.A, ...stroke(1.8) }, g);
      el('circle', { cx: 60, cy: 118, r: 3, fill: C.A, ...stroke(1.8) }, g);
      el('path', { d: 'M40,30 L37,11 L50,21 L60,5 L70,21 L83,11 L80,30 Z', fill: C.A, ...stroke(4) }, g);
      el('path', { d: 'M60,-2 V8 M55,2 H65', fill: 'none', ...stroke(3.4) }, g);
      el('rect', { x: 33, y: 28, width: 54, height: 52, rx: 11, fill: C.F, ...stroke() }, g);
      for (const [x, y] of [[41, 36], [79, 36], [41, 72], [79, 72]]) el('circle', { cx: x, cy: y, r: 3, fill: C.D }, g);
      el('path', { d: 'M47,82 L60,89 L73,82 L73,96 L60,89 L47,96 Z', fill: C.A, ...stroke(3) }, g);
      return { face: [60, 50, 0.85, 'grin'], sh: [[41, 94], [79, 94]], rest: [[22, 114], [98, 114]], ctl: [[28, 94], [92, 94]] };
    }
  };

  /** Cria o SVG de uma peça e devolve o "rig" usado pelo animador. */
  function createPieceSVG(type, team) {
    const C = TEAM_COLORS[team];
    const svg = el('svg', { viewBox: '0 -4 120 164', class: `piece-svg team-${team.toLowerCase()} type-${type.toLowerCase()}` });
    const root = el('g', { class: 'pc-root', filter: 'url(#cuphead-boiling-line)' }, svg);
    el('ellipse', { cx: 60, cy: 154, rx: 30, ry: 5.5, fill: 'rgba(20,18,16,0.35)' }, root);
    // pernas rubber hose + sapatos
    el('path', { d: 'M51,126 Q46,140 43,149', fill: 'none', ...stroke(6.5) }, root);
    el('path', { d: 'M69,126 Q74,140 77,149', fill: 'none', ...stroke(6.5) }, root);
    for (const x of [38, 82]) {
      el('ellipse', { cx: x, cy: 151, rx: 10, ry: 5.8, fill: INK }, root);
      el('ellipse', { cx: x - 3, cy: 149, rx: 3, ry: 1.4, fill: '#FFFDF7', opacity: 0.8 }, root);
    }
    const body = el('g', { class: 'pc-body' }, root);
    const mirror = type === 'KNIGHT' && team === 'BLACK';
    const inner = el('g', mirror ? { transform: 'translate(120 0) scale(-1 1)' } : {}, body);
    const cfg = BODIES[type](inner, C);
    const eyes = cfg.face[3] === 'none'
      ? [eye(inner, cfg.face[0] - 7, cfg.face[1], cfg.face[2], false), eye(inner, cfg.face[0] + 9, cfg.face[1] - 1, cfg.face[2], false)]
      : face(inner, cfg.face[0], cfg.face[1], cfg.face[2], cfg.face[3], C);
    const arms = [0, 1].map((i) => {
      const path = el('path', { fill: 'none', ...stroke(6) }, body);
      const gl = glove(body);
      return { path, glove: gl, sh: cfg.sh[i], rest: cfg.rest[i], ctl: cfg.ctl[i], side: i === 0 ? -1 : 1 };
    });
    const rig = { svg, body, eyes, arms, phase: Math.random() * Math.PI * 2, blinkAt: 1 + Math.random() * 4, excited: 0 };
    poseRig(rig, 0);
    return rig;
  }

  const OMEGA = 6.5; // rad/s ≈ meio compasso de swing a 124 BPM

  /** Atualiza braços (Bézier quadrática com ponto de controlo oscilante) e o squash & stretch do corpo. */
  function poseRig(rig, t) {
    const ph = rig.phase, ex = 1 + rig.excited;
    for (const a of rig.arms) {
      const p = ph + (a.side > 0 ? Math.PI : 0);
      const cx = a.ctl[0] + 6 * ex * Math.sin(OMEGA * t + p);
      const cy = a.ctl[1] + 5 * ex * Math.cos(2 * OMEGA * t + p);
      const hx = a.rest[0] + 3 * ex * Math.sin(OMEGA * t + p + 1.1);
      const hy = a.rest[1] + 4 * ex * Math.cos(OMEGA * t + p) - (rig.excited ? 22 : 0);
      a.path.setAttribute('d', `M${a.sh[0]},${a.sh[1]} Q${cx.toFixed(1)},${cy.toFixed(1)} ${hx.toFixed(1)},${hy.toFixed(1)}`);
      const ang = Math.atan2(hy - cy, hx - cx) * 180 / Math.PI;
      a.glove.setAttribute('transform', `translate(${hx.toFixed(1)} ${hy.toFixed(1)}) rotate(${ang.toFixed(1)})`);
    }
    const beat = Math.abs(Math.sin(OMEGA * t + ph));
    const sx = 1 + 0.045 * beat * ex, sy = 1 / sx; // conservação de área: Sx·Sy = 1
    rig.body.setAttribute('transform', `translate(60 130) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-60 -130)`);
    rig.blinkAt -= 1 / 12;
    const closed = rig.blinkAt < 0;
    if (rig.blinkAt < -0.17) rig.blinkAt = 2 + Math.random() * 4;
    for (const e of rig.eyes) e.setAttribute('transform', closed ? 'scale(1 0.12)' : '');
  }

  /** Animador "on twos": todas as peças posam a 12 fps, em sincronia com a linha fervente. */
  class IdleAnimator {
    constructor() { this.rigs = new Set(); this.t0 = performance.now(); this.enabled = true; }
    add(rig) { this.rigs.add(rig); }
    remove(rig) { this.rigs.delete(rig); }
    tick() {
      if (!this.enabled) return;
      const t = (performance.now() - this.t0) / 1000;
      for (const r of this.rigs) if (r.svg.isConnected) poseRig(r, t);
    }
  }

  YC.PieceFactory = { createPieceSVG, poseRig, IdleAnimator, TEAM_COLORS };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
