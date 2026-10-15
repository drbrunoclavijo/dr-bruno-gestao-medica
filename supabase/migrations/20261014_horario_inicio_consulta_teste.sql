-- Registra quando o formulário da consulta de TESTE foi aberto.
-- Execute uma vez no SQL Editor após revisar o ambiente do projeto.
ALTER TABLE public.consultas_teste
  ADD COLUMN IF NOT EXISTS iniciada_em timestamptz;
COMMENT ON COLUMN public.consultas_teste.iniciada_em IS
  'Instante informado pelo navegador quando o formulário de consulta de teste foi aberto; não é assinatura nem carimbo de tempo auditável.';
