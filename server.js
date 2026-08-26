// Servidor local/Render — serve os arquivos estáticos (portfólio,
// depoimento.html, banco-de-leads.html) e expõe as mesmas rotas /api/*
// que, na Vercel, viram funções serverless separadas em api/*.js. A lógica
// de negócio (leads, depoimentos, auth do CRM) fica em lib/*.js e é
// compartilhada pelos dois ambientes — aqui só existe o roteamento HTTP
// bruto (sem framework) e o serviço de arquivos estáticos.
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const { applyCors, readJsonBody, sendJson } = require('./lib/http');
const { requireCrmAuth } = require('./lib/crm-auth');
const { listLeads, upsertLead, setLeadStatus } = require('./lib/leads');
const { listDepoimentos, createDepoimento, updateDepoimentoStatus } = require('./lib/depoimentos');
const { notifyNtfy } = require('./lib/ntfy');

const root = __dirname;
// process.env.PORT — quem hospeda (Render, Railway etc.) injeta essa
// variável com a porta real que o processo deve escutar; 5757 continua
// sendo o padrão só pro ambiente local, onde essa variável não existe.
const port = process.env.PORT || 5757;
const videosDir = path.join(root, 'videos');

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

function handleApi(req, res, urlPath) {
  try {
    return handleApiInner(req, res, urlPath);
  } catch (err) {
    console.error('Erro não tratado numa rota de API:', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Erro interno do servidor' });
    return true;
  }
}

function handleApiInner(req, res, urlPath) {
  if (applyCors(req, res)) return true;

  if (urlPath === '/api/public-config' && req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    sendJson(res, 200, {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_KEY || '',
      storageBucket: 'depoimentos-uploads',
    });
    return true;
  }

  if (urlPath === '/api/leads' && req.method === 'GET') {
    if (!requireCrmAuth(req, res)) return true; // lista completa — só o CRM
    listLeads()
      .then(function (items) { sendJson(res, 200, items); })
      .catch(function (err) { sendJson(res, 500, { error: 'Falha ao consultar o Supabase: ' + err.message }); });
    return true;
  }

  if (urlPath === '/api/leads' && req.method === 'POST') {
    readJsonBody(req, function (err, data) {
      if (err) { sendJson(res, 400, { error: 'JSON inválido' }); return; }
      if (!data.name || (!data.email && !data.whatsapp && !data.instagram)) {
        sendJson(res, 400, { error: 'Faltam campos: name + (email ou whatsapp ou instagram)' });
        return;
      }
      upsertLead(data)
        .then(function (lead) { sendJson(res, 201, lead); })
        .catch(function (err) { sendJson(res, 500, { error: 'Falha ao salvar no Supabase: ' + err.message }); });
    });
    return true;
  }

  const statusMatch = urlPath.match(/^\/api\/leads\/([^/]+)\/status$/);
  if (statusMatch && req.method === 'PATCH') {
    if (!requireCrmAuth(req, res)) return true;
    readJsonBody(req, function (err, data) {
      if (err || !data.status) { sendJson(res, 400, { error: 'Body precisa de { status }' }); return; }
      setLeadStatus(statusMatch[1], data.status)
        .then(function (lead) {
          if (!lead) { sendJson(res, 404, { error: 'Lead não encontrado' }); return; }
          sendJson(res, 200, lead);
        })
        .catch(function (err) { sendJson(res, 500, { error: 'Falha ao atualizar no Supabase: ' + err.message }); });
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

function safeSend500(res) {
  if (res.headersSent) return;
  try {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erro interno do servidor');
  } catch (e) { /* nada mais a fazer */ }
}

http.createServer((req, res) => {
  // TODA a lógica de uma requisição fica dentro deste try — decodeURIComponent()
  // lança uma exceção SÍNCRONA ("URI malformed") pra qualquer URL com %
  // mal-formado (bots/scanners mandam isso o tempo todo). Sem este
  // try/catch, essa exceção não tratada dentro do callback do
  // http.createServer derruba o processo Node inteiro.
  try {
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('URL malformada');
      return;
    }

    if (urlPath.startsWith('/api/')) {
      if (handleApi(req, res, urlPath)) return;
      sendJson(res, 404, { error: 'Rota de API não encontrada' });
      return;
    }

    if (urlPath === '/' || urlPath.endsWith('/')) urlPath += 'index.html';
    else if (CLEAN_ROUTES[urlPath]) urlPath = '/' + CLEAN_ROUTES[urlPath];

    // painel do CRM (direto ou via /crm, /admin) pede a senha antes de
    // servir o HTML — sem isso o navegador nem chegaria a mostrar o
    // prompt, já que a página abriria livre pra qualquer um com o link.
    if (urlPath === '/banco-de-leads.html' && !requireCrmAuth(req, res)) return;

    let filePath = path.join(root, urlPath);
    fs.readFile(filePath, (err, data) => {
      try {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath);
        // no-store: os mesmos nomes de arquivo (styles.css, index.html, os
        // PNGs de assets/portfolio/) são sobrescritos várias vezes ao
        // longo do projeto — sem isso, o navegador pode segurar uma
        // versão em cache e mostrar um CSS/imagem antigo mesmo depois do
        // servidor já estar com o arquivo novo.
        res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      } catch (err2) {
        console.error('Erro ao servir arquivo estático:', err2);
        safeSend500(res);
      }
    });
  } catch (err) {
    console.error('Erro não tratado numa requisição:', err);
    safeSend500(res);
  }
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));

// Rede de segurança de último recurso: se QUALQUER coisa (inclusive um bug
// futuro, ou dentro de uma lib de terceiros) escapar de todo o try/catch
// acima e virar uma exceção assíncrona não capturada, registra no log em
// vez de deixar o processo Node inteiro morrer.
process.on('uncaughtException', function (err) {
  console.error('uncaughtException — processo continua no ar:', err);
});
process.on('unhandledRejection', function (reason) {
  console.error('unhandledRejection — processo continua no ar:', reason);
});
