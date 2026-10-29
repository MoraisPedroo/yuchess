/* Ultimates.js — animações Ultimate de Lendárias: personagens de anime originais (arte e vídeos feitos no Gemini, em
   assets/ultimate/<icone>/: hero.png recortada, summon.mp4 e strike.mp4). Só visual: o motor não sabe que existem.
   Desbloqueio com ouro nos Baralhos (Economy.unlockUltimate). Numa partida, match.ults = { w: [...], b: [...] } diz o
   que cada jogador desbloqueou (no online as do adversário chegam nas mensagens dele — LockstepSession): se um dos
   dois a desbloqueou, a Ultimate vale para QUALQUER peça com essa carta (a de quem a roubar com o Íman também) e
   os dois jogadores veem tudo.
   • Akane (Cetro, ataque): invocar → cut-in + a peça vira a Akane; ao capturar → cut-in do golpe e uma bola de
     energia sai dela e explode na peça inimiga.
   • Kaito (Escudo Tático, guarda): invocar → cut-in + uma corrente de energia leva uma barreira de hexágonos ao Rei,
     que fica no campo enquanto o Escudo dele aguentar (Board3DUltimate); quando o atacam → cut-in dele a defender.
   Toque/clique salta o cut-in. Nos Baralhos: pré-visualização (os dois vídeos) e o botão de desbloquear. */
