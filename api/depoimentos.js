// Único arquivo cuida de /api/depoimentos (GET/POST) e
// /api/depoimentos/:id/status (PATCH) — ver comentário no topo de
// api/leads.js pro motivo (rota dinâmica por pasta [id] não é resolvida
// sob "builds" explícito; vercel.json manda TODO /api/depoimentos* pra cá
// e req.url é inspecionado abaixo pra decidir qual caso é).
const { applyCors, readJsonBody, sendJson } = require('../lib/http');
const { requireCrmAuth } = require('../lib/crm-auth');
const { listDepoimentos, createDepoimento, updateDepoimentoStatus } = require('../lib/depoimentos');
const { notifyNtfy } = require('../lib/ntfy');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  const pathOnly = req.url.split('?')[0];
  const statusMatch = pathOnly.match(/^\/api\/depoimentos\/([^/]+)\/status\/?$/);

  if (statusMatch && req.method === 'PATCH') {
    if (!requireCrmAuth(req, res)) return;
    readJsonBody(req, async function (err, data) {
      if (err || !data.status) { sendJson(res, 400, { error: 'Body precisa de { status }' }); return; }
      try {
        const item = await updateDepoimentoStatus(statusMatch[1], data.status);
        if (!item) { sendJson(res, 404, { error: 'Depoimento não encontrado' }); return; }
        sendJson(res, 200, item);
      } catch (e) {
        sendJson(res, 500, { error: 'Falha ao atualizar no Supabase: ' + e.message });
      }
    });
    return;
  }

  if (req.method === 'GET') {
    // ?status=aprovado — usado pelo widget público do index.html, fica
    // aberto sem senha. Qualquer outra consulta (sem filtro, ou
    // pendente/oculto) é visão do painel /crm — exige a senha do CRM.
    // Lido direto de req.url (em vez de req.query) porque a rota chega
    // aqui via "dest" explícito no vercel.json, sem garantia de que a
    // Vercel repassa req.query fora do fluxo zero-config.
    const statusFilter = new URL(req.url, 'http://localhost').searchParams.get('status');
    if (statusFilter !== 'aprovado' && !requireCrmAuth(req, res)) return;
    try {
      sendJson(res, 200, await listDepoimentos(statusFilter));
    } catch (err) {
      sendJson(res, 500, { error: 'Falha ao consultar o Supabase: ' + err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    readJsonBody(req, async function (err, data) {
      if (err) { sendJson(res, 400, { error: 'JSON inválido' }); return; }
      if (!data.responsibleName || !data.company || !data.text) {
        sendJson(res, 400, { error: 'Faltam campos: responsibleName, company e text são obrigatórios' });
        return;
      }
      try {
        const item = await createDepoimento(data);
        sendJson(res, 201, item);
        notifyNtfy(item); // fire-and-forget — não atrasa nem quebra a resposta já enviada
      } catch (e) {
        sendJson(res, 500, { error: 'Falha ao salvar no Supabase: ' + e.message });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'Rota de API não encontrada' });
};
