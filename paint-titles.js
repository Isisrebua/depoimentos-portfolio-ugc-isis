// Apaga (pinta por cima) todos os títulos achatados restantes nas
// imagens de seção, usando as caixas medidas por detect-titles.js (com
// ~8-10px de margem de segurança pras bordas anti-aliased). Roda nos
// arquivos 1x e 2x de cada imagem. Depois disso, os títulos viram
// elementos HTML reais (ver index.html/styles.css).
const { Jimp } = require('jimp');
const path = require('path');

const ROOT = path.join(__dirname, 'assets/portfolio');

// { file, boxes2x: [{x,y,w,h,color:[r,g,b]}] }
const jobs = [
  { file: '02-sobre-mim', boxes2x: [
    { x: 294, y: 276, w: 838, h: 144, color: [0xee,0xee,0xee] },
    { x: 532, y: 424, w: 840, h: 108, color: [0xee,0xee,0xee] },
  ]},
  { file: '03-como-trabalhar-nichos', boxes2x: [
    { x: 1976, y: 162, w: 552, h: 104, color: [0xee,0xee,0xee] },
    { x: 1954, y: 284, w: 614, h: 170, color: [0xee,0xee,0xee] },
  ]},
  { file: '05-cases-de-sucesso', boxes2x: [
    { x: 134, y: 132, w: 1008, h: 94, color: [0xbf,0xcf,0xcc] },
  ]},
  { file: '06-app-e-tech', boxes2x: [
    { x: 128, y: 104, w: 1008, h: 118, color: [0xee,0xee,0xee] },
  ]},
  { file: '07-fitness-bem-estar', boxes2x: [
    { x: 130, y: 102, w: 1006, h: 120, color: [0xee,0xee,0xee] },
  ]},
  { file: '08-moda', boxes2x: [
    { x: 120, y: 104, w: 1010, h: 118, color: [0xee,0xee,0xee] },
  ]},
  { file: '09-locais-servicos', boxes2x: [
    { x: 130, y: 104, w: 1006, h: 118, color: [0xee,0xee,0xee] },
  ]},
  { file: '10-beleza', boxes2x: [
    { x: 130, y: 102, w: 1006, h: 120, color: [0xee,0xee,0xee] },
  ]},
  { file: '11-pet', boxes2x: [
    { x: 130, y: 102, w: 1006, h: 120, color: [0xee,0xee,0xee] },
  ]},
  { file: '14-mao-na-massa', boxes2x: [
    { x: 894, y: 54, w: 940, h: 152, color: [0xee,0xee,0xee] },
    { x: 1226, y: 246, w: 590, h: 60, color: [0xee,0xee,0xee] },
  ]},
  { file: '15-pacotes', boxes2x: [
    { x: 1086, y: 94, w: 482, h: 132, color: [0xee,0xee,0xee] },
    { x: 1258, y: 204, w: 488, h: 90, color: [0xee,0xee,0xee] },
  ]},
  { file: '16-combo-funil', boxes2x: [
    { x: 1002, y: 36, w: 582, h: 150, color: [0xee,0xee,0xee] },
    { x: 1196, y: 128, w: 594, h: 138, color: [0xee,0xee,0xee] },
  ]},
  { file: '13-feedbacks', boxes2x: [
    { x: 1832, y: 118, w: 628, h: 392, color: [0xd9,0xd9,0xd9] },
  ]},
  { file: '17-footer-contato', boxes2x: [
    { x: 732, y: 114, w: 782, h: 180, color: [0xbf,0xcf,0xcc] },
  ]},
];

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
  for (const job of jobs) {
    const p2x = path.join(ROOT, job.file + '-2x.png');
    const p1x = path.join(ROOT, job.file + '.png');
    await paint(p2x, job.boxes2x, 1);
    await paint(p1x, job.boxes2x, 0.5);
    console.log('pintado:', job.file);
  }
})();
