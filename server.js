const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
// process.env.PORT — quem hospeda (Render, Railway etc.) injeta essa
// variável com a porta real que o processo deve escutar; 5757 continua
// sendo o padrão só pro ambiente local, onde essa variável não existe.
const port = process.env.PORT || 5757;
const leadsFile = path.join(root, 'leads.json');
const depoimentosFile = path.join(root, 'depoimentos.json');
const uploadsDir = path.join(root, 'uploads');
const videosDir = path.join(root, 'videos');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(videosDir, { recursive: true });

// Num deploy novo (Render, Railway etc.) estes arquivos ainda não existem
// no disco — cria os dois vazios ("[]") na primeira subida, pra GET
// /api/leads e GET /api/depoimentos nunca caírem em erro de arquivo
// ausente antes do primeiro POST de verdade.
[leadsFile, depoimentosFile].forEach(function (file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
});

// Extensões aceitas pra GET /api/videos — qualquer arquivo com nome real
// (sem precisar renomear pra case-1.mp4 etc.) que caia numa dessas conta.
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

/* ============================================================================
   BANCO DE LEADS — API local (arquivo leads.json ao lado deste server.js)
   Isto é o backend compartilhado que qualquer site (Portfólio UGC, Bio Site,
   UGC Manager) pode chamar via fetch() pra registrar um lead novo. Enquanto
   os três sites rodarem apontando pra este mesmo servidor, os leads caem
   todos no mesmo lugar. Se cada site for hospedado em domínio separado no
   futuro, esta API precisa estar acessível publicamente (ex: hospedada
   junto com o Portfólio) e os outros sites devem apontar o fetch() pra essa
   URL pública — o CORS abaixo já libera chamadas de qualquer origem.
   ========================================================================== */

