/* ============================================================
   fileReader.js — Leitura da planilha via SheetJS
   ============================================================ */

const FileReaderXLS = (() => {

  /**
   * Normaliza o nome de uma coluna para comparação tolerante
   * (remove acentos, caixa, espaços extras, underscores).
   */
  function normHeader(s) {
    return Utils.normalize(String(s || ''))
      .replace(/[_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tenta localizar a coluna desejada dentro da lista de headers reais.
   * Retorna o nome real ou null.
   */
  function resolveColumn(realHeaders, wantedName) {
    const wanted = normHeader(wantedName);
    // 1) match exato normalizado
    for (const h of realHeaders) {
      if (normHeader(h) === wanted) return h;
    }
    // 2) match por "contém" (ex.: "NOSSO PREÇO (R$)" ~ "NOSSO PREÇO")
    for (const h of realHeaders) {
      const nh = normHeader(h);
      if (nh.includes(wanted) || wanted.includes(nh)) return h;
    }
    return null;
  }

  /**
   * Converte uma worksheet em array de objetos usando SheetJS,
   * respeitando headers reais (mas com nomes originais).
   */
  function sheetToRows(worksheet) {
    // header:1 retorna array de arrays
    const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
    if (!aoa.length) return { headers: [], rows: [] };
    const headers = aoa[0].map(h => String(h ?? '').trim());
    const rows = [];
    for (let i = 1; i < aoa.length; i++) {
      const arr = aoa[i];
      if (!arr || arr.every(v => v === '' || v == null)) continue;
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = arr[c] != null ? arr[c] : '';
      }
      rows.push(obj);
    }
    return { headers, rows };
  }

  /**
   * Carrega o arquivo e retorna { base, arvores } já com colunas resolvidas.
   * @returns {Promise<{base:{headers,rows,cols}, arvores:{headers,rows,cols}}>}
   */
  async function load(path = CONFIG.SPREADSHEET_PATH) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Não foi possível baixar a planilha (${response.status}).`);
    }
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Localiza abas (tolerante a caixa/acentos)
    const findSheet = (wanted) => {
      const nw = Utils.normalize(wanted);
      const real = workbook.SheetNames.find(n => Utils.normalize(n) === nw);
      return real || null;
    };

    const baseName = findSheet(CONFIG.SHEETS.BASE);
    const arvName  = findSheet(CONFIG.SHEETS.ARVORES);

    if (!baseName) throw new Error('Aba "BASE" não encontrada na planilha.');
    if (!arvName)  throw new Error('Aba "ARVORES" não encontrada na planilha.');

    const baseRaw = sheetToRows(workbook.Sheets[baseName]);
    const arvRaw  = sheetToRows(workbook.Sheets[arvName]);

    // Resolve nomes reais de colunas
    const baseCols = {};
    Object.entries(CONFIG.COLUMNS.BASE).forEach(([key, wanted]) => {
      baseCols[key] = resolveColumn(baseRaw.headers, wanted);
    });

    const arvCols = {};
    Object.entries(CONFIG.COLUMNS.ARVORES).forEach(([key, wanted]) => {
      arvCols[key] = resolveColumn(arvRaw.headers, wanted);
    });

    // Valida o mínimo essencial
    if (!baseCols.SEQPRODUTO) throw new Error('Coluna SEQPRODUTO ausente na aba BASE.');
    if (!baseCols.PRODUTO)    throw new Error('Coluna PRODUTO ausente na aba BASE.');
    if (!baseCols.CODACESSO)  throw new Error('Coluna CODACESSO ausente na aba BASE.');
    if (!arvCols.SEQ_PROD)    throw new Error('Coluna SEQ PROD ausente na aba ARVORES.');

    return {
      base:    { ...baseRaw, cols: baseCols },
      arvores: { ...arvRaw,  cols: arvCols }
    };
  }

  return { load };
})();