/* UIKit.js — utilitários da interface: avisos (toasts), confirmações e janelas simples. */
(function (YC) {
  'use strict';

  const UI = {
    toast(msg, bad = false, ms = 2600) {
      let box = document.getElementById('toasts');
      if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
      const t = document.createElement('div');
      t.className = `toast${bad ? ' bad' : ''}`;
      t.textContent = msg;
      box.appendChild(t);
      while (box.children.length > 3) box.firstChild.remove();
      setTimeout(() => { t.style.transition = 'opacity .3s, transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 320); }, ms);
    },

    modal(html, { onClose, cls = '' } = {}) {
      const back = document.createElement('div');
      back.className = 'modal-back';
      back.innerHTML = `<div class="modal ${cls}">${html}</div>`;
      document.body.appendChild(back);
      const close = () => { back.remove(); if (onClose) onClose(); };
      back.addEventListener('click', (e) => { if (e.target === back) close(); });
      return { el: back.firstChild, close };
    },

    confirm(title, text, okLabel = 'Sim') {
      return new Promise((resolve) => {
        const m = UI.modal(`<h2>${title}</h2><p>${text}</p><div class="row"><button class="btn ghost-dark" data-a="no">Cancelar</button><button class="btn red" data-a="yes">${okLabel}</button></div>`, { onClose: () => resolve(false) });
        m.el.querySelector('[data-a="no"]').onclick = () => { m.el.parentNode.remove(); resolve(false); };
        m.el.querySelector('[data-a="yes"]').onclick = () => { m.el.parentNode.remove(); resolve(true); };
      });
    },

    prompt(title, text, value = '', okLabel = 'OK') {
      return new Promise((resolve) => {
        const m = UI.modal(`<h2>${title}</h2><p>${text}</p><input class="text-in" maxlength="24" value="${YC.HoloCard.esc(value)}"><div class="row"><button class="btn ghost-dark" data-a="no">Cancelar</button><button class="btn" data-a="yes">${okLabel}</button></div>`, { onClose: () => resolve(null) });
        const input = m.el.querySelector('input');
        input.focus(); input.select();
        const ok = () => { m.el.parentNode.remove(); resolve(input.value.trim()); };
        input.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
        m.el.querySelector('[data-a="no"]').onclick = () => { m.el.parentNode.remove(); resolve(null); };
        m.el.querySelector('[data-a="yes"]').onclick = ok;
      });
    }
  };

  YC.UI = UI;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
