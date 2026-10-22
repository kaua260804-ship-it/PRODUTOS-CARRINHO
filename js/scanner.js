/* ============================================================
   scanner.js — Leitura de código de barras via câmera
   (html5-qrcode) + entrada manual (scanner USB)
   ============================================================ */

const Scanner = (() => {
  let html5Qr = null;
  let scanning = false;
  let lastText = '';
  let lastTs = 0;

  const modal = () => document.getElementById('scannerModal');
  const readerEl = () => document.getElementById('qrReader');
  const inputEl = () => document.getElementById('barcodeInput');
  const btnScanEl = () => document.getElementById('btnScan');

  /* ---------- Entrada manual / scanner USB ---------- */
  function initManualInput() {
    const input = inputEl();
    if (!input) return;

    // Enter no campo: dispara busca
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = input.value.trim();
        if (!code) return;
        handleCode(code);
      }
    });

    // Foco contínuo: ao perder foco, recupera (a menos que clicou em outro input)
    input.addEventListener('blur', () => {
      setTimeout(() => {
        const active = document.activeElement;
        const isOtherField = active && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'BUTTON'
        );
        if (!isOtherField && !scanning && !document.querySelector('.modal:not([hidden])')) {
          input.focus();
        }
      }, 120);
    });
  }

  /**
   * Processa um código lido (câmera ou digitação).
   */
  function handleCode(rawCode) {
    const code = String(rawCode).trim();
    if (!code) return;

    // Evita duplicidade em leituras muito próximas (câmera lê várias vezes)
    const now = Date.now();
    if (code === lastText && now - lastTs < 1500) return;
    lastText = code;
    lastTs = now;

    const product = DataProcessor.findByBarcode(code);

    Utils.beep(product ? 880 : 260, 0.12);
    Utils.vibrate(product ? 60 : 120);

    if (!product) {
      Toast.error(`Código "${code}" não encontrado. Tente buscar pela descrição.`, 'Não encontrado');
      // Sugere busca por descrição usando o código (improvável) — não faz auto
      return;
    }

    // Renderiza card + histórico
    if (window.ProductCard) ProductCard.render(product);
    if (window.History) History.push(product);

    Toast.success(product.produto, 'Produto identificado');

    // Limpa campo e mantém foco
    const input = inputEl();
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  /* ---------- Câmera ---------- */
  async function openCamera() {
    const modalEl = modal();
    const reader = readerEl();
    if (!modalEl || !reader) return;

    modalEl.hidden = false;
    reader.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Abrindo câmera…';

    try {
      if (!window.Html5Qrcode) {
        throw new Error('Biblioteca de leitura não carregada.');
      }
      html5Qr = new Html5Qrcode('qrReader', { verbose: false });
      scanning = true;

      await html5Qr.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (vw, vh) => {
            const min = Math.min(vw, vh);
            const w = Math.floor(min * 0.85);
            const h = Math.floor(w * 0.55);
            return { width: w, height: h };
          },
          formatsToSupport: CONFIG.BARCODE_FORMATS,
          aspectRatio: 1.3
        },
        (decodedText) => {
          // Sucesso
          reader.classList.add('scan-success');
          setTimeout(() => reader.classList.remove('scan-success'), 400);
          handleCode(decodedText);
          // Fecha após pequena pausa para ver o flash
          setTimeout(closeCamera, 400);
        },
        () => { /* erros de frame: ignora */ }
      );
    } catch (err) {
      console.error('[scanner] erro:', err);
      Toast.error('Não foi possível acessar a câmera. Verifique permissões.', 'Câmera');
      closeCamera();
    }
  }

  async function closeCamera() {
    const modalEl = modal();
    if (modalEl) modalEl.hidden = true;
    const reader = readerEl();
    if (reader) reader.innerHTML = '';

    if (html5Qr) {
      try {
        if (scanning) await html5Qr.stop();
        await html5Qr.clear();
      } catch (_) {}
      html5Qr = null;
    }
    scanning = false;
    // Retorna foco ao input
    setTimeout(() => { const i = inputEl(); if (i) i.focus(); }, 80);
  }

  function initCameraButton() {
    const btn = btnScanEl();
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (scanning) closeCamera();
      else openCamera();
    });

    // Botões de fechar modal
    document.querySelectorAll('#scannerModal [data-close-modal]').forEach(el => {
      el.addEventListener('click', closeCamera);
    });

    // Esc fecha
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && scanning) closeCamera();
    });
  }

  function init() {
    initManualInput();
    initCameraButton();
    // Foco inicial
    const i = inputEl();
    if (i) setTimeout(() => i.focus(), 200);
  }

  return {
    init,
    handleCode,
    openCamera,
    closeCamera
  };
})();