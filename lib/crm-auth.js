// Senha do CRM — protege o painel (banco-de-leads.html) e as rotas de API
// que só o CRM usa: listar TODOS os leads/depoimentos (visão completa, com
// pendente/oculto) e aprovar/ocultar/mudar status. Autenticação HTTP Basic
// — o navegador mostra o prompt nativo de usuário/senha sozinho ao acessar
// uma rota protegida; depois de digitar 1x, ele guarda a credencial pra
// aquela aba/origem e já manda automaticamente nas chamadas fetch()
// seguintes (mesma origem). Usuário pode ser qualquer texto — só a senha
// conta.
const CRM_PASSWORD = process.env.CRM_PASSWORD || 'Lucyrebua2@';

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

module.exports = { hasCrmAuth, requireCrmAuth };
