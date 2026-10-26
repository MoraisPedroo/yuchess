/* ProfileStore.js — guarda o perfil do jogador (ouro, poeira, coleção, baralhos, pity, estatísticas).
   Sempre no localStorage; com login também no Firestore em users/{uid} (só o próprio lê e escreve).
   Ao entrar: se a conta já tem perfil na nuvem usa-o; se não, sobe o perfil deste navegador. */
(function (YC) {
  'use strict';

  const KEY = 'chessgioh.profile.v1';
  const FB = () => YC.Firebase;
  const FIELDS = ['version', 'displayName', 'gold', 'stardust', 'inventory', 'decks', 'activeDeckId', 'pityEpic', 'pityLegendary', 'stats', 'updatedAt'];

  const Store = {
    profile: null,
    uid: null,
    cloud: 'off',          // off | syncing | ok | error
    listeners: new Set(),
    timer: null,

    load() {
      let data = null;
      try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (err) { data = null; }
      Store.profile = YC.Economy.normalize(data || YC.Economy.newProfile());
      return Store.profile;
    },

    onChange(cb) { Store.listeners.add(cb); return () => Store.listeners.delete(cb); },
    emit() { Store.listeners.forEach((cb) => { try { cb(Store.profile); } catch (e) { console.error(e); } }); },

    pick(p) { const o = {}; for (const k of FIELDS) o[k] = p[k]; return JSON.parse(JSON.stringify(o)); },

    /** Grava já no navegador e, com login, na nuvem (agrupado a cada 1,5 s). */
    save() {
      const p = Store.profile;
      p.updatedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (err) { console.warn('[perfil] localStorage', err); }
      Store.emit();
      if (!Store.uid) return;
      clearTimeout(Store.timer);
      Store.timer = setTimeout(() => Store.push(), 1500);
    },

    async push() {
      if (!Store.uid || !FB().ready) return;
      Store.cloud = 'syncing'; Store.emit();
      try {
        await FB().F.setDoc(FB().doc('users', Store.uid), { ...Store.pick(Store.profile), isAnonymous: FB().isGuest(), savedAt: FB().now() });
        Store.cloud = 'ok';
      } catch (err) {
        Store.cloud = 'error';
        console.warn('[perfil] gravar na nuvem', err);
      }
      Store.emit();
    },

    /** Chamado quando o login muda. */
    async attach(user) {
      Store.uid = user ? user.uid : null;
      if (!user) { Store.cloud = 'off'; Store.emit(); return; }
      Store.cloud = 'syncing'; Store.emit();
      try {
        const snap = await FB().F.getDoc(FB().doc('users', user.uid));
        if (snap.exists()) {
          Store.profile = YC.Economy.normalize(snap.data());
          try { localStorage.setItem(KEY, JSON.stringify(Store.profile)); } catch (err) { /* sem espaço */ }
          Store.cloud = 'ok';
          Store.emit();
        } else {
          if (user.displayName && Store.profile.displayName === 'Duelista') Store.profile.displayName = user.displayName.slice(0, 20);
          await Store.push();
        }
      } catch (err) {
        Store.cloud = 'error';
        console.warn('[perfil] ler da nuvem', err);
        Store.emit();
      }
    },

    /** Muda o perfil com uma função e grava. */
    update(fn) {
      const out = fn(Store.profile);
      Store.save();
      return out;
    }
  };

  YC.ProfileStore = Store;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
