// VÍDEOS — leitura dinâmica da pasta videos/ (Cases de Sucesso). videos/ é
// gitignored (arquivos grandes, ultrapassam o limite de 100MB por arquivo
// do GitHub) — no Vercel essa pasta simplesmente não existe no deploy, e o
// try/catch abaixo já cobre isso devolvendo lista vazia (script.js já
// esconde a seção quando não há vídeo nenhum). Continua funcionando de
// verdade só em ambientes com a pasta local (Render/local), igual antes.
const fs = require('fs');
const path = require('path');
const { applyCors, sendJson } = require('../lib/http');

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];

module.exports = function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') { sendJson(res, 404, { error: 'Rota de API não encontrada' }); return; }

  let files = [];
  try {
    const videosDir = path.join(__dirname, '..', 'videos');
    files = fs.readdirSync(videosDir)
      .filter(function (name) { return VIDEO_EXTENSIONS.indexOf(path.extname(name).toLowerCase()) !== -1; })
      .sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }); })
      .map(function (name) { return { name: name, url: 'videos/' + name }; });
  } catch (e) {
    files = [];
  }
  sendJson(res, 200, files);
};
