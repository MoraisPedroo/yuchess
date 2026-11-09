/* VersusScreen.js — ecrã de carregamento / VS à entrada da partida, ao estilo do ecrã de carregamento do LoL
   (docs/RELATORIO-TELAS.md, secção F, ecrã 5): fundo de vídeo (energia ciano contra carmesim), um cartão grande por
   jogador com a personagem (a favorita do jogador — ArenaHero —; o bot tem uma por nível), o Rei da cor dele, nome,
   linha de baixo, liga ou nível e barra de carregamento; carimbo "VS" com tremor; uma dica do jogo; no fim os cartões
   saem para os lados e o ecrã "mergulha" no estádio. YC.VS.run(info, mount): mount() corre com os cartões já no
   ecrã (a partida monta-se por trás sem se ver), e as barras só chegam aos 100 % quando mount acabou e passou o tempo
   mínimo (info.minMs, 2 s por omissão). Só visual. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const DIR = 'assets/video/menu/';
  const TIPS = [
    'Uma Armadilha de Casa só dispara quando uma peça inimiga pisa a casa.',
    'As Counter-Traps (Velocidade 3) respondem a qualquer carta da Chain.',
    'O Rei é imune a congelar e a ser destruído por cartas.',
    'Perder um Cavalo, Bispo, Torre ou Dama dá-te uma carta.',
    'Equipa a mesma peça com o Cetro e o Escudo para invocar o Akaito.',
    'Uma peça com Escudo sobrevive à próxima captura.',
    'Viraste uma carta na Zona? Só a podes usar a partir do teu turno seguinte.'
  ];

  /** Personagem (das Ultimates) pelo ícone. */
  function charOf(icon) {
    const U = YC.Ultimate;
    if (!U || !icon) return null;
    return Object.values(U.DEFS).find((d) => d.icon === icon) || (U.FUSIONS || []).find((f) => f.icon === icon) || null;
  }

  function card(p, side) {
    const d = charOf(p.art);
    const c1 = side === 'l' ? '#00B4D8' : '#D90429';
    return `<div class="lv-card ${side}" style="--side:${c1};--c1:${d ? d.c1 : c1};--c2:${d ? d.c2 : '#FFB703'}">
      <div class="lv-art">${d ? `<img src="${YC.Ultimate.hero(d)}" alt="">` : `<div class="lv-king">${YC.pieceHTML('k', p.color, 'bust')}</div>`}
        <div class="lv-ava ${p.color}">${YC.pieceHTML('k', p.color, 'bust')}</div></div>
      <div class="lv-info">
        <b>${esc(p.name)}</b><small>${esc(p.sub || '')}</small>
        ${p.chip ? `<span class="lv-chip">${esc(p.chip)}</span>` : ''}
        ${d ? `<em>${esc(d.name)} · ${esc(d.title)}</em>` : ''}
        <div class="lv-bar"><i></i></div>
      </div></div>`;
  }

  // fundo: o vídeo do VS (toca uma vez: as fitas ciano e carmesim entram com os cartões e chocam num remoinho dourado
  // quando o carimbo bate); sem vídeo, a imagem com zoom lento e um remoinho em CSS
  function backdrop() {
    const has = YC.MENU_CLIPS && YC.MENU_CLIPS.vs, calm = YC.reducedMotion();
    const poster = YC.asset(`${DIR}vs-poster.webp`);
    if (!has || calm) return `<img class="lv-bg still" src="${poster}" alt=""><i class="lv-swirl"></i>`;
    const v = document.createElement('video');
    const webm = v.canPlayType('video/webm; codecs="vp9"') !== '';
    const mobile = innerWidth <= 768 && innerHeight > innerWidth;
    return `<video class="lv-bg" muted playsinline autoplay poster="${poster}" src="${DIR}vs-${mobile ? 'mobile' : '720p'}.${webm ? 'webm' : 'mp4'}"></video>`;
  }

  const VS = {
    /** info: { left: {name, sub, color, art, chip}, right: {...}, minMs } (esquerda = tu). */
    async run(info, mount) {
      const g = window.gsap;
      if (!g || YC.reducedMotion()) { await mount(); return; }
      const S = (n) => YC.Sound && YC.Sound.play(n);
      const el = document.createElement('div');
      el.className = 'lv';
      el.innerHTML = `${backdrop()}<div class="lv-shade"></div>
        <div class="lv-cards">${card(info.left, 'l')}<div class="lv-mid"><div class="lv-stamp">VS</div></div>${card(info.right, 'r')}</div>
        <p class="lv-tip"><b>Dica</b>${esc(TIPS[Math.floor(Math.random() * TIPS.length)])}</p>`;
      document.body.appendChild(el);
      const [L, R] = el.querySelectorAll('.lv-card'), stamp = el.querySelector('.lv-stamp'), bars = el.querySelectorAll('.lv-bar i');
      const t0 = performance.now(), minMs = info.minMs || 2000;
      // entram: fundo, cartões dos lados, carimbo a bater ao centro com tremor
      S('whoosh');
      g.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      g.set(stamp, { scale: 2.4, opacity: 0 });
      g.fromTo(L, { xPercent: -130, rotation: -4 }, { xPercent: 0, rotation: 0, duration: 0.42, ease: 'quart.out' });
      await new Promise((r) => g.fromTo(R, { xPercent: 130, rotation: 4 }, { xPercent: 0, rotation: 0, duration: 0.42, delay: 0.06, ease: 'quart.out', onComplete: r }));
      g.to(stamp, { scale: 1, opacity: 1, duration: 0.22, ease: 'power4.in', onComplete: () => {
        S('vs_slam');
        g.fromTo(el.querySelector('.lv-cards'), { x: -6, y: 4 }, { x: 0, y: 0, duration: 0.28, ease: 'elastic.out(1, 0.4)' });
      } });
      g.fromTo(el.querySelector('.lv-tip'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, delay: 0.3, ease: 'power3.out' });
      // barras: sobem até 85 % enquanto a partida monta; 100 % quando acabou e passou o tempo mínimo
      const prog = { p: 0 };
      const paint = () => bars.forEach((b) => { b.style.transform = `scaleX(${prog.p})`; });
      const climb = g.to(prog, { p: 0.85, duration: minMs / 1000, ease: 'power1.out', onUpdate: paint });
      await mount();
      const left = minMs - (performance.now() - t0);
      if (left > 0) await wait(left);
      climb.kill();
      await new Promise((r) => g.to(prog, { p: 1, duration: 0.25, ease: 'power2.out', onUpdate: paint, onComplete: r }));
      await wait(220);
      // saem: cartões para os lados e mergulho no estádio
      S('vs_riser');
      g.to(stamp, { scale: 1.6, opacity: 0, duration: 0.3, ease: 'power2.in' });
      g.to(L, { xPercent: -140, duration: 0.5, ease: 'power3.in' });
      g.to(R, { xPercent: 140, duration: 0.5, ease: 'power3.in' });
      await new Promise((r) => g.to(el, { scale: 1.3, opacity: 0, duration: 0.6, delay: 0.12, ease: 'power3.in', onComplete: r }));
      el.remove();
    },

    /** "PARTIDA ENCONTRADA!" da sala privada (sem aceitar: o amigo entrou pelo código): brasão com anel a encher, som
        de impacto e o título do separador a piscar. A ranqueada tem o ecrã com aceitar (MatchFound). */
    async found(ranked) {
      const g = window.gsap;
      if (YC.Sound) YC.Sound.play('match_found');
      if (YC.MatchFound) YC.MatchFound.blinkTitle();
      if (!g || YC.reducedMotion()) return;
      const el = document.createElement('div');
      el.className = 'mf';
      el.innerHTML = `<div class="mf-ring"><svg class="mf-svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54"/><circle class="fill" cx="60" cy="60" r="54"/></svg>${YC.Icon('trophy', { size: 64 })}</div>
        <h2>PARTIDA ENCONTRADA!</h2><small>${ranked ? 'Ranqueada · o rating está em jogo' : 'Sala privada'}</small>`;
      document.body.appendChild(el);
      g.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.18 });
      g.fromTo(el.querySelector('.mf-ring'), { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.32, ease: 'expo.out' });
      g.fromTo(el.querySelector('h2'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, delay: 0.12, ease: 'back.out(1.4)' });
      g.fromTo(el.querySelector('.fill'), { strokeDashoffset: 339.3 }, { strokeDashoffset: 0, duration: 1.4, ease: 'none' });
      await wait(1600);
      await new Promise((r) => g.to(el, { opacity: 0, duration: 0.2, onComplete: r }));
      el.remove();
    },

    /** Personagem do bot por nível (só visual). */
    botArt: { easy: 'canhao_circo', medium: 'exoesqueleto_robo', hard: 'heavy_anvil' }
  };

  YC.VS = VS;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
