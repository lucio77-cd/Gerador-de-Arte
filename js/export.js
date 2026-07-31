// ==========================================================
// EXPORTAÇÃO PARA PNG (qualidade de impressão ~300dpi)
// ==========================================================
document.getElementById('btnBaixar').addEventListener('click', async () => {
  const btn = document.getElementById('btnBaixar');
  const cardEl = preview.firstElementChild;
  if(!cardEl) return;

  // A arte é capturada sempre em escala 1:1 (ignora o "ajustar à tela"),
  // depois multiplicada em pixelRatio para ficar nítida na impressão.
  const scaleWrap = document.getElementById('previewScale');
  const originalTransform = scaleWrap.style.transform;
  scaleWrap.style.transform = 'none';

  btn.disabled = true;
  btn.textContent = 'Gerando imagem...';

  try{
    // Garante que as fontes locais (Anton/Montserrat) já carregaram
    // antes de capturar — evita texto com fonte errada ou falha de render.
    if(document.fonts && document.fonts.ready){
      await document.fonts.ready;
    }

    const dataUrl = await htmlToImage.toPng(cardEl, {
      pixelRatio: 3, // ~300dpi equivalente para telas base 96dpi
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    const nomeArquivo = (state.nome || 'produto')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'produto';

    const link = document.createElement('a');
    link.download = `arte-${state.model}-${nomeArquivo}.png`;
    link.href = dataUrl;
    link.click();
  }catch(err){
    console.error(err);
    alert('Não foi possível gerar a imagem.\n\nDetalhe técnico: ' + (err && err.message ? err.message : String(err)));
  }finally{
    scaleWrap.style.transform = originalTransform;
    btn.disabled = false;
    btn.textContent = 'Baixar arte (PNG)';
  }
});
