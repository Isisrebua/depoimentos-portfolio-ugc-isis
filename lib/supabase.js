// Cliente Supabase compartilhado — usado tanto pelas funções serverless em
// api/*.js (Vercel) quanto pelo server.js (Render/local), pra não duplicar
// a lógica de acesso ao banco em dois lugares. createClient() lança um erro
// SÍNCRONO ("supabaseUrl is required") se a URL vier vazia — sem essa
// guarda, faltar a variável de ambiente derruba o processo/função inteira
// na inicialização.
const { createClient } = require('@supabase/supabase-js');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  } catch (e) {
    console.error('Falha ao inicializar o cliente Supabase:', e.message);
  }
} else {
  console.warn('AVISO: SUPABASE_URL/SUPABASE_KEY não configuradas — rotas de leads/depoimentos vão responder erro 500 até isso ser corrigido. Veja .env.example.');
}

module.exports = { supabase };
