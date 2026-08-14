// Reconstroi as PNGs de seção a partir do export original do Figma
// (Downloads/Portfoliougc.zip, extraído em scratchpad/figma/original-export),
// em vez de continuar empilhando pintura-por-cima sobre uma imagem já editada
// várias vezes. Depois de renderizar cada SVG no tamanho exato do frame,
// aplica os MESMOS retângulos de pintura já usados (mesma técnica, mesmas
// cores de fundo amostradas) só nas áreas onde hoje existe um elemento HTML
// real por cima (título, botão) — pra não duplicar texto.
const { Jimp } = require('jimp');
const sharp = require('sharp');
const path = require('path');

const SVG_SRC = 'C:/Users/isisr/AppData/Local/Temp/claude/C--Users-isisr--claude/35133b0c-5125-43ea-bcc2-5ffb58530a35/scratchpad/figma/original-export';
const OUT = path.join(__dirname, 'assets/portfolio');
const TMP = 'C:/Users/isisr/AppData/Local/Temp/claude/C--Users-isisr--claude/35133b0c-5125-43ea-bcc2-5ffb58530a35/scratchpad/figma/rebuild-tmp';

// { out, svg, w, h, topCrop } — w/h é o tamanho FINAL (1x) já usado no site.
// topCrop remove uma tira de artefato de exportação no topo (mesmo técnica
// já aplicada em 03-como-trabalhar-nichos por uma tarefa anterior); só nos
// 2 arquivos onde isso já era prática estabelecida.
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

// Caixas de pintura (coordenadas 2x, iguais às já usadas em paint-titles.js
// pros títulos — dá pra reaproveisar porque, após o topCrop, o sistema de
// coordenadas da imagem nova bate exatamente com o da imagem antiga) +
// as 2 caixas "legadas" que nunca tinham sido re-detectadas nesta rodada
// (o texto antigo dos botões "Solicite orçamento" e "Entre em contato",
// e o título "VAMOS TRABALHAR JUNTOS?" no rodapé).
const paintJobs = {
  '02-sobre-mim': [
    { x: 294, y: 276, w: 838, h: 144, color: [0xee,0xee,0xee] },
    { x: 532, y: 424, w: 840, h: 108, color: [0xee,0xee,0xee] },
  ],
  '03-como-trabalhar-nichos': [
    // caixa única generosa (as duas fitas rotacionadas "MEUS"/"NICHOS"
    // formam paralelogramos, não retângulos — uma caixa só, folgada,
    // cobre a rotação inteira sem deixar sobra de nenhum dos dois lados)
    { x: 1930, y: 100, w: 680, h: 380, color: [0xee,0xee,0xee] },
  ],
  '05-cases-de-sucesso': [
    { x: 120, y: 60, w: 1050, h: 250, color: [0xbf,0xcf,0xcc] },
  ],
  '06-app-e-tech': [
    { x: 128, y: 104, w: 1008, h: 118, color: [0xee,0xee,0xee] },
  ],
  '07-fitness-bem-estar': [
    { x: 130, y: 102, w: 1006, h: 120, color: [0xee,0xee,0xee] },
  ],
  '08-moda': [
    { x: 120, y: 104, w: 1010, h: 118, color: [0xee,0xee,0xee] },
  ],
  '09-locais-servicos': [
    { x: 130, y: 104, w: 1006, h: 118, color: [0xee,0xee,0xee] },
  ],
  '10-beleza': [
    { x: 130, y: 102, w: 1006, h: 120, color: [0xee,0xee,0xee] },
  ],
  '11-pet': [
    { x: 130, y: 102, w: 1006, h: 120, color: [0xee,0xee,0xee] },
  ],
  '13-feedbacks': [
    // bloco de 4 linhas "últimos / feedbacks / das marcas / parceiras"
    // (medido direto no SVG original: sage/terracota x919-1225, y91-239 1x;
    // "últimos" acima e "parceiras" abaixo esticam a caixa)
    { x: 1780, y: 60, w: 760, h: 500, color: [0xd9,0xd9,0xd9] },
  ],
  '14-mao-na-massa': [
    // caixa única generosa cobrindo as 2 fitas rotacionadas (medido no
    // render 100% pristine, sem nenhuma pintura prévia: sage y61-271,
    // terracota y253-344 2x)
    { x: 870, y: 30, w: 1000, h: 350, color: [0xee,0xee,0xee] },
    // legado: texto antigo "Solicite orçalamento" na linha de preço
    // (medido no SVG original: x973-1084, y738-781 1x, + margem)
    { x: 1916, y: 1446, w: 282, h: 146, color: [0xee,0xee,0xee] },
  ],
  '15-pacotes': [
    { x: 1086, y: 94, w: 482, h: 132, color: [0xee,0xee,0xee] },
    { x: 1258, y: 204, w: 488, h: 90, color: [0xee,0xee,0xee] },
  ],
  '16-combo-funil': [
    { x: 1002, y: 36, w: 582, h: 150, color: [0xee,0xee,0xee] },
    { x: 1196, y: 128, w: 594, h: 138, color: [0xee,0xee,0xee] },
    // resquício decorativo: linha sálvia + cunha terracota junto de
    // "ENTENDA ESSE PACOTE:" (não é o título, é um flourish separado —
    // caixa apertada pra não apagar o texto do parágrafo logo abaixo)
    { x: 990, y: 170, w: 230, h: 40, color: [0xee,0xee,0xee] },
    { x: 1195, y: 250, w: 230, h: 55, color: [0xee,0xee,0xee] },
  ],
  '17-footer-contato': [
    // legado: título antigo "VAMOS TRABALHAR JUNTOS?" (x370-752,y60-142 1x)
    // + caixa "Entre em contato" (x443-650,y166-192 1x), numa só caixa
    { x: 700, y: 80, w: 840, h: 340, color: [0xbf,0xcf,0xcc] },
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
    console.log('reconstruído:', f.out);
  }
})();
