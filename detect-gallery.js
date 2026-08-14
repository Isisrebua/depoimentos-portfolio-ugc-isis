const { Jimp } = require('jimp');

(async () => {
  const img = await Jimp.read('assets/portfolio/12-galeria-fotos-2x.png');
  const w = img.bitmap.width, h = img.bitmap.height;

  // amostra em grade (a cada 4px) pra achar blocos de "não-fundo" —
  // o fundo/gutter é bem claro (cinza/branco), as fotos têm bem mais
  // variação de luminância/saturação
  const step = 4;
  const cols = Math.ceil(w / step), rows = Math.ceil(h / step);
  const grid = new Uint8Array(cols * rows);

  function isBackground(hex) {
    const r = (hex >>> 24) & 255, g = (hex >>> 16) & 255, b = (hex >>> 8) & 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxc = Math.max(r, g, b), minc = Math.min(r, g, b);
    const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
    return lum > 225 && sat < 0.08;
  }

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x = Math.min(gx * step, w - 1), y = Math.min(gy * step, h - 1);
      const c = img.getPixelColor(x, y);
      grid[gy * cols + gx] = isBackground(c) ? 0 : 1;
    }
  }

  // union-find pra agrupar blocos conectados (4-direções)
  const parent = new Int32Array(cols * rows).fill(-1);
  function find(i) { while (parent[i] >= 0) { if (parent[parent[i]] >= 0) parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
  function union(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const i = gy * cols + gx;
      if (!grid[i]) continue;
      if (gx > 0 && grid[i - 1]) union(i, i - 1);
      if (gy > 0 && grid[i - cols]) union(i, i - cols);
    }
  }

  const boxes = {};
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const i = gy * cols + gx;
      if (!grid[i]) continue;
      const root = find(i);
      if (!boxes[root]) boxes[root] = { minX: gx, maxX: gx, minY: gy, maxY: gy, count: 0 };
      const b = boxes[root];
      b.minX = Math.min(b.minX, gx); b.maxX = Math.max(b.maxX, gx);
      b.minY = Math.min(b.minY, gy); b.maxY = Math.max(b.maxY, gy);
      b.count++;
    }
  }

  const results = Object.values(boxes)
    .map(b => ({
      x: b.minX * step, y: b.minY * step,
      w: (b.maxX - b.minX + 1) * step, h: (b.maxY - b.minY + 1) * step,
      count: b.count
    }))
    .filter(b => b.w > 100 && b.h > 100) // descarta ruído pequeno
    .sort((a, b) => a.y - b.y || a.x - b.x);

  console.log('total blocos encontrados:', results.length);
  results.forEach((r, i) => console.log(i, JSON.stringify(r)));
})();
