/* UltimateCards.js — Ultimates das Armadilhas, Counter-Traps e dos poderes dos Equipamentos (acrescenta a YC.Ultimate):
   • role 'card': quando a Lendária entra na Chain, a personagem entra em ecrã inteiro (em vez da faixa "LENDÁRIA!");
     quando resolve, aparece no tabuleiro (cast.at: casa da armadilha ou peça atacada) e, se tiver cast.to, a energia
     voa até quem atacou.
   • role 'power': quando o poder do Equipamento dispara (evento equip:proc), entra o vídeo do poder e o efeito no
     tabuleiro (onda à volta da peça, ou a energia até à casa `to`, ex.: para onde o Canhão lança o Peão).
   Só visual, corre igual nos dois clientes. Ligado no MatchAnimator (chain:link, chain:resolve, equip:proc). */
(function (YC) {
  'use strict';

  const U = YC.Ultimate;
  const G = () => window.gsap;
  const calm = () => YC.reducedMotion && YC.reducedMotion();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const hex = (c) => new window.THREE.Color(c).getHex();

  Object.assign(U, {
    /** Carta Lendária entrou na Chain: com a Ultimate ativa, entra a personagem; senão a faixa normal. */
    async onLink(an, link) {
      const d = U.def(link.def.id);
      if (!d || d.role !== 'card' || !U.active(an.ui.match, d.id)) return an.ui.cutIn(link);
      await U.cutIn(d, 'summon');
    },

    /** A carta vai resolver (antes do efeito): a personagem aparece no tabuleiro. */
    async onResolve(an, link) {
      const d = U.def(link.def.id);
      if (!d || d.role !== 'card' || !d.cast || !U.active(an.ui.match, d.id)) return;
      try {
        const ev = link.event || {}, tg = link.target || {};
        const at = d.cast.at === 'trap' ? (ev.sq != null ? ev.sq : tg.sq) : d.cast.at === 'defender' ? (ev.targetSq != null ? ev.targetSq : ev.to) : -1;
        if (at == null || at < 0) return;
        await U.appear(an, at, d);
        const to = d.cast.to === 'attacker' ? ev.from : -1;
        if (to != null && to >= 0 && to !== at) await U.bolt(an, at, to, d, { text: d.cast.text });
        else await U.impact(an, at, d, d.cast.text, d.cast.heavy);
      } catch (err) { console.warn('[ultimate]', err); }
    },

    /** Poder de um Equipamento disparou (equip:proc): personagem 'power' → vídeo do poder + efeito; senão o aviso normal. */
    async onProc(an, p) {
      const d = U.forPiece(p.piece, an.ui.match);
      if (!d || d.role !== 'power' || d.id !== p.id) return an.procPop(p);
      await U.cutIn(d, 'strike');
      try {
        if (p.to != null && p.to >= 0) await U.bolt(an, p.sq, p.to, d, { text: d.say.strike.toUpperCase().split(' ')[0] });
        else await U.impact(an, p.sq, d, d.id === 'eq_trono_glaciar' ? 'GELO!' : 'UAU!', false, true);
      } catch (err) { console.warn('[ultimate]', err); }
    },

    /** A personagem salta para a casa (figura por instantes) com um feixe de luz. */
    async appear(an, sq, d) {
      const b = an.board;
      if (b.is3D && b.ultPop && !calm()) {
        const w = an.w3(sq);
        if (an.beam) an.beam(sq, hex(d.c2), 3);
        b.sparks(w.x, 0.8, w.z, hex(d.c2), { n: 24, speed: 2.4 });
        b.text3D(w.x, 2, w.z, d.name.toUpperCase(), d.c2, 1);
        await b.ultPop(sq, d, 700);
      } else {
        const [x, y] = an.xy(sq);
        YC.FX.ring(b.fx, x, y, d.c2, 0.4);
        YC.FX.particles(b.fx, x, y, { n: 20, colors: [d.c1, d.c2, '#fff'], shape: 'star' });
        await YC.FX.burst(b.fx, x, y, d.name.toUpperCase(), { fill: d.c1 });
      }
    },

    /** Impacto no sítio (sem energia a voar): explosão com o desenho da personagem, faíscas e texto; `ring` = onda. */
    async impact(an, sq, d, text, heavy = false, ring = false) {
      const b = an.board;
      if (b.is3D && an.w3 && !calm()) {
        const w = an.w3(sq), h1 = hex(d.c1), h2 = hex(d.c2);
        b.sparks(w.x, 0.6, w.z, h1, { n: 30, speed: ring ? 3.6 : 3 });
        b.sparks(w.x, 0.6, w.z, h2, { n: 20, speed: 2.4 });
        b.burst(w.x, 0.8, w.z, d.fx || 'IMPACT', { size: heavy ? 2.2 : 1.7 });
        if (b.scatter && d.fx) b.scatter(w.x, 0.8, w.z, d.fx, { n: ring ? 12 : 7, size: 0.32, speed: ring ? 3.4 : 2.6 });
        if (ring && b.decal) b.decal(w.x, w.z, d.fx || 'MAGIC_CIRCLE', { size: 2.6, life: 1.2 });
        if (text) b.text3D(w.x, 1.5, w.z, text, d.c2, 1);
        b.lightFlash(w.x, 1, w.z, h1, heavy ? 8 : 6, 0.6);
        b.shakeCam(heavy ? 0.32 : 0.14, heavy ? 0.5 : 0.35);
        YC.Sound && YC.Sound.play(heavy ? 'explosion_bam' : 'magic_zap');
        await wait(420);
      } else {
        const [x, y] = an.xy(sq);
        YC.FX.particles(b.fx, x, y, { n: 18, colors: [d.c1, d.c2, '#fff'], shape: 'star' });
        if (heavy) YC.FX.shake(b.wrap, 12, 8);
        await YC.FX.burst(b.fx, x, y, text || '!', { fill: d.c1 });
      }
    }
  });

  // ── no palco 3D: a figura da personagem por instantes numa casa (mesmos materiais das figuras: sem shaders novos) ──
  if (YC.Board3D) Object.assign(YC.Board3D.prototype, {
    async ultPop(sq, d, hold = 800) {
      const THREE = window.THREE, g = G(), w = this.sqWorld(sq), H = 1.45;
      this.fxInit();
      const tex = this.ultTex(d);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xB8B8B8, transparent: true, alphaTest: 0.35, fog: false }));
      const ratio = tex.image && tex.image.width ? tex.image.width / tex.image.height : 0.55;
      s.center.set(0.5, 0); s.position.set(w.x, 0.1, w.z); s.raycast = () => {};
      this.fxGroup.add(s);
      if (g) {
        await g.fromTo(s.scale, { x: 0.01, y: 0.01 }, { x: H * ratio, y: H, duration: 0.42, ease: 'back.out(2)' });
        await wait(hold);
        await g.to(s.scale, { x: 0.01, y: H * 1.3, duration: 0.22, ease: 'power2.in' });
      } else { s.scale.set(H * ratio, H, 1); await wait(hold); }
      this.fxGroup.remove(s); s.material.dispose();
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
