// ==========================================================
// MOTOR DE RENDERIZAÇÃO — CANVAS NATIVO
// ==========================================================
// Por que canvas em vez de HTML/CSS + html-to-image:
// a tela que o usuário vê e o PNG exportado eram, antes, dois processos
// diferentes rodando em momentos diferentes (DOM ao vivo vs. "foto" tirada
// depois). Cada bug que a gente caçou (logo com fundo preto, "00" virando
// "DO", grid bagunçando no export) veio dessa dessincronia. Aqui não existe
// mais isso: tudo é desenhado direto no <canvas>, e exportar é só ler os
// pixels que já estão lá — o mesmo objeto, sem tradução no meio.

const CANVAS_SCALE = 2; // resolução interna (nitidez tipo "retina" já embutida)

const COLOR_MAP = {
  vermelho: { hex: '#E31E24', light: false },
  amarelo:  { hex: '#FFC400', light: true  },
  verde:    { hex: '#2E7D32', light: false },
  azul:     { hex: '#1565C0', light: false },
  laranja:  { hex: '#F57C00', light: false },
  roxo:     { hex: '#7B1FA2', light: false },
};

const DESIGN = {
  geladeiraPortrait:  { w: 378, h: 567 },
  geladeiraLandscape: { w: 567, h: 378 },
  padrao:             { w: 794, h: 560 },
};

// ----------------------------------------------------------
// CARREGAMENTO DE ASSETS (uma vez só, no início)
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
// UTILITÁRIOS DE DESENHO
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

// Encontra por busca binária o maior tamanho de fonte que ainda faz o
// texto caber em até `maxLines` linhas dentro de maxWidth x maxHeight —
// mesma ideia de libs como textFit/fitty, só que medindo direto no canvas
// (ctx.measureText), sem depender de nenhum layout de DOM.
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
  ctx.font = `${melhor.weight || weight} ${melhor.size}px ${fontFamily}`;
  return melhor;
}

function drawMultilineText(ctx, lines, x, y, size, lineHeightRatio, align){
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  const lineHeight = size * lineHeightRatio;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineHeight + size * 0.82);
  });
}

