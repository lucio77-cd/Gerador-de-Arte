// ==========================================================
// ESTADO DA APLICAÇÃO
// ==========================================================
// HISTÓRICO DE MELHORIAS:
// - Renderização agrupada por requestAnimationFrame: evita redesenhar o
//   Canvas várias vezes no mesmo ciclo quando o usuário digita ou arrasta.
// - Controle de versão da renderização: impede uma renderização antiga de
//   sobrescrever uma alteração mais recente.
// - Upload validado e limitado a 8 MB antes de decodificar a imagem.
// - Exportação validada e com liberação segura da URL temporária.
// OBJETIVO: tornar o uso mais previsível em celulares e evitar arquivos
// inválidos, travamentos por imagens enormes e PNGs com dados incorretos.
// FUTURO: adicionar testes automatizados de renderização em navegador.

const state = {
  model: 'geladeira',
  nome: '',
  categoria: '',
  precoInteiro: '8',
  precoCentavos: '99',
  cor: 'amarelo',
  orientacao: 'portrait',
  mostrarOferta: true,
  mostrarLogo: true, // mantém o comportamento atual: logo visível por padrão
  infoExtra: '',
  imagemImg: null,
  estadoImagem: 'nenhum', // 'foto' | 'promocao' | 'nenhum'
  escalaNome: 1,
  escalaImagem: 1,
  escalaPreco: 1,
  larguraImpressaoMm: 100,
};

const canvas = document.getElementById('artCanvas');
const statusEl = document.getElementById('appStatus');
const precoInteiroEl = document.getElementById('precoInteiro');
const precoCentavosEl = document.getElementById('precoCentavos');
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
let renderVersion = 0;
let renderFrame = 0;

function setStatus(message, type = 'info'){
  if(!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.status = type;
}

function obterDimensoesModelo(){
  if(state.model === 'padrao') return DESIGN.padrao;
  return state.orientacao === 'landscape' ? DESIGN.geladeiraLandscape : DESIGN.geladeiraPortrait;
}

function lerLarguraImpressaoMm(){
  const valor = document.getElementById('larguraImpressao').value.trim();
  if(!/^\d+(?:[.,]\d{0,4})?$/.test(valor)) return null;
  const larguraCm = Number(valor.replace(',', '.'));
  if(!Number.isFinite(larguraCm) || larguraCm < 2 || larguraCm > 18) return null;
  return larguraCm * 10;
}

function atualizarAlturaImpressao(){
  const larguraMm = lerLarguraImpressaoMm();
  const alturaEl = document.getElementById('alturaImpressao');
  if(larguraMm === null){
    alturaEl.textContent = '—';
    return null;
  }
  const dimensoes = obterDimensoesModelo();
  const alturaMm = larguraMm * dimensoes.h / dimensoes.w;
  const alturaCm = (alturaMm / 10).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
  alturaEl.textContent = `${alturaCm} cm`;
  return alturaMm;
}

function renderPreview(){
  const currentVersion = ++renderVersion;
  if(renderFrame) cancelAnimationFrame(renderFrame);

  // Agrupa eventos rápidos em um único desenho e descarta pedidos antigos.
  renderFrame = requestAnimationFrame(async () => {
    renderFrame = 0;
    try{
      await assetsReady();
      if(currentVersion !== renderVersion) return;

      if(state.model === 'geladeira'){
        await renderGeladeira(canvas, state);
      } else {
        await renderPadrao(canvas, state);
      }

      if(currentVersion === renderVersion){
        fitPreviewToScreen();
        setStatus('Pré-visualização atualizada.');
      }
    }catch(err){
      console.error('Erro ao atualizar a pré-visualização:', err);
      setStatus('Não foi possível atualizar a arte. Recarregue a página e tente novamente.', 'error');
    }
  });
}

// ==========================================================
// ABAS DE MODELO
// ==========================================================
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if(!btn) return;

  document.querySelectorAll('.tab').forEach(tab => {
    const active = tab === btn;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });

  state.model = btn.dataset.model;
  atualizarAlturaImpressao();
  document.body.classList.remove('model-geladeira', 'model-padrao');
  document.body.classList.add(`model-${state.model}`);
  renderPreview();
});
document.body.classList.add('model-geladeira');

