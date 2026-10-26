/* EventBus.js — Pub/Sub síncrono + assíncrono e PRNG determinístico (mulberry32).
   O motor emite eventos; o ecrã ouve-os e anima (emitAsync espera pelas animações). */
(function (YC) {
  'use strict';

  class EventBus {
    constructor() {
      this.handlers = new Map();
      this.debug = false;
    }

    on(type, fn) {
      if (!this.handlers.has(type)) this.handlers.set(type, new Set());
      this.handlers.get(type).add(fn);
      return () => this.off(type, fn);
    }

    once(type, fn) {
      const off = this.on(type, (p) => { off(); return fn(p); });
      return off;
    }

    off(type, fn) {
      const set = this.handlers.get(type);
      if (set) set.delete(fn);
    }

    /** Dispara sem esperar. Erros num ouvinte não quebram os restantes. */
    emit(type, payload) {
      if (this.debug) console.log('[bus]', type, payload);
      const list = [...(this.handlers.get(type) || []), ...(this.handlers.get('*') || [])];
      for (const fn of list) {
        try { fn(payload, type); } catch (err) { console.error('[EventBus]', type, err); }
      }
    }

    /** Dispara e espera por todos os ouvintes (animações, sons longos, etc.). */
    async emitAsync(type, payload) {
      if (this.debug) console.log('[bus:async]', type, payload);
      const list = [...(this.handlers.get(type) || [])];
      const wild = [...(this.handlers.get('*') || [])];
      for (const fn of wild) { try { fn(payload, type); } catch (err) { console.error(err); } }
      await Promise.all(list.map(async (fn) => {
        try { await fn(payload, type); } catch (err) { console.error('[EventBus async]', type, err); }
      }));
    }

    clear() { this.handlers.clear(); }
  }

  /** PRNG determinístico: mesma semente → mesmos baralhos (base do lockstep multijogador). */
  function mulberry32(seed) {
    let a = seed >>> 0;
    const next = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (n) => Math.floor(next() * n);
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    return next;
  }

  /** Promessa com resolve/reject expostos (usada para esperar por decisões do jogador). */
  function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  YC.EventBus = EventBus;
  YC.mulberry32 = mulberry32;
  YC.deferred = deferred;
  // Equipas: 'w' (Brancas) e 'b' (Pretas). No Firestore guardam-se como 'WHITE'/'BLACK' (TEAM_NAME).
  const OTHER = { w: 'b', b: 'w', WHITE: 'BLACK', BLACK: 'WHITE' };
  YC.TEAMS = ['w', 'b'];
  YC.other = (team) => OTHER[team];
  YC.TEAM_LABEL = { w: 'Brancas', b: 'Pretas', WHITE: 'Brancas', BLACK: 'Pretas' };
  YC.TEAM_NAME = { w: 'WHITE', b: 'BLACK' };
  YC.TEAM_CODE = { WHITE: 'w', BLACK: 'b' };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