function drawImageCover(ctx, img, x, y, w, h, radius = 0){
  const proporcaoImagem = img.width / img.height;
  const proporcaoBox = w / h;
  let sx, sy, sw, sh;
  if(proporcaoImagem > proporcaoBox){
    sh = img.height;
    sw = sh * proporcaoBox;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / proporcaoBox;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.save();
  if(radius){
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function formatPreco(inteiro, centavos){
  const i = (inteiro === '' || inteiro == null || isNaN(inteiro)) ? 0 : parseInt(inteiro, 10);
  let c = (centavos === '' || centavos == null || isNaN(centavos)) ? 0 : parseInt(centavos, 10);
  c = Math.max(0, Math.min(99, c));
  return { inteiro: i, centavos: String(c).padStart(2, '0') };
}

// ----------------------------------------------------------
// ELEMENTOS DECORATIVOS
// ----------------------------------------------------------
function drawLinhaCurva(ctx, x, y, w, hex, variante){
  ctx.save();
  ctx.strokeStyle = hex;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if(variante === 'padrao'){
    ctx.moveTo(x, y + 6);
    ctx.quadraticCurveTo(x + w * 0.5, y + 20, x + w, y + 10);
  } else {
    ctx.moveTo(x, y + 4);
    ctx.quadraticCurveTo(x + w / 2, y + 18, x + w, y + 4);
  }
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
  drawDiamante(ctx, cx - raio, cy - 14, 8, hex);
  drawTraco(ctx, cx - raio - 14, cy + 12, 20, 6, 35, hex);
  drawDiamante(ctx, cx + raio, cy - 14, 8, hex);
  drawTraco(ctx, cx + raio + 14, cy + 12, 20, 6, -35, hex);
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
// TEMPLATE: GELADEIRA
// ==========================================================
async function renderGeladeira(canvas, state){
  await assetsReady();
  const dims = state.orientacao === 'landscape' ? DESIGN.geladeiraLandscape : DESIGN.geladeiraPortrait;
  const ctx = setupCanvas(canvas, dims.w, dims.h);
  const cor = COLOR_MAP[state.cor] || COLOR_MAP.amarelo;
  const preco = formatPreco(state.precoInteiro, state.precoCentavos);

  ctx.clearRect(0, 0, dims.w, dims.h);

  // fundo + borda arredondada
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, 4, 4, dims.w - 8, dims.h - 8, 28);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = cor.hex;
  roundRectPath(ctx, 4, 4, dims.w - 8, dims.h - 8, 28);
  ctx.stroke();

  const cx = dims.w / 2;
  const padX = 32;
  let cursorY = 26;

  // logo + sparkles
  const logoW = 100;
  const logoH = logoImage ? logoW * (logoImage.height / logoImage.width) : 82;
  if(logoImage) ctx.drawImage(logoImage, cx - logoW / 2, cursorY, logoW, logoH);
  drawSparkles(ctx, cx, cursorY + logoH / 2, logoW / 2 + 22, cor.hex);
  cursorY += logoH + 14;

  // nome do produto (auto-ajustável)
  ctx.fillStyle = '#000000';
  const nome = (state.nome || 'NOME DO PRODUTO').toUpperCase();
  const nomeFit = fitText(ctx, nome, {
    fontFamily: 'Anton', min: 20, max: 34,
    maxWidth: dims.w - padX * 2, maxHeight: 78, maxLines: 2,
  });
  drawMultilineText(ctx, nomeFit.lines, cx, cursorY, nomeFit.size, 1.05, 'center');
  cursorY += nomeFit.lines.length * nomeFit.size * 1.05 + 12;

  // linha curva
  const linhaW = (dims.w - padX * 2) * 0.7;
  drawLinhaCurva(ctx, cx - linhaW / 2, cursorY, linhaW, cor.hex, 'geladeira');
  cursorY += 26;

  // preço (com pincelada atrás)
  const areaPrecoTop = cursorY;
  const areaPrecoBottom = dims.h - 60;
  const areaPrecoH = areaPrecoBottom - areaPrecoTop;
  drawPincela(ctx, padX - 10, areaPrecoTop, dims.w - (padX - 10) * 2, areaPrecoH * 0.68, cor.hex);

  ctx.fillStyle = '#000000';
  ctx.font = '400 22px Anton';
  const cifraoW = ctx.measureText('R$').width;
  ctx.font = '400 74px Anton';
  const inteiroTxt = String(preco.inteiro);
  const inteiroW = ctx.measureText(inteiroTxt).width;
  ctx.font = '400 36px Anton';
  const centavosW = ctx.measureText('00').width;

  const precoTotalW = cifraoW + 6 + inteiroW + 8 + centavosW;
  let px = cx - precoTotalW / 2;
  const precoBaseY = areaPrecoTop + areaPrecoH / 2 + 26;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '400 22px Anton';
  ctx.fillText('R$', px, precoBaseY - 4);
  px += cifraoW + 6;
  ctx.font = '400 74px Anton';
  ctx.fillText(inteiroTxt, px, precoBaseY + 18);
  px += inteiroW + 8;
  ctx.font = '400 30px Anton';
  ctx.fillText(',', px, precoBaseY - 18);
  ctx.font = '400 36px Anton';
  ctx.fillText(preco.centavos, px + 6, precoBaseY + 8);

  // selo "resistente à água"
  const gotaX = dims.w - 92, gotaY = dims.h - 40;
  drawGota(ctx, gotaX, gotaY - 6, 16);
  ctx.fillStyle = '#444444';
  ctx.font = '700 10px Montserrat';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('RESISTENTE', gotaX + 22, gotaY - 2);
  ctx.fillText('À ÁGUA', gotaX + 22, gotaY + 10);
}

// ==========================================================
// TEMPLATE: PADRÃO
// ==========================================================
async function renderPadrao(canvas, state){
  await assetsReady();
  const dims = DESIGN.padrao;
  const ctx = setupCanvas(canvas, dims.w, dims.h);
  const cor = COLOR_MAP[state.cor] || COLOR_MAP.vermelho;
  const preco = formatPreco(state.precoInteiro, state.precoCentavos);

  ctx.clearRect(0, 0, dims.w, dims.h);

  // fundo + borda
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, 3, 3, dims.w - 6, dims.h - 6, 24);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = cor.hex;
  roundRectPath(ctx, 3, 3, dims.w - 6, dims.h - 6, 24);
  ctx.stroke();

  const padX = 36, padY = 30;
  const colEsqX = padX;
  const colDirX = dims.w / 2 + 10;
  const colDirW = dims.w - padX - colDirX;

  // logo (coluna esquerda, topo)
  const logoW = 120;
  const logoH = logoImage ? logoW * (logoImage.height / logoImage.width) : 98;
  if(logoImage) ctx.drawImage(logoImage, colEsqX, padY, logoW, logoH);

  // categoria (coluna direita, topo) — badge arredondado
  let nomeTopY = padY + 4;
  if(state.categoria){
    ctx.font = '800 14px Montserrat';
    const texto = state.categoria.toUpperCase();
    const textW = ctx.measureText(texto).width;
    const badgeW = textW + 32, badgeH = 30;
    ctx.fillStyle = cor.hex;
    roundRectPath(ctx, colDirX, nomeTopY, badgeW, badgeH, badgeH / 2);
    ctx.fill();
    ctx.fillStyle = cor.light ? '#000000' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, colDirX + 16, nomeTopY + badgeH / 2 + 1);
    nomeTopY += badgeH + 12;
  } else {
    nomeTopY += 6;
  }

  // nome do produto (auto-ajustável, coluna direita)
  ctx.fillStyle = '#000000';
  const nome = (state.nome || 'NOME DO PRODUTO').toUpperCase();
  const nomeFit = fitText(ctx, nome, {
    fontFamily: 'Anton', min: 24, max: 56,
    maxWidth: colDirW, maxHeight: 110, maxLines: 2,
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const lineHeight = nomeFit.size * 1.05;
  nomeFit.lines.forEach((line, i) => {
    ctx.fillText(line, colDirX, nomeTopY + i * lineHeight + nomeFit.size * 0.85);
  });
  const nomeBottomY = nomeTopY + nomeFit.lines.length * lineHeight;

  // linha curva abaixo do nome
  const linhaW = colDirW * 0.6;
  drawLinhaCurva(ctx, colDirX, nomeBottomY + 4, linhaW, cor.hex, 'padrao');

  // --- linha de baixo: oferta / preço (esquerda) + imagem / info (direita) ---
  const linhaBaixoY = Math.max(padY + logoH + 24, nomeBottomY + 40);

  // selo oferta
  let precoTopY = linhaBaixoY;
  if(state.mostrarOferta){
    ctx.save();
    ctx.translate(colEsqX + 50, linhaBaixoY + 16);
    ctx.rotate((-3 * Math.PI) / 180);
    ctx.font = '800 15px Montserrat';
    const texto = 'OFERTA';
    const textW = ctx.measureText(texto).width;
    const badgeW = textW + 36, badgeH = 34;
    ctx.fillStyle = cor.hex;
    roundRectPath(ctx, -badgeW / 2, -badgeH / 2, badgeW, badgeH, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, 0, 1);
    ctx.restore();
    precoTopY = linhaBaixoY + 44;
  }

  // preço (alinhado embaixo da coluna esquerda)
  const precoBaseY = dims.h - padY - 6;
  ctx.fillStyle = '#000000';
  ctx.font = '400 26px Anton';
  const cifraoW = ctx.measureText('R$').width;
  ctx.font = '400 92px Anton';
  const inteiroTxt = String(preco.inteiro);
  const inteiroW = ctx.measureText(inteiroTxt).width;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let px = colEsqX;
  ctx.font = '400 26px Anton';
  ctx.fillText('R$', px, precoBaseY - 6);
  px += cifraoW + 6;
  ctx.font = '400 92px Anton';
  ctx.fillText(inteiroTxt, px, precoBaseY);
  px += inteiroW + 10;
  ctx.font = '400 40px Anton';
  ctx.fillText(',', px, precoBaseY - 28);
  ctx.font = '400 44px Anton';
  ctx.fillText(preco.centavos, px + 8, precoBaseY - 2);

  // imagem do produto (coluna direita)
  const imgBoxW = 170, imgBoxH = 170;
  const imgBoxX = colDirX + (colDirW - imgBoxW) / 2;
  const imgBoxY = linhaBaixoY + 10;
  if(state.imagemImg){
    drawImageCover(ctx, state.imagemImg, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 12);
  } else {
    ctx.strokeStyle = '#bbbbbb';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    roundRectPath(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 12);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#999999';
    ctx.font = '600 12px Montserrat';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ['IMAGEM DO', 'PRODUTO', '(OPCIONAL)'].forEach((linha, i) => {
      ctx.fillText(linha, imgBoxX + imgBoxW / 2, imgBoxY + imgBoxH / 2 + (i - 1) * 16);
    });
  }

  // informação extra (peso/litragem) — abaixo da imagem
  if(state.infoExtra){
    ctx.font = '800 13px Montserrat';
    const texto = state.infoExtra.toUpperCase();
    const maxW = 190;
    const linhas = wrapText(ctx, texto, maxW - 24);
    const infoH = 20 + linhas.length * 16;
    const infoY = precoBaseY - infoH;
    ctx.fillStyle = cor.hex;
    roundRectPath(ctx, imgBoxX + (imgBoxW - maxW) / 2, infoY, maxW, infoH, 8);
    ctx.fill();
    ctx.fillStyle = cor.light ? '#000000' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    linhas.forEach((linha, i) => {
      ctx.fillText(linha, imgBoxX + imgBoxW / 2, infoY + 20 + i * 16);
    });
  }
}

