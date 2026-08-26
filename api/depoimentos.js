const { applyCors, readJsonBody, sendJson } = require('../lib/http');
const { requireCrmAuth } = require('../lib/crm-auth');
const { listDepoimentos, createDepoimento } = require('../lib/depoimentos');
const { notifyNtfy } = require('../lib/ntfy');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method === 'GET') {
    // ?status=aprovado — usado pelo widget público do index.html, fica
    // aberto sem senha. Qualquer outra consulta (sem filtro, ou
    // pendente/oculto) é visão do painel /crm — exige a senha do CRM.
    const statusFilter = req.query.status;
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