// ==========================================================
// CORES
// ==========================================================
const colorSwatchesEl = document.getElementById('corDestaque');

function buildColorSwatches(){
  colorSwatchesEl.innerHTML = Object.keys(COLOR_MAP).map(key => {
    const { hex } = COLOR_MAP[key];
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const selected = state.cor === key ? 'selected' : '';
    return `
      <button type="button" class="swatch ${selected}" data-cor="${key}"
        aria-label="Usar cor ${label}" aria-pressed="${state.cor === key}">
        <span class="swatch-circle" style="background:${hex}"></span>
        <span class="swatch-label">${label}</span>
      </button>
    `;
  }).join('');
}

colorSwatchesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch');
  if(!btn) return;
  state.cor = btn.dataset.cor;
  colorSwatchesEl.querySelectorAll('.swatch').forEach(swatch => {
    const active = swatch === btn;
    swatch.classList.toggle('selected', active);
    swatch.setAttribute('aria-pressed', String(active));
  });
  renderPreview();
});
buildColorSwatches();

// ==========================================================
// CAMPOS DO FORMULÁRIO
// ==========================================================
const fieldBindings = [
  ['nomeProduto', 'nome'],
  ['categoria', 'categoria'],
  ['precoInteiro', 'precoInteiro'],
  ['precoCentavos', 'precoCentavos'],
  ['orientacaoGeladeira', 'orientacao'],
  ['infoExtra', 'infoExtra'],
];

fieldBindings.forEach(([id, key]) => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    state[key] = el.value;
    if(key === 'orientacao') atualizarAlturaImpressao();
    renderPreview();
  });
});

document.getElementById('larguraImpressao').addEventListener('input', () => {
  const larguraMm = lerLarguraImpressaoMm();
  state.larguraImpressaoMm = larguraMm ?? 100;
  atualizarAlturaImpressao();
});

document.getElementById('mostrarLogo').addEventListener('change', (e) => {
  state.mostrarLogo = e.target.checked;
  renderPreview();
});

document.getElementById('mostrarOferta').addEventListener('change', (e) => {
  state.mostrarOferta = e.target.checked;
  renderPreview();
});

// ==========================================================
// CONTROLES DE ESCALA
// ==========================================================
const escalaBindings = [
  ['escalaNome', 'escalaNome', 'escalaNomeValue'],
  ['escalaImagem', 'escalaImagem', 'escalaImagemValue'],
  ['escalaPreco', 'escalaPreco', 'escalaPrecoValue'],
];

escalaBindings.forEach(([id, key, valueId]) => {
  const el = document.getElementById(id);
  const valueEl = document.getElementById(valueId);
  el.addEventListener('input', () => {
    state[key] = Number(el.value) / 100;
    valueEl.textContent = `${el.value}%`;
    renderPreview();
  });
});

// ==========================================================
// ESPAÇO DA IMAGEM: FOTO / SELO / NENHUM
// ==========================================================
const estadoImagemSeletorEl = document.getElementById('estadoImagemSeletor');
const uploadFotoFieldEl = document.getElementById('uploadFotoField');
const uploadAvatarEl = document.getElementById('uploadAvatar');
const uploadAvatarPreviewEl = document.getElementById('uploadAvatarPreview');
const imagemInputEl = document.getElementById('imagemProduto');

function setEstadoImagem(novoEstado, { abrirSeletorArquivo = false } = {}){
  const estadosValidos = ['foto', 'promocao', 'nenhum'];
  if(!estadosValidos.includes(novoEstado)) return;

  state.estadoImagem = novoEstado;
  estadoImagemSeletorEl.querySelectorAll('.segmented-btn').forEach(btn => {
    const active = btn.dataset.estado === novoEstado;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  uploadFotoFieldEl.style.display = novoEstado === 'foto' ? 'flex' : 'none';

  if(novoEstado === 'foto' && abrirSeletorArquivo && !state.imagemImg){
    imagemInputEl.click();
  }
  renderPreview();
}

estadoImagemSeletorEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.segmented-btn');
  if(btn) setEstadoImagem(btn.dataset.estado, { abrirSeletorArquivo: true });
});

