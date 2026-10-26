/* FirebaseClient.js — carrega o SDK modular do Firebase a pedido (import() dinâmico a partir do CDN
   da Google) e expõe login (Google, convidado, convidado → Google) + atalhos do Firestore.
   O jogo contra o bot nunca depende disto: sem rede, o perfil fica só no navegador. */
(function (YC) {
  'use strict';

  let loading = null;

  const ERRORS = {
    'auth/operation-not-allowed': 'Este tipo de login não está ativo. No Firebase: Authentication → Sign-in method → ativa Google e Anónimo.',
    'auth/unauthorized-domain': 'Este domínio não está autorizado. No Firebase: Authentication → Settings → Authorized domains → adiciona o domínio da Vercel.',
    'auth/popup-closed-by-user': 'Fechaste a janela de login antes de terminar.',
    'auth/popup-blocked': 'O navegador bloqueou a janela de login. Permite pop-ups para este site.',
    'auth/network-request-failed': 'Sem ligação à internet.',
    'auth/credential-already-in-use': 'Essa conta Google já tem perfil: entrámos nela (o progresso de convidado fica neste navegador).',
    'permission-denied': 'O Firestore recusou o pedido. Confirma que publicaste o ficheiro firestore.rules.',
    'unavailable': 'O Firestore não respondeu. Verifica a ligação.',
    'failed-precondition': 'O Firestore não está pronto. Cria a base de dados Firestore na consola do Firebase.',
    'not-found': 'Não encontrei a base de dados Firestore. Cria-a na consola do Firebase.'
  };

  const FB = {
    ready: false,
    app: null, auth: null, db: null, A: null, F: null,

    /** Carrega e inicializa o Firebase (uma só vez). */
    load() {
      if (loading) return loading;
      const base = `https://www.gstatic.com/firebasejs/${YC.FIREBASE_SDK_VERSION}/`;
      loading = Promise.all([
        import(`${base}firebase-app.js`), import(`${base}firebase-auth.js`), import(`${base}firebase-firestore.js`)
      ]).then(([appMod, authMod, fsMod]) => {
        FB.app = appMod.initializeApp(YC.FIREBASE_CONFIG);
        FB.auth = authMod.getAuth(FB.app);
        FB.db = fsMod.getFirestore(FB.app);
        FB.A = authMod; FB.F = fsMod; FB.ready = true;
        return FB;
      });
      loading.catch(() => { loading = null; });
      return loading;
    },

    get user() { return FB.auth ? FB.auth.currentUser : null; },
    isGuest(user = FB.user) { return !!user && user.isAnonymous; },
    onUser(cb) { return FB.A.onAuthStateChanged(FB.auth, cb); },
    signInGoogle() { return FB.A.signInWithPopup(FB.auth, new FB.A.GoogleAuthProvider()); },
    /** Convidado → conta Google sem perder o uid (e o progresso). Se a conta já existir, entra nela. */
    async linkGoogle() {
      const provider = new FB.A.GoogleAuthProvider();
      if (!FB.user || !FB.user.isAnonymous) return FB.signInGoogle();
      try { return await FB.A.linkWithPopup(FB.user, provider); }
      catch (err) {
        if (err.code !== 'auth/credential-already-in-use') throw err;
        const cred = FB.A.GoogleAuthProvider.credentialFromError(err);
        return cred ? FB.A.signInWithCredential(FB.auth, cred) : FB.signInGoogle();
      }
    },
    signInGuest() { return FB.A.signInAnonymously(FB.auth); },
    signOut() { return FB.A.signOut(FB.auth); },

    doc(...path) { return FB.F.doc(FB.db, ...path); },
    col(...path) { return FB.F.collection(FB.db, ...path); },
    now() { return FB.F.serverTimestamp(); },
    inc(n) { return FB.F.increment(n); },
    millis(ts) { return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0; },

    /** Mensagem em português para um erro do Firebase. */
    explain(err) {
      if (!err) return 'Erro desconhecido.';
      const code = err.code || '';
      return ERRORS[code] || ERRORS[code.replace(/^firestore\//, '')] || err.message || String(err);
    }
  };

  YC.Firebase = FB;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
