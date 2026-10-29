/* ArenaRanking.js — "Melhores jogadores" na Arena: pódio com os 3 primeiros (2.º · 1.º · 3.º), a tua posição
   e o botão "Ver todos" (janela com a classificação completa). Lê `players` no Firestore (leitura pública) e
   guarda o resultado 60 s para não repetir a consulta a cada visita à Arena. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const I = (n, o) => YC.Icon(n, o);
  const MEDAL = ['#FFB703', '#CBD5E1', '#D97706'];

  const Rank = {
    rows: null, at: 0, loading: null,

    async load(force) {
      if (!force && Rank.rows && Date.now() - Rank.at < 60000) return Rank.rows;
      if (Rank.loading) return Rank.loading;
      Rank.loading = (async () => {
        try {
          await YC.Firebase.load();
          Rank.rows = await YC.Ranking.leaderboard(50);
          Rank.at = Date.now();
        } finally { Rank.loading = null; }
        return Rank.rows;
      })();
      return Rank.loading;
    },

    myUid() { const u = YC.Firebase && YC.Firebase.user; return u && !u.isAnonymous ? u.uid : null; },

    avatar(name, i) {
      const letter = esc((String(name || '?').trim()[0] || '?').toUpperCase());
      return `<span class="rk-ava" style="--m:${MEDAL[i] || '#64748B'}">${letter}</span>`;
    },

    /** Pódio no painel da Arena. */
    async render(el) {
      el.innerHTML = `<div class="panel-head">${I('trophy', { size: 22 })}<h3>Melhores jogadores</h3></div>
        <div class="podium">${[1, 0, 2].map((i) => `<div class="pod p${i + 1}"><div class="pod-who"><span class="rk-ava empty">?</span><b>—</b><small>&nbsp;</small></div><div class="pod-step"><span>${i + 1}</span></div></div>`).join('')}</div>
        <div class="rk-me tray"><span class="muted">A carregar a classificação…</span></div>
        <button class="btn small secondary rk-all" data-a="ranking">${I('scroll', { size: 18 })}Ver todos</button>`;
      el.querySelector('[data-a="ranking"]').onclick = () => Rank.openAll();
      let rows;
      try { rows = await Rank.load(); } catch (err) {
        if (el.isConnected) el.querySelector('.rk-me').innerHTML = `<span class="muted">Sem ligação à classificação.</span>`;
        return;
      }
      if (!el.isConnected) return;
      [0, 1, 2].forEach((i) => {
        const r = rows[i], box = el.querySelector(`.pod.p${i + 1} .pod-who`);
        if (r) box.innerHTML = `${Rank.avatar(r.name, i)}${i === 0 ? `<i class="pod-crown">${I('crown', { size: 26 })}</i>` : ''}<b title="${esc(r.name)}">${esc(r.name)}</b><small>${r.rating}</small>`;
      });
      const me = Rank.myUid(), pos = me ? rows.findIndex((r) => r.uid === me) : -1;
      el.querySelector('.rk-me').innerHTML = !rows.length ? '<span class="muted">Ainda ninguém jogou ranqueadas. Sê o primeiro no pódio!</span>'
        : pos >= 0 ? `<span class="rk-pos">#${pos + 1}</span><span>A tua posição</span><b>${rows[pos].rating}</b>`
          : me ? '<span class="muted">Joga uma ranqueada para entrar na classificação.</span>'
            : '<span class="muted">Entra com Google e joga ranqueadas para subir no pódio.</span>';
      const g = window.gsap;
      if (g && !YC.reducedMotion()) g.fromTo(el.querySelectorAll('.pod-step'), { scaleY: 0 }, { scaleY: 1, transformOrigin: '50% 100%', duration: 0.42, stagger: 0.08, ease: 'expo.out', clearProps: 'transform' });
    },

    /** Classificação completa numa janela. */
    async openAll() {
      const { el } = YC.UI.modal(`<h2>Classificação</h2><p class="muted">Ranqueadas com rating Elo. Começas com 1000.</p><ol class="rk-list"><li class="empty">A carregar…</li></ol>`, { cls: 'rk-modal' });
      const list = el.querySelector('.rk-list');
      try {
        const rows = await Rank.load(true), me = Rank.myUid();
        list.innerHTML = rows.length ? rows.map((r, i) => `<li class="${r.uid === me ? 'me' : ''} ${i < 3 ? 'top' : ''}">
            <span class="pos" style="${i < 3 ? `--m:${MEDAL[i]}` : ''}">${i + 1}</span>${Rank.avatar(r.name, i)}<span class="nm">${esc(r.name)}</span>
            <small>${r.wins}V · ${r.losses}D</small><b>${r.rating}</b></li>`).join('')
          : '<li class="empty">Ainda ninguém jogou ranqueadas.</li>';
      } catch (err) { list.innerHTML = `<li class="empty">${esc(YC.Firebase.explain ? YC.Firebase.explain(err) : String(err))}</li>`; }
    }
  };

  YC.ArenaRanking = Rank;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
