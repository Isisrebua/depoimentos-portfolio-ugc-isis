require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const root = __dirname;
// process.env.PORT — quem hospeda (Render, Railway etc.) injeta essa
// variável com a porta real que o processo deve escutar; 5757 continua
// sendo o padrão só pro ambiente local, onde essa variável não existe.
const port = process.env.PORT || 5757;
const leadsFile = path.join(root, 'leads.json');
const uploadsDir = path.join(root, 'uploads');
const videosDir = path.join(root, 'videos');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(videosDir, { recursive: true });

// Num deploy novo (Render, Railway etc.) este arquivo ainda não existe no
// disco — cria vazio ("[]") na primeira subida, pra GET /api/leads nunca
// cair em erro de arquivo ausente antes do primeiro POST de verdade.
// (Depoimentos não usam mais arquivo local — ver bloco SUPABASE abaixo.)
if (!fs.existsSync(leadsFile)) fs.writeFileSync(leadsFile, '[]');

/* ============================================================================
   SUPABASE — banco de dados na nuvem pros depoimentos (substitui o antigo
   depoimentos.json). Resolve o problema do disco efêmero do Render: antes,
   qualquer depoimento enviado sumia no próximo redeploy/reinício; agora
   fica salvo permanentemente no Postgres do Supabase. SUPABASE_URL e
   SUPABASE_KEY vêm de variáveis de ambiente (.env local, ou o painel
   "Environment" do Render em produção) — NUNCA ficam hardcoded aqui, pra
   não vazar no GitHub. Ver supabase/schema.sql pra criar a tabela (passo
   manual único, uma vez só, no SQL Editor do Supabase).
   ========================================================================== */
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn('AVISO: SUPABASE_URL/SUPABASE_KEY não configuradas — rotas de depoimentos vão falhar. Veja .env.example.');
}
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

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
   sempre nasce "pendente", salvo na tabela "depoimentos" do Supabase) →
   aparece na aba "Depoimentos" do banco-de-leads.html pra Isis Aprovar/
   Ocultar → só os "aprovado" saem em GET /api/depoimentos?status=aprovado,
   que é o que o widget público do index.html consome.

   As colunas no Supabase são snake_case (responsible_name, testimonial_text
   etc. — convenção do Postgres); mapDepoimentoRow() traduz pra o mesmo
   formato camelCase que o front-end (script.js, banco-de-leads.js) sempre
   usou, então NENHUM código de front-end precisou mudar nessa migração.
   ========================================================================== */
function mapDepoimentoRow(row) {
  return {
    id: row.id,
    responsibleName: row.responsible_name,
    company: row.company,
    rating: row.rating,
    text: row.testimonial_text,
    logoUrl: row.logo_url || '',
    videoUrl: row.video_url || '',
    videoKind: row.video_kind,
    status: row.status,
    createdAt: row.created_at,
    statusUpdatedAt: row.status_updated_at,
  };
}

async function listDepoimentos(statusFilter) {
  let query = supabase.from('depoimentos').select('*').order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapDepoimentoRow);
}

