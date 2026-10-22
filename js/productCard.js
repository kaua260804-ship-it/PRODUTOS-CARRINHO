/* ============================================================
   productCard.js — Renderização do card do produto pesquisado
   ============================================================ */

const ProductCard = (() => {
  let root = null;
  let currentProduct = null;

  function init() {
    root = document.getElementById('productResult');
    if (!root) return;
    // Delegação de eventos (o conteúdo é dinâmico)
    root.addEventListener('click', onRootClick);
    root.addEventListener('change', onRootChange);
  }

  function render(product) {
    if (!root) return;
    currentProduct = product;

    const precoHtml = product.precoEncontrado
      ? `<span class="price-value">${Utils.formatBRL(product.preco)}</span>`
      : `<span class="price-value price-missing"><i class="fa-solid fa-triangle-exclamation"></i> R$ 0,00</span>
         <span class="price-warning">Preço não cadastrado</span>`;

    const jaNoCarrinho = Cart.has(product.seqproduto);
    const qtdAtual = Cart.getQty(product.seqproduto);

    const alertHtml = jaNoCarrinho ? `
      <div class="already-in-cart">
        <i class="fa-solid fa-circle-info"></i>
        <span>Este item já está no carrinho (<strong>${qtdAtual}</strong> ${qtdAtual === 1 ? 'unidade' : 'unidades'}).</span>
        <button data-action="update-qty">Atualizar quantidade</button>
      </div>
    ` : '';

    root.innerHTML = `
      <div class="card product-card" data-seq="${Utils.escapeHtml(product.seqproduto)}">
        <div class="product-head">
          <div class="product-title-wrap">
            <h3 class="product-name">${Utils.escapeHtml(product.produto)}</h3>
            <span class="badge badge-primary product-seq">
              <i class="fa-solid fa-hashtag"></i> ${Utils.escapeHtml(product.seqproduto)}
            </span>
          </div>
        </div>

        <div class="product-info-grid">
          <div class="info-item">
            <span class="info-label">Categoria</span>
            <span class="info-value ${product.categoria === '—' ? 'text-muted' : ''}">${Utils.escapeHtml(product.categoria)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Grupo</span>
            <span class="info-value ${product.grupo === '—' ? 'text-muted' : ''}">${Utils.escapeHtml(product.grupo)}</span>
          </div>
          <div class="info-item info-price">
            <span class="info-label">Nosso Preço</span>
            <span class="info-value">${precoHtml}</span>
          </div>
        </div>

        <div class="product-actions">
          <div class="qty-field">
            <label for="qtyInput">Qtd.</label>
            <input
              id="qtyInput"
              type="number"
              class="input qty-input"
              value="1"
              min="1"
              step="1"
              inputmode="numeric"
              aria-label="Quantidade">
          </div>
          <button class="btn btn-success btn-add-cart" data-action="add">
            <i class="fa-solid fa-plus"></i> Adicionar ao Carrinho
          </button>
        </div>

        ${alertHtml}
      </div>
    `;

    // Foco no botão adicionar para uso rápido em loja
    setTimeout(() => {
      const addBtn = root.querySelector('[data-action="add"]');
      if (addBtn) addBtn.focus({ preventScroll: true });
    }, 60);
  }

  function onRootChange(e) {
    // Normaliza quantidade mínima
    if (e.target.matches('#qtyInput')) {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < 1) { v = 1; e.target.value = '1'; }
    }
  }

  function onRootClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || !currentProduct) return;
    const action = btn.getAttribute('data-action');

    if (action === 'add') {
      const qtyInput = root.querySelector('#qtyInput');
      const qty = Math.max(1, parseInt(qtyInput?.value, 10) || 1);
      const res = Cart.add(currentProduct, qty);
      // Re-renderiza o card para refletir "já no carrinho"
      render(currentProduct);
      // Foco de volta no input de código de barras (agiliza próxima leitura)
      setTimeout(() => {
        const bc = document.getElementById('barcodeInput');
        if (bc) bc.focus();
      }, 80);
      // Pequena animação
      if (res && !res.updated) {
        const cardEl = root.querySelector('.product-card');
        if (cardEl) {
          cardEl.classList.add('just-added');
          setTimeout(() => cardEl.classList.remove('just-added'), 600);
        }
      }
    }

    if (action === 'update-qty') {
      const qtyInput = root.querySelector('#qtyInput');
      const qty = Math.max(1, parseInt(qtyInput?.value, 10) || 1);
      Cart.setQty(currentProduct.seqproduto, Cart.getQty(currentProduct.seqproduto) + qty);
      render(currentProduct);
      Toast.success(`Quantidade de ${currentProduct.produto} atualizada.`, 'Carrinho');
    }
  }

  /**
   * Exibe um card de erro (produto não encontrado) com sugestões.
   */
  function renderNotFound(query, suggestions = []) {
    if (!root) return;
    currentProduct = null;
    const sugHtml = suggestions.length
      ? `<div class="not-found-suggestions">
           <p class="nf-sub">Você quis dizer?</p>
           <ul>
             ${suggestions.map(s => `
               <li>
                 <button class="suggestion-btn" data-seq="${Utils.escapeHtml(s.seqproduto)}">
                   <i class="fa-solid fa-magnifying-glass"></i>
                   <span>${Utils.escapeHtml(s.produto)}</span>
                   <span class="badge badge-gray">SEQ ${Utils.escapeHtml(s.seqproduto)}</span>
                 </button>
               </li>
             `).join('')}
           </ul>
         </div>`
      : '';

    root.innerHTML = `
      <div class="card not-found-card">
        <div class="not-found-head">
          <i class="fa-solid fa-circle-exclamation"></i>
          <h3>Produto não encontrado</h3>
        </div>
        <p>Não localizamos "<strong>${Utils.escapeHtml(query)}</strong>" na base.</p>
        ${sugHtml}
      </div>
    `;

    // Clique em sugestão
    root.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const seq = btn.getAttribute('data-seq');
        SearchEngine.selectProduct(seq);
      });
    });
  }

  function clear() {
    if (root) root.innerHTML = '';
    currentProduct = null;
  }

  return { init, render, renderNotFound, clear };
})();