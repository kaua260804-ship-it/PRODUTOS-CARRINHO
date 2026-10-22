/* ============================================================
   fileReader.js — Leitura da planilha via SheetJS
   ------------------------------------------------------------
   Tolerante a:
     - Nomes de aba com acentos, caixa diferente, espaços extras
     - NBSP (\u00A0), BOM (\uFEFF), apóstrofos iniciais
     - Sufixos de duplicata: "ARVORES (2)", "ARVORES_1"
     - Aba com nome composto: "PLANILHA ARVORES" (match por inclusão)
   Se a aba não for encontrada, o console lista TODAS as abas reais
   e um toast mostra o problema ao usuário.
   ============================================================ */

const FileReaderXLS = (() => {

  /* ------------------------------------------------------------
     Normalização de nomes de aba/coluna
     ------------------------------------------------------------
     - remove BOM, NBSP, zero-width, apóstrofos/aspas iniciais
     - aplica NFD e remove diacríticos
     - colapsa espaços
     - minúsculas
     ------------------------------------------------------------ */
  function cleanText(s) {
    if (s == null) return '';
    return String(s)
      .replace(/[\uFEFF\u200B-\u200D\u2060]/g, '') // BOM + zero-width
      .replace(/\u00A0/g, ' ')                     // NBSP → espaço normal
      .replace(/^[\s'"]+/, '')                     // apóstrofo/aspas iniciais
      .replace(/[\s'"]+$/, '')                     // apóstrofo/aspas finais
      .trim();
  }

  function normHeader(s) {
    return cleanText(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove acentos
      .replace(/[_\-.]+/g, ' ')          // normaliza separadores
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  }

  /* ------------------------------------------------------------
     Localiza a coluna desejada dentro dos headers reais
     ------------------------------------------------------------ */
  function resolveColumn(realHeaders, wantedName) {
    const wanted = normHeader(wantedName);
    if (!wanted) return null;

    // 1) match exato normalizado
    for (const h of realHeaders) {
      if (normHeader(h) === wanted) return h;
    }
    // 2) match por inclusão (ex.: "NOSSO PREÇO (R$)" ~ "NOSSO PREÇO")
    for (const h of realHeaders) {
      const nh = normHeader(h);
      if (nh.includes(wanted) || wanted.includes(nh)) return h;
    }
    return null;
  }

  /* ------------------------------------------------------------
     Converte worksheet em { headers, rows }
     ------------------------------------------------------------ */
  function sheetToRows(worksheet) {
    const aoa = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false
    });
    if (!aoa.length) return { headers: [], rows: [] };

    const headers = aoa[0].map(h => cleanText(h));
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

  /* ------------------------------------------------------------
     Localiza o nome real de uma aba procurada
     ------------------------------------------------------------
     Estratégia (da mais estrita para a mais tolerante):
       1. Match exato normalizado
       2. Match removendo sufixo de duplicata "(2)", "_1", " - copia"
       3. Match por "contém": aba real inclui o nome procurado
          (ex.: "PLANILHA ARVORES" contém "arvores")
       4. Match por "contido": nome procurado inclui a aba real
     Retorna o nome real da aba ou null.
     ------------------------------------------------------------ */
  function findSheetName(sheetNames, wantedName) {
    const wanted = normHeader(wantedName);
    if (!wanted) return null;

    // 0) Log de debug: mostra todas as abas reais (útil para diagnosticar)
    // console.log('[fileReader] Abas disponíveis:', sheetNames.map(n => `"${n}"`));

    // 1) Match exato normalizado
    for (const real of sheetNames) {
      if (normHeader(real) === wanted) return real;
    }

    // 2) Remove sufixo de duplicata: "arvores (2)", "arvores_1", "arvores - copia"
    const stripSuffix = (norm) =>
      norm
        .replace(/\s*\(\d+\)\s*$/, '')       // (2), (3)...
        .replace(/\s*[_-]\s*\d+\s*$/, '')     // _1, - 1
        .replace(/\s*-\s*c[oó]pia\s*$/, '')   // - copia
        .trim();

    for (const real of sheetNames) {
      if (stripSuffix(normHeader(real)) === wanted) return real;
    }

    // 3) Match por inclusão: o nome real contém o procurado
    for (const real of sheetNames) {
      const nh = normHeader(real);
      if (nh.includes(wanted)) return real;
    }

    // 4) Match por contenção: o procurado contém o nome real
    //    (ex.: usuário espera "ARVORES" e a aba se chama "ÁRVORE")
    for (const real of sheetNames) {
      const nh = stripSuffix(normHeader(real));
      if (nh && wanted.includes(nh)) return real;
    }

    return null;
  }

  /* ------------------------------------------------------------
     Carrega o arquivo e retorna { base, arvores } já com colunas
     resolvidas.
     ------------------------------------------------------------ */
  async function load(path = CONFIG.SPREADSHEET_PATH) {
    let response;
    try {
      response = await fetch(path, { cache: 'no-store' });
    } catch (e) {
      throw new Error(`Falha de rede ao buscar "${path}". Detalhe: ${e.message}`);
    }
    if (!response.ok) {
      throw new Error(
        `Não foi possível baixar a planilha "${path}" (HTTP ${response.status}). ` +
        `Verifique se o arquivo existe em "dados/".`
      );
    }

    const buffer = await response.arrayBuffer();

    // Detecta se é CSV (não suporta múltiplas abas)
    const isCsv = /\.csv$/i.test(path);
    if (isCsv) {
      throw new Error(
        'O arquivo é um .csv — ele só tem uma "tabela", não abas. ' +
        'Renomeie/salve como .xlsx com as abas "BASE" e "ARVORES".'
      );
    }

    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'array' });
    } catch (e) {
      throw new Error(`Arquivo corrompido ou formato inválido. Detalhe: ${e.message}`);
    }

    // Lista as abas para debug no console (sempre útil)
    console.log('[fileReader] Abas encontradas na planilha:', workbook.SheetNames);

    // Localiza as abas com tolerância
    const baseName = findSheetName(workbook.SheetNames, CONFIG.SHEETS.BASE);
    const arvName  = findSheetName(workbook.SheetNames, CONFIG.SHEETS.ARVORES);

    if (!baseName) {
      throw new Error(
        `Aba "BASE" não encontrada. Abas disponíveis: ` +
        workbook.SheetNames.map(n => `"${n}"`).join(', ')
      );
    }
    if (!arvName) {
      throw new Error(
        `Aba "ARVORES" não encontrada. Abas disponíveis: ` +
        workbook.SheetNames.map(n => `"${n}"`).join(', ')
      );
    }

    // Log informativo do nome real usado (para debugar renomeações)
    if (baseName !== CONFIG.SHEETS.BASE) {
      console.info(`[fileReader] Aba BASE resolvida como "${baseName}".`);
    }
    if (arvName !== CONFIG.SHEETS.ARVORES) {
      console.info(`[fileReader] Aba ARVORES resolvida como "${arvName}".`);
    }

    const baseRaw = sheetToRows(workbook.Sheets[baseName]);
    const arvRaw  = sheetToRows(workbook.Sheets[arvName]);

    // Resolve nomes reais das colunas
    const baseCols = {};
    Object.entries(CONFIG.COLUMNS.BASE).forEach(([key, wanted]) => {
      baseCols[key] = resolveColumn(baseRaw.headers, wanted);
    });

    const arvCols = {};
    Object.entries(CONFIG.COLUMNS.ARVORES).forEach(([key, wanted]) => {
      arvCols[key] = resolveColumn(arvRaw.headers, wanted);
    });

    // Valida o mínimo essencial
    if (!baseCols.SEQPRODUTO) {
      throw new Error(
        `Coluna SEQPRODUTO ausente na aba "${baseName}". ` +
        `Colunas encontradas: ${baseRaw.headers.map(h => `"${h}"`).join(', ')}`
      );
    }
    if (!baseCols.PRODUTO) {
      throw new Error(
        `Coluna PRODUTO ausente na aba "${baseName}". ` +
        `Colunas encontradas: ${baseRaw.headers.map(h => `"${h}"`).join(', ')}`
      );
    }
    if (!baseCols.CODACESSO) {
      throw new Error(
        `Coluna CODACESSO ausente na aba "${baseName}". ` +
        `Colunas encontradas: ${baseRaw.headers.map(h => `"${h}"`).join(', ')}`
      );
    }
    if (!arvCols.SEQ_PROD) {
      throw new Error(
        `Coluna SEQ PROD ausente na aba "${arvName}". ` +
        `Colunas encontradas: ${arvRaw.headers.map(h => `"${h}"`).join(', ')}`
      );
    }

    return {
      base:    { ...baseRaw, cols: baseCols, sheetName: baseName },
      arvores: { ...arvRaw,  cols: arvCols,  sheetName: arvName }
    };
  }

  return { load };
})();
