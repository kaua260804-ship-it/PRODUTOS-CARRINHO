/* ============================================================
   utils.js — Funções utilitárias (normalização, formatação, debounce)
   ============================================================ */

const Utils = (() => {

  /**
   * Normaliza uma string: minúscula, sem acentos, espaços colapsados.
   * Ex.: "FILE DE PEITO DE FRANGO" -> "file de peito de frango"
   */
  function normalize(str) {
    if (str == null) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Quebra uma busca em tokens normalizados.
   * Ex.: "file  frango" -> ["file", "frango"]
   */
  function tokenize(str) {
    const n = normalize(str);
    return n ? n.split(' ') : [];
  }

  /**
   * Verifica se TODOS os tokens estão contidos no texto (AND).
   */
  function matchesAllTokens(text, tokens) {
    if (!tokens.length) return false;
    const haystack = normalize(text);
    return tokens.every(t => haystack.includes(t));
  }

  /**
   * Formata número em Real brasileiro. Ex.: 12.5 -> "R$ 12,50"
   */
  function formatBRL(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /**
   * Converte entrada numérica (texto com vírgula/ponto) em number.
   * Aceita "12,50", "R$ 12,50", "1.234,56".
   */
  function parsePrice(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value;
    let s = String(value).trim().replace(/[R$\s]/g, '');
    // Formato pt-BR: ponto = milhar, vírgula = decimal
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Escapa texto para uso seguro em HTML (previne XSS).
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escapa e envolve os termos buscados em <mark>.
   */
  function highlight(text, tokens) {
    if (!tokens || !tokens.length) return escapeHtml(text);
    const safe = escapeHtml(text);
    const norm = normalize(safe);
    // Marca por intervalos encontrados, depois monta o HTML
    const ranges = [];
    tokens.forEach(tok => {
      if (!tok) return;
      let idx = 0;
      while ((idx = norm.indexOf(tok, idx)) !== -1) {
        ranges.push([idx, idx + tok.length]);
        idx += tok.length;
      }
    });
    if (!ranges.length) return safe;
    // Unifica intervalos sobrepostos
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach(r => {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([...r]);
    });
    let out = '';
    let cursor = 0;
    for (const [s, e] of merged) {
      out += safe.slice(cursor, s) + '<mark>' + safe.slice(s, e) + '</mark>';
      cursor = e;
    }
    out += safe.slice(cursor);
    return out;
  }

  /**
   * Debounce: adia execução de fn até que pare de chamar por `wait` ms.
   */
  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /**
   * Gera um id curto (útil para nós temporários).
   */
  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Toca um "beep" curto usando Web Audio API (feedback sonoro).
   */
  function beep(freq = 880, duration = 0.12) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
      osc.onended = () => ctx.close().catch(() => {});
    } catch (_) { /* silencioso */ }
  }

  /**
   * Vibração curta (mobile).
   */
  function vibrate(ms = 60) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  return {
    normalize,
    tokenize,
    matchesAllTokens,
    formatBRL,
    parsePrice,
    escapeHtml,
    highlight,
    debounce,
    uid,
    beep,
    vibrate
  };
})();