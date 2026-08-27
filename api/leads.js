// Único arquivo cuida de /api/leads (GET/POST) e /api/leads/:id/status
// (PATCH) — em vez de usar a pasta api/leads/[id]/status.js (convenção de
// rota dinâmica por nome de pasta), porque sob "builds" explícito no
// vercel.json (necessário pra corrigir os arquivos estáticos) essa
// convenção de colchetes não é resolvida automaticamente; então
// vercel.json manda TODO /api/leads* pra cá (ver rota "/api/leads(/.*)?")
// e o próprio req.url é inspecionado abaixo pra decidir qual caso é.
const { applyCors, readJsonBody, sendJson } = require('../lib/http');
const { requireCrmAuth } = require('../lib/crm-auth');
const { listLeads, upsertLead, setLeadStatus } = require('../lib/leads');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  const pathOnly = req.url.split('?')[0];
  const statusMatch = pathOnly.match(/^\/api\/leads\/([^/]+)\/status\/?$/);

  if (statusMatch && req.method === 'PATCH') {
    if (!requireCrmAuth(req, res)) return;
    readJsonBody(req, async function (err, data) {
      if (err || !data.status) { sendJson(res, 400, { error: 'Body precisa de { status }' }); return; }
      try {
        const lead = await setLeadStatus(statusMatch[1], data.status);
        if (!lead) { sendJson(res, 404, { error: 'Lead não encontrado' }); return; }
        sendJson(res, 200, lead);
      } catch (e) {
        sendJson(res, 500, { error: 'Falha ao atualizar no Supabase: ' + e.message });
      }
    });
    return;
  }

  if (req.method === 'GET') {
    if (!requireCrmAuth(req, res)) return; // lista completa — só o CRM
    try {
      sendJson(res, 200, await listLeads());
    } catch (err) {
      sendJson(res, 500, { error: 'Falha ao consultar o Supabase: ' + err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    readJsonBody(req, async function (err, data) {
      if (err) { sendJson(res, 400, { error: 'JSON inválido' }); return; }
      if (!data.name || (!data.email && !data.whatsapp && !data.instagram)) {
        sendJson(res, 400, { error: 'Faltam campos: name + (email ou whatsapp ou instagram)' });
        return;
      }
      try {
        const lead = await upsertLead(data);
        sendJson(res, 201, lead);
      } catch (e) {
        sendJson(res, 500, { error: 'Falha ao salvar no Supabase: ' + e.message });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'Rota de API não encontrada' });
};
