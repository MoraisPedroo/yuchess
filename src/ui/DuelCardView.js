/* DuelCardView.js — cartas do Speed Duel com moldura por raridade:
   N pergaminho, E roxo/cobre com brilho diagonal, L dourado com estrelas, UR holográfico prismático. */
(function (YC) {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const CHESS_PT = { PAWN: 'Peão', KNIGHT: 'Cavalo', BISHOP: 'Bispo', ROOK: 'Torre', QUEEN: 'Dama', KING: 'Rei' };
  let defsInjected = false;

  /** Filtro de ruído para o brilho holográfico das Ultra-Raras (injetado uma vez). */
  function injectDefs() {
    if (defsInjected || typeof document === 'undefined') return;
    defsInjected = true;
    document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <filter id="holo-noise" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5" result="n"/>
        <feColorMatrix in="n" type="saturate" values="3"/>
        <feComponentTransfer><feFuncA type="table" tableValues="0 0.55"/></feComponentTransfer>
      </filter></defs></svg>`);
  }

  function symbolLabel(card) {
    return YC.DuelCards.SYMBOL_LABEL[card.symbol] || card.symbol;
  }

  function subtitle(card) {
    if (card.category === 'MONSTER') {
      const trib = YC.DuelCards.tributesFor(card);
      return `${card.art === 'DRAGON' ? 'Dragão' : CHESS_PT[card.chess]} · Nv ${card.level}${trib ? ` · ${trib} tributo${trib > 1 ? 's' : ''}` : ''}`;
    }
    return `${YC.DuelCards.CATEGORY_LABEL[card.category]} · SS${card.ss}`;
  }

  /**
   * Cria uma carta. opts: { small, tiny, side ('WHITE'|'BLACK' para a cor do corpo da peça),
   * stats: {atk, def} (valores atuais em campo), count (cópias na coleção), locked }.
   */
  function create(card, opts = {}) {
    injectDefs();
    const node = document.createElement('div');
    const size = opts.tiny ? ' tiny' : opts.small ? ' small' : '';
    node.className = `dcard r-${card.rarity} c-${card.color} cat-${card.category.toLowerCase().replace('_', '-')}${size}${opts.locked ? ' locked' : ''}`;
    node.dataset.id = card.id;
    const mon = card.category === 'MONSTER';
    const atk = opts.stats ? opts.stats.atk : card.atk, dfn = opts.stats ? opts.stats.def : card.def;
    const atkCls = opts.stats && atk !== card.atk ? (atk > card.atk ? ' up' : ' down') : '';
    const defCls = opts.stats && dfn !== card.def ? (dfn > card.def ? ' up' : ' down') : '';
    node.innerHTML = `
      <div class="dcard-frame">
        <div class="dcard-head"><span class="dcard-name">${esc(card.name)}</span><span class="dcard-uno">${esc(symbolLabel(card))}</span></div>
        <div class="dcard-sub">${mon ? `<span class="lv">${'★'.repeat(card.level)}</span>` : ''}<span>${esc(subtitle(card))}</span></div>
        <div class="dcard-art"></div>
        <div class="dcard-text">${esc(card.text)}</div>
        ${mon ? `<div class="dcard-stats"><span class="a${atkCls}">ATK ${atk}</span><span class="d${defCls}">DEF ${dfn}</span></div>` : ''}
      </div>
      ${card.rarity === 'UR' ? '<div class="dcard-holo"></div>' : ''}
      ${card.rarity === 'L' ? '<div class="dcard-stars"></div>' : ''}
      <span class="dcard-rarity">${card.rarity}</span>
      ${opts.count != null ? `<span class="dcard-count">×${opts.count}</span>` : ''}`;
    const art = node.querySelector('.dcard-art');
    if (mon) art.appendChild(YC.DuelArt.monsterRig(card, opts.side || 'WHITE').svg);
    else art.innerHTML = YC.DuelArt.emblem(card.id);
    return node;
  }

  function createBack(opts = {}) {
    const node = document.createElement('div');
    node.className = `dcard back${opts.tiny ? ' tiny' : opts.small ? ' small' : ''}`;
    node.innerHTML = '<div class="dcard-frame"><div class="back-rays"></div><div class="back-oval"><span>SPEED</span><b>DUEL</b></div></div>';
    return node;
  }

  /** Texto longo para o inspetor. */
  function describe(card) {
    const R = YC.DuelCards.RARITY[card.rarity];
    const lines = [card.text];
    if (card.category === 'MONSTER') lines.push(`ATK ${card.atk} / DEF ${card.def}`);
    lines.push(`Uno: ${YC.CardDatabase.COLOR_NAME[card.color]} ${symbolLabel(card)} · ${R.label} (máx. ${R.max} no baralho)`);
    return { title: card.name, sub: subtitle(card), lines };
  }

  YC.DuelCardView = { create, createBack, describe, subtitle, symbolLabel, esc };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
