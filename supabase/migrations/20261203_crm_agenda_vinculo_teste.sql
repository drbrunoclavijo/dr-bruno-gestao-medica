-- Vínculo explícito opcional: nunca deduzir identidade por nome/telefone.
alter table public.crm_contatos_teste
 add column if not exists paciente_id uuid references public.pacientes(id) on delete set null;
create unique index if not exists crm_contatos_paciente_unico_teste
 on public.crm_contatos_teste(paciente_id) where paciente_id is not null;
-- Mantém as políticas atuais do CRM e as permissões da agenda.
