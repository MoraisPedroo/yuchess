/* MatchChain.js — visual da Chain e do fim da partida (acrescenta métodos ao MatchUI):
   cut-in das Lendárias, carta grande a entrar no centro com "Elo N", pilha de elos à direita
   (a resolver / anulado / sem efeito) e o ecrã final com recompensas. */
(function (YC) {
  'use strict';

  const H = () => YC.HoloCard;
  const esc = (s) => YC.HoloCard.esc(s);

  Object.assign(YC.MatchUI.prototype, {
    async cutIn(link) {
      const band = document.createElement('div');
      band.className = 'cutin';
      band.innerHTML = `<div class="cutin-band" style="--c1:${link.def.theme.primary};--c2:${link.def.theme.secondary}"><div class="cutin-art">${YC.CardArt.svg(link.def)}</div><div class="cutin-txt"><small>LENDÁRIA!</small><b>${esc(link.def.name)}</b></div></div>`;
      this.stage.appendChild(band);
      YC.Sound && YC.Sound.play('reveal_legend');
      await YC.FX.fromTo(band.firstChild, { xPercent: -110, skewX: -14 }, { xPercent: 0, duration: 0.35, ease: 'back.out(1.5)' });
      await YC.FX.wait(650);
      await YC.FX.to(band.firstChild, { xPercent: 110, duration: 0.3, ease: 'back.in(1.5)' });
      band.remove();
    },

    async showLink(link, chain, fromRect) {
      this.q('.m-chain').hidden = false;
      this.renderButtons();
      const stage = this.q('.chain-stage');
      const big = H().create(link.inst.id, { size: 'lg', static: true, autoplay: true });
      const label = document.createElement('div');
      label.className = 'link-label';
      label.innerHTML = `<b>Elo ${chain.length}</b> · ${esc(this.nameOf(link.team))} ativa${link.def.kind === 'GRID' ? ' uma armadilha' : ''}`;
      const W = Math.min(250, innerWidth * 0.5), Hh = W * 1.4;
      const to = { left: innerWidth / 2 - W / 2, top: Math.max(10, innerHeight / 2 - Hh / 2 - 30), width: W, height: Hh };
      big.style.setProperty('--cw', `${W}px`);
      big.classList.add('face-down');
      await YC.FX.flyCard(big, fromRect || to, to, { duration: 0.45, arc: 0.2, endScale: 1 });
      big.classList.remove('face-down');
      label.style.left = `${innerWidth / 2}px`;
      label.style.top = `${to.top + Hh + 14}px`;
      stage.appendChild(label);
      YC.FX.fromTo(label, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25 });
      await YC.FX.wait(1000);
      const item = H().create(link.inst.id, { size: 'sm', static: true });
      item.classList.add('chain-item');
      item.dataset.n = chain.length;
      this.q('.chain-list').appendChild(item);
      this.chainEls.set(link.inst.uid, item);
      item.style.visibility = 'hidden';
      label.remove();
      await YC.FX.flyCard(big, to, item.getBoundingClientRect(), { duration: 0.4 });
      big.remove();
      item.style.visibility = '';
      this.attachInspect(item, link.inst.id);
    },

    chainCardRect(link) {
      const el = link && link.inst && this.chainEls.get(link.inst.uid);
      return el ? el.getBoundingClientRect() : null;
    },

    chainState(link, state) {
      const el = this.chainEls.get(link.inst.uid);
      if (el) el.classList.add(`cs-${state}`);
    },

    chainClear() {
      this.chainEls.clear();
      const list = this.q('.chain-list');
      if (list) list.innerHTML = '';
      const panel = this.q('.m-chain');
      if (panel) panel.hidden = true;
    },

    showEnd({ winner, reason }) {
      if (!this.stage || this.endShown) return;
      this.endShown = true;
      const won = winner === this.viewer, draw = winner === 'DRAW';
      const res = this.onGameOver ? this.onGameOver({ winner, reason }) : null;
      const mascot = this.q('.mascot');
      if (won) {
        YC.Sound && YC.Sound.play('victory_fanfare');
        YC.FX.confetti(); setTimeout(() => YC.FX.confetti({ origin: { x: 0.2, y: 0.6 } }), 300); setTimeout(() => YC.FX.confetti({ origin: { x: 0.8, y: 0.6 } }), 500);
        if (mascot) mascot.classList.add('win');
      } else if (!draw) YC.Sound && YC.Sound.play('defeat');
      const title = draw ? 'EMPATE!' : won ? (reason === 'Xeque-mate' ? 'XEQUE-MATE!' : 'VITÓRIA!') : 'DERROTA…';
      const back = document.createElement('div');
      back.className = 'modal-back end-back';
      back.innerHTML = `<div class="modal end-modal ${won ? 'win' : draw ? 'draw' : 'lose'}"><div class="end-title">${title}</div><p class="end-reason">${esc(reason)}${won ? ' — ganhaste!' : draw ? '' : ` — ganharam as ${winner === 'w' ? 'Brancas' : 'Pretas'}.`}</p>
        <div class="end-rewards"></div><div class="row"><button class="btn ghost-dark" data-a="board">Ver tabuleiro</button><button class="btn" data-a="menu">Voltar ao menu</button>${this.onRematch ? '<button class="btn pink" data-a="again">Jogar outra vez</button>' : ''}</div></div>`;
      document.body.appendChild(back);
      Promise.resolve(res).then((r) => {
        const box = back.querySelector('.end-rewards');
        if (!r || !box) return;
        box.innerHTML = `${r.gold ? `<span class="coin-pill gold"><i></i>+${r.gold}</span>` : ''}${r.stardust ? `<span class="coin-pill dust"><i></i>+${r.stardust}</span>` : ''}${r.rating ? `<span class="rating-pill">${esc(r.rating)}</span>` : ''}`;
      });
      back.querySelector('[data-a="menu"]').onclick = () => { back.remove(); this.onExit(); };
      back.querySelector('[data-a="board"]').onclick = () => back.remove();
      const again = back.querySelector('[data-a="again"]');
      if (again) again.onclick = () => { back.remove(); this.onRematch(); };
      YC.FX.fromTo(back.querySelector('.end-title'), { scale: 0.2, rotation: -12 }, { scale: 1, rotation: -4, duration: 0.6, ease: 'elastic.out(1.1, 0.45)' });
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
