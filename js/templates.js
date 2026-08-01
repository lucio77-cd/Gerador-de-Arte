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

function handleLogoError(imgEl, className){
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = LOGO_FALLBACK_HTML;
  imgEl.replaceWith(div);
}

// ----------------------------------------------------------
// LOGO PRÉ-CARREGADO COMO DATA URL
// ----------------------------------------------------------
// BUG CORRIGIDO (box preto atrás do logo no PNG exportado): o <img>
// apontava sempre pra LOGO_SRC (um caminho de rede). No momento em que
// html-to-image captura o card, ele precisa buscar essa imagem nesse
// exato instante e embuti-la no PNG final — se a captura acontece antes
// desse fetch interno terminar (ou se o servidor/CDN responde com
// headers que impedem a leitura dos pixels), a lib não consegue ler o
// conteúdo da imagem e desenha um retângulo sólido no lugar dela.
// Agora a imagem é baixada e convertida pra data URL (base64) uma única
// vez, assim que o script carrega. A partir daí o <img src="..."> já
// nasce com o conteúdo embutido — não existe mais nenhum fetch de rede
// no momento da exportação, então não tem como esse tipo de corrida
// (race condition) acontecer.
let logoDataUrl = null;
const logoDataUrlReady = fetch(LOGO_SRC)
  .then(res => res.blob())
  .then(blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Falha ao ler o logo'));
    reader.readAsDataURL(blob);
  }))
  .then(dataUrl => { logoDataUrl = dataUrl; return dataUrl; })
  .catch(() => null); // se falhar, segue usando LOGO_SRC normalmente (com o fallback de sempre)

function logoTag(className){
  const src = logoDataUrl || LOGO_SRC;
  return `<img src="${src}" class="${className}" alt="Logo" onerror="handleLogoError(this, '${className}')">`;
}

// Formata preço em duas partes: inteiro e centavos (sempre 2 dígitos)
function formatPreco(inteiro, centavos){
  const i = (inteiro === '' || inteiro === null || isNaN(inteiro)) ? 0 : parseInt(inteiro, 10);
  let c = (centavos === '' || centavos === null || isNaN(centavos)) ? 0 : parseInt(centavos, 10);
  c = Math.max(0, Math.min(99, c));
  return { inteiro: i, centavos: String(c).padStart(2, '0') };
}

// ==========================================================
// ELEMENTOS DECORATIVOS (SVG)
// ==========================================================

// Linha curva tipo "sorriso" abaixo do nome do produto (nas duas artes de
// referência a linha não é reta, ela tem uma leve curvatura pra cima nas
// pontas e uma pequena "cauda" numa das pontas no modelo Padrão)
function linhaCurvaSvg(hex, variante){
  if(variante === 'padrao'){
    return `
      <svg class="linha-curva" viewBox="0 0 320 26" preserveAspectRatio="none" fill="none">
        <path d="M2,6 Q160,22 300,10 Q312,8 316,16" stroke="${hex}" stroke-width="4" stroke-linecap="round"/>
      </svg>`;
  }
  return `
    <svg class="linha-curva" viewBox="0 0 300 20" preserveAspectRatio="none" fill="none">
      <path d="M2,4 Q150,20 298,4" stroke="${hex}" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
}

// Respingo/pincelada de tinta atrás do preço (modelo Geladeira) — forma
// irregular, assimétrica, em vez do blob simétrico que tinha antes
function pincelaSvg(hex){
  return `
    <svg class="gel-preco-pincela" viewBox="0 0 420 230" preserveAspectRatio="none">
      <path d="M18,132 C6,92 34,48 92,34 C150,18 246,10 312,26
               C372,40 404,74 398,116 C394,150 408,178 386,198
               C356,224 292,214 244,222 C176,234 88,228 44,204
               C10,186 -2,164 18,132 Z" fill="${hex}"/>
    </svg>`;
}

// Sparkles/traços ao redor do logo (modelo Geladeira)
function sparklesHtml(hex){
  return `
    <svg class="gel-sparkle gel-sparkle-l1" viewBox="0 0 20 20"><path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="${hex}"/></svg>
    <svg class="gel-sparkle gel-sparkle-l2" viewBox="0 0 20 6"><rect x="0" y="1" width="20" height="4" rx="2" fill="${hex}"/></svg>
    <svg class="gel-sparkle gel-sparkle-r1" viewBox="0 0 20 20"><path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="${hex}"/></svg>
    <svg class="gel-sparkle gel-sparkle-r2" viewBox="0 0 20 6"><rect x="0" y="1" width="20" height="4" rx="2" fill="${hex}"/></svg>
  `;
}

// Ícone de gota (linear/contorno) — substitui o emoji 💧
const GOTA_SVG = `
  <svg class="gel-gota-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C12 2 5 11 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 11 12 2 12 2Z"
      stroke="#1a1a1a" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;

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
      <div class="gel-logo-wrap">
        ${sparklesHtml(cor.hex)}
        ${logoTag('gel-logo')}
      </div>
      <div class="gel-nome">${escapeHtml(nome)}</div>
      ${linhaCurvaSvg(cor.hex, 'geladeira')}
      <div class="gel-preco-wrap">
        ${pincelaSvg(cor.hex)}
        <div class="gel-preco">
          <span class="cifrao">R$</span>
          <span class="inteiro">${preco.inteiro}</span>
          <span class="centavos-wrap">
            <span class="virgula">,</span>
            <span class="centavos">${preco.centavos}</span>
          </span>
        </div>
      </div>
      <div class="gel-resistente">${GOTA_SVG}<span>RESISTENTE<br>À ÁGUA</span></div>
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
      ${linhaCurvaSvg(cor.hex, 'padrao')}
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

// Assim que o logo termina de carregar como data URL, redesenha o
// preview (se já tiver sido renderizado com o LOGO_SRC de rede)
logoDataUrlReady.then(() => {
  if(typeof renderPreview === 'function') renderPreview();
});
