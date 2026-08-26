// DEPOIMENTOS — Sistema próprio de coleta e exibição (estilo TrustUGC).
// Fluxo: marca preenche depoimento.html → arquivo de logo/vídeo (se houver)
// sobe direto do navegador pro Supabase Storage → POST /api/depoimentos só
// com texto + URLs (status sempre nasce "pendente", salvo na tabela
// "depoimentos" do Supabase) → aparece na aba "Depoimentos" do
// banco-de-leads.html pra Isis Aprovar/Ocultar → só os "aprovado" saem em
// GET /api/depoimentos?status=aprovado, que é o que o widget público do
// index.html consome.
//
// Antes o upload de logo/vídeo em base64 era decodificado aqui e gravado
// em uploads/ no disco do servidor — no Vercel isso não funciona (sistema
// de arquivos read-only fora de /tmp, que nem persiste entre requisições).
// Agora o navegador sobe o arquivo direto pro Supabase Storage (ver
// depoimento.html) e só manda a URL pública já pronta.
//
// As colunas no Supabase são snake_case (nome, empresa etc. — convenção
// do Postgres); mapDepoimentoRow() traduz pra o mesmo formato camelCase
// que o front-end (script.js, banco-de-leads.js) sempre usou.
const { supabase } = require('./supabase');

function mapDepoimentoRow(row) {
  return {
    id: row.id,
    responsibleName: row.nome,
    company: row.empresa,
    rating: row.nota,
    text: row.depoimento,
    logoUrl: row.logo_url || '',
    videoUrl: row.video_url || '',
    videoKind: row.video_kind || null, // se a coluna não existir no banco, fica null — script.js já tem fallback por extensão do arquivo
    status: row.status,
    createdAt: row.created_at,
    statusUpdatedAt: row.status_updated_at || null,
  };
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado (SUPABASE_URL/SUPABASE_KEY ausentes no ambiente do servidor)');
}

async function listDepoimentos(statusFilter) {
  requireSupabase();
  let query = supabase.from('depoimentos').select('*').order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) { console.error('Supabase (listDepoimentos):', error); throw error; }
  return data.map(mapDepoimentoRow);
}

async function createDepoimento(incoming) {
  requireSupabase();
  const rating = Math.min(5, Math.max(1, parseInt(incoming.rating, 10) || 5));

  const { data, error } = await supabase
    .from('depoimentos')
    .insert({
      nome: String(incoming.responsibleName || '').trim(),
      empresa: String(incoming.company || '').trim(),
      nota: rating,
      depoimento: String(incoming.text || '').trim(),
      logo_url: String(incoming.logoUrl || '').trim(),
      video_url: String(incoming.videoUrl || '').trim(),
      status: 'pendente', // 'pendente' | 'aprovado' | 'oculto'
    })
    .select()
    .single();

  if (error) { console.error('Supabase (createDepoimento):', error); throw error; }
  return mapDepoimentoRow(data);
}

async function updateDepoimentoStatus(id, status) {
  requireSupabase();
  const { data, error } = await supabase
    .from('depoimentos')
    .update({ status: status })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) { console.error('Supabase (updateDepoimentoStatus):', error); throw error; }
  return data ? mapDepoimentoRow(data) : null;
}

module.exports = { listDepoimentos, createDepoimento, updateDepoimentoStatus };
