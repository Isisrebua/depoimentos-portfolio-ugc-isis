-- URGENTE — rode isto AGORA no SQL Editor do projeto epctnbqokxdnbisernrf.
-- Confirmei ao vivo (via API, com a chave publishable) que a tabela
-- "leads" antiga (da sua outra ferramenta — nomes de barbearias, leads
-- do Google Maps/Instagram/B2B) AINDA responde com dados reais mesmo
-- depois do script de proteção anterior. Isso quer dizer que o RLS
-- provavelmente nunca chegou a ficar realmente ATIVO nela (só remover
-- as policies não basta se o RLS em si está desligado — com RLS
-- desligado, TODO mundo com a chave anon lê a tabela inteira,
-- independente de policy nenhuma existir).

-- 1) Roda isto primeiro pra ver o estado real (RLS ligado? quantas
--    policies sobraram?) — só leitura, não muda nada:
select c.relname as tabela, c.relrowsecurity as rls_ligado,
       (select count(*) from pg_policies p where p.tablename = c.relname) as qtd_policies
from pg_class c
where c.relname in ('leads', 'depoimentos')
  and c.relnamespace = 'public'::regnamespace;

-- 2) Isto aqui FECHA de vez, ligando RLS explicitamente e limpando
--    qualquer policy remanescente pra anon nas duas tabelas antigas.
--    Com RLS ligado e ZERO policies, anon fica sem nenhum acesso --
--    default-deny. Seguro rodar mesmo que já esteja tudo certo.
alter table public.leads enable row level security;
alter table public.depoimentos enable row level security;

drop policy if exists "Qualquer um pode inserir lead" on public.leads;
drop policy if exists "Leitura liberada (controle real e a senha do CRM)" on public.leads;
drop policy if exists "Atualizacao liberada (controle real e a senha do CRM)" on public.leads;

drop policy if exists "Qualquer um pode inserir depoimento" on public.depoimentos;
drop policy if exists "Leitura liberada (controle real e a senha do CRM)" on public.depoimentos;
drop policy if exists "Atualizacao liberada (controle real e a senha do CRM)" on public.depoimentos;

-- IMPORTANTE: se a sua ferramenta de leads tiver algum front-end/app que
-- lê "leads" DIRETO com a chave anon (sem passar por um backend seu com
-- service_role), ela vai parar de funcionar depois disso. Se for o
-- caso, me avise em vez de rodar o bloco 2 -- a gente cria uma policy
-- restrita certa em vez de fechar tudo.
