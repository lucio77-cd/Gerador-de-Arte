// ==========================================================
// MOTOR DE RENDERIZAÇÃO — CANVAS NATIVO, BASEADO NO spec-camadas.md
// ==========================================================
// Cada elemento visual é tratado como uma camada independente: tem uma
// condição "ativo" (liga/desliga sem `if` espalhado pelo desenho), uma
// âncora e um alvo de tamanho — os três tirados por medição de pixel
// das artes de referência, documentados em spec-camadas.md. Todas as
// posições são em % do card (0 a 1), não pixel fixo, então escalam
// junto se o card mudar de tamanho.

const CANVAS_SCALE = 2; // resolução interna (nitidez tipo "retina")

const COLOR_MAP = {
  vermelho: { hex: '#E31E24', light: false },
  amarelo:  { hex: '#FFC400', light: true  },
  verde:    { hex: '#2E7D32', light: false },
  azul:     { hex: '#1565C0', light: false },
  laranja:  { hex: '#F57C00', light: false },
  roxo:     { hex: '#7B1FA2', light: false },
};

// Proporções medidas nas referências (spec-camadas.md):
//   Padrão:    995 x 957  -> 1,04:1 (quase quadrado)
//   Geladeira: 856 x 904  -> 0,95:1 (quase quadrado, um pouco mais alto)
const DESIGN = {
  padrao:             { w: 995, h: 957 },
  geladeiraPortrait:  { w: 856, h: 904 },
  geladeiraLandscape: { w: 904, h: 856 },
};

// ----------------------------------------------------------
// CARREGAMENTO DE ASSETS
// ----------------------------------------------------------
let logoImage = null;
const logoReady = (async () => {
  try {
    const img = new Image();
    img.src = 'assets/logo-cris.png';
    await img.decode();
    logoImage = img;
  } catch (err) {
    console.error('Não foi possível carregar o logo:', err);
  }
})();

const FONT_FILES = [
  ['Anton', 'assets/fonts/anton-latin-400-normal.woff2', '400'],
  ['Montserrat', 'assets/fonts/montserrat-latin-500-normal.woff2', '500'],
  ['Montserrat', 'assets/fonts/montserrat-latin-600-normal.woff2', '600'],
  ['Montserrat', 'assets/fonts/montserrat-latin-700-normal.woff2', '700'],
  ['Montserrat', 'assets/fonts/montserrat-latin-800-normal.woff2', '800'],
];

const fontsReady = Promise.all(FONT_FILES.map(async ([family, url, weight]) => {
  try {
    const face = new FontFace(family, `url('${url}')`, { weight });
    await face.load();
    document.fonts.add(face);
  } catch (err) {
    console.error(`Não foi possível carregar a fonte ${family} ${weight}:`, err);
  }
}));

async function assetsReady(){
  await Promise.all([logoReady, fontsReady]);
}

// ----------------------------------------------------------
// UTILITÁRIOS DE BASE
// ----------------------------------------------------------
function setupCanvas(canvas, logicalW, logicalH){
  canvas.width = logicalW * CANVAS_SCALE;
  canvas.height = logicalH * CANVAS_SCALE;
  canvas.style.width = logicalW + 'px';
  canvas.style.height = logicalH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
  return ctx;
}

function roundRectPath(ctx, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth){
  const words = text.split(' ').filter(Boolean);
  if(words.length === 0) return [''];
  const lines = [];
  let atual = words[0];
  for(let i = 1; i < words.length; i++){
    const teste = atual + ' ' + words[i];
    if(ctx.measureText(teste).width <= maxWidth){
      atual = teste;
    } else {
      lines.push(atual);
      atual = words[i];
    }
  }
  lines.push(atual);
  return lines;
}