function updateAvatarPreview(){
  if(state.imagemImg){
    uploadAvatarEl.classList.add('has-image');
    uploadAvatarPreviewEl.replaceChildren();
    const thumb = state.imagemImg.cloneNode();
    thumb.alt = 'Prévia da foto do produto';
    uploadAvatarPreviewEl.appendChild(thumb);
  } else {
    uploadAvatarEl.classList.remove('has-image');
    uploadAvatarPreviewEl.innerHTML = '<span class="upload-icon" aria-hidden="true">📷</span>';
  }
}

uploadAvatarPreviewEl.addEventListener('click', () => imagemInputEl.click());
uploadAvatarPreviewEl.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' || e.key === ' '){
    e.preventDefault();
    imagemInputEl.click();
  }
});

// Reduz a imagem antes de guardá-la no estado. O limite evita que uma
// foto original muito grande consuma memória excessiva no celular.
async function resizeImageToImg(file, maxDim = 1000, quality = 0.85){
  // Aceita formatos raster comuns. SVG é excluído para evitar recursos externos
  // embutidos que podem impedir a exportação segura do Canvas.
  const formatosPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if(!file || !formatosPermitidos.includes(file.type)){
    throw new Error('Use uma imagem JPG, PNG, WEBP ou GIF.');
  }
  if(file.size > MAX_IMAGE_SIZE){
    throw new Error('A imagem deve ter no máximo 8 MB.');
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const original = new Image();
  original.src = dataUrl;
  await original.decode();

  if(!original.naturalWidth || !original.naturalHeight){
    throw new Error('A imagem selecionada não possui dimensões válidas.');
  }

  const ratio = Math.min(1, maxDim / Math.max(original.naturalWidth, original.naturalHeight));
  const width = Math.max(1, Math.round(original.naturalWidth * ratio));
  const height = Math.max(1, Math.round(original.naturalHeight * ratio));
  const canvasTmp = document.createElement('canvas');
  canvasTmp.width = width;
  canvasTmp.height = height;

  const context = canvasTmp.getContext('2d');
  if(!context) throw new Error('Não foi possível preparar a imagem.');
  context.drawImage(original, 0, 0, width, height);

  const resizedBlob = await new Promise((resolve, reject) => {
    canvasTmp.toBlob(blob => {
      if(blob) resolve(blob);
      else reject(new Error('Não foi possível redimensionar a imagem.'));
    }, 'image/jpeg', quality);
  });

  const objectUrl = URL.createObjectURL(resizedBlob);
  const resized = new Image();
  try{
    resized.src = objectUrl;
    await resized.decode();
    return resized;
  }finally{
    // A imagem decodificada continua disponível mesmo após liberar a URL.
    URL.revokeObjectURL(objectUrl);
  }
}

imagemInputEl.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;

  try{
    const novaImagem = await resizeImageToImg(file);
    state.imagemImg = novaImagem;
    state.estadoImagem = 'foto';
    setEstadoImagem('foto');
    updateAvatarPreview();
    setStatus('Foto carregada e otimizada.');
  }catch(err){
    console.error('Falha no upload da imagem:', err);
    setStatus(err.message || 'Não foi possível usar essa foto. Tente outra imagem.', 'error');
    alert(err.message || 'Não foi possível usar essa foto. Tente outra imagem.');
    imagemInputEl.value = '';
  }
});

document.getElementById('btnRemoverImagem').addEventListener('click', (e) => {
  e.stopPropagation();
  state.imagemImg = null;
  imagemInputEl.value = '';
  updateAvatarPreview();
  setEstadoImagem('nenhum');
});

