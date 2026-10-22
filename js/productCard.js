/* ============================================================
   productCard.js — Renderização do card do produto pesquisado
   ------------------------------------------------------------
   Melhorias desta versão:
     - Sempre que renderiza, faz scroll suave até o card
       (útil quando o usuário clica em histórico/autocomplete)
     - Destaque visual quando o produto já está no carrinho
     - Input de quantidade SEMPRE visível e editável
     - Botão "Adicionar" grande e destacado
     - Botão "Atualizar quantidade" quando já existe
   ============================================================ */

const ProductCard = (() => {
  let root = null;
  let currentProduct = null;

  function init() {
    root = document.getElementById('productResult');
    if (!root) return;
    root.addEventListener('click', onRootClick);
    root.addEventListener('change', onRootChange);
  }

  /**
   * Renderiza o card e rola até ele.
   * @param {object} product
   * @param {{scroll?: boolean}} [opts]
   */
  function render(product, opts = {}) {
    if (!root || !product) return;
    currentProduct = product;

    const precoHtml = product.precoEncontrado
      ? `<span class="price-value">${Utils.formatBRL(product.preco)}</span>`
      : `<span class="price-value price-missing"><i class="fa-solid fa-triangle-exclamation"></i> R$ 0,00</span>
         <span class="price-warning">Preço não cadastrado</span>`;

    const jaNoCarrinho = Cart.has(product.seqproduto);
    const qtdAtual = Cart.getQty(product.seqproduto);

    const alertHtml = jaNoCarrinho
      ? `<div class="already-in-cart">
           <i class="fa-solid fa-circle-info"></i>
           <span>Este item já está no carrinho (<strong>${qtdAtual}</strong> ${qtdAtual === 1 ? 'unidade' : 'unidades'}).</span>
           <button type="button" data-action="update-qty">Atualizar quantidade</button>
         </div>`
      : '';

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
          <button type="button" class="btn btn-success btn-add-cart" data-action="add">
            <i class="fa-solid fa-plus"></i> Adicionar ao Carrinho
          </button>
        </div>

        ${alertHtml}
      </div>
    `;

    // Scroll suave até o card (a menos que opts.scroll === false)
    if (opts.scroll !== false) {
      setTimeout(() => {
        const card = root.querySelector('.product-card');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }

    // Foco no input de quantidade (útil para tablet/loja)
    setTimeout(() => {
      const qty = root.querySelector('#qtyInput');
      if (qty) {
        qty.focus({ preventScroll: true });
        qty.select();
      }
    }, 120);
  }

  function onRootChange(e) {
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
      render(currentProduct, { scroll: false });

      // Animação de sucesso
      if (res && !res.updated) {
        const cardEl = root.querySelector('.product-card');
        if (cardEl) {
          cardEl.classList.add('just-added');
          setTimeout(() => cardEl.classList.remove('just-added'), 600);
        }
      }

      // Foco de volta no input de código de barras (para próxima leitura)
      setTimeout(() => {
        const bc = document.getElementById('barcodeInput');
        if (bc) bc.focus();
      }, 80);
    }

    if (action === 'update-qty') {
      const qtyInput = root.querySelector('#qtyInput');
      const qty = Math.max(1, parseInt(qtyInput?.value, 10) || 1);
      Cart.setQty(currentProduct.seqproduto, Cart.getQty(currentProduct.seqproduto) + qty);
      render(currentProduct, { scroll: false });
      Toast.success(`Quantidade de ${currentProduct.produto} atualizada.`, 'Carrinho');
    }
  }

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
