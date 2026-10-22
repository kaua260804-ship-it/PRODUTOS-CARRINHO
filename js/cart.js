/* ============================================================
   cart.js — Gerenciamento do carrinho (add/remove/qtd/total)
   Chave única: SEQPRODUTO
   ------------------------------------------------------------
   IMPORTANTE: ConfirmModal vive em js/confirmModal.js e deve
   ser carregado ANTES deste arquivo no index.html.
   ============================================================ */

const Cart = (() => {
  let items = []; // [{ seqproduto, produto, categoria, grupo, preco, precoEncontrado, qty }]

  const els = {};

  function cacheEls() {
    els.list         = document.getElementById('cartList');
    els.badge        = document.getElementById('cartCountBadge');
    els.distinct     = document.getElementById('cartDistinctCount');
    els.totalQty     = document.getElementById('cartTotalQty');
    els.grand        = document.getElementById('cartGrandTotal');
    els.btnClear     = document.getElementById('btnClearCart');
    els.btnPdf       = document.getElementById('btnExportPdf');
    els.btnCsv       = document.getElementById('btnExportCsv');
    els.floating     = document.getElementById('floatingCartBtn');
    els.floatingText = document.getElementById('floatingCartText');
    els.cartCard     = document.getElementById('cartCard');
  }

  /* ---------- Carregamento ---------- */
  function load() {
    const stored = Storage.loadCart();
    items = Array.isArray(stored) ? stored.map(sanitize).filter(Boolean) : [];
    render();
  }

  function sanitize(it) {
    if (!it || !it.seqproduto) return null;
    return {
      seqproduto: String(it.seqproduto),
      produto: String(it.produto || ''),
      categoria: it.categoria || '—',
      grupo: it.grupo || '—',
      preco: Number(it.preco) || 0,
      precoEncontrado: !!it.precoEncontrado,
      qty: Math.max(1, parseInt(it.qty, 10) || 1)
    };
  }

  function persist() {
    Storage.saveCart(items);
  }

  /* ---------- Consultas ---------- */
  function findIndex(seq) {
    const s = String(seq);
    return items.findIndex(i => i.seqproduto === s);
  }

  function has(seq) {
    return findIndex(seq) !== -1;
  }

  function getQty(seq) {
    const i = findIndex(seq);
    return i === -1 ? 0 : items[i].qty;
  }

  /* ---------- Mutações ---------- */
  function add(product, qty = 1) {
    const q = Math.max(1, parseInt(qty, 10) || 1);
    const idx = findIndex(product.seqproduto);

    if (idx !== -1) {
      items[idx].qty += q;
      persist();
      render();
      Toast.success(`${product.produto} — quantidade atualizada (${items[idx].qty}).`, 'Carrinho');
      return { updated: true, qty: items[idx].qty };
    }

    items.push({
      seqproduto: String(product.seqproduto),
      produto: product.produto,
      categoria: product.categoria || '—',
      grupo: product.grupo || '—',
      preco: Number(product.preco) || 0,
      precoEncontrado: !!product.precoEncontrado,
      qty: q
    });
    persist();
    render();
    Toast.success(`${product.produto} adicionado ao carrinho.`, 'Carrinho');
    return { updated: false, qty: q };
  }

  function setQty(seq, qty) {
    const idx = findIndex(seq);
    if (idx === -1) return;
    const q = parseInt(qty, 10) || 0;
    if (q <= 0) {
      remove(seq, { silent: true });
      return;
    }
    items[idx].qty = q;
    persist();
    render();
  }

  function increment(seq, delta = 1) {
    const idx = findIndex(seq);
    if (idx === -1) return;
    const newQty = items[idx].qty + delta;
    if (newQty <= 0) {
      remove(seq, { silent: true });
      return;
    }
    items[idx].qty = newQty;
    persist();
    render();
  }

  function remove(seq, opts = {}) {
    const idx = findIndex(seq);
    if (idx === -1) return;
    const removed = items[idx];
    items.splice(idx, 1);
    persist();
    render();
    if (!opts.silent) {
      Toast.info(`${removed.produto} removido do carrinho.`);
    }
  }

  function clear() {
    items = [];
    persist();
    render();
  }

  function getTotal() {
    return items.reduce((sum, it) => sum + (it.preco * it.qty), 0);
  }

  function getTotalQty() {
    return items.reduce((sum, it) => sum + it.qty, 0);
  }

  function getDistinctCount() {
    return items.length;
  }

  function getItems() {
    return items.map(i => ({ ...i }));
  }

  /* ---------- Renderização ---------- */
  function render() {
    if (!els.list) return;

    if (!items.length) {
      els.list.innerHTML = `<li class="empty-state"><i class="fa-solid fa-cart-plus"></i> Seu carrinho está vazio.<br><small>Escaneie um código ou pesquise um produto.</small></li>`;
    } else {
      els.list.innerHTML = items.map(renderItem).join('');
      bindItemEvents();
    }

    const total    = getTotal();
    const totalQty = getTotalQty();
    const distinct = getDistinctCount();

    if (els.badge)        els.badge.textContent = String(distinct);
    if (els.distinct)     els.distinct.textContent = String(distinct);
    if (els.totalQty)     els.totalQty.textContent = String(totalQty);
    if (els.grand)        els.grand.textContent = Utils.formatBRL(total);

    if (els.floatingText) {
      els.floatingText.textContent =
        `${totalQty} ${totalQty === 1 ? 'item' : 'itens'} — ${Utils.formatBRL(total)}`;
    }
    if (els.floating) {
      els.floating.classList.toggle('has-items', items.length > 0);
    }

    if (els.cartCard) {
      els.cartCard.setAttribute('data-print-date', new Date().toLocaleString('pt-BR'));
    }
  }

  function renderItem(it) {
    const subtotal = it.preco * it.qty;
    const precoUnit = it.precoEncontrado
      ? Utils.formatBRL(it.preco)
      : '<span class="text-warning" title="Preço não cadastrado"><i class="fa-solid fa-triangle-exclamation"></i> Preço não cadastrado</span>';

    const catGrupo = [it.categoria, it.grupo]
      .filter(v => v && v !== '—')
      .join(' <span class="sep">/</span> ') || '—';

    return `
      <li class="cart-item" data-seq="${Utils.escapeHtml(it.seqproduto)}">
        <div class="cart-item-top">
          <div>
            <div class="cart-item-name">${Utils.escapeHtml(it.produto)}</div>
            <div class="cart-item-meta">
              <span class="badge badge-gray">SEQ ${Utils.escapeHtml(it.seqproduto)}</span>
              <span class="cart-item-category">${catGrupo}</span>
            </div>
          </div>
          <div class="cart-qty-controls">
            <button class="qty-btn" data-action="dec" title="Diminuir">➖</button>
            <span class="cart-qty-value">${it.qty}</span>
            <button class="qty-btn" data-action="inc" title="Aumentar">➕</button>
          </div>
        </div>
        <div class="cart-item-bottom">
          <div class="cart-prices">
            <span class="unit-price">Unit.: ${precoUnit}</span>
          </div>
          <div class="cart-subtotal">
            ${Utils.formatBRL(subtotal)}
            <small>${it.qty} × ${Utils.formatBRL(it.preco)}</small>
          </div>
          <button class="btn btn-remove-item" data-action="remove" title="Remover item">
            <i class="fa-solid fa-trash-can"></i> Remover
          </button>
        </div>
      </li>
    `;
  }

  function bindItemEvents() {
    if (!els.list) return;
    els.list.querySelectorAll('.cart-item').forEach(li => {
      const seq = li.getAttribute('data-seq');
      li.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action');
          if (action === 'inc') increment(seq, 1);
          else if (action === 'dec') increment(seq, -1);
          else if (action === 'remove') remove(seq);
        });
      });
    });
  }

  /* ---------- Exportações ---------- */
  function exportCsv() {
    if (!items.length) {
      Toast.warning('Carrinho vazio — nada para exportar.');
      return;
    }
    const header = ['SEQPRODUTO', 'PRODUTO', 'CATEGORIA', 'GRUPO', 'PRECO_UNIT', 'QUANTIDADE', 'SUBTOTAL'];
    const rows = items.map(it => [
      it.seqproduto,
      it.produto,
      it.categoria,
      it.grupo,
      it.preco.toFixed(2).replace('.', ','),
      it.qty,
      (it.preco * it.qty).toFixed(2).replace('.', ',')
    ]);
    rows.push([]);
    rows.push(['', '', '', '', '', 'TOTAL', getTotal().toFixed(2).replace('.', ',')]);

    const csv = [header, ...rows]
      .map(r => r.map(cell => {
        const s = String(cell ?? '');
        return `"${s.replace(/"/g, '""')}"`;
      }).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `carrinho_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    Toast.success('CSV exportado.', 'Exportação');
  }

  function exportPdf() {
    if (!items.length) {
      Toast.warning('Carrinho vazio — nada para imprimir.');
      return;
    }
    window.print();
  }

  /* ---------- Init ---------- */
  function init() {
    cacheEls();
    load();

    if (els.btnClear) {
      els.btnClear.addEventListener('click', () => {
        if (!items.length) {
          Toast.info('O carrinho já está vazio.');
          return;
        }
        // ConfirmModal agora vem de window.ConfirmModal
        window.ConfirmModal.open({
          title: 'Limpar carrinho',
          message: `Remover todos os ${items.length} itens do carrinho? Esta ação não pode ser desfeita.`,
          confirmText: 'Limpar tudo',
          onConfirm: () => {
            clear();
            Storage.clearCart();
            Toast.success('Carrinho limpo.', 'Carrinho');
          }
        });
      });
    }

    if (els.btnPdf) els.btnPdf.addEventListener('click', exportPdf);
    if (els.btnCsv) els.btnCsv.addEventListener('click', exportCsv);

    if (els.floating) {
      els.floating.addEventListener('click', () => {
        const card = els.cartCard;
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  return {
    init, add, remove, setQty, increment, clear,
    has, getQty, getTotal, getTotalQty, getDistinctCount, getItems,
    render, exportCsv, exportPdf
  };
})();
