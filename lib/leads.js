// BANCO DE LEADS — antes vivia em leads.json ao lado do server.js; migrado
// pra Supabase (tabela "leads") porque no Vercel cada requisição pode cair
// numa instância serverless diferente, sem disco compartilhado — um
// arquivo local gravado numa invocação não é visto pela próxima. Ver
// supabase/migration-vercel.sql pra criar a tabela (passo manual único, no
// SQL Editor do Supabase — mesma tabela serve local (server.js) e Vercel).
const { supabase } = require('./supabase');

function normEmail(s) { return String(s || '').trim().toLowerCase(); }
function normPhone(s) { return String(s || '').replace(/\D/g, ''); }
function normHandle(s) { return String(s || '').trim().replace(/^@/, '').toLowerCase(); }

const KNOWN_FIELDS = ['name', 'company', 'email', 'whatsapp', 'instagram', 'source'];

function mapLeadRow(row) {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    source: row.source,
    status: row.status,
    isRecurrent: row.is_recurrent,
    createdAt: row.created_at,
    lastSubmittedAt: row.last_submitted_at,
    statusUpdatedAt: row.status_updated_at,
    history: row.history || [],
  };
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado (SUPABASE_URL/SUPABASE_KEY ausentes no ambiente do servidor)');
}

async function listLeads() {
  requireSupabase();
  const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
  if (error) { console.error('Supabase (listLeads):', error); throw error; }
  return data.map(mapLeadRow);
}

// Acha um lead já existente com o mesmo e-mail, WhatsApp OU Instagram —
// essa é a checagem "OU", não "E": basta 1 dos 3 bater pra unificar.
// Traz a tabela inteira e compara em JS (mesma lógica de antes, quando
// tudo vinha de leads.json em memória) em vez de montar um filtro
// .or()/ilike no Postgres — evita ter que escapar vírgulas/% dentro de
// e-mail/telefone/@handle na sintaxe de filtro embutido do PostgREST, o
// que seria frágil sem poder testar ao vivo agora. Volume de leads de um
// único criador não justifica otimizar isso ainda.
async function findExistingLead(incoming) {
  const email = normEmail(incoming.email);
  const whatsapp = normPhone(incoming.whatsapp);
  const instagram = normHandle(incoming.instagram);
  if (!email && !whatsapp && !instagram) return null;

  const { data, error } = await supabase.from('leads').select('*');
  if (error) { console.error('Supabase (findExistingLead):', error); throw error; }

  return (data || []).find(function (l) {
    return (email && normEmail(l.email) === email) ||
      (whatsapp && normPhone(l.whatsapp) === whatsapp) ||
      (instagram && normHandle(l.instagram) === instagram);
  }) || null;
}

async function upsertLead(incoming) {
  requireSupabase();
  const now = new Date().toISOString();
  const extra = {};
  Object.keys(incoming).forEach(function (k) {
    if (KNOWN_FIELDS.indexOf(k) === -1) extra[k] = incoming[k];
  });
  const submission = { source: incoming.source || 'desconhecido', submittedAt: now, answers: extra };

  const existing = await findExistingLead(incoming);
  if (existing) {
    // Unifica na ficha existente — atualiza só os campos que vieram
    // preenchidos desta vez, nunca cria um segundo card. O canal (source)
    // também é atualizado pro mais recente.
    const patch = { is_recurrent: true, last_submitted_at: now, history: (existing.history || []).concat([submission]) };
    ['name', 'company', 'email', 'whatsapp', 'instagram'].forEach(function (f) {
      if (incoming[f]) patch[f] = incoming[f];
    });
    if (incoming.source) patch.source = incoming.source;

    const { data, error } = await supabase.from('leads').update(patch).eq('id', existing.id).select().single();
    if (error) { console.error('Supabase (upsertLead/update):', error); throw error; }
    return mapLeadRow(data);
  }

  const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
  const { data, error } = await supabase.from('leads').insert({
    id: id,
    name: incoming.name || '',
    company: incoming.company || '',
    email: incoming.email || '',
    whatsapp: incoming.whatsapp || '',
    instagram: incoming.instagram || '',
    source: incoming.source || 'desconhecido',
    status: 'novo', // 'novo' | 'abordado'
    is_recurrent: false,
    last_submitted_at: now,
    history: [submission],
  }).select().single();
  if (error) { console.error('Supabase (upsertLead/insert):', error); throw error; }
  return mapLeadRow(data);
}

async function setLeadStatus(id, status) {
  requireSupabase();
  const statusUpdatedAt = new Date().toISOString();
  // .select('id') em vez da linha inteira — mesmo motivo de
  // updateDepoimentoStatus em lib/depoimentos.js: o front-end já mudou a
  // tela de forma otimista e não usa o corpo da resposta, só o status
  // HTTP; pedir a coluna mínima reduz o payload desse round-trip único.
  const { data, error } = await supabase
    .from('leads')
    .update({ status: status, status_updated_at: statusUpdatedAt })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) { console.error('Supabase (setLeadStatus):', error); throw error; }
  return data ? { id: data.id, status: status, statusUpdatedAt: statusUpdatedAt } : null;
}

module.exports = { listLeads, upsertLead, setLeadStatus };
