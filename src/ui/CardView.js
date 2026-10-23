/* CardView.js — cartas híbridas desenhadas em HTML/CSS como cartazes de 1930
   (raios de sol, oval central, faixa de cor Uno e selo de Spell Speed). */
(function (YC) {
  'use strict';

  const DB = () => YC.CardDatabase;
  const KIND = {
    NORMAL_SPELL: 'FEITIÇO', QUICK_SPELL: 'RÁPIDO', SPATIAL_TRAP: 'ARMADILHA', COUNTER_TRAP: 'CONTRA'
  };

  function bigLabel(card) {
    const v = card.uno.value;
    return DB().VALUE_LABEL[v] || v;
  }

  function kindLabel(card) {
    return card.basic ? 'UNO' : KIND[card.yugioh.cardType];
  }

  function rulesText(card) {
    const db = DB();
    const parts = [];
    if (!card.basic) parts.push(card.description);
    if (card.uno.color === 'W') parts.push('Curinga: move qualquer peça e escolhe a cor.');
    else {
      parts.push(db.unoRuleText(card.uno.value));
      parts.push(db.COLOR_RESONANCE[card.uno.color] + '.');
    }
    return parts;
  }

  function escape(s) {
    return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  /** Cria o elemento de uma carta virada para cima. */
  function create(card, opts = {}) {
    const node = document.createElement('div');
    const type = card.yugioh.cardType.toLowerCase().replace('_', '-');
    node.className = `card c-${card.uno.color} t-${type}${card.basic ? ' basic' : ''}${opts.small ? ' small' : ''}`;
    node.dataset.uid = card.uid;
    const lines = rulesText(card);
    const trig = !card.basic && card.yugioh.cardType !== 'NORMAL_SPELL' ? DB().TRIGGER_LABEL[card.yugioh.triggerCondition] : '';
    const cost = card.cost ? `<div class="card-cost">Custo: ${card.cost.type === 'KING_HP' ? card.cost.amount + ' HP do Rei' : 'descartar ' + card.cost.amount}</div>` : '';
    node.innerHTML = `
      <div class="card-face">
        <div class="card-top"><span class="card-corner">${bigLabel(card)}</span><span class="card-kind">${kindLabel(card)}</span><span class="card-ss">SS${card.yugioh.spellSpeed}</span></div>
        <div class="card-art"><div class="card-rays"></div><div class="card-oval"><span class="card-big">${bigLabel(card)}</span></div></div>
        <div class="card-name">${escape(card.name)}</div>
        <div class="card-desc">${lines.map((l, i) => `<p class="${i === 0 && !card.basic ? 'main' : 'rule'}">${escape(l)}</p>`).join('')}${trig ? `<p class="trig">⏵ ${escape(trig)}</p>` : ''}${cost}</div>
      </div>`;
    return node;
  }

  /** Verso da carta (mão do adversário, cartas viradas no Suporte). */
  function createBack(opts = {}) {
    const node = document.createElement('div');
    node.className = `card back${opts.small ? ' small' : ''}`;
    node.innerHTML = '<div class="card-face"><div class="back-rays"></div><div class="back-oval"><span>CHESS</span><b>OH!</b></div></div>';
    return node;
  }

  /** Texto longo para o inspetor. */
  function describe(card) {
    const db = DB();
    return {
      title: card.name,
      sub: `${card.basic ? 'Carta Uno' : db.TYPE_LABEL[card.yugioh.cardType]} · Spell Speed ${card.yugioh.spellSpeed} · ${db.COLOR_NAME[card.uno.color]} ${bigLabel(card)}`,
      lines: rulesText(card).concat(!card.basic && card.yugioh.cardType !== 'NORMAL_SPELL' ? [db.TRIGGER_LABEL[card.yugioh.triggerCondition]] : [])
    };
  }

  YC.CardView = { create, createBack, describe, bigLabel, kindLabel, escape };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
