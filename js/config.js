/* ============================================================
   config.js — Constantes e configurações globais do app
   ============================================================ */

const CONFIG = {
  // Caminho da planilha (relativo ao index.html)
  SPREADSHEET_PATH: 'dados/BASE.xlsx',

  // Nomes das abas esperadas
  SHEETS: {
    BASE: 'BASE',
    ARVORES: 'ARVORES'
  },

  // Colunas esperadas (serão resolvidas dinamicamente no fileReader)
  COLUMNS: {
    BASE: {
      SEQPRODUTO: 'SEQPRODUTO',
      PRODUTO: 'PRODUTO',
      TIPO_CODIGO: 'TIPO DE CODIGO',
      CODACESSO: 'CODACESSO'
    },
    ARVORES: {
      SEQ_FML: 'SEQ FML',
      SEQ_PROD: 'SEQ PROD',
      DESC: 'DESC',
      DIVISAO: 'DIVISAO',
      COMPRADOR: 'COMPRADOR',
      CATEGORIA: 'CATEGORIA',
      GRUPO: 'GRUPO',
      SUBGRUPO: 'SUBGRUPO',
      SUBGRUPO1: 'SUBGRUPO 1',
      SUBGRUPO2: 'SUBGRUPO 2',
      SUBGRUPO3: 'SUBGRUPO 3',
      NOSSO_PRECO: 'NOSSO PREÇO'
    }
  },

  // Chaves do localStorage
  STORAGE_KEYS: {
    CART: 'pesquisa_preco_cart_v1',
    HISTORY: 'pesquisa_preco_history_v1'
  },

  // Limites
  MAX_HISTORY: 20,
  MAX_AUTOCOMPLETE: 10,

  // Debounce do autocomplete (ms)
  DEBOUNCE_MS: 300,

  // Duração do toast (ms)
  TOAST_DURATION: 3200,

  // Formatos de código de barras suportados
  BARCODE_FORMATS: [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39
  ]
};