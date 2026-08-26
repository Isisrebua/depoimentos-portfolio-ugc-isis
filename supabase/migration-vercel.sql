-- Passo manual único, no SQL Editor do Supabase — necessário pra migração
-- pra Vercel (Vercel não tem disco gravável fora de /tmp, então leads.json
-- e uploads/ locais deixaram de existir; ver README.md e lib/leads.js).

-- ========================================================================
-- TABELA "leads" — antes vivia em leads.json ao lado do server.js.
-- ========================================================================
create table if not exists public.leads (
  id text primary key,
  name text not null default '',
  company text not null default '',
  email text not null default '',
  whatsapp text not null default '',
  instagram text not null default '',
  source text not null default 'desconhecido',
  status text not null default 'novo',
  is_recurrent boolean not null default false,
  created_at timestamptz not null default now(),
  last_submitted_at timestamptz not null default now(),
  status_updated_at timestamptz,
  history jsonb not null default '[]'::jsonb
);

-- Mesmo padrão de RLS já usado na tabela "depoimentos" (ver schema.sql):
-- controle de acesso real é a senha do CRM no server.js/api/*.js, não o
-- RLS — aqui só libera o suficiente pra anon (chave publishable) operar.
alter table public.leads enable row level security;

drop policy if exists "Qualquer um pode inserir lead" on public.leads;
create policy "Qualquer um pode inserir lead"
  on public.leads for insert
  to anon
  with check (true);

drop policy if exists "Leitura liberada (controle real e a senha do CRM)" on public.leads;
create policy "Leitura liberada (controle real e a senha do CRM)"
  on public.leads for select
  to anon
  using (true);

drop policy if exists "Atualizacao liberada (controle real e a senha do CRM)" on public.leads;
create policy "Atualizacao liberada (controle real e a senha do CRM)"
  on public.leads for update
  to anon
  using (true)
  with check (true);

-- ========================================================================
-- STORAGE BUCKET "depoimentos-uploads" — logo/vídeo do formulário de
-- depoimento agora sobem direto do navegador pra cá (ver depoimento.html),
-- em vez de base64 -> disco local do servidor.
-- ========================================================================
insert into storage.buckets (id, name, public)
values ('depoimentos-uploads', 'depoimentos-uploads', true)
on conflict (id) do nothing;

drop policy if exists "Qualquer um pode enviar arquivo de depoimento" on storage.objects;
create policy "Qualquer um pode enviar arquivo de depoimento"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'depoimentos-uploads');

drop policy if exists "Leitura publica dos arquivos de depoimento" on storage.objects;
create policy "Leitura publica dos arquivos de depoimento"
  on storage.objects for select
  to anon
  using (bucket_id = 'depoimentos-uploads');
