/* CupheadSVGRenderer.js — tabuleiro 8×8 de pergaminho com hachuras, peças SVG "rubber hose"
   e todas as animações (salto parabólico com squash & stretch, investida, recuo elástico,
   explosões). Ouve o EventBus; o motor nunca toca no DOM. */
(function (YC) {
  'use strict';

  const BADGE = { KILL: 'KO!', BOUNCE: 'RECUO', LETHAL_COUNTER: 'CONTRA LETAL' };

  class CupheadSVGRenderer {
    constructor({ bus, vfx, audio, animator }) {
      this.bus = bus; this.vfx = vfx; this.audio = audio; this.animator = animator;
      this.sq = 64;
      this.speed = 1;
      this.flip = false; // true quando quem vê joga com as Pretas (online)
      this.slots = new Map();
      this.onCell = null;
      this.onHover = null;
      this.game = null;
    }

    // ── Construção do palco ──
    mount(boardEl) {
      this.boardEl = boardEl;
      boardEl.innerHTML = '';
      const tiles = document.createElement('div');
      tiles.className = 'board-tiles';
      const svgTiles = [];
      let rects = '';
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        rects += `<rect x="${c * 100}" y="${r * 100}" width="100" height="100" fill="url(#${(r + c) % 2 ? 'hatch-dark' : 'grain-light'})"/>`;
      }
      let lines = '';
      for (let i = 1; i < 8; i++) lines += `<path d="M${i * 100},0 V800 M0,${i * 100} H800" stroke="#141210" stroke-width="2.5" opacity="0.55"/>`;
      for (let i = 0; i < 3; i++) {
        tiles.insertAdjacentHTML('beforeend', `<svg class="tiles-layer${i === 0 ? ' on' : ''}" viewBox="-8 -8 816 816" preserveAspectRatio="none">
          <g filter="url(#boil-b${i})">${rects}${lines}<rect x="0" y="0" width="800" height="800" fill="none" stroke="#141210" stroke-width="9" rx="4"/></g></svg>`);
      }
      boardEl.appendChild(tiles);
      this.vfx.registerBoardLayers([...tiles.querySelectorAll('.tiles-layer')]);

      const layer = (cls) => { const d = document.createElement('div'); d.className = cls; boardEl.appendChild(d); return d; };
      this.hlLayer = layer('hl-layer');
      this.trapLayer = layer('trap-layer');
      this.pieceLayer = layer('piece-layer');
      this.hitLayer = layer('hit-layer');
      this.hlCells = []; this.hitCells = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const h = document.createElement('div'); h.className = 'cell'; this.hlLayer.appendChild(h); this.hlCells.push(h);
        const t = document.createElement('div'); t.className = 'cell'; t.dataset.r = r; t.dataset.c = c;
        this.hitLayer.appendChild(t); this.hitCells.push(t);
      }
      this.hitLayer.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (cell && this.onCell) this.onCell(this.lr(Number(cell.dataset.r)), this.lr(Number(cell.dataset.c)));
      });
      this.hitLayer.addEventListener('mouseover', (e) => {
        const cell = e.target.closest('.cell');
        if (cell && this.onHover) this.onHover(this.lr(Number(cell.dataset.r)), this.lr(Number(cell.dataset.c)));
      });
      this.hitLayer.addEventListener('mouseleave', () => this.onHover && this.onHover(-1, -1));
      this.subscribe();
    }

    setSquareSize(px) {
      this.sq = px;
      this.boardEl.style.setProperty('--sq', `${px}px`);
      for (const s of this.slots.values()) this.place(s, s.r, s.c);
    }

    bindGame(game) {
      this.game = game;
      for (const s of this.slots.values()) { this.animator.remove(s.rig); s.slot.remove(); }
      this.slots.clear();
      this.trapLayer.innerHTML = '';
      for (const p of game.board.pieces()) this.createSlot(p);
    }

    /** Orientação: com flip, a fila 8 fica em baixo. lr() converte visual ↔ lógico (é simétrica). */
    lr(i) { return this.flip ? 7 - i : i; }
    setFlip(flip) {
      this.flip = !!flip;
      const ranks = document.querySelectorAll('#board-frame .ranks span');
      const files = document.querySelectorAll('#board-frame .files span');
      ranks.forEach((el, i) => { el.textContent = String(this.flip ? i + 1 : 8 - i); });
      files.forEach((el, i) => { el.textContent = 'abcdefgh'[this.flip ? 7 - i : i]; });
      for (const s of this.slots.values()) this.place(s, s.r, s.c);
    }

    // ── Slots de peças ──
    xy(r, c) { return [this.lr(c) * this.sq, this.lr(r) * this.sq]; }
    tf(p) { return `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px)`; }

    createSlot(piece) {
      const slot = document.createElement('div');
      slot.className = `piece-slot team-${piece.team.toLowerCase()}`;
      slot.dataset.uid = piece.uid;
      const jump = document.createElement('div'); jump.className = 'piece-jump';
      const squash = document.createElement('div'); squash.className = 'piece-squash';
      const rig = YC.PieceFactory.createPieceSVG(piece.type, piece.team);
      squash.appendChild(rig.svg);
      jump.appendChild(squash);
      const hud = document.createElement('div');
      hud.className = 'piece-hud';
      hud.innerHTML = '<span class="esc"></span><div class="hp"><i></i></div>';
      const stun = document.createElement('div');
      stun.className = 'stun-stars';
      stun.innerHTML = '<span>★</span><span>✦</span><span>★</span>';
      slot.append(jump, hud, stun);
      this.pieceLayer.appendChild(slot);
      this.animator.add(rig);
      const s = { uid: piece.uid, slot, jump, squash, rig, hud, type: piece.type, r: piece.row, c: piece.col, pos: [0, 0] };
      this.slots.set(piece.uid, s);
      this.place(s, piece.row, piece.col);
      this.updatePieceHUD(piece);
      return s;
    }

    place(s, r, c) {
      s.r = r; s.c = c;
      s.pos = this.xy(r, c);
      s.slot.style.transform = this.tf(s.pos);
      s.slot.style.zIndex = String(10 + this.lr(r));
    }

    updatePieceHUD(piece) {
      const s = this.slots.get(piece.uid);
      if (!s) return;
      const turn = this.game ? this.game.state.turnCount : 0;
      const pct = Math.max(0, Math.min(100, (piece.hp / piece.maxHp) * 100));
      const bar = s.hud.querySelector('.hp i');
      bar.style.width = `${pct}%`;
      bar.className = pct < 30 ? 'low' : pct < 60 ? 'mid' : '';
      const esc = piece.shield + piece.tempShield;
      const escEl = s.hud.querySelector('.esc');
      escEl.textContent = esc > 0 ? esc : '';
      escEl.style.display = esc > 0 ? '' : 'none';
      const stunned = this.game && this.game.board.isStunned(piece, turn);
      s.slot.classList.toggle('stunned', !!stunned);
      s.slot.classList.toggle('boosted', piece.tempAtk > 0 || piece.overdrive || piece.buffs.some((b) => b.amount > 0));
      s.slot.classList.toggle('debuffed', piece.buffs.some((b) => b.amount < 0 && turn < b.expiresAtTurn));
      if (s.type !== piece.type) this.replaceRig(s, piece);
    }

    updateAllHUD() { if (this.game) for (const p of this.game.board.pieces()) this.updatePieceHUD(p); }

    replaceRig(s, piece) {
      this.animator.remove(s.rig);
      const rig = YC.PieceFactory.createPieceSVG(piece.type, piece.team);
      s.squash.replaceChildren(rig.svg);
      s.rig = rig; s.type = piece.type;
      this.animator.add(rig);
    }

    setPieceFlags(flags) {
      for (const s of this.slots.values()) {
        const f = flags[s.uid] || {};
        s.slot.classList.toggle('selected', !!f.selected);
        s.slot.classList.toggle('movable', !!f.movable);
        s.slot.classList.toggle('targetable', !!f.targetable);
        s.rig.excited = f.selected ? 0.6 : 0;
      }
    }

    /** `map`: chave "r,c" → { cls: [...], badge } */
    setHighlights(map) {
      for (let i = 0; i < 64; i++) {
        const key = `${this.lr(Math.floor(i / 8))},${this.lr(i % 8)}`;
        const h = map[key];
        this.hlCells[i].className = 'cell' + (h ? ' ' + h.cls.join(' ') : '');
        const hit = this.hitCells[i];
        hit.classList.toggle('clickable', !!(h && h.click));
        const badge = h && h.badge ? h.badge : '';
        if (hit.dataset.badge !== badge) {
          hit.dataset.badge = badge;
          hit.innerHTML = badge ? `<span class="badge b-${badge.replace(/[^A-Z]/g, '')}">${badge}</span>` : '';
        }
      }
    }

    badgeFor(outcome) { return BADGE[outcome]; }

    /** Desenha as armadilhas visíveis para quem está a ver (só as suas). */
    setTrapMarkers(list, turn) {
      this.trapLayer.innerHTML = list.map(({ row, col, trap }) => `
        <div class="trap-seal c-${trap.card.uno.color}${turn > trap.turnSet ? ' armed' : ''}" style="--r:${this.lr(row)};--c:${this.lr(col)}" title="${YC.CardView.escape(trap.card.name)}">
          <span>⚠</span><em>${turn > trap.turnSet ? '' : 'zzz'}</em></div>`).join('');
    }

    // ── Coordenadas de ecrã ──
    cellCenter(r, c) {
      const rect = this.boardEl.getBoundingClientRect();
      return { x: rect.left + (this.lr(c) + 0.5) * this.sq, y: rect.top + (this.lr(r) + 0.5) * this.sq };
    }
    pieceTop(uid) {
      const s = this.slots.get(uid);
      if (!s) return { x: 0, y: 0 };
      const rect = this.boardEl.getBoundingClientRect();
      return { x: rect.left + s.pos[0] + this.sq / 2, y: rect.top + s.pos[1] - this.sq * 0.1 };
    }

    // ── Animações (devolvem promessas) ──
    ms(v) { return v * this.speed; }

    async hop(s, to, { height, duration, sound = true } = {}) {
      const from = s.pos;
      const dist = Math.hypot(to[0] - from[0], to[1] - from[1]) / this.sq;
      const dur = this.ms(duration || 340 + 60 * Math.min(dist, 7));
      const h = height != null ? height : Math.min(this.sq * 1.3, this.sq * (0.45 + dist * 0.16));
      s.pos = to;
      s.slot.style.transform = this.tf(to);
      s.slot.style.zIndex = '70';
      if (sound) setTimeout(() => this.audio.playJumpBoing(), dur * 0.2);
      const a = s.slot.animate([
        { transform: this.tf(from), offset: 0 }, { transform: this.tf(from), offset: 0.23 },
        { transform: this.tf(to), offset: 0.67, easing: 'ease-out' }, { transform: this.tf(to), offset: 1 }
      ], { duration: dur });
      s.jump.animate([
        { transform: 'translateY(0)', offset: 0 }, { transform: 'translateY(0)', offset: 0.23, easing: 'ease-out' },
        { transform: `translateY(${-h}px)`, offset: 0.45, easing: 'ease-in' }, { transform: 'translateY(0)', offset: 0.67 },
        { transform: 'translateY(0)', offset: 1 }
      ], { duration: dur });
      s.squash.animate([
        { transform: 'scale(1,1)' }, { transform: 'scale(1.28,0.78)', offset: 0.23 }, { transform: 'scale(0.8,1.25)', offset: 0.45 },
        { transform: 'scale(1.38,0.72)', offset: 0.7 }, { transform: 'scale(0.92,1.08)', offset: 0.82 },
        { transform: 'scale(1.04,0.97)', offset: 0.92 }, { transform: 'scale(1,1)' }
      ], { duration: dur });
      await a.finished.catch(() => {});
    }

    async animatePieceMove(uid, to) {
      const s = this.slots.get(uid);
      if (!s) return;
      await this.hop(s, this.xy(to[0], to[1]));
      s.r = to[0]; s.c = to[1];
      s.slot.style.zIndex = String(10 + this.lr(to[0]));
    }

    async animateLunge(uid, target) {
      const s = this.slots.get(uid);
      if (!s) return;
      const t = this.xy(target[0], target[1]);
      const p = [s.pos[0] + (t[0] - s.pos[0]) * 0.6, s.pos[1] + (t[1] - s.pos[1]) * 0.6];
      await this.hop(s, p, { height: this.sq * 0.35, duration: 300 });
    }

    async animatePieceBounceBack(uid, returnCoord, word = 'BOING!') {
      const s = this.slots.get(uid);
      if (!s) return;
      this.audio.playSlideWhistleDown();
      const top = this.pieceTop(uid);
      this.vfx.floatText(top.x, top.y, word, 'boing');
      await this.hop(s, this.xy(returnCoord[0], returnCoord[1]), { height: this.sq * 1.1, duration: 560, sound: false });
      s.r = returnCoord[0]; s.c = returnCoord[1];
      s.slot.style.zIndex = String(10 + this.lr(returnCoord[0]));
    }

    async animateHit(uid, text, kind) {
      const s = this.slots.get(uid);
      if (!s) return;
      const top = this.pieceTop(uid);
      if (text) this.vfx.floatText(top.x, top.y, text, kind);
      this.vfx.chromaticHit(s.slot);
      await s.squash.animate([
        { transform: 'scale(1,1) rotate(0)' }, { transform: 'scale(1.3,0.7) rotate(-6deg)', offset: 0.2 },
        { transform: 'scale(0.86,1.14) rotate(5deg)', offset: 0.45 }, { transform: 'scale(1.06,0.95) rotate(-2deg)', offset: 0.7 },
        { transform: 'scale(1,1) rotate(0)' }
      ], { duration: this.ms(360) }).finished.catch(() => {});
    }

    async animateDestroy(uid, word) {
      const s = this.slots.get(uid);
      if (!s) return;
      const rect = this.boardEl.getBoundingClientRect();
      const center = { x: rect.left + s.pos[0] + this.sq / 2, y: rect.top + s.pos[1] + this.sq / 2 };
      this.vfx.spawnCartoonExplosion(center.x, center.y - this.sq * 0.2, s.slot.classList.contains('team-white') ? '#E5A93C' : '#C83E3B', word);
      this.vfx.triggerScreenShake(9, 360);
      this.audio.playExplosion();
      this.animator.remove(s.rig);
      await s.squash.animate([
        { transform: 'scale(1,1) rotate(0)', opacity: 1 }, { transform: 'scale(1.4,0.5) rotate(20deg)', opacity: 1, offset: 0.3 },
        { transform: 'scale(0.1,0.1) rotate(380deg)', opacity: 0 }
      ], { duration: this.ms(520), fill: 'forwards' }).finished.catch(() => {});
      s.slot.remove();
      this.slots.delete(uid);
    }

    async animateSwap(a, b) {
      const sa = this.slots.get(a.uid), sb = this.slots.get(b.uid);
      if (!sa || !sb) return;
      this.audio.playJumpBoing();
      await Promise.all([this.hop(sa, this.xy(a.row, a.col), { sound: false }), this.hop(sb, this.xy(b.row, b.col), { height: this.sq * 0.9, sound: false })]);
      this.place(sa, a.row, a.col); this.place(sb, b.row, b.col);
    }

    async animateSpawn(piece) {
      const s = this.createSlot(piece);
      this.audio.playHeal();
      await s.squash.animate([{ transform: 'scale(0,0)' }, { transform: 'scale(1.3,0.8)', offset: 0.6 }, { transform: 'scale(1,1)' }],
        { duration: this.ms(480), easing: 'ease-out' }).finished.catch(() => {});
    }

    async revealTrapAt(card, r, c, word = 'ARMADILHA!') {
      const pos = this.cellCenter(r, c);
      const node = YC.CardView.create(card, { small: true });
      node.classList.add('trap-pop');
      node.style.left = `${pos.x}px`;
      node.style.top = `${pos.y}px`;
      this.vfx.fxLayer.appendChild(node);
      this.vfx.bigWord(word, 'trap');
      this.audio.playTrapSpring();
      await new Promise((res) => setTimeout(res, this.ms(1150)));
      node.classList.add('out');
      setTimeout(() => node.remove(), 400);
    }

    poofAt(r, c, word) {
      const pos = this.cellCenter(r, c);
      this.vfx.spawnCartoonExplosion(pos.x, pos.y, '#F4E7C5', word);
    }

    // ── Ligação ao EventBus ──
    subscribe() {
      const bus = this.bus;
      const hud = (p) => this.updatePieceHUD(p);
      bus.on('PIECE_MOVED', async ({ piece, to, kind }) => {
        await this.animatePieceMove(piece.uid, to);
        if (kind === 'ADVANCE') this.audio.playThud();
        hud(piece);
      });
      bus.on('COMBAT_RESOLVED', async ({ attacker, defender, result }) => {
        await this.animateLunge(attacker.uid, [defender.row, defender.col]);
        this.audio.playAnvilHit();
        this.vfx.triggerScreenShake(result.damage > 40 ? 12 : 7, 300);
        const text = result.damage > 0 ? `-${result.damage} HP!` : 'BLOCKED!';
        await this.animateHit(defender.uid, text, result.damage > 0 ? 'dmg' : 'block');
        hud(defender);
        if (result.retaliation) {
          this.audio.playPunch();
          await this.animateHit(attacker.uid, result.retaliation.damage > 0 ? `-${result.retaliation.damage}` : 'BLOCKED!', 'dmg small');
          hud(attacker);
        }
      });
      bus.on('PIECE_BOUNCED', async ({ piece, to, kind }) => {
        await this.animatePieceBounceBack(piece.uid, to, kind === 'SPRING' ? 'BOING!' : 'BOING!');
        hud(piece);
      });
      bus.on('PIECE_DESTROYED', async ({ piece }) => {
        if (piece.type !== 'KING') { await this.animateDestroy(piece.uid); return; }
        // Rei derrubado: câmara lenta dramática antes do "A KNOCKOUT!"
        document.documentElement.classList.add('slowmo');
        const prev = this.speed;
        this.speed = prev * 2.6;
        this.vfx.bigWord('K.O.!', 'parry');
        await this.animateDestroy(piece.uid, 'KNOCKOUT!');
        this.speed = prev;
      });
      bus.on('PIECE_DAMAGED', async ({ piece, hit, cost }) => {
        hud(piece);
        if (!this.slots.has(piece.uid)) return;
        this.audio.playPunch();
        await this.animateHit(piece.uid, cost ? `-${hit.damage} (custo)` : hit.damage > 0 ? `-${hit.damage}` : 'BLOCKED!', cost ? 'cost' : 'dmg');
      });
      bus.on('PIECE_HEALED', ({ piece, amount }) => {
        hud(piece);
        if (amount > 0) { const t = this.pieceTop(piece.uid); this.vfx.floatText(t.x, t.y, `+${amount} HP`, 'heal'); }
      });
      bus.on('PIECE_BUFFED', async ({ piece, boost, stat, amount }) => {
        hud(piece);
        const t = this.pieceTop(piece.uid);
        let text = '';
        if (boost) {
          const bits = [];
          if (boost.atk) bits.push(`+${boost.atk} ATK`);
          if (boost.overdrive) bits.push('+25%');
          if (boost.tempShield || boost.shield) bits.push(`+${boost.tempShield + boost.shield} ESC`);
          if (boost.heal) bits.push(`+${boost.heal} HP`);
          text = bits.join(' ');
        } else text = `${amount > 0 ? '+' : ''}${amount} ${stat === 'shield' ? 'ESC' : 'ATK'}`;
        if (text) this.vfx.floatText(t.x, t.y - 18, text, amount < 0 ? 'debuff' : 'buff');
        this.audio.playPowerUp();
        await new Promise((r) => setTimeout(r, this.ms(260)));
      });
      bus.on('STATUS_APPLIED', async ({ piece }) => {
        hud(piece);
        const t = this.pieceTop(piece.uid);
        this.vfx.floatText(t.x, t.y, 'CONGELADA!', 'stun');
        this.audio.playFreeze();
        await new Promise((r) => setTimeout(r, this.ms(300)));
      });
      bus.on('STATS_SWAPPED', ({ piece }) => { hud(piece); const t = this.pieceTop(piece.uid); this.vfx.floatText(t.x, t.y, 'ATK ⇄ ESC', 'buff'); });
      bus.on('FLOAT_TEXT', ({ piece, text }) => { const t = this.pieceTop(piece.uid); this.vfx.floatText(t.x, t.y, text, 'stun'); });
      bus.on('PIECES_SWAPPED', ({ a, b }) => this.animateSwap(a, b));
      bus.on('PIECE_PROMOTED', async ({ piece }) => {
        hud(piece);
        const t = this.pieceTop(piece.uid);
        this.vfx.floatText(t.x, t.y, 'PROMOÇÃO!', 'buff');
        this.audio.playFanfareShort();
      });
      bus.on('PIECE_REVIVED', ({ piece }) => this.animateSpawn(piece));
      bus.on('SPATIAL_TRAP_TRIGGERED', async ({ trap, coord }) => { await this.revealTrapAt(trap.card, coord[0], coord[1]); });
      bus.on('TRAP_DESTROYED', ({ row, col }) => { this.poofAt(row, col, 'CRUNCH!'); this.audio.playPunch(); });
      bus.on('TRAP_CLASH', async ({ row, col }) => {
        this.poofAt(row, col, 'CLANG!');
        this.audio.playAnvilHit();
        await new Promise((r) => setTimeout(r, this.ms(600)));
      });
      bus.on('EXPLOSION', async ({ row, col, word }) => {
        const p = this.cellCenter(row, col);
        this.vfx.spawnCartoonExplosion(p.x, p.y, '#C83E3B', word);
        this.vfx.triggerScreenShake(12, 400);
        this.audio.playExplosion();
        await new Promise((r) => setTimeout(r, this.ms(380)));
      });
      bus.on('FIELD_EFFECT', async ({ kind }) => {
        this.boardEl.classList.remove('field-dmg', 'field-heal');
        void this.boardEl.offsetWidth;
        this.boardEl.classList.add(kind === 'HEAL' ? 'field-heal' : 'field-dmg');
        if (kind === 'HEAL') this.audio.playHeal(); else this.audio.playExplosion();
        await new Promise((r) => setTimeout(r, this.ms(500)));
      });
      bus.on('TURN_STARTED', () => this.updateAllHUD());
      bus.on('TURN_ENDED', () => this.updateAllHUD());
    }
  }

  YC.CupheadSVGRenderer = CupheadSVGRenderer;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
