/* Ranking.js — rating Elo (K=32, início 1000) com "caução" anti-abandono:
   no início de uma ranqueada cada jogador desconta já a derrota provável (lossDelta).
   No fim, quem ganha recebe a caução de volta mais o ganho; quem perde não precisa de fazer nada.
   Fechar o separador a perder deixa a derrota registada. As regras do Firestore validam cada passo. */
(function (YC) {
  'use strict';

  const K = 32;
  const START = 1000;
  const FB = () => YC.Firebase;

  const Ranking = {
    K, START,

    expected(mine, theirs) { return 1 / (1 + Math.pow(10, (theirs - mine) / 400)); },

    /** Deltas Elo a partir dos ratings fotografados no início da partida. */
    deltas(mine, theirs) {
      const e = Ranking.expected(mine, theirs);
      return { loss: Math.round(K * e), win: Math.round(K * (1 - e)), draw: Math.round(K * (0.5 - e)) };
    },

    sides(match, uid) {
      const team = match.white.uid === uid ? 'WHITE' : 'BLACK';
      const me = team === 'WHITE' ? match.white : match.black;
      const opp = team === 'WHITE' ? match.black : match.white;
      return { team, me, opp, d: Ranking.deltas(me.rating, opp.rating) };
    },

    profileRef(uid) { return FB().doc('players', uid); },
    historyRef(uid, matchId) { return FB().doc('players', uid, 'history', matchId); },

    cleanName(name) {
      return String(name || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
    },

    async ensureProfile(user, wantedName) {
      const fb = FB(), ref = Ranking.profileRef(user.uid);
      const snap = await fb.F.getDoc(ref);
      if (snap.exists()) return { uid: user.uid, ...snap.data() };
      let name = Ranking.cleanName(wantedName || user.displayName || '');
      if (name.length < 2) name = `Jogador ${user.uid.slice(0, 4).toUpperCase()}`;
      const data = { name, rating: START, games: 0, wins: 0, losses: 0, draws: 0, guest: !!user.isAnonymous, createdAt: fb.now(), updatedAt: fb.now() };
      await fb.F.setDoc(ref, data);
      return { uid: user.uid, ...data, createdAt: null, updatedAt: null };
    },

    async rename(uid, name) {
      const clean = Ranking.cleanName(name);
      if (clean.length < 2) throw new Error('O nome precisa de pelo menos 2 letras.');
      await FB().F.updateDoc(Ranking.profileRef(uid), { name: clean, updatedAt: FB().now() });
      return clean;
    },

    async getProfile(uid) {
      const snap = await FB().F.getDoc(Ranking.profileRef(uid));
      return snap.exists() ? { uid, ...snap.data() } : null;
    },

    /** Caução: desconta a derrota já no início (history "pending" + perfil no mesmo lote). */
    async escrow(match, uid) {
      const fb = FB(), { team, d } = Ranking.sides(match, uid);
      const h = Ranking.historyRef(uid, match.id);
      if ((await fb.F.getDoc(h)).exists()) return false;
      const batch = fb.F.writeBatch(fb.db);
      batch.set(h, { state: 'pending', lossDelta: d.loss, team, at: fb.now() });
      batch.update(Ranking.profileRef(uid), {
        rating: fb.inc(-d.loss), games: fb.inc(1), losses: fb.inc(1), lastMatch: match.id, updatedAt: fb.now()
      });
      await batch.commit();
      return true;
    },

    /**
     * Fecha a caução. outcome: 'WIN' | 'DRAW' | 'LOSS'. Devolve a variação final do rating.
     * As regras só aceitam vitória/empate se as "claims" dos dois jogadores coincidirem (ou abandono).
     */
    async settle(match, uid, outcome) {
      const fb = FB(), { d } = Ranking.sides(match, uid);
      const h = Ranking.historyRef(uid, match.id);
      const snap = await fb.F.getDoc(h);
      if (!snap.exists()) return null;
      const hist = snap.data();
      if (hist.state !== 'pending') {
        return hist.state === 'won' ? hist.winDelta : hist.state === 'draw' ? hist.drawDelta : -hist.lossDelta;
      }
      const batch = fb.F.writeBatch(fb.db);
      if (outcome === 'LOSS') {
        batch.update(h, { state: 'lost' });
        await batch.commit();
        return -hist.lossDelta;
      }
      const extra = outcome === 'WIN' ? { state: 'won', winDelta: d.win } : { state: 'draw', drawDelta: d.draw };
      const gain = outcome === 'WIN' ? d.win : d.draw;
      batch.update(h, extra);
      batch.update(Ranking.profileRef(uid), {
        rating: fb.inc(hist.lossDelta + gain), losses: fb.inc(-1),
        [outcome === 'WIN' ? 'wins' : 'draws']: fb.inc(1), lastMatch: match.id, updatedAt: fb.now()
      });
      await batch.commit();
      return gain;
    },

    /** Resolve cauções que ficaram pendentes (ex.: fechaste o separador logo depois de ganhar). */
    async settlePending(uid) {
      const fb = FB(), F = fb.F;
      const q = F.query(fb.col('players', uid, 'history'), F.where('state', '==', 'pending'), F.limit(10));
      const res = await F.getDocs(q);
      let fixed = 0;
      for (const hd of res.docs) {
        const ms = await F.getDoc(fb.doc('matches', hd.id));
        if (!ms.exists()) continue;
        const m = { id: ms.id, ...ms.data() };
        if (m.status !== 'finished' || !m.claims) continue;
        const { team, opp } = Ranking.sides(m, uid);
        const mine = m.claims[uid], theirs = opp && m.claims[opp.uid];
        const forfeitMine = m.forfeit && m.forfeit.by === uid;
        try {
          if (mine === team && (theirs === team || forfeitMine)) { await Ranking.settle(m, uid, 'WIN'); fixed++; }
          else if (mine === 'DRAW' && theirs === 'DRAW') { await Ranking.settle(m, uid, 'DRAW'); fixed++; }
          else if (mine && mine !== team) { await Ranking.settle(m, uid, 'LOSS'); fixed++; }
        } catch (err) { console.warn('[ranking] settlePending', hd.id, err); }
      }
      return fixed;
    },

    async leaderboard(n = 30) {
      const fb = FB(), F = fb.F;
      const res = await F.getDocs(F.query(fb.col('players'), F.orderBy('rating', 'desc'), F.limit(n + 20)));
      return res.docs.map((x) => ({ uid: x.id, ...x.data() })).filter((p) => p.games > 0).slice(0, n);
    }
  };

  YC.Ranking = Ranking;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
