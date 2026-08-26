const { applyCors, readJsonBody, sendJson } = require('../../../lib/http');
const { requireCrmAuth } = require('../../../lib/crm-auth');
const { setLeadStatus } = require('../../../lib/leads');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'PATCH') { sendJson(res, 404, { error: 'Rota de API não encontrada' }); return; }
  if (!requireCrmAuth(req, res)) return;

  const id = req.query.id;
  readJsonBody(req, async function (err, data) {
    if (err || !data.status) { sendJson(res, 400, { error: 'Body precisa de { status }' }); return; }
    try {
      const lead = await setLeadStatus(id, data.status);
      if (!lead) { sendJson(res, 404, { error: 'Lead não encontrado' }); return; }
      sendJson(res, 200, lead);
    } catch (e) {
      sendJson(res, 500, { error: 'Falha ao atualizar no Supabase: ' + e.message });
    }
  });
};
