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

imagemInputEl.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.imagemDataUrl = reader.result;
    updateAvatarPreview();
    renderPreview();
  };
  reader.readAsDataURL(file);
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