// Camada `texto-autofit`: busca binária pelo maior tamanho de fonte que
// ainda cabe em até `maxLines` linhas dentro de maxWidth x maxHeight.
function fitText(ctx, text, { fontFamily, weight = '400', min = 16, max = 96, maxWidth, maxHeight, maxLines = 2, lineHeightRatio = 1.05 }){
  let lo = min, hi = max, melhor = { size: min, lines: wrapText(ctx, text, maxWidth) };
  while(lo <= hi){
    const meio = Math.floor((lo + hi) / 2);
    ctx.font = `${weight} ${meio}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth);
    const alturaTotal = lines.length * meio * lineHeightRatio;
    if(lines.length <= maxLines && alturaTotal <= maxHeight){
      melhor = { size: meio, lines };
      lo = meio + 1;
    } else {
      hi = meio - 1;
    }
  }
  ctx.font = `${weight} ${melhor.size}px ${fontFamily}`;
  return melhor;
}

// Mede a altura real do glifo (ascent+descent) numa fonte, pra calibrar
// com precisão a camada `texto-proporcional` sem depender de uma razão
// cap-height/font-size chutada — pergunta pro próprio canvas.
function medirAlturaGlifo(ctx, texto, fontFamily, weight, sizeRef = 100){
  ctx.font = `${weight} ${sizeRef}px ${fontFamily}`;
  const m = ctx.measureText(texto);
  const altura = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0);
  return altura > 0 ? altura : sizeRef * 0.72; // fallback se o navegador não suportar as métricas
}

function drawImageCover(ctx, img, x, y, w, h, radius = 0){
  const propImagem = img.width / img.height;
  const propBox = w / h;
  let sx, sy, sw, sh;
  if(propImagem > propBox){
    sh = img.height; sw = sh * propBox; sx = (img.width - sw) / 2; sy = 0;
  } else {
    sw = img.width; sh = sw / propBox; sx = 0; sy = (img.height - sh) / 2;
  }
  ctx.save();
  if(radius){ roundRectPath(ctx, x, y, w, h, radius); ctx.clip(); }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function formatPreco(inteiro, centavos){
  const i = (inteiro === '' || inteiro == null || isNaN(inteiro)) ? 0 : parseInt(inteiro, 10);
  let c = (centavos === '' || centavos == null || isNaN(centavos)) ? 0 : parseInt(centavos, 10);
  c = Math.max(0, Math.min(99, c));
  return { inteiro: String(i), centavos: String(c).padStart(2, '0') };
}

// ----------------------------------------------------------
// CAMADA: badge (categoria / oferta / info) — dimensiona pelo próprio
// texto (medido) + padding, nunca uma caixa fixa que corta o conteúdo
// ----------------------------------------------------------
function drawBadge(ctx, texto, { x, y, alturaAlvo, cor, corTexto, align = 'left', paddingX, rotationDeg = 0 }){
  const fontSize = Math.round(alturaAlvo * 0.5);
  ctx.font = `800 ${fontSize}px Montserrat`;
  const textW = ctx.measureText(texto).width;
  const pad = paddingX ?? alturaAlvo * 0.4;
  const badgeW = textW + pad * 2;
  const badgeH = alturaAlvo;

  ctx.save();
  if(rotationDeg){
    const cx = align === 'center' ? x : x + badgeW / 2;
    ctx.translate(cx, y + badgeH / 2);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.translate(-badgeW / 2, -badgeH / 2);
  } else {
    ctx.translate(align === 'center' ? x - badgeW / 2 : x, y);
  }
  ctx.fillStyle = cor;
  roundRectPath(ctx, 0, 0, badgeW, badgeH, badgeH / 2 * 0.5);
  ctx.fill();
  ctx.fillStyle = corTexto;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, badgeW / 2, badgeH / 2 + fontSize * 0.04);
  ctx.restore();

  return { w: badgeW, h: badgeH };
}

// ----------------------------------------------------------
// CAMADA: texto-proporcional (preço) — nasce no tamanho "cheio" medido
// na referência e só encolhe se não couber na largura disponível.
// ----------------------------------------------------------
function drawPreco(ctx, { inteiro, centavos }, { anchorX, baselineY, alturaAlvo, maxWidth, align = 'left', color = '#000000' }){
  const RATIO_CIFRAO = 0.3125;   // proporções herdadas do design original,
  const RATIO_CENTAVOS = 0.479;  // validadas visualmente antes desta rodada

  const alturaGlifo = medirAlturaGlifo(ctx, inteiro, 'Anton', '400');
  let fontInteiro = (alturaAlvo * 100) / alturaGlifo;

  const medirLargura = (fi) => {
    ctx.font = `400 ${fi * RATIO_CIFRAO}px Anton`;
    const wCifrao = ctx.measureText('R$').width;
    ctx.font = `400 ${fi}px Anton`;
    const wInteiro = ctx.measureText(inteiro).width;
    ctx.font = `400 ${fi * RATIO_CENTAVOS}px Anton`;
    const wCentavos = ctx.measureText(centavos).width;
    return wCifrao + 6 + wInteiro + 8 + wCentavos;
  };

  let larguraTotal = medirLargura(fontInteiro);
  if(maxWidth && larguraTotal > maxWidth){
    fontInteiro *= maxWidth / larguraTotal; // só encolhe se realmente não couber
    larguraTotal = medirLargura(fontInteiro);
  }

  let px = align === 'center' ? anchorX - larguraTotal / 2 : anchorX;

  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.font = `400 ${fontInteiro * RATIO_CIFRAO}px Anton`;
  ctx.fillText('R$', px, baselineY - fontInteiro * 0.06);
  px += ctx.measureText('R$').width + 6;

  ctx.font = `400 ${fontInteiro}px Anton`;
  ctx.fillText(inteiro, px, baselineY);
  px += ctx.measureText(inteiro).width + 8;

  ctx.font = `400 ${fontInteiro * RATIO_CIFRAO}px Anton`;
  ctx.fillText(',', px, baselineY - fontInteiro * 0.04);

  ctx.font = `400 ${fontInteiro * RATIO_CENTAVOS}px Anton`;
  ctx.fillText(centavos, px + 6, baselineY - fontInteiro * 0.04);

  return { w: larguraTotal, fontInteiro };
}

// ----------------------------------------------------------
// ELEMENTOS DECORATIVOS
// ----------------------------------------------------------
function drawLinhaCurva(ctx, x, y, w, hex){
  ctx.save();
  ctx.strokeStyle = hex;
  ctx.lineWidth = w * 0.012;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + w * 0.02);
  ctx.quadraticCurveTo(x + w / 2, y + w * 0.09, x + w, y + w * 0.02);
  ctx.stroke();
  ctx.restore();
}

function drawPincela(ctx, x, y, w, h, hex){
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((-2 * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.scale(w / 420, h / 230);
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.moveTo(18, 132);
  ctx.bezierCurveTo(6, 92, 34, 48, 92, 34);
  ctx.bezierCurveTo(150, 18, 246, 10, 312, 26);
  ctx.bezierCurveTo(372, 40, 404, 74, 398, 116);
  ctx.bezierCurveTo(394, 150, 408, 178, 386, 198);
  ctx.bezierCurveTo(356, 224, 292, 214, 244, 222);
  ctx.bezierCurveTo(176, 234, 88, 228, 44, 204);
  ctx.bezierCurveTo(10, 186, -2, 164, 18, 132);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDiamante(ctx, cx, cy, r, hex){
  ctx.save();
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.35, cy - r * 0.35);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx + r * 0.35, cy + r * 0.35);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.35, cy + r * 0.35);
  ctx.lineTo(cx - r, cy);
  ctx.lineTo(cx - r * 0.35, cy - r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTraco(ctx, cx, cy, w, h, anguloGraus, hex){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((anguloGraus * Math.PI) / 180);
  ctx.fillStyle = hex;
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.restore();
}

function drawSparkles(ctx, cx, cy, raio, hex){
  drawDiamante(ctx, cx - raio, cy - raio * 0.35, raio * 0.16, hex);
  drawTraco(ctx, cx - raio * 1.25, cy + raio * 0.3, raio * 0.4, raio * 0.12, 35, hex);
  drawDiamante(ctx, cx + raio, cy - raio * 0.35, raio * 0.16, hex);
  drawTraco(ctx, cx + raio * 1.25, cy + raio * 0.3, raio * 0.4, raio * 0.12, -35, hex);
}

function drawGota(ctx, x, y, size){
  ctx.save();
  ctx.translate(x, y);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.6 / s;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.bezierCurveTo(12, 2, 5, 11, 5, 15.5);
  ctx.bezierCurveTo(5, 19.09, 8.13, 22, 12, 22);
  ctx.bezierCurveTo(15.87, 22, 19, 19.09, 19, 15.5);
  ctx.bezierCurveTo(19, 11, 12, 2, 12, 2);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// ==========================================================
// MODELO: PADRÃO  (995 x 957 medido — spec-camadas.md)
// ==========================================================
async function renderPadrao(canvas, state){
  await assetsReady();
  const dims = DESIGN.padrao;
  const ctx = setupCanvas(canvas, dims.w, dims.h);
  const W = dims.w, H = dims.h;
  const cor = COLOR_MAP[state.cor] || COLOR_MAP.vermelho;
  const preco = formatPreco(state.precoInteiro, state.precoCentavos);
  const corTextoBadge = cor.light ? '#000000' : '#ffffff';

  ctx.clearRect(0, 0, W, H);

  // 1. fundo-borda — sempre ativo
  const minDim = Math.min(W, H);
  const raio = minDim * 0.024;
  const stroke = W * 0.006;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, stroke / 2, stroke / 2, W - stroke, H - stroke, raio);
  ctx.fill();
  ctx.lineWidth = stroke;
  ctx.strokeStyle = cor.hex;
  roundRectPath(ctx, stroke / 2, stroke / 2, W - stroke, H - stroke, raio);
  ctx.stroke();

  // 2. logo — sempre ativo — x 2,9% / y 3,3% · largura-alvo 34%
  const logoX = 0.029 * W, logoY = 0.033 * H, logoW = 0.34 * W;
  const logoH = logoImage ? logoW * (logoImage.height / logoImage.width) : logoW * 0.9;
  if(logoImage) ctx.drawImage(logoImage, logoX, logoY, logoW, logoH);

  // coluna do nome (direita), usada por categoria + nome + linha
  const colX = 0.388 * W, colW = 0.823 * W - colX;

  // 3. badge-categoria — ativo: state.categoria
  let nomeTopY = 0.093 * H;
  if(state.categoria){
    const badge = drawBadge(ctx, state.categoria.toUpperCase(), {
      x: colX, y: nomeTopY, alturaAlvo: 0.05 * H,
      cor: cor.hex, corTexto: corTextoBadge, align: 'left',
    });
    nomeTopY += badge.h + 0.02 * H;
  } else {
    nomeTopY += 0.01 * H;
  }

  // 4. nome-produto — sempre ativo — caixa x 38,8-82,3% / y 18,6-43,5%
  ctx.fillStyle = '#000000';
  const nome = (state.nome || 'NOME DO PRODUTO').toUpperCase();
  const nomeCaixaTop = 0.186 * H;
  const nomeCaixaBottom = 0.435 * H;
  const nomeFit = fitText(ctx, nome, {
    fontFamily: 'Anton', min: 20 * state.escalaNome, max: 72 * state.escalaNome,
    maxWidth: colW, maxHeight: nomeCaixaBottom - Math.max(nomeTopY, nomeCaixaTop) + (nomeCaixaBottom - nomeCaixaTop),
    maxLines: 2,
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const nomeY = Math.max(nomeTopY, nomeCaixaTop);
  const lineHeight = nomeFit.size * 1.05;
  nomeFit.lines.forEach((linha, i) => {
    ctx.fillText(linha, colX, nomeY + i * lineHeight + nomeFit.size * 0.82);
  });
  const nomeBottomY = nomeY + nomeFit.lines.length * lineHeight;

  // 5. linha-curva — sempre ativo — logo abaixo do nome, 60% da coluna
  drawLinhaCurva(ctx, colX, nomeBottomY + 0.015 * H, colW * 0.6, cor.hex);

  // 6. selo-oferta — ativo: state.mostrarOferta — x 4,1-26,7% / y 46-57,7%
  if(state.mostrarOferta){
    const ofertaX = 0.041 * W, ofertaY = 0.46 * H;
    const ofertaAlturaAlvo = 0.117 * H;
    drawBadge(ctx, 'OFERTA', {
      x: ofertaX, y: ofertaY, alturaAlvo: ofertaAlturaAlvo,
      cor: cor.hex, corTexto: '#ffffff', align: 'left', rotationDeg: -3,
    });
  }

  // 7. preco — sempre ativo — início x 21% / base y 87,9% · alvo 28% da altura
  drawPreco(ctx, preco, {
    anchorX: 0.21 * W,
    baselineY: 0.879 * H,
    alturaAlvo: 0.28 * H * state.escalaPreco,
    maxWidth: W - 0.21 * W - 0.05 * W,
    align: 'left',
  });

  // 8. imagem-produto — sempre ativo (placeholder OU foto) — estimado
  const imgBoxSize = 0.18 * minDim * state.escalaImagem;
  const imgBoxX = 0.75 * W - imgBoxSize / 2;
  const imgBoxY = 0.60 * H;
  if(state.imagemImg){
    drawImageCover(ctx, state.imagemImg, imgBoxX, imgBoxY, imgBoxSize, imgBoxSize, imgBoxSize * 0.07);
  } else {
    ctx.save();
    ctx.strokeStyle = '#bbbbbb';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    roundRectPath(ctx, imgBoxX, imgBoxY, imgBoxSize, imgBoxSize, imgBoxSize * 0.07);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#999999';
    ctx.font = '600 12px Montserrat';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ['IMAGEM DO', 'PRODUTO', '(OPCIONAL)'].forEach((linha, i) => {
      ctx.fillText(linha, imgBoxX + imgBoxSize / 2, imgBoxY + imgBoxSize / 2 + (i - 1) * 16);
    });
    ctx.restore();
  }

  // 9. badge-info — ativo: state.infoExtra — x 75-94,5% / y 85,6-95,2%
  if(state.infoExtra){
    const infoW = 0.195 * W, infoH = 0.096 * H;
    const infoX = 0.75 * W, infoY = 0.856 * H;
    ctx.save();
    ctx.fillStyle = cor.hex;
    roundRectPath(ctx, infoX, infoY, infoW, infoH, infoH * 0.25);
    ctx.fill();
    ctx.fillStyle = corTextoBadge;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const linhas = wrapText(ctx, state.infoExtra.toUpperCase(), infoW - infoW * 0.2);
    ctx.font = `800 ${infoH * 0.22}px Montserrat`;
    const lh = infoH * 0.3;
    const startY = infoY + infoH / 2 - ((linhas.length - 1) * lh) / 2;
    linhas.forEach((linha, i) => ctx.fillText(linha, infoX + infoW / 2, startY + i * lh));
    ctx.restore();
  }
}

// ==========================================================
// MODELO: GELADEIRA  (856 x 904 medido — spec-camadas.md)
// ==========================================================
async function renderGeladeira(canvas, state){
  await assetsReady();
  const dims = state.orientacao === 'landscape' ? DESIGN.geladeiraLandscape : DESIGN.geladeiraPortrait;
  const ctx = setupCanvas(canvas, dims.w, dims.h);
  const W = dims.w, H = dims.h;
  const cor = COLOR_MAP[state.cor] || COLOR_MAP.amarelo;
  const preco = formatPreco(state.precoInteiro, state.precoCentavos);

  ctx.clearRect(0, 0, W, H);

  // 1. fundo-borda
  const minDim = Math.min(W, H);
  const raio = minDim * 0.03;
  const stroke = W * 0.009;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, stroke / 2, stroke / 2, W - stroke, H - stroke, raio);
  ctx.fill();
  ctx.lineWidth = stroke;
  ctx.strokeStyle = cor.hex;
  roundRectPath(ctx, stroke / 2, stroke / 2, W - stroke, H - stroke, raio);
  ctx.stroke();

  // 2. logo — centralizado — x 35,7-62,7% / y 2,1-27,9%
  const logoW = 0.27 * W;
  const logoH = logoImage ? logoW * (logoImage.height / logoImage.width) : logoW * 0.82;
  const logoX = W / 2 - logoW / 2, logoY = 0.021 * H;
  if(logoImage) ctx.drawImage(logoImage, logoX, logoY, logoW, logoH);

  // 3. sparkles — ao redor do logo
  drawSparkles(ctx, W / 2, logoY + logoH / 2, logoW / 2 + 0.12 * W, cor.hex);

  // 4. nome-produto — centralizado — caixa x 22,4-77,7% / y 30,9-50,9%
  ctx.fillStyle = '#000000';
  const nome = (state.nome || 'NOME DO PRODUTO').toUpperCase();
  const nomeCaixaX = 0.224 * W, nomeCaixaW = 0.777 * W - nomeCaixaX;
  const nomeCaixaTop = 0.309 * H, nomeCaixaH = 0.5 * H - nomeCaixaTop;
  const nomeFit = fitText(ctx, nome, {
    fontFamily: 'Anton', min: 20 * state.escalaNome, max: 60 * state.escalaNome,
    maxWidth: nomeCaixaW, maxHeight: nomeCaixaH, maxLines: 2,
  });
  const lineHeight = nomeFit.size * 1.05;
  const blocoAltura = nomeFit.lines.length * lineHeight;
  const nomeY = nomeCaixaTop + (nomeCaixaH - blocoAltura) / 2;
  nomeFit.lines.forEach((linha, i) => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(linha, W / 2, nomeY + i * lineHeight + nomeFit.size * 0.82);
  });
  const nomeBottomY = nomeY + blocoAltura;

  // 5. linha-curva — abaixo do nome, 70% do card, centralizada
  drawLinhaCurva(ctx, W / 2 - 0.35 * W, nomeBottomY + 0.015 * H, 0.7 * W, cor.hex);

  // 6. pincela — atrás do preço — x 5,4-93,8% / y 60,3-97,2%
  const pincelaX = 0.054 * W, pincelaY = 0.603 * H;
  const pincelaW = 0.938 * W - pincelaX, pincelaH = 0.972 * H - pincelaY;
  drawPincela(ctx, pincelaX, pincelaY, pincelaW, pincelaH, cor.hex);

  // 7. preco — centralizado sobre a pincela — alvo 33% da altura
  drawPreco(ctx, preco, {
    anchorX: W / 2,
    baselineY: pincelaY + pincelaH * 0.72,
    alturaAlvo: 0.33 * H * state.escalaPreco,
    maxWidth: pincelaW * 0.94,
    align: 'center',
  });

  // 8. selo-resistente — canto inferior direito (estimado)
  const gotaSize = 0.02 * W;
  const gotaX = W - 0.16 * W, gotaY = H - 0.065 * H;
  drawGota(ctx, gotaX, gotaY, gotaSize * 1.4);
  ctx.fillStyle = '#444444';
  ctx.font = `700 ${0.011 * H}px Montserrat`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('RESISTENTE', gotaX + gotaSize * 1.6, gotaY - gotaSize * 0.2);
  ctx.fillText('À ÁGUA', gotaX + gotaSize * 1.6, gotaY + 0.014 * H);
}
