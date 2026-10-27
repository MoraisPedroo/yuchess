/* UIKit.js — utilitários da interface: avisos (toasts), confirmações e janelas (modais de plástico com botão
   de fechar vermelho no canto, Escape para fechar). */
(function (YC) {
  'use strict';

  const UI = {
    toast(msg, bad = false, ms = 2600) {
      let box = document.getElementById('toasts');
      if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
      const t = document.createElement('div');
      t.className = `toast${bad ? ' bad' : ''}`;
      t.setAttribute('role', 'status');
      t.textContent = msg;
      box.appendChild(t);
      while (box.children.length > 3) box.firstChild.remove();
      setTimeout(() => { t.style.transition = 'opacity .15s, transform .15s'; t.style.opacity = '0'; t.style.transform = 'translateY(-16px)'; setTimeout(() => t.remove(), 170); }, ms);
    },

    modal(html, { onClose, cls = '' } = {}) {
      const back = document.createElement('div');
      back.className = 'modal-back';
      back.innerHTML = `<div class="modal ${cls}" role="dialog"><button class="modal-x" title="Fechar">${YC.Icon ? YC.Icon('close', { size: 20 }) : '×'}</button>${html}</div>`;
      document.body.appendChild(back);
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        window.removeEventListener('keydown', key);
        const done = () => { back.remove(); if (onClose) onClose(); };
        if (window.gsap) window.gsap.to(back, { opacity: 0, duration: 0.16, ease: 'power1.in', onComplete: done }); else done();
      };
      const key = (e) => { if (e.key === 'Escape') close(); };
      window.addEventListener('keydown', key);
      back.addEventListener('click', (e) => { if (e.target === back) close(); });
      back.querySelector('.modal-x').onclick = close;
      return { el: back.firstChild, close };
    },

    confirm(title, text, okLabel = 'Sim') {
      return new Promise((resolve) => {
        let answered = false;
        const m = UI.modal(`<h2>${title}</h2><p>${text}</p><div class="row"><button class="btn secondary" data-a="no">Cancelar</button><button class="btn danger" data-a="yes">${okLabel}</button></div>`,
          { onClose: () => { if (!answered) resolve(false); } });
        m.el.querySelector('[data-a="no"]').onclick = () => { answered = true; resolve(false); m.close(); };
        m.el.querySelector('[data-a="yes"]').onclick = () => { answered = true; resolve(true); m.close(); };
      });
    },

    prompt(title, text, value = '', okLabel = 'OK') {
      return new Promise((resolve) => {
        let answered = false;
        const m = UI.modal(`<h2>${title}</h2><p>${text}</p><input class="text-in" maxlength="24" value="${YC.HoloCard.esc(value)}"><div class="row"><button class="btn secondary" data-a="no">Cancelar</button><button class="btn" data-a="yes">${okLabel}</button></div>`,
          { onClose: () => { if (!answered) resolve(null); } });
        const input = m.el.querySelector('input');
        input.focus(); input.select();
        const ok = () => { answered = true; resolve(input.value.trim()); m.close(); };
        input.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
        m.el.querySelector('[data-a="no"]').onclick = () => { answered = true; resolve(null); m.close(); };
        m.el.querySelector('[data-a="yes"]').onclick = ok;
      });
    }
  };

  YC.UI = UI;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
