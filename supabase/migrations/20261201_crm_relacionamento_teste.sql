-- CRM inicial: ambiente de testes, sem WhatsApp automático e sem dados clínicos.
create table if not exists public.crm_contatos_teste (
 id uuid primary key default gen_random_uuid(),
 nome text not null check (char_length(trim(nome)) between 2 and 150),
 telefone text not null check (char_length(telefone) between 8 and 20),
 origem text not null default 'outro' check (origem in ('instagram','google','whatsapp','indicacao','outro')),
 interesse text not null default 'outro' check (interesse in ('emagrecimento','saude_hormonal','botox','preenchimento','bioestimulador','outro')),
 responsavel text not null default 'amanda' check (responsavel in ('amanda','bruno','carol')),
 etapa text not null default 'novo' check (etapa in ('novo','conversa','agendado','atendido','encerrado')),
 observacao text not null default '',
 permite_contato boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.crm_tarefas_teste (
 id uuid primary key default gen_random_uuid(),
 contato_id uuid not null references public.crm_contatos_teste(id) on delete cascade,
 titulo text not null check (char_length(trim(titulo)) between 2 and 150),
 vencimento date not null,
 situacao text not null default 'pendente' check (situacao in ('pendente','concluida','cancelada')),
 created_at timestamptz not null default now()
);
create index if not exists crm_tarefas_teste_vencimento_idx on public.crm_tarefas_teste(vencimento,situacao);
create index if not exists crm_contatos_teste_etapa_idx on public.crm_contatos_teste(etapa);
alter table public.crm_contatos_teste enable row level security;
alter table public.crm_tarefas_teste enable row level security;
-- Apenas perfis internos ativos; não liberar anon. Profissionais não vêem dados clínicos aqui.
drop policy if exists crm_contatos_acesso_teste on public.crm_contatos_teste;
create policy crm_contatos_acesso_teste on public.crm_contatos_teste
 for all to authenticated using (
 exists (select 1 from public.profissionais p where p.id=(select auth.uid()) and p.ativo=true and p.perfil in ('equipe','administrativo','medico','enfermeira'))
 ) with check (
 exists (select 1 from public.profissionais p where p.id=(select auth.uid()) and p.ativo=true and p.perfil in ('equipe','administrativo','medico','enfermeira'))
 );
drop policy if exists crm_tarefas_acesso_teste on public.crm_tarefas_teste;
create policy crm_tarefas_acesso_teste on public.crm_tarefas_teste
 for all to authenticated using (
 exists (select 1 from public.profissionais p where p.id=(select auth.uid()) and p.ativo=true and p.perfil in ('equipe','administrativo','medico','enfermeira'))
 ) with check (
 exists (select 1 from public.profissionais p where p.id=(select auth.uid()) and p.ativo=true and p.perfil in ('equipe','administrativo','medico','enfermeira'))
 );
revoke all on public.crm_contatos_teste,public.crm_tarefas_teste from anon;
grant select,insert,update,delete on public.crm_contatos_teste,public.crm_tarefas_teste to authenticated;
