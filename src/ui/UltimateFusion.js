/* UltimateFusion.js — fusão de Ultimates (acrescenta ao YC.Ultimate): quando a MESMA peça tem as cartas das duas
   personagens (Cetro do Falso Monarca + Escudo Tático: Akane + Kaito), transforma-se na fusão "Akaito, a Fusão Real".
   Vale quer as duas Ultimates sejam do mesmo jogador quer uma de cada (match.ults), e quer a segunda carta chegue por
   equipar quer pelo Íman (Ultimate.transform). A fusão ataca e guarda ao mesmo tempo:
   • entrada épica: as faixas da Akane (esquerda) e do Kaito (direita) entram, correm uma contra a outra e chocam no
     centro (clarão, ondas de choque, tremor, "FUSÃO!") e só depois entra o vídeo da fusão;
   • golpe: vídeo próprio e duas bolas de energia (vermelha e ciano) em espiral até ao alvo (Ultimate.bolt);
   • defesa: vídeo próprio; barreira dupla vermelha e ciano no Rei e anéis no chão à volta da peça (Board3DUltimate). */
(function (YC) {
  'use strict';

  const U = YC.Ultimate;
  const S = (n) => YC.Sound && YC.Sound.play(n);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => YC.HoloCard.esc(s);

  const FUSIONS = [{
    id: 'fusao_real', ids: ['eq_cetro_usurpador', 'eq_escudo_choque'], icon: 'fusao_real', name: 'Akaito', title: 'A Fusão Real',
    role: 'fusion', c1: '#D90429', c2: '#48CAE4',
    say: { summon: 'Coroa e escudo: somos um só!', strike: 'Raio Real Duplo!', guard: 'Muralha Rubi-Safira!' },
    ms: { summon: 5400, strike: 4600, guard: 3600 }, hits: { strike: 0.45, guard: 0.45 },
    tabs: { summon: 'Fusão', strike: 'Golpe', guard: 'Defesa' }
  }];

  Object.assign(U, {
    FUSIONS,
    /** A fusão de uma peça (as duas cartas, ambas com a Ultimate ativa na partida), ou null. */
    fusionOf(piece, m) {
      if (!piece || !m || piece.equips.length < 2) return null;
      return FUSIONS.find((f) => f.ids.every((id) => piece.equips.includes(id) && U.active(m, id))) || null;
    },
    /** A fusão de que esta carta faz parte (para a pré-visualização), ou null. */
    fusionWith(id) { return FUSIONS.find((f) => f.ids.includes(id)) || null; },

    /** Entrada épica da fusão; resolve no fim do vídeo da fusão. */
    async fusionIntro(f) {
      const g = window.gsap;
      if (!g || (YC.reducedMotion && YC.reducedMotion())) return U.cutIn(f, 'summon');
      const [A, K] = f.ids.map((id) => U.DEFS[id]);
      const el = document.createElement('div');
      el.className = 'ult-fuse';
      el.innerHTML = `<div class="fz-veil"></div>
        <div class="fz-band l" style="--c:${A.c1}"><img src="${U.hero(A)}" alt=""><b>${esc(A.name)}</b></div>
        <div class="fz-band r" style="--c:${K.c1}"><b>${esc(K.name)}</b><img src="${U.hero(K)}" alt=""></div>
        <i class="fz-flash"></i><i class="fz-ring"></i><i class="fz-ring b"></i><div class="fz-word">FUSÃO!</div>`;
      document.body.appendChild(el);
      let skip = false;
      el.addEventListener('click', () => { skip = true; });
      const L = el.querySelector('.fz-band.l'), R = el.querySelector('.fz-band.r'), tw = (t, v) => new Promise((r) => g.fromTo(t, v[0], { ...v[1], onComplete: r }));
      S('magic_zap');
      g.fromTo(el.querySelector('.fz-veil'), { opacity: 0 }, { opacity: 1, duration: 0.2 });
      g.fromTo(L, { xPercent: -110 }, { xPercent: 0, duration: 0.42, ease: 'power3.out' });
      await tw(R, [{ xPercent: 110 }, { xPercent: 0, duration: 0.42, ease: 'power3.out', delay: 0.12 }]);
      if (!skip) await wait(520);
      // correm uma contra a outra e chocam no centro
      g.to(L, { xPercent: 38, duration: 0.26, ease: 'power3.in' });
      await tw(R, [{ xPercent: 0 }, { xPercent: -38, duration: 0.26, ease: 'power3.in' }]);
      S('explosion_bam'); S('reveal_legend');
      g.to([L, R], { opacity: 0, duration: 0.12 });
      g.fromTo(el.querySelector('.fz-flash'), { opacity: 1 }, { opacity: 0, duration: 0.6, ease: 'power2.out' });
      g.fromTo(el.querySelector('.fz-ring'), { scale: 0.1, opacity: 1 }, { scale: 1.7, opacity: 0, duration: 0.7, ease: 'expo.out' });
      g.fromTo(el.querySelector('.fz-ring.b'), { scale: 0.1, opacity: 1 }, { scale: 1.3, opacity: 0, duration: 0.6, delay: 0.1, ease: 'expo.out' });
      g.fromTo(el, { x: -10 }, { x: 10, duration: 0.04, repeat: 9, yoyo: true, ease: 'none', onComplete: () => g.set(el, { x: 0 }) });
      g.fromTo(el.querySelector('.fz-word'), { scale: 2.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.18, ease: 'power3.in' });
      if (!skip) await wait(950);
      await new Promise((r) => g.to(el, { opacity: 0, duration: 0.2, onComplete: r }));
      el.remove();
      return U.cutIn(f, 'summon');
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
