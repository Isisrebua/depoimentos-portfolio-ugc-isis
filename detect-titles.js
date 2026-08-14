// Detecta automaticamente a caixa exata de cada ribbon/faixa colorida de
// título nas imagens achatadas restantes, escaneando por pixels na cor
// terracota (#a64604-ish) ou sálvia (#98ab80/#9FAF90-ish) dentro de uma
// janela de busca aproximada (medida a olho a partir do preview), pra
// depois pintar por cima com precisão de pixel.
const { Jimp } = require('jimp');
const path = require('path');

function isColor(hex, targets, tol) {
  const r = (hex >>> 24) & 255, g = (hex >>> 16) & 255, b = (hex >>> 8) & 255;
  return targets.some(([tr, tg, tb]) => Math.abs(r - tr) < tol && Math.abs(g - tg) < tol && Math.abs(b - tb) < tol);
}

const TERRACOTTA = [0xa6, 0x46, 0x04];
const SAGE = [0xbf, 0xcf, 0xcc];
const SAGE2 = [0xbf, 0xcf, 0xcc];

async function findBox(imgPath, region, colors, tol) {
  const img = await Jimp.read(imgPath);
  let minX = null, maxX = null, minY = null, maxY = null;
  for (let y = region.y0; y < region.y1; y += 2) {
    for (let x = region.x0; x < region.x1; x += 2) {
      const c = img.getPixelColor(x, y);
      if (isColor(c, colors, tol)) {
        if (minX === null || x < minX) minX = x;
        if (maxX === null || x > maxX) maxX = x;
        if (minY === null || y < minY) minY = y;
        if (maxY === null || y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY, w: img.bitmap.width, h: img.bitmap.height };
}

const jobs = [
  { file: '02-sobre-mim-2x.png', label: 'sobre-mim TITULO (sage)', region: { x0: 250, y0: 250, x1: 1200, y1: 450 }, colors: [SAGE, SAGE2], tol: 10 },
  { file: '02-sobre-mim-2x.png', label: 'sobre-mim SUBTITULO (terracotta)', region: { x0: 450, y0: 400, x1: 1450, y1: 560 }, colors: [TERRACOTTA], tol: 18 },
  { file: '03-como-trabalhar-nichos-2x.png', label: 'nichos MEUS (sage)', region: { x0: 1900, y0: 140, x1: 2600, y1: 260 }, colors: [SAGE, SAGE2], tol: 10 },
  { file: '03-como-trabalhar-nichos-2x.png', label: 'nichos NICHOS (terracotta)', region: { x0: 1900, y0: 200, x1: 2600, y1: 340 }, colors: [TERRACOTTA], tol: 18 },
  { file: '05-cases-de-sucesso-2x.png', label: 'cases TITULO (terracotta)', region: { x0: 100, y0: 60, x1: 1300, y1: 220 }, colors: [TERRACOTTA], tol: 18 },
  { file: '06-app-e-tech-2x.png', label: 'app-tech TITULO (terracotta)', region: { x0: 60, y0: 40, x1: 1300, y1: 220 }, colors: [TERRACOTTA], tol: 18 },
  { file: '07-fitness-bem-estar-2x.png', label: 'fitness TITULO (terracotta)', region: { x0: 60, y0: 40, x1: 1300, y1: 220 }, colors: [TERRACOTTA], tol: 40 },
  { file: '08-moda-2x.png', label: 'moda TITULO (terracotta)', region: { x0: 60, y0: 40, x1: 1300, y1: 220 }, colors: [TERRACOTTA], tol: 18 },
  { file: '09-locais-servicos-2x.png', label: 'locais TITULO (terracotta)', region: { x0: 60, y0: 40, x1: 1300, y1: 220 }, colors: [TERRACOTTA], tol: 18 },
  { file: '10-beleza-2x.png', label: 'beleza TITULO (terracotta)', region: { x0: 60, y0: 40, x1: 1300, y1: 220 }, colors: [TERRACOTTA], tol: 18 },
  { file: '11-pet-2x.png', label: 'pet TITULO (terracotta)', region: { x0: 60, y0: 40, x1: 1300, y1: 220 }, colors: [TERRACOTTA], tol: 18 },
  { file: '14-mao-na-massa-2x.png', label: 'mao-massa MAO NA MASSA (sage)', region: { x0: 600, y0: 20, x1: 2000, y1: 200 }, colors: [SAGE, SAGE2], tol: 10 },
  { file: '14-mao-na-massa-2x.png', label: 'mao-massa INVESTIMENTO (terracotta)', region: { x0: 800, y0: 150, x1: 2000, y1: 300 }, colors: [TERRACOTTA], tol: 18 },
  { file: '02-sobre-mim-2x.png', label: 'sobre-mim SUBTITULO (be7c50)', region: { x0: 400, y0: 400, x1: 1500, y1: 560 }, colors: [[0xbe,0x7c,0x50]], tol: 8 },
  { file: '15-pacotes-2x.png', label: 'pacotes PACOTES (sage)', region: { x0: 900, y0: 60, x1: 1700, y1: 220 }, colors: [SAGE, SAGE2], tol: 10 },
  { file: '15-pacotes-2x.png', label: 'pacotes COM USO EM ADS (terracotta)', region: { x0: 1100, y0: 150, x1: 1850, y1: 300 }, colors: [TERRACOTTA], tol: 18 },
  { file: '16-combo-funil-2x.png', label: 'combo COMBO (sage)', region: { x0: 900, y0: 20, x1: 1700, y1: 180 }, colors: [SAGE, SAGE2], tol: 10 },
  { file: '16-combo-funil-2x.png', label: 'combo FUNIL DE VENDAS (terracotta)', region: { x0: 1000, y0: 100, x1: 1900, y1: 260 }, colors: [TERRACOTTA], tol: 18 },
];

(async () => {
  for (const job of jobs) {
    const p = path.join(__dirname, 'assets/portfolio', job.file);
    const box = await findBox(p, job.region, job.colors, job.tol);
    console.log(job.label, JSON.stringify(box));
  }
})();
