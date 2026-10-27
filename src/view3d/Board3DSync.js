/* Board3DSync.js — liga o palco 3D ao estado do motor (acrescenta métodos ao Board3D):
   peças em pedestais (azul = tuas, vermelho = adversário) com estados (anel dourado de equipamento, cúpula de
   escudo, cristal de gelo, pilar de xeque, metamorfose), cubos holográficos nas armadilhas, cartas nas Zonas,
   pilhas, marcações de lance com etiquetas ("D5"), seta para a casa debaixo do rato e animação parada. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const T3 = () => YC.T3;
  const PM = () => YC.PieceMeshes;
  const H = { p: 0.57, r: 0.84, n: 0.91, b: 0.96, q: 1.12, k: 1.25 };
  const LETTER = { n: 'C', b: 'B', r: 'T', q: 'D' };

  Object.assign(YC.Board3D.prototype, {
    setFlipped(f) {
      if (this.flipped === f) return;
      this.flipped = f;
      this.placeSquares();
      for (const g of this.pieceEls.values()) this.place(g, g.userData.sq);
    },

    el(id) { return this.pieceEls.get(id) || null; },
    place(g, sq) { const p = this.sqWorld(sq); g.position.set(p.x, 0, p.z); g.userData.sq = sq; },

    makePieceGroup(p) {
      const THREE = T();
      const g = new THREE.Group();
      const hold = new THREE.Group();
      hold.name = 'hold';
      g.add(hold);
      g.userData = { id: p.id, phase: Math.random() * 6.28, blinkAt: 1 + Math.random() * 3, states: [], pick: null };
      this.layers.pieces.add(g);
      this.pieceEls.set(p.id, g);
      return g;
    },

    setBody(g, p) {
      const hold = g.getObjectByName('hold');
      const old = hold.getObjectByName('body');
      if (old) hold.remove(old);
      const body = PM().make(p.type, p.color);
      hold.add(body);
      g.userData.type = p.type;
      g.userData.color = p.color;
      g.userData.eyes = body.getObjectByName('eyes');
      g.userData.flag = body.getObjectByName('flag');
    },

    setPedestal(g, mine) {
      if (g.userData.mine === mine && g.getObjectByName('pedestal')) return;
      const old = g.getObjectByName('pedestal');
      if (old) g.remove(old);
      g.userData.ped = PM().pedestal(mine ? T3().NEON.mine : T3().NEON.theirs);
      g.add(g.userData.ped);
      g.userData.mine = mine;
    },

    /** Liga/desliga um acessório criado por `make` (fica guardado no grupo pelo nome). */
    accessory(g, name, on, make) {
      let a = g.getObjectByName(name);
      if (on && !a) { a = make(); a.name = name; a.traverse((o) => { o.raycast = () => {}; }); g.add(a); }
      if (a) { a.visible = !!on; (g.userData.acc || (g.userData.acc = {}))[name] = a; }
      return a;
    },

    sync(m, { viewer } = {}) {
      const THREE = T();
      this.viewer = viewer;
      this.match = m;
      if (this.fx) this.fx._unit = this.unit();
      const turn = m.state.turnCount, seen = new Set();
      const checked = !m.state.winner && YC.Chess.inCheck(m.pos, m.state.active) ? YC.Chess.kingSquare(m.pos, m.state.active) : -1;
      m.pos.board.forEach((p, sq) => {
        if (!p) return;
        seen.add(p.id);
        let g = this.el(p.id);
        if (!g) g = this.makePieceGroup(p);
        g.userData.pick = { kind: 'piece', sq };
        if (this.busy.has(p.id)) return;
        if (g.userData.type !== p.type) this.setBody(g, p);
        if (g.userData.sq !== sq || !g.userData.placed) { this.place(g, sq); g.userData.placed = true; }
        this.setPedestal(g, p.color === viewer);
        const h = H[p.type] || 1, frozen = p.frozenUntil > turn;
        const states = [];
        if (p.equips.length) states.push('equipped');
        if (p.shield) states.push('shielded');
        if (frozen) states.push('frozen');
        if (sq === checked) states.push('checked');
        g.userData.states = states;
        const ring = this.accessory(g, 'equipRing', p.equips.length > 0, () => {
          const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 40), T3().basic(0xFFD700, 2.2));
          r.rotation.x = Math.PI / 2;
          return r;
        });
        if (ring) ring.position.y = h * 0.42;
        this.syncMedals(g, p, h);
        const dome = this.accessory(g, 'shield', p.shield, () => {
          const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshBasicMaterial({ color: T3().glow(0x00FFCC, 1.8), wireframe: true, transparent: true, opacity: 0.75 }));
          const fill = new THREE.Mesh(d.geometry, new THREE.MeshBasicMaterial({ color: 0x12B5CB, transparent: true, opacity: 0.12, depthWrite: false }));
          d.add(fill);
          return d;
        });
        if (dome) { dome.position.y = h * 0.5; dome.scale.set(1, Math.max(1, h * 1.1), 1); }
        const ice = this.accessory(g, 'ice', frozen, () => new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1),
          new THREE.MeshStandardMaterial({ color: 0x9FE6FF, emissive: 0x0077dd, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, depthWrite: false })));
        if (ice) { ice.position.y = h * 0.5; ice.scale.set(1, h * 1.2, 1); }
        const pillar = this.accessory(g, 'checkPillar', sq === checked, () => new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 24, 1, true),
          new THREE.MeshBasicMaterial({ color: T3().glow(0xFF0033, 1.6), transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })));
        if (pillar) pillar.position.y = 1.5;
        const badge = this.accessory(g, 'morph', !!p.morphUntil, () => new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false })));
        if (badge && p.morphUntil) { badge.material.map = T3().label(LETTER[p.morphFrom] || '?', '#81C995'); badge.material.needsUpdate = true; badge.scale.set(0.5, 0.25, 1); badge.position.set(-0.35, h + 0.2, 0); }
        const fz = this.accessory(g, 'freezeTag', frozen, () => new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false })));
        if (fz && frozen) { fz.material.map = T3().label(`❄${Math.ceil((p.frozenUntil - turn) / 2)}`, '#8FD3FF'); fz.material.needsUpdate = true; fz.scale.set(0.55, 0.28, 1); fz.position.set(0.35, h + 0.2, 0); }
        g.userData.h = h;
        g.userData.checked = sq === checked;
      });
      for (const [id, g] of this.pieceEls) {
        if (!seen.has(id) && !this.busy.has(id)) { this.layers.pieces.remove(g); this.pieceEls.delete(id); }
      }
      this.pickables = this.pickables.filter((o) => !o.userData.pick || o.userData.pick.kind !== 'piece');
      for (const g of this.pieceEls.values()) this.pickables.push(g);
      this.syncTraps(m, viewer);
      this.syncSides(m, viewer);
    },

    /** Ícones dos equipamentos a flutuar por cima da peça. */
    syncMedals(g, p, h) {
      const THREE = T(), key = p.equips.join(',');
      if (g.userData.medalKey === key) return;
      g.userData.medalKey = key;
      const old = g.getObjectByName('medals');
      if (old) g.remove(old);
      if (!p.equips.length) return;
      const grp = new THREE.Group();
      grp.name = 'medals';
      p.equips.forEach((id, i) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T3().iconTex(id), depthTest: false }));
        s.scale.set(0.34, 0.34, 1);
        s.position.set((i - (p.equips.length - 1) / 2) * 0.38, h + 0.28, 0);
        grp.add(s);
      });
      g.add(grp);
    },

    syncTraps(m, viewer) {
      const THREE = T(), layer = this.layers.traps;
      const key = m.traps.filter((t) => t.owner === viewer || t.revealed).map((t) => `${t.uid}${t.sq}${t.revealed ? 'r' : ''}`).join(',') + this.flipped;
      if (this.trapKey === key) return;
      this.trapKey = key;
      layer.clear();
      this.pickables = this.pickables.filter((o) => !o.userData.pick || o.userData.pick.kind !== 'trap');
      for (const t of m.traps) {
        const mine = t.owner === viewer;
        if (!mine && !t.revealed) continue;
        const c = YC.Cards.get(t.id), col = mine ? c.theme.primary : '#FF3355';
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshBasicMaterial({ color: T3().glow(new THREE.Color(col).getHex(), 1.1), transparent: true, opacity: 0.28, depthWrite: false }));
        cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: T3().glow(new THREE.Color(col).getHex(), 2.2) })));
        const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: T3().iconTex(t.id), depthTest: false, transparent: true, opacity: 0.95 }));
        icon.scale.set(0.34, 0.34, 1);
        const grp = new THREE.Group();
        grp.add(cube, icon);
        const p = this.sqWorld(t.sq);
        grp.position.set(p.x, 0.38, p.z);
        grp.userData = { spin: cube, trapSq: t.sq, pick: { kind: 'trap', sq: t.sq, id: t.id, mine } };
        icon.raycast = () => {};
        layer.add(grp);
        this.pickables.push(grp);
      }
    },

    syncSides(m, viewer) {
      const turn = m.state.turnCount;
      for (const team of ['w', 'b']) {
        const rel = team === viewer ? 'me' : 'opp', s = this.side[rel], p = m.players[team];
        s.slots.forEach((slot, i) => {
          const z = p.zone[i];
          slot.card.visible = !!z;
          slot.zz.visible = !!z && rel === 'me' && z.setTurn >= turn;
          slot.respond = !!z && this.respondUids.includes(z.inst.uid);
          slot.grp.userData.pick = { kind: 'zone', rel, i, team, card: z ? z.inst : null, setTurn: z ? z.setTurn : 0 };
        });
        const n = p.deck.length;
        s.box.scale.y = Math.max(0.04, n * 0.035);
        s.box.position.y = s.box.scale.y / 2;
        s.box.visible = n > 0;
        s.deckCount.material.map = T3().countLabel(n, '#9FDFFF'); s.deckCount.material.needsUpdate = true;
        s.deckCount.position.y = s.box.scale.y + 0.3;
        const top = p.gy[p.gy.length - 1];
        s.gyCard.visible = !!top;
        if (top && s.gyCard.userData.id !== top) { s.gyCard.material.map = T3().cardFace(top); s.gyCard.material.needsUpdate = true; s.gyCard.userData.id = top; }
        s.gyCount.material.map = T3().countLabel(p.gy.length, '#C58AF9'); s.gyCount.material.needsUpdate = true;
        s.deck.userData.pick = { kind: 'pile', pile: 'deck', rel, team };
        s.gy.userData.pick = { kind: 'pile', pile: 'gy', rel, team, top };
      }
    },

    // ───────────── marcações ─────────────
    markMat(kind) {
      const THREE = T();
      this.markMats = this.markMats || {};
      if (this.markMats[kind]) return this.markMats[kind];
      const conf = {
        last: [0xFCC934, 0.9, 0.32, 'sq'], sel: [0x00E5FF, 1.6, 0.45, 'sq'], move: [0x00E5FF, 1.8, 0.95, 'dot'],
        cap: [0xFF1E42, 2, 0.95, 'ring'], lance: [0xFA903E, 2, 0.95, 'ring'], equip: [0xFFD700, 1.6, 0.6, 'sq'],
        trap: [0xFF4F9A, 1.6, 0.5, 'sq'], pick: [0xFFD700, 1.6, 0.6, 'sq'], check: [0xFF0033, 1.6, 0.55, 'sq']
      }[kind];
      const tex = conf[3] === 'dot' ? T3().radial(0xffffff, 'dotTex') : conf[3] === 'ring' ? ringTex() : sqTex();
      this.markMats[kind] = new THREE.MeshBasicMaterial({ map: tex, color: T3().glow(conf[0], conf[1]), transparent: true, opacity: conf[2], depthWrite: false, blending: THREE.AdditiveBlending });
      return this.markMats[kind];
    },

    mark({ sel = -1, moves = [], last = null, equip = [], trap = [], pick = [] } = {}) {
      const THREE = T(), layer = this.layers.marks;
      layer.children.forEach((o) => { if (o.isSprite) o.material.dispose(); if (o === this.arrow) { o.geometry.dispose(); o.material.dispose(); } });
      layer.clear();
      this.targets = new Map();
      this.selSq = sel;
      const plane = (sq, kind, size = 0.96, y = 0.012) => {
        const m = new THREE.Mesh(this.markGeo || (this.markGeo = new THREE.PlaneGeometry(1, 1)), this.markMat(kind));
        const p = this.sqWorld(sq);
        m.rotation.x = -Math.PI / 2; m.position.set(p.x, y, p.z); m.scale.set(size, size, 1);
        m.raycast = () => {};
        layer.add(m);
        return m;
      };
      if (last) { plane(last.from, 'last'); plane(last.to, 'last'); }
      if (sel >= 0) plane(sel, 'sel');
      for (const mv of moves) {
        if (this.targets.has(mv.to)) continue;
        this.targets.set(mv.to, mv);
        plane(mv.to, mv.captured ? (mv.flag === 'r' ? 'lance' : 'cap') : 'move', mv.captured ? 0.92 : 0.6, 0.014);
        const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: T3().label(YC.Chess.sqName(mv.to).toUpperCase()), depthTest: false }));
        const p = this.sqWorld(mv.to);
        lab.scale.set(0.7, 0.35, 1); lab.position.set(p.x, 0.3, p.z + 0.12);
        layer.add(lab);
      }
      for (const sq of equip) plane(sq, 'equip');
      for (const sq of trap) plane(sq, 'trap', 0.82);
      for (const sq of pick) plane(sq, 'pick');
      for (const g of this.pieceEls.values()) g.userData.selected = g.userData.sq === sel;
      this.arrow = null;
      this.updateArrow();
    },

    /** Seta luminosa da peça escolhida até à casa de destino debaixo do rato. */
    updateArrow() {
      const THREE = T();
      if (this.arrow) { this.layers.marks.remove(this.arrow); this.arrow.geometry.dispose(); this.arrow.material.dispose(); this.arrow = null; }
      const h = this.hover, sq = h && (h.kind === 'square' || h.kind === 'piece' || h.kind === 'trap') ? h.sq : -1;
      if (this.selSq == null || this.selSq < 0 || !this.targets || !this.targets.has(sq)) return;
      const a = this.sqWorld(this.selSq), b = this.sqWorld(sq);
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      const shape = new THREE.Shape();
      const L = len - 0.35, w = 0.11;
      shape.moveTo(0, -w); shape.lineTo(L, -w); shape.lineTo(L, -0.24); shape.lineTo(len - 0.05, 0); shape.lineTo(L, 0.24); shape.lineTo(L, w); shape.lineTo(0, w); shape.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: T3().glow(0x00F0FF, 1.6), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(-dz, dx);
      m.position.set(a.x, 0.03, a.z);
      m.raycast = () => {};
      this.layers.marks.add(m);
      this.arrow = m;
    },

    // ───────────── animação contínua ─────────────
    animateIdle(t) {
      for (const g of this.pieceEls.values()) {
        const u = g.userData, hold = g.children[0];
        if (!hold || this.busy.has(u.id)) continue;
        const frozen = u.states && u.states.includes('frozen');
        hold.position.y = (u.selected ? 0.16 : 0) + (frozen ? 0 : Math.sin(t * 2.4 + u.phase) * 0.035);
        hold.position.x = u.checked ? Math.sin(t * 60) * 0.015 : 0;
        // olha à volta devagar; a bandeira da Torre ondula
        if (!frozen) hold.rotation.y = Math.sin(t * 0.6 + u.phase * 1.7) * 0.22;
        if (u.flag) u.flag.rotation.y = Math.sin(t * 3.2 + u.phase) * 0.4;
        if (u.eyes && !frozen) {
          const k = (t + u.phase) % 3.6;
          u.eyes.scale.y = k > 3.45 ? 0.12 : 1;
        }
        // referências guardadas (procurar pelo nome a cada quadro custava milhares de visitas à árvore)
        const acc = u.acc || {};
        const ring = acc.equipRing;
        if (ring && ring.visible) ring.rotation.z = t * 1.6;
        const dome = acc.shield;
        if (dome && dome.visible) dome.rotation.y = t * 0.5;
        const ped = u.ped;
        if (ped) ped.children[3].material.opacity = 0.1 + (u.selected ? 0.3 : 0) + Math.sin(t * 3 + u.phase) * 0.04;
        const pillar = acc.checkPillar;
        if (pillar && pillar.visible) pillar.material.opacity = 0.2 + 0.18 * (0.5 + 0.5 * Math.sin(t * 12));
      }
      for (const trap of this.layers.traps.children) { trap.userData.spin.rotation.y = t; trap.userData.spin.rotation.x = t * 0.6; trap.position.y = 0.38 + Math.sin(t * 2 + trap.userData.trapSq) * 0.05; }
      if (this.side) for (const rel of ['me', 'opp']) for (const slot of this.side[rel].slots) slot.mat.color.setScalar(slot.respond ? 1.4 + Math.sin(t * 8) * 0.6 : 1.25);
    }
  });

  function sqTex() {
    return T3().canvasTex('markSq', 128, 128, (g, w) => {
      const grd = g.createRadialGradient(w / 2, w / 2, w * 0.1, w / 2, w / 2, w * 0.72);
      grd.addColorStop(0, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = grd; g.fillRect(4, 4, w - 8, w - 8);
    });
  }
  function ringTex() {
    return T3().canvasTex('markRing', 128, 128, (g, w) => {
      g.strokeStyle = '#fff'; g.lineWidth = 12; g.shadowColor = '#fff'; g.shadowBlur = 10;
      g.beginPath(); g.arc(w / 2, w / 2, w * 0.38, 0, Math.PI * 2); g.stroke();
    });
  }
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
