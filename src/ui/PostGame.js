/* PostGame.js — fim de partida cinematográfico (docs/RELATORIO-TELAS.md, secção F, ecrã 6): o ecrã escurece por
   cima do tabuleiro, a personagem em destaque do jogador entra de lado (apagada na derrota), o brasão VITÓRIA /
   DERROTA / EMPATE cai com impacto, aparecem as estatísticas da partida (turnos, capturas, cartas jogadas) e as
   recompensas sobem a contar (ouro, poeira; Elo no online), com confetes na vitória. Botões: ver o tabuleiro,
   voltar ao menu e jogar outra vez. Chamado pelo MatchChain.showEnd; só visual. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const I = (n, o) => YC.Icon(n, o);

  const PG = {
    /** ui: o MatchUI; res: recompensas (ou Promise) do onGameOver. */
    show(ui, { winner, reason, res }) {
      const g = window.gsap, calm = YC.reducedMotion();
      const won = winner === ui.viewer, draw = winner === 'DRAW', kind = draw ? 'draw' : won ? 'win' : 'lose';
      const m = ui.match, me = ui.viewer, st = (m.players[me] || {}).stats || {}, turns = (m.state.ownTurns || {})[me] || 0;
      const fav = YC.ArenaHero && YC.ArenaHero.current();
      const title = draw ? 'EMPATE' : won ? 'VITÓRIA' : 'DERROTA';
      const sub = `${esc(reason)}${won ? ' — ganhaste!' : draw ? '' : ` — ganharam as ${winner === 'w' ? 'Brancas' : 'Pretas'}.`}`;
      const el = document.createElement('div');
      el.className = `pg ${kind}`;
      el.innerHTML = `<div class="pg-shade"></div>
        <div class="pg-hero">${fav ? `<img src="${YC.Ultimate.hero(fav.d)}" alt="">` : ''}</div>
        <div class="pg-main">
          <div class="pg-crest"><div class="pg-badge">${I(won ? 'crown' : draw ? 'shield' : 'flag', { size: 58 })}</div><h1>${title}</h1></div>
          <p class="pg-reason">${sub}</p>
          <div class="pg-stats"><span><b>${turns}</b><small>turnos</small></span><span><b>${st.captures || 0}</b><small>capturas</small></span><span><b>${st.cards || 0}</b><small>cartas jogadas</small></span></div>
          <div class="pg-rewards"></div>
          <div class="pg-btns"><button class="btn secondary" data-a="board">Ver tabuleiro</button><button class="btn secondary" data-a="menu">Voltar ao menu</button>${ui.onRematch ? '<button class="btn" data-a="again">Jogar outra vez</button>' : ''}</div>
        </div>`;
      document.body.appendChild(el);
      const close = () => el.remove();
      el.querySelector('[data-a="menu"]').onclick = () => { close(); ui.onExit(); };
      el.querySelector('[data-a="board"]').onclick = close;
      const again = el.querySelector('[data-a="again"]');
      if (again) again.onclick = () => { close(); ui.onRematch(); };

      // som e confetes
      const S = (n) => YC.Sound && YC.Sound.play(n);
      if (won) {
        S('fanfare');
        if (!calm && YC.FX.confetti) { setTimeout(() => YC.FX.confetti(), 450); setTimeout(() => YC.FX.confetti({ origin: { x: 0.2, y: 0.6 } }), 700); setTimeout(() => YC.FX.confetti({ origin: { x: 0.8, y: 0.6 } }), 900); }
      } else if (!draw) S('defeat');
      else S('vs_slam');

      if (g && !calm) {
        g.fromTo(el.querySelector('.pg-shade'), { opacity: 0 }, { opacity: 1, duration: 0.35 });
        g.fromTo(el.querySelector('.pg-crest'), { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.7)', delay: 0.1 });
        g.fromTo(el.querySelector('.pg-hero'), { x: -120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out', delay: 0.3 });
        g.fromTo(el.querySelectorAll('.pg-reason, .pg-stats, .pg-btns'), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.08, delay: 0.5, ease: 'power3.out' });
      }

      // recompensas a contar
      Promise.resolve(res).then((r) => {
        const box = el.querySelector('.pg-rewards');
        if (!r || !box || !el.isConnected) return;
        const pills = [];
        if (r.gold) pills.push(['gold', 'coin', r.gold]);
        if (r.stardust) pills.push(['dust', 'dust', r.stardust]);
        box.innerHTML = pills.map(([k, ic]) => `<span class="pg-pill ${k}">${I(ic, { size: 26 })}<b>+0</b></span>`).join('') + (r.rating ? `<span class="pg-rating">${esc(r.rating)}</span>` : '');
        box.querySelectorAll('.pg-pill b').forEach((b, i) => {
          const target = pills[i][2];
          if (!g || calm) { b.textContent = `+${target}`; return; }
          const o = { v: 0 };
          let last = 0;
          g.to(o, { v: target, duration: 1.1, delay: 0.75 + i * 0.25, ease: 'power2.out', onUpdate: () => {
            const n = Math.round(o.v);
            b.textContent = `+${n}`;
            if (n - last >= Math.max(1, Math.round(target / 12))) { last = n; S('tick'); }
          } });
        });
        if (g && !calm) g.fromTo(box.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.12, delay: 0.7, ease: 'back.out(1.6)' });
      });
    }
  };

  YC.PostGame = PG;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
