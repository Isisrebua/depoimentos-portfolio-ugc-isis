// Apaga os prints estáticos de WhatsApp (áudios, balões de conversa,
// parágrafo de depoimento) da 13-feedbacks.png, preservando o título
// "últimos feedbacks das marcas parceiras" (fitas sálvia/terracota +
// texto solto) exatamente como está no Figma original — pixel a pixel,
// via crop-and-paste (nunca redesenhado). Decisão: o widget dinâmico de
// depoimentos (index.html, populado via /api/depoimentos) substitui os
// prints antigos; o título da seção continua sendo a arte do Figma.
const { Jimp } = require('jimp');
const path = require('path');

const ROOT = path.join(__dirname, 'assets/portfolio');
const BG = { r: 0xd9, g: 0xd9, b: 0xd9 }; // cinza de fundo já usado em toda a seção

// Caixa do título com margem generosa (medida fresca por color-scan +
// folga visual pra "últimos"/"parceiras", que são texto solto sem fita).
const TITLE_BOX_1X = { x: 890, y: 15, w: 400, h: 283 }; // termina antes de y=302 (topo do balão branco de baixo)

async function cleanFile(fileName, scale) {
  const p = path.join(ROOT, fileName);
  const img = await Jimp.read(p);
  const box = {
    x: Math.round(TITLE_BOX_1X.x * scale),
    y: Math.round(TITLE_BOX_1X.y * scale),
    w: Math.round(TITLE_BOX_1X.w * scale),
    h: Math.round(TITLE_BOX_1X.h * scale),
  };
  const titleCrop = img.clone().crop({ x: box.x, y: box.y, w: box.w, h: box.h });
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    this.bitmap.data[idx] = BG.r;
    this.bitmap.data[idx + 1] = BG.g;
    this.bitmap.data[idx + 2] = BG.b;
    this.bitmap.data[idx + 3] = 0xff;
  });
  img.composite(titleCrop, box.x, box.y);
  await img.write(p);
  console.log('limpo:', fileName);
}

(async () => {
  await cleanFile('13-feedbacks.png', 1);
  await cleanFile('13-feedbacks-2x.png', 2);
})();
