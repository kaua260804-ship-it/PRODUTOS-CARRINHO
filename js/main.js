/* ============================================================
   main.js — Inicialização e orquestração do app

   ------------------------------------------------------------
   DEPLOY — GitHub Pages (instruções)
   ------------------------------------------------------------
   1) Crie um repositório no GitHub e envie todos os arquivos
      (index.html, css/, js/, dados/BASE.xlsx e .gitignore).
   2) Em Settings → Pages:
        - Source: "Deploy from a branch"
        - Branch: main  /  Folder: /(root)
   3) Aguarde alguns minutos. O site ficará em:
        https://<usuario>.github.io/<repositorio>/
   4) IMPORTANTE: a planilha em dados/BASE.xlsx precisa estar
      versionada no repositório. Para atualizar preços, basta
      substituir o arquivo e dar commit/push.
   5) O processamento é 100% client-side — nenhum dado sai do
      navegador do usuário. Após o primeiro carregamento, os
      assets em cache permitem uso offline (a planilha, porém,
      precisa estar em cache/service worker para offline pleno).

   ------------------------------------------------------------
   ORDEM DE BOOT:
     1. ConfirmModal.init()
     2. Cart.init()  (carrega localStorage)
     3. History.init()  (carrega localStorage)
     4. ProductCard.init()
     5. SearchEngine.init()
     6. Scanner.init()
     7. FileReaderXLS.load() → DataProcessor.build()
     8. Atualiza status do header + esconde loading
   ============================================================ */

(function () {
  'use strict';

  /* ------------------------------------------------------------
     STATUS DO HEADER
     ------------------------------------------------------------
     Classes possíveis: (nenhuma) | status-ready | status-error
     IMPORTANTE: só adicionamos classes quando o nome não é vazio
     (evita o erro "The token provided must not be empty").
     ------------------------------------------------------------ */
  function setHeaderStatus(type, text) {
    const el = document.getElementById('headerStatus');
    const txt = document.getElementById('headerStatusText');
    if (!el || !txt) return;

    // Limpa classes de estado anteriores
    el.classList.remove('status-ready', 'status-error');

    // Adiciona a classe de estado conforme o tipo (nunca vazio)
    if (type === 'ready') {
      el.classList.add('status-ready');
    } else if (type === 'error') {
      el.classList.add('status-error');
    }
    // 'loading' ou qualquer outro tipo: nenhuma classe adicional

    // Atualiza ícone
    const icon = el.querySelector('i');
    if (icon) {
      if (type === 'ready') {
        icon.className = 'fa-solid fa-circle-check';
      } else if (type === 'error') {
        icon.className = 'fa-solid fa-circle-exclamation';
      } else {
        icon.className = 'fa-solid fa-circle-notch fa-spin';
      }
    }

    // Atualiza texto
    txt.textContent = text || '';
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }

  /* ---------- Boot principal ---------- */
  async function boot() {
    // 1) Componentes de UI que não dependem de dados
    try { ConfirmModal.init(); } catch (e) { console.warn('[boot] ConfirmModal:', e); }
    try { Cart.init(); } catch (e) { console.warn('[boot] Cart:', e); }
    try { History.init(); } catch (e) { console.warn('[boot] History:', e); }
    try { ProductCard.init(); } catch (e) { console.warn('[boot] ProductCard:', e); }
    try { SearchEngine.init(); } catch (e) { console.warn('[boot] SearchEngine:', e); }
    try { Scanner.init(); } catch (e) { console.warn('[boot] Scanner:', e); }

    // 2) Carregar planilha
    setHeaderStatus('loading', 'Carregando planilha…');
    try {
      const data = await FileReaderXLS.load();
      const stats = DataProcessor.build(data);

      setHeaderStatus(
        'ready',
        `${stats.baseCount.toLocaleString('pt-BR')} produtos • ${stats.barcodesCount.toLocaleString('pt-BR')} códigos`
      );

      Toast.success(
        `Base carregada: ${stats.baseCount.toLocaleString('pt-BR')} produtos e ${stats.barcodesCount.toLocaleString('pt-BR')} códigos.`,
        'Pronto para usar'
      );
    } catch (err) {
      console.error('[boot] falha ao carregar planilha:', err);
      setHeaderStatus('error', 'Falha ao carregar planilha');
      Toast.error(
        `Não foi possível carregar dados/BASE.xlsx. Verifique se o arquivo existe na pasta "dados/". Detalhe: ${err.message}`,
        'Erro crítico'
      );
    } finally {
      hideLoading();
      // Foco no input principal após carregar
      setTimeout(() => {
        const bc = document.getElementById('barcodeInput');
        if (bc) bc.focus();
      }, 150);
    }
  }

  /* ---------- Atalhos globais ---------- */
  function bindGlobalShortcuts() {
    // "/" foca o campo de descrição; F2 foca o código de barras
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const editing = tag === 'INPUT' || tag === 'TEXTAREA';

      if (!editing && e.key === '/') {
        e.preventDefault();
        const d = document.getElementById('descInput');
        if (d) d.focus();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        const b = document.getElementById('barcodeInput');
        if (b) { b.focus(); b.select(); }
      }
    });
  }

  /* ---------- Start ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    bindGlobalShortcuts();
    boot();
  });

  // Expõe helpers úteis para debug no console
  window.App = {
    DataProcessor,
    Cart,
    History,
    Scanner,
    SearchEngine,
    ProductCard,
    Toast,
    Utils,
    ConfirmModal
  };
})();
