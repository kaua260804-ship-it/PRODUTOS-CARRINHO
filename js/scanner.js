  function handleCode(rawCode) {
    // Normaliza: remove espaços, BOM, hífens, aspas — o DataProcessor
    // já cuida disso também, mas aqui fica explícito para o log.
    const code = String(rawCode)
      .replace(/[\uFEFF\u00A0\u200B-\u200D\u2060]/g, '')
      .replace(/[\s\-\.'"]/g, '')
      .trim();

    if (!code) return;

    const now = Date.now();
    if (code === lastText && now - lastTs < 1500) return;
    lastText = code;
    lastTs = now;

    const product = DataProcessor.findByBarcode(code);

    Utils.beep(product ? 880 : 260, 0.12);
    Utils.vibrate(product ? 60 : 120);

    if (!product) {
      Toast.error(`Código "${code}" não encontrado. Tente buscar pela descrição.`, 'Não encontrado');
      return;
    }

    if (window.ProductCard) ProductCard.render(product, { scroll: true });
    if (window.History) History.push(product);

    Toast.success(product.produto, 'Produto identificado');

    const input = inputEl();
    if (input) {
      input.value = '';
      input.focus();
    }
  }
