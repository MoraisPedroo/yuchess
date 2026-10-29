/* LockstepSession.js — multijogador determinístico ("Action-Dispatch Replication").
   Os dois clientes correm o mesmo Match com a mesma semente; só viajam as ações
   (DISPATCH_ACTION) e as respostas da Chain, numeradas por `seq`. Cada mensagem leva o hash
   do estado do remetente para detetar dessincronizações.
   Não depende do Firebase: o transporte é injetado (Firestore em produção, memória nos testes). */
(function (YC) {
  'use strict';

  /** Fila assíncrona: `next()` espera pela próxima mensagem; `interrupt()` liberta quem espera. */
  class Inbox {
    constructor() { this.items = []; this.waiters = []; }
    push(x) { const w = this.waiters.shift(); if (w) w(x); else this.items.push(x); }
    next() { return this.items.length ? Promise.resolve(this.items.shift()) : new Promise((r) => this.waiters.push(r)); }
    interrupt() { const ws = this.waiters.splice(0); ws.forEach((w) => w(null)); }
  }

  class LockstepSession {
    /**
     * @param {object} o
     * @param {YC.Match} o.game
     * @param {'w'|'b'} o.localTeam
     * @param {{send(msg):Promise|void, onMessage(cb):void, close?():void}} o.transport
     * @param {object} o.localAgent agente que decide localmente (UI humana ou IA nos testes)
     */
    constructor({ game, localTeam, transport, localAgent, onDesync }) {
      this.game = game;
      this.localTeam = localTeam;
      this.remoteTeam = YC.other(localTeam);
      this.transport = transport;
      this.localAgent = localAgent;
      this.onDesync = onDesync || ((info) => console.warn('[lockstep] dessincronização', info));
      this.seq = 0;
      this.pending = new Map();
      this.inbox = new Inbox();
      this.closed = false;
      this.desyncs = 0;
    }

    attach() {
      const g = this.game;
      g.localTeam = this.localTeam;
      g.agents[this.localTeam] = this.wrapLocal(this.localAgent);
      g.agents[this.remoteTeam] = this.remoteAgent();
      g.netHook = (action) => this.sendAction(action);
      this.transport.onMessage((msg) => this.receive(msg));
      return this;
    }

    close() {
      this.closed = true;
      this.inbox.interrupt();
      if (this.transport.close) this.transport.close();
    }

    send(msg) {
      if (this.closed) return;
      msg.seq = this.seq++;
      msg.h = this.game.stateHash();
      return this.transport.send(msg);
    }

    /** Chamado pelo Match no início de cada dispatch local válido. */
    sendAction(action) {
      if (action._remote || this.game.state.active !== this.localTeam) return;
      const clean = { ...action };
      delete clean._remote;
      this.send({ kind: 'ACTION', action: clean });
    }

    /** Recebe mensagens do adversário (podem chegar fora de ordem; entregamos por `seq`).
        RESIGN: o adversário desistiu. FORFEIT: o adversário ganhou por abandono nosso (estivemos parados ou sem sinal). */
    receive(msg) {
      if (this.closed || !msg) return;
      if (msg.kind === 'RESIGN') { this.game.resign(this.remoteTeam); this.inbox.interrupt(); return; }
      if (msg.kind === 'FORFEIT') { this.game.resign(this.localTeam, 'Abandono'); this.inbox.interrupt(); return; }
      if (msg.seq < this.seq) return; // duplicado
      this.pending.set(msg.seq, msg);
      while (this.pending.has(this.seq)) {
        const m = this.pending.get(this.seq);
        this.pending.delete(this.seq);
        this.seq++;
        this.inbox.push(m);
      }
    }

    /** Desistência local: avisa o adversário (fora da numeração) e fecha a partida. */
    resign() {
      if (this.closed || this.resigned || this.game.state.winner) return;
      this.resigned = true;
      this.transport.send({ kind: 'RESIGN' });
      this.game.resign(this.localTeam);
      this.inbox.interrupt();
    }

    /** Há quanto tempo (ms) o jogo está parado à espera de uma mensagem do adversário (0 se não está). */
    waitMs() { return this.waitSince && !this.closed && !this.game.state.winner ? Date.now() - this.waitSince : 0; }

    async nextRemote(kind) {
      if (!this.inbox.items.length) this.waitSince = Date.now();
      const msg = await this.inbox.next();
      this.waitSince = 0;
      if (!msg) return null;
      if (msg.kind !== kind) this.desync('tipo inesperado', { esperado: kind, recebido: msg.kind, seq: msg.seq });
      const h = this.game.stateHash();
      if (msg.h != null && msg.h !== h) this.desync('estado diferente', { seq: msg.seq, remoto: msg.h, local: h });
      return msg;
    }

    desync(reason, info) {
      this.desyncs++;
      this.onDesync({ reason, ...info });
    }

    wrapLocal(agent) {
      return {
        isHuman: !!agent.isHuman, isLocal: true, team: this.localTeam,
        playTurn: (g) => agent.playTurn(g),
        respondChain: async (ctx) => {
          let resp = await agent.respondChain(ctx);
          if (typeof resp === 'string') resp = { uid: resp };
          resp = resp && resp.uid ? { uid: resp.uid, target: resp.target || null } : null;
          this.send({ kind: 'CHAIN', resp });
          return resp;
        }
      };
    }

    remoteAgent() {
      const team = this.remoteTeam;
      return {
        isHuman: false, isRemote: true, team,
        playTurn: async (g) => {
          const turn = g.state.turnCount;
          const mine = () => !g.state.winner && !g.aborted && g.state.turnCount === turn && g.state.active === team && g.state.phase !== 'END_PHASE';
          while (mine()) {
            const msg = await this.nextRemote('ACTION');
            if (!msg || !mine()) return;
            if (msg.kind !== 'ACTION') continue;
            const ok = await g.dispatch({ ...msg.action, team, _remote: true });
            if (!ok) this.desync('ação recusada localmente', { seq: msg.seq, type: msg.action.type });
          }
        },
        respondChain: async () => {
          const msg = await this.nextRemote('CHAIN');
          return msg && msg.kind === 'CHAIN' ? msg.resp || null : null;
        }
      };
    }
  }

  /** Par de transportes em memória (testes e depuração). */
  function memoryPair(latencyMs = 0) {
    const make = () => ({ handlers: [], other: null });
    const a = make(), b = make();
    a.other = b; b.other = a;
    const api = (end) => ({
      send(msg) {
        const copy = JSON.parse(JSON.stringify(msg));
        setTimeout(() => end.other.handlers.forEach((h) => h(copy)), latencyMs);
      },
      onMessage(cb) { end.handlers.push(cb); },
      close() { end.handlers = []; }
    });
    return [api(a), api(b)];
  }

  YC.LockstepSession = LockstepSession;
  YC.LockstepSession.memoryPair = memoryPair;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
