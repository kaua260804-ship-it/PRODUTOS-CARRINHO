/* ============================================================
   dataProcessor.js — Cruzamento BASE + ARVORES e índices
   ------------------------------------------------------------
   Melhorias desta versão:
     - Índice de código de barras MULTI-FORMA:
         * código exato
         * sem zeros à esquerda
         * com padding EAN-8 / EAN-13 / UPC-A (zeros à esquerda)
     - Normalização de código remove espaços, BOM, NBSP, hífens
     - Busca por código é tolerante a "0" à frente e no fim
   ============================================================ */

const DataProcessor = (() => {
  const state = {
    base:    { headers: [], rows: [], cols: {} },
    arvores: { headers: [], rows: [], cols: {} },

    // Índices
    byBarcode: new Map(),   // chave canônica -> { seqproduto, produto }
    bySeqBase: new Map(),   // SEQPRODUTO -> { seqproduto, produto, codigos[] }
    bySeqArv:  new Map(),   // SEQ PROD  -> linha ARVORES
    searchIndex: [],        // [{ seqproduto, produto, norm }]

    loaded: false,
    stats: { baseCount: 0, arvCount: 0, barcodesCount: 0 }
  };

  /* ------------------------------------------------------------
     Normalização de sequencial
     ------------------------------------------------------------ */
  function seqKey(v) {
    if (v == null) return '';
    return String(v).trim();
  }

  /* ------------------------------------------------------------
     Normalização de código de barras
     ------------------------------------------------------------
     - Remove BOM, NBSP, espaços, hífens, pontos e apóstrofos
     - Mantém letras (Code128 pode ter letras)
     - Mantém dígitos
     ------------------------------------------------------------ */
  function normalizeCode(raw) {
    if (raw == null) return '';
    return String(raw)
      .replace(/[\uFEFF\u00A0\u200B-\u200D\u2060]/g, '')
      .replace(/[\s\-\.'"]/g, '')
      .trim();
  }

  /* ------------------------------------------------------------
     Gera todas as variantes possíveis de um código
     ------------------------------------------------------------
     Para "0123" gera: ["0123", "123", "00000123", "0000000000123"]
     Para "123"  gera: ["123", "00000123", "0000000000123"]
     Para "0000123" gera: ["0000123", "123", "00000123", ...]
     Isso cobre:
       - Excel que removeu os zeros ("123" salvo como número)
       - Leitor que devolveu com zeros ("000123")
       - EAN-8 (8 dígitos), EAN-13 (13), UPC-A (12)
     ------------------------------------------------------------ */
  function codeVariants(raw) {
    const code = normalizeCode(raw);
    if (!code) return [];

    const variants = new Set();
    variants.add(code);

    // Só gera variantes numéricas se o código for todo dígitos
    if (/^\d+$/.test(code)) {
      const stripped = code.replace(/^0+/, '') || '0';
      variants.add(stripped);

      // Padding EAN-8
      if (stripped.length <= 8) variants.add(stripped.padStart(8, '0'));
      // Padding UPC-A / EAN-13 (usa 12 e 13)
      if (stripped.length <= 12) variants.add(stripped.padStart(12, '0'));
      if (stripped.length <= 13) variants.add(stripped.padStart(13, '0'));

      // Também gera variantes do código original sem os zeros (se houver)
      if (code !== stripped) {
        if (stripped.length <= 8) variants.add(code.slice(-8).padStart(8, '0'));
      }
    }

    return [...variants].filter(Boolean);
  }

  /* ------------------------------------------------------------
     Constrói todos os índices em memória
     ------------------------------------------------------------ */
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
      const codigoRaw = row[bCols.CODACESSO];
      const codigo = normalizeCode(codigoRaw);
      if (!seq || !produto) continue;

      // bySeqBase (mantém o primeiro nome encontrado)
      if (!state.bySeqBase.has(seq)) {
        state.bySeqBase.set(seq, { seqproduto: seq, produto, codigos: [] });
      }

      if (codigo) {
        const entry = state.bySeqBase.get(seq);
        if (!entry.codigos.includes(codigo)) entry.codigos.push(codigo);

        // Indexa TODAS as variantes — mas NÃO sobrescreve mapeamentos já existentes
        const variants = codeVariants(codigo);
        for (const v of variants) {
          if (!state.byBarcode.has(v)) {
            state.byBarcode.set(v, { seqproduto: seq, produto });
          }
        }
      }
    }

    /* ---------- 2) Índice de busca por descrição ---------- */
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
    console.info(
      `[dataProcessor] Índice pronto: ${state.stats.baseCount} produtos, ` +
      `${state.stats.barcodesCount} chaves de código (variantes inclusas).`
    );
    return state.stats;
  }

  /* ------------------------------------------------------------
     Busca por código de barras — tenta TODAS as variantes
     ------------------------------------------------------------ */
  function findByBarcode(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) return null;

    // 1) Tentativa direta (mais rápido)
    let hit = state.byBarcode.get(code);
    if (hit) return composeProduct(hit.seqproduto);

    // 2) Tenta variantes (zeros à frente/atrás, padding)
    const variants = codeVariants(code);
    for (const v of variants) {
      hit = state.byBarcode.get(v);
      if (hit) {
        console.info(`[dataProcessor] Código "${code}" casado via variante "${v}".`);
        return composeProduct(hit.seqproduto);
      }
    }

    return null;
  }

  /* ------------------------------------------------------------
     Monta o produto completo (BASE + ARVORES) a partir do SEQPRODUTO
     ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     Busca por descrição
     ------------------------------------------------------------ */
  function searchByDescription(query, limit = CONFIG.MAX_AUTOCOMPLETE) {
    const tokens = Utils.tokenize(query);
    if (!tokens.length) return [];

    const results = [];
    for (const item of state.searchIndex) {
      if (Utils.matchesAllTokens(item.norm, tokens)) {
        results.push(item);
        if (results.length >= limit * 4) break;
      }
    }
    results.sort((a, b) => a.produto.length - b.produto.length);
    return results.slice(0, limit).map(r => ({
      seqproduto: r.seqproduto,
      produto: r.produto
    }));
  }

  /* ------------------------------------------------------------
     Sugestões similares (fallback)
     ------------------------------------------------------------ */
  function similarSuggestions(query, limit = 5) {
    const tokens = Utils.tokenize(query);
    if (!tokens.length) return [];
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
