-- Majestic Santé Institute | prontuário de TESTES (dados fictícios).
-- Revisar políticas e ambiente antes de executar. Não usar dados clínicos reais.
create table if not exists public.consultas_teste (
 id uuid primary key default gen_random_uuid(),
 paciente_id uuid not null references public.pacientes(id) on delete restrict,
 profissional_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
 data_consulta date not null default current_date,
 motivo text not null,
 queixa_principal text,
 historia_atual text,
 antecedentes text,
 medicamentos text,
 alergias text,
 habitos text,
 exame_fisico text,
 peso_kg numeric(6,2) check (peso_kg is null or (peso_kg > 0 and peso_kg < 500)),
 altura_cm numeric(5,1) check (altura_cm is null or (altura_cm > 0 and altura_cm < 300)),
 pressao_arterial text,
 frequencia_cardiaca integer check (frequencia_cardiaca is null or frequencia_cardiaca between 20 and 300),
 diagnostico text,
 conduta text,
 evolucao text,
 retorno text,
 criado_em timestamptz not null default now(),
 constraint motivo_nao_vazio check (length(btrim(motivo)) > 0)
);
create index if not exists consultas_teste_paciente_data_idx on public.consultas_teste(paciente_id, data_consulta desc, criado_em desc);
create index if not exists consultas_teste_profissional_idx on public.consultas_teste(profissional_id);
alter table public.consultas_teste enable row level security;
revoke all on table public.consultas_teste from anon;
grant select, insert on table public.consultas_teste to authenticated;
revoke update, delete on table public.consultas_teste from authenticated;

-- Vincula o médico à autenticação já existente. Outras funções não têm acesso clínico.
drop policy if exists "consultas_teste_medico_ler" on public.consultas_teste;
create policy "consultas_teste_medico_ler" on public.consultas_teste
for select to authenticated using (
 exists(select 1 from public.profissionais p where p.id = auth.uid() and p.perfil = 'medico' and p.ativo = true)
);
drop policy if exists "consultas_teste_medico_criar" on public.consultas_teste;
create policy "consultas_teste_medico_criar" on public.consultas_teste
for insert to authenticated with check (
 profissional_id = auth.uid() and
 exists(select 1 from public.profissionais p where p.id = auth.uid() and p.perfil = 'medico' and p.ativo = true)
 and exists(select 1 from public.pacientes pa where pa.id = paciente_id)
);
-- Esta versão só permite acrescentar registros: não modifica nem apaga evoluções anteriores.
-- Correções, retificações, assinatura, logs e revisão LGPD devem ser implementados antes de produção clínica.
