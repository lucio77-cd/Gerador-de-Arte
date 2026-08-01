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
  imagemDataUrl: null,
  fontNome: 40,   // tamanho do nome do produto (modelo Padrão), em px
  fontPreco: 96,  // tamanho do preço (modelo Padrão), em px — os demais
                  // pedaços do preço (R$, vírgula, centavos) escalam
                  // proporcionalmente a partir deste valor em templates.js
};

const preview = document.getElementById('preview');

// ==========================================================
// RENDER PRINCIPAL
// ==========================================================
function renderPreview(){
  preview.innerHTML = state.model === 'geladeira'
    ? renderGeladeiraTemplate(state)
    : renderPadraoTemplate(state);
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
// SWATCHES DE COR (gerados a partir do COLOR_MAP)
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
// SLIDERS DE TAMANHO DE FONTE (modelo Padrão)
// ==========================================================
const fontSliderBindings = [
  ['fonteNome', 'fontNome', 'fonteNomeValue'],
  ['fontePreco', 'fontPreco', 'fontePrecoValue'],
];

fontSliderBindings.forEach(([id, key, valueId]) => {
  const el = document.getElementById(id);
  const valueEl = document.getElementById(valueId);
  el.addEventListener('input', () => {
    state[key] = Number(el.value);
    valueEl.textContent = `${el.value}px`;
    renderPreview();
  });
});

// Upload de imagem do produto (avatar quadrado, toca pra escolher/trocar)
const uploadAvatarEl = document.getElementById('uploadAvatar');
const uploadAvatarPreviewEl = document.getElementById('uploadAvatarPreview');
const imagemInputEl = document.getElementById('imagemProduto');

function updateAvatarPreview(){
  if(state.imagemDataUrl){
    uploadAvatarEl.classList.add('has-image');
    uploadAvatarPreviewEl.innerHTML = `<img src="${state.imagemDataUrl}" alt="Foto do produto">`;
  } else {
    uploadAvatarEl.classList.remove('has-image');
    uploadAvatarPreviewEl.innerHTML = `<span class="upload-icon">📷</span>`;
  }
}

// toca na miniatura -> abre o seletor de arquivo do celular
uploadAvatarPreviewEl.addEventListener('click', () => imagemInputEl.click());

// Redimensiona a foto no upload (fotos de câmera vêm enormes — 3000x4000px,
// vários MB — isso deixa o preview lento e pode travar a exportação em
// celulares com menos memória). Reduz pro maior lado ter no máx. 1000px.
function resizeImageToDataUrl(file, maxDim = 1000, quality = 0.85){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
      img.onload = () => {
        let { width, height } = img;
        if(width > height && width > maxDim){
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if(height >= width && height > maxDim){
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

imagemInputEl.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    state.imagemDataUrl = await resizeImageToDataUrl(file);
    updateAvatarPreview();
    renderPreview();
  }catch(err){
    console.error(err);
    alert('Não foi possível usar essa foto. Tente outra imagem.');
  }
});

document.getElementById('btnRemoverImagem').addEventListener('click', (e) => {
  e.stopPropagation();
  state.imagemDataUrl = null;
  imagemInputEl.value = '';
  updateAvatarPreview();
  renderPreview();
});

// ==========================================================
// AJUSTAR À TELA (mobile) — escala o preview para caber na largura visível
// ==========================================================
function fitPreviewToScreen(){
  const scaleWrap = document.getElementById('previewScale');
  const scrollWrap = scaleWrap.parentElement;
  scaleWrap.style.transform = 'none';

  const cardEl = preview.firstElementChild;
  if(!cardEl) return;

  const naturalWidth = cardEl.offsetWidth;
  const availableWidth = scrollWrap.clientWidth - 8;

  if(naturalWidth > availableWidth){
    const scale = availableWidth / naturalWidth;
    scaleWrap.style.transform = `scale(${scale})`;
    scaleWrap.style.transformOrigin = 'top left';
    scaleWrap.style.height = (cardEl.offsetHeight * scale) + 'px';
    scaleWrap.style.width = availableWidth + 'px';
  } else {
    scaleWrap.style.height = 'auto';
    scaleWrap.style.width = 'max-content';
  }
}

document.getElementById('btnAjustarTela').addEventListener('click', fitPreviewToScreen);
window.addEventListener('resize', fitPreviewToScreen);

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================
updateAvatarPreview();
renderPreview();
