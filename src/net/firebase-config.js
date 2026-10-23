/* firebase-config.js — configuração pública da app web do Firebase (projeto "yuchess").
   Estes valores não são segredos: identificam o projeto. A segurança vem das regras do
   Firestore (firestore.rules) e dos domínios autorizados no Firebase Authentication. */
(function (YC) {
  'use strict';
  YC.FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAwTqVi-JMXvaG-Py1SQNhvswoC4NYYO88',
    authDomain: 'yuchess.firebaseapp.com',
    projectId: 'yuchess',
    storageBucket: 'yuchess.firebasestorage.app',
    messagingSenderId: '827904798026',
    appId: '1:827904798026:web:48f978ea88a3f96400e5b3',
    measurementId: 'G-JTSJ16QCXT'
  };
  YC.FIREBASE_SDK_VERSION = '12.3.0';
  // Google Analytics fica desligado: na UE precisaria de aviso de consentimento antes de ligar.
  YC.FIREBASE_ANALYTICS = false;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
