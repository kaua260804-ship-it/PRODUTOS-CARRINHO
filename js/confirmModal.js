/* ============================================================
   confirmModal.js — Modal genérico de confirmação
   ------------------------------------------------------------
   Exposto em `window.ConfirmModal` para uso por qualquer módulo
   (cart.js, history.js, etc.). Precisa ser carregado ANTES de
   cart.js e history.js no index.html.
   ============================================================ */

const ConfirmModal = (() => {
  let pendingOnConfirm = null;

  function open({
    title = 'Confirmar',
    message = 'Tem certeza?',
    confirmText = 'Confirmar',
    onConfirm = null
  } = {}) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
      // Fallback: usa o confirm nativo se o modal não existir
      if (typeof onConfirm === 'function' && window.confirm(message)) onConfirm();
      return;
    }
    const titleEl = document.getElementById('confirmTitle');
    const msgEl   = document.getElementById('confirmMessage');
    const okBtn   = document.getElementById('confirmOk');

    if (titleEl) titleEl.textContent = title;
    if (msgEl)   msgEl.textContent   = message;
    if (okBtn)   okBtn.textContent   = confirmText;

    pendingOnConfirm = onConfirm;
    modal.hidden = false;
    if (okBtn) okBtn.focus();
  }

  function close() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.hidden = true;
    pendingOnConfirm = null;
  }

  function init() {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;

    // Fecha ao clicar em qualquer elemento com data-close-modal
    modal.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', close);
    });

    const okBtn = document.getElementById('confirmOk');
    if (okBtn) {
      okBtn.addEventListener('click', () => {
        const fn = pendingOnConfirm;
        close();
        if (typeof fn === 'function') fn();
      });
    }

    // Esc fecha
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  }

  return { init, open, close };
})();

// Expõe globalmente para uso em outros módulos
window.ConfirmModal = ConfirmModal;
