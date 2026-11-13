/* ==========================================================
   EXPORTAÇÃO PARA IMPRESSÃO — PDF A4
   - Arte rasterizada a 300 DPI pelo motor Canvas existente.
   - Sangria de 2 mm por lado, preenchida por extensão das bordas.
   - Marcas de corte vetoriais, fora da área de sangria.
   - PDF A4 em tamanho físico real, sem dependências externas.
========================================================== */
(function(){
  'use strict';

  const PAGE = { widthMm: 210, heightMm: 297 };
  const BLEED_MM = 2;
  const DPI = 300;
  const MARK_GAP_MM = 0.5;
  const MARK_LENGTH_MM = 3;
  const MARK_WIDTH_PT = 0.35;

  function mmToPt(value){
    return value * 72 / 25.4;
  }

  function textBytes(value){
    return new TextEncoder().encode(value);
  }

  function concatBytes(parts){
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for(const part of parts){
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  function canvasToJpegBytes(canvas){
    return new Promise((resolve, reject) => {
      canvas.toBlob(async blob => {
        if(!blob){
          reject(new Error('Não foi possível preparar a imagem para o PDF.'));
          return;
        }
        try{
          resolve(new Uint8Array(await blob.arrayBuffer()));
        }catch(err){
          reject(new Error('Não foi possível ler a imagem gerada para impressão.'));
        }
      }, 'image/jpeg', 0.98);
    });
  }

  function criarCanvasComSangria(arteCanvas){
    const bleedPx = Math.max(1, Math.round(BLEED_MM / 25.4 * DPI));
    const width = arteCanvas.width;
    const height = arteCanvas.height;
    const result = document.createElement('canvas');
    result.width = width + bleedPx * 2;
    result.height = height + bleedPx * 2;

    const ctx = result.getContext('2d');
    if(!ctx) throw new Error('Não foi possível preparar a sangria da etiqueta.');

    // O fundo branco evita que áreas transparentes dos cantos virem pretas no JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, result.width, result.height);

    // A sangria prolonga os pixels das bordas; não cria uma moldura branca.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(arteCanvas, 0, 0, 1, height, 0, bleedPx, bleedPx, height);
    ctx.drawImage(arteCanvas, width - 1, 0, 1, height, bleedPx + width, bleedPx, bleedPx, height);
    ctx.drawImage(arteCanvas, 0, 0, width, 1, bleedPx, 0, width, bleedPx);
    ctx.drawImage(arteCanvas, 0, height - 1, width, 1, bleedPx, bleedPx + height, width, bleedPx);

    ctx.drawImage(arteCanvas, 0, 0, 1, 1, 0, 0, bleedPx, bleedPx);
    ctx.drawImage(arteCanvas, width - 1, 0, 1, 1, bleedPx + width, 0, bleedPx, bleedPx);
    ctx.drawImage(arteCanvas, 0, height - 1, 1, 1, 0, bleedPx + height, bleedPx, bleedPx);
    ctx.drawImage(arteCanvas, width - 1, height - 1, 1, 1, bleedPx + width, bleedPx + height, bleedPx, bleedPx);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(arteCanvas, bleedPx, bleedPx);
    return result;
  }

  function criarConteudoPDF(imageWidth, imageHeight, larguraMm, alturaMm){
    const pageWidth = mmToPt(PAGE.widthMm);
    const pageHeight = mmToPt(PAGE.heightMm);
    const bleed = mmToPt(BLEED_MM);
    const totalWidth = mmToPt(larguraMm + BLEED_MM * 2);
    const totalHeight = mmToPt(alturaMm + BLEED_MM * 2);
    const imageX = (pageWidth - totalWidth) / 2;
    const imageY = (pageHeight - totalHeight) / 2;
    const cutLeft = imageX + bleed;
    const cutRight = cutLeft + mmToPt(larguraMm);
    const cutBottom = imageY + bleed;
    const cutTop = cutBottom + mmToPt(alturaMm);

    const gap = mmToPt(MARK_GAP_MM);
    const length = mmToPt(MARK_LENGTH_MM);
    const segments = [
      // Marcas horizontais à esquerda e à direita, alinhadas aos cortes.
      [imageX - gap - length, cutBottom, imageX - gap, cutBottom],
      [imageX - gap - length, cutTop, imageX - gap, cutTop],
      [imageX + totalWidth + gap, cutBottom, imageX + totalWidth + gap + length, cutBottom],
      [imageX + totalWidth + gap, cutTop, imageX + totalWidth + gap + length, cutTop],
      // Marcas verticais abaixo e acima da sangria.
      [cutLeft, imageY - gap - length, cutLeft, imageY - gap],
      [cutRight, imageY - gap - length, cutRight, imageY - gap],
      [cutLeft, imageY + totalHeight + gap, cutLeft, imageY + totalHeight + gap + length],
      [cutRight, imageY + totalHeight + gap, cutRight, imageY + totalHeight + gap + length],
    ];

    const commands = [
      'q',
      `${totalWidth.toFixed(4)} 0 0 ${totalHeight.toFixed(4)} ${imageX.toFixed(4)} ${imageY.toFixed(4)} cm`,
      '/Im0 Do',
      'Q',
      '0 G',
      `${MARK_WIDTH_PT} w`,
      ...segments.map(([x1, y1, x2, y2]) =>
        `${x1.toFixed(4)} ${y1.toFixed(4)} m ${x2.toFixed(4)} ${y2.toFixed(4)} l S`
      ),
    ].join('\n') + '\n';

    return {
      pageWidth,
      pageHeight,
      imageWidth,
      imageHeight,
      content: textBytes(commands),
    };
  }

  function montarPDF(jpegBytes, dados){
    const { pageWidth, pageHeight, imageWidth, imageHeight, content } = dados;
    const objects = [];

    objects[1] = textBytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    objects[2] = textBytes('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    objects[3] = textBytes(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(4)} ${pageHeight.toFixed(4)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
    );
    objects[4] = concatBytes([
      textBytes(
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Interpolate false /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
      ),
      jpegBytes,
      textBytes('\nendstream\nendobj\n'),
    ]);
    objects[5] = concatBytes([
      textBytes(`5 0 obj\n<< /Length ${content.length} >>\nstream\n`),
      content,
      textBytes('endstream\nendobj\n'),
    ]);

    const chunks = [textBytes('%PDF-1.4\n%Gerador-de-Artes\n')];
    const offsets = [0];
    let position = chunks[0].length;

    for(let i = 1; i <= 5; i++){
      offsets[i] = position;
      chunks.push(objects[i]);
      position += objects[i].length;
    }

    const xrefOffset = position;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for(let i = 1; i <= 5; i++){
      xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    xref +=
      `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    chunks.push(textBytes(xref));

    return new Blob(chunks, { type: 'application/pdf' });
  }

  async function gerarPDF(arteCanvas, { larguraMm, alturaMm }){
    if(!(arteCanvas instanceof HTMLCanvasElement) || !arteCanvas.width || !arteCanvas.height){
      throw new Error('A arte ainda não está pronta para impressão.');
    }
    if(!Number.isFinite(larguraMm) || !Number.isFinite(alturaMm) || larguraMm <= 0 || alturaMm <= 0){
      throw new Error('As dimensões da etiqueta são inválidas.');
    }

    const margemTecnica = BLEED_MM * 2 + (MARK_GAP_MM + MARK_LENGTH_MM) * 2;
    if(larguraMm + margemTecnica > PAGE.widthMm || alturaMm + margemTecnica > PAGE.heightMm){
      throw new Error('A etiqueta não cabe na folha A4 com sangria e marcas de corte.');
    }

    const canvasComSangria = criarCanvasComSangria(arteCanvas);
    const jpegBytes = await canvasToJpegBytes(canvasComSangria);
    const dados = criarConteudoPDF(
      canvasComSangria.width,
      canvasComSangria.height,
      larguraMm,
      alturaMm
    );
    return montarPDF(jpegBytes, dados);
  }


  function criarConteudoPosicionado(posicao, larguraMm, alturaMm){
    const pageWidth = mmToPt(PAGE.widthMm);
    const pageHeight = mmToPt(PAGE.heightMm);
    const bleed = mmToPt(BLEED_MM);
    const imageWidth = mmToPt(larguraMm + BLEED_MM * 2);
    const imageHeight = mmToPt(alturaMm + BLEED_MM * 2);
    const imageX = mmToPt(posicao.xMm);
    const imageY = mmToPt(posicao.yMm);
    const cutLeft = imageX + bleed;
    const cutRight = cutLeft + mmToPt(larguraMm);
    const cutBottom = imageY + bleed;
    const cutTop = cutBottom + mmToPt(alturaMm);
    const gap = mmToPt(MARK_GAP_MM);
    const length = mmToPt(MARK_LENGTH_MM);
    const segments = [
      [imageX-gap-length,cutBottom,imageX-gap,cutBottom],
      [imageX-gap-length,cutTop,imageX-gap,cutTop],
      [imageX+imageWidth+gap,cutBottom,imageX+imageWidth+gap+length,cutBottom],
      [imageX+imageWidth+gap,cutTop,imageX+imageWidth+gap+length,cutTop],
      [cutLeft,imageY-gap-length,cutLeft,imageY-gap],
      [cutRight,imageY-gap-length,cutRight,imageY-gap],
      [cutLeft,imageY+imageHeight+gap,cutLeft,imageY+imageHeight+gap+length],
      [cutRight,imageY+imageHeight+gap,cutRight,imageY+imageHeight+gap+length],
    ];
    return [
      'q',
      `${imageWidth.toFixed(4)} 0 0 ${imageHeight.toFixed(4)} ${imageX.toFixed(4)} ${imageY.toFixed(4)} cm`,
      `/${posicao.imageName} Do`,
      'Q','0 G',`${MARK_WIDTH_PT} w`,
      ...segments.map(([x1,y1,x2,y2])=>`${x1.toFixed(4)} ${y1.toFixed(4)} m ${x2.toFixed(4)} ${y2.toFixed(4)} l S`)
    ].join('\\n')+'\\n';
  }

  async function gerarPDFMultiplo(itens){
    if(!Array.isArray(itens) || !itens.length) throw new Error('Adicione pelo menos uma arte à folha.');
    const preparados = [];
    for(const item of itens){
      if(!(item.canvas instanceof HTMLCanvasElement) || !item.canvas.width || !item.canvas.height ||
         !Number.isFinite(item.larguraMm) || !Number.isFinite(item.alturaMm) ||
         item.larguraMm <= 0 || item.alturaMm <= 0 ||
         !Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 500){
        throw new Error('Uma das artes da fila possui dados inválidos.');
      }
      const bleedCanvas = criarCanvasComSangria(item.canvas);
      const jpegBytes = await canvasToJpegBytes(bleedCanvas);
      preparados.push({...item, jpegBytes, imageWidth:bleedCanvas.width, imageHeight:bleedCanvas.height});
    }

    const reach = MARK_GAP_MM + MARK_LENGTH_MM;
    const clearance = BLEED_MM + reach;
    const margin = 5;
    const usableW = PAGE.widthMm - margin*2;
    const usableH = PAGE.heightMm - margin*2;
    const pages = [];
    let page = [], x = margin, y = margin, rowH = 0;
    const copies = [];
    preparados.forEach((item,index)=>{
      const fw = item.larguraMm + clearance*2;
      const fh = item.alturaMm + clearance*2;
      if(fw > usableW || fh > usableH) throw new Error(`A etiqueta "${item.nome || 'sem nome'}" é grande demais para caber na folha A4 com sangria e marcas de corte.`);
      for(let n=0;n<item.quantidade;n++) copies.push({index,fw,fh});
    });

    for(const copy of copies){
      if(x + copy.fw > PAGE.widthMm - margin + 0.0001){
        x = margin;
        y += rowH;
        rowH = 0;
      }
      if(y + copy.fh > PAGE.heightMm - margin + 0.0001){
        if(page.length) pages.push(page);
        page = [];
        x = margin;
        y = margin;
        rowH = 0;
      }
      const item = preparados[copy.index];
      page.push({
        itemIndex:copy.index,
        xMm:x + reach,
        yMm:PAGE.heightMm - (y + reach + item.alturaMm + BLEED_MM*2)
      });
      x += copy.fw;
      rowH = Math.max(rowH,copy.fh);
    }
    if(page.length) pages.push(page);

    const objects = [];
    const pageRefs = [];
    const imageRefs = [];
    let nextId = 3;
    preparados.forEach((item,index)=>{
      const id = nextId++;
      imageRefs[index] = id;
      objects[id] = concatBytes([
        textBytes(`${id} 0 obj\\n<< /Type /XObject /Subtype /Image /Width ${item.imageWidth} /Height ${item.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Interpolate false /Filter /DCTDecode /Length ${item.jpegBytes.length} >>\\nstream\\n`),
        item.jpegBytes,
        textBytes('\\nendstream\\nendobj\\n')
      ]);
    });

    const pageIds = [];
    for(let p=0;p<pages.length;p++){
      const pageId=nextId++, contentId=nextId++;
      pageIds.push(pageId);
      const names=[...new Set(pages[p].map(pos=>pos.itemIndex))];
      const resources=names.map((idx,i)=>`/Im${idx} ${imageRefs[idx]} 0 R`).join(' ');
      const commands=pages[p].map(pos=>{
        const item=preparados[pos.itemIndex];
        return criarConteudoPosicionado({...pos,imageName:`Im${pos.itemIndex}`},item.larguraMm,item.alturaMm);
      }).join('');
      const contentBytes=textBytes(commands);
      objects[pageId]=textBytes(`${pageId} 0 obj\\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${mmToPt(PAGE.widthMm).toFixed(4)} ${mmToPt(PAGE.heightMm).toFixed(4)}] /Resources << /XObject << ${resources} >> >> /Contents ${contentId} 0 R >>\\nendobj\\n`);
      objects[contentId]=concatBytes([
        textBytes(`${contentId} 0 obj\\n<< /Length ${contentBytes.length} >>\\nstream\\n`),
        contentBytes,
        textBytes('endstream\\nendobj\\n')
      ]);
    }

    objects[1]=textBytes('1 0 obj\\n<< /Type /Catalog /Pages 2 0 R >>\\nendobj\\n');
    objects[2]=textBytes(`2 0 obj\\n<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\\nendobj\\n`);
    const chunks=[textBytes('%PDF-1.4\\n%Gerador-de-Artes\\n')];
    const offsets=[0];
    let position=chunks[0].length;
    for(let id=1;id<nextId;id++){
      offsets[id]=position;
      chunks.push(objects[id]);
      position+=objects[id].length;
    }
    const xrefOffset=position;
    let xref=`xref\\n0 ${nextId}\\n0000000000 65535 f \\n`;
    for(let id=1;id<nextId;id++) xref+=String(offsets[id]).padStart(10,'0')+' 00000 n \\n';
    xref+=`trailer\\n<< /Size ${nextId} /Root 1 0 R >>\\nstartxref\\n${xrefOffset}\\n%%EOF\\n`;
    chunks.push(textBytes(xref));
    return new Blob(chunks,{type:'application/pdf'});
  }

  window.PDFPrint = Object.freeze({
    gerarPDF,\n    gerarPDFMultiplo,
    dpi: DPI,
    sangriaMm: BLEED_MM,
  });
})();