async function updateDepoimentoStatus(id, status) {
  const { data, error } = await supabase
    .from('depoimentos')
    .update({ status: status, status_updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? mapDepoimentoRow(data) : null;
}

/* ============================================================================
   NOTIFICAÇÃO NO CELULAR — ntfy.sh
   Toda vez que um depoimento novo é salvo, dispara um POST pro tópico
   ntfy.sh/isis-ugc-depoimentolead com nome/marca/nota/texto. É fire-and-
   -forget: roda depois da resposta 201 já ter sido mandada pro navegador
   do cliente, então se o ntfy estiver fora do ar isso NUNCA atrasa nem
   quebra o envio do depoimento — só perde a notificação daquela vez.
   Aviso de privacidade: tópicos do ntfy.sh são públicos por padrão —
   qualquer pessoa que souber o nome exato do tópico pode se inscrever e
   ver essas notificações (nome, marca, nota, texto do depoimento). ntfy é
   simples de usar exatamente por isso; se isso virar um problema depois,
   dá pra trocar por um servidor ntfy próprio com autenticação.
   ========================================================================== */
const NTFY_URL = 'https://ntfy.sh/isis-ugc-depoimentolead';

function notifyNtfy(item) {
  const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
  const body = [
    'Novo depoimento recebido!',
    'Nome: ' + item.responsibleName,
    'Marca: ' + item.company,
    'Nota: ' + stars + ' (' + item.rating + '/5)',
    '',
    item.text,
  ].join('\n');

  fetch(NTFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: body,
  }).catch(function (err) {
    console.error('ntfy: falha ao notificar', err.message);
  });
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

// Uploads (logo/vídeo) continuam gravados em uploads/, no disco local —
// isso NÃO mudou nesta migração. No Render (disco efêmero), o TEXTO do
// depoimento agora sobrevive a um redeploy (está no Supabase), mas o
// arquivo de logo/print/vídeo anexado ainda pode sumir. Se isso virar
// problema, o próximo passo natural é mover esses arquivos pro Supabase
// Storage também — fica de fora do pedido de hoje, que era só o banco.
async function createDepoimento(incoming) {
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

  const { data, error } = await supabase
    .from('depoimentos')
    .insert({
      responsible_name: String(incoming.responsibleName || '').trim(),
      company: String(incoming.company || '').trim(),
      rating: rating,
      testimonial_text: String(incoming.text || '').trim(),
      logo_url: logoUrl,
      video_url: videoUrl,
      video_kind: videoKind, // 'image' | 'video' | null
      status: 'pendente', // 'pendente' | 'aprovado' | 'oculto'
    })
    .select()
    .single();

  if (error) throw error;
  return mapDepoimentoRow(data);
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

/* ============================================================================
   SENHA DO CRM — protege o painel (banco-de-leads.html, rotas /crm e /admin)
   e as rotas de API que só o CRM usa: listar TODOS os leads/depoimentos
   (visão completa, com pendente/oculto) e aprovar/ocultar/mudar status.
   Fica de fora: POST /api/leads e POST /api/depoimentos (formulários
   públicos de captura precisam continuar abertos pra qualquer visitante) e
   GET /api/depoimentos?status=aprovado (é o que o widget público do
   index.html consome).
   Autenticação HTTP Basic — o navegador mostra o prompt nativo de usuário/
   senha sozinho ao acessar /crm; depois de digitar 1x, ele guarda a
   credencial pra aquela aba/origem e já manda automaticamente nas chamadas
   fetch() seguintes (mesma origem), sem precisar de tela de login própria
   nem de cookie/sessão. Usuário pode ser qualquer texto — só a senha conta.
   ========================================================================== */
const CRM_PASSWORD = 'Lucyrebua2@';

function hasCrmAuth(req) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const pass = decoded.slice(decoded.indexOf(':') + 1);
  return pass === CRM_PASSWORD;
}

function requireCrmAuth(req, res) {
  if (hasCrmAuth(req)) return true;
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="CRM Isis Rebua", charset="UTF-8"',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end('Acesso restrito — senha do CRM necessária.');
  return false;
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
    if (!requireCrmAuth(req, res)) return true; // lista completa — só o CRM
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
    if (!requireCrmAuth(req, res)) return true;
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
    // ?status=aprovado — usado pelo widget público do index.html, fica
    // aberto sem senha. Qualquer outra consulta (sem filtro, ou
    // pendente/oculto) é visão do painel /crm — exige a senha do CRM.
    const query = new URL(req.url, 'http://localhost').searchParams;
    const statusFilter = query.get('status');
    if (statusFilter !== 'aprovado' && !requireCrmAuth(req, res)) return true;
    listDepoimentos(statusFilter)
      .then(function (items) { sendJson(res, 200, items); })
      .catch(function (err) { sendJson(res, 500, { error: 'Falha ao consultar o Supabase: ' + err.message }); });
    return true;
  }

  if (urlPath === '/api/depoimentos' && req.method === 'POST') {
    readJsonBody(req, function (err, data) {
      if (err) { sendJson(res, 400, { error: 'JSON inválido' }); return; }
      if (!data.responsibleName || !data.company || !data.text) {
        sendJson(res, 400, { error: 'Faltam campos: responsibleName, company e text são obrigatórios' });
        return;
      }
      createDepoimento(data)
        .then(function (item) {
          sendJson(res, 201, item);
          notifyNtfy(item); // fire-and-forget — não atrasa nem quebra a resposta já enviada
        })
        .catch(function (err) { sendJson(res, 500, { error: 'Falha ao salvar no Supabase: ' + err.message }); });
    });
    return true;
  }

  const depoStatusMatch = urlPath.match(/^\/api\/depoimentos\/([^/]+)\/status$/);
  if (depoStatusMatch && req.method === 'PATCH') {
    if (!requireCrmAuth(req, res)) return true;
    readJsonBody(req, function (err, data) {
      if (err || !data.status) { sendJson(res, 400, { error: 'Body precisa de { status }' }); return; }
      updateDepoimentoStatus(depoStatusMatch[1], data.status)
        .then(function (item) {
          if (!item) { sendJson(res, 404, { error: 'Depoimento não encontrado' }); return; }
          sendJson(res, 200, item);
        })
        .catch(function (err) { sendJson(res, 500, { error: 'Falha ao atualizar no Supabase: ' + err.message }); });
    });
    return true;
  }

  return false;
}

// Rotas amigáveis pra compartilhar por WhatsApp/bio de rede social em vez
// do nome cru do arquivo .html — servem o mesmo arquivo, só com um caminho
// curto e fácil de digitar/lembrar.
const CLEAN_ROUTES = {
  '/avaliar': 'depoimento.html',
  '/feedback': 'depoimento.html',
  '/crm': 'banco-de-leads.html',
  '/admin': 'banco-de-leads.html',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath.startsWith('/api/')) {
    if (handleApi(req, res, urlPath)) return;
    sendJson(res, 404, { error: 'Rota de API não encontrada' });
    return;
  }

  if (urlPath === '/' || urlPath.endsWith('/')) urlPath += 'index.html';
  else if (CLEAN_ROUTES[urlPath]) urlPath = '/' + CLEAN_ROUTES[urlPath];

  // painel do CRM (direto ou via /crm, /admin) pede a senha antes de
  // servir o HTML — sem isso o navegador nem chegaria a mostrar o prompt,
  // já que a página abriria livre pra qualquer um com o link.
  if (urlPath === '/banco-de-leads.html' && !requireCrmAuth(req, res)) return;

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
