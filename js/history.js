/* ============================================================
   history.js — Histórico de pesquisas (últimos 20)
   ============================================================ */

const History = (() => {
  let items = [];
  let listEl = null;
  let btnClear = null;

  function init() {
    listEl = document.getElementById('historyList');
    btnClear = document.getElementById('btnClearHistory');

    items = Storage.loadHistory().map(sanitize).filter(Boolean);
    if (items.length > CONFIG.MAX_HISTORY) items = items.slice(0, CONFIG.MAX_HISTORY);

    render();

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (!items.length) { Toast.info('Histórico já está vazio.'); return; }
        if (window.ConfirmModal) {
          window.ConfirmModal.open({
            title: 'Limpar histórico',
            message: 'Remover todos os itens do histórico da sessão?',
            confirmText: 'Limpar',
            onConfirm: () => {
              items = [];
              Storage.clearHistory();
              render();
              Toast.success('Histórico limpo.');
            }
          });
        }
      });
    }

    // OUVINTE DE CLIQUE DO HISTÓRICO
    if (listEl) {
      listEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-seq]');
        if (!btn) return;
        
        const seq = btn.getAttribute('data-seq');
        console.log('[history] Clicou no produto SEQ:', seq);

        // Busca o produto na base de dados
        const product = DataProcessor.getBySeq(seq);
        
        if (!product) {
          console.error('[history] Produto não encontrado no DataProcessor:', seq);
          Toast.error('Produto não encontrado na base.');
          return;
        }

        // 1. Renderiza o card do produto (isso faz o botão "Adicionar" aparecer)
        if (window.ProductCard) {
          ProductCard.render(product, { scroll: true });
        } else {
          console.error('[history] ProductCard não está definido!');
        }

        // 2. Sobe para o topo do histórico
        push(product);
      });
    }
  }

  function sanitize(it) {
    if (!it || !it.seqproduto) return null;
    return {
      seqproduto: String(it.seqproduto),
      produto: String(it.produto || ''),
      preco: Number(it.preco) || 0,
      precoEncontrado: !!it.precoEncontrado,
      categoria: it.categoria || '—',
      grupo: it.grupo || '—',
      ts: Number(it.ts) || Date.now()
    };
  }

  function push(product) {
    if (!product || !product.seqproduto) return;
    const seq = String(product.seqproduto);
    items = items.filter(i => i.seqproduto !== seq);
    items.unshift({
      seqproduto: seq,
      produto: product.produto,
      preco: Number(product.preco) || 0,
      precoEncontrado: !!product.precoEncontrado,
      categoria: product.categoria || '—',
      grupo: product.grupo || '—',
      ts: Date.now()
    });
    if (items.length > CONFIG.MAX_HISTORY) items = items.slice(0, CONFIG.MAX_HISTORY);
    Storage.saveHistory(items);
    render();
  }

  function render() {
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = `<li class="empty-state small"><i class="fa-regular fa-clock"></i> Nenhuma pesquisa ainda.</li>`;
      return;
    }
    listEl.innerHTML = items.map(it => {
      const precoTxt = it.precoEncontrado
        ? Utils.formatBRL(it.preco)
        : '<span class="text-warning">sem preço</span>';
      return `
        <li>
          <button class="history-item" data-seq="${Utils.escapeHtml(it.seqproduto)}" title="Reabrir produto">
            <div class="hi-main">
              <span class="hi-name">${Utils.escapeHtml(it.produto)}</span>
              <span class="hi-meta">SEQ ${Utils.escapeHtml(it.seqproduto)} • ${precoTxt}</span>
            </div>
            <i class="fa-solid fa-arrow-right hi-arrow"></i>
          </button>
        </li>
      `;
    }).join('');
  }

  return { init, push, render };
})();
