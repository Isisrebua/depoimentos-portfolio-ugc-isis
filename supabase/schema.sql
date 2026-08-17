-- Rode isto UMA VEZ no SQL Editor do Supabase (dashboard do projeto ->
-- SQL Editor -> New query -> cole tudo -> Run). Cria a tabela
-- "depoimentos" com o mesmo formato que o server.js espera.

create table if not exists public.depoimentos (
  id uuid primary key default gen_random_uuid(),
  responsible_name text not null,
  company text not null,
  rating int not null default 5,
  testimonial_text text not null,
  logo_url text default '',
  video_url text default '',
  video_kind text,
  status text not null default 'pendente',
  created_at timestamptz not null default now(),
  status_updated_at timestamptz
);

alter table public.depoimentos enable row level security;

-- A chave usada pelo server.js é a "publishable" (sb_publishable_...),
-- equivalente à antiga "anon key" — ela SEMPRE passa pelo RLS, mesmo
-- sendo chamada a partir do servidor. Por isso as políticas abaixo
-- liberam bastante acesso ao papel "anon": o controle de verdade sobre
-- quem pode ver/aprovar TUDO (não só os aprovados) é a senha do CRM,
-- verificada no server.js antes de qualquer consulta chegar aqui.
--
-- Se no futuro você quiser essa proteção também no nível do banco (não
-- só na senha do CRM), troque SUPABASE_KEY no .env/Render pela "secret
-- key" (sb_secret_...) do mesmo painel — ela ignora RLS, mas SÓ pode
-- ficar no servidor, nunca em código que roda no navegador.

drop policy if exists "Qualquer um pode inserir depoimento" on public.depoimentos;
create policy "Qualquer um pode inserir depoimento"
  on public.depoimentos for insert
  to anon
  with check (true);

drop policy if exists "Leitura liberada (controle real e a senha do CRM)" on public.depoimentos;
create policy "Leitura liberada (controle real e a senha do CRM)"
  on public.depoimentos for select
  to anon
  using (true);

drop policy if exists "Atualizacao liberada (controle real e a senha do CRM)" on public.depoimentos;
create policy "Atualizacao liberada (controle real e a senha do CRM)"
  on public.depoimentos for update
  to anon
  using (true)
  with check (true);