// ==========================================================
// AJUSTE VISUAL DO PREVIEW
// ==========================================================
// O transform é apenas visual. A resolução real do Canvas permanece
// intacta, portanto o PNG não perde qualidade ao ajustar à tela.
function fitPreviewToScreen(){
  const scaleWrap = document.getElementById('previewScale');
  const scrollWrap = scaleWrap.parentElement;
  scaleWrap.style.transform = 'none';

  const naturalWidth = canvas.offsetWidth;
  const availableWidth = Math.max(0, scrollWrap.clientWidth - 8);
  if(!naturalWidth || !availableWidth) return;

  if(naturalWidth > availableWidth){
    const scale = availableWidth / naturalWidth;
    scaleWrap.style.transform = `scale(${scale})`;
    scaleWrap.style.transformOrigin = 'top left';
    scaleWrap.style.height = (canvas.offsetHeight * scale) + 'px';
    scaleWrap.style.width = availableWidth + 'px';
  } else {
    scaleWrap.style.height = 'auto';
    scaleWrap.style.width = 'max-content';
  }
}

document.getElementById('btnAjustarTela').addEventListener('click', fitPreviewToScreen);
window.addEventListener('resize', fitPreviewToScreen);

// ==========================================================
// VALIDAÇÃO E EXPORTAÇÃO PNG
// ==========================================================
const btnBaixarEl = document.getElementById('btnBaixar');

function nomeArquivoSeguro(nome){
  const slug = (nome || 'produto')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || 'produto';
}

function validarPreco(){
  const inteiroTexto = precoInteiroEl.value.trim();
  const centavosTexto = precoCentavosEl.value.trim();
  const inteiro = inteiroTexto === '' ? 0 : Number(inteiroTexto);
  const centavos = centavosTexto === '' ? 0 : Number(centavosTexto);

  if(!Number.isSafeInteger(inteiro) || inteiro < 0){
    return { valido: false, campo: precoInteiroEl, mensagem: 'O preço inteiro deve ser um número inteiro igual ou maior que zero.' };
  }
  if(!Number.isInteger(centavos) || centavos < 0 || centavos > 99){
    return { valido: false, campo: precoCentavosEl, mensagem: 'Os centavos devem ser um número inteiro entre 00 e 99.' };
  }

  state.precoInteiro = String(inteiro);
  state.precoCentavos = String(centavos);
  return { valido: true };
}

function canvasToBlob(targetCanvas){
  return new Promise((resolve, reject) => {
    targetCanvas.toBlob(blob => {
      if(blob) resolve(blob);
      else reject(new Error('O navegador não conseguiu gerar o arquivo PNG.'));
    }, 'image/png');
  });
}

