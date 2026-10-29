/* OnlineService.js — salas no Firestore: criar sala privada (código de 5 letras), entrar por código,
   fila ranqueada, batimento cardíaco, desistência, abandono e o transporte das ações do lockstep.
   Estrutura: matches/{código} (com o baralho de 22 de cada lugar) + matches/{código}/actions/{seq}.
   Equipas no Firestore: 'WHITE'/'BLACK' (no motor são 'w'/'b'; ver YC.TEAM_NAME). */
(function (YC) {
  'use strict';

  const FB = () => YC.Firebase;
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const FRESH_MS = 30000;        // sala em espera conta como viva se deu sinal nos últimos 30 s
  // abandono (iguais às regras do firestore.rules): à espera do adversário há 2:30 desde o nosso último lance
  // (o tempo da vez dele é 2:00 e o jogo dele joga sozinho no fim), ou adversário sem sinal (batimento) há 1:30
  const FORFEIT_MS = 150000;
  const GONE_MS = 90000;
  const VERSION = 2;             // salas do Chess-Gi-Oh! (as do protótipo antigo são ignoradas)

  function randomCode(n = 5) {
    let s = '';
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    for (let i = 0; i < n; i++) s += CODE_CHARS[buf[i] % CODE_CHARS.length];
    return s;
  }

  const Online = {
    FORFEIT_MS, GONE_MS,
    matchRef(id) { return FB().doc('matches', id); },
    seat(profile, deck) { return { uid: profile.uid, name: profile.name, rating: profile.rating, deck: deck.slice(0, YC.Cards.RULES.DECK_SIZE) }; },

    async createRoom(profile, ranked, deck) {
      const fb = FB(), F = fb.F;
      for (let attempt = 0; attempt < 6; attempt++) {
        const id = randomCode();
        const ref = Online.matchRef(id);
        try {
          await F.runTransaction(fb.db, async (tx) => {
            if ((await tx.get(ref)).exists()) throw Object.assign(new Error('exists'), { code: 'exists' });
            tx.set(ref, {
              code: id, v: VERSION, ranked: !!ranked, status: 'waiting', seed: Math.floor(Math.random() * 2147483647),
              white: Online.seat(profile, deck), black: null, players: [profile.uid],
              claims: {}, lastAction: {}, lastSeen: { [profile.uid]: fb.now() },
              createdAt: fb.now()
            });
          });
          return id;
        } catch (err) {
          if (err.code !== 'exists') throw err;
        }
      }
      throw new Error('Não consegui criar a sala. Tenta outra vez.');
    },

    /** Entra numa sala em espera (transação: dois jogadores não podem ocupar a mesma cadeira). */
    async joinRoom(id, profile, deck, { rankedOnly = false } = {}) {
      const fb = FB(), F = fb.F, ref = Online.matchRef(String(id).toUpperCase().trim());
      await F.runTransaction(fb.db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Essa sala não existe.');
        const m = snap.data();
        if (m.v !== VERSION) throw new Error('Essa sala é de uma versão antiga do jogo.');
        if (m.status !== 'waiting') throw new Error('Essa sala já começou ou terminou.');
        if (m.white.uid === profile.uid) throw new Error('Esta sala é tua: espera que alguém entre.');
        if (rankedOnly && !m.ranked) throw new Error('Não é uma sala ranqueada.');
        if (m.ranked && profile.guest) throw new Error('Partidas ranqueadas precisam de conta Google.');
        tx.update(ref, {
          status: 'playing', black: Online.seat(profile, deck), players: [m.white.uid, profile.uid],
          startedAt: fb.now(), [`lastSeen.${profile.uid}`]: fb.now()
        });
      });
      return ref.id;
    },

    /** Procura uma ranqueada em espera de outra pessoa; se não houver, devolve null. */
    async findRanked(profile, deck, olderThan) {
      const fb = FB(), F = fb.F;
      const q = F.query(fb.col('matches'), F.where('ranked', '==', true), F.where('status', '==', 'waiting'), F.limit(15));
      const res = await F.getDocs(q);
      const now = Date.now();
      const list = res.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.v === VERSION && m.white.uid !== profile.uid)
        .filter((m) => now - fb.millis(m.lastSeen && m.lastSeen[m.white.uid]) < FRESH_MS)
        .filter((m) => !olderThan || fb.millis(m.createdAt) < olderThan)
        .sort((a, b) => fb.millis(a.createdAt) - fb.millis(b.createdAt));
      for (const m of list) {
        try { return await Online.joinRoom(m.id, profile, deck, { rankedOnly: true }); } catch (err) { /* alguém foi mais rápido */ }
      }
      return null;
    },

    watch(id, cb, onError) {
      return FB().F.onSnapshot(Online.matchRef(id), (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
    },

    async cancelWaiting(id) {
      try { await FB().F.deleteDoc(Online.matchRef(id)); } catch (err) { console.warn('[online] cancelar sala', err); }
    },

    heartbeat(id, uid) {
      return FB().F.updateDoc(Online.matchRef(id), { [`lastSeen.${uid}`]: FB().now() }).catch(() => {});
    },

    async claim(id, uid, result) {
      await FB().F.updateDoc(Online.matchRef(id), { [`claims.${uid}`]: result, status: 'finished', finishedAt: FB().now() });
    },

    async resign(id, uid, myTeam) {
      await FB().F.updateDoc(Online.matchRef(id), {
        resign: uid, [`claims.${uid}`]: YC.TEAM_NAME[YC.other(myTeam)], status: 'finished', finishedAt: FB().now()
      });
    },

    /** Vitória por abandono (as regras confirmam o tempo do lado do servidor). */
    async forfeit(id, uid, myTeam) {
      await FB().F.updateDoc(Online.matchRef(id), {
        forfeit: { by: uid, at: FB().now() }, [`claims.${uid}`]: YC.TEAM_NAME[myTeam], status: 'finished', finishedAt: FB().now()
      });
    },

    /** Há quanto tempo (ms) o adversário não dá sinal de vida (batimento a cada 20 s); 0 se não se sabe. */
    goneMs(match, uid) {
      const opp = match.players && match.players.find((p) => p !== uid);
      const seen = opp && FB().millis(match.lastSeen && match.lastSeen[opp]);
      return seen ? Math.max(0, Date.now() - seen) : 0;
    }
  };

  /** Transporte do LockstepSession sobre o Firestore. */
  class FirestoreTransport {
    constructor(matchId, uid, myTeam) {
      this.id = matchId; this.uid = uid; this.myTeam = myTeam;
      this.unsubs = [];
      this.onMatch = null;
      this.onError = (err) => console.warn('[online] envio falhou', err);
    }

    send(msg) {
      const fb = FB(), F = fb.F;
      if (msg.kind === 'RESIGN') return Online.resign(this.id, this.uid, this.myTeam).catch(this.onError);
      this.lastSent = Date.now();   // o abandono do adversário conta a partir do nosso último envio
      const batch = F.writeBatch(fb.db);
      batch.set(fb.doc('matches', this.id, 'actions', String(msg.seq)), {
        seq: msg.seq, by: this.uid, kind: msg.kind, payload: JSON.stringify(msg), at: fb.now()
      });
      batch.update(Online.matchRef(this.id), { [`lastAction.${this.uid}`]: fb.now() });
      return batch.commit().catch(this.onError);
    }

    onMessage(cb) {
      const fb = FB(), F = fb.F;
      const q = F.query(fb.col('matches', this.id, 'actions'), F.orderBy('seq'));
      this.unsubs.push(F.onSnapshot(q, (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== 'added') continue;
          const d = ch.doc.data();
          if (d.by === this.uid) continue;
          try { cb(JSON.parse(d.payload)); } catch (err) { console.warn('[online] mensagem inválida', err); }
        }
      }, (err) => this.onError(err)));
      this.unsubs.push(Online.watch(this.id, (m) => {
        if (!m) return;
        if (m.resign && m.resign !== this.uid) cb({ kind: 'RESIGN' });
        // o adversário ganhou por abandono nosso (estivemos parados/sem sinal): o nosso jogo também acaba
        if (m.forfeit && m.forfeit.by && m.forfeit.by !== this.uid) cb({ kind: 'FORFEIT' });
        if (this.onMatch) this.onMatch(m);
      }, (err) => this.onError(err)));
    }

    close() { this.unsubs.forEach((u) => u()); this.unsubs = []; }
  }

  Online.VERSION = VERSION;
  Online.FirestoreTransport = FirestoreTransport;
  YC.Online = Online;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
