/* PieceInspector.js — ao passar o rato por uma peça mostra um cartão com a peça grande e animada,
   o estado (escudo, gelo, metamorfose, xeque, Lança gasta), os equipamentos e quantos lances tem. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const TEAM = { w: 'Brancas', b: 'Pretas' };

  const Insp = {
    el: null,
    timer: 0,

    show(ui, sq, anchor) {
      clearTimeout(Insp.timer);
      if (sq < 0 || !anchor || matchMedia('(hover: none)').matches) return Insp.hide();
      Insp.timer = setTimeout(() => Insp.render(ui, sq, anchor), 120);
    },

    hide() {
      clearTimeout(Insp.timer);
      const e = Insp.el;
      Insp.el = null;
      if (!e) return;
      if (window.gsap) window.gsap.to(e, { opacity: 0, scale: 0.94, duration: 0.12, onComplete: () => e.remove() });
      else e.remove();
    },

    render(ui, sq, anchor) {
      const m = ui.match, p = m && m.pieceAt(sq);
      if (!p) return Insp.hide();
      if (Insp.el) Insp.el.remove();
      const turn = m.state.turnCount, real = m.realType(p);
      const chips = [];
      const turnsLeft = (until) => Math.max(1, Math.ceil((until - turn) / 2));
      if (p.shield) chips.push(['shield', '🛡 Escudo: a próxima captura falha']);
      if (p.frozenUntil > turn) chips.push(['ice', `❄ Congelada · ${turnsLeft(p.frozenUntil)} turno(s)`]);
      if (p.morphUntil) chips.push(['morph', `🧪 Encolhida · volta a ${YC.PIECE_NAME[p.morphFrom]} em ${turnsLeft(p.morphUntil)} turno(s)`]);
      if (p.type === 'k' && YC.Chess.inCheck(m.pos, p.color)) chips.push(['danger', '⚠ Em xeque!']);
      if (p.type === 'k') chips.push(['info', '👑 Imune a congelar e a ser destruído por cartas']);
      if (YC.Chess.has(p, 'eq_lanca_telescopica')) chips.push(['info', p.lanceUsed ? '🗡 Lança já usada' : '🗡 Lança pronta (1 uso)']);
      if (m.state.active === p.color && !m.over) {
        const n = YC.Chess.legalMovesFrom(m.pos, sq, { turn }).length;
        chips.push(['info', n ? `➜ ${n} ${n === 1 ? 'lance possível' : 'lances possíveis'}` : '✖ Sem lances agora']);
      }
      const equips = p.equips.map((id) => {
        const c = YC.Cards.get(id);
        return `<li style="--c1:${c.theme.primary};--c2:${c.theme.secondary}"><span class="pi-eq-ico">${YC.CardArt.svg(c)}</span><span><b>${esc(c.name)}</b><small>${esc(c.text)}</small></span></li>`;
      }).join('');
      const states = ['equipped', 'shielded', 'frozen', 'checked'].filter((k) => anchor.classList.contains(k)).join(' ');
      const el = document.createElement('div');
      el.className = `piece-insp ${p.color}`;
      el.innerHTML = `<div class="pi-stage"><div class="pi-disc"></div><div class="pi-figure piece ${p.color} ${states}"><div class="squash">${YC.pieceHTML(p.type, p.color)}</div><div class="shield-dome"></div></div></div>
        <div class="pi-body"><div class="pi-title"><b>${YC.PIECE_NAME[real]}</b><span>${TEAM[p.color]}${p.color === ui.viewer ? ' · tua' : ''} · ${YC.Chess.sqName(sq).toUpperCase()}</span></div>
        ${chips.length ? `<div class="pi-chips">${chips.map(([k, t]) => `<span class="chip-${k}">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="pi-eq-title">Equipamentos (${p.equips.length}/2)</div>
        ${equips ? `<ul class="pi-eq">${equips}</ul>` : '<p class="pi-none">Sem equipamentos.</p>'}</div>`;
      document.body.appendChild(el);
      Insp.el = el;
      const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, gap = 16;
      let x = r.right + gap;
      if (x + w > innerWidth - 8) x = r.left - gap - w;
      x = Math.max(8, Math.min(innerWidth - w - 8, x));
      const y = Math.max(8, Math.min(innerHeight - h - 8, r.top + r.height / 2 - h / 2));
      el.style.left = `${x}px`; el.style.top = `${y}px`;
      if (window.gsap) window.gsap.fromTo(el, { opacity: 0, scale: 0.85, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.7)' });
    }
  };

  YC.PieceInspector = Insp;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
