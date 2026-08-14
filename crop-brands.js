// Script de preparo de assets — já rodou uma vez pra gerar os 46 arquivos
// em assets/brands/ (23 logos × 1x/2x) a partir do antigo PNG achatado
// 04-marcas-trabalhadas.png. Esse PNG fonte foi removido depois de usado
// (as 04-marcas-trabalhadas.png/-2x.png não existem mais no projeto) —
// este arquivo fica só como referência/documentação da técnica, caso
// precise recortar um novo export do Figma no mesmo estilo no futuro.
// Coordenadas exatas (x,y em px @1x) vieram dos nós "Clip path group" do
// Figma (frame "4 94950") — cada um é um retângulo 90x90 perfeito, já que
// é o resultado FINAL do recorte circular (não a imagem bruta por baixo,
// que vem em tamanhos inconsistentes por causa da técnica de "imagem
// grande + máscara" do Figma).
const { Jimp } = require('jimp');
const path = require('path');

const SRC = path.join(__dirname, 'assets/portfolio/04-marcas-trabalhadas-2x.png');
const OUT_DIR = path.join(__dirname, 'assets/brands');
const SCALE = 2; // o arquivo fonte é a versão -2x

const logos = [
  { x: 470, y: 64, slug: 'creamy-skincare' },
  { x: 584, y: 64, slug: 'pantene' },
  { x: 704, y: 60, slug: 'garnier' },
  { x: 817, y: 64, slug: 'loreal-professionnel' },
  { x: 923, y: 64, slug: 'sal-grosso' },
  { x: 1028, y: 64, slug: 'ice-creamy' },
  { x: 1134, y: 64, slug: 'la-chapa-house' },
  { x: 1239, y: 64, slug: 'gts-academia' },
  { x: 552, y: 171, slug: 'ij' },
  { x: 667, y: 171, slug: 'b-signature' },
  { x: 782, y: 171, slug: 'ki-beirute' },
  { x: 896, y: 171, slug: 'solarium-ubatuba' },
  { x: 1011, y: 171, slug: 'camilly-braga' },
  { x: 1125, y: 170, slug: 'akikomo' },
  { x: 1224, y: 170, slug: 'ohana-praiana' },
  { x: 507, y: 277, slug: 'litoral-pizzas' },
  { x: 614, y: 279, slug: 'moon-wave' },
  { x: 719, y: 277, slug: 'de-boa-burguer' },
  { x: 824, y: 277, slug: 'amory' },
  { x: 926, y: 277, slug: 'mordidela' },
  { x: 1028, y: 277, slug: 'use-prati' },
  { x: 1134, y: 277, slug: 'sushi-do-miranda' },
  { x: 1238, y: 276, slug: 'saint-germain' },
];

(async () => {
  const src = await Jimp.read(SRC);
  for (const logo of logos) {
    const crop = src.clone().crop({ x: logo.x * SCALE, y: logo.y * SCALE, w: 90 * SCALE, h: 90 * SCALE });
    await crop.write(path.join(OUT_DIR, logo.slug + '-2x.png'));
    const crop1x = crop.clone().resize({ w: 90, h: 90 });
    await crop1x.write(path.join(OUT_DIR, logo.slug + '.png'));
    console.log('ok', logo.slug);
  }
})();
