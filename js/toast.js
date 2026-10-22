/* ============================================================
   toast.js — Notificações flutuantes (toasts)
   ============================================================ */

const Toast = (() => {
  const container = () => document.getElementById('toastContainer');

  const ICONS = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  /**
   * Exibe um toast.
   * @param {string} message  Texto principal
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {string} [title]  Título opcional
   */
  function show(message, type = 'info', title = '') {
    const box = container();
    if (!box) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');

    const titleHtml = title
      ? `<div class="toast-title">${Utils.escapeHtml(title)}</div>`
      : '';

    el.innerHTML = `
      <i class="fa-solid ${ICONS[type] || ICONS.info}"></i>
      <div class="toast-body">
        ${titleHtml}
        <div class="toast-msg">${Utils.escapeHtml(message)}</div>
      </div>
    `;

    box.appendChild(el);

    // Remove após o tempo configurado
    const duration = CONFIG.TOAST_DURATION;
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 220);
    }, duration);
  }

  return {
    success: (m, t) => show(m, 'success', t),
    error:   (m, t) => show(m, 'error', t),
    warning: (m, t) => show(m, 'warning', t),
    info:    (m, t) => show(m, 'info', t),
    show
  };
})();