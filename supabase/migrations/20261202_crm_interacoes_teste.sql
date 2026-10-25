-- Histórico administrativo de contatos. Apenas ambiente fictício/teste.
create table if not exists public.crm_interacoes_teste (
 id uuid primary key default gen_random_uuid(),
 contato_id uuid not null references public.crm_contatos_teste(id) on delete cascade,
 tipo text not null check (tipo in ('ligacao','whatsapp','presencial','outro')),
 resumo text not null check (char_length(trim(resumo)) between 2 and 500),
 criado_em timestamptz not null default now(),
 criado_por uuid not null default auth.uid() references auth.users(id)
);
create index if not exists crm_interacoes_contato_data_idx on public.crm_interacoes_teste(contato_id,criado_em desc);
alter table public.crm_interacoes_teste enable row level security;
drop policy if exists crm_interacoes_acesso_teste on public.crm_interacoes_teste;
create policy crm_interacoes_acesso_teste on public.crm_interacoes_teste
 for all to authenticated
 using (exists(select 1 from public.profissionais p where p.id=(select auth.uid()) and p.ativo=true and p.perfil in ('medico','enfermeira','equipe','administrativo')))
 with check (criado_por=(select auth.uid()) and exists(select 1 from public.profissionais p where p.id=(select auth.uid()) and p.ativo=true and p.perfil in ('medico','enfermeira','equipe','administrativo')));
revoke all on public.crm_interacoes_teste from anon;
grant select,insert on public.crm_interacoes_teste to authenticated;
-- Atualização e exclusão indisponíveis para preservar o registro original.
