// Script de preparo de assets — já rodou uma vez (gerou os 24 arquivos em
// assets/gallery/). A antiga 12-galeria-fotos.png foi removida depois de
// usada. Fica só como referência/documentação da técnica (mesmo padrão
// do crop-brands.js), caso precise recortar um novo export no futuro.
// Recorta os 12 blocos de foto detectados automaticamente (via
// detect-gallery.js, connected-component scan sobre pixels "não-fundo")
// em assets/gallery/photo-NN.jpg (1x/2x). Frame fonte: 1366x595 @1x /
// 2732x1190 @2x.
const { Jimp } = require('jimp');
const path = require('path');

const SRC_2X = path.join(__dirname, 'assets/portfolio/12-galeria-fotos-2x.png');
const OUT_DIR = path.join(__dirname, 'assets/gallery');
const FRAME_W = 1366, FRAME_H = 595;

// ordem de leitura natural (linha de cima esq->dir, depois linha de
// baixo esq->dir) — importante pro stagger ficar em cascata coerente
const photos = [
  { slug: 'photo-01', x: 84,   y: 52,  w: 436, h: 624 },
  { slug: 'photo-02', x: 552,  y: 128, w: 408, h: 440 },
  { slug: 'photo-03', x: 1068, y: 68,  w: 312, h: 492 },
  { slug: 'photo-04', x: 1488, y: 188, w: 364, h: 420 },
  { slug: 'photo-05', x: 1920, y: 120, w: 368, h: 388 },
  { slug: 'photo-06', x: 2320, y: 52,  w: 376, h: 592 },
  { slug: 'photo-07', x: 104,  y: 708, w: 368, h: 384 },
  { slug: 'photo-08', x: 548,  y: 664, w: 420, h: 452 },
  { slug: 'photo-09', x: 1016, y: 596, w: 392, h: 412 },
  { slug: 'photo-10', x: 1464, y: 664, w: 392, h: 452 },
  { slug: 'photo-11', x: 1904, y: 584, w: 376, h: 416 },
  { slug: 'photo-12', x: 2320, y: 680, w: 364, h: 384 },
];

(async () => {
  const src = await Jimp.read(SRC_2X);
  const positions = [];
  for (const p of photos) {
    const crop2x = src.clone().crop({ x: p.x, y: p.y, w: p.w, h: p.h });
    await crop2x.write(path.join(OUT_DIR, p.slug + '-2x.jpg'));
    const crop1x = crop2x.clone().resize({ w: Math.round(p.w / 2), h: Math.round(p.h / 2) });
    await crop1x.write(path.join(OUT_DIR, p.slug + '.jpg'));

    const leftPct = (p.x / 2 / FRAME_W * 100).toFixed(2);
    const topPct = (p.y / 2 / FRAME_H * 100).toFixed(2);
    const widthPct = (p.w / 2 / FRAME_W * 100).toFixed(2);
    const heightPct = (p.h / 2 / FRAME_H * 100).toFixed(2);
    positions.push({ slug: p.slug, leftPct, topPct, widthPct, heightPct });
    console.log('ok', p.slug, `left:${leftPct}% top:${topPct}% width:${widthPct}% height:${heightPct}%`);
  }
  require('fs').writeFileSync(path.join(__dirname, 'gallery-positions.json'), JSON.stringify(positions, null, 2));
})();
