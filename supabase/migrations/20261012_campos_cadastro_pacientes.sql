-- Execute no SQL Editor do Supabase antes de usar os novos campos.
-- Apenas ambiente de testes com dados fictícios.
ALTER TABLE public.pacientes
 ADD COLUMN IF NOT EXISTS cpf text,
 ADD COLUMN IF NOT EXISTS email text,
 ADD COLUMN IF NOT EXISTS cep text,
 ADD COLUMN IF NOT EXISTS logradouro text,
 ADD COLUMN IF NOT EXISTS numero text,
 ADD COLUMN IF NOT EXISTS complemento text,
 ADD COLUMN IF NOT EXISTS bairro text,
 ADD COLUMN IF NOT EXISTS cidade text,
 ADD COLUMN IF NOT EXISTS uf text;
-- CPF único quando informado; não bloqueia registros antigos sem CPF.
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_cpf_unico
 ON public.pacientes (cpf) WHERE cpf IS NOT NULL;
