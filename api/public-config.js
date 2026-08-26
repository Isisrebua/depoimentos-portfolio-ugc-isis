// Config pública pro navegador subir logo/vídeo direto no Supabase Storage
// (ver depoimento.html) sem passar pelo corpo da função serverless — no
// Vercel o corpo de uma função tem limite de 4.5MB, pequeno demais pra
// vídeo. SUPABASE_KEY aqui é a chave "anon/publishable" (a mesma que
// server.js sempre usou pros depoimentos) — ela é FEITA pra rodar no
// navegador, protegida pelas policies de RLS, não é segredo. Nunca coloque
// a service_role key aqui.
const { applyCors, sendJson } = require('../lib/http');

module.exports = function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') { sendJson(res, 404, { error: 'Rota de API não encontrada' }); return; }

  res.setHeader('Cache-Control', 'public, max-age=3600');
  sendJson(res, 200, {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_KEY || '',
    storageBucket: 'depoimentos-uploads',
  });
};
