/* Screens.js — ecrãs e modais estilo cartão de cinema mudo: título, "WALLOP!" de abertura com íris,
   janela de resposta da Chain (8 s), seletor de cor do Curinga, cortina Pass-and-Play e "A KNOCKOUT!". */
(function (YC) {
  'use strict';

  const esc = (s) => YC.CardView.escape(s);
  const root = () => document.getElementById('screen-root');
  const modalRoot = () => document.getElementById('modal-root');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function make(cls, html, parent) {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    (parent || root()).appendChild(d);
    return d;
  }

  const TITLE_ARC = `
    <svg class="title-arc" viewBox="0 0 900 300" aria-label="Chess-Oh! Uno-Head">
      <defs><path id="arcTop" d="M30,262 Q450,0 870,262"/><path id="arcSub" d="M170,285 Q450,150 730,285"/></defs>
      <text class="t-main"><textPath href="#arcTop" startOffset="50%" text-anchor="middle">CHESS-OH! UNO-HEAD</textPath></text>
      <text class="t-sub"><textPath href="#arcSub" startOffset="50%" text-anchor="middle">IN DON'T DEAL WITH THE PAWN</textPath></text>
    </svg>`;

  const RULES = `
    <h2>Como jogar</h2>
    <div class="rules-grid">
      <section><h3>1 · Carta Uno → permissão</h3>
        <p>No teu turno joga <b>uma</b> carta que combine com a pilha central (mesma <b>cor</b> ou mesmo <b>valor</b>; Curingas combinam sempre). A carta decide que peças podem mover:</p>
        <ul><li><b>1–3</b>: Peão, Cavalo, Bispo · +10×valor ESC temporário</li>
        <li><b>4–6</b>: + Torre · +10×valor ATK neste turno</li>
        <li><b>7–9 / Curinga</b>: qualquer peça · +25% ATK e perfura escudo</li>
        <li><b>0</b>: Roque, troca de 2 aliadas adjacentes, ou Peão</li>
        <li><b>⊘ Bloqueio</b>: Peão/Cavalo e congela 1 inimiga · <b>⇄ Inversão</b>: Bispo/Torre e troca ATK↔ESC de um alvo · <b>+2</b>: Peão, compras 2, o oponente perde 1</li></ul>
        <p>A cor dá um bónus à peça que mexeres: <span class="cR">Vermelho +20 ATK</span>, <span class="cB">Azul +25 ESC</span>, <span class="cG">Verde +30 HP</span>, <span class="cY">Amarelo +1 passo extra</span>.</p>
        <p>Sem carta que sirva? <b>Compra de emergência</b>: compras 1 e só podes mover um Peão.</p></section>
      <section><h3>2 · Combate RPG</h3>
        <p>Atacar não captura logo: o dano gasta primeiro o <b>Escudo</b>, depois o <b>HP</b>. Se o defensor sobreviver, contra-ataca com 50% do seu ATK e o atacante faz <b>BOING!</b> para a casa anterior.</p>
        <p>Ganha quem deixar o <b>Rei</b> adversário a 0 HP. A partir do turno 60 há <b>Morte Súbita</b>: os Reis perdem HP a cada turno.</p>
        <p>Peões que chegam ao fim viram Dama. A Dama pode usar a <b>Soberania</b> uma vez por partida.</p></section>
      <section><h3>3 · Chain, armadilhas e Parry</h3>
        <p>Jogar uma carta ou declarar um movimento abre uma <b>Chain</b>. O adversário pode responder com Feitiços Rápidos (SS2) ou Contra-Armadilhas (SS3); a pilha resolve do último elo para o primeiro. Só SS3 responde a SS3.</p>
        <p>Por turno podes ainda <b>esconder 1 carta</b>: Armadilha Espacial numa casa vazia (filas 1–6 para ti) ou carta virada no Suporte (3 espaços). Cartas escondidas só ativam a partir do turno seguinte.</p>
        <p>Quando uma peça inimiga pisa a tua armadilha, o movimento pára ali. Se puseres uma armadilha onde já havia uma inimiga: <b>CLANG!</b>, ambas destruídas.</p></section>
    </div>`;

  const Screens = {
    wait,

    title({ onStart, onRules }) {
      const node = make('screen title-screen', `
        <div class="curtain-l"></div><div class="curtain-r"></div>
        <div class="title-card">
          <div class="marquee-bulbs"></div>
          ${TITLE_ARC}
          <p class="title-tag">Speed Duel com peças de xadrez, pilha Uno e Chain — um desenho animado de 1930 feito só com código</p>
          <div class="title-buttons">
            <button class="btn-big" data-mode="DUEL">INSERT COIN · SPEED DUEL</button>
            <button class="btn-big gold" data-mode="ONLINE">ONLINE · RANQUEADA E SALAS</button>
            <div class="title-classic"><span>Xadrez clássico 8×8:</span><button class="btn-link" data-mode="AI">vs King Dice</button><button class="btn-link" data-mode="HOTSEAT">2 jogadores</button></div>
            <button class="btn-link" data-rules>Como jogar</button>
          </div>
          <p class="title-foot">Som e música são gerados ao vivo · clica para começar</p>
        </div>`);
      node.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => onStart(b.dataset.mode, node)));
      node.querySelector('[data-rules]').addEventListener('click', () => onRules());
      return node;
    },

    /** Íris circular preta clássica: fecha (close=true) ou abre a cena. */
    async iris(close) {
      const ir = make('iris', '<div class="iris-hole"></div>');
      const hole = ir.firstChild;
      const big = '260vmax', small = '0px';
      await hole.animate([{ width: close ? big : small, height: close ? big : small }, { width: close ? small : big, height: close ? small : big }],
        { duration: 650, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' }).finished.catch(() => {});
      if (!close) ir.remove();
      return ir;
    },

    async intro(audio) {
      const node = make('screen intro-card', `<div class="intro-inner">
        <div class="intro-top">A GREAT SLAM</div><div class="intro-mid">AND THEN SOME!</div><div class="intro-wallop">WALLOP!</div></div>`);
      audio.playFanfareShort();
      await wait(1100);
      audio.playAnvilHit();
      node.classList.add('slam');
      await wait(1000);
      const ir = await Screens.iris(true);
      node.remove();
      ir.remove();
      await Screens.iris(false);
    },

    rules() {
      const m = make('modal rules-modal', `<div class="modal-card wide">${RULES}<div class="modal-actions"><button class="btn-big">Entendido!</button></div></div>`, modalRoot());
      const close = () => m.remove();
      m.querySelector('button').addEventListener('click', close);
      m.addEventListener('click', (e) => { if (e.target === m) close(); });
    },

    curtain(title, sub) {
      return new Promise((resolve) => {
        const m = make('modal curtain-modal', `<div class="modal-card"><h2>${esc(title)}</h2><p>${esc(sub)}</p>
          <div class="modal-actions"><button class="btn-big">Estou pronto</button></div></div>`, modalRoot());
        m.querySelector('button').addEventListener('click', () => { m.remove(); resolve(); });
      });
    },

    colorPicker(audio) {
      return new Promise((resolve) => {
        const names = YC.CardDatabase.COLOR_NAME;
        const m = make('modal color-modal', `<div class="modal-card"><h2>Curinga! Escolhe a nova cor</h2>
          <div class="color-grid">${['R', 'B', 'G', 'Y'].map((c) => `<button class="color-btn c-${c}" data-c="${c}">${names[c]}</button>`).join('')}</div>
          <div class="modal-actions"><button class="btn-link" data-cancel>Cancelar</button></div></div>`, modalRoot());
        m.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { audio.playClick(); m.remove(); resolve(b.dataset.c); }));
        m.querySelector('[data-cancel]').addEventListener('click', () => { m.remove(); resolve(null); });
      });
    },

    /** Janela de resposta da Chain com temporizador visual de 8 s (pausa com o rato por cima). */
    chainWindow({ game, team, options, stack, top, seconds = 8, audio, renderCard, optionLabel }) {
      return new Promise((resolve) => {
        const label = (l) => `<li class="cl owner-${l.owner.toLowerCase()}"><b>CL${l.index}</b> ${esc(l.label)} <i>SS${l.ss}</i></li>`;
        const m = make('modal chain-modal', `<div class="modal-card">
          <div class="chain-head"><span class="chain-tag">CHAIN WINDOW</span><h2>Ativar resposta?</h2></div>
          <p class="chain-top">${esc(game.teamName(top.owner))}: <b>${esc(top.label)}</b> (SS${top.ss})</p>
          <ol class="chain-mini">${stack.map(label).join('')}</ol>
          <div class="chain-options"></div>
          <div class="timer"><i></i></div>
          <div class="modal-actions"><button class="btn-big alt" data-pass>Passar</button></div></div>`, modalRoot());
        const box = m.querySelector('.chain-options');
        options.forEach((o) => {
          const wrap = document.createElement('div');
          wrap.className = 'chain-option';
          wrap.appendChild(renderCard ? renderCard(o) : YC.CardView.create(o.card));
          const b = document.createElement('button');
          b.className = 'btn-big';
          b.textContent = optionLabel ? optionLabel(o) : `Ativar (${o.from === 'HAND' ? 'da mão' : 'do Suporte'})`;
          b.addEventListener('click', () => done(o.id || o.card.uid));
          wrap.appendChild(b);
          box.appendChild(wrap);
        });
        let left = seconds * 1000, paused = false, last = performance.now(), raf = 0, lastSec = seconds;
        const bar = m.querySelector('.timer i');
        const tick = (now) => {
          if (!paused) left -= now - last;
          last = now;
          bar.style.width = `${Math.max(0, left / (seconds * 10))}%`;
          const sec = Math.ceil(left / 1000);
          if (sec < lastSec && sec <= 3 && audio) audio.playTick();
          lastSec = sec;
          if (left <= 0) return done(null);
          raf = requestAnimationFrame(tick);
        };
        const card = m.querySelector('.modal-card');
        card.addEventListener('mouseenter', () => { paused = true; m.classList.add('paused'); });
        card.addEventListener('mouseleave', () => { paused = false; m.classList.remove('paused'); });
        let finished = false;
        function done(uid) {
          if (finished) return;
          finished = true;
          cancelAnimationFrame(raf);
          m.remove();
          if (Screens.closeChainWindow === forceClose) Screens.closeChainWindow = () => {};
          resolve(uid);
        }
        const forceClose = () => done(null);
        Screens.closeChainWindow = forceClose;
        m.querySelector('[data-pass]').addEventListener('click', () => done(null));
        raf = requestAnimationFrame(tick);
      });
    },

    /** Fecha a janela da Chain aberta (ex.: o adversário desistiu enquanto pensavas). */
    closeChainWindow() {},

    async banner(text, kind = '', ms = 900) {
      const b = make(`turn-banner ${kind}`, `<span>${esc(text)}</span>`);
      await wait(ms);
      b.classList.add('out');
      setTimeout(() => b.remove(), 350);
    },

    /** Ecrã final. `rows`/`rank`/`coins` permitem ao Speed Duel mostrar as suas próprias estatísticas. */
    knockout({ winner, viewerWon, stats, game, rating, rows, rank: givenRank, coins }) {
      return new Promise((resolve) => {
        const s = stats.WHITE, o = stats.BLACK;
        const draw = winner === 'DRAW';
        const mine = game.localTeam || (game.mode === 'AI' ? 'WHITE' : winner === 'DRAW' ? 'WHITE' : winner);
        let rank = givenRank;
        if (!rank) {
          const ms = stats[mine];
          const king = game.board.king(mine);
          const kingPct = king ? king.hp / king.maxHp : 0;
          const score = (viewerWon ? 50 : 0) + ms.kills * 4 + ms.trapsActivated * 5 + ms.parries * 6 + Math.round(kingPct * 20) - Math.max(0, game.state.turnCount - 40) * 0.4;
          rank = draw ? 'C' : score >= 95 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D';
        }
        const head = draw ? 'EMPATE!' : 'A KNOCKOUT!';
        const sub = draw ? 'O projecionista adormeceu…'
          : game.mode === 'AI' ? (viewerWon ? `Venceste o ${game.teamName('BLACK')}!` : `O ${game.teamName('BLACK')} levou a melhor…`)
          : game.mode === 'ONLINE' ? (viewerWon ? `Venceste ${game.teamName(YC.other(mine))}!` : `${game.teamName(winner)} levou a melhor…`)
          : `Vitória das ${game.teamName(winner)}!`;
        const row = (k, a, b) => `<tr><td>${k}</td><td>${a}</td><td>${b}</td></tr>`;
        const m = make('screen knockout', `<div class="ko-word">${head}</div>
          <div class="ko-card"><h2>${esc(sub)}</h2>
            <table><thead><tr><th></th><th>${esc(game.teamName('WHITE'))}</th><th>${esc(game.teamName('BLACK'))}</th></tr></thead><tbody>
            ${rows ? rows.map((r) => row(...r)).join('') : `${row('Turnos jogados', game.state.turnCount, '')}
            ${row('Peças derrubadas', s.kills, o.kills)}
            ${row('Armadilhas ativadas', s.trapsActivated, o.trapsActivated)}
            ${row('Parries / anulações (SS3)', s.parries, o.parries)}
            ${row('Dano total', s.damage, o.damage)}`}
            </tbody></table>
            ${coins ? `<div class="coin-line">+${coins} 🪙 Moedas de Tinta</div>` : ''}
            <div class="rank">Nota final: <b class="rank-${rank}">${rank}-RANK</b></div>
            ${rating ? '<div class="rating-line">A acertar o rating…</div>' : ''}
            <div class="modal-actions"><button class="btn-big" data-again>Jogar de novo</button><button class="btn-big alt" data-menu>Menu</button></div>
          </div>`);
        if (rating) {
          const line = m.querySelector('.rating-line');
          rating.then((r) => {
            if (!r) { line.textContent = 'Partida sem rating.'; return; }
            if (r.delta == null) {
              line.textContent = r.error ? `Rating: ${r.error}`
                : r.conflict ? 'Os resultados dos dois lados não coincidem: rating não alterado.'
                : 'Rating por confirmar: fica pendente até o adversário confirmar ou abandonar.';
              return;
            }
            const sign = r.delta > 0 ? '+' : '';
            line.innerHTML = `Rating: ${r.before} → <b>${r.before + r.delta}</b> (${sign}${r.delta})`;
            line.classList.add(r.delta >= 0 ? 'up' : 'down');
          }).catch((err) => { line.textContent = `Rating: ${err.message || err}`; });
        }
        m.querySelector('[data-again]').addEventListener('click', () => { m.remove(); resolve('again'); });
        m.querySelector('[data-menu]').addEventListener('click', () => { m.remove(); resolve('menu'); });
      });
    }
  };

  YC.Screens = Screens;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
