// ==========================================================
// MAPA DE CORES
// chave -> { hex, light } | light=true => usar texto preto sobre a cor
// ==========================================================
const COLOR_MAP = {
  vermelho: { hex: '#E31E24', light: false },
  amarelo:  { hex: '#FFC400', light: true  },
  verde:    { hex: '#2E7D32', light: false },
  azul:     { hex: '#1565C0', light: false },
  laranja:  { hex: '#F57C00', light: false },
  roxo:     { hex: '#7B1FA2', light: false },
};

// Caminho do logo. Troque pelo arquivo real em /assets/logo-cris.png
const LOGO_SRC = 'assets/logo-cris.png';
const LOGO_FALLBACK_HTML = `
  <div style="font-family:'Anton',sans-serif;text-align:center;line-height:1;color:#8B1E1E;">
    <div style="font-size:11px;letter-spacing:1px;">PADARIA DA</div>
    <div style="font-size:22px;color:#E31E24;">CRIS</div>
  </div>
`;

// BUG CORRIGIDO: antes o fallback do logo era montado inline no atributo
// onerror="..." do <img>, injetando LOGO_FALLBACK_HTML (que contém aspas
// duplas de style="...") dentro de um atributo também delimitado por aspas
// duplas. O navegador fechava o atributo no primeiro " que encontrava e
// o resto do HTML vazava pro DOM como texto solto, corrompendo o preview
// inteiro (inclusive a imagem do produto, que nunca chegava a renderizar).
// Agora o fallback é tratado por uma função global nomeada, sem precisar
// escapar nada dentro do atributo.
function handleLogoError(imgEl, className){
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = LOGO_FALLBACK_HTML;
  imgEl.replaceWith(div);
}

function logoTag(className){
  return `<img src="${LOGO_SRC}" class="${className}" alt="Logo" onerror="handleLogoError(this, '${className}')">`;
}

// Formata preço em duas partes: inteiro e centavos (sempre 2 dígitos)
function formatPreco(inteiro, centavos){
  const i = (inteiro === '' || inteiro === null || isNaN(inteiro)) ? 0 : parseInt(inteiro, 10);
  let c = (centavos === '' || centavos === null || isNaN(centavos)) ? 0 : parseInt(centavos, 10);
  c = Math.max(0, Math.min(99, c));
  return { inteiro: i, centavos: String(c).padStart(2, '0') };
}

// ==========================================================
// TEMPLATE: GELADEIRA
// ==========================================================
function renderGeladeiraTemplate(data){
  const cor = COLOR_MAP[data.cor] || COLOR_MAP.amarelo;
  const preco = formatPreco(data.precoInteiro, data.precoCentavos);
  const orientClass = data.orientacao === 'landscape' ? 'orient-landscape' : 'orient-portrait';
  const nome = (data.nome || 'NOME DO PRODUTO').toUpperCase();

  return `
    <div class="card-geladeira ${orientClass}" style="--accent:${cor.hex}">
      ${logoTag('gel-logo')}
      <div class="gel-nome">${escapeHtml(nome)}</div>
      <div class="gel-linha"></div>
      <div class="gel-preco-wrap">
        <div class="gel-preco-fundo"></div>
        <div class="gel-preco">
          <span class="cifrao">R$</span>
          <span class="inteiro">${preco.inteiro}</span>
          <span class="centavos-wrap">
            <span class="virgula">,</span>
            <span class="centavos">${preco.centavos}</span>
          </span>
        </div>
      </div>
      <div class="gel-resistente">💧 RESISTENTE<br>À ÁGUA</div>
    </div>
  `;
}

// ==========================================================
// TEMPLATE: PADRÃO
// ==========================================================
function renderPadraoTemplate(data){
  const cor = COLOR_MAP[data.cor] || COLOR_MAP.vermelho;
  const preco = formatPreco(data.precoInteiro, data.precoCentavos);
  const nome = (data.nome || 'NOME DO PRODUTO').toUpperCase();
  const categoria = (data.categoria || '').toUpperCase();

  const categoriaHtml = categoria
    ? `<div class="pad-categoria">${escapeHtml(categoria)}</div>`
    : '';

  const ofertaHtml = data.mostrarOferta
    ? `<div class="pad-oferta">OFERTA</div>`
    : '';

  const imagemHtml = data.imagemDataUrl
    ? `<div class="pad-imagem"><img src="${data.imagemDataUrl}" alt="Produto"></div>`
    : `<div class="pad-imagem">IMAGEM DO<br>PRODUTO<br>(opcional)</div>`;

  const infoHtml = data.infoExtra
    ? `<div class="pad-info">${escapeHtml(data.infoExtra.toUpperCase())}</div>`
    : '';

  return `
    <div class="card-padrao" style="--accent:${cor.hex}" data-accent-light="${cor.light}">
      ${logoTag('pad-logo')}
      ${categoriaHtml}
      <div class="pad-nome">${escapeHtml(nome)}</div>
      <div class="pad-linha"></div>
      ${ofertaHtml}
      <div class="pad-preco">
        <span class="cifrao">R$</span>
        <span class="inteiro">${preco.inteiro}</span>
        <span class="centavos-wrap">
          <span class="virgula">,</span>
          <span class="centavos">${preco.centavos}</span>
        </span>
      </div>
      ${imagemHtml}
      ${infoHtml}
    </div>
  `;
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
