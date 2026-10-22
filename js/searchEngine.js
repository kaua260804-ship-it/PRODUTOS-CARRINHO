/* ============================================================
   searchEngine.js — Autocomplete + busca por descrição
   ------------------------------------------------------------
   Correção desta versão:
     - Ao selecionar, PRIMEIRO renderiza o card (com scroll),
       DEPOIS adiciona ao histórico — a ordem importa para o
       usuário ver o card em destaque.
   ============================================================ */

const SearchEngine = (() => {
  let descInput = null;
  let listEl = null;
  let activeIndex = -1;
  let currentResults = [];

  function init() {
    descInput = document.getElementById('descInput');
    listEl = document.getElementById('autocompleteList');
    if (!descInput || !listEl) return;

    const runSearch = Utils.debounce(() => {
      const q = descInput.value.trim();
      if (q.length < 2) { close(); return; }
      const results = DataProcessor.searchByDescription(q, CONFIG.MAX_AUTOCOMPLETE);
      render(q, results);
    }, CONFIG.DEBOUNCE_MS);

    descInput.addEventListener('input', runSearch);

    descInput.addEventListener('keydown', (e) => {
      if (!listEl || listEl.hidden) {
        if (e.key === 'Enter' && descInput.value.trim()) {
          const q = descInput.value.trim();
          const results = DataProcessor.searchByDescription(q, 1);
          if (results.length) {
            selectProduct(results[0].seqproduto);
            descInput.value = '';
          } else {
            Toast.error('Nenhum produto encontrado para esta descrição.');
          }
        }
        return;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && currentResults[activeIndex]) {
          selectProduct(currentResults[activeIndex].seqproduto);
          descInput.value = '';
        }
      } else if (e.key === 'Escape') {
        close();
      }
    });

    document.addEventListener('click', (e) => {
      if (!listEl.contains(e.target) && e.target !== descInput) close();
    });
  }

  function moveActive(dir) {
    if (!currentResults.length) return;
    activeIndex = (activeIndex + dir + currentResults.length) % currentResults.length;
    renderActive();
  }

  function renderActive() {
    if (!listEl) return;
    [...listEl.children].forEach((li, i) => {
      li.classList.toggle('active', i === activeIndex);
    });
  }

  function render(query, results) {
    currentResults = results;
    activeIndex = -1;
    listEl.innerHTML = '';

    if (!results.length) {
      listEl.innerHTML = `<li class="autocomplete-empty"><i class="fa-solid fa-circle-question"></i> Nenhum produto encontrado.</li>`;
      listEl.hidden = false;
      return;
    }

    const tokens = Utils.tokenize(query);
    results.forEach(r => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.className = 'autocomplete-item';
      li.innerHTML = `
        <div class="ac-main">
          <span class="ac-name">${Utils.highlight(r.produto, tokens)}</span>
          <span class="ac-seq">SEQ ${Utils.escapeHtml(r.seqproduto)}</span>
        </div>
        <i class="fa-solid fa-arrow-right ac-arrow"></i>
      `;
      li.addEventListener('click', () => {
        selectProduct(r.seqproduto);
        descInput.value = '';
        close();
      });
      listEl.appendChild(li);
    });
    listEl.hidden = false;
  }

  /**
   * Seleciona um produto (por SEQ ou código).
   * ORDEM CORRETA: fecha dropdown → renderiza card → histórico.
   */
  function selectProduct(seqOrProduct) {
    let full = null;

    if (typeof seqOrProduct === 'string') {
      full = DataProcessor.getBySeq(seqOrProduct) || DataProcessor.findByBarcode(seqOrProduct);
    } else if (seqOrProduct && seqOrProduct.seqproduto) {
      full = seqOrProduct;
    }

    if (!full) {
      Toast.error('Produto não encontrado na base.');
      return;
    }

    close(); // fecha dropdown primeiro

    // 1) Renderiza card com scroll garantido
    if (window.ProductCard) ProductCard.render(full, { scroll: true });

    // 2) Só depois registra no histórico
    if (window.History) History.push(full);
  }

  function close() {
    if (!listEl) return;
    listEl.hidden = true;
    listEl.innerHTML = '';
    currentResults = [];
    activeIndex = -1;
  }

  function searchNow(query) {
    if (!descInput) return;
    descInput.value = query;
    descInput.focus();
    const results = DataProcessor.searchByDescription(query, CONFIG.MAX_AUTOCOMPLETE);
    render(query, results);
  }

  return { init, selectProduct, close, searchNow };
})();