function readLeads() {
  try {
    return JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeLeads(leads) {
  fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
}

function normEmail(s) { return String(s || '').trim().toLowerCase(); }
function normPhone(s) { return String(s || '').replace(/\D/g, ''); }
function normHandle(s) { return String(s || '').trim().replace(/^@/, '').toLowerCase(); }

// Acha um lead já existente com o mesmo e-mail, WhatsApp OU Instagram —
// essa é a checagem "OU", não "E": basta 1 dos 3 bater pra unificar.
function findExistingLead(leads, incoming) {
  const email = normEmail(incoming.email);
  const whatsapp = normPhone(incoming.whatsapp);
  const instagram = normHandle(incoming.instagram);
  return leads.find(function (l) {
    return (email && normEmail(l.email) === email) ||
      (whatsapp && normPhone(l.whatsapp) === whatsapp) ||
      (instagram && normHandle(l.instagram) === instagram);
  });
}

const KNOWN_FIELDS = ['name', 'company', 'email', 'whatsapp', 'instagram', 'source'];

function upsertLead(incoming) {
  const leads = readLeads();
  const now = new Date().toISOString();
  const extra = {};
  Object.keys(incoming).forEach(function (k) {
    if (KNOWN_FIELDS.indexOf(k) === -1) extra[k] = incoming[k];
  });
  const submission = { source: incoming.source || 'desconhecido', submittedAt: now, answers: extra };

  const existing = findExistingLead(leads, incoming);
  if (existing) {
    // Unifica na ficha existente — atualiza só os campos que vieram
    // preenchidos desta vez, nunca cria um segundo card. O canal (source)
    // também é atualizado pro mais recente, pra ficha aparecer na aba do
    // canal por onde a pessoa acabou de te procurar de novo.
    ['name', 'company', 'email', 'whatsapp', 'instagram'].forEach(function (f) {
      if (incoming[f]) existing[f] = incoming[f];
    });
    if (incoming.source) existing.source = incoming.source;
    existing.isRecurrent = true;
    existing.history = existing.history || [];
    existing.history.push(submission);
    existing.lastSubmittedAt = now;
    writeLeads(leads);
    return existing;
  }

  const lead = {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
    name: incoming.name || '',
    company: incoming.company || '',
    email: incoming.email || '',
    whatsapp: incoming.whatsapp || '',
    instagram: incoming.instagram || '',
    source: incoming.source || 'desconhecido',
    status: 'novo', // 'novo' | 'abordado'
    isRecurrent: false,
    createdAt: now,
    lastSubmittedAt: now,
    statusUpdatedAt: null,
    history: [submission],
  };
  leads.push(lead);
  writeLeads(leads);
  return lead;
}

/* ============================================================================
   DEPOIMENTOS — Sistema próprio de coleta e exibição (estilo TrustUGC).
   Fluxo: marca preenche depoimento.html → POST /api/depoimentos (status
   sempre nasce "pendente") → aparece na aba "Depoimentos" do
   banco-de-leads.html pra Isis Aprovar/Ocultar → só os "aprovado" saem em
   GET /api/depoimentos?status=aprovado, que é o que o widget público do
   index.html consome. Fica em arquivo separado (depoimentos.json), sem
   misturar com leads.json.
   ========================================================================== */
function readDepoimentos() {
  try {
    return JSON.parse(fs.readFileSync(depoimentosFile, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeDepoimentos(items) {
  fs.writeFileSync(depoimentosFile, JSON.stringify(items, null, 2));
}

// Aceita data:<mime>;base64,<...> (é assim que depoimento.html manda o
// arquivo — FileReader.readAsDataURL no navegador, sem precisar de
// parser de multipart/form-data aqui). Decodifica e grava um arquivo de
// verdade em uploads/, com nome único; devolve o caminho relativo
// ("uploads/xxxx.jpg") que já funciona direto como src/href, porque o
// servidor serve qualquer arquivo do projeto por caminho (ver embaixo).
const EXT_BY_MIME = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
};

// Devolve { url, mediaKind } — mediaKind vem do MIME real (o prefixo
// "data:<mime>;base64," não mente, ao contrário de confiar só na
// extensão do nome do arquivo depois). "image" ou "video"; null se o
// tipo não for reconhecido (arquivo é ignorado, não grava lixo).
function saveBase64File(dataUri, prefix) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUri);
  if (!match) return null;
  const mimeType = match[1];
  const ext = EXT_BY_MIME[mimeType] || '';
  if (!ext) return null; // tipo de arquivo não reconhecido — ignora em vez de gravar algo sem extensão
  const fileName = prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
  fs.writeFileSync(path.join(uploadsDir, fileName), Buffer.from(match[2], 'base64'));
  const mediaKind = mimeType.indexOf('video/') === 0 ? 'video' : mimeType.indexOf('image/') === 0 ? 'image' : null;
  return { url: 'uploads/' + fileName, mediaKind: mediaKind };
}

function createDepoimento(incoming) {
  const items = readDepoimentos();
  const rating = Math.min(5, Math.max(1, parseInt(incoming.rating, 10) || 5));

  // "logoFile" é sempre imagem (accept="image/*" no form). "videoFile"
  // agora aceita imagem OU vídeo (print de resultado ou vídeo curto) —
  // por isso guarda "videoKind" junto, pro script.js saber se deve
  // montar <img> ou <video> no card do portfólio sem ter que adivinhar
  // pela extensão do arquivo.
  let logoUrl = String(incoming.logoUrl || '').trim();
  if (incoming.logoFile) {
    const saved = saveBase64File(incoming.logoFile, 'logo');
    if (saved) logoUrl = saved.url;
  }
  let videoUrl = String(incoming.videoUrl || '').trim();
  let videoKind = null;
  if (incoming.videoFile) {
    const saved = saveBase64File(incoming.videoFile, 'video');
    if (saved) { videoUrl = saved.url; videoKind = saved.mediaKind; }
  }

  const item = {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
    responsibleName: String(incoming.responsibleName || '').trim(),
    company: String(incoming.company || '').trim(),
    rating: rating,
    text: String(incoming.text || '').trim(),
    logoUrl: logoUrl,
    videoUrl: videoUrl,
    videoKind: videoKind, // 'image' | 'video' | null (null = sem mídia, ou registro antigo antes desse campo existir)
    status: 'pendente', // 'pendente' | 'aprovado' | 'oculto'
    createdAt: new Date().toISOString(),
    statusUpdatedAt: null,
  };
  items.push(item);
  writeDepoimentos(items);
  return item;
}

// 35MB — dá espaço pro depoimento com upload de logo (até 8MB) + vídeo
// (até 15MB) já em base64 (que infla o tamanho original em ~33%), com
// folga. Leads (só texto) nunca chegam perto disso.
const MAX_BODY_BYTES = 35 * 1024 * 1024;

function readJsonBody(req, cb) {
  let body = '';
  req.on('data', function (chunk) {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) req.destroy(); // trava payload absurdo
  });
  req.on('end', function () {
    try {
      cb(null, body ? JSON.parse(body) : {});
    } catch (e) {
      cb(e);
    }
  });
}

function sendJson(res, status, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function handleApi(req, res, urlPath) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (urlPath === '/api/leads' && req.method === 'GET') {
    sendJson(res, 200, readLeads());
    return true;
  }

  if (urlPath === '/api/leads' && req.method === 'POST') {
    readJsonBody(req, function (err, data) {
      if (err) { sendJson(res, 400, { error: 'JSON inválido' }); return; }
      if (!data.name || (!data.email && !data.whatsapp && !data.instagram)) {
        sendJson(res, 400, { error: 'Faltam campos: name + (email ou whatsapp ou instagram)' });
        return;
      }
      const lead = upsertLead(data);
      sendJson(res, 201, lead);
    });
    return true;
  }

  const statusMatch = urlPath.match(/^\/api\/leads\/([^/]+)\/status$/);
  if (statusMatch && req.method === 'PATCH') {
    readJsonBody(req, function (err, data) {
      if (err || !data.status) { sendJson(res, 400, { error: 'Body precisa de { status }' }); return; }
      const leads = readLeads();
      const lead = leads.find(function (l) { return l.id === statusMatch[1]; });
      if (!lead) { sendJson(res, 404, { error: 'Lead não encontrado' }); return; }
      lead.status = data.status;
      lead.statusUpdatedAt = new Date().toISOString();
      writeLeads(leads);
      sendJson(res, 200, lead);
    });
    return true;
  }

  /* ==========================================================================
     VÍDEOS — leitura dinâmica da pasta videos/ (Cases de Sucesso)
     Em vez de exigir nomes de arquivo fixos (case-1.mp4...case-6.mp4), esta
     rota lista os arquivos de vídeo REAIS que estiverem dentro de videos/ na
     raiz do projeto — o script.js consome isso e distribui um arquivo por
     .video-slot, na ordem encontrada (ordenação alfanumérica natural).
     ========================================================================== */
  if (urlPath === '/api/videos' && req.method === 'GET') {
    let files = [];
    try {
      files = fs.readdirSync(videosDir)
        .filter(function (name) { return VIDEO_EXTENSIONS.indexOf(path.extname(name).toLowerCase()) !== -1; })
        .sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }); })
        .map(function (name) { return { name: name, url: 'videos/' + name }; });
    } catch (e) {
      files = [];
    }
    sendJson(res, 200, files);
    return true;
  }

  if (urlPath === '/api/depoimentos' && req.method === 'GET') {
    // ?status=aprovado — usado pelo widget público do index.html, que só
    // pode ver depoimentos já aprovados. Sem o parâmetro, devolve todos
    // (uso do painel /banco-de-leads.html, que precisa ver pendente/oculto
    // também pra poder aprovar/reverter).
    const query = new URL(req.url, 'http://localhost').searchParams;
    const statusFilter = query.get('status');
    const all = readDepoimentos();
    const filtered = statusFilter ? all.filter(function (d) { return d.status === statusFilter; }) : all;
    sendJson(res, 200, filtered);
    return true;
  }

  if (urlPath === '/api/depoimentos' && req.method === 'POST') {
    readJsonBody(req, function (err, data) {
      if (err) { sendJson(res, 400, { error: 'JSON inválido' }); return; }
      if (!data.responsibleName || !data.company || !data.text) {
        sendJson(res, 400, { error: 'Faltam campos: responsibleName, company e text são obrigatórios' });
        return;
      }
      const item = createDepoimento(data);
      sendJson(res, 201, item);
    });
    return true;
  }

  const depoStatusMatch = urlPath.match(/^\/api\/depoimentos\/([^/]+)\/status$/);
  if (depoStatusMatch && req.method === 'PATCH') {
    readJsonBody(req, function (err, data) {
      if (err || !data.status) { sendJson(res, 400, { error: 'Body precisa de { status }' }); return; }
      const items = readDepoimentos();
      const item = items.find(function (d) { return d.id === depoStatusMatch[1]; });
      if (!item) { sendJson(res, 404, { error: 'Depoimento não encontrado' }); return; }
      item.status = data.status;
      item.statusUpdatedAt = new Date().toISOString();
      writeDepoimentos(items);
      sendJson(res, 200, item);
    });
    return true;
  }

  return false;
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath.startsWith('/api/')) {
    if (handleApi(req, res, urlPath)) return;
    sendJson(res, 404, { error: 'Rota de API não encontrada' });
    return;
  }

  if (urlPath === '/' || urlPath.endsWith('/')) urlPath += 'index.html';
  let filePath = path.join(root, urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    // no-store: os mesmos nomes de arquivo (styles.css, index.html, os
    // PNGs de assets/portfolio/) são sobrescritos várias vezes ao longo
    // do projeto — sem isso, o navegador pode segurar uma versão em
    // cache e mostrar um CSS/imagem antigo mesmo depois do servidor já
    // estar com o arquivo novo (só um refresh comum não resolve nesse
    // caso, precisa de hard refresh). Ambiente local de poucos
    // visitantes — o custo de nunca cachear é irrelevante aqui.
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
