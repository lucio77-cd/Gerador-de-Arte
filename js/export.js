// ==========================================================
// EXPORT — gera o PNG a partir do card atualmente no preview
// ==========================================================
// export.js depende de `state` e `preview`, já declarados em render.js
// (carregado antes dele em index.html — mesmo escopo global, scripts
// clássicos).

const btnBaixarEl = document.getElementById('btnBaixar');

function nomeArquivoSeguro(nome){
  const slug = (nome || 'produto')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || 'produto';
}

// Espera todas as <img> dentro do card estarem totalmente decodificadas.
// BUG CORRIGIDO (preço "R$ 7 DO" / caixa preta no logo): antes a captura
// podia disparar com imagens ainda carregando ou a fonte Anton ainda não
// aplicada — o html-to-image "fotografa" o DOM no estado em que ele está
// naquele instante, então qualquer coisa que ainda não tenha terminado
// de carregar sai errada ou em branco no PNG final.
async function esperarImagensCarregarem(container){
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    if(img.complete && img.naturalWidth > 0) return Promise.resolve();
    if(typeof img.decode === 'function'){
      return img.decode().catch(() => new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }));
    }
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));
}

async function baixarArte(){
  const card = preview.firstElementChild;
  if(!card){
    alert('Nada pra exportar ainda — preencha os dados da etiqueta primeiro.');
    return;
  }

  const textoOriginal = btnBaixarEl.textContent;
  btnBaixarEl.disabled = true;
  btnBaixarEl.textContent = 'Gerando...';

  // BUG CORRIGIDO (layout do modelo Padrão saindo bagunçado no PNG): em
  // telas estreitas fitPreviewToScreen() aplica um transform: scale(...)
  // no #previewScale pra caber na tela. Se a captura acontece com essa
  // escala ainda ativa, o html-to-image mede o elemento com um tamanho
  // e o desenha com outro, e um layout em CSS Grid (usado no modelo
  // Padrão) quebra feio nessa mistura de medidas. Aqui a escala é
  // zerada antes de capturar e reaplicada (via fitPreviewToScreen) logo
  // depois, então visualmente nada muda pro usuário.
  const scaleWrap = document.getElementById('previewScale');
  const escalaOriginal = scaleWrap.style.transform;

  try{
    scaleWrap.style.transform = 'none';

    // espera as fontes (Anton/Montserrat) e as imagens do card estarem
    // 100% prontas antes de fotografar o DOM
    if(document.fonts && document.fonts.ready){
      await document.fonts.ready;
    }
    await esperarImagensCarregarem(card);
    // dá um "respiro" de um frame pro navegador aplicar o reflow depois
    // de zerar a escala, antes de capturar
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const dataUrl = await htmlToImage.toPng(card, {
      pixelRatio: 2,          // exporta em alta resolução (2x)
      backgroundColor: '#ffffff',
      cacheBust: true,        // evita cache de imagens antigas (ex: foto trocada)
      width: card.offsetWidth,
      height: card.offsetHeight,
    });

    const link = document.createElement('a');
    link.download = `etiqueta-${state.model}-${nomeArquivoSeguro(state.nome)}.png`;
    link.href = dataUrl;
    link.click();
  }catch(err){
    console.error(err);
    alert('Não foi possível gerar a imagem. Tente novamente.');
  }finally{
    scaleWrap.style.transform = escalaOriginal;
    if(typeof fitPreviewToScreen === 'function') fitPreviewToScreen();
    btnBaixarEl.disabled = false;
    btnBaixarEl.textContent = textoOriginal;
  }
}

btnBaixarEl.addEventListener('click', baixarArte);
