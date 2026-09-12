-- URGENTE — rode isto AGORA no SQL Editor do projeto epctnbqokxdnbisernrf.
-- O script anterior (setup-new-project.sql) criou policies publicas
-- (select/insert/update liberados pra "anon") em cima das tabelas "leads"
-- e "depoimentos" que JA EXISTIAM neste projeto por causa de outra
-- ferramenta sua (raspagem de leads por nicho/Google Maps/Instagram) --
-- essas tabelas nao tem nada a ver com o Portfolio UGC. Como a chave
-- anon/publishable e a mesma que fica publica no script.js do site,
-- qualquer pessoa com essa chave conseguia ler (e potencialmente alterar)
-- esses 32+ leads reais direto pela API do Supabase, sem senha nenhuma.

-- Remove as 3 policies que adicionei em "leads":
drop policy if exists "Qualquer um pode inserir lead" on public.leads;
drop policy if exists "Leitura liberada (controle real e a senha do CRM)" on public.leads;
drop policy if exists "Atualizacao liberada (controle real e a senha do CRM)" on public.leads;

-- Remove as 3 policies que adicionei em "depoimentos":
drop policy if exists "Qualquer um pode inserir depoimento" on public.depoimentos;
drop policy if exists "Leitura liberada (controle real e a senha do CRM)" on public.depoimentos;
drop policy if exists "Atualizacao liberada (controle real e a senha do CRM)" on public.depoimentos;

-- Com RLS ligado e ZERO policies, "anon"/"authenticated" ficam sem
-- nenhum acesso a estas tabelas por padrao -- só quem usa a service_role
-- key (ex.: o backend da sua ferramenta de leads, se for o caso)
-- continua enxergando tudo normalmente, porque service_role sempre
-- ignora RLS. Isso deve ser mais seguro do que estava antes de eu mexer.
--
-- SE a ferramenta de raspagem de leads tiver algum front-end que lê
-- essa tabela DIRETO com a chave anon (sem passar por um backend seu),
-- ela vai parar de funcionar depois deste script -- me avise que a
-- gente ajusta com uma policy mais restrita (ex.: só leitura, só
-- escrita) em vez de deixar zero acesso.
