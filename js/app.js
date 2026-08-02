// ==========================================================
// ESTADO
// ==========================================================
const state = {
  model: 'geladeira',
  nome: '',
  categoria: '',
  precoInteiro: '8',
  precoCentavos: '99',
  cor: 'amarelo',
  orientacao: 'portrait',
  mostrarOferta: true,
  infoExtra: '',
  imagemImg: null, // objeto Image() já decodificado — não mais dataURL cru
  escalaNome: 1,    // multiplicador manual sobre o auto-ajuste do nome (1 = 100%)
  escalaImagem: 1,  // multiplicador manual sobre o tamanho da imagem do produto (Padrão)
  escalaPreco: 1,   // multiplicador manual sobre o alvo de tamanho do preço
};

const canvas = document.getElementById('artCanvas');

async function renderPreview(){
  if(state.model === 'geladeira'){
    await renderGeladeira(canvas, state);
  } else {
    await renderPadrao(canvas, state);
  }
  fitPreviewToScreen();
}

// ==========================================================
// TABS (troca de modelo)
// ==========================================================
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if(!btn) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  state.model = btn.dataset.model;
  document.body.classList.remove('model-geladeira', 'model-padrao');
  document.body.classList.add(`model-${state.model}`);
  renderPreview();
});
document.body.classList.add('model-geladeira');

// ==========================================================
// SWATCHES DE COR
// ==========================================================
const colorSwatchesEl = document.getElementById('corDestaque');

function buildColorSwatches(){
  colorSwatchesEl.innerHTML = Object.keys(COLOR_MAP).map(key => {
    const { hex } = COLOR_MAP[key];
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const selected = state.cor === key ? 'selected' : '';
    return `
      <button type="button" class="swatch ${selected}" data-cor="${key}">
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
  colorSwatchesEl.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  btn.classList.add('selected');
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
    renderPreview();
  });
});

document.getElementById('mostrarOferta').addEventListener('change', (e) => {
  state.mostrarOferta = e.target.checked;
  renderPreview();
});

// ==========================================================
// SLIDERS DE ESCALA (nome do produto / imagem do produto)
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
// UPLOAD DE FOTO DO PRODUTO
// ==========================================================
// BUG CORRIGIDO: antes a imagem entrava no estado como uma string dataURL
// crua e só virava um objeto <img> de verdade quando o innerHTML do
// template era montado — se esse innerHTML fosse escrito antes da nova
// imagem terminar de decodificar (ou corrompido por qualquer outro motivo,
// como o bug do onerror que já corrigimos antes), o upload "sumia" mesmo
// funcionando por dentro. Agora resizeImageToDataUrl() entrega direto um
// objeto Image() já decodificado (await img.decode()) ANTES de qualquer
// desenho acontecer — o app só chama renderPreview() quando a imagem já
// está 100% pronta pra ser usada com ctx.drawImage().
const uploadAvatarEl = document.getElementById('uploadAvatar');
const uploadAvatarPreviewEl = document.getElementById('uploadAvatarPreview');
const imagemInputEl = document.getElementById('imagemProduto');

function updateAvatarPreview(){
  if(state.imagemImg){
    uploadAvatarEl.classList.add('has-image');
    uploadAvatarPreviewEl.innerHTML = '';
    const thumb = state.imagemImg.cloneNode();
    uploadAvatarPreviewEl.appendChild(thumb);
  } else {
    uploadAvatarEl.classList.remove('has-image');
    uploadAvatarPreviewEl.innerHTML = `<span class="upload-icon">📷</span>`;
  }
}

uploadAvatarPreviewEl.addEventListener('click', () => imagemInputEl.click());

// Redimensiona a foto (fotos de câmera vêm enormes) e devolve um objeto
// Image() já decodificado e pronto pra desenhar no canvas.
async function resizeImageToImg(file, maxDim = 1000, quality = 0.85){
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const original = new Image();
  original.src = dataUrl;
  await original.decode();

  let { width, height } = original;
  if(width > height && width > maxDim){
    height = Math.round(height * (maxDim / width));
    width = maxDim;
  } else if(height >= width && height > maxDim){
    width = Math.round(width * (maxDim / height));
    height = maxDim;
  }

  const canvasTmp = document.createElement('canvas');
  canvasTmp.width = width;
  canvasTmp.height = height;
  canvasTmp.getContext('2d').drawImage(original, 0, 0, width, height);

  const resized = new Image();
  resized.src = canvasTmp.toDataURL('image/jpeg', quality);
  await resized.decode();
  return resized;
}

imagemInputEl.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    state.imagemImg = await resizeImageToImg(file);
    updateAvatarPreview();
    renderPreview();
  }catch(err){
    console.error(err);
    alert('Não foi possível usar essa foto. Tente outra imagem.');
  }
});

document.getElementById('btnRemoverImagem').addEventListener('click', (e) => {
  e.stopPropagation();
  state.imagemImg = null;
  imagemInputEl.value = '';
  updateAvatarPreview();
  renderPreview();
});

// ==========================================================
// AJUSTAR À TELA (mobile) — escala visualmente o canvas pra caber
// ==========================================================
// Importante: isso é só um transform CSS de exibição. A resolução
// interna do canvas (setupCanvas em engine.js) não muda com isso, então
// exportar continua sempre saindo na resolução real, não na escala visual.
function fitPreviewToScreen(){
  const scaleWrap = document.getElementById('previewScale');
  const scrollWrap = scaleWrap.parentElement;
  scaleWrap.style.transform = 'none';

  const naturalWidth = canvas.offsetWidth;
  const availableWidth = scrollWrap.clientWidth - 8;

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
// EXPORTAR PNG
// ==========================================================
// Não existe mais "capturar o DOM" — o canvas já É a imagem. Exportar é
// só pedir pro próprio canvas serializar seus pixels como PNG.
const btnBaixarEl = document.getElementById('btnBaixar');

function nomeArquivoSeguro(nome){
  const slug = (nome || 'produto')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || 'produto';
}

btnBaixarEl.addEventListener('click', () => {
  const textoOriginal = btnBaixarEl.textContent;
  btnBaixarEl.disabled = true;
  btnBaixarEl.textContent = 'Gerando...';

  canvas.toBlob((blob) => {
    btnBaixarEl.disabled = false;
    btnBaixarEl.textContent = textoOriginal;
    if(!blob){
      alert('Não foi possível gerar a imagem. Tente novamente.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `etiqueta-${state.model}-${nomeArquivoSeguro(state.nome)}.png`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
});

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================
updateAvatarPreview();
renderPreview();
