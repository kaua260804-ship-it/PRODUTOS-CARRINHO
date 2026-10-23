/* ============================================================
   productCard.js — Card do produto pesquisado
   ============================================================ */

// Expõe globalmente logo de cara
window.ProductCard = (() => {
  let root = null;
  let currentProduct = null;

  function init() {
    root = document.getElementById('productResult');
  }

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
      <div class="card product-card product-card-highlight" data-seq="${Utils.escapeHtml(product.seqproduto)}">
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
          <button type="button" class="btn btn-success btn-add-cart" id="btnAddCart">
            <i class="fa-solid fa-plus"></i> Adicionar ao Carrinho
          </button>
        </div>

        ${alertHtml}
      </div>
    `;

    if (opts.scroll !== false) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const card = root.querySelector('.product-card');
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => card.classList.remove('product-card-highlight'), 1800);
          }
        }, 60);
      });
    }

    setTimeout(() => {
      const qty = root.querySelector('#qtyInput');
      if (qty) qty.focus({ preventScroll: true });
    }, 180);

    // BIND DIRETO DO BOTÃO DE ADICIONAR
    const btnAdd = root.querySelector('#btnAddCart');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const qtyInput = root.querySelector('#qtyInput');
        const qty = Math.max(1, parseInt(qtyInput?.value, 10) || 1);
        const res = Cart.add(currentProduct, qty);
        render(currentProduct, { scroll: false });
        
        if (res && !res.updated) {
          const cardEl = root.querySelector('.product-card');
          if (cardEl) {
            cardEl.classList.add('just-added');
            setTimeout(() => cardEl.classList.remove('just-added'), 600);
          }
        }
      });
    }

    // BIND DO BOTÃO DE ATUALIZAR QUANTIDADE
    const btnUpdate = root.querySelector('[data-action="update-qty"]');
    if (btnUpdate) {
      btnUpdate.addEventListener('click', () => {
        const qtyInput = root.querySelector('#qtyInput');
        const qty = Math.max(1, parseInt(qtyInput?.value, 10) || 1);
        Cart.setQty(currentProduct.seqproduto, Cart.getQty(currentProduct.seqproduto) + qty);
        render(currentProduct, { scroll: false });
        Toast.success(`Quantidade de ${currentProduct.produto} atualizada.`, 'Carrinho');
      });
    }
  }

  return { init, render };
})();
