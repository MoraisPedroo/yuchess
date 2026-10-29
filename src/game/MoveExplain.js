/* MoveExplain.js — explica os lances (sem DOM; usado pelo ecrã da partida e testado em tools/tests/).
   preview(m, sq): lances que a peça terá na próxima vez que a sua cor jogar — serve para ver o que uma peça inimiga
   pode fazer, já com os equipamentos, os estados e as casas bloqueadas que ainda durarem nessa altura.
   why(m, from, to): { text, soft } a dizer porque é que a peça em `from` não pode ir para `to` agora (null se pode).
   Para achar a causa experimenta o lance numa cópia da posição, tirando uma regra de cada vez (sem captura,
   Capa/Colete, equipamentos desligados, casas bloqueadas, Lança gasta, peças no caminho); `soft` = só a forma
   normal de andar da peça (o ecrã mostra-a ao passar o rato, mas não grita no clique). Nunca muda o estado. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const N = { p: 'Peão', n: 'Cavalo', b: 'Bispo', r: 'Torre', q: 'Dama', k: 'Rei' };
  const fem = (t) => t === 'r' || t === 'q';
  const the = (t) => `${fem(t) ? 'a' : 'o'} ${N[t]}`;
  const The = (t) => `${fem(t) ? 'A' : 'O'} ${N[t]}`;
  const adj = (t, base) => `${base}${fem(t) ? 'a' : 'o'}`;
  const S = (i) => C().sqName(i).toUpperCase();
  const card = (id) => (YC.Cards.get(id) || { name: id }).name;
  const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} e ${a[a.length - 1]}`);
  const left = (m, until) => { const n = Math.max(1, Math.ceil((until - m.state.turnCount) / 2)); return `${n} turno${n === 1 ? '' : 's'}`; };
  /** "o teu Cavalo em C3" / "a Torre inimiga em E8" */
  const named = (pos, i, me) => {
    const q = pos.board[i];
    if (q.color === me) return `${fem(q.type) ? 'a tua' : 'o teu'} ${N[q.type]} em ${S(i)}`;
    return `${the(q.type)} ${fem(q.type) ? 'inimiga' : 'inimigo'} em ${S(i)}`;
  };
  // equipamentos que mudam a forma de andar (para a frase "mesmo com…")
  const MOVE_EQ = ['eq_botas_vento', 'eq_mola_canguru', 'eq_cetro_usurpador', 'eq_lanca_telescopica', 'eq_patins_gelo',
    'eq_exoesqueleto_tita', 'eq_sapato_palhaco', 'eq_braco_mutante', 'eq_sirene_perseguicao'];

  /** Cópia da posição com peças copiadas (as experiências nunca tocam no estado da partida). */
  function clone(pos) {
    return { ...pos, board: pos.board.map((q) => q && { ...q, equips: q.equips.slice() }), blocked: (pos.blocked || []).slice() };
  }
  const reaches = (pos, from, to, turn) => C().pieceMoves(pos, from, { turn }).some((mv) => mv.to === to);

  /** Casas entre `from` e `to` numa linha reta ou diagonal ([] noutros casos, ex.: Cavalo). */
  function between(from, to) {
    const r0 = from >> 3, c0 = from & 7, dr = (to >> 3) - r0, dc = (to & 7) - c0;
    if (dr && dc && Math.abs(dr) !== Math.abs(dc)) return [];
    const n = Math.max(Math.abs(dr), Math.abs(dc)), sr = Math.sign(dr), sc = Math.sign(dc), out = [];
    for (let k = 1; k < n; k++) out.push((r0 + sr * k) * 8 + c0 + sc * k);
    return out;
  }

  // ───────────── o que a peça pode fazer ─────────────
  function preview(m, sq) {
    const p = m.pos.board[sq];
    if (!p) return [];
    let pos = m.pos, turn = m.state.turnCount;
    if (p.color !== m.state.active) {
      // a próxima vez desta cor: acabam os estados e os bloqueios que expiram até lá (como no tickStatuses)
      turn += 1;
      pos = clone(m.pos);
      for (const q of pos.board) if (q) for (const k of ['silenced', 'noCap', 'untargetable']) if (q[k] && q[`${k}Until`] <= turn) q[k] = false;
      pos.blocked = (m.state.blocks || []).filter((b) => b.until > turn).map((b) => b.sq);
      pos.ep = -1;
    }
    return C().legalMovesFrom(pos, sq, { turn });
  }

  // ───────────── porque é que não dá ─────────────
  function why(m, from, to) {
    const pos = m.pos, c = C(), p = pos.board[from];
    if (!p || to < 0 || from === to) return null;
    const turn = m.state.turnCount, t = p.type, T = pos.board[to];
    if (c.legalMovesFrom(pos, from, { turn }).some((mv) => mv.to === to)) return null;
    const rule = (text) => ({ text, soft: false });
    if (c.isFrozen(p, turn)) return rule(`${The(t)} está ${adj(t, 'congelad')} durante mais ${left(m, p.frozenUntil)}: não se pode mexer.`);
    if (T && T.color === p.color) return { text: `${S(to)} já tem uma peça tua.`, soft: true };
    if (T && T.type === 'k') return rule('O Rei nunca é capturado: para ganhar tens de lhe dar xeque-mate.');
    if (c.isBlocked(pos, to)) {
      const b = (m.state.blocks || []).find((x) => x.sq === to);
      return rule(`A casa ${S(to)} está bloqueada${b ? ` durante mais ${left(m, b.until)}` : ''}: nenhuma peça pode entrar lá.`);
    }
    const pseudo = c.pieceMoves(pos, from, { turn }).filter((mv) => mv.to === to);
    if (pseudo.length) return rule(kingSafety(m, pseudo[0]));
    const r = restriction(m, from, to);
    return r ? rule(r) : { text: shape(m, from, to), soft: true };
  }

  /** O lance existe, mas deixava o próprio Rei em xeque (cravada, xeque por resolver) ou dava xeque proibido. */
  function kingSafety(m, mv) {
    const pos = m.pos, c = C(), p = mv.piece, t = p.type, me = p.color, foe = c.other(me);
    const checked = c.inCheck(pos, me);
    if (mv.captured && mv.captured.shield && !c.has(p, 'eq_broca_perfuradora') && checked) {
      return `${The(mv.captured.type)} em ${S(mv.to)} tem Escudo: a captura falhava e ${the(t)} voltava para trás — e estás em xeque, por isso isto não te salva.`;
    }
    const u = c.makeMove(pos, mv);
    const k = c.kingSquare(pos, me), att = k >= 0 ? c.attackersOf(pos, k, foe, true).map((i) => named(pos, i, me)) : [];
    const guardHit = c.inCheck(pos, foe) && c.guarded(pos, foe);
    c.unmakeMove(pos, u);
    if (att.length) {
      if (t === 'k') return `O Rei não pode ir para ${S(mv.to)}: lá ficava em xeque (${list(att)}).`;
      if (checked) return `Estás em xeque e este lance não o resolve: o teu Rei continuava atacado (${list(att)}). Tapa o xeque, captura quem o dá ou foge com o Rei.`;
      return `${The(t)} está ${adj(t, 'cravad')}: se sair daí, o teu Rei fica em xeque (${list(att)}).`;
    }
    if (guardHit) return `O Rei inimigo está protegido pelo ${card('eq_escudo_choque')}: não lhe podes dar xeque com um lance.`;
    return 'Este lance não é permitido agora.';
  }

  /** Experiências numa cópia: tira uma regra de cada vez e vê se a peça passava a chegar à casa. */
  function restriction(m, from, to) {
    const pos = m.pos, c = C(), p = pos.board[from], t = p.type, T = pos.board[to], turn = m.state.turnCount;
    const tryWith = (fix) => { const q = clone(pos); fix(q, q.board[from], q.board[to]); return reaches(q, from, to, turn); };
    if (T && p.noCap && tryWith((q, a) => { a.noCap = false; })) {
      return `${The(t)} não pode capturar durante mais ${left(m, p.noCapUntil)} (efeito de uma carta).`;
    }
    if (T && t === 'p') {
      const cover = ['eq_capa_magnetica', 'eq_colete_balas'].find((id) => c.has(T, id));
      if (cover && tryWith((q, a, b) => { b.equips = b.equips.filter((x) => x !== cover); })) {
        return `${The(T.type)} em ${S(to)} tem ${card(cover)}: os Peões não lhe podem tocar.`;
      }
    }
    if (p.silenced && p.equips.length && tryWith((q, a) => { a.silenced = false; })) {
      return `Os equipamentos d${fem(t) ? 'a' : 'o'} ${N[t]} estão desligados durante mais ${left(m, p.silencedUntil)} (${list(p.equips.map(card))}): sem eles não chega a ${S(to)}.`;
    }
    if (pos.blocked && pos.blocked.length && tryWith((q) => { q.blocked = []; })) {
      const on = between(from, to).find((i) => c.isBlocked(pos, i));
      return on != null ? `O caminho passa pela casa ${S(on)}, que está bloqueada.` : 'O caminho passa por uma casa bloqueada.';
    }
    if (T && c.has(p, 'eq_lanca_telescopica') && p.lanceUsed && tryWith((q, a) => { a.lanceUsed = false; })) {
      return `A ${card('eq_lanca_telescopica')} já foi usada (só dá uma vez).`;
    }
    if (t === 'k' && from >> 3 === to >> 3 && Math.abs((to & 7) - (from & 7)) === 2) {
      const r = castle(m, from, to);
      if (r) return r;
    }
    // peças no caminho: com o tabuleiro vazio (só esta peça e o alvo) já chegava?
    if (tryWith((q) => { for (let i = 0; i < 64; i++) if (i !== from && i !== to) q.board[i] = null; q.blocked = []; })) {
      const mid = between(from, to).filter((i) => pos.board[i]);
      if (mid.length) {
        if ((t === 'r' || t === 'b') && c.has(p, 'eq_mola_canguru')) {
          return `A ${card('eq_mola_canguru')} só salta uma peça e há ${mid.length} no caminho (${list(mid.map((i) => named(pos, i, p.color)))}).`;
        }
        return `Há uma peça no caminho: ${named(pos, mid[0], p.color)}.`;
      }
    }
    return null;
  }

  function castle(m, from, to) {
    const pos = m.pos, c = C(), k = pos.board[from], me = k.color, foe = c.other(me), row = from >> 3;
    const kingSide = (to & 7) > (from & 7);
    if (row !== (me === 'w' ? 7 : 0) || (from & 7) !== 4) return null;
    if (k.moved) return 'Já não podes fazer o roque: o Rei já se mexeu nesta partida.';
    const rook = pos.board[row * 8 + (kingSide ? 7 : 0)];
    if (!rook || rook.type !== 'r' || rook.color !== me || rook.moved) return 'Já não podes fazer o roque para este lado: essa Torre já se mexeu (ou já não está lá).';
    const occ = (kingSide ? [5, 6] : [1, 2, 3]).map((x) => row * 8 + x).find((i) => pos.board[i] || c.isBlocked(pos, i));
    if (occ != null) return `Para o roque, as casas entre o Rei e a Torre têm de estar vazias (${S(occ)} não está).`;
    if (c.inCheck(pos, me)) return 'Não podes fazer o roque quando estás em xeque.';
    const hit = (kingSide ? [5, 6] : [3, 2]).map((x) => row * 8 + x).find((i) => c.isAttacked(pos, i, foe, true));
    if (hit != null) return `Não podes fazer o roque: o Rei passava pela casa ${S(hit)}, que está atacada.`;
    return null;
  }

  /** A forma normal de andar da peça (e as regras do Peão). */
  function shape(m, from, to) {
    const pos = m.pos, c = C(), p = pos.board[from], t = p.type, T = pos.board[to];
    const dr = (to >> 3) - (from >> 3), dc = (to & 7) - (from & 7), fwd = p.color === 'w' ? -1 : 1;
    const eq = (id) => c.has(p, id);
    const mods = p.silenced ? [] : p.equips.filter((id) => MOVE_EQ.includes(id));
    const even = mods.length ? ` Mesmo com ${list(mods.map(card))}, não chega a ${S(to)}.` : '';
    if (t === 'p' && !eq('eq_cetro_usurpador') && !eq('eq_exoesqueleto_tita')) {
      if (!dr || Math.sign(dr) !== fwd) return 'O Peão nunca anda para trás nem para o lado.';
      if (eq('eq_sapato_palhaco') && T && Math.abs(dc) === 1 && dr === fwd) return `Com os ${card('eq_sapato_palhaco')}, o Peão captura em frente, não na diagonal.`;
      if (!dc && T) return 'O Peão não captura em frente: só 1 casa na diagonal.';
      if (Math.abs(dc) === 1 && dr === fwd && !T) return 'O Peão só anda na diagonal quando captura.';
      if (!dc && dr === 2 * fwd) return `O Peão só avança 2 casas a partir da casa inicial (ou com as ${card('eq_botas_vento')}).`;
      return `O Peão anda 1 casa em frente (2 na primeira vez) e captura 1 casa na diagonal.${even}`;
    }
    const base = {
      p: 'Este Peão anda de outra forma por causa do equipamento.',
      n: 'O Cavalo anda em L: 2 casas numa direção e 1 para o lado.',
      b: 'O Bispo anda só na diagonal.',
      r: 'A Torre anda só em linha reta (na horizontal ou na vertical).',
      q: 'A Dama anda em linha reta ou na diagonal.',
      k: 'O Rei anda só uma casa de cada vez.'
    }[t];
    return `${base}${even}`;
  }

  YC.MoveExplain = { preview, why, between };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
