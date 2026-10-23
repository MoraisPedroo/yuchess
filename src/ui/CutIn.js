/* CutIn.js — animação estilo Duel Links quando entra em jogo uma carta Lendária ou Ultra-Rara:
   ecrã escurece, linhas de velocidade, faixa diagonal com o retrato rubber hose do duelista,
   balão de fala, nome em letras douradas/prismáticas e a carta a cair com impacto. */
(function (YC) {
  'use strict';

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function speedLines(n = 26) {
    let lines = '';
    for (let i = 0; i < n; i++) {
      const y = Math.round(Math.random() * 100), len = 20 + Math.random() * 50, d = (Math.random() * 0.4).toFixed(2);
      lines += `<line x1="${-len}" y1="${y}" x2="0" y2="${y}" style="animation-delay:${d}s" stroke-width="${(0.3 + Math.random() * 0.9).toFixed(2)}"/>`;
    }
    return `<svg class="cutin-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>`;
  }

  /**
   * @param {object} o { card, side: 'me'|'foe', portrait: {type, team}, audio, vfx, animator, speed }
   */
  async function play(o) {
    const { card, side, audio, vfx, animator } = o;
    const speed = o.speed || 1;
    const ur = card.rarity === 'UR';
    const root = document.getElementById('screen-root');
    const node = document.createElement('div');
    node.className = `cutin ${side} r-${card.rarity}`;
    node.innerHTML = `${speedLines()}
      <div class="cutin-band"><div class="cutin-portrait"></div>
        <div class="cutin-bubble">${YC.DuelCardView.esc(card.shout || 'HORA DO SHOW!')}</div></div>
      <div class="cutin-title"><small>${ur ? 'ULTRA-RARA' : 'LENDÁRIA'}</small>${YC.DuelCardView.esc(card.name)}</div>
      <div class="cutin-card"></div>`;
    const rig = YC.PieceFactory.createPieceSVG(o.portrait.type, o.portrait.team, { boil: true });
    rig.excited = 1;
    node.querySelector('.cutin-portrait').appendChild(rig.svg);
    animator.add(rig);
    node.querySelector('.cutin-card').appendChild(YC.DuelCardView.create(card, { side: o.portrait.team }));
    root.appendChild(node);
    audio.playBrassParryFanfare();
    await wait(520 * speed);
    node.classList.add('drop');
    audio.playAnvilHit();
    vfx.triggerScreenShake(ur ? 16 : 9, ur ? 520 : 320);
    if (ur) {
      node.classList.add('lightning');
      vfx.impact = 1;
      const r = node.querySelector('.cutin-card').getBoundingClientRect();
      vfx.spawnCartoonExplosion(r.left + r.width / 2, r.bottom - 10, '#ffd76a', 'WALLOP!');
      audio.playExplosion();
    }
    await wait((ur ? 1180 : 700) * speed);
    node.classList.add('out');
    await wait(260);
    animator.remove(rig);
    node.remove();
  }

  YC.CutIn = { play };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