(function (YC) {
  'use strict';

  const G = () => window.gsap;
  const S = (n) => YC.Sound && YC.Sound.play(n);
  const esc = (s) => YC.HoloCard.esc(s);
  const calm = () => YC.reducedMotion && YC.reducedMotion();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const DEFS = {
    eq_cetro_usurpador: {
      id: 'eq_cetro_usurpador', icon: 'royal_scepter', name: 'Akane', title: 'A Rainha Rubi', role: 'attack', c1: '#D90429', c2: '#FFB703',
      say: { summon: 'Esta coroa agora é minha!', strike: 'Ajoelha-te perante a rainha!' }, ms: { summon: 4800, strike: 4000 }, hit: 0.68,
      tabs: { summon: 'Invocação', strike: 'Golpe' },
      about: [['Invocar', 'ao equipares o Cetro, entra um vídeo especial e o Peão transforma-se na Akane.'],
        ['No tabuleiro', 'a peça passa a ser a própria Akane.'],
        ['Golpe', 'sempre que ela captura, entra o vídeo do golpe e uma bola de energia sai dela e explode na peça inimiga.']]
    },
    eq_escudo_choque: {
      id: 'eq_escudo_choque', icon: 'escudo_antitumulto', name: 'Kaito', title: 'O Guardião Azul', role: 'guard', c1: '#0077B6', c2: '#48CAE4',
      say: { summon: 'Ninguém toca no meu Rei!', strike: 'Barreira total!' }, ms: { summon: 4600, strike: 3600 }, hit: 0.5,
      tabs: { summon: 'Invocação', strike: 'Defesa' },
      about: [['Invocar', 'ao equipares o Escudo, entra um vídeo especial, a peça transforma-se no Kaito e lança uma barreira de hexágonos sobre o teu Rei.'],
        ['No tabuleiro', 'enquanto o Escudo dele aguentar, o Rei fica dentro da barreira (não pode levar xeque com lances).'],
        ['Defesa', 'quando o atacam, entra o vídeo dele a defender; se o Escudo partir, a barreira do Rei estilhaça.']]
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
    /** A Ultimate desta carta está ativa na partida (algum dos dois jogadores a desbloqueou)? */
    active(m, id) { const u = m && m.ults; return !!(DEFS[id] && u && ((u.w || []).includes(id) || (u.b || []).includes(id))); },
    /** A Ultimate ativa numa peça (de qualquer cor), ou null. */
    forPiece(piece, m) {
      if (!piece || !m || U.hold.has(piece.id)) return null;
      const id = piece.equips.find((e) => U.active(m, e));
      return id ? DEFS[id] : null;
    },

    /** O Rei desta cor está dentro da barreira de um guardião (peça dele com Ultimate de guarda e Escudo ativo)? */
    wardFor(m, color) {
      if (!m || !m.pos) return false;
      return m.pos.board.some((q) => q && q.color === color && q.shield && !U.hold.has(q.id)
        && q.equips.some((e) => DEFS[e] && DEFS[e].role === 'guard' && U.active(m, e)));
    },

    /** Fita "ULTIMATE" na carta (mão, coleção). locked: apagada com cadeado (ainda por desbloquear). */
    decorate(el, id, { locked = false } = {}) {
      if (!DEFS[id] || el.querySelector('.ult-ribbon')) return;
      if (!locked && !U.unlocked(id)) return;
      el.classList.add(locked ? 'ult-locked' : 'ult-on');
      el.insertAdjacentHTML('beforeend', `<span class="ult-ribbon">${YC.Icon(locked ? 'lock' : 'star', { size: 12 })}ULTIMATE</span>`);
    },

    // ───────────── cut-in em ecrã inteiro ─────────────
    /** kind: 'summon' (invocação) | 'strike' (golpe/defesa). Resolve quando acaba (ou quando se toca para saltar). */
    cutIn(d, kind = 'summon') {
      return new Promise((done) => {
        const g = G(), quiet = calm(), fast = YC.FX && YC.FX.speed > YC.FX.NORMAL;
        const el = document.createElement('div');
        el.className = `ult-cut k-${kind} r-${d.role}`;
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
        S(kind === 'strike' ? (d.role === 'guard' ? 'shield_clang' : 'sword_draw') : 'reveal_legend');
        if (g && !quiet) {
          g.fromTo(el.querySelector('.ult-veil'), { opacity: 0 }, { opacity: 1, duration: 0.2 });
          g.fromTo(band, { scaleY: 0 }, { scaleY: 1, duration: 0.32, ease: 'back.out(1.6)' });
          g.fromTo(title, { x: -120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, delay: 0.18, ease: 'back.out(1.8)' });
          if (kind === 'strike') {
            const at = (ms * (d.hit || 0.55)) / 1000;
            g.fromTo(el.querySelector('.ult-slash'), { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.18, delay: at, ease: 'expo.out', onStart: () => S(d.role === 'guard' ? 'glass' : 'explosion_bam') });
            g.to(el.querySelector('.ult-slash'), { opacity: 0, duration: 0.3, delay: at + 0.3 });
            g.fromTo(el.querySelector('.ult-flash'), { opacity: 0.85 }, { opacity: 0, duration: 0.45, delay: at, immediateRender: false });
            g.fromTo(band, { x: -8 }, { x: 8, duration: 0.04, repeat: 7, yoyo: true, delay: at, ease: 'none', onComplete: () => g.set(band, { x: 0 }) });
          } else {
            setTimeout(() => S('magic_zap'), (ms * 0.4));
          }
        }
      });
    },

    // ───────────── no tabuleiro ─────────────
    /** Energia que voa de uma casa para outra (bola com rasto) e explode na chegada. */
    async bolt(an, from, to, d, { impact = true, text = 'BAM!' } = {}) {
      const b = an.board, THREE = window.THREE, g = G();
      if (b.is3D && an.w3 && THREE && g && !calm()) {
        const A = an.w3(from), B = an.w3(to), h1 = new THREE.Color(d.c1).getHex(), h2 = new THREE.Color(d.c2).getHex();
        b.fxInit();
        const orb = b.sprite(h2, 0.95), core = b.sprite(0xffffff, 0.45);
        orb.position.set(A.x, 1.15, A.z); core.position.copy(orb.position);
        b.fxGroup.add(orb); b.fxGroup.add(core);
        b.lightFlash(A.x, 1.2, A.z, h2, 5, 0.4);
        b.sparks(A.x, 1.15, A.z, h2, { n: 12, speed: 2 });
        S('magic_zap');
        const o = { t: 0 }, len = Math.hypot(B.x - A.x, B.z - A.z);
        await new Promise((r) => g.to(o, { t: 1, duration: 0.3 + len * 0.05, ease: 'power1.in', onComplete: r, onUpdate: () => {
          const x = A.x + (B.x - A.x) * o.t, z = A.z + (B.z - A.z) * o.t, y = 1.15 + Math.sin(Math.PI * o.t) * (0.4 + len * 0.08) - o.t * 0.6;
          orb.position.set(x, y, z); core.position.set(x, y, z);
          b.trail(x, y, z, o.t % 0.2 < 0.1 ? h1 : h2);
        } }));
        b.fxGroup.remove(orb); b.fxGroup.remove(core); orb.material.dispose(); core.material.dispose();
        if (impact) {
          b.sparks(B.x, 0.6, B.z, h1, { n: 34, speed: 3.4 });
          b.sparks(B.x, 0.6, B.z, h2, { n: 20, speed: 2.6 });
          b.burst(B.x, 0.8, B.z, 'IMPACT', { size: 1.6 });
          if (text) b.text3D(B.x, 1.5, B.z, text, d.c2, 1);
          b.lightFlash(B.x, 1, B.z, h1, 7, 0.6);
          b.shakeCam(0.16, 0.35);
          S('explosion_bam');
          await wait(280);
        }
      } else {
        await YC.FX.lightning(b.rect(from), b.rect(to), d.c2);
        if (impact) {
          const [x, y] = an.xy(to);
          YC.FX.particles(b.fx, x, y, { n: 18, colors: [d.c1, d.c2, '#fff'], shape: 'star' });
          await YC.FX.burst(b.fx, x, y, text || '!', { fill: d.c1 });
        }
      }
    },

    /** Depois do cut-in de invocação: a figura aparece com brilho e, no Kaito, a barreira vai até ao Rei. */
    async revealAt(an, piece, d) {
      const m = an.ui.match, sq = m.sqOf(piece), b = an.board;
      an.sync();
      S('reveal_epic');
      try {
        if (b.is3D && an.w3) {
          const w = an.w3(sq), h2 = new window.THREE.Color(d.c2).getHex();
          if (an.beam) an.beam(sq, h2, 4);
          b.sparks(w.x, 0.8, w.z, h2, { n: 30, speed: 2.4 });
          b.text3D(w.x, 1.9, w.z, d.name.toUpperCase(), d.c2, 1);
          const fig = b.el(piece.id) && b.el(piece.id).getObjectByName('ultFigure');
          if (fig && G()) await G().fromTo(fig.scale, { x: 0.01, y: 0.01 }, { x: fig.scale.x, y: fig.scale.y, duration: 0.6, ease: 'back.out(2)' });
        } else {
          const [x, y] = an.xy(sq);
          YC.FX.ring(b.fx, x, y, d.c2, 0.4);
          YC.FX.particles(b.fx, x, y, { n: 24, colors: [d.c1, d.c2, '#fff'], shape: 'star' });
          await wait(400);
        }
        if (d.role === 'guard' && piece.shield) {
          const k = YC.Chess.kingSquare(m.pos, piece.color);
          if (k >= 0) { await U.bolt(an, sq, k, d, { text: 'REI PROTEGIDO!' }); an.sync(); }
        }
      } catch (err) { console.warn('[ultimate]', err); }
    },

    // ───────────── ligações ao MatchAnimator ─────────────
    /** Equipar: animação normal, cut-in de invocação e a peça transforma-se. */
    async onEquip(an, p) {
      const id = p.card && p.card.id, d = U.active(an.ui.match, id) ? DEFS[id] : null;
      if (!d) return an.equipAttach(p);
      U.hold.add(p.piece.id);
      try { await an.equipAttach(p); await U.cutIn(d, 'summon'); } finally { U.hold.delete(p.piece.id); }
      await U.revealAt(an, p.piece, d);
    },

    /** Íman: a carta muda de dono e a peça de quem a roubou também se transforma. */
    async onSteal(an, p) {
      const m = an.ui.match, d = U.active(m, p.id) ? DEFS[p.id] : null, thief = m.pieceAt(p.to);
      if (!d || !thief) return an.equipSteal(p.from, p.to);
      U.hold.add(thief.id);
      try { await an.equipSteal(p.from, p.to); await U.cutIn(d, 'summon'); } finally { U.hold.delete(thief.id); }
      await U.revealAt(an, thief, d);
    },

    /** Captura declarada: a Akane ataca com o golpe; o Kaito, se é o alvo e ainda tem Escudo, defende
        (Akane contra Kaito: primeiro o golpe dela, depois a defesa dele). */
    async onCapture(an, p) {
      const m = an.ui.match, att = U.forPiece(p.attacker, m), def = U.forPiece(p.target, m);
      if (att && att.role === 'attack') {
        await U.cutIn(att, 'strike');
        await U.bolt(an, p.from, p.targetSq != null ? p.targetSq : p.to, att, { text: def && def.role === 'guard' && p.target.shield ? '' : 'BAM!' });
      }
      if (def && def.role === 'guard' && p.target.shield) await U.cutIn(def, 'strike');
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
            <ul>${d.about.map(([k, t]) => `<li><b>${esc(k)}:</b> ${esc(t)}</li>`).join('')}
              <li class="muted">Só visual: não muda as regras. Os dois jogadores veem a animação.</li></ul>
            <div class="ult-tabs"><button class="chip on" data-v="summon">${esc(d.tabs.summon)}</button><button class="chip dark" data-v="strike">${esc(d.tabs.strike)}</button><button class="chip dark" data-a="full">${YC.Icon('play', { size: 14 })}Ecrã inteiro</button></div>
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
