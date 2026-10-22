/* ============================================================
   dataProcessor.js — Cruzamento BASE + ARVORES e índices
   ============================================================ */

const DataProcessor = (() => {
  // Estrutura principal
  const state = {
    base:    { headers: [], rows: [], cols: {} },
    arvores: { headers: [], rows: [], cols: {} },

    // Índices
    byBarcode: new Map(),   // CODACESSO (string) -> { seqproduto, produto }
    bySeqBase: new Map(),   // SEQPRODUTO      -> { seqproduto, produto, codigos[] }
    bySeqArv:  new Map(),   // SEQ PROD        -> linha ARVORES (objeto)
    searchIndex: [],        // [{ seqproduto, produto, norm }]

    loaded: false,
    stats: { baseCount: 0, arvCount: 0, barcodesCount: 0 }
  };

  /**
   * Chave canônica de sequencial (string, sem espaços).
   */
  function seqKey(v) {
    if (v == null) return '';
    return String(v).trim();
  }

  /**
   * Normaliza código de barras: só dígitos (mantém letras p/ Code128).
   * Para evitar discrepâncias (zeros à esquerda), comparamos como string.
   */
  function codeKey(v) {
    if (v == null) return '';
    return String(v).trim();
  }

  /**
   * Constrói todos os índices em memória.
   */
  function build(data) {
    state.base = data.base;
    state.arvores = data.arvores;

    state.byBarcode.clear();
    state.bySeqBase.clear();
    state.bySeqArv.clear();
    state.searchIndex = [];

    const bCols = state.base.cols;
    const aCols = state.arvores.cols;

    /* ---------- 1) Indexa BASE ---------- */
    for (const row of state.base.rows) {
      const seq = seqKey(row[bCols.SEQPRODUTO]);
      const produto = String(row[bCols.PRODUTO] ?? '').trim();
      const codigo = codeKey(row[bCols.CODACESSO]);
      if (!seq || !produto) continue;

      // bySeqBase (nome oficial — mantém o primeiro encontrado)
      if (!state.bySeqBase.has(seq)) {
        state.bySeqBase.set(seq, {
          seqproduto: seq,
          produto,
          codigos: []
        });
      }

      // Acumula códigos de barras
      if (codigo) {
        state.bySeqBase.get(seq).codigos.push(codigo);

        // Múltiplos CODACESSO para o mesmo produto: guarda o primeiro mapeamento.
        // Não sobrescreve para preservar consistência caso haja duplicidade.
        if (!state.byBarcode.has(codigo)) {
          state.byBarcode.set(codigo, { seqproduto: seq, produto });
        }
      }
    }

    /* ---------- 2) Índice de busca por descrição ---------- */
    // Garante uma entrada por SEQPRODUTO (nome oficial)
    state.searchIndex = [];
    for (const [seq, item] of state.bySeqBase.entries()) {
      state.searchIndex.push({
        seqproduto: seq,
        produto: item.produto,
        norm: Utils.normalize(item.produto)
      });
    }

    /* ---------- 3) Indexa ARVORES ---------- */
    for (const row of state.arvores.rows) {
      const seq = seqKey(row[aCols.SEQ_PROD]);
      if (!seq) continue;
      // Primeira linha encontrada por SEQ_PROD (não sobrescreve)
      if (!state.bySeqArv.has(seq)) {
        state.bySeqArv.set(seq, row);
      }
    }

    state.stats = {
      baseCount: state.base.rows.length,
      arvCount: state.arvores.rows.length,
      barcodesCount: state.byBarcode.size
    };

    state.loaded = true;
    return state.stats;
  }

  /**
   * Busca por código de barras. Retorna produto completo ou null.
   */
  function findByBarcode(rawCode) {
    const code = codeKey(rawCode);
    if (!code) return null;
    const hit = state.byBarcode.get(code);
    if (!hit) return null;
    return composeProduct(hit.seqproduto);
  }

  /**
   * Monta o produto completo (BASE + ARVORES) a partir do SEQPRODUTO.
   * Retorna null se o SEQPRODUTO não existir na BASE.
   */
  function composeProduct(seqRaw) {
    const seq = seqKey(seqRaw);
    const baseItem = state.bySeqBase.get(seq);
    if (!baseItem) return null;

    const arvRow = state.bySeqArv.get(seq);
    const aCols = state.arvores.cols;

    let categoria = '—';
    let grupo = '—';
    let divisao = '—';
    let comprador = '—';
    let preco = 0;
    let precoEncontrado = false;

    if (arvRow) {
      const cat = aCols.CATEGORIA ? String(arvRow[aCols.CATEGORIA] ?? '').trim() : '';
      const grp = aCols.GRUPO ? String(arvRow[aCols.GRUPO] ?? '').trim() : '';
      const div = aCols.DIVISAO ? String(arvRow[aCols.DIVISAO] ?? '').trim() : '';
      const comp = aCols.COMPRADOR ? String(arvRow[aCols.COMPRADOR] ?? '').trim() : '';
      if (cat) categoria = cat;
      if (grp) grupo = grp;
      if (div) divisao = div;
      if (comp) comprador = comp;

      if (aCols.NOSSO_PRECO) {
        const rawPrice = arvRow[aCols.NOSSO_PRECO];
        const parsed = Utils.parsePrice(rawPrice);
        if (rawPrice !== '' && rawPrice != null && parsed > 0) {
          preco = parsed;
          precoEncontrado = true;
        } else if (rawPrice !== '' && rawPrice != null && parsed === 0) {
          // Pode ser preço 0 real — consideramos não cadastrado
          preco = 0;
          precoEncontrado = false;
        }
      }
    }

    return {
      seqproduto: seq,
      produto: baseItem.produto,
      codigos: baseItem.codigos,
      categoria,
      grupo,
      divisao,
      comprador,
      preco,
      precoEncontrado,
      encontradoNaArvore: !!arvRow
    };
  }

  /**
   * Busca por descrição (retorna lista de até `limit` produtos simples).
   */
  function searchByDescription(query, limit = CONFIG.MAX_AUTOCOMPLETE) {
    const tokens = Utils.tokenize(query);
    if (!tokens.length) return [];

    const results = [];
    for (const item of state.searchIndex) {
      if (Utils.matchesAllTokens(item.norm, tokens)) {
        results.push(item);
        if (results.length >= limit * 4) break; // pré-corte
      }
    }
    // Ordena por "melhor match": nome mais curto primeiro (mais específico)
    results.sort((a, b) => a.produto.length - b.produto.length);
    return results.slice(0, limit).map(r => ({
      seqproduto: r.seqproduto,
      produto: r.produto
    }));
  }

  /**
   * Sugestões parecidas (fallback quando não encontra nada).
   */
  function similarSuggestions(query, limit = 5) {
    const tokens = Utils.tokenize(query);
    if (!tokens.length) return [];
    // Busca por qualquer token individual
    const scored = [];
    for (const item of state.searchIndex) {
      let score = 0;
      for (const t of tokens) if (item.norm.includes(t)) score++;
      if (score > 0) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score || a.item.produto.length - b.item.produto.length);
    return scored.slice(0, limit).map(s => ({
      seqproduto: s.item.seqproduto,
      produto: s.item.produto
    }));
  }

  /**
   * Recompõe o produto a partir de uma sugestão (by SEQPRODUTO).
   */
  function getBySeq(seq) {
    return composeProduct(seq);
  }

  function isLoaded() { return state.loaded; }
  function getStats() { return { ...state.stats }; }

  return {
    build,
    findByBarcode,
    composeProduct,
    searchByDescription,
    similarSuggestions,
    getBySeq,
    isLoaded,
    getStats
  };
})();