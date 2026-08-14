// Devolve os 14 títulos/fitas de seção pra arte 100% original do Figma
// (texto desenhado dentro do PNG, sem overlay de HTML/CSS por cima).
// Decisão final do cliente: os títulos de seção ficam fixos em
// português, como o Figma exportou — só o resto do site (parágrafos,
// FAQ, formulário, botões) continua traduzindo via HTML.
//
// Mesma fonte pristina (Downloads/Portfoliougc.zip) e mesmo pipeline de
// rebuild-from-original.js, mas SEM pintar por cima das áreas de
// título/fita — só mantém apagado o que é estritamente necessário pra
// um elemento HTML REAL (funcional, não decorativo) continuar legível:
// o texto antigo "Solicite orçalamento" embaixo do botão de vidro
// .price-cta (translúcido — o texto velho apareceria por baixo).
const { Jimp } = require('jimp');
const sharp = require('sharp');
const path = require('path');

const SVG_SRC = 'C:/Users/isisr/AppData/Local/Temp/claude/C--Users-isisr--claude/35133b0c-5125-43ea-bcc2-5ffb58530a35/scratchpad/figma/original-export';
const OUT = path.join(__dirname, 'assets/portfolio');
const TMP = 'C:/Users/isisr/AppData/Local/Temp/claude/C--Users-isisr--claude/35133b0c-5125-43ea-bcc2-5ffb58530a35/scratchpad/figma/restore-tmp';

const files = [
  { out: '02-sobre-mim',              svg: 'Sobre mim.svg',           w: 1366, h: 669, topCrop: 0 },
  { out: '03-como-trabalhar-nichos',  svg: '3.svg',                   w: 1366, h: 565, topCrop: 4 },
  { out: '05-cases-de-sucesso',       svg: 'portfolio.svg',           w: 1366, h: 646, topCrop: 4 },
  { out: '06-app-e-tech',             svg: 'App e Tech.svg',          w: 1366, h: 988, topCrop: 0 },
  { out: '07-fitness-bem-estar',      svg: 'Saude e bem-estar.svg',   w: 1366, h: 598, topCrop: 0 },
  { out: '08-moda',                   svg: 'Moda.svg',                w: 1366, h: 945, topCrop: 0 },
  { out: '09-locais-servicos',        svg: 'Locais e serviços.svg',   w: 1366, h: 598, topCrop: 0 },
  { out: '10-beleza',                 svg: 'beleza.svg',              w: 1366, h: 507, topCrop: 0 },
  { out: '11-pet',                    svg: 'PET.svg',                 w: 1366, h: 507, topCrop: 0 },
  { out: '13-feedbacks',              svg: '13.svg',                  w: 1366, h: 448, topCrop: 0 },
  { out: '14-mao-na-massa',           svg: '14.svg',                  w: 1366, h: 891, topCrop: 0 },
  { out: '15-pacotes',                svg: 'Investimento.svg',        w: 1366, h: 672, topCrop: 0 },
  { out: '16-combo-funil',            svg: '16.svg',                  w: 1366, h: 672, topCrop: 0 },
  { out: '17-footer-contato',         svg: '17.svg',                  w: 1366, h: 258, topCrop: 0 },
];

// Único job que sobra: apagar "Solicite orçalamento" (texto antigo,
// pequeno, com erro de digitação no original) pra não aparecer por
// baixo do vidro translúcido do botão .price-cta real.
const paintJobs = {
  '14-mao-na-massa': [
    { x: 1916, y: 1446, w: 282, h: 146, color: [0xee,0xee,0xee] },
  ],
};

async function renderSvg(svgFile, w, h, topCropPx, outPng) {
  const renderH = h + topCropPx;
  const buf = await sharp(path.join(SVG_SRC, svgFile), { density: 96 }).resize(w, renderH).png().toBuffer();
  const img = await Jimp.read(buf);
  const cropped = topCropPx > 0 ? img.clone().crop({ x: 0, y: topCropPx, w, h }) : img;
  await cropped.write(outPng);
}

async function paint(imgPath, boxes, scale) {
  const img = await Jimp.read(imgPath);
  for (const b of boxes) {
    const x = Math.round(b.x * scale), y = Math.round(b.y * scale);
    const w = Math.round(b.w * scale), h = Math.round(b.h * scale);
    img.scan(x, y, w, h, function (px, py, idx) {
      this.bitmap.data[idx] = b.color[0];
      this.bitmap.data[idx + 1] = b.color[1];
      this.bitmap.data[idx + 2] = b.color[2];
      this.bitmap.data[idx + 3] = 0xff;
    });
  }
  await img.write(imgPath);
}

(async () => {
  const fs = require('fs');
  fs.mkdirSync(TMP, { recursive: true });
  for (const f of files) {
    const p1x = path.join(TMP, f.out + '.png');
    const p2x = path.join(TMP, f.out + '-2x.png');
    await renderSvg(f.svg, f.w, f.h, f.topCrop, p1x);
    await renderSvg(f.svg, f.w * 2, f.h * 2, f.topCrop * 2, p2x);
    const boxes = paintJobs[f.out];
    if (boxes) {
      await paint(p2x, boxes, 1);
      await paint(p1x, boxes, 0.5);
    }
    console.log('restaurado:', f.out);
  }
})();
