/* MatchFound.js — "PARTIDA ENCONTRADA!" da ranqueada com aceitar (docs/RELATORIO-TELAS.md, secção F, ecrã 4): ecrã
   inteiro com o anel a esvaziar (tempo para aceitar), o adversário (nome e rating), ACEITAR e Recusar; depois de
   aceitar fica "À espera do adversário…". Som de impacto e o título do separador a piscar se estiveres noutro
   separador. A lógica (Firestore, tempo, voltar à fila) está no OnlineLobby.found; isto é só o ecrã. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const CIRC = 339.3;   // perímetro do anel (r = 54)

  const MF = {
    /** Pisca "PARTIDA ENCONTRADA!" no título do separador até voltares a ele. */
    blinkTitle() {
      if (!document.hidden) return;
      const t = document.title;
      let on = false;
      const blink = setInterval(() => { on = !on; document.title = on ? 'PARTIDA ENCONTRADA!' : t; }, 600);
      const stop = () => { clearInterval(blink); document.title = t; removeEventListener('focus', stop); };
      addEventListener('focus', stop);
    },

    /** opp: { name, rating }; ms: tempo para aceitar. Devolve { setWaiting(), close() }. */
    show({ opp, ms, onAccept, onDecline }) {
      const g = window.gsap, calm = YC.reducedMotion();
      if (YC.Sound) YC.Sound.play('match_found');
      MF.blinkTitle();
      const el = document.createElement('div');
      el.className = 'mf ask';
      el.innerHTML = `<div class="mf-ring"><svg class="mf-svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54"/><circle class="fill" cx="60" cy="60" r="54"/></svg>${YC.Icon('trophy', { size: 64 })}<b class="mf-sec"></b></div>
        <h2>PARTIDA ENCONTRADA!</h2>
        <small>Ranqueada · contra <b>${esc(opp.name || 'Adversário')}</b> (${opp.rating || '?'} pts)</small>
        <div class="mf-btns"><button class="btn green mf-ok" data-a="ok">Aceitar</button><button class="btn secondary" data-a="no">Recusar</button></div>`;
      document.body.appendChild(el);
      const fill = el.querySelector('.fill'), sec = el.querySelector('.mf-sec'), t0 = Date.now();
      const paint = () => {
        const left = Math.max(0, ms - (Date.now() - t0));
        fill.style.strokeDashoffset = String(CIRC * (1 - left / ms));
        sec.textContent = Math.ceil(left / 1000);
      };
      paint();
      const tick = setInterval(paint, 100);
      if (g && !calm) {
        g.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.18 });
        g.fromTo(el.querySelector('.mf-ring'), { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.32, ease: 'expo.out' });
        g.fromTo(el.querySelectorAll('h2, small, .mf-btns'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.06, delay: 0.1, ease: 'back.out(1.4)' });
      }
      const ctl = {
        setWaiting() {
          const b = el.querySelector('.mf-btns');
          if (b) b.innerHTML = '<p class="mf-wait">Aceitaste. À espera do adversário…</p>';
          el.classList.add('accepted');
        },
        close() {
          clearInterval(tick);
          if (g && !calm) g.to(el, { opacity: 0, duration: 0.18, onComplete: () => el.remove() });
          else el.remove();
        }
      };
      el.querySelector('[data-a="ok"]').onclick = () => { if (YC.Sound) YC.Sound.play('click'); onAccept(); };
      el.querySelector('[data-a="no"]').onclick = () => { if (YC.Sound) YC.Sound.play('click'); onDecline(); };
      return ctl;
    }
  };

  YC.MatchFound = MF;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
