-- Rode isto no SQL Editor do projeto epctnbqokxdnbisernrf.
-- As tabelas ugc_leads/ugc_depoimentos foram criadas SEM todas as
-- colunas (confirmado ao vivo: "logo_url" faltando em ugc_depoimentos,
-- "is_recurrent" faltando em ugc_leads — provavelmente o SQL anterior
-- foi cortado/truncado ao colar no editor). "add column if not exists"
-- é seguro rodar mesmo nas colunas que já existem — não apaga nada.

alter table public.ugc_depoimentos add column if not exists status text not null default 'pendente';
alter table public.ugc_depoimentos add column if not exists logo_url text default '';
alter table public.ugc_depoimentos add column if not exists video_url text default '';
alter table public.ugc_depoimentos add column if not exists nota int not null default 5;
alter table public.ugc_depoimentos add column if not exists depoimento text not null default '';
alter table public.ugc_depoimentos add column if not exists empresa text not null default '';
alter table public.ugc_depoimentos add column if not exists nome text not null default '';
alter table public.ugc_depoimentos add column if not exists created_at timestamptz not null default now();

alter table public.ugc_leads add column if not exists name text not null default '';
alter table public.ugc_leads add column if not exists company text not null default '';
alter table public.ugc_leads add column if not exists email text not null default '';
alter table public.ugc_leads add column if not exists whatsapp text not null default '';
alter table public.ugc_leads add column if not exists instagram text not null default '';
alter table public.ugc_leads add column if not exists source text not null default 'desconhecido';
alter table public.ugc_leads add column if not exists status text not null default 'novo';
alter table public.ugc_leads add column if not exists is_recurrent boolean not null default false;
alter table public.ugc_leads add column if not exists created_at timestamptz not null default now();
alter table public.ugc_leads add column if not exists last_submitted_at timestamptz not null default now();
alter table public.ugc_leads add column if not exists status_updated_at timestamptz;
alter table public.ugc_leads add column if not exists history jsonb not null default '[]'::jsonb;

-- Depois de rodar, force o PostgREST a esquecer o schema antigo em cache:
select pg_notify('pgrst', 'reload schema');
