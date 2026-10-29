/* Ultimates.js — animação Ultimate de uma Lendária: uma personagem de anime original (arte e vídeos feitos no Gemini,
   em assets/ultimate/<icone>/: hero.png recortada, summon.mp4 e strike.mp4). É só visual e só para quem a desbloqueou
   (1000 de ouro nos Baralhos, com a carta na coleção — Economy.unlockUltimate); o motor não sabe que existe.
   • Na mão e na coleção: a carta ganha a fita "ULTIMATE".
   • Invocar (equipar): o objeto voa para a peça como sempre; depois entra o cut-in com o vídeo de invocação e o nome
     dela e, quando acaba, a peça no tabuleiro transforma-se na personagem (figura de cartão no 3D, Board3DUltimate.js).
   • Sempre que essa peça vai capturar: cut-in com o vídeo do golpe e um corte de luz no ecrã, e só depois a captura.
   • Baralhos: pré-visualização (os dois vídeos, em pequeno ou em ecrã inteiro) e o botão de desbloquear.
   No online só tu vês a tua Ultimate (o adversário vê a peça normal). Toque/clique salta o cut-in. */
(function (YC) {
  'use strict';

  const G = () => window.gsap;
  const S = (n) => YC.Sound && YC.Sound.play(n);
  const esc = (s) => YC.HoloCard.esc(s);
  const calm = () => YC.reducedMotion && YC.reducedMotion();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const DEFS = {
    eq_cetro_usurpador: {
      id: 'eq_cetro_usurpador', icon: 'royal_scepter', name: 'Akane', title: 'A Rainha Rubi', c1: '#D90429', c2: '#FFB703',
      say: { summon: 'Esta coroa agora é minha!', strike: 'Ajoelha-te perante a rainha!' }, ms: { summon: 4800, strike: 4000 },
      hit: 0.68   // o raio do vídeo do golpe sai a 68 % (é aí que entra o corte de luz no ecrã)
    }
  };

  const U = {
    DEFS,
    /** Peças cuja transformação ainda não se mostra (à espera do fim do cut-in de invocação). */
    hold: new Set(),
    def(id) { return DEFS[id] || null; },
    hero(d) { return YC.asset(`assets/ultimate/${d.icon}/hero.png`); },
    video(d, kind) { return `assets/ultimate/${d.icon}/${kind}.mp4`; },
    unlocked(id) { const p = YC.ProfileStore && YC.ProfileStore.profile; return !!(p && DEFS[id] && YC.Economy.hasUltimate(p, id)); },

    /** A Ultimate ativa numa peça (só nas peças de quem está a ver e com a carta desbloqueada). */
    forPiece(piece, viewer) {
      if (!piece || !viewer || piece.color !== viewer || U.hold.has(piece.id)) return null;
      const id = piece.equips.find((e) => U.unlocked(e));
      return id ? DEFS[id] : null;
    },

    /** Fita "ULTIMATE" na carta (mão, coleção). locked: mostra-a apagada com cadeado (ainda por desbloquear). */
    decorate(el, id, { locked = false } = {}) {
      if (!DEFS[id] || el.querySelector('.ult-ribbon')) return;
      if (!locked && !U.unlocked(id)) return;
      el.classList.add(locked ? 'ult-locked' : 'ult-on');
      el.insertAdjacentHTML('beforeend', `<span class="ult-ribbon">${locked ? YC.Icon('lock', { size: 12 }) : YC.Icon('star', { size: 12 })}ULTIMATE</span>`);
    },

    // ───────────── cut-in em ecrã inteiro ─────────────
    /** kind: 'summon' (invocação) | 'strike' (golpe). Resolve quando acaba (ou quando se toca para saltar). */
    cutIn(d, kind = 'summon') {
      return new Promise((done) => {
        const g = G(), quiet = calm(), fast = YC.FX && YC.FX.speed > YC.FX.NORMAL;
        const el = document.createElement('div');
        el.className = `ult-cut k-${kind}`;
        el.style.setProperty('--c1', d.c1); el.style.setProperty('--c2', d.c2);
        el.innerHTML = `<div class="ult-veil"></div>
          <div class="ult-band"><div class="ult-media"><img class="ult-still" src="${U.hero(d)}" alt="">${quiet ? '' : `<video class="ult-video" muted playsinline preload="auto" src="${U.video(d, kind)}"></video>`}</div><i class="ult-lines"></i></div>
          <div class="ult-title"><small>${YC.Icon('star', { size: 14 })}ULTIMATE</small><b>${esc(d.name)}</b><span>${esc(kind === 'strike' ? d.say.strike : `${d.title} · ${d.say.summon}`)}</span></div>
          ${kind === 'strike' ? '<i class="ult-slash"></i><i class="ult-flash"></i>' : ''}
          <div class="ult-skip">Toca para saltar</div>`;
        document.body.appendChild(el);
        const band = el.querySelector('.ult-band'), title = el.querySelector('.ult-title'), v = el.querySelector('video');
        let over = false, timer = 0;
        const finish = async () => {
          if (over) return;
          over = true; clearTimeout(timer);
          if (v) v.pause();
          if (g && !quiet) {
            g.to(title, { x: 80, opacity: 0, duration: 0.2, ease: 'power2.in' });
            await new Promise((r) => g.to(band, { scaleY: 0, duration: 0.24, ease: 'power3.in', onComplete: r }));
            await new Promise((r) => g.to(el, { opacity: 0, duration: 0.14, onComplete: r }));
          }
          el.remove();
          done();
        };
        el.addEventListener('click', finish);
        const rate = fast ? 1.4 : 1, ms = quiet ? 1100 : d.ms[kind] / rate;
        if (v) {
          v.playbackRate = rate;
          v.addEventListener('playing', () => el.classList.add('vplay'), { once: true });
          v.addEventListener('ended', finish, { once: true });
          v.addEventListener('error', () => el.classList.add('novideo'), { once: true });
          const p = v.play(); if (p && p.catch) p.catch(() => el.classList.add('novideo'));
        }
        timer = setTimeout(finish, ms + 900);
        S(kind === 'strike' ? 'sword_draw' : 'reveal_legend');
        if (g && !quiet) {
          g.fromTo(el.querySelector('.ult-veil'), { opacity: 0 }, { opacity: 1, duration: 0.2 });
          g.fromTo(band, { scaleY: 0 }, { scaleY: 1, duration: 0.32, ease: 'back.out(1.6)' });
          g.fromTo(title, { x: -120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, delay: 0.18, ease: 'back.out(1.8)' });
          if (kind === 'strike') {
            // o corte de luz atravessa o ecrã a meio do golpe
            const at = (ms * (d.hit || 0.55)) / 1000;
            g.fromTo(el.querySelector('.ult-slash'), { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.18, delay: at, ease: 'expo.out', onStart: () => S('explosion_bam') });
            g.to(el.querySelector('.ult-slash'), { opacity: 0, duration: 0.3, delay: at + 0.3 });
            g.fromTo(el.querySelector('.ult-flash'), { opacity: 0.85 }, { opacity: 0, duration: 0.45, delay: at, immediateRender: false });
            g.fromTo(band, { x: -8 }, { x: 8, duration: 0.04, repeat: 7, yoyo: true, delay: at, ease: 'none', onComplete: () => g.set(band, { x: 0 }) });
          } else {
            setTimeout(() => S('magic_zap'), (ms * 0.4));
          }
        }
      });
    },

    // ───────────── na partida (chamado pelo MatchAnimator) ─────────────
    /** Equipar: a animação normal, depois o cut-in de invocação e a peça transforma-se na personagem. */
    async onEquip(an, p) {
      const d = DEFS[p.card && p.card.id] && U.unlocked(p.card.id) && p.piece && p.piece.color === an.ui.viewer ? DEFS[p.card.id] : null;
      if (!d) return an.equipAttach(p);
      U.hold.add(p.piece.id);
      try { await an.equipAttach(p); } finally { /* a transformação só aparece depois do vídeo */ }
      await U.cutIn(d, 'summon');
      U.hold.delete(p.piece.id);
      an.sync();
      const sq = p.sq, b = an.board;
      S('reveal_epic');
      try {
        if (b.is3D && an.w3) {
          const w = an.w3(sq);
          if (an.beam) an.beam(sq, 0xFFB703, 4);
          b.sparks(w.x, 0.8, w.z, 0xFFB703, { n: 30, speed: 2.4 });
          b.sparks(w.x, 0.8, w.z, 0xD90429, { n: 20, speed: 2 });
          b.text3D(w.x, 1.8, w.z, d.name.toUpperCase(), '#FFD166', 1);
          const fig = b.el(p.piece.id) && b.el(p.piece.id).getObjectByName('ultFigure');
          if (fig && G()) await G().fromTo(fig.scale, { x: 0.01, y: 0.01 }, { x: fig.scale.x, y: fig.scale.y, duration: 0.6, ease: 'back.out(2)' });
        } else {
          const [x, y] = an.xy(sq);
          YC.FX.ring(b.fx, x, y, d.c2, 0.4);
          YC.FX.particles(b.fx, x, y, { n: 24, colors: [d.c1, d.c2, '#fff'], shape: 'star' });
          await wait(400);
        }
      } catch (err) { console.warn('[ultimate]', err); }
    },

    /** Captura declarada por uma peça com Ultimate: cut-in do golpe e só depois a animação normal. */
    async onCapture(an, p) {
      const d = U.forPiece(p.attacker, an.ui.viewer);
      if (d) await U.cutIn(d, 'strike');
      return an.captureDeclare(p);
    },

    // ───────────── pré-visualização (Baralhos) ─────────────
    preview(id, { onChange } = {}) {
      const d = DEFS[id];
      if (!d) return;
      const E = YC.Economy, card = YC.Cards.get(id);
      const render = () => {
        const p = YC.ProfileStore.profile, owned = E.owned(p, id) > 0, has = E.hasUltimate(p, id), cost = E.ultimateCost(id);
        const act = has ? `<span class="ult-owned">${YC.Icon('check', { size: 18 })}Desbloqueada</span>`
          : owned ? `<button class="btn" data-a="unlock" ${p.gold >= cost ? '' : 'disabled'}>Desbloquear <span class="coin-pill gold">${YC.Icon('coin')}${cost}</span></button>`
            : `<span class="muted">Primeiro tens de ter <b>${esc(card.name)}</b> (pacotes ou criar com Poeira).</span>`;
        return `<div class="ult-prev" style="--c1:${d.c1};--c2:${d.c2}">
          <div class="ult-prev-stage"><img src="${U.hero(d)}" alt=""><video muted loop playsinline autoplay src="${U.video(d, 'summon')}"></video></div>
          <div class="ult-prev-body"><small class="ult-tag">${YC.Icon('star', { size: 14 })}ULTIMATE · ${esc(card.name)}</small>
            <h2>${esc(d.name)} · ${esc(d.title)}</h2>
            <ul><li><b>Invocar:</b> ao equipares o ${esc(card.name)}, entra um vídeo especial e o Peão transforma-se na ${esc(d.name)}.</li>
              <li><b>No tabuleiro:</b> a peça passa a ser a própria ${esc(d.name)}.</li>
              <li><b>Golpe:</b> sempre que ela captura, entra o vídeo do golpe antes da captura.</li>
              <li class="muted">Só visual: não muda as regras. No online só tu a vês.</li></ul>
            <div class="ult-tabs"><button class="chip on" data-v="summon">Invocação</button><button class="chip dark" data-v="strike">Golpe</button><button class="chip dark" data-a="full">${YC.Icon('play', { size: 14 })}Ecrã inteiro</button></div>
            <div class="row ult-actions">${act}<button class="btn secondary" data-a="close">Fechar</button></div></div></div>`;
      };
      const m = YC.UI.modal(render(), { cls: 'ult-modal' });
      let kind = 'summon';
      const wire = () => {
        const root = m.el, vid = root.querySelector('.ult-prev-stage video');
        root.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => {
          kind = b.dataset.v;
          root.querySelectorAll('[data-v]').forEach((x) => { x.classList.toggle('on', x === b); x.classList.toggle('dark', x !== b); });
          vid.src = U.video(d, kind); vid.play().catch(() => {});
        });
        root.querySelector('[data-a="full"]').onclick = () => { vid.pause(); U.cutIn(d, kind).then(() => vid.play().catch(() => {})); };
        root.querySelector('[data-a="close"]').onclick = () => m.close();
        const un = root.querySelector('[data-a="unlock"]');
        if (un) un.onclick = async () => {
          try { YC.ProfileStore.update((p) => E.unlockUltimate(p, id)); }
          catch (err) { YC.UI.toast(err.message, true); return; }
          YC.UI.toast(`Ultimate desbloqueada: ${d.name}!`);
          if (onChange) onChange();
          root.querySelector('.ult-prev').outerHTML = render();
          wire();
          await U.cutIn(d, 'summon');
        };
      };
      wire();
      return m;
    }
  };

  YC.Ultimate = U;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
