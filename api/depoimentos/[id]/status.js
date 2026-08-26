const { applyCors, readJsonBody, sendJson } = require('../../../lib/http');
const { requireCrmAuth } = require('../../../lib/crm-auth');
const { updateDepoimentoStatus } = require('../../../lib/depoimentos');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'PATCH') { sendJson(res, 404, { error: 'Rota de API não encontrada' }); return; }
  if (!requireCrmAuth(req, res)) return;

  const id = req.query.id;
  readJsonBody(req, async function (err, data) {
    if (err || !data.status) { sendJson(res, 400, { error: 'Body precisa de { status }' }); return; }
    try {
      const item = await updateDepoimentoStatus(id, data.status);
      if (!item) { sendJson(res, 404, { error: 'Depoimento não encontrado' }); return; }
      sendJson(res, 200, item);
    } catch (e) {
      sendJson(res, 500, { error: 'Falha ao atualizar no Supabase: ' + e.message });
    }
  });
};
