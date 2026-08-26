// Helpers HTTP compartilhados entre server.js (http nativo) e as funções
// serverless em api/*.js (Vercel). Os dois ambientes expõem req/res com a
// mesma interface (IncomingMessage/ServerResponse), então o mesmo código
// funciona nos dois — a única diferença é que a Vercel já entrega
// req.body pronto (parseado a partir do Content-Type) quando existe, então
// readJsonBody() aceita esse atalho e só lê o stream manualmente quando
// precisa (server.js puro).
const MAX_BODY_BYTES = 4 * 1024 * 1024; // corpo agora é só texto (uploads vão direto pro Supabase Storage do navegador)

function readJsonBody(req, cb) {
  if (req.body !== undefined) {
    // Vercel (@vercel/node) já parseou o JSON pra req.body quando o
    // Content-Type é application/json. Body vazio vira {} do lado do
    // cliente, mas cobre string vazia/undefined por segurança.
    if (typeof req.body === 'string') {
      try { return cb(null, req.body ? JSON.parse(req.body) : {}); } catch (e) { return cb(e); }
    }
    return cb(null, req.body || {});
  }
  let body = '';
  req.on('data', function (chunk) {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) req.destroy();
  });
  req.on('end', function () {
    try {
      cb(null, body ? JSON.parse(body) : {});
    } catch (e) {
      cb(e);
    }
  });
  req.on('error', cb);
}

function sendJson(res, status, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true; // requisição já respondida — rota deve parar aqui
  }
  return false;
}

module.exports = { readJsonBody, sendJson, applyCors, MAX_BODY_BYTES };