btnBaixarEl.addEventListener('click', async () => {
  const validacao = validarPreco();
  if(!validacao.valido){
    setStatus(validacao.mensagem, 'error');
    alert(validacao.mensagem);
    validacao.campo.focus();
    return;
  }

  const textoOriginal = btnBaixarEl.textContent;
  btnBaixarEl.disabled = true;
  btnBaixarEl.textContent = 'Gerando...';
  setStatus('Preparando o arquivo PNG...');

  try{
    // Aguarda os recursos e redesenha com os últimos valores antes de exportar.
    await assetsReady();
    if(state.model === 'geladeira') await renderGeladeira(canvas, state);
    else await renderPadrao(canvas, state);

    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `etiqueta-${state.model}-${nomeArquivoSeguro(state.nome)}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Não revogar no mesmo instante do click: alguns navegadores móveis
    // iniciam o download de forma assíncrona.
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus('PNG gerado. Verifique a pasta de downloads do dispositivo.', 'success');
  }catch(err){
    console.error('Falha ao exportar PNG:', err);
    setStatus('Não foi possível gerar a imagem. Tente novamente.', 'error');
    alert('Não foi possível gerar a imagem. Tente novamente.');
  }finally{
    btnBaixarEl.disabled = false;
    btnBaixarEl.textContent = textoOriginal;
  }
});

// ==========================================================
// EXPORTAÇÃO PDF A4 — ARTE INDIVIDUAL
// ==========================================================
const btnBaixarPdfEl = document.getElementById('btnBaixarPdf');

btnBaixarPdfEl.addEventListener('click', async () => {
  const validacao = validarPreco();
  if(!validacao.valido){
    setStatus(validacao.mensagem, 'error');
    alert(validacao.mensagem);
    validacao.campo.focus();
    return;
  }

  const larguraMm = lerLarguraImpressaoMm();
  if(larguraMm === null){
    const mensagem = 'Informe uma largura entre 2 e 18 cm, usando no máximo 4 casas decimais.';
    setStatus(mensagem, 'error');
    alert(mensagem);
    document.getElementById('larguraImpressao').focus();
    return;
  }

  const alturaMm = atualizarAlturaImpressao();
  if(!alturaMm){
    setStatus('Não foi possível calcular a altura da etiqueta.', 'error');
    return;
  }

  const textoOriginal = btnBaixarPdfEl.textContent;
  btnBaixarPdfEl.disabled = true;
  btnBaixarPdfEl.textContent = 'Gerando PDF...';
  setStatus('Renderizando a arte em 300 DPI e montando a folha A4...');

  try{
    await assetsReady();
    const dimensoes = obterDimensoesModelo();
    const larguraPixels = Math.round(larguraMm / 25.4 * PDFPrint.dpi);
    const escalaImpressao = larguraPixels / dimensoes.w;
    const canvasImpressao = document.createElement('canvas');

    if(state.model === 'geladeira'){
      await renderGeladeira(canvasImpressao, state, escalaImpressao);
    } else {
      await renderPadrao(canvasImpressao, state, escalaImpressao);
    }

    const blob = await PDFPrint.gerarPDF(canvasImpressao, { larguraMm, alturaMm });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `etiqueta-${state.model}-${nomeArquivoSeguro(state.nome)}-A4.pdf`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus('PDF A4 gerado em 300 DPI, com sangria de 2 mm e marcas de corte. Imprima em tamanho real (100%).', 'success');
  }catch(err){
    console.error('Falha ao exportar PDF:', err);
    const mensagem = err.message || 'Não foi possível gerar o PDF. Tente novamente.';
    setStatus(mensagem, 'error');
    alert(mensagem);
  }finally{
    btnBaixarPdfEl.disabled = false;
    btnBaixarPdfEl.textContent = textoOriginal;
  }
});

// ==========================================================

/* ==========================================================
   FILA DE ARTES — MONTAGEM AUTOMÁTICA EM FOLHAS A4
========================================================== */
const filaArtes = [];
const listaArtesFolhaEl = document.getElementById('listaArtesFolha');
const btnAdicionarFolhaEl = document.getElementById('btnAdicionarFolha');
const btnBaixarFolhaEl = document.getElementById('btnBaixarFolha');

function atualizarListaArtesFolha(){
  listaArtesFolhaEl.replaceChildren();
  if(!filaArtes.length){
    const vazio=document.createElement('p');
    vazio.className='print-size-hint';
    vazio.textContent='Nenhuma arte adicionada. Crie uma etiqueta e toque em “Adicionar à folha”.';
    listaArtesFolhaEl.appendChild(vazio);
    btnBaixarFolhaEl.disabled=true;
    return;
  }
  btnBaixarFolhaEl.disabled=false;
  filaArtes.forEach((item,index)=>{
    const linha=document.createElement('div');
    linha.className='print-queue-item';
    const descricao=document.createElement('div');
    descricao.className='print-queue-description';
    const nome=document.createElement('strong');
    nome.textContent=item.nome;
    const medida=document.createElement('small');
    medida.textContent=`${(item.larguraMm/10).toLocaleString('pt-BR',{maximumFractionDigits:4})} × ${(item.alturaMm/10).toLocaleString('pt-BR',{maximumFractionDigits:4})} cm`;
    descricao.append(nome,medida);
    const quantidade=document.createElement('label');
    quantidade.className='print-queue-quantity';
    quantidade.textContent='Cópias';
    const campo=document.createElement('input');
    campo.type='number'; campo.min='1'; campo.max='500'; campo.step='1';
    campo.value=String(item.quantidade); campo.dataset.queueQuantity=String(index);
    quantidade.appendChild(campo);
    const remover=document.createElement('button');
    remover.type='button'; remover.className='btn-link';
    remover.textContent='Remover'; remover.dataset.queueRemove=String(index);
    linha.append(descricao,quantidade,remover);
    listaArtesFolhaEl.appendChild(linha);
  });
}

btnAdicionarFolhaEl.addEventListener('click',async()=>{
  const validacao=validarPreco();
  if(!validacao.valido){
    setStatus(validacao.mensagem,'error'); alert(validacao.mensagem); validacao.campo.focus(); return;
  }
  const larguraMm=lerLarguraImpressaoMm();
  if(larguraMm===null){
    const mensagem='Informe uma largura entre 2 e 18 cm, usando no máximo 4 casas decimais.';
    setStatus(mensagem,'error'); alert(mensagem); document.getElementById('larguraImpressao').focus(); return;
  }
  const dimensoes=obterDimensoesModelo();
  const alturaMm=larguraMm*dimensoes.h/dimensoes.w;
  const textoOriginal=btnAdicionarFolhaEl.textContent;
  btnAdicionarFolhaEl.disabled=true; btnAdicionarFolhaEl.textContent='Adicionando...';
  try{
    await assetsReady();
    const escala=Math.round(larguraMm/25.4*PDFPrint.dpi)/dimensoes.w;
    const arteCanvas=document.createElement('canvas');
    if(state.model==='geladeira') await renderGeladeira(arteCanvas,state,escala);
    else await renderPadrao(arteCanvas,state,escala);
    const imagemBlob=await new Promise((resolve,reject)=>{
      arteCanvas.toBlob(blob=>{
        if(blob) resolve(blob);
        else reject(new Error('Não foi possível guardar a arte na fila.'));
      },'image/png');
    });
    filaArtes.push({
      blob:imagemBlob,
      nome:(state.nome||`Arte ${filaArtes.length+1}`).trim(),
      larguraMm, alturaMm, quantidade:1
    });
    atualizarListaArtesFolha();
    setStatus(`Arte adicionada à folha. Total: ${filaArtes.length} modelo(s).`,'success');
  }catch(err){
    console.error('Falha ao adicionar arte à folha:',err);
    setStatus(err.message||'Não foi possível adicionar esta arte à folha.','error');
    alert(err.message||'Não foi possível adicionar esta arte à folha.');
  }finally{
    btnAdicionarFolhaEl.disabled=false; btnAdicionarFolhaEl.textContent=textoOriginal;
  }
});

listaArtesFolhaEl.addEventListener('change',(event)=>{
  const campo=event.target.closest('[data-queue-quantity]');
  if(!campo) return;
  const index=Number(campo.dataset.queueQuantity);
  const quantidade=Number(campo.value);
  if(!Number.isInteger(quantidade)||quantidade<1||quantidade>500){
    alert('Informe uma quantidade inteira entre 1 e 500.');
    campo.value=String(filaArtes[index].quantidade); return;
  }
  filaArtes[index].quantidade=quantidade;
  setStatus('Quantidade de cópias atualizada.');
});

listaArtesFolhaEl.addEventListener('click',(event)=>{
  const botao=event.target.closest('[data-queue-remove]');
  if(!botao) return;
  filaArtes.splice(Number(botao.dataset.queueRemove),1);
  atualizarListaArtesFolha();
  setStatus('Arte removida da fila.');
});

btnBaixarFolhaEl.addEventListener('click',async()=>{
  if(!filaArtes.length) return;
  const textoOriginal=btnBaixarFolhaEl.textContent;
  btnBaixarFolhaEl.disabled=true; btnBaixarFolhaEl.textContent='Montando PDF...';
  setStatus('Organizando as artes nas folhas A4...');
  try{
    const blob=await PDFPrint.gerarPDFMultiplo(filaArtes);
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.download='etiquetas-varias-artes-A4.pdf'; link.href=url;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),2500);
    setStatus('PDF com várias artes gerado. As páginas extras foram criadas automaticamente; imprima em tamanho real (100%).','success');
  }catch(err){
    console.error('Falha ao montar PDF com várias artes:',err);
    const mensagem=err.message||'Não foi possível montar o PDF. Tente novamente.';
    setStatus(mensagem,'error'); alert(mensagem);
  }finally{
    btnBaixarFolhaEl.disabled=false; btnBaixarFolhaEl.textContent=textoOriginal;
  }
});

atualizarListaArtesFolha();

// INICIALIZAÇÃO
// ==========================================================
atualizarAlturaImpressao();
updateAvatarPreview();
renderPreview();
