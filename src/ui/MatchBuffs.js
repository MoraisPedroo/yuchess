/* MatchBuffs.js — efeitos ativos ao lado da foto de cada jogador (acrescenta métodos ao MatchUI; chamado no renderHUD):
   os Equipamentos que ele tem em campo (vermelho = proíbe-te alguma coisa, ex. o Escudo Tático que não deixa dar
   xeque; laranja = castiga quem o captura; azul = vantagem dele), os estados das peças dele (congelada, equipamentos
   desligados, sem captura, presa) e as ações de carta a mais/a menos no próximo turno. Passar o rato (ou tocar)
   mostra onde está, o que faz e o que te impede de fazer. Só lê o estado; nada disto muda a partida. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const sqN = (sq) => YC.Chess.sqName(sq).toUpperCase();
  // o que cada Equipamento faz a quem joga CONTRA ele: [tipo, frase para o adversário, frase para o dono]
  const AGAINST = {
    eq_escudo_choque: ['forbid', 'Não podes dar xeque ao Rei dele com lances enquanto esta peça tiver Escudo.', 'O adversário não pode dar xeque ao teu Rei com lances enquanto esta peça tiver Escudo.'],
    eq_balanca_justica: ['forbid', 'Só tens 1 ação de carta por turno enquanto esta peça estiver em jogo.', 'O adversário só tem 1 ação de carta por turno.'],
    eq_capa_magnetica: ['forbid', 'Os teus Peões não podem capturar esta peça.', 'Os Peões inimigos não a podem capturar.'],
    eq_colete_balas: ['forbid', 'Os teus Peões não podem capturar esta peça.', 'Os Peões inimigos não a podem capturar.'],
    eq_chassi_reforcado: ['forbid', 'Esta peça não ativa as tuas Armadilhas de Casa.', 'Não ativa as Armadilhas de Casa do adversário.'],
    eq_armadura_espinhos: ['punish', 'Se a capturares, a tua peça atacante é destruída com ela.', 'Quem a capturar é destruído com ela.'],
    eq_tubo_ensaio_toxico: ['punish', 'Se o capturares, a tua peça atacante é destruída com ele.', 'Quem o capturar é destruído com ele.'],
    eq_cubo_armadura: ['punish', 'Quando o Escudo dela estilhaça, a tua peça atacante fica congelada.', 'Quem lhe partir o Escudo fica congelado.']
  };
  const STATUS = [
    ['frozen', 'snow', 'Congelad', 'Não se pode mexer'],
    ['silenced', 'no', 'Desligad', 'Os equipamentos dela não funcionam'],
    ['noCap', 'no', 'Sem captura', 'Não pode capturar nem dar xeque'],
    ['untargetable', 'lock', 'Presa', 'Não pode ser alvo de cartas']
  ];

  Object.assign(YC.MatchUI.prototype, {
    /** Lista de efeitos ativos de uma equipa. */
    buffsOf(team) {
      const m = this.match, turn = m.state.turnCount, mine = team === this.viewer, out = [];
      const left = (until) => { const n = Math.max(1, Math.ceil((until - turn) / 2)); return `${n} turno${n === 1 ? '' : 's'}`; };
      m.pos.board.forEach((p, sq) => {
        if (!p || p.color !== team) return;
        const piece = `${YC.PIECE_NAME[m.realType(p)]} em ${sqN(sq)}`;
        for (const id of p.equips) {
          const c = YC.Cards.get(id), a = AGAINST[id];
          const off = p.silenced || (id === 'eq_escudo_choque' && !p.shield);
          const kind = a ? a[0] : 'buff';
          let note = a ? a[mine ? 2 : 1] : '';
          if (p.silenced) note = `Desligado durante mais ${left(p.silencedUntil)}: não faz efeito.`;
          else if (id === 'eq_escudo_choque' && !p.shield) note = 'A peça perdeu o Escudo: já não protege o Rei do xeque.';
          out.push({ key: `${id}@${sq}${off ? '-' : ''}`, card: c, kind: off ? 'off' : kind, where: piece, note, text: c.text });
        }
        for (const [k, icon, label, what] of STATUS) {
          const on = k === 'frozen' ? p.frozenUntil > turn : p[k];
          if (!on) continue;
          const until = k === 'frozen' ? p.frozenUntil : p[`${k}Until`];
          const fem = ['r', 'q'].includes(m.realType(p)) ? 'a' : 'o';
          const name = label.endsWith('d') ? `${label}${fem}` : label;
          out.push({ key: `${k}@${sq}`, icon, kind: 'status', title: `${name} · ${left(until)}`, where: piece, note: `${what} durante mais ${left(until)}.` });
        }
      });
      const mod = m.state.actionMod && m.state.actionMod[team];
      if (mod) out.push({ key: `mod${mod}`, icon: mod > 0 ? 'plus' : 'no', kind: mod > 0 ? 'buff' : 'status', title: `${mod > 0 ? '+' : ''}${mod} ação de carta`, where: 'Próximo turno', note: `No próximo turno ${mine ? 'tens' : 'tem'} ${mod > 0 ? `mais ${mod}` : `menos ${-mod}`} ação${Math.abs(mod) === 1 ? '' : 'ões'} de carta.` });
      return out;
    },

    /** Desenha a fila de efeitos debaixo da foto (só quando mudou). */
    renderBuffs(box, team) {
      let bar = box.querySelector('.hud-fx');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'hud-fx';
        box.appendChild(bar);
        bar.addEventListener('pointerover', (e) => { const b = e.target.closest('.fx-chip'); if (b && e.pointerType !== 'touch') this.showBuffTip(b); });
        bar.addEventListener('pointerout', (e) => { const b = e.target.closest('.fx-chip'); if (b && !b.contains(e.relatedTarget)) this.hideBuffTip(); });
        bar.addEventListener('click', (e) => { const b = e.target.closest('.fx-chip'); if (b) (this.buffTipFor === b ? this.hideBuffTip() : this.showBuffTip(b)); });
      }
      const list = this.match.over ? [] : this.buffsOf(team);
      const key = list.map((x) => x.key).join(',');
      if (bar.dataset.key === key) return;
      bar.dataset.key = key;
      this.hideBuffTip();
      bar.hidden = !list.length;
      bar.innerHTML = list.map((x, i) => {
        const art = x.card ? (YC.ItemToken ? YC.ItemToken.cardArt(x.card) : YC.CardArt.svg(x.card)) : YC.Icon(x.icon, { size: 18 });
        const badge = x.kind === 'forbid' ? `<em>${YC.Icon('no', { size: 12 })}</em>` : x.kind === 'punish' ? `<em>${YC.Icon('warn', { size: 12 })}</em>` : '';
        return `<button class="fx-chip k-${x.kind}" data-i="${i}" aria-label="${esc(x.card ? x.card.name : x.title)}">${art}${badge}</button>`;
      }).join('');
      bar._list = list;
    },

    showBuffTip(btn) {
      const x = btn.parentElement._list && btn.parentElement._list[Number(btn.dataset.i)];
      if (!x) return;
      this.hideBuffTip();
      const tip = document.createElement('div');
      tip.className = `fx-tip k-${x.kind}`;
      tip.innerHTML = `<b>${esc(x.card ? x.card.name : x.title)}</b><span class="fx-where">${esc(x.where)}</span>`
        + (x.note ? `<p class="fx-note">${esc(x.note)}</p>` : '') + (x.text ? `<small>${esc(x.text)}</small>` : '');
      document.body.appendChild(tip);
      const r = btn.getBoundingClientRect(), w = tip.offsetWidth;
      tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
      tip.style.top = `${r.bottom + 8}px`;
      this.buffTip = tip; this.buffTipFor = btn;
    },

    hideBuffTip() {
      if (this.buffTip) this.buffTip.remove();
      this.buffTip = null; this.buffTipFor = null;
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
