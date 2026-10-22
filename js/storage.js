/* ============================================================
   storage.js — Persistência em localStorage (carrinho e histórico)
   ============================================================ */

const Storage = (() => {

  function safeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) { /* quota/privado */ }
  }

  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  /* ---------- CARRINHO ---------- */
  function loadCart() {
    const data = safeGet(CONFIG.STORAGE_KEYS.CART, []);
    return Array.isArray(data) ? data : [];
  }

  function saveCart(items) {
    safeSet(CONFIG.STORAGE_KEYS.CART, items);
  }

  function clearCart() {
    safeRemove(CONFIG.STORAGE_KEYS.CART);
  }

  /* ---------- HISTÓRICO ---------- */
  function loadHistory() {
    const data = safeGet(CONFIG.STORAGE_KEYS.HISTORY, []);
    return Array.isArray(data) ? data : [];
  }

  function saveHistory(items) {
    safeSet(CONFIG.STORAGE_KEYS.HISTORY, items);
  }

  function clearHistory() {
    safeRemove(CONFIG.STORAGE_KEYS.HISTORY);
  }

  return {
    loadCart, saveCart, clearCart,
    loadHistory, saveHistory, clearHistory
  };
})();