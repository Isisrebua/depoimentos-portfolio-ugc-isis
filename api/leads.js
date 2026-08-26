const { applyCors, readJsonBody, sendJson } = require('../lib/http');
const { requireCrmAuth } = require('../lib/crm-auth');
const { listLeads, upsertLead } = require('../lib/leads');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

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
