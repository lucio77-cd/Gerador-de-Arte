// ==========================================================
// EXPORT — gera o PNG a partir do card atualmente no preview
// ==========================================================
// BUG CORRIGIDO: este arquivo era uma cópia idêntica de render.js
// (state, listeners de tabs, swatches, upload...) duplicando a
// declaração "const state" no escopo global. Como render.js e
// export.js são <script> clássicos (mesmo escopo léxico de topo),
// isso disparava SyntaxError: Identifier 'state' has already been
// declared assim que o navegador tentava carregar export.js — o
// arquivo inteiro falhava e nenhuma linha dele era executada,
// deixando o botão "Baixar arte" sem nenhum handler.
//
// export.js agora só cuida da exportação. Ele depende de `state`
// e `preview` já declarados em render.js, que é carregado antes
// dele em index.html.

const btnBaixarEl = document.getElementById('btnBaixar');

function nomeArquivoSeguro(nome){
  const slug = (nome || 'produto')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || 'produto';
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

  try{
    const dataUrl = await htmlToImage.toPng(card, {
      pixelRatio: 2,          // exporta em alta resolução (2x)
      backgroundColor: '#ffffff',
      cacheBust: true,        // evita cache de imagens antigas (ex: foto trocada)
    });

    const link = document.createElement('a');
    link.download = `etiqueta-${state.model}-${nomeArquivoSeguro(state.nome)}.png`;
    link.href = dataUrl;
    link.click();
  }catch(err){
    console.error(err);
    alert('Não foi possível gerar a imagem. Tente novamente.');
  }finally{
    btnBaixarEl.disabled = false;
    btnBaixarEl.textContent = textoOriginal;
  }
}

btnBaixarEl.addEventListener('click', baixarArte);
