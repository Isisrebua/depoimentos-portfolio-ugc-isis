-- FECHA A LEITURA PÚBLICA de ugc_leads e ugc_depoimentos.
--
-- POR QUE: hoje essas duas tabelas têm policies que deixam a chave pública
-- (a mesma que aparece em /api/public-config) LER e ALTERAR tudo direto no
-- Supabase, sem passar pelo CRM. Ou seja, a senha do CRM não protege de
-- verdade: quem tiver a chave pública vê os leads (nome, e-mail, WhatsApp)
-- e consegue aprovar/ocultar depoimentos.
--
-- ORDEM (importante — se inverter, o site para de salvar leads/depoimentos):
--   1) No Supabase: Project Settings > API > copie a chave "service_role".
--   2) No Vercel (projeto isis-ugc-portfolio) > Settings > Environment
--      Variables: troque o valor de SUPABASE_KEY pela chave service_role e
--      crie CRM_PASSWORD com uma senha NOVA. Depois faça um novo deploy
--      (Deployments > ... > Redeploy).
--   3) SÓ ENTÃO rode este script no SQL Editor do Supabase.
--
-- Com RLS ligado e nenhuma policy, a chave pública fica sem acesso nenhum;
-- o servidor (que usa a service_role, que ignora RLS) continua funcionando.
-- Os uploads de arquivos de depoimento (Storage) NÃO são afetados.

alter table public.ugc_leads enable row level security;
alter table public.ugc_depoimentos enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('ugc_leads', 'ugc_depoimentos')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Conferência (deve mostrar rls_ligado = true e qtd_policies = 0 nas duas):
select c.relname as tabela, c.relrowsecurity as rls_ligado,
       (select count(*) from pg_policies x where x.schemaname = 'public' and x.tablename = c.relname) as qtd_policies
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('ugc_leads', 'ugc_depoimentos');
